/**
 * Small plain-data seams between the auth flow and the offline UI (docs/android-tasks/OFFLINE-DESIGN.md
 * sections 4.3, 4.8 and 6; WP-H10c). No React here: src/context/AuthContext.tsx imports it without
 * pulling the sync components in, and the components read and register through it.
 *
 *  - The sign-out gate: `logout` asks the registered confirmer before it signs out with changes still on
 *    the device ("{n} changes on this device have not been uploaded yet..."). Without a confirmer (a tree
 *    without the SyncProvider: page tests) the sign-out goes ahead as today.
 *  - The waiting line of the login page: a 401 remembers how many changes the account left on the device
 *    ("Sign in again to upload the {n} changes saved on this device"); the next sign-in forgets it.
 *  - "Saved on this device": one toast for one offline save, whoever notices it first (the page that got
 *    an optimistic record, or the provider that saw the outbox grow while offline).
 *  - "Drain first" for the online-only writes (habit delete / reorder, demo data, restore, profile,
 *    password, sessions): upload what is waiting, then go ahead only when nothing is left.
 *  - The full wipe of an account on this device (`wipeAccountQuietly`), called explicitly by the sign-out
 *    after the dialog and by the account deletion (section 4.8, E16) - never from
 *    `clearSignedOutAccountData`.
 */
import { getSyncStatus, isPendingRecord, offline, subscribeSyncStatus } from '@/offline';
import { tr } from '@/i18n/runtime';

// ---------------------------------------------------------------------------
// What the device holds for the armed account (kept current from the status store)
// ---------------------------------------------------------------------------

/**
 * The last counts seen for an armed account. A 401 tears the engine down at once (its own listener), so
 * the login page's waiting line reads the count from here instead of from the stopped engine.
 */
let lastKnown: { userId: string; pending: number } | null = null;

function trackStatus(): void {
  const s = getSyncStatus();
  if (s.enabled && s.userId) lastKnown = { userId: s.userId, pending: s.pending };
}
subscribeSyncStatus(trackStatus);

/** Operations of `userId` still waiting in the outbox (the armed engine, else the last count seen for it). */
export function pendingOnDevice(userId: string | null | undefined): number {
  if (!userId) return 0;
  const s = getSyncStatus();
  if (s.enabled && s.userId === userId) return s.pending;
  return lastKnown?.userId === userId ? lastKnown.pending : 0;
}

// ---------------------------------------------------------------------------
// Sign-out gate (section 4.8)
// ---------------------------------------------------------------------------

/** What the user chose in the "changes not uploaded yet" dialog. */
export type LogoutChoice = 'stay' | 'delete';

export interface LogoutPrompt {
  /** Changes on the device: waiting operations plus notes. */
  count: number;
  /** False on the lock screen: "Review" would show the diary's text without the password. */
  allowReview: boolean;
}

type LogoutConfirmer = (prompt: LogoutPrompt) => Promise<LogoutChoice>;

let logoutConfirmer: LogoutConfirmer | null = null;

/** The SyncProvider installs the dialog; null removes it. */
export function setLogoutConfirmer(fn: LogoutConfirmer | null): void {
  logoutConfirmer = fn;
}

/** Asks before a sign-out with changes on the device. Without a dialog the sign-out goes ahead. */
export function confirmLogoutWithPending(prompt: LogoutPrompt): Promise<LogoutChoice> {
  return logoutConfirmer ? logoutConfirmer(prompt) : Promise.resolve('delete');
}

/** True while the lock screen is up (the sign-out dialog then offers no "Review"). */
let lockScreenUp = false;
export function setLockScreenUp(up: boolean): void {
  lockScreenUp = up;
}
export function isLockScreenUp(): boolean {
  return lockScreenUp;
}

/** Waiting operations plus notes of the armed account (0 when the engine is off or armed for another account). */
export function changesOnDevice(userId: string | null | undefined): number {
  if (!userId || !offline.isActive() || offline.activeUserId() !== userId) return 0;
  return getSyncStatus().pending + offline.notes.list().length;
}

/**
 * The sign-out's question (section 4.8 "Logout with pending operations or notes"): online, the outbox is
 * uploaded first; when anything is left, the dialog decides. Resolves true when the sign-out may go on
 * (nothing left, or "Delete them and sign out"), false for "Stay signed in" / "Review".
 *
 * An account whose engine is not armed (the server stopped offering offline mode, a start that failed)
 * can still have an outbox in its database: it is counted without opening it, and the same dialog asks.
 */
