/**
 * Test environment of the offline engine (section 8, WP-H10b "Tests"): jsdom plus `fake-indexeddb`
 * (one factory per simulated device) plus Node's `webcrypto` where jsdom has no `crypto.subtle`. Only
 * the engine's own test files import this; nothing here is shipped.
 */
import { IDBFactory } from 'fake-indexeddb';
import { __setApiBaseForTests, setApiTransport, setToken } from '@/api/client';
import { __resetConnectionForTests, setServerInfo } from '@/api/connection';
import { deriveKeys, type DerivedKeys } from '../crypto';
import { __resetOfflinePlatformForTests, setOfflinePlatform, type DeviceUserCheck, type OfflineKeyVault, type OutboxMirror } from '../seams';
import { setIdbFactory } from '../store/idb';
import { offline } from '../index';
import { fakeServerInfo, fakeUser, FakeSyncServer, type FakeAccount } from './fake-sync-server';

export const DANA = 'u_0123456789abcdef';
export const LIOR = 'u_fedcba9876543210';

/** Node's Web Crypto, reached without Node's type definitions (the root tsconfig has none): `process.getBuiltinModule`. */
function nodeWebCrypto(): Crypto | null {
  const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => { webcrypto?: Crypto } | undefined } }).process;
  return proc?.getBuiltinModule?.('node:crypto')?.webcrypto ?? null;
}

/** Node's Web Crypto as the page's `crypto` (jsdom has `getRandomValues` but no `subtle`). */
export function installWebCrypto(): void {
  const g = globalThis as { crypto?: Crypto };
  if (g.crypto && typeof g.crypto.subtle?.digest === 'function') return;
  const webcrypto = nodeWebCrypto();
  if (!webcrypto) throw new Error('test env: Node Web Crypto is not reachable');
  try {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true, writable: true });
  } catch {
    Object.defineProperty(g.crypto, 'subtle', { value: webcrypto.subtle, configurable: true });
  }
}

/** A fresh IndexedDB for one simulated device; installs it as the engine's factory. */
export function freshIndexedDb(): IDBFactory {
  const factory = new IDBFactory();
  setIdbFactory(factory);
  return factory;
}

/**
 * An IndexedDB whose databases cannot be opened (a corrupt or over-quota WebView profile): `open`
 * throws, or answers a request that fails - never "missing" - so `openExistingAccountStore` REJECTS
 * (it resolves null only for a database that does not exist) and `openAccountStore` rejects too.
 * `databases()` lists nothing. Installs nothing: the test passes it to `setIdbFactory`.
 */
export function brokenIndexedDb(how: 'throws' | 'fails' = 'fails'): IDBFactory {
  const failure = () => new DOMException('The database could not be opened', 'UnknownError');
  const failingRequest = (): IDBOpenDBRequest => {
    const req = { error: failure(), onerror: null as ((ev: Event) => unknown) | null, onsuccess: null, onupgradeneeded: null, onblocked: null };
    setTimeout(() => req.onerror?.(new Event('error')), 0);
    return req as unknown as IDBOpenDBRequest;
  };
  const factory = {
    open: () => {
      if (how === 'throws') throw failure();
      return failingRequest();
    },
    deleteDatabase: () => failingRequest(),
    databases: async () => [],
    cmp: () => 0,
  };
  return factory as unknown as IDBFactory;
}

/** Keys of an account from a fixed 32-byte AOK (`seed` tells accounts / devices apart). */
export function testKeys(userId: string = DANA, seed = 1): Promise<DerivedKeys> {
  return deriveKeys(new Uint8Array(32).fill(seed), userId);
}

export interface FakeMirror extends OutboxMirror {
  files: Map<string, Map<string, Uint8Array>>;
  calls: string[];
}

/** An in-memory `OutboxMirror` (the apps' native folder). */
export function fakeMirror(): FakeMirror {
  const files = new Map<string, Map<string, Uint8Array>>();
  const dir = (userId: string) => {
    let d = files.get(userId);
    if (!d) {
      d = new Map();
      files.set(userId, d);
    }
    return d;
  };
  const calls: string[] = [];
  return {
    files,
    calls,
    async put(userId, name, bytes) {
      calls.push(`put ${name}`);
      dir(userId).set(name, new Uint8Array(bytes));
    },
    async list(userId) {
      return [...dir(userId).keys()];
    },
    async read(userId, name) {
      const b = dir(userId).get(name);
      if (!b) throw new Error('no such file');
      return b;
    },
    async remove(userId, name) {
      calls.push(`remove ${name}`);
      dir(userId).delete(name);
    },
    async clear(userId) {
      calls.push('clear');
      files.delete(userId);
    },
  };
}

