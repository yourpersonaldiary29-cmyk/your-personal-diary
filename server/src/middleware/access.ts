/**
 * Request guards that need nothing from the operating system: loopback marking, the LAN guard,
 * CORS, security headers and the small rate limiter. Pure on purpose - the routes import this
 * module, and the same routes also run inside the Android build, where node:net / node:os do not
 * exist. The Host check of the desktop listeners (it needs both) lives in middleware/host-check.ts.
 */
import type { IncomingMessage } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import { APP_NAME } from '@shared/constants';
import { localeDef, t, type Locale } from '@shared/i18n';
import { ApiError } from '../errors';
import { localeOf } from './locale';

/** Origins allowed to call the API cross-origin: the Tauri desktop shell. */
export const ALLOWED_ORIGINS = new Set(['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost']);
/**
 * The Vite dev servers' origins, allowed only when the server runs with `--dev` (development
 * builds of the shell, `npm run server:dev`; the dev hosted server of README 5.2) - never in the
 * installed app or on the public server, where any other program could serve a page on that port.
 * Port 1420 is the desktop UI (`npm run dev` / `npx tauri dev`), 1430 the phone UI in a browser
 * (`npm run mobile:dev`: `--port 1430 --strictPort` in package.json).
 */
export const DEV_ORIGINS = new Set(['http://localhost:1420', 'http://127.0.0.1:1420', 'http://localhost:1430', 'http://127.0.0.1:1430']);
/**
 * Hosted mode (docs/HOSTED-PLAN.md 2.2): the desktop shell origins plus the Android WebView
 * (Capacitor: `https://localhost`) and the iOS scheme reserved for a later build. Authentication is
 * a bearer token the page must already hold, so CORS only decides who may read an answer.
 */
export const HOSTED_ORIGINS = new Set([...ALLOWED_ORIGINS, 'https://localhost', 'capacitor://localhost']);

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function isLoopbackAddress(ip: string | undefined): boolean {
  if (!ip) return false;
  return LOOPBACK.has(ip) || ip.startsWith('127.');
}

/** Marks `req.isLocal` based on the socket address (never on headers, which can be spoofed). */
export function markLocal(req: Request, _res: Response, next: NextFunction): void {
  req.isLocal = isLoopbackAddress(req.socket.remoteAddress);
  next();
}

// Hosted mode: the client address behind the platform's proxy (docs/HOSTED-PLAN.md 2.2, 2.3) ------

/** What every request of a hosted server carries (`req.hosted`); absent in local mode. */
export interface HostedRequestPolicy {
  /** 'x-forwarded-for' (the hop Express' `trust proxy` selects, via `req.ip`), a single-value header name, or undefined (socket address). */
  clientIpHeader?: string;
}

declare global {
  namespace Express {
    interface Request {
      /** Present on every request of a hosted server (markHosted); never set in local mode. */
      hosted?: HostedRequestPolicy;
    }
  }
}

/**
 * Hosted replacement of `markLocal`: behind the platform's proxy no request is "local" - the proxy
 * connects from a private address, and `req.isLocal` must be false even if it ever connected from
 * loopback (the local-only routes - account list, LAN switch, disk paths - have no meaning there).
 */
export function markHosted(policy: HostedRequestPolicy) {
  return function markHostedRequest(req: Request, _res: Response, next: NextFunction): void {
    req.isLocal = false;
    req.hosted = policy;
    next();
  };
}

/**
 * The address of the client. Local mode: the socket address (exactly what the limiters and
 * forgot-password used before). Hosted mode: `req.ip` for 'x-forwarded-for' (Express applies the
 * configured `trust proxy` hop count), the value of a single-value header the edge always
 * overwrites (Fly's `Fly-Client-IP`), or the socket address when no header is configured or the
 * header is missing (a direct health check from the platform).
 */
export function clientIp(req: Request): string {
  const header = req.hosted?.clientIpHeader;
  if (header === 'x-forwarded-for') return req.ip || req.socket.remoteAddress || 'unknown';
  if (header) {
    const raw = req.headers[header];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (value) return value;
  }
  return req.socket.remoteAddress || 'unknown';
}

