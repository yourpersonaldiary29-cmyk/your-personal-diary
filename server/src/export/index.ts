/**
 * Export entry point: validates the request, loads the data and dispatches to the
 * TXT / CSV / JSON / PDF writers.
 *
 *   const out = await exportData(db, { format: 'pdf', from, to, includeHabits }, { user, assetsDir });
 *   out.bytes   -> file content
 *   out.fileName-> your-personal-diary-<username>-<from>_<to>.<ext>
 *   out.mime    -> Content-Type for downloads
 */
import path from 'node:path';
import { DEFAULT_LOCALE, type Locale } from '@shared/i18n';
import type { ExportFormat, ExportRequest, UserProfile } from '@shared/types';
import type { DiaryDb } from '../db/database';
import { ApiError } from '../errors';
import { isIsoDate, todayIso } from '../util/dates';
import { exportCsv } from './csv';
import { collectExportData, type ExportData } from './data';
import { exportJson } from './json';
import { exportPdf } from './pdf';
import { exportTxt } from './txt';

export type { ExportData } from './data';
export { collectExportData, loadEntriesForExport, loadHabitLogsForExport } from './data';
export { buildCsv, exportCsv, csvEscape, CSV_HEADER, CSV_BOM } from './csv';
export { buildJsonDocument, exportJson, type JsonExportDocument } from './json';
export { exportPdf, resolvePdfFonts } from './pdf';
export { buildTxt, exportTxt, TXT_SEPARATOR } from './txt';
export { wrapLine, toVisual, layoutParagraphs } from './rtl';

export const EXPORT_FORMATS: readonly ExportFormat[] = ['txt', 'csv', 'json', 'pdf'];

export const EXPORT_MIME: Record<ExportFormat, string> = {
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
  pdf: 'application/pdf',
};

export interface ExportContext {
  user: UserProfile;
  /** Directory holding `fonts/` (from `ServerConfig.assetsDir`). */
  assetsDir: string;
  /** Language of the labels / headings in the exported file (req.locale). Default 'en'. */
  locale?: Locale;
}

export interface ExportOutput {
  bytes: Buffer;
  fileName: string;
  mime: string;
  entriesExported: number;
}

export function isExportFormat(value: unknown): value is ExportFormat {
  return typeof value === 'string' && (EXPORT_FORMATS as readonly string[]).includes(value);
}

/**
 * Validates and normalises a raw request body into an `ExportRequest`.
 * Throws `ApiError.validation` (400) with the offending field name.
 */
export function validateExportRequest(body: unknown): ExportRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw ApiError.validation('server.export.error.bodyMissing');
  }
  const b = body as Record<string, unknown>;

  if (!isExportFormat(b.format)) {
    throw ApiError.validation('server.export.error.formatUnsupported', 'format');
  }
  const req: ExportRequest = { format: b.format };

  const from = optionalString(b.from);
  if (from !== undefined) {
    if (!isIsoDate(from)) throw ApiError.validation('server.export.error.fromInvalid', 'from');
    req.from = from;
  }
  const to = optionalString(b.to);
  if (to !== undefined) {
    if (!isIsoDate(to)) throw ApiError.validation('server.export.error.toInvalid', 'to');
    req.to = to;
  }
  if (req.from && req.to && req.from > req.to) {
    throw ApiError.validation('server.export.error.fromAfterTo', 'from');
  }

  if (b.includeHabits !== undefined && b.includeHabits !== null) {
    if (typeof b.includeHabits !== 'boolean') {
      throw ApiError.validation('server.export.error.includeHabitsBoolean', 'includeHabits');
    }
    req.includeHabits = b.includeHabits;
  }

  const destPath = optionalString(b.destPath);
  if (destPath !== undefined) {
    if (!path.isAbsolute(destPath)) throw ApiError.validation('server.export.error.destPathAbsolute', 'destPath');
    req.destPath = destPath;
  }
  return req;
}

/** undefined for missing / null / empty-after-trim; throws for non-strings. */
function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw ApiError.validation('server.export.error.invalidValue');
  const v = value.trim();
  return v ? v : undefined;
}

/**
 * Keeps letters (any script), digits, dot, dash and underscore; everything else
 * becomes '_'. Hebrew user names therefore survive in the file name.
 */
export function safeFileNamePart(value: string): string {
  const cleaned = value.trim().replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^[._-]+|[._-]+$/g, '');
  return cleaned || 'user';
}

/** your-personal-diary-<username>-<from>_<to>.<ext> */
export function exportFileName(username: string, format: ExportFormat, from: string, to: string): string {
  return `your-personal-diary-${safeFileNamePart(username).slice(0, 40)}-${from}_${to}.${format}`;
}

/** Content-Disposition header value: ASCII fallback + RFC 5987 UTF-8 `filename*`. */
export function contentDispositionAttachment(fileName: string): string {
  // eslint-disable-next-line no-control-regex
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\;]/g, '_').trim() || 'export';
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Renders already-collected data in the requested format. */
export async function renderExport(data: ExportData, format: ExportFormat, assetsDir: string): Promise<Buffer> {
  switch (format) {
    case 'txt':
      return exportTxt(data);
    case 'csv':
      return exportCsv(data);
    case 'json':
      return exportJson(data);
    case 'pdf':
      return exportPdf(data, assetsDir);
    default: {
      const never: never = format;
      throw ApiError.validation('server.export.error.formatUnsupportedNamed', 'format', { format: String(never) });
    }
  }
}

/**
 * Loads the entries (and habits when requested) inside the inclusive range and
 * renders them. `req` is expected to be validated (`validateExportRequest`).
 */
export async function exportData(db: DiaryDb, req: ExportRequest, ctx: ExportContext): Promise<ExportOutput> {
  if (!isExportFormat(req.format)) {
    throw ApiError.validation('server.export.error.formatUnsupported', 'format');
  }
  const locale: Locale = ctx.locale ?? DEFAULT_LOCALE;
  const data = collectExportData(db, req, ctx.user, locale);
  const bytes = await renderExport(data, req.format, ctx.assetsDir);
  const today = todayIso();
  const firstDate = data.entries.length ? data.entries[0].date : today;
  const from = data.from ?? firstDate;
  const to = data.to ?? today;
  return {
    bytes,
    fileName: exportFileName(ctx.user.username, req.format, from, to),
    mime: EXPORT_MIME[req.format],
    entriesExported: data.entries.length,
  };
}
