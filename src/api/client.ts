/**
 * HTTP client for the diary server.
 *
 * API base (`getApiBase`, `apiBaseKind`):
 *  - Windows app (Tauri) and Android app (Capacitor): the Your Personal Diary server - the ONE fixed
 *    address of src/config/server-default.ts. The published apps are server-only thin clients
 *    (docs/android-tasks/HOSTED-IMPL.md item 8): nothing in the UI can change it.
 *  - Web: the UI is served by the server itself, so the API base is '' (same origin).
 *  - Developer / test configurations (never reachable from the UI): `VITE_API_BASE` overrides the
 *    base; a desktop build made with `VITE_LOCAL_SERVER=1` discovers the port of its local sidecar
 *    through the Tauri command `get_server_info`, as the local-mode app did; an Android build with
 *    `__MOBILE_LOCAL_CORE__` boots the in-process core and uses '' (the core transport answers).
 *
 * Session token storage: localStorage when "remember me" was chosen, sessionStorage otherwise.
 * On 401 the token is dropped and a `mpd:unauthorized` event is dispatched so the auth
 * context can show the login screen.
 *
 * Every request carries `Accept-Language: <current UI locale>` (docs/API.md, "כללי") so
 * the server answers - errors, insights, search answers, exports - in the UI language.
 *
 * Connection state: a request that cannot reach the server rejects with `ApiClientError` status 0 and
 * reports it to the connection store (./connection.ts) - so does a 502 / 503 / 504 that did not come
 * from the diary server but from the proxy in front of it (`isConnectionError`). Any answer from the
 * server clears the state. The UI shows the "No connection to the diary server" screen / banner with
 * Retry from that store (src/context/ConnectionContext.tsx).
 *
 * Transport seam: every request of this module goes through one `ApiTransport` (default: the
 * global `fetch`). The Android local-core build installs its own transport with `setApiTransport()` -
 * the requests then go to the diary core running in a Web Worker instead of over HTTP
 * (docs/ANDROID-PLAN.md, section 2). Everything else - error parsing, the token, the 401/423
 * events, Accept-Language - is the same for every transport.
 */
import type { ApiErrorBody, ErrorCode } from '@shared/types';
import { DEFAULT_SERVER_URL, developerApiBase, isLocalServerBuild, shouldBootLocalCore } from '@/config/server-default';
import { getCurrentLocale, tr } from '@/i18n/runtime';
import { getServerInfo, reportConnectionLost, reportServerReached } from './connection';

export const TOKEN_KEY = 'mpd.token';
export const UNAUTHORIZED_EVENT = 'mpd:unauthorized';
/** Fired when the server answers 423 LOCKED: the session was locked (lock screen, maybe in another tab). */
export const LOCKED_EVENT = 'mpd:locked';

/** Tells the app that the session is locked on the server (LockProvider shows the lock screen). */
function reportLocked(res: Response): void {
  if (res.status === 423) window.dispatchEvent(new CustomEvent(LOCKED_EVENT));
}
export const OFFLINE_MODE_KEY = 'mpd.offlinePrivacyMode';

export interface ApiClientErrorOptions {
  /**
   * False when the error body did not come from the diary server (no JSON error body: a proxy's
   * 502 / 503 / 504 page, an empty answer) - see `isConnectionError`. Default true: an error built from a
   * body is the server's own answer.
   */
  fromServer?: boolean;
  /** Seconds the server asked to wait before retrying (`Retry-After` of a 429 / 503), when it sent one. */
  retryAfterSec?: number;
}

export class ApiClientError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly field?: string;
  /** True when the diary server itself produced this error (false: status 0, or a proxy answer without the server's JSON body). */
  readonly fromServer: boolean;
  /** The `Retry-After` header of the answer in seconds, when there was one (the offline replayer honours it). */
  readonly retryAfterSec?: number;
  constructor(status: number, body: ApiErrorBody, options: ApiClientErrorOptions = {}) {
    super(body.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = body.code;
    this.field = body.field;
    this.fromServer = status === 0 ? false : (options.fromServer ?? true);
    if (options.retryAfterSec !== undefined) this.retryAfterSec = options.retryAfterSec;
  }
}

