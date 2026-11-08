/**
 * `DiaryPrivacyScreen` - FLAG_SECURE on the app window (WP-9): the app shows a blank card in the
 * recent-apps screen and screenshots / screen recordings of it are blocked.
 * Java: android/app/src/main/java/com/mydiary/app/plugins/DiaryPrivacyScreenPlugin.java.
 *
 * The native side remembers the choice itself (SharedPreferences, default ON) and applies it when
 * the activity starts - before any JavaScript runs - so the first frames of the app are covered too.
 */
import { registerPlugin } from '@capacitor/core';

export interface DiaryPrivacyScreenPlugin {
  setEnabled(options: { enabled: boolean }): Promise<void>;
  isEnabled(): Promise<{ enabled: boolean }>;
}

export const DiaryPrivacyScreen = registerPlugin<DiaryPrivacyScreenPlugin>('DiaryPrivacyScreen');
