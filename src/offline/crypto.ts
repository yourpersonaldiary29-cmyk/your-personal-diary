/**
 * Encryption of everything the offline engine keeps on the device (OFFLINE-DESIGN.md section 5.2).
 *
 *  - Keys: from the account offline key (AOK, 32 bytes held by the server, section 5.1)
 *      enc = HKDF-SHA256(AOK, salt "ypd-offline-v1", info "enc|" + userId) -> AES-GCM-256, non-extractable;
 *      mac = HKDF-SHA256(AOK, salt "ypd-offline-v1", info "mac|" + userId) -> HMAC-SHA256, non-extractable
 *    (cache keys, chain tags, class tags).
 *  - Each value: JSON -> UTF-8 -> AES-GCM with a random 12-byte IV and the AAD
 *    "ypd-offline-v1|<userId>|<store>|<recordKey>". A blob moved to another account, store or slot does
 *    not decrypt. Stored as IV || ciphertext.
 *  - keyCheck: the encryption of a fixed text; when it does not decrypt, the engine never writes.
 *
 * Web Crypto only: without `crypto.subtle` (an insecure context) offline mode stays off.
 */

export const OFFLINE_SALT = 'ypd-offline-v1';
export const KEY_CHECK_TEXT = 'ypd-offline-v1 key check';
const IV_BYTES = 12;

export interface DerivedKeys {
  readonly userId: string;
  readonly enc: CryptoKey;
  readonly mac: CryptoKey;
}

/** The Web Crypto API, or null (insecure context, very old WebView). */
export function subtle(): SubtleCrypto | null {
  try {
    return globalThis.crypto?.subtle ?? null;
  } catch {
    return null;
  }
}

/** True when this context can run the offline engine's cryptography. */
export function cryptoAvailable(): boolean {
  const secure = typeof window === 'undefined' || window.isSecureContext !== false;
  return secure && !!subtle() && typeof globalThis.crypto?.getRandomValues === 'function';
}

function requireSubtle(): SubtleCrypto {
  const s = subtle();
  if (!s) throw new Error('Web Crypto is not available');
  return s;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** UTF-8 bytes (a fresh ArrayBuffer-backed view, as Web Crypto wants). */
export function utf8(text: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(encoder.encode(text));
}

/**
 * True for a byte view. Never `instanceof Uint8Array`: a value that went through `structuredClone`
 * (IndexedDB) may come from another realm (as it does under jsdom in the tests), where that check fails.
 */
export function isBytes(x: unknown): x is Uint8Array {
  return ArrayBuffer.isView(x) && !(x instanceof DataView);
}

/** A copy backed by its own ArrayBuffer (also normalises a view from another realm). */
export function ownBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const view = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Uint8Array(view.byteLength);
  out.set(view);
  return out;
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/** A random UUID (opId / clientId), RFC 4122 v4. */
export function randomUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Overwrites key material that is no longer needed. */
export function zero(bytes: Uint8Array | null | undefined): void {
  if (bytes) bytes.fill(0);
}

/** SHA-256 hex of a text (the session binding's token tag). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await requireSubtle().digest('SHA-256', utf8(text));
  return toHex(new Uint8Array(digest));
}

/** Derives the account's encryption and MAC keys from the AOK. The caller zeroes `aok` afterwards. */
export async function deriveKeys(aok: Uint8Array, userId: string): Promise<DerivedKeys> {
  if (aok.byteLength !== 32) throw new Error('offline key: 32 bytes expected');
  const s = requireSubtle();
  const base = await s.importKey('raw', ownBytes(aok), 'HKDF', false, ['deriveKey']);
  const params = (info: string): HkdfParams => ({ name: 'HKDF', hash: 'SHA-256', salt: utf8(OFFLINE_SALT), info: utf8(info) });
  const enc = await s.deriveKey(params(`enc|${userId}`), base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const mac = await s.deriveKey(params(`mac|${userId}`), base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
  return { userId, enc, mac };
}

function aad(keys: DerivedKeys, store: string, recordKey: string | number): Uint8Array<ArrayBuffer> {
  return utf8(`${OFFLINE_SALT}|${keys.userId}|${store}|${String(recordKey)}`);
}

/** Encrypts `value` (JSON) for one record slot: IV || AES-GCM(ciphertext + tag). */
export async function encryptValue(keys: DerivedKeys, store: string, recordKey: string | number, value: unknown): Promise<Uint8Array<ArrayBuffer>> {
  const iv = randomBytes(IV_BYTES);
  const plain = utf8(JSON.stringify(value));
  const ct = new Uint8Array(
    await requireSubtle().encrypt({ name: 'AES-GCM', iv, additionalData: aad(keys, store, recordKey) }, keys.enc, plain),
  );
  const out = new Uint8Array(IV_BYTES + ct.byteLength);
  out.set(iv, 0);
  out.set(ct, IV_BYTES);
  return out;
}

/** Decrypts a blob of `encryptValue` for the same account, store and record key (rejects otherwise). */
export async function decryptValue<T>(keys: DerivedKeys, store: string, recordKey: string | number, blob: Uint8Array): Promise<T> {
  if (!isBytes(blob) || blob.byteLength <= IV_BYTES) throw new Error('offline blob: too short');
  const bytes = ownBytes(blob);
  const plain = await requireSubtle().decrypt(
    { name: 'AES-GCM', iv: bytes.subarray(0, IV_BYTES), additionalData: aad(keys, store, recordKey) },
    keys.enc,
    bytes.subarray(IV_BYTES),
  );
  return JSON.parse(decoder.decode(plain)) as T;
}

/** HMAC-SHA256 of a text with the account's MAC key, hex (cache keys, chain tags). */
export async function hmacHex(keys: DerivedKeys, text: string): Promise<string> {
  const sig = await requireSubtle().sign('HMAC', keys.mac, utf8(text));
  return toHex(new Uint8Array(sig));
}

/** The `meta.keyCheck` blob. */
export function makeKeyCheck(keys: DerivedKeys): Promise<Uint8Array<ArrayBuffer>> {
  return encryptValue(keys, 'meta', 'keyCheck', KEY_CHECK_TEXT);
}

/** True when `blob` is this account's key check (the AOK in hand is the one the data was written with). */
export async function verifyKeyCheck(keys: DerivedKeys, blob: unknown): Promise<boolean> {
  if (!isBytes(blob)) return false;
  try {
    return (await decryptValue<string>(keys, 'meta', 'keyCheck', blob)) === KEY_CHECK_TEXT;
  } catch {
    return false;
  }
}
