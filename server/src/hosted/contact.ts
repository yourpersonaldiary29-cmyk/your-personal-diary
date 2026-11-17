/**
 * The contact form of the public site (docs/site-tasks/SITE.md section 5): `POST /api/contact`.
 *
 * Every page of the site (/about/...) ends with a plain HTML form - first name, last name, e-mail
 * address, message - that posts here as `application/x-www-form-urlencoded`. This module turns one
 * such request into ONE e-mail to the contact address of legal/settings.json, with the visitor's
 * address as Reply-To, and answers - always - with a 303 to one of the site's two result pages:
 *
 *   /about/[<lang>/]contact/sent/     the message was handed to the mail server (or a robot was let go)
 *   /about/[<lang>/]contact/error/    anything else
 *
 * How it is used: the hosted composition (hosted.ts) builds the handler with `createContactForm` and
 * app.ts mounts it at /api/contact (`HostedAppOptions.contact`), behind the Host check and the
 * security headers. Hosted mode only - the desktop and Android bundles never load this file, and the
 * local server answers 404. No session, no cookie, no JSON: the route brings its own form parser.
 *
 * A public form that sends mail is something people try to abuse. The checks, in their order:
 *   1. the body: 64 KB at most, urlencoded only, never inflated, a handful of fields -> "error";
 *   2. the honeypot field `website` (hidden from people) is filled -> "sent", and nothing is sent -
 *      whatever else the request holds: a robot is never told that it was noticed;
 *   3. the fields: trimmed, length limits, no control characters, one-line names, an address that
 *      passes `isMailAddress` -> "error";
 *   4. another site: a browser that says the form was posted from somewhere else (`Sec-Fetch-Site`,
 *      `Origin`, else `Referer`; `Origin: null` without `Sec-Fetch-Site: same-origin`) -> "error". A
 *      request that says nothing of it is accepted - a client that is no browser can claim anything
 *      anyway, and the limits below are what holds;
 *   5. the switch `DIARY_CONTACT_FORM=off`, no contact address, e-mail sending not set up -> "error";
 *   6. `CONTACT_MAX_SENDING` messages already on their way to the mail server -> "error" (a slow
 *      mail server cannot make work pile up);
 *   7. the limits, in memory only: 3 messages per address bucket per hour and 10 per day, 100 per
 *      day for the whole server (`ContactLimiter`) -> "error";
 *   8. the e-mail, through the mail service (this file imports no socket code): failed -> "error".
 *
 * Nothing of a message is stored or logged. The log gets one line per outcome: a fixed text without
 * any value of the request ("contact form: message sent", "contact form: refused (rate limit)", ...).
 * A run of the same refusal is written once a minute with the number left out, so a flood cannot
 * fill the log. The `Location` of the answer is one of 40 constants built from the list of locales:
 * no value of a request ever reaches a header.
 */
import express, { type Request, type RequestHandler, type Response } from 'express';
import { APP_NAME } from '@shared/constants';
import { DEFAULT_LOCALE, LOCALE_CODES, localeDef, type Locale } from '@shared/i18n';
import { contactEmail } from '../../../legal/settings.json';
import { isSmtpError, mailFailureTag } from '../mail/errors';
import { isMailAddress, type MailContent } from '../mail/mime';
import { clientIp, limiterKey } from '../middleware/access';

/**
 * Body limit of this route - and of this route only (the JSON routes have their own: app.ts). A browser
 * writes every byte of a non-ASCII character as %XX, so the longest form the page allows - 5000
 * characters of Chinese, Japanese, Hindi or Thai (9 bytes each), two names of 80 and an address of 254 -
 * is about 46.8 KB on the wire. The field limits below are the real guards; this one only has to stay
 * above that form.
 */
