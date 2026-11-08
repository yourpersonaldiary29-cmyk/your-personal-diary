/**
 * The SMTP conversation is injected (mail/transport.ts): the desktop server uses the node:net /
 * node:tls client (mail/node-transport.ts, the default of `startServer`), the Android core will
 * pass a native plugin. Here a fake transport stands in for it - no socket is ever opened:
 *   - `startServer({ mailTransport })` hands every e-mail (test mail, password reset) to it;
 *   - what it gets is exactly what the node client gets: the owner's SMTP settings, the envelope,
 *     the finished MIME message;
 *   - its `SmtpError`s reach the user as the localised 502 of the node client;
 *   - an address that could add SMTP commands never reaches a transport.
 */
import net from 'node:net';
import tls from 'node:tls';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@shared/i18n';
import type { AuthResponse, MailTestResult } from '@shared/types';
import { isSmtpError, MAIL_NOT_CONFIGURED_KEY, mailApiError, mailFailureTag, SmtpError } from '../src/mail/errors';
import { nodeSmtpTransport, sendMail } from '../src/mail/node-transport';
import { MailService } from '../src/mail/service';
import { assertSafeAddress, isGmailHost, SMTP_TIMEOUT_MS, type Envelope, type SmtpOptions, type SmtpTransport } from '../src/mail/transport';
import { loadOrCreateDeviceKey } from '../src/security/device-key';
import { startServer, type RunningServer } from '../src/server';
import { cleanupTempDirs, testConfig } from './helpers';

const FAST = { N: 1024, r: 8, p: 1 };
const PASSWORD = 'Passw0rd!';
// Made-up values for the fake transport - never a real mailbox or password.
const SMTP_HOST = 'smtp.mail.test';
const SENDER = 'diary@mail.test';
const SMTP_SECRET = 'mock-app-secret-0002';

const running: RunningServer[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
  vi.restoreAllMocks();
});
afterAll(cleanupTempDirs);

interface Sent {
  opts: SmtpOptions;
  envelope: Envelope;
  data: string;
}

function fakeTransport(fail?: () => Error) {
  const sent: Sent[] = [];
  const transport: SmtpTransport = {
    send: async (opts, envelope, data) => {
      if (fail) throw fail();
      sent.push({ opts: { ...opts }, envelope: { ...envelope }, data });
    },
  };
  return { sent, transport };
}

async function boot(transport: SmtpTransport) {
  const config = testConfig();
  const srv = await startServer(config, { port: 0, quiet: true, auth: { kdf: FAST }, mailTransport: transport, passwordReset: { backgroundDelayMs: () => 0 } });
  running.push(srv);
  const http = supertest(`http://127.0.0.1:${srv.port}`);
  const reg = await http
    .post('/api/auth/register')
    .set('Accept-Language', 'en')
    .send({ firstName: 'Dana', lastName: 'Cohen', username: 'dana', email: 'dana@example.com', password: PASSWORD, confirmPassword: PASSWORD });
  expect(reg.status).toBe(201);
  const token = (reg.body as AuthResponse).token;
  const authed = {
    put: (url: string, body: object) => http.put(url).set('Authorization', `Bearer ${token}`).set('Accept-Language', 'en').send(body),
    post: (url: string, body: object = {}) => http.post(url).set('Authorization', `Bearer ${token}`).set('Accept-Language', 'en').send(body),
  };
  const saved = await authed.put('/api/server/mail', {
    host: SMTP_HOST,
    port: 465,
    security: 'tls',
    username: SENDER,
    smtpPassword: SMTP_SECRET,
    enabled: true,
    password: PASSWORD,
  });
  expect(saved.status).toBe(200);
  return { srv, http, authed, config };
}

/** Fails the test when anything tries to open a socket. */
function forbidSockets() {
  const connect = vi.spyOn(net, 'connect').mockImplementation(() => {
    throw new Error('a socket was opened although the transport is injected');
  });
  const secure = vi.spyOn(tls, 'connect').mockImplementation(() => {
    throw new Error('a TLS socket was opened although the transport is injected');
  });
  return { connect, secure };
}

