/**
 * Internet-exposure guards: the Host check (421, middleware/host-check.ts), HSTS on HTTPS answers,
 * and the LAN guard letting the remote-access HTTPS listener through.
 */
import http from 'node:http';
import os from 'node:os';
import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import { isRemoteRequest, lanGuard, markLocal, securityHeaders } from '../src/middleware/access';
import { errorHandler } from '../src/middleware/error';
import { hostCheck, hostOf, isAllowedHost, type HostPolicy } from '../src/middleware/host-check';
import { localeMiddleware } from '../src/middleware/locale';

const HOST = 'yourpersonaldiary.duckdns.org';

describe('hostOf / isAllowedHost', () => {
  it('extracts the host part', () => {
    expect(hostOf('Example.ORG:443')).toBe('example.org');
    expect(hostOf('example.org.')).toBe('example.org');
    expect(hostOf('[::1]:47321')).toBe('::1');
    expect(hostOf('::1')).toBe('::1');
    expect(hostOf(undefined)).toBe('');
    expect(hostOf('')).toBe('');
  });

  it('allows the remote name, localhost, loopback and LAN literals - nothing else', () => {
    for (const h of [
      HOST,
      `${HOST}:443`,
      'YourPersonalDiary.DuckDNS.org',
      'localhost:47321',
      'tauri.localhost',
      '127.0.0.1:47321',
      '[::1]:47321',
      '192.168.1.20:47321',
      '10.0.0.5',
      '172.20.1.1',
      '169.254.10.10',
      '[fe80::1]',
      '[fd00::5]:80',
    ]) {
      expect({ h, ok: isAllowedHost(h, HOST) }).toEqual({ h, ok: true });
    }
    for (const h of ['evil.example', 'other.duckdns.org', '203.0.113.9', '8.8.8.8:443', '', 'duckdns.org', `${HOST}.evil.example`]) {
      expect({ h, ok: isAllowedHost(h, HOST) }).toEqual({ h, ok: false });
    }
    expect(isAllowedHost(undefined, HOST)).toBe(false);
  });
});

function appWith(policy: HostPolicy) {
  const inner = express();
  inner.get('/api/health', (_req, res) => res.json({ ok: true }));
  inner.get('/', (_req, res) => res.send('ui'));
  const guard = hostCheck(() => policy);
  return http.createServer((req, res) => guard(req, res, () => inner(req, res)));
}

describe('hostCheck (421 Misdirected Request)', () => {
  it('checks the Host also while remote access is off: a DNS-rebinding name gets 421, this computer passes', async () => {
    const server = appWith({ enabled: false, hostname: HOST });
    for (const host of ['rebind.attacker.example:47321', 'evil.example', '203.0.113.9']) {
      expect({ host, status: (await supertest(server).get('/api/health').set('Host', host)).status }).toEqual({ host, status: 421 });
    }
    // The remote name counts only while remote access is on.
    expect((await supertest(server).get('/api/health').set('Host', HOST)).status).toBe(421);
    for (const host of ['127.0.0.1:47321', 'localhost:47321', '[::1]:47321', '192.168.1.20:47321', `${os.hostname()}:47321`, `${os.hostname()}.local`]) {
      expect({ host, status: (await supertest(server).get('/api/health').set('Host', host)).status }).toEqual({ host, status: 200 });
    }
  });

  it('answers 421 JSON for /api and a page otherwise, in the request language', async () => {
    const server = appWith({ enabled: true, hostname: HOST });
    const api = await supertest(server).get('/api/health').set('Host', 'evil.example').set('Accept-Language', 'he');
    expect(api.status).toBe(421);
    expect(api.body).toEqual({ code: 'FORBIDDEN', message: t('he', 'server.remote.misdirected.body') });
    expect(api.headers['x-content-type-options']).toBe('nosniff');
    const page = await supertest(server).get('/').set('Host', '203.0.113.9');
    expect(page.status).toBe(421);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.text).toContain(t('en', 'server.remote.misdirected.title'));
    expect(page.text).toContain('lang="en"');
  });

  it('lets the right names through', async () => {
    const server = appWith({ enabled: true, hostname: HOST });
    expect((await supertest(server).get('/api/health').set('Host', HOST)).status).toBe(200);
    expect((await supertest(server).get('/api/health')).status).toBe(200); // supertest sends Host: 127.0.0.1:<port>
    expect((await supertest(server).get('/').set('Host', 'localhost:1420')).status).toBe(200);
  });
});

describe('HSTS and the LAN guard for HTTPS (remote) requests', () => {
  /** A fake request whose socket looks like the TLS listener's (encrypted), from an internet address. */
  function remoteReq(): http.IncomingMessage {
    const req = new http.IncomingMessage(null as never);
    Object.defineProperty(req, 'socket', { value: { encrypted: true, remoteAddress: '198.51.100.30' } });
    return req;
  }

  it('isRemoteRequest is true only for encrypted sockets', () => {
    expect(isRemoteRequest(remoteReq())).toBe(true);
    const plain = new http.IncomingMessage(null as never);
    Object.defineProperty(plain, 'socket', { value: { remoteAddress: '198.51.100.30' } });
    expect(isRemoteRequest(plain)).toBe(false);
  });

  it('securityHeaders adds HSTS only for HTTPS requests', () => {
    const headers: Record<string, string> = {};
    const res = { setHeader: (k: string, v: string) => (headers[k] = v) } as unknown as express.Response;
    securityHeaders(remoteReq() as express.Request, res, () => {});
    expect(headers['Strict-Transport-Security']).toBe('max-age=31536000');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    const plainHeaders: Record<string, string> = {};
    const plain = new http.IncomingMessage(null as never);
    Object.defineProperty(plain, 'socket', { value: { remoteAddress: '192.168.1.5' } });
    securityHeaders(plain as express.Request, { setHeader: (k: string, v: string) => (plainHeaders[k] = v) } as unknown as express.Response, () => {});
    expect(plainHeaders['Strict-Transport-Security']).toBeUndefined();
  });

  it('the LAN guard lets HTTPS requests through while phone access is off, and still blocks plain LAN requests', () => {
    const guard = lanGuard(() => false);
    let passed = false;
    const req = remoteReq() as express.Request;
    req.isLocal = false;
    guard(req, {} as express.Response, (err?: unknown) => {
      passed = err === undefined;
    });
    expect(passed).toBe(true);

    const plain = new http.IncomingMessage(null as never) as express.Request;
    Object.defineProperty(plain, 'socket', { value: { remoteAddress: '192.168.1.5' } });
    Object.defineProperty(plain, 'path', { value: '/api/entries' });
    plain.isLocal = false;
    let error: unknown = null;
    guard(plain, {} as express.Response, (err?: unknown) => {
      error = err;
    });
    expect((error as { code?: string })?.code).toBe('LAN_DISABLED');
  });

  it('markLocal + localeMiddleware + errorHandler still compose (smoke)', async () => {
    const app = express();
    app.use(markLocal, localeMiddleware, securityHeaders);
    app.get('/x', (req, res) => res.json({ local: req.isLocal }));
    app.use(errorHandler);
    const res = await supertest(app).get('/x');
    expect(res.body).toEqual({ local: true });
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });
});
