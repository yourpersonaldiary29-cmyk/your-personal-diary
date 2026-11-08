/**
 * `node:crypto` of the Android core: the subset server/src uses, with the same inputs, outputs
 * and errors as Node - byte for byte, which mobile/test/compat proves against the real module.
 *
 *   scrypt / scryptSync          @noble/hashes (RFC 7914); the async form yields to the event loop
 *                                through a timer (the host's `scheduler` is hidden meanwhile)
 *   createCipheriv / Decipheriv  AES-GCM through @noble/ciphers, behind Node's streaming facade
 *   createHash('sha256')         @noble/hashes
 *   randomBytes / randomInt      crypto.getRandomValues (randomInt by rejection sampling, like Node)
 *   timingSafeEqual              constant time, throws on a length mismatch like Node
 *
 * Differences from Node, none of which the server code can observe:
 *  - a cipher BUFFERS what `update()` receives and returns everything from `final()` (Node returns
 *    the bytes from `update()`); `Buffer.concat([c.update(x), c.final()])` is identical. A decipher
 *    therefore never hands out unauthenticated plaintext.
 *  - only AES-GCM with a 16-byte tag and a nonce of at least 8 bytes, only SHA-256.
 *  - the key-pair / certificate functions used by remote access (createPrivateKey, sign, ...) are
 *    stubs that throw "not available on mobile" when called.
 * Buffers returned here are instances of the polyfill (./buffer), like every Buffer in the core.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { scrypt as nobleScrypt, scryptAsync as nobleScryptAsync } from '@noble/hashes/scrypt.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { Buffer, bufferOver } from './buffer';
import { stubClass, stubFunction } from './unavailable';

/** What Node accepts as data: a string (encoded as given, UTF-8 by default) or any view / ArrayBuffer. */
export type BinaryLike = string | ArrayBufferView | ArrayBuffer;

type ErrorCtor = new (message: string) => Error;

/** An error carrying Node's `code`. */
function nodeError(Ctor: ErrorCtor, code: string, message: string): Error & { code: string } {
  const error = new Ctor(message) as Error & { code: string };
  error.code = code;
  return error;
}

function received(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'function') return `function ${value.name}`;
  if (typeof value === 'object') return `an instance of ${(value as object).constructor?.name ?? 'Object'}`;
  return `type ${typeof value} (${String(value)})`;
}

function invalidArgType(name: string, expected: string, value: unknown): Error {
  return nodeError(TypeError, 'ERR_INVALID_ARG_TYPE', `The "${name}" argument must be ${expected}. Received ${received(value)}`);
}

function outOfRange(name: string, range: string, value: unknown): Error {
  return nodeError(RangeError, 'ERR_OUT_OF_RANGE', `The value of "${name}" is out of range. It must be ${range}. Received ${String(value)}`);
}

function invalidState(operation: string): Error {
  return nodeError(Error, 'ERR_CRYPTO_INVALID_STATE', `Invalid state for operation ${operation}`);
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  if (value instanceof ArrayBuffer) return true;
  return typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer;
}

