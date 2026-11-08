/**
 * Applies one validated offline operation to a diary (docs/android-tasks/OFFLINE-DESIGN.md §3.4-3.6).
 *
 * Synchronous on purpose - no `await` - and run by the route inside ONE `db.transaction`, so no
 * other request interleaves: two copies of the same request see each other's effect ("unchanged").
 *
 * Exactly once without an op ledger (§3.6): every kind is idempotent -
 *   - creates are recognised by their permanent `sync:cid:<kind>:<clientId>` row (never removed,
 *     so a replayed create of a since-deleted record is still "unchanged");
 *   - updates, archive, logs and settings compare content: equal content is "unchanged";
 *   - deletes of a missing record are "unchanged";
 * and versions only move forward (`nextVersion`), so a replay after another device's later write
 * loses (`conflict-lost`) instead of overwriting it.
 *
 * Conflict rule (item 11): per record the newer edit wins (`decide`), a record deleted on the server
 * is never recreated (`gone`), and the losing version is never silently dropped - `conflict-won`
 * returns what it overwrote as `replaced`, `conflict-lost` returns the kept version as `record`.
 */
import {
  clampEditedAt,
  decide,
  nextVersion,
  settingsOutcome,
  type HabitFields,
  type LogFields,
  type SyncKeyOutcome,
  type SyncOp,
  type SyncOpResult,
  type SyncRef,
} from '@shared/sync';
import type { AppSettings, Entry, EntryInput, Habit, HabitLog } from '@shared/types';
import type { DiaryDb } from '../db/database';
import { createEntry, deleteEntry, rowToEntry, updateEntry, type EntryRow } from '../db/entries-repo';
import { createHabit, deleteHabitLog, logHabit, setArchived, updateHabit } from '../db/habits-repo';
import { habitFromRow } from '../db/dataset';
import { getSettings, saveSettings } from '../db/settings-repo';
import { ApiError } from '../errors';
import {
  cidTarget,
  ensureSyncState,
  habitTimeRow,
  logTimeRow,
  recordCid,
  settingTimeRow,
  storedTime,
  writeTime,
  type CidKind,
} from './store';
import { UNKNOWN_CLIENT_ID_KEY } from './validate';

type Outcome = SyncOpResult['outcome'];

/** What `applySyncOp` decided, before the route adds `serverNow` and `epoch`. */
export interface ApplyResult {
  outcome: Outcome;
  record: SyncOpResult['record'];
  replaced?: SyncOpResult['replaced'];
  keys?: SyncOpResult['keys'];
}

// ---------------------------------------------------------------------------
// Content equality (normalised the same way on both sides)
// ---------------------------------------------------------------------------

/** JSON with object keys sorted, so `{a, b}` equals `{b, a}` (calendarExtras, settings bases). */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** The content fields of an entry, in the order of `EntryInput` (what an update replaces). */
export function entryInputOf(e: EntryInput | Entry): EntryInput {
  return {
    date: e.date,
    time: e.time,
    title: e.title,
    body: e.body,
    mood: e.mood,
    emotions: e.emotions,
    energy: e.energy,
    stress: e.stress,
    sleepQuality: e.sleepQuality,
    sleepHours: e.sleepHours,
    exerciseMinutes: e.exerciseMinutes,
    exerciseType: e.exerciseType,
    events: e.events,
    people: e.people,
    location: e.location,
    notes: e.notes,
    tags: e.tags,
  };
}

/** Equal content: the payload is validated (tags without '#', trimmed, de-duplicated) like every stored entry. */
export function sameEntryContent(a: EntryInput | Entry, b: EntryInput | Entry): boolean {
  return stableJson(entryInputOf(a)) === stableJson(entryInputOf(b));
}

export function habitFieldsOf(h: HabitFields | Habit): HabitFields {
  return {
    name: h.name,
    description: h.description,
    target: h.target,
    unit: h.unit,
    frequency: h.frequency,
    reminderTime: h.reminderTime ?? null,
    reminderEnabled: h.reminderEnabled,
  };
}

export function sameHabitFields(a: HabitFields | Habit, b: HabitFields | Habit): boolean {
  return stableJson(habitFieldsOf(a)) === stableJson(habitFieldsOf(b));
}

