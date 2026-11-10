/**
 * Device A of the offline e2e test: the Android app (Capacitor WebView, `__MOBILE__` build) with the
 * REAL client code - src/api (the facade included) and src/offline - on its own IndexedDB
 * (fake-indexeddb: one factory per device), its own fake platform seams (./fake-seams.ts) and the
 * switchable transport (./transport.ts). The page's `localStorage` / `sessionStorage` (the token, the
 * offline binding) are jsdom's.
 *
 * What the app shell does around the engine (WP-H10c: the AuthProvider, the ConnectionProvider) is
 * done here by hand, in the same order: sign in -> token -> server info -> `offline.start`; at start
 * with a token and no connection -> `offline.startFromCache` (the app is shown from the snapshot).
 *
 * "Restart" = the app process ends and starts again: the engine stops (nothing is purged), every
 * in-memory store of the client is reset, and a NEW engine opens on the same IndexedDB, storage and
 * seams. "Evict" = the WebView's storage is gone (IndexedDB and the page storage); the native mirror
 * folder and the Keystore survive.
 *
 * The engine keeps module state (one armed engine per page), so ONE device runs the engine at a
 * time; device B (./peer.ts) is a plain HTTP client of the same account.
 */
import { IDBFactory } from 'fake-indexeddb';
import type { AuthResponse, ServerInfo, UserProfile } from '@shared/types';
import { auth, server as serverApi } from '@/api';
import { __setApiBaseForTests, clearToken, getToken, setApiTransport, setToken } from '@/api/client';
import { __resetConnectionForTests, setServerInfo } from '@/api/connection';
import { __resetLocaleForTests } from '@/i18n/runtime';
import { offline, type CacheStartOutcome, type StartOutcome } from '@/offline';
import type { OfflineEngine } from '@/offline/engine';
import { __resetOfflinePlatformForTests, setOfflinePlatform } from '@/offline/seams';
import { accountDbName, openAccountStore, setIdbFactory } from '@/offline/store/idb';
import { e2eKeyVault, e2eMirror, e2eUserCheck, type E2eKeyVault, type E2eMirror, type E2eUserCheck } from './fake-seams';
import { SwitchableTransport } from './transport';

/** Node's Web Crypto as the page's `crypto` (jsdom's has no `subtle`). */
export async function installWebCrypto(): Promise<void> {
  const g = globalThis as { crypto?: Crypto };
  if (g.crypto && typeof g.crypto.subtle?.digest === 'function' && typeof g.crypto.randomUUID === 'function') return;
  const { webcrypto } = await import('node:crypto');
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true, writable: true });
}

interface CapacitorWindow {
  Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
}

export interface SignedIn {
  auth: AuthResponse;
  outcome: StartOutcome;
}

export class Device {
  readonly idb = new IDBFactory();
  readonly keyVault: E2eKeyVault = e2eKeyVault('keystore');
  readonly mirror: E2eMirror = e2eMirror();
  readonly userCheck: E2eUserCheck = e2eUserCheck();
  readonly transport: SwitchableTransport;
  user: UserProfile | null = null;
  /** Errors the engine reported through `onError` (kept for the test to look at). */
  readonly engineErrors: unknown[] = [];

  constructor(
    readonly name: string,
    private readonly base: () => string,
    realFetch: typeof fetch,
  ) {
    this.transport = new SwitchableTransport(realFetch);
  }

  /** Installs this device in the page: the Android app, its server, its transport, its IndexedDB and its seams. */
  wire(): void {
    (globalThis as CapacitorWindow).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
    __resetLocaleForTests();
    __setApiBaseForTests(this.base());
    setApiTransport(this.transport.fetch);
    setIdbFactory(this.idb);
    __resetOfflinePlatformForTests();
    setOfflinePlatform({ keyVault: this.keyVault, mirror: this.mirror, userCheck: this.userCheck });
  }

  get engine(): OfflineEngine {
    const e = offline.__engineForTests();
    if (!e) throw new Error(`${this.name}: no offline engine`);
    return e;
  }

  private startArgs(user: UserProfile, rememberMe: boolean, token: string, info: ServerInfo | null) {
    return { user, rememberMe, token, serverInfo: info, onError: (e: unknown) => this.engineErrors.push(e) };
  }

  /** What the AuthProvider does after a successful login / register / me(): server info, then the engine. */
  async afterSignIn(res: AuthResponse): Promise<StartOutcome> {
    setToken(res.token, res.rememberMe);
    this.user = res.user;
    const info = await serverApi.info();
    setServerInfo(info);
    return offline.start(this.startArgs(res.user, res.rememberMe, res.token, info));
  }

