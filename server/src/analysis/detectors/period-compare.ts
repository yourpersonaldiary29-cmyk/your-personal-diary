/**
 * period-compare: the current calendar month (so far) against the previous month for
 * mood, stress, sleep hours and the number of entries.
 *
 * Ratings are compared as means over the days that reported them (>= minGroupSize days in
 * each month). Entries are compared over equal windows - the first D days of both months,
 * where D is today's day of the month - so a month that has only just started is not
 * unfairly "behind".
 */
import { ANALYSIS } from '@shared/constants';
import type { Insight } from '@shared/types';
import type { DayRecord } from '../../db/dataset';
import { daysInMonth, monthOf } from '../../util/dates';
import { mean, round } from '../math';
import { fmt1, fmtPercent, insufficientDataNote, metricLabel, metricParams, monthName, strengthLabel, tr, type MetricKey } from '../phrasing';
import { evidence, makeInsight, strengthFromDiff, strengthFromThresholds } from '../scoring';
import { addNote, periodBounds, type Detector, type DetectorContext } from '../types';

type Metric = 'mood' | 'stress' | 'sleepHours';
const METRICS: Metric[] = ['mood', 'stress', 'sleepHours'];

/** Relative change thresholds for the entries comparison (weak / moderate / strong). */
const ENTRIES_THRESHOLDS: readonly [number, number, number] = [0.25, 0.5, 1.0];
/** Absolute minimum difference in entries before a comparison is reported. */
const ENTRIES_MIN_DIFF = 2;

/** "YYYY-MM" of the month before the given one. */
export function previousMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function positiveFor(metric: Metric, diff: number): boolean {
  return metric === 'stress' ? diff < 0 : diff > 0;
}

function compareMetric(
  ctx: DetectorContext,
  metric: Metric,
  cur: DayRecord[],
  prev: DayRecord[],
  curName: string,
  prevName: string,
): { insight: Insight | null; evaluated: boolean } {
  const L = ctx.locale;
  const a = cur.map((d) => d[metric]).filter((v): v is number => v != null);
  const b = prev.map((d) => d[metric]).filter((v): v is number => v != null);
  if (a.length < ANALYSIS.minGroupSize || b.length < ANALYSIS.minGroupSize) return { insight: null, evaluated: false };
  const meanA = mean(a) as number;
  const meanB = mean(b) as number;
  const diff = meanA - meanB;
  const strength = strengthFromDiff(diff);
  if (!strength) return { insight: null, evaluated: true };
  const key = metric as MetricKey;
  const params = metricParams(L, key);
  const direction = diff >= 0 ? 'higher' : 'lower';
  const unit = metric === 'sleepHours' ? 'hours' : 'points';
  const text = tr(L, 'analysis.periodCompare.text', {
    ...params,
    cur: curName,
    prev: prevName,
    direction,
    meanA: fmt1(L, meanA),
    meanB: fmt1(L, meanB),
  });
  const explanation = tr(L, 'analysis.periodCompare.explain', {
    metric: params.metric,
    cur: curName,
    prev: prevName,
    countA: a.length,
    countB: b.length,
    meanA: fmt1(L, meanA),
    meanB: fmt1(L, meanB),
    diff: fmt1(L, Math.abs(diff)),
    unit,
    strength: strengthLabel(L, strength),
  });
  const insight = makeInsight({
    id: `month_compare_${metric}`,
    category: 'month_comparison',
    strength,
    title: tr(L, 'analysis.periodCompare.title', { ...params, cur: curName, prev: prevName, direction }),
    text,
    explanation,
    evidence: evidence({
      daysExamined: a.length + b.length,
      metricLabel: params.metric,
      groupALabel: curName,
      groupACount: a.length,
      groupAMean: round(meanA),
      groupBLabel: prevName,
      groupBCount: b.length,
      groupBMean: round(meanB),
      effectSize: round(diff),
      extra: [{ key: tr(L, 'analysis.extra.strength'), value: strengthLabel(L, strength) }],
    }),
    ...periodBounds(ctx),
    effect: Math.abs(diff),
    n: a.length + b.length,
    positive: positiveFor(metric, diff),
  });
  return { insight, evaluated: true };
}

