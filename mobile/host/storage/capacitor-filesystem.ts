/**
 * The `StorageBackend` of the phone: the app-private directory through @capacitor/filesystem
 * (`Directory.Data`, i.e. `files/` of the app on Android), everything below the folder `diary/`.
 * Runs on the main thread - a plugin cannot be called from the worker.
 *
 * Binary data crosses the Capacitor bridge as base64 text. A diary file can be several
 * megabytes, so files are written and read in chunks (`writeFile` + `appendFile`, `readFile` with
 * `offset` / `length`): no single bridge message carries more than about one megabyte of text.
 * A chunked write is not atomic - it does not have to be: the VFS only writes temporary names and
 * renames them into place (mobile/core/vfs/vfs.ts).
 *
 * Whether Google's cloud backup may copy these files is decided by the Android manifest
 * (allowBackup=false, docs/ANDROID-PLAN.md section 2), not here.
 *
 * The plugin object is injected, so the tests run this class against a fake plugin; the real one
 * is loaded by `createCapacitorFilesystemStorage()`.
 */
import type { Directory, FilesystemPlugin } from '@capacitor/filesystem';
import {
  StorageError,
  storageParent,
  storagePathSegments,
  type StorageBackend,
  type StorageEntry,
  type StorageErrorCode,
  type StorageStat,
} from '../../shared/storage-protocol';
import { base64ToBytes, bytesToBase64 } from './base64';

/** The part of the Filesystem plugin this backend uses. */
export type FilesystemLike = Pick<
  FilesystemPlugin,
  'readFile' | 'writeFile' | 'appendFile' | 'deleteFile' | 'mkdir' | 'rmdir' | 'readdir' | 'stat' | 'rename'
>;

export interface CapacitorStorageOptions {
  /** The folder inside the directory that is the storage root. Default: 'diary'. */
  base?: string;
  /** The Capacitor directory. Default: Directory.Data ('DATA'). */
  directory?: Directory;
  /** Bytes per bridge call; rounded down to a multiple of 3 (base64 chunks must concatenate). */
  chunkBytes?: number;
  /**
   * True when the plugin is its web implementation (a browser, IndexedDB) instead of the native
   * one. That implementation ignores `offset` / `length` of a read, quietly creates a missing
   * parent folder on a write and lists a file like an empty folder - so the backend then reads
   * files whole and checks the parent of a write itself. Default: false.
   */
  web?: boolean;
  /**
   * Read large files in chunks (`readFile` with `offset` / `length`). Those options exist on the
   * native platforms only, so this must be false in a browser. Default: true, false with `web`.
   */
  chunkedRead?: boolean;
}

export const DEFAULT_STORAGE_BASE = 'diary';
/** 768 KiB of bytes = 1 MiB of base64 text per bridge call. */
export const DEFAULT_CHUNK_BYTES = 3 * 256 * 1024;

/** The plugin's native error codes (FilesystemErrors.kt: "OS-PLUG-FILE-00nn"). */
const NATIVE_CODES: Record<string, StorageErrorCode> = {
  'OS-PLUG-FILE-0005': 'EINVAL',
  'OS-PLUG-FILE-0006': 'EINVAL',
  'OS-PLUG-FILE-0007': 'EACCES',
  'OS-PLUG-FILE-0008': 'ENOENT',
  'OS-PLUG-FILE-0010': 'EEXIST',
  'OS-PLUG-FILE-0011': 'ENOENT',
  'OS-PLUG-FILE-0012': 'ENOTEMPTY',
};

/** "Not supported for directories / files": which one decides between EISDIR and ENOTDIR. */
const NATIVE_NOT_ALLOWED = 'OS-PLUG-FILE-0009';

/**
 * The storage error code of a plugin failure. Native errors carry a code; the plugin's web
 * implementation (browser dev mode) throws plain errors, recognised by their text.
 */
