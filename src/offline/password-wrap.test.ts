/**
 * The password wrap of the offline unlock (OFFLINE-DESIGN section 13, 2026-11-08): the AOK under a
 * key derived from the password with the server's scrypt parameters, bound to the account. Every
 * failure answers null, nothing throws; the recorded parameters are exactly the server's.
 *
 * Timing: one scrypt derivation at N=2^15 / r=8 / p=1 is measured by the first test and printed
 * ("password wrap: scrypt took N ms"). On the development PC (Node 24, @noble/hashes 2.4.0) it is
 * about 60-150 ms; the test only guards against a pathological build (over 5 s).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { fromBase64, randomBytes, toBase64 } from './crypto';
import {
  isPasswordWrap,
  makePasswordWrap,
  openPasswordWrap,
  PASSWORD_UNLOCK_FREE_ATTEMPTS,
  PASSWORD_UNLOCK_MAX_WAIT_MS,
  PASSWORD_WRAP_KDF,
  passwordUnlockWaitMs,
  readPasswordThrottle,
  writePasswordThrottle,
} from './password-wrap';
import { installWebCrypto } from './test-utils/env';

beforeAll(() => installWebCrypto());

const USER = 'u_0123456789abcdef';
const OTHER = 'u_fedcba9876543210';
const PASSWORD = 'Correct Horse 7!';

function aok(seed = 5): Uint8Array {
  return new Uint8Array(32).fill(seed);
}

describe('makePasswordWrap / openPasswordWrap', () => {
  it('round trip: the right password gives the AOK back; the derivation time is printed', async () => {
    const started = performance.now();
    const wrap = await makePasswordWrap(PASSWORD, aok(), USER);
    const made = performance.now() - started;
    const opened = await openPasswordWrap(PASSWORD, wrap, USER);
    const total = performance.now() - started;
    console.info(`password wrap: scrypt took ${Math.round(made)} ms (wrap), ${Math.round(total - made)} ms (open)`);
    expect(opened).not.toBeNull();
    expect([...opened!]).toEqual([...aok()]);
    expect(total).toBeLessThan(5000);
  }, 20000);

  it('records exactly the server\'s parameters, a 16-byte salt and a 12-byte nonce; two wraps never share them', async () => {
    const a = await makePasswordWrap(PASSWORD, aok(), USER);
    const b = await makePasswordWrap(PASSWORD, aok(), USER);
    for (const w of [a, b]) {
      expect(w).toMatchObject({ v: 1, kdf: 'scrypt', N: 32768, r: 8, p: 1 });
      expect(PASSWORD_WRAP_KDF).toEqual({ N: 32768, r: 8, p: 1 });
      expect(fromBase64(w.salt).byteLength).toBe(16);
      expect(fromBase64(w.nonce).byteLength).toBe(12);
      // 32 bytes of AOK plus the 16-byte GCM tag.
      expect(fromBase64(w.ct).byteLength).toBe(48);
      expect(isPasswordWrap(w)).toBe(true);
    }
    expect(a.salt).not.toBe(b.salt);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ct).not.toBe(b.ct);
    // The password is nowhere in the wrap.
    expect(JSON.stringify(a)).not.toContain(PASSWORD);
  }, 20000);

  it('a wrong password answers null (never throws)', async () => {
    const wrap = await makePasswordWrap(PASSWORD, aok(), USER);
    expect(await openPasswordWrap('Correct Horse 7?', wrap, USER)).toBeNull();
    expect(await openPasswordWrap('', wrap, USER)).toBeNull();
    expect(await openPasswordWrap(PASSWORD + ' ', wrap, USER)).toBeNull();
  }, 20000);

  it('another account (the additional data), a tampered ciphertext, a tampered nonce or salt: null', async () => {
    const wrap = await makePasswordWrap(PASSWORD, aok(), USER);
    expect(await openPasswordWrap(PASSWORD, wrap, OTHER)).toBeNull();
    const ct = fromBase64(wrap.ct);
    ct[3] ^= 0x01;
    expect(await openPasswordWrap(PASSWORD, { ...wrap, ct: toBase64(ct) }, USER)).toBeNull();
    const nonce = fromBase64(wrap.nonce);
    nonce[0] ^= 0x80;
    expect(await openPasswordWrap(PASSWORD, { ...wrap, nonce: toBase64(nonce) }, USER)).toBeNull();
    const salt = fromBase64(wrap.salt);
    salt[15] ^= 0x01;
    expect(await openPasswordWrap(PASSWORD, { ...wrap, salt: toBase64(salt) }, USER)).toBeNull();
    // A salt or nonce of the wrong length is refused before any derivation.
    expect(await openPasswordWrap(PASSWORD, { ...wrap, salt: toBase64(randomBytes(8)) }, USER)).toBeNull();
    expect(await openPasswordWrap(PASSWORD, { ...wrap, nonce: toBase64(randomBytes(16)) }, USER)).toBeNull();
    expect(await openPasswordWrap(PASSWORD, { ...wrap, ct: '%%not base64%%' }, USER)).toBeNull();
  }, 30000);

  it('a wrap asking for other parameters (a row edited to cost gigabytes) is not a wrap this build opens', async () => {
    const wrap = await makePasswordWrap(PASSWORD, aok(), USER);
    expect(isPasswordWrap({ ...wrap, N: 1 << 22 })).toBe(false);
    expect(isPasswordWrap({ ...wrap, r: 1 })).toBe(false);
    expect(isPasswordWrap({ ...wrap, p: 16 })).toBe(false);
    expect(isPasswordWrap({ ...wrap, v: 2 })).toBe(false);
    expect(isPasswordWrap({ ...wrap, kdf: 'pbkdf2' })).toBe(false);
    expect(isPasswordWrap(null)).toBe(false);
    expect(isPasswordWrap('{}')).toBe(false);
    expect(await openPasswordWrap(PASSWORD, { ...wrap, N: 1 << 22 }, USER)).toBeNull();
    expect(await openPasswordWrap(PASSWORD, undefined, USER)).toBeNull();
  }, 20000);

  it('the password is NFKC-normalised as the server does (kdf.ts): a full-width digit unlocks like the plain one', async () => {
    // U+FF17 FULLWIDTH DIGIT SEVEN normalises to '7': the server accepts both spellings, so the wrap must too.
    const wrap = await makePasswordWrap('pass７word', aok(), USER);
    expect(await openPasswordWrap('pass7word', wrap, USER)).not.toBeNull();
    // Nothing else is changed: case and surrounding spaces still matter.
    expect(await openPasswordWrap('Pass7word', wrap, USER)).toBeNull();
  }, 20000);

  it('refuses to wrap an empty password or a key of the wrong size', async () => {
    await expect(makePasswordWrap('', aok(), USER)).rejects.toThrow(/empty password/);
    await expect(makePasswordWrap(PASSWORD, new Uint8Array(16), USER)).rejects.toThrow(/32-byte/);
  });
});

describe('the wrong-password throttle', () => {
  it('the first three attempts cost nothing; then 2 s, 4 s, 8 s ... capped at 60 s', () => {
    expect(PASSWORD_UNLOCK_FREE_ATTEMPTS).toBe(3);
    expect(PASSWORD_UNLOCK_MAX_WAIT_MS).toBe(60_000);
    expect([1, 2].map(passwordUnlockWaitMs)).toEqual([0, 0]);
    expect([3, 4, 5, 6, 7].map(passwordUnlockWaitMs)).toEqual([2000, 4000, 8000, 16000, 32000]);
    expect([8, 9, 20, 100].map(passwordUnlockWaitMs)).toEqual([60000, 60000, 60000, 60000]);
  });

  it('the counter is mirrored in sessionStorage per account and cleared when it falls back to zero', () => {
    window.sessionStorage.clear();
    expect(readPasswordThrottle(USER)).toEqual({ failures: 0, notBefore: 0 });
    writePasswordThrottle(USER, { failures: 4, notBefore: 1234 });
    expect(readPasswordThrottle(USER)).toEqual({ failures: 4, notBefore: 1234 });
    expect(readPasswordThrottle(OTHER)).toEqual({ failures: 0, notBefore: 0 });
    writePasswordThrottle(USER, { failures: 0, notBefore: 0 });
    expect(readPasswordThrottle(USER)).toEqual({ failures: 0, notBefore: 0 });
    expect(window.sessionStorage.length).toBe(0);
    // A damaged row counts as no row.
    window.sessionStorage.setItem(`ypd-offline-pw-throttle:${USER}`, '{not json');
    expect(readPasswordThrottle(USER)).toEqual({ failures: 0, notBefore: 0 });
    window.sessionStorage.clear();
  });
});