export async function mayEndSessionWithChanges(userId: string): Promise<boolean> {
  let count: number;
  if (offline.isActive() && offline.activeUserId() === userId) {
    count = changesOnDevice(userId);
    if (count > 0 && getSyncStatus().phase !== 'offline') {
      try {
        await offline.drain();
      } catch {
        /* what is left is counted below */
      }
      count = changesOnDevice(userId);
    }
  } else {
    try {
      count = (await offline.otherAccountsWithPending(null)).find((a) => a.userId === userId)?.count ?? 0;
    } catch {
      count = 0;
    }
  }
  if (count <= 0) return true;
  const choice = await confirmLogoutWithPending({ count, allowReview: !isLockScreenUp() && offline.isActive() });
  return choice === 'delete';
}

/** How long a sign-out waits for the wipe of the device's copy before it goes on (a blocked IndexedDB delete). */
export const WIPE_WAIT_MS = 3000;

/** `offline.wipeAccount(userId)` that never throws and never holds a sign-out up for longer than WIPE_WAIT_MS. */
export async function wipeAccountQuietly(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      offline.wipeAccount(userId),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, WIPE_WAIT_MS);
      }),
    ]);
  } catch {
    /* best effort: what is left is ciphertext */
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (lastKnown?.userId === userId) lastKnown = null;
}

// ---------------------------------------------------------------------------
// The login page's waiting line (section 4.8, row "401")
// ---------------------------------------------------------------------------

let signedOutPending: { userId: string; count: number } | null = null;
const signedOutListeners = new Set<() => void>();

function emitSignedOut(): void {
  for (const l of [...signedOutListeners]) l();
}

/** A 401 ended the session with `count` changes left on the device (kept: they upload after the next sign-in). */
export function rememberSignedOutPending(userId: string, count: number): void {
  signedOutPending = count > 0 ? { userId, count } : null;
  emitSignedOut();
}

/** A sign-in happened: the line goes. */
export function forgetSignedOutPending(): void {
  if (!signedOutPending) return;
  signedOutPending = null;
  emitSignedOut();
}

export function getSignedOutPending(): { userId: string; count: number } | null {
  return signedOutPending;
}

export function subscribeSignedOutPending(listener: () => void): () => void {
  signedOutListeners.add(listener);
  return () => {
    signedOutListeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// "Saved on this device" (section 4.3 (c))
// ---------------------------------------------------------------------------

/** One toast per offline save: a second notice within this window is the same save. */
export const SAVED_ON_DEVICE_DEDUPE_MS = 1500;
let lastSavedOnDeviceAt = Number.NEGATIVE_INFINITY;

/** Shows "Saved on this device..." unless it was shown a moment ago for the same save. Returns true when shown now. */
export function showSavedOnDevice(show: (message: string) => void, now: number = Date.now()): boolean {
  if (now - lastSavedOnDeviceAt < SAVED_ON_DEVICE_DEDUPE_MS) return false;
  lastSavedOnDeviceAt = now;
  show(tr('shell.sync.savedOnDevice'));
  return true;
}

/** Marks a "Saved on this device" as just shown (a page that announced it itself). */
export function markSavedOnDeviceShown(now: number = Date.now()): void {
  lastSavedOnDeviceAt = now;
}

/** True when a write resolved from the device (an optimistic record, or a change still waiting for that record). */
export function savedOnDevice(result: unknown, record?: { kind: 'entry' | 'habit'; id: number }): boolean {
  if (isPendingRecord(result)) return true;
  if (!record || !offline.isActive()) return false;
  return offline.hasPending(record.kind, record.id);
}

/** Tests only. */
export function __resetSyncGateForTests(): void {
  logoutConfirmer = null;
  lockScreenUp = false;
  signedOutPending = null;
  lastKnown = null;
  lastSavedOnDeviceAt = Number.NEGATIVE_INFINITY;
  emitSignedOut();
}

// ---------------------------------------------------------------------------
// Drain first (section 4.3 "Online-only writes run only when the outbox is empty")
// ---------------------------------------------------------------------------

export interface DrainNotify {
  /** "Uploading your changes first..." (shown before the drain when something waits). */
  onDraining?: (message: string) => void;
  /** "Your changes have not been uploaded yet..." (the write is not made). */
  onLeft?: (message: string) => void;
}

/**
 * Uploads what is waiting before an online-only write. Resolves true when the write may go ahead
 * (offline mode off, or nothing left in the outbox), false when changes are still waiting.
 */
export async function drainBeforeOnlineWrite(notify: DrainNotify = {}): Promise<boolean> {
  if (!offline.isActive()) return true;
  if (getSyncStatus().pending === 0) return true;
  notify.onDraining?.(tr('shell.sync.drainFirst'));
  let left = 1;
  try {
    left = (await offline.drain()).remaining;
  } catch {
    left = getSyncStatus().pending;
  }
  if (left > 0) {
    notify.onLeft?.(tr('shell.sync.drainFailed'));
    return false;
  }
  return true;
}
