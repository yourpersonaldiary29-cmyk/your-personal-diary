/**
 * Hebrew calendar: civil day -> Hebrew date through the ICU `hebrew` calendar
 * (`Intl.DateTimeFormat('en-u-ca-hebrew')`), Hebrew numerals and formatting.
 *
 * Every conversion is memoised per ISO string because the calendar grid asks
 * for each of its cells on every render.
 *
 * Formatting is locale-aware: 'he' (the default) renders gematria days and the
 * Hebrew month names below; any other UI language gets ICU's month names for
 * that language with digits ('14 Tishri 5787', '14 tichri 5787').
 */
import type { Locale } from '../i18n';
import type { HebrewDate, HebrewMonth } from './types';
import { addDaysIso, parseIsoDate, utcNoon } from './civil';
import { cjkDate, cjkHebrewMonthName, cjkMonthSpan } from './cjk-months';
import { scriptHebrewMonthName } from './script-months';
import { DAY_MONTH, DAY_MONTH_YEAR, LEGACY_LOCALE, MONTH_ONLY, MONTH_YEAR, digits, formatIntlDate, formatIntlRange } from './locale';

export const HEBREW_MONTH_NAMES: Record<HebrewMonth, string> = {
  tishrei: 'תשרי',
  cheshvan: 'חשוון',
  kislev: 'כסלו',
  tevet: 'טבת',
  shevat: 'שבט',
  adar: 'אדר',
  adar1: 'אדר א׳',
  adar2: 'אדר ב׳',
  nisan: 'ניסן',
  iyar: 'אייר',
  sivan: 'סיוון',
  tammuz: 'תמוז',
  av: 'אב',
  elul: 'אלול',
};

/** Months of a Hebrew year in order, Tishrei first. */
export function hebrewMonthsOfYear(isLeapYear: boolean): HebrewMonth[] {
  return isLeapYear
    ? ['tishrei', 'cheshvan', 'kislev', 'tevet', 'shevat', 'adar1', 'adar2', 'nisan', 'iyar', 'sivan', 'tammuz', 'av', 'elul']
    : ['tishrei', 'cheshvan', 'kislev', 'tevet', 'shevat', 'adar', 'nisan', 'iyar', 'sivan', 'tammuz', 'av', 'elul'];
}

/** The month that follows `month` (Elul -> Tishrei of the next year). */
export function nextHebrewMonth(month: HebrewMonth, isLeapYear: boolean): HebrewMonth {
  const months = hebrewMonthsOfYear(isLeapYear);
  const i = months.indexOf(month);
  if (i < 0) {
    // `adar` asked in a leap year or `adar1`/`adar2` in a plain year - be forgiving.
    if (month === 'adar' || month === 'adar2') return 'nisan';
    return 'adar2';
  }
  return months[(i + 1) % months.length];
}

/** Hebrew leap years (7 of every 19) have Adar I + Adar II. */
export function isHebrewLeapYear(year: number): boolean {
  return (7 * year + 1) % 19 < 7;
}

// ---------------------------------------------------------------------------
// ICU access
// ---------------------------------------------------------------------------

