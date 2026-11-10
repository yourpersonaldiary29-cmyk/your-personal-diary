/**
 * The loopback admin API of a hosted server (server/src/routes/admin.ts, hosted/admin-token.ts;
 * docs/HOSTED-PLAN.md 3.10, docs/android-tasks/ADMIN-TOOL.md items 1 and 5).
 *
 *   - the gate: only a loopback SOCKET with this boot's token and no proxy headers is admitted; every
 *     other request - a non-loopback socket (the proxy's private address), loopback with X-Forwarded-For
 *     / Fly-Client-IP / Forwarded / Via, no token, a wrong token, the token in another header - gets
 *     exactly the answer of the same request to a server without the admin API (404, or 421 for a
 *     foreign Host), and changes nothing;
 *   - the token file: written at start (port, 64-hex token, mode 0600 on POSIX), rotated at every start,
 *     removed at a clean stop, DIARY_ADMIN_TOKEN_FILE honoured, a write failure leaves the server up
 *     with the admin API closed, never part of a server archive;
 *   - deletion parity: the operator's deletion removes exactly what the account's own deletion removes
 *     (diary .mpd/.prev/.tmp, every session, the reset records, the lockout and reset-code counters, the
 *     record) and releases the owner's mail settings the same way - deleting the configured owner
 *     promotes nobody - while other accounts and their files stay byte for byte;
 *   - unlock resets the per-account counters (sign-in lock of a network, the progressive delay, the
 *     confirmation lock, the reset-code counter); revoke signs out every device and keeps the diary;
 *   - list / find / status never carry anything of a diary, names or key material; find is exact;
 *   - the log gets one line per action and no username, address or id.
 * Fictional accounts, TEST-NET addresses and a capturing SMTP fake only.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import type http from 'node:http';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import type { AuthResponse } from '@shared/types';
import { createApp, type AppDeps } from '../src/app';
import { loadConfig, loadHostedEnv } from '../src/config';
import { startHosted, type HostedStartOptions, type RunningHosted } from '../src/hosted';
import { ADMIN_TOKEN_FILE_NAME, AdminToken } from '../src/hosted/admin-token';
import { isArchivedPath } from '../src/hosted/archive';
import { OWNER_UNSET_KEY } from '../src/hosted/owner';
import type { SmtpTransport } from '../src/mail/transport';
import { adminRouter, hasProxyHeaders, isLoopbackSocketAddress, type AdminAccount } from '../src/routes/admin';
import { createAuthService, type DiaryAuthService } from '../src/security/auth-service';
import { cleanupTempDirs, sampleEntry, tempDataDir, testConfig, testHostedOptions } from './helpers';

const HOST = 'diary.example';
const PASSWORD = 'Passw0rd!';
const FAST = { N: 1024, r: 8, p: 1 };
const INSERT_ENTRY = `INSERT INTO entries(date, time, title, body, created_at, updated_at) VALUES ('2026-09-08', '09:00', 'x', '', 'x', 'x')`;
/** The fields an operator may see of an account - nothing else, ever. */
const ADMIN_FIELDS = ['createdAt', 'diaryBytes', 'email', 'id', 'lastLoginAt', 'locked', 'open', 'sessions', 'username'];

const running: RunningHosted[] = [];
const services: DiaryAuthService[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
  for (const s of services.splice(0)) await s.shutdown();
});
afterAll(cleanupTempDirs);

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
const sha256 = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const registerBody = (username: string, extra: object = {}) => ({
  firstName: 'Test',
  lastName: 'User',
  username,
  email: `${username}@example.com`,
  password: PASSWORD,
  confirmPassword: PASSWORD,
  privacyAccepted: true,
  termsAccepted: true,
  ...extra,
});

// The gate, on an app built by hand -------------------------------------------------------------

/** The response without its Date header: what "the same answer" means. */
function shape(res: supertest.Response) {
  const { date: _date, ...headers } = res.headers as Record<string, string>;
  return { status: res.status, headers, text: res.text };
}

/**
 * Two apps over one account service and one data directory: with the admin API and without it (where
 * /api/admin/* simply does not exist). `socket.address` pretends the TCP peer was that address (the
 * platform proxy's private address, a public client); undefined = the real loopback socket of supertest.
 */
