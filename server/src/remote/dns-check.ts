/**
 * DNS helpers of the remote-access module (node:dns only).
 *
 * `waitForTxtRecord` polls the authoritative DuckDNS name servers (found with an NS lookup of
 * duckdns.org) until the dns-01 TXT value is visible, so Let's Encrypt is only asked to validate
 * once the proof is really published. When the name servers cannot be found, the system resolver
 * is used instead.
 */
import dns from 'node:dns';
import { sleep, throwIfAborted } from './errors';

export interface WaitForTxtOptions {
  /** Give up after this long (default 2 minutes). */
  timeoutMs?: number;
  /** Pause between lookups (default 5 s). */
  intervalMs?: number;
  /** Extra pause once the value is visible, so every name server has it (default 5 s). */
  settleMs?: number;
  signal?: AbortSignal;
  /** Zone whose name servers are asked (default 'duckdns.org'). */
  zone?: string;
}

/** IPv4 addresses of the authoritative name servers of `zone` ([] when they cannot be found). */
export async function authoritativeServers(zone: string): Promise<string[]> {
  try {
    const names = await dns.promises.resolveNs(zone);
    const lists = await Promise.all(names.map((n) => dns.promises.resolve4(n).catch(() => [] as string[])));
    return [...new Set(lists.flat())];
  } catch {
    return [];
  }
}

export async function waitForTxtRecord(name: string, value: string, opts: WaitForTxtOptions = {}): Promise<boolean> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const intervalMs = opts.intervalMs ?? 5000;
  const deadline = Date.now() + timeoutMs;
  const resolver = new dns.promises.Resolver({ timeout: 4000, tries: 2 });
  const servers = await authoritativeServers(opts.zone ?? 'duckdns.org');
  if (servers.length) resolver.setServers(servers);
  for (;;) {
    throwIfAborted(opts.signal);
    try {
      const records = await resolver.resolveTxt(name);
      if (records.some((chunks) => chunks.join('') === value)) {
        await sleep(opts.settleMs ?? 5000, opts.signal);
        return true;
      }
    } catch {
      /* NXDOMAIN / NODATA / timeout: not there yet */
    }
    if (Date.now() + intervalMs > deadline) return false;
    await sleep(intervalMs, opts.signal);
  }
}

/** IPv4 addresses `hostname` resolves to through the system resolver ([] on failure is an error for the caller). */
export async function resolveHostIpv4(hostname: string): Promise<string[]> {
  return dns.promises.resolve4(hostname);
}
