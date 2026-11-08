/**
 * Recovery paths of the engine (fixer regressions, WP-H10b): an evicted database after an offline
 * cache-start attempt (section 5.4, section 9 L8), local ids after a mirror recovery (section 4.3 (c)),
 * a key-check mismatch that must keep the mirror (section 5.2), a 401 that arrives before the engine
 * runs (sections 4.8, 5.1, 5.5) and the server's self-description on a cold offline start (section 4.7).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { EntryInput } from '@shared/types';
import * as api from '@/api';
import { getServerInfo, setServerInfo } from '@/api/connection';
import { randomUuid } from './crypto';
import { OfflineEngine } from './engine';
import { offline } from './index';
import { META } from './keys';
import { opFileName } from './mirror';
import { setOfflinePlatform, __resetOfflinePlatformForTests } from './seams';
import { BINDING_KEY } from './session';
import { __resetSyncStatusForTests, getSyncStatus } from './status';
import { openAccountStore, openExistingAccountStore, setIdbFactory } from './store/idb';
import { bootDevice, brokenIndexedDb, DANA, fakeKeyVault, fakeMirror, freshIndexedDb, installWebCrypto, resetOfflineTestEnv, testKeys, waitForAsync, wireDevice } from './test-utils/env';
import { FakeSyncServer } from './test-utils/fake-sync-server';
import type { QueuedOp } from './types';

beforeAll(() => installWebCrypto());

function entryInput(title: string, over: Partial<EntryInput> = {}): EntryInput {
  return { date: '2026-10-23', time: '08:00', title, body: `${title} body`, mood: 7, emotions: [], energy: null, stress: null, sleepQuality: null, sleepHours: null, exerciseMinutes: null, exerciseType: '', events: [], people: [], location: '', notes: '', tags: ['walk'], ...over };
}

/** Rows of the account's database as they are on disk (the engine is bypassed); null when it does not exist. */
async function onDisk(userId = DANA) {
  const store = await openExistingAccountStore(userId);
  if (!store) return null;
  try {
    return await store.tx(['outbox', 'notes', 'cache', 'journal', 'idmap', 'meta'], 'readonly', async (t) => ({
      outbox: await t.count('outbox'),
      notes: await t.count('notes'),
      cache: await t.count('cache'),
      journal: await t.count('journal'),
      idmap: await t.count('idmap'),
      wrappedKey: !!(await t.get('meta', META.wrappedKey)),
      snapshot: !!(await t.get('meta', META.snapshot)),
    }));
  } finally {
    store.close();
  }
}

