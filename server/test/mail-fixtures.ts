/**
 * In-process mock SMTP server on 127.0.0.1 for the mail tests - nothing ever leaves the machine,
 * no real mail is sent. Speaks implicit TLS (like port 465) or plain + STARTTLS (like 587) with a
 * certificate from the test CA of remote-fixtures.ts, AUTH PLAIN / LOGIN, MAIL / RCPT / DATA
 * (dot-unstuffing) and QUIT, and captures every accepted message. Knobs simulate the failures the
 * client must report: wrong credentials, no STARTTLS, a rejected recipient, a silent server,
 * response injection after STARTTLS.
 */
import net from 'node:net';
import tls from 'node:tls';
import type { AddressInfo } from 'node:net';
import { makeLeaf, makeTestCa, type TestCa } from './remote-fixtures';

export interface CapturedMail {
  from: string;
  to: string[];
  /** The message as received (dot-unstuffed, CRLF line ends, without the final "."). */
  data: string;
  authUser: string;
  /** True when the message arrived over TLS. */
  secure: boolean;
}

export interface MockSmtpOptions {
  mode: 'tls' | 'starttls';
  /** Name on the server certificate (the client checks it against the configured host). */
  hostname: string;
  /** CA that signs the certificate (default: a fresh test CA; the client must trust `ca.certPem`). */
  ca?: TestCa;
  /** Accepted credentials (username -> password). */
  users?: Record<string, string>;
  /** Offered AUTH mechanisms (default PLAIN LOGIN). */
  authMechanisms?: string[];
  /** Offer STARTTLS in 'starttls' mode (default true). */
  offerStarttls?: boolean;
  /** Answer RCPT TO with 550. */
  rejectRecipient?: boolean;
  /** Accept the connection but never say anything (timeout tests). */
  silent?: boolean;
  /** Send an extra reply right after "220" to STARTTLS (response injection). */
  injectAfterStarttls?: boolean;
}

export interface MockSmtp {
  port: number;
  ca: TestCa;
  messages: CapturedMail[];
  /** Every command line received (AUTH arguments included - test-only). */
  commands: string[];
  /** Resolves once `count` messages were captured. */
  waitForMessages(count: number, timeoutMs?: number): Promise<void>;
  close(): Promise<void>;
}

