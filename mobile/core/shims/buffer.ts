/**
 * `Buffer` of the Android core: the npm `buffer` polyfill (the same API as Node's Buffer on top of
 * Uint8Array), patched where it does not produce the bytes Node produces:
 *
 *   - 'base64url', which the polyfill lacks (session tokens and reset tokens are
 *     `randomBytes(32).toString('base64url')`);
 *   - text -> UTF-8 of a string that is not well-formed UTF-16: Node writes U+FFFD for EVERY unpaired
 *     surrogate; the polyfill drops one when the string ends with two or more unpaired lead
 *     surrogates. A password of that shape would derive another key on the phone than on the desktop
 *     (`Buffer.from(password.normalize('NFKC'), 'utf8')` in security/kdf.ts), so every string is made
 *     well-formed before the polyfill encodes it;
 *   - hex -> bytes: Node stops at the first pair that is not two hex digits; the polyfill's parseInt
 *     accepts pairs such as '1g' or ' 1';
 *   - hex / base64 / base64url -> bytes of text with characters above U+00FF: Node reads the LOW
 *     BYTE of every UTF-16 unit ('ţ' U+0163 is the hex digit 'c', 'Ŭ' U+016C the Base64 digit 'l'),
 *     the polyfill treats such a character as invalid;
 *   - `Buffer.byteLength(text, 'base64' | 'base64url')`: Node computes it from the length of the text
 *     and its trailing '=' (an upper bound for text with other characters), the polyfill decodes;
 *   - UTF-8 -> text of bytes that are not valid UTF-8: Node (like TextDecoder) writes one U+FFFD per
 *     maximal invalid sequence, the polyfill one per byte.
 * The app only decodes hex and Base64 it wrote itself, so the hex and Base64 patches change nothing
 * for genuine data: they make a hand-damaged file fail the same way on the phone and on the desktop.
 *
 * Not patched (known differences from Node, none reachable from server/src or shared):
 *   - `new Buffer(string)` / `Buffer(string)` (deprecated; the constructor does not go through
 *     `Buffer.from`);
 *   - indexOf / lastIndexOf / includes outside their ordinary use. With a non-empty string, Buffer
 *     or byte value and no offset or an integer offset they answer like Node. They differ for an
 *     EMPTY string or buffer (Node answers a position, like String.prototype.indexOf; the polyfill
 *     -1), for a plain Uint8Array as the value (the polyfill throws), for an offset that is not an
 *     integer and when an encoding is given. No core module searches a Buffer;
 *     mobile/test/compat/buffer-node.test.ts fails when one starts to.
 *
 * The package is imported by file ('buffer/index.js'): a bare 'buffer' would be Node's built-in
 * module under vitest, and the byte-compatibility suite must exercise the polyfill.
 */
import { Buffer as PolyfillBuffer } from 'buffer/index.js';

type AnyFunction = (this: unknown, ...args: unknown[]) => unknown;

interface Patchable {
  __mpdBase64Url?: boolean;
  from: AnyFunction;
  isEncoding: AnyFunction;
  byteLength: AnyFunction;
  prototype: { toString: AnyFunction; write: AnyFunction };
}

/** Encodings in which a string is NOT turned into UTF-8 (everything else is, as in the polyfill and in Node). */
const NOT_UTF8 = new Set(['ascii', 'latin1', 'binary', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'hex', 'base64', 'base64url']);

function isBase64Url(encoding: unknown): boolean {
  return typeof encoding === 'string' && encoding.toLowerCase() === 'base64url';
}

function isHex(encoding: unknown): boolean {
  return typeof encoding === 'string' && encoding.toLowerCase() === 'hex';
}

/** 'base64' or 'base64url' (Node decodes both with the same decoder). */
function isAnyBase64(encoding: unknown): boolean {
  if (typeof encoding !== 'string') return false;
  const name = encoding.toLowerCase();
  return name === 'base64' || name === 'base64url';
}

