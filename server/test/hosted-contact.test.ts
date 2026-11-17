/**
 * The contact form of the public site (docs/site-tasks/SITE.md section 5, server/src/hosted/contact.ts):
 * `POST /api/contact` on the hosted server. A public form that sends mail is something people try to
 * abuse, so most of this file is the abuse:
 *
 *   - a good message is sent once - recipient, Reply-To, subject, both bodies with every value escaped -
 *     and the answer is always a 303 to one of the site's fixed result pages, without a cookie;
 *   - the honeypot, which comes before every other rule; every rule of the fields; bodies that are
 *     not the form (JSON, multipart, nothing);
 *   - header injection: CR / LF in a name, in the address, in `lang`; SMTP commands in the message;
 *   - the longest form in every script (a non-ASCII character is 6 or 9 bytes on the wire); a huge
 *     body (declared, and in chunks), a compressed body, too many fields, another charset;
 *   - a browser on another site: Sec-Fetch-Site, a foreign or look-alike Origin, a foreign Referer -
 *     and `Origin: null`, which is our own only together with `Sec-Fetch-Site: same-origin`;
 *   - the three limits and their reset (a fake clock): 3 per address bucket and hour, 10 per day, 100
 *     per day for the whole server; refused requests are not counted, failed sends are;
 *   - a forged client address: the bucket is the one the other limiters of the hosted server use;
 *   - an open redirect through `lang`: every Location is one of 40 constants;
 *   - memory: a flood leaves nothing behind, nothing is kept longer than 24 hours (a timer, without
 *     any request), the remembered key is short;
 *   - a slow mail server: two messages at a time, the rest is turned away at once and not counted;
 *   - mail not set up, the switch, no contact address, a failed send;
 *   - the log: fixed lines without any value of a request; a run of refusals is one line a minute;
 *     a log that cannot be written changes no answer; nothing of a message reaches the data directory;
 *   - the local server has no such route (404), and neither has a hosted app built without the form;
 *     only the hosted composition loads the module, and a bundle of it carries one field of
 *     legal/settings.json;
 *   - the real composition (`startHosted`): the route is wired to the Mail card, to DIARY_PUBLIC_URL
 *     and to DIARY_CONTACT_FORM.
 * Fictional people, TEST-NET addresses and a capturing SMTP fake only.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { build } from 'esbuild';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_CODES } from '@shared/i18n';
import type { AuthResponse } from '@shared/types';
import { loadConfig, loadHostedEnv } from '../src/config';
import { startHosted, type HostedStartOptions, type RunningHosted } from '../src/hosted';
import {
  CONTACT_MAX_SENDING,
  CONTACT_PER_ADDRESS_PER_DAY,
  CONTACT_PER_ADDRESS_PER_HOUR,
  CONTACT_PER_DAY,
  CONTACT_SUBJECT_MAX,
  ContactLimiter,
  contactRecipient,
  contactRedirect,
  createContactForm,
  type ContactForm,
  type ContactFormOptions,
  type ContactOutcome,
} from '../src/hosted/contact';
import type { HostedAppOptions } from '../src/hosted/types';
import { SmtpError } from '../src/mail/errors';
import { MailService } from '../src/mail/service';
import type { Envelope, SmtpTransport } from '../src/mail/transport';
import { startServer, type RunningServer } from '../src/server';
import { cleanupTempDirs, makeTestApp, tempDataDir, testConfig, testHostedOptions } from './helpers';
import { decodeWords, headersOf, partsOf } from './mail-fixtures';

const ROOT = path.resolve(__dirname, '..', '..');
const HOST = 'diary.example';
const ORIGIN = `https://${HOST}`;
/** Fictional: the owner's own address is never written into a test. */
const RECIPIENT = 'contact@diary-owner.test';
/** A made-up SMTP account for the fake transport - never a real mailbox or password. */
const SENDER = 'diary@mail.test';
const SMTP_SECRET = 'mock-app-secret-0005';
const PASSWORD = 'Passw0rd!';
const FAST = { kdf: { N: 1024, r: 8, p: 1 } };
const T0 = Date.parse('2026-11-15T10:00:00Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** The headers a contact e-mail has - and no other. */
const MAIL_HEADERS = ['from', 'reply-to', 'to', 'subject', 'date', 'message-id', 'mime-version', 'auto-submitted', 'content-type'];

const forms: ContactForm[] = [];
const hosted: RunningHosted[] = [];
const desktops: RunningServer[] = [];

afterEach(async () => {
  vi.useRealTimers();
  for (const form of forms.splice(0)) form.stop();
  for (const srv of hosted.splice(0)) await srv.stop();
  for (const srv of desktops.splice(0)) await srv.stop();
});
afterAll(cleanupTempDirs);

type FieldValue = string | string[];
type Fields = Record<string, FieldValue>;

/** What the site's form posts for a visitor who filled it in properly. */
const GOOD: Record<string, string> = {
  firstName: 'Dana',
  lastName: 'Cohen',
  email: 'dana@example.org',
  message: 'Hello,\r\nI have a question about the calendar.',
  lang: 'en',
  website: '',
};

/** The "serializer" of a body that is already bytes (the client's types only know serializers that return text). */
const RAW_BYTES = ((bytes: Buffer) => bytes) as unknown as (body: unknown) => string;

/** A form body as a browser writes it (`application/x-www-form-urlencoded`, UTF-8). */
function encode(fields: Fields): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(fields)) for (const one of Array.isArray(value) ? value : [value]) params.append(name, one);
  return params.toString();
}

function without(name: string): Fields {
  const rest: Fields = { ...GOOD };
  delete rest[name];
  return rest;
}

/** The result page of a language: English has no folder. */
function page(lang: string, outcome: ContactOutcome): string {
  return `/about/${lang === 'en' ? '' : `${lang}/`}contact/${outcome}/`;
}

/** The 40 pages an answer may lead to. */
const PAGES = new Set(LOCALE_CODES.flatMap((code) => [page(code, 'sent'), page(code, 'error')]));

interface Sent {
  envelope: Envelope;
  data: string;
}

interface SetupOptions {
  contact?: Partial<ContactFormOptions>;
  hosted?: Partial<HostedAppOptions>;
  transport?: SmtpTransport;
  /** false = the owner never filled in the "E-mail" card. */
  mailSetUp?: boolean;
}

interface PostOptions {
  ip?: string;
  headers?: Record<string, string>;
  type?: string;
  host?: string;
}

/** The hosted app with the form, a real mail service on a capturing transport, and a clock the test moves. */
async function setup(o: SetupOptions = {}) {
  const sent: Sent[] = [];
  const logs: string[] = [];
  const clock = { now: T0 };
  const config = testConfig();
  const transport: SmtpTransport = o.transport ?? { send: async (_opts, envelope, data) => void sent.push({ envelope: { ...envelope }, data }) };
  const mail = new MailService({ config, deviceKey: Buffer.alloc(32, 5), transport, options: { log: () => {}, now: () => new Date(clock.now) } });
  if (o.mailSetUp !== false) {
    mail.update({ host: 'smtp.mail.test', port: 465, security: 'tls', username: SENDER, smtpPassword: SMTP_SECRET, enabled: true }, 'u_0123456789abcdef');
  }
  const form = createContactForm({ mail, publicUrl: ORIGIN, recipient: RECIPIENT, now: () => clock.now, log: (line) => logs.push(line), ...o.contact });
  forms.push(form);
  const app = await makeTestApp({ config, hosted: testHostedOptions({ contact: form.handler, ...o.hosted }) });
  const post = (fields: Fields | string | Buffer, opts: PostOptions = {}) => {
    let request = supertest(app.app)
      .post('/api/contact')
      .set('Host', opts.host ?? HOST)
      .set('X-Forwarded-For', opts.ip ?? '203.0.113.9');
    for (const [name, value] of Object.entries(opts.headers ?? {})) request = request.set(name, value);
    const body = typeof fields === 'string' || Buffer.isBuffer(fields) ? fields : encode(fields);
    request = request.set('Content-Type', opts.type ?? 'application/x-www-form-urlencoded');
    // Bytes go out as they are: without this the test client would rewrite a Buffer as a form of its
    // own (one field per byte) - and a compressed or broken body would never reach the server.
    return Buffer.isBuffer(body) ? request.serialize(RAW_BYTES).send(body) : request.send(body);
  };
  return { app, form, mail, sent, logs, clock, config, post };
}

/** Always a 303, always to the fixed page - and never anything of the request in a header. */
function expectPage(res: supertest.Response, outcome: ContactOutcome, lang = 'en'): void {
  expect({ status: res.status, location: res.headers.location }).toEqual({ status: 303, location: page(lang, outcome) });
  expect(PAGES.has(res.headers.location)).toBe(true);
  expect(res.headers['set-cookie']).toBeUndefined();
}

