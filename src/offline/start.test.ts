import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { EntryInput } from '@shared/types';
import * as api from '@/api';
import { clearToken, setApiTransport } from '@/api/client';
import { offline } from './index';
import { isPendingRecord } from './optimistic';
import { BINDING_KEY, loadSnapshot } from './session';
import { getSyncStatus } from './status';
import { META, VAULT_REMOVE_WAIT_MS } from './keys';
import { deleteAccountStore, openExistingAccountStore, setIdbFactory } from './store/idb';
import type { OfflineStore, StoreName } from './store/types';
import { bootDevice, brokenIndexedDb, DANA, fakeKeyVault, fakeMirror, flush, installWebCrypto, LIOR, resetOfflineTestEnv, waitFor, waitForAsync, wireDevice } from './test-utils/env';
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

// ---------------------------------------------------------------------------------------------------
// Package OFFLINE-SEAL of 1.1.0: a 401 that the key fetch of a start meets first (section 4.8); the
// module's engine read again after an await (another account's engine, or none); the loose ends of
// drain() and of the messages of another tab.
// ---------------------------------------------------------------------------------------------------

/** The rows a 401 deletes and the outbox it keeps, as they are at rest; null when the database does not exist. */
async function sensitiveAtRest(userId = DANA) {
  const store = await openExistingAccountStore(userId);
  if (!store) return null;
  try {
    return await store.tx(['outbox', 'cache', 'journal', 'idmap', 'meta'], 'readonly', async (t) => ({
      outbox: await t.count('outbox'),
      cache: await t.count('cache'),
      journal: await t.count('journal'),
      idmap: await t.count('idmap'),
      wrappedKey: !!(await t.get('meta', META.wrappedKey)),
      snapshot: !!(await t.get('meta', META.snapshot)),
      passwordWrap: !!(await t.get('meta', META.passwordWrap)),
    }));
  } finally {
    store.close();
  }
}

const PURGED = { cache: 0, journal: 0, idmap: 0, wrappedKey: false, snapshot: false, passwordWrap: false };

/** A promise and the function that resolves it. */
function gate() {
  let open: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { done, open: () => open() };
}

/** Collects the unhandled promise rejections of `fn` (and of what it leaves running for `settleMs`). */
async function unhandledRejections(fn: () => Promise<void>, settleMs = 100): Promise<string[]> {
  const proc = (globalThis as unknown as { process: { listeners(e: string): ((...a: unknown[]) => void)[]; removeAllListeners(e: string): void; on(e: string, l: (...a: unknown[]) => void): void } }).process;
  const saved = proc.listeners('unhandledRejection');
  const seen: string[] = [];
  proc.removeAllListeners('unhandledRejection');
  proc.on('unhandledRejection', (reason) => seen.push(String(reason)));
  try {
    await fn();
    await new Promise((r) => setTimeout(r, settleMs));
  } finally {
    proc.removeAllListeners('unhandledRejection');
    for (const l of saved) proc.on('unhandledRejection', l);
  }
  return seen;
}

