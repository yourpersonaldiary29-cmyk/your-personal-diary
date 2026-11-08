/**
 * The `node:fs` of the mobile diary core: the subset of Node's API that server/src uses, on top
 * of the VFS (./vfs.ts). The alias plugin of the mobile build maps `node:fs` to
 * mobile/core/shims/fs.ts, which re-exports this module - so the server code runs unchanged.
 *
 * Covered (the inventory is checked against server/src by mobile/test/vfs/server-usage.test.ts):
 *   sync      existsSync, accessSync, readFileSync, writeFileSync, mkdirSync, renameSync, statSync,
 *             lstatSync, statfsSync, rmSync, unlinkSync, rmdirSync, readdirSync, chmodSync,
 *             openSync, writeSync, fsyncSync, fdatasyncSync, fstatSync, closeSync
 *   promises  readFile, writeFile, open (FileHandle: writeFile, write, appendFile, readFile, stat,
 *             sync, datasync, close), rename, rm, unlink, mkdir, access, stat, readdir
 *
 * Semantics:
 *  - paths are virtual posix paths (`/data/accounts.json`, `/assets/fonts/...`), strings only;
 *  - errors are Node's: `.code` ENOENT / EEXIST / EISDIR / ENOTDIR / ENOTEMPTY / EACCES / EBADF /
 *    EIO with Node's message format (./errors.ts);
 *  - the synchronous functions change the in-memory mirror at once and return; the change reaches
 *    the storage behind them, in order (`getVfs().drain()` waits for it);
 *  - the fs.promises functions resolve when their change IS in the storage and reject with EIO when
 *    the storage refused it. `FileHandle.sync()` is the durability point of what was written through
 *    the handle, exactly like fsync;
 *  - file modes and permissions are ignored: the storage is the app-private directory;
 *  - `statfsSync` describes a notional volume: the mirror knows exactly what its files hold (the
 *    used blocks) and nothing about the device's free space, so the capacity is the constant
 *    STATFS_VOLUME_BYTES. Its one caller, routes/server-status.ts of the hosted server, only turns
 *    it into a free-space percentage; the phone never mounts that route.
 *
 * `Buffer` is the global one (Node under vitest, the `buffer` polyfill installed by the core in
 * the worker); it is only touched when a function is called, never at import time. A test that
 * runs server modules - which get the polyfill from the alias plugin even under Node - hands the
 * same class to `installBufferClass`, so the facade answers with the Buffers the phone has.
 */
import { invalidArgType } from './errors';
import { Vfs, type OpenMode, type VfsStat } from './vfs';

// ---------------------------------------------------------------------------
// The VFS behind the facade
// ---------------------------------------------------------------------------

let current: Vfs = new Vfs();

/** Makes `vfs` the file system behind this module (the core does it once, before `vfs.boot()`). */
export function installVfs(vfs: Vfs): void {
  current = vfs;
}

/** The file system behind this module (a memory-only one until `installVfs`). */
export function getVfs(): Vfs {
  return current;
}

/** The Buffer class of the results; null: the global one. */
let bufferClass: BufferConstructor | null = null;

/** Makes the facade return Buffers of `ctor` (null: of the global `Buffer` again). */
export function installBufferClass(ctor: BufferConstructor | null): void {
  bufferClass = ctor;
}

function buffers(): BufferConstructor {
  return bufferClass ?? Buffer;
}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

type Encoding = BufferEncoding;
type EncodingOption = Encoding | 'buffer' | null | undefined | { encoding?: Encoding | 'buffer' | null; flag?: string; mode?: number };
type FileData = string | ArrayBufferView | ArrayBuffer;

function invalidArgValue(name: string, value: unknown): TypeError {
  const error = new TypeError(`The argument '${name}' is invalid. Received ${String(value)}`) as TypeError & { code: string };
  error.code = 'ERR_INVALID_ARG_VALUE';
  return error;
}

