/**
 * Raw-SQL fixtures for the analysis, search, statistics and end-to-end tests.
 *
 * Rows are inserted straight into the tables (no repository code) so these suites test
 * the modules under test against the schema only. `seedSmallDiary` is a hand-made diary
 * whose numbers the search and statistics tests assert exactly.
 */
import type { Entry, Habit } from '@shared/types';
import type { DiaryDb } from '../src/db/database';

export type EntrySeed = Partial<Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>> & { date: string };

const ENTRY_DEFAULTS: Omit<Entry, 'id' | 'createdAt' | 'updatedAt' | 'date'> = {
  time: '20:00',
  title: '',
  body: '',
  mood: null,
  emotions: [],
  energy: null,
  stress: null,
  sleepQuality: null,
  sleepHours: null,
  exerciseMinutes: null,
  exerciseType: '',
  events: [],
  people: [],
  location: '',
  notes: '',
  tags: [],
};

/** Inserts one entry row (unspecified fields are null / empty) and returns its id. */
export function insertEntry(db: DiaryDb, seed: EntrySeed): number {
  const e = { ...ENTRY_DEFAULTS, ...seed };
  const ts = `${e.date}T${e.time}:00.000Z`;
  const r = db.run(
    `INSERT INTO entries (date, time, title, body, mood, emotions_json, energy, stress, sleep_quality, sleep_hours,
                          exercise_minutes, exercise_type, events_json, people_json, location, notes, tags_json,
                          created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      e.date,
      e.time,
      e.title,
      e.body,
      e.mood,
      JSON.stringify(e.emotions),
      e.energy,
      e.stress,
      e.sleepQuality,
      e.sleepHours,
      e.exerciseMinutes,
      e.exerciseType,
      JSON.stringify(e.events),
      JSON.stringify(e.people),
      e.location,
      e.notes,
      JSON.stringify(e.tags),
      ts,
      ts,
    ],
  );
  return r.lastId;
}

export type HabitSeed = Partial<Omit<Habit, 'id' | 'createdAt'>> & { name: string };

/** Inserts one habit row and returns its id. */
export function insertHabit(db: DiaryDb, seed: HabitSeed): number {
  const h: Omit<Habit, 'id' | 'createdAt'> = {
    description: '',
    target: 1,
    unit: '',
    frequency: 'daily',
    reminderTime: null,
    reminderEnabled: false,
    isArchived: false,
    sortOrder: 0,
    ...seed,
  };
  const r = db.run(
    `INSERT INTO habits (name, description, target, unit, frequency, reminder_time, reminder_enabled, is_archived, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      h.name,
      h.description,
      h.target,
      h.unit,
      h.frequency,
      h.reminderTime,
      h.reminderEnabled ? 1 : 0,
      h.isArchived ? 1 : 0,
      h.sortOrder,
      '2026-01-01T00:00:00.000Z',
    ],
  );
  return r.lastId;
}

/** Inserts (or replaces) the log of one habit on one day. `completed` follows the habit rules. */
export function insertLog(db: DiaryDb, habitId: number, date: string, value: number, completed: boolean, note = ''): number {
  const r = db.run(
    `INSERT INTO habit_logs (habit_id, date, value, completed, note) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(habit_id, date) DO UPDATE SET value = excluded.value, completed = excluded.completed, note = excluded.note`,
    [habitId, date, value, completed ? 1 : 0, note],
  );
  return r.lastId;
}

export function countRows(db: DiaryDb, table: string): number {
  return Number(db.scalar<number>(`SELECT COUNT(*) FROM ${table}`) ?? 0);
}

/** Ids of the rows created by `seedSmallDiary`. */
export interface SmallDiary {
  entries: Record<string, number>;
  water: number;
  sport: number;
}

