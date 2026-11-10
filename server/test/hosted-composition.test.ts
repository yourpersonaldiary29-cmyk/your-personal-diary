/**
 * WP-H3 (docs/HOSTED-PLAN.md Part B 2.3-2.5, 3.2, 3.6): the hosted composition (`startHosted`) on
 * a temporary data directory, driven by environment values only.
 *
 *   - boots on one plain listener; `GET /api/server/info` over a plain socket with the public Host
 *     is 200 (finding 2); health carries the hosted extras; the strict path answers for the monitor;
 *   - remote routes 403, LAN switch 403, account list 403, disk paths 400;
 *   - the tour (docs/android-tasks/HOSTED-IMPL.md item 9) is public under its limits - a cap of
 *     concurrent guests, tours per bucket and hour, a lifetime - persists nothing, and a real
 *     sign-in ends nobody's tour; DIARY_MAX_GUESTS=0 unmounts it (404);
 *   - the owner is DIARY_OWNER_ID only: unset -> 403 'server.owner.unset' for the first account too;
 *     set -> 200 for that id over HTTPS, 403 for a second account and for plain HTTP; the owner
 *     deletes his account -> the remaining account still gets 403 and the mail secret is gone;
 *     a stale id -> 403;
 *   - the Mail card works from anywhere for the owner and the reset link points at the public URL;
 *   - the quota refuses the write that would exceed it (reads and deletions continue) and a restore
 *     of a larger file; the device key comes from DIARY_DEVICE_KEY and never touches the disk;
 *   - hashed assets are cacheable, index.html is not.
 * Fictional users, TEST-NET addresses and a capturing SMTP fake only.
 */
import fs from 'node:fs';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import type { AuthResponse, HealthStatus, ServerInfo, ServerSettings, ServerStatus } from '@shared/types';
import { loadConfig, loadHostedEnv } from '../src/config';
import { startHosted, type HostedStartOptions, type RunningHosted } from '../src/hosted';
import { OWNER_UNSET_KEY } from '../src/hosted/owner';
import { TOO_MANY_GUESTS_KEY } from '../src/hosted/policy';
import type { SmtpTransport } from '../src/mail/transport';
import { QUOTA_KEY } from '../src/middleware/quota';
import { GUEST_NOT_ALLOWED_KEY, GUESTS_FULL_KEY } from '../src/security/guest';
import { cleanupTempDirs, sampleEntry, tempDataDir } from './helpers';

const PASSWORD = 'Passw0rd!';
const FAST = { kdf: { N: 1024, r: 8, p: 1 } };
const HOST = 'diary.example';
const running: RunningHosted[] = [];

afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

interface BootOptions {
  dataDir?: string;
  env?: Record<string, string>;
  start?: HostedStartOptions;
  staticDir?: string;
}

async function boot(o: BootOptions = {}) {
  const dataDir = o.dataDir ?? tempDataDir();
  const env = loadHostedEnv({ DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: `https://${HOST}`, DIARY_BIND: '127.0.0.1', ...o.env });
  const argv = ['--data-dir', dataDir, ...(o.staticDir ? ['--static', o.staticDir] : [])];
  const config = loadConfig(argv, { DIARY_MODE: 'hosted' });
  const srv = await startHosted(config, env, { port: 0, quiet: true, auth: FAST, ...o.start });
  running.push(srv);
  const agent = supertest(srv.localUrl);
  type Req = ReturnType<typeof agent.get>;
  const common = (r: Req, secure: boolean) => {
    r.set('Host', HOST).set('Accept-Language', 'en');
    return secure ? r.set('X-Forwarded-Proto', 'https') : r;
  };
  const anon = (secure = true, ip = '203.0.113.9') => ({
    get: (url: string) => common(agent.get(url), secure).set('X-Forwarded-For', ip),
    post: (url: string, body: object = {}) => common(agent.post(url), secure).set('X-Forwarded-For', ip).send(body),
    put: (url: string, body: object = {}) => common(agent.put(url), secure).set('X-Forwarded-For', ip).send(body),
  });
  const as = (token: string, secure = true) => ({
    get: (url: string) => common(agent.get(url), secure).set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object = {}) => common(agent.post(url), secure).set('Authorization', `Bearer ${token}`).send(body),
    put: (url: string, body: object = {}) => common(agent.put(url), secure).set('Authorization', `Bearer ${token}`).send(body),
    delete: (url: string) => common(agent.delete(url), secure).set('Authorization', `Bearer ${token}`),
  });
  return { srv, agent, anon, as, dataDir, config, env };
}

