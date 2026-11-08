/**
 * Guest mode ("tour", mobile only - security/guest.ts, POST /api/auth/guest):
 *   - the route exists only when the app is built with `guestAllowed: true`; the desktop server
 *     (startServer) never mounts it (404);
 *   - a guest gets the demo diary and everything works on it: entries, habits, insights, calendar,
 *     statistics, search, export, settings;
 *   - nothing of the guest is ever written to disk: the data directory is byte-for-byte (and
 *     mtime-for-mtime) the same before, during and after the tour;
 *   - a guest cannot do what needs a real account (403), and is never the owner;
 *   - logout, expiry, server stop, a new guest, and a real registration / sign-in end the guest.
 * Real auth service (scrypt with cheap parameters), a temporary data directory, no network.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { SESSION_TTL_HOURS } from '@shared/constants';
import { LOCALE_CODES, t } from '@shared/i18n';
import type { AppSettings, AuthResponse, CalendarMonth, EntryPage, Habit, InsightsReport, SearchResult, ServerSettings, SessionInfo, StatsOverview, UserProfile } from '@shared/types';
import { createApp, type AppDeps } from '../src/app';
import type { ServerConfig } from '../src/config';
import { MailService } from '../src/mail/service';
import type { SmtpTransport } from '../src/mail/transport';
import type { MailController, RemoteController } from '../src/routes/server';
import { createAuthService, type DiaryAuthService } from '../src/security/auth-service';
import { loadOrCreateDeviceKey } from '../src/security/device-key';
import { GUEST_NOT_ALLOWED_KEY, guestNotAllowed, isGuestContext } from '../src/security/guest';
import { firstAccountId } from '../src/security/owner';
import { SessionStore } from '../src/security/sessions';
import type { AccountRecord } from '../src/security/session-types';
import { createMemoryVault, PERSIST_DEBOUNCE_MS } from '../src/security/vault';
import { startServer, type RunningServer } from '../src/server';
import { cleanupTempDirs, makeTestApp, sampleEntry, tempDataDir, testConfig } from './helpers';

const FAST = { N: 1024, r: 8, p: 1 };
const PASSWORD = 'Passw0rd!';

const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c().catch(() => undefined);
});
afterAll(cleanupTempDirs);

type Agent = ReturnType<typeof supertest>;

interface Harness {
  config: ServerConfig;
  dataDir: string;
  auth: DiaryAuthService;
  mail: MailService;
  settings: ServerSettings;
  /** The device itself (loopback). */
  local: Agent;
  /** The app as a request listener (to serve it under another address). */
  app: http.RequestListener;
}

/** The app as the mobile core composes it: real auth service, mail service, remote stub, `guestAllowed`. */
async function harness(opts: { guestAllowed?: boolean; dataDir?: string; now?: () => Date } = {}): Promise<Harness> {
  const dataDir = opts.dataDir ?? tempDataDir();
  const config = testConfig(dataDir);
  const auth = await createAuthService(config, { kdf: FAST, ...(opts.now ? { now: opts.now } : {}) });
  cleanups.push(() => auth.shutdown());
  const deviceKey = loadOrCreateDeviceKey(config.deviceKeyFile);
  const transport: SmtpTransport = { send: async () => {} };
  const mail = new MailService({ config, deviceKey, firstAccountId: () => firstAccountId(auth.listAccounts()), transport, options: { log: () => {} } });
  const remote = {
    status: () => ({ enabled: false }),
    update: async () => ({ enabled: false }),
    renew: async () => ({ enabled: false }),
    test: async () => ({ ok: true }),
    settings: () => ({ enabled: false }),
    info: () => ({ enabled: false, url: '' }),
    ownerId: () => '',
    releaseOwner: async () => false,
  } as unknown as RemoteController;
  const settings: ServerSettings = { port: 0, lanEnabled: false };
  const mailController: MailController = mail;
  const deps: AppDeps & { mail: MailController; remote: RemoteController } = {
    config,
    auth,
    getServerSettings: () => settings,
    setServerSettings: async (next) => Object.assign(settings, { port: next.port, lanEnabled: next.lanEnabled }),
    getListenInfo: () => ({ port: 0, lanUrls: [], startedAt: new Date().toISOString() }),
    mail: mailController,
    remote,
    ...(opts.guestAllowed === undefined ? { guestAllowed: true } : { guestAllowed: opts.guestAllowed }),
  };
  const app = createApp(deps);
  return { config, dataDir, auth, mail, settings, local: supertest(app), app };
}

function as(agent: Agent, token: string, lang = 'en') {
  const prep = (test: supertest.Test) => test.set('Authorization', `Bearer ${token}`).set('Accept-Language', lang);
  return {
    get: (url: string) => prep(agent.get(url)),
    post: (url: string, body: object = {}) => prep(agent.post(url)).send(body),
    put: (url: string, body: object = {}) => prep(agent.put(url)).send(body),
    del: (url: string) => prep(agent.delete(url)),
  };
}

