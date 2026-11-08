/**
 * Desktop review of the guest mode (WP-2): on the desktop server nothing can make an account a
 * guest - not a request, and not the account registry either.
 *
 *   - POST /api/auth/guest does not exist on a real `startServer` (404 on the loopback listener,
 *     whatever the body, the language or the Host), and a `guest` field in a register / login body
 *     is ignored;
 *   - a record of accounts.json is ALWAYS a real account: the registry never holds a guest (the
 *     guest of the tour mode lives in the memory of the auth service only), so a `"guest": true`
 *     found in the file - a hand-edited or damaged file - is dropped when the file is read. Before
 *     this rule such a record lost the ownership of the computer (remote access, mail, phone access
 *     went to the next account) and was refused its own password check, lock screen, backup and
 *     account deletion with 'server.auth.guestNotAllowed' - on a computer where the tour mode does
 *     not even exist.
 * Fictional users only.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { AuthResponse } from '@shared/types';
import { AccountsStore } from '../src/security/accounts';
import { firstAccountId } from '../src/security/owner';
import type { AccountRecord } from '../src/security/session-types';
import { startServer, type RunningServer } from '../src/server';
import { cleanupTempDirs, sampleEntry, tempDataDir, testConfig } from './helpers';

const PASSWORD = 'Passw0rd!';
const FAST = { kdf: { N: 1024, r: 8, p: 1 } };
const running: RunningServer[] = [];

afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

async function boot(dataDir = tempDataDir()) {
  const srv = await startServer(testConfig(dataDir), { port: 0, quiet: true, auth: FAST });
  running.push(srv);
  const agent = supertest(`http://127.0.0.1:${srv.port}`);
  const as = (token: string) => ({
    get: (url: string) => agent.get(url).set('Authorization', `Bearer ${token}`).set('Accept-Language', 'en'),
    post: (url: string, body: object = {}) => agent.post(url).set('Authorization', `Bearer ${token}`).set('Accept-Language', 'en').send(body),
    put: (url: string, body: object = {}) => agent.put(url).set('Authorization', `Bearer ${token}`).set('Accept-Language', 'en').send(body),
  });
  return { srv, agent, as, dataDir };
}

async function stop(srv: RunningServer): Promise<void> {
  running.splice(running.indexOf(srv), 1);
  await srv.stop();
}

function registerBody(username: string, extra: object = {}) {
  return { firstName: 'Test', lastName: 'User', username, email: `${username}@example.com`, password: PASSWORD, confirmPassword: PASSWORD, ...extra };
}

/** POST with an explicit Host header (supertest / fetch may replace it). */
function postWithHost(port: number, urlPath: string, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method: 'POST', headers: { Host: host, 'Content-Type': 'application/json', 'Content-Length': '2' } }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode ?? 0));
    });
    req.on('error', reject);
    req.end('{}');
  });
}

describe('the desktop server has no guest mode', () => {
  it('POST /api/auth/guest is 404 on a real server and writes nothing; a guest field in a body is ignored', async () => {
    const { srv, agent, as, dataDir } = await boot();
    for (const send of [
      () => agent.post('/api/auth/guest').send({}),
      () => agent.post('/api/auth/guest').set('Accept-Language', 'he').send({ language: 'he', deviceName: 'phone' }),
      () => agent.post('/api/auth/guest').set('Origin', 'tauri://localhost').send({}),
      () => agent.post('/api/auth/guest/').send({}),
      () => agent.post('/api/auth/GUEST').send({}),
      () => agent.get('/api/auth/guest'),
    ]) {
      const res = await send();
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    }
    expect(await postWithHost(srv.port, '/api/auth/guest', `localhost:${srv.port}`)).toBe(404);
    expect(fs.existsSync(path.join(dataDir, 'accounts.json'))).toBe(false);
    expect(fs.readdirSync(path.join(dataDir, 'users'))).toEqual([]);

    const reg = await agent.post('/api/auth/register').send(registerBody('realuser', { guest: true }));
    expect(reg.status).toBe(201);
    const body = reg.body as AuthResponse;
    expect('guest' in body).toBe(false);
    expect('guest' in body.user).toBe(false);
    expect(body.user.id).toMatch(/^u_[0-9a-f]{16}$/);
    const login = await agent.post('/api/auth/login').send({ username: 'realuser', password: PASSWORD, guest: true });
    expect(login.status).toBe(200);
    expect('guest' in login.body).toBe(false);
    const me = await as(body.token).get('/api/auth/me');
    expect('guest' in me.body.user).toBe(false);
    expect('guest' in me.body.session).toBe(false);
    const record = JSON.parse(fs.readFileSync(path.join(dataDir, 'accounts.json'), 'utf8')).accounts[0];
    expect('guest' in record).toBe(false);
  });
});

