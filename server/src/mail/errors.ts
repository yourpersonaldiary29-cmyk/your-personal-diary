/**
 * Mail failures as the rest of the server sees them - pure: no socket code, nothing from node:net /
 * node:tls, so the routes, the mail service and the password-reset service can use it on every
 * platform (desktop: Node sidecar; Android: the same code inside a Web Worker, where the SMTP
 * conversation itself is done by an injected transport - mail/transport.ts).
 *
 * A failed delivery is an `SmtpError`: a catalogue key ('server.mail.error.*') plus harmless
 * parameters (host, port, SMTP reply code) - never the password, the AUTH exchange or the reply
 * text of the server. Every transport reports its failures this way.
 */
import { ApiError } from '../errors';

/** Catalogue key of the 503 answered while mail is not set up (forgot-password) / 400 for the test. */
export const MAIL_NOT_CONFIGURED_KEY = 'server.mail.notConfigured';

/** Catalogue key + parameters of a failed delivery (rendered in the request language by the caller). */
export class SmtpError extends Error {
  constructor(
    readonly key: string,
    readonly params: Record<string, string | number> = {},
    /** SMTP reply code when the server answered with an error. */
    readonly smtpCode?: number,
  ) {
    super(key);
    this.name = 'SmtpError';
  }
}

export function isSmtpError(e: unknown): e is SmtpError {
  return e instanceof SmtpError;
}

/** 502 with the localised SMTP failure ('server.mail.error.*'). */
export function mailApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (isSmtpError(e)) return ApiError.localized(502, 'OTHER', e.key, e.params);
  return ApiError.localized(502, 'OTHER', 'server.mail.error.closed', { host: '', port: '' });
}

/** The error code of an SMTP failure for a log line (never the address, never the password). */
export function mailFailureTag(e: unknown): string {
  if (isSmtpError(e)) return `${e.key}${e.smtpCode ? ` (SMTP ${e.smtpCode})` : ''}`;
  return (e as Error)?.message ?? String(e);
}
