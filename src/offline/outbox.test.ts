import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CalendarMonth, EntryInput, HomeSummary } from '@shared/types';
import type { SyncOp } from '@shared/sync';
import { coalesce } from './coalesce';
import { randomUuid } from './crypto';
import { MirrorSink } from './mirror';
import { Outbox, OpTooLargeError } from './outbox';
import { overlayMonth } from './overlay/calendar';
import { buildEffects } from './overlay/effects';
import { overlayHome } from './overlay/home';
import { openAccountStore } from './store/idb';
import { MemoryStore } from './store/memory';
import type { OfflineStore, StoreName, StoreTx, TxOptions } from './store/types';
import { DANA, freshIndexedDb, installWebCrypto, testKeys } from './test-utils/env';
import type { QueuedOp } from './types';

beforeAll(() => installWebCrypto());

const ENTRY: EntryInput = {
  date: '2026-10-23',
  time: '08:00',
  title: 'Morning walk',
  body: 'A walk in the park.',
  mood: 7,
  emotions: [],
  energy: null,
  stress: null,
  sleepQuality: null,
  sleepHours: null,
  exerciseMinutes: null,
  exerciseType: '',
  events: [],
  people: [],
  location: '',
  notes: '',
  tags: ['walk'],
};

function common(editedAt = '2026-10-23T08:00:00.000Z') {
  return { v: 1 as const, account: DANA, opId: randomUuid(), editedAt, epoch: '0123456789abcdef' };
}

function queued(op: SyncOp, record: string, chain: string, extra: Partial<QueuedOp> = {}): QueuedOp {
  return { op, record, chain, queuedAt: 1, ...extra };
}

const CID = '11111111-1111-4111-8111-111111111111';

