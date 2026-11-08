/**
 * Smart-search parser: a table of Hebrew questions and the structure each one must
 * produce (intent, metric, comparator, threshold, period, emotions, text terms).
 * `today` is fixed to 2026-09-07 (a Monday) so relative periods are deterministic.
 */
import { describe, expect, it } from 'vitest';
import type { ParsedQuery } from '@shared/types';
import { normaliseQuery, parseQuery, comparatorText, periodPhrase, numberFromToken, prefixForms } from '../src/search/parser';
import { addDays, todayIso } from '../src/util/dates';

const T = '2026-09-07';
const HEBREW = /[א-ת]/;

type Expected = Partial<ParsedQuery>;

/** [question, expected fields]. Fields left out are not asserted. */
const CASES: [string, Expected][] = [
  // The questions named in the product spec ------------------------------------------
  ['אילו ימים בחודש האחרון הרגשתי הכי טוב?', { intent: 'best_days', metric: null, comparator: null, threshold: null, from: '2026-08-09', to: T, periodLabel: 'בחודש האחרון', emotions: [], textTerms: [] }],
  ['מתי כתבתי שאני עייף?', { intent: 'text_mention', metric: null, from: null, to: null, textTerms: ['עייף'], emotions: [] }],
  ['באילו ימים ישנתי פחות מחמש שעות?', { intent: 'metric_filter', metric: 'sleepHours', comparator: 'lt', threshold: 5, from: null, to: null }],
  ['איך השתנה מצב הרוח שלי בשלושת החודשים האחרונים?', { intent: 'trend_summary', metric: 'mood', from: '2026-06-10', to: T, periodLabel: 'ב-3 החודשים האחרונים' }],
  ['באילו ימים הייתי לחוץ?', { intent: 'emotion_days', emotions: ['stressed'], from: null, comparator: null, threshold: null }],
  ['מתי הייתי שמח השבוע', { intent: 'emotion_days', emotions: ['happy'], from: '2026-09-01', to: T, periodLabel: 'בשבוע האחרון' }],
  ['ימים עם אנרגיה מעל 8 בשנה האחרונה', { intent: 'metric_filter', metric: 'energy', comparator: 'gt', threshold: 8, from: '2025-09-08', to: T, periodLabel: 'בשנה האחרונה' }],
  ['רשומות על עבודה', { intent: 'list_entries', metric: null, textTerms: ['עבודה'], from: null, emotions: [] }],
  ['ביולי', { intent: 'list_entries', from: '2026-07-01', to: '2026-07-31', periodLabel: 'ביולי 2026', textTerms: [] }],
  ['בין 01/08/2026 ל-15/08/2026', { intent: 'list_entries', from: '2026-08-01', to: '2026-08-15', periodLabel: 'בין 1.8.2026 ל-15.8.2026', textTerms: [] }],
  // Best / worst days ---------------------------------------------------------------
  ['באילו ימים הרגשתי הכי גרוע בשבוע האחרון?', { intent: 'worst_days', metric: null, from: '2026-09-01', to: T }],
  ['הימים הטובים ביותר השנה', { intent: 'best_days', from: '2025-09-08', to: T, periodLabel: 'בשנה האחרונה' }],
  ['מתי הלחץ היה הכי גבוה?', { intent: 'worst_days', metric: 'stress', from: null }],
  ['מתי האנרגיה שלי הייתה הכי נמוכה', { intent: 'worst_days', metric: 'energy' }],
  ['מתי הלחץ היה הכי נמוך', { intent: 'best_days', metric: 'stress' }],
  ['הכי הרבה אנרגיה החודש', { intent: 'best_days', metric: 'energy', from: '2026-08-09', to: T, periodLabel: 'בחודש האחרון' }],
  ['הימים הקשים ביותר ביולי', { intent: 'worst_days', from: '2026-07-01', to: '2026-07-31' }],
  ['הכי טוב באוגוסט 2025', { intent: 'best_days', from: '2025-08-01', to: '2025-08-31', periodLabel: 'באוגוסט 2025' }],
  ['בשבוע שעבר הרגשתי הכי גרוע', { intent: 'worst_days', from: '2026-09-01', to: T }],
  // Metric filters ------------------------------------------------------------------
  ['ימים עם מצב רוח מתחת ל-4 בחודש האחרון', { intent: 'metric_filter', metric: 'mood', comparator: 'lt', threshold: 4, from: '2026-08-09', to: T }],
  ['באילו ימים ישנתי לפחות שמונה שעות', { intent: 'metric_filter', metric: 'sleepHours', comparator: 'gte', threshold: 8 }],
  ['ימים שבהם התאמנתי יותר מ-30 דקות', { intent: 'metric_filter', metric: 'exerciseMinutes', comparator: 'gt', threshold: 30 }],
  ['ימים בלי פעילות גופנית', { intent: 'metric_filter', metric: 'exerciseMinutes', comparator: 'eq', threshold: 0 }],
  ['ימים שלא התאמנתי', { intent: 'metric_filter', metric: 'exerciseMinutes', comparator: 'eq', threshold: 0 }],
  ['ימים עם לחץ מעל שבע וחצי', { intent: 'metric_filter', metric: 'stress', comparator: 'gt', threshold: 7.5 }],
  ['שינה של עד 6 שעות', { intent: 'metric_filter', metric: 'sleepHours', comparator: 'lte', threshold: 6 }],
  ['לכל היותר 5 שעות שינה', { intent: 'metric_filter', metric: 'sleepHours', comparator: 'lte', threshold: 5 }],
  ['מצב רוח בדיוק 7', { intent: 'metric_filter', metric: 'mood', comparator: 'eq', threshold: 7 }],
  ['איכות שינה מתחת ל-5', { intent: 'metric_filter', metric: 'sleepQuality', comparator: 'lt', threshold: 5 }],
  ['ימים עם שינה של פחות משש שעות בשבועיים האחרונים', { intent: 'metric_filter', metric: 'sleepHours', comparator: 'lt', threshold: 6, from: '2026-08-25', to: T, periodLabel: 'בשבועיים האחרונים' }],
  ['פחות מ-5', { intent: 'metric_filter', metric: 'mood', comparator: 'lt', threshold: 5 }],
  // Trends --------------------------------------------------------------------------
  ['איך השתנתה רמת הלחץ שלי בחודשיים האחרונים', { intent: 'trend_summary', metric: 'stress', from: '2026-07-10', to: T, periodLabel: 'בחודשיים האחרונים' }],
  ['מגמת השינה שלי השנה', { intent: 'trend_summary', metric: 'sleepHours', from: '2025-09-08', to: T }],
  ['מה הממוצע של האנרגיה שלי בשבועיים האחרונים', { intent: 'trend_summary', metric: 'energy', from: '2026-08-25', to: T }],
  ['איך השתפרה השינה שלי בחצי השנה האחרונה', { intent: 'trend_summary', metric: 'sleepHours', from: '2026-03-12', to: T, periodLabel: 'בחצי השנה האחרונה' }],
  ['מגמת מצב הרוח מתחילת החודש', { intent: 'trend_summary', metric: 'mood', from: '2026-09-01', to: T, periodLabel: 'מתחילת החודש' }],
  ['איך השתנה מצב הרוח', { intent: 'trend_summary', metric: 'mood', from: null, to: null, periodLabel: 'כל התקופה' }],
  // "What did I write" --------------------------------------------------------------
  ['מתי הזכרתי את דנה', { intent: 'text_mention', textTerms: ['דנה'], from: null }],
  ['מה כתבתי על העבודה בחודש שעבר', { intent: 'text_mention', textTerms: ['העבודה'], from: '2026-08-09', to: T }],
  ['מתי רשמתי "פגישה חשובה"', { intent: 'text_mention', textTerms: ['פגישה חשובה'] }],
  ['מה כתבתי אתמול', { intent: 'text_mention', textTerms: [], from: '2026-09-06', to: '2026-09-06', periodLabel: 'אתמול' }],
  ['מה כתבתי לפני 3 ימים', { intent: 'text_mention', textTerms: [], from: '2026-09-04', to: '2026-09-04' }],
  ['מתי ציינתי את אמא ואבא', { intent: 'text_mention', textTerms: ['אמא', 'ואבא'] }],
  // Emotions ------------------------------------------------------------------------
  ['מתי הרגשתי עייף ולחוץ', { intent: 'emotion_days', emotions: ['tired', 'stressed'] }],
  ['ימים שהייתי מאושרת', { intent: 'emotion_days', emotions: ['happy'], from: null }],
  ['באילו ימים הייתי רגועה ומרוצה', { intent: 'emotion_days', emotions: ['calm', 'satisfied'] }],
  ['הרגשתי מלא אנרגיה', { intent: 'emotion_days', emotions: ['energetic'] }],
  ['מתי הייתי אסיר תודה', { intent: 'emotion_days', emotions: ['grateful'] }],
  ['מתי הייתי עצוב', { intent: 'emotion_days', emotions: ['sad'] }],
  ['הרגשתי מוצפת השבוע', { intent: 'emotion_days', emotions: ['overwhelmed'], from: '2026-09-01', to: T }],
  // Periods on their own -> list the entries ----------------------------------------
  ['לפני שבוע', { intent: 'list_entries', from: '2026-08-31', to: '2026-08-31', periodLabel: 'לפני שבוע' }],
  ['ב-5 הימים האחרונים', { intent: 'list_entries', from: '2026-09-03', to: T, periodLabel: 'ב-5 הימים האחרונים' }],
  ['שבוע אחרון', { intent: 'list_entries', from: '2026-09-01', to: T, periodLabel: 'בשבוע האחרון', textTerms: [] }],
  ['מתחילת השנה', { intent: 'list_entries', from: '2026-01-01', to: T, periodLabel: 'מתחילת השנה' }],
  ['רשומות מ-01.08.2026 עד 15.08.2026', { intent: 'list_entries', from: '2026-08-01', to: '2026-08-15', textTerms: [] }],
  ['ב-3/9/2026', { intent: 'list_entries', from: '2026-09-03', to: '2026-09-03', periodLabel: 'ב-3.9.2026' }],
  ['בין 1/8/26 ל-15/8/26', { intent: 'list_entries', from: '2026-08-01', to: '2026-08-15' }],
  // Free text and the unknown intent ------------------------------------------------
  ['רשומות עם "יום קשה"', { intent: 'list_entries', textTerms: ['יום קשה'] }],
  ['ספורט', { intent: 'list_entries', metric: 'exerciseMinutes', comparator: null, threshold: null, textTerms: ['ספורט'] }],
  ['שלום', { intent: 'list_entries', textTerms: ['שלום'], from: null }],
  ['מתי', { intent: 'unknown', textTerms: [], from: null, metric: null }],
  ['???', { intent: 'unknown', textTerms: [], emotions: [] }],
];

