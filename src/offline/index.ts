/**
 * The offline engine's public API (WP-H10b; docs/android-tasks/OFFLINE-DESIGN.md sections 4-5).
 * One implementation for the Windows app, the Android app and the web UI; the UI package (WP-H10c)
 * drives it from the auth / connection / lock contexts and reads its state from ./status.ts.
 *
 * Lifecycle
 *  - `offline.start(args)` after every successful `me()` or login: refuses guests, local builds and
 *    servers without `ServerInfo.offlineSync`; fetches the account offline key, opens the account's
 *    database, arms the facade (src/api/index.ts), starts the connectivity monitor and the replayer,
 *    warms the cache. On an app with "Remember me" it also stores the wrapped key, the binding and
 *    the session snapshot for an offline start.
 *  - `offline.startFromCache({ token })` at start, when the first `me()` fails with a connection error:
 *    the binding must match the token, the platform must be an app, the key must unwrap and the
 *    snapshot must decrypt; it returns the snapshot (the AuthProvider shows the app from it).
 *  - `offline.onUnauthorized()` on 401 (the engine listens to UNAUTHORIZED_EVENT too): the cache,
 *    journal, id map, snapshot, wrapped key (the vault's entry included) and binding go; the outbox,
 *    notes and mirror stay.
 *  - `offline.stop()` on sign-out (after the dialog), `offline.wipeAccount(userId)` to delete
 *    everything of an account on this device (logout with "Delete", account deletion).
 *  - `offline.drain()` before an online-only write; `offline.tryNow()` for "Try now";
 *    `offline.notifyUnlocked()` after the lock screen; `offline.updateSession()` to keep the snapshot
 *    current (locked, last activity).
 *  - Offline unlock by password (owner decision 2026-11-08, ./password-wrap.ts): whenever the server
 *    has just accepted the password - a login (`StartArgs.password`), a `verifyPassword`, a password
 *    change (`offline.refreshPasswordWrap`) - the engine keeps the AOK wrapped under it (memory; at
 *    rest only with "Remember me" on an app). `offline.unlockWithPassword` checks a password on the
 *    device while the server is out of reach; `offline.canUnlockWithPassword` says whether a wrap exists.
 */
import type { SyncKeyResponse } from '@shared/sync';
import type { ServerInfo, UserProfile } from '@shared/types';
import { LOCKED_EVENT, UNAUTHORIZED_EVENT, getToken, isConnectionError, isApiClientError } from '@/api/client';
import { getServerInfo, setServerInfo } from '@/api/connection';
import { cryptoAvailable, zero } from './crypto';
import { OfflineEngine, purgeAccountAtRest, wipeAccountData, type EngineOpenOptions, type PasswordUnlockResult } from './engine';
import { armedAccount, isOfflineEnabled, offlineModeSupported, setArmedAccount } from './enabled';
import { setEngineAccessor, warmUp, WARM_UP_MIN_GAP_MS } from './facade';
import { aokBytes, armKeys, fetchSyncKey, keyVault, loadWrappedKey, removeVaultKey, removeWrappedKey, storeWrappedKey } from './keys';
import { makePasswordWrap } from './password-wrap';
import { accountDbName, idbFactory, openExistingAccountStore } from './store/idb';
import { DB_PREFIX } from './store/types';
import { clearBinding, isApp, loadSnapshot, matchingBinding, readBinding, saveSnapshot, tokenTagOf, writeBinding, type SessionSnapshot } from './session';
import { __resetSyncStatusForTests, getSyncStatus, patchSyncStatus, subscribeSyncStatus } from './status';
import type { PendingItem, SyncNote } from './types';

