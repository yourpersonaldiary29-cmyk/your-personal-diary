/**
 * Remote access belongs to the owner of this computer's diary (security/owner.ts, routes/server.ts,
 * remote/manager.ts):
 *   - the owner is the account created first (earliest createdAt), fixed from the start - it can
 *     set remote access up before anyone else, and a second account that saves first gets 403
 *     'server.remote.notOwner' (checked again at write time) and claims nothing;
 *   - every other account gets 403 from GET / PUT / renew / test, and GET /api/server/settings
 *     leaves `remote` out for it and reports `isRemoteOwner: false`;
 *   - every PUT - the first one included - needs the account password (400 VALIDATION when it is
 *     missing, 400 WRONG_PASSWORD with field 'password' when wrong; the session survives);
 *   - settings saved earlier by another account keep that owner (a notice is logged at startup);
 *     settings without a stored owner go to the first account at startup - or, when the server
 *     started without accounts, when the first account registers (and again right before any
 *     deletion; a deletion that cannot write the owner down deletes nothing) - so deleting the
 *     first account clears them; a stored owner that is not an account id is released like a
 *     deleted owner instead of going to the first account;
 *   - deleting the owner account turns remote access off (HTTPS closed, router port removed) and
 *     forgets everything of that setup (owner, DuckDNS token, name, public IP, certificate and
 *     keys) - only then does the next-oldest account own it; while that has not happened nobody
 *     else can see or save over the settings; an owner whose account is gone at start-up is
 *     released; a release still closing the router port cannot undo a save made meanwhile.
 * A real server on 127.0.0.1 with in-process DuckDNS / ACME / UPnP mocks - nothing leaves the machine.
 */
import fs from 'node:fs';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@shared/i18n';
import type { RemoteStatus, ServerSettings } from '@shared/types';
import { readRawServerSettings, type ServerConfig } from '../src/config';
import type { RemoteManagerOptions } from '../src/remote/manager';
import { readRemoteConfig, REMOTE_DEFAULTS, writeRemoteConfig } from '../src/remote/settings';
import { tlsPaths } from '../src/remote/tls-store';
import { loadOrCreateDeviceKey } from '../src/security/device-key';
import { firstAccountId, UNREADABLE_OWNER } from '../src/security/owner';
import { startServer, type RunningServer } from '../src/server';
import { cleanupTempDirs, testConfig } from './helpers';
import {
  httpsGet,
  startMockAcme,
  startMockDuckDns,
  startMockIgd,
  upnpOptionsFor,
  type MockAcme,
  type MockDuckDns,
  type MockIgd,
} from './remote-fixtures';

const HOST = 'diarytest.duckdns.org';
const TOKEN = '0123abcd-4567-89ab-cdef-0123456789ab';
const PUBLIC_IP = '203.0.113.7';
const PASSWORD = 'Passw0rd!';
const NOT_OWNER_EN = 'Only the account that set up remote access can view or change it.';
const NOT_OWNER_HE = 'רק החשבון שהגדיר את הגישה מרחוק יכול לראות או לשנות אותה.';
const FORBIDDEN_NOT_OWNER = { code: 'FORBIDDEN', message: NOT_OWNER_EN };

let duck: MockDuckDns;
let acme: MockAcme;
let igd: MockIgd;
const running: RunningServer[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const r of running.splice(0)) await r.stop();
  for (const m of [duck, acme, igd]) await m?.close();
  duck = acme = igd = undefined as never;
});
afterAll(cleanupTempDirs);

async function mocks() {
  duck = await startMockDuckDns({ token: TOKEN, domain: 'diarytest', ip: PUBLIC_IP });
  acme = await startMockAcme({ txtFor: (n) => duck.txtFor(n) });
  igd = await startMockIgd({ externalIp: PUBLIC_IP });
}

function remoteOptions(log: (line: string) => void = () => {}): RemoteManagerOptions {
  return {
    directoryUrl: acme.directoryUrl,
    duckdnsBaseUrl: duck.baseUrl,
    upnp: upnpOptionsFor(igd),
    waitForTxt: async (name, value) => duck.txtFor(name) === value,
    resolveHost: async () => [PUBLIC_IP],
    acmePollMs: 10,
    tlsPort: 0,
    tlsHost: '127.0.0.1',
    fallbackTlsPort: null,
    retryDelaysMs: [60_000],
    lanIps: () => ['192.168.1.20'],
    log,
  };
}

