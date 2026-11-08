/**
 * State, normalisation and validation for the diary entry form.
 *
 * - `EntryFormValues` mirrors `EntryInput` field by field (null = "not reported").
 * - `toEntryInput` trims strings, de-duplicates lists and strips a leading '#'
 *   from tags exactly like the server does, so what is sent is what is stored.
 * - `validateEntryValues` mirrors `validateEntryInput` on the server (formats,
 *   ranges, lengths) with the same messages in the current UI language, keyed
 *   by field name.
 * - `useEntryForm` keeps the values, the errors, a "dirty" flag against a
 *   baseline (for the unsaved-changes guard) and focus helpers, including the
 *   mapping of a server `VALIDATION` error to its field.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { EMOTION_KEYS } from '@shared/constants';
import type { Entry, EntryInput } from '@shared/types';
import { isValidIsoDate, isValidTime, nowHHMM, todayIso } from '@/utils/dates';
import { errorCode, errorField } from '@/utils/errors';
import { ENTRY_MESSAGES, ET, entryValidationLabel } from './texts';

export interface EntryFormValues {
  date: string;
  time: string;
  title: string;
  body: string;
  mood: number | null;
  emotions: string[];
  energy: number | null;
  stress: number | null;
  sleepQuality: number | null;
  sleepHours: number | null;
  exerciseMinutes: number | null;
  exerciseType: string;
  events: string[];
  people: string[];
  location: string;
  notes: string;
  tags: string[];
}

export type EntryFieldName = keyof EntryFormValues;
export type EntryFormErrors = Partial<Record<EntryFieldName, string>>;

/** Form order = focus order for "first invalid field" and the server's field names. */
export const ENTRY_FIELD_ORDER: EntryFieldName[] = [
  'date',
  'time',
  'title',
  'body',
  'mood',
  'emotions',
  'energy',
  'stress',
  'sleepQuality',
  'sleepHours',
  'exerciseMinutes',
  'exerciseType',
  'events',
  'people',
  'location',
  'notes',
  'tags',
];

/** Same limits as server/src/db/entries-repo.ts ENTRY_LIMITS. */
export const ENTRY_LIMITS = {
  titleMax: 200,
  bodyMax: 1_000_000,
  notesMax: 100_000,
  locationMax: 200,
  exerciseTypeMax: 100,
  itemMax: 100,
  itemsMax: 100,
  sleepHoursMax: 24,
  exerciseMinutesMax: 1440,
} as const;

/** DOM id of a field's control (fieldsets for emotions / exercise minutes). */
export function entryFieldId(name: EntryFieldName): string {
  return `entry-${name}`;
}

/** Empty form for a new entry (today, now) with optional overrides such as ?date=. */
export function emptyEntryValues(defaults: Partial<EntryFormValues> = {}): EntryFormValues {
  return {
    date: todayIso(),
    time: nowHHMM(),
    title: '',
    body: '',
    mood: null,
    emotions: [],
    energy: null,
    stress: null,
    sleepQuality: null,
    sleepHours: null,
    exerciseMinutes: null,
    exerciseType: '',
    events: [],
    people: [],
    location: '',
    notes: '',
    tags: [],
    ...defaults,
  };
}

/** Form values for editing an existing entry. */
export function valuesFromEntry(entry: Entry): EntryFormValues {
  return {
    date: entry.date,
    time: entry.time,
    title: entry.title,
    body: entry.body,
    mood: entry.mood,
    emotions: [...entry.emotions],
    energy: entry.energy,
    stress: entry.stress,
    sleepQuality: entry.sleepQuality,
    sleepHours: entry.sleepHours,
    exerciseMinutes: entry.exerciseMinutes,
    exerciseType: entry.exerciseType,
    events: [...entry.events],
    people: [...entry.people],
    location: entry.location,
    notes: entry.notes,
    tags: [...entry.tags],
  };
}