async function until(check: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('a good message', () => {
  it('is sent once - recipient, Reply-To, subject, both bodies with every value escaped - and the visitor lands on the "sent" page of his language', async () => {
    const { post, sent, logs, form } = await setup();
    const res = await post(
      { firstName: '  Dana ', lastName: "O'Neil <b>", email: ' dana@example.org ', message: '  Hello,\r\n<script>alert(1)</script> & "quotes"\r\n\tשלום  ', lang: 'he', website: '' },
      { headers: { Origin: ORIGIN } },
    );
    expectPage(res, 'sent', 'he');
    // The guards of the hosted app apply: its security headers, no caching of an API answer.
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("form-action 'self'");
    expect(res.text).not.toMatch(/Dana|Neil|example\.org|Hello/);

    expect(sent).toHaveLength(1);
    expect(sent[0].envelope).toEqual({ from: SENDER, to: RECIPIENT });
    const headers = headersOf(sent[0].data);
    expect(Object.keys(headers)).toEqual(MAIL_HEADERS);
    expect(headers.from).toBe(`"Your Personal Diary" <${SENDER}>`);
    expect(headers.to).toBe(`<${RECIPIENT}>`);
    expect(headers['reply-to']).toBe('<dana@example.org>');
    expect(decodeWords(headers.subject)).toBe("Contact form: Dana O'Neil <b>");

    const { text, html } = partsOf(sent[0].data);
    expect(text).toBe(
      [
        'A message from the contact form of the website.',
        '',
        'First name: Dana',
        "Last name: O'Neil <b>",
        'E-mail: dana@example.org',
        'Page language: Hebrew (he)',
        'Time (UTC): 2026-11-15 10:00:00',
        '',
        'Message:',
        '',
        'Hello,',
        '<script>alert(1)</script> & "quotes"',
        '\tשלום',
        '',
        'To answer, use "Reply": the answer goes to the e-mail address above.',
        '',
        'Your Personal Diary',
        '',
      ].join('\r\n'),
    );
    // The HTML part: every value escaped, nothing of the visitor is markup or a link.
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain('<strong>First name:</strong> <bdi>Dana</bdi>');
    expect(html).toContain('<strong>Last name:</strong> <bdi>O&#39;Neil &lt;b&gt;</bdi>');
    expect(html).toContain('<strong>E-mail:</strong> <bdi>dana@example.org</bdi>');
    expect(html).toContain('Hello,<br>\r\n&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;<br>\r\n\tשלום</div>');
    expect(html).toContain('<title>Contact form: Dana O&#39;Neil &lt;b&gt;</title>');
    expect(html).not.toMatch(/<script|<b>|href=|src=/i);

    expect(logs).toEqual(['contact form: message sent']);
    expect(form.limiter.count('203.0.113.9')).toEqual({ hour: 1, day: 1 });
  });

  it('needs no session and sets no cookie: a token or a cookie in the request changes nothing', async () => {
    const { post, sent } = await setup();
    const res = await post(GOOD, { headers: { Authorization: 'Bearer not-a-token', Cookie: 'session=abc' } });
    expectPage(res, 'sent');
    expect(sent).toHaveLength(1);
  });

  it('goes to the contact address of legal/settings.json unless a test names another', async () => {
    const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'legal', 'settings.json'), 'utf8')) as { contactEmail: string | null };
    const expected = contactRecipient();
    expect(expected).toBe(settings.contactEmail === null ? null : settings.contactEmail.trim());
    const { post, sent } = await setup({ contact: { recipient: undefined } });
    const res = await post(GOOD);
    if (expected === null) {
      // The owner has not set the address (yet): there is nowhere to send to.
      expectPage(res, 'error');
      expect(sent).toEqual([]);
    } else {
      expectPage(res, 'sent');
      expect(sent.map((m) => m.envelope.to)).toEqual([expected]);
    }
    // Only an address counts.
    expect(contactRecipient(null)).toBeNull();
    expect(contactRecipient(42)).toBeNull();
    expect(contactRecipient('not an address')).toBeNull();
    expect(contactRecipient('someone@example.org\r\nBcc: other@example.net')).toBeNull();
    expect(contactRecipient(' someone@example.org ')).toBe('someone@example.org');
  });

  it('names in another script: the subject is encoded, and cut to a sane length without splitting a character', async () => {
    const { post, sent } = await setup();
    expectPage(await post({ ...GOOD, firstName: 'דנה', lastName: 'כהן' }), 'sent');
    expect(decodeWords(headersOf(sent[0].data).subject)).toBe('Contact form: דנה כהן');
    // Two names of the longest length allowed; the first in characters of two UTF-16 units each
    // (U+20000, a rare Han character), which a careless cut would split.
    const wide = String.fromCodePoint(0x20000);
    expect(wide).toHaveLength(2);
    expectPage(await post({ ...GOOD, firstName: wide.repeat(40), lastName: 'ב'.repeat(80) }, { ip: '203.0.113.10' }), 'sent');
    const subject = decodeWords(headersOf(sent[1].data).subject);
    expect(Array.from(subject)).toHaveLength(CONTACT_SUBJECT_MAX);
    expect(subject.startsWith(`Contact form: ${wide.repeat(40)} ב`)).toBe(true);
    expect(subject.endsWith('ב...')).toBe(true);
    // No half character anywhere (it would arrive as the replacement character U+FFFD).
    expect(subject).not.toContain(String.fromCharCode(0xfffd));
    // The body still has both names whole.
    expect(partsOf(sent[1].data).text).toContain(`Last name: ${'ב'.repeat(80)}\r\n`);
  });
});

