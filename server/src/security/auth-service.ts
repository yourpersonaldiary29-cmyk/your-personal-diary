/**
 * Accounts, passwords, sessions and vaults - the implementation of `AuthService`
 * (contract in session-types.ts, design in ARCHITECTURE.md section 5).
 *
 * Responsibilities:
 *   register / login       derive the key with scrypt, check the verifier, open the vault, issue a token
 *                          (login accepts the username or the e-mail address, both case-insensitive;
 *                          10 wrong passwords in a row lock the account for 15 minutes - LoginLockout)
 *   authenticate           token -> session -> (re)open the vault (remember-me: key unwrapped with device.key)
 *   changePassword         new salt + key, re-encrypt the diary, update the verifier, re-wrap remember-me keys
 *                          and the recovery key
 *   resetPassword          password reset by e-mail (security/password-reset.ts): the diary key comes from the
 *                          recovery key (wrapped with device.key), the diary is re-encrypted under a key derived
 *                          from the new password, and every session of the account is signed out
 *   accountLocale          the account language for e-mails, from the registry (AccountRecord.language,
 *                          kept in step with the diary at sign-in, reopening and every save) - never
 *                          by opening a diary
 *   updateProfile         change the display names / e-mail of the account (registry only)
 *   deleteAccount          wipe everything of the account: pending resets, sessions (all devices), lockout
 *                          counters, the registry record, then the diary files (.mpd, .prev, .tmp) - a
 *                          failed registry write leaves the account intact; diary files that cannot be
 *                          removed yet are retried at the next deletion / start (accounts.json pendingDeletes)
 *   startGuest             tour mode (mobile only, security/guest.ts): a temporary account with demo data
 *                          that exists in memory only - its record, its session and its diary never
 *                          reach the disk; it ends at logout / expiry / shutdown and when a real account
 *                          registers or signs in
 *   shutdown               flush every vault and the sessions file
 *
 * Vault lifetime: `refCount` counts the sessions currently attached to an open vault. A session
 * attaches on login/register or on its first authenticated request after a restart, and detaches
 * on logout / revoke / expiry. When the last session detaches the vault is flushed and closed.
 *
 * Every validation error is an `ApiError.localized` (catalogue keys 'server.auth.*'), rendered
 * in the request language by the error middleware.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_LOCALE, isLocale, resolveLocale, t, type Locale } from '@shared/i18n';
import { PRIVACY_POLICY_VERSION } from '@shared/legal';
import type { ServerConfig } from '../config';
import type { DiaryDb } from '../db/database';
import { seedDemoData, SEED_DEFAULT_DAYS, SEED_DEFAULT_SEED } from '../db/seed';
import { getSettings, saveSettings } from '../db/settings-repo';
import { ApiError } from '../errors';
import { nowIso, todayIso } from '../util/dates';
import { AccountsStore, emailTaken, newAccountId, normalizeEmail } from './accounts';
import { hasRecoveryKeyShape, loadOrCreateDeviceKey, unwrapRecoveryKey, wrapRecoveryKey } from './device-key';
import { guestNotAllowed, guestsFull, isGuestContext, newGuestAccountId, newGuestUsername } from './guest';
import { DEFAULT_KDF, deriveSecret, KEY_LENGTH, newSalt, safeEqualBytes, safeEqualHex, splitSecret, verifierHex, wipe, type KdfParams } from './kdf';
import { usernameProblemKey, weakPasswordError } from './password-policy';
import { ResetStore } from './resets';
import { SessionStore } from './sessions';
import { toUserProfile, type AccountRecord, type AuthContext, type AuthService, type ProfilePatch, type Session } from './session-types';
import { createMemoryVault, createVault, deleteVaultFiles, openVault, VaultRegistry, vaultPathOf, type DiaryVault } from './vault';

export const NAME_MAX_LENGTH = 50;
export const DEVICE_NAME_MAX_LENGTH = 60;
/** Label of a session whose client sent no device name, in `locale` ('Device' / 'מכשיר'). */
export function defaultDeviceName(locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, 'server.auth.defaultDeviceName');
}
/** English default device label (kept for callers without a locale). */
export const DEFAULT_DEVICE_NAME = defaultDeviceName(DEFAULT_LOCALE);
/** Longest e-mail address accepted at registration (RFC 5321 path limit). */
export const EMAIL_MAX_LENGTH = 254;
/**
 * Shape check only: something@something.tld without whitespace. The app never sends mail, so
 * there is nothing to verify beyond the shape. The registration form uses the same pattern.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/**
 * For how long after an e-mail change the "your password was changed" notice of a password reset
 * also goes to the previous address (AccountRecord.previousEmail).
 */
export const EMAIL_CHANGE_NOTICE_WINDOW_MS = 30 * 24 * 60 * 60_000;
/**
 * Wrong "current password" confirmations (lock screen, change password, e-mail change, account
 * deletion, remote-access / mail cards) accepted per account before they are refused for
 * LOGIN_LOCKOUT_MS: a stolen session token must not become an unlimited password oracle.
 */
export const CONFIRM_LOCKOUT_PREFIX = 'confirm:';
/**
 * The address the account had before an e-mail change within EMAIL_CHANGE_NOTICE_WINDOW_MS (and
 * that differs from the current one), or null.
 */
export function recentPreviousEmail(account: Pick<AccountRecord, 'email' | 'previousEmail' | 'emailChangedAt'>, now: Date): string | null {
  const prev = account.previousEmail?.trim();
  if (!prev || !account.emailChangedAt) return null;
  const changed = Date.parse(account.emailChangedAt);
  if (!Number.isFinite(changed) || now.getTime() - changed > EMAIL_CHANGE_NOTICE_WINDOW_MS) return null;
  if (normalizeEmail(prev) === normalizeEmail(account.email ?? '')) return null;
  return prev;
}
/** How often expired sessions are swept so idle vaults close and keys leave memory. */
const SWEEP_INTERVAL_MS = 10 * 60_000;

/**
 * Per-account sign-in lockout (hardening for remote access over the internet): after
 * `maxFailures` wrong passwords in a row the account refuses every sign-in - even with the right
 * password - for `lockMs`. Failures are counted per account (username and e-mail sign-ins of the
 * same account share one counter); unknown names get a counter of their own, so the answers do
 * not reveal which names exist. A successful sign-in clears the counter; a failure older than
 * `lockMs` is forgotten.
 */
export const LOGIN_LOCKOUT_MAX_FAILURES = 10;
export const LOGIN_LOCKOUT_MS = 15 * 60_000;
/** Catalogue key of the 429 answered while an account is locked ({minutes} = minutes left). */
export const LOGIN_LOCKED_KEY = 'server.remote.loginLocked';
/** Bound on remembered counters (unknown names could otherwise grow the map without limit). */
const LOCKOUT_MAX_ENTRIES = 10_000;

export interface LockoutOptions {
  maxFailures?: number;
  lockMs?: number;
}

interface LockoutEntry {
  failures: number;
  lastFailureAt: number;
  lockedUntil: number;
}

export class LoginLockout {
  private readonly entries = new Map<string, LockoutEntry>();
  readonly maxFailures: number;
  readonly lockMs: number;

  constructor(
    private readonly now: () => Date,
    opts: LockoutOptions = {},
  ) {
    this.maxFailures = opts.maxFailures ?? LOGIN_LOCKOUT_MAX_FAILURES;
    this.lockMs = opts.lockMs ?? LOGIN_LOCKOUT_MS;
  }

  /** Milliseconds the key is still locked (0 = not locked). */
  remaining(key: string): number {
    const e = this.entries.get(key);
    if (!e) return 0;
    const t = this.now().getTime();
    if (e.lockedUntil > t) return e.lockedUntil - t;
    if (e.lockedUntil > 0 || t - e.lastFailureAt > this.lockMs) this.entries.delete(key);
    return 0;
  }

