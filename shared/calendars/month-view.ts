/**
 * Month views of the three calendar systems the calendar page can lay a
 * month out by: the civil (Gregorian) calendar, the Hebrew calendar and the
 * Hijri (Muslim, Umm al-Qura) calendar.
 *
 * A `MonthView` is one month of one system expressed in civil days: the
 * civil ISO date of every day of the month plus the label that day carries
 * in that system ('1'..'31', 'א׳'..'ל׳' or '1'..'30'). Everything is pure,
 * offline and memoised per (locale, system, first day); the Hebrew / Hijri
 * conversions come from `hebrew.ts` / `hijri.ts` (ICU calendars).
 *
 * Languages: every function takes an optional trailing `locale` (default
 * 'he'). Hebrew keeps gematria day labels and the Hebrew month names; other
 * languages get ICU month names with digits ('Tishri 5787', 'Ramadan 1447',
 * 'September 2026', 'septembre 2026').
 *
 * Month numbering
 *   gregorian  1..12 (January first)
 *   hijri      1..12 (Muharram first)
 *   hebrew     1..12 or 1..13 in Tishrei order: Adar = 6 in a plain year;
 *              Adar I = 6, Adar II = 7 (and Elul = 13) in a leap year.
 */
import { cjkDate, cjkHebrewMonthName, cjkHijriMonthName } from './cjk-months';
import { scriptHebrewMonthName, scriptHijriMonthName } from './script-months';
import { monthNames, standaloneMonthNames, type Locale } from '../i18n';
import type { CalendarExtras } from './types';
import { addDaysIso, daysBetween, daysInGregorianMonth, parseIsoDate, toIsoDate, utcNoon } from './civil';
import {
  formatHebrewDate,
  hebrewMonthName,
  hebrewMonthSpan,
  hebrewMonthsOfYear,
  hebrewNumeral,
  hebrewYearNumeral,
  isHebrewCalendarSupported,
  isHebrewLeapYear,
  toHebrewDate,
} from './hebrew';
import { formatHijriDate, hijriIntlCalendar, hijriMonthName, hijriMonthSpan, isHijriCalendarSupported, toHijriDate } from './hijri';
import { DAY_MONTH, DAY_MONTH_NUMERIC, DAY_MONTH_YEAR, LEGACY_LOCALE, MONTH_YEAR, digits, formatIntlDate, formatIntlRange } from './locale';

export type CalendarSystem = 'gregorian' | 'hebrew' | 'hijri';

/** The systems in display order. */
export const CALENDAR_SYSTEMS: readonly CalendarSystem[] = ['gregorian', 'hebrew', 'hijri'];

/** Type guard for stored / URL values. */
export function isCalendarSystem(value: unknown): value is CalendarSystem {
  return value === 'gregorian' || value === 'hebrew' || value === 'hijri';
}

export interface MonthViewDay {
  /** Civil day `YYYY-MM-DD`. */
  iso: string;
  /** 1-based day of the month in the view's system. */
  dayNumber: number;
  /** Cell label in the view's system: '7', 'י״ד', '14'. */
  dayLabel: string;
}

export interface MonthView {
  system: CalendarSystem;
  /** UI language the `title` and `dayLabel`s are rendered in. */
  locale: Locale;
  /** Year of the system: 2026 / 5787 / 1447. */
  year: number;
  /** See "Month numbering" above. */
  monthIndex: number;
  /** Stable key of the month: the month number for gregorian / hijri ('9'), the `HebrewMonth` key for hebrew ('tishrei', 'adar2'). */
  monthKey: string;
  /** 'ספטמבר 2026' / 'תשרי תשפ״ז' / 'רמדאן 1447' (he); 'September 2026' / 'Tishri 5787' / 'Ramadan 1447' (en). */
  title: string;
  /** Civil day of the 1st. */
  firstDay: string;
  /** Civil day of the last day. */
  lastDay: string;
  /** 28..31 (gregorian) or 29..30 (hebrew, hijri). */
  length: number;
  days: readonly MonthViewDay[];
}

