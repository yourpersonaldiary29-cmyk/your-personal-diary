/**
 * Locale-aware phrasing helpers for insights.
 *
 * Every user-facing string of the analysis engine comes from the 'analysis' catalogue
 * (shared/i18n/messages/<locale>/analysis.ts) through `t(locale, key, params)`; nothing
 * here concatenates sentence fragments. Sentences are deliberately hedged in every
 * language ("It looks like in your data...", "נראה שבנתונים שלך...") and never causal -
 * `analysis-i18n.test.ts` scans the catalogues and the generated texts for causal words.
 *
 * Grammar: gendered languages (Hebrew, ...) need verb / adjective agreement with the
 * metric noun, so every metric has 'analysis.metric.<metric>.gender' in its own language
 * and the templates select on the `gender` parameter that `metricParams()` provides.
 *
 * Numbers, dates, weekday / month names and lists are formatted with Intl for the locale
 * before they are interpolated; means keep one decimal ("7.0") in every language.
 */
import { formatDate, localeDef, monthNames, t, weekdayNames, type Locale, type Params } from '@shared/i18n';
import type { InsightStrength } from '@shared/types';
import { weekday } from '../util/dates';

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const tag = localeDef(locale).intl;
  const cacheKey = `${tag}|${JSON.stringify(options)}`;
  let nf = numberFormats.get(cacheKey);
  if (!nf) {
    try {
      nf = new Intl.NumberFormat(tag, options);
    } catch {
      nf = new Intl.NumberFormat('en', options);
    }
    numberFormats.set(cacheKey, nf);
  }
  return nf;
}

function fixed(locale: Locale, n: number, decimals: number): string {
  if (!Number.isFinite(n)) return String(n);
  // Round half away from zero first so 0.05 -> 0.1 in every locale (Intl rounds half-even in some).
  const factor = 10 ** decimals;
  const rounded = (Math.sign(n) * Math.round(Math.abs(n) * factor)) / factor;
  // Intl adds a left-to-right mark before the minus sign in RTL locales, so negative
  // numbers stay readable inside Hebrew / Arabic sentences.
  return numberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false }).format(rounded === 0 ? 0 : rounded);
}

/** One decimal ("7.0", "5.9"; "7,0" in locales that use a decimal comma). */
export function fmt1(locale: Locale, n: number): string {
  return fixed(locale, n, 1);
}

/** Two decimals - used for correlation coefficients ("0.41"). */
export function fmt2(locale: Locale, n: number): string {
  return fixed(locale, n, 2);
}

/** Integer without decimals. */
export function fmtInt(locale: Locale, n: number): string {
  return fixed(locale, n, 0);
}

/** Ratio 0..1 as a percentage in the locale's style ("80%", "80 %", "%80"). */
export function fmtPercent(locale: Locale, ratio: number): string {
  if (!Number.isFinite(ratio)) return String(ratio);
  return numberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(Math.round(ratio * 100) / 100);
}

// ---------------------------------------------------------------------------
// Strength
// ---------------------------------------------------------------------------

export function strengthLabel(locale: Locale, strength: InsightStrength): string {
  return t(locale, `analysis.strength.${strength}`);
}

// ---------------------------------------------------------------------------
// Metrics and grammar
// ---------------------------------------------------------------------------

export type MetricKey = 'mood' | 'energy' | 'stress' | 'sleepHours' | 'sleepQuality' | 'exerciseMinutes' | 'entries';

/** Short label as used across the app ("mood" / "מצב רוח"). */
export function metricLabel(locale: Locale, metric: MetricKey): string {
  return t(locale, `analysis.metric.${metric}.label`);
}

/** Definite subject form used inside a sentence ("number of sleep hours" / "מספר שעות השינה"). */
export function metricDefined(locale: Locale, metric: MetricKey): string {
  return t(locale, `analysis.metric.${metric}.defined`);
}

/** Grammatical gender of the metric noun in the locale ('m' / 'f' / 'n' ...), for template selects. */
export function metricGender(locale: Locale, metric: MetricKey): string {
  return t(locale, `analysis.metric.${metric}.gender`);
}

