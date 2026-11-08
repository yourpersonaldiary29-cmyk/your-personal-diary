/**
 * Test fixtures of the remote-access suites (never shipped):
 *   - a small DER parser (to read CSRs / certificates back),
 *   - an X.509 builder on top of server/src/remote/der.ts (node:crypto cannot sign certificates),
 *   - in-process mocks: ACME server (express over http), DuckDNS (http), UPnP gateway (udp SSDP
 *     responder + http description/control endpoints) - all on 127.0.0.1.
 */
import { createHash, createPublicKey, randomBytes, sign, verify, type KeyObject } from 'node:crypto';
import dgram from 'node:dgram';
import http from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import type { TLSSocket } from 'node:tls';
import express, { type Request, type Response } from 'express';
import { ECDSA_SHA256_ALGORITHM, extension, generalNamesDns, OID } from '../src/remote/csr';
import {
  base64url,
  derBitString,
  derBoolean,
  derContext,
  derInteger,
  derOctetString,
  derOid,
  derSequence,
  derSet,
  derTime,
  derUtf8String,
  fromBase64url,
  toPem,
} from '../src/remote/der';
import { generateEcKey } from '../src/remote/tls-store';

// DER parser --------------------------------------------------------------------------------------

export interface DerNode {
  tag: number;
  headerLength: number;
  length: number;
  /** The whole TLV. */
  raw: Buffer;
  content: Buffer;
  children: DerNode[];
}

export function parseDer(buf: Buffer, offset = 0): DerNode {
  const tag = buf[offset];
  let length = buf[offset + 1];
  let headerLength = 2;
  if (length & 0x80) {
    const n = length & 0x7f;
    length = 0;
    for (let i = 0; i < n; i++) length = length * 256 + buf[offset + 2 + i];
    headerLength = 2 + n;
  }
  const content = buf.subarray(offset + headerLength, offset + headerLength + length);
  if (content.length !== length) throw new Error('truncated DER');
  const children: DerNode[] = [];
  if (tag & 0x20) {
    let p = 0;
    while (p < content.length) {
      const child = parseDer(content, p);
      children.push(child);
      p += child.headerLength + child.length;
    }
  }
  return { tag, headerLength, length, raw: buf.subarray(offset, offset + headerLength + length), content, children };
}

export function oidString(content: Buffer): string {
  const arcs: number[] = [];
  let value = 0;
  for (let i = 0; i < content.length; i++) {
    value = value * 128 + (content[i] & 0x7f);
    if (!(content[i] & 0x80)) {
      if (arcs.length === 0) {
        const first = value < 80 ? Math.floor(value / 40) : 2;
        arcs.push(first, value - first * 40);
      } else arcs.push(value);
      value = 0;
    }
  }
  return arcs.join('.');
}

/** CN of a Name node. */
export function commonNameOf(name: DerNode): string | null {
  for (const rdn of name.children) {
    for (const atv of rdn.children) {
      if (oidString(atv.children[0].content) === OID.commonName) return atv.children[1].content.toString('utf8');
    }
  }
  return null;
}

export interface ParsedCsr {
  info: Buffer;
  version: number;
  commonName: string | null;
  spki: Buffer;
  sanDnsNames: string[];
  signatureAlgorithm: string;
  signature: Buffer;
  /** True when the signature verifies over `info` with the CSR's own public key. */
  signatureValid: boolean;
}

export function parseCsr(der: Buffer): ParsedCsr {
  const root = parseDer(der);
  const [info, alg, sig] = root.children;
  const [version, subject, spki, attrs] = info.children;
  const sanDnsNames: string[] = [];
  if (attrs && attrs.tag === 0xa0) {
    for (const attribute of attrs.children) {
      if (oidString(attribute.children[0].content) !== OID.extensionRequest) continue;
      const extensions = attribute.children[1].children[0];
      for (const ext of extensions.children) {
        if (oidString(ext.children[0].content) !== OID.subjectAltName) continue;
        const names = parseDer(ext.children[ext.children.length - 1].content);
        for (const n of names.children) if (n.tag === 0x82) sanDnsNames.push(n.content.toString('ascii'));
      }
    }
  }
  const signature = sig.content.subarray(1);
  const key = createPublicKey({ key: spki.raw, format: 'der', type: 'spki' });
  return {
    info: info.raw,
    version: version.content[0],
    commonName: commonNameOf(subject),
    spki: spki.raw,
    sanDnsNames,
    signatureAlgorithm: oidString(alg.children[0].content),
    signature,
    signatureValid: verify('sha256', info.raw, key, signature),
  };
}

