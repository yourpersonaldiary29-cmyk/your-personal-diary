/**
 * weekday: each weekday against the other six, for stress, mood and energy.
 * A weekday needs at least 3 samples and the rest at least ANALYSIS.minGroupSize.
 * At most the two most different weekdays per metric are reported to keep the list short.
 */
import { ANALYSIS } from '@shared/constants';
import type { Insight, KeyValue } from '@shared/types';
import type { DayRecord } from '../../db/dataset';
import { groupStats, round } from '../math';
import {
  daysCount,
  fmt1,
  insufficientDataNote,
  metricLabel,
  metricParams,
  onWeekday,
  strengthLabel,
  tr,
  weekdayPlural,
  type MetricKey,
} from '../phrasing';
import { evidence, makeInsight, strengthFromDiff } from '../scoring';
import { addNote, periodBounds, type Detector, type DetectorContext } from '../types';

type Metric = 'stress' | 'mood' | 'energy';
const METRICS: Metric[] = ['stress', 'mood', 'energy'];

/** Minimum samples of the weekday itself (the rest must have ANALYSIS.minGroupSize). */
export const MIN_WEEKDAY_SAMPLES = 3;
/** Maximum insights per metric. */
const MAX_PER_METRIC = 2;

interface Candidate {
  weekday: number;
  a: number[];
  b: number[];
  diff: number;
  meanA: number;
  meanB: number;
}

function valueOf(d: DayRecord, metric: Metric): number | null {
  return d[metric];
}

function positiveFor(metric: Metric, diff: number): boolean {
  // Higher stress is unwelcome; higher mood / energy is welcome.
  return metric === 'stress' ? diff < 0 : diff > 0;
}

function detectMetric(ctx: DetectorContext, metric: Metric): { insights: Insight[]; n: number } {
  const L = ctx.locale;
  const days = ctx.ds.days.filter((d) => valueOf(d, metric) != null);
  const n = days.length;
  if (n < ANALYSIS.minDaysForRelationship) return { insights: [], n };

  const perWeekday: number[][] = Array.from({ length: 7 }, () => []);
  for (const d of days) perWeekday[d.weekday].push(valueOf(d, metric) as number);

  const candidates: Candidate[] = [];
  for (let w = 0; w < 7; w++) {
    const a = perWeekday[w];
    if (a.length < MIN_WEEKDAY_SAMPLES) continue;
    const b: number[] = [];
    for (let o = 0; o < 7; o++) if (o !== w) b.push(...perWeekday[o]);
    if (b.length < ANALYSIS.minGroupSize) continue;
    const stats = groupStats(a, b);
    if (stats.diff == null || !strengthFromDiff(stats.diff)) continue;
    candidates.push({ weekday: w, a, b, diff: stats.diff, meanA: stats.meanA as number, meanB: stats.meanB as number });
  }
  candidates.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));

  const bounds = periodBounds(ctx);
  const key = metric as MetricKey;
  const params = metricParams(L, key);
  const weekdayTable: KeyValue[] = [];
  for (let w = 0; w < 7; w++) {
    const vals = perWeekday[w];
    if (vals.length === 0) continue;
    const m = vals.reduce((s, v) => s + v, 0) / vals.length;
    weekdayTable.push({ key: weekdayPlural(L, w), value: tr(L, 'analysis.weekday.tableValue', { mean: fmt1(L, m), count: vals.length }) });
  }

  const insights = candidates.slice(0, MAX_PER_METRIC).map((c) => {
    const strength = strengthFromDiff(c.diff)!;
    const direction = c.diff >= 0 ? 'higher' : 'lower';
    const weekdays = weekdayPlural(L, c.weekday);
    const on = onWeekday(L, c.weekday);
    const text = tr(L, 'analysis.weekday.text', { onWeekday: on, ...params, direction, meanA: fmt1(L, c.meanA), meanB: fmt1(L, c.meanB) });
    const explanation = [
      tr(L, 'analysis.weekday.explainChecked', { count: n, metric: params.metric, countA: c.a.length, weekdays }),
      tr(L, 'analysis.weekday.explainMeans', { ...params, onWeekday: on, meanA: fmt1(L, c.meanA), meanB: fmt1(L, c.meanB) }),
      tr(L, 'analysis.explain.diffStrength', { diff: fmt1(L, Math.abs(c.diff)), strength: strengthLabel(L, strength) }),
    ].join(' ');
    return makeInsight({
      id: `weekday_${metric}_${c.weekday}`,
      category: 'weekday',
      strength,
      title: tr(L, 'analysis.weekday.title', { weekdays, ...params, direction }),
      text,
      explanation,
      evidence: evidence({
        daysExamined: n,
        metricLabel: params.metric,
        groupALabel: weekdays,
        groupACount: c.a.length,
        groupAMean: round(c.meanA),
        groupBLabel: tr(L, 'analysis.weekday.groupB'),
        groupBCount: c.b.length,
        groupBMean: round(c.meanB),
        effectSize: round(c.diff),
        extra: [{ key: tr(L, 'analysis.extra.strength'), value: strengthLabel(L, strength) }, ...weekdayTable],
      }),
      ...bounds,
      effect: Math.abs(c.diff),
      n,
      positive: positiveFor(metric, c.diff),
    });
  });
  return { insights, n };
}

export const weekdayDetector: Detector = {
  id: 'weekday',
  label: (l) => tr(l, 'analysis.weekday.label'),
  detect(ctx) {
    const L = ctx.locale;
    const out: Insight[] = [];
    let maxN = 0;
    let checked = false;
    for (const metric of METRICS) {
      const { insights, n } = detectMetric(ctx, metric);
      maxN = Math.max(maxN, n);
      if (n >= ANALYSIS.minDaysForRelationship) checked = true;
      out.push(...insights);
    }
    if (!checked) {
      addNote(
        ctx,
        insufficientDataNote(L, this.label(L), tr(L, 'analysis.req.daysWithReport', { count: ANALYSIS.minDaysForRelationship }), daysCount(L, maxN)),
      );
    } else if (out.length === 0) {
      addNote(ctx, tr(L, 'analysis.weekday.nothing', { count: maxN }));
    }
    return out;
  },
};

/** Exported for tests: the short metric label in the given locale. */
export { metricLabel };