async function boot(config: ServerConfig = testConfig(), log?: (line: string) => void) {
  const srv = await startServer(config, { port: 0, quiet: true, remote: remoteOptions(log) });
  running.push(srv);
  const agent = supertest(`http://127.0.0.1:${srv.port}`);
  return { srv, agent, config };
}

interface Account {
  token: string;
  id: string;
  /** Authenticated request in English. */
  as: (t: supertest.Test) => supertest.Test;
}

function accountOf(token: string, id: string): Account {
  return { token, id, as: (t) => t.set('Authorization', `Bearer ${token}`).set('Accept-Language', 'en') };
}

async function register(agent: ReturnType<typeof supertest>, username: string): Promise<Account> {
  const res = await agent.post('/api/auth/register').send({
    firstName: username,
    lastName: 'Test',
    username,
    email: `${username}@example.com`,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    rememberMe: false,
  });
  expect(res.status).toBe(201);
  return accountOf(res.body.token as string, res.body.user.id as string);
}

async function login(agent: ReturnType<typeof supertest>, username: string): Promise<Account> {
  const res = await agent.post('/api/auth/login').send({ username, password: PASSWORD, rememberMe: false });
  expect(res.status).toBe(200);
  return accountOf(res.body.token as string, res.body.user.id as string);
}

function storedRemote(config: ServerConfig): Record<string, unknown> {
  return readRawServerSettings(config).remote as Record<string, unknown>;
}

async function serverSettings(agent: ReturnType<typeof supertest>, who: Account): Promise<ServerSettings> {
  const res = await who.as(agent.get('/api/server/settings'));
  expect(res.status).toBe(200);
  return res.body as ServerSettings;
}

describe('the first account owns remote access', () => {
  it('from the start: before anything is configured, only it sees remote access, and it can set it up (with its password)', async () => {
    await mocks();
    const { agent, config, srv } = await boot();
    const dana = await register(agent, 'dana');
    const ron = await register(agent, 'ron');
    expect(firstAccountId(JSON.parse(fs.readFileSync(config.accountsFile, 'utf8')).accounts)).toBe(dana.id);

    // Nothing is configured yet, and still only the first account may look.
    const refused = await ron.as(agent.get('/api/server/remote'));
    expect({ status: refused.status, body: refused.body }).toEqual({ status: 403, body: FORBIDDEN_NOT_OWNER });
    const before = await dana.as(agent.get('/api/server/remote'));
    expect(before.status).toBe(200);
    expect(before.body as RemoteStatus).toMatchObject({ hasOwner: true, hostname: '', tokenSet: false, enabled: false });
    expect(readRawServerSettings(config).remote).toBeUndefined();
    // The server settings tell each account whether it owns remote access (the Settings page hides the card otherwise).
    expect(await serverSettings(agent, dana)).toMatchObject({ isRemoteOwner: true, isMailOwner: true, remote: { hostname: '', tokenSet: false } });
    expect(await serverSettings(agent, ron)).toEqual({ port: expect.any(Number), lanEnabled: false, isRemoteOwner: false, isMailOwner: false, isLanOwner: false });

    const put = await dana.as(agent.put('/api/server/remote')).send({ hostname: 'diarytest', duckdnsToken: TOKEN, password: PASSWORD });
    expect(put.status).toBe(200);
    expect(put.body as RemoteStatus).toMatchObject({ hasOwner: true, hostname: HOST, tokenSet: true, enabled: false });
    expect(JSON.stringify(put.body)).not.toContain(dana.id);
    expect(storedRemote(config).ownerUserId).toBe(dana.id);
    expect(srv.remote.ownerId()).toBe(dana.id);
    // The password is checked, never stored.
    expect(fs.readFileSync(config.settingsFile, 'utf8')).not.toContain(PASSWORD);

    // The owner keeps full access; saving again keeps the owner.
    expect((await dana.as(agent.get('/api/server/remote'))).status).toBe(200);
    const again = await dana.as(agent.put('/api/server/remote')).send({ publicPort: 8443, password: PASSWORD });
    expect(again.status).toBe(200);
    expect(storedRemote(config)).toMatchObject({ ownerUserId: dana.id, publicPort: 8443 });
    expect((await serverSettings(agent, dana)).remote).toMatchObject({ hostname: HOST, tokenSet: true, publicPort: 8443 });
  });

  it('a second account that saves first gets 403 notOwner and claims nothing - also when it reaches the write directly', async () => {
    await mocks();
    const { agent, config, srv } = await boot();
    const dana = await register(agent, 'dana');
    const ron = await register(agent, 'ron');

    const first = await ron.as(agent.put('/api/server/remote')).send({ hostname: 'rondiary', duckdnsToken: TOKEN, password: PASSWORD });
    expect({ status: first.status, body: first.body }).toEqual({ status: 403, body: FORBIDDEN_NOT_OWNER });
    expect(readRawServerSettings(config).remote).toBeUndefined();
    expect(srv.remote.ownerId()).toBe('');
    // The owner is checked again right before the save (e.g. a request that passed the gate earlier).
    await expect(srv.remote.update({ hostname: 'rondiary' }, ron.id)).rejects.toMatchObject({ status: 403, key: 'server.remote.notOwner' });
    await expect(srv.remote.update({ hostname: 'rondiary' }, '')).rejects.toMatchObject({ status: 403 });
    expect(readRawServerSettings(config).remote).toBeUndefined();
    expect(duck.calls).toHaveLength(0);

    // The first account can still set it up, and becomes the stored owner.
    expect((await dana.as(agent.put('/api/server/remote')).send({ hostname: 'diarytest', duckdnsToken: TOKEN, password: PASSWORD })).status).toBe(200);
    expect(storedRemote(config)).toMatchObject({ ownerUserId: dana.id, hostname: HOST });
    await expect(srv.remote.update({ hostname: 'rondiary' }, ron.id)).rejects.toMatchObject({ status: 403 });
  });

  it('two saves at the same time: the first account wins, the other gets 403', async () => {
    await mocks();
    const { agent, config } = await boot();
    const dana = await register(agent, 'dana');
    const ron = await register(agent, 'ron');
    const [a, b] = await Promise.all([
      dana.as(agent.put('/api/server/remote')).send({ hostname: 'diarytest', password: PASSWORD }),
      ron.as(agent.put('/api/server/remote')).send({ hostname: 'other-diary', password: PASSWORD }),
    ]);
    expect(a.status).toBe(200);
    expect({ status: b.status, body: b.body }).toEqual({ status: 403, body: FORBIDDEN_NOT_OWNER });
    expect(storedRemote(config)).toMatchObject({ ownerUserId: dana.id, hostname: HOST });
  });
});

