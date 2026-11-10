/**
 * /api/auth - accounts and sessions (docs/API.md "חשבונות והתחברות", "איפוס סיסמה").
 *
 * Mounted without a guard because register/login/forgot-password/reset-password are public;
 * every other endpoint applies `requireAuth` itself. POST /guest (tour mode, security/guest.ts)
 * exists only in apps built with `deps.guestAllowed === true` - the mobile core and the hosted
 * server; on the desktop the route is not mounted at all (404). The guest it creates is refused (403
 * 'server.auth.guestNotAllowed') by everything that needs a real account: profile, password check,
 * lock, password change, account deletion. Error messages are catalogue keys
 * ('server.auth.*', 'server.reset.*', 'server.error.*') rendered in the request language by the
 * error middleware.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { isLocale, t, type Locale } from '@shared/i18n';
import type { AuthResponse, ForgotPasswordResponse, ResetPasswordResponse, SessionInfo, UserProfile } from '@shared/types';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';
import { MAIL_NOT_CONFIGURED_KEY } from '../mail/errors';
import { clientIp, isRemoteRequest, limiterKey } from '../middleware/access';
import { ctxOf, refuseGuest, requireAuth } from '../middleware/auth';
import { hasLocaleHeader, localeOf } from '../middleware/locale';
import { normalizeEmail } from '../security/accounts';
import { normalizeDeviceName, validateLoginBody, validateProfilePatch, validateRegisterBody } from '../security/auth-service';
import type { ForgotInput } from '../security/password-reset';
import { passwordProblemKey } from '../security/password-policy';
import { toAccountSummary, toSessionInfo, toUserProfile, type AccountRecord, type AccountSummary, type Session } from '../security/session-types';
import { pinUnownedSettings, releaseDeletedOwner, type ServerRouterDeps } from './server';

/** Catalogue key of the 403 answered to a non-loopback caller of GET /accounts. */
export const ACCOUNTS_LOCAL_ONLY_KEY = 'server.auth.accountsLocalOnly';
/** Catalogue key of the 403 answered to POST /register over the remote-access HTTPS listener. */
export const REGISTER_REMOTE_KEY = 'server.remote.registerRemote';
/**
 * Catalogue key of the 400 VALIDATION (field `privacyAccepted`) a hosted server answers to a registration
 * without the privacy checkbox. Worded for an older app that has no checkbox: it says to update the app.
 */
export const PRIVACY_REQUIRED_KEY = 'server.auth.privacyRequired';
/** The field of RegisterRequest that carries the privacy checkbox (and of the 400 above). */
export const PRIVACY_FIELD = 'privacyAccepted';
/**
 * Catalogue key of the 400 VALIDATION (field `termsAccepted`) a hosted server answers to a registration without
 * the Terms of Use (docs/apple-tasks/TERMS.md). The one checkbox of the form sends both flags, so only an app
 * built before the Terms of Use existed gets this answer: it says to update the app.
 */
export const TERMS_REQUIRED_KEY = 'server.auth.termsRequired';
/** The field of RegisterRequest that carries the Terms of Use (the same checkbox as the policy; the 400 above). */
export const TERMS_FIELD = 'termsAccepted';
/** The one answer of POST /forgot-password ("If this address is registered, we sent a link and a code to it."). */
export const RESET_SENT_KEY = 'server.reset.sent';
/** The answer of a successful POST /reset-password. */
export const RESET_DONE_KEY = 'server.reset.done';

/** What the routes need from the password-reset service (security/password-reset.ts). */
export interface PasswordResetController {
  request(input: ForgotInput): void;
  resetWithToken(token: string, newPassword: string, locale: Locale): Promise<AccountRecord | void>;
  resetWithCode(email: string, code: string, newPassword: string, locale: Locale): Promise<AccountRecord | void>;
  /** A notice to the previous address after the e-mail address of an account changed. */
  notifyEmailChanged?(account: AccountRecord, previousEmail: string, locale: Locale): void;
}

/** The dependencies as the server builds them (apps without a reset service answer 503 'server.mail.notConfigured'). */
export type AuthRouterDeps = ServerRouterDeps & { passwordReset?: PasswordResetController };

/**
 * Where the reset link points: the remote-access address while it is on (reachable from anywhere),
 * otherwise this computer (`http://127.0.0.1:<port>` - the server also serves the UI).
 */
export function resetLinkBase(deps: AppDeps): string {
  const remote = (deps as ServerRouterDeps).remote?.info();
  if (remote?.enabled && remote.url) return remote.url;
  return `http://127.0.0.1:${deps.getListenInfo().port}`;
}