export async function startMockSmtp(opts: MockSmtpOptions): Promise<MockSmtp> {
  const ca = opts.ca ?? makeTestCa('Mock SMTP Root');
  const leaf = makeLeaf(ca, opts.hostname);
  const users = opts.users ?? {};
  const mechanisms = opts.authMechanisms ?? ['PLAIN', 'LOGIN'];
  const messages: CapturedMail[] = [];
  const commands: string[] = [];
  const sockets = new Set<net.Socket>();
  const waiters: Array<{ count: number; resolve: () => void }> = [];

  const notify = () => {
    for (const w of waiters.splice(0)) {
      if (messages.length >= w.count) w.resolve();
      else waiters.push(w);
    }
  };

  function session(initial: net.Socket, startSecure: boolean): void {
    let socket: net.Socket = initial;
    let secure = startSecure;
    let buffer = '';
    let authUser = '';
    let from = '';
    let to: string[] = [];
    let inData = false;
    let dataLines: string[] = [];
    let pending: ((line: string) => void) | null = null;
    sockets.add(socket);
    const send = (s: string) => socket.write(`${s}\r\n`);

    const ehlo = () => {
      const lines = ['250-mock.smtp.test'];
      if (opts.mode === 'starttls' && !secure && opts.offerStarttls !== false) lines.push('250-STARTTLS');
      if (mechanisms.length) lines.push(`250-AUTH ${mechanisms.join(' ')}`);
      lines.push('250 8BITMIME');
      socket.write(lines.join('\r\n') + '\r\n');
    };

    const checkLogin = (user: string, pass: string) => {
      if (users[user] !== undefined && users[user] === pass) {
        authUser = user;
        send('235 2.7.0 Accepted');
      } else {
        send('535 5.7.8 Username and Password not accepted');
      }
    };

    const onLine = (line: string) => {
      if (inData) {
        if (line === '.') {
          inData = false;
          messages.push({ from, to, data: dataLines.map((l) => (l.startsWith('..') ? l.slice(1) : l)).join('\r\n'), authUser, secure });
          dataLines = [];
          send('250 2.0.0 OK queued');
          notify();
        } else {
          dataLines.push(line);
        }
        return;
      }
      commands.push(line);
      if (pending) {
        const p = pending;
        pending = null;
        p(line);
        return;
      }
      const upper = line.toUpperCase();
      if (upper.startsWith('EHLO') || upper.startsWith('HELO')) return ehlo();
      if (upper === 'STARTTLS') {
        if (opts.mode !== 'starttls' || secure) return send('503 5.5.1 Already secure');
        socket.write(opts.injectAfterStarttls ? '220 2.0.0 Ready\r\n250 injected\r\n' : '220 2.0.0 Ready to start TLS\r\n');
        const plain = socket;
        plain.removeAllListeners('data');
        const upgraded = new tls.TLSSocket(plain, { isServer: true, key: leaf.keyPem, cert: leaf.certPem });
        upgraded.on('error', () => {});
        socket = upgraded;
        sockets.add(upgraded);
        secure = true;
        buffer = '';
        upgraded.on('data', onData);
        return;
      }
      if (upper.startsWith('AUTH PLAIN')) {
        const arg = line.slice('AUTH PLAIN'.length).trim();
        const decode = (b64: string) => {
          const parts = Buffer.from(b64, 'base64').toString('utf8').split('\0');
          checkLogin(parts[1] ?? '', parts[2] ?? '');
        };
        if (arg) return decode(arg);
        send('334 ');
        pending = decode;
        return;
      }
      if (upper === 'AUTH LOGIN') {
        send('334 VXNlcm5hbWU6');
        pending = (u) => {
          const user = Buffer.from(u, 'base64').toString('utf8');
          send('334 UGFzc3dvcmQ6');
          pending = (p) => checkLogin(user, Buffer.from(p, 'base64').toString('utf8'));
        };
        return;
      }
      if (upper.startsWith('MAIL FROM:')) {
        if (!authUser) return send('530 5.7.0 Authentication required');
        from = /<([^>]*)>/.exec(line)?.[1] ?? '';
        to = [];
        return send('250 2.1.0 OK');
      }
      if (upper.startsWith('RCPT TO:')) {
        if (opts.rejectRecipient) return send('550 5.1.1 No such user');
        to.push(/<([^>]*)>/.exec(line)?.[1] ?? '');
        return send('250 2.1.5 OK');
      }
      if (upper === 'DATA') {
        if (!from || !to.length) return send('503 5.5.1 Bad sequence');
        inData = true;
        return send('354 Go ahead');
      }
      if (upper === 'QUIT') {
        send('221 2.0.0 Bye');
        socket.end();
        return;
      }
      if (upper === 'RSET' || upper === 'NOOP') return send('250 OK');
      send('502 5.5.2 Unknown command');
    };

    function onData(chunk: Buffer): void {
      buffer += chunk.toString('utf8');
      let idx: number;
      while ((idx = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        onLine(line);
      }
    }

    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
    if (opts.silent) return;
    socket.on('data', onData);
    send('220 mock.smtp.test ESMTP ready');
  }

  const server: net.Server =
    opts.mode === 'tls'
      ? tls.createServer({ key: leaf.keyPem, cert: leaf.certPem }, (s) => session(s, true))
      : net.createServer((s) => session(s, false));
  server.on('tlsClientError', () => {});
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as AddressInfo).port;

  return {
    port,
    ca,
    messages,
    commands,
    waitForMessages(count, timeoutMs = 10_000) {
      if (messages.length >= count) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`mock SMTP: expected ${count} messages, got ${messages.length}`)), timeoutMs);
        waiters.push({
          count,
          resolve: () => {
            clearTimeout(timer);
            resolve();
          },
        });
      });
    },
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}

// MIME helpers for the assertions -----------------------------------------------------------------

/** Headers of a received message (unfolded, keys lower-cased). */
export function headersOf(data: string): Record<string, string> {
  const head = data.split('\r\n\r\n')[0];
  const out: Record<string, string> = {};
  for (const line of head.replace(/\r\n[ \t]+/g, ' ').split('\r\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) out[line.slice(0, idx).toLowerCase()] = line.slice(idx + 1).trim();
  }
  return out;
}

/** Decodes RFC 2047 'B' encoded-words (UTF-8) of a header value. */
export function decodeWords(value: string): string {
  return value
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?UTF-8\?B\?([^?]*)\?=/gi, (_m, b64: string) => Buffer.from(b64, 'base64').toString('utf8'));
}

/** The decoded text/plain and text/html parts of a multipart/alternative message. */
export function partsOf(data: string): { text: string; html: string } {
  const boundary = /boundary="([^"]+)"/.exec(headersOf(data)['content-type'] ?? '')?.[1];
  if (!boundary) throw new Error('no boundary');
  const out = { text: '', html: '' };
  for (const part of data.split(`--${boundary}`).slice(1)) {
    if (part.startsWith('--')) break;
    const [head, ...rest] = part.replace(/^\r\n/, '').split('\r\n\r\n');
    const body = Buffer.from(rest.join('\r\n\r\n').replace(/\s+/g, ''), 'base64').toString('utf8');
    if (/text\/plain/i.test(head)) out.text = body;
    if (/text\/html/i.test(head)) out.html = body;
  }
  return out;
}

/** The link token and the 6-digit code of a reset e-mail (from the text part). */
export function resetDetailsOf(mail: CapturedMail): { link: string; token: string; code: string } {
  const { text } = partsOf(mail.data);
  const link = /(https?:\/\/\S+#\/reset-password\?token=([A-Za-z0-9_-]{43}))/.exec(text);
  const code = /^(\d{6})$/m.exec(text);
  if (!link || !code) throw new Error(`no link / code in:\n${text}`);
  return { link: link[1], token: link[2], code: code[1] };
}
