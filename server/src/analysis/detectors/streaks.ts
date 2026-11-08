/**
 * streaks: the current diary-writing streak (>= 3 days) and habit streaks (>= 5 completed
 * days for daily habits, >= 5 weeks at target for weekly habits). A streak may end today
 * or yesterday - today's entry or log is often written later in the day.
 */
import type { Habit, Insight } from '@shared/types';
import type { DayRecord } from '../../db/dataset';
import { addDays, weekStart } from '../../util/dates';
import { fmtInt, shortDate, tr } from '../phrasing';
import { evidence, makeInsight, strengthFromThresholds } from '../scoring';
import { addNote, periodBounds, type Detector, type DetectorContext } from '../types';

export const MIN_ENTRY_STREAK = 3;
export const MIN_HABIT_STREAK = 5;
const ENTRY_THRESHOLDS: readonly [number, number, number] = [3, 7, 14];
const DAILY_THRESHOLDS: readonly [number, number, number] = [5, 10, 21];
const WEEKLY_THRESHOLDS: readonly [number, number, number] = [5, 8, 12];

export interface Streak {
  length: number;
  start: string;
  end: string;
}

/**
 * Longest run of consecutive "hit" dates ending on `today` or the day before.
 * `hit` is a set of ISO dates.
 */
export function currentStreak(hit: Set<string>, today: string): Streak {
  let end = hit.has(today) ? today : addDays(today, -1);
  if (!hit.has(end)) return { length: 0, start: end, end };
  let length = 0;
  let cursor = end;
  while (hit.has(cursor)) {
    length++;
    cursor = addDays(cursor, -1);
  }
  const start = addDays(cursor, 1);
  end = addDays(start, length - 1);
  return { length, start, end };
}

/** Longest run anywhere in the sorted list of dates (for the "best streak" figure). */
export function longestStreak(dates: string[]): number {
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...dates].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

function entryStreak(ctx: DetectorContext): Insight | null {
  const L = ctx.locale;
  const dates = ctx.ds.days.filter((d) => d.entryCount > 0).map((d) => d.date);
  const streak = currentStreak(new Set(dates), ctx.today);
  const strength = strengthFromThresholds(streak.length, ENTRY_THRESHOLDS);
  if (streak.length < MIN_ENTRY_STREAK || !strength) return null;
  const best = longestStreak(dates);
  const from = shortDate(L, streak.start);
  const to = shortDate(L, streak.end);
  return makeInsight({
    id: 'streak_entries',
    category: 'streak',
    strength,
    title: tr(L, 'analysis.streaks.entriesTitle', { count: streak.length }),
    text: tr(L, 'analysis.streaks.entriesText', { count: streak.length, from, to }),
    explanation: tr(L, 'analysis.streaks.entriesExplain', { count: streak.length, from, to, best }),
    evidence: evidence({
      daysExamined: dates.length,
      metricLabel: tr(L, 'analysis.streaks.entriesMetric'),
      groupALabel: tr(L, 'analysis.streaks.currentDays'),
      groupACount: streak.length,
      groupAMean: null,
      groupBLabel: tr(L, 'analysis.streaks.daysWithEntry'),
      groupBCount: dates.length,
      groupBMean: null,
      effectSize: streak.length,
      dates: [streak.start, streak.end],
      extra: [{ key: tr(L, 'analysis.extra.longestStreak'), value: fmtInt(L, best) }],
    }),
    ...periodBounds(ctx),
    effect: Math.min(streak.length / 5, 3),
    n: dates.length,
    positive: true,
  });
}

