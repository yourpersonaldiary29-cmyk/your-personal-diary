/**
 * An in-memory diary server for the engine's tests (section 8, WP-H10b: "an in-memory server built
 * on `shared/sync.ts` `decide`"). It answers through an `ApiTransport` (src/api/client.ts), so the
 * engine under test uses the real client, the real URLs and the real error handling.
 *
 * What it mirrors from the hosted server, deliberately the same way (server/src/sync/apply.ts):
 *  - `GET /api/sync/key` (the key is created once; the epoch changes on `restore()`),
 *  - `POST /api/sync/op` with every outcome of the contract: permanent cid rows, content compare-and-
 *    set, time rows for habits / logs / settings, versions that only move forward, field-scoped
 *    archive, per-key settings;
 *  - the account check (409), the guest refusal (403), the lock (423), the quota (507 for growing
 *    kinds, deletes pass), a simple validation (400 with `field`) and the size limit (413);
 *  - the ordinary read routes the facade caches (entries, day, habits, progress, settings, home,
 *    calendar, tags / people / locations) and the ordinary write routes (so the pass-through of a
 *    disabled facade can be compared with today's requests).
 *
 * Failure injection (section 9 "a switchable transport"): `mode` 'online' | 'down' (rejects with a
 * TypeError) | 'blackhole' (never settles until aborted) | 'drop-response' (applies, then throws);
 * `failNext(...)` queues canned answers (429 with Retry-After, 503 notSaved, 500...). Every request
 * is recorded in `requests`.
 *
 * Test data only: nothing here touches a file or the network.
 */
import {
  clampEditedAt,
  decide,
  nextVersion,
  settingsOutcome,
  SYNC_MAX_OP_BYTES,
  type HabitFields,
  type LogFields,
  type SyncKeyOutcome,
  type SyncKeyResponse,
  type SyncOp,
  type SyncOpResult,
  type SyncRef,
} from '@shared/sync';
import type {
  AppSettings,
  CalendarDay,
  DaySummary,
  Entry,
  EntryFilter,
  EntryInput,
  Habit,
  HabitInput,
  HabitLog,
  HabitWithProgress,
  HomeSummary,
  ServerInfo,
  TagCount,
  UserProfile,
} from '@shared/types';
import type { ApiTransport } from '@/api/client';
import { DEFAULT_APP_SETTINGS } from '@/constants/settings';
import { addDaysIso, entryToSummary, isLogCompleted, mean2, weekStartIso } from '../overlay/effects';
import { matchesFilter } from '../overlay/entries';

export type FakeMode = 'online' | 'down' | 'blackhole' | 'drop-response';

export interface CannedAnswer {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** Only for requests whose path starts with this (default: every request). */
  pathPrefix?: string;
}

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
  token: string | null;
  /** Device epoch ms when the request arrived. */
  at: number;
}

export interface FakeAccount {
  userId: string;
  token: string;
  user: UserProfile;
  guest?: boolean;
  rememberMe?: boolean;
}

