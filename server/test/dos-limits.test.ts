/**
 * Review findings "Unauthenticated 25 MB JSON bodies are parsed before auth" and "Backup restore
 * trusts attacker-chosen scrypt parameters": bodies of data routes are read only after the session
 * check, with per-group limits; a backup whose header asks for more scrypt work than the app ever
 * writes is refused before any derivation; backup requests are rate-limited. Fictional users only.
 */
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import type { AuthResponse } from '@shared/types';
import { BACKUP_REQUESTS_PER_MINUTE } from '../src/app';
import { encryptContainer } from '../src/security/container';
import { DEFAULT_KDF, isAffordableKdf, MAX_UNTRUSTED_KDF_COST } from '../src/security/kdf';
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
  const http = supertest(`http://127.0.0.1:${srv.port}`);
  const reg = await http
    .post('/api/auth/register')
    .send({ firstName: 'Dana', lastName: 'Test', username: 'dana', email: 'dana@example.com', password: PASSWORD, confirmPassword: PASSWORD });
  expect(reg.status).toBe(201);
  return { http, token: (reg.body as AuthResponse).token };
}

describe('request bodies', () => {
  it('are never parsed for a data route without a session, and each route group has its own limit', async () => {
    const { http, token } = await boot();
    const huge = JSON.stringify({ title: 'x', body: 'y'.repeat(5 * 1024 * 1024) });
    // No session: answered 401 without reading the 5 MB body (the server may even reset the
    // connection while the client is still sending it) - never parsed, never 413.
    const anon = await http
      .post('/api/entries')
      .set('Content-Type', 'application/json')
      .send(huge)
      .then((r) => r.status)
      .catch((e: NodeJS.ErrnoException) => e.code);
    expect(['ECONNRESET', 'EPIPE', 401]).toContain(anon);
    // A signed-in data route accepts up to 2 MB.
    const big = await http.post('/api/entries').set('Authorization', `Bearer ${token}`).set('Content-Type', 'application/json').send(huge);
    expect(big.status).toBe(413);
    // The public sign-in routes take small forms only.
    const login = await http
      .post('/api/auth/login')
      .set('Accept-Language', 'en')
      .send({ username: 'dana', password: 'p'.repeat(200 * 1024) });
    expect(login.status).toBe(413);
    expect(login.body).toEqual({ code: 'VALIDATION', message: t('en', 'server.error.bodyTooLarge') });
    // A backup (base64 in JSON) may still be several megabytes.
    const backup = await http
      .post('/api/backup/inspect')
      .set('Authorization', `Bearer ${token}`)
      .send({ fileBase64: Buffer.alloc(3 * 1024 * 1024, 1).toString('base64') });
    expect(backup.status).not.toBe(413);
  });

  it('limits backup requests per address', async () => {
    const { http, token } = await boot();
    const statuses: number[] = [];
    for (let i = 0; i <= BACKUP_REQUESTS_PER_MINUTE; i++) {
      statuses.push((await http.post('/api/backup/inspect').set('Authorization', `Bearer ${token}`).send({ fileBase64: 'AAAA' })).status);
    }
    expect(statuses.slice(0, BACKUP_REQUESTS_PER_MINUTE).every((s) => s !== 429)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe('backup restore KDF parameters', () => {
  it('refuses a crafted file that asks for far more scrypt work than the app writes, before deriving anything', async () => {
    const { http, token } = await boot();
    const crafted = encryptContainer(Buffer.from('not a diary'), Buffer.alloc(32, 1), Buffer.alloc(16, 2), { N: 1 << 17, r: 8, p: 16 });
    const started = Date.now();
    const res = await http
      .post('/api/backup/restore')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept-Language', 'en')
      .send({ fileBase64: crafted.toString('base64'), password: 'anything1' });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BACKUP');
    expect(res.body.message).toContain(t('en', 'server.crypto.unsupportedFileKdf'));
  });

  it('accepts what the app writes (the default) and at most twice its cost', () => {
    expect(isAffordableKdf(DEFAULT_KDF)).toBe(true);
    expect(isAffordableKdf({ N: 1 << 16, r: 8, p: 1 })).toBe(true);
    expect(isAffordableKdf({ N: 1 << 15, r: 8, p: 4 })).toBe(false);
    expect(isAffordableKdf({ N: 1 << 17, r: 8, p: 16 })).toBe(false);
    expect(MAX_UNTRUSTED_KDF_COST).toBe(2 * DEFAULT_KDF.N * DEFAULT_KDF.r * DEFAULT_KDF.p);
  });
});
