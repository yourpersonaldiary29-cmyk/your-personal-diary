/**
 * The facade (sections 4.3 and 4.6): `offlineAware(name, group)` wraps an api group of
 * src/api/index.ts without changing a signature. With no armed engine every call goes straight to
 * today's function - page tests, local builds and old servers see identical requests.
 *
 * Writes in scope (entries create / update / remove; habits create / update / archive / log /
 * removeLog; settings update): build the operation (its `base` is what the device last showed for
 * the record), store it in the outbox in one strict transaction, kick the replayer, then resolve
 * (a) with the server record when the answer arrives within 2 s, (b) by rejecting with the server's
 * 400 inside that window, or (c) with an optimistic record (negative id for a create).
 *
 * Reads in the allow-list: while the data layer is online, fetch with a 10 s timeout, write the answer
 * through to the cache and apply the still-pending operations; on a lost connection (or from the
 * first failure on) serve the cached view with the overlay; a view that was never cached is
 * synthesised from cached records when possible (`isPartialView`), else `NotCachedError`.
 */
import type { AppSettings, CalendarDay, CalendarMonth, DaySummary, Entry, EntryFilter, EntryInput, EntryPage, Habit, HabitInput, HabitLog, HabitLogInput, HabitWithProgress, HomeSummary, TagCount } from '@shared/types';
import type { SyncOp, SyncOpResult } from '@shared/sync';
import { ApiClientError, isApiClientError, isConnectionError, request, withQuery, type Query } from '@/api/client';
import { DEFAULT_APP_SETTINGS } from '@/constants/settings';
import { tr } from '@/i18n/runtime';
import { todayIso } from '@/utils/dates';
import { randomUuid } from './crypto';
import { NotCachedError, markPartial, type BuiltWrite, type OfflineEngine, type ViewKind } from './engine';
import { markPending, optimisticEntry, optimisticHabit, optimisticLog, optimisticNewHabit, optimisticSettings } from './optimistic';
import { overlayDays, overlayMonth } from './overlay/calendar';
import { overlayDay } from './overlay/days';
import { entryToSummary, type Effects } from './overlay/effects';
import { overlayEntry, overlayEntryPage, synthesiseEntryPage } from './overlay/entries';
import { overlayHabits, overlayProgress } from './overlay/habits';
import { overlayHome } from './overlay/home';
import { overlayCounts } from './overlay/meta';
import { overlaySettings } from './overlay/settings';
import type { QueuedOp } from './types';

export const ONLINE_CONFIRM_MS = 2000;
export const GET_TIMEOUT_MS = 10_000;

export type GroupName = 'entries' | 'habits' | 'settings' | 'calendar' | 'insights';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

let currentEngine: (() => OfflineEngine | null) | null = null;

/** ./index.ts installs the accessor of the armed engine; null means "pass every call through". */
export function setEngineAccessor(accessor: (() => OfflineEngine | null) | null): void {
  currentEngine = accessor;
}

function engine(): OfflineEngine | null {
  const e = currentEngine?.() ?? null;
  return e && !e.isStopped ? e : null;
}

/** Wraps the in-scope methods of a group; everything else is returned as it is. */
export function offlineAware<G extends object>(name: GroupName, group: G): G {
  const spec = SPECS[name];
  const out: Record<string, unknown> = { ...(group as Record<string, unknown>) };
  for (const [method, fn] of Object.entries(group as Record<string, unknown>)) {
    const handler = spec?.[method];
    if (typeof fn === 'function' && handler) out[method] = (...args: unknown[]) => handler(fn as AnyFn, ...args);
  }
  return out as G;
}

type Handler = (original: AnyFn, ...args: unknown[]) => Promise<unknown>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

interface ReadSpec<T> {
  path: string;
  query?: Query;
  view: ViewKind;
  /** The date a progress view is for (the seen map of logs). */
  date?: string;
  overlay: (e: OfflineEngine, value: T, fx: Effects) => Promise<T> | T;
  /** A view synthesised from cached records when the cache misses (null: not possible). */
  synthesise?: (e: OfflineEngine, fx: Effects) => Promise<T | null>;
  deleteOn404?: boolean;
}