function compareEntries(
  ctx: DetectorContext,
  cur: DayRecord[],
  prev: DayRecord[],
  curName: string,
  prevName: string,
  prevMonth: string,
  windowDays: number,
): { insight: Insight | null; evaluated: boolean } {
  const L = ctx.locale;
  // A previous month without any data (the diary did not exist yet, or the period starts
  // later) is nothing to compare against - "more than zero" would be a hollow insight.
  if (prev.length === 0 || cur.length === 0) return { insight: null, evaluated: false };
  // The analysed period must cover the previous month's comparison window (its first
  // `windowDays` days). A 30-day period that starts on the 25th of the previous month
  // contains that month's last days only, and counting zero entries in a window the
  // dataset never saw would report a hollow "more than last month".
  const prevWindowStart = `${prevMonth}-01`;
  if (ctx.ds.from !== null && ctx.ds.from > prevWindowStart) return { insight: null, evaluated: false };
  const inWindow = (d: DayRecord) => Number(d.date.slice(8, 10)) <= windowDays;
  const countA = cur.filter(inWindow).reduce((s, d) => s + d.entryCount, 0);
  const countB = prev.filter(inWindow).reduce((s, d) => s + d.entryCount, 0);
  if (countA + countB === 0 || Math.max(countA, countB) < 3) return { insight: null, evaluated: false };
  const diff = countA - countB;
  const relative = diff / Math.max(countB, 1);
  const strength = Math.abs(diff) >= ENTRIES_MIN_DIFF ? strengthFromThresholds(relative, ENTRIES_THRESHOLDS) : null;
  if (!strength) return { insight: null, evaluated: true };
  const more = diff > 0;
  const direction = more ? 'more' : 'less';
  const text = tr(L, 'analysis.periodCompare.entriesText', { direction, window: windowDays, cur: curName, prev: prevName, countA, countB });
  const explanation = tr(L, 'analysis.periodCompare.entriesExplain', {
    window: windowDays,
    cur: curName,
    prev: prevName,
    countA,
    countB,
    diff: Math.abs(diff),
    percent: fmtPercent(L, Math.abs(relative)),
    strength: strengthLabel(L, strength),
  });
  const insight = makeInsight({
    id: 'month_compare_entries',
    category: 'month_comparison',
    strength,
    title: tr(L, 'analysis.periodCompare.entriesTitle', { direction, cur: curName, prev: prevName }),
    text,
    explanation,
    evidence: evidence({
      daysExamined: windowDays * 2,
      metricLabel: metricLabel(L, 'entries'),
      groupALabel: tr(L, 'analysis.periodCompare.monthWindow', { month: curName, window: windowDays }),
      groupACount: countA,
      groupAMean: countA,
      groupBLabel: tr(L, 'analysis.periodCompare.monthWindow', { month: prevName, window: windowDays }),
      groupBCount: countB,
      groupBMean: countB,
      effectSize: diff,
      extra: [
        { key: tr(L, 'analysis.extra.relativeChange'), value: fmtPercent(L, Math.abs(relative)) },
        { key: tr(L, 'analysis.extra.strength'), value: strengthLabel(L, strength) },
      ],
    }),
    ...periodBounds(ctx),
    effect: Math.min(Math.abs(relative), 3),
    n: countA + countB,
    positive: more,
  });
  return { insight, evaluated: true };
}

export const periodCompareDetector: Detector = {
  id: 'period_compare',
  label: (l) => tr(l, 'analysis.periodCompare.label'),
  detect(ctx) {
    const L = ctx.locale;
    const curMonth = monthOf(ctx.today);
    const prevMonth = previousMonth(curMonth);
    const [py, pm] = prevMonth.split('-').map(Number);
    // A period that starts after the previous month ended (7 days; 30 days on the last day of a
    // month) cannot hold this comparison at all. Say nothing rather than "not enough data ...
    // 0 days in August", which reads as if the diary had no August data.
    const prevMonthEnd = `${prevMonth}-${String(daysInMonth(py, pm)).padStart(2, '0')}`;
    if (ctx.ds.from !== null && ctx.ds.from > prevMonthEnd) return [];
    const cur = ctx.ds.days.filter((d) => monthOf(d.date) === curMonth);
    const prev = ctx.ds.days.filter((d) => monthOf(d.date) === prevMonth);
    const curName = monthName(L, curMonth);
    const prevName = monthName(L, prevMonth);
    const out: Insight[] = [];
    let evaluated = false;

    for (const metric of METRICS) {
      const r = compareMetric(ctx, metric, cur, prev, curName, prevName);
      evaluated = evaluated || r.evaluated;
      if (r.insight) out.push(r.insight);
    }
    const windowDays = Math.min(Number(ctx.today.slice(8, 10)), daysInMonth(py, pm));
    const e = compareEntries(ctx, cur, prev, curName, prevName, prevMonth, windowDays);
    evaluated = evaluated || e.evaluated;
    if (e.insight) out.push(e.insight);

    if (!evaluated) {
      addNote(
        ctx,
        insufficientDataNote(
          L,
          tr(L, 'analysis.periodCompare.insufficientWhat', { cur: curName, prev: prevName }),
          tr(L, 'analysis.req.daysPerMonth', { count: ANALYSIS.minGroupSize }),
          tr(L, 'analysis.have.twoMonths', { countA: cur.length, cur: curName, countB: prev.length, prev: prevName }),
        ),
      );
    } else if (out.length === 0) {
      addNote(ctx, tr(L, 'analysis.periodCompare.nothing', { cur: curName, prev: prevName }));
    }
    return out;
  },
};