// X.509 builder -----------------------------------------------------------------------------------

function nameOf(cn: string, org?: string): Buffer {
  const rdns: Buffer[] = [];
  if (org) rdns.push(derSet(derSequence(derOid(OID.organizationName), derUtf8String(org))));
  rdns.push(derSet(derSequence(derOid(OID.commonName), derUtf8String(cn))));
  return derSequence(...rdns);
}

export interface CertSpec {
  subjectCn: string;
  subjectOrg?: string;
  issuerCn: string;
  issuerOrg?: string;
  /** SPKI DER of the certified key. */
  spki: Buffer;
  signingKey: KeyObject;
  ca?: boolean;
  dnsNames?: string[];
  notBefore?: Date;
  notAfter?: Date;
  serial?: Buffer;
}

/** A v3 certificate signed with ecdsa-with-SHA256, as PEM. */
export function buildCertificate(spec: CertSpec): string {
  const notBefore = spec.notBefore ?? new Date(Date.now() - 60_000);
  const notAfter = spec.notAfter ?? new Date(Date.now() + 90 * 86_400_000);
  const serial = spec.serial ?? Buffer.concat([Buffer.from([0x01]), randomBytes(15)]);
  const extensions: Buffer[] = [];
  if (spec.ca) {
    extensions.push(derSequence(derOid(OID.basicConstraints), derBoolean(true), derOctetString(derSequence(derBoolean(true)))));
  }
  if (spec.dnsNames?.length) extensions.push(extension(OID.subjectAltName, generalNamesDns(spec.dnsNames)));
  const tbs = derSequence(
    derContext(0, derInteger(2)),
    derInteger(serial),
    ECDSA_SHA256_ALGORITHM,
    nameOf(spec.issuerCn, spec.issuerOrg),
    derSequence(derTime(notBefore), derTime(notAfter)),
    nameOf(spec.subjectCn, spec.subjectOrg),
    spec.spki,
    ...(extensions.length ? [derContext(3, derSequence(...extensions))] : []),
  );
  const signature = sign('sha256', tbs, { key: spec.signingKey, dsaEncoding: 'der' });
  return toPem('CERTIFICATE', derSequence(tbs, ECDSA_SHA256_ALGORITHM, derBitString(signature)));
}

export interface TestCa {
  key: KeyObject;
  certPem: string;
  /** Issues a leaf for `hostnames` to the key with SPKI `spki`. */
  issue(spki: Buffer, hostnames: string[], opts?: { notAfter?: Date }): string;
}

export function makeTestCa(name = 'Test ACME Root'): TestCa {
  const key = generateEcKey();
  const spki = createPublicKey(key).export({ type: 'spki', format: 'der' });
  const certPem = buildCertificate({ subjectCn: name, subjectOrg: 'Mock ACME', issuerCn: name, issuerOrg: 'Mock ACME', spki, signingKey: key, ca: true });
  return {
    key,
    certPem,
    issue: (leafSpki, hostnames, opts = {}) =>
      buildCertificate({
        subjectCn: hostnames[0],
        issuerCn: name,
        issuerOrg: 'Mock ACME',
        spki: leafSpki,
        signingKey: key,
        dnsNames: hostnames,
        notAfter: opts.notAfter,
      }),
  };
}

/** A self-contained leaf + key for `hostname`, issued by `ca`. */
export function makeLeaf(ca: TestCa, hostname: string, notAfter?: Date): { keyPem: string; certPem: string; key: KeyObject } {
  const key = generateEcKey();
  const spki = createPublicKey(key).export({ type: 'spki', format: 'der' });
  const certPem = ca.issue(spki, [hostname], { notAfter }) + ca.certPem;
  return { key, keyPem: key.export({ type: 'pkcs8', format: 'pem' }).toString(), certPem };
}

// HTTP helpers -------------------------------------------------------------------------------------

export function listenLocal(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

export function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(() => resolve());
  });
}

