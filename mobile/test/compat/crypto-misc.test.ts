// @vitest-environment node
/**
 * The rest of node:crypto in the Android core (mobile/core/shims/crypto.ts) against node:crypto:
 * SHA-256, timingSafeEqual, randomBytes, randomInt (range and bias), and the remote-access stubs.
 */
import nodeCrypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Buffer as PolyfillBuffer } from '../../core/shims/buffer';
import * as shim from '../../core/shims/crypto';
import shimDefault from '../../core/shims/crypto';
import { MOBILE_UNAVAILABLE_CODE } from '../../core/shims/unavailable';

function thrown(run: () => unknown): { name: string; code: string | undefined } | null {
  try {
    run();
    return null;
  } catch (e) {
    const error = e as Error & { code?: string };
    return { name: error.name, code: error.code };
  }
}

describe('sha256', () => {
  it('the FIPS 180-4 / NIST test vectors', () => {
    const vectors: Array<[string, string]> = [
      ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
      ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
      ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
      [
        'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu',
        'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1',
      ],
      ['a'.repeat(1_000_000), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'],
    ];
    for (const [message, expected] of vectors) {
      expect(shim.createHash('sha256').update(message).digest('hex'), `"${message.slice(0, 20)}" (${message.length})`).toBe(expected);
    }
  });

  it('matches node:crypto for random data of many sizes, in every output encoding', () => {
    for (const size of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000, 100_000]) {
      const data = nodeCrypto.randomBytes(size);
      for (const encoding of ['hex', 'base64', 'base64url', 'latin1'] as const) {
        expect(shim.createHash('sha256').update(data).digest(encoding), `${size} bytes as ${encoding}`).toBe(
          nodeCrypto.createHash('sha256').update(data).digest(encoding),
        );
      }
      const raw = shim.createHash('sha256').update(data).digest();
      expect(raw).toBeInstanceOf(PolyfillBuffer);
      expect(Buffer.from(raw).equals(nodeCrypto.createHash('sha256').update(data).digest())).toBe(true);
    }
  });

  it('update() chains, takes strings with an encoding, and Unicode text hashes as UTF-8', () => {
    const text = 'קוד: 123456 · رمز · 密码 · 🔑';
    const expected = nodeCrypto.createHash('sha256').update('salt:', 'utf8').update(text).update('00ff', 'hex').digest('hex');
    expect(shim.createHash('sha256').update('salt:', 'utf8').update(text).update('00ff', 'hex').digest('hex')).toBe(expected);
    // The forms the server uses: sha256Hex(token) and update(`${salt}:${code}`, 'utf8').
    expect(shim.createHash('sha256').update(`a1b2:${text}`, 'utf8').digest('hex')).toBe(nodeCrypto.createHash('sha256').update(`a1b2:${text}`, 'utf8').digest('hex'));
    expect(shim.createHash('SHA256').update('abc').digest('hex')).toBe(nodeCrypto.createHash('SHA256').update('abc').digest('hex'));
  });

  it('copy() continues independently; a finalised hash refuses more work, like Node', () => {
    const hash = shim.createHash('sha256').update('common prefix ');
    const fork = hash.copy();
    expect(hash.update('A').digest('hex')).toBe(nodeCrypto.createHash('sha256').update('common prefix A').digest('hex'));
    expect(fork.update('B').digest('hex')).toBe(nodeCrypto.createHash('sha256').update('common prefix B').digest('hex'));

    const nodeHash = nodeCrypto.createHash('sha256');
    nodeHash.digest();
    expect(thrown(() => hash.digest())).toEqual(thrown(() => nodeHash.digest()));
    expect(thrown(() => hash.update('x'))).toEqual(thrown(() => nodeHash.update('x')));
  });

  it('update() refuses a hex string of odd length like Node (Buffer.from would drop the last digit)', () => {
    const full = (run: () => unknown): unknown => {
      try {
        run();
        return null;
      } catch (e) {
        const error = e as Error & { code?: string };
        return { name: error.name, code: error.code, message: error.message };
      }
    };
    for (const [text, encoding] of [['00ff1', 'hex'], ['abc', 'HEX'], ['a', 'Hex']] as const) {
      const onNode = full(() => nodeCrypto.createHash('sha256').update(text, encoding as BufferEncoding));
      expect(onNode, `${text} ${encoding}`).toMatchObject({ name: 'TypeError', code: 'ERR_INVALID_ARG_VALUE' });
      expect(full(() => shim.createHash('sha256').update(text, encoding)), `${text} ${encoding}`).toEqual(onNode);
    }
    // The hash is still usable after the refusal, and what is not odd-length hex is hashed as before.
    const hash = shim.createHash('sha256').update('00', 'hex');
    expect(() => hash.update('f', 'hex')).toThrow(/invalid for data of length 1/);
    expect(hash.update('ff', 'hex').digest('hex')).toBe(nodeCrypto.createHash('sha256').update('00ff', 'hex').digest('hex'));
    for (const [text, encoding] of [['', 'hex'], ['00zz', 'hex'], ['abc', 'utf8'], ['abc', 'base64'], ['abc', 'latin1']] as const) {
      expect(shim.createHash('sha256').update(text, encoding).digest('hex'), `${text} ${encoding}`).toBe(
        nodeCrypto.createHash('sha256').update(text, encoding as BufferEncoding).digest('hex'),
      );
    }
    // Bytes are never text: an encoding argument beside them is ignored.
    expect(shim.createHash('sha256').update(Buffer.from('abc'), 'hex').digest('hex')).toBe(nodeCrypto.createHash('sha256').update('abc').digest('hex'));
  });

  it('refuses other digests and bad input with a clear error', () => {
    expect(() => shim.createHash('md5')).toThrow(/SHA-256 only/);
    expect(thrown(() => shim.createHash('sha256').update(5 as never))).toEqual(thrown(() => nodeCrypto.createHash('sha256').update(5 as never)));
  });
});