async function cachedRead<T>(spec: ReadSpec<T>, original: () => Promise<T>): Promise<T> {
  const e = engine();
  if (!e) return original();
  const url = withQuery(spec.path, spec.query);
  if (!e.connectivity.dataOffline) {
    try {
      const fresh = await request<T>(spec.path, { query: spec.query, timeoutMs: GET_TIMEOUT_MS });
      const arrivedAt = e.now();
      await e.cache.put(url, fresh, todayIso()).catch(() => undefined);
      e.rememberView(spec.view, fresh, { date: spec.date });
      const fx = await e.effects(arrivedAt);
      const shown = await spec.overlay(e, fresh, fx);
      if (shown !== fresh) e.rememberView(spec.view, shown, { date: spec.date });
      return shown;
    } catch (err) {
      if (spec.deleteOn404 && isApiClientError(err) && err.status === 404) {
        await e.cache.delete(url).catch(() => undefined);
        throw err;
      }
      if (!isConnectionError(err)) throw err;
      e.connectivity.noteFailure();
    }
  }
  const hit = await e.cache.get<T>(url);
  if (hit) {
    const fx = await e.effects(hit.cachedAt);
    const shown = await spec.overlay(e, hit.value, fx);
    e.rememberView(spec.view, shown, { date: spec.date });
    return shown;
  }
  if (spec.synthesise) {
    const fx = await e.effects(0);
    const synthesised = await spec.synthesise(e, fx);
    if (synthesised) {
      e.rememberView(spec.view, synthesised, { date: spec.date });
      return markPartial(synthesised as object) as T;
    }
  }
  throw new NotCachedError();
}

function notFound(): ApiClientError {
  return new ApiClientError(404, { code: 'NOT_FOUND', message: tr('shell.sync.notCachedYet') });
}

/** Every cached full entry (recent ones and the LRU of older ones), newest first. */
async function cachedEntries(e: OfflineEngine): Promise<Entry[]> {
  const a = await e.cache.allOf<Entry>('entry30');
  const b = await e.cache.allOf<Entry>('entry');
  const days = await e.cache.allOf<DaySummary>('day');
  const byId = new Map<number, Entry>();
  for (const d of days) for (const en of d.value.entries) byId.set(en.id, en);
  for (const c of [...a, ...b]) byId.set(c.value.id, c.value);
  return [...byId.values()];
}

async function calendarContext(e: OfflineEngine, fx: Effects) {
  const ctx = await e.context(fx);
  const cacheByDate = new Map<string, Entry[] | null>();
  // The overlay is synchronous: preload the cached day views of the dates the effects touch.
  const dates = new Set<string>();
  for (const ef of fx.entries) {
    if (ef.prev) dates.add(ef.prev.date);
    if (ef.type === 'upsert') dates.add(ef.entry.date);
  }
  for (const date of dates) cacheByDate.set(date, await e.cachedDayEntries(date));
  return { ...ctx, dayEntries: (date: string) => cacheByDate.get(date) ?? null };
}

const readEntry = (original: AnyFn, id: number) => {
  const e = engine();
  if (!e) return original(id);
  const run = async (): Promise<Entry> => {
    const serverId = e.idmap.serverIdOf(id);
    if (serverId === null) {
      // A record created on this device and not uploaded yet: only the outbox can answer.
      const fx = await e.effects(0);
      const o = overlayEntry(id, fx);
      if (o.kind === 'entry') {
        e.rememberEntry(o.entry);
        return o.entry;
      }
      throw notFound();
    }
    const spec: ReadSpec<Entry> = {
      path: `/api/entries/${serverId}`,
      view: 'entry',
      deleteOn404: true,
      overlay: (_e, value, fx) => {
        const o = overlayEntry(serverId, fx);
        if (o.kind === 'notFound') throw notFound();
        return o.kind === 'entry' ? o.entry : value;
      },
      synthesise: async (_e, fx) => {
        const o = overlayEntry(serverId, fx);
        if (o.kind === 'entry') return o.entry;
        if (o.kind === 'notFound') throw notFound();
        const cached = (await cachedEntries(e)).find((en) => en.id === serverId);
        return cached ?? null;
      },
    };
    const entry = await cachedRead(spec, () => original(serverId));
    return entry.id === serverId && id < 0 ? entry : entry;
  };
  return run();
};

const readEntries = (original: AnyFn, filter: EntryFilter = {}) =>
  cachedRead<EntryPage>(
    {
      path: '/api/entries',
      query: { ...filter },
      view: 'entries',
      overlay: (_e, page, fx) => overlayEntryPage(page, filter, fx),
      synthesise: async (e, fx) => synthesiseEntryPage(await cachedEntries(e), filter, fx),
    },
    () => original(filter),
  );