  /** Records a failure; returns the lock duration when this failure locks the key (else 0). */
  fail(key: string): number {
    const t = this.now().getTime();
    let e = this.entries.get(key);
    if (!e || e.lockedUntil > 0 || t - e.lastFailureAt > this.lockMs) e = { failures: 0, lastFailureAt: t, lockedUntil: 0 };
    e.failures++;
    e.lastFailureAt = t;
    if (e.failures >= this.maxFailures) e.lockedUntil = t + this.lockMs;
    this.entries.delete(key);
    this.entries.set(key, e);
    if (this.entries.size > LOCKOUT_MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    return e.lockedUntil > 0 ? e.lockedUntil - t : 0;
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  /** Forgets every key starting with `prefix` (the bucketed keys of a hosted server). */
  resetPrefix(prefix: string): void {
    for (const key of [...this.entries.keys()]) if (key.startsWith(prefix)) this.entries.delete(key);
  }

  /** The longest time any key starting with `prefix` is still locked (0 = none) - the operator tool's "locked". */
  remainingPrefix(prefix: string): number {
    let longest = 0;
    for (const key of [...this.entries.keys()]) if (key.startsWith(prefix)) longest = Math.max(longest, this.remaining(key));
    return longest;
  }

  /** Failures counted for `key` within the window (0 when none or forgotten). */
  failures(key: string): number {
    const e = this.entries.get(key);
    if (!e) return 0;
    if (this.now().getTime() - e.lastFailureAt > this.lockMs) {
      this.entries.delete(key);
      return 0;
    }
    return e.failures;
  }

  /** True while a counter exists for `key` (tests / diagnostics). */
  has(key: string): boolean {
    return this.entries.has(key);
  }
}

/**
 * Hosted mode (docs/HOSTED-PLAN.md 2.2 / 5.2, review finding 12): the hard lock above is keyed per
 * address bucket there, and a second, purely per-account counter adds a progressive DELAY instead
 * of a lock - after LOGIN_DELAY_AFTER_FAILURES failures within the window every further attempt on
 * that account waits min(2^(n - 10), 30) seconds before scrypt runs. A stranger can slow the owner
 * down, never shut him out.
 */
export const LOGIN_DELAY_AFTER_FAILURES = 10;
export const LOGIN_DELAY_MAX_MS = 30_000;

/** Milliseconds to wait before the next attempt after `failures` failures (0 below the threshold). */
export function loginDelayMs(failures: number): number {
  if (failures < LOGIN_DELAY_AFTER_FAILURES) return 0;
  return Math.min(2 ** (failures - LOGIN_DELAY_AFTER_FAILURES) * 1000, LOGIN_DELAY_MAX_MS);
}

/** 429 "too many failed sign-ins, try again in {minutes} minutes" in the request language. */
export function accountLockedError(remainingMs: number): ApiError {
  return ApiError.localized(429, 'FORBIDDEN', LOGIN_LOCKED_KEY, { minutes: Math.max(1, Math.ceil(remainingMs / 60_000)) });
}

export interface AuthServiceOptions {
  /** scrypt parameters for new accounts / password changes (tests may lower them). */
  kdf?: KdfParams;
  /** Injectable clock. */
  now?: () => Date;
  /** Sign-in lockout thresholds (default 10 failures -> 15 minutes). */
  lockout?: LockoutOptions;
  /** Lifetime of password-reset links / codes (default 30 minutes; tests shorten it). */
  resetTtlMs?: number;
  /** Waits for the progressive sign-in delay of hosted mode (tests inject a fake). */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Hosted mode (docs/HOSTED-PLAN.md 3.7): close a diary nobody touched for this long when every
   * session attached to it can reopen it by itself (remember-me sessions carry the wrapped key).
   * 0 = never (local mode: a diary stays open until its last session ends).
   */
  vaultIdleMs?: number;
  /** The device key to use instead of `<dataDir>/device.key` (hosted mode: `DIARY_DEVICE_KEY`). */
  deviceKey?: Buffer;
  /**
   * Hosted mode (docs/android-tasks/HOSTED-IMPL.md item 9): several visitors may take the tour at
   * once - up to `max` guests (503 'server.auth.guestsFull' beyond), each ended by itself after
   * `lifetimeMs` - and a real registration or sign-in ends nobody's tour. Absent = the local rule
   * of a phone: one guest at a time, ended by the next guest and by any real sign-in.
   */
  guests?: { max: number; lifetimeMs: number };
}

/** Catalogue key of the 400 answered for a wrong, expired or used reset link / code. */
export const RESET_INVALID_KEY = 'server.reset.invalid';

/** 400 VALIDATION 'server.reset.invalid' - the same answer for every reason (unknown, expired, used, wrong code). */
export function resetInvalid(): ApiError {
  return ApiError.localized(400, 'VALIDATION', RESET_INVALID_KEY);
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  username: string;
  /** Trimmed, shape-checked e-mail address (required; unique among local accounts, case-insensitively). */
  email: string;
  password: string;
  rememberMe: boolean;
  deviceName: string;
  /**
   * UI language the account starts with (the language of the sign-up screen): the body's
   * `language` or the request's Accept-Language (routes/auth.ts). Absent -> the default ('en').
   */
  language?: Locale;
  /**
   * The new user ticked "I have read the Privacy policy and agree to it". Set by the hosted server's
   * route only, which refuses a registration without it (routes/auth.ts); the account then records
   * when (`privacyAcceptedAt` = `createdAt`) and which policy (`privacyVersion` =
   * PRIVACY_POLICY_VERSION). Never parsed from the body here, so local mode records nothing.
   */
  privacyAccepted?: boolean;
}

export interface LoginInput {
  /** Username or e-mail address (LoginRequest.username). */
  username: string;
  password: string;
  rememberMe: boolean;
  deviceName: string;
}

/** What `startGuest` takes (routes/auth.ts POST /guest). */
export interface GuestInput {
  /** Label of the guest session; blank -> the default label in `language`. */
  deviceName?: string;
  /** UI language the guest diary starts in, and the language of its demo data. Absent -> the default ('en'). */
  language?: Locale;
}

export interface LoginOptions {
  /**
   * True when the sign-in did not come from the computer itself (LAN or the remote-access HTTPS
   * listener). Such failures lock the account only for network sign-ins - never at the desktop.
   */
  fromNetwork?: boolean;
  /**
   * Hosted mode only: the caller's address bucket (middleware/access.ts `limiterKey`). The hard
   * lock then applies to this bucket alone, and the account gets the progressive delay instead
   * (`loginDelayMs`). Local mode never passes it, so its keys stay exactly as they were.
   */
  bucket?: string;
}

/** 400 WRONG_PASSWORD for "current password" checks inside an authenticated flow (a 401 would log the client out). */
export function wrongCurrentPassword(field: string): ApiError {
  return ApiError.localized(400, 'WRONG_PASSWORD', 'server.auth.wrongCurrentPassword', undefined, field);
}

function stringField(body: Record<string, unknown>, name: string): string {
  const v = body[name];
  return typeof v === 'string' ? v : '';
}

/** Trims and bounds a free-form device label ("מחשב", "Phone"...); blank -> the default label in `locale`. */
export function normalizeDeviceName(value: unknown, locale: Locale = DEFAULT_LOCALE): string {
  const s = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return s ? s.slice(0, DEVICE_NAME_MAX_LENGTH) : defaultDeviceName(locale);
}

function validateName(value: string, field: 'firstName' | 'lastName'): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    throw ApiError.validation(field === 'firstName' ? 'server.auth.firstNameRequired' : 'server.auth.lastNameRequired', field);
  }
  if (trimmed.length > NAME_MAX_LENGTH) {
    throw ApiError.validation(field === 'firstName' ? 'server.auth.firstNameTooLong' : 'server.auth.lastNameTooLong', field, {
      max: NAME_MAX_LENGTH,
    });
  }
  return trimmed;
}

/** Trims and shape-checks an e-mail address. Throws VALIDATION with field 'email'. */
export function validateEmail(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw ApiError.validation('server.auth.emailRequired', 'email');
  if (trimmed.length > EMAIL_MAX_LENGTH) throw ApiError.validation('server.auth.emailTooLong', 'email', { max: EMAIL_MAX_LENGTH });
  if (!EMAIL_PATTERN.test(trimmed)) throw ApiError.validation('server.auth.emailInvalid', 'email');
  return trimmed;
}

/**
 * Validates and normalises a RegisterRequest body (used by the route, and again by the service).
 * Throws VALIDATION / WEAK_PASSWORD with the offending field name. `locale` only names the
 * default device label; the error messages are rendered later, in the request language.
 */
export function validateRegisterBody(raw: unknown, locale: Locale = DEFAULT_LOCALE): RegisterInput {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const firstName = validateName(stringField(body, 'firstName'), 'firstName');
  const lastName = validateName(stringField(body, 'lastName'), 'lastName');
  const username = stringField(body, 'username').trim();
  if (!username) throw ApiError.validation('server.auth.usernameRequired', 'username');
  const uProblem = usernameProblemKey(username);
  if (uProblem) throw ApiError.validation(uProblem.key, 'username', uProblem.params);
  const email = validateEmail(stringField(body, 'email'));
  const password = stringField(body, 'password');
  if (!password) throw ApiError.validation('server.auth.passwordRequired', 'password');
  const weak = weakPasswordError(password);
  if (weak) throw weak;
  if ('confirmPassword' in body && body.confirmPassword !== password) {
    throw ApiError.validation('server.auth.confirmMismatch', 'confirmPassword');
  }
  return {
    firstName,
    lastName,
    username,
    email,
    password,
    rememberMe: body.rememberMe === true,
    deviceName: normalizeDeviceName(body.deviceName, locale),
    ...(isLocale(body.language) ? { language: body.language } : {}),
  };
}

/**
 * Validates a LoginRequest body (`username` = username or e-mail). Missing fields are validation
 * errors; wrong credentials are not decided here.
 */
