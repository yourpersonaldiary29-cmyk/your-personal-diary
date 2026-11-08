/**
 * Verification round of "Forgot password?" (after reset-flow / reset-review):
 *   - the mail settings cannot be saved by a second account that passed the route's owner gate
 *     while nobody owned them yet (the owner is checked again when the settings are written);
 *   - the account-dependent e-mail work of a forgot-password request starts only after a pause
 *     (random 200-1200 ms by default), so the short stall it causes cannot be lined up with the
 *     request by an observer trying to tell registered addresses from unknown ones;
 *   - after that pause the account is read again: an address changed or an account deleted during
 *     it receives nothing;
 *   - a reset taken for an account that is deleted meanwhile does not come back into resets.json.
 * Everything runs on 127.0.0.1 with the in-process mock SMTP server; no real mail is sent.
 */
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import type { AuthResponse, ServerSettings } from '@shared/types';
import { createApp, type AppDeps } from '../src/app';
import { nodeSmtpTransport } from '../src/mail/node-transport';
import { MailService } from '../src/mail/service';
import { createAuthService, type DiaryAuthService } from '../src/security/auth-service';
import { loadOrCreateDeviceKey } from '../src/security/device-key';
import { PasswordResetService, randomBackgroundDelay, type PasswordResetOptions } from '../src/security/password-reset';
import { cleanupTempDirs, testConfig } from './helpers';
import { resetDetailsOf, startMockSmtp, type MockSmtp } from './mail-fixtures';

const HOST = 'smtp.mail.test';
const SENDER = 'diary.sender@mail.test';
// Made-up test values for the mock server - never real credentials.
const SMTP_SECRET = 'mock-verify-secret-0005';
const PASSWORD = 'Passw0rd!';
const FAST = { N: 1024, r: 8, p: 1 };

const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c().catch(() => undefined);
});
afterAll(cleanupTempDirs);

type Agent = ReturnType<typeof supertest>;

interface Harness {
  auth: DiaryAuthService;
  mail: MailService;
  reset: PasswordResetService;
  smtp: MockSmtp;
  local: Agent;
  dataDir: string;
}

async function harness(resetOpts: PasswordResetOptions = { backgroundDelayMs: () => 0 }): Promise<Harness> {
  const config = testConfig();
  const smtp = await startMockSmtp({ mode: 'tls', hostname: HOST, users: { [SENDER]: SMTP_SECRET } });
  cleanups.push(() => smtp.close());
  const auth = await createAuthService(config, { kdf: FAST });
  cleanups.push(() => auth.shutdown());
  const deviceKey = loadOrCreateDeviceKey(config.deviceKeyFile);
  const mail = new MailService({ config, deviceKey, transport: nodeSmtpTransport, options: { smtp: { ca: smtp.ca.certPem, connectHost: '127.0.0.1', timeoutMs: 20_000 } } });
  const reset = new PasswordResetService(auth, mail, { perIpPerHour: 1000, log: () => {}, ...resetOpts });
  cleanups.push(() => reset.idle());
  const settings: ServerSettings = { port: 0, lanEnabled: false };
  const deps: AppDeps & { mail: MailService; passwordReset: PasswordResetService } = {
    config,
    auth,
    getServerSettings: () => settings,
    setServerSettings: async (next) => Object.assign(settings, next),
    getListenInfo: () => ({ port: 47998, lanUrls: [], startedAt: new Date().toISOString() }),
    mail,
    passwordReset: reset,
  };
  const server = http.createServer(createApp(deps));
  const port = await new Promise<number>((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)));
  cleanups.push(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  );
  return { auth, mail, reset, smtp, local: supertest(`http://127.0.0.1:${port}`), dataDir: config.dataDir };
}

async function register(h: Harness, username: string): Promise<string> {
  const res = await h.local
    .post('/api/auth/register')
    .send({ firstName: username, lastName: 'Test', username, email: `${username}@example.com`, password: PASSWORD, confirmPassword: PASSWORD });
  expect(res.status).toBe(201);
  return (res.body as AuthResponse).token;
}

function mailPut(h: Harness, token: string, username: string) {
  return h.local
    .put('/api/server/mail')
    .set('Authorization', `Bearer ${token}`)
    .set('Accept-Language', 'en')
    .send({ host: HOST, port: h.smtp.port, security: 'tls', username, smtpPassword: SMTP_SECRET, enabled: true, password: PASSWORD });
}

