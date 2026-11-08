import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/errors';
import {
  CONTAINER_MAGIC,
  decryptContainer,
  decryptWithPassword,
  encryptContainer,
  HEADER_LENGTH,
  isContainer,
  parseHeader,
  TAG_LENGTH,
} from '../src/security/container';
import { deriveSecret, splitSecret } from '../src/security/kdf';

const FAST = { N: 1024, r: 8, p: 1 };

async function keyFor(password: string, salt: Buffer) {
  return splitSecret(await deriveSecret(password, salt, FAST)).key;
}

describe('container format', () => {
  it('round-trips and lays the header out exactly as specified', async () => {
    const salt = Buffer.alloc(16, 0xab);
    const key = await keyFor('Secret123', salt);
    const plain = Buffer.from('SQLite format 3\0 pretend image ' + 'x'.repeat(1000));
    const bytes = encryptContainer(plain, key, salt, FAST);

    expect(bytes.length).toBe(HEADER_LENGTH + plain.length + TAG_LENGTH);
    expect(bytes.subarray(0, 8).toString('latin1')).toBe('MPDIARY\x01');
    expect(bytes.subarray(0, 8).equals(CONTAINER_MAGIC)).toBe(true);
    expect(bytes[8]).toBe(1);
    expect(bytes.readUInt32LE(9)).toBe(1024);
    expect(bytes.readUInt32LE(13)).toBe(8);
    expect(bytes.readUInt32LE(17)).toBe(1);
    expect(bytes.subarray(21, 37).equals(salt)).toBe(true);
    expect(isContainer(bytes)).toBe(true);

    const header = parseHeader(bytes);
    expect(header.version).toBe(1);
    expect(header.kdf).toEqual(FAST);
    expect(header.salt.equals(salt)).toBe(true);
    expect(header.nonce.length).toBe(12);

    const { plain: out } = decryptContainer(bytes, key);
    expect(out.equals(plain)).toBe(true);
    // Ciphertext must not contain the plaintext.
    expect(bytes.includes(Buffer.from('pretend image'))).toBe(false);
  });

  it('uses a fresh nonce for every write', async () => {
    const salt = Buffer.alloc(16, 1);
    const key = await keyFor('Secret123', salt);
    const a = encryptContainer(Buffer.from('same'), key, salt, FAST);
    const b = encryptContainer(Buffer.from('same'), key, salt, FAST);
    expect(a.subarray(37, 49).equals(b.subarray(37, 49))).toBe(false);
    expect(a.subarray(49).equals(b.subarray(49))).toBe(false);
  });

  it('decrypts with the password by re-deriving the key from the header', async () => {
    const salt = randomBytes(16);
    const key = await keyFor('Secret123', salt);
    const bytes = encryptContainer(Buffer.from('hello'), key, salt, FAST);
    const result = await decryptWithPassword(bytes, 'Secret123');
    expect(result.plain.toString()).toBe('hello');
    expect(result.key.equals(key)).toBe(true);
    expect(result.header.kdf).toEqual(FAST);
  });

  it('reports a wrong password as WRONG_PASSWORD (400, never 401)', async () => {
    const salt = randomBytes(16);
    const key = await keyFor('Secret123', salt);
    const bytes = encryptContainer(Buffer.from('hello'), key, salt, FAST);
    const err = await decryptWithPassword(bytes, 'Secret124').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('WRONG_PASSWORD');
    expect((err as ApiError).status).toBe(400);
  });

  it('detects tampering: a flipped byte anywhere fails with CRYPTO', async () => {
    const salt = randomBytes(16);
    const key = await keyFor('Secret123', salt);
    const bytes = encryptContainer(Buffer.from('a'.repeat(200)), key, salt, FAST);
    for (const offset of [HEADER_LENGTH + 10, bytes.length - 1, 21 /* salt */, 40 /* nonce */]) {
      const bad = Buffer.from(bytes);
      bad[offset] ^= 0x01;
      const err = (() => {
        try {
          decryptContainer(bad, key);
          return null;
        } catch (e) {
          return e;
        }
      })();
      expect(err, `offset ${offset}`).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('CRYPTO');
    }
  });

  it('rejects a wrong key with CRYPTO', async () => {
    const salt = randomBytes(16);
    const key = await keyFor('Secret123', salt);
    const bytes = encryptContainer(Buffer.from('x'), key, salt, FAST);
    expect(() => decryptContainer(bytes, Buffer.alloc(32, 9))).toThrow(expect.objectContaining({ code: 'CRYPTO' }));
    expect(() => decryptContainer(bytes, Buffer.alloc(16))).toThrow(expect.objectContaining({ code: 'CRYPTO' }));
  });

  it('rejects things that are not containers without crashing', () => {
    expect(isContainer(Buffer.alloc(0))).toBe(false);
    expect(isContainer(Buffer.from('hello world, definitely not a container at all'))).toBe(false);
    expect(isContainer(null)).toBe(false);
    for (const bad of [Buffer.alloc(0), Buffer.alloc(20), Buffer.alloc(100, 0x41)]) {
      expect(() => parseHeader(bad)).toThrow(expect.objectContaining({ code: 'CRYPTO' }));
    }
  });

  it('rejects unknown versions and absurd KDF parameters in the header', async () => {
    const salt = randomBytes(16);
    const key = await keyFor('Secret123', salt);
    const bytes = encryptContainer(Buffer.from('x'), key, salt, FAST);
    const badVersion = Buffer.from(bytes);
    badVersion[8] = 2;
    expect(() => parseHeader(badVersion)).toThrow(expect.objectContaining({ code: 'CRYPTO' }));
    expect(isContainer(badVersion)).toBe(false);

    const badN = Buffer.from(bytes);
    badN.writeUInt32LE(1 << 30, 9); // would need 128 GB of memory
    expect(() => parseHeader(badN)).toThrow(expect.objectContaining({ code: 'CRYPTO' }));
    await expect(decryptWithPassword(badN, 'Secret123')).rejects.toMatchObject({ code: 'CRYPTO' });
  });

  it('validates inputs to encryptContainer', () => {
    expect(() => encryptContainer(Buffer.from('x'), Buffer.alloc(31), Buffer.alloc(16), FAST)).toThrow(
      expect.objectContaining({ code: 'CRYPTO' }),
    );
    expect(() => encryptContainer(Buffer.from('x'), Buffer.alloc(32), Buffer.alloc(15), FAST)).toThrow(
      expect.objectContaining({ code: 'CRYPTO' }),
    );
    expect(() => encryptContainer(Buffer.from('x'), Buffer.alloc(32), Buffer.alloc(16), { N: 3, r: 8, p: 1 })).toThrow(
      expect.objectContaining({ code: 'CRYPTO' }),
    );
  });

  it('handles an empty plaintext', async () => {
    const salt = randomBytes(16);
    const key = await keyFor('Secret123', salt);
    const bytes = encryptContainer(Buffer.alloc(0), key, salt, FAST);
    expect(bytes.length).toBe(HEADER_LENGTH + TAG_LENGTH);
    expect(decryptContainer(bytes, key).plain.length).toBe(0);
  });
});
