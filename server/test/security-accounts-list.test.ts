/**
 * GET /api/auth/accounts - the list of accounts registered on this computer, for the local
 * login screen. Public, but answered only over loopback; never contains ids, salts or verifiers.
 */
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { AppDeps } from '../src/app';
import { errorHandler } from '../src/middleware/error';
import { localeMiddleware } from '../src/middleware/locale';
import { t } from '@shared/i18n';
import { ACCOUNTS_LOCAL_ONLY_KEY, authRouter, toAccountListItem } from '../src/routes/auth';
import { createAuthService, type DiaryAuthService } from '../src/security/auth-service';
import { toAccountSummary, type AuthService } from '../src/security/session-types';
import { cleanupTempDirs, fakeAuth, makeTestApp, TEST_ACCOUNT, tempDataDir, testConfig, type TestApp } from './helpers';
import { DiaryDb } from '../src/db/database';

const HEBREW = /[א-ת]/;
/** Lower scrypt cost keeps the suite fast; the KDF itself is covered by security-kdf tests. */
const FAST = { N: 2048, r: 8, p: 1 };
const PASSWORD = 'Passw0rd!';
/** Keys that must never leave the server. */
const SECRET_KEYS = ['id', 'usernameLower', 'emailLower', 'kdf', 'saltHex', 'verifierHex', 'dbFile', 'N', 'r', 'p'];
/** The whole list row (AccountSummary + email), sorted. */
const PUBLIC_KEYS = ['createdAt', 'email', 'firstName', 'lastLoginAt', 'lastName', 'username'];
/** Every test account gets its own e-mail: the address is unique per computer. */
const emailOf = (username: string) => `${username}@example.com`;

const services: AuthService[] = [];
afterAll(cleanupTempDirs);
afterEach(async () => {
  for (const s of services.splice(0)) await s.shutdown();
});

function register(app: TestApp, username: string, firstName: string, lastName: string, rememberMe = false) {
  return app
    .anon()
    .post('/api/auth/register')
    .send({ firstName, lastName, username, email: emailOf(username), password: PASSWORD, confirmPassword: PASSWORD, rememberMe, deviceName: 'מחשב' });
}

function usernames(res: { body: { accounts: { username: string }[] } }): string[] {
  return res.body.accounts.map((a) => a.username);
}

describe('GET /api/auth/accounts (fake auth service)', () => {
  it('answers a loopback request with the registered accounts and nothing secret', async () => {
    const app = await makeTestApp();
    const res = await app.anon().get('/api/auth/accounts');
    expect(res.status).toBe(200);
    // TEST_ACCOUNT predates the e-mail field: the list reports '' for it.
    expect(res.body).toEqual({
      accounts: [{ username: 'tester', firstName: 'דנה', lastName: 'כהן', email: '', createdAt: TEST_ACCOUNT.createdAt, lastLoginAt: null }],
    });
    expect(Object.keys(res.body.accounts[0]).sort()).toEqual(PUBLIC_KEYS);
    const raw = res.text;
    for (const key of SECRET_KEYS) expect(raw, key).not.toContain(`"${key}"`);
    expect(raw).not.toContain(TEST_ACCOUNT.id);
    expect(raw).not.toContain(TEST_ACCOUNT.verifierHex);
  });

  it('needs no bearer token, and ignores a stale one', async () => {
    const app = await makeTestApp();
    const stale = await app.anon().get('/api/auth/accounts').set('Authorization', 'Bearer not-a-real-token');
    expect(stale.status).toBe(200);
    expect(usernames(stale)).toEqual(['tester']);
  });

  it('rejects a request that did not arrive over loopback with 403 FORBIDDEN and a Hebrew message', async () => {
    // Same router and error handler as the real app, but the request is marked non-local
    // (markLocal decides by the socket address, which supertest always makes loopback).
    const db = await DiaryDb.create();
    const deps: AppDeps = {
      config: testConfig(),
      auth: fakeAuth(db),
      getServerSettings: () => ({ port: 0, lanEnabled: true }),
      setServerSettings: async (next) => next,
      getListenInfo: () => ({ port: 0, lanUrls: [], startedAt: new Date().toISOString() }),
    };
    const remote = express();
    remote.use((req: Request, _res: Response, next: NextFunction) => {
      req.isLocal = false;
      next();
    });
    remote.use(localeMiddleware);
    remote.use('/api/auth', authRouter(deps));
    remote.use(errorHandler);

    const res = await supertest(remote).get('/api/auth/accounts').set('Accept-Language', 'he');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ code: 'FORBIDDEN', message: t('he', ACCOUNTS_LOCAL_ONLY_KEY) });
    expect(res.body.message).toMatch(HEBREW);
    expect(res.text).not.toContain('tester');

    // The same app marked local answers normally - the guard is the only difference.
    const local = express();
    local.use((req: Request, _res: Response, next: NextFunction) => {
      req.isLocal = true;
      next();
    });
    local.use('/api/auth', authRouter(deps));
    local.use(errorHandler);
    const ok = await supertest(local).get('/api/auth/accounts');
    expect(ok.status).toBe(200);
    expect(usernames(ok)).toEqual(['tester']);
  });

  it('toAccountSummary keeps only the public fields (lastLoginAt null when never recorded)', () => {
    expect(toAccountSummary(TEST_ACCOUNT)).toEqual({
      username: 'tester',
      firstName: 'דנה',
      lastName: 'כהן',
      createdAt: TEST_ACCOUNT.createdAt,
      lastLoginAt: null,
    });
    expect(toAccountSummary({ ...TEST_ACCOUNT, lastLoginAt: '2026-09-20T07:00:00.000Z' }).lastLoginAt).toBe('2026-09-20T07:00:00.000Z');
  });

  it('toAccountListItem adds the e-mail as typed (never emailLower), or "" when the record has none', () => {
    expect(toAccountListItem(TEST_ACCOUNT)).toEqual({ ...toAccountSummary(TEST_ACCOUNT), email: '' });
    const withMail = { ...TEST_ACCOUNT, email: 'Tester@Example.com', emailLower: 'tester@example.com' };
    const item = toAccountListItem(withMail);
    expect(item.email).toBe('Tester@Example.com');
    expect(Object.keys(item).sort()).toEqual(PUBLIC_KEYS);
  });
});

