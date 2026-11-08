/**
 * Password-reset tokens, persisted in `<dataDir>/resets.json` (atomic writes, owner-only file).
 *
 * `POST /api/auth/forgot-password` creates one reset per request for a registered address:
 *   - a token of 32 random bytes (base64url, 43 characters) for the e-mail link - only its
 *     sha256 is stored;
 *   - a 6-digit code bound to the same reset (for typing into the app) - only a salted sha256 is
 *     stored.
 * A reset lives 30 minutes, is single-use (taken out of the store before the password changes),
 * and at most 3 live resets exist per account (a new one pushes the oldest out). Every wrong code
 * counts against all live resets of the account; the 5th wrong code kills them. Tokens and codes
 * are compared in constant time. A successful reset (or a password change, or deleting the
 * account) removes every reset of that account.
 */
import { createHash, randomBytes, randomInt } from 'node:crypto';
import fs from 'node:fs';
import { writeJsonAtomic } from './accounts';
import { safeEqualHex, sha256Hex } from './kdf';

export const RESET_TTL_MS = 30 * 60_000;
export const RESET_MAX_LIVE_PER_ACCOUNT = 3;
export const RESET_MAX_CODE_FAILURES = 5;
export const RESET_CODE_DIGITS = 6;
/** Shape of a reset token in a link: 32 bytes, base64url without padding. */
export const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const RESET_CODE_PATTERN = /^\d{6}$/;

const FILE_VERSION = 1;

export interface ResetRecord {
  id: string;
  userId: string;
  /** hex sha256 of the link token. */
  tokenHash: string;
  /** Random salt (hex) of the code hash. */
  codeSalt: string;
  /** hex sha256(codeSalt + ':' + code). */
  codeHash: string;
  createdAt: string;
  expiresAt: string;
  /** Wrong codes entered while this reset was live. */
  codeFailures: number;
}

interface ResetsFile {
  version: number;
  resets: ResetRecord[];
}

export interface CreatedReset {
  token: string;
  code: string;
  expiresAt: string;
}

export interface ResetStoreOptions {
  now?: () => Date;
  ttlMs?: number;
}

function isResetRecord(v: unknown): v is ResetRecord {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.userId === 'string' &&
    typeof r.tokenHash === 'string' &&
    typeof r.codeSalt === 'string' &&
    typeof r.codeHash === 'string' &&
    typeof r.createdAt === 'string' &&
    typeof r.expiresAt === 'string' &&
    typeof r.codeFailures === 'number'
  );
}

function codeHashOf(salt: string, code: string): string {
  return createHash('sha256').update(`${salt}:${code}`, 'utf8').digest('hex');
}

/** A uniformly random 6-digit code ('000000'..'999999'). */
export function newResetCode(): string {
  return String(randomInt(0, 10 ** RESET_CODE_DIGITS)).padStart(RESET_CODE_DIGITS, '0');
}

export class ResetStore {
  private records: ResetRecord[] = [];
  private readonly now: () => Date;
  readonly ttlMs: number;

  constructor(
    readonly file: string,
    opts: ResetStoreOptions = {},
  ) {
    this.now = opts.now ?? (() => new Date());
    this.ttlMs = opts.ttlMs ?? RESET_TTL_MS;
    this.load();
  }

  private load(): void {
    let raw: string;
    try {
      raw = fs.readFileSync(this.file, 'utf8');
    } catch {
      return;
    }
    try {
      const list = (JSON.parse(raw) as Partial<ResetsFile>)?.resets;
      this.records = Array.isArray(list) ? list.filter(isResetRecord) : [];
    } catch {
      // A damaged file only costs pending resets; the users can ask for a new e-mail.
      console.error('[diary-server] resets.json is corrupt; ignoring it');
      this.records = [];
    }
    if (this.prune()) this.persistQuietly();
  }

  private persist(records: ResetRecord[] = this.records): void {
    const data: ResetsFile = { version: FILE_VERSION, resets: records };
    writeJsonAtomic(this.file, data);
  }

  private persistQuietly(): void {
    try {
      this.persist();
    } catch (e) {
      console.error('[diary-server] failed to write resets.json:', (e as Error).message);
    }
  }

  private persistPending = false;

  /**
   * Persists on the next turn of the event loop - after the current answer was written. Used for
   * the wrong-code counters, so the answer time does not reveal (through a disk write) whether the
   * address had a pending reset. The in-memory state is authoritative meanwhile.
   */
  private persistSoon(): void {
    if (this.persistPending) return;
    this.persistPending = true;
    setImmediate(() => {
      this.persistPending = false;
      this.persistQuietly();
    });
  }

