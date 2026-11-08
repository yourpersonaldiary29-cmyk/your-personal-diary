/**
 * The API of the mobile core: server/src/app.ts composed for the phone. The same middleware in
 * the same order and the same routers (imported unchanged from server/src), on the express shim
 * (./express-shim) instead of Express, with the differences the phone needs:
 *
 *  - `guestAllowed: true`: POST /api/auth/guest exists (the tour mode, docs/ANDROID-PLAN.md 3.3);
 *  - every request is local (the host is the only client and the shim presents a loopback
 *    address), so GET /api/auth/accounts, POST /api/auth/guest and the owner-only cards work;
 *  - no remote access and no LAN: the deps carry no remote controller and the server settings are
 *    a constant `{ port: 0, lanEnabled: false }`, so /api/server/info and /settings answer like a
 *    desktop on which those features are absent and the UI hides the cards; the mail service is
 *    there (the owner's SMTP card), with whatever transport the core was booted with;
 *  - "save to a folder on disk" is refused: a `destPath` (backup create, export) or `srcPath`
 *    (backup inspect / restore) answers 400 VALIDATION before the router runs. On the phone a file
 *    can only be written below /data of the virtual file system; anything else would stay in the
 *    worker's memory and look saved. Files leave through the host (WP-7: Storage Access Framework /
 *    share) - the download answers (no `destPath`) are the way;
 *  - the link of a password-reset e-mail opens the app (`MOBILE_RESET_LINK_BASE`): nothing listens
 *    on the phone, so the desktop's `http://127.0.0.1:<port>` would be a dead link;
 *  - no static UI: the WebView loads the UI from the app's assets; a non-API path answers 404.
 */
import { BACKUP_BODY_LIMIT, BACKUP_REQUESTS_PER_MINUTE, DATA_BODY_LIMIT, SMALL_BODY_LIMIT, type AppDeps } from '../../server/src/app';
import { ApiError } from '../../server/src/errors';
import { corsFor, lanGuard, markLocal, rateLimit, securityHeaders } from '../../server/src/middleware/access';
import { requireAuth } from '../../server/src/middleware/auth';
import { errorHandler, notFoundApi } from '../../server/src/middleware/error';
import { localeMiddleware } from '../../server/src/middleware/locale';
import { authRouter, type PasswordResetController } from '../../server/src/routes/auth';
import { backupRouter } from '../../server/src/routes/backup';
import { calendarRouter } from '../../server/src/routes/calendar';
import { entriesRouter } from '../../server/src/routes/entries';
import { exportRouter } from '../../server/src/routes/export';
import { habitsRouter } from '../../server/src/routes/habits';
import { homeRouter, insightsRouter } from '../../server/src/routes/insights';
import { searchRouter } from '../../server/src/routes/search';
import { serverRouter, type MailController } from '../../server/src/routes/server';
import { settingsRouter } from '../../server/src/routes/settings';
import { statsRouter } from '../../server/src/routes/stats';
import { APP_VERSION } from '../../shared/constants';
import express, { type Application, type NextFunction, type Request, type Response } from './express-shim';

/**
 * The dependencies of the mobile app: the server's `AppDeps` with the mail service and the
 * password-reset service of the composition (as server/src/server.ts passes them) and without a
 * remote controller.
 */
export type MobileAppDeps = AppDeps & { mail: MailController; passwordReset: PasswordResetController };

/** Catalogue keys of the 400 answered to a "save to a folder on disk" request on the phone. */
export const BACKUP_DEST_PATH_KEY = 'server.backup.saveLocalOnly';
export const BACKUP_SRC_PATH_KEY = 'server.backup.pathLocalOnly';
export const EXPORT_DEST_PATH_KEY = 'server.export.saveLocalOnly';

function bodyField(req: Request, name: string): unknown {
  const body = req.body;
  return body && typeof body === 'object' ? (body as Record<string, unknown>)[name] : undefined;
}

function isPathGiven(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Refuses `destPath` / `srcPath` bodies with 400 VALIDATION (field: the offending one). Runs
 * after the body parser of its route group, before the router.
 */
export function refuseDiskPaths(keys: { destPath?: string; srcPath?: string }) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (keys.destPath && isPathGiven(bodyField(req, 'destPath'))) return next(ApiError.validation(keys.destPath, 'destPath'));
    if (keys.srcPath && isPathGiven(bodyField(req, 'srcPath'))) return next(ApiError.validation(keys.srcPath, 'srcPath'));
    next();
  };
}

