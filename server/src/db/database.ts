/**
 * Thin synchronous wrapper around sql.js (SQLite compiled to WebAssembly).
 *
 * The whole database lives in memory. It is loaded from / written to disk as an
 * encrypted container (see `security/container.ts`), which is why we use sql.js
 * (it can export and import the raw database image) instead of a file-backed driver.
 *
 * Usage:
 *   const db = await DiaryDb.create();            // empty DB with schema
 *   const db = await DiaryDb.fromImage(bytes);    // from a decrypted image (migrations applied)
 *   db.run('INSERT ...', [params]);
 *   const rows = db.all<{ id: number }>('SELECT id FROM entries WHERE date = ?', [date]);
 *   const bytes = db.export();                    // raw SQLite image (Uint8Array)
 *
 * Every write must go through `run`/`transaction`; the owner (UserVault) calls
 * `markDirty()` automatically via the `onWrite` hook so the container is re-encrypted
 * and persisted after each mutating request.
 */
import path from 'node:path';
import fs from 'node:fs';
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic, type SqlValue } from 'sql.js';
import { applySchema } from './schema';
import { bundleDir, nodeResolve } from '../util/paths';

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

/** Locates sql-wasm.wasm both in dev (node_modules) and in the bundled build (next to server.cjs). */
function locateWasm(file: string): string {
  const here = bundleDir();
  const candidates = [
    path.join(here, file),
    path.join(here, '..', 'node_modules', 'sql.js', 'dist', file),
    path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    // Works in dev when running from source with node_modules resolvable.
    const resolved = nodeResolve('sql.js/dist/' + file);
    if (fs.existsSync(resolved)) return resolved;
  } catch {
    /* ignore */
  }
  return candidates[0];
}

export function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({ locateFile: locateWasm });
  }
  return sqlJsPromise;
}

export type Row = Record<string, SqlValue>;
export type Params = SqlValue[] | Record<string, SqlValue>;

export interface RunResult {
  changes: number;
  lastId: number;
}

/**
 * Bit of the SQLite header's `user_version` that marks a diary whose free pages were wiped once by
 * the one-time privacy compaction of hosted mode (`compactForPrivacy`, docs/android-tasks/
 * PRIVACY-HARDENING.md item 2). A header field and not a `meta` row: the compaction adds no row and
 * no DDL to the diary (the offline-sync fixture test pins "new bookkeeping rows only under meta
 * sync:*"), VACUUM keeps it, and it travels inside the encrypted image like any other byte. The app
 * never used `user_version` before (its schema version lives in the `schema_version` table), so every
 * older diary reads 0 = not compacted. Local mode never sets it, and it drops it from a diary it takes
 * over (`forgetPrivacyCompaction`): the mark means "no old text in free space", which only hosted mode's
 * secure_delete keeps true.
 */
export const PRIVACY_COMPACTED_FLAG = 0x1;

export class DiaryDb {
  private db: SqlJsDatabase;
  private dirty = false;
  /** Incremented on every mutation; lets a writer mark the DB clean only if nothing changed meanwhile. */
  private writeSeq = 0;
  private txDepth = 0;
  /** Hosted mode: PRAGMA secure_delete is on for this database (see `enableSecureDelete`). */
  private secureDeleteOn = false;
  /** Called after every mutating statement outside a transaction, or when a transaction commits. */
  onWrite: (() => void) | null = null;

  private constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  /** New empty database with the current schema. */
  static async create(): Promise<DiaryDb> {
    const SQL = await getSqlJs();
    const db = new DiaryDb(new SQL.Database());
    db.exec('PRAGMA foreign_keys = ON;');
    applySchema(db);
    db.dirty = false;
    return db;
  }

  /**
   * Database from a raw SQLite image (e.g. decrypted container). Runs migrations. Throws
   * `NewerSchemaError` (db/schema.ts) for an image written by a newer version of the app.
   */
  static async fromImage(image: Uint8Array): Promise<DiaryDb> {
    const SQL = await getSqlJs();
    const db = new DiaryDb(new SQL.Database(image));
    db.exec('PRAGMA foreign_keys = ON;');
    // Reject corrupt images early.
    const check = db.get<{ integrity_check: string }>('PRAGMA integrity_check');
    if (!check || check.integrity_check !== 'ok') {
      db.close();
      throw new Error('integrity check failed');
    }
    try {
      applySchema(db);
    } catch (e) {
      db.close();
      throw e;
    }
    return db;
  }

  /** Raw SQLite image. */
  export(): Uint8Array {
    return this.db.export();
  }

  // Privacy (hosted mode only, docs/android-tasks/PRIVACY-HARDENING.md item 2) ---------------------

  /**
   * True once `enableSecureDelete` ran: SQLite overwrites deleted and replaced content with zeros
   * instead of leaving it in free space. sql.js re-opens its connection inside `export()`, which
   * drops the pragma - `exportImage` (security/vault.ts) switches it on again from this flag.
   */
  get secureDelete(): boolean {
    return this.secureDeleteOn;
  }

  /**
   * `PRAGMA secure_delete = ON` for this connection, now and after every re-open (see
   * `secureDelete`). A connection setting: nothing is written, the image does not change.
   */
  enableSecureDelete(): void {
    this.secureDeleteOn = true;
    this.db.exec('PRAGMA secure_delete = ON;');
  }

  /** True when the one-time privacy compaction already ran on this diary (`PRIVACY_COMPACTED_FLAG`). */
  get privacyCompacted(): boolean {
    return (Number(this.scalar<number>('PRAGMA user_version') ?? 0) & PRIVACY_COMPACTED_FLAG) !== 0;
  }

