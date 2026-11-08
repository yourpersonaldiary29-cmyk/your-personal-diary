import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KDF,
  deriveSecret,
  isValidKdfParams,
  newSalt,
  safeEqualBytes,
  safeEqualHex,
  scryptMemoryBytes,
  splitSecret,
  verifierHex,
} from '../src/security/kdf';

const FAST = { N: 1024, r: 8, p: 1 };

describe('kdf', () => {
  it('is deterministic for the same password, salt and parameters', async () => {
    const salt = Buffer.alloc(16, 1);
    const a = await deriveSecret('Passw0rd!', salt, FAST);
    const b = await deriveSecret('Passw0rd!', salt, FAST);
    expect(a.length).toBe(64);
    expect(a.equals(b)).toBe(true);
  });

  it('changes with the salt, the password and the parameters', async () => {
    const base = await deriveSecret('Passw0rd!', Buffer.alloc(16, 1), FAST);
    const otherSalt = await deriveSecret('Passw0rd!', Buffer.alloc(16, 2), FAST);
    const otherPw = await deriveSecret('Passw0rd?', Buffer.alloc(16, 1), FAST);
    const otherParams = await deriveSecret('Passw0rd!', Buffer.alloc(16, 1), { N: 2048, r: 8, p: 1 });
    expect(base.equals(otherSalt)).toBe(false);
    expect(base.equals(otherPw)).toBe(false);
    expect(base.equals(otherParams)).toBe(false);
  });

  it('uses the production parameters by default', async () => {
    expect(DEFAULT_KDF).toEqual({ N: 32768, r: 8, p: 1 });
    const salt = newSalt();
    expect(salt.length).toBe(16);
    const secret = await deriveSecret('Passw0rd!', salt);
    expect(secret.length).toBe(64);
  });

  it('normalises Unicode so composed and decomposed forms derive the same key', async () => {
    const salt = Buffer.alloc(16, 3);
    const composed = await deriveSecret('café 1234', salt, FAST); // é
    const decomposed = await deriveSecret('café 1234', salt, FAST); // e + combining acute
    expect(composed.equals(decomposed)).toBe(true);
  });

  it('splits the secret into an independent key and verifier source', async () => {
    const secret = await deriveSecret('Passw0rd!', Buffer.alloc(16, 4), FAST);
    const { key, verifierSource } = splitSecret(secret);
    expect(key.length).toBe(32);
    expect(verifierSource.length).toBe(32);
    expect(key.equals(secret.subarray(0, 32))).toBe(true);
    expect(verifierSource.equals(secret.subarray(32))).toBe(true);
    // Copies: wiping the secret must not touch the parts.
    secret.fill(0);
    expect(key.some((b) => b !== 0)).toBe(true);
    const hex = verifierHex(verifierSource);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    expect(verifierHex(verifierSource)).toBe(hex);
  });

  it('rejects secrets of the wrong length', () => {
    expect(() => splitSecret(Buffer.alloc(10))).toThrow();
  });

  it('compares hex strings and buffers in constant time semantics', () => {
    expect(safeEqualHex('abcd', 'abcd')).toBe(true);
    expect(safeEqualHex('abcd', 'abce')).toBe(false);
    expect(safeEqualHex('abcd', 'abcdef')).toBe(false);
    expect(safeEqualHex('', '')).toBe(false);
    expect(safeEqualBytes(Buffer.from([1, 2]), Buffer.from([1, 2]))).toBe(true);
    expect(safeEqualBytes(Buffer.from([1, 2]), Buffer.from([1, 3]))).toBe(false);
    expect(safeEqualBytes(Buffer.from([1, 2]), Buffer.from([1]))).toBe(false);
  });

  it('validates KDF parameters (power of two, bounded memory)', () => {
    expect(isValidKdfParams(DEFAULT_KDF)).toBe(true);
    expect(isValidKdfParams({ N: 1000, r: 8, p: 1 })).toBe(false); // not a power of two
    expect(isValidKdfParams({ N: 512, r: 8, p: 1 })).toBe(false); // too small
    expect(isValidKdfParams({ N: 1 << 30, r: 8, p: 1 })).toBe(false); // absurd memory
    expect(isValidKdfParams({ N: 32768, r: 0, p: 1 })).toBe(false);
    expect(isValidKdfParams({ N: 32768, r: 8, p: 100 })).toBe(false);
    expect(isValidKdfParams(null)).toBe(false);
    expect(scryptMemoryBytes(DEFAULT_KDF)).toBeGreaterThan(32 * 1024 * 1024);
  });

  it('rejects bad parameters and salts with a CRYPTO error instead of crashing', async () => {
    await expect(deriveSecret('x', Buffer.alloc(16), { N: 3, r: 8, p: 1 })).rejects.toMatchObject({ code: 'CRYPTO' });
    await expect(deriveSecret('x', Buffer.alloc(8), FAST)).rejects.toMatchObject({ code: 'CRYPTO' });
  });
});