async function gateApps() {
  const config = testConfig();
  const auth = await createAuthService(config, { kdf: FAST });
  services.push(auth);
  const tokenFile = path.join(config.dataDir, ADMIN_TOKEN_FILE_NAME);
  const token = new AdminToken(tokenFile);
  token.issue(4321);
  const logs: string[] = [];
  const base: AppDeps = {
    config,
    auth,
    getServerSettings: () => ({ port: 0, lanEnabled: false }),
    setServerSettings: async (s) => s,
    getListenInfo: () => ({ port: 0, lanUrls: [], startedAt: new Date().toISOString() }),
  };
  const withAdmin: AppDeps = {
    ...base,
    hosted: testHostedOptions({ admin: adminRouter({ auth, token, deps: () => withAdmin, ownerId: () => '', registration: () => 'open', log: (l) => logs.push(l) }) }),
  };
  const without: AppDeps = { ...base, hosted: testHostedOptions() };
  const socket: { address: string | undefined } = { address: undefined };
  const listener = (app: http.RequestListener): http.RequestListener => (req, res) => {
    if (socket.address !== undefined) Object.defineProperty(req.socket, 'remoteAddress', { value: socket.address, configurable: true });
    app(req, res);
  };
  const dana = await auth.register({ firstName: 'Dana', lastName: 'Test', username: 'dana', email: 'dana@example.com', password: PASSWORD, rememberMe: true, deviceName: 'Phone' });
  return {
    auth,
    logs,
    socket,
    dana,
    tokenValue: (JSON.parse(read(tokenFile)) as { token: string }).token,
    admin: supertest(listener(createApp(withAdmin) as unknown as http.RequestListener)),
    plain: supertest(listener(createApp(without) as unknown as http.RequestListener)),
  };
}

type Agent = ReturnType<typeof supertest>;
type Route = ['get' | 'post', string, object?];

function routesFor(id: string): Route[] {
  return [
    ['get', '/api/admin/status'],
    ['get', '/api/admin/accounts'],
    ['get', '/api/admin/accounts/find?q=dana%40example.com'],
    ['post', `/api/admin/accounts/${id}/delete`, { username: 'dana' }],
    ['post', `/api/admin/accounts/${id}/revoke-sessions`],
    ['post', `/api/admin/accounts/${id}/unlock`],
    ['get', '/api/admin/no-such-route'],
  ];
}

function send(agent: Agent, [method, url, body]: Route, headers: Record<string, string>) {
  let req = method === 'get' ? agent.get(url) : agent.post(url);
  for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
  return body === undefined ? req : req.send(body);
}

