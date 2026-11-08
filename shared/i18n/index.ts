/**
 * Localisation core shared by the frontend and the server.
 *
 *   import { t, makeT, formatDate, formatNumber } from '@shared/i18n';
 *   t('en', 'shell.save')                              -> 'Save'
 *   t('he', 'shell.greeting', { firstName: 'דנה' })   -> 'שלום דנה, וברוכים הבאים ליומן האישי שלך'
 *   t('en', 'entries.count', { count: 3 })             -> '3 entries'   (plural forms, see below)
 *
 * Catalogues live in shared/i18n/messages/<locale>/<area>.ts and are merged by
 * shared/i18n/messages/index.ts. Lookup order: requested locale -> English -> the key itself
 * (a missing key never throws in production; the parity test guards completeness).
 *
 * Message syntax (deliberately small, no dependency):
 *   {name}                                   placeholder (any value, numbers formatted per locale)
 *   {count, plural, one {# entry} other {# entries}}
 *                                            plural forms chosen with Intl.PluralRules; # = the number
 *                                            categories: zero one two few many other (missing -> other)
 *   {kind, select, major {holiday} fast {fast day} other {observance}}
 *                                            select on a string value
 *   '{' and '}' can be escaped as '{{' and '}}'.
 */
import { DEFAULT_LOCALE, isLocale, localeDef, type Locale } from './locales';
import { getCatalog } from './messages';

export * from './locales';
export { getCatalog, AREA_NAMES } from './messages';

export type Params = Record<string, string | number | boolean | null | undefined>;

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/** Raw template for a key in the given locale (with fallback to English), or null. */
export function lookup(locale: Locale, key: string): string | null {
  const own = getCatalog(locale)[key];
  if (own !== undefined) return own;
  if (locale !== DEFAULT_LOCALE) {
    const fallback = getCatalog(DEFAULT_LOCALE)[key];
    if (fallback !== undefined) return fallback;
  }
  return null;
}

/** True when the key exists in the locale itself (not through the English fallback). */
export function hasMessage(locale: Locale, key: string): boolean {
  return getCatalog(locale)[key] !== undefined;
}

/** Translates `key` for `locale`, interpolating `params`. Unknown keys return the key (never throw). */
export function t(locale: Locale, key: string, params?: Params): string {
  const template = lookup(locale, key);
  if (template === null) return key;
  return format(locale, template, params);
}

/** Bound translator: `const tr = makeT('he'); tr('shell.save')`. */
export function makeT(locale: Locale): (key: string, params?: Params) => string {
  return (key, params) => t(locale, key, params);
}

// ---------------------------------------------------------------------------
// Formatting of templates
// ---------------------------------------------------------------------------

const pluralRulesCache = new Map<string, Intl.PluralRules>();

function pluralRules(locale: Locale): Intl.PluralRules {
  const tag = localeDef(locale).intl;
  let pr = pluralRulesCache.get(tag);
  if (!pr) {
    try {
      pr = new Intl.PluralRules(tag);
    } catch {
      pr = new Intl.PluralRules('en');
    }
    pluralRulesCache.set(tag, pr);
  }
  return pr;
}

