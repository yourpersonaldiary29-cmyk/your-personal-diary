/**
 * The contract rig of the mobile core (mobile/test/core/contract-*.test.ts): the same scenario
 * runs against the core booted in-process (mobile/core/boot.ts on a MemoryStorage, see
 * ./helpers.ts) and against the desktop server started from source on a temporary data
 * directory (server/src/server.ts under Node, loaded by the module runner of
 * ../compat/native-server.ts, listening on an ephemeral loopback port - never 47321), and the
 * answers of both are compared: status, the headers that matter, and the JSON body with ids,
 * timestamps and tokens masked (they differ by construction, their presence and type do not).
 *
 * Both sides use the same cheap scrypt parameters (FAST_KDF); the formats do not depend on them.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'vitest';
import type { AuthResponse, UserProfile } from '@shared/types';
import { openNativeServer, type NativeServer } from '../compat/native-server';
import { bootTestCore, FAST_KDF, httpClient, type Answer, type CallInit, type Client, type CoreRig, type CoreRigOptions } from './helpers';

type ServerModule = typeof import('../../../server/src/server');
type ConfigModule = typeof import('../../../server/src/config');

export const PASSWORD = 'Passw0rd!';
export const NEW_PASSWORD = 'N3w-Passw0rd!';

// ---------------------------------------------------------------------------
// The desktop server from source
// ---------------------------------------------------------------------------

export interface DesktopRig {
  readonly call: Client;
  readonly dataDir: string;
  readonly port: number;
  /** Stops the server and starts a new one on the same data directory (the desktop app restarted). */
  restart(): Promise<void>;
  stop(): Promise<void>;
  /** Files below the data directory (relative posix paths -> bytes). */
  files(): Map<string, Uint8Array>;
}

let native: NativeServer | null = null;
let serverModule: ServerModule | null = null;
let configModule: ConfigModule | null = null;

async function nativeModules(): Promise<{ server: ServerModule; config: ConfigModule }> {
  if (!native) native = await openNativeServer();
  serverModule ??= await native.load<ServerModule>('server');
  configModule ??= await native.load<ConfigModule>('config');
  return { server: serverModule, config: configModule };
}

/** Closes the module runner of the desktop server (afterAll of a contract file). */
export async function closeNative(): Promise<void> {
  const current = native;
  native = null;
  serverModule = null;
  configModule = null;
  await current?.close();
}

function listFiles(root: string, dir = ''): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const relative = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) for (const [p, b] of listFiles(root, relative)) out.set(p, b);
    else out.set(relative, new Uint8Array(fs.readFileSync(path.join(root, relative))));
  }
  return out;
}

export async function startDesktop(): Promise<DesktopRig> {
  const { server, config } = await nativeModules();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpd-contract-'));
  const start = () => server.startServer(config.loadConfig(['--data-dir', dataDir, '--port', '0'], {}), { port: 0, quiet: true, auth: { kdf: FAST_KDF } });
  let running = await start();
  let client = httpClient(`http://127.0.0.1:${running.port}`);
  let stopped = false;
  return {
    call: (url, init) => client(url, init),
    dataDir,
    get port() {
      return running.port;
    },
    async restart() {
      await running.stop();
      running = await start();
      client = httpClient(`http://127.0.0.1:${running.port}`);
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      await running.stop();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
    files: () => listFiles(dataDir),
  };
}

// ---------------------------------------------------------------------------
// Comparing answers
// ---------------------------------------------------------------------------

/** Keys whose values differ by construction (random ids, clocks, tokens): masked to their type. */
export const VOLATILE_KEYS: readonly string[] = [
  'id',
  'token',
  'createdAt',
  'updatedAt',
  'lastSeenAt',
  'expiresAt',
  'lastLoginAt',
  'restoredAt',
  'startedAt',
  'generatedAt',
  'exportedAt',
  'at',
  'habitId',
  'entryId',
  'sessionId',
  'dataDir',
  'dbPath',
  'dbSizeBytes',
];

function typeTag(value: unknown): string {
  if (value === null) return '<null>';
  if (Array.isArray(value)) return '<array>';
  return `<${typeof value}>`;
}

/** The JSON value with the volatile keys masked (recursively). */
export function normalize(value: unknown, volatile: readonly string[] = VOLATILE_KEYS): unknown {
  if (Array.isArray(value)) return value.map((item) => normalize(item, volatile));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = volatile.includes(key) ? typeTag(item) : normalize(item, volatile);
    }
    return out;
  }
  return value;
}

/** Headers compared on every answer (the desktop adds date, etag, connection... which the core has no reason to). */
const COMPARED_HEADERS = ['content-type', 'x-content-type-options', 'referrer-policy', 'x-frame-options'];

export interface CompareOptions {
  /** More headers to compare (e.g. 'content-disposition'). */
  headers?: string[];
  /** More keys to mask. */
  volatile?: string[];
  /**
   * How to compare the body. Default: 'json' when both answers are JSON, else 'text' for text,
   * 'bytes' for bytes, 'none' when there is none; 'skip' compares status and headers only.
   */
  body?: 'json' | 'text' | 'bytes' | 'none' | 'skip';
}

