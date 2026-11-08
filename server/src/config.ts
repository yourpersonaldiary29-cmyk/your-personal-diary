import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DEFAULT_PORT } from '@shared/constants';
import type { ServerSettings } from '@shared/types';
import { bundleDir } from './util/paths';

/**
 * Runtime configuration of the local server.
 *
 * Command line:  node server.cjs --data-dir <dir> [--port <n>] [--static <distDir>] [--dev]
 * Environment:   DIARY_DATA_DIR, DIARY_PORT, DIARY_STATIC_DIR
 *
 * Layout of `dataDir`:
 *   accounts.json          user registry (password verifiers; the recovery copy of each diary key wrapped with device.key)
 *   server-settings.json   { port, lanEnabled, remote: { enabled, hostname, duckdnsTokenEnc, publicPort, upnp, staging },
 *                            mail: { enabled, host, port, security, username, passwordEnc, fromAddress, ownerUserId } }
 *                          (the DuckDNS token and the SMTP password encrypted with device.key; remote/settings.ts, mail/settings.ts)
 *   resets.json            pending password-reset links / codes (hashes only; security/resets.ts)
 *   device.key             random 32 bytes used to wrap "remember me" and recovery keys (created on demand)
 *   sessions.json          persisted "remember me" sessions (token hashes + wrapped keys)
 *   users/<userId>.mpd     encrypted diary database of each account
 *   users/<userId>.mpd.prev previous version kept for crash safety
 *   tls/                   remote access only: ACME account key, certificate key + chain (remote/tls-store.ts)
 */
export interface ServerConfig {
  dataDir: string;
  usersDir: string;
  accountsFile: string;
  settingsFile: string;
  deviceKeyFile: string;
  sessionsFile: string;
  /** Directory with the built frontend (`dist`) to serve to phones. Optional. */
  staticDir: string | null;
  /** Directory with bundled assets (fonts, sql-wasm.wasm). */
  assetsDir: string;
  preferredPort: number;
  dev: boolean;
  /**
   * `local` (the desktop sidecar, LAN and remote access - everything as it always was) or `hosted`
   * (docs/HOSTED-PLAN.md Part B: one public server behind the platform's TLS proxy, selected only by
   * `DIARY_MODE=hosted`). Absent means `local`; nothing in local mode reads it.
   */
  mode?: ServerMode;
}

export type ServerMode = 'local' | 'hosted';

export function defaultDataDir(): string {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'com.mydiary.app');
}

function argValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx >= 0 && idx + 1 < argv.length) return argv[idx + 1];
  const pref = `${name}=`;
  const found = argv.find((a) => a.startsWith(pref));
  return found ? found.slice(pref.length) : undefined;
}

export function loadConfig(argv: string[] = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const dataDir = path.resolve(argValue(argv, '--data-dir') || env.DIARY_DATA_DIR || defaultDataDir());
  const portRaw = argValue(argv, '--port') || env.DIARY_PORT;
  const preferredPort = portRaw ? Number(portRaw) : DEFAULT_PORT;
  const staticRaw = argValue(argv, '--static') || env.DIARY_STATIC_DIR || null;
  const assetsRaw = argValue(argv, '--assets') || env.DIARY_ASSETS_DIR || null;
  // When bundled (server.cjs) assets live next to the bundle; in dev they are in src-tauri/resources/server.
  const here = bundleDir();
  const assetsDir = assetsRaw
    ? path.resolve(assetsRaw)
    : fs.existsSync(path.join(here, 'fonts'))
      ? here
      : path.resolve(here, '../../src-tauri/resources/server');
  const cfg: ServerConfig = {
    dataDir,
    usersDir: path.join(dataDir, 'users'),
    accountsFile: path.join(dataDir, 'accounts.json'),
    settingsFile: path.join(dataDir, 'server-settings.json'),
    deviceKeyFile: path.join(dataDir, 'device.key'),
    sessionsFile: path.join(dataDir, 'sessions.json'),
    staticDir: staticRaw ? path.resolve(staticRaw) : null,
    assetsDir,
    preferredPort: Number.isFinite(preferredPort) && preferredPort > 0 ? preferredPort : DEFAULT_PORT,
    dev: argv.includes('--dev') || env.NODE_ENV === 'development',
    mode: env.DIARY_MODE === 'hosted' ? 'hosted' : 'local',
  };
  fs.mkdirSync(cfg.usersDir, { recursive: true });
  return cfg;
}