/** True when a string given with this encoding argument is encoded as UTF-8 (the default). */
function isUtf8(encoding: unknown): boolean {
  return typeof encoding !== 'string' || !NOT_UTF8.has(encoding.toLowerCase());
}

/** Standard Base64 -> the URL-safe alphabet without padding (RFC 4648 section 5), as Node writes it. */
function toBase64Url(base64: string): string {
  let end = base64.length;
  while (end > 0 && base64[end - 1] === '=') end -= 1;
  return base64.slice(0, end).split('+').join('-').split('/').join('_');
}

/**
 * `text` with every unpaired surrogate replaced by U+FFFD - String.prototype.toWellFormed written
 * out, for a WebView that does not have it yet. Returns `text` itself when it is well-formed.
 */
export function replaceLoneSurrogates(text: string): string {
  let parts: string[] | null = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit < 0xd800 || unit > 0xdfff) continue;
    if (unit <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i += 1;
        continue;
      }
    }
    (parts ??= []).push(text.slice(start, i), '�');
    start = i + 1;
  }
  if (!parts) return text;
  parts.push(text.slice(start));
  return parts.join('');
}

const nativeToWellFormed = (String.prototype as { toWellFormed?: (this: string) => string }).toWellFormed;

/** `text` as well-formed UTF-16: what Node's UTF-8 encoder makes of a string before it writes bytes. */
export function toWellFormed(text: string): string {
  return typeof nativeToWellFormed === 'function' ? nativeToWellFormed.call(text) : replaceLoneSurrogates(text);
}

function isHexDigit(code: number): boolean {
  return (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x46) || (code >= 0x61 && code <= 0x66);
}

/** The leading pairs of hex digits of `text`: the part of a hex string Node decodes. */
function hexPairs(text: string): string {
  let end = 0;
  while (end + 1 < text.length && isHexDigit(text.charCodeAt(end)) && isHexDigit(text.charCodeAt(end + 1))) end += 2;
  return end === text.length ? text : text.slice(0, end);
}

/**
 * `text` with every UTF-16 unit reduced to its low byte: what Node's hex and Base64 decoders see
 * (they look a unit up in a 256-entry table by its low byte). Returns `text` itself when no unit
 * is above 0xFF - every string the app decodes.
 */
export function lowBytes(text: string): string {
  let i = 0;
  while (i < text.length && text.charCodeAt(i) <= 0xff) i += 1;
  if (i === text.length) return text;
  const parts: string[] = [text.slice(0, i)];
  const codes: number[] = [];
  for (; i < text.length; i++) {
    codes.push(text.charCodeAt(i) & 0xff);
    if (codes.length === 0x2000) {
      parts.push(String.fromCharCode(...codes));
      codes.length = 0;
    }
  }
  parts.push(String.fromCharCode(...codes));
  return parts.join('');
}

/** The string the polyfill must be given so that it writes the bytes Node writes for `text`. */
function textFor(text: string, encoding: unknown): string {
  if (isUtf8(encoding)) return toWellFormed(text);
  if (isHex(encoding)) return hexPairs(lowBytes(text));
  return isAnyBase64(encoding) ? lowBytes(text) : text;
}

/** Node's `Buffer.byteLength(text, 'base64')`: three bytes per four characters, less the padding at the end. */
function base64ByteLength(text: string): number {
  let length = text.length;
  if (length > 0 && text.charCodeAt(length - 1) === 0x3d) length -= 1;
  if (length > 1 && text.charCodeAt(length - 1) === 0x3d) length -= 1;
  return (length * 3) >>> 2;
}

/** Decoder of `toString('utf8')`: keeps a BOM, U+FFFD for invalid sequences - like Node. */
const utf8Decoder = typeof TextDecoder === 'function' ? new TextDecoder('utf-8', { ignoreBOM: true }) : null;

/**
 * The UTF-8 text of `bytes[start, end)` with the range rules of the polyfill. Null when there is no
 * TextDecoder or it refuses the memory (a SharedArrayBuffer): the polyfill's own decoder is used then.
 */
