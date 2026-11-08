/**
 * POST /api/export  (auth)
 *
 * Body: ExportRequest { format: 'txt'|'csv'|'json'|'pdf', from?, to?, includeHabits?, destPath? }
 *
 * - With `destPath` (desktop, loopback requests only): writes the file and answers
 *   with `ExportResult` JSON.
 * - Without it (phone / browser): streams the file as a download with the proper
 *   Content-Type and a Content-Disposition carrying both an ASCII fallback name and
 *   an RFC 5987 UTF-8 `filename*`.
 * - The guest of the tour mode (mobile only) can download, but not save to a path: nothing of a
 *   guest is written to the device (403 'server.auth.guestNotAllowed').
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { ExportResult } from '@shared/types';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';
import { ctxOf } from '../middleware/auth';
import { localeOf } from '../middleware/locale';
import { contentDispositionAttachment, exportData, validateExportRequest } from '../export/index';
import { guestNotAllowed, isGuestContext } from '../security/guest';

/** Writes the export atomically (tmp file + rename) and maps I/O failures to a localised IO error. */
function writeExportFile(destPath: string, bytes: Buffer): void {
  const tmp = `${destPath}.tmp`;
  try {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, destPath);
  } catch {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
    throw ApiError.io('server.export.saveFailed');
  }
}

export function exportRouter(deps: AppDeps): Router {
  const r = Router();

  r.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = ctxOf(req);
      const request = validateExportRequest(req.body);
      if (request.destPath && !req.isLocal) {
        throw ApiError.forbidden('server.export.saveLocalOnly');
      }
      if (request.destPath && isGuestContext(ctx)) throw guestNotAllowed();

      const out = await exportData(ctx.db, request, { user: ctx.user, assetsDir: deps.config.assetsDir, locale: localeOf(req) });

      if (request.destPath) {
        writeExportFile(request.destPath, out.bytes);
        const result: ExportResult = {
          path: request.destPath,
          fileName: path.basename(request.destPath),
          entriesExported: out.entriesExported,
          sizeBytes: out.bytes.length,
        };
        res.json(result);
        return;
      }

      res.status(200);
      res.setHeader('Content-Type', out.mime);
      res.setHeader('Content-Disposition', contentDispositionAttachment(out.fileName));
      res.setHeader('Content-Length', String(out.bytes.length));
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Entries-Exported', String(out.entriesExported));
      res.end(out.bytes);
    } catch (e) {
      next(e);
    }
  });

  return r;
}