/** "#עבודה " -> "עבודה" (same rule as the server). */
export function normaliseTag(tag: string): string {
  return tag.trim().replace(/^#+/, '').trim();
}

/** Trims, drops empty items and duplicates (keeps first occurrence order). */
export function normaliseList(items: string[], transform: (s: string) => string = (s) => s): string[] {
  const out: string[] = [];
  for (const raw of items) {
    const cleaned = transform(String(raw).trim()).trim();
    if (!cleaned || out.includes(cleaned)) continue;
    out.push(cleaned);
  }
  return out;
}

/** Normalised payload for POST/PUT /api/entries. */
export function toEntryInput(values: EntryFormValues): EntryInput {
  return {
    date: values.date,
    time: values.time,
    title: values.title.trim(),
    body: values.body,
    mood: values.mood,
    emotions: normaliseList(values.emotions),
    energy: values.energy,
    stress: values.stress,
    sleepQuality: values.sleepQuality,
    sleepHours: values.sleepHours,
    exerciseMinutes: values.exerciseMinutes === null ? null : Math.round(values.exerciseMinutes),
    exerciseType: values.exerciseType.trim(),
    events: normaliseList(values.events),
    people: normaliseList(values.people),
    location: values.location.trim(),
    notes: values.notes,
    tags: normaliseList(values.tags, normaliseTag),
  };
}

function isRatingValid(v: number | null): boolean {
  return v === null || (Number.isInteger(v) && v >= 1 && v <= 10);
}

function listProblem(items: string[], field: 'emotions' | 'events' | 'people' | 'tags'): string | null {
  const label = entryValidationLabel(field);
  for (const item of items) {
    if (item.length > ENTRY_LIMITS.itemMax) return ENTRY_MESSAGES.itemTooLong(label, ENTRY_LIMITS.itemMax);
  }
  if (items.length > ENTRY_LIMITS.itemsMax) return ENTRY_MESSAGES.tooManyItems(label, ENTRY_LIMITS.itemsMax);
  return null;
}

/** Client-side validation mirroring the server. Returns messages in the current UI language keyed by field. */
export function validateEntryValues(values: EntryFormValues): EntryFormErrors {
  const input = toEntryInput(values);
  const errors: EntryFormErrors = {};

  if (!input.date) errors.date = ENTRY_MESSAGES.dateRequired;
  else if (!isValidIsoDate(input.date)) errors.date = ENTRY_MESSAGES.dateInvalid;

  if (!input.time) errors.time = ENTRY_MESSAGES.timeRequired;
  else if (!isValidTime(input.time)) errors.time = ENTRY_MESSAGES.timeInvalid;

  if (input.title.length > ENTRY_LIMITS.titleMax) errors.title = ENTRY_MESSAGES.tooLong(entryValidationLabel('title'), ENTRY_LIMITS.titleMax);
  if (input.body.length > ENTRY_LIMITS.bodyMax) errors.body = ENTRY_MESSAGES.tooLong(entryValidationLabel('body'), ENTRY_LIMITS.bodyMax);

  for (const name of ['mood', 'energy', 'stress', 'sleepQuality'] as const) {
    if (!isRatingValid(input[name])) errors[name] = ENTRY_MESSAGES.rating(entryValidationLabel(name));
  }

  const unknownEmotion = input.emotions.find((key) => !EMOTION_KEYS.has(key));
  if (unknownEmotion !== undefined) errors.emotions = ENTRY_MESSAGES.unknownEmotion(unknownEmotion);
  else {
    const problem = listProblem(input.emotions, 'emotions');
    if (problem) errors.emotions = problem;
  }

  if (input.sleepHours !== null && (!Number.isFinite(input.sleepHours) || input.sleepHours < 0 || input.sleepHours > ENTRY_LIMITS.sleepHoursMax)) {
    errors.sleepHours = ENTRY_MESSAGES.sleepHours;
  }

  if (
    input.exerciseMinutes !== null &&
    (!Number.isInteger(input.exerciseMinutes) || input.exerciseMinutes < 0 || input.exerciseMinutes > ENTRY_LIMITS.exerciseMinutesMax)
  ) {
    errors.exerciseMinutes = ENTRY_MESSAGES.exerciseMinutes;
  }

  if (input.exerciseType.length > ENTRY_LIMITS.exerciseTypeMax) {
    errors.exerciseType = ENTRY_MESSAGES.tooLong(entryValidationLabel('exerciseType'), ENTRY_LIMITS.exerciseTypeMax);
  }
  if (input.location.length > ENTRY_LIMITS.locationMax) {
    errors.location = ENTRY_MESSAGES.tooLong(entryValidationLabel('location'), ENTRY_LIMITS.locationMax);
  }
  if (input.notes.length > ENTRY_LIMITS.notesMax) {
    errors.notes = ENTRY_MESSAGES.tooLong(entryValidationLabel('notes'), ENTRY_LIMITS.notesMax);
  }

  for (const name of ['events', 'people', 'tags'] as const) {
    const problem = listProblem(input[name], name);
    if (problem) errors[name] = problem;
  }

  return errors;
}

/** Number of fields with an error, in form order. */
export function countErrors(errors: EntryFormErrors): number {
  return ENTRY_FIELD_ORDER.filter((name) => errors[name]).length;
}

function isEntryField(name: string | null): name is EntryFieldName {
  return name !== null && (ENTRY_FIELD_ORDER as string[]).includes(name);
}

/**
 * Moves focus to a field's control. Fieldsets (emotions, exercise duration)
 * are not focusable, so their first input is focused instead.
 */
export function focusEntryField(name: EntryFieldName): void {
  const el = document.getElementById(entryFieldId(name));
  if (!el) return;
  if (el.tagName === 'FIELDSET') {
    el.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])')?.focus();
    return;
  }
  el.focus();
}