describe('coalescing (section 4.4 table)', () => {
  it('create + update(s) gives one create with the final input and the new opId', () => {
    const create = queued({ ...common(), kind: 'entry.create', clientId: CID, payload: ENTRY }, `c:${CID}`, `entry:c:${CID}`, { localId: -1 });
    const update = queued({ ...common('2026-10-23T08:05:00.000Z'), kind: 'entry.update', target: { clientId: CID }, payload: { ...ENTRY, title: 'Evening walk' } }, `c:${CID}`, `entry:c:${CID}`);
    const r = coalesce(create, false, update);
    expect(r.action).toBe('replace');
    if (r.action !== 'replace') return;
    expect(r.merged.op.kind).toBe('entry.create');
    expect(r.merged.op.opId).toBe(update.op.opId);
    expect(r.merged.op.editedAt).toBe('2026-10-23T08:05:00.000Z');
    expect((r.merged.op as { payload: EntryInput }).payload.title).toBe('Evening walk');
    expect(r.merged.localId).toBe(-1);
  });

  it('create + delete drops both', () => {
    const create = queued({ ...common(), kind: 'entry.create', clientId: CID, payload: ENTRY }, `c:${CID}`, `entry:c:${CID}`);
    const del = queued({ ...common(), kind: 'entry.delete', target: { clientId: CID } }, `c:${CID}`, `entry:c:${CID}`);
    expect(coalesce(create, false, del)).toEqual({ action: 'drop-both' });
  });

  it('update + update keeps the first base and takes the latest input and editedAt', () => {
    const u1 = queued({ ...common('2026-10-23T08:00:00.000Z'), kind: 'entry.update', target: { id: 5 }, base: 'v1', payload: ENTRY }, 'i:5', 'entry:i:5');
    const u2 = queued({ ...common('2026-10-23T08:09:00.000Z'), kind: 'entry.update', target: { id: 5 }, base: 'v-shown-later', payload: { ...ENTRY, title: 'Later' } }, 'i:5', 'entry:i:5');
    const r = coalesce(u1, false, u2);
    expect(r.action).toBe('replace');
    if (r.action !== 'replace') return;
    const op = r.merged.op as Extract<SyncOp, { kind: 'entry.update' }>;
    expect(op.base).toBe('v1');
    expect(op.payload.title).toBe('Later');
    expect(op.editedAt).toBe('2026-10-23T08:09:00.000Z');
  });

  it('update + delete gives one delete with the first base', () => {
    const u1 = queued({ ...common(), kind: 'entry.update', target: { id: 5 }, base: 'v1', payload: ENTRY }, 'i:5', 'entry:i:5');
    const del = queued({ ...common(), kind: 'entry.delete', target: { id: 5 }, base: 'v2' }, 'i:5', 'entry:i:5');
    const r = coalesce(u1, false, del);
    expect(r.action).toBe('replace');
    if (r.action === 'replace') expect(r.merged.op).toMatchObject({ kind: 'entry.delete', base: 'v1' });
  });

  it('habit.create + habit.update, archive + archive, log set / delete', () => {
    const hc = queued({ ...common(), kind: 'habit.create', clientId: CID, payload: { name: 'Water', description: '', target: 8, unit: 'glasses', frequency: 'daily', reminderTime: null, reminderEnabled: false } }, `c:${CID}`, 'habits');
    const hu = queued({ ...common(), kind: 'habit.update', target: { clientId: CID }, payload: { name: 'Tea', description: '', target: 3, unit: 'cups', frequency: 'daily', reminderTime: null, reminderEnabled: false } }, `c:${CID}`, 'habits');
    const r1 = coalesce(hc, false, hu);
    expect(r1.action).toBe('replace');
    if (r1.action === 'replace') expect(r1.merged.op).toMatchObject({ kind: 'habit.create', payload: { name: 'Tea' } });

    const a1 = queued({ ...common(), kind: 'habit.archive', target: { id: 3 }, base: { archived: false }, payload: { archived: true } }, 'i:3', 'habits');
    const a2 = queued({ ...common(), kind: 'habit.archive', target: { id: 3 }, base: { archived: true }, payload: { archived: false } }, 'i:3', 'habits');
    const r2 = coalesce(a1, false, a2);
    if (r2.action === 'replace') expect(r2.merged.op).toMatchObject({ kind: 'habit.archive', base: { archived: false }, payload: { archived: false } });
    else throw new Error('expected replace');

    const l1 = queued({ ...common(), kind: 'log.set', habit: { id: 3 }, date: '2026-10-23', base: null, payload: { value: 1, note: '' } }, 'l:i:3:2026-10-23', 'log:i:3:2026-10-23');
    const l2 = queued({ ...common(), kind: 'log.delete', habit: { id: 3 }, date: '2026-10-23', base: { value: 1, note: '' } }, 'l:i:3:2026-10-23', 'log:i:3:2026-10-23');
    const r3 = coalesce(l1, false, l2);
    if (r3.action === 'replace') expect(r3.merged.op).toMatchObject({ kind: 'log.delete', base: null });
    else throw new Error('expected replace');
  });

  it('settings.patch + settings.patch merges per key: last value, first base per key', () => {
    const s1 = queued({ ...common(), kind: 'settings.patch', base: { theme: 'system' }, payload: { theme: 'dark' } }, 'settings', 'settings');
    const s2 = queued({ ...common(), kind: 'settings.patch', base: { theme: 'dark', fontScale: 1 }, payload: { theme: 'light', fontScale: 1.25 } }, 'settings', 'settings');
    const r = coalesce(s1, false, s2);
    expect(r.action).toBe('replace');
    if (r.action === 'replace') expect(r.merged.op).toMatchObject({ kind: 'settings.patch', base: { theme: 'system', fontScale: 1 }, payload: { theme: 'light', fontScale: 1.25 } });
  });

  it('a sealed predecessor, another record or another chain is never merged', () => {
    const u1 = queued({ ...common(), kind: 'entry.update', target: { id: 5 }, payload: ENTRY }, 'i:5', 'entry:i:5');
    const u2 = queued({ ...common(), kind: 'entry.update', target: { id: 5 }, payload: ENTRY }, 'i:5', 'entry:i:5');
    expect(coalesce(u1, true, u2)).toEqual({ action: 'append' });
    const other = queued({ ...common(), kind: 'entry.update', target: { id: 6 }, payload: ENTRY }, 'i:6', 'entry:i:6');
    expect(coalesce(u1, false, other)).toEqual({ action: 'append' });
    expect(coalesce(undefined, false, u2)).toEqual({ action: 'append' });
  });

  describe('hint.prev of a merged pair: what the cached views still hold, i.e. the FIRST operation\'s prev (a create has none)', () => {
    const CREATED_AT = '2026-10-23T08:00:00.000Z';
    /** What the device showed for entry 5 before the first offline change (= what the cached views hold). */
    const shownBefore = { date: '2026-10-23', title: 'Morning walk', tags: ['walk'], people: [], location: '' };
    /** What the device showed after the first offline change: the second change's own `prev`, known to no cached view. */
    const afterFirstChange = { date: '2026-10-24', title: 'Evening walk', tags: ['run'], people: [], location: '' };

    it("create + update drops the update's prev (the create's own optimistic version) and keeps the create's facts", () => {
      const create = queued({ ...common(CREATED_AT), kind: 'entry.create', clientId: CID, payload: ENTRY }, `c:${CID}`, `entry:c:${CID}`, { localId: -1, hint: { createdAt: CREATED_AT, displayId: -1 } });
      const update = queued(
        { ...common('2026-10-23T08:05:00.000Z'), kind: 'entry.update', target: { clientId: CID }, payload: { ...ENTRY, title: 'Evening walk' } },
        `c:${CID}`,
        `entry:c:${CID}`,
        { hint: { displayId: -1, createdAt: CREATED_AT, title: ENTRY.title, date: ENTRY.date, prev: { date: ENTRY.date, title: ENTRY.title, tags: ENTRY.tags, people: [], location: '' } } },
      );
      const r = coalesce(create, false, update);
      expect(r.action).toBe('replace');
      if (r.action !== 'replace') return;
      expect(r.merged.hint).not.toHaveProperty('prev');
      expect(r.merged.hint).toMatchObject({ createdAt: CREATED_AT, displayId: -1 });
    });

    it("update + update keeps the FIRST update's prev, not the second's", () => {
      const u1 = queued({ ...common(), kind: 'entry.update', target: { id: 5 }, base: 'v1', payload: ENTRY }, 'i:5', 'entry:i:5', { hint: { displayId: 5, createdAt: CREATED_AT, prev: shownBefore } });
      const u2 = queued({ ...common('2026-10-23T08:09:00.000Z'), kind: 'entry.update', target: { id: 5 }, payload: { ...ENTRY, title: 'Night walk' } }, 'i:5', 'entry:i:5', { hint: { displayId: 5, createdAt: CREATED_AT, prev: afterFirstChange } });
      const r = coalesce(u1, false, u2);
      expect(r.action).toBe('replace');
      if (r.action === 'replace') expect(r.merged.hint?.prev).toEqual(shownBefore);
    });

    it("update + delete keeps the FIRST update's prev (the delete's label stays what the user deleted)", () => {
      const u1 = queued({ ...common(), kind: 'entry.update', target: { id: 5 }, base: 'v1', payload: ENTRY }, 'i:5', 'entry:i:5', { hint: { displayId: 5, prev: shownBefore } });
      const del = queued({ ...common(), kind: 'entry.delete', target: { id: 5 } }, 'i:5', 'entry:i:5', { hint: { displayId: 5, title: afterFirstChange.title, date: afterFirstChange.date, prev: afterFirstChange } });
      const r = coalesce(u1, false, del);
      expect(r.action).toBe('replace');
      if (r.action !== 'replace') return;
      expect(r.merged.hint?.prev).toEqual(shownBefore);
      expect(r.merged.hint).toMatchObject({ title: afterFirstChange.title, date: afterFirstChange.date });
    });

    it('update + update where the first update had no prev: the merged update has none (nothing the device showed to subtract)', () => {
      const u1 = queued({ ...common(), kind: 'entry.update', target: { id: 5 }, payload: ENTRY }, 'i:5', 'entry:i:5', { hint: { displayId: 5 } });
      const u2 = queued({ ...common(), kind: 'entry.update', target: { id: 5 }, payload: { ...ENTRY, title: 'Later' } }, 'i:5', 'entry:i:5', { hint: { displayId: 5, prev: afterFirstChange } });
      const r = coalesce(u1, false, u2);
      if (r.action !== 'replace') throw new Error('expected replace');
      expect(r.merged.hint).not.toHaveProperty('prev');
    });

    it('the e2e scenario (step 2): the coalesced create does not subtract from the cached month and home counts - today has 2 entries', () => {
      const TODAY = ENTRY.date;
      const e0 = { date: TODAY, title: 'E0 Harbour walk', tags: ['e2e'], people: [], location: '' };
      const e5 = { date: TODAY, title: 'E5 Old note', tags: ['e2e'], people: [], location: '' };
      // The cached views: E0 and E5 today.
      const month: CalendarMonth = {
        year: 2026,
        month: 10,
        days: Array.from({ length: 31 }, (_, i) => {
          const date = `2026-10-${String(i + 1).padStart(2, '0')}`;
          const n = date === TODAY ? 2 : 0;
          return { date, mood: null, energy: null, stress: null, sleepHours: null, hasEntry: n > 0, entryCount: n, habitsCompleted: 0, habitsTotal: 0, titles: n ? [e0.title, e5.title] : [] };
        }),
      };
      const home: HomeSummary = { today: TODAY, todayWeekday: 'Friday', todayEntryCount: 2, entryStreak: 1, lastEntry: null, weekMoodAvg: null, weekEnergyAvg: null, weekStressAvg: null, weekSleepAvg: null, habitsToday: [], topInsight: null, totalEntries: 2 };

      // Offline: E1 created then edited (the edit's prev is the create's optimistic version), E0 edited, E5 deleted.
      const create = queued({ ...common(CREATED_AT), kind: 'entry.create', clientId: CID, payload: { ...ENTRY, title: 'E1 Sea', tags: ['e2e'] } }, `c:${CID}`, `entry:c:${CID}`, { localId: -1, hint: { createdAt: CREATED_AT, displayId: -1 } });
      const edit = queued(
        { ...common('2026-10-23T08:05:00.000Z'), kind: 'entry.update', target: { clientId: CID }, payload: { ...ENTRY, title: 'E1 Sea (edited)', tags: ['e2e'] } },
        `c:${CID}`,
        `entry:c:${CID}`,
        { hint: { displayId: -1, createdAt: CREATED_AT, prev: { date: TODAY, title: 'E1 Sea', tags: ['e2e'], people: [], location: '' } } },
      );
      const merged = coalesce(create, false, edit);
      if (merged.action !== 'replace') throw new Error('expected replace');
      const editE0 = queued({ ...common(), kind: 'entry.update', target: { id: 1 }, base: 'v1', payload: { ...ENTRY, title: 'E0 Harbour walk (edited offline)', tags: ['e2e'] } }, 'i:1', 'entry:i:1', { hint: { displayId: 1, createdAt: CREATED_AT, prev: e0 } });
      const deleteE5 = queued({ ...common(), kind: 'entry.delete', target: { id: 2 }, base: 'v1' }, 'i:2', 'entry:i:2', { hint: { displayId: 2, title: e5.title, date: e5.date, prev: e5 } });

      const fx = buildEffects({ pending: [merged.merged, editE0, deleteE5], journal: [], idOf: () => null });
      const cell = overlayMonth(month, fx, { today: TODAY, habits: new Map() }).days.find((d) => d.date === TODAY);
      expect(cell).toMatchObject({ entryCount: 2, hasEntry: true });
      expect([...(cell?.titles ?? [])].sort()).toEqual(['E0 Harbour walk (edited offline)', 'E1 Sea (edited)']);
      expect(overlayHome(home, fx, { today: TODAY, firstDayOfWeek: 0 })).toMatchObject({ todayEntryCount: 2, totalEntries: 2 });
    });
  });
});

