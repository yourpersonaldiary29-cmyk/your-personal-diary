/**
 * The virtual file system of the mobile diary core (docs/ANDROID-PLAN.md, section 2).
 *
 * server/src reads and writes its files synchronously (registries) and through fs.promises (the
 * diary files). In the phone the core runs in a Web Worker that has no file system: the files live
 * in the app-private directory, reachable only asynchronously through a `StorageBackend`
 * (mobile/shared/storage-protocol.ts). This class bridges the two:
 *
 * THE MIRROR. `boot()` loads every file of the storage into memory, below `dataRoot` (`/data`).
 * From then on every read is answered from memory and every mutation changes memory at once - so
 * the synchronous API works - and queues the same change for the storage (write-behind).
 *
 * THE QUEUE. One FIFO for all files: the storage sees the changes in exactly the order the core
 * made them (a rename concerns two files, so per-file queues could not keep that order). Each
 * change is applied with primitives that are atomic on any backend - a write to a temporary name,
 * a rename onto a name that does not exist, a delete:
 *
 *   write X          write X.tmp-N;  [X exists: rename X -> X.old-N];  rename X.tmp-N -> X;  [remove X.old-N]
 *   rename A -> B    [B exists: rename B -> B.old-N];  rename A -> B;  [remove B.old-N]
 *
 * A rename over an existing file is never asked of the backend: @capacitor/filesystem deletes the
 * target first on some platforms, which would leave a moment with no file at all. B may also be a
 * directory - the empty one a directory rename replaces: it is moved aside and deleted afterwards
 * in the same way, never deleted first.
 *
 * TEMPORARY FILES. Every `X.tmp-N` / `X.old-N` is registered BEFORE the call that creates it and
 * stays registered until the storage confirmed that it is gone: a call that was reported as failed
 * may have run all the same (a call that timed out in the worker is still executed by the main
 * thread). Two rules keep them from ever being taken for the file itself:
 *
 *   - before X leaves the storage (it is deleted, or renamed away) every registered `X.old-N` is
 *     deleted first; when that is not possible the change fails and X stays where it is;
 *   - what is registered is deleted as soon as X is in its final state, and again by every
 *     `drain()` - but never while X is out of sync: then `X.old-N` may be its only stored version.
 *
 * RECOVERY. If the process dies in the middle, the next `boot()` finds at most these leftovers and
 * repairs them before anything is read: `X.old-N` without `X` is renamed back to `X` (the change
 * did not happen), `X.old-N` next to `X` is deleted (it did), every `X.tmp-N` is deleted (possibly
 * half written). So the storage always holds, for every file, a complete previous or new version -
 * and the server's own safety nets (`<file>.tmp`, `.mpd.prev`) work on top exactly as on the desktop.
 * The same holds for a directory that was moved aside: `X.old-N` is taken by its name, whatever it is.
 *
 * DURABILITY. `drain()` resolves once everything queued so far is in the storage. The core awaits
 * it before it answers a request and when the app is paused. The fs.promises facade resolves an
 * operation only when that operation is durable (`whenDurable`), so the vault marks its database
 * clean only when the bytes really are in the storage.
 *
 * FAILURES. A change the storage refused is logged, makes the next `drain()` reject with EIO and
 * makes the next mutating operation on that file throw EIO (once) - unless a caller awaited the
 * change itself, who then gets the rejection instead. The mirror stays the truth: the affected
 * paths are remembered as out of sync, later queued changes that depend on them are held back,
 * and they are written again from the mirror by the next change of that file or by the `drain()`
 * after the one that reported the failure. That re-sync first stores what the mirror has and only
 * then deletes what it no longer has - and deletes nothing while a store failed: after a failed
 * rename the old name may hold the only stored copy of the file.
 *
 * AREAS. Only paths below `dataRoot` are stored. `/assets` holds read-only files handed in with
 * `registerAsset` (sql-wasm.wasm, fonts). A prefix registered with `markVolatile` and everything
 * outside `dataRoot` live in memory only and are never sent to the backend. Without a backend the
 * whole VFS is memory-only.
 *
 * MEMORY. The mirror holds every stored file, the diaries included: a diary of S bytes costs about
 * 2 x S (`.mpd` + `.mpd.prev`) permanently and up to about 4 x S for a moment while it is saved
 * (the new `.mpd.tmp` plus the copy that travels to the main thread).
 */
import {
  storageJoin,
  storageParent,
  toStorageError,
  type StorageBackend,
  type StorageEntry,
} from '../../shared/storage-protocol';
import { baseNameOf, fsError, isWithin, normalizePath, parentOf, rmIsDirectoryError, type FsError, type FsErrorCode } from './errors';

export type VfsLogLevel = 'info' | 'warn' | 'error';

export interface VfsOptions {
  /** Where the files below `dataRoot` are stored. None: everything stays in memory. */
  backend?: StorageBackend | null;
  /** Virtual directory of the stored files. Default: '/data'. */
  dataRoot?: string;
  /** Virtual directory of the read-only assets. Default: '/assets'. */
  assetsRoot?: string;
  /** Diagnostics (paths and error codes only, never file content). Default: console. */
  log?: (level: VfsLogLevel, message: string) => void;
  /** Clock of the modification times (tests). Default: Date.now. */
  now?: () => number;
}

export interface VfsStat {
  kind: 'file' | 'dir';
  size: number;
  mtimeMs: number;
  birthtimeMs: number;
}

export interface VfsDirEntry {
  name: string;
  kind: 'file' | 'dir';
}

/** How `open` treats the file ('w' truncates, 'wx' must create, 'a' appends, 'r+' updates in place). */
export interface OpenMode {
  writable: boolean;
  create: boolean;
  truncate: boolean;
  exclusive: boolean;
  append: boolean;
}

interface FileNode {
  kind: 'file';
  /** Never mutated in place: a change replaces the array, so a queued write can keep its reference. */
  data: Uint8Array;
  mtimeMs: number;
  birthtimeMs: number;
  /** Registered with `registerAsset`: read-only. */
  asset: boolean;
}

interface DirNode {
  kind: 'dir';
  mtimeMs: number;
  birthtimeMs: number;
}

type MirrorNode = FileNode | DirNode;

/** One change for the storage; paths are storage paths (relative to `dataRoot`). */
type NativeOp =
  | { kind: 'write'; path: string; bytes: Uint8Array }
  | { kind: 'rename'; path: string; to: string }
  | { kind: 'remove'; path: string }
  | { kind: 'mkdir'; path: string };

/** A queued change. Handed out (opaquely) so the promise API can wait for it: `whenDurable`. */
export interface WriteTicket {
  /** @internal */ op: NativeOp;
  /** @internal */ started: boolean;
  /** @internal True once a caller waits for the outcome: the failure goes to that caller. */
  awaited: boolean;
  /** @internal */ settled: Promise<void>;
  /** @internal */ resolve(): void;
  /** @internal */ reject(error: FsError): void;
}

