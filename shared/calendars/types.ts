/**
 * Contract of the local calendar module (`shared/calendars`).
 *
 * Everything here is computed on the device with the ICU calendars built into
 * Node.js / WebView2 / browsers (`Intl.DateTimeFormat` with `u-ca-hebrew` and
 * `u-ca-islamic-umalqura`) plus pure arithmetic (Easter computus, Hebrew numerals).
 * No network, no external data files.
 *
 * Dates are civil Gregorian days written as `YYYY-MM-DD`. Jewish and Muslim days
 * begin at sunset; the calendar shows each holiday on the civil day of its daytime
 * (e.g. Rosh Hashana 5787 is shown on 2026-09-12, the evening before is "ערב").
 *
 * Languages: every text-producing function takes an optional trailing `locale`
 * (default 'he', the behaviour before localisation). Hebrew keeps gematria days
 * and Hebrew month names; other languages get ICU month names with digits
 * ('14 Tishri 5787', '14 Rabiʻ II 1448'). Holiday names, notes, tradition and
 * kind labels come from the 'holidays.*' catalogue (shared/i18n/messages).
 */
import { t, type Locale } from '../i18n';

// ---------------------------------------------------------------------------
// Hebrew calendar
// ---------------------------------------------------------------------------

/** Month keys of the Hebrew year, Tishrei first. `adar` is used in non-leap years, `adar1`/`adar2` in leap years. */
export type HebrewMonth =
  | 'tishrei'
  | 'cheshvan'
  | 'kislev'
  | 'tevet'
  | 'shevat'
  | 'adar'
  | 'adar1'
  | 'adar2'
  | 'nisan'
  | 'iyar'
  | 'sivan'
  | 'tammuz'
  | 'av'
  | 'elul';

export interface HebrewDate {
  /** e.g. 5787 */
  year: number;
  month: HebrewMonth;
  /** Hebrew month name: "תשרי", "אדר א׳", ... (use `hebrewMonthName(month, locale)` for other languages). */
  monthName: string;
  /** 1..30 */
  day: number;
  isLeapYear: boolean;
  /** Days in this month (29 or 30). */
  monthLength: number;
}

// ---------------------------------------------------------------------------
// Hijri (Islamic) calendar - Umm al-Qura arithmetic approximation
// ---------------------------------------------------------------------------

export interface HijriDate {
  /** e.g. 1448 */
  year: number;
  /** 1 = Muharram ... 12 = Dhu al-Hijjah */
  month: number;
  /** Hebrew transliteration: "מוחרם", "רמדאן", "ד׳ו אל-חיג׳ה", ... (use `hijriMonthName(month, locale)` for other languages). */
  monthName: string;
  /** 1..30 */
  day: number;
}

// ---------------------------------------------------------------------------
// Holidays
// ---------------------------------------------------------------------------

export type HolidayTradition = 'jewish' | 'muslim' | 'christian' | 'druze';

/**
 * major    - a principal holiday (יום טוב, עיד, Easter/Christmas ...)
 * minor    - a lesser observance (ראש חודש, ט"ו בשבט, Lag BaOmer ...)
 * fast     - a fast day
 * memorial - remembrance day (יום השואה, יום הזיכרון)
 * national - Israeli civic holiday (יום העצמאות, יום ירושלים)
 */
export type HolidayKind = 'major' | 'minor' | 'fast' | 'memorial' | 'national';

/** Christian rite, when a holiday is observed on different dates by different churches. */
export type ChristianRite = 'western' | 'orthodox';

export interface Holiday {
  /** Stable id, e.g. "jewish.rosh-hashana", "muslim.eid-al-fitr", "christian.easter.western", "druze.nabi-shuayb". */
  id: string;
  tradition: HolidayTradition;
  /** Hebrew display name, e.g. "ראש השנה", "עיד אל-פיטר", "חג הפסחא (מערבי)", "זיארת נבי שועייב" (kept for backward compatibility; use `holidayName(h, locale)`). */
  name: string;
  /**
   * Catalogue key of the name: 'holidays.' + the id with its dots replaced by dashes
   * ('holidays.jewish-rosh-hashana'), plus a variant suffix for day-specific names
   * ('holidays.jewish-sukkot.cholHamoed'). Resolve with `holidayName(h, locale)`.
   */
  nameKey?: string;
  /** Rosh Chodesh only: the Hebrew month that begins (the `{month}` placeholder of the name). */
  month?: HebrewMonth;
  kind: HolidayKind;
  /** Civil day `YYYY-MM-DD` on which this (day of the) holiday is shown. */
  date: string;
  /** 1-based index within a multi-day holiday (Sukkot day 3 ...). Absent for single-day holidays. */
  dayIndex?: number;
  /** Total days of the holiday (Hanukkah 8, Eid al-Adha 4 ...). Absent for single-day holidays. */
  dayCount?: number;
  /** Set for Christian holidays observed on rite-specific dates. */
  rite?: ChristianRite;
  /**
   * Hebrew note shown in the details, e.g.
   * "לפי לוח אום אל-קורא; המועד בפועל נקבע לפי ראיית הירח ועשוי לזוז ביום אחד."
   * or "נדחה מיום שבת" for a postponed fast (kept for backward compatibility; use `holidayNote(h, locale)`).
   */
  note?: string;
  /** Catalogue key of `note` ('holidays.note.*'). */
  noteKey?: string;
}

/** Which calendars and holiday sets the UI shows (stored in AppSettings.calendarExtras). */
export interface CalendarExtras {
  hebrewDates: boolean;
  hijriDates: boolean;
  jewishHolidays: boolean;
  muslimHolidays: boolean;
  christianHolidays: boolean;
  druzeHolidays: boolean;
}

