/**
 * Host side of the host <-> core protocol (mobile/shared/transport.ts): the `ApiTransport` of the
 * Android build. `coreFetch(url, init)` has the contract of `fetch`: it posts one `CoreRequest`
 * to the core worker, waits for the `CoreResponse` with the same id and wraps it in a real
 * `Response` (status, headers, text or bytes), so src/api/client.ts handles it exactly like an
 * HTTP answer of the desktop server.
 *
 * Failures:
 *  - the core cannot be reached (it never became ready, reported `fatal`, the worker raised an
 *    error, an answer is malformed, it was shut down): the request rejects with `ApiClientError` status 0
 *    ("No connection to the local diary server"), like a refused HTTP connection on the desktop;
 *  - `init.signal` aborts: the request rejects with the abort reason (an AbortError) and the core
 *    is told to drop the answer (`CoreCancel`).
 */
import { ApiClientError, type ApiTransport } from '@/api/client';
import { tr } from '@/i18n/runtime';
import type { StorageRpcRequest, StorageRpcResponse } from '../shared/storage-protocol';
import {
  assetsTransferList,
  isCoreMessage,
  transferList,
  type CoreAssetBytes,
  type CoreAssetsMessage,
  type CoreControl,
  type CoreControlAction,
  type CoreEvent,
  type CoreHeaders,
  type CoreRequest,
  type CoreResponse,
  type HostMessage,
} from '../shared/transport';
import { encodeMultipart, readBlobBytes } from './multipart';

/**
 * The part of `Worker` the client uses (a fake in tests). It is also the `StoragePort` the host
 * serves the storage on (mobile/host/storage-rpc.ts): one channel carries both protocols.
 */
