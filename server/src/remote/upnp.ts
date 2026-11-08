/**
 * UPnP IGD client: opens (and closes) the router port for remote access - on the local network
 * only. Nothing here talks to the internet.
 *
 *   1. SSDP discovery: M-SEARCH over UDP multicast 239.255.255.250:1900 for the WAN connection
 *      services (WANIPConnection:1, WANPPPConnection:1) and the gateway device (IGD:2 / IGD:1),
 *      sent from every IPv4 interface of this computer;
 *   2. the device description (XML, plain http on the LAN) -> the service's control URL;
 *   3. SOAP actions: AddPortMapping (TCP, lease 0 = permanent, description = product name),
 *      DeletePortMapping, GetSpecificPortMappingEntry, GetExternalIPAddress.
 *
 * Safety: an SSDP answer is only followed when its description URL points at the device that
 * answered, on a private (LAN) address; the control URL must be on that same host.
 */
import dgram from 'node:dgram';
import net from 'node:net';
import os from 'node:os';
import { errorText, throwIfAborted } from './errors';
import { httpRequest, responseText } from './http';

export const SSDP_ADDRESS = '239.255.255.250';
export const SSDP_PORT = 1900;
export const SEARCH_TARGETS = [
  'urn:schemas-upnp-org:service:WANIPConnection:1',
  'urn:schemas-upnp-org:service:WANPPPConnection:1',
  'urn:schemas-upnp-org:device:InternetGatewayDevice:2',
  'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
];
/** Service types able to map ports, most preferred first. */
const WAN_SERVICES = [
  'urn:schemas-upnp-org:service:WANIPConnection:2',
  'urn:schemas-upnp-org:service:WANIPConnection:1',
  'urn:schemas-upnp-org:service:WANPPPConnection:1',
];
/** XML namespace identifiers of the SOAP 1.1 envelope (names, never fetched). */
const SOAP_ENVELOPE_NS = 'http://schemas.xmlsoap.org/soap/envelope/';
const SOAP_ENCODING_NS = 'http://schemas.xmlsoap.org/soap/encoding/';

export interface UpnpOptions {
  ssdpAddress?: string;
  ssdpPort?: number;
  /** Local IPv4 addresses to search from (default: every non-internal IPv4 interface). */
  interfaces?: string[];
  /** How long to wait for SSDP answers (default 3 s). */
  timeoutMs?: number;
  /** Accept a gateway on a loopback address (tests only). */
  allowLoopback?: boolean;
  signal?: AbortSignal;
}

export interface Gateway {
  /** URL of the device description. */
  location: string;
  /** Absolute control URL of the WAN connection service. */
  controlUrl: string;
  serviceType: string;
  /** This computer's IPv4 address on the router's network (the port-mapping target). */
  localAddress: string;
}

export class UpnpError extends Error {
  constructor(
    message: string,
    /** UPnP error code from a SOAP fault (e.g. 718 ConflictInMappingEntry); null for transport errors. */
    readonly code: number | null = null,
  ) {
    super(message);
    this.name = 'UpnpError';
  }
}

// Addresses ------------------------------------------------------------------------------------

function ipv4Parts(ip: string): number[] | null {
  if (!net.isIPv4(ip)) return null;
  return ip.split('.').map(Number);
}

/** RFC 1918 private ranges + link-local: the addresses a home router lives on. */
export function isPrivateIpv4(ip: string): boolean {
  const p = ipv4Parts(ip);
  if (!p) return false;
  return p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 169 && p[1] === 254);
}

export function isLoopbackIpv4(ip: string): boolean {
  const p = ipv4Parts(ip);
  return !!p && p[0] === 127;
}

/** IPv4 addresses of this computer on its networks (no loopback), private ones first. */
export function lanIpv4Addresses(): string[] {
  const out: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return [...new Set(out)].sort((a, b) => Number(isPrivateIpv4(b)) - Number(isPrivateIpv4(a)));
}

// SSDP -----------------------------------------------------------------------------------------

export function buildSearch(st: string, address = SSDP_ADDRESS, port = SSDP_PORT, mx = 2): string {
  return `M-SEARCH * HTTP/1.1\r\nHOST: ${address}:${port}\r\nMAN: "ssdp:discover"\r\nMX: ${mx}\r\nST: ${st}\r\n\r\n`;
}

/** Headers (lower-case names) of an SSDP "HTTP/1.1 200 OK" answer, or null. */
export function parseSsdpResponse(text: string): Record<string, string> | null {
  const lines = text.split(/\r?\n/);
  if (!/^HTTP\/1\.[01]\s+200\b/i.test(lines[0] ?? '')) return null;
  const headers: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    const i = line.indexOf(':');
    if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return headers;
}