/** GET over TLS to 127.0.0.1:<port> for `hostname` (SNI + Host), trusting `caPem`; reports the server certificate serial. */
export function httpsGet(
  port: number,
  hostname: string,
  caPem: string,
  urlPath = '/',
  hostHeader = hostname,
): Promise<{ status: number; headers: Record<string, unknown>; body: string; serial: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host: '127.0.0.1', port, path: urlPath, servername: hostname, headers: { Host: hostHeader }, ca: caPem, agent: false },
      (res) => {
        const serial = (res.socket as TLSSocket).getPeerCertificate().serialNumber;
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body, serial }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

// Mock DuckDNS -------------------------------------------------------------------------------------

export interface MockDuckDns {
  baseUrl: string;
  /** Every request's query parameters, in order. */
  calls: URLSearchParams[];
  /** Current TXT value (null = none). */
  txt: string | null;
  ip: string;
  /** Resolver for the ACME waitForTxt option: the TXT value for any name under the domain. */
  txtFor(name: string): string | null;
  close(): Promise<void>;
}

export async function startMockDuckDns(opts: { token: string; domain: string; ip?: string }): Promise<MockDuckDns> {
  const state: MockDuckDns = {
    baseUrl: '',
    calls: [],
    txt: null,
    ip: opts.ip ?? '203.0.113.7',
    txtFor(name: string) {
      return name === `${opts.domain}.duckdns.org` || name.endsWith(`.${opts.domain}.duckdns.org`) ? state.txt : null;
    },
    close: async () => {},
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    state.calls.push(url.searchParams);
    res.setHeader('Content-Type', 'text/plain');
    // The name's A record as the mock knows it (MPD_DUCKDNS_BASE: "Test connection" looks names up here).
    if (url.pathname === '/resolve') {
      if (url.searchParams.get('domains') !== opts.domain) {
        res.statusCode = 404;
        return res.end('unknown name');
      }
      return res.end(state.ip);
    }
    if (url.pathname !== '/update') {
      res.statusCode = 404;
      return res.end('not found');
    }
    const q = url.searchParams;
    if (q.get('token') !== opts.token || q.get('domains') !== opts.domain) return res.end('KO');
    if (q.has('txt')) {
      if (q.get('clear') === 'true') state.txt = null;
      else state.txt = q.get('txt');
      return res.end(q.get('verbose') === 'true' ? `OK\n${state.txt ?? ''}\n\nUPDATED` : 'OK');
    }
    if (q.get('ip')) state.ip = q.get('ip') as string;
    res.end(q.get('verbose') === 'true' ? `OK\n${state.ip}\n\nUPDATED` : 'OK');
  });
  const port = await listenLocal(server);
  state.baseUrl = `http://127.0.0.1:${port}`;
  state.close = () => closeServer(server);
  return state;
}

// Mock ACME ----------------------------------------------------------------------------------------

export interface MockAcmeOptions {
  /** TXT value visible for a DNS name (usually MockDuckDns.txtFor). */
  txtFor: (name: string) => string | null;
  ca?: TestCa;
  /** Answer the first signed POST with badNonce. */
  badNonceOnce?: boolean;
  /** newOrder answers 429 rateLimited. */
  rateLimited?: boolean;
  /** Polls of the authorization that still say "pending" after the challenge was answered. */
  pendingPolls?: number;
  /** Polls of the order that say "processing" after finalize. */
  processingPolls?: number;
  /** Validity of issued certificates. */
  certDays?: number;
}

interface MockOrder {
  id: number;
  hostname: string;
  status: string;
  authzStatus: string;
  challengeStatus: string;
  token: string;
  accountThumb: string;
  pendingLeft: number;
  processingLeft: number;
  certPem: string | null;
  error?: { type: string; detail: string };
}

export interface MockAcme {
  baseUrl: string;
  directoryUrl: string;
  ca: TestCa;
  options: MockAcmeOptions;
  accounts: Map<string, string>;
  orders: MockOrder[];
  /** Parsed CSRs received at finalize. */
  csrs: ParsedCsr[];
  /** Number of signed requests rejected for a bad signature / url / nonce. */
  rejected: number;
  close(): Promise<void>;
}

function thumbprintOf(jwk: Record<string, string>): string {
  return base64url(createHash('sha256').update(`{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}","y":"${jwk.y}"}`).digest());
}

