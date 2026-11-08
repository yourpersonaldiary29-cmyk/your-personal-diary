/**
 * The `.mpd` encrypted container (ARCHITECTURE.md section 6). Used for the diary
 * database on disk and for backup files.
 *
 *   offset  size  field
 *   0       8     magic "MPDIARY\x01"
 *   8       1     version = 1
 *   9       4     scrypt N (LE u32)
 *   13      4     scrypt r (LE u32)
 *   17      4     scrypt p (LE u32)
 *   21      16    salt
 *   37      12    nonce (random per write)
 *   49      ...   AES-256-GCM ciphertext || tag (16 bytes)
 *
 * AAD = the 49 header bytes, so any change to the header (e.g. the KDF parameters)
 * makes authentication fail. The plaintext is the raw SQLite image.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ApiError } from '../errors';
import { DEFAULT_KDF, deriveSecret, isAffordableKdf, isValidKdfParams, KEY_LENGTH, SALT_LENGTH, splitSecret, type KdfParams, wipe } from './kdf';

export const CONTAINER_MAGIC = Buffer.from('MPDIARY\x01', 'latin1');
export const CONTAINER_VERSION = 1;
export const HEADER_LENGTH = 49;
export const NONCE_LENGTH = 12;
export const TAG_LENGTH = 16;
/** Smallest possible container: header + tag with an empty plaintext. */
export const MIN_CONTAINER_LENGTH = HEADER_LENGTH + TAG_LENGTH;

const OFF_VERSION = 8;
const OFF_N = 9;
const OFF_R = 13;
const OFF_P = 17;
const OFF_SALT = 21;
const OFF_NONCE = 37;

export interface ContainerHeader {
  version: number;
  kdf: KdfParams;
  salt: Buffer;
  nonce: Buffer;
}

/** Error thrown when the key does not open the container (or the ciphertext was altered). */
export function wrongContainerPassword(): ApiError {
  // 400 (not 401) on purpose: the client treats every 401 as "session lost" and logs out,
  // and a wrong backup password must not end the session.
  return ApiError.localized(400, 'WRONG_PASSWORD', 'server.crypto.wrongPasswordOrCorrupt', undefined, 'password');
}

/** Cheap structural check: magic + version + minimum length. */
export function isContainer(bytes: Uint8Array | null | undefined): boolean {
  if (!bytes || bytes.length < MIN_CONTAINER_LENGTH) return false;
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return buf.subarray(0, CONTAINER_MAGIC.length).equals(CONTAINER_MAGIC) && buf[OFF_VERSION] === CONTAINER_VERSION;
}

