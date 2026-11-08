// @vitest-environment node
/**
 * The Buffer of the Android core (mobile/core/shims/buffer.ts) against Node's Buffer, on the inputs
 * where the npm polyfill alone does NOT write what Node writes:
 *
 *   - text -> UTF-8 of strings that are not well-formed UTF-16. The polyfill drops a U+FFFD when a
 *     string ends with two or more unpaired lead surrogates; `Buffer.from(password, 'utf8')` in
 *     security/kdf.ts would then derive another key on the phone than on the desktop;
 *   - hex -> bytes of strings that are not all hex digits;
 *   - hex / Base64 -> bytes of strings with characters above U+00FF (Node reads their low byte);
 *   - UTF-8 -> text of bytes that are not valid UTF-8;
 * and, for what is NOT patched (indexOf / lastIndexOf / includes with an empty value), the proof
 * that no module of the core calls it.
 *
 * Fixed cases, a fuzz of each direction against Node, and the real app code (deriveSecret and a
 * container) with such a password on both platforms. `Buffer` in this file is Node's.
 */
import path from 'node:path';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as shimContainer from '../../../server/src/security/container';
import * as shimKdf from '../../../server/src/security/kdf';
import { Buffer as PolyfillBuffer, lowBytes, replaceLoneSurrogates, toWellFormed } from '../../core/shims/buffer';
import { openNativeServer, type NativeServer } from './native-server';

type ShimBuffer = InstanceType<typeof PolyfillBuffer>;

const LEAD = '\ud83d';
const TRAIL = '\ude00';

/** Strings that are not well-formed UTF-16; the first ones are the shapes the polyfill gets wrong. */
const MALFORMED: string[] = [
  `${LEAD}${LEAD}`,
  `pw${LEAD}${LEAD}`,
  `x😀${LEAD}${LEAD}`,
  `${LEAD}${LEAD}${LEAD}`,
  `Passw0rd-${LEAD}${LEAD}${LEAD}`,
  '\ud800\udbff\ud800\udbff',
  `סיסמה${LEAD}\udbff`,
  // Shapes the polyfill already encoded like Node (they must stay that way).
  LEAD,
  TRAIL,
  `a${LEAD}b`,
  `a${TRAIL}b`,
  `${LEAD}${LEAD}a`,
  `${LEAD}${LEAD}${TRAIL}`,
  `${TRAIL}${LEAD}`,
  `${TRAIL}${TRAIL}`,
  `${LEAD}😀${LEAD}`,
  `end${LEAD}`,
  `end${TRAIL}`,
];

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('hex');
}

/** A printable form of a string with unpaired surrogates (for failure messages). */
function show(text: string): string {
  return JSON.stringify(text);
}

/** Deterministic pseudo-random numbers in [0, 1) (mulberry32): a failure can be reproduced. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHARACTERS = ['a', 'Z', '0', ' ', '\u0000', 'é', 'ß', 'א', 'ש', 'م', '密', 'ｐ', 'ﬁ', '①', '́', '�', '﻿', '😀', '𠮷', '🔑'];

/** An arbitrary sequence of UTF-16 code units: text, surrogate pairs and many unpaired surrogates. */
function randomUtf16(next: () => number, maxLength = 10): string {
  const length = Math.floor(next() * (maxLength + 1));
  let text = '';
  for (let i = 0; i < length; i++) {
    const kind = next();
    if (kind < 0.3) text += String.fromCharCode(0xd800 + Math.floor(next() * 0x400));
    else if (kind < 0.5) text += String.fromCharCode(0xdc00 + Math.floor(next() * 0x400));
    else if (kind < 0.9) text += CHARACTERS[Math.floor(next() * CHARACTERS.length)];
    else text += String.fromCharCode(Math.floor(next() * 0x10000));
  }
  return text;
}

