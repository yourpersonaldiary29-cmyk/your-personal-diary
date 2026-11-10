/**
 * WP-H10a (docs/android-tasks/OFFLINE-DESIGN.md §3.2-3.4, §3.8): `/api/sync` on the real hosted
 * composition (`startHosted`, 127.0.0.1, a temp data dir, a fast KDF):
 *   - the key is created once, on disk before the answer, and stable (also across a restart);
 *   - 403 for a guest, 423 while locked; 409 for another account; 400 with a field; 413 over 2 MB;
 *     507 for growing kinds while deletes and archive pass;
 *   - the encrypted file on disk, decrypted, holds the change when the 200 arrives;
 *   - an injected persist failure gives 503 'server.sync.notSaved' (Retry-After: 5) and the retry
 *     gives "unchanged", persisted; a vault closed during the persist gives 503;
 *   - the diary changes under a request in flight (the session check runs when the headers arrive,
 *     the handler once the body is complete): a restore in that gap is decided against the restored
 *     diary (`stale`), never acknowledged against the discarded one; a restore during the persist
 *     gives 503 and the retry `stale`; a vault closed in that gap gives 503, not 500;
 *   - two concurrent identical requests make one record;
 *   - Retry-After is exposed (CORS) to the Windows and Android app origins, under /api/sync only;
 *   - `ServerInfo.offlineSync` only in hosted mode, gone with DIARY_OFFLINE_SYNC=0 while /api/sync
 *     still answers; the local composition answers 404 and its ServerInfo is unchanged.
 * Fictional users ("dana", "lior") and TEST-NET addresses only.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import type { SyncKeyResponse, SyncOpResult } from '@shared/sync';
import type { AuthResponse, Entry, Habit, ServerInfo } from '@shared/types';
import { loadConfig, loadHostedEnv } from '../src/config';
import { DiaryDb } from '../src/db/database';
import { getMeta } from '../src/db/settings-repo';
import { startHosted, type HostedStartOptions, type RunningHosted } from '../src/hosted';
import { QUOTA_KEY } from '../src/middleware/quota';
import { decryptWithPassword } from '../src/security/container';
import { GUEST_NOT_ALLOWED_KEY } from '../src/security/guest';
import { cleanupTempDirs, makeTestApp, sampleEntry, tempDataDir, testHostedOptions } from './helpers';

const PASSWORD = 'Passw0rd!';
const FAST = { kdf: { N: 1024, r: 8, p: 1 } };
const HOST = 'diary.example';
const running: RunningHosted[] = [];

afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

async function boot(o: { dataDir?: string; env?: Record<string, string>; start?: HostedStartOptions } = {}) {
  const dataDir = o.dataDir ?? tempDataDir();
  const env = loadHostedEnv({
    DIARY_MODE: 'hosted',
    DIARY_PUBLIC_URL: `https://${HOST}`,
    DIARY_BIND: '127.0.0.1',
    DIARY_LOGIN_PER_MINUTE: '1000',
    DIARY_AUTH_GLOBAL_PER_MINUTE: '5000',
    ...o.env,
  });
  const config = loadConfig(['--data-dir', dataDir], { DIARY_MODE: 'hosted' });
  const srv = await startHosted(config, env, { port: 0, quiet: true, auth: FAST, ...o.start });
  running.push(srv);
  const agent = supertest(srv.localUrl);
  type Req = ReturnType<typeof agent.get>;
  const common = (r: Req) => r.set('Host', HOST).set('Accept-Language', 'en').set('X-Forwarded-Proto', 'https');
  const anon = () => ({
    get: (url: string) => common(agent.get(url)),
    post: (url: string, body: object = {}) => common(agent.post(url)).send(body),
  });
  const as = (token: string) => ({
    get: (url: string) => common(agent.get(url)).set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object | string = {}) => common(agent.post(url)).set('Authorization', `Bearer ${token}`).send(body),
    delete: (url: string) => common(agent.delete(url)).set('Authorization', `Bearer ${token}`),
    /** A binary download (POST /api/backup/create without a path). */
    download: (url: string, body: object = {}) =>
      common(agent.post(url))
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .send(body),
  });
  return { srv, anon, as, dataDir };
}

type Booted = Awaited<ReturnType<typeof boot>>;