describe('timingSafeEqual', () => {
  it('compares bytes, for every kind of view', () => {
    const a = nodeCrypto.randomBytes(32);
    const same = Buffer.from(a);
    const different = Buffer.from(a);
    different[31] ^= 0x80;
    expect(shim.timingSafeEqual(a, same)).toBe(true);
    expect(shim.timingSafeEqual(a, different)).toBe(false);
    expect(shim.timingSafeEqual(PolyfillBuffer.from(a), new Uint8Array(a))).toBe(true);
    expect(shim.timingSafeEqual(new DataView(new Uint8Array(a).buffer), a)).toBe(true);
    expect(shim.timingSafeEqual(new Uint8Array(0), new Uint8Array(0))).toBe(true);
    // A view is compared by its bytes, not by its elements.
    expect(shim.timingSafeEqual(new Uint16Array([1, 2]), new Uint8Array(new Uint16Array([1, 2]).buffer))).toBe(true);
    // Every single-bit difference is found.
    for (let bit = 0; bit < 64; bit++) {
      const x = new Uint8Array(8);
      const y = new Uint8Array(8);
      y[bit >> 3] = 1 << (bit & 7);
      expect(shim.timingSafeEqual(x, y), `bit ${bit}`).toBe(false);
    }
  });

  it('throws on a length mismatch and on non-buffers, with the errors of Node', () => {
    const a = Buffer.alloc(4);
    const b = Buffer.alloc(5);
    const onNode = thrown(() => nodeCrypto.timingSafeEqual(a, b));
    expect(onNode).toEqual({ name: 'RangeError', code: 'ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH' });
    expect(thrown(() => shim.timingSafeEqual(a, b))).toEqual(onNode);
    expect(thrown(() => shim.timingSafeEqual('abcd' as never, a))).toEqual(thrown(() => nodeCrypto.timingSafeEqual('abcd' as never, a)));
    expect(thrown(() => shim.timingSafeEqual(a, null as never))).toEqual(thrown(() => nodeCrypto.timingSafeEqual(a, null as never)));
  });

  it('examines every byte whatever the position of the first difference (no early exit)', () => {
    // Reads of the second argument are counted through a Proxy-free trick: a subclass with a getter
    // would change nothing for typed arrays, so the source is checked instead - it must not return
    // from inside the loop.
    const source = shim.timingSafeEqual.toString();
    const loop = source.slice(source.indexOf('for ('));
    expect(loop.slice(0, loop.indexOf('return'))).not.toMatch(/break|return/);
    expect(source).toMatch(/\|=/);
  });
});