/**
 * A small hand-made diary (relative to today = 2026-09-07, a Monday):
 *
 *   2026-07-20 יולי     mood 8            sleep 7.5                       body "חופשה"
 *   2026-08-15 אוגוסט   mood 4 en 4 st 6  sleep 6    people [יוסי]        body "פגישה בעבודה עם יוסי"
 *   2026-08-28 סוף אוגוסט mood 5 en 6 st 5 sleep 6.5
 *   2026-09-01 יום מעולה mood 9 en 8 st 2 sleep 8 ex 40 people [דנה] happy  body "הלכתי לים עם דנה, היה כיף"
 *   2026-09-02 יום רגיל  mood 6 en 5 st 4  sleep 7  ex 0                  calm
 *   2026-09-03 יום קשה   mood 2 en 3 st 9  sleep 4.5                      tired, stressed  body "הייתי עייף מאוד בעבודה"
 *   2026-09-05 09:00 בוקר mood 7           sleep 5                        body "קמתי מוקדם"
 *   2026-09-05 21:00 ערב  mood 5                                          bored
 *
 * Habits: "מים" (daily, target 8): 09-01 = 8 (completed), 09-02 = 3.
 *         "ספורט" (weekly, target 2): 09-01 = 1, 09-03 = 1 (the week 08-30..09-05 meets the target).
 */
export function seedSmallDiary(db: DiaryDb): SmallDiary {
  const entries: Record<string, number> = {};
  entries.july = insertEntry(db, { date: '2026-07-20', time: '19:00', title: 'יולי', body: 'חופשה', mood: 8, sleepHours: 7.5 });
  entries.august = insertEntry(db, {
    date: '2026-08-15',
    time: '20:00',
    title: 'אוגוסט',
    body: 'פגישה בעבודה עם יוסי',
    mood: 4,
    energy: 4,
    stress: 6,
    sleepHours: 6,
    people: ['יוסי'],
    tags: ['עבודה'],
  });
  entries.lateAugust = insertEntry(db, { date: '2026-08-28', time: '20:00', title: 'סוף אוגוסט', mood: 5, energy: 6, stress: 5, sleepHours: 6.5 });
  entries.great = insertEntry(db, {
    date: '2026-09-01',
    time: '20:00',
    title: 'יום מעולה',
    body: 'הלכתי לים עם דנה, היה כיף',
    mood: 9,
    energy: 8,
    stress: 2,
    sleepHours: 8,
    exerciseMinutes: 40,
    exerciseType: 'הליכה',
    people: ['דנה'],
    emotions: ['happy'],
    location: 'חוף',
  });
  entries.normal = insertEntry(db, {
    date: '2026-09-02',
    time: '20:00',
    title: 'יום רגיל',
    body: 'יום שגרתי',
    mood: 6,
    energy: 5,
    stress: 4,
    sleepHours: 7,
    exerciseMinutes: 0,
    emotions: ['calm'],
  });
  entries.hard = insertEntry(db, {
    date: '2026-09-03',
    time: '20:00',
    title: 'יום קשה',
    body: 'הייתי עייף מאוד בעבודה',
    mood: 2,
    energy: 3,
    stress: 9,
    sleepHours: 4.5,
    emotions: ['tired', 'stressed'],
    tags: ['עבודה'],
  });
  entries.morning = insertEntry(db, { date: '2026-09-05', time: '09:00', title: 'בוקר', body: 'קמתי מוקדם', mood: 7, sleepHours: 5 });
  entries.evening = insertEntry(db, { date: '2026-09-05', time: '21:00', title: 'ערב', body: 'ערב שקט', mood: 5, emotions: ['bored'] });

  const water = insertHabit(db, { name: 'מים', target: 8, unit: 'כוסות', frequency: 'daily', sortOrder: 0 });
  insertLog(db, water, '2026-09-01', 8, true);
  insertLog(db, water, '2026-09-02', 3, false);
  const sport = insertHabit(db, { name: 'ספורט', target: 2, unit: 'פעמים', frequency: 'weekly', sortOrder: 1 });
  insertLog(db, sport, '2026-09-01', 1, true);
  insertLog(db, sport, '2026-09-03', 1, true);
  return { entries, water, sport };
}
