/**
 * What the Express app needs from the hosted composition (docs/HOSTED-PLAN.md Part B, section 2).
 * Pure types only: app.ts imports this file type-only, so the desktop and Android bundles carry
 * nothing of hosted mode. The objects behind the interfaces are built in server/src/hosted.ts
 * (and, in tests, in server/test/helpers.ts) from `HostedEnv`.
 */
import type { Request, RequestHandler } from 'express';
import type { ServerArchiveInfo, ServerArchiveResult } from '@shared/types';
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
   * Offline sync (docs/android-tasks/OFFLINE-DESIGN.md §3.2): `ServerInfo.offlineSync: 1` is reported
   * unless this is `false` (the kill switch `DIARY_OFFLINE_SYNC=0`). `/api/sync` stays mounted either
   * way, so outboxes that already exist can drain.
   */
  offlineSync?: boolean;
}
