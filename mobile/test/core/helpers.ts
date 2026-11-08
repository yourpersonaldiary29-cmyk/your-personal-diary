/**
 * Test rig of the mobile core (mobile/test/core): boots the real core in-process on a
 * `MemoryStorage` (the storage of the browser dev mode) with the assets a phone would receive,
 * and offers a `fetch`-like client over `core.handle` so that the contract tests can run one
 * scenario against the core and against the desktop server with the same code.
 */
import fs from 'node:fs';
import path from 'node:path';
import { bootCore, type CoreBootOptions, type DiaryCore } from '../../core/boot';
import { MemoryStorage } from '../../host/storage/memory';
import type { StorageBackend } from '../../shared/storage-protocol';
import { CORE_FONT_FILES, type CoreAssetBytes, type CoreEvent, type CoreHeaders, type CoreRequest, type CoreResponse } from '../../shared/transport';

const projectRoot = process.cwd();
export const FONTS_DIR = path.join(projectRoot, 'src-tauri', 'resources', 'server', 'fonts');
export const SQL_WASM_FILE = path.join(projectRoot, 'server', 'node_modules', 'sql.js', 'dist', 'sql-wasm-browser.wasm');

/** Cheap scrypt parameters for the tests (both sides use them; the format stays the same). */
export const FAST_KDF = { N: 1024, r: 8, p: 1 };

function exactBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

let cachedAssets: CoreAssetBytes | null = null;

/** The assets as the host transfers them (each call gives fresh buffers: a transfer detaches them). */
export function testAssets(): CoreAssetBytes {
  if (!cachedAssets) {
    const fonts: Record<string, ArrayBuffer> = {};
    for (const name of CORE_FONT_FILES) fonts[name] = exactBuffer(fs.readFileSync(path.join(FONTS_DIR, name)));
    cachedAssets = { sqlWasm: exactBuffer(fs.readFileSync(SQL_WASM_FILE)), fonts };
  }
  return {
    sqlWasm: cachedAssets.sqlWasm.slice(0),
    fonts: Object.fromEntries(Object.entries(cachedAssets.fonts).map(([name, bytes]) => [name, bytes.slice(0)])),
  };
}

/** A response as both clients give it back: status, lower-case headers, body text or bytes. */
export interface Answer {
  status: number;
  headers: Record<string, string>;
  body: string | Uint8Array | null;
  /** The body parsed as JSON (undefined when empty or not JSON). */
  json: unknown;
}

export interface CallInit {
  method?: string;
  headers?: Record<string, string>;
  /** An object is sent as JSON; a string / bytes as given. */
  body?: unknown;
  token?: string | null;
  /** Accept-Language; default 'en'. Null: no header. */
  locale?: string | null;
}

/** A client of one side (the core or the desktop server). */
export type Client = (url: string, init?: CallInit) => Promise<Answer>;

const decoder = new TextDecoder();

function parseJson(body: string | Uint8Array | null, contentType: string | undefined): unknown {
  if (body === null || !contentType?.includes('json')) return undefined;
  const text = typeof body === 'string' ? body : decoder.decode(body);
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function requestHeaders(init: CallInit): CoreHeaders {
  const headers: CoreHeaders = {};
  for (const [name, value] of Object.entries(init.headers ?? {})) headers[name.toLowerCase()] = value;
  if (init.locale !== null) headers['accept-language'] ??= init.locale ?? 'en';
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  return headers;
}

export interface CoreRig {
  core: DiaryCore;
  storage: MemoryStorage;
  events: CoreEvent[];
  logs: string[];
  /** Calls the core like the host does (one CoreRequest -> one CoreResponse). */
  call: Client;
  /** The raw protocol call. */
  send(request: Omit<CoreRequest, 'type' | 'id'>): Promise<CoreResponse>;
  /** Files in the storage (path -> bytes). */
  files(): Promise<Map<string, Uint8Array>>;
  shutdown(): Promise<void>;
}

export interface CoreRigOptions extends Partial<Omit<CoreBootOptions, 'storage' | 'assets'>> {
  /** Reuse a storage (a "restart" of the app). Default: a fresh MemoryStorage. */
  storage?: MemoryStorage | StorageBackend | null;
}

/** Everything a MemoryStorage holds (test helper of the storage layer, re-done here to stay independent). */
export async function storageFiles(storage: StorageBackend, dir = ''): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  for (const entry of await storage.list(dir)) {
    const full = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.type === 'directory') for (const [p, b] of await storageFiles(storage, full)) out.set(p, b);
    else out.set(full, await storage.read(full));
  }
  return out;
}

