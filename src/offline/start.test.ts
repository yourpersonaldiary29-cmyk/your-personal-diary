import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { EntryInput } from '@shared/types';
import * as api from '@/api';
import { offline } from './index';
import { isPendingRecord } from './optimistic';
import { BINDING_KEY } from './session';
import { getSyncStatus } from './status';
import { META } from './keys';
import { openExistingAccountStore, setIdbFactory } from './store/idb';
import type { OfflineStore } from './store/types';
import { bootDevice, brokenIndexedDb, DANA, fakeKeyVault, fakeMirror, installWebCrypto, LIOR, resetOfflineTestEnv, waitForAsync, wireDevice } from './test-utils/env';
import { FakeSyncServer } from './test-utils/fake-sync-server';

beforeAll(() => installWebCrypto());

const ENTRY: EntryInput = { date: '2026-10-23', time: '08:00', title: 'Offline morning', body: 'x', mood: null, emotions: [], energy: null, stress: null, sleepQuality: null, sleepHours: null, exerciseMinutes: null, exerciseType: '', events: [], people: [], location: '', notes: '', tags: [] };

/** The wrapped-key rows of an account's database - through an open store, or bypassing the engine; null when the database does not exist. */
async function keyAtRest(store?: OfflineStore, userId = DANA) {
  const own = store ?? (await openExistingAccountStore(userId));
  if (!own) return null;
  try {
    return await own.tx(['meta'], 'readonly', async (t) => ({ key: await t.get('meta', META.wrappedKey), by: await t.get('meta', META.wrappedBy) }));
  } finally {
    if (!store) own.close();
  }
}

