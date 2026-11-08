import { describe, expect, it } from 'vitest';
import type { AppSettings, CalendarMonth, DaySummary, Entry, EntryPage, Habit, HabitWithProgress, HomeSummary } from '@shared/types';
import type { SyncOpResult } from '@shared/sync';
import { DEFAULT_APP_SETTINGS } from '@/constants/settings';
import type { JournalEntry, QueuedOp } from '../types';
import { overlayDays, overlayMonth } from './calendar';
import { overlayDay } from './days';
import { buildEffects, entryToSummary, type Effects } from './effects';
import { matchesFilter, overlayEntry, overlayEntryPage } from './entries';
import { overlayHabits, overlayProgress } from './habits';
import { overlayHome } from './home';
import { overlayCounts } from './meta';
import { overlaySettings } from './settings';

const U = 'u_0123456789abcdef';

function entry(id: number, over: Partial<Entry> = {}): Entry {
  return {
    id,
    date: '2026-10-23',
    time: '08:00',
    title: `Entry ${id}`,
    body: 'A walk in the park. '.repeat(20),
    mood: 6,
    emotions: ['calm'],
    energy: 5,
    stress: 3,
    sleepQuality: null,
    sleepHours: 7,
    exerciseMinutes: null,
    exerciseType: '',
    events: [],
    people: ['Noa'],
    location: 'Park',
    notes: '',
    tags: ['walk'],
    createdAt: '2026-10-23T08:00:00.000Z',
    updatedAt: '2026-10-23T08:00:00.000Z',
    ...over,
  };
}

function habit(id: number, over: Partial<Habit> = {}): Habit {
  return { id, name: `Habit ${id}`, description: '', target: 2, unit: 'x', frequency: 'daily', reminderTime: null, reminderEnabled: false, isArchived: false, sortOrder: id, createdAt: '2026-10-01T00:00:00.000Z', ...over };
}

const base = { v: 1 as const, account: U, editedAt: '2026-10-23T09:00:00.000Z', epoch: 'e' };
let n = 0;
const oid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

function pendingCreate(localId: number, over: Partial<Entry> = {}): QueuedOp {
  const clientId = oid();
  const e = entry(localId, over);
  const { id: _id, createdAt: _c, updatedAt: _u, ...payload } = e;
  return { op: { ...base, opId: oid(), kind: 'entry.create', clientId, payload }, record: `c:${clientId}`, chain: `entry:c:${clientId}`, localId, hint: { displayId: localId, createdAt: base.editedAt }, queuedAt: 1 };
}

function pendingUpdate(id: number, prev: Entry, over: Partial<Entry>): QueuedOp {
  const e = { ...prev, ...over };
  const { id: _id, createdAt: _c, updatedAt: _u, ...payload } = e;
  return {
    op: { ...base, opId: oid(), kind: 'entry.update', target: { id }, base: prev.updatedAt, payload },
    record: `i:${id}`,
    chain: `entry:i:${id}`,
    hint: { displayId: id, createdAt: prev.createdAt, prev: { date: prev.date, title: prev.title, tags: prev.tags, people: prev.people, location: prev.location } },
    queuedAt: 1,
  };
}

function pendingDelete(id: number, prev: Entry): QueuedOp {
  return { op: { ...base, opId: oid(), kind: 'entry.delete', target: { id }, base: prev.updatedAt }, record: `i:${id}`, chain: `entry:i:${id}`, hint: { displayId: id, prev: { date: prev.date, title: prev.title, tags: prev.tags, people: prev.people, location: prev.location } }, queuedAt: 1 };
}

function fx(pending: QueuedOp[], journal: JournalEntry[] = [], idOf: Effects['entries'] extends never ? never : (kind: 'entry' | 'habit', key: string) => number | null = () => null): Effects {
  return buildEffects({ pending, journal, idOf });
}