/** One entry of a month <select>. */
export interface MonthOption {
  index: number;
  key: string;
  label: string;
}

const NO_CALENDAR: Record<Exclude<CalendarSystem, 'gregorian'>, string> = {
  hebrew: 'לוח השנה העברי אינו זמין במכשיר זה',
  hijri: 'הלוח ההג׳רי אינו זמין במכשיר זה',
};

function assertInteger(value: number, what: string): void {
  if (!Number.isInteger(value)) throw new RangeError(`${what} לא תקין: ${String(value)}`);
}

// ---------------------------------------------------------------------------
// Months of a year
// ---------------------------------------------------------------------------

/** The months of `year` in the given system, in order, for a month <select>, labelled in the locale. */
export function monthsOfYear(system: CalendarSystem, year: number, locale: Locale = LEGACY_LOCALE): MonthOption[] {
  assertInteger(year, 'שנה');
  switch (system) {
    case 'gregorian':
      return standaloneMonthNames(locale).map((label, i) => ({ index: i + 1, key: String(i + 1), label }));
    case 'hijri':
      return Array.from({ length: 12 }, (_, i) => ({ index: i + 1, key: String(i + 1), label: hijriMonthName(i + 1, locale) }));
    case 'hebrew':
      return hebrewMonthsOfYear(isHebrewLeapYear(year)).map((key, i) => ({ index: i + 1, key, label: hebrewMonthName(key, locale) }));
  }
}

// ---------------------------------------------------------------------------
// Building views
// ---------------------------------------------------------------------------

const MAX_CACHE = 600;
const viewCache = new Map<string, MonthView>();

/** Identity of a month independent of the language: system + civil first day ('gregorian:2026-09-01'). */
export function viewKey(view: Pick<MonthView, 'system' | 'firstDay'>): string {
  return `${view.system}:${view.firstDay}`;
}

function cacheKey(locale: Locale, system: CalendarSystem, firstDay: string): string {
  return `${locale}|${system}:${firstDay}`;
}

function buildDays(firstDay: string, length: number, label: (n: number) => string): readonly MonthViewDay[] {
  const days: MonthViewDay[] = [];
  for (let n = 1; n <= length; n++) {
    days.push(Object.freeze({ iso: n === 1 ? firstDay : addDaysIso(firstDay, n - 1), dayNumber: n, dayLabel: label(n) }));
  }
  return Object.freeze(days);
}

function remember(view: MonthView): MonthView {
  const key = cacheKey(view.locale, view.system, view.firstDay);
  const cached = viewCache.get(key);
  if (cached) return cached;
  if (viewCache.size >= MAX_CACHE) viewCache.clear();
  const frozen = Object.freeze(view);
  viewCache.set(key, frozen);
  return frozen;
}

/** Day-number label of a cell for systems that use digits. */
function digitLabel(locale: Locale): (n: number) => string {
  return locale === 'he' ? String : (n) => digits(locale, n);
}

function gregorianView(iso: string, locale: Locale): MonthView {
  const { year, month } = parseIsoDate(iso);
  const firstDay = toIsoDate(year, month, 1);
  const cached = viewCache.get(cacheKey(locale, 'gregorian', firstDay));
  if (cached) return cached;
  const length = daysInGregorianMonth(year, month);
  const title = locale === 'he' ? `${monthNames('he')[month - 1]} ${year}` : formatIntlDate(locale, 'gregory', utcNoon(firstDay), MONTH_YEAR);
  return remember({
    system: 'gregorian',
    locale,
    year,
    monthIndex: month,
    monthKey: String(month),
    title,
    firstDay,
    lastDay: toIsoDate(year, month, length),
    length,
    days: buildDays(firstDay, length, digitLabel(locale)),
  });
}