export async function startMockAcme(options: MockAcmeOptions): Promise<MockAcme> {
  const ca = options.ca ?? makeTestCa();
  const nonces = new Set<string>();
  const accountsByThumb = new Map<string, string>(); // thumbprint -> kid
  const keysByKid = new Map<string, KeyObject>();
  const state: MockAcme = {
    baseUrl: '',
    directoryUrl: '',
    ca,
    options,
    accounts: accountsByThumb,
    orders: [],
    csrs: [],
    rejected: 0,
    close: async () => {},
  };
  let badNonceLeft = options.badNonceOnce ? 1 : 0;
  const newNonce = () => {
    const n = base64url(randomBytes(16));
    nonces.add(n);
    return n;
  };
  const problem = (res: Response, status: number, type: string, detail: string) => {
    res.status(status).setHeader('Replay-Nonce', newNonce());
    res.type('application/problem+json').send(JSON.stringify({ type: `urn:ietf:params:acme:error:${type}`, detail, status }));
  };

  const app = express();
  app.use(express.json({ type: ['application/jose+json', 'application/json'] }));

  /** Verifies the JWS; returns the payload (null for POST-as-GET) and the account key, or answers an error. */
  const verifyJws = (req: Request, res: Response, allowJwk: boolean): { payload: unknown; kid: string | null; thumb: string } | null => {
    const body = req.body as { protected?: string; payload?: string; signature?: string };
    if (!body?.protected || body.payload === undefined || !body.signature) {
      state.rejected++;
      problem(res, 400, 'malformed', 'not a JWS');
      return null;
    }
    const header = JSON.parse(fromBase64url(body.protected).toString('utf8')) as {
      alg: string;
      nonce: string;
      url: string;
      jwk?: Record<string, string>;
      kid?: string;
    };
    if (badNonceLeft > 0) {
      badNonceLeft--;
      state.rejected++;
      problem(res, 400, 'badNonce', 'try again');
      return null;
    }
    if (!nonces.delete(header.nonce)) {
      state.rejected++;
      problem(res, 400, 'badNonce', 'unknown nonce');
      return null;
    }
    if (header.url !== `${state.baseUrl}${req.originalUrl}` || header.alg !== 'ES256') {
      state.rejected++;
      problem(res, 401, 'unauthorized', 'bad url or alg');
      return null;
    }
    let key: KeyObject;
    let kid: string | null = null;
    let thumb: string;
    if (header.jwk) {
      if (!allowJwk) {
        state.rejected++;
        problem(res, 400, 'malformed', 'jwk not allowed here');
        return null;
      }
      key = createPublicKey({ key: header.jwk, format: 'jwk' });
      thumb = thumbprintOf(header.jwk);
    } else if (header.kid && keysByKid.has(header.kid)) {
      kid = header.kid;
      key = keysByKid.get(header.kid) as KeyObject;
      thumb = thumbprintOf(key.export({ format: 'jwk' }) as Record<string, string>);
    } else {
      state.rejected++;
      problem(res, 400, 'accountDoesNotExist', 'unknown account');
      return null;
    }
    const ok = verify('sha256', Buffer.from(`${body.protected}.${body.payload}`), { key, dsaEncoding: 'ieee-p1363' }, fromBase64url(body.signature));
    if (!ok) {
      state.rejected++;
      problem(res, 401, 'unauthorized', 'bad signature');
      return null;
    }
    res.setHeader('Replay-Nonce', newNonce());
    const payload = body.payload === '' ? null : JSON.parse(fromBase64url(body.payload).toString('utf8'));
    return { payload, kid, thumb };
  };

  const orderJson = (o: MockOrder) => ({
    status: o.status,
    identifiers: [{ type: 'dns', value: o.hostname }],
    authorizations: [`${state.baseUrl}/authz/${o.id}`],
    finalize: `${state.baseUrl}/finalize/${o.id}`,
    ...(o.certPem ? { certificate: `${state.baseUrl}/cert/${o.id}` } : {}),
    ...(o.error ? { error: o.error } : {}),
  });
  const findOrder = (req: Request, res: Response): MockOrder | null => {
    const o = state.orders.find((x) => x.id === Number(req.params.id));
    if (!o) {
      problem(res, 404, 'malformed', 'no such order');
      return null;
    }
    return o;
  };

  app.get('/directory', (_req, res) => {
    res.json({
      newNonce: `${state.baseUrl}/new-nonce`,
      newAccount: `${state.baseUrl}/new-account`,
      newOrder: `${state.baseUrl}/new-order`,
      revokeCert: `${state.baseUrl}/revoke`,
      keyChange: `${state.baseUrl}/key-change`,
      meta: { termsOfService: `${state.baseUrl}/terms` },
    });
  });
  app.head('/new-nonce', (_req, res) => {
    res.setHeader('Replay-Nonce', newNonce());
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).end();
  });
  app.post('/new-account', (req, res) => {
    const v = verifyJws(req, res, true);
    if (!v) return;
    const payload = v.payload as { termsOfServiceAgreed?: boolean };
    if (payload?.termsOfServiceAgreed !== true) return problem(res, 400, 'malformed', 'terms not agreed');
    const existing = accountsByThumb.get(v.thumb);
    const body = req.body as { protected: string };
    const header = JSON.parse(fromBase64url(body.protected).toString('utf8')) as { jwk: Record<string, string> };
    const kid = existing ?? `${state.baseUrl}/acct/${accountsByThumb.size + 1}`;
    accountsByThumb.set(v.thumb, kid);
    keysByKid.set(kid, createPublicKey({ key: header.jwk, format: 'jwk' }));
    res.status(existing ? 200 : 201).setHeader('Location', kid);
    res.json({ status: 'valid' });
  });
  app.post('/new-order', (req, res) => {
    const v = verifyJws(req, res, false);
    if (!v) return;
    if (options.rateLimited) return problem(res, 429, 'rateLimited', 'too many certificates already issued');
    const ids = (v.payload as { identifiers: { type: string; value: string }[] }).identifiers;
    const o: MockOrder = {
      id: state.orders.length + 1,
      hostname: ids[0].value,
      status: 'pending',
      authzStatus: 'pending',
      challengeStatus: 'pending',
      token: base64url(randomBytes(24)),
      accountThumb: v.thumb,
      pendingLeft: options.pendingPolls ?? 0,
      processingLeft: options.processingPolls ?? 0,
      certPem: null,
    };
    state.orders.push(o);
    res.status(201).setHeader('Location', `${state.baseUrl}/order/${o.id}`);
    res.json(orderJson(o));
  });
  app.post('/authz/:id', (req, res) => {
    const v = verifyJws(req, res, false);
    if (!v) return;
    const o = findOrder(req, res);
    if (!o) return;
    if (o.challengeStatus === 'processing') {
      if (o.pendingLeft > 0) o.pendingLeft--;
      else {
        const expected = base64url(createHash('sha256').update(`${o.token}.${o.accountThumb}`).digest());
        const seen = options.txtFor(`_acme-challenge.${o.hostname}`);
        if (seen === expected) {
          o.challengeStatus = 'valid';
          o.authzStatus = 'valid';
          o.status = 'ready';
        } else {
          o.challengeStatus = 'invalid';
          o.authzStatus = 'invalid';
          o.status = 'invalid';
          o.error = { type: 'urn:ietf:params:acme:error:unauthorized', detail: `Incorrect TXT record "${seen ?? ''}" found at _acme-challenge.${o.hostname}` };
        }
      }
    }
    res.json({
      status: o.authzStatus,
      identifier: { type: 'dns', value: o.hostname },
      challenges: [
        { type: 'http-01', url: `${state.baseUrl}/chall-http/${o.id}`, token: o.token, status: 'pending' },
        {
          type: 'dns-01',
          url: `${state.baseUrl}/chall/${o.id}`,
          token: o.token,
          status: o.challengeStatus,
          ...(o.challengeStatus === 'invalid' ? { error: o.error } : {}),
        },
      ],
    });
  });
  app.post('/chall/:id', (req, res) => {
    const v = verifyJws(req, res, false);
    if (!v) return;
    const o = findOrder(req, res);
    if (!o) return;
    if (o.challengeStatus === 'pending') o.challengeStatus = 'processing';
    res.json({ type: 'dns-01', url: `${state.baseUrl}/chall/${o.id}`, token: o.token, status: o.challengeStatus });
  });
  app.post('/order/:id', (req, res) => {
    const v = verifyJws(req, res, false);
    if (!v) return;
    const o = findOrder(req, res);
    if (!o) return;
    if (o.status === 'processing') {
      if (o.processingLeft > 0) o.processingLeft--;
      else o.status = 'valid';
    }
    res.json(orderJson(o));
  });
  app.post('/finalize/:id', (req, res) => {
    const v = verifyJws(req, res, false);
    if (!v) return;
    const o = findOrder(req, res);
    if (!o) return;
    if (o.status !== 'ready') return problem(res, 403, 'orderNotReady', `order is ${o.status}`);
    const csr = parseCsr(fromBase64url((v.payload as { csr: string }).csr));
    state.csrs.push(csr);
    if (!csr.signatureValid) return problem(res, 400, 'badCSR', 'CSR signature invalid');
    if (!csr.sanDnsNames.includes(o.hostname)) return problem(res, 400, 'badCSR', 'CSR does not name the identifier');
    const notAfter = new Date(Date.now() + (options.certDays ?? 90) * 86_400_000);
    o.certPem = ca.issue(csr.spki, [o.hostname], { notAfter }) + ca.certPem;
    o.status = o.processingLeft > 0 ? 'processing' : 'valid';
    res.json(orderJson(o));
  });
  app.post('/cert/:id', (req, res) => {
    const v = verifyJws(req, res, false);
    if (!v) return;
    const o = findOrder(req, res);
    if (!o || !o.certPem) return;
    res.type('application/pem-certificate-chain').send(o.certPem);
  });

  const server = http.createServer(app);
  const port = await listenLocal(server);
  state.baseUrl = `http://127.0.0.1:${port}`;
  state.directoryUrl = `${state.baseUrl}/directory`;
  state.close = () => closeServer(server);
  return state;
}

