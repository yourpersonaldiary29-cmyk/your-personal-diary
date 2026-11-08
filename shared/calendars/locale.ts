/**
 * Locale-aware formatting shared by the calendar modules.
 *
 * Hebrew ('he') keeps the traditional rendering (gematria days, the Hebrew
 * month names of `hebrew.ts` / the transliterations of `hijri.ts`, hand-built
 * spans). Every other UI language gets the ICU month names of that language
 * for the Hebrew / Islamic / civil calendars with digits, in the word order of
 * the language: '14 Tishri 5787', '14 Rabiʻ II 1448', '14 tichri 5787' (fr),
 * '5787年1月14日' (ja). The era that ICU appends in some languages ('AM',
 * 'AH', 'A. M.', 'Hicri') is dropped.
 *
 * All functions are pure; formatters are cached per (locale, calendar, options).
 */
import { formatNumber, localeDef, type Locale } from '../i18n';

/** Default of the optional `locale` parameters of the calendar formatters (the behaviour before localisation). */
export const LEGACY_LOCALE: Locale = 'he';

/** ICU calendar identifiers used by the module. */
export type IntlCalendar = 'gregory' | 'hebrew' | 'islamic-umalqura' | 'islamic-civil';

export const DAY_MONTH_YEAR: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
export const DAY_MONTH: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
export const MONTH_YEAR: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
export const MONTH_ONLY: Intl.DateTimeFormatOptions = { month: 'long' };
export const DAY_MONTH_NUMERIC: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'numeric' };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/** A cached `Intl.DateTimeFormat` for the locale's BCP 47 tag with the given calendar (UTC). */
export function calendarFormatter(locale: Locale, calendar: IntlCalendar, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const tag = localeDef(locale).intl;
  const key = `${tag}|${calendar}|${JSON.stringify(options)}`;
  let df = formatterCache.get(key);
  if (!df) {
    try {
      df = new Intl.DateTimeFormat(`${tag}-u-ca-${calendar}`, { timeZone: 'UTC', ...options });
    } catch {
      df = new Intl.DateTimeFormat(`en-u-ca-${calendar}`, { timeZone: 'UTC', ...options });
    }
    formatterCache.set(key, df);
  }
  return df;
}

interface FormatPart {
  type: string;
  value: string;
  /** formatRangeToParts only: 'startRange' | 'endRange' | 'shared'. */
  source?: string;
}

/** Month names that replace ICU's (script-months.ts): the start date's and the end date's month. */
export interface MonthNames {
  start: string;
  end: string;
}

/**
 * Joins `formatToParts` / `formatRangeToParts` output without the era and the
 * separator glued to it: 'Rabiʻ II 1448 AH' -> 'Rabiʻ II 1448', 'AM 14 Tishri 5787' -> '14 Tishri 5787'.
 * With `months`, the month parts are replaced (the end date's month for the 'endRange' part).
 */
export function joinWithoutEra(parts: readonly FormatPart[], months?: MonthNames): string {
  const out: FormatPart[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.type === 'era') {
      if (out.length > 0 && out[out.length - 1].type === 'literal') out.pop();
      else if (parts[i + 1]?.type === 'literal') i++;
      continue;
    }
    if (months && p.type === 'month') {
      out.push({ ...p, value: p.source === 'endRange' ? months.end : months.start });
      continue;
    }
    out.push(p);
  }
  return out
    .map((p) => p.value)
    .join('')
    .trim();
}

/** One date in the locale and calendar, without the era; `monthName` replaces ICU's month name. */
export function formatIntlDate(locale: Locale, calendar: IntlCalendar, date: Date, options: Intl.DateTimeFormatOptions, monthName?: string | null): string {
  const months = monthName ? { start: monthName, end: monthName } : undefined;
  return joinWithoutEra(calendarFormatter(locale, calendar, options).formatToParts(date), months);
}

/**
 * A date range in the locale and calendar ('Tishri – Heshvan 5787', '1 – 30 September 2026'), without the era;
 * `months` replaces ICU's month names.
 */
export function formatIntlRange(
  locale: Locale,
  calendar: IntlCalendar,
  from: Date,
  to: Date,
  options: Intl.DateTimeFormatOptions,
  months?: MonthNames | null,
): string {
  const df = calendarFormatter(locale, calendar, options);
  const names = months ?? undefined;
  if (typeof df.formatRangeToParts === 'function') {
    try {
      return joinWithoutEra(df.formatRangeToParts(from, to), names);
    } catch {
      /* fall through to two dates */
    }
  }
  const startOnly = names && { start: names.start, end: names.start };
  const endOnly = names && { start: names.end, end: names.end };
  return `${joinWithoutEra(df.formatToParts(from), startOnly)} – ${joinWithoutEra(df.formatToParts(to), endOnly)}`;
}

/** Digits of a day / year number in the locale ('14', '5787'); no grouping. */
export function digits(locale: Locale, n: number): string {
  return formatNumber(locale, n, 0);
}
