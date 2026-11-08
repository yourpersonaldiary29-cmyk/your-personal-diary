/**
 * Per-account diary quota of hosted mode (docs/HOSTED-PLAN.md 2.1 `DIARY_MAX_DIARY_BYTES`, 2.8).
 *
 * The check runs on every request that can grow the diary - after the session check, before the
 * body is parsed - and refuses it with `507 server.vault.quota` once the diary image has reached
 * the quota. Reads (GET) and deletions (DELETE) always go through, so a full diary can still be
 * read, exported, backed up and trimmed. The size is the SQLite image size (page count x page size),
 * which is what gets encrypted and written; it costs two PRAGMAs, no export.
 *
 * Why before the write and not in the vault's persist: the persist runs in the background, after
 * the request was answered - refusing it there would keep unsaved changes in memory until a restart
 * loses them. Restore checks the uploaded file against the quota separately (backup/backup.ts).
 */
import type { NextFunction, Request, Response } from 'express';
import type { DiaryDb } from '../db/database';
import { ApiError, ref } from '../errors';
import { ctxOf } from './auth';

/** Catalogue key of the 507 answered when a write would take the diary over its quota. */
export const QUOTA_KEY = 'server.vault.quota';

/** Size of the diary image in bytes (what `exportImage` would produce), from SQLite's own counters. */
export function diaryImageBytes(db: DiaryDb): number {
  const pages = Number(db.scalar<number>('PRAGMA page_count') ?? 0);
  const pageSize = Number(db.scalar<number>('PRAGMA page_size') ?? 4096);
  return pages * pageSize;
}

/** 507 'server.vault.quota' with the quota in whole megabytes. */
export function quotaExceeded(maxBytes: number): ApiError {
  return ApiError.localized(507, 'IO', QUOTA_KEY, { max: Math.max(1, Math.round(maxBytes / (1024 * 1024))) });
}

const GROWING_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/** Container header + tag slack allowed above the quota for an uploaded backup (its image is what counts). */
const RESTORE_SLACK_BYTES = 4096;

/**
 * Restore (and inspect) of a backup file larger than the quota: 413 'server.backup.tooLarge'
 * before the file is decoded or decrypted (the uploaded bytes are the encrypted image plus a
 * small header, so their size is the diary's size). Runs after the body parser of /api/backup.
 */
export function restoreQuotaGuard(maxBytes: number) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const text = typeof body.fileBase64 === 'string' ? body.fileBase64 : '';
    if (!text) return next();
    const approxBytes = Math.floor((text.replace(/^data:[^,]*,/, '').replace(/\s+/g, '').length * 3) / 4);
    if (approxBytes > maxBytes + RESTORE_SLACK_BYTES) {
      return next(
        ApiError.localized(413, 'BACKUP', 'server.backup.tooLarge', { max: ref('shell.format.megabytes', { value: Math.max(1, Math.round(maxBytes / (1024 * 1024))) }) }),
      );
    }
    next();
  };
}

/** Express middleware for the data routes (after `requireAuth`). */
export function quotaGuard(maxBytes: number) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!GROWING_METHODS.has(req.method)) return next();
    try {
      const ctx = ctxOf(req);
      // A memory-only diary (the guest) has no quota: nothing of it reaches the disk.
      if (ctx.vault.memoryOnly) return next();
      if (diaryImageBytes(ctx.db) >= maxBytes) return next(quotaExceeded(maxBytes));
      next();
    } catch (e) {
      next(e);
    }
  };
}
