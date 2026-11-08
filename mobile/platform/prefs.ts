/**
 * Phone-only settings (WP-8 / WP-9), kept on the device with @capacitor/preferences - not in the
 * diary's AppSettings: they describe THIS phone (how it locks, what its notifications show), not the
 * account, and they must be readable before any session exists (the privacy screen, the lock on
 * leave). Only booleans; anything unreadable falls back to the defaults.
 *
 *  - lockOnLeave     "Lock when I leave the app"                                default ON
 *  - privacyScreen   "Hide content in recent apps and block screenshots"       default ON
 *  - showHabitNames  "Show habit names in notifications"                        default OFF
 *  - biometricUnlock "Unlock with fingerprint or face" (behind a feature flag)   default OFF
 */
import type { PreferencesPlugin } from '@capacitor/preferences';

export interface PhonePrefs {
  lockOnLeave: boolean;
  privacyScreen: boolean;
  showHabitNames: boolean;
  biometricUnlock: boolean;
}

export const DEFAULT_PHONE_PREFS: Readonly<PhonePrefs> = Object.freeze({
  lockOnLeave: true,
  privacyScreen: true,
  showHabitNames: false,
  biometricUnlock: false,
});

/** The key of the JSON document in the Preferences store. */
export const PHONE_PREFS_KEY = 'phone.prefs';

export type PreferencesLike = Pick<PreferencesPlugin, 'get' | 'set'>;

export interface PhonePrefsStore {
  /** The current values (the defaults until `load()` resolved). */
  get(): PhonePrefs;
  /** Reads the stored values once; resolves with them. Never rejects (defaults on failure). */
  load(): Promise<PhonePrefs>;
  /** Changes some values, stores them and notifies the subscribers. */
  update(patch: Partial<PhonePrefs>): Promise<PhonePrefs>;
  /** Called after every change; returns the unsubscribe function. */
  subscribe(listener: (prefs: PhonePrefs) => void): () => void;
}

/** The stored document, validated: unknown keys dropped, non-booleans ignored. */
export function parsePhonePrefs(raw: string | null | undefined): PhonePrefs {
  const prefs: PhonePrefs = { ...DEFAULT_PHONE_PREFS };
  if (!raw) return prefs;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return prefs;
  }
  if (typeof parsed !== 'object' || parsed === null) return prefs;
  for (const key of Object.keys(DEFAULT_PHONE_PREFS) as (keyof PhonePrefs)[]) {
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value === 'boolean') prefs[key] = value;
  }
  return prefs;
}

export function createPhonePrefsStore(preferences: PreferencesLike): PhonePrefsStore {
  let current: PhonePrefs = { ...DEFAULT_PHONE_PREFS };
  const listeners = new Set<(prefs: PhonePrefs) => void>();
  let loaded: Promise<PhonePrefs> | null = null;

  function notify(): void {
    for (const listener of listeners) listener(current);
  }

  return {
    get: () => current,
    load() {
      loaded ??= (async () => {
        try {
          const { value } = await preferences.get({ key: PHONE_PREFS_KEY });
          current = parsePhonePrefs(value);
        } catch (e) {
          console.warn('[mobile] the phone settings could not be read - using the defaults', e);
        }
        notify();
        return current;
      })();
      return loaded;
    },
    async update(patch) {
      current = { ...current, ...patch };
      try {
        await preferences.set({ key: PHONE_PREFS_KEY, value: JSON.stringify(current) });
      } finally {
        notify();
      }
      return current;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