async function startGuest(h: Harness, lang = 'en', body: object = {}): Promise<AuthResponse> {
  const res = await h.local.post('/api/auth/guest').set('Accept-Language', lang).send(body);
  expect(res.status).toBe(201);
  return res.body as AuthResponse;
}

async function register(h: Harness, username: string, rememberMe = false): Promise<AuthResponse> {
  const res = await h.local
    .post('/api/auth/register')
    .set('Accept-Language', 'en')
    .send({ firstName: 'Dana', lastName: 'Cohen', username, email: `${username}@example.com`, password: PASSWORD, confirmPassword: PASSWORD, rememberMe });
  expect(res.status).toBe(201);
  return res.body as AuthResponse;
}

interface FileState {
  size: number;
  mtimeMs: number;
  sha256: string;
}

/** Every file under `dir` (relative path -> size, mtime, content hash) and every directory. */
function snapshot(dir: string): Record<string, FileState | 'dir'> {
  const out: Record<string, FileState | 'dir'> = {};
  const walk = (current: string): void => {
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name);
      const rel = path.relative(dir, full).split(path.sep).join('/');
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        out[rel] = 'dir';
        walk(full);
      } else {
        out[rel] = { size: st.size, mtimeMs: st.mtimeMs, sha256: crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex') };
      }
    }
  };
  walk(dir);
  return out;
}