export interface CoreWorkerLike {
  postMessage(message: HostMessage | CoreAssetsMessage | StorageRpcRequest | StorageRpcResponse, transfer: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  addEventListener(type: 'message' | 'messageerror' | 'error', listener: (event: Event) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: 'message' | 'messageerror' | 'error', listener: (event: Event) => void): void;
  terminate(): void;
}

/** Receives the events of the core (`habits-changed` for the reminder scheduler; also ready / fatal / log). */
export type CoreEventListener = (event: CoreEvent) => void;

export interface CoreClientOptions {
  /** How long the core may take to post `ready` (0: no limit). */
  readyTimeoutMs?: number;
  /** An event listener installed from the start. */
  onEvent?: CoreEventListener;
}

export interface CoreClient {
  /** Resolves when the core posted `ready`; rejects when it cannot start (fatal, error, timeout). */
  readonly ready: Promise<void>;
  /** The transport for `setApiTransport()`. */
  readonly coreFetch: ApiTransport;
  /**
   * Sends a control action (flushAll / lockAll / shutdown) and waits for its result.
   * `shutdown` is final: once its result arrived the worker is closed and this client is dead -
   * every pending and later request rejects with the "no connection" error (status 0) and every
   * later control rejects. To go on, the page must boot a new core (reload).
   */
  control(action: CoreControlAction): Promise<void>;
  /**
   * Hands the boot-time assets (SQLite wasm, fonts) to the core - once, before it can become
   * ready. The buffers are transferred: they are unusable on the host afterwards.
   */
  sendAssets(assets: CoreAssetBytes): void;
  /** Subscribes to the core's events; returns the unsubscribe function. */
  onEvent(listener: CoreEventListener): () => void;
  /** Stops the worker; every pending and later request fails. */
  dispose(): void;
}

export const DEFAULT_READY_TIMEOUT_MS = 30_000;

/** Why controls reject after a `shutdown` (requests reject with the "no connection" ApiClientError). */
export const CORE_SHUT_DOWN_MESSAGE = 'The diary core was shut down.';

/** Statuses a `Response` may not carry a body for. */
const NULL_BODY_STATUS = new Set([204, 205, 304]);

/** Path and query of the request URL (the API base is '' on the phone, but tolerate an absolute URL). */
export function corePath(url: string): string {
  const parsed = new URL(url, 'http://localhost');
  return parsed.pathname + parsed.search;
}

function coreUnavailable(): ApiClientError {
  return new ApiClientError(0, { code: 'OTHER', message: tr('shell.noServer') });
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return Object.prototype.toString.call(value) === '[object ArrayBuffer]';
}

/** Lower-case header map of a `HeadersInit`. */
function toCoreHeaders(init: HeadersInit | undefined): CoreHeaders {
  const headers: CoreHeaders = {};
  new Headers(init).forEach((value, name) => {
    headers[name.toLowerCase()] = value;
  });
  return headers;
}

/**
 * The request body as text or bytes. Like `fetch`, it fills in the Content-Type the body implies
 * when the caller gave none; a FormData body always gets its own (it names the boundary).
 * The bytes are always a fresh buffer: they are transferred to the worker.
 */
async function encodeBody(
  body: BodyInit | null | undefined,
  headers: CoreHeaders,
): Promise<Pick<CoreRequest, 'bodyText' | 'bodyBytes'>> {
  if (body === undefined || body === null) return {};
  if (typeof body === 'string') {
    headers['content-type'] ??= 'text/plain;charset=UTF-8';
    return { bodyText: body };
  }
  if (body instanceof URLSearchParams) {
    headers['content-type'] ??= 'application/x-www-form-urlencoded;charset=UTF-8';
    return { bodyText: body.toString() };
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const { contentType, bytes } = await encodeMultipart(body);
    headers['content-type'] = contentType;
    return { bodyBytes: bytes };
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    if (body.type) headers['content-type'] ??= body.type;
    return { bodyBytes: (await readBlobBytes(body)).slice(0) };
  }
  if (isArrayBuffer(body)) return { bodyBytes: body.slice(0) };
  if (ArrayBuffer.isView(body)) {
    const copy = new Uint8Array(body.byteLength);
    copy.set(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
    return { bodyBytes: copy.buffer };
  }
  throw new TypeError('Unsupported request body for the diary core.');
}

/** The real `Response` of a `CoreResponse` (throws on a status or header no Response can have). */
export function toResponse(message: CoreResponse): Response {
  const body = NULL_BODY_STATUS.has(message.status) ? null : (message.bodyBytes ?? message.bodyText ?? null);
  return new Response(body, { status: message.status, headers: message.headers });
}

interface PendingRequest {
  resolve(response: Response): void;
  reject(reason: unknown): void;
  /** Detaches the abort listener. */
  release(): void;
}

interface PendingControl {
  action: CoreControlAction;
  resolve(): void;
  reject(reason: Error): void;
}

/** Connects to a core worker. The host sends nothing before the worker posted `ready`. */
export function createCoreClient(worker: CoreWorkerLike, options: CoreClientOptions = {}): CoreClient {
  let nextId = 1;
  /** Why the core is gone for good (null while it may still answer). */
  let dead: Error | null = null;
  let isReady = false;
  const requests = new Map<number, PendingRequest>();
  const controls = new Map<number, PendingControl>();
  const listeners = new Set<CoreEventListener>();
  if (options.onEvent) listeners.add(options.onEvent);
  let assetsSent = false;

  let resolveReady!: () => void;
  let rejectReady!: (reason: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // Callers that never await `ready` must not cause an unhandled rejection.
  ready.catch(() => undefined);

  const timeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
  const readyTimer =
    timeoutMs > 0 ? setTimeout(() => kill(new Error('The diary core did not start in time.')), timeoutMs) : null;

  /** Fails everything that still waits for the core. */
  function failPending(reason: Error): void {
    for (const pending of requests.values()) {
      pending.release();
      pending.reject(coreUnavailable());
    }
    requests.clear();
    for (const pending of controls.values()) pending.reject(reason);
    controls.clear();
  }

  /** The core is gone for good: no request is answered any more. */
  function kill(reason: Error): void {
    if (dead) return;
    dead = reason;
    if (readyTimer !== null) clearTimeout(readyTimer);
    rejectReady(reason);
    failPending(reason);
  }

  function onEvent(event: CoreEvent): void {
    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch (e) {
        console.error('[diary-core] an event listener failed:', e);
      }
    }
    switch (event.name) {
      case 'ready':
        if (dead || isReady) return;
        isReady = true;
        if (readyTimer !== null) clearTimeout(readyTimer);
        resolveReady();
        return;
      case 'fatal':
        kill(new Error(`The diary core stopped: ${event.message}`));
        return;
      case 'log':
        // Diagnostics only; the core never logs diary content.
        console[event.level](`[diary-core] ${event.message}`);
        return;
      case 'habits-changed':
        // For the listeners only (the reminder scheduler of WP-8).
        return;
      case 'storage-failed':
      case 'storage-recovered':
        // For the listeners only (the "storage is full" banner); the core logs the details itself.
        return;
    }
  }

  worker.addEventListener('message', (event) => {
    const message = (event as MessageEvent<unknown>).data;
    if (!isCoreMessage(message)) return;
    switch (message.type) {
      case 'event':
        onEvent(message);
        return;
      case 'response': {
        const pending = requests.get(message.id);
        if (!pending) return; // cancelled, or already failed
        requests.delete(message.id);
        pending.release();
        try {
          pending.resolve(toResponse(message));
        } catch {
          pending.reject(coreUnavailable());
        }
        return;
      }
      case 'control-result': {
        const pending = controls.get(message.id);
        if (!pending) return;
        controls.delete(message.id);
        if (message.ok) pending.resolve();
        else pending.reject(new Error(message.message ?? `The diary core could not run ${pending.action}.`));
        // The worker closes itself after the result of a shutdown, whether it worked or not
        // (mobile/core/worker.ts): nothing will be answered any more. Whatever still waits, and
        // whatever is asked later, fails at once instead of waiting for ever.
        if (pending.action === 'shutdown') kill(new Error(CORE_SHUT_DOWN_MESSAGE));
        return;
      }
    }
  });

  // An uncaught error inside the worker, or a message that could not be deserialised: it is not
  // known which request it belongs to, so none of the waiting ones can count on an answer.
  const onWorkerFailure = (): void => {
    const reason = new Error('The diary core worker failed.');
    if (isReady) failPending(reason);
    else kill(reason);
  };
  worker.addEventListener('error', onWorkerFailure);
  worker.addEventListener('messageerror', onWorkerFailure);

  async function whenReady(): Promise<void> {
    try {
      await ready;
    } catch {
      throw coreUnavailable();
    }
    if (dead) throw coreUnavailable();
  }

  const coreFetch: ApiTransport = async (url, init) => {
    const signal = init.signal ?? null;
    if (signal?.aborted) throw abortReason(signal);

    const headers = toCoreHeaders(init.headers);
    const body = await encodeBody(init.body, headers);
    await whenReady();
    if (signal?.aborted) throw abortReason(signal);

    const request: CoreRequest = {
      type: 'request',
      id: nextId++,
      method: (init.method ?? 'GET').toUpperCase(),
      url: corePath(url),
      headers,
      ...body,
    };
    return new Promise<Response>((resolve, reject) => {
      const onAbort = (): void => {
        if (!requests.delete(request.id)) return;
        try {
          worker.postMessage({ type: 'cancel', id: request.id }, []);
        } catch {
          /* the worker is gone; nothing to cancel */
        }
        reject(abortReason(signal as AbortSignal));
      };
      const release = (): void => signal?.removeEventListener('abort', onAbort);
      requests.set(request.id, { resolve, reject, release });
      signal?.addEventListener('abort', onAbort, { once: true });
      try {
        worker.postMessage(request, transferList(request));
      } catch {
        requests.delete(request.id);
        release();
        reject(coreUnavailable());
      }
    });
  };

  async function control(action: CoreControlAction): Promise<void> {
    await ready;
    if (dead) throw dead;
    const message: CoreControl = { type: 'control', id: nextId++, action };
    return new Promise<void>((resolve, reject) => {
      controls.set(message.id, { action, resolve, reject });
      try {
        worker.postMessage(message, []);
      } catch (e) {
        controls.delete(message.id);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  function sendAssets(assets: CoreAssetBytes): void {
    if (assetsSent) throw new Error('The core assets were sent already.');
    if (dead) throw dead;
    assetsSent = true;
    const message: CoreAssetsMessage = { type: 'assets', sqlWasm: assets.sqlWasm, fonts: assets.fonts };
    worker.postMessage(message, assetsTransferList(message));
  }

  function subscribe(listener: CoreEventListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function dispose(): void {
    kill(new Error('The diary core was stopped.'));
    listeners.clear();
    worker.terminate();
  }

  return { ready, coreFetch, control, sendAssets, onEvent: subscribe, dispose };
}