  /** The resets of `records` that are still live (not expired, not killed by wrong codes). */
  private live(records: ResetRecord[]): ResetRecord[] {
    const t = this.now().getTime();
    return records.filter((r) => Date.parse(r.expiresAt) > t && r.codeFailures < RESET_MAX_CODE_FAILURES);
  }

  /** Drops expired resets. Returns true when something was removed. */
  private prune(): boolean {
    const before = this.records.length;
    this.records = this.live(this.records);
    return this.records.length !== before;
  }

  /** Creates a reset for `userId` (the oldest live one goes when there are already 3). */
  create(userId: string): CreatedReset {
    this.prune();
    const token = randomBytes(32).toString('base64url');
    const code = newResetCode();
    const codeSalt = randomBytes(16).toString('hex');
    const now = this.now();
    const record: ResetRecord = {
      id: `r_${randomBytes(8).toString('hex')}`,
      userId,
      tokenHash: sha256Hex(token),
      codeSalt,
      codeHash: codeHashOf(codeSalt, code),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
      codeFailures: 0,
    };
    this.records.push(record);
    const own = this.records.filter((r) => r.userId === userId);
    for (const old of own.slice(0, Math.max(0, own.length - RESET_MAX_LIVE_PER_ACCOUNT))) {
      this.records = this.records.filter((r) => r !== old);
    }
    this.persist();
    return { token, code, expiresAt: record.expiresAt };
  }

  /**
   * Takes (removes) the live reset whose link token is `token`; null when there is none. Every live
   * record is compared, in constant time, so the answer time does not depend on which one matched.
   */
  takeByToken(token: string): ResetRecord | null {
    const changed = this.prune();
    if (typeof token !== 'string' || !RESET_TOKEN_PATTERN.test(token)) {
      if (changed) this.persistQuietly();
      return null;
    }
    const hash = sha256Hex(token);
    let found: ResetRecord | null = null;
    for (const r of this.records) if (safeEqualHex(hash, r.tokenHash) && !found) found = r;
    if (!found) {
      if (changed) this.persistQuietly();
      return null;
    }
    const taken = found;
    this.records = this.records.filter((r) => r !== taken);
    this.persist();
    return { ...taken };
  }

  /**
   * Takes the NEWEST live reset of `userId` when `code` is its code. Only the newest reset's code
   * is accepted - one guess tests one code, never up to RESET_MAX_LIVE_PER_ACCOUNT of them - while
   * the links of older live resets keep working for their own reset (`takeByToken`). A wrong code
   * counts against that newest reset; a reset with 5 wrong codes is gone. null when nothing matched.
   */
  takeByCode(userId: string, code: string): ResetRecord | null {
    if (this.prune()) this.persistSoon();
    const own = this.records.filter((r) => r.userId === userId);
    if (!own.length) return null;
    const newest = own.reduce((a, b) => (Date.parse(b.createdAt) >= Date.parse(a.createdAt) ? b : a));
    const valid = typeof code === 'string' && RESET_CODE_PATTERN.test(code);
    // Always one hash comparison, valid code or not (same work either way).
    const ok = safeEqualHex(codeHashOf(newest.codeSalt, valid ? code : '------'), newest.codeHash);
    if (ok && valid) {
      this.records = this.records.filter((r) => r !== newest);
      this.persist();
      return { ...newest };
    }
    newest.codeFailures++;
    this.prune();
    this.persistSoon();
    return null;
  }

  /** Puts a taken reset back (the password change after taking it failed, so the link keeps working). */
  restore(record: ResetRecord): void {
    this.prune();
    if (Date.parse(record.expiresAt) <= this.now().getTime()) return;
    if (this.records.some((r) => r.id === record.id)) return;
    this.records.push({ ...record });
    this.persistQuietly();
  }

  /** Removes every reset of `userId` (password reset done, password changed). */
  removeAllForUser(userId: string): void {
    const before = this.records.length;
    this.records = this.records.filter((r) => r.userId !== userId);
    if (this.records.length !== before) this.persistQuietly();
  }

  /**
   * Account deletion: removes every reset of `userId` and rewrites resets.json whenever it exists -
   * also when nothing live was left in memory, because expired resets pruned from memory (or
   * records skipped at load) stay on disk until the next write. The file is written first: when it
   * cannot be written this throws with the resets still in place (memory and disk agree), so the
   * deletion stops before anything of the account is gone.
   */
  forgetUser(userId: string): void {
    const next = this.live(this.records.filter((r) => r.userId !== userId));
    if (next.length !== this.records.length || fs.existsSync(this.file)) this.persist(next);
    this.records = next;
  }

  /** Live resets of `userId` (tests / diagnostics). */
  liveCount(userId: string): number {
    this.prune();
    return this.records.filter((r) => r.userId === userId).length;
  }
}
