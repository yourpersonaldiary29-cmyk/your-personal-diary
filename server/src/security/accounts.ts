/**
 * Account registry persisted in `<dataDir>/accounts.json`.
 *
 * The file holds public profile data, the scrypt parameters, the password verifier and
 * the recovery copy of the diary key wrapped with the device key (`recoveryWrappedKey`,
 * password reset by e-mail) - never a password, never a plain key. Writes are atomic
 * (tmp + rename) so a crash mid-write cannot corrupt the registry.
 *
 * Usernames and e-mail addresses are both unique case-insensitively (`usernameLower`,
 * `emailLower`). A username can never contain "@" (shared USERNAME_PATTERN), so a login
 * identifier is looked up as a username first and as an e-mail otherwise without ambiguity.
 * Records written before the e-mail field existed simply have no `email` / `emailLower`.
 *
 * `language` (optional) is the account's UI language - a copy of its diary's language setting that
 * the e-mail paths read instead of opening the diary (AccountRecord.language). Records without it,
 * or with a value that is not one of the app's locales, load as before (the value is left out).
 *
 * `privacyAcceptedAt` + `privacyVersion` (optional, both or neither) record the privacy checkbox of a
 * registration on the hosted server (AccountRecord.privacyAcceptedAt). Older files have neither and load
 * unchanged; a record with only one of the two, or with a value that is not a non-empty string, loads
 * without both.
 *
 * `pendingDeletes` (only present while non-empty) lists diary files (`<id>.mpd`, relative to
 * users/) of deleted accounts that still have to be removed from disk: an account deletion writes
 * its file name there in the same write that removes the record, and takes it out again once
 * `<id>.mpd` / `.prev` / `.tmp` are gone - so a diary whose files could not be deleted at that
 * moment is deleted at the next start or deletion instead of staying behind forever.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isLocale, type Locale } from '@shared/i18n';
import { ApiError } from '../errors';
import type { AccountRecord } from './session-types';

const FILE_VERSION = 1;

/** Catalogue key of the 409 answered when the e-mail address is already registered on this computer. */
export const EMAIL_TAKEN_KEY = 'server.auth.emailTaken';

/**
 * 409 for a duplicate e-mail. The ErrorCode set is fixed (USERNAME_TAKEN is about the username),
 * so the code stays VALIDATION and the field tells the client where to show the message.
 */
export function emailTaken(): ApiError {
  return ApiError.localized(409, 'VALIDATION', EMAIL_TAKEN_KEY, undefined, 'email');
}

interface AccountsFile {
  version: number;
  accounts: AccountRecord[];
  /** Diary files of deleted accounts still to be removed (see the module comment). */
  pendingDeletes?: string[];
}

/**
 * A diary file name as the registry stores it: one plain file name in users/ ending in ".mpd" -
 * never a path, so a hand-edited `pendingDeletes` cannot point anywhere else.
 */
export function isDiaryFileName(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}\.mpd$/.test(v);
}

/** Generates an opaque account id ("u_" + 16 hex chars). */
export function newAccountId(): string {
  return `u_${randomBytes(8).toString('hex')}`;
}

/** Case-insensitive key of an e-mail address (trimmed, lower-cased). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isAccountRecord(v: unknown): v is AccountRecord {
  if (!v || typeof v !== 'object') return false;
  const a = v as Record<string, unknown>;
  const kdf = a.kdf as Record<string, unknown> | undefined;
  return (
    typeof a.id === 'string' &&
    typeof a.username === 'string' &&
    typeof a.usernameLower === 'string' &&
    typeof a.firstName === 'string' &&
    typeof a.lastName === 'string' &&
    (a.email === undefined || a.email === null || typeof a.email === 'string') &&
    (a.emailLower === undefined || a.emailLower === null || typeof a.emailLower === 'string') &&
    typeof a.createdAt === 'string' &&
    (a.lastLoginAt === undefined || a.lastLoginAt === null || typeof a.lastLoginAt === 'string') &&
    (a.recoveryWrappedKey === undefined || a.recoveryWrappedKey === null || typeof a.recoveryWrappedKey === 'string') &&
    typeof a.verifierHex === 'string' &&
    typeof a.dbFile === 'string' &&
    !!kdf &&
    kdf.algorithm === 'scrypt' &&
    typeof kdf.N === 'number' &&
    typeof kdf.r === 'number' &&
    typeof kdf.p === 'number' &&
    typeof kdf.saltHex === 'string'
  );
}

/** Atomic JSON write shared by the registries (tmp file + rename; retried once for Windows file locks). */
export function writeJsonAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  const text = JSON.stringify(value, null, 2);
  const fd = fs.openSync(tmp, 'w', 0o600);
  try {
    fs.writeSync(fd, text, null, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  // Antivirus / indexers on Windows occasionally hold the target for a moment: retry briefly.
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (attempt >= 4 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw e;
      sleepSync(40 * (attempt + 1));
    }
  }
}