async function register(b: Booted, username: string, rememberMe = true) {
  const res = await b.anon().post('/api/auth/register', {
    firstName: 'Dana',
    lastName: 'Test',
    username,
    email: `${username}@example.com`,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    rememberMe,
    privacyAccepted: true,
    termsAccepted: true,
  });
  expect(res.status).toBe(201);
  const auth = res.body as AuthResponse;
  return { token: auth.token, userId: auth.user.id, api: b.as(auth.token) };
}

const isoNow = () => new Date().toISOString();

function op(account: string, epoch: string, kind: string, extra: Record<string, unknown>) {
  return { v: 1, account, opId: randomUUID(), editedAt: isoNow(), epoch, kind, ...extra };
}

function entryPayload(overrides: Record<string, unknown> = {}) {
  return sampleEntry({ title: 'Morning walk', body: 'Walked with Dana by the sea.', people: ['Dana'], ...overrides });
}

/** The diary as it is on disk right now: the encrypted file, decrypted with the account password. */
async function diskDiary(dataDir: string, userId: string): Promise<DiaryDb> {
  const accounts = JSON.parse(fs.readFileSync(path.join(dataDir, 'accounts.json'), 'utf8')) as { accounts: Array<{ id: string; dbFile: string }> };
  const record = accounts.accounts.find((a) => a.id === userId);
  if (!record) throw new Error('account not on disk');
  const { plain } = await decryptWithPassword(fs.readFileSync(path.join(dataDir, 'users', record.dbFile)), PASSWORD);
  return DiaryDb.fromImage(plain);
}

describe('GET /api/sync/key', () => {
  it('creates the key once, on disk before the answer, stable across calls and a restart; no-store', async () => {
    const b = await boot();
    const dana = await register(b, 'dana');
    const first = await dana.api.get('/api/sync/key');
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toBe('no-store');
    const k = first.body as SyncKeyResponse;
    expect(Buffer.from(k.key, 'base64')).toHaveLength(32);
    expect(k.epoch).toMatch(/^[0-9a-f]{16}$/);
    expect(Math.abs(Date.parse(k.serverNow) - Date.now())).toBeLessThan(60_000);
    // On disk at the moment of the 200.
    const disk = await diskDiary(b.dataDir, dana.userId);
    expect(getMeta(disk, 'sync:key')).toBe(k.key);
    expect(getMeta(disk, 'sync:epoch')).toBe(k.epoch);
    disk.close();
    expect((await dana.api.get('/api/sync/key')).body).toMatchObject({ key: k.key, epoch: k.epoch });
    // Restart: the remember-me session reopens the diary; same key and epoch.
    await b.srv.stop();
    running.splice(running.indexOf(b.srv), 1);
    const b2 = await boot({ dataDir: b.dataDir });
    expect((await b2.as(dana.token).get('/api/sync/key')).body).toMatchObject({ key: k.key, epoch: k.epoch });
    // Another account gets its own key.
    const lior = await register(b2, 'lior');
    expect(((await lior.api.get('/api/sync/key')).body as SyncKeyResponse).key).not.toBe(k.key);
  });

  it('403 for the guest of the tour, 423 for a locked session, 401 without a session', async () => {
    const b = await boot();
    const guest = await b.anon().post('/api/auth/guest', { language: 'en' });
    expect(guest.status).toBe(201);
    const g = b.as((guest.body as AuthResponse).token);
    const gk = await g.get('/api/sync/key');
    expect(gk.status).toBe(403);
    expect(gk.body).toEqual({ code: 'FORBIDDEN', message: t('en', GUEST_NOT_ALLOWED_KEY) });
    expect((await g.post('/api/sync/op', op((guest.body as AuthResponse).user.id, '0123456789abcdef', 'settings.patch', { payload: { theme: 'dark' } }))).status).toBe(403);

    const dana = await register(b, 'dana');
    const { epoch } = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    expect((await dana.api.post('/api/auth/lock')).status).toBeLessThan(300);
    const locked = await dana.api.get('/api/sync/key');
    expect(locked.status).toBe(423);
    expect(locked.body.code).toBe('LOCKED');
    expect((await dana.api.post('/api/sync/op', op(dana.userId, epoch, 'settings.patch', { payload: { theme: 'dark' } }))).status).toBe(423);
    expect((await dana.api.post('/api/auth/verify-password', { password: PASSWORD })).status).toBe(200);
    expect((await dana.api.post('/api/sync/op', op(dana.userId, epoch, 'settings.patch', { payload: { theme: 'dark' } }))).status).toBe(200);

    expect((await b.anon().get('/api/sync/key')).status).toBe(401);
  });
});

