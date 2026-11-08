/**
 * The one HTTP(S) client of the server, used ONLY by the remote-access module while remote access
 * is turned on (or while the owner runs "Test connection"):
 *   - https to www.duckdns.org (IP / TXT updates) and to Let's Encrypt (ACME);
 *   - plain http to the home router's UPnP endpoints on the local network.
 * Tests point it at in-process mock servers on 127.0.0.1.
 *
 * scripts/check-no-network.mjs allows outbound calls in server/src/remote/** only.
 */
import http from 'node:http';
import https from 'node:https';

export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  /** Whole-request timeout (default 20 s). */
  timeoutMs?: number;
  /** Largest accepted response body (default 1 MiB). */
  maxBytes?: number;
  signal?: AbortSignal;
  /** Extra trusted CA (tests with a local https mock). */
  ca?: string | Buffer;
  /** Force the IP family of the connection (DuckDNS detects the caller's address over IPv4 only). */
  family?: 4 | 6;
}

export interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  /** Local address of the socket (which network interface reached the server). */
  localAddress: string | undefined;
}

export function headerValue(headers: http.IncomingHttpHeaders, name: string): string | undefined {
  const v = headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

export function responseText(res: HttpResponse): string {
  return res.body.toString('utf8');
}

export class HttpError extends Error {
  /** Set for texts the app writes itself (see KeyedDetail in errors.ts). */
  readonly detailKey?: string;
  readonly detailParams?: Record<string, string | number>;
  constructor(message: string, keyed?: { key: string; params: Record<string, string | number> }) {
    super(message);
    this.name = 'HttpError';
    if (keyed) {
      this.detailKey = keyed.key;
      this.detailParams = keyed.params;
    }
  }
}

/** Performs one request and buffers the response. Rejects on network errors, timeouts and oversize bodies. */
export function httpRequest(url: string, opts: HttpRequestOptions = {}): Promise<HttpResponse> {
  const target = new URL(url);
  const isHttps = target.protocol === 'https:';
  if (!isHttps && target.protocol !== 'http:') return Promise.reject(new HttpError(`unsupported protocol ${target.protocol}`));
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const maxBytes = opts.maxBytes ?? 1024 * 1024;
  const headers: Record<string, string> = { 'User-Agent': 'YourPersonalDiary', ...opts.headers };
  if (opts.body !== undefined) headers['Content-Length'] = String(Buffer.byteLength(opts.body));

  return new Promise<HttpResponse>((resolve, reject) => {
    let settled = false;
    const done = (err: Error | null, value?: HttpResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(value as HttpResponse);
    };
    const requestOptions: https.RequestOptions = {
      method: opts.method ?? 'GET',
      headers,
      signal: opts.signal,
      // One connection per request: these calls are rare, and no socket outlives its request.
      agent: false,
      ...(opts.family ? { family: opts.family } : {}),
      ...(isHttps && opts.ca ? { ca: opts.ca } : {}),
    };
    const req = (isHttps ? https : http).request(target, requestOptions, (res) => {
      const localAddress = res.socket?.localAddress;
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          req.destroy();
          done(new HttpError('response too large'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () =>
        done(null, {
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
          localAddress,
        }),
      );
      res.on('error', (e) => done(e));
    });
    const timer = setTimeout(() => {
      req.destroy();
      const seconds = Math.round(timeoutMs / 1000);
      done(new HttpError(`timed out after ${seconds} s`, { key: 'server.remote.detail.timeout', params: { seconds } }));
    }, timeoutMs);
    req.on('error', (e) => done(e));
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}