export function validateLoginBody(raw: unknown, locale: Locale = DEFAULT_LOCALE): LoginInput {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const username = stringField(body, 'username').trim();
  if (!username) throw ApiError.validation('server.auth.loginIdentifierRequired', 'username');
  const password = stringField(body, 'password');
  if (!password) throw ApiError.validation('server.auth.passwordRequired', 'password');
  return { username, password, rememberMe: body.rememberMe === true, deviceName: normalizeDeviceName(body.deviceName, locale) };
}

/**
 * Validates a `PUT /api/auth/profile` body: every present field is checked like at registration
 * (names 1-50 characters, e-mail shape up to 254). Absent fields stay untouched; a body without
 * any of the three fields is a validation error.
 */
export function validateProfilePatch(raw: unknown): ProfilePatch {
  const body = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const patch: ProfilePatch = {};
  if (body.firstName !== undefined) patch.firstName = validateName(stringField(body, 'firstName'), 'firstName');
  if (body.lastName !== undefined) patch.lastName = validateName(stringField(body, 'lastName'), 'lastName');
  if (body.email !== undefined) patch.email = validateEmail(stringField(body, 'email'));
  if (patch.firstName === undefined && patch.lastName === undefined && patch.email === undefined) {
    throw ApiError.validation('server.auth.profileNothingToUpdate');
  }
  return patch;
}

/**
 * What the operator tool of a hosted server (routes/admin.ts, docs/HOSTED-PLAN.md 3.10) may see of an
 * account: who it is, when it was created and last signed in, how big its diary file is, and whether it
 * is signed in or locked. Never anything of the diary itself, never key material (verifier, salt,
 * recovery key), never the display names.
 */
export interface AdminAccountInfo {
  id: string;
  username: string;
  /** '' for accounts registered before the field existed. */
  email: string;
  createdAt: string;
  /** The last sign-in recorded in the registry; null when none was recorded. */
  lastLoginAt: string | null;
  /** Size of the encrypted diary file (users/<id>.mpd) in bytes; null when it cannot be read. */
  diaryBytes: number | null;
  /** Live sessions (signed-in devices). */
  sessions: number;
  /** The diary is open in memory right now. */
  open: boolean;
  /** Sign-ins or password confirmations are refused or slowed right now - what `adminUnlock` clears. */
  locked: boolean;
}

/** Which registry field `adminFindAccounts` compares (exactly, case-insensitively); 'any' = username or e-mail. */
export type AdminLookup = 'username' | 'email' | 'any';

