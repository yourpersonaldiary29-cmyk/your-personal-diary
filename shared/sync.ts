/**
 * Offline sync contract (WP-H10, docs/android-tasks/OFFLINE-DESIGN.md §3.4). Shared by the hosted
 * server (`server/src/sync/**`, `server/src/routes/sync.ts`) and the client engine (`src/offline/**`).
 *
 * FROZEN in the first commit of WP-H10a: change only additively and in step with both sides.
 *
 * Two routes, hosted mode only (the local server answers 404):
 *   GET  /api/sync/key  -> SyncKeyResponse
 *   POST /api/sync/op   (body: one SyncOp) -> SyncOpResult
 *
 * Dependency-free (types only + three pure functions), like `shared/types.ts`.
 */
import type { AppSettings, Entry, EntryInput, Habit, HabitInput, HabitLog } from './types';

/** Version of the wire protocol; every operation carries `v: 1`. */
export const SYNC_PROTOCOL = 1;

/** A record as the device knows it: the server id, or the clientId of a queued (maybe not yet acknowledged) create. */
export type SyncRef = { id: number } | { clientId: string };

/** The compare-and-set scope of `habit.update` (archive is a separate scope: `habit.archive`). */
export type HabitFields = Pick<
  Habit,
  'name' | 'description' | 'target' | 'unit' | 'frequency' | 'reminderTime' | 'reminderEnabled'
>;

/** The compare-and-set scope of a habit log (habit + date). */
export type LogFields = { value: number; note: string };

interface OpCommon {
  v: 1;
  /** The signed-in user's id (`User.id`); another account's id gives 409 'server.sync.accountMismatch'. */
  account: string;
  /** `crypto.randomUUID()`, new for every (coalesced) operation. */
  opId: string;
  /** UTC ISO with milliseconds: the time of the user's edit (device clock + learned offset). */
  editedAt: string;
  /** `SyncKeyResponse.epoch` the device knew when it queued the operation. */
  epoch: string;
}

export type SyncOp = OpCommon &
  (
    | { kind: 'entry.create'; clientId: string; payload: EntryInput }
    /** base = the `Entry.updatedAt` this device last showed. */
    | { kind: 'entry.update'; target: SyncRef; base?: string; payload: EntryInput }
    | { kind: 'entry.delete'; target: SyncRef; base?: string }
    | { kind: 'habit.create'; clientId: string; payload: HabitInput }
    | { kind: 'habit.update'; target: SyncRef; base?: HabitFields; payload: HabitInput }
    | { kind: 'habit.archive'; target: SyncRef; base?: { archived: boolean }; payload: { archived: boolean } }
    /** base null = no log was there. */
    | { kind: 'log.set'; habit: SyncRef; date: string; base?: LogFields | null; payload: LogFields }
    | { kind: 'log.delete'; habit: SyncRef; date: string; base?: LogFields | null }
    | { kind: 'settings.patch'; base?: Partial<AppSettings>; payload: Partial<AppSettings> }
  );

export type SyncOpKind = SyncOp['kind'];

/** Every operation kind, in contract order. */
export const SYNC_OP_KINDS: readonly SyncOpKind[] = [
  'entry.create',
  'entry.update',
  'entry.delete',
  'habit.create',
  'habit.update',
  'habit.archive',
  'log.set',
  'log.delete',
  'settings.patch',
];

/**
 * - applied: the change was written.
 * - unchanged: nothing to do (already applied - a replay - or the server already holds that content).
 * - conflict-won: the record was changed elsewhere, this (newer) change was written; `replaced` = what it overwrote.
 * - conflict-lost: the record was changed elsewhere later; nothing was written; `record` = the kept version.
 * - gone: the record was deleted on the server; nothing was written (it is never recreated).
 * - stale: the diary was restored from a backup after the operation was queued (epoch changed); nothing was written.
 */
export type SyncOutcome = 'applied' | 'unchanged' | 'conflict-won' | 'conflict-lost' | 'gone' | 'stale';

