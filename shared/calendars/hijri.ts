/**
 * Hijri (Islamic) calendar through ICU's `islamic-umalqura` calendar (the
 * Umm al-Qura tables used in Saudi Arabia and by most Israeli Muslim
 * institutions), with `islamic-civil` (tabular) as a fallback on engines that
 * lack the Umm al-Qura data. Days begin at sunset; the civil day shown is the
 * day of the daytime.
 *
 * Formatting is locale-aware: 'he' (the default) uses the Hebrew
 * transliterations below; any other UI language gets ICU's month names for
 * that language with digits ('14 Rabiʻ II 1448', '14 rabia ath-thani 1448').
 */
import type { Locale } from '../i18n';
import type { HijriDate } from './types';
import { cjkDate, cjkHijriMonthName, cjkMonthSpan } from './cjk-months';
import { scriptHijriMonthName } from './script-months';
import { addDaysIso, parseIsoDate, utcNoon } from './civil';
import {
  DAY_MONTH,
  DAY_MONTH_YEAR,
  LEGACY_LOCALE,
  MONTH_ONLY,
  MONTH_YEAR,
  digits,
  formatIntlDate,
  formatIntlRange,
  type IntlCalendar,
} from './locale';

/** Hebrew transliterations of the 12 Hijri months (index 0 = Muharram). */
export const HIJRI_MONTH_NAMES: readonly string[] = [
  'מוחרם',
  'צפר',
  'רביע אל-אוול',
  'רביע א-ת׳אני',
  'ג׳ומאדא אל-אולא',
  'ג׳ומאדא א-ת׳אניה',
  'רג׳ב',
  'שעבאן',
  'רמדאן',
  'שוואל',
  'ד׳ו אל-קעדה',
  'ד׳ו אל-חיג׳ה',
];

export type HijriCalendarId = 'islamic-umalqura' | 'islamic-civil';

/** English (CLDR) month names -> 1..12, used only when the engine prints names instead of digits. */
const ICU_MONTH_ALIASES: Record<string, number> = {
  muharram: 1,
  safar: 2,
  'rabi i': 3,
  'rabi 1': 3,
  'rabi al awwal': 3,
  'rabi ii': 4,
  'rabi 2': 4,
  'rabi al thani': 4,
  'jumada i': 5,
  'jumada 1': 5,
  'jumada al ula': 5,
  'jumada ii': 6,
  'jumada 2': 6,
  'jumada al thani': 6,
  rajab: 7,
  shaban: 8,
  'sha ban': 8,
  ramadan: 9,
  shawwal: 10,
  'dhu l qi dah': 11,
  'dhul qidah': 11,
  'dhu al qidah': 11,
  'dhu l hijjah': 12,
  'dhul hijjah': 12,
  'dhu al hijjah': 12,
};

