/**
 * Remote-access settings (server/src/remote/settings.ts + config.ts): the DuckDNS token is stored
 * encrypted with the device key and never in clear; validation of PUT bodies; the other keys of
 * server-settings.json survive every write.
 */
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { readRawServerSettings, readServerSettings, writeRawServerSettings, writeServerSettings } from '../src/config';
import { ApiError } from '../src/errors';
import {
  applyRemoteUpdate,
  decryptToken,
  encryptToken,
  normalizeHostname,
  readRemoteConfig,
  REMOTE_DEFAULTS,
  toPublicSettings,
  writeRemoteConfig,
  type RemoteConfig,
} from '../src/remote/settings';
import { loadOrCreateDeviceKey } from '../src/security/device-key';
import { readStoredOwner, UNREADABLE_OWNER } from '../src/security/owner';
import { cleanupTempDirs, testConfig } from './helpers';

const TOKEN = '0123abcd-4567-89ab-cdef-0123456789ab';
afterAll(cleanupTempDirs);

function validationOf(fn: () => unknown): { field?: string; key?: string } {
  try {
    fn();
  } catch (e) {
    if (e instanceof ApiError) return { field: e.field, key: e.key };
    throw e;
  }
  throw new Error('no error thrown');
}

describe('token encryption', () => {
  it('round-trips with the device key and fails with another key', () => {
    const key = randomBytes(32);
    const blob = encryptToken(TOKEN, key);
    expect(blob).not.toContain(TOKEN);
    expect(Buffer.from(blob, 'base64').toString('latin1')).not.toContain(TOKEN);
    expect(decryptToken(blob, key)).toBe(TOKEN);
    expect(decryptToken(blob, randomBytes(32))).toBeNull();
    expect(decryptToken('garbage', key)).toBeNull();
    expect(encryptToken(TOKEN, key)).not.toBe(blob); // fresh nonce every time
  });
});