describe('a 401 met by a start, the engine across an await, drain() and the messages of another tab', () => {
  let server: FakeSyncServer;

  beforeEach(() => {
    server = new FakeSyncServer();
  });

  afterEach(async () => {
    await resetOfflineTestEnv();
  });

  // Item 3. A session without "Remember me" has no binding, so `offline.onUnauthorized()` knows no account
  // at rest: the start that met the 401 must purge it itself (the outbox stays, section 4.8).
  it('a 401 that the key fetch of a second start meets first purges the account at rest; the outbox stays', async () => {
    const { account } = await bootDevice({ server, rememberMe: false, app: false });
    await api.entries.create({ ...ENTRY, title: 'Uploaded and acknowledged' });
    await offline.drain();
    server.mode = 'down';
    await api.entries.list().catch(() => undefined);
    await api.entries.create({ ...ENTRY, title: 'Waiting' });
    server.mode = 'online';
    expect(await sensitiveAtRest()).toMatchObject({ outbox: 1, journal: 1 });
    server.revoke(account.token);
    expect(await offline.start({ user: account.user, rememberMe: false, token: account.token })).toEqual({ enabled: false, reason: 'noKey' });
    await offline.onUnauthorized(); // behind the one the 401 queued
    expect(offline.isActive()).toBe(false);
    expect(await sensitiveAtRest()).toMatchObject({ outbox: 1, ...PURGED });
  }, 20000);

  it('a 401 that the key fetch of the first start after a reload meets purges what an earlier run left at rest', async () => {
    const { account, idb } = await bootDevice({ server, rememberMe: false, app: false });
    await api.entries.create({ ...ENTRY, title: 'Uploaded and acknowledged' });
    await offline.drain();
    expect(await sensitiveAtRest()).toMatchObject({ outbox: 0, journal: 1, idmap: 1 });
    await offline.__resetForTests(); // the page reloads; nothing is armed, there is no binding
    wireDevice({ server, rememberMe: false, app: false, idb, token: account.token });
    server.revoke(account.token);
    expect(await offline.start({ user: account.user, rememberMe: false, token: account.token })).toEqual({ enabled: false, reason: 'noKey' });
    expect(await sensitiveAtRest()).toMatchObject({ outbox: 0, ...PURGED });
  }, 20000);

  it('a key fetch that fails for another reason (no connection) purges nothing', async () => {
    const { account, idb } = await bootDevice({ server, rememberMe: false, app: false });
    await api.entries.create({ ...ENTRY, title: 'Uploaded and acknowledged' });
    await offline.drain();
    await offline.__resetForTests();
    wireDevice({ server, rememberMe: false, app: false, idb, token: account.token });
    server.mode = 'down';
    expect(await offline.start({ user: account.user, rememberMe: false, token: account.token })).toEqual({ enabled: false, reason: 'noKey' });
    expect(await sensitiveAtRest()).toMatchObject({ journal: 1, idmap: 1 });
  }, 20000);

  // Item 4 (reviewer case T4): the read of Dana's snapshot ends only after Lior signed in on the same device.
  it("a snapshot update whose read ends after another account signed in writes nothing into that account's database", async () => {
    const keyVault = fakeKeyVault('keychain');
    const dana = await bootDevice({ server, rememberMe: true, app: true, keyVault });
    const slow = gate();
    const store = dana.engine.store as unknown as { tx: OfflineStore['tx'] };
    const realTx = store.tx.bind(dana.engine.store);
    let gateNext = true;
    store.tx = ((stores: readonly StoreName[], mode: 'readonly' | 'readwrite', fn: never, options: never) => {
      const p = realTx(stores, mode, fn, options);
      if (gateNext && mode === 'readonly' && stores.length === 1 && stores[0] === 'meta') {
        gateNext = false;
        return p.then(async (v: unknown) => {
          await slow.done;
          return v;
        });
      }
      return p;
    }) as OfflineStore['tx'];
    const update = offline.updateSession({ lastActivityAt: 777 });
    expect(gateNext).toBe(false); // the gated read is the one of updateSession

    const lior = wireDevice({ server, userId: LIOR, rememberMe: true, app: true, keyVault, idb: dana.idb });
    expect(await offline.start({ user: lior.account.user, rememberMe: true, token: lior.account.token })).toMatchObject({ enabled: true });
    const l = offline.__engineForTests()!;
    expect(l.userId).toBe(LIOR);
    const before = await loadSnapshot(l.store, l.keys);
    slow.open();
    await expect(update).resolves.toBeUndefined();
    const after = await loadSnapshot(l.store, l.keys);
    expect(before?.user.id).toBe(LIOR);
    expect(after).toEqual(before);
  }, 20000);

  it('updateSession, tryNow and notes.dismiss whose engine is torn down while they wait resolve and do nothing more', async () => {
    const probeGate = gate();
    let gateProbe = false;
    const { engine } = await bootDevice({
      server,
      rememberMe: true,
      app: true,
      keyVault: fakeKeyVault(),
      probe: async () => {
        if (gateProbe) await probeGate.done;
        return true;
      },
    });
    const [note] = await engine.notes.add([{ reason: 'rejected', label: { kind: 'entry', title: 'A note' }, op: { kind: 'entry.delete' }, message: 'x' } as never]);
    const sessionRead = gate();
    const notesWrite = gate();
    const store = engine.store as unknown as { tx: OfflineStore['tx'] };
    const realTx = store.tx.bind(engine.store);
    store.tx = ((stores: readonly StoreName[], mode: 'readonly' | 'readwrite', fn: never, options: never) => {
      const p = realTx(stores, mode, fn, options);
      if (mode === 'readonly' && stores.length === 1 && stores[0] === 'meta') return p.then(async (v: unknown) => (await sessionRead.done, v));
      if (mode === 'readwrite' && stores.length === 1 && stores[0] === 'notes') return p.then(async (v: unknown) => (await notesWrite.done, v));
      return p;
    }) as OfflineStore['tx'];
    gateProbe = true;
    const waiting = [
      settled(offline.updateSession({ lastActivityAt: 777 })),
      settled(offline.tryNow()),
      settled(offline.notes.dismiss(note.id)),
    ];
    await flush(10);
    await offline.stop(); // the sign-out (or a 401) while the three wait
    sessionRead.open();
    notesWrite.open();
    probeGate.open();
    expect(await Promise.all(waiting)).toEqual(['resolved', 'resolved', 'resolved']);
  }, 20000);

  // Item 5. The engine stops while drain() waits for the upload (the 401 of that upload tears it down).
  it('offline.drain() whose engine stops while it waits resolves with what the engine last knew', async () => {
    const { engine } = await bootDevice({ server, rememberMe: true, app: true, keyVault: fakeKeyVault() });
    server.mode = 'down';
    await api.entries.list().catch(() => undefined);
    await api.entries.create(ENTRY);
    server.mode = 'online';
    engine.replayer.settle = async () => {
      await offline.stop();
    };
    await expect(offline.drain()).resolves.toEqual({ remaining: 1, attention: 0 });
  }, 20000);

  // Item 5. Another tab deletes the account's database (a sign-out with "Delete" there): this tab's
  // connection closes (onversionchange) while its engine still runs.
  it('offline.drain() whose store was closed by another tab resolves with what the engine last knew', async () => {
    const { engine } = await bootDevice({ server, rememberMe: false, app: false });
    server.mode = 'down';
    await api.entries.list().catch(() => undefined);
    await api.entries.create(ENTRY);
    await deleteAccountStore(DANA); // fires versionchange on this tab's connection, which closes it
    expect(engine.isStopped).toBe(false);
    await expect(offline.drain()).resolves.toEqual({ remaining: 1, attention: 0 });
  }, 20000);

  it('a message of another tab that arrives after another tab closed this connection leaves no unhandled rejection', async () => {
    const { engine } = await bootDevice({ server, rememberMe: false, app: false });
    server.mode = 'down';
    await api.entries.list().catch(() => undefined);
    await api.entries.create(ENTRY);
    const otherTab = new BroadcastChannel(`ypd-offline-${DANA}`);
    try {
      await deleteAccountStore(DANA);
      expect(engine.isStopped).toBe(false);
      const seen = await unhandledRejections(async () => {
        otherTab.postMessage({ type: 'enqueued' });
      }, 200);
      expect(seen).toEqual([]);
    } finally {
      otherTab.close();
    }
  }, 20000);

  // Item 5 (reviewer case B6): a message of another tab while the 401 purge runs.
  it('a message of another tab while the 401 purge waits for the vault leaves no unhandled rejection', async () => {
    const keyVault = fakeKeyVault('keychain');
    await bootDevice({ server, rememberMe: true, app: true, keyVault });
    const vault = gate();
    let asked = false;
    const remove = keyVault.remove.bind(keyVault);
    keyVault.remove = async (userId) => {
      asked = true;
      await vault.done;
      await remove(userId);
    };
    const otherTab = new BroadcastChannel(`ypd-offline-${DANA}`);
    try {
      const seen = await unhandledRejections(async () => {
        const purge = offline.onUnauthorized();
        await waitFor(() => asked);
        otherTab.postMessage({ type: 'changed' });
        await new Promise((r) => setTimeout(r, 100));
        vault.open();
        await purge;
        otherTab.postMessage({ type: 'enqueued' });
      }, 200);
      expect(seen).toEqual([]);
    } finally {
      otherTab.close();
    }
  }, 20000);
});