/** Equal logs; `null` = no log. */
export function sameLog(a: LogFields | null, b: LogFields | null): boolean {
  if (a === null || b === null) return a === b;
  return a.value === b.value && (a.note ?? '') === (b.note ?? '');
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

function entryRow(db: DiaryDb, id: number): Entry | null {
  const row = db.get<EntryRow>('SELECT * FROM entries WHERE id = ?', [id]);
  return row ? rowToEntry(row) : null;
}

function habitRow(db: DiaryDb, id: number): Habit | null {
  const row = db.get<Parameters<typeof habitFromRow>[0]>('SELECT * FROM habits WHERE id = ?', [id]);
  return row ? habitFromRow(row) : null;
}

function logRow(db: DiaryDb, habitId: number, date: string): HabitLog | null {
  const r = db.get<{ id: number; habit_id: number; date: string; value: number; completed: number; note: string }>(
    'SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?',
    [habitId, date],
  );
  if (!r) return null;
  return {
    id: Number(r.id),
    habitId: Number(r.habit_id),
    date: String(r.date),
    value: Number(r.value),
    completed: Number(r.completed) === 1,
    note: String(r.note ?? ''),
  };
}

/**
 * The server id a `SyncRef` names. A clientId must belong to a create the server has seen
 * (400 'server.sync.unknownClientId' otherwise: the device sent an operation before its create).
 */
export function resolveRef(db: DiaryDb, kind: CidKind, ref: SyncRef, field: string): number {
  if ('id' in ref) return ref.id;
  const id = cidTarget(db, kind, ref.clientId);
  if (id === null) throw ApiError.localized(400, 'VALIDATION', UNKNOWN_CLIENT_ID_KEY, undefined, field);
  return id;
}

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

/**
 * Applies `op` at server time `now` (ISO). Call inside `db.transaction`. Throws `ApiError` 400 for
 * an unknown clientId; everything else is an outcome.
 */
export function applySyncOp(db: DiaryDb, op: SyncOp, now: string): ApplyResult {
  const ts = clampEditedAt(op.editedAt, now);
  const { epoch } = ensureSyncState(db);
  const epochOk = op.epoch === epoch;

  switch (op.kind) {
    case 'entry.create': {
      const known = cidTarget(db, 'entry', op.clientId);
      if (known !== null) return { outcome: 'unchanged', record: entryRow(db, known) };
      const entry = createEntry(db, op.payload, { at: ts });
      recordCid(db, 'entry', op.clientId, entry.id);
      return { outcome: 'applied', record: entry };
    }

    case 'entry.update': {
      if (!epochOk) return { outcome: 'stale', record: null };
      const id = resolveRef(db, 'entry', op.target, 'target');
      const row = entryRow(db, id);
      if (!row) return { outcome: 'gone', record: null };
      const outcome = decide({
        exists: true,
        same: sameEntryContent(row, op.payload),
        baseKnown: op.base !== undefined,
        baseMatches: op.base === row.updatedAt,
        ts,
        storedAt: row.updatedAt,
      });
      if (outcome === 'applied' || outcome === 'conflict-won') {
        const updated = updateEntry(db, id, op.payload, { at: nextVersion(row.updatedAt, ts) });
        return outcome === 'conflict-won' ? { outcome, record: updated, replaced: row } : { outcome, record: updated };
      }
      return { outcome, record: row };
    }

    case 'entry.delete': {
      if (!epochOk) return { outcome: 'stale', record: null };
      const id = resolveRef(db, 'entry', op.target, 'target');
      const row = entryRow(db, id);
      if (!row) return { outcome: 'unchanged', record: null };
      const outcome = decide({
        exists: true,
        same: false,
        baseKnown: op.base !== undefined,
        baseMatches: op.base === row.updatedAt,
        ts,
        storedAt: row.updatedAt,
      });
      if (outcome === 'applied' || outcome === 'conflict-won') {
        deleteEntry(db, id);
        return outcome === 'conflict-won' ? { outcome, record: null, replaced: row } : { outcome, record: null };
      }
      return { outcome, record: row };
    }

    case 'habit.create': {
      const known = cidTarget(db, 'habit', op.clientId);
      if (known !== null) return { outcome: 'unchanged', record: habitRow(db, known) };
      const habit = createHabit(db, op.payload, { at: ts });
      recordCid(db, 'habit', op.clientId, habit.id);
      writeTime(db, habitTimeRow(habit.id), ts);
      return { outcome: 'applied', record: habit };
    }

    case 'habit.update': {
      if (!epochOk) return { outcome: 'stale', record: null };
      const id = resolveRef(db, 'habit', op.target, 'target');
      const habit = habitRow(db, id);
      if (!habit) return { outcome: 'gone', record: null };
      const timeRow = habitTimeRow(id);
      const storedAt = storedTime(db, timeRow);
      const outcome = decide({
        exists: true,
        same: sameHabitFields(habit, op.payload),
        baseKnown: op.base !== undefined,
        baseMatches: op.base !== undefined && sameHabitFields(habit, op.base),
        ts,
        storedAt,
      });
      if (outcome === 'applied' || outcome === 'conflict-won') {
        const updated = updateHabit(db, id, op.payload);
        writeTime(db, timeRow, nextVersion(storedAt, ts));
        return outcome === 'conflict-won' ? { outcome, record: updated, replaced: habit } : { outcome, record: updated };
      }
      return { outcome, record: habit };
    }

    case 'habit.archive': {
      if (!epochOk) return { outcome: 'stale', record: null };
      const id = resolveRef(db, 'habit', op.target, 'target');
      const habit = habitRow(db, id);
      if (!habit) return { outcome: 'gone', record: null };
      // Field-scoped: only `isArchived` is compared, so a rename elsewhere and this archive both survive.
      const timeRow = habitTimeRow(id);
      const storedAt = storedTime(db, timeRow);
      const outcome = decide({
        exists: true,
        same: habit.isArchived === op.payload.archived,
        baseKnown: op.base !== undefined,
        baseMatches: op.base !== undefined && op.base.archived === habit.isArchived,
        ts,
        storedAt,
      });
      if (outcome === 'applied' || outcome === 'conflict-won') {
        const updated = setArchived(db, id, op.payload.archived);
        writeTime(db, timeRow, nextVersion(storedAt, ts));
        return outcome === 'conflict-won' ? { outcome, record: updated, replaced: habit } : { outcome, record: updated };
      }
      return { outcome, record: habit };
    }

    case 'log.set':
    case 'log.delete': {
      if (!epochOk) return { outcome: 'stale', record: null };
      const habitId = resolveRef(db, 'habit', op.habit, 'habit');
      if (!habitRow(db, habitId)) return { outcome: 'gone', record: null };
      const current = logRow(db, habitId, op.date);
      const currentFields: LogFields | null = current ? { value: current.value, note: current.note } : null;
      if (op.kind === 'log.delete' && !current) return { outcome: 'unchanged', record: null };
      const timeRow = logTimeRow(habitId, op.date);
      const storedAt = storedTime(db, timeRow);
      const outcome = decide({
        exists: true,
        same: op.kind === 'log.set' ? sameLog(currentFields, op.payload) : false,
        baseKnown: op.base !== undefined,
        baseMatches: op.base !== undefined && sameLog(op.base, currentFields),
        ts,
        storedAt,
      });
      if (outcome === 'applied' || outcome === 'conflict-won') {
        let record: HabitLog | null = null;
        if (op.kind === 'log.set') record = logHabit(db, { habitId, date: op.date, value: op.payload.value, note: op.payload.note });
        else deleteHabitLog(db, habitId, op.date);
        writeTime(db, timeRow, nextVersion(storedAt, ts));
        return outcome === 'conflict-won' && current ? { outcome, record, replaced: current } : { outcome, record };
      }
      return { outcome, record: current };
    }

    case 'settings.patch': {
      // Per key; the epoch is ignored (keys are stable across a restore).
      const before = getSettings(db);
      const keys: Partial<Record<keyof AppSettings, SyncKeyOutcome>> = {};
      const toSave: Partial<AppSettings> = {};
      const replaced: Partial<AppSettings> = {};
      for (const key of Object.keys(op.payload) as (keyof AppSettings)[]) {
        const value = op.payload[key];
        const stored = before[key];
        const timeRow = settingTimeRow(key);
        const storedAt = storedTime(db, timeRow);
        const baseKnown = op.base !== undefined && Object.prototype.hasOwnProperty.call(op.base, key);
        const outcome = decide({
          exists: true,
          same: stableJson(stored) === stableJson(value),
          baseKnown,
          baseMatches: baseKnown && stableJson(op.base?.[key]) === stableJson(stored),
          ts,
          storedAt,
        }) as SyncKeyOutcome;
        keys[key] = outcome;
        if (outcome === 'applied' || outcome === 'conflict-won') {
          (toSave as Record<string, unknown>)[key] = value;
          writeTime(db, timeRow, nextVersion(storedAt, ts));
          if (outcome === 'conflict-won') (replaced as Record<string, unknown>)[key] = stored;
        }
      }
      const record = Object.keys(toSave).length ? saveSettings(db, toSave) : before;
      const outcome = settingsOutcome(keys);
      return outcome === 'conflict-won' ? { outcome, record, replaced, keys } : { outcome, record, keys };
    }
  }
}