describe('POST /api/sync/op', () => {
  it('answers after the change is on disk: the decrypted file holds the entry and its clientId row', async () => {
    const b = await boot();
    const dana = await register(b, 'dana');
    const { epoch } = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    const clientId = randomUUID();
    const body = op(dana.userId, epoch, 'entry.create', { clientId, payload: entryPayload({ title: 'בוקר טוב 🌅' }) });
    const res = await dana.api.post('/api/sync/op', body);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const result = res.body as SyncOpResult;
    expect(result).toMatchObject({ opId: body.opId, outcome: 'applied', epoch });
    const entry = result.record as Entry;
    expect(entry).toMatchObject({ title: 'בוקר טוב 🌅', createdAt: body.editedAt });
    const disk = await diskDiary(b.dataDir, dana.userId);
    expect(disk.get<{ title: string }>('SELECT title FROM entries WHERE id = ?', [entry.id])?.title).toBe('בוקר טוב 🌅');
    expect(getMeta(disk, `sync:cid:entry:${clientId}`)).toBe(String(entry.id));
    disk.close();
    // The ordinary routes see it as well.
    expect((await dana.api.get(`/api/entries/${entry.id}`)).body).toMatchObject({ title: 'בוקר טוב 🌅' });
    // The same operation again: unchanged, one entry.
    expect(((await dana.api.post('/api/sync/op', body)).body as SyncOpResult).outcome).toBe('unchanged');
    expect((await dana.api.get('/api/entries')).body.total).toBe(1);
  });

  it('409 for another account, 400 with a field, 400 unknown clientId, 413 over 2 MB', async () => {
    const b = await boot();
    const dana = await register(b, 'dana');
    const { epoch } = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;

    const other = await dana.api.post('/api/sync/op', op('u_ffffffffffffffff', epoch, 'entry.create', { clientId: randomUUID(), payload: entryPayload() }));
    expect(other.status).toBe(409);
    expect(other.body).toEqual({ code: 'FORBIDDEN', message: t('en', 'server.sync.accountMismatch'), field: 'account' });
    // Another account's operation is refused even when it is malformed (never a "not saved" note).
    expect((await dana.api.post('/api/sync/op', { account: 'u_ffffffffffffffff', v: 9 })).status).toBe(409);

    const badTime = await dana.api.post('/api/sync/op', { ...op(dana.userId, epoch, 'entry.create', { clientId: randomUUID(), payload: entryPayload() }), editedAt: 'yesterday' });
    expect(badTime.status).toBe(400);
    expect(badTime.body).toEqual({ code: 'VALIDATION', message: t('en', 'server.sync.badEditedAt'), field: 'editedAt' });
    const badKind = await dana.api.post('/api/sync/op', op(dana.userId, epoch, 'entry.merge', {}));
    expect(badKind.body).toEqual({ code: 'VALIDATION', message: t('en', 'server.sync.badRequest'), field: 'kind' });
    const badTitle = await dana.api.post('/api/sync/op', op(dana.userId, epoch, 'entry.create', { clientId: randomUUID(), payload: entryPayload({ title: 'x'.repeat(201) }) }));
    expect(badTitle.status).toBe(400);
    expect(badTitle.body.field).toBe('title');
    const unknown = await dana.api.post('/api/sync/op', op(dana.userId, epoch, 'entry.update', { target: { clientId: randomUUID() }, payload: entryPayload() }));
    expect(unknown.status).toBe(400);
    expect(unknown.body).toEqual({ code: 'VALIDATION', message: t('en', 'server.sync.unknownClientId'), field: 'target' });
    const huge = await dana.api.post('/api/sync/op', op(dana.userId, epoch, 'entry.create', { clientId: randomUUID(), payload: entryPayload({ notes: 'x'.repeat(2 * 1024 * 1024 + 10) }) }));
    expect(huge.status).toBe(413);
    expect((await dana.api.get('/api/entries')).body.total).toBe(0);
  });

  it('507 for the growing kinds once the quota is reached, while deletes and archive pass', async () => {
    const b = await boot({ env: { DIARY_MAX_DIARY_BYTES: String(64 * 1024) } });
    const dana = await register(b, 'dana');
    const { epoch } = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    const habit = ((await dana.api.post('/api/sync/op', op(dana.userId, epoch, 'habit.create', { clientId: randomUUID(), payload: { name: 'Water', description: '', target: 8, unit: 'glasses', frequency: 'daily', reminderTime: null, reminderEnabled: false } }))).body as SyncOpResult).record as Habit;
    const ids: number[] = [];
    let refused: supertest.Response | null = null;
    for (let i = 0; i < 200 && !refused; i++) {
      const res = await dana.api.post('/api/sync/op', op(dana.userId, epoch, 'entry.create', { clientId: randomUUID(), payload: entryPayload({ title: `entry ${i}`, body: 'x'.repeat(1500) }) }));
      if (res.status === 200) ids.push(((res.body as SyncOpResult).record as Entry).id);
      else refused = res;
    }
    expect(refused?.status).toBe(507);
    expect(refused?.body).toEqual({ code: 'IO', message: t('en', QUOTA_KEY, { max: 1 }) });
    for (const kind of ['entry.update', 'log.set', 'settings.patch', 'habit.update']) {
      const extra: Record<string, Record<string, unknown>> = {
        'entry.update': { target: { id: ids[0] }, payload: entryPayload({ title: 'renamed' }) },
        'log.set': { habit: { id: habit.id }, date: '2026-10-20', payload: { value: 1, note: '' } },
        'settings.patch': { payload: { theme: 'dark' } },
        'habit.update': { target: { id: habit.id }, payload: { name: 'Tea', description: '', target: 8, unit: 'cups', frequency: 'daily', reminderTime: null, reminderEnabled: false } },
      };
      expect({ kind, status: (await dana.api.post('/api/sync/op', op(dana.userId, epoch, kind, extra[kind]))).status }).toEqual({ kind, status: 507 });
    }
    const del = await dana.api.post('/api/sync/op', op(dana.userId, epoch, 'entry.delete', { target: { id: ids[0] } }));
    expect(del.status).toBe(200);
    expect((del.body as SyncOpResult).outcome).toBe('conflict-won');
    const archive = await dana.api.post('/api/sync/op', op(dana.userId, epoch, 'habit.archive', { target: { id: habit.id }, base: { archived: false }, payload: { archived: true } }));
    expect(archive.status).toBe(200);
    expect((archive.body as SyncOpResult).outcome).toBe('applied');
  });

  it('an injected persist failure gives 503 notSaved (Retry-After: 5); the retry gives unchanged, on disk', async () => {
    const b = await boot();
    const dana = await register(b, 'dana');
    const { epoch } = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    const vault = b.srv.auth.vaults.get(dana.userId)!;
    const original = vault.persist.bind(vault);
    let failures = 0;
    (vault as { persist: typeof vault.persist }).persist = async () => {
      failures++;
      throw new Error('disk full (injected)');
    };
    const body = op(dana.userId, epoch, 'entry.create', { clientId: randomUUID(), payload: entryPayload({ title: 'Saved later' }) });
    const res = await dana.api.post('/api/sync/op', body);
    expect(failures).toBe(1);
    expect(res.status).toBe(503);
    expect(res.headers['retry-after']).toBe('5');
    expect(res.body).toEqual({ code: 'IO', message: t('en', 'server.sync.notSaved') });
    let disk = await diskDiary(b.dataDir, dana.userId);
    expect(Number(disk.scalar('SELECT COUNT(*) FROM entries'))).toBe(0);
    disk.close();
    (vault as { persist: typeof vault.persist }).persist = original;
    const retry = await dana.api.post('/api/sync/op', body);
    expect(retry.status).toBe(200);
    expect((retry.body as SyncOpResult).outcome).toBe('unchanged');
    disk = await diskDiary(b.dataDir, dana.userId);
    expect(disk.all<{ title: string }>('SELECT title FROM entries').map((r) => r.title)).toEqual(['Saved later']);
    disk.close();
  });

  it('a vault closed during the persist gives 503; the remember-me retry reopens it and gives unchanged', async () => {
    const b = await boot();
    const dana = await register(b, 'dana', true);
    const { epoch } = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    const vault = b.srv.auth.vaults.get(dana.userId)!;
    const original = vault.persist.bind(vault);
    (vault as { persist: typeof vault.persist }).persist = async () => {
      (vault as { persist: typeof vault.persist }).persist = original;
      await b.srv.auth.vaults.close(dana.userId);
    };
    const body = op(dana.userId, epoch, 'settings.patch', { base: { theme: 'system' }, payload: { theme: 'dark' } });
    const res = await dana.api.post('/api/sync/op', body);
    expect(res.status).toBe(503);
    expect(res.body.message).toBe(t('en', 'server.sync.notSaved'));
    const retry = await dana.api.post('/api/sync/op', body);
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ outcome: 'unchanged', keys: { theme: 'unchanged' } });
    expect((await dana.api.get('/api/settings')).body.theme).toBe('dark');
  });

  it('two concurrent identical requests make one record', async () => {
    const b = await boot();
    const dana = await register(b, 'dana');
    const { epoch } = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    const body = op(dana.userId, epoch, 'entry.create', { clientId: randomUUID(), payload: entryPayload() });
    const [r1, r2] = await Promise.all([dana.api.post('/api/sync/op', body), dana.api.post('/api/sync/op', body)]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect([(r1.body as SyncOpResult).outcome, (r2.body as SyncOpResult).outcome].sort()).toEqual(['applied', 'unchanged']);
    expect(((r1.body as SyncOpResult).record as Entry).id).toBe(((r2.body as SyncOpResult).record as Entry).id);
    expect((await dana.api.get('/api/entries')).body.total).toBe(1);
  });
});