/** The text encoding asked for; null means "give me a Buffer". */
function encodingOf(options: unknown): Encoding | null {
  const encoding = typeof options === 'string' ? options : (options as { encoding?: unknown } | null | undefined)?.encoding;
  if (encoding === undefined || encoding === null || encoding === 'buffer') return null;
  if (typeof encoding !== 'string' || !buffers().isEncoding(encoding)) throw invalidArgValue('encoding', encoding);
  return encoding;
}

function flagOf(options: unknown, fallback: string): string {
  const flag = typeof options === 'object' && options !== null ? (options as { flag?: unknown }).flag : undefined;
  return typeof flag === 'string' ? flag : fallback;
}

function isUtf8(encoding: Encoding | null): boolean {
  return encoding === null || encoding === 'utf8' || encoding === 'utf-8';
}

/** A private copy of the data as bytes (the caller may wipe or reuse its buffer afterwards). */
function toBytes(data: unknown, encoding: Encoding | null = null): Uint8Array {
  if (typeof data === 'string') {
    if (isUtf8(encoding)) return new TextEncoder().encode(data);
    const buffer = buffers().from(data, encoding as Encoding);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength).slice();
  }
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
  if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
  throw invalidArgType('data', 'of type string or an instance of Buffer, TypedArray, or DataView', data);
}

/** A Buffer with a copy of the bytes, or their text. */
function fromBytes(bytes: Uint8Array, encoding: Encoding | null): Buffer | string {
  if (encoding === null) return buffers().from(bytes);
  return buffers().from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString(encoding);
}

const READ: OpenMode = { writable: false, create: false, truncate: false, exclusive: false, append: false };

function openMode(flags: unknown): OpenMode {
  if (flags === undefined || flags === null) return READ;
  if (typeof flags !== 'string') throw invalidArgValue('flags', flags);
  const sync = flags.replace('s', '');
  const exclusive = sync.includes('x');
  switch (sync.replace('x', '')) {
    case 'r':
      return READ;
    case 'r+':
      return { ...READ, writable: true };
    case 'w':
    case 'w+':
      return { writable: true, create: true, truncate: true, exclusive, append: false };
    case 'a':
    case 'a+':
      return { writable: true, create: true, truncate: false, exclusive, append: true };
    default:
      throw invalidArgValue('flags', flags);
  }
}

/** The mode of a whole-file write: 'w' replaces, 'wx' must create, 'a' appends. */
function writeMode(flag: string): 'w' | 'wx' | 'a' {
  const mode = openMode(flag);
  if (!mode.writable || !mode.create) throw invalidArgValue('flag', flag);
  return mode.append ? 'a' : mode.exclusive ? 'wx' : 'w';
}

// ---------------------------------------------------------------------------
// Stats / Dirent
// ---------------------------------------------------------------------------

export class Stats {
  readonly dev = 0;
  readonly ino = 0;
  readonly mode: number;
  readonly nlink = 1;
  readonly uid = 0;
  readonly gid = 0;
  readonly rdev = 0;
  readonly size: number;
  readonly blksize = 4096;
  readonly blocks: number;
  readonly atimeMs: number;
  readonly mtimeMs: number;
  readonly ctimeMs: number;
  readonly birthtimeMs: number;
  readonly atime: Date;
  readonly mtime: Date;
  readonly ctime: Date;
  readonly birthtime: Date;
  private readonly directory: boolean;

  constructor(stat: VfsStat) {
    this.directory = stat.kind === 'dir';
    this.mode = this.directory ? 0o40700 : 0o100600;
    this.size = stat.size;
    this.blocks = Math.ceil(stat.size / 512);
    this.atimeMs = stat.mtimeMs;
    this.mtimeMs = stat.mtimeMs;
    this.ctimeMs = stat.mtimeMs;
    this.birthtimeMs = stat.birthtimeMs;
    this.atime = new Date(this.atimeMs);
    this.mtime = new Date(this.mtimeMs);
    this.ctime = new Date(this.ctimeMs);
    this.birthtime = new Date(this.birthtimeMs);
  }

