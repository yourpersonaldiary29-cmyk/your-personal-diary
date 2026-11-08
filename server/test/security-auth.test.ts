import fs from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import { EMAIL_TAKEN_KEY } from '../src/security/accounts';

// Helper requests ask for Hebrew (see helpers.ts).
const EMAIL_TAKEN_MESSAGE = t('he', EMAIL_TAKEN_KEY);
import { createAuthService, DiaryAuthService, EMAIL_MAX_LENGTH } from '../src/security/auth-service';
import { decryptWithPassword } from '../src/security/container';
import type { AuthService } from '../src/security/session-types';
import { cleanupTempDirs, makeTestApp, tempDataDir, testConfig, type TestApp } from './helpers';

afterAll(cleanupTempDirs);

/** Lower scrypt cost keeps the HTTP suite fast; the KDF itself is covered by security-kdf tests. */
const FAST = { N: 2048, r: 8, p: 1 };
const HEBREW = /[֐-׿]/;

const REGISTER = {
  firstName: 'דנה',
  lastName: 'כהן',
  username: 'dana',
  email: 'dana@example.com',
  password: 'Passw0rd!',
  confirmPassword: 'Passw0rd!',
};
/** A second account: every e-mail is unique on the computer, so it needs its own. */
const RON = { ...REGISTER, firstName: 'רון', lastName: 'לוי', username: 'ron', email: 'ron@example.com' };

const services: AuthService[] = [];

async function setup(dataDir = tempDataDir()) {
  const config = testConfig(dataDir);
  const auth = await createAuthService(config, { kdf: FAST });
  services.push(auth);
  const app = await makeTestApp({ auth, config });
  return { app, auth: auth as DiaryAuthService, config, dataDir };
}

afterEach(async () => {
  for (const s of services.splice(0)) await s.shutdown();
});

function withToken(app: TestApp, token: string) {
  return {
    get: (url: string) => app.anon().get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body?: object) => app.anon().post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    del: (url: string) => app.anon().delete(url).set('Authorization', `Bearer ${token}`),
  };
}

