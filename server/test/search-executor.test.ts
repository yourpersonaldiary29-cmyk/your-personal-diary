/**
 * Smart-search executor: every intent runs against a small hand-made diary (raw SQL) and
 * must return the right days / entries / series with a Hebrew answer; no match yields a
 * Hebrew "nothing found" answer. The HTTP routes are covered at the end.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SearchResult } from '@shared/types';
import { DiaryDb } from '../src/db/database';
import { ApiError } from '../src/errors';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  NO_RESULTS_PREFIX,
  QUERY_MAX_LENGTH,
  dayPhrase,
  goodnessScore,
  smartSearch,
  validateSearchRequest,
} from '../src/search/executor';
import type { DayRecord } from '../src/db/dataset';
import { addDays, todayIso } from '../src/util/dates';
import { cleanupTempDirs, makeTestApp } from './helpers';
import { seedSmallDiary, type SmallDiary } from './raw-fixtures';

const TODAY = '2026-09-07'; // Monday
const HEBREW = /[א-ת]/;

function catchApi(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('expected an ApiError');
}

function expectEmpty(result: SearchResult, suffix = ''): void {
  expect(result.answer).toBe(`${NO_RESULTS_PREFIX}${suffix}.`);
  expect(result.entries).toEqual([]);
  expect(result.days).toEqual([]);
  expect(result.series).toBeNull();
  expect(result.totalMatches).toBe(0);
}

describe('smartSearch', () => {
  let db: DiaryDb;
  let ids: SmallDiary;
  const ask = (query: string, limit?: number) => smartSearch(db, limit ? { query, limit } : { query }, TODAY);

  beforeAll(async () => {
    db = await DiaryDb.create();
    ids = seedSmallDiary(db);
  });
  afterAll(() => db.close());

  it('ranks the best days by the composite score (mood, energy, inverted stress)', () => {
    const r = ask('באילו ימים הרגשתי הכי טוב?', 3);
    expect(r.parsed.intent).toBe('best_days');
    expect(r.days.map((d) => d.date)).toEqual(['2026-09-01', '2026-07-20', '2026-09-05']);
    expect(r.totalMatches).toBe(3);
    expect(r.days[0]).toEqual({
      date: '2026-09-01',
      mood: 9,
      energy: 8,
      stress: 2,
      sleepHours: 8,
      hasEntry: true,
      entryCount: 1,
      habitsCompleted: 2,
      habitsTotal: 2,
      titles: ['יום מעולה'],
    });
    expect(r.days[2]).toMatchObject({ date: '2026-09-05', mood: 6, energy: null, stress: null, entryCount: 2, titles: ['בוקר', 'ערב'] });
    // Entries follow the ranking of their day, then the time of day.
    expect(r.entries.map((e) => e.id)).toEqual([ids.entries.great, ids.entries.july, ids.entries.morning, ids.entries.evening]);
    expect(r.entries[0].excerpt).toBe('הלכתי לים עם דנה, היה כיף');
    expect(r.answer.startsWith('הימים שבהם הרגשת הכי טוב בכל התקופה: ')).toBe(true);
    expect(r.answer).toContain('יום שלישי, 1 בספטמבר (מצב רוח 9, אנרגיה 8, לחץ 2)');
    expect(r.answer).toContain('יום שני, 20 ביולי (מצב רוח 8)');
    expect(r.series).toBeNull();
    // Without a limit every scored day is returned (default limit 10).
    expect(ask('באילו ימים הרגשתי הכי טוב?').totalMatches).toBe(7);
  });

  it('ranks the hardest days by a specific metric', () => {
    const r = ask('מתי הלחץ היה הכי גבוה?');
    expect(r.parsed).toMatchObject({ intent: 'worst_days', metric: 'stress' });
    expect(r.days.map((d) => d.date)).toEqual(['2026-09-03', '2026-08-15', '2026-08-28', '2026-09-02', '2026-09-01']);
    expect(r.totalMatches).toBe(5);
    expect(r.answer.startsWith('הימים הקשים ביותר לפי רמת לחץ בכל התקופה: ')).toBe(true);
    expect(r.answer).toContain('יום חמישי, 3 בספטמבר (לחץ 9)');
    expect(r.entries[0].id).toBe(ids.entries.hard);
    // Days without the metric are not ranked.
    expect(r.days.some((d) => d.date === '2026-07-20')).toBe(false);
  });

  it('filters days by a metric, newest first, and quotes the values', () => {
    const short = ask('באילו ימים ישנתי פחות מחמש שעות?');
    expect(short.parsed).toMatchObject({ intent: 'metric_filter', metric: 'sleepHours', comparator: 'lt', threshold: 5 });
    expect(short.days.map((d) => d.date)).toEqual(['2026-09-03']);
    expect(short.entries.map((e) => e.id)).toEqual([ids.entries.hard]);
    expect(short.totalMatches).toBe(1);
    expect(short.answer).toBe('מצאתי יום אחד עם שעות שינה פחות מ-5 בכל התקופה: יום חמישי, 3 בספטמבר (4.5).');

    const good = ask('ימים עם מצב רוח מעל 5 בחודש האחרון');
    expect(good.days.map((d) => d.date)).toEqual(['2026-09-05', '2026-09-02', '2026-09-01']);
    expect(good.totalMatches).toBe(3);
    expect(good.answer.startsWith('מצאתי 3 ימים עם מצב רוח יותר מ-5 בחודש האחרון: ')).toBe(true);
    expect(good.entries).toHaveLength(4); // 09-05 has two entries

    expect(ask('ימים עם לחץ לפחות 4').totalMatches).toBe(4);
    expect(ask('ימים בלי פעילות גופנית').days.map((d) => d.date)).toEqual(['2026-09-02']);
  });

  it('finds the days of an emotion from the emotion keys and from the text', () => {
    const tired = ask('מתי הייתי עייף');
    expect(tired.parsed).toMatchObject({ intent: 'emotion_days', emotions: ['tired'] });
    expect(tired.days.map((d) => d.date)).toEqual(['2026-09-03']);
    expect(tired.days[0]).toMatchObject({ mood: 2, stress: 9, habitsCompleted: 1, habitsTotal: 2 });
    expect(tired.totalMatches).toBe(1);
    expect(tired.answer).toBe('סימנת את הרגש עייף ביום אחד בכל התקופה: יום חמישי, 3 בספטמבר.');

    expect(ask('ימים שהייתי משועמם').entries.map((e) => e.id)).toEqual([ids.entries.evening]);

    const two = ask('מתי הייתי שמח או רגוע');
    expect(two.parsed.emotions).toEqual(['happy', 'calm']);
    expect(two.days.map((d) => d.date)).toEqual(['2026-09-02', '2026-09-01']);
    expect(two.answer.startsWith('סימנת את הרגש שמח או רגוע ביומיים בכל התקופה: ')).toBe(true);
  });

  it('writes the emotion in lower case inside the sentence (the chip labels are capitalised)', () => {
    const en = smartSearch(db, { query: 'On which days was I tired?' }, TODAY, 'en');
    expect(en.parsed.explanation).toBe('Understood: days you felt tired, across the whole diary.');
    expect(en.answer.startsWith('You felt tired on 1 day across the whole diary: ')).toBe(true);
    const de = smartSearch(db, { query: 'An welchen Tagen war ich müde?' }, TODAY, 'de');
    expect(de.parsed.explanation).toContain('mit dem Gefühl müde');
    const ru = smartSearch(db, { query: 'Когда я был усталым?' }, TODAY, 'ru');
    expect(ru.parsed.emotions).toEqual(['tired']);
    expect(ru.parsed.explanation).not.toMatch(/[А-ЯЁ]сталость|Усталость/u);
  });

  it('answers "when did I write about" questions with the first and last mention', () => {
    const work = ask('מתי כתבתי על עבודה');
    expect(work.parsed).toMatchObject({ intent: 'text_mention', textTerms: ['עבודה'] });
    expect(work.entries.map((e) => e.id)).toEqual([ids.entries.hard, ids.entries.august]);
    expect(work.totalMatches).toBe(2);
    expect(work.answer).toBe(
      'כתבת "עבודה" בשתי רשומות בכל התקופה; הראשונה ביום שבת, 15 באוגוסט 2026 והאחרונה ביום חמישי, 3 בספטמבר 2026.',
    );
    expect(work.days).toEqual([]);

    // People are searched too.
    const dana = ask('מתי הזכרתי את דנה');
    expect(dana.entries.map((e) => e.id)).toEqual([ids.entries.great]);
    expect(dana.answer).toBe('כתבת "דנה" ברשומה אחת בכל התקופה; הראשונה ביום שלישי, 1 בספטמבר 2026.');
    // The prefix is hyphenated only before digits.
    expect(ask('בשבוע האחרון', 2).answer.startsWith('מצאתי 5 רשומות בשבוע האחרון; האחרונה ביום שבת, 5 בספטמבר 2026.')).toBe(true);
  });

  it('lists the entries of a period or of a free-text term', () => {
    const july = ask('ביולי');
    expect(july.parsed.intent).toBe('list_entries');
    expect(july.entries.map((e) => e.id)).toEqual([ids.entries.july]);
    expect(july.answer).toBe('מצאתי רשומה אחת ביולי 2026; האחרונה ביום שני, 20 ביולי 2026.');

    const week = ask('בשבוע האחרון');
    expect(week.totalMatches).toBe(5);
    expect(week.entries.map((e) => e.id)).toEqual([ids.entries.evening, ids.entries.morning, ids.entries.hard, ids.entries.normal, ids.entries.great]);

    const term = ask('רשומות על דנה');
    expect(term.entries.map((e) => e.id)).toEqual([ids.entries.great]);
    // One entry: the singular form ("רשומה אחת שמכילה").
    expect(term.answer).toContain('שמכילה "דנה"');
  });

  it('summarises a trend with a daily series', () => {
    const mood = ask('איך השתנה מצב הרוח שלי בחודש האחרון');
    expect(mood.parsed).toMatchObject({ intent: 'trend_summary', metric: 'mood' });
    const series = mood.series!;
    expect(series.metric).toBe('mood');
    expect(series.label).toBe('מצב רוח');
    expect(series.points).toHaveLength(30);
    expect(series.points[0].date).toBe('2026-08-09');
    expect(series.points[29].date).toBe(TODAY);
    expect(series.points.find((p) => p.date === '2026-09-05')?.value).toBe(6);
    expect(series.points.find((p) => p.date === '2026-09-04')?.value).toBeNull();
    expect(series.count).toBe(6);
    expect(series.movingAvg).toHaveLength(30);
    expect(mood.totalMatches).toBe(6);
    expect(mood.entries).toEqual([]);
    expect(mood.days).toEqual([]);
    // First third (one day, mood 4) against the last third (9, 6, 2, 6).
    expect(mood.answer).toBe('מצב הרוח הממוצע עלה מ-4 ל-5.8 בחודש האחרון (על סמך יום אחד בתחילת התקופה לעומת 4 ימים בסופה).');

    // Without a period the series starts on the first day that has data. Stress was first
    // reported weeks later: the thirds are taken over the days between its first and last value
    // (6 at the start against 2, 4, 9 at the end), not over the empty start of the range.
    const stress = ask('איך השתנתה רמת הלחץ שלי');
    expect(stress.series!.points).toHaveLength(50);
    expect(stress.series!.points[0].date).toBe('2026-07-20');
    expect(stress.series!.count).toBe(5);
    expect(stress.totalMatches).toBe(5);
    expect(stress.answer).toBe('רמת הלחץ הממוצעת ירדה מ-6 ל-5 בכל התקופה (על סמך יום אחד בתחילת התקופה לעומת 3 ימים בסופה).');
    // A period longer than the diary ("the last year" of a seven-week diary): the answer compares
    // the start and the end of what was written instead of saying there is not enough data.
    const moodYear = ask('איך השתנה מצב הרוח שלי בשנה האחרונה');
    expect(moodYear.parsed).toMatchObject({ intent: 'trend_summary', metric: 'mood', from: addDays(TODAY, -364) });
    expect(moodYear.series!.points).toHaveLength(365);
    expect(moodYear.answer).not.toContain('אין מספיק נתונים');
    expect(moodYear.answer).toMatch(/^מצב הרוח הממוצע (עלה|ירד|נשאר יציב)/);
    expect(moodYear.answer).toContain('בשנה האחרונה');
    // Inside the last month both thirds hold values: 6 at the start against 2, 4, 9 at the end.
    const stressMonth = ask('איך השתנתה רמת הלחץ שלי בחודש האחרון');
    expect(stressMonth.answer).toBe('רמת הלחץ הממוצעת ירדה מ-6 ל-5 בחודש האחרון (על סמך יום אחד בתחילת התקופה לעומת 3 ימים בסופה).');

    // A tiny change is reported as stable.
    const sleep = ask('איך השתנו שעות השינה שלי בחודש האחרון');
    expect(sleep.parsed.metric).toBe('sleepHours');
    expect(sleep.answer).toContain('שעות השינה הממוצעות נשארו יציבות בחודש האחרון');
  });

  it('answers in Hebrew when nothing matches', () => {
    expectEmpty(ask('ימים עם אנרגיה מעל 9'));
    expectEmpty(ask('מתי הייתי בודד בחודש האחרון'), ' בחודש האחרון');
    expectEmpty(ask('מתי כתבתי על חתולים'));
    expectEmpty(ask('הכי טוב באפריל'), ' באפריל 2026');
    expectEmpty(ask('ימים שהייתי נרגש'));
    expectEmpty(ask('איך השתנה מצב הרוח שלי ביוני'), ' ביוני 2026');
  });

  it('falls back to the latest entries when the question is not understood', () => {
    const r = ask('מתי');
    expect(r.parsed.intent).toBe('unknown');
    expect(r.totalMatches).toBe(8);
    expect(r.entries).toHaveLength(8);
    expect(r.entries[0].id).toBe(ids.entries.evening);
    expect(r.answer).toContain('לא הייתי בטוח מה השאלה');
    expect(r.answer).toContain('לא הצלחתי להבין את השאלה');
  });

  it('respects the requested limit while reporting the total', () => {
    expect(ask('באילו ימים הרגשתי הכי טוב?', 2).days).toHaveLength(2);
    const r = ask('מתי', 3);
    expect(r.entries).toHaveLength(3);
    expect(r.totalMatches).toBe(8);
    expect(r.answer).toContain('3 רשומות אחרונות מתוך 8');
    expect(ask('בשבוע האחרון', 1).entries).toHaveLength(1);
  });

  it('answers an empty diary in Hebrew for every intent', async () => {
    const empty = await DiaryDb.create();
    const on = (query: string) => smartSearch(empty, { query }, TODAY);
    expectEmpty(on('באילו ימים הרגשתי הכי טוב?'));
    expectEmpty(on('ימים עם מצב רוח מעל 5'));
    expectEmpty(on('מתי הייתי שמח'));
    expectEmpty(on('מתי כתבתי על עבודה'));
    expectEmpty(on('איך השתנה מצב הרוח שלי'));
    const unknown = on('מתי');
    expect(unknown.answer).toBe(unknown.parsed.explanation);
    expect(unknown.totalMatches).toBe(0);
    empty.close();
  });
});

describe('search helpers', () => {
  it('validates the request body with Hebrew messages and field names', () => {
    expect(validateSearchRequest({ query: ' שלום ', limit: 5 })).toEqual({ query: 'שלום', limit: 5 });
    expect(validateSearchRequest({ query: 'שלום' })).toEqual({ query: 'שלום' });
    for (const bad of [undefined, null, 'שלום', [], {}, { query: '' }, { query: '   ' }, { query: 42 }, { query: 'x'.repeat(QUERY_MAX_LENGTH + 1) }]) {
      const err = catchApi(() => validateSearchRequest(bad));
      expect(err.status).toBe(400);
      expect(err.code).toBe('VALIDATION');
      expect(err.field).toBe('query');
      expect(err.messageFor('he')).toMatch(HEBREW);
    }
    for (const limit of [0, -1, 1.5, MAX_LIMIT + 1, '5']) {
      expect(catchApi(() => validateSearchRequest({ query: 'שלום', limit })).field).toBe('limit');
    }
    expect(DEFAULT_LIMIT).toBe(10);
  });

  it('phrases dates in Hebrew, adding the year only when it differs from today', () => {
    expect(dayPhrase('2026-09-01', TODAY, 'he')).toBe('יום שלישי, 1 בספטמבר');
    expect(dayPhrase('2025-12-31', TODAY, 'he')).toBe('יום רביעי, 31 בדצמבר 2025');
  });

  it('computes the composite goodness score without treating missing values as 0', () => {
    const day = (over: Partial<DayRecord>): DayRecord =>
      ({
        date: '2026-09-01',
        weekday: 2,
        entryCount: 1,
        mood: null,
        energy: null,
        stress: null,
        sleepQuality: null,
        sleepHours: null,
        exerciseMinutes: null,
        didExercise: null,
        points: [],
        emotions: [],
        tags: [],
        people: [],
        locations: [],
        habitValues: new Map(),
        habitCompleted: new Map(),
        titles: [],
        ...over,
      }) as DayRecord;
    expect(goodnessScore(day({ mood: 9, energy: 8, stress: 2 }), null)).toBeCloseTo(26 / 3, 5);
    expect(goodnessScore(day({ mood: 8 }), null)).toBe(8);
    expect(goodnessScore(day({ stress: 9 }), 'stress')).toBe(-9);
    expect(goodnessScore(day({ mood: 8 }), 'energy')).toBeNull();
    expect(goodnessScore(day({}), null)).toBeNull();
  });
});

describe('/api/search routes', () => {
  afterAll(() => cleanupTempDirs());

  it('serves search results and the parsed question', async () => {
    const t = await makeTestApp();
    seedSmallDiary(t.db);
    const res = await t.post('/api/search', { query: 'באילו ימים הרגשתי הכי טוב?', limit: 2 });
    expect(res.status).toBe(200);
    const body = res.body as SearchResult;
    expect(body.parsed.intent).toBe('best_days');
    expect(body.days).toHaveLength(2);
    expect(body.days[0].date).toBe('2026-09-01');
    expect(body.answer).toMatch(HEBREW);

    const parsed = await t.post('/api/search/parse', { query: 'מתי הייתי שמח השבוע' });
    expect(parsed.status).toBe(200);
    expect(parsed.body).toMatchObject({ intent: 'emotion_days', emotions: ['happy'], from: addDays(todayIso(), -6), to: todayIso() });

    const missing = await t.post('/api/search', {});
    expect(missing.status).toBe(400);
    expect(missing.body).toMatchObject({ code: 'VALIDATION', field: 'query' });
    expect((await t.post('/api/search', { query: 'שלום', limit: 999 })).body.field).toBe('limit');
    expect((await t.anon().post('/api/search').send({ query: 'שלום' })).status).toBe(401);
  });
});