describe('startServer with an injected mail transport', () => {
  it('sends the test e-mail through it - same settings, envelope and message as the node client would get', async () => {
    const { sent, transport } = fakeTransport();
    const sockets = forbidSockets();
    const { authed } = await boot(transport);
    const res = await authed.post('/api/server/mail/test');
    expect(res.status).toBe(200);
    expect(res.body as MailTestResult).toMatchObject({ ok: true, sentTo: 'dana@example.com' });
    expect(sent).toHaveLength(1);
    expect(sent[0].opts).toEqual({ host: SMTP_HOST, port: 465, security: 'tls', username: SENDER, password: SMTP_SECRET });
    expect(sent[0].envelope).toEqual({ from: SENDER, to: 'dana@example.com' });
    expect(sent[0].data).toContain(`From: "Your Personal Diary" <${SENDER}>`);
    expect(sent[0].data).toContain('To: <dana@example.com>');
    expect(sent[0].data).toContain('MIME-Version: 1.0');
    expect(sent[0].data.endsWith('\r\n')).toBe(true);
    expect(sockets.connect).not.toHaveBeenCalled();
    expect(sockets.secure).not.toHaveBeenCalled();
  });

  it('sends the password-reset e-mail through it as well', async () => {
    const { sent, transport } = fakeTransport();
    forbidSockets();
    const { srv, http } = await boot(transport);
    const res = await http.post('/api/auth/forgot-password').set('Accept-Language', 'en').send({ email: 'dana@example.com' });
    expect(res.status).toBe(200);
    await srv.passwordReset.idle();
    expect(sent).toHaveLength(1);
    expect(sent[0].envelope).toEqual({ from: SENDER, to: 'dana@example.com' });
    expect(sent[0].opts.host).toBe(SMTP_HOST);
  });

  it('reports the transport failure as the localised 502 of the node client', async () => {
    const { transport } = fakeTransport(() => new SmtpError('server.mail.error.auth', { host: SMTP_HOST, port: 465, code: 535 }, 535));
    const { authed, http } = await boot(transport);
    const res = await authed.post('/api/server/mail/test');
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ code: 'OTHER', message: t('en', 'server.mail.error.auth', { host: SMTP_HOST, port: 465, code: 535 }) });
    expect(JSON.stringify(res.body)).not.toContain(SMTP_SECRET);
    // The session is fine, and a failure that is not an SmtpError is answered without its text.
    expect((await http.get('/api/health')).status).toBe(200);
  });

  it('a transport that throws something else is answered as "connection closed" - never with its text', async () => {
    const { transport } = fakeTransport(() => new Error(`plugin crashed: ${SMTP_SECRET}`));
    const { authed } = await boot(transport);
    const res = await authed.post('/api/server/mail/test');
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('OTHER');
    expect(res.body.message).toBe(t('en', 'server.mail.error.closed', { host: '', port: '' }));
    expect(JSON.stringify(res.body)).not.toContain(SMTP_SECRET);
  });
});