  /**
   * Marks the diary as compacted (`PRIVACY_COMPACTED_FLAG`) without compacting it: for a diary that
   * has no free space with old content (a new one). A write: the owner persists it.
   */
  markPrivacyCompacted(): void {
    const version = Number(this.scalar<number>('PRAGMA user_version') ?? 0);
    this.db.exec(`PRAGMA user_version = ${(version | PRIVACY_COMPACTED_FLAG) >>> 0};`);
    this.markDirty();
  }

  /**
   * Removes the mark (`PRIVACY_COMPACTED_FLAG`) from this database in memory, for a diary that local
   * mode takes over: local mode does not wipe deleted text, so after its next save the mark would
   * claim free space that is not clean - and a diary that reaches hosted mode again (a backup restored
   * on the PC and copied to the server as a file, the PC->hosted migration) would skip the compaction.
   * Unmarked, hosted mode compacts it again at its next opening. Not a write: the database does not
   * become dirty - an unchanged diary is not rewritten (its file keeps the mark, which is still true
   * then), and the next save of a changed one carries the cleared mark. A no-op (no statement at
   * all) for a diary without the mark: every local diary stays byte-for-byte as it was.
   */
  forgetPrivacyCompaction(): void {
    const version = Number(this.scalar<number>('PRAGMA user_version') ?? 0);
    if (!(version & PRIVACY_COMPACTED_FLAG)) return;
    this.db.exec(`PRAGMA user_version = ${(version & ~PRIVACY_COMPACTED_FLAG) >>> 0};`);
  }

  /**
   * The one-time privacy compaction: VACUUM rebuilds the image without free pages, so text that was
   * deleted or replaced before secure_delete was on is gone from it; then the diary is marked
   * (`PRIVACY_COMPACTED_FLAG`). Rows, ids (AUTOINCREMENT keys, sqlite_sequence) and the schema stay
   * as they are. Not inside a transaction. A write: the owner persists it. When VACUUM fails nothing
   * changed (it is atomic) and the diary stays unmarked, so the next opening tries again.
   */
  compactForPrivacy(): void {
    if (this.txDepth > 0) throw new Error('the privacy compaction cannot run inside a transaction');
    this.db.exec('VACUUM;');
    this.markPrivacyCompacted();
  }

  isDirty(): boolean {
    return this.dirty;
  }

  /** Monotonic count of mutations so far (see `markClean`). */
  get writeSequence(): number {
    return this.writeSeq;
  }

  /**
   * Marks the database as persisted. With `upToSequence` (the `writeSequence` read when the
   * image was exported) the flag is cleared only if no mutation happened since - writes that
   * landed while the image was being encrypted and written keep the DB dirty.
   */
  markClean(upToSequence?: number): void {
    if (upToSequence !== undefined && upToSequence !== this.writeSeq) return;
    this.dirty = false;
  }

  markDirty(): void {
    this.writeSeq++;
    this.dirty = true;
    if (this.txDepth === 0 && this.onWrite) this.onWrite();
  }

  /** Executes one or more statements without parameters (DDL, PRAGMA). */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /** Runs a mutating statement. */
  run(sql: string, params: Params = []): RunResult {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params as never);
      stmt.step();
    } finally {
      stmt.free();
    }
    const changes = this.db.getRowsModified();
    const lastRow = this.db.exec('SELECT last_insert_rowid() AS id');
    const lastId = lastRow.length && lastRow[0].values.length ? Number(lastRow[0].values[0][0]) : 0;
    this.markDirty();
    return { changes, lastId };
  }

  /** Returns all rows as objects. */
  all<T = Row>(sql: string, params: Params = []): T[] {
    const stmt = this.db.prepare(sql);
    const rows: T[] = [];
    try {
      stmt.bind(params as never);
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as unknown as T);
      }
    } finally {
      stmt.free();
    }
    return rows;
  }

  /** Returns the first row or undefined. */
  get<T = Row>(sql: string, params: Params = []): T | undefined {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params as never);
      if (stmt.step()) return stmt.getAsObject() as unknown as T;
      return undefined;
    } finally {
      stmt.free();
    }
  }

  /** Returns the first column of the first row. */
  scalar<T extends SqlValue = SqlValue>(sql: string, params: Params = []): T | undefined {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params as never);
      if (stmt.step()) {
        const row = stmt.get();
        return row[0] as T;
      }
      return undefined;
    } finally {
      stmt.free();
    }
  }

  /**
   * Runs `fn` inside a transaction (nested calls join the outer transaction).
   * Rolls back on exception. `onWrite` fires once after the outermost commit.
   */
  transaction<T>(fn: () => T): T {
    if (this.txDepth > 0) {
      this.txDepth++;
      try {
        return fn();
      } finally {
        this.txDepth--;
      }
    }
    this.db.exec('BEGIN');
    this.txDepth = 1;
    try {
      const result = fn();
      this.db.exec('COMMIT');
      this.txDepth = 0;
      if (this.dirty && this.onWrite) this.onWrite();
      return result;
    } catch (e) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      this.txDepth = 0;
      throw e;
    }
  }

  close(): void {
    try {
      this.db.close();
    } catch {
      /* ignore */
    }
  }
}

/** Helper: parse a JSON array column safely. */
export function jsonArray(value: SqlValue | undefined | null): string[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Helper: SQL NULL -> null, numbers pass through. */
export function numOrNull(value: SqlValue | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