function hebrewView(iso: string, locale: Locale): MonthView {
  const hd = toHebrewDate(iso);
  const firstDay = hd.day === 1 ? iso : addDaysIso(iso, 1 - hd.day);
  const cached = viewCache.get(cacheKey(locale, 'hebrew', firstDay));
  if (cached) return cached;
  const length = hd.monthLength;
  const months = hebrewMonthsOfYear(hd.isLeapYear);
  let monthIndex = months.indexOf(hd.month) + 1;
  if (monthIndex === 0) monthIndex = hd.month === 'adar2' ? 7 : 6; // defensive: ICU and the leap rule disagree
  const cjkTitle = cjkHebrewMonthName(locale, hd.month);
  const title =
    locale === 'he'
      ? `${hd.monthName} ${hebrewYearNumeral(hd.year)}`
      : cjkTitle
        ? cjkDate(hd.year, cjkTitle, null)
        : formatIntlDate(locale, 'hebrew', utcNoon(firstDay), MONTH_YEAR, scriptHebrewMonthName(locale, hd.month));
  return remember({
    system: 'hebrew',
    locale,
    year: hd.year,
    monthIndex,
    monthKey: hd.month,
    title,
    firstDay,
    lastDay: addDaysIso(firstDay, length - 1),
    length,
    days: buildDays(firstDay, length, locale === 'he' ? hebrewNumeral : digitLabel(locale)),
  });
}

function hijriView(iso: string, locale: Locale): MonthView {
  const hd = toHijriDate(iso);
  const firstDay = hd.day === 1 ? iso : addDaysIso(iso, 1 - hd.day);
  const cached = viewCache.get(cacheKey(locale, 'hijri', firstDay));
  if (cached) return cached;
  // Walk forward from day 29 until the next civil day belongs to another month (29 or 30 days).
  let lastDay = addDaysIso(firstDay, 28);
  for (let guard = 0; guard < 3; guard++) {
    const next = addDaysIso(lastDay, 1);
    const n = toHijriDate(next);
    if (n.month !== hd.month || n.year !== hd.year) break;
    lastDay = next;
  }
  const length = daysBetween(firstDay, lastDay) + 1;
  const cjkTitle = cjkHijriMonthName(locale, hd.month);
  const title =
    locale === 'he'
      ? `${hd.monthName} ${hd.year}`
      : cjkTitle
        ? cjkDate(hd.year, cjkTitle, null)
        : formatIntlDate(locale, hijriIntlCalendar(), utcNoon(firstDay), MONTH_YEAR, scriptHijriMonthName(locale, hd.month));
  return remember({
    system: 'hijri',
    locale,
    year: hd.year,
    monthIndex: hd.month,
    monthKey: String(hd.month),
    title,
    firstDay,
    lastDay,
    length,
    days: buildDays(firstDay, length, digitLabel(locale)),
  });
}

/** The month (of `system`) that contains the civil day `iso`. Memoised; throws on bad input or a missing ICU calendar. */
export function monthViewContaining(system: CalendarSystem, iso: string, locale: Locale = LEGACY_LOCALE): MonthView {
  switch (system) {
    case 'gregorian':
      return gregorianView(iso, locale);
    case 'hebrew':
      return hebrewView(iso, locale);
    case 'hijri':
      return hijriView(iso, locale);
  }
}

/** The month before (`delta` = -1) or after (`delta` = 1) `view`, in the same system and language. */
export function adjacentMonthView(view: MonthView, delta: -1 | 1): MonthView {
  return monthViewContaining(view.system, delta > 0 ? addDaysIso(view.lastDay, 1) : addDaysIso(view.firstDay, -1), view.locale);
}

