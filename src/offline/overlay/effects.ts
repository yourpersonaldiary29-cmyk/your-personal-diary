/**
 * Effects: what the overlay applies to a view (section 4.6 "Overlay"). They are built at read time
 * from (1) journal entries acknowledged after the view was cached and (2) the operations still
 * waiting in the outbox, in that order, and applied by the pure view functions of this folder. They
 * are never stored.
 */
import type { AppSettings, Entry, EntrySummary, Habit, HabitInput, HabitLog } from '@shared/types';
import type { JournalEntry, QueuedOp } from '../types';
import { optimisticEntry, optimisticNewHabit } from '../optimistic';

/** What the device showed for an entry before a change (calendar counts, tag counts, moves). */
export type PrevEntry = Pick<Entry, 'date' | 'title' | 'tags' | 'people' | 'location'>;

export type EntryEffect =
  | { type: 'upsert'; entry: Entry; pending: boolean; prev?: PrevEntry; created: boolean }
  | { type: 'delete'; id: number; pending: boolean; prev?: PrevEntry };

export type HabitEffect =
  /** A whole habit: created offline (pending) or the server's answer (journal). */
  | { type: 'upsert'; habit: Habit; pending: boolean; created: boolean }
  /** The definition fields of an existing habit. */
  | { type: 'patch'; id: number; fields: HabitInput; pending: boolean }
  | { type: 'archive'; id: number; archived: boolean; pending: boolean }
  /** The habit no longer exists on the server (gone). */
  | { type: 'remove'; id: number; pending: boolean };

export type LogEffect =
  | { type: 'set'; habitId: number; date: string; value: number; note: string; prevValue?: number | null; pending: boolean; logId?: number }
  | { type: 'delete'; habitId: number; date: string; prevValue?: number | null; pending: boolean };

export interface Effects {
  entries: EntryEffect[];
  habits: HabitEffect[];
  logs: LogEffect[];
  /** Merged settings patch (null: none). */
  settings: Partial<AppSettings> | null;
}

export const NO_EFFECTS: Effects = { entries: [], habits: [], logs: [], settings: null };

export function hasEffects(e: Effects): boolean {
  return e.entries.length > 0 || e.habits.length > 0 || e.logs.length > 0 || e.settings !== null;
}

export interface OverlayContext {
  /** Today (device local date). */
  today: string;
  firstDayOfWeek: 0 | 1;
  /** Every habit known (cached lists plus effects), by the id the pages see. */
  habits: Map<number, Habit>;
}

export const EXCERPT_LENGTH = 160;

/** First 160 characters of the body with whitespace runs collapsed (code-point safe), as the server does. */
export function makeExcerpt(body: string, length: number = EXCERPT_LENGTH): string {
  const normalised = String(body ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(normalised).slice(0, length).join('');
}

export function entryToSummary(entry: Entry): EntrySummary {
  return {
    id: entry.id,
    date: entry.date,
    time: entry.time,
    title: entry.title,
    excerpt: makeExcerpt(entry.body),
    mood: entry.mood,
    energy: entry.energy,
    stress: entry.stress,
    sleepHours: entry.sleepHours,
    emotions: entry.emotions,
    tags: entry.tags,
  };
}

/** Completion flag of one day's log, as the server computes it. */
export function isLogCompleted(habit: Pick<Habit, 'frequency' | 'target'>, value: number): boolean {
  return habit.frequency === 'daily' ? value >= habit.target : value > 0;
}

/** Mean rounded to two decimals (null when empty), as `getDay` does. */
export function mean2(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  if (!v.length) return null;
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100;
}

export function max2(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  if (!v.length) return null;
  return Math.round(Math.max(...v) * 100) / 100;
}

/** Sort key compare by (date, time, id). */
export function compareDateTimeId(a: { date: string; time: string; id: number }, b: { date: string; time: string; id: number }): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.time !== b.time) return a.time < b.time ? -1 : 1;
  return a.id - b.id;
}

/** Adds ISO days (UTC arithmetic on dates). */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** First day of the week containing `iso` (0 = Sunday, 1 = Monday). */
export function weekStartIso(iso: string, firstDayOfWeek: 0 | 1): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay();
  const back = (dow - firstDayOfWeek + 7) % 7;
  return addDaysIso(iso, -back);
}

// ---------------------------------------------------------------------------
// Building the effects of pending operations and journal entries
// ---------------------------------------------------------------------------


export interface EffectSources {
  /** Operations still in the outbox, in `seq` order. */
  pending: readonly QueuedOp[];
  /** Journal entries acknowledged after the view was cached, oldest first. */
  journal: readonly JournalEntry[];
  /** The id the pages see for a record key (`c:<clientId>` / `i:<id>`): the server id when known, else the local id. */
  idOf: (kind: 'entry' | 'habit', recordKey: string) => number | null;
}

const KEEPS_RECORD = new Set(['applied', 'unchanged', 'conflict-won', 'conflict-lost']);

/** The id a queued operation's record shows (idmap first, then the hints). */
function displayIdOf(src: EffectSources, kind: 'entry' | 'habit', q: QueuedOp): number | null {
  return src.idOf(kind, q.record) ?? q.hint?.displayId ?? q.localId ?? null;
}

