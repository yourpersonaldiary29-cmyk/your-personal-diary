/**
 * Shared constants (server + frontend). No npm dependencies; the only import is
 * the localisation core (`./i18n`) that the user-facing labels resolve through.
 *
 * Localisation
 *   Every label here used to be a Hebrew literal. The data tables now carry stable
 *   keys and the text comes from the message catalogues:
 *
 *     emotionLabel(key, locale) / emotionDefs(locale) / emotionKeyFromWord(word, locale)
 *     habitTemplates(locale) / habitTemplateBySlug(slug, locale)
 *     periodLabel(period, locale) / periodOptions(locale)
 *     navLabel(path, locale) / navItems(locale)
 *     metricLabel(metric, locale) / metricUnit(metric, locale)
 *     passwordProblemKey(pw) / usernameProblemKey(u)  ->  { key, params } | null
 *     appName(locale)
 *
 *   The legacy exports (EMOTIONS[].label / .aliases, HABIT_TEMPLATES, PERIODS[].label,
 *   NAV_ITEMS[].label, METRIC_LABELS, METRIC_UNITS, passwordProblem(pw), usernameProblem(u),
 *   APP_NAME, WEEKDAY_NAMES, MONTH_NAMES) keep their shape and their Hebrew text - now read
 *   from the 'he' catalogue instead of being spelled here - so existing callers behave
 *   exactly as before. Pass a locale wherever the UI language is known
 *   (UI: getCurrentLocale() from '@/i18n/runtime'; server: req.locale / localeOf(req)).
 */
import type { HabitFrequency, HabitTemplate, Metric, Period } from './types';
import { localeDef, lookup, monthNames, t, weekdayNames, type Locale, type Params } from './i18n';

/**
 * Locale of the legacy (parameter-less) behaviour: the app was Hebrew-only before
 * localisation, so every optional `locale` below defaults to Hebrew.
 */
export const LEGACY_LOCALE: Locale = 'he';

/**
 * Product name. It is a brand and is ALWAYS written in English, whatever the UI
 * language (owner decision, 2026-09-28). The 'shell.appName' catalogue key holds
 * the same value in every locale and must never be translated.
 */
export const APP_NAME = 'Your Personal Diary';
export const APP_VERSION = '1.0.0';

/** Product name for a locale - identical in every language (see APP_NAME). */
export function appName(_locale: Locale = LEGACY_LOCALE): string {
  return APP_NAME;
}

/** Default TCP port of the local server. */
export const DEFAULT_PORT = 47321;

/** File extension of encrypted database / backup files (kept from the original product name for compatibility). */
export const CONTAINER_EXTENSION = '.mpd';

/** Backup file name pattern: your-personal-diary-backup-<username>-<YYYY-MM-DD>.mpd */
export function backupFileName(username: string, isoDate: string): string {
  const safe = username.replace(/[^\w.-]/g, '_');
  return `your-personal-diary-backup-${safe}-${isoDate}${CONTAINER_EXTENSION}`;
}

// ---------------------------------------------------------------------------
// Emotions - keys are stored in the DB, labels shown in the UI.
// Catalogue: 'emotions.<key>.label' (the label) and 'emotions.<key>.aliases'
// (comma-separated words the search parser also resolves to the key).
// ---------------------------------------------------------------------------

export type EmotionValence = 'positive' | 'negative' | 'neutral';

export interface EmotionDef {
  key: string;
  /** Label in the language the definition was built for (`EMOTIONS`: Hebrew). */
  label: string;
  /** Other words (feminine forms, nouns, synonyms) the search parser resolves to `key`, same language as `label`. */
  aliases: string[];
  /** Rough valence for grouping insights (never used as the only signal). */
  valence: EmotionValence;
}