describe('the honeypot', () => {
  it('a filled hidden field is answered "sent" and nothing is sent or counted', async () => {
    const { post, sent, logs, form } = await setup();
    expectPage(await post({ ...GOOD, website: 'http://spam.example', lang: 'fr' }), 'sent', 'fr');
    // A robot that fills everything in badly is let go the same way.
    expectPage(await post({ website: 'x', lang: 'de' }), 'sent', 'de');
    expectPage(await post({ ...GOOD, website: ['', 'x'] }), 'sent');
    expect(sent).toEqual([]);
    expect(form.limiter.size).toBe(0);
    expect(logs).toEqual(['contact form: dropped (honeypot)']);
    // An empty field - also one of blanks - is a person.
    expectPage(await post({ ...GOOD, website: '   ' }), 'sent');
    expectPage(await post(without('website')), 'sent');
    expect(sent).toHaveLength(2);
  });

  it('comes before every other rule: a robot is let go the same way from another site, with the form switched off or unable to send', async () => {
    const trap: Fields = { ...GOOD, website: 'buy now' };
    const foreign: PostOptions = { headers: { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' } };
    const servers: SetupOptions[] = [{}, { contact: { enabled: false } }, { mailSetUp: false }, { contact: { recipient: null } }, { contact: { perDay: 0 } }, { contact: { maxSending: 0 } }];
    for (const options of servers) {
      const { post, sent, logs, form } = await setup(options);
      expectPage(await post({ ...trap, lang: 'it' }, foreign), 'sent', 'it');
      expectPage(await post(trap), 'sent');
      expect(sent).toEqual([]);
      expect(form.limiter.size).toBe(0);
      expect(logs).toEqual(['contact form: dropped (honeypot)']);
    }
  });
});

describe('the fields', () => {
  it('each rule: a missing, blank, too long or multi-line value, a control character, a bad address -> "error", nothing sent, nothing counted', async () => {
    const { post, sent, form, logs } = await setup();
    const lineSeparator = String.fromCharCode(0x2028);
    const paragraphSeparator = String.fromCharCode(0x2029);
    const bad: Array<[string, Fields]> = [
      ['no first name', without('firstName')],
      ['a blank first name', { ...GOOD, firstName: '   ' }],
      ['a first name of 81 characters', { ...GOOD, firstName: 'a'.repeat(81) }],
      ['a line feed in the first name', { ...GOOD, firstName: 'Dana\nCohen' }],
      ['a carriage return in the first name', { ...GOOD, firstName: 'Dana\rCohen' }],
      ['a tab in the first name', { ...GOOD, firstName: 'Da\tna' }],
      ['NUL in the first name', { ...GOOD, firstName: 'Da\0na' }],
      ['a paragraph separator in the first name', { ...GOOD, firstName: `Da${paragraphSeparator}na` }],
      ['no last name', without('lastName')],
      ['a blank last name', { ...GOOD, lastName: '\t' }],
      ['a last name of 81 characters', { ...GOOD, lastName: 'כ'.repeat(81) }],
      ['a line break in the last name', { ...GOOD, lastName: 'Cohen\r\nLevi' }],
      ['an escape character in the last name', { ...GOOD, lastName: 'Co\x1bhen' }],
      ['DEL in the last name', { ...GOOD, lastName: 'Co\x7fhen' }],
      ['a C1 control character in the last name', { ...GOOD, lastName: 'Co\x85hen' }],
      ['a line separator in the last name', { ...GOOD, lastName: `Co${lineSeparator}hen` }],
      ['no e-mail address', without('email')],
      ['a blank e-mail address', { ...GOOD, email: ' ' }],
      ['an address without @', { ...GOOD, email: 'dana.example.org' }],
      ['an address without a dot in the domain', { ...GOOD, email: 'dana@example' }],
      ['an address with a blank', { ...GOOD, email: 'dana cohen@example.org' }],
      ['an address with a display name', { ...GOOD, email: 'Dana <dana@example.org>' }],
      ['two addresses', { ...GOOD, email: 'dana@example.org,other@example.net' }],
      ['an address of 255 characters', { ...GOOD, email: `${'a'.repeat(243)}@example.org` }],
      ['a control character in the address', { ...GOOD, email: 'da\x01na@example.org' }],
      ['no message', without('message')],
      ['a blank message', { ...GOOD, message: ' \r\n \t ' }],
      ['a message of 5001 characters', { ...GOOD, message: 'a'.repeat(5001) }],
      ['NUL in the message', { ...GOOD, message: 'Hello\0there' }],
      ['an escape character in the message', { ...GOOD, message: 'Hello\x1b[31m' }],
      ['a form feed in the message', { ...GOOD, message: 'Hello\x0cthere' }],
      ['the first name sent twice', { ...GOOD, firstName: ['Dana', 'Eve'] }],
      ['the address sent twice', { ...GOOD, email: ['dana@example.org', 'other@example.net'] }],
      ['the message sent twice', { ...GOOD, message: ['one', 'two'] }],
    ];
    for (const [what, fields] of bad) {
      const res = await post({ ...fields, lang: 'es' });
      expect({ what, status: res.status, location: res.headers.location }).toEqual({ what, status: 303, location: page('es', 'error') });
    }
    expect(sent).toEqual([]);
    expect(form.limiter.size).toBe(0);
    // One line for the whole run (they came within a minute), and nothing of what was typed.
    expect(logs).toEqual(['contact form: refused (invalid input)']);
    // None of the refusals used up the visitor's hour: he corrects the form and it goes out.
    expectPage(await post(GOOD), 'sent');
    expect(sent).toHaveLength(1);
  });

  it('the longest values the form allows are accepted; a line break of the textarea counts as one character', async () => {
    const { post, sent } = await setup();
    const address = `${'a'.repeat(242)}@example.org`;
    expect(address).toHaveLength(254);
    // 5000 characters as the browser counts them (1666 lines of "ab" + line break, and "xy"), sent with CR LF.
    const message = `${'ab\r\n'.repeat(1666)}xy`;
    expect(message.replace(/\r\n/g, '\n')).toHaveLength(5000);
    const res = await post({ ...GOOD, firstName: 'a'.repeat(80), lastName: 'b'.repeat(80), email: address, message });
    expectPage(res, 'sent');
    expect(sent).toHaveLength(1);
    expect(headersOf(sent[0].data)['reply-to']).toBe(`<${address}>`);
    const { text } = partsOf(sent[0].data);
    expect(text).toContain(`First name: ${'a'.repeat(80)}\r\n`);
    expect(text).toContain(`\r\n${'ab\r\n'.repeat(1666)}xy\r\n`);
  });

  it('the longest form fits in every script: a browser writes a Chinese character as 9 bytes, a Hebrew one as 6', async () => {
    const { post, sent } = await setup();
    // 5000 characters of Chinese and two names of 80 - the most the page lets anyone type.
    const longest = { ...GOOD, lang: 'zh', firstName: '名'.repeat(80), lastName: '姓'.repeat(80), email: `${'d'.repeat(242)}@example.org`, message: '日记'.repeat(2500) };
    expect(Buffer.byteLength(encode(longest))).toBeGreaterThan(46_000);
    expectPage(await post(longest), 'sent', 'zh');
    // 5000 characters of Hebrew, on the Hebrew page.
    expectPage(await post({ ...GOOD, lang: 'he', message: 'ש'.repeat(5000) }, { ip: '203.0.113.10' }), 'sent', 'he');
    expect(sent).toHaveLength(2);
    expect(partsOf(sent[0].data).text).toContain(`\r\n${'日记'.repeat(2500)}\r\n`);
    expect(partsOf(sent[1].data).text).toContain(`\r\n${'ש'.repeat(5000)}\r\n`);
  });

  it('a body that is not the form is not served: JSON, multipart, plain text, nothing', async () => {
    const { post, sent, app } = await setup();
    const json = await post(JSON.stringify(GOOD), { type: 'application/json' });
    expectPage(json, 'error');
    // Not the JSON error of the API either: the JSON parser never sees this route.
    expect(json.headers['content-type']).not.toMatch(/json/);
    expectPage(await post(`--x\r\nContent-Disposition: form-data; name="firstName"\r\n\r\nDana\r\n--x--\r\n`, { type: 'multipart/form-data; boundary=x' }), 'error');
    expectPage(await post(encode(GOOD), { type: 'text/plain' }), 'error');
    expectPage(await post(''), 'error');
    expectPage(await supertest(app.app).post('/api/contact').set('Host', HOST), 'error');
    expect(sent).toEqual([]);
  });
});

describe('header injection', () => {
  it('CR and LF in a name, in the address or in lang never become a header - of the e-mail or of the answer', async () => {
    const { post, sent } = await setup();
    const refused: Fields[] = [
      { ...GOOD, firstName: 'Dana\r\nBcc: victim@example.net' },
      { ...GOOD, lastName: 'Cohen\r\nSubject: spoofed\r\n\r\nspoofed body' },
      { ...GOOD, lastName: 'Cohen\nReply-To: victim@example.net' },
      { ...GOOD, email: 'dana@example.org\r\nBcc: victim@example.net' },
      { ...GOOD, email: 'dana@example.org\nCc: victim@example.net' },
      { ...GOOD, email: 'dana@example.org>\r\nRCPT TO:<victim@example.net' },
      { ...GOOD, email: 'dana@example.org, victim@example.net' },
      { ...GOOD, email: '"dana\r\nBcc: victim@example.net"@example.org' },
    ];
    for (const fields of refused) expectPage(await post(fields), 'error');
    expect(sent).toEqual([]);

    // `lang` is only ever looked up in the list of the 20: anything else means English, and the message
    // itself (which is fine) goes out.
    const forged = await post({ ...GOOD, lang: 'he\r\nSet-Cookie: session=stolen\r\nLocation: https://evil.example/' });
    expectPage(forged, 'sent', 'en');
    expect(JSON.stringify(forged.headers)).not.toMatch(/stolen|evil/);

    // Text that looks like headers or like an encoded word is text: it stays inside its own field.
    expectPage(await post({ ...GOOD, firstName: '=?UTF-8?B?QmNjOiB2aWN0aW1AZXhhbXBsZS5uZXQ=?=', lastName: 'Bcc: victim@example.net' }, { ip: '203.0.113.10' }), 'sent');
    // A message that tries to end the DATA section and start a second mail.
    const smuggle = 'Hi\r\n.\r\nMAIL FROM:<evil@example.net>\r\nRCPT TO:<victim@example.net>\r\nDATA\r\nSubject: spam\r\n\r\nspam\r\n.\r\n';
    expectPage(await post({ ...GOOD, message: smuggle }, { ip: '203.0.113.11' }), 'sent');
    // The same trick next to letters that make the whole subject an encoded word.
    expectPage(await post({ ...GOOD, firstName: 'דנה =?UTF-8?Q?=0D=0ABcc:_victim@example.net?=' }, { ip: '203.0.113.12' }), 'sent');

    expect(sent).toHaveLength(4);
    for (const mail of sent) {
      expect(mail.envelope).toEqual({ from: SENDER, to: RECIPIENT });
      const headers = headersOf(mail.data);
      expect(Object.keys(headers)).toEqual(MAIL_HEADERS);
      expect(headers.to).toBe(`<${RECIPIENT}>`);
      expect(headers['reply-to']).toBe('<dana@example.org>');
      // No line of the message as it goes on the wire is a lone dot or a command.
      const wire = mail.data.split('\r\n');
      expect(wire.filter((line) => line === '.' || /^(?:MAIL FROM|RCPT TO|DATA|Bcc|Cc)\b/i.test(line))).toEqual([]);
    }
    // The name that is written like an encoded word: no mail program will decode it - every "=?" went out as "= ?".
    const subject = headersOf(sent[1].data).subject;
    expect(subject).toBe('Contact form: = ?UTF-8?B?QmNjOiB2aWN0aW1AZXhhbXBsZS5uZXQ= ?= Bcc: victim@example.net');
    expect(subject).not.toContain('=?');
    expect(decodeWords(subject)).toBe(subject);
    expect(partsOf(sent[1].data).text).toContain('First name: =?UTF-8?B?QmNjOiB2aWN0aW1AZXhhbXBsZS5uZXQ=?=\r\n');
    expect(decodeWords(headersOf(sent[3].data).subject)).toBe('Contact form: דנה = ?UTF-8?Q?=0D=0ABcc:_victim@example.net?= Cohen');
    expect(partsOf(sent[2].data).text).toContain('Hi\r\n.\r\nMAIL FROM:<evil@example.net>\r\nRCPT TO:<victim@example.net>\r\nDATA\r\nSubject: spam\r\n\r\nspam\r\n.\r\n');
  });
});

describe('a huge or strange body', () => {
  it('more than 64 KB is refused whatever it holds - declared or in chunks - and nothing is sent', async () => {
    const { post, sent, logs, form } = await setup();
    // 70 KB: one field too long for the route. The page language is in the body, so it is unknown: English.
    expectPage(await post({ ...GOOD, lang: 'he', message: 'a'.repeat(70_000) }), 'error');
    expectPage(await post(`message=${'a'.repeat(1_000_000)}`), 'error');
    expectPage(await post(Buffer.alloc(200_000, 0x26)), 'error');
    expect(sent).toEqual([]);
    expect(form.limiter.size).toBe(0);
    expect(logs).toEqual(['contact form: refused (unreadable request)']);
    // The limit to the byte: the form padded with a seventh field to exactly 64 KB is read (and judged like any
    // other: this one is fine); one byte more is not.
    const padded = (bytes: number): string => {
      const head = `${encode(GOOD)}&pad=`;
      return `${head}${'x'.repeat(bytes - head.length)}`;
    };
    expect(Buffer.byteLength(padded(64 * 1024))).toBe(65_536);
    expectPage(await post(padded(64 * 1024)), 'sent');
    expectPage(await post(padded(64 * 1024 + 1)), 'error');
    expect(sent).toHaveLength(1);
  });

  it('a compressed body is not inflated, a thirteenth field is one too many, another charset is not read', async () => {
    const { post, sent } = await setup();
    // First the form as plain bytes: it is taken. So what is refused below is the compression itself,
    // not the way this test sends bytes.
    const good = Buffer.from(encode(GOOD));
    expectPage(await post(good), 'sent');
    expect(sent).toHaveLength(1);
    const bomb = zlib.gzipSync(Buffer.from(`message=${'a'.repeat(4_000_000)}`));
    expect(bomb.length).toBeLessThan(16 * 1024);
    expectPage(await post(bomb, { headers: { 'Content-Encoding': 'gzip' } }), 'error');
    // The good form itself, compressed three ways: a server that inflated it would send it.
    expectPage(await post(zlib.gzipSync(good), { headers: { 'Content-Encoding': 'gzip' } }), 'error');
    expectPage(await post(zlib.deflateSync(good), { headers: { 'Content-Encoding': 'deflate' } }), 'error');
    expectPage(await post(zlib.brotliCompressSync(good), { headers: { 'Content-Encoding': 'br' } }), 'error');
    // Compressed without saying so: bytes that are no form.
    expectPage(await post(zlib.gzipSync(good)), 'error');
    const extra = (n: number): Fields => Object.fromEntries(Array.from({ length: n }, (_, i) => [`extra${i}`, 'x']));
    expectPage(await post({ ...GOOD, ...extra(7) }), 'error');
    expectPage(await post(encode(GOOD), { type: 'application/x-www-form-urlencoded; charset=utf-16' }), 'error');
    expect(sent).toHaveLength(1);
    // Twelve fields (the form has six) are still the form.
    expectPage(await post({ ...GOOD, ...extra(6) }), 'sent');
    expect(sent).toHaveLength(2);
  });

  it('no encoding trick turns text into a line break: ISO-8859-1, overlong UTF-8, broken UTF-8, a double escape', async () => {
    const { post, sent } = await setup();
    const body = (firstName: string) => `firstName=${firstName}&lastName=Cohen&email=dana%40example.org&message=Hello&lang=en&website=`;
    const latin1: PostOptions = { type: 'application/x-www-form-urlencoded; charset=iso-8859-1' };
    // ISO-8859-1 is the one other charset the parser reads: the same rules judge what it yields.
    expectPage(await post(body('Dana%0D%0ABcc:%20victim@example.net'), latin1), 'error');
    expectPage(await post(body('Dana%0ABcc:%20victim@example.net'), latin1), 'error');
    // 0x85 is "next line" there - a C1 control character.
    expectPage(await post(body('Dana%85Bcc:%20victim@example.net'), latin1), 'error');
    expect(sent).toEqual([]);
    expectPage(await post(body('Ren%E9e'), latin1), 'sent');
    // An overlong UTF-8 line feed (C0 8A) is not UTF-8: the escapes stay the text they are.
    expectPage(await post(body('Da%C0%8ABcc:%20victim@example.net'), { ip: '203.0.113.10' }), 'sent');
    // The same two bytes sent raw, and a line break that is escaped twice.
    expectPage(await post(Buffer.concat([Buffer.from('firstName=Da'), Buffer.from([0xc0, 0x8a]), Buffer.from('na&lastName=Cohen&email=dana%40example.org&message=Hello&lang=en&website=')]), { ip: '203.0.113.11' }), 'sent');
    expectPage(await post(body('Dana%250D%250ABcc:%2520victim@example.net'), { ip: '203.0.113.12' }), 'sent');
    expect(sent).toHaveLength(4);
    expect(decodeWords(headersOf(sent[0].data).subject)).toBe('Contact form: Renée Cohen');
    for (const mail of sent) {
      // Still exactly the headers of a contact e-mail, to the one recipient.
      expect(Object.keys(headersOf(mail.data))).toEqual(MAIL_HEADERS);
      expect(mail.envelope).toEqual({ from: SENDER, to: RECIPIENT });
    }
    // Each name arrived as one line of text: what could not be decoded stayed as it was written.
    const firstNames = sent.map((mail) => /^First name: ([^\r\n]*)\r\nLast name: Cohen\r\n/m.exec(partsOf(mail.data).text)?.[1]);
    expect(firstNames[0]).toBe('Renée');
    expect(firstNames[1]).toBe('Da%C0%8ABcc:%20victim@example.net');
    expect(firstNames[2]).toMatch(/^Da�+na$/);
    expect(firstNames[3]).toBe('Dana%0D%0ABcc:%20victim@example.net');
  });
});

describe('a browser on another site', () => {
  it('Sec-Fetch-Site, Origin, else Referer decide; saying nothing is accepted; Origin "null" is our own only with Sec-Fetch-Site: same-origin', async () => {
    const { post, sent } = await setup();
    const cases: Array<[string, Record<string, string>, ContactOutcome]> = [
      ['the own origin', { Origin: ORIGIN }, 'sent'],
      ['the own origin, as a current browser sends it', { Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin', Referer: `${ORIGIN}/about/he/faq/` }, 'sent'],
      ['the own origin in another spelling', { Origin: 'https://DIARY.example:443' }, 'sent'],
      ['the own origin with the trailing dot of the name', { Origin: 'https://diary.example.', 'Sec-Fetch-Site': 'same-origin', Referer: 'https://diary.example./about/' }, 'sent'],
      ['the own name with two trailing dots', { Origin: 'https://diary.example..' }, 'error'],
      ['a foreign origin', { Origin: 'https://evil.example' }, 'error'],
      ['a look-alike origin', { Origin: 'https://diary.example.evil.example' }, 'error'],
      ['the own name in the query of a foreign URL', { Origin: 'https://evil.example/?https://diary.example' }, 'error'],
      ['the own name as a user name', { Origin: 'https://diary.example@evil.example' }, 'error'],
      ['plain http', { Origin: 'http://diary.example' }, 'error'],
      ['another port', { Origin: 'https://diary.example:8443' }, 'error'],
      ['two origins in one header', { Origin: `${ORIGIN}, https://evil.example` }, 'error'],
      ['the Android WebView (it may read the API; it is not the site)', { Origin: 'https://localhost' }, 'error'],
      ['the desktop shell', { Origin: 'tauri://localhost' }, 'error'],
      ['no Origin, an own Referer', { Referer: `${ORIGIN}/about/downloads/` }, 'sent'],
      ['no Origin, a foreign Referer', { Referer: 'https://evil.example/form.html' }, 'error'],
      ['no Origin, a Referer with the own name in its path', { Referer: 'https://evil.example/https://diary.example/' }, 'error'],
      ['no Origin, a Referer that is no web address', { Referer: 'about:blank' }, 'error'],
      ['a foreign Origin next to an own Referer', { Origin: 'https://evil.example', Referer: `${ORIGIN}/about/` }, 'error'],
      // The pages of the site send their real origin (<meta name="referrer" content="same-origin">). A browser
      // writes "null" for a page that hides where it is - another site under `no-referrer`, a sandboxed frame -
      // so "null" is our own only when Sec-Fetch-Site, which no page can set, says so.
      ['Origin null from our own page', { Origin: 'null', 'Sec-Fetch-Site': 'same-origin' }, 'sent'],
      ['Origin null from our own page, and a foreign Referer', { Origin: 'null', 'Sec-Fetch-Site': 'same-origin', Referer: 'https://evil.example/' }, 'error'],
      ['Origin null from another site', { Origin: 'null', 'Sec-Fetch-Site': 'cross-site' }, 'error'],
      ['Origin null from a neighbour host', { Origin: 'null', 'Sec-Fetch-Site': 'same-site' }, 'error'],
      ['Origin null and nothing else (a browser without Sec-Fetch-Site)', { Origin: 'null' }, 'error'],
      ['Origin NULL in capitals', { Origin: 'NULL' }, 'error'],
      ['Origin null and an own Referer, without Sec-Fetch-Site', { Origin: 'null', Referer: `${ORIGIN}/about/` }, 'error'],
      ['Origin null and a foreign Referer', { Origin: 'null', Referer: 'https://evil.example/' }, 'error'],
      ['cross-site with a forged own Origin', { Origin: ORIGIN, 'Sec-Fetch-Site': 'cross-site' }, 'error'],
      ['cross-site and nothing else', { 'Sec-Fetch-Site': 'cross-site' }, 'error'],
      ['not from a page at all', { 'Sec-Fetch-Site': 'none' }, 'error'],
      ['neither header (not a browser)', {}, 'sent'],
    ];
    let accepted = 0;
    for (const [what, headers, outcome] of cases) {
      // A fresh address for every message that is let through (three an hour per address).
      const res = await post(GOOD, { headers, ip: `198.51.100.${accepted + 1}` });
      expect({ what, status: res.status, location: res.headers.location }).toEqual({ what, status: 303, location: page('en', outcome) });
      if (outcome === 'sent') accepted += 1;
    }
    expect(sent).toHaveLength(accepted);
    expect(accepted).toBe(7);
    // A page served at the trailing-dot spelling of the host (the Host check lets it through) posts from there.
    const dotted = await post(GOOD, { host: `${HOST}.`, ip: '198.51.100.99', headers: { Origin: `${ORIGIN}.`, 'Sec-Fetch-Site': 'same-origin', Referer: `${ORIGIN}./about/he/` } });
    expectPage(dotted, 'sent');
    expect(sent).toHaveLength(8);
  });

  it('the owner\'s own domain (DIARY_EXTRA_HOSTS) is the site as well', async () => {
    const { post, sent } = await setup({ contact: { extraHosts: ['diary.example.org', 'www.diary.example.org'] } });
    expectPage(await post(GOOD, { headers: { Origin: 'https://www.diary.example.org' } }), 'sent');
    expectPage(await post(GOOD, { headers: { Referer: 'https://diary.example.org/faq/' } }), 'sent');
    expectPage(await post(GOOD, { headers: { Origin: 'http://diary.example.org' } }), 'error');
    expectPage(await post(GOOD, { headers: { Origin: 'https://other.example.org' } }), 'error');
    expect(sent).toHaveLength(2);
  });

  it('the Host check of the hosted server stands in front of the form', async () => {
    const { post, sent } = await setup();
    const res = await post(GOOD, { host: 'evil.example' });
    expect(res.status).toBe(421);
    expect(sent).toEqual([]);
  });
});

describe('the limits (a fake clock)', () => {
  it('three messages per address bucket and hour: the fourth is "error"; an IPv6 /64 is one bucket; the hour passes', async () => {
    const { post, sent, logs, clock, form } = await setup();
    expect(form.limiter).toMatchObject({ perAddressPerHour: 3, perAddressPerDay: 10, perDay: 100 });
    expect([CONTACT_PER_ADDRESS_PER_HOUR, CONTACT_PER_ADDRESS_PER_DAY, CONTACT_PER_DAY]).toEqual([3, 10, 100]);
    for (let i = 0; i < 3; i++) expectPage(await post({ ...GOOD, lang: 'he' }), 'sent', 'he');
    expectPage(await post({ ...GOOD, lang: 'he' }), 'error', 'he');
    expect(sent).toHaveLength(3);
    expect(logs).toEqual(['contact form: message sent', 'contact form: message sent', 'contact form: message sent', 'contact form: refused (rate limit)']);
    // Another address has its own hour ...
    expectPage(await post(GOOD, { ip: '203.0.113.10' }), 'sent');
    // ... and a whole IPv6 /64 shares one.
    expectPage(await post(GOOD, { ip: '2001:db8:1:2::1' }), 'sent');
    expectPage(await post(GOOD, { ip: '2001:db8:1:2::2' }), 'sent');
    expectPage(await post(GOOD, { ip: '2001:db8:1:2:ffff::3' }), 'sent');
    expectPage(await post(GOOD, { ip: '2001:db8:1:2::4' }), 'error');
    expectPage(await post(GOOD, { ip: '2001:db8:1:3::1' }), 'sent');
    expect(form.limiter.count('2001:db8:1:2::/64')).toEqual({ hour: 3, day: 3 });
    // 59 minutes later the first address is still over its hour; after the hour it may write again.
    clock.now += 59 * MINUTE;
    expectPage(await post(GOOD), 'error');
    clock.now += MINUTE;
    expectPage(await post(GOOD), 'sent');
    expect(sent).toHaveLength(9);
  });

  it('ten per address bucket and day: the eleventh is "error" although its hour is empty; a day after the first it opens again', async () => {
    const { post, sent, clock, form } = await setup();
    // 3 + 3 + 3 + 1 messages, an hour and a minute apart: never more than three in one hour.
    for (const burst of [3, 3, 3, 1]) {
      for (let i = 0; i < burst; i++) expectPage(await post(GOOD), 'sent');
      clock.now += 61 * MINUTE;
    }
    expect(form.limiter.count('203.0.113.9')).toEqual({ hour: 0, day: 10 });
    expectPage(await post(GOOD), 'error');
    expect(sent).toHaveLength(10);
    // Another address is not touched by it.
    expectPage(await post(GOOD, { ip: '203.0.113.10' }), 'sent');
    // One minute before the first three are a day old: still ten.
    clock.now = T0 + DAY - MINUTE;
    expectPage(await post(GOOD), 'error');
    clock.now = T0 + DAY;
    expect(form.limiter.count('203.0.113.9')).toEqual({ hour: 0, day: 7 });
    for (let i = 0; i < 3; i++) expectPage(await post(GOOD), 'sent');
    expectPage(await post(GOOD), 'error');
    expect(sent).toHaveLength(14);
  });

  it('a hundred per day for the whole server, whatever the addresses; a day later it opens again', async () => {
    const { post, sent, logs, clock, form } = await setup();
    // 34 addresses, three messages each: the 100th is the last one sent.
    const outcomes: ContactOutcome[] = [];
    for (let address = 0; address < 34; address++) {
      for (let i = 0; i < 3; i++) {
        const res = await post(GOOD, { ip: `198.51.100.${address + 1}` });
        expect(res.status).toBe(303);
        outcomes.push(res.headers.location === page('en', 'sent') ? 'sent' : 'error');
      }
    }
    expect(outcomes.filter((o) => o === 'sent')).toHaveLength(100);
    expect(outcomes.slice(0, 100).every((o) => o === 'sent')).toBe(true);
    expect(outcomes.slice(100)).toEqual(['error', 'error']);
    expect(sent).toHaveLength(100);
    expect(form.limiter.total()).toBe(100);
    expect(form.limiter.size).toBe(34);
    // An address that never wrote is turned away too - and is not remembered for it.
    expectPage(await post(GOOD, { ip: '192.0.2.200' }), 'error');
    expect(form.limiter.size).toBe(34);
    expect(logs.filter((line) => line !== 'contact form: message sent')).toEqual(['contact form: refused (daily limit of the server)']);
    // A day after the first messages the server takes messages again.
    clock.now = T0 + DAY;
    expectPage(await post(GOOD, { ip: '192.0.2.200' }), 'sent');
    expect(sent).toHaveLength(101);
    expect(form.limiter.size).toBe(1);
  });

  it('a refused request is not counted; a message the mail server did not take is', async () => {
    let failing = true;
    const delivered: string[] = [];
    let attempts = 0;
    const transport: SmtpTransport = {
      send: async (_opts, envelope) => {
        attempts += 1;
        if (failing) throw new SmtpError('server.mail.error.connect', { host: 'smtp.mail.test', port: 465 });
        delivered.push(envelope.to);
      },
    };
    const { post, form, logs } = await setup({ transport });
    for (let i = 0; i < 5; i++) expectPage(await post({ ...GOOD, email: 'nobody' }), 'error');
    expect(form.limiter.count('203.0.113.9')).toEqual({ hour: 0, day: 0 });
    // Three attempts fail at the mail server: each is "error", and each uses one of the three.
    for (let i = 0; i < 3; i++) expectPage(await post(GOOD), 'error');
    expect(attempts).toBe(3);
    expect(form.limiter.count('203.0.113.9')).toEqual({ hour: 3, day: 3 });
    // The mail server is back - but this address has used its hour: nobody can hammer a failing server.
    failing = false;
    expectPage(await post(GOOD), 'error');
    expect(attempts).toBe(3);
    expectPage(await post(GOOD, { ip: '203.0.113.10' }), 'sent');
    expect(delivered).toEqual([RECIPIENT]);
    expect(logs).toEqual([
      'contact form: refused (invalid input)',
      'contact form: not sent (server.mail.error.connect)',
      'contact form: not sent (server.mail.error.connect)',
      'contact form: not sent (server.mail.error.connect)',
      'contact form: refused (rate limit)',
      'contact form: message sent',
    ]);
  });
});

describe('a forged client address', () => {
  it('X-Forwarded-For: a value the client puts in front changes nothing - the hop of the edge is counted', async () => {
    const { post, sent, form } = await setup();
    for (const forged of ['198.51.100.1', '198.51.100.2', '2001:db8::1']) {
      expectPage(await post(GOOD, { headers: { 'X-Forwarded-For': `${forged}, 203.0.113.9` } }), 'sent');
    }
    expectPage(await post(GOOD, { headers: { 'X-Forwarded-For': '198.51.100.99, 203.0.113.9' } }), 'error');
    expectPage(await post(GOOD, { headers: { 'X-Forwarded-For': '203.0.113.9', 'X-Real-IP': '198.51.100.4', Forwarded: 'for=198.51.100.5', 'Fly-Client-IP': '198.51.100.6' } }), 'error');
    expect(sent).toHaveLength(3);
    expect(form.limiter.size).toBe(1);
    expect(form.limiter.count('203.0.113.9')).toEqual({ hour: 3, day: 3 });
  });

  it('a single-value header the edge overwrites (Fly-Client-IP): only that header is the address', async () => {
    const { post, sent, form } = await setup({ hosted: { clientIpHeader: 'fly-client-ip' } });
    for (const forged of ['198.51.100.1', '198.51.100.2', '198.51.100.3']) {
      expectPage(await post(GOOD, { ip: forged, headers: { 'Fly-Client-IP': '203.0.113.50' } }), 'sent');
    }
    expectPage(await post(GOOD, { ip: '198.51.100.4', headers: { 'Fly-Client-IP': '203.0.113.50' } }), 'error');
    expect(form.limiter.count('203.0.113.50')).toEqual({ hour: 3, day: 3 });
    expect(sent).toHaveLength(3);
    // Whatever arrives in that header, the remembered key is short.
    expectPage(await post(GOOD, { headers: { 'Fly-Client-IP': 'x'.repeat(5000) } }), 'sent');
    expect(form.limiter.count('x'.repeat(64))).toEqual({ hour: 1, day: 1 });
    expect(form.limiter.count('x'.repeat(5000))).toEqual({ hour: 0, day: 0 });
  });

  it('no header configured: the socket address is counted and every forwarded header is ignored', async () => {
    const { post, sent, form } = await setup({ hosted: { clientIpHeader: undefined } });
    for (const forged of ['198.51.100.1', '198.51.100.2', '198.51.100.3']) {
      expectPage(await post(GOOD, { ip: forged, headers: { 'Fly-Client-IP': forged, 'X-Real-IP': forged } }), 'sent');
    }
    expectPage(await post(GOOD, { ip: '198.51.100.4' }), 'error');
    expect(sent).toHaveLength(3);
    expect(form.limiter.size).toBe(1);
    expect(form.limiter.count('127.0.0.1')).toEqual({ hour: 3, day: 3 });
  });
});

describe('the answer', () => {
  it('is a 303 to the page of the language for every locale, and no value of `lang` ever reaches the Location', async () => {
    const { post, sent, form } = await setup();
    expect(LOCALE_CODES).toHaveLength(20);
    expect(PAGES.size).toBe(40);
    for (const code of LOCALE_CODES) {
      // "sent" through the honeypot (nothing is sent or counted), "error" through an empty form.
      expectPage(await post({ ...GOOD, website: 'x', lang: code }), 'sent', code);
      expectPage(await post({ lang: code }), 'error', code);
      expect(contactRedirect(code, 'sent')).toBe(page(code, 'sent'));
      expect(contactRedirect(code, 'error')).toBe(page(code, 'error'));
    }
    expect(page('en', 'sent')).toBe('/about/contact/sent/');
    expect(page('he', 'error')).toBe('/about/he/contact/error/');

    const strange: FieldValue[] = [
      '',
      'xx',
      'EN',
      'He',
      'he ',
      ' he',
      'he/',
      'en-US',
      'iw',
      '../',
      '..%2f..%2f',
      'he/../../evil',
      'he\\evil',
      '//evil.example',
      '//evil.example/%2e%2e',
      '/\\evil.example',
      'https://evil.example/',
      'https:evil.example',
      'javascript:alert(1)',
      'he?next=https://evil.example/',
      'he#https://evil.example/',
      'he\r\nLocation: https://evil.example/',
      'he\0',
      '__proto__',
      'constructor',
      'toString',
      'hasOwnProperty',
      'x'.repeat(2000),
      ['he', 'ar'],
    ];
    for (const lang of strange) {
      const ok = await post({ ...GOOD, website: 'x', lang });
      const bad = await post({ lang });
      expect({ lang, ok: ok.headers.location, bad: bad.headers.location }).toEqual({ lang, ok: '/about/contact/sent/', bad: '/about/contact/error/' });
      expect([ok.status, bad.status]).toEqual([303, 303]);
      expect(JSON.stringify([ok.headers, bad.headers])).not.toMatch(/evil|javascript|proto/i);
    }
    // A field named like something every object has is no way in either.
    const named = await post('__proto__[lang]=ar&constructor=x&toString=y&hasOwnProperty=z&lang=he&website=x');
    expectPage(named, 'sent', 'he');
    expect(sent).toEqual([]);
    expect(form.limiter.size).toBe(0);
  });

  it('only POST /api/contact is the form: other methods and deeper paths are the 404 of an unknown route', async () => {
    const { app, post } = await setup();
    const agent = supertest(app.app);
    for (const res of [
      await agent.get('/api/contact').set('Host', HOST),
      await agent.put('/api/contact').set('Host', HOST).type('form').send(encode(GOOD)),
      await agent.delete('/api/contact').set('Host', HOST),
      await agent.post('/api/contact/again').set('Host', HOST).type('form').send(encode(GOOD)),
    ]) {
      expect({ status: res.status, code: res.body.code }).toEqual({ status: 404, code: 'NOT_FOUND' });
    }
    expectPage(await agent.post('/api/contact/').set('Host', HOST).type('form').send(encode(GOOD)), 'sent');
    expectPage(await post(GOOD), 'sent');
  });
});

describe('memory', () => {
  it('a flood leaves nothing behind: only messages let through are remembered, so the limits bound the memory', async () => {
    let now = T0;
    const limiter = new ContactLimiter({ now: () => now });
    let accepted = 0;
    for (let i = 0; i < 50_000; i++) {
      if (limiter.take(`2001:db8:${(i >> 16).toString(16)}:${(i & 0xffff).toString(16)}::/64`) === null) accepted += 1;
    }
    expect(accepted).toBe(100);
    expect(limiter.size).toBe(100);
    expect(limiter.total()).toBe(100);
    // One address hammering: three time stamps, never more.
    now += DAY;
    limiter.sweep();
    expect(limiter.size).toBe(0);
    for (let i = 0; i < 10_000; i++) limiter.take('203.0.113.9');
    expect(limiter.size).toBe(1);
    expect(limiter.count('203.0.113.9')).toEqual({ hour: 3, day: 3 });
    expect(limiter.total()).toBe(3);
    limiter.stop();
    expect(limiter.size).toBe(0);

    // The same through the route, with a smaller day so that the test stays quick.
    const { post, sent, form } = await setup({ contact: { perDay: 20 } });
    for (let i = 0; i < 60; i++) await post(GOOD, { ip: `2001:db8:0:${i.toString(16)}::1` });
    for (let i = 0; i < 60; i++) await post({ ...GOOD, email: 'nobody' }, { ip: `2001:db8:1:${i.toString(16)}::1` });
    expect(sent).toHaveLength(20);
    expect(form.limiter.size).toBe(20);
  });

  it('nothing is kept longer than 24 hours - also when no request ever comes again (the timer), and never less', () => {
    vi.useFakeTimers({ now: T0 });
    const limiter = new ContactLimiter();
    expect(limiter.take('203.0.113.9')).toBeNull();
    vi.advanceTimersByTime(HOUR);
    expect(limiter.take('198.51.100.7')).toBeNull();
    expect(limiter.size).toBe(2);
    expect(vi.getTimerCount()).toBe(1);
    // One millisecond before the first message is a day old it is still there ...
    vi.advanceTimersByTime(23 * HOUR - 1);
    expect(limiter.size).toBe(2);
    // ... at 24 hours it is gone, without anybody asking; the second one an hour later.
    vi.advanceTimersByTime(1);
    expect(limiter.size).toBe(1);
    expect(limiter.count('203.0.113.9')).toEqual({ hour: 0, day: 0 });
    vi.advanceTimersByTime(HOUR - 1);
    expect(limiter.size).toBe(1);
    vi.advanceTimersByTime(1);
    expect(limiter.size).toBe(0);
    expect(limiter.total()).toBe(0);
    // Nothing remembered, nothing armed.
    expect(vi.getTimerCount()).toBe(0);
    // stop() takes the timer away with the counters.
    expect(limiter.take('203.0.113.9')).toBeNull();
    expect(vi.getTimerCount()).toBe(1);
    limiter.stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(limiter.size).toBe(0);
  });
});

describe('a slow mail server', () => {
  it('cannot pile work up: two messages at a time, the rest is turned away at once and not counted', async () => {
    const release: Array<() => void> = [];
    let calls = 0;
    const transport: SmtpTransport = {
      send: () =>
        new Promise<void>((resolve) => {
          calls += 1;
          release.push(resolve);
        }),
    };
    const { post, form, logs } = await setup({ transport });
    expect(CONTACT_MAX_SENDING).toBe(2);
    const send = (n: number) => post(GOOD, { ip: `203.0.113.${n}` }).then((res) => res);
    const first = send(1);
    const second = send(2);
    await until(() => form.sending() === 2, 'two messages at the mail server');
    // Six more while the mail server keeps the two waiting: answered at once.
    const turnedAway = await Promise.all([3, 4, 5, 6, 7, 8].map(send));
    for (const res of turnedAway) expectPage(res, 'error');
    expect(calls).toBe(2);
    expect(form.sending()).toBe(2);
    // Not counted: those six may write as soon as the mail server answers again.
    expect(form.limiter.size).toBe(2);
    expect(form.limiter.count('203.0.113.3')).toEqual({ hour: 0, day: 0 });
    // The two are still open - their answer is the truth about their message.
    let answered = 0;
    void first.then(() => (answered += 1));
    void second.then(() => (answered += 1));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(answered).toBe(0);
    for (const done of release.splice(0)) done();
    expectPage(await first, 'sent');
    expectPage(await second, 'sent');
    await form.idle();
    expect(form.sending()).toBe(0);
    // Room again.
    const third = send(3);
    await until(() => calls === 3, 'the third message at the mail server');
    for (const done of release.splice(0)) done();
    expectPage(await third, 'sent');
    expect(logs).toEqual(['contact form: refused (busy)', 'contact form: message sent', 'contact form: message sent', 'contact form: message sent']);
  });

  it('a send that fails late frees its place, and the visitor is told the truth', async () => {
    const fail: Array<(e: Error) => void> = [];
    const transport: SmtpTransport = { send: () => new Promise<void>((_resolve, reject) => void fail.push(reject)) };
    const { post, form, logs } = await setup({ transport });
    const pending = post(GOOD).then((res) => res);
    await until(() => form.sending() === 1, 'the message at the mail server');
    for (const reject of fail.splice(0)) reject(new SmtpError('server.mail.error.timeout', { host: 'smtp.mail.test', port: 465 }));
    expectPage(await pending, 'error');
    await form.idle();
    expect(form.sending()).toBe(0);
    expect(logs).toEqual(['contact form: not sent (server.mail.error.timeout)']);
  });
});

describe('when the form cannot send', () => {
  it('e-mail sending is not set up: "error" - the route is there, and answers in the language of the page', async () => {
    const { post, sent, logs, mail, form } = await setup({ mailSetUp: false });
    expect(mail.ready()).toBe(false);
    expectPage(await post({ ...GOOD, lang: 'ar' }), 'error', 'ar');
    expect(sent).toEqual([]);
    expect(form.limiter.size).toBe(0);
    expect(logs).toEqual(['contact form: refused (e-mail sending is not set up)']);
  });

  it('the switch (DIARY_CONTACT_FORM=off): "error", nothing sent - and still a 303, not a 404', async () => {
    const { post, sent, logs, form } = await setup({ contact: { enabled: false } });
    expectPage(await post({ ...GOOD, lang: 'ru' }), 'error', 'ru');
    expectPage(await post({ ...GOOD, website: 'x' }), 'sent');
    expect(sent).toEqual([]);
    expect(form.limiter.size).toBe(0);
    expect(logs).toEqual(['contact form: refused (switched off)', 'contact form: dropped (honeypot)']);
  });

  it('no contact address in legal/settings.json (null), or something that is not an address: "error"', async () => {
    for (const recipient of [null, 'not an address', 'owner@example.org\r\nBcc: other@example.net']) {
      const { post, sent, logs } = await setup({ contact: { recipient } });
      expectPage(await post(GOOD), 'error');
      expect(sent).toEqual([]);
      expect(logs).toEqual(['contact form: refused (no contact address)']);
    }
  });

  it('the mail server refuses or the transport breaks: "error", with the kind of failure in the log and nothing else', async () => {
    const failures: Array<[Error, string]> = [
      [new SmtpError('server.mail.error.rejected', { host: 'smtp.mail.test', port: 465, code: 550 }, 550), 'contact form: not sent (server.mail.error.rejected (SMTP 550))'],
      [new SmtpError('server.mail.error.authGmail', { host: 'smtp.mail.test', port: 465 }, 535), 'contact form: not sent (server.mail.error.authGmail (SMTP 535))'],
      [new Error('550 5.1.1 <dana@example.org> rejected: Hello Dana Cohen'), 'contact form: not sent (unexpected error)'],
    ];
    for (const [failure, line] of failures) {
      const { post, logs } = await setup({ transport: { send: async () => Promise.reject(failure) } });
      expectPage(await post({ ...GOOD, lang: 'ja' }), 'error', 'ja');
      expect(logs).toEqual([line]);
    }
  });
});

describe('the log and the disk', () => {
  /** Values no log line and no file may ever hold. */
  const SECRETS = ['Zebediah', 'Quixotesmith', 'zq.visitor@example.org', 'TOPSECRET-MESSAGE-TEXT', '198.51.100.77', 'evil-origin.example', 'fake-log-line'];

  it('every line is a fixed text: no name, address, message, client address or header of a request - and no line a visitor wrote', async () => {
    const personal: Record<string, string> = {
      firstName: 'Zebediah',
      lastName: 'Quixotesmith',
      email: 'zq.visitor@example.org',
      message: 'TOPSECRET-MESSAGE-TEXT\n[diary-server] fake-log-line',
      lang: 'he',
      website: '',
    };
    const ip = '198.51.100.77';
    const lines: string[] = [];
    const run = async (o: SetupOptions, requests: Array<[Fields | string, PostOptions]>) => {
      const s = await setup(o);
      for (const [fields, opts] of requests) expect((await s.post(fields, { ip, ...opts })).status).toBe(303);
      lines.push(...s.logs);
      return s;
    };
    const main = await run({}, [
      [personal, {}],
      [personal, {}],
      [personal, {}],
      [personal, {}],
      [{ ...personal, website: 'Zebediah fake-log-line' }, {}],
      [{ ...personal, firstName: 'Zebediah\n[diary-server] fake-log-line' }, {}],
      [{ ...personal, email: 'zq.visitor@example.org\r\n[diary-server] fake-log-line' }, {}],
      [personal, { headers: { Origin: 'https://evil-origin.example' } }],
      [personal, { headers: { Referer: 'https://evil-origin.example/Zebediah' } }],
      [{ ...personal, lang: 'he\n[diary-server] fake-log-line' }, {}],
      [`message=${'TOPSECRET-MESSAGE-TEXT'.repeat(4000)}`, {}],
    ]);
    await run({ contact: { enabled: false } }, [[personal, {}]]);
    await run({ contact: { recipient: null } }, [[personal, {}]]);
    await run({ mailSetUp: false }, [[personal, {}]]);
    await run({ contact: { perDay: 0 } }, [[personal, {}]]);
    await run({ contact: { maxSending: 0 } }, [[personal, {}]]);
    await run({ transport: { send: async () => Promise.reject(new SmtpError('server.mail.error.recipient', { host: 'smtp.mail.test', port: 465, code: 550 }, 550)) } }, [[personal, {}]]);
    await run({ transport: { send: async () => Promise.reject(new Error('Zebediah Quixotesmith <zq.visitor@example.org> TOPSECRET-MESSAGE-TEXT')) } }, [[personal, {}]]);
    // Something inside the server that nobody expected to fail (here: the mail service itself).
    const broken = {
      ready: (): boolean => {
        throw new Error('Zebediah Quixotesmith <zq.visitor@example.org> TOPSECRET-MESSAGE-TEXT');
      },
      send: async () => {},
    };
    await run({ contact: { mail: broken } }, [[personal, {}]]);

    // Every outcome the form knows was written at least once ...
    expect([...new Set(lines)].sort()).toEqual(
      [
        'contact form: dropped (honeypot)',
        'contact form: failed (unexpected error)',
        'contact form: message sent',
        'contact form: not sent (server.mail.error.recipient (SMTP 550))',
        'contact form: not sent (unexpected error)',
        'contact form: refused (another site)',
        'contact form: refused (busy)',
        'contact form: refused (daily limit of the server)',
        'contact form: refused (e-mail sending is not set up)',
        'contact form: refused (invalid input)',
        'contact form: refused (no contact address)',
        'contact form: refused (rate limit)',
        'contact form: refused (switched off)',
        'contact form: refused (unreadable request)',
      ].sort(),
    );
    // ... and none of them carries anything of a request.
    for (const line of lines) {
      expect(line).toMatch(/^contact form: [a-z]+(?: [a-z-]+)*(?: \([A-Za-z0-9 .()-]+\))?$/);
      for (const secret of SECRETS) expect(line.toLowerCase()).not.toContain(secret.toLowerCase());
    }
    expect(main.sent).toHaveLength(3);

    // Nothing of a message is stored: the data directory holds the mail settings and nothing a visitor wrote.
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else files.push(full);
      }
    };
    walk(main.config.dataDir);
    expect(files.map((f) => path.basename(f))).toContain('server-settings.json');
    for (const file of files) {
      const text = fs.readFileSync(file, 'latin1');
      for (const secret of SECRETS) expect({ file: path.basename(file), has: text.includes(secret) }).toEqual({ file: path.basename(file), has: false });
    }
  });

  it('a run of the same refusal is one line a minute, with the number left out; a sent message is always written', async () => {
    const { post, logs, clock } = await setup();
    for (let i = 0; i < 40; i++) await post({ ...GOOD, email: 'nobody' }, { ip: `198.51.100.${i + 1}` });
    for (let i = 0; i < 5; i++) await post(GOOD, { headers: { Origin: 'https://evil.example' } });
    expect(logs).toEqual(['contact form: refused (invalid input)', 'contact form: refused (another site)']);
    clock.now += 59_000;
    await post({ ...GOOD, email: 'nobody' });
    expect(logs).toHaveLength(2);
    clock.now += 1_000;
    await post({ ...GOOD, email: 'nobody' });
    expect(logs[2]).toBe('contact form: refused (invalid input) - and 40 more like it before');
    await post({ ...GOOD, email: 'nobody' });
    expect(logs).toHaveLength(3);
    // Sent messages are bounded by the limits and each one is written.
    for (let i = 0; i < 3; i++) await post(GOOD);
    expect(logs.slice(3)).toEqual(['contact form: message sent', 'contact form: message sent', 'contact form: message sent']);
  });

  it('a log that cannot be written changes no answer and ends no request in an exception', async () => {
    const failingLog = (): void => {
      throw new Error('the log is gone');
    };
    const { post, sent, form } = await setup({ contact: { log: failingLog } });
    expectPage(await post({ ...GOOD, lang: 'pl' }), 'sent', 'pl');
    expectPage(await post({ ...GOOD, email: 'nobody' }), 'error');
    expectPage(await post({ ...GOOD, website: 'x' }), 'sent');
    expectPage(await post(GOOD, { headers: { Origin: 'https://evil.example' } }), 'error');
    expectPage(await post(`message=${'a'.repeat(20_000)}`), 'error');
    await form.idle();
    expect(sent).toHaveLength(1);
  });
});

describe('where the form exists', () => {
  it('the local server has no such route: 404, whatever is posted', async () => {
    const local = await makeTestApp();
    for (const res of [
      await supertest(local.app).post('/api/contact').type('form').send(encode(GOOD)),
      await supertest(local.app).post('/api/contact').set('Origin', ORIGIN).type('form').send(encode({ ...GOOD, website: 'x' })),
      await supertest(local.app).get('/api/contact'),
    ]) {
      expect({ status: res.status, code: res.body.code, location: res.headers.location }).toEqual({ status: 404, code: 'NOT_FOUND', location: undefined });
    }
    // A hosted app that was built without the form has none either.
    const bare = await makeTestApp({ hosted: testHostedOptions() });
    const res = await supertest(bare.app).post('/api/contact').set('Host', HOST).type('form').send(encode(GOOD));
    expect({ status: res.status, code: res.body.code }).toEqual({ status: 404, code: 'NOT_FOUND' });
  });

  it('the desktop composition (startServer) answers 404 as well', async () => {
    const srv = await startServer(testConfig(), { port: 0, quiet: true, auth: FAST, mailTransport: { send: async () => {} } });
    desktops.push(srv);
    const res = await supertest(`http://127.0.0.1:${srv.port}`).post('/api/contact').type('form').send(encode(GOOD));
    expect({ status: res.status, code: res.body.code, location: res.headers.location }).toEqual({ status: 404, code: 'NOT_FOUND', location: undefined });
  });

  it('only the hosted composition loads the module, and the module imports no socket code and one field of legal/settings.json', () => {
    const src = path.join(ROOT, 'server', 'src');
    const importers: string[] = [];
    const walk = (dir: string): void => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (name.endsWith('.ts') && /from '(?:\.\.?\/)+(?:hosted\/)?contact'/.test(fs.readFileSync(full, 'utf8'))) importers.push(path.relative(src, full).split(path.sep).join('/'));
      }
    };
    walk(src);
    // app.ts gets the handler through HostedAppOptions: the desktop and Android bundles never carry the form.
    expect(importers).toEqual(['hosted.ts']);
    const source = fs.readFileSync(path.join(src, 'hosted', 'contact.ts'), 'utf8');
    const imports = [...source.matchAll(/^import [^;]* from '([^']+)';/gm)].map((m) => m[1]);
    expect(imports).toEqual(['express', '@shared/constants', '@shared/i18n', '../../../legal/settings.json', '../mail/errors', '../mail/mime', '../middleware/access']);
    expect(source).toContain("import { contactEmail } from '../../../legal/settings.json';");
    expect(source).not.toMatch(/node:(?:net|tls|http|https|dns|dgram)|\bfetch\(|require\(/);
    // Nothing of the request is ever written with console.*: the one log sink is the line builder.
    expect(source.match(/console\.\w+\(/g)).toEqual(['console.error(']);
  });

  it('bundled like the hosted server, the module carries the contact address and nothing else of legal/settings.json', async () => {
    const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'legal', 'settings.json'), 'utf8')) as Record<string, unknown>;
    // The bundler and the alias of scripts/build-hosted.mjs; nothing is written.
    const result = await build({
      entryPoints: [path.join(ROOT, 'server', 'src', 'hosted', 'contact.ts')],
      bundle: true,
      write: false,
      platform: 'node',
      target: 'node22',
      format: 'cjs',
      external: ['express'],
      alias: { '@shared': path.join(ROOT, 'shared') },
      logLevel: 'silent',
    });
    const bundle = result.outputFiles[0].text;
    // (Boolean checks: a failed toContain on the whole bundle would print megabytes.)
    expect(bundle.includes('legal/settings.json')).toBe(true);
    expect(bundle.includes('contactEmail')).toBe(true);
    if (typeof settings.contactEmail === 'string') expect(bundle.includes(`"${settings.contactEmail}"`)).toBe(true);
    const others = Object.keys(settings).filter((key) => key !== 'contactEmail');
    expect(others).toEqual(expect.arrayContaining(['publisherName', 'effectiveDate', 'termsEffectiveDate', 'minimumAge']));
    for (const key of others) expect({ key, inBundle: bundle.includes(key) }).toEqual({ key, inBundle: false });
    // The publisher's name is the one personal value of the file: it is not in the bundle either.
    const publisher = settings.publisherName;
    if (typeof publisher === 'string' && publisher.trim().length >= 4) expect(bundle.includes(publisher)).toBe(false);
  });
});

