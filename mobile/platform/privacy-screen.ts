/**
 * "Hide content in recent apps and block screenshots" (WP-9): keeps the window's FLAG_SECURE in
 * step with the phone setting `privacyScreen` (default on). The native plugin applies the stored
 * value by itself when the activity starts; this only follows later changes of the setting.
 */
import type { DiaryPrivacyScreenPlugin } from '../plugins/diary-privacy-screen';
import type { PhonePrefsStore } from './prefs';

export type PrivacyScreenLike = Pick<DiaryPrivacyScreenPlugin, 'setEnabled'>;

/** Applies the current value and every later change; returns the function that stops following. */
export function syncPrivacyScreen(store: PhonePrefsStore, plugin: PrivacyScreenLike, log: (message: string, error?: unknown) => void = defaultLog): () => void {
  let applied: boolean | null = null;
  const apply = (enabled: boolean) => {
    if (applied === enabled) return;
    applied = enabled;
    plugin.setEnabled({ enabled }).catch((e) => {
      applied = null;
      log('the privacy screen could not be changed', e);
    });
  };
  apply(store.get().privacyScreen);
  return store.subscribe((prefs) => apply(prefs.privacyScreen));
}

function defaultLog(message: string, error?: unknown): void {
  console.warn(`[mobile] privacy screen: ${message}`, error ?? '');
}
