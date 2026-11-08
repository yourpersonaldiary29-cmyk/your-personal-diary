/**
 * Adversarial review of "Forgot password?" (security/password-reset.ts, security/resets.ts, mail/**):
 *   - races: two reset links used at the same time, reset during a password change - the diary
 *     must stay readable with whichever password won (never a file encrypted under one key while
 *     the registry holds the other);
 *   - no account enumeration: same status + body for registered / unknown / key-less addresses, and
 *     no account-dependent work before the answer;
 *   - one account's link / code never resets another account;
 *   - a changed e-mail address voids the links / codes sent to the old one;
 *   - header injection through names / addresses; the SMTP password never in answers, files or logs;
 *   - mail settings refused over the LAN and the remote listener (owner included);
 *   - changing the SMTP host drops the saved SMTP password (it is never sent to a new server);
 *   - deleting an account wipes its recovery key and pending resets;
 *   - remember-me sessions stay revoked after a restart.
 * Everything runs on 127.0.0.1 with the in-process mock SMTP server; no real mail, no Gmail.
 */
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@shared/i18n';
import type { AuthResponse, EntryPage, MailSettingsView, ServerSettings } from '@shared/types';
import { createApp, type AppDeps } from '../src/app';
import type { ServerConfig } from '../src/config';
import { buildMessage, encodeHeaderWords } from '../src/mail/mime';
import { nodeSmtpTransport, sendMail } from '../src/mail/node-transport';
import { MailService } from '../src/mail/service';
import { readMailConfig } from '../src/mail/settings';
import { createAuthService, type DiaryAuthService } from '../src/security/auth-service';
import { loadOrCreateDeviceKey } from '../src/security/device-key';
import { PasswordResetService } from '../src/security/password-reset';
import { cleanupTempDirs, sampleEntry, testConfig } from './helpers';
import { headersOf, partsOf, resetDetailsOf, startMockSmtp, type MockSmtp } from './mail-fixtures';

const HOST = 'smtp.mail.test';
const SENDER = 'diary.sender@mail.test';
// Made-up test values for the mock server - never real credentials.
const SMTP_SECRET = 'mock-review-secret-0004';
const PASSWORD = 'Passw0rd!';
const FAST = { N: 1024, r: 8, p: 1 };

const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c().catch(() => undefined);
  vi.restoreAllMocks();
});
afterAll(cleanupTempDirs);

type Agent = ReturnType<typeof supertest>;

interface Harness {
  config: ServerConfig;
  auth: DiaryAuthService;
  mail: MailService;
  reset: PasswordResetService;
  smtp: MockSmtp;
  logs: string[];
  /** The computer itself (127.0.0.1). */
  local: Agent;
  /** A phone on the home network (phone access on). */
  lan: Agent;
  /** The remote-access HTTPS listener (TLS socket from an internet address). */
  internet: Agent;
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)));
}

/** Serves `app` on 127.0.0.1 but makes every request look like it came from `remoteAddress` (and over TLS when `encrypted`). */
async function serveAs(app: http.RequestListener, remoteAddress: string | null, encrypted = false): Promise<Agent> {
  const server = http.createServer((req, res) => {
    if (remoteAddress) Object.defineProperty(req.socket, 'remoteAddress', { value: remoteAddress, configurable: true });
    if (encrypted) (req.socket as { encrypted?: boolean }).encrypted = true;
    app(req, res);
  });
  const port = await listen(server);
  cleanups.push(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  );
  return supertest(`http://127.0.0.1:${port}`);
}

async function harness(config: ServerConfig = testConfig()): Promise<Harness> {
  const smtp = await startMockSmtp({ mode: 'tls', hostname: HOST, users: { [SENDER]: SMTP_SECRET } });
  cleanups.push(() => smtp.close());
  const auth = await createAuthService(config, { kdf: FAST });
  cleanups.push(() => auth.shutdown());
  const deviceKey = loadOrCreateDeviceKey(config.deviceKeyFile);
  const mail = new MailService({ config, deviceKey, transport: nodeSmtpTransport, options: { smtp: { ca: smtp.ca.certPem, connectHost: '127.0.0.1', timeoutMs: 20_000 } } });
  const logs: string[] = [];
  const reset = new PasswordResetService(auth, mail, { perIpPerHour: 1000, log: (line) => logs.push(line), backgroundDelayMs: () => 0 });
  cleanups.push(() => reset.idle());
  const settings: ServerSettings = { port: 0, lanEnabled: true };
  const deps: AppDeps & { mail: MailService; passwordReset: PasswordResetService } = {
    config,
    auth,
    getServerSettings: () => settings,
    setServerSettings: async (next) => Object.assign(settings, next),
    getListenInfo: () => ({ port: 47999, lanUrls: [], startedAt: new Date().toISOString() }),
    mail,
    passwordReset: reset,
  };
  const app = createApp(deps);
  return {
    config,
    auth,
    mail,
    reset,
    smtp,
    logs,
    local: await serveAs(app, null),
    lan: await serveAs(app, '192.168.1.50'),
    internet: await serveAs(app, '198.51.100.23', true),
  };
}