describe('auth routes', () => {
  it('register -> me -> logout, and rejects the stale token afterwards', async () => {
    const { app, dataDir } = await setup();
    const reg = await app.anon().post('/api/auth/register').send({ ...REGISTER, deviceName: 'מחשב' });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(reg.body.rememberMe).toBe(false);
    expect(reg.body.user).toMatchObject({ username: 'dana', firstName: 'דנה', lastName: 'כהן', email: 'dana@example.com' });
    expect(reg.body.user.id).toMatch(/^u_[0-9a-f]{16}$/);
    expect(Date.parse(reg.body.expiresAt)).toBeGreaterThan(Date.now());

    // Registry on disk has no secrets; it stores the e-mail (as typed) with its lower-cased key;
    // the diary file exists and is encrypted.
    const accounts = fs.readFileSync(path.join(dataDir, 'accounts.json'), 'utf8');
    expect(accounts).not.toContain(REGISTER.password);
    expect(accounts).toContain('verifierHex');
    const stored = JSON.parse(accounts).accounts[0];
    expect(stored).toMatchObject({ email: 'dana@example.com', emailLower: 'dana@example.com' });
    const dbFile = path.join(dataDir, 'users', `${reg.body.user.id}.mpd`);
    expect(fs.existsSync(dbFile)).toBe(true);
    expect(fs.readFileSync(dbFile).subarray(0, 8).toString('latin1')).toBe('MPDIARY\x01');
    expect(fs.existsSync(path.join(dataDir, 'device.key'))).toBe(true);

    const me = await withToken(app, reg.body.token).get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe('dana');
    expect(me.body.user.email).toBe('dana@example.com');
    expect(me.body.session).toMatchObject({ deviceName: 'מחשב', rememberMe: false, current: true });

    const out = await withToken(app, reg.body.token).post('/api/auth/logout');
    expect(out.status).toBe(204);
    const after = await withToken(app, reg.body.token).get('/api/auth/me');
    expect(after.status).toBe(401);
    expect(after.body.code).toBe('SESSION_EXPIRED');
    const none = await app.anon().get('/api/auth/me');
    expect(none.status).toBe(401);
    expect(none.body.code).toBe('UNAUTHORIZED');
  });

  it('validates registration input with field names and Hebrew messages', async () => {
    const { app } = await setup();
    const cases: [Record<string, unknown>, string, string][] = [
      [{ ...REGISTER, firstName: '  ' }, 'VALIDATION', 'firstName'],
      [{ ...REGISTER, lastName: 'א'.repeat(51) }, 'VALIDATION', 'lastName'],
      [{ ...REGISTER, username: 'ab' }, 'VALIDATION', 'username'],
      [{ ...REGISTER, username: 'has space' }, 'VALIDATION', 'username'],
      [{ ...REGISTER, email: '' }, 'VALIDATION', 'email'],
      [{ ...REGISTER, email: '   ' }, 'VALIDATION', 'email'],
      [{ ...REGISTER, email: 'not-an-email' }, 'VALIDATION', 'email'],
      [{ ...REGISTER, email: 'dana@localhost' }, 'VALIDATION', 'email'],
      [{ ...REGISTER, email: 'dana cohen@example.com' }, 'VALIDATION', 'email'],
      [{ ...REGISTER, email: '@example.com' }, 'VALIDATION', 'email'],
      [{ ...REGISTER, email: `${'a'.repeat(EMAIL_MAX_LENGTH - 10)}@example.com` }, 'VALIDATION', 'email'],
      [{ ...REGISTER, email: 42 }, 'VALIDATION', 'email'],
      [{ ...REGISTER, password: 'short1', confirmPassword: 'short1' }, 'WEAK_PASSWORD', 'password'],
      [{ ...REGISTER, password: 'onlyletters', confirmPassword: 'onlyletters' }, 'WEAK_PASSWORD', 'password'],
      [{ ...REGISTER, confirmPassword: 'Passw0rd?' }, 'VALIDATION', 'confirmPassword'],
    ];
    // A body without the e-mail at all (client from before the field existed) is refused too.
    const withoutEmail: Record<string, unknown> = { ...REGISTER };
    delete withoutEmail.email;
    cases.push([withoutEmail, 'VALIDATION', 'email']);
    for (const [body, code, field] of cases) {
      const res = await app.anon().post('/api/auth/register').send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.code).toBe(code);
      expect(res.body.field).toBe(field);
      expect(res.body.message).toMatch(HEBREW);
    }
    // The e-mail is checked after the username, so a bad username wins even when both are wrong.
    const both = await app.anon().post('/api/auth/register').send({ ...REGISTER, username: 'ab', email: 'nope' });
    expect(both.body.field).toBe('username');
    // Nothing was created by the failed attempts.
    expect((await app.anon().get('/api/auth/accounts')).body.accounts).toEqual([]);

    const ok = await app.anon().post('/api/auth/register').send(REGISTER);
    expect(ok.status).toBe(201);
    const dup = await app.anon().post('/api/auth/register').send({ ...REGISTER, username: 'DANA', email: 'other@example.com' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('USERNAME_TAKEN');
    // Hebrew usernames are allowed by the shared pattern.
    const heb = await app.anon().post('/api/auth/register').send({ ...REGISTER, username: 'דנה_1', email: 'dana.1@example.com' });
    expect(heb.status).toBe(201);
  });

  it('refuses an e-mail that is already registered (any letter case) with 409 VALIDATION on the email field', async () => {
    const { app } = await setup();
    expect((await app.anon().post('/api/auth/register').send(REGISTER)).status).toBe(201);
    for (const email of ['dana@example.com', 'DANA@EXAMPLE.COM', 'Dana@Example.com', '  dana@example.com  ']) {
      const dup = await app.anon().post('/api/auth/register').send({ ...RON, email });
      expect(dup.status, email).toBe(409);
      expect(dup.body).toEqual({ code: 'VALIDATION', message: EMAIL_TAKEN_MESSAGE, field: 'email' });
      expect(dup.body.message).toMatch(HEBREW);
    }
    // The username is still free: the failed attempts created nothing.
    expect((await app.anon().post('/api/auth/login').send({ username: 'ron', password: RON.password })).status).toBe(401);
    expect((await app.anon().post('/api/auth/register').send(RON)).status).toBe(201);
    expect((await app.anon().get('/api/auth/accounts')).body.accounts).toHaveLength(2);
  });

  it('keeps the e-mail as typed (trimmed) and matches it case-insensitively', async () => {
    const { app } = await setup();
    const reg = await app.anon().post('/api/auth/register').send({ ...REGISTER, email: '  Dana.Cohen@Example.com ' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.email).toBe('Dana.Cohen@Example.com');
    const login = await app.anon().post('/api/auth/login').send({ username: 'dana.cohen@example.com', password: REGISTER.password });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe('Dana.Cohen@Example.com');
  });

  it('login works with the right password and gives one identical error for unknown user / wrong password', async () => {
    const { app } = await setup();
    await app.anon().post('/api/auth/register').send(REGISTER);
    const ok = await app.anon().post('/api/auth/login').send({ username: 'Dana', password: REGISTER.password });
    expect(ok.status).toBe(200);
    expect(ok.body.user.username).toBe('dana');
    expect(ok.body.rememberMe).toBe(false);

    const unknown = await app.anon().post('/api/auth/login').send({ username: 'nobody', password: 'Whatever1' });
    const wrong = await app.anon().post('/api/auth/login').send({ username: 'dana', password: 'Whatever1' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
    expect(unknown.body.code).toBe('WRONG_PASSWORD');

    const missing = await app.anon().post('/api/auth/login').send({ username: 'dana' });
    expect(missing.status).toBe(400);
    expect(missing.body.field).toBe('password');
    const noName = await app.anon().post('/api/auth/login').send({ password: REGISTER.password });
    expect(noName.status).toBe(400);
    expect(noName.body.field).toBe('username');
    expect(noName.body.message).toMatch(HEBREW);
  });

  it('logs in with the e-mail address in any letter case, and still with the username', async () => {
    const { app } = await setup();
    await app.anon().post('/api/auth/register').send({ ...REGISTER, email: 'Dana@Example.com' });
    await app.anon().post('/api/auth/register').send(RON);

    for (const identifier of ['dana@example.com', 'DANA@EXAMPLE.COM', 'Dana@Example.com', ' dana@example.com ', 'dana', 'DANA']) {
      const ok = await app.anon().post('/api/auth/login').send({ username: identifier, password: REGISTER.password, deviceName: 'טלפון' });
      expect(ok.status, identifier).toBe(200);
      expect(ok.body.user).toMatchObject({ username: 'dana', email: 'Dana@Example.com' });
      expect(ok.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
    // The e-mail resolves to its own account, never to another one.
    const ron = await app.anon().post('/api/auth/login').send({ username: 'RON@example.com', password: RON.password });
    expect(ron.status).toBe(200);
    expect(ron.body.user.username).toBe('ron');
    // Every session lands in the same vault as the username logins.
    const sessions = await withToken(app, ron.body.token).get('/api/auth/sessions');
    expect(sessions.body).toHaveLength(2);

    // Unknown e-mail, known e-mail with the wrong password, unknown username: one identical answer.
    const unknownMail = await app.anon().post('/api/auth/login').send({ username: 'nobody@example.com', password: REGISTER.password });
    const wrongPassword = await app.anon().post('/api/auth/login').send({ username: 'dana@example.com', password: 'Whatever1' });
    const unknownUser = await app.anon().post('/api/auth/login').send({ username: 'nobody', password: REGISTER.password });
    // Someone else's password with dana's e-mail is a wrong password too.
    const crossed = await app.anon().post('/api/auth/login').send({ username: 'dana@example.com', password: 'NotDanas1' });
    for (const res of [unknownMail, wrongPassword, unknownUser, crossed]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual(unknownUser.body);
    }
    expect(unknownUser.body.code).toBe('WRONG_PASSWORD');
  });

  it('accounts registered before the e-mail field existed still log in by username and report an empty e-mail', async () => {
    const { app, auth, config, dataDir } = await setup();
    const reg = await app.anon().post('/api/auth/register').send({ ...REGISTER, rememberMe: true });
    expect(reg.status).toBe(201);
    await auth.shutdown();
    services.splice(services.indexOf(auth), 1);

    // Simulate a registry written by an older version: no email / emailLower on the record.
    const file = path.join(dataDir, 'accounts.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { accounts: Record<string, unknown>[] };
    for (const a of data.accounts) {
      delete a.email;
      delete a.emailLower;
    }
    fs.writeFileSync(file, JSON.stringify(data));

    const restarted = (await createAuthService(config, { kdf: FAST })) as DiaryAuthService;
    services.push(restarted);
    const app2 = await makeTestApp({ auth: restarted, config });

    const byName = await app2.anon().post('/api/auth/login').send({ username: 'Dana', password: REGISTER.password });
    expect(byName.status).toBe(200);
    expect(byName.body.user).toMatchObject({ username: 'dana', email: '' });
    // The remembered session still resolves, and /me reports the same empty e-mail.
    const me = await withToken(app2, reg.body.token).get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('');
    // The old e-mail no longer identifies the account (nothing else does either).
    const byMail = await app2.anon().post('/api/auth/login').send({ username: 'dana@example.com', password: REGISTER.password });
    expect(byMail.status).toBe(401);
    expect(byMail.body.code).toBe('WRONG_PASSWORD');
    // The login screen lists it with an empty e-mail, and the address is free for a new account.
    const list = await app2.anon().get('/api/auth/accounts');
    expect(list.body.accounts).toEqual([expect.objectContaining({ username: 'dana', email: '' })]);
    expect((await app2.anon().post('/api/auth/register').send(RON)).status).toBe(201);
    expect((await app2.anon().post('/api/auth/register').send({ ...RON, username: 'noa', email: 'dana@example.com' })).status).toBe(201);
    // The loaded legacy record has no e-mail fields at all (not null, not '').
    const legacy = restarted.accounts.findByUsername('dana')!;
    expect('email' in legacy).toBe(false);
    expect('emailLower' in legacy).toBe(false);
  });

  it('verify-password answers ok / 401 WRONG_PASSWORD without touching the session', async () => {
    const { app } = await setup();
    const reg = await app.anon().post('/api/auth/register').send(REGISTER);
    const t = withToken(app, reg.body.token);
    expect((await t.post('/api/auth/verify-password', { password: REGISTER.password })).body).toEqual({ ok: true });
    const bad = await t.post('/api/auth/verify-password', { password: 'Nope12345' });
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBe('WRONG_PASSWORD');
    const empty = await t.post('/api/auth/verify-password', {});
    expect(empty.status).toBe(400);
    expect((await t.get('/api/auth/me')).status).toBe(200);
  });

  it('change-password re-encrypts the diary: old password fails, new works, file decrypts with the new one only', async () => {
    const { app, auth, dataDir } = await setup();
    const reg = await app.anon().post('/api/auth/register').send({ ...REGISTER, rememberMe: true });
    const t = withToken(app, reg.body.token);
    // Put some data in the diary first.
    const ctx = (await auth.authenticate(reg.body.token))!;
    ctx.db.run(
      `INSERT INTO entries(date, time, title, body, created_at, updated_at) VALUES ('2026-09-08', '09:00', 'שלום', '', 'x', 'x')`,
    );

    const mismatch = await t.post('/api/auth/change-password', {
      oldPassword: REGISTER.password,
      newPassword: 'NewPass123',
      confirmPassword: 'NewPass124',
    });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.field).toBe('confirmPassword');
    const wrongOld = await t.post('/api/auth/change-password', {
      oldPassword: 'Wrong1234',
      newPassword: 'NewPass123',
      confirmPassword: 'NewPass123',
    });
    expect(wrongOld.status).toBe(400);
    expect(wrongOld.body.code).toBe('WRONG_PASSWORD');
    expect(wrongOld.body.field).toBe('oldPassword');
    const weak = await t.post('/api/auth/change-password', {
      oldPassword: REGISTER.password,
      newPassword: 'weak',
      confirmPassword: 'weak',
    });
    expect(weak.status).toBe(400);
    expect(weak.body.code).toBe('WEAK_PASSWORD');

    const ok = await t.post('/api/auth/change-password', {
      oldPassword: REGISTER.password,
      newPassword: 'NewPass123',
      confirmPassword: 'NewPass123',
    });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ ok: true });

    // The current session keeps working; the old password is dead; the new one logs in.
    expect((await t.get('/api/auth/me')).status).toBe(200);
    expect((await app.anon().post('/api/auth/login').send({ username: 'dana', password: REGISTER.password })).status).toBe(401);
    const login = await app.anon().post('/api/auth/login').send({ username: 'dana', password: 'NewPass123' });
    expect(login.status).toBe(200);

    // The file on disk opens with the new password only, and still holds the entry.
    const bytes = fs.readFileSync(path.join(dataDir, 'users', `${reg.body.user.id}.mpd`));
    const opened = await decryptWithPassword(bytes, 'NewPass123');
    expect(opened.plain.length).toBeGreaterThan(0);
    await expect(decryptWithPassword(bytes, REGISTER.password)).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });

    // Remember-me sessions were re-wrapped: after a restart the old token still opens the diary.
    await auth.shutdown();
    services.splice(services.indexOf(auth), 1);
    const restarted = (await createAuthService(testConfig(dataDir), { kdf: FAST })) as DiaryAuthService;
    services.push(restarted);
    const ctx2 = await restarted.authenticate(reg.body.token);
    expect(ctx2).not.toBeNull();
    expect(Number(ctx2!.db.scalar('SELECT COUNT(*) FROM entries'))).toBe(1);
  });

  it('remember-me sessions survive a restart (vault reopened without the password); regular ones do not', async () => {
    const { app, auth, dataDir } = await setup();
    const remembered = await app.anon().post('/api/auth/register').send({ ...REGISTER, rememberMe: true, deviceName: 'טלפון' });
    expect(remembered.body.rememberMe).toBe(true);
    const regular = await app.anon().post('/api/auth/login').send({ username: 'dana', password: REGISTER.password });
    expect(regular.body.rememberMe).toBe(false);
    const ctx = (await auth.authenticate(remembered.body.token))!;
    ctx.db.run(
      `INSERT INTO entries(date, time, title, body, created_at, updated_at) VALUES ('2026-09-08', '09:00', 'לפני ההפעלה מחדש', '', 'x', 'x')`,
    );
    expect(auth.vaults.size).toBe(1);
    expect(ctx.vault.refCount).toBe(2);

    const sessionsFile = JSON.parse(fs.readFileSync(path.join(dataDir, 'sessions.json'), 'utf8'));
    expect(sessionsFile.sessions).toHaveLength(1);
    expect(sessionsFile.sessions[0].deviceName).toBe('טלפון');
    expect(sessionsFile.sessions[0].wrappedKeyBase64).toBeTruthy();

    await auth.shutdown();
    services.splice(services.indexOf(auth), 1);
    expect(auth.vaults.size).toBe(0);

    // Second service on the same data dir - like the app being reopened.
    const config = testConfig(dataDir);
    const restarted = (await createAuthService(config, { kdf: FAST })) as DiaryAuthService;
    services.push(restarted);
    const app2 = await makeTestApp({ auth: restarted, config });
    const me = await withToken(app2, remembered.body.token).get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.session.rememberMe).toBe(true);
    const ctx2 = (await restarted.authenticate(remembered.body.token))!;
    expect(ctx2.db.scalar<string>('SELECT title FROM entries')).toBe('לפני ההפעלה מחדש');
    expect(ctx2.vault.refCount).toBe(1);

    const dead = await withToken(app2, regular.body.token).get('/api/auth/me');
    expect(dead.status).toBe(401);
    expect(dead.body.code).toBe('SESSION_EXPIRED');

    // Logging out the remembered session removes it from disk and closes the vault.
    expect((await withToken(app2, remembered.body.token).post('/api/auth/logout')).status).toBe(204);
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'sessions.json'), 'utf8')).sessions).toHaveLength(0);
    expect(restarted.vaults.size).toBe(0);
  });

  it('lists sessions and revokes only the caller\'s own sessions', async () => {
    const { app, auth } = await setup();
    const a = await app.anon().post('/api/auth/register').send({ ...REGISTER, deviceName: 'מחשב' });
    const b = await app.anon().post('/api/auth/login').send({ username: 'dana', password: REGISTER.password, deviceName: 'טלפון', rememberMe: true });
    const other = await app.anon().post('/api/auth/register').send(RON);

    const list = await withToken(app, a.body.token).get('/api/auth/sessions');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    expect(list.body.map((s: { deviceName: string }) => s.deviceName)).toEqual(['מחשב', 'טלפון']);
    expect(list.body[0].current).toBe(true);
    expect(list.body[1].current).toBe(false);
    expect(list.body[1].rememberMe).toBe(true);
    const otherId = list.body[1].id;

    // Another user cannot revoke it.
    const forbidden = await withToken(app, other.body.token).del(`/api/auth/sessions/${otherId}`);
    expect(forbidden.status).toBe(404);
    expect((await withToken(app, b.body.token).get('/api/auth/me')).status).toBe(200);

    const revoked = await withToken(app, a.body.token).del(`/api/auth/sessions/${otherId}`);
    expect(revoked.status).toBe(204);
    expect((await withToken(app, b.body.token).get('/api/auth/me')).status).toBe(401);
    expect((await withToken(app, a.body.token).get('/api/auth/sessions')).body).toHaveLength(1);
    expect(auth.vaults.get(a.body.user.id)?.refCount).toBe(1);
  });

  it('delete-account removes the diary files, the sessions and the account', async () => {
    const { app, auth, dataDir } = await setup();
    const reg = await app.anon().post('/api/auth/register').send({ ...REGISTER, rememberMe: true });
    const t = withToken(app, reg.body.token);
    const ctx = (await auth.authenticate(reg.body.token))!;
    ctx.db.run(`INSERT INTO entries(date, time, title, body, created_at, updated_at) VALUES ('2026-09-08', '09:00', 'x', '', 'x', 'x')`);
    await ctx.vault.persist();
    ctx.db.run(`INSERT INTO entries(date, time, title, body, created_at, updated_at) VALUES ('2026-09-09', '09:00', 'y', '', 'x', 'x')`);
    await ctx.vault.persist();
    const dbFile = path.join(dataDir, 'users', `${reg.body.user.id}.mpd`);
    expect(fs.existsSync(dbFile)).toBe(true);
    expect(fs.existsSync(`${dbFile}.prev`)).toBe(true);

    const wrong = await t.post('/api/auth/delete-account', { password: 'Nope12345' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('WRONG_PASSWORD');
    expect(fs.existsSync(dbFile)).toBe(true);

    const gone = await t.post('/api/auth/delete-account', { password: REGISTER.password });
    expect(gone.status).toBe(204);
    expect(fs.existsSync(dbFile)).toBe(false);
    expect(fs.existsSync(`${dbFile}.prev`)).toBe(false);
    expect(fs.existsSync(`${dbFile}.tmp`)).toBe(false);
    expect(fs.readdirSync(path.join(dataDir, 'users'))).toEqual([]);
    expect((await t.get('/api/auth/me')).status).toBe(401);
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'accounts.json'), 'utf8')).accounts).toEqual([]);
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'sessions.json'), 'utf8')).sessions).toEqual([]);
    expect((await app.anon().post('/api/auth/login').send({ username: 'dana', password: REGISTER.password })).status).toBe(401);
    expect((await app.anon().post('/api/auth/login').send({ username: REGISTER.email, password: REGISTER.password })).status).toBe(401);
    // The username and the e-mail are free again.
    expect((await app.anon().post('/api/auth/register').send(REGISTER)).status).toBe(201);
  });

  it('shares one vault between the desktop and the phone session, and closes it after the last logout', async () => {
    const { app, auth } = await setup();
    const a = await app.anon().post('/api/auth/register').send(REGISTER);
    const b = await app.anon().post('/api/auth/login').send({ username: 'dana', password: REGISTER.password });
    const ctxA = (await auth.authenticate(a.body.token))!;
    const ctxB = (await auth.authenticate(b.body.token))!;
    expect(ctxA.vault).toBe(ctxB.vault);
    expect(ctxA.vault.refCount).toBe(2);
    ctxA.db.run(`INSERT INTO entries(date, time, title, body, created_at, updated_at) VALUES ('2026-09-08', '09:00', 'משותף', '', 'x', 'x')`);
    expect(ctxB.db.scalar<string>('SELECT title FROM entries')).toBe('משותף');
    await withToken(app, a.body.token).post('/api/auth/logout');
    expect(ctxB.vault.refCount).toBe(1);
    expect(auth.vaults.size).toBe(1);
    await withToken(app, b.body.token).post('/api/auth/logout');
    expect(auth.vaults.size).toBe(0);
    // Data was flushed on close.
    const again = await app.anon().post('/api/auth/login').send({ username: 'dana', password: REGISTER.password });
    const ctxC = (await auth.authenticate(again.body.token))!;
    expect(Number(ctxC.db.scalar('SELECT COUNT(*) FROM entries'))).toBe(1);
  });
});