// Hosted mode (docs/HOSTED-PLAN.md Part B 2.1, docs/android-tasks/HOSTED-IMPL.md) -----------------

/** `DIARY_REGISTRATION`: who may create an account on the hosted server. */
export type RegistrationMode = 'open' | 'invite' | 'closed';

/**
 * Everything hosted mode reads from the environment, validated once at start (`loadHostedEnv`).
 * Values are plain data: the composition (hosted.ts) turns them into the limiters, the device key
 * and the owner rule. `deviceKey` and `inviteCode` are secrets - never log or print this object.
 */
export interface HostedEnv {
  /** `DIARY_PUBLIC_URL`, normalised: scheme + lower-cased host (+ port), no path, no trailing slash. */
  publicUrl: string;
  /** Host part of `publicUrl` (lower case, with the port when it is not the scheme's default). */
  publicHost: string;
  /**
   * `DIARY_EXTRA_HOSTS` (docs/android-tasks/DUCKDNS-HOST.md): further host names the Host check
   * accepts next to `publicHost` - the owner's own domain, served by the platform's TLS edge. Lower-
   * cased DNS names without a port; [] when unset. Nothing else reads them: reset links, HSTS, CSP,
   * CORS and `ServerInfo.publicUrl` keep the primary public URL.
   */
  extraHosts: string[];
  /** Port to listen on: `PORT`, else `DIARY_PORT`, else 8080. */
  port: number;
  /** Interface to bind: `0.0.0.0` (the platform's proxy connects from the private network); tests pass `DIARY_BIND=127.0.0.1`. */
  bind: string;
  /** `DIARY_TRUST_PROXY` / `TRUST_PROXY` hop count for Express' `trust proxy` (default 1). */
  trustProxy: number;
  /** `DIARY_CLIENT_IP_HEADER`: 'x-forwarded-for' (via `req.ip`) or a single-value header such as 'fly-client-ip'; undefined = the socket address. */
  clientIpHeader?: string;
  /** `DIARY_OWNER_ID`: the one owner account ('' = owner cards off for everyone). */
  ownerId: string;
  registration: RegistrationMode;
  /** `DIARY_INVITE_CODE` (secret; '' when unset). */
  inviteCode: string;
  maxAccounts: number;
  maxDiaryBytes: number;
  vaultIdleMinutes: number;
  kdfConcurrency: number;
  loginPerMinute: number;
  authGlobalPerMinute: number;
  /** `DIARY_DEVICE_KEY` decoded (exactly 32 bytes), or undefined to use `<dataDir>/device.key`. Secret. */
  deviceKey?: Buffer;
  minFreePct: number;
  debugRoutes: boolean;
  logLevel: 'info' | 'warn';
  /**
   * The tour (docs/android-tasks/HOSTED-IMPL.md item 9): `DIARY_MAX_GUESTS` concurrent guests
   * (0 = `POST /api/auth/guest` is not mounted), each ended after `DIARY_GUEST_MINUTES`, at most
   * `DIARY_GUESTS_PER_HOUR` tours per address bucket and hour.
   */
  maxGuests: number;
  guestMinutes: number;
  guestsPerHour: number;
  /**
   * Offline sync (docs/android-tasks/OFFLINE-DESIGN.md §3.2, §11): `DIARY_OFFLINE_SYNC=0` is the kill
   * switch - `ServerInfo.offlineSync` disappears, so clients stop creating offline work, while
   * `/api/sync` keeps answering so queued changes drain. Unset or `1` = on.
   */
  offlineSync: boolean;
  /**
   * `DIARY_ADMIN_TOKEN_FILE`: where the per-boot token of the loopback admin API is written (an
   * absolute path; docs/HOSTED-PLAN.md 3.10). Unset = `<dataDir>/.admin-token`, which is also where the
   * operator tool (/app/admin.cjs) looks by default.
   */
  adminTokenFile?: string;
}

