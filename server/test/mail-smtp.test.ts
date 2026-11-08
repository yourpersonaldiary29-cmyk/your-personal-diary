/**
 * The dependency-free SMTP client (server/src/mail/node-transport.ts) and MIME builder (mime.ts) against an
 * in-process mock SMTP server on 127.0.0.1 (mail-fixtures.ts) - implicit TLS and STARTTLS with a
 * test-CA certificate, AUTH PLAIN / LOGIN, dot-stuffing, UTF-8 MIME - and the failures it must
 * report in the user's language: wrong App Password (with the Gmail hint), untrusted certificate,
 * no STARTTLS (credentials never sent in clear), timeout, refused connection, rejected recipient,
 * STARTTLS response injection. No real mail is ever sent.
 */
import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import { mailApiError, SmtpError } from '../src/mail/errors';
import {
  base64Body,
  buildMessage,
  dotStuff,
  encodeHeaderWords,
  isMailAddress,
  MAIL_FROM_NAME,
  rfc5322Date,
} from '../src/mail/mime';
import { sendMail } from '../src/mail/node-transport';
import { isGmailHost, type SmtpOptions } from '../src/mail/transport';
import { decodeWords, headersOf, partsOf, startMockSmtp, type MockSmtp } from './mail-fixtures';
import { makeTestCa } from './remote-fixtures';

const HOST = 'smtp.mail.test';
const USER = 'sender@mail.test';
// A made-up test value for the mock server - never a real password.
const SECRET = 'mock-app-secret-0001';

const servers: MockSmtp[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) await s.close();
});

async function mock(opts: Partial<Parameters<typeof startMockSmtp>[0]> = {}): Promise<MockSmtp> {
  const s = await startMockSmtp({ mode: 'tls', hostname: HOST, users: { [USER]: SECRET }, ...opts });
  servers.push(s);
  return s;
}

function optionsFor(s: MockSmtp, extra: Partial<SmtpOptions> = {}): SmtpOptions {
  return {
    host: HOST,
    port: s.port,
    security: 'tls',
    username: USER,
    password: SECRET,
    ca: s.ca.certPem,
    connectHost: '127.0.0.1',
    timeoutMs: 5000,
    ...extra,
  };
}

async function failure(p: Promise<unknown>): Promise<SmtpError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(SmtpError);
    return e as SmtpError;
  }
  throw new Error('expected a failure');
}

const content = {
  to: 'dana@example.com',
  subject: 'איפוס סיסמה - Your Personal Diary',
  text: 'שלום דנה,\n\n.a line that starts with a dot\nhttp://127.0.0.1:47321/#/reset-password?token=abc\n',
  html: '<!doctype html><html lang="he" dir="rtl"><body><p>שלום דנה</p></body></html>',
};

describe('SMTP delivery', () => {
  it('delivers over implicit TLS (port 465 style) with AUTH PLAIN and a UTF-8 multipart message', async () => {
    const s = await mock();
    const built = buildMessage(USER, content, new Date('2026-09-29T10:00:00Z'));
    await sendMail(optionsFor(s), { from: USER, to: content.to }, built.data);
    expect(s.messages).toHaveLength(1);
    const mail = s.messages[0];
    expect(mail).toMatchObject({ from: USER, to: ['dana@example.com'], authUser: USER, secure: true });
    const h = headersOf(mail.data);
    expect(h.from).toBe(`"${MAIL_FROM_NAME}" <${USER}>`);
    expect(h.to).toBe('<dana@example.com>');
    expect(h.subject).toMatch(/^=\?UTF-8\?B\?/);
    expect(decodeWords(h.subject)).toBe(content.subject);
    expect(h.date).toBe('Tue, 29 Sep 2026 10:00:00 +0000');
    expect(h['message-id']).toMatch(/^<[0-9a-f]{32}@mail\.test>$/);
    expect(h['mime-version']).toBe('1.0');
    expect(h['content-type']).toMatch(/^multipart\/alternative; boundary="mpd_[0-9a-f]+"$/);
    const parts = partsOf(mail.data);
    expect(parts.text).toBe(content.text.replace(/\n/g, '\r\n'));
    expect(parts.html).toContain('<p>שלום דנה</p>');
    // Every command went over TLS; the AUTH exchange used PLAIN.
    expect(s.commands.some((c) => c.startsWith('AUTH PLAIN '))).toBe(true);
    expect(s.commands.at(-1)).toBe('QUIT');
  });

  it('delivers with STARTTLS (port 587 style) and AUTH LOGIN when that is all the server offers', async () => {
    const s = await mock({ mode: 'starttls', authMechanisms: ['LOGIN'] });
    await sendMail(optionsFor(s, { security: 'starttls' }), { from: USER, to: content.to }, buildMessage(USER, content).data);
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].secure).toBe(true);
    const idx = s.commands.indexOf('STARTTLS');
    expect(idx).toBeGreaterThan(0);
    // No credentials before the TLS upgrade.
    expect(s.commands.slice(0, idx).some((c) => c.startsWith('AUTH'))).toBe(false);
    expect(s.commands.slice(idx)).toContain('AUTH LOGIN');
  });

  it('dot-stuffs the DATA section so a line starting with "." arrives intact', async () => {
    const s = await mock();
    const data = 'Subject: raw\r\n\r\n.hidden line\r\n..two dots\r\nlast\r\n';
    await sendMail(optionsFor(s), { from: USER, to: content.to }, data);
    expect(s.messages[0].data).toBe('Subject: raw\r\n\r\n.hidden line\r\n..two dots\r\nlast');
    expect(dotStuff('.a\r\nb\r\n.c')).toBe('..a\r\nb\r\n..c');
  });
});

