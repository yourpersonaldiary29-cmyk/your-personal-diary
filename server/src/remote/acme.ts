/**
 * A minimal ACME v2 client (RFC 8555) built on node:crypto only, for one job: a certificate for
 * the owner's DuckDNS name through the dns-01 challenge (the proof is a TXT record DuckDNS
 * publishes for us, so no inbound port is needed while the certificate is issued).
 *
 *   directory -> newNonce -> newAccount (termsOfServiceAgreed, JWS with the account JWK)
 *   -> newOrder(dns:<hostname>) -> authorization -> dns-01 challenge:
 *        keyAuthorization = token "." base64url(SHA-256(JWK thumbprint input))
 *        TXT value        = base64url(SHA-256(keyAuthorization)), published via DuckDNS
 *        wait until the DuckDNS name servers answer it, then POST {} to the challenge
 *   -> poll the authorization -> fresh EC P-256 key + CSR (csr.ts) -> finalize -> poll the order
 *   -> download the PEM chain (application/pem-certificate-chain)
 *
 * Requests after newAccount are signed with the account URL ("kid"). Every response carries a
 * fresh Replay-Nonce which is used for the next request; a badNonce error is retried.
 * All JWS signatures are ES256 (ECDSA P-256 + SHA-256, raw r||s).
 */
import { createHash, createPrivateKey, createPublicKey, sign, type KeyObject } from 'node:crypto';
import { buildCsr } from './csr';
import { base64url, splitPem } from './der';
import { CancelledError, errorText, isCancelled, RemoteError, sleep, throwIfAborted, type RemoteParams } from './errors';
import { headerValue, httpRequest, type HttpResponse } from './http';
import { generateEcKey, keyToPem, leafOf } from './tls-store';

export const LETS_ENCRYPT_PRODUCTION = 'https://acme-v02.api.letsencrypt.org/directory';
export const LETS_ENCRYPT_STAGING = 'https://acme-staging-v02.api.letsencrypt.org/directory';

export interface AcmeDirectory {
  newNonce: string;
  newAccount: string;
  newOrder: string;
  meta?: { termsOfService?: string };
}

export interface AcmeProblem {
  type?: string;
  detail?: string;
  status?: number;
}

export interface AcmeChallenge {
  type: string;
  url: string;
  token: string;
  status: string;
  error?: AcmeProblem;
}

export interface AcmeAuthorization {
  status: string;
  identifier: { type: string; value: string };
  challenges: AcmeChallenge[];
}

export interface AcmeOrder {
  status: string;
  authorizations: string[];
  finalize: string;
  certificate?: string;
  error?: AcmeProblem;
}

export class AcmeError extends Error {
  /** Set for texts the app writes itself (see KeyedDetail in remote/errors.ts). */
  detailKey?: string;
  detailParams?: Record<string, string | number>;
  constructor(
    readonly status: number,
    readonly problem: AcmeProblem,
  ) {
    super(problem.detail || problem.type || `HTTP ${status}`);
    this.name = 'AcmeError';
  }
}

// JWK / JWS -------------------------------------------------------------------------------------

export interface EcJwk {
  crv: string;
  kty: string;
  x: string;
  y: string;
}

/** Public JWK of an EC key (only the members RFC 7638 uses for the thumbprint). */
export function jwkOf(key: KeyObject): EcJwk {
  const j = createPublicKey(key).export({ format: 'jwk' }) as Partial<EcJwk>;
  if (j.kty !== 'EC' || !j.crv || !j.x || !j.y) throw new RangeError('the ACME account key must be an EC key');
  return { crv: j.crv, kty: j.kty, x: j.x, y: j.y };
}

/** RFC 7638 thumbprint: SHA-256 over the required members in lexicographic order, no whitespace. */
export function jwkThumbprint(jwk: EcJwk): string {
  const canonical = `{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}","y":"${jwk.y}"}`;
  return base64url(createHash('sha256').update(canonical).digest());
}

export function keyAuthorization(token: string, accountKey: KeyObject): string {
  return `${token}.${jwkThumbprint(jwkOf(accountKey))}`;
}

/** The TXT record value of a dns-01 challenge. */
export function dns01TxtValue(keyAuth: string): string {
  return base64url(createHash('sha256').update(keyAuth).digest());
}

export interface FlattenedJws {
  protected: string;
  payload: string;
  signature: string;
}

/**
 * Flattened JWS (RFC 7515) with ES256. `kid` absent -> the header carries the account JWK
 * (newAccount). `payload` null -> POST-as-GET (empty payload).
 */
