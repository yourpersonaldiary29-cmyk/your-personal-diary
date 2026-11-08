/**
 * anomalies: days whose mood or stress is at least ANALYSIS.anomalyZ standard deviations
 * away from the period mean. Needs >= 14 days with the value. Unusually high and unusually
 * low days are reported separately so the `positive` flag stays meaningful.
 */
import { ANALYSIS } from '@shared/constants';
import type { Insight } from '@shared/types';
import type { DayRecord } from '../../db/dataset';
import { mean, round, stddev, zScores } from '../math';
import { daysCount, dayWithDate, fmt1, insufficientDataNote, joinList, joinSemicolon, metricParams, shortDate, strengthLabel, tr, type MetricKey } from '../phrasing';
import { evidence, makeInsight, strengthFromThresholds } from '../scoring';
import { addNote, periodBounds, type Detector, type DetectorContext } from '../types';

type Metric = 'mood' | 'stress';
const METRICS: Metric[] = ['mood', 'stress'];
/** |z| thresholds for weak / moderate / strong. */
const Z_THRESHOLDS: readonly [number, number, number] = [ANALYSIS.anomalyZ, 2.5, 3];
/** Dates named in the sentence (all of them stay in the evidence). */
const MAX_NAMED = 5;

interface Outlier {
  day: DayRecord;
  value: number;
  z: number;
}

function positiveFor(metric: Metric, high: boolean): boolean {
  return metric === 'stress' ? !high : high;
}

function build(ctx: DetectorContext, metric: Metric, side: 'high' | 'low', outliers: Outlier[], all: number[], m: number, sd: number): Insight {
  const L = ctx.locale;
  const key = metric as MetricKey;
  const params = metricParams(L, key);
  const sorted = [...outliers].sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  const strength = strengthFromThresholds(sorted[0].z, Z_THRESHOLDS) ?? 'weak';
  const named = sorted.slice(0, MAX_NAMED);
  const otherCount = all.length - outliers.length;
  const otherMean = otherCount > 0 ? (m * all.length - (mean(outliers.map((o) => o.value)) as number) * outliers.length) / otherCount : null;
  const periodMean = fmt1(L, m);

  const text =
    outliers.length === 1
      ? tr(L, 'analysis.anomalies.textOne', { day: dayWithDate(L, sorted[0].day.date), ...params, side, value: fmt1(L, sorted[0].value), mean: periodMean })
      : tr(L, outliers.length > MAX_NAMED ? 'analysis.anomalies.textManyMore' : 'analysis.anomalies.textMany', {
          count: outliers.length,
          ...params,
          side,
          days: joinList(
            L,
            named.map((o) => tr(L, 'analysis.anomalies.dayItem', { day: dayWithDate(L, o.day.date), value: fmt1(L, o.value) })),
          ),
          mean: periodMean,
        });
  const details = joinSemicolon(
    L,
    sorted.map((o) =>
      tr(L, 'analysis.anomalies.detail', {
        date: shortDate(L, o.day.date),
        value: fmt1(L, o.value),
        z: fmt1(L, Math.abs(o.z)),
        side: o.z > 0 ? 'above' : 'below',
      }),
    ),
  );
  const explanation = tr(L, 'analysis.anomalies.explain', {
    count: all.length,
    metric: params.metric,
    mean: periodMean,
    sd: fmt1(L, sd),
    z: fmt1(L, ANALYSIS.anomalyZ),
    details,
    strength: strengthLabel(L, strength),
  });
  return makeInsight({
    id: `anomaly_${metric}_${side}`,
    category: 'anomaly',
    strength,
    title: tr(L, 'analysis.anomalies.title', { count: outliers.length, ...params, side }),
    text,
    explanation,
    evidence: evidence({
      daysExamined: all.length,
      metricLabel: params.metric,
      groupALabel: tr(L, 'analysis.anomalies.groupA'),
      groupACount: outliers.length,
      groupAMean: round(mean(outliers.map((o) => o.value)) as number),
      groupBLabel: tr(L, 'analysis.groupB.otherDays'),
      groupBCount: otherCount,
      groupBMean: otherMean == null ? null : round(otherMean),
      effectSize: round(Math.abs(sorted[0].z), 2),
      dates: sorted.map((o) => o.day.date),
      extra: [
        { key: tr(L, 'analysis.extra.periodMean'), value: periodMean },
        { key: tr(L, 'analysis.extra.stddev'), value: fmt1(L, sd) },
        ...sorted.map((o) => ({
          key: shortDate(L, o.day.date),
          value: tr(L, 'analysis.anomalies.zValue', { value: fmt1(L, o.value), z: fmt1(L, Math.abs(o.z)) }),
        })),
      ],
    }),
    ...periodBounds(ctx),
    effect: Math.abs(sorted[0].z) - 1,
    n: all.length,
    positive: positiveFor(metric, side === 'high'),
  });
}

export const anomaliesDetector: Detector = {
  id: 'anomalies',
  label: (l) => tr(l, 'analysis.anomalies.label'),
  detect(ctx) {
    const L = ctx.locale;
    const out: Insight[] = [];
    let maxN = 0;
    let evaluated = false;
    for (const metric of METRICS) {
      const days = ctx.ds.days.filter((d) => d[metric] != null);
      const values = days.map((d) => d[metric] as number);
      maxN = Math.max(maxN, values.length);
      if (values.length < ANALYSIS.minDaysForRelationship) continue;
      evaluated = true;
      const m = mean(values) as number;
      const sd = stddev(values);
      if (sd == null || sd === 0) continue;
      const zs = zScores(values);
      const high: Outlier[] = [];
      const low: Outlier[] = [];
      zs.forEach((z, i) => {
        if (z >= ANALYSIS.anomalyZ) high.push({ day: days[i], value: values[i], z });
        else if (z <= -ANALYSIS.anomalyZ) low.push({ day: days[i], value: values[i], z });
      });
      if (high.length) out.push(build(ctx, metric, 'high', high, values, m, sd));
      if (low.length) out.push(build(ctx, metric, 'low', low, values, m, sd));
    }
    if (!evaluated) {
      addNote(
        ctx,
        insufficientDataNote(L, this.label(L), tr(L, 'analysis.req.daysWithReport', { count: ANALYSIS.minDaysForRelationship }), daysCount(L, maxN)),
      );
    } else if (out.length === 0) {
      addNote(ctx, tr(L, 'analysis.anomalies.nothing', { count: maxN, z: fmt1(L, ANALYSIS.anomalyZ) }));
    }
    return out;
  },
};
