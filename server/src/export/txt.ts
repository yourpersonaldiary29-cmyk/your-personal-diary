/**
 * Plain-text export (UTF-8, no BOM, CRLF line endings for Windows editors).
 *
 * Layout:
 *   header block (app name, owner, range, export date, entry count)
 *   one block per entry separated by a line of '─' characters
 *   optional habits section at the end (`includeHabits`)
 *
 * Every label, date and number is rendered in `data.locale` through the
 * 'server.export.*' catalogue (see ./format.ts). Missing values are printed as
 * '—' so a reader can tell "not reported" from 0.
 */
import { t } from '@shared/i18n';
import type { Locale } from '@shared/i18n';
import type { Entry } from '@shared/types';
import type { ExportData } from './data';
import {
  MISSING,
  appName,
  dateWithWeekday,
  emotionsText,
  exerciseText,
  field,
  habitHeading,
  habitLogLine,
  label,
  listText,
  normalizeNewlines,
  ownerLabel,
  rangeLabel,
  ratingsLine,
  tagsText,
  textOr,
  timeText,
  timestampText,
} from './format';

const EOL = '\r\n';
/** Separator between entries. */
export const TXT_SEPARATOR = '─'.repeat(60);
/** Separator before the habits section. */
export const TXT_SECTION_SEPARATOR = '═'.repeat(60);

function entryBlock(locale: Locale, entry: Entry): string[] {
  const lines: string[] = [];
  lines.push(
    t(locale, 'server.export.dateTimeLine', {
      date: field(locale, 'date', dateWithWeekday(locale, entry.date)),
      time: field(locale, 'time', timeText(locale, entry.time)),
    }),
  );
  lines.push(field(locale, 'title', textOr(entry.title)));
  lines.push(ratingsLine(locale, entry));
  lines.push(field(locale, 'emotions', emotionsText(locale, entry.emotions)));
  lines.push(field(locale, 'exercise', exerciseText(locale, entry)));
  lines.push(field(locale, 'events', listText(locale, entry.events)));
  lines.push(field(locale, 'people', listText(locale, entry.people)));
  lines.push(field(locale, 'location', textOr(entry.location)));
  lines.push('');
  const body = normalizeNewlines(entry.body).trim();
  lines.push(...(body ? body.split('\n') : [MISSING]));
  lines.push('');
  lines.push(field(locale, 'notes', textOr(normalizeNewlines(entry.notes))));
  lines.push(field(locale, 'tags', tagsText(entry.tags)));
  return lines;
}

/** Builds the TXT document as a string (every line ends with CRLF). */
export function buildTxt(data: ExportData): string {
  const locale = data.locale;
  const lines: string[] = [];
  lines.push(appName(locale));
  lines.push(field(locale, 'name', ownerLabel(locale, data.user)));
  lines.push(field(locale, 'range', rangeLabel(locale, data.from, data.to)));
  lines.push(field(locale, 'exportedAt', timestampText(locale, data.exportedAt)));
  lines.push(field(locale, 'entryCount', data.entries.length));
  lines.push('');

  lines.push(TXT_SEPARATOR);
  if (data.entries.length === 0) {
    lines.push(t(locale, 'server.export.noEntries'));
    lines.push(TXT_SEPARATOR);
  } else {
    for (const entry of data.entries) {
      lines.push(...entryBlock(locale, entry));
      lines.push(TXT_SEPARATOR);
    }
  }

  if (data.includeHabits) {
    lines.push('');
    lines.push(TXT_SECTION_SEPARATOR);
    lines.push(label(locale, 'habits'));
    lines.push(TXT_SECTION_SEPARATOR);
    if (data.habits.length === 0) lines.push(t(locale, 'server.export.noHabits'));
    for (const habit of data.habits) {
      lines.push('');
      lines.push(habitHeading(locale, habit));
      if (habit.description.trim()) lines.push(`  ${habit.description.trim()}`);
      const logs = data.habitLogs.filter((l) => l.habitId === habit.id);
      if (logs.length === 0) {
        lines.push(`  ${t(locale, 'server.export.noLogs')}`);
      } else {
        for (const log of logs) lines.push(`  ${habitLogLine(locale, log, habit)}`);
      }
    }
  }

  return lines.join(EOL) + EOL;
}

export function exportTxt(data: ExportData): Buffer {
  return Buffer.from(buildTxt(data), 'utf8');
}