export interface UseEntryFormResult {
  values: EntryFormValues;
  errors: EntryFormErrors;
  /** True when the values differ from the last baseline (initial / reset / markClean). */
  dirty: boolean;
  setValue: <K extends EntryFieldName>(name: K, value: EntryFormValues[K]) => void;
  setErrors: (errors: EntryFormErrors) => void;
  /** Validates, stores the errors and returns them. */
  validate: () => EntryFormErrors;
  /** Replaces the values and the clean baseline (loading an entry). */
  reset: (next?: EntryFormValues) => void;
  /** Marks the current values as saved without changing them. */
  markClean: () => void;
  /** Normalised payload for the API. */
  toInput: () => EntryInput;
  focusField: (name: EntryFieldName) => void;
  /** Focuses the first field (in form order) that has an error. */
  focusFirstInvalid: (errors?: EntryFormErrors) => void;
  /**
   * Attaches a server VALIDATION error to its field (setting the error and
   * moving focus). Returns the field name, or null when the error is not
   * field-specific (the page then shows it in an Alert).
   */
  applyServerError: (error: unknown) => EntryFieldName | null;
}

export function useEntryForm(initial: EntryFormValues): UseEntryFormResult {
  const [values, setValues] = useState<EntryFormValues>(initial);
  const [errors, setErrorsState] = useState<EntryFormErrors>({});
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(initial));
  const errorsRef = useRef(errors);
  errorsRef.current = errors;
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const dirty = useMemo(() => JSON.stringify(values) !== baseline, [values, baseline]);

  const setValue = useCallback(<K extends EntryFieldName>(name: K, value: EntryFormValues[K]) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    // Editing a field clears its error (the user is fixing it).
    if (errorsRef.current[name]) setErrorsState((prev) => ({ ...prev, [name]: undefined }));
  }, []);

  const setErrors = useCallback((next: EntryFormErrors) => setErrorsState(next), []);

  const validate = useCallback(() => {
    const next = validateEntryValues(valuesRef.current);
    setErrorsState(next);
    return next;
  }, []);

  const reset = useCallback((next?: EntryFormValues) => {
    const target = next ?? valuesRef.current;
    setValues(target);
    setBaseline(JSON.stringify(target));
    setErrorsState({});
  }, []);

  const markClean = useCallback(() => {
    setBaseline(JSON.stringify(valuesRef.current));
  }, []);

  const toInput = useCallback(() => toEntryInput(valuesRef.current), []);

  const focusFirstInvalid = useCallback((errs?: EntryFormErrors) => {
    const source = errs ?? errorsRef.current;
    const first = ENTRY_FIELD_ORDER.find((name) => source[name]);
    if (first) focusEntryField(first);
  }, []);

  const applyServerError = useCallback((error: unknown): EntryFieldName | null => {
    if (errorCode(error) !== 'VALIDATION') return null;
    const field = errorField(error);
    if (!isEntryField(field)) return null;
    const message = error instanceof Error && error.message ? error.message : ENTRY_MESSAGES.dateInvalid;
    setErrorsState({ [field]: message });
    focusEntryField(field);
    return field;
  }, []);

  return {
    values,
    errors,
    dirty,
    setValue,
    setErrors,
    validate,
    reset,
    markClean,
    toInput,
    focusField: focusEntryField,
    focusFirstInvalid,
    applyServerError,
  };
}

/** Label of a field in the current UI language (read view, badges). */
export function entryFieldLabel(name: EntryFieldName): string {
  switch (name) {
    case 'date':
      return ET.date;
    case 'time':
      return ET.time;
    case 'title':
      return ET.title;
    case 'body':
      return ET.body;
    case 'mood':
      return ET.mood;
    case 'emotions':
      return ET.emotions;
    case 'energy':
      return ET.energy;
    case 'stress':
      return ET.stress;
    case 'sleepQuality':
      return ET.sleepQuality;
    case 'sleepHours':
      return ET.sleepHours;
    case 'exerciseMinutes':
      return ET.exercise;
    case 'exerciseType':
      return ET.exerciseType;
    case 'events':
      return ET.events;
    case 'people':
      return ET.people;
    case 'location':
      return ET.location;
    case 'notes':
      return ET.notes;
    case 'tags':
      return ET.tags;
  }
}

/** Labels for the read view and the badges, keyed by field (live: each read follows the current language). */
export const ENTRY_FIELD_LABELS: Readonly<Record<EntryFieldName, string>> = Object.defineProperties(
  {} as Record<EntryFieldName, string>,
  Object.fromEntries(ENTRY_FIELD_ORDER.map((name) => [name, { enumerable: true, get: () => entryFieldLabel(name) }])),
);
