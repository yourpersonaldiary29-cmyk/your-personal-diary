/**
 * Insights engine entry point: builds the Dataset for a period, runs the analysis
 * provider and assembles the `InsightsReport` returned by GET /api/insights.
 */
import { DEFAULT_LOCALE, t, type Locale } from '@shared/i18n';
import type { InsightsReport, Period } from '@shared/types';
import { buildDataset } from '../db/dataset';
import type { DiaryDb } from '../db/database';
import { nowIso, periodRange, todayIso } from '../util/dates';
import { truncate } from './phrasing';
import { defaultProvider, type AnalysisProvider } from './provider';
import { TITLE_MAX } from './scoring';
import type { DetectorContext } from './types';

/** Upper bound on the number of insights in a report (highest scores kept). */
export const MAX_INSIGHTS = 40;

export interface GenerateOptions {
  /** 0 = Sunday (default), 1 = Monday - the user's `AppSettings.firstDayOfWeek`. */
  firstDayOfWeek?: 0 | 1;
  /** Alternative provider (a future local model); defaults to the rules provider. */
  provider?: AnalysisProvider;
}

/**
 * Generates the insights report for `period` ending at `today`.
 * Insights are sorted by score (descending), deduplicated by id and capped at MAX_INSIGHTS.
 * `locale` is the request language (req.locale): every detector renders its titles, texts,
 * explanations, evidence labels and notes in it (the numbers never depend on the language).
 */
export function generateInsights(
  db: DiaryDb,
  period: Period,
  today: string = todayIso(),
  opts: GenerateOptions = {},
  locale: Locale = DEFAULT_LOCALE,
): InsightsReport {
  const range = periodRange(period, today);
  const ds = buildDataset(db, range.from, today);
  const provider = opts.provider ?? defaultProvider;
  const ctx: DetectorContext = {
    ds,
    today,
    period,
    habits: [...ds.habits.values()].filter((h) => !h.isArchived).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    firstDayOfWeek: opts.firstDayOfWeek ?? 0,
    locale,
    notes: [],
  };

  let result: { insights: InsightsReport['insights']; notes: string[] };
  try {
    result = provider.analyze(ctx);
  } catch (e) {
    // Providers must not throw, but a report is still more useful than a 500.
    console.error('[diary-server] analysis provider failed:', e);
    result = { insights: [], notes: [...ctx.notes, t(locale, 'analysis.engine.providerFailed')] };
  }

  const seen = new Set<string>();
  const insights = [...result.insights]
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    })
    .slice(0, MAX_INSIGHTS)
    .map((i) => ({ ...i, title: truncate(i.title, TITLE_MAX) }));

  const periodStart = range.from ?? (ds.days.length ? ds.days[0].date : today);
  return {
    generatedAt: nowIso(),
    period,
    periodStart,
    periodEnd: today,
    daysWithData: ds.days.length,
    insights,
    notes: result.notes,
    provider: provider.name,
  };
}
