/**
 * Offline unlock by password through the engine (OFFLINE-DESIGN section 13, 2026-11-08; the package
 * docs/apple-tasks/OFFLINE-PASSWORD.md): the wrap is kept in memory for every session that had the
 * password in hand, at rest (`meta.passwordWrap`) only on an app with "Remember me", refreshed by a
 * password check against the server and by a password change, and dropped by every path that drops
 * the wrapped key (a 401, a start without "Remember me", an account switch, a wipe, a teardown).
 * `unlockWithPassword` answers ok / wrong / wait / unavailable, with the growing wait after the third
 * wrong password; a right password or a reconnection resets the counter.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { offline } from './index';
import { META } from './keys';
import { BINDING_KEY } from './session';
import { openExistingAccountStore } from './store/idb';
import { bootDevice, DANA, fakeKeyVault, installWebCrypto, LIOR, resetOfflineTestEnv, wireDevice } from './test-utils/env';
import { FakeSyncServer } from './test-utils/fake-sync-server';

beforeAll(() => installWebCrypto());

const PASSWORD = 'Dana-secret-2026!';
const OTHER_PASSWORD = 'not-the-password';

/** The password wrap row of an account's database as it is on disk (the engine is bypassed); undefined when absent, null without a database. */
async function wrapAtRest(userId = DANA): Promise<unknown> {
  const store = await openExistingAccountStore(userId);
  if (!store) return null;
  try {
    return (await store.tx(['meta'], 'readonly', (t) => t.get('meta', META.passwordWrap)))?.value;
  } finally {
    store.close();
  }
}

const outcome = async (password: string) => (await offline.unlockWithPassword(password)).outcome;

