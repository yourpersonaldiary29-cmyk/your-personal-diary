/**
 * Hosted composition (docs/HOSTED-PLAN.md Part B; docs/android-tasks/HOSTED-IMPL.md): the same
 * routes as the desktop server, assembled for ONE public server behind the platform's TLS proxy.
 *
 * What differs from server.ts (the desktop composition):
 *   - one plain-HTTP listener on `env.bind:env.port` (0.0.0.0:$PORT on the platform); no port
 *     probing, no LAN listener, no HTTPS of our own - TLS ends at the edge;
 *   - `createApp({ hosted })`: trust proxy, the public-host check, no LAN guard, no "local"
 *     requests, bucketed limits, the registration policy, the quota, the health extras;
 *   - NO remote access: this module never imports server/src/remote/** (hosted-import-graph.test.ts
 *     enforces it). `deps.remote` is a stub whose `info()` returns the public URL - that is what
 *     the reset links and `ServerInfo.remoteUrl` need - and whose commands answer 403;
 *   - the device key comes from the sealed `DIARY_DEVICE_KEY` when set (3.2);
 *   - the owner is `DIARY_OWNER_ID` only (2.3); mail settings stored by any other account are
 *     cleared at start;
 *   - the scrypt gate (5.4) and idle-vault eviction (3.7) are on;
 *   - the operator's loopback admin API (3.10, routes/admin.ts): /api/admin answers only a loopback
 *     socket that presents this boot's token from `<dataDir>/.admin-token` (hosted/admin-token.ts,
 *     rotated at every start, removed at a clean stop) - the one client is /app/admin.cjs;
 *   - the tour (POST /api/auth/guest) is public under strict limits (HOSTED-IMPL item 9, which
 *     supersedes plan 4c: tours per address bucket and hour, a cap of concurrent guests, a lifetime
 *     after which a guest ends by itself, nothing persisted; DIARY_MAX_GUESTS=0 unmounts it);
 *   - no disk paths (2.3).
 *
 * The only outbound connection of a hosted server is the SMTP host of the Mail card (5.8).
 * Prints one JSON line per lifecycle event to stdout, like server.ts.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ServerSettings } from '@shared/types';
import { createApp, type AppDeps } from './app';
import type { HostedEnv, ServerConfig } from './config';
import { ApiError } from './errors';
import { AdminToken, adminTokenPath } from './hosted/admin-token';
import { createArchiveController, type ArchiveOptions } from './hosted/archive';
import { createGuestGate, createRegistrationGate } from './hosted/policy';
import type { HostedAppOptions } from './hosted/types';
import { nodeSmtpTransport } from './mail/node-transport';
import { MailService, type MailServiceOptions } from './mail/service';
import type { SmtpTransport } from './mail/transport';
import { adminRouter } from './routes/admin';
import type { PasswordResetController } from './routes/auth';
import type { MailController, RemoteController } from './routes/server';
import { hostedHealth } from './routes/server-status';
import { createAuthService, type AuthServiceOptions, type DiaryAuthService } from './security/auth-service';
import { loadOrCreateDeviceKey } from './security/device-key';
import { configureKdfGate } from './security/kdf';
import { PasswordResetService, type PasswordResetOptions } from './security/password-reset';

/** Derivations allowed to wait for a slot of the scrypt gate (5.4). */
export const KDF_QUEUE = 32;

export function emitHosted(event: string, data: Record<string, unknown> = {}): void {
  process.stdout.write(JSON.stringify({ event, ...data }) + '\n');
}

export interface HostedStartOptions {
  /** Override the port of `env` (tests pass 0). */
  port?: number;
  /** Override the bind address of `env` (tests pass 127.0.0.1). */
  bind?: string;
  /** Do not print lifecycle events (tests). */
  quiet?: boolean;
  /** Log line sink (default: stderr). */
  log?: (line: string) => void;
  /** The owner id, read on every check (tests change it at runtime); default: `env.ownerId`. */
  ownerId?: () => string;
  /** SMTP conversation (tests: a capturing fake); default: the node:net / node:tls client. */
  mailTransport?: SmtpTransport;
  mail?: MailServiceOptions;
  /** Account service options (tests: cheaper scrypt, a clock, a fake sleep). */
  auth?: AuthServiceOptions;
  passwordReset?: PasswordResetOptions;
  /** Clock of the limiters (tests). */
  now?: () => number;
  /** Server archive options (tests: a cheaper KDF, no cooldown, a fake free-space probe). */
  archive?: Partial<Omit<ArchiveOptions, 'dataDir'>>;
  /** Where the per-boot admin token goes (tests); default: `env.adminTokenFile`, else `<dataDir>/.admin-token`. */
  adminTokenFile?: string;
}

