import { describe, expect, it } from 'vitest';
import type { Entry } from '@shared/types';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { setCurrentLocale } from '@/i18n/runtime';
import { ENTRY_MESSAGES } from './texts';
import { countErrors, emptyEntryValues, ENTRY_FIELD_LABELS, toEntryInput, validateEntryValues, valuesFromEntry } from './useEntryForm';

// The messages below assert the Hebrew wording (identical to the server's).
pinLocaleForTests('he');

describe('validateEntryValues (mirrors the server rules)', () => {
  it('accepts an empty new entry (only date and time are required)', () => {
    const errors = validateEntryValues(emptyEntryValues({ date: '2026-09-07', time: '08:30' }));
    expect(errors).toEqual({});
    expect(countErrors(errors)).toBe(0);
  });

  it('reports a missing or malformed date and time', () => {
    expect(validateEntryValues(emptyEntryValues({ date: '', time: '' }))).toEqual({
      date: ENTRY_MESSAGES.dateRequired,
      time: ENTRY_MESSAGES.timeRequired,
    });
    expect(validateEntryValues(emptyEntryValues({ date: '2026-13-01', time: '25:00' }))).toEqual({
      date: ENTRY_MESSAGES.dateInvalid,
      time: ENTRY_MESSAGES.timeInvalid,
    });
  });

  it('checks rating ranges (1..10 integers), sleep hours (0..24) and exercise minutes (0..1440)', () => {
    const errors = validateEntryValues(
      emptyEntryValues({ mood: 0, energy: 11, stress: 5.5, sleepQuality: 10, sleepHours: 30, exerciseMinutes: -5 }),
    );
    expect(errors.mood).toBe('מצב הרוח חייב להיות מספר שלם בין 1 ל-10');
    expect(errors.energy).toBe('רמת האנרגיה חייב להיות מספר שלם בין 1 ל-10');
    expect(errors.stress).toBe('רמת הלחץ חייב להיות מספר שלם בין 1 ל-10');
    expect(errors.sleepQuality).toBeUndefined();
    expect(errors.sleepHours).toBe(ENTRY_MESSAGES.sleepHours);
    expect(errors.exerciseMinutes).toBe(ENTRY_MESSAGES.exerciseMinutes);
    expect(countErrors(errors)).toBe(5);
  });

  it('checks text lengths, list item lengths and unknown emotions', () => {
    const errors = validateEntryValues(
      emptyEntryValues({
        title: 'א'.repeat(201),
        location: 'ב'.repeat(201),
        exerciseType: 'ג'.repeat(101),
        tags: ['ד'.repeat(101)],
        emotions: ['happy', 'not-an-emotion'],
      }),
    );
    expect(errors.title).toBe('השדה "כותרת" ארוך מדי (עד 200 תווים)');
    expect(errors.location).toBe('השדה "מיקום" ארוך מדי (עד 200 תווים)');
    expect(errors.exerciseType).toBe('השדה "סוג הפעילות" ארוך מדי (עד 100 תווים)');
    expect(errors.tags).toBe('פריט ב"תגיות" ארוך מדי (עד 100 תווים)');
    expect(errors.emotions).toBe('רגש לא מוכר: "not-an-emotion"');
  });

  it('renders the messages and the field labels in the current UI language', () => {
    setCurrentLocale('en');
    const errors = validateEntryValues(emptyEntryValues({ date: '', time: '', mood: 0, title: 'a'.repeat(201), body: 'b'.repeat(1_000_001) }));
    expect(errors.date).toBe('Please enter a date');
    expect(errors.time).toBe('Please enter a time');
    expect(errors.mood).toBe('Mood must be a whole number between 1 and 10');
    expect(errors.title).toBe('The field "Title" is too long (up to 200 characters)');
    expect(errors.body).toBe('The field "Text" is too long (up to 1,000,000 characters)');
    expect(ENTRY_FIELD_LABELS.sleepHours).toBe('Sleep hours');
    setCurrentLocale('he');
    expect(ENTRY_FIELD_LABELS.sleepHours).toBe('שעות שינה');
    expect(validateEntryValues(emptyEntryValues({ body: 'b'.repeat(1_000_001) })).body).toBe('השדה "תוכן" ארוך מדי (עד 1,000,000 תווים)');
  });
});

describe('toEntryInput', () => {
  it('trims strings, strips # from tags, de-duplicates and drops empty items', () => {
    const input = toEntryInput(
      emptyEntryValues({
        date: '2026-09-07',
        time: '08:30',
        title: '  בוקר טוב  ',
        location: ' תל אביב ',
        tags: ['#עבודה', ' עבודה ', '', '##משפחה'],
        people: ['דנה', 'דנה', ' '],
        exerciseMinutes: 29.6,
      }),
    );
    expect(input.title).toBe('בוקר טוב');
    expect(input.location).toBe('תל אביב');
    expect(input.tags).toEqual(['עבודה', 'משפחה']);
    expect(input.people).toEqual(['דנה']);
    expect(input.exerciseMinutes).toBe(30);
    expect(input.mood).toBeNull();
  });

  it('round-trips an entry through valuesFromEntry', () => {
    const entry: Entry = {
      id: 1,
      date: '2026-09-07',
      time: '08:30',
      title: 'בוקר',
      body: 'טקסט',
      mood: 7,
      emotions: ['happy'],
      energy: 6,
      stress: 3,
      sleepQuality: 8,
      sleepHours: 7.5,
      exerciseMinutes: 30,
      exerciseType: 'הליכה',
      events: ['פגישה'],
      people: ['דנה'],
      location: 'בית',
      notes: 'הערה',
      tags: ['עבודה'],
      createdAt: '2026-09-07T06:30:00.000Z',
      updatedAt: '2026-09-07T06:30:00.000Z',
    };
    const { id: _id, createdAt: _c, updatedAt: _u, ...expected } = entry;
    expect(toEntryInput(valuesFromEntry(entry))).toEqual(expected);
  });
});
