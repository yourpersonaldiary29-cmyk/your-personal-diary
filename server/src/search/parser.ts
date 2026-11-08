/**
 * Table-driven parser for smart-search questions. Runs entirely locally: no model,
 * no network - just the keyword table of the question's language
 * (shared/i18n/search/<locale>.ts) and token patterns.
 *
 * Pipeline (see `parseQuery`):
 *  1. normalise the text and pull out quoted phrases ("...") as exact text terms;
 *  2. pick the table (the UI language's, or the one matching the question's script)
 *     and tokenise (spaces, or table phrases + Intl.Segmenter for zh/ja/th);
 *  3. detect the period ("last month", "in July", "between 1/8/2026 and 15/8/2026", ...);
 *  4. detect a "what did I write" trigger (wrote / mentioned) -> text_mention;
 *  5. detect the metric (mood, energy, stress, sleep, sleep quality, exercise);
 *  6. detect a comparator + number (less than 5, at least eight, above 7 ...);
 *  7. detect intent phrases (best / hardest / how did ... change);
 *  8. detect emotions (table words merged with the emotions catalogue of that language);
 *  9. decide the intent and render the explanation in the UI locale through t().
 *
 * Tokens consumed by a rule get a `role` so later rules and the free-text terms
 * ignore them. Everything else that is not a stopword becomes a text term.
 * Period labels, explanations and answers come from the 'searchAnswers' catalogue.
 */
import { EMOTIONS } from '@shared/constants';
import { DEFAULT_LOCALE, formatDate, formatNumber, hasMessage, localeDef, monthNames, t, type Locale } from '@shared/i18n';
import {
  getSearchTable,
  tableForQuery,
  type ComparatorRule,
  type PeriodPhraseKind,
  type PeriodUnit,
  type SearchLanguageTable,
} from '@shared/i18n/search';
import type { Comparator, Metric, ParsedQuery, SearchIntent } from '@shared/types';
import { addDays, daysInMonth, isIsoDate, todayIso } from '../util/dates';

// ---------------------------------------------------------------------------
// Compiled tables
// ---------------------------------------------------------------------------

interface PhraseEntry<V> {
  words: string[];
  value: V;
}

/** Phrases grouped by their first word, longest first, for left-to-right matching. */
class PhraseIndex<V> {
  private readonly byFirst = new Map<string, PhraseEntry<V>[]>();

  add(phrase: string, value: V): void {
    const words = phrase.split(' ').filter(Boolean);
    if (!words.length) return;
    const list = this.byFirst.get(words[0]) ?? [];
    if (list.some((e) => e.words.length === words.length && e.words.every((w, i) => w === words[i]))) return;
    list.push({ words, value });
    list.sort((a, b) => b.words.length - a.words.length);
    this.byFirst.set(words[0], list);
  }

  candidates(first: string): PhraseEntry<V>[] {
    return this.byFirst.get(first) ?? [];
  }

  /** True when `word` is a complete one-word phrase of the index. */
  hasWord(word: string): boolean {
    return this.candidates(word).some((e) => e.words.length === 1);
  }

  phrases(): string[] {
    const out: string[] = [];
    for (const list of this.byFirst.values()) for (const e of list) out.push(e.words.join(' '));
    return out;
  }
}

interface RankSets {
  good: Set<string>;
  bad: Set<string>;
  high: Set<string>;
  low: Set<string>;
  markersBefore: Set<string>;
  markersAfter: Set<string>;
  dayWords: Set<string>;
  best: Set<string>;
  worst: Set<string>;
  bareHigh: Set<string>;
  bareLow: Set<string>;
}

interface Compiled {
  table: SearchLanguageTable;
  intl: string;
  /** Shortest free-text term kept (1 for segmented scripts, 2 elsewhere). */
  minTermLength: number;
  stopwords: Set<string>;
  numberWords: Record<string, number>;
  numberPrefixRe: RegExp | null;
  barePrefix: Set<string>;
  articles: Set<string>;
  halfPhrases: string[][];
  periodPhrases: PhraseIndex<PeriodPhraseKind>;
  units: Map<string, PeriodUnit>;
  lastWords: Set<string>;
  dualWords: Map<string, PeriodUnit>;
  agoWords: Set<string>;
  /** Unit words that mean "ago" on their own (Hungarian "hete", "napja"). */
  agoUnits: Map<string, PeriodUnit>;
  /** Words before a number that add a half to it (Hindi "साढ़े"). */
  halfBefore: Set<string>;
  /** Case endings glued to a number (Turkish "7den"): the number is group 1. */
  numberSuffixRe: RegExp | null;
  months: Map<string, number>;
  monthNeedsContext: Set<string>;
  monthLead: Set<string>;
  rangeConnectors: Set<string>;
  metrics: PhraseIndex<Metric>;
  thresholdUnits: Map<string, Metric | null>;
  comparators: ComparatorRule[];
  negations: Set<string>;
  rank: RankSets;
  trend: PhraseIndex<true>;
  trendLead: Set<string>;
  trigger: PhraseIndex<true>;
  triggerLead: Set<string>;
  triggerConj: Set<string>;
  emotions: PhraseIndex<string>;
  /** Emotion key -> every word that resolves to it (for the executor's text search). */
  emotionWords: Map<string, string[]>;
  /** tokenizer 'segmenter' only: every known phrase, longest first, grouped by first character. */
  segmentPhrases: Map<string, string[]> | null;
  segmenter: Intl.Segmenter | null;
}

const compiledCache = new WeakMap<SearchLanguageTable, Compiled>();

function fold(intl: string, s: string): string {
  return s.toLocaleLowerCase(intl);
}

