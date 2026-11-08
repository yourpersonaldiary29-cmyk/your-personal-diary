/**
 * Holiday queries over all traditions, memoised per (tradition, Gregorian year).
 *
 * The objects returned are shared between calls and frozen: treat them as
 * read-only (copy with `{ ...holiday }` if you need to change one).
 *
 * Text: `holidayName(h, locale)` / `holidayNote(h, locale)` resolve the
 * 'holidays.*' catalogue keys carried by every holiday; the sentence helpers
 * (`describeHoliday`, `describeDay`) take an optional trailing `locale`
 * (default 'he', the wording before localisation).
 */
import { lookup, t, type Locale } from '../../i18n';
import type { CalendarExtras, Holiday, HolidayTradition } from '../types';
import { enabledTraditions, traditionShort } from '../types';
import { compareIso, parseIsoDate, yearOf } from '../civil';
import { formatHebrewDate, hebrewMonthName, isHebrewCalendarSupported, toHebrewDate } from '../hebrew';
import { formatHijriDate, isHijriCalendarSupported, toHijriDate } from '../hijri';
import { LEGACY_LOCALE } from '../locale';
import { jewishHolidaysForYear } from './jewish';
import { muslimHolidaysForYear } from './muslim';
import { christianHolidaysForYear } from './christian';
import { druzeHolidaysForYear } from './druze';

export * from './jewish';
export * from './muslim';
export * from './christian';
export * from './druze';
export { holidayNameKey } from './scan';

/** Display/sort order of the traditions. */
export const TRADITION_ORDER: readonly HolidayTradition[] = ['jewish', 'muslim', 'christian', 'druze'];

const ORDER_INDEX: Record<HolidayTradition, number> = { jewish: 0, muslim: 1, christian: 2, druze: 3 };

const yearCache = new Map<string, readonly Holiday[]>();

function computeYear(year: number, tradition: HolidayTradition): Holiday[] {
  switch (tradition) {
    case 'jewish':
      return jewishHolidaysForYear(year);
    case 'muslim':
      return muslimHolidaysForYear(year);
    case 'christian':
      return christianHolidaysForYear(year);
    case 'druze':
      return druzeHolidaysForYear(year);
  }
}

/** All holiday days of one tradition inside the Gregorian `year`, sorted by date (memoised). */
export function holidaysForYear(year: number, tradition: HolidayTradition): readonly Holiday[] {
  if (!Number.isInteger(year)) throw new Error(`שנה לא תקינה: ${String(year)}`);
  if (!Object.hasOwn(ORDER_INDEX, tradition)) throw new Error(`מסורת לא מוכרת: ${String(tradition)}`);
  const key = `${tradition}:${year}`;
  let list = yearCache.get(key);
  if (!list) {
    list = Object.freeze(computeYear(year, tradition).map((h) => Object.freeze(h)));
    yearCache.set(key, list);
  }
  return list;
}

/** Drops the memoised years (tests / after a settings change that swaps calendars). */
export function clearHolidayCache(): void {
  yearCache.clear();
}

function normaliseTraditions(traditions?: readonly HolidayTradition[]): HolidayTradition[] {
  if (!traditions) return [...TRADITION_ORDER];
  const set = new Set(traditions);
  return TRADITION_ORDER.filter((t) => set.has(t));
}

function sortHolidays(list: Holiday[]): Holiday[] {
  // Stable sort: date, then tradition order; emission order is kept inside a tradition.
  return list.sort((a, b) => compareIso(a.date, b.date) || ORDER_INDEX[a.tradition] - ORDER_INDEX[b.tradition]);
}

/** Holidays shown on the civil day `iso` (all traditions unless `traditions` is given). */
export function holidaysOn(iso: string, traditions?: readonly HolidayTradition[]): Holiday[] {
  const year = yearOf(iso);
  const out: Holiday[] = [];
  for (const t of normaliseTraditions(traditions)) {
    for (const h of holidaysForYear(year, t)) if (h.date === iso) out.push(h);
  }
  return out;
}

/**
 * Holidays with `from <= date <= to` (inclusive), sorted by date and then by
 * tradition order jewish, muslim, christian, druze.
 */
export function holidaysInRange(from: string, to: string, traditions?: readonly HolidayTradition[]): Holiday[] {
  const fromYear = parseIsoDate(from).year;
  const toYear = parseIsoDate(to).year;
  if (from > to) return [];
  const out: Holiday[] = [];
  for (const t of normaliseTraditions(traditions)) {
    for (let year = fromYear; year <= toYear; year++) {
      for (const h of holidaysForYear(year, t)) if (h.date >= from && h.date <= to) out.push(h);
    }
  }
  return sortHolidays(out);
}

