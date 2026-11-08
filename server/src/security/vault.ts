/**
 * UserVault: the decrypted diary database of one account, held in memory and shared by
 * every session of that user. Implements the `UserVault` contract of session-types.ts.
 *
 * Persistence (ARCHITECTURE.md section 6):
 *   - `db.onWrite` schedules a persist 250 ms later; bursts of writes coalesce into one.
 *   - persist = export SQLite image -> encryptContainer -> write `<file>.tmp` -> fsync
 *     -> rename current file to `.prev` -> rename tmp to the file. Never a partial file.
 *     The DB is marked clean only after the bytes are on disk (`db.isDirty() === false` means
 *     "everything is persisted"); a failed write leaves it dirty so the retry actually retries.
 *   - `rekey` (password change) re-encrypts immediately; `replaceDatabase` (restore) swaps
 *     the DB and persists; `close` flushes first.
 *   - Opening tolerates a crash between the two renames: `.mpd` -> `.mpd.tmp` -> `.mpd.prev`.
 *   - `onSaved` (the auth service) runs after every successful write - it keeps the registry's copy
 *     of the account language current (AccountRecord.language).
 *
 * Privacy, hosted mode only (docs/android-tasks/PRIVACY-HARDENING.md item 2; `config.mode ===
 * 'hosted'`, local mode is byte-for-byte unchanged for every diary it wrote itself - see the end of
 * this list):
 *   - every diary database of the vault runs with PRAGMA secure_delete = ON (opened, created,
 *     restored; re-applied after each export by `exportImage`), so deleted or replaced text is
 *     overwritten in memory and is absent from the next saved image;
 *   - an opened diary that is not marked yet (written before this existed) is compacted ONCE right
 *     after it was decrypted (`compactOnce`: VACUUM + the PRIVACY_COMPACTED_FLAG of db/database.ts),
 *     inside the vault's write queue, and saved; that save moves the image of before to `.prev`, so
 *     the same bytes are written once more right after it (`rotatePrev`) - the safety copy never
 *     keeps the pre-compaction image beyond the compaction save;
 *   - a new diary is marked at once (nothing to wipe); a restored backup is compacted before its
 *     first save (its free pages come from wherever the backup was made).
 * The one thing local mode does about it: a diary it opens or restores loses the mark in memory
 * (`DiaryDb.forgetPrivacyCompaction`), so its next local save - which does not wipe - writes it
 * unmarked, and a diary that comes back to hosted mode as a plain file (a hosted backup restored on
 * the PC, then the PC->hosted migration) is compacted again instead of keeping text deleted on the
 * PC. A diary without the mark (every diary local mode ever wrote) is not touched at all.
 *
 * Memory-only vaults (`createMemoryVault`, the guest account of the tour mode - security/guest.ts)
 * have no file at all: `dbPath` is empty, nothing is ever scheduled, encrypted or written, and
 * closing one simply drops the database.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ServerConfig } from '../config';
import { DiaryDb } from '../db/database';
import { NewerSchemaError } from '../db/schema';
import { ApiError } from '../errors';
import { decryptContainer, encryptContainer } from './container';
import { guestNotAllowed } from './guest';
import { KEY_LENGTH, SALT_LENGTH, wipe, type KdfParams } from './kdf';
import type { AccountRecord, UserVault } from './session-types';
import { markStorageFailed, markStorageOk } from './storage-health';

export const PERSIST_DEBOUNCE_MS = 250;
/** Back-off between retries when a background persist fails (disk full, locked file...). */
const RETRY_DELAY_MS = 5_000;

/** Salt + scrypt parameters written into the container header (so the file opens with the password). */
export interface VaultHeaderParams {
  salt: Buffer;
  kdf: KdfParams;
}

export function headerParamsOf(account: AccountRecord): VaultHeaderParams {
  const salt = Buffer.from(account.kdf.saltHex, 'hex');
  if (salt.length !== SALT_LENGTH) throw ApiError.crypto('server.crypto.badAccountSalt');
  return { salt, kdf: { N: account.kdf.N, r: account.kdf.r, p: account.kdf.p } };
}

/** Catalogue key of the 409 answered when a diary written by a newer version of the app is opened. */
export const NEWER_DIARY_VERSION_KEY = 'server.vault.newerVersion';

/** 409 DB 'server.vault.newerVersion': "... written by a newer version ... Please update the app." */
export function newerDiaryVersion(): ApiError {
  return ApiError.localized(409, 'DB', NEWER_DIARY_VERSION_KEY);
}

