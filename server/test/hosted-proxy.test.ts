/**
 * WP-H1 (docs/HOSTED-PLAN.md Part B 2.2 / 2.3): the Express app behind the platform's TLS proxy.
 *
 *   - local mode (no `deps.hosted`): the chain is the one it always was - forwarded headers are
 *     never trusted, the LAN guard runs, CORS knows the shell origins only;
 *   - hosted mode: the public-host check answers 421 to every other Host (GET /api/health
 *     excepted), `X-Forwarded-Proto` from the edge makes a request "secure" (HSTS, `secure` in the
 *     server info), the limiters count the real client's /64 or /32 bucket, a global /api/auth cap
 *     holds, the Android WebView origin may read answers, and nothing is a "local" request.
 * Fictional addresses (TEST-NET) only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import type { ServerInfo } from '@shared/types';
import { clientIp, HOSTED_HSTS_HEADER_VALUE, lastForwardedProto, limiterKey } from '../src/middleware/access';
import { authorityOf, hostOf, isPublicHost } from '../src/middleware/hosted-host';
import { cleanupTempDirs, makeTestApp, testConfig, testHostedOptions } from './helpers';

afterAll(cleanupTempDirs);

const HOST = 'diary.example';

describe('limiterKey / lastForwardedProto / hostOf (pure helpers)', () => {
  it('buckets IPv6 by /64 and keeps IPv4 (also IPv4-mapped) as it is', () => {
    expect(limiterKey('203.0.113.9')).toBe('203.0.113.9');
    expect(limiterKey('::ffff:203.0.113.9')).toBe('203.0.113.9');
    expect(limiterKey('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2::/64');
    expect(limiterKey('2001:DB8:1:2::1')).toBe('2001:db8:1:2::/64');
    expect(limiterKey('2001:db8:1:2:ffff:ffff:ffff:ffff')).toBe(limiterKey('2001:db8:1:2::'));
    expect(limiterKey('2001:db8:1:3::1')).not.toBe(limiterKey('2001:db8:1:2::1'));
    expect(limiterKey('::1')).toBe('0:0:0:0::/64');
    expect(limiterKey('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(limiterKey('')).toBe('unknown');
    expect(limiterKey('unknown')).toBe('unknown');
    expect(limiterKey('2001:db8::1::2')).toBe('2001:db8::1::2');
  });

  it('takes the LAST X-Forwarded-Proto value, lower-cased', () => {
    expect(lastForwardedProto({ headers: {} })).toBe('');
    expect(lastForwardedProto({ headers: { 'x-forwarded-proto': 'https' } })).toBe('https');
    expect(lastForwardedProto({ headers: { 'x-forwarded-proto': 'http, HTTPS' } })).toBe('https');
    expect(lastForwardedProto({ headers: { 'x-forwarded-proto': 'https, http' } })).toBe('http');
    expect(lastForwardedProto({ headers: { 'x-forwarded-proto': ['http', 'https'] } })).toBe('https');
  });

  it('compares the Host header with the public host, default ports dropped', () => {
    expect(hostOf('Diary.Example:443')).toBe('diary.example');
    expect(authorityOf('Diary.Example:8443')).toBe('diary.example:8443');
    expect(authorityOf('diary.example.')).toBe('diary.example');
    expect(isPublicHost('diary.example', HOST)).toBe(true);
    expect(isPublicHost('DIARY.EXAMPLE:443', HOST)).toBe(true);
    expect(isPublicHost('diary.example:8443', HOST)).toBe(false);
    expect(isPublicHost('diary.example:8443', 'diary.example:8443')).toBe(true);
    expect(isPublicHost('evil.example', HOST)).toBe(false);
    expect(isPublicHost('diary.example.evil.example', HOST)).toBe(false);
    expect(isPublicHost(undefined, HOST)).toBe(false);
    expect(isPublicHost('127.0.0.1:47681', '127.0.0.1:47681')).toBe(true);
  });
});

describe('local mode is unchanged', () => {
  it('ignores forwarded headers, keeps the LAN guard and the shell-only CORS set', async () => {
    const app = await makeTestApp();
    const layers = (app.app.router.stack as Array<{ name: string }>).map((l) => l.name);
    expect(layers).toContain('markLocal');
    expect(layers).not.toContain('markHostedRequest');
    expect(layers).not.toContain('hostedHeaders');
    const info = await app.anon().get('/api/server/info').set('Host', 'evil.example').set('X-Forwarded-Proto', 'https').set('X-Forwarded-For', '203.0.113.9');
    expect(info.status).toBe(200);
    const body = info.body as ServerInfo;
    expect(body.isLocalRequest).toBe(true);
    expect(body.secure).toBe(false);
    expect(body.mode).toBeUndefined();
    // Hosted-only fields are left out, the owner flag included (docs/android-tasks/OWNER-ID-VISIBILITY.md).
    expect(body).not.toHaveProperty('ownerConfigured');
    expect(info.headers['strict-transport-security']).toBeUndefined();
    expect(info.headers['permissions-policy']).toBeUndefined();
    const cors = await app.anon().options('/api/auth/login').set('Origin', 'https://localhost');
    expect(cors.status).toBe(204);
    expect(cors.headers['access-control-allow-origin']).toBeUndefined();
    const shell = await app.anon().options('/api/auth/login').set('Origin', 'http://tauri.localhost');
    expect(shell.headers['access-control-allow-origin']).toBe('http://tauri.localhost');
  });
});

describe('hosted mode: Host check', () => {
  it('answers 421 to every Host but the public one - JSON under /api, a page elsewhere - and lets /api/health through', async () => {
    const app = await makeTestApp({ hosted: testHostedOptions() });
    const layers = (app.app.router.stack as Array<{ name: string }>).map((l) => l.name);
    expect(layers).toContain('markHostedRequest');
    expect(layers).not.toContain('markLocal');
    for (const host of ['evil.example', 'diary.example.evil.example', '203.0.113.9', 'localhost', '127.0.0.1', 'diary.example:8443']) {
      const api = await app.anon().get('/api/server/info').set('Host', host);
      expect({ host, status: api.status }).toEqual({ host, status: 421 });
      expect(api.body).toEqual({ code: 'FORBIDDEN', message: t('he', 'server.remote.misdirected.body') });
      const post = await app.anon().post('/api/auth/login').set('Host', host).send({ username: 'x', password: 'y' });
      expect(post.status).toBe(421);
      const page = await app.anon().get('/').set('Host', host);
      expect(page.status).toBe(421);
      expect(page.headers['content-type']).toMatch(/text\/html/);
      // The platform's health check addresses the container directly: always answered.
      const health = await app.anon().get('/api/health').set('Host', host);
      expect({ host, status: health.status }).toEqual({ host, status: 200 });
      // ...but only that path: the strict path is for the monitor, which uses the public name.
      expect((await app.anon().get('/api/health/strict').set('Host', host)).status).toBe(421);
    }
    for (const host of [HOST, 'DIARY.EXAMPLE', 'diary.example:443']) {
      expect({ host, status: (await app.anon().get('/api/server/info').set('Host', host)).status }).toEqual({ host, status: 200 });
    }
  });
});

describe('hosted mode: forwarded protocol, headers and server info', () => {
  it('no request is local; X-Forwarded-Proto from the edge decides `secure` and HSTS', async () => {
    const app = await makeTestApp({ hosted: testHostedOptions() });
    const plain = await app.anon().get('/api/server/info').set('Host', HOST);
    expect(plain.status).toBe(200);
    const plainBody = plain.body as ServerInfo;
    expect(plainBody.isLocalRequest).toBe(false);
    expect(plainBody.secure).toBe(false);
    expect(plainBody.dataDir).toBe('');
    expect(plainBody.lanUrls).toEqual([]);
    expect(plainBody.lanEnabled).toBe(false);
    expect(plainBody.mode).toBe('hosted');
    expect(plainBody.publicUrl).toBe('https://diary.example');
    expect(plainBody.registration).toBe('open');
    // testHostedOptions() configures no owner: the bootstrap state.
    expect(plainBody.ownerConfigured).toBe(false);
    expect(plain.headers['strict-transport-security']).toBeUndefined();
    expect(plain.headers['cache-control']).toBe('no-store');
    expect(plain.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(plain.headers['x-powered-by']).toBeUndefined();
    expect(plain.headers['content-security-policy']).toContain("default-src 'self'");

    const secure = await app.anon().get('/api/server/info').set('Host', HOST).set('X-Forwarded-Proto', 'https');
    expect((secure.body as ServerInfo).secure).toBe(true);
    expect((secure.body as ServerInfo).remoteUrl).toBe('https://diary.example');
    expect(secure.headers['strict-transport-security']).toBe(HOSTED_HSTS_HEADER_VALUE);
    // The last hop is the edge's: a client-forged leading value changes nothing.
    const forged = await app.anon().get('/api/server/info').set('Host', HOST).set('X-Forwarded-Proto', 'http, https');
    expect((forged.body as ServerInfo).secure).toBe(true);
    const downgraded = await app.anon().get('/api/server/info').set('Host', HOST).set('X-Forwarded-Proto', 'https, http');
    expect((downgraded.body as ServerInfo).secure).toBe(false);
    expect(downgraded.headers['strict-transport-security']).toBeUndefined();

    // Local-only routes stay closed: the account list is never served from a public server.
    const accounts = await app.anon().get('/api/auth/accounts').set('Host', HOST).set('X-Forwarded-Proto', 'https');
    expect(accounts.status).toBe(403);
    // The debug routes do not exist unless asked for.
    expect((await app.anon().get('/api/debug/proxy').set('Host', HOST)).status).toBe(404);
  });

  it('CORS: the shell origins and the Android WebView may read answers; nothing else', async () => {
    const app = await makeTestApp({ hosted: testHostedOptions() });
    for (const origin of ['http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost', 'https://localhost', 'capacitor://localhost']) {
      const res = await app.anon().options('/api/auth/login').set('Host', HOST).set('Origin', origin);
      expect({ origin, status: res.status, allow: res.headers['access-control-allow-origin'] }).toEqual({ origin, status: 204, allow: origin });
      expect(res.headers['access-control-allow-headers']).toBe('Authorization, Content-Type, Accept-Language');
    }
    for (const origin of ['https://evil.example', 'http://localhost', 'https://localhost:8443', 'http://localhost:1420', 'http://127.0.0.1:1430', 'null']) {
      const res = await app.anon().options('/api/auth/login').set('Host', HOST).set('Origin', origin);
      expect({ origin, status: res.status, allow: res.headers['access-control-allow-origin'] }).toEqual({ origin, status: 204, allow: undefined });
    }
    // The dev hosted server (README 5.2, `--dev`) also admits the two Vite dev servers: the desktop UI
    // on 1420 and the phone UI in a browser on 1430 (`npm run mobile:dev`). Never without `--dev`.
    const dev = await makeTestApp({ hosted: testHostedOptions(), config: { ...testConfig(), dev: true } });
    for (const origin of ['http://localhost:1420', 'http://127.0.0.1:1430']) {
      const res = await dev.anon().options('/api/auth/login').set('Host', HOST).set('Origin', origin);
      expect({ origin, status: res.status, allow: res.headers['access-control-allow-origin'] }).toEqual({ origin, status: 204, allow: origin });
    }
    const near = await dev.anon().options('/api/auth/login').set('Host', HOST).set('Origin', 'http://localhost:1431');
    expect(near.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('debug routes exist only with debugRoutes and show what the proxy plumbing sees', async () => {
    const app = await makeTestApp({ hosted: testHostedOptions({ debugRoutes: true }) });
    const res = await app.anon().get('/api/debug/proxy').set('Host', HOST).set('X-Forwarded-For', '203.0.113.9').set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ip: '203.0.113.9', bucket: '203.0.113.9', xff: '203.0.113.9', xfp: 'https', lastProto: 'https', secure: true, host: HOST });
    expect(res.body.ips).toEqual(['203.0.113.9']);
  });
});

describe('hosted mode: the client address and the limiters', () => {
  it('counts /api/auth per real-client bucket (X-Forwarded-For through trust proxy 1) and refuses the Nth+1', async () => {
    const app = await makeTestApp({ hosted: testHostedOptions({ loginPerMinute: 2, authGlobalPerMinute: 1000 }) });
    const forgot = (ip: string) => app.anon().post('/api/auth/forgot-password').set('Host', HOST).set('X-Forwarded-For', ip).send({ email: 'nobody@example.com' });
    // Two attempts pass the limiter (503: no mail service in this app - the limiter runs first), the third is 429.
    expect((await forgot('203.0.113.9')).status).toBe(503);
    expect((await forgot('203.0.113.9')).status).toBe(503);
    const third = await forgot('203.0.113.9');
    expect(third.status).toBe(429);
    expect(third.body.message).toBe(t('he', 'server.error.tooManyAttempts'));
    // Another address has its own window...
    expect((await forgot('203.0.113.10')).status).toBe(503);
    // ...and a whole IPv6 /64 shares one.
    expect((await forgot('2001:db8:1:2::1')).status).toBe(503);
    expect((await forgot('2001:db8:1:2::2')).status).toBe(503);
    expect((await forgot('2001:db8:1:2:ffff::3')).status).toBe(429);
    expect((await forgot('2001:db8:1:3::1')).status).toBe(503);
    // A client cannot escape its bucket by prepending a forged address: the selected hop is the
    // edge's (the last one), i.e. the address the proxy appended.
    expect((await app.anon().post('/api/auth/forgot-password').set('Host', HOST).set('X-Forwarded-For', '198.51.100.7, 203.0.113.9').send({ email: 'nobody@example.com' })).status).toBe(429);
  });

  it('a global /api/auth cap holds whatever the addresses are', async () => {
    const app = await makeTestApp({ hosted: testHostedOptions({ loginPerMinute: 100, authGlobalPerMinute: 3 }) });
    const forgot = (ip: string) => app.anon().post('/api/auth/forgot-password').set('Host', HOST).set('X-Forwarded-For', ip).send({ email: 'nobody@example.com' });
    expect((await forgot('203.0.113.1')).status).toBe(503);
    expect((await forgot('203.0.113.2')).status).toBe(503);
    expect((await forgot('203.0.113.3')).status).toBe(503);
    expect((await forgot('203.0.113.4')).status).toBe(429);
    // The cap guards /api/auth only.
    expect((await app.anon().get('/api/server/info').set('Host', HOST)).status).toBe(200);
  });

  it('a single-value header (Fly-Client-IP) can be the client address; without it the socket address is used', async () => {
    const app = await makeTestApp({ hosted: testHostedOptions({ clientIpHeader: 'fly-client-ip', loginPerMinute: 1, authGlobalPerMinute: 1000, debugRoutes: true }) });
    const seen = await app.anon().get('/api/debug/proxy').set('Host', HOST).set('Fly-Client-IP', '203.0.113.42').set('X-Forwarded-For', '198.51.100.7');
    expect(seen.body.ip).toBe('203.0.113.42');
    const direct = await app.anon().get('/api/debug/proxy').set('Host', HOST);
    expect(direct.body.ip).toMatch(/127\.0\.0\.1$/);
    const forgot = (ip: string) => app.anon().post('/api/auth/forgot-password').set('Host', HOST).set('Fly-Client-IP', ip).send({ email: 'nobody@example.com' });
    expect((await forgot('203.0.113.1')).status).toBe(503);
    expect((await forgot('203.0.113.1')).status).toBe(429);
    expect((await forgot('203.0.113.2')).status).toBe(503);
  });

  it('clientIp falls back to the socket address when no header is configured', () => {
    const req = { hosted: {}, ip: '203.0.113.9', headers: {}, socket: { remoteAddress: '10.0.0.5' } } as unknown as import('express').Request;
    expect(clientIp(req)).toBe('10.0.0.5');
    const local = { headers: { 'x-forwarded-for': '203.0.113.9' }, ip: '203.0.113.9', socket: { remoteAddress: '127.0.0.1' } } as unknown as import('express').Request;
    expect(clientIp(local)).toBe('127.0.0.1');
  });
});

describe('docs/API.md names every hosted-only ServerInfo field', () => {
  it('the hosted section\'s "`ServerInfo` מקבל" sentence lists each field a hosted server adds to a local one (ownerConfigured included)', async () => {
    const local = (await (await makeTestApp()).anon().get('/api/server/info')).body as ServerInfo;
    const hosted = (await (await makeTestApp({ hosted: testHostedOptions() })).anon().get('/api/server/info').set('Host', HOST)).body as ServerInfo;
    const hostedOnly = Object.keys(hosted).filter((k) => !(k in local));
    expect(hostedOnly).toContain('ownerConfigured');
    const doc = fs.readFileSync(path.resolve(__dirname, '..', '..', 'docs', 'API.md'), 'utf8');
    const sentence = doc.split('\n').find((line) => line.includes('`ServerInfo` מקבל'));
    expect(sentence, 'the hosted ServerInfo sentence of docs/API.md').toBeDefined();
    for (const field of hostedOnly) expect({ field, listed: sentence!.includes(`\`${field}\``) }).toEqual({ field, listed: true });
  });
});