function bodyKind(answer: Answer): 'json' | 'text' | 'bytes' | 'none' {
  if (answer.body === null) return 'none';
  if (answer.json !== undefined) return 'json';
  return typeof answer.body === 'string' ? 'text' : 'bytes';
}

function describeAnswer(answer: Answer): string {
  const body = answer.json !== undefined ? JSON.stringify(answer.json) : answer.body === null ? '' : typeof answer.body === 'string' ? answer.body : `<${answer.body.byteLength} bytes>`;
  return `${answer.status} ${answer.headers['content-type'] ?? ''} ${body.slice(0, 400)}`;
}

/** Asserts that the core answered like the desktop. */
export function expectSame(label: string, core: Answer, desktop: Answer, options: CompareOptions = {}): void {
  const context = `${label}\n  core:    ${describeAnswer(core)}\n  desktop: ${describeAnswer(desktop)}`;
  expect(core.status, context).toBe(desktop.status);
  for (const name of [...COMPARED_HEADERS, ...(options.headers ?? [])]) {
    expect(core.headers[name], `${context}\n  header ${name}`).toBe(desktop.headers[name]);
  }
  const mode = options.body ?? (bodyKind(desktop) === 'json' && bodyKind(core) === 'json' ? 'json' : bodyKind(desktop) === 'text' ? 'text' : bodyKind(desktop) === 'none' ? 'none' : 'bytes');
  const volatile = [...VOLATILE_KEYS, ...(options.volatile ?? [])];
  if (mode === 'json') {
    expect(core.json, context).toBeDefined();
    expect(normalize(core.json, volatile), context).toEqual(normalize(desktop.json, volatile));
  } else if (mode === 'text') {
    expect(core.body, context).toEqual(desktop.body);
  } else if (mode === 'bytes') {
    expect(core.body, context).toBeInstanceOf(Uint8Array);
    expect(desktop.body, context).toBeInstanceOf(Uint8Array);
    // Compare bytes, not Buffer / Uint8Array instances (different realms under vitest).
    expect([...(core.body as Uint8Array)], context).toEqual([...(desktop.body as Uint8Array)]);
  } else if (mode === 'none') {
    expect(core.body, context).toBeNull();
    expect(desktop.body, context).toBeNull();
  }
}

// ---------------------------------------------------------------------------
// The two sides
// ---------------------------------------------------------------------------

export interface Side {
  readonly name: 'core' | 'desktop';
  readonly call: Client;
  /** The current session token ('' before sign-in). */
  token: string;
  user: UserProfile | null;
}

export interface Pair {
  core: Side;
  desktop: Side;
}

export interface ContractRig extends Pair {
  coreRig: CoreRig;
  desktopRig: DesktopRig;
  /**
   * Runs the same request on both sides (the URL and the `init` may depend on the side: its ids,
   * its token) and asserts that the answers agree. Resolves with both answers.
   */
  both(url: Url, init?: Init, options?: CompareOptions): Promise<{ core: Answer; desktop: Answer }>;
  /** `both()` with the current token of each side. */
  authed(url: Url, init?: Init, options?: CompareOptions): Promise<{ core: Answer; desktop: Answer }>;
  /** Boots a new core on the same storage (an app restart) and swaps it in. */
  restartCore(): Promise<void>;
  /** Stops both sides. */
  close(): Promise<void>;
}

export type Url = string | ((side: Side) => string);
export type Init = CallInit | ((side: Side) => CallInit);

export interface ContractRigOptions {
  core?: CoreRigOptions;
}

export async function startContract(options: ContractRigOptions = {}): Promise<ContractRig> {
  let coreRig = await bootTestCore(options.core);
  const desktopRig = await startDesktop();
  const core: Side = { name: 'core', call: (url, init) => coreRig.call(url, init), token: '', user: null };
  const desktop: Side = { name: 'desktop', call: desktopRig.call, token: '', user: null };

  async function both(url: Url, init: Init = {}, options: CompareOptions = {}) {
    const of = (side: Side): CallInit => (typeof init === 'function' ? init(side) : { ...init });
    const at = (side: Side): string => (typeof url === 'function' ? url(side) : url);
    const [a, b] = await Promise.all([core.call(at(core), of(core)), desktop.call(at(desktop), of(desktop))]);
    const method = (of(core).method ?? 'GET').toUpperCase();
    expectSame(`${method} ${at(core)}`, a, b, options);
    return { core: a, desktop: b };
  }

  return {
    core,
    desktop,
    get coreRig() {
      return coreRig;
    },
    desktopRig,
    both,
    authed: (url, init = {}, options) => both(url, (side) => ({ token: side.token, ...(typeof init === 'function' ? init(side) : init) }), options),
    async restartCore() {
      const storage = coreRig.storage;
      await coreRig.shutdown();
      coreRig = await bootTestCore({ ...options.core, storage });
    },
    async close() {
      await coreRig.shutdown().catch(() => undefined);
      await desktopRig.stop().catch(() => undefined);
    },
  };
}

