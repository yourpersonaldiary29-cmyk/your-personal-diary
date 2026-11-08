/**
 * Restore and offline sync (docs/android-tasks/OFFLINE-DESIGN.md §3.7, finding E11).
 *
 * A restore replaces the whole diary image - `sqlite_sequence` included - so an integer id may name
 * a different record afterwards. `carrySyncState(live, restored)` runs right before the vault swaps
 * the database:
 *   - the account offline key is copied, so the devices' outboxes stay readable;
 *   - a NEW epoch is written, so queued updates, deletes, archives and logs addressed by id become
 *     `stale` instead of hitting a record that reused the id (queued creates still apply).
 * When the live diary never synced (an account that never fetched a key) nothing is read beyond one
 * `meta` lookup and nothing is written: the restored image stays byte-identical.
 *
 * Hosted only. `restoreBackup` runs the carry only for a vault of the hosted composition - app.ts
 * marks it on its way into /api/backup (`enableSyncCarry`, through routes/sync.ts
 * `syncRestoreCarry`). A local-mode restore is therefore always exactly the restored image, even
 * when the live diary holds sync rows because a backup downloaded from hosted mode was restored
 * into it earlier (those rows are inert there: the local server has no /api/sync).
 */
import type { DiaryDb } from '../db/database';
import { getMeta, setMeta } from '../db/settings-repo';
import { newEpoch, SYNC_EPOCH_ROW, SYNC_KEY_ROW } from './store';

/** Vaults of the hosted composition whose restores carry the sync state (GC'd with the vault). */
const carryingVaults = new WeakSet<object>();

/** Restores of `vault` carry the sync state from now on (the hosted /api/backup mount calls it). */
export function enableSyncCarry(vault: object): void {
  carryingVaults.add(vault);
}

/** True for a vault of the hosted composition (see `enableSyncCarry`); never in local mode. */
export function carriesSyncState(vault: object): boolean {
  return carryingVaults.has(vault);
}

/** Returns true when sync state was carried (and the restored diary written to). */
export function carrySyncState(live: DiaryDb, restored: DiaryDb): boolean {
  let key: string | null;
  let liveEpoch: string | null;
  try {
    key = getMeta(live, SYNC_KEY_ROW);
    liveEpoch = getMeta(live, SYNC_EPOCH_ROW);
  } catch {
    // The live diary is already closed: the swap that follows refuses with its own error, as before.
    return false;
  }
  if (!key) return false;
  let epoch = newEpoch();
  // Never reuse the live epoch, nor the backup's own (a backup made after the last key fetch).
  const backupEpoch = getMeta(restored, SYNC_EPOCH_ROW);
  while (epoch === liveEpoch || epoch === backupEpoch) epoch = newEpoch();
  restored.transaction(() => {
    setMeta(restored, SYNC_KEY_ROW, key);
    setMeta(restored, SYNC_EPOCH_ROW, epoch);
  });
  return true;
}
