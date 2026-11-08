// @vitest-environment node
/**
 * AES-256-GCM of the Android core (mobile/core/shims/crypto.ts, @noble/ciphers behind Node's
 * createCipheriv / createDecipheriv facade) against node:crypto. Every container of the app
 * (.mpd diary, backup, wrapped keys, the SMTP password) is AES-256-GCM with a 12-byte nonce, AAD
 * and a 16-byte tag, so both implementations must produce and accept the same bytes.
 */
import nodeCrypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Buffer as PolyfillBuffer } from '../../core/shims/buffer';
import * as shim from '../../core/shims/crypto';

const ALGORITHM = 'aes-256-gcm';
const MEGABYTE = 1024 * 1024;
const SIZES = [0, 1, 15, 16, 17, 31, 32, 33, 4095, MEGABYTE];
const AUTH_FAILED = 'Unsupported state or unable to authenticate data';

interface Sealed {
  body: Buffer;
  tag: Buffer;
}

type Bytes = Uint8Array;

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('hex');
}

function nodeEncrypt(key: Bytes, nonce: Bytes, aad: Bytes | null, plain: Bytes): Sealed {
  const cipher = nodeCrypto.createCipheriv(ALGORITHM, key, nonce, { authTagLength: 16 });
  if (aad) cipher.setAAD(aad);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { body, tag: cipher.getAuthTag() };
}

function nodeDecrypt(key: Bytes, nonce: Bytes, aad: Bytes | null, sealed: { body: Bytes; tag: Bytes }): Buffer {
  const decipher = nodeCrypto.createDecipheriv(ALGORITHM, key, nonce, { authTagLength: 16 });
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(sealed.tag);
  return Buffer.concat([decipher.update(sealed.body), decipher.final()]);
}

function shimEncrypt(key: Bytes, nonce: Bytes, aad: Bytes | null, plain: Bytes): Sealed {
  const cipher = shim.createCipheriv(ALGORITHM, key, nonce, { authTagLength: 16 });
  if (aad) cipher.setAAD(aad);
  const body = PolyfillBuffer.concat([cipher.update(plain), cipher.final()]);
  return { body, tag: cipher.getAuthTag() };
}

function shimDecrypt(key: Bytes, nonce: Bytes, aad: Bytes | null, sealed: { body: Bytes; tag: Bytes }): Buffer {
  const decipher = shim.createDecipheriv(ALGORITHM, key, nonce, { authTagLength: 16 });
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(sealed.tag);
  return PolyfillBuffer.concat([decipher.update(sealed.body), decipher.final()]);
}

function flipBit(bytes: Uint8Array, index: number): Buffer {
  const copy = Buffer.from(bytes);
  copy[index] ^= 0x01;
  return copy;
}

function thrown(run: () => unknown): { name: string; code: string | undefined; message: string } | null {
  try {
    run();
    return null;
  } catch (e) {
    const error = e as Error & { code?: string };
    return { name: error.name, code: error.code, message: error.message };
  }
}