export const CONTACT_BODY_LIMIT = '64kb';
/** Fields one request may carry (the form has six); more than this is not the form. */
export const CONTACT_PARAMETER_LIMIT = 12;
/** Longest first name and last name, in characters as the form's `maxlength` counts them. */
export const CONTACT_NAME_MAX = 80;
/** Longest e-mail address. */
export const CONTACT_EMAIL_MAX = 254;
/** Longest message, in characters as the form's `maxlength` counts them (a line break is one). */
export const CONTACT_MESSAGE_MAX = 5000;
/** Longest subject line ("Contact form: <first> <last>"), in characters. */
export const CONTACT_SUBJECT_MAX = 120;
/** The field no person sees; only a robot fills it. */
export const CONTACT_HONEYPOT_FIELD = 'website';
/** Messages one address bucket may send per hour / per day, and all addresses together per day. */
export const CONTACT_PER_ADDRESS_PER_HOUR = 3;
export const CONTACT_PER_ADDRESS_PER_DAY = 10;
export const CONTACT_PER_DAY = 100;
/** Messages that may be on their way to the mail server at the same moment. */
export const CONTACT_MAX_SENDING = 2;
/** Longest key the limiter remembers for an address (an IPv6 bucket has 24 characters at most). */
export const CONTACT_ADDRESS_KEY_MAX = 64;

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
/** The same refusal is written to the log at most this often. */
const REFUSAL_LOG_EVERY_MS = 60_000;

// Where the answer leads ---------------------------------------------------------------------------

/** The two result pages of the site. */
export type ContactOutcome = 'sent' | 'error';

/** Where the site lives on this server (SITE.md section 1). */
const SITE_BASE = '/about/';

/**
 * The 40 targets, built once from the app's locales (English has no language folder). A request
 * only ever chooses among them.
 */
const TARGETS: ReadonlyMap<string, Readonly<Record<ContactOutcome, string>>> = new Map(
  LOCALE_CODES.map((code) => {
    const folder = code === DEFAULT_LOCALE ? SITE_BASE : `${SITE_BASE}${code}/`;
    return [code, Object.freeze({ sent: `${folder}contact/sent/`, error: `${folder}contact/error/` })] as const;
  }),
);

/** The locale of the page the form was on: the `lang` field when it is one of the 20, else English. */
export function contactLocale(lang: unknown): Locale {
  return typeof lang === 'string' && TARGETS.has(lang) ? (lang as Locale) : DEFAULT_LOCALE;
}

/** The `Location` of the answer: `/about/[<lang>/]contact/<outcome>/`. */
export function contactRedirect(lang: unknown, outcome: ContactOutcome): string {
  return (TARGETS.get(contactLocale(lang)) as Readonly<Record<ContactOutcome, string>>)[outcome];
}

// The recipient ------------------------------------------------------------------------------------

/**
 * Where the messages go: `contactEmail` of legal/settings.json - the one place where the owner sets
 * it, and the address the site prints next to the form. Only that field is imported (a named import
 * of one JSON field, as shared/legal.ts does with its two dates), so the bundle carries nothing else
 * of the file. null while it is not set, or is not an address: the form then answers "error".
 */
export function contactRecipient(value: unknown = contactEmail): string | null {
  if (typeof value !== 'string') return null;
  const address = value.trim();
  return isMailAddress(address) ? address : null;
}

// The fields ---------------------------------------------------------------------------------------

/** A message that passed every check of the fields. */
export interface ContactMessage {
  firstName: string;
  lastName: string;
  email: string;
  /** Line ends are `\n`. */
  message: string;
}

type Fields = Record<string, unknown>;

/** The parsed form of a request ({} when there is none: no body, or a body that is not a form). */
function fieldsOf(req: Request): Fields {
  const body: unknown = req.body;
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Fields) : {};
}

/** A field of the form itself - never something inherited from the object's prototype. */
function own(fields: Fields, name: string): unknown {
  return Object.hasOwn(fields, name) ? fields[name] : undefined;
}

/** Control characters (C0, DEL, C1): never in a one-line field. */
const ONE_LINE_FORBIDDEN = /[\u0000-\u001f\u007f-\u009f]/;
/** The Unicode line and paragraph separators (U+2028, U+2029) end a line as well. Given by number on purpose. */
const LINE_SEPARATORS = [String.fromCharCode(0x2028), String.fromCharCode(0x2029)];
/** Control characters that are no text in a message either (a tab and a line feed are). */
const MESSAGE_FORBIDDEN = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/;

/** A trimmed one-line value of 1..`max` characters, or null. A field sent twice arrives as a list: null. */
function oneLine(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > max || ONE_LINE_FORBIDDEN.test(text) || LINE_SEPARATORS.some((ch) => text.includes(ch))) return null;
  return text;
}