interface Diary {
  entries: Map<number, Entry>;
  habits: Map<number, Habit>;
  logs: Map<string, HabitLog>;
  settings: AppSettings;
  meta: Map<string, string>;
  nextEntryId: number;
  nextHabitId: number;
  nextLogId: number;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function entryInputOf(e: EntryInput | Entry): EntryInput {
  return {
    date: e.date,
    time: e.time,
    title: e.title,
    body: e.body,
    mood: e.mood,
    emotions: e.emotions,
    energy: e.energy,
    stress: e.stress,
    sleepQuality: e.sleepQuality,
    sleepHours: e.sleepHours,
    exerciseMinutes: e.exerciseMinutes,
    exerciseType: e.exerciseType,
    events: e.events,
    people: e.people,
    location: e.location,
    notes: e.notes,
    tags: e.tags,
  };
}

function habitFieldsOf(h: HabitFields | Habit): HabitFields {
  return { name: h.name, description: h.description, target: h.target, unit: h.unit, frequency: h.frequency, reminderTime: h.reminderTime ?? null, reminderEnabled: h.reminderEnabled };
}

function sameLog(a: LogFields | null, b: LogFields | null): boolean {
  if (a === null || b === null) return a === b;
  return a.value === b.value && (a.note ?? '') === (b.note ?? '');
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ValidationFailure extends Error {
  constructor(
    readonly field: string,
    message = `invalid ${field}`,
  ) {
    super(message);
  }
}

/** A deliberately small validation: enough for the tests' 400 cases (a title over 200 characters, a bad date). */
export function validateEntry(payload: unknown): EntryInput {
  const p = payload as Partial<EntryInput> | undefined;
  if (!p || typeof p !== 'object') throw new ValidationFailure('body');
  if (typeof p.date !== 'string' || !ISO_DATE.test(p.date)) throw new ValidationFailure('date');
  if (typeof p.title !== 'string' || p.title.length > 200) throw new ValidationFailure('title');
  if (typeof p.body !== 'string') throw new ValidationFailure('body');
  return {
    date: p.date,
    time: typeof p.time === 'string' ? p.time : '12:00',
    title: p.title,
    body: p.body,
    mood: p.mood ?? null,
    emotions: Array.isArray(p.emotions) ? p.emotions : [],
    energy: p.energy ?? null,
    stress: p.stress ?? null,
    sleepQuality: p.sleepQuality ?? null,
    sleepHours: p.sleepHours ?? null,
    exerciseMinutes: p.exerciseMinutes ?? null,
    exerciseType: p.exerciseType ?? '',
    events: Array.isArray(p.events) ? p.events : [],
    people: Array.isArray(p.people) ? p.people : [],
    location: p.location ?? '',
    notes: p.notes ?? '',
    tags: Array.isArray(p.tags) ? p.tags.map((t) => String(t).trim().replace(/^#+/, '').trim()).filter(Boolean) : [],
  };
}

export function validateHabit(payload: unknown): HabitInput {
  const p = payload as Partial<HabitInput> | undefined;
  if (!p || typeof p !== 'object') throw new ValidationFailure('body');
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 100) throw new ValidationFailure('name');
  const target = typeof p.target === 'number' && p.target > 0 ? p.target : 1;
  return {
    name: p.name.trim(),
    description: p.description ?? '',
    target,
    unit: p.unit ?? '',
    frequency: p.frequency === 'weekly' ? 'weekly' : 'daily',
    reminderTime: p.reminderTime ?? null,
    reminderEnabled: !!p.reminderEnabled,
  };
}

function validateLog(v: unknown): LogFields {
  const p = v as Partial<LogFields> | undefined;
  if (!p || typeof p !== 'object' || typeof p.value !== 'number' || !Number.isFinite(p.value) || p.value < 0) throw new ValidationFailure('value');
  return { value: p.value, note: typeof p.note === 'string' ? p.note : '' };
}

const THEMES = new Set(['system', 'light', 'dark', 'high-contrast']);

function validateSettings(v: unknown): Partial<AppSettings> {
  const p = v as Partial<AppSettings> | undefined;
  if (!p || typeof p !== 'object') throw new ValidationFailure('body');
  const out: Partial<AppSettings> = {};
  for (const key of Object.keys(DEFAULT_APP_SETTINGS) as (keyof AppSettings)[]) {
    if (!(key in p) || p[key] === undefined) continue;
    if (key === 'theme' && !THEMES.has(String(p.theme))) throw new ValidationFailure('theme');
    (out as Record<string, unknown>)[key] = p[key];
  }
  return out;
}

function makeResponse(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  if (body !== undefined && typeof body !== 'string' && !h.has('content-type')) h.set('content-type', 'application/json');
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => h.get(name.toLowerCase()) ?? null },
    text: async () => text,
    json: async () => JSON.parse(text),
    blob: async () => new Blob([text]),
  } as unknown as Response;
}

function abortError(): Error {
  return new DOMException('The operation was aborted.', 'AbortError');
}

/**
 * The hosted server's self-description for the tests. `publicUrl` is a loopback placeholder: this
 * helper is not a *.test.ts file, so scripts/check-no-network.mjs scans it and refuses any URL
 * literal that is not loopback (the engine never reads the address; the snapshot only carries it).
 */
export function fakeServerInfo(overrides: Partial<ServerInfo> = {}): ServerInfo {
  return {
    version: '0.1.0',
    port: 8080,
    lanEnabled: false,
    lanUrls: [],
    dataDir: '',
    isLocalRequest: false,
    startedAt: '2026-10-20T08:00:00.000Z',
    mode: 'hosted',
    publicUrl: 'http://127.0.0.1:8080',
    storageOk: true,
    registration: 'open',
    guestTour: true,
    offlineSync: 1,
    ...overrides,
  };
}

export function fakeUser(userId: string, username = 'dana'): UserProfile {
  return { id: userId, username, firstName: 'Dana', lastName: 'Levi', email: `${username}@example.com`, createdAt: '2026-01-01T00:00:00.000Z' };
}

export interface FakeServerOptions {
  /** The server clock (device epoch ms by default). */
  now?: () => number;
  /** Simulated latency per request in ms (fake timers advance it). */
  latencyMs?: number;
}

export class FakeSyncServer {
  mode: FakeMode = 'online';
  /** Locked sessions by token. */
  readonly lockedTokens = new Set<string>();
  /** When true, growing operations answer 507. */
  quotaFull = false;
  /** When false, `/api/sync/*` answers 404 (a rolled-back server). */
  syncMounted = true;
  /** `ServerInfo.offlineSync` present. */
  offlineSyncFlag = true;
  /** Simulated latency per request in ms (real timers). */
  latencyMs: number;
  /** The next n `POST /api/sync/op` are applied, then their answer is lost (a TypeError). */
  dropOpResponses = 0;
  /** The next n `POST /api/sync/op` are applied, then hang until the request is aborted (a timeout). */
  hangOpResponses = 0;
  /** The next n `POST /api/sync/op` fail with a network error BEFORE reaching the server (the CORS trap). */
  opNetworkErrors = 0;
  readonly requests: RecordedRequest[] = [];
  /** How often each operation id was applied (exactly-once checks). */
  readonly applied = new Map<string, number>();

  private readonly accounts = new Map<string, FakeAccount>();
  private readonly diaries = new Map<string, Diary>();
  private readonly canned: CannedAnswer[] = [];
  private readonly nowFn: () => number;

  constructor(opts: FakeServerOptions = {}) {
    this.nowFn = opts.now ?? (() => Date.now());
    this.latencyMs = opts.latencyMs ?? 0;
  }

  // -------------------------------------------------------------------------
  // Accounts and data
  // -------------------------------------------------------------------------

  addAccount(account: FakeAccount): this {
    this.accounts.set(account.token, account);
    if (!this.diaries.has(account.userId)) {
      this.diaries.set(account.userId, {
        entries: new Map(),
        habits: new Map(),
        logs: new Map(),
        settings: { ...DEFAULT_APP_SETTINGS },
        meta: new Map(),
        nextEntryId: 1,
        nextHabitId: 1,
        nextLogId: 1,
      });
    }
    return this;
  }

