/**
 * WP-H10a (docs/android-tasks/OFFLINE-DESIGN.md §3.1 "Pruning"): habit and log time rows older than
 * 180 days go - at most once per diary object per process; client ids, settings times, the key and
 * the epoch never go; nothing is written (and the diary is not marked dirty) when nothing is stale.
 */
import { describe, expect, it } from 'vitest';
import { DiaryDb } from '../src/db/database';
import { getMeta, setMeta } from '../src/db/settings-repo';
import { cidRow, ensureSyncState, habitTimeRow, logTimeRow, pruneSyncTimes, settingTimeRow } from '../src/sync/store';

const NOW = new Date('2026-10-23T12:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function metaKeys(db: DiaryDb): string[] {
  return db.all<{ key: string }>('SELECT key FROM meta ORDER BY key').map((r) => String(r.key));
}

describe('pruneSyncTimes', () => {
  it('removes habit and log time rows older than 180 days and nothing else', async () => {
    const db = await DiaryDb.create();
    const { key, epoch } = ensureSyncState(db);
    setMeta(db, habitTimeRow(1), daysAgo(181)); // old -> goes
    setMeta(db, habitTimeRow(2), daysAgo(179)); // recent -> stays
    setMeta(db, habitTimeRow(3), daysAgo(400)); // a deleted habit's row -> goes
    setMeta(db, logTimeRow(1, '2026-01-01'), daysAgo(300)); // old -> goes
    setMeta(db, logTimeRow(2, '2026-10-01'), daysAgo(10)); // recent -> stays
    setMeta(db, settingTimeRow('theme'), daysAgo(900)); // settings: never
    setMeta(db, cidRow('entry', '6f1c1c5e-3d0e-4c8e-9a51-0d5b7b0b2f11'), '5'); // client ids: never
    setMeta(db, cidRow('habit', '0c7a3b9e-5a64-4d1b-8f4e-2b4d6c8a9e01'), '1');
    setMeta(db, 'owner', 'Dana'); // not ours
    setMeta(db, 'sync:tx', daysAgo(999)); // a neighbouring key outside the ranges

    expect(pruneSyncTimes(db, NOW)).toBe(3);
    expect(metaKeys(db)).toEqual(
      [
        'owner',
        'sync:cid:entry:6f1c1c5e-3d0e-4c8e-9a51-0d5b7b0b2f11',
        'sync:cid:habit:0c7a3b9e-5a64-4d1b-8f4e-2b4d6c8a9e01',
        'sync:epoch',
        'sync:key',
        'sync:t:habit:2',
        'sync:t:log:2:2026-10-01',
        'sync:t:set:theme',
        'sync:tx',
      ].sort(),
    );
    expect(getMeta(db, 'sync:key')).toBe(key);
    expect(getMeta(db, 'sync:epoch')).toBe(epoch);
  });

  it('runs at most once per diary object; a new object (reopen, restore) is pruned again', async () => {
    const db = await DiaryDb.create();
    setMeta(db, habitTimeRow(1), daysAgo(200));
    expect(pruneSyncTimes(db, NOW)).toBe(1);
    setMeta(db, habitTimeRow(2), daysAgo(200));
    expect(pruneSyncTimes(db, NOW)).toBe(0);
    expect(getMeta(db, habitTimeRow(2))).not.toBeNull();
    const reopened = await DiaryDb.fromImage(db.export());
    expect(pruneSyncTimes(reopened, NOW)).toBe(1);
  });

  it('writes nothing when nothing is stale (the diary stays clean)', async () => {
    const db = await DiaryDb.create();
    setMeta(db, habitTimeRow(1), daysAgo(1));
    db.markClean();
    const seq = db.writeSequence;
    expect(pruneSyncTimes(db, NOW)).toBe(0);
    expect(db.isDirty()).toBe(false);
    expect(db.writeSequence).toBe(seq);
  });
});
