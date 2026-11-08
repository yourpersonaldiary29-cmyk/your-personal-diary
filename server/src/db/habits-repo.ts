/**
 * Habits repository: habit definitions, daily logs (one per habit+date), streak
 * arithmetic and the "progress" view used by the home page and the habits page.
 *
 * Completion rules (shared/types.ts):
 *   daily habit  -> a day is completed when value >= target
 *   weekly habit -> a day "contributed" when value > 0; a week is completed when the
 *                   sum of its values >= target
 *
 * Validation errors are catalogue keys ('server.habits.*') rendered in the request language.
 */
import type {
  Habit,
  HabitDayStatus,
  HabitInput,
  HabitLog,
  HabitLogInput,
  HabitWithProgress,
} from '@shared/types';
import { ApiError } from '../errors';
import { addDays, dayNumber, diffDays, isHHMM, isIsoDate, nowIso, todayIso, weekStart } from '../util/dates';
import type { DiaryDb } from './database';
import { habitFromRow, loadHabits } from './dataset';
import { getSettings } from './settings-repo';

export const HABIT_LIMITS = {
  nameMax: 100,
  descriptionMax: 500,
  unitMax: 30,
  noteMax: 500,
  /** Upper bound for a single log value (keeps sums sane). */
  valueMax: 1_000_000,
} as const;

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface HabitRow {
  id: number;
  name: string;
  description: string;
  target: number;
  unit: string;
  frequency: string;
  reminder_time: string | null;
  reminder_enabled: number;
  is_archived: number;
  sort_order: number;
  created_at: string;
}

interface LogRow {
  id: number;
  habit_id: number;
  date: string;
  value: number;
  completed: number;
  note: string;
}

function logFromRow(r: LogRow): HabitLog {
  return {
    id: Number(r.id),
    habitId: Number(r.habit_id),
    date: String(r.date),
    value: Number(r.value),
    completed: Number(r.completed) === 1,
    note: String(r.note ?? ''),
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function asObject(body: unknown, bodyKey: 'server.habits.bodyObject' | 'server.habits.logBodyObject'): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw ApiError.validation(bodyKey);
  }
  return body as Record<string, unknown>;
}

/** Validates and normalises a habit definition. Throws `ApiError.validation(key, field)`. */
export function validateHabitInput(body: unknown): HabitInput {
  const b = asObject(body, 'server.habits.bodyObject');

  if (typeof b.name !== 'string' || !b.name.trim()) throw ApiError.validation('server.habits.nameRequired', 'name');
  const name = b.name.trim();
  if (name.length > HABIT_LIMITS.nameMax) {
    throw ApiError.validation('server.habits.nameTooLong', 'name', { max: HABIT_LIMITS.nameMax });
  }

  let description = '';
  if (b.description !== undefined && b.description !== null) {
    if (typeof b.description !== 'string') throw ApiError.validation('server.habits.descriptionText', 'description');
    description = b.description.trim();
    if (description.length > HABIT_LIMITS.descriptionMax) {
      throw ApiError.validation('server.habits.descriptionTooLong', 'description', { max: HABIT_LIMITS.descriptionMax });
    }
  }

  if (typeof b.target !== 'number' || !Number.isFinite(b.target) || b.target <= 0) {
    throw ApiError.validation('server.habits.targetPositive', 'target');
  }
  const target = b.target;

  let unit = '';
  if (b.unit !== undefined && b.unit !== null) {
    if (typeof b.unit !== 'string') throw ApiError.validation('server.habits.unitText', 'unit');
    unit = b.unit.trim();
    if (unit.length > HABIT_LIMITS.unitMax) {
      throw ApiError.validation('server.habits.unitTooLong', 'unit', { max: HABIT_LIMITS.unitMax });
    }
  }

  if (b.frequency !== 'daily' && b.frequency !== 'weekly') {
    throw ApiError.validation('server.habits.frequencyInvalid', 'frequency');
  }
  const frequency = b.frequency;

  let reminderTime: string | null = null;
  if (b.reminderTime !== undefined && b.reminderTime !== null && b.reminderTime !== '') {
    if (!isHHMM(b.reminderTime)) throw ApiError.validation('server.habits.reminderTimeFormat', 'reminderTime');
    reminderTime = b.reminderTime;
  }

  let reminderEnabled = false;
  if (b.reminderEnabled !== undefined && b.reminderEnabled !== null) {
    if (typeof b.reminderEnabled !== 'boolean') throw ApiError.validation('server.habits.reminderEnabledBoolean', 'reminderEnabled');
    reminderEnabled = b.reminderEnabled;
  }
  if (reminderEnabled && !reminderTime) {
    throw ApiError.validation('server.habits.reminderTimeRequired', 'reminderTime');
  }

  return { name, description, target, unit, frequency, reminderTime, reminderEnabled };
}