/** Expands an IPv6 literal to its eight hextets (lower case, no leading zeros); null when it is not one. */
function ipv6Hextets(ip: string): string[] | null {
  let text = ip.toLowerCase();
  const zone = text.indexOf('%');
  if (zone >= 0) text = text.slice(0, zone);
  if (!text.includes(':')) return null;
  // An embedded IPv4 tail (::ffff:1.2.3.4) becomes two hextets.
  const v4 = /^(.*:)(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (v4) {
    const [, head, a, b, c, d] = v4;
    const n = [a, b, c, d].map(Number);
    if (n.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return null;
    text = `${head}${((n[0] << 8) | n[1]).toString(16)}:${((n[2] << 8) | n[3]).toString(16)}`;
  }
  const parts = text.split('::');
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  if (![...head, ...tail].every((h) => /^[0-9a-f]{1,4}$/.test(h))) return null;
  const missing = 8 - head.length - tail.length;
  if (parts.length === 2 ? missing < 1 : missing !== 0) return null;
  const all = [...head, ...Array<string>(parts.length === 2 ? missing : 0).fill('0'), ...tail];
  return all.map((h) => h.replace(/^0+(?=.)/, ''));
}

/**
 * The key the hosted limiters and the sign-in lockout count on (finding 9): the /64 prefix of an
 * IPv6 address (a client holding a whole /64 cannot rotate past a window), the address itself for
 * IPv4 (an IPv4-mapped IPv6 address counts as its IPv4). Anything unparseable is used as given.
 */
export function limiterKey(ip: string): string {
  if (!ip) return 'unknown';
  const hextets = ipv6Hextets(ip);
  if (!hextets) return ip;
  if (hextets.slice(0, 5).join(':') === '0:0:0:0:0' && hextets[5] === 'ffff') {
    const hi = parseInt(hextets[6], 16);
    const lo = parseInt(hextets[7], 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return `${hextets.slice(0, 4).join(':')}::/64`;
}

/**
 * The LAST value of `X-Forwarded-Proto` - the one the edge in front of us wrote - lower-cased; ''
 * when absent. Not Express' `req.protocol`, which takes the leftmost value and is only safe when
 * the edge overwrites the header.
 */
export function lastForwardedProto(req: Pick<IncomingMessage, 'headers'>): string {
  const raw = req.headers['x-forwarded-proto'];
  const text = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  if (!text) return '';
  const parts = text.split(',');
  return parts[parts.length - 1].trim().toLowerCase();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The HTML page answered to a browser on the LAN while phone access is off, in `locale`. */
export function lanDisabledPage(locale: Locale): string {
  const { dir } = localeDef(locale);
  return (
    `<!doctype html><html lang="${locale}" dir="${dir}"><meta charset="utf-8"><title>${escapeHtml(t(locale, 'server.lan.pageTitle'))} - ${escapeHtml(APP_NAME)}</title>` +
    `<body style="font-family:sans-serif;padding:2rem"><h1>${escapeHtml(t(locale, 'server.lan.heading'))}</h1>` +
    `<p>${escapeHtml(t(locale, 'server.lan.body'))}</p></body></html>`
  );
}

/**
 * True when the request arrived over TLS - i.e. through the remote-access HTTPS listener, the
 * only encrypted listener of the server (it exists only while remote access is on).
 */
export function isRemoteRequest(req: Pick<IncomingMessage, 'socket'>): boolean {
  return (req.socket as { encrypted?: boolean } | undefined)?.encrypted === true;
}

/**
 * True when the client reached us over TLS: the remote-access HTTPS listener (local mode), or - on
 * a hosted server only - the platform's TLS edge, which says so in the last `X-Forwarded-Proto`
 * hop. In local mode this equals `isRemoteRequest` exactly (forwarded headers are never trusted).
 */
export function isSecureRequest(req: Request): boolean {
  if (isRemoteRequest(req)) return true;
  return !!req.hosted && lastForwardedProto(req) === 'https';
}

/**
 * Blocks every non-loopback request while LAN access is disabled - except requests of the
 * remote-access HTTPS listener, which is its own opt-in (and serves the same app).
 * `isLanEnabled` is read on each request so toggling takes effect immediately.
 */
export function lanGuard(isLanEnabled: () => boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.isLocal || isLanEnabled() || isRemoteRequest(req)) return next();
    if (req.path.startsWith('/api')) return next(ApiError.lanDisabled());
    res.status(403).type('text/html; charset=utf-8').send(lanDisabledPage(localeOf(req)));
  };
}

/**
 * Minimal CORS: only the desktop shell origins (plus the dev server with `dev`); phones are
 * same-origin. Hosted mode passes `HOSTED_ORIGINS` (the shell origins + the Android WebView).
 */
export function corsFor(dev: boolean, origins: ReadonlySet<string> = ALLOWED_ORIGINS) {
  return (req: Request, res: Response, next: NextFunction): void => cors(req, res, next, dev, origins);
}

/** `corsFor(false)` - the production rule. */
export function cors(req: Request, res: Response, next: NextFunction, dev = false, origins: ReadonlySet<string> = ALLOWED_ORIGINS): void {
  const origin = req.header('origin');
  if (origin && (origins.has(origin) || (dev && DEV_ORIGINS.has(origin)))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept-Language');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    // Content-Disposition: the file name of a download; X-Entries-Exported: the entry count of an export download.
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Entries-Exported');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

/** HSTS value of the remote-access HTTPS listener: one year. */
export const HSTS_HEADER_VALUE = 'max-age=31536000';

/**
 * Security headers for the served UI. Everything is same-origin; no external resources ever.
 * Answers over HTTPS (remote access) also carry HSTS.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  if (isRemoteRequest(req)) res.setHeader('Strict-Transport-Security', HSTS_HEADER_VALUE);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  next();
}

/** HSTS value of a hosted server (every answer the TLS edge forwarded): one year, subdomains included. */
export const HOSTED_HSTS_HEADER_VALUE = 'max-age=31536000; includeSubDomains';

/**
 * Hosted additions to `securityHeaders` (2.2): HSTS on every answer that came through the TLS edge,
 * `Cache-Control: no-store` on the API, and a Permissions-Policy that turns the sensors off.
 * Installed only by the hosted composition, right after `securityHeaders`.
 */
export function hostedHeaders(req: Request, res: Response, next: NextFunction): void {
  if (isSecureRequest(req)) res.setHeader('Strict-Transport-Security', HOSTED_HSTS_HEADER_VALUE);
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

/**
 * Very small in-memory rate limiter for auth endpoints (per IP, sliding window). On a hosted server
 * the key is the address bucket of the real client (`limiterKey(clientIp(req))`); in local mode it
 * is the socket address, as it always was.
 */
export function rateLimit(maxPerMinute: number) {
  const hits = new Map<string, number[]>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.hosted ? limiterKey(clientIp(req)) : req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    // With remote access many addresses can call: forget the ones idle for a minute.
    if (hits.size > 1000) {
      for (const [k, times] of hits) if (!times.length || now - times[times.length - 1] >= 60_000) hits.delete(k);
    }
    const arr = (hits.get(key) || []).filter((t) => now - t < 60_000);
    if (arr.length >= maxPerMinute) {
      return next(ApiError.localized(429, 'FORBIDDEN', 'server.error.tooManyAttempts'));
    }
    arr.push(now);
    hits.set(key, arr);
    next();
  };
}

/**
 * Global cap (hosted mode, finding 8): at most `maxPerMinute` requests per minute through this
 * middleware from ALL callers together - the bound that holds even if per-address keying is ever
 * defeated. Same 429 as the per-address limiter. `now` is injectable for tests.
 */
export function globalRateLimit(maxPerMinute: number, now: () => number = Date.now) {
  let times: number[] = [];
  return (_req: Request, _res: Response, next: NextFunction) => {
    const t = now();
    if (times.length && t - times[0] >= 60_000) times = times.filter((x) => t - x < 60_000);
    if (times.length >= maxPerMinute) return next(ApiError.localized(429, 'FORBIDDEN', 'server.error.tooManyAttempts'));
    times.push(t);
    next();
  };
}