function normaliseIcuName(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RawHijri {
  year: number;
  month: number;
  day: number;
}

interface Engine {
  id: HijriCalendarId;
  formatter: Intl.DateTimeFormat;
}

let engine: Engine | null | undefined;

function tryCalendar(id: HijriCalendarId): Intl.DateTimeFormat | null {
  try {
    const f = new Intl.DateTimeFormat(`en-u-ca-${id}-nu-latn`, {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    return f.resolvedOptions().calendar === id ? f : null;
  } catch {
    return null;
  }
}

function rawWith(f: Intl.DateTimeFormat, iso: string): RawHijri {
  let year = NaN;
  let month = NaN;
  let day = NaN;
  for (const p of f.formatToParts(utcNoon(iso))) {
    if (p.type === 'year') year = Number(p.value);
    else if (p.type === 'day') day = Number(p.value);
    else if (p.type === 'month') {
      month = Number(p.value);
      if (!Number.isFinite(month)) month = ICU_MONTH_ALIASES[normaliseIcuName(p.value)] ?? NaN;
    }
  }
  if (!Number.isFinite(year) || !Number.isFinite(day) || !(month >= 1 && month <= 12)) {
    throw new Error(`לא ניתן להמיר את התאריך ${iso} ללוח ההג׳רי`);
  }
  return { year, month, day };
}

function getEngine(): Engine | null {
  if (engine !== undefined) return engine;
  engine = null;
  const umalqura = tryCalendar('islamic-umalqura');
  if (umalqura) {
    try {
      const probe = rawWith(umalqura, '2026-02-18'); // 1 Ramadan 1447 (Umm al-Qura)
      if (probe.year === 1447 && probe.month === 9 && probe.day === 1) engine = { id: 'islamic-umalqura', formatter: umalqura };
    } catch {
      /* fall through to the civil calendar */
    }
  }
  if (!engine) {
    const civil = tryCalendar('islamic-civil');
    if (civil) {
      try {
        const probe = rawWith(civil, '2026-02-18');
        if (probe.year === 1447 && probe.month === 9) engine = { id: 'islamic-civil', formatter: civil };
      } catch {
        /* unsupported */
      }
    }
  }
  return engine;
}

/** Which ICU calendar is in use: 'islamic-umalqura', 'islamic-civil' (fallback) or null when neither works. */
export function hijriCalendarName(): HijriCalendarId | null {
  return getEngine()?.id ?? null;
}

/** The ICU calendar the locale-aware formatters use (Umm al-Qura unless only the civil calendar works). */
export function hijriIntlCalendar(): IntlCalendar {
  return hijriCalendarName() ?? 'islamic-umalqura';
}

/** True when the engine's Intl has a working Islamic calendar (Umm al-Qura or the civil fallback). */
export function isHijriCalendarSupported(): boolean {
  return getEngine() !== null;
}

const MAX_CACHE = 20_000;
const dateCache = new Map<string, HijriDate>();
/** Civil day of every HijriDate handed out by `toHijriDate` (lets the formatters use ICU for other languages). */
const isoOf = new WeakMap<HijriDate, string>();

/**
 * Civil day `YYYY-MM-DD` -> Hijri date. Throws on bad input or when no Islamic calendar is available.
 *
 * The returned object is memoised and frozen (shared by every caller).
 */
export function toHijriDate(iso: string): HijriDate {
  const cached = dateCache.get(iso);
  if (cached) return cached;
  parseIsoDate(iso); // validates
  const e = getEngine();
  if (!e) throw new Error('הלוח ההג׳רי אינו זמין במכשיר זה');
  const raw = rawWith(e.formatter, iso);
  const hd: HijriDate = Object.freeze({
    year: raw.year,
    month: raw.month,
    monthName: HIJRI_MONTH_NAMES[raw.month - 1],
    day: raw.day,
  });
  if (dateCache.size >= MAX_CACHE) dateCache.clear();
  dateCache.set(iso, hd);
  isoOf.set(hd, iso);
  return hd;
}

// ---------------------------------------------------------------------------
// Month names in other languages (ICU)
// ---------------------------------------------------------------------------

/** 1 Muharram 1447; stepping 29 days at a time from here visits every month of the year. */
const SAMPLE_ANCHOR = '2025-06-26';

let sampleDates: Map<number, string> | null = null;

function sampleDateOf(month: number): string | null {
  if (!sampleDates) {
    const map = new Map<number, string>();
    let iso = SAMPLE_ANCHOR;
    for (let step = 0; step <= 13; step++) {
      try {
        const hd = toHijriDate(iso);
        if (!map.has(hd.month)) map.set(hd.month, iso);
      } catch {
        break;
      }
      iso = addDaysIso(iso, 29);
    }
    sampleDates = map;
  }
  return sampleDates.get(month) ?? null;
}

const monthNameCache = new Map<string, string>();

/** Month name (1 = Muharram .. 12 = Dhu al-Hijjah) in the locale: "רמדאן" (he) / "Ramadan" (en) / "ramadan" (fr). Overloaded so `months.map(hijriMonthName)` keeps type-checking. */
export function hijriMonthName(month: number): string;
export function hijriMonthName(month: number, locale: Locale): string;
export function hijriMonthName(month: number, locale: Locale = LEGACY_LOCALE): string {
  if (!(month >= 1 && month <= 12)) throw new RangeError(`חודש מחוץ לטווח 1..12: ${String(month)}`);
  if (locale === 'he') return HIJRI_MONTH_NAMES[month - 1];
  // ICU has only numbers for these months in Chinese / Japanese.
  const cjk = cjkHijriMonthName(locale, month);
  if (cjk) return cjk;
  // ICU has only the Latin transliteration in Greek.
  const own = scriptHijriMonthName(locale, month);
  if (own) return own;
  const key = `${locale}|${month}`;
  const cached = monthNameCache.get(key);
  if (cached !== undefined) return cached;
  const iso = sampleDateOf(month);
  let name = '';
  if (iso) {
    try {
      name = formatIntlDate(locale, hijriIntlCalendar(), utcNoon(iso), MONTH_ONLY);
    } catch {
      name = '';
    }
  }
  if (!name) name = HIJRI_MONTH_NAMES[month - 1];
  monthNameCache.set(key, name);
  return name;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export interface HijriFormatOptions {
  /** Append the year (default true). */
  withYear?: boolean;
  /** UI language (default 'he'). */
  locale?: Locale;
}

/** "14 ברביע א-ת׳אני 1448" / "14 ברביע א-ת׳אני" (he); "14 Rabiʻ II 1448" / "14 Rabiʻ II" (en). */
export function formatHijriDate(hd: HijriDate, opts?: HijriFormatOptions): string {
  const withYear = opts?.withYear ?? true;
  const locale = opts?.locale ?? LEGACY_LOCALE;
  if (locale === 'he') {
    const base = `${hd.day} ב${hd.monthName}`;
    return withYear ? `${base} ${hd.year}` : base;
  }
  const cjk = cjkHijriMonthName(locale, hd.month);
  if (cjk) return cjkDate(withYear ? hd.year : null, cjk, hd.day);
  const iso = isoOf.get(hd);
  if (iso) {
    try {
      return formatIntlDate(locale, hijriIntlCalendar(), utcNoon(iso), withYear ? DAY_MONTH_YEAR : DAY_MONTH, scriptHijriMonthName(locale, hd.month));
    } catch {
      /* assemble below */
    }
  }
  const base = `${digits(locale, hd.day)} ${hijriMonthName(hd.month, locale)}`;
  return withYear ? `${base} ${digits(locale, hd.year)}` : base;
}

/** "14" - Hijri days are shown with digits in the calendar cell (locale digits elsewhere). */
export function formatHijriDay(hd: HijriDate): string;
export function formatHijriDay(hd: HijriDate, locale: Locale): string;
export function formatHijriDay(hd: HijriDate, locale: Locale = LEGACY_LOCALE): string {
  return locale === 'he' ? String(hd.day) : digits(locale, hd.day);
}

/**
 * "רמדאן 1447", "רמדאן–שוואל 1447" or "ד׳ו אל-חיג׳ה 1447 – מוחרם 1448" (he);
 * "Ramadan 1447", "Ramadan – Shawwal 1447" or "Dhuʻl-Hijjah 1447 – Muharram 1448" (en).
 */
export function hijriMonthSpan(from: string, to: string, locale: Locale = LEGACY_LOCALE): string {
  const a = toHijriDate(from);
  const b = toHijriDate(to);
  const cjkA = cjkHijriMonthName(locale, a.month);
  const cjkB = cjkHijriMonthName(locale, b.month);
  if (cjkA && cjkB) return cjkMonthSpan({ year: a.year, name: cjkA }, { year: b.year, name: cjkB });
  if (locale !== 'he') {
    const calendar = hijriIntlCalendar();
    const ownA = scriptHijriMonthName(locale, a.month);
    const ownB = scriptHijriMonthName(locale, b.month);
    if (a.year === b.year && a.month === b.month) return formatIntlDate(locale, calendar, utcNoon(from), MONTH_YEAR, ownA);
    return formatIntlRange(locale, calendar, utcNoon(from), utcNoon(to), MONTH_YEAR, ownA && ownB ? { start: ownA, end: ownB } : null);
  }
  if (a.year === b.year) {
    if (a.month === b.month) return `${a.monthName} ${a.year}`;
    return `${a.monthName}–${b.monthName} ${a.year}`;
  }
  return `${a.monthName} ${a.year} – ${b.monthName} ${b.year}`;
}
