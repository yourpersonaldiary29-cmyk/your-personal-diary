/**
 * Shared implementation of the "two groups of days" detectors:
 * days that satisfy a condition (short sleep, exercise, habit completed) versus the rest,
 * compared on an outcome metric (mood, energy, stress), plus Pearson r when the
 * condition has a continuous form (sleep hours, exercise minutes).
 *
 * Thresholds come from `shared/constants` ANALYSIS (see ARCHITECTURE.md 8.2):
 *  - at least `minDaysForRelationship` days with both values,
 *  - at least `minGroupSize` days in each group for a mean comparison,
 *  - strength = the stronger of the mean-difference and the correlation thresholds.
 *
 * Every label of a config is a function of the locale so the same detector renders its
 * notes, titles and evidence in the request language.
 */
import { ANALYSIS } from '@shared/constants';
import type { Locale } from '@shared/i18n';
import type { Insight, InsightCategory } from '@shared/types';
import type { DayRecord } from '../../db/dataset';
import { groupStats, pearson, round } from '../math';
import {
  correlationSentence,
  daysCount,
  fmt1,
  fmt2,
  groupExplanation,
  insufficientDataNote,
  metricDefined,
  metricLabel,
  nothingNotableNote,
  relationSentence,
  strengthLabel,
  tr,
  type MetricKey,
} from '../phrasing';
import { evidence, makeInsight, strengthFromDiff, strengthFromR, strongest } from '../scoring';
import { addNote, periodBounds, type Detector, type DetectorContext } from '../types';

/** Days with fewer hours than this count as "short sleep" (ARCHITECTURE.md 8.1). */
export const SHORT_SLEEP_HOURS = 6;

type Text = (locale: Locale) => string;

export interface SplitConfig {
  /** Detector id and insight id prefix, e.g. "sleep_mood". */
  id: string;
  /** Insight id suffix, e.g. "lt6" -> "sleep_mood_lt6". */
  variant: string;
  /** Description used in notes, e.g. "the link between sleep and mood". */
  label: Text;
  category: InsightCategory;
  /** Outcome metric compared between the groups. */
  metric: MetricKey;
  outcome: (d: DayRecord) => number | null;
  /** true -> group A, false -> group B, null -> the day is skipped (condition unknown). */
  inGroupA: (d: DayRecord) => boolean | null;
  groupALabel: Text;
  groupBLabel: Text;
  /** "on days when you slept fewer than 6 hours" - used in the hedged sentence. */
  condition: Text;
  /** "slept fewer than 6 hours" - used in the explanation after "On 17 days you". */
  conditionPast: Text;
  /** Continuous form of the condition for Pearson r (sleep hours, exercise minutes). */
  predictor?: { metric: MetricKey; value: (d: DayRecord) => number | null };
  /** Title for the group-comparison insight given the direction of group A. */
  titleFor: (locale: Locale, direction: 'higher' | 'lower') => string;
  /** Title for the correlation-only fallback. */
  correlationTitle: Text;
  /** Maps the mean difference (A - B) to the `positive` flag. */
  positiveWhen: (diff: number) => boolean | null;
  /** When true no notes are added (secondary checks that only report when notable). */
  quiet?: boolean;
}

export interface SplitData {
  a: number[];
  b: number[];
  xs: number[];
  ys: number[];
  /** Days with outcome and condition known. */
  n: number;
  r: number | null;
}

