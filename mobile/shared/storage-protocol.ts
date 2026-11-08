/**
 * The storage contract of the Android build (docs/ANDROID-PLAN.md, section 2).
 *
 * The diary core runs in a Web Worker without a file system; the files live in the app-private
 * directory and can only be reached from the main thread (through @capacitor/filesystem). This
 * module defines
 *
 *  - `StorageBackend`: the seven operations a storage has to offer. Implemented on the main
 *    thread (mobile/host/storage/*) and, as a proxy, in the worker (mobile/core/vfs/rpc-backend.ts);
 *  - the messages of that proxy (`StorageRpcRequest` / `StorageRpcResponse`), served on the main
 *    thread by mobile/host/storage-rpc.ts.
 *
 * Paths are relative posix paths inside the storage root: `''` is the root itself,
 * `'accounts.json'` and `'users/u_1.mpd'` are files. No leading slash, no `.` / `..` segments.
 *
 * A backend is deliberately dumb: `write` is NOT atomic and `rename` is only ever called with a
 * target name that does not exist. Atomic replacement, ordering and crash recovery are the job of
 * the VFS on top of it (mobile/core/vfs/vfs.ts).
 *
 * Imported by both sides: it must stay free of DOM, worker and Node APIs.
 */

/** The error codes a backend reports (Node's names, so the VFS can pass them on). */
export const STORAGE_ERROR_CODES = [
  'ENOENT',
  'EEXIST',
  'EISDIR',
  'ENOTDIR',
  'ENOTEMPTY',
  'EACCES',
  'EINVAL',
  'EIO',
  'ETIMEDOUT',
] as const;
export type StorageErrorCode = (typeof STORAGE_ERROR_CODES)[number];

export function isStorageErrorCode(value: unknown): value is StorageErrorCode {
  return typeof value === 'string' && (STORAGE_ERROR_CODES as readonly string[]).includes(value);
}

/** What every backend operation rejects with. The message never contains file content. */
export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

/** Any thrown value as a `StorageError` (unknown failures become EIO). */
export function toStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  const candidate = error as { code?: unknown; message?: unknown } | null | undefined;
  const message = typeof candidate?.message === 'string' && candidate.message ? candidate.message : String(error);
  return new StorageError(isStorageErrorCode(candidate?.code) ? candidate.code : 'EIO', message);
}

export type StorageEntryType = 'file' | 'directory';

export interface StorageStat {
  type: StorageEntryType;
  /** Bytes (0 for a directory). */
  size: number;
  /** Last modification, milliseconds since the epoch (0 when the storage does not know). */
  mtimeMs: number;
}

/** One child of a directory. */
export interface StorageEntry extends StorageStat {
  /** The plain name, without the directory. */
  name: string;
}

export interface StorageBackend {
  /** The direct children of a directory. ENOENT when it does not exist, ENOTDIR for a file. */
  list(dir: string): Promise<StorageEntry[]>;
  /** The whole file. ENOENT when it does not exist, EISDIR for a directory. */
  read(path: string): Promise<Uint8Array>;
  /**
   * Creates or truncates the file and writes all of `bytes`. The parent directory must exist
   * (ENOENT). Not atomic: a crash may leave a partial file - the VFS only writes to temporary
   * names and renames them into place.
   */
  write(path: string, bytes: Uint8Array): Promise<void>;
  /**
   * Renames a file or a directory. ENOENT when `from` does not exist. The VFS never renames onto
   * an existing name; a backend may answer that with EEXIST or replace the target.
   */
  rename(from: string, to: string): Promise<void>;
  /** Deletes a file, or a directory with everything in it. A path that does not exist is not an error. */
  remove(path: string): Promise<void>;
  /** Creates the directory and its missing parents. An existing directory is not an error; EEXIST when a file is in the way. */
  mkdir(path: string): Promise<void>;
  /** What is at `path`; null when nothing is. */
  stat(path: string): Promise<StorageStat | null>;
}

/**
 * The segments of a storage path (`''` -> `[]`). Throws EINVAL for anything that is not a plain
 * relative posix path - a backend must never be talked into leaving its root.
 */