function registerBody(username: string, extra: object = {}) {
  // A hosted server creates no account without the privacy checkbox (docs/android-tasks/PRIVACY-CHECKBOX.md).
  return { firstName: 'Test', lastName: 'User', username, email: `${username}@example.com`, password: PASSWORD, confirmPassword: PASSWORD, privacyAccepted: true, termsAccepted: true, ...extra };
}

async function stop(srv: RunningHosted): Promise<void> {
  running.splice(running.indexOf(srv), 1);
  await srv.stop();
}

describe('startHosted: boot, health and the public-only surface', () => {
  it('boots from env + a data dir, answers the public Host over a plain socket, and has the hosted health extras', async () => {
    const { srv, anon, agent, dataDir } = await boot();
    expect(srv.port).toBeGreaterThan(0);
    expect(srv.env.publicUrl).toBe(`https://${HOST}`);
    // Plain socket, public Host, no forwarded headers (finding 2): the LAN guard is gone.
    const info = await agent.get('/api/server/info').set('Host', HOST);
    expect(info.status).toBe(200);
    const body = info.body as ServerInfo;
    expect(body).toMatchObject({ mode: 'hosted', publicUrl: `https://${HOST}`, isLocalRequest: false, secure: false, dataDir: '', lanUrls: [], lanEnabled: false, remoteEnabled: false, remoteUrl: '', storageOk: true, registration: 'open', passwordResetAvailable: false });
    expect((await anon().get('/api/server/info')).body).toMatchObject({ secure: true, remoteUrl: `https://${HOST}` });
    // Health: hosted extras; exempt from the Host check; strict answers 200 while storage is fine.
    const health = await agent.get('/api/health').set('Host', 'healthcheck.internal');
    expect(health.status).toBe(200);
    const h = health.body as HealthStatus;
    expect(h).toMatchObject({ ok: true, mode: 'hosted', storage: 'ok' });
    expect(typeof h.uptimeSec).toBe('number');
    expect(h.freePct === null || (typeof h.freePct === 'number' && h.freePct >= 0 && h.freePct <= 100)).toBe(true);
    expect((await anon().get('/api/health/strict')).status).toBe(200);
    expect((await agent.get('/api/health/strict').set('Host', 'healthcheck.internal')).status).toBe(421);
    expect((await agent.get('/api/server/info').set('Host', 'evil.example')).status).toBe(421);
    // No device key file is created unless the file is the key's source; no LAN, no remote files.
    expect(fs.existsSync(path.join(dataDir, 'device.key'))).toBe(true);
    expect(fs.existsSync(path.join(dataDir, 'tls'))).toBe(false);
  });

  it('remote routes 403, LAN switch 403, account list 403, disk paths 400', async () => {
    const { anon, as } = await boot();
    const reg = await anon().post('/api/auth/register', registerBody('ownertest'));
    expect(reg.status).toBe(201);
    const me = as((reg.body as AuthResponse).token);
    expect((await anon().get('/api/auth/accounts')).status).toBe(403);
    const remote = await me.get('/api/server/remote');
    expect(remote.status).toBe(403);
    expect(remote.body.message).toBe(t('en', 'server.remote.unavailable'));
    expect((await me.put('/api/server/remote', { enabled: true, password: PASSWORD })).status).toBe(403);
    expect((await me.post('/api/server/remote/renew')).status).toBe(403);
    const lan = await me.put('/api/server/settings', { lanEnabled: true, password: PASSWORD });
    expect(lan.status).toBe(403);
    expect(lan.body.message).toBe(t('en', 'server.server.settingsLocalOnly'));
    const settings = (await me.get('/api/server/settings')).body as ServerSettings;
    expect(settings).toMatchObject({ lanEnabled: false, isRemoteOwner: false, isLanOwner: false, isMailOwner: false });
    expect('remote' in settings).toBe(false);
    for (const [url, body, field] of [
      ['/api/backup/create', { destPath: 'C:\\Users\\someone\\diary.mpd' }, 'destPath'],
      ['/api/backup/inspect', { srcPath: '/etc/passwd' }, 'srcPath'],
      ['/api/backup/restore', { srcPath: '/data/users/x.mpd', password: PASSWORD }, 'srcPath'],
      ['/api/export', { format: 'txt', destPath: '/data/out.txt' }, 'destPath'],
    ] as Array<[string, object, string]>) {
      const res = await me.post(url, body);
      expect({ url, status: res.status, code: res.body.code, field: res.body.field }).toEqual({ url, status: 400, code: 'VALIDATION', field });
    }
    // Downloads (no path) still work.
    expect((await me.post('/api/backup/create', {})).status).toBe(200);
    expect((await me.post('/api/export', { format: 'txt' })).status).toBe(200);
    expect((await me.get('/api/settings/data-dir')).body).toMatchObject({ dataDir: '', dbPath: '' });
  });
});