describe('engine recovery paths', () => {
  let server: FakeSyncServer;

  beforeEach(() => {
    server = new FakeSyncServer();
  });

  afterEach(async () => {
    await resetOfflineTestEnv();
  });

  it('eviction: an offline cache-start attempt creates no database, and the next start recovers the mirror and uploads it exactly once', async () => {
    const mirror = fakeMirror();
    const keyVault = fakeKeyVault();
    const { account } = await bootDevice({ server, rememberMe: true, app: true, mirror, keyVault });
    server.mode = 'down';
    await api.entries.create(entryInput('Written before the eviction'));
    expect(mirror.files.get(DANA)!.size).toBe(1);
    await offline.__resetForTests(); // the app closes

    // IndexedDB is evicted (localStorage - token and binding - and the native mirror survive).
    const evicted = freshIndexedDb();
    wireDevice({ server, rememberMe: true, app: true, mirror, keyVault, idb: evicted, token: account.token });
    server.mode = 'down';
    expect(await offline.startFromCache({ token: account.token })).toEqual({ ok: false, reason: 'noKey' });
    expect((await evicted.databases()).map((d) => d.name)).toEqual([]);
    expect(mirror.files.get(DANA)!.size).toBe(1);

    // The connection returns: me() succeeds and the engine starts for real.
    server.mode = 'online';
    const started = await offline.start({ user: account.user, rememberMe: true, token: account.token });
    expect(started).toMatchObject({ enabled: true, recovered: 1 });
    await offline.drain();
    expect([...server.diary(DANA).entries.values()].map((e) => e.title)).toEqual(['Written before the eviction']);
    expect(getSyncStatus().pending).toBe(0);
    expect(mirror.calls.filter((c) => c.startsWith('remove')).length).toBe(1); // removed only after the upload
    expect(mirror.files.get(DANA)?.size ?? 0).toBe(0);
  }, 20000);

  it('eviction: an EMPTY database left behind (no meta) still counts as missing - the mirror is recovered, not deleted as orphans', async () => {
    const mirror = fakeMirror();
    const keyVault = fakeKeyVault();
    const { account } = await bootDevice({ server, rememberMe: true, app: true, mirror, keyVault });
    server.mode = 'down';
    await api.entries.create(entryInput('Kept through the eviction'));
    await offline.__resetForTests();

    const evicted = freshIndexedDb();
    // An earlier build's cache-start attempt created the database with its stores and nothing else.
    const { store } = await openAccountStore(DANA);
    store.close();
    wireDevice({ server, rememberMe: true, app: true, mirror, keyVault, idb: evicted, token: account.token });
    server.mode = 'online';
    const started = await offline.start({ user: account.user, rememberMe: true, token: account.token });
    expect(started).toMatchObject({ enabled: true, recovered: 1 });
    await offline.drain();
    expect(server.diary(DANA).entries.size).toBe(1);
  }, 20000);

  it('after a mirror recovery new creates get NEW local ids; both records stay visible and an edit reaches the right one', async () => {
    const mirror = fakeMirror();
    const keyVault = fakeKeyVault();
    const { account } = await bootDevice({ server, rememberMe: true, app: true, mirror, keyVault });
    server.mode = 'down';
    const a = await api.entries.create(entryInput('A before eviction'));
    expect(a.id).toBe(-1);
    await offline.__resetForTests();

    const evicted = freshIndexedDb();
    wireDevice({ server, rememberMe: true, app: true, mirror, keyVault, idb: evicted, token: account.token });
    server.mode = 'online';
    server.quotaFull = true; // the recovered create waits (507)
    expect(await offline.start({ user: account.user, rememberMe: true, token: account.token })).toMatchObject({ enabled: true, recovered: 1 });
    await offline.drain();
    expect(getSyncStatus().pending).toBe(1);

    // The recovered create is addressable by its local id (the id map came back).
    server.mode = 'down';
    await api.entries.list().catch(() => undefined); // the data layer notices the lost connection
    expect((await api.entries.get(-1)).title).toBe('A before eviction');
    const b = await api.entries.create(entryInput('B after recovery'));
    expect(b.id).toBe(-2);
    expect((await api.entries.get(-1)).title).toBe('A before eviction');
    expect((await api.entries.get(-2)).title).toBe('B after recovery');
    const list = await api.entries.list();
    expect(list.items.map((i) => i.id).sort((x, y) => x - y)).toEqual([-2, -1]);

    server.mode = 'online';
    server.quotaFull = false;
    await offline.tryNow();
    await offline.drain();
    const idA = offline.serverIdOf(-1);
    const idB = offline.serverIdOf(-2);
    expect(idA).not.toBeNull();
    expect(idB).not.toBeNull();
    expect(idA).not.toBe(idB);
    expect(server.diary(DANA).entries.get(idA!)?.title).toBe('A before eviction');

    await api.entries.update(-2, entryInput('B edited by the user'));
    await offline.drain();
    expect(server.diary(DANA).entries.get(idA!)?.title).toBe('A before eviction');
    expect(server.diary(DANA).entries.get(idB!)?.title).toBe('B edited by the user');
    expect(getSyncStatus().pending).toBe(0);
  }, 20000);

  it('a key-check mismatch (read-only engine) keeps the mirror copies of the rows it cannot read', async () => {
    freshIndexedDb();
    __resetOfflinePlatformForTests();
    const mirror = fakeMirror();
    setOfflinePlatform({ mirror });
    const first = await OfflineEngine.open({ userId: DANA, keys: await testKeys(DANA, 1), persistentCache: true, tokenTag: 't', probe: async () => true });
    const clientId = randomUuid();
    const q: QueuedOp = { op: { v: 1, account: DANA, opId: randomUuid(), editedAt: '2026-10-23T08:00:00.000Z', epoch: 'e', kind: 'entry.create', clientId, payload: entryInput('Kept?') }, record: `c:${clientId}`, chain: `entry:c:${clientId}`, localId: -1, queuedAt: 1 };
    const r = await first.enqueue({ q, deps: [], idmap: [{ localId: -1, kind: 'entry', clientId }] });
    first.stop();
    // A note's copy too (written by the same key).
    await mirror.put(DANA, '1-11111111-1111-4111-8111-111111111111.note', new TextEncoder().encode('{}'));

    const second = await OfflineEngine.open({ userId: DANA, keys: await testKeys(DANA, 2), persistentCache: true, tokenTag: 't', probe: async () => true });
    expect(second.readOnly).toBe(true);
    expect(mirror.files.get(DANA)?.has(opFileName(r.seq, q.op.opId))).toBe(true);
    expect(mirror.files.get(DANA)?.size).toBe(2);
    expect(mirror.calls.filter((c) => c.startsWith('remove'))).toEqual([]);
    second.stop();
    __resetSyncStatusForTests();
  });

  it('orphan cleanup keeps the copy of an outbox row the key cannot read, and deletes real orphans', async () => {
    freshIndexedDb();
    __resetOfflinePlatformForTests();
    const mirror = fakeMirror();
    setOfflinePlatform({ mirror });
    const keys = await testKeys(DANA, 1);
    const first = await OfflineEngine.open({ userId: DANA, keys, persistentCache: true, tokenTag: 't', probe: async () => true });
    const clientId = randomUuid();
    const q: QueuedOp = { op: { v: 1, account: DANA, opId: randomUuid(), editedAt: '2026-10-23T08:00:00.000Z', epoch: 'e', kind: 'entry.create', clientId, payload: entryInput('Readable') }, record: `c:${clientId}`, chain: `entry:c:${clientId}`, localId: -1, queuedAt: 1 };
    const r = await first.enqueue({ q, deps: [], idmap: [] });
    first.stop();
    // A row of the same database whose ciphertext does not decrypt (damaged), with its mirror copy.
    const { store } = await openAccountStore(DANA);
    const badRid = randomUuid();
    const badSeq = Number(await store.tx(['outbox'], 'readwrite', (t) => t.put('outbox', { rid: badRid, sealed: false, chainTag: 'x', deps: [], attempts: 0, nextAt: 0, ct: new Uint8Array([1, 2, 3]) })));
    store.close();
    await mirror.put(DANA, opFileName(badSeq, badRid), new TextEncoder().encode('{}'));
    const orphan = opFileName(badSeq + 10, randomUuid());
    await mirror.put(DANA, orphan, new TextEncoder().encode('{}'));

    const again = await OfflineEngine.open({ userId: DANA, keys, persistentCache: true, tokenTag: 't', probe: async () => true });
    expect(again.readOnly).toBe(false);
    expect([...mirror.files.get(DANA)!.keys()].sort()).toEqual([opFileName(r.seq, q.op.opId), opFileName(badSeq, badRid)].sort());
    again.stop();
    __resetSyncStatusForTests();
  });

  it('a session revoked while the app was closed: the first 401 deletes the wrapped key, the snapshot and the cache; the outbox stays', async () => {
    const keyVault = fakeKeyVault();
    const mirror = fakeMirror();
    const { account, engine, idb } = await bootDevice({ server, rememberMe: true, app: true, keyVault, mirror });
    await waitForAsync(async () => (await engine.cache.get('/api/home')) !== null, 6000);
    server.mode = 'down';
    await api.entries.create(entryInput('Waiting for the upload'));
    await offline.__resetForTests(); // the app closes
    const before = await onDisk();
    expect(before).toMatchObject({ outbox: 1, wrappedKey: true, snapshot: true });
    expect(before!.cache).toBeGreaterThan(0);

    // The app starts again; meanwhile the session was revoked elsewhere.
    wireDevice({ server, rememberMe: true, app: true, keyVault, mirror, idb, token: account.token });
    server.mode = 'online';
    server.revoke(account.token);
    const err = await api.auth.me().catch((e: unknown) => e);
    expect((err as { status: number }).status).toBe(401);
    expect(offline.isActive()).toBe(false);
    // The engine's own UNAUTHORIZED_EVENT listener purges the account named by the binding.
    await waitForAsync(async () => (await onDisk())?.wrappedKey === false);
    expect(await onDisk()).toEqual({ outbox: 1, notes: 0, cache: 0, journal: 0, idmap: 0, wrappedKey: false, snapshot: false });
    expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();
    expect(mirror.files.get(DANA)?.size).toBe(1);
  }, 20000);

  it('the explicit offline.onUnauthorized() purges the account at rest too, and never creates a database', async () => {
    const keyVault = fakeKeyVault();
    const { account, idb } = await bootDevice({ server, rememberMe: true, app: true, keyVault });
    await offline.__resetForTests();
    wireDevice({ server, rememberMe: true, app: true, keyVault, idb, token: account.token });
    await offline.onUnauthorized();
    expect(await onDisk()).toMatchObject({ wrappedKey: false, snapshot: false, cache: 0 });
    expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();

    // A binding whose database is gone (evicted): nothing is created by the purge.
    const empty = freshIndexedDb();
    window.localStorage.setItem(BINDING_KEY, JSON.stringify({ userId: DANA, tokenTag: '0123456789abcdef' }));
    await offline.onUnauthorized();
    expect((await empty.databases()).map((d) => d.name)).toEqual([]);
  }, 20000);

  // The vault's entry goes with the wrapped key (sections 5.1 / 5.5; APPLE-PLAN WP-M3). On the Mac the
  // IndexedDB blob is only the marker of the Keychain item that holds the key, so `meta.wrappedKey`
  // alone going would leave the account's outbox and mirror decryptable; the fake vault keeps the key
  // the same way (`blobs`).
  it('a 401 removes the vault entry too: while the engine runs, for the account at rest, and when its database was evicted', async () => {
    const keyVault = fakeKeyVault('keychain');
    const mirror = fakeMirror();
    const { account, idb } = await bootDevice({ server, rememberMe: true, app: true, keyVault, mirror });
    expect(keyVault.blobs.has(DANA)).toBe(true);
    server.mode = 'down';
    await api.entries.create(entryInput('Waiting for the upload'));

    // (1) The engine runs: the session is revoked, the next request answers 401.
    server.mode = 'online';
    server.revoke(account.token);
    const err = await api.auth.me().catch((e: unknown) => e);
    expect((err as { status: number }).status).toBe(401);
    await waitForAsync(async () => !keyVault.blobs.has(DANA));
    expect(await onDisk()).toMatchObject({ outbox: 1, wrappedKey: false, snapshot: false, cache: 0 });
    expect(mirror.files.get(DANA)?.size).toBe(1); // the outbox and its mirror stay (section 4.8)
    expect(offline.isActive()).toBe(false);

    // (2) At rest: a new remembered session (wireDevice signs the token in again) wraps the key again;
    // the app closes; the first contact is a 401.
    wireDevice({ server, rememberMe: true, app: true, keyVault, mirror, idb, token: account.token });
    expect(await offline.start({ user: account.user, rememberMe: true, token: account.token })).toMatchObject({ enabled: true });
    expect(keyVault.blobs.has(DANA)).toBe(true);
    await offline.__resetForTests();
    wireDevice({ server, rememberMe: true, app: true, keyVault, mirror, idb, token: account.token });
    await offline.onUnauthorized();
    expect(keyVault.blobs.has(DANA)).toBe(false);
    expect(await onDisk()).toMatchObject({ outbox: 1, wrappedKey: false });

    // (3) The binding names an account whose database was evicted: the vault entry still goes, and no database is created.
    const empty = freshIndexedDb();
    keyVault.blobs.set(DANA, 'keychain:item:left-behind');
    window.localStorage.setItem(BINDING_KEY, JSON.stringify({ userId: DANA, tokenTag: '0123456789abcdef' }));
    await offline.onUnauthorized();
    expect(keyVault.blobs.has(DANA)).toBe(false);
    expect((await empty.databases()).map((d) => d.name)).toEqual([]);
    expect(keyVault.removed.filter((u) => u === DANA).length).toBeGreaterThanOrEqual(3);
  }, 20000);

  it('the 401 purge still completes when the vault refuses to remove the key, and the next start works', async () => {
    const keyVault = fakeKeyVault('keychain');
    const { account, idb } = await bootDevice({ server, rememberMe: true, app: true, keyVault });
    server.mode = 'down';
    await api.entries.create(entryInput('Kept through the failing vault'));
    const errors: unknown[] = [];
    keyVault.remove = async () => {
      throw new Error('vault down');
    };
    await expect(offline.onUnauthorized()).resolves.toBeUndefined();
    expect(offline.isActive()).toBe(false);
    expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();
    expect(await onDisk()).toMatchObject({ outbox: 1, wrappedKey: false, snapshot: false, cache: 0, journal: 0, idmap: 0 });
    // The account at rest, with the vault still failing: the rows go all the same.
    server.mode = 'online';
    wireDevice({ server, rememberMe: true, app: true, keyVault, idb, token: account.token });
    expect(await offline.start({ user: account.user, rememberMe: true, token: account.token })).toMatchObject({ enabled: true });
    await offline.__resetForTests();
    wireDevice({ server, rememberMe: true, app: true, keyVault, idb, token: account.token });
    await expect(offline.onUnauthorized()).resolves.toBeUndefined();
    expect(await onDisk()).toMatchObject({ outbox: 1, wrappedKey: false, snapshot: false });
    // A start without "Remember me" asks the failing vault too, reports it and still arms the engine.
    wireDevice({ server, rememberMe: false, app: true, keyVault, idb, token: account.token });
    const started = await offline.start({ user: account.user, rememberMe: false, token: account.token, onError: (e) => errors.push(e) });
    expect(started).toMatchObject({ enabled: true });
    expect(errors.some((e) => (e as Error).message === 'vault down')).toBe(true);
    expect(offline.isActive()).toBe(true);
  }, 20000);

  // A database that cannot be opened is not a missing one: `openExistingAccountStore` rejects (idb.ts),
  // and the vault's entry must go all the same - on the Mac it is the key at rest itself.
  it('a 401 for the account at rest removes the vault entry even when its database cannot be opened (a failing IndexedDB, not a missing one)', async () => {
    const keyVault = fakeKeyVault('keychain');
    const mirror = fakeMirror();
    const { account, idb } = await bootDevice({ server, rememberMe: true, app: true, keyVault, mirror });
    server.mode = 'down';
    await api.entries.create(entryInput('Waiting for the upload'));
    await offline.__resetForTests(); // the app closes; the binding and the vault's item stay
    for (const how of ['throws', 'fails'] as const) {
      keyVault.blobs.set(DANA, 'keychain:item');
      window.localStorage.setItem(BINDING_KEY, JSON.stringify({ userId: DANA, tokenTag: '0123456789abcdef' }));
      setIdbFactory(brokenIndexedDb(how));
      await expect(offline.onUnauthorized(), how).resolves.toBeUndefined();
      expect(keyVault.blobs.has(DANA), how).toBe(false);
      expect(window.localStorage.getItem(BINDING_KEY), how).toBeNull();
    }
    expect(keyVault.removed).toEqual([DANA, DANA]);
    // The database itself was only unreachable: its rows are still there for the next start, which uploads the outbox.
    setIdbFactory(idb);
    expect(await onDisk()).toMatchObject({ outbox: 1 });
    server.mode = 'online';
    wireDevice({ server, rememberMe: true, app: true, keyVault, mirror, idb, token: account.token });
    expect(await offline.start({ user: account.user, rememberMe: true, token: account.token })).toMatchObject({ enabled: true });
    await offline.drain();
    expect(server.diary(DANA).entries.size).toBe(1);
    expect(getSyncStatus().pending).toBe(0);
  }, 20000);

  it('a cold offline start (no ServerInfo yet) arms the facade from the snapshot and serves the cached views', async () => {
    server.seedEntry(DANA, { title: 'Yesterday', date: '2026-10-22' });
    const keyVault = fakeKeyVault('keystore');
    const { account, idb, engine } = await bootDevice({ server, rememberMe: true, app: true, keyVault });
    await waitForAsync(async () => (await engine.cache.get('/api/home')) !== null, 6000);
    await offline.__resetForTests();

    wireDevice({ server, rememberMe: true, app: true, keyVault, idb, token: account.token });
    server.mode = 'down';
    setServerInfo(null); // GET /api/server/info never answered on this launch
    const started = await offline.startFromCache({ token: account.token });
    expect(started.ok).toBe(true);
    expect(getServerInfo()?.offlineSync).toBe(1);
    expect(getServerInfo()?.mode).toBe('hosted');
    expect(offline.isActive()).toBe(true);
    const home = await api.insights.home();
    expect(home.totalEntries).toBe(1);
  }, 20000);
});
