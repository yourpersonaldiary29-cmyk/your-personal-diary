/**
 * Account takeover with only a session token (review finding): changing the reset e-mail address
 * needs the account password, the previous address is told, the "password changed" notice of a
 * later reset also reaches the previous address, changing the password signs out every other
 * device, and "confirm with your password" steps lock after 10 wrong passwords.
 * Real server + in-process mock SMTP; fictional users only.
 */
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import type { AuthResponse } from '@shared/types';
import { EMAIL_CHANGE_NOTICE_WINDOW_MS, recentPreviousEmail } from '../src/security/auth-service';
import { startServer, type RunningServer } from '../src/server';
import { cleanupTempDirs, testConfig } from './helpers';
import { decodeWords, headersOf, partsOf, resetDetailsOf, startMockSmtp, type CapturedMail, type MockSmtp } from './mail-fixtures';

const HOST = 'smtp.mail.test';
const SENDER = 'diary.sender@mail.test';
const SMTP_SECRET = 'mock-app-secret-0007';
const PASSWORD = 'Passw0rd!';
const FAST = { N: 1024, r: 8, p: 1 };

const running: RunningServer[] = [];
const mocks: MockSmtp[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
  for (const m of mocks.splice(0)) await m.close();
});
afterAll(cleanupTempDirs);

type Http = ReturnType<typeof supertest>;

async function boot() {
  const smtp = await startMockSmtp({ mode: 'tls', hostname: HOST, users: { [SENDER]: SMTP_SECRET } });
  mocks.push(smtp);
  const srv = await startServer(testConfig(), {
    port: 0,
    quiet: true,
    auth: { kdf: FAST },
    // Generous SMTP step timeout: under a loaded parallel run (scrypt filling the thread pool) a TLS
    // handshake with the mock can take seconds, and a timed-out send made this suite flaky.
    mail: { smtp: { ca: smtp.ca.certPem, connectHost: '127.0.0.1', timeoutMs: 20_000 } },
    passwordReset: { perIpPerHour: 1000, backgroundDelayMs: () => 0 },
  });
  running.push(srv);
  return { srv, smtp, http: supertest(`http://127.0.0.1:${srv.port}`) };
}

async function register(http: Http, username: string, email: string, rememberMe = false): Promise<string> {
  const res = await http
    .post('/api/auth/register')
    .set('Accept-Language', 'en')
    .send({ firstName: 'Dana', lastName: 'Test', username, email, password: PASSWORD, confirmPassword: PASSWORD, rememberMe });
  expect(res.status).toBe(201);
  return (res.body as AuthResponse).token;
}

function as(http: Http, token: string) {
  const h = (req: supertest.Test) => req.set('Authorization', `Bearer ${token}`).set('Accept-Language', 'en');
  return {
    get: (url: string) => h(http.get(url)),
    post: (url: string, body: object = {}) => h(http.post(url)).send(body),
    put: (url: string, body: object) => h(http.put(url)).send(body),
  };
}

async function enableMail(http: Http, token: string, smtp: MockSmtp) {
  const res = await as(http, token).put('/api/server/mail', {
    host: HOST,
    port: smtp.port,
    security: 'tls',
    username: SENDER,
    smtpPassword: SMTP_SECRET,
    enabled: true,
    password: PASSWORD,
  });
  expect(res.status).toBe(200);
}

const subjectOf = (mail: CapturedMail) => decodeWords(headersOf(mail.data).subject);

describe('changing the reset e-mail address', () => {
  it('needs the account password; names alone do not', async () => {
    const { http } = await boot();
    const token = await register(http, 'dana', 'dana@example.com');
    const dana = as(http, token);

    const missing = await dana.put('/api/auth/profile', { email: 'attacker@evil.test' });
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ code: 'VALIDATION', message: t('en', 'server.auth.currentPasswordRequired'), field: 'currentPassword' });

    const wrong = await dana.put('/api/auth/profile', { email: 'attacker@evil.test', currentPassword: 'NotTheRight1' });
    // 400, not 401: a wrong confirmation must not sign the client out.
    expect(wrong.status).toBe(400);
    expect(wrong.body).toEqual({ code: 'WRONG_PASSWORD', message: t('en', 'server.auth.wrongCurrentPassword'), field: 'currentPassword' });
    expect((await dana.get('/api/auth/me')).body.user.email).toBe('dana@example.com');

    // Names and a change of letter case only: no password needed.
    const names = await dana.put('/api/auth/profile', { firstName: 'Dina', email: 'DANA@example.com' });
    expect(names.status).toBe(200);
    expect(names.body).toMatchObject({ firstName: 'Dina', email: 'DANA@example.com' });

    const ok = await dana.put('/api/auth/profile', { email: 'dana.new@example.com', currentPassword: PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.body.email).toBe('dana.new@example.com');
    // The previous address is kept on the server only.
    expect(JSON.stringify(ok.body)).not.toContain('previousEmail');
  });

  it('tells the previous address, and a later reset notice reaches both addresses', async () => {
    const { srv, smtp, http } = await boot();
    const token = await register(http, 'dana', 'dana@example.com');
    await enableMail(http, token, smtp);
    const moved = await as(http, token).put('/api/auth/profile', { email: 'dana.new@example.com', currentPassword: PASSWORD });
    expect(moved.status).toBe(200);
    await srv.passwordReset.idle();
    expect(smtp.messages).toHaveLength(1);
    expect(smtp.messages[0].to).toEqual(['dana@example.com']);
    expect(subjectOf(smtp.messages[0])).toBe(t('en', 'server.email.emailChanged.subject'));
    expect(partsOf(smtp.messages[0].data).text).toContain(t('en', 'server.email.emailChanged.notYou'));
    // The new address is not named in the notice.
    expect(smtp.messages[0].data).not.toContain('dana.new@example.com');

    // Forgot password now mails the new address...
    expect((await http.post('/api/auth/forgot-password').send({ email: 'dana.new@example.com' })).status).toBe(200);
    await srv.passwordReset.idle();
    expect(smtp.messages).toHaveLength(2);
    expect(smtp.messages[1].to).toEqual(['dana.new@example.com']);
    const { token: resetToken } = resetDetailsOf(smtp.messages[1]);
    const done = await http
      .post('/api/auth/reset-password')
      .send({ token: resetToken, newPassword: 'NewPassw0rd!', confirmPassword: 'NewPassw0rd!' });
    expect(done.status).toBe(200);
    await srv.passwordReset.idle();
    // ...and the "password changed" notice goes to the new AND the previous address, one e-mail each.
    const notices = smtp.messages.slice(2);
    expect(notices.map((m) => m.to[0]).sort()).toEqual(['dana.new@example.com', 'dana@example.com']);
    for (const m of notices) {
      expect(m.to).toHaveLength(1);
      expect(subjectOf(m)).toBe(t('en', 'server.email.changed.subject'));
    }
  });

  it('recentPreviousEmail forgets the previous address after the notice window', () => {
    const at = '2026-09-01T10:00:00.000Z';
    const base = { email: 'new@example.com', previousEmail: 'old@example.com', emailChangedAt: at };
    expect(recentPreviousEmail(base, new Date('2026-09-02T10:00:00.000Z'))).toBe('old@example.com');
    expect(recentPreviousEmail(base, new Date(Date.parse(at) + EMAIL_CHANGE_NOTICE_WINDOW_MS + 1000))).toBeNull();
    expect(recentPreviousEmail({ ...base, previousEmail: 'NEW@example.com' }, new Date(at))).toBeNull();
    expect(recentPreviousEmail({ email: 'new@example.com' }, new Date(at))).toBeNull();
  });
});

