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

/**
 * `ackedAt`: when the journal entry an acknowledged effect comes from was acknowledged (device ms,
 * `JournalEntry.appliedAt`), so a record cached after it can be told apart; absent on a pending effect.
 */
export type EntryEffect =
  | { type: 'upsert'; entry: Entry; pending: boolean; prev?: PrevEntry; created: boolean; ackedAt?: number }
  | { type: 'delete'; id: number; pending: boolean; prev?: PrevEntry; ackedAt?: number };

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

/**
 * The list text of an entry (`EntrySummary.excerpt`): the body with whitespace runs collapsed and
 * trimmed; a body longer than 160 code points is cut at the end of a word where one is near,
 * loses the weak punctuation before the cut and ends with one `…` (code-point safe: never half of a
 * surrogate pair). The rule and its cases: `shared/excerpt-cases.ts`.
 *
 * THREE copies that must give the same answer for every input: `src/offline/overlay/effects.ts` (this
 * one), `server/src/db/entries-repo.ts` and `server/src/stats/entry-summary.ts` (the offline overlay
 * builds the summary of an entry still waiting on the device exactly as the server will).
 * `server/test/excerpt.test.ts` runs the cases against all three and compares them. That test imports
 * this file, so the server's type check (no DOM library) covers it: this file and what it imports must
 * stay free of browser APIs.
 */
export function makeExcerpt(body: string, length: number = EXCERPT_LENGTH): string {
  // At least 1, so that the result is never longer than `length`.
  const limit = Math.max(1, length);
  const chars = Array.from(String(body ?? '').replace(/\s+/g, ' ').trim());
  if (chars.length <= limit) return chars.join('');
  // Room for the ellipsis, and never inside what the screen shows as one character.
  const at = excerptCharacterStart(chars, limit - 1);
  const cut = chars.slice(0, at);
  const tries = [cut];
  // Inside a word: back to the last space among the last EXCERPT_WORD_BACK code points kept, if any.
  if (chars[at - 1] !== ' ' && chars[at] !== ' ') {
    const space = cut.lastIndexOf(' ');
    if (space >= 0 && space >= cut.length - EXCERPT_WORD_BACK) tries.unshift(cut.slice(0, space));
  }
  for (const part of tries) {
    const end = excerptEnd(part);
    if (end > 0) return part.slice(0, end).join('') + '\u2026';
  }
  // Nothing but weak punctuation: the plain cut.
  return cut.join('').trimEnd() + '\u2026';
}

/** How far back (in code points) a cut inside a word looks for a space. */
const EXCERPT_WORD_BACK = 40;
/**
 * Removed from the end of a cut excerpt: whitespace; full stops, commas, semicolons, colons, dashes
 * and dots (also Arabic, Chinese / Japanese full-width, Hindi and Greek ones); a zero width joiner.
 */
const EXCERPT_WEAK = /[\s.,;:\-\u2010-\u2015\u05be\u2026\u060c\u061b\u3001\u3002\uff0c\uff1a\uff1b\u0964\u0965\u0387\u200d]/u;
/** Also removed: what only ever opens (brackets, low quotation marks, Spanish inverted marks). */
const EXCERPT_OPENING = /[([{\uff08\uff3b\uff5b\u3008\u300a\u300c\u300e\u3010\u3014\u3016\u201a\u201e\u00a1\u00bf]/u;
/** Quotation marks that open in one language and close in another: removed only after a space, an opening mark or nothing. */
const EXCERPT_QUOTE = /["'\u2018\u2019\u201c\u201d\u00ab\u00bb\u2039\u203a]/u;

/** A combining mark (also a variation selector), a zero width joiner, a skin tone, an emoji tag. */
const EXCERPT_EXTEND = /[\p{M}\u200d\u{1f3fb}-\u{1f3ff}\u{e0020}-\u{e007f}]/u;
/** A regional indicator: two of them make a flag. */
const EXCERPT_FLAG = /[\u{1f1e6}-\u{1f1ff}]/u;

/**
 * Whether `chars[i]` belongs to the same character on the screen as `chars[i - 1]`: a mark or a skin
 * tone after it, anything after a zero width joiner or a Hindi virama (a conjunct), the second half of
 * a flag. A space never does.
 */
function excerptJoins(chars: string[], i: number): boolean {
  const c = chars[i];
  const before = chars[i - 1];
  if (c === ' ') return false;
  if (EXCERPT_EXTEND.test(c) || before === '\u200d' || before === '\u094d') return true;
  if (!EXCERPT_FLAG.test(c)) return false;
  let flags = 0;
  for (let j = i - 1; j >= 0 && EXCERPT_FLAG.test(chars[j]); j--) flags++;
  return flags % 2 === 1;
}

/**
 * Where to cut, at or before `at` (in code points), so that no character on the screen loses a part
 * (a letter its marks, an emoji its skin tone or the rest of its sequence, a flag its second half);
 * `at` itself when the whole beginning is one such character.
 */
function excerptCharacterStart(chars: string[], at: number): number {
  let n = at;
  while (n > 0 && excerptJoins(chars, n)) n--;
  return n > 0 ? n : at;
}

/** How many code points of `part` stay before the ellipsis. */
function excerptEnd(part: string[]): number {
  let end = part.length;
  while (end > 0) {
    const last = part[end - 1];
    const before = end > 1 ? part[end - 2] : ' ';
    if (EXCERPT_WEAK.test(last) || EXCERPT_OPENING.test(last)) end--;
    else if (EXCERPT_QUOTE.test(last) && (before === ' ' || EXCERPT_OPENING.test(before))) end--;
    else break;
  }
  return end;
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
          if (id !== null) fx.entries.push({ type: 'delete', id, pending: false, prev, ackedAt: j.appliedAt });
        } else if (KEEPS_RECORD.has(r.outcome) && r.record && 'body' in r.record) {
          fx.entries.push({ type: 'upsert', entry: r.record as Entry, pending: false, prev, created: op.kind === 'entry.create', ackedAt: j.appliedAt });
        }
        break;
      }
      case 'entry.delete': {
        const id = displayIdOf(src, 'entry', j.queued);
        if (r.outcome === 'conflict-lost' && r.record && 'body' in r.record) {
          fx.entries.push({ type: 'upsert', entry: r.record as Entry, pending: false, prev, created: false, ackedAt: j.appliedAt });
        } else if (r.outcome !== 'stale' && id !== null) {
          fx.entries.push({ type: 'delete', id, pending: false, prev, ackedAt: j.appliedAt });
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
