/**
 * Mail settings (password reset by e-mail) - owner-only and password-gated exactly like remote access:
 *   - GET/PUT /api/server/mail and POST /api/server/mail/test only for the owner - the account created
 *     first on this computer, from the start: a second account that saves first gets 403 notOwner
 *     (checked again at write time); GET /api/server/settings reports `isMailOwner`;
 *   - a stored owner that is not the first account keeps the settings (a notice is logged at startup);
 *     settings without a stored owner become the first account's (at startup, when the first account
 *     registers, and right before any deletion), so deleting it clears them; a stored owner that is
 *     not an account id is released like a deleted owner;
 *   - every PUT needs the account password (400 VALIDATION / 400 WRONG_PASSWORD on the password field);
 *   - the SMTP password (App Password) is encrypted with the device key in server-settings.json and is
 *     never returned or logged (only `smtpPasswordSet`);
 *   - the test e-mail goes to the owner's own address; SMTP failures come back localised (502);
 *   - GET /api/server/info reports `passwordResetAvailable`; forgot-password answers 503 while mail is off;
 *   - deleting the owner account forgets the settings - only then does the next-oldest account own
 *     them; until they are cleared nobody else can see or save over them.
 * A real server on 127.0.0.1 with the in-process mock SMTP server - nothing leaves the machine.
 */
import fs from 'node:fs';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@shared/i18n';
import type { AuthResponse, MailSettingsView, MailTestResult, ServerInfo } from '@shared/types';
import { readRawServerSettings, writeRawServerSettings, type ServerConfig } from '../src/config';
import { mailOverridesFromEnv } from '../src/mail/env-overrides';
import { decryptSmtpPassword, MAIL_DEFAULTS, readMailConfig, writeMailConfig } from '../src/mail/settings';
import { loadOrCreateDeviceKey } from '../src/security/device-key';
import { UNREADABLE_OWNER } from '../src/security/owner';
import { startServer, type RunningServer } from '../src/server';
import { cleanupTempDirs, testConfig } from './helpers';
import { decodeWords, headersOf, startMockSmtp, type MockSmtp } from './mail-fixtures';

const HOST = 'smtp.mail.test';
const SENDER = 'diary.sender@mail.test';
// Made-up test values for the mock server - never real credentials.
const SMTP_SECRET = 'mock-app-secret-0002';
const PASSWORD = 'Passw0rd!';
const FAST = { N: 1024, r: 8, p: 1 };

const running: RunningServer[] = [];
const mocks: MockSmtp[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
  for (const m of mocks.splice(0)) await m.close();
});
afterAll(cleanupTempDirs);

async function boot(config: ServerConfig = testConfig(), log?: (line: string) => void) {
  const smtp = await startMockSmtp({ mode: 'tls', hostname: HOST, users: { [SENDER]: SMTP_SECRET } });
  mocks.push(smtp);
  const srv = await startServer(config, {
    port: 0,
    quiet: true,
    auth: { kdf: FAST },
    mail: { smtp: { ca: smtp.ca.certPem, connectHost: '127.0.0.1', timeoutMs: 5000 }, ...(log ? { log } : {}) },
  });
  running.push(srv);
  const http = supertest(`http://127.0.0.1:${srv.port}`);
  return { srv, smtp, http, config };
}

type Http = ReturnType<typeof supertest>;

async function register(http: Http, username: string, email: string): Promise<string> {
  const res = await http
    .post('/api/auth/register')
    .set('Accept-Language', 'he')
    .send({ firstName: username, lastName: 'Test', username, email, password: PASSWORD, confirmPassword: PASSWORD });
  expect(res.status).toBe(201);
  return (res.body as AuthResponse).token;
}

async function login(http: Http, username: string): Promise<string> {
  const res = await http.post('/api/auth/login').send({ username, password: PASSWORD, rememberMe: false });
  expect(res.status).toBe(200);
  return (res.body as AuthResponse).token;
}

function idOf(config: ServerConfig, username: string): string {
  const accounts = JSON.parse(fs.readFileSync(config.accountsFile, 'utf8')) as { accounts: Array<{ id: string; username: string }> };
  return accounts.accounts.find((a) => a.username === username)?.id ?? '';
}