describe('persistence in server-settings.json', () => {
  it('defaults: off, no name, no token, port 443, UPnP on, production', () => {
    const cfg = testConfig();
    const key = loadOrCreateDeviceKey(cfg.deviceKeyFile);
    expect(readRemoteConfig(cfg, key)).toEqual({ enabled: false, hostname: '', duckdnsToken: '', publicPort: 443, upnp: true, staging: false, ownerUserId: '' });
    expect(REMOTE_DEFAULTS.publicPort).toBe(443);
  });

  it('stores the token encrypted, restores it, and keeps port / lanEnabled', () => {
    const cfg = testConfig();
    const key = loadOrCreateDeviceKey(cfg.deviceKeyFile);
    writeServerSettings(cfg, { port: 47999, lanEnabled: true });
    const remote: RemoteConfig = {
      enabled: true,
      hostname: 'diarytest.duckdns.org',
      duckdnsToken: TOKEN,
      publicPort: 8443,
      upnp: false,
      staging: true,
      ownerUserId: 'u_0123456789abcdef',
    };
    writeRemoteConfig(cfg, key, remote);
    const text = fs.readFileSync(cfg.settingsFile, 'utf8');
    expect(text).not.toContain(TOKEN);
    const raw = readRawServerSettings(cfg) as { port: number; lanEnabled: boolean; remote: Record<string, unknown> };
    expect(raw.port).toBe(47999);
    expect(raw.lanEnabled).toBe(true);
    expect(raw.remote).toMatchObject({ enabled: true, hostname: 'diarytest.duckdns.org', publicPort: 8443, upnp: false, staging: true, ownerUserId: 'u_0123456789abcdef' });
    expect(typeof raw.remote.duckdnsTokenEnc).toBe('string');
    expect(raw.remote.duckdnsToken).toBeUndefined();
    expect(readRemoteConfig(cfg, key)).toEqual(remote);

    // Saving port / LAN keeps the remote block (and never writes a `remote` view into the file).
    writeServerSettings(cfg, { port: 48000, lanEnabled: false, remote: toPublicSettings(remote) });
    expect(readServerSettings(cfg)).toEqual({ port: 48000, lanEnabled: false });
    expect(readRemoteConfig(cfg, key)).toEqual(remote);
    expect(fs.readFileSync(cfg.settingsFile, 'utf8')).not.toContain('tokenSet');
  });

  it('a token that cannot be decrypted (another device) counts as not set, and an enabled block resumes off', () => {
    const cfg = testConfig();
    const key = loadOrCreateDeviceKey(cfg.deviceKeyFile);
    writeRemoteConfig(cfg, key, { ...REMOTE_DEFAULTS, enabled: true, hostname: 'diarytest.duckdns.org', duckdnsToken: TOKEN });
    const other = randomBytes(32);
    const read = readRemoteConfig(cfg, other);
    expect(read.duckdnsToken).toBe('');
    expect(read.enabled).toBe(false);
    expect(toPublicSettings(read).tokenSet).toBe(false);
  });

  it('the public view never contains the token', () => {
    const view = toPublicSettings({ ...REMOTE_DEFAULTS, hostname: 'a.duckdns.org', duckdnsToken: TOKEN });
    expect(view).toEqual({ enabled: false, hostname: 'a.duckdns.org', tokenSet: true, publicPort: 443, upnp: true, staging: false });
    expect(JSON.stringify(view)).not.toContain(TOKEN);
  });

  it('the owner comes only from the settings file (never from a request body); a malformed id reads as unreadable, not as none', () => {
    const cfg = testConfig();
    const key = loadOrCreateDeviceKey(cfg.deviceKeyFile);
    const owned: RemoteConfig = { ...REMOTE_DEFAULTS, ownerUserId: 'u_0123456789abcdef' };
    expect(applyRemoteUpdate({ ownerUserId: 'u_intruder', hostname: 'diarytest' }, owned).ownerUserId).toBe('u_0123456789abcdef');
    expect(applyRemoteUpdate({ ownerUserId: 'u_intruder' }, REMOTE_DEFAULTS).ownerUserId).toBe('');
    expect(toPublicSettings(owned)).not.toHaveProperty('ownerUserId');
    // Present but not an account id: UNREADABLE_OWNER (released like a deleted owner), never '' - which
    // would hand the settings to the first account as if nobody had ever owned them.
    for (const bad of ['../../accounts.json', 'u_deleted.account', 42, true, {}]) {
      writeRawServerSettings(cfg, { remote: { hostname: 'diarytest.duckdns.org', ownerUserId: bad } });
      expect(readRemoteConfig(cfg, key).ownerUserId).toBe(UNREADABLE_OWNER);
    }
    // No owner stored (older files): ''.
    for (const none of [undefined, null, '']) {
      writeRawServerSettings(cfg, { remote: { hostname: 'diarytest.duckdns.org', ownerUserId: none } });
      expect(readRemoteConfig(cfg, key).ownerUserId).toBe('');
    }
    expect(readStoredOwner('u_0123456789abcdef')).toBe('u_0123456789abcdef');
    expect(UNREADABLE_OWNER).not.toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('normalizeHostname / applyRemoteUpdate', () => {
  it('accepts a bare name, the full name and a pasted URL; rejects other domains', () => {
    expect(normalizeHostname('YourPersonalDiary')).toBe('yourpersonaldiary.duckdns.org');
    expect(normalizeHostname(' yourpersonaldiary.duckdns.org ')).toBe('yourpersonaldiary.duckdns.org');
    expect(normalizeHostname('https://yourpersonaldiary.duckdns.org/')).toBe('yourpersonaldiary.duckdns.org');
    expect(normalizeHostname('yourpersonaldiary.duckdns.org:443')).toBe('yourpersonaldiary.duckdns.org');
    expect(normalizeHostname('yourpersonaldiary.duckdns.org.')).toBe('yourpersonaldiary.duckdns.org');
    expect(normalizeHostname('example.com')).toBeNull();
    expect(normalizeHostname('bad_name.duckdns.org')).toBeNull();
    expect(normalizeHostname('a.b.duckdns.org')).toBeNull();
    expect(normalizeHostname('')).toBeNull();
  });

  it('applies only the given fields and validates each one with its field name', () => {
    const base: RemoteConfig = { ...REMOTE_DEFAULTS };
    const next = applyRemoteUpdate({ hostname: 'diarytest', duckdnsToken: TOKEN.toUpperCase(), publicPort: 8443 }, base);
    expect(next).toEqual({ ...base, hostname: 'diarytest.duckdns.org', duckdnsToken: TOKEN, publicPort: 8443 });
    expect(applyRemoteUpdate({ duckdnsToken: '' }, next).duckdnsToken).toBe('');
    expect(applyRemoteUpdate({}, next)).toEqual(next);

    expect(validationOf(() => applyRemoteUpdate({ hostname: 'example.com' }, base))).toEqual({ field: 'hostname', key: 'server.remote.hostnameInvalid' });
    expect(validationOf(() => applyRemoteUpdate({ duckdnsToken: 'nope' }, base))).toEqual({ field: 'duckdnsToken', key: 'server.remote.tokenInvalid' });
    expect(validationOf(() => applyRemoteUpdate({ publicPort: 0 }, base))).toEqual({ field: 'publicPort', key: 'server.remote.portInvalid' });
    expect(validationOf(() => applyRemoteUpdate({ publicPort: 70000 }, base))).toEqual({ field: 'publicPort', key: 'server.remote.portInvalid' });
    expect(validationOf(() => applyRemoteUpdate({ publicPort: '443' }, base))).toEqual({ field: 'publicPort', key: 'server.remote.portInvalid' });
    expect(validationOf(() => applyRemoteUpdate({ upnp: 'yes' }, base))).toEqual({ field: 'upnp', key: 'server.remote.mustBeBoolean' });
    expect(validationOf(() => applyRemoteUpdate([], base))).toEqual({ field: undefined, key: 'server.remote.badBody' });
  });

  it('refuses to enable without a name or a token', () => {
    expect(validationOf(() => applyRemoteUpdate({ enabled: true }, REMOTE_DEFAULTS))).toEqual({ field: 'hostname', key: 'server.remote.hostnameRequired' });
    expect(validationOf(() => applyRemoteUpdate({ enabled: true, hostname: 'diarytest' }, REMOTE_DEFAULTS))).toEqual({
      field: 'duckdnsToken',
      key: 'server.remote.tokenRequired',
    });
    expect(applyRemoteUpdate({ enabled: true, hostname: 'diarytest', duckdnsToken: TOKEN }, REMOTE_DEFAULTS).enabled).toBe(true);
  });
});
