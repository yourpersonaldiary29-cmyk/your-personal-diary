/**
 * Statistics overview for the "סטטיסטיקות" page: one daily series per metric
 * (with a 7-day moving average and a comparison to the previous period),
 * entries per day, habit completion and weekday means.
 *
 * Every series has one point per calendar day of the range; days without a
 * report carry `null` (never 0). Only `entriesPerDay` is a count and never null.
 */
import { metricLabel, metricUnit } from '@shared/constants';
import { DEFAULT_LOCALE, type Locale } from '@shared/i18n';
import type { Habit, HabitLog, HabitStats, Metric, Period, SeriesPoint, StatsOverview, StatsSeries } from '@shared/types';
import type { DiaryDb } from '../db/database';
import { buildDataset, type DayRecord } from '../db/dataset';
import { habitStreaks } from '../db/habits-repo';
import { addDays, dateRange, periodRange, todayIso, weekStart } from '../util/dates';

/** Metric keys a series can be built for (`entries` = entries per day). */
export type SeriesMetric = Metric | 'entries';

export const METRIC_KEYS: Metric[] = ['mood', 'energy', 'stress', 'sleepHours', 'sleepQuality', 'exerciseMinutes'];

/** Window (days) of the moving average and the minimum number of values it needs. */
export const MOVING_AVG_WINDOW = 7;
export const MOVING_AVG_MIN_VALUES = 2;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Mean rounded to two decimals; null for an empty list. */
export function meanOf(values: number[]): number | null {
  if (!values.length) return null;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Earliest date that has an entry or a habit log, or null for an empty diary. */
export function firstDayWithData(db: DiaryDb): string | null {
  const candidates: string[] = [];
  for (const table of ['entries', 'habit_logs']) {
    const v = db.scalar<string | null>(`SELECT MIN(date) FROM ${table}`);
    if (typeof v === 'string' && v) candidates.push(v);
  }
  if (!candidates.length) return null;
  candidates.sort();
  return candidates[0];
}

/** Value of a metric for one day record (`entries` counts entries and is 0 for missing days). */
export function valueOfDay(day: DayRecord | undefined, metric: SeriesMetric): number | null {
  if (metric === 'entries') return day ? day.entryCount : 0;
  if (!day) return null;
  switch (metric) {
    case 'mood':
      return day.mood;
    case 'energy':
      return day.energy;
    case 'stress':
      return day.stress;
    case 'sleepHours':
      return day.sleepHours;
    case 'sleepQuality':
      return day.sleepQuality;
    case 'exerciseMinutes':
      return day.exerciseMinutes;
    default:
      return null;
  }
}

/**
 * Trailing moving average aligned to `points`: for index i the window is the
 * up-to-`window` points ending at i; only non-null values count and the result
 * is null when fewer than `minValues` of them exist.
 */
export function movingAverage(
  points: SeriesPoint[],
  window: number = MOVING_AVG_WINDOW,
  minValues: number = MOVING_AVG_MIN_VALUES,
): SeriesPoint[] {
  return points.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - window + 1); j <= i; j++) {
      const v = points[j].value;
      if (v != null) {
        sum += v;
        n++;
      }
    }
    return { date: p.date, value: n >= minValues ? round2(sum / n) : null };
  });
}

/**
 * Builds a `StatsSeries` for `dates` using `valueOf` for each day.
 * `previousValues` are the per-day values of the equally long period before
 * the range (null when there is no previous period, e.g. for 'all').
 */