export function vaultPathOf(config: ServerConfig, account: AccountRecord): string {
  return path.join(config.usersDir, account.dbFile);
}

/** Renames with a short retry loop: Windows indexers/antivirus may briefly lock the target. */
async function renameWithRetry(from: string, to: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await fs.promises.rename(from, to);
      return;
    } catch (e) {
      lastErr = e;
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') throw e;
      await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.promises.access(file);
    return true;
  } catch {
    return false;
  }
}

export class DiaryVault implements UserVault {
  readonly userId: string;
  readonly dbPath: string;
  /** True for a vault without a file (guest): `persist` writes nothing. */
  readonly memoryOnly: boolean;
  /**
   * Hosted mode (privacy, see the file comment): secure_delete on every database of this vault and
   * the one-time compaction. False in local mode, where nothing of it happens.
   */
  readonly wipesDeleted: boolean;
  refCount = 0;
  /**
   * Runs after every successful write of the file, with the database that was written (the auth
   * service keeps AccountRecord.language in step with the diary's language setting). Errors are
   * the callback's own business: they never fail the write.
   */
  onSaved: ((db: DiaryDb) => void) | null = null;

  private current: DiaryDb;
  private key: Buffer;
  private header: VaultHeaderParams;
  private timer: NodeJS.Timeout | null = null;
  private queue: Promise<void> = Promise.resolve();
  private closed = false;
  private failures = 0;
  /**
   * The next successful write is the compaction save: write the same bytes once more right after
   * it, so `.prev` (which that save filled with the image of before) holds the compacted image too.
   * Stays set until such a pair of writes succeeded.
   */
  private rotatePrev = false;

  private constructor(userId: string, dbPath: string, db: DiaryDb, key: Buffer, header: VaultHeaderParams, memoryOnly = false, wipesDeleted = false) {
    this.userId = userId;
    this.dbPath = dbPath;
    this.memoryOnly = memoryOnly;
    this.wipesDeleted = wipesDeleted && !memoryOnly;
    this.current = db;
    this.key = Buffer.from(key);
    this.header = { salt: Buffer.from(header.salt), kdf: { ...header.kdf } };
    if (this.wipesDeleted) db.enableSecureDelete();
    // Local mode: a diary marked by hosted mode loses the mark with its next save (see the file comment).
    else if (!this.memoryOnly) db.forgetPrivacyCompaction();
    this.attach(db);
  }

