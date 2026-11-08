/**
 * Per-user application settings (stored inside the encrypted diary DB) and the
 * free-text `meta` table.
 *
 * Every setting is one row of the `settings` table: `key` = setting name,
 * `value` = JSON-encoded value. Missing or corrupt rows fall back to the defaults,
 * so the frontend always receives a complete `AppSettings` object. Validation errors
 * are catalogue keys ('server.settings.*') rendered in the request language.
 */
import { PERIODS } from '@shared/constants';
import { DEFAULT_CALENDAR_EXTRAS, type CalendarExtras } from '@shared/calendars/types';
import { DEFAULT_LOCALE, isLocale } from '@shared/i18n/locales';
import type { AppSettings, Period } from '@shared/types';
import { ApiError } from '../errors';
import type { DiaryDb } from './database';

/** Defaults documented in ARCHITECTURE.md / shared/types.ts. */
export const DEFAULT_SETTINGS: AppSettings = {
  autoLockMinutes: 10,
  offlinePrivacyMode: true,
  theme: 'system',
  fontScale: 1,
  remindersEnabled: true,
  firstDayOfWeek: 0,
  reduceMotion: false,
  defaultPeriod: '30d',
  calendarExtras: { ...DEFAULT_CALENDAR_EXTRAS },
  language: DEFAULT_LOCALE,
};

const CALENDAR_EXTRA_KEYS = Object.keys(DEFAULT_CALENDAR_EXTRAS) as (keyof CalendarExtras)[];

const THEMES: ReadonlySet<string> = new Set(['system', 'light', 'dark', 'high-contrast']);
const PERIOD_VALUES: ReadonlySet<string> = new Set(PERIODS.map((p) => p.value));
export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];

type SettingKey = keyof AppSettings;

/**
 * Validates one setting value. Throws `ApiError.validation` (with the field name)
 * when the value is out of range or of the wrong type. Returns the normalised value.
 */
export function validateSetting<K extends SettingKey>(key: K, value: unknown): AppSettings[K] {
  switch (key) {
    case 'autoLockMinutes': {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1440) {
        throw ApiError.validation('server.settings.autoLockRange', key);
      }
      return value as AppSettings[K];
    }
    case 'offlinePrivacyMode':
    case 'remindersEnabled':
    case 'reduceMotion': {
      if (typeof value !== 'boolean') throw ApiError.validation('server.settings.mustBeBoolean', key);
      return value as AppSettings[K];
    }
    case 'theme': {
      if (typeof value !== 'string' || !THEMES.has(value)) {
        throw ApiError.validation('server.settings.themeInvalid', key);
      }
      return value as AppSettings[K];
    }
    case 'fontScale': {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.75 || value > 2) {
        throw ApiError.validation('server.settings.fontScaleRange', key);
      }
      return value as AppSettings[K];
    }
    case 'firstDayOfWeek': {
      if (value !== 0 && value !== 1) throw ApiError.validation('server.settings.firstDayOfWeekInvalid', key);
      return value as AppSettings[K];
    }
    case 'defaultPeriod': {
      if (typeof value !== 'string' || !PERIOD_VALUES.has(value)) {
        throw ApiError.validation('server.settings.defaultPeriodInvalid', key);
      }
      return value as Period as AppSettings[K];
    }
    case 'language': {
      if (!isLocale(value)) throw ApiError.validation('server.settings.languageUnsupported', key);
      return value as AppSettings[K];
    }
    case 'calendarExtras': {
      // An object of booleans; missing flags keep their default, anything else is rejected.
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw ApiError.validation('server.settings.calendarExtrasObject', key);
      }
      const src = value as Record<string, unknown>;
      const out: CalendarExtras = { ...DEFAULT_CALENDAR_EXTRAS };
      for (const flag of CALENDAR_EXTRA_KEYS) {
        if (src[flag] === undefined) continue;
        if (typeof src[flag] !== 'boolean') {
          throw ApiError.validation('server.settings.calendarFlagBoolean', `${key}.${flag}`, { flag });
        }
        out[flag] = src[flag] as boolean;
      }
      return out as AppSettings[K];
    }
    default:
      throw ApiError.validation('server.settings.unknownSetting', String(key));
  }
}

/** Reads all settings, merging stored values over the defaults. Corrupt rows are ignored. */
export function getSettings(db: DiaryDb): AppSettings {
  const rows = db.all<{ key: string; value: string }>('SELECT key, value FROM settings');
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const key = String(row.key) as SettingKey;
    if (!(key in DEFAULT_SETTINGS)) continue;
    try {
      const parsed: unknown = JSON.parse(String(row.value));
      result[key] = validateSetting(key, parsed);
    } catch {
      // Keep the default for values that cannot be parsed or are out of range.
    }
  }
  return result as unknown as AppSettings;
}

/**
 * Validates and stores the given keys (unknown keys are ignored), then returns
 * the complete merged settings object.
 */
export function saveSettings(db: DiaryDb, patch: Partial<AppSettings>): AppSettings {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    throw ApiError.validation('server.settings.bodyObject');
  }
  const validated: Partial<AppSettings> = {};
  for (const key of SETTING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    (validated as Record<string, unknown>)[key] = validateSetting(key, value);
  }
  db.transaction(() => {
    for (const [key, value] of Object.entries(validated)) {
      db.run('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
        key,
        JSON.stringify(value),
      ]);
    }
  });
  return getSettings(db);
}

/** Free-text metadata kept inside the encrypted DB (e.g. the owner's name for exports). */
export function getMeta(db: DiaryDb, key: string): string | null {
  const row = db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return row ? String(row.value) : null;
}

export function setMeta(db: DiaryDb, key: string, value: string): void {
  if (typeof key !== 'string' || !key.trim()) throw ApiError.validation('server.settings.metaKeyMissing', 'key');
  db.run('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
    key,
    String(value),
  ]);
}