async function register(h: Harness, username: string, email: string, rememberMe = false): Promise<string> {
  const res = await h.local
    .post('/api/auth/register')
    .set('Accept-Language', 'en')
    .send({ firstName: username, lastName: 'Test', username, email, password: PASSWORD, confirmPassword: PASSWORD, rememberMe });
  expect(res.status).toBe(201);
  return (res.body as AuthResponse).token;
}

function as(agent: Agent, token: string, lang = 'en') {
  return {
    get: (url: string) => agent.get(url).set('Authorization', `Bearer ${token}`).set('Accept-Language', lang),
    put: (url: string, body: object) => agent.put(url).set('Authorization', `Bearer ${token}`).set('Accept-Language', lang).send(body),
    post: (url: string, body: object = {}) => agent.post(url).set('Authorization', `Bearer ${token}`).set('Accept-Language', lang).send(body),
  };
}

async function enableMail(h: Harness, token: string): Promise<void> {
  const res = await as(h.local, token).put('/api/server/mail', {
    host: HOST,
    port: h.smtp.port,
    security: 'tls',
    username: SENDER,
    smtpPassword: SMTP_SECRET,
    enabled: true,
    password: PASSWORD,
  });
  expect(res.status).toBe(200);
}

async function forgot(agent: Agent, email: string) {
  return agent.post('/api/auth/forgot-password').set('Accept-Language', 'en').send({ email });
}

async function resetWith(agent: Agent, body: object, newPassword: string) {
  return agent.post('/api/auth/reset-password').set('Accept-Language', 'en').send({ newPassword, confirmPassword: newPassword, ...body });
}

/** Asks for a reset e-mail and returns its link token + code. */
async function mailedReset(h: Harness, email: string): Promise<{ token: string; code: string }> {
  const before = h.smtp.messages.length;
  expect((await forgot(h.local, email)).status).toBe(200);
  await h.reset.idle();
  expect(h.smtp.messages.length).toBe(before + 1);
  return resetDetailsOf(h.smtp.messages[before]);
}

async function titlesAfterLogin(h: Harness, username: string, password: string): Promise<string[]> {
  const res = await h.local.post('/api/auth/login').send({ username, password });
  expect(res.status).toBe(200);
  const page = await as(h.local, (res.body as AuthResponse).token).get('/api/entries');
  expect(page.status).toBe(200);
  return (page.body as EntryPage).items.map((e) => e.title).sort();
}