describe('SMTP failures (localised, never revealing the password)', () => {
  it('a wrong App Password on Gmail explains 2-Step Verification + App Passwords (en/he)', async () => {
    const s = await startMockSmtp({ mode: 'tls', hostname: 'smtp.gmail.com', users: { [USER]: SECRET } });
    servers.push(s);
    const e = await failure(
      sendMail(optionsFor(s, { host: 'smtp.gmail.com', password: 'wrong-password-123' }), { from: USER, to: content.to }, 'Subject: x\r\n\r\nx\r\n'),
    );
    expect(e.key).toBe('server.mail.error.authGmail');
    expect(e.smtpCode).toBe(535);
    const api = mailApiError(e);
    expect(api.status).toBe(502);
    expect(api.toBody('en').message).toMatch(/App Password/);
    expect(api.toBody('en').message).toMatch(/2-Step Verification/);
    expect(api.toBody('he').message).toMatch(/סיסמת אפליקציה/);
    for (const text of [JSON.stringify(api.toBody('en')), JSON.stringify(e), e.message, String(e.stack)]) {
      expect(text).not.toContain('wrong-password-123');
    }
    expect(s.messages).toHaveLength(0);
  });

  it('a wrong password elsewhere gets the generic message', async () => {
    const s = await mock();
    const e = await failure(sendMail(optionsFor(s, { password: 'nope' }), { from: USER, to: content.to }, 'x\r\n'));
    expect(e.key).toBe('server.mail.error.auth');
    expect(isGmailHost('smtp.gmail.com')).toBe(true);
    expect(isGmailHost(HOST)).toBe(false);
  });

  it('validates the certificate: an untrusted CA or another host name fails before any credential is sent', async () => {
    const s = await mock();
    const other = makeTestCa('Somebody Else');
    const untrusted = await failure(sendMail(optionsFor(s, { ca: other.certPem }), { from: USER, to: content.to }, 'x\r\n'));
    expect(untrusted.key).toBe('server.mail.error.tls');
    const wrongName = await failure(sendMail(optionsFor(s, { host: 'smtp.other.test' }), { from: USER, to: content.to }, 'x\r\n'));
    expect(wrongName.key).toBe('server.mail.error.tls');
    expect(s.commands.filter((c) => c.startsWith('AUTH'))).toEqual([]);
    expect(t('en', untrusted.key, { host: HOST, port: s.port })).toContain(HOST);
  });

  it('refuses to authenticate when STARTTLS is not offered (no password in clear text)', async () => {
    const s = await mock({ mode: 'starttls', offerStarttls: false });
    const e = await failure(sendMail(optionsFor(s, { security: 'starttls' }), { from: USER, to: content.to }, 'x\r\n'));
    expect(e.key).toBe('server.mail.error.noStarttls');
    expect(s.commands.some((c) => c.startsWith('AUTH'))).toBe(false);
  });

  it('aborts when the server injects a reply right after STARTTLS', async () => {
    const s = await mock({ mode: 'starttls', injectAfterStarttls: true });
    const e = await failure(sendMail(optionsFor(s, { security: 'starttls' }), { from: USER, to: content.to }, 'x\r\n'));
    expect(e.key).toBe('server.mail.error.protocol');
    expect(s.commands.some((c) => c.startsWith('AUTH'))).toBe(false);
  });

  it('a wrong security mode (TLS to a STARTTLS port) is explained', async () => {
    const s = await mock({ mode: 'starttls' });
    const e = await failure(sendMail(optionsFor(s, { security: 'tls' }), { from: USER, to: content.to }, 'x\r\n'));
    expect(e.key).toBe('server.mail.error.tlsMode');
    expect(t('en', 'server.mail.error.tlsMode', { host: HOST, port: 587 })).toMatch(/465.*SSL\/TLS.*587.*STARTTLS/);
  });

  it('times out on a silent server and reports a refused connection', async () => {
    const s = await mock({ silent: true });
    const started = Date.now();
    const timeout = await failure(sendMail(optionsFor(s, { timeoutMs: 400 }), { from: USER, to: content.to }, 'x\r\n'));
    expect(timeout.key).toBe('server.mail.error.timeout');
    expect(Date.now() - started).toBeLessThan(5000);

    const closed = net.createServer();
    await new Promise<void>((r) => closed.listen(0, '127.0.0.1', () => r()));
    const port = (closed.address() as net.AddressInfo).port;
    await new Promise<void>((r) => closed.close(() => r()));
    const refused = await failure(
      sendMail({ ...optionsFor(s), port, timeoutMs: 3000 }, { from: USER, to: content.to }, 'x\r\n'),
    );
    expect(refused.key).toBe('server.mail.error.connect');
    expect(refused.params).toMatchObject({ host: HOST, port });
  });

  it('reports a rejected recipient with the SMTP code', async () => {
    const s = await mock({ rejectRecipient: true });
    const e = await failure(sendMail(optionsFor(s), { from: USER, to: content.to }, 'x\r\n'));
    expect(e.key).toBe('server.mail.error.recipient');
    expect(e.params.code).toBe(550);
    expect(t('he', e.key, e.params)).toContain('550');
  });

  it('never puts CR/LF-bearing addresses on the wire', async () => {
    const s = await mock();
    const e = await failure(sendMail(optionsFor(s), { from: USER, to: 'a@b.test>\r\nRCPT TO:<evil@x.test' }, 'x\r\n'));
    expect(e.key).toBe('server.mail.error.address');
    expect(s.commands).toEqual([]);
  });
});

