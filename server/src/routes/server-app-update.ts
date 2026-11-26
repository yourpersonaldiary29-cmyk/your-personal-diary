/**
 * Hosted mode: the required update in the owner's Server card (app version 1.1.0). Owner only and HTTPS only,
 * exactly like the Downloads page (routes/server-downloads.ts): a stranger learns nothing.
 *
 *   GET  /api/server/app-update   -> ServerAppUpdate: the rule of each platform (null = off), the server's own
 *                                    version, the newest file of the Downloads page per platform, the e-mail state
 *   POST /api/server/app-update   { platform, minVersion | null, password } (ServerAppUpdateChange)
 *                                 -> 200 ServerAppUpdate; minVersion is a.b.c, not below FIRST_UPDATE_AWARE_VERSION
 *                                    (1.1.0) and not above the server's own version (null turns the rule off -
 *                                    always allowed); the cheap checks first, then the
 *                                    password like every password-confirmed action (AuthService.verifyPassword, the
 *                                    confirmation lockout); at most 30 a minute per address; an e-mail to the owner
 *
 * The work is done by the controller of the hosted composition (`HostedAppOptions.appUpdate`,
 * server/src/hosted/app-update.ts): this file is bundled into the desktop sidecar and the Android core too, so it
 * imports nothing of it - only the pure keys of hosted/app-update-errors.ts.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { isLocale } from '@shared/i18n';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';
import { APP_UPDATE_BAD_BODY_KEY, APP_UPDATE_PASSWORD_REQUIRED_KEY, APP_UPDATE_UNAVAILABLE_KEY, APP_UPDATE_WRONG_PASSWORD_KEY } from '../hosted/app-update-errors';
import { hostedOwnerGate } from '../hosted/owner';
import type { AppUpdateController, DownloadNotice, HostedAppOptions } from '../hosted/types';
import { isSecureRequest, rateLimit } from '../middleware/access';
import { ctxOf, requireAuth } from '../middleware/auth';
import { localeOf } from '../middleware/locale';
import { isGuestContext } from '../security/guest';
import { SECURE_ONLY_KEY } from './server-status';

export function serverAppUpdateRouter(deps: AppDeps): Router {
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

  const controller = (): AppUpdateController => {
    if (!hosted.appUpdate) throw ApiError.forbidden(APP_UPDATE_UNAVAILABLE_KEY);
    return hosted.appUpdate;
  };

  const bodyOf = (req: Request): Record<string, unknown> => {
    const raw: unknown = req.body ?? {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw ApiError.validation(APP_UPDATE_BAD_BODY_KEY);
    return raw as Record<string, unknown>;
  };

  /** The account password, checked like every password-confirmed action (the confirmation lockout counts it). */
  const confirmPassword = async (req: Request, body: Record<string, unknown>): Promise<void> => {
    const { password } = body;
    if (typeof password !== 'string' || password === '') throw ApiError.validation(APP_UPDATE_PASSWORD_REQUIRED_KEY, 'password');
    const ok = await deps.auth.verifyPassword(ctxOf(req).account, password);
    if (!ok) throw ApiError.localized(400, 'WRONG_PASSWORD', APP_UPDATE_WRONG_PASSWORD_KEY, undefined, 'password');
  };

  /** The e-mail about a change: the owner's own account address, in his language. */
  const noticeOf = (req: Request): DownloadNotice => {
    const account = ctxOf(req).account;
    return { to: account.email ?? '', firstName: account.firstName, locale: isLocale(account.language) ? account.language : localeOf(req) };
  };

  r.get('/app-update', requireAuth(deps.auth), (req: Request, res: Response, next: NextFunction) => {
    try {
      ownerOnly(req);
      res.json(controller().view(ctxOf(req).account.email ?? ''));
    } catch (e) {
      next(e);
    }
  });

  r.post(
    '/app-update',
    // The password check must not become a faster guessing oracle than /api/auth/verify-password.
    rateLimit(30),
    requireAuth(deps.auth),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        ownerOnly(req);
        const appUpdate = controller();
        const body = bodyOf(req);
        // Everything that costs nothing first: a refused change spends no password attempt.
        const change = appUpdate.checkChange(body);
        await confirmPassword(req, body);
        res.json(await appUpdate.change(change, noticeOf(req)));
      } catch (e) {
        next(e);
      }
    },
  );

  return r;
}