/** English (CLDR) month names -> keys. Spelling varies slightly between ICU versions. */
const ICU_MONTH_ALIASES: Record<string, HebrewMonth> = {
  tishri: 'tishrei',
  tishrei: 'tishrei',
  tishrey: 'tishrei',
  heshvan: 'cheshvan',
  cheshvan: 'cheshvan',
  marheshvan: 'cheshvan',
  marcheshvan: 'cheshvan',
  kislev: 'kislev',
  tevet: 'tevet',
  teveth: 'tevet',
  tebeth: 'tevet',
  shevat: 'shevat',
  shvat: 'shevat',
  'sh vat': 'shevat', // "Sh'vat" after normalisation
  shebat: 'shevat',
  'adar i': 'adar1',
  'adar 1': 'adar1',
  'adar a': 'adar1',
  adar: 'adar',
  'adar ii': 'adar2',
  'adar 2': 'adar2',
  'adar b': 'adar2',
  nisan: 'nisan',
  nissan: 'nisan',
  iyar: 'iyar',
  iyyar: 'iyar',
  sivan: 'sivan',
  tamuz: 'tammuz',
  tammuz: 'tammuz',
  av: 'av',
  ab: 'av',
  elul: 'elul',
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

let formatter: Intl.DateTimeFormat | null | undefined;

function getFormatter(): Intl.DateTimeFormat | null {
  if (formatter !== undefined) return formatter;
  try {
    const f = new Intl.DateTimeFormat('en-u-ca-hebrew-nu-latn', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    formatter = f.resolvedOptions().calendar === 'hebrew' ? f : null;
  } catch {
    formatter = null;
  }
  return formatter;
}

interface RawHebrew {
  year: number;
  month: HebrewMonth;
  day: number;
}

const NOT_AVAILABLE = 'לוח השנה העברי אינו זמין במכשיר זה';

/** One ICU call, no memoisation (used by the memoised functions and the probes). */
function rawHebrew(iso: string): RawHebrew {
  const f = getFormatter();
  if (!f) throw new Error(NOT_AVAILABLE);
  let year = NaN;
  let day = NaN;
  let monthText = '';
  for (const p of f.formatToParts(utcNoon(iso))) {
    if (p.type === 'year') year = Number(p.value);
    else if (p.type === 'day') day = Number(p.value);
    else if (p.type === 'month') monthText = p.value;
  }
  const month = ICU_MONTH_ALIASES[normaliseIcuName(monthText)];
  if (!month || !Number.isFinite(year) || !Number.isFinite(day)) {
    throw new Error(`לא ניתן להמיר את התאריך ${iso} ללוח העברי`);
  }
  return { year, month, day };
}

let supported: boolean | undefined;

/** True when the engine's Intl has a working `hebrew` calendar. */
export function isHebrewCalendarSupported(): boolean {
  if (supported !== undefined) return supported;
  try {
    const probe = rawHebrew('2026-09-12'); // 1 Tishrei 5787
    supported = probe.year === 5787 && probe.month === 'tishrei' && probe.day === 1;
  } catch {
    supported = false;
  }
  return supported;
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

const MAX_CACHE = 20_000;
const dateCache = new Map<string, HebrewDate>();
const monthLengthCache = new Map<string, number>();
/** Civil day of every HebrewDate handed out by `toHebrewDate` (lets the formatters use ICU for other languages). */
const isoOf = new WeakMap<HebrewDate, string>();

function monthLengthOf(iso: string, raw: RawHebrew): number {
  const key = `${raw.year}:${raw.month}`;
  const cached = monthLengthCache.get(key);
  if (cached !== undefined) return cached;
  let length = 30;
  if (raw.day !== 30) {
    // Does day 30 exist? Look at the civil day that would be the 30th.
    const probe = rawHebrew(addDaysIso(iso, 30 - raw.day));
    length = probe.year === raw.year && probe.month === raw.month ? 30 : 29;
  }
  monthLengthCache.set(key, length);
  return length;
}

/**
 * Civil day `YYYY-MM-DD` -> Hebrew date. Throws on bad input or when the calendar is unavailable.
 *
 * The returned object is memoised and frozen: it is shared by every caller
 * (copy it with `{ ...hd }` before changing anything).
 */
export function toHebrewDate(iso: string): HebrewDate {
  const cached = dateCache.get(iso);
  if (cached) return cached;
  parseIsoDate(iso); // validates, throws Hebrew message
  const raw = rawHebrew(iso);
  // The leap rule is exact arithmetic, so it decides which Adar we are in even
  // on an ICU build that prints "Adar" instead of "Adar II" in leap years.
  const isLeapYear = isHebrewLeapYear(raw.year);
  let month = raw.month;
  if (isLeapYear && month === 'adar') month = 'adar2';
  else if (!isLeapYear && (month === 'adar1' || month === 'adar2')) month = 'adar';
  const hd: HebrewDate = Object.freeze({
    year: raw.year,
    month,
    monthName: HEBREW_MONTH_NAMES[month],
    day: raw.day,
    isLeapYear,
    monthLength: monthLengthOf(iso, raw),
  });
  if (dateCache.size >= MAX_CACHE) dateCache.clear();
  dateCache.set(iso, hd);
  isoOf.set(hd, iso);
  return hd;
}

// ---------------------------------------------------------------------------
// Numerals
// ---------------------------------------------------------------------------

const GERESH = '׳';
const GERSHAYIM = '״';
const UNITS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];

/** Letters only (no geresh/gershayim) for 1..999. */
export function hebrewNumeralLetters(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 999) {
    throw new RangeError(`מספר מחוץ לטווח 1..999: ${String(n)}`);
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let out = HUNDREDS[hundreds];
  if (rest === 15) out += 'טו';
  else if (rest === 16) out += 'טז';
  else out += TENS[Math.floor(rest / 10)] + UNITS[rest % 10];
  return out;
}

/** 1 -> "א׳", 14 -> "י״ד", 15 -> "ט״ו", 16 -> "ט״ז", 30 -> "ל׳", 787 -> "תשפ״ז". */
export function hebrewNumeral(n: number): string {
  const letters = hebrewNumeralLetters(n);
  if (letters.length === 1) return letters + GERESH;
  return letters.slice(0, -1) + GERSHAYIM + letters.slice(-1);
}

/** 5787 -> "תשפ״ז" (thousands omitted, as is customary). */
export function hebrewYearNumeral(year: number): string {
  if (!Number.isInteger(year) || year < 1) throw new RangeError(`שנה לא תקינה: ${String(year)}`);
  const rest = year % 1000;
  if (rest === 0) return `${hebrewNumeral(year / 1000)} אלפים`;
  return hebrewNumeral(rest);
}

/** The year as shown in the locale: "תשפ״ז" for Hebrew, digits ("5787") elsewhere. */
export function hebrewYearLabel(year: number): string;
export function hebrewYearLabel(year: number, locale: Locale): string;
export function hebrewYearLabel(year: number, locale: Locale = LEGACY_LOCALE): string {
  return locale === 'he' ? hebrewYearNumeral(year) : digits(locale, year);
}

// ---------------------------------------------------------------------------
// Month names in other languages (ICU)
// ---------------------------------------------------------------------------

/**
 * A civil day inside each Hebrew month, found once by stepping through a leap
 * year (5787, which has Adar I and Adar II) and a plain year (5786, Adar).
 * Stepping 29 days at a time never skips a month (the shortest month has 29 days).
 */
const SAMPLE_ANCHORS: readonly { iso: string; months: number }[] = [
  { iso: '2026-09-12', months: 13 }, // 1 Tishrei 5787 (leap year)
  { iso: '2026-02-18', months: 1 }, // 1 Adar 5786 (plain year)
];

let sampleDates: Map<HebrewMonth, string> | null = null;

function sampleDateOf(month: HebrewMonth): string | null {
  if (!sampleDates) {
    const map = new Map<HebrewMonth, string>();
    for (const anchor of SAMPLE_ANCHORS) {
      let iso = anchor.iso;
      for (let step = 0; step <= anchor.months; step++) {
        try {
          const hd = toHebrewDate(iso);
          if (!map.has(hd.month)) map.set(hd.month, iso);
        } catch {
          break;
        }
        iso = addDaysIso(iso, 29);
      }
    }
    sampleDates = map;
  }
  return sampleDates.get(month) ?? null;
}

const monthNameCache = new Map<string, string>();

/** Month name in the locale: "תשרי" (he) / "Tishri" (en) / "tichri" (fr) / "Adar II" (en, leap year). Overloaded so `months.map(hebrewMonthName)` keeps type-checking. */
export function hebrewMonthName(month: HebrewMonth): string;
export function hebrewMonthName(month: HebrewMonth, locale: Locale): string;
export function hebrewMonthName(month: HebrewMonth, locale: Locale = LEGACY_LOCALE): string {
  if (locale === 'he') return HEBREW_MONTH_NAMES[month];
  // ICU has only numbers for these months in Chinese / Japanese.
  const cjk = cjkHebrewMonthName(locale, month);
  if (cjk) return cjk;
  // ICU has only the Latin transliteration in Hindi.
  const own = scriptHebrewMonthName(locale, month);
  if (own) return own;
  const key = `${locale}|${month}`;
  const cached = monthNameCache.get(key);
  if (cached !== undefined) return cached;
  const iso = sampleDateOf(month);
  let name = '';
  if (iso) {
    try {
      name = formatIntlDate(locale, 'hebrew', utcNoon(iso), MONTH_ONLY);
    } catch {
      name = '';
    }
  }
  if (!name) name = HEBREW_MONTH_NAMES[month];
  monthNameCache.set(key, name);
  return name;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export interface HebrewFormatOptions {
  /** Append the year (default true). */
  withYear?: boolean;
  /** UI language (default 'he'). */
  locale?: Locale;
}

/** "י״ד בתשרי תשפ״ז" / "י״ד בתשרי" (he); "14 Tishri 5787" / "14 Tishri" (en); "14 tichri 5787" (fr). */
export function formatHebrewDate(hd: HebrewDate, opts?: HebrewFormatOptions): string {
  const withYear = opts?.withYear ?? true;
  const locale = opts?.locale ?? LEGACY_LOCALE;
  if (locale === 'he') {
    const base = `${hebrewNumeral(hd.day)} ב${hd.monthName}`;
    return withYear ? `${base} ${hebrewYearNumeral(hd.year)}` : base;
  }
  const cjk = cjkHebrewMonthName(locale, hd.month);
  if (cjk) return cjkDate(withYear ? hd.year : null, cjk, hd.day);
  const iso = isoOf.get(hd);
  if (iso) {
    try {
      return formatIntlDate(locale, 'hebrew', utcNoon(iso), withYear ? DAY_MONTH_YEAR : DAY_MONTH, scriptHebrewMonthName(locale, hd.month));
    } catch {
      /* assemble below */
    }
  }
  const base = `${digits(locale, hd.day)} ${hebrewMonthName(hd.month, locale)}`;
  return withYear ? `${base} ${digits(locale, hd.year)}` : base;
}

/** "י״ד" (he) / "14" (other languages) - the Hebrew day for a calendar cell. */
export function formatHebrewDay(hd: HebrewDate): string;
export function formatHebrewDay(hd: HebrewDate, locale: Locale): string;
export function formatHebrewDay(hd: HebrewDate, locale: Locale = LEGACY_LOCALE): string {
  return locale === 'he' ? hebrewNumeral(hd.day) : digits(locale, hd.day);
}

/**
 * "תשרי תשפ״ז", "תשרי–חשוון תשפ״ז" or "אלול תשפ״ו – תשרי תשפ״ז" (he);
 * "Tishri 5787", "Tishri – Heshvan 5787" or "Elul 5786 – Tishri 5787" (en).
 */
export function hebrewMonthSpan(from: string, to: string, locale: Locale = LEGACY_LOCALE): string {
  const a = toHebrewDate(from);
  const b = toHebrewDate(to);
  const cjkA = cjkHebrewMonthName(locale, a.month);
  const cjkB = cjkHebrewMonthName(locale, b.month);
  if (cjkA && cjkB) return cjkMonthSpan({ year: a.year, name: cjkA }, { year: b.year, name: cjkB });
  if (locale !== 'he') {
    const ownA = scriptHebrewMonthName(locale, a.month);
    const ownB = scriptHebrewMonthName(locale, b.month);
    if (a.year === b.year && a.month === b.month) return formatIntlDate(locale, 'hebrew', utcNoon(from), MONTH_YEAR, ownA);
    return formatIntlRange(locale, 'hebrew', utcNoon(from), utcNoon(to), MONTH_YEAR, ownA && ownB ? { start: ownA, end: ownB } : null);
  }
  if (a.year === b.year) {
    const year = hebrewYearNumeral(a.year);
    if (a.month === b.month) return `${a.monthName} ${year}`;
    return `${a.monthName}–${b.monthName} ${year}`;
  }
  return `${a.monthName} ${hebrewYearNumeral(a.year)} – ${b.monthName} ${hebrewYearNumeral(b.year)}`;
}
