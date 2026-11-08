/**
 * Date helpers for the UI. All functions work with local time and ISO date
 * strings (`YYYY-MM-DD`) / times (`HH:MM`), never with UTC-shifted values.
 *
 * The text-producing helpers (formatHebrewDate, formatLongDate, weekdayName,
 * relativeDayLabel...) format for the current UI language (src/i18n/runtime)
 * through the shared Intl-based formatters; the names are historical - the
 * Hebrew wording is unchanged when the language is Hebrew.
 */
import { MONTH_NAMES, WEEKDAY_NAMES, WEEKDAY_SHORT } from '@shared/constants';
import { formatDate, formatTime, standaloneMonthNames, weekdayNames, type Locale } from '@shared/i18n';
import { getCurrentLocale, tr } from '@/i18n/runtime';

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** True when `s` is a well-formed and valid `YYYY-MM-DD` date. */
export function isValidIsoDate(s: string): boolean {
  const m = ISO_DATE_RE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

/** True when `s` is `HH:MM` in 24-hour form. */
export function isValidTime(s: string): boolean {
  return TIME_RE.test(s);
}

/** Parses `YYYY-MM-DD` into a local Date at 00:00. Throws on invalid input. */
export function parseIsoDate(iso: string): Date {
  const m = ISO_DATE_RE.exec(iso);
  if (!m) throw new Error(`invalid date: ${iso}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Formats a local Date as `YYYY-MM-DD`. */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Today's local date as `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** Current local time as `HH:MM`. */
export function nowHHMM(now: Date = new Date()): string {
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

/** Adds (or subtracts) whole days. */
export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Adds whole months, clamping the day to the target month's length. */
export function addMonths(iso: string, months: number): string {
  const d = parseIsoDate(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth() + 1)));
  return toIsoDate(d);
}

/** Signed number of days from `a` to `b` (b - a). */
export function diffDays(a: string, b: string): number {
  const ms = parseIsoDate(b).getTime() - parseIsoDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Lexicographic comparison works for ISO dates; returns -1, 0 or 1. */
export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 0 = Sunday .. 6 = Saturday. */
export function weekdayIndex(iso: string): number {
  return parseIsoDate(iso).getDay();
}

// ---------------------------------------------------------------------------
// Localised names (cached per locale; Hebrew keeps the diary's own short forms)
// ---------------------------------------------------------------------------

const weekdayLongCache = new Map<Locale, string[]>();
const weekdayShortCache = new Map<Locale, string[]>();
const monthCache = new Map<Locale, string[]>();

function cached(cache: Map<Locale, string[]>, locale: Locale, build: () => string[]): string[] {
  let names = cache.get(locale);
  if (!names) {
    names = build();
    cache.set(locale, names);
  }
  return names;
}

/** Weekday names of the current language, index 0 = Sunday ("שני" in Hebrew, "Monday" in English). */
export function localizedWeekdayNames(locale: Locale = getCurrentLocale()): string[] {
  // Hebrew: the bare name ("שני"), callers add "יום" themselves where wanted.
  if (locale === 'he') return WEEKDAY_NAMES;
  return cached(weekdayLongCache, locale, () => weekdayNames(locale, 'long'));
}

/** Short weekday names for grid headers ("ב" in Hebrew, "Mon" in English). */
export function localizedWeekdayShort(locale: Locale = getCurrentLocale()): string[] {
  if (locale === 'he') return WEEKDAY_SHORT;
  return cached(weekdayShortCache, locale, () => weekdayNames(locale, 'short'));
}

/** Month names of the current language as they stand alone in a list (nominative), index 0 = January. */
export function localizedMonthNames(locale: Locale = getCurrentLocale()): string[] {
  if (locale === 'he') return MONTH_NAMES;
  return cached(monthCache, locale, () => standaloneMonthNames(locale));
}

/** Weekday name in the current language, e.g. "שני" / "Monday". */
export function weekdayName(iso: string): string {
  return localizedWeekdayNames()[weekdayIndex(iso)];
}

/** Short weekday in the current language, e.g. "ב" / "Mon". */
export function weekdayShort(iso: string): string {
  return localizedWeekdayShort()[weekdayIndex(iso)];
}

/** Month number 1..12 -> name in the current language. */
export function monthName(month: number): string {
  return localizedMonthNames()[month - 1] ?? String(month);
}

/** Number of days in the given month (month = 1..12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** First day of the month containing `iso`. */
export function monthStart(iso: string): string {
  return iso.slice(0, 8) + '01';
}

/** Last day of the month containing `iso`. */
export function monthEnd(iso: string): string {
  const d = parseIsoDate(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(daysInMonth(d.getFullYear(), d.getMonth() + 1))}`;
}

/** Year and month (1..12) of an ISO date. */
export function yearMonth(iso: string): { year: number; month: number } {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) };
}

/** First day of the week containing `iso` (firstDayOfWeek: 0 = Sunday, 1 = Monday). */
export function weekStart(iso: string, firstDayOfWeek: 0 | 1 = 0): string {
  const wd = weekdayIndex(iso);
  const back = (wd - firstDayOfWeek + 7) % 7;
  return addDays(iso, -back);
}

/** All ISO dates from `from` to `to` inclusive (empty when from > to). */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  if (from > to) return out;
  let cur = from;
  const max = diffDays(from, to);
  for (let i = 0; i <= max; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Localised date text (current UI language)
// ---------------------------------------------------------------------------

/** Full date with weekday: "יום שני, 7 בספטמבר 2026" / "Monday, 7 September 2026". */
export function formatHebrewDate(iso: string): string {
  return formatDate(getCurrentLocale(), iso, 'full');
}

/** Alias of `formatHebrewDate` with a language-neutral name. */
export const formatFullDate = formatHebrewDate;

/** Date without weekday: "7 בספטמבר 2026" / "7 September 2026". */
export function formatLongDate(iso: string): string {
  return formatDate(getCurrentLocale(), iso, 'long');
}

/** Numeric short date: "7.9.2026" / "07/09/2026". */
export function formatShortDate(iso: string): string {
  return formatDate(getCurrentLocale(), iso, 'short');
}

/** Day and month only: "7.9" / "07/09". */
export function formatDayMonth(iso: string): string {
  return formatDate(getCurrentLocale(), iso, 'dayMonth');
}

/** "ספטמבר 2026" / "September 2026". */
export function formatMonthYear(year: number, month: number): string {
  return formatDate(getCurrentLocale(), `${year}-${pad2(month)}-01`, 'monthYear');
}

/**
 * A stored 'HH:MM' time as the current language writes a clock time: "22:56" in most languages,
 * "10:56 م" / "10:56 pm" / "10:56 μ.μ." where a 12-hour clock is customary (ar, hi, el). Every place
 * that shows an entry's time uses this, so a card and the entry page never disagree ("22:56" on one,
 * "10:56 م" on the other). A value that is not a valid time is returned unchanged.
 */
export function formatClock(time: string): string {
  return isValidTime(time) ? formatTime(getCurrentLocale(), time) : time;
}

/** "יום שני, 7 בספטמבר 2026 בשעה 08:30" / "Monday, 7 September 2026 at 08:30". */
export function formatDateTime(iso: string, time?: string | null): string {
  const date = formatHebrewDate(iso);
  if (!time) return date;
  return tr('shell.format.dateTime', { date, time: formatClock(time) });
}

/** Formats an ISO 8601 timestamp (createdAt/updatedAt) as a local date + time in the current language. */
export function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return formatDateTime(toIsoDate(d), nowHHMM(d));
}

/** "היום" / "אתמול" / "מחר" / "לפני 3 ימים" / "בעוד 3 ימים" (localised) / short date when far away. */
export function relativeDayLabel(iso: string, today: string = todayIso()): string {
  const diff = diffDays(iso, today);
  if (diff === 0) return tr('shell.format.today');
  if (diff === 1) return tr('shell.format.yesterday');
  if (diff === -1) return tr('shell.format.tomorrow');
  if (diff === 2) return tr('shell.format.dayBeforeYesterday');
  if (diff > 1 && diff <= 14) return tr('shell.format.daysAgo', { count: diff });
  if (diff < -1 && diff >= -14) return tr('shell.format.inDays', { count: -diff });
  return formatShortDate(iso);
}

/** Milliseconds until the next local midnight (used to refresh "today"). */
export function msUntilMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 5);
  return Math.max(1000, next.getTime() - now.getTime());
}
