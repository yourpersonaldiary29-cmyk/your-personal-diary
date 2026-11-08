/**
 * Date helpers. All diary dates are local calendar dates written as `YYYY-MM-DD`.
 * We deliberately avoid `Date` timezone pitfalls by working with the string form
 * and a small day-number arithmetic (days since 1970-01-01 UTC).
 *
 * Localised output (weekday names, long dates) goes through '@shared/i18n'
 * (`formatDate(locale, iso, style)`, wrapped here as `weekdayNameIn`). The Hebrew-only
 * helpers at the bottom are kept for modules that have not received a locale yet.
 */
import { formatDate, weekdayNames, type Locale } from '@shared/i18n';
import type { Period } from '@shared/types';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isHHMM(s: unknown): s is string {
  return typeof s === 'string' && TIME_RE.test(s);
}

/** Local today as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local time as HH:MM. */
export function nowHHMM(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

/** Days since epoch for an ISO date (UTC based, so no DST surprises). */
export function dayNumber(iso: string): number {
  const m = DATE_RE.exec(iso);
  if (!m) throw new Error(`bad date ${iso}`);
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

export function fromDayNumber(n: number): string {
  const d = new Date(n * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function addDays(iso: string, days: number): string {
  return fromDayNumber(dayNumber(iso) + days);
}

/** Inclusive difference in days (b - a). */
export function diffDays(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(iso: string): number {
  // 1970-01-01 was a Thursday (4).
  return (((dayNumber(iso) + 4) % 7) + 7) % 7;
}

/** Full localised weekday name of a civil date: 'Monday' / 'יום שני' / 'Montag'. */
export function weekdayNameIn(locale: Locale, iso: string): string {
  return formatDate(locale, iso, 'weekday');
}

/** Start of the week (Sunday by default) containing `iso`. */
export function weekStart(iso: string, firstDay: 0 | 1 = 0): string {
  const wd = weekday(iso);
  const offset = (wd - firstDay + 7) % 7;
  return addDays(iso, -offset);
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Inclusive list of ISO dates. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const a = dayNumber(from);
  const b = dayNumber(to);
  for (let n = a; n <= b; n++) out.push(fromDayNumber(n));
  return out;
}

/** Inclusive [from, to] for a period ending at `today`; `from` is null for 'all'. */
export function periodRange(period: Period, today: string): { from: string | null; to: string } {
  const days: Record<Period, number | null> = { '7d': 7, '30d': 30, '3m': 90, '6m': 180, '1y': 365, all: null };
  const n = days[period];
  return { from: n == null ? null : addDays(today, -(n - 1)), to: today };
}

/** "07/09/2026" - numeric day/month/year (locale independent). */
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function clampDateRange(from: string | null | undefined, to: string | null | undefined, today: string) {
  return {
    from: from && isIsoDate(from) ? from : null,
    to: to && isIsoDate(to) ? to : today,
  };
}

// ---------------------------------------------------------------------------
// Hebrew-only legacy helpers (modules without a locale yet). New code should call
// `formatDate(locale, iso, style)` from '@shared/i18n' or `weekdayNameIn(locale, iso)`.
// ---------------------------------------------------------------------------

let hebrewWeekdays: string[] | null = null;

/** Bare Hebrew weekday name ('שני'; callers prepend 'יום'). Legacy: prefer `weekdayNameIn(locale, iso)`. */
export function weekdayName(iso: string): string {
  if (!hebrewWeekdays) hebrewWeekdays = weekdayNames('he').map((name) => name.replace(/^יום /, ''));
  return hebrewWeekdays[weekday(iso)];
}

/** "יום שני, 7 בספטמבר 2026" - Hebrew full date. Legacy: prefer `formatDate(locale, iso, 'full')`. */
export function formatHebrewDate(iso: string): string {
  return formatDate('he', iso, 'full');
}
