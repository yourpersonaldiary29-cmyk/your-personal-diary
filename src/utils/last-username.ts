/**
 * Remembers the username that last signed in on this device (localStorage key
 * `mpd.lastUsername`) so the login form can be prefilled. Only the name is kept -
 * never a password or a token (those live in the api client's token storage).
 * Every storage access is guarded: private windows and blocked site data make
 * localStorage throw, and the login page must still work then.
 */

export const LAST_USERNAME_KEY = 'mpd.lastUsername';

/** The remembered username, or null when none is stored / storage is unavailable. */
export function getLastUsername(): string | null {
  try {
    const value = window.localStorage.getItem(LAST_USERNAME_KEY);
    const clean = value?.trim() ?? '';
    return clean ? clean : null;
  } catch {
    return null;
  }
}

/** Stores `username` (trimmed) for the next login; an empty name clears the entry. */
export function setLastUsername(username: string): void {
  try {
    const clean = username.trim();
    if (clean) window.localStorage.setItem(LAST_USERNAME_KEY, clean);
    else window.localStorage.removeItem(LAST_USERNAME_KEY);
  } catch {
    /* storage unavailable - the user simply types the name next time */
  }
}

/** Forgets the remembered username. */
export function clearLastUsername(): void {
  try {
    window.localStorage.removeItem(LAST_USERNAME_KEY);
  } catch {
    /* ignore */
  }
}