function settled(p: Promise<unknown>): Promise<string> {
  return p.then(
    () => 'resolved',
    (e: unknown) => `rejected: ${String(e)}`,
  );
}

// ---------------------------------------------------------------------------------------------------
// Fixer of OFFLINE-SEAL: every step of a start (and of tryNow / updateSession) that waits, with the
// session ended or the engine torn down while it waits. A start keeps the engine it found and arms
// nothing once the session it was asked for is over (a sign-out, a wipe: `sessionTicket` in index.ts).
// ---------------------------------------------------------------------------------------------------

/** Holds the first request whose url starts with `prefix` until released; the rest pass. */
function holdRequest(server: FakeSyncServer, prefix: string) {
  const held = gate();
  const inner = server.transport();
  let seen = false;
  setApiTransport(async (url, init) => {
    if (!seen && url.startsWith(prefix)) {
      seen = true;
      await held.done;
    }
    return inner(url, init);
  });
  return { seen: () => seen, release: held.open };
}

/** What a sign-out does before the engine is stopped (AuthContext.logout): the token and the binding go. */
function signedOut(): void {
  clearToken();
  window.localStorage.removeItem(BINDING_KEY);
}

/** Wraps `store.tx`: `onTx` sees every transaction as it is created and may replace its promise. */
function onTx(store: OfflineStore, fn: (stores: readonly StoreName[], mode: 'readonly' | 'readwrite', p: Promise<unknown>) => Promise<unknown>): void {
  const s = store as unknown as { tx: OfflineStore['tx'] };
  const realTx = s.tx.bind(store);
  s.tx = ((stores: readonly StoreName[], mode: 'readonly' | 'readwrite', body: never, options: never) => fn(stores, mode, realTx(stores, mode, body, options))) as OfflineStore['tx'];
}

