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
 * The status also says how many users the volume is enough for (`ServerStatus.capacity`, the model
 * of `ServerCapacity` in shared/types.ts): `serverCapacity(...)` from the size of the volume (less
 * the blocks the file system keeps for root - `volumeStats(...)`, the same single statfs call) and the
 * sizes of the diaries in `<dataDir>/users/` (`diaryFiles(...)` - a directory listing and `stat`
 * only; no diary is opened).
 *
 * The archive writer is injected (`HostedAppOptions.archive`, built in hosted.ts): this file is
 * bundled into the desktop sidecar and the Android core too, so it imports nothing of it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { APP_VERSION } from '@shared/constants';
import {
  SERVER_ARCHIVE_DUE_DAYS,
  SERVER_ARCHIVE_PASSPHRASE_MAX,
  SERVER_ARCHIVE_PASSPHRASE_MIN,
  SERVER_CAPACITY_COPIES,
  SERVER_DISK_LOW_PCT,
  SERVER_TYPICAL_DIARY_BYTES,
  type ServerArchiveInfo,
  type ServerArchiveResult,
  type ServerCapacity,
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

/** The file system holding the data directory, as one `fs.statfs` call reports it. */
export interface VolumeStats {
  /** `ServerStatus.disk`: total bytes, and free bytes = what an unprivileged process may still fill (`bavail`). */
  disk: { totalBytes: number; freeBytes: number; freePct: number };
  /**
   * Free bytes only root may fill (ext4 keeps 5 % by default: `bfree - bavail`); 0 when there are none
   * or the platform does not say. The hosted server runs as the unprivileged user `diary`
   * (deploy/hosted/entrypoint.sh), so these bytes are never its own.
   */
  reservedBytes: number;
}

/** The volume holding `dir`; null when the platform cannot say. */
export function volumeStats(dir: string): VolumeStats | null {
  try {
    const s = fs.statfsSync(dir);
    const bsize = Number(s.bsize);
    const totalBytes = Number(s.blocks) * bsize;
    const freeBytes = Number(s.bavail) * bsize;
    if (!Number.isFinite(totalBytes) || totalBytes <= 0 || !Number.isFinite(freeBytes)) return null;
    const reservedBytes = (Number(s.bfree) - Number(s.bavail)) * bsize;
    return {
      disk: { totalBytes, freeBytes, freePct: Math.floor((freeBytes / totalBytes) * 100) },
      reservedBytes: Number.isFinite(reservedBytes) && reservedBytes > 0 ? reservedBytes : 0,
    };
  } catch {
    return null;
  }
}

/** Free / total bytes of the file system holding `dir`; null when the platform cannot say. */
export function diskStats(dir: string): VolumeStats['disk'] | null {
  return volumeStats(dir)?.disk ?? null;
}

/** End of a diary's file name in `<dataDir>/users/` (`<account id>.mpd`, security/vault.ts); `.mpd.prev` and `.mpd.tmp` do not end so. */
const DIARY_FILE_SUFFIX = '.mpd';

/** How many diaries a users folder holds and their total size in bytes. */
export interface DiaryFiles {
  count: number;
  totalBytes: number;
}

/**
 * The diaries in `usersDir`: the `<id>.mpd` files only - not their `.mpd.prev` safety copies, a
 * `.mpd.tmp` being written, other files or folders. A listing and `stat` per diary: no diary is opened
 * or read. A missing (or unreadable) folder counts as no diaries; a file removed meanwhile is skipped.
 */
export async function diaryFiles(usersDir: string): Promise<DiaryFiles> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(usersDir, { withFileTypes: true });
  } catch {
    return { count: 0, totalBytes: 0 };
  }
  let count = 0;
  let totalBytes = 0;
  for (const entry of entries) {
    // A Dirent never follows a link: a symbolic link is neither a file nor counted.
    if (!entry.isFile() || !entry.name.endsWith(DIARY_FILE_SUFFIX)) continue;
    try {
      const st = await fs.promises.stat(path.join(usersDir, entry.name));
      if (!st.isFile()) continue;
      count += 1;
      totalBytes += st.size;
    } catch {
      /* removed meanwhile (an account was deleted) */
    }
  }
  return { count, totalBytes };
}

/**
 * How many users a volume of `totalBytes` is enough for (`ServerCapacity`; the model is documented
 * there): every account costs `SERVER_CAPACITY_COPIES` times its diary, a diary counts as the larger
 * of today's mean and `SERVER_TYPICAL_DIARY_BYTES`, and the `SERVER_DISK_LOW_PCT` warning margin
 * stays free, as do the `reservedBytes` only root may fill (`VolumeStats`). `maxDiaryBytes` 0 = no
 * quota (`usersAtQuota` null).
 */
export function serverCapacity(totalBytes: number, diaries: DiaryFiles, maxDiaryBytes: number, reservedBytes = 0): ServerCapacity {
  const usableBytes = Math.max(0, Math.floor((totalBytes * (100 - SERVER_DISK_LOW_PCT)) / 100) - reservedBytes);
  const averageDiaryBytes = diaries.count > 0 ? Math.round(diaries.totalBytes / diaries.count) : null;
  const countedDiaryBytes = Math.max(averageDiaryBytes ?? 0, SERVER_TYPICAL_DIARY_BYTES);
  const perUserTypicalBytes = SERVER_CAPACITY_COPIES * countedDiaryBytes;
  return {
    usableBytes,
    averageDiaryBytes,
    diaries: diaries.count,
    perUserTypicalBytes,
    usersTypical: Math.floor(usableBytes / perUserTypicalBytes),
    usersAtQuota: maxDiaryBytes > 0 ? Math.floor(usableBytes / (SERVER_CAPACITY_COPIES * maxDiaryBytes)) : null,
    countedDiaryBytes,
    copies: SERVER_CAPACITY_COPIES,
    keptFreePct: SERVER_DISK_LOW_PCT,
  };
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
      const volume = volumeStats(deps.config.dataDir);
      const disk = volume?.disk ?? null;
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
        capacity: volume
          ? serverCapacity(volume.disk.totalBytes, await diaryFiles(deps.config.usersDir), hosted.maxDiaryBytes, volume.reservedBytes)
          : null,
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
