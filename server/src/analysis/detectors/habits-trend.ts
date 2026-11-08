/**
 * habits-trend: completion rate of every active habit in the last 14 days against the
 * 14 days before. Needs at least 4 weeks of logs (first log >= 27 days before today).
 *
 * Daily habits: completed days / 14. Weekly habits: amount logged / (2 x weekly target),
 * i.e. progress against the target of the two weeks.
 */
import { ANALYSIS } from '@shared/constants';
import type { Habit, Insight } from '@shared/types';
import type { DayRecord } from '../../db/dataset';
import { addDays, diffDays } from '../../util/dates';
import { round } from '../math';
import { fmtInt, fmtPercent, insufficientDataNote, shortDate, strengthLabel, tr, weeksCount } from '../phrasing';
import { evidence, makeInsight, strengthFromThresholds } from '../scoring';
import { addNote, periodBounds, type Detector, type DetectorContext } from '../types';

/** Completion-rate difference thresholds (weak / moderate / strong). */
export const RATE_THRESHOLDS: readonly [number, number, number] = [0.15, 0.3, 0.5];
const WINDOW = 14;

interface WindowStats {
  from: string;
  to: string;
  /** Completed days (daily) or amount logged (weekly). */
  amount: number;
  rate: number;
}

function windowStats(days: DayRecord[], habit: Habit, from: string, to: string): WindowStats {
  let amount = 0;
  for (const d of days) {
    if (d.date < from || d.date > to) continue;
    if (habit.frequency === 'daily') {
      if (d.habitCompleted.get(habit.id) === true) amount++;
    } else {
      amount += d.habitValues.get(habit.id) ?? 0;
    }
  }
  const denominator = habit.frequency === 'daily' ? WINDOW : Math.max(habit.target, 1) * 2;
  return { from, to, amount, rate: amount / denominator };
}

function detectHabit(ctx: DetectorContext, habit: Habit): Insight | null {
  const L = ctx.locale;
  const first = ctx.ds.days.find((d) => d.habitValues.has(habit.id))?.date ?? null;
  const spanDays = first ? diffDays(first, ctx.today) + 1 : 0;
  // Whole weeks only: 27 days of logs are "3 weeks", matching the "needs 4 weeks" rule below.
  const weeksHave = Math.floor(spanDays / 7);
  if (!first || spanDays < ANALYSIS.minWeeks * 7) {
    addNote(
      ctx,
      insufficientDataNote(
        L,
        tr(L, 'analysis.habitsTrend.whether', { habit: habit.name }),
        tr(L, 'analysis.req.weeksOfLogs', { count: ANALYSIS.minWeeks }),
        weeksCount(L, weeksHave),
        true,
      ),
    );
    return null;
  }
  const recent = windowStats(ctx.ds.days, habit, addDays(ctx.today, -(WINDOW - 1)), ctx.today);
  const previous = windowStats(ctx.ds.days, habit, addDays(ctx.today, -(2 * WINDOW - 1)), addDays(ctx.today, -WINDOW));
  const diff = recent.rate - previous.rate;
  const strength = strengthFromThresholds(diff, RATE_THRESHOLDS);
  if (!strength) return null;

  const improved = diff > 0;
  const direction = improved ? 'improved' : 'declined';
  const text =
    habit.frequency === 'daily'
      ? tr(L, 'analysis.habitsTrend.textDaily', {
          habit: habit.name,
          direction,
          recent: fmtInt(L, recent.amount),
          window: WINDOW,
          previous: fmtInt(L, previous.amount),
        })
      : tr(L, 'analysis.habitsTrend.textWeekly', {
          habit: habit.name,
          direction,
          recent: fmtInt(L, recent.amount),
          unit: habit.unit,
          previous: fmtInt(L, previous.amount),
          target: fmtInt(L, habit.target),
        });
  const explanation = tr(L, 'analysis.habitsTrend.explain', {
    recentFrom: shortDate(L, recent.from),
    recentTo: shortDate(L, recent.to),
    previousFrom: shortDate(L, previous.from),
    previousTo: shortDate(L, previous.to),
    recentRate: fmtPercent(L, recent.rate),
    previousRate: fmtPercent(L, previous.rate),
    diff: fmtInt(L, Math.abs(diff) * 100),
    strength: strengthLabel(L, strength),
  });
  return makeInsight({
    id: `habit_trend_${habit.id}`,
    category: improved ? 'habit_improved' : 'habit_declined',
    strength,
    title: tr(L, 'analysis.habitsTrend.title', { habit: habit.name, direction }),
    text,
    explanation,
    evidence: evidence({
      daysExamined: WINDOW * 2,
      metricLabel: tr(L, 'analysis.habitsTrend.metric', { habit: habit.name }),
      groupALabel: tr(L, 'analysis.habitsTrend.groupA'),
      groupACount: recent.amount,
      groupAMean: round(recent.rate, 2),
      groupBLabel: tr(L, 'analysis.habitsTrend.groupB'),
      groupBCount: previous.amount,
      groupBMean: round(previous.rate, 2),
      effectSize: round(diff, 2),
      dates: [recent.from, recent.to],
      extra: [
        { key: tr(L, 'analysis.extra.frequency'), value: tr(L, habit.frequency === 'daily' ? 'analysis.frequency.daily' : 'analysis.frequency.weekly') },
        { key: tr(L, 'analysis.extra.target'), value: tr(L, 'analysis.habit.targetValue', { target: fmtInt(L, habit.target), unit: habit.unit }).trim() },
        { key: tr(L, 'analysis.extra.strength'), value: strengthLabel(L, strength) },
      ],
    }),
    ...periodBounds(ctx),
    // Rate differences are 0..1; scale to the rating-point range used by other detectors.
    effect: Math.abs(diff) * 3,
    n: WINDOW * 2,
    positive: improved,
  });
}

export const habitsTrendDetector: Detector = {
  id: 'habits_trend',
  label: (l) => tr(l, 'analysis.habitsTrend.label'),
  detect(ctx) {
    if (ctx.habits.length === 0) return [];
    const out: Insight[] = [];
    for (const habit of ctx.habits) {
      const insight = detectHabit(ctx, habit);
      if (insight) out.push(insight);
    }
    return out;
  },
};