describe('AES-256-GCM: shim and node:crypto produce and accept the same bytes', () => {
  for (const size of SIZES) {
    it(`plaintext of ${size} bytes, random key / nonce / AAD: both directions`, () => {
      const rounds = size >= MEGABYTE ? 2 : 6;
      for (let round = 0; round < rounds; round++) {
        const key = nodeCrypto.randomBytes(32);
        const nonce = nodeCrypto.randomBytes(12);
        // No AAD at all, empty AAD, the 49-byte header of a container, and odd lengths.
        const aad = [null, Buffer.alloc(0), nodeCrypto.randomBytes(49), nodeCrypto.randomBytes(1), nodeCrypto.randomBytes(22), nodeCrypto.randomBytes(200)][round % 6];
        const plain = nodeCrypto.randomBytes(size);

        const byShim = shimEncrypt(key, nonce, aad, plain);
        const byNode = nodeEncrypt(key, nonce, aad, plain);
        expect(byShim.body.length).toBe(size);
        expect(byShim.tag.length).toBe(16);
        // GCM is deterministic for a given key / nonce: the two must be identical byte for byte.
        expect(Buffer.from(byShim.body).equals(byNode.body), `ciphertext, round ${round}`).toBe(true);
        expect(hex(byShim.tag), `tag, round ${round}`).toBe(byNode.tag.toString('hex'));

        // shim-encrypt -> node-decrypt, node-encrypt -> shim-decrypt.
        expect(nodeDecrypt(key, nonce, aad, byShim).equals(plain), `shim -> node, round ${round}`).toBe(true);
        expect(Buffer.from(shimDecrypt(key, nonce, aad, byNode)).equals(plain), `node -> shim, round ${round}`).toBe(true);
      }
    });
  }

  it('returns Buffers of the polyfill, like every Buffer in the core', () => {
    const sealed = shimEncrypt(nodeCrypto.randomBytes(32), nodeCrypto.randomBytes(12), null, Buffer.from('x'));
    expect(sealed.body).toBeInstanceOf(PolyfillBuffer);
    expect(sealed.tag).toBeInstanceOf(PolyfillBuffer);
  });

  it('several update() calls equal one, and several setAAD() calls equal the concatenation', () => {
    const key = nodeCrypto.randomBytes(32);
    const nonce = nodeCrypto.randomBytes(12);
    const parts = [nodeCrypto.randomBytes(5), nodeCrypto.randomBytes(16), Buffer.alloc(0), nodeCrypto.randomBytes(1000)];
    const aadParts = [nodeCrypto.randomBytes(10), nodeCrypto.randomBytes(7)];
    const expected = nodeEncrypt(key, nonce, Buffer.concat(aadParts), Buffer.concat(parts));

    const cipher = shim.createCipheriv(ALGORITHM, key, nonce);
    for (const aad of aadParts) cipher.setAAD(aad);
    const out = PolyfillBuffer.concat([...parts.map((part) => cipher.update(part)), cipher.final()]);
    expect(hex(out)).toBe(expected.body.toString('hex'));
    expect(hex(cipher.getAuthTag())).toBe(expected.tag.toString('hex'));

    const decipher = shim.createDecipheriv(ALGORITHM, key, nonce);
    for (const aad of aadParts) decipher.setAAD(aad);
    decipher.setAuthTag(expected.tag);
    const half = Math.floor(expected.body.length / 2);
    const plain = PolyfillBuffer.concat([decipher.update(expected.body.subarray(0, half)), decipher.update(expected.body.subarray(half)), decipher.final()]);
    expect(hex(plain)).toBe(Buffer.concat(parts).toString('hex'));
  });

  it('string input and output encodings (the SMTP password path: update(text, "utf8"))', () => {
    const key = nodeCrypto.randomBytes(32);
    const nonce = nodeCrypto.randomBytes(12);
    const text = 'סיסמת דואר pässword ✉ 密码';

    const nodeCipher = nodeCrypto.createCipheriv(ALGORITHM, key, nonce);
    const expected = Buffer.concat([nodeCipher.update(text, 'utf8'), nodeCipher.final()]);
    const cipher = shim.createCipheriv(ALGORITHM, key, nonce);
    const body = PolyfillBuffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    expect(hex(body)).toBe(expected.toString('hex'));
    expect(hex(cipher.getAuthTag())).toBe(nodeCipher.getAuthTag().toString('hex'));

    // Hex in, hex out: the concatenation of update() and final() is the whole ciphertext.
    const hexCipher = shim.createCipheriv(ALGORITHM, key, nonce);
    const asHex = hexCipher.update(Buffer.from(text, 'utf8').toString('hex'), 'hex', 'hex') + hexCipher.final('hex');
    expect(asHex).toBe(expected.toString('hex'));

    const decipher = shim.createDecipheriv(ALGORITHM, key, nonce);
    decipher.setAuthTag(nodeCipher.getAuthTag().toString('base64'), 'base64');
    expect(decipher.update(expected.toString('base64'), 'base64', 'utf8') + decipher.final('utf8')).toBe(text);
  });

  it('update() refuses a hex string of odd length like Node, and the cipher works on afterwards', () => {
    const key = nodeCrypto.randomBytes(32);
    const nonce = nodeCrypto.randomBytes(12);
    const aad = Buffer.from('header');
    for (const [text, encoding] of [['00ff1', 'hex'], ['abc', 'HEX'], ['f', 'hex']] as const) {
      const onNode = thrown(() => nodeCrypto.createCipheriv(ALGORITHM, key, nonce).update(text, encoding as 'hex'));
      expect(onNode, `${text} ${encoding}`).toMatchObject({ name: 'TypeError', code: 'ERR_INVALID_ARG_VALUE' });
      expect(thrown(() => shim.createCipheriv(ALGORITHM, key, nonce).update(text, encoding)), `cipher ${text}`).toEqual(onNode);
      expect(thrown(() => shim.createCipheriv(ALGORITHM, key, nonce).update(text, encoding, 'hex')), `cipher ${text}, hex out`).toEqual(onNode);
      expect(thrown(() => shim.createDecipheriv(ALGORITHM, key, nonce).update(text, encoding)), `decipher ${text}`).toEqual(
        thrown(() => nodeCrypto.createDecipheriv(ALGORITHM, key, nonce).update(text, encoding as 'hex')),
      );
    }

    // Nothing of the refused string was taken: AAD can still be set, and the result is that of the valid input alone.
    const nodeCipher = nodeCrypto.createCipheriv(ALGORITHM, key, nonce);
    expect(() => nodeCipher.update('00ff1', 'hex')).toThrow();
    nodeCipher.setAAD(aad);
    const expected = Buffer.concat([nodeCipher.update('00ff', 'hex'), nodeCipher.final()]);
    const cipher = shim.createCipheriv(ALGORITHM, key, nonce);
    expect(() => cipher.update('00ff1', 'hex')).toThrow();
    cipher.setAAD(aad);
    const body = PolyfillBuffer.concat([cipher.update('00ff', 'hex'), cipher.final()]);
    expect(hex(body)).toBe(expected.toString('hex'));
    expect(hex(cipher.getAuthTag())).toBe(nodeCipher.getAuthTag().toString('hex'));

    // Not refused, as in Node: an odd-length tag in hex (it is the tag length that counts there),
    // bytes with an encoding beside them, odd-length text in another encoding.
    const tagHex = `${nodeCipher.getAuthTag().toString('hex')}f`;
    expect(thrown(() => nodeCrypto.createDecipheriv(ALGORITHM, key, nonce).setAuthTag(tagHex, 'hex'))).toBeNull();
    expect(thrown(() => shim.createDecipheriv(ALGORITHM, key, nonce).setAuthTag(tagHex, 'hex'))).toBeNull();
    const fromBytes = shim.createCipheriv(ALGORITHM, key, nonce);
    const nodeFromBytes = nodeCrypto.createCipheriv(ALGORITHM, key, nonce);
    expect(hex(PolyfillBuffer.concat([fromBytes.update(Buffer.from('abc'), 'hex'), fromBytes.final()]))).toBe(
      Buffer.concat([nodeFromBytes.update(Buffer.from('abc'), 'hex' as never), nodeFromBytes.final()]).toString('hex'),
    );
    const fromText = shim.createCipheriv(ALGORITHM, key, nonce);
    const nodeFromText = nodeCrypto.createCipheriv(ALGORITHM, key, nonce);
    expect(hex(PolyfillBuffer.concat([fromText.update('abc', 'latin1'), fromText.final()]))).toBe(
      Buffer.concat([nodeFromText.update('abc', 'latin1'), nodeFromText.final()]).toString('hex'),
    );
  });

  it('nonces of other lengths (8, 16, 32 bytes) and the 128 / 192-bit keys match Node too', () => {
    const plain = nodeCrypto.randomBytes(100);
    for (const nonceLength of [8, 13, 16, 32]) {
      const key = nodeCrypto.randomBytes(32);
      const nonce = nodeCrypto.randomBytes(nonceLength);
      const byNode = nodeEncrypt(key, nonce, null, plain);
      const byShim = shimEncrypt(key, nonce, null, plain);
      expect(hex(byShim.body) + hex(byShim.tag), `nonce ${nonceLength}`).toBe(byNode.body.toString('hex') + byNode.tag.toString('hex'));
    }
    for (const bits of [128, 192]) {
      const key = nodeCrypto.randomBytes(bits / 8);
      const nonce = nodeCrypto.randomBytes(12);
      const nodeCipher = nodeCrypto.createCipheriv(`aes-${bits}-gcm` as 'aes-128-gcm', key, nonce);
      const expected = Buffer.concat([nodeCipher.update(plain), nodeCipher.final(), nodeCipher.getAuthTag()]);
      const cipher = shim.createCipheriv(`aes-${bits}-gcm`, key, nonce);
      const actual = PolyfillBuffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
      expect(hex(actual), `aes-${bits}-gcm`).toBe(expected.toString('hex'));
    }
  });

  it('wiping the key after creating the cipher does not change the result (the server wipes keys)', () => {
    const key = nodeCrypto.randomBytes(32);
    const nonce = nodeCrypto.randomBytes(12);
    const plain = Buffer.from('wipe the key afterwards');
    const expected = nodeEncrypt(key, nonce, null, plain);
    const keyCopy = Buffer.from(key);
    const cipher = shim.createCipheriv(ALGORITHM, keyCopy, nonce);
    keyCopy.fill(0);
    expect(hex(PolyfillBuffer.concat([cipher.update(plain), cipher.final()]))).toBe(expected.body.toString('hex'));
  });
});

