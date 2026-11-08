/**
 * JSON export - a machine-readable dump of the entries (and optionally the habits
 * with their logs) using exactly the shared `Entry` / `Habit` / `HabitLog` shapes.
 * Pretty-printed with two spaces, UTF-8 without BOM.
 */
import { APP_NAME, APP_VERSION } from '@shared/constants';
import type { Entry, Habit, HabitLog } from '@shared/types';
import type { ExportData } from './data';

export interface JsonExportDocument {
  app: string;
  version: string;
  /** ISO timestamp. */
  exportedAt: string;
  user: { username: string; firstName: string; lastName: string };
  /** Requested inclusive bounds; null = unbounded. */
  range: { from: string | null; to: string | null };
  entries: Entry[];
  /** Present only when the export was requested with `includeHabits`. */
  habits?: Habit[];
  habitLogs?: HabitLog[];
}

export function buildJsonDocument(data: ExportData): JsonExportDocument {
  const doc: JsonExportDocument = {
    app: APP_NAME,
    version: APP_VERSION,
    exportedAt: data.exportedAt,
    user: {
      username: data.user.username,
      firstName: data.user.firstName,
      lastName: data.user.lastName,
    },
    range: { from: data.from, to: data.to },
    entries: data.entries,
  };
  if (data.includeHabits) {
    doc.habits = data.habits;
    doc.habitLogs = data.habitLogs;
  }
  return doc;
}

export function exportJson(data: ExportData): Buffer {
  return Buffer.from(JSON.stringify(buildJsonDocument(data), null, 2) + '\n', 'utf8');
}