export interface RunningHosted {
  port: number;
  /** `http://<bind>:<port>` of the listener (tests); the public address is `env.publicUrl`. */
  localUrl: string;
  config: ServerConfig;
  env: HostedEnv;
  auth: DiaryAuthService;
  mail: MailService;
  passwordReset: PasswordResetService;
  /** The registration policy (recent-count, limiter - tests). */
  registration: HostedAppOptions['registration'];
  /** This boot's admin token (its file and whether it is in force - tests). */
  adminToken: AdminToken;
  stop(): Promise<void>;
}

function listen(server: http.Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(() => resolve());
  });
}

/** The remote-access controller of a server that has none: the public URL, and 403 for every command. */
export function remoteStub(publicUrl: string): RemoteController {
  const unavailable = () => {
    throw ApiError.forbidden('server.remote.unavailable');
  };
  return {
    status: unavailable,
    update: async () => unavailable(),
    renew: async () => unavailable(),
    test: async () => unavailable(),
    settings: () => ({ enabled: false, hostname: '', tokenSet: false, publicPort: 443, upnp: false, staging: false }),
    // `enabled: true` + the public URL: resetLinkBase() builds https://<host>/#/reset-password links.
    info: () => ({ enabled: true, url: publicUrl }),
    ownerId: () => '',
    releaseOwner: async () => false,
    pinOwner: async () => false,
  };
}

