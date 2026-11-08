/**
 * A `StorageBackend` that keeps everything in memory: the storage of the tests and of the
 * browser dev mode (`npm run mobile:dev`), where the diary is deliberately persisted to nothing.
 *
 * It is strict on purpose - it rejects what a real file system would reject (missing parent,
 * file in the way) and, unlike a real one, a rename onto an existing name (EEXIST): the VFS
 * promises never to do that, and this is where a broken promise shows up in a test.
 */
import {
  StorageError,
  storageBaseName,
  storageParent,
  storagePathSegments,
  type StorageBackend,
  type StorageEntry,
  type StorageStat,
} from '../../shared/storage-protocol';

interface MemoryFile {
  type: 'file';
  bytes: Uint8Array;
  mtimeMs: number;
}

interface MemoryDirectory {
  type: 'directory';
  mtimeMs: number;
}

type MemoryNode = MemoryFile | MemoryDirectory;

export interface MemoryStorageOptions {
  /** The clock of the modification times (tests). Default: Date.now. */
  now?: () => number;
}

export class MemoryStorage implements StorageBackend {
  /** Every node by its path; the root (`''`) is always a directory. */
  private readonly nodes = new Map<string, MemoryNode>();
  private readonly now: () => number;

  constructor(options: MemoryStorageOptions = {}) {
    this.now = options.now ?? Date.now;
    this.nodes.set('', { type: 'directory', mtimeMs: this.now() });
  }

  private static check(path: string): string {
    storagePathSegments(path);
    return path;
  }

  /** The directory node of the parent of `path`, or the error a file system would give. */
  private requireParent(path: string, what: string): void {
    const parent = this.nodes.get(storageParent(path));
    if (!parent) throw new StorageError('ENOENT', `ENOENT: no such directory for ${what} '${path}'`);
    if (parent.type !== 'directory') throw new StorageError('ENOTDIR', `ENOTDIR: not a directory for ${what} '${path}'`);
  }

  private childrenOf(dir: string): string[] {
    const prefix = dir ? `${dir}/` : '';
    const names: string[] = [];
    for (const path of this.nodes.keys()) {
      if (path === '' || !path.startsWith(prefix)) continue;
      if (path.indexOf('/', prefix.length) < 0) names.push(path);
    }
    return names.sort();
  }

  private subtreeOf(path: string): string[] {
    const prefix = `${path}/`;
    return [...this.nodes.keys()].filter((p) => p === path || (path === '' ? p !== '' : p.startsWith(prefix)));
  }

  async list(dir: string): Promise<StorageEntry[]> {
    MemoryStorage.check(dir);
    const node = this.nodes.get(dir);
    if (!node) throw new StorageError('ENOENT', `ENOENT: no such directory '${dir}'`);
    if (node.type !== 'directory') throw new StorageError('ENOTDIR', `ENOTDIR: not a directory '${dir}'`);
    return this.childrenOf(dir).map((path) => {
      const child = this.nodes.get(path) as MemoryNode;
      return {
        name: storageBaseName(path),
        type: child.type,
        size: child.type === 'file' ? child.bytes.byteLength : 0,
        mtimeMs: child.mtimeMs,
      };
    });
  }

  async read(path: string): Promise<Uint8Array> {
    MemoryStorage.check(path);
    const node = this.nodes.get(path);
    if (!node) throw new StorageError('ENOENT', `ENOENT: no such file '${path}'`);
    if (node.type !== 'file') throw new StorageError('EISDIR', `EISDIR: '${path}' is a directory`);
    return node.bytes.slice();
  }

  async write(path: string, bytes: Uint8Array): Promise<void> {
    MemoryStorage.check(path);
    if (path === '') throw new StorageError('EISDIR', 'EISDIR: the storage root is a directory');
    this.requireParent(path, 'write');
    if (this.nodes.get(path)?.type === 'directory') throw new StorageError('EISDIR', `EISDIR: '${path}' is a directory`);
    this.nodes.set(path, { type: 'file', bytes: bytes.slice(), mtimeMs: this.now() });
  }

  async rename(from: string, to: string): Promise<void> {
    MemoryStorage.check(from);
    MemoryStorage.check(to);
    if (from === '' || to === '') throw new StorageError('EINVAL', 'EINVAL: the storage root cannot be renamed');
    if (!this.nodes.has(from)) throw new StorageError('ENOENT', `ENOENT: no such file '${from}'`);
    if (from === to) return;
    if (to.startsWith(`${from}/`)) throw new StorageError('EINVAL', `EINVAL: cannot move '${from}' into itself`);
    this.requireParent(to, 'rename');
    if (this.nodes.has(to)) throw new StorageError('EEXIST', `EEXIST: '${to}' already exists`);
    for (const path of this.subtreeOf(from)) {
      const node = this.nodes.get(path) as MemoryNode;
      this.nodes.delete(path);
      this.nodes.set(to + path.slice(from.length), node);
    }
  }

  async remove(path: string): Promise<void> {
    MemoryStorage.check(path);
    if (path === '') throw new StorageError('EINVAL', 'EINVAL: the storage root cannot be removed');
    for (const p of this.subtreeOf(path)) this.nodes.delete(p);
  }

  async mkdir(path: string): Promise<void> {
    const segments = storagePathSegments(path);
    let current = '';
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      const node = this.nodes.get(current);
      if (!node) this.nodes.set(current, { type: 'directory', mtimeMs: this.now() });
      else if (node.type !== 'directory') throw new StorageError('EEXIST', `EEXIST: '${current}' is a file`);
    }
  }

  async stat(path: string): Promise<StorageStat | null> {
    MemoryStorage.check(path);
    const node = this.nodes.get(path);
    if (!node) return null;
    return { type: node.type, size: node.type === 'file' ? node.bytes.byteLength : 0, mtimeMs: node.mtimeMs };
  }

  // Test helpers ------------------------------------------------------------

  /** Every file with a copy of its bytes (directories are left out), by path, sorted. */
  files(): Map<string, Uint8Array> {
    const out = new Map<string, Uint8Array>();
    for (const path of [...this.nodes.keys()].sort()) {
      const node = this.nodes.get(path) as MemoryNode;
      if (node.type === 'file') out.set(path, node.bytes.slice());
    }
    return out;
  }

  /** Every path (files and directories, without the root), sorted. */
  paths(): string[] {
    return [...this.nodes.keys()].filter((p) => p !== '').sort();
  }
}