describe('MIME builder', () => {
  it('splits long UTF-8 subjects into encoded-words of at most 75 characters without breaking characters', () => {
    const subject = 'איפוס סיסמה ליומן האישי שלך - '.repeat(4) + '😀 Your Personal Diary';
    const encoded = encodeHeaderWords(subject);
    const words = encoded.split('\r\n ');
    expect(words.length).toBeGreaterThan(1);
    for (const w of words) {
      expect(w.length).toBeLessThanOrEqual(75);
      expect(() => Buffer.from(w.slice(10, -2), 'base64').toString('utf8')).not.toThrow();
      expect(Buffer.from(w.slice(10, -2), 'base64').toString('utf8')).not.toContain('�');
    }
    expect(decodeWords(encoded)).toBe(subject);
    expect(encodeHeaderWords('Plain ASCII subject')).toBe('Plain ASCII subject');
    expect(encodeHeaderWords('line\r\nBcc: evil@x.test')).toBe('line Bcc: evil@x.test');
  });

  it('wraps base64 bodies at 76 characters and writes RFC 5322 dates', () => {
    const lines = base64Body('ש'.repeat(500)).split('\r\n');
    expect(lines.every((l) => l.length <= 76)).toBe(true);
    expect(rfc5322Date(new Date('2026-01-05T08:09:10Z'))).toBe('Mon, 05 Jan 2026 08:09:10 +0000');
  });

  it('rejects addresses that could inject headers', () => {
    expect(isMailAddress('yourpersonaldiary.test@example.com')).toBe(true);
    expect(isMailAddress('a@b.com\r\nBcc: x@y.com')).toBe(false);
    expect(isMailAddress('Name <a@b.com>')).toBe(false);
    expect(isMailAddress('no-at-sign')).toBe(false);
    expect(() => buildMessage(USER, { ...content, to: 'x@y.com\nBcc: z@w.com' })).toThrow();
  });
});
