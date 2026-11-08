/**
 * Test overrides of the remote-access endpoints, read from the environment by the server entry
 * point (index.ts) - for end-to-end runs of the real server against local mocks:
 *
 *   MPD_ACME_DIRECTORY   ACME directory URL          (instead of Let's Encrypt)
 *   MPD_DUCKDNS_BASE     DuckDNS base URL            (instead of www.duckdns.org; the dns-01 TXT
 *                                                     record then lives only in the mock, so the
 *                                                     DNS propagation wait is skipped, and "Test
 *                                                     connection" looks the name up in the mock
 *                                                     (GET <base>/resolve?domains=<name>) instead
 *                                                     of asking the real DNS about a real name)
 *   MPD_UPNP_SSDP        <ip>:<port> of an SSDP responder (instead of the multicast group)
 *   MPD_REMOTE_TLS_HOST  interface of the HTTPS listener (instead of 0.0.0.0)
 *
 * Every override must point at THIS computer (127.0.0.1 / localhost / ::1): anything else is
 * ignored with a log line, so no environment variable can send the DuckDNS token, the ACME
 * account or the router requests to another host. Nothing is overridden in normal use.
 */
import net from 'node:net';
import { httpRequest, responseText } from './http';
import type { RemoteManagerOptions } from './manager';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

function loopbackUrl(value: string): string | null {
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return LOOPBACK_HOSTS.has(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** '127.0.0.1:1900' -> { address, port }; null unless the address is the loopback IPv4 address. */
function loopbackSsdp(value: string): { address: string; port: number } | null {
  const m = /^(127\.0\.0\.1):(\d{1,5})$/.exec(value.trim());
  if (!m) return null;
  const port = Number(m[2]);
  return port > 0 && port < 65536 ? { address: m[1], port } : null;
}

/**
 * The A records of `hostname` as the mock DuckDNS at `baseUrl` (loopback) knows them:
 * GET <base>/resolve?domains=<sub> answers the address as plain text. Rejects when the mock does
 * not know the name (the check then reports a failed lookup).
 */
async function resolveInMock(baseUrl: string, hostname: string): Promise<string[]> {
  const sub = hostname.toLowerCase().replace(/\.duckdns\.org$/, '');
  const url = new URL(`resolve?domains=${encodeURIComponent(sub)}`, baseUrl).toString();
  const res = await httpRequest(url, { timeoutMs: 5000, maxBytes: 4096 });
  if (res.status !== 200) throw new Error(`mock DuckDNS lookup failed (HTTP ${res.status})`);
  return responseText(res)
    .split(/\s+/)
    .filter((ip) => net.isIPv4(ip));
}

export interface EnvOverrides {
  options: RemoteManagerOptions;
  /** One human-readable line per applied or ignored override (for server.log). */
  notes: string[];
}

export function remoteOverridesFromEnv(env: NodeJS.ProcessEnv): EnvOverrides {
  const options: RemoteManagerOptions = {};
  const notes: string[] = [];
  const ignored = (name: string) => notes.push(`${name} ignored: test overrides must point at this computer (127.0.0.1)`);

  const acme = env.MPD_ACME_DIRECTORY?.trim();
  if (acme) {
    const url = loopbackUrl(acme);
    if (url) {
      options.directoryUrl = url;
      notes.push(`TEST OVERRIDE: ACME directory ${url}`);
    } else ignored('MPD_ACME_DIRECTORY');
  }

  const duck = env.MPD_DUCKDNS_BASE?.trim();
  if (duck) {
    const url = loopbackUrl(duck);
    if (url) {
      options.duckdnsBaseUrl = url;
      // The mock publishes the TXT record only to itself, never to DNS.
      options.waitForTxt = async () => true;
      // ...and so does the name's address: "Test connection" must not send a real DNS query.
      options.resolveHost = (hostname) => resolveInMock(url, hostname);
      notes.push(`TEST OVERRIDE: DuckDNS ${url} (DNS propagation check skipped, names looked up in the mock)`);
    } else ignored('MPD_DUCKDNS_BASE');
  }

  const ssdp = env.MPD_UPNP_SSDP?.trim();
  if (ssdp) {
    const target = loopbackSsdp(ssdp);
    if (target) {
      options.upnp = { ssdpAddress: target.address, ssdpPort: target.port, interfaces: [target.address], allowLoopback: true, timeoutMs: 1500 };
      notes.push(`TEST OVERRIDE: UPnP gateway at ${target.address}:${target.port}`);
    } else ignored('MPD_UPNP_SSDP');
  }

  const tlsHost = env.MPD_REMOTE_TLS_HOST?.trim();
  if (tlsHost) {
    if (net.isIPv4(tlsHost) && tlsHost.startsWith('127.')) {
      options.tlsHost = tlsHost;
      notes.push(`TEST OVERRIDE: HTTPS listener on ${tlsHost}`);
    } else ignored('MPD_REMOTE_TLS_HOST');
  }

  return { options, notes };
}
