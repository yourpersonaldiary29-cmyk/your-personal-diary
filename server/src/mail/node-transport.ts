/**
 * The desktop SMTP transport: a minimal SMTP client on node:net / node:tls - no dependencies
 * (RFC 5321, 3207, 4954, 4616). The ONLY module of the mail code that opens sockets; the rest
 * (mail/service.ts, mail/errors.ts, mail/transport.ts, the routes) never imports node:net /
 * node:tls, so it also runs where those do not exist (the Android build injects its own
 * `SmtpTransport`; test/mail-import-graph.test.ts keeps it that way).
 *
 *   security 'tls'       implicit TLS from the first byte (port 465)
 *   security 'starttls'  plain greeting + EHLO, then STARTTLS (required - credentials are never sent
 *                        over an unencrypted connection), EHLO again inside TLS (port 587)
 *   AUTH                 PLAIN (preferred) or LOGIN
 *   MAIL FROM / RCPT TO / DATA with dot-stuffing, then QUIT
 *
 * Certificate validation is always on (the host name is checked against the certificate); TLS
 * 1.2 or newer. Every step has a timeout (20 s of inactivity by default). Failures are `SmtpError`s
 * carrying a catalogue key ('server.mail.error.*') and harmless parameters (host, port, SMTP reply
 * code) - never the password, the AUTH exchange or the reply text of the server.
 *
 * This is the mail part of the server's outbound network code: it connects only to the SMTP host
 * the owner configured, and only when an e-mail is sent (scripts/check-no-network.mjs).
 */
import net from 'node:net';
import { StringDecoder } from 'node:string_decoder';
import tls from 'node:tls';
import { SmtpError } from './errors';
import { dotStuff } from './mime';
import { assertSafeAddress, isGmailHost, SMTP_TIMEOUT_MS, type Envelope, type SmtpOptions, type SmtpTransport } from './transport';

interface Reply {
  code: number;
  lines: string[];
}

const CONNECT_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'ECONNRESET', 'EPIPE', 'EADDRNOTAVAIL']);
const TLS_MODE_CODES = new Set(['ERR_SSL_WRONG_VERSION_NUMBER', 'EPROTO', 'ERR_SSL_PACKET_LENGTH_TOO_LONG', 'ERR_SSL_UNKNOWN_PROTOCOL']);

/** Maps a socket / TLS error to an SmtpError. */
function socketError(e: unknown, opts: SmtpOptions): SmtpError {
  if (e instanceof SmtpError) return e;
  const err = e as NodeJS.ErrnoException & { reason?: string };
  const code = typeof err?.code === 'string' ? err.code : '';
  const where = { host: opts.host, port: opts.port };
  if (TLS_MODE_CODES.has(code) || /wrong version number|packet length too long|unknown protocol/i.test(err?.message ?? '')) {
    return new SmtpError('server.mail.error.tlsMode', where);
  }
  if (
    code.startsWith('ERR_TLS_') ||
    /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|UNABLE_TO_GET_ISSUER/.test(code) ||
    /certificate/i.test(err?.message ?? '')
  ) {
    return new SmtpError('server.mail.error.tls', where);
  }
  if (CONNECT_CODES.has(code)) return new SmtpError('server.mail.error.connect', where);
  return new SmtpError('server.mail.error.closed', where);
}

/**
 * One SMTP conversation. Reads replies (multi-line "250-..." until "250 ...") from whichever
 * socket is current; STARTTLS swaps the plain socket for the TLS one.
 */
class SmtpConnection {
  private socket: net.Socket | null = null;
  private decoder = new StringDecoder('utf8');
  private buffer = '';
  private partial: string[] = [];
  private replies: Reply[] = [];
  private waiter: { resolve: (r: Reply) => void; reject: (e: Error) => void } | null = null;
  private failure: SmtpError | null = null;
  private readonly timeoutMs: number;

  constructor(private readonly opts: SmtpOptions) {
    this.timeoutMs = opts.timeoutMs ?? SMTP_TIMEOUT_MS;
  }

  private tlsOptions(): tls.ConnectionOptions {
    return {
      servername: net.isIP(this.opts.host) ? undefined : this.opts.host,
      // The certificate must be valid for the configured host, even when connecting elsewhere (tests).
      checkServerIdentity: (_name, cert) => tls.checkServerIdentity(this.opts.host, cert),
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      ...(this.opts.ca ? { ca: this.opts.ca } : {}),
    };
  }