export { isOfflineEnabled, offlineModeSupported } from './enabled';
export { getSyncStatus, subscribeSyncStatus, type SyncStatus, type ConnectionPhase, type SyncHalt } from './status';
export { isPendingRecord } from './optimistic';
export { isPartialView, DeviceStorageError, NotCachedError, type PasswordUnlockResult } from './engine';
export { setOfflinePlatform, notifyResume, type OfflineKeyVault, type OutboxMirror, type DeviceUserCheck } from './seams';
export type { SyncNote, PendingItem, NoteReason, OpLabel } from './types';
export type { SessionSnapshot } from './session';
export { BINDING_KEY } from './session';

export interface StartArgs {
  user: UserProfile;
  rememberMe: boolean;
  /** The session token (for the binding tag). Read from storage when omitted. */
  token?: string | null;
  serverInfo?: ServerInfo | null;
  /** The session as the app knows it (the snapshot). */
  locked?: boolean;
  lastActivityAt?: number;
  /**
   * The password the server has JUST accepted (a login with a password; never a cache start or a
   * `me()`): the engine wraps the AOK under it for the offline unlock (./password-wrap.ts) and forgets
   * it. The caller passes it once and keeps no copy.
   */
  password?: string;
  /** Tests: the health probe to use. */
  probe?: () => Promise<boolean>;
  onError?: (e: unknown) => void;
}

export type StartOutcome =
  | { enabled: true; recovered: number | null; readOnly: boolean }
  | { enabled: false; reason: 'unsupported' | 'guest' | 'noKey' | 'noToken' | 'failed' };

let engine: OfflineEngine | null = null;
/** Starts are serialised: a `start` and a `startFromCache` never race for the same database. */
let starting: Promise<unknown> | null = null;
let lastWarmUpAt = 0;
let listenersInstalled = false;

setEngineAccessor(() => (engine && isOfflineEnabled() && engine.userId === armedAccount() ? engine : null));

/**
 * The engine hears UNAUTHORIZED_EVENT from the first request on, not only once it runs: a session
 * revoked while the app was closed answers the very first `me()` with 401, and the binding's account
 * must then lose its wrapped key, snapshot and cache (section 4.8 / 5.1). Bubble-phase listeners on
 * `window`: the AuthProvider's capture-phase listener can still stop a suppressed 401 (a wrong
 * password) before it reaches these (capture listeners run first at the target).
 */
function installWindowListeners(): void {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;
  window.addEventListener(UNAUTHORIZED_EVENT, () => {
    void offline.onUnauthorized();
  });
  window.addEventListener(LOCKED_EVENT, () => {
    engine?.connectivity.uploadPaused();
  });
}

/** Runs `fn` after any start in flight (a start and a 401 purge never race for one database). */
function serialised<T>(fn: () => Promise<T>): Promise<T> {
  const run = (starting ?? Promise.resolve()).catch(() => undefined).then(fn);
  starting = run.finally(() => {
    if (starting === run) starting = null;
  });
  return run;
}

/** The fields of a `ServerInfo` the snapshot does not keep (a cold offline start has no other source). */
function serverInfoFromSnapshot(snap: SessionSnapshot): ServerInfo {
  return { version: '', port: 0, lanEnabled: false, lanUrls: [], dataDir: '', isLocalRequest: false, startedAt: '', ...snap.serverInfo };
}

async function teardown(purge: boolean): Promise<void> {
  const current = engine;
  engine = null;
  setArmedAccount(null);
  if (!current) return;
  if (purge) await current.purgeSensitive();
  current.stop();
}

async function openEngine(opts: EngineOpenOptions & { rememberMe: boolean }): Promise<OfflineEngine> {
  const e = await OfflineEngine.open(opts);
  e.onDrained = () => {
    const now = e.now();
    if (now - lastWarmUpAt < WARM_UP_MIN_GAP_MS || e.isStopped) return;
    lastWarmUpAt = now;
    void warmUp(e);
  };
  return e;
}

/**
 * A password is in hand (the server accepted it a moment ago) and the key answer too: the AOK goes
 * into a wrap under the password, kept by the engine (memory; `meta` when persistent). Never for a
 * read-only engine (its data was written with another key: a wrap would open and then fail the key
 * check, telling the user the right password is wrong). The key bytes are zeroed before this returns.
 */