describe('Retry-After is readable by the cross-origin apps (§3.8, §4.5)', () => {
  // The Windows app (http://tauri.localhost) and the Android app (https://localhost) are cross-origin:
  // without Access-Control-Expose-Headers naming it, fetch() hides Retry-After (it is not a
  // CORS-safelisted response header) and the replayer falls back to its own 2 s doubling.
  const exposed = (value: string | undefined) =>
    (value ?? '')
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean);

  it('a 503 notSaved, a 200 and a 401 under /api/sync expose Retry-After to both app origins; other routes and same-origin answers are unchanged', async () => {
    const b = await boot();
    const dana = await register(b, 'dana');
    const { epoch } = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    const vault = b.srv.auth.vaults.get(dana.userId)!;
    const original = vault.persist.bind(vault);
    (vault as { persist: typeof vault.persist }).persist = async () => {
      throw new Error('disk full (injected)');
    };
    try {
      for (const origin of ['http://tauri.localhost', 'https://localhost']) {
        const res = await dana.api.post('/api/sync/op', op(dana.userId, epoch, 'entry.create', { clientId: randomUUID(), payload: entryPayload() })).set('Origin', origin);
        expect(res.status).toBe(503);
        expect(res.headers['retry-after']).toBe('5');
        expect(res.headers['access-control-allow-origin']).toBe(origin);
        expect(exposed(res.headers['access-control-expose-headers'])).toEqual(['content-disposition', 'x-entries-exported', 'retry-after']);
      }
    } finally {
      (vault as { persist: typeof vault.persist }).persist = original;
    }
    const key = await dana.api.get('/api/sync/key').set('Origin', 'https://localhost');
    expect(key.status).toBe(200);
    expect(exposed(key.headers['access-control-expose-headers'])).toContain('retry-after');
    // Mounted before the session check: its answers carry it too.
    const anon = await b.anon().get('/api/sync/key').set('Origin', 'http://tauri.localhost');
    expect(anon.status).toBe(401);
    expect(exposed(anon.headers['access-control-expose-headers'])).toContain('retry-after');
    // Same-origin (the web UI): no CORS header at all, as before.
    const same = await dana.api.get('/api/sync/key');
    expect(same.headers['access-control-expose-headers']).toBeUndefined();
    // An origin outside the list: still nothing.
    const other = await dana.api.get('/api/sync/key').set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
    expect(other.headers['access-control-expose-headers']).toBeUndefined();
    // Every other route keeps exactly the two download headers.
    const entries = await dana.api.get('/api/entries').set('Origin', 'http://tauri.localhost');
    expect(entries.status).toBe(200);
    expect(exposed(entries.headers['access-control-expose-headers'])).toEqual(['content-disposition', 'x-entries-exported']);
  });
});

