/**
 * The desktop app's platform seams (section 7, "Tauri command contract"): DPAPI for the account
 * offline key, the outbox mirror under the app's local data folder and Windows Hello for the offline
 * unlock - all through Tauri commands WP-H10d implements in src-tauri/src/offline.rs. `invoke` is
 * imported lazily, as src/api/client.ts does, so the browser bundle never touches the Tauri API.
 *
 * The Mac app (docs/APPLE-PLAN.md WP-M2/M3) uses the same commands; there the key lives in the
 * Keychain (src-tauri/src/platform/macos.rs), the blob is only the marker of that item, and the
 * vault is `tauriKeychainVault`: kind 'keychain', and `remove()` deletes the item through
 * `offline_key_remove`. Which one is installed is decided by `isMacApp()` of src/offline/session.ts
 * (the Tauri shell's global plus WKWebView's user agent; it lives there, not here, because no module
 * but src/main.tsx may import this one); on Windows everything is as before: kind 'dpapi', `remove()`
 * does nothing. src/main.tsx installs the seams (`installTauriOfflinePlatform()`) under Tauri before
 * the first render, through a dynamic import, so the web UI served from the same dist/ never loads
 * this module.
 *
 * | command                        | arguments            | returns                                     |
 * | offline_key_protect            | { userId, keyB64 }   | blobB64                                     |
 * | offline_key_unprotect          | { userId, blobB64 }  | keyB64                                      |
 * | offline_key_remove             | { userId }           | -  (the Mac only)                           |
 * | offline_mirror_put             | { userId, name, dataB64 } | -                                      |
 * | offline_mirror_list            | { userId }           | string[]                                    |
 * | offline_mirror_read            | { userId, name }     | dataB64                                     |
 * | offline_mirror_delete          | { userId, name }     | -                                           |
 * | offline_mirror_clear           | { userId }           | -                                           |
 * | offline_user_check_available   | -                    | bool                                        |
 * | offline_user_check             | { message }          | "ok" | "cancelled" | "failed" | "unavailable" |
 *
 * `userId` must match `^u_[0-9a-f]{16}$` and `name` `^[0-9]+-[0-9a-f-]{36}\.(op|note)$`; anything else
 * is refused here already, so no path is ever built from unchecked input.
 */
import { fromBase64, toBase64 } from '../crypto';
import { MIRROR_NAME_RE } from '../mirror';
import { setOfflinePlatform, type DeviceUserCheck, type OfflineKeyVault, type OutboxMirror } from '../seams';
import { isMacApp } from '../session';

export const USER_ID_RE = /^u_[0-9a-f]{16}$/;

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let invokeOverride: Invoke | null = null;

/** Tests: a stand-in for `@tauri-apps/api/core` `invoke`. */
export function __setInvokeForTests(fn: Invoke | null): void {
  invokeOverride = fn;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (invokeOverride) return invokeOverride<T>(cmd, args);
  const core = await import('@tauri-apps/api/core');
  return core.invoke<T>(cmd, args);
}

export function checkUserId(userId: string): string {
  if (!USER_ID_RE.test(userId)) throw new Error('offline: invalid user id');
  return userId;
}

export function checkName(name: string): string {
  if (!MIRROR_NAME_RE.test(name)) throw new Error('offline: invalid mirror file name');
  return name;
}

export const tauriKeyVault: OfflineKeyVault = {
  kind: 'dpapi',
  async wrap(userId, key) {
    return invoke<string>('offline_key_protect', { userId: checkUserId(userId), keyB64: toBase64(key) });
  },
  async unwrap(userId, blob) {
    return fromBase64(await invoke<string>('offline_key_unprotect', { userId: checkUserId(userId), blobB64: blob }));
  },
  async remove() {
    // DPAPI blobs live only in IndexedDB (section 5.5): nothing to remove on the Windows side.
  },
};

/**
 * The Mac app's vault: the same wrap / unwrap commands (the shell keeps the key in the Keychain and
 * answers the marker of the item), and `remove()` deletes the Keychain item (a full wipe, section 5.5).
 */
export const tauriKeychainVault: OfflineKeyVault = {
  kind: 'keychain',
  wrap: tauriKeyVault.wrap,
  unwrap: tauriKeyVault.unwrap,
  async remove(userId) {
    await invoke<void>('offline_key_remove', { userId: checkUserId(userId) });
  },
};

export const tauriMirror: OutboxMirror = {
  async put(userId, name, bytes) {
    await invoke<void>('offline_mirror_put', { userId: checkUserId(userId), name: checkName(name), dataB64: toBase64(bytes) });
  },
  async list(userId) {
    const names = await invoke<string[]>('offline_mirror_list', { userId: checkUserId(userId) });
    return Array.isArray(names) ? names.filter((n) => typeof n === 'string' && MIRROR_NAME_RE.test(n)) : [];
  },
  async read(userId, name) {
    return fromBase64(await invoke<string>('offline_mirror_read', { userId: checkUserId(userId), name: checkName(name) }));
  },
  async remove(userId, name) {
    await invoke<void>('offline_mirror_delete', { userId: checkUserId(userId), name: checkName(name) });
  },
  async clear(userId) {
    await invoke<void>('offline_mirror_clear', { userId: checkUserId(userId) });
  },
};

export const tauriUserCheck: DeviceUserCheck = {
  async available() {
    try {
      return (await invoke<boolean>('offline_user_check_available')) === true;
    } catch {
      return false;
    }
  },
  async verify(reason) {
    try {
      const result = await invoke<string>('offline_user_check', { message: reason });
      return result === 'ok' || result === 'cancelled' || result === 'failed' ? result : 'unavailable';
    } catch {
      return 'unavailable';
    }
  },
};

/**
 * Installs the three seams (src/main.tsx calls it once, under Tauri, before the first render): in the
 * Mac app (`isMacApp()`) with the Keychain vault, everywhere else with the DPAPI one. It takes no parameters on purpose:
 * `installTauriOfflinePlatform()` is the one call shape, so nothing a caller passes by accident (a
 * promise's resolved value, a module namespace) can pick the vault; the tests stub `navigator.userAgent`
 * and the shell's global instead.
 */
export function installTauriOfflinePlatform(): void {
  const keyVault = isMacApp() ? tauriKeychainVault : tauriKeyVault;
  setOfflinePlatform({ keyVault, mirror: tauriMirror, userCheck: tauriUserCheck });
}
