/**
 * Hosted mode (docs/HOSTED-PLAN.md 2.5, 3.3, 3.6, 3.9; docs/android-tasks/SERVER-CARD.md): the
 * owner's "Server" card and the health extras.
 *
 *   GET  /api/server/status   -> ServerStatus (auth + HTTPS + the owner by DIARY_OWNER_ID; 403
 *                                'server.owner.unset' for everyone while no valid owner is configured)
 *   POST /api/server/archive  -> 201 ServerArchiveResult; body ServerArchiveRequest
 *                                { password, passphrase } (auth + HTTPS + the owner + the account
 *                                password under the confirmation lockout + a passphrase of 12..1024
 *                                characters; one archive per 10 minutes). Writes the encrypted archive
 *                                to <dataDir>/archive/ (hosted/archive.ts) and answers its size, SHA-256
 *                                and the owner's download command. The archive itself is NEVER served
 *                                by the API - there is no GET for it.
 *
 * `hostedHealth(...)` builds the `GET /api/health` answer of a hosted server (app.ts mounts it and
 * derives `/api/health/strict` from it): uptime, whether diary writes are succeeding
 * (security/storage-health.ts) and the free space of the data volume. It does no crypto and no
 * disk write - `fs.statfs` is the only call, and its failure only blanks `freePct`.
 *
 * The archive writer is injected (`HostedAppOptions.archive`, built in hosted.ts): this file is
 * bundled into the desktop sidecar and the Android core too, so it imports nothing of it.
 */
import fs from 'node:fs';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { APP_VERSION } from '@shared/constants';
import {
  SERVER_ARCHIVE_DUE_DAYS,
  SERVER_ARCHIVE_PASSPHRASE_MAX,
  SERVER_ARCHIVE_PASSPHRASE_MIN,
  SERVER_DISK_LOW_PCT,
  type ServerArchiveInfo,
  type ServerArchiveResult,
  type ServerStatus,
} from '@shared/types';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';
import {
  ARCHIVE_BAD_BODY_KEY,
  ARCHIVE_PASSPHRASE_LONG_KEY,
  ARCHIVE_PASSPHRASE_SHORT_KEY,
  ARCHIVE_PASSWORD_REQUIRED_KEY,
  ARCHIVE_UNAVAILABLE_KEY,
  ARCHIVE_WRONG_PASSWORD_KEY,
  archiveTooSoon,
} from '../hosted/archive-errors';
import { hostedOwnerGate } from '../hosted/owner';
import type { HostedAppOptions, HostedHealth } from '../hosted/types';
import { isSecureRequest, rateLimit } from '../middleware/access';
import { ctxOf, requireAuth } from '../middleware/auth';
import { isGuestContext } from '../security/guest';
import { storageHealth } from '../security/storage-health';

/** Free / total bytes of the file system holding `dir`; null when the platform cannot say. */
export function diskStats(dir: string): { totalBytes: number; freeBytes: number; freePct: number } | null {
  try {
    const s = fs.statfsSync(dir);
    const totalBytes = Number(s.blocks) * Number(s.bsize);
    const freeBytes = Number(s.bavail) * Number(s.bsize);
    if (!Number.isFinite(totalBytes) || totalBytes <= 0 || !Number.isFinite(freeBytes)) return null;
    return { totalBytes, freeBytes, freePct: Math.floor((freeBytes / totalBytes) * 100) };
  } catch {
    return null;
  }
}

/** The `GET /api/health` body of a hosted server. */
export function hostedHealth(dataDir: string, startedAtMs: number, now: () => number = Date.now): HostedHealth {
  const storage = storageHealth();
  const disk = diskStats(dataDir);
  return {
    ok: true,
    version: APP_VERSION,
    mode: 'hosted',
    uptimeSec: Math.max(0, Math.floor((now() - startedAtMs) / 1000)),
    storage: storage.ok ? 'ok' : 'degraded',
    freePct: disk ? disk.freePct : null,
  };
}

/** 403 answered to a plain-HTTP caller of an owner route on a hosted server (the edge should never let one through). */
export const SECURE_ONLY_KEY = 'server.error.forbidden';

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when there is no archive or the newest is older than SERVER_ARCHIVE_DUE_DAYS. */
export function isArchiveDue(newest: ServerArchiveInfo | undefined, nowMs: number = Date.now()): boolean {
  if (!newest) return true;
  const at = Date.parse(newest.createdAt);
  return !Number.isFinite(at) || nowMs - at > SERVER_ARCHIVE_DUE_DAYS * DAY_MS;
}

/** Characters of a passphrase as the KDF sees them (NFKC, code points). */
function passphraseLength(passphrase: string): number {
  return [...passphrase.normalize('NFKC')].length;
}

