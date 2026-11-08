import { beforeEach, describe, expect, it } from 'vitest';
import { DiaryDb } from '../src/db/database';
import { DEFAULT_SETTINGS, getMeta, getSettings, saveSettings, setMeta, validateSetting } from '../src/db/settings-repo';
import { ApiError } from '../src/errors';

const HEBREW = /[א-ת]/;

function catchApi(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('expected an ApiError to be thrown');
}

describe('settings repository', () => {
  let db: DiaryDb;
  beforeEach(async () => {
    db = await DiaryDb.create();
  });

  it('returns the documented defaults for an empty diary', () => {
    expect(getSettings(db)).toEqual({
      autoLockMinutes: 10,
      offlinePrivacyMode: true,
      theme: 'system',
      fontScale: 1,
      remindersEnabled: true,
      firstDayOfWeek: 0,
      reduceMotion: false,
      defaultPeriod: '30d',
      calendarExtras: { hebrewDates: true, hijriDates: true, jewishHolidays: true, muslimHolidays: true, christianHolidays: true, druzeHolidays: true },
      language: 'en',
    });
    expect(getSettings(db)).toEqual(DEFAULT_SETTINGS);
  });

  it('merges a partial patch over the defaults and persists it', () => {
    const saved = saveSettings(db, { theme: 'dark', autoLockMinutes: 0 });
    expect(saved).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark', autoLockMinutes: 0 });
    expect(getSettings(db)).toEqual(saved);
    const again = saveSettings(db, { fontScale: 1.25, firstDayOfWeek: 1, defaultPeriod: 'all', reduceMotion: true });
    expect(again).toEqual({
      autoLockMinutes: 0,
      offlinePrivacyMode: true,
      theme: 'dark',
      fontScale: 1.25,
      remindersEnabled: true,
      firstDayOfWeek: 1,
      reduceMotion: true,
      defaultPeriod: 'all',
      calendarExtras: { hebrewDates: true, hijriDates: true, jewishHolidays: true, muslimHolidays: true, christianHolidays: true, druzeHolidays: true },
      language: 'en',
    });
    expect(db.scalar<number>('SELECT COUNT(*) FROM settings')).toBe(6);
  });

  it('ignores unknown keys and undefined values', () => {
    const saved = saveSettings(db, { colour: 'red', theme: undefined } as unknown as Record<string, unknown>);
    expect(saved).toEqual(DEFAULT_SETTINGS);
    expect(db.scalar<number>('SELECT COUNT(*) FROM settings')).toBe(0);
  });

  it.each<[Record<string, unknown>, string]>([
    [{ autoLockMinutes: -1 }, 'autoLockMinutes'],
    [{ autoLockMinutes: 1441 }, 'autoLockMinutes'],
    [{ autoLockMinutes: 2.5 }, 'autoLockMinutes'],
    [{ autoLockMinutes: '10' }, 'autoLockMinutes'],
    [{ offlinePrivacyMode: 'yes' }, 'offlinePrivacyMode'],
    [{ theme: 'blue' }, 'theme'],
    [{ theme: 1 }, 'theme'],
    [{ fontScale: 0.5 }, 'fontScale'],
    [{ fontScale: 2.1 }, 'fontScale'],
    [{ fontScale: Number.NaN }, 'fontScale'],
    [{ remindersEnabled: 1 }, 'remindersEnabled'],
    [{ firstDayOfWeek: 2 }, 'firstDayOfWeek'],
    [{ firstDayOfWeek: '0' }, 'firstDayOfWeek'],
    [{ reduceMotion: null }, 'reduceMotion'],
    [{ defaultPeriod: '2d' }, 'defaultPeriod'],
  ])('rejects %j with field %s', (patch, field) => {
    const err = catchApi(() => saveSettings(db, patch as never));
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION');
    expect(err.field).toBe(field);
    expect(err.messageFor('he')).toMatch(HEBREW);
    // Nothing is written when validation fails.
    expect(getSettings(db)).toEqual(DEFAULT_SETTINGS);
  });

  it('accepts boundary values', () => {
    expect(validateSetting('autoLockMinutes', 1440)).toBe(1440);
    expect(validateSetting('fontScale', 0.75)).toBe(0.75);
    expect(validateSetting('fontScale', 2)).toBe(2);
    expect(validateSetting('theme', 'high-contrast')).toBe('high-contrast');
    expect(validateSetting('defaultPeriod', '7d')).toBe('7d');
  });

  it('rejects a non-object patch', () => {
    expect(catchApi(() => saveSettings(db, null as never)).code).toBe('VALIDATION');
    expect(catchApi(() => saveSettings(db, [] as never)).code).toBe('VALIDATION');
  });

  it('falls back to defaults for corrupt or out-of-range stored rows', () => {
    db.run("INSERT INTO settings(key, value) VALUES ('theme', 'not json')");
    db.run("INSERT INTO settings(key, value) VALUES ('fontScale', '99')");
    db.run("INSERT INTO settings(key, value) VALUES ('autoLockMinutes', '30')");
    db.run("INSERT INTO settings(key, value) VALUES ('somethingElse', '1')");
    expect(getSettings(db)).toEqual({ ...DEFAULT_SETTINGS, autoLockMinutes: 30 });
  });

  it('stores and reads meta values', () => {
    expect(getMeta(db, 'owner')).toBeNull();
    setMeta(db, 'owner', 'דנה כהן');
    expect(getMeta(db, 'owner')).toBe('דנה כהן');
    setMeta(db, 'owner', 'שם אחר');
    expect(getMeta(db, 'owner')).toBe('שם אחר');
    expect(db.scalar<number>('SELECT COUNT(*) FROM meta')).toBe(1);
    expect(catchApi(() => setMeta(db, '', 'x')).field).toBe('key');
  });
});