/** The three metric parameters most sentence templates take: `{metric}`, `{metricDefined}`, `{gender}`. */
export function metricParams(locale: Locale, metric: MetricKey): { metric: string; metricDefined: string; gender: string } {
  return { metric: metricLabel(locale, metric), metricDefined: metricDefined(locale, metric), gender: metricGender(locale, metric) };
}

// ---------------------------------------------------------------------------
// Days, dates and lists
// ---------------------------------------------------------------------------

/** "Tuesdays" / "ימי שלישי" (index 0 = Sunday). */
export function weekdayPlural(locale: Locale, w: number): string {
  return t(locale, `analysis.weekday.plural.${w}`);
}

/** "on Tuesdays" / "בימי שלישי" (index 0 = Sunday). */
export function onWeekday(locale: Locale, w: number): string {
  return t(locale, `analysis.weekday.on.${w}`);
}

/** Numeric short date in the locale ("07/09/2026" / "7.9.2026"). */
export function shortDate(locale: Locale, iso: string): string {
  return formatDate(locale, iso, 'short');
}

/** Weekday name plus the short date: "Monday, 07/09/2026" / "יום שני 7.9.2026". */
export function dayWithDate(locale: Locale, iso: string): string {
  return t(locale, 'analysis.date.dayWithDate', { weekday: weekdayNames(locale)[weekday(iso)], date: shortDate(locale, iso) });
}

/** Standalone month name of a 'YYYY-MM' ("September" / "ספטמבר"). */
export function monthName(locale: Locale, yyyyMm: string): string {
  return monthNames(locale)[Number(yyyyMm.slice(5, 7)) - 1];
}

/** "17 days" / "one day" - "17 ימים" / "יום אחד". */
export function daysCount(locale: Locale, n: number): string {
  return t(locale, 'analysis.count.days', { count: n });
}

/** "4 weeks" / "one week" - "4 שבועות" / "שבוע אחד". */
export function weeksCount(locale: Locale, n: number): string {
  return t(locale, 'analysis.count.weeks', { count: n });
}

const listFormats = new Map<string, Intl.ListFormat>();

/** Joins items the way the locale writes lists: "a, b and c" / "א, ב וג" / "א, ב ו-30 ימים". */
export function joinList(locale: Locale, items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  const tag = localeDef(locale).intl;
  let lf = listFormats.get(tag);
  if (!lf) {
    try {
      lf = new Intl.ListFormat(tag, { style: 'long', type: 'conjunction' });
    } catch {
      lf = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });
    }
    listFormats.set(tag, lf);
  }
  return lf.format(items);
}

/**
 * Semicolon between the items of a longer list in running text, the way each script writes it:
 * Arabic "؛", Greek "·" (the ano teleia - in Greek ";" is a question mark), French " ; " with a
 * space before it, the full-width "；" in Chinese and Japanese, "; " elsewhere.
 */
const SEMICOLON_BY_LANGUAGE: Partial<Record<string, string>> = { ar: '؛ ', el: '· ', fr: ' ; ', zh: '；', ja: '；' };

/** Joins list items with the locale's semicolon: "a; b; c" / "a ; b ; c" (fr) / "a؛ b" (ar). */
export function joinSemicolon(locale: Locale, items: string[]): string {
  return items.join(SEMICOLON_BY_LANGUAGE[locale] ?? '; ');
}

