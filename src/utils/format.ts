/**
 * Number and text formatting helpers for the current UI language
 * (src/i18n/runtime): numbers go through Intl.NumberFormat with the locale's
 * digits and separators, phrases come from the 'shell.format.*' catalogue keys
 * with proper plural forms. `null` always renders as "not reported" - it is
 * never shown as 0.
 *
 * Signed numbers ("-1.2", "+0.8", "-50%") are direction-safe: every number that
 * carries a sign starts with a left-to-right mark (`directionSafe`), so the
 * sign stays in front of the digits inside Hebrew and Arabic text as well (a
 * bare "(-0.7)" is drawn "(0.7-)" there).
 */
import { localeDef, t, type Locale } from '@shared/i18n';
import { getCurrentLocale, subscribe, tr } from '@/i18n/runtime';

/** "לא דווח" / "Not reported" in the current language. */
export function notReported(): string {
  return tr('shell.format.notReported');
}

/**
 * The "not reported" text as a value (live ES-module binding: it follows the
 * current language). Prefer `notReported()` in new code.
 */
export let NOT_REPORTED = notReported();
subscribe(() => {
  NOT_REPORTED = notReported();
});

const decimalFormatters = new Map<string, Intl.NumberFormat>();

function formatter(decimals: number, locale: Locale = getCurrentLocale()): Intl.NumberFormat {
  const tag = localeDef(locale).intl;
  const key = `${tag}|${decimals}`;
  let f = decimalFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(tag, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true,
    });
    decimalFormatters.set(key, f);
  }
  return f;
}

const looseFormatters = new Map<string, Intl.NumberFormat>();

function looseFormatter(maxDecimals: number, locale: Locale = getCurrentLocale()): Intl.NumberFormat {
  const tag = localeDef(locale).intl;
  const key = `${tag}|${maxDecimals}`;
  let f = looseFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(tag, { maximumFractionDigits: maxDecimals });
    looseFormatters.set(key, f);
  }
  return f;
}

function missing(value: number | null | undefined): value is null | undefined {
  return value === null || value === undefined || Number.isNaN(value);
}

// ---------------------------------------------------------------------------
// Direction-safe signed numbers
// ---------------------------------------------------------------------------

/** U+200E LEFT-TO-RIGHT MARK. */
const LRM = '\u200e';
/** The marks ICU itself puts next to a sign in right-to-left locales: LRM, RLM, ALM. */
const SIGN_MARKS = /[\u200e\u200f\u061c]/g;
/** "+", hyphen-minus and the minus sign U+2212 (the minus of some locales). */
const SIGN = /[+\-\u2212]/;

/**
 * A formatted number that carries a sign gets one left-to-right mark in front of it; every other
 * text is returned as it is.
 *
 * Why: in right-to-left text a bare "-0.7" or "+1" is drawn with the sign after the digits ("0.7-",
 * "1+") - the sign is a neutral character there and follows the direction of the Hebrew / Arabic
 * around it. After a left-to-right mark the digits and the sign between the mark and the digits
 * resolve to left-to-right (Unicode bidi rules W7 and N1), whatever comes before or after. This is
 * what the Hebrew and Arabic number formats of ICU do themselves ("\u200e-1.3"); here it is done for
 * every language, because a diary in an English or German UI holds Hebrew and Arabic text too (habit
 * names, units), and with exactly one mark, whatever the engine's ICU version puts there.
 */
function directionSafe(text: string): string {
  return SIGN.test(text) ? `${LRM}${text.replace(SIGN_MARKS, '')}` : text;
}

/** Number with a fixed number of decimals (default one): 7.25 -> "7.3"; null -> "לא דווח". */
export function formatDecimal(value: number | null | undefined, decimals = 1): string {
  if (missing(value)) return notReported();
  return directionSafe(formatter(decimals).format(value));
}

/** Integer when whole, otherwise up to `maxDecimals` decimals: 7 -> "7", 7.5 -> "7.5". */
export function formatNumber(value: number | null | undefined, maxDecimals = 1): string {
  if (missing(value)) return notReported();
  if (Number.isInteger(value)) return directionSafe(formatter(0).format(value));
  return directionSafe(looseFormatter(maxDecimals).format(value));
}

/** "7 מתוך 10" / "7 of 10" (or "not reported"). */
export function ratingText(value: number | null | undefined, max = 10): string {
  if (missing(value)) return notReported();
  return tr('shell.format.rating', { value: formatNumber(value), max });
}

/** 0.75 -> "75%". */
export function formatPercent(ratio: number | null | undefined, decimals = 0): string {
  if (missing(ratio)) return notReported();
  return directionSafe(`${formatter(decimals).format(ratio * 100)}%`);
}

const signedFormatters = new Map<string, Intl.NumberFormat>();

