/**
 * best-worst-days: a composite well-being score per day and the three highest / lowest days.
 *
 * composite = mean of the reported parts among { mood, energy, 11 - stress } (stress is
 * inverted so "higher is better" for every part). A day needs its mood or at least two
 * parts; missing parts are simply left out, never counted as 0.
 */
import { ANALYSIS } from '@shared/constants';
import type { Locale } from '@shared/i18n';
import type { Insight, KeyValue } from '@shared/types';
import type { DayRecord } from '../../db/dataset';
import { mean, round } from '../math';
import { daysCount, dayWithDate, fmt1, insufficientDataNote, joinList, shortDate, strengthLabel, tr } from '../phrasing';
import { evidence, makeInsight, strengthFromDiff } from '../scoring';
import { addNote, periodBounds, type Detector, type DetectorContext } from '../types';

/** Minimum days with a composite score before best/worst days are reported. */
export const MIN_DAYS = 10;
const TOP_N = 3;

export interface ScoredDay {
  day: DayRecord;
  score: number;
}

/** Composite score of a day, or null when too little was reported. */
export function compositeScore(d: DayRecord): number | null {
  const parts: number[] = [];
  if (d.mood != null) parts.push(d.mood);
  if (d.energy != null) parts.push(d.energy);
  if (d.stress != null) parts.push(11 - d.stress);
  if (parts.length === 0) return null;
  if (d.mood == null && parts.length < 2) return null;
  return mean(parts) as number;
}

/** "Monday, 07/09/2026 ("A good day")" - the day plus its first entry title, when there is one. */
function describe(locale: Locale, s: ScoredDay): string {
  const day = dayWithDate(locale, s.day.date);
  return s.day.titles[0] ? tr(locale, 'analysis.bestWorst.describedDay', { day, title: s.day.titles[0] }) : day;
}

function extraFor(locale: Locale, list: ScoredDay[]): KeyValue[] {
  return list.map((s) => ({
    key: shortDate(locale, s.day.date),
    value: tr(locale, 'analysis.bestWorst.extraValue', {
      titles: s.day.titles.length ? s.day.titles.join(' / ') : tr(locale, 'analysis.bestWorst.noTitle'),
      score: fmt1(locale, s.score),
    }),
  }));
}

function build(ctx: DetectorContext, kind: 'best' | 'worst', picked: ScoredDay[], all: ScoredDay[], overall: number): Insight | null {
  const L = ctx.locale;
  const pickedMean = mean(picked.map((s) => s.score)) as number;
  const diff = kind === 'best' ? pickedMean - overall : overall - pickedMean;
  const strength = strengthFromDiff(diff);
  if (!strength) return null;
  const restCount = all.length - picked.length;
  const restMean = restCount > 0 ? (overall * all.length - pickedMean * picked.length) / restCount : null;
  const text = tr(L, 'analysis.bestWorst.text', { kind, days: joinList(L, picked.map((s) => describe(L, s))) });
  const explanation = [
    tr(L, 'analysis.bestWorst.explainScore', { count: all.length }),
    tr(L, 'analysis.bestWorst.explainMeans', { overall: fmt1(L, overall), kind, count: picked.length, mean: fmt1(L, pickedMean) }),
    tr(L, 'analysis.bestWorst.explainDiff', { diff: fmt1(L, diff), strength: strengthLabel(L, strength) }),
  ].join(' ');
  return makeInsight({
    id: kind === 'best' ? 'best_days' : 'hard_days',
    category: kind === 'best' ? 'best_days' : 'hard_days',
    strength,
    title: tr(L, 'analysis.bestWorst.title', { kind }),
    text,
    explanation,
    evidence: evidence({
      daysExamined: all.length,
      metricLabel: tr(L, 'analysis.bestWorst.metric'),
      groupALabel: tr(L, 'analysis.bestWorst.groupA', { kind }),
      groupACount: picked.length,
      groupAMean: round(pickedMean),
      groupBLabel: tr(L, 'analysis.groupB.otherDays'),
      groupBCount: restCount,
      groupBMean: restMean == null ? null : round(restMean),
      effectSize: round(pickedMean - overall),
      dates: picked.map((s) => s.day.date),
      extra: [{ key: tr(L, 'analysis.extra.periodMean'), value: fmt1(L, overall) }, ...extraFor(L, picked)],
    }),
    ...periodBounds(ctx),
    effect: diff,
    n: all.length,
    positive: kind === 'best',
  });
}

export const bestWorstDaysDetector: Detector = {
  id: 'best_worst_days',
  label: (l) => tr(l, 'analysis.bestWorst.label'),
  detect(ctx) {
    const L = ctx.locale;
    const label = this.label(L);
    const scored: ScoredDay[] = [];
    for (const day of ctx.ds.days) {
      const score = compositeScore(day);
      if (score != null) scored.push({ day, score });
    }
    if (scored.length < Math.max(MIN_DAYS, ANALYSIS.minGroupSize * 2)) {
      addNote(ctx, insufficientDataNote(L, label, tr(L, 'analysis.req.daysWithRatings', { count: MIN_DAYS }), daysCount(L, scored.length)));
      return [];
    }
    const overall = mean(scored.map((s) => s.score)) as number;
    const sorted = [...scored].sort((a, b) => b.score - a.score || (a.day.date < b.day.date ? -1 : 1));
    const best = sorted.slice(0, TOP_N);
    const worst = sorted.slice(-TOP_N).reverse();
    const out: Insight[] = [];
    const b = build(ctx, 'best', best, scored, overall);
    if (b) out.push(b);
    const w = build(ctx, 'worst', worst, scored, overall);
    if (w) out.push(w);
    if (out.length === 0) {
      addNote(ctx, tr(L, 'analysis.bestWorst.nothing', { label, count: scored.length }));
    }
    return out;
  },
};