describe('offline unlock by password: where the wrap lives', () => {
  let server: FakeSyncServer;

  beforeEach(() => {
    server = new FakeSyncServer();
  });

  afterEach(async () => {
    await resetOfflineTestEnv();
  });

  it('an app with "Remember me": a login with the password writes the wrap at rest; the password unlocks, another does not', async () => {
    const keyVault = fakeKeyVault('dpapi');
    const wired = wireDevice({ server, rememberMe: true, app: true, keyVault });
    const started = await offline.start({ user: wired.account.user, rememberMe: true, token: wired.account.token, password: PASSWORD });
    expect(started).toMatchObject({ enabled: true });
    expect(await offline.canUnlockWithPassword()).toBe(true);
    const row = await wrapAtRest();
    expect(row).toMatchObject({ v: 1, kdf: 'scrypt', N: 32768, r: 8, p: 1 });
    expect(JSON.stringify(row)).not.toContain(PASSWORD);
    expect(await offline.unlockWithPassword(OTHER_PASSWORD)).toEqual({ outcome: 'wrong', waitSeconds: 0 });
    expect(await offline.unlockWithPassword(PASSWORD)).toEqual({ outcome: 'ok', waitSeconds: 0 });
  }, 30000);

  it('without "Remember me" (an app) and on the web: the wrap serves this run only - nothing at rest', async () => {
    for (const app of [true, false]) {
      const wired = wireDevice({ server, rememberMe: !app, app, keyVault: fakeKeyVault() });
      expect(await offline.start({ user: wired.account.user, rememberMe: !app, token: wired.account.token, password: PASSWORD })).toMatchObject({ enabled: true });
      expect(await wrapAtRest()).toBeUndefined();
      expect(await outcome(PASSWORD)).toBe('ok');
      // The run ends (the engine is torn down): the memory copy dies with it.
      await offline.__resetForTests();
      const again = wireDevice({ server, rememberMe: !app, app, keyVault: fakeKeyVault(), idb: wired.idb });
      expect(await offline.start({ user: again.account.user, rememberMe: !app, token: again.account.token })).toMatchObject({ enabled: true });
      expect(await offline.canUnlockWithPassword()).toBe(false);
      expect(await offline.unlockWithPassword(PASSWORD)).toEqual({ outcome: 'unavailable', waitSeconds: 0 });
      await offline.__resetForTests();
    }
  }, 30000);

  it('a start without a password (me() at app start) keeps no wrap: unavailable', async () => {
    await bootDevice({ server, rememberMe: true, app: true, keyVault: fakeKeyVault() });
    expect(await wrapAtRest()).toBeUndefined();
    expect(await offline.canUnlockWithPassword()).toBe(false);
    expect(await offline.unlockWithPassword(PASSWORD)).toEqual({ outcome: 'unavailable', waitSeconds: 0 });
  });

  it('an app reopened without a connection ("Remember me"): the wrap at rest unlocks by password', async () => {
    const keyVault = fakeKeyVault('keystore');
    const wired = wireDevice({ server, rememberMe: true, app: true, keyVault });
    expect(await offline.start({ user: wired.account.user, rememberMe: true, token: wired.account.token, password: PASSWORD })).toMatchObject({ enabled: true });
    await offline.__resetForTests(); // the app closes
    wireDevice({ server, rememberMe: true, app: true, keyVault, idb: wired.idb, token: wired.account.token });
    server.mode = 'down';
    expect(await offline.startFromCache({ token: wired.account.token })).toMatchObject({ ok: true });
    expect(await offline.canUnlockWithPassword()).toBe(true);
    expect(await outcome(OTHER_PASSWORD)).toBe('wrong');
    expect(await outcome(PASSWORD)).toBe('ok');
  }, 30000);

  it('a password check against the server (verifyPassword, the 423 prompt) refreshes the wrap; a password change moves it to the NEW password', async () => {
    const keyVault = fakeKeyVault('dpapi');
    const { account } = await bootDevice({ server, rememberMe: true, app: true, keyVault });
    expect(await offline.canUnlockWithPassword()).toBe(false);
    expect(await offline.refreshPasswordWrap(PASSWORD)).toBe(true);
    const first = await wrapAtRest();
    expect(first).toMatchObject({ v: 1 });
    expect(await outcome(PASSWORD)).toBe('ok');
    // The user changes the password: the dialog hands the engine the new one.
    const NEW_PASSWORD = 'Dana-new-secret-2027!';
    expect(await offline.refreshPasswordWrap(NEW_PASSWORD)).toBe(true);
    const second = await wrapAtRest();
    expect(second).not.toEqual(first);
    expect(await outcome(PASSWORD)).toBe('wrong');
    expect(await outcome(NEW_PASSWORD)).toBe('ok');
    // The server out of reach while a (new) password is handed over: the wrap in hand is dropped
    // rather than kept under a password that may just have been changed (section 13 note).
    server.mode = 'down';
    expect(await offline.refreshPasswordWrap('typed-while-offline')).toBe(false);
    expect(await wrapAtRest()).toBeUndefined();
    expect(await offline.canUnlockWithPassword()).toBe(false);
    expect(await outcome(NEW_PASSWORD)).toBe('unavailable');
    // An empty password or no engine: nothing.
    server.mode = 'online';
    expect(await offline.refreshPasswordWrap('')).toBe(false);
    await offline.__resetForTests();
    expect(await offline.refreshPasswordWrap(PASSWORD)).toBe(false);
    void account;
  }, 30000);
});