const readDay = (original: AnyFn, date: string) =>
  cachedRead<DaySummary>(
    {
      path: `/api/entries/day/${date}`,
      view: 'day',
      overlay: async (e, day, fx) => overlayDay(day, date, fx, await e.context(fx)),
      synthesise: async (e, fx) => {
        const entries = (await cachedEntries(e)).filter((en) => en.date === date);
        const progress = date === todayIso() ? await e.cache.get<HabitWithProgress[]>(withQuery('/api/habits/progress', { date })) : null;
        const habitLogs = (progress?.value ?? [])
          .filter((p) => p.today)
          .map((p) => ({ log: p.today as HabitLog, habitName: p.habit.name, unit: p.habit.unit, target: p.habit.target, frequency: p.habit.frequency }));
        const base: DaySummary = { date, entries, habitLogs, moodAvg: null, energyAvg: null, stressAvg: null, sleepHours: null };
        return overlayDay(base, date, fx, await e.context(fx));
      },
    },
    () => original(date),
  );

const readCounts = (field: 'tags' | 'people' | 'location', path: string) => (original: AnyFn) =>
  cachedRead<TagCount[]>({ path, view: 'counts', overlay: (_e, list, fx) => overlayCounts(list, field, fx), synthesise: async (_e, fx) => overlayCounts([], field, fx) }, () => original());

const readHabits = (original: AnyFn, includeArchived = false) =>
  cachedRead<Habit[]>(
    {
      path: '/api/habits',
      query: { includeArchived },
      view: 'habits',
      overlay: (_e, list, fx) => overlayHabits(list, includeArchived, fx),
      synthesise: async (e, fx) => {
        const lists = await e.cache.allOf<Habit[]>('habits');
        if (!lists.length) return overlayHabits([], includeArchived, fx);
        const merged = new Map<number, Habit>();
        for (const l of lists) for (const h of l.value) merged.set(h.id, h);
        return overlayHabits([...merged.values()], includeArchived, fx);
      },
    },
    () => original(includeArchived),
  );

const readProgress = (original: AnyFn, date: string) =>
  cachedRead<HabitWithProgress[]>(
    {
      path: '/api/habits/progress',
      query: { date },
      view: 'progress',
      date,
      overlay: (e, list, fx) => overlayProgress(list, date, fx, { firstDayOfWeek: e.firstDayOfWeek() }),
      synthesise: async (e, fx) => {
        const lists = await e.cache.allOf<Habit[]>('habits');
        if (!lists.length) return null;
        const merged = new Map<number, Habit>();
        for (const l of lists) for (const h of l.value) if (!h.isArchived) merged.set(h.id, h);
        const base: HabitWithProgress[] = [...merged.values()].map((habit) => ({ habit, today: null, currentStreak: 0, bestStreak: 0, weekTotal: 0, completedLast30: 0, completionRate30: 0, targetMet: false }));
        return overlayProgress(base, date, fx, { firstDayOfWeek: e.firstDayOfWeek() });
      },
    },
    () => original(date),
  );

const readTemplates = (original: AnyFn) => cachedRead<unknown[]>({ path: '/api/habits/templates', view: 'templates', overlay: (_e, v) => v }, () => original());

const readStatus = (original: AnyFn, from: string, to: string) =>
  cachedRead<unknown[]>({ path: '/api/habits/status', query: { from, to }, view: 'status', overlay: (_e, v) => v }, () => original(from, to));

const readMonth = (original: AnyFn, year: number, month: number) =>
  cachedRead<CalendarMonth>(
    {
      path: '/api/calendar/month',
      query: { year, month },
      view: 'month',
      overlay: async (e, m, fx) => overlayMonth(m, fx, await calendarContext(e, fx)),
      synthesise: async (e, fx) => {
        const mm = String(month).padStart(2, '0');
        const daysIn = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const entries = (await cachedEntries(e)).filter((en) => en.date.startsWith(`${year}-${mm}-`));
        const days: CalendarDay[] = [];
        const today = todayIso();
        for (let d = 1; d <= daysIn; d++) {
          const date = `${year}-${mm}-${String(d).padStart(2, '0')}`;
          const ofDay = entries.filter((en) => en.date === date);
          days.push({ date, mood: null, energy: null, stress: null, sleepHours: null, hasEntry: ofDay.length > 0, entryCount: ofDay.length, habitsCompleted: 0, habitsTotal: 0, titles: ofDay.map((en) => en.title).filter(Boolean) });
          void today;
        }
        return overlayMonth({ year, month, days }, fx, await calendarContext(e, fx));
      },
    },
    () => original(year, month),
  );