function codeOf(error: unknown): StorageErrorCode {
  const candidate = error as { code?: unknown; message?: unknown } | null | undefined;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  const message = typeof candidate?.message === 'string' ? candidate.message : '';
  if (code in NATIVE_CODES) return NATIVE_CODES[code];
  if (code === NATIVE_NOT_ALLOWED) return /only directories/i.test(message) ? 'ENOTDIR' : 'EISDIR';
  if (/does not exist|must exist|missing parent/i.test(message)) return 'ENOENT';
  if (/already exist/i.test(message)) return 'EEXIST';
  if (/not empty|with children/i.test(message)) return 'ENOTEMPTY';
  if (/is not a directory|parent directory .* is a file/i.test(message)) return 'ENOTDIR';
  if (/is a directory|overwrite a directory/i.test(message)) return 'EISDIR';
  return 'EIO';
}

function storageError(error: unknown, what: string): StorageError {
  if (error instanceof StorageError) return error;
  const code = codeOf(error);
  const message = typeof (error as { message?: unknown } | null)?.message === 'string' ? (error as Error).message : String(error);
  return new StorageError(code, `${code}: ${what}: ${message}`);
}

export class CapacitorFilesystemStorage implements StorageBackend {
  private readonly base: string;
  private readonly directory: Directory;
  private readonly chunkBytes: number;
  private readonly web: boolean;
  private readonly chunkedRead: boolean;

  constructor(
    private readonly plugin: FilesystemLike,
    options: CapacitorStorageOptions = {},
  ) {
    this.base = options.base ?? DEFAULT_STORAGE_BASE;
    storagePathSegments(this.base);
    if (!this.base) throw new StorageError('EINVAL', 'EINVAL: the storage needs a base folder');
    this.directory = options.directory ?? ('DATA' as Directory);
    const chunk = Math.floor((options.chunkBytes ?? DEFAULT_CHUNK_BYTES) / 3) * 3;
    this.chunkBytes = Math.max(3, chunk);
    this.web = options.web === true;
    this.chunkedRead = options.chunkedRead ?? !this.web;
  }

  /** The plugin path of a storage path. */
  private full(path: string): string {
    storagePathSegments(path);
    return path ? `${this.base}/${path}` : this.base;
  }

  private async bytesOf(data: string | Blob): Promise<Uint8Array> {
    if (typeof data === 'string') return base64ToBytes(data);
    return new Uint8Array(await data.arrayBuffer());
  }

  async list(dir: string): Promise<StorageEntry[]> {
    const path = this.full(dir);
    try {
      const { files } = await this.plugin.readdir({ path, directory: this.directory });
      // The web implementation lists a file like an empty folder.
      if (files.length === 0 && (await this.stat(dir))?.type === 'file') {
        throw new StorageError('ENOTDIR', `ENOTDIR: '${dir}' is not a directory`);
      }
      return files.map((file) => ({
        name: file.name,
        type: file.type === 'directory' ? 'directory' : 'file',
        size: file.type === 'directory' ? 0 : Number(file.size) || 0,
        mtimeMs: Number(file.mtime) || 0,
      }));
    } catch (e) {
      throw storageError(e, `list '${dir}'`);
    }
  }

  async read(path: string): Promise<Uint8Array> {
    const full = this.full(path);
    const info = await this.stat(path);
    if (!info) throw new StorageError('ENOENT', `ENOENT: no such file '${path}'`);
    if (info.type === 'directory') throw new StorageError('EISDIR', `EISDIR: '${path}' is a directory`);
    try {
      if (!this.chunkedRead || info.size <= this.chunkBytes) {
        const whole = await this.plugin.readFile({ path: full, directory: this.directory });
        return await this.bytesOf(whole.data);
      }
      const parts: Uint8Array[] = [];
      let offset = 0;
      while (offset < info.size) {
        const length = Math.min(this.chunkBytes, info.size - offset);
        const result = await this.plugin.readFile({ path: full, directory: this.directory, offset, length });
        const part = await this.bytesOf(result.data);
        if (part.byteLength !== length) {
          throw new StorageError('EIO', `EIO: read '${path}': expected ${length} bytes at ${offset}, got ${part.byteLength}`);
        }
        parts.push(part);
        offset += part.byteLength;
      }
      const out = new Uint8Array(offset);
      let position = 0;
      for (const part of parts) {
        out.set(part, position);
        position += part.byteLength;
      }
      return out;
    } catch (e) {
      throw storageError(e, `read '${path}'`);
    }
  }

