/**
 * What the Express app needs from the hosted composition (docs/HOSTED-PLAN.md Part B, section 2).
 * Pure types only: app.ts imports this file type-only, so the desktop and Android bundles carry
 * nothing of hosted mode. The objects behind the interfaces are built in server/src/hosted.ts
 * (and, in tests, in server/test/helpers.ts) from `HostedEnv`.
 */
import type { Request, RequestHandler } from 'express';
import type { Locale } from '@shared/i18n';
import type { ServerArchiveInfo, ServerArchiveResult, ServerDiskChange, ServerDiskInfo } from '@shared/types';
import type { ServerDownloadPlatform, ServerDownloadResult, ServerDownloads, ServerDownloadUploadTicket } from '@shared/types';
import type { AppPlatform, AppUpdateInfo, ServerAppUpdate } from '@shared/types';
import type { RegistrationMode } from '../config';

/** The health answers of hosted mode (3.6). `strict` is what the external uptime monitor polls. */
export interface HostedHealth {
  ok: boolean;
  version: string;
  mode: 'hosted';
  uptimeSec: number;
  storage: 'ok' | 'degraded';
  /** Free space of the data volume in whole percent; null when it could not be measured. */
  freePct: number | null;
}

/** Registration policy of 2.6 (open / invite / closed, the per-bucket limiter, the account cap). */
export interface RegistrationGate {
  readonly mode: RegistrationMode;
  /** Hard ceiling of accounts (`DIARY_MAX_ACCOUNTS`). */
  readonly maxAccounts: number;
  /**
   * Runs before `AuthService.register`: counts the attempt against the caller's address bucket and
   * throws the 429 / 403 / 400 / 503 of the policy. `body` is the parsed register body (the invite
   * code travels in it as `inviteCode`).
   */
  check(req: Request, body: Record<string, unknown>): void;
  /** Records a successful registration (the 24 h counter shown in the Server card, 2.6). */
  registered(): void;
  /** Registrations in the last 24 hours. */
  recentCount(): number;
}

/**
 * The tour on a hosted server (docs/android-tasks/HOSTED-IMPL.md item 9: `POST /api/auth/guest` is
 * public, under strict limits). The gate counts tours per address bucket; the cap of concurrent
 * guests and their lifetime are enforced inside the auth service (`AuthServiceOptions.guests`) and
 * are carried here only for the owner's Server card.
 */
export interface GuestGate {
  /** Tours one address bucket may start per hour. */
  readonly perHour: number;
  /** Concurrent guests the server keeps (503 'server.auth.guestsFull' beyond it). */
  readonly max: number;
  /** Minutes a tour lives before the server ends it by itself. */
  readonly lifetimeMinutes: number;
  /** Runs before `AuthService.startGuest`: counts the attempt and throws 429 'server.auth.tooManyGuests' over the limit. */
  check(req: Request): void;
}

/**
 * The encrypted server archive of WP-H8 (docs/android-tasks/SERVER-CARD.md, plan 3.3), built by
 * server/src/hosted/archive.ts in the hosted composition only - so neither the desktop sidecar nor
 * the Android core bundle carries the archive writer. The route (routes/server-status.ts) checks
 * HTTPS, the owner, the account password and the passphrase before it calls `create`.
 */
export interface ArchiveController {
  /** The archives on the volume, newest first (at most `keep`). Never throws. */
  list(): ServerArchiveInfo[];
  /** Bytes an archive would hold right now; null when the data directory cannot be read. */
  dataBytes(): Promise<number | null>;
  /** Milliseconds until the next archive may start (the 1-per-10-minutes limit); 0 = now. */
  cooldownRemainingMs(): number;
  /** True while an archive is being written. */
  busy(): boolean;
  /**
   * Writes a new archive under `passphrase` (already validated by the route) and keeps the 2 newest.
   * Throws 429 'server.archive.tooSoon' (with Retry-After) inside the cooldown or while another one
   * runs, 507 'server.archive.noSpace' when free space < 1.2 x the data, 500 'server.archive.failed'
   * when writing fails (the partial file is removed).
   */
  create(passphrase: string): Promise<ServerArchiveResult>;
}

/** A change the route may start: the volume and the sizes (checked by `DiskController.plan`). */
export interface DiskPlan {
  volumeId: string;
  fromGb: number;
  toGb: number;
}

/**
 * The disk button of the Server card (docs/server-tasks/SERVER-CARD-V2.md Part B2), built by
 * server/src/hosted/disk.ts in the hosted composition only - so neither the desktop sidecar nor the
 * Android core carries it or the Fly API client. The routes (routes/server-disk.ts) check HTTPS, the
 * owner and the account password; everything else is checked here. Errors are `ApiError`s with the
 * keys of hosted/disk-errors.ts.
 */