describe('changing the password', () => {
  it('signs out every other device (remember-me included) and keeps the current session', async () => {
    const { http } = await boot();
    const desktop = await register(http, 'dana', 'dana@example.com');
    const phone = (await http.post('/api/auth/login').send({ username: 'dana', password: PASSWORD, rememberMe: true, deviceName: 'Phone' }))
      .body as AuthResponse;
    const laptop = (await http.post('/api/auth/login').send({ username: 'dana', password: PASSWORD })).body as AuthResponse;
    expect((await as(http, phone.token).get('/api/entries')).status).toBe(200);

    const changed = await as(http, desktop).post('/api/auth/change-password', {
      oldPassword: PASSWORD,
      newPassword: 'NewPassw0rd!',
      confirmPassword: 'NewPassw0rd!',
    });
    expect(changed.status).toBe(200);
    expect((await as(http, phone.token).get('/api/entries')).status).toBe(401);
    expect((await as(http, laptop.token).get('/api/entries')).status).toBe(401);
    expect((await as(http, desktop).get('/api/entries')).status).toBe(200);
    const sessions = (await as(http, desktop).get('/api/auth/sessions')).body as Array<{ current: boolean }>;
    expect(sessions).toHaveLength(1);
    expect(sessions[0].current).toBe(true);
  });
});

describe('confirming with the password', () => {
  it('locks after 10 wrong passwords, even for the right one, per account', async () => {
    const { http } = await boot();
    const token = await register(http, 'dana', 'dana@example.com');
    const other = await register(http, 'avi', 'avi@example.com');
    const dana = as(http, token);
    for (let i = 0; i < 9; i++) expect((await dana.post('/api/auth/verify-password', { password: `Wrong${i}pass` })).status).toBe(401);
    const tenth = await dana.post('/api/auth/verify-password', { password: 'Wrong9pass' });
    expect(tenth.status).toBe(429);
    const right = await dana.post('/api/auth/verify-password', { password: PASSWORD });
    expect(right.status).toBe(429);
    // The e-mail change and the password change are locked too; the session itself is not signed out.
    expect((await dana.put('/api/auth/profile', { email: 'x@example.com', currentPassword: PASSWORD })).status).toBe(429);
    expect((await dana.get('/api/auth/me')).status).toBe(200);
    // Another account is not affected.
    expect((await as(http, other).post('/api/auth/verify-password', { password: PASSWORD })).status).toBe(200);
  });
});

describe('the language of a new account', () => {
  it('is the language of the sign-up screen (body language, else Accept-Language), English without either', async () => {
    const { http } = await boot();
    const reg = (username: string, lang?: string, body: object = {}) => {
      const req = http.post('/api/auth/register');
      if (lang) req.set('Accept-Language', lang);
      return req.send({ firstName: 'Test', lastName: 'User', username, email: `${username}@example.com`, password: PASSWORD, confirmPassword: PASSWORD, ...body });
    };
    const languageOf = async (res: supertest.Response) =>
      (await http.get('/api/settings').set('Authorization', `Bearer ${(res.body as AuthResponse).token}`)).body.language;
    expect(await languageOf(await reg('he_user', 'he'))).toBe('he');
    expect(await languageOf(await reg('de_user', 'de-DE,de;q=0.9'))).toBe('de');
    expect(await languageOf(await reg('body_user', 'he', { language: 'ar' }))).toBe('ar');
    expect(await languageOf(await reg('plain_user'))).toBe('en');
  });
});
