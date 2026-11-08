/**
 * The HTTPS listener of remote access: a node:https server on 0.0.0.0 serving the same request
 * handler as the loopback / LAN listeners (the Express app behind the host check).
 *
 *  - port: the public port (443 by default); when it cannot be opened (busy, or not allowed) the
 *    fallback port 8443 is used and the router maps publicPort -> 8443;
 *  - TLS 1.2+ only; the certificate is hot-reloaded after a renewal (`reload`), open connections
 *    keep going;
 *  - every answer carries HSTS (1 year), X-Content-Type-Options and frame-ancestors 'none' - also
 *    the ones written before the app runs (421 of the host check).
 */
import http from 'node:http';
import https from 'node:https';
import type { Socket } from 'node:net';

export const DEFAULT_FALLBACK_TLS_PORT = 8443;
export const HSTS_VALUE = 'max-age=31536000';

export interface TlsCredentials {
  keyPem: string;
  certPem: string;
}

export interface TlsListener {
  /** The port actually listening. */
  readonly port: number;
  /** The port that was asked for (differs from `port` after a fallback). */
  readonly requestedPort: number;
  readonly server: https.Server;
  /** Swaps the certificate for new connections. */
  reload(creds: TlsCredentials): void;
  close(): Promise<void>;
}

export interface TlsListenOptions {
  port: number;
  /** Used when `port` cannot be opened (default 8443). null disables the fallback. */
  fallbackPort?: number | null;
  host?: string;
}

/** Adds the transport security headers every HTTPS answer carries. */
export function applyTlsHeaders(res: http.ServerResponse): void {
  res.setHeader('Strict-Transport-Security', HSTS_VALUE);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!res.hasHeader('Content-Security-Policy')) res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
}

function listenOnce(server: https.Server, port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (e: Error) => {
      server.off('listening', onListening);
      reject(e);
    };
    const onListening = () => {
      server.off('error', onError);
      const addr = server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

export async function startTlsListener(handler: http.RequestListener, creds: TlsCredentials, opts: TlsListenOptions): Promise<TlsListener> {
  const host = opts.host ?? '0.0.0.0';
  const fallback = opts.fallbackPort === undefined ? DEFAULT_FALLBACK_TLS_PORT : opts.fallbackPort;
  const make = () => {
    const server = https.createServer({ key: creds.keyPem, cert: creds.certPem, minVersion: 'TLSv1.2' }, (req, res) => {
      applyTlsHeaders(res);
      handler(req, res);
    });
    // A failed handshake (scanners, old clients) must not surface as an error of the server.
    server.on('tlsClientError', (_err: Error, socket: Socket) => socket.destroy());
    return server;
  };

  let server = make();
  let port: number;
  try {
    port = await listenOnce(server, opts.port, host);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (fallback === null || fallback === opts.port || (code !== 'EADDRINUSE' && code !== 'EACCES')) throw e;
    server = make();
    port = await listenOnce(server, fallback, host);
  }

  const live = server;
  return {
    port,
    requestedPort: opts.port,
    server: live,
    reload(next: TlsCredentials) {
      live.setSecureContext({ key: next.keyPem, cert: next.certPem, minVersion: 'TLSv1.2' });
    },
    close() {
      return new Promise<void>((resolve) => {
        live.closeAllConnections?.();
        live.close(() => resolve());
      });
    },
  };
}
