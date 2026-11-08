/**
 * WP-H1 (docs/HOSTED-PLAN.md Part B 2.1): the hosted-mode configuration. `DIARY_MODE` is the only
 * switch - without it `loadConfig` yields local mode and nothing else is read - and `loadHostedEnv`
 * validates every variable once, naming the variable at fault and never echoing a secret.
 * Fictional values only.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { HOSTED_DEFAULTS, loadConfig, loadHostedEnv, parseDeviceKeyEnv, parsePublicUrl } from '../src/config';
import { cleanupTempDirs, tempDataDir } from './helpers';

afterAll(cleanupTempDirs);

const BASE = { DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: 'https://yourpersonaldiary.fly.dev' };

describe('loadConfig and DIARY_MODE', () => {
  it('is local by default and hosted only with DIARY_MODE=hosted', () => {
    const dir = tempDataDir();
    expect(loadConfig(['--data-dir', dir], {}).mode).toBe('local');
    expect(loadConfig(['--data-dir', dir], { DIARY_MODE: 'local' }).mode).toBe('local');
    expect(loadConfig(['--data-dir', dir], { DIARY_MODE: 'HOSTED' }).mode).toBe('local');
    expect(loadConfig(['--data-dir', dir], { DIARY_MODE: 'hosted' }).mode).toBe('hosted');
    // The hosted variables change nothing of the local configuration.
    const local = loadConfig(['--data-dir', dir], { DIARY_PUBLIC_URL: 'https://x.example', PORT: '8080', DIARY_TRUST_PROXY: '1' });
    expect(local.mode).toBe('local');
    expect(local.preferredPort).toBe(47321);
  });
});

describe('parsePublicUrl', () => {
  it('accepts https origins and normalises the host', () => {
    expect(parsePublicUrl('https://YourPersonalDiary.fly.dev')).toEqual({ publicUrl: 'https://yourpersonaldiary.fly.dev', publicHost: 'yourpersonaldiary.fly.dev' });
    expect(parsePublicUrl('https://diary.example/')).toEqual({ publicUrl: 'https://diary.example', publicHost: 'diary.example' });
    expect(parsePublicUrl('https://diary.example:443')).toEqual({ publicUrl: 'https://diary.example', publicHost: 'diary.example' });
    expect(parsePublicUrl('https://diary.example:8443')).toEqual({ publicUrl: 'https://diary.example:8443', publicHost: 'diary.example:8443' });
  });

  it('allows plain http for loopback only (local smoke tests of the bundle)', () => {
    expect(parsePublicUrl('http://127.0.0.1:47681')).toEqual({ publicUrl: 'http://127.0.0.1:47681', publicHost: '127.0.0.1:47681' });
    expect(parsePublicUrl('http://localhost:8080').publicHost).toBe('localhost:8080');
    expect(() => parsePublicUrl('http://diary.example')).toThrow(/https/);
  });

  it('refuses anything that is not a bare origin', () => {
    expect(() => parsePublicUrl(undefined)).toThrow(/DIARY_PUBLIC_URL is required/);
    expect(() => parsePublicUrl('')).toThrow(/required/);
    expect(() => parsePublicUrl('diary.example')).toThrow(/valid URL/);
    expect(() => parsePublicUrl('https://diary.example/app')).toThrow(/origin only/);
    expect(() => parsePublicUrl('https://diary.example/?x=1')).toThrow(/origin only/);
    expect(() => parsePublicUrl('https://diary.example/#/login')).toThrow(/origin only/);
    expect(() => parsePublicUrl('https://user:pw@diary.example')).toThrow(/origin only/);
    expect(() => parsePublicUrl('ftp://diary.example')).toThrow(/https/);
  });
});

describe('parseDeviceKeyEnv', () => {
  it('decodes exactly 32 base64 bytes and never echoes the value', () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    expect(parseDeviceKeyEnv(key)?.equals(Buffer.alloc(32, 7))).toBe(true);
    expect(parseDeviceKeyEnv(undefined)).toBeUndefined();
    expect(parseDeviceKeyEnv('   ')).toBeUndefined();
    const short = Buffer.alloc(16, 1).toString('base64');
    for (const bad of [short, 'not base64!!', `${key}AA==`]) {
      let message = '';
      try {
        parseDeviceKeyEnv(bad);
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toMatch(/DIARY_DEVICE_KEY/);
      expect(message).not.toContain(bad.slice(0, 8));
    }
  });
});

describe('loadHostedEnv', () => {
  it('needs DIARY_MODE=hosted and DIARY_PUBLIC_URL, and applies the documented defaults', () => {
    expect(() => loadHostedEnv({ DIARY_PUBLIC_URL: 'https://diary.example' })).toThrow(/DIARY_MODE=hosted/);
    expect(() => loadHostedEnv({ DIARY_MODE: 'hosted' })).toThrow(/DIARY_PUBLIC_URL/);
    const env = loadHostedEnv(BASE);
    expect(env).toMatchObject({
      publicUrl: 'https://yourpersonaldiary.fly.dev',
      publicHost: 'yourpersonaldiary.fly.dev',
      port: 8080,
      bind: '0.0.0.0',
      trustProxy: 1,
      ownerId: '',
      registration: 'open',
      inviteCode: '',
      maxAccounts: HOSTED_DEFAULTS.maxAccounts,
      maxDiaryBytes: 10 * 1024 * 1024,
      vaultIdleMinutes: 30,
      kdfConcurrency: 2,
      loginPerMinute: 10,
      authGlobalPerMinute: 300,
      minFreePct: 10,
      debugRoutes: false,
      logLevel: 'info',
      maxGuests: 20,
      guestMinutes: 30,
      guestsPerHour: 3,
    });
    expect(env.clientIpHeader).toBeUndefined();
    expect(env.deviceKey).toBeUndefined();
  });

  it('reads the Fly / Railway variables', () => {
    const env = loadHostedEnv({
      ...BASE,
      PORT: '8080',
      DIARY_PORT: '9999',
      DIARY_BIND: '127.0.0.1',
      DIARY_TRUST_PROXY: '2',
      DIARY_CLIENT_IP_HEADER: 'Fly-Client-IP',
      DIARY_OWNER_ID: 'u_0123456789abcdef',
      DIARY_REGISTRATION: 'invite',
      DIARY_INVITE_CODE: 'open-sesame-2026',
      DIARY_MAX_ACCOUNTS: '50',
      DIARY_MAX_DIARY_BYTES: '1048576',
      DIARY_VAULT_IDLE_MINUTES: '0',
      DIARY_KDF_CONCURRENCY: '4',
      DIARY_LOGIN_PER_MINUTE: '5',
      DIARY_AUTH_GLOBAL_PER_MINUTE: '100',
      DIARY_DEVICE_KEY: Buffer.alloc(32, 9).toString('base64'),
      DIARY_MIN_FREE_PCT: '99',
      DIARY_DEBUG_ROUTES: '1',
      DIARY_LOG_LEVEL: 'warn',
      DIARY_MAX_GUESTS: '0',
      DIARY_GUEST_MINUTES: '10',
      DIARY_GUESTS_PER_HOUR: '1',
    });
    expect(env).toMatchObject({
      port: 8080,
      bind: '127.0.0.1',
      trustProxy: 2,
      clientIpHeader: 'fly-client-ip',
      ownerId: 'u_0123456789abcdef',
      registration: 'invite',
      inviteCode: 'open-sesame-2026',
      maxAccounts: 50,
      maxDiaryBytes: 1048576,
      vaultIdleMinutes: 0,
      kdfConcurrency: 4,
      loginPerMinute: 5,
      authGlobalPerMinute: 100,
      minFreePct: 99,
      debugRoutes: true,
      logLevel: 'warn',
      maxGuests: 0,
      guestMinutes: 10,
      guestsPerHour: 1,
    });
    expect(env.deviceKey?.length).toBe(32);
    // PORT wins over DIARY_PORT; DIARY_PORT alone is honoured; TRUST_PROXY is the fallback name.
    expect(loadHostedEnv({ ...BASE, DIARY_PORT: '9999' }).port).toBe(9999);
    expect(loadHostedEnv({ ...BASE, TRUST_PROXY: '3' }).trustProxy).toBe(3);
    expect(loadHostedEnv({ ...BASE, TRUST_PROXY: '3', DIARY_TRUST_PROXY: '1' }).trustProxy).toBe(1);
  });

  it('refuses bad values by variable name, without the value', () => {
    const cases: Array<[Record<string, string>, RegExp]> = [
      [{ DIARY_REGISTRATION: 'maybe' }, /DIARY_REGISTRATION/],
      [{ DIARY_REGISTRATION: 'invite' }, /DIARY_INVITE_CODE/],
      [{ DIARY_CLIENT_IP_HEADER: 'X Forwarded' }, /DIARY_CLIENT_IP_HEADER/],
      [{ DIARY_OWNER_ID: 'not an id!' }, /DIARY_OWNER_ID/],
      [{ DIARY_LOG_LEVEL: 'debug' }, /DIARY_LOG_LEVEL/],
      [{ PORT: 'eighty' }, /PORT/],
      [{ PORT: '70000' }, /PORT/],
      [{ DIARY_MAX_ACCOUNTS: '-1' }, /DIARY_MAX_ACCOUNTS/],
      [{ DIARY_KDF_CONCURRENCY: '0' }, /DIARY_KDF_CONCURRENCY/],
      [{ DIARY_LOGIN_PER_MINUTE: '1.5' }, /DIARY_LOGIN_PER_MINUTE/],
      [{ DIARY_DEVICE_KEY: 'c2hvcnQ=' }, /DIARY_DEVICE_KEY/],
      [{ DIARY_MAX_GUESTS: 'many' }, /DIARY_MAX_GUESTS/],
      [{ DIARY_GUEST_MINUTES: '0' }, /DIARY_GUEST_MINUTES/],
      [{ DIARY_GUESTS_PER_HOUR: '0' }, /DIARY_GUESTS_PER_HOUR/],
    ];
    for (const [extra, re] of cases) {
      let message = '';
      try {
        loadHostedEnv({ ...BASE, ...extra });
      } catch (e) {
        message = (e as Error).message;
      }
      expect({ extra, message }).toEqual({ extra, message: expect.stringMatching(re) });
      for (const value of Object.values(extra)) if (value.length > 3 && !/^(invite|maybe|debug|eighty)$/.test(value)) expect(message).not.toContain(value);
    }
  });
});