  /** Signs an account out everywhere (a password change, a revocation): its token answers 401. */
  revoke(token: string): void {
    this.accounts.delete(token);
  }

  /** A new token for an existing account (sign in again). */
  issueToken(userId: string, token: string, rememberMe = false): void {
    const existing = [...this.accounts.values()].find((a) => a.userId === userId);
    this.accounts.set(token, { userId, token, user: existing?.user ?? fakeUser(userId), rememberMe });
  }

  /** The diary of an account (created empty on first use, so tests may seed before the account signs in). */
  diary(userId: string): Diary {
    let d = this.diaries.get(userId);
    if (!d) {
      d = { entries: new Map(), habits: new Map(), logs: new Map(), settings: { ...DEFAULT_APP_SETTINGS }, meta: new Map(), nextEntryId: 1, nextHabitId: 1, nextLogId: 1 };
      this.diaries.set(userId, d);
    }
    return d;
  }

  nowIso(): string {
    return new Date(this.nowFn()).toISOString();
  }

  /** Seeds an entry directly (another device wrote it). */
  seedEntry(userId: string, input: Partial<EntryInput>, at: string = this.nowIso()): Entry {
    const d = this.diary(userId);
    const payload = validateEntry({ date: '2026-10-20', time: '08:00', title: 'Morning walk', body: 'A walk in the park.', ...input });
    const entry: Entry = { ...payload, id: d.nextEntryId++, createdAt: at, updatedAt: at };
    d.entries.set(entry.id, entry);
    return entry;
  }

  seedHabit(userId: string, input: Partial<HabitInput>, at: string = this.nowIso()): Habit {
    const d = this.diary(userId);
    const payload = validateHabit({ name: 'Water', target: 8, unit: 'glasses', frequency: 'daily', ...input });
    const habit: Habit = { ...payload, id: d.nextHabitId++, isArchived: false, sortOrder: d.habits.size, createdAt: at };
    d.habits.set(habit.id, habit);
    return habit;
  }

  seedLog(userId: string, habitId: number, date: string, value: number, note = ''): HabitLog {
    return this.writeLog(this.diary(userId), habitId, date, { value, note });
  }

  /** Another device edited an entry at `at` (server time). */
  editEntry(userId: string, id: number, patch: Partial<EntryInput>, at: string = this.nowIso()): Entry {
    const d = this.diary(userId);
    const cur = d.entries.get(id);
    if (!cur) throw new Error('fake server: no such entry');
    const next: Entry = { ...cur, ...patch, updatedAt: at };
    d.entries.set(id, next);
    return next;
  }

  deleteEntry(userId: string, id: number): void {
    this.diary(userId).entries.delete(id);
  }

  /** A habit edited through the ordinary route at `at`: the time row is written too (an older app leaves none). */
  editHabit(userId: string, id: number, patch: Partial<HabitInput>, at: string | null = this.nowIso()): Habit {
    const d = this.diary(userId);
    const cur = d.habits.get(id);
    if (!cur) throw new Error('fake server: no such habit');
    const next: Habit = { ...cur, ...patch };
    d.habits.set(id, next);
    if (at) d.meta.set(`sync:t:habit:${id}`, at);
    return next;
  }

  setSetting<K extends keyof AppSettings>(userId: string, key: K, value: AppSettings[K], at: string | null = this.nowIso()): void {
    const d = this.diary(userId);
    d.settings = { ...d.settings, [key]: value };
    if (at) d.meta.set(`sync:t:set:${key}`, at);
  }

  logAt(userId: string, habitId: number, date: string, value: number, at: string | null = this.nowIso()): HabitLog {
    const log = this.writeLog(this.diary(userId), habitId, date, { value, note: '' });
    if (at) this.diary(userId).meta.set(`sync:t:log:${habitId}:${date}`, at);
    return log;
  }

  /** A restore: the key is kept, the epoch changes (section 3.7). Optionally the data is replaced. */
  restore(userId: string, snapshot?: { entries?: Entry[]; habits?: Habit[] }): string {
    const d = this.diary(userId);
    const epoch = this.newEpoch();
    d.meta.set('sync:epoch', epoch);
    if (snapshot?.entries) d.entries = new Map(snapshot.entries.map((e) => [e.id, { ...e }]));
    if (snapshot?.habits) d.habits = new Map(snapshot.habits.map((h) => [h.id, { ...h }]));
    return epoch;
  }

  epochOf(userId: string): string {
    return this.ensureSyncState(this.diary(userId)).epoch;
  }

  keyOf(userId: string): string {
    return this.ensureSyncState(this.diary(userId)).key;
  }

  // -------------------------------------------------------------------------
  // Failure injection
  // -------------------------------------------------------------------------

  /** Queues canned answers (served in order, before the real handler). */
  failNext(...answers: CannedAnswer[]): void {
    this.canned.push(...answers);
  }

  /** Requests of one path prefix and method, newest last. */
  calls(pathPrefix: string, method?: string): RecordedRequest[] {
    return this.requests.filter((r) => r.path.startsWith(pathPrefix) && (!method || r.method === method));
  }

  // -------------------------------------------------------------------------
  // Transport
  // -------------------------------------------------------------------------

  /** The `ApiTransport` for `setApiTransport`; `base` is stripped from the URLs. */
  transport(base = ''): ApiTransport {
    return (url, init) => this.fetch(url.startsWith(base) ? url.slice(base.length) : url, init);
  }