describe('a start, a cache start, tryNow and updateSession whose session ends while they wait', () => {
  let server: FakeSyncServer;

  beforeEach(() => {
    server = new FakeSyncServer();
  });

  afterEach(async () => {
    await resetOfflineTestEnv();
  });

  it.each(['the key fetch', 'the epoch', 'the snapshot', 'the password wrap'] as const)(
    'a start with an armed engine whose sign-out lands during %s answers "failed", arms nothing and writes no binding',
    async (step) => {
      const { account, engine } = await bootDevice({ server, rememberMe: true, app: true, keyVault: fakeKeyVault() });
      let signOut: Promise<void> | null = null;
      const doSignOut = (): Promise<void> => {
        signOut ??= (async () => {
          signedOut();
          await offline.stop();
        })();
        return signOut;
      };
      let outcome;
      if (step === 'the key fetch') {
        const epochBefore = engine.epoch;
        server.restore(DANA); // the key answer carries a new epoch: the stopped engine must not take it
        const held = holdRequest(server, '/api/sync/key');
        const start = offline.start({ user: account.user, rememberMe: true, token: account.token, password: 'pw' });
        await waitFor(held.seen);
        await doSignOut();
        held.release();
        outcome = await start;
        expect(engine.epoch).toBe(epochBefore);
      } else {
        if (step === 'the epoch') {
          server.restore(DANA); // the key answer carries a new epoch, so the start writes it
          const real = engine.setEpoch.bind(engine);
          engine.setEpoch = async (epoch: string) => {
            const p = real(epoch);
            await doSignOut();
            return p;
          };
        } else if (step === 'the password wrap') {
          const real = engine.rememberPasswordWrap.bind(engine);
          engine.rememberPasswordWrap = async (...a: Parameters<typeof real>) => {
            const p = real(...a);
            await doSignOut();
            return p;
          };
        } else {
          // The snapshot save of the start is its first write into `meta` (the epoch is unchanged and writes nothing).
          onTx(engine.store, (stores, mode, p) => {
            if (mode === 'readwrite' && stores.length === 1 && stores[0] === 'meta') void doSignOut();
            return p;
          });
        }
        outcome = await offline.start({ user: account.user, rememberMe: true, token: account.token, password: 'pw' });
      }
      expect(signOut).not.toBeNull();
      await signOut;
      expect(outcome).toEqual({ enabled: false, reason: 'failed' });
      expect(offline.isActive()).toBe(false);
      expect(offline.__engineForTests()).toBeNull();
      expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();
    },
    20000,
  );

  it('the first start of a login whose sign-out lands during the key fetch arms nothing and writes no binding', async () => {
    const { account } = wireDevice({ server, rememberMe: true, app: true, keyVault: fakeKeyVault() });
    const held = holdRequest(server, '/api/sync/key');
    const start = offline.start({ user: account.user, rememberMe: true, token: account.token });
    await waitFor(held.seen);
    // The sign-out: no engine is armed yet, so the app does not even call offline.stop() - the token goes.
    signedOut();
    held.release();
    expect(await start).toEqual({ enabled: false, reason: 'failed' });
    expect(offline.__engineForTests()).toBeNull();
    expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();
    expect(await sensitiveAtRest()).toBeNull(); // the database was not even opened
  }, 20000);

  it.each(['during the key fetch', 'while the database opens'] as const)('the first start of a login whose account is wiped %s arms nothing and leaves no database behind', async (when) => {
    const { account, idb } = wireDevice({ server, rememberMe: true, app: true, keyVault: fakeKeyVault() });
    let wipe: Promise<void> | null = null;
    let start: Promise<unknown>;
    if (when === 'during the key fetch') {
      // The token is still there (an account deletion, a wipe from another place): only the wipe tells.
      const held = holdRequest(server, '/api/sync/key');
      start = offline.start({ user: account.user, rememberMe: true, token: account.token });
      await waitFor(held.seen);
      wipe = offline.wipeAccount(DANA);
      await wipe;
      held.release();
    } else {
      const real = idb.open.bind(idb);
      (idb as { open: IDBFactory['open'] }).open = ((name: string, version?: number) => {
        const req = real(name, version);
        if (!wipe && name.includes(DANA)) wipe = offline.wipeAccount(DANA); // queued behind this open
        return req;
      }) as IDBFactory['open'];
      start = offline.start({ user: account.user, rememberMe: true, token: account.token });
    }
    const outcome = await start;
    expect(wipe).not.toBeNull();
    await wipe;
    expect(outcome).toEqual({ enabled: false, reason: 'failed' });
    expect(offline.__engineForTests()).toBeNull();
    expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();
    expect((await idb.databases()).map((d) => d.name).filter((n) => n?.includes(DANA))).toEqual([]);
  }, 20000);

  it('a cache start whose snapshot read ends after the engine was stopped answers noSnapshot and arms nothing', async () => {
    const { account, engine } = await bootDevice({ server, rememberMe: true, app: true, keyVault: fakeKeyVault() });
    const read = gate();
    let gated = false;
    onTx(engine.store, (stores, mode, p) => {
      if (!gated && mode === 'readonly' && stores.length === 1 && stores[0] === 'meta') {
        gated = true;
        return p.then(async (v) => (await read.done, v));
      }
      return p;
    });
    const started = offline.startFromCache({ token: account.token });
    await waitFor(() => gated);
    await offline.stop(); // the kill switch, or a sign-out
    read.open();
    expect(await started).toEqual({ ok: false, reason: 'noSnapshot' });
    expect(offline.__engineForTests()).toBeNull();
  }, 20000);

  it('a cache start whose sign-out lands while it opens the database arms nothing', async () => {
    const keyVault = fakeKeyVault();
    const { account, idb } = await bootDevice({ server, rememberMe: true, app: true, keyVault });
    await offline.__resetForTests(); // the app closes; the binding and the key stay
    wireDevice({ server, rememberMe: true, app: true, keyVault, idb, token: account.token });
    const real = idb.open.bind(idb);
    let stopped = false;
    (idb as { open: IDBFactory['open'] }).open = ((name: string, version?: number) => {
      if (!stopped && name.includes(DANA)) {
        stopped = true;
        void offline.stop();
      }
      return real(name, version);
    }) as IDBFactory['open'];
    server.mode = 'down';
    expect(await offline.startFromCache({ token: account.token })).toEqual({ ok: false, reason: 'noSnapshot' });
    expect(stopped).toBe(true);
    expect(offline.__engineForTests()).toBeNull();
  }, 20000);

  it('tryNow whose probe ends after the engine was torn down answers false and touches that engine no more', async () => {
    const probe = gate();
    let gateProbe = false;
    const { engine } = await bootDevice({
      server,
      rememberMe: true,
      app: true,
      probe: async () => {
        if (gateProbe) await probe.done;
        return true;
      },
    });
    let replayerTryNow = 0;
    const realTryNow = engine.replayer.tryNow.bind(engine.replayer);
    engine.replayer.tryNow = async () => {
      replayerTryNow++;
      return realTryNow();
    };
    gateProbe = true;
    const tapped = offline.tryNow();
    await flush(5);
    await offline.stop();
    probe.open();
    expect(await tapped).toBe(false);
    expect(replayerTryNow).toBe(0);
  }, 20000);

  it('updateSession whose snapshot read ends after the engine was stopped writes nothing more', async () => {
    const { engine } = await bootDevice({ server, rememberMe: true, app: true, keyVault: fakeKeyVault() });
    const read = gate();
    let gated = false;
    let writes = 0;
    onTx(engine.store, (stores, mode, p) => {
      if (mode === 'readwrite') writes++;
      if (!gated && mode === 'readonly' && stores.length === 1 && stores[0] === 'meta') {
        gated = true;
        return p.then(async (v) => (await read.done, v));
      }
      return p;
    });
    const update = offline.updateSession({ lastActivityAt: 777 });
    expect(gated).toBe(true);
    await offline.stop();
    const before = writes;
    read.open();
    await expect(update).resolves.toBeUndefined();
    expect(writes).toBe(before);
  }, 20000);
});