export class DiaryAuthService implements AuthService {
  readonly accounts: AccountsStore;
  readonly sessions: SessionStore;
  readonly vaults: VaultRegistry;
  private readonly kdf: KdfParams;
  private readonly now: () => Date;
  /** Ids of sessions currently counted in their vault's refCount. */
  private readonly attached = new Set<string>();
  private sweepTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  /** Failed sign-ins per account (see LoginLockout). */
  readonly lockout: LoginLockout;
  /** Hosted mode: failures per account across every bucket - the progressive delay, never a lock. */
  readonly delays: LoginLockout;
  private readonly sleep: (ms: number) => Promise<void>;
  /** Password-reset links / codes (`<dataDir>/resets.json`). */
  readonly resets: ResetStore;
  /** Tail of the chain of password operations per account (see `withAccountLock`). */
  private readonly accountLocks = new Map<string, Promise<void>>();
  /**
   * Ids of accounts whose deletion is running. Their sessions are refused and their diary is never
   * (re)opened meanwhile - a remember-me request or a sign-in from another device must not bring the
   * diary back into memory (or onto disk) while it is being wiped.
   */
  private readonly deleting = new Set<string>();
  /** Called after an account was deleted (in-memory per-account state elsewhere, e.g. reset-code counters). */
  private readonly deletedListeners = new Set<(userId: string) => void>();
  /** Called after the operator unlocked an account (`adminUnlock`): per-account limits kept elsewhere (reset codes). */
  private readonly unlockedListeners = new Set<(userId: string) => void>();
  /**
   * The guests of the tour mode, by account id (security/guest.ts): each account record - kept here
   * only, never in the registry (accounts.json) - the id of its single session, and the timer that
   * ends it (hosted mode only). The local rule keeps at most one entry.
   */
  private readonly guests = new Map<string, { account: AccountRecord; sessionId: string; timer: NodeJS.Timeout | null }>();
  /** Hosted mode: the cap of concurrent guests and their lifetime; null = the local rule (one guest). */
  private readonly guestPolicy: { max: number; lifetimeMs: number } | null;
  /** Tail of the chain of `startGuest` calls (they run one after another: the cap is exact). */
  private guestChain: Promise<unknown> = Promise.resolve();
  /** Idle-vault eviction (hosted mode): the idle time, the last request per open diary, the sweep timer. */
  readonly vaultIdleMs: number;
  private readonly lastActivity = new Map<string, number>();
  private evictTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ServerConfig,
    private readonly deviceKey: Buffer,
    opts: AuthServiceOptions = {},
  ) {
    this.kdf = opts.kdf ?? DEFAULT_KDF;
    this.now = opts.now ?? (() => new Date());
    this.vaultIdleMs = opts.vaultIdleMs && opts.vaultIdleMs > 0 ? opts.vaultIdleMs : 0;
    this.guestPolicy = opts.guests && opts.guests.max > 0 ? { max: opts.guests.max, lifetimeMs: Math.max(1, opts.guests.lifetimeMs) } : null;
    this.lockout = new LoginLockout(this.now, opts.lockout);
    this.delays = new LoginLockout(this.now, { maxFailures: Number.MAX_SAFE_INTEGER, lockMs: this.lockout.lockMs });
    this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.accounts = new AccountsStore(config.accountsFile);
    this.resets = new ResetStore(path.join(config.dataDir, 'resets.json'), { now: this.now, ttlMs: opts.resetTtlMs });
    this.vaults = new VaultRegistry();
    this.sessions = new SessionStore(config.sessionsFile, deviceKey, {
      now: this.now,
      onRemoved: (session) => {
        // A guest's only session is gone (logout, expiry): the guest goes with it - its record is
        // forgotten and its memory-only diary dropped.
        const guestEnded = this.guests.get(session.userId)?.sessionId === session.id && this.forgetGuest(session.userId);
        // Fired for expiry/removal paths that did not detach explicitly (logout does it first).
        const released = this.detach(session);
        (guestEnded ? released.then(() => this.vaults.close(session.userId, false)) : released).catch((e: unknown) =>
          console.error('[diary-server] failed to release vault:', (e as Error).message),
        );
      },
    });
    this.sweepTimer = setInterval(() => this.sessions.sweepExpired(), SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
    if (this.vaultIdleMs > 0) {
      const every = Math.max(1_000, Math.min(Math.floor(this.vaultIdleMs / 2), 60_000));
      this.evictTimer = setInterval(() => {
        this.evictIdleVaults().catch((e: unknown) => console.error('[diary-server] idle-vault eviction failed:', (e as Error).message));
      }, every);
      this.evictTimer.unref?.();
    }
  }

  // Idle-vault eviction (hosted mode, docs/HOSTED-PLAN.md 3.7) -----------------------------------

  /** Remembers that `userId`'s diary was used now (a request, a sign-in). */
  private noteActivity(userId: string): void {
    if (this.vaultIdleMs > 0) this.lastActivity.set(userId, this.now().getTime());
  }

  /**
   * Closes (flushing first) every open diary that saw no request for `vaultIdleMs` and whose
   * attached sessions are all remember-me sessions - the next request of any of them reopens it
   * exactly as after a restart (`authenticate`: the wrapped key). A diary with a regular session
   * attached stays (such a session cannot reopen it; it expires after 12 h anyway), as does one
   * with a password operation or a deletion in progress. Returns how many were closed. A no-op
   * while eviction is off (local mode).
   */
  async evictIdleVaults(): Promise<number> {
    if (this.vaultIdleMs <= 0 || this.stopped) return 0;
    const now = this.now().getTime();
    let evicted = 0;
    for (const userId of this.vaults.ids()) {
      const last = this.lastActivity.get(userId);
      if (last === undefined) {
        // Opened before we started counting (or by a path without a request): count from now.
        this.lastActivity.set(userId, now);
        continue;
      }
      if (now - last < this.vaultIdleMs) continue;
      if (this.deleting.has(userId) || this.accountLocks.has(userId) || this.guests.has(userId)) continue;
      const attached = this.sessions.list(userId).filter((s) => this.attached.has(s.id));
      if (attached.some((s) => !s.rememberMe)) continue;
      for (const s of attached) this.attached.delete(s.id);
      await this.vaults.close(userId);
      this.lastActivity.delete(userId);
      evicted++;
    }
    return evicted;
  }

  // Password helpers ----------------------------------------------------------

  /** Derives the key for `account` and checks the verifier. Returns the key (caller wipes) or null. */
  private async checkPassword(account: AccountRecord, password: string): Promise<Buffer | null> {
    const salt = Buffer.from(account.kdf.saltHex, 'hex');
    const secret = await deriveSecret(password, salt, { N: account.kdf.N, r: account.kdf.r, p: account.kdf.p });
    const { key, verifierSource } = splitSecret(secret);
    wipe(secret);
    const ok = safeEqualHex(verifierHex(verifierSource), account.verifierHex);
    wipe(verifierSource);
    if (ok) return key;
    wipe(key);
    return null;
  }

  /**
   * `checkPassword` for "confirm with your password" steps of a signed-in account: counted per
   * account (CONFIRM_LOCKOUT_PREFIX), so after LOGIN_LOCKOUT_MAX_FAILURES wrong passwords in a row
   * every confirmation is refused with 429 for LOGIN_LOCKOUT_MS - even with the right password.
   * Returns the key (caller wipes) or null for a wrong password.
   */
  private async confirmPassword(account: AccountRecord, password: string): Promise<Buffer | null> {
    const lockKey = `${CONFIRM_LOCKOUT_PREFIX}${account.id}`;
    const locked = this.lockout.remaining(lockKey);
    if (locked > 0) throw accountLockedError(locked);
    const key = password ? await this.checkPassword(account, password) : null;
    if (key) {
      this.lockout.reset(lockKey);
      return key;
    }
    const lockMs = this.lockout.fail(lockKey);
    if (lockMs > 0) throw accountLockedError(lockMs);
    return null;
  }

  /**
   * Forgets every sign-in and confirmation counter of `userId`: the lock on the computer, the network
   * lock (local mode), the per-bucket locks and the progressive delay (hosted mode), the lock of the
   * "confirm with your password" steps. After a password reset, an account deletion and the operator's
   * unlock (`adminUnlock`).
   */
  private clearLockouts(userId: string): void {
    this.lockout.reset(`account:${userId}`);
    this.lockout.reset(`account:${userId}@network`);
    this.lockout.resetPrefix(`account:${userId}@`);
    this.delays.reset(`account:${userId}@any`);
    this.lockout.reset(`${CONFIRM_LOCKOUT_PREFIX}${userId}`);
  }

  /** True while any counter `clearLockouts` forgets refuses or slows the account. */
  private isLocked(userId: string): boolean {
    return (
      this.lockout.remaining(`account:${userId}`) > 0 ||
      this.lockout.remainingPrefix(`account:${userId}@`) > 0 ||
      this.lockout.remaining(`${CONFIRM_LOCKOUT_PREFIX}${userId}`) > 0 ||
      loginDelayMs(this.delays.failures(`account:${userId}@any`)) > 0
    );
  }

  /** Same cost as a real check, so "unknown user" and "wrong password" take the same time. */
  private async burnDerivation(password: string): Promise<void> {
    const secret = await deriveSecret(password, Buffer.alloc(16, 0x5a), this.kdf);
    wipe(secret);
  }

  /**
   * Runs `fn` after every earlier password operation of `userId` (change, reset, deletion) has
   * finished. Each of them re-encrypts or deletes the diary across several awaits; interleaved, a
   * reset that closes the diary while a change-password is still deriving its key would leave the
   * file encrypted under one key and the registry holding the verifier of the other - a diary
   * nobody can open any more.
   */
  private async withAccountLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.accountLocks.get(userId) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => mine);
    this.accountLocks.set(userId, tail);
    try {
      await previous;
      return await fn();
    } finally {
      release();
      if (this.accountLocks.get(userId) === tail) this.accountLocks.delete(userId);
    }
  }

  // Vault attachment ----------------------------------------------------------

  /** The account `userId`: its registry record, or the in-memory record of a current guest. */
  private accountOf(userId: string): AccountRecord | null {
    return this.accounts.findById(userId) ?? this.guests.get(userId)?.account ?? null;
  }

  /** True while `userId` is being deleted, and once its record is gone (registry record, or the guest that ended). */
  private isGone(userId: string): boolean {
    return this.deleting.has(userId) || !this.accountOf(userId);
  }

  /**
   * After a vault was acquired for `userId`: when the account was deleted (or its deletion started)
   * while the diary was being opened, the diary is closed again without writing anything and the
   * caller gets `error` - a deleted diary never stays in memory or comes back onto disk.
   */
  private async refuseIfGone(userId: string, error: () => ApiError): Promise<void> {
    if (!this.isGone(userId)) return;
    await this.vaults.close(userId, false);
    throw error();
  }

  /** Counts `session` in the user's vault, opening it with `opener` when it is not open. */
  private async attach(session: Session, account: AccountRecord, opener: () => Promise<DiaryVault>): Promise<AuthContext> {
    const vault = await this.vaults.acquire(account, opener);
    await this.refuseIfGone(account.id, () => ApiError.sessionExpired());
    this.attached.add(session.id);
    this.noteActivity(account.id);
    return { session, account, user: toUserProfile(account), vault, db: vault.db };
  }

  private async detach(session: Session): Promise<void> {
    if (!this.attached.delete(session.id)) return;
    await this.vaults.release(session.userId);
  }

  // Account language (AccountRecord.language, docs/android-tasks/PRIVACY-HARDENING.md item 1) -----

  /** The language setting of an open diary, or null when it cannot be read. */
  private languageOf(db: DiaryDb): Locale | null {
    try {
      return resolveLocale(getSettings(db).language);
    } catch {
      return null;
    }
  }

  /**
   * Keeps the registry's copy of the account's UI language (AccountRecord.language) equal to the
   * language setting of its open diary - the e-mail paths read it from the registry and never open
   * a diary for it. accounts.json is written only when the value changes. Best effort: a failure is
   * logged, and the next save or sign-in writes it again. Guests (not in the registry) and accounts
   * being deleted are skipped.
   */
  private noteLanguage(userId: string, db: DiaryDb): void {
    if (this.guests.has(userId) || this.deleting.has(userId)) return;
    const language = this.languageOf(db);
    if (!language) return;
    try {
      this.accounts.setLanguage(userId, language);
    } catch (e) {
      console.error('[diary-server] failed to record the language of an account:', (e as Error).message);
    }
  }

  /**
   * Every later save of `vault` brings AccountRecord.language up to date (`noteLanguage`): a
   * language changed in Settings, by an offline-sync settings change or by a restored backup reaches
   * the registry with the save that puts it on disk, without a hook in every route.
   */
  private watchSaves(vault: DiaryVault): DiaryVault {
    vault.onSaved = (db) => this.noteLanguage(vault.userId, db);
    return vault;
  }

  // AuthService ---------------------------------------------------------------

  async register(input: RegisterInput): Promise<{ token: string; session: Session; account: AccountRecord }> {
    const clean = validateRegisterBody(input);
    const language = input.language && isLocale(input.language) ? input.language : clean.language;
    if (this.accounts.findByUsername(clean.username)) throw ApiError.usernameTaken();
    if (this.accounts.findByEmail(clean.email)) throw emailTaken();

    const id = newAccountId();
    const salt = newSalt();
    const secret = await deriveSecret(clean.password, salt, this.kdf);
    const { key, verifierSource } = splitSecret(secret);
    wipe(secret);
    const createdAt = nowIso(this.now());
    const account: AccountRecord = {
      id,
      username: clean.username,
      usernameLower: clean.username.toLowerCase(),
      firstName: clean.firstName,
      lastName: clean.lastName,
      email: clean.email,
      emailLower: normalizeEmail(clean.email),
      createdAt,
      // Registration signs the user in, so it counts as the first login (the login screen prefers this account next time).
      lastLoginAt: createdAt,
      kdf: { algorithm: 'scrypt', N: this.kdf.N, r: this.kdf.r, p: this.kdf.p, saltHex: salt.toString('hex') },
      verifierHex: verifierHex(verifierSource),
      dbFile: `${id}.mpd`,
      // Recovery key escrow: lets "Forgot password?" re-encrypt this diary under a new password.
      recoveryWrappedKey: wrapRecoveryKey(key, this.deviceKey, id),
      // The privacy checkbox (hosted server): when it was ticked and which policy was published then.
      ...(input.privacyAccepted === true ? { privacyAcceptedAt: createdAt, privacyVersion: PRIVACY_POLICY_VERSION } : {}),
    };
    wipe(verifierSource);
    if (fs.existsSync(vaultPathOf(this.config, account))) {
      wipe(key);
      throw ApiError.io('server.auth.diaryFileExists');
    }
    try {
      // The diary file is created before the registry record so a crash never leaves an account without a diary.
      const vault = await this.vaults.acquire(account, () => createVault(this.config, account, key).then((v) => this.watchSaves(v)));
      // The new diary starts in the language the account was created in (the sign-up screen's), so
      // the interface - and e-mails such as password reset - use it from the first moment.
      if (language) {
        try {
          saveSettings(vault.db, { language });
        } catch (e) {
          console.error('[diary-server] the language of a new account could not be stored:', (e as Error).message);
        }
      }
      // The registry's copy of it, for the e-mails (AccountRecord.language).
      const startLanguage = this.languageOf(vault.db);
      if (startLanguage) account.language = startLanguage;
      try {
        this.accounts.add(account);
      } catch (e) {
        await this.vaults.close(account.id, false);
        await deleteVaultFiles(vault.dbPath);
        throw e;
      }
      const { token, session } = this.sessions.create(account.id, clean.rememberMe, clean.deviceName, key);
      this.attached.add(session.id);
      this.noteActivity(account.id);
      // Local rule: a real account takes over - the tour (if one is running) ends, so the new account
      // starts clean. On the hosted server other visitors' tours are not ours to end.
      if (!this.guestPolicy) await this.endGuestQuietly();
      return { token, session, account };
    } finally {
      wipe(key);
    }
  }

  async login(input: LoginInput, opts: LoginOptions = {}): Promise<{ token: string; session: Session; account: AccountRecord }> {
    const clean = validateLoginBody(input);
    // Username or e-mail; an unknown identifier and a wrong password answer identically (same error, same cost).
    const account = this.accounts.findByLogin(clean.username);
    // Lockout: one counter per account; unknown names are counted too, so they behave the same.
    // Sign-ins from the network (LAN / internet) count separately from the computer itself, so
    // strangers guessing passwords over the internet can never lock the owner out at the desktop.
    const channel = opts.fromNetwork ? '@network' : '';
    const base = account ? `account:${account.id}` : `name:${clean.username.toLowerCase()}`;
    // Hosted mode: the hard lock is per address bucket (a stranger locks only his own network out),
    // and the account itself only gets slower (`delayKey`) - never locked for its owner.
    const lockKey = opts.bucket ? `${base}${channel}@${opts.bucket}` : `${base}${channel}`;
    const delayKey = opts.bucket ? `${base}@any` : null;
    const locked = this.lockout.remaining(lockKey);
    if (locked > 0) throw accountLockedError(locked);
    if (delayKey) {
      const wait = loginDelayMs(this.delays.failures(delayKey));
      if (wait > 0) await this.sleep(wait);
    }
    const failed = () => {
      if (delayKey) this.delays.fail(delayKey);
      const lockMs = this.lockout.fail(lockKey);
      return lockMs > 0 ? accountLockedError(lockMs) : ApiError.wrongPassword();
    };
    if (!account) {
      await this.burnDerivation(clean.password);
      throw failed();
    }
    const key = await this.checkPassword(account, clean.password);
    if (!key) throw failed();
    this.lockout.reset(lockKey);
    if (delayKey) this.delays.reset(delayKey);
    try {
      // Deleted (or being deleted) while the password was checked: answered like an unknown name.
      if (this.isGone(account.id)) throw ApiError.wrongPassword();
      await this.vaults.acquire(account, () => openVault(this.config, account, key).then((v) => this.watchSaves(v)));
      await this.refuseIfGone(account.id, () => ApiError.wrongPassword());
      const { token, session } = this.sessions.create(account.id, clean.rememberMe, clean.deviceName, key);
      this.attached.add(session.id);
      this.noteActivity(account.id);
      // Local rule: a real account signed in - the tour (if one is running) ends. Not on the hosted
      // server, where the tours belong to other visitors.
      if (!this.guestPolicy) await this.endGuestQuietly();
      return { token, session, account: this.rememberLogin(account, key) };
    } finally {
      wipe(key);
    }
  }

  /**
   * Writes the sign-in time to the registry so the login screen offers this name first next time,
   * even after a restart - together with the recovery key when it is missing or stale (accounts
   * created before password reset existed get it here) and the language of the open diary
   * (AccountRecord.language; accounts from before the field get it here). Best effort: a disk
   * hiccup here must not turn a correct password into a failed login, so the error is logged and
   * the unchanged record is used.
   */
  private rememberLogin(account: AccountRecord, key: Buffer): AccountRecord {
    try {
      const recovery = this.recoveryBlobFor(account, key) ?? undefined;
      const open = this.vaults.get(account.id);
      const language = (open && this.languageOf(open.db)) || undefined;
      return this.accounts.touchLogin(account.id, nowIso(this.now()), recovery, language) ?? account;
    } catch (e) {
      console.error('[diary-server] failed to record the login time:', (e as Error).message);
      return account;
    }
  }

  // Recovery key (password reset by e-mail) ------------------------------------

  /**
   * A new recovery blob for `key` when the stored one is missing, damaged, made with another
   * device key or no longer wraps `key`; null when the stored one is current (nothing to write).
   */
  private recoveryBlobFor(account: AccountRecord, key: Buffer): string | null {
    if (account.recoveryWrappedKey) {
      try {
        const stored = unwrapRecoveryKey(account.recoveryWrappedKey, this.deviceKey, account.id);
        const same = safeEqualBytes(stored, key);
        wipe(stored);
        if (same) return null;
      } catch {
        /* unreadable: replace it */
      }
    }
    return wrapRecoveryKey(key, this.deviceKey, account.id);
  }

  /** Creates / refreshes the recovery key of `account` from an opened diary key (best effort). */
  private ensureRecoveryKey(account: AccountRecord, key: Buffer): void {
    try {
      const blob = this.recoveryBlobFor(account, key);
      if (!blob) return;
      const saved = this.accounts.setRecoveryKey(account.id, blob);
      if (saved) account.recoveryWrappedKey = saved.recoveryWrappedKey;
    } catch (e) {
      console.error('[diary-server] failed to store the recovery key:', (e as Error).message);
    }
  }

  /** The diary key from the recovery key (caller wipes), or null when the account has no usable one. */
  private recoveryKeyOf(account: AccountRecord): Buffer | null {
    if (!account.recoveryWrappedKey) return null;
    try {
      return unwrapRecoveryKey(account.recoveryWrappedKey, this.deviceKey, account.id);
    } catch {
      return null;
    }
  }

  /**
   * True when the password of `account` can be reset by e-mail: it has a recovery key (of the right
   * shape). Checked WITHOUT unwrapping it - a forgot-password request must not decrypt anything of a
   * signed-out user, not even the diary key for a moment (docs/android-tasks/PRIVACY-HARDENING.md
   * item 1). A recovery key that does not open with this device key (the device key was replaced and
   * the account has not signed in since; every sign-in renews it - rememberLogin) is found out by the
   * reset itself, which then answers 409 'server.reset.unavailable' and changes nothing.
   */
  canResetPassword(account: AccountRecord): boolean {
    return hasRecoveryKeyShape(account.recoveryWrappedKey);
  }

  /**
   * UI language of the account, for e-mails (password reset, security notices): the copy kept in
   * the registry (AccountRecord.language - written at registration, sign-in, reopening and every
   * save that changes the setting). Null for an account that has none yet (not signed in since the
   * field exists): the caller then uses the request language, else English. NEVER opens the diary -
   * a forgot-password request must not decrypt anything of a signed-out user
   * (docs/android-tasks/PRIVACY-HARDENING.md item 1).
   */
  accountLocale(account: AccountRecord): Locale | null {
    const language = (this.accounts.findById(account.id) ?? account).language;
    return isLocale(language) ? language : null;
  }

  /**
   * Password reset by e-mail (the caller has already validated the new password and taken the link /
   * code): the diary key is unwrapped from the recovery key, the diary is re-encrypted under a key
   * derived from `newPassword` with a new salt (the change-password path), the verifier and the
   * recovery key are updated, EVERY session of the account is signed out (the diary closes), and the
   * sign-in lockouts and all other pending resets of the account are cleared. Returns the updated record.
   */
  async resetPassword(userId: string, newPassword: string): Promise<AccountRecord> {
    if (typeof newPassword !== 'string' || !newPassword) throw ApiError.validation('server.auth.newPasswordRequired', 'newPassword');
    const weak = weakPasswordError(newPassword);
    if (weak) throw weak;
    return this.withAccountLock(userId, () => this.resetPasswordLocked(userId, newPassword));
  }

  private async resetPasswordLocked(userId: string, newPassword: string): Promise<AccountRecord> {
    // Read inside the lock: an operation that ran just before may have changed the key / verifier.
    const account = this.accounts.findById(userId);
    if (!account) throw resetInvalid();
    const oldKey = this.recoveryKeyOf(account);
    if (!oldKey) throw ApiError.localized(409, 'OTHER', 'server.reset.unavailable');
    let vault: DiaryVault;
    try {
      // Joins the open diary (other sessions) or opens it with the recovered key.
      vault = await this.vaults.acquire(account, () => openVault(this.config, account, oldKey).then((v) => this.watchSaves(v)));
    } finally {
      wipe(oldKey);
    }
    const salt = newSalt();
    let updated: AccountRecord;
    try {
      const secret = await deriveSecret(newPassword, salt, this.kdf);
      const { key, verifierSource } = splitSecret(secret);
      wipe(secret);
      try {
        // Same order as changePassword: the re-encrypted file first, then the registry.
        await vault.rekey(key, { salt, kdf: this.kdf });
        // The diary is open for the reset anyway: its language goes to the registry with the new
        // verifier, so the "password changed" notice is in it.
        const language = this.languageOf(vault.db);
        updated = {
          // Fresh copy: a sign-in during the key derivation may have recorded its time meanwhile.
          ...(this.accounts.findById(account.id) ?? account),
          kdf: { algorithm: 'scrypt', N: this.kdf.N, r: this.kdf.r, p: this.kdf.p, saltHex: salt.toString('hex') },
          verifierHex: verifierHex(verifierSource),
          recoveryWrappedKey: wrapRecoveryKey(key, this.deviceKey, account.id),
          ...(language ? { language } : {}),
        };
        this.accounts.update(updated);
      } finally {
        wipe(key);
        wipe(verifierSource);
      }
    } catch (e) {
      await this.vaults.release(account.id);
      throw e;
    }
    // Sign out everywhere: whoever knew the old password or holds an old token is out.
    for (const s of this.sessions.list(account.id)) this.attached.delete(s.id);
    this.sessions.removeAllForUser(account.id);
    await this.vaults.close(account.id);
    this.clearLockouts(account.id);
    this.resets.removeAllForUser(account.id);
    return this.accounts.findById(account.id) ?? updated;
  }

  async authenticate(token: string): Promise<AuthContext | null> {
    if (this.stopped) return null;
    const session = this.sessions.resolve(token);
    if (!session) return null;
    const account = this.accountOf(session.userId);
    if (!account) {
      this.sessions.remove(session.id);
      return null;
    }
    // The account is being deleted right now: its sessions are about to go, its diary must not reopen.
    if (this.deleting.has(account.id)) return null;
    let vault = this.vaults.get(account.id);
    if (vault && this.attached.has(session.id)) {
      this.sessions.touch(session);
      this.noteActivity(account.id);
      return { session, account, user: toUserProfile(account), vault, db: vault.db };
    }
    // Vault closed (after a restart) or this session not yet counted: remember-me sessions carry
    // the key (wrapped with the device key); regular sessions cannot reopen a closed vault.
    const key = this.sessions.wrappedKeyOf(session);
    if (!vault && !key) {
      this.sessions.remove(session.id);
      return null;
    }
    try {
      const opening = !vault;
      const ctx = await this.attach(session, account, () => {
        if (!key) throw ApiError.sessionExpired();
        return openVault(this.config, account, key).then((v) => this.watchSaves(v));
      });
      // A remember-me key just opened the diary: make sure the recovery key exists and matches, and
      // that the registry knows the account language (AccountRecord.language).
      if (opening && key) {
        this.ensureRecoveryKey(ctx.account, key);
        this.noteLanguage(account.id, ctx.db);
      }
      this.sessions.touch(session);
      return ctx;
    } finally {
      wipe(key);
    }
  }

  async logout(sessionId: string): Promise<void> {
    const session = this.sessions.findById(sessionId);
    if (!session) return;
    await this.detach(session);
    this.sessions.remove(sessionId);
  }

  /**
   * Locks / unlocks a session (lock screen). False when the session is gone - and for the guest
   * session, which is never locked: no password could unlock it again.
   */
  setSessionLocked(sessionId: string, locked: boolean): boolean {
    if (locked && this.sessions.findById(sessionId)?.guest) return false;
    return this.sessions.setLocked(sessionId, locked);
  }

  async verifyPassword(account: AccountRecord, password: string): Promise<boolean> {
    // A guest has no password: nothing confirms as one (and nothing is counted).
    if (account.guest) return false;
    if (typeof password !== 'string' || !password) return false;
    const fresh = this.accounts.findById(account.id) ?? account;
    const key = await this.confirmPassword(fresh, password);
    if (!key) return false;
    wipe(key);
    return true;
  }

  async changePassword(ctx: AuthContext, oldPassword: string, newPassword: string): Promise<void> {
    if (isGuestContext(ctx)) throw guestNotAllowed();
    if (typeof oldPassword !== 'string' || !oldPassword) throw ApiError.validation('server.auth.currentPasswordRequired', 'oldPassword');
    if (typeof newPassword !== 'string' || !newPassword) throw ApiError.validation('server.auth.newPasswordRequired', 'newPassword');
    const weak = weakPasswordError(newPassword);
    if (weak) throw weak;
    await this.withAccountLock(ctx.account.id, () => this.changePasswordLocked(ctx, oldPassword, newPassword));
  }

  private async changePasswordLocked(ctx: AuthContext, oldPassword: string, newPassword: string): Promise<void> {
    // A password reset that ran just before signed this session out.
    if (!this.sessions.findById(ctx.session.id)) throw ApiError.sessionExpired();
    const account = this.accounts.findById(ctx.account.id);
    if (!account) throw ApiError.sessionExpired();
    const oldKey = await this.confirmPassword(account, oldPassword);
    if (!oldKey) throw wrongCurrentPassword('oldPassword');
    wipe(oldKey);
    if (newPassword === oldPassword) throw ApiError.validation('server.auth.newPasswordSameAsCurrent', 'newPassword');
    const vault = this.vaults.get(account.id);
    if (!vault) throw ApiError.sessionExpired();

    const salt = newSalt();
    const secret = await deriveSecret(newPassword, salt, this.kdf);
    const { key, verifierSource } = splitSecret(secret);
    wipe(secret);
    try {
      // Order matters for crash safety: the re-encrypted file first (its .prev still opens with the
      // old key, which the old verifier still accepts), then the verifier, then the remembered keys.
      await vault.rekey(key, { salt, kdf: this.kdf });
      const updated: AccountRecord = {
        ...(this.accounts.findById(account.id) ?? account),
        kdf: { algorithm: 'scrypt', N: this.kdf.N, r: this.kdf.r, p: this.kdf.p, saltHex: salt.toString('hex') },
        verifierHex: verifierHex(verifierSource),
        // The recovery key follows the new diary key, so "Forgot password?" keeps working.
        recoveryWrappedKey: wrapRecoveryKey(key, this.deviceKey, account.id),
      };
      this.accounts.update(updated);
      ctx.account.kdf = updated.kdf;
      ctx.account.verifierHex = updated.verifierHex;
      ctx.account.recoveryWrappedKey = updated.recoveryWrappedKey;
      this.sessions.rewrapAllForUser(account.id, key);
      // Every other device is signed out (a password is usually changed because it or a device may
      // be compromised); only the session that changed it stays. The diary stays open for it.
      for (const other of this.sessions.list(account.id)) {
        if (other.id === ctx.session.id) continue;
        await this.detach(other);
        this.sessions.remove(other.id);
      }
      // Links / codes requested before the change are void.
      this.resets.removeAllForUser(account.id);
    } finally {
      wipe(key);
      wipe(verifierSource);
    }
  }

  async updateProfile(ctx: AuthContext, patch: ProfilePatch, currentPassword?: string): Promise<AccountRecord> {
    if (isGuestContext(ctx)) throw guestNotAllowed();
    const clean = validateProfilePatch(patch);
    return this.withAccountLock(ctx.account.id, () => this.updateProfileLocked(ctx, clean, currentPassword));
  }

  private async updateProfileLocked(ctx: AuthContext, clean: ProfilePatch, currentPassword?: string): Promise<AccountRecord> {
    if (!this.sessions.findById(ctx.session.id)) throw ApiError.sessionExpired();
    const account = this.accounts.findById(ctx.account.id);
    if (!account) throw ApiError.sessionExpired();
    // The e-mail address receives the password-reset links, so changing it (or setting the first
    // one) is a password-level change: whoever only holds a session token (an unlocked device, a
    // copied token) must not be able to point "Forgot password?" at their own mailbox.
    const emailChanges = clean.email !== undefined && normalizeEmail(clean.email) !== (account.emailLower ?? '');
    if (emailChanges && clean.email !== undefined) {
      // The store checks uniqueness again; this early check keeps the error before any write.
      const clash = this.accounts.findByEmail(clean.email);
      if (clash && clash.id !== account.id) throw emailTaken();
      if (typeof currentPassword !== 'string' || !currentPassword) {
        throw ApiError.validation('server.auth.currentPasswordRequired', 'currentPassword');
      }
      const key = await this.confirmPassword(account, currentPassword);
      if (!key) throw wrongCurrentPassword('currentPassword');
      wipe(key);
    }
    // Fresh copy: the password check awaited, a sign-in may have recorded its time meanwhile.
    const latest = this.accounts.findById(account.id);
    if (!latest) throw ApiError.sessionExpired();
    const updated: AccountRecord = { ...latest, kdf: { ...latest.kdf } };
    if (clean.firstName !== undefined) updated.firstName = clean.firstName;
    if (clean.lastName !== undefined) updated.lastName = clean.lastName;
    if (clean.email !== undefined) {
      updated.email = clean.email;
      updated.emailLower = normalizeEmail(clean.email);
      if (emailChanges && latest.email) {
        updated.previousEmail = latest.email;
        updated.emailChangedAt = nowIso(this.now());
      }
    }
    this.accounts.update(updated);
    // Links / codes mailed to the previous address stop working once the address changes.
    if (emailChanges) this.resets.removeAllForUser(account.id);
    const saved = this.accounts.findById(account.id) ?? updated;
    ctx.account.firstName = saved.firstName;
    ctx.account.lastName = saved.lastName;
    ctx.account.email = saved.email;
    ctx.account.emailLower = saved.emailLower;
    ctx.user = toUserProfile(saved);
    return saved;
  }

  listSessions(userId: string): Session[] {
    return this.sessions.list(userId);
  }

  listAccounts(): AccountRecord[] {
    const accounts = this.accounts.list();
    // Latest activity per account: the persisted last sign-in or a live session's lastSeenAt,
    // whichever is later ('' = never signed in and no session -> sorts last).
    const lastUsed = new Map<string, string>();
    for (const a of accounts) {
      let latest = a.lastLoginAt ?? '';
      for (const s of this.sessions.list(a.id)) if (s.lastSeenAt > latest) latest = s.lastSeenAt;
      lastUsed.set(a.id, latest);
    }
    return accounts.sort((a, b) => {
      const ua = lastUsed.get(a.id) ?? '';
      const ub = lastUsed.get(b.id) ?? '';
      if (ua !== ub) return ua > ub ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    });
  }

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const session = this.sessions.findById(sessionId);
    if (!session || session.userId !== userId) return false;
    await this.detach(session);
    this.sessions.remove(sessionId);
    return true;
  }

  async deleteAccount(ctx: AuthContext, password: string): Promise<void> {
    // A guest is not deleted with a password: it simply ends (logout).
    if (isGuestContext(ctx)) throw guestNotAllowed();
    await this.withAccountLock(ctx.account.id, () => this.deleteAccountLocked(ctx, password));
  }

  /**
   * Deletes the account for good, after checking its password - nothing of it stays on disk or in
   * memory: pending password resets (resets.json), every session (all devices; sessions.json
   * rewritten), the sign-in lockout counters, the registry record with its recovery key (which
   * frees the username and the e-mail address) and then the diary (closed without saving, then
   * `users/<id>.mpd` with its `.prev` / `.tmp`). Other accounts are not touched. While it runs,
   * requests of the account are refused and its diary cannot be reopened (`deleting`).
   *
   * Failures: every registry write comes before the diary is touched, and each store writes its
   * file before it changes memory. A failed write therefore stops the deletion with the account in
   * place - record, recovery key and diary (unsaved changes included) - so the user can sign in
   * again and delete again. Once the record is gone the account is deleted: its diary files are
   * removed right after, and files that cannot be removed at that moment stay listed in
   * accounts.json (`pendingDeletes`) and go at the next deletion or server start
   * (`purgeDeletedDiaries`).
   */
  private async deleteAccountLocked(ctx: AuthContext, password: string): Promise<void> {
    if (!this.sessions.findById(ctx.session.id)) throw ApiError.sessionExpired();
    const account = this.accounts.findById(ctx.account.id);
    if (!account) throw ApiError.sessionExpired();
    const key = await this.confirmPassword(account, typeof password === 'string' ? password : '');
    if (!key) throw wrongCurrentPassword('password');
    wipe(key);
    await this.wipeAccountLocked(account);
  }

  /**
   * The deletion itself, shared by the account's own deletion (after its password check) and the
   * operator's (`adminDeleteAccount`, without one) - so both remove exactly the same things in the same
   * order with the same failure behaviour (see `deleteAccountLocked`). The caller holds the account lock.
   */
  private async wipeAccountLocked(account: AccountRecord): Promise<void> {
    this.deleting.add(account.id);
    try {
      // 1. Pending password resets. When resets.json cannot be written nothing has changed.
      this.resets.forgetUser(account.id);
      // 2. Sign out everywhere: no request can act as this account any more, and no remember-me key
      //    can reopen its diary. Detached first, so dropping them does not flush or close the diary;
      //    when sessions.json cannot be written every session stays, attached as before.
      const attached = this.sessions.list(account.id).filter((s) => this.attached.delete(s.id));
      try {
        this.sessions.forgetUser(account.id);
      } catch (e) {
        for (const s of attached) this.attached.add(s.id);
        throw e;
      }
      this.clearLockouts(account.id);
      // 3. The registry record. When accounts.json cannot be written the account stays, with its
      //    diary; nobody is signed in to it any more, so the diary is closed - saving what was not
      //    saved yet - and opens again at the next sign-in.
      try {
        this.accounts.remove(account.id);
      } catch (e) {
        await this.vaults.close(account.id).catch((closeError: unknown) =>
          console.error('[diary-server] failed to close the diary after a failed account deletion:', (closeError as Error).message),
        );
        throw e;
      }
      // 4. The diary. Discard, do not flush: the file is about to be deleted anyway (a write in
      //    progress finishes first). Its files go with every other deleted diary still pending.
      try {
        await this.vaults.close(account.id, false);
      } catch (e) {
        console.error('[diary-server] failed to close the diary of a deleted account:', (e as Error).message);
      }
      await this.purgeDeletedDiaries();
    } finally {
      this.deleting.delete(account.id);
    }
    for (const listener of this.deletedListeners) {
      try {
        listener(account.id);
      } catch (e) {
        console.error('[diary-server] cleanup after an account deletion failed:', (e as Error).message);
      }
    }
  }

  /**
   * Removes the diary files (`<id>.mpd`, `.prev`, `.tmp`) of deleted accounts that accounts.json
   * still lists in `pendingDeletes`, and takes them off the list. Runs after every deletion and at
   * start-up (createAuthService). Never throws: a file that still cannot be removed stays listed for
   * the next time. Never touches the diary of an existing account.
   */
  async purgeDeletedDiaries(): Promise<void> {
    const pending = this.accounts.pendingDeletes();
    if (!pending.length) return;
    const inUse = new Set(this.accounts.list().map((a) => a.dbFile));
    const done: string[] = [];
    for (const file of pending) {
      try {
        if (!inUse.has(file)) await deleteVaultFiles(path.join(this.config.usersDir, file));
        done.push(file);
      } catch (e) {
        console.error(
          `[diary-server] the diary of a deleted account (${file}) could not be removed yet; retried at the next deletion or start:`,
          (e as Error).message,
        );
      }
    }
    try {
      this.accounts.clearPendingDeletes(done);
    } catch (e) {
      console.error('[diary-server] failed to update accounts.json after removing deleted diaries:', (e as Error).message);
    }
  }

  /**
   * Registers `listener` to run after every account deletion with the deleted id (for in-memory
   * per-account state kept elsewhere). Returns a function that removes it.
   */
  onAccountDeleted(listener: (userId: string) => void): () => void {
    this.deletedListeners.add(listener);
    return () => this.deletedListeners.delete(listener);
  }

  /**
   * Registers `listener` to run after the operator unlocked an account (`adminUnlock`) with its id -
   * for per-account limits kept elsewhere (the wrong reset-code counter). Returns a remover.
   */
  onAccountUnlocked(listener: (userId: string) => void): () => void {
    this.unlockedListeners.add(listener);
    return () => this.unlockedListeners.delete(listener);
  }

  // The operator tool of a hosted server (routes/admin.ts, docs/HOSTED-PLAN.md 3.10) -------------
  // Reached only through the loopback admin API (a shell in the container + the per-boot token), never
  // through a session: no password is asked, no key is unwrapped, no diary is opened or read.

  /** What the operator may see of `account` (AdminAccountInfo) - `sessionCounts` from one pass over the sessions. */
  private adminInfoOf(account: AccountRecord, sessionCounts: Map<string, number>): AdminAccountInfo {
    let diaryBytes: number | null = null;
    try {
      diaryBytes = fs.statSync(vaultPathOf(this.config, account)).size;
    } catch {
      diaryBytes = null;
    }
    return {
      id: account.id,
      username: account.username,
      email: account.email ?? '',
      createdAt: account.createdAt,
      lastLoginAt: account.lastLoginAt ?? null,
      diaryBytes,
      sessions: sessionCounts.get(account.id) ?? 0,
      open: this.vaults.get(account.id) !== null,
      locked: this.isLocked(account.id),
    };
  }

  /** The operator's view of account `userId`; null for an unknown id (and for a guest, which is no account). */
  adminAccount(userId: string): AdminAccountInfo | null {
    const account = this.accounts.findById(userId);
    return account ? this.adminInfoOf(account, this.sessions.countByUser()) : null;
  }

  /** How many accounts are registered (the operator tool's status line). */
  adminAccountCount(): number {
    return this.accounts.list().length;
  }

  /** Every registered account for the operator, oldest first (ties by username). Guests are not accounts. */
  adminAccounts(): AdminAccountInfo[] {
    const counts = this.sessions.countByUser();
    return this.accounts
      .list()
      .sort((a, b) => (a.createdAt !== b.createdAt ? (a.createdAt < b.createdAt ? -1 : 1) : a.usernameLower < b.usernameLower ? -1 : a.usernameLower > b.usernameLower ? 1 : 0))
      .map((a) => this.adminInfoOf(a, counts));
  }

  /**
   * The accounts whose username / e-mail address (or either, `by` = 'any') equals `value` exactly,
   * case-insensitively, after trimming - never a partial match. More than one only in a damaged registry;
   * the operator tool refuses to act on such an answer.
   */
  adminFindAccounts(by: AdminLookup, value: string): AdminAccountInfo[] {
    const wanted = (typeof value === 'string' ? value : '').trim().normalize('NFC').toLowerCase();
    if (!wanted) return [];
    const matches = this.accounts.list().filter((a) => {
      const byName = by !== 'email' && a.usernameLower.normalize('NFC').toLowerCase() === wanted;
      const byEmail = by !== 'username' && !!a.emailLower && a.emailLower.normalize('NFC') === wanted;
      return byName || byEmail;
    });
    if (!matches.length) return [];
    const counts = this.sessions.countByUser();
    return matches.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0)).map((a) => this.adminInfoOf(a, counts));
  }

  /**
   * Deletes account `userId` for the operator (a deletion request by e-mail from someone who cannot sign
   * in, abuse clean-up): exactly the steps of the account's own deletion after its password check
   * (`wipeAccountLocked`) - pending resets, every session, the lockout counters, the registry record,
   * the diary files - under the same per-account lock, then the same listeners. No password, no key.
   * Returns the deleted record. 404 'server.auth.accountNotFound' for an unknown id (or a guest).
   */
  async adminDeleteAccount(userId: string): Promise<AccountRecord> {
    return this.withAccountLock(userId, async () => {
      const account = this.accounts.findById(userId);
      if (!account) throw ApiError.notFound('server.auth.accountNotFound');
      await this.wipeAccountLocked(account);
      return account;
    });
  }

  /**
   * Signs account `userId` out on every device (the operator's "revoke"): every session is dropped -
   * sessions.json is written first, so a failed write changes nothing - and its diary is closed after
   * saving what was not saved yet. Returns how many live sessions there were. The account itself, its
   * diary and its pending resets stay. 404 'server.auth.accountNotFound' for an unknown id.
   */
  async adminRevokeSessions(userId: string): Promise<number> {
    return this.withAccountLock(userId, async () => {
      if (!this.accounts.findById(userId)) throw ApiError.notFound('server.auth.accountNotFound');
      const sessions = this.sessions.list(userId);
      // Detached first, so dropping them does not race a flush per session; when sessions.json cannot
      // be written every session stays, attached as before.
      const attached = sessions.filter((s) => this.attached.delete(s.id));
      try {
        this.sessions.forgetUser(userId);
      } catch (e) {
        for (const s of attached) this.attached.add(s.id);
        throw e;
      }
      await this.vaults.close(userId);
      this.lastActivity.delete(userId);
      return sessions.length;
    });
  }

  /**
   * The operator's "unlock": forgets every sign-in and confirmation counter of `userId` (`clearLockouts`)
   * and tells the listeners (the wrong reset-code counter). Returns whether anything was refusing or
   * slowing the account before. 404 'server.auth.accountNotFound' for an unknown id.
   */
  adminUnlock(userId: string): boolean {
    if (!this.accounts.findById(userId)) throw ApiError.notFound('server.auth.accountNotFound');
    const wasLocked = this.isLocked(userId);
    this.clearLockouts(userId);
    for (const listener of this.unlockedListeners) {
      try {
        listener(userId);
      } catch (e) {
        console.error('[diary-server] cleanup after an unlock failed:', (e as Error).message);
      }
    }
    return wasLocked;
  }

  // Guest mode (tour) -------------------------------------------------------

  /** True while a guest (tour mode) exists. */
  get hasGuest(): boolean {
    return this.guests.size > 0;
  }

  /** Guests (tours) running right now. */
  get guestCount(): number {
    return this.guests.size;
  }

  /**
   * Starts the tour mode (security/guest.ts): a temporary guest account with the demo data, in
   * `language`, and a session for it. Everything lives in memory only - the record is kept in this
   * service (not in accounts.json), the diary is a memory-only vault (no users/<id>.mpd), the
   * session is a regular one (never in sessions.json). Local rule (no `guests` option): a guest
   * that already exists is ended first - there is at most one. Hosted rule (`guests`): up to `max`
   * visitors at once (503 'server.auth.guestsFull' beyond), each ended by itself after `lifetimeMs`.
   * The caller (routes/auth.ts) mounts this only for apps built with `guestAllowed`.
   */
  startGuest(input: GuestInput = {}): Promise<{ token: string; session: Session; account: AccountRecord }> {
    const run = this.guestChain.then(() => this.startGuestNow(input));
    this.guestChain = run.catch(() => undefined);
    return run;
  }

  private async startGuestNow(input: GuestInput): Promise<{ token: string; session: Session; account: AccountRecord }> {
    if (this.stopped) throw ApiError.sessionExpired();
    if (this.guestPolicy) {
      // Exact under concurrency: starts run one after another (`guestChain`).
      if (this.guests.size >= this.guestPolicy.max) throw guestsFull();
    } else {
      await this.endAllGuests();
    }
    const language = input.language && isLocale(input.language) ? input.language : undefined;
    const createdAt = nowIso(this.now());
    const username = newGuestUsername();
    const account: AccountRecord = {
      id: newGuestAccountId(),
      username,
      usernameLower: username.toLowerCase(),
      firstName: '',
      lastName: '',
      createdAt,
      lastLoginAt: createdAt,
      // The "random password": a fresh salt and a random verifier. No password derives to it, so
      // nobody can sign in as the guest or confirm anything in its name - and no scrypt run is needed.
      kdf: { algorithm: 'scrypt', N: this.kdf.N, r: this.kdf.r, p: this.kdf.p, saltHex: newSalt().toString('hex') },
      verifierHex: randomBytes(32).toString('hex'),
      // No diary file: the vault is memory-only.
      dbFile: '',
      guest: true,
    };
    const key = randomBytes(KEY_LENGTH);
    try {
      const vault = await this.vaults.acquire(account, () => createMemoryVault(account, key));
      try {
        if (language) saveSettings(vault.db, { language });
        seedDemoData(vault.db, SEED_DEFAULT_DAYS, SEED_DEFAULT_SEED, todayIso(), language ?? DEFAULT_LOCALE);
      } catch (e) {
        await this.vaults.close(account.id, false);
        throw e;
      }
      // The server stopped while the diary was being prepared: no guest outlives a shutdown.
      if (this.stopped) {
        await this.vaults.close(account.id, false);
        throw ApiError.sessionExpired();
      }
      const { token, session } = this.sessions.create(account.id, false, normalizeDeviceName(input.deviceName, language), key, { guest: true });
      this.attached.add(session.id);
      // Hosted rule: the tour ends by itself after its lifetime (a phone's guest lives until logout).
      const timer = this.guestPolicy
        ? setTimeout(() => {
            this.endGuest(account.id).catch((e: unknown) => console.error('[diary-server] failed to end an expired tour:', (e as Error).message));
          }, this.guestPolicy.lifetimeMs)
        : null;
      timer?.unref?.();
      this.guests.set(account.id, { account, sessionId: session.id, timer });
      return { token, session, account };
    } finally {
      wipe(key);
    }
  }

  /** Forgets guest `id` (its timer included). False when `id` is not a guest. */
  private forgetGuest(id: string): boolean {
    const guest = this.guests.get(id);
    if (!guest) return false;
    if (guest.timer) clearTimeout(guest.timer);
    this.guests.delete(id);
    return true;
  }

  /**
   * Ends one tour: the guest's session, its record and its memory-only diary are dropped. There is
   * nothing to clean up on disk - nothing was ever written.
   */
  private async endGuest(id: string): Promise<void> {
    if (!this.forgetGuest(id)) return;
    for (const s of this.sessions.list(id)) this.attached.delete(s.id);
    this.sessions.removeAllForUser(id);
    await this.vaults.close(id, false);
  }

  /** Ends every tour (the local rule: before a new guest, and when a real account signs in). */
  private async endAllGuests(): Promise<void> {
    for (const id of [...this.guests.keys()]) await this.endGuest(id);
  }

  /** `endAllGuests` for the sign-in paths: a failure here must not turn a successful sign-in into an error. */
  private async endGuestQuietly(): Promise<void> {
    try {
      await this.endAllGuests();
    } catch (e) {
      console.error('[diary-server] failed to end the guest session:', (e as Error).message);
    }
  }

  async shutdown(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    // Guests die with the server: their records are forgotten, their diaries closed below (nothing is written).
    for (const id of [...this.guests.keys()]) this.forgetGuest(id);
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    if (this.evictTimer) {
      clearInterval(this.evictTimer);
      this.evictTimer = null;
    }
    this.attached.clear();
    await this.vaults.closeAll();
    this.sessions.close();
  }
}

export async function createAuthService(config: ServerConfig, opts: AuthServiceOptions = {}): Promise<DiaryAuthService> {
  fs.mkdirSync(config.usersDir, { recursive: true });
  const deviceKey = loadOrCreateDeviceKey(config.deviceKeyFile, opts.deviceKey);
  const service = new DiaryAuthService(config, deviceKey, opts);
  // Diary files of accounts deleted while their files could not be removed (see deleteAccount).
  await service.purgeDeletedDiaries();
  return service;
}
