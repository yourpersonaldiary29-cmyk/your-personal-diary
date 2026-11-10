/**
 * Contracts of the account / session layer. The implementation lives in
 * `security/accounts.ts`, `security/sessions.ts` and `security/vault.ts`.
 * Route handlers only depend on these interfaces (attached to `req` by the auth middleware).
 */
import type { Locale } from '@shared/i18n/locales';
import type { SessionInfo, UserProfile } from '@shared/types';
import type { DiaryDb } from '../db/database';

/** Registry record of an account (persisted in accounts.json). Never contains the key or password. */
export interface AccountRecord {
  id: string;
  username: string;
  /** Lower-cased username for uniqueness checks. */
  usernameLower: string;
  firstName: string;
  lastName: string;
  /** E-mail given at registration (local only). Absent on records written before the field existed. */
  email?: string;
  /** Lower-cased e-mail for uniqueness / login-by-e-mail lookups. */
  emailLower?: string;
  createdAt: string;
  /**
   * When this account last signed in on this computer (registration counts as the first sign-in).
   * Kept in the registry so the login screen can offer the right name even after a restart, when
   * no session survived and the browser storage was cleared. Absent on records written before
   * this field existed.
   */
  lastLoginAt?: string;
  /** scrypt parameters used to derive the 64-byte secret from the password. */
  kdf: { algorithm: 'scrypt'; N: number; r: number; p: number; saltHex: string };
  /** hex(sha256(secret[32..64])) - verifier of the password (the first 32 bytes are the DB key). */
  verifierHex: string;
  /** File name of the encrypted diary DB inside `usersDir`. */
  dbFile: string;
  /**
   * Recovery key escrow for password reset by e-mail: the 32-byte diary key wrapped (AES-256-GCM)
   * with the device key (device.key), AAD bound to this account id - base64. Created at
   * registration, ensured at every login and remember-me vault opening, re-wrapped after a password
   * change or reset. Absent on accounts that have not signed in since the feature existed (they
   * cannot reset by e-mail until their next sign-in). Never sent to a client.
   */
  recoveryWrappedKey?: string;
  /**
   * The e-mail address the account had before its latest e-mail change, and when that change
   * happened. A "your password was changed" notice after a password reset also goes to this
   * address for a while (EMAIL_CHANGE_NOTICE_WINDOW_MS), so whoever changed the address cannot
   * take the account over without its previous owner hearing about it. Never sent to a client.
   */
  previousEmail?: string;
  emailChangedAt?: string;
  /**
   * UI language of the account - a copy of its diary's `settings.language`, kept here so that the
   * password-reset e-mail and the security notices are written in it without opening the diary
   * (docs/android-tasks/PRIVACY-HARDENING.md item 1). Written at registration, at every sign-in or
   * reopening of the diary, and after every save of the diary whose language differs from it.
   * Absent on records written before the field existed (until the next sign-in): the e-mail paths
   * then use the request language, else English - they never open the diary for it.
   */
  language?: Locale;
  /**
   * The record of the privacy checkbox (docs/android-tasks/PRIVACY-CHECKBOX.md): when the new user
   * ticked "I have read the Privacy policy and agree to it" (ISO time - the moment the account was
   * created) and the version of the policy then published (its effective date, `PRIVACY_POLICY_VERSION`
   * of shared/legal.ts, e.g. '2026-10-28'). Both or neither. Written only by the hosted server, which
   * requires the tick (routes/auth.ts). Absent on accounts created before the checkbox existed - they
   * are not asked again - and on accounts of the local developer mode. Never sent to a client.
   */
  privacyAcceptedAt?: string;
  privacyVersion?: string;
  /**
   * The record of the Terms of Use (docs/apple-tasks/TERMS.md), confirmed with the same checkbox as the policy:
   * when (= createdAt) and the version then published (its effective date, `TERMS_VERSION` of shared/legal.ts).
   * Both or neither, written only by the hosted server. Absent on accounts created before the Terms of Use
   * existed - they are not asked again - and on accounts of the local developer mode. Never sent to a client.
   */
  termsAcceptedAt?: string;
  termsVersion?: string;
  /**
   * True for the temporary guest account of the tour mode (security/guest.ts). A guest record lives
   * in memory only - it is never written to accounts.json, never listed, and never the owner.
   */
  guest?: true;
}

/**
 * An open, decrypted diary of one account, shared by every session of that user.
 * Created on first login, closed when the last session ends. Holds the DB key in memory only.
 */
export interface UserVault {
  readonly userId: string;
  /** Absolute path of the encrypted database file (users/<id>.mpd); empty for a memory-only vault (guest). */
  readonly dbPath: string;
  /** True for a vault that never touches the disk (the guest account of the tour mode). */
  readonly memoryOnly?: boolean;
  /**
   * True once the vault was closed (last session ended, idle eviction, account deletion): a
   * `persist()` then writes nothing. The offline sync route checks it after its persist (a 503,
   * never a 200 for a change that may not be on disk). Optional: test fakes leave it out.
   */
  readonly isClosed?: boolean;
  readonly db: DiaryDb;
  /** Persist the in-memory DB to disk as an encrypted container (atomic). */
  persist(): Promise<void>;
  /** Re-encrypt with a new key (password change). */
  rekey(newKey: Buffer): Promise<void>;
  /** Raw 32-byte DB key (used for backup/restore and remember-me wrapping). */
  getKey(): Buffer;
  /** Replace the whole DB image (restore) and persist. */
  replaceDatabase(newDb: DiaryDb): Promise<void>;
  /** Number of live sessions. */
  refCount: number;
  close(): Promise<void>;
}

