/**
 * `DiaryOffline` - the Android half of the automatic offline mode (docs/android-tasks/OFFLINE-DESIGN.md
 * sections 5.1 and 5.7, WP-H10d). Java: android/app/src/main/java/com/mydiary/app/plugins/DiaryOfflinePlugin.java
 * (registered in MainActivity). The seams of the engine built on it: mobile/platform/offline.ts.
 *
 *  - `wrapKey` / `unwrapKey` / `deleteKey`: the account offline key (AOK, 32 bytes the server keeps in
 *    the encrypted diary) wrapped with AES-256-GCM by one non-exportable Android Keystore key, alias
 *    `com.mydiary.app.offline.v1`, with NO user-authentication binding (it must work at app start).
 *    The account id is the GCM additional data, so a blob never unwraps for another account. The
 *    blob itself is stored by the engine (IndexedDB `meta`), not by the plugin.
 *  - `canVerifyUser` / `verifyUser`: the phone's own user check for the offline unlock - the screen
 *    lock (PIN, pattern, password) or a strong biometric; `KeyguardManager.isDeviceSecure()` decides
 *    whether it is available. The answer only lifts the local lock overlay; nothing derived from the
 *    password is stored anywhere.
 *
 * Keys cross the bridge as standard base64. Errors carry one of the `DIARY_OFFLINE_ERROR` codes.
 */
import { registerPlugin } from '@capacitor/core';

/** The answer of the user check (the `DeviceUserCheck` seam's words). */
export type DeviceCheckResult = 'ok' | 'cancelled' | 'failed' | 'unavailable';

/** The `code` of a rejected call (DiaryOfflinePlugin.java `ERR_*`). */
export const DIARY_OFFLINE_ERROR = {
  /** A user id that is not `^u_[0-9a-f]{16}$`, or a key / blob that is not valid base64 of a sane size. */
  invalidInput: 'INVALID_INPUT',
  /** The Keystore key is gone (app data cleared, the last account's key deleted): the blob is useless. */
  keyMissing: 'KEY_MISSING',
  /** The blob does not unwrap: another account's, damaged, or wrapped by an earlier device key. */
  unwrapFailed: 'UNWRAP_FAILED',
  /** Any other Keystore failure. */
  keystore: 'KEYSTORE_ERROR',
} as const;

export type DiaryOfflineErrorCode = (typeof DIARY_OFFLINE_ERROR)[keyof typeof DIARY_OFFLINE_ERROR];

export interface DiaryOfflinePlugin {
  /** Wraps `key` (base64) for the account: the blob (base64) the engine stores. */
  wrapKey(options: { userId: string; key: string }): Promise<{ blob: string }>;
  /** Unwraps a blob of `wrapKey` for the same account: the key (base64). */
  unwrapKey(options: { userId: string; blob: string }): Promise<{ key: string }>;
  /** The account holds no blob any more; the Keystore key is deleted together with the last account's. */
  deleteKey(options: { userId: string }): Promise<void>;
  /** Without any UI: whether the phone has a screen lock the user check can ask for. */
  canVerifyUser(): Promise<{ available: boolean }>;
  /** Shows the system's user check (prompt title and an optional subtitle) and reports what happened. */
  verifyUser(options: { title: string; subtitle?: string }): Promise<{ result: DeviceCheckResult }>;
}

export const DiaryOffline = registerPlugin<DiaryOfflinePlugin>('DiaryOffline');
