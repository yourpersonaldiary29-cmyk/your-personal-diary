/**
 * A worker double running the REAL core (mobile/core/worker.ts, `runCoreWorker`) in-process on
 * a linked scope: what the host posts reaches the core's scope, what the core posts reaches the
 * host's listeners - both a task later, like a real worker, so the storage RPC the host serves on
 * the same channel works too. Buffers are not detached. The whole host <-> core protocol without
 * a thread (mobile/test/core/worker.test.ts).
 */
import { runCoreWorker, type CoreWorkerOptions, type CoreWorkerScope, type RunningCoreWorker } from '../../core/worker';
import { FakeWorker } from '../fake-worker';

export interface RealCoreWorker extends FakeWorker {
  /** True once the core called `close()` on its scope (after a `shutdown` control). */
  readonly closed: boolean;
  /** The running core (its `booted` promise). */
  readonly running: RunningCoreWorker;
  /** Every message the core posted to the host, in order. */
  readonly fromCore: unknown[];
}

export function realCoreWorker(options: CoreWorkerOptions = {}): RealCoreWorker {
  const worker = new FakeWorker();
  const fromCore: unknown[] = [];
  let closed = false;
  const toCore: Array<(event: MessageEvent<unknown>) => void> = [];
  const scope: CoreWorkerScope = {
    postMessage: (message) => {
      fromCore.push(message);
      setTimeout(() => worker.emit(message), 0);
    },
    addEventListener: (_type, listener) => {
      toCore.push(listener);
    },
    removeEventListener: (_type, listener) => {
      const index = toCore.indexOf(listener);
      if (index >= 0) toCore.splice(index, 1);
    },
    close: () => {
      closed = true;
    },
  };
  worker.onPost = (message) => {
    setTimeout(() => {
      for (const listener of [...toCore]) listener(new MessageEvent('message', { data: message }));
    }, 0);
  };
  const running = runCoreWorker(scope, options);
  Object.defineProperty(worker, 'closed', { get: () => closed });
  Object.defineProperty(worker, 'running', { value: running });
  Object.defineProperty(worker, 'fromCore', { value: fromCore });
  return worker as RealCoreWorker;
}