export interface Session {
  id: string;
  /** Only the sha256 of the bearer token is stored server-side. */
  tokenHash: string;
  userId: string;
  deviceName: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  rememberMe: boolean;
  /** Reminders already notified in this session today: `${habitId}:${date}`. */
  notified: Set<string>;
  /**
   * Locked by the lock screen (Ctrl+L / auto-lock): the session keeps existing, but every data route
   * answers 423 LOCKED until the password is entered again (POST /api/auth/verify-password).
   * Survives a page reload and, for remember-me sessions, a restart.
   */
  locked?: boolean;
  /** True for the session of the guest account (tour mode): never remembered, never written to disk. */
  guest?: boolean;
}

/** What the auth middleware attaches to the request. */
export interface AuthContext {
  session: Session;
  account: AccountRecord;
  user: UserProfile;
  vault: UserVault;
  db: DiaryDb;
}

export function toUserProfile(a: AccountRecord): UserProfile {
  return {
    id: a.id,
    username: a.username,
    firstName: a.firstName,
    lastName: a.lastName,
    email: a.email ?? '',
    createdAt: a.createdAt,
    ...(a.guest ? { guest: true } : {}),
  };
}

/**
 * What the local login screen may know about an account (GET /api/auth/accounts):
 * display names only - no id, no KDF parameters, no salt, no verifier, no file name.
 */
export interface AccountSummary {
  username: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  /** ISO time of the last sign-in on this computer; null for accounts that never recorded one. */
  lastLoginAt: string | null;
}

export function toAccountSummary(a: AccountRecord): AccountSummary {
  return { username: a.username, firstName: a.firstName, lastName: a.lastName, createdAt: a.createdAt, lastLoginAt: a.lastLoginAt ?? null };
}

/**
 * Body of `PUT /api/auth/profile` (docs/API.md "חשבונות והתחברות"): only the given fields
 * change. Names are validated like at registration (1-50 characters), the e-mail by shape
 * (max 254) and uniqueness among the local accounts (case-insensitive, 409 with field 'email').
 */
export interface ProfilePatch {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export function toSessionInfo(s: Session, currentId: string): SessionInfo {
  return {
    id: s.id,
    deviceName: s.deviceName,
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    rememberMe: s.rememberMe,
    current: s.id === currentId,
    ...(s.locked ? { locked: true } : {}),
    ...(s.guest ? { guest: true } : {}),
  };
}

/** The service used by the auth middleware and the auth routes. Implemented in `security/auth-service.ts`. */
export interface AuthService {
  register(input: {
    firstName: string;
    lastName: string;
    username: string;
    password: string;
    rememberMe: boolean;
    deviceName: string;
    /** UI language the new account starts with. */
    language?: Locale;
  }): Promise<{ token: string; session: Session; account: AccountRecord }>;
  login(
    input: {
      username: string;
      password: string;
      rememberMe: boolean;
      deviceName: string;
    },
    /** fromNetwork: the request did not come from this computer (separate sign-in lockout counter). */
    opts?: { fromNetwork?: boolean },
  ): Promise<{ token: string; session: Session; account: AccountRecord }>;
  /** Resolves a bearer token to an auth context (touches lastSeenAt). Returns null when unknown/expired. */
  authenticate(token: string): Promise<AuthContext | null>;
  logout(sessionId: string): Promise<void>;
  verifyPassword(account: AccountRecord, password: string): Promise<boolean>;
  /** Locks / unlocks a session (lock screen, see Session.locked). False when the session is gone. */
  setSessionLocked(sessionId: string, locked: boolean): boolean;
  changePassword(ctx: AuthContext, oldPassword: string, newPassword: string): Promise<void>;
  /**
   * Changes the display names and/or the e-mail address of the signed-in account and persists
   * the registry (accounts.json). Returns the updated record; `ctx.account` and `ctx.user` are
   * updated in place so the rest of the request sees the new values. A change of the e-mail
   * address (the address password-reset e-mails go to) needs `currentPassword`: 400 VALIDATION
   * 'currentPassword' when it is missing, 400 WRONG_PASSWORD when it is wrong.
   */
  updateProfile(ctx: AuthContext, patch: ProfilePatch, currentPassword?: string): Promise<AccountRecord>;
  listSessions(userId: string): Session[];
  /**
   * Every registered account (copies), for the local login screen: the account that was signed in
   * or active most recently first (the later of its persisted `lastLoginAt` and the `lastSeenAt` of
   * its live sessions), accounts that never signed in last, ties by createdAt (oldest first). The
   * records still carry the KDF data and verifier - map them through `toAccountSummary` before
   * sending anything to a client.
   */
  listAccounts(): AccountRecord[];
  revokeSession(userId: string, sessionId: string): Promise<boolean>;
  deleteAccount(ctx: AuthContext, password: string): Promise<void>;
  /**
   * Starts the tour mode: a temporary guest account with demo data that lives in memory only
   * (security/guest.ts). Optional - only the real service implements it, and only apps built with
   * `guestAllowed` (the mobile core) mount the route that calls it.
   */
  startGuest?(input: { deviceName: string; language?: Locale }): Promise<{ token: string; session: Session; account: AccountRecord }>;
  /** Close all vaults and persist sessions (server shutdown). */
  shutdown(): Promise<void>;
}

declare global {
  namespace Express {
    interface Request {
      /** Present after `requireAuth`. */
      auth?: AuthContext;
      /** True when the request came over the loopback interface. */
      isLocal?: boolean;
      /**
       * UI language of the request (middleware/locale.ts): Accept-Language header,
       * else the account's settings.language (after `requireAuth`), else 'en'.
       */
      locale?: Locale;
    }
  }
}