/** True when any file under `dir` contains `needle` (as UTF-8 text). */
function anyFileContains(dir: string, needle: string): boolean {
  return Object.entries(snapshot(dir)).some(([rel, state]) => state !== 'dir' && fs.readFileSync(path.join(dir, rel)).includes(needle));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('POST /api/auth/guest exists only with guestAllowed', () => {
  it('is not mounted by default, nor with guestAllowed: false (404 like any unknown route)', async () => {
    for (const guestAllowed of [undefined, false] as const) {
      const config = testConfig();
      const auth = await createAuthService(config, { kdf: FAST });
      cleanups.push(() => auth.shutdown());
      const app = await makeTestApp({ auth, config, ...(guestAllowed === undefined ? {} : { guestAllowed }) });
      const res = await app.anon().post('/api/auth/guest').set('Accept-Language', 'en').send({});
      expect({ guestAllowed, status: res.status, code: res.body.code }).toEqual({ guestAllowed, status: 404, code: 'NOT_FOUND' });
      expect(res.body.message).toBe(t('en', 'server.error.notFound', { what: t('en', 'server.error.notFound.route') }));
      expect(auth.hasGuest).toBe(false);
    }
  });

  it('the desktop server (startServer) never mounts it', async () => {
    const config = testConfig();
    const srv: RunningServer = await startServer(config, { port: 0, quiet: true, auth: { kdf: FAST } });
    cleanups.push(() => srv.stop());
    const agent = supertest(`http://127.0.0.1:${srv.port}`);
    const before = snapshot(config.dataDir);
    const res = await agent.post('/api/auth/guest').send({});
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    // Still an ordinary unknown route for other methods too, and nothing was created.
    expect((await agent.get('/api/auth/guest')).status).toBe(404);
    expect(snapshot(config.dataDir)).toEqual(before);
    expect((await agent.get('/api/auth/accounts')).body).toEqual({ accounts: [] });
  });

  it('is mounted with guestAllowed: true - for the device itself only', async () => {
    const h = await harness();
    h.settings.lanEnabled = true;
    // The same app, reached "from the network".
    const server = http.createServer((req, res) => {
      Object.defineProperty(req.socket, 'remoteAddress', { value: '192.168.1.50', configurable: true });
      h.app(req, res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    cleanups.push(() => new Promise<void>((resolve) => (server.closeAllConnections?.(), server.close(() => resolve()))));
    const lan = supertest(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    const refused = await lan.post('/api/auth/guest').set('Accept-Language', 'en').send({});
    expect(refused.status).toBe(403);
    expect(refused.body).toEqual({ code: 'FORBIDDEN', message: t('en', 'server.error.forbidden') });
    expect(h.auth.hasGuest).toBe(false);

    const guest = await startGuest(h);
    expect(guest.guest).toBe(true);
    expect(h.auth.hasGuest).toBe(true);
  });
});

describe('a guest session', () => {
  it('answers like a login, marked guest: true, never remembered', async () => {
    const h = await harness();
    const res = await h.local.post('/api/auth/guest').set('Accept-Language', 'he').send({ rememberMe: true, deviceName: '  Pixel   9 ' });
    expect(res.status).toBe(201);
    const body = res.body as AuthResponse;
    expect(body.guest).toBe(true);
    expect(body.rememberMe).toBe(false);
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now());
    expect(Date.parse(body.expiresAt)).toBeLessThanOrEqual(Date.now() + SESSION_TTL_HOURS * 3_600_000 + 5_000);
    const user: UserProfile = body.user;
    expect(user.guest).toBe(true);
    expect(user.username).toMatch(/^_guest_[0-9a-f]{8}$/);
    expect(user.id).toMatch(/^g_[0-9a-f]{16}$/);
    expect(user.email).toBe('');

    const guest = as(h.local, body.token, 'he');
    const me = await guest.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ id: user.id, username: user.username, guest: true });
    expect(me.body.session).toMatchObject({ guest: true, rememberMe: false, current: true, deviceName: 'Pixel 9' });
    const sessions = (await guest.get('/api/auth/sessions')).body as SessionInfo[];
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ guest: true, rememberMe: false, current: true });
    // The diary starts in the language of the request.
    expect(((await guest.get('/api/settings')).body as AppSettings).language).toBe('he');
  });

  it('a real account never carries the guest flag', async () => {
    const h = await harness();
    const dana = await register(h, 'dana');
    expect('guest' in dana).toBe(false);
    expect('guest' in dana.user).toBe(false);
    const me = await as(h.local, dana.token).get('/api/auth/me');
    expect('guest' in me.body.user).toBe(false);
    expect('guest' in me.body.session).toBe(false);
  });

  it('takes its language from the body, else from Accept-Language (demo texts: Hebrew for he, English otherwise)', async () => {
    const h = await harness();
    const hebrew = await startGuest(h, 'he');
    const heTitles = ((await as(h.local, hebrew.token).get('/api/entries')).body as EntryPage).items.map((e) => e.title).join(' ');
    expect(heTitles).toMatch(/[א-ת]/);

    const german = await startGuest(h, 'he', { language: 'de' });
    const de = as(h.local, german.token, 'de');
    expect(((await de.get('/api/settings')).body as AppSettings).language).toBe('de');
    const deTexts = ((await de.get('/api/entries')).body as EntryPage).items.map((e) => e.title).join(' ');
    expect(deTexts).not.toMatch(/[א-ת]/);

    // An unsupported language in the body falls back to the header.
    const french = await startGuest(h, 'fr', { language: 'xx' });
    expect(((await as(h.local, french.token, 'fr').get('/api/settings')).body as AppSettings).language).toBe('fr');
    // Each new tour replaced the previous one.
    expect((await as(h.local, hebrew.token).get('/api/auth/me')).status).toBe(401);
    expect((await as(h.local, german.token).get('/api/auth/me')).status).toBe(401);
  });

  it('works for entries, habits, insights, calendar, statistics, search, export and settings', async () => {
    const h = await harness();
    const { token } = await startGuest(h, 'he');
    const guest = as(h.local, token, 'he');

    // The demo diary is there.
    const page = (await guest.get('/api/entries')).body as EntryPage;
    expect(page.total).toBeGreaterThan(80);
    const habits = (await guest.get('/api/habits')).body as Habit[];
    expect(habits).toHaveLength(5);

    // Entries: create, read, update, delete.
    const created = await guest.post('/api/entries', sampleEntry({ title: 'רשומת אורח' }));
    expect(created.status).toBe(201);
    const id: number = created.body.id;
    expect(((await guest.get('/api/entries')).body as EntryPage).total).toBe(page.total + 1);
    expect((await guest.get(`/api/entries/${id}`)).body.title).toBe('רשומת אורח');
    expect((await guest.put(`/api/entries/${id}`, sampleEntry({ title: 'עודכן' }))).status).toBe(200);
    expect((await guest.del(`/api/entries/${id}`)).status).toBeLessThan(300);
    expect(((await guest.get('/api/entries')).body as EntryPage).total).toBe(page.total);

    // Habits: a new habit and a log.
    const habit = await guest.post('/api/habits', { name: 'מדיטציה קצרה', description: '', target: 1, unit: '', frequency: 'daily', reminderTime: null, reminderEnabled: false });
    expect(habit.status).toBe(201);
    const log = await guest.put('/api/habits/logs', { habitId: habit.body.id, date: page.items[0].date, value: 1 });
    expect(log.status).toBe(200);
    expect((await guest.get('/api/habits/progress')).status).toBe(200);

    // Insights and statistics.
    const insights = await guest.get('/api/insights?period=30d');
    expect(insights.status).toBe(200);
    expect((insights.body as InsightsReport).insights.length).toBeGreaterThanOrEqual(3);
    const stats = await guest.get('/api/stats?period=30d');
    expect(stats.status).toBe(200);
    expect((stats.body as StatsOverview).mood.points).toHaveLength(30);
    expect((await guest.get('/api/home')).status).toBe(200);

    // Calendar: the month of a demo entry has entries.
    const [year, month] = page.items[0].date.split('-').map(Number);
    const calendar = await guest.get(`/api/calendar/month?year=${year}&month=${month}`);
    expect(calendar.status).toBe(200);
    expect((calendar.body as CalendarMonth).days.find((d) => d.date === page.items[0].date)?.hasEntry).toBe(true);

    // Smart search.
    const search = await guest.post('/api/search', { query: 'אילו ימים בחודש האחרון הרגשתי הכי טוב?' });
    expect(search.status).toBe(200);
    expect((search.body as SearchResult).parsed.intent).toBe('best_days');

    // Export (a download - nothing is saved on the device) and the diary settings.
    const exported = await guest.post('/api/export', { format: 'txt', includeHabits: true });
    expect(exported.status).toBe(200);
    expect(String(exported.headers['content-disposition'])).toMatch(/your-personal-diary-_?guest_[0-9a-f]{8}-/);
    const saved = await guest.put('/api/settings', { language: 'en' });
    expect(saved.status).toBe(200);
    expect((saved.body as AppSettings).language).toBe('en');
    // ...but a guest cannot have the export written to a path on the device.
    const target = path.join(tempDataDir(), 'guest-export.txt');
    const toPath = await guest.post('/api/export', { format: 'txt', destPath: target });
    expect(toPath.status).toBe(403);
    expect(toPath.body).toEqual({ code: 'FORBIDDEN', message: t('he', GUEST_NOT_ALLOWED_KEY) });
    expect(fs.existsSync(target)).toBe(false);
    expect(fs.existsSync(`${target}.tmp`)).toBe(false);
    // The demo cannot be seeded twice.
    expect((await guest.post('/api/settings/seed-demo', {})).status).toBe(400);
    // No file stands behind a guest diary.
    const dataDir = await guest.get('/api/settings/data-dir');
    expect(dataDir.body).toMatchObject({ dbPath: '', dbExists: false, dbSizeBytes: 0 });
  });

  it('nobody can sign in as the guest', async () => {
    const h = await harness();
    const guest = await startGuest(h);
    for (const password of [PASSWORD, 'guest', guest.user.username, 'Passw0rd!1']) {
      const res = await h.local.post('/api/auth/login').send({ username: guest.user.username, password });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('WRONG_PASSWORD');
    }
    // A failed sign-in does not end the tour.
    expect((await as(h.local, guest.token).get('/api/auth/me')).status).toBe(200);
    // And the account list of the login screen never shows it.
    expect((await h.local.get('/api/auth/accounts')).body).toEqual({ accounts: [] });
    expect(h.auth.listAccounts()).toEqual([]);
  });
});