  private async fetch(path: string, init: RequestInit): Promise<Response> {
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = (init.headers ?? {}) as Record<string, string>;
    const auth = headers.Authorization ?? headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    let body: unknown = undefined;
    if (typeof init.body === 'string' && init.body) {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    this.requests.push({ method, path, body, token, at: Date.now() });
    const signal = init.signal ?? undefined;
    if (signal?.aborted) throw abortError();
    if (this.mode === 'down') throw new TypeError('Failed to fetch');
    if (this.mode === 'blackhole') {
      return new Promise<Response>((_, reject) => {
        if (!signal) return;
        signal.addEventListener('abort', () => reject(abortError()), { once: true });
      });
    }
    if (this.latencyMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, this.latencyMs);
        signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(t);
            reject(abortError());
          },
          { once: true },
        );
      });
    }
    const isOp = method === 'POST' && path === '/api/sync/op';
    if (isOp && this.opNetworkErrors > 0) {
      this.opNetworkErrors--;
      throw new TypeError('Failed to fetch');
    }
    const res = this.handle(method, path, body, token, typeof init.body === 'string' ? init.body.length : 0);
    if (this.mode === 'drop-response') throw new TypeError('Failed to fetch');
    if (isOp && this.dropOpResponses > 0) {
      this.dropOpResponses--;
      throw new TypeError('Failed to fetch');
    }
    if (isOp && this.hangOpResponses > 0) {
      this.hangOpResponses--;
      return new Promise<Response>((_, reject) => {
        if (!signal) return;
        signal.addEventListener('abort', () => reject(abortError()), { once: true });
      });
    }
    return res;
  }

  // -------------------------------------------------------------------------
  // Routing
  // -------------------------------------------------------------------------

  private error(status: number, code: string, message: string, field?: string, headers?: Record<string, string>): Response {
    return makeResponse(status, { code, message, ...(field ? { field } : {}) }, headers);
  }

  handle(method: string, url: string, body: unknown, token: string | null, bodyBytes = 0): Response {
    const q = url.indexOf('?');
    const path = q < 0 ? url : url.slice(0, q);
    const params = new URLSearchParams(q < 0 ? '' : url.slice(q + 1));

    const cannedIndex = this.canned.findIndex((c) => !c.pathPrefix || path.startsWith(c.pathPrefix));
    if (cannedIndex >= 0) {
      const [c] = this.canned.splice(cannedIndex, 1);
      return makeResponse(c.status, c.body ?? (c.status >= 400 ? { code: 'OTHER', message: `canned ${c.status}` } : undefined), c.headers);
    }

    if (path === '/api/health') return makeResponse(200, { ok: true, version: '0.1.0', mode: 'hosted' });
    if (path === '/api/server/info') return makeResponse(200, fakeServerInfo(this.offlineSyncFlag ? {} : { offlineSync: undefined }));

    const account = token ? this.accounts.get(token) : undefined;
    if (!account) return this.error(401, 'UNAUTHORIZED', 'Please sign in again.');
    const d = this.diary(account.userId);

    if (path === '/api/auth/me') {
      return makeResponse(200, {
        user: account.user,
        session: { id: 's1', deviceName: 'test', createdAt: '2026-10-20T08:00:00.000Z', lastSeenAt: this.nowIso(), rememberMe: !!account.rememberMe, current: true, locked: this.lockedTokens.has(token!) },
      });
    }
    if (path === '/api/auth/verify-password' && method === 'POST') {
      this.lockedTokens.delete(token!);
      return makeResponse(200, { ok: true });
    }
    if (path === '/api/auth/lock' && method === 'POST') {
      this.lockedTokens.add(token!);
      return makeResponse(204);
    }
    if (this.lockedTokens.has(token!)) return this.error(423, 'LOCKED', 'The session is locked.');

    if (path.startsWith('/api/sync/')) {
      if (!this.syncMounted) return this.error(404, 'NOT_FOUND', 'Not found.');
      if (account.guest) return this.error(403, 'FORBIDDEN', 'Not available in the tour.');
      if (path === '/api/sync/key' && method === 'GET') {
        const state = this.ensureSyncState(d);
        const res: SyncKeyResponse = { key: state.key, epoch: state.epoch, serverNow: this.nowIso() };
        return makeResponse(200, res, { 'Cache-Control': 'no-store' });
      }
      if (path === '/api/sync/op' && method === 'POST') return this.syncOp(account, d, body, bodyBytes);
      return this.error(404, 'NOT_FOUND', 'Not found.');
    }

    try {
      return this.dataRoute(method, path, params, body, d);
    } catch (e) {
      if (e instanceof ValidationFailure) return this.error(400, 'VALIDATION', e.message, e.field);
      throw e;
    }
  }

  private syncOp(account: FakeAccount, d: Diary, body: unknown, bodyBytes: number): Response {
    if (bodyBytes > SYNC_MAX_OP_BYTES + 16 * 1024) return makeResponse(413, '<html>request entity too large</html>', { 'content-type': 'text/html' });
    const raw = body as Partial<SyncOp> | undefined;
    if (!raw || typeof raw !== 'object') return this.error(400, 'VALIDATION', 'Bad request.', 'body');
    if (typeof raw.account === 'string' && raw.account !== account.userId) return this.error(409, 'FORBIDDEN', 'This change belongs to another account.', 'account');
    if (raw.v !== 1) return this.error(400, 'VALIDATION', 'Bad request.', 'v');
    if (typeof raw.opId !== 'string' || typeof raw.editedAt !== 'string' || typeof raw.epoch !== 'string' || typeof raw.kind !== 'string') {
      return this.error(400, 'VALIDATION', 'Bad request.', 'opId');
    }
    let op: SyncOp;
    try {
      op = this.validateOp(raw as SyncOp);
    } catch (e) {
      if (e instanceof ValidationFailure) return this.error(400, 'VALIDATION', e.message, e.field);
      throw e;
    }
    const growing = op.kind === 'entry.create' || op.kind === 'entry.update' || op.kind === 'habit.create' || op.kind === 'habit.update' || op.kind === 'log.set' || op.kind === 'settings.patch';
    if (this.quotaFull && growing) return this.error(507, 'IO', 'The diary has reached its storage limit.');
    const now = this.nowIso();
    let result: Omit<SyncOpResult, 'opId' | 'serverNow' | 'epoch'>;
    try {
      result = this.apply(d, op, now);
    } catch (e) {
      if (e instanceof ValidationFailure) return this.error(400, 'VALIDATION', e.message, e.field);
      throw e;
    }
    if (result.outcome === 'applied' || result.outcome === 'conflict-won') this.applied.set(op.opId, (this.applied.get(op.opId) ?? 0) + 1);
    const answer: SyncOpResult = { opId: op.opId, ...result, serverNow: now, epoch: this.ensureSyncState(d).epoch };
    return makeResponse(200, answer, { 'Cache-Control': 'no-store' });
  }

  private validateOp(op: SyncOp): SyncOp {
    switch (op.kind) {
      case 'entry.create':
        return { ...op, payload: validateEntry(op.payload) };
      case 'entry.update':
        return { ...op, payload: validateEntry(op.payload) };
      case 'habit.create':
      case 'habit.update':
        return { ...op, payload: validateHabit(op.payload) };
      case 'log.set':
        return { ...op, payload: validateLog(op.payload) };
      case 'settings.patch':
        return { ...op, payload: validateSettings(op.payload) };
      default:
        return op;
    }
  }

  // -------------------------------------------------------------------------
  // apply (mirrors server/src/sync/apply.ts)
  // -------------------------------------------------------------------------

  private newEpoch(): string {
    const bytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(bytes);
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private ensureSyncState(d: Diary): { key: string; epoch: string } {
    let key = d.meta.get('sync:key');
    let epoch = d.meta.get('sync:epoch');
    if (!key) {
      const bytes = new Uint8Array(32);
      globalThis.crypto.getRandomValues(bytes);
      key = btoa(String.fromCharCode(...bytes));
      d.meta.set('sync:key', key);
    }
    if (!epoch) {
      epoch = this.newEpoch();
      d.meta.set('sync:epoch', epoch);
    }
    return { key, epoch };
  }

  private resolveRef(d: Diary, kind: 'entry' | 'habit', ref: SyncRef, field: string): number {
    if ('id' in ref) return ref.id;
    const raw = d.meta.get(`sync:cid:${kind}:${ref.clientId.toLowerCase()}`);
    if (raw === undefined) throw new ValidationFailure(field, 'Unknown clientId.');
    return Number(raw);
  }

  private writeLog(d: Diary, habitId: number, date: string, fields: LogFields): HabitLog {
    const habit = d.habits.get(habitId);
    if (!habit) throw new ValidationFailure('habit', 'No such habit.');
    const key = `${habitId}:${date}`;
    const cur = d.logs.get(key);
    const log: HabitLog = { id: cur?.id ?? d.nextLogId++, habitId, date, value: fields.value, completed: isLogCompleted(habit, fields.value), note: fields.note ?? '' };
    d.logs.set(key, log);
    return log;
  }

  private apply(d: Diary, op: SyncOp, now: string): Omit<SyncOpResult, 'opId' | 'serverNow' | 'epoch'> {
    const ts = clampEditedAt(op.editedAt, now);
    const { epoch } = this.ensureSyncState(d);
    const epochOk = op.epoch === epoch;
    const storedTime = (row: string) => d.meta.get(row) ?? '';

    switch (op.kind) {
      case 'entry.create': {
        const cidRow = `sync:cid:entry:${op.clientId.toLowerCase()}`;
        const known = d.meta.get(cidRow);
        if (known !== undefined) return { outcome: 'unchanged', record: d.entries.get(Number(known)) ?? null };
        const entry: Entry = { ...op.payload, id: d.nextEntryId++, createdAt: ts, updatedAt: ts };
        d.entries.set(entry.id, entry);
        d.meta.set(cidRow, String(entry.id));
        return { outcome: 'applied', record: entry };
      }
      case 'entry.update': {
        if (!epochOk) return { outcome: 'stale', record: null };
        const id = this.resolveRef(d, 'entry', op.target, 'target');
        const row = d.entries.get(id);
        if (!row) return { outcome: 'gone', record: null };
        const outcome = decide({
          exists: true,
          same: stableJson(entryInputOf(row)) === stableJson(entryInputOf(op.payload)),
          baseKnown: op.base !== undefined,
          baseMatches: op.base === row.updatedAt,
          ts,
          storedAt: row.updatedAt,
        });
        if (outcome === 'applied' || outcome === 'conflict-won') {
          const updated: Entry = { ...row, ...op.payload, id, createdAt: row.createdAt, updatedAt: nextVersion(row.updatedAt, ts) };
          d.entries.set(id, updated);
          return outcome === 'conflict-won' ? { outcome, record: updated, replaced: row } : { outcome, record: updated };
        }
        return { outcome, record: row };
      }
      case 'entry.delete': {
        if (!epochOk) return { outcome: 'stale', record: null };
        const id = this.resolveRef(d, 'entry', op.target, 'target');
        const row = d.entries.get(id);
        if (!row) return { outcome: 'unchanged', record: null };
        const outcome = decide({ exists: true, same: false, baseKnown: op.base !== undefined, baseMatches: op.base === row.updatedAt, ts, storedAt: row.updatedAt });
        if (outcome === 'applied' || outcome === 'conflict-won') {
          d.entries.delete(id);
          return outcome === 'conflict-won' ? { outcome, record: null, replaced: row } : { outcome, record: null };
        }
        return { outcome, record: row };
      }
      case 'habit.create': {
        const cidRow = `sync:cid:habit:${op.clientId.toLowerCase()}`;
        const known = d.meta.get(cidRow);
        if (known !== undefined) return { outcome: 'unchanged', record: d.habits.get(Number(known)) ?? null };
        const sortOrder = [...d.habits.values()].reduce((m, h) => Math.max(m, h.sortOrder + 1), 0);
        const habit: Habit = { ...op.payload, id: d.nextHabitId++, isArchived: false, sortOrder, createdAt: ts };
        d.habits.set(habit.id, habit);
        d.meta.set(cidRow, String(habit.id));
        d.meta.set(`sync:t:habit:${habit.id}`, ts);
        return { outcome: 'applied', record: habit };
      }
      case 'habit.update': {
        if (!epochOk) return { outcome: 'stale', record: null };
        const id = this.resolveRef(d, 'habit', op.target, 'target');
        const habit = d.habits.get(id);
        if (!habit) return { outcome: 'gone', record: null };
        const timeRow = `sync:t:habit:${id}`;
        const storedAt = storedTime(timeRow);
        const outcome = decide({
          exists: true,
          same: stableJson(habitFieldsOf(habit)) === stableJson(habitFieldsOf(op.payload)),
          baseKnown: op.base !== undefined,
          baseMatches: op.base !== undefined && stableJson(habitFieldsOf(habit)) === stableJson(habitFieldsOf(op.base)),
          ts,
          storedAt,
        });
        if (outcome === 'applied' || outcome === 'conflict-won') {
          const updated: Habit = { ...habit, ...op.payload };
          d.habits.set(id, updated);
          d.meta.set(timeRow, nextVersion(storedAt, ts));
          return outcome === 'conflict-won' ? { outcome, record: updated, replaced: habit } : { outcome, record: updated };
        }
        return { outcome, record: habit };
      }
      case 'habit.archive': {
        if (!epochOk) return { outcome: 'stale', record: null };
        const id = this.resolveRef(d, 'habit', op.target, 'target');
        const habit = d.habits.get(id);
        if (!habit) return { outcome: 'gone', record: null };
        const timeRow = `sync:t:habit:${id}`;
        const storedAt = storedTime(timeRow);
        const outcome = decide({
          exists: true,
          same: habit.isArchived === op.payload.archived,
          baseKnown: op.base !== undefined,
          baseMatches: op.base !== undefined && op.base.archived === habit.isArchived,
          ts,
          storedAt,
        });
        if (outcome === 'applied' || outcome === 'conflict-won') {
          const updated: Habit = { ...habit, isArchived: op.payload.archived };
          d.habits.set(id, updated);
          d.meta.set(timeRow, nextVersion(storedAt, ts));
          return outcome === 'conflict-won' ? { outcome, record: updated, replaced: habit } : { outcome, record: updated };
        }
        return { outcome, record: habit };
      }
      case 'log.set':
      case 'log.delete': {
        if (!epochOk) return { outcome: 'stale', record: null };
        const habitId = this.resolveRef(d, 'habit', op.habit, 'habit');
        if (!d.habits.has(habitId)) return { outcome: 'gone', record: null };
        const key = `${habitId}:${op.date}`;
        const current = d.logs.get(key) ?? null;
        const currentFields: LogFields | null = current ? { value: current.value, note: current.note } : null;
        if (op.kind === 'log.delete' && !current) return { outcome: 'unchanged', record: null };
        const timeRow = `sync:t:log:${habitId}:${op.date}`;
        const storedAt = storedTime(timeRow);
        const outcome = decide({
          exists: true,
          same: op.kind === 'log.set' ? sameLog(currentFields, op.payload) : false,
          baseKnown: op.base !== undefined,
          baseMatches: op.base !== undefined && sameLog(op.base, currentFields),
          ts,
          storedAt,
        });
        if (outcome === 'applied' || outcome === 'conflict-won') {
          let record: HabitLog | null = null;
          if (op.kind === 'log.set') record = this.writeLog(d, habitId, op.date, op.payload);
          else d.logs.delete(key);
          d.meta.set(timeRow, nextVersion(storedAt, ts));
          return outcome === 'conflict-won' && current ? { outcome, record, replaced: current } : { outcome, record };
        }
        return { outcome, record: current };
      }
      case 'settings.patch': {
        const before = d.settings;
        const keys: Partial<Record<keyof AppSettings, SyncKeyOutcome>> = {};
        const toSave: Partial<AppSettings> = {};
        const replaced: Partial<AppSettings> = {};
        for (const key of Object.keys(op.payload) as (keyof AppSettings)[]) {
          const value = op.payload[key];
          const stored = before[key];
          const timeRow = `sync:t:set:${key}`;
          const storedAt = storedTime(timeRow);
          const baseKnown = op.base !== undefined && Object.prototype.hasOwnProperty.call(op.base, key);
          const outcome = decide({
            exists: true,
            same: stableJson(stored) === stableJson(value),
            baseKnown,
            baseMatches: baseKnown && stableJson(op.base?.[key]) === stableJson(stored),
            ts,
            storedAt,
          }) as SyncKeyOutcome;
          keys[key] = outcome;
          if (outcome === 'applied' || outcome === 'conflict-won') {
            (toSave as Record<string, unknown>)[key] = value;
            d.meta.set(timeRow, nextVersion(storedAt, ts));
            if (outcome === 'conflict-won') (replaced as Record<string, unknown>)[key] = stored;
          }
        }
        if (Object.keys(toSave).length) d.settings = { ...before, ...toSave };
        const outcome = settingsOutcome(keys);
        return outcome === 'conflict-won' ? { outcome, record: d.settings, replaced, keys } : { outcome, record: d.settings, keys };
      }
    }
  }

  // -------------------------------------------------------------------------
  // Ordinary data routes (reads the facade caches; writes for the pass-through comparison)
  // -------------------------------------------------------------------------

  private dataRoute(method: string, path: string, params: URLSearchParams, body: unknown, d: Diary): Response {
    const today = this.nowIso().slice(0, 10);
    const sortedEntries = () => [...d.entries.values()].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.time !== b.time ? (a.time < b.time ? -1 : 1) : a.id - b.id));

    if (path === '/api/settings') {
      if (method === 'GET') return makeResponse(200, d.settings);
      if (method === 'PUT') {
        d.settings = { ...d.settings, ...validateSettings(body) };
        return makeResponse(200, d.settings);
      }
    }
    if (path === '/api/entries') {
      if (method === 'GET') {
        const filter: EntryFilter = {
          from: params.get('from') ?? undefined,
          to: params.get('to') ?? undefined,
          tag: params.get('tag') ?? undefined,
          emotion: params.get('emotion') ?? undefined,
          text: params.get('text') ?? undefined,
        };
        const desc = params.get('sortDesc') === null ? true : params.get('sortDesc') !== 'false';
        const limit = Number(params.get('limit') ?? 20);
        const offset = Number(params.get('offset') ?? 0);
        const all = sortedEntries().filter((e) => matchesFilter(e, filter));
        if (desc) all.reverse();
        return makeResponse(200, { items: all.slice(offset, offset + limit).map(entryToSummary), total: all.length });
      }
      if (method === 'POST') {
        const payload = validateEntry(body);
        const at = this.nowIso();
        const entry: Entry = { ...payload, id: d.nextEntryId++, createdAt: at, updatedAt: at };
        d.entries.set(entry.id, entry);
        return makeResponse(201, entry);
      }
    }
    let m = /^\/api\/entries\/day\/(\d{4}-\d{2}-\d{2})$/.exec(path);
    if (m && method === 'GET') {
      const date = m[1];
      const entries = sortedEntries().filter((e) => e.date === date);
      const habitLogs = [...d.logs.values()]
        .filter((l) => l.date === date)
        .map((log) => {
          const h = d.habits.get(log.habitId)!;
          return { log, habitName: h.name, unit: h.unit, target: h.target, frequency: h.frequency };
        })
        .sort((a, b) => d.habits.get(a.log.habitId)!.sortOrder - d.habits.get(b.log.habitId)!.sortOrder);
      const sleep = entries.map((e) => e.sleepHours).filter((v): v is number => typeof v === 'number');
      const day: DaySummary = {
        date,
        entries,
        habitLogs,
        moodAvg: mean2(entries.map((e) => e.mood)),
        energyAvg: mean2(entries.map((e) => e.energy)),
        stressAvg: mean2(entries.map((e) => e.stress)),
        sleepHours: sleep.length ? Math.max(...sleep) : null,
      };
      return makeResponse(200, day);
    }
    m = /^\/api\/entries\/meta\/(tags|people|locations)$/.exec(path);
    if (m && method === 'GET') {
      const counts = new Map<string, number>();
      for (const e of d.entries.values()) {
        const values = m[1] === 'tags' ? e.tags : m[1] === 'people' ? e.people : e.location ? [e.location] : [];
        for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      const list: TagCount[] = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1));
      return makeResponse(200, list);
    }
    m = /^\/api\/entries\/(\d+)$/.exec(path);
    if (m) {
      const id = Number(m[1]);
      const cur = d.entries.get(id);
      if (!cur) return this.error(404, 'NOT_FOUND', 'Entry not found.');
      if (method === 'GET') return makeResponse(200, cur);
      if (method === 'PUT') {
        const next: Entry = { ...cur, ...validateEntry(body), updatedAt: this.nowIso() };
        d.entries.set(id, next);
        return makeResponse(200, next);
      }
      if (method === 'DELETE') {
        d.entries.delete(id);
        return makeResponse(204);
      }
    }
    if (path === '/api/habits') {
      if (method === 'GET') {
        const includeArchived = params.get('includeArchived') === 'true';
        const list = [...d.habits.values()].filter((h) => includeArchived || !h.isArchived).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
        return makeResponse(200, list);
      }
      if (method === 'POST') {
        const payload = validateHabit(body);
        const habit: Habit = { ...payload, id: d.nextHabitId++, isArchived: false, sortOrder: d.habits.size, createdAt: this.nowIso() };
        d.habits.set(habit.id, habit);
        return makeResponse(201, habit);
      }
    }
    if (path === '/api/habits/templates' && method === 'GET') return makeResponse(200, []);
    if (path === '/api/habits/progress' && method === 'GET') return makeResponse(200, this.progress(d, params.get('date') ?? today));
    if (path === '/api/habits/status' && method === 'GET') {
      const from = params.get('from') ?? '';
      const to = params.get('to') ?? '';
      const list = [...d.logs.values()]
        .filter((l) => l.date >= from && l.date <= to)
        .map((l) => ({ habitId: l.habitId, habitName: d.habits.get(l.habitId)?.name ?? '', date: l.date, value: l.value, completed: l.completed }));
      return makeResponse(200, list);
    }
    if (path === '/api/habits/logs' && method === 'PUT') {
      const b = body as { habitId: number; date: string; value: number; note?: string };
      return makeResponse(200, this.writeLog(d, b.habitId, b.date, validateLog({ value: b.value, note: b.note })));
    }
    m = /^\/api\/habits\/(\d+)\/logs\/(\d{4}-\d{2}-\d{2})$/.exec(path);
    if (m && method === 'DELETE') {
      d.logs.delete(`${m[1]}:${m[2]}`);
      return makeResponse(204);
    }
    m = /^\/api\/habits\/(\d+)\/archive$/.exec(path);
    if (m && method === 'PATCH') {
      const h = d.habits.get(Number(m[1]));
      if (!h) return this.error(404, 'NOT_FOUND', 'Habit not found.');
      const next = { ...h, isArchived: !!(body as { archived?: boolean }).archived };
      d.habits.set(h.id, next);
      return makeResponse(200, next);
    }
    m = /^\/api\/habits\/(\d+)$/.exec(path);
    if (m) {
      const h = d.habits.get(Number(m[1]));
      if (!h) return this.error(404, 'NOT_FOUND', 'Habit not found.');
      if (method === 'PUT') {
        const next = { ...h, ...validateHabit(body) };
        d.habits.set(h.id, next);
        return makeResponse(200, next);
      }
      if (method === 'DELETE') {
        d.habits.delete(h.id);
        return makeResponse(204);
      }
    }
    if (path === '/api/home' && method === 'GET') {
      const all = sortedEntries();
      const last = all.length ? entryToSummary(all[all.length - 1]) : null;
      const home: HomeSummary = {
        today,
        todayWeekday: 'Monday',
        todayEntryCount: all.filter((e) => e.date === today).length,
        entryStreak: 0,
        lastEntry: last,
        weekMoodAvg: null,
        weekEnergyAvg: null,
        weekStressAvg: null,
        weekSleepAvg: null,
        habitsToday: this.progress(d, today),
        topInsight: null,
        totalEntries: all.length,
      };
      return makeResponse(200, home);
    }
    if (path === '/api/calendar/month' && method === 'GET') {
      const year = Number(params.get('year'));
      const month = Number(params.get('month'));
      const first = `${year}-${String(month).padStart(2, '0')}-01`;
      const daysIn = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const days: CalendarDay[] = [];
      for (let i = 0; i < daysIn; i++) days.push(this.calendarDay(d, addDaysIso(first, i), today));
      return makeResponse(200, { year, month, days });
    }
    if (path === '/api/calendar/range' && method === 'GET') {
      const from = params.get('from') ?? today;
      const to = params.get('to') ?? today;
      const days: CalendarDay[] = [];
      for (let date = from; date <= to; date = addDaysIso(date, 1)) {
        const day = this.calendarDay(d, date, today);
        if (day.entryCount > 0 || day.habitsCompleted > 0) days.push(day);
      }
      return makeResponse(200, days);
    }
    if (path === '/api/insights' || path === '/api/stats' || path === '/api/search') return makeResponse(200, { note: 'online only' });
    return this.error(404, 'NOT_FOUND', `No route ${method} ${path}`);
  }

  private calendarDay(d: Diary, date: string, today: string): CalendarDay {
    const entries = [...d.entries.values()].filter((e) => e.date === date);
    const logs = [...d.logs.values()].filter((l) => l.date === date);
    const sleep = entries.map((e) => e.sleepHours).filter((v): v is number => typeof v === 'number');
    return {
      date,
      mood: mean2(entries.map((e) => e.mood)),
      energy: mean2(entries.map((e) => e.energy)),
      stress: mean2(entries.map((e) => e.stress)),
      sleepHours: sleep.length ? Math.max(...sleep) : null,
      hasEntry: entries.length > 0,
      entryCount: entries.length,
      habitsCompleted: logs.filter((l) => l.completed).length,
      habitsTotal: date > today ? 0 : [...d.habits.values()].filter((h) => !h.isArchived).length,
      titles: entries.map((e) => e.title).filter(Boolean),
    };
  }

  private progress(d: Diary, date: string): HabitWithProgress[] {
    const ws = weekStartIso(date, d.settings.firstDayOfWeek);
    const we = addDaysIso(ws, 6);
    return [...d.habits.values()]
      .filter((h) => !h.isArchived)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map((habit) => {
        const logs = [...d.logs.values()].filter((l) => l.habitId === habit.id && l.date <= date);
        const todayLog = logs.find((l) => l.date === date) ?? null;
        const weekTotal = logs.filter((l) => l.date >= ws && l.date <= we).reduce((s, l) => s + l.value, 0);
        return {
          habit,
          today: todayLog,
          currentStreak: 0,
          bestStreak: 0,
          weekTotal,
          completedLast30: logs.filter((l) => l.completed).length,
          completionRate30: 0,
          targetMet: habit.frequency === 'daily' ? (todayLog?.completed ?? false) : weekTotal >= habit.target,
        };
      });
  }
}
