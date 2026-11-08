/**
 * History helpers. React Router stores an index (`idx`) in `history.state`
 * for every entry it creates, so `idx > 0` means "there is an in-app page to go
 * back to" (the first entry of the session has idx 0).
 */

/** True when navigate(-1) would stay inside the application. */
export function canGoBack(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const state = window.history.state as { idx?: unknown } | null;
    const idx = state && typeof state.idx === 'number' ? state.idx : null;
    if (idx !== null) return idx > 0;
  } catch {
    /* history.state may be inaccessible in exotic environments */
  }
  return false;
}