/** The four fields of the form when every one of them is acceptable, else null. */
export function parseContactFields(fields: Record<string, unknown>): ContactMessage | null {
  const firstName = oneLine(own(fields, 'firstName'), CONTACT_NAME_MAX);
  const lastName = oneLine(own(fields, 'lastName'), CONTACT_NAME_MAX);
  const email = oneLine(own(fields, 'email'), CONTACT_EMAIL_MAX);
  const raw = own(fields, 'message');
  if (!firstName || !lastName || !email || !isMailAddress(email) || typeof raw !== 'string') return null;
  // A browser sends the line breaks of a textarea as CR LF and counts each as one character.
  const message = raw.replace(/\r\n?/g, '\n').trim();
  if (!message || message.length > CONTACT_MESSAGE_MAX || MESSAGE_FORBIDDEN.test(message)) return null;
  return { firstName, lastName, email, message };
}

/** True when the hidden field carries anything at all. */
function honeypotFilled(fields: Fields): boolean {
  const value = own(fields, CONTACT_HONEYPOT_FIELD);
  return typeof value === 'string' ? value.trim() !== '' : value !== undefined;
}

// Another site -------------------------------------------------------------------------------------

/**
 * `scheme://host[:port]` of an Origin or Referer value (lower case, default port dropped, and without a
 * trailing dot on the name: https://diary.example./ is the host https://diary.example/ - the Host check
 * takes it that way too, middleware/hosted-host.ts); '' when it has none.
 */
function originOf(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    const name = url.hostname.endsWith('.') ? url.hostname.slice(0, -1) : url.hostname;
    return `${url.protocol}//${name}${url.port ? `:${url.port}` : ''}`;
  } catch {
    return '';
  }
}

/** The origins the site is served from: the public URL, and the owner's own domain when one is connected. */
function ownOrigins(publicUrl: string, extraHosts: readonly string[]): ReadonlySet<string> {
  const origins = new Set<string>();
  const primary = originOf(publicUrl);
  if (primary) origins.add(primary);
  // The extra hosts are DNS names without a port, served by the same TLS edge (config.ts parseExtraHosts).
  for (const host of extraHosts) origins.add(`https://${host.toLowerCase()}`);
  return origins;
}

function headerOf(req: Request, name: string): string {
  const raw = req.headers[name];
  return (Array.isArray(raw) ? raw.join(', ') : (raw ?? '')).trim();
}

/**
 * True when a browser says the form was not posted from a page of this site.
 *
 *   - `Sec-Fetch-Site` (every current browser sends it, and a page cannot change it): anything but
 *     `same-origin` is another site;
 *   - `Origin` with a value: it must be one of the site's own origins;
 *   - `Origin: null`: another site, unless `Sec-Fetch-Site: same-origin` came with it;
 *   - no Origin, or `null` with `Sec-Fetch-Site: same-origin`: the `Referer`, when there is one,
 *     decides the same way.
 *
 * Every page of the site carries `<meta name="referrer" content="same-origin">` (the server's own
 * `Referrer-Policy: no-referrer` would make a browser write `null`), so a browser posts the form
 * from our pages with their real origin. `null` is what it writes for a post from a page that hides
 * where it is (another site with `no-referrer`, a sandboxed frame); only Sec-Fetch-Site, which a
 * page cannot set, can still say that such a post came from this origin. Nothing at all = accepted.
 */
function fromAnotherSite(req: Request, origins: ReadonlySet<string>): boolean {
  const site = headerOf(req, 'sec-fetch-site').toLowerCase();
  if (site && site !== 'same-origin') return true;
  const origin = headerOf(req, 'origin');
  const hidden = origin.toLowerCase() === 'null';
  if (hidden && site !== 'same-origin') return true;
  if (origin && !hidden) return !origins.has(originOf(origin));
  const referer = headerOf(req, 'referer');
  return referer !== '' && !origins.has(originOf(referer));
}

// The limits ---------------------------------------------------------------------------------------

/** Which limit refused a message: the sender's address bucket, or the whole server's day. */
export type ContactLimit = 'address' | 'server';

export interface ContactLimiterOptions {
  perAddressPerHour?: number;
  perAddressPerDay?: number;
  perDay?: number;
  now?: () => number;
}

