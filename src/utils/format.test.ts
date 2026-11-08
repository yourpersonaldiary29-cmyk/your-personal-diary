import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetLocaleForTests, setCurrentLocale } from '@/i18n/runtime';
import * as format from './format';
import {
  countLabel,
  formatBytes,
  formatDays,
  formatDecimal,
  formatHours,
  formatMinutes,
  formatNumber,
  formatPercent,
  formatSigned,
  joinHebrew,
  joinList,
  NOT_REPORTED,
  notReported,
  ratingText,
  withPrefix,
} from './format';

beforeEach(() => {
  window.localStorage.clear();
  __resetLocaleForTests();
});

afterEach(() => {
  __resetLocaleForTests();
});

describe('withPrefix (Hebrew)', () => {
  beforeEach(() => setCurrentLocale('he'));

  it('joins a Hebrew prefix directly to a Hebrew word', () => {
    expect(withPrefix('ב', 'שנה')).toBe('בשנה');
    expect(withPrefix('ל', 'חודש הבא')).toBe('לחודש הבא');
  });

  it('inserts a hyphen before digits, as Hebrew spelling requires', () => {
    expect(withPrefix('ב', '30 ימים')).toBe('ב-30 ימים');
    expect(withPrefix('ב', '7 ימים')).toBe('ב-7 ימים');
    expect(withPrefix('מ', '2026')).toBe('מ-2026');
  });

  it('inserts a hyphen before Latin text and ignores leading spaces', () => {
    expect(withPrefix('ב', 'PDF')).toBe('ב-PDF');
    expect(withPrefix('ב', '  30 ימים')).toBe('ב-30 ימים');
  });

  it('works with the count phrases used in page subtitles', () => {
    expect(withPrefix('ב', countLabel(27, 'יום', 'ימים', false))).toBe('ב-27 ימים');
    expect(withPrefix('ב', countLabel(1, 'יום', 'ימים', false))).toBe('ביום אחד');
    expect(withPrefix('ב', countLabel(2, 'יום', 'ימים', false))).toBe('בשני ימים');
  });
});

describe('phrases in Hebrew (exact legacy wording)', () => {
  beforeEach(() => setCurrentLocale('he'));

  it('counts with the feminine / masculine forms of one and two', () => {
    expect(countLabel(1, 'רשומה', 'רשומות')).toBe('רשומה אחת');
    expect(countLabel(2, 'רשומה', 'רשומות')).toBe('שתי רשומות');
    expect(countLabel(3, 'רשומה', 'רשומות')).toBe('3 רשומות');
    expect(countLabel(0, 'רשומה', 'רשומות')).toBe('0 רשומות');
    expect(countLabel(1, 'הרגל', 'הרגלים', false)).toBe('הרגל אחד');
    expect(countLabel(2, 'הרגל', 'הרגלים', false)).toBe('שני הרגלים');
    expect(countLabel(120, 'הרגל', 'הרגלים', false)).toBe('120 הרגלים');
  });

  it('formats hours, minutes and days', () => {
    expect(formatHours(1)).toBe('שעה אחת');
    expect(formatHours(2)).toBe('שעתיים');
    expect(formatHours(7.5)).toBe('7.5 שעות');
    expect(formatHours(null)).toBe('לא דווח');
    expect(formatMinutes(1)).toBe('דקה אחת');
    expect(formatMinutes(30)).toBe('30 דקות');
    expect(formatMinutes(60)).toBe('שעה');
    expect(formatMinutes(75)).toBe('שעה ו-15 דקות');
    expect(formatMinutes(120)).toBe('שעתיים');
    expect(formatMinutes(135)).toBe('שעתיים ו-15 דקות');
    expect(formatMinutes(185)).toBe('3 שעות ו-5 דקות');
    expect(formatMinutes(undefined)).toBe('לא דווח');
    expect(formatDays(1)).toBe('יום אחד');
    expect(formatDays(2)).toBe('יומיים');
    expect(formatDays(5)).toBe('5 ימים');
  });

  it('formats ratings, bytes, lists and the not-reported text', () => {
    expect(ratingText(7)).toBe('7 מתוך 10');
    expect(ratingText(7.5, 10)).toBe('7.5 מתוך 10');
    expect(ratingText(null)).toBe('לא דווח');
    expect(formatBytes(512)).toBe('512 בייט');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
    expect(joinList(['א', 'ב', 'ג'])).toBe('א, ב וג');
    expect(joinList(['שינה', '30 דקות'])).toBe('שינה ו-30 דקות');
    expect(joinHebrew(['א'])).toBe('א');
    expect(joinHebrew([])).toBe('');
    expect(notReported()).toBe('לא דווח');
    expect(format.NOT_REPORTED).toBe('לא דווח');
    expect(formatDecimal(null)).toBe('לא דווח');
  });
});

describe('phrases in English (the default)', () => {
  it('uses English plural rules and wording', () => {
    expect(NOT_REPORTED).toBe('Not reported');
    expect(countLabel(1, 'entry', 'entries')).toBe('1 entry');
    expect(countLabel(2, 'entry', 'entries')).toBe('2 entries');
    expect(countLabel(0, 'day', 'days', false)).toBe('0 days');
    expect(formatHours(1)).toBe('1 hour');
    expect(formatHours(7.5)).toBe('7.5 hours');
    expect(formatMinutes(1)).toBe('1 minute');
    expect(formatMinutes(45)).toBe('45 minutes');
    expect(formatMinutes(60)).toBe('1 hour');
    expect(formatMinutes(75)).toBe('1 hour and 15 minutes');
    expect(formatMinutes(121)).toBe('2 hours and 1 minute');
    expect(formatDays(1)).toBe('1 day');
    expect(formatDays(3)).toBe('3 days');
    expect(ratingText(7)).toBe('7 of 10');
    expect(formatBytes(1)).toBe('1 byte');
    expect(formatBytes(512)).toBe('512 bytes');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
    expect(formatDecimal(1234.56)).toBe('1,234.6');
    expect(formatNumber(7)).toBe('7');
    expect(formatNumber(7.25)).toBe('7.3');
    expect(formatPercent(0.756)).toBe('76%');
    expect(formatSigned(-1.25)).toBe('\u200e-1.3');
    expect(formatSigned(0.8)).toBe('\u200e+0.8');
  });
});

