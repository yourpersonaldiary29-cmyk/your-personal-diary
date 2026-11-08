/**
 * Keyword tables of the smart-search parser (server/src/search/parser.ts), one per
 * UI language. The parser itself is language-neutral: every word it recognises -
 * periods, metrics, comparators, number words, intents, emotions, stopwords -
 * comes from the table of the language the question is written in. Answers and
 * explanations are always rendered in the UI language through the 'searchAnswers'
 * catalogue (shared/i18n/messages/<locale>/searchAnswers.ts).
 *
 * Adding a language: write shared/i18n/search/<locale>.ts following README.md,
 * register it in SEARCH_TABLES below and run `npx vitest run test/search-tables`
 * in server/ - that test parses the ten `examples` of every registered table.
 *
 * Matching rules the tables rely on:
 *  - Tokens are compared lower-cased (toLocaleLowerCase of the table's locale).
 *    Write every table word in lower case.
 *  - A "phrase" is one or more words separated by single spaces ('less than',
 *    'מצב רוח'). The first word of a phrase may match a token after one of
 *    `prefixes` was stripped (Hebrew ב/ל/מ/ש/ו/ה/כש); the following words may
 *    match after one of `articlePrefixes` was stripped ('הרוח' -> 'רוח').
 *  - With `tokenizer: 'segmenter'` (Chinese, Japanese, Thai) the question is
 *    first cut at every table phrase found as a substring, and the remaining
 *    spans are split with Intl.Segmenter; a phrase is then a single token, so
 *    write CJK phrases without spaces ('上个月').
 */
import type { Comparator, Metric } from '../../types';
import type { Locale } from '../locales';
import en from './en';
import he from './he';
import zh from './zh';
import ja from './ja';
import ar from './ar';
import tr from './tr';
import hi from './hi';
import th from './th';
import es from './es';
import pt from './pt';
import de from './de';
import ro from './ro';
import fr from './fr';
import it from './it';
import ru from './ru';
import bg from './bg';
import cs from './cs';
import hu from './hu';
import el from './el';
import pl from './pl';

export type SearchTokenizer = 'space' | 'segmenter';

/** Script of the questions a table understands (used to pick a table when the UI language and the question's script differ). */
export type QueryScript = 'latin' | 'hebrew' | 'arabic' | 'cyrillic' | 'greek' | 'han' | 'kana' | 'thai' | 'devanagari';

/** Order of the numeric parts in a typed date such as 01/08/2026 (a leading 4-digit year is always understood). */
export type DateOrder = 'dmy' | 'mdy' | 'ymd';

export type PeriodUnit = 'day' | 'week' | 'month' | 'year';

/** Fixed period phrases ('last week', 'yesterday'); the parser turns each kind into a date range. */
export type PeriodPhraseKind =
  | 'today'
  | 'yesterday'
  | 'twoDaysAgo'
  | 'week' // the last 7 days
  | 'month' // the last 30 days
  | 'halfYear' // the last 180 days
  | 'year' // the last 365 days
  | 'startYear' // 1 January -> today
  | 'startMonth' // 1st of this month -> today
  | 'recent'; // the last 7 days, labelled "in recent days"

export interface ComparatorRule {
  /** Words of the comparator phrase, in order: 'less than' -> ['less', 'than']. */
  words: string[];
  comparator: Comparator;
  /**
   * The number after the phrase must start with this attached prefix letter
   * (Hebrew 'פחות מ-5', 'פחות מחמש'); the parser strips it before reading the number.
   */
  numberPrefix?: string;
  /**
   * Where the phrase stands relative to the number. 'before' (default): 'less than 5'.
   * 'after': the phrase follows the number and its optional unit - Japanese '5時間未満',
   * Hindi 'पाँच घंटे से कम', Turkish '5 saatten az', English '5 hours or less'.
   */
  position?: 'before' | 'after';
}