interface Descriptor {
  path: string;
  writable: boolean;
  append: boolean;
  position: number;
  /** Written since the last flush to the queue. */
  dirty: boolean;
}

/** A failure nobody awaited: thrown (once) by the next mutating operation on one of its files. */
interface StickyFailure {
  detail: string;
  paths: Set<string>;
}

type Area = 'assets' | 'persistent' | 'memory';

/**
 * What the storage should hold at a path (a snapshot of the mirror, taken for a re-sync). 'open':
 * a file the core is writing through a descriptor right now - neither stored nor deleted.
 */
type Wanted = { kind: 'file'; bytes: Uint8Array } | { kind: 'dir'; children: Map<string, Wanted> } | { kind: 'open' };

/** Names the VFS itself creates in the storage; the core may not use them for its own files. */
const LEFTOVER = /^(.+)\.(tmp|old)-(\d+)$/;
const EMPTY = new Uint8Array(0);

const SYSCALL_OF: Record<NativeOp['kind'], string> = { write: 'write', rename: 'rename', remove: 'rm', mkdir: 'mkdir' };

function defaultLog(level: VfsLogLevel, message: string): void {
  console[level](`[vfs] ${message}`);
}

/** The strict ancestors of a storage path, nearest first ('a/b/c' -> ['a/b', 'a']). The root is not listed. */
function ancestorsOf(path: string): string[] {
  const out: string[] = [];
  for (let p = storageParent(path); p !== ''; p = storageParent(p)) out.push(p);
  return out;
}

function isBelow(path: string, dir: string): boolean {
  return path.startsWith(`${dir}/`);
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(a, 0);
  out.set(b, a.byteLength);
  return out;
}

export class Vfs {
  readonly dataRoot: string;
  readonly assetsRoot: string;

  private readonly backend: StorageBackend | null;
  private readonly log: (level: VfsLogLevel, message: string) => void;
  private readonly now: () => number;

  /** The mirror: every file and directory by its normalised virtual path. */
  private readonly nodes = new Map<string, MirrorNode>();
  private readonly volatile: string[] = [];
  private readonly descriptors = new Map<number, Descriptor>();
  private nextFd = 3;

  private booted: boolean;
  private booting: Promise<void> | null = null;

  /** Changes waiting for the storage, oldest first. */
  private readonly queue: WriteTicket[] = [];
  /** The newest queued change of each virtual path (for fsync). */
  private readonly lastTicket = new Map<string, WriteTicket>();
  private pumping: Promise<void> | null = null;
  /** What the VFS knows to be in the storage (storage paths). */
  private readonly disk = new Map<string, 'file' | 'dir'>();
  /** Storage paths whose content in the storage may differ from the mirror. */
  private readonly poisoned = new Set<string>();
  /**
   * Temporary files (`X.tmp-N`, `X.old-N`: storage names) that may exist in the storage. A name is
   * added before the call that creates it and removed only when the storage confirmed that it is gone.
   */
  private readonly garbage = new Set<string>();
  private readonly sticky = new Map<string, StickyFailure>();
  /** The failure the next `drain()` reports. */
  private undrained: FsError | null = null;
  /** Out-of-sync paths are rewritten from the mirror the next time the queue runs empty. */
  private resyncDue = false;
  /** Registered temporary files are deleted the next time the queue runs empty. */
  private sweepDue = false;
  private counter = 0;

  constructor(options: VfsOptions = {}) {
    this.backend = options.backend ?? null;
    this.dataRoot = normalizePath(options.dataRoot ?? '/data');
    this.assetsRoot = normalizePath(options.assetsRoot ?? '/assets');
    if (this.dataRoot === '/' || this.assetsRoot === '/' || isWithin(this.dataRoot, this.assetsRoot) || isWithin(this.assetsRoot, this.dataRoot)) {
      throw new Error('The VFS needs two separate directories for the data and the assets.');
    }
    this.log = options.log ?? defaultLog;
    this.now = options.now ?? Date.now;
    this.booted = this.backend === null;
    const created = this.now();
    this.nodes.set('/', { kind: 'dir', mtimeMs: created, birthtimeMs: created });
    this.makeDirs(this.dataRoot);
    this.makeDirs(this.assetsRoot);
  }

  // ---------------------------------------------------------------------------
  // Set-up
  // ---------------------------------------------------------------------------

  /** True once the stored files are in the mirror (at once when there is no backend). */
  get isBooted(): boolean {
    return this.booted;
  }

  /**
   * Makes a read-only file visible at `path` (sql-wasm.wasm, fonts: fetched by the host from the
   * app's web assets). Parent directories are created. The bytes are kept as given, not copied.
   */
  registerAsset(path: string, bytes: Uint8Array): void {
    const target = normalizePath(path);
    if (isWithin(target, this.dataRoot)) throw fsError('EINVAL', 'open', target, undefined, 'an asset cannot live in the data directory');
    if (this.nodes.get(target)?.kind === 'dir') throw fsError('EISDIR', 'open', target);
    this.makeDirs(parentOf(target));
    const at = this.now();
    this.nodes.set(target, { kind: 'file', data: bytes, mtimeMs: at, birthtimeMs: at, asset: true });
  }

  /**
   * Nothing at or below `prefix` is ever sent to the backend from now on: it lives in memory only
   * and is gone when the app stops (the guest diary of the tour mode, docs/ANDROID-PLAN.md 3.3).
   */
  markVolatile(prefix: string): void {
    const target = normalizePath(prefix);
    if (!this.volatile.includes(target)) this.volatile.push(target);
  }

  /**
   * Repairs what a crash left in the storage (see RECOVERY above) and loads every stored file into
   * the mirror. Until it resolved, any access below `dataRoot` throws EIO - a core that read
   * "no accounts yet" from an unloaded mirror would overwrite the real registry. Safe to call
   * again; after a failure it can be retried.
   */
  boot(): Promise<void> {
    if (this.booted) return Promise.resolve();
    if (!this.booting) {
      this.booting = this.load().then(
        () => {
          this.booted = true;
          this.booting = null;
        },
        (e: unknown) => {
          this.booting = null;
          throw e;
        },
      );
    }
    return this.booting;
  }