export interface FakeKeyVault extends OfflineKeyVault {
  /** The accounts whose key the vault holds (like the Mac's Keychain items or Android's alias shares). */
  blobs: Map<string, string>;
  /** Every `remove(userId)` the engine asked for, in order (also for accounts the vault did not hold). */
  removed: string[];
}

/**
 * An in-memory `OfflineKeyVault` ("wrapping" = a reversible encoding; only the plumbing is under test).
 * Like the Mac's Keychain vault, it keeps the key itself: `blobs` holds the account until `remove()`.
 */
export function fakeKeyVault(kind: OfflineKeyVault['kind'] = 'keystore'): FakeKeyVault {
  const blobs = new Map<string, string>();
  const removed: string[] = [];
  return {
    kind,
    blobs,
    removed,
    async wrap(userId, key) {
      const blob = `${kind}:${userId}:${btoa(String.fromCharCode(...key))}`;
      blobs.set(userId, blob);
      return blob;
    },
    async unwrap(userId, blob) {
      const prefix = `${kind}:${userId}:`;
      if (!blob.startsWith(prefix)) throw new Error('wrong user');
      const s = atob(blob.slice(prefix.length));
      return Uint8Array.from(s, (c) => c.charCodeAt(0));
    },
    async remove(userId) {
      removed.push(userId);
      blobs.delete(userId);
    },
  };
}

export function fakeUserCheck(answer: Awaited<ReturnType<DeviceUserCheck['verify']>> = 'ok'): DeviceUserCheck {
  return { available: async () => answer !== 'unavailable', verify: async () => answer };
}

export interface DeviceOptions {
  server: FakeSyncServer;
  userId?: string;
  token?: string;
  rememberMe?: boolean;
  /** Pretend to be the Windows app (`__TAURI_INTERNALS__`). */
  app?: boolean;
  mirror?: OutboxMirror;
  keyVault?: OfflineKeyVault;
  /** The IndexedDB of this device (a new one when omitted). */
  idb?: IDBFactory;
  probe?: () => Promise<boolean>;
}

/**
 * Wires the real api client to the fake server as one device would see it: api base '', the
 * server's transport, the hosted server info, the token in storage, the seams, the IndexedDB.
 */
export function wireDevice(opts: DeviceOptions): { idb: IDBFactory; account: FakeAccount } {
  const userId = opts.userId ?? DANA;
  const token = opts.token ?? `tok-${userId}`;
  const account: FakeAccount = { userId, token, user: fakeUser(userId, userId === DANA ? 'dana' : 'lior'), rememberMe: opts.rememberMe };
  opts.server.addAccount(account);
  const idb = opts.idb ?? freshIndexedDb();
  setIdbFactory(idb);
  __resetConnectionForTests();
  __setApiBaseForTests('');
  setApiTransport(opts.server.transport());
  setServerInfo(fakeServerInfo(opts.server.offlineSyncFlag ? {} : { offlineSync: undefined }));
  setToken(token, !!opts.rememberMe);
  const w = window as unknown as Record<string, unknown>;
  if (opts.app) w.__TAURI_INTERNALS__ = {};
  else delete w.__TAURI_INTERNALS__;
  __resetOfflinePlatformForTests();
  setOfflinePlatform({ keyVault: opts.keyVault, mirror: opts.mirror });
  return { idb, account };
}

/** `wireDevice` plus `offline.start` for that account. */
export async function bootDevice(opts: DeviceOptions) {
  const wired = wireDevice(opts);
  const outcome = await offline.start({ user: wired.account.user, rememberMe: !!opts.rememberMe, token: wired.account.token, probe: opts.probe });
  if (!outcome.enabled) throw new Error(`offline did not start: ${outcome.reason}`);
  const engine = offline.__engineForTests();
  if (!engine) throw new Error('no engine');
  return { ...wired, engine, outcome };
}

/** Everything back to a fresh start (between tests). */
export async function resetOfflineTestEnv(): Promise<void> {
  await offline.__resetForTests();
  setApiTransport(null);
  __setApiBaseForTests(null);
  __resetConnectionForTests();
  __resetOfflinePlatformForTests();
  setIdbFactory(null);
  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
}

/** Waits until `pred` holds (polling), or fails after `ms`. Real timers. */
export async function waitFor(pred: () => boolean, ms = 4000, step = 10): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > ms) throw new Error('waitFor: condition not met in time');
    await new Promise((r) => setTimeout(r, step));
  }
}

/** `waitFor` with an async predicate. */
export async function waitForAsync(pred: () => Promise<boolean>, ms = 4000, step = 10): Promise<void> {
  const start = Date.now();
  while (!(await pred())) {
    if (Date.now() - start > ms) throw new Error('waitForAsync: condition not met in time');
    await new Promise((r) => setTimeout(r, step));
  }
}

/** Lets pending promises and the fake server's microtasks settle. */
export async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await new Promise((r) => setTimeout(r, 0));
}
