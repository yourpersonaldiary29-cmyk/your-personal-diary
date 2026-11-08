/**
 * Optimistic records (section 4.3 (c)): what the pages see for a change that is still on the device.
 * Built from a queued operation and the display facts it carries (`OpHint`); never stored. The same
 * builders serve the facade (the value a write resolves with while offline) and the overlay (the
 * effects of pending operations on cached views), so both show the same thing.
 *
 * A record that came from a pending operation carries a client-only marker (`isPendingRecord`): a
 * non-enumerable property, so it never reaches JSON and never changes the record's shape.
 */
import type { AppSettings, Entry, Habit, HabitLog } from '@shared/types';
import type { SyncOp } from '@shared/sync';
import { isLogCompleted } from './overlay/effects';
import type { QueuedOp } from './types';

const PENDING = Symbol.for('ypd.offline.pending');

/** Marks `record` as coming from a pending operation (in place; returns it). */
export function markPending<T extends object>(record: T, opId: string): T {
  try {
    Object.defineProperty(record, PENDING, { value: opId, enumerable: false, configurable: true, writable: true });
  } catch {
    /* frozen object: the pages still get the content */
  }
  return record;
}

/** True when `x` was produced by a pending (not yet uploaded) operation. */
export function isPendingRecord(x: unknown): boolean {
  return !!x && typeof x === 'object' && (x as Record<symbol, unknown>)[PENDING] !== undefined;
}

/** The opId behind a pending record, or null. */
export function pendingOpIdOf(x: unknown): string | null {
  if (!x || typeof x !== 'object') return null;
  const v = (x as Record<symbol, unknown>)[PENDING];
  return typeof v === 'string' ? v : null;
}

/** The entry a pending `entry.create` / `entry.update` shows, or null for another kind. */
export function optimisticEntry(q: QueuedOp, id: number): Entry | null {
  const op = q.op;
  if (op.kind !== 'entry.create' && op.kind !== 'entry.update') return null;
  const entry: Entry = {
    ...op.payload,
    id,
    createdAt: q.hint?.createdAt ?? op.editedAt,
    updatedAt: op.editedAt,
  };
  return markPending(entry, op.opId);
}

/** The entry a note holds as "my version" (the user's text of an entry operation), or null. */
export function entryOfOp(op: SyncOp, id: number, createdAt?: string): Entry | null {
  if (op.kind !== 'entry.create' && op.kind !== 'entry.update') return null;
  return { ...op.payload, id, createdAt: createdAt ?? op.editedAt, updatedAt: op.editedAt };
}

/** The habit a pending `habit.create` shows. */
export function optimisticNewHabit(q: QueuedOp, id: number): Habit | null {
  const op = q.op;
  if (op.kind !== 'habit.create') return null;
  const habit: Habit = {
    ...op.payload,
    id,
    isArchived: false,
    sortOrder: q.hint?.nextSortOrder ?? q.hint?.sortOrder ?? 0,
    createdAt: q.hint?.createdAt ?? op.editedAt,
  };
  return markPending(habit, op.opId);
}

/** `shown` with a pending `habit.update` / `habit.archive` applied. */
export function optimisticHabit(q: QueuedOp, shown: Habit): Habit {
  const op = q.op;
  if (op.kind === 'habit.update') return markPending({ ...shown, ...op.payload }, op.opId);
  if (op.kind === 'habit.archive') return markPending({ ...shown, isArchived: op.payload.archived }, op.opId);
  return shown;
}

/** The log a pending `log.set` shows (`completed` as the server would compute it). */
export function optimisticLog(q: QueuedOp, habitId: number, id: number): HabitLog | null {
  const op = q.op;
  if (op.kind !== 'log.set') return null;
  const habit = q.hint?.habit ?? { target: 1, frequency: 'daily' as const };
  const log: HabitLog = {
    id,
    habitId,
    date: op.date,
    value: op.payload.value,
    completed: isLogCompleted(habit, op.payload.value),
    note: op.payload.note,
  };
  return markPending(log, op.opId);
}

/** `shown` with a pending `settings.patch` applied. */
export function optimisticSettings(q: QueuedOp, shown: AppSettings): AppSettings {
  const op = q.op;
  if (op.kind !== 'settings.patch') return shown;
  return markPending({ ...shown, ...op.payload }, op.opId);
}