  private async load(): Promise<void> {
    const backend = this.backend as StorageBackend;
    await backend.mkdir('');
    const found: Array<{ path: string; entry: StorageEntry; bytes: Uint8Array | null }> = [];
    const walk = async (dir: string): Promise<void> => {
      const entries = await this.recover(dir, await backend.list(dir));
      for (const entry of entries) {
        const path = storageJoin(dir, entry.name);
        if (entry.type === 'directory') {
          found.push({ path, entry, bytes: null });
          await walk(path);
        } else {
          found.push({ path, entry, bytes: await backend.read(path) });
        }
      }
    };
    await walk('');
    // Nothing was put into the mirror before every file was read: a failed boot leaves it empty.
    const at = this.now();
    this.disk.clear();
    for (const { path, entry, bytes } of found) {
      const time = entry.mtimeMs > 0 ? entry.mtimeMs : at;
      const vpath = `${this.dataRoot}/${path}`;
      if (bytes) this.nodes.set(vpath, { kind: 'file', data: bytes, mtimeMs: time, birthtimeMs: time, asset: false });
      else this.nodes.set(vpath, { kind: 'dir', mtimeMs: time, birthtimeMs: time });
      this.disk.set(path, bytes ? 'file' : 'dir');
    }
  }

  /** Repairs the leftovers of an interrupted change in one directory; returns its entries afterwards. */
  private async recover(dir: string, entries: StorageEntry[]): Promise<StorageEntry[]> {
    const backend = this.backend as StorageBackend;
    const names = new Set(entries.map((e) => e.name));
    const olds = new Map<string, Array<{ name: string; n: number }>>();
    const temps: string[] = [];
    for (const entry of entries) {
      const match = LEFTOVER.exec(entry.name);
      if (!match) continue;
      if (match[2] === 'tmp') temps.push(entry.name);
      else olds.set(match[1], [...(olds.get(match[1]) ?? []), { name: entry.name, n: Number(match[3]) }]);
    }
    if (!temps.length && !olds.size) return entries;
    for (const [base, list] of olds) {
      list.sort((a, b) => b.n - a.n);
      let obsolete = list;
      if (!names.has(base)) {
        // The file was moved aside and its replacement never arrived: the change did not happen.
        await backend.rename(storageJoin(dir, list[0].name), storageJoin(dir, base));
        names.add(base);
        obsolete = list.slice(1);
        this.log('warn', `recovered '${storageJoin(dir, base)}' from an interrupted write`);
      }
      for (const old of obsolete) await backend.remove(storageJoin(dir, old.name));
    }
    for (const temp of temps) await backend.remove(storageJoin(dir, temp));
    if (temps.length) this.log('warn', `removed ${temps.length} unfinished temporary file(s) in '${dir || '.'}'`);
    return backend.list(dir);
  }

  // ---------------------------------------------------------------------------
  // Durability
  // ---------------------------------------------------------------------------

  /**
   * Resolves when everything changed so far is in the storage. Rejects with EIO when a change
   * failed since the last call (the mirror still has it; the call after that tries to store it
   * again and reports whether that worked).
   */
  async drain(): Promise<void> {
    await this.idle();
    // The failure was reported before: write the out-of-sync files again from the mirror.
    if (!this.undrained && this.poisoned.size) this.resyncDue = true;
    // Temporary files that could not be deleted when they became obsolete: try again.
    if (this.garbage.size) this.sweepDue = true;
    if (this.resyncDue || this.sweepDue) {
      this.kick();
      await this.idle();
    }
    if (this.undrained) {
      const error = this.undrained;
      this.undrained = null;
      throw error;
    }
  }

  /** Resolves when the queue is empty (whatever the outcome of the changes was). */
  async idle(): Promise<void> {
    while (this.pumping) await this.pumping;
  }

  /** Resolves when the change of `ticket` is in the storage; rejects with EIO when it failed. */
  whenDurable(ticket: WriteTicket | null): Promise<void> {
    if (!ticket) return Promise.resolve();
    ticket.awaited = true;
    return ticket.settled;
  }