describe('the tour on the server (docs/android-tasks/HOSTED-IMPL.md item 9)', () => {
  it('is public under its limits: a cap of concurrent guests (503), tours per bucket and hour (429), nothing persisted, a real sign-in ends nobody’s tour', async () => {
    // Buckets follow X-Forwarded-For here (the platform header); without the variable every caller
    // would share the socket's loopback bucket.
    const { srv, anon, as, dataDir } = await boot({ env: { DIARY_MAX_GUESTS: '2', DIARY_GUESTS_PER_HOUR: '3', DIARY_CLIENT_IP_HEADER: 'x-forwarded-for' } });
    expect(((await anon().get('/api/server/info')).body as ServerInfo).guestTour).toBe(true);
    const a = anon(true, '203.0.113.9');
    const b = anon(true, '198.51.100.7');
    const c = anon(true, '192.0.2.44');
    // Two visitors from two networks; a guest works on its demo diary and stays a guest.
    const g1 = await a.post('/api/auth/guest', { language: 'en' });
    expect(g1.status).toBe(201);
    expect((g1.body as AuthResponse).guest).toBe(true);
    const visitor1 = as((g1.body as AuthResponse).token);
    expect((await visitor1.get('/api/auth/me')).status).toBe(200);
    expect((await visitor1.post('/api/entries', sampleEntry())).status).toBe(201);
    const changePw = await visitor1.post('/api/auth/change-password', { currentPassword: PASSWORD, newPassword: 'An0therPass!', confirmPassword: 'An0therPass!' });
    expect(changePw.status).toBe(403);
    expect(changePw.body.message).toBe(t('en', GUEST_NOT_ALLOWED_KEY));
    const g2 = await b.post('/api/auth/guest');
    expect(g2.status).toBe(201);
    expect(srv.auth.guestCount).toBe(2);
    // The cap: a third visitor is asked to come back (503 + Retry-After); the refusal counts as his attempt.
    const full = await c.post('/api/auth/guest');
    expect(full.status).toBe(503);
    expect(full.headers['retry-after']).toBe('120');
    expect(full.body.message).toBe(t('en', GUESTS_FULL_KEY));
    // A real registration from yet another network ends nobody's tour (a phone would end its one guest).
    expect((await anon(true, '203.0.113.77').post('/api/auth/register', registerBody('visitor'))).status).toBe(201);
    expect(srv.auth.guestCount).toBe(2);
    expect((await visitor1.get('/api/auth/me')).status).toBe(200);
    // Logout frees the slot.
    expect((await as((g2.body as AuthResponse).token).post('/api/auth/logout')).status).toBeLessThan(300);
    expect(srv.auth.guestCount).toBe(1);
    expect((await c.post('/api/auth/guest')).status).toBe(201);
    // Per bucket: attempts count whatever their outcome - the 4th from one address within an hour is 429.
    expect((await a.post('/api/auth/guest')).status).toBe(503);
    expect((await a.post('/api/auth/guest')).status).toBe(503);
    const limited = await a.post('/api/auth/guest');
    expect(limited.status).toBe(429);
    expect(limited.body.message).toBe(t('en', TOO_MANY_GUESTS_KEY));
    // Nothing of any guest reached the volume: no guest account, session or diary file.
    expect(fs.readFileSync(path.join(dataDir, 'accounts.json'), 'utf8')).not.toMatch(/"g_|_guest/);
    const sessionsFile = path.join(dataDir, 'sessions.json');
    if (fs.existsSync(sessionsFile)) expect(fs.readFileSync(sessionsFile, 'utf8')).not.toMatch(/"guest"|"g_/);
    expect(fs.readdirSync(path.join(dataDir, 'users')).filter((f) => f.startsWith('g_'))).toEqual([]);
  });

  it('a tour ends by itself after its lifetime; DIARY_MAX_GUESTS=0 turns the route off (404, guestTour false)', async () => {
    const { srv, anon, as } = await boot({ env: { DIARY_MAX_GUESTS: '5' }, start: { auth: { ...FAST, guests: { max: 5, lifetimeMs: 300 } } } });
    const g = await anon().post('/api/auth/guest');
    expect(g.status).toBe(201);
    const visitor = as((g.body as AuthResponse).token);
    expect((await visitor.get('/api/auth/me')).status).toBe(200);
    expect(srv.auth.guestCount).toBe(1);
    await new Promise((r) => setTimeout(r, 700));
    expect(srv.auth.guestCount).toBe(0);
    expect((await visitor.get('/api/auth/me')).status).toBe(401);
    const off = await boot({ env: { DIARY_MAX_GUESTS: '0' } });
    expect((await off.anon().post('/api/auth/guest')).status).toBe(404);
    expect(((await off.anon().get('/api/server/info')).body as ServerInfo).guestTour).toBe(false);
  });
});

describe('the owner is DIARY_OWNER_ID and nothing else (finding 6)', () => {
  it('unset: 403 server.owner.unset for the first account; set: 200 for that id over HTTPS only, 403 for others', async () => {
    let ownerId = '';
    const logs: string[] = [];
    const { anon, as } = await boot({ start: { ownerId: () => ownerId, log: (l) => logs.push(l) } });
    const first = (await anon().post('/api/auth/register', registerBody('ownertest'))).body as AuthResponse;
    const second = (await anon(true, '203.0.113.10').post('/api/auth/register', registerBody('othertest'))).body as AuthResponse;
    const owner = as(first.token);
    const other = as(second.token);
    // (a) no owner configured: nobody owns anything - not even the first account.
    for (const url of ['/api/server/mail', '/api/server/status']) {
      const res = await owner.get(url);
      expect({ url, status: res.status, message: res.body.message }).toEqual({ url, status: 403, message: t('en', OWNER_UNSET_KEY) });
    }
    expect((await owner.get('/api/server/settings')).body.isMailOwner).toBe(false);
    expect(logs.some((l) => l.includes('DIARY_OWNER_ID is not set'))).toBe(true);
    // (b) the owner is configured.
    ownerId = first.user.id;
    expect((await owner.get('/api/server/mail')).status).toBe(200);
    const status = await owner.get('/api/server/status');
    expect(status.status).toBe(200);
    const s = status.body as ServerStatus;
    expect(s).toMatchObject({ mode: 'hosted', publicUrl: `https://${HOST}`, accounts: 2, maxAccounts: 300, registrationsLast24h: 2, registration: 'open', maxDiaryBytes: 10 * 1024 * 1024, storageOk: true, openVaults: 2, lastArchiveAt: null });
    expect(s.liveSessions).toBeGreaterThanOrEqual(2);
    expect(s.rssBytes).toBeGreaterThan(0);
    expect(s.disk === null || (s.disk.freePct >= 0 && s.disk.totalBytes > 0)).toBe(true);
    expect(typeof s.lastPersistAt).toBe('string');
    expect((await owner.get('/api/server/settings')).body).toMatchObject({ isMailOwner: true, isRemoteOwner: false, isLanOwner: false });
    expect((await other.get('/api/server/settings')).body.isMailOwner).toBe(false);
    expect((await other.get('/api/server/mail')).status).toBe(403);
    expect((await other.get('/api/server/status')).status).toBe(403);
    // Owner routes need the TLS edge: the same owner over plain HTTP is refused.
    expect((await as(first.token, false).get('/api/server/mail')).status).toBe(403);
    expect((await as(first.token, false).get('/api/server/status')).status).toBe(403);
    // (d) a stale id (no such account) -> 403 for everyone, with a log line.
    ownerId = 'u_00000000deadbeef';
    expect((await owner.get('/api/server/mail')).status).toBe(403);
    expect((await owner.get('/api/server/mail')).body.message).toBe(t('en', OWNER_UNSET_KEY));
  });

  it('ServerInfo.ownerConfigured follows DIARY_OWNER_ID live: unset -> false, a missing id -> false, an existing id -> true; nothing else moves', async () => {
    let ownerId = '';
    const { anon } = await boot({ start: { ownerId: () => ownerId } });
    const infoNow = async () => (await anon().get('/api/server/info')).body as ServerInfo;
    const butOwner = ({ ownerConfigured: _o, ...rest }: ServerInfo) => rest;
    // (a) unset: the bootstrap state - the Account card shows the id to every signed-in user.
    const unset = await infoNow();
    expect(unset.ownerConfigured).toBe(false);
    expect(unset).toMatchObject({ mode: 'hosted', publicUrl: `https://${HOST}` });
    const first = (await anon().post('/api/auth/register', registerBody('ownertest'))).body as AuthResponse;
    // (b) an id that names no account is as good as none.
    ownerId = 'u_00000000deadbeef';
    expect((await infoNow()).ownerConfigured).toBe(false);
    // (c) the id of an existing account: read on this request (the gate), not remembered from start-up.
    ownerId = first.user.id;
    const set = await infoNow();
    expect(set.ownerConfigured).toBe(true);
    // Public and unauthenticated, over plain HTTP as well.
    expect(((await anon(false).get('/api/server/info')).body as ServerInfo).ownerConfigured).toBe(true);
    // No other field of ServerInfo changed with it.
    expect(butOwner(set)).toEqual(butOwner(unset));
    // (d) and back: false again without a restart.
    ownerId = '';
    expect((await infoNow()).ownerConfigured).toBe(false);
  });

  it('the owner configures mail from anywhere; the reset link points at the public URL; deleting the owner clears the secret and promotes nobody', async () => {
    const sent: Array<{ to: string; data: string }> = [];
    const transport: SmtpTransport = { send: async (_opts, envelope, data) => void sent.push({ to: envelope.to, data }) };
    let ownerId = '';
    const { srv, anon, as } = await boot({ start: { ownerId: () => ownerId, mailTransport: transport } });
    const first = (await anon().post('/api/auth/register', registerBody('ownertest'))).body as AuthResponse;
    const second = (await anon(true, '203.0.113.10').post('/api/auth/register', registerBody('othertest'))).body as AuthResponse;
    ownerId = first.user.id;
    const owner = as(first.token);
    const saved = await owner.put('/api/server/mail', {
      enabled: true,
      host: 'smtp.example.net',
      port: 465,
      security: 'tls',
      username: 'diary@example.net',
      smtpPassword: 'fictional-app-password',
      fromAddress: 'diary@example.net',
      password: PASSWORD,
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ ready: true, smtpPasswordSet: true, hasOwner: true });
    expect(srv.mail.ownerId()).toBe(first.user.id);
    expect((await anon().get('/api/server/info')).body.passwordResetAvailable).toBe(true);
    // Forgot-password from a stranger's network: the mail carries the public reset link.
    const forgot = await anon(true, '198.51.100.7').post('/api/auth/forgot-password', { email: 'othertest@example.com' });
    expect(forgot.status).toBe(200);
    await srv.passwordReset.idle();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe('othertest@example.com');
    // The MIME parts are base64: decode them before looking for the link.
    const decoded = sent[0].data
      .split(/\r?\n/)
      .filter((line) => /^[A-Za-z0-9+/]+=*$/.test(line) && line.length >= 40)
      .map((line) => Buffer.from(line, 'base64').toString('utf8'))
      .join('');
    expect(decoded).toContain(`https://${HOST}/#/reset-password?token=`);
    expect(decoded).not.toContain('127.0.0.1');
    expect(sent[0].data).not.toContain('127.0.0.1');
    // (c) the owner deletes his account: the oldest remaining account still gets 403, the secret is gone.
    expect((await owner.post('/api/auth/delete-account', { password: PASSWORD })).status).toBe(204);
    const other = as(second.token);
    expect((await other.get('/api/server/mail')).status).toBe(403);
    expect((await other.get('/api/server/mail')).body.message).toBe(t('en', OWNER_UNSET_KEY));
    expect((await other.get('/api/server/settings')).body.isMailOwner).toBe(false);
    expect(srv.mail.ownerId()).toBe('');
    expect(srv.mail.view()).toMatchObject({ enabled: false, smtpPasswordSet: false, username: '' });
    expect((await anon().get('/api/server/info')).body.passwordResetAvailable).toBe(false);
  });

  it('mail settings stored by somebody who is not the configured owner are cleared at start', async () => {
    const dataDir = tempDataDir();
    let ownerId = '';
    const first = await boot({ dataDir, start: { ownerId: () => ownerId } });
    const a = (await first.anon().post('/api/auth/register', registerBody('ownertest'))).body as AuthResponse;
    const b = (await first.anon(true, '203.0.113.10').post('/api/auth/register', registerBody('othertest'))).body as AuthResponse;
    ownerId = a.user.id;
    expect((await first.as(a.token).put('/api/server/mail', { enabled: false, host: 'smtp.example.net', username: 'diary@example.net', smtpPassword: 'fictional', password: PASSWORD })).status).toBe(200);
    expect(first.srv.mail.ownerId()).toBe(a.user.id);
    await stop(first.srv);
    // The variable now names the other account: the first account's mail settings must not follow.
    const second = await boot({ dataDir, start: { ownerId: () => b.user.id } });
    expect(second.srv.mail.ownerId()).toBe('');
    expect(second.srv.mail.view().smtpPasswordSet).toBe(false);
    const login = await second.anon().post('/api/auth/login', { username: 'othertest', password: PASSWORD });
    expect(login.status).toBe(200);
    expect((await second.as(login.body.token).get('/api/server/mail')).status).toBe(200);
  });
});

describe('quota and device key', () => {
  it('refuses the write that would exceed the quota (507), keeps reads and deletions, refuses a larger restore (413)', async () => {
    const { anon, as } = await boot({ env: { DIARY_MAX_DIARY_BYTES: String(64 * 1024) } });
    const reg = (await anon().post('/api/auth/register', registerBody('ownertest'))).body as AuthResponse;
    const me = as(reg.token);
    let refused: { status: number; body: { code: string; message: string } } | null = null;
    const ids: number[] = [];
    for (let i = 0; i < 200 && !refused; i++) {
      const res = await me.post('/api/entries', sampleEntry({ title: `entry ${i}`, body: 'x'.repeat(1500) }));
      if (res.status === 201) ids.push(res.body.id);
      else refused = res;
    }
    expect(refused).not.toBeNull();
    expect(refused!.status).toBe(507);
    expect(refused!.body).toEqual({ code: 'IO', message: t('en', QUOTA_KEY, { max: 1 }) });
    expect(ids.length).toBeGreaterThan(3);
    // Reads, exports, backups and deletions keep working; another write is still refused.
    expect((await me.get('/api/entries')).status).toBe(200);
    expect((await me.get(`/api/entries/${ids[0]}`)).status).toBe(200);
    expect((await me.post('/api/backup/create', {})).status).toBe(200);
    expect((await me.delete(`/api/entries/${ids[0]}`)).status).toBe(204);
    expect((await me.put(`/api/entries/${ids[1]}`, sampleEntry({ title: 'renamed' }))).status).toBe(507);
    expect((await me.post('/api/habits', { name: 'Walk', description: '', target: 1, unit: 'x', frequency: 'daily', reminderTime: null, reminderEnabled: false })).status).toBe(507);
    // A backup larger than the quota is refused before it is decoded.
    const big = Buffer.alloc(80 * 1024, 7).toString('base64');
    const restore = await me.post('/api/backup/restore', { fileBase64: big, fileName: 'big.mpd', password: PASSWORD });
    expect(restore.status).toBe(413);
    expect(restore.body.code).toBe('BACKUP');
    expect((await me.post('/api/backup/inspect', { fileBase64: big, fileName: 'big.mpd' })).status).toBe(413);
    // A small (invalid) file passes the quota guard and fails on content, as before.
    const small = await me.post('/api/backup/inspect', { fileBase64: Buffer.alloc(100, 1).toString('base64'), fileName: 'small.mpd' });
    expect(small.status).toBe(200);
    expect(small.body.valid).toBe(false);
  });

  it('DIARY_DEVICE_KEY replaces device.key: nothing is written to the volume, remember-me survives a restart with the same key and not with another', async () => {
    const dataDir = tempDataDir();
    const keyA = Buffer.alloc(32, 0xa1).toString('base64');
    const keyB = Buffer.alloc(32, 0xb2).toString('base64');
    const first = await boot({ dataDir, env: { DIARY_DEVICE_KEY: keyA } });
    const reg = await first.anon().post('/api/auth/register', registerBody('ownertest', { rememberMe: true }));
    expect(reg.status).toBe(201);
    const token = (reg.body as AuthResponse).token;
    expect((await first.as(token).post('/api/entries', sampleEntry({ title: 'kept' }))).status).toBe(201);
    await stop(first.srv);
    expect(fs.existsSync(path.join(dataDir, 'device.key'))).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'sessions.json'))).toBe(true);
    expect(fs.readFileSync(path.join(dataDir, 'sessions.json'), 'utf8')).not.toContain(keyA);

    const same = await boot({ dataDir, env: { DIARY_DEVICE_KEY: keyA } });
    const entries = await same.as(token).get('/api/entries');
    expect(entries.status).toBe(200);
    expect(entries.body.items.map((e: { title: string }) => e.title)).toEqual(['kept']);
    await stop(same.srv);
    expect(fs.existsSync(path.join(dataDir, 'device.key'))).toBe(false);

    // Another key: the remembered session cannot reopen the diary (sign in again); the password still works.
    const other = await boot({ dataDir, env: { DIARY_DEVICE_KEY: keyB } });
    expect((await other.as(token).get('/api/entries')).status).toBe(401);
    const login = await other.anon().post('/api/auth/login', { username: 'ownertest', password: PASSWORD });
    expect(login.status).toBe(200);
    expect((await other.as(login.body.token).get('/api/entries')).body.items.length).toBe(1);
    // A 16-byte key is refused at configuration time, before anything starts.
    expect(() => loadHostedEnv({ DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: `https://${HOST}`, DIARY_DEVICE_KEY: Buffer.alloc(16, 1).toString('base64') })).toThrow(/DIARY_DEVICE_KEY/);
  });
});

describe('static files of the web client', () => {
  it('serves hashed assets as immutable and index.html as no-cache; deep links fall back to index.html', async () => {
    const staticDir = tempDataDir();
    fs.mkdirSync(path.join(staticDir, 'assets'));
    fs.writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>Your Personal Diary</title>');
    fs.writeFileSync(path.join(staticDir, 'assets', 'index-Bq3kZ9xw.js'), 'console.log(1)');
    fs.writeFileSync(path.join(staticDir, 'manifest.webmanifest'), '{}');
    const { anon } = await boot({ staticDir });
    const asset = await anon().get('/assets/index-Bq3kZ9xw.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    const index = await anon().get('/');
    expect(index.status).toBe(200);
    expect(index.headers['cache-control']).toBe('no-cache');
    expect(index.text).toContain('Your Personal Diary');
    expect((await anon().get('/manifest.webmanifest')).headers['cache-control']).toBe('no-cache');
    const deep = await anon().get('/reset-password');
    expect(deep.status).toBe(200);
    expect(deep.text).toContain('Your Personal Diary');
    expect((await anon().get('/api/no-such-route')).status).toBe(404);
  });
});
