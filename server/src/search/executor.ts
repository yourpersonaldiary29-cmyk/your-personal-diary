/**
 * Executes a parsed smart-search question against the diary database and phrases
 * the answer in the request locale through the 'searchAnswers' catalogue.
 * Reads entries with its own SQL (no dependency on the entries repository) and
 * uses the shared per-day dataset for day rankings.
 */
import { EMOTIONS } from '@shared/constants';
import { DEFAULT_LOCALE, formatDate, formatNumber, localeDef, t, type Locale } from '@shared/i18n';
import type {
  CalendarDay,
  Comparator,
  EntrySummary,
  Metric,
  ParsedQuery,
  SearchRequest,
  SearchResult,
  StatsSeries,
} from '@shared/types';
import type { DiaryDb, Params } from '../db/database';
import { buildDataset, type DayRecord } from '../db/dataset';
import { ApiError } from '../errors';
import { activeHabitCount, toCalendarDay } from '../stats/calendar';
import { rowToSummary, SUMMARY_COLUMNS, type SummaryRow } from '../stats/entry-summary';
import { buildSeries, firstDayWithData, meanOf, valueOfDay } from '../stats/series';
import { dateRange, todayIso } from '../util/dates';
import {
  analyseQuery,
  comparatorText,
  emotionLabel,
  emotionSearchWords,
  joinList,
  joinOr,
  periodPhrase,
  quoteList,
  searchStems,
} from './parser';

export const QUERY_MAX_LENGTH = 300;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 200;
/** Upper bounds on the payload of day / entry lists (filters can match a lot). */
export const MAX_DAYS = 366;
export const MAX_ENTRIES = 200;

/** Every zero-result answer starts with this text (in the given locale). */
export function noResultsPrefix(locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, 'searchAnswers.noResults').replace(/[.。।]$/u, '');
}
/** Hebrew prefix kept for existing callers/tests. */
export const NO_RESULTS_PREFIX = noResultsPrefix('he');

/** Validates the request body of POST /api/search (localised errors with field names). */
export function validateSearchRequest(body: unknown): SearchRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw ApiError.validation('searchAnswers.validation.body', 'query');
  }
  const { query, limit } = body as { query?: unknown; limit?: unknown };
  if (typeof query !== 'string' || !query.trim()) throw ApiError.validation('searchAnswers.validation.query', 'query');
  if (query.trim().length > QUERY_MAX_LENGTH) {
    throw ApiError.validation('searchAnswers.validation.queryTooLong', 'query', { max: QUERY_MAX_LENGTH });
  }
  const out: SearchRequest = { query: query.trim() };
  if (limit !== undefined && limit !== null) {
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw ApiError.validation('searchAnswers.validation.limit', 'limit', { max: MAX_LIMIT });
    }
    out.limit = limit;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Phrasing helpers (locale-aware)
// ---------------------------------------------------------------------------

function fmt(locale: Locale, n: number): string {
  return formatNumber(locale, n, 1);
}

const dayFormatCache = new Map<string, Intl.DateTimeFormat>();

/** "Monday, 3 August" / "יום שני, 3 באוגוסט" (the year is added only when it differs from today's). */
export function dayPhrase(iso: string, today: string, locale: Locale = DEFAULT_LOCALE): string {
  if (iso.slice(0, 4) !== today.slice(0, 4)) return formatDate(locale, iso, 'full');
  const tag = localeDef(locale).intl;
  let df = dayFormatCache.get(tag);
  if (!df) {
    df = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
    dayFormatCache.set(tag, df);
  }
  const [y, m, d] = iso.split('-').map(Number);
  return df.format(new Date(Date.UTC(y, m - 1, d, 12)));
}

function noResults(locale: Locale, parsed: ParsedQuery): string {
  return parsed.from
    ? t(locale, 'searchAnswers.noResultsPeriod', { period: parsed.periodLabel })
    : t(locale, 'searchAnswers.noResults');
}

function metricValueText(locale: Locale, metric: Metric, value: number): string {
  return t(locale, `searchAnswers.value.${metric}`, { value: fmt(locale, value) });
}

