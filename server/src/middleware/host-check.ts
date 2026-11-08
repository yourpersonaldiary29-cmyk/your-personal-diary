/**
 * Host check of the desktop listeners (remote-access hardening, DNS-rebinding guard). Split from
 * middleware/access.ts because it needs node:net (IP literals) and node:os (the names and addresses
 * of this computer): only server.ts - the desktop composition - imports it, never a route.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import net from 'node:net';
import os from 'node:os';
import { APP_NAME } from '@shared/constants';
import { localeDef, negotiateLocale, t } from '@shared/i18n';
import type { ApiErrorBody } from '@shared/types';
import { hostOf } from './hosted-host';

// The host part of a Host header: implemented in the pure hosted-host.ts (hosted mode needs it
// without node:net / node:os); re-exported here so existing importers keep working.
export { hostOf } from './hosted-host';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


/** What the host check needs to know: whether remote access is on, and its public name. */
export interface HostPolicy {
  enabled: boolean;
  hostname: string;
}

function isLanOrLoopbackIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1') return true;
    if (v.startsWith('::ffff:')) return isLanOrLoopbackIp(v.slice(7));
    return /^f[cd][0-9a-f]{2}:/.test(v) || /^fe[89ab][0-9a-f]:/.test(v);
  }
  return false;
}

/** This computer's own name ('desktop-1234') and its mDNS form ('desktop-1234.local'), lower-cased. */
function ownNames(): Set<string> {
  const name = os.hostname().trim().toLowerCase();
  return name ? new Set([name, `${name}.local`]) : new Set();
}

/** This computer's own interface addresses (a machine directly on a public IP still reaches itself). */
function ownAddresses(): Set<string> {
  const out = new Set<string>();
  for (const addrs of Object.values(os.networkInterfaces())) for (const a of addrs ?? []) out.add(a.address.toLowerCase());
  return out;
}

/**
 * True when `hostHeader` names this server: the remote-access hostname (pass '' while remote access
 * is off), localhost (and *.localhost), a loopback / LAN IP literal, one of this computer's own
 * addresses, or this computer's own name. A name controlled by someone else (DNS rebinding) is not.
 */
export function isAllowedHost(hostHeader: string | undefined, hostname: string): boolean {
  const host = hostOf(hostHeader);
  if (!host) return false;
  if (hostname && host === hostname.toLowerCase()) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (net.isIP(host)) return isLanOrLoopbackIp(host) || ownAddresses().has(host);
  return ownNames().has(host);
}

/**
 * Pre-app guard of every listener (loopback, LAN, HTTPS), ALWAYS - also while remote access is
 * off: a request whose Host header does not name this server is answered 421 Misdirected Request
 * - JSON for /api, a small page otherwise. That stops scanners hitting the public IP and, above
 * all, DNS-rebinding pages: a web page on an attacker's name that re-points its name at 127.0.0.1
 * reaches the loopback listener from the user's own browser (so `req.isLocal` is true) - but its
 * Host header still carries the attacker's name. The remote-access name counts only while remote
 * access is on. Works on plain node objects because it runs before Express.
 */
export function hostCheck(getPolicy: () => HostPolicy) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const policy = getPolicy();
    if (isAllowedHost(req.headers.host, policy.enabled ? policy.hostname : '')) return next();
    const header = req.headers['accept-language'];
    const locale = negotiateLocale(Array.isArray(header) ? header.join(',') : header);
    res.statusCode = 421;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'close');
    if ((req.url ?? '').startsWith('/api')) {
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
  };
}
