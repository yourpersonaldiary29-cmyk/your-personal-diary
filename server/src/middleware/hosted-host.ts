/**
 * Host check of hosted mode (docs/HOSTED-PLAN.md Part B 2.2): behind the platform's TLS proxy the
 * server answers to its primary public name (DIARY_PUBLIC_URL) plus the optional extra names of
 * DIARY_EXTRA_HOSTS (docs/android-tasks/DUCKDNS-HOST.md), so a request whose Host header is anything
 * else is answered 421 Misdirected Request - the same JSON / page as the desktop's host check
 * (middleware/host-check.ts).
 * `GET /api/health` is exempt: the platform's health check addresses the container directly, not
 * through the public name.
 *
 * Pure on purpose (no node:net / node:os): app.ts installs it, and app.ts is also compiled into the
 * Android core. `hostOf` lives here and host-check.ts re-exports it.
 */
import type { NextFunction, Request, Response } from 'express';
import { APP_NAME } from '@shared/constants';
import { localeDef, negotiateLocale, t } from '@shared/i18n';
import type { ApiErrorBody } from '@shared/types';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The host part of a Host header ('Example.org:443' -> 'example.org', '[::1]:80' -> '::1'); '' when missing. */
export function hostOf(header: string | undefined): string {
  const h = (header ?? '').trim().toLowerCase();
  if (!h) return '';
  if (h.startsWith('[')) {
    const end = h.indexOf(']');
    return end > 0 ? h.slice(1, end) : '';
  }
  const colon = h.indexOf(':');
  const name = colon >= 0 && h.indexOf(':', colon + 1) < 0 ? h.slice(0, colon) : h;
  return name.endsWith('.') ? name.slice(0, -1) : name;
}

/**
 * The whole authority of a Host header, lower-cased and without a trailing dot on the name:
 * 'Example.org' -> 'example.org', 'example.org:8443' -> 'example.org:8443'. Compared with
 * `HostedEnv.publicHost`, which `URL.host` built the same way (default ports dropped).
 */
export function authorityOf(header: string | undefined): string {
  const h = (header ?? '').trim().toLowerCase();
  if (!h) return '';
  if (h.startsWith('[')) {
    const end = h.indexOf(']');
    if (end < 0) return '';
    return h.slice(0, end + 1) + h.slice(end + 1).replace(/^\.(?=:|$)/, '');
  }
  const colon = h.indexOf(':');
  if (colon >= 0 && h.indexOf(':', colon + 1) < 0) {
    const name = h.slice(0, colon).replace(/\.$/, '');
    return `${name}${h.slice(colon)}`;
  }
  return h.replace(/\.$/, '');
}

/**
 * True when `hostHeader` names one of `accepted` - lower-cased authorities, each matched with or
 * without the scheme's default port. The set is the primary public host plus the extra hosts of
 * `DIARY_EXTRA_HOSTS` (the owner's own domain); X-Forwarded-Host is never consulted.
 */
export function isAcceptedHost(hostHeader: string | undefined, accepted: ReadonlySet<string>): boolean {
  const authority = authorityOf(hostHeader);
  if (!authority) return false;
  if (accepted.has(authority)) return true;
  // 'host:443' for https (or 'host:80' when the public URL is a plain loopback one) equals 'host'.
  const stripped = authority.replace(/:(?:443|80)$/, '');
  return stripped !== authority && accepted.has(stripped);
}

/** True when `hostHeader` names the public host - with or without the scheme's default port. */
export function isPublicHost(hostHeader: string | undefined, publicHost: string): boolean {
  return isAcceptedHost(hostHeader, new Set([publicHost]));
}

/** Answers 421 (JSON under /api, a small page otherwise) in the request language. */
export function sendMisdirected(req: Request, res: Response): void {
  const header = req.headers['accept-language'];
  const locale = negotiateLocale(Array.isArray(header) ? header.join(',') : header);
  res.status(421);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Connection', 'close');
  if ((req.originalUrl ?? req.url ?? '').startsWith('/api')) {
    const body: ApiErrorBody = { code: 'FORBIDDEN', message: t(locale, 'server.remote.misdirected.body') };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
    return;
  }
  const { dir } = localeDef(locale);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.end(
    `<!doctype html><html lang="${locale}" dir="${dir}"><meta charset="utf-8"><title>${escapeHtml(t(locale, 'server.remote.misdirected.title'))} - ${escapeHtml(APP_NAME)}</title>` +
      `<body style="font-family:sans-serif;padding:2rem"><h1>${escapeHtml(t(locale, 'server.remote.misdirected.title'))}</h1>` +
      `<p>${escapeHtml(t(locale, 'server.remote.misdirected.body'))}</p></body></html>`,
  );
}

/** The one path the platform's health check may reach without the public Host. */
export const HEALTH_PATH = '/api/health';

/**
 * Express middleware, first in the hosted chain: only the public host, an extra host of
 * `DIARY_EXTRA_HOSTS` (docs/android-tasks/DUCKDNS-HOST.md: the owner's own domain) and
 * `GET /api/health` get through; everything else is 421 before any route, guard or body parser runs.
 * The host changes nothing downstream - reset links, HSTS, CSP and CORS do not look at it.
 */
export function hostedHostCheck(publicHost: string, extraHosts: readonly string[] = []) {
  const accepted: ReadonlySet<string> = new Set([publicHost, ...extraHosts].map((h) => h.toLowerCase()));
  return (req: Request, res: Response, next: NextFunction): void => {
    if (isAcceptedHost(req.headers.host, accepted)) return next();
    if (req.method === 'GET' && (req.path === HEALTH_PATH || req.path === `${HEALTH_PATH}/`)) return next();
    sendMisdirected(req, res);
  };
}
