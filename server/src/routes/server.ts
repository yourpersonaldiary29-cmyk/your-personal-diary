import { Router, type NextFunction, type Request, type Response } from 'express';
import { APP_VERSION } from '@shared/constants';
import { t, type Locale } from '@shared/i18n';
import type {
  MailSettingsView,
  MailTestResult,
  RemoteAccessSettings,
  RemoteStatus,
  RemoteTestResult,
  ServerInfo,
  ServerSettings,
} from '@shared/types';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';
import { hostedOwnerGate } from '../hosted/owner';
import { mailApiError, MAIL_NOT_CONFIGURED_KEY } from '../mail/errors';
import { isSecureRequest, rateLimit } from '../middleware/access';
import { ctxOf, requireAuth } from '../middleware/auth';
import { localeOf } from '../middleware/locale';
import { isGuestContext } from '../security/guest';
import { firstAccountId, settingsOwner } from '../security/owner';
import { storageHealth } from '../security/storage-health';

/**
 * GET  /api/server/info          -> ServerInfo (public: used by the login screen to show the phone URL)
 * GET  /api/server/settings      -> ServerSettings (auth; `remote` is the public view, never the token,
 *                                   and only for the account that owns remote access; `isRemoteOwner` /
 *                                   `isMailOwner` tell the signed-in account whether it owns them)
 * PUT  /api/server/settings      -> ServerSettings (auth + local request only; `remote`, `isRemoteOwner`
 *                                   and `isMailOwner` in the body are ignored)
 * GET  /api/server/remote        -> RemoteStatus (auth + local request only + owner)
 * PUT  /api/server/remote        -> RemoteStatus (auth + local request only + owner; body RemoteSettingsUpdate
 *                                   incl. the account password)
 * POST /api/server/remote/renew  -> RemoteStatus (auth + local request only + owner; forces a new certificate)
 * POST /api/server/remote/test   -> RemoteTestResult (auth + local request only + owner; optional { hostname?, duckdnsToken?, upnp? })
 * GET  /api/server/mail          -> MailSettingsView (auth + local request only + owner)
 * PUT  /api/server/mail          -> MailSettingsView (auth + local request only + owner; body MailSettingsUpdate
 *                                   incl. the account password)
 * POST /api/server/mail/test     -> MailTestResult (auth + local request only + owner; sends a test e-mail to
 *                                   the owner's own address)
 *
 * Ownership (security/owner.ts): remote access belongs to the owner of this computer's diary - the
 * account created first (earliest createdAt, ties: lowest id) - from the start, before anything is
 * configured. Settings saved earlier by another account keep that stored owner. Every
 * /api/server/remote* request of any other account answers 403 FORBIDDEN 'server.remote.notOwner',
 * also a first save. When the owner account is deleted its settings are cleared (releaseOwner), and
 * only then does the next-oldest account become the owner; settings stored without an owner are
 * written down as the first account's before that can happen (`pinUnownedSettings`), and a stored
 * owner that is not an account id is released like a deleted one. Every PUT - the first one included - must
 * carry the signed-in account's password, so an unlocked, signed-in window cannot silently point the
 * diary at another address. The mail settings (password reset by e-mail) follow exactly the same
 * rules with their own stored owner ('server.mail.notOwner', 'server.mail.passwordRequired',
 * 'server.mail.wrongPassword').
 *
 * The guest of the tour mode (mobile only, security/guest.ts) is never an owner - also while no
 * real account exists yet: it sees no owner flag and no `remote` block, and every /remote*, /mail*
 * and PUT /settings request of a guest answers 403 with the same "not the owner" messages.
 */