  get db(): DiaryDb {
    return this.current;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** Opens an existing encrypted diary with its 32-byte key. */
  static async open(config: ServerConfig, account: AccountRecord, key: Buffer): Promise<DiaryVault> {
    if (key.length !== KEY_LENGTH) throw ApiError.crypto('server.crypto.badDiaryKeyLength');
    const dbPath = vaultPathOf(config, account);
    const header = headerParamsOf(account);
    const plain = await readAndDecrypt(dbPath, key);
    let db: DiaryDb;
    try {
      db = await DiaryDb.fromImage(plain);
    } catch (e) {
      // Written by a newer version of the app: refused untouched (nothing was written), with a
      // message that says what to do instead of "corrupt".
      if (e instanceof NewerSchemaError) throw newerDiaryVersion();
      throw ApiError.db('server.vault.corruptContent');
    }
    const privacy = wipesDeletedIn(config);
    const vault = new DiaryVault(account.id, dbPath, db, key, header, false, privacy);
    // Hosted mode: a diary written before secure_delete was on is compacted once, right here - the
    // opening is the vault's first moment with the key, and every request waits for it.
    if (privacy) await vault.compactOnce();
    return vault;
  }

  /** Creates an empty diary for a new account and writes it to disk before returning. */
  static async create(config: ServerConfig, account: AccountRecord, key: Buffer): Promise<DiaryVault> {
    if (key.length !== KEY_LENGTH) throw ApiError.crypto('server.crypto.badDiaryKeyLength');
    const dbPath = vaultPathOf(config, account);
    if (await exists(dbPath)) throw ApiError.io('server.vault.fileExists');
    const header = headerParamsOf(account);
    const db = await DiaryDb.create();
    const privacy = wipesDeletedIn(config);
    // Hosted mode: a new diary has no old content in free space - marked as compacted from the start.
    if (privacy) db.markPrivacyCompacted();
    const vault = new DiaryVault(account.id, dbPath, db, key, header, false, privacy);
    await vault.persist();
    return vault;
  }

  /**
   * An empty diary that lives in memory only (the guest account): no file is created, read or
   * written - not now, not on a write, not on close.
   */
  static async createInMemory(account: AccountRecord, key: Buffer): Promise<DiaryVault> {
    if (key.length !== KEY_LENGTH) throw ApiError.crypto('server.crypto.badDiaryKeyLength');
    const header = headerParamsOf(account);
    const db = await DiaryDb.create();
    return new DiaryVault(account.id, '', db, key, header, true);
  }

  // Persistence ---------------------------------------------------------------

  private attach(db: DiaryDb): void {
    // A memory-only vault has nothing to schedule: its writes stay in the database object.
    db.onWrite = this.memoryOnly ? null : () => this.schedulePersist();
  }

  private schedulePersist(delay = PERSIST_DEBOUNCE_MS): void {
    if (this.closed || this.memoryOnly) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.persistIfDirty().catch((e: unknown) => {
        this.failures++;
        console.error(`[diary-server] persist failed for ${this.userId}:`, (e as Error).message);
        // Keep trying with back-off; the data is still safe in memory.
        this.schedulePersist(Math.min(RETRY_DELAY_MS * this.failures, 60_000));
      });
    }, delay);
    // Do not keep the process alive just for a pending flush; shutdown() flushes explicitly.
    this.timer.unref?.();
  }

  /** Persists only when there are unsaved changes (the debounce path). */
  persistIfDirty(): Promise<void> {
    if (!this.current.isDirty()) return Promise.resolve();
    return this.persist();
  }

  /**
   * Encrypts and writes the DB atomically. Calls are serialised; a call during a write runs after it.
   * `strict` (rekey): a vault closed before the write came up is an error instead of a no-op.
   */
  persist(strict = false): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const run = this.queue.then(() => this.writeNow(strict));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async writeNow(strict = false): Promise<void> {
    if (this.closed) {
      if (strict) throw ApiError.sessionExpired();
      return;
    }
    if (this.memoryOnly) {
      // Nothing to write, by design: the database counts as saved the moment it changes.
      this.current.markClean();
      return;
    }
    const db = this.current;
    // Snapshot the write sequence together with the image: the DB becomes "clean" only once the
    // bytes are safely on disk, and only if nothing was written meanwhile (later writes keep it
    // dirty, so they are persisted by the next run). A failed write leaves it dirty for the retry.
    const seq = db.writeSequence;
    const image = exportImage(db);
    const bytes = encryptContainer(image, this.key, this.header.salt, this.header.kdf);
    await writeContainerAtomic(this.dbPath, bytes);
    if (this.rotatePrev) {
      // The compaction save just moved the image of before (with the old free pages) to `.prev`:
      // the same bytes once more, and the safety copy is the compacted image as well.
      await writeContainerAtomic(this.dbPath, bytes);
      this.rotatePrev = false;
    }
    db.markClean(seq);
    this.failures = 0;
    // The data volume is writable (the hosted health answer reads this; local mode only records it).
    markStorageOk();
    if (this.onSaved) {
      try {
        this.onSaved(db);
      } catch (e) {
        console.error('[diary-server] after-save step failed:', (e as Error).message);
      }
    }
  }

  // Privacy (hosted mode) -----------------------------------------------------

  /**
   * The ONE-TIME compaction of a diary opened in hosted mode (see the file comment): when it is not
   * marked yet, VACUUM wipes its free pages (text deleted or replaced before secure_delete was on),
   * the mark is set, and the result is saved through the write queue like any write - two writes
   * of the same bytes (`rotatePrev`), so neither the file nor its `.prev` keeps the old image.
   * Returns true when it compacted. Never throws: a failure is logged and the diary opens as it is
   * (unmarked when VACUUM failed - the next opening tries again; marked but unsaved when the disk
   * refused - the usual retry of a failed save writes it, rotation included).
   */
  async compactOnce(): Promise<boolean> {
    if (!this.wipesDeleted || this.closed) return false;
    const db = this.current;
    try {
      if (db.privacyCompacted) return false;
      db.compactForPrivacy();
    } catch (e) {
      console.error(`[diary-server] the privacy compaction of ${this.userId} failed; retried at the next opening:`, (e as Error).message);
      return false;
    }
    this.rotatePrev = true;
    try {
      await this.persist();
    } catch (e) {
      this.failures++;
      console.error(`[diary-server] persist failed for ${this.userId}:`, (e as Error).message);
      this.schedulePersist(Math.min(RETRY_DELAY_MS * this.failures, 60_000));
    }
    return true;
  }

  // Contract ------------------------------------------------------------------

  /**
   * Re-encrypts with a new key immediately. `header` carries the new salt/KDF parameters
   * (a password change derives the key with a fresh salt) so the file stays openable by password.
   */
  async rekey(newKey: Buffer, header?: VaultHeaderParams): Promise<void> {
    if (newKey.length !== KEY_LENGTH) throw ApiError.crypto('server.crypto.badDiaryKeyLength');
    // A closed vault writes nothing: "success" here would let the caller store a verifier for a
    // key the file was never encrypted with.
    if (this.closed) throw ApiError.sessionExpired();
    // A guest has no password to change and no file to re-encrypt.
    if (this.memoryOnly) throw guestNotAllowed();
    const oldKey = this.key;
    const oldHeader = this.header;
    this.key = Buffer.from(newKey);
    if (header) this.header = { salt: Buffer.from(header.salt), kdf: { ...header.kdf } };
    try {
      await this.persist(true);
    } catch (e) {
      // The file on disk still opens with the old key (and the registry still holds the old
      // verifier): later writes must keep using it.
      wipe(this.key);
      this.key = oldKey;
      this.header = oldHeader;
      throw e;
    }
    wipe(oldKey);
  }

  /** A copy of the 32-byte DB key (the caller should wipe it when done). */
  getKey(): Buffer {
    if (this.closed) throw ApiError.sessionExpired();
    return Buffer.from(this.key);
  }

  /**
   * Swaps the database (restore) and persists the new one under the account key. Hosted mode: the
   * restored database gets secure_delete and is compacted before its first save - a backup carries
   * the free pages of wherever it was made, and they never reach this server's disk.
   */
  async replaceDatabase(newDb: DiaryDb): Promise<void> {
    if (this.closed) throw ApiError.sessionExpired();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.wipesDeleted) {
      newDb.enableSecureDelete();
      try {
        newDb.compactForPrivacy();
      } catch (e) {
        // Unmarked: the next opening compacts it.
        console.error(`[diary-server] the privacy compaction of a restored diary of ${this.userId} failed:`, (e as Error).message);
      }
    } else if (!this.memoryOnly) {
      // Local mode: a backup made on the hosted server carries the mark; it does not stay true here.
      newDb.forgetPrivacyCompaction();
    }
    const old = this.current;
    old.onWrite = null;
    this.current = newDb;
    this.attach(newDb);
    await this.persist();
    old.close();
  }

  /**
   * Flushes unsaved changes (unless `flush` is false - account deletion), closes the DB and
   * wipes the key. Idempotent. Always waits for a write in progress so no half-written file remains.
   */
  async close(flush = true): Promise<void> {
    if (this.closed) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      if (flush && this.current.isDirty()) await this.persist();
      else await this.queue;
    } finally {
      this.closed = true;
      this.current.onWrite = null;
      this.current.close();
      wipe(this.key);
      this.refCount = 0;
    }
  }
}