export function storagePathSegments(path: string): string[] {
  if (typeof path !== 'string') throw new StorageError('EINVAL', 'EINVAL: the storage path is not a string');
  if (path === '') return [];
  const segments = path.split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..' || segment.includes('\\') || segment.includes('\0')) {
      throw new StorageError('EINVAL', `EINVAL: invalid storage path '${path}'`);
    }
  }
  return segments;
}

/** The parent directory of a storage path (`''` for a top-level name). */
export function storageParent(path: string): string {
  const cut = path.lastIndexOf('/');
  return cut < 0 ? '' : path.slice(0, cut);
}

/** The last segment of a storage path. */
export function storageBaseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** `dir` + `name` (`''` is the root). */
export function storageJoin(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

// ---------------------------------------------------------------------------
// Worker <-> main-thread RPC
// ---------------------------------------------------------------------------

export const STORAGE_OPS = ['list', 'read', 'write', 'rename', 'remove', 'mkdir', 'stat'] as const;
export type StorageOp = (typeof STORAGE_OPS)[number];

/**
 * worker -> main thread: one backend call. `id` is chosen by the worker and unique per port.
 * `bytes` (write) is an ArrayBuffer that is TRANSFERRED, not copied; `to` belongs to rename.
 */
export interface StorageRpcRequest {
  type: 'storage-request';
  id: number;
  op: StorageOp;
  path: string;
  to?: string;
  bytes?: ArrayBuffer;
}

/** main thread -> worker: the result of the request with the same id. */
export interface StorageRpcSuccess {
  type: 'storage-response';
  id: number;
  ok: true;
  /** list */
  entries?: StorageEntry[];
  /** read (transferred) */
  bytes?: ArrayBuffer;
  /** stat (null: nothing there) */
  stat?: StorageStat | null;
}

export interface StorageRpcFailure {
  type: 'storage-response';
  id: number;
  ok: false;
  code: StorageErrorCode;
  message: string;
}

export type StorageRpcResponse = StorageRpcSuccess | StorageRpcFailure;

/**
 * What the RPC needs of a message channel end: a `Worker`, the worker's global scope or a
 * `MessagePort` (which must be started by whoever created it). The channel may carry other
 * messages too (the host <-> core protocol of ./transport.ts): both sides ignore what is not theirs.
 */
export interface StoragePort {
  postMessage(message: StorageRpcRequest | StorageRpcResponse, transfer: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return Object.prototype.toString.call(value) === '[object ArrayBuffer]';
}

function isStat(value: unknown): value is StorageStat {
  return (
    isRecord(value) &&
    (value.type === 'file' || value.type === 'directory') &&
    typeof value.size === 'number' &&
    typeof value.mtimeMs === 'number'
  );
}

function isEntry(value: unknown): value is StorageEntry {
  return isStat(value) && typeof (value as unknown as Record<string, unknown>).name === 'string';
}

/** Shape check for what the main thread receives (anything else is not a storage call). */
export function isStorageRpcRequest(value: unknown): value is StorageRpcRequest {
  if (!isRecord(value) || value.type !== 'storage-request') return false;
  if (typeof value.id !== 'number' || !Number.isInteger(value.id)) return false;
  if (typeof value.op !== 'string' || !(STORAGE_OPS as readonly string[]).includes(value.op)) return false;
  if (typeof value.path !== 'string') return false;
  if (value.op === 'rename' && typeof value.to !== 'string') return false;
  if (value.op === 'write' && !isArrayBuffer(value.bytes)) return false;
  return true;
}

/** Shape check for what the worker receives. */
export function isStorageRpcResponse(value: unknown): value is StorageRpcResponse {
  if (!isRecord(value) || value.type !== 'storage-response') return false;
  if (typeof value.id !== 'number' || !Number.isInteger(value.id)) return false;
  if (value.ok === false) return isStorageErrorCode(value.code) && typeof value.message === 'string';
  if (value.ok !== true) return false;
  if (value.entries !== undefined && !(Array.isArray(value.entries) && value.entries.every(isEntry))) return false;
  if (value.bytes !== undefined && !isArrayBuffer(value.bytes)) return false;
  if (value.stat !== undefined && value.stat !== null && !isStat(value.stat)) return false;
  return true;
}

/** The buffers to transfer with a storage message. */
export function storageTransferList(message: StorageRpcRequest | StorageRpcResponse): Transferable[] {
  return 'bytes' in message && message.bytes ? [message.bytes] : [];
}
