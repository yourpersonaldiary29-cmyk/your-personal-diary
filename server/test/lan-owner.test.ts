/**
 * Review finding "No Host-header check while remote access is off" and its defence in depth, on a
 * real server: a DNS-rebinding Host is refused (421) on the loopback listener with remote access
 * off; phone access (PUT /api/server/settings) is the owner's and turning it on needs the password;
 * the Vite dev-server origins are allowed only with --dev. Fictional users only.
 */
import http from 'node:http';
import express from 'express';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import type { AuthResponse } from '@shared/types';
import { corsFor } from '../src/middleware/access';
import { startServer, type RunningServer } from '../src/server';
import { cleanupTempDirs, testConfig } from './helpers';

const PASSWORD = 'Passw0rd!';
const running: RunningServer[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

async function boot() {
  const srv = await startServer(testConfig(), { port: 0, quiet: true, auth: { kdf: { N: 1024, r: 8, p: 1 } } });
  running.push(srv);
  return { srv, http: supertest(`http://127.0.0.1:${srv.port}`) };
}

async function register(agent: ReturnType<typeof supertest>, username: string): Promise<string> {
  const res = await agent
    .post('/api/auth/register')
    .send({ firstName: 'Test', lastName: 'User', username, email: `${username}@example.com`, password: PASSWORD, confirmPassword: PASSWORD });
  expect(res.status).toBe(201);
  return (res.body as AuthResponse).token;
}

/** GET with an explicit Host header (fetch/supertest may replace it). */
function getWithHost(port: number, path: string, host: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET', headers: { Host: host } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('DNS rebinding with remote access off', () => {
  it('answers 421 to a foreign Host on the loopback listener - no account list, no data folder', async () => {
    const { srv, http: agent } = await boot();
    await register(agent, 'ownertest');
    for (const path of ['/api/auth/accounts', '/api/server/info', '/api/health']) {
      const res = await getWithHost(srv.port, path, `rebind.attacker.example:${srv.port}`);
      expect({ path, status: res.status }).toEqual({ path, status: 421 });
      expect(res.body).not.toContain('ownertest');
    }
    expect((await getWithHost(srv.port, '/api/auth/accounts', `127.0.0.1:${srv.port}`)).status).toBe(200);
    expect((await getWithHost(srv.port, '/api/health', `localhost:${srv.port}`)).status).toBe(200);
  });
});

describe('phone access (PUT /api/server/settings)', () => {
  it('only the owner can change it, and turning it on needs the account password', async () => {
    const { http: agent } = await boot();
    const owner = await register(agent, 'owner');
    const other = await register(agent, 'other');
    const put = (token: string, body: object) =>
      agent.put('/api/server/settings').set('Authorization', `Bearer ${token}`).set('Accept-Language', 'en').send(body);

    const notOwner = await put(other, { lanEnabled: false, password: PASSWORD });
    expect(notOwner.status).toBe(403);
    expect(notOwner.body).toEqual({ code: 'FORBIDDEN', message: t('en', 'server.lan.notOwner') });
    expect((await agent.get('/api/server/settings').set('Authorization', `Bearer ${other}`)).body.isLanOwner).toBe(false);
    expect((await agent.get('/api/server/settings').set('Authorization', `Bearer ${owner}`)).body.isLanOwner).toBe(true);

    // The port change alone while phone access is off opens nothing: no password needed.
    const missing = await put(owner, { lanEnabled: true });
    expect(missing.status).toBe(400);
    expect(missing.body).toMatchObject({ code: 'VALIDATION', field: 'password' });
    const wrong = await put(owner, { lanEnabled: true, password: 'Wrong1pass' });
    expect(wrong.status).toBe(400);
    expect(wrong.body).toEqual({ code: 'WRONG_PASSWORD', message: t('en', 'server.auth.wrongCurrentPassword'), field: 'password' });

    const on = await put(owner, { lanEnabled: true, password: PASSWORD });
    expect(on.status).toBe(200);
    expect(on.body.lanEnabled).toBe(true);
    // Turning it off needs no password.
    const off = await put(owner, { lanEnabled: false });
    expect(off.status).toBe(200);
    expect(off.body.lanEnabled).toBe(false);
  });
});

describe('CORS', () => {
  function app(dev: boolean) {
    const a = express();
    a.use(corsFor(dev));
    a.get('/x', (_req, res) => res.json({ ok: true }));
    return a;
  }

  it('allows the Vite dev-server origins only in development (--dev), the desktop shell always', async () => {
    // 1420: the desktop UI (`npm run dev`); 1430: the phone UI in a browser (`npm run mobile:dev`).
    for (const origin of ['http://localhost:1420', 'http://127.0.0.1:1420', 'http://localhost:1430', 'http://127.0.0.1:1430']) {
      const prod = await supertest(app(false)).get('/x').set('Origin', origin);
      expect([origin, prod.headers['access-control-allow-origin']]).toEqual([origin, undefined]);
      const dev = await supertest(app(true)).get('/x').set('Origin', origin);
      expect([origin, dev.headers['access-control-allow-origin']]).toEqual([origin, origin]);
    }
    // Only those two ports: a neighbouring port is no dev server of this project.
    const other = await supertest(app(true)).get('/x').set('Origin', 'http://localhost:1431');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
    const shell = await supertest(app(false)).get('/x').set('Origin', 'http://tauri.localhost');
    expect(shell.headers['access-control-allow-origin']).toBe('http://tauri.localhost');
    const evil = await supertest(app(true)).get('/x').set('Origin', 'http://rebind.attacker.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});
