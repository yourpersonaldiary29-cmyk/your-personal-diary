/**
 * Remote access end to end (server.ts + remote/manager.ts + routes/server.ts): a real server on
 * 127.0.0.1 whose remote manager talks to in-process mocks - DuckDNS, an ACME server issuing
 * test-CA certificates, and a UPnP gateway. Nothing leaves the machine.
 */
import fs from 'node:fs';
import express from 'express';
import supertest from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RemoteStatus, RemoteTestResult, ServerInfo, ServerSettings } from '@shared/types';
import type { AppDeps } from '../src/app';
import type { ServerConfig } from '../src/config';
import { DiaryDb } from '../src/db/database';
import { errorHandler } from '../src/middleware/error';
import { localeMiddleware } from '../src/middleware/locale';
import type { RemoteManagerOptions } from '../src/remote/manager';
import { serverRouter, type RemoteController } from '../src/routes/server';
import { startServer, type RunningServer } from '../src/server';
import { cleanupTempDirs, fakeAuth, makeTestApp, tempDataDir, testConfig } from './helpers';
import {
  httpsGet,
  startMockAcme,
  startMockDuckDns,
  startMockIgd,
  upnpOptionsFor,
  type MockAcme,
  type MockAcmeOptions,
  type MockDuckDns,
  type MockIgd,
} from './remote-fixtures';

const HOST = 'diarytest.duckdns.org';
const TOKEN = '0123abcd-4567-89ab-cdef-0123456789ab';
const PUBLIC_IP = '203.0.113.7';
const PASSWORD = 'Passw0rd!';

let duck: MockDuckDns;
let acme: MockAcme;
let igd: MockIgd;
let logs: string[];
let events: { event: string; data: Record<string, unknown> }[];
const running: RunningServer[] = [];

async function mocks(acmeOpts: Partial<MockAcmeOptions> = {}) {
  duck = await startMockDuckDns({ token: TOKEN, domain: 'diarytest', ip: PUBLIC_IP });
  acme = await startMockAcme({ txtFor: (n) => duck.txtFor(n), ...acmeOpts });
  igd = await startMockIgd({ externalIp: PUBLIC_IP });
}

beforeEach(() => {
  logs = [];
  events = [];
});
afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
  for (const m of [duck, acme, igd]) await m?.close();
  duck = acme = igd = undefined as never;
});
afterAll(cleanupTempDirs);

function remoteOptions(extra: Partial<RemoteManagerOptions> = {}): RemoteManagerOptions {
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
    log: (line) => logs.push(line),
    emit: (event, data) => events.push({ event, data }),
    ...extra,
  };
}

async function boot(config: ServerConfig = testConfig(), extra: Partial<RemoteManagerOptions> = {}) {
  const srv = await startServer(config, { port: 0, quiet: true, remote: remoteOptions(extra) });
  running.push(srv);
  const base = `http://127.0.0.1:${srv.port}`;
  const agent = supertest(base);
  return { srv, base, agent, config };
}

async function register(agent: supertest.Agent | ReturnType<typeof supertest>): Promise<string> {
  const res = await agent
    .post('/api/auth/register')
    .send({ firstName: 'Dana', lastName: 'Cohen', username: 'dana', email: 'dana@example.com', password: PASSWORD, confirmPassword: PASSWORD, rememberMe: false });
  expect(res.status).toBe(201);
  return res.body.token as string;
}

async function enabled(extra: Partial<RemoteManagerOptions> = {}, config?: ServerConfig) {
  const b = await boot(config, extra);
  const token = await register(b.agent);
  const auth = (t: supertest.Test) => t.set('Authorization', `Bearer ${token}`).set('Accept-Language', 'en');
  const put = await auth(b.agent.put('/api/server/remote')).send({ enabled: true, hostname: 'DiaryTest', duckdnsToken: TOKEN, password: PASSWORD });
  expect(put.status).toBe(200);
  await b.srv.remote.idle();
  return { ...b, token, auth, put };
}

function stepStates(s: RemoteStatus) {
  return Object.fromEntries(s.steps.map((st) => [st.id, `${st.state}:${st.messageKey.replace('server.remote.step.', '')}`]));
}

