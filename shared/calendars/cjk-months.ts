/**
 * Month names of the Hebrew and the Islamic (Hijri) calendars in Chinese and Japanese.
 *
 * ICU has no names for these months in zh / ja: `Intl.DateTimeFormat('zh-u-ca-hebrew', { month:
 * 'long' })` answers "01" (and "希伯来历5787年01月4日" for a date), Japanese "1月", and the Hijri
 * months come back as "四月" / "4月" - numbers, where every other language shows "Tishri" or
 * "Ramadan". These small tables give the names (common transliterations) and the dates are
 * assembled the way zh / ja write them: "5787年提斯利月4日".
 */
import type { Locale } from '../i18n/locales';
import type { HebrewMonth } from './types';

type CjkLocale = 'zh' | 'ja';

const HEBREW: Record<CjkLocale, Record<HebrewMonth, string>> = {
  zh: {
    tishrei: '提斯利月',
    cheshvan: '赫舍汪月',
    kislev: '基斯流月',
    tevet: '提别月',
    shevat: '细罢特月',
    adar: '亚达月',
    adar1: '亚达一月',
    adar2: '亚达二月',
    nisan: '尼散月',
    iyar: '以珥月',
    sivan: '西弯月',
    tammuz: '搭模斯月',
    av: '埃波月',
    elul: '以禄月',
  },
  ja: {
    tishrei: 'ティシュリー',
    cheshvan: 'ヘシュヴァン',
    kislev: 'キスレーヴ',
    tevet: 'テヴェット',
    shevat: 'シュヴァット',
    adar: 'アダル',
    adar1: 'アダル・リション',
    adar2: 'アダル・シェニ',
    nisan: 'ニサン',
    iyar: 'イヤール',
    sivan: 'シヴァン',
    tammuz: 'タンムーズ',
    av: 'アヴ',
    elul: 'エルール',
  },
};

/** Muharram .. Dhu al-Hijjah. */
const HIJRI: Record<CjkLocale, readonly string[]> = {
  zh: ['穆哈兰姆月', '色法尔月', '赖比尔·敖外鲁月', '赖比尔·阿色尼月', '主马达·敖外鲁月', '主马达·阿色尼月', '赖哲卜月', '舍尔邦月', '赖买丹月', '闪瓦鲁月', '都尔喀尔德月', '都尔黑哲月'],
  ja: [
    'ムハッラム',
    'サファル',
    'ラビー・アル＝アウワル',
    'ラビー・アッ＝サーニー',
    'ジュマーダー・アル＝ウーラー',
    'ジュマーダー・アッ＝サーニー',
    'ラジャブ',
    'シャアバーン',
    'ラマダーン',
    'シャウワール',
    'ズー・アル＝カアダ',
    'ズー・アル＝ヒッジャ',
  ],
};

function isCjk(locale: Locale): locale is CjkLocale {
  return locale === 'zh' || locale === 'ja';
}

/** Hebrew month name in zh / ja, or null for every other language (ICU has good names there). */
export function cjkHebrewMonthName(locale: Locale, month: HebrewMonth): string | null {
  return isCjk(locale) ? HEBREW[locale][month] : null;
}

/** Hijri month name (1-12) in zh / ja, or null for every other language. */
export function cjkHijriMonthName(locale: Locale, month: number): string | null {
  return isCjk(locale) ? (HIJRI[locale][month - 1] ?? null) : null;
}

/** "5787年提斯利月4日" / "提斯利月4日" (no year) / "5787年提斯利月" (no day). */
export function cjkDate(year: number | null, monthName: string, day: number | null): string {
  return `${year === null ? '' : `${year}年`}${monthName}${day === null ? '' : `${day}日`}`;
}

/** "5787年提斯利月", "5787年提斯利月–赫舍汪月" or "5786年以禄月 – 5787年提斯利月". */
export function cjkMonthSpan(a: { year: number; name: string }, b: { year: number; name: string }): string {
  if (a.year === b.year) return a.name === b.name ? cjkDate(a.year, a.name, null) : `${a.year}年${a.name}–${b.name}`;
  return `${cjkDate(a.year, a.name, null)} – ${cjkDate(b.year, b.name, null)}`;
}