export interface SearchLanguageTable {
  locale: Locale;
  script: QueryScript;
  tokenizer: SearchTokenizer;
  dateOrder: DateOrder;
  /** Prefixes stripped from a token before dictionary lookups (Hebrew ב/ל/מ/ש/ו/ה/כש); [] for most languages. */
  prefixes: string[];
  /** Prefixes stripped from the 2nd+ word of a phrase and from adjectives (Hebrew definite article 'ה'). */
  articlePrefixes: string[];
  /** Letters that may precede a number or a date as an attached prefix ('מ-5', 'בחמש', 'ב-3/9/2026'); '' when none. */
  numberPrefixLetters: string;
  /** Prefix typed as a separate token before a number ('מ- 5'); [] when none. */
  barePrefixTokens: string[];
  /** Articles skipped inside period patterns ('the last 3 days', 'a week ago'). */
  articles: string[];
  /** Words that carry no search meaning; everything else that is left over becomes a text term. */
  stopwords: string[];
  /** Number words -> value ('five' -> 5, 'שלושת' -> 3). */
  numberWords: Record<string, number>;
  /** Phrases that add a half to the number before them ('and a half', 'וחצי'). */
  halfPhrases: string[];
  /**
   * Light stemming for text search in inflected languages (optional): the longest of these endings
   * is cut from a search word when at least `stemMinLength` letters remain, and the diary is
   * searched for the stem - Russian "о работе" then finds "работа", Polish "o pracy" finds "praca".
   * With `stemArticle` the article prefix (`articlePrefixes`) is cut first (Arabic "العمل" -> "عمل").
   */
  stemSuffixes?: string[];
  stemMinLength?: number;
  stemArticle?: boolean;
  /** Words BEFORE a number that add a half to it: Hindi "साढ़े सात" = 7.5 (optional). */
  halfBeforeWords?: string[];
  /** Case endings that may be glued to a number: Turkish "7den" / "5ten" (optional). */
  numberSuffixes?: string[];
  periods: {
    /** Fixed phrases -> kind ('last week' -> 'week'). */
    phrases: Record<string, PeriodPhraseKind>;
    /** Unit words -> unit ('day' / 'days' -> 'day'), bare forms only: an article prefix is stripped by the parser. */
    units: Record<string, PeriodUnit>;
    /** Words meaning "last / past" in "the last 3 days" / "3 הימים האחרונים"; may stand before or after the number+unit. */
    lastWords: string[];
    /** Words meaning "two <unit>" ('fortnight' -> 'week', 'שבועיים' -> 'week'). */
    dualWords: Record<string, PeriodUnit>;
    /** "N units ago": the ago word(s) and whether they stand before ('לפני שבוע') or after ('a week ago') the unit. */
    ago: {
      words: string[];
      position: 'before' | 'after';
      /**
       * Unit words that already mean "ago" on their own - Hungarian possessives: "két hete" (two
       * weeks ago), "három napja" (three days ago). The number stands before them.
       */
      units?: Record<string, PeriodUnit>;
    };
    /** Extra month spellings -> month index 0-11 (Intl month names, long and short, are always known). */
    monthAliases: Record<string, number>;
    /** Month names that count as a month only with a lead word before or a year after ('may' in English). */
    monthNeedsContext: string[];
    /** Words absorbed before a month name ('in', 'during', 'בחודש'). */
    monthLeadWords: string[];
    /** Words allowed around explicit dates ('between', 'and', 'from', 'to', 'בין', 'עד'). */
    rangeConnectors: string[];
  };
  /** Metric phrases (1-3 words) -> metric ('sleep quality' -> 'sleepQuality'). */
  metrics: Record<string, Metric>;
  /** Unit words after a threshold -> the metric they imply ('hours' -> sleepHours); null for neutral units ('points'). */
  thresholdUnits: Record<string, Metric | null>;
  comparators: ComparatorRule[];
  /** Negation words that turn a bare exercise question into "no exercise" ('days without exercise'). */
  negations: string[];
  rank: {
    /** Adjectives after a marker ('הכי טוב', 'most difficult'), before an after-marker ('הטובים ביותר') or next to a day word. */
    good: string[];
    bad: string[];
    high: string[];
    low: string[];
    /** Superlative markers before the adjective ('הכי', 'most'). */
    markersBefore: string[];
    /** Superlative markers after the adjective ('ביותר'). */
    markersAfter: string[];
    /** "days" words next to a good/bad adjective, in either order ('הימים הקשים', 'good days'). */
    dayWords: string[];
    /** Words that express the rank on their own ('best', 'worst', 'highest', 'שיא'). */
    bare: { best: string[]; worst: string[]; high: string[]; low: string[] };
  };
  trend: {
    /** Words/phrases that ask for a trend or an average ('changed', 'trend', 'average', 'השתנה'). */
    words: string[];
    /** Question words absorbed before a trend word ('how', 'איך'). */
    leadWords: string[];
  };
  trigger: {
    /** "What did I write" verbs ('wrote', 'mentioned', 'כתבתי'). */
    words: string[];
    /** Question words absorbed before the verb ('when', 'what', 'מתי'). */
    leadWords: string[];
    /** Whole tokens dropped when they directly follow the verb ('that', 'שאני'). */
    conjunctions: string[];
    /** Prefix stripped from the first word after the verb ('ש' in 'שהייתי'); null when none. */
    conjunctionPrefix: string | null;
  };
  /**
   * Emotion key -> words (label first, then aliases). The 'emotions.<key>.label' and
   * 'emotions.<key>.aliases' entries of this language's catalogue are merged in
   * automatically; list a word here as well when it is also a metric word ('stress'),
   * because catalogue aliases that name a metric are otherwise ignored.
   */
  emotions: Record<string, string[]>;
  /**
   * The ten reference questions in this language, in this exact order (see README.md,
   * "The ten questions"). server/test/search-tables.test.ts parses them for every
   * registered table and checks the structure each one must produce.
   */
  examples: string[];
}