function journalOf(q: QueuedOp, result: Partial<SyncOpResult>): JournalEntry {
  return { opId: q.op.opId, appliedAt: 500, queued: q, sent: q.op, result: { opId: q.op.opId, outcome: 'applied', record: null, serverNow: base.editedAt, epoch: 'e', ...result } };
}

describe('overlay: entry by id', () => {
  it('a pending update supplies the content, a pending delete gives not found', () => {
    const e5 = entry(5);
    const upd = pendingUpdate(5, e5, { title: 'Changed' });
    const o = overlayEntry(5, fx([upd]));
    expect(o.kind).toBe('entry');
    if (o.kind === 'entry') {
      expect(o.entry.title).toBe('Changed');
      expect(o.pending).toBe(true);
      expect(o.entry.createdAt).toBe(e5.createdAt);
    }
    expect(overlayEntry(5, fx([pendingDelete(5, e5)])).kind).toBe('notFound');
    expect(overlayEntry(6, fx([upd])).kind).toBe('unchanged');
  });

  it('a journal result after the cache time is server truth; a later pending op wins over it', () => {
    const e5 = entry(5);
    const acked = pendingUpdate(5, e5, { title: 'Server kept this' });
    const j = journalOf(acked, { outcome: 'conflict-lost', record: entry(5, { title: 'Other device', updatedAt: '2026-10-23T10:00:00.000Z' }) });
    const o = overlayEntry(5, fx([], [j]));
    expect(o.kind === 'entry' && o.entry.title).toBe('Other device');
    const later = pendingUpdate(5, e5, { title: 'Mine again' });
    const o2 = overlayEntry(5, fx([later], [j]));
    expect(o2.kind === 'entry' && o2.entry.title).toBe('Mine again');
  });
});

describe('overlay: entry list page', () => {
  const page: EntryPage = { items: [entryToSummary(entry(3, { date: '2026-10-22' })), entryToSummary(entry(2, { date: '2026-10-21' }))], total: 2 };

  it('inserts a matching pending create in sort order and adjusts the total', () => {
    const out = overlayEntryPage(page, {}, fx([pendingCreate(-1, { date: '2026-10-23', title: 'New' })]));
    expect(out.items.map((i) => i.id)).toEqual([-1, 3, 2]);
    expect(out.total).toBe(3);
    expect(out.items[0].excerpt.length).toBeLessThanOrEqual(160);
  });

  it('respects the filter: date range, tag, emotion and text', () => {
    const created = pendingCreate(-1, { date: '2026-09-01', tags: ['other'], emotions: [], body: 'nothing here', location: 'Home', people: [] });
    expect(overlayEntryPage(page, { from: '2026-10-01' }, fx([created])).total).toBe(2);
    expect(overlayEntryPage(page, { tag: '#walk' }, fx([created])).total).toBe(2);
    expect(overlayEntryPage(page, { emotion: 'calm' }, fx([created])).total).toBe(2);
    expect(overlayEntryPage(page, { text: 'PARK' }, fx([created])).total).toBe(2);
    expect(overlayEntryPage(page, { text: 'nothing' }, fx([created])).total).toBe(3);
    expect(matchesFilter(entry(1), { text: 'noa' })).toBe(true);
  });

  it('replaces an edited summary, removes one that stops matching, removes a deleted one', () => {
    const e3 = entry(3, { date: '2026-10-22' });
    const edited = overlayEntryPage(page, {}, fx([pendingUpdate(3, e3, { title: 'Edited' })]));
    expect(edited.items.find((i) => i.id === 3)?.title).toBe('Edited');
    expect(edited.total).toBe(2);
    const moved = overlayEntryPage(page, { from: '2026-10-20', to: '2026-10-25' }, fx([pendingUpdate(3, e3, { date: '2026-01-01' })]));
    expect(moved.items.map((i) => i.id)).toEqual([2]);
    expect(moved.total).toBe(1);
    const deleted = overlayEntryPage(page, {}, fx([pendingDelete(3, e3)]));
    expect(deleted.items.map((i) => i.id)).toEqual([2]);
    expect(deleted.total).toBe(1);
  });

  it('sorts ascending when asked', () => {
    const out = overlayEntryPage(page, { sortDesc: false }, fx([pendingCreate(-1, { date: '2026-10-23' })]));
    expect(out.items.map((i) => i.id)).toEqual([2, 3, -1]);
  });
});