/**
 * The three limits of the form, in memory only: sliding windows of one hour and one day per address
 * bucket, and of one day for all addresses together.
 *
 * Only messages that were let through are remembered - a refused request leaves nothing behind. So
 * the memory is bounded by the limits themselves: never more than `perDay` time stamps and never
 * more than `perDay` addresses, whatever the number of callers. No time stamp is kept longer than 24
 * hours, and an address bucket goes with its last one (24 hours after its last counted message): every
 * look sweeps first, and while anything is remembered a timer (unref'd - it never keeps the process
 * alive) sweeps at the moment the oldest entry runs out, also when no request comes.
 */
export class ContactLimiter {
  readonly perAddressPerHour: number;
  readonly perAddressPerDay: number;
  readonly perDay: number;
  private readonly now: () => number;
  /** Address bucket -> the times of its counted messages, oldest first. */
  private readonly byAddress = new Map<string, number[]>();
  /** The times of all counted messages, oldest first. */
  private all: number[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: ContactLimiterOptions = {}) {
    this.perAddressPerHour = opts.perAddressPerHour ?? CONTACT_PER_ADDRESS_PER_HOUR;
    this.perAddressPerDay = opts.perAddressPerDay ?? CONTACT_PER_ADDRESS_PER_DAY;
    this.perDay = opts.perDay ?? CONTACT_PER_DAY;
    this.now = opts.now ?? Date.now;
  }

  /** Counts one message of `address` - unless a limit is reached: then nothing is counted and the limit is named. */
  take(address: string): ContactLimit | null {
    const t = this.now();
    this.sweep(t);
    const times = this.byAddress.get(address) ?? [];
    const lastHour = times.filter((x) => t - x < HOUR_MS).length;
    if (lastHour >= this.perAddressPerHour || times.length >= this.perAddressPerDay) return 'address';
    if (this.all.length >= this.perDay) return 'server';
    times.push(t);
    this.byAddress.set(address, times);
    this.all.push(t);
    this.arm();
    return null;
  }

  /** Messages counted for `address` in the last hour and the last day (tests, diagnostics). */
  count(address: string): { hour: number; day: number } {
    const t = this.now();
    const times = (this.byAddress.get(address) ?? []).filter((x) => t - x < DAY_MS);
    return { hour: times.filter((x) => t - x < HOUR_MS).length, day: times.length };
  }

  /** Messages counted for the whole server in the last day. */
  total(): number {
    const t = this.now();
    return this.all.filter((x) => t - x < DAY_MS).length;
  }

  /** Address buckets remembered right now. */
  get size(): number {
    return this.byAddress.size;
  }

  /** Forgets everything that is a day old. */
  sweep(t: number = this.now()): void {
    if (this.all.length && t - this.all[0] >= DAY_MS) this.all = this.all.filter((x) => t - x < DAY_MS);
    for (const [address, times] of this.byAddress) {
      if (t - times[0] < DAY_MS) continue;
      const kept = times.filter((x) => t - x < DAY_MS);
      if (kept.length) this.byAddress.set(address, kept);
      else this.byAddress.delete(address);
    }
  }

  /** Forgets everything and stops the timer (shutdown). */
  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.byAddress.clear();
    this.all = [];
  }

  /** One timer at a time, for the moment the oldest remembered message is a day old. */
  private arm(): void {
    if (this.timer || !this.all.length) return;
    const wait = Math.max(0, this.all[0] + DAY_MS - this.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      this.sweep();
      this.arm();
    }, wait);
    this.timer.unref?.();
  }
}

// The e-mail ---------------------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * "Contact form: <first> <last>", cut to CONTACT_SUBJECT_MAX characters without splitting one.
 * A name is text, never an RFC 2047 encoded word: "=?" - the two characters such a word starts with -
 * is written "= ?", so no mail program decodes something a visitor typed into the subject.
 */
export function contactSubject(firstName: string, lastName: string): string {
  const chars = Array.from(`Contact form: ${firstName} ${lastName}`.replace(/=\?/g, '= ?'));
  return chars.length > CONTACT_SUBJECT_MAX ? `${chars.slice(0, CONTACT_SUBJECT_MAX - 3).join('')}...` : chars.join('');
}

/**
 * The e-mail of one message, for the operator: the two names, the address, the language of the page
 * the form was on, the time (UTC) and the message - as plain text and as a small HTML page in which
 * every value is escaped and nothing is a link. `Reply-To` is the visitor, so "Reply" answers him.
 * The header values go through the encoders of mail/mime.ts when the message is built.
 */