/** Same as `holidaysInRange`, grouped by civil day (only days that have holidays appear). */
export function holidaysByDate(from: string, to: string, traditions?: readonly HolidayTradition[]): Map<string, Holiday[]> {
  const map = new Map<string, Holiday[]>();
  for (const h of holidaysInRange(from, to, traditions)) {
    const list = map.get(h.date);
    if (list) list.push(h);
    else map.set(h.date, [h]);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/**
 * Name of a holiday in the locale: "ראש השנה" / "Rosh Hashanah",
 * "ראש חודש חשוון" / "Rosh Chodesh Heshvan". Falls back to the Hebrew `name`
 * when the holiday carries no catalogue key (objects built by hand).
 */
export function holidayName(h: Holiday, locale: Locale): string {
  if (!h.nameKey || lookup(locale, h.nameKey) === null) return h.name;
  return h.month ? t(locale, h.nameKey, { month: hebrewMonthName(h.month, locale) }) : t(locale, h.nameKey);
}

/** The note of a holiday in the locale ("נדחה מיום שבת" / "Postponed from Shabbat"), or undefined when it has none. */
export function holidayNote(h: Holiday, locale: Locale): string | undefined {
  if (h.noteKey && lookup(locale, h.noteKey) !== null) return t(locale, h.noteKey);
  return h.note;
}

/**
 * "ראש השנה (יום 1 מתוך 2)" / "Rosh Hashanah (day 1 of 2)", "יום כיפור" - one holiday for a
 * screen-reader sentence. Overloaded so `holidays.map(describeHoliday)` keeps type-checking.
 */
export function describeHoliday(h: Holiday): string;
export function describeHoliday(h: Holiday, locale: Locale): string;
export function describeHoliday(h: Holiday, locale: Locale = LEGACY_LOCALE): string {
  const name = holidayName(h, locale);
  return h.dayCount && h.dayIndex ? t(locale, 'holidays.dayOf', { name, index: h.dayIndex, count: h.dayCount }) : name;
}

/**
 * `describeHoliday`, plus the tradition when another holiday listed for the
 * same day has the same name (Eid al-Adha is both Muslim and Druze:
 * "עיד אל-אדחא (יום 1 מתוך 4) (מוסלמי)" / "Eid al-Adha (day 1 of 4) (Muslim)"),
 * so a spoken list never repeats itself without saying why. Same format as the UI's `holidayLabel`.
 */
export function describeHolidayAmong(h: Holiday, shown: readonly Holiday[], locale: Locale = LEGACY_LOCALE): string {
  const label = describeHoliday(h, locale);
  const name = holidayName(h, locale);
  const sameName = shown.some((other) => other !== h && holidayName(other, locale) === name);
  return sameName ? t(locale, 'holidays.withTradition', { label, tradition: traditionShort(h.tradition, locale) }) : label;
}

export interface DayDescription {
  /** "י״ד בתשרי תשפ״ז" / "14 Tishri 5787", or null when Hebrew dates are off / unsupported. */
  hebrew: string | null;
  /** "14 ברביע א-ת׳אני 1448" / "14 Rabiʻ II 1448", or null when Hijri dates are off / unsupported. */
  hijri: string | null;
  holidays: Holiday[];
  /** Screen-reader sentence: "י״ד בתשרי תשפ״ז, 14 ברביע א-ת׳אני 1448, ראש השנה (יום 1 מתוך 2)". */
  text: string;
}

/** Everything the UI says about one civil day, honouring the user's `CalendarExtras`, in the locale. */
export function describeDay(iso: string, extras: CalendarExtras, locale: Locale = LEGACY_LOCALE): DayDescription {
  parseIsoDate(iso);
  const hebrew = extras.hebrewDates && isHebrewCalendarSupported() ? formatHebrewDate(toHebrewDate(iso), { locale }) : null;
  const hijri = extras.hijriDates && isHijriCalendarSupported() ? formatHijriDate(toHijriDate(iso), { locale }) : null;
  const traditions = enabledTraditions(extras);
  const holidays = traditions.length > 0 ? holidaysOn(iso, traditions) : [];
  const parts: string[] = [];
  if (hebrew) parts.push(hebrew);
  if (hijri) parts.push(hijri);
  for (const h of holidays) parts.push(describeHolidayAmong(h, holidays, locale));
  return { hebrew, hijri, holidays, text: parts.join(', ') };
}