describe('offline unlock by password: the wrap goes with the wrapped key', () => {
  let server: FakeSyncServer;

  beforeEach(() => {
    server = new FakeSyncServer();
  });

  afterEach(async () => {
    await resetOfflineTestEnv();
  });

  async function rememberedWithWrap(keyVault = fakeKeyVault('keychain')) {
    const wired = wireDevice({ server, rememberMe: true, app: true, keyVault });
    expect(await offline.start({ user: wired.account.user, rememberMe: true, token: wired.account.token, password: PASSWORD })).toMatchObject({ enabled: true });
    expect(await wrapAtRest()).toMatchObject({ v: 1 });
    return { ...wired, keyVault };
  }

  it('a 401 while the engine runs drops the wrap at rest and in memory', async () => {
    const { account } = await rememberedWithWrap();
    server.revoke(account.token);
    await offline.onUnauthorized();
    expect(offline.isActive()).toBe(false);
    expect(await wrapAtRest()).toBeUndefined();
    expect(await offline.unlockWithPassword(PASSWORD)).toEqual({ outcome: 'unavailable', waitSeconds: 0 });
  }, 30000);

  it('a 401 for the account at rest (the app was closed) drops the wrap too', async () => {
    const { account, idb, keyVault } = await rememberedWithWrap();
    await offline.__resetForTests();
    wireDevice({ server, rememberMe: true, app: true, keyVault, idb, token: account.token });
    await offline.onUnauthorized();
    expect(await wrapAtRest()).toBeUndefined();
    expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();
  }, 30000);

  it('a start without "Remember me" after a remembered session deletes the wrap at rest (and keeps this run\'s only in memory)', async () => {
    const { account, idb, keyVault } = await rememberedWithWrap();
    await offline.__resetForTests();
    wireDevice({ server, rememberMe: false, app: true, keyVault, idb, token: account.token });
    expect(await offline.start({ user: account.user, rememberMe: false, token: account.token, password: PASSWORD })).toMatchObject({ enabled: true });
    expect(await wrapAtRest()).toBeUndefined();
    expect(await outcome(PASSWORD)).toBe('ok');
  }, 30000);

  it('a start without "Remember me" for an engine already running persistent keeps the new wrap in memory only', async () => {
    const { account } = await rememberedWithWrap();
    expect(await offline.start({ user: account.user, rememberMe: false, token: account.token, password: PASSWORD })).toMatchObject({ enabled: true });
    expect(await wrapAtRest()).toBeUndefined();
    expect(await outcome(PASSWORD)).toBe('ok');
  }, 30000);

  it('another account signing in on the device: the first account\'s wrap goes; the new engine knows nothing of its password', async () => {
    const { idb, keyVault } = await rememberedWithWrap();
    const lior = wireDevice({ server, userId: LIOR, rememberMe: true, app: true, keyVault, idb });
    expect(await offline.start({ user: lior.account.user, rememberMe: true, token: lior.account.token })).toMatchObject({ enabled: true });
    expect(offline.activeUserId()).toBe(LIOR);
    expect(await wrapAtRest(DANA)).toBeUndefined();
    expect(await wrapAtRest(LIOR)).toBeUndefined();
    expect(await offline.unlockWithPassword(PASSWORD)).toEqual({ outcome: 'unavailable', waitSeconds: 0 });
  }, 30000);

  it('a wipe (sign-out, account deletion) leaves no database and no wrap', async () => {
    const { idb } = await rememberedWithWrap();
    await offline.wipeAccount(DANA);
    expect(await wrapAtRest()).toBeNull();
    expect((await idb.databases()).map((d) => d.name).some((n) => n?.includes(DANA))).toBe(false);
  }, 30000);

  it('a teardown (sign-out) drops the memory copy; a new start of the same account without a password is unavailable until the server accepts one', async () => {
    const { account, idb, keyVault } = await rememberedWithWrap();
    await offline.stop();
    wireDevice({ server, rememberMe: true, app: true, keyVault, idb, token: account.token });
    expect(await offline.start({ user: account.user, rememberMe: true, token: account.token })).toMatchObject({ enabled: true });
    // The wrap at rest of the remembered session still serves (same account, same device, the key at rest is still there).
    expect(await outcome(PASSWORD)).toBe('ok');
    await offline.wipeAccount(DANA);
    wireDevice({ server, rememberMe: true, app: true, keyVault, token: account.token });
    expect(await offline.start({ user: account.user, rememberMe: true, token: account.token })).toMatchObject({ enabled: true });
    expect(await outcome(PASSWORD)).toBe('unavailable');
  }, 30000);
});