async function keepPasswordWrap(e: OfflineEngine, password: string, res: SyncKeyResponse, onError?: (err: unknown) => void, atRest = true): Promise<void> {
  if (e.readOnly) return;
  let aok: Uint8Array | null = null;
  try {
    aok = aokBytes(res);
    await e.rememberPasswordWrap(await makePasswordWrap(password, aok, e.userId), atRest);
  } catch (err) {
    onError?.(err);
  } finally {
    zero(aok);
  }
}

function snapshotOf(args: StartArgs, info: ServerInfo | null): SessionSnapshot {
  return {
    user: args.user,
    rememberMe: args.rememberMe,
    locked: args.locked ?? false,
    lastActivityAt: args.lastActivityAt ?? Date.now(),
    serverInfo: { mode: info?.mode, publicUrl: info?.publicUrl, offlineSync: info?.offlineSync, guestTour: info?.guestTour, passwordResetAvailable: info?.passwordResetAvailable },
  };
}

async function doStart(args: StartArgs): Promise<StartOutcome> {
  installWindowListeners();
  if (args.user.guest) {
    await teardown(false);
    return { enabled: false, reason: 'guest' };
  }
  if (!offlineModeSupported()) {
    await teardown(false);
    return { enabled: false, reason: 'unsupported' };
  }
  const token = args.token ?? getToken();
  if (!token) {
    await teardown(false);
    return { enabled: false, reason: 'noToken' };
  }
  const info = args.serverInfo ?? getServerInfo();
  const app = isApp();
  const persistent = app && args.rememberMe;

  // Another account signed in on this device: its cache, snapshot, wrapped key and vault entry go; its outbox stays in its own database.
  if (engine && engine.userId !== args.user.id) await teardown(true);

  // No "Remember me": nothing decryptable at rest (section 5.1). The binding and the vault's entry of an
  // earlier remembered session of this account go right here, before anything that can still fail (the
  // key fetch, the database): a start that fails must not leave them behind - on the Mac the vault's
  // entry is the key at rest itself. The blob in `meta` goes as soon as the account's store is open (below).
  if (!persistent) {
    if (readBinding()?.userId === args.user.id) clearBinding();
    await removeVaultKey(args.user.id, args.onError);
  }

  let res;
  try {
    res = await fetchSyncKey();
  } catch (e) {
    args.onError?.(e);
    if (engine && engine.userId === args.user.id && isConnectionError(e)) {
      // A cache session whose `me()` succeeded earlier: keep running with the keys in hand.
      return { enabled: true, recovered: engine.recovered, readOnly: engine.readOnly };
    }
    await teardown(false);
    return { enabled: false, reason: isApiClientError(e) && e.status === 403 ? 'guest' : 'noKey' };
  }

  const tokenTag = await tokenTagOf(token);
  if (engine && engine.userId === args.user.id) {
    // Already running (a cache start, or `me()` again): refresh the token tag and the snapshot.
    engine.tokenTag = tokenTag;
    await engine.setEpoch(res.epoch);
    if (persistent) await saveSnapshot(engine.store, engine.keys, snapshotOf(args, info)).catch(args.onError);
    if (persistent) await writeBinding(args.user.id, token);
    else await removeWrappedKey(engine.store, args.user.id, false, args.onError);
    // At rest only when THIS start is remembered (the engine may have been opened persistent earlier).
    if (args.password) await keepPasswordWrap(engine, args.password, res, args.onError, persistent);
    engine.replayer.kick();
    return { enabled: true, recovered: engine.recovered, readOnly: engine.readOnly };
  }

  try {
    const raw = aokBytes(res);
    const forVault = persistent && keyVault() ? new Uint8Array(raw) : null;
    const keys = await armKeys(raw, args.user.id);
    const e = await openEngine({ userId: args.user.id, keys, persistentCache: persistent, tokenTag, probe: args.probe, onError: args.onError, rememberMe: args.rememberMe });
    await e.setEpoch(res.epoch);
    e.clock.learn(res.serverNow, Date.now() - 50, Date.now());
    if (persistent) {
      if (forVault) {
        await storeWrappedKey(e.store, args.user.id, forVault).catch(args.onError);
        forVault.fill(0);
      }
      await saveSnapshot(e.store, e.keys, snapshotOf(args, info)).catch(args.onError);
      await writeBinding(args.user.id, token);
    } else {
      // No "Remember me": the wrapped key of an earlier remembered session goes (its binding and the
      // vault's entry went above, before the database was opened).
      await removeWrappedKey(e.store, args.user.id, false, args.onError);
    }
    if (args.password) await keepPasswordWrap(e, args.password, res, args.onError);
    engine = e;
    setArmedAccount(args.user.id);
    e.start();
    if (!e.readOnly) {
      lastWarmUpAt = e.now();
      void warmUp(e);
    }
    return { enabled: true, recovered: e.recovered, readOnly: e.readOnly };
  } catch (e) {
    args.onError?.(e);
    await teardown(false);
    return { enabled: false, reason: 'failed' };
  }
}