// ---------------------------------------------------------------------------
// The diary changes under a request in flight (OFFLINE-DESIGN §3.4 step 5, §3.7; e2e scenario L7)
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls `cond` every 5 ms; fails after `ms`. */
async function until(cond: () => boolean, what: string, ms = 10_000): Promise<void> {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(5);
  }
}

interface HeldAnswer {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Record<string, unknown>;
}

/**
 * A `POST /api/sync/op` whose headers and the first half of its body arrive now and whose second half
 * arrives when `finish()` is called. The session check (`requireAuth`) runs when the headers arrive
 * and the handler only once the body is complete - on a mobile network that gap is real, and it is
 * the gap in which a restore or a vault close can land.
 */
function heldPost(b: Booted, token: string, body: object): { response: Promise<HeldAnswer>; finish: () => void } {
  const json = Buffer.from(JSON.stringify(body));
  const half = Math.floor(json.length / 2);
  const u = new URL(b.srv.localUrl);
  const req = http.request({
    host: u.hostname,
    port: Number(u.port),
    path: '/api/sync/op',
    method: 'POST',
    headers: {
      Host: HOST,
      'Content-Type': 'application/json',
      'Content-Length': String(json.length),
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'en',
      'X-Forwarded-Proto': 'https',
    },
  });
  const response = new Promise<HeldAnswer>((resolve, reject) => {
    req.on('error', reject);
    req.on('response', (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: text ? (JSON.parse(text) as Record<string, unknown>) : {} });
      });
    });
  });
  req.write(json.subarray(0, half));
  return { response, finish: () => req.end(json.subarray(half)) };
}