function as(http: Http, token: string, lang = 'he') {
  return {
    get: (url: string) => http.get(url).set('Authorization', `Bearer ${token}`).set('Accept-Language', lang),
    put: (url: string, body: object) => http.put(url).set('Authorization', `Bearer ${token}`).set('Accept-Language', lang).send(body),
    post: (url: string, body: object = {}) => http.post(url).set('Authorization', `Bearer ${token}`).set('Accept-Language', lang).send(body),
  };
}

function smtpSettings(smtp: MockSmtp) {
  return { host: HOST, port: smtp.port, security: 'tls', username: SENDER, smtpPassword: SMTP_SECRET, enabled: true };
}

describe('mail settings', () => {
  it('start with the Gmail defaults, need the account password, and belong to the first account created', async () => {
    const { srv, smtp, http, config } = await boot();
    const dana = as(http, await register(http, 'dana', 'dana@example.com'));

    const initial = await dana.get('/api/server/mail');
    expect(initial.status).toBe(200);
    expect(initial.body as MailSettingsView).toEqual({
      enabled: false,
      host: 'smtp.gmail.com',
      port: 465,
      security: 'tls',
      username: '',
      smtpPasswordSet: false,
      fromAddress: '',
      ready: false,
      // The first account owns them from the start.
      hasOwner: true,
    });
    expect(((await http.get('/api/server/info')).body as ServerInfo).passwordResetAvailable).toBe(false);

    const noPassword = await dana.put('/api/server/mail', smtpSettings(smtp));
    expect(noPassword.status).toBe(400);
    expect(noPassword.body).toEqual({ code: 'VALIDATION', message: t('he', 'server.mail.passwordRequired'), field: 'password' });
    const wrong = await dana.put('/api/server/mail', { ...smtpSettings(smtp), password: 'Wr0ngPassword' });
    expect(wrong.status).toBe(400);
    expect(wrong.body).toEqual({ code: 'WRONG_PASSWORD', message: t('he', 'server.mail.wrongPassword'), field: 'password' });
    // The session survives a wrong password, and nothing was saved.
    expect((await dana.get('/api/auth/me')).status).toBe(200);
    expect(readRawServerSettings(config).mail).toBeUndefined();

    const saved = await dana.put('/api/server/mail', { ...smtpSettings(smtp), password: PASSWORD });
    expect(saved.status).toBe(200);
    expect(saved.body as MailSettingsView).toMatchObject({
      enabled: true,
      host: HOST,
      port: smtp.port,
      username: SENDER,
      smtpPasswordSet: true,
      ready: true,
      hasOwner: true,
    });
    expect(JSON.stringify(saved.body)).not.toContain(SMTP_SECRET);
    expect(((await http.get('/api/server/info')).body as ServerInfo).passwordResetAvailable).toBe(true);

    // At rest: encrypted with the device key, never in clear text.
    const fileText = fs.readFileSync(config.settingsFile, 'utf8');
    expect(fileText).not.toContain(SMTP_SECRET);
    const block = readRawServerSettings(config).mail as Record<string, unknown>;
    const accounts = JSON.parse(fs.readFileSync(config.accountsFile, 'utf8')) as { accounts: Array<{ id: string; username: string }> };
    expect(block.ownerUserId).toBe(accounts.accounts.find((a) => a.username === 'dana')?.id);
    expect(decryptSmtpPassword(String(block.passwordEnc), loadOrCreateDeviceKey(config.deviceKeyFile))).toBe(SMTP_SECRET);
    expect(srv.mail.view().smtpPasswordSet).toBe(true);

    // Another account of this computer can neither see nor change nor use them.
    const avi = as(http, await register(http, 'avi', 'avi@example.com'));
    for (const res of [
      await avi.get('/api/server/mail'),
      await avi.put('/api/server/mail', { enabled: false, password: PASSWORD }),
      await avi.post('/api/server/mail/test'),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ code: 'FORBIDDEN', message: t('he', 'server.mail.notOwner') });
    }
    expect(((await dana.get('/api/server/mail')).body as MailSettingsView).enabled).toBe(true);
  });

  it('sends the test e-mail to the owner and reports SMTP failures in the request language without the password', async () => {
    const { smtp, http } = await boot();
    const dana = as(http, await register(http, 'dana', 'dana@example.com'), 'en');
    expect((await dana.put('/api/server/mail', { ...smtpSettings(smtp), password: PASSWORD })).status).toBe(200);

    const sent = await dana.post('/api/server/mail/test');
    expect(sent.status).toBe(200);
    const result = sent.body as MailTestResult;
    expect(result).toMatchObject({ ok: true, sentTo: 'dana@example.com', message: t('en', 'server.mail.testSent', { address: 'dana@example.com' }) });
    expect(smtp.messages).toHaveLength(1);
    expect(smtp.messages[0].to).toEqual(['dana@example.com']);
    expect(smtp.messages[0].from).toBe(SENDER);
    expect(decodeWords(headersOf(smtp.messages[0].data).subject)).toBe('Test e-mail - Your Personal Diary');

    expect((await dana.put('/api/server/mail', { smtpPassword: 'wrong-secret-9', password: PASSWORD })).status).toBe(200);
    const failed = await dana.post('/api/server/mail/test');
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ code: 'OTHER', message: t('en', 'server.mail.error.auth') });
    expect(JSON.stringify(failed.body)).not.toContain('wrong-secret-9');
  });

  it('validates the fields and strips the spaces Gmail shows in an App Password', async () => {
    const { http, config } = await boot();
    const dana = as(http, await register(http, 'dana', 'dana@example.com'));
    const put = (body: object) => dana.put('/api/server/mail', { ...body, password: PASSWORD });

    const cases: Array<[object, string, string]> = [
      [{ enabled: true, username: SENDER }, 'smtpPassword', 'server.mail.smtpPasswordRequired'],
      [{ enabled: true, smtpPassword: 'x' }, 'username', 'server.mail.usernameRequired'],
      [{ host: 'https://smtp.gmail.com/' }, 'host', 'server.mail.hostInvalid'],
      [{ port: 70000 }, 'port', 'server.mail.portInvalid'],
      [{ security: 'ssl' }, 'security', 'server.mail.securityInvalid'],
      [{ fromAddress: 'not an address' }, 'fromAddress', 'server.mail.fromInvalid'],
      [{ username: 'two words' }, 'username', 'server.mail.usernameInvalid'],
    ];
    for (const [body, field, key] of cases) {
      const res = await put(body);
      expect({ status: res.status, field: (res.body as { field?: string }).field, key }).toEqual({ status: 400, field, key });
      expect((res.body as { message: string }).message).toBe(t('he', key, { min: '1', max: '65535' }));
    }

    const gmail = await put({ host: 'smtp.gmail.com', port: 587, security: 'starttls', username: 'diary.test@gmail.com', smtpPassword: 'abcd efgh ijkl mnop' });
    expect(gmail.status).toBe(200);
    const block = readRawServerSettings(config).mail as Record<string, unknown>;
    expect(decryptSmtpPassword(String(block.passwordEnc), loadOrCreateDeviceKey(config.deviceKeyFile))).toBe('abcdefghijklmnop');
    expect(block).toMatchObject({ host: 'smtp.gmail.com', port: 587, security: 'starttls', enabled: false });
  });

  it('forgot-password answers 503 (localised) while mail is not set up', async () => {
    const { http } = await boot();
    await register(http, 'dana', 'dana@example.com');
    const res = await http.post('/api/auth/forgot-password').set('Accept-Language', 'he').send({ email: 'dana@example.com' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ code: 'OTHER', message: t('he', 'server.mail.notConfigured') });
  });

  it('test overrides from the environment only ever point at this computer', () => {
    const dir = testConfig().dataDir;
    const caFile = `${dir}/ca.pem`;
    fs.writeFileSync(caFile, '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n');
    expect(mailOverridesFromEnv({})).toEqual({ options: {}, notes: [] });
    const local = mailOverridesFromEnv({ MPD_SMTP_CONNECT_HOST: '127.0.0.1', MPD_SMTP_CA_FILE: caFile });
    expect(local.options.smtp?.connectHost).toBe('127.0.0.1');
    expect(local.options.smtp?.ca).toContain('BEGIN CERTIFICATE');
    // A CA without a loopback target (e.g. to intercept smtp.gmail.com) is refused.
    for (const env of [{ MPD_SMTP_CA_FILE: caFile }, { MPD_SMTP_CONNECT_HOST: 'evil.example', MPD_SMTP_CA_FILE: caFile }, { MPD_SMTP_CONNECT_HOST: '10.0.0.5' }]) {
      const o = mailOverridesFromEnv(env);
      expect(o.options).toEqual({});
      expect(o.notes[0]).toMatch(/ignored/);
    }
  });

  it('deleting the owner account forgets the mail settings', async () => {
    const { smtp, http, config } = await boot();
    const danaToken = await register(http, 'dana', 'dana@example.com');
    const dana = as(http, danaToken);
    expect((await dana.put('/api/server/mail', { ...smtpSettings(smtp), password: PASSWORD })).status).toBe(200);
    const avi = as(http, await register(http, 'avi', 'avi@example.com'));
    expect((await avi.get('/api/server/mail')).status).toBe(403);

    expect((await dana.post('/api/auth/delete-account', { password: PASSWORD })).status).toBe(204);
    const block = readRawServerSettings(config).mail as Record<string, unknown>;
    expect(block).toMatchObject({ enabled: false, username: '', passwordEnc: '', ownerUserId: '' });
    // Now avi - the next-oldest account - owns them (nothing of dana's setup is left).
    const view = await avi.get('/api/server/mail');
    expect(view.status).toBe(200);
    expect(view.body as MailSettingsView).toMatchObject({ hasOwner: true, username: '', smtpPasswordSet: false, ready: false });
  });
});

