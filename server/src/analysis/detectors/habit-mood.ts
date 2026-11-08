/**
 * habit-mood: for every active habit, days (daily habits) or weeks (weekly habits) in which
 * the habit was completed versus the rest, compared on mood - and, quietly, on energy and
 * stress (those are reported only when notable, without "not enough data" notes).
 *
 * Days before a habit's first log are ignored (the habit did not exist for the user yet).
 * After that, a day without a log counts as "not completed" - habit logs are the user's
 * own record of doing the habit, unlike ratings where a missing value means "not reported".
 */
import { ANALYSIS } from '@shared/constants';
import type { Locale } from '@shared/i18n';
import type { Habit, Insight, InsightCategory } from '@shared/types';
import type { DayRecord } from '../../db/dataset';
import { addDays, weekStart } from '../../util/dates';
import { groupStats, round } from '../math';
import {
  fmt1,
  fmtInt,
  insufficientDataNote,
  metricLabel,
  metricParams,
  nothingNotableNote,
  relationSentence,
  strengthLabel,
  tr,
  weeksCount,
  type MetricKey,
} from '../phrasing';
import { evidence, makeInsight, strengthFromDiff } from '../scoring';
import { addNote, periodBounds, type Detector, type DetectorContext } from '../types';
import { runSplit } from './common';

type Outcome = 'mood' | 'energy' | 'stress';

interface OutcomeSpec {
  metric: Outcome;
  category: InsightCategory;
  /** Secondary outcomes are checked quietly. */
  quiet: boolean;
  positiveWhen: (diff: number) => boolean | null;
}

const OUTCOMES: OutcomeSpec[] = [
  { metric: 'mood', category: 'habit_mood', quiet: false, positiveWhen: (d) => (d > 0 ? true : null) },
  { metric: 'energy', category: 'correlation', quiet: true, positiveWhen: (d) => (d > 0 ? true : null) },
  { metric: 'stress', category: 'correlation', quiet: true, positiveWhen: (d) => (d < 0 ? true : null) },
];

function outcomeOf(d: DayRecord, metric: Outcome): number | null {
  return d[metric];
}

/** Date of the habit's first log inside the dataset, or null when it was never logged. */
function firstLogDate(days: DayRecord[], habitId: number): string | null {
  for (const d of days) if (d.habitValues.has(habitId)) return d.date;
  return null;
}

/** "Habit "Reading" and higher mood" / "הרגל "קריאה" ומצב רוח גבוה יותר". */
function outcomeTitle(locale: Locale, habit: Habit, metric: Outcome, direction: 'higher' | 'lower'): string {
  return tr(locale, 'analysis.habit.title', { habit: habit.name, ...metricParams(locale, metric), direction });
}

/** "the link between the habit "Reading" and mood" - used in notes. */
function habitLabel(locale: Locale, habit: Habit, metric: Outcome): string {
  return tr(locale, 'analysis.habit.label', { habit: habit.name, metric: metricLabel(locale, metric) });
}