describe('password reset - races keep the diary readable', () => {
  it('two reset links used at the same time: the winning password opens the SAME diary', async () => {
    for (let round = 0; round < 3; round++) {
      const h = await harness();
      const token = await register(h, 'dana', 'dana@example.com');
      expect((await as(h.local, token).post('/api/entries', sampleEntry({ title: 'שורד את המרוץ' }))).status).toBe(201);
      await enableMail(h, token);
      const first = await mailedReset(h, 'dana@example.com');
      const second = await mailedReset(h, 'dana@example.com');

      const [a, b] = await Promise.all([
        resetWith(h.local, { token: first.token }, 'FirstNew1pass'),
        resetWith(h.local, { token: second.token }, 'SecondNew2pass'),
      ]);
      const winners = [a, b].filter((r) => r.status === 200);
      expect(winners.length).toBeGreaterThan(0);
      // Whichever password the registry now accepts must open the diary with every entry.
      const firstLogin = await h.local.post('/api/auth/login').send({ username: 'dana', password: 'FirstNew1pass' });
      const password = firstLogin.status === 200 ? 'FirstNew1pass' : 'SecondNew2pass';
      expect(await titlesAfterLogin(h, 'dana', password)).toEqual(['שורד את המרוץ']);
      for (const c of cleanups.splice(0).reverse()) await c().catch(() => undefined);
    }
  });

  it('a reset while the account changes its password: the diary still opens with the password the registry holds', async () => {
    const h = await harness();
    const token = await register(h, 'dana', 'dana@example.com');
    expect((await as(h.local, token).post('/api/entries', sampleEntry({ title: 'עדיין כאן' }))).status).toBe(201);
    await enableMail(h, token);
    const link = await mailedReset(h, 'dana@example.com');
    const [changed, reset] = await Promise.all([
      as(h.local, token).post('/api/auth/change-password', { oldPassword: PASSWORD, newPassword: 'Changed1pass', confirmPassword: 'Changed1pass' }),
      resetWith(h.local, { token: link.token }, 'ResetNew1pass'),
    ]);
    expect([changed.status, reset.status]).toContain(200);
    const viaReset = await h.local.post('/api/auth/login').send({ username: 'dana', password: 'ResetNew1pass' });
    const password = viaReset.status === 200 ? 'ResetNew1pass' : 'Changed1pass';
    expect(await titlesAfterLogin(h, 'dana', password)).toEqual(['עדיין כאן']);
  });

  it('entries written just before the reset (not yet flushed) survive it', async () => {
    const h = await harness();
    const token = await register(h, 'dana', 'dana@example.com');
    await enableMail(h, token);
    const link = await mailedReset(h, 'dana@example.com');
    // Written and reset in the same breath: the debounced write has not reached the disk yet.
    expect((await as(h.local, token).post('/api/entries', sampleEntry({ title: 'רגע לפני' }))).status).toBe(201);
    expect((await resetWith(h.local, { token: link.token }, 'Fresh1pass')).status).toBe(200);
    expect((await as(h.local, token).get('/api/auth/me')).status).toBe(401);
    expect(await titlesAfterLogin(h, 'dana', 'Fresh1pass')).toEqual(['רגע לפני']);
  });
});

