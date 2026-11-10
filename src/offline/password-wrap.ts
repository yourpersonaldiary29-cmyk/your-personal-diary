/**
 * Offline unlock by PASSWORD (owner decision 2026-11-08; docs/android-tasks/OFFLINE-DESIGN.md
 * section 13 "offline unlock by password"). Without a connection only the server could check the
 * password, so the lock screen offered only the device's own user check. Now the engine also keeps a
 * "password wrap": the account offline key (AOK, section 5.1) encrypted under a key derived from the
 * password with scrypt. Typing the right password offline opens the wrap, and the AOK that comes out
 * must derive the keys that decrypt `meta.keyCheck` - that is the proof.
 *
 * Format (`PasswordWrap`, JSON): v 1, scrypt with the SERVER's parameters (server/src/security/kdf.ts
 * DEFAULT_KDF: N 2^15, r 8, p 1), a random 16-byte salt, a random 12-byte GCM nonce, and
 * ct = AES-256-GCM(key = scrypt(password, salt) 32 bytes, plaintext = AOK, AAD = 'ypd-offline-pw-v1:' + userId).
 * The same cost as the server's verifier means an attacker with a copy of the device data gains nothing
 * over one who copied the server's accounts file: a weak password is the risk either way.
 *
 * Where it lives: in the engine's memory for the run (every session), and in `meta.passwordWrap` ONLY
 * when the engine is persistent (an app with "Remember me") - with exactly the lifecycle of
 * `meta.wrappedKey` (src/offline/keys.ts, engine.ts purge paths). The password itself is never kept.
 *
 * The password is NFKC-normalised exactly as the server does before scrypt (kdf.ts `deriveSecret`), so
 * the set of strings the wrap accepts is the set the server accepts - a full-width digit typed through a
 * Japanese IME unlocks offline just as it does online. Nothing else is trimmed or changed.
 *
 * Measured on the development PC (Node 24, @noble/hashes 2.4.0 scryptAsync, under vitest with other
 * suites running): about 240 ms per derivation at N=2^15 (password-wrap.test.ts prints the figure:
 * "password wrap: scrypt took N ms"). A wrong password costs the same as the right one. The async
 * variant yields to the event loop every ~10 ms so the lock screen stays responsive.
 */
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { fromBase64, ownBytes, randomBytes, subtle, toBase64, utf8, zero } from './crypto';

export const PASSWORD_WRAP_VERSION = 1;
/** scrypt parameters: the same as the server's (server/src/security/kdf.ts DEFAULT_KDF). */
export const PASSWORD_WRAP_KDF = { N: 32768, r: 8, p: 1 } as const;
export const PASSWORD_WRAP_AAD_PREFIX = 'ypd-offline-pw-v1:';
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const KEY_BYTES = 32;
const AOK_BYTES = 32;

export interface PasswordWrap {
  v: 1;
  kdf: 'scrypt';
  N: number;
  r: number;
  p: number;
  /** base64 of 16 random bytes */
  salt: string;
  /** base64 of 12 random bytes (the AES-GCM nonce; fresh for every wrap) */
  nonce: string;
  /** base64 of AES-256-GCM(ciphertext || tag) of the AOK */
  ct: string;
}

/**
 * True for a wrap this build can open: the recorded parameters must be exactly the ones it writes.
 * A row edited to ask for a huge N would otherwise cost gigabytes of memory on the device.
 */
export function isPasswordWrap(x: unknown): x is PasswordWrap {
  if (!x || typeof x !== 'object') return false;
  const w = x as Record<string, unknown>;
  return (
    w.v === PASSWORD_WRAP_VERSION &&
    w.kdf === 'scrypt' &&
    w.N === PASSWORD_WRAP_KDF.N &&
    w.r === PASSWORD_WRAP_KDF.r &&
    w.p === PASSWORD_WRAP_KDF.p &&
    typeof w.salt === 'string' &&
    typeof w.nonce === 'string' &&
    typeof w.ct === 'string'
  );
}

function requireSubtle(): SubtleCrypto {
  const s = subtle();
  if (!s) throw new Error('Web Crypto is not available');
  return s;
}

/** AES-GCM key from the password and the salt; the password bytes and the derived bytes are zeroed before it returns. */
async function passwordKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const pw = utf8(password.normalize('NFKC'));
  let derived: Uint8Array | null = null;
  try {
    derived = await scryptAsync(pw, ownBytes(salt), { ...PASSWORD_WRAP_KDF, dkLen: KEY_BYTES });
    return await requireSubtle().importKey('raw', ownBytes(derived), 'AES-GCM', false, ['encrypt', 'decrypt']);
  } finally {
    zero(pw);
    zero(derived);
  }
}

