/**
 * /api/admin - the operator's loopback API of a hosted server (docs/HOSTED-PLAN.md 3.10,
 * docs/android-tasks/ADMIN-TOOL.md item 1): deletion on request, abuse clean-up, sign-out, unlock.
 *
 * Only the hosted composition builds it (hosted.ts) and app.ts mounts it first of all, before the
 * Host check. It answers a request ONLY when all three hold:
 *   1. the request arrived on a loopback socket - `req.socket.remoteAddress` of the real connection
 *      (127.0.0.0/8, ::1, ::ffff:127.x.x.x); X-Forwarded-For, Fly-Client-IP and every other header
 *      never count;
 *   2. it carries none of the headers a proxy adds (X-Forwarded-*, Fly-*, Forwarded, Via, X-Real-IP,
 *      ...): the platform's proxy connects from its private network, and if it ever came over loopback
 *      its requests would still be refused here;
 *   3. it carries this boot's admin token (hosted/admin-token.ts) in X-Admin-Token.
 * Every other request leaves this router untouched (`next('router')`) and gets exactly what an unknown
 * route gets - the API's 404 (or the Host check's 421 for a foreign Host): the path is not even
 * acknowledged, its body is never read, nothing is logged per request.
 *
 * The one client is the operator tool scripts/hosted/admin.ts (/app/admin.cjs), run by the owner in
 * the container through `flyctl ssh console` - his Fly login is the first credential, the token file
 * readable only by the server's user (and root) the second. Nothing the app password can reach -
 * no session, no route of the app - lists or deletes accounts.
 *
 *   GET  /api/admin/status                         counts only (accounts, open diaries, sessions, mode)
 *   GET  /api/admin/accounts                       { accounts: AdminAccountInfo[] } oldest first
 *   GET  /api/admin/accounts/find?username=|email=|q=   { matches: AdminAccountInfo[] } (exact match)
 *   POST /api/admin/accounts/:id/delete            { username } must equal the account's username
 *   POST /api/admin/accounts/:id/revoke-sessions   sign out on every device
 *   POST /api/admin/accounts/:id/unlock            reset the per-account lockout counters
 *
 * Answers carry `X-Admin-Api: 1`, errors `{ error, message }` (English - the CLI prints its own
 * English + Hebrew texts). AdminAccountInfo never holds anything of a diary (security/auth-service.ts).
 * The deletion is the account's own deletion without the password check (`adminDeleteAccount`) plus the
 * same owner release as POST /api/auth/delete-account (`pinUnownedSettings` before, `releaseDeletedOwner`
 * after); deleting the configured owner promotes nobody - DIARY_OWNER_ID alone names the owner.
 * The log gets one line per action, without any personal data: "admin: account deleted (1)".
 */
import express, { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { APP_VERSION } from '@shared/constants';
import type { AppDeps } from '../app';
import { isApiError } from '../errors';
import { ADMIN_TOKEN_HEADER, type AdminToken } from '../hosted/admin-token';
import type { AdminAccountInfo, AdminLookup } from '../security/auth-service';
import type { AccountRecord } from '../security/session-types';
import { pinUnownedSettings, releaseDeletedOwner } from './server';

/** Header on every answer of the admin API (the CLI tells it from the 404 / 421 of an unknown route). */
export const ADMIN_API_HEADER = 'x-admin-api';
export { ADMIN_TOKEN_HEADER };

/** What the routes need from the account service (DiaryAuthService implements it). */
export interface AdminAuth {
  adminAccount(userId: string): AdminAccountInfo | null;
  adminAccountCount(): number;
  adminAccounts(): AdminAccountInfo[];
  adminFindAccounts(by: AdminLookup, value: string): AdminAccountInfo[];
  adminDeleteAccount(userId: string): Promise<AccountRecord>;
  adminRevokeSessions(userId: string): Promise<number>;
  adminUnlock(userId: string): boolean;
  /** Counters for the status line. */
  readonly vaults: { readonly size: number };
  readonly sessions: { readonly size: number };
}

export interface AdminRouterOptions {
  auth: AdminAuth;
  /** This boot's token (hosted/admin-token.ts). */
  token: Pick<AdminToken, 'verify'>;
  /**
   * The app's dependencies (read on every deletion - the composition builds them after this router):
   * the owner release of a deletion uses the same remote / mail controllers as the account's own one.
   */
  deps: () => AppDeps;
  /** The configured owner (DIARY_OWNER_ID), read on every call; '' = none. */
  ownerId: () => string;
  /** The registration mode, for the status line. */
  registration: () => string;
  /** Log line sink (the hosted log; never gets a name, an address or an id). */
  log: (line: string) => void;
}

// Wire types (scripts/hosted/admin.ts imports them as types only) -------------------------------

export type AdminAccount = AdminAccountInfo;
export interface AdminStatusResponse {
  ok: true;
  version: string;
  accounts: number;
  openDiaries: number;
  liveSessions: number;
  registration: string;
  ownerConfigured: boolean;
}
export interface AdminListResponse {
  accounts: AdminAccount[];
}
export interface AdminFindResponse {
  matches: AdminAccount[];
}
export interface AdminDeleteResponse {
  deleted: true;
  /** The deleted account was the configured owner (DIARY_OWNER_ID): the owner cards are off now. */
  wasOwner: boolean;
}
export interface AdminRevokeResponse {
  /** Live sessions that were signed out. */
  revoked: number;
}
export interface AdminUnlockResponse {
  unlocked: true;
  /** Something was refusing or slowing the account's sign-ins before. */
  wasLocked: boolean;
}
export type AdminErrorCode = 'not-found' | 'username-mismatch' | 'bad-request' | 'failed' | 'unknown-route';
export interface AdminErrorResponse {
  error: AdminErrorCode;
  message: string;
}

// The gate ---------------------------------------------------------------------------------------

/** True for a loopback address of the socket itself: 127.0.0.0/8, ::1, ::ffff:127.x.x.x. */
export function isLoopbackSocketAddress(address: string | undefined): boolean {
  if (!address) return false;
  const a = address.trim().toLowerCase();
  if (a === '::1' || a === '0:0:0:0:0:0:0:1') return true;
  const v4 = a.startsWith('::ffff:') ? a.slice('::ffff:'.length) : a;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v4);
  return !!m && m[1] === '127' && m.slice(2).every((n) => Number(n) <= 255);
}