describe('parseQuery', () => {
  it.each(CASES)('understands %s', (question, expected) => {
    const parsed = parseQuery(question, T, 'he');
    expect(parsed).toMatchObject(expected);
    // Every parse carries a Hebrew period label and a Hebrew explanation.
    expect(parsed.periodLabel).toMatch(HEBREW);
    expect(parsed.explanation).toMatch(HEBREW);
    if (parsed.intent === 'unknown') expect(parsed.explanation).toContain('לא הצלחתי להבין');
    else expect(parsed.explanation.startsWith('הבנתי:')).toBe(true);
    if (parsed.from === null) {
      expect(parsed.to).toBeNull();
      expect(parsed.periodLabel).toBe('כל התקופה');
    } else {
      expect(parsed.to).not.toBeNull();
      expect(parsed.from <= (parsed.to as string)).toBe(true);
    }
  });

  it('covers every intent and at least forty questions', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(40);
    const intents = new Set(CASES.map(([q]) => parseQuery(q, T).intent));
    for (const intent of ['best_days', 'worst_days', 'text_mention', 'metric_filter', 'trend_summary', 'list_entries', 'emotion_days', 'unknown']) {
      expect(intents.has(intent as ParsedQuery['intent'])).toBe(true);
    }
  });

  it('phrases the explanation ("כך הבנתי את השאלה") for each intent', () => {
    expect(parseQuery('אילו ימים בחודש האחרון הרגשתי הכי טוב?', T).explanation).toBe('הבנתי: הימים שבהם הרגשת הכי טוב, בחודש האחרון.');
    expect(parseQuery('מתי הלחץ היה הכי גבוה?', T).explanation).toBe('הבנתי: הימים הקשים ביותר לפי רמת לחץ, בכל התקופה.');
    expect(parseQuery('באילו ימים ישנתי פחות מחמש שעות?', T).explanation).toBe('הבנתי: ימים עם שעות שינה פחות מ-5, בכל התקופה.');
    expect(parseQuery('שינה של עד 6 שעות', T).explanation).toBe('הבנתי: ימים עם שעות שינה עד 6, בכל התקופה.');
    expect(parseQuery('איך השתנתה רמת הלחץ שלי בחודשיים האחרונים', T).explanation).toBe('הבנתי: איך השתנתה רמת הלחץ, בחודשיים האחרונים.');
    expect(parseQuery('מתי כתבתי שאני עייף?', T).explanation).toBe('הבנתי: רשומות שבהן כתבת "עייף", בכל התקופה.');
    expect(parseQuery('מה כתבתי אתמול', T).explanation).toBe('הבנתי: רשומות שכתבת, אתמול.');
    expect(parseQuery('מתי הרגשתי עייף ולחוץ', T).explanation).toBe('הבנתי: ימים שבהם סימנת את הרגש עייף או לחוץ, בכל התקופה.');
    expect(parseQuery('רשומות על עבודה', T).explanation).toBe('הבנתי: רשומות שמכילות "עבודה", בכל התקופה.');
    expect(parseQuery('ביולי', T).explanation).toBe('הבנתי: כל הרשומות, ביולי 2026.');
  });

  it('uses the real today when none is given', () => {
    const today = todayIso();
    const parsed = parseQuery('מתי הייתי שמח השבוע');
    expect(parsed.from).toBe(addDays(today, -6));
    expect(parsed.to).toBe(today);
    expect(parseQuery('אתמול').from).toBe(addDays(today, -1));
  });

  it('places a month name in the previous year when the month is still ahead', () => {
    // Today is September 2026: "בדצמבר" must mean December 2025, "במרץ" March 2026.
    expect(parseQuery('בדצמבר', T)).toMatchObject({ from: '2025-12-01', to: '2025-12-31', periodLabel: 'בדצמבר 2025' });
    expect(parseQuery('במרץ', T)).toMatchObject({ from: '2026-03-01', to: '2026-03-31' });
    expect(parseQuery('בחודש פברואר 2024', T)).toMatchObject({ from: '2024-02-01', to: '2024-02-29', periodLabel: 'בפברואר 2024' });
  });

  it('ignores an invalid explicit date instead of guessing', () => {
    const parsed = parseQuery('ב-31/02/2026', T);
    expect(parsed.from).toBeNull();
    expect(parsed.intent).toBe('list_entries');
  });

  it('keeps quoted phrases as exact terms and strips punctuation and niqqud', () => {
    expect(normaliseQuery('  מתי   כתבתי "יום  קשה" ?! ')).toEqual({ text: 'מתי כתבתי', quoted: ['יום קשה'] });
    expect(normaliseQuery('שָׁלוֹם, עוֹלָם.').text).toBe('שלום עולם');
    expect(normaliseQuery('ב-7.9.2026 (בערב)').text).toBe('ב-7.9.2026 בערב');
    expect(normaliseQuery('צה"ל').text).toBe('צהל');
    expect(normaliseQuery('מתי כתבתי על צה״ל').text).toBe('מתי כתבתי על צהל');
    expect(parseQuery('מתי כתבתי על צה"ל', T).textTerms).toEqual(['צהל']);
    expect(normaliseQuery(undefined as unknown as string)).toEqual({ text: '', quoted: [] });
  });

  it('reads numbers in digits and in words, with or without a prefix letter', () => {
    expect(numberFromToken('7')).toBe(7);
    expect(numberFromToken('7.5')).toBe(7.5);
    expect(numberFromToken('7,5')).toBe(7.5);
    expect(numberFromToken('מ-5', 'he')).toBe(5);
    expect(numberFromToken('מחמש', 'he')).toBe(5);
    expect(numberFromToken('שמונה', 'he')).toBe(8);
    expect(numberFromToken('לשלושים', 'he')).toBe(30);
    expect(numberFromToken('שלום', 'he')).toBeNull();
    expect(prefixForms('וכשהלכתי', 'he')).toContain('הלכתי');
    expect(prefixForms('אב', 'he')).toEqual(['אב']);
  });

  it('renders comparators and periods in Hebrew', () => {
    expect(comparatorText('he', 'lt', 5)).toBe('פחות מ-5');
    expect(comparatorText('he', 'lte', 7.5)).toBe('עד 7.5');
    expect(comparatorText('he', 'gt', 8)).toBe('יותר מ-8');
    expect(comparatorText('he', 'gte', 30)).toBe('לפחות 30');
    expect(comparatorText('he', 'eq', 0)).toBe('בדיוק 0');
    expect(periodPhrase('he', { from: null, periodLabel: 'כל התקופה' })).toBe('בכל התקופה');
    expect(periodPhrase('he', { from: '2026-09-01', periodLabel: 'בשבוע האחרון' })).toBe('בשבוע האחרון');
  });
});