/** Catalogue key of the 403 answered when an account other than the owner of this computer changes phone access. */
export const LAN_NOT_OWNER_KEY = 'server.lan.notOwner';
/** 403 answered to every account but the one that owns remote access. */
export const REMOTE_NOT_OWNER_KEY = 'server.remote.notOwner';
/** 400 VALIDATION (field 'password') when a PUT /api/server/remote carries no password. */
export const REMOTE_PASSWORD_REQUIRED_KEY = 'server.remote.passwordRequired';
/** 400 WRONG_PASSWORD (field 'password') when that password is wrong - not 401, the session stays. */
export const REMOTE_WRONG_PASSWORD_KEY = 'server.remote.wrongPassword';

/** What the routes need from the remote-access manager (server/src/remote/manager.ts). */
export interface RemoteController {
  status(): RemoteStatus;
  /** Saves a settings patch for `actorId`, who must be the owner (checked again at write time; stored as the owner). */
  update(body: unknown, actorId: string): Promise<RemoteStatus>;
  renew(): Promise<RemoteStatus>;
  test(body?: unknown): Promise<RemoteTestResult>;
  settings(): RemoteAccessSettings;
  /** On and listening + the https address ('' when off). */
  info(): { enabled: boolean; url: string };
  /**
   * Id of the owner stored with the settings ('' while none is stored - the first account created
   * on this computer owns remote access then).
   */
  ownerId(): string;
  /**
   * The owner account is gone: remote access off (HTTPS closed, router mapping removed), and the
   * owner, saved DuckDNS token, name, public IP and certificate files forgotten (settings back to the
   * defaults). False when `userId` is not the stored owner (nothing changes).
   */
  releaseOwner(userId: string): Promise<boolean>;
  /**
   * Settings without a stored owner that have something set up are written down as the first
   * account's (so that deleting it clears them - `releaseOwner` needs a stored owner). True when it
   * wrote. Optional so that stub controllers of older tests still type-check; the server always has it.
   */
  pinOwner?(): Promise<boolean>;
}

/** 403 answered to every account but the one that owns the mail settings. */
export const MAIL_NOT_OWNER_KEY = 'server.mail.notOwner';
/** 400 VALIDATION (field 'password') when a PUT /api/server/mail carries no account password. */
export const MAIL_PASSWORD_REQUIRED_KEY = 'server.mail.passwordRequired';
/** 400 WRONG_PASSWORD (field 'password') when that password is wrong - not 401, the session stays. */
export const MAIL_WRONG_PASSWORD_KEY = 'server.mail.wrongPassword';

/** What the routes need from the mail service (server/src/mail/service.ts). */
export interface MailController {
  /** The settings as the owner sees them (never the SMTP password). */
  view(): MailSettingsView;
  /** Id of the owner stored with the settings ('' while none is stored - the first account owns them then). */
  ownerId(): string;
  /** True while password-reset e-mails can be sent. */
  ready(): boolean;
  /** Saves a settings patch for `actorId`, who must be the owner (checked again at write time; stored as the owner). */
  update(body: unknown, actorId: string): MailSettingsView;
  /** The owner account is gone: mail off and the settings forgotten. False when `userId` is not the stored owner. */
  releaseOwner(userId: string): boolean;
  /** Like `RemoteController.pinOwner`: unowned settings with something set up become the first account's. */
  pinOwner?(): boolean;
  /** Sends the test e-mail to `to`; throws SmtpError on failure. */
  sendTest(to: string, firstName: string, locale: Locale): Promise<void>;
}

/**
 * The app dependencies as the server builds them: `AppDeps` plus the remote controller and the mail
 * service. Apps built without them (older tests) answer the remote endpoints with 403
 * 'server.remote.unavailable' and the mail endpoints with 403 'server.mail.unavailable'.
 */
export type ServerRouterDeps = AppDeps & { remote?: RemoteController; mail?: MailController };

/**
 * Writes remote-access and mail settings that have no stored owner down as the first account's
 * (`pinOwner`). Settings like that come only from a file written before owners were stored; the
 * server pins them at startup, but when it started with no account yet, the first account owned them
 * only implicitly - and deleting it would then have handed them, uncleared, to the next account.
 * Called right after an account is registered and right before an account is deleted. Throws when a
 * write fails (the delete route then refuses to delete, so nothing is handed over uncleared).
 */
