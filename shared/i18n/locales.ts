/**
 * Supported UI languages. This is the contract for the localisation layer
 * (`shared/i18n`): the frontend, the server (errors, insights, search answers,
 * exports) and the calendar module all format text for one of these locales.
 *
 * Default language: English. The user changes it in Settings -> Language; the
 * choice is stored in AppSettings.language (per account) and, before login, in
 * localStorage so the welcome/login pages already use it.
 */

export type Locale =
  | 'en' // English (default)
  | 'he' // עברית
  | 'ar' // العربية
  | 'zh' // 中文 (简体)
  | 'ja' // 日本語
  | 'hi' // हिन्दी
  | 'th' // ไทย
  | 'es' // Español
  | 'pt' // Português
  | 'fr' // Français
  | 'it' // Italiano
  | 'de' // Deutsch
  | 'ro' // Română
  | 'el' // Ελληνικά
  | 'pl' // Polski
  | 'cs' // Čeština
  | 'hu' // Magyar
  | 'ru' // Русский
  | 'bg' // Български
  | 'tr'; // Türkçe

export type TextDirection = 'ltr' | 'rtl';

/**
 * Script family, used to pick PDF fonts and text shaping:
 *  latin      - DejaVu Sans (bundled) covers Latin (incl. Romanian/Turkish/Polish/Czech/Hungarian diacritics), Greek and Cyrillic
 *  hebrew     - DejaVu Sans, bidi reordering
 *  arabic     - bundled Arabic font, bidi reordering + joining (shaping)
 *  devanagari - bundled Devanagari font, OpenType shaping (fontkit Indic shaper)
 *  thai       - bundled Thai font, word segmentation for line breaks (Intl.Segmenter)
 *  cjk        - Windows system font (Microsoft YaHei / Yu Gothic) at runtime; not bundled (size)
 */
export type ScriptFamily = 'latin' | 'hebrew' | 'arabic' | 'devanagari' | 'thai' | 'cjk';