  /** Storage paths that are currently not in sync with the mirror (diagnostics, tests). */
  outOfSync(): string[] {
    return [...this.poisoned].sort();
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  exists(path: string): boolean {
    const target = normalizePath(path);
    this.requireLoaded(target, 'access');
    return this.nodes.has(target);
  }

  access(path: string): void {
    const target = normalizePath(path);
    this.requireLoaded(target, 'access');
    this.lookup(target, 'access');
  }

  /** The bytes of a file - the mirror's own array: callers must copy before changing it. */
  readFile(path: string): Uint8Array {
    const target = normalizePath(path);
    this.requireLoaded(target, 'open');
    const node = this.lookup(target, 'open');
    if (node.kind !== 'file') throw fsError('EISDIR', 'read');
    return node.data;
  }

  stat(path: string, syscall = 'stat'): VfsStat {
    const target = normalizePath(path);
    this.requireLoaded(target, syscall);
    return this.statOf(this.lookup(target, syscall));
  }

  /** `stat` that returns null instead of throwing ENOENT / ENOTDIR. */
  statOrNull(path: string): VfsStat | null {
    const target = normalizePath(path);
    this.requireLoaded(target, 'stat');
    const node = this.nodes.get(target);
    return node ? this.statOf(node) : null;
  }

  readdir(path: string): VfsDirEntry[] {
    const target = normalizePath(path);
    this.requireLoaded(target, 'scandir');
    const node = this.lookup(target, 'scandir');
    if (node.kind !== 'dir') throw fsError('ENOTDIR', 'scandir', target);
    return this.childrenOf(target).map((child) => ({ name: baseNameOf(child), kind: (this.nodes.get(child) as MirrorNode).kind }));
  }

  // ---------------------------------------------------------------------------
  // Mutations (memory at once, the storage through the queue)
  // ---------------------------------------------------------------------------

  /**
   * `mode`: 'w' replaces, 'wx' fails with EEXIST when the file exists, 'a' appends.
   * `bytes` is kept as the file's content, not copied: pass an array nobody else changes.
   */
  writeFile(path: string, bytes: Uint8Array, mode: 'w' | 'wx' | 'a' = 'w'): WriteTicket | null {
    const target = normalizePath(path);
    this.beforeChange(target, 'open');
    const existing = this.nodes.get(target);
    if (existing?.kind === 'dir') throw fsError('EISDIR', 'open', target);
    if (!existing) {
      this.requireParentDir(target, (code) => fsError(code, 'open', target));
      this.refuseReservedName(target, 'open');
    } else if (mode === 'wx') {
      throw fsError('EEXIST', 'open', target);
    }
    this.setFile(target, existing && mode === 'a' ? concat(existing.data, bytes) : bytes);
    return this.queueWrite(target);
  }

  /** Returns the first directory that was created (recursive mode), like Node. */
  mkdir(path: string, recursive: boolean): { first: string | undefined; ticket: WriteTicket | null } {
    const target = normalizePath(path);
    this.beforeChange(target, 'mkdir');
    const existing = this.nodes.get(target);
    if (!recursive) {
      if (existing) throw fsError('EEXIST', 'mkdir', target);
      this.requireParentDir(target, (code) => fsError(code, 'mkdir', target));
      this.refuseReservedName(target, 'mkdir');
      this.addDir(target);
      return { first: target, ticket: this.queueOp(target, 'mkdir') };
    }
    if (existing?.kind === 'dir') return { first: undefined, ticket: null };
    if (existing) throw fsError('EEXIST', 'mkdir', target);
    // Find the nearest existing ancestor; a file there is ENOTDIR.
    const missing: string[] = [target];
    for (let p = parentOf(target); ; p = parentOf(p)) {
      const node = this.nodes.get(p);
      if (node?.kind === 'dir') break;
      if (node) throw fsError('ENOTDIR', 'mkdir', target);
      missing.push(p);
    }
    missing.reverse();
    for (const dir of missing) this.refuseReservedName(dir, 'mkdir');
    for (const dir of missing) this.addDir(dir);
    // The backend creates missing parents itself: one call for the deepest directory that is stored.
    const deepest = [...missing].reverse().find((dir) => this.areaOf(dir) === 'persistent');
    return { first: missing[0], ticket: deepest ? this.queueOp(deepest, 'mkdir') : null };
  }

  rename(from: string, to: string): WriteTicket | null {
    const source = normalizePath(from, 'oldPath');
    const target = normalizePath(to, 'newPath');
    const fail = (code: FsErrorCode): FsError => fsError(code, 'rename', source, target);
    this.requireLoaded(source, 'rename', target);
    this.requireLoaded(target, 'rename');
    this.surface(source, 'rename', target);
    this.surface(target, 'rename');
    const moved = this.nodes.get(source);
    if (!moved) {
      this.lookup(source, 'rename', target);
      throw fail('ENOENT');
    }
    if (this.isReadOnly(source) || this.isReadOnly(target)) throw fail('EACCES');
    this.requireParentDir(target, fail);
    if (source === target) return null;
    if (isWithin(target, source)) throw fail('EINVAL');
    const replaced = this.nodes.get(target);
    if (replaced) {
      if (moved.kind === 'file' && replaced.kind === 'dir') throw fail('EISDIR');
      if (moved.kind === 'dir' && replaced.kind === 'file') throw fail('ENOTDIR');
      if (moved.kind === 'dir' && this.childrenOf(target).length) throw fail('ENOTEMPTY');
    } else {
      this.refuseReservedName(target, 'rename');
    }
    this.flushDescriptors(source);
    this.flushDescriptors(target);

    const fromArea = this.areaOf(source);
    const toArea = this.areaOf(target);
    // Move the node (and, for a directory, everything below it) in the mirror.
    const prefix = `${source}/`;
    const subtree = moved.kind === 'dir' ? [...this.nodes.keys()].filter((p) => p.startsWith(prefix)) : [];
    this.nodes.delete(target);
    this.nodes.delete(source);
    this.nodes.set(target, moved);
    for (const path of subtree) {
      const node = this.nodes.get(path) as MirrorNode;
      this.nodes.delete(path);
      this.nodes.set(target + path.slice(source.length), node);
    }
    for (const descriptor of this.descriptors.values()) {
      if (descriptor.path === source) descriptor.path = target;
      else if (descriptor.path.startsWith(prefix)) descriptor.path = target + descriptor.path.slice(source.length);
    }
    this.touch(parentOf(source));
    this.touch(parentOf(target));

    if (fromArea === 'persistent' && toArea === 'persistent') {
      return this.enqueue({ kind: 'rename', path: this.storagePath(source), to: this.storagePath(target) }, [source, target]);
    }
    if (fromArea === 'persistent') return this.enqueue({ kind: 'remove', path: this.storagePath(source) }, [source]);
    // From a memory-only area: the content is written. What it replaces is not deleted first - a
    // stored file is replaced atomically by the write, a replaced directory is empty and stays.
    if (toArea === 'persistent') return this.queueSubtree(target);
    return null;
  }

  /** `rm`: a file, or a directory with `recursive`. A missing path is an error unless `force`. */
  remove(path: string, options: { force?: boolean; recursive?: boolean } = {}, syscall = 'rm'): WriteTicket | null {
    const target = normalizePath(path);
    this.beforeChange(target, syscall);
    const node = this.nodes.get(target);
    if (!node) {
      if (options.force) return this.settleAbsent(target);
      // Node reports the lstat it does first.
      this.lookup(target, 'lstat');
      throw fsError('ENOENT', 'lstat', target);
    }
    if (node.kind === 'dir') {
      if (!options.recursive) throw rmIsDirectoryError(target);
      if (isWithin(this.dataRoot, target) || isWithin(this.assetsRoot, target)) throw fsError('EPERM', syscall, target);
    }
    return this.drop(target);
  }

  /**
   * `rm -f` of a path the mirror does not have. The storage may have it all the same: after a
   * change that did not get there (it is deleted now), or while the change that removes it is still
   * queued (whose ticket is then the answer). So the caller is told "gone" only when it is.
   */
  private settleAbsent(path: string): WriteTicket | null {
    if (this.areaOf(path) !== 'persistent') return null;
    const stored = this.storagePath(path);
    if (this.poisoned.has(stored) || this.hasPoisonedBelow(stored) || this.garbageOf(stored, 'old').length) {
      return this.enqueue({ kind: 'remove', path: stored }, [path]);
    }
    return this.lastTicket.get(path) ?? null;
  }

  unlink(path: string): WriteTicket | null {
    const target = normalizePath(path);
    this.beforeChange(target, 'unlink');
    const node = this.lookup(target, 'unlink');
    if (node.kind === 'dir') throw fsError('EISDIR', 'unlink', target);
    return this.drop(target);
  }

  rmdir(path: string): WriteTicket | null {
    const target = normalizePath(path);
    this.beforeChange(target, 'rmdir');
    const node = this.lookup(target, 'rmdir');
    if (node.kind !== 'dir') throw fsError('ENOTDIR', 'rmdir', target);
    if (this.childrenOf(target).length) throw fsError('ENOTEMPTY', 'rmdir', target);
    if (isWithin(this.dataRoot, target) || isWithin(this.assetsRoot, target)) throw fsError('EPERM', 'rmdir', target);
    return this.drop(target);
  }

  // ---------------------------------------------------------------------------
  // File descriptors (the open / write / fsync / close pattern of the JSON registries)
  // ---------------------------------------------------------------------------

  /**
   * Opens a file. What is written through the descriptor is in the mirror at once and is queued
   * for the storage by `fdSync` and `fdClose` - like an operating system that writes its cache
   * out on fsync.
   */
  open(path: string, mode: OpenMode): number {
    const target = normalizePath(path);
    this.requireLoaded(target, 'open');
    if (mode.writable) {
      this.surface(target, 'open');
      this.refuseReadOnly(target, 'open');
    }
    const existing = this.nodes.get(target);
    let dirty = false;
    if (existing?.kind === 'dir') throw fsError('EISDIR', 'open', target);
    if (!existing) {
      if (!mode.create) {
        this.lookup(target, 'open');
        throw fsError('ENOENT', 'open', target);
      }
      this.requireParentDir(target, (code) => fsError(code, 'open', target));
      this.refuseReservedName(target, 'open');
      this.setFile(target, EMPTY);
      dirty = true;
    } else if (mode.exclusive) {
      throw fsError('EEXIST', 'open', target);
    } else if (mode.truncate) {
      this.setFile(target, EMPTY);
      dirty = true;
    }
    const fd = this.nextFd++;
    this.descriptors.set(fd, { path: target, writable: mode.writable, append: mode.append, position: 0, dirty });
    return fd;
  }

  /**
   * Writes at `position` (null: the descriptor's own position, or the end in append mode). Returns
   * the byte count. `bytes` may be kept as the file's content: pass an array nobody else changes.
   */
  fdWrite(fd: number, bytes: Uint8Array, position: number | null = null): number {
    const descriptor = this.descriptorOf(fd, 'write');
    if (!descriptor.writable) throw fsError('EBADF', 'write');
    const node = this.fileOf(descriptor, 'write');
    const at = descriptor.append ? node.data.byteLength : (position ?? descriptor.position);
    let next = bytes;
    // The common case - the whole file in one write - keeps `bytes` itself (no second copy of a diary).
    if (at !== 0 || bytes.byteLength < node.data.byteLength) {
      next = new Uint8Array(Math.max(node.data.byteLength, at + bytes.byteLength));
      next.set(node.data, 0);
      next.set(bytes, at);
    }
    this.setFile(descriptor.path, next);
    if (position === null || descriptor.append) descriptor.position = at + bytes.byteLength;
    descriptor.dirty = true;
    return bytes.byteLength;
  }

  /** The whole content of the open file (the mirror's own array). */
  fdRead(fd: number): Uint8Array {
    return this.fileOf(this.descriptorOf(fd, 'read'), 'read').data;
  }

  fdStat(fd: number): VfsStat {
    return this.statOf(this.fileOf(this.descriptorOf(fd, 'fstat'), 'fstat'));
  }

  /** Queues what was written through the descriptor; the ticket is the newest change of that file. */
  fdSync(fd: number): WriteTicket | null {
    const descriptor = this.descriptorOf(fd, 'fsync');
    this.surface(descriptor.path, 'fsync');
    return this.flushDescriptor(descriptor) ?? this.lastTicket.get(descriptor.path) ?? null;
  }

  fdClose(fd: number): WriteTicket | null {
    const descriptor = this.descriptorOf(fd, 'close');
    this.descriptors.delete(fd);
    return this.flushDescriptor(descriptor);
  }

  // ---------------------------------------------------------------------------
  // Mirror helpers
  // ---------------------------------------------------------------------------

  private statOf(node: MirrorNode): VfsStat {
    return {
      kind: node.kind,
      size: node.kind === 'file' ? node.data.byteLength : 0,
      mtimeMs: node.mtimeMs,
      birthtimeMs: node.birthtimeMs,
    };
  }

  private areaOf(path: string): Area {
    if (isWithin(path, this.assetsRoot)) return 'assets';
    if (!this.backend || !isWithin(path, this.dataRoot)) return 'memory';
    for (const prefix of this.volatile) if (isWithin(path, prefix)) return 'memory';
    return 'persistent';
  }

  /** The storage path of a virtual path below `dataRoot`. */
  private storagePath(path: string): string {
    return path === this.dataRoot ? '' : path.slice(this.dataRoot.length + 1);
  }

  private virtualPath(storagePath: string): string {
    return storagePath ? `${this.dataRoot}/${storagePath}` : this.dataRoot;
  }

  private requireLoaded(path: string, syscall: string, dest?: string): void {
    if (this.booted || !isWithin(path, this.dataRoot)) return;
    throw fsError('EIO', syscall, path, dest, 'the storage is not loaded yet: boot() has not completed');
  }

  /** Throws (once) the failure of an earlier, un-awaited change of this file. */
  private surface(path: string, syscall: string, dest?: string): void {
    const failure = this.sticky.get(path);
    if (!failure) return;
    for (const p of failure.paths) this.sticky.delete(p);
    throw fsError('EIO', syscall, path, dest, failure.detail);
  }

  private isReadOnly(path: string): boolean {
    const node = this.nodes.get(path);
    return isWithin(path, this.assetsRoot) || (node?.kind === 'file' && node.asset);
  }

  private refuseReadOnly(path: string, syscall: string): void {
    if (this.isReadOnly(path)) throw fsError('EACCES', syscall, path);
  }

  private refuseReservedName(path: string, syscall: string): void {
    if (this.areaOf(path) === 'persistent' && LEFTOVER.test(baseNameOf(path))) {
      throw fsError('EINVAL', syscall, path, undefined, 'names ending in .tmp-<n> or .old-<n> are reserved for the storage');
    }
  }

  /** The checks every mutating operation starts with. */
  private beforeChange(path: string, syscall: string): void {
    this.requireLoaded(path, syscall);
    this.surface(path, syscall);
    this.refuseReadOnly(path, syscall);
  }

  /** The node at `path`, or ENOENT - ENOTDIR when a file is in the way. */
  private lookup(path: string, syscall: string, dest?: string): MirrorNode {
    const node = this.nodes.get(path);
    if (node) return node;
    for (let p = parentOf(path); p !== '/'; p = parentOf(p)) {
      const ancestor = this.nodes.get(p);
      if (!ancestor) continue;
      if (ancestor.kind === 'file') throw fsError('ENOTDIR', syscall, path, dest);
      break;
    }
    throw fsError('ENOENT', syscall, path, dest);
  }

  private requireParentDir(path: string, fail: (code: FsErrorCode) => FsError): void {
    const parent = this.nodes.get(parentOf(path));
    if (parent?.kind === 'dir') return;
    if (parent) throw fail('ENOTDIR');
    for (let p = parentOf(parentOf(path)); p !== '/'; p = parentOf(p)) {
      const ancestor = this.nodes.get(p);
      if (!ancestor) continue;
      if (ancestor.kind === 'file') throw fail('ENOTDIR');
      break;
    }
    throw fail('ENOENT');
  }

  private childrenOf(dir: string): string[] {
    const prefix = dir === '/' ? '/' : `${dir}/`;
    const out: string[] = [];
    for (const path of this.nodes.keys()) {
      if (path !== '/' && path.startsWith(prefix) && path.indexOf('/', prefix.length) < 0) out.push(path);
    }
    return out.sort();
  }

  private touch(dir: string): void {
    const node = this.nodes.get(dir);
    if (node) node.mtimeMs = this.now();
  }

  /** Creates `dir` and its missing parents in the mirror only (set-up; nothing is queued). */
  private makeDirs(dir: string): void {
    const missing: string[] = [];
    for (let p = dir; p !== '/' && !this.nodes.has(p); p = parentOf(p)) missing.push(p);
    for (const p of missing.reverse()) this.addDir(p);
  }

  private addDir(path: string): void {
    const at = this.now();
    this.nodes.set(path, { kind: 'dir', mtimeMs: at, birthtimeMs: at });
    this.touch(parentOf(path));
  }

  /** Sets the content of the file at `path` (creating it). The parent must exist. */
  private setFile(path: string, data: Uint8Array): void {
    const at = this.now();
    const existing = this.nodes.get(path);
    if (existing?.kind === 'file') {
      existing.data = data;
      existing.mtimeMs = at;
      return;
    }
    this.nodes.set(path, { kind: 'file', data, mtimeMs: at, birthtimeMs: at, asset: false });
    this.touch(parentOf(path));
  }

  /** Removes `path` and everything below it from the mirror and queues the removal. */
  private drop(path: string): WriteTicket | null {
    const prefix = `${path}/`;
    const doomed = [...this.nodes.keys()].filter((p) => p === path || p.startsWith(prefix));
    for (const p of doomed) {
      const node = this.nodes.get(p) as MirrorNode;
      if (node.kind === 'file' && node.asset) throw fsError('EACCES', 'rm', p);
    }
    for (const descriptor of this.descriptors.values()) {
      if (descriptor.path === path || descriptor.path.startsWith(prefix)) descriptor.dirty = false;
    }
    for (const p of doomed) this.nodes.delete(p);
    this.touch(parentOf(path));
    return this.queueOp(path, 'remove');
  }

  private descriptorOf(fd: number, syscall: string): Descriptor {
    const descriptor = this.descriptors.get(fd);
    if (!descriptor) throw fsError('EBADF', syscall);
    return descriptor;
  }

  private fileOf(descriptor: Descriptor, syscall: string): FileNode {
    const node = this.nodes.get(descriptor.path);
    // The file was deleted while open: a real descriptor would still work, this one does not.
    if (node?.kind !== 'file') throw fsError('EBADF', syscall);
    return node;
  }

  private flushDescriptor(descriptor: Descriptor): WriteTicket | null {
    if (!descriptor.dirty) return null;
    descriptor.dirty = false;
    return this.nodes.get(descriptor.path)?.kind === 'file' ? this.queueWrite(descriptor.path) : null;
  }

  /** Queues what open descriptors of `path` still hold back (before the file is renamed). */
  private flushDescriptors(path: string): void {
    for (const descriptor of this.descriptors.values()) if (descriptor.path === path) this.flushDescriptor(descriptor);
  }

  // ---------------------------------------------------------------------------
  // The write-behind queue
  // ---------------------------------------------------------------------------

  /** Queues the current content of the file at `path`. */
  private queueWrite(path: string): WriteTicket | null {
    if (this.areaOf(path) !== 'persistent') return null;
    const storagePath = this.storagePath(path);
    const bytes = (this.nodes.get(path) as FileNode).data;
    // Several writes of one file in a row (open, write, fsync, close): only the last content counts.
    const tail = this.queue[this.queue.length - 1];
    if (tail && !tail.started && tail.op.kind === 'write' && tail.op.path === storagePath) {
      tail.op.bytes = bytes;
      return tail;
    }
    return this.enqueue({ kind: 'write', path: storagePath, bytes }, [path]);
  }

  private queueOp(path: string, kind: 'mkdir' | 'remove'): WriteTicket | null {
    if (this.areaOf(path) !== 'persistent') return null;
    return this.enqueue({ kind, path: this.storagePath(path) }, [path]);
  }

  /** Queues everything at and below `path` as it is in the mirror (a move into the stored area). */
  private queueSubtree(path: string): WriteTicket | null {
    const node = this.nodes.get(path);
    if (!node || this.areaOf(path) !== 'persistent') return null;
    if (node.kind === 'file') return this.queueWrite(path);
    let ticket = this.queueOp(path, 'mkdir');
    for (const child of this.childrenOf(path)) ticket = this.queueSubtree(child) ?? ticket;
    return ticket;
  }

  private enqueue(op: NativeOp, virtualPaths: string[]): WriteTicket {
    let resolve!: () => void;
    let reject!: (error: FsError) => void;
    const settled = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // A change nobody waits for must not become an unhandled rejection; it is reported by drain().
    settled.catch(() => undefined);
    const ticket: WriteTicket = { op, started: false, awaited: false, settled, resolve, reject };
    this.queue.push(ticket);
    for (const path of virtualPaths) this.lastTicket.set(path, ticket);
    const forget = (): void => {
      for (const path of virtualPaths) if (this.lastTicket.get(path) === ticket) this.lastTicket.delete(path);
    };
    settled.then(forget, forget);
    if (this.poisoned.size) this.resyncDue = true;
    this.kick();
    return ticket;
  }

  private kick(): void {
    if (this.pumping) return;
    const run = this.pump().finally(() => {
      if (this.pumping === run) this.pumping = null;
    });
    this.pumping = run;
  }

  private async pump(): Promise<void> {
    // Let the synchronous caller finish first: its consecutive writes of one file collapse into one.
    await Promise.resolve();
    for (;;) {
      const ticket = this.queue[0];
      if (ticket) {
        ticket.started = true;
        const { op } = ticket;
        if (this.isBlocked(op)) {
          this.fail(ticket, 'an earlier change it depends on did not reach the storage');
        } else {
          try {
            await this.execute(op);
            ticket.resolve();
          } catch (e) {
            const cause = toStorageError(e);
            this.fail(ticket, cause.message);
          }
        }
        this.queue.shift();
        continue;
      }
      if (this.poisoned.size && this.resyncDue) {
        this.resyncDue = false;
        await this.resync();
        continue;
      }
      if (this.sweepDue) {
        this.sweepDue = false;
        await this.sweep();
        continue;
      }
      // Nothing is left. Step down in the same synchronous step that found the queue empty: a
      // caller that waited for the last ticket may queue its next change before any later
      // microtask runs, and that change must start a new run instead of being left behind.
      this.pumping = null;
      return;
    }
  }

  private pathsOf(op: NativeOp): string[] {
    return op.kind === 'rename' ? [op.path, op.to] : [op.path];
  }

  private hasPoisonedAncestor(path: string): boolean {
    return ancestorsOf(path).some((p) => this.poisoned.has(p));
  }

  private hasPoisonedBelow(path: string): boolean {
    for (const p of this.poisoned) if (isBelow(p, path)) return true;
    return false;
  }

  /**
   * A change is held back when what it starts from is out of sync: the directory it works in, or
   * the source of a rename. (A change whose TARGET is out of sync is executed - it repairs it.)
   */
  private isBlocked(op: NativeOp): boolean {
    if (!this.poisoned.size) return false;
    if (this.hasPoisonedAncestor(op.path)) return true;
    if (op.kind !== 'rename') return false;
    return this.poisoned.has(op.path) || this.hasPoisonedBelow(op.path) || this.hasPoisonedAncestor(op.to);
  }

  /** Records a change that did not reach the storage. */
  private fail(ticket: WriteTicket, detail: string): void {
    const { op } = ticket;
    const paths = this.pathsOf(op);
    const virtual = paths.map((p) => this.virtualPath(p));
    for (const path of paths) this.poisoned.add(path);
    this.log('error', `${op.kind} '${paths.join("' -> '")}' did not reach the storage: ${detail}`);
    const error = fsError('EIO', SYSCALL_OF[op.kind], virtual[0], virtual[1], detail);
    if (!ticket.awaited) {
      this.undrained ??= error;
      let failure: StickyFailure | undefined;
      for (const path of virtual) failure ??= this.sticky.get(path);
      failure ??= { detail, paths: new Set() };
      for (const path of virtual) {
        failure.paths.add(path);
        this.sticky.set(path, failure);
      }
    }
    ticket.reject(error);
  }

  /** `path` (and, with `below`, everything under it) is in sync again. */
  private heal(path: string, below: boolean): void {
    if (!this.poisoned.size) return;
    const healed = [...this.poisoned].filter((p) => p === path || (below && isBelow(p, path)));
    for (const p of healed) {
      this.poisoned.delete(p);
      const virtual = this.virtualPath(p);
      const failure = this.sticky.get(virtual);
      if (failure) {
        failure.paths.delete(virtual);
        this.sticky.delete(virtual);
      }
    }
    // Everything is stored after all: there is nothing left for drain() to report.
    if (!this.poisoned.size) this.undrained = null;
  }

  // The disk model -------------------------------------------------------------

  private diskAddDir(path: string): void {
    for (let p = path; p !== ''; p = storageParent(p)) this.disk.set(p, 'dir');
  }

  private diskRemove(path: string): void {
    for (const p of [...this.disk.keys()]) if (p === path || isBelow(p, path)) this.disk.delete(p);
  }

  private diskMove(from: string, to: string): void {
    this.diskRemove(to);
    for (const p of [...this.disk.keys()]) {
      if (p !== from && !isBelow(p, from)) continue;
      const kind = this.disk.get(p) as 'file' | 'dir';
      this.disk.delete(p);
      this.disk.set(to + p.slice(from.length), kind);
    }
  }

  /** What is in the storage at `path`: known for paths in sync, asked for the others. */
  private async stateOf(path: string): Promise<'file' | 'dir' | undefined> {
    if (!this.poisoned.has(path) && !this.hasPoisonedBelow(path)) return this.disk.get(path);
    const found = await (this.backend as StorageBackend).stat(path);
    return found ? (found.type === 'directory' ? 'dir' : 'file') : undefined;
  }

  // Executing one change ---------------------------------------------------------

  private async execute(op: NativeOp): Promise<void> {
    const backend = this.backend as StorageBackend;
    switch (op.kind) {
      case 'mkdir': {
        if ((await this.stateOf(op.path)) === 'file') await this.removeStored(op.path);
        await backend.mkdir(op.path);
        this.diskAddDir(op.path);
        this.heal(op.path, false);
        return;
      }
      case 'remove': {
        await this.removeStored(op.path);
        this.heal(op.path, true);
        return;
      }
      case 'write': {
        const state = await this.stateOf(op.path);
        if (state === 'dir') await this.removeStored(op.path);
        await this.replaceFile(op.path, state === 'file', (temp) => backend.write(temp, op.bytes));
        this.heal(op.path, true);
        return;
      }
      case 'rename': {
        const state = await this.stateOf(op.to);
        // What was moved aside under the old name goes first: left behind, it would bring that name
        // back at the next boot - with an outdated content. (The source is in sync and in place: a
        // rename whose source is out of sync is held back.)
        await this.purge(op.path);
        try {
          // A directory in the way (the empty target of a directory rename) is moved aside exactly
          // like a file: deleted first, it would be missing after a kill before the rename.
          await this.replaceFile(op.to, state !== undefined, null, op.path);
        } catch (e) {
          // The storage may have moved a directory all the same, with the temporary files in it.
          this.moveGarbage(op.path, op.to, true);
          throw e;
        }
        this.diskMove(op.path, op.to);
        this.moveGarbage(op.path, op.to, false);
        this.heal(op.to, true);
        return;
      }
    }
  }

  /** Deletes `path` from the storage - its leftovers first, so that nothing can bring it back at the next boot. */
  private async removeStored(path: string): Promise<void> {
    await this.purge(path);
    await (this.backend as StorageBackend).remove(path);
    this.diskRemove(path);
    // Gone with it: the name itself (when it was a temporary file) and everything below a directory.
    this.garbage.delete(path);
    this.forgetGarbageBelow(path);
  }

  /** The temporary files registered below the directory `path` are no longer there. */
  private forgetGarbageBelow(path: string): void {
    for (const name of [...this.garbage]) if (isBelow(name, path)) this.garbage.delete(name);
  }

  /** The registered temporary files of `path` (oldest first). */
  private garbageOf(path: string, kind?: 'tmp' | 'old'): string[] {
    const out: string[] = [];
    for (const name of this.garbage) {
      const match = LEFTOVER.exec(name);
      if (match && match[1] === path && (!kind || match[2] === kind)) out.push(name);
    }
    return out;
  }

  /**
   * Called before `path` leaves the storage (it is deleted, or renamed away): every copy of it that
   * was moved aside must be gone first - the next boot would take an `X.old-N` without an `X` for
   * the file of an interrupted write and bring it back. Throws when one cannot be deleted; `path`
   * then stays where it is. (Unfinished `X.tmp-N` are harmless: they are tried and otherwise kept.)
   */
  private async purge(path: string): Promise<void> {
    for (const name of this.garbageOf(path)) {
      if (LEFTOVER.exec(name)?.[2] === 'tmp') {
        await this.discard(name);
      } else {
        await (this.backend as StorageBackend).remove(name);
        this.garbage.delete(name);
      }
    }
  }

  /** A directory was renamed (`keep`: perhaps it was): the temporary files in it carry the new name (too). */
  private moveGarbage(from: string, to: string, keep: boolean): void {
    for (const name of [...this.garbage]) {
      if (!isBelow(name, from)) continue;
      if (!keep) this.garbage.delete(name);
      this.garbage.add(to + name.slice(from.length));
    }
  }

  /** Deletes a temporary file; when that fails it stays registered and is deleted later (or at the next boot). */
  private async discard(name: string): Promise<void> {
    try {
      await (this.backend as StorageBackend).remove(name);
      this.garbage.delete(name);
    } catch (e) {
      this.garbage.add(name);
      this.log('warn', `could not delete the temporary file '${name}': ${toStorageError(e).message}`);
    }
  }

  /** Deletes the registered temporary files that are obsolete. Runs only while the queue is empty. */
  private async sweep(): Promise<void> {
    for (const name of [...this.garbage]) {
      const match = LEFTOVER.exec(name);
      // The moved-aside copy of a file that is out of sync may be the only stored version of it.
      if (match && match[2] === 'old' && (this.poisoned.has(match[1]) || this.hasPoisonedAncestor(match[1]))) continue;
      await this.discard(name);
    }
  }

  /**
   * Puts a complete new file at `path` without a moment in which the storage has neither the old
   * nor the new one in a recoverable place. The new file is either written (`write`, to a
   * temporary name first) or is the existing file `source` (a rename). For a rename both may be
   * directories: `source` the directory that moves, `path` the (empty) one it replaces.
   * `exists`: something is stored at `path` now and has to be moved aside first.
   */
  private async replaceFile(
    path: string,
    exists: boolean,
    write: ((temp: string) => Promise<void>) | null,
    source?: string,
  ): Promise<void> {
    const backend = this.backend as StorageBackend;
    const n = ++this.counter;
    let incoming = source as string;
    if (write) {
      incoming = `${path}.tmp-${n}`;
      // Registered before the call: a write that was reported as failed may have run all the same.
      this.garbage.add(incoming);
      try {
        await write(incoming);
      } catch (e) {
        await this.discard(incoming);
        throw e;
      }
    }
    const aside = exists ? `${path}.old-${n}` : null;
    try {
      if (aside) {
        this.garbage.add(aside);
        await backend.rename(path, aside);
      }
      await backend.rename(incoming, path);
    } catch (e) {
      if (aside) await this.putBack(path, aside);
      if (write) await this.discard(incoming);
      throw e;
    }
    // Renamed into place: the temporary name is gone.
    if (write) this.garbage.delete(incoming);
    // What was registered below a replaced directory went aside with it (and is deleted with it).
    if (aside) this.forgetGarbageBelow(path);
    this.disk.set(path, 'file');
    // Only now, with the new file in place, may the previous one and older leftovers of this file go.
    for (const name of this.garbageOf(path)) await this.discard(name);
  }

  /**
   * A step of `replaceFile` failed - which does not say whether it ran. The storage is asked: with
   * nothing at `path` the previous file is moved back from `aside`; with a file there (the
   * untouched previous one, or the new one after all) `aside` is obsolete. What cannot be
   * established now stays registered: the next change of this file, the re-sync or the next boot
   * settles it.
   */
  private async putBack(path: string, aside: string): Promise<void> {
    const backend = this.backend as StorageBackend;
    try {
      if (await backend.stat(path)) {
        await this.discard(aside);
        return;
      }
      await backend.rename(aside, path);
      this.garbage.delete(aside);
    } catch {
      /* `aside` stays registered */
    }
  }

  // Re-synchronising after a failure --------------------------------------------

  /**
   * Makes the storage equal to the mirror at every out-of-sync path. Runs only while the queue is
   * empty - and works from the mirror as it is at that moment (`wantedAt`): what the core changes
   * while this runs is queued and replayed on top afterwards, in order.
   *
   * What the mirror has is stored first; what it no longer has is deleted afterwards, and only
   * when every store of this pass succeeded: after a failed rename the old name may hold the only
   * stored copy of what could not be stored under the new one.
   *
   * A file that is being written through a descriptor (opened, not yet fsynced or closed) is left
   * alone and stays out of sync: its content in the mirror is not final - storing it could replace
   * the last complete stored version by an empty or half-written one. The flush of the descriptor
   * stores it.
   */
  private async resync(): Promise<void> {
    const roots = [...this.poisoned].filter((p) => !this.hasPoisonedAncestor(p)).sort();
    const open: string[] = [];
    const plan = roots.map((path) => ({ path, wanted: this.wantedAt(path, open) }));
    const attempt = async (path: string, run: () => Promise<void>): Promise<boolean> => {
      try {
        await run();
        this.heal(path, true);
        return true;
      } catch (e) {
        const detail = toStorageError(e).message;
        this.log('error', `'${path}' is still not stored: ${detail}`);
        this.undrained ??= fsError('EIO', 'write', this.virtualPath(path), undefined, detail);
        return false;
      }
    };
    let stored = true;
    for (const { path, wanted } of plan) {
      if (wanted && wanted.kind !== 'open') stored = (await attempt(path, () => this.resyncPath(path, wanted))) && stored;
    }
    // (Healing a directory healed everything below it.)
    for (const path of open) this.poisoned.add(path);
    // The paths to delete stay out of sync (the failed store is what drain() reports).
    if (!stored) return;
    for (const { path, wanted } of plan) {
      if (!wanted) await attempt(path, () => this.removeStored(path));
    }
  }

  /**
   * What the storage should hold at `path` according to the mirror, right now; null: nothing.
   * The files that are being written through a descriptor are collected in `open`.
   */
  private wantedAt(path: string, open: string[]): Wanted | null {
    const virtual = this.virtualPath(path);
    const node = this.areaOf(virtual) === 'persistent' ? this.nodes.get(virtual) : undefined;
    if (!node) return null;
    if (node.kind === 'file') {
      for (const descriptor of this.descriptors.values()) {
        if (descriptor.dirty && descriptor.path === virtual) {
          open.push(path);
          return { kind: 'open' };
        }
      }
      return { kind: 'file', bytes: node.data };
    }
    const children = new Map<string, Wanted>();
    for (const child of this.childrenOf(virtual)) {
      const wanted = this.wantedAt(this.storagePath(child), open);
      if (wanted) children.set(baseNameOf(child), wanted);
    }
    return { kind: 'dir', children };
  }

  /** Makes the storage at `path` equal to `wanted`. */
  private async resyncPath(path: string, wanted: Wanted): Promise<void> {
    if (wanted.kind === 'open') return;
    const backend = this.backend as StorageBackend;
    const found = await backend.stat(path);
    if (wanted.kind === 'file') {
      if (found?.type === 'directory') await this.removeStored(path);
      const parent = storageParent(path);
      await backend.mkdir(parent);
      this.diskAddDir(parent);
      await this.replaceFile(path, found?.type === 'file', (temp) => backend.write(temp, wanted.bytes));
      return;
    }
    if (found?.type === 'file') await this.removeStored(path);
    await backend.mkdir(path);
    this.diskAddDir(path);
    for (const [name, child] of wanted.children) await this.resyncPath(storageJoin(path, name), child);
    // Only now, with every child stored, goes what the mirror does not have - the temporary files
    // of the children included (a moved-aside copy may have been the only stored version of one).
    for (const entry of await backend.list(path)) {
      if (!wanted.children.has(entry.name)) await this.removeStored(storageJoin(path, entry.name));
    }
  }
}