/**
 * Exports the raw SQLite image. sql.js closes and re-opens its connection inside `export()`,
 * which silently drops per-connection PRAGMAs, so foreign keys are switched back on here - and,
 * for a database of hosted mode (`db.secureDelete`), secure_delete too.
 * Every caller of `db.export()` in the server must go through this helper.
 */
export function exportImage(db: DiaryDb): Uint8Array {
  const image = db.export();
  db.exec('PRAGMA foreign_keys = ON;');
  if (db.secureDelete) db.exec('PRAGMA secure_delete = ON;');
  return image;
}

/** True when the vaults of `config` wipe deleted content (hosted mode only; see the file comment). */
export function wipesDeletedIn(config: Pick<ServerConfig, 'mode'>): boolean {
  return config.mode === 'hosted';
}

/** Reads and decrypts the diary file, falling back to `.tmp` / `.prev` if the main file is missing or unreadable with `key`. */
async function readAndDecrypt(dbPath: string, key: Buffer): Promise<Buffer> {
  const candidates = [dbPath, `${dbPath}.tmp`, `${dbPath}.prev`];
  let firstError: ApiError | null = null;
  for (const file of candidates) {
    let bytes: Buffer;
    try {
      bytes = await fs.promises.readFile(file);
    } catch {
      continue;
    }
    try {
      return decryptContainer(bytes, key).plain;
    } catch (e) {
      // The main file is authoritative: remember its error, but let a good .tmp/.prev rescue us.
      if (!firstError && e instanceof ApiError) firstError = e;
    }
  }
  if (firstError) throw firstError;
  throw ApiError.io('server.vault.fileNotFound');
}