describe('the gate: loopback socket + this boot’s token + no proxy headers, or the answer of an unknown route', () => {
  it('admits the loopback socket with the token - also with the Host the tool sends (127.0.0.1:<port>)', async () => {
    const g = await gateApps();
    for (const host of [HOST, '127.0.0.1:8080']) {
      const res = await g.admin.get('/api/admin/accounts').set('Host', host).set('X-Admin-Token', g.tokenValue);
      expect(res.status).toBe(200);
      expect(res.headers['x-admin-api']).toBe('1');
      expect(res.headers['cache-control']).toBe('no-store');
      expect((res.body.accounts as AdminAccount[]).map((a) => a.username)).toEqual(['dana']);
    }
    // An admitted request for a path the API does not have: its own 404, marked as the admin API's.
    const unknown = await g.admin.get('/api/admin/nothing-here').set('X-Admin-Token', g.tokenValue);
    expect(unknown.status).toBe(404);
    expect(unknown.headers['x-admin-api']).toBe('1');
  });

  it('every other request gets exactly what the same request gets from a server without the admin API - and changes nothing', async () => {
    const g = await gateApps();
    const tk = g.tokenValue;
    const scenarios: Array<{ name: string; address?: string; headers: Record<string, string> }> = [
      { name: 'the proxy’s private address, right token', address: '172.16.4.2', headers: { 'X-Admin-Token': tk } },
      { name: 'Fly 6PN address, right token', address: 'fdaa:0:1:a7b:1:2:3:4', headers: { 'X-Admin-Token': tk } },
      { name: 'a public IPv6 client, right token', address: '2001:db8::7', headers: { 'X-Admin-Token': tk } },
      { name: 'an IPv4-mapped private address, right token', address: '::ffff:10.0.0.7', headers: { 'X-Admin-Token': tk } },
      { name: 'non-loopback socket claiming 127.0.0.1 in X-Forwarded-For', address: '203.0.113.7', headers: { 'X-Admin-Token': tk, 'X-Forwarded-For': '127.0.0.1' } },
      { name: 'non-loopback socket claiming 127.0.0.1 in Fly-Client-IP', address: '172.16.4.2', headers: { 'X-Admin-Token': tk, 'Fly-Client-IP': '127.0.0.1' } },
      { name: 'loopback socket with X-Forwarded-For', headers: { 'X-Admin-Token': tk, 'X-Forwarded-For': '127.0.0.1' } },
      { name: 'loopback socket with Fly-Client-IP', headers: { 'X-Admin-Token': tk, 'Fly-Client-IP': '127.0.0.1' } },
      { name: 'loopback socket with Forwarded', headers: { 'X-Admin-Token': tk, Forwarded: 'for=127.0.0.1' } },
      { name: 'loopback socket with Via', headers: { 'X-Admin-Token': tk, Via: '1.1 fly.io' } },
      { name: 'loopback socket with X-Real-IP', headers: { 'X-Admin-Token': tk, 'X-Real-IP': '127.0.0.1' } },
      { name: 'loopback socket with another Fly header', headers: { 'X-Admin-Token': tk, 'Fly-Region': 'fra' } },
      { name: 'loopback socket without a token', headers: {} },
      { name: 'loopback socket with a wrong token', headers: { 'X-Admin-Token': 'cd'.repeat(32) } },
      { name: 'loopback socket with the token in upper case', headers: { 'X-Admin-Token': tk.toUpperCase() } },
      { name: 'loopback socket with the token cut short', headers: { 'X-Admin-Token': tk.slice(0, 63) } },
      { name: 'loopback socket with the token as a bearer token', headers: { Authorization: `Bearer ${tk}` } },
    ];
    const statuses = new Set<number>();
    for (const scenario of scenarios) {
      g.socket.address = scenario.address;
      for (const route of routesFor(g.dana.account.id)) {
        const headers = { Host: HOST, 'Accept-Language': 'en', ...scenario.headers };
        const refused = await send(g.admin, route, headers);
        const unknown = await send(g.plain, route, headers);
        expect({ scenario: scenario.name, route: route[1], ...shape(refused) }).toEqual({ scenario: scenario.name, route: route[1], ...shape(unknown) });
        expect(refused.headers['x-admin-api']).toBeUndefined();
        statuses.add(refused.status);
      }
    }
    // All of them the API's plain 404 (the public Host was sent).
    expect([...statuses]).toEqual([404]);
    // A foreign Host: the Host check's 421, as for any unknown route.
    g.socket.address = '172.16.4.2';
    const foreign = await send(g.admin, ['get', '/api/admin/accounts'], { Host: 'evil.example', 'X-Admin-Token': tk });
    expect(shape(foreign)).toEqual(shape(await send(g.plain, ['get', '/api/admin/accounts'], { Host: 'evil.example', 'X-Admin-Token': tk })));
    expect(foreign.status).toBe(421);
    // Nothing happened to the account: record, sessions, diary.
    expect(g.auth.accounts.findById(g.dana.account.id)).not.toBeNull();
    expect(g.auth.listSessions(g.dana.account.id)).toHaveLength(1);
    expect(g.auth.vaults.get(g.dana.account.id)).not.toBeNull();
    // The internet's attempts are not even logged; a loopback caller without the token is, once.
    expect(g.logs.filter((l) => l.startsWith('admin: refused'))).toEqual(['admin: refused a loopback request without a valid admin token']);
    expect(g.logs.join('\n')).not.toMatch(/dana|u_[0-9a-f]{16}|203\.0\.113|172\.16/);
  });

  it('isLoopbackSocketAddress / hasProxyHeaders', () => {
    for (const a of ['127.0.0.1', '127.12.0.9', '::1', '0:0:0:0:0:0:0:1', '::ffff:127.0.0.1', '::FFFF:127.0.0.2']) expect(isLoopbackSocketAddress(a), a).toBe(true);
    for (const a of [undefined, '', '10.0.0.1', '172.16.0.2', '::ffff:10.0.0.7', 'fdaa::3', '2001:db8::1', '127.0.0.256', '1127.0.0.1', '127.0.0', '::ffff:7f00:1', 'localhost']) {
      expect(isLoopbackSocketAddress(a), String(a)).toBe(false);
    }
    expect(hasProxyHeaders({ headers: { host: 'x', 'x-admin-token': 'y', accept: 'application/json' } })).toBe(false);
    for (const h of ['x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host', 'fly-client-ip', 'fly-forwarded-port', 'fly-request-id', 'forwarded', 'via', 'x-real-ip']) {
      expect(hasProxyHeaders({ headers: { [h]: '1' } }), h).toBe(true);
    }
  });
});

// The hosted composition ------------------------------------------------------------------------

interface Boot {
  dataDir?: string;
  env?: Record<string, string>;
  start?: HostedStartOptions;
}

async function boot(o: Boot = {}) {
  const dataDir = o.dataDir ?? tempDataDir();
  const env = loadHostedEnv({
    DIARY_MODE: 'hosted',
    DIARY_PUBLIC_URL: `https://${HOST}`,
    DIARY_BIND: '127.0.0.1',
    // Each test client its own address bucket; limits high enough for the lockout to be what refuses.
    DIARY_CLIENT_IP_HEADER: 'x-forwarded-for',
    DIARY_LOGIN_PER_MINUTE: '1000',
    DIARY_AUTH_GLOBAL_PER_MINUTE: '10000',
    ...o.env,
  });
  const config = loadConfig(['--data-dir', dataDir], { DIARY_MODE: 'hosted' });
  const logs: string[] = [];
  const srv = await startHosted(config, env, { port: 0, quiet: true, auth: { kdf: FAST, sleep: async () => {} }, log: (l) => logs.push(l), ...o.start });
  running.push(srv);
  const agent = supertest(srv.localUrl);
  const token = () => (JSON.parse(read(srv.adminToken.file)) as { token: string }).token;
  /** The admin tool's requests: loopback socket, Host 127.0.0.1:<port>, the token from the file. */
  const admin = {
    get: (url: string) => agent.get(url).set('X-Admin-Token', token()),
    post: (url: string, body?: object) => {
      const req = agent.post(url).set('X-Admin-Token', token());
      return body === undefined ? req : req.send(body);
    },
  };
  /** A client on the internet behind the proxy (TEST-NET address), over the TLS edge. */
  const from = (ip = '203.0.113.9') => {
    const common = (r: supertest.Test) => r.set('Host', HOST).set('X-Forwarded-For', ip).set('X-Forwarded-Proto', 'https').set('Accept-Language', 'en');
    return {
      get: (url: string, bearer?: string) => (bearer ? common(agent.get(url)).set('Authorization', `Bearer ${bearer}`) : common(agent.get(url))),
      post: (url: string, body: object = {}, bearer?: string) => (bearer ? common(agent.post(url)).set('Authorization', `Bearer ${bearer}`) : common(agent.post(url))).send(body),
      put: (url: string, body: object = {}, bearer?: string) => (bearer ? common(agent.put(url)).set('Authorization', `Bearer ${bearer}`) : common(agent.put(url))).send(body),
    };
  };
  const register = async (username: string, ip: string, extra: object = {}) => {
    const res = await from(ip).post('/api/auth/register', registerBody(username, extra));
    expect(res.status).toBe(201);
    return res.body as AuthResponse;
  };
  const login = async (username: string, ip: string, extra: object = {}) => {
    const res = await from(ip).post('/api/auth/login', { username, password: PASSWORD, ...extra });
    expect(res.status).toBe(200);
    return (res.body as AuthResponse).token;
  };
  return { srv, dataDir, logs, agent, admin, token, from, register, login };
}

