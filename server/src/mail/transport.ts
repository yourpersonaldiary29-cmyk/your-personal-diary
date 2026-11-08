/**
 * The seam between "what to send" (mail/service.ts: settings, MIME message, envelope) and "how the
 * SMTP conversation is carried out" - pure: types and string helpers only, no socket code.
 *
 *   desktop   mail/node-transport.ts - the dependency-free client on node:net / node:tls
 *             (server.ts passes it to the mail service; it is the default of `startServer`)
 *   Android   a Capacitor plugin (Java sockets) behind the same interface, injected by the mobile
 *             core - a WebView has no TCP sockets
 *
 * Every transport must follow the same rules as the node client: implicit TLS or mandatory STARTTLS
 * (credentials never travel unencrypted), full certificate validation for `host`, AUTH PLAIN / LOGIN,
 * a timeout per step, and failures reported as `SmtpError` (mail/errors.ts) with a catalogue key and
 * harmless parameters only.
 */
import { SmtpError } from './errors';

export type SmtpSecurity = 'tls' | 'starttls';

export const SMTP_TIMEOUT_MS = 20_000;

export interface SmtpOptions {
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password: string;
  /**
   * Trusted certificate authorities instead of the system ones (tests: the CA of the in-process
   * mock server). Never used to switch validation off.
   */
  ca?: string | Buffer | Array<string | Buffer>;
  /** TCP target instead of `host` (tests: 127.0.0.1). The certificate is still checked for `host`. */
  connectHost?: string;
  /** Inactivity timeout of each step (default 20 s). */
  timeoutMs?: number;
  /** EHLO argument (default 'localhost' - the computer's own name is not revealed). */
  localName?: string;
}

export interface Envelope {
  from: string;
  to: string;
}

/**
 * Delivers one message (`data` = headers + body with CRLF line ends, as built by mime.ts) to the
 * SMTP server of `opts`: connect, (STARTTLS,) authenticate, MAIL FROM, RCPT TO, DATA, QUIT.
 * Resolves once the server accepted the message; rejects with an `SmtpError`.
 */
export interface SmtpTransport {
  send(opts: SmtpOptions, envelope: Envelope, data: string): Promise<void>;
}

/** True for Gmail / Google Workspace SMTP hosts (their AUTH failure needs the App Password hint). */
export function isGmailHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === 'smtp.gmail.com' || h === 'smtp.googlemail.com' || h.endsWith('.gmail.com') || h.endsWith('.google.com');
}

/** Rejects a value that would break the SMTP command line (CR, LF, NUL) or the <address> syntax. */
export function assertSafeAddress(address: string): void {
  if (!address || /[\r\n\0<>\s]/.test(address)) throw new SmtpError('server.mail.error.address');
}