describe('turning remote access on', () => {
  it('runs DuckDNS -> certificate -> HTTPS -> router, and serves the app over HTTPS', async () => {
    await mocks();
    const { srv, agent, auth, put, config } = await enabled();

    const initial = put.body as RemoteStatus;
    expect(initial).toMatchObject({ enabled: true, hostname: HOST, tokenSet: true, publicPort: 443, upnp: true, staging: false });
    expect(JSON.stringify(initial)).not.toContain(TOKEN);

    const res = await auth(agent.get('/api/server/remote'));
    const status = res.body as RemoteStatus;
    expect(stepStates(status)).toEqual({
      duckdns: 'ok:duckdns.ok',
      certificate: 'ok:certificate.ok',
      listener: 'ok:listener.ok',
      upnp: 'ok:upnp.ok',
    });
    expect(status.steps[0].params).toEqual({ hostname: HOST, ip: PUBLIC_IP });
    expect(status.publicIp).toBe(PUBLIC_IP);
    expect(status.urls).toEqual([`https://${HOST}`]);
    expect(status.busy).toBe(false);
    expect(status.lastError).toBeNull();
    expect(status.nextRetryAt).toBeNull();
    expect(status.lanIps).toEqual(['192.168.1.20']);
    expect(status.certificate).toMatchObject({ issuer: 'Mock ACME / Test ACME Root', staging: false });
    expect(status.certificate!.daysLeft).toBeGreaterThanOrEqual(89);
    expect(status.steps.every((s) => typeof s.at === 'string')).toBe(true);
    expect(JSON.stringify(status)).not.toContain(TOKEN);

    // HTTPS serves the same app, with HSTS; a foreign Host is refused with 421.
    const tlsPort = status.tlsPort!;
    const health = await httpsGet(tlsPort, HOST, acme.ca.certPem, '/api/health');
    expect(health.status).toBe(200);
    expect(JSON.parse(health.body)).toMatchObject({ ok: true });
    expect(health.headers['strict-transport-security']).toBe('max-age=31536000');
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    expect(String(health.headers['content-security-policy'])).toContain("frame-ancestors 'none'");
    const foreign = await httpsGet(tlsPort, HOST, acme.ca.certPem, '/api/health', 'evil.example');
    expect(foreign.status).toBe(421);
    const infoTls = JSON.parse((await httpsGet(tlsPort, HOST, acme.ca.certPem, '/api/server/info')).body) as ServerInfo;
    expect(infoTls).toMatchObject({ secure: true, remoteEnabled: true, remoteUrl: `https://${HOST}` });

    // The host check guards the loopback listener too while remote access is on.
    expect((await agent.get('/api/health').set('Host', 'evil.example')).status).toBe(421);
    expect((await agent.get('/api/health')).status).toBe(200);

    // Info / settings views; the router mapping; nothing secret on disk or in the log.
    const info = (await agent.get('/api/server/info')).body as ServerInfo;
    expect(info).toMatchObject({ remoteEnabled: true, remoteUrl: `https://${HOST}`, secure: false, isLocalRequest: true });
    const settings = (await auth(agent.get('/api/server/settings'))).body as ServerSettings;
    expect(settings.remote).toEqual({ enabled: true, hostname: HOST, tokenSet: true, publicPort: 443, upnp: true, staging: false });
    expect(igd.mappings.get(443)).toEqual({ internalClient: '127.0.0.1', internalPort: tlsPort, description: 'Your Personal Diary', lease: '0' });
    expect(fs.readFileSync(config.settingsFile, 'utf8')).not.toContain(TOKEN);
    expect(fs.existsSync(`${config.dataDir}/tls/cert.pem`)).toBe(true);
    expect(logs.join('\n')).toContain(`REMOTE ACCESS IS ON: https://${HOST}`);
    expect(logs.join('\n')).not.toContain(TOKEN);
    expect(events.some((e) => e.event === 'remote' && e.data.enabled === true && e.data.url === `https://${HOST}`)).toBe(true);
    expect(JSON.stringify(events)).not.toContain(TOKEN);
    expect(srv.getSettings().remote?.tokenSet).toBe(true);
  });

  it('renewing issues a new certificate and hot-reloads it', async () => {
    await mocks();
    const { agent, auth, srv } = await enabled();
    const tlsPort = srv.remote.status().tlsPort!;
    const before = await httpsGet(tlsPort, HOST, acme.ca.certPem, '/api/health');
    const renew = await auth(agent.post('/api/server/remote/renew'));
    expect(renew.status).toBe(200);
    await srv.remote.idle();
    const after = await httpsGet(tlsPort, HOST, acme.ca.certPem, '/api/health');
    expect(after.status).toBe(200);
    expect(after.serial).not.toBe(before.serial);
    expect(acme.orders).toHaveLength(2);
    expect(srv.remote.status().tlsPort).toBe(tlsPort);
  });

  it('turning it off closes HTTPS and removes the router mapping, keeping the saved token', async () => {
    await mocks();
    const { agent, auth, srv } = await enabled();
    const tlsPort = srv.remote.status().tlsPort!;
    const off = await auth(agent.put('/api/server/remote')).send({ enabled: false, password: PASSWORD });
    expect(off.status).toBe(200);
    const s = off.body as RemoteStatus;
    expect(s).toMatchObject({ enabled: false, tokenSet: true, urls: [], tlsPort: null, busy: false });
    expect(s.steps.every((st) => st.state === 'idle')).toBe(true);
    await expect(httpsGet(tlsPort, HOST, acme.ca.certPem, '/api/health')).rejects.toThrow();
    expect(igd.mappings.has(443)).toBe(false);
    expect(igd.actions.some((a) => a.action === 'DeletePortMapping' && a.args.NewExternalPort === '443')).toBe(true);
    // The host check stays on (DNS rebinding), and the public name no longer counts once remote access is off.
    expect((await agent.get('/api/health').set('Host', 'evil.example')).status).toBe(421);
    expect((await agent.get('/api/health').set('Host', HOST)).status).toBe(421);
    expect((await agent.get('/api/health')).status).toBe(200);
    expect((await agent.get('/api/server/info')).body).toMatchObject({ remoteEnabled: false, remoteUrl: '' });
  });

  it('resumes after a restart with the stored certificate (no new order)', async () => {
    await mocks();
    const config = testConfig(tempDataDir());
    const first = await enabled({}, config);
    await first.srv.stop();
    running.splice(running.indexOf(first.srv), 1);
    expect(acme.orders).toHaveLength(1);

    const second = await boot(config);
    await second.srv.remote.idle();
    const s = second.srv.remote.status();
    expect(stepStates(s)).toEqual({ duckdns: 'ok:duckdns.ok', certificate: 'ok:certificate.ok', listener: 'ok:listener.ok', upnp: 'ok:upnp.ok' });
    expect(acme.orders).toHaveLength(1);
    expect((await httpsGet(s.tlsPort!, HOST, acme.ca.certPem, '/api/health')).status).toBe(200);
    expect(igd.mappings.get(443)?.internalPort).toBe(s.tlsPort);
  });
});