async function stop(srv: RunningHosted): Promise<void> {
  running.splice(running.indexOf(srv), 1);
  await srv.stop();
}

describe('the per-boot token file', () => {
  it('is written at start (port + 64-hex token, 0600), opens the API, rotates at every start and goes at a clean stop', async () => {
    const dataDir = tempDataDir();
    const first = await boot({ dataDir });
    const file = path.join(dataDir, '.admin-token');
    expect(first.srv.adminToken.file).toBe(file);
    expect(first.srv.adminToken.active).toBe(true);
    const content = JSON.parse(read(file)) as Record<string, unknown>;
    expect(Object.keys(content).sort()).toEqual(['pid', 'port', 'startedAt', 'token', 'version']);
    expect(content).toMatchObject({ version: 1, port: first.srv.port, pid: process.pid });
    expect(content.token).toMatch(/^[0-9a-f]{64}$/);
    if (process.platform !== 'win32') expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
    expect((await first.admin.get('/api/admin/status')).status).toBe(200);
    const oldToken = first.token();

    await stop(first.srv);
    expect(fs.existsSync(file)).toBe(false);

    const second = await boot({ dataDir });
    const newToken = second.token();
    expect(newToken).not.toBe(oldToken);
    // The previous boot's token opens nothing - the answer of an unknown route (Host check: 421 for the tool's Host).
    const stale = await second.agent.get('/api/admin/status').set('X-Admin-Token', oldToken);
    expect(stale.status).toBe(421);
    expect(stale.headers['x-admin-api']).toBeUndefined();
    const staleWithHost = await second.agent.get('/api/admin/status').set('X-Admin-Token', oldToken).set('Host', HOST);
    expect(staleWithHost.status).toBe(404);
    expect((await second.admin.get('/api/admin/status')).status).toBe(200);
  });

  it('a file of a newer server is left alone at stop; the archive never takes the token file', async () => {
    const b = await boot();
    const foreign = JSON.stringify({ version: 1, port: 1, token: 'ef'.repeat(32), pid: 1, startedAt: '2026-10-28T00:00:00.000Z' });
    fs.writeFileSync(b.srv.adminToken.file, foreign);
    await stop(b.srv);
    expect(read(b.srv.adminToken.file)).toBe(foreign);
    for (const name of ['.admin-token', '.admin-token.tmp', 'users/.admin-token']) expect(isArchivedPath(name, false), name).toBe(false);
    expect(isArchivedPath('accounts.json', false)).toBe(true);
  });

  it('DIARY_ADMIN_TOKEN_FILE moves it (absolute paths only); a volume that refuses it leaves the server up with the API closed', async () => {
    const elsewhere = path.join(tempDataDir(), 'run', 'diary-admin-token');
    const moved = await boot({ env: { DIARY_ADMIN_TOKEN_FILE: elsewhere } });
    expect(moved.srv.adminToken.file).toBe(elsewhere);
    expect(fs.existsSync(elsewhere)).toBe(true);
    expect(fs.existsSync(path.join(moved.dataDir, '.admin-token'))).toBe(false);
    expect((await moved.admin.get('/api/admin/status')).status).toBe(200);
    expect(() => loadHostedEnv({ DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: `https://${HOST}`, DIARY_ADMIN_TOKEN_FILE: 'relative/token' })).toThrow(/absolute/);

    // The parent of the token file is a file: it cannot be written.
    const blocker = path.join(tempDataDir(), 'not-a-dir');
    fs.writeFileSync(blocker, 'x');
    const broken = await boot({ start: { adminTokenFile: path.join(blocker, '.admin-token') } });
    expect(broken.srv.adminToken.active).toBe(false);
    expect(broken.logs.some((l) => /^admin: the admin token file could not be written \(\w+\) - the admin tool is unavailable until the next start$/.test(l))).toBe(true);
    // The server serves on; the admin API answers nobody (any token, even an empty one).
    expect((await broken.from().get('/api/health')).status).toBe(200);
    for (const tk of ['', 'ab'.repeat(32)]) {
      const res = await broken.agent.get('/api/admin/status').set('Host', HOST).set('X-Admin-Token', tk);
      expect(res.status).toBe(404);
    }
  });
});