export interface SyncOpResult {
  opId: string;
  outcome: SyncOutcome;
  /** Current server state of the record after the operation (null: it does not exist). */
  record: Entry | Habit | HabitLog | AppSettings | null;
  /** Only for conflict-won: what was overwritten or deleted. */
  replaced?: Entry | Habit | HabitLog | Partial<AppSettings>;
  /** Only for settings.patch: the outcome of each key of the payload. */
  keys?: Partial<Record<keyof AppSettings, 'applied' | 'unchanged' | 'conflict-won' | 'conflict-lost'>>;
  serverNow: string;
  epoch: string;
}

/** `GET /api/sync/key`: the account offline key (AOK, base64 of 32 bytes), the restore epoch and the server clock. */
export interface SyncKeyResponse {
  key: string;
  epoch: string;
  serverNow: string;
}

/** Largest operation a client may queue: under the hosted data body limit '2mb' (server/src/app.ts DATA_BODY_LIMIT). */
export const SYNC_MAX_OP_BYTES = 2 * 1024 * 1024 - 16 * 1024;

/** `editedAt` / `serverNow` format: UTC ISO with milliseconds (what `Date.prototype.toISOString` writes). */
export const SYNC_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** opId / clientId format: a `crypto.randomUUID()` value (any RFC 4122 variant/version, lower or upper case). */
export const SYNC_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Milliseconds of an ISO time; '' (no time recorded) and unparsable values are older than anything. */
function isoMs(iso: string): number {
  if (!iso) return Number.NEGATIVE_INFINITY;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
}

/** min(editedAt, now): a device clock that runs fast never puts a change in the server's future. */
export function clampEditedAt(editedAt: string, now: string): string {
  return isoMs(editedAt) > isoMs(now) ? now : editedAt;
}

/**
 * The version written for a record whose stored version/time is `stored`: max(stored + 1 ms, ts).
 * Versions only move forward. `stored` '' (no time recorded) gives `ts`.
 */
export function nextVersion(stored: string, ts: string): string {
  const s = isoMs(stored);
  if (s === Number.NEGATIVE_INFINITY) return ts;
  const t = isoMs(ts);
  return t > s ? ts : new Date(s + 1).toISOString();
}

/**
 * The conflict rule of one record (§3.4 "decide"):
 * 1. not exists -> gone; 2. same content -> unchanged; 3. base known and matching -> applied;
 * 4. ts newer than the stored time -> conflict-won; 5. otherwise conflict-lost.
 * `storedAt` '' (written by an older app, or pruned) is older than any queued change.
 */
export function decide(i: {
  exists: boolean;
  same: boolean;
  baseKnown: boolean;
  baseMatches: boolean;
  ts: string;
  storedAt: string;
}): 'gone' | 'unchanged' | 'applied' | 'conflict-won' | 'conflict-lost' {
  if (!i.exists) return 'gone';
  if (i.same) return 'unchanged';
  if (i.baseKnown && i.baseMatches) return 'applied';
  if (isoMs(i.ts) > isoMs(i.storedAt)) return 'conflict-won';
  return 'conflict-lost';
}

/** Outcome of one key of a `settings.patch` (`SyncOpResult.keys`). */
export type SyncKeyOutcome = 'applied' | 'unchanged' | 'conflict-won' | 'conflict-lost';

/**
 * The outcome of a whole `settings.patch` from its per-key outcomes (additive helper, WP-H10a):
 * conflict-won if any key won (then `replaced` holds the overwritten values of those keys), else
 * applied if any key applied, else conflict-lost if any key lost, else unchanged. The per-key
 * truth is always in `keys`.
 */
export function settingsOutcome(keys: Partial<Record<string, SyncKeyOutcome>>): 'applied' | 'unchanged' | 'conflict-won' | 'conflict-lost' {
  const values = Object.values(keys);
  if (values.includes('conflict-won')) return 'conflict-won';
  if (values.includes('applied')) return 'applied';
  if (values.includes('conflict-lost')) return 'conflict-lost';
  return 'unchanged';
}
