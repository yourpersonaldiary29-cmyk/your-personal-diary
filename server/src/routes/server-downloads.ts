/**
 * Hosted mode: the files of the Downloads page in the owner's Server card (docs/server-tasks/SERVER-CARD-V2.md Part A).
 * Owner only and HTTPS only, exactly like the other owner routes (routes/server-status.ts): a stranger learns nothing.
 *
 *   GET  /api/server/downloads                  -> ServerDownloads: the merged list per platform and the limits
 *   POST /api/server/downloads/upload-intent    { platform, version, password, removeOlder?, bytes? }
 *                                               -> 201 ServerDownloadUploadTicket (a one-time token, 15 minutes,
 *                                                  for this session only); the password is checked like every
 *                                                  password-confirmed action (AuthService.verifyPassword, the
 *                                                  confirmation lockout) - after the cheap checks
 *   PUT  /api/server/downloads/upload/<token>   the file as the raw body (application/octet-stream)
 *                                               -> 201 ServerDownloadResult
 *   POST /api/server/downloads/remove           { platform, version, password } -> 200 ServerDownloadResult
 *
 * The work is done by the controller of the hosted composition (`HostedAppOptions.downloads`,
 * server/src/hosted/downloads.ts): this file is bundled into the desktop sidecar and the Android core too, so it
 * imports nothing of it - only the pure keys of hosted/downloads-errors.ts.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { isLocale } from '@shared/i18n';
import { SERVER_DOWNLOAD_MAX_BYTES } from '@shared/types';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';
import { DOWNLOADS_BAD_BODY_KEY, DOWNLOADS_PASSWORD_REQUIRED_KEY, DOWNLOADS_UNAVAILABLE_KEY, DOWNLOADS_WRONG_PASSWORD_KEY } from '../hosted/downloads-errors';
import { hostedOwnerGate } from '../hosted/owner';
import type { DownloadNotice, DownloadsController, HostedAppOptions } from '../hosted/types';
import { isSecureRequest, rateLimit } from '../middleware/access';
import { ctxOf, requireAuth } from '../middleware/auth';
import { localeOf } from '../middleware/locale';
import { isGuestContext } from '../security/guest';
import { SECURE_ONLY_KEY } from './server-status';

export function serverDownloadsRouter(deps: AppDeps): Router {
  const r = Router();
  const hosted = deps.hosted as HostedAppOptions;
  const owner = hostedOwnerGate({
    ownerId: hosted.ownerId,
    accountExists: (id) => deps.auth.listAccounts().some((a) => a.id === id),
  });

  /** HTTPS and the owner - in that order, so a stranger learns nothing from the answer. A guest is never the owner. */
  const ownerOnly = (req: Request): void => {
    if (!isSecureRequest(req)) throw ApiError.forbidden(SECURE_ONLY_KEY);
    const ctx = ctxOf(req);
    if (isGuestContext(ctx)) throw ApiError.forbidden();
    owner.assert(ctx.account.id);
  };

  const controller = (): DownloadsController => {
    if (!hosted.downloads) throw ApiError.forbidden(DOWNLOADS_UNAVAILABLE_KEY);
    return hosted.downloads;
  };

  const bodyOf = (req: Request): Record<string, unknown> => {
    const raw: unknown = req.body ?? {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw ApiError.validation(DOWNLOADS_BAD_BODY_KEY);
    return raw as Record<string, unknown>;
  };

  /** The account password, checked like every password-confirmed action (the confirmation lockout counts it). */
  const confirmPassword = async (req: Request, body: Record<string, unknown>): Promise<void> => {
    const { password } = body;
    if (typeof password !== 'string' || password === '') throw ApiError.validation(DOWNLOADS_PASSWORD_REQUIRED_KEY, 'password');
    const ok = await deps.auth.verifyPassword(ctxOf(req).account, password);
    if (!ok) throw ApiError.localized(400, 'WRONG_PASSWORD', DOWNLOADS_WRONG_PASSWORD_KEY, undefined, 'password');
  };

  /** The e-mail about an upload or a removal: the owner's own account address, in his language. */
  const noticeOf = (req: Request): DownloadNotice => {
    const account = ctxOf(req).account;
    return { to: account.email ?? '', firstName: account.firstName, locale: isLocale(account.language) ? account.language : localeOf(req) };
  };

  r.get('/downloads', requireAuth(deps.auth), (req: Request, res: Response, next: NextFunction) => {
    try {
      ownerOnly(req);
      res.json(controller().list(ctxOf(req).account.email ?? ''));
    } catch (e) {
      next(e);
    }
  });

  r.post(
    '/downloads/upload-intent',
    // The password check must not become a faster guessing oracle than /api/auth/verify-password.
    rateLimit(30),
    requireAuth(deps.auth),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ownerOnly(req);
        const downloads = controller();
        const body = bodyOf(req);
        // Everything that costs nothing first: a refused intent spends no password attempt.
        const intent = downloads.checkIntent(body);
        await confirmPassword(req, body);
        res.status(201).json(downloads.issueToken(intent, ctxOf(req).session.id));
      } catch (e) {
        next(e);
      }
    },
  );

  r.put('/downloads/upload/:token', rateLimit(30), requireAuth(deps.auth), async (req: Request, res: Response, next: NextFunction) => {
    try {
      ownerOnly(req);
      const result = await controller().upload(req, String(req.params.token ?? ''), ctxOf(req).session.id, noticeOf(req));
      res.status(201).json(result);
    } catch (e) {
      // Refused before the body was read: Node reads the rest after the answer (as on every route), so that the
      // client gets the answer once it has sent its file - up to the limit. A body without a length, or with one
      // over the limit, is not read: the connection closes after the answer.
      if (!req.complete) {
        const declared = Number(req.headers['content-length']);
        if (!(Number.isSafeInteger(declared) && declared <= SERVER_DOWNLOAD_MAX_BYTES) || req.headers['transfer-encoding'] !== undefined) res.setHeader('Connection', 'close');
      }
      next(e);
    }
  });

  r.post('/downloads/remove', rateLimit(30), requireAuth(deps.auth), async (req: Request, res: Response, next: NextFunction) => {
    try {
      ownerOnly(req);
      const downloads = controller();
      const body = bodyOf(req);
      const target = downloads.checkRemove(body);
      await confirmPassword(req, body);
      res.json(await downloads.remove(target, noticeOf(req)));
    } catch (e) {
      next(e);
    }
  });

  return r;
}