export interface DiskController {
  /** `GET /api/server/disk`. Never throws: what Fly answers becomes `available` / `reason`. */
  info(): Promise<ServerDiskInfo>;
  /**
   * Before the password (no call to Fly, no password attempt): 409 the reason when the button is not set
   * up, 409 'server.disk.busy' / 'server.disk.restartFirst' while a change is open, 429 the daily limit.
   */
  assertCanStart(): void;
  /**
   * Checks the size (400: a whole number, at most the maximum, larger than the size Fly reports now - read
   * afresh; 502 / 503 when Fly cannot say) and returns the change to start.
   */
  plan(sizeGb: unknown): Promise<DiskPlan>;
  /**
   * Starts the change - checked and claimed in one synchronous step, so of two requests only one starts
   * (the other gets the 409 / 429 of `assertCanStart`) - and returns it (the 202 body). The e-mails about
   * it are written in `locale`.
   */
  start(plan: DiskPlan, locale: Locale): ServerDiskChange;
  /** Before the password: 409 'server.disk.noRestartNeeded' unless the change waits for a restart. */
  assertCanRestart(): void;
  /** The state 'restarting', and Fly is asked to restart this machine right after the answer (the 202 body). */
  restart(): ServerDiskChange;
}

/** A checked upload intent (`DownloadsController.checkIntent`): what the token will allow. */
export interface DownloadIntent {
  platform: ServerDownloadPlatform;
  version: string;
  removeOlder: boolean;
}

/** A checked removal (`DownloadsController.checkRemove`). */
export interface DownloadTarget {
  platform: ServerDownloadPlatform;
  version: string;
}

/** Where and how the e-mail about a publication or a removal goes: the owner's own account address, in his language. */
export interface DownloadNotice {
  /** '' when the account has no address (nothing is sent; the answer says 'noAddress'). */
  to: string;
  firstName: string;
  locale: Locale;
}

/**
 * The files of the Downloads page, managed in the Server card (docs/server-tasks/SERVER-CARD-V2.md Part A), built by
 * server/src/hosted/downloads.ts in the hosted composition only. The routes (routes/server-downloads.ts) check HTTPS,
 * the owner and the account password; everything else is checked here. Errors are `ApiError`s with the keys of
 * hosted/downloads-errors.ts.
 */
export interface DownloadsController {
  /**
   * The public side, mounted by app.ts before the static files: GET / HEAD /about/files/<name> (a listed name only:
   * the uploaded file or the image's; 404 for anything else) and the 20 Downloads pages with the merged list. Every
   * other request passes on.
   */
  site: RequestHandler;
  /** `GET /api/server/downloads`; `ownerEmail` = the owner's account address ('' = none). */
  list(ownerEmail: string): ServerDownloads;
  /** Before the password: the body (platform, version, removeOlder, bytes), not listed yet, not busy, the daily limit, room. */
  checkIntent(body: Record<string, unknown>): DownloadIntent;
  /** After the password: a one-time upload token for `sessionId` (it replaces any earlier one). */
  issueToken(intent: DownloadIntent, sessionId: string): ServerDownloadUploadTicket;
  /** Receives the file of `PUT /api/server/downloads/upload/<token>`, checks it, publishes it (the 201 body). */
  upload(req: Request, token: string, sessionId: string, notice: DownloadNotice): Promise<ServerDownloadResult>;
  /** Before the password: the body, and that the platform and version is listed (404 otherwise). */
  checkRemove(body: Record<string, unknown>): DownloadTarget;
  /** After the password: takes the file off the page (the 200 body). */
  remove(target: DownloadTarget, notice: DownloadNotice): Promise<ServerDownloadResult>;
}

/** A checked change of a required-update rule (`AppUpdateController.checkChange`): before the password. */
export interface AppUpdateChange {
  platform: AppPlatform;
  /** The oldest version that may still be used, or null: the rule goes off. */
  minVersion: string | null;
}

/**
 * The required update (app version 1.1.0), built by server/src/hosted/app-update.ts in the hosted composition only:
 * one rule per platform on the data volume (<dataDir>/site/app-update.json), in the owner's hands. The routes
 * (routes/server-app-update.ts) check HTTPS, the owner and the account password; everything else is checked here.
 */
export interface AppUpdateController {
  /** `ServerInfo.appUpdate`: the platforms whose rule is on (with the store link where the site has one); undefined while none is. Never throws, never reads the disk. */
  info(): AppUpdateInfo | undefined;
  /**
   * Mounted by app.ts on /api/auth before the auth router: answers 503 UPDATE_REQUIRED to a session route
   * (GET /me, POST /login, /register, /guest) of an app version before 1.1.0 - an app origin without
   * CLIENT_MARK_HEADER - while the rule of that origin's platform is on. Every other request passes on untouched.
   * Never throws, never reads the disk.
   */
  refuseOld: RequestHandler;
  /** `GET /api/server/app-update`; `ownerEmail` = the owner's account address ('' = none). */
  view(ownerEmail: string): ServerAppUpdate;
  /** Before the password: the body's platform and version (a.b.c, not above the server's own; null = off). */
  checkChange(body: Record<string, unknown>): AppUpdateChange;
  /** After the password: saves the change (atomically), sends the owner's e-mail, returns the new view (the 200 body). */
  change(change: AppUpdateChange, notice: DownloadNotice): Promise<ServerAppUpdate>;
}

