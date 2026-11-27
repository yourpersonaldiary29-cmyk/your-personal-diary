/**
 * Diary entries repository. All list-like fields (emotions, events, people, tags)
 * are stored as JSON text columns and queried with SQLite's json_each().
 *
 * `validateEntryInput` is the single place where user input becomes a trusted
 * `EntryInput`: it checks formats and ranges, trims strings, removes duplicates and
 * empty items from arrays and strips a leading '#' from tags. Every problem is
 * reported as `ApiError.validation(key, field, params)` with a catalogue key
 * ('server.entries.*') that the error middleware renders in the request language;
 * field labels are nested references ('server.entries.field.<name>').
 */
import { EMOTION_KEYS } from '@shared/constants';
import type {
  DaySummary,
  Entry,
  EntryFilter,
  EntryInput,
  EntryPage,
  EntrySummary,
  HabitFrequency,
  HabitLogWithName,
  TagCount,
} from '@shared/types';
import { ApiError, ref } from '../errors';
import { isHHMM, isIsoDate, nowIso } from '../util/dates';
import { type DiaryDb, jsonArray, numOrNull } from './database';

// ---------------------------------------------------------------------------
// Limits (documented for the frontend in notesForOthers)
// ---------------------------------------------------------------------------

export const ENTRY_LIMITS = {
  titleMax: 200,
  bodyMax: 1_000_000,
  notesMax: 100_000,
  locationMax: 200,
  exerciseTypeMax: 100,
  /** Max length of one item in events/people/tags. */
  itemMax: 100,
  /** Max number of items in events/people/tags/emotions. */
  itemsMax: 100,
  excerptLength: 160,
  listDefaultLimit: 50,
  listMaxLimit: 500,
} as const;

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

