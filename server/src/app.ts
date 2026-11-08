/**
 * Express application factory. Everything the routes need is injected through
 * `AppDeps` so tests can build an app with a temporary data directory.
 */
import express, { type Express, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { APP_NAME, APP_VERSION } from '@shared/constants';
import { localeDef, t, type Locale } from '@shared/i18n';
import type { ServerSettings } from '@shared/types';
import type { ServerConfig } from './config';
import type { HostedAppOptions } from './hosted/types';
import { corsFor, globalRateLimit, HOSTED_ORIGINS, hostedHeaders, lanGuard, markHosted, markLocal, rateLimit, securityHeaders } from './middleware/access';
import { refuseGuest, requireAuth } from './middleware/auth';
import { refuseDiskPaths } from './middleware/disk-paths';
import { errorHandler, notFoundApi } from './middleware/error';
import { hostedHostCheck } from './middleware/hosted-host';
import { localeMiddleware, localeOf } from './middleware/locale';
import { quotaGuard, restoreQuotaGuard } from './middleware/quota';
import type { AuthService } from './security/session-types';
import { authRouter } from './routes/auth';
import { backupRouter } from './routes/backup';
import { calendarRouter } from './routes/calendar';
import { debugRouter } from './routes/debug';
import { entriesRouter } from './routes/entries';
import { exportRouter } from './routes/export';
import { habitsRouter } from './routes/habits';
import { homeRouter, insightsRouter } from './routes/insights';
import { searchRouter } from './routes/search';
import { serverRouter } from './routes/server';
import { serverStatusRouter } from './routes/server-status';
import { settingsRouter } from './routes/settings';
import { statsRouter } from './routes/stats';
import { exposeRetryAfter, syncRestoreCarry, syncRouter } from './routes/sync';

export interface AppDeps {
  config: ServerConfig;
  auth: AuthService;
  /** Live server settings (mutable; the listener manager reacts to changes). */
  getServerSettings: () => ServerSettings;
  setServerSettings: (next: ServerSettings) => Promise<ServerSettings>;
  /** Actual port + LAN URLs, filled once listening. */
  getListenInfo: () => { port: number; lanUrls: string[]; startedAt: string };
  /**
   * Mounts POST /api/auth/guest (tour mode: a temporary in-memory guest account, security/guest.ts).
   * Only the mobile core sets it; the desktop server never does, so there the route does not exist
   * (404) and nothing about the desktop changes. Default: false.
   */
  guestAllowed?: boolean;
  /**
   * Hosted mode (docs/HOSTED-PLAN.md Part B 2.2): present only in the hosted composition
   * (server/src/hosted.ts). It switches the chain to the public-server rules - `trust proxy`, the
   * public-host check, no LAN guard, no "local" requests, bucketed limits, the registration policy,
   * the quota and the health extras. Without it the middleware chain is exactly the local one.
   */
  hosted?: HostedAppOptions;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * The page at "/" when the server runs without the UI files (development without `npm run build`),
 * in the request language, with the brand (never translated) as its title.
 */
export function noUiPage(locale: Locale): string {
  const { dir } = localeDef(locale);
  return (
    `<!doctype html><html lang="${locale}" dir="${dir}"><meta charset="utf-8"><title>${escapeHtml(APP_NAME)}</title>` +
    `<body style="font-family:sans-serif;padding:2rem"><h1>${escapeHtml(t(locale, 'server.noUi.heading'))}</h1>` +
    `<p>${escapeHtml(t(locale, 'server.noUi.body', { command: 'npm run build' }))}</p></body></html>`
  );
}

/** Body limit of the public and account routes (/api/auth, /api/server): small forms only. */
export const SMALL_BODY_LIMIT = '100kb';
/** Body limit of the data routes (an entry with a long text, settings, search, export). */
export const DATA_BODY_LIMIT = '2mb';
/** Body limit of /api/backup (a whole encrypted diary, base64 in JSON). */
export const BACKUP_BODY_LIMIT = '25mb';
/** Backup inspect / restore / create requests per address and minute. */
export const BACKUP_REQUESTS_PER_MINUTE = 20;

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  const hosted = deps.hosted;

  if (hosted) {
    // Behind the platform's TLS proxy (2.2): the configured hop count makes `req.ip` the client's
    // address; the public-host check runs before anything else; no request is "local".
    app.set('trust proxy', hosted.trustProxy);
    // The operator's loopback admin API (3.10) first: the admin tool inside the container addresses
    // 127.0.0.1, not the public host. Any request it does not admit (not loopback, proxy headers, no
    // valid per-boot token) passes on untouched and gets the 404 / 421 of an unknown route below.
    if (hosted.admin) app.use('/api/admin', hosted.admin);
    app.use(hostedHostCheck(hosted.publicHost, hosted.extraHosts));
    app.use(markHosted({ ...(hosted.clientIpHeader ? { clientIpHeader: hosted.clientIpHeader } : {}) }));
  } else {
    app.use(markLocal);
  }
  app.use(localeMiddleware);
  app.use(securityHeaders);
  if (hosted) app.use(hostedHeaders);
  app.use(hosted ? corsFor(deps.config.dev, HOSTED_ORIGINS) : corsFor(deps.config.dev));
  // The LAN guard has no meaning behind a proxy (every request would be refused - finding 2).
  if (!hosted) app.use(lanGuard(() => deps.getServerSettings().lanEnabled));
  // Request bodies are parsed per route group, never before the session check of a data route: a
  // request without a valid session is answered before its body is read, so nobody can keep the
  // server busy parsing huge JSON documents (a pre-auth denial of service over remote access).
  const smallJson = express.json({ limit: SMALL_BODY_LIMIT });
  const dataJson = express.json({ limit: DATA_BODY_LIMIT });
  // Hosted mode: refuse a write once the diary reached its quota (after the session check, before
  // the body is parsed); refuse disk paths in backup / export bodies (after the body parser).
  const quota = hosted && hosted.maxDiaryBytes > 0 ? [quotaGuard(hosted.maxDiaryBytes)] : [];
  const noDiskPaths = hosted
    ? [
        refuseDiskPaths({ destPath: 'server.backup.saveLocalOnly', srcPath: 'server.backup.pathLocalOnly' }),
        ...(hosted.maxDiaryBytes > 0 ? [restoreQuotaGuard(hosted.maxDiaryBytes)] : []),
      ]
    : [];
  const noExportPaths = hosted ? [refuseDiskPaths({ destPath: 'server.export.saveLocalOnly' })] : [];
  // Hosted mode: a restore keeps the offline-sync key and starts a new epoch (OFFLINE-DESIGN §3.7);
  // a local restore stays exactly the restored image.
  const syncCarry = hosted ? [syncRestoreCarry] : [];

  // Public ------------------------------------------------------------------
  if (hosted?.health) {
    const health = hosted.health;
    const minFreePct = hosted.minFreePct ?? 10;
    app.get('/api/health', (_req: Request, res: Response) => {
      res.json(health());
    });
    // The external uptime monitor's path (3.6): 503 when storage is degraded or nearly full. Never
    // give it to the platform - a restart cannot heal a full disk.
    app.get('/api/health/strict', (_req: Request, res: Response) => {
      const body = health();
      const degraded = !body.ok || body.storage !== 'ok' || (body.freePct !== null && body.freePct < minFreePct);
      res.status(degraded ? 503 : 200).json(degraded ? { ...body, ok: false, reason: 'storage' } : body);
    });
  } else {
    app.get('/api/health', (_req: Request, res: Response) => {
      res.json({ ok: true, version: APP_VERSION });
    });
  }
  // Retry-After for the cross-origin apps (Windows, Android), which can read it only when it is
  // exposed (routes/sync.ts exposeRetryAfter): the archive's 429 'server.archive.tooSoon' (the Server
  // card shows "next archive from HH:MM"), the tour's 503 'server.auth.guestsFull' and the derivation
  // gate's 503 'server.error.busy' under /api/auth, the same 503 for a backup password under
  // /api/backup - and every answer under /api/sync (mounted there, below). Only these routes; the
  // card's other routes and the mail routes stay as they are. Hosted mode only: the local server
  // never sends Retry-After, and the web UI is same-origin (no CORS headers at all).
  if (hosted) app.use(['/api/server/archive', '/api/auth', '/api/backup'], exposeRetryAfter);
  if (hosted) app.use('/api/server', smallJson, serverStatusRouter(deps));
  app.use('/api/server', smallJson, serverRouter(deps));
  if (hosted) {
    // Per-bucket limit of the real client (10/min by default) and the global cap (finding 8).
    app.use('/api/auth', globalRateLimit(hosted.authGlobalPerMinute), rateLimit(hosted.loginPerMinute), smallJson, authRouter(deps));
  } else {
    app.use('/api/auth', rateLimit(30), smallJson, authRouter(deps));
  }
  if (hosted?.debugRoutes) app.use('/api/debug', debugRouter());

  // Authenticated -------------------------------------------------------------
  const guard = requireAuth(deps.auth);
  app.use('/api/entries', guard, ...quota, dataJson, entriesRouter(deps));
  app.use('/api/habits', guard, ...quota, dataJson, habitsRouter(deps));
  app.use('/api/calendar', guard, ...quota, dataJson, calendarRouter(deps));
  app.use('/api/insights', guard, ...quota, dataJson, insightsRouter(deps));
  app.use('/api/home', guard, ...quota, dataJson, homeRouter(deps));
  app.use('/api/stats', guard, ...quota, dataJson, statsRouter(deps));
  app.use('/api/search', guard, ...quota, dataJson, searchRouter(deps));
  app.use('/api/settings', guard, ...quota, dataJson, settingsRouter(deps));
  // A backup file travels inside the JSON body (base64): the large limit, only after the session
  // check, and at most BACKUP_REQUESTS_PER_MINUTE per address.
  app.use('/api/backup', guard, ...syncCarry, rateLimit(BACKUP_REQUESTS_PER_MINUTE), express.json({ limit: BACKUP_BODY_LIMIT }), ...noDiskPaths, backupRouter(deps));
  app.use('/api/export', guard, dataJson, ...noExportPaths, exportRouter(deps));
  // Offline sync (docs/android-tasks/OFFLINE-DESIGN.md §3): hosted mode only - the local server
  // answers 404 as before. Mounted even while the kill switch hides `ServerInfo.offlineSync`, so
  // queued changes can drain. No quotaGuard: the route checks the quota per operation kind.
  // exposeRetryAfter first: the cross-origin apps must read Retry-After of every answer here.
  if (hosted) app.use('/api/sync', exposeRetryAfter, guard, refuseGuest, dataJson, syncRouter(deps));
  app.use('/api', notFoundApi);

  // Static UI for phones / browsers ------------------------------------------
  const staticDir = deps.config.staticDir;
  if (staticDir && fs.existsSync(path.join(staticDir, 'index.html'))) {
    if (hosted) {
      // Vite's hashed assets (/assets/name-<hash>.ext) may be cached forever; index.html never (4a).
      const hashed = /[\\/]assets[\\/][^\\/]+-[A-Za-z0-9_-]{6,}\.[a-z0-9]+$/;
      app.use(
        express.static(staticDir, {
          index: 'index.html',
          fallthrough: true,
          maxAge: 0,
          setHeaders: (res, filePath) => {
            res.setHeader('Cache-Control', hashed.test(filePath) ? 'public, max-age=31536000, immutable' : 'no-cache');
          },
        }),
      );
    } else {
      app.use(express.static(staticDir, { index: 'index.html', fallthrough: true, maxAge: 0 }));
    }
    app.get(/^(?!\/api).*/, (_req: Request, res: Response) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  } else {
    app.get('/', (req: Request, res: Response) => {
      res.type('text/html; charset=utf-8').send(noUiPage(localeOf(req)));
    });
  }

  app.use(errorHandler);
  return app;
}
