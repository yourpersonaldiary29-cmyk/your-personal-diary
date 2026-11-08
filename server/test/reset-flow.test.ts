/**
 * "Forgot password?" end to end (security/password-reset.ts, routes/auth.ts) on a real server with
 * the in-process mock SMTP server - nothing leaves the machine:
 *   register -> diary entries -> forgot-password -> the mock captures the e-mail (account language,
 *   first name, link, code, expiry) -> reset with the link token / with the code -> the old password
 *   fails, the new one works, the SAME diary entries are still readable, every session is signed out,
 *   a "password changed" notice is e-mailed;
 *   the same answer for unknown addresses (no enumeration, no mail), rate limits per address and IP,
 *   expired / used tokens, 5 wrong codes kill the token, lockouts are cleared;
 *   the recovery key: created at registration, missing on older accounts until their next sign-in or
 *   remember-me reopening, re-wrapped on change-password; the reset over the remote HTTPS listener.
 */
import fs from 'node:fs';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import type { AuthResponse, EntryPage, ForgotPasswordResponse, ServerSettings } from '@shared/types';
import { createApp, type AppDeps } from '../src/app';
import type { ServerConfig } from '../src/config';
import { nodeSmtpTransport } from '../src/mail/node-transport';
import { MailService } from '../src/mail/service';
import { resetLinkBase } from '../src/routes/auth';
import type { RemoteController } from '../src/routes/server';
import { createAuthService } from '../src/security/auth-service';
import { loadOrCreateDeviceKey, unwrapRecoveryKey } from '../src/security/device-key';
import { deriveSecret, splitSecret } from '../src/security/kdf';
import { PasswordResetService } from '../src/security/password-reset';
import { RESET_MAX_LIVE_PER_ACCOUNT, ResetStore } from '../src/security/resets';
import { startServer, type RunningServer, type StartOptions } from '../src/server';
import { cleanupTempDirs, sampleEntry, tempDataDir, testConfig } from './helpers';
import { decodeWords, headersOf, partsOf, resetDetailsOf, startMockSmtp, type CapturedMail, type MockSmtp } from './mail-fixtures';
import { makeLeaf, makeTestCa } from './remote-fixtures';

const HOST = 'smtp.mail.test';
const SENDER = 'diary.sender@mail.test';
// Made-up test values for the mock server - never real credentials.
const SMTP_SECRET = 'mock-app-secret-0003';
const PASSWORD = 'Passw0rd!';
const NEW_PASSWORD = 'NewPassw0rd!';
const FAST = { N: 1024, r: 8, p: 1 };

const running: RunningServer[] = [];
const mocks: MockSmtp[] = [];
const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
  for (const m of mocks.splice(0)) await m.close();
  for (const c of closers.splice(0)) await c();
});
afterAll(cleanupTempDirs);

type Http = ReturnType<typeof supertest>;

async function mockSmtp(): Promise<MockSmtp> {
  const smtp = await startMockSmtp({ mode: 'tls', hostname: HOST, users: { [SENDER]: SMTP_SECRET } });
  mocks.push(smtp);
  return smtp;
}

async function boot(opts: { config?: ServerConfig; smtp?: MockSmtp; start?: StartOptions } = {}) {
  const smtp = opts.smtp ?? (await mockSmtp());
  const config = opts.config ?? testConfig();
  const srv = await startServer(config, {
    port: 0,
    quiet: true,
    auth: { kdf: FAST },
    // Generous SMTP step timeout: under a loaded parallel run (scrypt filling the thread pool) a TLS
    // handshake with the mock can take seconds, and a timed-out send made this suite flaky.
    mail: { smtp: { ca: smtp.ca.certPem, connectHost: '127.0.0.1', timeoutMs: 20_000 } },
    passwordReset: { perIpPerHour: 1000, backgroundDelayMs: () => 0 },
    ...opts.start,
  });
  running.push(srv);
  const http = supertest(`http://127.0.0.1:${srv.port}`);
  return { srv, smtp, http, config };
}

