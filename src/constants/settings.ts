/**
 * Default application settings used before the server copy is loaded and for
 * anonymous visitors (login/register/welcome pages).
 */
import type { AppSettings } from '@shared/types';
import { DEFAULT_CALENDAR_EXTRAS } from '@shared/calendars/types';
import { tr } from '@/i18n/runtime';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  autoLockMinutes: 15,
  offlinePrivacyMode: true,
  theme: 'system',
  fontScale: 1,
  remindersEnabled: true,
  firstDayOfWeek: 0,
  reduceMotion: false,
  defaultPeriod: '30d',
  calendarExtras: { ...DEFAULT_CALENDAR_EXTRAS },
  language: 'en',
};

/** localStorage key caching the display preferences for anonymous pages. */
export const UI_PREFS_KEY = 'mpd.uiPrefs';

export const FONT_SCALE_MIN = 0.75;
export const FONT_SCALE_MAX = 2;

/** Theme choices; the labels are read in the current language ('settings.display.themeOption.*'). */
export const THEME_OPTIONS: { value: AppSettings['theme']; readonly label: string }[] = [
  {
    value: 'system',
    get label() {
      return tr('settings.display.themeOption.system');
    },
  },
  {
    value: 'light',
    get label() {
      return tr('settings.display.themeOption.light');
    },
  },
  {
    value: 'dark',
    get label() {
      return tr('settings.display.themeOption.dark');
    },
  },
  {
    value: 'high-contrast',
    get label() {
      return tr('settings.display.themeOption.highContrast');
    },
  },
];