/** A store that records the options of every transaction and can be made to fail. */
class SpyStore implements OfflineStore {
  readonly persistent = true;
  readonly options: (TxOptions | undefined)[] = [];
  failNext = false;
  constructor(private readonly inner: OfflineStore = new MemoryStore()) {}
  tx<T>(stores: readonly StoreName[], mode: 'readonly' | 'readwrite', fn: (t: StoreTx) => Promise<T>, options?: TxOptions): Promise<T> {
    if (mode === 'readwrite') this.options.push(options);
    if (this.failNext && mode === 'readwrite') {
      this.failNext = false;
      return Promise.reject(new DOMException('quota', 'QuotaExceededError'));
    }
    return this.inner.tx(stores, mode, fn, options);
  }
  close(): void {
    this.inner.close();
  }
}

describe('outbox enqueue (section 4.3 step 2)', () => {
  it('writes with strict durability and resolves only after the transaction committed', async () => {
    const keys = await testKeys();
    const spy = new SpyStore();
    const outbox = new Outbox(spy, keys, new MirrorSink(DANA));
    const q = queued({ ...common(), kind: 'entry.create', clientId: CID, payload: ENTRY }, `c:${CID}`, `entry:c:${CID}`, { localId: -1 });
    const r = await outbox.enqueue(q, [], [{ localId: -1, kind: 'entry', clientId: CID }]);
    expect(r.action).toBe('append');
    expect(spy.options.every((o) => o?.durability === 'strict')).toBe(true);
    expect(spy.options.length).toBeGreaterThan(0);
    const rows = await outbox.load();
    expect(rows).toHaveLength(1);
    expect(rows[0].row.sealed).toBe(false);
    expect(rows[0].q.op.kind).toBe('entry.create');
  });

  it('a failed transaction rejects and leaves nothing half-written', async () => {
    const keys = await testKeys();
    const spy = new SpyStore();
    const outbox = new Outbox(spy, keys, new MirrorSink(DANA));
    spy.failNext = true;
    const q = queued({ ...common(), kind: 'entry.create', clientId: CID, payload: ENTRY }, `c:${CID}`, `entry:c:${CID}`, { localId: -1 });
    await expect(outbox.enqueue(q, [], [{ localId: -1, kind: 'entry', clientId: CID }])).rejects.toBeDefined();
    expect(await outbox.load()).toHaveLength(0);
    expect(await spy.tx(['idmap'], 'readonly', (t) => t.count('idmap'))).toBe(0);
  });

  it('an operation over SYNC_MAX_OP_BYTES is refused at enqueue', async () => {
    const keys = await testKeys();
    const outbox = new Outbox(new MemoryStore(), keys, new MirrorSink(DANA));
    const big = queued({ ...common(), kind: 'entry.create', clientId: CID, payload: { ...ENTRY, body: 'x'.repeat(2 * 1024 * 1024) } }, `c:${CID}`, `entry:c:${CID}`);
    await expect(outbox.enqueue(big)).rejects.toBeInstanceOf(OpTooLargeError);
    expect(await outbox.load()).toHaveLength(0);
  });
});