/** Days since the Unix epoch -> civil ISO day. */
function isoFromUnixDays(days: number): string {
  const d = new Date(Math.round(days) * 86_400_000);
  return toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Rough civil day of 1 `monthIndex` `year` AH: mean Hijri year (354.367 d) and month (29.5306 d) from the epoch 1 Muharram 1 AH = JD 1948439.5. */
function hijriEstimate(year: number, monthIndex: number): string {
  const jd = 1948439.5 + (year - 1) * 354.36707 + (monthIndex - 1) * 29.530589;
  return isoFromUnixDays(jd - 2440587.5);
}

/** Rough civil day of 1 `monthIndex` `year` AM: Rosh Hashana falls between 5 September and 5 October of year - 3761. */
function hebrewEstimate(year: number, monthIndex: number): string {
  return addDaysIso(toIsoDate(year - 3761, 9, 20), Math.round((monthIndex - 1) * 29.53));
}

function compareMonth(view: MonthView, year: number, monthIndex: number): number {
  if (view.year !== year) return view.year < year ? -1 : 1;
  if (view.monthIndex !== monthIndex) return view.monthIndex < monthIndex ? -1 : 1;
  return 0;
}

/**
 * The month of `system` by number: gregorian / hijri month 1..12, hebrew 1..12
 * (plain year) or 1..13 (leap year), see the header. Throws a RangeError for a
 * month outside the year or when the ICU calendar is missing.
 */
export function monthViewFor(system: CalendarSystem, year: number, monthIndex: number, locale: Locale = LEGACY_LOCALE): MonthView {
  assertInteger(year, 'שנה');
  assertInteger(monthIndex, 'חודש');
  const count = monthsOfYear(system, year, locale).length;
  if (monthIndex < 1 || monthIndex > count) throw new RangeError(`חודש מחוץ לטווח 1..${count}: ${String(monthIndex)}`);
  if (system === 'gregorian') return gregorianView(toIsoDate(year, monthIndex, 1), locale);
  if (system === 'hebrew' && !isHebrewCalendarSupported()) throw new Error(NO_CALENDAR.hebrew);
  if (system === 'hijri' && !isHijriCalendarSupported()) throw new Error(NO_CALENDAR.hijri);

  // Start from an estimate and step month by month until the numbers match (the estimate is within a month or two).
  let view = monthViewContaining(system, system === 'hijri' ? hijriEstimate(year, monthIndex) : hebrewEstimate(year, monthIndex), locale);
  for (let step = 0; step < 30; step++) {
    const cmp = compareMonth(view, year, monthIndex);
    if (cmp === 0) return view;
    view = adjacentMonthView(view, cmp < 0 ? 1 : -1);
  }
  throw new RangeError(`לא נמצא החודש ${String(monthIndex)} בשנת ${String(year)}`);
}

// ---------------------------------------------------------------------------
// Civil formatting and the "other" calendars of a view
// ---------------------------------------------------------------------------

export interface CivilFormatOptions {
  /** Append the year (default true). */
  withYear?: boolean;
  /** UI language (default 'he'). */
  locale?: Locale;
}

/** '12 בספטמבר 2026' / '12 בספטמבר' (he); '12 September 2026' / '12 September' (en); '12 septembre 2026' (fr). */
export function formatCivilDate(iso: string, opts?: CivilFormatOptions): string {
  const withYear = opts?.withYear ?? true;
  const locale = opts?.locale ?? LEGACY_LOCALE;
  const { year, month, day } = parseIsoDate(iso);
  if (locale === 'he') {
    const base = `${day} ב${monthNames('he')[month - 1]}`;
    return withYear ? `${base} ${year}` : base;
  }
  return formatIntlDate(locale, 'gregory', utcNoon(iso), withYear ? DAY_MONTH_YEAR : DAY_MONTH);
}

/** '12.9' (he) / '12/09' (en) / '12.9.' (de) - the compact civil date of a calendar cell. */
export function formatCivilDayMonth(iso: string): string;
export function formatCivilDayMonth(iso: string, locale: Locale): string;
export function formatCivilDayMonth(iso: string, locale: Locale = LEGACY_LOCALE): string {
  const { month, day } = parseIsoDate(iso);
  if (locale === 'he') return `${day}.${month}`;
  return formatIntlDate(locale, 'gregory', utcNoon(iso), DAY_MONTH_NUMERIC);
}

/**
 * '1–30 בספטמבר 2026', '12 בספטמבר – 11 באוקטובר 2026' or '20 בדצמבר 2026 – 18 בינואר 2027' (he);
 * '1 – 30 September 2026', '12 September – 11 October 2026' or '20 December 2026 – 18 January 2027' (en).
 */
export function civilSpan(from: string, to: string, locale: Locale = LEGACY_LOCALE): string {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  if (locale !== 'he') return formatIntlRange(locale, 'gregory', utcNoon(from), utcNoon(to), DAY_MONTH_YEAR);
  const names = monthNames('he');
  if (a.year === b.year) {
    if (a.month === b.month) return `${a.day}–${b.day} ב${names[a.month - 1]} ${a.year}`;
    return `${a.day} ב${names[a.month - 1]} – ${b.day} ב${names[b.month - 1]} ${a.year}`;
  }
  return `${formatCivilDate(from)} – ${formatCivilDate(to)}`;
}

/** The full date of a civil day in one system: '12 בספטמבר 2026' / 'א׳ בתשרי תשפ״ז' / '1 ברביע א-ת׳אני 1448' (he); '12 September 2026' / '1 Tishri 5787' / '1 Rabiʻ II 1448' (en). */
export function formatSystemDate(system: CalendarSystem, iso: string, opts?: CivilFormatOptions): string {
  switch (system) {
    case 'gregorian':
      return formatCivilDate(iso, opts);
    case 'hebrew':
      return formatHebrewDate(toHebrewDate(iso), opts);
    case 'hijri':
      return formatHijriDate(toHijriDate(iso), opts);
  }
}

/**
 * The dates of a civil day in the two calendars that are NOT the selected one,
 * for a screen-reader sentence: the civil date always (when not selected),
 * the Hebrew / Hijri date when switched on in `extras` and supported.
 *   gregorian: 'א׳ בתשרי תשפ״ז, 1 ברביע א-ת׳אני 1448'
 *   hebrew:    '12 בספטמבר 2026, 1 ברביע א-ת׳אני 1448'
 *   hijri:     '12 בספטמבר 2026, א׳ בתשרי תשפ״ז'
 */
export function otherDatesLabel(iso: string, extras: CalendarExtras, system: CalendarSystem = 'gregorian', locale: Locale = LEGACY_LOCALE): string {
  parseIsoDate(iso);
  const parts: string[] = [];
  if (system !== 'gregorian') parts.push(formatCivilDate(iso, { locale }));
  if (system !== 'hebrew' && extras.hebrewDates && isHebrewCalendarSupported()) parts.push(formatHebrewDate(toHebrewDate(iso), { locale }));
  if (system !== 'hijri' && extras.hijriDates && isHijriCalendarSupported()) parts.push(formatHijriDate(toHijriDate(iso), { locale }));
  return parts.join(', ');
}

/**
 * The month spans of a view in the two calendars that are NOT its own, for the
 * caption after the title (same rules as `otherDatesLabel`), in the view's language
 * unless `locale` is given:
 *   Tishrei 5787: ['12 בספטמבר – 11 באוקטובר 2026', 'רביע א-ת׳אני–ג׳ומאדא אל-אולא 1448']
 *   September 2026: ['אלול תשפ״ו – תשרי תשפ״ז', 'רביע אל-אוול–רביע א-ת׳אני 1448']
 */
export function otherMonthSpans(view: MonthView, extras: CalendarExtras, locale: Locale = view.locale ?? LEGACY_LOCALE): string[] {
  const out: string[] = [];
  if (view.system !== 'gregorian') out.push(civilSpan(view.firstDay, view.lastDay, locale));
  if (view.system !== 'hebrew' && extras.hebrewDates && isHebrewCalendarSupported()) out.push(hebrewMonthSpan(view.firstDay, view.lastDay, locale));
  if (view.system !== 'hijri' && extras.hijriDates && isHijriCalendarSupported()) out.push(hijriMonthSpan(view.firstDay, view.lastDay, locale));
  return out;
}