/** Resolves once the next session check of `token` completed - its request's body is still being read. */
function nextSessionCheck(b: Booted, token: string): Promise<void> {
  const auth = b.srv.auth;
  const original = auth.authenticate.bind(auth);
  return new Promise<void>((resolve) => {
    auth.authenticate = async (t: string) => {
      const ctx = await original(t);
      if (t === token) {
        auth.authenticate = original;
        resolve();
      }
      return ctx;
    };
  });
}

/** A backup of the diary as it is now, as the client downloads it. */
async function backupOf(dana: Awaited<ReturnType<typeof register>>): Promise<Buffer> {
  const res = await dana.api.download('/api/backup/create', {});
  expect(res.status).toBe(200);
  return res.body as Buffer;
}

const restoreBody = (bytes: Buffer) => ({ fileBase64: bytes.toString('base64'), fileName: 'dana.mpd', password: PASSWORD });

describe('POST /api/sync/op while the diary changes under the request', () => {
  it('a restore between the session check and the handler: decided against the restored diary (stale), never applied to the discarded one', async () => {
    const b = await boot();
    const dana = await register(b, 'dana');
    const { epoch: E1 } = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    const entry = ((await dana.api.post('/api/sync/op', op(dana.userId, E1, 'entry.create', { clientId: randomUUID(), payload: entryPayload() }))).body as SyncOpResult).record as Entry;
    const backup = await backupOf(dana);
    const vault = b.srv.auth.vaults.get(dana.userId)!;
    const oldDb = vault.db;
    // Hold the restore's own persist (in reality an encrypt + fsync of the whole image), so that the
    // discarded database is still open - and still the session check's `ctx.db` - when the held
    // request's handler runs. The handler's own persist passes through.
    const original = vault.persist.bind(vault);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let heldOnce = false;
    (vault as { persist: typeof vault.persist }).persist = async (strict?: boolean) => {
      if (!heldOnce && vault.db !== oldDb) {
        heldOnce = true;
        await gate;
      }
      return original(strict);
    };
    const edit = op(dana.userId, E1, 'entry.update', { target: { id: entry.id }, base: entry.updatedAt, payload: entryPayload({ title: 'Edited offline' }) });
    let res!: HeldAnswer;
    try {
      const checked = nextSessionCheck(b, dana.token);
      const held = heldPost(b, dana.token, edit);
      await checked;
      const restore = dana.api.post('/api/backup/restore', restoreBody(backup)).then((r) => r);
      await until(() => vault.db !== oldDb, 'the restore to swap the diary');
      held.finish();
      res = await held.response;
      release();
      expect((await restore).status).toBe(200);
    } finally {
      release();
    }
    // Never "applied": that answer would acknowledge a change written to the discarded database.
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ opId: edit.opId, outcome: 'stale', record: null });
    // The server and the file on disk hold the restored diary; the answer carries the new epoch.
    const E2 = ((await dana.api.get('/api/sync/key')).body as SyncKeyResponse).epoch;
    expect(E2).not.toBe(E1);
    expect(res.body.epoch).toBe(E2);
    expect((await dana.api.get(`/api/entries/${entry.id}`)).body.title).toBe('Morning walk');
    const disk = await diskDiary(b.dataDir, dana.userId);
    expect(disk.get<{ title: string }>('SELECT title FROM entries WHERE id = ?', [entry.id])?.title).toBe('Morning walk');
    expect(getMeta(disk, 'sync:epoch')).toBe(E2);
    disk.close();
    // With the new epoch the same edit applies: the handler decided against the live, restored diary.
    const again = (await dana.api.post('/api/sync/op', { ...edit, opId: randomUUID(), epoch: E2 })).body as SyncOpResult;
    expect(again.outcome).toBe('applied');
  }, 30_000);

  it('a restore that swaps the diary while the operation is being written to disk: 503 notSaved, nothing of the edit survives, the retry is stale', async () => {
    const b = await boot();
    const dana = await register(b, 'dana');
    const { epoch: E1 } = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    const entry = ((await dana.api.post('/api/sync/op', op(dana.userId, E1, 'entry.create', { clientId: randomUUID(), payload: entryPayload() }))).body as SyncOpResult).record as Entry;
    const backup = await backupOf(dana);
    const vault = b.srv.auth.vaults.get(dana.userId)!;
    const oldDb = vault.db;
    // Hold the next write to disk (the edit's), as a slow disk would; the restore's write queues behind it.
    const raw = vault as unknown as { writeNow(strict?: boolean): Promise<void> };
    const originalWrite = raw.writeNow.bind(vault);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let entered!: () => void;
    const writing = new Promise<void>((r) => (entered = r));
    let first = true;
    raw.writeNow = async (strict?: boolean) => {
      if (first) {
        first = false;
        entered();
        await gate;
      }
      return originalWrite(strict);
    };
    const edit = op(dana.userId, E1, 'entry.update', { target: { id: entry.id }, base: entry.updatedAt, payload: entryPayload({ title: 'Edited offline' }) });
    let res!: supertest.Response;
    try {
      const pending = dana.api.post('/api/sync/op', edit).then((r) => r);
      await writing;
      // Applied in memory, waiting for the disk...
      expect(oldDb.get<{ title: string }>('SELECT title FROM entries WHERE id = ?', [entry.id])?.title).toBe('Edited offline');
      // ...and now a restore swaps the diary.
      const restore = dana.api.post('/api/backup/restore', restoreBody(backup)).then((r) => r);
      await until(() => vault.db !== oldDb, 'the restore to swap the diary');
      release();
      res = await pending;
      expect((await restore).status).toBe(200);
    } finally {
      release();
    }
    expect(res.status).toBe(503);
    expect(res.headers['retry-after']).toBe('5');
    expect(res.body).toEqual({ code: 'IO', message: t('en', 'server.sync.notSaved') });
    // Nothing of the edit is anywhere: not on the server, not on disk.
    expect((await dana.api.get(`/api/entries/${entry.id}`)).body.title).toBe('Morning walk');
    const disk = await diskDiary(b.dataDir, dana.userId);
    expect(disk.get<{ title: string }>('SELECT title FROM entries WHERE id = ?', [entry.id])?.title).toBe('Morning walk');
    disk.close();
    // The device keeps the operation (503) and its retry meets the restored diary.
    const retry = (await dana.api.post('/api/sync/op', edit)).body as SyncOpResult;
    expect(retry.outcome).toBe('stale');
    expect(retry.epoch).not.toBe(E1);
  }, 30_000);

  it('a vault closed between the session check and the handler: 503 notSaved, not 500; the remember-me retry reopens the diary and applies', async () => {
    const b = await boot();
    const dana = await register(b, 'dana', true);
    const { epoch } = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    const body = op(dana.userId, epoch, 'entry.create', { clientId: randomUUID(), payload: entryPayload({ title: 'Written while the diary was closing' }) });
    const checked = nextSessionCheck(b, dana.token);
    const held = heldPost(b, dana.token, body);
    await checked;
    // Idle eviction, or the last session's logout, lands in the gap.
    await b.srv.auth.vaults.close(dana.userId);
    expect(b.srv.auth.vaults.get(dana.userId)).toBeNull();
    held.finish();
    const res = await held.response;
    expect(res.status).toBe(503);
    expect(res.headers['retry-after']).toBe('5');
    expect(res.body).toEqual({ code: 'IO', message: t('en', 'server.sync.notSaved') });
    // The retry: the remember-me session reopens the diary; the change is applied and on disk.
    const retry = await dana.api.post('/api/sync/op', body);
    expect(retry.status).toBe(200);
    expect((retry.body as SyncOpResult).outcome).toBe('applied');
    const disk = await diskDiary(b.dataDir, dana.userId);
    expect(disk.all<{ title: string }>('SELECT title FROM entries').map((r) => r.title)).toEqual(['Written while the diary was closing']);
    disk.close();
  }, 30_000);
});

