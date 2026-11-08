/**
 * Internal contracts of the analysis engine (not part of the HTTP API).
 *
 * A detector is a pure function over the per-day `Dataset`: it looks for one kind of
 * pattern and returns zero or more `Insight`s. Detectors report why they could not run
 * (not enough data) or what they checked without finding anything by appending notes
 * (rendered in `ctx.locale`) to `ctx.notes`; the engine surfaces those notes in
 * `InsightsReport.notes`.
 */
import type { Locale } from '@shared/i18n';
import type { Habit, Insight, Period } from '@shared/types';
import type { Dataset } from '../db/dataset';

export interface DetectorContext {
  /** Per-day aggregation of the period (only days with data, ascending). */
  ds: Dataset;
  /** Local "today" (YYYY-MM-DD) - the end of the analysed period. */
  today: string;
  period: Period;
  /** Active (non-archived) habits, in the user's sort order. */
  habits: Habit[];
  /** 0 = Sunday, 1 = Monday - used for weekly bucketing. */
  firstDayOfWeek: 0 | 1;
  /** Language every title, text, explanation, evidence label and note is rendered in. */
  locale: Locale;
  /** Notes appended by detectors (insufficient data, nothing notable, ...), in `locale`. */
  notes: string[];
}

export interface Detector {
  /** Stable machine id, also the prefix of every insight id it produces (e.g. "sleep_mood"). */
  id: string;
  /** Description of what the detector checks, in the given language (used in notes). */
  label: (locale: Locale) => string;
  detect(ctx: DetectorContext): Insight[];
}

/** Appends a note to the report (deduplicated). */
export function addNote(ctx: DetectorContext, text: string): void {
  if (!ctx.notes.includes(text)) ctx.notes.push(text);
}

/** Inclusive bounds of the analysed period as they should appear on every insight. */
export function periodBounds(ctx: DetectorContext): { periodStart: string; periodEnd: string } {
  const first = ctx.ds.days.length ? ctx.ds.days[0].date : ctx.today;
  return { periodStart: ctx.ds.from ?? first, periodEnd: ctx.ds.to };
}
