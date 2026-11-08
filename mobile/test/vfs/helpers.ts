/**
 * Test doubles of the storage layer (mobile/test/vfs):
 *
 *  - `FakeFilesystemPlugin`: an in-memory @capacitor/filesystem, in two flavours - 'native' (error
 *    codes, `offset` / `length` honoured) and 'web' (the quirks of the plugin's browser
 *    implementation: plain errors, `offset` / `length` ignored, sizes counted in base64 characters);
 *  - `realWebPlugin()`: the plugin's REAL browser implementation (FilesystemWeb of @capacitor/filesystem)
 *    on `MiniIndexedDb`, an in-memory stand-in for the few IndexedDB calls it makes (jsdom has no
 *    IndexedDB and fake-indexeddb is not installed);
 *  - `FaultyStorage`: wraps any backend and injects failures (also of calls that ran all the same) or
 *    "kills the process" at a chosen call;
 *  - `portPair()`: two connected message ports with real structured-clone / transfer semantics;
 *  - `STORAGE_KINDS`: every way the VFS can be connected to a storage, for `describe.each`.
 */
import { FilesystemWeb } from '@capacitor/filesystem/dist/esm/web';
import type { FilesystemLike } from '../../host/storage/capacitor-filesystem';
import { CapacitorFilesystemStorage } from '../../host/storage/capacitor-filesystem';
import { base64ToBytes, bytesToBase64 } from '../../host/storage/base64';
import { MemoryStorage } from '../../host/storage/memory';
import { serveStorage } from '../../host/storage-rpc';
import { createRpcStorage } from '../../core/vfs/rpc-backend';
import {
  StorageError,
  type StorageBackend,
  type StorageEntry,
  type StorageErrorCode,
  type StorageOp,
  type StoragePort,
  type StorageRpcRequest,
  type StorageRpcResponse,
  type StorageStat,
} from '../../shared/storage-protocol';

export const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
export const bytesOf = (value: string): Uint8Array => new TextEncoder().encode(value);