export interface CacheStartArgs {
  token?: string | null;
  probe?: () => Promise<boolean>;
  onError?: (e: unknown) => void;
}

export type CacheStartOutcome = { ok: true; snapshot: SessionSnapshot; userId: string } | { ok: false; reason: 'noBinding' | 'notApp' | 'noKey' | 'unreadable' | 'noSnapshot' | 'unsupported' };

async function doStartFromCache(args: CacheStartArgs): Promise<CacheStartOutcome> {
  installWindowListeners();
  if (!cryptoAvailable()) return { ok: false, reason: 'unsupported' };
  if (!isApp()) return { ok: false, reason: 'notApp' };
  const token = args.token ?? getToken();
  const binding = await matchingBinding(token);
  if (!binding || !token) return { ok: false, reason: 'noBinding' };
  if (engine && engine.userId !== binding.userId) await teardown(true);
  if (engine && engine.userId === binding.userId) {
    const snap = await loadSnapshot(engine.store, engine.keys);
    if (snap && !getServerInfo()) setServerInfo(serverInfoFromSnapshot(snap));
    return snap ? { ok: true, snapshot: snap, userId: binding.userId } : { ok: false, reason: 'noSnapshot' };
  }
  // Never CREATE the database here: an evicted one must still be missing when the connection returns,
  // so that `offline.start` recovers the native mirror instead of deleting it as orphans (section 5.4).
  const store = await openExistingAccountStore(binding.userId);
  if (!store) return { ok: false, reason: 'noKey' };
  let raw: Uint8Array | null;
  try {
    raw = await loadWrappedKey(store, binding.userId);
  } finally {
    store.close();
  }
  if (!raw) return { ok: false, reason: 'noKey' };
  const keys = await armKeys(raw, binding.userId);
  const e = await openEngine({ userId: binding.userId, keys, persistentCache: true, tokenTag: binding.tokenTag, probe: args.probe, onError: args.onError, rememberMe: true });
  if (e.readOnly) {
    e.stop();
    return { ok: false, reason: 'unreadable' };
  }
  const snapshot = await loadSnapshot(e.store, e.keys);
  if (!snapshot) {
    e.stop();
    return { ok: false, reason: 'noSnapshot' };
  }
  engine = e;
  setArmedAccount(binding.userId);
  // The server's self-description is what the snapshot kept: the facade needs `offlineSync`
  // (`isOfflineEnabled`), and on a cold offline start GET /api/server/info never answered. The
  // server's own answer replaces it on the next reconnect.
  if (!getServerInfo()) setServerInfo(serverInfoFromSnapshot(snapshot));
  e.connectivity.noteFailure();
  e.start();
  return { ok: true, snapshot, userId: binding.userId };
}