describe('list / find / status: who and how big - never anything of a diary', () => {
  it('list carries exactly the operator fields; no diary content, names or key material; diaryBytes = the file', async () => {
    const b = await boot();
    const dana = await b.register('dana', '198.51.100.1', { firstName: 'Firstname-Secret', lastName: 'Lastname-Secret', rememberMe: true });
    const ron = await b.register('ron', '198.51.100.2');
    const entry = await b.from('198.51.100.1').post('/api/entries', sampleEntry({ title: 'Entry-Title-Secret', body: 'Entry-Body-Secret', people: ['Person-Secret'], tags: ['Tag-Secret'] }), dana.token);
    expect(entry.status).toBeLessThan(300);
    const ctx = (await b.srv.auth.authenticate(dana.token))!;
    await ctx.vault.persist();
    // Two failed sign-ins of Ron's from one network (counters only - not a lock yet).
    for (let i = 0; i < 2; i++) expect((await b.from('192.0.2.50').post('/api/auth/login', { username: 'ron', password: 'Wrong1pass' })).status).toBe(401);

    const list = await b.admin.get('/api/admin/accounts');
    expect(list.status).toBe(200);
    const accounts = list.body.accounts as AdminAccount[];
    expect(accounts.map((a) => a.username)).toEqual(['dana', 'ron']);
    for (const a of accounts) expect(Object.keys(a).sort()).toEqual(ADMIN_FIELDS);
    const [d, r] = accounts;
    expect(d).toMatchObject({ id: dana.user.id, email: 'dana@example.com', sessions: 1, open: true, locked: false });
    expect(d.diaryBytes).toBe(fs.statSync(path.join(b.dataDir, 'users', `${dana.user.id}.mpd`)).size);
    expect(d.lastLoginAt).toBe(d.createdAt);
    expect(r).toMatchObject({ id: ron.user.id, email: 'ron@example.com', locked: false });
    const everything = [list.text, (await b.admin.get('/api/admin/accounts/find?q=dana')).text, (await b.admin.get('/api/admin/status')).text].join('\n');
    for (const secret of ['Secret', 'verifier', 'salt', 'recovery', 'kdf', 'scrypt', 'firstName', 'lastName', 'privacy', 'language', 'dbFile', '.mpd']) {
      expect({ secret, found: everything.includes(secret) }).toEqual({ secret, found: false });
    }
    // The registry and the diary still hold them - the API just never hands them out.
    expect(read(path.join(b.dataDir, 'accounts.json'))).toContain('Firstname-Secret');

    const status = await b.admin.get('/api/admin/status');
    expect(status.body).toMatchObject({ ok: true, accounts: 2, registration: 'open', ownerConfigured: false });
    expect(Object.keys(status.body).sort()).toEqual(['accounts', 'liveSessions', 'ok', 'openDiaries', 'ownerConfigured', 'registration', 'version']);
  });

  it('find is exact (upper / lower case aside), by username, e-mail or either; one parameter only', async () => {
    const b = await boot();
    const dana = await b.register('dana', '198.51.100.1');
    await b.register('danaB', '198.51.100.2', { email: 'other@example.com' });
    const find = async (query: string) => {
      const res = await b.admin.get(`/api/admin/accounts/find?${query}`);
      expect(res.status, query).toBe(200);
      return (res.body.matches as AdminAccount[]).map((a) => a.username);
    };
    expect(await find('q=dana%40example.com')).toEqual(['dana']);
    expect(await find('q=DANA%40Example.COM')).toEqual(['dana']);
    expect(await find('q=%20dana%20')).toEqual(['dana']);
    expect(await find('q=DANA')).toEqual(['dana']);
    expect(await find('q=dan')).toEqual([]);
    expect(await find('q=example.com')).toEqual([]);
    expect(await find('username=dana')).toEqual(['dana']);
    expect(await find('username=dana%40example.com')).toEqual([]);
    expect(await find('email=dana%40example.com')).toEqual(['dana']);
    expect(await find('email=dana')).toEqual([]);
    expect(await find('q=other%40example.com')).toEqual(['danaB']);
    for (const bad of ['', 'q=', 'q=a&email=b', 'username=a&username=b', 'nothing=1']) {
      const res = await b.admin.get(`/api/admin/accounts/find?${bad}`);
      expect({ bad, status: res.status, error: res.body.error }).toEqual({ bad, status: 400, error: 'bad-request' });
    }
    expect(b.logs).toContain('admin: account lookup (1 match)');
    expect(b.logs).toContain('admin: account lookup (0 matches)');
    expect(b.logs.join('\n')).not.toMatch(/dana|example\.com|u_[0-9a-f]{16}/i);
    expect(dana.user.id).toMatch(/^u_[0-9a-f]{16}$/);
  });
});

