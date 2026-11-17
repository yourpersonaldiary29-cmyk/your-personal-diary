/**
 * `MailContent.replyTo` (server/src/mail/mime.ts): the optional Reply-To header, added for the
 * e-mail of the site's contact form (docs/site-tasks/SITE.md section 5).
 *
 *   - without the field a message is byte for byte what `buildMessage` produced before the field
 *     existed: the expected text below was captured from the builder as it was (its two random
 *     values - the boundary and the Message-ID - are fixed here by a stand-in for `randomBytes`);
 *   - none of the app's own e-mails (password reset, the notices, the test e-mail) sets the field;
 *   - with the field exactly one line is added - `Reply-To: <address>`, after From - and nothing
 *     else changes;
 *   - a value that could add a header, a second address or a display name never reaches the header:
 *     `buildMessage` throws, and the mail service reports 'server.mail.error.address' before any
 *     transport is called;
 *   - the envelope is not touched: a message is still delivered to `to` only.
 * Fictional addresses only; no socket is opened.
 */
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { isSmtpError, type SmtpError } from '../src/mail/errors';
import { buildMessage, type MailContent } from '../src/mail/mime';
import { MailService } from '../src/mail/service';
import { emailChangedEmail, passwordChangedEmail, resetEmail, resetUnavailableEmail, testEmail } from '../src/mail/templates';
import type { Envelope, SmtpTransport } from '../src/mail/transport';
import { cleanupTempDirs, testConfig } from './helpers';
import { headersOf } from './mail-fixtures';

/** While `on`, `randomBytes` gives the same byte every time (0xab), so a whole message can be compared. */
const fixed = vi.hoisted(() => ({ on: false }));
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  const randomBytes = ((size: number) => (fixed.on ? Buffer.alloc(size, 0xab) : actual.randomBytes(size))) as typeof actual.randomBytes;
  return { ...actual, randomBytes, default: { ...actual, randomBytes } };
});

afterEach(() => {
  fixed.on = false;
});
afterAll(cleanupTempDirs);

const SENDER = 'sender@mail.test';
const AT = new Date('2026-09-29T10:00:00Z');
const content: MailContent = {
  to: 'reader@example.com',
  subject: 'איפוס סיסמה - Your Personal Diary',
  text: 'שלום דנה,\n\n.a line that starts with a dot\nSecond line\n',
  html: '<!doctype html><html lang="he" dir="rtl"><body><p>שלום דנה</p></body></html>',
};

/**
 * What `buildMessage(SENDER, content, AT)` returned before `replyTo` existed, with every random byte
 * 0xab. Captured from the unchanged mime.ts on 2026-11-15; never edit it to make the test pass.
 */
const BEFORE = [
  'From: "Your Personal Diary" <sender@mail.test>',
  'To: <reader@example.com>',
  'Subject: =?UTF-8?B?15DXmdek15XXoSDXodeZ16HXnteUIC0gWW91ciBQZXJzb25hbCBEaWFyeQ==?=',
  'Date: Tue, 29 Sep 2026 10:00:00 +0000',
  'Message-ID: <abababababababababababababababab@mail.test>',
  'MIME-Version: 1.0',
  'Auto-Submitted: auto-generated',
  'Content-Type: multipart/alternative; boundary="mpd_abababababababababababab"',
  '',
  '--mpd_abababababababababababab',
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: base64',
  '',
  '16nXnNeV150g15PXoNeULA0KDQouYSBsaW5lIHRoYXQgc3RhcnRzIHdpdGggYSBkb3QNClNlY29u',
  'ZCBsaW5lDQo=',
  '--mpd_abababababababababababab',
  'Content-Type: text/html; charset=UTF-8',
  'Content-Transfer-Encoding: base64',
  '',
  'PCFkb2N0eXBlIGh0bWw+PGh0bWwgbGFuZz0iaGUiIGRpcj0icnRsIj48Ym9keT48cD7Xqdec15XX',
  'nSDXk9eg15Q8L3A+PC9ib2R5PjwvaHRtbD4=',
  '--mpd_abababababababababababab--',
  '',
].join('\r\n');

interface Sent {
  envelope: Envelope;
  data: string;
}

function service() {
  const sent: Sent[] = [];
  const transport: SmtpTransport = { send: async (_opts, envelope, data) => void sent.push({ envelope: { ...envelope }, data }) };
  // A made-up SMTP account for the fake transport - never a real mailbox or password.
  const mail = new MailService({ config: testConfig(), deviceKey: Buffer.alloc(32, 5), transport, options: { log: () => {}, now: () => AT } });
  mail.update({ host: 'smtp.mail.test', port: 465, security: 'tls', username: SENDER, smtpPassword: 'mock-app-secret-0004', enabled: true }, 'u_0123456789abcdef');
  return { mail, sent };
}

