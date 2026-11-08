/**
 * Device B of the offline e2e test: a second device signed in to the same account, always online.
 * It talks HTTP to the test server with its OWN token (it never touches the api client's token
 * storage, so device A's engine is never confused by it):
 *
 *  - reads through the REST routes (what any client reads);
 *  - writes either through the REST routes (an older app or the web UI without the engine) or as
 *    `/api/sync/op` operations (a current app while online: the newer-wins rule then knows B's edit
 *    time - for habits, logs and settings only a sync write records one, section 3.9).
 *
 * Fictional accounts only; the server is the 127.0.0.1 test server.
 */
import type { SyncKeyResponse, SyncOp, SyncOpResult } from '@shared/sync';
import type { AppSettings, AuthResponse, Entry, EntryInput, EntryPage, Habit, HabitInput, HabitLog, HabitWithProgress, RestoreInfo, SessionInfo } from '@shared/types';

export interface PeerAnswer<T = unknown> {
  status: number;
  body: T;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type PeerOp = DistributiveOmit<SyncOp, 'v' | 'account' | 'opId' | 'editedAt' | 'epoch'>;

export class Peer {
  token = '';
  userId = '';
  readonly urls: string[] = [];

  constructor(
    private readonly realFetch: typeof fetch,
    private readonly base: () => string,
    readonly deviceName = 'Laptop B',
  ) {}

  async raw<T = unknown>(method: string, path: string, body?: unknown, token: string | null = this.token): Promise<PeerAnswer<T>> {
    const url = this.base() + path;
    this.urls.push(url);
    const res = await this.realFetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = text;
    }
    return { status: res.status, body: parsed as T };
  }

  /** Like `raw`, but a non-2xx answer throws (with the server's message). */
  async ok<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const r = await this.raw<T>(method, path, body);
    if (r.status < 200 || r.status >= 300) throw new Error(`device B: ${method} ${path} -> ${r.status} ${JSON.stringify(r.body)}`);
    return r.body;
  }

  async signIn(username: string, password: string): Promise<AuthResponse> {
    const r = await this.raw<AuthResponse>('POST', '/api/auth/login', { username, password, rememberMe: true, deviceName: this.deviceName }, null);
    if (r.status !== 200) throw new Error(`device B: sign-in failed ${r.status} ${JSON.stringify(r.body)}`);
    this.token = r.body.token;
    this.userId = r.body.user.id;
    return r.body;
  }

  // Reads ---------------------------------------------------------------------
  entries(query = 'limit=500'): Promise<EntryPage> {
    return this.ok<EntryPage>('GET', `/api/entries?${query}`);
  }
  async entry(id: number): Promise<Entry | null> {
    const r = await this.raw<Entry>('GET', `/api/entries/${id}`);
    if (r.status === 404) return null;
    if (r.status !== 200) throw new Error(`device B: GET entry ${id} -> ${r.status}`);
    return r.body;
  }
  habits(includeArchived = true): Promise<Habit[]> {
    return this.ok<Habit[]>('GET', `/api/habits?includeArchived=${includeArchived}`);
  }
  progress(date: string): Promise<HabitWithProgress[]> {
    return this.ok<HabitWithProgress[]>('GET', `/api/habits/progress?date=${date}`);
  }
  logs(habitId: number, date: string): Promise<HabitLog[]> {
    return this.ok<HabitLog[]>('GET', `/api/habits/${habitId}/logs?from=${date}&to=${date}`);
  }
  settings(): Promise<AppSettings> {
    return this.ok<AppSettings>('GET', '/api/settings');
  }
  sessions(): Promise<SessionInfo[]> {
    return this.ok<SessionInfo[]>('GET', '/api/auth/sessions');
  }

  // REST writes (an app without the engine) -----------------------------------
  createEntry(input: EntryInput): Promise<Entry> {
    return this.ok<Entry>('POST', '/api/entries', input);
  }
  updateEntry(id: number, input: EntryInput): Promise<Entry> {
    return this.ok<Entry>('PUT', `/api/entries/${id}`, input);
  }
  deleteEntry(id: number): Promise<unknown> {
    return this.ok('DELETE', `/api/entries/${id}`);
  }
  createHabit(input: HabitInput): Promise<Habit> {
    return this.ok<Habit>('POST', '/api/habits', input);
  }

  // Sync writes (a current app while online) -----------------------------------
  private epoch = '';
  /** The `editedAt` of B's last sync operation (B's clock is the server's: the same machine). */
  lastEditedAt = '';

  async key(): Promise<SyncKeyResponse> {
    const k = await this.ok<SyncKeyResponse>('GET', '/api/sync/key');
    this.epoch = k.epoch;
    return k;
  }

  async op(op: PeerOp): Promise<SyncOpResult> {
    if (!this.epoch) await this.key();
    this.lastEditedAt = new Date().toISOString();
    const full = { v: 1, account: this.userId, opId: crypto.randomUUID(), editedAt: this.lastEditedAt, epoch: this.epoch, ...op } as SyncOp;
    const result = await this.ok<SyncOpResult>('POST', '/api/sync/op', full);
    this.epoch = result.epoch || this.epoch;
    return result;
  }

  // Account / backup -----------------------------------------------------------
  changePassword(oldPassword: string, newPassword: string): Promise<unknown> {
    return this.ok('POST', '/api/auth/change-password', { oldPassword, newPassword, confirmPassword: newPassword });
  }
  revokeSession(id: string): Promise<unknown> {
    return this.ok('DELETE', `/api/auth/sessions/${encodeURIComponent(id)}`);
  }

  /** POST /api/backup/create without a path: the encrypted backup file's bytes. */
  async downloadBackup(): Promise<Uint8Array> {
    const url = this.base() + '/api/backup/create';
    this.urls.push(url);
    const res = await this.realFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': 'en', Authorization: `Bearer ${this.token}` }, body: '{}' });
    if (res.status !== 200) throw new Error(`device B: backup -> ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  restoreBackup(bytes: Uint8Array, password: string): Promise<RestoreInfo> {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return this.ok<RestoreInfo>('POST', '/api/backup/restore', { fileBase64: btoa(s), fileName: 'my-diary.mpd', password });
  }
}