describe('mail settings - the first save has exactly one winner', () => {
  it('a second account that passed the gate while nobody owned the settings is refused when it writes', async () => {
    const h = await harness();
    await register(h, 'dana');
    await register(h, 'avi');
    const dana = h.auth.accounts.findByUsername('dana')!.id;
    const avi = h.auth.accounts.findByUsername('avi')!.id;
    h.mail.update({ host: HOST, port: h.smtp.port, username: SENDER, smtpPassword: SMTP_SECRET, enabled: true }, dana);
    expect(h.mail.ownerId()).toBe(dana);
    // Avi's request was already past the route's gate (no owner then): the write itself refuses it.
    expect(() => h.mail.update({ host: 'smtp.evil.test', username: 'eve@evil.test', smtpPassword: 'x', enabled: true }, avi)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
    expect(() => h.mail.update({ enabled: false }, '')).toThrow(expect.objectContaining({ status: 403 }));
    expect(h.mail.view()).toMatchObject({ host: HOST, username: SENDER, enabled: true, hasOwner: true });
  });

  it('two accounts saving at the same moment: one owner, and the settings are the owner\'s', async () => {
    const h = await harness();
    const danaToken = await register(h, 'dana');
    const aviToken = await register(h, 'avi');
    const [a, b] = await Promise.all([mailPut(h, danaToken, 'dana.sender@mail.test'), mailPut(h, aviToken, 'avi.sender@mail.test')]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 403]);
    const loser = a.status === 403 ? a : b;
    expect(loser.body).toEqual({ code: 'FORBIDDEN', message: t('en', 'server.mail.notOwner') });
    const ownerName = a.status === 200 ? 'dana' : 'avi';
    expect(h.mail.ownerId()).toBe(h.auth.accounts.findByUsername(ownerName)!.id);
    expect(h.mail.view().username).toBe(`${ownerName}.sender@mail.test`);
  });
});

describe('forgot-password - the e-mail work waits a random moment', () => {
  it('nothing account-dependent happens until the pause is over; the default pause is 200-1200 ms', async () => {
    const h = await harness({ backgroundDelayMs: () => 150 });
    const token = await register(h, 'dana');
    h.mail.update({ host: HOST, port: h.smtp.port, username: SENDER, smtpPassword: SMTP_SECRET, enabled: true }, h.auth.accounts.findByUsername('dana')!.id);
    const id = h.auth.accounts.findByUsername('dana')!.id;
    expect(token).toBeTruthy();
    const started = Date.now();
    const res = await h.local.post('/api/auth/forgot-password').send({ email: 'dana@example.com' });
    expect(res.status).toBe(200);
    // Answered at once; the reset does not exist yet, not even after a few turns of the event loop.
    expect(h.auth.resets.liveCount(id)).toBe(0);
    await new Promise((r) => setTimeout(r, 40));
    expect(h.auth.resets.liveCount(id)).toBe(0);
    await h.reset.idle();
    expect(Date.now() - started).toBeGreaterThanOrEqual(140);
    expect(h.auth.resets.liveCount(id)).toBe(1);
    expect(h.smtp.messages.length).toBe(1);
    expect(resetDetailsOf(h.smtp.messages[0]).code).toMatch(/^\d{6}$/);

    // An address changed during the pause gets nothing (the change voided the old address's resets).
    const again = await h.local.post('/api/auth/forgot-password').send({ email: 'dana@example.com' });
    expect(again.status).toBe(200);
    const moved = await h.local
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'dana.new@example.com', currentPassword: PASSWORD });
    expect(moved.status).toBe(200);
    await h.reset.idle();
    // Only the "your e-mail address was changed" notice to the previous address - no reset link.
    expect(h.smtp.messages.length).toBe(2);
    expect(h.smtp.messages[1].to).toEqual(['dana@example.com']);
    expect(h.smtp.messages[1].data).not.toContain('reset-password?token=');
    expect(h.auth.resets.liveCount(id)).toBe(0);
    // An account deleted during the pause gets nothing either.
    const gone = await h.local.post('/api/auth/forgot-password').send({ email: 'dana.new@example.com' });
    expect(gone.status).toBe(200);
    const ctx = await h.auth.authenticate(token);
    await h.auth.deleteAccount(ctx!, PASSWORD);
    await h.reset.idle();
    expect(h.smtp.messages.length).toBe(2);
    expect(fs.readFileSync(`${h.dataDir}/resets.json`, 'utf8')).not.toContain(id);

    const samples = Array.from({ length: 200 }, () => randomBackgroundDelay());
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(200);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1200);
    expect(new Set(samples).size).toBeGreaterThan(20);
  });
});

describe('account deletion racing a reset', () => {
  it('a reset taken just before its account was deleted is not put back into resets.json', async () => {
    const h = await harness();
    const ownerToken = await register(h, 'owner');
    expect((await mailPut(h, ownerToken, SENDER)).status).toBe(200);
    const token = await register(h, 'dana');
    const id = h.auth.accounts.findByUsername('dana')!.id;
    expect((await h.local.post('/api/auth/forgot-password').send({ email: 'dana@example.com' })).status).toBe(200);
    await h.reset.idle();
    const link = resetDetailsOf(h.smtp.messages.at(-1)!);
    const ctx = await h.auth.authenticate(token);
    expect(ctx).not.toBeNull();
    // The deletion takes the account's lock first; the reset takes the link and then waits for it.
    const deleting = h.auth.deleteAccount(ctx!, PASSWORD);
    const resetting = h.reset.resetWithToken(link.token, 'Zombie1pass', 'en');
    await deleting;
    await expect(resetting).rejects.toMatchObject({ status: 400 });
    expect(h.auth.accounts.findById(id)).toBeNull();
    expect(h.auth.resets.liveCount(id)).toBe(0);
    expect(fs.readFileSync(`${h.dataDir}/resets.json`, 'utf8')).not.toContain(id);
  });
});