  /** Opens the connection (implicit TLS or plain for STARTTLS) and waits until it is established. */
  async open(): Promise<void> {
    const target = { host: this.opts.connectHost ?? this.opts.host, port: this.opts.port };
    const socket: net.Socket =
      this.opts.security === 'tls' ? tls.connect({ ...target, ...this.tlsOptions() }) : net.connect(target);
    await this.adopt(socket, this.opts.security === 'tls' ? 'secureConnect' : 'connect');
  }

  /** Makes `socket` the current one and resolves once `readyEvent` fired. */
  private adopt(socket: net.Socket, readyEvent: 'connect' | 'secureConnect'): Promise<void> {
    this.socket = socket;
    socket.setTimeout(this.timeoutMs);
    socket.on('timeout', () => this.fail(new SmtpError('server.mail.error.timeout', { host: this.opts.host, port: this.opts.port })));
    socket.on('error', (e) => this.fail(socketError(e, this.opts)));
    socket.on('close', () => this.fail(new SmtpError('server.mail.error.closed', { host: this.opts.host, port: this.opts.port })));
    socket.on('data', (chunk: Buffer) => this.onData(chunk));
    return new Promise((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onFail = (e: unknown) => {
        cleanup();
        reject(socketError(e, this.opts));
      };
      const onTimeout = () => onFail(new SmtpError('server.mail.error.timeout', { host: this.opts.host, port: this.opts.port }));
      const cleanup = () => {
        socket.off(readyEvent, onReady);
        socket.off('error', onFail);
        socket.off('timeout', onTimeout);
      };
      socket.once(readyEvent, onReady);
      socket.once('error', onFail);
      socket.once('timeout', onTimeout);
    });
  }

  private onData(chunk: Buffer): void {
    this.buffer += this.decoder.write(chunk);
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).replace(/\r$/, '');
      this.buffer = this.buffer.slice(idx + 1);
      this.onLine(line);
    }
    // A server never sends a reply line this long; stop reading instead of growing the buffer.
    if (this.buffer.length > 64 * 1024) this.fail(new SmtpError('server.mail.error.closed', { host: this.opts.host, port: this.opts.port }));
  }

  private onLine(line: string): void {
    const m = /^(\d{3})([ -]?)(.*)$/.exec(line);
    if (!m) {
      this.fail(new SmtpError('server.mail.error.protocol', { host: this.opts.host, port: this.opts.port }));
      return;
    }
    this.partial.push(m[3]);
    if (m[2] === '-') return;
    const reply: Reply = { code: Number(m[1]), lines: this.partial };
    this.partial = [];
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w.resolve(reply);
    } else {
      this.replies.push(reply);
    }
  }

  private fail(e: SmtpError): void {
    if (this.failure) return;
    this.failure = e;
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w.reject(e);
    }
    this.socket?.destroy();
  }

  /** The next reply of the server. */
  read(): Promise<Reply> {
    const next = this.replies.shift();
    if (next) return Promise.resolve(next);
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.waiter = { resolve, reject };
    });
  }

  write(line: string): void {
    if (this.failure) throw this.failure;
    this.socket?.write(`${line}\r\n`);
  }

  /** Sends `line` and returns the reply; a reply code outside `expect` becomes `onError(code)`. */
  async command(line: string, expect: number[], onError: (code: number) => SmtpError): Promise<Reply> {
    this.write(line);
    const reply = await this.read();
    if (!expect.includes(reply.code)) throw onError(reply.code);
    return reply;
  }

  /**
   * STARTTLS: after the 220 answer the conversation continues inside TLS on the same TCP
   * connection. Anything the server sent before the handshake is discarded as an attack
   * (response injection), and the capabilities are asked again.
   */
  async upgrade(): Promise<void> {
    const plain = this.socket;
    if (!plain) throw new SmtpError('server.mail.error.closed', { host: this.opts.host, port: this.opts.port });
    if (this.buffer || this.replies.length || this.partial.length) {
      throw new SmtpError('server.mail.error.protocol', { host: this.opts.host, port: this.opts.port });
    }
    plain.removeAllListeners('data');
    plain.removeAllListeners('timeout');
    plain.removeAllListeners('error');
    plain.removeAllListeners('close');
    plain.setTimeout(0);
    // Errors of the plain socket now surface through the TLS socket.
    plain.on('error', () => {});
    this.decoder = new StringDecoder('utf8');
    const secure = tls.connect({ socket: plain, ...this.tlsOptions() });
    await this.adopt(secure, 'secureConnect');
  }

  close(): void {
    const s = this.socket;
    this.socket = null;
    if (!s) return;
    this.failure ??= new SmtpError('server.mail.error.closed', { host: this.opts.host, port: this.opts.port });
    s.removeAllListeners('close');
    s.end();
    setTimeout(() => s.destroy(), 1000).unref?.();
  }
}