describe('phrases in German (numbers through Intl, texts from the German catalogue)', () => {
  beforeEach(() => setCurrentLocale('de'));

  it('formats numbers with German separators', () => {
    expect(formatDecimal(1234.56)).toBe('1.234,6');
    expect(formatNumber(7.5)).toBe('7,5');
    expect(formatBytes(2048)).toBe('2,0 KB');
    expect(formatHours(7.5)).toBe('7,5 Stunden');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b und c');
    expect(ratingText(7.5)).toBe('7,5 von 10');
  });
});

describe('direction-safe signed numbers', () => {
  const LRM = '\u200e';
  /** Every character that changes the direction of text: marks, embeddings, overrides, isolates. */
  const BIDI_CONTROLS = /[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g;

  /**
   * The contract of a signed number: one left-to-right mark, then the sign, then the digits - and
   * no other direction character anywhere (ICU's own marks are replaced, not doubled).
   */
  function expectSigned(text: string, sign: '+' | '-', digits: string) {
    expect(text).toBe(`${LRM}${sign}${digits}`);
    expect(text.match(BIDI_CONTROLS)).toEqual([LRM]);
  }

  describe.each(['he', 'ar'] as const)('in a right-to-left language (%s)', (locale) => {
    beforeEach(() => setCurrentLocale(locale));

    it('puts the sign of a difference right after a left-to-right mark', () => {
      expectSigned(formatSigned(-1.25), '-', '1.3');
      expectSigned(formatSigned(0.8), '+', '0.8');
      expectSigned(formatSigned(-15, 0), '-', '15');
      expectSigned(formatSigned(0.25, 2), '+', '0.25');
      expectSigned(formatSigned(1234.5), '+', '1,234.5');
    });

    it('shows no sign on zero, nor on a difference that rounds to zero', () => {
      for (const value of [0, -0, 0.04, -0.04]) {
        expect(formatSigned(value)).toBe('0.0');
      }
      expect(formatSigned(-0.4, 0)).toBe('0');
      // Just enough to show at this precision: signed again.
      expectSigned(formatSigned(-0.06), '-', '0.1');
    });

    it('marks every negative number, whichever helper formats it', () => {
      expectSigned(formatDecimal(-0.7), '-', '0.7');
      expectSigned(formatDecimal(-0.03, 2), '-', '0.03');
      expectSigned(formatNumber(-3), '-', '3');
      expectSigned(formatNumber(-2.5), '-', '2.5');
      expectSigned(formatPercent(-0.5), '-', '50%');
      expectSigned(formatPercent(-0.125, 1), '-', '12.5%');
    });

    it('leaves numbers without a sign untouched', () => {
      for (const text of [formatDecimal(7.25), formatNumber(7), formatNumber(7.5), formatPercent(0.756), formatDecimal(1234.56)]) {
        expect(text).not.toMatch(BIDI_CONTROLS);
      }
      expect(formatDecimal(7.25)).toBe('7.3');
      expect(formatPercent(0.756)).toBe('76%');
    });

    it('keeps the missing value a plain text', () => {
      expect(formatSigned(null)).toBe(notReported());
      expect(formatSigned(Number.NaN)).toBe(notReported());
    });
  });

  it('marks signed numbers in left-to-right languages too (Hebrew or Arabic text may surround them)', () => {
    expectSigned(formatDecimal(-1.25), '-', '1.3');
    expectSigned(formatNumber(-3), '-', '3');
    expectSigned(formatPercent(-0.5), '-', '50%');
    expect(formatSigned(0)).toBe('0.0');
    expect(formatSigned(-0.04)).toBe('0.0');
    setCurrentLocale('de');
    expectSigned(formatSigned(-1.25), '-', '1,3');
    expectSigned(formatSigned(0.8), '+', '0,8');
    expectSigned(formatDecimal(-1234.56), '-', '1.234,6');
  });

  it('gives the summary of the statistics page its "(-0.7)" in logical order', () => {
    setCurrentLocale('he');
    // Logical order: mark, sign, digits - the renderer then draws "-0.7" left to right inside the
    // Hebrew sentence (a bare "(-0.7)" was drawn "(0.7-)").
    const sentence = `לעומת 6.8 בתקופה הקודמת (${formatSigned(-0.7)}).`;
    expect(sentence).toBe('לעומת 6.8 בתקופה הקודמת (\u200e-0.7).');
    expect(sentence.indexOf(LRM)).toBe(sentence.indexOf('-') - 1);
  });
});

describe('live not-reported binding', () => {
  it('follows the language switch', () => {
    expect(format.NOT_REPORTED).toBe('Not reported');
    setCurrentLocale('he');
    expect(format.NOT_REPORTED).toBe('לא דווח');
    expect(NOT_REPORTED).toBe('לא דווח');
    setCurrentLocale('en');
    expect(NOT_REPORTED).toBe('Not reported');
  });
});
