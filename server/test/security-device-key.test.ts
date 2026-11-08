import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEVICE_KEY_LENGTH, loadOrCreateDeviceKey, unwrapKey, wrapKey, WRAPPED_KEY_LENGTH } from '../src/security/device-key';
import { cleanupTempDirs, tempDataDir } from './helpers';

afterAll(cleanupTempDirs);

describe('device key', () => {
  it('is created on demand and stable across loads', () => {
    const file = path.join(tempDataDir(), 'nested', 'device.key');
    expect(fs.existsSync(file)).toBe(false);
    const a = loadOrCreateDeviceKey(file);
    expect(a.length).toBe(DEVICE_KEY_LENGTH);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
    const b = loadOrCreateDeviceKey(file);
    expect(b.equals(a)).toBe(true);
    // Two different data dirs get different keys.
    const c = loadOrCreateDeviceKey(path.join(tempDataDir(), 'device.key'));
    expect(c.equals(a)).toBe(false);
  });

  it('replaces a truncated/corrupt key file', () => {
    const file = path.join(tempDataDir(), 'device.key');
    fs.writeFileSync(file, Buffer.alloc(5));
    const key = loadOrCreateDeviceKey(file);
    expect(key.length).toBe(DEVICE_KEY_LENGTH);
    expect(fs.readFileSync(file).equals(key)).toBe(true);
  });

  it('wraps and unwraps a diary key', () => {
    const deviceKey = loadOrCreateDeviceKey(path.join(tempDataDir(), 'device.key'));
    const key = Buffer.alloc(32, 0x42);
    const blob = wrapKey(key, deviceKey);
    expect(blob.length).toBe(WRAPPED_KEY_LENGTH);
    expect(blob.includes(key)).toBe(false);
    expect(unwrapKey(blob, deviceKey).equals(key)).toBe(true);
    // Fresh nonce each time.
    expect(wrapKey(key, deviceKey).equals(blob)).toBe(false);
  });

  it('refuses to unwrap with another device key or a damaged blob', () => {
    const deviceKey = loadOrCreateDeviceKey(path.join(tempDataDir(), 'device.key'));
    const other = loadOrCreateDeviceKey(path.join(tempDataDir(), 'device.key'));
    const blob = wrapKey(Buffer.alloc(32, 1), deviceKey);
    expect(() => unwrapKey(blob, other)).toThrow(expect.objectContaining({ code: 'CRYPTO' }));
    const damaged = Buffer.from(blob);
    damaged[20] ^= 0xff;
    expect(() => unwrapKey(damaged, deviceKey)).toThrow(expect.objectContaining({ code: 'CRYPTO' }));
    expect(() => unwrapKey(blob.subarray(0, 10), deviceKey)).toThrow(expect.objectContaining({ code: 'CRYPTO' }));
    expect(() => wrapKey(Buffer.alloc(16), deviceKey)).toThrow(expect.objectContaining({ code: 'CRYPTO' }));
    expect(() => wrapKey(Buffer.alloc(32), Buffer.alloc(8))).toThrow(expect.objectContaining({ code: 'CRYPTO' }));
  });
});
