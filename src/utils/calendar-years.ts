/**
 * The years of the calendar page ("/calendar"), in one place per calendar system.
 *
 * Two ranges per system:
 *  - OFFERED: the years the year <select> lists (CALENDAR-YEARS.md, owner request 2026-10-27):
 *      Gregorian  from 1980 (GREGORIAN_FIRST_YEAR)         to today's year + 10 (unchanged)
 *      Hebrew     from 5731 = תשל״א (HEBREW_FIRST_YEAR)     to 5810 (unchanged)
 *      Hijri      from the current Hijri year - 40 (HIJRI_YEARS_BACK, computed, never a fixed year)
 *                 to 1470 (unchanged)
 *    The select always includes the visible year as well (a month reached with the month buttons).
 *  - HARD: years whose every month lies inside the server's civil range 1970-01-01..2200-12-31
 *    (server/src/stats/calendar.ts MIN_YEAR / MAX_YEAR); a year in the URL is clamped into it and
 *    the month buttons / keyboard / system select never leave it (`navigableView`): a Hebrew or
 *    Hijri month just outside it (Elul 5730, Dhu al-Hijjah 1389, Tishrei 5961, Muharram 1627) still
 *    lies inside the civil range, but the URL would clamp its year and show another month, so it is
 *    refused. The offered ranges lie inside it, so every offered month is answered by the server
 *    (/api/calendar/month for Gregorian months, /api/calendar/range for Hebrew and Hijri months)
 *    and by the offline cache.
 *
 * Pure module (no React): the page re-exports what its tests and callers used to import from it.
 */
import { hebrewYearLabel, hebrewYearNumeral } from '@shared/calendars';
import { monthsOfYear, monthViewContaining, monthViewFor, type CalendarSystem, type MonthView } from '@shared/calendars/month-view';
import type { Locale } from '@shared/i18n';
import type { SelectOption } from '@/components/ui/Select';
import { getCurrentLocale } from '@/i18n/runtime';

/** Year range accepted by the server (stats/calendar.ts). */
export const CALENDAR_MIN_YEAR = 1970;
export const CALENDAR_MAX_YEAR = 2200;
/** The same limits as civil days: every day of a visible month must lie inside. */
export const CALENDAR_MIN_ISO = '1970-01-01';
export const CALENDAR_MAX_ISO = '2200-12-31';

/** First Gregorian year the year select offers. */
export const GREGORIAN_FIRST_YEAR = 1980;
/** The year select offers Gregorian years up to today's year + this many (unchanged). */
export const GREGORIAN_YEARS_AHEAD = 10;
/** First Hebrew year the year select offers: 5731 (תשל״א, from 1 October 1970). */
export const HEBREW_FIRST_YEAR = 5731;
/** Last Hebrew year the year select offers (unchanged). */
export const HEBREW_LAST_YEAR = 5810;
/** The Hijri year select starts this many years before the current Hijri year. */
export const HIJRI_YEARS_BACK = 40;
/** Last Hijri year the year select offers (unchanged). */
export const HIJRI_LAST_YEAR = 1470;

/** Years whose every month lies inside the server's civil range (see CALENDAR_MIN_ISO / MAX_ISO). */
export const CALENDAR_HARD_YEARS: Record<CalendarSystem, readonly [number, number]> = {
  gregorian: [CALENDAR_MIN_YEAR, CALENDAR_MAX_YEAR],
  hebrew: [5731, 5960],
  hijri: [1390, 1626],
};

/**
 * The years the year select offers for `system`, first and last, before the visible year is added.
 * `todayYear` is the year of today in that system (2026 / 5787 / 1448): the Gregorian upper end and
 * the Hijri lower end are counted from it.
 */
export function offeredYearRange(system: CalendarSystem, todayYear: number): readonly [number, number] {
  switch (system) {
    case 'gregorian':
      return [GREGORIAN_FIRST_YEAR, todayYear + GREGORIAN_YEARS_AHEAD];
    case 'hebrew':
      return [HEBREW_FIRST_YEAR, HEBREW_LAST_YEAR];
    case 'hijri':
      return [todayYear - HIJRI_YEARS_BACK, HIJRI_LAST_YEAR];
  }
}

/** The first year the select offers for `system` (see `offeredYearRange`). */
export function firstOfferedYear(system: CalendarSystem, todayYear: number): number {
  return offeredYearRange(system, todayYear)[0];
}

/**
 * Options of the year select for `system`, around `todayYear` (the year of today in that system), always including `viewYear`.
 * Hebrew years read "תשפ״ז (5787)" in Hebrew and "5787" in other languages.
 */
export function yearOptionsFor(system: CalendarSystem, viewYear: number, todayYear: number, locale: Locale = getCurrentLocale()): SelectOption[] {
  const [min, max] = CALENDAR_HARD_YEARS[system];
  const [rangeFrom, rangeTo] = offeredYearRange(system, todayYear);
  const from = Math.max(min, Math.min(rangeFrom, viewYear));
  const to = Math.min(max, Math.max(rangeTo, viewYear));
  const label = (y: number): string => {
    if (system !== 'hebrew') return String(y);
    return locale === 'he' ? `${hebrewYearNumeral(y)} (${y})` : hebrewYearLabel(y, locale);
  };
  const out: SelectOption[] = [];
  for (let y = from; y <= to; y++) out.push({ value: String(y), label: label(y) });
  return out;
}

/** True when every day of the view lies inside the server's civil range. */
export function insideCalendarLimits(view: Pick<MonthView, 'firstDay' | 'lastDay'>): boolean {
  return view.firstDay >= CALENDAR_MIN_ISO && view.lastDay <= CALENDAR_MAX_ISO;
}

/**
 * True when the page may show `view`: its year lies inside `CALENDAR_HARD_YEARS` of its system and
 * every day inside the server's civil range. These are exactly the months `resolveView` gives back
 * unchanged from their own URL, so the month buttons, PageUp / PageDown, the arrow keys and the
 * system select go only to such months and refuse the rest (they never jump to another month).
 */
export function navigableView(view: Pick<MonthView, 'system' | 'year' | 'firstDay' | 'lastDay'>): boolean {
  const [min, max] = CALENDAR_HARD_YEARS[view.system];
  return view.year >= min && view.year <= max && insideCalendarLimits(view);
}

function clampYearParam(raw: string | null, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function monthParamOf(raw: string | null, count: number, fallback: number): number {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 1 || n > count) return fallback;
  return n;
}

/**
 * The month to show for the query string: `year` is clamped into the
 * system's range, a missing / invalid `month` falls back to today's month of
 * that system, and anything the calendars cannot resolve becomes the month
 * containing today. The view's titles and labels are rendered in `locale`.
 */
export function resolveView(system: CalendarSystem, yearRaw: string | null, monthRaw: string | null, today: string, locale: Locale = getCurrentLocale()): MonthView {
  const todayView = monthViewContaining(system, today, locale);
  const [min, max] = CALENDAR_HARD_YEARS[system];
  const year = clampYearParam(yearRaw, min, max, todayView.year);
  const count = monthsOfYear(system, year, locale).length;
  const month = monthParamOf(monthRaw, count, Math.min(todayView.monthIndex, count));
  try {
    const view = monthViewFor(system, year, month, locale);
    return navigableView(view) ? view : todayView;
  } catch {
    return todayView;
  }
}