/** Capabilities from an EHLO reply (upper-case keywords). */
function capabilities(reply: Reply): { starttls: boolean; auth: string[] } {
  let starttls = false;
  const auth: string[] = [];
  for (const line of reply.lines.slice(1)) {
    const upper = line.trim().toUpperCase();
    if (upper === 'STARTTLS') starttls = true;
    const m = /^AUTH[ =](.*)$/.exec(upper);
    if (m) auth.push(...m[1].split(/\s+/).filter(Boolean));
  }
  return { starttls, auth };
}

/**
 * Delivers one message (`data` = headers + body with CRLF line ends, as built by mime.ts) to the
 * SMTP server: connect, (STARTTLS,) authenticate, MAIL FROM, RCPT TO, DATA, QUIT.
 */
export async function sendMail(opts: SmtpOptions, envelope: Envelope, data: string): Promise<void> {
  assertSafeAddress(envelope.from);
  assertSafeAddress(envelope.to);
  if (!opts.username || !opts.password) throw new SmtpError('server.mail.error.auth', { host: opts.host });
  const conn = new SmtpConnection(opts);
  const where = { host: opts.host, port: opts.port };
  const rejected = (code: number) => new SmtpError('server.mail.error.rejected', { ...where, code }, code);
  try {
    await conn.open();
    const greeting = await conn.read();
    if (greeting.code !== 220) throw rejected(greeting.code);
    const localName = opts.localName ?? 'localhost';
    let ehlo = await conn.command(`EHLO ${localName}`, [250], rejected);
    if (opts.security === 'starttls') {
      if (!capabilities(ehlo).starttls) throw new SmtpError('server.mail.error.noStarttls', where);
      await conn.command('STARTTLS', [220], rejected);
      await conn.upgrade();
      ehlo = await conn.command(`EHLO ${localName}`, [250], rejected);
    }

    // Authentication - the exchange itself never reaches an error, a log line or a status.
    const mechanisms = capabilities(ehlo).auth;
    const authFailed = (code: number) =>
      new SmtpError(isGmailHost(opts.host) ? 'server.mail.error.authGmail' : 'server.mail.error.auth', { ...where, code }, code);
    if (mechanisms.includes('PLAIN')) {
      const token = Buffer.from(`\0${opts.username}\0${opts.password}`, 'utf8').toString('base64');
      await conn.command(`AUTH PLAIN ${token}`, [235], authFailed);
    } else if (mechanisms.includes('LOGIN')) {
      await conn.command('AUTH LOGIN', [334], authFailed);
      await conn.command(Buffer.from(opts.username, 'utf8').toString('base64'), [334], authFailed);
      await conn.command(Buffer.from(opts.password, 'utf8').toString('base64'), [235], authFailed);
    } else {
      throw new SmtpError('server.mail.error.noAuth', where);
    }

    await conn.command(`MAIL FROM:<${envelope.from}>`, [250], (code) => new SmtpError('server.mail.error.sender', { ...where, code }, code));
    await conn.command(`RCPT TO:<${envelope.to}>`, [250, 251], (code) => new SmtpError('server.mail.error.recipient', { ...where, code }, code));
    await conn.command('DATA', [354], rejected);
    const body = dotStuff(data.endsWith('\r\n') ? data : `${data}\r\n`);
    // The terminating "." line; write() adds its CRLF.
    conn.write(`${body}.`);
    const accepted = await conn.read();
    if (accepted.code !== 250) throw rejected(accepted.code);
    try {
      conn.write('QUIT');
      await Promise.race([conn.read(), new Promise((r) => setTimeout(r, 2000).unref?.())]);
    } catch {
      /* the message is accepted; a rude goodbye does not matter */
    }
  } catch (e) {
    throw socketError(e, opts);
  } finally {
    conn.close();
  }
}

/** The node:net / node:tls client as an `SmtpTransport` - what the desktop server sends e-mail with. */
export const nodeSmtpTransport: SmtpTransport = { send: sendMail };