export async function startHosted(config: ServerConfig, env: HostedEnv, opts: HostedStartOptions = {}): Promise<RunningHosted> {
  if (config.mode !== 'hosted') throw new Error('startHosted needs a configuration loaded with DIARY_MODE=hosted');
  const say = opts.quiet ? () => {} : emitHosted;
  const log = opts.log ?? (opts.quiet ? () => {} : (line: string) => console.error(`[diary-server] ${line}`));
  const now = opts.now ?? Date.now;
  const ownerId = opts.ownerId ?? (() => env.ownerId);

  // CPU gate before the first derivation (5.4).
  configureKdfGate({ concurrency: env.kdfConcurrency, queue: KDF_QUEUE });

  // The sealed secret when set; the file otherwise (never both).
  const deviceKey = loadOrCreateDeviceKey(config.deviceKeyFile, env.deviceKey);
  // The tour: many visitors at once, each ending by itself; off with DIARY_MAX_GUESTS=0.
  const tour = env.maxGuests > 0;
  const auth = await createAuthService(config, {
    deviceKey,
    vaultIdleMs: env.vaultIdleMinutes * 60_000,
    ...(tour ? { guests: { max: env.maxGuests, lifetimeMs: env.guestMinutes * 60_000 } } : {}),
    ...opts.auth,
  });
  const accountExists = (id: string) => auth.listAccounts().some((a) => a.id === id);

  const mail = new MailService({
    config,
    deviceKey,
    // The "first account" rule of the desktop becomes the configured owner here (2.3).
    firstAccountId: ownerId,
    transport: opts.mailTransport ?? nodeSmtpTransport,
    options: { log, ...opts.mail },
  });
  // Mail settings belong to the owner only: a stored owner that is somebody else (migrated data,
  // a changed owner id) or an account that no longer exists is released - its settings cleared.
  const storedMailOwner = mail.ownerId();
  const owner = ownerId();
  if (storedMailOwner && ((owner && storedMailOwner !== owner) || !accountExists(storedMailOwner))) {
    mail.releaseOwner(storedMailOwner);
    log('E-mail sending: the stored settings did not belong to the configured owner - sending e-mail is off and its settings were removed.');
  }
  mail.checkOwner();
  if (!owner) log('DIARY_OWNER_ID is not set: the owner cards (e-mail, server) are off for everyone until it names the owner account.');
  else if (!accountExists(owner)) log('DIARY_OWNER_ID names an account that does not exist on this server yet: the owner cards stay off.');

  const passwordReset = new PasswordResetService(auth, mail, { log, ...opts.passwordReset });
  const registration = createRegistrationGate({
    mode: env.registration,
    inviteCode: env.inviteCode,
    maxAccounts: env.maxAccounts,
    countAccounts: () => auth.listAccounts().length,
    now,
    log,
  });

  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  let port = opts.port ?? env.port;
  const bind = opts.bind ?? env.bind;
  const settings: ServerSettings = { port, lanEnabled: false };
  const mailController: MailController = mail;
  const resetController: PasswordResetController = passwordReset;
  // The operator's loopback admin API (3.10): its per-boot token is written once the port is known.
  const adminToken = new AdminToken(opts.adminTokenFile ?? adminTokenPath(config.dataDir, env.adminTokenFile));
  // `deps` is built below; the router reads it only while it handles a deletion.
  const admin = adminRouter({ auth, token: adminToken, deps: () => deps, ownerId, registration: () => env.registration, log });

  const hosted: HostedAppOptions = {
    publicHost: env.publicHost,
    // The owner's own domain (DIARY_EXTRA_HOSTS): accepted by the Host check, used by nothing else.
    extraHosts: env.extraHosts,
    publicUrl: env.publicUrl,
    trustProxy: env.trustProxy,
    ...(env.clientIpHeader ? { clientIpHeader: env.clientIpHeader } : {}),
    loginPerMinute: env.loginPerMinute,
    authGlobalPerMinute: env.authGlobalPerMinute,
    registration,
    ownerId,
    maxDiaryBytes: env.maxDiaryBytes,
    health: () => hostedHealth(config.dataDir, startedAtMs),
    minFreePct: env.minFreePct,
    metrics: () => ({ openVaults: auth.vaults.size, liveSessions: auth.sessions.size, guests: auth.guestCount }),
    // The encrypted server archive (WP-H8): written to <dataDir>/archive/, never served by the API.
    archive: createArchiveController({ dataDir: config.dataDir, log, ...opts.archive }),
    startedAt,
    debugRoutes: env.debugRoutes,
    // Offline sync: the ServerInfo flag; DIARY_OFFLINE_SYNC=0 hides it (the /api/sync routes stay).
    offlineSync: env.offlineSync,
    ...(tour ? { guests: createGuestGate({ perHour: env.guestsPerHour, max: env.maxGuests, lifetimeMinutes: env.guestMinutes, now, log }) } : {}),
    admin,
  };

  const deps: AppDeps & { remote: RemoteController; mail: MailController; passwordReset: PasswordResetController } = {
    config,
    auth,
    getServerSettings: () => ({ ...settings, port }),
    // The LAN switch has no meaning here; the route answers 403 before this is ever reached.
    setServerSettings: async () => {
      throw ApiError.forbidden('server.server.settingsLocalOnly');
    },
    getListenInfo: () => ({ port, lanUrls: [], startedAt }),
    remote: remoteStub(env.publicUrl),
    mail: mailController,
    passwordReset: resetController,
    // POST /api/auth/guest exists only while the tour is on (routes/auth.ts mounts it on this flag).
    guestAllowed: tour,
    hosted,
  };
  const app = createApp(deps);
  const server = http.createServer(app);
  await listen(server, port, bind);
  port = (server.address() as AddressInfo).port;
  // A new admin token for this boot, with the real port (the admin tool connects to 127.0.0.1:<port>).
  // A volume that refuses the write costs the admin tool only - the server itself serves on.
  try {
    adminToken.issue(port);
  } catch (e) {
    log(`admin: the admin token file could not be written (${(e as NodeJS.ErrnoException).code ?? 'error'}) - the admin tool is unavailable until the next start`);
  }
  say('listening', { port, mode: 'hosted', publicUrl: env.publicUrl, extraHosts: env.extraHosts.length, dataDir: config.dataDir, registration: env.registration, ownerConfigured: !!owner && accountExists(owner), tour, adminApi: adminToken.active });

  let stopped = false;
  return {
    port,
    localUrl: `http://${bind === '0.0.0.0' ? '127.0.0.1' : bind}:${port}`,
    config,
    env,
    auth,
    mail,
    passwordReset,
    registration,
    adminToken,
    stop: async () => {
      if (stopped) return;
      stopped = true;
      // The token of this boot opens nothing any more, and its file goes.
      adminToken.revoke();
      await closeServer(server);
      // Give e-mails being handed over a moment (each SMTP step has its own timeout anyway).
      await Promise.race([passwordReset.idle(), new Promise((r) => setTimeout(r, 3000).unref?.())]);
      await auth.shutdown();
      configureKdfGate(null);
      say('stopped');
    },
  };
}