export function contactEmailContent(to: string, message: ContactMessage, locale: Locale, at: Date): MailContent {
  const subject = contactSubject(message.firstName, message.lastName);
  const intro = 'A message from the contact form of the website.';
  const hint = 'To answer, use "Reply": the answer goes to the e-mail address above.';
  const lines: Array<[string, string]> = [
    ['First name', message.firstName],
    ['Last name', message.lastName],
    ['E-mail', message.email],
    ['Page language', `${localeDef(locale).englishName} (${locale})`],
    ['Time (UTC)', at.toISOString().slice(0, 19).replace('T', ' ')],
  ];
  const text = [intro, '', ...lines.map(([label, value]) => `${label}: ${value}`), '', 'Message:', '', message.message, '', hint, '', APP_NAME, ''].join('\n');
  const html =
    `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:24px;background:#f6f6f4;color:#222;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;">` +
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;">` +
    `<p style="margin:0 0 14px;">${escapeHtml(intro)}</p>` +
    lines.map(([label, value]) => `<p style="margin:0 0 4px;"><strong>${escapeHtml(label)}:</strong> <bdi>${escapeHtml(value)}</bdi></p>`).join('') +
    `<p style="margin:14px 0 4px;"><strong>Message:</strong></p>` +
    `<div dir="auto" style="margin:0 0 14px;">${escapeHtml(message.message).replace(/\n/g, '<br>\n')}</div>` +
    `<p style="margin:0 0 14px;font-size:13px;color:#555;">${escapeHtml(hint)}</p>` +
    `<p style="margin:24px 0 0;font-weight:bold;">${escapeHtml(APP_NAME)}</p></div></body></html>`;
  return { to, replyTo: message.email, subject, text, html };
}

// The route ----------------------------------------------------------------------------------------

/** What the form needs from the mail service (mail/service.ts). */
export interface ContactMailer {
  ready(): boolean;
  send(content: MailContent): Promise<void>;
}

export interface ContactFormOptions {
  mail: ContactMailer;
  /** The public origin of the server (`DIARY_PUBLIC_URL`): the origin a browser posts the form from. */
  publicUrl: string;
  /** Further host names the site answers to (`DIARY_EXTRA_HOSTS`, the owner's own domain). */
  extraHosts?: readonly string[];
  /** `DIARY_CONTACT_FORM`: false = every message is answered "error" and nothing is sent. Default: on. */
  enabled?: boolean;
  /** The recipient; default: `contactEmail` of legal/settings.json. null = none: every message is answered "error". */
  recipient?: string | null;
  perAddressPerHour?: number;
  perAddressPerDay?: number;
  perDay?: number;
  /** Messages on their way to the mail server at the same moment (default CONTACT_MAX_SENDING). */
  maxSending?: number;
  /** Clock of the limits and of the time written into the e-mail (tests). */
  now?: () => number;
  /** Log line sink (default: stderr). It never gets a value of a request. */
  log?: (line: string) => void;
}

export interface ContactForm {
  /** Mounted at /api/contact: answers `POST /api/contact`, passes every other request on. */
  handler: RequestHandler;
  limiter: ContactLimiter;
  /** Messages on their way to the mail server right now. */
  sending(): number;
  /** Resolves when no request is being worked on (tests, shutdown). */
  idle(): Promise<void>;
  /** Forgets the counters and stops their timer (shutdown). */
  stop(): void;
}

/**
 * The log of the form: `always` lines (a message sent or not sent - the limits bound their number)
 * are written every time; a refusal is written at once, and the same refusal again only after
 * REFUSAL_LOG_EVERY_MS, with the number left out in between. The texts are constants of this file.
 * A sink that throws changes nothing: the visitor still gets his answer, and no request ends in an
 * exception.
 */
function outcomeLog(log: (line: string) => void, now: () => number): (text: string, always?: boolean) => void {
  const refusals = new Map<string, { at: number; skipped: number }>();
  const write = (line: string): void => {
    try {
      log(line);
    } catch {
      /* a log that cannot be written is no reason to fail a request */
    }
  };
  return (text, always = false) => {
    if (always) return write(`contact form: ${text}`);
    const t = now();
    const last = refusals.get(text);
    if (last && t >= last.at && t - last.at < REFUSAL_LOG_EVERY_MS) {
      last.skipped += 1;
      return;
    }
    write(`contact form: ${text}${last?.skipped ? ` - and ${last.skipped} more like it before` : ''}`);
    refusals.set(text, { at: t, skipped: 0 });
  };
}