describe('randomBytes', () => {
  it('returns a polyfill Buffer of the requested size, also above one getRandomValues block', () => {
    for (const size of [0, 1, 16, 32, 65536, 65537, 200_000]) {
      const bytes = shim.randomBytes(size);
      expect(bytes).toBeInstanceOf(PolyfillBuffer);
      expect(bytes.length).toBe(size);
    }
    // Every part of a large buffer was filled (a block left at zero would show as a long zero run).
    const large = shim.randomBytes(200_000);
    for (let offset = 0; offset < large.length; offset += 4096) {
      expect(large.subarray(offset, offset + 4096).some((byte) => byte !== 0), `block at ${offset}`).toBe(true);
    }
    expect(shim.randomBytes(32).toString('hex')).not.toBe(shim.randomBytes(32).toString('hex'));
  });

  it('writes the encodings the server asks for exactly like Node (hex, base64, base64url)', () => {
    const bytes = shim.randomBytes(32);
    const nodeCopy = Buffer.from(bytes);
    for (const encoding of ['hex', 'base64', 'base64url'] as const) {
      expect(bytes.toString(encoding)).toBe(nodeCopy.toString(encoding));
    }
    expect(bytes.toString('base64url')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('supports the callback form and validates the size like Node', async () => {
    const viaCallback = await new Promise<Buffer>((resolve, reject) => shim.randomBytes(8, (err, buf) => (err ? reject(err) : resolve(buf))));
    expect(viaCallback.length).toBe(8);
    for (const bad of [-1, 2 ** 31, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(thrown(() => nodeCrypto.randomBytes(bad)), String(bad)).not.toBeNull();
      expect(thrown(() => shim.randomBytes(bad)), String(bad)).toEqual(thrown(() => nodeCrypto.randomBytes(bad)));
    }
    // A fractional size is truncated by both.
    expect(shim.randomBytes(2.9).length).toBe(nodeCrypto.randomBytes(2.9).length);
    expect(thrown(() => shim.randomBytes('8' as never))).toEqual(thrown(() => nodeCrypto.randomBytes('8' as never)));
  });
});

describe('randomInt', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stays inside [min, max) for the ranges the server uses', () => {
    for (let i = 0; i < 2000; i++) {
      const delay = shim.randomInt(200, 1201);
      expect(delay).toBeGreaterThanOrEqual(200);
      expect(delay).toBeLessThan(1201);
      const code = shim.randomInt(0, 10 ** 6);
      expect(Number.isInteger(code)).toBe(true);
      expect(code).toBeGreaterThanOrEqual(0);
      expect(code).toBeLessThan(10 ** 6);
      expect(shim.randomInt(5)).toBeLessThan(5);
      expect(shim.randomInt(-3, -2)).toBe(-3);
    }
  });

  it('is uniform: every value of a small range appears about equally often', () => {
    const range = 6;
    const draws = 60_000;
    const counts = new Array<number>(range).fill(0);
    for (let i = 0; i < draws; i++) counts[shim.randomInt(range)] += 1;
    // Binomial(60000, 1/6): mean 10000, standard deviation 91. Six sigma on each side.
    for (let value = 0; value < range; value++) {
      expect(counts[value], `value ${value}`).toBeGreaterThan(10_000 - 6 * 92);
      expect(counts[value], `value ${value}`).toBeLessThan(10_000 + 6 * 92);
    }
    // The high digit of a reset code is uniform as well (a modulo bias would favour low values).
    const digits = new Array<number>(10).fill(0);
    for (let i = 0; i < 50_000; i++) digits[Math.floor(shim.randomInt(0, 10 ** 6) / 10 ** 5)] += 1;
    for (let digit = 0; digit < 10; digit++) {
      expect(Math.abs(digits[digit] - 5000), `digit ${digit}`).toBeLessThan(6 * 68);
    }
  });

  /** Makes getRandomValues return the given 6-byte values, one per call. */
  function feed(...values: number[][]): ReturnType<typeof vi.spyOn> {
    let call = 0;
    return vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((array: Uint8Array) => {
      array.set(values[Math.min(call, values.length - 1)]);
      call += 1;
      return array;
    }) as never);
  }

  it('rejects draws from the incomplete tail of the 48-bit space instead of folding them (no modulo bias)', () => {
    // range 3 * 2^46: the 48-bit space holds one full copy and a third of another one; values at
    // or above 3 * 2^46 must be drawn again, not reduced modulo the range.
    const range = 3 * 2 ** 46;
    const spy = feed([0xff, 0xff, 0xff, 0xff, 0xff, 0xff], [0xc0, 0, 0, 0, 0, 0], [0xbf, 0xff, 0xff, 0xff, 0xff, 0xff]);
    expect(shim.randomInt(range)).toBe(0xbfff_ffff_ffff);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('reads the 48 bits big-endian and maps them like Node (value % range + min)', () => {
    feed([0, 0, 0, 0, 0, 7]);
    expect(shim.randomInt(10, 20)).toBe(17);
    vi.restoreAllMocks();
    feed([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc]);
    expect(shim.randomInt(0, 2 ** 47)).toBe(0x1234_5678_9abc % 2 ** 47);
    vi.restoreAllMocks();
    feed([0x80, 0, 0, 0, 0x80, 0]);
    expect(shim.randomInt(0, 0xffff_ffff_ffff)).toBe(0x8000_0000_8000);
  });

  it('validates its arguments like Node', () => {
    const cases: Array<[string, (f: typeof shim.randomInt) => unknown]> = [
      ['max <= min', (f) => f(5, 5)],
      ['max < min', (f) => f(10, 1)],
      ['max of 0', (f) => f(0)],
      ['non-integer max', (f) => f(1.5)],
      ['non-integer min', (f) => f(0.5, 3)],
      ['unsafe max', (f) => f(2 ** 53)],
      ['range above 48 bits', (f) => f(0, 2 ** 48 + 1)],
      ['string max', (f) => f('6' as never)],
    ];
    for (const [label, call] of cases) {
      const onNode = thrown(() => call(nodeCrypto.randomInt as never));
      expect(onNode, label).not.toBeNull();
      expect(thrown(() => call(shim.randomInt)), label).toEqual(onNode);
    }
    // The largest range of Node works.
    expect(shim.randomInt(0, 2 ** 48 - 1)).toBeGreaterThanOrEqual(0);
  });

  it('supports the callback forms', async () => {
    const a = await new Promise<number>((resolve, reject) => shim.randomInt(3, (err, value) => (err ? reject(err) : resolve(value))));
    const b = await new Promise<number>((resolve, reject) => shim.randomInt(7, 9, (err, value) => (err ? reject(err) : resolve(value))));
    expect(a).toBeLessThan(3);
    expect(b === 7 || b === 8).toBe(true);
  });
});

describe('what the mobile core does not have', () => {
  it('the key-pair and certificate functions of remote access import fine and throw when called', () => {
    for (const name of ['createPrivateKey', 'createPublicKey', 'generateKeyPairSync', 'sign', 'verify'] as const) {
      expect(thrown(() => (shim[name] as (...args: unknown[]) => unknown)('x')), name).toEqual({ name: 'MobileUnavailableError', code: MOBILE_UNAVAILABLE_CODE });
    }
    expect(() => new shim.X509Certificate('pem')).toThrow(/node:crypto new X509Certificate\(\) is not available on mobile/);
  });

  it('the default export carries the same functions (import crypto from "node:crypto")', () => {
    expect(shimDefault.randomBytes).toBe(shim.randomBytes);
    expect(shimDefault.createHash).toBe(shim.createHash);
    expect(shimDefault.scrypt).toBe(shim.scrypt);
    expect(shimDefault.createCipheriv).toBe(shim.createCipheriv);
  });

  it('exports every name server/src imports from node:crypto', () => {
    const imported = ['createHash', 'randomBytes', 'scrypt', 'timingSafeEqual', 'createCipheriv', 'createDecipheriv', 'randomInt', 'createPrivateKey', 'createPublicKey', 'sign', 'generateKeyPairSync', 'X509Certificate'];
    for (const name of imported) expect(typeof (shim as Record<string, unknown>)[name], name).toBe('function');
  });
});
