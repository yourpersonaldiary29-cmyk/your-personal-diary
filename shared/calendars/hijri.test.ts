import { describe, expect, it } from 'vitest';
import {
  formatHijriDate,
  formatHijriDay,
  hijriCalendarName,
  hijriMonthSpan,
  HIJRI_MONTH_NAMES,
  isHijriCalendarSupported,
  toHijriDate,
} from './hijri';

describe('Hijri dates (Intl islamic-umalqura calendar)', () => {
  it('uses the Umm al-Qura calendar on this engine', () => {
    expect(isHijriCalendarSupported()).toBe(true);
    expect(hijriCalendarName()).toBe('islamic-umalqura');
  });

  it('has 12 Hebrew month names', () => {
    expect(HIJRI_MONTH_NAMES).toHaveLength(12);
    expect(HIJRI_MONTH_NAMES[8]).toBe('רמדאן');
  });

  it('2026-02-18 is 1 Ramadan 1447', () => {
    expect(toHijriDate('2026-02-18')).toEqual({ year: 1447, month: 9, monthName: 'רמדאן', day: 1 });
  });

  it('2026-05-27 is 10 Dhu al-Hijjah 1447', () => {
    expect(toHijriDate('2026-05-27')).toEqual({ year: 1447, month: 12, monthName: 'ד׳ו אל-חיג׳ה', day: 10 });
  });

  it('2026-09-25 is 14 Rabi II 1448 and formats with a ב prefix and digits', () => {
    const hd = toHijriDate('2026-09-25');
    expect(hd).toEqual({ year: 1448, month: 4, monthName: 'רביע א-ת׳אני', day: 14 });
    expect(formatHijriDate(hd)).toBe('14 ברביע א-ת׳אני 1448');
    expect(formatHijriDate(hd, { withYear: false })).toBe('14 ברביע א-ת׳אני');
    expect(formatHijriDay(hd)).toBe('14');
  });

  it('covers every month of a Hijri year', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 360; i++) {
      const d = new Date(Date.UTC(2025, 5, 26 + i, 12));
      seen.add(toHijriDate(d.toISOString().slice(0, 10)).month);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('is memoised and throws on bad input', () => {
    expect(toHijriDate('2026-01-01')).toBe(toHijriDate('2026-01-01'));
    expect(() => toHijriDate('2026-00-10')).toThrow(/תאריך לא תקין/);
  });
});

describe('hijriMonthSpan', () => {
  it('formats one month, two months of one year, and a year boundary', () => {
    expect(hijriMonthSpan('2026-02-18', '2026-03-19')).toBe('רמדאן 1447');
    expect(hijriMonthSpan('2026-02-18', '2026-03-20')).toBe('רמדאן–שוואל 1447');
    expect(hijriMonthSpan('2026-06-01', '2026-06-30')).toBe('ד׳ו אל-חיג׳ה 1447 – מוחרם 1448');
  });
});