describe('offline unlock by password: the throttle', () => {
  let server: FakeSyncServer;
  const realNow = Date.now;
  let skewMs = 0;

  beforeEach(() => {
    server = new FakeSyncServer();
    skewMs = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + skewMs);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await resetOfflineTestEnv();
  });

  it('three free attempts, then 2 s, 4 s, 8 s; an attempt during the wait is refused unchecked; the right password resets the counter', async () => {
    const wired = wireDevice({ server, rememberMe: true, app: true, keyVault: fakeKeyVault() });
    expect(await offline.start({ user: wired.account.user, rememberMe: true, token: wired.account.token, password: PASSWORD })).toMatchObject({ enabled: true });
    expect(await offline.unlockWithPassword(OTHER_PASSWORD)).toEqual({ outcome: 'wrong', waitSeconds: 0 });
    expect(await offline.unlockWithPassword(OTHER_PASSWORD)).toEqual({ outcome: 'wrong', waitSeconds: 0 });
    expect(await offline.unlockWithPassword(OTHER_PASSWORD)).toEqual({ outcome: 'wrong', waitSeconds: 2 });
    // Too early: refused without a derivation, even with the RIGHT password (the wait is the point).
    const refused = await offline.unlockWithPassword(PASSWORD);
    expect(refused.outcome).toBe('wait');
    expect(refused.waitSeconds).toBeGreaterThanOrEqual(1);
    expect(refused.waitSeconds).toBeLessThanOrEqual(2);
    skewMs += 2100;
    expect(await offline.unlockWithPassword(OTHER_PASSWORD)).toEqual({ outcome: 'wrong', waitSeconds: 4 });
    skewMs += 4100;
    expect(await offline.unlockWithPassword(OTHER_PASSWORD)).toEqual({ outcome: 'wrong', waitSeconds: 8 });
    skewMs += 8100;
    expect(await offline.unlockWithPassword(PASSWORD)).toEqual({ outcome: 'ok', waitSeconds: 0 });
    // Reset: the next wrong password is a free one again.
    expect(await offline.unlockWithPassword(OTHER_PASSWORD)).toEqual({ outcome: 'wrong', waitSeconds: 0 });
  }, 60000);

  it('a reload of the page in the same run keeps the counter (sessionStorage); a reconnection resets it', async () => {
    const keyVault = fakeKeyVault();
    const wired = wireDevice({ server, rememberMe: true, app: true, keyVault });
    expect(await offline.start({ user: wired.account.user, rememberMe: true, token: wired.account.token, password: PASSWORD })).toMatchObject({ enabled: true });
    for (let i = 0; i < 3; i++) await offline.unlockWithPassword(OTHER_PASSWORD);
    // "Reload": the engine is rebuilt in the same run (sessionStorage survives; `resetOfflineTestEnv` would clear it).
    await offline.__resetForTests();
    wireDevice({ server, rememberMe: true, app: true, keyVault, idb: wired.idb, token: wired.account.token });
    expect(await offline.start({ user: wired.account.user, rememberMe: true, token: wired.account.token })).toMatchObject({ enabled: true });
    expect((await offline.unlockWithPassword(PASSWORD)).outcome).toBe('wait');
    skewMs += 2100;
    expect(await offline.unlockWithPassword(OTHER_PASSWORD)).toEqual({ outcome: 'wrong', waitSeconds: 4 });
    // The connection comes back (the monitor's probe reaches the server): the server checks passwords again.
    const engine = offline.__engineForTests()!;
    engine.connectivity.noteFailure();
    expect(engine.connectivity.dataOffline).toBe(true);
    expect(await engine.connectivity.probeNow('test', true)).toBe(true);
    expect(engine.passwordUnlockWaitSeconds()).toBe(0);
    expect(await offline.unlockWithPassword(OTHER_PASSWORD)).toEqual({ outcome: 'wrong', waitSeconds: 0 });
  }, 60000);

  it('the wait is capped at 60 s', async () => {
    const wired = wireDevice({ server, rememberMe: true, app: true, keyVault: fakeKeyVault() });
    expect(await offline.start({ user: wired.account.user, rememberMe: true, token: wired.account.token, password: PASSWORD })).toMatchObject({ enabled: true });
    const waits: number[] = [];
    for (let i = 0; i < 9; i++) {
      const res = await offline.unlockWithPassword(OTHER_PASSWORD);
      expect(res.outcome).toBe('wrong');
      waits.push(res.waitSeconds);
      skewMs += res.waitSeconds * 1000 + 100;
    }
    expect(waits).toEqual([0, 0, 2, 4, 8, 16, 32, 60, 60]);
  }, 120000);
});