/** Everything of Dana (owner, three devices, a diary with .prev and a stale .tmp, resets, counters, mail settings) plus Ron. */
async function scenario() {
  const sent: string[] = [];
  const transport: SmtpTransport = { send: async (_opts, envelope) => void sent.push(envelope.to) };
  let ownerId = '';
  const b = await boot({ start: { ownerId: () => ownerId, mailTransport: transport } });
  const dana = await b.register('dana', '198.51.100.1', { rememberMe: true, deviceName: 'Desktop' });
  const ron = await b.register('ron', '198.51.100.2', { rememberMe: true, deviceName: 'Laptop' });
  const phone = await b.login('dana', '198.51.100.3', { rememberMe: true, deviceName: 'Phone' });
  const tab = await b.login('dana@example.com', '198.51.100.4', { rememberMe: false, deviceName: 'Browser' });
  // Two saves -> users/<id>.mpd and .mpd.prev; a leftover .tmp as after a crash mid-write.
  const ctx = (await b.srv.auth.authenticate(dana.token))!;
  ctx.db.run(INSERT_ENTRY);
  await ctx.vault.persist();
  ctx.db.run(INSERT_ENTRY);
  await ctx.vault.persist();
  const danaDb = path.join(b.dataDir, 'users', `${dana.user.id}.mpd`);
  fs.writeFileSync(`${danaDb}.tmp`, 'half-written');
  const ronCtx = (await b.srv.auth.authenticate(ron.token))!;
  ronCtx.db.run(INSERT_ENTRY);
  await ronCtx.vault.persist();
  const ronDb = path.join(b.dataDir, 'users', `${ron.user.id}.mpd`);
  // Pending resets, failed sign-ins (each from its own network), wrong reset codes.
  b.srv.auth.resets.create(dana.user.id);
  b.srv.auth.resets.create(ron.user.id);
  expect((await b.from('192.0.2.10').post('/api/auth/login', { username: 'dana', password: 'Wrong1pass' })).status).toBe(401);
  expect((await b.from('192.0.2.20').post('/api/auth/login', { username: 'ron', password: 'Wrong1pass' })).status).toBe(401);
  await expect(b.srv.passwordReset.resetWithCode('dana@example.com', '000000', 'Another1pass', 'en')).rejects.toMatchObject({ status: 400 });
  await expect(b.srv.passwordReset.resetWithCode('ron@example.com', '000000', 'Another1pass', 'en')).rejects.toMatchObject({ status: 400 });
  // Dana is the configured owner and set up the Mail card.
  ownerId = dana.user.id;
  const mail = await b.from('198.51.100.1').put(
    '/api/server/mail',
    { enabled: true, host: 'smtp.example.net', port: 465, security: 'tls', username: 'diary@example.net', smtpPassword: 'fictional-app-password', fromAddress: 'diary@example.net', password: PASSWORD },
    dana.token,
  );
  expect(mail.status).toBe(200);
  expect(b.srv.mail.ownerId()).toBe(dana.user.id);
  for (const f of [danaDb, `${danaDb}.prev`, `${danaDb}.tmp`, ronDb]) expect(fs.existsSync(f), f).toBe(true);
  const ronBefore = {
    db: sha256(ronDb),
    record: (JSON.parse(read(path.join(b.dataDir, 'accounts.json'))).accounts as Array<{ id: string }>).find((a) => a.id === ron.user.id),
  };
  return { ...b, dana, ron, phone, tab, danaDb, ronDb, ronBefore, sent };
}

type Scenario = Awaited<ReturnType<typeof scenario>>;

