/**
 * Session store (ARCHITECTURE.md section 5).
 *
 * - Every session lives in memory, keyed by sha256(token). The token itself is never stored.
 * - "Remember me" sessions are additionally persisted to `<dataDir>/sessions.json` together
 *   with the diary key wrapped by the device key, so the diary can be reopened after a
 *   restart without the password (only on this machine).
 * - Regular sessions expire after SESSION_TTL_HOURS and die with the process.
 * - The session of the guest account (tour mode) is always a regular one: it is never remembered
 *   and never written, whatever the caller asks for.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { REMEMBER_ME_TTL_DAYS, SESSION_TTL_HOURS } from '@shared/constants';
import { ApiError } from '../errors';
import { writeJsonAtomic } from './accounts';
import { unwrapKey, wrapKey } from './device-key';
import { sha256Hex, wipe } from './kdf';
import type { Session } from './session-types';

const FILE_VERSION = 1;
/** How long touched lastSeenAt values may stay unsaved before a disk write (keeps I/O low). */
const TOUCH_PERSIST_DELAY_MS = 5_000;

export interface PersistedSession {
  id: string;
  tokenHash: string;
  userId: string;
  deviceName: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  rememberMe: true;
  wrappedKeyBase64: string;
  /** Present (true) while the session is locked (lock screen). */
  locked?: true;
}

interface SessionsFile {
  version: number;
  sessions: PersistedSession[];
}

/** In-memory record: the public Session plus the wrapped diary key (remember-me only). */
interface StoredSession extends Session {
  wrappedKey: Buffer | null;
}

export interface SessionStoreOptions {
  /** Called whenever a session disappears (logout, revoke, expiry) so the owner can release its vault. */
  onRemoved?: (session: Session) => void;
  /** Injectable clock for tests. */
  now?: () => Date;
}

function isPersistedSession(v: unknown): v is PersistedSession {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.tokenHash === 'string' &&
    typeof s.userId === 'string' &&
    typeof s.deviceName === 'string' &&
    typeof s.createdAt === 'string' &&
    typeof s.lastSeenAt === 'string' &&
    typeof s.expiresAt === 'string' &&
    s.rememberMe === true &&
    typeof s.wrappedKeyBase64 === 'string'
  );
}

export function newSessionId(): string {
  return `s_${randomBytes(8).toString('hex')}`;
}

/** 32 random bytes, base64url (matches the bearer-token character class of the auth middleware). */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return sha256Hex(token);
}

export class SessionStore {
  private byHash = new Map<string, StoredSession>();
  private touchTimer: NodeJS.Timeout | null = null;
  private dirty = false;
  private readonly now: () => Date;
  private readonly onRemoved?: (session: Session) => void;

  constructor(
    readonly file: string,
    private readonly deviceKey: Buffer,
    opts: SessionStoreOptions = {},
  ) {
    this.now = opts.now ?? (() => new Date());
    this.onRemoved = opts.onRemoved;
    this.load();
  }

  // Persistence ---------------------------------------------------------------