describe('a message without replyTo is what it always was', () => {
  it('byte for byte: the builder gives exactly the text captured before the field existed', () => {
    fixed.on = true;
    const built = buildMessage(SENDER, content, AT);
    expect(built.data).toBe(BEFORE);
    expect(Buffer.from(built.data, 'utf8').equals(Buffer.from(BEFORE, 'utf8'))).toBe(true);
    expect(built.messageId).toBe('<abababababababababababababababab@mail.test>');
    // An explicit `undefined` is the same as no field at all.
    expect(buildMessage(SENDER, { ...content, replyTo: undefined }, AT).data).toBe(BEFORE);
    expect(BEFORE).not.toMatch(/reply-to/i);
  });

  it('the same through the mail service: what the transport gets is that text', async () => {
    const { mail, sent } = service();
    fixed.on = true;
    await mail.send(content);
    expect(sent).toHaveLength(1);
    expect(sent[0].data).toBe(BEFORE);
    expect(sent[0].envelope).toEqual({ from: SENDER, to: 'reader@example.com' });
  });

  it('none of the app\'s own e-mails asks for a Reply-To', () => {
    const to = 'dana@example.com';
    const own: MailContent[] = [
      resetEmail('en', { to, firstName: 'Dana', username: 'dana', link: 'http://127.0.0.1:47321/#/reset-password?token=abc', code: '123456', minutes: 30, localLink: true }),
      resetUnavailableEmail('he', { to, firstName: 'Dana', username: 'dana' }),
      passwordChangedEmail('ar', { to, firstName: 'Dana', username: 'dana', at: '2026-09-29T10:00:00.000Z' }),
      emailChangedEmail('ja', { to, firstName: 'Dana', username: 'dana', at: '2026-09-29T10:00:00.000Z' }),
      testEmail('ru', { to, firstName: 'Dana', from: SENDER }),
    ];
    for (const mailContent of own) {
      expect('replyTo' in mailContent).toBe(false);
      const headers = headersOf(buildMessage(SENDER, mailContent, AT).data);
      expect(Object.keys(headers)).toEqual(['from', 'to', 'subject', 'date', 'message-id', 'mime-version', 'auto-submitted', 'content-type']);
    }
  });
});

describe('a message with replyTo', () => {
  it('gets exactly one more line - Reply-To, after From - and is otherwise the same message', () => {
    fixed.on = true;
    const built = buildMessage(SENDER, { ...content, replyTo: 'visitor@example.org' }, AT);
    const lines = built.data.split('\r\n');
    expect(lines.slice(0, 3)).toEqual(['From: "Your Personal Diary" <sender@mail.test>', 'Reply-To: <visitor@example.org>', 'To: <reader@example.com>']);
    expect(lines.filter((line) => /^reply-to:/i.test(line))).toHaveLength(1);
    expect(lines.filter((_, i) => i !== 1).join('\r\n')).toBe(BEFORE);
    expect(headersOf(built.data)['reply-to']).toBe('<visitor@example.org>');
  });

  it('the envelope does not change: the message is delivered to `to` only', async () => {
    const { mail, sent } = service();
    await mail.send({ ...content, replyTo: 'visitor@example.org' });
    expect(sent).toHaveLength(1);
    expect(sent[0].envelope).toEqual({ from: SENDER, to: 'reader@example.com' });
    expect(headersOf(sent[0].data)).toMatchObject({ to: '<reader@example.com>', 'reply-to': '<visitor@example.org>' });
  });

  it('a value that could add a header, an address or a name never reaches the header', async () => {
    const unsafe = [
      'visitor@example.org\r\nBcc: other@example.net',
      'visitor@example.org\nBcc: other@example.net',
      'visitor@example.org\rBcc: other@example.net',
      'visitor@example.org\0',
      'visitor@example.org>\r\nTo: <other@example.net',
      'visitor@example.org, other@example.net',
      'visitor@example.org; other@example.net',
      'Visitor <visitor@example.org>',
      '<visitor@example.org>',
      '"visitor"@example.org',
      'visitor@example.org (a comment)',
      'visitor @example.org',
      ' visitor@example.org',
      'visitor@example',
      'visitor',
      `${'v'.repeat(250)}@example.org`,
      '',
    ];
    const { mail, sent } = service();
    for (const replyTo of unsafe) {
      expect(() => buildMessage(SENDER, { ...content, replyTo }, AT), JSON.stringify(replyTo)).toThrow('invalid reply-to address');
      const error = await mail.send({ ...content, replyTo }).then(
        () => null,
        (e: unknown) => e,
      );
      expect({ replyTo, isSmtp: isSmtpError(error), key: (error as SmtpError | null)?.key }).toEqual({ replyTo, isSmtp: true, key: 'server.mail.error.address' });
    }
    expect(sent).toEqual([]);
    // The check is the one of the two other addresses: what `to` refuses, `replyTo` refuses.
    for (const address of unsafe.filter((a) => a !== '')) expect(() => buildMessage(SENDER, { ...content, to: address }, AT), JSON.stringify(address)).toThrow('invalid recipient address');
  });
});