describe('any other account', () => {
  it('gets 403 notOwner from GET / PUT / renew / test (localised) and no remote block in the server settings', async () => {
    await mocks();
    const { agent, config } = await boot();
    const dana = await register(agent, 'dana');
    const ron = await register(agent, 'ron');
    expect((await dana.as(agent.put('/api/server/remote')).send({ enabled: true, hostname: HOST, duckdnsToken: TOKEN, password: PASSWORD })).status).toBe(
      200,
    );
    const callsBefore = duck.calls.length;

    for (const [method, url, body] of [
      ['get', '/api/server/remote', undefined],
      ['put', '/api/server/remote', { hostname: 'intruder', duckdnsToken: 'ffffffff-ffff-ffff-ffff-ffffffffffff', password: PASSWORD }],
      ['post', '/api/server/remote/renew', undefined],
      ['post', '/api/server/remote/test', { hostname: 'intruder' }],
    ] as const) {
      const req = ron.as(agent[method](url));
      const res = body ? await req.send(body) : await req;
      expect({ url, method, status: res.status, body: res.body }).toEqual({ url, method, status: 403, body: FORBIDDEN_NOT_OWNER });
    }
    // In Hebrew too.
    const he = await agent.get('/api/server/remote').set('Authorization', `Bearer ${ron.token}`).set('Accept-Language', 'he');
    expect(he.status).toBe(403);
    expect(he.body.message).toBe(NOT_OWNER_HE);

    // Nothing changed, nothing was sent to DuckDNS on the intruder's behalf.
    expect(storedRemote(config)).toMatchObject({ ownerUserId: dana.id, hostname: HOST });
    expect(duck.calls.slice(callsBefore).every((q) => q.get('domains') === 'diarytest')).toBe(true);

    // The server settings still answer, without the remote block.
    expect(await serverSettings(agent, ron)).toEqual({ port: expect.any(Number), lanEnabled: false, isRemoteOwner: false, isMailOwner: false, isLanOwner: false });
    // Phone access is the owner's decision too.
    const lan = await ron.as(agent.put('/api/server/settings')).send({ lanEnabled: false, isRemoteOwner: true, remote: { hostname: 'intruder' } });
    expect(lan.status).toBe(403);
    expect(lan.body).toEqual({ code: 'FORBIDDEN', message: t('en', 'server.lan.notOwner') });
    // Still signed in (403 is not a session problem).
    expect((await ron.as(agent.get('/api/auth/me'))).status).toBe(200);
  });

  it('still needs to be on the computer itself and signed in', async () => {
    await mocks();
    const { agent } = await boot();
    expect((await agent.get('/api/server/remote').set('Accept-Language', 'en')).status).toBe(401);
    expect((await agent.put('/api/server/remote').send({ password: PASSWORD })).status).toBe(401);
  });
});

