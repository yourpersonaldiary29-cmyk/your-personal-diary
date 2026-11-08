/**
 * Local calendars module: Hebrew and Hijri dates, Easter computus and the
 * holidays of the Jewish, Muslim, Christian and Druze traditions.
 *
 * Pure, dependency-free, offline. Works in Node (server, vitest) and in
 * WebView2 / browsers. See `types.ts` for the contract. Every text-producing
 * function takes an optional trailing `locale` (default 'he').
 */
export * from './types';
export {
  HEBREW_MONTH_NAMES,
  hebrewMonthsOfYear,
  nextHebrewMonth,
  isHebrewLeapYear,
  isHebrewCalendarSupported,
  toHebrewDate,
  hebrewNumeral,
  hebrewNumeralLetters,
  hebrewYearNumeral,
  hebrewYearLabel,
  hebrewMonthName,
  formatHebrewDate,
  formatHebrewDay,
  hebrewMonthSpan,
  type HebrewFormatOptions,
} from './hebrew';
export {
  HIJRI_MONTH_NAMES,
  type HijriCalendarId,
  hijriCalendarName,
  hijriIntlCalendar,
  isHijriCalendarSupported,
  toHijriDate,
  hijriMonthName,
  formatHijriDate,
  formatHijriDay,
  hijriMonthSpan,
  type HijriFormatOptions,
} from './hijri';
export { westernEaster, orthodoxEaster, julianEaster, julianToGregorian } from './easter';
export * from './holidays/index';
// Month views of the three calendar systems (calendar page layout); also importable directly from './month-view'.
export * from './month-view';