describe('MailService with an injected transport', () => {
  function service(transport: SmtpTransport) {
    const config = testConfig();
    const deviceKey = loadOrCreateDeviceKey(config.deviceKeyFile);
    const mail = new MailService({ config, deviceKey, transport, options: { log: () => {} } });
    mail.update({ host: SMTP_HOST, port: 587, security: 'starttls', username: SENDER, smtpPassword: SMTP_SECRET, enabled: true }, 'u_0123456789abcdef');
    return mail;
  }
  const content = { to: 'reader@example.com', subject: 'Hello', text: 'Hi', html: '<p>Hi</p>' };

  it('passes the saved settings (plus the test overrides) to the transport', async () => {
    const { sent, transport } = fakeTransport();
    const config = testConfig();
    const mail = new MailService({
      config,
      deviceKey: loadOrCreateDeviceKey(config.deviceKeyFile),
      transport,
      options: { log: () => {}, smtp: { connectHost: '127.0.0.1', timeoutMs: 1234 } },
    });
    mail.update({ host: SMTP_HOST, port: 587, security: 'starttls', username: SENDER, smtpPassword: SMTP_SECRET, enabled: true }, 'u_0123456789abcdef');
    await mail.send(content);
    expect(sent).toHaveLength(1);
    expect(sent[0].opts).toEqual({ host: SMTP_HOST, port: 587, security: 'starttls', username: SENDER, password: SMTP_SECRET, connectHost: '127.0.0.1', timeoutMs: 1234 });
    expect(sent[0].envelope).toEqual({ from: SENDER, to: 'reader@example.com' });
  });

  it('never calls the transport while mail is off or incomplete', async () => {
    const { sent, transport } = fakeTransport();
    const config = testConfig();
    const mail = new MailService({ config, deviceKey: loadOrCreateDeviceKey(config.deviceKeyFile), transport, options: { log: () => {} } });
    await expect(mail.send(content)).rejects.toMatchObject({ key: MAIL_NOT_CONFIGURED_KEY });
    expect(sent).toEqual([]);
  });

  it('refuses an address that could add SMTP commands before any transport sees it', async () => {
    const { sent, transport } = fakeTransport();
    const mail = service(transport);
    for (const to of ['a@b.test>\r\nRCPT TO:<evil@x.test', 'a@b.test\nDATA', 'a b@c.test', '<a@b.test>', '']) {
      const error = await mail.send({ ...content, to }).then(
        () => null,
        (e: unknown) => e,
      );
      expect({ to, isSmtp: isSmtpError(error), key: (error as SmtpError | null)?.key }).toEqual({ to, isSmtp: true, key: 'server.mail.error.address' });
    }
    expect(sent).toEqual([]);
    await mail.send(content);
    expect(sent).toHaveLength(1);
  });
});

describe('the pure mail modules', () => {
  it('mail/errors.ts: keys, the 502 mapping and the log tag', () => {
    expect(MAIL_NOT_CONFIGURED_KEY).toBe('server.mail.notConfigured');
    const e = new SmtpError('server.mail.error.recipient', { host: 'h', port: 1, code: 550 }, 550);
    expect(isSmtpError(e)).toBe(true);
    expect(isSmtpError(new Error('x'))).toBe(false);
    expect(mailApiError(e)).toMatchObject({ status: 502, code: 'OTHER', key: 'server.mail.error.recipient' });
    expect(mailApiError(new Error('boom'))).toMatchObject({ status: 502, key: 'server.mail.error.closed' });
    expect(mailFailureTag(e)).toBe('server.mail.error.recipient (SMTP 550)');
    expect(mailFailureTag(new Error('boom'))).toBe('boom');
  });

  it('mail/transport.ts: address check, Gmail hosts, timeout', () => {
    expect(() => assertSafeAddress('a@b.test')).not.toThrow();
    for (const bad of ['', 'a@b.test\r\n', 'a@b.test>', '<a@b.test', 'a @b.test', 'a@b.test\0']) {
      expect(() => assertSafeAddress(bad)).toThrow(expect.objectContaining({ key: 'server.mail.error.address' }));
    }
    expect(isGmailHost('SMTP.Gmail.com')).toBe(true);
    expect(isGmailHost('smtp.example.com')).toBe(false);
    expect(SMTP_TIMEOUT_MS).toBe(20_000);
  });

  it('the node transport is the moved client: `send` is `sendMail`', async () => {
    expect(nodeSmtpTransport.send).toBe(sendMail);
    // Same first checks as before the move: the addresses, then the credentials - before any socket.
    const sockets = forbidSockets();
    const opts: SmtpOptions = { host: SMTP_HOST, port: 465, security: 'tls', username: '', password: '' };
    await expect(nodeSmtpTransport.send(opts, { from: SENDER, to: 'x@y.test>\r\nRSET' }, 'x')).rejects.toMatchObject({ key: 'server.mail.error.address' });
    await expect(nodeSmtpTransport.send(opts, { from: SENDER, to: 'x@y.test' }, 'x')).rejects.toMatchObject({ key: 'server.mail.error.auth' });
    expect(sockets.connect).not.toHaveBeenCalled();
    expect(sockets.secure).not.toHaveBeenCalled();
  });
});
