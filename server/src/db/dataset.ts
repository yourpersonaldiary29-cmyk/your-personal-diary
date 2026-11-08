/**
 * Builds the per-day dataset used by the analysis engine, statistics, calendar
 * and smart search. One `DayRecord` per calendar day that has at least one
 * diary entry or one habit log. Missing values stay `null` - never 0.
 */
import type { Habit, HabitFrequency } from '@shared/types';
import { type DiaryDb, jsonArray, numOrNull } from './database';
import { weekday } from '../util/dates';

export interface EntryPoint {
  /** HH:MM */
  time: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
}

export interface DayRecord {
  date: string;
  /** 0 = Sunday */
  weekday: number;
  entryCount: number;
  /** Means over the day's entries (null when no entry reported the value). */
  mood: number | null;
  energy: number | null;
  stress: number | null;
  sleepQuality: number | null;
  /** Max reported sleep hours of the day (usually one value). */
  sleepHours: number | null;
  /** Sum of reported exercise minutes; null when no entry reported it. */
  exerciseMinutes: number | null;
  /** true/false when reported, null when unknown. */
  didExercise: boolean | null;
  /** Per-entry ratings with time, for time-of-day analysis. */
  points: EntryPoint[];
  emotions: string[];
  tags: string[];
  people: string[];
  locations: string[];
  /** habitId -> value logged that day */
  habitValues: Map<number, number>;
  /** habitId -> completed flag that day */
  habitCompleted: Map<number, boolean>;
  titles: string[];
}

export interface Dataset {
  /** Sorted ascending by date; only days with data. */
  days: DayRecord[];
  /** Active + archived habits (id -> habit). */
  habits: Map<number, Habit>;
  from: string | null;
  to: string;
}

interface EntryRow {
  id: number;
  date: string;
  time: string;
  title: string;
  mood: number | null;
  emotions_json: string;
  energy: number | null;
  stress: number | null;
  sleep_quality: number | null;
  sleep_hours: number | null;
  exercise_minutes: number | null;
  exercise_type: string;
  people_json: string;
  location: string;
  tags_json: string;
}

interface HabitRow {
  id: number;
  name: string;
  description: string;
  target: number;
  unit: string;
  frequency: string;
  reminder_time: string | null;
  reminder_enabled: number;
  is_archived: number;
  sort_order: number;
  created_at: string;
}

interface LogRow {
  habit_id: number;
  date: string;
  value: number;
  completed: number;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function habitFromRow(r: HabitRow): Habit {
  return {
    id: Number(r.id),
    name: String(r.name),
    description: String(r.description ?? ''),
    target: Number(r.target),
    unit: String(r.unit ?? ''),
    frequency: (r.frequency === 'weekly' ? 'weekly' : 'daily') as HabitFrequency,
    reminderTime: r.reminder_time ? String(r.reminder_time) : null,
    reminderEnabled: Number(r.reminder_enabled) === 1,
    isArchived: Number(r.is_archived) === 1,
    sortOrder: Number(r.sort_order),
    createdAt: String(r.created_at),
  };
}

export function loadHabits(db: DiaryDb, includeArchived = true): Habit[] {
  const rows = db.all<HabitRow>(
    `SELECT * FROM habits ${includeArchived ? '' : 'WHERE is_archived = 0'} ORDER BY sort_order, id`,
  );
  return rows.map(habitFromRow);
}

/**
 * @param from inclusive ISO date or null for unbounded
 * @param to   inclusive ISO date
 */
export function buildDataset(db: DiaryDb, from: string | null, to: string): Dataset {
  const where: string[] = ['date <= ?'];
  const params: (string | number)[] = [to];
  if (from) {
    where.unshift('date >= ?');
    params.unshift(from);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const days = new Map<string, DayRecord>();
  const ensure = (date: string): DayRecord => {
    let d = days.get(date);
    if (!d) {
      d = {
        date,
        weekday: weekday(date),
        entryCount: 0,
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
      };
      days.set(date, d);
    }
    return d;
  };

  // Entries -----------------------------------------------------------------
  const entries = db.all<EntryRow>(
    `SELECT id, date, time, title, mood, emotions_json, energy, stress, sleep_quality, sleep_hours,
            exercise_minutes, exercise_type, people_json, location, tags_json
       FROM entries ${whereSql} ORDER BY date, time`,
    params,
  );
  const acc = new Map<
    string,
    { mood: number[]; energy: number[]; stress: number[]; sq: number[]; sh: number[]; ex: number[]; exType: boolean }
  >();
  for (const r of entries) {
    const d = ensure(String(r.date));
    d.entryCount++;
    if (r.title) d.titles.push(String(r.title));
    const a = acc.get(d.date) ?? { mood: [], energy: [], stress: [], sq: [], sh: [], ex: [], exType: false };
    const mood = numOrNull(r.mood);
    const energy = numOrNull(r.energy);
    const stress = numOrNull(r.stress);
    if (mood != null) a.mood.push(mood);
    if (energy != null) a.energy.push(energy);
    if (stress != null) a.stress.push(stress);
    const sq = numOrNull(r.sleep_quality);
    if (sq != null) a.sq.push(sq);
    const sh = numOrNull(r.sleep_hours);
    if (sh != null) a.sh.push(sh);
    const ex = numOrNull(r.exercise_minutes);
    if (ex != null) a.ex.push(ex);
    if (r.exercise_type && String(r.exercise_type).trim()) a.exType = true;
    acc.set(d.date, a);
    d.points.push({ time: String(r.time), mood, energy, stress });
    for (const e of jsonArray(r.emotions_json)) if (!d.emotions.includes(e)) d.emotions.push(e);
    for (const t of jsonArray(r.tags_json)) if (!d.tags.includes(t)) d.tags.push(t);
    for (const p of jsonArray(r.people_json)) if (!d.people.includes(p)) d.people.push(p);
    if (r.location && String(r.location).trim() && !d.locations.includes(String(r.location)))
      d.locations.push(String(r.location));
  }
  for (const [date, a] of acc) {
    const d = ensure(date);
    d.mood = mean(a.mood);
    d.energy = mean(a.energy);
    d.stress = mean(a.stress);
    d.sleepQuality = mean(a.sq);
    d.sleepHours = a.sh.length ? Math.max(...a.sh) : null;
    d.exerciseMinutes = a.ex.length ? a.ex.reduce((x, y) => x + y, 0) : null;
    d.didExercise = a.ex.length ? d.exerciseMinutes! > 0 || a.exType : a.exType ? true : null;
  }

  // Habits ------------------------------------------------------------------
  const habits = new Map<number, Habit>();
  for (const h of loadHabits(db, true)) habits.set(h.id, h);
  const logs = db.all<LogRow>(
    `SELECT habit_id, date, value, completed FROM habit_logs ${whereSql} ORDER BY date`,
    params,
  );
  for (const l of logs) {
    const d = ensure(String(l.date));
    d.habitValues.set(Number(l.habit_id), Number(l.value));
    d.habitCompleted.set(Number(l.habit_id), Number(l.completed) === 1);
  }

  const list = [...days.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { days: list, habits, from, to };
}