describe('password reset - no enumeration, no cross-account use', () => {
  it('answers registered, unknown and key-less addresses identically, with the account work only after the answer', async () => {
    const h = await harness();
    const token = await register(h, 'dana', 'dana@example.com');
    await enableMail(h, token);
    // An account without a recovery key (as if registered before the feature existed).
    await register(h, 'old', 'old@example.com');
    const oldId = h.auth.accounts.findByUsername('old')!.id;
    const raw = JSON.parse(fs.readFileSync(h.config.accountsFile, 'utf8')) as { accounts: Array<Record<string, unknown>> };
    for (const a of raw.accounts) if (a.id === oldId) delete a.recoveryWrappedKey;
    fs.writeFileSync(h.config.accountsFile, JSON.stringify(raw));
    h.auth.accounts.reload();

    const answers = [];
    for (const email of ['dana@example.com', 'nobody@example.com', 'old@example.com']) {
      const res = await forgot(h.lan, email);
      answers.push({ status: res.status, body: res.body, type: res.headers['content-type'] });
    }
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
    await h.reset.idle();
    // The registered address gets its link; the key-less one only the reason (no link, no code);
    // the unknown address nothing. The requester saw the same answer for all three.
    expect(h.smtp.messages.map((m) => m.to[0]).sort()).toEqual(['dana@example.com', 'old@example.com']);
    const keyless = partsOf(h.smtp.messages.find((m) => m.to[0] === 'old@example.com')!.data).text;
    expect(keyless).toContain(t('en', 'server.reset.unavailable'));
    expect(keyless).not.toMatch(/reset-password\?token=|^\d{6}$/m);
    // The log line about the key-less account names no address.
    expect(h.logs.join('\n')).not.toMatch(/@/);

    // Nothing that depends on the account runs before the route has answered.
    const danaId = h.auth.accounts.findByUsername('dana')!.id;
    const live = h.auth.resets.liveCount(danaId);
    h.reset.request({ email: 'dana@example.com', ip: '10.0.0.9', locale: 'en', linkBase: 'http://127.0.0.1:1' });
    expect(h.auth.resets.liveCount(danaId)).toBe(live);
    await h.reset.idle();
    expect(h.auth.resets.liveCount(danaId)).toBe(Math.min(live + 1, 3));
  });

  it("one account's link or code never resets another account", async () => {
    const h = await harness();
    const danaToken = await register(h, 'dana', 'dana@example.com');
    await register(h, 'avi', 'avi@example.com');
    await enableMail(h, danaToken);
    const dana = await mailedReset(h, 'dana@example.com');
    // Dana's code with Avi's address: invalid, and Avi's password is untouched.
    const cross = await resetWith(h.local, { email: 'avi@example.com', code: dana.code }, 'Hijack1pass');
    expect(cross.status).toBe(400);
    expect(cross.body).toEqual({ code: 'VALIDATION', message: t('en', 'server.reset.invalid') });
    // A token together with somebody else's address resets only the token's own account.
    const own = await resetWith(h.local, { token: dana.token, email: 'avi@example.com', code: '000000' }, 'DanaNew1pass');
    expect(own.status).toBe(200);
    expect((await h.local.post('/api/auth/login').send({ username: 'avi', password: PASSWORD })).status).toBe(200);
    expect((await h.local.post('/api/auth/login').send({ username: 'avi', password: 'DanaNew1pass' })).status).toBe(401);
    expect((await h.local.post('/api/auth/login').send({ username: 'dana', password: 'DanaNew1pass' })).status).toBe(200);
  });

  it('a changed e-mail address voids the links and codes sent to the old one', async () => {
    const h = await harness();
    const token = await register(h, 'dana', 'dana@example.com');
    await enableMail(h, token);
    const old = await mailedReset(h, 'dana@example.com');
    expect((await as(h.local, token).put('/api/auth/profile', { email: 'dana.new@example.com', currentPassword: PASSWORD })).status).toBe(200);
    // The previous address is told about the change.
    await h.reset.idle();
    expect(h.smtp.messages.at(-1)?.to).toEqual(['dana@example.com']);
    expect((await resetWith(h.local, { token: old.token }, 'Stolen1pass')).status).toBe(400);
    expect((await resetWith(h.local, { email: 'dana.new@example.com', code: old.code }, 'Stolen1pass')).status).toBe(400);
    expect((await h.local.post('/api/auth/login').send({ username: 'dana', password: PASSWORD })).status).toBe(200);
    // A new request goes to the new address.
    const fresh = await mailedReset(h, 'dana.new@example.com');
    expect(h.smtp.messages.at(-1)?.to).toEqual(['dana.new@example.com']);
    expect((await resetWith(h.local, { token: fresh.token }, 'Rightful1pass')).status).toBe(200);
  });
});