describe('mail settings owner', () => {
  it('is the first account from the start: a second account that saves first gets 403 notOwner and claims nothing', async () => {
    const { srv, smtp, http, config } = await boot();
    const dana = as(http, await register(http, 'dana', 'dana@example.com'));
    const avi = as(http, await register(http, 'avi', 'avi@example.com'));

    const first = await avi.put('/api/server/mail', { ...smtpSettings(smtp), password: PASSWORD });
    expect(first.status).toBe(403);
    expect(first.body).toEqual({ code: 'FORBIDDEN', message: t('he', 'server.mail.notOwner') });
    expect(readRawServerSettings(config).mail).toBeUndefined();
    // The owner is checked again at the moment of writing.
    expect(() => srv.mail.update(smtpSettings(smtp), idOf(config, 'avi'))).toThrow(expect.objectContaining({ status: 403, key: 'server.mail.notOwner' }));
    expect(readRawServerSettings(config).mail).toBeUndefined();
    // The server settings say who owns them (the Settings page shows the card to the owner only).
    expect((await dana.get('/api/server/settings')).body).toMatchObject({ isMailOwner: true, isRemoteOwner: true });
    expect((await avi.get('/api/server/settings')).body).toMatchObject({ isMailOwner: false, isRemoteOwner: false });

    // The first account can set them up before anyone else.
    expect((await dana.get('/api/server/mail')).status).toBe(200);
    expect((await dana.put('/api/server/mail', { ...smtpSettings(smtp), password: PASSWORD })).status).toBe(200);
    expect((readRawServerSettings(config).mail as Record<string, unknown>).ownerUserId).toBe(idOf(config, 'dana'));
    expect((await avi.get('/api/server/mail')).status).toBe(403);
  });

  it('stored before the owner became the first account: another stored owner is kept (never transferred silently), with a notice at startup', async () => {
    const first = await boot();
    const config = first.config;
    await register(first.http, 'dana', 'dana@example.com');
    await register(first.http, 'avi', 'avi@example.com');
    const aviId = idOf(config, 'avi');
    await first.srv.stop();
    // An older version let avi - the second account - set sending e-mail up.
    writeMailConfig(config, loadOrCreateDeviceKey(config.deviceKeyFile), { ...MAIL_DEFAULTS, host: HOST, username: SENDER, password: SMTP_SECRET, ownerUserId: aviId });

    const logs: string[] = [];
    const { srv, http } = await boot(config, (line) => logs.push(line));
    expect(logs.filter((l) => /kept its existing owner/.test(l))).toHaveLength(1);
    expect(logs.join('\n')).not.toContain(SMTP_SECRET);
    expect(srv.mail.ownerId()).toBe(aviId);
    const dana = as(http, await login(http, 'dana'));
    const avi = as(http, await login(http, 'avi'));
    expect((await avi.get('/api/server/mail')).body).toMatchObject({ username: SENDER, smtpPasswordSet: true, hasOwner: true });
    for (const res of [await dana.get('/api/server/mail'), await dana.put('/api/server/mail', { enabled: false, password: PASSWORD }), await dana.post('/api/server/mail/test')]) {
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ code: 'FORBIDDEN', message: t('he', 'server.mail.notOwner') });
    }
    expect((await dana.get('/api/server/settings')).body).toMatchObject({ isMailOwner: false });
    expect((await avi.get('/api/server/settings')).body).toMatchObject({ isMailOwner: true });
    expect((readRawServerSettings(config).mail as Record<string, unknown>).ownerUserId).toBe(aviId);
  });

  it('deleted with its settings still stored: nobody else gets them until they are cleared, then the next-oldest account owns them', async () => {
    const { srv, smtp, http, config } = await boot();
    const dana = as(http, await register(http, 'dana', 'dana@example.com'));
    const avi = as(http, await register(http, 'avi', 'avi@example.com'));
    const danaId = idOf(config, 'dana');
    const aviId = idOf(config, 'avi');
    expect((await dana.put('/api/server/mail', { ...smtpSettings(smtp), password: PASSWORD })).status).toBe(200);

    // The release right after the deletion fails (e.g. the settings file is locked for a moment).
    const service = srv.mail as unknown as { releaseOwner: (userId: string) => boolean };
    const release = service.releaseOwner.bind(srv.mail);
    let failNext = true;
    service.releaseOwner = (userId) => {
      if (failNext) {
        failNext = false;
        throw new Error('simulated failure');
      }
      return release(userId);
    };
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await dana.post('/api/auth/delete-account', { password: PASSWORD })).status).toBe(204);
      expect(errors).toHaveBeenCalledWith(expect.stringContaining('could not be released'));
    } finally {
      errors.mockRestore();
    }

    // Still dana's settings: avi can neither save over them nor see them yet.
    expect(srv.mail.ownerId()).toBe(danaId);
    expect(() => srv.mail.update({ username: 'avi.sender@mail.test' }, aviId)).toThrow(expect.objectContaining({ status: 403 }));
    expect(readRawServerSettings(config).mail).toMatchObject({ ownerUserId: danaId, username: SENDER });
    // Avi's first mail request clears them, and from then on avi owns them.
    expect((await avi.get('/api/server/settings')).body).toMatchObject({ isMailOwner: true });
    const view = await avi.get('/api/server/mail');
    expect(view.status).toBe(200);
    expect(view.body as MailSettingsView).toMatchObject({ hasOwner: true, username: '', smtpPasswordSet: false, enabled: false });
    expect(readRawServerSettings(config).mail).toMatchObject({ ownerUserId: '', username: '', passwordEnc: '' });
    expect((await avi.put('/api/server/mail', { ...smtpSettings(smtp), password: PASSWORD })).status).toBe(200);
    expect((readRawServerSettings(config).mail as Record<string, unknown>).ownerUserId).toBe(aviId);
  });

  it('stored without an owner while there was no account at startup: they become the first account\'s when it registers, so deleting it clears them before the next-oldest account gets in', async () => {
    const config = testConfig();
    writeMailConfig(config, loadOrCreateDeviceKey(config.deviceKeyFile), { ...MAIL_DEFAULTS, host: HOST, username: SENDER, password: SMTP_SECRET, ownerUserId: '' });
    const logs: string[] = [];
    const { srv, http } = await boot(config, (line) => logs.push(line));
    expect((readRawServerSettings(config).mail as Record<string, unknown>).ownerUserId).toBe('');

    const dana = as(http, await register(http, 'dana', 'dana@example.com'));
    const danaId = idOf(config, 'dana');
    // Written down as the first account's right after it was registered (one log line).
    expect(readRawServerSettings(config).mail).toMatchObject({ ownerUserId: danaId, username: SENDER });
    expect(srv.mail.ownerId()).toBe(danaId);
    const avi = as(http, await register(http, 'avi', 'avi@example.com'));
    expect((readRawServerSettings(config).mail as Record<string, unknown>).ownerUserId).toBe(danaId);
    expect(logs.filter((l) => /without an owner now belong to the first account/.test(l))).toHaveLength(1);
    expect((await avi.get('/api/server/mail')).status).toBe(403);
    expect((await dana.get('/api/server/mail')).body).toMatchObject({ username: SENDER, smtpPasswordSet: true });

    expect((await dana.post('/api/auth/delete-account', { password: PASSWORD })).status).toBe(204);
    // Cleared - avi owns sending e-mail now, but gets nothing of the old setup (no SMTP credentials).
    expect(readRawServerSettings(config).mail).toMatchObject({ enabled: false, username: '', passwordEnc: '', ownerUserId: '' });
    const view = await avi.get('/api/server/mail');
    expect(view.status).toBe(200);
    expect(view.body as MailSettingsView).toMatchObject({ hasOwner: true, username: '', smtpPasswordSet: false, ready: false });
    expect(logs.join('\n')).not.toContain(SMTP_SECRET);
  });

  it('without a stored owner: the delete route writes the owner down before deleting, also when that failed after the registrations', async () => {
    const config = testConfig();
    writeMailConfig(config, loadOrCreateDeviceKey(config.deviceKeyFile), { ...MAIL_DEFAULTS, host: HOST, username: SENDER, password: SMTP_SECRET, ownerUserId: '' });
    const { srv, http } = await boot(config);
    const service = srv.mail as unknown as { pinOwner: () => boolean };
    const pin = service.pinOwner.bind(srv.mail);
    let failures = 2;
    service.pinOwner = () => {
      if (failures > 0) {
        failures--;
        throw new Error('simulated failure');
      }
      return pin();
    };
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const dana = as(http, await register(http, 'dana', 'dana@example.com'));
      const avi = as(http, await register(http, 'avi', 'avi@example.com'));
      expect(errors).toHaveBeenCalledWith(expect.stringContaining('could not be given to the first account'));
      expect((readRawServerSettings(config).mail as Record<string, unknown>).ownerUserId).toBe('');
      expect((await dana.post('/api/auth/delete-account', { password: PASSWORD })).status).toBe(204);
      expect(readRawServerSettings(config).mail).toMatchObject({ username: '', passwordEnc: '', ownerUserId: '' });
      expect((await avi.get('/api/server/mail')).body).toMatchObject({ username: '', smtpPasswordSet: false });
    } finally {
      errors.mockRestore();
    }
  });

  it('a stored owner that is not an account id is released at startup like a deleted owner - never given to the first account', async () => {
    const first = await boot();
    const config = first.config;
    await register(first.http, 'dana', 'dana@example.com');
    await register(first.http, 'avi', 'avi@example.com');
    await first.srv.stop();
    const key = loadOrCreateDeviceKey(config.deviceKeyFile);
    writeMailConfig(config, key, { ...MAIL_DEFAULTS, host: HOST, username: SENDER, password: SMTP_SECRET, ownerUserId: 'u_deleted.account' });
    expect(readMailConfig(config, key).ownerUserId).toBe(UNREADABLE_OWNER);

    const logs: string[] = [];
    const { http } = await boot(config, (line) => logs.push(line));
    expect(readRawServerSettings(config).mail).toMatchObject({ enabled: false, username: '', passwordEnc: '', ownerUserId: '' });
    expect(logs.filter((l) => /not a valid account id/.test(l))).toHaveLength(1);
    expect(logs.join('\n')).not.toContain(SMTP_SECRET);
    const dana = as(http, await login(http, 'dana'));
    expect((await dana.get('/api/server/mail')).body).toMatchObject({ hasOwner: true, username: '', smtpPasswordSet: false, ready: false });
  });

  it('reads a present but malformed stored owner as unreadable, and a missing one as none', () => {
    const config = testConfig();
    const key = loadOrCreateDeviceKey(config.deviceKeyFile);
    for (const bad of ['../../accounts.json', 'u_deleted.account', 42, false]) {
      writeRawServerSettings(config, { mail: { host: HOST, username: SENDER, ownerUserId: bad } });
      expect(readMailConfig(config, key).ownerUserId).toBe(UNREADABLE_OWNER);
    }
    for (const none of [undefined, null, '']) {
      writeRawServerSettings(config, { mail: { host: HOST, username: SENDER, ownerUserId: none } });
      expect(readMailConfig(config, key).ownerUserId).toBe('');
    }
    writeRawServerSettings(config, { mail: { host: HOST, username: SENDER, ownerUserId: 'u_0123456789abcdef' } });
    expect(readMailConfig(config, key).ownerUserId).toBe('u_0123456789abcdef');
  });
});