export interface LocaleDef {
  code: Locale;
  /** Name of the language in that language - this is what the language picker shows. */
  nativeName: string;
  /** English name (logs, docs). */
  englishName: string;
  dir: TextDirection;
  /** BCP 47 tag passed to Intl.* (dates, numbers, plural rules). */
  intl: string;
  script: ScriptFamily;
}

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALES: LocaleDef[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr', intl: 'en-GB', script: 'latin' },
  { code: 'he', nativeName: 'עברית', englishName: 'Hebrew', dir: 'rtl', intl: 'he-IL', script: 'hebrew' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl', intl: 'ar', script: 'arabic' },
  { code: 'zh', nativeName: '中文', englishName: 'Chinese (Simplified)', dir: 'ltr', intl: 'zh-CN', script: 'cjk' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', dir: 'ltr', intl: 'ja-JP', script: 'cjk' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', dir: 'ltr', intl: 'hi-IN', script: 'devanagari' },
  { code: 'th', nativeName: 'ไทย', englishName: 'Thai', dir: 'ltr', intl: 'th-TH', script: 'thai' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', dir: 'ltr', intl: 'es-ES', script: 'latin' },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese', dir: 'ltr', intl: 'pt-PT', script: 'latin' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', dir: 'ltr', intl: 'fr-FR', script: 'latin' },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian', dir: 'ltr', intl: 'it-IT', script: 'latin' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', dir: 'ltr', intl: 'de-DE', script: 'latin' },
  { code: 'ro', nativeName: 'Română', englishName: 'Romanian', dir: 'ltr', intl: 'ro-RO', script: 'latin' },
  { code: 'el', nativeName: 'Ελληνικά', englishName: 'Greek', dir: 'ltr', intl: 'el-GR', script: 'latin' },
  { code: 'pl', nativeName: 'Polski', englishName: 'Polish', dir: 'ltr', intl: 'pl-PL', script: 'latin' },
  { code: 'cs', nativeName: 'Čeština', englishName: 'Czech', dir: 'ltr', intl: 'cs-CZ', script: 'latin' },
  { code: 'hu', nativeName: 'Magyar', englishName: 'Hungarian', dir: 'ltr', intl: 'hu-HU', script: 'latin' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', dir: 'ltr', intl: 'ru-RU', script: 'latin' },
  { code: 'bg', nativeName: 'Български', englishName: 'Bulgarian', dir: 'ltr', intl: 'bg-BG', script: 'latin' },
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', dir: 'ltr', intl: 'tr-TR', script: 'latin' },
];

export const LOCALE_CODES: Locale[] = LOCALES.map((l) => l.code);

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALE_CODES as string[]).includes(value);
}

export function localeDef(code: Locale): LocaleDef {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}

export function directionOf(code: Locale): TextDirection {
  return localeDef(code).dir;
}

/**
 * Language codes withdrawn from ISO 639 that Java / Android (`Locale.getLanguage()`), and WebViews
 * built on it, can still report, mapped to the current code (the "Preferred-Value" of the IANA
 * language subtag registry). Only a result that is one of the app's locales counts: 'in' becomes
 * Indonesian, which the app does not have, so it is passed over like any unsupported language.
 */
const LEGACY_LANGUAGE_CODES: Readonly<Record<string, string>> = { iw: 'he', in: 'id', ji: 'yi', mo: 'ro' };

/**
 * Regions whose Chinese is written in Traditional characters when the tag names no script (CLDR
 * likely subtags: zh-TW / zh-HK / zh-MO -> zh-Hant-*). Android's WebView drops the script subtag
 * from the system locales it reports ("zh-Hant-TW" arrives as "zh-TW"), so the region is what
 * tells Traditional from Simplified there.
 */
const TRADITIONAL_CHINESE_REGIONS: ReadonlySet<string> = new Set(['tw', 'hk', 'mo']);

/** Script of a Chinese language tag: the explicit script subtag, else inferred from the region. */
export function chineseScriptOf(tag: string): 'Hans' | 'Hant' {
  const subtags = tag.trim().replace(/_/g, '-').toLowerCase().split('-').slice(1);
  const script = subtags.find((s) => /^[a-z]{4}$/.test(s));
  if (script === 'hant') return 'Hant';
  if (script === 'hans') return 'Hans';
  const region = subtags.find((s) => /^([a-z]{2}|\d{3})$/.test(s));
  return region && TRADITIONAL_CHINESE_REGIONS.has(region) ? 'Hant' : 'Hans';
}

/**
 * The app's catalogue for each Chinese script. The app has ONE Chinese catalogue, written in
 * Simplified characters ('zh', zh-CN conventions). A phone or browser set to Traditional Chinese
 * (Taiwan, Hong Kong, Macau, zh-Hant) gets it as well rather than English: it is the user's own
 * language - most Traditional readers read Simplified far more easily than English - and the user
 * can switch in Settings -> Language. This is also what the web UI and the server did before
 * (decision of 2026-10-23, ARCHITECTURE.md section 10). A Traditional catalogue added later is
 * mapped here ('Hant' -> its code) and nothing else has to change.
 */
const CHINESE_CATALOGUE_BY_SCRIPT: Readonly<Record<'Hans' | 'Hant', Locale>> = { Hans: 'zh', Hant: 'zh' };

/**
 * The app locale for ONE language tag as browsers, Android or Java write it - 'pt-BR', 'zh-Hant-TW',
 * 'es-419', 'iw_IL', 'EN-gb', 'ar-EG-u-nu-latn' - or null when its language is not one of the app's
 * 20: the region never matters (any Portuguese is 'pt'), the case and "_" / "-" separators do not
 * either, legacy codes are updated (iw -> he), and Chinese goes by its script (see above).
 */
export function localeFromTag(tag: string | null | undefined): Locale | null {
  if (typeof tag !== 'string') return null;
  const raw = tag.trim().replace(/_/g, '-').toLowerCase().split('-')[0] ?? '';
  const language = LEGACY_LANGUAGE_CODES[raw] ?? raw;
  if (language === 'zh') return CHINESE_CATALOGUE_BY_SCRIPT[chineseScriptOf(tag)];
  return isLocale(language) ? language : null;
}

/**
 * Picks the locale for a language preference list - navigator.languages (on Android the phone's
 * system languages, in the order of Settings -> System -> Languages) or an Accept-Language header
 * ("he-IL,he;q=0.9,en;q=0.8", in the order given). The FIRST entry whose language the app has wins
 * (see `localeFromTag` for how a tag is read); when none matches, English (`DEFAULT_LOCALE`).
 */
export function negotiateLocale(candidates: readonly string[] | string | null | undefined): Locale {
  const list = Array.isArray(candidates)
    ? candidates
    : typeof candidates === 'string'
      ? candidates.split(',').map((s) => s.split(';')[0].trim())
      : [];
  for (const raw of list) {
    const locale = localeFromTag(raw);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

/*
 * MESSAGE CATALOGUES (implemented under shared/i18n/messages/):
 *
 *   shared/i18n/messages/<locale>/<area>.ts   export default { 'key.path': 'text with {placeholders}' }
 *   areas: shell, auth, entries, habits, insights, stats, search, settings, backup, calendar,
 *          holidays, emotions, server (errors, notes, export labels, reminders), analysis (insight templates)
 *   shared/i18n/messages/index.ts             getCatalog(locale): Record<string, string> (merged areas; missing keys fall back to 'en', then to the key itself)
 *
 * API (shared/i18n/index.ts):
 *   t(locale, key, params?)                   // {name} placeholders; {count, plural, one {…} other {…}} for plurals (ICU-like, minimal)
 *   makeT(locale) -> (key, params?) => string
 *   formatDate(locale, iso, style)            // Intl.DateTimeFormat; style: 'full' | 'long' | 'short' | 'weekday' | 'monthYear'
 *   formatNumber(locale, n, decimals?)        // Intl.NumberFormat
 *   hebrewDateLabel(locale, iso) / hijriDateLabel(locale, iso)   // calendar module with Intl month names in the UI language
 *
 * RULES
 *   - Keys are stable, lowercase dotted paths. The English catalogue is the source of truth for the key set;
 *     a test asserts that every locale defines exactly the same keys (no missing, no extra).
 *   - Never build sentences by string concatenation in UI or server code: use placeholders so word order can differ per language.
 *   - The server resolves the request locale from the `Accept-Language` header sent by the client (settings.language),
 *     then from the account's stored setting, then 'en'. All ApiError messages, insight texts, search answers, export labels
 *     and reminder texts go through the catalogue.
 */