/** "4 times per week" - the weekly target as shown in explanations and evidence. */
function weeklyTargetText(locale: Locale, habit: Habit): string {
  return tr(locale, 'analysis.habit.weeklyTarget', { target: fmtInt(locale, habit.target), unit: habit.unit })
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Daily habits: completed days vs. the rest
// ---------------------------------------------------------------------------

function dailyHabit(ctx: DetectorContext, habit: Habit): Insight[] {
  const start = firstLogDate(ctx.ds.days, habit.id);
  if (!start) {
    addNote(ctx, tr(ctx.locale, 'analysis.habit.noLogs', { habit: habit.name }));
    return [];
  }
  const out: Insight[] = [];
  for (const o of OUTCOMES) {
    out.push(
      ...runSplit(ctx, {
        id: `habit_${o.metric}`,
        variant: String(habit.id),
        label: (l) => habitLabel(l, habit, o.metric),
        category: o.category,
        metric: o.metric,
        outcome: (d) => outcomeOf(d, o.metric),
        inGroupA: (d) => (d.date < start ? null : d.habitCompleted.get(habit.id) === true),
        groupALabel: (l) => tr(l, 'analysis.habit.groupA', { habit: habit.name }),
        groupBLabel: (l) => tr(l, 'analysis.habit.groupB', { habit: habit.name }),
        condition: (l) => tr(l, 'analysis.habit.condition', { habit: habit.name }),
        conditionPast: (l) => tr(l, 'analysis.habit.conditionPast', { habit: habit.name }),
        titleFor: (l, direction) => outcomeTitle(l, habit, o.metric, direction),
        correlationTitle: (l) => tr(l, 'analysis.habit.corrTitle', { habit: habit.name, metric: metricLabel(l, o.metric) }),
        positiveWhen: o.positiveWhen,
        quiet: o.quiet,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Weekly habits: weeks that met the target vs. weeks below it
// ---------------------------------------------------------------------------

interface WeekBucket {
  start: string;
  sum: number;
  days: DayRecord[];
}

/** Complete weeks (inside the period, ending on or before today) from the habit's first full week. */
function completeWeeks(ctx: DetectorContext, habit: Habit): WeekBucket[] {
  const first = firstLogDate(ctx.ds.days, habit.id);
  if (!first) return [];
  const firstWeek = weekStart(first, ctx.firstDayOfWeek);
  // Skip the first week when the habit started mid-week (its sum would be unfairly low).
  const startWeek = first === firstWeek ? firstWeek : addDays(firstWeek, 7);
  const lowerBound = ctx.ds.from && ctx.ds.from > startWeek ? weekStart(ctx.ds.from, ctx.firstDayOfWeek) : startWeek;
  const buckets = new Map<string, WeekBucket>();
  for (const d of ctx.ds.days) {
    const ws = weekStart(d.date, ctx.firstDayOfWeek);
    if (ws < lowerBound) continue;
    if (ctx.ds.from && ws < ctx.ds.from) continue; // partial week at the start of the period
    if (addDays(ws, 6) > ctx.today) continue; // current, still incomplete week
    let b = buckets.get(ws);
    if (!b) {
      b = { start: ws, sum: 0, days: [] };
      buckets.set(ws, b);
    }
    b.sum += d.habitValues.get(habit.id) ?? 0;
    b.days.push(d);
  }
  return [...buckets.values()].sort((x, y) => (x.start < y.start ? -1 : 1));
}

function weeklyHabit(ctx: DetectorContext, habit: Habit): Insight[] {
  const L = ctx.locale;
  const weeks = completeWeeks(ctx, habit);
  if (weeks.length === 0) {
    addNote(ctx, tr(L, 'analysis.habit.noFullWeeks', { habit: habit.name }));
    return [];
  }
  const out: Insight[] = [];
  const bounds = periodBounds(ctx);
  for (const o of OUTCOMES) {
    const note = (text: string) => {
      if (!o.quiet) addNote(ctx, text);
    };
    const label = habitLabel(L, habit, o.metric);
    const usable = weeks.filter((w) => w.days.some((d) => outcomeOf(d, o.metric) != null));
    if (usable.length < ANALYSIS.minWeeks) {
      note(insufficientDataNote(L, label, tr(L, 'analysis.req.fullWeeks', { count: ANALYSIS.minWeeks }), weeksCount(L, usable.length)));
      continue;
    }
    const met = usable.filter((w) => w.sum >= habit.target);
    const below = usable.filter((w) => w.sum < habit.target);
    const a: number[] = [];
    const b: number[] = [];
    for (const w of met) for (const d of w.days) {
      const v = outcomeOf(d, o.metric);
      if (v != null) a.push(v);
    }
    for (const w of below) for (const d of w.days) {
      const v = outcomeOf(d, o.metric);
      if (v != null) b.push(v);
    }
    if (met.length === 0 || below.length === 0 || a.length < ANALYSIS.minGroupSize || b.length < ANALYSIS.minGroupSize) {
      note(
        insufficientDataNote(
          L,
          label,
          tr(L, 'analysis.req.weekPerGroup', { count: ANALYSIS.minGroupSize }),
          tr(L, 'analysis.have.weeksTwoGroups', { metWeeks: met.length, metDays: a.length, belowWeeks: below.length, belowDays: b.length }),
        ),
      );
      continue;
    }
    const stats = groupStats(a, b);
    const diff = stats.diff as number;
    const strength = strengthFromDiff(diff);
    if (!strength) {
      note(nothingNotableNote(L, label, a.length + b.length));
      continue;
    }
    const meanA = stats.meanA as number;
    const meanB = stats.meanB as number;
    const direction = diff >= 0 ? 'higher' : 'lower';
    const targetText = weeklyTargetText(L, habit);
    const explanation = [
      tr(L, 'analysis.habit.weeklyExplainChecked', { weeks: usable.length, days: a.length + b.length, metric: metricLabel(L, o.metric) }),
      tr(L, 'analysis.habit.weeklyExplainMet', { count: met.length, target: targetText }),
      tr(L, 'analysis.habit.weeklyExplainMeans', {
        ...metricParams(L, o.metric),
        meanA: fmt1(L, meanA),
        meanB: fmt1(L, meanB),
        count: below.length,
      }),
      tr(L, 'analysis.explain.diffAndStrength', { diff: fmt1(L, Math.abs(diff)), strength: strengthLabel(L, strength) }),
    ].join(' ');
    out.push(
      makeInsight({
        id: `habit_${o.metric}_${habit.id}`,
        category: o.category,
        strength,
        title: outcomeTitle(L, habit, o.metric, direction),
        text: relationSentence(L, {
          condition: tr(L, 'analysis.habit.weeklyCondition', { habit: habit.name }),
          metric: o.metric as MetricKey,
          meanA,
          meanB,
        }),
        explanation,
        evidence: evidence({
          daysExamined: a.length + b.length,
          metricLabel: metricLabel(L, o.metric),
          groupALabel: tr(L, 'analysis.habit.groupAWeeks', { count: met.length }),
          groupACount: a.length,
          groupAMean: round(meanA),
          groupBLabel: tr(L, 'analysis.habit.groupBWeeks', { count: below.length }),
          groupBCount: b.length,
          groupBMean: round(meanB),
          effectSize: round(diff),
          extra: [
            { key: tr(L, 'analysis.extra.weeksChecked'), value: fmtInt(L, usable.length) },
            { key: tr(L, 'analysis.extra.weeklyTarget'), value: targetText },
            { key: tr(L, 'analysis.extra.strength'), value: strengthLabel(L, strength) },
          ],
        }),
        ...bounds,
        effect: Math.abs(diff),
        n: a.length + b.length,
        positive: o.positiveWhen(diff),
      }),
    );
  }
  return out;
}

export const habitMoodDetector: Detector = {
  id: 'habit_mood',
  label: (l) => tr(l, 'analysis.habit.detectorLabel'),
  detect(ctx) {
    if (ctx.habits.length === 0) {
      addNote(ctx, tr(ctx.locale, 'analysis.habit.noHabits'));
      return [];
    }
    const out: Insight[] = [];
    for (const habit of ctx.habits) {
      out.push(...(habit.frequency === 'weekly' ? weeklyHabit(ctx, habit) : dailyHabit(ctx, habit)));
    }
    return out;
  },
};