export interface SsdpAnswer {
  location: string;
  st: string;
  /** Address of the device that answered. */
  from: string;
  /** The local address the answer arrived on. */
  localAddress: string;
}

/** Sends the M-SEARCH queries and collects answers (stops 500 ms after the first useful one). */
export function ssdpSearch(opts: UpnpOptions = {}): Promise<SsdpAnswer[]> {
  const address = opts.ssdpAddress ?? SSDP_ADDRESS;
  const port = opts.ssdpPort ?? SSDP_PORT;
  const timeoutMs = opts.timeoutMs ?? 3000;
  const interfaces = opts.interfaces ?? lanIpv4Addresses();
  return new Promise((resolve) => {
    const answers: SsdpAnswer[] = [];
    const sockets: dgram.Socket[] = [];
    let finished = false;
    let grace: NodeJS.Timeout | null = null;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (grace) clearTimeout(grace);
      opts.signal?.removeEventListener('abort', finish);
      for (const s of sockets) {
        try {
          s.close();
        } catch {
          /* already closed */
        }
      }
      resolve(answers);
    };
    const timer = setTimeout(finish, timeoutMs);
    opts.signal?.addEventListener('abort', finish, { once: true });
    if (!interfaces.length) return finish();
    for (const local of interfaces) {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      sockets.push(socket);
      socket.on('error', () => {
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      });
      socket.on('message', (msg, rinfo) => {
        const headers = parseSsdpResponse(msg.toString('utf8'));
        if (!headers?.location) return;
        if (answers.some((a) => a.location === headers.location)) return;
        answers.push({ location: headers.location, st: headers.st ?? '', from: rinfo.address, localAddress: local });
        if (!grace) grace = setTimeout(finish, 500);
      });
      socket.bind(0, local, () => {
        try {
          socket.setMulticastTTL(2);
          socket.setMulticastInterface(local);
        } catch {
          /* unicast target (tests) */
        }
        for (const st of SEARCH_TARGETS) {
          socket.send(buildSearch(st, address, port), port, address, () => {
            /* send errors (no route) just mean no answer on this interface */
          });
        }
      });
    }
  });
}

// Description ----------------------------------------------------------------------------------

function xmlText(block: string, tag: string): string | null {
  const m = new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'i').exec(block);
  return m ? decodeXml(m[1].trim()) : null;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** The best WAN connection service of a device description, with its control URL made absolute. */
export function parseDescription(xml: string, location: string): { serviceType: string; controlUrl: string } | null {
  const services: { serviceType: string; controlUrl: string }[] = [];
  for (const m of xml.matchAll(/<(?:\w+:)?service\b[^>]*>([\s\S]*?)<\/(?:\w+:)?service>/gi)) {
    const serviceType = xmlText(m[1], 'serviceType');
    const control = xmlText(m[1], 'controlURL');
    if (serviceType && control) services.push({ serviceType, controlUrl: control });
  }
  const base = xmlText(xml, 'URLBase') || location;
  for (const wanted of WAN_SERVICES) {
    const found = services.find((s) => s.serviceType === wanted);
    if (found) {
      try {
        return { serviceType: found.serviceType, controlUrl: new URL(found.controlUrl, base).toString() };
      } catch {
        return null;
      }
    }
  }
  return null;
}

function acceptableHost(host: string, from: string, allowLoopback: boolean): boolean {
  if (host !== from) return false;
  return isPrivateIpv4(host) || (allowLoopback && isLoopbackIpv4(host));
}

/** Finds the home router's WAN connection service, or null when no UPnP gateway answers. */
export async function discoverGateway(opts: UpnpOptions = {}): Promise<Gateway | null> {
  const answers = await ssdpSearch(opts);
  const allowLoopback = opts.allowLoopback === true;
  for (const a of answers) {
    throwIfAborted(opts.signal);
    let loc: URL;
    try {
      loc = new URL(a.location);
    } catch {
      continue;
    }
    if (loc.protocol !== 'http:' || !acceptableHost(loc.hostname, a.from, allowLoopback)) continue;
    try {
      const res = await httpRequest(loc.toString(), { timeoutMs: 5000, maxBytes: 256 * 1024, signal: opts.signal });
      if (res.status !== 200) continue;
      const svc = parseDescription(responseText(res), loc.toString());
      if (!svc) continue;
      if (new URL(svc.controlUrl).hostname !== loc.hostname) continue;
      return { location: loc.toString(), controlUrl: svc.controlUrl, serviceType: svc.serviceType, localAddress: res.localAddress || a.localAddress };
    } catch {
      /* try the next answer */
    }
  }
  return null;
}

// SOAP -----------------------------------------------------------------------------------------

