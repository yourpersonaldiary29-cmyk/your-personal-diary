/**
 * Decrypted shapes of the offline engine: what the `ct` of each store holds (see ./store/types.ts),
 * plus the public types the UI package (WP-H10c) consumes.
 */
import type { AppSettings, Entry, Habit, HabitFrequency, HabitLog } from '@shared/types';
import type { SyncOp, SyncOpKind, SyncOpResult } from '@shared/sync';

/**
 * One queued operation (the content of an outbox row).
 *
 *  - `chain`: operations of one chain go out in order ('entry:<key>', 'habits', 'log:<habit key>:<date>',
 *    'settings'); `record`: the record the operation changes (coalescing works per record).
 *    A key is `c:<clientId>` for a record created on this device, `i:<server id>` otherwise.
 *  - `baseOp`: the opId of a SEALED predecessor on the same record whose answer gives `op.base`; it is
 *    resolved when this operation is sealed (section 4.4 "Base resolution at seal time").
 *  - `hint`: display-only facts that the operation itself does not carry (the overlay and the labels).
 */
export interface QueuedOp {
  op: SyncOp;
  baseOp?: string;
  chain: string;
  record: string;
  /** Creates: the negative id shown until the server id is known. */
  localId?: number;
  hint?: OpHint;
  /** Device epoch ms of the first enqueue of this record's pending change. */
  queuedAt: number;
}

export interface OpHint {
  /** Entry / habit: createdAt of the record as shown (an update keeps it). */
  createdAt?: string;
  /** Habit: sortOrder and archive state as shown. */
  sortOrder?: number;
  isArchived?: boolean;
  /** Log: the value before this change (null: no log), for the week total of the habit progress view. */
  prevValue?: number | null;
  /** Log: the habit as shown (name for the label, target/frequency for `completed`). */
  habit?: { name: string; unit: string; target: number; frequency: HabitFrequency };
  /** Entry delete: the title and date as shown (the label of the review list). */
  title?: string;
  date?: string;
  /** The id shown for the record (negative for a record created offline). */
  displayId?: number;
  /**
   * Entry update / delete: what the device showed for the entry BEFORE this change (the overlay moves
   * calendar counts and tag counts from the old date / tags to the new ones).
   */
  prev?: { date: string; title: string; tags: string[]; people: string[]; location: string };
  /** Habit create: the sort order given on the device (after the last known habit). */
  nextSortOrder?: number;
}

/** An acknowledged operation with its answer (journal store), kept 7 days. */
export interface JournalEntry {
  opId: string;
  appliedAt: number;
  queued: QueuedOp;
  /** The operation exactly as sent (base resolved). */
  sent: SyncOp;
  result: SyncOpResult;
}

/** Local id -> client id (and the server id once known). */
export interface IdMapEntry {
  localId: number;
  kind: 'entry' | 'habit';
  clientId: string;
  serverId?: number;
}

/** Why a note exists (the `shell.sync.reason.*` texts of the UI). */
export type NoteReason =
  | 'lost'
  | 'won'
  | 'gone'
  | 'deleteLost'
  | 'deleteWon'
  | 'stale'
  | 'otherLost'
  | 'otherWon'
  | 'rejected'
  | 'tooLarge'
  | 'blocked';

/** A short label of a change: "Entry 'Morning walk', 23 Oct"; "Habit Water, 3 glasses"; "Setting: theme". */
export interface OpLabel {
  kind: SyncOpKind;
  title?: string;
  date?: string;
  habitName?: string;
  value?: number;
  unit?: string;
  settingKeys?: string[];
}

/** One note (section 4.9): stays until the user acts. */
export interface SyncNote {
  id: number;
  createdAt: number;
  reason: NoteReason;
  label: OpLabel;
  /** The user's operation (its payload is the user's version). */
  op: SyncOp;
  /** Entries: the user's version as a full entry (Show my version, Save as a new entry, Copy text). */
  mine?: Entry | null;
  /**
   * The other version: what the server kept (conflict-lost: `record`) or what this change overwrote or
   * deleted (conflict-won: `replaced`).
   */
  other?: Entry | Habit | HabitLog | Partial<AppSettings> | AppSettings | null;
  /** The server's message (rejected: 400 / 413). */
  message?: string;
}

/** One waiting operation as the review list shows it. */
export interface PendingItem {
  seq: number;
  opId: string;
  label: OpLabel;
  state: 'waiting' | 'uploading' | 'stillTrying' | 'blocked';
  /** The server's message for 'stillTrying'. */
  message?: string;
  attempts: number;
}