export function signJws(accountKey: KeyObject, header: { nonce: string; url: string; kid?: string }, payload: unknown | null): FlattenedJws {
  const protectedHeader: Record<string, unknown> = { alg: 'ES256', nonce: header.nonce, url: header.url };
  if (header.kid) protectedHeader.kid = header.kid;
  else protectedHeader.jwk = jwkOf(accountKey);
  const p = base64url(JSON.stringify(protectedHeader));
  const pl = payload === null ? '' : base64url(JSON.stringify(payload));
  const signature = sign('sha256', Buffer.from(`${p}.${pl}`, 'ascii'), { key: accountKey, dsaEncoding: 'ieee-p1363' });
  return { protected: p, payload: pl, signature: base64url(signature) };
}

// Client ----------------------------------------------------------------------------------------

function parseJson<T>(res: HttpResponse): T {
  try {
    return JSON.parse(res.body.toString('utf8')) as T;
  } catch {
    const err = new AcmeError(res.status, { detail: `the ACME server sent an unreadable answer (HTTP ${res.status})` });
    err.detailKey = 'server.remote.detail.unreadable';
    err.detailParams = { status: res.status };
    throw err;
  }
}

/** Retry-After in milliseconds (delta-seconds or an HTTP date); null when absent. */
export function retryAfterMs(res: HttpResponse, now = Date.now()): number | null {
  const raw = headerValue(res.headers, 'retry-after');
  if (!raw) return null;
  if (/^\d+$/.test(raw.trim())) return Number(raw.trim()) * 1000;
  const at = Date.parse(raw);
  return Number.isFinite(at) ? Math.max(0, at - now) : null;
}

export interface AcmeClientOptions {
  signal?: AbortSignal;
  /** Per-request timeout (default 30 s). */
  timeoutMs?: number;
}

export class AcmeClient {
  private dir: AcmeDirectory | null = null;
  private nonce: string | null = null;
  /** Account URL, known after `ensureAccount`. */
  kid: string | null = null;
  /** Every request stays on the directory's origin (Let's Encrypt serves the whole API from one host). */
  private readonly origin: string;

  constructor(
    readonly directoryUrl: string,
    private readonly accountKey: KeyObject,
    private readonly opts: AcmeClientOptions = {},
  ) {
    this.origin = new URL(directoryUrl).origin;
  }

