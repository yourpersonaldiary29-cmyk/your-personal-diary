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

/**
 * The list text of an entry (`EntrySummary.excerpt`): the body with whitespace runs collapsed and
 * trimmed; a body longer than 160 code points is cut at the end of a word where one is near,
 * loses the weak punctuation before the cut and ends with one `…` (code-point safe: never half of a
 * surrogate pair). The rule and its cases: `shared/excerpt-cases.ts`.
 *
 * THREE copies that must give the same answer for every input: `server/src/stats/entry-summary.ts`
 * (this one), `server/src/db/entries-repo.ts` and `src/offline/overlay/effects.ts`.
 * `server/test/excerpt.test.ts` runs the cases against all three and compares them.
 */
export function makeExcerpt(body: string, length: number = EXCERPT_LENGTH): string {
  // At least 1, so that the result is never longer than `length`.
  const limit = Math.max(1, length);
  const chars = Array.from(String(body ?? '').replace(/\s+/g, ' ').trim());
  if (chars.length <= limit) return chars.join('');
  // Room for the ellipsis, and never inside what the screen shows as one character.
  const at = excerptCharacterStart(chars, limit - 1);
  const cut = chars.slice(0, at);
  const tries = [cut];
  // Inside a word: back to the last space among the last EXCERPT_WORD_BACK code points kept, if any.
  if (chars[at - 1] !== ' ' && chars[at] !== ' ') {
    const space = cut.lastIndexOf(' ');
    if (space >= 0 && space >= cut.length - EXCERPT_WORD_BACK) tries.unshift(cut.slice(0, space));
  }
  for (const part of tries) {
    const end = excerptEnd(part);
    if (end > 0) return part.slice(0, end).join('') + '\u2026';
  }
  // Nothing but weak punctuation: the plain cut.
  return cut.join('').trimEnd() + '\u2026';
}

/** How far back (in code points) a cut inside a word looks for a space. */
const EXCERPT_WORD_BACK = 40;
/**
 * Removed from the end of a cut excerpt: whitespace; full stops, commas, semicolons, colons, dashes
 * and dots (also Arabic, Chinese / Japanese full-width, Hindi and Greek ones); a zero width joiner.
 */
const EXCERPT_WEAK = /[\s.,;:\-\u2010-\u2015\u05be\u2026\u060c\u061b\u3001\u3002\uff0c\uff1a\uff1b\u0964\u0965\u0387\u200d]/u;
/** Also removed: what only ever opens (brackets, low quotation marks, Spanish inverted marks). */
const EXCERPT_OPENING = /[([{\uff08\uff3b\uff5b\u3008\u300a\u300c\u300e\u3010\u3014\u3016\u201a\u201e\u00a1\u00bf]/u;
/** Quotation marks that open in one language and close in another: removed only after a space, an opening mark or nothing. */
const EXCERPT_QUOTE = /["'\u2018\u2019\u201c\u201d\u00ab\u00bb\u2039\u203a]/u;

/** A combining mark (also a variation selector), a zero width joiner, a skin tone, an emoji tag. */
const EXCERPT_EXTEND = /[\p{M}\u200d\u{1f3fb}-\u{1f3ff}\u{e0020}-\u{e007f}]/u;
/** A regional indicator: two of them make a flag. */
const EXCERPT_FLAG = /[\u{1f1e6}-\u{1f1ff}]/u;

/**
 * Whether `chars[i]` belongs to the same character on the screen as `chars[i - 1]`: a mark or a skin
 * tone after it, anything after a zero width joiner or a Hindi virama (a conjunct), the second half of
 * a flag. A space never does.
 */
function excerptJoins(chars: string[], i: number): boolean {
  const c = chars[i];
  const before = chars[i - 1];
  if (c === ' ') return false;
  if (EXCERPT_EXTEND.test(c) || before === '\u200d' || before === '\u094d') return true;
  if (!EXCERPT_FLAG.test(c)) return false;
  let flags = 0;
  for (let j = i - 1; j >= 0 && EXCERPT_FLAG.test(chars[j]); j--) flags++;
  return flags % 2 === 1;
}

/**
 * Where to cut, at or before `at` (in code points), so that no character on the screen loses a part
 * (a letter its marks, an emoji its skin tone or the rest of its sequence, a flag its second half);
 * `at` itself when the whole beginning is one such character.
 */
function excerptCharacterStart(chars: string[], at: number): number {
  let n = at;
  while (n > 0 && excerptJoins(chars, n)) n--;
  return n > 0 ? n : at;
}

/** How many code points of `part` stay before the ellipsis. */
function excerptEnd(part: string[]): number {
  let end = part.length;
  while (end > 0) {
    const last = part[end - 1];
    const before = end > 1 ? part[end - 2] : ' ';
    if (EXCERPT_WEAK.test(last) || EXCERPT_OPENING.test(last)) end--;
    else if (EXCERPT_QUOTE.test(last) && (before === ' ' || EXCERPT_OPENING.test(before))) end--;
    else break;
  }
  return end;
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