describe('a guest never reaches the disk', () => {
  it('leaves accounts.json, sessions.json, users/ and everything else exactly as they were', async () => {
    const h = await harness();
    // A real account with a remember-me session, so accounts.json, sessions.json and a diary file exist.
    const dana = await register(h, 'dana', true);
    expect((await as(h.local, dana.token).post('/api/entries', sampleEntry())).status).toBe(201);
    await sleep(PERSIST_DEBOUNCE_MS + 400);
    await h.auth.vaults.persistAll();
    h.auth.sessions.persist();
    const before = snapshot(h.dataDir);
    expect(Object.keys(before)).toEqual(expect.arrayContaining(['accounts.json', 'sessions.json', 'device.key', 'users']));
    expect(Object.keys(before).filter((f) => f.startsWith('users/') && f.endsWith('.mpd'))).toHaveLength(1);
    const cwdBefore = fs.readdirSync(process.cwd()).sort();

    // Registration ended nothing; now the tour - it replaces nothing of dana's (same service).
    const guest = await h.auth.startGuest({ deviceName: 'Phone', language: 'he' });
    const g = as(h.local, guest.token, 'he');
    for (let i = 0; i < 5; i++) expect((await g.post('/api/entries', sampleEntry({ title: `guest ${i}` }))).status).toBe(201);
    const habit = await g.post('/api/habits', { name: 'guest habit', description: '', target: 2, unit: 'x', frequency: 'daily', reminderTime: null, reminderEnabled: false });
    expect(habit.status).toBe(201);
    expect((await g.put('/api/habits/logs', { habitId: habit.body.id, date: '2026-09-07', value: 2 })).status).toBe(200);
    expect((await g.put('/api/settings', { language: 'en' })).status).toBe(200);
    expect((await g.get('/api/insights?period=30d')).status).toBe(200);
    expect((await g.post('/api/search', { query: 'מתי כתבתי שאני עייף?' })).status).toBe(200);
    // Longer than the persist debounce of a real diary: a real vault would have written by now.
    await sleep(PERSIST_DEBOUNCE_MS + 600);
    expect(snapshot(h.dataDir)).toEqual(before);

    // The guest's vault is memory-only; flushing everything explicitly writes nothing either.
    const ctx = (await h.auth.authenticate(guest.token))!;
    expect(ctx.vault.memoryOnly).toBe(true);
    expect(ctx.vault.dbPath).toBe('');
    await ctx.vault.persist();
    await h.auth.vaults.persistAll();
    expect(snapshot(h.dataDir)).toEqual(before);

    // Logout: still nothing.
    expect((await g.post('/api/auth/logout')).status).toBe(204);
    await sleep(100);
    expect(h.auth.hasGuest).toBe(false);
    expect(snapshot(h.dataDir)).toEqual(before);

    // A second tour, and the server stops while it is running.
    const second = await startGuest(h, 'en');
    expect((await as(h.local, second.token).post('/api/entries', sampleEntry())).status).toBe(201);
    await h.auth.shutdown();
    const after = snapshot(h.dataDir);
    expect(after).toEqual(before);
    // No trace of a guest in any file, no stray file next to the process either.
    expect(anyFileContains(h.dataDir, '_guest')).toBe(false);
    expect(anyFileContains(h.dataDir, guest.account.id)).toBe(false);
    expect(anyFileContains(h.dataDir, second.user.id)).toBe(false);
    expect(fs.readdirSync(process.cwd()).sort()).toEqual(cwdBefore);
  });

  it('on an empty data directory a tour creates no file at all', async () => {
    const h = await harness();
    const before = snapshot(h.dataDir);
    expect(Object.keys(before).sort()).toEqual(['device.key', 'users']);
    const guest = await startGuest(h, 'en');
    const g = as(h.local, guest.token);
    expect((await g.post('/api/entries', sampleEntry())).status).toBe(201);
    await sleep(PERSIST_DEBOUNCE_MS + 400);
    expect(snapshot(h.dataDir)).toEqual(before);
    expect((await g.post('/api/auth/logout')).status).toBe(204);
    await h.auth.shutdown();
    expect(snapshot(h.dataDir)).toEqual(before);
    expect(fs.readdirSync(h.config.usersDir)).toEqual([]);
    expect(fs.existsSync(h.config.accountsFile)).toBe(false);
    expect(fs.existsSync(h.config.sessionsFile)).toBe(false);
  });

  it('a memory-only vault writes nothing: not on a write, not on persist, not on close', async () => {
    const config = testConfig();
    const account: AccountRecord = {
      id: 'g_0123456789abcdef',
      username: '_guest_test',
      usernameLower: '_guest_test',
      firstName: '',
      lastName: '',
      createdAt: '2026-10-01T00:00:00.000Z',
      kdf: { algorithm: 'scrypt', N: 1024, r: 8, p: 1, saltHex: '11'.repeat(16) },
      verifierHex: '22'.repeat(32),
      dbFile: '',
      guest: true,
    };
    const before = snapshot(config.dataDir);
    const vault = await createMemoryVault(account, Buffer.alloc(32, 9));
    expect(vault.memoryOnly).toBe(true);
    expect(vault.dbPath).toBe('');
    vault.db.run("INSERT INTO settings(key, value) VALUES ('k', 'v')");
    expect(vault.db.onWrite).toBeNull();
    await sleep(PERSIST_DEBOUNCE_MS + 300);
    await vault.persist();
    expect(vault.db.isDirty()).toBe(false);
    await vault.persistIfDirty();
    // No password to change, no file to re-encrypt.
    await expect(vault.rekey(Buffer.alloc(32, 1))).rejects.toMatchObject({ status: 403, key: GUEST_NOT_ALLOWED_KEY });
    expect(vault.db.scalar("SELECT value FROM settings WHERE key = 'k'")).toBe('v');
    await vault.close();
    expect(vault.isClosed).toBe(true);
    expect(snapshot(config.dataDir)).toEqual(before);
    expect(fs.existsSync(path.join(process.cwd(), '.tmp'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), '.prev'))).toBe(false);
  });

  it('a guest session is never a remember-me session and never written to sessions.json', () => {
    const config = testConfig();
    const store = new SessionStore(config.sessionsFile, Buffer.alloc(32, 3));
    const { session } = store.create('g_0123456789abcdef', true, 'Phone', Buffer.alloc(32, 5), { guest: true });
    expect(session).toMatchObject({ guest: true, rememberMe: false });
    expect(store.wrappedKeyOf(session)).toBeNull();
    store.persist();
    const written = JSON.parse(fs.readFileSync(config.sessionsFile, 'utf8')) as { sessions: unknown[] };
    expect(written.sessions).toEqual([]);
    // Next to a real remember-me session only that one is written.
    store.create('u_0123456789abcdef', true, 'PC', Buffer.alloc(32, 6));
    const again = JSON.parse(fs.readFileSync(config.sessionsFile, 'utf8')) as { sessions: Array<{ userId: string }> };
    expect(again.sessions.map((s) => s.userId)).toEqual(['u_0123456789abcdef']);
    store.close();
  });
});