function aad(userId: string): Uint8Array<ArrayBuffer> {
  return utf8(PASSWORD_WRAP_AAD_PREFIX + userId);
}

/** Wraps the AOK under the password for `userId`. The caller still owns (and zeroes) `aok`. */
export async function makePasswordWrap(password: string, aok: Uint8Array, userId: string): Promise<PasswordWrap> {
  if (aok.byteLength !== AOK_BYTES) throw new Error('password wrap: 32-byte key expected');
  if (!password) throw new Error('password wrap: empty password');
  const salt = randomBytes(SALT_BYTES);
  const nonce = randomBytes(NONCE_BYTES);
  const key = await passwordKey(password, salt);
  const ct = new Uint8Array(await requireSubtle().encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad(userId) }, key, ownBytes(aok)));
  return { v: PASSWORD_WRAP_VERSION, kdf: 'scrypt', ...PASSWORD_WRAP_KDF, salt: toBase64(salt), nonce: toBase64(nonce), ct: toBase64(ct) };
}

/**
 * The AOK bytes behind `wrap` for `password` and `userId`, or null: a wrong password, another account,
 * a tampered row, an unknown format - every failure answers null, nothing throws. A wrong password
 * costs the full scrypt derivation, the same as the right one. The caller zeroes the result.
 */
export async function openPasswordWrap(password: string, wrap: unknown, userId: string): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!isPasswordWrap(wrap) || !password) return null;
  try {
    const salt = fromBase64(wrap.salt);
    const nonce = fromBase64(wrap.nonce);
    if (salt.byteLength !== SALT_BYTES || nonce.byteLength !== NONCE_BYTES) return null;
    const key = await passwordKey(password, salt);
    const plain = new Uint8Array(await requireSubtle().decrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad(userId) }, key, fromBase64(wrap.ct)));
    if (plain.byteLength !== AOK_BYTES) {
      zero(plain);
      return null;
    }
    return plain;
  } catch {
    return null;
  }
}

// Throttle (target 3 of the package): the first three wrong passwords offline cost nothing but the
// derivation; from the third on, the next attempt must wait 2 s, 4 s, 8 s ... capped at 60 s. The
// counter lives in the engine for the run, mirrored in sessionStorage so that a reload of the page
// (F5 in the app's WebView) in the same run does not reset it; a restart of the app does - the
// derivation cost, not this counter, is the real defence against guessing.

export const PASSWORD_UNLOCK_FREE_ATTEMPTS = 3;
export const PASSWORD_UNLOCK_MAX_WAIT_MS = 60_000;
const THROTTLE_KEY_PREFIX = 'ypd-offline-pw-throttle:';

/** The wait imposed after the n-th wrong password: 0 for the first three, then 2 s, 4 s, 8 s ... capped at 60 s. */
export function passwordUnlockWaitMs(failures: number): number {
  if (failures < PASSWORD_UNLOCK_FREE_ATTEMPTS) return 0;
  return Math.min(PASSWORD_UNLOCK_MAX_WAIT_MS, 2 ** (failures - PASSWORD_UNLOCK_FREE_ATTEMPTS + 1) * 1000);
}

export interface PasswordThrottleState {
  failures: number;
  /** Epoch ms before which the next attempt is refused (0: none). */
  notBefore: number;
}

function sessionStore(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function readPasswordThrottle(userId: string): PasswordThrottleState {
  try {
    const raw = sessionStore()?.getItem(THROTTLE_KEY_PREFIX + userId);
    if (!raw) return { failures: 0, notBefore: 0 };
    const parsed = JSON.parse(raw) as Partial<PasswordThrottleState>;
    const failures = typeof parsed.failures === 'number' && parsed.failures >= 0 ? Math.floor(parsed.failures) : 0;
    const notBefore = typeof parsed.notBefore === 'number' ? parsed.notBefore : 0;
    return { failures, notBefore };
  } catch {
    return { failures: 0, notBefore: 0 };
  }
}

export function writePasswordThrottle(userId: string, state: PasswordThrottleState): void {
  try {
    const store = sessionStore();
    if (!store) return;
    if (state.failures === 0) store.removeItem(THROTTLE_KEY_PREFIX + userId);
    else store.setItem(THROTTLE_KEY_PREFIX + userId, JSON.stringify(state));
  } catch {
    /* no sessionStorage: the counter lives in memory only */
  }
}