// Mock UPnP gateway ---------------------------------------------------------------------------------

export interface MockIgdOptions {
  externalIp?: string;
  /** An existing mapping of another device: externalPort -> client IP. */
  foreignMappings?: Record<number, string>;
  /** AddPortMapping answers this UPnP error code. */
  addFault?: number;
  /** Put this host into LOCATION instead of 127.0.0.1 (redirect attempts). */
  locationHost?: string;
  serviceType?: string;
}

export interface MockIgd {
  ssdpPort: number;
  httpPort: number;
  /** Every SOAP call: action + arguments. */
  actions: { action: string; args: Record<string, string> }[];
  searches: string[];
  mappings: Map<number, { internalClient: string; internalPort: number; description: string; lease: string }>;
  close(): Promise<void>;
}

export async function startMockIgd(opts: MockIgdOptions = {}): Promise<MockIgd> {
  const serviceType = opts.serviceType ?? 'urn:schemas-upnp-org:service:WANIPConnection:1';
  const state: MockIgd = {
    ssdpPort: 0,
    httpPort: 0,
    actions: [],
    searches: [],
    mappings: new Map(),
    close: async () => {},
  };
  for (const [port, client] of Object.entries(opts.foreignMappings ?? {})) {
    state.mappings.set(Number(port), { internalClient: client, internalPort: Number(port), description: 'other', lease: '0' });
  }
  const description =
    `<?xml version="1.0"?><root xmlns="urn:schemas-upnp-org:device-1-0"><device>` +
    `<deviceType>urn:schemas-upnp-org:device:InternetGatewayDevice:1</deviceType><deviceList><device>` +
    `<deviceType>urn:schemas-upnp-org:device:WANDevice:1</deviceType><deviceList><device>` +
    `<deviceType>urn:schemas-upnp-org:device:WANConnectionDevice:1</deviceType><serviceList>` +
    `<service><serviceType>urn:schemas-upnp-org:service:WANCommonInterfaceConfig:1</serviceType><controlURL>/ctl/CmnIfCfg</controlURL></service>` +
    `<service><serviceType>${serviceType}</serviceType><serviceId>urn:upnp-org:serviceId:WANIPConn1</serviceId>` +
    `<controlURL>/ctl/IPConn</controlURL><eventSubURL>/evt/IPConn</eventSubURL><SCPDURL>/WANIPCn.xml</SCPDURL></service>` +
    `</serviceList></device></deviceList></device></deviceList></device></root>`;

  const fault = (res: http.ServerResponse, code: number, text: string) => {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/xml');
    res.end(
      `<?xml version="1.0"?><s:Envelope xmlns:s="soap-envelope"><s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring>UPnPError</faultstring>` +
        `<detail><UPnPError xmlns="urn:schemas-upnp-org:control-1-0"><errorCode>${code}</errorCode><errorDescription>${text}</errorDescription></UPnPError></detail>` +
        `</s:Fault></s:Body></s:Envelope>`,
    );
  };
  const ok = (res: http.ServerResponse, action: string, values: Record<string, string>) => {
    res.setHeader('Content-Type', 'text/xml; charset="utf-8"');
    const inner = Object.entries(values)
      .map(([k, v]) => `<${k}>${v}</${k}>`)
      .join('');
    res.end(`<?xml version="1.0"?><s:Envelope xmlns:s="soap-envelope"><s:Body><u:${action}Response xmlns:u="${serviceType}">${inner}</u:${action}Response></s:Body></s:Envelope>`);
  };

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/desc.xml') {
      res.setHeader('Content-Type', 'text/xml');
      return res.end(description);
    }
    if (req.method === 'POST' && req.url === '/ctl/IPConn') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const soapAction = String(req.headers.soapaction ?? '').replace(/"/g, '');
        const action = soapAction.split('#')[1] ?? '';
        const args: Record<string, string> = {};
        for (const m of body.matchAll(/<(New\w+)>([^<]*)<\/\1>/g)) args[m[1]] = m[2];
        state.actions.push({ action, args });
        const ext = Number(args.NewExternalPort);
        switch (action) {
          case 'AddPortMapping': {
            if (opts.addFault) return fault(res, opts.addFault, 'Refused');
            const existing = state.mappings.get(ext);
            if (existing && existing.internalClient !== args.NewInternalClient) return fault(res, 718, 'ConflictInMappingEntry');
            if (existing && existing.internalPort !== Number(args.NewInternalPort)) return fault(res, 718, 'ConflictInMappingEntry');
            state.mappings.set(ext, {
              internalClient: args.NewInternalClient,
              internalPort: Number(args.NewInternalPort),
              description: args.NewPortMappingDescription,
              lease: args.NewLeaseDuration,
            });
            return ok(res, action, {});
          }
          case 'DeletePortMapping':
            if (!state.mappings.delete(ext)) return fault(res, 714, 'NoSuchEntryInArray');
            return ok(res, action, {});
          case 'GetSpecificPortMappingEntry': {
            const m = state.mappings.get(ext);
            if (!m) return fault(res, 714, 'NoSuchEntryInArray');
            return ok(res, action, {
              NewInternalPort: String(m.internalPort),
              NewInternalClient: m.internalClient,
              NewEnabled: '1',
              NewPortMappingDescription: m.description,
              NewLeaseDuration: m.lease,
            });
          }
          case 'GetExternalIPAddress':
            return ok(res, action, { NewExternalIPAddress: opts.externalIp ?? '203.0.113.7' });
          default:
            return fault(res, 401, 'Invalid Action');
        }
      });
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  state.httpPort = await listenLocal(server);

  const udp = dgram.createSocket('udp4');
  await new Promise<void>((resolve) => udp.bind(0, '127.0.0.1', () => resolve()));
  state.ssdpPort = udp.address().port;
  udp.on('message', (msg, rinfo) => {
    const text = msg.toString('utf8');
    if (!text.startsWith('M-SEARCH')) return;
    const st = /\r\nST:\s*(.+)\r\n/i.exec(text)?.[1]?.trim() ?? '';
    state.searches.push(st);
    if (st !== serviceType) return;
    const reply =
      `HTTP/1.1 200 OK\r\nCACHE-CONTROL: max-age=120\r\nST: ${st}\r\nUSN: uuid:mock-igd::${st}\r\nEXT:\r\nSERVER: Mock/1.0 UPnP/1.1\r\n` +
      `LOCATION: http://${opts.locationHost ?? '127.0.0.1'}:${state.httpPort}/desc.xml\r\n\r\n`;
    udp.send(reply, rinfo.port, rinfo.address);
  });

  state.close = async () => {
    await new Promise<void>((resolve) => udp.close(() => resolve()));
    await closeServer(server);
  };
  return state;
}

/** UPnP options pointing the client at a MockIgd. */
export function upnpOptionsFor(igd: MockIgd) {
  return { ssdpAddress: '127.0.0.1', ssdpPort: igd.ssdpPort, interfaces: ['127.0.0.1'], allowLoopback: true, timeoutMs: 1500 };
}