/** The bytes of `data` as a plain Uint8Array over the same memory (strings are encoded). */
function bytesOf(data: unknown, name: string, encoding?: string): Uint8Array {
  if (typeof data === 'string') {
    const buf = Buffer.from(data, (encoding ?? 'utf8') as BufferEncoding);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (isArrayBuffer(data)) return new Uint8Array(data);
  throw invalidArgType(name, 'of type string or an instance of ArrayBuffer, Buffer, TypedArray, or DataView', data);
}

/**
 * The bytes of the input of `hash.update()` / `cipher.update()`. Like Node, a hex string of odd
 * length is refused there (Buffer.from would silently drop its last digit).
 */
function inputBytes(data: unknown, encoding: string | undefined): Uint8Array {
  if (typeof data === 'string' && typeof encoding === 'string' && encoding.toLowerCase() === 'hex' && data.length % 2 !== 0) {
    throw nodeError(TypeError, 'ERR_INVALID_ARG_VALUE', `The argument 'encoding' is invalid for data of length ${data.length}. Received '${encoding}'`);
  }
  return bytesOf(data, 'data', encoding);
}

/** Like `bytesOf`, for arguments that may not be strings. */
function viewOf(data: unknown, name: string): Uint8Array {
  if (typeof data === 'string') throw invalidArgType(name, 'an instance of ArrayBuffer, Buffer, TypedArray, or DataView', data);
  return bytesOf(data, name);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** `bytes` as a Buffer, or as a string when an output encoding was asked for ('buffer' = a Buffer). */
function encoded(bytes: Uint8Array, encoding: string | undefined): Buffer | string {
  const buf = bufferOver(bytes);
  if (encoding === undefined || encoding === 'buffer') return buf;
  return buf.toString(encoding as BufferEncoding);
}

// Random ------------------------------------------------------------------------------------

interface RandomSource {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}

function randomSource(): RandomSource {
  const source = (globalThis as { crypto?: Partial<RandomSource> }).crypto;
  if (!source || typeof source.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues is not available: the diary core needs a secure random source');
  }
  return source as RandomSource;
}

/** getRandomValues accepts at most 65536 bytes per call. */
const RANDOM_CHUNK = 65536;
const MAX_RANDOM_BYTES = 2 ** 31 - 1;

function fillRandom(bytes: Uint8Array): void {
  const source = randomSource();
  for (let offset = 0; offset < bytes.length; offset += RANDOM_CHUNK) {
    source.getRandomValues(bytes.subarray(offset, Math.min(offset + RANDOM_CHUNK, bytes.length)));
  }
}

export function randomBytes(size: number): Buffer;
export function randomBytes(size: number, callback: (err: Error | null, buf: Buffer) => void): void;
export function randomBytes(size: number, callback?: (err: Error | null, buf: Buffer) => void): Buffer | void {
  if (typeof size !== 'number') throw invalidArgType('size', 'of type number', size);
  if (Number.isNaN(size) || size < 0 || size > MAX_RANDOM_BYTES) {
    throw outOfRange('size', `>= 0 && <= ${MAX_RANDOM_BYTES}`, size);
  }
  if (callback !== undefined && typeof callback !== 'function') throw invalidArgType('callback', 'of type function', callback);
  // Like Node, a fractional size is truncated.
  const bytes = new Uint8Array(size >>> 0);
  fillRandom(bytes);
  const buf = bufferOver(bytes);
  if (!callback) return buf;
  queueMicrotask(() => callback(null, buf));
}

/** Largest range of `randomInt`: 48 bits, like Node. */
const RAND_MAX = 0xffff_ffff_ffff;

/**
 * A uniformly distributed integer in [min, max) - Node's algorithm: 48 random bits, rejected
 * (and drawn again) when they fall into the incomplete last copy of the range, so every value
 * is exactly equally likely (no modulo bias).
 */
export function randomInt(max: number): number;
export function randomInt(min: number, max: number): number;
export function randomInt(max: number, callback: (err: Error | null, value: number) => void): void;
export function randomInt(min: number, max: number, callback: (err: Error | null, value: number) => void): void;
export function randomInt(
  a: number,
  b?: number | ((err: Error | null, value: number) => void),
  c?: (err: Error | null, value: number) => void,
): number | void {
  let min = a;
  let max: number;
  let callback = c;
  if (b === undefined || typeof b === 'function') {
    callback = b;
    max = a;
    min = 0;
  } else {
    max = b;
  }
  if (callback !== undefined && typeof callback !== 'function') throw invalidArgType('callback', 'of type function', callback);
  if (!Number.isSafeInteger(min)) throw invalidArgType('min', 'a safe integer', min);
  if (!Number.isSafeInteger(max)) throw invalidArgType('max', 'a safe integer', max);
  if (max <= min) throw outOfRange('max', `greater than the value of "min" (${min})`, max);
  const range = max - min;
  if (!(range <= RAND_MAX)) throw outOfRange('max - min', `<= ${RAND_MAX}`, range);

  // Values at or above this limit would make the low residues more likely: draw again.
  const randLimit = RAND_MAX - (RAND_MAX % range);
  const bytes = new Uint8Array(6);
  let value: number;
  do {
    fillRandom(bytes);
    // 48 bits, big-endian; the high 16 bits are multiplied (a shift would overflow 32 bits).
    value = (bytes[0] * 256 + bytes[1]) * 0x1_0000_0000 + (((bytes[2] << 24) | (bytes[3] << 16) | (bytes[4] << 8) | bytes[5]) >>> 0);
  } while (value >= randLimit);
  const result = (value % range) + min;
  if (!callback) return result;
  const done = callback;
  queueMicrotask(() => done(null, result));
}

/**
 * Compares two equally long byte sequences in time that does not depend on where they differ.
 * Throws (like Node) when the lengths differ - callers compare lengths themselves first.
 */
export function timingSafeEqual(a: ArrayBufferView | ArrayBuffer, b: ArrayBufferView | ArrayBuffer): boolean {
  const x = viewOf(a, 'buf1');
  const y = viewOf(b, 'buf2');
  if (x.length !== y.length) {
    throw nodeError(RangeError, 'ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH', 'Input buffers must have the same byte length');
  }
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// Hash --------------------------------------------------------------------------------------

type Sha256State = ReturnType<typeof sha256.create>;

/** `createHash('sha256')`: update() any number of times, digest() once. */
export class Hash {
  private state: Sha256State;
  private finalized = false;

  constructor(state: Sha256State = sha256.create()) {
    this.state = state;
  }

  update(data: BinaryLike, inputEncoding?: string): this {
    if (this.finalized) throw nodeError(Error, 'ERR_CRYPTO_HASH_FINALIZED', 'Digest already called');
    this.state.update(inputBytes(data, inputEncoding));
    return this;
  }

  digest(): Buffer;
  digest(encoding: string): string;
  digest(encoding?: string): Buffer | string {
    if (this.finalized) throw nodeError(Error, 'ERR_CRYPTO_HASH_FINALIZED', 'Digest already called');
    this.finalized = true;
    return encoded(this.state.digest(), encoding);
  }

  /** A hash with the state so far, to be continued independently. */
  copy(): Hash {
    if (this.finalized) throw nodeError(Error, 'ERR_CRYPTO_HASH_FINALIZED', 'Digest already called');
    return new Hash(this.state.clone());
  }
}

export function createHash(algorithm: string): Hash {
  if (typeof algorithm !== 'string') throw invalidArgType('algorithm', 'of type string', algorithm);
  const name = algorithm.toLowerCase();
  if (name !== 'sha256' && name !== 'sha-256') {
    throw new Error(`Digest method not supported: ${algorithm} (the mobile core has SHA-256 only)`);
  }
  return new Hash();
}

// AES-GCM -----------------------------------------------------------------------------------

/** The only tag length of the mobile core (and the one every container of the app uses). */
const GCM_TAG_LENGTH = 16;
/** @noble/ciphers needs at least 8 nonce bytes; the app always uses 12. */
const GCM_MIN_NONCE = 8;
const AUTH_FAILED = 'Unsupported state or unable to authenticate data';

export interface CipherGcmOptions {
  authTagLength?: number;
}

interface GcmSetup {
  key: Uint8Array;
  nonce: Uint8Array;
}

function gcmSetup(algorithm: string, key: BinaryLike, iv: BinaryLike | null, options: CipherGcmOptions | undefined): GcmSetup {
  if (typeof algorithm !== 'string') throw invalidArgType('cipher', 'of type string', algorithm);
  const match = /^aes-(128|192|256)-gcm$/.exec(algorithm.toLowerCase());
  if (!match) {
    throw nodeError(Error, 'ERR_CRYPTO_UNKNOWN_CIPHER', `Unknown cipher: ${algorithm} (the mobile core has AES-GCM only)`);
  }
  // Copies: the caller may wipe its key right after creating the cipher.
  const keyBytes = bytesOf(key, 'key').slice();
  if (keyBytes.length !== Number(match[1]) / 8) throw nodeError(RangeError, 'ERR_CRYPTO_INVALID_KEYLEN', 'Invalid key length');
  if (iv === null || iv === undefined) throw invalidArgType('iv', 'of type string or an instance of ArrayBuffer, Buffer, TypedArray, or DataView', iv);
  const nonce = bytesOf(iv, 'iv').slice();
  if (nonce.length < GCM_MIN_NONCE) {
    throw nodeError(TypeError, 'ERR_CRYPTO_INVALID_IV', `Invalid initialization vector (the mobile core needs at least ${GCM_MIN_NONCE} bytes)`);
  }
  const tagLength = options?.authTagLength;
  if (tagLength !== undefined && tagLength !== GCM_TAG_LENGTH) {
    throw nodeError(TypeError, 'ERR_CRYPTO_INVALID_AUTH_TAG', `Invalid authentication tag length: ${String(tagLength)} (the mobile core has ${GCM_TAG_LENGTH}-byte tags only)`);
  }
  return { key: keyBytes, nonce };
}

/** Shared part of the cipher and the decipher: collects the AAD and the data until `final()`. */
abstract class GcmStream {
  protected readonly key: Uint8Array;
  protected readonly nonce: Uint8Array;
  protected readonly aad: Uint8Array[] = [];
  protected readonly chunks: Uint8Array[] = [];
  protected updated = false;
  protected finished = false;

  constructor(setup: GcmSetup) {
    this.key = setup.key;
    this.nonce = setup.nonce;
  }

  /** Additional authenticated data; must be given before the first `update()`. */
  setAAD(data: ArrayBufferView | ArrayBuffer, _options?: { plaintextLength?: number }): this {
    if (this.finished || this.updated) throw invalidState('setAAD');
    this.aad.push(viewOf(data, 'buffer').slice());
    return this;
  }

  /** Buffers `data`; the bytes come out of `final()`. Returns an empty Buffer (or string). */
  update(data: BinaryLike, inputEncoding?: string): Buffer;
  update(data: BinaryLike, inputEncoding: string | undefined, outputEncoding: string): string;
  update(data: BinaryLike, inputEncoding?: string, outputEncoding?: string): Buffer | string {
    if (this.finished) throw invalidState('update');
    const bytes = inputBytes(data, inputEncoding).slice();
    this.updated = true;
    this.chunks.push(bytes);
    return encoded(new Uint8Array(0), outputEncoding);
  }

  setAutoPadding(_autoPadding?: boolean): this {
    return this;
  }

  protected associatedData(): Uint8Array | undefined {
    return this.aad.length ? concatBytes(this.aad) : undefined;
  }

  /** Forgets the key and the buffered data once the result exists. */
  protected finish(): void {
    this.finished = true;
    this.key.fill(0);
    for (const chunk of this.chunks) chunk.fill(0);
    this.chunks.length = 0;
  }
}

export class Cipheriv extends GcmStream {
  private tag: Uint8Array | null = null;

  /** Everything given to `update()`, encrypted. Afterwards `getAuthTag()` returns the 16-byte tag. */
  final(): Buffer;
  final(outputEncoding: string): string;
  final(outputEncoding?: string): Buffer | string {
    if (this.finished) throw invalidState('final');
    const plain = concatBytes(this.chunks);
    const sealed = gcm(this.key, this.nonce, this.associatedData()).encrypt(plain);
    plain.fill(0);
    this.finish();
    const bodyLength = sealed.length - GCM_TAG_LENGTH;
    this.tag = sealed.slice(bodyLength);
    return encoded(sealed.subarray(0, bodyLength), outputEncoding);
  }

  getAuthTag(): Buffer {
    if (!this.tag) throw invalidState('getAuthTag');
    return bufferOver(this.tag.slice());
  }
}

export class Decipheriv extends GcmStream {
  private tag: Uint8Array | null = null;

  setAuthTag(tag: BinaryLike, encoding?: string): this {
    if (this.finished || this.tag) throw invalidState('setAuthTag');
    const bytes = bytesOf(tag, 'buffer', encoding).slice();
    if (bytes.length !== GCM_TAG_LENGTH) {
      throw nodeError(TypeError, 'ERR_CRYPTO_INVALID_AUTH_TAG', `Invalid authentication tag length: ${bytes.length}`);
    }
    this.tag = bytes;
    return this;
  }

  /**
   * Verifies the tag over the AAD and everything given to `update()`, then returns the plaintext.
   * Throws - like Node - when the tag does not match (wrong key, wrong AAD, any changed byte) or
   * was never set; no plaintext is produced in that case.
   */
  final(): Buffer;
  final(outputEncoding: string): string;
  final(outputEncoding?: string): Buffer | string {
    if (this.finished) throw invalidState('final');
    const tag = this.tag;
    const sealed = concatBytes(tag ? [...this.chunks, tag] : this.chunks);
    let plain: Uint8Array | null = null;
    try {
      if (tag) plain = gcm(this.key, this.nonce, this.associatedData()).decrypt(sealed);
    } catch {
      plain = null;
    }
    this.finish();
    if (!plain) throw new Error(AUTH_FAILED);
    return encoded(plain, outputEncoding);
  }
}

export function createCipheriv(algorithm: string, key: BinaryLike, iv: BinaryLike | null, options?: CipherGcmOptions): Cipheriv {
  return new Cipheriv(gcmSetup(algorithm, key, iv, options));
}

export function createDecipheriv(algorithm: string, key: BinaryLike, iv: BinaryLike | null, options?: CipherGcmOptions): Decipheriv {
  return new Decipheriv(gcmSetup(algorithm, key, iv, options));
}

// scrypt ------------------------------------------------------------------------------------

export interface ScryptOptions {
  N?: number;
  cost?: number;
  r?: number;
  blockSize?: number;
  p?: number;
  parallelization?: number;
  maxmem?: number;
}

/** The validated parameters of one derivation. */
export interface ScryptJob {
  N: number;
  r: number;
  p: number;
  dkLen: number;
}

/**
 * Derives the key of one job. The default runs @noble/hashes; a faster implementation with the
 * same output (hash-wasm, should a phone need it) can be installed with `setScryptBackend`.
 */
export type ScryptBackend = (password: Uint8Array, salt: Uint8Array, job: ScryptJob) => Promise<Uint8Array>;

const SCRYPT_DEFAULTS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
/** OpenSSL: p * r may not exceed 2^30 - 1. */
const SCRYPT_PR_MAX = 2 ** 30 - 1;

/** Milliseconds of derivation between two yields to the event loop (other requests run in between). */
let scryptYieldMs = 50;
let scryptBackend: ScryptBackend | null = null;

/** Sets how long the async scrypt computes before it lets other tasks of the worker run. */
export function setScryptYieldInterval(milliseconds: number): void {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new RangeError('scrypt yield interval must be >= 0');
  scryptYieldMs = Math.floor(milliseconds);
}

/** Replaces the async scrypt implementation (null: back to @noble/hashes). The output must be RFC 7914. */
export function setScryptBackend(backend: ScryptBackend | null): void {
  scryptBackend = backend;
}

function invalidScryptParams(reason: string): Error {
  return nodeError(RangeError, 'ERR_CRYPTO_INVALID_SCRYPT_PARAMS', `Invalid scrypt params: ${reason}`);
}

function scryptOption(options: ScryptOptions, short: 'N' | 'r' | 'p', long: 'cost' | 'blockSize' | 'parallelization'): number {
  const a = options[short];
  const b = options[long];
  if (a !== undefined && b !== undefined) {
    throw nodeError(TypeError, 'ERR_INCOMPATIBLE_OPTION_PAIR', `Option "${short}" cannot be used in combination with option "${long}"`);
  }
  const value = a ?? b;
  if (value === undefined) return SCRYPT_DEFAULTS[short];
  if (typeof value !== 'number') throw invalidArgType(short, 'of type number', value);
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) throw outOfRange(short, '>= 0 && <= 4294967295', value);
  // Node treats 0 as "the default".
  return value === 0 ? SCRYPT_DEFAULTS[short] : value;
}

/** Node's argument checks and OpenSSL's parameter checks (same limits, incl. the memory formula). */
function scryptJob(keylen: number, options: ScryptOptions): ScryptJob {
  if (typeof keylen !== 'number') throw invalidArgType('keylen', 'of type number', keylen);
  if (!Number.isInteger(keylen) || keylen < 0 || keylen > 2 ** 31 - 1) throw outOfRange('keylen', '>= 0 && <= 2147483647', keylen);
  if (options === null || typeof options !== 'object') throw invalidArgType('options', 'of type object', options);
  const N = scryptOption(options, 'N', 'cost');
  const r = scryptOption(options, 'r', 'blockSize');
  const p = scryptOption(options, 'p', 'parallelization');
  let maxmem = SCRYPT_DEFAULTS.maxmem;
  if (options.maxmem !== undefined) {
    if (typeof options.maxmem !== 'number') throw invalidArgType('maxmem', 'of type number', options.maxmem);
    if (!Number.isSafeInteger(options.maxmem) || options.maxmem < 0) throw outOfRange('maxmem', '>= 0 && <= 9007199254740991', options.maxmem);
    if (options.maxmem !== 0) maxmem = options.maxmem;
  }
  if (N < 2 || (N & (N - 1)) !== 0) throw invalidScryptParams('N must be a power of 2 greater than 1');
  if (p > SCRYPT_PR_MAX / r) throw invalidScryptParams('p * r is too large');
  if (16 * r < 53 && N >= 2 ** (16 * r)) throw invalidScryptParams('N is too large for r');
  // OpenSSL: Blen + Vlen = p*128*r + 32*r*(N+2)*4 bytes must fit in maxmem.
  if (128 * r * p + 128 * r * (N + 2) > maxmem) throw invalidScryptParams('memory limit exceeded');
  return { N, r, p, dkLen: keylen };
}

/**
 * Hides `scope.scheduler` (the Prioritized Task Scheduling API of the host) until the returned
 * function is called; that function puts back exactly what was there - an own property with its
 * descriptor, or nothing when the scheduler was inherited.
 *
 * Why: between two slices of a derivation @noble/hashes awaits `scheduler.yield()` when the host has
 * it and `setTimeout(0)` otherwise. In Chromium - the Android WebView - the continuation of
 * `scheduler.yield()` runs BEFORE the tasks that are already waiting: no timer fires and no
 * `message` event is delivered until the key is ready, i.e. the worker is deaf for the whole
 * derivation (measured in a Chromium 152 worker: 0 timer turns and 0 messages handled during the
 * derivation; with the scheduler hidden every message that arrives is answered within one slice).
 * A timer is a real turn of the event loop, so the scheduler is taken out of sight while a
 * derivation runs. The price is the 4 ms minimum of nested timers: about 3 ms per yield in that
 * measurement, i.e. at most 8 % with the default slice of 50 ms.
 *
 * In a worker `scheduler` is inherited from the prototype of the global object: it is hidden by an
 * own property and comes back when that property is deleted. Node has no global `scheduler`.
 *
 * When the property cannot be redefined nothing is hidden (one warning; the key is still right,
 * but the derivation does not yield on such a host).
 */
export function hideHostScheduler(scope: object = globalThis): () => void {
  const nothing = (): void => undefined;
  if (!('scheduler' in scope)) return nothing;
  const own = Object.getOwnPropertyDescriptor(scope, 'scheduler');
  try {
    Object.defineProperty(scope, 'scheduler', { value: undefined, configurable: true, writable: true, enumerable: own?.enumerable ?? false });
  } catch {
    console.warn('[mobile core] scheduler cannot be hidden: scrypt will not yield to the event loop while it derives a key');
    return nothing;
  }
  return () => {
    const now = Object.getOwnPropertyDescriptor(scope, 'scheduler');
    // Somebody installed another scheduler in the meantime: that one stays.
    if (!now || !('value' in now) || now.value !== undefined) return;
    if (own) Object.defineProperty(scope, 'scheduler', own);
    else delete (scope as { scheduler?: unknown }).scheduler;
  };
}

/** Async derivations that are running now, and how to bring the host scheduler back after the last one. */
let derivationsRunning = 0;
let restoreHostScheduler: (() => void) | null = null;

/** `derive()` with the host scheduler hidden from its first slice to its last (see hideHostScheduler). */
async function onTimerYields<T>(derive: () => Promise<T>): Promise<T> {
  if (derivationsRunning === 0) restoreHostScheduler = hideHostScheduler();
  derivationsRunning += 1;
  try {
    return await derive();
  } finally {
    derivationsRunning -= 1;
    if (derivationsRunning === 0) {
      const restore = restoreHostScheduler;
      restoreHostScheduler = null;
      restore?.();
    }
  }
}

function deriveSync(password: Uint8Array, salt: Uint8Array, job: ScryptJob): Uint8Array {
  // RFC 7914 needs dkLen >= 1; Node answers an empty key for keylen 0.
  if (job.dkLen === 0) return new Uint8Array(0);
  return nobleScrypt(password, salt, { ...job, maxmem: Number.MAX_SAFE_INTEGER });
}

async function deriveAsync(password: Uint8Array, salt: Uint8Array, job: ScryptJob): Promise<Uint8Array> {
  if (job.dkLen === 0) return new Uint8Array(0);
  if (scryptBackend) {
    const key = await scryptBackend(password, salt, job);
    if (!(key instanceof Uint8Array) || key.length !== job.dkLen) throw new Error('scrypt backend returned a key of the wrong length');
    return key;
  }
  return onTimerYields(() => nobleScryptAsync(password, salt, { ...job, maxmem: Number.MAX_SAFE_INTEGER, asyncTick: scryptYieldMs }));
}

type ScryptCallback = (err: Error | null, derivedKey: Buffer) => void;

/**
 * Node's callback scrypt. Invalid arguments throw synchronously (as in Node); the derivation
 * itself runs in slices and gives the event loop a turn every `scryptYieldMs` milliseconds, so a
 * login does not stall the other requests of the worker. The turn is a timer (`setTimeout(0)`),
 * never `scheduler.yield()` - see hideHostScheduler.
 */
export function scrypt(password: BinaryLike, salt: BinaryLike, keylen: number, callback: ScryptCallback): void;
export function scrypt(password: BinaryLike, salt: BinaryLike, keylen: number, options: ScryptOptions, callback: ScryptCallback): void;
export function scrypt(
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  optionsOrCallback: ScryptOptions | ScryptCallback,
  maybeCallback?: ScryptCallback,
): void {
  const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
  const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback;
  if (typeof callback !== 'function') throw invalidArgType('callback', 'of type function', callback);
  // Copies: the caller may wipe its buffers while the derivation is still running.
  const passwordBytes = bytesOf(password, 'password').slice();
  const saltBytes = bytesOf(salt, 'salt').slice();
  const job = scryptJob(keylen, options);
  deriveAsync(passwordBytes, saltBytes, job).then(
    (key) => {
      passwordBytes.fill(0);
      callback(null, bufferOver(key));
    },
    (error: unknown) => {
      passwordBytes.fill(0);
      callback(error instanceof Error ? error : new Error(String(error)), Buffer.alloc(0));
    },
  );
}

export function scryptSync(password: BinaryLike, salt: BinaryLike, keylen: number, options: ScryptOptions = {}): Buffer {
  const job = scryptJob(keylen, options);
  return bufferOver(deriveSync(bytesOf(password, 'password'), bytesOf(salt, 'salt'), job));
}

// Remote access only (never mounted in the mobile core): importable, throws when called ---------

export const createPrivateKey = stubFunction('crypto', 'createPrivateKey');
export const createPublicKey = stubFunction('crypto', 'createPublicKey');
export const generateKeyPairSync = stubFunction('crypto', 'generateKeyPairSync');
export const sign = stubFunction('crypto', 'sign');
export const verify = stubFunction('crypto', 'verify');
export const X509Certificate = stubClass('crypto', 'X509Certificate');

export default {
  randomBytes,
  randomInt,
  timingSafeEqual,
  createHash,
  createCipheriv,
  createDecipheriv,
  scrypt,
  scryptSync,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  X509Certificate,
};
