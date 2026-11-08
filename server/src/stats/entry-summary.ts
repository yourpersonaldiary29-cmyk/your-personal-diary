/**
 * Shared helper for turning raw `entries` rows into `EntrySummary` objects.
 * Used by the home summary and the smart search (both read entries with their
 * own SQL so they do not depend on the entries repository).
 */
import type { EntrySummary } from '@shared/types';
import { jsonArray, numOrNull } from '../db/database';

/** Columns needed to build an `EntrySummary` (use in `SELECT ${SUMMARY_COLUMNS} FROM entries`). */
export const SUMMARY_COLUMNS = 'id, date, time, title, body, mood, energy, stress, sleep_hours, emotions_json, tags_json';

/** Length of the excerpt in code points - same as the entries repository. */
export const EXCERPT_LENGTH = 160;

export interface SummaryRow {
  id: number;
  date: string;
  time: string;
  title: string;
  body: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  sleep_hours: number | null;
  emotions_json: string;
  tags_json: string;
}

/** First 160 characters of the body with whitespace runs collapsed (code-point safe). */
export function makeExcerpt(body: string, length: number = EXCERPT_LENGTH): string {
  const normalised = String(body ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(normalised).slice(0, length).join('');
}

export function rowToSummary(r: SummaryRow): EntrySummary {
  return {
    id: Number(r.id),
    date: String(r.date),
    time: String(r.time),
    title: String(r.title ?? ''),
    excerpt: makeExcerpt(String(r.body ?? '')),
    mood: numOrNull(r.mood),
    energy: numOrNull(r.energy),
    stress: numOrNull(r.stress),
    sleepHours: numOrNull(r.sleep_hours),
    emotions: jsonArray(r.emotions_json),
    tags: jsonArray(r.tags_json),
  };
}