export function serverStatusRouter(deps: AppDeps): Router {
  const r = Router();
  const hosted = deps.hosted as HostedAppOptions;
  const owner = hostedOwnerGate({
    ownerId: hosted.ownerId,
    accountExists: (id) => deps.auth.listAccounts().some((a) => a.id === id),
  });

  /** HTTPS and the owner - in that order, so a stranger learns nothing from the answer. A guest is never the owner. */
  const ownerOnly = (req: Request) => {
    if (!isSecureRequest(req)) throw ApiError.forbidden(SECURE_ONLY_KEY);
    const ctx = ctxOf(req);
    if (isGuestContext(ctx)) throw ApiError.forbidden();
    owner.assert(ctx.account.id);
  };

  r.get('/status', requireAuth(deps.auth), async (req: Request, res: Response, next: NextFunction) => {
    try {
      ownerOnly(req);
      const startedAt = hosted.startedAt ?? deps.getListenInfo().startedAt;
      const storage = storageHealth();
      const metrics = hosted.metrics?.() ?? { openVaults: 0, liveSessions: 0, guests: 0 };
      const disk = diskStats(deps.config.dataDir);
      const archive = hosted.archive;
      const archives = archive?.list() ?? [];
      const status: ServerStatus = {
        version: APP_VERSION,
        mode: 'hosted',
        publicUrl: hosted.publicUrl,
        startedAt,
        uptimeSec: Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000)),
        accounts: deps.auth.listAccounts().length,
        maxAccounts: hosted.registration.maxAccounts,
        registrationsLast24h: hosted.registration.recentCount(),
        registration: hosted.registration.mode,
        maxDiaryBytes: hosted.maxDiaryBytes,
        disk,
        storageOk: storage.ok,
        lastPersistAt: storage.lastOkAt,
        lastPersistErrorAt: storage.lastFailureAt,
        openVaults: metrics.openVaults,
        liveSessions: metrics.liveSessions,
        guests: metrics.guests,
        maxGuests: hosted.guests?.max ?? 0,
        rssBytes: process.memoryUsage().rss,
        lastArchiveAt: archives[0]?.createdAt ?? null,
        diskLow: disk ? disk.freePct < SERVER_DISK_LOW_PCT : false,
        dataBytes: archive ? await archive.dataBytes() : null,
        archiveDue: isArchiveDue(archives[0]),
        archives,
        archiveBusy: archive?.busy() ?? false,
        archiveRetryAfterSec: archive ? Math.ceil(archive.cooldownRemainingMs() / 1000) : 0,
      };
      res.json(status);
    } catch (e) {
      next(e);
    }
  });

  r.post(
    '/archive',
    // The password check must not become a faster guessing oracle than /api/auth/verify-password.
    rateLimit(30),
    requireAuth(deps.auth),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ownerOnly(req);
        const archive = hosted.archive;
        if (!archive) throw ApiError.forbidden(ARCHIVE_UNAVAILABLE_KEY);
        // Inside the 1-per-10-minutes window nothing else is looked at (no scrypt is spent).
        const wait = archive.cooldownRemainingMs();
        if (wait > 0 || archive.busy()) throw archiveTooSoon(wait);
        const raw: unknown = req.body ?? {};
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw ApiError.validation(ARCHIVE_BAD_BODY_KEY);
        const { password, passphrase } = raw as Record<string, unknown>;
        if (typeof password !== 'string' || password === '') throw ApiError.validation(ARCHIVE_PASSWORD_REQUIRED_KEY, 'password');
        // The passphrase before the password: a too-short one costs no confirmation attempt.
        const length = typeof passphrase === 'string' ? passphraseLength(passphrase) : 0;
        if (length < SERVER_ARCHIVE_PASSPHRASE_MIN) {
          throw ApiError.validation(ARCHIVE_PASSPHRASE_SHORT_KEY, 'passphrase', { min: SERVER_ARCHIVE_PASSPHRASE_MIN });
        }
        if (length > SERVER_ARCHIVE_PASSPHRASE_MAX) {
          throw ApiError.validation(ARCHIVE_PASSPHRASE_LONG_KEY, 'passphrase', { max: SERVER_ARCHIVE_PASSPHRASE_MAX });
        }
        // Counted by the confirmation lockout (CONFIRM_LOCKOUT_PREFIX), exactly like the Mail card.
        const ok = await deps.auth.verifyPassword(ctxOf(req).account, password);
        if (!ok) throw ApiError.localized(400, 'WRONG_PASSWORD', ARCHIVE_WRONG_PASSWORD_KEY, undefined, 'password');
        const result: ServerArchiveResult = await archive.create(passphrase as string);
        res.status(201).json(result);
      } catch (e) {
        next(e);
      }
    },
  );

  return r;
}
