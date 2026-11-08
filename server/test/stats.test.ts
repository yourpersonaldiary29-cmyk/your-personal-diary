/**
 * Statistics, calendar and home summary on a small hand-made diary (raw SQL):
 * series lengths, moving averages, previous-period means, weekday buckets, habit
 * statistics, calendar cells and the writing-streak logic.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SeriesPoint, StatsOverview } from '@shared/types';
import { DiaryDb } from '../src/db/database';
import { ApiError } from '../src/errors';
import { calendarMonth, calendarRange, MAX_RANGE_DAYS, validateRange } from '../src/stats/calendar';
import { entryStreak, homeSummary, pickTopInsight } from '../src/stats/home';
import { buildSeries, firstDayWithData, meanOf, movingAverage, MOVING_AVG_WINDOW, statsOverview } from '../src/stats/series';
import { addDays, daysInMonth, todayIso } from '../src/util/dates';
import { cleanupTempDirs, makeTestApp } from './helpers';
import { insertEntry, seedSmallDiary, type SmallDiary } from './raw-fixtures';

const TODAY = '2026-09-07'; // Monday

function catchApi(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('expected an ApiError');
}

const values = (points: SeriesPoint[]) => points.map((p) => p.value);

describe('statsOverview', () => {
  let db: DiaryDb;
  let ids: SmallDiary;
  let week: StatsOverview;

  beforeAll(async () => {
    db = await DiaryDb.create();
    ids = seedSmallDiary(db);
    week = statsOverview(db, '7d', TODAY, 'he');
  });
  afterAll(() => db.close());

  it('has one point per day of the range for every series', () => {
    expect(week.period).toBe('7d');
    expect(week.from).toBe('2026-09-01');
    expect(week.to).toBe(TODAY);
    for (const s of [week.mood, week.energy, week.stress, week.sleepHours, week.sleepQuality, week.exerciseMinutes, week.entriesPerDay]) {
      expect(s.points).toHaveLength(7);
      expect(s.movingAvg).toHaveLength(7);
      expect(s.points[0].date).toBe('2026-09-01');
      expect(s.points[6].date).toBe(TODAY);
      expect(s.movingAvg.map((p) => p.date)).toEqual(s.points.map((p) => p.date));
    }
    const month = statsOverview(db, '30d', TODAY, 'he');
    expect(month.from).toBe(addDays(TODAY, -29));
    expect(month.mood.points).toHaveLength(30);
    expect(month.mood.count).toBe(6);
    expect(statsOverview(db, '3m', TODAY, 'he').mood.points).toHaveLength(90);
    expect(statsOverview(db, '1y', TODAY, 'he').mood.points).toHaveLength(365);
  });

  it('reports daily means with null for days without a report, plus mean / min / max / count', () => {
    expect(values(week.mood.points)).toEqual([9, 6, 2, null, 6, null, null]);
    expect(week.mood).toMatchObject({ metric: 'mood', label: 'מצב רוח', unit: '', mean: 5.75, min: 2, max: 9, count: 4 });
    expect(values(week.energy.points)).toEqual([8, 5, 3, null, null, null, null]);
    expect(week.energy.mean).toBe(5.33);
    expect(values(week.sleepHours.points)).toEqual([8, 7, 4.5, null, 5, null, null]);
    expect(week.sleepHours).toMatchObject({ unit: 'שעות', mean: 6.13, min: 4.5, max: 8, count: 4 });
    expect(values(week.exerciseMinutes.points)).toEqual([40, 0, null, null, null, null, null]);
    expect(week.exerciseMinutes).toMatchObject({ mean: 20, min: 0, max: 40, count: 2 });
    // Nothing reported at all: everything null, never 0.
    expect(values(week.sleepQuality.points).every((v) => v === null)).toBe(true);
    expect(week.sleepQuality).toMatchObject({ mean: null, min: null, max: null, count: 0, previousMean: null });
  });

  it('counts entries per day (never null) and totals', () => {
    expect(values(week.entriesPerDay.points)).toEqual([1, 1, 1, 0, 2, 0, 0]);
    expect(week.entriesPerDay).toMatchObject({ metric: 'entries', label: 'רשומות יומן', unit: 'רשומות', mean: 0.71, count: 7 });
    expect(week.entriesPerDay.previousMean).toBe(0.14);
    expect(week.totalEntries).toBe(5);
    expect(week.daysWithEntries).toBe(4);
  });

  it('computes a 7-day trailing moving average that needs at least two values', () => {
    expect(MOVING_AVG_WINDOW).toBe(7);
    expect(values(week.mood.movingAvg)).toEqual([null, 7.5, 5.67, 5.67, 5.75, 5.75, 5.75]);
    const points: SeriesPoint[] = [
      { date: 'a', value: 1 },
      { date: 'b', value: null },
      { date: 'c', value: 3 },
      { date: 'd', value: 5 },
    ];
    expect(values(movingAverage(points, 2, 2))).toEqual([null, null, null, 4]);
    expect(values(movingAverage(points, 2, 1))).toEqual([1, 1, 3, 4]);
    expect(values(movingAverage(points, 10, 1))).toEqual([1, 1, 2, 3]);
  });

  it('compares with the previous period of equal length', () => {
    // The week before (08-25..08-31) holds one entry: mood 5, energy 6, stress 5, sleep 6.5.
    expect(week.mood.previousMean).toBe(5);
    expect(week.energy.previousMean).toBe(6);
    expect(week.stress.previousMean).toBe(5);
    expect(week.sleepHours.previousMean).toBe(6.5);
    expect(week.exerciseMinutes.previousMean).toBeNull();
    const month = statsOverview(db, '30d', TODAY, 'he');
    // 30 days before 08-09 -> 07-10..08-08 holds only the July entry (mood 8).
    expect(month.mood.previousMean).toBe(8);
    expect(month.energy.previousMean).toBeNull();
  });

  it('buckets means by weekday (index 0 = Sunday)', () => {
    expect(week.weekdayMood).toEqual([null, null, 9, 6, 2, null, 6]);
    expect(week.weekdayEnergy).toEqual([null, null, 8, 5, 3, null, null]);
    expect(week.weekdayStress).toEqual([null, null, 2, 4, 9, null, null]);
    const all = statsOverview(db, 'all', TODAY, 'he');
    // Saturday: 08-15 (mood 4) and 09-05 (mood 6); Monday: 07-20 (mood 8).
    expect(all.weekdayMood[6]).toBe(5);
    expect(all.weekdayMood[1]).toBe(8);
  });

  it('describes every active habit with points, completion and streaks', () => {
    expect(week.habits.map((h) => h.name)).toEqual(['מים', 'ספורט']);
    const water = week.habits[0];
    expect(water).toMatchObject({ habitId: ids.water, unit: 'כוסות', target: 8, frequency: 'daily', completedDays: 1, totalDays: 7, completionRate: 0.143, currentStreak: 0, bestStreak: 1 });
    expect(values(water.points)).toEqual([8, 3, null, null, null, null, null]);
    const sport = week.habits[1];
    // Weekly habit: the week 08-30..09-05 sums to the target (2), the current week does not yet.
    expect(sport).toMatchObject({ habitId: ids.sport, frequency: 'weekly', target: 2, completedDays: 1, totalDays: 2, completionRate: 0.5, currentStreak: 1, bestStreak: 1 });
    expect(values(sport.points)).toEqual([1, null, 1, null, null, null, null]);
    // Archived habits are left out.
    db.run('UPDATE habits SET is_archived = 1 WHERE id = ?', [ids.sport]);
    expect(statsOverview(db, '7d', TODAY, 'he').habits.map((h) => h.name)).toEqual(['מים']);
    db.run('UPDATE habits SET is_archived = 0 WHERE id = ?', [ids.sport]);
  });

  it('starts the "all" period at the first day with data and has no previous period', () => {
    const all = statsOverview(db, 'all', TODAY, 'he');
    expect(firstDayWithData(db)).toBe('2026-07-20');
    expect(all.from).toBe('2026-07-20');
    expect(all.to).toBe(TODAY);
    expect(all.mood.points).toHaveLength(50);
    expect(all.mood.previousMean).toBeNull();
    expect(all.entriesPerDay.previousMean).toBeNull();
    expect(all.totalEntries).toBe(8);
    expect(all.daysWithEntries).toBe(7);
    expect(all.mood.count).toBe(7);
  });

  it('handles an empty diary', async () => {
    const empty = await DiaryDb.create();
    const all = statsOverview(empty, 'all', TODAY);
    expect(firstDayWithData(empty)).toBeNull();
    expect(all.from).toBe(TODAY);
    expect(all.mood.points).toHaveLength(1);
    expect(all.mood.mean).toBeNull();
    expect(all.entriesPerDay.points[0].value).toBe(0);
    expect(all.habits).toEqual([]);
    expect(all.totalEntries).toBe(0);
    expect(all.weekdayMood).toEqual([null, null, null, null, null, null, null]);
    expect(statsOverview(empty, '1y', TODAY).mood.points).toHaveLength(365);
    empty.close();
  });

  it('exposes the small helpers', () => {
    expect(meanOf([])).toBeNull();
    expect(meanOf([1, 2])).toBe(1.5);
    const s = buildSeries('mood', ['2026-09-01', '2026-09-02'], (d) => (d === '2026-09-01' ? 7.123 : null), [null, 5]);
    expect(values(s.points)).toEqual([7.12, null]);
    expect(s.previousMean).toBe(5);
    expect(s.count).toBe(1);
  });
});

describe('calendar', () => {
  let db: DiaryDb;
  beforeAll(async () => {
    db = await DiaryDb.create();
    seedSmallDiary(db);
  });
  afterAll(() => db.close());

  it('returns every day of the month with entry and habit counts', () => {
    const month = calendarMonth(db, 2026, 9, TODAY);
    expect(month.year).toBe(2026);
    expect(month.month).toBe(9);
    expect(month.days).toHaveLength(30);
    expect(month.days[0]).toEqual({
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
    expect(month.days[1]).toMatchObject({ date: '2026-09-02', habitsCompleted: 0, habitsTotal: 2, mood: 6 });
    expect(month.days[2]).toMatchObject({ date: '2026-09-03', habitsCompleted: 1, titles: ['יום קשה'] });
    // A day without data before today: no entry, but the habits could still have been done.
    expect(month.days[3]).toEqual({
      date: '2026-09-04',
      mood: null,
      energy: null,
      stress: null,
      sleepHours: null,
      hasEntry: false,
      entryCount: 0,
      habitsCompleted: 0,
      habitsTotal: 2,
      titles: [],
    });
    expect(month.days[4]).toMatchObject({ date: '2026-09-05', entryCount: 2, mood: 6, sleepHours: 5, titles: ['בוקר', 'ערב'] });
    // Days after today cannot have habits to complete.
    expect(month.days[7]).toMatchObject({ date: '2026-09-08', hasEntry: false, habitsTotal: 0, habitsCompleted: 0 });
    expect(month.days.filter((d) => d.hasEntry).map((d) => d.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-05']);
  });

  it('knows the length of every month', () => {
    expect(calendarMonth(db, 2024, 2, TODAY).days).toHaveLength(29);
    expect(calendarMonth(db, 2026, 2, TODAY).days).toHaveLength(28);
    expect(calendarMonth(db, 2026, 12, TODAY).days).toHaveLength(31);
    expect(calendarMonth(db, 2026, 8, TODAY).days.filter((d) => d.hasEntry).map((d) => d.date)).toEqual(['2026-08-15', '2026-08-28']);
    expect(calendarMonth(db, 2026, 1, TODAY).days.every((d) => !d.hasEntry && d.habitsTotal === 2)).toBe(true);
  });

  it('rejects an invalid year or month with Hebrew validation errors', () => {
    expect(catchApi(() => calendarMonth(db, 2026, 13, TODAY))).toMatchObject({ status: 400, code: 'VALIDATION', field: 'month' });
    expect(catchApi(() => calendarMonth(db, 2026, 0, TODAY)).field).toBe('month');
    expect(catchApi(() => calendarMonth(db, 1900, 1, TODAY)).field).toBe('year');
    expect(catchApi(() => calendarMonth(db, 2026.5, 1, TODAY)).field).toBe('year');
    expect(catchApi(() => calendarMonth(db, 2026, 13, TODAY)).messageFor('he')).toMatch(/[א-ת]/);
  });

  it('returns only the days with data inside a range', () => {
    const days = calendarRange(db, '2026-08-01', '2026-09-30');
    expect(days.map((d) => d.date)).toEqual(['2026-08-15', '2026-08-28', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-05']);
    expect(days.every((d) => d.hasEntry && d.habitsTotal === 2)).toBe(true);
    expect(days[0]).toMatchObject({ mood: 4, energy: 4, stress: 6, sleepHours: 6, titles: ['אוגוסט'] });
    expect(calendarRange(db, '2026-01-01', '2026-01-31')).toEqual([]);
    expect(calendarRange(db, '2026-09-05', '2026-09-05')).toHaveLength(1);
  });

  it('validates the range', () => {
    expect(validateRange('2026-09-01', '2026-09-30')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(catchApi(() => validateRange('2026-09-10', '2026-09-01')).field).toBe('from');
    expect(catchApi(() => validateRange('x', '2026-09-01')).field).toBe('from');
    expect(catchApi(() => validateRange('2026-09-01', '2026-13-01')).field).toBe('to');
    expect(catchApi(() => validateRange('2025-01-01', '2026-12-31')).field).toBe('to');
    expect(validateRange('2026-01-01', addDays('2026-01-01', MAX_RANGE_DAYS - 1)).to).toBe(addDays('2026-01-01', MAX_RANGE_DAYS - 1));
    expect(catchApi(() => validateRange('2026-01-01', addDays('2026-01-01', MAX_RANGE_DAYS))).field).toBe('to');
  });
});

describe('homeSummary', () => {
  it('summarises today, the last entry, the week and the habits', async () => {
    const db = await DiaryDb.create();
    const ids = seedSmallDiary(db);
    const home = homeSummary(db, TODAY, 'he');
    expect(home.today).toBe(TODAY);
    expect(home.todayWeekday).toBe('יום שני');
    expect(home.todayEntryCount).toBe(0);
    expect(home.entryStreak).toBe(0); // the last entry was two days ago
    expect(home.lastEntry).toMatchObject({ id: ids.entries.evening, date: '2026-09-05', time: '21:00', title: 'ערב', mood: 5, emotions: ['bored'] });
    expect(home.weekMoodAvg).toBe(5.75);
    expect(home.weekEnergyAvg).toBe(5.33);
    expect(home.weekStressAvg).toBe(5);
    expect(home.weekSleepAvg).toBe(6.13);
    expect(home.habitsToday.map((h) => h.habit.name)).toEqual(['מים', 'ספורט']);
    expect(home.habitsToday[0].today).toBeNull();
    expect(home.habitsToday[0].completedLast30).toBe(1);
    expect(home.habitsToday[1].targetMet).toBe(false);
    expect(home.totalEntries).toBe(8);
    if (home.topInsight) expect(home.topInsight.score).toBeGreaterThan(0);
    db.close();
  });

  it('counts the writing streak up to today or yesterday', async () => {
    const db = await DiaryDb.create();
    expect(entryStreak(db, TODAY)).toBe(0);
    insertEntry(db, { date: '2026-09-05', title: 'א' });
    insertEntry(db, { date: '2026-09-06', title: 'ב' });
    expect(entryStreak(db, TODAY)).toBe(2); // alive: yesterday has an entry
    insertEntry(db, { date: TODAY, time: '08:00', title: 'ג' });
    insertEntry(db, { date: TODAY, time: '20:00', title: 'ד' }); // a second entry on the same day counts once
    expect(entryStreak(db, TODAY)).toBe(3);
    const home = homeSummary(db, TODAY, 'he');
    expect(home.entryStreak).toBe(3);
    expect(home.todayEntryCount).toBe(2);
    expect(home.lastEntry?.title).toBe('ד');
    expect(home.weekMoodAvg).toBeNull();
    expect(home.habitsToday).toEqual([]);
    // A gap breaks the streak.
    db.run('DELETE FROM entries WHERE date = ?', ['2026-09-06']);
    expect(entryStreak(db, TODAY)).toBe(1);
    db.run('DELETE FROM entries WHERE date = ?', [TODAY]);
    expect(entryStreak(db, TODAY)).toBe(0);
    // Future-dated entries never count.
    insertEntry(db, { date: addDays(TODAY, 1), title: 'מחר' });
    expect(entryStreak(db, TODAY)).toBe(0);
    db.close();
  });

  it('picks the insight with the highest score', () => {
    expect(pickTopInsight([])).toBeNull();
    const mk = (id: string, score: number) => ({ id, score }) as unknown as import('@shared/types').Insight;
    expect(pickTopInsight([mk('a', 1), mk('b', 3), mk('c', 2)])?.id).toBe('b');
    expect(pickTopInsight([mk('a', 2), mk('b', 2)])?.id).toBe('a');
  });
});

describe('stats and calendar routes', () => {
  afterAll(() => cleanupTempDirs());

  it('serves the overview, the calendar and the home summary', async () => {
    const t = await makeTestApp();
    seedSmallDiary(t.db);
    const stats = await t.get('/api/stats?period=7d');
    expect(stats.status).toBe(200);
    expect((stats.body as StatsOverview).mood.points).toHaveLength(7);
    expect((stats.body as StatsOverview).to).toBe(todayIso());
    expect((await t.get('/api/stats')).body.period).toBe('30d');
    expect((await t.get('/api/stats?period=2w')).body).toMatchObject({ code: 'VALIDATION', field: 'period' });

    const month = await t.get('/api/calendar/month?year=2026&month=9');
    expect(month.status).toBe(200);
    expect(month.body.days).toHaveLength(daysInMonth(2026, 9));
    expect(month.body.days[0].titles).toEqual(['יום מעולה']);
    expect((await t.get('/api/calendar/month?year=2026')).body).toMatchObject({ code: 'VALIDATION', field: 'month' });
    expect((await t.get('/api/calendar/month?year=abc&month=1')).body.field).toBe('year');

    const range = await t.get('/api/calendar/range?from=2026-09-01&to=2026-09-30');
    expect(range.status).toBe(200);
    expect(range.body.map((d: { date: string }) => d.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-05']);
    expect((await t.get('/api/calendar/range?from=2026-09-01')).body.field).toBe('to');

    const home = await t.get('/api/home');
    expect(home.status).toBe(200);
    expect(home.body.today).toBe(todayIso());
    expect(home.body.totalEntries).toBe(8);
    expect((await t.anon().get('/api/home')).status).toBe(401);
  });
});
