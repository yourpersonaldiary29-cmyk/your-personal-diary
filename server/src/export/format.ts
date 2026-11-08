/**
 * Labels and value formatting shared by the TXT and PDF exports, rendered in the export locale
 * through the 'server.export.*' catalogue (dates and numbers via the shared Intl helpers).
 * `null` values are shown as an em dash (—) - never as 0.
 */
import { APP_NAME } from '@shared/constants';
import { formatDate, formatNumber, formatTime, formatTimestamp, hasMessage, t, type Locale } from '@shared/i18n';
import type { Entry, Habit, HabitLog, UserProfile } from '@shared/types';

/** Placeholder for values that were not reported. */
export const MISSING = '—';

export type LabelName =
  | 'date'
  | 'time'
  | 'title'
  | 'mood'
  | 'energy'
  | 'stress'
  | 'sleepQuality'
  | 'sleepHours'
  | 'emotions'
  | 'exercise'
  | 'events'
  | 'people'
  | 'location'
  | 'notes'
  | 'tags'
  | 'habits'
  | 'name'
  | 'range'
  | 'exportedAt'
  | 'entryCount';

/** The label text for a field ("Mood" / "מצב רוח"). */
export function label(locale: Locale, name: LabelName): string {
  return t(locale, `server.export.label.${name}`);
}

/** "Label: value" in the locale's own punctuation order. */
export function field(locale: Locale, name: LabelName, value: string | number): string {
  return t(locale, 'server.export.field', { label: label(locale, name), value });
}

/** Application name - the English brand in every language. */
export function appName(_locale: Locale): string {
  return APP_NAME;
}

/** Machine-readable number (CSV / JSON): ASCII digits, dot, no trailing zeros. */
export function fmtNumber(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  return String(Math.round(value * 100) / 100);
}

/** Human-readable number in the locale (up to two decimals), or the em dash. */
export function numText(locale: Locale, value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  return formatNumber(locale, value, 2);
}

/** "7/10" (digits per locale) or "—". */
export function ratingText(locale: Locale, value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  return t(locale, 'server.export.ratingOutOf10', { value: numText(locale, value) });
}

/** Joins non-empty items with the locale's list separator, or the em dash. */
export function listText(locale: Locale, items: string[]): string {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  return clean.length ? clean.join(t(locale, 'server.export.listSeparator')) : MISSING;
}

export function textOr(value: string): string {
  const v = (value ?? '').trim();
  return v ? v : MISSING;
}

/**
 * "#tag1 #tag2" or "—" (hash tags are the same in every language).
 *
 * `directionMarks` (PDF pages): each tag starts with a mark of its own direction - a LEFT-TO-RIGHT
 * MARK before a Latin/CJK/... tag, a RIGHT-TO-LEFT MARK before a Hebrew/Arabic tag. Without it the
 * bidi algorithm gives the first "#" the paragraph direction whenever the tag's direction differs
 * from the page's: "rest #work#" on a right-to-left page, "#עבודה# בית" on a left-to-right page.
 * The mark keeps every "#" with its word. The PDF writer drops the marks after resolving the levels.
 */
