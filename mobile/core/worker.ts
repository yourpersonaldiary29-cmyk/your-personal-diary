/**
 * The diary core as a Web Worker: the real core (mobile/core/boot.ts) behind the host <-> core
 * protocol (mobile/shared/transport.ts). It replaces the placeholder of worker-stub.ts in
 * mobile/host/core-worker.ts.
 *
 * Order of events in the worker:
 *   1. the Node globals shim is imported first (Buffer, process, setImmediate for third-party code);
 *   2. the message listener is attached synchronously, before anything is awaited, so that no
 *      message of the host can be missed (the storage RPC proxy attaches its own the same way);
 *   3. the host's `assets` message arrives: the core boots on the RPC storage (served by the host,
 *      mobile/host/storage-rpc.ts) with those assets, then `ready` is posted - or `fatal` when the
 *      boot failed; nothing is answered before that except requests, which wait for the boot;
 *   4. every `request` is dispatched concurrently (as the HTTP server does), its answer posted
 *      with the body bytes transferred - unless the host cancelled it meanwhile - and the events
 *      of that answer (`habits-changed`) right after it;
 *   5. `control` actions run one after the other: flushAll, lockAll, shutdown (which also closes
 *      the worker after its result was posted: nothing is answered afterwards).
 *
 * Diagnostics of the VFS (warnings, errors) are forwarded to the host as `log` events; the host
 * writes them to its console. Nothing in them is diary content.
 */
import './shims/globals';
import {
  CORE_PROTOCOL_VERSION,
  isCoreAssetsMessage,
  isHostMessage,
  jsonResponse,
  transferList,
  type CoreAssetsMessage,
  type CoreControl,
  type CoreEvent,
  type CoreMessage,
  type CoreRequest,
} from '../shared/transport';
import type { StorageRpcRequest, StorageRpcResponse } from '../shared/storage-protocol';
import { bootCore, type CoreBootOptions, type DiaryCore } from './boot';
import { createRpcStorage } from './vfs';

/** The part of the worker global scope the core uses (a fake in tests). */
export interface CoreWorkerScope {
  postMessage(message: CoreMessage | StorageRpcRequest | StorageRpcResponse, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  close(): void;
}

export interface CoreWorkerOptions {
  /** Boots the core (tests inject options such as cheap scrypt parameters or a memory storage). */
  boot?: (options: CoreBootOptions) => Promise<DiaryCore>;
  /** Overrides of the boot options (tests). */
  bootOptions?: Partial<Omit<CoreBootOptions, 'assets' | 'onEvent'>>;
}

/** The error body of a request that arrives while the core failed to start. */
export const NOT_READY_BODY = { code: 'OTHER', message: 'core not ready' } as const;

export interface RunningCoreWorker {
  /** Resolves with the core once it booted; rejects when the boot failed. */
  readonly booted: Promise<DiaryCore>;
}

/** Wires the core to a worker scope. Returns at once; the boot starts when the assets arrive. */
export function runCoreWorker(scope: CoreWorkerScope, options: CoreWorkerOptions = {}): RunningCoreWorker {
  const storage = createRpcStorage(scope);
  const boot = options.boot ?? bootCore;
  /** Ids of requests being handled, and of those the host no longer waits for. */
  const inFlight = new Set<number>();
  const cancelled = new Set<number>();
  let assetsSeen = false;
  let controlChain: Promise<unknown> = Promise.resolve();

  let resolveBooted!: (core: DiaryCore) => void;
  let rejectBooted!: (reason: Error) => void;
  const booted = new Promise<DiaryCore>((resolve, reject) => {
    resolveBooted = resolve;
    rejectBooted = reject;
  });
  booted.catch(() => undefined);

  const post = (message: CoreMessage, transfer: Transferable[] = []): void => {
    try {
      scope.postMessage(message, transfer);
    } catch (e) {
      console.error('[diary-core] could not post to the host:', e);
    }
  };
  const emit = (event: CoreEvent): void => post(event);
  const log: CoreBootOptions['log'] = (level, message) => {
    if (level === 'info') return;
    emit({ type: 'event', name: 'log', level, message });
  };

  async function start(assets: CoreAssetsMessage): Promise<void> {
    try {
      const core = await boot({
        storage: options.bootOptions?.storage === undefined ? storage : options.bootOptions.storage,
        assets: { sqlWasm: assets.sqlWasm, fonts: assets.fonts },
        log,
        onEvent: emit,
        ...(options.bootOptions?.auth ? { auth: options.bootOptions.auth } : {}),
        ...(options.bootOptions?.mailTransport ? { mailTransport: options.bootOptions.mailTransport } : {}),
        ...(options.bootOptions?.passwordReset ? { passwordReset: options.bootOptions.passwordReset } : {}),
        ...(options.bootOptions?.now ? { now: options.bootOptions.now } : {}),
        ...(options.bootOptions?.storageRetryMs !== undefined ? { storageRetryMs: options.bootOptions.storageRetryMs } : {}),
      });
      resolveBooted(core);
      emit({ type: 'event', name: 'ready', protocol: CORE_PROTOCOL_VERSION });
    } catch (e) {
      const reason = e instanceof Error ? e : new Error(String(e));
      rejectBooted(reason);
      // Diagnostics only: the message of the error, never a path of the user's data or a secret.
      emit({ type: 'event', name: 'fatal', message: `boot failed: ${reason.message}` });
    }
  }

  async function serve(request: CoreRequest): Promise<void> {
    inFlight.add(request.id);
    try {
      let core: DiaryCore;
      try {
        core = await booted;
      } catch {
        post(jsonResponse(request.id, 503, NOT_READY_BODY));
        return;
      }
      const { response, events } = await core.handle(request);
      if (!cancelled.has(request.id)) post(response, transferList(response));
      // After the answer, as the protocol promises - and also for a cancelled request: only its
      // answer is dropped, what it changed (habits, reminders) is real.
      for (const event of events) emit(event);
    } finally {
      inFlight.delete(request.id);
      cancelled.delete(request.id);
    }
  }

  async function control(message: CoreControl): Promise<void> {
    let core: DiaryCore;
    try {
      core = await booted;
    } catch (e) {
      post({ type: 'control-result', id: message.id, ok: false, message: `core not ready: ${(e as Error).message}` });
      return;
    }
    try {
      if (message.action === 'flushAll') await core.flushAll();
      else if (message.action === 'lockAll') await core.lockAll();
      else await core.shutdown();
      post({ type: 'control-result', id: message.id, ok: true });
    } catch (e) {
      post({ type: 'control-result', id: message.id, ok: false, message: (e as Error)?.message ?? String(e) });
    }
    if (message.action === 'shutdown') {
      storage.dispose();
      scope.close();
    }
  }

  scope.addEventListener('message', (event) => {
    const message = event.data;
    if (isCoreAssetsMessage(message)) {
      if (assetsSeen) return;
      assetsSeen = true;
      void start(message);
      return;
    }
    if (!isHostMessage(message)) return;
    switch (message.type) {
      case 'request':
        void serve(message);
        return;
      case 'cancel':
        // The answer of a request still running is dropped; one that already finished is simply gone.
        if (inFlight.has(message.id)) cancelled.add(message.id);
        return;
      case 'control':
        controlChain = controlChain.then(() => control(message));
        return;
    }
  });

  return { booted };
}

// Start only when this file is the worker script (a worker has no `window`), not when a test
// imports it.
if (typeof window === 'undefined' && typeof self !== 'undefined' && typeof (self as { importScripts?: unknown }).importScripts === 'function') {
  runCoreWorker(self as unknown as CoreWorkerScope);
}