describe('password reset - e-mail content and secrets', () => {
  it('names with line breaks cannot add headers or recipients', async () => {
    const h = await harness();
    const token = await register(h, 'dana', 'dana@example.com');
    await enableMail(h, token);
    const evil = await h.local
      .post('/api/auth/register')
      .send({
        firstName: 'Eve\r\nBcc: spy@evil.test\r\n\r\n<b>x</b>',
        lastName: 'X\nSubject: hacked',
        username: 'eve',
        email: 'eve@example.com',
        password: PASSWORD,
        confirmPassword: PASSWORD,
      });
    expect(evil.status).toBe(201);
    await mailedReset(h, 'eve@example.com');
    const mail = h.smtp.messages.at(-1)!;
    expect(mail.to).toEqual(['eve@example.com']);
    const headers = headersOf(mail.data);
    expect(headers.bcc).toBeUndefined();
    expect(Object.keys(headers).sort()).toEqual(['auto-submitted', 'content-type', 'date', 'from', 'message-id', 'mime-version', 'subject', 'to']);
    const { html } = partsOf(mail.data);
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');

    // The builders refuse or neutralise line breaks on their own too.
    expect(encodeHeaderWords('a\r\nBcc: x@y.z')).not.toMatch(/[\r\n](?! )/);
    expect(() => buildMessage(SENDER, { to: 'a@b.test\r\nBcc: x@y.test', subject: 's', text: 't', html: 'h' })).toThrow();
    expect(() => buildMessage('a@b.test>\r\nX: y', { to: 'a@b.test', subject: 's', text: 't', html: 'h' })).toThrow();
    await expect(
      sendMail({ host: HOST, port: h.smtp.port, security: 'tls', username: SENDER, password: SMTP_SECRET }, { from: SENDER, to: 'a@b.test>\r\nRSET' }, 'x'),
    ).rejects.toMatchObject({ key: 'server.mail.error.address' });

    // An address the header builder refuses: the answer is still the same, nothing is sent, nothing leaks.
    const weird = await h.local
      .post('/api/auth/register')
      .send({ firstName: 'W', lastName: 'X', username: 'weird', email: 'we<ird>@example.com', password: PASSWORD, confirmPassword: PASSWORD });
    expect(weird.status).toBe(201);
    const before = h.smtp.messages.length;
    const answer = await forgot(h.local, 'we<ird>@example.com');
    expect(answer.status).toBe(200);
    await h.reset.idle();
    expect(h.smtp.messages.length).toBe(before);
    expect(h.logs.join('\n')).not.toContain('we<ird>');
  });

  it('the SMTP password never appears in an answer, a stored file, the smtp error or the logs', async () => {
    const lines: string[] = [];
    const capture = (...args: unknown[]) => void lines.push(args.map(String).join(' '));
    vi.spyOn(console, 'error').mockImplementation(capture);
    vi.spyOn(console, 'log').mockImplementation(capture);
    vi.spyOn(console, 'warn').mockImplementation(capture);
    const h = await harness();
    const token = await register(h, 'dana', 'dana@example.com');
    const bodies: string[] = [];
    const put = await as(h.local, token).put('/api/server/mail', {
      host: HOST,
      port: h.smtp.port,
      security: 'tls',
      username: SENDER,
      smtpPassword: SMTP_SECRET,
      enabled: true,
      password: PASSWORD,
    });
    bodies.push(JSON.stringify(put.body));
    bodies.push(JSON.stringify((await as(h.local, token).get('/api/server/mail')).body));
    bodies.push(JSON.stringify((await as(h.local, token).post('/api/server/mail/test')).body));
    bodies.push(JSON.stringify((await h.local.get('/api/server/info')).body));
    bodies.push(JSON.stringify((await as(h.local, token).get('/api/server/settings')).body));
    // A wrong SMTP password: the 502 names the failure, never the secret.
    expect((await as(h.local, token).put('/api/server/mail', { smtpPassword: `${SMTP_SECRET}-wrong`, password: PASSWORD })).status).toBe(200);
    const failed = await as(h.local, token).post('/api/server/mail/test');
    expect(failed.status).toBe(502);
    bodies.push(JSON.stringify(failed.body));
    expect((await forgot(h.local, 'dana@example.com')).status).toBe(200);
    await h.reset.idle();
    for (const text of [...bodies, ...lines, ...h.logs]) {
      expect(text).not.toContain(SMTP_SECRET);
      expect(text).not.toContain(Buffer.from(`\0${SENDER}\0${SMTP_SECRET}`).toString('base64'));
    }
    for (const file of fs.readdirSync(h.config.dataDir)) {
      const full = `${h.config.dataDir}/${file}`;
      if (fs.statSync(full).isFile()) expect(fs.readFileSync(full, 'latin1')).not.toContain(SMTP_SECRET);
    }
  });
});

