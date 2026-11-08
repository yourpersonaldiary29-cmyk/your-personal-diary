/**
 * React views of the offline engine's status store (src/offline/status.ts) for the UI of the automatic
 * offline mode (docs/android-tasks/OFFLINE-DESIGN.md section 6). Safe outside the providers: without an
 * AuthProvider (a component rendered alone) offline mode counts as off, and with the engine off (local
 * builds, page tests, old servers, guests) every hook reports "off" - the pages behave as today.
 */
import { useContext, useSyncExternalStore } from 'react';
import { getSyncStatus, offline, subscribeSyncStatus, type PendingItem, type SyncNote, type SyncStatus } from '@/offline';
import { AuthContext, isGuestUser } from '@/context/AuthContext';

/** The engine's status (phase, counts, data version...). */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}

/** True while offline mode runs for the signed-in account (not the guest of the tour). */
export function useSyncEnabled(): boolean {
  const status = useSyncStatus();
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;
  return status.enabled && auth?.status === 'authenticated' && !!user && !isGuestUser(user) && status.userId === user.id;
}

/**
 * True while offline mode runs and the diary server cannot be reached (the bar shows "No connection"):
 * the online-only pages show the notice and their buttons are disabled (section 6.2). A blip that
 * recovers within 1.5 s never counts (the engine's `showOffline` rule).
 */
export function useOfflineNow(): boolean {
  const status = useSyncStatus();
  const enabled = useSyncEnabled();
  return enabled && status.phase === 'offline';
}

/** The waiting operations and the notes of the armed account, read again whenever the engine's counts move. */
export function useSyncItems(): { pending: PendingItem[]; notes: SyncNote[] } {
  const status = useSyncStatus();
  // The lists live in the engine (not in the store): the store's counters and data version say when to read them again.
  void status.dataVersion;
  void status.pending;
  void status.attention;
  void status.uploading;
  if (!status.enabled) return { pending: [], notes: [] };
  return { pending: offline.pending(), notes: offline.notes.list() };
}
