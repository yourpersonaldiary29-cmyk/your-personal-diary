/**
 * THROWAWAY verifier tests for WP-H10a (deleted after the run). Fictional data only.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { SyncKeyResponse, SyncOpResult } from '@shared/sync';
import type { AuthResponse, Entry } from '@shared/types';
import { loadConfig, loadHostedEnv } from '../src/config';
import { DiaryDb } from '../src/db/database';
import { startHosted, type RunningHosted } from '../src/hosted';
import { decryptWithPassword } from '../src/security/container';
import { applySyncOp } from '../src/sync/apply';
import { ensureSyncState } from '../src/sync/store';
import { validateSyncOp } from '../src/sync/validate';
import { cleanupTempDirs, sampleEntry, tempDataDir } from '../test/helpers';

const PASSWORD = 'Passw0rd!';
const FAST = { kdf: { N: 1024, r: 8, p: 1 } };
const HOST = 'diary.example';
const running: RunningHosted[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

async function boot(o: { dataDir?: string; env?: Record<string, string> } = {}) {
  const dataDir = o.dataDir ?? tempDataDir();
  const env = loadHostedEnv({
    DIARY_MODE: 'hosted',
    DIARY_PUBLIC_URL: `https://${HOST}`,
    DIARY_BIND: '127.0.0.1',
    DIARY_LOGIN_PER_MINUTE: '1000',
    DIARY_AUTH_GLOBAL_PER_MINUTE: '5000',
    ...o.env,
  });
  const config = loadConfig(['--data-dir', dataDir], { DIARY_MODE: 'hosted' });
  const srv = await startHosted(config, env, { port: 0, quiet: true, auth: FAST });
  running.push(srv);
  const agent = supertest(srv.localUrl);
  type Req = ReturnType<typeof agent.get>;
  const common = (r: Req) => r.set('Host', HOST).set('Accept-Language', 'en').set('X-Forwarded-Proto', 'https');
  const anon = () => ({ post: (url: string, body: object = {}) => common(agent.post(url)).send(body) });
  const as = (token: string, origin?: string) => ({
    get: (url: string) => {
      const r = common(agent.get(url)).set('Authorization', `Bearer ${token}`);
      return origin ? r.set('Origin', origin) : r;
    },
    post: (url: string, body: object = {}) => {
      const r = common(agent.post(url)).set('Authorization', `Bearer ${token}`);
      return (origin ? r.set('Origin', origin) : r).send(body);
    },
  });
  return { srv, anon, as, dataDir };
}

async function register(b: Awaited<ReturnType<typeof boot>>, username: string) {
  const res = await b.anon().post('/api/auth/register', {
    firstName: 'Dana', lastName: 'Test', username, email: `${username}@example.com`, password: PASSWORD, confirmPassword: PASSWORD, rememberMe: true,
  });
  expect(res.status).toBe(201);
  const auth = res.body as AuthResponse;
  return { token: auth.token, userId: auth.user.id, api: b.as(auth.token) };
}

const op = (account: string, epoch: string, kind: string, extra: Record<string, unknown>, editedAt = new Date().toISOString()) => ({ v: 1, account, opId: randomUUID(), editedAt, epoch, kind, ...extra });
const entryPayload = (o: Record<string, unknown> = {}) => sampleEntry({ title: 'Morning walk', body: 'Walked with Dana by the sea.', ...o });

async function diskDiary(dataDir: string, userId: string): Promise<DiaryDb> {
  const accounts = JSON.parse(fs.readFileSync(path.join(dataDir, 'accounts.json'), 'utf8')) as { accounts: Array<{ id: string; dbFile: string }> };
  const record = accounts.accounts.find((a) => a.id === userId)!;
  const { plain } = await decryptWithPassword(fs.readFileSync(path.join(dataDir, 'users', record.dbFile)), PASSWORD);
  return DiaryDb.fromImage(plain);
}

describe('A1 settings.patch mixed outcome', () => {
  it('one key applied + one key conflict-lost gives overall "applied"', async () => {
    const db = await DiaryDb.create();
    const { epoch } = ensureSyncState(db);
    const run = (body: Record<string, unknown>, now: string) => db.transaction(() => applySyncOp(db, validateSyncOp(body), now));
    // Device B changes the theme LATER (10:05).
    const b = run(op('u_a', epoch, 'settings.patch', { base: { theme: 'system' }, payload: { theme: 'light' } }, '2026-10-20T10:05:00.000Z'), '2026-10-20T10:06:00.000Z');
    expect(b.outcome).toBe('applied');
    // Device A changed language and theme offline at 10:00 (saw theme 'system' and language 'he' before).
    const a = run(op('u_a', epoch, 'settings.patch', { base: { theme: 'system', language: 'he' }, payload: { theme: 'dark', language: 'en' } }, '2026-10-20T10:00:00.000Z'), '2026-10-20T10:07:00.000Z');
    console.log('A1 result', JSON.stringify({ outcome: a.outcome, keys: a.keys }));
    expect(a.keys).toEqual({ theme: 'conflict-lost', language: 'applied' });
    expect(a.outcome).toBe('applied');
  });
});

describe('A2 CORS: Retry-After of 503 notSaved readable by the cross-origin apps?', () => {
  it('reports the exposed headers on a 503 from https://localhost and http://tauri.localhost', async () => {
    const b = await boot();
    const dana = await register(b, 'dana');
    const { epoch } = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    const vault = b.srv.auth.vaults.get(dana.userId)!;
    const original = vault.persist.bind(vault);
    (vault as { persist: typeof vault.persist }).persist = async () => {
      throw new Error('disk full (injected)');
    };
    for (const origin of ['https://localhost', 'http://tauri.localhost']) {
      const res = await b.as(dana.token, origin).post('/api/sync/op', op(dana.userId, epoch, 'settings.patch', { payload: { theme: 'dark' } }));
      console.log('A2', origin, res.status, JSON.stringify({ acao: res.headers['access-control-allow-origin'], expose: res.headers['access-control-expose-headers'], retryAfter: res.headers['retry-after'] }));
      expect(res.status).toBe(503);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(String(res.headers['access-control-expose-headers'] ?? '').toLowerCase()).not.toContain('retry-after');
    }
    (vault as { persist: typeof vault.persist }).persist = original;
  });
});

describe('A3 concurrent identical entry.update', () => {
  it('one applied, one unchanged, edit on disk; no conflict note', async () => {
    const b = await boot();
    const dana = await register(b, 'dana');
    const { epoch } = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    const entry = ((await dana.api.post('/api/sync/op', op(dana.userId, epoch, 'entry.create', { clientId: randomUUID(), payload: entryPayload() }))).body as SyncOpResult).record as Entry;
    const body = op(dana.userId, epoch, 'entry.update', { target: { id: entry.id }, base: entry.updatedAt, payload: entryPayload({ title: 'Evening walk' }) });
    const rs = await Promise.all([dana.api.post('/api/sync/op', body), dana.api.post('/api/sync/op', body), dana.api.post('/api/sync/op', body)]);
    const outcomes = rs.map((r) => (r.body as SyncOpResult).outcome).sort();
    console.log('A3', rs.map((r) => r.status), outcomes);
    expect(outcomes).toEqual(['applied', 'unchanged', 'unchanged']);
    const disk = await diskDiary(b.dataDir, dana.userId);
    expect(disk.get<{ title: string }>('SELECT title FROM entries WHERE id = ?', [entry.id])?.title).toBe('Evening walk');
    disk.close();
  });
});

describe('A4 concurrent identical create while the first disk write fails', () => {
  it('every 200 is backed by the disk', async () => {
    const b = await boot();
    const dana = await register(b, 'dana');
    const { epoch } = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    const vault = b.srv.auth.vaults.get(dana.userId)!;
    const raw = vault as unknown as { writeNow(strict?: boolean): Promise<void> };
    const originalWrite = raw.writeNow.bind(vault);
    let calls = 0;
    raw.writeNow = async (strict?: boolean) => {
      calls++;
      if (calls === 1) {
        await new Promise((r) => setTimeout(r, 200));
        throw new Error('EIO (injected)');
      }
      return originalWrite(strict);
    };
    const body = op(dana.userId, epoch, 'entry.create', { clientId: randomUUID(), payload: entryPayload({ title: 'Once only' }) });
    const p1 = dana.api.post('/api/sync/op', body).then((r) => r);
    await new Promise((r) => setTimeout(r, 50));
    const p2 = dana.api.post('/api/sync/op', body).then((r) => r);
    const [r1, r2] = await Promise.all([p1, p2]);
    console.log('A4', r1.status, r1.body.outcome ?? r1.body.message, r2.status, r2.body.outcome ?? r2.body.message, 'writes', calls);
    const disk = await diskDiary(b.dataDir, dana.userId);
    const titles = disk.all<{ title: string }>('SELECT title FROM entries').map((r) => r.title);
    disk.close();
    if (r1.status === 200 || r2.status === 200) expect(titles).toEqual(['Once only']);
    raw.writeNow = originalWrite;
    const retry = await dana.api.post('/api/sync/op', body);
    expect((retry.body as SyncOpResult).outcome).toBe('unchanged');
    expect((await dana.api.get('/api/entries')).body.total).toBe(1);
  });
});