describe('password', () => {
  it('is required for every save, the first one included, and a wrong one is 400 WRONG_PASSWORD (the session survives)', async () => {
    await mocks();
    const { agent, config } = await boot();
    const dana = await register(agent, 'dana');

    const missing = await dana.as(agent.put('/api/server/remote')).send({ hostname: 'diarytest', duckdnsToken: TOKEN });
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      code: 'VALIDATION',
      field: 'password',
      message: 'Enter your account password to change the remote access settings.',
    });
    const wrong = await dana.as(agent.put('/api/server/remote')).send({ hostname: 'diarytest', duckdnsToken: TOKEN, password: 'nope-Nope-1' });
    expect(wrong.status).toBe(400);
    expect(wrong.body).toEqual({ code: 'WRONG_PASSWORD', field: 'password', message: 'The password is incorrect.' });
    const wrongHe = await agent
      .put('/api/server/remote')
      .set('Authorization', `Bearer ${dana.token}`)
      .set('Accept-Language', 'he')
      .send({ hostname: 'diarytest', password: 'nope' });
    expect(wrongHe.body).toEqual({ code: 'WRONG_PASSWORD', field: 'password', message: 'הסיסמה שגויה.' });
    // A refused first save saves nothing.
    expect(readRawServerSettings(config).remote).toBeUndefined();
    expect((await dana.as(agent.get('/api/server/remote'))).body).toMatchObject({ hasOwner: true, hostname: '', tokenSet: false });
    expect((await dana.as(agent.get('/api/auth/me'))).status).toBe(200);

    // Configured (a token is stored): changing it, and turning it off, need the password too.
    expect((await dana.as(agent.put('/api/server/remote')).send({ enabled: true, hostname: HOST, duckdnsToken: TOKEN, password: PASSWORD })).status).toBe(
      200,
    );
    const redirect = await dana.as(agent.put('/api/server/remote')).send({ hostname: 'elsewhere', duckdnsToken: 'ffffffff-ffff-ffff-ffff-ffffffffffff' });
    expect(redirect.body).toMatchObject({ code: 'VALIDATION', field: 'password' });
    const off = await dana.as(agent.put('/api/server/remote')).send({ enabled: false, password: 'wrong' });
    expect(off.body).toMatchObject({ code: 'WRONG_PASSWORD', field: 'password' });
    expect(storedRemote(config)).toMatchObject({ enabled: true, hostname: HOST });
  });

  it('cannot be guessed faster than at sign-in: 30 saves a minute, then 429', async () => {
    await mocks();
    const { agent } = await boot();
    const dana = await register(agent, 'dana');
    for (let i = 0; i < 30; i++) expect((await dana.as(agent.put('/api/server/remote')).send({ hostname: 'diarytest' })).status).toBe(400);
    const limited = await dana.as(agent.put('/api/server/remote')).send({ hostname: 'diarytest', password: PASSWORD });
    expect(limited.status).toBe(429);
    // Reading is not limited.
    expect((await dana.as(agent.get('/api/server/remote'))).status).toBe(200);
  });

  it('renew and test do not need it', async () => {
    await mocks();
    const { agent, srv } = await boot();
    const dana = await register(agent, 'dana');
    await dana.as(agent.put('/api/server/remote')).send({ enabled: true, hostname: HOST, duckdnsToken: TOKEN, password: PASSWORD });
    await srv.remote.idle();
    const test = await dana.as(agent.post('/api/server/remote/test'));
    expect(test.status).toBe(200);
    expect(test.body.checks.length).toBe(4);
    const renew = await dana.as(agent.post('/api/server/remote/renew'));
    expect(renew.status).toBe(200);
    await srv.remote.idle();
    expect(acme.orders).toHaveLength(2);
  });
});