async function register(http: Http, username: string, email: string, rememberMe = false): Promise<string> {
  const res = await http
    .post('/api/auth/register')
    .set('Accept-Language', 'he')
    .send({ firstName: username === 'dana' ? 'Dana' : username, lastName: 'Test', username, email, password: PASSWORD, confirmPassword: PASSWORD, rememberMe });
  expect(res.status).toBe(201);
  return (res.body as AuthResponse).token;
}

async function login(http: Http, username: string, password: string) {
  return http.post('/api/auth/login').set('Accept-Language', 'en').send({ username, password });
}

function authed(http: Http, token: string) {
  const h = (req: supertest.Test) => req.set('Authorization', `Bearer ${token}`).set('Accept-Language', 'he');
  return { get: (url: string) => h(http.get(url)), post: (url: string, body: object = {}) => h(http.post(url)).send(body), put: (url: string, body: object) => h(http.put(url)).send(body) };
}

async function enableMail(http: Http, token: string, smtp: MockSmtp) {
  const res = await authed(http, token).put('/api/server/mail', {
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

async function forgot(http: Http, email: string, lang = 'en') {
  return http.post('/api/auth/forgot-password').set('Accept-Language', lang).send({ email });
}

async function reset(http: Http, body: object, lang = 'en') {
  return http.post('/api/auth/reset-password').set('Accept-Language', lang).send({ newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD, ...body });
}

function accountsOf(config: ServerConfig): Array<Record<string, unknown>> {
  return (JSON.parse(fs.readFileSync(config.accountsFile, 'utf8')) as { accounts: Array<Record<string, unknown>> }).accounts;
}

function subjectOf(mail: CapturedMail): string {
  return decodeWords(headersOf(mail.data).subject);
}

describe('password reset by e-mail - end to end', () => {
  it('resets with the link token: new password works, old fails, same entries, everyone signed out, notice sent', async () => {
    const { srv, smtp, http, config } = await boot();
    const danaToken = await register(http, 'dana', 'dana@example.com', true);
    const dana = authed(http, danaToken);
    for (const title of ['יום ראשון ביומן', 'יום שני ביומן']) {
      expect((await dana.post('/api/entries', sampleEntry({ title }))).status).toBe(201);
    }
    // The account language is Hebrew; the forgot request below comes from an English browser.
    expect((await dana.put('/api/settings', { language: 'he' })).status).toBe(200);
    await enableMail(http, danaToken, smtp);
    // A second remember-me session (the phone).
    const phone = (await login(http, 'dana', PASSWORD)).body as AuthResponse;

    const answer = await forgot(http, 'DANA@Example.com');
    expect(answer.status).toBe(200);
    expect(answer.body as ForgotPasswordResponse).toEqual({ ok: true, message: t('en', 'server.reset.sent') });
    await srv.passwordReset.idle();
    expect(smtp.messages).toHaveLength(1);
    const mail = smtp.messages[0];
    expect(mail.to).toEqual(['dana@example.com']);
    expect(subjectOf(mail)).toBe(t('he', 'server.email.reset.subject'));
    const { text, html } = partsOf(mail.data);
    expect(text).toContain(t('he', 'server.email.greeting', { firstName: 'Dana' }));
    expect(text).toContain(t('he', 'server.email.reset.expiry', { minutes: 30 }));
    expect(text).toContain(t('he', 'server.email.reset.ignore'));
    expect(html).toContain('dir="rtl"');
    const details = resetDetailsOf(mail);
    // Remote access is off: the link opens this computer, where the server also serves the UI.
    expect(details.link).toBe(`http://127.0.0.1:${srv.port}/#/reset-password?token=${details.token}`);
    // Only hashes are stored.
    const stored = fs.readFileSync(`${config.dataDir}/resets.json`, 'utf8');
    expect(stored).not.toContain(details.token);
    expect(stored).not.toContain(`"${details.code}"`);

    const mismatch = await reset(http, { token: details.token, confirmPassword: 'Different1' });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.field).toBe('confirmPassword');
    const weak = await reset(http, { token: details.token, newPassword: 'short', confirmPassword: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body).toMatchObject({ code: 'WEAK_PASSWORD', field: 'newPassword' });

    // A rejected new password did not use the link up.
    const done = await reset(http, { token: details.token });
    expect(done.status).toBe(200);
    // The answer names the account that was reset (the app prefills it on the login page).
    expect(done.body).toEqual({ ok: true, message: t('en', 'server.reset.done'), username: 'dana' });

    // Signed out everywhere (desktop and phone, remember-me included).
    expect((await dana.get('/api/auth/me')).status).toBe(401);
    expect((await authed(http, phone.token).get('/api/auth/me')).status).toBe(401);
    const sessionsFile = fs.existsSync(config.sessionsFile) ? fs.readFileSync(config.sessionsFile, 'utf8') : '{}';
    expect(sessionsFile).not.toContain(accountsOf(config)[0].id as string);

    expect((await login(http, 'dana', PASSWORD)).status).toBe(401);
    const fresh = await login(http, 'dana', NEW_PASSWORD);
    expect(fresh.status).toBe(200);
    const entries = await authed(http, (fresh.body as AuthResponse).token).get('/api/entries');
    expect(((entries.body as EntryPage).items.map((e) => e.title)).sort()).toEqual(['יום ראשון ביומן', 'יום שני ביומן']);

    // Single use.
    const again = await reset(http, { token: details.token, newPassword: 'Another1Pass', confirmPassword: 'Another1Pass' });
    expect(again.status).toBe(400);
    expect(again.body).toEqual({ code: 'VALIDATION', message: t('en', 'server.reset.invalid') });

    // The "password changed" notice, in the account language.
    await srv.passwordReset.idle();
    expect(smtp.messages).toHaveLength(2);
    expect(subjectOf(smtp.messages[1])).toBe(t('he', 'server.email.changed.subject'));
    expect(partsOf(smtp.messages[1].data).text).toContain(t('he', 'server.email.changed.signedOut'));
  });

  it('resets with the e-mail address + 6-digit code; 5 wrong codes kill it', async () => {
    const { srv, smtp, http } = await boot();
    const token = await register(http, 'dana', 'dana@example.com');
    expect((await authed(http, token).post('/api/entries', sampleEntry({ title: 'נשאר אחרי האיפוס' }))).status).toBe(201);
    await enableMail(http, token, smtp);

    expect((await forgot(http, 'dana@example.com')).status).toBe(200);
    await srv.passwordReset.idle();
    const first = resetDetailsOf(smtp.messages[0]);
    // The account was created from a Hebrew screen (Accept-Language: he), so it starts in Hebrew and
    // so does its e-mail (known leftover: new accounts used to start in English).
    expect(subjectOf(smtp.messages[0])).toBe(t('he', 'server.email.reset.subject'));
    expect(partsOf(smtp.messages[0].data).text).toContain(t('he', 'server.email.greeting', { firstName: 'Dana' }));

    const wrongCode = first.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const res = await reset(http, { email: 'dana@example.com', code: wrongCode });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(t('en', 'server.reset.invalid'));
    }
    // Dead: neither the right code nor the link works now.
    expect((await reset(http, { email: 'dana@example.com', code: first.code })).status).toBe(400);
    expect((await reset(http, { token: first.token })).status).toBe(400);

    expect((await forgot(http, 'dana@example.com')).status).toBe(200);
    await srv.passwordReset.idle();
    const second = resetDetailsOf(smtp.messages[1]);
    // An unknown address with a valid-looking code answers exactly the same.
    const unknown = await reset(http, { email: 'nobody@example.com', code: second.code });
    expect(unknown.status).toBe(400);
    expect(unknown.body).toEqual({ code: 'VALIDATION', message: t('en', 'server.reset.invalid') });
    const ok = await reset(http, { email: ' Dana@Example.com ', code: ` ${second.code.slice(0, 3)} ${second.code.slice(3)} ` });
    expect(ok.status).toBe(200);
    const signedIn = await login(http, 'dana@example.com', NEW_PASSWORD);
    expect(signedIn.status).toBe(200);
    const page = (await authed(http, (signedIn.body as AuthResponse).token).get('/api/entries')).body as EntryPage;
    expect(page.items.map((e) => e.title)).toEqual(['נשאר אחרי האיפוס']);
  });

  it('stops accepting codes for the account after 10 wrong ones in a day (the link still works)', async () => {
    const { srv, smtp, http } = await boot();
    await enableMail(http, await register(http, 'dana', 'dana@example.com'), smtp);
    const ask = async () => {
      expect((await forgot(http, 'dana@example.com')).status).toBe(200);
      await srv.passwordReset.idle();
      return resetDetailsOf(smtp.messages.at(-1)!);
    };
    for (let round = 0; round < 2; round++) {
      const { code } = await ask();
      const wrong = code === '123456' ? '654321' : '123456';
      for (let i = 0; i < 5; i++) expect((await reset(http, { email: 'dana@example.com', code: wrong })).status).toBe(400);
    }
    const third = await ask();
    const refused = await reset(http, { email: 'dana@example.com', code: third.code });
    expect(refused.status).toBe(400);
    expect(refused.body).toEqual({ code: 'VALIDATION', message: t('en', 'server.reset.invalid') });
    expect((await reset(http, { token: third.token })).status).toBe(200);
  });

  it('answers unknown addresses exactly like registered ones and sends them nothing', async () => {
    const { srv, smtp, http } = await boot();
    await enableMail(http, await register(http, 'dana', 'dana@example.com'), smtp);
    const known = await forgot(http, 'dana@example.com', 'he');
    const unknown = await forgot(http, 'stranger@example.com', 'he');
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    expect(known.body).toEqual({ ok: true, message: 'אם הכתובת הזו רשומה במערכת, שלחנו אליה קישור וקוד.' });
    await srv.passwordReset.idle();
    expect(smtp.messages.map((m) => m.to)).toEqual([['dana@example.com']]);
    // Shape errors are still reported (they reveal nothing about accounts).
    const bad = await forgot(http, 'not-an-address', 'he');
    expect(bad.status).toBe(400);
    expect(bad.body.field).toBe('email');
  });

  it('limits requests to 5 per hour per address (registered or not) and per IP', async () => {
    const { srv, smtp, http } = await boot();
    await enableMail(http, await register(http, 'dana', 'dana@example.com'), smtp);
    for (const email of ['dana@example.com', 'ghost@example.com']) {
      for (let i = 0; i < 5; i++) expect((await forgot(http, email)).status).toBe(200);
      const limited = await forgot(http, email.toUpperCase());
      expect(limited.status).toBe(429);
      expect(limited.body).toEqual({ code: 'FORBIDDEN', message: t('en', 'server.reset.tooMany') });
    }
    await srv.passwordReset.idle();
    // At most 3 live resets per account: the oldest links died.
    expect(smtp.messages).toHaveLength(5);
    const tokens = smtp.messages.map((m) => resetDetailsOf(m).token);
    expect(RESET_MAX_LIVE_PER_ACCOUNT).toBe(3);
    expect((await reset(http, { token: tokens[0] })).status).toBe(400);
    expect((await reset(http, { token: tokens[4] })).status).toBe(200);
    // Every other live reset of the account died with the successful one.
    expect((await reset(http, { token: tokens[3], newPassword: 'Other1Pass', confirmPassword: 'Other1Pass' })).status).toBe(400);

    const strict = await boot({ start: { passwordReset: { perIpPerHour: 2, backgroundDelayMs: () => 0 } } });
    await strict.http.post('/api/auth/register').send({ firstName: 'A', lastName: 'B', username: 'abc', email: 'abc@example.com', password: PASSWORD, confirmPassword: PASSWORD });
    await enableMail(strict.http, ((await login(strict.http, 'abc', PASSWORD)).body as AuthResponse).token, strict.smtp);
    expect((await forgot(strict.http, 'one@example.com')).status).toBe(200);
    expect((await forgot(strict.http, 'two@example.com')).status).toBe(200);
    expect((await forgot(strict.http, 'three@example.com')).status).toBe(429);
  });

  it('expired links answer like wrong ones', async () => {
    const { srv, smtp, http } = await boot({ start: { auth: { kdf: FAST, resetTtlMs: 300 } } });
    await enableMail(http, await register(http, 'dana', 'dana@example.com'), smtp);
    expect((await forgot(http, 'dana@example.com')).status).toBe(200);
    await srv.passwordReset.idle();
    const { token, code } = resetDetailsOf(smtp.messages[0]);
    await new Promise((r) => setTimeout(r, 450));
    expect((await reset(http, { token })).body).toEqual({ code: 'VALIDATION', message: t('en', 'server.reset.invalid') });
    expect((await reset(http, { email: 'dana@example.com', code })).status).toBe(400);
    expect((await login(http, 'dana', PASSWORD)).status).toBe(200);
  });

  it('clears the sign-in lockout of the account', async () => {
    const { srv, smtp, http } = await boot();
    await enableMail(http, await register(http, 'dana', 'dana@example.com'), smtp);
    for (let i = 0; i < 10; i++) await login(http, 'dana', 'Wr0ngPassword');
    const locked = await login(http, 'dana', PASSWORD);
    expect(locked.status).toBe(429);
    expect((await forgot(http, 'dana@example.com')).status).toBe(200);
    await srv.passwordReset.idle();
    expect((await reset(http, { token: resetDetailsOf(smtp.messages[0]).token })).status).toBe(200);
    expect((await login(http, 'dana', NEW_PASSWORD)).status).toBe(200);
  });
});

describe('recovery key escrow', () => {
  it('is created at registration and re-wrapped with the new key on change-password (reset still works after)', async () => {
    const { srv, smtp, http, config } = await boot();
    const token = await register(http, 'dana', 'dana@example.com');
    const deviceKey = loadOrCreateDeviceKey(config.deviceKeyFile);
    const before = accountsOf(config)[0];
    expect(typeof before.recoveryWrappedKey).toBe('string');
    const keyOf = async (record: Record<string, unknown>, password: string) => {
      const kdf = record.kdf as { saltHex: string; N: number; r: number; p: number };
      return splitSecret(await deriveSecret(password, Buffer.from(kdf.saltHex, 'hex'), kdf)).key;
    };
    expect(unwrapRecoveryKey(String(before.recoveryWrappedKey), deviceKey, String(before.id)).equals(await keyOf(before, PASSWORD))).toBe(true);
    // Bound to the account id: it does not open as another account's key.
    expect(() => unwrapRecoveryKey(String(before.recoveryWrappedKey), deviceKey, 'u_someoneelse00')).toThrow();
    // Never sent to a client.
    const listed = await http.get('/api/auth/accounts');
    expect(JSON.stringify(listed.body)).not.toContain('recovery');

    const changed = await authed(http, token).post('/api/auth/change-password', { oldPassword: PASSWORD, newPassword: 'Changed1Pass', confirmPassword: 'Changed1Pass' });
    expect(changed.status).toBe(200);
    const after = accountsOf(config)[0];
    expect(after.recoveryWrappedKey).not.toBe(before.recoveryWrappedKey);
    expect(unwrapRecoveryKey(String(after.recoveryWrappedKey), deviceKey, String(after.id)).equals(await keyOf(after, 'Changed1Pass'))).toBe(true);

    const t2 =((await login(http, 'dana', 'Changed1Pass')).body as AuthResponse).token;
    expect(
      (
        await authed(http, t2).put('/api/server/mail', { host: HOST, port: smtp.port, security: 'tls', username: SENDER, smtpPassword: SMTP_SECRET, enabled: true, password: 'Changed1Pass' })
      ).status,
    ).toBe(200);
    expect((await forgot(http, 'dana@example.com')).status).toBe(200);
    await srv.passwordReset.idle();
    expect((await reset(http, { token: resetDetailsOf(smtp.messages.at(-1)!).token })).status).toBe(200);
    expect((await login(http, 'dana', NEW_PASSWORD)).status).toBe(200);
  });

  it('older accounts get it at their next sign-in, or when a remember-me session reopens the diary', async () => {
    const smtp = await mockSmtp();
    const config = testConfig(tempDataDir());
    const first = await boot({ config, smtp });
    const danaToken = await register(first.http, 'dana', 'dana@example.com', true);
    await enableMail(first.http, danaToken, smtp);
    await first.srv.stop();
    running.splice(running.indexOf(first.srv), 1);

    // Simulate an account from before the feature: no recovery key.
    const strip = () => {
      const file = JSON.parse(fs.readFileSync(config.accountsFile, 'utf8')) as { accounts: Array<Record<string, unknown>> };
      for (const a of file.accounts) delete a.recoveryWrappedKey;
      fs.writeFileSync(config.accountsFile, JSON.stringify(file, null, 2));
    };
    strip();
    const second = await boot({ config, smtp });
    expect((await forgot(second.http, 'dana@example.com')).status).toBe(200);
    await second.srv.passwordReset.idle();
    // No link and no code for a diary that cannot be opened yet - only the reason, to the account's own address.
    expect(smtp.messages).toHaveLength(1);
    const unavailable = partsOf(smtp.messages[0].data).text;
    expect(smtp.messages[0].to).toEqual(['dana@example.com']);
    expect(unavailable).toContain(t('en', 'server.reset.unavailable'));
    expect(unavailable).not.toMatch(/reset-password\?token=|^\d{6}$/m);
    smtp.messages.length = 0;
    // The remembered session reopens the diary after the restart -> the recovery key is back.
    expect((await authed(second.http, danaToken).get('/api/entries')).status).toBe(200);
    expect(typeof accountsOf(config)[0].recoveryWrappedKey).toBe('string');
    await second.srv.stop();
    running.splice(running.indexOf(second.srv), 1);

    strip();
    const third = await boot({ config, smtp });
    expect((await login(third.http, 'dana', PASSWORD)).status).toBe(200);
    expect(typeof accountsOf(config)[0].recoveryWrappedKey).toBe('string');
    expect((await forgot(third.http, 'dana@example.com')).status).toBe(200);
    await third.srv.passwordReset.idle();
    expect(smtp.messages).toHaveLength(1);
  });
});

describe('reset store', () => {
  it('keeps only hashes, expires after the TTL, and is single use', () => {
    let now = new Date('2026-09-29T10:00:00Z');
    const file = `${tempDataDir()}/resets.json`;
    const store = new ResetStore(file, { now: () => now });
    const a = store.create('u_a');
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.code).toMatch(/^\d{6}$/);
    expect(a.expiresAt).toBe('2026-09-29T10:30:00.000Z');
    const text = fs.readFileSync(file, 'utf8');
    expect(text).not.toContain(a.token);
    expect(new ResetStore(file, { now: () => now }).liveCount('u_a')).toBe(1);
    expect(store.takeByToken(a.token)?.userId).toBe('u_a');
    expect(store.takeByToken(a.token)).toBeNull();
    const b = store.create('u_a');
    now = new Date('2026-09-29T10:31:00Z');
    expect(store.takeByToken(b.token)).toBeNull();
    expect(store.takeByCode('u_a', b.code)).toBeNull();
    expect(store.takeByToken('not-a-token')).toBeNull();
  });
});

describe('reset over the remote-access HTTPS listener', () => {
  // (Registration over this listener from another machine stays 403 - covered by remote-review.test.ts;
  // a loopback test client counts as the computer itself.)
  it('works over HTTPS, with the link pointing at the public address', async () => {
    const smtp = await mockSmtp();
    const config = testConfig();
    const auth = await createAuthService(config, { kdf: FAST });
    const deviceKey = loadOrCreateDeviceKey(config.deviceKeyFile);
    const mail = new MailService({ config, deviceKey, transport: nodeSmtpTransport, options: { smtp: { ca: smtp.ca.certPem, connectHost: '127.0.0.1', timeoutMs: 20_000 } } });
    const passwordReset = new PasswordResetService(auth, mail, { log: () => {}, backgroundDelayMs: () => 0 });
    const settings: ServerSettings = { port: 0, lanEnabled: false };
    const remote = { info: () => ({ enabled: true, url: 'https://diarytest.duckdns.org' }), ownerId: () => '', settings: () => undefined } as unknown as RemoteController;
    const deps: AppDeps & { remote: RemoteController; mail: MailService; passwordReset: PasswordResetService } = {
      config,
      auth,
      getServerSettings: () => settings,
      setServerSettings: async (next) => next,
      getListenInfo: () => ({ port: 47399, lanUrls: [], startedAt: new Date().toISOString() }),
      remote,
      mail,
      passwordReset,
    };
    expect(resetLinkBase(deps)).toBe('https://diarytest.duckdns.org');
    const app = createApp(deps);
    const local = supertest(app);
    const reg = await local.post('/api/auth/register').send({ firstName: 'Dana', lastName: 'T', username: 'dana', email: 'dana@example.com', password: PASSWORD, confirmPassword: PASSWORD });
    expect(reg.status).toBe(201);
    expect(
      (
        await local
          .put('/api/server/mail')
          .set('Authorization', `Bearer ${(reg.body as AuthResponse).token}`)
          .send({ host: HOST, port: smtp.port, security: 'tls', username: SENDER, smtpPassword: SMTP_SECRET, enabled: true, password: PASSWORD })
      ).status,
    ).toBe(200);

    // The HTTPS listener of remote access (same app), reached from "the internet".
    const ca = makeTestCa('Remote Test Root');
    const leaf = makeLeaf(ca, 'diarytest.duckdns.org');
    const server = https.createServer({ key: leaf.keyPem, cert: leaf.certPem }, app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    closers.push(async () => {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      await passwordReset.idle();
      await auth.shutdown();
    });
    const port = (server.address() as AddressInfo).port;
    const call = (path: string, body: object) =>
      new Promise<{ status: number; body: Record<string, unknown>; hsts?: string }>((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = https.request(
          { host: '127.0.0.1', port, path, method: 'POST', servername: 'diarytest.duckdns.org', ca: ca.certPem, agent: false, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'Accept-Language': 'en' } },
          (res) => {
            let text = '';
            res.on('data', (c) => (text += c));
            res.on('end', () =>
              resolve({
                status: res.statusCode ?? 0,
                body: JSON.parse(text || '{}') as Record<string, unknown>,
                hsts: res.headers['strict-transport-security'] as string | undefined,
              }),
            );
          },
        );
        req.on('error', reject);
        req.end(payload);
      });

    const asked = await call('/api/auth/forgot-password', { email: 'dana@example.com' });
    expect(asked.status).toBe(200);
    // It really went through the remote-access (TLS) path of the app.
    expect(asked.hsts).toBe('max-age=31536000');
    await passwordReset.idle();
    const details = resetDetailsOf(smtp.messages[0]);
    expect(details.link).toBe(`https://diarytest.duckdns.org/#/reset-password?token=${details.token}`);
    expect(partsOf(smtp.messages[0].data).text).not.toContain(t('en', 'server.email.reset.localLink'));
    const done = await call('/api/auth/reset-password', { token: details.token, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect({ status: done.status, body: done.body }).toEqual({ status: 200, body: { ok: true, message: t('en', 'server.reset.done'), username: 'dana' } });
    expect((await local.post('/api/auth/login').send({ username: 'dana', password: NEW_PASSWORD })).status).toBe(200);
  });
});