/** Like `formatter`, with the sign always shown except on zero (also on what rounds to zero). */
function signedFormatter(decimals: number, locale: Locale = getCurrentLocale()): Intl.NumberFormat {
  const tag = localeDef(locale).intl;
  const key = `${tag}|${decimals}`;
  let f = signedFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(tag, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true,
      signDisplay: 'exceptZero',
    });
    signedFormatters.set(key, f);
  }
  return f;
}

/**
 * Signed difference: 0.8 -> "+0.8", -1.2 -> "-1.2", each after a left-to-right mark so that the
 * sign stays in front of the number in right-to-left text too (`directionSafe`). The sign comes
 * from Intl (`signDisplay: 'exceptZero'`): zero - and anything that rounds to zero at the shown
 * precision - has no sign ("0.0", never "+0.0" or "-0.0").
 */
export function formatSigned(value: number | null | undefined, decimals = 1): string {
  if (missing(value)) return notReported();
  return directionSafe(signedFormatter(decimals).format(value));
}

/**
 * Count phrase with the language's plural rules. The singular/plural words are
 * given by the caller: (1, "רשומה", "רשומות") -> "רשומה אחת"; (2, ...) -> "שתי רשומות";
 * (3, ...) -> "3 רשומות"; in English (1, "entry", "entries") -> "1 entry".
 * `feminine` picks the Hebrew form of "one" / "two".
 */
export function countLabel(n: number, singular: string, plural: string, feminine = true): string {
  return tr(feminine ? 'shell.format.countFeminine' : 'shell.format.countMasculine', { count: n, singular, plural });
}

/**
 * Attaches a one-letter Hebrew prefix (ב, ל, מ, ו, ש, ה, כ) to a phrase. When the
 * phrase starts with a digit or a Latin letter the prefix is joined with a hyphen,
 * as Hebrew spelling requires: ("ב", "30 ימים") -> "ב-30 ימים", ("ב", "שנה") -> "בשנה".
 */
export function withPrefix(prefix: string, phrase: string): string {
  const text = phrase.trimStart();
  return /^[0-9A-Za-z]/.test(text) ? `${prefix}-${text}` : `${prefix}${text}`;
}

/** "7.5 שעות" / "שעה אחת" / "7.5 hours". */
export function formatHours(hours: number | null | undefined): string {
  if (missing(hours)) return notReported();
  return tr('shell.format.hours', { count: hours });
}

/** "30 דקות" / "דקה אחת" / "שעה ו-15 דקות" (localised). */
export function formatMinutes(minutes: number | null | undefined): string {
  if (missing(minutes)) return notReported();
  const m = Math.round(minutes);
  if (m < 60) return tr('shell.format.minutes', { count: m });
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const hoursText = tr('shell.format.hoursShort', { count: h });
  return rest === 0 ? hoursText : tr('shell.format.hoursAndMinutes', { hours: hoursText, minutes: rest });
}

/** "3 ימים" / "יום אחד" / "3 days" (streaks). */
export function formatDays(days: number): string {
  return tr('shell.format.days', { count: days });
}

/** Truncates text with an ellipsis at a word boundary. */
export function truncate(text: string, max = 160): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}

const listFormatters = new Map<string, Intl.ListFormat | null>();

function listFormatter(locale: Locale): Intl.ListFormat | null {
  const tag = localeDef(locale).intl;
  if (!listFormatters.has(tag)) {
    let lf: Intl.ListFormat | null = null;
    try {
      lf = typeof Intl.ListFormat === 'function' ? new Intl.ListFormat(tag, { style: 'long', type: 'conjunction' }) : null;
    } catch {
      lf = null;
    }
    listFormatters.set(tag, lf);
  }
  return listFormatters.get(tag) ?? null;
}

/**
 * Joins a list with the language's conjunction: ["א","ב","ג"] -> "א, ב וג"
 * (ICU adds the hyphen before digits/Latin: "א ו-30 ימים"), ["a","b","c"] -> "a, b and c".
 * Falls back to a comma list when Intl.ListFormat is unavailable.
 */
export function joinList(items: string[], locale: Locale = getCurrentLocale()): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  const lf = listFormatter(locale);
  if (lf) return lf.format(items);
  return t(locale, 'shell.format.listConjunction', { head: items.slice(0, -1).join(', '), last: items[items.length - 1] });
}

/** Historical name of `joinList` (Hebrew call sites). */
export const joinHebrew = joinList;

/** Bytes -> "1.2 MB" style text in the current language. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return tr('shell.format.bytes', { count: bytes });
  const kb = bytes / 1024;
  if (kb < 1024) return tr('shell.format.kilobytes', { value: formatter(1).format(kb) });
  return tr('shell.format.megabytes', { value: formatter(1).format(kb / 1024) });
}