describe('GET /api/auth/accounts (real auth service)', () => {
  /** Deterministic clock: every call advances one minute, so lastSeenAt / createdAt never tie. */
  function ticking() {
    let t = Date.parse('2026-09-01T08:00:00.000Z');
    return () => new Date((t += 60_000));
  }

  async function setup() {
    const dataDir = tempDataDir();
    const config = testConfig(dataDir);
    const auth = (await createAuthService(config, { kdf: FAST, now: ticking() })) as DiaryAuthService;
    services.push(auth);
    const app = await makeTestApp({ auth, config });
    return { app, auth, config, dataDir };
  }

  it('starts empty, then lists every registered user without secrets', async () => {
    const { app } = await setup();
    const empty = await app.anon().get('/api/auth/accounts');
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ accounts: [] });

    expect((await register(app, 'dana', 'דנה', 'כהן')).status).toBe(201);
    expect((await register(app, 'ron', 'רון', 'לוי')).status).toBe(201);

    const res = await app.anon().get('/api/auth/accounts');
    expect(res.status).toBe(200);
    expect(res.body.accounts).toHaveLength(2);
    expect(
      res.body.accounts.map((a: { username: string; firstName: string; lastName: string; email: string }) => [a.username, a.firstName, a.lastName, a.email]),
    ).toEqual(
      expect.arrayContaining([
        ['dana', 'דנה', 'כהן', 'dana@example.com'],
        ['ron', 'רון', 'לוי', 'ron@example.com'],
      ]),
    );
    for (const a of res.body.accounts) {
      expect(Object.keys(a).sort()).toEqual(PUBLIC_KEYS);
      expect(Date.parse(a.createdAt)).not.toBeNaN();
      // Registration counts as the first sign-in.
      expect(a.lastLoginAt).toBe(a.createdAt);
    }
    for (const key of SECRET_KEYS) expect(res.text, key).not.toContain(`"${key}"`);
    expect(res.text).not.toContain(PASSWORD);
    expect(res.text).not.toMatch(/u_[0-9a-f]{16}/);
  });

  it('orders by the most recently used session, then by creation time; deleted accounts disappear', async () => {
    const { app, auth } = await setup();
    const dana = await register(app, 'dana', 'דנה', 'כהן', true);
    const ron = await register(app, 'ron', 'רון', 'לוי');
    // ron registered (and was seen) last.
    expect(usernames(await app.anon().get('/api/auth/accounts'))).toEqual(['ron', 'dana']);

    // dana logs in again -> her new session is the most recent one.
    const login = await app.anon().post('/api/auth/login').send({ username: 'dana', password: PASSWORD });
    expect(login.status).toBe(200);
    expect(usernames(await app.anon().get('/api/auth/accounts'))).toEqual(['dana', 'ron']);

    // Any request touches the session: ron becomes the most recent again.
    expect((await app.anon().get('/api/auth/me').set('Authorization', `Bearer ${ron.body.token}`)).status).toBe(200);
    expect(usernames(await app.anon().get('/api/auth/accounts'))).toEqual(['ron', 'dana']);

    // Without live sessions the registry still remembers who signed in last: dana's login came
    // after ron's registration, so dana stays first.
    for (const token of [ron.body.token, dana.body.token, login.body.token]) {
      expect((await app.anon().post('/api/auth/logout').set('Authorization', `Bearer ${token}`)).status).toBe(204);
    }
    const loggedOut = await app.anon().get('/api/auth/accounts');
    expect(usernames(loggedOut)).toEqual(['dana', 'ron']);
    const [danaSummary, ronSummary] = loggedOut.body.accounts as { lastLoginAt: string; createdAt: string }[];
    expect(danaSummary.lastLoginAt > ronSummary.lastLoginAt).toBe(true);
    expect(ronSummary.lastLoginAt).toBe(ronSummary.createdAt);
    // A new login moves that account to the front.
    const again = await app.anon().post('/api/auth/login').send({ username: 'ron', password: PASSWORD });
    expect(usernames(await app.anon().get('/api/auth/accounts'))).toEqual(['ron', 'dana']);

    // The service returns copies: mutating them never touches the registry.
    const list = auth.listAccounts();
    list[0].firstName = 'שונה';
    expect(auth.listAccounts()[0].firstName).not.toBe('שונה');

    // A deleted account is gone from the list.
    const gone = await app
      .anon()
      .post('/api/auth/delete-account')
      .set('Authorization', `Bearer ${again.body.token}`)
      .send({ password: PASSWORD });
    expect(gone.status).toBe(204);
    expect(usernames(await app.anon().get('/api/auth/accounts'))).toEqual(['dana']);
  });

  it('survives a restart: the last sign-in is kept in accounts.json, not only in live sessions', async () => {
    const { app, auth, config, dataDir } = await setup();
    await register(app, 'dana', 'דנה', 'כהן');
    await register(app, 'ron', 'רון', 'לוי', true);
    // dana signed in last, but only ron's (remember-me) session is persisted.
    const login = await app.anon().post('/api/auth/login').send({ username: 'dana', password: PASSWORD });
    expect(login.status).toBe(200);
    expect(usernames(await app.anon().get('/api/auth/accounts'))).toEqual(['dana', 'ron']);

    // The registry on disk records the sign-in time (and still no secrets beyond the verifier).
    const onDisk = JSON.parse(fs.readFileSync(path.join(dataDir, 'accounts.json'), 'utf8')).accounts as {
      username: string;
      createdAt: string;
      lastLoginAt?: string;
    }[];
    const danaOnDisk = onDisk.find((a) => a.username === 'dana')!;
    const ronOnDisk = onDisk.find((a) => a.username === 'ron')!;
    expect(danaOnDisk.lastLoginAt).toBeDefined();
    expect(danaOnDisk.lastLoginAt! > danaOnDisk.createdAt).toBe(true);
    expect(ronOnDisk.lastLoginAt).toBe(ronOnDisk.createdAt);

    await auth.shutdown();
    services.splice(services.indexOf(auth), 1);
    const restarted = (await createAuthService(config, { kdf: FAST, now: ticking() })) as DiaryAuthService;
    services.push(restarted);
    const app2 = await makeTestApp({ auth: restarted, config });
    // dana is still first after the restart: the login screen offers the last user, not the last session.
    const after = await app2.anon().get('/api/auth/accounts');
    expect(usernames(after)).toEqual(['dana', 'ron']);
    expect(after.body.accounts[0].lastLoginAt).toBe(danaOnDisk.lastLoginAt);

    // The order changes only through a real sign-in (a failed login records nothing).
    const wrong = await app2.anon().post('/api/auth/login').send({ username: 'ron', password: 'not-the-password' });
    expect(wrong.status).toBe(401);
    expect(usernames(await app2.anon().get('/api/auth/accounts'))).toEqual(['dana', 'ron']);
    expect((await app2.anon().post('/api/auth/login').send({ username: 'ron', password: PASSWORD })).status).toBe(200);
    expect(usernames(await app2.anon().get('/api/auth/accounts'))).toEqual(['ron', 'dana']);
  });

  it('lists accounts written before lastLoginAt / email existed (older accounts.json) with null / "", after the others', async () => {
    const { app, auth, config, dataDir } = await setup();
    await register(app, 'dana', 'דנה', 'כהן');
    await register(app, 'ron', 'רון', 'לוי');
    await auth.shutdown();
    services.splice(services.indexOf(auth), 1);

    // Simulate a registry from an older version: no lastLoginAt and no e-mail on ron.
    const file = path.join(dataDir, 'accounts.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { accounts: Record<string, unknown>[] };
    for (const a of data.accounts) {
      if (a.username !== 'ron') continue;
      delete a.lastLoginAt;
      delete a.email;
      delete a.emailLower;
    }
    fs.writeFileSync(file, JSON.stringify(data));

    const restarted = (await createAuthService(config, { kdf: FAST, now: ticking() })) as DiaryAuthService;
    services.push(restarted);
    const app2 = await makeTestApp({ auth: restarted, config });
    const res = await app2.anon().get('/api/auth/accounts');
    expect(res.status).toBe(200);
    expect(usernames(res)).toEqual(['dana', 'ron']);
    expect(res.body.accounts[0]).toMatchObject({ username: 'dana', email: 'dana@example.com' });
    expect(res.body.accounts[1]).toMatchObject({ username: 'ron', lastLoginAt: null, email: '' });
    expect(Object.keys(res.body.accounts[1]).sort()).toEqual(PUBLIC_KEYS);
    for (const key of SECRET_KEYS) expect(res.text, key).not.toContain(`"${key}"`);
  });
});