describe('what a guest cannot do', () => {
  it('answers 403 server.auth.guestNotAllowed, in the request language, for everything that needs a real account', async () => {
    const h = await harness();
    const { token } = await startGuest(h, 'he');
    const cases: Array<[string, 'post' | 'put', string, object]> = [
      ['edit profile', 'put', '/api/auth/profile', { firstName: 'Guest' }],
      ['edit e-mail', 'put', '/api/auth/profile', { email: 'guest@example.com', currentPassword: PASSWORD }],
      ['verify password', 'post', '/api/auth/verify-password', { password: PASSWORD }],
      ['lock', 'post', '/api/auth/lock', {}],
      ['change password', 'post', '/api/auth/change-password', { oldPassword: PASSWORD, newPassword: 'NewPass123', confirmPassword: 'NewPass123' }],
      ['delete account', 'post', '/api/auth/delete-account', { password: PASSWORD }],
      ['create backup', 'post', '/api/backup/create', {}],
      ['create backup with a password', 'post', '/api/backup/create', { password: 'Backup12345' }],
      ['inspect backup', 'post', '/api/backup/inspect', { fileBase64: 'TVBESUFSWQ==' }],
      ['restore backup', 'post', '/api/backup/restore', { fileBase64: 'TVBESUFSWQ==', password: PASSWORD }],
    ];
    for (const lang of ['he', 'en', 'ar'] as const) {
      const guest = as(h.local, token, lang);
      for (const [what, method, url, body] of cases) {
        const res = await guest[method](url, body);
        expect({ what, lang, status: res.status, body: res.body }).toEqual({
          what,
          lang,
          status: 403,
          body: { code: 'FORBIDDEN', message: t(lang, GUEST_NOT_ALLOWED_KEY) },
        });
      }
    }
    // Nothing of that locked, changed or ended the tour.
    const me = await as(h.local, token).get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.session.locked).toBeUndefined();
    expect(me.body.user).toMatchObject({ firstName: '', email: '', guest: true });
    expect((await as(h.local, token).get('/api/entries')).status).toBe(200);
  });

  it('never sees or changes the remote-access, mail and phone-access settings (403 with the "not the owner" messages)', async () => {
    const h = await harness();
    const { token } = await startGuest(h, 'en');
    const guest = as(h.local, token);
    const cases: Array<['get' | 'post' | 'put', string, object, string]> = [
      ['get', '/api/server/remote', {}, 'server.remote.notOwner'],
      ['put', '/api/server/remote', { enabled: true, password: PASSWORD }, 'server.remote.notOwner'],
      ['post', '/api/server/remote/renew', {}, 'server.remote.notOwner'],
      ['post', '/api/server/remote/test', {}, 'server.remote.notOwner'],
      ['get', '/api/server/mail', {}, 'server.mail.notOwner'],
      ['put', '/api/server/mail', { enabled: true, host: 'smtp.example.com', password: PASSWORD }, 'server.mail.notOwner'],
      ['post', '/api/server/mail/test', {}, 'server.mail.notOwner'],
      ['put', '/api/server/settings', { lanEnabled: true, password: PASSWORD }, 'server.lan.notOwner'],
    ];
    for (const [method, url, body, key] of cases) {
      const res = method === 'get' ? await guest.get(url) : await guest[method](url, body);
      expect({ url, method, status: res.status, body: res.body }).toEqual({ url, method, status: 403, body: { code: 'FORBIDDEN', message: t('en', key) } });
    }
    // The settings a guest may read carry no owner flag and no remote block - also while no real account exists.
    const view = (await guest.get('/api/server/settings')).body as ServerSettings;
    expect(view).toMatchObject({ isRemoteOwner: false, isMailOwner: false, isLanOwner: false, lanEnabled: false });
    expect('remote' in view).toBe(false);
    expect(h.settings.lanEnabled).toBe(false);
    expect(h.mail.ownerId()).toBe('');
    expect(h.mail.view().enabled).toBe(false);
  });

  it('the service refuses a guest too (not only the routes)', async () => {
    const h = await harness();
    const { token } = await h.auth.startGuest({ language: 'en' });
    const ctx = (await h.auth.authenticate(token))!;
    expect(isGuestContext(ctx)).toBe(true);
    const refused = { status: 403, code: 'FORBIDDEN', key: GUEST_NOT_ALLOWED_KEY };
    await expect(h.auth.changePassword(ctx, 'x', 'NewPass123')).rejects.toMatchObject(refused);
    await expect(h.auth.updateProfile(ctx, { firstName: 'X' })).rejects.toMatchObject(refused);
    await expect(h.auth.deleteAccount(ctx, 'x')).rejects.toMatchObject(refused);
    expect(await h.auth.verifyPassword(ctx.account, PASSWORD)).toBe(false);
    expect(h.auth.setSessionLocked(ctx.session.id, true)).toBe(false);
    expect((await h.auth.authenticate(token))!.session.locked).toBeUndefined();
    await expect(h.auth.resetPassword(ctx.account.id, 'NewPass123')).rejects.toMatchObject({ status: 400 });
    // The mail service accepts no guest as its owner either.
    expect(() => h.mail.update({ enabled: false }, ctx.account.id)).toThrow(expect.objectContaining({ status: 403 }));
    expect(guestNotAllowed().messageFor('en')).toBe('This is not available in tour mode. Create an account to use it.');
    expect(isGuestContext(null)).toBe(false);
    expect(isGuestContext({ account: { guest: undefined }, session: {} })).toBe(false);
  });

  it('the refusal exists in all 20 languages', () => {
    const english = t('en', GUEST_NOT_ALLOWED_KEY);
    for (const locale of LOCALE_CODES) {
      const message = t(locale, GUEST_NOT_ALLOWED_KEY);
      expect(message).not.toBe(GUEST_NOT_ALLOWED_KEY);
      if (locale !== 'en') expect({ locale, translated: message !== english }).toEqual({ locale, translated: true });
    }
  });
});