describe('offline start (section 4.7) and the key at rest (section 5.1)', () => {
  let server: FakeSyncServer;

  beforeEach(() => {
    server = new FakeSyncServer();
  });

  afterEach(async () => {
    await resetOfflineTestEnv();
  });

  it('an app with "Remember me" reopens from the cache without the server, then switches to the server', async () => {
    server.seedEntry(DANA, { title: 'Yesterday', date: '2026-10-22' });
    const keyVault = fakeKeyVault('keystore');
    const mirror = fakeMirror();
    const { account, idb, engine } = await bootDevice({ server, rememberMe: true, app: true, keyVault, mirror });
    await waitForAsync(async () => (await engine.cache.get('/api/home')) !== null, 6000);
    expect(keyVault.blobs.has(DANA)).toBe(true);
    expect(window.localStorage.getItem(BINDING_KEY)).toContain(DANA);
    // Write something offline, then "close the app" (the engine goes, the database and the binding stay).
    server.mode = 'down';
    const pending = await api.entries.create(ENTRY);
    expect(isPendingRecord(pending)).toBe(true);
    await offline.__resetForTests();
    expect(offline.isActive()).toBe(false);

    // Reopen without a connection: the first me() failed with a connection error, so the AuthProvider asks for a cache start.
    wireDevice({ server, rememberMe: true, app: true, keyVault, mirror, idb, token: account.token });
    server.mode = 'down';
    const started = await offline.startFromCache({ token: account.token });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.userId).toBe(DANA);
    expect(started.snapshot.user.id).toBe(DANA);
    expect(started.snapshot.rememberMe).toBe(true);
    expect(started.snapshot.serverInfo.offlineSync).toBe(1);
    expect(offline.isActive()).toBe(true);
    expect(getSyncStatus().pending).toBe(1);
    // The cached views and the queued change are there.
    const home = await api.insights.home();
    expect(home.totalEntries).toBe(2);
    const byId = await api.entries.get(-1);
    expect(byId.title).toBe('Offline morning');

    // The connection returns: me() succeeds, start() refreshes the running engine and the outbox drains.
    server.mode = 'online';
    const again = await offline.start({ user: account.user, rememberMe: true, token: account.token });
    expect(again.enabled).toBe(true);
    await offline.drain();
    expect(server.diary(DANA).entries.size).toBe(2);
    expect(getSyncStatus().pending).toBe(0);
  }, 20000);

  it('refuses a cache start without a binding, on the web, or with another token', async () => {
    const keyVault = fakeKeyVault();
    const { account, idb } = await bootDevice({ server, rememberMe: true, app: true, keyVault });
    await offline.__resetForTests();
    wireDevice({ server, rememberMe: true, app: false, keyVault, idb, token: account.token });
    expect(await offline.startFromCache({ token: account.token })).toEqual({ ok: false, reason: 'notApp' });
    wireDevice({ server, rememberMe: true, app: true, keyVault, idb, token: account.token });
    expect(await offline.startFromCache({ token: 'another-token' })).toEqual({ ok: false, reason: 'noBinding' });
    window.localStorage.removeItem(BINDING_KEY);
    expect(await offline.startFromCache({ token: account.token })).toEqual({ ok: false, reason: 'noBinding' });
  });

  it('a session without "Remember me" keeps no key and no binding on the device', async () => {
    const keyVault = fakeKeyVault();
    const { engine } = await bootDevice({ server, rememberMe: false, app: true, keyVault });
    expect(keyVault.blobs.size).toBe(0);
    expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();
    expect(engine.cache.persistent).toBe(false);
  });

  // The vault's entry goes with the wrapped key (sections 5.1 / 5.5; APPLE-PLAN WP-M3): on the Mac the
  // blob in `meta` is only the marker of the Keychain item that holds the key, and the fake vault keeps
  // the key the same way (`blobs`). The 401 paths are in recovery.test.ts.
  it('a start without "Remember me" after a remembered session removes the key at rest: the blob, the binding and the vault entry', async () => {
    const keyVault = fakeKeyVault('keychain');
    const { account, idb } = await bootDevice({ server, rememberMe: true, app: true, keyVault });
    expect(keyVault.blobs.has(DANA)).toBe(true);
    await offline.__resetForTests(); // the app closes; the user signs in again, this time without "Remember me"
    wireDevice({ server, rememberMe: false, app: true, keyVault, idb, token: account.token });
    const started = await offline.start({ user: account.user, rememberMe: false, token: account.token });
    expect(started).toMatchObject({ enabled: true });
    expect(keyVault.blobs.has(DANA)).toBe(false);
    expect(keyVault.removed).toEqual([DANA]);
    expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();
    const engine = offline.__engineForTests()!;
    expect(engine.cache.persistent).toBe(false);
    const meta = await engine.store.tx(['meta'], 'readonly', async (t) => ({ key: await t.get('meta', META.wrappedKey), by: await t.get('meta', META.wrappedBy) }));
    expect(meta).toEqual({ key: undefined, by: undefined });
    // And no later offline start: the binding is gone, so the cache start is refused before any key is read.
    await offline.__resetForTests();
    wireDevice({ server, rememberMe: false, app: true, keyVault, idb, token: account.token });
    expect(await offline.startFromCache({ token: account.token })).toEqual({ ok: false, reason: 'noBinding' });
  }, 20000);

  it('a start without "Remember me" drops the binding and the vault entry before the database is opened: an open that fails leaves neither behind', async () => {
    const keyVault = fakeKeyVault('keychain');
    const { account, idb } = await bootDevice({ server, rememberMe: true, app: true, keyVault });
    expect(keyVault.blobs.has(DANA)).toBe(true);
    await offline.__resetForTests(); // the app closes; the user signs in again without "Remember me", on a launch whose IndexedDB is broken
    wireDevice({ server, rememberMe: false, app: true, keyVault, idb, token: account.token });
    setIdbFactory(brokenIndexedDb());
    const errors: unknown[] = [];
    const failed = await offline.start({ user: account.user, rememberMe: false, token: account.token, onError: (e) => errors.push(e) });
    expect(failed).toEqual({ enabled: false, reason: 'failed' });
    expect(errors.length).toBeGreaterThan(0);
    expect(offline.isActive()).toBe(false);
    expect(keyVault.blobs.has(DANA)).toBe(false);
    expect(keyVault.removed).toEqual([DANA]);
    expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();
    // The database is reachable again: the blob in `meta` (a dead marker by now) goes with the first start that opens it.
    setIdbFactory(idb);
    expect((await keyAtRest())?.key).toBeDefined();
    wireDevice({ server, rememberMe: false, app: true, keyVault, idb, token: account.token });
    expect(await offline.start({ user: account.user, rememberMe: false, token: account.token })).toMatchObject({ enabled: true });
    expect(keyVault.removed).toEqual([DANA, DANA]);
    expect(await keyAtRest(offline.__engineForTests()!.store)).toEqual({ key: undefined, by: undefined });
  }, 20000);

  it('a start without "Remember me" for the account whose remembered engine is already running drops its key at rest too; the engine keeps running', async () => {
    const keyVault = fakeKeyVault('keychain');
    const { account, engine } = await bootDevice({ server, rememberMe: true, app: true, keyVault });
    expect(window.localStorage.getItem(BINDING_KEY)).toContain(DANA);
    expect(await offline.start({ user: account.user, rememberMe: false, token: account.token })).toMatchObject({ enabled: true });
    expect(offline.__engineForTests()).toBe(engine);
    expect(offline.isActive()).toBe(true);
    expect(keyVault.blobs.has(DANA)).toBe(false);
    expect(keyVault.removed).toEqual([DANA]);
    expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();
    expect(await keyAtRest(engine.store)).toEqual({ key: undefined, by: undefined });
  });

  it('another account signing in removes the first account\'s vault entry; its outbox and mirror stay in its own database', async () => {
    const keyVault = fakeKeyVault('keychain');
    const mirror = fakeMirror();
    const dana = await bootDevice({ server, rememberMe: true, app: true, keyVault, mirror });
    server.mode = 'down';
    await api.entries.create(ENTRY);
    expect(mirror.files.get(DANA)?.size).toBe(1);
    server.mode = 'online';

    // Lior signs in on the same device (same IndexedDB, same vault, same mirror folder).
    const lior = wireDevice({ server, userId: LIOR, rememberMe: true, app: true, keyVault, mirror, idb: dana.idb });
    const started = await offline.start({ user: lior.account.user, rememberMe: true, token: lior.account.token });
    expect(started).toMatchObject({ enabled: true });
    expect(offline.activeUserId()).toBe(LIOR);
    expect(keyVault.blobs.has(LIOR)).toBe(true);
    expect(keyVault.blobs.has(DANA)).toBe(false);
    expect(keyVault.removed).toEqual([DANA]);
    // Dana's waiting change is still there, ciphertext, for her next sign-in (section 4.8).
    const store = await openExistingAccountStore(DANA);
    expect(store).not.toBeNull();
    try {
      const rows = await store!.tx(['outbox', 'meta'], 'readonly', async (t) => ({ outbox: await t.count('outbox'), wrappedKey: await t.get('meta', META.wrappedKey) }));
      expect(rows.outbox).toBe(1);
      expect(rows.wrappedKey).toBeUndefined();
    } finally {
      store!.close();
    }
    expect(mirror.files.get(DANA)?.size).toBe(1);
  }, 20000);

  it('a wipe deletes the database, the mirror files, the binding and the vault entry', async () => {
    const keyVault = fakeKeyVault();
    const mirror = fakeMirror();
    const { idb } = await bootDevice({ server, rememberMe: true, app: true, keyVault, mirror });
    server.mode = 'down';
    await api.entries.create(ENTRY);
    expect(mirror.files.get(DANA)?.size).toBe(1);
    await offline.wipeAccount(DANA);
    expect(offline.isActive()).toBe(false);
    expect(keyVault.blobs.has(DANA)).toBe(false);
    expect(mirror.files.has(DANA)).toBe(false);
    expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();
    const names = (await idb.databases()).map((d) => d.name);
    expect(names.some((n) => n?.includes(DANA))).toBe(false);
  });
});