/** Collects the two groups and the correlation pairs for a config. */
export function collectSplit(days: DayRecord[], cfg: SplitConfig): SplitData {
  const a: number[] = [];
  const b: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (const d of days) {
    const y = cfg.outcome(d);
    if (y == null) continue;
    const inA = cfg.inGroupA(d);
    if (inA === true) a.push(y);
    else if (inA === false) b.push(y);
    if (cfg.predictor) {
      const x = cfg.predictor.value(d);
      if (x != null) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  const r = cfg.predictor && xs.length >= ANALYSIS.minDaysForRelationship ? pearson(xs, ys) : null;
  return { a, b, xs, ys, n: a.length + b.length, r };
}

/** Runs the split comparison and returns 0 or 1 insight (adding notes when appropriate). */
export function runSplit(ctx: DetectorContext, cfg: SplitConfig): Insight[] {
  const L = ctx.locale;
  const data = collectSplit(ctx.ds.days, cfg);
  const bounds = periodBounds(ctx);
  const label = cfg.label(L);
  const groupA = cfg.groupALabel(L);
  const groupB = cfg.groupBLabel(L);
  const outcomeLabel = metricLabel(L, cfg.metric);
  const note = (text: string) => {
    if (!cfg.quiet) addNote(ctx, text);
  };

  if (data.n < ANALYSIS.minDaysForRelationship) {
    note(insufficientDataNote(L, label, tr(L, 'analysis.req.daysBothValues', { count: ANALYSIS.minDaysForRelationship }), daysCount(L, data.n)));
    return [];
  }

  const enoughPerGroup = data.a.length >= ANALYSIS.minGroupSize && data.b.length >= ANALYSIS.minGroupSize;
  if (!enoughPerGroup) {
    // A mean comparison is not possible, but a correlation over the continuous form may be.
    const rStrength = strengthFromR(data.r);
    if (cfg.predictor && data.r != null && rStrength) {
      const stats = groupStats(data.a, data.b);
      const explanation = [
        tr(L, 'analysis.split.corrExplainChecked', {
          count: data.xs.length,
          x: metricDefined(L, cfg.predictor.metric),
          y: metricDefined(L, cfg.metric),
        }),
        tr(L, 'analysis.split.corrExplainPearson', { r: fmt2(L, data.r), strength: strengthLabel(L, rStrength) }),
        tr(L, 'analysis.split.corrExplainGroups', {
          groupA,
          countA: data.a.length,
          groupB,
          countB: data.b.length,
          min: ANALYSIS.minGroupSize,
        }),
      ].join(' ');
      return [
        makeInsight({
          id: `${cfg.id}_corr`,
          category: cfg.category,
          strength: rStrength,
          title: cfg.correlationTitle(L),
          text: correlationSentence(L, { metricX: cfg.predictor.metric, metricY: cfg.metric, r: data.r }),
          explanation,
          evidence: evidence({
            daysExamined: data.xs.length,
            metricLabel: outcomeLabel,
            groupALabel: groupA,
            groupACount: stats.countA,
            groupAMean: stats.meanA == null ? null : round(stats.meanA),
            groupBLabel: groupB,
            groupBCount: stats.countB,
            groupBMean: stats.meanB == null ? null : round(stats.meanB),
            correlation: round(data.r, 2),
            effectSize: null,
            extra: [
              { key: tr(L, 'analysis.extra.predictor'), value: metricLabel(L, cfg.predictor.metric) },
              { key: tr(L, 'analysis.extra.strength'), value: strengthLabel(L, rStrength) },
            ],
          }),
          ...bounds,
          effect: Math.abs(data.r) * 3,
          n: data.xs.length,
          positive: null,
        }),
      ];
    }
    note(
      insufficientDataNote(
        L,
        label,
        tr(L, 'analysis.req.daysPerGroup', { count: ANALYSIS.minGroupSize }),
        tr(L, 'analysis.have.twoGroups', { groupA, countA: data.a.length, groupB, countB: data.b.length }),
      ),
    );
    return [];
  }

  const stats = groupStats(data.a, data.b);
  const diff = stats.diff as number;
  const meanA = stats.meanA as number;
  const meanB = stats.meanB as number;
  const strength = strongest(strengthFromDiff(diff), strengthFromR(data.r));
  if (!strength) {
    note(nothingNotableNote(L, label, data.n));
    return [];
  }

  const direction = diff >= 0 ? 'higher' : 'lower';
  const explanation = [
    groupExplanation(L, {
      daysExamined: data.n,
      groupACount: data.a.length,
      conditionPast: cfg.conditionPast(L),
      metric: cfg.metric,
      meanA,
      meanB,
      correlation: data.r,
      correlationPredictor: cfg.predictor?.metric,
    }),
    tr(L, 'analysis.explain.diffAndStrength', { diff: fmt1(L, Math.abs(diff)), strength: strengthLabel(L, strength) }),
  ].join(' ');
  // The difference itself is the evidence's `effectSize` (its own row in the card); repeating it
  // here as "Mean difference (A minus B)" showed the same number twice.
  const extra = [{ key: tr(L, 'analysis.extra.strength'), value: strengthLabel(L, strength) }];
  if (stats.cohenD != null) extra.push({ key: tr(L, 'analysis.extra.cohenD'), value: fmt2(L, stats.cohenD) });

  return [
    makeInsight({
      id: `${cfg.id}_${cfg.variant}`,
      category: cfg.category,
      strength,
      title: cfg.titleFor(L, direction),
      text: relationSentence(L, { condition: cfg.condition(L), metric: cfg.metric, meanA, meanB }),
      explanation,
      evidence: evidence({
        daysExamined: data.n,
        metricLabel: outcomeLabel,
        groupALabel: groupA,
        groupACount: data.a.length,
        groupAMean: round(meanA),
        groupBLabel: groupB,
        groupBCount: data.b.length,
        groupBMean: round(meanB),
        correlation: data.r == null ? null : round(data.r, 2),
        effectSize: round(diff),
        extra,
      }),
      ...bounds,
      effect: Math.max(Math.abs(diff), data.r == null ? 0 : Math.abs(data.r) * 3),
      n: data.n,
      positive: cfg.positiveWhen(diff),
    }),
  ];
}

/** Convenience: a Detector whose whole behaviour is one split comparison. */
export function makeSplitDetector(cfg: SplitConfig): Detector {
  return {
    id: cfg.id,
    label: cfg.label,
    detect: (ctx) => runSplit(ctx, cfg),
  };
}