describe('the owner is the first REAL account', () => {
  it('firstAccountId skips guests, whenever they were created', () => {
    const guest = { id: 'g_0000000000000000', createdAt: '2020-01-01T00:00:00.000Z', guest: true as const };
    const dana = { id: 'u_bbbbbbbbbbbbbbbb', createdAt: '2026-01-01T00:00:00.000Z' };
    const ron = { id: 'u_aaaaaaaaaaaaaaaa', createdAt: '2026-02-01T00:00:00.000Z' };
    expect(firstAccountId([guest])).toBe('');
    expect(firstAccountId([guest, dana, ron])).toBe(dana.id);
    expect(firstAccountId([ron, dana, guest])).toBe(dana.id);
    expect(firstAccountId([dana, ron])).toBe(dana.id);
    expect(firstAccountId([])).toBe('');
  });

  it('a guest before any account: the account registered afterwards is the owner and starts clean', async () => {
    const h = await harness();
    const guest = await startGuest(h, 'en');
    expect(((await as(h.local, guest.token).get('/api/entries')).body as EntryPage).total).toBeGreaterThan(80);
    expect(firstAccountId(h.auth.listAccounts())).toBe('');

    const dana = await register(h, 'dana');
    // Registration ended the tour.
    const old = await as(h.local, guest.token).get('/api/auth/me');
    expect(old.status).toBe(401);
    expect(old.body.code).toBe('SESSION_EXPIRED');
    expect(h.auth.hasGuest).toBe(false);
    expect(h.auth.vaults.get(guest.user.id)).toBeNull();
    // The new account starts clean: none of the demo data, no guest flag.
    const d = as(h.local, dana.token);
    expect(((await d.get('/api/entries')).body as EntryPage).total).toBe(0);
    expect((await d.get('/api/habits')).body).toEqual([]);
    expect(dana.user.guest).toBeUndefined();
    // And it is the owner.
    expect(firstAccountId(h.auth.listAccounts())).toBe(dana.user.id);
    const view = (await d.get('/api/server/settings')).body as ServerSettings;
    expect(view).toMatchObject({ isRemoteOwner: true, isMailOwner: true, isLanOwner: true });
    expect((await d.get('/api/server/mail')).status).toBe(200);
    expect((await d.get('/api/server/remote')).status).toBe(200);
    // The registry holds dana only.
    const registry = JSON.parse(fs.readFileSync(h.config.accountsFile, 'utf8')) as { accounts: Array<{ id: string; username: string }> };
    expect(registry.accounts.map((a) => a.username)).toEqual(['dana']);
    expect((await h.local.get('/api/auth/accounts')).body.accounts.map((a: { username: string }) => a.username)).toEqual(['dana']);
    expect(anyFileContains(h.dataDir, '_guest')).toBe(false);
  });

  it('a guest next to real accounts changes nothing for the owner', async () => {
    const h = await harness();
    const dana = await register(h, 'dana');
    const ron = await register(h, 'ron');
    const guest = await h.auth.startGuest({ language: 'en' });
    expect(h.auth.hasGuest).toBe(true);
    expect(firstAccountId(h.auth.listAccounts())).toBe(dana.user.id);
    expect(h.auth.listAccounts().map((a) => a.username).sort()).toEqual(['dana', 'ron']);
    const owner = (await as(h.local, dana.token).get('/api/server/settings')).body as ServerSettings;
    expect(owner).toMatchObject({ isRemoteOwner: true, isMailOwner: true, isLanOwner: true });
    const other = (await as(h.local, ron.token).get('/api/server/settings')).body as ServerSettings;
    expect(other).toMatchObject({ isRemoteOwner: false, isMailOwner: false, isLanOwner: false });
    expect((await as(h.local, guest.token).get('/api/server/mail')).status).toBe(403);
    expect((await as(h.local, dana.token).get('/api/server/mail')).status).toBe(200);
    // The real diaries are untouched by the tour.
    expect(((await as(h.local, dana.token).get('/api/entries')).body as EntryPage).total).toBe(0);
    expect(((await as(h.local, guest.token).get('/api/entries')).body as EntryPage).total).toBeGreaterThan(80);
  });
});