  isFile(): boolean {
    return !this.directory;
  }
  isDirectory(): boolean {
    return this.directory;
  }
  isSymbolicLink(): boolean {
    return false;
  }
  isBlockDevice(): boolean {
    return false;
  }
  isCharacterDevice(): boolean {
    return false;
  }
  isFIFO(): boolean {
    return false;
  }
  isSocket(): boolean {
    return false;
  }
}

export class Dirent {
  constructor(
    readonly name: string,
    readonly parentPath: string,
    private readonly directory: boolean,
  ) {}

  /** Node's older name of `parentPath`. */
  get path(): string {
    return this.parentPath;
  }
  isFile(): boolean {
    return !this.directory;
  }
  isDirectory(): boolean {
    return this.directory;
  }
  isSymbolicLink(): boolean {
    return false;
  }
}

export const constants = { F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1 } as const;

/**
 * The capacity `statfsSync` reports: 64 GiB, a notional figure. The VFS mirrors the app's private
 * directory; it knows how much its own files hold, nothing about the device's free space.
 */
export const STATFS_VOLUME_BYTES = 64 * 1024 ** 3;
/** The block size of that volume (the `blksize` of Stats as well). */
export const STATFS_BLOCK_SIZE = 4096;

/**
 * The answer of `statfsSync`: the shape of Node's StatFs. `type`, `files` and `ffree` are 0 (as
 * Node reports them on Windows: not modelled); `bfree` equals `bavail` (no reserved blocks).
 */
export class StatFs {
  readonly type = 0;
  readonly bsize = STATFS_BLOCK_SIZE;
  readonly frsize = STATFS_BLOCK_SIZE;
  readonly blocks = STATFS_VOLUME_BYTES / STATFS_BLOCK_SIZE;
  readonly bfree: number;
  readonly bavail: number;
  readonly files = 0;
  readonly ffree = 0;

  constructor(usedBlocks: number) {
    this.bfree = Math.max(0, this.blocks - usedBlocks);
    this.bavail = this.bfree;
  }
}

// ---------------------------------------------------------------------------
// Synchronous API
// ---------------------------------------------------------------------------

/** Never throws for a path, like Node - except before the storage is loaded (see Vfs.boot). */
export function existsSync(path: string): boolean {
  if (typeof path !== 'string' || path.includes('\0')) return false;
  return current.exists(path);
}

/** Existence only: there are no permissions to check. */
export function accessSync(path: string, _mode?: number): void {
  current.access(path);
}

export function readFileSync(path: string, options?: EncodingOption): Buffer | string {
  const encoding = encodingOf(options);
  return fromBytes(current.readFile(path), encoding);
}

export function writeFileSync(path: string, data: FileData, options?: EncodingOption): void {
  current.writeFile(path, toBytes(data, encodingOf(options)), writeMode(flagOf(options, 'w')));
}

export function mkdirSync(path: string, options?: number | { recursive?: boolean; mode?: number } | null): string | undefined {
  const recursive = typeof options === 'object' && options !== null && options.recursive === true;
  const { first } = current.mkdir(path, recursive);
  return recursive ? first : undefined;
}

export function renameSync(oldPath: string, newPath: string): void {
  current.rename(oldPath, newPath);
}

export function statSync(path: string, options?: { throwIfNoEntry?: boolean; bigint?: boolean }): Stats | undefined {
  if (options?.throwIfNoEntry === false) {
    const stat = current.statOrNull(path);
    return stat ? new Stats(stat) : undefined;
  }
  return new Stats(current.stat(path));
}

/** There are no symbolic links: the same as statSync. */
export function lstatSync(path: string, options?: { throwIfNoEntry?: boolean; bigint?: boolean }): Stats | undefined {
  if (options?.throwIfNoEntry === false) return statSync(path, options);
  return new Stats(current.stat(path, 'lstat'));
}