describe('overlay: day summary', () => {
  const day: DaySummary = {
    date: '2026-10-23',
    entries: [entry(1, { mood: 8, sleepHours: 6 })],
    habitLogs: [{ log: { id: 9, habitId: 1, date: '2026-10-23', value: 1, completed: false, note: '' }, habitName: 'Habit 1', unit: 'x', target: 2, frequency: 'daily' }],
    moodAvg: 8,
    energyAvg: 5,
    stressAvg: 3,
    sleepHours: 6,
  };
  const habits = new Map([[1, habit(1)], [2, habit(2, { name: 'Water', unit: 'glasses' })]]);

  it('adds pending entries and recomputes the averages as getDay does', () => {
    const out = overlayDay(day, '2026-10-23', fx([pendingCreate(-1, { mood: 5, sleepHours: 7, energy: 3 })]), { habits });
    expect(out.entries.map((e) => e.id)).toEqual([-1, 1]);
    expect(out.moodAvg).toBe(6.5);
    expect(out.energyAvg).toBe(4);
    expect(out.sleepHours).toBe(7);
  });

  it('logs: a set shows the value with the habit name and completion; a delete removes it', () => {
    const set: QueuedOp = { op: { ...base, opId: oid(), kind: 'log.set', habit: { id: 2 }, date: '2026-10-23', payload: { value: 3, note: 'ok' } }, record: 'l:i:2:2026-10-23', chain: 'log:i:2:2026-10-23', hint: { displayId: 2, habit: { name: 'Water', unit: 'glasses', target: 2, frequency: 'daily' } }, queuedAt: 1 };
    const del: QueuedOp = { op: { ...base, opId: oid(), kind: 'log.delete', habit: { id: 1 }, date: '2026-10-23' }, record: 'l:i:1:2026-10-23', chain: 'log:i:1:2026-10-23', hint: { displayId: 1 }, queuedAt: 1 };
    const out = overlayDay(day, '2026-10-23', fx([set, del]), { habits });
    expect(out.habitLogs).toHaveLength(1);
    expect(out.habitLogs[0]).toMatchObject({ habitName: 'Water', unit: 'glasses', log: { habitId: 2, value: 3, completed: true, note: 'ok' } });
  });

  it('a day never cached is synthesised from the effects alone', () => {
    const out = overlayDay(null, '2026-10-23', fx([pendingCreate(-1, { mood: 4 })]), { habits });
    expect(out.entries).toHaveLength(1);
    expect(out.moodAvg).toBe(4);
    expect(out.habitLogs).toEqual([]);
  });
});