/** Blocking sleep without burning CPU (used only in the rare rename-retry path). */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * Copy of a record with the e-mail fields in canonical shape: a non-empty `email` always comes
 * with its `emailLower`; anything else (older files, null, blank) leaves both fields out.
 *
 * A registry record is always a REAL account: the guest of the tour mode (security/guest.ts) lives
 * in the memory of the auth service only and is never added here. So the `guest` flag is dropped -
 * on reading the file and on every add / update - and a hand-edited or damaged accounts.json can
 * never turn an account into a guest (which would take the ownership of the computer away from the
 * first account and refuse it its own password check, lock, backup and account deletion).
 */
function canonical(a: AccountRecord): AccountRecord {
  const copy: AccountRecord = { ...a, kdf: { ...a.kdf } };
  delete copy.guest;
  // Older files have no lastLoginAt (and a hand-edited null means the same): leave it out.
  if (typeof a.lastLoginAt !== 'string') delete copy.lastLoginAt;
  // No recovery key yet (older files, null, blank): leave it out; the next sign-in creates it.
  if (typeof a.recoveryWrappedKey !== 'string' || !a.recoveryWrappedKey) delete copy.recoveryWrappedKey;
  // No language yet (older files) or not one of the app's locales: leave it out; the next sign-in writes it.
  if (!isLocale(a.language)) delete copy.language;
  // The privacy-checkbox record: both or neither (older files and local-mode accounts have neither).
  if (!isNonEmptyString(a.privacyAcceptedAt) || !isNonEmptyString(a.privacyVersion)) {
    delete copy.privacyAcceptedAt;
    delete copy.privacyVersion;
  }
  // The previous address after an e-mail change (see AccountRecord.previousEmail): both or neither.
  if (typeof a.previousEmail !== 'string' || !a.previousEmail.trim() || typeof a.emailChangedAt !== 'string') {
    delete copy.previousEmail;
    delete copy.emailChangedAt;
  }
  const email = typeof a.email === 'string' ? a.email.trim() : '';
  if (email) {
    copy.email = email;
    copy.emailLower = normalizeEmail(email);
  } else {
    delete copy.email;
    delete copy.emailLower;
  }
  return copy;
}

export class AccountsStore {
  private accounts: AccountRecord[] = [];
  private pending: string[] = [];

  constructor(readonly file: string) {
    this.reload();
  }

  /** Re-reads the file. A missing file means "no accounts yet"; a corrupt file is an IO error. */
  reload(): void {
    let raw: string;
    try {
      raw = fs.readFileSync(this.file, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        this.accounts = [];
        this.pending = [];
        return;
      }
      throw ApiError.io('server.auth.accountsFileUnreadable');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw ApiError.io('server.auth.accountsFileCorrupt');
    }
    const list = (parsed as Partial<AccountsFile>)?.accounts;
    if (!Array.isArray(list)) throw ApiError.io('server.auth.accountsFileCorrupt');
    this.accounts = list.filter(isAccountRecord).map(canonical);
    const pending = (parsed as Partial<AccountsFile>).pendingDeletes;
    this.pending = Array.isArray(pending) ? [...new Set(pending.filter(isDiaryFileName))] : [];
  }

  /**
   * Writes `accounts` (default: the current list) and `pending` to the file. Callers that remove
   * or add records write the new list first and change memory only after the write succeeded, so a
   * failed write leaves memory and disk in agreement.
   */
  private persist(accounts: AccountRecord[] = this.accounts, pending: string[] = this.pending): void {
    const data: AccountsFile = { version: FILE_VERSION, accounts, ...(pending.length ? { pendingDeletes: pending } : {}) };
    try {
      writeJsonAtomic(this.file, data);
    } catch {
      throw ApiError.io('server.auth.accountsFileUnwritable');
    }
  }

  /** Copies, so callers cannot mutate the registry by accident. */
  list(): AccountRecord[] {
    return this.accounts.map((a) => ({ ...a, kdf: { ...a.kdf } }));
  }

  findByUsername(username: string): AccountRecord | null {
    const lower = username.trim().toLowerCase();
    const found = this.accounts.find((a) => a.usernameLower === lower);
    return found ? { ...found, kdf: { ...found.kdf } } : null;
  }

  /** Case-insensitive e-mail lookup. Records without an e-mail never match (a blank query matches nothing). */
  findByEmail(email: string): AccountRecord | null {
    const lower = normalizeEmail(email);
    if (!lower) return null;
    const found = this.accounts.find((a) => a.emailLower === lower);
    return found ? { ...found, kdf: { ...found.kdf } } : null;
  }

  /**
   * Login lookup: `identifier` is a username or an e-mail address (both case-insensitive).
   * Usernames cannot contain "@", so the two namespaces never overlap.
   */
  findByLogin(identifier: string): AccountRecord | null {
    return this.findByUsername(identifier) ?? this.findByEmail(identifier);
  }