/**
 * Truncates to `max` characters (titles must stay short for screen readers). Cuts at the last
 * space when one is reasonably close, so no half word is left before the ellipsis; scripts
 * without spaces (Chinese, Japanese, Thai) are cut at the limit.
 */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const hard = s.slice(0, Math.max(0, max - 1));
  // `hard` already ends on a word boundary when the next character is a space.
  const space = /\s/.test(s.charAt(hard.length)) ? hard.length : hard.search(/\s\S*$/);
  const cut = space >= Math.floor(max * 0.6) ? hard.slice(0, space) : hard;
  return `${cut.trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// Sentence builders
// ---------------------------------------------------------------------------

export interface RelationSentenceInput {
  /** Condition describing group A, e.g. t('analysis.sleep.condition') = "on days when you slept fewer than 6 hours". */
  condition: string;
  metric: MetricKey;
  meanA: number;
  meanB: number;
}

/**
 * "It looks like in your data, on days when you slept fewer than 6 hours your mood was lower
 *  on average (5.9 vs. 7.2)." / "נראה שבנתונים שלך, בימים שבהם ישנת פחות מ-6 שעות מצב הרוח היה נמוך יותר בממוצע (5.9 לעומת 7.2)."
 */
export function relationSentence(locale: Locale, input: RelationSentenceInput): string {
  return t(locale, 'analysis.relation.text', {
    condition: input.condition,
    ...metricParams(locale, input.metric),
    direction: input.meanA >= input.meanB ? 'higher' : 'lower',
    meanA: fmt1(locale, input.meanA),
    meanB: fmt1(locale, input.meanB),
  });
}

export interface GroupExplanationInput {
  daysExamined: number;
  groupACount: number;
  /** Past-tense description of group A days, e.g. t('analysis.exercise.conditionPast') = "exercised". */
  conditionPast: string;
  metric: MetricKey;
  meanA: number;
  meanB: number;
  correlation?: number | null;
  /** Metric the correlation predictor was computed on (sleep hours, exercise minutes). */
  correlationPredictor?: MetricKey;
}

/**
 * "I checked 43 days. On 17 days you exercised. Your average energy level on those days was 7.8,
 *  compared with 6.3 on the other days. Correlation: 0.41."
 */
export function groupExplanation(locale: Locale, input: GroupExplanationInput): string {
  const parts = [
    t(locale, 'analysis.explain.checkedDays', { count: input.daysExamined }),
    t(locale, 'analysis.explain.onDaysCondition', { count: input.groupACount, conditionPast: input.conditionPast }),
    t(locale, 'analysis.explain.groupMeans', {
      ...metricParams(locale, input.metric),
      meanA: fmt1(locale, input.meanA),
      meanB: fmt1(locale, input.meanB),
    }),
  ];
  if (input.correlation != null) {
    const r = fmt2(locale, input.correlation);
    parts.push(
      input.correlationPredictor
        ? t(locale, 'analysis.explain.correlationBetween', {
            predictor: metricLabel(locale, input.correlationPredictor),
            outcome: metricLabel(locale, input.metric),
            r,
          })
        : t(locale, 'analysis.explain.correlation', { r }),
    );
  }
  return parts.join(' ');
}

export interface CorrelationSentenceInput {
  metricX: MetricKey;
  metricY: MetricKey;
  r: number;
}

/**
 * "It looks like there may be a link in your data between number of sleep hours and mood: the higher
 *  your number of sleep hours was, the higher your mood tended to be (correlation 0.41)."
 */
export function correlationSentence(locale: Locale, input: CorrelationSentenceInput): string {
  return t(locale, 'analysis.correlation.text', {
    x: metricDefined(locale, input.metricX),
    xGender: metricGender(locale, input.metricX),
    y: metricDefined(locale, input.metricY),
    yGender: metricGender(locale, input.metricY),
    direction: input.r >= 0 ? 'higher' : 'lower',
    r: fmt2(locale, input.r),
  });
}

/**
 * "There is not enough data to check the link between sleep and mood (at least 14 days with both
 *  values needed; you have 9)." `what` is a noun phrase; pass `whether: true` for a question
 * ("whether the habit improved or declined") - Hebrew phrases the two differently.
 */
export function insufficientDataNote(locale: Locale, what: string, required: string, have: string, whether = false): string {
  return t(locale, whether ? 'analysis.note.insufficientWhether' : 'analysis.note.insufficient', { what, required, have });
}

/** "I checked the link between sleep and mood over 30 days and found no notable difference." */
export function nothingNotableNote(locale: Locale, what: string, days: number): string {
  return t(locale, 'analysis.note.nothingNotable', { what, count: days });
}

/** Shorthand for a catalogue lookup with the detector's locale. */
export function tr(locale: Locale, key: string, params?: Params): string {
  return t(locale, key, params);
}
