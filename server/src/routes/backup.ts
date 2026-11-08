/**
 * /api/backup - create / inspect / restore (docs/API.md "גיבוי ושחזור").
 * Mounted behind `requireAuth` in app.ts. Errors are catalogue keys ('server.backup.*')
 * rendered in the request language. The guest of the tour mode gets 403 on every route here:
 * there is nothing of its own to back up, and a restore would need a real diary to restore into.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { backupFileName } from '@shared/constants';
import type { BackupInfo } from '@shared/types';
import type { AppDeps } from '../app';
import { createBackupBytes, inspectBackup, readBackupSource, restoreBackup, type BackupSourceBody } from '../backup/backup';
import { ApiError } from '../errors';
import { ctxOf, refuseGuest } from '../middleware/auth';
import { localeOf } from '../middleware/locale';
import { nowIso, todayIso } from '../util/dates';

function bodyOf(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
}

type Handler = (req: Request, res: Response) => Promise<void> | void;

function wrap(fn: Handler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (e) {
      next(e);
    }
  };
}

/** Writes the backup to the user-chosen path atomically (tmp + rename). */
function writeBackupFile(destPath: string, bytes: Buffer): void {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) throw ApiError.io('server.backup.destDirMissing');
  const tmp = `${destPath}.tmp`;
  try {
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, destPath);
  } catch {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
    throw ApiError.io('server.backup.writeFailed');
  }
}

/** RFC 6266 attachment header that survives non-ASCII names. */
function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function backupRouter(_deps: AppDeps): Router {
  const r = Router();
  r.use(refuseGuest);

  r.post(
    '/create',
    wrap(async (req, res) => {
      const ctx = ctxOf(req);
      const body = bodyOf(req);
      const password = body.password;
      if (password !== undefined && typeof password !== 'string') {
        throw ApiError.validation('server.backup.badPassword', 'password');
      }
      const bytes = await createBackupBytes(ctx.vault, ctx.account, password as string | undefined);
      const suggestedName = backupFileName(ctx.account.username, todayIso());

      const destPath = body.destPath;
      if (typeof destPath === 'string' && destPath.trim()) {
        if (!req.isLocal) throw ApiError.forbidden('server.backup.saveLocalOnly');
        const target = destPath.trim();
        if (!path.isAbsolute(target)) throw ApiError.validation('server.backup.destPathAbsolute', 'destPath');
        writeBackupFile(target, bytes);
        const info: BackupInfo = {
          path: target,
          fileName: path.basename(target),
          sizeBytes: bytes.length,
          createdAt: nowIso(),
        };
        res.json(info);
        return;
      }

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', contentDisposition(suggestedName));
      res.setHeader('Content-Length', String(bytes.length));
      res.setHeader('Cache-Control', 'no-store');
      res.end(bytes);
    }),
  );

  r.post(
    '/inspect',
    wrap((req, res) => {
      ctxOf(req);
      const bytes = readBackupSource(bodyOf(req) as BackupSourceBody, !!req.isLocal);
      res.json(inspectBackup(bytes, localeOf(req)));
    }),
  );

  r.post(
    '/restore',
    wrap(async (req, res) => {
      const ctx = ctxOf(req);
      const body = bodyOf(req);
      const password = typeof body.password === 'string' ? body.password : '';
      if (!password) throw ApiError.validation('server.backup.passwordRequired', 'password');
      const bytes = readBackupSource(body as BackupSourceBody, !!req.isLocal);
      const info = await restoreBackup(ctx.vault, bytes, password);
      res.json(info);
    }),
  );

  return r;
}