/** The blocks the files at and below `dir` hold (per file, rounded up to whole blocks). */
function usedBlocks(vfs: Vfs, dir: string): number {
  let blocks = 0;
  for (const entry of vfs.readdir(dir)) {
    const child = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
    blocks += entry.kind === 'dir' ? usedBlocks(vfs, child) : Math.ceil(vfs.stat(child).size / STATFS_BLOCK_SIZE);
  }
  return blocks;
}

/**
 * The volume holding `path` - there is one: the whole VFS, assets included (see StatFs and
 * STATFS_VOLUME_BYTES). `path` must exist (ENOENT otherwise, like Node) and the storage must be
 * loaded (EIO before `boot()` completed, like every access to the data directory). `bigint` is
 * accepted and ignored, as in statSync.
 */
export function statfsSync(path: string, _options?: { bigint?: boolean }): StatFs {
  current.stat(path, 'statfs');
  return new StatFs(usedBlocks(current, '/'));
}

export function rmSync(path: string, options?: { force?: boolean; recursive?: boolean }): void {
  current.remove(path, options ?? {});
}

export function unlinkSync(path: string): void {
  current.unlink(path);
}

export function rmdirSync(path: string): void {
  current.rmdir(path);
}

export function readdirSync(path: string, options?: { withFileTypes?: boolean; encoding?: Encoding | null } | Encoding | null): string[] | Dirent[] {
  const entries = current.readdir(path);
  if (typeof options === 'object' && options !== null && options.withFileTypes) {
    return entries.map((entry) => new Dirent(entry.name, path, entry.kind === 'dir'));
  }
  return entries.map((entry) => entry.name);
}

/** Permissions are not modelled; the path must exist. */
export function chmodSync(path: string, _mode: number | string): void {
  current.access(path);
}

export function openSync(path: string, flags?: string, _mode?: number | string | null): number {
  return current.open(path, openMode(flags));
}

interface WriteOptions {
  offset?: number;
  length?: number;
  position?: number | null;
}

/** The bytes and the position of a `write(fd, ...)` call in either of Node's argument forms. */
function writeArguments(data: unknown, a: unknown, b: unknown, c: unknown): { bytes: Uint8Array; position: number | null } {
  if (typeof data === 'string') {
    // (fd, string, position?, encoding?)
    const encoding = typeof b === 'string' ? encodingOf(b) : null;
    return { bytes: toBytes(data, encoding), position: typeof a === 'number' ? a : null };
  }
  if (!ArrayBuffer.isView(data)) throw invalidArgType('buffer', 'of type string or an instance of Buffer, TypedArray, or DataView', data);
  // (fd, buffer, offset?, length?, position?)  or  (fd, buffer, { offset, length, position })
  const options: WriteOptions =
    typeof a === 'object' && a !== null
      ? (a as WriteOptions)
      : { offset: a as number | undefined, length: b as number | undefined, position: c as number | null | undefined };
  const view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const offset = options.offset ?? 0;
  const length = options.length ?? view.byteLength - offset;
  if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0 || offset + length > view.byteLength) {
    const error = new RangeError('The value of "offset" / "length" is out of range.') as RangeError & { code: string };
    error.code = 'ERR_OUT_OF_RANGE';
    throw error;
  }
  return { bytes: view.slice(offset, offset + length), position: typeof options.position === 'number' ? options.position : null };
}

/** `writeSync(fd, string, position?, encoding?)` or `writeSync(fd, buffer, offset?, length?, position?)`. */
export function writeSync(fd: number, data: string | ArrayBufferView, a?: unknown, b?: unknown, c?: unknown): number {
  const { bytes, position } = writeArguments(data, a, b, c);
  return current.fdWrite(fd, bytes, position);
}

/** Hands what was written through `fd` to the storage queue (it is durable after `getVfs().drain()`). */
export function fsyncSync(fd: number): void {
  current.fdSync(fd);
}

export function fdatasyncSync(fd: number): void {
  current.fdSync(fd);
}

export function fstatSync(fd: number): Stats {
  return new Stats(current.fdStat(fd));
}

export function closeSync(fd: number): void {
  current.fdClose(fd);
}

// ---------------------------------------------------------------------------
// fs.promises
// ---------------------------------------------------------------------------