// ---------------------------------------------------------------------------
// Scenario helpers
// ---------------------------------------------------------------------------

export interface Person {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
}

export const DANA: Person = { firstName: 'דנה', lastName: 'כהן', username: 'dana', email: 'dana@example.test' };
export const YOSSI: Person = { firstName: 'יוסי', lastName: 'לוי', username: 'yossi', email: 'yossi@example.test' };

export function registration(person: Person, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...person, password: PASSWORD, confirmPassword: PASSWORD, rememberMe: true, deviceName: 'Test device', ...extra };
}

/** Registers `person` on both sides (status 201 asserted) and signs both sides in with the new token. */
export async function registerBoth(rig: ContractRig, person: Person, locale = 'he', extra: Record<string, unknown> = {}): Promise<{ core: AuthResponse; desktop: AuthResponse }> {
  const { core, desktop } = await rig.both('/api/auth/register', { method: 'POST', locale, body: registration(person, extra) });
  expect(core.status, JSON.stringify(core.json)).toBe(201);
  const coreAuth = core.json as AuthResponse;
  const desktopAuth = desktop.json as AuthResponse;
  rig.core.token = coreAuth.token;
  rig.core.user = coreAuth.user;
  rig.desktop.token = desktopAuth.token;
  rig.desktop.user = desktopAuth.user;
  return { core: coreAuth, desktop: desktopAuth };
}

/** Signs both sides in (status 200 asserted) and adopts the tokens. */
export async function loginBoth(rig: ContractRig, username: string, password = PASSWORD, extra: Record<string, unknown> = {}): Promise<{ core: AuthResponse; desktop: AuthResponse }> {
  const { core, desktop } = await rig.both('/api/auth/login', { method: 'POST', body: { username, password, deviceName: 'Test device', ...extra } });
  expect(core.status, JSON.stringify(core.json)).toBe(200);
  const coreAuth = core.json as AuthResponse;
  const desktopAuth = desktop.json as AuthResponse;
  rig.core.token = coreAuth.token;
  rig.core.user = coreAuth.user;
  rig.desktop.token = desktopAuth.token;
  rig.desktop.user = desktopAuth.user;
  return { core: coreAuth, desktop: desktopAuth };
}

/** A fictional entry input; `n` varies the content. */
export function entryInput(n: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const day = String(1 + (n % 27)).padStart(2, '0');
  return {
    date: `2026-09-${day}`,
    time: `${String(8 + (n % 12)).padStart(2, '0')}:${String((n * 7) % 60).padStart(2, '0')}`,
    title: ['יום רגוע', 'A quiet day', 'يوم هادئ'][n % 3] + ` #${n}`,
    body: ['כתבתי היום ביומן. נתוני בדיקה בדויים בלבד.', 'Fictional test data. A walk in the park and a book.', 'بيانات اختبار خيالية فقط. مشيت في الحديقة.'][n % 3],
    mood: 1 + (n % 5),
    emotions: n % 2 ? ['calm', 'grateful'] : ['tired'],
    energy: 1 + ((n + 1) % 5),
    stress: 1 + ((n + 2) % 5),
    sleepQuality: 1 + ((n + 3) % 5),
    sleepHours: 6 + (n % 4) * 0.5,
    exerciseMinutes: n % 3 === 0 ? 30 : n % 3 === 1 ? 0 : null,
    exerciseType: n % 3 === 0 ? 'הליכה' : '',
    events: n % 2 ? ['ארוחת ערב'] : [],
    people: n % 2 ? ['דמות בדויה'] : ['Someone'],
    location: n % 2 ? 'בית' : 'Park',
    notes: 'é vs é, ｆｕｌｌ width, ‏RTL mark',
    tags: ['test', n % 2 ? 'בדיקה' : 'english'],
    ...overrides,
  };
}

export function habitInput(name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { name, description: 'Fictional habit', target: 1, unit: 'times', frequency: 'daily', reminderTime: null, reminderEnabled: false, ...overrides };
}

/** Base64 of bytes (what the backup routes accept in `fileBase64`). */
export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
}

/** The bytes of a body that may have arrived as text (desktop) or bytes (core). */
export function bodyBytes(answer: Answer): Uint8Array {
  if (answer.body === null) return new Uint8Array();
  return typeof answer.body === 'string' ? new TextEncoder().encode(answer.body) : answer.body;
}

/** True when `haystack` contains the ASCII `needle`. */
export function containsAscii(haystack: Uint8Array, needle: string): boolean {
  const n = needle.length;
  outer: for (let i = 0; i + n <= haystack.length; i++) {
    for (let j = 0; j < n; j++) if (haystack[i + j] !== needle.charCodeAt(j)) continue outer;
    return true;
  }
  return false;
}