/** Splits `one {…} few {…} other {…}` into a map, honouring nested braces. */
function parseOptions(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++;
    let name = '';
    while (i < body.length && body[i] !== '{' && !/\s/.test(body[i])) name += body[i++];
    while (i < body.length && /\s/.test(body[i])) i++;
    if (body[i] !== '{') break;
    let depth = 0;
    let j = i;
    for (; j < body.length; j++) {
      if (body[j] === '{') depth++;
      else if (body[j] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    out[name] = body.slice(i + 1, j);
    i = j + 1;
  }
  return out;
}

/** Finds the matching closing brace for the '{' at `start`. */
function matchBrace(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function formatValue(locale: Locale, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return formatNumber(locale, value);
  return String(value);
}

/** Interpolates a template (see the file header for the syntax). Exported for tests. */
export function format(locale: Locale, template: string, params?: Params): string {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    if (ch === '{') {
      if (template[i + 1] === '{') {
        out += '{';
        i += 2;
        continue;
      }
      const end = matchBrace(template, i);
      if (end < 0) {
        out += template.slice(i);
        break;
      }
      const inner = template.slice(i + 1, end);
      out += expand(locale, inner, params);
      i = end + 1;
      continue;
    }
    if (ch === '}' && template[i + 1] === '}') {
      out += '}';
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function expand(locale: Locale, inner: string, params?: Params): string {
  const comma = inner.indexOf(',');
  if (comma < 0) {
    const name = inner.trim();
    return formatValue(locale, params?.[name]);
  }
  const name = inner.slice(0, comma).trim();
  const rest = inner.slice(comma + 1);
  const comma2 = rest.indexOf(',');
  const kind = (comma2 < 0 ? rest : rest.slice(0, comma2)).trim();
  const body = comma2 < 0 ? '' : rest.slice(comma2 + 1);
  const options = parseOptions(body);
  const value = params?.[name];
  if (kind === 'plural') {
    const n = typeof value === 'number' ? value : Number(value ?? 0);
    const exact = options[`=${n}`];
    const category = pluralRules(locale).select(Number.isFinite(n) ? n : 0);
    const chosen = exact ?? options[category] ?? options.other ?? '';
    return format(locale, chosen.replace(/#/g, formatNumber(locale, n)), params);
  }
  if (kind === 'select') {
    const key = value === null || value === undefined ? 'other' : String(value);
    const chosen = options[key] ?? options.other ?? '';
    return format(locale, chosen, params);
  }
  return formatValue(locale, value);
}

// ---------------------------------------------------------------------------
// Numbers and dates
// ---------------------------------------------------------------------------

const numberFormatCache = new Map<string, Intl.NumberFormat>();

/** Locale-aware number: integers stay integers, others get at most `maxDecimals` decimals. */
export function formatNumber(locale: Locale, value: number, maxDecimals = 1): string {
  if (!Number.isFinite(value)) return String(value);
  const tag = localeDef(locale).intl;
  const cacheKey = `${tag}|${maxDecimals}`;
  let nf = numberFormatCache.get(cacheKey);
  if (!nf) {
    nf = new Intl.NumberFormat(tag, { maximumFractionDigits: maxDecimals, useGrouping: false });
    numberFormatCache.set(cacheKey, nf);
  }
  return nf.format(value);
}

export type DateStyle = 'full' | 'long' | 'short' | 'numeric' | 'weekday' | 'monthYear' | 'dayMonth' | 'time';

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  short: { day: 'numeric', month: 'numeric', year: 'numeric' },
  // Two-digit day and month in the locale's order and separators: '12.09.2026' (he, de), '12/09/2026' (en), '2026/09/12' (zh, ja).
  numeric: { day: '2-digit', month: '2-digit', year: 'numeric' },
  weekday: { weekday: 'long' },
  monthYear: { month: 'long', year: 'numeric' },
  dayMonth: { day: 'numeric', month: 'numeric' },
  time: { hour: '2-digit', minute: '2-digit' },
};

/**
 * Civil dates are always written in the Gregorian calendar - the diary's own calendar (the calendar
 * page names it 'Gregorian' next to the Hebrew and the Hijri one). Without this, Thai would use its
 * default Buddhist era ('30 กันยายน 2569') in the header while the calendar page shows September 2026.
 */
const CIVIL_CALENDAR = 'gregory';

const dateFormatCache = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(locale: Locale, style: DateStyle): Intl.DateTimeFormat {
  const tag = localeDef(locale).intl;
  const cacheKey = `${tag}|${style}`;
  let df = dateFormatCache.get(cacheKey);
  if (!df) {
    df = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', calendar: CIVIL_CALENDAR, ...DATE_OPTIONS[style] });
    dateFormatCache.set(cacheKey, df);
  }
  return df;
}

/** Parses 'YYYY-MM-DD' (and optional 'HH:MM') into a UTC Date at noon so the civil day never shifts. */
export function civilDate(iso: string, time?: string | null): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`invalid date: ${iso}`);
  const tm = time && /^(\d{2}):(\d{2})$/.exec(time);
  const hours = tm ? Number(tm[1]) : 12;
  const minutes = tm ? Number(tm[2]) : 0;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hours, minutes));
}

/** Formats a civil date ('YYYY-MM-DD') in the locale: 'full' -> "יום שני, 7 בספטמבר 2026" / "Monday, 7 September 2026". */
export function formatDate(locale: Locale, iso: string, style: DateStyle = 'long'): string {
  return dateFormatter(locale, style).format(civilDate(iso));
}

/** Formats an 'HH:MM' time in the locale (24h in most locales, 12h where customary). */
export function formatTime(locale: Locale, time: string): string {
  return dateFormatter(locale, 'time').format(civilDate('2000-01-01', time));
}

/** Formats an ISO-8601 timestamp (createdAt...) as a local date and time in the locale. */
export function formatTimestamp(locale: Locale, timestamp: string): string {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return timestamp;
  const tag = localeDef(locale).intl;
  return new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short', calendar: CIVIL_CALENDAR }).format(d);
}

/** Localised weekday names, index 0 = Sunday. */
export function weekdayNames(locale: Locale, width: 'long' | 'short' | 'narrow' = 'long'): string[] {
  const tag = localeDef(locale).intl;
  const df = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', weekday: width });
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => df.format(new Date(Date.UTC(2023, 0, 1 + i, 12))));
}

/** Localised month names, index 0 = January. */
export function monthNames(locale: Locale, width: 'long' | 'short' = 'long'): string[] {
  const tag = localeDef(locale).intl;
  const df = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', month: width });
  return Array.from({ length: 12 }, (_, i) => df.format(new Date(Date.UTC(2023, i, 15, 12))));
}

/**
 * Month names for places where the name stands alone (a month <select>, a list of months), index 0 =
 * January: the nominative. A month-only Intl format is the genitive in Greek ("Οκτωβρίου" - the
 * server sentences rely on it after "τον μήνα"), so the name is taken from the month + year format
 * ("Οκτώβριος 2026") whenever that spells the month in letters; locales whose month + year format is
 * numeric (zh, ja) keep the month-only name ("十月", "10月").
 */
export function standaloneMonthNames(locale: Locale): string[] {
  const tag = localeDef(locale).intl;
  const withYear = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', calendar: CIVIL_CALENDAR, month: 'long', year: 'numeric' });
  return monthNames(locale, 'long').map((name, i) => {
    const part = withYear.formatToParts(new Date(Date.UTC(2023, i, 15, 12))).find((p) => p.type === 'month')?.value;
    return part && /\p{L}/u.test(part) ? part : name;
  });
}

/** Resolves a stored/negotiated value to a supported locale. */
export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
