/**
 * trends: direction of mood, stress and sleep hours over three horizons.
 *
 * For each metric a daily series (null on days without a report) is smoothed with a
 * 7-day moving average; a least-squares line through the smoothed values gives the slope.
 * The change over the window (slope x window length) is graded with the rating-point
 * thresholds of ANALYSIS (0.5 / 1.0 / 1.5 points, or hours for sleep).
 *
 * Horizons: the last 14 days ("weekly_trend"), the last 30 days ("monthly_trend") and the
 * whole period when it is longer than 45 days ("mood_change" / "stress_change" / "sleep_change").
 * Longer horizons are evaluated first; a shorter horizon is skipped when a longer one already
 * reported the same metric in the same direction.
 */
import type { Insight, InsightCategory } from '@shared/types';
import { addDays, dateRange } from '../../util/dates';
import { linearFit, movingAverage, round } from '../math';
import { daysCount, fmt1, fmt2, fmtInt, insufficientDataNote, metricParams, shortDate, strengthLabel, tr, type MetricKey } from '../phrasing';
import { evidence, makeInsight, strengthFromDiff } from '../scoring';
import { addNote, periodBounds, type Detector, type DetectorContext } from '../types';

type Metric = 'mood' | 'stress' | 'sleepHours';
const METRICS: Metric[] = ['mood', 'stress', 'sleepHours'];

export const MOVING_WINDOW = 7;

interface Horizon {
  /** Also the `horizon` select value of the catalogue templates. */
  key: 'weekly' | 'monthly' | 'period';
  /** Window length in days; null = the whole series. */
  days: number | null;
  /** Minimum reported days inside the window. */
  minPoints: number;
}

const HORIZONS: Horizon[] = [
  { key: 'period', days: null, minPoints: 20 },
  { key: 'monthly', days: 30, minPoints: 15 },
  { key: 'weekly', days: 14, minPoints: 8 },
];

const WEEKLY_MIN_POINTS = HORIZONS.find((h) => h.key === 'weekly')!.minPoints;

/** Series longer than this gets the whole-period horizon in addition to the monthly one. */
const PERIOD_HORIZON_MIN_DAYS = 45;

function categoryFor(h: Horizon, metric: Metric): InsightCategory {
  if (h.key === 'weekly') return 'weekly_trend';
  if (h.key === 'monthly') return 'monthly_trend';
  return metric === 'mood' ? 'mood_change' : metric === 'stress' ? 'stress_change' : 'sleep_change';
}

function positiveFor(metric: Metric, change: number): boolean {
  return metric === 'stress' ? change < 0 : change > 0;
}

interface TrendResult {
  insight: Insight | null;
  /** True when the window had enough data to be evaluated. */
  evaluated: boolean;
}

