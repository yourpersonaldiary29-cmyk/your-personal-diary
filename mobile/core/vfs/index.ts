/**
 * The storage layer of the mobile diary core (docs/ANDROID-PLAN.md, section 2):
 *
 *   server/src --(node:fs alias)--> node-fs.ts --> Vfs (mirror + write-behind queue)
 *                                                   |
 *                                 StorageBackend: createRpcStorage(port)  -- postMessage -->
 *                                 main thread: serveStorage(port, CapacitorFilesystemStorage)
 *
 * What the core does at start-up, in this order:
 *
 *   const vfs = new Vfs({ backend: createRpcStorage(self), log });
 *   installVfs(vfs);                                  // node:fs of server/src is this VFS now
 *   vfs.registerAsset('/assets/sql-wasm.wasm', bytes); // and the fonts: bytes sent by the host
 *   vfs.markVolatile(...);                            // optional: memory-only prefixes
 *   await vfs.boot();                                 // recovery + preload of /data
 *   ... build the ServerConfig with /data paths, mount the routers ...
 *
 * and afterwards `await vfs.drain()` before every answer and on the `flushAll` control.
 */
export { Vfs, type OpenMode, type VfsDirEntry, type VfsLogLevel, type VfsOptions, type VfsStat, type WriteTicket } from './vfs';
export { getVfs, installBufferClass, installVfs } from './node-fs';
export { createRpcStorage, DEFAULT_STORAGE_TIMEOUT_MS, type RpcStorage, type RpcStorageOptions } from './rpc-backend';
export { fsError, normalizePath, type FsError, type FsErrorCode } from './errors';
