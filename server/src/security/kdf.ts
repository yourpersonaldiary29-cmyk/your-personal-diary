/**
 * Key derivation (ARCHITECTURE.md section 5).
 *
 *   secret   = scrypt(password, salt(16B), N=2^15, r=8, p=1, 64B)
 *   key      = secret[0..32]        AES-256-GCM key of the diary database
 *   verifier = sha256(secret[32..64]) stored in accounts.json to check the password
 *
 * The verifier reveals nothing about the key: the two halves of the scrypt output are
 * independent, so an attacker who reads accounts.json still has to run scrypt over
 * password guesses (and the diary file itself is protected by the first half).
 */
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { ApiError } from '../errors';

export interface KdfParams {
  /** CPU/memory cost, must be a power of two. */
  N: number;
  /** Block size. */
  r: number;
  /** Parallelisation. */
  p: number;
}

/** Production parameters (~32 MB of memory, tens of milliseconds on a modern CPU). */
export const DEFAULT_KDF: KdfParams = { N: 32768, r: 8, p: 1 };

export const SALT_LENGTH = 16;
export const SECRET_LENGTH = 64;
export const KEY_LENGTH = 32;

/** Bounds accepted when reading parameters from a file header (protects against DoS via absurd values). */
const MIN_N = 1 << 10;
const MAX_N = 1 << 22;
const MAX_R = 32;
const MAX_P = 16;
/** Upper bound of scrypt memory we are willing to allocate for one derivation (1 GiB). */
const MAX_MEMORY_BYTES = 1024 * 1024 * 1024;

/**
 * Most work a derivation with parameters read from a file someone ELSE may have made (a backup being
 * restored) may cost: p * N * r at most twice the app's own default. The app writes only
 * DEFAULT_KDF, so every genuine backup passes; a crafted 65-byte file asking for N=2^17, r=8, p=16
 * (64x the default) would otherwise tie up the libuv thread pool - which scrypt shares with the
 * diary's file writes - for tens of seconds per request.
 */
export const MAX_UNTRUSTED_KDF_COST = 2 * DEFAULT_KDF.N * DEFAULT_KDF.r * DEFAULT_KDF.p;

/** True when the parameters of an untrusted file stay within MAX_UNTRUSTED_KDF_COST. */
export function isAffordableKdf(params: KdfParams): boolean {
  return params.N * params.r * params.p <= MAX_UNTRUSTED_KDF_COST;
}

/** Memory scrypt needs for the given parameters (128 * N * r for the V array + 128 * r * p for the blocks). */
export function scryptMemoryBytes(params: KdfParams): number {
  return 128 * params.N * params.r + 128 * params.r * params.p;
}

/** True when the parameters are sane, supported and affordable. */
export function isValidKdfParams(params: unknown): params is KdfParams {
  if (!params || typeof params !== 'object') return false;
  const { N, r, p } = params as Record<string, unknown>;
  if (![N, r, p].every((v) => typeof v === 'number' && Number.isInteger(v) && v > 0)) return false;
  const n = N as number;
  const rr = r as number;
  const pp = p as number;
  if (n < MIN_N || n > MAX_N || (n & (n - 1)) !== 0) return false;
  if (rr > MAX_R || pp > MAX_P) return false;
  return 128 * n * rr <= MAX_MEMORY_BYTES;
}

export function newSalt(): Buffer {
  return randomBytes(SALT_LENGTH);
}

// Derivation gate (docs/HOSTED-PLAN.md 5.4, review finding 10) ----------------------------------

/** Catalogue key of the 503 answered when the derivation queue of a hosted server is full. */
export const BUSY_KEY = 'server.error.busy';
/** `Retry-After` of that 503, in seconds. */
export const BUSY_RETRY_AFTER_SEC = 2;

export interface KdfGateOptions {
  /** Derivations allowed to run at the same time. */
  concurrency: number;
  /** Derivations allowed to wait for a slot; beyond it callers get 503 'server.error.busy' at once. */
  queue: number;
}

/**
 * A semaphore in front of scrypt. scrypt runs on the libuv thread pool, which it shares with the
 * diary's file writes: on a public server a login flood would otherwise fill every pool thread and
 * stall every persist. With `concurrency` 2 and `UV_THREADPOOL_SIZE=8` six threads stay free for
 * fs. Local mode never installs a gate (`activeGate` stays null) and derives exactly as before.
 */