describe('how a guest ends', () => {
  it('logout drops the guest: the token dies, the record and the diary are gone', async () => {
    const h = await harness();
    const guest = await startGuest(h);
    expect(h.auth.vaults.get(guest.user.id)).not.toBeNull();
    expect((await as(h.local, guest.token).post('/api/auth/logout')).status).toBe(204);
    const after = await as(h.local, guest.token).get('/api/entries');
    expect(after.status).toBe(401);
    expect(after.body.code).toBe('SESSION_EXPIRED');
    expect(h.auth.hasGuest).toBe(false);
    expect(h.auth.vaults.get(guest.user.id)).toBeNull();
    expect(h.auth.vaults.size).toBe(0);
    expect(h.auth.listSessions(guest.user.id)).toEqual([]);
  });

  it('revoking its session ends it as well', async () => {
    const h = await harness();
    const guest = await startGuest(h);
    const g = as(h.local, guest.token);
    const sessions = (await g.get('/api/auth/sessions')).body as SessionInfo[];
    expect((await g.del(`/api/auth/sessions/${sessions[0].id}`)).status).toBe(204);
    await sleep(50);
    expect((await g.get('/api/auth/me')).status).toBe(401);
    expect(h.auth.hasGuest).toBe(false);
    expect(h.auth.vaults.size).toBe(0);
  });

  it('a new guest replaces the previous one (at most one at a time), also when started concurrently', async () => {
    const h = await harness();
    const first = await startGuest(h);
    const second = await startGuest(h);
    expect(second.user.id).not.toBe(first.user.id);
    expect(second.user.username).not.toBe(first.user.username);
    expect((await as(h.local, first.token).get('/api/auth/me')).status).toBe(401);
    expect((await as(h.local, second.token).get('/api/auth/me')).status).toBe(200);
    expect(h.auth.vaults.get(first.user.id)).toBeNull();
    expect(h.auth.vaults.size).toBe(1);

    const burst = await Promise.all([startGuest(h), startGuest(h), startGuest(h)]);
    const alive = [];
    for (const g of burst) alive.push((await as(h.local, g.token).get('/api/auth/me')).status);
    expect(alive.filter((s) => s === 200)).toHaveLength(1);
    expect(alive.filter((s) => s === 401)).toHaveLength(2);
    expect(h.auth.vaults.size).toBe(1);
  });

  it('a real sign-in ends the guest; a wrong password does not', async () => {
    const h = await harness();
    const dana = await register(h, 'dana');
    expect((await as(h.local, dana.token).post('/api/auth/logout')).status).toBe(204);
    const guest = await startGuest(h);

    const wrong = await h.local.post('/api/auth/login').send({ username: 'dana', password: 'Wrong12345' });
    expect(wrong.status).toBe(401);
    expect(h.auth.hasGuest).toBe(true);
    expect((await as(h.local, guest.token).get('/api/auth/me')).status).toBe(200);

    const login = await h.local.post('/api/auth/login').send({ username: 'dana', password: PASSWORD });
    expect(login.status).toBe(200);
    expect((login.body as AuthResponse).guest).toBeUndefined();
    expect(h.auth.hasGuest).toBe(false);
    expect((await as(h.local, guest.token).get('/api/auth/me')).status).toBe(401);
    expect(h.auth.vaults.get(guest.user.id)).toBeNull();
    // Dana's own diary is what is open now.
    expect(((await as(h.local, (login.body as AuthResponse).token).get('/api/entries')).body as EntryPage).total).toBe(0);
  });

  it('a failed registration does not end the guest; a successful one does', async () => {
    const h = await harness();
    await register(h, 'dana');
    const guest = await startGuest(h);
    const taken = await h.local
      .post('/api/auth/register')
      .send({ firstName: 'D', lastName: 'C', username: 'dana', email: 'other@example.com', password: PASSWORD, confirmPassword: PASSWORD });
    expect(taken.status).toBe(409);
    expect(h.auth.hasGuest).toBe(true);
    expect((await as(h.local, guest.token).get('/api/auth/me')).status).toBe(200);
    await register(h, 'ron');
    expect(h.auth.hasGuest).toBe(false);
    expect((await as(h.local, guest.token).get('/api/auth/me')).status).toBe(401);
  });

  it('the guest session expires like a regular one, and the guest goes with it', async () => {
    let now = new Date('2026-10-01T10:00:00.000Z');
    const h = await harness({ now: () => now });
    const guest = await h.auth.startGuest({ language: 'en' });
    expect(Date.parse(guest.session.expiresAt)).toBe(now.getTime() + SESSION_TTL_HOURS * 3_600_000);
    now = new Date(now.getTime() + (SESSION_TTL_HOURS - 1) * 3_600_000);
    expect(await h.auth.authenticate(guest.token)).not.toBeNull();
    now = new Date(now.getTime() + 2 * 3_600_000);
    expect(await h.auth.authenticate(guest.token)).toBeNull();
    await sleep(50);
    expect(h.auth.hasGuest).toBe(false);
    expect(h.auth.vaults.size).toBe(0);
  });

  it('a server stop drops the guest: nothing of it survives a restart', async () => {
    const h = await harness();
    const dana = await register(h, 'dana', true);
    const guest = await startGuest(h);
    await h.auth.shutdown();
    expect(h.auth.hasGuest).toBe(false);
    expect(await h.auth.authenticate(guest.token)).toBeNull();

    const restarted = await harness({ dataDir: h.dataDir });
    expect(await restarted.auth.authenticate(guest.token)).toBeNull();
    expect(restarted.auth.hasGuest).toBe(false);
    expect(restarted.auth.listAccounts().map((a) => a.username)).toEqual(['dana']);
    // The real remember-me session is still there.
    expect((await as(restarted.local, dana.token).get('/api/auth/me')).status).toBe(200);
    expect((await as(restarted.local, guest.token).get('/api/auth/me')).status).toBe(401);
    // A guest cannot be started on a stopped service.
    await expect(h.auth.startGuest({})).rejects.toMatchObject({ status: 401 });
  });
});
