import { describe, expect, it } from 'vitest';
import { EMOTIONS, habitTemplateName, habitTemplateUnit } from '@shared/constants';
import type { Entry } from '@shared/types';
import { DiaryDb } from '../src/db/database';
import { createEntry, listEntriesFull, validateEntryInput } from '../src/db/entries-repo';
import { createHabit, listAllLogs, listHabits, validateHabitInput } from '../src/db/habits-repo';
import { generateInsights } from '../src/analysis/engine';
import { mulberry32, SEED_READING_TARGET, seedDemoData, seedHabitNames } from '../src/db/seed';
import { ApiError } from '../src/errors';
import { addDays, weekday, weekStart } from '../src/util/dates';
import { sampleEntry } from './helpers';

const TODAY = '2026-09-08';

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Strips ids and timestamps so two independent seeds can be compared. */
function stripEntry(e: Entry) {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = e;
  return rest;
}

const VALENCE = new Map(EMOTIONS.map((e) => [e.key, e.valence]));

describe('mulberry32', () => {
  it('is deterministic and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(seqA).size).toBeGreaterThan(15);
    expect(Array.from({ length: 5 }, mulberry32(7))).not.toEqual(seqA.slice(0, 5));
  });
});

describe('seedDemoData', () => {
  it('is deterministic for the same days and seed', async () => {
    const a = await DiaryDb.create();
    const b = await DiaryDb.create();
    const ra = seedDemoData(a, 60, 42, TODAY);
    const rb = seedDemoData(b, 60, 42, TODAY);
    expect(ra).toEqual(rb);
    expect(ra.habits).toBe(5);
    expect(ra.entries).toBeGreaterThan(40);
    expect(ra.habitLogs).toBeGreaterThan(100);

    const ea = listEntriesFull(a, null, null);
    const eb = listEntriesFull(b, null, null);
    expect(ea).toHaveLength(ra.entries);
    expect(stripEntry(ea[0])).toEqual(stripEntry(eb[0]));
    expect(ea.map(stripEntry)).toEqual(eb.map(stripEntry));
    expect(listAllLogs(a, null, null).map(({ id: _i, ...l }) => l)).toEqual(listAllLogs(b, null, null).map(({ id: _i, ...l }) => l));
  });

  it('produces different data for a different seed', async () => {
    const a = await DiaryDb.create();
    const b = await DiaryDb.create();
    seedDemoData(a, 60, 42, TODAY);
    seedDemoData(b, 60, 43, TODAY);
    const ea = listEntriesFull(a, null, null).map(stripEntry);
    const eb = listEntriesFull(b, null, null).map(stripEntry);
    expect(ea).not.toEqual(eb);
  });

  it('refuses to run when the diary is not empty', async () => {
    const withEntry = await DiaryDb.create();
    createEntry(withEntry, validateEntryInput(sampleEntry()));
    const e1 = (() => {
      try {
        seedDemoData(withEntry, 30, 1, TODAY);
      } catch (e) {
        return e as ApiError;
      }
      return null;
    })();
    expect(e1).toBeInstanceOf(ApiError);
    expect(e1!.code).toBe('VALIDATION');

    const withHabit = await DiaryDb.create();
    createHabit(withHabit, validateHabitInput({ name: 'x', target: 1, frequency: 'daily' }));
    expect(() => seedDemoData(withHabit, 30, 1, TODAY)).toThrow(ApiError);

    const seeded = await DiaryDb.create();
    seedDemoData(seeded, 30, 1, TODAY);
    expect(() => seedDemoData(seeded, 30, 1, TODAY)).toThrow(ApiError);
  });

  it('validates the number of days', async () => {
    const db = await DiaryDb.create();
    for (const bad of [0, 3, 731, 2.5, Number.NaN]) {
      let err: ApiError | null = null;
      try {
        seedDemoData(db, bad, 42, TODAY);
      } catch (e) {
        err = e as ApiError;
      }
      expect(err?.field).toBe('days');
    }
    expect(listHabits(db, true)).toHaveLength(0);
  });

  describe('planted patterns (120 days, seed 42)', () => {
    let entries: Entry[] = [];
    let dbRef: DiaryDb;

    async function ensure(): Promise<void> {
      if (entries.length) return;
      dbRef = await DiaryDb.create();
      seedDemoData(dbRef, 120, 42, TODAY, 'he');
      entries = listEntriesFull(dbRef, null, null);
    }

    it('creates the five template habits with the weekly exercise habit', async () => {
      await ensure();
      const habits = listHabits(dbRef, true);
      expect(habits.map((h) => h.name)).toEqual(seedHabitNames('he'));
      expect(habits.find((h) => h.name === 'פעילות גופנית')!.frequency).toBe('weekly');
      expect(habits.filter((h) => h.frequency === 'daily')).toHaveLength(4);
      expect(habits.every((h) => !h.isArchived)).toBe(true);
    });

    it('covers about 85% of the days with at most two entries each', async () => {
      await ensure();
      const perDay = new Map<string, number>();
      for (const e of entries) perDay.set(e.date, (perDay.get(e.date) ?? 0) + 1);
      expect(perDay.size).toBeGreaterThan(120 * 0.75);
      expect(perDay.size).toBeLessThan(120 * 0.95);
      expect([...perDay.values()].every((n) => n <= 2)).toBe(true);
      expect([...perDay.values()].some((n) => n === 2)).toBe(true);
      const first = addDays(TODAY, -119);
      expect(entries.every((e) => e.date >= first && e.date <= TODAY)).toBe(true);
      expect(entries.every((e) => e.mood !== null && e.energy !== null && e.stress !== null)).toBe(true);
      expect(entries.every((e) => e.title.length > 0 && e.body.length > 20)).toBe(true);
    });

    it('short sleep (< 6h) comes with clearly lower mood', async () => {
      await ensure();
      const low = entries.filter((e) => e.sleepHours !== null && e.sleepHours < 6).map((e) => e.mood!);
      const ok = entries.filter((e) => e.sleepHours !== null && e.sleepHours >= 6).map((e) => e.mood!);
      expect(low.length).toBeGreaterThanOrEqual(10);
      expect(ok.length).toBeGreaterThanOrEqual(30);
      expect(mean(ok) - mean(low)).toBeGreaterThan(1);
    });

    it('exercise days come with clearly higher energy', async () => {
      await ensure();
      const withEx = entries.filter((e) => (e.exerciseMinutes ?? 0) > 0).map((e) => e.energy!);
      const without = entries.filter((e) => e.exerciseMinutes === 0).map((e) => e.energy!);
      expect(withEx.length).toBeGreaterThanOrEqual(20);
      expect(without.length).toBeGreaterThanOrEqual(20);
      expect(mean(withEx) - mean(without)).toBeGreaterThan(1);
      // Some days are "not reported" (null) - never treated as zero.
      expect(entries.some((e) => e.exerciseMinutes === null && e.sleepHours !== null)).toBe(true);
    });

    it('Sundays come with clearly higher stress', async () => {
      await ensure();
      const sundays = entries.filter((e) => weekday(e.date) === 0).map((e) => e.stress!);
      const others = entries.filter((e) => weekday(e.date) !== 0).map((e) => e.stress!);
      expect(sundays.length).toBeGreaterThanOrEqual(10);
      expect(mean(sundays) - mean(others)).toBeGreaterThan(1);
    });

    it('entries written between 10:00 and 13:00 have higher mood than evening entries', async () => {
      await ensure();
      const midday = entries.filter((e) => e.time >= '10:00' && e.time < '13:00').map((e) => e.mood!);
      const evening = entries.filter((e) => e.time >= '18:00').map((e) => e.mood!);
      expect(midday.length).toBeGreaterThanOrEqual(15);
      expect(evening.length).toBeGreaterThanOrEqual(30);
      expect(mean(midday) - mean(evening)).toBeGreaterThan(0.5);
    });

    it('weeks with at least four days of reading at the target have higher mood', async () => {
      await ensure();
      const reading = listHabits(dbRef, true).find((h) => h.name === 'קריאה')!;
      expect(reading.target).toBe(SEED_READING_TARGET);
      const perWeek = new Map<string, number>();
      for (const l of listAllLogs(dbRef, null, null)) {
        if (l.habitId !== reading.id || l.value < SEED_READING_TARGET) continue;
        const ws = weekStart(l.date, 0);
        perWeek.set(ws, (perWeek.get(ws) ?? 0) + 1);
      }
      const bonus = entries.filter((e) => (perWeek.get(weekStart(e.date, 0)) ?? 0) >= 4).map((e) => e.mood!);
      const rest = entries.filter((e) => (perWeek.get(weekStart(e.date, 0)) ?? 0) < 4).map((e) => e.mood!);
      expect(bonus.length).toBeGreaterThanOrEqual(20);
      expect(rest.length).toBeGreaterThanOrEqual(20);
      expect(mean(bonus) - mean(rest)).toBeGreaterThan(1);
    });

    it('reading at the target happens only in alternate "reading weeks"', async () => {
      await ensure();
      const reading = listHabits(dbRef, true).find((h) => h.name === 'קריאה')!;
      const atTargetWeeks = new Set<string>();
      for (const l of listAllLogs(dbRef, null, null)) {
        if (l.habitId === reading.id && l.value >= SEED_READING_TARGET) atTargetWeeks.add(weekStart(l.date, 0));
      }
      for (const ws of atTargetWeeks) {
        expect(atTargetWeeks.has(addDays(ws, 7))).toBe(false);
        expect(atTargetWeeks.has(addDays(ws, -7))).toBe(false);
      }
      expect(atTargetWeeks.size).toBeGreaterThanOrEqual(7);
    });

    it('contains one very bad and one very good day', async () => {
      await ensure();
      const bad = entries.filter((e) => e.mood === 1 && e.stress === 10);
      const good = entries.filter((e) => e.mood === 10 && e.stress === 1 && e.energy === 10);
      expect(bad).toHaveLength(1);
      expect(good).toHaveLength(1);
      expect(bad[0].emotions).toContain('overwhelmed');
      expect(good[0].emotions).toContain('happy');
    });

    it('emotions follow the mood', async () => {
      await ensure();
      const high = entries.filter((e) => e.mood! >= 8);
      const low = entries.filter((e) => e.mood! <= 4);
      expect(high.length).toBeGreaterThan(10);
      expect(low.length).toBeGreaterThan(10);
      expect(high.every((e) => e.emotions.some((k) => VALENCE.get(k) === 'positive'))).toBe(true);
      expect(high.every((e) => !e.emotions.includes('sad'))).toBe(true);
      expect(low.every((e) => e.emotions.some((k) => VALENCE.get(k) === 'negative'))).toBe(true);
      expect(low.every((e) => !e.emotions.includes('happy'))).toBe(true);
      expect(entries.every((e) => e.emotions.every((k) => VALENCE.has(k)))).toBe(true);
    });

    it('logs the weekly exercise habit exactly on days with exercise minutes', async () => {
      await ensure();
      const sport = listHabits(dbRef, true).find((h) => h.name === 'פעילות גופנית')!;
      const sportDays = new Set(listAllLogs(dbRef, null, null).filter((l) => l.habitId === sport.id).map((l) => l.date));
      for (const e of entries) {
        if (e.exerciseMinutes === null) continue;
        expect(sportDays.has(e.date)).toBe(e.exerciseMinutes > 0);
      }
    });

    it('uses realistic habit values and marks completion', async () => {
      await ensure();
      const habits = new Map(listHabits(dbRef, true).map((h) => [h.id, h]));
      const logs = listAllLogs(dbRef, null, null);
      expect(logs.length).toBeGreaterThan(200);
      for (const l of logs) {
        const h = habits.get(l.habitId)!;
        expect(l.value).toBeGreaterThan(0);
        expect(l.completed).toBe(h.frequency === 'daily' ? l.value >= h.target : l.value > 0);
      }
      const water = [...habits.values()].find((h) => h.name === 'שתיית מים')!;
      const waterLogs = logs.filter((l) => l.habitId === water.id);
      expect(waterLogs.some((l) => l.completed)).toBe(true);
      expect(waterLogs.some((l) => !l.completed)).toBe(true);
    });
  });
});