  findById(id: string): AccountRecord | null {
    const found = this.accounts.find((a) => a.id === id);
    return found ? { ...found, kdf: { ...found.kdf } } : null;
  }

  /** Adds a new account. Throws USERNAME_TAKEN when the (case-insensitive) name exists, 409 VALIDATION/email for a duplicate e-mail. */
  add(record: AccountRecord): void {
    const clean = canonical(record);
    if (this.accounts.some((a) => a.usernameLower === clean.usernameLower)) throw ApiError.usernameTaken();
    if (clean.emailLower && this.accounts.some((a) => a.emailLower === clean.emailLower)) throw emailTaken();
    if (this.accounts.some((a) => a.id === clean.id)) throw ApiError.other('server.auth.accountIdExists');
    // Disk first: when the write fails the name and the address stay free in memory too.
    const next = [...this.accounts, clean];
    this.persist(next);
    this.accounts = next;
  }

  /** Replaces the record with the same id (same uniqueness rules as `add`, ignoring the record itself). */
  update(record: AccountRecord): void {
    const idx = this.accounts.findIndex((a) => a.id === record.id);
    if (idx < 0) throw ApiError.notFound('server.auth.accountNotFound');
    const clean = canonical(record);
    const clash = this.accounts.find((a) => a.id !== clean.id && a.usernameLower === clean.usernameLower);
    if (clash) throw ApiError.usernameTaken();
    if (clean.emailLower && this.accounts.some((a) => a.id !== clean.id && a.emailLower === clean.emailLower)) throw emailTaken();
    this.accounts[idx] = clean;
    this.persist();
  }

  /**
   * Records a sign-in time on the account (persisted, so the login screen remembers who signed
   * in last across restarts). Returns a copy of the updated record, or null for an unknown id.
   */
  touchLogin(id: string, at: string, recoveryWrappedKey?: string, language?: Locale): AccountRecord | null {
    const found = this.accounts.find((a) => a.id === id);
    if (!found) return null;
    found.lastLoginAt = at;
    if (recoveryWrappedKey) found.recoveryWrappedKey = recoveryWrappedKey;
    if (isLocale(language)) found.language = language;
    this.persist();
    return { ...found, kdf: { ...found.kdf } };
  }

  /**
   * Stores the account's UI language (AccountRecord.language). Writes the file only when the value
   * changes; returns a copy of the record, or null for an unknown id (a guest, a deleted account) -
   * nothing is written then.
   */
  setLanguage(id: string, language: Locale): AccountRecord | null {
    const found = this.accounts.find((a) => a.id === id);
    if (!found || !isLocale(language)) return null;
    if (found.language !== language) {
      // Disk first: when the write fails the record keeps its previous value in memory too.
      const next = this.accounts.map((a) => (a === found ? { ...a, kdf: { ...a.kdf }, language } : a));
      this.persist(next);
      this.accounts = next;
    }
    const saved = this.accounts.find((a) => a.id === id) as AccountRecord;
    return { ...saved, kdf: { ...saved.kdf } };
  }

  /**
   * Stores a (re-)wrapped recovery key on the account (password reset by e-mail). Returns a copy of
   * the updated record, or null for an unknown id.
   */
  setRecoveryKey(id: string, recoveryWrappedKey: string): AccountRecord | null {
    const found = this.accounts.find((a) => a.id === id);
    if (!found) return null;
    found.recoveryWrappedKey = recoveryWrappedKey;
    this.persist();
    return { ...found, kdf: { ...found.kdf } };
  }

  /**
   * Account deletion: removes the record of `id` and, in the same write, puts its diary file name
   * on `pendingDeletes` (taken off by `clearPendingDeletes` once the files are gone). The file is
   * written before memory changes: when the write fails nothing changed anywhere and the account
   * stays exactly as it was. Returns false for an unknown id.
   */
  remove(id: string): boolean {
    const found = this.accounts.find((a) => a.id === id);
    if (!found) return false;
    const next = this.accounts.filter((a) => a.id !== id);
    const pending = isDiaryFileName(found.dbFile) && !this.pending.includes(found.dbFile) ? [...this.pending, found.dbFile] : this.pending;
    this.persist(next, pending);
    this.accounts = next;
    this.pending = pending;
    return true;
  }

  /** Diary files of deleted accounts still waiting to be removed from users/ (copies). */
  pendingDeletes(): string[] {
    return [...this.pending];
  }

  /** Takes `files` off `pendingDeletes` once they are gone from disk (write first, then memory). */
  clearPendingDeletes(files: readonly string[]): void {
    const next = this.pending.filter((f) => !files.includes(f));
    if (next.length === this.pending.length) return;
    this.persist(this.accounts, next);
    this.pending = next;
  }
}