describe('a first start abandoned after the vault wrapped its key leaves no key at rest (section 5.5)', () => {
  let server: FakeSyncServer;

  beforeEach(() => {
    server = new FakeSyncServer();
  });

  afterEach(async () => {
    await resetOfflineTestEnv();
  });

  /** A key vault whose FIRST `wrap` waits for `open()` and then creates its entry (a native plugin that ends after a later `remove`). */
  function heldWrapVault() {
    const vault = fakeKeyVault();
    const held = gate();
    const realWrap = vault.wrap.bind(vault);
    let calls = 0;
    /** The key bytes each `wrap` was handed (the start must zero its copy on every way out). */
    const received: Uint8Array[] = [];
    vault.wrap = async (userId, key) => {
      calls++;
      received.push(key);
      if (calls === 1) await held.done;
      return realWrap(userId, key);
    };
    return { vault, inWrap: () => calls > 0, open: held.open, received };
  }

  it.each(['a wipe of the account', 'a stop() of a sign-out', 'the token gone'] as const)(
    'the session ends by %s while the first start of a login is inside vault.wrap: no vault entry, no wrapped key, no binding, nothing armed',
    async (how) => {
      const v = heldWrapVault();
      const { account, idb } = wireDevice({ server, rememberMe: true, app: true, keyVault: v.vault });
      const start = offline.start({ user: account.user, rememberMe: true, token: account.token });
      await waitFor(v.inWrap);
      if (how === 'a wipe of the account') await offline.wipeAccount(DANA);
      else if (how === 'a stop() of a sign-out') await offline.stop();
      else signedOut();
      expect(v.vault.blobs.has(DANA)).toBe(false);
      v.open(); // the vault's wrap ends now and creates its entry
      expect(await start).toEqual({ enabled: false, reason: 'failed' });
      expect(offline.__engineForTests()).toBeNull();
      expect(v.vault.blobs.has(DANA)).toBe(false);
      expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();
      if (how === 'a wipe of the account') expect((await idb.databases()).map((d) => d.name).filter((n) => n?.includes(DANA))).toEqual([]);
      const rest = await keyAtRest();
      if (rest) expect(rest).toEqual({ key: undefined, by: undefined });
      expect(v.received).toHaveLength(1);
      expect(v.received[0].every((b) => b === 0)).toBe(true); // the raw key handed to the vault is zeroed
    },
    20000,
  );

  it('a vault whose remove never answers after the session ended: the abandoned start answers within the bound, and the next start is not held behind it', async () => {
    const v = heldWrapVault();
    const { account } = wireDevice({ server, rememberMe: true, app: true, keyVault: v.vault });
    const first = offline.start({ user: account.user, rememberMe: true, token: account.token });
    await waitFor(v.inWrap);
    await offline.stop(); // a sign-out that keeps the changes
    let removes = 0;
    v.vault.remove = () => {
      removes++;
      return new Promise<void>(() => undefined); // a native plugin that never answers from now on
    };
    const t0 = Date.now();
    v.open();
    const outcome = await Promise.race([first, new Promise<'hung'>((r) => setTimeout(() => r('hung'), VAULT_REMOVE_WAIT_MS + 3000))]);
    expect(outcome).toEqual({ enabled: false, reason: 'failed' });
    expect(Date.now() - t0).toBeLessThan(VAULT_REMOVE_WAIT_MS + 1500);
    expect(removes).toBeGreaterThan(0); // the cleanup asked the vault
    expect(offline.__engineForTests()).toBeNull();
    // The user signs in again: the start runs (starts are serialised - the queue is free).
    const second = await Promise.race([offline.start({ user: account.user, rememberMe: true, token: account.token }), new Promise<'hung'>((r) => setTimeout(() => r('hung'), 8000))]);
    expect(second).toMatchObject({ enabled: true });
  }, 30000);

  it('a start of a session that goes on, whose vault.wrap fails: the key at rest of the earlier start stays, the offline cold start still works, and the bytes are zeroed', async () => {
    const vault = fakeKeyVault();
    const { account, idb } = await bootDevice({ server, rememberMe: true, app: true, keyVault: vault });
    expect(vault.blobs.has(DANA)).toBe(true);
    const before = await keyAtRest();
    expect(before?.key).toBeTruthy();
    // The app is restarted; its me() succeeds, and the start's wrap fails (the vault refuses).
    await offline.__resetForTests();
    wireDevice({ server, rememberMe: true, app: true, keyVault: vault, idb, token: account.token });
    const received: Uint8Array[] = [];
    const realWrap = vault.wrap.bind(vault);
    vault.wrap = async (_userId, key) => {
      received.push(key);
      throw new Error('the vault refused');
    };
    expect(await offline.start({ user: account.user, rememberMe: true, token: account.token })).toEqual({ enabled: false, reason: 'failed' });
    expect(received).toHaveLength(1);
    expect(received[0].every((b) => b === 0)).toBe(true);
    expect(vault.blobs.has(DANA)).toBe(true);
    expect(await keyAtRest()).toEqual(before);
    vault.wrap = realWrap;
    // The next launch without a connection opens from the cache as before.
    await offline.__resetForTests();
    wireDevice({ server, rememberMe: true, app: true, keyVault: vault, idb, token: account.token });
    server.mode = 'down';
    expect((await offline.startFromCache({ token: account.token })).ok).toBe(true);
  }, 30000);

  it('a new start of the same account right behind the abandoned one keeps what it stores: the cleanup runs before it', async () => {
    const v = heldWrapVault();
    const { account } = wireDevice({ server, rememberMe: true, app: true, keyVault: v.vault });
    const first = offline.start({ user: account.user, rememberMe: true, token: account.token });
    await waitFor(v.inWrap);
    await offline.wipeAccount(DANA);
    // The user signs in again at once: this start is asked for after the wipe and waits behind the first.
    const second = offline.start({ user: account.user, rememberMe: true, token: account.token });
    v.open();
    expect(await first).toEqual({ enabled: false, reason: 'failed' });
    expect(await second).toMatchObject({ enabled: true });
    expect(offline.__engineForTests()).not.toBeNull();
    expect(v.vault.blobs.has(DANA)).toBe(true);
    expect(window.localStorage.getItem(BINDING_KEY)).toContain(DANA);
    expect((await keyAtRest())?.key).toBeTruthy();
  }, 20000);
});
