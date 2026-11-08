/**
 * The engine's observable state for the UI (WP-H10c reads it with `useSyncExternalStore`): one
 * small external store, like src/api/connection.ts. Plain data: nothing here makes a request.
 *
 *  - `phase`: the connectivity state machine of section 4.2 (ONLINE -> SUSPECT -> OFFLINE -> SYNCING -> ONLINE).
 *  - `showOffline`: the bar's rule - true only after 1.5 s of continuous failure or a failed probe
 *    (a blip that recovers within 1.5 s is never shown).
 *  - `showDrained`: "All changes are saved on the server" for 2.5 s after the outbox drained.
 *  - `pending` / `attention`: "N changes waiting" / "N changes need your attention" (notes plus
 *    operations that cannot be sent).
 *  - `halted`: why the replayer stopped on its own (section 4.5: 401, 423, 409, 404, an unreadable store).
 *  - `dataVersion`: bumped after every acknowledgement and every refreshed view (pages re-run on it).
 */

export type ConnectionPhase = 'online' | 'suspect' | 'offline' | 'syncing';

export type SyncHalt = 'unauthorized' | 'locked' | 'accountMismatch' | 'routeMissing' | 'unreadable' | 'forbidden';

export interface SyncStatus {
  /** True while the engine is armed for an account (section 4.1). */
  enabled: boolean;
  userId: string | null;
  phase: ConnectionPhase;
  showOffline: boolean;
  showDrained: boolean;
  /** Operations waiting in the outbox. */
  pending: number;
  /** Notes waiting for the user, plus chains that cannot be sent. */
  attention: number;
  /** True while an operation is being sent. */
  uploading: boolean;
  halted: SyncHalt | null;
  dataVersion: number;
  /** More than 500 operations or 20 MB on the device (section 4.4 "Limits"). */
  storageWarning: boolean;
  /** Operations recovered from the native mirror at the last engine open (null: none). */
  recovered: number | null;
  /** Device epoch ms of the next scheduled probe while offline (null: none scheduled). */
  nextProbeAt: number | null;
  lastDrainedAt: number | null;
}

const INITIAL: SyncStatus = {
  enabled: false,
  userId: null,
  phase: 'online',
  showOffline: false,
  showDrained: false,
  pending: 0,
  attention: 0,
  uploading: false,
  halted: null,
  dataVersion: 0,
  storageWarning: false,
  recovered: null,
  nextProbeAt: null,
  lastDrainedAt: null,
};

let state: SyncStatus = INITIAL;
const listeners = new Set<() => void>();

export function getSyncStatus(): SyncStatus {
  return state;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Merges `next` into the state; listeners run only when a field changed. */
export function patchSyncStatus(next: Partial<SyncStatus>): void {
  let changed = false;
  for (const k of Object.keys(next) as (keyof SyncStatus)[]) {
    if (next[k] !== state[k]) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  state = { ...state, ...next };
  for (const l of [...listeners]) {
    try {
      l();
    } catch {
      /* a listener's failure never stops the others */
    }
  }
}

/** Something the pages show changed (an acknowledgement, a refreshed view). */
export function bumpDataVersion(): void {
  patchSyncStatus({ dataVersion: state.dataVersion + 1 });
}

/** Tests only (and the engine's stop): back to the initial state. */
export function __resetSyncStatusForTests(): void {
  patchSyncStatus({ ...INITIAL, dataVersion: state.dataVersion });
}