describe('ServerInfo.offlineSync and the kill switch', () => {
  it('hosted reports offlineSync: 1; DIARY_OFFLINE_SYNC=0 hides it while /api/sync still answers', async () => {
    const on = await boot();
    expect(((await on.anon().get('/api/server/info')).body as ServerInfo).offlineSync).toBe(1);
    await on.srv.stop();
    running.splice(running.indexOf(on.srv), 1);

    const off = await boot({ env: { DIARY_OFFLINE_SYNC: '0' } });
    expect(off.srv.env.offlineSync).toBe(false);
    const info = (await off.anon().get('/api/server/info')).body as ServerInfo;
    expect(info.mode).toBe('hosted');
    expect('offlineSync' in info).toBe(false);
    const dana = await register(off, 'dana');
    const key = await dana.api.get('/api/sync/key');
    expect(key.status).toBe(200);
    const drained = await dana.api.post('/api/sync/op', op(dana.userId, (key.body as SyncKeyResponse).epoch, 'entry.create', { clientId: randomUUID(), payload: entryPayload() }));
    expect((drained.body as SyncOpResult).outcome).toBe('applied');
  });

  it('DIARY_OFFLINE_SYNC accepts 0 or 1 only', () => {
    const baseEnv = { DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: `https://${HOST}` };
    expect(loadHostedEnv(baseEnv).offlineSync).toBe(true);
    expect(loadHostedEnv({ ...baseEnv, DIARY_OFFLINE_SYNC: '1' }).offlineSync).toBe(true);
    expect(loadHostedEnv({ ...baseEnv, DIARY_OFFLINE_SYNC: '0' }).offlineSync).toBe(false);
    expect(() => loadHostedEnv({ ...baseEnv, DIARY_OFFLINE_SYNC: 'off' })).toThrow(/DIARY_OFFLINE_SYNC/);
  });

  it('the hosted app options: on unless offlineSync is false', async () => {
    const on = await makeTestApp({ hosted: testHostedOptions() });
    expect((await on.anon().get('/api/server/info').set('Host', 'diary.example')).body.offlineSync).toBe(1);
    const off = await makeTestApp({ hosted: testHostedOptions({ offlineSync: false }) });
    const offInfo = (await off.anon().get('/api/server/info').set('Host', 'diary.example')).body as ServerInfo;
    expect('offlineSync' in offInfo).toBe(false);
    expect((await off.get('/api/sync/key').set('Host', 'diary.example')).status).toBe(200);
  });

  it('the local composition: /api/sync is 404 and ServerInfo is unchanged', async () => {
    const app = await makeTestApp();
    for (const res of [await app.get('/api/sync/key'), await app.post('/api/sync/op', { v: 1 })]) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    }
    const info = (await app.anon().get('/api/server/info')).body as ServerInfo;
    expect(Object.keys(info).sort()).toEqual(
      ['dataDir', 'isLocalRequest', 'lanEnabled', 'lanUrls', 'passwordResetAvailable', 'port', 'remoteEnabled', 'remoteUrl', 'secure', 'startedAt', 'version'].sort(),
    );
  });
});