const EMOTION_SEEDS: readonly { key: string; valence: EmotionValence }[] = [
  { key: 'happy', valence: 'positive' },
  { key: 'calm', valence: 'positive' },
  { key: 'sad', valence: 'negative' },
  { key: 'angry', valence: 'negative' },
  { key: 'stressed', valence: 'negative' },
  { key: 'excited', valence: 'positive' },
  { key: 'tired', valence: 'negative' },
  { key: 'satisfied', valence: 'positive' },
  { key: 'frustrated', valence: 'negative' },
  { key: 'anxious', valence: 'negative' },
  { key: 'energetic', valence: 'positive' },
  { key: 'grateful', valence: 'positive' },
  { key: 'lonely', valence: 'negative' },
  { key: 'hopeful', valence: 'positive' },
  { key: 'bored', valence: 'neutral' },
  { key: 'proud', valence: 'positive' },
  { key: 'focused', valence: 'positive' },
  { key: 'overwhelmed', valence: 'negative' },
];

export const EMOTION_KEYS = new Set(EMOTION_SEEDS.map((e) => e.key));

/** Catalogue key of an emotion label: 'emotions.happy.label'. */
export function emotionLabelKey(key: string): string {
  return `emotions.${key}.label`;
}

/** Label of an emotion in the locale ("שמח" / "Happy"); unknown keys come back unchanged. Overloaded so `keys.map(emotionLabel)` keeps type-checking. */
export function emotionLabel(key: string): string;
export function emotionLabel(key: string, locale: Locale): string;
export function emotionLabel(key: string, locale: Locale = LEGACY_LOCALE): string {
  return EMOTION_KEYS.has(key) ? t(locale, emotionLabelKey(key)) : key;
}