/** Raw row of the `entries` table (column names as in schema.ts). */
export interface EntryRow {
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

const ENTRY_COLUMNS =
  'id, date, time, title, body, mood, emotions_json, energy, stress, sleep_quality, sleep_hours, ' +
  'exercise_minutes, exercise_type, events_json, people_json, location, notes, tags_json, created_at, updated_at';

export function rowToEntry(row: EntryRow): Entry {
  return {
    id: Number(row.id),
    date: String(row.date),
    time: String(row.time),
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    mood: numOrNull(row.mood),
    emotions: jsonArray(row.emotions_json),
    energy: numOrNull(row.energy),
    stress: numOrNull(row.stress),
    sleepQuality: numOrNull(row.sleep_quality),
    sleepHours: numOrNull(row.sleep_hours),
    exerciseMinutes: numOrNull(row.exercise_minutes),
    exerciseType: String(row.exercise_type ?? ''),
    events: jsonArray(row.events_json),
    people: jsonArray(row.people_json),
    location: String(row.location ?? ''),
    notes: String(row.notes ?? ''),
    tags: jsonArray(row.tags_json),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * The list text of an entry (`EntrySummary.excerpt`): the body with whitespace runs collapsed and
 * trimmed; a body longer than 160 code points is cut at the end of a word where one is near,
 * loses the weak punctuation before the cut and ends with one `…` (code-point safe: never half of a
 * surrogate pair). The rule and its cases: `shared/excerpt-cases.ts`.
 *
 * THREE copies that must give the same answer for every input: `server/src/db/entries-repo.ts` (this
 * one), `server/src/stats/entry-summary.ts` and `src/offline/overlay/effects.ts`.
 * `server/test/excerpt.test.ts` runs the cases against all three and compares them.
 */
export function makeExcerpt(body: string, length: number = ENTRY_LIMITS.excerptLength): string {
  // At least 1, so that the result is never longer than `length`.
  const limit = Math.max(1, length);
  const chars = Array.from(String(body ?? '').replace(/\s+/g, ' ').trim());
  if (chars.length <= limit) return chars.join('');
  // Room for the ellipsis, and never inside what the screen shows as one character.
  const at = excerptCharacterStart(chars, limit - 1);
  const cut = chars.slice(0, at);
  const tries = [cut];
  // Inside a word: back to the last space among the last EXCERPT_WORD_BACK code points kept, if any.
  if (chars[at - 1] !== ' ' && chars[at] !== ' ') {
    const space = cut.lastIndexOf(' ');
    if (space >= 0 && space >= cut.length - EXCERPT_WORD_BACK) tries.unshift(cut.slice(0, space));
  }
  for (const part of tries) {
    const end = excerptEnd(part);
    if (end > 0) return part.slice(0, end).join('') + '\u2026';
  }
  // Nothing but weak punctuation: the plain cut.
  return cut.join('').trimEnd() + '\u2026';
}

/** How far back (in code points) a cut inside a word looks for a space. */
const EXCERPT_WORD_BACK = 40;
/**
 * Removed from the end of a cut excerpt: whitespace; full stops, commas, semicolons, colons, dashes
 * and dots (also Arabic, Chinese / Japanese full-width, Hindi and Greek ones); a zero width joiner.
 */
const EXCERPT_WEAK = /[\s.,;:\-\u2010-\u2015\u05be\u2026\u060c\u061b\u3001\u3002\uff0c\uff1a\uff1b\u0964\u0965\u0387\u200d]/u;
/** Also removed: what only ever opens (brackets, low quotation marks, Spanish inverted marks). */
const EXCERPT_OPENING = /[([{\uff08\uff3b\uff5b\u3008\u300a\u300c\u300e\u3010\u3014\u3016\u201a\u201e\u00a1\u00bf]/u;
/** Quotation marks that open in one language and close in another: removed only after a space, an opening mark or nothing. */
const EXCERPT_QUOTE = /["'\u2018\u2019\u201c\u201d\u00ab\u00bb\u2039\u203a]/u;

/** A combining mark (also a variation selector), a zero width joiner, a skin tone, an emoji tag. */
const EXCERPT_EXTEND = /[\p{M}\u200d\u{1f3fb}-\u{1f3ff}\u{e0020}-\u{e007f}]/u;
/** A regional indicator: two of them make a flag. */
const EXCERPT_FLAG = /[\u{1f1e6}-\u{1f1ff}]/u;

/**
 * Whether `chars[i]` belongs to the same character on the screen as `chars[i - 1]`: a mark or a skin
 * tone after it, anything after a zero width joiner or a Hindi virama (a conjunct), the second half of
 * a flag. A space never does.
 */
function excerptJoins(chars: string[], i: number): boolean {
  const c = chars[i];
  const before = chars[i - 1];
  if (c === ' ') return false;
  if (EXCERPT_EXTEND.test(c) || before === '\u200d' || before === '\u094d') return true;
  if (!EXCERPT_FLAG.test(c)) return false;
  let flags = 0;
  for (let j = i - 1; j >= 0 && EXCERPT_FLAG.test(chars[j]); j--) flags++;
  return flags % 2 === 1;
}

/**
 * Where to cut, at or before `at` (in code points), so that no character on the screen loses a part
 * (a letter its marks, an emoji its skin tone or the rest of its sequence, a flag its second half);
 * `at` itself when the whole beginning is one such character.
 */
function excerptCharacterStart(chars: string[], at: number): number {
  let n = at;
  while (n > 0 && excerptJoins(chars, n)) n--;
  return n > 0 ? n : at;
}

/** How many code points of `part` stay before the ellipsis. */
function excerptEnd(part: string[]): number {
  let end = part.length;
  while (end > 0) {
    const last = part[end - 1];
    const before = end > 1 ? part[end - 2] : ' ';
    if (EXCERPT_WEAK.test(last) || EXCERPT_OPENING.test(last)) end--;
    else if (EXCERPT_QUOTE.test(last) && (before === ' ' || EXCERPT_OPENING.test(before))) end--;
    else break;
  }
  return end;
}

export function entryToSummary(entry: Entry): EntrySummary {
  return {
    id: entry.id,
    date: entry.date,
    time: entry.time,
    title: entry.title,
    excerpt: makeExcerpt(entry.body),
    mood: entry.mood,
    energy: entry.energy,
    stress: entry.stress,
    sleepHours: entry.sleepHours,
    emotions: entry.emotions,
    tags: entry.tags,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Entry fields that have a translated label ('server.entries.field.<name>'). */
type LabelledField =
  | 'title'
  | 'body'
  | 'mood'
  | 'energy'
  | 'stress'
  | 'sleepQuality'
  | 'exerciseType'
  | 'events'
  | 'people'
  | 'location'
  | 'notes'
  | 'tags'
  | 'emotions';

/** Nested catalogue reference of a field's display name, for `{label}` placeholders. */
function labelOf(field: LabelledField) {
  return ref(`server.entries.field.${field}`);
}

function asObject(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw ApiError.validation('server.entries.bodyObject');
  }
  return body as Record<string, unknown>;
}

function optionalString(value: unknown, field: LabelledField, max: number): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw ApiError.validation('server.entries.fieldMustBeText', field, { label: labelOf(field) });
  const trimmed = value.trim();
  if (trimmed.length > max) throw ApiError.validation('server.entries.fieldTooLong', field, { label: labelOf(field), max });
  return trimmed;
}

/** Long free text: not trimmed at the ends (line breaks are meaningful) except a length check. */
function longText(value: unknown, field: LabelledField, max: number): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw ApiError.validation('server.entries.fieldMustBeText', field, { label: labelOf(field) });
  if (value.length > max) throw ApiError.validation('server.entries.fieldTooLong', field, { label: labelOf(field), max });
  return value;
}

function rating(value: unknown, field: LabelledField): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10) {
    throw ApiError.validation('server.entries.ratingRange', field, { label: labelOf(field) });
  }
  return value;
}

function sleepHours(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 24) {
    throw ApiError.validation('server.entries.sleepHoursRange', 'sleepHours');
  }
  return value;
}

function exerciseMinutes(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1440) {
    throw ApiError.validation('server.entries.exerciseMinutesRange', 'exerciseMinutes');
  }
  return value;
}

/** Trimmed, non-empty, de-duplicated string list. `transform` runs before the emptiness check. */
function stringList(value: unknown, field: LabelledField, transform: (s: string) => string = (s) => s): string[] {
  if (value === undefined || value === null) return [];
  const label = labelOf(field);
  if (!Array.isArray(value)) throw ApiError.validation('server.entries.fieldMustBeList', field, { label });
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') throw ApiError.validation('server.entries.itemMustBeText', field, { label });
    const cleaned = transform(item.trim()).trim();
    if (!cleaned) continue;
    if (cleaned.length > ENTRY_LIMITS.itemMax) {
      throw ApiError.validation('server.entries.itemTooLong', field, { label, max: ENTRY_LIMITS.itemMax });
    }
    if (!out.includes(cleaned)) out.push(cleaned);
  }
  if (out.length > ENTRY_LIMITS.itemsMax) {
    throw ApiError.validation('server.entries.tooManyItems', field, { label, max: ENTRY_LIMITS.itemsMax });
  }
  return out;
}

/** Removes leading '#' characters and surrounding whitespace from a tag. */
export function normaliseTag(tag: string): string {
  return tag.trim().replace(/^#+/, '').trim();
}

/**
 * Turns an untrusted request body into a valid, normalised `EntryInput`.
 * Throws `ApiError.validation(key, field)` on the first problem found.
 */
export function validateEntryInput(body: unknown): EntryInput {
  const b = asObject(body);

  if (!isIsoDate(b.date)) throw ApiError.validation('server.entries.badDate', 'date');
  if (!isHHMM(b.time)) throw ApiError.validation('server.entries.badTime', 'time');

  const emotions = stringList(b.emotions, 'emotions');
  for (const e of emotions) {
    if (!EMOTION_KEYS.has(e)) throw ApiError.validation('server.entries.unknownEmotion', 'emotions', { emotion: e });
  }

  return {
    date: b.date,
    time: b.time,
    title: optionalString(b.title, 'title', ENTRY_LIMITS.titleMax),
    body: longText(b.body, 'body', ENTRY_LIMITS.bodyMax),
    mood: rating(b.mood, 'mood'),
    emotions,
    energy: rating(b.energy, 'energy'),
    stress: rating(b.stress, 'stress'),
    sleepQuality: rating(b.sleepQuality, 'sleepQuality'),
    sleepHours: sleepHours(b.sleepHours),
    exerciseMinutes: exerciseMinutes(b.exerciseMinutes),
    exerciseType: optionalString(b.exerciseType, 'exerciseType', ENTRY_LIMITS.exerciseTypeMax),
    events: stringList(b.events, 'events'),
    people: stringList(b.people, 'people'),
    location: optionalString(b.location, 'location', ENTRY_LIMITS.locationMax),
    notes: longText(b.notes, 'notes', ENTRY_LIMITS.notesMax),
    tags: stringList(b.tags, 'tags', normaliseTag),
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

function fetchRow(db: DiaryDb, id: number): EntryRow | undefined {
  return db.get<EntryRow>(`SELECT ${ENTRY_COLUMNS} FROM entries WHERE id = ?`, [id]);
}

/** Loads one entry or throws `ApiError.notFound`. */
export function getEntry(db: DiaryDb, id: number): Entry {
  const row = fetchRow(db, id);
  if (!row) throw ApiError.notFound('server.entries.notFound');
  return rowToEntry(row);
}

/**
 * Inserts an entry. `opts.at` (offline sync, server/src/sync/apply.ts) is the time written as both
 * `createdAt` and `updatedAt`: an entry created offline yesterday keeps yesterday's time. Default: now.
 */
export function createEntry(db: DiaryDb, input: EntryInput, opts: { at?: string } = {}): Entry {
  const now = opts.at ?? nowIso();
  const { lastId } = db.run(
    `INSERT INTO entries (date, time, title, body, mood, emotions_json, energy, stress, sleep_quality, sleep_hours,
                          exercise_minutes, exercise_type, events_json, people_json, location, notes, tags_json,
                          created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.date,
      input.time,
      input.title,
      input.body,
      input.mood,
      JSON.stringify(input.emotions),
      input.energy,
      input.stress,
      input.sleepQuality,
      input.sleepHours,
      input.exerciseMinutes,
      input.exerciseType,
      JSON.stringify(input.events),
      JSON.stringify(input.people),
      input.location,
      input.notes,
      JSON.stringify(input.tags),
      now,
      now,
    ],
  );
  return getEntry(db, lastId);
}

/** Replaces an entry's content. `opts.at` (offline sync) is the `updatedAt` written; default: now. */
export function updateEntry(db: DiaryDb, id: number, input: EntryInput, opts: { at?: string } = {}): Entry {
  if (!fetchRow(db, id)) throw ApiError.notFound('server.entries.notFound');
  db.run(
    `UPDATE entries
        SET date = ?, time = ?, title = ?, body = ?, mood = ?, emotions_json = ?, energy = ?, stress = ?,
            sleep_quality = ?, sleep_hours = ?, exercise_minutes = ?, exercise_type = ?, events_json = ?,
            people_json = ?, location = ?, notes = ?, tags_json = ?, updated_at = ?
      WHERE id = ?`,
    [
      input.date,
      input.time,
      input.title,
      input.body,
      input.mood,
      JSON.stringify(input.emotions),
      input.energy,
      input.stress,
      input.sleepQuality,
      input.sleepHours,
      input.exerciseMinutes,
      input.exerciseType,
      JSON.stringify(input.events),
      JSON.stringify(input.people),
      input.location,
      input.notes,
      JSON.stringify(input.tags),
      opts.at ?? nowIso(),
      id,
    ],
  );
  return getEntry(db, id);
}

export function deleteEntry(db: DiaryDb, id: number): void {
  const { changes } = db.run('DELETE FROM entries WHERE id = ?', [id]);
  if (changes === 0) throw ApiError.notFound('server.entries.notFound');
}

export function countEntries(db: DiaryDb): number {
  return Number(db.scalar<number>('SELECT COUNT(*) FROM entries') ?? 0);
}

// ---------------------------------------------------------------------------
// Listing / filtering
// ---------------------------------------------------------------------------

/** Escapes LIKE wildcards so the term is matched literally (ESCAPE '\'). */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

interface WhereClause {
  sql: string;
  params: (string | number)[];
}

/** Builds the WHERE clause shared by the page query and the total count. */
function buildWhere(filter: EntryFilter): WhereClause {
  const conds: string[] = [];
  const params: (string | number)[] = [];

  if (filter.from !== undefined && filter.from !== null && filter.from !== '') {
    if (!isIsoDate(filter.from)) throw ApiError.validation('server.entries.fromBadDate', 'from');
    conds.push('date >= ?');
    params.push(filter.from);
  }
  if (filter.to !== undefined && filter.to !== null && filter.to !== '') {
    if (!isIsoDate(filter.to)) throw ApiError.validation('server.entries.toBadDate', 'to');
    conds.push('date <= ?');
    params.push(filter.to);
  }
  if (typeof filter.tag === 'string' && normaliseTag(filter.tag)) {
    conds.push('EXISTS (SELECT 1 FROM json_each(entries.tags_json) je WHERE je.value = ?)');
    params.push(normaliseTag(filter.tag));
  }
  if (typeof filter.emotion === 'string' && filter.emotion.trim()) {
    conds.push('EXISTS (SELECT 1 FROM json_each(entries.emotions_json) je WHERE je.value = ?)');
    params.push(filter.emotion.trim());
  }
  if (typeof filter.text === 'string' && filter.text.trim()) {
    // SQLite LIKE is case-insensitive for ASCII; Hebrew has no case. Wildcards are escaped.
    const pattern = `%${escapeLike(filter.text.trim())}%`;
    conds.push(
      `(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\'
        OR EXISTS (SELECT 1 FROM json_each(entries.events_json) je WHERE je.value LIKE ? ESCAPE '\\')
        OR EXISTS (SELECT 1 FROM json_each(entries.people_json) jp WHERE jp.value LIKE ? ESCAPE '\\'))`,
    );
    params.push(pattern, pattern, pattern, pattern, pattern, pattern);
  }
  return { sql: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params };
}

function clampInt(value: unknown, fallback: number, min: number, max: number, field: string): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw ApiError.validation('server.entries.fieldInteger', field, { field });
  return Math.min(max, Math.max(min, n));
}

/**
 * Paged list of entry summaries matching the filter. `total` counts all matches
 * (ignoring limit/offset). Sorted by date and time, newest first by default.
 */
export function listEntries(db: DiaryDb, filter: EntryFilter = {}): EntryPage {
  const where = buildWhere(filter);
  const limit = clampInt(filter.limit, ENTRY_LIMITS.listDefaultLimit, 1, ENTRY_LIMITS.listMaxLimit, 'limit');
  const offset = clampInt(filter.offset, 0, 0, Number.MAX_SAFE_INTEGER, 'offset');
  const desc = filter.sortDesc === undefined || filter.sortDesc === null ? true : Boolean(filter.sortDesc);
  const dir = desc ? 'DESC' : 'ASC';

  const total = Number(db.scalar<number>(`SELECT COUNT(*) FROM entries ${where.sql}`, where.params) ?? 0);
  const rows = db.all<EntryRow>(
    `SELECT ${ENTRY_COLUMNS} FROM entries ${where.sql} ORDER BY date ${dir}, time ${dir}, id ${dir} LIMIT ? OFFSET ?`,
    [...where.params, limit, offset],
  );
  return { items: rows.map((r) => entryToSummary(rowToEntry(r))), total };
}

/** All entries in the inclusive range (null = unbounded), ascending by date and time. */
export function listEntriesFull(db: DiaryDb, from: string | null, to: string | null): Entry[] {
  const conds: string[] = [];
  const params: string[] = [];
  if (from) {
    if (!isIsoDate(from)) throw ApiError.validation('server.entries.fromBadDate', 'from');
    conds.push('date >= ?');
    params.push(from);
  }
  if (to) {
    if (!isIsoDate(to)) throw ApiError.validation('server.entries.toBadDate', 'to');
    conds.push('date <= ?');
    params.push(to);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = db.all<EntryRow>(`SELECT ${ENTRY_COLUMNS} FROM entries ${where} ORDER BY date, time, id`, params);
  return rows.map(rowToEntry);
}

// ---------------------------------------------------------------------------
// Day summary
// ---------------------------------------------------------------------------

interface DayLogRow {
  id: number;
  habit_id: number;
  date: string;
  value: number;
  completed: number;
  note: string;
  habit_name: string;
  unit: string;
  target: number;
  frequency: string;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(m * 100) / 100;
}

/** Entries of one day (ascending by time), its habit logs (with habit names) and the day's averages. */
export function getDay(db: DiaryDb, date: string): DaySummary {
  if (!isIsoDate(date)) throw ApiError.validation('server.entries.badDate', 'date');
  const entries = db
    .all<EntryRow>(`SELECT ${ENTRY_COLUMNS} FROM entries WHERE date = ? ORDER BY time, id`, [date])
    .map(rowToEntry);

  const logRows = db.all<DayLogRow>(
    `SELECT l.id, l.habit_id, l.date, l.value, l.completed, l.note,
            h.name AS habit_name, h.unit, h.target, h.frequency
       FROM habit_logs l JOIN habits h ON h.id = l.habit_id
      WHERE l.date = ?
      ORDER BY h.sort_order, h.id`,
    [date],
  );
  const habitLogs: HabitLogWithName[] = logRows.map((r) => ({
    log: {
      id: Number(r.id),
      habitId: Number(r.habit_id),
      date: String(r.date),
      value: Number(r.value),
      completed: Number(r.completed) === 1,
      note: String(r.note ?? ''),
    },
    habitName: String(r.habit_name),
    unit: String(r.unit ?? ''),
    target: Number(r.target),
    frequency: (r.frequency === 'weekly' ? 'weekly' : 'daily') as HabitFrequency,
  }));

  const pick = (f: (e: Entry) => number | null): number[] =>
    entries.map(f).filter((v): v is number => v !== null && Number.isFinite(v));
  const sleep = pick((e) => e.sleepHours);

  return {
    date,
    entries,
    habitLogs,
    moodAvg: mean(pick((e) => e.mood)),
    energyAvg: mean(pick((e) => e.energy)),
    stressAvg: mean(pick((e) => e.stress)),
    // Sleep is reported once per night; when several entries report it we keep the largest (as dataset.ts does).
    sleepHours: sleep.length ? Math.max(...sleep) : null,
  };
}

// ---------------------------------------------------------------------------
// Tag-like aggregates
// ---------------------------------------------------------------------------

function jsonCounts(db: DiaryDb, column: 'tags_json' | 'people_json'): TagCount[] {
  const rows = db.all<{ name: string; count: number }>(
    `SELECT je.value AS name, COUNT(*) AS count
       FROM entries, json_each(entries.${column}) je
      WHERE je.value <> ''
      GROUP BY je.value
      ORDER BY count DESC, name ASC`,
  );
  return rows.map((r) => ({ name: String(r.name), count: Number(r.count) }));
}

/** Distinct tags with the number of entries using each, most frequent first. */
export function listTags(db: DiaryDb): TagCount[] {
  return jsonCounts(db, 'tags_json');
}

export function listPeople(db: DiaryDb): TagCount[] {
  return jsonCounts(db, 'people_json');
}

export function listLocations(db: DiaryDb): TagCount[] {
  const rows = db.all<{ name: string; count: number }>(
    `SELECT location AS name, COUNT(*) AS count
       FROM entries
      WHERE location <> ''
      GROUP BY location
      ORDER BY count DESC, name ASC`,
  );
  return rows.map((r) => ({ name: String(r.name), count: Number(r.count) }));
}
