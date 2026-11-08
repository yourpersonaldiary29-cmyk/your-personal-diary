/** FLAG_SECURE follows the phone setting (WP-9). */
import { describe, expect, it, vi } from 'vitest';
import { createPhonePrefsStore } from './prefs';
import { syncPrivacyScreen } from './privacy-screen';

function store() {
  let value: string | null = null;
  return createPhonePrefsStore({
    get: async () => ({ value }),
    set: async ({ value: next }) => {
      value = next;
    },
  });
}

describe('syncPrivacyScreen', () => {
  it('applies the current value, follows changes and never repeats a value', async () => {
    const prefs = store();
    const setEnabled = vi.fn(async () => undefined);
    const stop = syncPrivacyScreen(prefs, { setEnabled });
    expect(setEnabled).toHaveBeenCalledWith({ enabled: true });
    await prefs.update({ showHabitNames: true });
    expect(setEnabled).toHaveBeenCalledTimes(1);
    await prefs.update({ privacyScreen: false });
    expect(setEnabled).toHaveBeenLastCalledWith({ enabled: false });
    stop();
    await prefs.update({ privacyScreen: true });
    expect(setEnabled).toHaveBeenCalledTimes(2);
  });

  it('a failed call is logged and retried on the next change', async () => {
    const prefs = store();
    const setEnabled = vi.fn().mockRejectedValueOnce(new Error('no window')).mockResolvedValue(undefined);
    const log = vi.fn();
    syncPrivacyScreen(prefs, { setEnabled }, log);
    await Promise.resolve();
    await Promise.resolve();
    expect(log).toHaveBeenCalledTimes(1);
    await prefs.update({ privacyScreen: true });
    expect(setEnabled).toHaveBeenCalledTimes(2);
  });
});