export async function pinUnownedSettings(deps: AppDeps): Promise<void> {
  const { remote, mail } = deps as ServerRouterDeps;
  await remote?.pinOwner?.();
  mail?.pinOwner?.();
}

/**
 * After account `userId` was deleted - by itself (POST /api/auth/delete-account) or by the operator
 * (the loopback admin API of a hosted server, routes/admin.ts): remote access it set up is turned off
 * (HTTPS closed, router port removed) and forgotten - owner, DuckDNS token, name and certificate - and
 * so are its mail settings (password reset by e-mail); only then does the next-oldest account own them
 * on a computer (security/owner.ts). On a hosted server nobody inherits anything: the owner is
 * DIARY_OWNER_ID alone. Best effort, never throws: the account is already gone, and an owner without an
 * account is released on the next remote / mail request or server start (until then nobody else can
 * see or save over its settings).
 */
export async function releaseDeletedOwner(deps: AppDeps, userId: string): Promise<void> {
  const { remote, mail } = deps as ServerRouterDeps;
  if (remote) {
    try {
      await remote.releaseOwner(userId);
    } catch (e) {
      console.error(`[diary-server] Remote access could not be released after deleting its owner: ${(e as Error).message}`);
    }
  }
  if (mail) {
    try {
      mail.releaseOwner(userId);
    } catch (e) {
      console.error(`[diary-server] The mail settings could not be released after deleting their owner: ${(e as Error).message}`);
    }
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

export function serverRouter(deps: AppDeps): Router {
  const r = Router();
  const remoteOf = (): RemoteController => {
    const remote = (deps as ServerRouterDeps).remote;
    if (!remote) throw ApiError.forbidden('server.remote.unavailable');
    return remote;
  };
  /** Remote access is configured only from the computer itself (socket address, never headers). */
  const localOnly = (req: Request) => {
    if (!req.isLocal) throw ApiError.forbidden('server.remote.localOnly');
  };

  // Ownership (security/owner.ts) ------------------------------------------------------------------
  const accountExists = (id: string) => deps.auth.listAccounts().some((a) => a.id === id);
  const firstAccount = () => firstAccountId(deps.auth.listAccounts());
  /**
   * Hosted mode (docs/HOSTED-PLAN.md 2.3, finding 6): the owner is `DIARY_OWNER_ID` and nothing
   * else - never the first or the next-oldest account. Null in local mode, where the rules below
   * stay exactly as they were.
   */
  const hostedOwner = deps.hosted ? hostedOwnerGate({ ownerId: deps.hosted.ownerId, accountExists }) : null;
  /**
   * Who owns a settings block that stores `stored` once a stored owner whose account is gone has been
   * released (the next /remote* or /mail* request of the computer does that): that stored owner
   * while its account exists, otherwise the first account. No side effects.
   */
  const ownerOnceReleased = (stored: string) => (stored && accountExists(stored) ? stored : firstAccount());

  r.get('/info', (req: Request, res: Response) => {
    const s = deps.getServerSettings();
    const li = deps.getListenInfo();
    // Local mode: the HTTPS listener of remote access. Hosted mode: the platform's TLS edge.
    const secure = isSecureRequest(req);
    const hosted = deps.hosted;
    // A hosted server has no remote access of its own; its public address plays that role for the
    // clients (the reset links, `remoteUrl`), but it is never reported as "remote access on".
    const remote = hosted ? { enabled: false, url: hosted.publicUrl } : ((deps as ServerRouterDeps).remote?.info() ?? { enabled: false, url: '' });
    const info: ServerInfo = {
      version: APP_VERSION,
      port: li.port,
      lanEnabled: s.lanEnabled,
      lanUrls: s.lanEnabled && !secure ? li.lanUrls : [],
      // Only reveal the data directory to the desktop (loopback) client.
      dataDir: req.isLocal ? deps.config.dataDir : '',
      isLocalRequest: !!req.isLocal,
      startedAt: li.startedAt,
      remoteEnabled: remote.enabled,
      // The public address is shown to the computer itself and to clients that already use it.
      remoteUrl: req.isLocal || secure ? remote.url : '',
      secure,
      passwordResetAvailable: (deps as ServerRouterDeps).mail?.ready() ?? false,
      ...(hosted && hostedOwner
        ? {
            mode: 'hosted' as const,
            publicUrl: hosted.publicUrl,
            storageOk: storageHealth().ok,
            registration: hosted.registration.mode,
            guestTour: !!hosted.guests,
            // Whether `DIARY_OWNER_ID` names an existing account - asked of the gate on every request,
            // never cached at start-up, so the Account card's ID row (docs/android-tasks/OWNER-ID-VISIBILITY.md)
            // disappears for everyone but the owner as soon as the variable is set and the machine restarted.
            ownerConfigured: hostedOwner.configured(),
          }
        : {}),
      // Offline sync (shared/sync.ts): hosted only, unless the kill switch DIARY_OFFLINE_SYNC=0 is set.
      ...(hosted && hosted.offlineSync !== false ? { offlineSync: 1 as const } : {}),
    };
    res.json(info);
  });

  /**
   * The server settings as the signed-in account may see them: `isRemoteOwner` / `isMailOwner` say
   * whether it owns remote access / the mail settings (the Settings page shows those cards to their
   * owner only), and `remote` is left out for everyone but the owner of remote access - also for
   * the next owner while a stored owner whose account is gone still has its settings (they are
   * cleared first). Changes nothing.
   */
  const visibleSettings = (req: Request, s: ServerSettings): ServerSettings => {
    const ctx = ctxOf(req);
    const userId = ctx.account.id;
    // A guest owns nothing, whatever the stored owners say.
    const guest = isGuestContext(ctx);
    const { remote, mail } = deps as ServerRouterDeps;
    if (hostedOwner) {
      // No remote access, no LAN switch on a public server; the Mail card belongs to the configured owner only.
      // `isServerOwner` (hosted only): the Server card (GET /api/server/status, POST /api/server/archive).
      const hostedView: ServerSettings = {
        ...s,
        isRemoteOwner: false,
        isMailOwner: !guest && !!mail && hostedOwner.isOwner(userId),
        isLanOwner: false,
        isServerOwner: !guest && hostedOwner.isOwner(userId),
      };
      delete hostedView.remote;
      return hostedView;
    }
    const remoteStored = remote?.ownerId() ?? '';
    const view: ServerSettings = {
      ...s,
      isRemoteOwner: !guest && !!remote && ownerOnceReleased(remoteStored) === userId,
      isMailOwner: !guest && !!mail && ownerOnceReleased(mail.ownerId()) === userId,
      isLanOwner: !guest && firstAccount() === userId,
    };
    if (guest || !remote || settingsOwner(remoteStored, firstAccount()) !== userId) delete view.remote;
    return view;
  };

  r.get('/settings', requireAuth(deps.auth), (req: Request, res: Response) => {
    res.json(visibleSettings(req, deps.getServerSettings()));
  });

  // PUT /api/server/settings { lanEnabled?, port?, password? }: phone access (the LAN listener) is the
  // owner's decision, like remote access and mail - only the first account created on this computer
  // (403 'server.lan.notOwner' otherwise), from the computer itself, and opening the diary to the
  // home network (turning it on, or another port) needs the account password. Turning it off does not.
  r.put('/settings', rateLimit(30), requireAuth(deps.auth), async (req: Request, res: Response, next) => {
    try {
      if (!req.isLocal) throw ApiError.forbidden('server.server.settingsLocalOnly');
      const ctx = ctxOf(req);
      if (isGuestContext(ctx) || firstAccount() !== ctx.account.id) throw ApiError.forbidden(LAN_NOT_OWNER_KEY);
      const body = (req.body ?? {}) as Partial<ServerSettings> & { password?: unknown };
      const current = deps.getServerSettings();
      const nextSettings: ServerSettings = {
        port: typeof body.port === 'number' && body.port > 0 && body.port < 65536 ? Math.floor(body.port) : current.port,
        lanEnabled: typeof body.lanEnabled === 'boolean' ? body.lanEnabled : current.lanEnabled,
      };
      const opens = nextSettings.lanEnabled && (!current.lanEnabled || nextSettings.port !== current.port);
      if (opens) {
        const password = typeof body.password === 'string' ? body.password : '';
        if (!password) throw ApiError.validation('server.auth.currentPasswordRequired', 'password');
        if (!(await deps.auth.verifyPassword(ctx.account, password))) {
          throw ApiError.localized(400, 'WRONG_PASSWORD', 'server.auth.wrongCurrentPassword', undefined, 'password');
        }
      }
      const saved = await deps.setServerSettings(nextSettings);
      res.json(visibleSettings(req, saved));
    } catch (e) {
      next(e);
    }
  });

  // Remote access -------------------------------------------------------------------------------
  const guard = requireAuth(deps.auth);

  /**
   * Common gate of the /remote* routes: the computer itself, remote access available, and the
   * signed-in account owns remote access - the stored owner, or while none is stored the first
   * account created on this computer. A stored owner whose account no longer exists is released
   * first (remote access off, its settings and token cleared) - otherwise nobody could ever manage
   * it again - and only then does the first account get in.
   */
  const ownerGate = async (req: Request): Promise<{ remote: RemoteController; userId: string }> => {
    // A hosted server has no remote access of its own (the platform's edge is the public address).
    if (hostedOwner) throw ApiError.forbidden('server.remote.unavailable');
    localOnly(req);
    const remote = remoteOf();
    // Before anything is released or compared: a guest is never the owner.
    if (isGuestContext(ctxOf(req))) throw ApiError.forbidden(REMOTE_NOT_OWNER_KEY);
    const userId = ctxOf(req).account.id;
    let stored = remote.ownerId();
    if (stored && !accountExists(stored)) {
      await remote.releaseOwner(stored);
      stored = remote.ownerId();
    }
    if (settingsOwner(stored, firstAccount()) !== userId) throw ApiError.forbidden(REMOTE_NOT_OWNER_KEY);
    return { remote, userId };
  };

  r.get(
    '/remote',
    guard,
    wrap(async (req, res) => {
      const { remote } = await ownerGate(req);
      res.json(remote.status());
    }),
  );

  r.put(
    '/remote',
    // The password check must not become a faster guessing oracle than /api/auth/verify-password.
    rateLimit(30),
    guard,
    wrap(async (req, res) => {
      const { remote, userId } = await ownerGate(req);
      const raw: unknown = req.body ?? {};
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw ApiError.validation('server.remote.badBody');
      const { password, ...patch } = raw as Record<string, unknown>;
      // Always required - also for the first setup - and checked before anything is validated or saved.
      if (typeof password !== 'string' || password === '') throw ApiError.validation(REMOTE_PASSWORD_REQUIRED_KEY, 'password');
      const ok = await deps.auth.verifyPassword(ctxOf(req).account, password);
      if (!ok) throw ApiError.localized(400, 'WRONG_PASSWORD', REMOTE_WRONG_PASSWORD_KEY, undefined, 'password');
      res.json(await remote.update(patch, userId));
    }),
  );

  r.post(
    '/remote/renew',
    guard,
    wrap(async (req, res) => {
      const { remote } = await ownerGate(req);
      res.json(await remote.renew());
    }),
  );

  r.post(
    '/remote/test',
    guard,
    wrap(async (req, res) => {
      const { remote } = await ownerGate(req);
      res.json(await remote.test(req.body ?? {}));
    }),
  );

  // Sending e-mail (password reset) --------------------------------------------------------------

  const mailOf = (): MailController => {
    const mail = (deps as ServerRouterDeps).mail;
    if (!mail) throw ApiError.forbidden('server.mail.unavailable');
    return mail;
  };

  /**
   * Common gate of the /mail* routes (same rules as remote access): the computer itself, and the
   * signed-in account owns the mail settings - the stored owner, or while none is stored the first
   * account. A stored owner whose account no longer exists is released first (its settings cleared).
   */
  const mailGate = (req: Request): { mail: MailController; userId: string } => {
    if (hostedOwner) {
      // Hosted: from anywhere over HTTPS, for the configured owner only (403 'server.owner.unset'
      // for everyone while none is configured). Settings stored by any other account - migrated
      // data, a changed owner id - are cleared first: nobody but the owner may hold the Mail card.
      if (!isSecureRequest(req)) throw ApiError.forbidden();
      const mail = mailOf();
      if (isGuestContext(ctxOf(req))) throw ApiError.forbidden(MAIL_NOT_OWNER_KEY);
      const userId = ctxOf(req).account.id;
      hostedOwner.assert(userId);
      const stored = mail.ownerId();
      if (stored && stored !== userId) mail.releaseOwner(stored);
      return { mail, userId };
    }
    if (!req.isLocal) throw ApiError.forbidden('server.mail.localOnly');
    const mail = mailOf();
    // Before anything is released or compared: a guest is never the owner.
    if (isGuestContext(ctxOf(req))) throw ApiError.forbidden(MAIL_NOT_OWNER_KEY);
    const userId = ctxOf(req).account.id;
    let stored = mail.ownerId();
    if (stored && !accountExists(stored)) {
      mail.releaseOwner(stored);
      stored = mail.ownerId();
    }
    if (settingsOwner(stored, firstAccount()) !== userId) throw ApiError.forbidden(MAIL_NOT_OWNER_KEY);
    return { mail, userId };
  };

  r.get(
    '/mail',
    guard,
    wrap((req, res) => {
      const { mail } = mailGate(req);
      res.json(mail.view());
    }),
  );

  r.put(
    '/mail',
    // The password check must not become a faster guessing oracle than /api/auth/verify-password.
    rateLimit(30),
    guard,
    wrap(async (req, res) => {
      const { mail, userId } = mailGate(req);
      const raw: unknown = req.body ?? {};
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw ApiError.validation('server.mail.badBody');
      const { password, ...patch } = raw as Record<string, unknown>;
      // Always required - also for the first setup - and checked before anything is validated or saved.
      if (typeof password !== 'string' || password === '') throw ApiError.validation(MAIL_PASSWORD_REQUIRED_KEY, 'password');
      const ok = await deps.auth.verifyPassword(ctxOf(req).account, password);
      if (!ok) throw ApiError.localized(400, 'WRONG_PASSWORD', MAIL_WRONG_PASSWORD_KEY, undefined, 'password');
      const view: MailSettingsView = mail.update(patch, userId);
      res.json(view);
    }),
  );

  r.post(
    '/mail/test',
    rateLimit(10),
    guard,
    wrap(async (req, res) => {
      const { mail } = mailGate(req);
      if (!mail.ready()) throw ApiError.validation(MAIL_NOT_CONFIGURED_KEY);
      const account = ctxOf(req).account;
      const to = account.email ?? '';
      if (!to) throw ApiError.validation('server.mail.ownerNoEmail');
      const locale = localeOf(req);
      try {
        await mail.sendTest(to, account.firstName, locale);
      } catch (e) {
        throw mailApiError(e);
      }
      const result: MailTestResult = { ok: true, sentTo: to, at: new Date().toISOString(), message: t(locale, 'server.mail.testSent', { address: to }) };
      res.json(result);
    }),
  );

  return r;
}
