/**
 * period-compare detector: the "more/fewer entries than last month" comparison counts the
 * first D days of both months (D = today's day of month). It must only run when the
 * analysed period actually covers that window of the previous month - a 30-day period
 * that starts on the 25th of the previous month sees that month's last days only, and
 * counting zero entries in days the dataset never saw produced a hollow "29 entries vs 0".
 */
import { describe, expect, it } from 'vitest';
import { periodCompareDetector, previousMonth } from '../src/analysis/detectors/period-compare';
import type { DetectorContext } from '../src/analysis/types';
import { buildDataset } from '../src/db/dataset';
import { DiaryDb } from '../src/db/database';
import { addDays } from '../src/util/dates';
import { insertEntry } from './raw-fixtures';

const TODAY = '2026-09-23';
const ENTRIES_ID = 'month_compare_entries';

/** One evening entry per day from `first` to `last`, plus a second entry on September days. */
async function diaryWithDailyEntries(first: string, last: string): Promise<DiaryDb> {
  const db = await DiaryDb.create();
  for (let date = first; date <= last; date = addDays(date, 1)) {
    insertEntry(db, { date, time: '20:00', mood: 6 });
    if (date >= '2026-09-01') insertEntry(db, { date, time: '11:00', mood: 7 });
  }
  return db;
}

function contextFor(db: DiaryDb, from: string | null): DetectorContext {
  return {
    ds: buildDataset(db, from, TODAY),
    today: TODAY,
    period: from ? '30d' : 'all',
    habits: [],
    firstDayOfWeek: 0,
    notes: [],
    locale: 'he',
  };
}

describe('previousMonth', () => {
  it('steps back one month, across a year boundary too', () => {
    expect(previousMonth('2026-09')).toBe('2026-08');
    expect(previousMonth('2026-01')).toBe('2025-12');
  });
});

describe('period-compare: entries per month', () => {
  it('compares the first days of both months when the period covers them', async () => {
    const db = await diaryWithDailyEntries('2026-06-01', TODAY);
    const ctx = contextFor(db, null);
    const insight = periodCompareDetector.detect(ctx).find((i) => i.id === ENTRIES_ID);
    expect(insight).toBeDefined();
    // 23 September days with two entries each vs 23 August days with one entry each.
    expect(insight?.evidence.groupACount).toBe(46);
    expect(insight?.evidence.groupBCount).toBe(23);
    expect(insight?.positive).toBe(true);
    expect(insight?.text).toContain('יותר');
    expect(insight?.text).toContain('ב-23 הימים הראשונים של ספטמבר');
    expect(insight?.text).not.toContain('(0 רשומות)');
  });

  it('is skipped when the period starts after the first day of the previous month', async () => {
    const db = await diaryWithDailyEntries('2026-06-01', TODAY);
    // The default 30-day period: 2026-08-25 .. 2026-09-23. August 1-23 are outside it.
    const ctx = contextFor(db, addDays(TODAY, -29));
    expect(ctx.ds.from).toBe('2026-08-25');
    const insights = periodCompareDetector.detect(ctx);
    expect(insights.find((i) => i.id === ENTRIES_ID)).toBeUndefined();
    // The rating comparison still runs on the days the period does contain.
    expect(insights.find((i) => i.id === 'month_compare_mood')).toBeDefined();
    expect(ctx.notes.join('\n')).not.toContain('0 רשומות');
  });

  it('says nothing when the period does not reach into the previous month at all', async () => {
    const db = await diaryWithDailyEntries('2026-06-01', TODAY);
    // 7 days: 2026-09-17 .. 2026-09-23 - August is outside the period, although the diary has it.
    const week = contextFor(db, addDays(TODAY, -6));
    expect(periodCompareDetector.detect(week)).toEqual([]);
    // Not "not enough data ... 0 days in August": the diary does have August.
    expect(week.notes).toEqual([]);
    // Starting on the previous month's last day is enough for the rating comparison to run.
    const fromAug31 = contextFor(db, '2026-08-31');
    periodCompareDetector.detect(fromAug31);
    expect(fromAug31.notes.join('\n')).not.toMatch(/0 ימים באוגוסט/);
  });

  it('is skipped when the diary did not exist in the previous month', async () => {
    const db = await diaryWithDailyEntries('2026-09-01', TODAY);
    const ctx = contextFor(db, null);
    expect(periodCompareDetector.detect(ctx).find((i) => i.id === ENTRIES_ID)).toBeUndefined();
  });
});
