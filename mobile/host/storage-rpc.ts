/**
 * Main-thread side of the storage RPC (mobile/shared/storage-protocol.ts): answers the
 * `StorageRpcRequest`s of the core worker with a real `StorageBackend`
 * (mobile/host/storage/capacitor-filesystem.ts on the phone, memory.ts in the browser dev mode).
 * The worker side is mobile/core/vfs/rpc-backend.ts.
 *
 * Calls are executed strictly one after the other, in the order they arrive. The VFS already
 * sends them one at a time; the queue here guarantees the order even after the worker gave up
 * waiting for a slow call (its timeout): a later call can never overtake an earlier one.
 *
 * Messages that are not storage requests are ignored, so the port may be the core worker itself
 * (shared with the host <-> core protocol) or a dedicated MessagePort.
 */
import {
  isStorageRpcRequest,
  storageTransferList,
  toStorageError,
  type StorageBackend,
  type StoragePort,
  type StorageRpcRequest,
  type StorageRpcResponse,
  type StorageRpcSuccess,
} from '../shared/storage-protocol';

export interface StorageServer {
  /** Stops answering (calls already running finish, their answers are dropped). */
  dispose(): void;
}

/** Runs one request against the backend. */
async function perform(backend: StorageBackend, request: StorageRpcRequest): Promise<StorageRpcSuccess> {
  const done: StorageRpcSuccess = { type: 'storage-response', id: request.id, ok: true };
  switch (request.op) {
    case 'list':
      return { ...done, entries: await backend.list(request.path) };
    case 'read': {
      const bytes = await backend.read(request.path);
      // Always a buffer of its own that holds exactly the file: it is transferred to the worker.
      const exact =
        bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength && bytes.buffer instanceof ArrayBuffer
          ? bytes.buffer
          : bytes.slice().buffer;
      return { ...done, bytes: exact as ArrayBuffer };
    }
    case 'write':
      await backend.write(request.path, new Uint8Array(request.bytes as ArrayBuffer));
      return done;
    case 'rename':
      await backend.rename(request.path, request.to as string);
      return done;
    case 'remove':
      await backend.remove(request.path);
      return done;
    case 'mkdir':
      await backend.mkdir(request.path);
      return done;
    case 'stat':
      return { ...done, stat: await backend.stat(request.path) };
  }
}

/** Serves `backend` on `port` until disposed. */
export function serveStorage(port: StoragePort, backend: StorageBackend): StorageServer {
  let disposed = false;
  let tail: Promise<void> = Promise.resolve();

  const answer = (response: StorageRpcResponse): void => {
    if (disposed) return;
    try {
      port.postMessage(response, storageTransferList(response));
    } catch {
      /* the worker is gone: nobody waits for the answer */
    }
  };

  const onMessage = (event: MessageEvent<unknown>): void => {
    const request = event.data;
    if (!isStorageRpcRequest(request)) return;
    tail = tail.then(async () => {
      if (disposed) return;
      try {
        answer(await perform(backend, request));
      } catch (e) {
        const error = toStorageError(e);
        answer({ type: 'storage-response', id: request.id, ok: false, code: error.code, message: error.message });
      }
    });
  };

  port.addEventListener('message', onMessage);
  return {
    dispose(): void {
      disposed = true;
      port.removeEventListener('message', onMessage);
    },
  };
}