/** Header names a proxy or load balancer adds; any of them refuses the request. */
const PROXY_HEADERS = new Set(['forwarded', 'via', 'x-real-ip', 'x-client-ip', 'true-client-ip', 'cf-connecting-ip', 'x-cluster-client-ip']);

/** True when the request carries a header a proxy adds (X-Forwarded-*, Fly-*, Forwarded, Via, ...). */
export function hasProxyHeaders(req: Pick<Request, 'headers'>): boolean {
  for (const name of Object.keys(req.headers)) {
    const n = name.toLowerCase();
    if (n.startsWith('x-forwarded-') || n.startsWith('fly-') || PROXY_HEADERS.has(n)) return true;
  }
  return false;
}

/** The three conditions of the file comment. */
export function adminRequestAdmitted(req: Request, token: Pick<AdminToken, 'verify'>): boolean {
  if (!isLoopbackSocketAddress(req.socket?.remoteAddress)) return false;
  if (hasProxyHeaders(req)) return false;
  const presented = req.headers[ADMIN_TOKEN_HEADER];
  return typeof presented === 'string' && token.verify(presented);
}

// The routes -------------------------------------------------------------------------------------

class AdminError extends Error {
  constructor(
    readonly status: number,
    readonly code: AdminErrorCode,
    message: string,
  ) {
    super(message);
  }
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

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The account `:id` names - looked up first, so an unknown id is a clean 404 before anything runs. */
function accountOf(auth: AdminAuth, id: string): AdminAccountInfo {
  const found = id ? auth.adminAccount(id) : null;
  if (!found) throw new AdminError(404, 'not-found', 'No account has this id.');
  return found;
}

export function adminRouter(opts: AdminRouterOptions): RequestHandler {
  const { auth, token, log } = opts;
  const r = Router();
  let lastRefusalLogAt = 0;

  r.use((req: Request, res: Response, next: NextFunction) => {
    if (!adminRequestAdmitted(req, token)) {
      // A loopback caller without the right token is worth one line (at most once a minute) - never
      // the internet's requests, which are simply an unknown route.
      if (isLoopbackSocketAddress(req.socket?.remoteAddress) && !hasProxyHeaders(req)) {
        const now = Date.now();
        if (now - lastRefusalLogAt >= 60_000) {
          lastRefusalLogAt = now;
          log('admin: refused a loopback request without a valid admin token');
        }
      }
      next('router');
      return;
    }
    res.setHeader('X-Admin-Api', '1');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  r.get(
    '/status',
    wrap((_req, res) => {
      const owner = opts.ownerId();
      const body: AdminStatusResponse = {
        ok: true,
        version: APP_VERSION,
        accounts: auth.adminAccountCount(),
        openDiaries: auth.vaults.size,
        liveSessions: auth.sessions.size,
        registration: opts.registration(),
        ownerConfigured: !!owner && auth.adminAccount(owner) !== null,
      };
      log('admin: status read');
      res.json(body);
    }),
  );

  r.get(
    '/accounts',
    wrap((_req, res) => {
      const accounts = auth.adminAccounts();
      log(`admin: accounts listed (${accounts.length})`);
      const body: AdminListResponse = { accounts };
      res.json(body);
    }),
  );

  r.get(
    '/accounts/find',
    wrap((req, res) => {
      const params: Array<[AdminLookup, unknown]> = [
        ['username', req.query.username],
        ['email', req.query.email],
        ['any', req.query.q],
      ];
      const given = params.filter(([, v]) => v !== undefined);
      if (given.length !== 1 || typeof given[0][1] !== 'string' || !given[0][1].trim()) {
        throw new AdminError(400, 'bad-request', 'Give exactly one of username, email or q.');
      }
      const [by, value] = given[0] as [AdminLookup, string];
      const matches = auth.adminFindAccounts(by, value);
      log(`admin: account lookup (${plural(matches.length, 'match', 'matches')})`);
      const body: AdminFindResponse = { matches };
      res.json(body);
    }),
  );

  r.post(
    '/accounts/:id/delete',
    express.json({ limit: '4kb' }),
    wrap(async (req, res) => {
      const id = String(req.params.id ?? '');
      const account = accountOf(auth, id);
      const confirm = (req.body as { username?: unknown } | undefined)?.username;
      // The operator typed the username again; it must still be this account's (exactly).
      if (typeof confirm !== 'string' || confirm.normalize('NFC') !== account.username.normalize('NFC')) {
        throw new AdminError(409, 'username-mismatch', 'The username does not match this account; nothing was deleted.');
      }
      const deps = opts.deps();
      // As the account's own deletion: unowned settings are written down first (a failure deletes nothing).
      await pinUnownedSettings(deps);
      await auth.adminDeleteAccount(id);
      await releaseDeletedOwner(deps, id);
      const wasOwner = opts.ownerId() === id;
      log('admin: account deleted (1)');
      if (wasOwner) log('admin: the deleted account was the configured owner (DIARY_OWNER_ID) - the owner cards stay off until DIARY_OWNER_ID names an existing account');
      const body: AdminDeleteResponse = { deleted: true, wasOwner };
      res.json(body);
    }),
  );

  r.post(
    '/accounts/:id/revoke-sessions',
    wrap(async (req, res) => {
      const id = String(req.params.id ?? '');
      accountOf(auth, id);
      const revoked = await auth.adminRevokeSessions(id);
      log(`admin: sessions revoked (${revoked})`);
      const body: AdminRevokeResponse = { revoked };
      res.json(body);
    }),
  );

  r.post(
    '/accounts/:id/unlock',
    wrap((req, res) => {
      const id = String(req.params.id ?? '');
      accountOf(auth, id);
      const wasLocked = auth.adminUnlock(id);
      log('admin: account unlocked (1)');
      const body: AdminUnlockResponse = { unlocked: true, wasLocked };
      res.json(body);
    }),
  );

  // An admitted request for a path the API does not have.
  r.use((_req: Request, res: Response) => {
    const body: AdminErrorResponse = { error: 'unknown-route', message: 'The admin API has no such route.' };
    res.status(404).json(body);
  });

  // Errors of admitted requests only (a refused one never gets here).
  r.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AdminError) {
      const body: AdminErrorResponse = { error: err.code, message: err.message };
      res.status(err.status).json(body);
      return;
    }
    const parse = err as { type?: string };
    if (parse && (parse.type === 'entity.parse.failed' || parse.type === 'entity.too.large')) {
      const body: AdminErrorResponse = { error: 'bad-request', message: 'The request body is not a small JSON object.' };
      res.status(400).json(body);
      return;
    }
    if (isApiError(err) && err.status === 404) {
      const body: AdminErrorResponse = { error: 'not-found', message: 'No account has this id.' };
      res.status(404).json(body);
      return;
    }
    // Messages of the service are catalogue texts without personal data; the details go to stderr only.
    const message = isApiError(err) ? err.toBody('en').message : 'Internal error.';
    log(`admin: action failed (${isApiError(err) ? err.status : 500})`);
    if (!isApiError(err)) console.error('[diary-server] admin action failed:', err);
    const body: AdminErrorResponse = { error: 'failed', message };
    res.status(isApiError(err) && err.status >= 400 ? err.status : 500).json(body);
  });

  return r;
}