  private load(): void {
    let raw: string;
    try {
      raw = fs.readFileSync(this.file, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw ApiError.io('server.auth.sessionsFileUnreadable');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // A corrupt sessions file only costs the user a re-login; start fresh rather than fail to boot.
      console.error('[diary-server] sessions.json is corrupt; ignoring it');
      this.dirty = true;
      return;
    }
    const list = (parsed as Partial<SessionsFile>)?.sessions;
    if (!Array.isArray(list)) return;
    const nowMs = this.now().getTime();
    for (const p of list) {
      if (!isPersistedSession(p)) continue;
      if (Date.parse(p.expiresAt) <= nowMs) {
        this.dirty = true;
        continue;
      }
      let wrapped: Buffer;
      try {
        wrapped = Buffer.from(p.wrappedKeyBase64, 'base64');
      } catch {
        this.dirty = true;
        continue;
      }
      this.byHash.set(p.tokenHash, {
        id: p.id,
        tokenHash: p.tokenHash,
        userId: p.userId,
        deviceName: p.deviceName,
        createdAt: p.createdAt,
        lastSeenAt: p.lastSeenAt,
        expiresAt: p.expiresAt,
        rememberMe: true,
        notified: new Set(),
        wrappedKey: wrapped,
        ...(p.locked === true ? { locked: true } : {}),
      });
    }
  }

  /** Writes the remember-me sessions to disk (atomic). Regular sessions are never written. */
  persist(): void {
    this.write();
  }

  /** `persist`, leaving out every session of `exceptUserId` (account deletion writes before it forgets). */
  private write(exceptUserId?: string): void {
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }
    const sessions: PersistedSession[] = [];
    for (const s of this.byHash.values()) {
      if (!s.rememberMe || !s.wrappedKey || s.guest || s.userId === exceptUserId) continue;
      sessions.push({
        id: s.id,
        tokenHash: s.tokenHash,
        userId: s.userId,
        deviceName: s.deviceName,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        expiresAt: s.expiresAt,
        rememberMe: true,
        wrappedKeyBase64: s.wrappedKey.toString('base64'),
        ...(s.locked ? { locked: true as const } : {}),
      });
    }
    const data: SessionsFile = { version: FILE_VERSION, sessions };
    try {
      writeJsonAtomic(this.file, data);
      this.dirty = false;
    } catch {
      throw ApiError.io('server.auth.sessionsFileUnwritable');
    }
  }

  /** Schedules a persist for changes that are not worth an immediate disk write (lastSeenAt). */
  private schedulePersist(): void {
    this.dirty = true;
    if (this.touchTimer) return;
    this.touchTimer = setTimeout(() => {
      this.touchTimer = null;
      try {
        this.persist();
      } catch (e) {
        console.error('[diary-server] failed to persist sessions:', (e as Error).message);
      }
    }, TOUCH_PERSIST_DELAY_MS);
    this.touchTimer.unref?.();
  }