export function buildSeries(
  metric: SeriesMetric,
  dates: string[],
  valueOf: (date: string) => number | null,
  previousValues: (number | null)[] | null,
  locale: Locale = DEFAULT_LOCALE,
): StatsSeries {
  const points: SeriesPoint[] = dates.map((date) => {
    const v = valueOf(date);
    return { date, value: v == null ? null : round2(v) };
  });
  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  const prev = previousValues ? previousValues.filter((v): v is number => v != null) : [];
  return {
    metric,
    label: metricLabel(metric, locale),
    unit: metricUnit(metric, locale),
    points,
    movingAvg: movingAverage(points),
    mean: meanOf(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    count: values.length,
    previousMean: previousValues ? meanOf(prev) : null,
  };
}

/** First day of the week from the settings table (0 = Sunday default). */
export function readFirstDayOfWeek(db: DiaryDb): 0 | 1 {
  try {
    const raw = db.scalar<string>("SELECT value FROM settings WHERE key = 'firstDayOfWeek'");
    if (typeof raw !== 'string') return 0;
    const parsed: unknown = JSON.parse(raw);
    return parsed === 1 || parsed === '1' ? 1 : 0;
  } catch {
    return 0;
  }
}

interface LogRow {
  id: number;
  habit_id: number;
  date: string;
  value: number;
  completed: number;
  note: string;
}

/** All habit logs up to `to` (inclusive), grouped by habit id. */
export function loadLogsByHabit(db: DiaryDb, to: string): Map<number, HabitLog[]> {
  const rows = db.all<LogRow>(
    'SELECT id, habit_id, date, value, completed, note FROM habit_logs WHERE date <= ? ORDER BY date, id',
    [to],
  );
  const out = new Map<number, HabitLog[]>();
  for (const r of rows) {
    const log: HabitLog = {
      id: Number(r.id),
      habitId: Number(r.habit_id),
      date: String(r.date),
      value: Number(r.value),
      completed: Number(r.completed) === 1,
      note: String(r.note ?? ''),
    };
    const list = out.get(log.habitId);
    if (list) list.push(log);
    else out.set(log.habitId, [log]);
  }
  return out;
}

/** Statistics of one habit over `dates` (see `HabitStats`). */
export function habitStatsFor(
  habit: Habit,
  logs: HabitLog[],
  dates: string[],
  dayMap: Map<string, DayRecord>,
  to: string,
  firstDayOfWeek: 0 | 1,
): HabitStats {
  const points: SeriesPoint[] = dates.map((date) => ({
    date,
    value: dayMap.get(date)?.habitValues.get(habit.id) ?? null,
  }));
  let completedDays = 0;
  let totalDays = 0;
  if (habit.frequency === 'daily') {
    totalDays = dates.length;
    for (const date of dates) if (dayMap.get(date)?.habitCompleted.get(habit.id) === true) completedDays++;
  } else {
    // Weekly habit: a week counts as completed when the values logged in it sum to the target.
    const weekStarts = [...new Set(dates.map((d) => weekStart(d, firstDayOfWeek)))];
    const inRange = new Set(weekStarts);
    const totals = new Map<string, number>();
    for (const log of logs) {
      const ws = weekStart(log.date, firstDayOfWeek);
      if (inRange.has(ws)) totals.set(ws, (totals.get(ws) ?? 0) + log.value);
    }
    totalDays = weekStarts.length;
    for (const ws of weekStarts) if ((totals.get(ws) ?? 0) >= habit.target) completedDays++;
  }
  let streaks = { current: 0, best: 0 };
  try {
    streaks = habitStreaks(habit, logs, to, firstDayOfWeek);
  } catch {
    // A streak failure must never break the statistics page.
  }
  return {
    habitId: habit.id,
    name: habit.name,
    unit: habit.unit,
    target: habit.target,
    frequency: habit.frequency,
    points,
    completionRate: totalDays ? Math.round((completedDays / totalDays) * 1000) / 1000 : 0,
    completedDays,
    totalDays,
    currentStreak: streaks.current,
    bestStreak: streaks.best,
  };
}

/**
 * Full statistics overview for `period` ending at `today`.
 * For 'all' the range starts at the first day that has data (or today when the diary is empty).
 */
export function statsOverview(db: DiaryDb, period: Period, today: string = todayIso(), locale: Locale = DEFAULT_LOCALE): StatsOverview {
  const range = periodRange(period, today);
  const to = range.to;
  let from = range.from ?? firstDayWithData(db) ?? today;
  if (from > to) from = to;
  const dates = dateRange(from, to);

  // Previous period of equal length (only for bounded periods).
  const hasPrevious = range.from != null;
  const prevFrom = hasPrevious ? addDays(from, -dates.length) : null;
  const prevDates = hasPrevious && prevFrom ? dateRange(prevFrom, addDays(from, -1)) : [];

  const dataset = buildDataset(db, prevFrom ?? from, to);
  const dayMap = new Map<string, DayRecord>(dataset.days.map((d) => [d.date, d]));

  const series = (metric: SeriesMetric): StatsSeries =>
    buildSeries(
      metric,
      dates,
      (date) => valueOfDay(dayMap.get(date), metric),
      hasPrevious ? prevDates.map((date) => valueOfDay(dayMap.get(date), metric)) : null,
      locale,
    );

  // Habits ------------------------------------------------------------------
  const firstDayOfWeek = readFirstDayOfWeek(db);
  const logsByHabit = loadLogsByHabit(db, to);
  const habits = [...dataset.habits.values()]
    .filter((h) => !h.isArchived)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((h) => habitStatsFor(h, logsByHabit.get(h.id) ?? [], dates, dayMap, to, firstDayOfWeek));

  // Totals & weekday means ---------------------------------------------------
  let totalEntries = 0;
  let daysWithEntries = 0;
  const buckets = { mood: [] as number[][], energy: [] as number[][], stress: [] as number[][] };
  for (const key of Object.keys(buckets) as (keyof typeof buckets)[]) {
    buckets[key] = Array.from({ length: 7 }, () => []);
  }
  for (const date of dates) {
    const day = dayMap.get(date);
    if (!day) continue;
    totalEntries += day.entryCount;
    if (day.entryCount > 0) daysWithEntries++;
    if (day.mood != null) buckets.mood[day.weekday].push(day.mood);
    if (day.energy != null) buckets.energy[day.weekday].push(day.energy);
    if (day.stress != null) buckets.stress[day.weekday].push(day.stress);
  }

  return {
    period,
    from,
    to,
    mood: series('mood'),
    energy: series('energy'),
    stress: series('stress'),
    sleepHours: series('sleepHours'),
    sleepQuality: series('sleepQuality'),
    exerciseMinutes: series('exerciseMinutes'),
    entriesPerDay: series('entries'),
    habits,
    totalEntries,
    daysWithEntries,
    weekdayMood: buckets.mood.map(meanOf),
    weekdayEnergy: buckets.energy.map(meanOf),
    weekdayStress: buckets.stress.map(meanOf),
  };
}
