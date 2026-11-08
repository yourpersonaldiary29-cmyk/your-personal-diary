/**
 * Regression tests of the remote-access security review:
 *   - no new accounts over the internet listener; sign-in failures from the network never lock
 *     the owner out at the computer itself;
 *   - the HTTPS listener closes as soon as its certificate has expired, even while DuckDNS and
 *     Let's Encrypt cannot be reached;
 *   - turning remote access off while a timer-driven router refresh runs leaves no port mapping;
 *     a server stop asks the router to close the port too;
 *   - the ACME client never follows a URL to another host;
 *   - the MPD_* test overrides accept only targets on this computer.
 */
import http from 'node:http';
import express from 'express';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import type { RemoteStatus } from '@shared/types';
import type { ServerConfig } from '../src/config';
import { obtainCertificate } from '../src/remote/acme';
import { remoteOverridesFromEnv } from '../src/remote/env-overrides';
import type { RemoteManagerOptions } from '../src/remote/manager';
import { generateEcKey } from '../src/remote/tls-store';
import { REGISTER_REMOTE_KEY } from '../src/routes/auth';
import { createAuthService, LOGIN_LOCKED_KEY, type DiaryAuthService } from '../src/security/auth-service';
import { startServer, type RunningServer } from '../src/server';
import { cleanupTempDirs, makeTestApp, testConfig } from './helpers';
import {
  closeServer,
  httpsGet,
  listenLocal,
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
const DAY = 86_400_000;

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c().catch(() => {});
});
afterAll(cleanupTempDirs);

// Internet sign-ins -------------------------------------------------------------------------------

/** Serves `app` as if every request arrived over TLS from an internet address. */
async function asInternet(app: http.RequestListener): Promise<supertest.Agent> {
  const server = http.createServer((req, res) => {
    Object.defineProperty(req.socket, 'remoteAddress', { value: '198.51.100.23', configurable: true });
    (req.socket as { encrypted?: boolean }).encrypted = true;
    app(req, res);
  });
  const port = await listenLocal(server);
  cleanups.push(() => closeServer(server));
  return supertest.agent(`http://127.0.0.1:${port}`);
}

async function authService(): Promise<DiaryAuthService> {
  const svc = (await createAuthService(testConfig(), { kdf: { N: 2048, r: 8, p: 1 } })) as DiaryAuthService;
  cleanups.push(() => svc.shutdown());
  await svc.register({
    firstName: 'Dana',
    lastName: 'Cohen',
    username: 'dana',
    email: 'dana@example.com',
    password: PASSWORD,
    rememberMe: false,
    deviceName: 'PC',
  } as Parameters<DiaryAuthService['register']>[0]);
  return svc;
}

const REGISTER_BODY = {
  firstName: 'Eve',
  lastName: 'Stranger',
  username: 'eve',
  email: 'eve@example.com',
  password: PASSWORD,
  confirmPassword: PASSWORD,
  rememberMe: false,
};

describe('sign-in and registration over the internet listener', () => {
  it('refuses to create accounts from the internet (localised), while the computer itself still can', async () => {
    const svc = await authService();
    const app = await makeTestApp({ auth: svc });
    const internet = await asInternet(app.app);

    const refused = await internet.post('/api/auth/register').set('Accept-Language', 'en').send(REGISTER_BODY);
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ code: 'FORBIDDEN', message: t('en', REGISTER_REMOTE_KEY) });
    const refusedHe = await internet.post('/api/auth/register').set('Accept-Language', 'he').send(REGISTER_BODY);
    expect(refusedHe.body.message).toBe(t('he', REGISTER_REMOTE_KEY));
    expect(svc.listAccounts().map((a) => a.username)).toEqual(['dana']);

    // The owner's existing account signs in over the internet.
    const login = await internet.post('/api/auth/login').send({ username: 'dana', password: PASSWORD, rememberMe: false });
    expect(login.status).toBe(200);

    // At the computer (loopback) registration works as before.
    const local = await app.anon().post('/api/auth/register').send(REGISTER_BODY);
    expect(local.status).toBe(201);
  });

  it('10 wrong passwords over the internet lock network sign-ins only - never the desktop', async () => {
    const svc = await authService();
    const app = await makeTestApp({ auth: svc });
    const internet = await asInternet(app.app);
    for (let i = 0; i < 10; i++) {
      await internet.post('/api/auth/login').send({ username: 'dana', password: 'wrong-pass1', rememberMe: false });
    }
    const locked = await internet.post('/api/auth/login').set('Accept-Language', 'en').send({ username: 'dana', password: PASSWORD, rememberMe: false });
    expect(locked.status).toBe(429);
    expect(locked.body.message).toBe(t('en', LOGIN_LOCKED_KEY, { minutes: 15 }));

    const desktop = await app.anon().post('/api/auth/login').send({ username: 'dana', password: PASSWORD, rememberMe: false });
    expect(desktop.status).toBe(200);
    // ...and a desktop sign-in does not unlock the network channel.
    expect((await internet.post('/api/auth/login').send({ username: 'dana', password: PASSWORD, rememberMe: false })).status).toBe(429);
  });
});