/** tmp -> fsync -> current becomes .prev -> tmp becomes current. */
async function writeContainerAtomic(dbPath: string, bytes: Buffer): Promise<void> {
  // A vault without a file (memory-only) must never get here; refuse rather than write somewhere.
  if (!dbPath) throw ApiError.io('server.vault.writeFailed');
  await fs.promises.mkdir(path.dirname(dbPath), { recursive: true });
  const tmp = `${dbPath}.tmp`;
  const prev = `${dbPath}.prev`;
  let handle: fs.promises.FileHandle | null = null;
  try {
    handle = await fs.promises.open(tmp, 'w', 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (e) {
    // Recorded with the raw error (ENOSPC is what "disk full" looks like) before it is wrapped.
    markStorageFailed(e);
    throw ApiError.io('server.vault.writeFailed');
  } finally {
    await handle?.close();
  }
  try {
    if (await exists(dbPath)) await renameWithRetry(dbPath, prev);
    await renameWithRetry(tmp, dbPath);
  } catch (e) {
    markStorageFailed(e);
    throw ApiError.io('server.vault.replaceFailed');
  }
}

/** Deletes `<file>`, `<file>.prev` and `<file>.tmp` (account deletion). Missing files are fine. */
export async function deleteVaultFiles(dbPath: string): Promise<void> {
  for (const f of [dbPath, `${dbPath}.prev`, `${dbPath}.tmp`]) {
    try {
      await fs.promises.rm(f, { force: true });
    } catch {
      throw ApiError.io('server.vault.deleteFailed');
    }
  }
}

export function openVault(config: ServerConfig, account: AccountRecord, key: Buffer): Promise<DiaryVault> {
  return DiaryVault.open(config, account, key);
}

export function createVault(config: ServerConfig, account: AccountRecord, key: Buffer): Promise<DiaryVault> {
  return DiaryVault.create(config, account, key);
}

/** A memory-only diary for the guest account (tour mode): never touches the disk. */
export function createMemoryVault(account: AccountRecord, key: Buffer): Promise<DiaryVault> {
  return DiaryVault.createInMemory(account, key);
}

/**
 * One vault per user id. `acquire` opens (or joins an open in progress) and bumps refCount;
 * `release` decrements and closes at zero. Concurrent opens for the same user share one vault.
 */
export class VaultRegistry {
  private vaults = new Map<string, DiaryVault>();
  private opening = new Map<string, Promise<DiaryVault>>();

  get(userId: string): DiaryVault | null {
    const v = this.vaults.get(userId);
    return v && !v.isClosed ? v : null;
  }

  /** Ids of the diaries open right now (idle-vault eviction, diagnostics). */
  ids(): string[] {
    return [...this.vaults.entries()].filter(([, v]) => !v.isClosed).map(([id]) => id);
  }

  /** Opens the vault if needed (with `opener`) and increments refCount. */
  async acquire(account: AccountRecord, opener: () => Promise<DiaryVault>): Promise<DiaryVault> {
    let vault = this.get(account.id);
    if (!vault) {
      let pending = this.opening.get(account.id);
      if (!pending) {
        pending = opener().then((v) => {
          this.vaults.set(account.id, v);
          return v;
        });
        this.opening.set(account.id, pending);
        pending.finally(() => this.opening.delete(account.id)).catch(() => undefined);
      }
      vault = await pending;
    }
    vault.refCount++;
    return vault;
  }

  /** Decrements refCount; closes (flushing first) when it reaches zero. */
  async release(userId: string): Promise<void> {
    const vault = this.get(userId);
    if (!vault) return;
    vault.refCount = Math.max(0, vault.refCount - 1);
    if (vault.refCount === 0) await this.close(userId);
  }

  /** Closes regardless of refCount (account deletion, shutdown). `flush=false` discards unsaved changes. */
  async close(userId: string, flush = true): Promise<void> {
    const vault = this.vaults.get(userId);
    if (!vault) return;
    this.vaults.delete(userId);
    await vault.close(flush);
  }

  async persistAll(): Promise<void> {
    await Promise.all([...this.vaults.values()].map((v) => v.persistIfDirty()));
  }

  async closeAll(): Promise<void> {
    const ids = [...this.vaults.keys()];
    await Promise.all(ids.map((id) => this.close(id)));
  }

  get size(): number {
    return this.vaults.size;
  }
}