function decodeUtf8(bytes: Uint8Array, start: unknown, end: unknown): string | null {
  if (!utf8Decoder) return null;
  const length = bytes.length;
  let from = start === undefined || (start as number) < 0 ? 0 : (start as number);
  if (from > length) return '';
  let to = end === undefined || (end as number) > length ? length : (end as number);
  if (to <= 0) return '';
  to >>>= 0;
  from >>>= 0;
  if (to <= from) return '';
  try {
    return utf8Decoder.decode(Uint8Array.prototype.subarray.call(bytes, from, to));
  } catch {
    return null;
  }
}

function addNodeCompat(target: Patchable): void {
  if (target.__mpdBase64Url) return;
  target.__mpdBase64Url = true;

  // Decoding of base64url: the polyfill's Base64 decoder already accepts '-' and '_' and missing padding.
  // (Buffer.alloc(size, text), fill(text), indexOf(text) and includes(text) turn their string into
  // bytes with Buffer.from, so this patch covers them.)
  const from = target.from;
  target.from = function (this: unknown, value: unknown, encodingOrOffset?: unknown, length?: unknown): unknown {
    if (typeof value !== 'string') return from.call(target, value, encodingOrOffset, length);
    if (isBase64Url(encodingOrOffset)) return from.call(target, lowBytes(value), 'base64');
    return from.call(target, textFor(value, encodingOrOffset), encodingOrOffset, length);
  };

  const isEncoding = target.isEncoding;
  target.isEncoding = function (this: unknown, encoding: unknown): unknown {
    return isBase64Url(encoding) || isEncoding.call(target, encoding);
  };

  const byteLength = target.byteLength;
  target.byteLength = function (this: unknown, value: unknown, encoding?: unknown): unknown {
    if (typeof value === 'string' && isAnyBase64(encoding)) return base64ByteLength(value);
    if (isBase64Url(encoding)) return byteLength.call(target, value, 'base64');
    // (The length of a hex string is half its length for Node too, whatever it contains.)
    return byteLength.call(target, typeof value === 'string' && isUtf8(encoding) ? toWellFormed(value) : value, encoding);
  };

  const toString = target.prototype.toString;
  target.prototype.toString = function (this: unknown, encoding?: unknown, start?: unknown, end?: unknown): unknown {
    if (isBase64Url(encoding)) return toBase64Url(toString.call(this, 'base64', start, end) as string);
    if (!encoding || (typeof encoding === 'string' && /^utf-?8$/i.test(encoding))) {
      const text = decodeUtf8(this as Uint8Array, start, end);
      if (text !== null) return text;
    }
    // Like the original, which looks at arguments.length: no arguments = the whole buffer as UTF-8.
    return encoding === undefined && start === undefined && end === undefined
      ? toString.call(this)
      : toString.call(this, encoding, start, end);
  };

  // write(string), write(string, encoding), write(string, offset[, length][, encoding]).
  const write = target.prototype.write;
  target.prototype.write = function (this: unknown, ...args: unknown[]): unknown {
    if (typeof args[0] === 'string') {
      let at = -1;
      for (let i = 1; i < args.length && at < 0; i++) if (typeof args[i] === 'string') at = i;
      if (at > 0 && isBase64Url(args[at])) {
        args[at] = 'base64';
        args[0] = lowBytes(args[0]);
      } else args[0] = textFor(args[0], at > 0 ? args[at] : undefined);
    }
    return write.apply(this, args);
  };
}

addNodeCompat(PolyfillBuffer as unknown as Patchable);

/** An instance of the polyfill, typed like Node's Buffer (it has the same methods). */
export type Buffer = InstanceType<BufferConstructor>;

/** The polyfill, typed like Node's `Buffer` constructor. */
export const Buffer = PolyfillBuffer as unknown as BufferConstructor;

/** A polyfill Buffer over the same memory as `bytes` (no copy). */
export function bufferOver(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export const kMaxLength = 0x7fffffff;
export const constants = { MAX_LENGTH: kMaxLength, MAX_STRING_LENGTH: 0x1fffffe8 };

export default { Buffer, kMaxLength, constants };