function asBuffer(bytes: Uint8Array): Buffer {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** Parses and validates the 49-byte header. Throws CRYPTO for anything that is not a supported container. */
export function parseHeader(bytes: Uint8Array): ContainerHeader {
  const buf = asBuffer(bytes);
  if (buf.length < MIN_CONTAINER_LENGTH) throw ApiError.crypto('server.crypto.fileTooShort');
  if (!buf.subarray(0, CONTAINER_MAGIC.length).equals(CONTAINER_MAGIC)) {
    throw ApiError.crypto('server.crypto.badMagic');
  }
  const version = buf[OFF_VERSION];
  if (version !== CONTAINER_VERSION) throw ApiError.crypto('server.crypto.unsupportedVersion', { version });
  const kdf: KdfParams = {
    N: buf.readUInt32LE(OFF_N),
    r: buf.readUInt32LE(OFF_R),
    p: buf.readUInt32LE(OFF_P),
  };
  if (!isValidKdfParams(kdf)) throw ApiError.crypto('server.crypto.unsupportedFileKdf');
  return {
    version,
    kdf,
    salt: Buffer.from(buf.subarray(OFF_SALT, OFF_SALT + SALT_LENGTH)),
    nonce: Buffer.from(buf.subarray(OFF_NONCE, OFF_NONCE + NONCE_LENGTH)),
  };
}

function buildHeader(kdf: KdfParams, salt: Buffer, nonce: Buffer): Buffer {
  const header = Buffer.alloc(HEADER_LENGTH);
  CONTAINER_MAGIC.copy(header, 0);
  header[OFF_VERSION] = CONTAINER_VERSION;
  header.writeUInt32LE(kdf.N, OFF_N);
  header.writeUInt32LE(kdf.r, OFF_R);
  header.writeUInt32LE(kdf.p, OFF_P);
  salt.copy(header, OFF_SALT);
  nonce.copy(header, OFF_NONCE);
  return header;
}

/**
 * Encrypts `plain` with `key` (32 bytes). `salt` and `kdf` are recorded in the header so the
 * key can be re-derived from a password later (`decryptWithPassword`).
 */
export function encryptContainer(plain: Uint8Array, key: Buffer, salt: Buffer, kdf: KdfParams = DEFAULT_KDF): Buffer {
  if (key.length !== KEY_LENGTH) throw ApiError.crypto('server.crypto.badKeyLength');
  if (salt.length !== SALT_LENGTH) throw ApiError.crypto('server.crypto.badSaltLength');
  if (!isValidKdfParams(kdf)) throw ApiError.crypto('server.crypto.unsupportedKdf');
  const nonce = randomBytes(NONCE_LENGTH);
  const header = buildHeader(kdf, salt, nonce);
  const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_LENGTH });
  cipher.setAAD(header);
  const body = Buffer.concat([cipher.update(asBuffer(plain)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([header, body, tag]);
}

/**
 * Decrypts with a known key. Authentication failure (wrong key or any modified byte)
 * throws CRYPTO - callers that hold the key expect the file to be intact.
 */
export function decryptContainer(bytes: Uint8Array, key: Buffer): { plain: Buffer; header: ContainerHeader } {
  const buf = asBuffer(bytes);
  const header = parseHeader(buf);
  if (key.length !== KEY_LENGTH) throw ApiError.crypto('server.crypto.badKeyLength');
  const plain = decryptBody(buf, header, key);
  if (!plain) throw ApiError.crypto('server.crypto.corruptOrWrongKey');
  return { plain, header };
}

/**
 * Derives the key from the password using the header parameters and decrypts.
 * Authentication failure throws WRONG_PASSWORD (the most likely cause when a user typed it).
 * The returned `key` is the caller's to wipe.
 */
export async function decryptWithPassword(
  bytes: Uint8Array,
  password: string,
): Promise<{ plain: Buffer; key: Buffer; header: ContainerHeader }> {
  const buf = asBuffer(bytes);
  const header = parseHeader(buf);
  // The parameters come from the file (a backup, possibly made by someone else): refuse a cost the
  // app never writes before spending it (see MAX_UNTRUSTED_KDF_COST).
  // 400 BACKUP (the user's file), not 500 CRYPTO.
  if (!isAffordableKdf(header.kdf)) throw ApiError.backup('server.crypto.unsupportedFileKdf');
  const secret = await deriveSecret(password, header.salt, header.kdf);
  const { key, verifierSource } = splitSecret(secret);
  wipe(secret);
  wipe(verifierSource);
  const plain = decryptBody(buf, header, key);
  if (!plain) {
    wipe(key);
    throw wrongContainerPassword();
  }
  return { plain, key, header };
}

/** Returns the plaintext or null when the auth tag does not verify. Never throws for bad data. */
function decryptBody(buf: Buffer, header: ContainerHeader, key: Buffer): Buffer | null {
  const headerBytes = buf.subarray(0, HEADER_LENGTH);
  const body = buf.subarray(HEADER_LENGTH, buf.length - TAG_LENGTH);
  const tag = buf.subarray(buf.length - TAG_LENGTH);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, header.nonce, { authTagLength: TAG_LENGTH });
    decipher.setAAD(headerBytes);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    return null;
  }
}