  /** Flushes pending writes and stops timers. */
  close(): void {
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }
    if (this.dirty) this.persist();
  }

  // Sessions ------------------------------------------------------------------

  /**
   * Creates a session. `key` (the 32-byte diary key) is wrapped with the device key and
   * persisted only for remember-me sessions; it is never kept for regular ones. A guest session
   * (`opts.guest`) is marked as such and is never a remember-me session.
   */
  create(userId: string, rememberMe: boolean, deviceName: string, key: Buffer, opts: { guest?: boolean } = {}): { token: string; session: Session } {
    if (opts.guest) rememberMe = false;
    const token = newToken();
    const now = this.now();
    const ttlMs = rememberMe ? REMEMBER_ME_TTL_DAYS * 86_400_000 : SESSION_TTL_HOURS * 3_600_000;
    const session: StoredSession = {
      id: newSessionId(),
      tokenHash: hashToken(token),
      userId,
      deviceName,
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      rememberMe,
      notified: new Set(),
      wrappedKey: rememberMe ? wrapKey(key, this.deviceKey) : null,
      ...(opts.guest ? { guest: true } : {}),
    };
    this.byHash.set(session.tokenHash, session);
    if (rememberMe) this.persist();
    return { token, session };
  }

  /** Looks a bearer token up. Expired sessions are removed and reported as unknown. */
  resolve(token: string): Session | null {
    const s = this.byHash.get(hashToken(token));
    if (!s) return null;
    if (this.isExpired(s)) {
      this.drop(s);
      return null;
    }
    return s;
  }

  findById(sessionId: string): Session | null {
    for (const s of this.byHash.values()) if (s.id === sessionId) return s;
    return null;
  }

  /** Updates lastSeenAt (persisted lazily for remember-me sessions). */
  touch(session: Session): void {
    const s = this.byHash.get(session.tokenHash);
    if (!s) return;
    s.lastSeenAt = this.now().toISOString();
    if (s.rememberMe) this.schedulePersist();
  }

  remove(sessionId: string): boolean {
    const s = this.findById(sessionId) as StoredSession | null;
    if (!s) return false;
    this.drop(s);
    return true;
  }

  removeAllForUser(userId: string): number {
    const doomed = [...this.byHash.values()].filter((s) => s.userId === userId);
    for (const s of doomed) this.drop(s, false);
    if (doomed.some((s) => s.rememberMe)) this.persist();
    return doomed.length;
  }

  /**
   * Account deletion: drops every session of `userId` (every device) and rewrites sessions.json
   * whenever it exists - also when no live remember-me session of the account was in memory, so
   * that entries skipped at load (expired or unreadable, still on disk until the next write) do
   * not keep the deleted account's id and wrapped key on disk. The file is written first: when the
   * write fails it throws and every session stays signed in (memory and disk still agree). Returns
   * how many live sessions were dropped.
   */
  forgetUser(userId: string): number {
    const doomed = [...this.byHash.values()].filter((s) => s.userId === userId);
    if (doomed.some((s) => s.rememberMe) || this.dirty || fs.existsSync(this.file)) this.write(userId);
    for (const s of doomed) this.drop(s, false);
    return doomed.length;
  }

  /** Live (non-expired) sessions per user id, in one pass (the account list of the operator tool). */
  countByUser(): Map<string, number> {
    this.sweepExpired();
    const counts = new Map<string, number>();
    for (const s of this.byHash.values()) counts.set(s.userId, (counts.get(s.userId) ?? 0) + 1);
    return counts;
  }

  /** Live (non-expired) sessions of a user, oldest first. */
  list(userId: string): Session[] {
    this.sweepExpired();
    return [...this.byHash.values()]
      .filter((s) => s.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  }

  /** The diary key of a remember-me session (unwrapped with the device key), or null. */
  wrappedKeyOf(session: Session): Buffer | null {
    const s = this.byHash.get(session.tokenHash);
    if (!s || !s.wrappedKey) return null;
    try {
      return unwrapKey(s.wrappedKey, this.deviceKey);
    } catch {
      // Device key changed (e.g. restored profile): the stored key is useless, drop the session.
      this.drop(s);
      return null;
    }
  }

  /** After a password change: wrap the new key into every remember-me session of the user. */
  rewrapAllForUser(userId: string, newKey: Buffer): void {
    let changed = false;
    for (const s of this.byHash.values()) {
      if (s.userId !== userId || !s.rememberMe) continue;
      wipe(s.wrappedKey);
      s.wrappedKey = wrapKey(newKey, this.deviceKey);
      changed = true;
    }
    if (changed) this.persist();
  }

  /** Locks / unlocks a session (lock screen). Remember-me sessions are written at once. False for an unknown id. */
  setLocked(sessionId: string, locked: boolean): boolean {
    const s = [...this.byHash.values()].find((x) => x.id === sessionId);
    if (!s) return false;
    if (!!s.locked === locked) return true;
    if (locked) s.locked = true;
    else delete s.locked;
    if (s.rememberMe) this.persist();
    return true;
  }

  /** Removes every expired session (called periodically and before listing). Returns how many. */
  sweepExpired(): number {
    const doomed = [...this.byHash.values()].filter((s) => this.isExpired(s));
    for (const s of doomed) this.drop(s, false);
    if (doomed.some((s) => s.rememberMe)) this.persist();
    return doomed.length;
  }

  /** Number of live sessions (tests / diagnostics). */
  get size(): number {
    return this.byHash.size;
  }

  private isExpired(s: StoredSession): boolean {
    return Date.parse(s.expiresAt) <= this.now().getTime();
  }

  private drop(s: StoredSession, persistNow = true): void {
    this.byHash.delete(s.tokenHash);
    wipe(s.wrappedKey);
    s.wrappedKey = null;
    if (s.rememberMe && persistNow) this.persist();
    this.onRemoved?.(s);
  }
}