/** `Retry-After` as seconds (a delay in seconds or an HTTP date), or undefined when absent / unreadable. */
function retryAfterSeconds(res: Response): number | undefined {
  let raw: string | null = null;
  try {
    raw = res.headers?.get?.('Retry-After') ?? null;
  } catch {
    return undefined;
  }
  if (!raw) return undefined;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return n;
  const at = Date.parse(raw);
  return Number.isFinite(at) ? Math.max(0, Math.round((at - Date.now()) / 1000)) : undefined;
}

export function isApiClientError(e: unknown): e is ApiClientError {
  return e instanceof ApiClientError;
}

/** Statuses a proxy in front of the server answers when the server is down or not answering in time. */
const GATEWAY_STATUSES = new Set([502, 503, 504]);

/**
 * True when the error means "the diary server cannot be reached": a network failure (status 0) or a
 * 502 / 503 / 504 that did not carry the server's own JSON error body (the hosting platform's proxy
 * answering for a server that is down). A 503 FROM the server (busy, registration full, tour full) is
 * not a connection error - the server is there and said so.
 */
export function isConnectionError(e: unknown): boolean {
  if (!isApiClientError(e)) return false;
  return e.status === 0 || (GATEWAY_STATUSES.has(e.status) && !e.fromServer);
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** The part of the global `Capacitor` object (set by the native bridge / @capacitor/core) read here. */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

/**
 * True only inside the installed Android/iOS app: the mobile build (`__MOBILE__`) running in the
 * Capacitor WebView. False on the desktop, in a browser, and when the mobile build is opened in
 * a plain browser during development (`npm run mobile:dev`). Re-exported by src/utils/platform.ts.
 */
export function isNativeApp(): boolean {
  // The flag is replaced at build time; on the desktop this whole function folds to `return false`.
  if (typeof __MOBILE__ === 'undefined' || !__MOBILE__) return false;
  return (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor?.isNativePlatform?.() === true;
}

/**
 * How this build reaches the diary server:
 *  - 'override':     `VITE_API_BASE` (development / tests);
 *  - 'local-core':   the Android local-core build - the in-process core answers at '';
 *  - 'local-server': the desktop local-mode build (`VITE_LOCAL_SERVER=1`) - the sidecar's port is discovered;
 *  - 'server':       the Windows app and the Android app - the fixed Your Personal Diary server;
 *  - 'same-origin':  the web UI served by the server itself ('').
 */
export type ApiBaseKind = 'override' | 'local-core' | 'local-server' | 'server' | 'same-origin';

/** Decided at call time from the build flags and the runtime (Tauri / Capacitor); see `ApiBaseKind`. */
export function apiBaseKind(): ApiBaseKind {
  if (developerApiBase() !== null) return 'override';
  if (shouldBootLocalCore()) return 'local-core';
  if (isTauri() && isLocalServerBuild()) return 'local-server';
  if (isTauri() || isNativeApp()) return 'server';
  return 'same-origin';
}

/**
 * True when this UI talks to the Your Personal Diary server: the apps (fixed address), or any UI whose
 * server described itself as hosted (`ServerInfo.mode === 'hosted'` - the web UI served by that server).
 * The texts then say "the diary server" (never "the local server") and Settings hides what a hosted
 * server does not offer.
 */
export function isServerMode(): boolean {
  return apiBaseKind() === 'server' || getServerInfo()?.mode === 'hosted';
}

let apiBasePromise: Promise<string> | null = null;
let apiBaseResolved: string | null = null;

/** Local-mode desktop build only: the sidecar's port through the Tauri shell (it may still be starting: ~20 s of retries). */
async function discoverLocalServer(): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const info = await invoke<{ port: number; ready: boolean }>('get_server_info');
      if (info && info.ready && info.port > 0) return `http://127.0.0.1:${info.port}`;
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(tr('shell.serverNotStarted'));
}

/** Resolves the API base URL: the fixed server in the apps, '' on the web (see `apiBaseKind`). */
export function getApiBase(): Promise<string> {
  if (apiBaseResolved !== null) return Promise.resolve(apiBaseResolved);
  if (!apiBasePromise) {
    apiBasePromise = (async () => {
      switch (apiBaseKind()) {
        case 'override':
          return developerApiBase() as string;
        case 'local-core':
          return '';
        case 'local-server':
          return discoverLocalServer();
        case 'server':
          return DEFAULT_SERVER_URL;
        case 'same-origin':
          return '';
      }
    })().then(
      (base) => {
        apiBaseResolved = base;
        return base;
      },
      (e: unknown) => {
        // A failed discovery is not cached: the next request asks again.
        apiBasePromise = null;
        throw e;
      },
    );
  }
  return apiBasePromise;
}

/** For tests / dev tools: fixes the API base (null forgets it, so the next request resolves it again). */
export function __setApiBaseForTests(base: string | null): void {
  apiBaseResolved = base;
  apiBasePromise = null;
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return safeStorage('session')?.getItem(TOKEN_KEY) ?? safeStorage('local')?.getItem(TOKEN_KEY) ?? null;
}

export function setToken(token: string, remember: boolean): void {
  clearToken();
  safeStorage(remember ? 'local' : 'session')?.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  safeStorage('session')?.removeItem(TOKEN_KEY);
  safeStorage('local')?.removeItem(TOKEN_KEY);
}

export function hasRememberedToken(): boolean {
  return !!safeStorage('local')?.getItem(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

/**
 * How a request reaches the diary server: same contract as `fetch(url, init)`. It resolves to a
 * real `Response` for every HTTP status and rejects only when the server cannot be reached
 * (or with an AbortError when `init.signal` aborts).
 */
export type ApiTransport = (url: string, init: RequestInit) => Promise<Response>;

/** The default transport. `fetch` is looked up per call, so the network guard (and test stubs) apply. */
const fetchTransport: ApiTransport = (url, init) => fetch(url, init);

let apiTransport: ApiTransport = fetchTransport;

/** Installs another transport for all API requests; `null` restores the default (`fetch`). */
export function setApiTransport(transport: ApiTransport | null): void {
  apiTransport = transport ?? fetchTransport;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export type Query = Record<string, string | number | boolean | null | undefined>;

export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Header name carrying the UI language to the server. */
export const LANGUAGE_HEADER = 'Accept-Language';

/** Headers common to every request: JSON accept + the UI language (+ the bearer token). */
function baseHeaders(token: string | null, json = true): Record<string, string> {
  const headers: Record<string, string> = { [LANGUAGE_HEADER]: getCurrentLocale() };
  if (json) headers.Accept = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseError(res: Response): Promise<ApiClientError> {
  let body: ApiErrorBody = { code: 'OTHER', message: tr('shell.errorStatus', { status: res.status }) };
  // The diary server always answers an error as JSON with a message; anything else (a proxy's error
  // page, an empty body) did not come from it - that is what `isConnectionError` asks for 502-504.
  let fromServer = false;
  try {
    const parsed = (await res.json()) as Partial<ApiErrorBody>;
    if (parsed && typeof parsed.message === 'string') {
      body = { code: (parsed.code as ErrorCode) || 'OTHER', message: parsed.message, field: parsed.field };
      fromServer = true;
    }
  } catch {
    /* non-JSON error body */
  }
  const retryAfterSec = retryAfterSeconds(res);
  return new ApiClientError(res.status, body, retryAfterSec === undefined ? { fromServer } : { fromServer, retryAfterSec });
}

/** The status-0 message: "No connection to the diary server." in server mode, the local wording otherwise. */
function noServerMessage(): string {
  return tr(isServerMode() ? 'shell.connection.noServer' : 'shell.noServer');
}

/**
 * Turns a transport failure into the status-0 error (an abort is rethrown) and reports the lost
 * connection. A request that ran into its own `timeoutMs` (`timedOut`) is a lost connection too, even
 * though the transport reports it as an abort.
 */
function connectionFailure(e: unknown, timedOut = false): never {
  if (!timedOut && (e as Error).name === 'AbortError') throw e;
  reportConnectionLost();
  throw new ApiClientError(0, { code: 'OTHER', message: noServerMessage() });
}

/** The caller's signal composed with the request's own timeout (OFFLINE-DESIGN.md section 4.2 "Timeouts"). */
interface TimedSignal {
  signal: AbortSignal | undefined;
  /** True once the timeout fired (the abort is then a lost connection, not the caller's abort). */
  timedOut: () => boolean;
  /** Clears the timer; call once the exchange is over. */
  done: () => void;
}

/**
 * Composes `signal` with a timeout of `timeoutMs` through `AbortSignal.any`, or a hand-linked
 * `AbortController` where that is missing. Without a timeout the caller's signal is passed through
 * untouched, so today's calls are unchanged.
 */
function withTimeout(signal: AbortSignal | undefined, timeoutMs: number | undefined): TimedSignal {
  if (!timeoutMs || !(timeoutMs > 0)) return { signal, timedOut: () => false, done: () => {} };
  const timer = new AbortController();
  let fired = false;
  const handle = setTimeout(() => {
    fired = true;
    timer.abort();
  }, timeoutMs);
  let composed: AbortSignal;
  if (!signal) {
    composed = timer.signal;
  } else if (typeof AbortSignal.any === 'function') {
    composed = AbortSignal.any([signal, timer.signal]);
  } else {
    const link = new AbortController();
    const onAbort = () => link.abort();
    if (signal.aborted) link.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
    timer.signal.addEventListener('abort', onAbort, { once: true });
    composed = link.signal;
  }
  return { signal: composed, timedOut: () => fired, done: () => clearTimeout(handle) };
}

/** An answer arrived: the server is there - unless it is a proxy's gateway error (see `isConnectionError`). */
async function failedResponse(res: Response): Promise<ApiClientError> {
  const error = await parseError(res);
  if (isConnectionError(error)) reportConnectionLost();
  else reportServerReached();
  return error;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** Skip the Authorization header (login/register). */
  anonymous?: boolean;
  signal?: AbortSignal;
  /**
   * Gives up after this many milliseconds: the request then fails exactly like a lost connection
   * (`ApiClientError` status 0, the connection store told). Composed with `signal`. Default: none -
   * today's calls are unchanged. The offline engine passes it for its cached reads, its sync
   * operations and its connectivity probe (OFFLINE-DESIGN.md section 4.2).
   */
  timeoutMs?: number;
  /** The fetch cache mode (`'no-store'` for the connectivity probe). Default: not set, as today. */
  cache?: RequestCache;
}

/** JSON request. Resolves to the parsed body (or undefined for 204). */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const base = await getApiBase();
  const headers = baseHeaders(opts.anonymous ? null : getToken());
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const timed = withTimeout(opts.signal, opts.timeoutMs);
  try {
    let res: Response;
    try {
      res = await apiTransport(base + withQuery(path, opts.query), {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: timed.signal,
        credentials: 'omit',
        ...(opts.cache ? { cache: opts.cache } : {}),
      });
    } catch (e) {
      connectionFailure(e, timed.timedOut());
    }
    if (res.status === 401 && !opts.anonymous) {
      clearToken();
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    reportLocked(res);
    if (!res.ok) throw await failedResponse(res);
    reportServerReached();
    if (res.status === 204) return undefined as T;
    let text: string;
    try {
      text = await res.text();
    } catch (e) {
      connectionFailure(e, timed.timedOut());
    }
    return (text ? JSON.parse(text) : undefined) as T;
  } finally {
    timed.done();
  }
}

/** Request that returns a file (backup/export download in the browser). `headers` exposes e.g. X-Entries-Exported. */
export async function requestBlob(
  path: string,
  opts: RequestOptions = {},
): Promise<{ blob: Blob; fileName: string; headers: Headers }> {
  const base = await getApiBase();
  const headers = baseHeaders(getToken(), false);
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await apiTransport(base + withQuery(path, opts.query), {
      method: opts.method ?? 'POST',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
      credentials: 'omit',
    });
  } catch (e) {
    connectionFailure(e);
  }
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
  reportLocked(res);
  if (!res.ok) throw await failedResponse(res);
  reportServerReached();
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
  const fileName = m ? decodeURIComponent(m[1] || m[2]) : 'download';
  return { blob: await res.blob(), fileName, headers: res.headers };
}

/** Multipart upload (restore from the browser). */
export async function requestUpload<T>(path: string, form: FormData): Promise<T> {
  const base = await getApiBase();
  const headers = baseHeaders(getToken());
  let res: Response;
  try {
    res = await apiTransport(base + path, { method: 'POST', headers, body: form, credentials: 'omit' });
  } catch (e) {
    connectionFailure(e);
  }
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
  reportLocked(res);
  if (!res.ok) throw await failedResponse(res);
  reportServerReached();
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Offline privacy guard
// ---------------------------------------------------------------------------

let guardInstalled = false;
let offlineMode = true;

export function setOfflinePrivacyMode(enabled: boolean): void {
  offlineMode = enabled;
  try {
    localStorage.setItem(OFFLINE_MODE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function getOfflinePrivacyMode(): boolean {
  return offlineMode;
}

function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url, window.location.href);
    if (u.origin === window.location.origin) return true;
    if (apiBaseResolved && u.origin === new URL(apiBaseResolved).origin) return true;
    // The apps' fixed server (src/config/server-default.ts) - the one outbound host of the client.
    if (apiBaseKind() === 'server' && u.origin === DEFAULT_SERVER_URL) return true;
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === 'ipc.localhost') return true;
    if (u.protocol === 'ipc:' || u.protocol === 'tauri:' || u.protocol === 'blob:' || u.protocol === 'data:') return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Installs a belt-and-braces guard that refuses fetch/XHR/WebSocket/EventSource to
 * anything that is not the diary server (the apps' fixed server, or the local one in the
 * developer configurations) or the page's own origin. The CSP already blocks external
 * connections; this guard makes the "offline privacy mode" switch observable and testable.
 */
export function installNetworkGuard(): void {
  if (guardInstalled || typeof window === 'undefined') return;
  guardInstalled = true;
  try {
    offlineMode = localStorage.getItem(OFFLINE_MODE_KEY) !== '0';
  } catch {
    offlineMode = true;
  }
  const origFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (offlineMode && !isAllowedUrl(url)) {
      return Promise.reject(new Error(tr('shell.offlineBlocked')));
    }
    return origFetch(input, init);
  }) as typeof window.fetch;

  const OrigXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    if (offlineMode && !isAllowedUrl(String(url))) {
      throw new Error(tr('shell.offlineBlocked'));
    }
    return (OrigXhrOpen as unknown as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;

  const OrigWebSocket = window.WebSocket;
  if (OrigWebSocket) {
    const Guarded = function (this: unknown, url: string | URL, protocols?: string | string[]) {
      if (offlineMode && !isAllowedUrl(String(url))) {
        throw new Error(tr('shell.offlineBlocked'));
      }
      return new OrigWebSocket(url, protocols);
    } as unknown as typeof WebSocket;
    Guarded.prototype = OrigWebSocket.prototype;
    Object.assign(Guarded, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    window.WebSocket = Guarded;
  }
}