// Real server + mocks -----------------------------------------------------------------------------

interface Mocks {
  duck: MockDuckDns;
  acme: MockAcme;
  igd: MockIgd;
}

async function mocks(): Promise<Mocks> {
  const duck = await startMockDuckDns({ token: TOKEN, domain: 'diarytest', ip: PUBLIC_IP });
  const acme = await startMockAcme({ txtFor: (n) => duck.txtFor(n) });
  const igd = await startMockIgd({ externalIp: PUBLIC_IP });
  cleanups.push(() => duck.close(), () => acme.close(), () => igd.close());
  return { duck, acme, igd };
}

async function enabledServer(m: Mocks, extra: Partial<RemoteManagerOptions> = {}, config: ServerConfig = testConfig()) {
  const srv: RunningServer = await startServer(config, {
    port: 0,
    quiet: true,
    remote: {
      directoryUrl: m.acme.directoryUrl,
      duckdnsBaseUrl: m.duck.baseUrl,
      upnp: upnpOptionsFor(m.igd),
      waitForTxt: async (name, value) => m.duck.txtFor(name) === value,
      resolveHost: async () => [PUBLIC_IP],
      acmePollMs: 10,
      tlsPort: 0,
      tlsHost: '127.0.0.1',
      fallbackTlsPort: null,
      retryDelaysMs: [60_000],
      lanIps: () => ['192.168.1.20'],
      log: () => {},
      ...extra,
    },
  });
  let stopped = false;
  cleanups.push(async () => {
    if (!stopped) await srv.stop();
  });
  const agent = supertest(`http://127.0.0.1:${srv.port}`);
  const reg = await agent.post('/api/auth/register').send({ ...REGISTER_BODY, username: 'dana', email: 'dana@example.com' });
  expect(reg.status).toBe(201);
  const auth = (req: supertest.Test) => req.set('Authorization', `Bearer ${reg.body.token as string}`).set('Accept-Language', 'en');
  const put = await auth(agent.put('/api/server/remote')).send({ enabled: true, hostname: HOST, duckdnsToken: TOKEN, password: PASSWORD });
  expect(put.status).toBe(200);
  await srv.remote.idle();
  return {
    srv,
    agent,
    auth,
    stop: async () => {
      stopped = true;
      await srv.stop();
    },
  };
}

async function waitFor(check: () => boolean, ms = 5000): Promise<void> {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error('condition not reached in time');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('remote access lifecycle hardening', () => {
  it('closes HTTPS once the certificate has expired, even while DuckDNS and Let’s Encrypt are unreachable', async () => {
    const m = await mocks();
    let shift = 0;
    const { srv } = await enabledServer(m, { ipUpdateIntervalMs: 40, now: () => new Date(Date.now() + shift) });
    const tlsPort = srv.remote.status().tlsPort!;
    expect((await httpsGet(tlsPort, HOST, m.acme.ca.certPem, '/api/health')).status).toBe(200);

    await m.duck.close();
    await m.acme.close();
    shift = 91 * DAY;
    await waitFor(() => srv.remote.status().tlsPort === null);
    await srv.remote.idle();

    const s: RemoteStatus = srv.remote.status();
    expect(s.urls).toEqual([]);
    expect(s.steps.find((st) => st.id === 'listener')?.state).toBe('idle');
    const certStep = s.steps.find((st) => st.id === 'certificate')!;
    expect(certStep).toMatchObject({ state: 'error', messageKey: 'server.remote.step.certificate.expired' });
    expect(t('en', certStep.messageKey, certStep.params)).toMatch(/^The certificate expired on \d{4}-\d{2}-\d{2}\./);
    expect(s.steps.find((st) => st.id === 'duckdns')?.state).toBe('error');
    await expect(httpsGet(tlsPort, HOST, m.acme.ca.certPem, '/api/health')).rejects.toThrow();
  });

  it('turning it off while the router mapping is being refreshed leaves no mapping behind', async () => {
    const m = await mocks();
    const { srv, agent, auth } = await enabledServer(m, { upnpRefreshIntervalMs: 15 });
    expect(m.igd.mappings.has(443)).toBe(true);
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 7 * i));
      const off = await auth(agent.put('/api/server/remote')).send({ enabled: false, password: PASSWORD });
      expect(off.status).toBe(200);
      await new Promise((r) => setTimeout(r, 60));
      expect(m.igd.mappings.has(443)).toBe(false);
      const on = await auth(agent.put('/api/server/remote')).send({ enabled: true, password: PASSWORD });
      expect(on.status).toBe(200);
      await srv.remote.idle();
      expect(m.igd.mappings.has(443)).toBe(true);
    }
  });

  it('a server stop asks the router to close the port (the next start opens it again)', async () => {
    const m = await mocks();
    const config = testConfig();
    const first = await enabledServer(m, {}, config);
    expect(m.igd.mappings.has(443)).toBe(true);
    await first.stop();
    expect(m.igd.mappings.has(443)).toBe(false);
  });
});