export class FileHandle {
  private closed = false;

  constructor(
    readonly fd: number,
    private readonly vfs: Vfs,
  ) {}

  /** Writes at the handle's position (the whole file for a handle opened with 'w'). */
  async writeFile(data: FileData, options?: EncodingOption): Promise<void> {
    this.vfs.fdWrite(this.fd, toBytes(data, encodingOf(options)), null);
  }

  async appendFile(data: FileData, options?: EncodingOption): Promise<void> {
    this.vfs.fdWrite(this.fd, toBytes(data, encodingOf(options)), null);
  }

  async write<T extends string | ArrayBufferView>(data: T, a?: unknown, b?: unknown, c?: unknown): Promise<{ bytesWritten: number; buffer: T }> {
    const { bytes, position } = writeArguments(data, a, b, c);
    return { bytesWritten: this.vfs.fdWrite(this.fd, bytes, position), buffer: data };
  }

  async readFile(options?: EncodingOption): Promise<Buffer | string> {
    return fromBytes(this.vfs.fdRead(this.fd), encodingOf(options));
  }

  async stat(): Promise<Stats> {
    return new Stats(this.vfs.fdStat(this.fd));
  }

  /** Resolves when everything written through the handle is in the storage; rejects with EIO otherwise. */
  async sync(): Promise<void> {
    await this.vfs.whenDurable(this.vfs.fdSync(this.fd));
  }

  async datasync(): Promise<void> {
    await this.sync();
  }

  /** Like Node, closing is not a durability point: call `sync()` first when that matters. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.vfs.fdClose(this.fd);
  }
}

export const promises = {
  async readFile(path: string, options?: EncodingOption): Promise<Buffer | string> {
    return readFileSync(path, options);
  },

  async writeFile(path: string, data: FileData, options?: EncodingOption): Promise<void> {
    const vfs = current;
    await vfs.whenDurable(vfs.writeFile(path, toBytes(data, encodingOf(options)), writeMode(flagOf(options, 'w'))));
  },

  async open(path: string, flags?: string, _mode?: number | string): Promise<FileHandle> {
    const vfs = current;
    return new FileHandle(vfs.open(path, openMode(flags)), vfs);
  },

  async rename(oldPath: string, newPath: string): Promise<void> {
    const vfs = current;
    await vfs.whenDurable(vfs.rename(oldPath, newPath));
  },

  async rm(path: string, options?: { force?: boolean; recursive?: boolean }): Promise<void> {
    const vfs = current;
    await vfs.whenDurable(vfs.remove(path, options ?? {}));
  },

  async unlink(path: string): Promise<void> {
    const vfs = current;
    await vfs.whenDurable(vfs.unlink(path));
  },

  async mkdir(path: string, options?: number | { recursive?: boolean; mode?: number } | null): Promise<string | undefined> {
    const vfs = current;
    const recursive = typeof options === 'object' && options !== null && options.recursive === true;
    const { first, ticket } = vfs.mkdir(path, recursive);
    await vfs.whenDurable(ticket);
    return recursive ? first : undefined;
  },

  async access(path: string, _mode?: number): Promise<void> {
    current.access(path);
  },

  async stat(path: string): Promise<Stats> {
    return new Stats(current.stat(path));
  },

  async readdir(path: string, options?: { withFileTypes?: boolean } | Encoding | null): Promise<string[] | Dirent[]> {
    return readdirSync(path, options);
  },
};

// ---------------------------------------------------------------------------
// `import fs from 'node:fs'`
// ---------------------------------------------------------------------------

const fs = {
  Stats,
  StatFs,
  Dirent,
  constants,
  promises,
  existsSync,
  accessSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  statSync,
  lstatSync,
  statfsSync,
  rmSync,
  unlinkSync,
  rmdirSync,
  readdirSync,
  chmodSync,
  openSync,
  writeSync,
  fsyncSync,
  fdatasyncSync,
  fstatSync,
  closeSync,
};

export default fs;