describe('a metric and a period on their own', () => {
  // "What was my mood last week?" used to search the entries for the word "mood";
  // it now summarises the metric over the period (answer + chart).
  it.each([
    ['en', 'What was my mood last week?', 'mood'],
    ['en', 'What was my energy level last week?', 'energy'],
    ['he', 'מה הייתה רמת האנרגיה שלי בשבוע האחרון?', 'energy'],
    ['he', 'מה היה מצב הרוח שלי בשבוע האחרון?', 'mood'],
    ['de', 'Wie war meine Energie in der letzten Woche?', 'energy'],
    ['ar', 'كيف كانت طاقتي في الأسبوع الأخير؟', 'energy'],
  ] as const)('%s: %s -> trend_summary', (locale, question, metric) => {
    const parsed = parseQuery(question, T, locale);
    expect(parsed).toMatchObject({ intent: 'trend_summary', metric, from: addDays(T, -6), to: T, textTerms: [] });
  });

  it('keeps a bare topic word, a word plus a period and a metric without a period as entry searches', () => {
    expect(parseQuery('ספורט', T, 'he')).toMatchObject({ intent: 'list_entries', textTerms: ['ספורט'] });
    expect(parseQuery('work last week', T, 'en')).toMatchObject({ intent: 'list_entries', textTerms: ['work'] });
    expect(parseQuery('רמת האנרגיה', T, 'he')).toMatchObject({ intent: 'list_entries', from: null });
  });
});