describe('sealing (fixes E5): two engines on one IndexedDB', () => {
  beforeEach(() => {
    freshIndexedDb();
  });

  it('a coalesce never touches a sealed operation, and a sealed payload is byte-identical across retries', async () => {
    const keys = await testKeys();
    const { store: storeA } = await openAccountStore(DANA);
    const { store: storeB } = await openAccountStore(DANA);
    const a = new Outbox(storeA, keys, new MirrorSink(DANA));
    const b = new Outbox(storeB, keys, new MirrorSink(DANA));

    const create = queued({ ...common(), kind: 'entry.create', clientId: CID, payload: ENTRY }, `c:${CID}`, `entry:c:${CID}`, { localId: -1 });
    await a.enqueue(create);

    // Tab B seals the create (it is about to send it).
    const [item] = await b.load();
    const sealed = await b.seal(item, item.q.op);
    expect(sealed.row.sealed).toBe(true);
    expect(sealed.row.attempts).toBe(1);
    const sentJson = JSON.stringify(sealed.q.op);

    // Tab A edits the same record: the update is appended, the sealed create is untouched.
    const update = queued({ ...common('2026-10-23T09:00:00.000Z'), kind: 'entry.update', target: { clientId: CID }, payload: { ...ENTRY, title: 'Changed' } }, `c:${CID}`, `entry:c:${CID}`);
    const r = await a.enqueue(update);
    expect(r.action).toBe('append');
    const rows = await a.load();
    expect(rows).toHaveLength(2);
    expect(rows[0].row.sealed).toBe(true);
    expect(JSON.stringify(rows[0].q.op)).toBe(sentJson);
    expect(rows[1].q.op.kind).toBe('entry.update');

    // A retry seals again: same content, one more attempt.
    const again = await b.seal((await b.load())[0], { ...item.q.op, opId: 'should-be-ignored' } as SyncOp);
    expect(JSON.stringify(again.q.op)).toBe(sentJson);
    expect(again.row.attempts).toBe(2);
    storeA.close();
    storeB.close();
  });

  it('a create + update that are both unsealed stay one operation (coalesced), with the first seq', async () => {
    const keys = await testKeys();
    const { store } = await openAccountStore(DANA);
    const outbox = new Outbox(store, keys, new MirrorSink(DANA));
    const create = queued({ ...common(), kind: 'entry.create', clientId: CID, payload: ENTRY }, `c:${CID}`, `entry:c:${CID}`, { localId: -1 });
    const first = await outbox.enqueue(create);
    const update = queued({ ...common(), kind: 'entry.update', target: { clientId: CID }, payload: { ...ENTRY, title: 'Changed' } }, `c:${CID}`, `entry:c:${CID}`);
    const second = await outbox.enqueue(update);
    expect(second.action).toBe('replace');
    expect(second.seq).toBe(first.seq);
    const rows = await outbox.load();
    expect(rows).toHaveLength(1);
    expect(rows[0].q.op).toMatchObject({ kind: 'entry.create', payload: { title: 'Changed' } });
    store.close();
  });
});