/** Registered tables. Translators add their locale here. */
export const SEARCH_TABLES: Partial<Record<Locale, SearchLanguageTable>> = { en, he, zh, ja, ar, hi, th, tr, es, pt, de, ro, fr, it, ru, bg, cs, hu, el, pl };

export const DEFAULT_SEARCH_LOCALE: Locale = 'en';

export function hasSearchTable(locale: Locale): boolean {
  return SEARCH_TABLES[locale] !== undefined;
}

/** The table of `locale`, or the English table when the language has none yet. */
export function getSearchTable(locale: Locale): SearchLanguageTable {
  return SEARCH_TABLES[locale] ?? (SEARCH_TABLES[DEFAULT_SEARCH_LOCALE] as SearchLanguageTable);
}

/** Locales that have a table, in registration order. */
export function searchTableLocales(): Locale[] {
  return Object.keys(SEARCH_TABLES) as Locale[];
}

const SCRIPT_RANGES: { script: QueryScript; re: RegExp }[] = [
  { script: 'hebrew', re: /[֐-׿]/g },
  { script: 'arabic', re: /[؀-ۿݐ-ݿ]/g },
  { script: 'kana', re: /[぀-ヿ]/g },
  { script: 'han', re: /[一-鿿]/g },
  { script: 'thai', re: /[฀-๿]/g },
  { script: 'devanagari', re: /[ऀ-ॿ]/g },
  { script: 'cyrillic', re: /[Ѐ-ӿ]/g },
  { script: 'greek', re: /[Ͱ-Ͽ]/g },
  { script: 'latin', re: /[A-Za-zÀ-ɏ]/g },
];

/** Dominant script of a question, or null when it has no letters (digits / punctuation only). */
export function scriptOfText(text: string): QueryScript | null {
  let best: QueryScript | null = null;
  let bestCount = 0;
  for (const { script, re } of SCRIPT_RANGES) {
    const count = (text.match(re) ?? []).length;
    if (count > bestCount) {
      best = script;
      bestCount = count;
    }
  }
  // Japanese questions mix kana and han: any kana means Japanese.
  if (best === 'han' && /[぀-ヿ]/.test(text)) return 'kana';
  return best;
}

/**
 * The table to parse a question with: the UI language's table when the question is
 * written in its script, otherwise the (single) registered table of the question's
 * script - a Hebrew question typed under an English UI is still understood.
 * Answers are always rendered in the UI language.
 */
export function tableForQuery(locale: Locale, text: string): SearchLanguageTable {
  const preferred = getSearchTable(locale);
  const script = scriptOfText(text);
  if (!script || script === preferred.script) return preferred;
  const candidates = searchTableLocales()
    .map((l) => SEARCH_TABLES[l] as SearchLanguageTable)
    .filter((tbl) => tbl.script === script);
  if (!candidates.length) return preferred;
  const own = candidates.find((tbl) => tbl.locale === locale);
  return own ?? candidates[0];
}
