/**
 * Raw-SQL fixtures shared by the export tests. The export module must not depend
 * on the repositories of other agents, so the tests insert rows directly.
 * (This file also carries a small self-test so vitest accepts it.)
 */
import { describe, expect, it } from 'vitest';
import type { Entry, Habit } from '@shared/types';
import { DiaryDb } from '../src/db/database';
import { addDays } from '../src/util/dates';

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

/** Inserts one entry row and returns its id. */
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

export function insertLog(db: DiaryDb, habitId: number, date: string, value: number, completed: boolean, note = ''): number {
  const r = db.run('INSERT INTO habit_logs (habit_id, date, value, completed, note) VALUES (?, ?, ?, ?, ?)', [
    habitId,
    date,
    value,
    completed ? 1 : 0,
    note,
  ]);
  return r.lastId;
}

/** Four Hebrew entries (no emojis) covering full, partial and empty reports. */
export const HEBREW_ENTRIES: EntrySeed[] = [
  {
    date: '2026-09-05',
    time: '21:30',
    title: 'יום רגיל',
    body: 'הרגשתי טוב היום, הלכתי ברגל ופגשתי את דנה.',
    mood: 7,
    emotions: ['calm', 'satisfied'],
    energy: 6,
    stress: 3,
    sleepQuality: 7,
    sleepHours: 7.5,
    exerciseMinutes: 30,
    exerciseType: 'הליכה',
    events: ['פגישה בעבודה'],
    people: ['דנה'],
    location: 'בית',
    notes: '',
    tags: ['עבודה'],
  },
  {
    date: '2026-09-06',
    time: '08:15',
    title: 'בוקר קשה',
    body: 'ישנתי 7.5 שעות אבל קמתי עייף.\nשורה שנייה, עם פסיק.',
    mood: 4,
    emotions: ['tired', 'stressed'],
    energy: 3,
    stress: 8,
    sleepQuality: 4,
    sleepHours: 7.5,
    exerciseMinutes: null,
    exerciseType: '',
    events: [],
    people: ['יוסי', 'רונית'],
    location: 'משרד',
    notes: 'הערה עם "מרכאות"',
    tags: ['בריאות', 'עבודה'],
  },
  {
    // Everything unreported: exercises the "—" placeholders and empty CSV cells.
    date: '2026-09-06',
    time: '22:00',
  },
  {
    date: '2026-09-07',
    time: '19:45',
    title: 'ערב עם המשפחה',
    body: 'ארוחת ערב משפחתית (בבית של סבתא).',
    mood: 9,
    emotions: ['happy', 'grateful'],
    energy: 7,
    stress: 2,
    sleepQuality: 8,
    sleepHours: 8,
    exerciseMinutes: 0,
    exerciseType: '',
    events: ['ארוחה משפחתית'],
    people: ['אמא', 'אבא'],
    location: 'בית סבתא',
    notes: 'לזכור להתקשר מחר',
    tags: ['משפחה'],
  },
];

export function seedHebrewEntries(db: DiaryDb): number[] {
  return HEBREW_ENTRIES.map((e) => insertEntry(db, e));
}

/** Inserts `count` consecutive daily entries starting at `startDate` (used for multi-page PDFs). */
export function seedManyEntries(db: DiaryDb, count: number, startDate = '2026-01-01'): void {
  for (let i = 0; i < count; i++) {
    insertEntry(db, {
      date: addDays(startDate, i),
      time: '21:00',
      title: `רשומה מספר ${i + 1}`,
      body:
        'היום היה יום מלא בעבודה ובפגישות. בערב יצאתי להליכה ארוכה בפארק ונהניתי מהאוויר הקריר. ' +
        'לפני השינה קראתי כמה עמודים בספר וכתבתי את המחשבות שלי כאן ביומן.',
      mood: 5 + (i % 5),
      emotions: i % 2 === 0 ? ['calm'] : ['tired', 'focused'],
      energy: 4 + (i % 6),
      stress: 2 + (i % 7),
      sleepQuality: 5 + (i % 5),
      sleepHours: 6 + (i % 3) * 0.5,
      exerciseMinutes: i % 3 === 0 ? 30 : null,
      exerciseType: i % 3 === 0 ? 'הליכה' : '',
      tags: ['יומיומי'],
    });
  }
}

/** A habit with three logs inside the Hebrew-entries range. */
export function seedWalkingHabit(db: DiaryDb): number {
  const id = insertHabit(db, { name: 'הליכה', description: 'הליכה יומית באוויר הפתוח', target: 30, unit: 'דקות', frequency: 'daily' });
  insertLog(db, id, '2026-09-05', 30, true);
  insertLog(db, id, '2026-09-06', 15, false, 'קצר');
  insertLog(db, id, '2026-09-07', 45, true);
  return id;
}

describe('export fixtures', () => {
  it('inserts entries, habits and logs through raw SQL', async () => {
    const db = await DiaryDb.create();
    const ids = seedHebrewEntries(db);
    expect(ids).toHaveLength(4);
    const habitId = seedWalkingHabit(db);
    expect(db.scalar<number>('SELECT COUNT(*) FROM entries')).toBe(4);
    expect(db.scalar<number>('SELECT COUNT(*) FROM habit_logs WHERE habit_id = ?', [habitId])).toBe(3);
    db.close();
  });
});
