/**
 * Loads everything an export needs from the diary database. The export module
 * deliberately runs its own SQL (instead of depending on the entries/habits
 * repositories) so that the exported file is a faithful dump of the table rows,
 * ordered by date and time.
 */
import { DEFAULT_LOCALE, type Locale } from '@shared/i18n';
import type { Entry, ExportRequest, Habit, HabitLog, UserProfile } from '@shared/types';
import { type DiaryDb, jsonArray, numOrNull } from '../db/database';
import { loadHabits } from '../db/dataset';
import { nowIso } from '../util/dates';

/** Raw `entries` row as returned by sql.js. */
interface ExportEntryRow {
  id: number;
  date: string;
  time: string;
  title: string;
  body: string;
  mood: number | null;
  emotions_json: string;
  energy: number | null;
  stress: number | null;
  sleep_quality: number | null;
  sleep_hours: number | null;
  exercise_minutes: number | null;
  exercise_type: string;
  events_json: string;
  people_json: string;
  location: string;
  notes: string;
  tags_json: string;
  created_at: string;
  updated_at: string;
}

interface ExportLogRow {
  id: number;
  habit_id: number;
  date: string;
  value: number;
  completed: number;
  note: string;
}

/** Everything the format writers receive. */
export interface ExportData {
  user: UserProfile;
  /** Language of the labels, headings and date formats in the file. */
  locale: Locale;
  /** Requested inclusive bounds; null = unbounded. */
  from: string | null;
  to: string | null;
  /** ISO timestamp of the export. */
  exportedAt: string;
  /** Ascending by date, time, id. */
  entries: Entry[];
  includeHabits: boolean;
  /** All habits (active and archived) when `includeHabits`, otherwise empty. */
  habits: Habit[];
  /** Habit logs inside the range when `includeHabits`, otherwise empty. Ascending by date. */
  habitLogs: HabitLog[];
}

function entryFromRow(r: ExportEntryRow): Entry {
  return {
    id: Number(r.id),
    date: String(r.date),
    time: String(r.time),
    title: String(r.title ?? ''),
    body: String(r.body ?? ''),
    mood: numOrNull(r.mood),
    emotions: jsonArray(r.emotions_json),
    energy: numOrNull(r.energy),
    stress: numOrNull(r.stress),
    sleepQuality: numOrNull(r.sleep_quality),
    sleepHours: numOrNull(r.sleep_hours),
    exerciseMinutes: numOrNull(r.exercise_minutes),
    exerciseType: String(r.exercise_type ?? ''),
    events: jsonArray(r.events_json),
    people: jsonArray(r.people_json),
    location: String(r.location ?? ''),
    notes: String(r.notes ?? ''),
    tags: jsonArray(r.tags_json),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function logFromRow(r: ExportLogRow): HabitLog {
  return {
    id: Number(r.id),
    habitId: Number(r.habit_id),
    date: String(r.date),
    value: Number(r.value),
    completed: Number(r.completed) === 1,
    note: String(r.note ?? ''),
  };
}

/** Builds "WHERE date >= ? AND date <= ?" for the optional inclusive bounds. */
function rangeWhere(from: string | null, to: string | null): { sql: string; params: string[] } {
  const clauses: string[] = [];
  const params: string[] = [];
  if (from) {
    clauses.push('date >= ?');
    params.push(from);
  }
  if (to) {
    clauses.push('date <= ?');
    params.push(to);
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

/** All entries inside the inclusive range (null = unbounded), ascending by date, time, id. */
export function loadEntriesForExport(db: DiaryDb, from: string | null, to: string | null): Entry[] {
  const { sql, params } = rangeWhere(from, to);
  const rows = db.all<ExportEntryRow>(
    `SELECT id, date, time, title, body, mood, emotions_json, energy, stress, sleep_quality, sleep_hours,
            exercise_minutes, exercise_type, events_json, people_json, location, notes, tags_json,
            created_at, updated_at
       FROM entries ${sql}
      ORDER BY date, time, id`,
    params,
  );
  return rows.map(entryFromRow);
}

/** Habit logs inside the inclusive range (null = unbounded), ascending by date then habit. */
export function loadHabitLogsForExport(db: DiaryDb, from: string | null, to: string | null): HabitLog[] {
  const { sql, params } = rangeWhere(from, to);
  const rows = db.all<ExportLogRow>(
    `SELECT id, habit_id, date, value, completed, note FROM habit_logs ${sql} ORDER BY date, habit_id, id`,
    params,
  );
  return rows.map(logFromRow);
}

/**
 * Collects entries (and habits when requested) for a validated export request.
 * `locale` is the language of the generated file (labels, headings, dates); default English.
 */
export function collectExportData(
  db: DiaryDb,
  req: ExportRequest,
  user: UserProfile,
  locale: Locale = DEFAULT_LOCALE,
  now: Date = new Date(),
): ExportData {
  const from = req.from || null;
  const to = req.to || null;
  const includeHabits = req.includeHabits === true;
  return {
    user,
    locale,
    from,
    to,
    exportedAt: nowIso(now),
    entries: loadEntriesForExport(db, from, to),
    includeHabits,
    habits: includeHabits ? loadHabits(db, true) : [],
    habitLogs: includeHabits ? loadHabitLogsForExport(db, from, to) : [],
  };
}