/** What must hold after Dana's deletion - whichever way she was deleted. */
async function expectDanaGoneRonIntact(s: Scenario): Promise<void> {
  const { dataDir, dana, ron } = s;
  const id = dana.user.id;
  // Diary files: Dana's (.mpd, .prev, .tmp) are gone; Ron's diary is byte for byte what it was.
  const users = fs.readdirSync(path.join(dataDir, 'users'));
  expect(users.filter((f) => f.includes(id))).toEqual([]);
  expect(sha256(s.ronDb)).toBe(s.ronBefore.db);
  // Registry: no trace of Dana; Ron's record unchanged; nothing left pending.
  const accounts = read(path.join(dataDir, 'accounts.json'));
  for (const trace of [id, '"dana"', 'dana@example.com']) expect(accounts).not.toContain(trace);
  expect(JSON.parse(accounts).accounts).toEqual([s.ronBefore.record]);
  expect(JSON.parse(accounts).pendingDeletes).toBeUndefined();
  // Sessions: every device of Dana's is signed out, on disk and in memory; Ron stays.
  const sessions = read(path.join(dataDir, 'sessions.json'));
  expect(sessions).not.toContain(id);
  expect(sessions).toContain(ron.user.id);
  for (const token of [dana.token, s.phone, s.tab]) expect((await s.from().get('/api/auth/me', token)).status).toBe(401);
  expect((await s.from().get('/api/auth/me', ron.token)).status).toBe(200);
  // Reset records: Dana's gone, Ron's live.
  expect(read(path.join(dataDir, 'resets.json'))).not.toContain(id);
  expect(s.srv.auth.resets.liveCount(ron.user.id)).toBe(1);
  // Lockout, delay and reset-code counters: Dana's gone, Ron's remain.
  expect(s.srv.auth.lockout.has(`account:${id}@network@192.0.2.10`)).toBe(false);
  expect(s.srv.auth.delays.has(`account:${id}@any`)).toBe(false);
  expect(s.srv.auth.lockout.has(`account:${ron.user.id}@network@192.0.2.20`)).toBe(true);
  expect(s.srv.passwordReset.codeFailuresOf(id)).toBe(0);
  expect(s.srv.passwordReset.codeFailuresOf(ron.user.id)).toBe(1);
  // Memory: Dana's diary is closed; Ron's is open.
  expect(s.srv.auth.vaults.get(id)).toBeNull();
  expect(s.srv.auth.vaults.get(ron.user.id)).not.toBeNull();
  // The owner release: the Mail card's secret is gone and nobody else became the owner.
  expect(s.srv.mail.ownerId()).toBe('');
  expect(s.srv.mail.view()).toMatchObject({ enabled: false, smtpPasswordSet: false, username: '' });
  expect(read(path.join(dataDir, 'server-settings.json'))).not.toContain('diary@example.net');
  for (const url of ['/api/server/mail', '/api/server/status']) {
    const res = await s.from().get(url, ron.token);
    expect({ url, status: res.status, message: res.body.message }).toEqual({ url, status: 403, message: t('en', OWNER_UNSET_KEY) });
  }
  expect((await s.from().get('/api/server/settings', ron.token)).body.isMailOwner).toBe(false);
  // The username and the address are free again: a new account gets them, with an empty diary.
  const again = await s.register('dana', '198.51.100.9');
  expect(again.user.id).not.toBe(id);
  expect((await s.from().get('/api/entries?limit=5', again.token)).body.total).toBe(0);
}

describe('deletion: the operator’s deletion is the account’s own deletion without the password', () => {
  it('self-deletion (the reference): everything of the account goes, everything else stays', async () => {
    const s = await scenario();
    expect((await s.from('198.51.100.1').post('/api/auth/delete-account', { password: PASSWORD }, s.dana.token)).status).toBe(204);
    await expectDanaGoneRonIntact(s);
  });

  it('admin deletion: exactly the same result, logged without personal data', async () => {
    const s = await scenario();
    const id = s.dana.user.id;
    const res = await s.admin.post(`/api/admin/accounts/${id}/delete`, { username: 'dana' });
    expect(res.status).toBe(200);
    expect(res.headers['x-admin-api']).toBe('1');
    expect(res.body).toEqual({ deleted: true, wasOwner: true });
    await expectDanaGoneRonIntact(s);
    expect(s.logs).toContain('admin: account deleted (1)');
    expect(s.logs.some((l) => l.startsWith('admin: the deleted account was the configured owner'))).toBe(true);
    const adminLines = s.logs.filter((l) => l.startsWith('admin:')).join('\n');
    for (const trace of ['dana', 'example.com', id, 'ron']) expect(adminLines).not.toContain(trace);
  });

  it('refuses a wrong or missing username, an unknown id and a guest - nothing is deleted', async () => {
    const b = await boot();
    const dana = await b.register('dana', '198.51.100.1');
    const ron = await b.register('ron', '198.51.100.2');
    const url = `/api/admin/accounts/${dana.user.id}/delete`;
    for (const body of [{ username: 'ron' }, { username: 'DANA' }, { username: 'dana ' }, {}, { username: 42 }]) {
      const res = await b.admin.post(url, body);
      expect({ body, status: res.status, error: res.body.error }).toEqual({ body, status: 409, error: 'username-mismatch' });
    }
    expect((await b.admin.post(url)).status).toBe(409);
    const bad = await b.agent.post(url).set('X-Admin-Token', b.token()).set('Content-Type', 'application/json').send('{"username":');
    expect({ status: bad.status, error: bad.body.error }).toEqual({ status: 400, error: 'bad-request' });
    for (const id of ['u_00000000deadbeef', 'nobody']) {
      for (const action of ['delete', 'revoke-sessions', 'unlock']) {
        const res = await b.admin.post(`/api/admin/accounts/${id}/${action}`, { username: 'dana' });
        expect({ id, action, status: res.status, error: res.body.error }).toEqual({ id, action, status: 404, error: 'not-found' });
      }
    }
    // A guest of the tour is no account: the operator cannot see or touch it (it ends by itself).
    const guest = await b.from('198.51.100.5').post('/api/auth/guest', {});
    expect(guest.status).toBe(201);
    const guestId = (guest.body as AuthResponse).user.id;
    expect((await b.admin.post(`/api/admin/accounts/${guestId}/delete`, { username: (guest.body as AuthResponse).user.username })).status).toBe(404);
    expect(((await b.admin.get('/api/admin/accounts')).body.accounts as AdminAccount[]).map((a) => a.username)).toEqual(['dana', 'ron']);
    expect(b.srv.auth.accounts.findById(dana.user.id)).not.toBeNull();
    expect(fs.existsSync(path.join(b.dataDir, 'users', `${dana.user.id}.mpd`))).toBe(true);
    // Deleting somebody who is not the owner: wasOwner false; the other account is untouched.
    const ok = await b.admin.post(`/api/admin/accounts/${ron.user.id}/delete`, { username: 'ron' });
    expect(ok.body).toEqual({ deleted: true, wasOwner: false });
    expect((await b.from().get('/api/auth/me', dana.token)).status).toBe(200);
  });
});