export const HOSTED_DEFAULTS = {
  port: 8080,
  trustProxy: 1,
  maxAccounts: 300,
  maxDiaryBytes: 10 * 1024 * 1024,
  vaultIdleMinutes: 30,
  kdfConcurrency: 2,
  loginPerMinute: 10,
  authGlobalPerMinute: 300,
  minFreePct: 10,
  maxGuests: 20,
  guestMinutes: 30,
  guestsPerHour: 3,
} as const;

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function intEnv(env: NodeJS.ProcessEnv, name: string, fallback: number, min = 0): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) throw new Error(`${name} must be a whole number >= ${min}`);
  return n;
}

/**
 * Parses and validates `DIARY_PUBLIC_URL`: `https://host[:port]` with no path, query or fragment -
 * the primary Host the hosted server answers to (`DIARY_EXTRA_HOSTS` may add further names, see
 * `parseExtraHosts`) and the base of every reset link. Plain `http:` is
 * accepted for loopback hosts only (local smoke tests of the hosted bundle).
 */
export function parsePublicUrl(raw: string | undefined): { publicUrl: string; publicHost: string } {
  const text = (raw ?? '').trim();
  if (!text) throw new Error('DIARY_PUBLIC_URL is required in hosted mode (https://<host>)');
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error('DIARY_PUBLIC_URL is not a valid URL');
  }
  const loopback = LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('DIARY_PUBLIC_URL must use https:// (http:// is allowed for 127.0.0.1 / localhost only)');
  }
  if ((url.pathname && url.pathname !== '/') || url.search || url.hash || url.username || url.password) {
    throw new Error('DIARY_PUBLIC_URL must be the origin only: no path, query, fragment or credentials');
  }
  // `URL.host` keeps a non-default port and lower-cases the name; that is exactly the Host header value.
  const publicHost = url.host.toLowerCase();
  return { publicUrl: `${url.protocol}//${publicHost}`, publicHost };
}

/** One DNS label: letters, digits and inner hyphens, 1-63 characters (punycode `xn--` labels included). */
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Parses `DIARY_EXTRA_HOSTS` (docs/android-tasks/DUCKDNS-HOST.md): the host names the hosted server
 * answers to NEXT TO `DIARY_PUBLIC_URL` - the owner's own domain (and its `www`), for which the
 * platform's edge terminates TLS. Comma-separated DNS names only: each entry is trimmed and
 * lower-cased, a trailing dot is dropped, empty entries and duplicates are ignored. A scheme, a path,
 * a query, credentials, a port or an IP address fails fast - the message names the variable and the
 * entry's position, never its text (like every other hosted env check). Unset or empty = no extra host.
 */
