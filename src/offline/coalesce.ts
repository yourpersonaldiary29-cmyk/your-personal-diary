/**
 * Coalescing of operations that were never sent (section 4.4, the table "Coalescing"). Pure.
 *
 * Only an UNSEALED predecessor on the SAME record may be merged with a new operation: a sealed one
 * may already have been applied by the server (sent, answer lost), so merging into it would either
 * lose the edit or duplicate the record (E5). The merged operation gets the NEW operation's opId
 * (a new one) and keeps the predecessor's outbox `seq` (the caller writes it in place). Its display
 * hint is the new operation's, except the facts of the FIRST state, which come from the predecessor:
 * `createdAt`, the log value before the first change (`prevValue`) and `prev`, the entry as the cached
 * views still hold it. A create has no `prev` (the cached views never had the entry), so a merged
 * create + update has none either: the update's own `prev` is the create's optimistic version, and the
 * overlays would subtract it from a count that never included it.
 *
 * | unsealed sequence on one record          | result                                                  |
 * | create + update(s)                       | one create with the final input                         |
 * | create + delete                          | both dropped; nothing is sent                           |
 * | update + update                          | one update: latest input, first base, latest editedAt   |
 * | update + delete                          | one delete with the first base                          |
 * | habit.create + habit.update              | one create with the final input                         |
 * | habit.archive + habit.archive            | the last one, with the first base                       |
 * | log.set / log.delete, same habit + date  | the last one, with the first base                       |
 * | settings.patch + settings.patch          | merged per key: last value, first base for each key     |
 * Anything else is appended as its own operation.
 */
import type { AppSettings } from '@shared/types';
import type { SyncOp } from '@shared/sync';
import type { QueuedOp } from './types';

export type CoalesceResult =
  | { action: 'append' }
  /** Replace the predecessor (same seq) with `merged`. */
  | { action: 'replace'; merged: QueuedOp }
  /** Remove the predecessor and do not add the new operation (create + delete). */
  | { action: 'drop-both' };

const APPEND: CoalesceResult = { action: 'append' };

/** The first base of a pair: the predecessor's `base` / `baseOp` carried into `next`. */
function withFirstBase(prev: QueuedOp, next: QueuedOp, op: SyncOp): QueuedOp {
  const merged: QueuedOp = { ...next, op, queuedAt: prev.queuedAt, hint: mergedHint(prev, next) };
  if (prev.baseOp) merged.baseOp = prev.baseOp;
  else delete merged.baseOp;
  if (prev.localId !== undefined) merged.localId = prev.localId;
  return merged;
}

/**
 * The new operation's display facts, with those of the FIRST state taken from the predecessor:
 * `createdAt`, the log value before the first change, and `prev` - what the device showed BEFORE the
 * first change, which is what the cached views still hold and what the overlays subtract. The
 * predecessor's `prev` is used whether it is present or not: when it is absent (a create, or an update
 * of an entry the device had not shown) the new operation's `prev` describes a state of the
 * predecessor's own making, which no cached view contains, so it is dropped.
 */
function mergedHint(prev: QueuedOp, next: QueuedOp): NonNullable<QueuedOp['hint']> {
  const out: NonNullable<QueuedOp['hint']> = { ...next.hint };
  if (prev.hint?.createdAt !== undefined) out.createdAt = prev.hint.createdAt;
  if (prev.hint && 'prevValue' in prev.hint) out.prevValue = prev.hint.prevValue;
  if (prev.hint?.displayId !== undefined && next.hint?.displayId === undefined) out.displayId = prev.hint.displayId;
  if (prev.hint?.prev) out.prev = prev.hint.prev;
  else delete out.prev;
  return out;
}

function baseOf(op: SyncOp): unknown {
  return 'base' in op ? op.base : undefined;
}

/** `op` with `base` set to `base` (removed when undefined: "not known"). */
function setBase<T extends SyncOp>(op: T, base: unknown): T {
  const copy = { ...op } as T & { base?: unknown };
  if (base === undefined) delete copy.base;
  else copy.base = base;
  return copy;
}

export function coalesce(prev: QueuedOp | undefined, prevSealed: boolean, next: QueuedOp): CoalesceResult {
  if (!prev || prevSealed || prev.record !== next.record || prev.chain !== next.chain) return APPEND;
  const a = prev.op;
  const b = next.op;

  // Entries -------------------------------------------------------------------------------
  if (a.kind === 'entry.create' && b.kind === 'entry.update') {
    const op: SyncOp = { ...a, opId: b.opId, editedAt: b.editedAt, payload: b.payload };
    return { action: 'replace', merged: { ...withFirstBase(prev, next, op), localId: prev.localId } };
  }
  if (a.kind === 'entry.create' && b.kind === 'entry.delete') return { action: 'drop-both' };
  if (a.kind === 'entry.update' && b.kind === 'entry.update') {
    const op = setBase({ ...b }, baseOf(a));
    return { action: 'replace', merged: withFirstBase(prev, next, op) };
  }
  if (a.kind === 'entry.update' && b.kind === 'entry.delete') {
    const op = setBase({ ...b }, baseOf(a));
    return { action: 'replace', merged: withFirstBase(prev, next, op) };
  }

  // Habits --------------------------------------------------------------------------------
  if (a.kind === 'habit.create' && b.kind === 'habit.update') {
    const op: SyncOp = { ...a, opId: b.opId, editedAt: b.editedAt, payload: b.payload };
    return { action: 'replace', merged: { ...withFirstBase(prev, next, op), localId: prev.localId } };
  }
  if (a.kind === 'habit.update' && b.kind === 'habit.update') {
    return { action: 'replace', merged: withFirstBase(prev, next, setBase({ ...b }, baseOf(a))) };
  }
  if (a.kind === 'habit.archive' && b.kind === 'habit.archive') {
    return { action: 'replace', merged: withFirstBase(prev, next, setBase({ ...b }, baseOf(a))) };
  }

  // Logs ----------------------------------------------------------------------------------
  if ((a.kind === 'log.set' || a.kind === 'log.delete') && (b.kind === 'log.set' || b.kind === 'log.delete')) {
    return { action: 'replace', merged: withFirstBase(prev, next, setBase({ ...b }, baseOf(a))) };
  }

  // Settings ------------------------------------------------------------------------------
  if (a.kind === 'settings.patch' && b.kind === 'settings.patch') {
    const payload: Partial<AppSettings> = { ...a.payload, ...b.payload };
    const base: Record<string, unknown> = {};
    let baseKnown = false;
    for (const key of Object.keys(payload)) {
      const fromA = key in a.payload ? a.base : undefined;
      const source = fromA && key in fromA ? fromA : b.base && key in b.base && !(key in a.payload) ? b.base : undefined;
      if (source) {
        base[key] = (source as Record<string, unknown>)[key];
        baseKnown = true;
      }
    }
    const op: SyncOp = { ...b, payload, ...(baseKnown ? { base: base as Partial<AppSettings> } : {}) };
    if (!baseKnown) delete (op as { base?: unknown }).base;
    return { action: 'replace', merged: withFirstBase(prev, next, op) };
  }

  return APPEND;
}