describe('mail settings - only the owner, only at the computer, only with the password', () => {
  it('refuses the LAN and the remote listener (even for the owner), a missing password and another account', async () => {
    const h = await harness();
    const token = await register(h, 'dana', 'dana@example.com');
    await enableMail(h, token);
    // The owner signs in from the phone / the internet: sign-in works, the mail settings do not.
    for (const agent of [h.lan, h.internet]) {
      const signIn = await agent.post('/api/auth/login').send({ username: 'dana', password: PASSWORD });
      expect(signIn.status).toBe(200);
      const remoteToken = (signIn.body as AuthResponse).token;
      for (const res of [
        await as(agent, remoteToken).get('/api/server/mail'),
        await as(agent, remoteToken).put('/api/server/mail', { enabled: false, password: PASSWORD }),
        await as(agent, remoteToken).post('/api/server/mail/test'),
      ]) {
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ code: 'FORBIDDEN', message: t('en', 'server.mail.localOnly') });
      }
    }
    // Without a session at all.
    expect((await h.local.get('/api/server/mail')).status).toBe(401);
    expect((await h.local.put('/api/server/mail').send({ enabled: false, password: PASSWORD })).status).toBe(401);
    // Without the password (still owner, still local).
    const noPw = await as(h.local, token).put('/api/server/mail', { enabled: false });
    expect(noPw.status).toBe(400);
    expect(noPw.body.field).toBe('password');
    expect(h.mail.view().enabled).toBe(true);
    // Remote registration stays blocked while the reset works remotely.
    expect((await h.internet.post('/api/auth/register').send({ firstName: 'E', lastName: 'V', username: 'eve', email: 'eve@example.com', password: PASSWORD, confirmPassword: PASSWORD })).status).toBe(403);
    expect((await forgot(h.internet, 'dana@example.com')).status).toBe(200);
    await h.reset.idle();
    const { token: link } = resetDetailsOf(h.smtp.messages.at(-1)!);
    expect((await resetWith(h.internet, { token: link }, 'Remote1pass')).status).toBe(200);
  });

  it('changing the SMTP host drops the saved SMTP password (it is never sent to another server)', async () => {
    const h = await harness();
    const token = await register(h, 'dana', 'dana@example.com');
    await enableMail(h, token);
    const moved = await as(h.local, token).put('/api/server/mail', { host: 'smtp.elsewhere.test', password: PASSWORD });
    expect(moved.status).toBe(400);
    expect(moved.body).toMatchObject({ code: 'VALIDATION', field: 'smtpPassword' });
    expect(h.mail.view()).toMatchObject({ host: HOST, smtpPasswordSet: true, enabled: true });
    // Turned off, the new host is accepted but the old secret is gone.
    const off = await as(h.local, token).put('/api/server/mail', { host: 'smtp.elsewhere.test', enabled: false, password: PASSWORD });
    expect(off.status).toBe(200);
    expect(off.body as MailSettingsView).toMatchObject({ host: 'smtp.elsewhere.test', smtpPasswordSet: false });
    expect(readMailConfig(h.config, loadOrCreateDeviceKey(h.config.deviceKeyFile)).password).toBe('');
    // Same host in another spelling keeps it; other fields keep it.
    await enableMail(h, token);
    const same = await as(h.local, token).put('/api/server/mail', { host: HOST.toUpperCase(), port: h.smtp.port, password: PASSWORD });
    expect(same.status).toBe(200);
    expect((same.body as MailSettingsView).smtpPasswordSet).toBe(true);
  });
});

describe('account deletion and sessions', () => {
  it('deleting the account wipes its recovery key and pending resets', async () => {
    const h = await harness();
    const ownerToken = await register(h, 'owner', 'owner@example.com');
    await enableMail(h, ownerToken);
    const token = await register(h, 'dana', 'dana@example.com');
    const id = h.auth.accounts.findByUsername('dana')!.id;
    const link = await mailedReset(h, 'dana@example.com');
    expect(fs.readFileSync(`${h.config.dataDir}/resets.json`, 'utf8')).toContain(id);
    expect((await as(h.local, token).post('/api/auth/delete-account', { password: PASSWORD })).status).toBe(204);
    expect(fs.readFileSync(h.config.accountsFile, 'utf8')).not.toContain(id);
    expect(fs.readFileSync(`${h.config.dataDir}/resets.json`, 'utf8')).not.toContain(id);
    expect(fs.existsSync(`${h.config.usersDir}/${id}.mpd`)).toBe(false);
    expect((await resetWith(h.local, { token: link.token }, 'Zombie1pass')).status).toBe(400);
    // The address is free again, and a forgot request for it sends nothing.
    const before = h.smtp.messages.length;
    expect((await forgot(h.local, 'dana@example.com')).status).toBe(200);
    await h.reset.idle();
    expect(h.smtp.messages.length).toBe(before);
  });

  it('remember-me sessions revoked by a reset stay revoked after a restart', async () => {
    const config = testConfig();
    const h = await harness(config);
    const token = await register(h, 'dana', 'dana@example.com', true);
    await enableMail(h, token);
    const phone = await h.lan.post('/api/auth/login').send({ username: 'dana', password: PASSWORD, rememberMe: true });
    expect(phone.status).toBe(200);
    const link = await mailedReset(h, 'dana@example.com');
    expect((await resetWith(h.local, { token: link.token }, 'Restart1pass')).status).toBe(200);
    for (const c of cleanups.splice(0).reverse()) await c().catch(() => undefined);

    const again = await harness(config);
    expect((await as(again.local, token).get('/api/auth/me')).status).toBe(401);
    expect((await as(again.lan, (phone.body as AuthResponse).token).get('/api/auth/me')).status).toBe(401);
    expect((await again.local.post('/api/auth/login').send({ username: 'dana', password: 'Restart1pass' })).status).toBe(200);
  });
});
