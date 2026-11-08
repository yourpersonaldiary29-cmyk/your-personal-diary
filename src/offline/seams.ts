/**
 * Platform seams of the offline engine (docs/android-tasks/OFFLINE-DESIGN.md section 7, frozen in
 * WP-H10b's first step). The engine in src/offline/** is one implementation for Windows, Android and
 * the web; what differs per platform is plugged in here by the platform code:
 *
 *  - `OfflineKeyVault`: wraps the account offline key (AOK) at rest - DPAPI on Windows and the
 *    Keychain on macOS (src/offline/native/tauri.ts; on the Mac the blob is only the marker of the
 *    Keychain item, and `remove()` deletes the item), the Android Keystore (mobile/platform/offline.ts).
 *    Absent on the web: the AOK then lives in memory only.
 *  - `OutboxMirror`: a copy of every outbox / notes record outside IndexedDB, so that an evicted
 *    database can be recovered (section 5.4). Absent on the web.
 *  - `DeviceUserCheck`: the operating system's own user check (Windows Hello, Touch ID or the Mac's
 *    account password, the phone's screen lock) for offline unlock (section 5.7). Absent on the web.
 *  - `notifyResume()`: the platform says "the app came back to the foreground" (Capacitor
 *    `appStateChange` with `isActive`); the connectivity monitor probes at once.
 *
 * This module is plain data and side-effect free: the platform code (mobile/platform/index.ts, the
 * Tauri adapter) imports it without pulling the engine in.
 */

export interface OfflineKeyVault {
  /** Which vault wrapped a blob (kept next to it in `meta.wrappedBy`): a blob of another vault is useless. */
  readonly kind: 'dpapi' | 'keystore' | 'keychain';
  wrap(userId: string, key: Uint8Array): Promise<string>;
  unwrap(userId: string, blob: string): Promise<Uint8Array>;
  remove(userId: string): Promise<void>;
}

export interface OutboxMirror {
  put(userId: string, name: string, bytes: Uint8Array): Promise<void>;
  list(userId: string): Promise<string[]>;
  read(userId: string, name: string): Promise<Uint8Array>;
  remove(userId: string, name: string): Promise<void>;
  clear(userId: string): Promise<void>;
}

export interface DeviceUserCheck {
  available(): Promise<boolean>;
  verify(reason: string): Promise<'ok' | 'cancelled' | 'failed' | 'unavailable'>;
}

/** What the platform plugged in (each part optional: the web has none). */
export interface OfflinePlatform {
  keyVault?: OfflineKeyVault;
  mirror?: OutboxMirror;
  userCheck?: DeviceUserCheck;
}

let platform: OfflinePlatform = {};
const resumeListeners = new Set<() => void>();

/**
 * Installs the platform's seams. Parts that are passed replace the current ones; parts left out
 * stay as they were (a part passed as `undefined` explicitly is removed).
 */
export function setOfflinePlatform(p: { keyVault?: OfflineKeyVault; mirror?: OutboxMirror; userCheck?: DeviceUserCheck }): void {
  const next: OfflinePlatform = { ...platform };
  if ('keyVault' in p) next.keyVault = p.keyVault;
  if ('mirror' in p) next.mirror = p.mirror;
  if ('userCheck' in p) next.userCheck = p.userCheck;
  platform = next;
}

/** The seams installed so far (the engine reads them at use time, never caches them). */
export function getOfflinePlatform(): Readonly<OfflinePlatform> {
  return platform;
}

/** The platform: the app came back to the foreground (the connectivity monitor probes at once). */
export function notifyResume(): void {
  for (const listener of [...resumeListeners]) {
    try {
      listener();
    } catch {
      /* a listener's failure never reaches the platform code */
    }
  }
}

/** The engine: subscribes to `notifyResume`; returns the unsubscribe function. */
export function onResume(listener: () => void): () => void {
  resumeListeners.add(listener);
  return () => {
    resumeListeners.delete(listener);
  };
}

/** Tests only: no seams, no listeners. */
export function __resetOfflinePlatformForTests(): void {
  platform = {};
  resumeListeners.clear();
}