describe('AES-256-GCM: authentication failures', () => {
  const key = nodeCrypto.randomBytes(32);
  const nonce = nodeCrypto.randomBytes(12);
  const aad = nodeCrypto.randomBytes(49);
  const plain = nodeCrypto.randomBytes(1000);
  const sealed = nodeEncrypt(key, nonce, aad, plain);

  it('the untouched message opens', () => {
    expect(Buffer.from(shimDecrypt(key, nonce, aad, sealed)).equals(plain)).toBe(true);
  });

  const tampered: Array<[string, () => Buffer, () => Buffer]> = [
    ['a flipped tag bit', () => shimDecrypt(key, nonce, aad, { body: sealed.body, tag: flipBit(sealed.tag, 0) }), () => nodeDecrypt(key, nonce, aad, { body: sealed.body, tag: flipBit(sealed.tag, 0) })],
    ['the last tag bit', () => shimDecrypt(key, nonce, aad, { body: sealed.body, tag: flipBit(sealed.tag, 15) }), () => nodeDecrypt(key, nonce, aad, { body: sealed.body, tag: flipBit(sealed.tag, 15) })],
    ['a flipped ciphertext bit', () => shimDecrypt(key, nonce, aad, { body: flipBit(sealed.body, 500), tag: sealed.tag }), () => nodeDecrypt(key, nonce, aad, { body: flipBit(sealed.body, 500), tag: sealed.tag })],
    ['a truncated ciphertext', () => shimDecrypt(key, nonce, aad, { body: sealed.body.subarray(0, 999), tag: sealed.tag }), () => nodeDecrypt(key, nonce, aad, { body: sealed.body.subarray(0, 999), tag: sealed.tag })],
    ['a different AAD', () => shimDecrypt(key, nonce, flipBit(aad, 13), sealed), () => nodeDecrypt(key, nonce, flipBit(aad, 13), sealed)],
    ['a shorter AAD', () => shimDecrypt(key, nonce, aad.subarray(0, 48), sealed), () => nodeDecrypt(key, nonce, aad.subarray(0, 48), sealed)],
    ['no AAD', () => shimDecrypt(key, nonce, null, sealed), () => nodeDecrypt(key, nonce, null, sealed)],
    ['a different nonce', () => shimDecrypt(key, flipBit(nonce, 3), aad, sealed), () => nodeDecrypt(key, flipBit(nonce, 3), aad, sealed)],
    ['a different key', () => shimDecrypt(flipBit(key, 31), nonce, aad, sealed), () => nodeDecrypt(flipBit(key, 31), nonce, aad, sealed)],
  ];

  for (const [label, onShim, onNode] of tampered) {
    it(`${label}: final() throws, exactly like Node`, () => {
      const nodeError = thrown(onNode);
      const shimError = thrown(onShim);
      expect(nodeError?.message).toBe(AUTH_FAILED);
      expect(shimError?.message).toBe(AUTH_FAILED);
      expect(shimError?.name).toBe(nodeError?.name);
    });
  }

  it('final() without setAuthTag() throws like Node', () => {
    const run = (factory: typeof nodeCrypto.createDecipheriv | typeof shim.createDecipheriv): unknown => {
      const decipher = factory(ALGORITHM, key, nonce);
      decipher.update(sealed.body);
      return decipher.final();
    };
    expect(thrown(() => run(nodeCrypto.createDecipheriv))?.message).toBe(AUTH_FAILED);
    expect(thrown(() => run(shim.createDecipheriv))?.message).toBe(AUTH_FAILED);
  });

  it('a failed decipher hands out no plaintext: update() returns nothing before the tag is checked', () => {
    const decipher = shim.createDecipheriv(ALGORITHM, key, nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(flipBit(sealed.tag, 5));
    expect(decipher.update(sealed.body).length).toBe(0);
    expect(() => decipher.final()).toThrow(AUTH_FAILED);
  });
});

describe('AES-256-GCM: argument and state checks', () => {
  const key = nodeCrypto.randomBytes(32);
  const nonce = nodeCrypto.randomBytes(12);

  it('rejects a key of the wrong length with the error of Node', () => {
    for (const length of [0, 16, 31, 33, 64]) {
      const bad = nodeCrypto.randomBytes(length);
      const onNode = thrown(() => nodeCrypto.createCipheriv(ALGORITHM, bad, nonce));
      const onShim = thrown(() => shim.createCipheriv(ALGORITHM, bad, nonce));
      expect(onNode, `key of ${length} bytes`).not.toBeNull();
      expect(onShim, `key of ${length} bytes`).toEqual(onNode);
      expect(thrown(() => shim.createDecipheriv(ALGORITHM, bad, nonce))).toEqual(onNode);
    }
  });

  it('rejects other ciphers, short nonces and other tag lengths with a clear message', () => {
    expect(thrown(() => shim.createCipheriv('aes-256-cbc', key, nodeCrypto.randomBytes(16)))).toMatchObject({ code: 'ERR_CRYPTO_UNKNOWN_CIPHER' });
    expect(thrown(() => shim.createCipheriv('chacha20-poly1305', key, nonce))?.message).toMatch(/AES-GCM only/);
    expect(thrown(() => shim.createCipheriv(ALGORITHM, key, nodeCrypto.randomBytes(7)))).toMatchObject({ code: 'ERR_CRYPTO_INVALID_IV' });
    expect(thrown(() => shim.createCipheriv(ALGORITHM, key, null))).toMatchObject({ code: 'ERR_INVALID_ARG_TYPE' });
    expect(thrown(() => shim.createCipheriv(ALGORITHM, key, nonce, { authTagLength: 12 }))?.message).toMatch(/16-byte tags only/);
    expect(thrown(() => shim.createCipheriv(ALGORITHM, 5 as never, nonce))).toMatchObject({ code: 'ERR_INVALID_ARG_TYPE' });
  });

  it('rejects a tag that is not 16 bytes, like Node', () => {
    for (const length of [0, 15, 17]) {
      const tag = Buffer.alloc(length);
      const onNode = thrown(() => nodeCrypto.createDecipheriv(ALGORITHM, key, nonce, { authTagLength: 16 }).setAuthTag(tag));
      const onShim = thrown(() => shim.createDecipheriv(ALGORITHM, key, nonce, { authTagLength: 16 }).setAuthTag(tag));
      expect(onNode, `tag of ${length} bytes`).not.toBeNull();
      expect(onShim?.code, `tag of ${length} bytes`).toBe(onNode?.code);
      expect(onShim?.name).toBe(onNode?.name);
    }
  });

  it('getAuthTag() before final(), and anything after final(), is an invalid state as in Node', () => {
    const nodeCipher = nodeCrypto.createCipheriv(ALGORITHM, key, nonce);
    const cipher = shim.createCipheriv(ALGORITHM, key, nonce);
    expect(thrown(() => cipher.getAuthTag())?.code).toBe(thrown(() => nodeCipher.getAuthTag())?.code);

    nodeCipher.final();
    cipher.final();
    expect(thrown(() => nodeCipher.final())).not.toBeNull();
    expect(thrown(() => cipher.final())?.code).toBe('ERR_CRYPTO_INVALID_STATE');
    expect(thrown(() => nodeCipher.update(Buffer.from('x')))).not.toBeNull();
    expect(thrown(() => cipher.update(Buffer.from('x')))?.code).toBe('ERR_CRYPTO_INVALID_STATE');
    // The tag stays readable, and reading it twice gives independent copies.
    const first = cipher.getAuthTag();
    first.fill(0);
    expect(hex(cipher.getAuthTag())).toBe(nodeCipher.getAuthTag().toString('hex'));
  });

  it('setAAD() after update() is refused (the AAD must come first)', () => {
    const cipher = shim.createCipheriv(ALGORITHM, key, nonce);
    cipher.update(Buffer.from('data'));
    expect(thrown(() => cipher.setAAD(Buffer.from('late')))?.code).toBe('ERR_CRYPTO_INVALID_STATE');
  });
});

describe('AES-256-GCM: speed of the pure-JS implementation (reported)', () => {
  it('encrypts and decrypts 1 MB', () => {
    const key = nodeCrypto.randomBytes(32);
    const nonce = nodeCrypto.randomBytes(12);
    const plain = nodeCrypto.randomBytes(MEGABYTE);
    shimEncrypt(key, nonce, null, plain.subarray(0, 4096)); // warm-up
    let start = performance.now();
    const sealed = shimEncrypt(key, nonce, null, plain);
    const encryptMs = performance.now() - start;
    start = performance.now();
    shimDecrypt(key, nonce, null, sealed);
    const decryptMs = performance.now() - start;
    console.info(`[aes-gcm timing] 1 MB with @noble/ciphers under Node: encrypt ${encryptMs.toFixed(1)} ms, decrypt ${decryptMs.toFixed(1)} ms`);
    expect(encryptMs).toBeLessThan(5_000);
  });
});
