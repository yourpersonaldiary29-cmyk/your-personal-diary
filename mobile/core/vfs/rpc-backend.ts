/**
 * Worker side of the storage RPC (mobile/shared/storage-protocol.ts): a `StorageBackend` whose
 * every call is one `StorageRpcRequest` posted to the main thread, answered by the
 * `StorageRpcResponse` with the same id (served there by mobile/host/storage-rpc.ts).
 *
 *  - bytes travel as transferred ArrayBuffers. A write transfers a COPY: the caller (the VFS
 *    mirror) keeps its own array;
 *  - a failed call rejects with a `StorageError` carrying the backend's code;
 *  - a call that is not answered within `timeoutMs` rejects with ETIMEDOUT; a late answer is
 *    ignored. The main thread still executes its calls in order, so a late call cannot overtake
 *    the ones sent after it.
 */
import {
  StorageError,
  isStorageRpcResponse,
  storageTransferList,
  type StorageBackend,
  type StorageEntry,
  type StorageOp,
  type StoragePort,
  type StorageRpcRequest,
  type StorageRpcSuccess,
  type StorageStat,
} from '../../shared/storage-protocol';

export interface RpcStorageOptions {
  /** How long one call may take (0: no limit). Default: 30 s. */
  timeoutMs?: number;
}

export const DEFAULT_STORAGE_TIMEOUT_MS = 30_000;

export interface RpcStorage extends StorageBackend {
  /** Stops listening; every pending and later call rejects. */
  dispose(): void;
}

interface Pending {
  resolve(result: StorageRpcSuccess): void;
  reject(error: StorageError): void;
  timer: ReturnType<typeof setTimeout> | null;
}

export function createRpcStorage(port: StoragePort, options: RpcStorageOptions = {}): RpcStorage {
  const timeoutMs = options.timeoutMs ?? DEFAULT_STORAGE_TIMEOUT_MS;
  const pending = new Map<number, Pending>();
  let nextId = 1;
  let disposed = false;

  const onMessage = (event: MessageEvent<unknown>): void => {
    const message = event.data;
    if (!isStorageRpcResponse(message)) return;
    const waiting = pending.get(message.id);
    if (!waiting) return; // timed out, or not ours
    pending.delete(message.id);
    if (waiting.timer !== null) clearTimeout(waiting.timer);
    if (message.ok) waiting.resolve(message);
    else waiting.reject(new StorageError(message.code, message.message));
  };
  port.addEventListener('message', onMessage);

  function call(op: StorageOp, path: string, extra: Pick<StorageRpcRequest, 'to' | 'bytes'> = {}): Promise<StorageRpcSuccess> {
    if (disposed) return Promise.reject(new StorageError('EIO', `EIO: the storage connection is closed (${op} '${path}')`));
    const request: StorageRpcRequest = { type: 'storage-request', id: nextId++, op, path, ...extra };
    return new Promise<StorageRpcSuccess>((resolve, reject) => {
      const timer =
        timeoutMs > 0
          ? setTimeout(() => {
              pending.delete(request.id);
              reject(new StorageError('ETIMEDOUT', `ETIMEDOUT: the storage did not answer in time (${op} '${path}')`));
            }, timeoutMs)
          : null;
      pending.set(request.id, { resolve, reject, timer });
      try {
        port.postMessage(request, storageTransferList(request));
      } catch (e) {
        pending.delete(request.id);
        if (timer !== null) clearTimeout(timer);
        reject(new StorageError('EIO', `EIO: the storage cannot be reached (${op} '${path}'): ${(e as Error)?.message ?? e}`));
      }
    });
  }

  return {
    async list(dir: string): Promise<StorageEntry[]> {
      return (await call('list', dir)).entries ?? [];
    },
    async read(path: string): Promise<Uint8Array> {
      const { bytes } = await call('read', path);
      if (!bytes) throw new StorageError('EIO', `EIO: the storage answered without data (read '${path}')`);
      return new Uint8Array(bytes);
    },
    async write(path: string, bytes: Uint8Array): Promise<void> {
      // slice(): a buffer of exactly these bytes that can be given away.
      await call('write', path, { bytes: bytes.slice().buffer as ArrayBuffer });
    },
    async rename(from: string, to: string): Promise<void> {
      await call('rename', from, { to });
    },
    async remove(path: string): Promise<void> {
      await call('remove', path);
    },
    async mkdir(path: string): Promise<void> {
      await call('mkdir', path);
    },
    async stat(path: string): Promise<StorageStat | null> {
      return (await call('stat', path)).stat ?? null;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      port.removeEventListener('message', onMessage);
      for (const [id, waiting] of pending) {
        if (waiting.timer !== null) clearTimeout(waiting.timer);
        waiting.reject(new StorageError('EIO', `EIO: the storage connection was closed (call ${id})`));
      }
      pending.clear();
    },
  };
}