describe('demo data for today', () => {
  it('never creates an entry later than the current time of today', async () => {
    const full = await DiaryDb.create();
    seedDemoData(full, 60, 42, TODAY, 'en', null);
    const todayTimes = listEntriesFull(full, TODAY, TODAY).map((e) => e.time);
    expect(todayTimes.length).toBeGreaterThan(0);

    const early = await DiaryDb.create();
    const result = seedDemoData(early, 60, 42, TODAY, 'en', '00:30');
    expect(listEntriesFull(early, TODAY, TODAY)).toEqual([]);
    expect(result.entries).toBe(listEntriesFull(full, null, null).length - todayTimes.length);
    // Earlier days are untouched.
    expect(listEntriesFull(early, null, addDays(TODAY, -1)).map(stripEntry)).toEqual(listEntriesFull(full, null, addDays(TODAY, -1)).map(stripEntry));
  });
});

describe('demo data and the analysis engine', () => {
  // The seeded data repeats with the weekday of "today", so seven consecutive days cover every case.
  const START = '2026-09-27';
  it.each(Array.from({ length: 7 }, (_, i) => addDays(START, i)))('finds every planted pattern over 3 months (today %s)', async (today) => {
    for (const locale of ['en', 'he'] as const) {
      const db = await DiaryDb.create();
      seedDemoData(db, 120, 42, today, locale);
      const reading = listHabits(db, true).find((h) => h.name === (locale === 'he' ? 'קריאה' : 'Reading'))!;
      const report = generateInsights(db, '3m', today, {}, locale);
      const byId = new Map(report.insights.map((i) => [i.id, i]));
      expect(byId.get('sleep_mood_lt6')?.evidence.effectSize).toBeLessThan(0);
      expect(byId.get('exercise_energy_days')?.evidence.effectSize).toBeGreaterThan(0);
      expect(byId.get('weekday_stress_0')?.evidence.effectSize).toBeGreaterThan(0);
      expect(byId.get(`habit_mood_${reading.id}`)?.evidence.effectSize).toBeGreaterThan(0);
    }
  });
});

// The texts of each language (server/src/db/seed-content/<locale>.ts) are checked in data-seed-content.test.ts.
describe('sample habits in a language other than Hebrew and English', () => {
  it('names the habits and their units in the diary language (no "30 minutes" in a German diary)', async () => {
    const db = await DiaryDb.create();
    seedDemoData(db, 30, 42, '2026-09-30', 'de');
    const habits = listHabits(db, true);
    expect(habits.map((h) => h.name)).toEqual(seedHabitNames('de'));
    expect(habits.map((h) => h.name)).toContain(habitTemplateName('walking', 'de'));
    const walk = habits.find((h) => h.name === habitTemplateName('walking', 'de'))!;
    expect(walk.unit).toBe(habitTemplateUnit('minutes', 'de'));
    expect(walk.unit).not.toBe('minutes');
    // Hebrew and English keep their own sample texts.
    expect(seedHabitNames('he')[0]).toBe('הליכה');
    expect(seedHabitNames('en')[0]).toBe('Walking');
  });
});
