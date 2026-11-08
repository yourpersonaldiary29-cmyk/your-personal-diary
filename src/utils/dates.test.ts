import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetLocaleForTests, setCurrentLocale } from '@/i18n/runtime';
import {
  addDays,
  formatClock,
  formatDateTime,
  formatDayMonth,
  formatFullDate,
  formatHebrewDate,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  formatTimestamp,
  monthName,
  relativeDayLabel,
  weekdayName,
  weekdayShort,
} from './dates';

const MONDAY = '2026-09-07';
const TODAY = '2026-09-10';

describe('date text in the UI language', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetLocaleForTests();
  });

  afterEach(() => {
    __resetLocaleForTests();
  });

  it('keeps the Hebrew wording exactly when the language is Hebrew', () => {
    setCurrentLocale('he');
    expect(formatHebrewDate(MONDAY)).toBe('יום שני, 7 בספטמבר 2026');
    expect(formatFullDate(MONDAY)).toBe('יום שני, 7 בספטמבר 2026');
    expect(formatLongDate(MONDAY)).toBe('7 בספטמבר 2026');
    expect(formatShortDate(MONDAY)).toBe('7.9.2026');
    expect(formatDayMonth(MONDAY)).toBe('7.9');
    expect(formatMonthYear(2026, 9)).toBe('ספטמבר 2026');
    expect(formatDateTime(MONDAY, '08:30')).toBe('יום שני, 7 בספטמבר 2026 בשעה 08:30');
    expect(formatDateTime(MONDAY)).toBe('יום שני, 7 בספטמבר 2026');
    expect(weekdayName(MONDAY)).toBe('שני');
    expect(weekdayShort(MONDAY)).toBe('ב');
    expect(weekdayName('2026-09-12')).toBe('שבת');
    expect(monthName(9)).toBe('ספטמבר');
    expect(monthName(1)).toBe('ינואר');
    expect(relativeDayLabel(TODAY, TODAY)).toBe('היום');
    expect(relativeDayLabel(addDays(TODAY, -1), TODAY)).toBe('אתמול');
    expect(relativeDayLabel(addDays(TODAY, 1), TODAY)).toBe('מחר');
    expect(relativeDayLabel(addDays(TODAY, -2), TODAY)).toBe('שלשום');
    expect(relativeDayLabel(addDays(TODAY, -3), TODAY)).toBe('לפני 3 ימים');
    expect(relativeDayLabel(addDays(TODAY, 3), TODAY)).toBe('בעוד 3 ימים');
    expect(relativeDayLabel(addDays(TODAY, -30), TODAY)).toBe('11.8.2026');
    const local = new Date(2026, 8, 7, 8, 30);
    expect(formatTimestamp(local.toISOString())).toBe('יום שני, 7 בספטמבר 2026 בשעה 08:30');
    expect(formatTimestamp('not a date')).toBe('not a date');
  });

  it('formats in English (the default) through Intl', () => {
    expect(formatHebrewDate(MONDAY)).toBe('Monday, 7 September 2026');
    expect(formatLongDate(MONDAY)).toBe('7 September 2026');
    expect(formatShortDate(MONDAY)).toBe('07/09/2026');
    expect(formatDayMonth(MONDAY)).toBe('07/09');
    expect(formatMonthYear(2026, 9)).toBe('September 2026');
    expect(formatDateTime(MONDAY, '08:30')).toBe('Monday, 7 September 2026 at 08:30');
    expect(weekdayName(MONDAY)).toBe('Monday');
    expect(weekdayShort(MONDAY)).toBe('Mon');
    expect(monthName(9)).toBe('September');
    expect(relativeDayLabel(TODAY, TODAY)).toBe('Today');
    expect(relativeDayLabel(addDays(TODAY, -1), TODAY)).toBe('Yesterday');
    expect(relativeDayLabel(addDays(TODAY, 1), TODAY)).toBe('Tomorrow');
    expect(relativeDayLabel(addDays(TODAY, -2), TODAY)).toBe('The day before yesterday');
    expect(relativeDayLabel(addDays(TODAY, -3), TODAY)).toBe('3 days ago');
    expect(relativeDayLabel(addDays(TODAY, 3), TODAY)).toBe('In 3 days');
    expect(relativeDayLabel(addDays(TODAY, -30), TODAY)).toBe('11/08/2026');
  });

  it('formats in German (dates through Intl, phrases from the German catalogue)', () => {
    setCurrentLocale('de');
    expect(formatHebrewDate(MONDAY)).toBe('Montag, 7. September 2026');
    expect(formatLongDate(MONDAY)).toBe('7. September 2026');
    expect(formatShortDate(MONDAY)).toBe('7.9.2026');
    expect(formatMonthYear(2026, 9)).toBe('September 2026');
    expect(weekdayName(MONDAY)).toBe('Montag');
    expect(weekdayShort(MONDAY)).toBe('Mo');
    expect(monthName(3)).toBe('März');
    expect(formatDateTime(MONDAY, '08:30')).toBe('Montag, 7. September 2026 um 08:30');
    expect(relativeDayLabel(addDays(TODAY, -3), TODAY)).toBe('vor 3 Tagen');
  });

  it('names a stand-alone month in the nominative in Greek (month lists), keeping the genitive inside dates', () => {
    setCurrentLocale('el');
    expect(monthName(10)).toBe('Οκτώβριος');
    expect(monthName(1)).toBe('Ιανουάριος');
    expect(formatLongDate('2026-10-01')).toBe('1 Οκτωβρίου 2026');
    expect(formatMonthYear(2026, 10)).toBe('Οκτώβριος 2026');
  });

  it('writes a clock time the way the language does: 24-hour in most, 12-hour in Arabic, Hindi and Greek', () => {
    for (const code of ['en', 'he', 'de', 'ja', 'th', 'ru'] as const) {
      setCurrentLocale(code);
      expect({ code, time: formatClock('22:56') }).toEqual({ code, time: '22:56' });
    }
    setCurrentLocale('ar');
    expect(formatClock('22:56')).toMatch(/^10:56\sم$/);
    setCurrentLocale('hi');
    expect(formatClock('22:56')).toMatch(/^10:56\spm$/i);
    setCurrentLocale('el');
    expect(formatClock('22:56')).toMatch(/^10:56\sμ\.μ\.$/);
    // The same text as inside a date + time, so a card and the entry page agree.
    expect(formatDateTime(MONDAY, '22:56')).toContain(formatClock('22:56'));
    // Not a time: shown as stored.
    expect(formatClock('25:99')).toBe('25:99');
    expect(formatClock('')).toBe('');
  });

  it('follows a language switch at call time', () => {
    expect(weekdayName(MONDAY)).toBe('Monday');
    setCurrentLocale('he');
    expect(weekdayName(MONDAY)).toBe('שני');
    setCurrentLocale('en');
    expect(weekdayName(MONDAY)).toBe('Monday');
  });
});