/** Validates a log upsert body. */
export function validateHabitLogInput(body: unknown): HabitLogInput {
  const b = asObject(body, 'server.habits.logBodyObject');
  if (typeof b.habitId !== 'number' || !Number.isInteger(b.habitId) || b.habitId <= 0) {
    throw ApiError.validation('server.habits.habitIdInvalid', 'habitId');
  }
  if (!isIsoDate(b.date)) throw ApiError.validation('server.entries.badDate', 'date');
  if (typeof b.value !== 'number' || !Number.isFinite(b.value) || b.value < 0 || b.value > HABIT_LIMITS.valueMax) {
    throw ApiError.validation('server.habits.valueRange', 'value');
  }
  let note = '';
  if (b.note !== undefined && b.note !== null) {
    if (typeof b.note !== 'string') throw ApiError.validation('server.habits.noteText', 'note');
    note = b.note.trim();
    if (note.length > HABIT_LIMITS.noteMax) {
      throw ApiError.validation('server.habits.noteTooLong', 'note', { max: HABIT_LIMITS.noteMax });
    }
  }
  return { habitId: b.habitId, date: b.date, value: b.value, note };
}

// ---------------------------------------------------------------------------
// Habit CRUD
// ---------------------------------------------------------------------------

function fetchHabitRow(db: DiaryDb, id: number): HabitRow | undefined {
  return db.get<HabitRow>('SELECT * FROM habits WHERE id = ?', [id]);
}

/** Active habits (or all when `includeArchived`), ordered by sortOrder then id. */
export function listHabits(db: DiaryDb, includeArchived: boolean): Habit[] {
  return loadHabits(db, includeArchived);
}

/** One habit or `ApiError.notFound`. */
export function getHabit(db: DiaryDb, id: number): Habit {
  const row = fetchHabitRow(db, id);
  if (!row) throw ApiError.notFound('server.habits.notFound');
  return habitFromRow(row);
}

/**
 * Inserts a habit at the end of the order. `opts.at` (offline sync) is its `createdAt`, so a habit
 * created offline counts the logs written offline (`habitStartDate`); default: now.
 */
