import { beforeAll, describe, expect, it } from 'vitest';
import { decryptValue, deriveKeys, encryptValue, hmacHex, makeKeyCheck, randomUuid, sha256Hex, verifyKeyCheck } from './crypto';
import { ensureKeyCheck } from './keys';
import { MemoryStore } from './store/memory';
import { DANA, installWebCrypto, LIOR, testKeys } from './test-utils/env';

beforeAll(() => installWebCrypto());

describe('offline crypto (section 5.2)', () => {
  it('round-trips a value for one account, store and record key', async () => {
    const keys = await testKeys(DANA);
    const blob = await encryptValue(keys, 'outbox', 'op-1', { title: 'Morning walk', body: 'טיול בוקר 🌤️' });
    expect(blob.byteLength).toBeGreaterThan(12 + 16);
    expect(await decryptValue(keys, 'outbox', 'op-1', blob)).toEqual({ title: 'Morning walk', body: 'טיול בוקר 🌤️' });
  });

  it('a blob moved to another account, store or record key does not decrypt', async () => {
    const dana = await testKeys(DANA, 1);
    const lior = await testKeys(LIOR, 1); // same AOK bytes, another account: the derivation binds the user id
    const blob = await encryptValue(dana, 'outbox', 'op-1', 'secret');
    await expect(decryptValue(lior, 'outbox', 'op-1', blob)).rejects.toBeDefined();
    await expect(decryptValue(dana, 'notes', 'op-1', blob)).rejects.toBeDefined();
    await expect(decryptValue(dana, 'outbox', 'op-2', blob)).rejects.toBeDefined();
    await expect(decryptValue(dana, 'outbox', 'op-1', blob)).resolves.toBe('secret');
  });

  it('another AOK of the same account does not decrypt either', async () => {
    const a = await testKeys(DANA, 1);
    const b = await testKeys(DANA, 2);
    const blob = await encryptValue(a, 'cache', 'k', [1, 2, 3]);
    await expect(decryptValue(b, 'cache', 'k', blob)).rejects.toBeDefined();
  });

  it('HMAC keys are stable per account and differ between accounts', async () => {
    const a1 = await testKeys(DANA, 1);
    const a2 = await testKeys(DANA, 1);
    const b = await testKeys(LIOR, 1);
    expect(await hmacHex(a1, 'cache|/api/entries?text=secret')).toBe(await hmacHex(a2, 'cache|/api/entries?text=secret'));
    expect(await hmacHex(a1, 'cache|/api/entries?text=secret')).not.toBe(await hmacHex(b, 'cache|/api/entries?text=secret'));
    expect(await hmacHex(a1, 'x')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('the key check accepts the right keys and refuses others', async () => {
    const a = await testKeys(DANA, 1);
    const b = await testKeys(DANA, 2);
    const check = await makeKeyCheck(a);
    expect(await verifyKeyCheck(a, check)).toBe(true);
    expect(await verifyKeyCheck(b, check)).toBe(false);
    expect(await verifyKeyCheck(a, 'not bytes')).toBe(false);
  });

  it('ensureKeyCheck writes once, then reports ok or mismatch', async () => {
    const store = new MemoryStore();
    const a = await testKeys(DANA, 1);
    const b = await testKeys(DANA, 2);
    expect(await ensureKeyCheck(store, a)).toBe('written');
    expect(await ensureKeyCheck(store, a)).toBe('ok');
    expect(await ensureKeyCheck(store, b)).toBe('mismatch');
  });

  it('refuses an AOK that is not 32 bytes and produces RFC 4122 ids and hex digests', async () => {
    await expect(deriveKeys(new Uint8Array(16), DANA)).rejects.toThrow(/32 bytes/);
    expect(randomUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(await sha256Hex('token')).toMatch(/^[0-9a-f]{64}$/);
  });
});