function dayValuesText(locale: Locale, day: DayRecord, metric: Metric | null): string {
  if (metric) {
    const v = valueOfDay(day, metric);
    return v == null ? '' : metricValueText(locale, metric, v);
  }
  const parts: string[] = [];
  if (day.mood != null) parts.push(metricValueText(locale, 'mood', day.mood));
  if (day.energy != null) parts.push(metricValueText(locale, 'energy', day.energy));
  if (day.stress != null) parts.push(metricValueText(locale, 'stress', day.stress));
  return joinList(locale, parts);
}

function dayWithValues(locale: Locale, day: string, values: string): string {
  return values ? t(locale, 'searchAnswers.dayWithValues', { day, values }) : day;
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Tags count as text the user wrote, so "entries with the tag work" (the tag word itself is a
// stopword in every table) also finds entries that carry the tag without repeating it in the text.
const TEXT_COLUMNS = ['title', 'body', 'notes', 'events_json', 'people_json', 'location', 'tags_json'];

interface TextRow extends SummaryRow {
  notes: string;
  events_json: string;
  people_json: string;
  location: string;
}

function rangeWhere(from: string | null, to: string): { sql: string[]; params: Params } {
  const sql = ['date <= ?'];
  const params: (string | number)[] = [to];
  if (from) {
    sql.unshift('date >= ?');
    params.unshift(from);
  }
  return { sql, params };
}

/**
 * Entries in the range that contain any of `terms` (all entries when `terms` is empty).
 * Ordered by number of matched terms, then newest first.
 */
function searchEntries(db: DiaryDb, from: string | null, to: string, terms: string[]): TextRow[] {
  const where = rangeWhere(from, to);
  const params: (string | number)[] = [...(where.params as (string | number)[])];
  const clauses = [...where.sql];
  if (terms.length) {
    const ors: string[] = [];
    for (const term of terms) {
      for (const col of TEXT_COLUMNS) {
        ors.push(`${col} LIKE ? ESCAPE '\\'`);
        params.push(`%${escapeLike(term)}%`);
      }
    }
    clauses.push(`(${ors.join(' OR ')})`);
  }
  const rows = db.all<TextRow>(
    `SELECT ${SUMMARY_COLUMNS}, notes, events_json, people_json, location FROM entries
      WHERE ${clauses.join(' AND ')} ORDER BY date DESC, time DESC, id DESC`,
    params,
  );
  const wholeWordOnly = terms.some((term) => SHORT_HEBREW_WORD.test(term));
  if (terms.length < 2 && !wholeWordOnly) return rows;
  const matchers = terms.map(termMatcher);
  const hits = (r: TextRow) => {
    const text = TEXT_COLUMNS.map((c) => String((r as unknown as Record<string, unknown>)[c] ?? '')).join('\n');
    const lower = text.toLowerCase();
    return matchers.filter((matches) => matches(lower)).length;
  };
  return rows
    .map((r, i) => ({ r, h: hits(r), i }))
    .filter((x) => !wholeWordOnly || x.h > 0)
    .sort((a, b) => b.h - a.h || a.i - b.i)
    .map((x) => x.r);
}

/**
 * A Hebrew search word of one or two letters ("ים", the sea) is part of most words ("ימים",
 * "טובים"), so the LIKE pre-filter finds nearly every entry. Such a word counts only as a whole
 * word, optionally after Hebrew prefix letters ("בים", "הים", "וכשים"...).
 */
const SHORT_HEBREW_WORD = /^[א-ת]{1,2}$/u;

/** Tests lower-cased entry text for one search term (see SHORT_HEBREW_WORD). Exported for tests. */
export function termMatcher(term: string): (lowerText: string) => boolean {
  if (SHORT_HEBREW_WORD.test(term)) {
    const re = new RegExp(`(?:^|[^\\p{L}\\p{M}])[ובהכלמש]{0,3}${term}(?=$|[^\\p{L}\\p{M}])`, 'u');
    return (text) => re.test(text);
  }
  const lower = term.toLowerCase();
  return (text) => text.includes(lower);
}

/** Entries of the given dates, newest first (used for day lists). */
function entriesOfDays(db: DiaryDb, dates: string[]): EntrySummary[] {
  if (!dates.length) return [];
  const out: EntrySummary[] = [];
  // SQLite limits the number of bound parameters; chunk the IN list.
  for (let i = 0; i < dates.length; i += 200) {
    const chunk = dates.slice(i, i + 200);
    const rows = db.all<SummaryRow>(
      `SELECT ${SUMMARY_COLUMNS} FROM entries WHERE date IN (${chunk.map(() => '?').join(',')})
        ORDER BY date DESC, time DESC, id DESC`,
      chunk,
    );
    out.push(...rows.map(rowToSummary));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Intents
// ---------------------------------------------------------------------------

interface Ctx {
  db: DiaryDb;
  parsed: ParsedQuery;
  today: string;
  limit: number;
  from: string | null;
  to: string;
  locale: Locale;
  /** Words that name each emotion in the question's language (for text matching). */
  emotionWords: (key: string) => string[];
}

function emptyResult(ctx: Ctx): SearchResult {
  return { parsed: ctx.parsed, answer: noResults(ctx.locale, ctx.parsed), entries: [], days: [], series: null, totalMatches: 0 };
}

/** Composite "how good was the day" score: mean of mood, energy and (11 - stress), whichever exist. */
export function goodnessScore(day: DayRecord, metric: Metric | null): number | null {
  if (metric) {
    const v = valueOfDay(day, metric);
    if (v == null) return null;
    return metric === 'stress' ? -v : v;
  }
  const parts: number[] = [];
  if (day.mood != null) parts.push(day.mood);
  if (day.energy != null) parts.push(day.energy);
  if (day.stress != null) parts.push(11 - day.stress);
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
}

function rankDays(ctx: Ctx, best: boolean): SearchResult {
  const { db, parsed, today, locale } = ctx;
  const dataset = buildDataset(db, ctx.from, ctx.to);
  const metric = parsed.metric;
  const scored = dataset.days
    .map((day) => ({ day, score: goodnessScore(day, metric) }))
    .filter((x): x is { day: DayRecord; score: number } => x.score != null);
  if (!scored.length) return emptyResult(ctx);
  scored.sort((a, b) => (best ? b.score - a.score : a.score - b.score) || (a.day.date < b.day.date ? 1 : -1));
  const top = scored.slice(0, ctx.limit);
  const habitsTotal = activeHabitCount(db);
  const days: CalendarDay[] = top.map((x) => toCalendarDay(x.day, x.day.date, habitsTotal, today));
  const rank = new Map(top.map((x, i) => [x.day.date, i]));
  const entries = entriesOfDays(db, top.map((x) => x.day.date))
    .sort((a, b) => (rank.get(a.date) ?? 0) - (rank.get(b.date) ?? 0) || a.time.localeCompare(b.time))
    .slice(0, MAX_ENTRIES);
  const items = top.map((x) => dayWithValues(locale, dayPhrase(x.day.date, today, locale), dayValuesText(locale, x.day, metric)));
  const key = best
    ? metric
      ? 'searchAnswers.rank.bestByMetric'
      : 'searchAnswers.rank.best'
    : metric
      ? 'searchAnswers.rank.worstByMetric'
      : 'searchAnswers.rank.worst';
  const answer = t(locale, key, { metric: metric ?? 'other', period: periodPhrase(locale, parsed), days: joinList(locale, items) });
  return { parsed, answer, entries, days, series: null, totalMatches: days.length };
}

function compare(value: number, comparator: Comparator, threshold: number): boolean {
  switch (comparator) {
    case 'lt':
      return value < threshold;
    case 'lte':
      return value <= threshold;
    case 'gt':
      return value > threshold;
    case 'gte':
      return value >= threshold;
    case 'eq':
      return Math.abs(value - threshold) < 1e-9;
  }
}

function metricFilter(ctx: Ctx): SearchResult {
  const { db, parsed, today, locale } = ctx;
  const metric = parsed.metric ?? 'mood';
  const comparator = parsed.comparator ?? 'lt';
  const threshold = parsed.threshold ?? 0;
  const dataset = buildDataset(db, ctx.from, ctx.to);
  const matching = dataset.days.filter((day) => {
    const v = valueOfDay(day, metric);
    return v != null && compare(v, comparator, threshold);
  });
  if (!matching.length) return emptyResult(ctx);
  matching.sort((a, b) => (a.date < b.date ? 1 : -1));
  const shown = matching.slice(0, MAX_DAYS);
  const habitsTotal = activeHabitCount(db);
  const days = shown.map((d) => toCalendarDay(d, d.date, habitsTotal, today));
  const entries = entriesOfDays(db, shown.map((d) => d.date)).slice(0, MAX_ENTRIES);
  const preview = shown.slice(0, 5).map((d) => {
    const v = valueOfDay(d, metric);
    return dayWithValues(locale, dayPhrase(d.date, today, locale), v == null ? '' : fmt(locale, v));
  });
  const answer = t(locale, 'searchAnswers.filter.found', {
    count: matching.length,
    metric,
    comparison: comparatorText(locale, comparator, threshold),
    period: periodPhrase(locale, parsed),
    days: joinList(locale, preview),
    more: Math.max(0, matching.length - 5),
  });
  return { parsed, answer, entries, days, series: null, totalMatches: matching.length };
}

function textSearch(ctx: Ctx): SearchResult {
  const { db, parsed, locale } = ctx;
  // Inflected languages: look for the stem ("работе" -> "работ" finds "работа").
  const rows = searchEntries(db, ctx.from, ctx.to, searchStems(parsed.textTerms, locale));
  if (!rows.length) {
    if (parsed.intent === 'unknown') {
      return { parsed, answer: parsed.explanation, entries: [], days: [], series: null, totalMatches: 0 };
    }
    return emptyResult(ctx);
  }
  const entries = rows.slice(0, ctx.limit).map(rowToSummary);
  const total = rows.length;
  const earliest = rows.reduce((a, b) => (b.date < a.date ? b : a));
  const latest = rows.reduce((a, b) => (b.date > a.date ? b : a));
  const period = periodPhrase(locale, parsed);
  const first = formatDate(locale, String(earliest.date), 'full');
  const last = formatDate(locale, String(latest.date), 'full');
  let answer: string;
  if (parsed.intent === 'text_mention') {
    const terms = parsed.textTerms.length ? quoteList(locale, parsed.textTerms) : t(locale, 'searchAnswers.mention.something');
    answer = t(locale, 'searchAnswers.mention.found', { terms, count: total, period, first, last });
  } else if (parsed.intent === 'unknown') {
    answer = t(locale, 'searchAnswers.unknown.fallback', {
      count: Math.min(total, entries.length),
      total,
      explanation: parsed.explanation,
    });
  } else if (parsed.textTerms.length) {
    answer = t(locale, 'searchAnswers.list.foundTerms', { count: total, terms: quoteList(locale, parsed.textTerms), period, last });
  } else {
    answer = t(locale, 'searchAnswers.list.found', { count: total, period, last });
  }
  return { parsed, answer, entries, days: [], series: null, totalMatches: total };
}

function emotionDays(ctx: Ctx): SearchResult {
  const { db, parsed, today, locale } = ctx;
  const keys = EMOTIONS.map((e) => e.key).filter((key) => parsed.emotions.includes(key));
  if (!keys.length) return emptyResult(ctx);
  const where = rangeWhere(ctx.from, ctx.to);
  const params: (string | number)[] = [...(where.params as (string | number)[])];
  const ors: string[] = [];
  for (const key of keys) {
    ors.push(`emotions_json LIKE ? ESCAPE '\\'`);
    params.push(`%"${escapeLike(key)}"%`);
    for (const word of ctx.emotionWords(key)) {
      for (const col of ['title', 'body', 'notes']) {
        ors.push(`${col} LIKE ? ESCAPE '\\'`);
        params.push(`%${escapeLike(word)}%`);
      }
    }
  }
  const rows = db.all<SummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM entries WHERE ${where.sql.join(' AND ')} AND (${ors.join(' OR ')})
      ORDER BY date DESC, time DESC, id DESC`,
    params,
  );
  if (!rows.length) return emptyResult(ctx);
  const dates = [...new Set(rows.map((r) => String(r.date)))];
  const dataset = buildDataset(db, dates[dates.length - 1], dates[0]);
  const byDate = new Map(dataset.days.map((d) => [d.date, d] as const));
  const habitsTotal = activeHabitCount(db);
  const shownDates = dates.slice(0, MAX_DAYS);
  const days = shownDates.map((date) => toCalendarDay(byDate.get(date), date, habitsTotal, today));
  const entries = rows.slice(0, MAX_ENTRIES).map(rowToSummary);
  const answer = t(locale, 'searchAnswers.emotion.found', {
    emotions: joinOr(
      locale,
      keys.map((key) => emotionLabel(locale, key)),
    ),
    count: dates.length,
    period: periodPhrase(locale, parsed),
    days: joinList(
      locale,
      shownDates.slice(0, 5).map((d) => dayPhrase(d, today, locale)),
    ),
    more: Math.max(0, dates.length - 5),
  });
  return { parsed, answer, entries, days, series: null, totalMatches: dates.length };
}

/** Change smaller than this (in metric units) is reported as "stable". */
const STABLE_EPS: Record<Metric, number> = {
  mood: 0.3,
  energy: 0.3,
  stress: 0.3,
  sleepQuality: 0.3,
  sleepHours: 0.25,
  exerciseMinutes: 5,
};

function trendSummary(ctx: Ctx): SearchResult {
  const { db, parsed, locale } = ctx;
  const metric = parsed.metric ?? 'mood';
  let from = ctx.from ?? firstDayWithData(db);
  if (!from) return emptyResult(ctx);
  if (from > ctx.to) from = ctx.to;
  const dates = dateRange(from, ctx.to);
  const dataset = buildDataset(db, from, ctx.to);
  const byDate = new Map(dataset.days.map((d) => [d.date, d] as const));
  const series: StatsSeries = buildSeries(metric, dates, (d) => valueOfDay(byDate.get(d), metric), null, locale);
  if (series.count === 0) return emptyResult(ctx);

  // The first third is compared with the last third of the days that were actually measured
  // (first value .. last value), not of the whole asked period: "the last year" asked of a
  // four-month diary has an empty first third and would otherwise always answer "not enough data".
  let firstIdx = 0;
  while (firstIdx < series.points.length && series.points[firstIdx].value == null) firstIdx++;
  let lastIdx = series.points.length - 1;
  while (lastIdx > firstIdx && series.points[lastIdx].value == null) lastIdx--;
  const measured = series.points.slice(firstIdx, lastIdx + 1);
  const n = measured.length;
  const third = Math.max(1, Math.floor(n / 3));
  const values = (points: typeof series.points) => points.map((p) => p.value).filter((v): v is number => v != null);
  const firstVals = values(measured.slice(0, third));
  const lastVals = values(measured.slice(n - third));
  const base = { parsed, entries: [], days: [], series, totalMatches: series.count };
  const period = periodPhrase(locale, parsed);
  const firstMean = meanOf(firstVals);
  const lastMean = meanOf(lastVals);
  if (firstMean == null || lastMean == null || series.count < 2) {
    return { ...base, answer: t(locale, 'searchAnswers.trend.insufficient', { metric, period }) };
  }
  const diff = lastMean - firstMean;
  const evidence = t(locale, 'searchAnswers.trend.evidence', { first: firstVals.length, last: lastVals.length });
  const params = { metric, period, from: fmt(locale, firstMean), to: fmt(locale, lastMean), evidence };
  const key = Math.abs(diff) < STABLE_EPS[metric] ? 'searchAnswers.trend.stable' : diff > 0 ? 'searchAnswers.trend.up' : 'searchAnswers.trend.down';
  return { ...base, answer: t(locale, key, params) };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Parses and executes a smart-search question. The question may be written in any
 * language that has a keyword table; the answer is rendered in `locale`
 * (default: the question's own language).
 */
export function smartSearch(db: DiaryDb, req: SearchRequest, today: string = todayIso(), locale?: Locale): SearchResult {
  const valid = validateSearchRequest(req);
  const analysis = analyseQuery(valid.query, today, locale);
  const parsed = analysis.parsed;
  const ctx: Ctx = {
    db,
    parsed,
    today,
    limit: valid.limit ?? DEFAULT_LIMIT,
    from: parsed.from,
    to: parsed.to ?? today,
    locale: analysis.locale,
    emotionWords: (key) => emotionSearchWords(analysis.table, key),
  };
  switch (parsed.intent) {
    case 'best_days':
      return rankDays(ctx, true);
    case 'worst_days':
      return rankDays(ctx, false);
    case 'metric_filter':
      return metricFilter(ctx);
    case 'emotion_days':
      return emotionDays(ctx);
    case 'trend_summary':
      return trendSummary(ctx);
    case 'text_mention':
    case 'list_entries':
    case 'unknown':
    default:
      return textSearch(ctx);
  }
}
