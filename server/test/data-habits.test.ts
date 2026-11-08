import { beforeEach, describe, expect, it } from 'vitest';
import type { Habit, HabitLog } from '@shared/types';
import { DiaryDb } from '../src/db/database';
import {
  createHabit,
  deleteHabit,
  deleteHabitLog,
  getHabit,
  HABIT_LIMITS,
  habitDayStatuses,
  habitStreaks,
  habitsWithProgress,
  listAllLogs,
  listHabits,
  listLogs,
  logHabit,
  reorderHabits,
  setArchived,
  updateHabit,
  validateHabitInput,
  validateHabitLogInput,
} from '../src/db/habits-repo';
import { saveSettings } from '../src/db/settings-repo';
import { ApiError } from '../src/errors';
import { addDays, todayIso } from '../src/util/dates';

const HEBREW = /[א-ת]/;

function catchApi(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('expected an ApiError to be thrown');
}

function habitInput(over: Record<string, unknown> = {}) {
  return {
    name: 'שתיית מים',
    description: 'כוסות מים ביום',
    target: 8,
    unit: 'כוסות',
    frequency: 'daily',
    reminderTime: null,
    reminderEnabled: false,
    ...over,
  };
}

/** In-memory habit used by the pure streak tests. */
function fakeHabit(over: Partial<Habit> = {}): Habit {
  return {
    id: 1,
    name: 'הרגל',
    description: '',
    target: 1,
    unit: '',
    frequency: 'daily',
    reminderTime: null,
    reminderEnabled: false,
    isArchived: false,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function fakeLogs(habit: Habit, entries: [string, number][]): HabitLog[] {
  return entries.map(([date, value], i) => ({
    id: i + 1,
    habitId: habit.id,
    date,
    value,
    completed: habit.frequency === 'daily' ? value >= habit.target : value > 0,
    note: '',
  }));
}

describe('validateHabitInput', () => {
  it('accepts and trims a valid habit', () => {
    const input = validateHabitInput(habitInput({ name: '  קריאה ', unit: ' דקות ', reminderTime: '21:00', reminderEnabled: true }));
    expect(input).toEqual({
      name: 'קריאה',
      description: 'כוסות מים ביום',
      target: 8,
      unit: 'דקות',
      frequency: 'daily',
      reminderTime: '21:00',
      reminderEnabled: true,
    });
  });

  it('defaults optional fields', () => {
    expect(validateHabitInput({ name: 'א', target: 1, frequency: 'weekly' })).toEqual({
      name: 'א',
      description: '',
      target: 1,
      unit: '',
      frequency: 'weekly',
      reminderTime: null,
      reminderEnabled: false,
    });
  });

  it.each<[Record<string, unknown>, string]>([
    [{ name: '' }, 'name'],
    [{ name: '   ' }, 'name'],
    [{ name: 'א'.repeat(HABIT_LIMITS.nameMax + 1) }, 'name'],
    [{ name: 5 }, 'name'],
    [{ description: 'א'.repeat(HABIT_LIMITS.descriptionMax + 1) }, 'description'],
    [{ target: 0 }, 'target'],
    [{ target: -3 }, 'target'],
    [{ target: '8' }, 'target'],
    [{ target: Number.POSITIVE_INFINITY }, 'target'],
    [{ unit: 'א'.repeat(HABIT_LIMITS.unitMax + 1) }, 'unit'],
    [{ frequency: 'monthly' }, 'frequency'],
    [{ reminderTime: '9:00' }, 'reminderTime'],
    [{ reminderTime: '24:00' }, 'reminderTime'],
    [{ reminderEnabled: true, reminderTime: null }, 'reminderTime'],
    [{ reminderEnabled: 'yes' }, 'reminderEnabled'],
  ])('rejects %j with field %s', (over, field) => {
    const err = catchApi(() => validateHabitInput(habitInput(over)));
    expect(err.code).toBe('VALIDATION');
    expect(err.field).toBe(field);
    expect(err.messageFor('he')).toMatch(HEBREW);
  });
});

describe('validateHabitLogInput', () => {
  it('accepts a valid log and trims the note', () => {
    expect(validateHabitLogInput({ habitId: 3, date: '2026-09-07', value: 2.5, note: ' טוב ' })).toEqual({
      habitId: 3,
      date: '2026-09-07',
      value: 2.5,
      note: 'טוב',
    });
    expect(validateHabitLogInput({ habitId: 3, date: '2026-09-07', value: 0 }).note).toBe('');
  });

  it.each<[Record<string, unknown>, string]>([
    [{ habitId: 0 }, 'habitId'],
    [{ habitId: '3' }, 'habitId'],
    [{ habitId: 1.5 }, 'habitId'],
    [{ date: '2026-9-7' }, 'date'],
    [{ value: -1 }, 'value'],
    [{ value: 'x' }, 'value'],
    [{ value: Number.NaN }, 'value'],
    [{ note: 'א'.repeat(HABIT_LIMITS.noteMax + 1) }, 'note'],
    [{ note: 12 }, 'note'],
  ])('rejects %j with field %s', (over, field) => {
    const err = catchApi(() => validateHabitLogInput({ habitId: 3, date: '2026-09-07', value: 1, ...over }));
    expect(err.field).toBe(field);
    expect(err.messageFor('he')).toMatch(HEBREW);
  });
});

describe('habits CRUD', () => {
  let db: DiaryDb;
  beforeEach(async () => {
    db = await DiaryDb.create();
  });

  it('creates habits with increasing sort order and lists them', () => {
    const a = createHabit(db, validateHabitInput(habitInput({ name: 'א' })));
    const b = createHabit(db, validateHabitInput(habitInput({ name: 'ב', frequency: 'weekly', target: 3 })));
    expect(a.sortOrder).toBe(0);
    expect(b.sortOrder).toBe(1);
    expect(a.isArchived).toBe(false);
    expect(a.createdAt).toMatch(/^\d{4}-/);
    expect(listHabits(db, false).map((h) => h.name)).toEqual(['א', 'ב']);
    expect(getHabit(db, b.id)).toEqual(b);
  });

  it('updates a habit and recomputes completion flags of existing logs', () => {
    const h = createHabit(db, validateHabitInput(habitInput({ target: 10 })));
    const log = logHabit(db, { habitId: h.id, date: '2026-09-07', value: 7 });
    expect(log.completed).toBe(false);
    const updated = updateHabit(db, h.id, validateHabitInput(habitInput({ target: 5, name: 'מים' })));
    expect(updated.target).toBe(5);
    expect(updated.name).toBe('מים');
    expect(listLogs(db, h.id, null, null)[0].completed).toBe(true);
    // Switching to weekly: any positive value counts as a contribution.
    updateHabit(db, h.id, validateHabitInput(habitInput({ target: 50, frequency: 'weekly' })));
    expect(listLogs(db, h.id, null, null)[0].completed).toBe(true);
  });

  it('archives and un-archives; list excludes archived unless asked', () => {
    const h = createHabit(db, validateHabitInput(habitInput()));
    createHabit(db, validateHabitInput(habitInput({ name: 'אחר' })));
    expect(setArchived(db, h.id, true).isArchived).toBe(true);
    expect(listHabits(db, false).map((x) => x.name)).toEqual(['אחר']);
    expect(listHabits(db, true).map((x) => x.name)).toEqual(['שתיית מים', 'אחר']);
    expect(setArchived(db, h.id, false).isArchived).toBe(false);
    expect(listHabits(db, false)).toHaveLength(2);
  });

  it('reorders: listed ids first, others keep their relative order', () => {
    const a = createHabit(db, validateHabitInput(habitInput({ name: 'א' })));
    const b = createHabit(db, validateHabitInput(habitInput({ name: 'ב' })));
    const c = createHabit(db, validateHabitInput(habitInput({ name: 'ג' })));
    const result = reorderHabits(db, [c.id, a.id]);
    expect(result.map((h) => h.name)).toEqual(['ג', 'א', 'ב']);
    expect(result.map((h) => h.sortOrder)).toEqual([0, 1, 2]);
    expect(listHabits(db, true).map((h) => h.id)).toEqual([c.id, a.id, b.id]);
    expect(catchApi(() => reorderHabits(db, [a.id, 999])).field).toBe('ids');
    expect(catchApi(() => reorderHabits(db, [a.id, a.id])).field).toBe('ids');
    expect(catchApi(() => reorderHabits(db, [-1])).field).toBe('ids');
  });

  it('deletes a habit together with its logs', () => {
    const h = createHabit(db, validateHabitInput(habitInput()));
    logHabit(db, { habitId: h.id, date: '2026-09-07', value: 8 });
    logHabit(db, { habitId: h.id, date: '2026-09-06', value: 8 });
    deleteHabit(db, h.id);
    expect(listHabits(db, true)).toHaveLength(0);
    expect(db.scalar<number>('SELECT COUNT(*) FROM habit_logs')).toBe(0);
  });

  it('throws NOT_FOUND for unknown habits', () => {
    expect(catchApi(() => getHabit(db, 42)).status).toBe(404);
    expect(catchApi(() => updateHabit(db, 42, validateHabitInput(habitInput()))).status).toBe(404);
    expect(catchApi(() => setArchived(db, 42, true)).status).toBe(404);
    expect(catchApi(() => deleteHabit(db, 42)).status).toBe(404);
    expect(catchApi(() => listLogs(db, 42, null, null)).status).toBe(404);
    expect(catchApi(() => logHabit(db, { habitId: 42, date: '2026-09-07', value: 1 })).status).toBe(404);
  });
});

describe('habit logs', () => {
  let db: DiaryDb;
  let daily: Habit;
  let weekly: Habit;
  beforeEach(async () => {
    db = await DiaryDb.create();
    daily = createHabit(db, validateHabitInput(habitInput({ target: 8 })));
    weekly = createHabit(db, validateHabitInput(habitInput({ name: 'ספורט', target: 3, frequency: 'weekly', unit: 'פעמים' })));
  });

  it('upserts by habit + date', () => {
    const first = logHabit(db, { habitId: daily.id, date: '2026-09-07', value: 3, note: 'התחלה' });
    expect(first).toMatchObject({ habitId: daily.id, date: '2026-09-07', value: 3, completed: false, note: 'התחלה' });
    const second = logHabit(db, { habitId: daily.id, date: '2026-09-07', value: 9 });
    expect(second.id).toBe(first.id);
    expect(second.value).toBe(9);
    expect(second.completed).toBe(true);
    expect(second.note).toBe('');
    expect(listLogs(db, daily.id, null, null)).toHaveLength(1);
  });

  it('computes completed: daily value >= target, weekly value > 0', () => {
    expect(logHabit(db, { habitId: daily.id, date: '2026-09-01', value: 8 }).completed).toBe(true);
    expect(logHabit(db, { habitId: daily.id, date: '2026-09-02', value: 7.5 }).completed).toBe(false);
    expect(logHabit(db, { habitId: weekly.id, date: '2026-09-01', value: 1 }).completed).toBe(true);
    expect(logHabit(db, { habitId: weekly.id, date: '2026-09-02', value: 0 }).completed).toBe(false);
  });

  it('lists logs by range, all logs, and day statuses', () => {
    for (let d = 1; d <= 5; d++) logHabit(db, { habitId: daily.id, date: `2026-09-0${d}`, value: d * 2 });
    logHabit(db, { habitId: weekly.id, date: '2026-09-03', value: 1 });
    expect(listLogs(db, daily.id, '2026-09-02', '2026-09-04').map((l) => l.date)).toEqual(['2026-09-02', '2026-09-03', '2026-09-04']);
    expect(listLogs(db, daily.id, '2026-09-04', null).map((l) => l.value)).toEqual([8, 10]);
    expect(listAllLogs(db, '2026-09-03', '2026-09-03').map((l) => l.habitId)).toEqual([daily.id, weekly.id]);
    expect(listAllLogs(db, null, null)).toHaveLength(6);
    const statuses = habitDayStatuses(db, '2026-09-03', '2026-09-04');
    expect(statuses).toEqual([
      { habitId: daily.id, habitName: 'שתיית מים', date: '2026-09-03', value: 6, completed: false },
      { habitId: weekly.id, habitName: 'ספורט', date: '2026-09-03', value: 1, completed: true },
      { habitId: daily.id, habitName: 'שתיית מים', date: '2026-09-04', value: 8, completed: true },
    ]);
    expect(catchApi(() => listLogs(db, daily.id, 'x', null)).field).toBe('from');
  });

  it('deletes a log and reports NOT_FOUND when it does not exist', () => {
    logHabit(db, { habitId: daily.id, date: '2026-09-07', value: 8 });
    deleteHabitLog(db, daily.id, '2026-09-07');
    expect(listLogs(db, daily.id, null, null)).toHaveLength(0);
    expect(catchApi(() => deleteHabitLog(db, daily.id, '2026-09-07')).status).toBe(404);
    expect(catchApi(() => deleteHabitLog(db, 999, '2026-09-07')).status).toBe(404);
    expect(catchApi(() => deleteHabitLog(db, daily.id, 'bad')).field).toBe('date');
  });
});

describe('habitStreaks - daily', () => {
  const habit = fakeHabit({ target: 8, frequency: 'daily' });
  const asOf = '2026-09-08';
  const d = (n: number) => addDays(asOf, n);

  it.each<[string, [string, number][], number, number]>([
    ['no logs', [], 0, 0],
    ['run ending yesterday, today not logged yet', [[d(-4), 8], [d(-3), 9], [d(-2), 8], [d(-1), 10]], 4, 4],
    ['run including today', [[d(-4), 8], [d(-3), 9], [d(-2), 8], [d(-1), 10], [d(0), 8]], 5, 5],
    ['today logged but below target keeps the run alive', [[d(-2), 8], [d(-1), 8], [d(0), 3]], 2, 2],
    ['gap breaks the current run; best remembers the longer one', [[d(-9), 8], [d(-8), 8], [d(-7), 8], [d(-6), 8], [d(-4), 8], [d(-3), 8], [d(-1), 8]], 1, 4],
    ['not completed days do not count', [[d(-3), 8], [d(-2), 2], [d(-1), 8]], 1, 1],
    ['run ended two days ago', [[d(-5), 8], [d(-4), 8], [d(-3), 8]], 0, 3],
    ['logs after asOf are ignored', [[d(-1), 8], [d(0), 8], [d(1), 8], [d(2), 8]], 2, 2],
    ['logs of another habit are ignored', [[d(-1), 8]], 1, 1],
  ])('%s', (_label, entries, current, best) => {
    const logs = fakeLogs(habit, entries);
    // Add a foreign log to make sure filtering by habit id works.
    logs.push({ id: 999, habitId: 77, date: d(-2), value: 8, completed: true, note: '' });
    expect(habitStreaks(habit, logs, asOf, 0)).toEqual({ current, best });
  });
});

describe('habitStreaks - weekly', () => {
  // 2026-09-08 is a Tuesday. Sunday-start weeks: 09-06..09-12, 08-30..09-05, 08-23..08-29, 08-16..08-22.
  const habit = fakeHabit({ target: 3, frequency: 'weekly' });
  const asOf = '2026-09-08';

  it('counts consecutive weeks meeting the target, starting at the previous week when this week is not met yet', () => {
    const logs = fakeLogs(habit, [
      ['2026-09-06', 1],
      ['2026-09-07', 1], // this week: 2 < 3
      ['2026-08-30', 1],
      ['2026-09-01', 1],
      ['2026-09-03', 1], // previous week: 3
      ['2026-08-24', 2],
      ['2026-08-26', 1], // two weeks ago: 3
      ['2026-08-10', 3], // four weeks ago (gap at 08-16..08-22)
    ]);
    expect(habitStreaks(habit, logs, asOf, 0)).toEqual({ current: 2, best: 2 });
  });

  it('includes the current week once it is met', () => {
    const logs = fakeLogs(habit, [
      ['2026-09-06', 2],
      ['2026-09-08', 1],
      ['2026-08-31', 3],
    ]);
    expect(habitStreaks(habit, logs, asOf, 0)).toEqual({ current: 2, best: 2 });
  });

  it('best streak covers older runs', () => {
    const logs = fakeLogs(habit, [
      ['2026-07-05', 3],
      ['2026-07-12', 3],
      ['2026-07-19', 3],
      ['2026-08-30', 3],
    ]);
    expect(habitStreaks(habit, logs, asOf, 0)).toEqual({ current: 1, best: 3 });
  });

  it('respects the first day of the week', () => {
    const logs = fakeLogs(habit, [
      ['2026-09-04', 2], // Friday
      ['2026-09-06', 1], // Sunday
      ['2026-09-07', 1], // Monday
    ]);
    // Monday-start: week 08-31..09-06 sums to 3 (met); current week 09-07.. has 1 -> streak 1.
    expect(habitStreaks(habit, logs, asOf, 1)).toEqual({ current: 1, best: 1 });
    // Sunday-start: week 08-30..09-05 has 2, week 09-06..09-12 has 2 -> nothing met.
    expect(habitStreaks(habit, logs, asOf, 0)).toEqual({ current: 0, best: 0 });
  });

  it('returns zeros without logs', () => {
    expect(habitStreaks(habit, [], asOf, 0)).toEqual({ current: 0, best: 0 });
  });
});

describe('habitsWithProgress', () => {
  let db: DiaryDb;
  const today = '2026-09-08'; // Tuesday; Sunday-start week 09-06..09-12
  beforeEach(async () => {
    db = await DiaryDb.create();
  });

  it('computes today, streaks, week total, 30-day completion and targetMet for a daily habit', () => {
    const water = createHabit(db, validateHabitInput(habitInput({ target: 8 })));
    // Completed on the 5 days before today, partial today.
    for (let n = 5; n >= 1; n--) logHabit(db, { habitId: water.id, date: addDays(today, -n), value: 8 + n });
    logHabit(db, { habitId: water.id, date: today, value: 3 });
    // An old completed day inside the 30-day window and one outside it.
    logHabit(db, { habitId: water.id, date: addDays(today, -29), value: 8 });
    logHabit(db, { habitId: water.id, date: addDays(today, -30), value: 8 });

    const [p] = habitsWithProgress(db, today);
    expect(p.habit.id).toBe(water.id);
    expect(p.today).toMatchObject({ date: today, value: 3, completed: false });
    expect(p.currentStreak).toBe(5);
    expect(p.bestStreak).toBe(5);
    // Week 09-06..09-12: 09-06 (10), 09-07 (9), 09-08 (3)
    expect(p.weekTotal).toBe(22);
    expect(p.completedLast30).toBe(6);
    expect(p.completionRate30).toBe(0.2);
    expect(p.targetMet).toBe(false);

    logHabit(db, { habitId: water.id, date: today, value: 8 });
    const [q] = habitsWithProgress(db, today);
    expect(q.targetMet).toBe(true);
    expect(q.currentStreak).toBe(6);
    expect(q.completedLast30).toBe(7);
  });

  it('computes weekly habits over the last 4 weeks', () => {
    const sport = createHabit(db, validateHabitInput(habitInput({ name: 'ספורט', target: 3, frequency: 'weekly' })));
    // This week: 2 so far. Previous 3 weeks: met, not met, met.
    logHabit(db, { habitId: sport.id, date: '2026-09-06', value: 1 });
    logHabit(db, { habitId: sport.id, date: '2026-09-07', value: 1 });
    logHabit(db, { habitId: sport.id, date: '2026-08-31', value: 3 });
    logHabit(db, { habitId: sport.id, date: '2026-08-25', value: 1 });
    logHabit(db, { habitId: sport.id, date: '2026-08-18', value: 2 });
    logHabit(db, { habitId: sport.id, date: '2026-08-20', value: 1 });

    const [p] = habitsWithProgress(db, today);
    expect(p.today).toBeNull();
    expect(p.weekTotal).toBe(2);
    expect(p.targetMet).toBe(false);
    expect(p.currentStreak).toBe(1);
    expect(p.bestStreak).toBe(1);
    expect(p.completedLast30).toBe(2);
    expect(p.completionRate30).toBe(0.5);

    logHabit(db, { habitId: sport.id, date: today, value: 1 });
    const [q] = habitsWithProgress(db, today);
    expect(q.weekTotal).toBe(3);
    expect(q.targetMet).toBe(true);
    expect(q.currentStreak).toBe(2);
    expect(q.completedLast30).toBe(3);
    expect(q.completionRate30).toBe(0.75);
  });

  it('uses firstDayOfWeek from the settings', () => {
    const sport = createHabit(db, validateHabitInput(habitInput({ name: 'ספורט', target: 3, frequency: 'weekly' })));
    logHabit(db, { habitId: sport.id, date: '2026-09-06', value: 2 }); // Sunday
    logHabit(db, { habitId: sport.id, date: '2026-09-08', value: 1 }); // Tuesday
    expect(habitsWithProgress(db, today)[0].weekTotal).toBe(3);
    saveSettings(db, { firstDayOfWeek: 1 });
    // Monday-start week 09-07..09-13 excludes Sunday's log.
    expect(habitsWithProgress(db, today)[0].weekTotal).toBe(1);
  });

  it('skips archived habits and returns an empty list without habits', () => {
    expect(habitsWithProgress(db, today)).toEqual([]);
    const h = createHabit(db, validateHabitInput(habitInput()));
    setArchived(db, h.id, true);
    expect(habitsWithProgress(db, today)).toEqual([]);
    expect(catchApi(() => habitsWithProgress(db, 'nope')).field).toBe('date');
  });
});

describe('30-day completion of a new habit', () => {
  it('counts only the days (weeks) since the habit began: created and done today is 100%, not 1 of 30', async () => {
    const db = await DiaryDb.create();
    const today = todayIso();
    const walk = createHabit(db, validateHabitInput(habitInput({ name: 'Walk', target: 1 })));
    logHabit(db, { habitId: walk.id, date: today, value: 1 });
    const [p] = habitsWithProgress(db, today);
    expect(p.completedLast30).toBe(1);
    expect(p.completionRate30).toBe(1);
    // A habit whose logs go back further than its record (sample data) counts from its first log.
    const old = createHabit(db, validateHabitInput(habitInput({ name: 'Read', target: 1 })));
    logHabit(db, { habitId: old.id, date: addDays(today, -9), value: 1 });
    const progress = habitsWithProgress(db, today).find((x) => x.habit.id === old.id)!;
    expect(progress.completionRate30).toBeCloseTo(1 / 10, 3);
    // A weekly habit created this week is judged on this week only.
    const gym = createHabit(db, validateHabitInput(habitInput({ name: 'Gym', target: 1, frequency: 'weekly' })));
    logHabit(db, { habitId: gym.id, date: today, value: 1 });
    expect(habitsWithProgress(db, today).find((x) => x.habit.id === gym.id)!.completionRate30).toBe(1);
  });
});