describe('failures', () => {
  it('a wrong DuckDNS token stops at the first step, reports it and schedules a retry', async () => {
    await mocks();
    const b = await boot();
    const token = await register(b.agent);
    const res = await b.agent
      .put('/api/server/remote')
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true, hostname: HOST, duckdnsToken: 'ffffffff-ffff-ffff-ffff-ffffffffffff', password: PASSWORD });
    expect(res.status).toBe(200);
    await b.srv.remote.idle();
    const s = b.srv.remote.status();
    expect(stepStates(s)).toEqual({ duckdns: 'error:duckdns.rejected', certificate: 'idle:certificate.idle', listener: 'idle:listener.idle', upnp: 'idle:upnp.idle' });
    expect(s.lastError).toEqual({ messageKey: 'server.remote.step.duckdns.rejected', params: { hostname: HOST } });
    expect(s.nextRetryAt).not.toBeNull();
    expect(s.urls).toEqual([]);
    expect(acme.orders).toHaveLength(0);
  });

  it('a certificate failure leaves HTTPS closed and says why', async () => {
    await mocks({ rateLimited: true });
    const { srv } = await enabled();
    const s = srv.remote.status();
    expect(stepStates(s)).toEqual({ duckdns: 'ok:duckdns.ok', certificate: 'error:certificate.rateLimited', listener: 'idle:listener.idle', upnp: 'idle:upnp.idle' });
    expect(s.lastError?.messageKey).toBe('server.remote.step.certificate.rateLimited');
    expect(s.tlsPort).toBeNull();
    expect(s.nextRetryAt).not.toBeNull();
  });

  it('no UPnP router: HTTPS still runs and the step explains the manual port forwarding', async () => {
    await mocks();
    const { srv } = await enabled({ upnp: { ...upnpOptionsFor(igd), ssdpPort: 9, timeoutMs: 300 } });
    const s = srv.remote.status();
    const upnpStep = s.steps.find((st) => st.id === 'upnp')!;
    expect(upnpStep.state).toBe('error');
    expect(upnpStep.messageKey).toBe('server.remote.step.upnp.notFound');
    expect(upnpStep.params).toEqual({ publicPort: '443', lanIp: '192.168.1.20', port: String(s.tlsPort) });
    expect(s.urls).toEqual([`https://${HOST}`]);
  });

  it('validation: enabling needs a name and a token; bad values name their field', async () => {
    await mocks();
    const b = await boot();
    const token = await register(b.agent);
    const put = (body: object) => b.agent.put('/api/server/remote').set('Authorization', `Bearer ${token}`).set('Accept-Language', 'en').send({ ...body, password: PASSWORD });
    expect((await put({ enabled: true })).body).toMatchObject({ code: 'VALIDATION', field: 'hostname' });
    expect((await put({ enabled: true, hostname: HOST })).body).toMatchObject({ code: 'VALIDATION', field: 'duckdnsToken' });
    const bad = await put({ duckdnsToken: 'abc' });
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ code: 'VALIDATION', field: 'duckdnsToken', message: expect.stringContaining('DuckDNS token') });
    expect((await put({ publicPort: 99999 })).body).toMatchObject({ field: 'publicPort' });
    expect(b.srv.remote.status().enabled).toBe(false);
    // Remote endpoints need a session.
    expect((await b.agent.get('/api/server/remote')).status).toBe(401);
  });
});