describe('overlay: calendar', () => {
  const month: CalendarMonth = {
    year: 2026,
    month: 10,
    days: Array.from({ length: 31 }, (_, i) => {
      const date = `2026-10-${String(i + 1).padStart(2, '0')}`;
      const has = date === '2026-10-22';
      return { date, mood: has ? 6 : null, energy: null, stress: null, sleepHours: null, hasEntry: has, entryCount: has ? 1 : 0, habitsCompleted: 0, habitsTotal: 2, titles: has ? ['Entry 3'] : [] };
    }),
  };
  const ctx = { today: '2026-10-23', habits: new Map([[1, habit(1)]]) };

  it('counts a pending create, moves an edited entry between days and drops a deleted one', () => {
    const e3 = entry(3, { date: '2026-10-22' });
    const out = overlayMonth(month, fx([pendingCreate(-1, { date: '2026-10-23', title: 'New' }), pendingUpdate(3, e3, { date: '2026-10-25' })]), ctx);
    const d = (date: string) => out.days.find((x) => x.date === date)!;
    expect(d('2026-10-23')).toMatchObject({ entryCount: 1, hasEntry: true, titles: ['New'] });
    expect(d('2026-10-22')).toMatchObject({ entryCount: 0, hasEntry: false, titles: [] });
    expect(d('2026-10-25')).toMatchObject({ entryCount: 1, hasEntry: true, titles: ['Entry 3'] });
    const gone = overlayMonth(month, fx([pendingDelete(3, e3)]), ctx);
    expect(gone.days.find((x) => x.date === '2026-10-22')).toMatchObject({ entryCount: 0, hasEntry: false, mood: 6 });
  });

  it('recomputes the averages only when the day entries are known', () => {
    const e3 = entry(3, { date: '2026-10-22', mood: 6 });
    const known = overlayMonth(month, fx([pendingUpdate(3, e3, { mood: 2 })]), { ...ctx, dayEntries: (date) => (date === '2026-10-22' ? [e3] : null) });
    expect(known.days.find((x) => x.date === '2026-10-22')?.mood).toBe(2);
    const unknown = overlayMonth(month, fx([pendingUpdate(3, e3, { mood: 2 })]), ctx);
    expect(unknown.days.find((x) => x.date === '2026-10-22')?.mood).toBe(6);
  });

  it('habits: a completed log counts; a habit created offline raises the total up to today', () => {
    const set: QueuedOp = { op: { ...base, opId: oid(), kind: 'log.set', habit: { id: 1 }, date: '2026-10-23', payload: { value: 2, note: '' } }, record: 'l', chain: 'log:i:1:2026-10-23', hint: { displayId: 1, prevValue: null }, queuedAt: 1 };
    const create: QueuedOp = { op: { ...base, opId: oid(), kind: 'habit.create', clientId: oid(), payload: { name: 'New', description: '', target: 1, unit: '', frequency: 'daily', reminderTime: null, reminderEnabled: false } }, record: 'c:x', chain: 'habits', localId: -2, hint: { displayId: -2 }, queuedAt: 1 };
    const out = overlayMonth(month, fx([set, create]), ctx);
    expect(out.days.find((x) => x.date === '2026-10-23')).toMatchObject({ habitsCompleted: 1, habitsTotal: 3 });
    expect(out.days.find((x) => x.date === '2026-10-30')?.habitsTotal).toBe(2);
    const range = overlayDays([], '2026-10-20', '2026-10-25', fx([pendingCreate(-1, { date: '2026-10-21' })]), ctx);
    expect(range).toHaveLength(1);
    expect(range[0]).toMatchObject({ date: '2026-10-21', entryCount: 1 });
  });
});