export function createHabit(db: DiaryDb, input: HabitInput, opts: { at?: string } = {}): Habit {
  const maxOrder = Number(db.scalar<number>('SELECT COALESCE(MAX(sort_order), -1) FROM habits') ?? -1);
  const { lastId } = db.run(
    `INSERT INTO habits (name, description, target, unit, frequency, reminder_time, reminder_enabled, is_archived, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      input.name,
      input.description,
      input.target,
      input.unit,
      input.frequency,
      input.reminderTime,
      input.reminderEnabled ? 1 : 0,
      maxOrder + 1,
      opts.at ?? nowIso(),
    ],
  );
  return getHabit(db, lastId);
}

export function updateHabit(db: DiaryDb, id: number, input: HabitInput): Habit {
  if (!fetchHabitRow(db, id)) throw ApiError.notFound('server.habits.notFound');
  db.transaction(() => {
    db.run(
      `UPDATE habits
          SET name = ?, description = ?, target = ?, unit = ?, frequency = ?, reminder_time = ?, reminder_enabled = ?
        WHERE id = ?`,
      [
        input.name,
        input.description,
        input.target,
        input.unit,
        input.frequency,
        input.reminderTime,
        input.reminderEnabled ? 1 : 0,
        id,
      ],
    );
    // Target/frequency changes alter what "completed" means: recompute the flag for existing logs.
    recomputeCompleted(db, id, input.target, input.frequency);
  });
  return getHabit(db, id);
}

function recomputeCompleted(db: DiaryDb, habitId: number, target: number, frequency: Habit['frequency']): void {
  if (frequency === 'daily') {
    db.run('UPDATE habit_logs SET completed = CASE WHEN value >= ? THEN 1 ELSE 0 END WHERE habit_id = ?', [target, habitId]);
  } else {
    db.run('UPDATE habit_logs SET completed = CASE WHEN value > 0 THEN 1 ELSE 0 END WHERE habit_id = ?', [habitId]);
  }
}

export function setArchived(db: DiaryDb, id: number, archived: boolean): Habit {
  if (!fetchHabitRow(db, id)) throw ApiError.notFound('server.habits.notFound');
  db.run('UPDATE habits SET is_archived = ? WHERE id = ?', [archived ? 1 : 0, id]);
  return getHabit(db, id);
}

/**
 * Sets the display order: listed ids come first in the given order, every other
 * habit keeps its relative order after them. Returns all habits (archived included).
 */
export function reorderHabits(db: DiaryDb, ids: number[]): Habit[] {
  if (!Array.isArray(ids)) throw ApiError.validation('server.habits.idsRequired', 'ids');
  const seen = new Set<number>();
  for (const id of ids) {
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) throw ApiError.validation('server.habits.idInvalid', 'ids');
    if (seen.has(id)) throw ApiError.validation('server.habits.idsDuplicate', 'ids');
    seen.add(id);
  }
  const existing = loadHabits(db, true);
  const known = new Set(existing.map((h) => h.id));
  for (const id of ids) {
    if (!known.has(id)) throw ApiError.validation('server.habits.idsUnknown', 'ids');
  }
  const ordered = [...ids, ...existing.map((h) => h.id).filter((id) => !seen.has(id))];
  db.transaction(() => {
    ordered.forEach((id, index) => {
      db.run('UPDATE habits SET sort_order = ? WHERE id = ?', [index, id]);
    });
  });
  return loadHabits(db, true);
}

/** Deletes a habit and all of its logs. */
export function deleteHabit(db: DiaryDb, id: number): void {
  if (!fetchHabitRow(db, id)) throw ApiError.notFound('server.habits.notFound');
  db.transaction(() => {
    db.run('DELETE FROM habit_logs WHERE habit_id = ?', [id]);
    db.run('DELETE FROM habits WHERE id = ?', [id]);
  });
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

/** Completion flag of a single day's log. */
export function isLogCompleted(habit: Pick<Habit, 'frequency' | 'target'>, value: number): boolean {
  return habit.frequency === 'daily' ? value >= habit.target : value > 0;
}

/** Upserts the log of (habitId, date) and returns it. */
export function logHabit(db: DiaryDb, input: HabitLogInput): HabitLog {
  const habit = getHabit(db, input.habitId);
  const completed = isLogCompleted(habit, input.value) ? 1 : 0;
  db.run(
    `INSERT INTO habit_logs (habit_id, date, value, completed, note)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(habit_id, date) DO UPDATE SET value = excluded.value, completed = excluded.completed, note = excluded.note`,
    [habit.id, input.date, input.value, completed, input.note ?? ''],
  );
  const row = db.get<LogRow>('SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?', [habit.id, input.date]);
  if (!row) throw ApiError.db('server.habits.logNotSaved');
  return logFromRow(row);
}

export function deleteHabitLog(db: DiaryDb, habitId: number, date: string): void {
  if (!isIsoDate(date)) throw ApiError.validation('server.entries.badDate', 'date');
  if (!fetchHabitRow(db, habitId)) throw ApiError.notFound('server.habits.notFound');
  const { changes } = db.run('DELETE FROM habit_logs WHERE habit_id = ? AND date = ?', [habitId, date]);
  if (changes === 0) throw ApiError.notFound('server.habits.logNotFound');
}

function rangeWhere(from: string | null, to: string | null, prefix = ''): { sql: string[]; params: string[] } {
  const sql: string[] = [];
  const params: string[] = [];
  if (from) {
    if (!isIsoDate(from)) throw ApiError.validation('server.entries.fromBadDate', 'from');
    sql.push(`${prefix}date >= ?`);
    params.push(from);
  }
  if (to) {
    if (!isIsoDate(to)) throw ApiError.validation('server.entries.toBadDate', 'to');
    sql.push(`${prefix}date <= ?`);
    params.push(to);
  }
  return { sql, params };
}

/** Logs of one habit in the inclusive range (null = unbounded), ascending by date. */
export function listLogs(db: DiaryDb, habitId: number, from: string | null, to: string | null): HabitLog[] {
  if (!fetchHabitRow(db, habitId)) throw ApiError.notFound('server.habits.notFound');
  const r = rangeWhere(from, to);
  const where = ['habit_id = ?', ...r.sql].join(' AND ');
  return db.all<LogRow>(`SELECT * FROM habit_logs WHERE ${where} ORDER BY date, id`, [habitId, ...r.params]).map(logFromRow);
}

/** Logs of every habit in the range, ascending by date then habit id. */
export function listAllLogs(db: DiaryDb, from: string | null, to: string | null): HabitLog[] {
  const r = rangeWhere(from, to);
  const where = r.sql.length ? `WHERE ${r.sql.join(' AND ')}` : '';
  return db.all<LogRow>(`SELECT * FROM habit_logs ${where} ORDER BY date, habit_id`, r.params).map(logFromRow);
}

/** Per-day status of every logged habit (archived included) in the inclusive range. */
export function habitDayStatuses(db: DiaryDb, from: string, to: string): HabitDayStatus[] {
  if (!isIsoDate(from)) throw ApiError.validation('server.entries.fromBadDate', 'from');
  if (!isIsoDate(to)) throw ApiError.validation('server.entries.toBadDate', 'to');
  const rows = db.all<{ habit_id: number; name: string; date: string; value: number; completed: number }>(
    `SELECT l.habit_id, h.name, l.date, l.value, l.completed
       FROM habit_logs l JOIN habits h ON h.id = l.habit_id
      WHERE l.date >= ? AND l.date <= ?
      ORDER BY l.date, h.sort_order, h.id`,
    [from, to],
  );
  return rows.map((r) => ({
    habitId: Number(r.habit_id),
    habitName: String(r.name),
    date: String(r.date),
    value: Number(r.value),
    completed: Number(r.completed) === 1,
  }));
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

/** Longest run of consecutive integers in the (unsorted) set. */
function longestRun(numbers: Iterable<number>): number {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** Number of consecutive integers in the set ending at `end` (counting downwards). */
function runEndingAt(set: Set<number>, end: number): number {
  let n = 0;
  while (set.has(end - n)) n++;
  return n;
}

/** Sum of logged values per week (keyed by the ISO date of the week start). */
export function weeklyTotals(logs: HabitLog[], firstDayOfWeek: 0 | 1): Map<string, number> {
  const totals = new Map<string, number>();
  for (const l of logs) {
    const ws = weekStart(l.date, firstDayOfWeek);
    totals.set(ws, (totals.get(ws) ?? 0) + l.value);
  }
  return totals;
}

/**
 * Current and best streaks as of `asOf`.
 *
 * daily:  consecutive completed days ending at `asOf`; when `asOf` is not (yet)
 *         completed the day is treated as still in progress and the run ending at
 *         `asOf - 1` is reported instead.
 * weekly: consecutive weeks whose summed value >= target, ending at the week
 *         containing `asOf` (counted when already met) or the previous week.
 */
export function habitStreaks(
  habit: Habit,
  logs: HabitLog[],
  asOf: string,
  firstDayOfWeek: 0 | 1,
): { current: number; best: number } {
  const relevant = logs.filter((l) => l.habitId === habit.id && l.date <= asOf);
  if (habit.frequency === 'daily') {
    const completedDays = new Set<number>();
    for (const l of relevant) if (l.completed) completedDays.add(dayNumber(l.date));
    const today = dayNumber(asOf);
    const current = completedDays.has(today) ? runEndingAt(completedDays, today) : runEndingAt(completedDays, today - 1);
    return { current, best: longestRun(completedDays) };
  }
  const totals = weeklyTotals(relevant, firstDayOfWeek);
  const metWeeks = new Set<number>();
  for (const [ws, total] of totals) if (total >= habit.target) metWeeks.add(weekIndex(ws));
  const thisWeek = weekIndex(weekStart(asOf, firstDayOfWeek));
  const current = metWeeks.has(thisWeek) ? runEndingAt(metWeeks, thisWeek) : runEndingAt(metWeeks, thisWeek - 1);
  return { current, best: longestRun(metWeeks) };
}

/**
 * Integer index of the week starting at `weekStartIso`. Week starts are exactly 7 days
 * apart, so floor(dayNumber / 7) maps consecutive weeks to consecutive integers.
 */
function weekIndex(weekStartIso: string): number {
  return Math.floor(dayNumber(weekStartIso) / 7);
}

// ---------------------------------------------------------------------------
// Progress view
// ---------------------------------------------------------------------------

/**
 * The first day a habit counts from: the (local) day it was created - or its first log when that
 * is older (sample data and restored diaries log days before the habit record was made).
 */
export function habitStartDate(habit: Pick<Habit, 'createdAt'>, logs: readonly HabitLog[]): string {
  const created = Number.isFinite(Date.parse(habit.createdAt)) ? todayIso(new Date(habit.createdAt)) : '';
  const firstLog = logs.length ? logs.reduce((min, l) => (l.date < min ? l.date : min), logs[0].date) : '';
  if (!created) return firstLog;
  return firstLog && firstLog < created ? firstLog : created;
}

/**
 * Progress of every active habit for `date` (usually today): the day's log, streaks,
 * this week's total, completion over the last 30 days / 4 weeks and whether the
 * day/week target is already met. The first day of the week comes from the settings.
 * Days (weeks) before the habit existed do not count: a habit created today and done today is
 * 100%, not 1 of 30.
 */
export function habitsWithProgress(db: DiaryDb, date: string): HabitWithProgress[] {
  if (!isIsoDate(date)) throw ApiError.validation('server.entries.badDate', 'date');
  const firstDayOfWeek = getSettings(db).firstDayOfWeek;
  const habits = loadHabits(db, false);
  if (!habits.length) return [];

  // One query for every log up to `date`, grouped by habit.
  const byHabit = new Map<number, HabitLog[]>();
  for (const row of db.all<LogRow>('SELECT * FROM habit_logs WHERE date <= ? ORDER BY date, id', [date])) {
    const log = logFromRow(row);
    const list = byHabit.get(log.habitId);
    if (list) list.push(log);
    else byHabit.set(log.habitId, [log]);
  }

  const ws = weekStart(date, firstDayOfWeek);
  const we = addDays(ws, 6);
  const thirtyStart = addDays(date, -29);

  return habits.map((habit) => {
    const logs = byHabit.get(habit.id) ?? [];
    const today = logs.find((l) => l.date === date) ?? null;
    const { current, best } = habitStreaks(habit, logs, date, firstDayOfWeek);
    const weekTotal = logs.filter((l) => l.date >= ws && l.date <= we).reduce((sum, l) => sum + l.value, 0);

    let completedLast30: number;
    let completionRate30: number;
    let targetMet: boolean;
    const start = habitStartDate(habit, logs);
    if (habit.frequency === 'daily') {
      completedLast30 = logs.filter((l) => l.completed && l.date >= thirtyStart && l.date <= date).length;
      const from = start && start > thirtyStart ? start : thirtyStart;
      const days = Math.min(30, Math.max(1, diffDays(from, date) + 1));
      completionRate30 = Math.min(1, completedLast30 / days);
      targetMet = today?.completed ?? false;
    } else {
      const totals = weeklyTotals(logs, firstDayOfWeek);
      completedLast30 = 0;
      let weeks = 0;
      // The current week plus the three before it - the weeks the habit already existed in.
      for (let w = 0; w < 4; w++) {
        const weekFirst = addDays(ws, -7 * w);
        if (start && addDays(weekFirst, 6) < start) continue;
        weeks++;
        if ((totals.get(weekFirst) ?? 0) >= habit.target) completedLast30++;
      }
      completionRate30 = completedLast30 / Math.max(1, weeks);
      targetMet = weekTotal >= habit.target;
    }

    return {
      habit,
      today,
      currentStreak: current,
      bestStreak: best,
      weekTotal,
      completedLast30,
      completionRate30: Math.round(completionRate30 * 1000) / 1000,
      targetMet,
    };
  });
}