function detectHorizon(
  ctx: DetectorContext,
  metric: Metric,
  dates: string[],
  raw: (number | null)[],
  h: Horizon,
): TrendResult {
  const L = ctx.locale;
  const total = dates.length;
  const len = h.days == null ? total : Math.min(h.days, total);
  if (h.days != null && total < Math.ceil(h.days * 0.7)) return { insight: null, evaluated: false };
  const start = total - len;
  const windowRaw = raw.slice(start);
  const windowDates = dates.slice(start);
  const points = windowRaw.filter((v) => v != null).length;
  if (points < h.minPoints) return { insight: null, evaluated: false };

  // The moving average is computed on the full series so the window's first values
  // can look back at the days just before it.
  const ma = movingAverage(raw, MOVING_WINDOW).slice(start);
  const fit = linearFit(ma);
  if (!fit) return { insight: null, evaluated: false };
  const change = fit.slope * (len - 1);
  const strength = strengthFromDiff(change);
  if (!strength) return { insight: null, evaluated: true };

  const key = metric as MetricKey;
  const params = metricParams(L, key);
  const direction = change > 0 ? 'up' : 'down';
  const fittedStart = fit.intercept;
  const fittedEnd = fit.intercept + fit.slope * (len - 1);
  const unit = metric === 'sleepHours' ? 'hours' : 'points';
  const fromValue = fmt1(L, fittedStart);
  const toValue = fmt1(L, fittedEnd);

  const text = tr(L, 'analysis.trends.text', { ...params, direction, horizon: h.key, fromValue, toValue });
  const explanation = [
    tr(L, 'analysis.trends.explainChecked', {
      count: points,
      metric: params.metric,
      len,
      horizon: h.key,
      from: shortDate(L, windowDates[0]),
      to: shortDate(L, windowDates[windowDates.length - 1]),
    }),
    tr(L, 'analysis.trends.explainFit', {
      window: MOVING_WINDOW,
      slope: fmt2(L, Math.abs(fit.slope)),
      unit,
      direction,
      change: fmt1(L, Math.abs(change)),
      fromValue,
      toValue,
      strength: strengthLabel(L, strength),
    }),
  ].join(' ');

  const insight = makeInsight({
    id: `trend_${h.key}_${metric}`,
    category: categoryFor(h, metric),
    strength,
    // `metric` is the metric key here: the title template selects the noun phrase itself.
    title: tr(L, 'analysis.trends.title', { direction, metric, horizon: h.key }),
    text,
    explanation,
    evidence: evidence({
      daysExamined: points,
      metricLabel: params.metric,
      groupALabel: tr(L, 'analysis.trends.groupA'),
      groupACount: Math.ceil(points / 2),
      groupAMean: round(fittedStart),
      groupBLabel: tr(L, 'analysis.trends.groupB'),
      groupBCount: Math.floor(points / 2),
      groupBMean: round(fittedEnd),
      effectSize: round(change),
      dates: [windowDates[0], windowDates[windowDates.length - 1]],
      extra: [
        { key: tr(L, 'analysis.extra.slopePerDay'), value: tr(L, 'analysis.trends.slopeValue', { slope: fmt2(L, fit.slope), unit }) },
        { key: tr(L, 'analysis.extra.daysInWindow'), value: fmtInt(L, len) },
        { key: tr(L, 'analysis.extra.movingWindow'), value: daysCount(L, MOVING_WINDOW) },
        { key: tr(L, 'analysis.extra.strength'), value: strengthLabel(L, strength) },
      ],
    }),
    ...periodBounds(ctx),
    effect: Math.abs(change),
    n: points,
    positive: positiveFor(metric, change),
  });
  return { insight, evaluated: true };
}

export const trendsDetector: Detector = {
  id: 'trends',
  label: (l) => tr(l, 'analysis.trends.label'),
  detect(ctx) {
    const L = ctx.locale;
    const label = this.label(L);
    const days = ctx.ds.days;
    if (days.length === 0) {
      addNote(ctx, insufficientDataNote(L, label, tr(L, 'analysis.req.recentDays', { count: WEEKLY_MIN_POINTS }), tr(L, 'analysis.have.noData')));
      return [];
    }
    const seriesStart = ctx.ds.from ?? days[0].date;
    const dates = dateRange(seriesStart, ctx.today);
    const byDate = new Map(days.map((d) => [d.date, d]));
    const out: Insight[] = [];
    let anyEvaluated = false;

    for (const metric of METRICS) {
      const raw = dates.map((date) => byDate.get(date)?.[metric] ?? null);
      const reported: Record<'up' | 'down', boolean> = { up: false, down: false };
      for (const h of HORIZONS) {
        if (h.key === 'period' && dates.length <= PERIOD_HORIZON_MIN_DAYS) continue;
        const { insight, evaluated } = detectHorizon(ctx, metric, dates, raw, h);
        anyEvaluated = anyEvaluated || evaluated;
        if (!insight) continue;
        const dir = (insight.evidence.effectSize ?? 0) > 0 ? 'up' : 'down';
        if (reported[dir]) continue; // a longer horizon already said this
        reported[dir] = true;
        out.push(insight);
      }
    }

    if (!anyEvaluated) {
      const recent = dates.slice(-14).filter((date) => byDate.get(date)?.mood != null).length;
      addNote(ctx, insufficientDataNote(L, label, tr(L, 'analysis.req.recentDays', { count: WEEKLY_MIN_POINTS }), daysCount(L, recent)));
    } else if (out.length === 0) {
      addNote(ctx, ctx.ds.from ? tr(L, 'analysis.trends.nothingSince', { from: shortDate(L, ctx.ds.from) }) : tr(L, 'analysis.trends.nothingAll'));
    }
    return out;
  },
};

/** Exported for tests: the first date of the daily series used by the detector. */
export function seriesStartOf(ctx: DetectorContext): string {
  return ctx.ds.from ?? (ctx.ds.days.length ? ctx.ds.days[0].date : addDays(ctx.today, 0));
}