const readRange = (original: AnyFn, from: string, to: string) =>
  cachedRead<CalendarDay[]>(
    { path: '/api/calendar/range', query: { from, to }, view: 'range', overlay: async (e, days, fx) => overlayRange(days, from, to, fx, await calendarContext(e, fx)) },
    () => original(from, to),
  );

function overlayRange(days: CalendarDay[], from: string, to: string, fx: Effects, ctx: Awaited<ReturnType<typeof calendarContext>>): CalendarDay[] {
  return overlayDays(days, from, to, fx, ctx).filter((d) => d.entryCount > 0 || d.habitsCompleted > 0 || days.some((o) => o.date === d.date));
}

const readHome = (original: AnyFn) =>
  cachedRead<HomeSummary>(
    {
      path: '/api/home',
      view: 'home',
      overlay: (e, home, fx) => overlayHome(home, fx, { today: todayIso(), firstDayOfWeek: e.firstDayOfWeek() }),
      synthesise: async (e, fx) => {
        const today = todayIso();
        const entries = (await cachedEntries(e)).sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.time !== b.time ? (a.time < b.time ? -1 : 1) : a.id - b.id));
        const progress = await e.cache.get<HabitWithProgress[]>(withQuery('/api/habits/progress', { date: today }));
        const base: HomeSummary = {
          today,
          todayWeekday: '',
          todayEntryCount: entries.filter((en) => en.date === today).length,
          entryStreak: 0,
          lastEntry: entries.length ? entryToSummary(entries[entries.length - 1]) : null,
          weekMoodAvg: null,
          weekEnergyAvg: null,
          weekStressAvg: null,
          weekSleepAvg: null,
          habitsToday: progress?.value ?? [],
          topInsight: null,
          totalEntries: entries.length,
        };
        return overlayHome(base, fx, { today, firstDayOfWeek: e.firstDayOfWeek() });
      },
    },
    () => original(),
  );

const readSettings = (original: AnyFn) =>
  cachedRead<AppSettings>(
    { path: '/api/settings', view: 'settings', overlay: (_e, s, fx) => overlaySettings(s, fx), synthesise: async (e, fx) => overlaySettings(e.seenSettings()?.settings ?? { ...DEFAULT_APP_SETTINGS }, fx) },
    () => original(),
  );

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

interface WriteSpec<T> {
  build: (e: OfflineEngine) => Promise<BuiltWrite>;
  /** What the page gets while the change is on the device (after the row's seq is known). */
  optimistic: (q: QueuedOp) => T;
  /** What the page gets from the server's answer. */
  fromResult: (result: SyncOpResult, q: QueuedOp) => T;
}

async function queuedWrite<T>(spec: WriteSpec<T>, original: () => Promise<T>): Promise<T> {
  const e = engine();
  if (!e || e.readOnly) return original();
  const built = await spec.build(e);
  const outcome = await e.enqueue(built);
  if (outcome.action === 'drop-both') return spec.optimistic(outcome.q);
  if (e.connectivity.dataOffline) {
    void e.connectivity.probeNow('write');
    return spec.optimistic(outcome.q);
  }
  const ack = await e.replayer.awaitAck(outcome.seq, ONLINE_CONFIRM_MS);
  if (ack.kind === 'ack') return spec.fromResult(ack.result, ack.q);
  if (ack.kind === 'rejected') throw ack.error;
  return spec.optimistic(outcome.q);
}

function common(e: OfflineEngine): Pick<SyncOp, 'v' | 'account' | 'opId' | 'editedAt' | 'epoch'> {
  return { v: 1, account: e.userId, opId: randomUuid(), editedAt: e.clock.editedAt(), epoch: e.epoch };
}

function prevOf(entry: Pick<Entry, 'date' | 'title' | 'tags' | 'people' | 'location'>): NonNullable<QueuedOp['hint']>['prev'] {
  return { date: entry.date, title: entry.title, tags: entry.tags, people: entry.people, location: entry.location };
}

