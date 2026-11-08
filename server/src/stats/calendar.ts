/**
 * Calendar views: one `CalendarDay` per day of a month, or only the days with
 * data inside an arbitrary range (timeline). Both are built on the shared
 * per-day dataset (`db/dataset.ts`) so the numbers match the statistics and
 * insights pages exactly.
 */
import type { CalendarDay, CalendarMonth } from '@shared/types';
import type { DiaryDb } from '../db/database';
import { buildDataset, type DayRecord } from '../db/dataset';
import { ApiError } from '../errors';
import { dateRange, daysInMonth, diffDays, isIsoDate, todayIso } from '../util/dates';

/** Largest range (in days) `calendarRange` accepts. */
export const MAX_RANGE_DAYS = 400;
export const MIN_YEAR = 1970;
export const MAX_YEAR = 2200;

/** Rounds a mean to two decimals (nulls pass through). */
export function round2(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/** Number of habits that are not archived. */
export function activeHabitCount(db: DiaryDb): number {
  return Number(db.scalar<number>('SELECT COUNT(*) FROM habits WHERE is_archived = 0') ?? 0);
}

/** Number of habit logs marked completed on the given day record. */
export function completedHabits(day: DayRecord): number {
  let n = 0;
  for (const completed of day.habitCompleted.values()) if (completed) n++;
  return n;
}

/**
 * Builds the calendar cell for `date`.
 * `habitsTotal` is the number of active habits; it is reported as 0 for days
 * after `today` because nothing can be completed on a day that has not happened yet.
 */
export function toCalendarDay(day: DayRecord | undefined, date: string, habitsTotal: number, today: string): CalendarDay {
  const total = date > today ? 0 : habitsTotal;
  if (!day) {
    return {
      date,
      mood: null,
      energy: null,
      stress: null,
      sleepHours: null,
      hasEntry: false,
      entryCount: 0,
      habitsCompleted: 0,
      habitsTotal: total,
      titles: [],
    };
  }
  return {
    date,
    mood: round2(day.mood),
    energy: round2(day.energy),
    stress: round2(day.stress),
    sleepHours: round2(day.sleepHours),
    hasEntry: day.entryCount > 0,
    entryCount: day.entryCount,
    habitsCompleted: completedHabits(day),
    habitsTotal: total,
    titles: [...day.titles],
  };
}

function validateYearMonth(year: unknown, month: unknown): { year: number; month: number } {
  if (typeof year !== 'number' || !Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw ApiError.validation('server.calendar.yearRange', 'year', { min: MIN_YEAR, max: MAX_YEAR });
  }
  if (typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12) {
    throw ApiError.validation('server.calendar.monthRange', 'month');
  }
  return { year, month };
}

/** Every day of the month (1..28/29/30/31), including days without data. */
export function calendarMonth(db: DiaryDb, year: number, month: number, today: string = todayIso()): CalendarMonth {
  const ym = validateYearMonth(year, month);
  const mm = String(ym.month).padStart(2, '0');
  const from = `${ym.year}-${mm}-01`;
  const to = `${ym.year}-${mm}-${String(daysInMonth(ym.year, ym.month)).padStart(2, '0')}`;
  const dataset = buildDataset(db, from, to);
  const byDate = new Map(dataset.days.map((d) => [d.date, d] as const));
  const habitsTotal = activeHabitCount(db);
  const days = dateRange(from, to).map((date) => toCalendarDay(byDate.get(date), date, habitsTotal, today));
  return { year: ym.year, month: ym.month, days };
}

/** Validates an inclusive range for `calendarRange` (throws localised validation errors). */
export function validateRange(from: unknown, to: unknown): { from: string; to: string } {
  if (!isIsoDate(from)) throw ApiError.validation('server.entries.fromBadDate', 'from');
  if (!isIsoDate(to)) throw ApiError.validation('server.entries.toBadDate', 'to');
  if (from > to) throw ApiError.validation('server.calendar.fromAfterTo', 'from');
  if (diffDays(from, to) + 1 > MAX_RANGE_DAYS) {
    throw ApiError.validation('server.calendar.rangeTooLong', 'to', { max: MAX_RANGE_DAYS });
  }
  return { from, to };
}

/** Only the days in [from, to] that have at least one entry or habit log, ascending. */
export function calendarRange(db: DiaryDb, from: string, to: string): CalendarDay[] {
  const range = validateRange(from, to);
  const today = todayIso();
  const dataset = buildDataset(db, range.from, range.to);
  const habitsTotal = activeHabitCount(db);
  return dataset.days.map((d) => toCalendarDay(d, d.date, habitsTotal, today));
}