/**
 * Where the link of a password-reset e-mail composed on the phone points: the app itself, through
 * the deep link of docs/ANDROID-PLAN.md 3.1,
 *
 *     yourpersonaldiary://reset?token=<token>
 *
 * On the desktop the link is `http://127.0.0.1:<port>/#/reset-password?token=<token>` (the server
 * serves the UI there: security/password-reset.ts composes it from the base the route gives). On
 * the phone nothing listens and `getListenInfo().port` is 0 - that link would be dead - so the
 * service is handed the link ready-made (`ForgotInput.resetLink`). The scheme is registered by the
 * native package (WP-12: an intent filter for yourpersonaldiary://reset; the host reads `token`
 * from the query and opens the reset-password screen). The 6-digit code of the same e-mail works
 * without the link.
 */
export const MOBILE_RESET_LINK_BASE = 'yourpersonaldiary://reset';

/** The deep link of the phone for a reset token: `yourpersonaldiary://reset?token=<token>`. */
export function mobileResetLink(token: string, linkBase: string = MOBILE_RESET_LINK_BASE): string {
  return `${linkBase}?token=${token}`;
}

/**
 * The reset service as the phone's routes use it: the same service, asked for a link that opens
 * the app instead of the one the route computed for a desktop (routes/auth.ts `resetLinkBase`).
 * The base is passed too: the service tells a local link (http://127.0.0.1) by it - this is none.
 */
export function withAppResetLink(reset: PasswordResetController, linkBase: string = MOBILE_RESET_LINK_BASE): PasswordResetController {
  const notify = reset.notifyEmailChanged?.bind(reset);
  return {
    request: (input) => reset.request({ ...input, linkBase, resetLink: (token) => mobileResetLink(token, linkBase) }),
    resetWithToken: (token, newPassword, locale) => reset.resetWithToken(token, newPassword, locale),
    resetWithCode: (email, code, newPassword, locale) => reset.resetWithCode(email, code, newPassword, locale),
    ...(notify ? { notifyEmailChanged: notify } : {}),
  };
}

/** The server settings of the phone: nothing listens, nothing is shared on a network. */
export const MOBILE_SERVER_SETTINGS = Object.freeze({ port: 0, lanEnabled: false });

/**
 * Builds the app. Mirrors `createApp` of server/src/app.ts line by line; the pieces are the
 * server's own, only the composition is the phone's.
 */
export function createMobileApp(deps: MobileAppDeps): Application {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);

  app.use(markLocal);
  app.use(localeMiddleware);
  app.use(securityHeaders);
  app.use(corsFor(deps.config.dev));
  app.use(lanGuard(() => deps.getServerSettings().lanEnabled));
  // Request bodies are parsed per route group, never before the session check of a data route
  // (server/src/app.ts explains why).
  const smallJson = express.json({ limit: SMALL_BODY_LIMIT });
  const dataJson = express.json({ limit: DATA_BODY_LIMIT });

  // Public ------------------------------------------------------------------
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, version: APP_VERSION });
  });
  app.use('/api/server', smallJson, serverRouter(deps));
  const authDeps: MobileAppDeps = { ...deps, guestAllowed: true, passwordReset: withAppResetLink(deps.passwordReset) };
  app.use('/api/auth', rateLimit(30), smallJson, authRouter(authDeps));

  // Authenticated -------------------------------------------------------------
  const guard = requireAuth(deps.auth);
  app.use('/api/entries', guard, dataJson, entriesRouter(deps));
  app.use('/api/habits', guard, dataJson, habitsRouter(deps));
  app.use('/api/calendar', guard, dataJson, calendarRouter(deps));
  app.use('/api/insights', guard, dataJson, insightsRouter(deps));
  app.use('/api/home', guard, dataJson, homeRouter(deps));
  app.use('/api/stats', guard, dataJson, statsRouter(deps));
  app.use('/api/search', guard, dataJson, searchRouter(deps));
  app.use('/api/settings', guard, dataJson, settingsRouter(deps));
  app.use(
    '/api/backup',
    guard,
    rateLimit(BACKUP_REQUESTS_PER_MINUTE),
    express.json({ limit: BACKUP_BODY_LIMIT }),
    refuseDiskPaths({ destPath: BACKUP_DEST_PATH_KEY, srcPath: BACKUP_SRC_PATH_KEY }),
    backupRouter(deps),
  );
  app.use('/api/export', guard, dataJson, refuseDiskPaths({ destPath: EXPORT_DEST_PATH_KEY }), exportRouter(deps));
  app.use('/api', notFoundApi);

  // No UI is served from here (the desktop serves dist/ to phones on the home network).
  app.use(notFoundApi);

  app.use(errorHandler);
  return app;
}
