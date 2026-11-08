/** Phone settings on the device (WP-8/9): defaults, validation, persistence, subscribers. */
import { describe, expect, it, vi } from 'vitest';
import { createPhonePrefsStore, DEFAULT_PHONE_PREFS, parsePhonePrefs, PHONE_PREFS_KEY, type PreferencesLike } from './prefs';

function fakePreferences(initial: string | null = null) {
  let value = initial;
  const prefs: PreferencesLike & { value: () => string | null } = {
    value: () => value,
    get: vi.fn(async () => ({ value })),
    set: vi.fn(async ({ value: next }) => {
      value = next;
    }),
  };
  return prefs;
}

describe('parsePhonePrefs', () => {
  it('defaults: lock on leave and privacy screen on, names and biometrics off', () => {
    expect(DEFAULT_PHONE_PREFS).toEqual({ lockOnLeave: true, privacyScreen: true, showHabitNames: false, biometricUnlock: false });
    expect(parsePhonePrefs(null)).toEqual(DEFAULT_PHONE_PREFS);
    expect(parsePhonePrefs('')).toEqual(DEFAULT_PHONE_PREFS);
  });

  it('accepts booleans only and ignores unknown keys and garbage', () => {
    expect(parsePhonePrefs('{"lockOnLeave":false,"showHabitNames":true,"extra":1}')).toEqual({ ...DEFAULT_PHONE_PREFS, lockOnLeave: false, showHabitNames: true });
    expect(parsePhonePrefs('{"lockOnLeave":"no","privacyScreen":0}')).toEqual(DEFAULT_PHONE_PREFS);
    expect(parsePhonePrefs('not json')).toEqual(DEFAULT_PHONE_PREFS);
    expect(parsePhonePrefs('[1,2]')).toEqual(DEFAULT_PHONE_PREFS);
  });
});

describe('createPhonePrefsStore', () => {
  it('loads once, updates, stores and notifies', async () => {
    const preferences = fakePreferences('{"privacyScreen":false}');
    const store = createPhonePrefsStore(preferences);
    expect(store.get()).toEqual(DEFAULT_PHONE_PREFS);
    const seen: unknown[] = [];
    store.subscribe((p) => seen.push(p));
    await store.load();
    await store.load();
    expect(preferences.get).toHaveBeenCalledTimes(1);
    expect(store.get().privacyScreen).toBe(false);

    await store.update({ showHabitNames: true });
    expect(JSON.parse(preferences.value()!)).toEqual({ ...DEFAULT_PHONE_PREFS, privacyScreen: false, showHabitNames: true });
    expect(preferences.set).toHaveBeenCalledWith({ key: PHONE_PREFS_KEY, value: expect.any(String) });
    expect(seen).toHaveLength(2);
  });

  it('a store that cannot be read gives the defaults; a failed write still notifies and rethrows', async () => {
    const preferences = fakePreferences();
    vi.mocked(preferences.get).mockRejectedValueOnce(new Error('no prefs'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = createPhonePrefsStore(preferences);
    expect(await store.load()).toEqual(DEFAULT_PHONE_PREFS);
    warn.mockRestore();

    vi.mocked(preferences.set).mockRejectedValueOnce(new Error('full'));
    const listener = vi.fn();
    store.subscribe(listener);
    await expect(store.update({ lockOnLeave: false })).rejects.toThrow('full');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get().lockOnLeave).toBe(false);
  });

  it('unsubscribe stops the notifications', async () => {
    const store = createPhonePrefsStore(fakePreferences());
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    stop();
    await store.update({ lockOnLeave: false });
    expect(listener).not.toHaveBeenCalled();
  });
});