/** Deterministic pseudo-random bytes (fictional content of any size). */
export function patternBytes(length: number, seed = 1): Uint8Array {
  const out = new Uint8Array(length);
  let x = seed >>> 0 || 1;
  for (let i = 0; i < length; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    out[i] = x >>> 24;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fake @capacitor/filesystem
// ---------------------------------------------------------------------------

type FakeEntry = { type: 'file'; data: Uint8Array; mtime: number; ctime: number } | { type: 'directory'; mtime: number; ctime: number };

type ReadOptions = Parameters<FilesystemLike['readFile']>[0];
type WriteOptions = Parameters<FilesystemLike['writeFile']>[0];
type AppendOptions = Parameters<FilesystemLike['appendFile']>[0];
type PathOptions = { path: string; directory?: string };
type RecursiveOptions = PathOptions & { recursive?: boolean };
type RenameOptions = Parameters<FilesystemLike['rename']>[0];

export interface FakePluginOptions {
  flavour?: 'native' | 'web';
}

export class FakeFilesystemPlugin implements FilesystemLike {
  /** Every plugin call in order, e.g. `writeFile DATA:diary/a.txt (8)` - the number is the length of the base64 text. */
  readonly calls: string[] = [];
  /** Targets of a rename that already existed (the VFS promises there are none). */
  readonly renamedOverExisting: string[] = [];
  private readonly entries = new Map<string, FakeEntry>();
  private readonly web: boolean;
  private clock = 1_700_000_000_000;

  constructor(options: FakePluginOptions = {}) {
    this.web = options.flavour === 'web';
  }

  private key(directory: string | undefined, path: string): string {
    return `${directory ?? ''}:${path.replace(/^\/+|\/+$/g, '')}`;
  }

  private isRoot(key: string): boolean {
    return key.endsWith(':');
  }

  private parentKey(key: string): string {
    const cut = key.lastIndexOf('/');
    return cut < 0 ? key.slice(0, key.indexOf(':') + 1) : key.slice(0, cut);
  }

  private get(key: string): FakeEntry | undefined {
    if (this.isRoot(key)) return { type: 'directory', mtime: 0, ctime: 0 };
    return this.entries.get(key);
  }

  private fail(code: string, native: string, web: string): never {
    if (this.web) throw new Error(web);
    throw Object.assign(new Error(native), { code });
  }

  private missing(method: string, path: string, web: string): never {
    return this.fail('OS-PLUG-FILE-0008', `'${method}' failed because file at '${path}' does not exist.`, web);
  }

  private childrenOf(key: string): string[] {
    const prefix = this.isRoot(key) ? key : `${key}/`;
    return [...this.entries.keys()].filter((k) => k.startsWith(prefix) && k.indexOf('/', prefix.length) < 0 && k !== key).sort();
  }

  private decode(data: string | Blob, method: string): Uint8Array {
    if (typeof data !== 'string') throw new Error(`${method}: the fake plugin takes base64 text`);
    if (data !== '' && !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('The supplied data is not valid base64 content.');
    return base64ToBytes(data);
  }

  private info(key: string, entry: FakeEntry): { name: string; type: 'file' | 'directory'; size: number; mtime: number; ctime: number; uri: string } {
    const bytes = entry.type === 'file' ? entry.data.byteLength : 0;
    return {
      name: key.slice(Math.max(key.lastIndexOf('/'), key.indexOf(':')) + 1),
      type: entry.type,
      // The web implementation reports the length of the stored base64 text.
      size: this.web ? Math.ceil(bytes / 3) * 4 : bytes,
      mtime: entry.mtime,
      ctime: entry.ctime,
      uri: `fake:${key}`,
    };
  }

  async readFile(options: ReadOptions): Promise<{ data: string }> {
    const key = this.key(options.directory, options.path);
    this.calls.push(`readFile ${key}${options.offset !== undefined ? ` @${options.offset}+${options.length}` : ''}`);
    const entry = this.get(key);
    if (!entry) this.missing('readFile', options.path, 'File does not exist.');
    if (entry.type !== 'file') this.fail('OS-PLUG-FILE-0009', "'readFile' not supported for directories.", 'File does not exist.');
    if (this.web) return { data: bytesToBase64(entry.data) };
    const offset = options.offset && options.offset > 0 ? options.offset : 0;
    const end = options.length && options.length > 0 ? offset + options.length : entry.data.byteLength;
    return { data: bytesToBase64(entry.data.subarray(offset, end)) };
  }

  async writeFile(options: WriteOptions): Promise<{ uri: string }> {
    const key = this.key(options.directory, options.path);
    this.calls.push(`writeFile ${key} (${typeof options.data === 'string' ? options.data.length : 'blob'})`);
    const data = this.decode(options.data, 'writeFile');
    const existing = this.get(key);
    if (existing?.type === 'directory') this.fail('OS-PLUG-FILE-0009', "'writeFile' not supported for directories.", 'The supplied path is a directory.');
    this.requireParent(key, options.recursive === true);
    const now = ++this.clock;
    this.entries.set(key, { type: 'file', data, mtime: now, ctime: existing?.ctime ?? now });
    return { uri: `fake:${key}` };
  }

  async appendFile(options: AppendOptions): Promise<void> {
    const key = this.key(options.directory, options.path);
    this.calls.push(`appendFile ${key} (${options.data.length})`);
    const data = this.decode(options.data, 'appendFile');
    const existing = this.get(key);
    if (existing?.type === 'directory') this.fail('OS-PLUG-FILE-0009', "'appendFile' not supported for directories.", 'The supplied path is a directory.');
    this.requireParent(key, false);
    const now = ++this.clock;
    const previous = existing?.type === 'file' ? existing.data : new Uint8Array(0);
    const joined = new Uint8Array(previous.byteLength + data.byteLength);
    joined.set(previous, 0);
    joined.set(data, previous.byteLength);
    this.entries.set(key, { type: 'file', data: joined, mtime: now, ctime: existing?.ctime ?? now });
  }

  private requireParent(key: string, recursive: boolean): void {
    const parent = this.parentKey(key);
    const entry = this.get(parent);
    if (entry?.type === 'directory') return;
    if (entry) this.fail('OS-PLUG-FILE-0013', "failed with: the parent is a file", 'Parent directory of the to path is a file');
    if (!recursive) {
      this.fail(
        'OS-PLUG-FILE-0011',
        'Missing parent directory – possibly recursive=false was passed or parent directory creation failed.',
        'Parent directory must exist',
      );
    }
    this.requireParent(parent, true);
    const now = ++this.clock;
    this.entries.set(parent, { type: 'directory', mtime: now, ctime: now });
  }

  async deleteFile(options: PathOptions): Promise<void> {
    const key = this.key(options.directory, options.path);
    this.calls.push(`deleteFile ${key}`);
    const entry = this.get(key);
    if (!entry) this.missing('deleteFile', options.path, 'File does not exist.');
    if (entry.type === 'directory') this.fail('OS-PLUG-FILE-0009', "'deleteFile' not supported for directories.", 'Folder is not empty.');
    this.entries.delete(key);
  }

  async mkdir(options: RecursiveOptions): Promise<void> {
    const key = this.key(options.directory, options.path);
    this.calls.push(`mkdir ${key}`);
    if (this.get(key)) {
      this.fail('OS-PLUG-FILE-0010', `Directory at '${options.path}' already exists, cannot be overwritten.`, 'Current directory does already exist.');
    }
    this.requireParent(key, options.recursive === true);
    const now = ++this.clock;
    this.entries.set(key, { type: 'directory', mtime: now, ctime: now });
  }

  async rmdir(options: RecursiveOptions): Promise<void> {
    const key = this.key(options.directory, options.path);
    this.calls.push(`rmdir ${key}`);
    const entry = this.get(key);
    if (!entry) this.missing('rmdir', options.path, 'Folder does not exist.');
    if (entry.type !== 'directory') {
      this.fail('OS-PLUG-FILE-0009', "'rmdir' not supported for files, only directories are supported.", 'Requested path is not a directory');
    }
    const prefix = `${key}/`;
    const below = [...this.entries.keys()].filter((k) => k.startsWith(prefix));
    if (below.length && !options.recursive) {
      this.fail(
        'OS-PLUG-FILE-0012',
        'Cannot delete directory with children; received recursive=false but directory has contents.',
        'Folder is not empty',
      );
    }
    for (const k of below) this.entries.delete(k);
    this.entries.delete(key);
  }

  async readdir(options: PathOptions): Promise<{ files: Array<ReturnType<FakeFilesystemPlugin['info']>> }> {
    const key = this.key(options.directory, options.path);
    this.calls.push(`readdir ${key}`);
    const entry = this.get(key);
    if (!entry) this.missing('readdir', options.path, 'Folder does not exist.');
    if (entry.type !== 'directory') {
      this.fail('OS-PLUG-FILE-0009', "'readdir' not supported for files, only directories are supported.", 'Requested path is not a directory');
    }
    return { files: this.childrenOf(key).map((k) => this.info(k, this.entries.get(k) as FakeEntry)) };
  }

  async stat(options: PathOptions): Promise<ReturnType<FakeFilesystemPlugin['info']>> {
    const key = this.key(options.directory, options.path);
    this.calls.push(`stat ${key}`);
    const entry = this.get(key);
    if (!entry) this.missing('stat', options.path, 'Entry does not exist.');
    return this.info(key, entry);
  }

  async rename(options: RenameOptions): Promise<void> {
    const from = this.key(options.directory, options.from);
    const to = this.key(options.toDirectory ?? options.directory, options.to);
    this.calls.push(`rename ${from} -> ${to}`);
    const moved = this.get(from);
    if (!moved) this.missing('rename', options.from, 'Entry does not exist.');
    if (from === to) return;
    const parent = this.get(this.parentKey(to));
    if (!parent) {
      this.fail(
        'OS-PLUG-FILE-0011',
        'Missing parent directory – possibly recursive=false was passed or parent directory creation failed.',
        'Entry does not exist.',
      );
    }
    const target = this.get(to);
    if (target?.type === 'directory') {
      this.fail('OS-PLUG-FILE-0010', `Directory at '${options.to}' already exists, cannot be overwritten.`, 'Cannot overwrite a directory with a file');
    }
    // What the real plugin does with an existing file differs per platform; the VFS never asks.
    if (target) this.renamedOverExisting.push(to);
    const prefix = `${from}/`;
    const subtree = [...this.entries.keys()].filter((k) => k === from || k.startsWith(prefix));
    for (const k of subtree) {
      const entry = this.entries.get(k) as FakeEntry;
      this.entries.delete(k);
      this.entries.set(to + k.slice(from.length), entry);
    }
  }

  /** Every stored file below `prefix` (e.g. 'DATA:diary/') with its bytes, sorted. */
  files(prefix = ''): Map<string, Uint8Array> {
    const out = new Map<string, Uint8Array>();
    for (const key of [...this.entries.keys()].sort()) {
      const entry = this.entries.get(key) as FakeEntry;
      if (entry.type === 'file' && key.startsWith(prefix)) out.set(key.slice(prefix.length), entry.data.slice());
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// The plugin's real web implementation
// ---------------------------------------------------------------------------

/** One row of the web implementation's object store ('FileStorage', key `path`, index on `folder`). */
export interface WebRecord {
  path: string;
  folder: string;
  type: 'file' | 'directory';
  size: number;
  ctime: number;
  mtime: number;
  content?: string | Blob;
}

/** An IDBRequest that already ran: the outcome is announced in a microtask, after the handlers were set. */
class MiniRequest<T> {
  result: T | undefined = undefined;
  error: unknown = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(run: () => T) {
    let failed = false;
    try {
      this.result = run();
    } catch (e) {
      failed = true;
      this.error = e;
    }
    queueMicrotask(() => (failed ? this.onerror?.() : this.onsuccess?.()));
  }
}

/**
 * The part of an IDBDatabase the web implementation of the Filesystem plugin uses: one object
 * store keyed by `path` (get / put / delete / clear) with the index 'by_folder' (getAllKeys).
 * Rows are copied on the way in and out, like the structured clone of the real thing.
 */
export class MiniIndexedDb {
  readonly records = new Map<string, WebRecord>();

  transaction(_stores: string[], _mode?: string): { objectStore(name: string): unknown } {
    const records = this.records;
    const store = {
      get: (key: string) => new MiniRequest(() => (records.has(key) ? { ...(records.get(key) as WebRecord) } : undefined)),
      put: (row: WebRecord) =>
        new MiniRequest(() => {
          records.set(row.path, { ...row });
          return row.path;
        }),
      delete: (key: string) => new MiniRequest(() => void records.delete(key)),
      clear: () => new MiniRequest(() => records.clear()),
      index: (_name: string) => ({
        getAllKeys: (range: string | { lower: string }) => {
          const folder = typeof range === 'string' ? range : range.lower;
          return new MiniRequest(() =>
            [...records.values()]
              .filter((row) => row.folder === folder)
              .map((row) => row.path)
              .sort(),
          );
        },
      }),
    };
    return { objectStore: () => store };
  }
}

/** A new instance of the plugin's web implementation that stores in `db` instead of the browser's IndexedDB. */
export function realWebPlugin(db: MiniIndexedDb): FilesystemLike {
  // The implementation names the global IDBKeyRange; outside a browser there is none.
  const scope = globalThis as unknown as { IDBKeyRange?: { only(value: string): unknown } };
  scope.IDBKeyRange ??= { only: (value: string) => value };
  const plugin = new FilesystemWeb();
  // initDb() opens `indexedDB` of `window` only while no database is set.
  (plugin as unknown as { _db: unknown })._db = db;
  return plugin;
}

// ---------------------------------------------------------------------------
// Fault injection
// ---------------------------------------------------------------------------

const MUTATING: readonly StorageOp[] = ['write', 'rename', 'remove', 'mkdir'];

interface Fault {
  op: StorageOp;
  path: RegExp | null;
  /** rename only: the target must match as well. */
  to: RegExp | null;
  code: StorageErrorCode;
  once: boolean;
  /** The call is carried out and reported as failed afterwards. */
  performed: boolean;
}

/** A promise that never settles: what a call into a dead process looks like. */
function hang<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

export class FaultyStorage implements StorageBackend {
  /** Every call that reached the storage, in order: `write users/a.mpd.tmp-1`, `rename a -> b`. */
  readonly calls: string[] = [];
  /** Mutating calls (write / rename / remove / mkdir) seen since the last `crashAt` or construction. */
  mutations = 0;
  private faults: Fault[] = [];
  private crashOn = 0;
  private torn = false;
  private dead = false;
  private announceCrash: () => void = () => undefined;
  /** Resolves when the armed crash happened. */
  crashed: Promise<void> = hang();

  constructor(private readonly inner: StorageBackend) {}

  /** The next matching call fails with `code` (and does nothing). */
  failNext(op: StorageOp, path: RegExp | null = null, code: StorageErrorCode = 'EIO'): void {
    this.faults.push({ op, path, to: null, code, once: true, performed: false });
  }

  /** The next rename of a path matching `from` to a path matching `to` fails with EIO (and does nothing). */
  failNextRename(from: RegExp, to: RegExp): void {
    this.faults.push({ op: 'rename', path: from, to, code: 'EIO', once: true, performed: false });
  }

  /**
   * The next matching call is carried out and THEN fails with ETIMEDOUT: a call that timed out in
   * the worker while the main thread still ran it (mobile/core/vfs/rpc-backend.ts).
   */
  timeoutNext(op: StorageOp, path: RegExp | null = null): void {
    this.faults.push({ op, path, to: null, code: 'ETIMEDOUT', once: true, performed: true });
  }

  /** Every matching call fails until `repair()`. */
  failAlways(op: StorageOp, path: RegExp | null = null, code: StorageErrorCode = 'EIO'): void {
    this.faults.push({ op, path, to: null, code, once: false, performed: false });
  }

  repair(): void {
    this.faults = [];
  }

  /**
   * The process dies at the `n`-th mutating call from now: that call and every later call never
   * return and change nothing - except, with `torn`, a write that leaves the first half of its
   * bytes behind (a file caught in the middle of being written).
   */
  crashAt(n: number, options: { torn?: boolean } = {}): void {
    this.mutations = 0;
    this.crashOn = n;
    this.torn = options.torn === true;
    this.crashed = new Promise<void>((resolve) => {
      this.announceCrash = resolve;
    });
  }

  get isDead(): boolean {
    return this.dead;
  }

  /** Resolves with the error to throw AFTER the call was carried out (`timeoutNext`), else with null. */
  private async before(op: StorageOp, path: string, to?: string, bytes?: Uint8Array): Promise<StorageError | null> {
    if (this.dead) return hang();
    if (MUTATING.includes(op)) {
      this.mutations++;
      if (this.crashOn && this.mutations === this.crashOn) {
        this.dead = true;
        if (this.torn && op === 'write' && bytes) {
          try {
            await this.inner.write(path, bytes.subarray(0, bytes.byteLength >> 1));
          } catch {
            /* the torn write did not even start */
          }
        }
        this.announceCrash();
        return hang();
      }
    }
    this.calls.push(to === undefined ? `${op} ${path}` : `${op} ${path} -> ${to}`);
    const fault = this.faults.find((f) => f.op === op && (!f.path || f.path.test(path)) && (!f.to || (to !== undefined && f.to.test(to))));
    if (fault) {
      if (fault.once) this.faults.splice(this.faults.indexOf(fault), 1);
      const error = new StorageError(fault.code, `${fault.code}: injected failure (${op} '${path}')`);
      if (!fault.performed) throw error;
      return error;
    }
    return null;
  }

  private async run<T>(late: StorageError | null, call: () => Promise<T>): Promise<T> {
    const result = await call();
    if (late) throw late;
    return result;
  }

  async list(dir: string): Promise<StorageEntry[]> {
    return this.run(await this.before('list', dir), () => this.inner.list(dir));
  }
  async read(path: string): Promise<Uint8Array> {
    return this.run(await this.before('read', path), () => this.inner.read(path));
  }
  async write(path: string, bytes: Uint8Array): Promise<void> {
    return this.run(await this.before('write', path, undefined, bytes), () => this.inner.write(path, bytes));
  }
  async rename(from: string, to: string): Promise<void> {
    return this.run(await this.before('rename', from, to), () => this.inner.rename(from, to));
  }
  async remove(path: string): Promise<void> {
    return this.run(await this.before('remove', path), () => this.inner.remove(path));
  }
  async mkdir(path: string): Promise<void> {
    return this.run(await this.before('mkdir', path), () => this.inner.mkdir(path));
  }
  async stat(path: string): Promise<StorageStat | null> {
    return this.run(await this.before('stat', path), () => this.inner.stat(path));
  }
}

// ---------------------------------------------------------------------------
// Message ports
// ---------------------------------------------------------------------------

type PortListener = (event: MessageEvent<unknown>) => void;
type PortMessage = StorageRpcRequest | StorageRpcResponse;

export class FakePort implements StoragePort {
  peer: FakePort | null = null;
  /** What this end posted (as given, before cloning) and the transfer list of each message. */
  readonly posted: PortMessage[] = [];
  readonly transfers: Transferable[][] = [];
  /** When set, nothing posted from this end arrives (an answer that never comes). */
  silent = false;
  private readonly listeners = new Set<PortListener>();

  postMessage(message: PortMessage, transfer: Transferable[]): void {
    this.posted.push(message);
    this.transfers.push(transfer);
    // The real thing: a structured clone, with the transferred buffers detached on this side.
    const data = structuredClone(message, { transfer });
    if (this.silent) return;
    queueMicrotask(() => this.peer?.deliver(data));
  }

  /** Delivers any value to this end's listeners (also used to play a foreign or malformed message). */
  deliver(data: unknown): void {
    for (const listener of [...this.listeners]) listener(new MessageEvent('message', { data }));
  }

  addEventListener(_type: 'message', listener: PortListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: PortListener): void {
    this.listeners.delete(listener);
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

/** Two connected ports: `worker` is the core's end, `host` the main thread's. */
export function portPair(): { worker: FakePort; host: FakePort } {
  const worker = new FakePort();
  const host = new FakePort();
  worker.peer = host;
  host.peer = worker;
  return { worker, host };
}

// ---------------------------------------------------------------------------
// The storages the suites run against
// ---------------------------------------------------------------------------

export interface StorageFixture {
  /** A new connection to the same stored files (what a restarted app gets). */
  open(): StorageBackend;
  /** Every stored file by its storage path, with its bytes. */
  files(): Map<string, Uint8Array>;
  /** Asserts what the fixture can check about how it was used. */
  verify(): void;
}

export interface StorageKind {
  name: string;
  /** The size of the "large diary" a suite may store on this kind in reasonable time. */
  largeFileBytes: number;
  create(): StorageFixture;
}

const LARGE = 3 * 1024 * 1024 + 17;

/** A small chunk size, so files of a few dozen bytes already take several bridge calls. */
const TEST_CHUNK_BYTES = 12;

function capacitorKind(name: string, flavour: 'native' | 'web', chunkBytes = TEST_CHUNK_BYTES): StorageKind {
  return {
    name,
    // With 12-byte chunks 60 kB is already 5000 bridge calls.
    largeFileBytes: 60_000,
    create(): StorageFixture {
      const plugin = new FakeFilesystemPlugin({ flavour });
      return {
        // Like createCapacitorFilesystemStorage(): chunked reads only where the plugin supports them.
        open: () => new CapacitorFilesystemStorage(plugin, { chunkBytes, web: flavour === 'web' }),
        files: () => plugin.files('DATA:diary/'),
        verify: () => {
          if (plugin.renamedOverExisting.length) throw new Error(`renamed over existing files: ${plugin.renamedOverExisting.join(', ')}`);
          const outside = [...plugin.files().keys()].filter((key) => !key.startsWith('DATA:diary/'));
          if (outside.length) throw new Error(`files outside the storage root: ${outside.join(', ')}`);
        },
      };
    },
  };
}

/** The real web implementation of the plugin (it keeps a file as one base64 string, so appends are slow: larger chunks). */
function realWebKind(chunkBytes = 3 * 1024): StorageKind {
  const root = '/DATA/diary';
  return {
    name: "Capacitor backend (the plugin's real web implementation)",
    largeFileBytes: 60_000,
    create(): StorageFixture {
      const db = new MiniIndexedDb();
      const plugin = realWebPlugin(db);
      return {
        open: () => new CapacitorFilesystemStorage(plugin, { chunkBytes, web: true }),
        files: () => {
          const out = new Map<string, Uint8Array>();
          for (const path of [...db.records.keys()].sort()) {
            const row = db.records.get(path) as WebRecord;
            if (row.type !== 'file' || !path.startsWith(`${root}/`)) continue;
            out.set(path.slice(root.length + 1), base64ToBytes(typeof row.content === 'string' ? row.content : ''));
          }
          return out;
        },
        verify: () => {
          const outside = [...db.records.keys()].filter((path) => path !== root && !path.startsWith(`${root}/`));
          if (outside.length) throw new Error(`entries outside the storage root: ${outside.join(', ')}`);
        },
      };
    },
  };
}

export const STORAGE_KINDS: StorageKind[] = [
  {
    name: 'memory backend',
    largeFileBytes: LARGE,
    create(): StorageFixture {
      const store = new MemoryStorage();
      return { open: () => store, files: () => store.files(), verify: () => undefined };
    },
  },
  capacitorKind('Capacitor backend (native plugin behaviour)', 'native'),
  capacitorKind('Capacitor backend (web plugin behaviour)', 'web'),
  {
    name: 'worker RPC to a memory backend',
    largeFileBytes: LARGE,
    create(): StorageFixture {
      const store = new MemoryStorage();
      return {
        open: () => {
          const { worker, host } = portPair();
          serveStorage(host, store);
          return createRpcStorage(worker, { timeoutMs: 0 });
        },
        files: () => store.files(),
        verify: () => undefined,
      };
    },
  },
  realWebKind(),
];

/**
 * The same kinds for the suites that store real diary containers (some 100 kB each, many times):
 * the Capacitor fixtures use 16 kB chunks there - still several bridge calls per file.
 */
export const SERVER_STORAGE_KINDS: StorageKind[] = [
  STORAGE_KINDS[0],
  capacitorKind('Capacitor backend (native plugin behaviour)', 'native', 3 * 5461),
  capacitorKind('Capacitor backend (web plugin behaviour)', 'web', 3 * 5461),
  STORAGE_KINDS[3],
  realWebKind(3 * 5461),
];

/** `files()` as plain text, for readable assertions. */
export function textFiles(files: Map<string, Uint8Array>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, bytes] of files) out[path] = text(bytes);
  return out;
}
