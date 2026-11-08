/**
 * Device key: 32 random bytes stored in `<dataDir>/device.key`, created on first use.
 *
 * It wraps the diary key of "remember me" sessions (sessions.json) so that automatic
 * login after a restart works only on the computer that holds this file. It is not a
 * password replacement: whoever can read device.key AND sessions.json can open the
 * diary, which is the accepted trade-off of "remember me" (documented in ARCHITECTURE.md).
 *
 * It also wraps the recovery copy of every account's diary key (AccountRecord.recoveryWrappedKey,
 * password reset by e-mail): same exposure - whoever can read device.key AND accounts.json can
 * open the diaries; a copied .mpd file alone still cannot be read.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ApiError } from '../errors';
import { KEY_LENGTH } from './kdf';

export const DEVICE_KEY_LENGTH = 32;
const WRAP_NONCE_LENGTH = 12;
const WRAP_TAG_LENGTH = 16;
/** Domain separation so a wrapped blob cannot be confused with any other AES-GCM use. */
const WRAP_AAD = Buffer.from('mpd-remember-me-key-v1', 'utf8');
/** nonce || ciphertext(32) || tag */
export const WRAPPED_KEY_LENGTH = WRAP_NONCE_LENGTH + KEY_LENGTH + WRAP_TAG_LENGTH;

/**
 * Reads the device key, creating it (atomically, owner-only permissions) when missing or invalid.
 * With `override` (hosted mode, `DIARY_DEVICE_KEY` - docs/HOSTED-PLAN.md 3.2) the file is never
 * read or written: the key is the sealed platform secret, exactly 32 bytes, and a copy of the data
 * volume alone opens nothing.
 */
export function loadOrCreateDeviceKey(file: string, override?: Buffer): Buffer {
  if (override) {
    if (override.length !== DEVICE_KEY_LENGTH) throw ApiError.crypto('server.crypto.badDeviceKeyLength');
    return Buffer.from(override);
  }
  try {
    const existing = fs.readFileSync(file);
    if (existing.length === DEVICE_KEY_LENGTH) return Buffer.from(existing);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw ApiError.io('server.crypto.deviceKeyUnreadable');
  }
  const key = randomBytes(DEVICE_KEY_LENGTH);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, key, { mode: 0o600 });
    fs.renameSync(tmp, file);
  } catch {
    throw ApiError.io('server.crypto.deviceKeyUncreatable');
  }
  return key;
}

/** AES-256-GCM wrap of a 32-byte diary key. Output is `WRAPPED_KEY_LENGTH` bytes. `aad` separates the uses. */
export function wrapKey(key: Buffer, deviceKey: Buffer, aad: Buffer = WRAP_AAD): Buffer {
  if (key.length !== KEY_LENGTH) throw ApiError.crypto('server.crypto.badWrapKeyLength');
  if (deviceKey.length !== DEVICE_KEY_LENGTH) throw ApiError.crypto('server.crypto.badDeviceKeyLength');
  const nonce = randomBytes(WRAP_NONCE_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', deviceKey, nonce, { authTagLength: WRAP_TAG_LENGTH });
  cipher.setAAD(aad);
  const body = Buffer.concat([cipher.update(key), cipher.final()]);
  return Buffer.concat([nonce, body, cipher.getAuthTag()]);
}

/** Inverse of `wrapKey`. Throws CRYPTO when the blob was not produced with this device key (and `aad`). */
export function unwrapKey(blob: Buffer, deviceKey: Buffer, aad: Buffer = WRAP_AAD): Buffer {
  if (deviceKey.length !== DEVICE_KEY_LENGTH) throw ApiError.crypto('server.crypto.badDeviceKeyLength');
  if (blob.length !== WRAPPED_KEY_LENGTH) throw ApiError.crypto('server.crypto.badWrappedKey');
  const nonce = blob.subarray(0, WRAP_NONCE_LENGTH);
  const body = blob.subarray(WRAP_NONCE_LENGTH, WRAP_NONCE_LENGTH + KEY_LENGTH);
  const tag = blob.subarray(WRAP_NONCE_LENGTH + KEY_LENGTH);
  try {
    const decipher = createDecipheriv('aes-256-gcm', deviceKey, nonce, { authTagLength: WRAP_TAG_LENGTH });
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    throw ApiError.crypto('server.crypto.unwrapFailed');
  }
}

// Recovery key escrow (password reset by e-mail, ARCHITECTURE.md section 5) ------------------------

/**
 * AAD of the recovery copy of a diary key: its own domain AND the account id, so a recovery blob
 * can neither be confused with a remember-me blob nor be moved to another account.
 */
function recoveryAad(accountId: string): Buffer {
  return Buffer.from(`mpd-recovery-key-v1:${accountId}`, 'utf8');
}

/** The diary key of `accountId` wrapped with the device key, as stored in AccountRecord.recoveryWrappedKey (base64). */
export function wrapRecoveryKey(key: Buffer, deviceKey: Buffer, accountId: string): string {
  return wrapKey(key, deviceKey, recoveryAad(accountId)).toString('base64');
}

/** Inverse of `wrapRecoveryKey`. Throws CRYPTO when the blob is damaged, from another device key or of another account. */
export function unwrapRecoveryKey(blobBase64: string, deviceKey: Buffer, accountId: string): Buffer {
  return unwrapKey(Buffer.from(blobBase64, 'base64'), deviceKey, recoveryAad(accountId));
}

/**
 * True when `blobBase64` has the shape of a recovery blob (`wrapRecoveryKey`: canonical base64 of
 * WRAPPED_KEY_LENGTH bytes) - checked WITHOUT the device key, so nothing is decrypted and the diary
 * key never reaches memory. A forgot-password request uses this (docs/android-tasks/
 * PRIVACY-HARDENING.md item 1: a request must not decrypt anything of a signed-out user); whether
 * the blob really opens with this device key is found out by the reset itself.
 */
export function hasRecoveryKeyShape(blobBase64: unknown): boolean {
  if (typeof blobBase64 !== 'string' || !blobBase64) return false;
  const bytes = Buffer.from(blobBase64, 'base64');
  return bytes.length === WRAPPED_KEY_LENGTH && bytes.toString('base64') === blobBase64;
}