export class KdfGate {
  private running = 0;
  private readonly waiting: Array<() => void> = [];
  /** Callers refused with 503 since the gate was created (diagnostics). */
  refused = 0;

  constructor(readonly opts: KdfGateOptions) {
    if (!Number.isInteger(opts.concurrency) || opts.concurrency < 1) throw new Error('KdfGate: concurrency must be >= 1');
    if (!Number.isInteger(opts.queue) || opts.queue < 0) throw new Error('KdfGate: queue must be >= 0');
  }

  get stats(): { running: number; waiting: number; refused: number } {
    return { running: this.running, waiting: this.waiting.length, refused: this.refused };
  }

  /** Runs `fn` when a slot is free; rejects with 503 'server.error.busy' when the queue is full. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.opts.concurrency) {
      if (this.waiting.length >= this.opts.queue) {
        this.refused++;
        throw ApiError.busy();
      }
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.waiting.shift();
      if (next) next();
    }
  }
}

let activeGate: KdfGate | null = null;

/**
 * Installs (or removes, with null) the process-wide derivation gate. The hosted composition calls it
 * once at start with `DIARY_KDF_CONCURRENCY`; nothing in local mode does.
 */
export function configureKdfGate(opts: KdfGateOptions | null): KdfGate | null {
  activeGate = opts ? new KdfGate(opts) : null;
  return activeGate;
}

/** The installed gate, if any (tests, the Server card). */
export function kdfGate(): KdfGate | null {
  return activeGate;
}

function runScrypt(passwordBytes: Buffer, salt: Buffer, params: KdfParams): Promise<Buffer> {
  // maxmem must exceed 128*N*r; we always allow at least 128 MiB.
  const maxmem = Math.max(128 * 1024 * 1024, 2 * 128 * params.N * params.r);
  return new Promise((resolve, reject) => {
    scryptCb(
      passwordBytes,
      salt,
      SECRET_LENGTH,
      { N: params.N, r: params.r, p: params.p, maxmem },
      (err, derived) => {
        if (err) reject(ApiError.crypto('server.crypto.derivationFailed'));
        else resolve(Buffer.from(derived));
      },
    );
  });
}

/**
 * Derives the 64-byte secret from a password. The password is Unicode-normalised (NFKC)
 * so that the same characters typed through different input methods yield the same key.
 * Goes through the derivation gate when one is installed (hosted mode only).
 */
export function deriveSecret(password: string, salt: Buffer, params: KdfParams = DEFAULT_KDF): Promise<Buffer> {
  if (!isValidKdfParams(params)) {
    return Promise.reject(ApiError.crypto('server.crypto.unsupportedKdf'));
  }
  if (salt.length !== SALT_LENGTH) {
    return Promise.reject(ApiError.crypto('server.crypto.badSaltLength'));
  }
  const passwordBytes = Buffer.from(password.normalize('NFKC'), 'utf8');
  const gate = activeGate;
  if (gate) return gate.run(() => runScrypt(passwordBytes, salt, params));
  return runScrypt(passwordBytes, salt, params);
}

/** Splits the 64-byte secret into the DB key and the verifier source. Returns copies. */
export function splitSecret(secret: Buffer): { key: Buffer; verifierSource: Buffer } {
  if (secret.length !== SECRET_LENGTH) throw ApiError.crypto('server.crypto.badSecretLength');
  return {
    key: Buffer.from(secret.subarray(0, KEY_LENGTH)),
    verifierSource: Buffer.from(secret.subarray(KEY_LENGTH, SECRET_LENGTH)),
  };
}

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/** hex(sha256(secret[32..64])) - what accounts.json stores. */
export function verifierHex(verifierSource: Buffer): string {
  return sha256Hex(verifierSource);
}

/** Constant-time comparison of two hex strings (length mismatch is reported without leaking position). */
export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length === 0 || ab.length !== bb.length) {
    // Still burn a comparison so the timing does not depend on the mismatch type.
    timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** Constant-time comparison of two buffers. */
export function safeEqualBytes(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return timingSafeEqual(a, b);
}

/** Overwrites secret material in place (best effort - Buffers may still have copies in V8). */
export function wipe(buf: Buffer | null | undefined): void {
  if (buf && buf.length) buf.fill(0);
}