function splitAliases(csv: string): string[] {
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Aliases of an emotion in the locale (the words of 'emotions.<key>.aliases'); [] for unknown keys or missing entries. */
export function emotionAliases(key: string, locale: Locale = LEGACY_LOCALE): string[] {
  if (!EMOTION_KEYS.has(key)) return [];
  const raw = lookup(locale, `emotions.${key}.aliases`);
  return raw === null ? [] : splitAliases(raw);
}

const emotionDefsCache = new Map<Locale, EmotionDef[]>();

/** The emotion definitions with label and aliases in the locale (memoised per locale; treat as read-only). */
export function emotionDefs(locale: Locale = LEGACY_LOCALE): EmotionDef[] {
  let defs = emotionDefsCache.get(locale);
  if (!defs) {
    defs = EMOTION_SEEDS.map(({ key, valence }) => ({ key, label: emotionLabel(key, locale), aliases: emotionAliases(key, locale), valence }));
    emotionDefsCache.set(locale, defs);
  }
  return defs;
}

/** Emotion definitions with Hebrew label/aliases (legacy). Prefer `emotionDefs(locale)`. */
export const EMOTIONS: EmotionDef[] = emotionDefs(LEGACY_LOCALE);

export interface EmotionWord {
  /** Normalised word (trimmed, single spaces, lower case). */
  word: string;
  key: string;
}

function normaliseWord(word: string, locale: Locale): string {
  return word.trim().replace(/\s+/g, ' ').toLocaleLowerCase(localeDef(locale).intl);
}

const vocabularyCache = new Map<Locale, Map<string, string>>();

/** word -> emotion key for one locale (labels first, so a label always wins over another emotion's alias). */
function vocabulary(locale: Locale): Map<string, string> {
  let map = vocabularyCache.get(locale);
  if (!map) {
    map = new Map();
    const defs = emotionDefs(locale);
    for (const def of defs) map.set(normaliseWord(def.label, locale), def.key);
    for (const def of defs) {
      for (const alias of def.aliases) {
        const w = normaliseWord(alias, locale);
        if (!map.has(w)) map.set(w, def.key);
      }
    }
    vocabularyCache.set(locale, map);
  }
  return map;
}

/** Every word (label + aliases) the search parser recognises in the locale, with the key it resolves to. */
export function emotionWords(locale: Locale = LEGACY_LOCALE): EmotionWord[] {
  return [...vocabulary(locale)].map(([word, key]) => ({ word, key }));
}

/**
 * Resolves a typed word to an emotion key: exact (case-insensitive, whitespace-trimmed)
 * match against the labels and aliases of `locale`, then of the `fallbackLocales`
 * (English and Hebrew by default, so an English word still works in a Hebrew UI).
 * Returns null when nothing matches.
 */
export function emotionKeyFromWord(word: string, locale: Locale = LEGACY_LOCALE, fallbackLocales: readonly Locale[] = ['en', 'he']): string | null {
  const own = normaliseWord(word, locale);
  if (!own) return null;
  const hit = vocabulary(locale).get(own);
  if (hit) return hit;
  for (const fb of fallbackLocales) {
    if (fb === locale) continue;
    const fbHit = vocabulary(fb).get(normaliseWord(word, fb));
    if (fbHit) return fbHit;
  }
  return null;
}

/** Hebrew word -> emotion key (legacy, Hebrew vocabulary only). Prefer `emotionKeyFromWord(word, locale)`. */
export function emotionKeyFromHebrew(word: string): string | null {
  return emotionKeyFromWord(word, 'he', []);
}

// ---------------------------------------------------------------------------
// Habit templates offered in the "new habit" form (nothing is created automatically).
// Catalogue: 'habits.template.<slug>.name' / '.description', 'habits.template.unit.<unitKey>'.
// ---------------------------------------------------------------------------

export type HabitTemplateUnit = 'minutes' | 'times' | 'cups' | 'hours';

export interface HabitTemplateDef extends HabitTemplate {
  /** Stable id of the template ('walking', 'water' ...), the same in every language. */
  slug: string;
  /** Unit id; `unit` is its text in the template's language. */
  unitKey: HabitTemplateUnit;
}

const HABIT_TEMPLATE_SEEDS: readonly { slug: string; target: number; unitKey: HabitTemplateUnit; frequency: HabitFrequency }[] = [
  { slug: 'walking', target: 30, unitKey: 'minutes', frequency: 'daily' },
  { slug: 'exercise', target: 3, unitKey: 'times', frequency: 'weekly' },
  { slug: 'water', target: 8, unitKey: 'cups', frequency: 'daily' },
  { slug: 'reading', target: 20, unitKey: 'minutes', frequency: 'daily' },
  { slug: 'studying', target: 60, unitKey: 'minutes', frequency: 'daily' },
  { slug: 'sleepOnTime', target: 1, unitKey: 'times', frequency: 'daily' },
  { slug: 'work', target: 6, unitKey: 'hours', frequency: 'daily' },
  { slug: 'screenTime', target: 4, unitKey: 'hours', frequency: 'daily' },
  { slug: 'social', target: 3, unitKey: 'times', frequency: 'weekly' },
  { slug: 'meditation', target: 10, unitKey: 'minutes', frequency: 'daily' },
];

export const HABIT_TEMPLATE_SLUGS: readonly string[] = HABIT_TEMPLATE_SEEDS.map((s) => s.slug);

/** Unit text of a template unit in the locale: "דקות" / "minutes". */
export function habitTemplateUnit(unit: HabitTemplateUnit, locale: Locale = LEGACY_LOCALE): string {
  return t(locale, `habits.template.unit.${unit}`);
}

/** Name of a template in the locale: "הליכה" / "Walking". Unknown slugs come back unchanged. */
export function habitTemplateName(slug: string): string;
export function habitTemplateName(slug: string, locale: Locale): string;
export function habitTemplateName(slug: string, locale: Locale = LEGACY_LOCALE): string {
  return HABIT_TEMPLATE_SLUGS.includes(slug) ? t(locale, `habits.template.${slug}.name`) : slug;
}

/** Description of a template in the locale; '' for unknown slugs. */
export function habitTemplateDescription(slug: string, locale: Locale = LEGACY_LOCALE): string {
  return HABIT_TEMPLATE_SLUGS.includes(slug) ? t(locale, `habits.template.${slug}.description`) : '';
}

const habitTemplatesCache = new Map<Locale, HabitTemplateDef[]>();

/** The templates with name, description and unit in the locale (memoised per locale; treat as read-only). */
export function habitTemplates(locale: Locale = LEGACY_LOCALE): HabitTemplateDef[] {
  let list = habitTemplatesCache.get(locale);
  if (!list) {
    list = HABIT_TEMPLATE_SEEDS.map(({ slug, target, unitKey, frequency }) => ({
      slug,
      name: habitTemplateName(slug, locale),
      description: habitTemplateDescription(slug, locale),
      target,
      unit: habitTemplateUnit(unitKey, locale),
      unitKey,
      frequency,
    }));
    habitTemplatesCache.set(locale, list);
  }
  return list;
}

/** One template by slug in the locale, or undefined. */
export function habitTemplateBySlug(slug: string, locale: Locale = LEGACY_LOCALE): HabitTemplateDef | undefined {
  return habitTemplates(locale).find((tpl) => tpl.slug === slug);
}

/** Templates with Hebrew texts (legacy). Prefer `habitTemplates(locale)`. */
export const HABIT_TEMPLATES: HabitTemplateDef[] = habitTemplates(LEGACY_LOCALE);

// ---------------------------------------------------------------------------
// Periods - catalogue: 'shell.period.<value>'
// ---------------------------------------------------------------------------

export interface PeriodDef {
  value: Period;
  /** Label in the language the definition was built for (`PERIODS`: Hebrew). */
  label: string;
  labelKey: string;
  days: number | null;
}

const PERIOD_SEEDS: readonly { value: Period; days: number | null }[] = [
  { value: '7d', days: 7 },
  { value: '30d', days: 30 },
  { value: '3m', days: 90 },
  { value: '6m', days: 180 },
  { value: '1y', days: 365 },
  { value: 'all', days: null },
];

export const PERIOD_VALUES: readonly Period[] = PERIOD_SEEDS.map((p) => p.value);

/** Catalogue key of a period label: 'shell.period.30d'. */
export function periodLabelKey(p: Period): string {
  return `shell.period.${p}`;
}

/** Label of a period in the locale ("30 ימים" / "30 days"); unknown values come back unchanged. */
export function periodLabel(p: Period): string;
export function periodLabel(p: Period, locale: Locale): string;
export function periodLabel(p: Period, locale: Locale = LEGACY_LOCALE): string {
  return PERIOD_VALUES.includes(p) ? t(locale, periodLabelKey(p)) : p;
}

const periodOptionsCache = new Map<Locale, PeriodDef[]>();

/** The periods with labels in the locale, in display order (memoised per locale; treat as read-only). */
export function periodOptions(locale: Locale = LEGACY_LOCALE): PeriodDef[] {
  let list = periodOptionsCache.get(locale);
  if (!list) {
    list = PERIOD_SEEDS.map(({ value, days }) => ({ value, label: periodLabel(value, locale), labelKey: periodLabelKey(value), days }));
    periodOptionsCache.set(locale, list);
  }
  return list;
}

/** Periods with Hebrew labels (legacy). Prefer `periodOptions(locale)`. */
export const PERIODS: PeriodDef[] = periodOptions(LEGACY_LOCALE);

export function periodDays(p: Period): number | null {
  return PERIOD_SEEDS.find((x) => x.value === p)?.days ?? null;
}

// ---------------------------------------------------------------------------
// Dates (Hebrew tables of the legacy UI)
// Other languages: weekdayNames(locale) / monthNames(locale) from './i18n'.
// ---------------------------------------------------------------------------

/**
 * Hebrew weekday names without the "יום" prefix, index 0 = Sunday ("ראשון" ... "שבת"),
 * the convention of the Hebrew UI (callers prepend "יום" themselves). Legacy:
 * use `weekdayNames(locale)` for any other language.
 */
export const WEEKDAY_NAMES: string[] = weekdayNames('he').map((name) => name.replace(/^יום /, ''));
/** Hebrew one-letter weekday abbreviations of the calendar grid (index 0 = Sunday). */
export const WEEKDAY_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
/** Hebrew month names, index 0 = January (legacy: use `monthNames(locale)`). */
export const MONTH_NAMES: string[] = monthNames('he');

// ---------------------------------------------------------------------------
// Metrics shared by stats, search and insights - catalogue: 'shell.metric.<key>', 'shell.unit.*'
// ---------------------------------------------------------------------------

/** The rating/number metrics plus the entry count. */
export type MetricKey = Metric | 'entries';

export const METRIC_KEYS: readonly MetricKey[] = ['mood', 'energy', 'stress', 'sleepHours', 'sleepQuality', 'exerciseMinutes', 'entries'];

export function isMetricKey(value: unknown): value is MetricKey {
  return typeof value === 'string' && (METRIC_KEYS as readonly string[]).includes(value);
}

const METRIC_UNIT_KEYS: Partial<Record<MetricKey, string>> = {
  sleepHours: 'shell.unit.hours',
  exerciseMinutes: 'shell.unit.minutes',
  entries: 'shell.unit.entries',
};

/** Label of a metric in the locale ("מצב רוח" / "Mood"); unknown metrics come back unchanged. */
export function metricLabel(metric: string): string;
export function metricLabel(metric: string, locale: Locale): string;
export function metricLabel(metric: string, locale: Locale = LEGACY_LOCALE): string {
  return isMetricKey(metric) ? t(locale, `shell.metric.${metric}`) : metric;
}

/** Unit of a metric in the locale ("שעות" / "hours"); '' for ratings and unknown metrics. */
export function metricUnit(metric: string): string;
export function metricUnit(metric: string, locale: Locale): string;
export function metricUnit(metric: string, locale: Locale = LEGACY_LOCALE): string {
  const key = isMetricKey(metric) ? METRIC_UNIT_KEYS[metric] : undefined;
  return key ? t(locale, key) : '';
}

/** Hebrew metric labels (legacy). Prefer `metricLabel(metric, locale)`. */
export const METRIC_LABELS: Record<string, string> = Object.fromEntries(METRIC_KEYS.map((m) => [m, metricLabel(m, LEGACY_LOCALE)]));

/** Hebrew metric units (legacy). Prefer `metricUnit(metric, locale)`. */
export const METRIC_UNITS: Record<string, string> = Object.fromEntries(METRIC_KEYS.map((m) => [m, metricUnit(m, LEGACY_LOCALE)]));

// ---------------------------------------------------------------------------
// Password policy (shared so the UI can validate before sending)
// Catalogue: 'server.auth.passwordTooShort' {min} / 'server.auth.passwordTooLong' /
// 'server.auth.passwordNeedsLettersAndDigits' / 'server.auth.usernameInvalid'
// (the same keys the server renders, so the form and the API never disagree).
// ---------------------------------------------------------------------------

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 256;
export const USERNAME_PATTERN = /^[A-Za-z0-9_.֐-׿-]{3,32}$/;

/** A policy violation as a catalogue key plus its placeholders: render with t(locale, key, params). */
export interface PolicyProblem {
  key: string;
  params?: Params;
}

/** The password policy violation as a catalogue key, or null when the password is acceptable. */
export function passwordProblemKey(pw: string): PolicyProblem | null {
  if (pw.length < PASSWORD_MIN_LENGTH) return { key: 'server.auth.passwordTooShort', params: { min: PASSWORD_MIN_LENGTH } };
  if (pw.length > PASSWORD_MAX_LENGTH) return { key: 'server.auth.passwordTooLong' };
  if (!/[0-9]/.test(pw) || !/[^0-9]/.test(pw)) return { key: 'server.auth.passwordNeedsLettersAndDigits' };
  return null;
}

/** The username policy violation as a catalogue key, or null when the username is acceptable. */
export function usernameProblemKey(u: string): PolicyProblem | null {
  return USERNAME_PATTERN.test(u) ? null : { key: 'server.auth.usernameInvalid' };
}

/** The password policy violation as text in the locale (Hebrew by default), or null. */
export function passwordProblem(pw: string, locale: Locale = LEGACY_LOCALE): string | null {
  const problem = passwordProblemKey(pw);
  return problem ? t(locale, problem.key, problem.params) : null;
}

/** The username policy violation as text in the locale (Hebrew by default), or null. */
export function usernameProblem(u: string, locale: Locale = LEGACY_LOCALE): string | null {
  const problem = usernameProblemKey(u);
  return problem ? t(locale, problem.key, problem.params) : null;
}

// ---------------------------------------------------------------------------
// Navigation (order is the product spec) - catalogue: 'shell.nav.<id>'
// ---------------------------------------------------------------------------

export interface NavItem {
  path: string;
  /** Label in the language the item was built for (`NAV_ITEMS`: Hebrew). */
  label: string;
  labelKey: string;
  /** Alt+<key> shortcut. */
  key: string;
  requiresAuth: boolean;
}

const NAV_SEEDS: readonly { path: string; id: string; key: string; requiresAuth: boolean }[] = [
  { path: '/', id: 'home', key: '1', requiresAuth: true },
  { path: '/new', id: 'newEntry', key: '2', requiresAuth: true },
  { path: '/diary', id: 'diary', key: '3', requiresAuth: true },
  { path: '/calendar', id: 'calendar', key: '4', requiresAuth: true },
  { path: '/habits', id: 'habits', key: '5', requiresAuth: true },
  { path: '/insights', id: 'insights', key: '6', requiresAuth: true },
  { path: '/stats', id: 'stats', key: '7', requiresAuth: true },
  { path: '/search', id: 'search', key: '8', requiresAuth: true },
  { path: '/backup', id: 'backup', key: '9', requiresAuth: true },
  { path: '/settings', id: 'settings', key: '0', requiresAuth: false },
];

/** Catalogue key of a navigation label by path ('/diary' -> 'shell.nav.diary'), or null for unknown paths. */
export function navLabelKey(path: string): string | null {
  const seed = NAV_SEEDS.find((n) => n.path === path);
  return seed ? `shell.nav.${seed.id}` : null;
}

/** Label of a navigation item by path in the locale ("היומן שלי" / "My diary"); unknown paths come back unchanged. */
export function navLabel(path: string): string;
export function navLabel(path: string, locale: Locale): string;
export function navLabel(path: string, locale: Locale = LEGACY_LOCALE): string {
  const key = navLabelKey(path);
  return key ? t(locale, key) : path;
}

const navItemsCache = new Map<Locale, NavItem[]>();

/** The navigation items with labels in the locale (memoised per locale; treat as read-only). */
export function navItems(locale: Locale = LEGACY_LOCALE): NavItem[] {
  let list = navItemsCache.get(locale);
  if (!list) {
    list = NAV_SEEDS.map(({ path, id, key, requiresAuth }) => ({ path, label: t(locale, `shell.nav.${id}`), labelKey: `shell.nav.${id}`, key, requiresAuth }));
    navItemsCache.set(locale, list);
  }
  return list;
}

/** Navigation items with Hebrew labels (legacy). Prefer `navItems(locale)`. */
export const NAV_ITEMS: NavItem[] = navItems(LEGACY_LOCALE);

/** Session token lifetime. */
export const SESSION_TTL_HOURS = 12;
export const REMEMBER_ME_TTL_DAYS = 90;

/** Analysis thresholds (documented in ARCHITECTURE.md). */
export const ANALYSIS = {
  /** Minimum days with both variables before a relationship insight may be shown. */
  minDaysForRelationship: 14,
  /** Minimum days in each comparison group. */
  minGroupSize: 5,
  /** Minimum weeks for weekly habit/mood comparisons. */
  minWeeks: 4,
  /** |r| thresholds for weak / moderate / strong correlation. */
  weakR: 0.2,
  moderateR: 0.35,
  strongR: 0.5,
  /** Effect thresholds (in rating points, 1..10 scale) for group differences. */
  weakDiff: 0.5,
  moderateDiff: 1.0,
  strongDiff: 1.5,
  /** z-score threshold for anomalies. */
  anomalyZ: 2.0,
} as const;
