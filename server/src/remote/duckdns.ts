/**
 * DuckDNS client (https://www.duckdns.org/spec.jsp) - node:https only, via ./http.ts.
 *
 *   update IP : GET https://www.duckdns.org/update?domains=<sub>&token=<token>&ip=[<ip>]&verbose=true
 *   TXT       : GET https://www.duckdns.org/update?domains=<sub>&token=<token>&txt=<value>&verbose=true
 *   clear TXT : GET https://www.duckdns.org/update?domains=<sub>&token=<token>&txt=removed&clear=true&verbose=true
 *
 * The answer is 'OK' or 'KO' (verbose adds lines: the IPv4 / TXT value, the IPv6, UPDATED|NOCHANGE).
 * The token travels only in the query string of these https requests; it is never logged and is
 * removed from every error text.
 */
import { errorText, isKeyedDetail, type KeyedDetail } from './errors';
import { httpRequest, responseText } from './http';

export const DUCKDNS_BASE_URL = 'https://www.duckdns.org';
export const DUCKDNS_SUFFIX = '.duckdns.org';

export interface DuckDnsOptions {
  /** Base URL override (tests: a local mock). */
  baseUrl?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface DuckDnsResult {
  /** True when DuckDNS answered 'OK'. 'KO' means a wrong token or a domain of another account. */
  ok: boolean;
  /** The IPv4 address (update) or the TXT value (setTxt) DuckDNS reports now; null when absent. */
  value: string | null;
  /** 'UPDATED' | 'NOCHANGE' | null. */
  change: string | null;
}

/** 'yourpersonaldiary.duckdns.org' -> 'yourpersonaldiary' (a bare sub-domain is returned as is). */
export function subdomainOf(hostname: string): string {
  const h = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!h.endsWith(DUCKDNS_SUFFIX)) return h;
  const inner = h.slice(0, -DUCKDNS_SUFFIX.length);
  // DuckDNS domains are one label; deeper names ("www.x.duckdns.org") belong to "x".
  const labels = inner.split('.');
  return labels[labels.length - 1];
}

export function parseDuckDnsAnswer(text: string): DuckDnsResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const ok = lines[0] === 'OK';
  const value = lines[1] ? lines[1] : null;
  const change = lines[3] ? lines[3] : null;
  return { ok, value, change };
}

async function call(hostname: string, token: string, extra: Record<string, string>, opts: DuckDnsOptions): Promise<DuckDnsResult> {
  const url = new URL('/update', opts.baseUrl ?? DUCKDNS_BASE_URL);
  url.searchParams.set('domains', subdomainOf(hostname));
  url.searchParams.set('token', token);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  url.searchParams.set('verbose', 'true');
  try {
    // IPv4 on purpose: with `ip=` empty DuckDNS records the address the request comes from, and it
    // detects IPv4 only (a dual-stack computer could otherwise reach it over IPv6). The HTTPS
    // listener, the router mapping and the manual port forwarding are all IPv4 as well.
    const res = await httpRequest(url.toString(), {
      signal: opts.signal,
      timeoutMs: opts.timeoutMs ?? 20_000,
      maxBytes: 4096,
      family: 4,
    });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    return parseDuckDnsAnswer(responseText(res));
  } catch (e) {
    // Never let the URL (with the token) or the token itself reach a message. A keyed error (a
    // timeout) carries no URL and keeps its key, so the UI can show it in its own language.
    const err: Error & Partial<KeyedDetail> = new Error(errorText(e, [token, url.toString()]));
    err.name = (e as Error)?.name === 'AbortError' ? 'AbortError' : 'DuckDnsError';
    if (isKeyedDetail(e)) {
      err.detailKey = e.detailKey;
      err.detailParams = e.detailParams;
    }
    throw err;
  }
}

/**
 * Points `hostname` at `ip`, or - without `ip` - at the address the request comes from (the
 * public IP of this network, which DuckDNS then reports back in `value`).
 */
export function updateIp(hostname: string, token: string, ip?: string, opts: DuckDnsOptions = {}): Promise<DuckDnsResult> {
  return call(hostname, token, { ip: ip ?? '' }, opts);
}

/** Publishes `txt` as the TXT record of the domain (ACME dns-01 proof). */
export function setTxt(hostname: string, token: string, txt: string, opts: DuckDnsOptions = {}): Promise<DuckDnsResult> {
  return call(hostname, token, { txt }, opts);
}

/** Removes the TXT record again. */
export function clearTxt(hostname: string, token: string, opts: DuckDnsOptions = {}): Promise<DuckDnsResult> {
  return call(hostname, token, { txt: 'removed', clear: 'true' }, opts);
}