function dailyHabitStreak(ctx: DetectorContext, habit: Habit, days: DayRecord[]): Insight | null {
  const L = ctx.locale;
  const hits = days.filter((d) => d.habitCompleted.get(habit.id) === true).map((d) => d.date);
  const streak = currentStreak(new Set(hits), ctx.today);
  const strength = strengthFromThresholds(streak.length, DAILY_THRESHOLDS);
  if (streak.length < MIN_HABIT_STREAK || !strength) return null;
  const best = longestStreak(hits);
  return makeInsight({
    id: `streak_habit_${habit.id}`,
    category: 'streak',
    strength,
    title: tr(L, 'analysis.streaks.habitTitle', { count: streak.length, habit: habit.name }),
    text: tr(L, 'analysis.streaks.habitText', { habit: habit.name, count: streak.length, from: shortDate(L, streak.start), to: shortDate(L, streak.end) }),
    explanation: tr(L, 'analysis.streaks.habitExplain', { habit: habit.name, count: streak.length, best }),
    evidence: evidence({
      daysExamined: hits.length,
      metricLabel: tr(L, 'analysis.streaks.habitMetric', { habit: habit.name }),
      groupALabel: tr(L, 'analysis.streaks.currentDays'),
      groupACount: streak.length,
      groupAMean: null,
      groupBLabel: tr(L, 'analysis.streaks.daysCompleted'),
      groupBCount: hits.length,
      groupBMean: null,
      effectSize: streak.length,
      dates: [streak.start, streak.end],
      extra: [{ key: tr(L, 'analysis.extra.longestStreak'), value: fmtInt(L, best) }],
    }),
    ...periodBounds(ctx),
    effect: Math.min(streak.length / 7, 3),
    n: hits.length,
    positive: true,
  });
}

function weeklyHabitStreak(ctx: DetectorContext, habit: Habit, days: DayRecord[]): Insight | null {
  const L = ctx.locale;
  const sums = new Map<string, number>();
  for (const d of days) {
    const v = d.habitValues.get(habit.id);
    if (v == null) continue;
    const ws = weekStart(d.date, ctx.firstDayOfWeek);
    sums.set(ws, (sums.get(ws) ?? 0) + v);
  }
  const thisWeek = weekStart(ctx.today, ctx.firstDayOfWeek);
  let cursor = (sums.get(thisWeek) ?? 0) >= habit.target ? thisWeek : addDays(thisWeek, -7);
  let length = 0;
  while ((sums.get(cursor) ?? 0) >= habit.target) {
    length++;
    cursor = addDays(cursor, -7);
  }
  const strength = strengthFromThresholds(length, WEEKLY_THRESHOLDS);
  if (length < MIN_HABIT_STREAK || !strength) return null;
  const start = addDays(cursor, 7);
  const end = addDays(start, length * 7 - 1);
  const target = tr(L, 'analysis.habit.targetValue', { target: fmtInt(L, habit.target), unit: habit.unit }).trim();
  return makeInsight({
    id: `streak_habit_${habit.id}`,
    category: 'streak',
    strength,
    title: tr(L, 'analysis.streaks.weeklyTitle', { count: length, habit: habit.name }),
    text: tr(L, 'analysis.streaks.weeklyText', { habit: habit.name, count: length, from: shortDate(L, start), to: shortDate(L, end) }),
    explanation: tr(L, 'analysis.streaks.weeklyExplain', { habit: habit.name, target, count: length }),
    evidence: evidence({
      daysExamined: days.filter((d) => d.habitValues.has(habit.id)).length,
      metricLabel: tr(L, 'analysis.streaks.weeklyMetric', { habit: habit.name }),
      groupALabel: tr(L, 'analysis.streaks.currentWeeks'),
      groupACount: length,
      groupAMean: null,
      groupBLabel: tr(L, 'analysis.streaks.weeksWithLogs'),
      groupBCount: sums.size,
      groupBMean: null,
      effectSize: length,
      dates: [start, end],
      extra: [{ key: tr(L, 'analysis.extra.weeklyTarget'), value: target }],
    }),
    ...periodBounds(ctx),
    effect: Math.min(length / 4, 3),
    n: sums.size,
    positive: true,
  });
}

export const streaksDetector: Detector = {
  id: 'streaks',
  label: (l) => tr(l, 'analysis.streaks.label'),
  detect(ctx) {
    const out: Insight[] = [];
    const e = entryStreak(ctx);
    if (e) out.push(e);
    for (const habit of ctx.habits) {
      const s = habit.frequency === 'daily' ? dailyHabitStreak(ctx, habit, ctx.ds.days) : weeklyHabitStreak(ctx, habit, ctx.ds.days);
      if (s) out.push(s);
    }
    if (out.length === 0) {
      addNote(ctx, tr(ctx.locale, 'analysis.streaks.none', { entryMin: MIN_ENTRY_STREAK, habitMin: MIN_HABIT_STREAK }));
    }
    return out;
  },
};
