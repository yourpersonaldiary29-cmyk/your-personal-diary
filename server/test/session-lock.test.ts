/**
 * Server-side lock of a session (review finding: the lock screen was React state only, so a reload
 * or the bare token unlocked the diary). POST /api/auth/lock locks the session; every data route
 * answers 423 LOCKED until POST /api/auth/verify-password succeeds; the lock survives a restart for
 * remember-me sessions. Fictional users only.
 */
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import type { AuthResponse } from '@shared/types';
import { allowedWhileLocked } from '../src/middleware/auth';
import { startServer, type RunningServer } from '../src/server';
import { cleanupTempDirs, sampleEntry, testConfig } from './helpers';

const PASSWORD = 'Passw0rd!';
const running: RunningServer[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

async function boot(config = testConfig()) {
  const srv = await startServer(config, { port: 0, quiet: true, auth: { kdf: { N: 1024, r: 8, p: 1 } } });
  running.push(srv);
  return { srv, config, http: supertest(`http://127.0.0.1:${srv.port}`) };
}

describe('session lock (lock screen)', () => {
  it('refuses the data routes of a locked session until the password is entered again', async () => {
    const { http } = await boot();
    const reg = await http
      .post('/api/auth/register')
      .send({ firstName: 'Dana', lastName: 'Test', username: 'dana', email: 'dana@example.com', password: PASSWORD, confirmPassword: PASSWORD });
    const token = (reg.body as AuthResponse).token;
    const as = (req: supertest.Test) => req.set('Authorization', `Bearer ${token}`).set('Accept-Language', 'en');
    expect((await as(http.post('/api/entries')).send(sampleEntry({ title: 'A private entry' }))).status).toBe(201);

    expect((await as(http.post('/api/auth/lock'))).status).toBe(204);
    const entries = await as(http.get('/api/entries'));
    expect(entries.status).toBe(423);
    expect(entries.body).toEqual({ code: 'LOCKED', message: t('en', 'server.auth.sessionLocked') });
    expect(JSON.stringify(entries.body)).not.toContain('A private entry');
    for (const [method, url] of [
      ['get', '/api/search?q=x'],
      ['post', '/api/export'],
      ['get', '/api/habits'],
      ['get', '/api/auth/sessions'],
    ] as const) {
      expect({ url, status: (await as(http[method](url))).status }).toEqual({ url, status: 423 });
    }
    expect((await as(http.put('/api/auth/profile')).send({ email: 'x@evil.test', currentPassword: PASSWORD })).status).toBe(423);

    // What the lock screen needs still answers, and says the session is locked.
    const me = await as(http.get('/api/auth/me'));
    expect(me.status).toBe(200);
    expect(me.body.session.locked).toBe(true);
    expect((await as(http.get('/api/settings'))).status).toBe(200);

    // A wrong password keeps it locked; the right one unlocks it.
    expect((await as(http.post('/api/auth/verify-password')).send({ password: 'Wrong1pass' })).status).toBe(401);
    expect((await as(http.get('/api/entries'))).status).toBe(423);
    expect((await as(http.post('/api/auth/verify-password')).send({ password: PASSWORD })).status).toBe(200);
    expect((await as(http.get('/api/entries'))).status).toBe(200);
    expect((await as(http.get('/api/auth/me'))).body.session.locked).toBeUndefined();
  });

  it('a locked remember-me session stays locked after a restart', async () => {
    const first = await boot();
    const reg = await first.http
      .post('/api/auth/register')
      .send({ firstName: 'Dana', lastName: 'Test', username: 'dana', email: 'dana@example.com', password: PASSWORD, confirmPassword: PASSWORD, rememberMe: true });
    const token = (reg.body as AuthResponse).token;
    expect((await first.http.post('/api/auth/lock').set('Authorization', `Bearer ${token}`)).status).toBe(204);
    await first.srv.stop();
    running.splice(running.indexOf(first.srv), 1);

    const second = await boot(first.config);
    expect((await second.http.get('/api/entries').set('Authorization', `Bearer ${token}`)).status).toBe(423);
    expect((await second.http.post('/api/auth/verify-password').set('Authorization', `Bearer ${token}`).send({ password: PASSWORD })).status).toBe(200);
    expect((await second.http.get('/api/entries').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });

  it('allowedWhileLocked lets through only who-am-I, unlock, lock, logout and reading the settings', () => {
    expect(allowedWhileLocked('GET', '/api/auth/me')).toBe(true);
    expect(allowedWhileLocked('POST', '/api/auth/verify-password')).toBe(true);
    expect(allowedWhileLocked('POST', '/api/auth/lock/')).toBe(true);
    expect(allowedWhileLocked('POST', '/api/auth/logout')).toBe(true);
    expect(allowedWhileLocked('GET', '/api/settings')).toBe(true);
    expect(allowedWhileLocked('PUT', '/api/settings')).toBe(false);
    expect(allowedWhileLocked('GET', '/api/entries')).toBe(false);
    expect(allowedWhileLocked('POST', '/api/auth/change-password')).toBe(false);
    expect(allowedWhileLocked('POST', '/api/auth/delete-account')).toBe(false);
  });
});