/** The base of an entry operation and the display facts, from what the device showed (section 4.3 step 1). */
function entryBase(e: OfflineEngine, id: number): { base?: string; baseOp?: string; hint: NonNullable<QueuedOp['hint']> } {
  const seen = e.seenEntry(id);
  const hint: NonNullable<QueuedOp['hint']> = { displayId: id };
  if (!seen) return { hint };
  if (seen.kind === 'summary') {
    hint.title = seen.summary.title;
    hint.date = seen.summary.date;
    hint.prev = { date: seen.summary.date, title: seen.summary.title, tags: seen.summary.tags, people: [], location: '' };
    return { hint };
  }
  hint.createdAt = seen.entry.createdAt;
  hint.title = seen.entry.title;
  hint.date = seen.entry.date;
  hint.prev = prevOf(seen.entry);
  return seen.opId ? { baseOp: seen.opId, hint } : { base: seen.entry.updatedAt, hint };
}

function entryRef(e: OfflineEngine, id: number) {
  const ref = e.idmap.ref('entry', id);
  const key = e.idmap.recordKey('entry', id);
  if (!ref || !key) throw notFound();
  return { ref, key };
}

const entryResult = (result: SyncOpResult, q: QueuedOp): Entry => {
  if (result.record && 'body' in result.record) return result.record as Entry;
  const id = q.hint?.displayId ?? q.localId ?? 0;
  return { ...(q.op as Extract<SyncOp, { kind: 'entry.create' | 'entry.update' }>).payload, id, createdAt: q.hint?.createdAt ?? q.op.editedAt, updatedAt: q.op.editedAt };
};

const writeEntryCreate = (original: AnyFn, input: EntryInput) =>
  queuedWrite<Entry>(
    {
      build: async (e) => {
        const clientId = randomUuid();
        const localId = await e.idmap.allocate();
        const op: SyncOp = { ...common(e), kind: 'entry.create', clientId, payload: input };
        const q: QueuedOp = { op, chain: `entry:c:${clientId}`, record: `c:${clientId}`, localId, hint: { createdAt: op.editedAt, displayId: localId }, queuedAt: e.now() };
        return { q, deps: [], idmap: [{ localId, kind: 'entry', clientId }] };
      },
      optimistic: (q) => optimisticEntry(q, q.localId ?? q.hint?.displayId ?? -1) as Entry,
      fromResult: entryResult,
    },
    () => original(input),
  );

const writeEntryUpdate = (original: AnyFn, id: number, input: EntryInput) =>
  queuedWrite<Entry>(
    {
      build: async (e) => {
        const { ref, key } = entryRef(e, id);
        const { base, baseOp, hint } = entryBase(e, id);
        const op: SyncOp = { ...common(e), kind: 'entry.update', target: ref, ...(base !== undefined ? { base } : {}), payload: input };
        const q: QueuedOp = { op, chain: `entry:${key}`, record: key, hint, queuedAt: e.now(), ...(baseOp ? { baseOp } : {}) };
        return { q, deps: [], idmap: [] };
      },
      optimistic: (q) => optimisticEntry(q, id) as Entry,
      fromResult: entryResult,
    },
    () => original(id, input),
  );

const writeEntryRemove = (original: AnyFn, id: number) =>
  queuedWrite<void>(
    {
      build: async (e) => {
        const { ref, key } = entryRef(e, id);
        const { base, baseOp, hint } = entryBase(e, id);
        const op: SyncOp = { ...common(e), kind: 'entry.delete', target: ref, ...(base !== undefined ? { base } : {}) };
        const q: QueuedOp = { op, chain: `entry:${key}`, record: key, hint, queuedAt: e.now(), ...(baseOp ? { baseOp } : {}) };
        return { q, deps: [], idmap: [] };
      },
      optimistic: () => undefined,
      fromResult: () => undefined,
    },
    () => original(id),
  );

function habitRef(e: OfflineEngine, id: number) {
  const ref = e.idmap.ref('habit', id);
  const key = e.idmap.recordKey('habit', id);
  if (!ref || !key) throw notFound();
  return { ref, key };
}

/** The outbox row of the pending create of a habit created on this device (a log on it must wait for it). */
function habitCreateSeq(e: OfflineEngine, key: string): number[] {
  if (!key.startsWith('c:')) return [];
  const row = e.outbox.rows.find((l) => l.q.op.kind === 'habit.create' && l.q.record === key);
  return row ? [row.row.seq] : [];
}