/** The record key of the habit a log operation belongs to (`log:<habit key>:<date>` chain). */
function habitKeyOfLog(q: QueuedOp): string {
  const m = /^log:(.+):\d{4}-\d{2}-\d{2}$/.exec(q.chain);
  return m ? m[1] : q.record;
}

/**
 * The effects of (1) the journal entries, then (2) the pending operations, in that order: an
 * acknowledged change is server truth, a pending one is layered on top. Pure.
 */
export function buildEffects(src: EffectSources): Effects {
  const fx: Effects = { entries: [], habits: [], logs: [], settings: null };
  const patchSettings = (p: Partial<AppSettings> | null | undefined) => {
    if (!p) return;
    fx.settings = { ...(fx.settings ?? {}), ...p };
  };

  for (const j of src.journal) {
    const op = j.sent;
    const r = j.result;
    const prev = j.queued.hint?.prev;
    switch (op.kind) {
      case 'entry.create':
      case 'entry.update': {
        if (r.outcome === 'gone') {
          const id = displayIdOf(src, 'entry', j.queued);
          if (id !== null) fx.entries.push({ type: 'delete', id, pending: false, prev });
        } else if (KEEPS_RECORD.has(r.outcome) && r.record && 'body' in r.record) {
          fx.entries.push({ type: 'upsert', entry: r.record as Entry, pending: false, prev, created: op.kind === 'entry.create' });
        }
        break;
      }
      case 'entry.delete': {
        const id = displayIdOf(src, 'entry', j.queued);
        if (r.outcome === 'conflict-lost' && r.record && 'body' in r.record) {
          fx.entries.push({ type: 'upsert', entry: r.record as Entry, pending: false, prev, created: false });
        } else if (r.outcome !== 'stale' && id !== null) {
          fx.entries.push({ type: 'delete', id, pending: false, prev });
        }
        break;
      }
      case 'habit.create':
      case 'habit.update':
      case 'habit.archive': {
        const id = displayIdOf(src, 'habit', j.queued);
        if (r.outcome === 'gone') {
          if (id !== null) fx.habits.push({ type: 'remove', id, pending: false });
        } else if (KEEPS_RECORD.has(r.outcome) && r.record && 'sortOrder' in r.record) {
          fx.habits.push({ type: 'upsert', habit: r.record as Habit, pending: false, created: op.kind === 'habit.create' });
        }
        break;
      }
      case 'log.set':
      case 'log.delete': {
        const habitId = src.idOf('habit', habitKeyOfLog(j.queued)) ?? ('id' in op.habit ? op.habit.id : null);
        if (habitId === null || r.outcome === 'gone' || r.outcome === 'stale') break;
        const log = r.record && 'habitId' in r.record ? (r.record as HabitLog) : null;
        if (log) fx.logs.push({ type: 'set', habitId, date: op.date, value: log.value, note: log.note, prevValue: j.queued.hint?.prevValue, pending: false, logId: log.id });
        else fx.logs.push({ type: 'delete', habitId, date: op.date, prevValue: j.queued.hint?.prevValue, pending: false });
        break;
      }
      case 'settings.patch': {
        if (r.record && 'theme' in r.record) patchSettings(r.record as AppSettings);
        break;
      }
    }
  }

  for (const q of src.pending) {
    const op = q.op;
    switch (op.kind) {
      case 'entry.create':
      case 'entry.update': {
        const id = displayIdOf(src, 'entry', q);
        if (id === null) break;
        const entry = optimisticEntry(q, id);
        if (entry) fx.entries.push({ type: 'upsert', entry, pending: true, prev: q.hint?.prev, created: op.kind === 'entry.create' });
        break;
      }
      case 'entry.delete': {
        const id = displayIdOf(src, 'entry', q);
        if (id !== null) fx.entries.push({ type: 'delete', id, pending: true, prev: q.hint?.prev });
        break;
      }
      case 'habit.create': {
        const id = displayIdOf(src, 'habit', q);
        const habit = id === null ? null : optimisticNewHabit(q, id);
        if (habit) fx.habits.push({ type: 'upsert', habit, pending: true, created: true });
        break;
      }
      case 'habit.update': {
        const id = displayIdOf(src, 'habit', q);
        if (id !== null) fx.habits.push({ type: 'patch', id, fields: op.payload, pending: true });
        break;
      }
      case 'habit.archive': {
        const id = displayIdOf(src, 'habit', q);
        if (id !== null) fx.habits.push({ type: 'archive', id, archived: op.payload.archived, pending: true });
        break;
      }
      case 'log.set': {
        const habitId = src.idOf('habit', habitKeyOfLog(q)) ?? ('id' in op.habit ? op.habit.id : null);
        if (habitId !== null) fx.logs.push({ type: 'set', habitId, date: op.date, value: op.payload.value, note: op.payload.note, prevValue: q.hint?.prevValue, pending: true });
        break;
      }
      case 'log.delete': {
        const habitId = src.idOf('habit', habitKeyOfLog(q)) ?? ('id' in op.habit ? op.habit.id : null);
        if (habitId !== null) fx.logs.push({ type: 'delete', habitId, date: op.date, prevValue: q.hint?.prevValue, pending: true });
        break;
      }
      case 'settings.patch':
        patchSettings(op.payload);
        break;
    }
  }
  return fx;
}