// ACME origin -------------------------------------------------------------------------------------

describe('ACME client', () => {
  it('never follows a URL to another host', async () => {
    const hits: string[] = [];
    const foreign = express();
    foreign.use((req, res) => {
      hits.push(req.url);
      res.status(200).setHeader('Replay-Nonce', 'abc').end();
    });
    const foreignServer = http.createServer(foreign);
    const foreignPort = await listenLocal(foreignServer);
    cleanups.push(() => closeServer(foreignServer));

    const dirApp = express();
    // 'localhost' is another origin than '127.0.0.1' for the client.
    dirApp.get('/directory', (_req, res) => {
      res.json({
        newNonce: `http://localhost:${foreignPort}/nonce`,
        newAccount: `http://localhost:${foreignPort}/acct`,
        newOrder: `http://localhost:${foreignPort}/order`,
      });
    });
    const dirServer = http.createServer(dirApp);
    const dirPort = await listenLocal(dirServer);
    cleanups.push(() => closeServer(dirServer));

    const err = await obtainCertificate({
      directoryUrl: `http://127.0.0.1:${dirPort}/directory`,
      hostname: HOST,
      accountKey: generateEcKey(),
      setTxt: async () => {},
      clearTxt: async () => {},
      waitForTxt: async () => true,
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ key: 'server.remote.step.certificate.rejected', params: { detail: 'the ACME server pointed to another host' } });
    expect(hits).toEqual([]);
  });
});

// Test overrides ------------------------------------------------------------------------------------

describe('MPD_* test overrides', () => {
  it('are empty in normal use', () => {
    expect(remoteOverridesFromEnv({})).toEqual({ options: {}, notes: [] });
  });

  it('accept loopback targets and skip the DNS wait for a mocked DuckDNS', async () => {
    const o = remoteOverridesFromEnv({
      MPD_ACME_DIRECTORY: 'http://127.0.0.1:4000/directory',
      MPD_DUCKDNS_BASE: 'http://localhost:4001',
      MPD_UPNP_SSDP: '127.0.0.1:4002',
      MPD_REMOTE_TLS_HOST: '127.0.0.1',
    });
    expect(o.options.directoryUrl).toBe('http://127.0.0.1:4000/directory');
    expect(o.options.duckdnsBaseUrl).toBe('http://localhost:4001/');
    expect(await o.options.waitForTxt?.('_acme-challenge.x.duckdns.org', 'v')).toBe(true);
    expect(o.options.upnp).toMatchObject({ ssdpAddress: '127.0.0.1', ssdpPort: 4002, interfaces: ['127.0.0.1'], allowLoopback: true });
    expect(o.options.tlsHost).toBe('127.0.0.1');
    expect(o.notes).toHaveLength(4);
  });

  it('look the name up in the mock DuckDNS for "Test connection" (never a real DNS query)', async () => {
    const duck = await startMockDuckDns({ token: 'e2e0e2e0-0000-4000-8000-00000000e2e0', domain: 'mockname', ip: '203.0.113.9' });
    try {
      const o = remoteOverridesFromEnv({ MPD_DUCKDNS_BASE: duck.baseUrl });
      expect(await o.options.resolveHost?.('mockname.duckdns.org')).toEqual(['203.0.113.9']);
      await expect(o.options.resolveHost?.('othername.duckdns.org')).rejects.toThrow(/404/);
      // Every lookup went to the mock.
      expect(duck.calls.map((q) => q.get('domains'))).toEqual(['mockname', 'othername']);
    } finally {
      await duck.close();
    }
  });

  it('ignore anything that points away from this computer', () => {
    const o = remoteOverridesFromEnv({
      MPD_ACME_DIRECTORY: 'https://evil.example/directory',
      MPD_DUCKDNS_BASE: 'http://127.0.0.1.evil.example',
      MPD_UPNP_SSDP: '192.168.1.1:1900',
      MPD_REMOTE_TLS_HOST: '0.0.0.0',
    });
    expect(o.options).toEqual({});
    expect(o.notes.every((n) => n.includes('ignored'))).toBe(true);
    expect(o.notes).toHaveLength(4);
  });
});

