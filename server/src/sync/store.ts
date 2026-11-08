/**
 * Offline sync bookkeeping (docs/android-tasks/OFFLINE-DESIGN.md §3.1): ZERO DDL. Everything lives
 * in rows of the existing `meta` table under the `sync:` prefix, inside the user's encrypted diary.
 * `SCHEMA_VERSION` stays 1 and nothing here runs when a diary is opened - every row is written
 * lazily by the hosted sync routes only, so a local diary never gets one.
 *
 *   sync:key                          base64 of 32 random bytes: the account offline key (AOK)
 *   sync:epoch                        16 hex chars; replaced by every restore (restore.ts)
 *   sync:cid:entry:<clientId>         entry id of a synced create (never removed)
 *   sync:cid:habit:<clientId>         habit id of a synced create (never removed)
 *   sync:t:habit:<id>                 ISO time of the last sync write to the habit (pruned after 180 days)
 *   sync:t:log:<habitId>:<date>       ISO time of the last sync write to the log (pruned after 180 days)
 *   sync:t:set:<key>                  ISO time of the last sync write to the setting (never pruned)
 */
import { randomBytes } from 'node:crypto';
import type { DiaryDb } from '../db/database';
import { getMeta, setMeta } from '../db/settings-repo';

export const SYNC_KEY_ROW = 'sync:key';
export const SYNC_EPOCH_ROW = 'sync:epoch';
/** Bytes of the account offline key. */
export const SYNC_KEY_BYTES = 32;
/** Time rows (habits, logs) older than this are pruned; a pruned time counts as "older than any change". */
export const SYNC_TIME_RETENTION_DAYS = 180;

export type CidKind = 'entry' | 'habit';

export const cidRow = (kind: CidKind, clientId: string): string => `sync:cid:${kind}:${clientId.toLowerCase()}`;
export const habitTimeRow = (habitId: number): string => `sync:t:habit:${habitId}`;
export const logTimeRow = (habitId: number, date: string): string => `sync:t:log:${habitId}:${date}`;
export const settingTimeRow = (key: string): string => `sync:t:set:${key}`;

/** A new restore epoch: 16 lower-case hex characters. */
export function newEpoch(): string {
  return randomBytes(8).toString('hex');
}

export interface SyncState {
  key: string;
  epoch: string;
}

/** The key and epoch of a diary, or null when the sync code never ran on it. Reads only. */
export function readSyncState(db: DiaryDb): SyncState | null {
  const key = getMeta(db, SYNC_KEY_ROW);
  const epoch = getMeta(db, SYNC_EPOCH_ROW);
  return key && epoch ? { key, epoch } : null;
}

/**
 * The key and epoch, created in one transaction on the first call (`created: true`). The caller
 * persists before answering, so a key a device holds always survives a server crash.
 */
export function ensureSyncState(db: DiaryDb): SyncState & { created: boolean } {
  const existing = readSyncState(db);
  if (existing) return { ...existing, created: false };
  return db.transaction(() => {
    // A diary may hold a key without an epoch (never written that way, but cheap to heal): keep the key.
    const key = getMeta(db, SYNC_KEY_ROW) || randomBytes(SYNC_KEY_BYTES).toString('base64');
    const epoch = getMeta(db, SYNC_EPOCH_ROW) || newEpoch();
    setMeta(db, SYNC_KEY_ROW, key);
    setMeta(db, SYNC_EPOCH_ROW, epoch);
    return { key, epoch, created: true };
  });
}

/** Server id recorded for a synced create, or null. */
export function cidTarget(db: DiaryDb, kind: CidKind, clientId: string): number | null {
  const raw = getMeta(db, cidRow(kind, clientId));
  if (raw === null) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function recordCid(db: DiaryDb, kind: CidKind, clientId: string, id: number): void {
  setMeta(db, cidRow(kind, clientId), String(id));
}

/** A time row's value, '' when there is none (written by an older app, or pruned). */
export function storedTime(db: DiaryDb, row: string): string {
  return getMeta(db, row) ?? '';
}

export function writeTime(db: DiaryDb, row: string, iso: string): void {
  setMeta(db, row, iso);
}

const PRUNE_WHERE =
  "((key >= 'sync:t:habit:' AND key < 'sync:t:habit;') OR (key >= 'sync:t:log:' AND key < 'sync:t:log;')) AND value < ?";

/** Diaries already pruned by this process (one prune per open diary object). */
const pruned = new WeakSet<DiaryDb>();

/**
 * Removes habit and log time rows older than 180 days - at most once per diary object per process,
 * on its first sync request. Settings times, client ids, the key and the epoch are never pruned.
 * Writes nothing (and does not mark the diary dirty) when there is nothing to remove.
 * Returns the number of rows removed.
 */
export function pruneSyncTimes(db: DiaryDb, now: Date = new Date()): number {
  if (pruned.has(db)) return 0;
  pruned.add(db);
  const cutoff = new Date(now.getTime() - SYNC_TIME_RETENTION_DAYS * 86_400_000).toISOString();
  const stale = Number(db.scalar<number>(`SELECT COUNT(*) FROM meta WHERE ${PRUNE_WHERE}`, [cutoff]) ?? 0);
  if (stale === 0) return 0;
  return db.run(`DELETE FROM meta WHERE ${PRUNE_WHERE}`, [cutoff]).changes;
}