describe('settings saved before the owner became the first account', () => {
  it('keep a stored owner that is not the first account (never transferred silently) and log one notice at startup', async () => {
    await mocks();
    const first = await boot();
    const config = first.config;
    await register(first.agent, 'dana');
    const ronId = (await register(first.agent, 'ron')).id;
    await first.srv.stop();
    // An older version let ron - the second account - set remote access up.
    writeRemoteConfig(config, loadOrCreateDeviceKey(config.deviceKeyFile), { ...REMOTE_DEFAULTS, hostname: HOST, duckdnsToken: TOKEN, ownerUserId: ronId });

    const logs: string[] = [];
    const { agent, srv } = await boot(config, (line) => logs.push(line));
    expect(logs.filter((l) => /kept its existing owner/.test(l))).toHaveLength(1);
    expect(logs.join('\n')).not.toContain(TOKEN);
    expect(srv.remote.ownerId()).toBe(ronId);

    const dana = await login(agent, 'dana');
    const ron = await login(agent, 'ron');
    expect((await ron.as(agent.get('/api/server/remote'))).body).toMatchObject({ hostname: HOST, tokenSet: true, hasOwner: true });
    for (const res of [
      await dana.as(agent.get('/api/server/remote')),
      await dana.as(agent.put('/api/server/remote')).send({ hostname: 'danadiary', password: PASSWORD }),
      await dana.as(agent.post('/api/server/remote/test')),
    ]) {
      expect({ status: res.status, body: res.body }).toEqual({ status: 403, body: FORBIDDEN_NOT_OWNER });
    }
    expect(await serverSettings(agent, dana)).toMatchObject({ isRemoteOwner: false });
    expect((await serverSettings(agent, dana)).remote).toBeUndefined();
    expect(await serverSettings(agent, ron)).toMatchObject({ isRemoteOwner: true, remote: { hostname: HOST } });
    expect((await ron.as(agent.put('/api/server/remote')).send({ publicPort: 8443, password: PASSWORD })).status).toBe(200);
    expect(storedRemote(config)).toMatchObject({ ownerUserId: ronId, hostname: HOST, publicPort: 8443 });
  });

  it('give settings without a stored owner to the first account at startup', async () => {
    await mocks();
    const first = await boot();
    const config = first.config;
    const danaId = (await register(first.agent, 'dana')).id;
    await register(first.agent, 'ron');
    await first.srv.stop();
    writeRemoteConfig(config, loadOrCreateDeviceKey(config.deviceKeyFile), { ...REMOTE_DEFAULTS, hostname: HOST, duckdnsToken: TOKEN, ownerUserId: '' });

    const logs: string[] = [];
    const { agent } = await boot(config, (line) => logs.push(line));
    expect(storedRemote(config)).toMatchObject({ ownerUserId: danaId, hostname: HOST });
    expect(logs.filter((l) => /first account/.test(l))).toHaveLength(1);
    const ron = await login(agent, 'ron');
    expect((await ron.as(agent.get('/api/server/remote'))).status).toBe(403);
    const dana = await login(agent, 'dana');
    expect((await dana.as(agent.get('/api/server/remote'))).body).toMatchObject({ hostname: HOST, tokenSet: true });
  });

  it('without a stored owner and no account yet at startup: they become the first account\'s when it registers, so deleting it clears them before the next-oldest account gets in', async () => {
    await mocks();
    const config = testConfig();
    writeRemoteConfig(config, loadOrCreateDeviceKey(config.deviceKeyFile), { ...REMOTE_DEFAULTS, hostname: HOST, duckdnsToken: TOKEN, ownerUserId: '' });
    const logs: string[] = [];
    const { agent, srv } = await boot(config, (line) => logs.push(line));
    // No account yet: nothing to pin at startup.
    expect(storedRemote(config).ownerUserId).toBe('');

    const dana = await register(agent, 'dana');
    // Written down as the first account's right after it was registered (one log line).
    expect(storedRemote(config)).toMatchObject({ ownerUserId: dana.id, hostname: HOST });
    expect(srv.remote.ownerId()).toBe(dana.id);
    expect(logs.filter((l) => /without an owner now belong to the first account/.test(l))).toHaveLength(1);
    const ron = await register(agent, 'ron');
    // A second registration changes nothing.
    expect(storedRemote(config).ownerUserId).toBe(dana.id);
    expect(logs.filter((l) => /without an owner now belong to the first account/.test(l))).toHaveLength(1);
    expect((await ron.as(agent.get('/api/server/remote'))).status).toBe(403);
    expect((await dana.as(agent.get('/api/server/remote'))).body).toMatchObject({ hostname: HOST, tokenSet: true });

    expect((await dana.as(agent.post('/api/auth/delete-account')).send({ password: PASSWORD })).status).toBe(204);
    // Cleared - ron owns remote access now, but gets nothing of the old setup.
    expect(storedRemote(config)).toEqual({ enabled: false, hostname: '', duckdnsTokenEnc: '', publicPort: 443, upnp: true, staging: false, ownerUserId: '' });
    const view = await ron.as(agent.get('/api/server/remote'));
    expect(view.status).toBe(200);
    expect(view.body).toMatchObject({ hasOwner: true, hostname: '', tokenSet: false, enabled: false });
    expect(logs.join('\n')).not.toContain(TOKEN);
  });

  it('without a stored owner: the delete route writes the owner down before deleting, also when that failed after the registration', async () => {
    await mocks();
    const config = testConfig();
    writeRemoteConfig(config, loadOrCreateDeviceKey(config.deviceKeyFile), { ...REMOTE_DEFAULTS, hostname: HOST, duckdnsToken: TOKEN, ownerUserId: '' });
    const { agent, srv } = await boot(config);
    // The pins right after both registrations fail (e.g. the settings file is locked for a moment).
    const manager = srv.remote as unknown as { pinOwner: () => Promise<boolean> };
    const pin = manager.pinOwner.bind(srv.remote);
    let failures = 2;
    manager.pinOwner = async () => {
      if (failures > 0) {
        failures--;
        throw new Error('simulated failure');
      }
      return pin();
    };
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const dana = await register(agent, 'dana');
    const ron = await register(agent, 'ron');
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('could not be given to the first account'));
    expect(storedRemote(config).ownerUserId).toBe('');
    // The deletion writes dana down as the owner first, and then releases her settings.
    expect((await dana.as(agent.post('/api/auth/delete-account')).send({ password: PASSWORD })).status).toBe(204);
    expect(storedRemote(config)).toMatchObject({ ownerUserId: '', hostname: '', duckdnsTokenEnc: '' });
    expect((await ron.as(agent.get('/api/server/remote'))).body).toMatchObject({ hostname: '', tokenSet: false });
  });

  it('without a stored owner: when the owner cannot be written down before a deletion, nothing is deleted', async () => {
    await mocks();
    const config = testConfig();
    writeRemoteConfig(config, loadOrCreateDeviceKey(config.deviceKeyFile), { ...REMOTE_DEFAULTS, hostname: HOST, duckdnsToken: TOKEN, ownerUserId: '' });
    const { agent, srv } = await boot(config);
    const manager = srv.remote as unknown as { pinOwner: () => Promise<boolean> };
    manager.pinOwner = async () => {
      throw new Error('simulated failure');
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const dana = await register(agent, 'dana');
    const ron = await register(agent, 'ron');
    const refused = await dana.as(agent.post('/api/auth/delete-account')).send({ password: PASSWORD });
    expect(refused.status).toBe(500);
    // Dana's account is still there, and so is her (implicit) ownership: ron gets nothing.
    expect((await dana.as(agent.get('/api/auth/me'))).status).toBe(200);
    expect((await login(agent, 'dana')).id).toBe(dana.id);
    expect((await ron.as(agent.get('/api/server/remote'))).status).toBe(403);
    expect(storedRemote(config)).toMatchObject({ hostname: HOST, ownerUserId: '' });
  });

  it('a stored owner that is not an account id is released at startup like a deleted owner - never given to the first account', async () => {
    await mocks();
    const first = await boot();
    const config = first.config;
    await register(first.agent, 'dana');
    await register(first.agent, 'ron');
    await first.srv.stop();
    const key = loadOrCreateDeviceKey(config.deviceKeyFile);
    writeRemoteConfig(config, key, { ...REMOTE_DEFAULTS, enabled: true, hostname: HOST, duckdnsToken: TOKEN, ownerUserId: 'u_deleted.account' });
    expect(readRemoteConfig(config, key).ownerUserId).toBe(UNREADABLE_OWNER);

    const logs: string[] = [];
    const { agent, srv } = await boot(config, (line) => logs.push(line));
    await srv.remote.idle();
    // Released instead of resumed: off, token and name gone, nothing sent to DuckDNS.
    expect(storedRemote(config)).toEqual({ enabled: false, hostname: '', duckdnsTokenEnc: '', publicPort: 443, upnp: true, staging: false, ownerUserId: '' });
    expect(duck.calls).toHaveLength(0);
    expect(logs.filter((l) => /not a valid account id/.test(l))).toHaveLength(1);
    expect(logs.join('\n')).not.toContain(TOKEN);
    // The first account owns remote access now - with nothing of that setup.
    const dana = await login(agent, 'dana');
    expect((await dana.as(agent.get('/api/server/remote'))).body).toMatchObject({ hasOwner: true, hostname: '', tokenSet: false, enabled: false });
  });
});