/**
 * A new MemoryStorage holding `files` (path -> bytes): the storage as a snapshot caught it -
 * `storage.files()` is synchronous, so it is the storage at exactly that moment (what a phone
 * that kills the app right then would find at the next start).
 */
export async function memoryStorageOf(files: Map<string, Uint8Array>): Promise<MemoryStorage> {
  const storage = new MemoryStorage();
  for (const [file, bytes] of files) {
    const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
    if (dir) await storage.mkdir(dir);
    await storage.write(file, bytes);
  }
  return storage;
}

export async function bootTestCore(options: CoreRigOptions = {}): Promise<CoreRig> {
  const storage = options.storage === undefined ? new MemoryStorage() : options.storage;
  const events: CoreEvent[] = [];
  const logs: string[] = [];
  const core = await bootCore({
    storage: storage ?? null,
    assets: testAssets(),
    log: (level, message) => logs.push(`${level}: ${message}`),
    onEvent: (event) => events.push(event),
    auth: { kdf: FAST_KDF, ...options.auth },
    ...(options.now ? { now: options.now } : {}),
    ...(options.mailTransport ? { mailTransport: options.mailTransport } : {}),
    ...(options.passwordReset ? { passwordReset: options.passwordReset } : {}),
    ...(options.storageRetryMs !== undefined ? { storageRetryMs: options.storageRetryMs } : {}),
  });
  let nextId = 1;
  const send = async (request: Omit<CoreRequest, 'type' | 'id'>): Promise<CoreResponse> => {
    // Like the worker: the answer first, then the events that belong to it.
    const answer = await core.handle({ type: 'request', id: nextId++, ...request });
    events.push(...answer.events);
    return answer.response;
  };
  const call: Client = async (url, init = {}) => {
    const headers = requestHeaders(init);
    const request: Omit<CoreRequest, 'type' | 'id'> = { method: (init.method ?? 'GET').toUpperCase(), url, headers };
    if (init.body !== undefined) {
      if (typeof init.body === 'string') request.bodyText = init.body;
      else if (init.body instanceof Uint8Array) request.bodyBytes = exactBuffer(init.body);
      else {
        headers['content-type'] ??= 'application/json';
        request.bodyText = JSON.stringify(init.body);
      }
    }
    const response = await send(request);
    const contentType = response.headers['content-type'] ?? '';
    let body: string | Uint8Array | null = response.bodyBytes !== undefined ? new Uint8Array(response.bodyBytes) : (response.bodyText ?? null);
    // Like the HTTP client below: a text or JSON answer is text, whatever the server sent it as.
    if (body instanceof Uint8Array && (contentType.startsWith('text/') || contentType.includes('json'))) body = decoder.decode(body);
    return { status: response.status, headers: response.headers, body, json: parseJson(body, contentType) };
  };
  return {
    core,
    storage: storage as MemoryStorage,
    events,
    logs,
    call,
    send,
    files: () => storageFiles(storage as StorageBackend),
    shutdown: () => core.shutdown(),
  };
}

/** A `Client` over HTTP (the desktop server started from source, see desktop-server.ts). */
export function httpClient(baseUrl: string): Client {
  return async (url, init = {}) => {
    const headers = requestHeaders(init);
    let body: string | Uint8Array | undefined;
    if (init.body !== undefined) {
      if (typeof init.body === 'string' || init.body instanceof Uint8Array) body = init.body;
      else {
        headers['content-type'] ??= 'application/json';
        body = JSON.stringify(init.body);
      }
    }
    // Node's fetch adds `Accept-Language: *` when the header is missing; the server treats an empty
    // header like a missing one (middleware/locale.ts), which is what the core receives in that case.
    headers['accept-language'] ??= '';
    const response = await fetch(`${baseUrl}${url}`, { method: (init.method ?? 'GET').toUpperCase(), headers, body: body as BodyInit | undefined });
    const outHeaders: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      outHeaders[name.toLowerCase()] = value;
    });
    const contentType = outHeaders['content-type'] ?? '';
    let answer: string | Uint8Array | null;
    if (response.status === 204 || response.status === 304) answer = null;
    else if (contentType.startsWith('text/') || contentType.includes('json')) answer = await response.text();
    else answer = new Uint8Array(await response.arrayBuffer());
    return { status: response.status, headers: outHeaders, body: answer, json: parseJson(answer, contentType) };
  };
}