  async register(user: { firstName: string; lastName: string; username: string; email: string }, password: string, rememberMe = true): Promise<SignedIn> {
    // privacyAccepted + termsAccepted: the ticked consent checkbox of the registration form (the hosted server requires both).
    const res = await auth.register({ ...user, password, confirmPassword: password, rememberMe, deviceName: this.name, privacyAccepted: true, termsAccepted: true });
    return { auth: res, outcome: await this.afterSignIn(res) };
  }

  async signIn(username: string, password: string, rememberMe = true): Promise<SignedIn> {
    const res = await auth.login({ username, password, rememberMe, deviceName: this.name });
    return { auth: res, outcome: await this.afterSignIn(res) };
  }

  /** `me()` succeeded again (a reconnect of a cache session): the AuthProvider re-runs `offline.start`. */
  async meAgain(): Promise<StartOutcome> {
    const token = getToken();
    if (!token || !this.user) throw new Error(`${this.name}: not signed in`);
    const me = await auth.me();
    const info = await serverApi.info();
    setServerInfo(info);
    return offline.start(this.startArgs(me.user, me.session.rememberMe, token, info));
  }

  /**
   * "Sign out" with nothing waiting (section 4.8, first row): the outbox is drained first; the server
   * session ends and everything of the account on this device is deleted (`offline.wipeAccount`).
   * With changes left the app would show the dialog instead - the test never signs out then.
   */
  async signOut(): Promise<void> {
    const userId = this.user?.id ?? offline.activeUserId();
    const left = await offline.drain();
    if (left.remaining || left.attention) throw new Error(`${this.name}: ${left.remaining} changes waiting, ${left.attention} notes - the logout dialog would ask`);
    await auth.logout().catch(() => undefined);
    clearToken();
    if (userId) await offline.wipeAccount(userId);
    this.user = null;
  }

  /** The app closes: the engine stops, every in-memory store of the client starts over; storage stays. */
  async close(): Promise<void> {
    await offline.__resetForTests();
    __resetConnectionForTests();
  }

  /**
   * The app opens again without a connection: the first me() failed, so the AuthProvider asks for a
   * cache start. `token` is the one the app holds at that moment (by default the one in storage; a
   * test passes the token of a session the server has since signed out to show it opens nothing).
   */
  async reopenFromCache(token: string | null = getToken()): Promise<CacheStartOutcome> {
    await this.close();
    this.wire();
    // The AuthProvider shows the app from the snapshot; the engine itself puts the snapshot's server
    // description into the connection store (the facade needs `offlineSync`, GET /api/server/info never answered).
    const started = await offline.startFromCache({ token, onError: (e) => this.engineErrors.push(e) });
    if (started.ok) this.user = started.snapshot.user;
    return started;
  }

  /** The WebView's storage is evicted while the app is closed (IndexedDB and the page storage go; the native mirror and the Keystore stay). */
  async evict(userId: string): Promise<void> {
    await this.close();
    await new Promise<void>((resolve, reject) => {
      const req = this.idb.deleteDatabase(accountDbName(userId));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    clearToken();
    window.localStorage.clear();
    window.sessionStorage.clear();
    this.user = null;
  }

  /** The names of the offline databases on this device. */
  async databases(): Promise<string[]> {
    return (await this.idb.databases()).map((d) => d.name ?? '').sort();
  }

  /**
   * The rows of an account's database exactly as stored (the engine is bypassed; only counts and the
   * ciphertext - the test cannot read the contents either). Do not call it for a database that must
   * stay absent (it would create an empty one).
   */
  async storedRows(userId: string): Promise<{ outbox: string[]; notes: number; cache: number; journal: number; idmap: number; wrappedKey: boolean; snapshot: boolean }> {
    setIdbFactory(this.idb);
    const { store } = await openAccountStore(userId);
    try {
      return await store.tx(['outbox', 'notes', 'cache', 'journal', 'idmap', 'meta'], 'readonly', async (t) => ({
        outbox: (await t.getAll('outbox')).map((r) => `${r.seq}|${r.rid}|${r.sealed}|${r.chainTag}|${[...r.ct].join(',')}`),
        notes: await t.count('notes'),
        cache: await t.count('cache'),
        journal: await t.count('journal'),
        idmap: await t.count('idmap'),
        wrappedKey: !!(await t.get('meta', 'wrappedKey')),
        snapshot: !!(await t.get('meta', 'snapshot')),
      }));
    } finally {
      store.close();
    }
  }
}

/** Waits until `pred` holds (polling with real timers), or fails after `ms` with `what`. */
export async function waitUntil(what: string, pred: () => boolean | Promise<boolean>, ms = 10_000, step = 20): Promise<void> {
  const start = Date.now();
  while (!(await pred())) {
    if (Date.now() - start > ms) throw new Error(`timed out after ${ms} ms waiting for: ${what}`);
    await new Promise((r) => setTimeout(r, step));
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