describe('overlay: habits and progress', () => {
  const list = [habit(1), habit(2, { isArchived: true })];

  it('list: create appends, patch edits, archive moves out of the active list', () => {
    const create: QueuedOp = { op: { ...base, opId: oid(), kind: 'habit.create', clientId: oid(), payload: { name: 'New', description: '', target: 1, unit: '', frequency: 'weekly', reminderTime: null, reminderEnabled: false } }, record: 'c:y', chain: 'habits', localId: -3, hint: { displayId: -3, nextSortOrder: 9 }, queuedAt: 1 };
    const patch: QueuedOp = { op: { ...base, opId: oid(), kind: 'habit.update', target: { id: 1 }, payload: { name: 'Renamed', description: '', target: 5, unit: 'x', frequency: 'daily', reminderTime: null, reminderEnabled: false } }, record: 'i:1', chain: 'habits', hint: { displayId: 1 }, queuedAt: 1 };
    const archive: QueuedOp = { op: { ...base, opId: oid(), kind: 'habit.archive', target: { id: 1 }, payload: { archived: true } }, record: 'i:1', chain: 'habits', hint: { displayId: 1 }, queuedAt: 1 };
    const active = overlayHabits(list, false, fx([create, patch]));
    expect(active.map((h) => [h.id, h.name])).toEqual([[1, 'Renamed'], [-3, 'New']]);
    const archived = overlayHabits(list, true, fx([archive]));
    expect(archived.find((h) => h.id === 1)?.isArchived).toBe(true);
    expect(overlayHabits(list, false, fx([archive])).map((h) => h.id)).toEqual([]);
  });

  it('progress: a log sets today, moves the week total and the completion', () => {
    const progress: HabitWithProgress[] = [{ habit: habit(1, { target: 2 }), today: null, currentStreak: 3, bestStreak: 5, weekTotal: 4, completedLast30: 10, completionRate30: 0.5, targetMet: false }];
    const set: QueuedOp = { op: { ...base, opId: oid(), kind: 'log.set', habit: { id: 1 }, date: '2026-10-23', payload: { value: 2, note: 'done' } }, record: 'l', chain: 'log:i:1:2026-10-23', hint: { displayId: 1, prevValue: null, habit: { name: 'Habit 1', unit: 'x', target: 2, frequency: 'daily' } }, queuedAt: 1 };
    const out = overlayProgress(progress, '2026-10-23', fx([set]), { firstDayOfWeek: 0 });
    expect(out[0]).toMatchObject({ weekTotal: 6, completedLast30: 11, targetMet: true, currentStreak: 3, today: { value: 2, completed: true, note: 'done' } });
    const del: QueuedOp = { op: { ...base, opId: oid(), kind: 'log.delete', habit: { id: 1 }, date: '2026-10-23' }, record: 'l', chain: 'log:i:1:2026-10-23', hint: { displayId: 1, prevValue: 2 }, queuedAt: 1 };
    const after = overlayProgress(out, '2026-10-23', fx([del]), { firstDayOfWeek: 0 });
    expect(after[0]).toMatchObject({ weekTotal: 4, today: null, targetMet: false });
  });
});

describe('overlay: home, settings, counts', () => {
  it('home: today count, total and last entry follow the effects', () => {
    const home: HomeSummary = { today: '2026-10-23', todayWeekday: 'Friday', todayEntryCount: 0, entryStreak: 2, lastEntry: entryToSummary(entry(3, { date: '2026-10-22' })), weekMoodAvg: 6, weekEnergyAvg: null, weekStressAvg: null, weekSleepAvg: null, habitsToday: [], topInsight: null, totalEntries: 3 };
    const out = overlayHome(home, fx([pendingCreate(-1, { date: '2026-10-23', title: 'Fresh' })]), { today: '2026-10-23', firstDayOfWeek: 0 });
    expect(out).toMatchObject({ todayEntryCount: 1, totalEntries: 4, lastEntry: { id: -1, title: 'Fresh' }, weekMoodAvg: 6, entryStreak: 2 });
    const gone = overlayHome(home, fx([pendingDelete(3, entry(3, { date: '2026-10-22' }))]), { today: '2026-10-23', firstDayOfWeek: 0 });
    expect(gone).toMatchObject({ totalEntries: 2, lastEntry: null });
  });

  it('settings: the merged patch applied; counts move with the entries', () => {
    const patch: QueuedOp = { op: { ...base, opId: oid(), kind: 'settings.patch', payload: { theme: 'dark' } }, record: 'settings', chain: 'settings', queuedAt: 1 };
    const s: AppSettings = { ...DEFAULT_APP_SETTINGS };
    expect(overlaySettings(s, fx([patch])).theme).toBe('dark');
    const e3 = entry(3, { tags: ['walk', 'old'] });
    const counts = overlayCounts([{ name: 'walk', count: 2 }, { name: 'old', count: 1 }], 'tags', fx([pendingUpdate(3, e3, { tags: ['walk', 'new'] }), pendingCreate(-1, { tags: ['walk'] })]));
    expect(counts).toEqual([{ name: 'walk', count: 3 }, { name: 'new', count: 1 }]);
    expect(overlayCounts([{ name: 'Park', count: 1 }], 'location', fx([pendingDelete(3, e3)]))).toEqual([]);
  });
});