export function soapEnvelope(serviceType: string, action: string, args: [string, string | number][]): string {
  const body = args.map(([k, v]) => `<${k}>${escapeXml(String(v))}</${k}>`).join('');
  return (
    `<?xml version="1.0"?>\r\n` +
    `<s:Envelope xmlns:s="${SOAP_ENVELOPE_NS}" s:encodingStyle="${SOAP_ENCODING_NS}">` +
    `<s:Body><u:${action} xmlns:u="${escapeXml(serviceType)}">${body}</u:${action}></s:Body></s:Envelope>`
  );
}

/** Calls a SOAP action; returns the <NewXxx> values of the answer. Faults become UpnpError with the UPnP code. */
export async function soapAction(gw: Gateway, action: string, args: [string, string | number][], signal?: AbortSignal): Promise<Record<string, string>> {
  let text: string;
  let status: number;
  try {
    const res = await httpRequest(gw.controlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset="utf-8"', SOAPAction: `"${gw.serviceType}#${action}"` },
      body: soapEnvelope(gw.serviceType, action, args),
      timeoutMs: 8000,
      maxBytes: 64 * 1024,
      signal,
    });
    text = responseText(res);
    status = res.status;
  } catch (e) {
    throw new UpnpError(errorText(e));
  }
  if (status !== 200) {
    const code = Number(xmlText(text, 'errorCode'));
    const description = xmlText(text, 'errorDescription') || `HTTP ${status}`;
    throw new UpnpError(description, Number.isFinite(code) && code > 0 ? code : null);
  }
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/<(?:\w+:)?(New\w+)>([^<]*)<\/(?:\w+:)?\1>/g)) out[m[1]] = decodeXml(m[2].trim());
  return out;
}

export interface PortMapping {
  externalPort: number;
  internalPort: number;
  internalClient: string;
  description: string;
  /** Seconds; 0 = permanent. */
  leaseSeconds?: number;
}

export async function addPortMapping(gw: Gateway, m: PortMapping, signal?: AbortSignal): Promise<void> {
  await soapAction(
    gw,
    'AddPortMapping',
    [
      ['NewRemoteHost', ''],
      ['NewExternalPort', m.externalPort],
      ['NewProtocol', 'TCP'],
      ['NewInternalPort', m.internalPort],
      ['NewInternalClient', m.internalClient],
      ['NewEnabled', 1],
      ['NewPortMappingDescription', m.description],
      ['NewLeaseDuration', m.leaseSeconds ?? 0],
    ],
    signal,
  );
}

export async function deletePortMapping(gw: Gateway, externalPort: number, signal?: AbortSignal): Promise<void> {
  await soapAction(
    gw,
    'DeletePortMapping',
    [
      ['NewRemoteHost', ''],
      ['NewExternalPort', externalPort],
      ['NewProtocol', 'TCP'],
    ],
    signal,
  );
}

export async function getExternalIp(gw: Gateway, signal?: AbortSignal): Promise<string | null> {
  const out = await soapAction(gw, 'GetExternalIPAddress', [], signal);
  const ip = out.NewExternalIPAddress;
  return ip && net.isIP(ip) ? ip : null;
}

/** The existing TCP mapping of `externalPort`, or null (UPnP 714 NoSuchEntryInArray). */
export async function getSpecificPortMapping(
  gw: Gateway,
  externalPort: number,
  signal?: AbortSignal,
): Promise<{ internalClient: string; internalPort: number; description: string } | null> {
  try {
    const out = await soapAction(
      gw,
      'GetSpecificPortMappingEntry',
      [
        ['NewRemoteHost', ''],
        ['NewExternalPort', externalPort],
        ['NewProtocol', 'TCP'],
      ],
      signal,
    );
    return {
      internalClient: out.NewInternalClient ?? '',
      internalPort: Number(out.NewInternalPort ?? 0),
      description: out.NewPortMappingDescription ?? '',
    };
  } catch (e) {
    if (e instanceof UpnpError && e.code === 714) return null;
    throw e;
  }
}

/**
 * Adds the mapping. When the router reports a conflict (718) and the existing entry already
 * points at this computer, it is replaced (or kept when identical); an entry of another device is
 * never touched - that is a UpnpError with code 718 and the other device in the message.
 */
export async function ensurePortMapping(gw: Gateway, m: PortMapping, signal?: AbortSignal): Promise<'added' | 'existing'> {
  try {
    await addPortMapping(gw, m, signal);
    return 'added';
  } catch (e) {
    if (!(e instanceof UpnpError) || e.code !== 718) throw e;
    const entry = await getSpecificPortMapping(gw, m.externalPort, signal);
    if (!entry || entry.internalClient !== m.internalClient) {
      throw new UpnpError(entry?.internalClient || 'ConflictInMappingEntry', 718);
    }
    if (entry.internalPort === m.internalPort) return 'existing';
    await deletePortMapping(gw, m.externalPort, signal);
    await addPortMapping(gw, m, signal);
    return 'added';
  }
}
