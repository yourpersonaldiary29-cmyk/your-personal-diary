/**
 * Data for the home page ("דף הבית"): today's context, writing streak, the last
 * entry, this week's averages, today's habits and the most relevant insight.
 *
 * The habit progress and the insight come from other modules; both are wrapped
 * so a failure there degrades to an empty list / null instead of breaking the page.
 */
import { DEFAULT_LOCALE, type Locale } from '@shared/i18n';
import type { HomeSummary, Insight } from '@shared/types';
import { generateInsights } from '../analysis/engine';
import type { DiaryDb } from '../db/database';
import { buildDataset } from '../db/dataset';
import { habitsWithProgress } from '../db/habits-repo';
import { addDays, dayNumber, todayIso, weekdayNameIn } from '../util/dates';
import { rowToSummary, SUMMARY_COLUMNS, type SummaryRow } from './entry-summary';
import { meanOf } from './series';

/** Days of the "this week" window (today and the 6 days before it). */
export const WEEK_WINDOW_DAYS = 7;

/**
 * Consecutive days with at least one entry, counted backwards from today.
 * A streak is still alive when today has no entry yet but yesterday has one.
 */
export function entryStreak(db: DiaryDb, today: string): number {
  const rows = db.all<{ date: string }>('SELECT DISTINCT date FROM entries WHERE date <= ? ORDER BY date DESC', [today]);
  if (!rows.length) return 0;
  const todayNum = dayNumber(today);
  const newest = dayNumber(String(rows[0].date));
  if (newest !== todayNum && newest !== todayNum - 1) return 0;
  let streak = 1;
  let expected = newest - 1;
  for (let i = 1; i < rows.length; i++) {
    const n = dayNumber(String(rows[i].date));
    if (n !== expected) break;
    streak++;
    expected--;
  }
  return streak;
}

/** Insight with the highest score (first one wins ties); null for an empty list. */
export function pickTopInsight(insights: Insight[]): Insight | null {
  let best: Insight | null = null;
  for (const ins of insights) if (!best || ins.score > best.score) best = ins;
  return best;
}

/**
 * Home page data; `locale` (req.locale) is the language of the texts: `todayWeekday` is the
 * full localised weekday name ('Monday' / 'יום שני'), the top insight is rendered in `locale`.
 */
export function homeSummary(db: DiaryDb, today: string = todayIso(), locale: Locale = DEFAULT_LOCALE): HomeSummary {
  const todayEntryCount = Number(db.scalar<number>('SELECT COUNT(*) FROM entries WHERE date = ?', [today]) ?? 0);
  const totalEntries = Number(db.scalar<number>('SELECT COUNT(*) FROM entries') ?? 0);

  const lastRow = db.get<SummaryRow>(`SELECT ${SUMMARY_COLUMNS} FROM entries ORDER BY date DESC, time DESC, id DESC LIMIT 1`);
  const lastEntry = lastRow ? rowToSummary(lastRow) : null;

  // Week averages: mean of the daily means over the last 7 days (today included).
  const weekFrom = addDays(today, -(WEEK_WINDOW_DAYS - 1));
  const week = buildDataset(db, weekFrom, today);
  const collect = (pick: (d: (typeof week.days)[number]) => number | null) =>
    week.days.map(pick).filter((v): v is number => v != null);

  let habitsToday: HomeSummary['habitsToday'] = [];
  try {
    habitsToday = habitsWithProgress(db, today);
  } catch {
    habitsToday = [];
  }

  let topInsight: Insight | null = null;
  try {
    topInsight = pickTopInsight(generateInsights(db, '30d', today, {}, locale).insights);
  } catch {
    topInsight = null;
  }

  return {
    today,
    todayWeekday: weekdayNameIn(locale, today),
    todayEntryCount,
    entryStreak: entryStreak(db, today),
    lastEntry,
    weekMoodAvg: meanOf(collect((d) => d.mood)),
    weekEnergyAvg: meanOf(collect((d) => d.energy)),
    weekStressAvg: meanOf(collect((d) => d.stress)),
    weekSleepAvg: meanOf(collect((d) => d.sleepHours)),
    habitsToday,
    topInsight,
    totalEntries,
  };
}