const habitResult = (result: SyncOpResult, q: QueuedOp): Habit => {
  if (result.record && 'sortOrder' in result.record) return result.record as Habit;
  const seenHabit = (q.op.kind === 'habit.create' ? null : null) as Habit | null;
  return seenHabit ?? (optimisticNewHabit(q, q.localId ?? q.hint?.displayId ?? -1) as Habit);
};

const writeHabitCreate = (original: AnyFn, input: HabitInput) =>
  queuedWrite<Habit>(
    {
      build: async (e) => {
        const clientId = randomUuid();
        const localId = await e.idmap.allocate();
        let maxOrder = -1;
        for (const v of e.seen.values()) if (v.kind === 'habit' && v.habit.sortOrder > maxOrder) maxOrder = v.habit.sortOrder;
        const op: SyncOp = { ...common(e), kind: 'habit.create', clientId, payload: input };
        const q: QueuedOp = { op, chain: 'habits', record: `c:${clientId}`, localId, hint: { createdAt: op.editedAt, displayId: localId, nextSortOrder: maxOrder + 1 }, queuedAt: e.now() };
        return { q, deps: [], idmap: [{ localId, kind: 'habit', clientId }] };
      },
      optimistic: (q) => optimisticNewHabit(q, q.localId ?? -1) as Habit,
      fromResult: habitResult,
    },
    () => original(input),
  );

function shownHabit(e: OfflineEngine, id: number): Habit {
  return e.seenHabit(id)?.habit ?? { id, name: '', description: '', target: 1, unit: '', frequency: 'daily', reminderTime: null, reminderEnabled: false, isArchived: false, sortOrder: 0, createdAt: new Date(e.now()).toISOString() };
}

const writeHabitUpdate = (original: AnyFn, id: number, input: HabitInput) =>
  queuedWrite<Habit>(
    {
      build: async (e) => {
        const { ref, key } = habitRef(e, id);
        const seen = e.seenHabit(id);
        const h = shownHabit(e, id);
        const base = seen && !seen.opId ? { name: h.name, description: h.description, target: h.target, unit: h.unit, frequency: h.frequency, reminderTime: h.reminderTime ?? null, reminderEnabled: h.reminderEnabled } : undefined;
        const op: SyncOp = { ...common(e), kind: 'habit.update', target: ref, ...(base ? { base } : {}), payload: input };
        const q: QueuedOp = { op, chain: 'habits', record: key, hint: { displayId: id, createdAt: h.createdAt, sortOrder: h.sortOrder, isArchived: h.isArchived, habit: { name: h.name, unit: h.unit, target: h.target, frequency: h.frequency } }, queuedAt: e.now(), ...(seen?.opId ? { baseOp: seen.opId } : {}) };
        return { q, deps: [], idmap: [] };
      },
      optimistic: (q) => {
        const e = engine();
        return optimisticHabit(q, e ? shownHabit(e, id) : { ...(q.op as Extract<SyncOp, { kind: 'habit.update' }>).payload, id, isArchived: false, sortOrder: 0, createdAt: q.op.editedAt });
      },
      fromResult: (result, q) => (result.record && 'sortOrder' in result.record ? (result.record as Habit) : (optimisticHabit(q, shownHabit(engine() as OfflineEngine, id)) as Habit)),
    },
    () => original(id, input),
  );

const writeHabitArchive = (original: AnyFn, id: number, archived: boolean) =>
  queuedWrite<Habit>(
    {
      build: async (e) => {
        const { ref, key } = habitRef(e, id);
        const seen = e.seenHabit(id);
        const h = shownHabit(e, id);
        const op: SyncOp = { ...common(e), kind: 'habit.archive', target: ref, ...(seen && !seen.opId ? { base: { archived: h.isArchived } } : {}), payload: { archived } };
        const q: QueuedOp = { op, chain: 'habits', record: key, hint: { displayId: id, isArchived: h.isArchived, habit: { name: h.name, unit: h.unit, target: h.target, frequency: h.frequency } }, queuedAt: e.now(), ...(seen?.opId ? { baseOp: seen.opId } : {}) };
        return { q, deps: [], idmap: [] };
      },
      optimistic: (q) => {
        const e = engine();
        return optimisticHabit(q, e ? shownHabit(e, id) : { id, name: '', description: '', target: 1, unit: '', frequency: 'daily', reminderTime: null, reminderEnabled: false, isArchived: archived, sortOrder: 0, createdAt: q.op.editedAt });
      },
      fromResult: (result, q) => (result.record && 'sortOrder' in result.record ? (result.record as Habit) : (optimisticHabit(q, shownHabit(engine() as OfflineEngine, id)) as Habit)),
    },
    () => original(id, archived),
  );