describe('the hosted composition (startHosted)', () => {
  async function boot(o: { env?: Record<string, string>; start?: HostedStartOptions } = {}) {
    const sent: Sent[] = [];
    const logs: string[] = [];
    const transport: SmtpTransport = { send: async (_opts, envelope, data) => void sent.push({ envelope: { ...envelope }, data }) };
    let ownerId = '';
    const env = loadHostedEnv({ DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: ORIGIN, DIARY_BIND: '127.0.0.1', DIARY_CLIENT_IP_HEADER: 'x-forwarded-for', ...o.env });
    const config = loadConfig(['--data-dir', tempDataDir()], { DIARY_MODE: 'hosted' });
    const srv = await startHosted(config, env, {
      port: 0,
      quiet: true,
      auth: FAST,
      mailTransport: transport,
      ownerId: () => ownerId,
      log: (line) => logs.push(line),
      contact: { recipient: RECIPIENT },
      ...o.start,
    });
    hosted.push(srv);
    const agent = supertest(srv.localUrl);
    const post = (fields: Fields, ip = '203.0.113.9') =>
      agent.post('/api/contact').set('Host', HOST).set('X-Forwarded-Proto', 'https').set('X-Forwarded-For', ip).set('Origin', ORIGIN).type('form').send(encode(fields));
    /** The owner registers and fills in the "E-mail" card, as he does in the app. */
    const setUpMail = async () => {
      const json = (url: string, body: object, token?: string) => {
        const request = agent.post(url).set('Host', HOST).set('X-Forwarded-Proto', 'https').set('X-Forwarded-For', '203.0.113.200').set('Accept-Language', 'en');
        return (token ? request.set('Authorization', `Bearer ${token}`) : request).send(body);
      };
      const reg = await json('/api/auth/register', { firstName: 'Test', lastName: 'Owner', username: 'ownertest', email: 'ownertest@example.com', password: PASSWORD, confirmPassword: PASSWORD, privacyAccepted: true, termsAccepted: true });
      expect(reg.status).toBe(201);
      const owner = reg.body as AuthResponse;
      ownerId = owner.user.id;
      const saved = await agent
        .put('/api/server/mail')
        .set('Host', HOST)
        .set('X-Forwarded-Proto', 'https')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ enabled: true, host: 'smtp.mail.test', port: 465, security: 'tls', username: SENDER, smtpPassword: SMTP_SECRET, password: PASSWORD });
      expect(saved.status).toBe(200);
    };
    return { srv, sent, logs, agent, post, setUpMail };
  }

  it('the form is wired to the Mail card and to DIARY_PUBLIC_URL: no mail settings -> "error"; set up -> one e-mail to the contact address', async () => {
    const { srv, sent, logs, agent, post, setUpMail } = await boot();
    expect(srv.env.contactForm).toBe(true);
    // Before the owner filled in the "E-mail" card there is nothing to send with.
    expectPage(await post({ ...GOOD, lang: 'he' }), 'error', 'he');
    await setUpMail();
    const res = await post({ ...GOOD, lang: 'he' });
    expectPage(res, 'sent', 'he');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['cache-control']).toBe('no-store');
    expect(sent).toHaveLength(1);
    expect(sent[0].envelope).toEqual({ from: SENDER, to: RECIPIENT });
    expect(headersOf(sent[0].data)['reply-to']).toBe('<dana@example.org>');
    expect(srv.contact.limiter.count('203.0.113.9')).toEqual({ hour: 1, day: 1 });
    // The origin that counts is the public address, not the listener's.
    expectPage(await agent.post('/api/contact').set('Host', HOST).set('Origin', srv.localUrl).type('form').send(encode(GOOD)), 'error');
    // The production limits: the fourth message of an address within the hour.
    expectPage(await post(GOOD), 'sent');
    expectPage(await post(GOOD), 'sent');
    expectPage(await post(GOOD), 'error');
    expect(sent).toHaveLength(3);
    expect(logs.filter((line) => line.startsWith('contact form: '))).toEqual([
      'contact form: refused (e-mail sending is not set up)',
      'contact form: message sent',
      'contact form: refused (another site)',
      'contact form: message sent',
      'contact form: message sent',
      'contact form: refused (rate limit)',
    ]);
    // The API next to it is untouched: JSON in, JSON out.
    const login = await agent.post('/api/auth/login').set('Host', HOST).set('X-Forwarded-For', '203.0.113.200').send({ username: 'ownertest', password: PASSWORD });
    expect(login.status).toBe(200);
    await srv.stop();
    expect(srv.contact.limiter.size).toBe(0);
  });

  it('DIARY_CONTACT_FORM=off: the route stays and answers "error"; nothing is sent', async () => {
    const { srv, sent, logs, post, setUpMail } = await boot({ env: { DIARY_CONTACT_FORM: 'off' } });
    expect(srv.env.contactForm).toBe(false);
    await setUpMail();
    expectPage(await post({ ...GOOD, lang: 'fr' }), 'error', 'fr');
    expect(sent).toEqual([]);
    expect(logs).toContain('contact form: refused (switched off)');
  });

  it('a body sent in chunks without a length is cut off at 64 KB by the real listener too', async () => {
    const { srv, sent, setUpMail } = await boot();
    await setUpMail();
    const answer = await new Promise<{ status: number; location: string | undefined }>((resolve, reject) => {
      const request = http.request(
        { host: '127.0.0.1', port: srv.port, method: 'POST', path: '/api/contact', headers: { Host: HOST, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': '203.0.113.9' } },
        (res) => {
          res.resume();
          res.on('end', () => resolve({ status: res.statusCode ?? 0, location: res.headers.location }));
        },
      );
      request.on('error', reject);
      request.write(`${encode(GOOD)}&message2=`);
      // 80 KB after the form, in ten pieces.
      for (let i = 0; i < 10; i++) request.write('a'.repeat(8 * 1024));
      request.end();
    });
    expect(answer).toEqual({ status: 303, location: '/about/contact/error/' });
    expect(sent).toEqual([]);
  });
});
