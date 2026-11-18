/**
 * Hosted mode, the Server card's disk block (docs/server-tasks/SERVER-CARD-V2.md Part B):
 *
 *   GET  /api/server/disk          -> ServerDiskInfo
 *   POST /api/server/disk/extend   ServerDiskExtendRequest { sizeGb, password } -> 202 ServerDiskChange (the job)
 *   POST /api/server/disk/restart  ServerDiskRestartRequest { password }       -> 202 ServerDiskChange ('restarting')
 *
 * All three: auth + HTTPS + the owner by DIARY_OWNER_ID (403 'server.owner.unset' for everyone while no valid
 * owner is configured), in that order, exactly like routes/server-status.ts. The two POSTs check the account
 * password with the same function and the same confirmation lockout (CONFIRM_LOCKOUT_PREFIX) as the archive
 * and the Mail card, behind the same rateLimit(30) - and only after everything that needs no password: the
 * button set up, no change open, the daily limit, the size (a whole number, at most the maximum, larger than
 * the size Fly reports now). A request turned away there costs no password attempt.
 *
 * The controller (hosted/disk.ts, with the Fly API client) is injected as HostedAppOptions.disk by the hosted
 * composition: this file is bundled into the desktop sidecar and the Android core too, so it imports nothing
 * of it. app.ts mounts this router in hosted mode only; the local server answers 404.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { ServerDiskChange, ServerDiskInfo } from '@shared/types';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';
import { DISK_BAD_BODY_KEY, DISK_PASSWORD_REQUIRED_KEY, DISK_UNAVAILABLE_KEY, DISK_WRONG_PASSWORD_KEY } from '../hosted/disk-errors';
import { hostedOwnerGate } from '../hosted/owner';
import type { DiskController, HostedAppOptions } from '../hosted/types';
import { isSecureRequest, rateLimit } from '../middleware/access';
import { ctxOf, requireAuth } from '../middleware/auth';
import { localeOf } from '../middleware/locale';
import { isGuestContext } from '../security/guest';

export function serverDiskRouter(deps: AppDeps): Router {
  const r = Router();
  const hosted = deps.hosted as HostedAppOptions;
  const owner = hostedOwnerGate({
    ownerId: hosted.ownerId,
    accountExists: (id) => deps.auth.listAccounts().some((a) => a.id === id),
  });

  /** HTTPS and the owner - in that order, so a stranger learns nothing from the answer. A guest is never the owner. */
  const ownerOnly = (req: Request): void => {
    if (!isSecureRequest(req)) throw ApiError.forbidden();
    const ctx = ctxOf(req);
    if (isGuestContext(ctx)) throw ApiError.forbidden();
    owner.assert(ctx.account.id);
  };

  const diskOf = (): DiskController => {
    if (!hosted.disk) throw ApiError.forbidden(DISK_UNAVAILABLE_KEY);
    return hosted.disk;
  };

  const bodyOf = (req: Request): Record<string, unknown> => {
    const raw: unknown = req.body ?? {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw ApiError.validation(DISK_BAD_BODY_KEY);
    return raw as Record<string, unknown>;
  };

  const passwordOf = (body: Record<string, unknown>): string => {
    const { password } = body;
    if (typeof password !== 'string' || password === '') throw ApiError.validation(DISK_PASSWORD_REQUIRED_KEY, 'password');
    return password;
  };

  /** Counted by the confirmation lockout (CONFIRM_LOCKOUT_PREFIX), exactly like the archive and the Mail card. */
  const confirm = async (req: Request, password: string): Promise<void> => {
    const ok = await deps.auth.verifyPassword(ctxOf(req).account, password);
    if (!ok) throw ApiError.localized(400, 'WRONG_PASSWORD', DISK_WRONG_PASSWORD_KEY, undefined, 'password');
  };

  r.get('/disk', requireAuth(deps.auth), async (req: Request, res: Response, next: NextFunction) => {
    try {
      ownerOnly(req);
      const info: ServerDiskInfo = await diskOf().info();
      res.json(info);
    } catch (e) {
      next(e);
    }
  });

  r.post(
    '/disk/extend',
    // The password check must not become a faster guessing oracle than /api/auth/verify-password.
    rateLimit(30),
    requireAuth(deps.auth),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ownerOnly(req);
        const disk = diskOf();
        const body = bodyOf(req);
        // Not set up, a change open, the daily limit: refused before anything else is looked at.
        disk.assertCanStart();
        const password = passwordOf(body);
        // The size before the password: a mistyped size costs no confirmation attempt.
        const plan = await disk.plan(body.sizeGb);
        await confirm(req, password);
        const job: ServerDiskChange = disk.start(plan, localeOf(req));
        res.status(202).json(job);
      } catch (e) {
        next(e);
      }
    },
  );

  r.post(
    '/disk/restart',
    rateLimit(30),
    requireAuth(deps.auth),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ownerOnly(req);
        const disk = diskOf();
        const body = bodyOf(req);
        // Only while a change waits for a restart - checked before the password.
        disk.assertCanRestart();
        await confirm(req, passwordOf(body));
        const job: ServerDiskChange = disk.restart();
        res.status(202).json(job);
      } catch (e) {
        next(e);
      }
    },
  );

  return r;
}