export function createContactForm(opts: ContactFormOptions): ContactForm {
  const now = opts.now ?? Date.now;
  const say = outcomeLog(opts.log ?? ((line: string) => console.error(`[diary-server] ${line}`)), now);
  const enabled = opts.enabled !== false;
  const recipient = opts.recipient === undefined ? contactRecipient() : contactRecipient(opts.recipient);
  const origins = ownOrigins(opts.publicUrl, opts.extraHosts ?? []);
  const maxSending = opts.maxSending ?? CONTACT_MAX_SENDING;
  const limiter = new ContactLimiter({
    ...(opts.perAddressPerHour !== undefined ? { perAddressPerHour: opts.perAddressPerHour } : {}),
    ...(opts.perAddressPerDay !== undefined ? { perAddressPerDay: opts.perAddressPerDay } : {}),
    ...(opts.perDay !== undefined ? { perDay: opts.perDay } : {}),
    now,
  });
  const working = new Set<Promise<void>>();
  let sending = 0;

  // For this route only: a form body of at most 64 KB, as it is (a compressed body is refused), with a
  // handful of fields. Any failure of the parser arrives in the callback below, never at the app's
  // JSON error handler.
  const parseForm = express.urlencoded({ extended: false, inflate: false, limit: CONTACT_BODY_LIMIT, parameterLimit: CONTACT_PARAMETER_LIMIT });

  const refuse = (why: string): ContactOutcome => {
    say(`refused (${why})`);
    return 'error';
  };

  /** What one request leads to. The order is the one of the file comment. */
  async function decide(req: Request, fields: Fields): Promise<ContactOutcome> {
    if (honeypotFilled(fields)) {
      say('dropped (honeypot)');
      return 'sent';
    }
    const message = parseContactFields(fields);
    if (!message) return refuse('invalid input');
    if (fromAnotherSite(req, origins)) return refuse('another site');
    if (!enabled) return refuse('switched off');
    if (!recipient) return refuse('no contact address');
    if (!opts.mail.ready()) return refuse('e-mail sending is not set up');
    // Before the limits: a message that is turned away here does not use up the sender's hour.
    if (sending >= maxSending) return refuse('busy');
    // The bucket of the real client, exactly as the other limiters of the hosted server take it.
    const limit = limiter.take(limiterKey(clientIp(req)).slice(0, CONTACT_ADDRESS_KEY_MAX));
    if (limit) return refuse(limit === 'address' ? 'rate limit' : 'daily limit of the server');
    // Counted from here on, whatever the mail server says: a failing server is not a way around the limits.
    sending += 1;
    try {
      await opts.mail.send(contactEmailContent(recipient, message, contactLocale(own(fields, 'lang')), new Date(now())));
      say('message sent', true);
      return 'sent';
    } catch (e) {
      // The catalogue key and the SMTP code only - never the text of a failure.
      say(`not sent (${isSmtpError(e) ? mailFailureTag(e) : 'unexpected error'})`, true);
      return 'error';
    } finally {
      sending -= 1;
    }
  }

  /** Always a 303 to one of the fixed pages. */
  const answer = (res: Response, lang: unknown, outcome: ContactOutcome): void => {
    try {
      if (!res.headersSent) res.redirect(303, contactRedirect(lang, outcome));
    } catch {
      /* the visitor went away while the mail server was answering */
    }
  };

  const router = express.Router();
  router.post('/', (req: Request, res: Response) => {
    parseForm(req, res, (parseError?: unknown) => {
      if (parseError) {
        // Too large, compressed, another charset, too many fields, cut off: the page language is unknown too.
        answer(res, undefined, refuse('unreadable request'));
        return;
      }
      const fields = fieldsOf(req);
      const lang = own(fields, 'lang');
      const work = decide(req, fields)
        .catch((): ContactOutcome => {
          say('failed (unexpected error)');
          return 'error';
        })
        .then((outcome) => answer(res, lang, outcome));
      working.add(work);
      void work.finally(() => working.delete(work));
    });
  });

  return {
    handler: router,
    limiter,
    sending: () => sending,
    idle: async () => {
      while (working.size) await Promise.all([...working]);
    },
    stop: () => limiter.stop(),
  };
}