export function parseExtraHosts(raw: string | undefined): string[] {
  const text = (raw ?? '').trim();
  if (!text) return [];
  const hosts: string[] = [];
  text.split(',').forEach((entry, index) => {
    const value = entry.trim().toLowerCase();
    if (!value) return;
    const at = `DIARY_EXTRA_HOSTS entry ${index + 1}`;
    if (value.includes('://')) throw new Error(`${at} must be a bare host name, without a scheme`);
    if (/[/?#]/.test(value)) throw new Error(`${at} must be a bare host name, without a path, query or fragment`);
    if (value.includes('@')) throw new Error(`${at} must be a bare host name, without credentials`);
    if (value.startsWith('[')) throw new Error(`${at} must be a DNS host name, not an IP address`);
    if (value.includes(':')) throw new Error(`${at} must be a bare host name, without a port (the TLS edge serves 443)`);
    const name = value.endsWith('.') ? value.slice(0, -1) : value;
    const labels = name.split('.');
    if (!name || name.length > 253 || !labels.every((label) => HOST_LABEL.test(label))) {
      throw new Error(`${at} is not a DNS host name (letters, digits, hyphens and dots only)`);
    }
    if (/^\d+$/.test(labels[labels.length - 1])) throw new Error(`${at} must be a DNS host name, not an IP address`);
    if (!hosts.includes(name)) hosts.push(name);
  });
  return hosts;
}

/** `DIARY_DEVICE_KEY`: base64 of exactly 32 bytes. Throws without echoing the value. */
export function parseDeviceKeyEnv(raw: string | undefined): Buffer | undefined {
  const text = (raw ?? '').trim();
  if (!text) return undefined;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) throw new Error('DIARY_DEVICE_KEY must be base64');
  const bytes = Buffer.from(text, 'base64');
  if (bytes.length !== 32) throw new Error('DIARY_DEVICE_KEY must decode to exactly 32 bytes');
  return bytes;
}

/** Reads the hosted-mode environment (2.1). Throws a plain Error naming the variable at fault - never its value. */
export function loadHostedEnv(env: NodeJS.ProcessEnv = process.env): HostedEnv {
  if (env.DIARY_MODE !== 'hosted') throw new Error('DIARY_MODE=hosted is required to start the hosted server');
  const { publicUrl, publicHost } = parsePublicUrl(env.DIARY_PUBLIC_URL);
  const extraHosts = parseExtraHosts(env.DIARY_EXTRA_HOSTS);
  const registrationRaw = (env.DIARY_REGISTRATION ?? 'open').trim().toLowerCase();
  if (registrationRaw !== 'open' && registrationRaw !== 'invite' && registrationRaw !== 'closed') {
    throw new Error('DIARY_REGISTRATION must be open, invite or closed');
  }
  const inviteCode = (env.DIARY_INVITE_CODE ?? '').trim();
  if (registrationRaw === 'invite' && !inviteCode) throw new Error('DIARY_REGISTRATION=invite needs DIARY_INVITE_CODE');
  const clientIpHeaderRaw = (env.DIARY_CLIENT_IP_HEADER ?? '').trim().toLowerCase();
  if (clientIpHeaderRaw && !/^[a-z0-9-]+$/.test(clientIpHeaderRaw)) throw new Error('DIARY_CLIENT_IP_HEADER is not a header name');
  const ownerId = (env.DIARY_OWNER_ID ?? '').trim();
  if (ownerId && !/^[A-Za-z0-9_-]{1,64}$/.test(ownerId)) throw new Error('DIARY_OWNER_ID is not an account id');
  const logLevel = (env.DIARY_LOG_LEVEL ?? 'info').trim().toLowerCase();
  if (logLevel !== 'info' && logLevel !== 'warn') throw new Error('DIARY_LOG_LEVEL must be info or warn');
  const portRaw = env.PORT || env.DIARY_PORT;
  const port = portRaw ? Number(portRaw) : HOSTED_DEFAULTS.port;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a port number');
  const bind = (env.DIARY_BIND ?? '0.0.0.0').trim() || '0.0.0.0';
  const offlineSyncRaw = (env.DIARY_OFFLINE_SYNC ?? '').trim();
  if (offlineSyncRaw !== '' && offlineSyncRaw !== '0' && offlineSyncRaw !== '1') throw new Error('DIARY_OFFLINE_SYNC must be 0 or 1');
  const adminTokenFile = (env.DIARY_ADMIN_TOKEN_FILE ?? '').trim();
  if (adminTokenFile && !path.isAbsolute(adminTokenFile)) throw new Error('DIARY_ADMIN_TOKEN_FILE must be an absolute path');
  return {
    publicUrl,
    publicHost,
    extraHosts,
    port,
    bind,
    trustProxy: intEnv(env, 'DIARY_TRUST_PROXY', intEnv(env, 'TRUST_PROXY', HOSTED_DEFAULTS.trustProxy)),
    ...(clientIpHeaderRaw ? { clientIpHeader: clientIpHeaderRaw } : {}),
    ownerId,
    registration: registrationRaw,
    inviteCode,
    maxAccounts: intEnv(env, 'DIARY_MAX_ACCOUNTS', HOSTED_DEFAULTS.maxAccounts),
    maxDiaryBytes: intEnv(env, 'DIARY_MAX_DIARY_BYTES', HOSTED_DEFAULTS.maxDiaryBytes),
    vaultIdleMinutes: intEnv(env, 'DIARY_VAULT_IDLE_MINUTES', HOSTED_DEFAULTS.vaultIdleMinutes),
    kdfConcurrency: intEnv(env, 'DIARY_KDF_CONCURRENCY', HOSTED_DEFAULTS.kdfConcurrency, 1),
    loginPerMinute: intEnv(env, 'DIARY_LOGIN_PER_MINUTE', HOSTED_DEFAULTS.loginPerMinute, 1),
    authGlobalPerMinute: intEnv(env, 'DIARY_AUTH_GLOBAL_PER_MINUTE', HOSTED_DEFAULTS.authGlobalPerMinute, 1),
    ...(env.DIARY_DEVICE_KEY ? { deviceKey: parseDeviceKeyEnv(env.DIARY_DEVICE_KEY) } : {}),
    minFreePct: intEnv(env, 'DIARY_MIN_FREE_PCT', HOSTED_DEFAULTS.minFreePct),
    debugRoutes: env.DIARY_DEBUG_ROUTES === '1',
    logLevel,
    maxGuests: intEnv(env, 'DIARY_MAX_GUESTS', HOSTED_DEFAULTS.maxGuests),
    guestMinutes: intEnv(env, 'DIARY_GUEST_MINUTES', HOSTED_DEFAULTS.guestMinutes, 1),
    guestsPerHour: intEnv(env, 'DIARY_GUESTS_PER_HOUR', HOSTED_DEFAULTS.guestsPerHour, 1),
    offlineSync: offlineSyncRaw !== '0',
    ...(adminTokenFile ? { adminTokenFile } : {}),
  };
}

/** The whole server-settings.json object ({} when missing or unreadable). */
export function readRawServerSettings(cfg: ServerConfig): Record<string, unknown> {
  try {
    const raw = JSON.parse(fs.readFileSync(cfg.settingsFile, 'utf8')) as unknown;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Replaces server-settings.json atomically (tmp file + rename). */
export function writeRawServerSettings(cfg: ServerConfig, raw: Record<string, unknown>): void {
  fs.mkdirSync(cfg.dataDir, { recursive: true });
  const tmp = `${cfg.settingsFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(raw, null, 2), 'utf8');
  fs.renameSync(tmp, cfg.settingsFile);
}

/**
 * Port + LAN switch. The remote-access block of the same file is read by
 * `remote/settings.ts` (it needs the device key to decrypt the DuckDNS token).
 */
export function readServerSettings(cfg: ServerConfig): ServerSettings {
  const defaults: ServerSettings = { port: cfg.preferredPort, lanEnabled: false };
  const raw = readRawServerSettings(cfg) as Partial<ServerSettings>;
  return {
    port: typeof raw.port === 'number' && raw.port > 0 && raw.port < 65536 ? raw.port : defaults.port,
    lanEnabled: raw.lanEnabled === true,
  };
}

/**
 * Saves port + LAN switch and keeps every other key of the file (the `remote` block with the
 * encrypted token is owned by remote/settings.ts; a `remote` view in `settings` is ignored).
 */
export function writeServerSettings(cfg: ServerConfig, settings: ServerSettings): void {
  const raw = readRawServerSettings(cfg);
  raw.port = settings.port;
  raw.lanEnabled = settings.lanEnabled;
  writeRawServerSettings(cfg, raw);
}