/** One row of GET /accounts: the public summary plus the e-mail ('' for accounts registered before the field existed). */
export type AccountListItem = AccountSummary & { email: string };

export function toAccountListItem(a: AccountRecord): AccountListItem {
  return { ...toAccountSummary(a), email: a.email ?? '' };
}

function authResponse(token: string, session: Session, account: AccountRecord): AuthResponse {
  return {
    token,
    user: toUserProfile(account),
    expiresAt: session.expiresAt,
    rememberMe: session.rememberMe,
    ...(session.guest ? { guest: true } : {}),
  };
}

function bodyOf(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
}

function stringField(body: Record<string, unknown>, name: string): string {
  const v = body[name];
  return typeof v === 'string' ? v : '';
}

type Handler = (req: Request, res: Response) => Promise<void> | void;

/** Routes errors (sync and async) to the error handler. */
function wrap(fn: Handler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (e) {
      next(e);
    }
  };
}

export function authRouter(deps: AppDeps): Router {
  const r = Router();
  const guard = requireAuth(deps.auth);

  r.post(
    '/register',
    wrap(async (req, res) => {
      // New accounts are never created from the internet: the remote-access HTTPS listener is
      // for the owner's existing accounts (anyone who finds the public name could otherwise
      // create accounts - and files - on this computer). The computer itself and phones on the
      // home network (phone access) can still register. A hosted server is the opposite case -
      // registration from the internet is its purpose - and its own policy decides instead
      // (docs/HOSTED-PLAN.md 2.6: invite / closed / open, the per-address limiter, the account cap).
      if (!req.hosted && isRemoteRequest(req) && !req.isLocal) throw ApiError.forbidden(REGISTER_REMOTE_KEY);
      if (req.hosted) deps.hosted?.registration.check(req, bodyOf(req));
      const input = validateRegisterBody(bodyOf(req), localeOf(req));
      // The consent checkbox ("I have read the Privacy Policy and the Terms of Use, and I agree to them",
      // docs/android-tasks/PRIVACY-CHECKBOX.md, docs/apple-tasks/TERMS.md): the hosted server creates no
      // account without `privacyAccepted: true` AND `termsAccepted: true` (the one box sends both) - checked
      // after the fields, in the order of the form, where the box sits last; the policy first - and the
      // account records when and which versions (auth-service.ts). Local developer mode is unchanged:
      // neither field is required nor recorded there.
      if (req.hosted) {
        if (bodyOf(req)[PRIVACY_FIELD] !== true) throw ApiError.validation(PRIVACY_REQUIRED_KEY, PRIVACY_FIELD);
        if (bodyOf(req)[TERMS_FIELD] !== true) throw ApiError.validation(TERMS_REQUIRED_KEY, TERMS_FIELD);
        input.privacyAccepted = true;
        input.termsAccepted = true;
      }
      // The account starts in the language of the sign-up screen: the body's `language`, else the
      // Accept-Language the app sends with every request.
      if (!input.language && hasLocaleHeader(req)) input.language = localeOf(req);
      const { token, session, account } = await deps.auth.register(input);
      // When this is the first account, remote-access / mail settings stored without an owner become
      // its own now (security/owner.ts), so deleting it later clears them. Best effort: the account
      // exists already, and the delete route pins again before it deletes anything.
      try {
        await pinUnownedSettings(deps);
      } catch (e) {
        console.error(`[diary-server] Settings without an owner could not be given to the first account: ${(e as Error).message}`);
      }
      if (req.hosted) deps.hosted?.registration.registered();
      res.status(201).json(authResponse(token, session, account));
    }),
  );

  r.post(
    '/login',
    wrap(async (req, res) => {
      const input = validateLoginBody(bodyOf(req), localeOf(req));
      // Hosted mode: the lockout is keyed by the caller's address bucket (docs/HOSTED-PLAN.md 5.2).
      const { token, session, account } = await deps.auth.login(input, {
        fromNetwork: !req.isLocal,
        ...(req.hosted ? { bucket: limiterKey(clientIp(req)) } : {}),
      });
      res.json(authResponse(token, session, account));
    }),
  );

  // POST /api/auth/guest { deviceName?, language? } -> 201 AuthResponse with `guest: true`.
  // Tour mode: a temporary guest account with demo data that lives in memory only (nothing is ever
  // written to disk; security/guest.ts). Mounted ONLY for apps built with `guestAllowed` - the mobile
  // core and the hosted server (docs/android-tasks/HOSTED-IMPL.md item 9). The desktop server never
  // sets it, so there this route does not exist (404 like any unknown route). On a phone: local
  // requests only, like every other way of creating an account on this device. On a hosted server
  // the tour is public and its own gate limits it (tours per address bucket; the cap of concurrent
  // guests and the lifetime sit in the auth service).
  if (deps.guestAllowed === true) {
    r.post(
      '/guest',
      wrap(async (req, res) => {
        if (req.hosted) deps.hosted?.guests?.check(req);
        else if (!req.isLocal) throw ApiError.forbidden();
        if (!deps.auth.startGuest) throw ApiError.notFound('server.error.notFound.route');
        const body = bodyOf(req);
        const locale = localeOf(req);
        // Like a registration: the body's `language`, else the Accept-Language the app sends.
        const language = isLocale(body.language) ? body.language : hasLocaleHeader(req) ? locale : undefined;
        const { token, session, account } = await deps.auth.startGuest({
          deviceName: normalizeDeviceName(body.deviceName, language ?? locale),
          ...(language ? { language } : {}),
        });
        res.status(201).json(authResponse(token, session, account));
      }),
    );
  }

  // Password reset by e-mail. Public, and it works over the remote HTTPS address too: the link /
  // code proves that the caller reads the account's mailbox (registration stays local).
  const resetOf = (): PasswordResetController => {
    const reset = (deps as AuthRouterDeps).passwordReset;
    if (!reset) throw ApiError.localized(503, 'OTHER', MAIL_NOT_CONFIGURED_KEY);
    return reset;
  };

  // POST /api/auth/forgot-password { email } -> always 200 { ok, message } (no account enumeration)
  r.post(
    '/forgot-password',
    wrap((req, res) => {
      const reset = resetOf();
      const locale = localeOf(req);
      reset.request({
        email: stringField(bodyOf(req), 'email'),
        // The real client (behind the proxy of a hosted server); the socket address in local mode.
        ip: clientIp(req),
        locale,
        linkBase: resetLinkBase(deps),
      });
      const body: ForgotPasswordResponse = { ok: true, message: t(locale, RESET_SENT_KEY) };
      res.json(body);
    }),
  );

  // POST /api/auth/reset-password { token } | { email, code } + { newPassword, confirmPassword }
  r.post(
    '/reset-password',
    wrap(async (req, res) => {
      const reset = resetOf();
      const locale = localeOf(req);
      const body = bodyOf(req);
      const token = stringField(body, 'token').trim();
      const email = stringField(body, 'email').trim();
      const code = stringField(body, 'code').replace(/\s+/g, '');
      const newPassword = stringField(body, 'newPassword');
      const confirmPassword = stringField(body, 'confirmPassword');
      if (!token) {
        if (!email) throw ApiError.validation('server.reset.tokenOrCodeRequired', 'email');
        if (!code) throw ApiError.validation('server.reset.codeRequired', 'code');
      }
      // The new password is validated before the link / code is used up.
      if (!newPassword) throw ApiError.validation('server.auth.newPasswordRequired', 'newPassword');
      const problem = passwordProblemKey(newPassword);
      if (problem) throw ApiError.localized(400, 'WEAK_PASSWORD', problem.key, problem.params, 'newPassword');
      if (newPassword !== confirmPassword) throw ApiError.validation('server.auth.confirmMismatchNew', 'confirmPassword');
      const account = token ? await reset.resetWithToken(token, newPassword, locale) : await reset.resetWithCode(email, code, newPassword, locale);
      const answer: ResetPasswordResponse = { ok: true, message: t(locale, RESET_DONE_KEY), ...(account ? { username: account.username } : {}) };
      res.json(answer);
    }),
  );

  // Public, but only for the computer the server runs on: the login screen lists the accounts
  // registered here so the user picks a name instead of typing it. `req.isLocal` comes from the
  // socket address (markLocal), never from a header, so a phone on the LAN cannot ask for it.
  r.get(
    '/accounts',
    wrap((req, res) => {
      if (!req.isLocal) throw ApiError.forbidden(ACCOUNTS_LOCAL_ONLY_KEY);
      const accounts: AccountListItem[] = deps.auth.listAccounts().map(toAccountListItem);
      res.json({ accounts });
    }),
  );

  r.post(
    '/logout',
    guard,
    wrap(async (req, res) => {
      const ctx = ctxOf(req);
      await deps.auth.logout(ctx.session.id);
      res.status(204).end();
    }),
  );

  r.get(
    '/me',
    guard,
    wrap((req, res) => {
      const ctx = ctxOf(req);
      res.json({ user: ctx.user, session: toSessionInfo(ctx.session, ctx.session.id) });
    }),
  );

  // PUT /api/auth/profile { firstName?, lastName?, email?, currentPassword? } -> UserProfile
  // A new e-mail address needs the account password (400 VALIDATION / WRONG_PASSWORD on the field
  // 'currentPassword'), and the previous address gets a notice.
  r.put(
    '/profile',
    guard,
    refuseGuest,
    wrap(async (req, res) => {
      const ctx = ctxOf(req);
      const body = bodyOf(req);
      const patch = validateProfilePatch(body);
      const previousEmail = ctx.account.email ?? '';
      const account = await deps.auth.updateProfile(ctx, patch, stringField(body, 'currentPassword'));
      if (previousEmail && normalizeEmail(previousEmail) !== (account.emailLower ?? '')) {
        try {
          (deps as AuthRouterDeps).passwordReset?.notifyEmailChanged?.(account, previousEmail, localeOf(req));
        } catch (e) {
          console.error(`[diary-server] The e-mail change notice could not be queued: ${(e as Error).message}`);
        }
      }
      const user: UserProfile = toUserProfile(account);
      res.json(user);
    }),
  );

  // A guest (tour mode) has no password: 403 instead of a password check.
  r.post(
    '/verify-password',
    guard,
    refuseGuest,
    wrap(async (req, res) => {
      const ctx = ctxOf(req);
      const password = stringField(bodyOf(req), 'password');
      if (!password) throw ApiError.validation('server.auth.passwordRequired', 'password');
      const ok = await deps.auth.verifyPassword(ctx.account, password);
      // 401 WRONG_PASSWORD is the documented contract for the lock screen.
      if (!ok) throw ApiError.wrongPassword();
      // The right password also unlocks a locked session (lock screen).
      deps.auth.setSessionLocked(ctx.session.id, false);
      res.json({ ok: true });
    }),
  );

  // POST /api/auth/lock -> 204: the lock screen (Ctrl+L / auto-lock) locks this session on the
  // server too, so a reload or the bare token reveals nothing until the password is entered.
  // A guest session cannot be locked: no password could unlock it again (403).
  r.post(
    '/lock',
    guard,
    refuseGuest,
    wrap((req, res) => {
      const ctx = ctxOf(req);
      deps.auth.setSessionLocked(ctx.session.id, true);
      res.status(204).end();
    }),
  );

  r.post(
    '/change-password',
    guard,
    refuseGuest,
    wrap(async (req, res) => {
      const ctx = ctxOf(req);
      const body = bodyOf(req);
      const oldPassword = stringField(body, 'oldPassword');
      const newPassword = stringField(body, 'newPassword');
      const confirmPassword = stringField(body, 'confirmPassword');
      if (!oldPassword) throw ApiError.validation('server.auth.currentPasswordRequired', 'oldPassword');
      if (!newPassword) throw ApiError.validation('server.auth.newPasswordRequired', 'newPassword');
      if (newPassword !== confirmPassword) throw ApiError.validation('server.auth.confirmMismatchNew', 'confirmPassword');
      await deps.auth.changePassword(ctx, oldPassword, newPassword);
      res.json({ ok: true });
    }),
  );

  r.get(
    '/sessions',
    guard,
    wrap((req, res) => {
      const ctx = ctxOf(req);
      const list: SessionInfo[] = deps.auth.listSessions(ctx.account.id).map((s) => toSessionInfo(s, ctx.session.id));
      res.json(list);
    }),
  );

  r.delete(
    '/sessions/:id',
    guard,
    wrap(async (req, res) => {
      const ctx = ctxOf(req);
      const id = String(req.params.id ?? '');
      const removed = await deps.auth.revokeSession(ctx.account.id, id);
      if (!removed) throw ApiError.notFound('server.auth.sessionNotFound');
      res.status(204).end();
    }),
  );

  // A guest is not "deleted": it ends at logout (403 here, before anything else is touched).
  r.post(
    '/delete-account',
    guard,
    refuseGuest,
    wrap(async (req, res) => {
      const ctx = ctxOf(req);
      const password = stringField(bodyOf(req), 'password');
      if (!password) throw ApiError.validation('server.auth.passwordRequiredToDelete', 'password');
      // Settings stored without an owner belong to the first account only implicitly; write that
      // owner down first, so the release below clears them when the first account is the one being
      // deleted, instead of the next-oldest account inheriting them. Not best effort: when this
      // fails (500), nothing is deleted.
      await pinUnownedSettings(deps);
      await deps.auth.deleteAccount(ctx, password);
      // Remote access and mail settings set up by this account go with it - turned off and forgotten;
      // only then does the next-oldest account own them (security/owner.ts). Best effort: the account
      // is already gone. The operator's deletion (routes/admin.ts) does exactly the same.
      await releaseDeletedOwner(deps, ctx.account.id);
      res.status(204).end();
    }),
  );

  return r;
}