describe('accounts.json never makes an account a guest', () => {
  it('the registry drops a guest flag found in the file and never writes one', () => {
    const dataDir = tempDataDir();
    const file = path.join(dataDir, 'accounts.json');
    const record = (id: string, username: string, createdAt: string, extra: object = {}) => ({
      id,
      username,
      usernameLower: username,
      firstName: 'Test',
      lastName: 'User',
      createdAt,
      kdf: { algorithm: 'scrypt', N: 1024, r: 8, p: 1, saltHex: '00'.repeat(16) },
      verifierHex: '00'.repeat(32),
      dbFile: `${id}.mpd`,
      ...extra,
    });
    fs.writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        accounts: [record('u_0000000000000001', 'first', '2026-01-01T00:00:00.000Z', { guest: true }), record('u_0000000000000002', 'second', '2026-02-01T00:00:00.000Z')],
      }),
    );
    const store = new AccountsStore(file);
    expect(store.list().map((a) => ({ id: a.id, guest: 'guest' in a }))).toEqual([
      { id: 'u_0000000000000001', guest: false },
      { id: 'u_0000000000000002', guest: false },
    ]);
    expect('guest' in store.findById('u_0000000000000001')!).toBe(false);
    expect('guest' in store.findByUsername('first')!).toBe(false);
    // The owner is the account created first, whatever the file claimed.
    expect(firstAccountId(store.list())).toBe('u_0000000000000001');
    // ...and neither add nor update ever stores the flag.
    store.add({ ...(record('u_0000000000000003', 'third', '2026-03-01T00:00:00.000Z') as AccountRecord), guest: true });
    store.update({ ...store.findById('u_0000000000000002')!, guest: true });
    expect(fs.readFileSync(file, 'utf8')).not.toContain('guest');
    expect(store.list().some((a) => 'guest' in a)).toBe(false);
  });

  it('a real server keeps treating the first account as the owner and as a normal account', async () => {
    const first = await boot();
    const ownerReg = await first.agent.post('/api/auth/register').send(registerBody('ownertest'));
    const otherReg = await first.agent.post('/api/auth/register').send(registerBody('othertest'));
    expect([ownerReg.status, otherReg.status]).toEqual([201, 201]);
    const ownerId = (ownerReg.body as AuthResponse).user.id;
    expect((await first.as(ownerReg.body.token).post('/api/entries', sampleEntry({ title: 'kept' }))).status).toBe(201);
    await stop(first.srv);

    // A hand-edited (or damaged) registry: the first account carries the flag of the tour mode.
    const file = path.join(first.dataDir, 'accounts.json');
    const json = JSON.parse(fs.readFileSync(file, 'utf8')) as { accounts: Array<Record<string, unknown>> };
    json.accounts.find((a) => a.id === ownerId)!.guest = true;
    fs.writeFileSync(file, JSON.stringify(json));

    const second = await boot(first.dataDir);
    const login = await second.agent.post('/api/auth/login').send({ username: 'ownertest', password: PASSWORD });
    expect(login.status).toBe(200);
    expect('guest' in login.body).toBe(false);
    expect('guest' in login.body.user).toBe(false);
    const owner = second.as(login.body.token);
    const other = second.as((await second.agent.post('/api/auth/login').send({ username: 'othertest', password: PASSWORD })).body.token);

    // Still the owner of this computer; the next account did not inherit anything.
    expect((await owner.get('/api/server/settings')).body).toMatchObject({ isLanOwner: true, isMailOwner: true, isRemoteOwner: true });
    expect((await other.get('/api/server/settings')).body).toMatchObject({ isLanOwner: false, isMailOwner: false, isRemoteOwner: false });
    expect((await owner.get('/api/server/mail')).status).toBe(200);
    expect((await other.get('/api/server/mail')).status).toBe(403);
    expect((await owner.get('/api/server/remote')).status).toBe(200);

    // Everything a guest is refused (403 'server.auth.guestNotAllowed') still works.
    expect((await owner.post('/api/auth/verify-password', { password: PASSWORD })).body).toEqual({ ok: true });
    expect((await owner.put('/api/auth/profile', { firstName: 'Renamed' })).status).toBe(200);
    expect((await owner.post('/api/backup/create', {})).status).toBe(200);
    expect((await owner.post('/api/auth/lock')).status).toBe(204);
    expect((await owner.get('/api/entries')).status).toBe(423);
    expect((await owner.post('/api/auth/verify-password', { password: PASSWORD })).status).toBe(200);
    expect((await owner.get('/api/entries')).body.items.map((e: { title: string }) => e.title)).toEqual(['kept']);
    const changed = await owner.post('/api/auth/change-password', { oldPassword: PASSWORD, newPassword: 'N3wPassw0rd!', confirmPassword: 'N3wPassw0rd!' });
    expect(changed.status).toBe(200);
    // The registry was rewritten by the profile / password change: the flag is gone from the file too.
    expect(fs.readFileSync(file, 'utf8')).not.toContain('"guest"');
    const deleted = await owner.post('/api/auth/delete-account', { password: 'N3wPassw0rd!' });
    expect(deleted.status).toBe(204);
    expect(fs.readdirSync(path.join(first.dataDir, 'users')).some((f) => f.startsWith(ownerId))).toBe(false);
  });
});