describe('deleting the owner account', () => {
  it('turns remote access off, closes the router port and forgets the owner, the token, the name and the certificate - then the next-oldest account owns it', async () => {
    await mocks();
    const { agent, config, srv } = await boot();
    const dana = await register(agent, 'dana');
    const ron = await register(agent, 'ron');
    expect((await dana.as(agent.put('/api/server/remote')).send({ enabled: true, hostname: HOST, duckdnsToken: TOKEN, password: PASSWORD })).status).toBe(
      200,
    );
    await srv.remote.idle();
    const tlsPort = srv.remote.status().tlsPort!;
    expect((await httpsGet(tlsPort, HOST, acme.ca.certPem, '/api/health')).status).toBe(200);
    expect(igd.mappings.has(443)).toBe(true);
    expect((await ron.as(agent.get('/api/server/remote'))).status).toBe(403);

    // Deleting another account changes nothing.
    const eve = await register(agent, 'eve');
    expect((await eve.as(agent.post('/api/auth/delete-account')).send({ password: PASSWORD })).status).toBe(204);
    expect(srv.remote.ownerId()).toBe(dana.id);
    expect(srv.remote.status().enabled).toBe(true);
    const zoe = await register(agent, 'zoe');

    const tls = tlsPaths(config.dataDir);
    expect(fs.existsSync(tls.certKey) && fs.existsSync(tls.accountKey)).toBe(true);
    expect((await dana.as(agent.post('/api/auth/delete-account')).send({ password: PASSWORD })).status).toBe(204);
    const s = srv.remote.status();
    expect(s).toMatchObject({ enabled: false, tokenSet: false, urls: [], tlsPort: null, busy: false });
    await expect(httpsGet(tlsPort, HOST, acme.ca.certPem, '/api/health')).rejects.toThrow();
    expect(igd.mappings.has(443)).toBe(false);
    // Nothing of that setup is left for the next owner: settings back to the defaults, no public
    // IP, no certificate - and its keys are gone from the disk.
    expect(s).toMatchObject({ hostname: '', publicPort: 443, upnp: true, staging: false, publicIp: null, certificate: null, lastError: null });
    expect(storedRemote(config)).toEqual({ enabled: false, hostname: '', duckdnsTokenEnc: '', publicPort: 443, upnp: true, staging: false, ownerUserId: '' });
    expect(readRemoteConfig(config, loadOrCreateDeviceKey(config.deviceKeyFile))).toEqual(REMOTE_DEFAULTS);
    for (const file of [tls.accountKey, tls.certKey, tls.certChain, tls.certMeta]) expect(fs.existsSync(file)).toBe(false);

    // Now the next-oldest account (ron) owns remote access and may set it up with its own token and
    // password; a younger account still may not.
    const view = await ron.as(agent.get('/api/server/remote'));
    expect(view.status).toBe(200);
    expect(view.body).toMatchObject({ hasOwner: true, tokenSet: false, enabled: false, hostname: '', certificate: null, publicIp: null });
    expect((await zoe.as(agent.get('/api/server/remote'))).status).toBe(403);
    expect((await zoe.as(agent.put('/api/server/remote')).send({ duckdnsToken: TOKEN, password: PASSWORD })).status).toBe(403);
    expect(await serverSettings(agent, ron)).toMatchObject({ isRemoteOwner: true });
    const claim = await ron.as(agent.put('/api/server/remote')).send({ duckdnsToken: TOKEN, password: PASSWORD });
    expect(claim.status).toBe(200);
    expect(storedRemote(config).ownerUserId).toBe(ron.id);
  });

  it('while the deleted owner\'s settings are still there nobody else gets them; once they are cleared the next-oldest account owns remote access', async () => {
    await mocks();
    const { agent, config, srv } = await boot();
    const dana = await register(agent, 'dana');
    const ron = await register(agent, 'ron');
    expect((await dana.as(agent.put('/api/server/remote')).send({ hostname: 'diarytest', duckdnsToken: TOKEN, password: PASSWORD })).status).toBe(200);

    // The release right after the deletion fails (e.g. the settings file is locked for a moment).
    const manager = srv.remote as unknown as { releaseOwner: (userId: string) => Promise<boolean> };
    const release = manager.releaseOwner.bind(srv.remote);
    let failNext = true;
    manager.releaseOwner = async (userId) => {
      if (failNext) {
        failNext = false;
        throw new Error('simulated failure');
      }
      return release(userId);
    };
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await dana.as(agent.post('/api/auth/delete-account')).send({ password: PASSWORD })).status).toBe(204);
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('could not be released'));

    // The settings of the deleted owner are still stored - and nobody else can see or save over them.
    expect(srv.remote.ownerId()).toBe(dana.id);
    expect(storedRemote(config)).toMatchObject({ ownerUserId: dana.id, hostname: HOST });
    await expect(srv.remote.update({ hostname: 'rondiary' }, ron.id)).rejects.toMatchObject({ status: 403, key: 'server.remote.notOwner' });
    const settings = await serverSettings(agent, ron);
    expect(settings.remote).toBeUndefined();
    // ... but ron is the owner once they are cleared, which his next remote-access request does.
    expect(settings.isRemoteOwner).toBe(true);
    const view = await ron.as(agent.get('/api/server/remote'));
    expect(view.status).toBe(200);
    expect(view.body).toMatchObject({ hasOwner: true, hostname: '', tokenSet: false, enabled: false });
    expect(storedRemote(config)).toMatchObject({ ownerUserId: '', hostname: '', duckdnsTokenEnc: '' });
    expect((await ron.as(agent.put('/api/server/remote')).send({ hostname: 'rondiary', duckdnsToken: TOKEN, password: PASSWORD })).status).toBe(200);
    expect(storedRemote(config)).toMatchObject({ ownerUserId: ron.id, hostname: 'rondiary.duckdns.org' });
  });

  it('an owner whose account no longer exists is released at start-up instead of resuming', async () => {
    await mocks();
    const config = testConfig();
    const key = loadOrCreateDeviceKey(config.deviceKeyFile);
    writeRemoteConfig(config, key, { ...REMOTE_DEFAULTS, enabled: true, hostname: HOST, duckdnsToken: TOKEN, ownerUserId: 'u_0000000000000000' });
    const { srv, agent } = await boot(config);
    await srv.remote.idle();
    // No account at all yet: nobody owns remote access.
    expect(srv.remote.status()).toMatchObject({ enabled: false, tokenSet: false, hasOwner: false, tlsPort: null });
    expect(storedRemote(config)).toMatchObject({ enabled: false, duckdnsTokenEnc: '', ownerUserId: '' });
    expect(duck.calls).toHaveLength(0);
    expect(acme.orders).toHaveLength(0);
    // The first account created owns it and can set it up again.
    const dana = await register(agent, 'dana');
    expect((await dana.as(agent.get('/api/server/remote'))).body).toMatchObject({ hasOwner: true, tokenSet: false });
  });

  it('a release still removing the router port cannot undo a save the next owner makes meanwhile', async () => {
    await mocks();
    const { agent, config, srv } = await boot();
    const dana = await register(agent, 'dana');
    const ron = await register(agent, 'ron');
    const eve = await register(agent, 'eve');
    expect((await dana.as(agent.put('/api/server/remote')).send({ enabled: true, hostname: HOST, duckdnsToken: TOKEN, password: PASSWORD })).status).toBe(
      200,
    );
    await srv.remote.idle();
    expect(igd.mappings.has(443)).toBe(true);
    // A slow router: the first removal of the port mapping takes 1.5 s.
    const manager = srv.remote as unknown as { removeMapping: () => Promise<void> };
    const removeMapping = manager.removeMapping.bind(srv.remote);
    let slow = true;
    manager.removeMapping = async () => {
      if (slow) {
        slow = false;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      return removeMapping();
    };
    const deletion = dana
      .as(agent.post('/api/auth/delete-account'))
      .send({ password: PASSWORD })
      .then((res) => res);
    // The release has started (remote access is off in memory) - ron, the next-oldest account, saves right now.
    for (let i = 0; i < 1000 && srv.remote.status().enabled; i++) await new Promise((resolve) => setTimeout(resolve, 5));
    expect(srv.remote.status().enabled).toBe(false);
    const claim = await ron.as(agent.put('/api/server/remote')).send({ hostname: 'rondiary', duckdnsToken: TOKEN, password: PASSWORD });
    expect((await deletion).status).toBe(204);
    expect(claim.status).toBe(200);

    // Memory and file agree: ron owns remote access, with his name and token.
    expect(srv.remote.ownerId()).toBe(ron.id);
    expect(storedRemote(config)).toMatchObject({ ownerUserId: ron.id, hostname: 'rondiary.duckdns.org' });
    expect(srv.remote.status()).toMatchObject({ hasOwner: true, tokenSet: true, hostname: 'rondiary.duckdns.org', enabled: false });
    expect(igd.mappings.has(443)).toBe(false);
    // ... and no other account can take it over.
    const takeover = await eve.as(agent.put('/api/server/remote')).send({ hostname: 'evediary', password: PASSWORD });
    expect(takeover.status).toBe(403);
    expect(storedRemote(config).ownerUserId).toBe(ron.id);
  });
});