describe('buffer shim: text that is not well-formed UTF-16 becomes the bytes Node writes', () => {
  it('Buffer.from: one U+FFFD per unpaired surrogate, also for two or more leads at the end', () => {
    expect(hex(PolyfillBuffer.from(`${LEAD}${LEAD}`))).toBe('efbfbdefbfbd');
    expect(hex(PolyfillBuffer.from(`pw${LEAD}${LEAD}`, 'utf8'))).toBe('7077efbfbdefbfbd');
    expect(PolyfillBuffer.from(`x😀${LEAD}${LEAD}`)).toHaveLength(11);
    for (const text of MALFORMED) {
      const expected = Buffer.from(text, 'utf8').toString('hex');
      expect(hex(PolyfillBuffer.from(text)), show(text)).toBe(expected);
      for (const encoding of ['utf8', 'utf-8', 'UTF8', 'Utf-8'] as const) {
        expect(hex(PolyfillBuffer.from(text, encoding as BufferEncoding)), `${show(text)} ${encoding}`).toBe(expected);
      }
    }
  });

  it('Buffer.byteLength counts those bytes', () => {
    expect(PolyfillBuffer.byteLength(`${LEAD}${LEAD}`)).toBe(6);
    for (const text of MALFORMED) {
      expect(PolyfillBuffer.byteLength(text), show(text)).toBe(Buffer.byteLength(text));
      expect(PolyfillBuffer.byteLength(text, 'utf8'), show(text)).toBe(Buffer.byteLength(text, 'utf8'));
      expect(PolyfillBuffer.byteLength(text, 'utf-8'), show(text)).toBe(PolyfillBuffer.from(text).length);
    }
  });

  it('write, fill and alloc(size, text) write them as well', () => {
    for (const text of MALFORMED) {
      const label = show(text);
      const mine = PolyfillBuffer.alloc(40, 0x2e);
      const nodes = Buffer.alloc(40, 0x2e);
      expect(mine.write(text), label).toBe(nodes.write(text));
      expect(mine.write(text, 20, 'utf8'), label).toBe(nodes.write(text, 20, 'utf8'));
      expect(hex(mine), label).toBe(nodes.toString('hex'));
      expect(hex(PolyfillBuffer.alloc(40).fill(text)), label).toBe(Buffer.alloc(40).fill(text).toString('hex'));
      expect(hex(PolyfillBuffer.alloc(17, text)), label).toBe(Buffer.alloc(17, text).toString('hex'));
      expect(hex(PolyfillBuffer.alloc(17, text, 'utf8')), label).toBe(Buffer.alloc(17, text, 'utf8').toString('hex'));
    }
  });

  it('the other encodings still see the code units of the string (nothing is replaced there)', () => {
    for (const text of MALFORMED) {
      for (const encoding of ['utf16le', 'ucs2', 'latin1', 'binary', 'ascii'] as const) {
        expect(hex(PolyfillBuffer.from(text, encoding)), `${show(text)} ${encoding}`).toBe(Buffer.from(text, encoding).toString('hex'));
        expect(PolyfillBuffer.byteLength(text, encoding), `${show(text)} ${encoding}`).toBe(Buffer.byteLength(text, encoding));
      }
      // UTF-16 round trip keeps the unpaired surrogates.
      expect(PolyfillBuffer.from(text, 'utf16le').toString('utf16le'), show(text)).toBe(text);
    }
  });

  it('well-formed text is untouched: the bytes of valid strings did not change', () => {
    for (const text of ['', 'password', 'סיסמה', 'كلمة السر', '密码', '😀🔑', '𠮷野家', 'Café ｆｕｌｌ', '�', '﻿bom', 'a'.repeat(5000) + '😀']) {
      expect(toWellFormed(text)).toBe(text);
      expect(replaceLoneSurrogates(text)).toBe(text);
      expect(hex(PolyfillBuffer.from(text)), show(text.slice(0, 20))).toBe(Buffer.from(text).toString('hex'));
      expect(PolyfillBuffer.from(text).toString(), show(text.slice(0, 20))).toBe(text);
    }
  });

  it('the replacement written out (for a WebView without String.prototype.toWellFormed) equals the native one', () => {
    expect(replaceLoneSurrogates(`pw${LEAD}${LEAD}`)).toBe('pw��');
    expect(replaceLoneSurrogates(`${TRAIL}a${LEAD}😀${LEAD}`)).toBe('�a�😀�');
    const native = (String.prototype as { toWellFormed?: (this: string) => string }).toWellFormed;
    expect(native, 'Node 20+ has toWellFormed').toBeTypeOf('function');
    const next = random(0x5eed01);
    for (let i = 0; i < 20_000; i++) {
      const text = randomUtf16(next, 12);
      if (replaceLoneSurrogates(text) !== native?.call(text)) expect.fail(`replaceLoneSurrogates differs for ${show(text)}`);
    }
    for (const text of MALFORMED) expect(toWellFormed(text), show(text)).toBe(native?.call(text));
  });

  it('fuzz: 30,000 arbitrary UTF-16 strings, raw and NFKC-normalised, encode like Node', () => {
    const next = random(0xc0ffee);
    const mismatches: string[] = [];
    let endingInTwoLeads = 0;
    for (let i = 0; i < 30_000; i++) {
      const raw = randomUtf16(next);
      if (/[\ud800-\udbff]{2}$/.test(raw)) endingInTwoLeads += 1;
      for (const text of [raw, raw.normalize('NFKC')]) {
        const expected = Buffer.from(text, 'utf8');
        const actual = PolyfillBuffer.from(text, 'utf8');
        const sameBytes = actual.length === expected.length && expected.equals(actual);
        if (!sameBytes || PolyfillBuffer.byteLength(text, 'utf8') !== expected.length) {
          mismatches.push(`${show(text)}: node ${expected.toString('hex')}, shim ${hex(actual)}`);
        }
      }
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
    // The fuzz reaches the shape of the defect (the plain polyfill fails on each of these).
    expect(endingInTwoLeads).toBeGreaterThan(500);
  });

  it('fuzz: write() into a buffer that may be too small stops where Node stops', () => {
    const next = random(0xbeef);
    const mismatches: string[] = [];
    for (let i = 0; i < 10_000; i++) {
      const text = randomUtf16(next, 6);
      const size = Math.floor(next() * (Buffer.byteLength(text) + 4));
      const offset = Math.min(size, Math.floor(next() * 3));
      const nodes = Buffer.alloc(size, 0x2e);
      const mine = PolyfillBuffer.alloc(size, 0x2e);
      const expected = nodes.write(text, offset);
      const actual = mine.write(text, offset);
      if (actual !== expected || hex(mine) !== nodes.toString('hex')) {
        mismatches.push(`${show(text)} into ${size} at ${offset}: node ${expected} ${nodes.toString('hex')}, shim ${actual} ${hex(mine)}`);
      }
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
  });
});

describe('buffer shim: hex strings decode like Node (up to the first pair that is not two hex digits)', () => {
  it('stops at an invalid pair instead of reading it with parseInt', () => {
    const cases = ['ab1g34', 'ab 134', ' 1ab', 'zz', 'a', 'abc', 'AbCdEf', '0x1234', 'ab\n12', '12-34', 'abcd', '', 'é1', `ab${LEAD}c`, '1 ', '+1', '-1ab', '1e'];
    for (const text of cases) {
      const expected = Buffer.from(text, 'hex');
      expect(hex(PolyfillBuffer.from(text, 'hex')), show(text)).toBe(expected.toString('hex'));
      expect(hex(PolyfillBuffer.from(text, 'HEX' as BufferEncoding)), show(text)).toBe(expected.toString('hex'));
      expect(PolyfillBuffer.byteLength(text, 'hex'), show(text)).toBe(Buffer.byteLength(text, 'hex'));
      const mine = PolyfillBuffer.alloc(8, 0xee);
      const nodes = Buffer.alloc(8, 0xee);
      expect(mine.write(text, 'hex'), show(text)).toBe(nodes.write(text, 'hex'));
      expect(mine.write(text, 5, 'hex'), show(text)).toBe(nodes.write(text, 5, 'hex'));
      expect(hex(mine), show(text)).toBe(nodes.toString('hex'));
    }
    expect(hex(PolyfillBuffer.from('ab1g34', 'hex'))).toBe('ab');
  });

  it('fuzz: 20,000 strings of hex digits and a few other characters', () => {
    const alphabet = '0123456789abcdefABCDEF0123456789abcdef0123456789abcdefgG xz-\n+.é';
    const next = random(0x4e7);
    const mismatches: string[] = [];
    for (let i = 0; i < 20_000; i++) {
      let text = '';
      const length = Math.floor(next() * 15);
      for (let j = 0; j < length; j++) text += alphabet[Math.floor(next() * alphabet.length)];
      const expected = Buffer.from(text, 'hex').toString('hex');
      const actual = hex(PolyfillBuffer.from(text, 'hex'));
      if (actual !== expected) mismatches.push(`${show(text)}: node ${expected}, shim ${actual}`);
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
  });

  it('the hex helpers of the app agree on both platforms for a malformed verifier', () => {
    // safeEqualHex(a, b) decodes both sides with Buffer.from(x, 'hex').
    expect(shimKdf.safeEqualHex('ab1g34', 'ab0134')).toBe(false);
    expect(shimKdf.safeEqualHex('ab', 'ab')).toBe(true);
    expect(shimKdf.safeEqualHex('zz', 'zz')).toBe(false);
  });
});

describe('buffer shim: hex and Base64 text with characters above U+00FF decodes like Node (from the low byte of each unit)', () => {
  const HEX_DIGITS = '0123456789abcdefABCDEF';
  const BASE64_DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/-_';

  /** A character above U+00FF whose low byte is `character` (which Node's decoders take it for). */
  function wide(character: string, next: () => number): string {
    return String.fromCharCode(character.charCodeAt(0) + 0x100 * (1 + Math.floor(next() * 200)));
  }

  /** Digits of `alphabet`, their wide twins, other characters (plain and wide) and arbitrary UTF-16 units. */
  function digitsAndNoise(next: () => number, alphabet: string, others: string, maxLength = 15): string {
    const pick = (from: string): string => from[Math.floor(next() * from.length)];
    const length = Math.floor(next() * (maxLength + 1));
    let text = '';
    for (let i = 0; i < length; i++) {
      const kind = next();
      if (kind < 0.6) text += pick(alphabet);
      else if (kind < 0.8) text += wide(pick(alphabet), next);
      else if (kind < 0.9) text += pick(others);
      else if (kind < 0.95) text += wide(pick(others), next);
      else text += String.fromCharCode(Math.floor(next() * 0x10000));
    }
    return text;
  }

  it('the cases the plain polyfill decodes differently', () => {
    // 'ţ' is U+0163: low byte 0x63, the hex digit 'c'. 'Ŭ' is U+016C: low byte 0x6C, the Base64 digit 'l'.
    expect(Buffer.from('7ţ', 'hex').toString('hex')).toBe('7c');
    expect(hex(PolyfillBuffer.from('7ţ', 'hex'))).toBe('7c');
    expect(hex(PolyfillBuffer.from('ĵŁ', 'hex'))).toBe(Buffer.from('ĵŁ', 'hex').toString('hex'));
    expect(Buffer.from('ŬjĄÛ)l', 'base64').toString('hex')).toBe('9639');
    expect(hex(PolyfillBuffer.from('ŬjĄÛ)l', 'base64'))).toBe('9639');
    const cases: Array<[string, BufferEncoding]> = [
      ['7ţ', 'hex'],
      ['ĵŁ', 'hex'],
      ['abţd', 'hex'],
      ['ab\u0167d12', 'hex'],
      ['\u0130\u0131ff', 'hex'],
      ['ŬjĄÛ)l', 'base64'],
      ['ŬjĄÛ)l', 'base64url'],
      ['Q\u0155JD', 'base64'],
      ['QUJD\u013d\u013d', 'base64'],
      ['QUI\u013d', 'base64'],
      ['QU\u0120JD', 'base64'],
      ['\u012d\u015f8', 'base64url'],
      ['😀QUJD', 'base64'],
    ];
    for (const [text, encoding] of cases) {
      const expected = Buffer.from(text, encoding);
      const label = `${show(text)} ${encoding}`;
      expect(hex(PolyfillBuffer.from(text, encoding)), label).toBe(expected.toString('hex'));
      expect(hex(PolyfillBuffer.from(text, encoding.toUpperCase() as BufferEncoding)), label).toBe(expected.toString('hex'));
      expect(PolyfillBuffer.byteLength(text, encoding), label).toBe(Buffer.byteLength(text, encoding));
      const mine = PolyfillBuffer.alloc(12, 0xee);
      const nodes = Buffer.alloc(12, 0xee);
      expect(mine.write(text, 1, encoding), label).toBe(nodes.write(text, 1, encoding));
      expect(hex(mine), label).toBe(nodes.toString('hex'));
      // alloc(size, text): the decoded bytes repeated - or, for text that decodes to nothing, an error on both.
      const filled = (alloc: () => Uint8Array): string => {
        try {
          return hex(alloc());
        } catch {
          return 'throws';
        }
      };
      expect(filled(() => PolyfillBuffer.alloc(9, text, encoding)), label).toBe(filled(() => Buffer.alloc(9, text, encoding)));
    }
    expect(hex(PolyfillBuffer.alloc(5, '7ţ', 'hex'))).toBe('7c7c7c7c7c');
  });

  it('text the app writes (no character above U+00FF) is handed to the polyfill as it is', () => {
    for (const text of ['', '00ff', 'QUJD', 'QUI=', 'ab cd', 'é', '\u00ff\u0000']) expect(lowBytes(text)).toBe(text);
    expect(lowBytes('7ţ')).toBe('7c');
    expect(lowBytes('ab😀')).toBe('ab\u003d\u0000');
    // Longer than one chunk of the conversion.
    const long = '\u0161'.repeat(20_000) + 'b';
    expect(lowBytes(long)).toBe('a'.repeat(20_000) + 'b');
    expect(hex(PolyfillBuffer.from(long, 'hex')) === Buffer.from(long, 'hex').toString('hex')).toBe(true);
  });

  it('fuzz: 40,000 hex strings with wide digits and noise - from, write and byteLength', () => {
    const next = random(0x10b17e);
    const mismatches: string[] = [];
    let wideDigits = 0;
    for (let i = 0; i < 40_000; i++) {
      const text = digitsAndNoise(next, HEX_DIGITS, 'gG xz-\n+.é');
      const expected = Buffer.from(text, 'hex');
      if (expected.length > 0 && /[^\u0000-\u00ff]/.test(text.slice(0, expected.length * 2))) wideDigits += 1;
      const actual = PolyfillBuffer.from(text, 'hex');
      const offset = Math.floor(next() * 4);
      const mine = PolyfillBuffer.alloc(10, 0xee);
      const nodes = Buffer.alloc(10, 0xee);
      const same =
        hex(actual) === expected.toString('hex') &&
        PolyfillBuffer.byteLength(text, 'hex') === Buffer.byteLength(text, 'hex') &&
        mine.write(text, offset, 'hex') === nodes.write(text, offset, 'hex') &&
        hex(mine) === nodes.toString('hex');
      if (!same) mismatches.push(`${show(text)}: node ${expected.toString('hex')}, shim ${hex(actual)}`);
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
    // The fuzz reaches the defect: strings Node decodes THROUGH a wide character.
    expect(wideDigits).toBeGreaterThan(2000);
  });

  it('fuzz: 40,000 base64 and base64url strings with wide digits, padding and noise - from, write and byteLength', () => {
    const next = random(0xba5e64);
    const mismatches: string[] = [];
    for (let i = 0; i < 40_000; i++) {
      for (const encoding of ['base64', 'base64url'] as const) {
        const text = digitsAndNoise(next, BASE64_DIGITS, '= \n\t.,*=é');
        const expected = Buffer.from(text, encoding);
        const actual = PolyfillBuffer.from(text, encoding);
        const offset = Math.floor(next() * 4);
        const mine = PolyfillBuffer.alloc(14, 0xee);
        const nodes = Buffer.alloc(14, 0xee);
        const same =
          hex(actual) === expected.toString('hex') &&
          PolyfillBuffer.byteLength(text, encoding) === Buffer.byteLength(text, encoding) &&
          mine.write(text, offset, encoding) === nodes.write(text, offset, encoding) &&
          hex(mine) === nodes.toString('hex');
        if (!same) mismatches.push(`${show(text)} ${encoding}: node ${expected.toString('hex')}, shim ${hex(actual)}`);
      }
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
  });

  it('Buffer.byteLength of Base64 text is the estimate Node gives, not the decoded length', () => {
    for (const text of ['', 'Q', 'QQ', 'QUI', 'QUI=', 'QUJD', 'QQ==', 'QUJD\n', 'Q U J D', '====', 'QUJD====', '*QUJD']) {
      for (const encoding of ['base64', 'base64url', 'BASE64'] as const) {
        expect(PolyfillBuffer.byteLength(text, encoding as BufferEncoding), `${show(text)} ${encoding}`).toBe(Buffer.byteLength(text, encoding as BufferEncoding));
      }
    }
    // Bytes have the length they have, whatever the encoding argument says.
    expect(PolyfillBuffer.byteLength(PolyfillBuffer.alloc(5), 'base64')).toBe(5);
    expect(PolyfillBuffer.byteLength(new Uint8Array(7), 'base64url' as BufferEncoding)).toBe(7);
  });
});

describe('buffer shim: indexOf / lastIndexOf / includes (not patched - see the header of buffer.ts)', () => {
  const METHODS = ['indexOf', 'lastIndexOf', 'includes'] as const;

  it('fuzz: with a non-empty string, Buffer or byte value and no offset or an integer offset they answer like Node', () => {
    const next = random(0x1d0f);
    const pick = <T,>(from: readonly T[]): T => from[Math.floor(next() * from.length)];
    const BYTES = [0x61, 0x62, 0x63, 0x00, 0xff];
    const mismatches: string[] = [];
    for (let i = 0; i < 30_000; i++) {
      const length = Math.floor(next() * 7);
      const haystack = Uint8Array.from({ length }, () => pick(BYTES));
      const kind = next();
      let nodeValue: string | number | Buffer;
      let shimValue: string | number | ShimBuffer;
      if (kind < 0.4) {
        nodeValue = shimValue = Array.from({ length: 1 + Math.floor(next() * 3) }, () => pick(['a', 'b', 'c'])).join('');
      } else if (kind < 0.8) {
        const bytes = Uint8Array.from({ length: 1 + Math.floor(next() * 3) }, () => pick(BYTES));
        nodeValue = Buffer.from(bytes);
        shimValue = PolyfillBuffer.from(bytes);
      } else {
        nodeValue = shimValue = pick(BYTES);
      }
      const offsetKind = next();
      let offset: number | undefined;
      if (offsetKind < 0.3) offset = undefined;
      else if (offsetKind < 0.7) offset = Math.floor(next() * (length + 1));
      else if (offsetKind < 0.9) offset = -1 - Math.floor(next() * Math.max(length, 1));
      else offset = pick([length + 1, length + 5, -length - 1, -length - 5]);
      for (const method of METHODS) {
        const expected = Buffer.from(haystack)[method](nodeValue as never, offset);
        const actual = PolyfillBuffer.from(haystack)[method](shimValue as never, offset);
        if (actual !== expected) {
          mismatches.push(`${method}: ${Buffer.from(haystack).toString('hex')} / ${typeof nodeValue === 'object' ? nodeValue.toString('hex') : show(String(nodeValue))} at ${String(offset)}: node ${String(expected)}, shim ${String(actual)}`);
        }
      }
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
  });

  it('the known difference: an empty value has a position in Node and none in the polyfill', () => {
    expect(Buffer.alloc(0).indexOf(Buffer.alloc(0))).toBe(0);
    expect(Buffer.from('abc').indexOf('')).toBe(0);
    expect(Buffer.from('abc').lastIndexOf('')).toBe(3);
    expect(PolyfillBuffer.alloc(0).indexOf(PolyfillBuffer.alloc(0))).toBe(-1);
    expect(PolyfillBuffer.from('abc').indexOf('')).toBe(-1);
    expect(PolyfillBuffer.from('abc').lastIndexOf('')).toBe(-1);
  });

  it(
    'no module of server/src or shared searches a Buffer or a Uint8Array (so the difference cannot be reached)',
    () => {
      const root = process.cwd().split(path.sep).join('/');
      const config = ts.getParsedCommandLineOfConfigFile(path.join(process.cwd(), 'server', 'tsconfig.json'), {}, {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
          throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
        },
      });
      if (!config) throw new Error('server/tsconfig.json could not be read');

      // A control module inside server/src (in memory only): the scan must find exactly its three searches.
      const probeFile = `${root}/server/src/zz-buffer-search-probe.ts`;
      const probeText = [
        'declare const maybe: Buffer | undefined;',
        "export const a = Buffer.from('a').indexOf('');",
        'export const b = new Uint8Array(1).includes(1);',
        "export const c = maybe?.lastIndexOf('x');",
        "export const d = 'text'.indexOf('') + [1].indexOf(1) + (['a'].includes('a') ? 1 : 0);",
        '',
      ].join('\n');
      const isProbe = (file: string): boolean => file.split('\\').join('/').toLowerCase() === probeFile.toLowerCase();
      const options: ts.CompilerOptions = { ...config.options, noEmit: true };
      const host = ts.createCompilerHost(options, true);
      const { fileExists, readFile, getSourceFile } = host;
      host.fileExists = (file) => isProbe(file) || fileExists.call(host, file);
      host.readFile = (file) => (isProbe(file) ? probeText : readFile.call(host, file));
      host.getSourceFile = (file, languageVersion, ...rest) =>
        isProbe(file) ? ts.createSourceFile(file, probeText, languageVersion, true) : getSourceFile.call(host, file, languageVersion, ...rest);

      const program = ts.createProgram({ rootNames: [...config.fileNames, probeFile], options, host });
      const checker = program.getTypeChecker();
      const searches = new Set<string>(METHODS);
      const isBytes = (type: ts.Type): boolean =>
        (type.isUnionOrIntersection() ? type.types : [type]).some((part) => {
          const name = (part.symbol ?? part.aliasSymbol)?.name;
          return name === 'Buffer' || name === 'Uint8Array' || name === 'Uint8ClampedArray';
        });

      const found: string[] = [];
      let modules = 0;
      let calls = 0;
      for (const source of program.getSourceFiles()) {
        const file = source.fileName;
        if (source.isDeclarationFile || !(file.startsWith(`${root}/server/src/`) || file.startsWith(`${root}/shared/`))) continue;
        modules += 1;
        const visit = (node: ts.Node): void => {
          if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && searches.has(node.expression.name.text)) {
            calls += 1;
            const type = checker.getTypeAtLocation(node.expression.expression);
            if (isBytes(type) || isBytes(checker.getApparentType(type))) {
              const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
              found.push(`${file.slice(root.length + 1)}:${line + 1}`);
            }
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }

      expect(modules).toBeGreaterThan(300);
      expect(calls).toBeGreaterThan(20);
      expect(found.sort()).toEqual(['server/src/zz-buffer-search-probe.ts:2', 'server/src/zz-buffer-search-probe.ts:3', 'server/src/zz-buffer-search-probe.ts:4']);
    },
    120_000,
  );
});

describe('buffer shim: toString("utf8") of bytes that are not valid UTF-8 gives the text Node gives', () => {
  const INVALID: number[][] = [
    [0xe2, 0x82],
    [0x61, 0xe2, 0x82],
    [0xf0, 0x9f, 0x98],
    [0xf0, 0x9f],
    [0xc3],
    [0x80],
    [0xff, 0xfe],
    [0xed, 0xa0, 0x80],
    [0xc0, 0xaf],
    [0xf4, 0x90, 0x80, 0x80],
    [0xe2, 0x82, 0x41],
    [0xef, 0xbb, 0xbf, 0x41],
    [0xf0, 0x9f, 0x98, 0x80, 0xf0, 0x9f],
  ];

  it('truncated and invalid sequences: one U+FFFD per maximal invalid part; a BOM is kept', () => {
    for (const bytes of INVALID) {
      const expected = Buffer.from(bytes).toString('utf8');
      const mine = PolyfillBuffer.from(bytes);
      const label = Buffer.from(bytes).toString('hex');
      expect(mine.toString(), label).toBe(expected);
      expect(mine.toString('utf8'), label).toBe(expected);
      expect(mine.toString('utf-8'), label).toBe(expected);
      expect(mine.toString('UTF8' as BufferEncoding), label).toBe(expected);
    }
    expect(PolyfillBuffer.from([0xe2, 0x82]).toString()).toBe('�');
    expect(PolyfillBuffer.from([0xef, 0xbb, 0xbf, 0x41]).toString()).toBe('﻿A');
  });

  it('fuzz: 30,000 byte sequences, whole and in ranges', () => {
    const pool = [0x00, 0x41, 0x7f, 0x80, 0xbf, 0xc0, 0xc1, 0xc2, 0xdf, 0xe0, 0xe1, 0xed, 0xee, 0xef, 0xf0, 0xf1, 0xf4, 0xf5, 0xff, 0xa0, 0x9f, 0x90, 0x8f, 0xbb, 0xbd, 0xfe];
    const next = random(0xdec0de);
    const mismatches: string[] = [];
    for (let i = 0; i < 30_000; i++) {
      const length = Math.floor(next() * 12);
      const bytes = Uint8Array.from({ length }, () => (next() < 0.8 ? pool[Math.floor(next() * pool.length)] : Math.floor(next() * 256)));
      const nodes = Buffer.from(bytes);
      const mine = PolyfillBuffer.from(bytes);
      const start = Math.floor(next() * (length + 3)) - 1;
      const end = Math.floor(next() * (length + 4)) - 1;
      const same =
        mine.toString() === nodes.toString() &&
        mine.toString('utf8') === nodes.toString('utf8') &&
        mine.toString('utf8', start) === nodes.toString('utf8', start) &&
        mine.toString('utf-8', start, end) === nodes.toString('utf-8', start, end) &&
        mine.toString(undefined, start, end) === nodes.toString(undefined, start, end);
      if (!same) mismatches.push(`${nodes.toString('hex')} [${start}, ${end})`);
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
  });

  it('valid text of every size decodes as before, also across the chunk size of the polyfill', () => {
    for (const text of ['', 'a', 'שלום עולם', '密码 😀', 'x'.repeat(0x1000) + 'é', '😀'.repeat(3000), 'א'.repeat(70_000)]) {
      const bytes = Buffer.from(text, 'utf8');
      expect(PolyfillBuffer.from(bytes).toString('utf8') === text, show(text.slice(0, 10))).toBe(true);
      expect(PolyfillBuffer.from(bytes).toString('utf8', 0, bytes.length) === text, show(text.slice(0, 10))).toBe(true);
    }
    const buf: ShimBuffer = PolyfillBuffer.from('abcdef');
    expect(buf.toString('utf8', 2)).toBe('cdef');
    expect(buf.toString('utf8', 2, 4)).toBe('cd');
    expect(buf.toString('utf8', 4, 2)).toBe('');
    expect(buf.toString('utf8', 7)).toBe('');
    expect(buf.toString('utf8', 0, 100)).toBe('abcdef');
    expect(buf.subarray(1, 3).toString()).toBe('bc');
  });
});

describe('the app with a password that ends in unpaired lead surrogates: phone === desktop', () => {
  const PASSWORDS = [`Passw0rd-${LEAD}${LEAD}`, `${LEAD}${LEAD}${LEAD}`, `x😀${LEAD}\udbff`];
  let native: NativeServer;
  let nodeKdf: typeof shimKdf;
  let nodeContainer: typeof shimContainer;

  beforeAll(async () => {
    native = await openNativeServer();
    nodeKdf = await native.load<typeof shimKdf>('security/kdf');
    nodeContainer = await native.load<typeof shimContainer>('security/container');
  }, 120_000);

  afterAll(async () => {
    await native?.close();
  });

  it('deriveSecret (server/src/security/kdf.ts) gives the same secret on the shims and on Node', async () => {
    const saltBytes = Uint8Array.from({ length: 16 }, (_, i) => i * 7 + 1);
    for (const password of PASSWORDS) {
      const onShims = await shimKdf.deriveSecret(password, PolyfillBuffer.from(saltBytes));
      const onNode = await nodeKdf.deriveSecret(password, Buffer.from(saltBytes));
      expect(onShims).toBeInstanceOf(PolyfillBuffer);
      expect(hex(onShims), show(password)).toBe(onNode.toString('hex'));
    }
    // ... and it is not the secret of the password with one surrogate less (what the polyfill alone derived).
    const full = await shimKdf.deriveSecret(`pw${LEAD}${LEAD}`, PolyfillBuffer.from(saltBytes));
    const shorter = await shimKdf.deriveSecret(`pw${LEAD}`, PolyfillBuffer.from(saltBytes));
    expect(hex(full)).not.toBe(hex(shorter));
  }, 60_000);

  it('a container encrypted on the desktop with such a password opens on the phone, and the reverse', async () => {
    const password = PASSWORDS[0];
    const plain = Buffer.from('fictional diary image שלום', 'utf8');

    // desktop -> phone
    const nodeSalt = nodeKdf.newSalt();
    const nodeKey = nodeKdf.splitSecret(await nodeKdf.deriveSecret(password, nodeSalt)).key;
    const fromDesktop = nodeContainer.encryptContainer(plain, nodeKey, nodeSalt);
    expect((await nodeContainer.decryptWithPassword(fromDesktop, password)).plain.toString('hex')).toBe(plain.toString('hex'));
    const onPhone = await shimContainer.decryptWithPassword(PolyfillBuffer.from(fromDesktop), password);
    expect(hex(onPhone.plain)).toBe(plain.toString('hex'));
    expect(hex(onPhone.key)).toBe(nodeKey.toString('hex'));

    // phone -> desktop
    const shimSalt = shimKdf.newSalt();
    const shimKey = shimKdf.splitSecret(await shimKdf.deriveSecret(password, shimSalt)).key;
    const fromPhone = shimContainer.encryptContainer(PolyfillBuffer.from(plain), shimKey, shimSalt);
    const onDesktop = await nodeContainer.decryptWithPassword(Buffer.from(fromPhone), password);
    expect(onDesktop.plain.toString('hex')).toBe(plain.toString('hex'));

    // A different password is still refused on both.
    await expect(shimContainer.decryptWithPassword(PolyfillBuffer.from(fromDesktop), `Passw0rd-${LEAD}`)).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
  }, 60_000);
});