describe('POST /api/server/remote/test', () => {
  it('checks DuckDNS, the router and the DNS name before anything is saved', async () => {
    await mocks();
    const b = await boot();
    const token = await register(b.agent);
    const res = await b.agent
      .post('/api/server/remote/test')
      .set('Authorization', `Bearer ${token}`)
      .send({ hostname: 'diarytest', duckdnsToken: TOKEN });
    expect(res.status).toBe(200);
    const r = res.body as RemoteTestResult;
    expect(r.publicIp).toBe(PUBLIC_IP);
    expect(r.checks.map((c) => `${c.id}:${c.state}:${c.messageKey.replace('server.remote.test.', '')}`)).toEqual([
      'duckdns:ok:duckdns.ok',
      'upnp:ok:upnp.ok',
      'dns:ok:dns.ok',
      'https:skipped:https.off',
    ]);
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    // Nothing was saved.
    expect(b.srv.remote.status()).toMatchObject({ hostname: '', tokenSet: false, enabled: false });
    // Without any saved or given token the test is a validation error.
    const none = await b.agent.post('/api/server/remote/test').set('Authorization', `Bearer ${token}`).send({ hostname: 'diarytest' });
    expect(none.body).toMatchObject({ code: 'VALIDATION', field: 'duckdnsToken' });
  });

  it('reports a DNS name that points elsewhere as a warning', async () => {
    await mocks();
    const b = await boot(undefined, { resolveHost: async () => ['198.51.100.99'] });
    const token = await register(b.agent);
    const r = (await b.agent.post('/api/server/remote/test').set('Authorization', `Bearer ${token}`).send({ hostname: HOST, duckdnsToken: TOKEN }))
      .body as RemoteTestResult;
    const dns = r.checks.find((c) => c.id === 'dns')!;
    expect(dns).toEqual({ id: 'dns', state: 'warning', messageKey: 'server.remote.test.dns.mismatch', params: { hostname: HOST, resolved: '198.51.100.99', ip: PUBLIC_IP } });
  });
});

describe('route guards', () => {
  async function routerApp(remote: RemoteController | undefined) {
    const db = await DiaryDb.create();
    const config = testConfig();
    const deps: AppDeps & { remote?: RemoteController } = {
      config,
      auth: fakeAuth(db),
      getServerSettings: () => ({ port: 1, lanEnabled: true }),
      setServerSettings: async (s) => s,
      getListenInfo: () => ({ port: 1, lanUrls: ['http://192.168.1.20:1'], startedAt: '' }),
      remote,
    };
    const app = express();
    app.use(express.json());
    app.use(localeMiddleware);
    // As if the request came from a phone / the internet (not loopback).
    app.use((req, _res, next) => {
      req.isLocal = false;
      next();
    });
    app.use('/api/server', serverRouter(deps));
    app.use(errorHandler);
    return app;
  }
  const stub: RemoteController = {
    status: () => ({}) as RemoteStatus,
    update: async () => ({}) as RemoteStatus,
    renew: async () => ({}) as RemoteStatus,
    test: async () => ({ checks: [], publicIp: null, at: '' }),
    settings: () => ({ enabled: true, hostname: HOST, tokenSet: true, publicPort: 443, upnp: true, staging: false }),
    info: () => ({ enabled: true, url: `https://${HOST}` }),
    ownerId: () => '',
    releaseOwner: async () => false,
  };

  it('remote endpoints answer 403 to anything but the computer itself', async () => {
    const app = await routerApp(stub);
    for (const [method, url] of [
      ['get', '/api/server/remote'],
      ['put', '/api/server/remote'],
      ['post', '/api/server/remote/renew'],
      ['post', '/api/server/remote/test'],
    ] as const) {
      const res = await supertest(app)[method](url).set('Authorization', 'Bearer test-token').set('Accept-Language', 'en');
      expect({ url, status: res.status, message: res.body.message }).toEqual({
        url,
        status: 403,
        message: 'Remote access can only be set up on the computer itself',
      });
    }
  });

  it('/info does not reveal the remote address to a LAN client', async () => {
    const app = await routerApp(stub);
    const info = (await supertest(app).get('/api/server/info')).body as ServerInfo;
    expect(info).toMatchObject({ remoteEnabled: true, remoteUrl: '', secure: false, isLocalRequest: false, dataDir: '' });
  });

  it('an app without a remote controller answers 403 unavailable', async () => {
    const app = await makeTestApp();
    const res = await app.get('/api/server/remote').set('Accept-Language', 'en');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Remote access is not available right now');
  });
});