  async write(path: string, bytes: Uint8Array): Promise<void> {
    const full = this.full(path);
    if (!path) throw new StorageError('EISDIR', 'EISDIR: the storage root is a directory');
    if (this.web) {
      // The web implementation would create the missing folder instead of failing.
      const parent = await this.stat(storageParent(path));
      if (!parent) throw new StorageError('ENOENT', `ENOENT: no such directory for write '${path}'`);
      if (parent.type !== 'directory') throw new StorageError('ENOTDIR', `ENOTDIR: not a directory for write '${path}'`);
    }
    try {
      const first = bytes.subarray(0, this.chunkBytes);
      await this.plugin.writeFile({ path: full, directory: this.directory, data: bytesToBase64(first), recursive: false });
      for (let offset = first.byteLength; offset < bytes.byteLength; offset += this.chunkBytes) {
        const chunk = bytes.subarray(offset, Math.min(offset + this.chunkBytes, bytes.byteLength));
        await this.plugin.appendFile({ path: full, directory: this.directory, data: bytesToBase64(chunk) });
      }
    } catch (e) {
      throw storageError(e, `write '${path}'`);
    }
  }

  async rename(from: string, to: string): Promise<void> {
    const fullFrom = this.full(from);
    const fullTo = this.full(to);
    if (!from || !to) throw new StorageError('EINVAL', 'EINVAL: the storage root cannot be renamed');
    try {
      await this.plugin.rename({ from: fullFrom, to: fullTo, directory: this.directory, toDirectory: this.directory });
    } catch (e) {
      throw storageError(e, `rename '${from}' -> '${to}'`);
    }
  }

  async remove(path: string): Promise<void> {
    const full = this.full(path);
    if (!path) throw new StorageError('EINVAL', 'EINVAL: the storage root cannot be removed');
    const info = await this.stat(path);
    if (!info) return;
    try {
      if (info.type === 'directory') await this.plugin.rmdir({ path: full, directory: this.directory, recursive: true });
      else await this.plugin.deleteFile({ path: full, directory: this.directory });
    } catch (e) {
      const error = storageError(e, `remove '${path}'`);
      // Gone in the meantime: that is what was asked for.
      if (error.code !== 'ENOENT') throw error;
    }
  }

  async mkdir(path: string): Promise<void> {
    const full = this.full(path);
    try {
      await this.plugin.mkdir({ path: full, directory: this.directory, recursive: true });
    } catch (e) {
      // The plugin refuses to "create" what exists; only a file in the way is an error for us.
      const info = await this.stat(path).catch(() => null);
      if (info?.type === 'directory') return;
      if (info?.type === 'file') throw new StorageError('EEXIST', `EEXIST: '${path}' is a file`);
      throw storageError(e, `mkdir '${path}'`);
    }
  }

  async stat(path: string): Promise<StorageStat | null> {
    const full = this.full(path);
    try {
      const info = await this.plugin.stat({ path: full, directory: this.directory });
      const type = info.type === 'directory' ? 'directory' : 'file';
      return { type, size: type === 'directory' ? 0 : Number(info.size) || 0, mtimeMs: Number(info.mtime) || 0 };
    } catch (e) {
      const error = storageError(e, `stat '${path}'`);
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }
}

/** The storage of the running app: the real plugin (loaded on demand, only in the Android build). */
export async function createCapacitorFilesystemStorage(options: CapacitorStorageOptions = {}): Promise<CapacitorFilesystemStorage> {
  const [{ Filesystem }, { Capacitor }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/core')]);
  return new CapacitorFilesystemStorage(Filesystem, { web: !Capacitor.isNativePlatform(), ...options });
}
