/**
 * What the data volume last told us (docs/HOSTED-PLAN.md 2.8, 3.6): the vault reports every
 * background persist here - success or failure - and the hosted health / status answers read it.
 * One record per process (there is one data directory per process); in local mode it is only ever
 * written, never read, so nothing changes there.
 */
export interface StorageHealth {
  /** False after a persist failed and no persist has succeeded since. */
  ok: boolean;
  lastOkAt: string | null;
  lastFailureAt: string | null;
  /** Failures since the last success. */
  failures: number;
  /** Message of the last failure (a catalogue key or an error text; never a path). */
  lastError: string | null;
  /** True when the last failure looked like a full disk (ENOSPC). */
  full: boolean;
}

const state: StorageHealth = { ok: true, lastOkAt: null, lastFailureAt: null, failures: 0, lastError: null, full: false };

export function markStorageOk(now: Date = new Date()): void {
  state.ok = true;
  state.failures = 0;
  state.lastOkAt = now.toISOString();
  state.lastError = null;
  state.full = false;
}

export function markStorageFailed(error: unknown, now: Date = new Date()): void {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  state.ok = false;
  state.failures++;
  state.lastFailureAt = now.toISOString();
  state.lastError = error instanceof Error ? error.message : String(error);
  state.full = code === 'ENOSPC' || /ENOSPC|no space/i.test(state.lastError);
}

/** A read-only copy of the current record. */
export function storageHealth(): Readonly<StorageHealth> {
  return { ...state };
}

/** Tests: back to the pristine record. */
export function resetStorageHealth(): void {
  Object.assign(state, { ok: true, lastOkAt: null, lastFailureAt: null, failures: 0, lastError: null, full: false });
}