export const DEFAULT_CALENDAR_EXTRAS: CalendarExtras = {
  hebrewDates: true,
  hijriDates: true,
  jewishHolidays: true,
  muslimHolidays: true,
  christianHolidays: true,
  druzeHolidays: true,
};

/**
 * Hebrew labels for the traditions (legend, settings, screen-reader text).
 * @deprecated Use `traditionLabel(tradition, locale)`.
 */
export const TRADITION_LABELS: Record<HolidayTradition, string> = {
  jewish: 'חגים ומועדים יהודיים',
  muslim: 'חגים ומועדים מוסלמיים',
  christian: 'חגים ומועדים נוצריים',
  druze: 'חגים ומועדים דרוזיים',
};

/**
 * Short Hebrew label per tradition for compact badges.
 * @deprecated Use `traditionShort(tradition, locale)`.
 */
export const TRADITION_SHORT: Record<HolidayTradition, string> = {
  jewish: 'יהודי',
  muslim: 'מוסלמי',
  christian: 'נוצרי',
  druze: 'דרוזי',
};

/** @deprecated Use `kindLabel(kind, locale)`. */
export const KIND_LABELS: Record<HolidayKind, string> = {
  major: 'חג',
  minor: 'מועד',
  fast: 'צום',
  memorial: 'יום זיכרון',
  national: 'יום לאומי',
};

/** Long label of a tradition in the locale: 'חגים ומועדים יהודיים' / 'Jewish holidays and observances'. */
export function traditionLabel(tradition: HolidayTradition, locale: Locale): string {
  return t(locale, `holidays.tradition.${tradition}`);
}

/** Short label of a tradition in the locale: 'יהודי' / 'Jewish'. */
export function traditionShort(tradition: HolidayTradition, locale: Locale): string {
  return t(locale, `holidays.traditionShort.${tradition}`);
}

/** Label of a holiday kind in the locale: 'חג' / 'Holiday', 'צום' / 'Fast'. */
export function kindLabel(kind: HolidayKind, locale: Locale): string {
  return t(locale, `holidays.kind.${kind}`);
}

/** Maps `CalendarExtras` flags to the traditions that are switched on. */
export function enabledTraditions(extras: CalendarExtras): HolidayTradition[] {
  const out: HolidayTradition[] = [];
  if (extras.jewishHolidays) out.push('jewish');
  if (extras.muslimHolidays) out.push('muslim');
  if (extras.christianHolidays) out.push('christian');
  if (extras.druzeHolidays) out.push('druze');
  return out;
}

/*
 * FUNCTIONS implemented by `shared/calendars/index.ts` (re-exported from the sub-modules).
 * `locale` is optional everywhere and defaults to 'he' (the pre-localisation output).
 *
 *   isHebrewCalendarSupported(): boolean          // Intl has 'hebrew'
 *   isHijriCalendarSupported(): boolean           // Intl has 'islamic-umalqura' (or 'islamic-civil' fallback)
 *
 *   toHebrewDate(iso: string): HebrewDate         // civil day -> Hebrew date (throws on bad input)
 *   hebrewNumeral(n: number): string              // 1 -> "א׳", 14 -> "י״ד", 15 -> "ט״ו", 16 -> "ט״ז", 30 -> "ל׳"
 *   hebrewYearNumeral(year: number): string       // 5787 -> "תשפ״ז" (thousands omitted)
 *   hebrewYearLabel(year, locale?)                // "תשפ״ז" / "5787"
 *   hebrewMonthName(month, locale?)               // "תשרי" / "Tishri" / "tichri" (ICU name in the language)
 *   formatHebrewDate(hd, { withYear?, locale? })  // "י״ד בתשרי תשפ״ז" / "14 Tishri 5787" / "14 Tishri"
 *   formatHebrewDay(hd, locale?)                  // "י״ד" / "14" (calendar cell)
 *   hebrewMonthSpan(from, to, locale?)            // "תשרי–חשוון תשפ״ז" / "Tishri – Heshvan 5787" / "Elul 5786 – Tishri 5787"
 *
 *   toHijriDate(iso: string): HijriDate
 *   hijriMonthName(month 1..12, locale?)          // "רמדאן" / "Ramadan" / "ramadan"
 *   formatHijriDate(hd, { withYear?, locale? })   // "14 ברביע א-ת׳אני 1448" / "14 Rabiʻ II 1448"
 *   formatHijriDay(hd, locale?)                   // "14" (calendar cell; Hijri days use digits)
 *   hijriMonthSpan(from, to, locale?)
 *
 *   holidaysOn(iso: string, traditions?: HolidayTradition[]): Holiday[]
 *   holidaysInRange(from: string, to: string, traditions?: HolidayTradition[]): Holiday[]  // sorted by date, then tradition order jewish, muslim, christian, druze
 *   holidaysByDate(from: string, to: string, traditions?: HolidayTradition[]): Map<string, Holiday[]>
 *   holidayName(h, locale) / holidayNote(h, locale) // catalogue-resolved name / note
 *   describeHoliday(h, locale?)                   // "ראש השנה (יום 1 מתוך 2)" / "Rosh Hashanah (day 1 of 2)"
 *   describeDay(iso, extras, locale?): { hebrew: string | null; hijri: string | null; holidays: Holiday[]; text: string }
 *       // text = screen-reader sentence, e.g. "י״ד בתשרי תשפ״ז, 14 ברביע א-ת׳אני 1448, ראש השנה (יום 1 מתוך 2)"
 *
 * All functions are pure and memoised per Gregorian year; a full year costs a few hundred Intl calls.
 */
