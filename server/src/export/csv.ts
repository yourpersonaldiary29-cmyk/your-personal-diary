/**
 * CSV export - one row per entry.
 *
 * - UTF-8 with a byte-order mark so Excel on Windows detects the encoding and
 *   shows non-Latin scripts (Hebrew, Arabic, CJK...) correctly.
 * - CRLF line endings and RFC 4180 quoting (fields containing a comma, quote, CR or
 *   LF are wrapped in double quotes; quotes are doubled). Cells a spreadsheet would run as a
 *   formula (= + - @ first) get a leading apostrophe (neutralizeFormula).
 * - Header row with 17 columns in the export language; list fields are joined with '; '.
 * - Missing numeric values are empty cells (never 0).
 *
 * Habits are intentionally NOT part of the CSV: a second table with different
 * columns would break the "one clean spreadsheet" contract. `includeHabits` is
 * ignored for this format (TXT / JSON / PDF include them).
 */
import { t, type Locale } from '@shared/i18n';
import type { Entry } from '@shared/types';
import type { ExportData } from './data';
import { emotionLabelIn, fmtNumber, normalizeNewlines } from './format';

/** UTF-8 byte-order mark (EF BB BF) - makes Excel open the file as UTF-8. */
export const CSV_BOM = '\uFEFF';
const EOL = '\r\n';
/** Separator for multi-value cells (emotions, events, people, tags). */
export const CSV_LIST_SEPARATOR = '; ';

/** Column keys, in order (labels come from 'server.export.csv.<key>'). */
export const CSV_COLUMNS = [
  'date',
  'time',
  'title',
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
  'body',
] as const;

/** The header row in `locale`. */
export function csvHeader(locale: Locale): string[] {
  return CSV_COLUMNS.map((c) => t(locale, `server.export.csv.${c}`));
}

/** Hebrew header (kept for existing callers/tests). */
export const CSV_HEADER: readonly string[] = csvHeader('he');

/**
 * Spreadsheet programs run a cell that starts with = + - @ (or a tab / carriage return) as a
 * formula - quoting does not stop them - so diary text such as "- went running" or a crafted
 * "=HYPERLINK(...)" from a restored backup would be evaluated. Such cells get a leading apostrophe
 * (OWASP "CSV injection"): Excel shows the text as typed and never evaluates it.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** RFC 4180 field quoting, after neutralising formula-like text. */
export function csvEscape(raw: string): string {
  if (raw === '') return '';
  const value = neutralizeFormula(raw);
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function num(value: number | null): string {
  return value === null || value === undefined ? '' : fmtNumber(value);
}

function list(items: string[]): string {
  return items.map((s) => s.trim()).filter(Boolean).join(CSV_LIST_SEPARATOR);
}

export function entryToCsvRow(entry: Entry, locale: Locale = 'he'): string[] {
  return [
    entry.date,
    entry.time,
    entry.title,
    num(entry.mood),
    list(entry.emotions.map((key) => emotionLabelIn(locale, key))),
    num(entry.energy),
    num(entry.stress),
    num(entry.sleepQuality),
    num(entry.sleepHours),
    num(entry.exerciseMinutes),
    entry.exerciseType,
    list(entry.events),
    list(entry.people),
    entry.location,
    normalizeNewlines(entry.notes),
    list(entry.tags.map((t) => t.replace(/^#+/, ''))),
    normalizeNewlines(entry.body),
  ];
}

/** Builds the CSV text (including the BOM). */
export function buildCsv(data: ExportData): string {
  const rows: string[] = [csvHeader(data.locale).map(csvEscape).join(',')];
  for (const entry of data.entries) {
    rows.push(entryToCsvRow(entry, data.locale).map(csvEscape).join(','));
  }
  return CSV_BOM + rows.join(EOL) + EOL;
}

export function exportCsv(data: ExportData): Buffer {
  return Buffer.from(buildCsv(data), 'utf8');
}