const writeHabitLog = (original: AnyFn, input: HabitLogInput) =>
  queuedWrite<HabitLog>(
    {
      build: async (e) => {
        const { ref, key } = habitRef(e, input.habitId);
        const h = shownHabit(e, input.habitId);
        const seenLog = e.seenLog(input.habitId, input.date);
        const localId = await e.idmap.allocate();
        const payload = { value: input.value, note: input.note ?? '' };
        const base = seenLog && !seenLog.opId ? (seenLog.log ? { value: seenLog.log.value, note: seenLog.log.note } : null) : undefined;
        const op: SyncOp = { ...common(e), kind: 'log.set', habit: ref, date: input.date, ...(base !== undefined ? { base } : {}), payload };
        const q: QueuedOp = {
          op,
          chain: `log:${key}:${input.date}`,
          record: `l:${key}:${input.date}`,
          localId,
          hint: { displayId: input.habitId, prevValue: seenLog ? (seenLog.log?.value ?? null) : undefined, habit: { name: h.name, unit: h.unit, target: h.target, frequency: h.frequency } },
          queuedAt: e.now(),
          ...(seenLog?.opId ? { baseOp: seenLog.opId } : {}),
        };
        return { q, deps: habitCreateSeq(e, key), idmap: [] };
      },
      optimistic: (q) => optimisticLog(q, input.habitId, q.localId ?? -1) as HabitLog,
      fromResult: (result, q) => (result.record && 'habitId' in result.record ? (result.record as HabitLog) : (optimisticLog(q, input.habitId, q.localId ?? -1) as HabitLog)),
    },
    () => original(input),
  );

const writeHabitRemoveLog = (original: AnyFn, habitId: number, date: string) =>
  queuedWrite<void>(
    {
      build: async (e) => {
        const { ref, key } = habitRef(e, habitId);
        const h = shownHabit(e, habitId);
        const seenLog = e.seenLog(habitId, date);
        const base = seenLog && !seenLog.opId ? (seenLog.log ? { value: seenLog.log.value, note: seenLog.log.note } : null) : undefined;
        const op: SyncOp = { ...common(e), kind: 'log.delete', habit: ref, date, ...(base !== undefined ? { base } : {}) };
        const q: QueuedOp = {
          op,
          chain: `log:${key}:${date}`,
          record: `l:${key}:${date}`,
          hint: { displayId: habitId, prevValue: seenLog ? (seenLog.log?.value ?? null) : undefined, habit: { name: h.name, unit: h.unit, target: h.target, frequency: h.frequency } },
          queuedAt: e.now(),
          ...(seenLog?.opId ? { baseOp: seenLog.opId } : {}),
        };
        return { q, deps: habitCreateSeq(e, key), idmap: [] };
      },
      optimistic: () => undefined,
      fromResult: () => undefined,
    },
    () => original(habitId, date),
  );

const writeSettings = (original: AnyFn, patch: Partial<AppSettings>) =>
  queuedWrite<AppSettings>(
    {
      build: async (e) => {
        const seen = e.seenSettings();
        let base: Partial<AppSettings> | undefined;
        if (seen && !seen.opId) {
          base = {};
          for (const k of Object.keys(patch) as (keyof AppSettings)[]) (base as Record<string, unknown>)[k] = seen.settings[k];
        }
        const op: SyncOp = { ...common(e), kind: 'settings.patch', ...(base ? { base } : {}), payload: patch };
        const q: QueuedOp = { op, chain: 'settings', record: 'settings', queuedAt: e.now(), ...(seen?.opId ? { baseOp: seen.opId } : {}) };
        return { q, deps: [], idmap: [] };
      },
      optimistic: (q) => {
        const e = engine();
        return optimisticSettings(q, e?.seenSettings()?.settings ?? { ...DEFAULT_APP_SETTINGS });
      },
      fromResult: (result, q) => (result.record && 'theme' in result.record ? (result.record as AppSettings) : markPending({ ...(engine()?.seenSettings()?.settings ?? DEFAULT_APP_SETTINGS), ...(q.op as Extract<SyncOp, { kind: 'settings.patch' }>).payload }, q.op.opId)),
    },
    () => original(patch),
  );

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