describe('unlock and revoke', () => {
  it('unlock resets the per-account counters: the locked network signs in again at once; confirmations and reset codes too', async () => {
    const b = await boot();
    const dana = await b.register('dana', '198.51.100.1');
    const id = dana.user.id;
    const attacker = '192.0.2.66';
    // Ten wrong passwords from one network lock that network for this account (5.2) ...
    for (let i = 0; i < 9; i++) expect((await b.from(attacker).post('/api/auth/login', { username: 'dana', password: `Wrong${i}pass` })).status).toBe(401);
    expect((await b.from(attacker).post('/api/auth/login', { username: 'dana', password: 'Wrong9pass' })).status).toBe(429);
    // ... even for the right password from there.
    expect((await b.from(attacker).post('/api/auth/login', { username: 'dana', password: PASSWORD })).status).toBe(429);
    // Ten wrong confirmations lock the account's password confirmations.
    for (let i = 0; i < 10; i++) await b.from('198.51.100.1').post('/api/auth/verify-password', { password: `Nope${i}pass` }, dana.token);
    expect((await b.from('198.51.100.1').post('/api/auth/verify-password', { password: PASSWORD }, dana.token)).status).toBe(429);
    await expect(b.srv.passwordReset.resetWithCode('dana@example.com', '000000', 'Another1pass', 'en')).rejects.toMatchObject({ status: 400 });
    expect(b.srv.passwordReset.codeFailuresOf(id)).toBe(1);
    const before = ((await b.admin.get('/api/admin/accounts')).body.accounts as AdminAccount[])[0];
    expect(before.locked).toBe(true);

    const res = await b.admin.post(`/api/admin/accounts/${id}/unlock`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unlocked: true, wasLocked: true });
    expect(((await b.admin.get('/api/admin/accounts')).body.accounts as AdminAccount[])[0].locked).toBe(false);
    expect(b.srv.auth.delays.has(`account:${id}@any`)).toBe(false);
    expect(b.srv.passwordReset.codeFailuresOf(id)).toBe(0);
    // No waiting: the same network signs in, the confirmation works.
    expect((await b.from(attacker).post('/api/auth/login', { username: 'dana', password: PASSWORD })).status).toBe(200);
    expect((await b.from('198.51.100.1').post('/api/auth/verify-password', { password: PASSWORD }, dana.token)).status).toBe(200);
    // Unlocking an account that is not locked says so.
    expect((await b.admin.post(`/api/admin/accounts/${id}/unlock`)).body).toEqual({ unlocked: true, wasLocked: false });
    expect(b.logs.filter((l) => l === 'admin: account unlocked (1)')).toHaveLength(2);
  });

  it('revoke signs the account out on every device; its diary (unsaved changes included) and its record stay', async () => {
    const b = await boot();
    const dana = await b.register('dana', '198.51.100.1', { rememberMe: true });
    const ron = await b.register('ron', '198.51.100.2', { rememberMe: true });
    const phone = await b.login('dana', '198.51.100.3', { rememberMe: true });
    const tab = await b.login('dana', '198.51.100.4');
    const ctx = (await b.srv.auth.authenticate(dana.token))!;
    ctx.db.run(INSERT_ENTRY); // not saved yet
    expect(read(path.join(b.dataDir, 'sessions.json'))).toContain(dana.user.id);

    const res = await b.admin.post(`/api/admin/accounts/${dana.user.id}/revoke-sessions`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ revoked: 3 });
    for (const token of [dana.token, phone, tab]) expect((await b.from().get('/api/auth/me', token)).status).toBe(401);
    expect(read(path.join(b.dataDir, 'sessions.json'))).not.toContain(dana.user.id);
    expect(b.srv.auth.vaults.get(dana.user.id)).toBeNull();
    expect((await b.from().get('/api/auth/me', ron.token)).status).toBe(200);
    // The account and its diary are all there: a new sign-in finds the unsaved entry saved.
    const again = await b.login('dana', '198.51.100.5');
    expect((await b.from().get('/api/entries?limit=5', again)).body.total).toBe(1);
    expect(b.logs).toContain('admin: sessions revoked (3)');
    const account = ((await b.admin.get('/api/admin/accounts')).body.accounts as AdminAccount[]).find((a) => a.username === 'dana')!;
    expect(account.sessions).toBe(1);
  });
});
