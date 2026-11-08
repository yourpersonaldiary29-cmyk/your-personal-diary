/**
 * MIME message builder for the SMTP client (RFC 5322 / 2045 / 2046 / 2047) - no dependencies.
 *
 *   From: Your Personal Diary <sender@example.com>
 *   To: user@example.com
 *   Subject: =?UTF-8?B?...?=                 (RFC 2047 encoded-words, split on character boundaries)
 *   Date: Tue, 29 Sep 2026 10:00:00 +0000
 *   Message-ID: <random@sender-domain>
 *   MIME-Version: 1.0
 *   Content-Type: multipart/alternative; boundary="..."
 *     text/plain; charset=UTF-8 (base64)  +  text/html; charset=UTF-8 (base64)
 *
 * Addresses are validated before they reach a header (no CR/LF, no angle brackets), so a
 * user-supplied value can never inject a header. `dotStuff` prepares the DATA section.
 */
import { randomBytes } from 'node:crypto';

/** Display name of every e-mail the app sends (the brand, never translated). */
export const MAIL_FROM_NAME = 'Your Personal Diary';

/** Shape check of an e-mail address that is safe to put in a header / SMTP command. */
const ADDRESS_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

/** True when `address` can be used as a sender / recipient (plain addr-spec, ASCII domain, <= 254 characters). */
export function isMailAddress(address: string): boolean {
  return typeof address === 'string' && address.length <= 254 && !/[\r\n\0]/.test(address) && ADDRESS_PATTERN.test(address);
}

/** The domain of an address ('a@b.org' -> 'b.org'). */
export function domainOf(address: string): string {
  const at = address.lastIndexOf('@');
  return at >= 0 ? address.slice(at + 1).toLowerCase() : 'localhost';
}

export interface MailContent {
  to: string;
  subject: string;
  /** Plain-text body (UTF-8). */
  text: string;
  /** HTML body (UTF-8, a complete small document). */
  html: string;
}

export interface BuiltMessage {
  /** The message (headers + body) with CRLF line ends, before dot-stuffing. */
  data: string;
  messageId: string;
}

/** Characters allowed unencoded in a header value. */
function isPlainHeaderText(s: string): boolean {
  return /^[\x20-\x7e]*$/.test(s);
}

/**
 * RFC 2047 'B' encoding of a header value, split into encoded-words of at most 75 characters
 * without cutting a UTF-8 sequence (each word decodes on its own). ASCII values are returned as-is.
 */
export function encodeHeaderWords(value: string): string {
  const clean = value.replace(/[\r\n]+/g, ' ');
  if (isPlainHeaderText(clean)) return clean;
  const prefix = '=?UTF-8?B?';
  const suffix = '?=';
  // 75 - 12 (prefix + suffix) = 63 base64 characters -> at most 45 bytes (15 groups of 3) per word.
  const maxBytes = 45;
  const words: string[] = [];
  let chunk = '';
  let chunkBytes = 0;
  for (const ch of clean) {
    const n = Buffer.byteLength(ch, 'utf8');
    if (chunkBytes + n > maxBytes && chunk) {
      words.push(prefix + Buffer.from(chunk, 'utf8').toString('base64') + suffix);
      chunk = '';
      chunkBytes = 0;
    }
    chunk += ch;
    chunkBytes += n;
  }
  if (chunk) words.push(prefix + Buffer.from(chunk, 'utf8').toString('base64') + suffix);
  // Folded with CRLF + space; whitespace between adjacent encoded-words is ignored by decoders.
  return words.join('\r\n ');
}

/** Base64 of UTF-8 text, wrapped at 76 characters (RFC 2045). */
export function base64Body(text: string): string {
  const b64 = Buffer.from(text, 'utf8').toString('base64');
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
  return lines.join('\r\n');
}

/** RFC 5322 date with a numeric zone: 'Tue, 29 Sep 2026 10:00:00 +0000'. */
export function rfc5322Date(d: Date): string {
  return d.toUTCString().replace(/GMT$/, '+0000');
}

/** Normalises every line end to CRLF. */
export function toCrlf(s: string): string {
  return s.replace(/\r\n|\r|\n/g, '\r\n');
}

/**
 * SMTP transparency (RFC 5321 4.5.2): a line that starts with '.' gets one more '.', so the
 * server never mistakes it for the end of DATA. Input uses CRLF line ends.
 */
export function dotStuff(data: string): string {
  return data.replace(/(^|\r\n)\./g, '$1..');
}

/** Builds the complete message. Throws when an address is not safe for a header. */
export function buildMessage(from: string, content: MailContent, now: Date = new Date()): BuiltMessage {
  if (!isMailAddress(from)) throw new Error('invalid sender address');
  if (!isMailAddress(content.to)) throw new Error('invalid recipient address');
  const boundary = `mpd_${randomBytes(12).toString('hex')}`;
  const messageId = `<${randomBytes(16).toString('hex')}@${domainOf(from)}>`;
  const headers = [
    `From: "${MAIL_FROM_NAME}" <${from}>`,
    `To: <${content.to}>`,
    `Subject: ${encodeHeaderWords(content.subject)}`,
    `Date: ${rfc5322Date(now)}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    // Automatic mail: no out-of-office replies to it (RFC 3834).
    'Auto-Submitted: auto-generated',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const part = (type: string, body: string) =>
    [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', base64Body(toCrlf(body))].join('\r\n');
  const data = [headers.join('\r\n'), '', part('text/plain', content.text), part('text/html', content.html), `--${boundary}--`, ''].join('\r\n');
  return { data, messageId };
}