export function tagsText(tags: string[], directionMarks = false): string {
  const clean = tags.map((tag) => tag.trim().replace(/^#+/, '')).filter(Boolean);
  const mark = (tag: string) => (directionMarks ? (startsRightToLeft(tag) ? '‏' : '‎') : '');
  return clean.length ? clean.map((tag) => `${mark(tag)}#${tag}`).join(' ') : MISSING;
}

/** True when the first letter of `text` belongs to a right-to-left script (Hebrew, Arabic, Syriac...). */
function startsRightToLeft(text: string): boolean {
  const letter = /\p{L}/u.exec(text)?.[0] ?? '';
  return /[֐-ࣿיִ-﷿ﹰ-﻿]/u.test(letter);
}

/** Translated emotion label ('emotions.<key>.label'); unknown keys are shown as they are. */
export function emotionLabelIn(locale: Locale, key: string): string {
  const messageKey = `emotions.${key}.label`;
  return hasMessage(locale, messageKey) || hasMessage('en', messageKey) ? t(locale, messageKey) : key;
}

export function emotionsText(locale: Locale, keys: string[]): string {
  return listText(
    locale,
    keys.map((k) => emotionLabelIn(locale, k)),
  );
}

/** "30 minutes (walking)" / "0 minutes" / "— (walking)" / "—". */
export function exerciseText(locale: Locale, entry: Entry): string {
  const type = entry.exerciseType.trim();
  const minutes = entry.exerciseMinutes;
  const base =
    minutes === null || minutes === undefined || !Number.isFinite(minutes)
      ? MISSING
      : t(locale, 'server.export.minutes', { count: minutes });
  return type ? t(locale, 'server.export.withType', { value: base, type }) : base;
}

/** "Mood: 7/10 | Energy: 6/10 | Stress: 3/10 | Sleep quality: 7/10 | Sleep hours: 7.5" */
export function ratingsLine(locale: Locale, entry: Entry): string {
  return t(locale, 'server.export.ratingsLine', {
    mood: field(locale, 'mood', ratingText(locale, entry.mood)),
    energy: field(locale, 'energy', ratingText(locale, entry.energy)),
    stress: field(locale, 'stress', ratingText(locale, entry.stress)),
    sleepQuality: field(locale, 'sleepQuality', ratingText(locale, entry.sleepQuality)),
    sleepHours: field(locale, 'sleepHours', numText(locale, entry.sleepHours)),
  });
}

/** Short numeric date in the locale ("07/09/2026", "7.9.2026", "2026/9/7"). */
export function shortDate(locale: Locale, iso: string): string {
  return formatDate(locale, iso, 'short');
}

/** "07/09/2026 (Monday)" / "7.9.2026 (יום שני)" */
export function dateWithWeekday(locale: Locale, iso: string): string {
  return t(locale, 'server.export.dateWithWeekday', {
    date: shortDate(locale, iso),
    weekday: formatDate(locale, iso, 'weekday'),
  });
}

/** "21:30" in the locale's clock convention. */
export function timeText(locale: Locale, time: string): string {
  if (!/^\d{2}:\d{2}$/.test(time)) return time;
  try {
    return formatTime(locale, time);
  } catch {
    return time;
  }
}

/** Human description of the exported range. */
export function rangeLabel(locale: Locale, from: string | null, to: string | null): string {
  if (from && to) return t(locale, 'server.export.range.both', { from: shortDate(locale, from), to: shortDate(locale, to) });
  if (from) return t(locale, 'server.export.range.fromOnly', { from: shortDate(locale, from) });
  if (to) return t(locale, 'server.export.range.toOnly', { to: shortDate(locale, to) });
  return t(locale, 'server.export.range.all');
}

/** Local date and time of an ISO timestamp in the locale. */
export function timestampText(locale: Locale, iso: string): string {
  return formatTimestamp(locale, iso);
}

/** "Dana Cohen (dana)" or just the username when the name is empty. */
export function ownerLabel(locale: Locale, user: UserProfile): string {
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name ? t(locale, 'server.export.nameWithUsername', { name, username: user.username }) : user.username;
}

/** "30 minutes" with the habit's own unit text, or the bare number without a unit. */
export function habitValueText(locale: Locale, habit: Habit, value: number): string {
  const unit = habit.unit.trim();
  const num = numText(locale, value);
  return unit ? t(locale, 'server.export.valueWithUnit', { value: num, unit }) : num;
}

/** "Target: 30 minutes per day" / "יעד: 3 פעמים בשבוע" */
export function habitTargetLabel(locale: Locale, habit: Habit): string {
  const key = habit.frequency === 'weekly' ? 'server.export.habitTarget.weekly' : 'server.export.habitTarget.daily';
  return t(locale, key, { value: habitValueText(locale, habit, habit.target) });
}

/** Heading of a habit in the appendix: "Walking (Target: 30 minutes per day)" [+ " - Archived"]. */
export function habitHeading(locale: Locale, habit: Habit): string {
  const key = habit.isArchived ? 'server.export.habitHeading.archived' : 'server.export.habitHeading';
  return t(locale, key, { name: habit.name, target: habitTargetLabel(locale, habit) });
}

/** "07/09/2026: 30 minutes (Completed) - note" */
export function habitLogLine(locale: Locale, log: HabitLog, habit: Habit): string {
  let line = t(locale, 'server.export.habitLog', { date: shortDate(locale, log.date), value: habitValueText(locale, habit, log.value) });
  if (log.completed) line = t(locale, 'server.export.habitLog.completed', { line });
  const note = log.note.trim();
  if (note) line = t(locale, 'server.export.habitLog.note', { line, note });
  return line;
}

/** Normalises CRLF / CR to LF. */
export function normalizeNewlines(text: string): string {
  return (text ?? '').replace(/\r\n?/g, '\n');
}
