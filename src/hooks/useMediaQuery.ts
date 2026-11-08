/**
 * Reactive `window.matchMedia(query).matches`. Falls back to `false` where
 * matchMedia is missing (tests, very old WebViews). The subscribe/snapshot
 * functions are memoised per query so React does not resubscribe on every
 * render.
 */
import { useMemo, useSyncExternalStore } from 'react';

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function subscribe(query: string, callback: () => void): () => void {
  if (!hasMatchMedia()) return () => undefined;
  const mql = window.matchMedia(query);
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', callback);
    return () => mql.removeEventListener('change', callback);
  }
  // Safari < 14
  mql.addListener(callback);
  return () => mql.removeListener(callback);
}

function snapshot(query: string): boolean {
  if (!hasMatchMedia()) return false;
  return window.matchMedia(query).matches;
}

const serverSnapshot = () => false;

export function useMediaQuery(query: string): boolean {
  const store = useMemo(
    () => ({
      subscribe: (cb: () => void) => subscribe(query, cb),
      getSnapshot: () => snapshot(query),
    }),
    [query],
  );
  return useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);
}

/** Breakpoint used by the navigation bar for the "Menu" toggle. */
export const NARROW_SCREEN_QUERY = '(max-width: 720px)';