export interface HostedAppOptions {
  /** Lower-cased host (with a non-default port) of DIARY_PUBLIC_URL: the accepted Host header (with `extraHosts`). */
  publicHost: string;
  /**
   * Further accepted Host names (`DIARY_EXTRA_HOSTS`, docs/android-tasks/DUCKDNS-HOST.md: the owner's
   * own domain; lower-cased, no port). Absent or empty = the primary host only. Nothing else looks at
   * them: HSTS, CSP, CORS, reset links and `ServerInfo.publicUrl` keep `publicHost` / `publicUrl`.
   */
  extraHosts?: readonly string[];
  /** The public origin (scheme + host) - the base of reset links and `ServerInfo.publicUrl`. */
  publicUrl: string;
  /** Express `trust proxy` hop count. */
  trustProxy: number;
  /** Where the client address comes from (2.2); undefined = the socket address. */
  clientIpHeader?: string;
  /** Per-bucket limit of /api/auth requests per minute (local mode keeps 30). */
  loginPerMinute: number;
  /** Global cap of /api/auth requests per minute, all callers together. */
  authGlobalPerMinute: number;
  /** Registration policy (WP-H2). */
  registration: RegistrationGate;
  /**
   * The one owner account of the hosted server (`DIARY_OWNER_ID`), read on every call so a test can
   * change it; '' = nobody owns anything (owner routes answer 403 'server.owner.unset').
   */
  ownerId: () => string;
  /** Per-account quota on the diary image in bytes (0 = off). */
  maxDiaryBytes: number;
  /** Health answers (3.6); without it the plain `{ ok, version }` of local mode is served. */
  health?: () => HostedHealth;
  /** `/api/health/strict` answers 503 below this much free space (percent; `DIARY_MIN_FREE_PCT`). */
  minFreePct?: number;
  /**
   * The tour (`POST /api/auth/guest`) and its per-bucket limit; absent = the route is not mounted
   * (404, as on the desktop). The composition sets it together with `AppDeps.guestAllowed`.
   */
  guests?: GuestGate;
  /** Process counters for the Server card (open diaries, live sessions, tour guests). */
  metrics?: () => { openVaults: number; liveSessions: number; guests: number };
  /**
   * The server archive (WP-H8). Absent = `POST /api/server/archive` answers 403
   * 'server.archive.unavailable' and the Server card lists no archives (test apps built by hand).
   */
  archive?: ArchiveController;
  /**
   * The disk button of the Server card (docs/server-tasks/SERVER-CARD-V2.md Part B). Absent =
   * `/api/server/disk*` answer 403 'server.disk.unavailable' (test apps built by hand).
   */
  disk?: DiskController;
  /**
   * The files of the Downloads page (docs/server-tasks/SERVER-CARD-V2.md Part A). Absent = `/api/server/downloads*`
   * answer 403 'server.downloads.unavailable' and the site's pages and installers are the static files as built.
   */
  downloads?: DownloadsController;
  /**
   * The required update (app version 1.1.0). Absent = `/api/server/app-update` answers 403 'server.appUpdate.unavailable',
   * `ServerInfo.appUpdate` is never set and no request is refused (test apps built by hand).
   */
  appUpdate?: AppUpdateController;
  /** When the server started (ISO); defaults to the listen info's `startedAt`. */
  startedAt?: string;
  /** Mounts /api/debug/proxy and /api/debug/crash (staging only). */
  debugRoutes?: boolean;
  /**
   * The operator's loopback admin API (routes/admin.ts, docs/HOSTED-PLAN.md 3.10), built by the hosted
   * composition and mounted at /api/admin before everything else - the Host check included. It answers
   * only a loopback socket with this boot's admin token and no proxy headers; every other request passes
   * through untouched and gets the 404 (or 421) of an unknown route. Absent = no admin API.
   */
  admin?: RequestHandler;
  /**
   * The contact form of the public site (docs/site-tasks/SITE.md section 5), built by the hosted
   * composition (hosted/contact.ts) and mounted at /api/contact behind the Host check and the security
   * headers. It brings its own form parser (64 KB, this route only), needs no session and sets no
   * cookie; it answers `POST /api/contact` with a 303 into the site and passes every other request on
   * to the 404 of an unknown route. Absent = no such route (the local server; test apps built by hand).
   */
  contact?: RequestHandler;
  /**
   * Offline sync (docs/android-tasks/OFFLINE-DESIGN.md §3.2): `ServerInfo.offlineSync: 1` is reported
   * unless this is `false` (the kill switch `DIARY_OFFLINE_SYNC=0`). `/api/sync` stays mounted either
   * way, so outboxes that already exist can drain.
   */
  offlineSync?: boolean;
}
