/**
 * Strength thresholds (from `shared/constants` ANALYSIS), relevance scoring and the
 * `Insight` builder shared by all detectors.
 */
import { ANALYSIS } from '@shared/constants';
import type { Insight, InsightCategory, InsightEvidence, InsightStrength } from '@shared/types';
import { truncate } from './phrasing';
import { round } from './math';

/**
 * Upper bound for insight titles (a safety net for long habit/emotion names; titles must stay
 * short for screen readers). English and Hebrew titles stay well under 60 characters, but the
 * same titles run 10-20% longer in Spanish, French, Italian, German, Romanian, Greek, Russian
 * and Bulgarian - a 60-character cap cut them mid-word and dropped the meaning-bearing word
 * ("…livello di stress più…" without alto/basso), so the cap leaves room for those languages.
 */
export const TITLE_MAX = 90;

const ORDER: Record<InsightStrength, number> = { weak: 1, moderate: 2, strong: 3 };

/** Strength implied by an absolute mean difference in rating points (null below the weak threshold). */
export function strengthFromDiff(absDiff: number): InsightStrength | null {
  const d = Math.abs(absDiff);
  if (d >= ANALYSIS.strongDiff) return 'strong';
  if (d >= ANALYSIS.moderateDiff) return 'moderate';
  if (d >= ANALYSIS.weakDiff) return 'weak';
  return null;
}

/** Strength implied by an absolute Pearson r (null below the weak threshold). */
export function strengthFromR(absR: number | null): InsightStrength | null {
  if (absR == null) return null;
  const r = Math.abs(absR);
  if (r >= ANALYSIS.strongR) return 'strong';
  if (r >= ANALYSIS.moderateR) return 'moderate';
  if (r >= ANALYSIS.weakR) return 'weak';
  return null;
}

/**
 * Strength from a value against custom [weak, moderate, strong] thresholds
 * (used for ratios, streak lengths, z-scores...). Null below the weak threshold.
 */
export function strengthFromThresholds(value: number, thresholds: readonly [number, number, number]): InsightStrength | null {
  const v = Math.abs(value);
  if (v >= thresholds[2]) return 'strong';
  if (v >= thresholds[1]) return 'moderate';
  if (v >= thresholds[0]) return 'weak';
  return null;
}

/** The stronger of two (possibly null) strengths. */
export function strongest(a: InsightStrength | null, b: InsightStrength | null): InsightStrength | null {
  if (!a) return b;
  if (!b) return a;
  return ORDER[a] >= ORDER[b] ? a : b;
}

export function strengthWeight(s: InsightStrength): number {
  return ORDER[s];
}

/**
 * Relevance score: strength weight x effect magnitude x ln(sample size).
 * `effect` is in rating points (or an equivalent 0..3-ish magnitude); a floor keeps
 * tiny effects from zeroing the score, and n is floored at 2 so ln() is positive.
 */
export function scoreOf(strength: InsightStrength, effect: number, n: number): number {
  const magnitude = Math.max(Math.abs(effect), 0.1);
  return round(strengthWeight(strength) * magnitude * Math.log(Math.max(n, 2)), 3);
}

/** Evidence with every field present; pass only what the detector knows. */
export function evidence(partial: Partial<InsightEvidence> = {}): InsightEvidence {
  return {
    daysExamined: 0,
    metricLabel: '',
    groupALabel: '',
    groupACount: 0,
    groupAMean: null,
    groupBLabel: '',
    groupBCount: 0,
    groupBMean: null,
    correlation: null,
    effectSize: null,
    dates: [],
    extra: [],
    ...partial,
  };
}

export interface InsightSpec {
  id: string;
  category: InsightCategory;
  strength: InsightStrength;
  title: string;
  text: string;
  explanation: string;
  evidence: InsightEvidence;
  periodStart: string;
  periodEnd: string;
  /** Effect magnitude used for the score (rating points or equivalent). */
  effect: number;
  /** Sample size used for the score. */
  n: number;
  positive: boolean | null;
}

/** Builds an `Insight`, computing the score and keeping the title within the limit. */
export function makeInsight(spec: InsightSpec): Insight {
  return {
    id: spec.id,
    category: spec.category,
    strength: spec.strength,
    title: truncate(spec.title, TITLE_MAX),
    text: spec.text,
    explanation: spec.explanation,
    evidence: spec.evidence,
    periodStart: spec.periodStart,
    periodEnd: spec.periodEnd,
    score: scoreOf(spec.strength, spec.effect, spec.n),
    positive: spec.positive,
  };
}
