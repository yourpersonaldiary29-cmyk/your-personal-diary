/**
 * The Host check moved from middleware/access.ts to middleware/host-check.ts (WP-2); what must not
 * move is its place: in front of the Express app on EVERY listener of the real desktop server.
 * remote-host-check.test.ts tests the middleware alone, lan-owner.test.ts the loopback listener,
 * remote-manager.test.ts the HTTPS listener - this one covers the LAN listener (phone access) and
 * the order "Host check first": a foreign Host is answered 421 before any route, guard or body
 * parser runs, also while remote access is off. Requests carry an explicit Host header over
 * node:http (fetch / supertest may replace it). Fictional users only.
 */
import http from 'node:http';
import os from 'node:os';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import { startServer, type RunningServer } from '../src/server';
import { cleanupTempDirs, testConfig } from './helpers';

const PASSWORD = 'Passw0rd!';
const running: RunningServer[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

interface Answer {
  status: number;
  type: string;
  body: string;
}

function request(address: string, port: number, method: string, urlPath: string, host: string, body?: string): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Host: host, 'Accept-Language': 'en' };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(body));
    }
    const req = http.request({ host: address, port, path: urlPath, method, headers, agent: false }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, type: String(res.headers['content-type'] ?? ''), body: text }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

/** A non-internal IPv4 address of this computer (what a phone on the home network connects to). */
function lanAddress(): string | null {
  for (const addrs of Object.values(os.networkInterfaces())) for (const a of addrs ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  return null;
}

const FOREIGN_HOSTS = ['rebind.attacker.example', 'diarytest.duckdns.org', '203.0.113.9', 'localhost.attacker.example'];

describe('Host check on the listeners of the real server (remote access off)', () => {
  it('loopback listener: a foreign Host gets 421 on every kind of route, before anything else runs', async () => {
    const srv = await startServer(testConfig(), { port: 0, quiet: true, auth: { kdf: { N: 1024, r: 8, p: 1 } } });
    running.push(srv);
    const login = JSON.stringify({ username: 'nobody', password: PASSWORD });
    for (const host of FOREIGN_HOSTS) {
      for (const [method, urlPath, body] of [
        ['GET', '/api/health', undefined],
        ['GET', '/api/auth/accounts', undefined],
        ['GET', '/api/entries', undefined], // would be 401 behind the session guard
        ['POST', '/api/auth/login', login], // would be 401 WRONG_PASSWORD
        ['POST', '/api/auth/register', '{not json'], // would be 400 from the body parser
        ['GET', '/api/no-such-route', undefined], // would be 404
        ['OPTIONS', '/api/health', undefined], // would be 204 from CORS
      ] as Array<[string, string, string | undefined]>) {
        const res = await request('127.0.0.1', srv.port, method, urlPath, `${host}:${srv.port}`, body);
        expect({ host, method, urlPath, status: res.status }).toEqual({ host, method, urlPath, status: 421 });
        expect(JSON.parse(res.body)).toEqual({ code: 'FORBIDDEN', message: t('en', 'server.remote.misdirected.body') });
      }
      const page = await request('127.0.0.1', srv.port, 'GET', '/', host);
      expect({ host, status: page.status, html: page.type.startsWith('text/html') }).toEqual({ host, status: 421, html: true });
    }
    // This computer's own names still reach the app.
    for (const host of [`127.0.0.1:${srv.port}`, `localhost:${srv.port}`, 'tauri.localhost', `[::1]:${srv.port}`, '192.168.1.20']) {
      expect({ host, status: (await request('127.0.0.1', srv.port, 'GET', '/api/health', host)).status }).toEqual({ host, status: 200 });
    }
    expect((await request('127.0.0.1', srv.port, 'POST', '/api/auth/login', `127.0.0.1:${srv.port}`, login)).status).toBe(401);
  });

  it('LAN listener (phone access): the same check, with the same answers', async () => {
    const lan = lanAddress();
    // No network interface (an offline machine): there is no LAN listener to reach - nothing to check.
    if (!lan) return;
    const srv = await startServer(testConfig(), { port: 0, quiet: true, auth: { kdf: { N: 1024, r: 8, p: 1 } } });
    running.push(srv);
    const agent = supertest(`http://127.0.0.1:${srv.port}`);
    const reg = await agent
      .post('/api/auth/register')
      .send({ firstName: 'Test', lastName: 'User', username: 'ownertest', email: 'ownertest@example.com', password: PASSWORD, confirmPassword: PASSWORD });
    expect(reg.status).toBe(201);
    const on = await agent.put('/api/server/settings').set('Authorization', `Bearer ${reg.body.token}`).send({ lanEnabled: true, password: PASSWORD });
    expect(on.status).toBe(200);
    expect(on.body.lanEnabled).toBe(true);

    const own = `${lan}:${srv.port}`;
    expect((await request(lan, srv.port, 'GET', '/api/health', own)).status).toBe(200);
    for (const host of FOREIGN_HOSTS) {
      for (const [method, urlPath, body] of [
        ['GET', '/api/health', undefined],
        ['GET', '/api/entries', undefined],
        ['POST', '/api/auth/login', JSON.stringify({ username: 'ownertest', password: PASSWORD })],
        ['GET', '/', undefined],
      ] as Array<[string, string, string | undefined]>) {
        const res = await request(lan, srv.port, method, urlPath, `${host}:${srv.port}`, body);
        expect({ host, method, urlPath, status: res.status }).toEqual({ host, method, urlPath, status: 421 });
        expect(res.body).not.toContain('token');
      }
    }
    // The right Host on the same listener signs in normally.
    const login = await request(lan, srv.port, 'POST', '/api/auth/login', own, JSON.stringify({ username: 'ownertest', password: PASSWORD }));
    expect(login.status).toBe(200);
  });
});
