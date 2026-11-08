/**
 * The account offline key (AOK) on the device (section 5.1): fetched from the server after every
 * successful `me()` or login (`GET /api/sync/key`, 10 s timeout), held as raw bytes only long enough
 * to derive the encryption and MAC keys, then zeroed. On the apps with "Remember me" it is also kept
 * at rest through the platform's key vault (the `OfflineKeyVault` seam: DPAPI on Windows, the
 * Keychain on the Mac, the Keystore on Android): the vault's blob goes to `meta.wrappedKey`, so that
 * the app can open from the cache without a connection. Everywhere else it lives in memory only.
 *
 * On Windows and Android the blob IS the key at rest (wrapped); on the Mac it is only the marker of
 * the Keychain item that holds the key (src/offline/native/tauri.ts, docs/APPLE-PLAN.md WP-M2). So
 * whenever the engine drops the wrapped key - a 401, another account signing in, a start without
 * "Remember me", a full wipe - it also asks the vault to forget the account (`removeVaultKey`, best
 * effort, never blocking the purge): Windows has nothing to remove, Android drops the account's share
 * of the Keystore alias, the Mac deletes the Keychain item.
 *
 * `meta.keyCheck` is the encryption of a fixed text: when it does not decrypt with the keys in hand,
 * the data on the device was written with another key and the engine never writes (section 5.2).
 */
import type { SyncKeyResponse } from '@shared/sync';
import { request } from '@/api/client';
import { deriveKeys, fromBase64, makeKeyCheck, verifyKeyCheck, zero, type DerivedKeys } from './crypto';
import { getOfflinePlatform, type OfflineKeyVault } from './seams';
import type { OfflineStore } from './store/types';

export const KEY_FETCH_TIMEOUT_MS = 10_000;

/** `meta` row names of the engine (section 5.3). */
export const META = {
  wrappedKey: 'wrappedKey',
  keyCheck: 'keyCheck',
  snapshot: 'snapshot',
  nextLocalId: 'nextLocalId',
  clockOffset: 'clockOffset',
  epoch: 'epoch',
  persistGranted: 'persistGranted',
  /** The kind of vault that wrapped `wrappedKey` ('dpapi' / 'keystore' / 'keychain'): a blob of another vault is useless. */
  wrappedBy: 'wrappedBy',
  /**
   * The AOK wrapped under the account PASSWORD (src/offline/password-wrap.ts; owner decision
   * 2026-11-08) for the offline unlock by password. Written only by a persistent engine (an app with
   * "Remember me") and dropped by every path that drops `wrappedKey`.
   */
  passwordWrap: 'passwordWrap',
} as const;

/** `GET /api/sync/key`: the AOK (base64), the restore epoch and the server clock. */
export function fetchSyncKey(): Promise<SyncKeyResponse> {
  return request<SyncKeyResponse>('/api/sync/key', { timeoutMs: KEY_FETCH_TIMEOUT_MS });
}

/** Derives the account's keys from the AOK bytes and zeroes them. */
export async function armKeys(aok: Uint8Array, userId: string): Promise<DerivedKeys> {
  try {
    return await deriveKeys(aok, userId);
  } finally {
    zero(aok);
  }
}

/** The AOK bytes of a key answer (the caller passes them to `armKeys`, which zeroes them). */
export function aokBytes(res: SyncKeyResponse): Uint8Array {
  const bytes = fromBase64(res.key);
  if (bytes.byteLength !== 32) throw new Error('offline key: the server answered a key of the wrong size');
  return bytes;
}

/** The platform's key vault, when one is installed (the apps). */
export function keyVault(): OfflineKeyVault | undefined {
  return getOfflinePlatform().keyVault;
}

/** Wraps `aok` with the platform vault and stores the blob in `meta.wrappedKey`. False when there is no vault. */
export async function storeWrappedKey(store: OfflineStore, userId: string, aok: Uint8Array): Promise<boolean> {
  const vault = keyVault();
  if (!vault) return false;
  const blob = await vault.wrap(userId, aok);
  await store.tx(['meta'], 'readwrite', async (t) => {
    await t.put('meta', { name: META.wrappedKey, value: blob });
    await t.put('meta', { name: META.wrappedBy, value: vault.kind });
  });
  return true;
}

/** Unwraps the stored AOK through the platform vault, or null (no vault, no blob, or it does not unwrap). */
export async function loadWrappedKey(store: OfflineStore, userId: string): Promise<Uint8Array | null> {
  const vault = keyVault();
  if (!vault) return null;
  const rows = await store.tx(['meta'], 'readonly', async (t) => ({
    blob: await t.get('meta', META.wrappedKey),
    by: await t.get('meta', META.wrappedBy),
  }));
  if (typeof rows.blob?.value !== 'string') return null;
  if (rows.by?.value !== undefined && rows.by.value !== vault.kind) return null;
  try {
    const bytes = await vault.unwrap(userId, rows.blob.value);
    return bytes.byteLength === 32 ? bytes : null;
  } catch {
    return null;
  }
}

/**
 * Asks the platform vault to forget the account's key: the Keychain item on the Mac (the key at rest
 * itself), the account's share of the Keystore alias on Android, nothing on Windows (the DPAPI blob
 * lives only in `meta`). Best effort: a vault that fails never stops the purge that asked.
 */
export async function removeVaultKey(userId: string, onError?: (e: unknown) => void): Promise<void> {
  try {
    await keyVault()?.remove(userId);
  } catch (e) {
    onError?.(e);
  }
}

/**
 * Deletes the wrapped key from `meta` (a start without "Remember me", a full wipe) and, when asked,
 * the vault's own entry. Every caller that drops the key at rest asks the vault as well (see the
 * header): through `vaultToo`, or - a start without "Remember me" - with `removeVaultKey` before the
 * database is opened, so that an open that fails never leaves the entry behind. The password wrap at
 * rest goes with the key (same lifecycle); the engine's in-memory copy, if any, is not touched here.
 */
export async function removeWrappedKey(store: OfflineStore | null, userId: string, vaultToo: boolean, onError?: (e: unknown) => void): Promise<void> {
  if (store) {
    try {
      await store.tx(['meta'], 'readwrite', async (t) => {
        await t.delete('meta', META.wrappedKey);
        await t.delete('meta', META.wrappedBy);
        await t.delete('meta', META.passwordWrap);
      });
    } catch {
      /* the store may be gone already */
    }
  }
  if (vaultToo) await removeVaultKey(userId, onError);
}

export type KeyCheckOutcome = 'ok' | 'written' | 'mismatch';

/**
 * Verifies `meta.keyCheck` against the keys in hand; writes it when the database is new. 'mismatch'
 * means the data was written with another key: the engine must not write (section 5.2).
 */
export async function ensureKeyCheck(store: OfflineStore, keys: DerivedKeys): Promise<KeyCheckOutcome> {
  const row = await store.tx(['meta'], 'readonly', (t) => t.get('meta', META.keyCheck));
  if (row) return (await verifyKeyCheck(keys, row.value)) ? 'ok' : 'mismatch';
  const blob = await makeKeyCheck(keys);
  await store.tx(['meta'], 'readwrite', async (t) => {
    const again = await t.get('meta', META.keyCheck);
    if (!again) await t.put('meta', { name: META.keyCheck, value: blob });
  });
  return 'written';
}
