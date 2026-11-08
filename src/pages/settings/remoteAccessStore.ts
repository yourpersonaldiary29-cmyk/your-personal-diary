/**
 * The last remote-access status seen on the Settings page, shared by the
 * Remote access card (which loads and changes it) and the Privacy card (which
 * must know whether remote access is on before turning offline privacy mode on,
 * and turns it off after the user confirms). A tiny external store read with
 * useSyncExternalStore; null until the card has loaded the status (or on a
 * phone, where the card is not shown and remote access cannot be managed).
 */
import { useSyncExternalStore } from 'react';
import type { RemoteStatus } from '@shared/types';

let current: RemoteStatus | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Publishes a status returned by the server (or null to forget it). */
export function publishRemoteStatus(status: RemoteStatus | null): void {
  if (status === current) return;
  current = status;
  for (const listener of [...listeners]) listener();
}

/** The last published status (outside React). */
export function getRemoteStatus(): RemoteStatus | null {
  return current;
}

/** The last published status; re-renders the caller whenever it changes. */
export function useRemoteStatus(): RemoteStatus | null {
  return useSyncExternalStore(subscribe, getRemoteStatus, () => null);
}
