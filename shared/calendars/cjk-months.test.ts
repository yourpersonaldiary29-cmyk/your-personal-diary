/**
 * Known leftover: ICU has no Hebrew / Hijri month names in Chinese and Japanese (it answers "01",
 * "1月", "四月"), so those two languages use their own small tables.
 */
import { describe, expect, it } from 'vitest';
import { formatHebrewDate, hebrewMonthName, hebrewMonthSpan, toHebrewDate } from './hebrew';
import { formatHijriDate, hijriMonthName, hijriMonthSpan, toHijriDate } from './hijri';
import { monthViewContaining } from './month-view';

const DIGITS = /[0-9０-９]/;

describe('Hebrew and Hijri month names in zh / ja', () => {
  it('are names, never numbers', () => {
    for (const locale of ['zh', 'ja'] as const) {
      for (const m of ['tishrei', 'cheshvan', 'adar1', 'adar2', 'nisan', 'elul'] as const) {
        expect({ locale, m, name: hebrewMonthName(m, locale) }).not.toMatchObject({ name: expect.stringMatching(DIGITS) });
      }
      for (let m = 1; m <= 12; m++) expect(hijriMonthName(m, locale)).not.toMatch(DIGITS);
    }
    expect(hebrewMonthName('tishrei', 'zh')).toBe('提斯利月');
    expect(hebrewMonthName('tishrei', 'ja')).toBe('ティシュリー');
    expect(hijriMonthName(9, 'zh')).toBe('赖买丹月');
  });

  it('are used in dates, spans and calendar titles', () => {
    const hd = toHebrewDate('2026-09-15');
    expect(formatHebrewDate(hd, { locale: 'zh' })).toBe(`${hd.year}年提斯利月${hd.day}日`);
    expect(formatHebrewDate(hd, { locale: 'ja', withYear: false })).toBe(`ティシュリー${hd.day}日`);
    expect(hebrewMonthSpan('2026-09-15', '2026-09-20', 'zh')).toBe(`${hd.year}年提斯利月`);
    const hj = toHijriDate('2026-09-15');
    expect(formatHijriDate(hj, { locale: 'zh' })).toContain(hijriMonthName(hj.month, 'zh'));
    expect(hijriMonthSpan('2026-09-15', '2026-09-16', 'ja')).toContain(hijriMonthName(hj.month, 'ja'));
    expect(monthViewContaining('hebrew', '2026-09-15', 'zh').title).toBe(`${hd.year}年提斯利月`);
    expect(monthViewContaining('hijri', '2026-09-15', 'ja').title).toContain(hijriMonthName(hj.month, 'ja'));
  });

  it('leaves the other languages to ICU', () => {
    expect(hebrewMonthName('tishrei', 'en')).toMatch(/Tishri/);
    expect(hebrewMonthName('tishrei', 'th')).not.toMatch(DIGITS);
  });
});
