/**
 * Message protocol between the UI (main thread: mobile/host) and the diary core (the Web Worker
 * that runs the server logic: mobile/core). See docs/ANDROID-PLAN.md, section 2.
 *
 * The UI never talks HTTP on the phone. Every API call of src/api/client.ts becomes one
 * `CoreRequest` posted to the worker, answered by exactly one `CoreResponse` with the same id -
 * the same method, path, headers, status and body an HTTP round trip to the desktop server has.
 *
 *   host -> core : CoreRequest | CoreCancel | CoreControl          (HostMessage)
 *                  CoreAssetsMessage (once, at boot: the SQLite wasm + the PDF fonts)
 *   core -> host : CoreResponse | CoreControlResult | CoreEvent    (CoreMessage)
 *
 * The storage calls of the core travel over the same channel (./storage-protocol.ts); each side
 * ignores what is not addressed to it.
 *
 * Rules:
 *  - ids are chosen by the host and are unique per worker; requests and controls share one counter;
 *  - a body is either text (`bodyText`, e.g. JSON) or bytes (`bodyBytes`, e.g. a backup file or a
 *    multipart upload), never both; none of them means "no body";
 *  - `bodyBytes` is an ArrayBuffer that is TRANSFERRED, not copied (see `transferList`);
 *  - header names are lower-case; values are strings;
 *  - the core posts the `ready` event once, when it can answer requests; the host sends nothing
 *    before it. If the core cannot start it posts `fatal` instead;
 *  - an answer to a request that changed something is posted only when the change is in the
 *    storage (the diary file included); when the storage refused it the answer is 500 `IO`;
 *  - after the result of a `shutdown` control the worker is closed: nothing is answered any more
 *    and the page must create a new worker (reload) to go on.
 *
 * This module is imported by both sides, so it must stay free of DOM, worker and Node APIs.
 */

/** Bumped on an incompatible change; the core reports its version in the `ready` event. */
export const CORE_PROTOCOL_VERSION = 1;

/** Header map with lower-case names. */
export type CoreHeaders = Record<string, string>;

// ---------------------------------------------------------------------------
// Boot-time assets (host -> core, once, before `ready`)
// ---------------------------------------------------------------------------

/**
 * The binary files the core needs and cannot load itself (a worker started from a blob: URL must
 * not fetch): the SQLite WebAssembly module and the PDF fonts. The mobile build copies them from
 * server/node_modules/sql.js and src-tauri/resources/server/fonts into `<webDir>/core-assets/`
 * (mobile/vite.config.mobile.ts); the host fetches them (same origin, allowed by the CSP) and
 * transfers the bytes to the worker (mobile/host/assets.ts), which registers them before it boots
 * (mobile/core/assets.ts).
 */
export const CORE_ASSETS_DIR = 'core-assets';
/** File name of the SQLite WebAssembly module inside CORE_ASSETS_DIR (the browser build of sql.js). */
export const CORE_SQL_WASM_FILE = 'sql-wasm.wasm';
/** Directory of the font files inside CORE_ASSETS_DIR. */
export const CORE_FONTS_DIR = 'fonts';
/** The bundled PDF fonts (server/src/export/fonts.ts, BUNDLED_FONT_FILES): all of them must arrive. */
export const CORE_FONT_FILES: readonly string[] = [
  'DejaVuSans.ttf',
  'DejaVuSans-Bold.ttf',
  'NotoSansArabic-Regular.ttf',
  'NotoSansArabic-Bold.ttf',
  'NotoSansDevanagari-Regular.ttf',
  'NotoSansDevanagari-Bold.ttf',
  'NotoSansThai-Regular.ttf',
  'NotoSansThai-Bold.ttf',
];

/** The bytes of the boot-time assets, as the host hands them to the core. */
export interface CoreAssetBytes {
  sqlWasm: ArrayBuffer;
  /** Font file name (CORE_FONT_FILES) -> content. */
  fonts: Record<string, ArrayBuffer>;
}

/**
 * host -> core: the assets. Sent once, right after the worker was created; every buffer is
 * TRANSFERRED. Not a `HostMessage`: the placeholder core and the request protocol ignore it.
 */
export interface CoreAssetsMessage extends CoreAssetBytes {
  type: 'assets';
}

// ---------------------------------------------------------------------------
// host -> core
// ---------------------------------------------------------------------------

/** One API call (the HTTP request the desktop UI would have sent). */
export interface CoreRequest {
  type: 'request';
  id: number;
  /** Upper-case HTTP method. */
  method: string;
  /** Path and query only, e.g. `/api/entries?page=2`. */
  url: string;
  headers: CoreHeaders;
  bodyText?: string;
  bodyBytes?: ArrayBuffer;
}

/** The UI no longer waits for request `id` (AbortSignal); the core may drop its answer. */
export interface CoreCancel {
  type: 'cancel';
  id: number;
}

/**
 * Control actions (not API calls):
 *  - `flushAll`: write everything that is still in memory to storage (the app goes to the background);
 *  - `lockAll`:  lock every open session (the "lock when I leave the app" setting);
 *  - `shutdown`: flush, close the databases and stop the worker.
 */
export const CORE_CONTROL_ACTIONS = ['flushAll', 'lockAll', 'shutdown'] as const;
export type CoreControlAction = (typeof CORE_CONTROL_ACTIONS)[number];

export interface CoreControl {
  type: 'control';
  id: number;
  action: CoreControlAction;
}

export type HostMessage = CoreRequest | CoreCancel | CoreControl;

// ---------------------------------------------------------------------------
// core -> host
// ---------------------------------------------------------------------------