function cleanMonthName(s: string): string {
  return s.replace(/[.׳’']/g, '');
}

function setOf(intl: string, words: readonly string[]): Set<string> {
  return new Set(words.map((w) => fold(intl, w)));
}

function compile(table: SearchLanguageTable): Compiled {
  const cached = compiledCache.get(table);
  if (cached) return cached;
  const intl = localeDef(table.locale).intl;
  const f = (s: string) => fold(intl, s);

  const metrics = new PhraseIndex<Metric>();
  for (const [phrase, metric] of Object.entries(table.metrics)) metrics.add(f(phrase), metric);

  const stopwords = setOf(intl, [...table.stopwords, ...table.articles]);

  // Emotions: table words first, then the catalogue of that language (label + aliases).
  // Catalogue words that are metric words or stopwords are skipped unless the table lists them.
  const emotions = new PhraseIndex<string>();
  const emotionWords = new Map<string, string[]>();
  const addEmotion = (key: string, word: string, force: boolean) => {
    const w = f(word.trim());
    if (!w) return;
    if (!force && (metrics.hasWord(w) || stopwords.has(w))) return;
    const list = emotionWords.get(key) ?? [];
    if (list.includes(w)) return;
    list.push(w);
    emotionWords.set(key, list);
    emotions.add(w, key);
  };
  for (const e of EMOTIONS) {
    for (const word of table.emotions[e.key] ?? []) addEmotion(e.key, word, true);
    if (hasMessage(table.locale, `emotions.${e.key}.label`)) {
      addEmotion(e.key, t(table.locale, `emotions.${e.key}.label`), false);
      for (const alias of t(table.locale, `emotions.${e.key}.aliases`).split(',')) addEmotion(e.key, alias, false);
    }
  }
  for (const [key, words] of Object.entries(table.emotions)) {
    if (!EMOTIONS.some((e) => e.key === key)) for (const w of words) addEmotion(key, w, true);
  }

  const periodPhrases = new PhraseIndex<PeriodPhraseKind>();
  for (const [phrase, kind] of Object.entries(table.periods.phrases)) periodPhrases.add(f(phrase), kind);

  const months = new Map<string, number>();
  for (const width of ['long', 'short'] as const) {
    monthNames(table.locale, width).forEach((name, i) => months.set(cleanMonthName(f(name)), i));
  }
  for (const [name, i] of Object.entries(table.periods.monthAliases)) months.set(f(name), i);

  const trend = new PhraseIndex<true>();
  for (const w of table.trend.words) trend.add(f(w), true);
  const trigger = new PhraseIndex<true>();
  for (const w of table.trigger.words) trigger.add(f(w), true);

  const numberWords: Record<string, number> = {};
  for (const [w, n] of Object.entries(table.numberWords)) numberWords[f(w)] = n;

  const rank: RankSets = {
    good: setOf(intl, table.rank.good),
    bad: setOf(intl, table.rank.bad),
    high: setOf(intl, table.rank.high),
    low: setOf(intl, table.rank.low),
    markersBefore: setOf(intl, table.rank.markersBefore),
    markersAfter: setOf(intl, table.rank.markersAfter),
    dayWords: setOf(intl, table.rank.dayWords),
    best: setOf(intl, table.rank.bare.best),
    worst: setOf(intl, table.rank.bare.worst),
    bareHigh: setOf(intl, table.rank.bare.high),
    bareLow: setOf(intl, table.rank.bare.low),
  };

  const comparators = table.comparators
    .map((r) => ({ ...r, words: r.words.map(f) }))
    .sort((a, b) => b.words.length - a.words.length);

  const letters = table.numberPrefixLetters.replace(/[\]\\^-]/g, (c) => `\\${c}`);
  const numberPrefixRe = letters ? new RegExp(`^[${letters}]-?(.+)$`) : null;

  const compiled: Compiled = {
    table,
    intl,
    minTermLength: table.tokenizer === 'segmenter' ? 1 : 2,
    stopwords,
    numberWords,
    numberPrefixRe,
    barePrefix: setOf(intl, table.barePrefixTokens),
    articles: setOf(intl, table.articles),
    halfPhrases: table.halfPhrases.map((p) => f(p).split(' ').filter(Boolean)),
    periodPhrases,
    units: new Map(Object.entries(table.periods.units).map(([w, u]) => [f(w), u])),
    lastWords: setOf(intl, table.periods.lastWords),
    dualWords: new Map(Object.entries(table.periods.dualWords).map(([w, u]) => [f(w), u])),
    agoWords: setOf(intl, table.periods.ago.words),
    agoUnits: new Map(Object.entries(table.periods.ago.units ?? {}).map(([w, u]) => [f(w), u])),
    halfBefore: setOf(intl, table.halfBeforeWords ?? []),
    // Case endings glued to a number (letters only, so no escaping is needed).
    numberSuffixRe: table.numberSuffixes?.length ? new RegExp(`^(.+?)(?:${table.numberSuffixes.map((s) => f(s)).join('|')})$`) : null,
    months,
    monthNeedsContext: setOf(intl, table.periods.monthNeedsContext),
    monthLead: setOf(intl, table.periods.monthLeadWords),
    rangeConnectors: setOf(intl, table.periods.rangeConnectors),
    metrics,
    thresholdUnits: new Map(Object.entries(table.thresholdUnits).map(([w, m]) => [f(w), m])),
    comparators,
    negations: setOf(intl, table.negations),
    rank,
    trend,
    trendLead: setOf(intl, table.trend.leadWords),
    trigger,
    triggerLead: setOf(intl, table.trigger.leadWords),
    triggerConj: setOf(intl, table.trigger.conjunctions),
    emotions,
    emotionWords,
    segmentPhrases: null,
    segmenter: null,
  };

  if (table.tokenizer === 'segmenter') {
    const all = new Set<string>();
    const addAll = (words: Iterable<string>) => {
      for (const w of words) {
        const s = f(w).trim();
        if (s) all.add(s);
      }
    };
    addAll(periodPhrases.phrases());
    addAll(compiled.units.keys());
    addAll(compiled.lastWords);
    addAll(compiled.dualWords.keys());
    addAll(compiled.agoWords);
    addAll(months.keys());
    addAll(compiled.monthLead);
    addAll(compiled.rangeConnectors);
    addAll(metrics.phrases());
    addAll(compiled.thresholdUnits.keys());
    for (const r of comparators) addAll(r.words);
    addAll(compiled.negations);
    for (const s of Object.values(rank)) addAll(s);
    addAll(trend.phrases());
    addAll(compiled.trendLead);
    addAll(trigger.phrases());
    addAll(compiled.triggerLead);
    addAll(compiled.triggerConj);
    addAll(emotions.phrases());
    addAll(Object.keys(numberWords));
    for (const h of compiled.halfPhrases) addAll([h.join(' ')]);
    addAll(stopwords);
    const byChar = new Map<string, string[]>();
    for (const p of [...all].sort((a, b) => b.length - a.length)) {
      const list = byChar.get(p[0]) ?? [];
      list.push(p);
      byChar.set(p[0], list);
    }
    compiled.segmentPhrases = byChar;
    try {
      compiled.segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(intl, { granularity: 'word' }) : null;
    } catch {
      compiled.segmenter = null;
    }
  }

  compiledCache.set(table, compiled);
  return compiled;
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

type Role = 'period' | 'trigger' | 'metric' | 'comparator' | 'number' | 'unit' | 'intent' | 'emotion';

interface Token {
  /** Original spelling (used for free-text terms). */
  text: string;
  /** Case-folded form used for every dictionary lookup. */
  norm: string;
  role: Role | null;
}

/** Candidate dictionary forms of a token: as-is and with one table prefix removed. */
function prefixFormsOf(c: Compiled, norm: string): string[] {
  const forms = [norm];
  for (const p of c.table.prefixes) {
    const pf = fold(c.intl, p);
    if (norm.startsWith(pf) && norm.length - pf.length >= 2) forms.push(norm.slice(pf.length));
  }
  return forms;
}

/** The token without a leading article prefix ('הרוח' -> 'רוח'), or itself. */
function articleStripped(c: Compiled, norm: string): string {
  for (const a of c.table.articlePrefixes) {
    const af = fold(c.intl, a);
    if (norm.startsWith(af) && norm.length > af.length) return norm.slice(af.length);
  }
  return norm;
}

function isStopword(c: Compiled, norm: string): boolean {
  return prefixFormsOf(c, norm).some((f) => c.stopwords.has(f));
}

const QUOTE_PATTERNS: RegExp[] = [
  /["“”„«»]([^"“”„«»]{1,120})["“”„«»]/g,
  /「([^「」]{1,120})」/g,
  /『([^『』]{1,120})』/g,
];

/**
 * Trims, collapses spaces, pulls out quoted phrases and strips punctuation
 * (keeping the separators of dates and decimal numbers). Language-neutral.
 */
export function normaliseQuery(query: string): { text: string; quoted: string[] } {
  let text = String(query ?? '')
    .normalize('NFC')
    // Full-width digits (typed by Japanese / Chinese input methods: "５時間") count as numbers.
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[֑-ׇ]/g, '') // niqqud / cantillation
    .replace(/[ً-ْـ]/g, '') // Arabic harakat / tatweel
    // A quote between two Hebrew letters is an abbreviation mark (צה"ל, typed with the ASCII
    // key or the Hebrew gershayim), not the start of a quoted phrase: keep the word whole.
    .replace(/(?<=[א-ת])["״](?=[א-ת])/g, '')
    // An apostrophe inside a Latin word (don't, I'm) joins the word instead of splitting it.
    .replace(/(?<=\p{L})['’](?=\p{L})/gu, '')
    // A date typed with spaces after its dots (Czech, German, Polish: "7. 9. 2026") is one date.
    .replace(/(?<!\d)(\d{1,2})\.\s+(\d{1,2})\.\s*(\d{4})(?!\d)/g, (_m, d: string, mo: string, y: string) => `${d}.${mo}.${y}`)
    .replace(/\s+/g, ' ')
    .trim();
  const quoted: string[] = [];
  for (const re of QUOTE_PATTERNS) {
    text = text.replace(re, (_m, inner: string) => {
      const q = inner.replace(/\s+/g, ' ').trim();
      if (q) quoted.push(q);
      return ' ';
    });
  }
  text = text
    .replace(/[׳״]/g, '') // geresh/gershayim inside abbreviations (צה"ל) - keep the word whole
    .replace(/[?!,;:()[\]{}"'“”‘’«»„…？！，。、；：（）「」『』【】؟،؛¿¡]/g, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ') // dots that are not decimal points / date separators
    .replace(/\s+/g, ' ')
    .trim();
  return { text, quoted };
}

function tokenizeSpaces(text: string, c: Compiled): Token[] {
  return text
    .split(' ')
    .filter((s) => s && !/^[-–—]+$/.test(s))
    .map((s) => ({ text: s, norm: fold(c.intl, s), role: null }));
}

const NUMERIC_RUN = /\d+(?:[./-]\d+)*(?:[.,]\d+)?/g;

/**
 * Segmenter tokenizer (zh/ja/th): the text is cut at every table phrase found as a
 * substring (longest first); the spans in between are split into words with
 * Intl.Segmenter, keeping numbers and dates whole.
 */
function tokenizeSegmented(text: string, c: Compiled): Token[] {
  const lower = fold(c.intl, text);
  const src = lower.length === text.length ? text : lower;
  const out: Token[] = [];
  const push = (t: string, n: string) => {
    if (t.trim()) out.push({ text: t.trim(), norm: n.trim(), role: null });
  };
  const pushWords = (t: string, n: string) => {
    if (!c.segmenter) {
      for (const ch of t) push(ch, fold(c.intl, ch));
      return;
    }
    for (const seg of c.segmenter.segment(t)) {
      if (seg.isWordLike || /[\p{L}\p{N}]/u.test(seg.segment)) push(seg.segment, fold(c.intl, seg.segment));
    }
    void n;
  };
  const pushSpan = (t: string, n: string) => {
    let last = 0;
    for (const m of t.matchAll(NUMERIC_RUN)) {
      const start = m.index ?? 0;
      if (start > last) pushWords(t.slice(last, start), n.slice(last, start));
      push(m[0], m[0]);
      last = start + m[0].length;
    }
    if (last < t.length) pushWords(t.slice(last), n.slice(last));
  };
  let i = 0;
  let spanStart = 0;
  const flush = (end: number) => {
    if (end > spanStart) pushSpan(src.slice(spanStart, end), lower.slice(spanStart, end));
  };
  while (i < lower.length) {
    const ch = lower[i];
    if (/\s/.test(ch)) {
      flush(i);
      i++;
      spanStart = i;
      continue;
    }
    let hit: string | null = null;
    for (const p of c.segmentPhrases?.get(ch) ?? []) {
      if (lower.startsWith(p, i)) {
        hit = p;
        break;
      }
    }
    if (hit) {
      flush(i);
      push(src.slice(i, i + hit.length), hit);
      i += hit.length;
      spanStart = i;
      continue;
    }
    i++;
  }
  flush(lower.length);
  return out;
}

function tokenize(text: string, c: Compiled): Token[] {
  return c.table.tokenizer === 'segmenter' ? tokenizeSegmented(text, c) : tokenizeSpaces(text, c);
}

/** Token texts a table produces for `text` (exposed for the tokenizer tests). */
export function tokenizeForTable(text: string, table: SearchLanguageTable): string[] {
  return tokenize(normaliseQuery(text).text, compile(table)).map((tk) => tk.text);
}

/** Marks tokens [start, start + len) with `role`. */
function mark(tokens: Token[], start: number, len: number, role: Role): void {
  for (let i = start; i < start + len && i < tokens.length; i++) if (i >= 0) tokens[i].role = role;
}

function freeAt(tokens: Token[], i: number): Token | undefined {
  const tk = tokens[i];
  return tk && tk.role === null ? tk : undefined;
}

/** True when the free tokens at `i` equal the sequence (case-folded words). */
function matchSeq(tokens: Token[], i: number, seq: string[]): boolean {
  for (let k = 0; k < seq.length; k++) {
    const tk = freeAt(tokens, i + k);
    if (!tk || tk.norm !== seq[k]) return false;
  }
  return true;
}

type Usable = (tk: Token | undefined) => tk is Token;
const isFree: Usable = (tk): tk is Token => !!tk && tk.role === null;

/**
 * Longest phrase of `index` starting at token `i`: the first word may match after a
 * table prefix was stripped, the following words after an article prefix was stripped.
 */
function matchPhraseAt<V>(c: Compiled, tokens: Token[], i: number, index: PhraseIndex<V>, usable: Usable = isFree): { value: V; len: number } | null {
  const first = tokens[i];
  if (!usable(first)) return null;
  let best: { value: V; len: number } | null = null;
  for (const form of prefixFormsOf(c, first.norm)) {
    for (const entry of index.candidates(form)) {
      if (best && entry.words.length <= best.len) continue;
      let ok = true;
      for (let k = 1; k < entry.words.length; k++) {
        const tk = tokens[i + k];
        if (!usable(tk) || (tk.norm !== entry.words[k] && articleStripped(c, tk.norm) !== entry.words[k])) {
          ok = false;
          break;
        }
      }
      if (ok) best = { value: entry.value, len: entry.words.length };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

function numberLiteral(c: Compiled, s: string): number | null {
  if (/^\d+(?:[.,]\d+)?$/.test(s)) return Number(s.replace(',', '.'));
  const word = c.numberWords[s];
  return word === undefined ? null : word;
}

/** Number in a token: digits or a number word, optionally with an attached prefix letter (מ-5, מחמש, ב-3). */
function numberOf(c: Compiled, norm: string): number | null {
  const direct = numberLiteral(c, norm);
  if (direct != null) return direct;
  // A number with a case ending glued to it: Turkish "7den" (from 7), as in "7den fazla".
  if (c.numberSuffixRe) {
    const m = c.numberSuffixRe.exec(norm);
    if (m) {
      const n = numberLiteral(c, m[1]);
      if (n != null) return n;
    }
  }
  // A number word with the article ("الثلاثة" - the three, in "الأشهر الثلاثة الأخيرة").
  const stripped = articleStripped(c, norm);
  if (stripped !== norm) {
    const n = numberLiteral(c, stripped);
    if (n != null) return n;
  }
  if (!c.numberPrefixRe) return null;
  const m = c.numberPrefixRe.exec(norm);
  return m ? numberLiteral(c, m[1]) : null;
}

/** Number in a token according to the table of `locale` (tests). */
export function numberFromToken(token: string, locale: Locale = DEFAULT_LOCALE): number | null {
  const c = compile(getSearchTable(locale));
  return numberOf(c, fold(c.intl, token));
}

/** Dictionary forms of a token according to the table of `locale` (tests). */
export function prefixForms(token: string, locale: Locale = DEFAULT_LOCALE): string[] {
  const c = compile(getSearchTable(locale));
  return prefixFormsOf(c, fold(c.intl, token));
}

// ---------------------------------------------------------------------------
// Period detection
// ---------------------------------------------------------------------------

/** Language-neutral description of the detected period; rendered per UI locale by `periodLabelFor`. */
export type PeriodDesc =
  | { kind: PeriodPhraseKind }
  | { kind: 'lastN'; n: number; unit: PeriodUnit }
  | { kind: 'ago'; n: number; unit: PeriodUnit }
  | { kind: 'calendarMonth'; month: number; year: number }
  | { kind: 'date'; iso: string }
  | { kind: 'range'; from: string; to: string };

interface PeriodHit {
  from: string;
  to: string;
  desc: PeriodDesc;
}

const UNIT_DAYS: Record<PeriodUnit, number> = { day: 1, week: 7, month: 30, year: 365 };
const UNIT_KEY: Record<PeriodUnit, string> = { day: 'Days', week: 'Weeks', month: 'Months', year: 'Years' };

function pad2(n: number | string): string {
  return String(n).padStart(2, '0');
}

function isoOf(year: string, month: string, day: string): string | null {
  const y = year.length === 2 ? `20${year}` : year;
  const iso = `${y}-${pad2(month)}-${pad2(day)}`;
  return isIsoDate(iso) ? iso : null;
}

/** ISO date from a token like 07/08/2026, 7.8.2026, 2026-08-07 (with an optional attached prefix letter). */
function dateFromToken(c: Compiled, token: string): string | null {
  let s = token;
  if (c.numberPrefixRe) {
    const m = c.numberPrefixRe.exec(s);
    if (m && /^\d/.test(m[1])) s = m[1];
  }
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(s);
  if (m) return isoOf(m[1], m[2], m[3]);
  m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{2}|\d{4})$/.exec(s);
  if (!m) return null;
  return c.table.dateOrder === 'mdy' ? isoOf(m[3], m[1], m[2]) : isoOf(m[3], m[2], m[1]);
}

function lastNDays(today: string, n: number, desc: PeriodDesc): PeriodHit {
  return { from: addDays(today, -(Math.max(1, n) - 1)), to: today, desc };
}

function unitOf(c: Compiled, norm: string, allowArticle: boolean): PeriodUnit | null {
  const direct = c.units.get(norm);
  if (direct) return direct;
  if (!allowArticle) return null;
  const stripped = articleStripped(c, norm);
  return stripped === norm ? null : (c.units.get(stripped) ?? null);
}

function dualOf(c: Compiled, norm: string): PeriodUnit | null {
  for (const form of prefixFormsOf(c, norm)) {
    const unit = c.dualWords.get(form);
    if (unit) return unit;
  }
  return null;
}

/** Explicit dates: "between 1/8/2026 and 15/8/2026", "from 2026-08-01 to 2026-08-15", "on 3/9/2026". */
function detectExplicitDates(c: Compiled, tokens: Token[]): PeriodHit | null {
  const found: { index: number; iso: string }[] = [];
  for (let i = 0; i < tokens.length && found.length < 2; i++) {
    const tk = freeAt(tokens, i);
    if (!tk) continue;
    const iso = dateFromToken(c, tk.norm);
    if (iso) found.push({ index: i, iso });
  }
  if (!found.length) return null;
  for (const f of found) mark(tokens, f.index, 1, 'period');
  const first = found[0];
  // Connector right before the first date ("between", "from", "on", "בין", "מ-")
  const before = freeAt(tokens, first.index - 1);
  if (before && c.rangeConnectors.has(before.norm)) mark(tokens, first.index - 1, 1, 'period');
  if (found.length === 1) return { from: first.iso, to: first.iso, desc: { kind: 'date', iso: first.iso } };
  const second = found[1];
  // Connectors between the dates ("and", "to", "until", "ל-", "עד")
  let allConnectors = true;
  for (let i = first.index + 1; i < second.index; i++) {
    if (!c.rangeConnectors.has(tokens[i].norm)) allConnectors = false;
  }
  if (allConnectors) for (let i = first.index + 1; i < second.index; i++) mark(tokens, i, 1, 'period');
  const [from, to] = [first.iso, second.iso].sort();
  return { from, to, desc: { kind: 'range', from, to } };
}

/** "לפני שבוע" / "a week ago", "3 days ago", "two months back", "két hete" -> that single day. */
function detectAgo(c: Compiled, tokens: Token[], today: string): PeriodHit | null {
  // Unit words that mean "ago" by themselves (Hungarian "két hete", "három napja").
  for (let i = 0; i < tokens.length && c.agoUnits.size; i++) {
    const tk = freeAt(tokens, i);
    const unit = tk ? c.agoUnits.get(tk.norm) : undefined;
    if (!unit) continue;
    const prev = freeAt(tokens, i - 1);
    const n = prev ? numberOf(c, prev.norm) : null;
    if (n == null || n < 1 || n > 1000) continue;
    const day = addDays(today, -n * UNIT_DAYS[unit]);
    mark(tokens, i - 1, 2, 'period');
    return { from: day, to: day, desc: { kind: 'ago', n, unit } };
  }
  const before = c.table.periods.ago.position === 'before';
  for (let i = 0; i < tokens.length; i++) {
    const ago = freeAt(tokens, i);
    if (!ago || !c.agoWords.has(ago.norm)) continue;
    const hit = (n: number, unit: PeriodUnit, start: number, len: number): PeriodHit => {
      const day = addDays(today, -n * UNIT_DAYS[unit]);
      mark(tokens, start, len, 'period');
      return { from: day, to: day, desc: { kind: 'ago', n, unit } };
    };
    if (before) {
      const a = freeAt(tokens, i + 1);
      if (!a) continue;
      const dual = dualOf(c, a.norm);
      if (dual) return hit(2, dual, i, 2);
      const n = numberOf(c, a.norm);
      const b = freeAt(tokens, i + 2);
      const unitAfterNumber = n != null && b ? unitOf(c, b.norm, true) : null;
      if (n != null && unitAfterNumber) return hit(n, unitAfterNumber, i, 3);
      const unit = unitOf(c, a.norm, false);
      if (unit) return hit(1, unit, i, 2);
    } else {
      const a = freeAt(tokens, i - 1);
      if (!a) continue;
      const dual = dualOf(c, a.norm);
      if (dual) {
        const art = freeAt(tokens, i - 2);
        const extra = art && c.articles.has(art.norm) ? 1 : 0;
        return hit(2, dual, i - 1 - extra, 2 + extra);
      }
      const unit = unitOf(c, a.norm, false);
      if (!unit) continue;
      const b = freeAt(tokens, i - 2);
      const n = b ? numberOf(c, b.norm) : null;
      if (n != null) return hit(n, unit, i - 2, 3);
      const extra = b && c.articles.has(b.norm) ? 1 : 0;
      return hit(1, unit, i - 1 - extra, 2 + extra);
    }
  }
  return null;
}

/**
 * Words that may stand between a number and its unit: Romanian says "20 de zile" for numbers from
 * 20 on ("ultimele 20 de zile" - the last 20 days).
 */
const NUMBER_UNIT_FILLERS = new Set(['de']);

/**
 * "ב-5 הימים האחרונים", "בשלושת החודשים האחרונים", "the last 3 days", "past two weeks" - in every
 * natural word order around the number N:
 *   <N> <unit> <last>      "5 הימים האחרונים"
 *   <last> <N> <unit>      "the last 3 days", "gli ultimi 3 mesi", "آخر ثلاثة أشهر"
 *   <N> <last> <unit>      "les 3 derniers mois", "los 3 últimos meses", "as duas últimas semanas", "три последних месяца"
 *   <last> <N> de <unit>   "ultimele 20 de zile"
 *   <unit> <N> <last>      "الأشهر الثلاثة الأخيرة", "الأيام السبعة الأخيرة"
 */
function detectRelativeCount(c: Compiled, tokens: Token[], today: string): PeriodHit | null {
  const isLast = (tk: Token | null | undefined) => !!tk && c.lastWords.has(tk.norm);
  const unitAt = (j: number) => {
    const tk = freeAt(tokens, j);
    return tk ? unitOf(c, tk.norm, true) : null;
  };
  for (let i = 0; i < tokens.length; i++) {
    const a = freeAt(tokens, i);
    if (!a) continue;
    const n = numberOf(c, a.norm);
    if (n == null || n < 1 || n > 1000) continue;
    const next = freeAt(tokens, i + 1);
    const prev = freeAt(tokens, i - 1);
    let found: { start: number; len: number; unit: PeriodUnit } | null = null;
    const unitNext = unitAt(i + 1);
    if (unitNext && isLast(freeAt(tokens, i + 2))) found = { start: i, len: 3, unit: unitNext };
    else if (unitNext && isLast(prev)) found = { start: i - 1, len: 3, unit: unitNext };
    else if (isLast(next) && unitAt(i + 2)) found = { start: i, len: 3, unit: unitAt(i + 2)! };
    else if (isLast(prev) && next && NUMBER_UNIT_FILLERS.has(next.norm) && unitAt(i + 2)) found = { start: i - 1, len: 4, unit: unitAt(i + 2)! };
    else if (unitAt(i - 1) && isLast(next)) found = { start: i - 1, len: 3, unit: unitAt(i - 1)! };
    if (!found) continue;
    mark(tokens, found.start, found.len, 'period');
    return lastNDays(today, n * UNIT_DAYS[found.unit], { kind: 'lastN', n, unit: found.unit });
  }
  return null;
}

/** "בשבועיים האחרונים", "בחודשיים", "the last fortnight". */
function detectDual(c: Compiled, tokens: Token[], today: string): PeriodHit | null {
  for (let i = 0; i < tokens.length; i++) {
    const tk = freeAt(tokens, i);
    if (!tk) continue;
    const dual = dualOf(c, tk.norm);
    if (!dual) continue;
    const next = freeAt(tokens, i + 1);
    const prev = freeAt(tokens, i - 1);
    if (next && c.lastWords.has(next.norm)) mark(tokens, i, 2, 'period');
    else if (prev && c.lastWords.has(prev.norm)) mark(tokens, i - 1, 2, 'period');
    else mark(tokens, i, 1, 'period');
    return lastNDays(today, 2 * UNIT_DAYS[dual], { kind: 'lastN', n: 2, unit: dual });
  }
  return null;
}

function monthOfToken(c: Compiled, norm: string): number | undefined {
  for (const form of prefixFormsOf(c, norm)) {
    const m = c.months.get(cleanMonthName(form));
    if (m !== undefined) return m;
  }
  return undefined;
}

/** "ביולי", "in July", "בחודש יולי", "August 2025" -> the whole month (previous year when the month is still ahead). */
function detectMonthName(c: Compiled, tokens: Token[], today: string): PeriodHit | null {
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7)) - 1;
  for (let i = 0; i < tokens.length; i++) {
    const tk = freeAt(tokens, i);
    if (!tk) continue;
    const month = monthOfToken(c, tk.norm);
    if (month === undefined) continue;
    const prev = freeAt(tokens, i - 1);
    let next = freeAt(tokens, i + 1);
    const hasLead = !!prev && c.monthLead.has(prev.norm);
    let hasYear = !!next && /^\d{4}$/.test(next.norm);
    // One connector word between the month and the year: "agosto de 2025", "τον Αύγουστο του 2025".
    let yearGap = 0;
    if (!hasYear && next && isStopword(c, next.norm)) {
      const after = freeAt(tokens, i + 2);
      if (after && /^(19|20)\d{2}$/.test(after.norm)) {
        next = after;
        hasYear = true;
        yearGap = 1;
      }
    }
    if (c.monthNeedsContext.has(tk.norm) && !hasLead && !hasYear) continue;
    let start = i;
    let len = 1;
    if (hasLead) {
      start = i - 1;
      len = 2;
    }
    let year: number;
    if (hasYear && next) {
      year = Number(next.norm);
      len += 1 + yearGap;
    } else {
      year = month > todayMonth ? todayYear - 1 : todayYear;
    }
    mark(tokens, start, len, 'period');
    const mm = pad2(month + 1);
    return {
      from: `${year}-${mm}-01`,
      to: `${year}-${mm}-${pad2(daysInMonth(year, month + 1))}`,
      desc: { kind: 'calendarMonth', month, year },
    };
  }
  return null;
}

function phraseHit(kind: PeriodPhraseKind, today: string): PeriodHit {
  const desc: PeriodDesc = { kind };
  switch (kind) {
    case 'today':
      return { from: today, to: today, desc };
    case 'yesterday': {
      const d = addDays(today, -1);
      return { from: d, to: d, desc };
    }
    case 'twoDaysAgo': {
      const d = addDays(today, -2);
      return { from: d, to: d, desc };
    }
    case 'week':
      return lastNDays(today, 7, desc);
    case 'month':
      return lastNDays(today, 30, desc);
    case 'halfYear':
      return lastNDays(today, 180, desc);
    case 'year':
      return lastNDays(today, 365, desc);
    case 'startYear':
      return { from: `${today.slice(0, 4)}-01-01`, to: today, desc };
    case 'startMonth':
      return { from: `${today.slice(0, 7)}-01`, to: today, desc };
    case 'recent':
      return lastNDays(today, 7, desc);
  }
}

/** Fixed phrases ("last month", "בשבוע האחרון"): the longest match anywhere in the question wins. */
function detectPhrase(c: Compiled, tokens: Token[], today: string): PeriodHit | null {
  let best: { index: number; len: number; kind: PeriodPhraseKind } | null = null;
  for (let i = 0; i < tokens.length; i++) {
    const hit = matchPhraseAt(c, tokens, i, c.periodPhrases);
    if (hit && (!best || hit.len > best.len)) best = { index: i, len: hit.len, kind: hit.value };
  }
  if (!best) return null;
  mark(tokens, best.index, best.len, 'period');
  return phraseHit(best.kind, today);
}

function detectPeriod(c: Compiled, tokens: Token[], today: string): PeriodHit | null {
  return (
    detectExplicitDates(c, tokens) ??
    detectAgo(c, tokens, today) ??
    detectRelativeCount(c, tokens, today) ??
    detectDual(c, tokens, today) ??
    detectMonthName(c, tokens, today) ??
    detectPhrase(c, tokens, today)
  );
}

// ---------------------------------------------------------------------------
// Metric, comparator, intent, emotions
// ---------------------------------------------------------------------------

function detectMetric(c: Compiled, tokens: Token[]): Metric | null {
  let metric: Metric | null = null;
  for (let i = 0; i < tokens.length; i++) {
    const hit = matchPhraseAt(c, tokens, i, c.metrics);
    if (!hit) continue;
    mark(tokens, i, hit.len, 'metric');
    if (!metric) metric = hit.value;
  }
  return metric;
}

interface ComparatorHit {
  comparator: Comparator;
  threshold: number;
  unitMetric: Metric | null;
}

/** Number following a comparator whose last word is at `i` (the next token may be a bare prefix like "מ-"). */
function numberAfter(c: Compiled, tokens: Token[], i: number): { value: number; index: number } | null {
  const next = freeAt(tokens, i + 1);
  if (!next) return null;
  if (c.barePrefix.has(next.norm)) {
    const after = freeAt(tokens, i + 2);
    const v = after ? numberOf(c, after.norm) : null;
    return v == null ? null : { value: v, index: i + 2 };
  }
  const v = numberOf(c, next.norm);
  return v == null ? null : { value: v, index: i + 1 };
}

function detectComparator(c: Compiled, tokens: Token[]): ComparatorHit | null {
  return detectComparatorBefore(c, tokens) ?? detectComparatorAfter(c, tokens);
}

/** Half phrase ('and a half') at `cursor`: marks it and returns its length, or 0. */
function halfAt(c: Compiled, tokens: Token[], cursor: number): number {
  for (const half of c.halfPhrases) {
    if (matchSeq(tokens, cursor, half)) {
      mark(tokens, cursor, half.length, 'number');
      return half.length;
    }
  }
  return 0;
}

/** Comparator phrase, then the number: 'less than 5 hours', 'פחות מחמש שעות'. */
function detectComparatorBefore(c: Compiled, tokens: Token[]): ComparatorHit | null {
  for (let i = 0; i < tokens.length; i++) {
    if (!freeAt(tokens, i)) continue;
    for (const rule of c.comparators) {
      if (rule.position === 'after') continue;
      if (!matchSeq(tokens, i, rule.words)) continue;
      const last = i + rule.words.length - 1;
      if (rule.numberPrefix) {
        const next = freeAt(tokens, last + 1);
        if (!next || !next.norm.startsWith(fold(c.intl, rule.numberPrefix))) continue;
      }
      const num = numberAfter(c, tokens, last);
      if (!num) continue;
      mark(tokens, i, num.index - i + 1, 'comparator');
      tokens[num.index].role = 'number';
      let threshold = num.value;
      let cursor = num.index + 1;
      const half = halfAt(c, tokens, cursor);
      if (half) {
        threshold += 0.5;
        cursor += half;
      }
      // "Seven and a half" said with a word BEFORE the number (Hindi "साढ़े सात").
      if (!half && isHalfBefore(c, tokens, num.index)) threshold += 0.5;
      let unitMetric: Metric | null = null;
      const unit = freeAt(tokens, cursor);
      if (unit && c.thresholdUnits.has(unit.norm)) {
        unitMetric = c.thresholdUnits.get(unit.norm) ?? null;
        mark(tokens, cursor, 1, 'unit');
        // ...or AFTER the unit (Thai "ห้าชั่วโมงครึ่ง" - five hours [and a] half).
        const halfAfterUnit = half ? 0 : halfAt(c, tokens, cursor + 1);
        if (halfAfterUnit) {
          threshold += 0.5;
          mark(tokens, cursor + 1, halfAfterUnit, 'number');
        }
      }
      return { comparator: rule.comparator, threshold, unitMetric };
    }
  }
  return null;
}

/**
 * True when the token right before the number at `index` is a "half" word that adds 0.5 to it
 * (Hindi "साढ़े सात" = 7.5); the word is marked as part of the number.
 */
function isHalfBefore(c: Compiled, tokens: Token[], index: number): boolean {
  if (!c.halfBefore.size) return false;
  const prev = freeAt(tokens, index - 1);
  if (!prev || !c.halfBefore.has(prev.norm)) return false;
  mark(tokens, index - 1, 1, 'number');
  return true;
}

/**
 * The number, an optional half and unit, then the comparator phrase: '5時間未満',
 * 'पाँच घंटे से कम', '5 saatten az', '6 hours or less' (rules with position 'after').
 */
function detectComparatorAfter(c: Compiled, tokens: Token[]): ComparatorHit | null {
  const rules = c.comparators.filter((r) => r.position === 'after');
  if (!rules.length) return null;
  for (let i = 0; i < tokens.length; i++) {
    const tk = freeAt(tokens, i);
    const value = tk ? numberOf(c, tk.norm) : null;
    if (value == null) continue;
    let cursor = i + 1;
    let halfLen = 0;
    for (const h of c.halfPhrases) {
      if (matchSeq(tokens, cursor, h)) {
        halfLen = h.length;
        break;
      }
    }
    cursor += halfLen;
    const unit = freeAt(tokens, cursor);
    const hasUnit = Boolean(unit && c.thresholdUnits.has(unit.norm));
    const phraseAt = hasUnit ? cursor + 1 : cursor;
    const rule = rules.find((r) => matchSeq(tokens, phraseAt, r.words));
    if (!rule) continue;
    tokens[i].role = 'number';
    if (halfLen) mark(tokens, i + 1, halfLen, 'number');
    const halfBefore = !halfLen && isHalfBefore(c, tokens, i);
    let unitMetric: Metric | null = null;
    if (hasUnit && unit) {
      unitMetric = c.thresholdUnits.get(unit.norm) ?? null;
      mark(tokens, cursor, 1, 'unit');
    }
    mark(tokens, phraseAt, rule.words.length, 'comparator');
    return { comparator: rule.comparator, threshold: value + (halfLen || halfBefore ? 0.5 : 0), unitMetric };
  }
  return null;
}

type RankKind = 'best' | 'worst' | 'high' | 'low';

function detectRank(c: Compiled, tokens: Token[]): RankKind | null {
  const r = c.rank;
  const classify = (norm: string, goodBadOnly = false): RankKind | null => {
    for (const w of [norm, articleStripped(c, norm)]) {
      if (r.good.has(w)) return 'best';
      if (r.bad.has(w)) return 'worst';
      if (!goodBadOnly && r.high.has(w)) return 'high';
      if (!goodBadOnly && r.low.has(w)) return 'low';
    }
    return null;
  };
  for (let i = 0; i < tokens.length; i++) {
    const tk = freeAt(tokens, i);
    if (!tk) continue;
    const next = freeAt(tokens, i + 1);
    // "הכי טוב", "most difficult"
    if (r.markersBefore.has(tk.norm) && next) {
      const kind = classify(next.norm);
      if (kind) {
        mark(tokens, i, 2, 'intent');
        return kind;
      }
    }
    // "הטובים ביותר"
    if (next && r.markersAfter.has(next.norm)) {
      const kind = classify(tk.norm);
      if (kind) {
        mark(tokens, i, 2, 'intent');
        return kind;
      }
    }
    // "הימים הקשים" / "good days"
    if (r.dayWords.has(tk.norm) && next) {
      const kind = classify(next.norm, true);
      if (kind) {
        mark(tokens, i, 2, 'intent');
        return kind;
      }
    }
    if (next && r.dayWords.has(next.norm)) {
      const kind = classify(tk.norm, true);
      if (kind) {
        mark(tokens, i, 2, 'intent');
        return kind;
      }
    }
    // "best", "worst", "highest", "שיא"
    const bare: RankKind | null = r.best.has(tk.norm) ? 'best' : r.worst.has(tk.norm) ? 'worst' : r.bareHigh.has(tk.norm) ? 'high' : r.bareLow.has(tk.norm) ? 'low' : null;
    if (bare) {
      mark(tokens, i, 1, 'intent');
      return bare;
    }
  }
  return null;
}

/** Absorbs the lead words ("how", "when did I") standing right before token `i`. */
function absorbLead(tokens: Token[], i: number, lead: Set<string>, role: Role): void {
  for (let k = i - 1; k >= 0; k--) {
    const tk = freeAt(tokens, k);
    if (!tk || !lead.has(tk.norm)) break;
    tk.role = role;
  }
}

function detectTrend(c: Compiled, tokens: Token[]): boolean {
  for (let i = 0; i < tokens.length; i++) {
    const hit = matchPhraseAt(c, tokens, i, c.trend);
    if (!hit) continue;
    absorbLead(tokens, i, c.trendLead, 'intent');
    mark(tokens, i, hit.len, 'intent');
    return true;
  }
  return false;
}

/** Index of the "what did I write" trigger word (wrote / mentioned / כתבתי), or -1. */
function detectTrigger(c: Compiled, tokens: Token[]): number {
  for (let i = 0; i < tokens.length; i++) {
    const hit = matchPhraseAt(c, tokens, i, c.trigger);
    if (!hit) continue;
    absorbLead(tokens, i, c.triggerLead, 'trigger');
    mark(tokens, i, hit.len, 'trigger');
    return i + hit.len - 1;
  }
  return -1;
}

const emotionUsable: Usable = (tk): tk is Token => !!tk && (tk.role === null || tk.role === 'metric');

/** Emotion keys mentioned in the question (table words + catalogue, with prefixes and multi-word forms). */
function detectEmotions(c: Compiled, tokens: Token[]): string[] {
  const keys: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const hit = matchPhraseAt(c, tokens, i, c.emotions, emotionUsable);
    if (!hit) continue;
    mark(tokens, i, hit.len, 'emotion');
    if (!keys.includes(hit.value)) keys.push(hit.value);
  }
  return keys;
}

function isNegation(c: Compiled, tk: Token): boolean {
  return prefixFormsOf(c, tk.norm).some((f) => c.negations.has(f));
}

// ---------------------------------------------------------------------------
// Text terms
// ---------------------------------------------------------------------------

function keepTerm(c: Compiled, text: string, norm: string): boolean {
  return text.length >= c.minTermLength && !isStopword(c, norm) && numberOf(c, norm) == null;
}

function significantTerms(c: Compiled, tokens: Token[], includeMetricWords: boolean): string[] {
  const out: string[] = [];
  for (const tk of tokens) {
    if (tk.role !== null && !(includeMetricWords && tk.role === 'metric')) continue;
    if (!keepTerm(c, tk.text, tk.norm)) continue;
    if (!out.includes(tk.text)) out.push(tk.text);
  }
  return out;
}

/** Terms after the text trigger; a leading conjunction ("that", "ש", "שאני") on the first word is dropped. */
function termsAfterTrigger(c: Compiled, tokens: Token[], triggerIndex: number): string[] {
  const after = tokens.slice(triggerIndex + 1).filter((tk) => tk.role === null);
  const source = after.length ? after : tokens.filter((tk) => tk.role === null);
  const words = source.map((tk) => ({ text: tk.text, norm: tk.norm }));
  if (words.length && after.length) {
    const first = words[0];
    const prefix = c.table.trigger.conjunctionPrefix ? fold(c.intl, c.table.trigger.conjunctionPrefix) : null;
    if (c.triggerConj.has(first.norm)) words.shift();
    else if (prefix && first.norm.startsWith(prefix) && first.norm.length > prefix.length + 1) {
      const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-?`, 'u');
      words[0] = { text: first.text.replace(re, ''), norm: first.norm.replace(re, '') };
    }
  }
  const out: string[] = [];
  for (const w of words) {
    if (!keepTerm(c, w.text, w.norm)) continue;
    if (!out.includes(w.text)) out.push(w.text);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rendering (UI locale)
// ---------------------------------------------------------------------------

/** Joins items with the catalogue's list separator (", " in most languages). */
export function joinList(locale: Locale, items: string[]): string {
  return items.join(t(locale, 'searchAnswers.listSeparator'));
}

/** Quotes each term ('"work"') and joins them. */
export function quoteList(locale: Locale, terms: string[]): string {
  return joinList(
    locale,
    terms.map((term) => t(locale, 'searchAnswers.quoted', { term })),
  );
}

const listFormatCache = new Map<string, Intl.ListFormat | null>();

/** "A or B" / "עייף או לחוץ" in the locale (Intl.ListFormat disjunction). */
export function joinOr(locale: Locale, items: string[]): string {
  const tag = localeDef(locale).intl;
  let lf = listFormatCache.get(tag);
  if (lf === undefined) {
    try {
      lf = new Intl.ListFormat(tag, { type: 'disjunction' });
    } catch {
      lf = null;
    }
    listFormatCache.set(tag, lf);
  }
  return lf ? lf.format(items) : items.join(' / ');
}

/**
 * The emotion's label in the UI locale ('emotions.<key>.label'), or the key itself, as a word inside
 * a sentence: labels are capitalised for chips and pickers ("Stressed", "Gestresst", "Радость"), but the
 * search answers put them mid-sentence ("You felt stressed on 20 days"), so they are lower-cased with the
 * locale's rules (no template of any language starts with the emotion; scripts without case are unchanged).
 */
export function emotionLabel(locale: Locale, key: string): string {
  const k = `emotions.${key}.label`;
  const label = t(locale, k);
  return label === k ? key : label.toLocaleLowerCase(localeDef(locale).intl);
}

/** Every word (label, aliases, catalogue) that resolves to `key` in `table`'s language - for text matching. */
export function emotionSearchWords(table: SearchLanguageTable, key: string): string[] {
  return compile(table).emotionWords.get(key) ?? [];
}

/** Locale-aware "less than 5" / "פחות מ-5". */
export function comparatorText(locale: Locale, comparator: Comparator, threshold: number): string {
  return t(locale, `searchAnswers.comparator.${comparator}`, { value: formatNumber(locale, threshold, 1) });
}

/** ParsedQuery.periodLabel when no period was detected ("כל התקופה" / "all time"). */
export function allTimeLabel(locale: Locale): string {
  return t(locale, 'searchAnswers.period.all');
}

/** The period as a sentence part: the detected label, or "בכל התקופה" / "across the whole diary". */
export function periodPhrase(locale: Locale, parsed: Pick<ParsedQuery, 'from' | 'periodLabel'>): string {
  return parsed.from ? parsed.periodLabel : t(locale, 'searchAnswers.period.allPhrase');
}

/** Renders a period description in the UI locale ("in the last 3 months", "ביולי 2026"). */
export function periodLabelFor(locale: Locale, desc: PeriodDesc): string {
  switch (desc.kind) {
    case 'lastN':
      return t(locale, `searchAnswers.period.last${UNIT_KEY[desc.unit]}`, { count: desc.n });
    case 'ago':
      return t(locale, `searchAnswers.period.ago${UNIT_KEY[desc.unit]}`, { count: desc.n });
    case 'calendarMonth':
      return t(locale, 'searchAnswers.period.calendarMonth', { month: monthNames(locale)[desc.month], year: desc.year });
    case 'date':
      return t(locale, 'searchAnswers.period.onDate', { date: formatDate(locale, desc.iso, 'short') });
    case 'range':
      return t(locale, 'searchAnswers.period.between', {
        from: formatDate(locale, desc.from, 'short'),
        to: formatDate(locale, desc.to, 'short'),
      });
    default:
      return t(locale, `searchAnswers.period.${desc.kind}`);
  }
}

function explain(locale: Locale, p: Omit<ParsedQuery, 'explanation'>): string {
  const period = periodPhrase(locale, p);
  switch (p.intent) {
    case 'best_days':
      return p.metric
        ? t(locale, 'searchAnswers.explain.bestByMetric', { metric: p.metric, period })
        : t(locale, 'searchAnswers.explain.best', { period });
    case 'worst_days':
      return p.metric
        ? t(locale, 'searchAnswers.explain.worstByMetric', { metric: p.metric, period })
        : t(locale, 'searchAnswers.explain.worst', { period });
    case 'metric_filter':
      return t(locale, 'searchAnswers.explain.filter', {
        metric: p.metric ?? 'mood',
        comparison: p.comparator && p.threshold != null ? comparatorText(locale, p.comparator, p.threshold) : '',
        period,
      });
    case 'trend_summary':
      return t(locale, 'searchAnswers.explain.trend', { metric: p.metric ?? 'mood', period });
    case 'text_mention':
      return p.textTerms.length
        ? t(locale, 'searchAnswers.explain.mention', { terms: quoteList(locale, p.textTerms), period })
        : t(locale, 'searchAnswers.explain.mentionAny', { period });
    case 'emotion_days':
      return t(locale, 'searchAnswers.explain.emotion', {
        emotions: joinOr(
          locale,
          p.emotions.map((k) => emotionLabel(locale, k)),
        ),
        period,
      });
    case 'list_entries':
      return p.textTerms.length
        ? t(locale, 'searchAnswers.explain.list', { terms: quoteList(locale, p.textTerms), period })
        : t(locale, 'searchAnswers.explain.listAll', { period });
    case 'unknown':
    default:
      return t(locale, 'searchAnswers.explain.unknown');
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface QueryAnalysis {
  parsed: ParsedQuery;
  /** The keyword table the question was parsed with (its language may differ from the UI locale). */
  table: SearchLanguageTable;
  /** The locale the texts were rendered in. */
  locale: Locale;
}

/**
 * Parses a question with the table of its language and renders the texts in `locale`.
 * When `locale` is omitted the texts follow the question's language. `today` fixes
 * relative periods (tests).
 */
export function analyseQuery(query: string, today: string = todayIso(), locale?: Locale): QueryAnalysis {
  const { text, quoted } = normaliseQuery(query);
  const table = tableForQuery(locale ?? DEFAULT_LOCALE, text);
  const ui: Locale = locale ?? table.locale;
  const c = compile(table);
  const tokens = tokenize(text, c);

  const period = detectPeriod(c, tokens, today);
  const base = {
    from: period ? period.from : null,
    to: period ? period.to : null,
    periodLabel: period ? periodLabelFor(ui, period.desc) : allTimeLabel(ui),
  };

  const finish = (p: Omit<ParsedQuery, 'explanation'>): QueryAnalysis => ({
    parsed: { ...p, explanation: explain(ui, p) },
    table,
    locale: ui,
  });

  // "when did I write that..." - free text search over what was written.
  const trigger = detectTrigger(c, tokens);
  if (trigger >= 0) {
    const terms = [...quoted];
    for (const w of termsAfterTrigger(c, tokens, trigger)) if (!terms.includes(w)) terms.push(w);
    return finish({
      intent: 'text_mention',
      metric: null,
      comparator: null,
      threshold: null,
      ...base,
      textTerms: terms,
      emotions: [],
    });
  }

  let metric = detectMetric(c, tokens);
  const cmp = detectComparator(c, tokens);
  if (cmp && !metric) {
    // "less than 5 hours" -> sleep; "more than 30 minutes" -> exercise; a bare rating -> mood.
    metric = cmp.unitMetric ?? (cmp.threshold <= 10 ? 'mood' : null);
  }
  let comparator: Comparator | null = cmp ? cmp.comparator : null;
  let threshold: number | null = cmp ? cmp.threshold : null;
  if (!cmp && metric === 'exerciseMinutes') {
    // "days without exercise" / "לא התאמנתי" -> explicitly no exercise.
    const negated = tokens.some((tk) => tk.role === null && isNegation(c, tk));
    if (negated) {
      comparator = 'eq';
      threshold = 0;
      for (const tk of tokens) if (tk.role === null && isNegation(c, tk)) tk.role = 'comparator';
    }
  }

  const trend = detectTrend(c, tokens);
  const rank = trend ? null : detectRank(c, tokens);
  const emotions = detectEmotions(c, tokens);

  let intent: SearchIntent;
  if (trend) {
    intent = 'trend_summary';
    if (!metric) metric = 'mood';
  } else if (rank) {
    if (rank === 'best' || rank === 'worst') intent = rank === 'best' ? 'best_days' : 'worst_days';
    else if (rank === 'high') intent = metric === 'stress' ? 'worst_days' : 'best_days';
    else intent = metric === 'stress' ? 'best_days' : 'worst_days';
  } else if (metric && comparator && threshold != null) {
    intent = 'metric_filter';
  } else if (emotions.length) {
    intent = 'emotion_days';
  } else if (metric && period && !comparator && !quoted.length && !significantTerms(c, tokens, false).length) {
    // "What was my mood last week?" / "מה הייתה רמת האנרגיה שלי בשבוע האחרון?": only a metric
    // and a period -> summarise that metric over the period (answer + chart) instead of
    // searching the entries for the metric's own word.
    intent = 'trend_summary';
  } else {
    const leftover = significantTerms(c, tokens, true);
    intent = leftover.length || quoted.length || period || metric ? 'list_entries' : 'unknown';
  }

  const textTerms = [...quoted];
  if (intent === 'list_entries') {
    for (const w of significantTerms(c, tokens, true)) if (!textTerms.includes(w)) textTerms.push(w);
  }

  return finish({
    intent,
    metric,
    comparator: intent === 'metric_filter' || comparator ? comparator : null,
    threshold: intent === 'metric_filter' || comparator ? threshold : null,
    ...base,
    textTerms,
    emotions,
  });
}

/** Parses a question into a structured query; texts in `locale` (default: the question's language). */
/**
 * The forms to look for in the diary for the search words `terms` (SearchLanguageTable
 * `stemSuffixes`): each word cut to its stem in its own language's table, or the word itself.
 */
export function searchStems(terms: string[], locale: Locale = DEFAULT_LOCALE): string[] {
  const out: string[] = [];
  for (const term of terms) {
    const table = tableForQuery(locale, term);
    const intl = localeDef(table.locale).intl;
    let word = fold(intl, term);
    const min = table.stemMinLength ?? 4;
    if (table.stemArticle) {
      for (const a of table.articlePrefixes) {
        const af = fold(intl, a);
        if (word.startsWith(af) && [...word].length - [...af].length >= min) {
          word = word.slice(af.length);
          break;
        }
      }
    }
    const suffixes = [...(table.stemSuffixes ?? [])].map((s) => fold(intl, s)).sort((a, b) => b.length - a.length);
    for (const s of suffixes) {
      if (word.endsWith(s) && [...word].length - [...s].length >= min) {
        word = word.slice(0, word.length - s.length);
        break;
      }
    }
    const stem = word === fold(intl, term) ? term : word;
    if (!out.includes(stem)) out.push(stem);
    // Hebrew final letters take their regular form inside a longer word: "עייף" must also
    // find "עייפה" / "עייפות", "חלום" finds "חלומות". Only for words of 4+ letters: the
    // regular form of a short word is part of too many others ("הים" -> "הימ" in "הימים").
    if (table.script === 'hebrew') {
      const last = stem.slice(-1);
      const regular = HEBREW_FINAL_TO_REGULAR[last];
      if (regular && [...stem].length >= HEBREW_INFLECTED_MIN_LENGTH) {
        const inflected = stem.slice(0, -1) + regular;
        if (!out.includes(inflected)) out.push(inflected);
      }
    }
  }
  return out;
}

const HEBREW_FINAL_TO_REGULAR: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const HEBREW_INFLECTED_MIN_LENGTH = 4;

export function parseQuery(query: string, today: string = todayIso(), locale?: Locale): ParsedQuery {
  return analyseQuery(query, today, locale).parsed;
}