export const offline = {
  /** After a successful `me()` or login (section 4.1 / 5.1). */
  start(args: StartArgs): Promise<StartOutcome> {
    return serialised(() => doStart(args));
  },

  /** Offline start on an app (section 4.7 step 2). */
  startFromCache(args: CacheStartArgs = {}): Promise<CacheStartOutcome> {
    return serialised(() => doStartFromCache(args));
  },

  /** True while the engine is armed for the signed-in account. */
  isActive(): boolean {
    return engine !== null && isOfflineEnabled();
  },

  /** The account the engine is armed for. */
  activeUserId(): string | null {
    return engine?.userId ?? null;
  },

  /**
   * 401 (section 4.8): the cache, journal, id map, snapshot, wrapped key (and the vault's entry: on
   * the Mac the Keychain item is the key at rest) and binding go; the outbox, notes and mirror stay.
   * Also when no engine runs (a session revoked while the app was closed: the first `me()` answers
   * 401): the binding names the account whose data is at rest on this device.
   */
  onUnauthorized(): Promise<void> {
    return serialised(async () => {
      const binding = readBinding();
      clearBinding();
      const running = engine?.userId ?? null;
      await teardown(true);
      if (binding && binding.userId !== running) await purgeAccountAtRest(binding.userId).catch(() => false);
    });
  },

  /** Sign-out without deleting the outbox (the user chose "Stay signed in" is not this; this is the end of a session). */
  async stop(): Promise<void> {
    await teardown(false);
  },

  /** Deletes everything of an account on this device (logout with "Delete", account deletion). */
  async wipeAccount(userId: string): Promise<void> {
    if (engine && engine.userId === userId) await teardown(false);
    await wipeAccountData(userId);
    if (readBinding()?.userId === userId) clearBinding();
    await removeWrappedKey(null, userId, true);
  },

  /** Uploads what is waiting (online-only writes call it first). Resolves with what is left. */
  async drain(): Promise<{ remaining: number; attention: number }> {
    if (!engine || !isOfflineEnabled()) return { remaining: 0, attention: 0 };
    const e = engine;
    if (e.connectivity.dataOffline) await e.connectivity.probeNow('drain', true);
    await e.replayer.settle();
    await e.outbox.load();
    return { remaining: e.outbox.size, attention: e.notes.count };
  },

  /** "Try now": probe and replay. */
  async tryNow(): Promise<boolean> {
    if (!engine) return false;
    const ok = await engine.connectivity.probeNow('tryNow', true);
    await engine.replayer.tryNow();
    return ok;
  },

  notifyUnlocked(): void {
    engine?.replayer.notifyUnlocked();
  },

  /**
   * The server has just accepted `password` (the online lock screen, the 423 "enter your password to
   * upload" prompt, a password change - with the NEW password): the AOK is fetched again from the
   * server (`GET /api/sync/key`, the call every start makes; the key is never kept in memory after the
   * keys are derived) and wrapped under the password for the offline unlock. The wrap in hand is
   * dropped FIRST: when the new one cannot be made (the key fetch fails, the engine stops), the device
   * is left with no wrap rather than one under a password the user may just have changed because it
   * leaked (the offline unlock then needs the device check or the next server check). Resolves true
   * when a wrap under `password` was kept.
   */
  async refreshPasswordWrap(password: string): Promise<boolean> {
    const e = engine;
    if (!e || !isOfflineEnabled() || !password) return false;
    await e.forgetPasswordWrap();
    let res: SyncKeyResponse;
    try {
      res = await fetchSyncKey();
    } catch {
      return false;
    }
    if (engine !== e || e.isStopped) return false;
    await keepPasswordWrap(e, password, res);
    return (await e.loadPasswordWrap()) !== null;
  },

  /**
   * The lock screen without a connection: checks the password on this device (./password-wrap.ts).
   * 'unavailable' when no engine runs or no wrap exists on this device; see `PasswordUnlockResult`.
   */
  async unlockWithPassword(password: string): Promise<PasswordUnlockResult> {
    if (!engine || !isOfflineEnabled()) return { outcome: 'unavailable', waitSeconds: 0 };
    return engine.unlockWithPassword(password);
  },

  /** True when a password wrap exists for the armed account (memory or at rest): the lock screen shows its note. */
  async canUnlockWithPassword(): Promise<boolean> {
    if (!engine || !isOfflineEnabled()) return false;
    return (await engine.loadPasswordWrap()) !== null;
  },

  /** Keeps the session snapshot current (apps with "Remember me"); cheap when nothing changed. */
  async updateSession(patch: { locked?: boolean; lastActivityAt?: number }): Promise<void> {
    if (!engine || !engine.cache.persistent) return;
    const snap = await loadSnapshot(engine.store, engine.keys);
    if (!snap) return;
    const next = { ...snap, ...patch };
    if (next.locked === snap.locked && next.lastActivityAt === snap.lastActivityAt) return;
    await saveSnapshot(engine.store, engine.keys, next).catch(() => undefined);
  },

  /** The waiting operations (the review list). */
  pending(): PendingItem[] {
    return engine?.replayer.pendingItems() ?? [];
  },

  notes: {
    list(): SyncNote[] {
      return engine?.notes.list() ?? [];
    },
    async dismiss(id: number): Promise<void> {
      if (!engine) return;
      await engine.notes.remove(id);
      engine.publishCounts();
    },
  },

  /** The server id behind a page id (itself when positive), or null while not uploaded. */
  serverIdOf(id: number): number | null {
    return engine?.idmap.serverIdOf(id) ?? (id > 0 ? id : null);
  },

  /** True when a pending operation exists for the record the page shows. */
  hasPending(kind: 'entry' | 'habit', id: number): boolean {
    if (!engine) return false;
    const key = engine.idmap.recordKey(kind, id);
    return !!key && engine.outbox.rows.some((l) => l.q.record === key || (kind === 'habit' && l.q.chain.startsWith(`log:${key}:`)));
  },

  /**
   * Outboxes of OTHER accounts on this device (section 4.7 / 4.8 "Changes written by another account
   * ... are waiting"): user ids with waiting operations, never their contents. Needs `indexedDB.databases()`.
   */
  async otherAccountsWithPending(exceptUserId: string | null): Promise<{ userId: string; count: number }[]> {
    const factory = idbFactory();
    if (!factory || typeof factory.databases !== 'function') return [];
    let names: string[] = [];
    try {
      names = (await factory.databases()).map((d) => d.name ?? '').filter((n) => n.startsWith(DB_PREFIX));
    } catch {
      return [];
    }
    const out: { userId: string; count: number }[] = [];
    for (const name of names) {
      const userId = name.slice(DB_PREFIX.length);
      if (!userId || userId === exceptUserId || name !== accountDbName(userId)) continue;
      try {
        const store = await openExistingAccountStore(userId);
        if (!store) continue;
        let count = 0;
        try {
          count = await store.tx(['outbox'], 'readonly', (t) => t.count('outbox'));
        } finally {
          store.close();
        }
        if (count > 0) out.push({ userId, count });
      } catch {
        /* unreadable: skipped */
      }
    }
    return out;
  },

  /** The status store (also exported directly). */
  status: getSyncStatus,
  subscribe: subscribeSyncStatus,

  /** Tests: the engine instance. */
  __engineForTests(): OfflineEngine | null {
    return engine;
  },

  /** Tests: forget everything in memory (the databases stay). */
  async __resetForTests(): Promise<void> {
    await teardown(false);
    lastWarmUpAt = 0;
    __resetSyncStatusForTests();
    patchSyncStatus({ dataVersion: 0 });
  },
};

installWindowListeners();

export default offline;