/** The answer to the `CoreRequest` with the same id. */
export interface CoreResponse {
  type: 'response';
  id: number;
  /** HTTP status (200-599). */
  status: number;
  headers: CoreHeaders;
  bodyText?: string;
  bodyBytes?: ArrayBuffer;
}

/** The answer to the `CoreControl` with the same id. */
export interface CoreControlResult {
  type: 'control-result';
  id: number;
  ok: boolean;
  /** Why it failed (diagnostics only, not shown to the user). */
  message?: string;
}

/** The core is up and answers requests. */
export interface CoreReadyEvent {
  type: 'event';
  name: 'ready';
  protocol: number;
}

/** The core could not start (or can no longer run); no request will be answered. */
export interface CoreFatalEvent {
  type: 'event';
  name: 'fatal';
  /** Diagnostics only, not shown to the user. */
  message: string;
}

/** A diagnostic line from the core (never diary content). */
export interface CoreLogEvent {
  type: 'event';
  name: 'log';
  level: 'info' | 'warn' | 'error';
  message: string;
}

/**
 * Habits or reminder settings of an account changed (a habit was created, edited, archived or
 * deleted, a backup was restored, the demo data was seeded, the diary settings were saved): the
 * host's reminder scheduler (WP-8) re-reads the due reminders.
 *
 * Posted right AFTER the answer of the request that made the change (the worker posts the
 * `CoreResponse` first, then this event) - also when the host cancelled that request meanwhile:
 * the answer is dropped then, the change happened all the same.
 */
export interface CoreHabitsChangedEvent {
  type: 'event';
  name: 'habits-changed';
  /** Id of the account whose habits changed ('' when it is not known). */
  userId: string;
}

/**
 * The storage of the phone refused a change (it is full, or cannot be reached): something the
 * core holds in memory is not in the storage. Posted once, when that state begins - not once per
 * request. Until `storage-recovered` arrives:
 *  - reading, searching, exporting and downloading a backup keep working (their answers do not
 *    depend on the storage);
 *  - a request whose own change could not be stored is answered 500 `IO`;
 *  - the core tries again by itself every few seconds; nothing has to be re-sent.
 * The UI should tell the user (a banner: free some space; export or back up the diary).
 */
export interface CoreStorageFailedEvent {
  type: 'event';
  name: 'storage-failed';
}

/** Everything the core holds is in the storage again (the end of the state `storage-failed` began). */
export interface CoreStorageRecoveredEvent {
  type: 'event';
  name: 'storage-recovered';
}

export type CoreEvent =
  | CoreReadyEvent
  | CoreFatalEvent
  | CoreLogEvent
  | CoreHabitsChangedEvent
  | CoreStorageFailedEvent
  | CoreStorageRecoveredEvent;

/** The names of the events the core may post. */
export const CORE_EVENT_NAMES: readonly CoreEvent['name'][] = ['ready', 'fatal', 'log', 'habits-changed', 'storage-failed', 'storage-recovered'];

export type CoreMessage = CoreResponse | CoreControlResult | CoreEvent;

// ---------------------------------------------------------------------------
// Helpers shared by both sides
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasId(value: Record<string, unknown>): boolean {
  return typeof value.id === 'number' && Number.isInteger(value.id);
}

export function isCoreControlAction(value: unknown): value is CoreControlAction {
  return typeof value === 'string' && (CORE_CONTROL_ACTIONS as readonly string[]).includes(value);
}

/** Shape check for what the worker receives (anything else is ignored). */
export function isHostMessage(value: unknown): value is HostMessage {
  if (!isRecord(value) || !hasId(value)) return false;
  switch (value.type) {
    case 'request':
      return typeof value.method === 'string' && typeof value.url === 'string' && isRecord(value.headers);
    case 'cancel':
      return true;
    case 'control':
      return isCoreControlAction(value.action);
    default:
      return false;
  }
}

/** Shape check for what the host receives (anything else is ignored). */
export function isCoreMessage(value: unknown): value is CoreMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'response':
      return hasId(value) && typeof value.status === 'number' && isRecord(value.headers);
    case 'control-result':
      return hasId(value) && typeof value.ok === 'boolean';
    case 'event':
      return typeof value.name === 'string' && (CORE_EVENT_NAMES as readonly string[]).includes(value.name);
    default:
      return false;
  }
}

function isArrayBufferValue(value: unknown): value is ArrayBuffer {
  return Object.prototype.toString.call(value) === '[object ArrayBuffer]';
}

/** Shape check for the boot-time assets message the worker receives. */
export function isCoreAssetsMessage(value: unknown): value is CoreAssetsMessage {
  if (!isRecord(value) || value.type !== 'assets') return false;
  if (!isArrayBufferValue(value.sqlWasm) || !isRecord(value.fonts)) return false;
  return Object.values(value.fonts).every(isArrayBufferValue);
}

/** The transfer list for `postMessage(message, transferList(message))`: the body bytes, if any. */
export function transferList(message: HostMessage | CoreMessage): ArrayBuffer[] {
  return 'bodyBytes' in message && message.bodyBytes !== undefined ? [message.bodyBytes] : [];
}

/** The transfer list of the assets message: every buffer in it. */
export function assetsTransferList(message: CoreAssetsMessage): ArrayBuffer[] {
  return [message.sqlWasm, ...Object.values(message.fonts)];
}

/** A JSON `CoreResponse` (what `res.status(status).json(body)` produces on the desktop server). */
export function jsonResponse(id: number, status: number, body: unknown): CoreResponse {
  return {
    type: 'response',
    id,
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    bodyText: JSON.stringify(body),
  };
}