const SPECS: Record<GroupName, Record<string, Handler>> = {
  entries: {
    list: (o, filter) => readEntries(o, filter as EntryFilter),
    get: (o, id) => readEntry(o, id as number),
    create: (o, input) => writeEntryCreate(o, input as EntryInput),
    update: (o, id, input) => writeEntryUpdate(o, id as number, input as EntryInput),
    remove: (o, id) => writeEntryRemove(o, id as number),
    day: (o, date) => readDay(o, date as string),
    tags: (o) => readCounts('tags', '/api/entries/meta/tags')(o),
    people: (o) => readCounts('people', '/api/entries/meta/people')(o),
    locations: (o) => readCounts('location', '/api/entries/meta/locations')(o),
  },
  habits: {
    list: (o, includeArchived) => readHabits(o, includeArchived as boolean | undefined),
    progress: (o, date) => readProgress(o, date as string),
    templates: (o) => readTemplates(o),
    status: (o, from, to) => readStatus(o, from as string, to as string),
    create: (o, input) => writeHabitCreate(o, input as HabitInput),
    update: (o, id, input) => writeHabitUpdate(o, id as number, input as HabitInput),
    archive: (o, id, archived) => writeHabitArchive(o, id as number, archived as boolean),
    log: (o, input) => writeHabitLog(o, input as HabitLogInput),
    removeLog: (o, id, date) => writeHabitRemoveLog(o, id as number, date as string),
  },
  settings: {
    get: (o) => readSettings(o),
    update: (o, patch) => writeSettings(o, patch as Partial<AppSettings>),
  },
  calendar: {
    month: (o, year, month) => readMonth(o, year as number, month as number),
    range: (o, from, to) => readRange(o, from as string, to as string),
  },
  insights: {
    home: (o) => readHome(o),
  },
};

// ---------------------------------------------------------------------------
// Warm-up (section 4.6)
// ---------------------------------------------------------------------------

export const WARM_UP_MIN_GAP_MS = 15 * 60_000;

/** The GETs of the warm-up, in order (about 16, sequential): settings, habits, today's progress, home, the current month, recent entries, meta. */
export async function warmUp(e: OfflineEngine): Promise<void> {
  const today = todayIso();
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const from = new Date(Date.UTC(y, m - 1, Number(today.slice(8, 10)) - 30)).toISOString().slice(0, 10);
  const gets: { path: string; query?: Query; view: ViewKind; date?: string }[] = [
    { path: '/api/settings', view: 'settings' },
    { path: '/api/habits', query: { includeArchived: false }, view: 'habits' },
    { path: '/api/habits', query: { includeArchived: true }, view: 'habits' },
    { path: '/api/habits/templates', view: 'templates' },
    { path: '/api/habits/progress', query: { date: today }, view: 'progress', date: today },
    { path: '/api/home', view: 'home' },
    { path: '/api/calendar/month', query: { year: y, month: m }, view: 'month' },
    { path: '/api/entries', query: { from, to: today, limit: 500 }, view: 'entries' },
    { path: '/api/entries/meta/tags', view: 'counts' },
    { path: '/api/entries/meta/people', view: 'counts' },
    { path: '/api/entries/meta/locations', view: 'counts' },
  ];
  const recentDates: string[] = [];
  for (const g of gets) {
    if (e.isStopped || e.connectivity.dataOffline) return;
    try {
      const value = await request<unknown>(g.path, { query: g.query, timeoutMs: GET_TIMEOUT_MS });
      await e.cache.put(withQuery(g.path, g.query), value, today);
      e.rememberView(g.view, value, { date: g.date });
      if (g.view === 'entries') {
        for (const s of (value as EntryPage).items) if (!recentDates.includes(s.date) && recentDates.length < 7) recentDates.push(s.date);
      }
    } catch {
      return; // the connection went: the next warm-up tries again
    }
  }
  for (const date of recentDates) {
    if (e.isStopped || e.connectivity.dataOffline) return;
    try {
      const value = await request<DaySummary>(`/api/entries/day/${date}`, { timeoutMs: GET_TIMEOUT_MS });
      await e.cache.put(`/api/entries/day/${date}`, value, today);
      e.rememberView('day', value);
      for (const en of value.entries) await e.cache.put(`/api/entries/${en.id}`, en, today);
    } catch {
      return;
    }
  }
}
