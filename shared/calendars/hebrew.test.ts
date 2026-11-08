import { describe, expect, it } from 'vitest';
import {
  formatHebrewDate,
  formatHebrewDay,
  hebrewMonthSpan,
  hebrewNumeral,
  hebrewNumeralLetters,
  hebrewYearNumeral,
  isHebrewCalendarSupported,
  isHebrewLeapYear,
  nextHebrewMonth,
  toHebrewDate,
} from './hebrew';

describe('Hebrew numerals', () => {
  it('follows the geresh / gershayim rules', () => {
    const table: [number, string][] = [
      [1, 'א׳'],
      [2, 'ב׳'],
      [9, 'ט׳'],
      [10, 'י׳'],
      [11, 'י״א'],
      [14, 'י״ד'],
      [15, 'ט״ו'],
      [16, 'ט״ז'],
      [17, 'י״ז'],
      [18, 'י״ח'],
      [20, 'כ׳'],
      [21, 'כ״א'],
      [29, 'כ״ט'],
      [30, 'ל׳'],
      [33, 'ל״ג'],
      [100, 'ק׳'],
      [115, 'קט״ו'],
      [116, 'קט״ז'],
      [200, 'ר׳'],
      [304, 'ש״ד'],
      [400, 'ת׳'],
      [500, 'ת״ק'],
      [613, 'תרי״ג'],
      [700, 'ת״ש'],
      [786, 'תשפ״ו'],
      [787, 'תשפ״ז'],
      [800, 'ת״ת'],
      [900, 'תת״ק'],
      [999, 'תתקצ״ט'],
    ];
    for (const [n, expected] of table) expect(hebrewNumeral(n), `numeral ${n}`).toBe(expected);
  });

  it('returns bare letters when asked', () => {
    expect(hebrewNumeralLetters(15)).toBe('טו');
    expect(hebrewNumeralLetters(787)).toBe('תשפז');
  });

  it('rejects numbers outside 1..999', () => {
    expect(() => hebrewNumeral(0)).toThrow(RangeError);
    expect(() => hebrewNumeral(1000)).toThrow(RangeError);
    expect(() => hebrewNumeral(2.5)).toThrow(RangeError);
  });

  it('formats years without the thousands', () => {
    expect(hebrewYearNumeral(5787)).toBe('תשפ״ז');
    expect(hebrewYearNumeral(5786)).toBe('תשפ״ו');
    expect(hebrewYearNumeral(5800)).toBe('ת״ת');
    expect(hebrewYearNumeral(5784)).toBe('תשפ״ד');
    expect(hebrewYearNumeral(6000)).toBe('ו׳ אלפים');
  });
});

describe('Hebrew dates (Intl hebrew calendar)', () => {
  it('is supported by this engine', () => {
    expect(isHebrewCalendarSupported()).toBe(true);
  });

  it('2026-09-12 is 1 Tishrei 5787 (a leap year: Adar I follows in February 2027)', () => {
    const hd = toHebrewDate('2026-09-12');
    expect(hd).toMatchObject({ year: 5787, month: 'tishrei', monthName: 'תשרי', day: 1, isLeapYear: true, monthLength: 30 });
  });

  it('5787 is a leap year (has Adar I) and 5786 is not', () => {
    expect(isHebrewLeapYear(5787)).toBe(true);
    expect(isHebrewLeapYear(5786)).toBe(false);
    expect(toHebrewDate('2026-09-12').isLeapYear).toBe(true);
    expect(toHebrewDate('2026-03-03').isLeapYear).toBe(false);
  });

  it('2027-02-08 is 1 Adar I 5787 (leap year)', () => {
    const hd = toHebrewDate('2027-02-08');
    expect(hd).toMatchObject({ year: 5787, month: 'adar1', monthName: 'אדר א׳', day: 1, isLeapYear: true, monthLength: 30 });
    expect(toHebrewDate('2027-03-10')).toMatchObject({ month: 'adar2', monthName: 'אדר ב׳', day: 1, monthLength: 29 });
  });

  it('2026-03-03 is 14 Adar 5786 and formats as י״ד באדר תשפ״ו', () => {
    const hd = toHebrewDate('2026-03-03');
    expect(hd).toMatchObject({ year: 5786, month: 'adar', monthName: 'אדר', day: 14, isLeapYear: false, monthLength: 29 });
    expect(formatHebrewDate(hd)).toBe('י״ד באדר תשפ״ו');
    expect(formatHebrewDate(hd, { withYear: false })).toBe('י״ד באדר');
    expect(formatHebrewDay(hd)).toBe('י״ד');
  });

  it('knows the variable months (Cheshvan/Kislev) and the fixed ones', () => {
    // 5786: Cheshvan starts 2025-10-23, Kislev 2025-11-21 -> Cheshvan has 29 days.
    expect(toHebrewDate('2025-10-23')).toMatchObject({ month: 'cheshvan', day: 1, monthLength: 29 });
    // Kislev 5786: 2025-11-21 .. Tevet 2025-12-21 -> 30 days.
    expect(toHebrewDate('2025-11-21')).toMatchObject({ month: 'kislev', day: 1, monthLength: 30 });
    expect(toHebrewDate('2025-12-20')).toMatchObject({ month: 'kislev', day: 30 });
    expect(toHebrewDate('2026-08-14')).toMatchObject({ month: 'elul', day: 1, monthLength: 29 });
    expect(toHebrewDate('2026-03-19')).toMatchObject({ month: 'nisan', day: 1, monthLength: 30 });
  });

  it('is memoised (same object on repeated calls) and fast for a whole year', () => {
    expect(toHebrewDate('2026-05-05')).toBe(toHebrewDate('2026-05-05'));
    const t = performance.now();
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 28; d++) toHebrewDate(`2028-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    expect(performance.now() - t).toBeLessThan(300);
  });

  it('throws on bad input', () => {
    expect(() => toHebrewDate('2026-13-01')).toThrow(/תאריך לא תקין/);
    expect(() => toHebrewDate('2026-02-30')).toThrow(/תאריך לא תקין/);
    expect(() => toHebrewDate('12/09/2026')).toThrow(/תאריך לא תקין/);
    expect(() => toHebrewDate('')).toThrow(/תאריך לא תקין/);
  });

  it('nextHebrewMonth walks the year, with Adar I/II in leap years', () => {
    expect(nextHebrewMonth('shevat', false)).toBe('adar');
    expect(nextHebrewMonth('shevat', true)).toBe('adar1');
    expect(nextHebrewMonth('adar1', true)).toBe('adar2');
    expect(nextHebrewMonth('adar2', true)).toBe('nisan');
    expect(nextHebrewMonth('adar', false)).toBe('nisan');
    expect(nextHebrewMonth('elul', false)).toBe('tishrei');
  });
});

describe('hebrewMonthSpan', () => {
  it('formats one month, two months of one year, and a year boundary', () => {
    expect(hebrewMonthSpan('2026-09-13', '2026-10-11')).toBe('תשרי תשפ״ז');
    expect(hebrewMonthSpan('2026-09-27', '2026-10-31')).toBe('תשרי–חשוון תשפ״ז');
    expect(hebrewMonthSpan('2026-08-30', '2026-10-03')).toBe('אלול תשפ״ו – תשרי תשפ״ז');
  });
});
