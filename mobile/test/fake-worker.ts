/**
 * Test doubles for the core worker (mobile/host/core-client.ts talks to a `CoreWorkerLike`):
 *  - `FakeWorker`: records what the host posts and lets the test play the core;
 *  - `stubWorker()`: a FakeWorker whose other side is the real placeholder core
 *    (mobile/core/worker-stub.ts), with messages delivered asynchronously like a real worker.
 * The same double around the REAL core is `realCoreWorker()` in ./core/real-worker.ts (kept apart so
 * that the host tests do not load the whole core).
 */
import { startStub, type StubScope } from '../core/worker-stub';
import type { CoreWorkerLike } from '../host/core-client';
import type { StorageRpcRequest, StorageRpcResponse } from '../shared/storage-protocol';
import type { CoreAssetsMessage, CoreCancel, CoreControl, CoreMessage, CoreRequest, HostMessage } from '../shared/transport';

/** Everything the host may post to the worker: the request protocol, the boot assets, storage answers. */
export type PostedMessage = HostMessage | CoreAssetsMessage | StorageRpcRequest | StorageRpcResponse;

type Listener = (event: Event) => void;
type MessageListener = (event: MessageEvent<unknown>) => void;

export class FakeWorker implements CoreWorkerLike {
  /** Every message the host posted, in order. */
  readonly posted: PostedMessage[] = [];
  /** The transfer list of each posted message. */
  readonly transfers: Transferable[][] = [];
  terminated = false;
  /** Called for every posted message (a scripted core). */
  onPost: ((message: PostedMessage) => void) | null = null;
  /** When set, `postMessage` throws it (a worker that is gone). */
  postError: Error | null = null;
  private readonly listeners = new Map<string, Listener[]>();

  postMessage(message: PostedMessage, transfer: Transferable[]): void {
    if (this.postError) throw this.postError;
    if (this.terminated) return;
    this.posted.push(message);
    this.transfers.push(transfer);
    this.onPost?.(message);
  }

  addEventListener(type: 'message', listener: MessageListener): void;
  addEventListener(type: 'message' | 'messageerror' | 'error', listener: Listener): void;
  addEventListener(type: string, listener: Listener | MessageListener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener as Listener]);
  }

  removeEventListener(type: 'message', listener: MessageListener): void;
  removeEventListener(type: 'message' | 'messageerror' | 'error', listener: Listener): void;
  removeEventListener(type: string, listener: Listener | MessageListener): void {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((l) => l !== listener),
    );
  }

  terminate(): void {
    this.terminated = true;
  }

  /** The core posts `data` to the host (any value: the host must ignore what is not a CoreMessage). */
  emit(data: unknown): void {
    for (const listener of this.listeners.get('message') ?? []) listener(new MessageEvent('message', { data }));
  }

  /** The core posts the `ready` event. */
  ready(): void {
    this.emit({ type: 'event', name: 'ready', protocol: 1 } satisfies CoreMessage);
  }

  /** The worker raises `error` (uncaught exception) or `messageerror`. */
  fail(type: 'error' | 'messageerror' = 'error'): void {
    for (const listener of this.listeners.get(type) ?? []) listener(new Event(type));
  }

  get requests(): CoreRequest[] {
    return this.posted.filter((message): message is CoreRequest => message.type === 'request');
  }

  get assets(): CoreAssetsMessage[] {
    return this.posted.filter((message): message is CoreAssetsMessage => message.type === 'assets');
  }

  get cancels(): CoreCancel[] {
    return this.posted.filter((message): message is CoreCancel => message.type === 'cancel');
  }

  get controls(): CoreControl[] {
    return this.posted.filter((message): message is CoreControl => message.type === 'control');
  }
}

export interface StubWorker extends FakeWorker {
  /** True once the stub called `close()` on its scope (after a `shutdown` control). */
  readonly closed: boolean;
}

/** A worker running the real placeholder core in-process. */
export function stubWorker(): StubWorker {
  const worker = new FakeWorker();
  let closed = false;
  let toCore: ((event: MessageEvent<unknown>) => void) | null = null;
  const scope: StubScope = {
    postMessage: (message) => queueMicrotask(() => worker.emit(message)),
    addEventListener: (_type, listener) => {
      toCore = listener;
    },
    close: () => {
      closed = true;
    },
  };
  worker.onPost = (message) => {
    queueMicrotask(() => toCore?.(new MessageEvent('message', { data: message })));
  };
  startStub(scope);
  return Object.defineProperty(worker, 'closed', { get: () => closed }) as StubWorker;
}

/** Lets queued microtasks and already-resolved promises run. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