  private request(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<HttpResponse> {
    throwIfAborted(this.opts.signal);
    // URLs come from the server's answers; following one to another host would break the promise
    // that remote access contacts only DuckDNS and Let's Encrypt.
    let origin: string | null = null;
    try {
      origin = new URL(url).origin;
    } catch {
      /* invalid URL: refused below */
    }
    if (origin !== this.origin) return Promise.reject(new AcmeError(0, { detail: 'the ACME server pointed to another host' }));
    return httpRequest(url, { ...init, signal: this.opts.signal, timeoutMs: this.opts.timeoutMs ?? 30_000 });
  }

  async directory(): Promise<AcmeDirectory> {
    if (this.dir) return this.dir;
    const res = await this.request(this.directoryUrl);
    if (res.status !== 200) throw new AcmeError(res.status, parseProblem(res));
    const dir = parseJson<AcmeDirectory>(res);
    if (!dir.newNonce || !dir.newAccount || !dir.newOrder) throw new AcmeError(res.status, { detail: 'incomplete ACME directory' });
    this.dir = dir;
    return dir;
  }

  private remember(res: HttpResponse): void {
    const n = headerValue(res.headers, 'replay-nonce');
    if (n) this.nonce = n;
  }

  private async takeNonce(): Promise<string> {
    if (this.nonce) {
      const n = this.nonce;
      this.nonce = null;
      return n;
    }
    const dir = await this.directory();
    const res = await this.request(dir.newNonce, { method: 'HEAD' });
    const n = headerValue(res.headers, 'replay-nonce');
    if (!n) throw new AcmeError(res.status, { detail: 'the ACME server sent no nonce' });
    return n;
  }

  /** Signed POST (payload null = POST-as-GET). Retries badNonce up to three times. */
  async post(url: string, payload: unknown | null, opts: { useJwk?: boolean; accept?: string } = {}): Promise<HttpResponse> {
    if (!opts.useJwk && !this.kid) throw new Error('ACME account not registered yet');
    for (let attempt = 0; ; attempt++) {
      const nonce = await this.takeNonce();
      const jws = signJws(this.accountKey, { nonce, url, kid: opts.useJwk ? undefined : (this.kid as string) }, payload);
      const headers: Record<string, string> = { 'Content-Type': 'application/jose+json' };
      if (opts.accept) headers.Accept = opts.accept;
      const res = await this.request(url, { method: 'POST', headers, body: JSON.stringify(jws) });
      this.remember(res);
      if (res.status < 400) return res;
      const problem = parseProblem(res);
      if (problem.type === 'urn:ietf:params:acme:error:badNonce' && attempt < 3) continue;
      throw new AcmeError(res.status, problem);
    }
  }

  async postJson<T>(url: string, payload: unknown | null): Promise<{ body: T; res: HttpResponse }> {
    const res = await this.post(url, payload);
    return { body: parseJson<T>(res), res };
  }

  /** Registers the account key (or finds the existing account - newAccount is idempotent per key). */
  async ensureAccount(): Promise<string> {
    if (this.kid) return this.kid;
    const dir = await this.directory();
    const res = await this.post(dir.newAccount, { termsOfServiceAgreed: true }, { useJwk: true });
    const kid = headerValue(res.headers, 'location');
    if (!kid) throw new AcmeError(res.status, { detail: 'the ACME server sent no account URL' });
    this.kid = kid;
    return kid;
  }

  async newOrder(hostname: string): Promise<{ url: string; order: AcmeOrder }> {
    const dir = await this.directory();
    const res = await this.post(dir.newOrder, { identifiers: [{ type: 'dns', value: hostname }] });
    const url = headerValue(res.headers, 'location');
    if (!url) throw new AcmeError(res.status, { detail: 'the ACME server sent no order URL' });
    return { url, order: parseJson<AcmeOrder>(res) };
  }
}

function parseProblem(res: HttpResponse): AcmeProblem {
  try {
    const p = JSON.parse(res.body.toString('utf8')) as AcmeProblem;
    return typeof p === 'object' && p ? p : { status: res.status };
  } catch {
    return { status: res.status, detail: `HTTP ${res.status}` };
  }
}

// Certificate flow ------------------------------------------------------------------------------

export interface ObtainOptions {
  directoryUrl: string;
  hostname: string;
  accountKey: KeyObject;
  /** Publishes the dns-01 TXT value (DuckDNS). Throws a RemoteError when DuckDNS refuses. */
  setTxt(value: string): Promise<void>;
  /** Removes the TXT value again (best effort, called on success and failure). */
  clearTxt(): Promise<void>;
  /** Resolves true once `name` answers `value` (default in manager: the DuckDNS name servers, ~2 minutes). */
  waitForTxt(name: string, value: string, signal?: AbortSignal): Promise<boolean>;
  /** Progress reports: a 'server.remote.step.certificate.*' key + parameters. */
  onProgress?: (key: string, params?: RemoteParams) => void;
  signal?: AbortSignal;
  /** Interval between authorization / order polls (default 2 s; Retry-After is honoured up to 10 s). */
  pollIntervalMs?: number;
  /** Give up polling after this long (default 2 minutes). */
  pollTimeoutMs?: number;
  /** Per-request timeout. */
  timeoutMs?: number;
}

export interface ObtainedCertificate {
  /** PKCS#8 PEM of the new certificate key. */
  keyPem: string;
  /** PEM chain, leaf first, as downloaded. */
  certPem: string;
}

function problemText(p: AcmeProblem | undefined): string {
  if (!p) return 'unknown error';
  const type = p.type ? p.type.replace('urn:ietf:params:acme:error:', '') : '';
  return errorText(p.detail || type || 'unknown error');
}

async function poll<T>(
  fetch: () => Promise<{ body: T; res: HttpResponse }>,
  isDone: (v: T) => boolean,
  failure: (v: T) => RemoteError | null,
  o: ObtainOptions,
): Promise<T> {
  const interval = o.pollIntervalMs ?? 2000;
  const deadline = Date.now() + (o.pollTimeoutMs ?? 120_000);
  for (;;) {
    const { body, res } = await fetch();
    if (isDone(body)) return body;
    const err = failure(body);
    if (err) throw err;
    if (Date.now() >= deadline) throw new RemoteError('server.remote.step.certificate.timeout');
    const after = retryAfterMs(res);
    await sleep(after === null ? interval : Math.min(Math.max(after, interval), 10_000), o.signal);
  }
}

/** Maps any failure of the flow to a RemoteError with a 'server.remote.step.certificate.*' key. */
export function toCertificateError(e: unknown): Error {
  if (isCancelled(e)) return new CancelledError();
  if (e instanceof RemoteError) return e;
  if (e instanceof AcmeError) {
    if (e.problem.type === 'urn:ietf:params:acme:error:rateLimited') {
      return new RemoteError('server.remote.step.certificate.rateLimited', { detail: problemText(e.problem) });
    }
    return new RemoteError('server.remote.step.certificate.rejected', { detail: problemText(e.problem) });
  }
  return new RemoteError('server.remote.step.certificate.unreachable', { detail: errorText(e) });
}

/**
 * Runs the whole dns-01 flow for `hostname` and returns the new key + chain. The TXT record is
 * removed again whatever happens. Errors are RemoteError (or CancelledError when `signal` aborts).
 */
export async function obtainCertificate(o: ObtainOptions): Promise<ObtainedCertificate> {
  const progress = o.onProgress ?? (() => {});
  const client = new AcmeClient(o.directoryUrl, o.accountKey, { signal: o.signal, timeoutMs: o.timeoutMs });
  let txtPublished = false;
  try {
    progress('server.remote.step.certificate.account');
    await client.ensureAccount();

    progress('server.remote.step.certificate.order', { hostname: o.hostname });
    const created = await client.newOrder(o.hostname);
    const orderUrl = created.url;
    let order = created.order;
    if (order.status === 'invalid') throw new RemoteError('server.remote.step.certificate.rejected', { detail: problemText(order.error) });

    for (const authzUrl of order.authorizations) {
      const { body: authz } = await client.postJson<AcmeAuthorization>(authzUrl, null);
      if (authz.status === 'valid') continue;
      if (authz.status !== 'pending') {
        throw new RemoteError('server.remote.step.certificate.rejected', { detail: `authorization ${authz.status}` });
      }
      const challenge = authz.challenges.find((c) => c.type === 'dns-01');
      if (!challenge) throw new RemoteError('server.remote.step.certificate.rejected', { detail: 'no dns-01 challenge offered' });
      const value = dns01TxtValue(keyAuthorization(challenge.token, o.accountKey));

      progress('server.remote.step.certificate.publishTxt');
      await o.setTxt(value);
      txtPublished = true;

      progress('server.remote.step.certificate.waitDns');
      const seen = await o.waitForTxt(`_acme-challenge.${authz.identifier.value}`, value, o.signal);
      throwIfAborted(o.signal);
      if (!seen) throw new RemoteError('server.remote.step.certificate.dnsTimeout');

      progress('server.remote.step.certificate.validating');
      await client.post(challenge.url, {});
      await poll<AcmeAuthorization>(
        () => client.postJson<AcmeAuthorization>(authzUrl, null),
        (a) => a.status === 'valid',
        (a) => {
          if (a.status === 'pending') return null;
          const failed = a.challenges.find((c) => c.type === 'dns-01');
          return new RemoteError('server.remote.step.certificate.rejected', { detail: problemText(failed?.error ?? { detail: `authorization ${a.status}` }) });
        },
        o,
      );
    }

    progress('server.remote.step.certificate.finalizing');
    order = await poll<AcmeOrder>(
      () => client.postJson<AcmeOrder>(orderUrl, null),
      (v) => v.status === 'ready' || v.status === 'valid' || v.status === 'processing',
      (v) => (v.status === 'invalid' ? new RemoteError('server.remote.step.certificate.rejected', { detail: problemText(v.error) }) : null),
      o,
    );
    const certKey = generateEcKey();
    if (order.status === 'ready') {
      const csr = buildCsr(o.hostname, certKey);
      order = (await client.postJson<AcmeOrder>(order.finalize, { csr: base64url(csr.der) })).body;
    }
    if (order.status !== 'valid') {
      order = await poll<AcmeOrder>(
        () => client.postJson<AcmeOrder>(orderUrl, null),
        (v) => v.status === 'valid' && !!v.certificate,
        (v) => (v.status === 'invalid' ? new RemoteError('server.remote.step.certificate.rejected', { detail: problemText(v.error) }) : null),
        o,
      );
    }
    if (!order.certificate) throw new RemoteError('server.remote.step.certificate.rejected', { detail: 'no certificate URL' });

    progress('server.remote.step.certificate.downloading');
    const res = await client.post(order.certificate, null, { accept: 'application/pem-certificate-chain' });
    const blocks = splitPem(res.body.toString('utf8'));
    if (!blocks.length) throw new RemoteError('server.remote.step.certificate.rejected', { detail: 'the certificate download was empty' });
    const certPem = blocks.join('');
    // The chain must belong to the key we generated (a finalize from an earlier, abandoned run
    // would carry another key - then this run's order cannot be used).
    if (!leafOf(certPem).checkPrivateKey(createPrivateKey(keyToPem(certKey)))) {
      throw new RemoteError('server.remote.step.certificate.rejected', { detail: 'the certificate does not match the key' });
    }
    return { keyPem: keyToPem(certKey), certPem };
  } catch (e) {
    throw toCertificateError(e);
  } finally {
    if (txtPublished) await o.clearTxt().catch(() => {});
  }
}
