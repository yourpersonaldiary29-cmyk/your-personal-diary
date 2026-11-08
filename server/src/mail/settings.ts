/**
 * Mail settings: the `mail` block of `<dataDir>/server-settings.json`.
 *
 *   "mail": { "enabled": true, "host": "smtp.gmail.com", "port": 465, "security": "tls",
 *             "username": "yourpersonaldiary29@gmail.com", "passwordEnc": "<base64 nonce|ciphertext|tag>",
 *             "fromAddress": "", "ownerUserId": "u_0123456789abcdef" }
 *
 * The SMTP password (a Gmail App Password) is encrypted with the device key (AES-256-GCM, its own
 * AAD), decrypted in memory only, and never sent to a client (the API reports `smtpPasswordSet`)
 * or written to a log. `ownerUserId` is the account that saved these settings ('' until the first
 * save, or until the server writes unowned settings down as the first account's). The settings
 * belong to the owner of this computer: the stored owner, or while none is stored the first account
 * created on this computer (security/owner.ts). Only that account may view or change them
 * (routes/server.ts, mail/service.ts); the owner is never taken from a request body. A stored value
 * that is not an account id reads as `UNREADABLE_OWNER`, which is released like a deleted owner.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { MailSecurity, MailSettingsView } from '@shared/types';
import { readRawServerSettings, writeRawServerSettings, type ServerConfig } from '../config';
import { ApiError } from '../errors';
import { readStoredOwner } from '../security/owner';
import { isIPv4 } from '../util/ip';
import { isMailAddress } from './mime';
import { isGmailHost } from './transport';

export interface MailConfig {
  enabled: boolean;
  host: string;
  port: number;
  security: MailSecurity;
  username: string;
  /** Plain SMTP password, in memory only ('' when not set). */
  password: string;
  /** '' = send from `username`. */
  fromAddress: string;
  /**
   * Id of the account that saved the settings ('' while none is stored: the first account owns them
   * then; `UNREADABLE_OWNER` when the file holds something that is not an account id).
   */
  ownerUserId: string;
}

export const DEFAULT_MAIL_HOST = 'smtp.gmail.com';
export const DEFAULT_MAIL_PORT = 465;

export const MAIL_DEFAULTS: Readonly<MailConfig> = Object.freeze({
  enabled: false,
  host: DEFAULT_MAIL_HOST,
  port: DEFAULT_MAIL_PORT,
  security: 'tls' as MailSecurity,
  username: '',
  password: '',
  fromAddress: '',
  ownerUserId: '',
});

const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export const MAIL_USERNAME_MAX = 254;
export const SMTP_PASSWORD_MAX = 256;

// Password encryption ---------------------------------------------------------------------------

const PASSWORD_AAD = Buffer.from('mpd-smtp-password-v1', 'utf8');
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

export function encryptSmtpPassword(password: string, deviceKey: Buffer): string {
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', deviceKey, nonce, { authTagLength: TAG_LENGTH });
  cipher.setAAD(PASSWORD_AAD);
  const body = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, body, cipher.getAuthTag()]).toString('base64');
}

/** The password, or null when the blob is not valid for this device key. */
export function decryptSmtpPassword(blob: string, deviceKey: Buffer): string | null {
  try {
    const raw = Buffer.from(blob, 'base64');
    if (raw.length <= NONCE_LENGTH + TAG_LENGTH) return null;
    const nonce = raw.subarray(0, NONCE_LENGTH);
    const tag = raw.subarray(raw.length - TAG_LENGTH);
    const body = raw.subarray(NONCE_LENGTH, raw.length - TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', deviceKey, nonce, { authTagLength: TAG_LENGTH });
    decipher.setAAD(PASSWORD_AAD);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// Normalisation / validation ---------------------------------------------------------------------

/** 'SMTP.Gmail.com' -> 'smtp.gmail.com'; an IPv4 literal is kept. null when it is not a host name. */
export function normalizeMailHost(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/\.$/, '');
  if (!s || s.length > 253) return null;
  if (isIPv4(s)) return s;
  const labels = s.split('.');
  if (labels.length < 2 && s !== 'localhost') return null;
  return labels.every((l) => HOST_LABEL.test(l)) ? s : null;
}

/**
 * Gmail shows an App Password as four groups of four letters ("abcd efgh ijkl mnop"); the spaces
 * are only for reading, so they are removed for Gmail hosts. Other servers get the password as typed.
 */
export function normalizeSmtpPassword(password: string, host: string): string {
  return isGmailHost(host) ? password.replace(/\s+/g, '') : password;
}

/** The address the e-mails are sent from ('' when neither a sender nor an e-mail user name is set). */
export function effectiveFrom(c: MailConfig): string {
  if (c.fromAddress) return c.fromAddress;
  return isMailAddress(c.username) ? c.username : '';
}

/** True when e-mails can be sent: enabled and complete. */
export function isMailReady(c: MailConfig): boolean {
  return c.enabled && !!c.host && c.port > 0 && !!c.username && !!c.password && !!effectiveFrom(c);
}

function bodyOf(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw ApiError.validation('server.mail.badBody');
  return raw as Record<string, unknown>;
}

function hasControl(s: string): boolean {
  return /[\r\n\0]/.test(s);
}

/**
 * Applies a `PUT /api/server/mail` body (without the account password) to `current`. Throws
 * VALIDATION ('server.mail.*', with the field name) for bad values, and when the result would be
 * enabled without a user name, a password or a sender address.
 */
export function applyMailUpdate(raw: unknown, current: MailConfig): MailConfig {
  const body = bodyOf(raw);
  const next: MailConfig = { ...current };
  if (body.host !== undefined) {
    const h = typeof body.host === 'string' ? normalizeMailHost(body.host) : null;
    if (!h) throw ApiError.validation('server.mail.hostInvalid', 'host');
    // The saved SMTP password belongs to the server it was typed for: pointing the settings at
    // another server forgets it (it must be typed again), so it is never handed to a new host.
    if (h !== current.host && body.smtpPassword === undefined) next.password = '';
    next.host = h;
  }
  if (body.port !== undefined) {
    const p = body.port;
    if (typeof p !== 'number' || !Number.isInteger(p) || p < 1 || p > 65535) {
      throw ApiError.validation('server.mail.portInvalid', 'port', { min: '1', max: '65535' });
    }
    next.port = p;
  }
  if (body.security !== undefined) {
    if (body.security !== 'tls' && body.security !== 'starttls') throw ApiError.validation('server.mail.securityInvalid', 'security');
    next.security = body.security;
  }
  if (body.username !== undefined) {
    if (typeof body.username !== 'string') throw ApiError.validation('server.mail.usernameInvalid', 'username');
    const u = body.username.trim();
    if (u.length > MAIL_USERNAME_MAX || hasControl(u) || /\s/.test(u)) throw ApiError.validation('server.mail.usernameInvalid', 'username');
    next.username = u;
  }
  if (body.fromAddress !== undefined) {
    if (typeof body.fromAddress !== 'string') throw ApiError.validation('server.mail.fromInvalid', 'fromAddress');
    const f = body.fromAddress.trim();
    if (f && !isMailAddress(f)) throw ApiError.validation('server.mail.fromInvalid', 'fromAddress');
    next.fromAddress = f;
  }
  if (body.smtpPassword !== undefined) {
    if (typeof body.smtpPassword !== 'string') throw ApiError.validation('server.mail.smtpPasswordInvalid', 'smtpPassword');
    const pw = normalizeSmtpPassword(body.smtpPassword, next.host);
    if (pw.length > SMTP_PASSWORD_MAX || hasControl(pw)) throw ApiError.validation('server.mail.smtpPasswordInvalid', 'smtpPassword');
    next.password = pw;
  }
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== 'boolean') throw ApiError.validation('server.mail.mustBeBoolean', 'enabled');
    next.enabled = body.enabled;
  }
  if (next.enabled) {
    if (!next.username) throw ApiError.validation('server.mail.usernameRequired', 'username');
    if (!next.password) throw ApiError.validation('server.mail.smtpPasswordRequired', 'smtpPassword');
    if (!effectiveFrom(next)) throw ApiError.validation('server.mail.fromRequired', 'fromAddress');
  }
  return next;
}

export function toMailView(c: MailConfig): MailSettingsView {
  return {
    enabled: c.enabled,
    host: c.host,
    port: c.port,
    security: c.security,
    username: c.username,
    smtpPasswordSet: c.password !== '',
    fromAddress: c.fromAddress,
    ready: isMailReady(c),
    // The stored owner only; MailService.view() reports the owner of this computer instead.
    hasOwner: c.ownerUserId !== '',
  };
}

/** Anything differs from the defaults (the owner aside) - i.e. a release would clear something. */
export function hasMailSetup(c: MailConfig): boolean {
  return (Object.keys(MAIL_DEFAULTS) as Array<keyof MailConfig>).some((k) => k !== 'ownerUserId' && c[k] !== MAIL_DEFAULTS[k]);
}

// Persistence ------------------------------------------------------------------------------------

/**
 * Reads the mail block (defaults for anything missing or invalid; an undecryptable password counts
 * as not set). A present but malformed `ownerUserId` reads as `UNREADABLE_OWNER`, not as "no owner".
 */
export function readMailConfig(cfg: ServerConfig, deviceKey: Buffer): MailConfig {
  const raw = readRawServerSettings(cfg).mail;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...MAIL_DEFAULTS };
  const r = raw as Record<string, unknown>;
  const host = typeof r.host === 'string' ? (normalizeMailHost(r.host) ?? DEFAULT_MAIL_HOST) : DEFAULT_MAIL_HOST;
  const port = r.port;
  const username = typeof r.username === 'string' && !hasControl(r.username) ? r.username.trim().slice(0, MAIL_USERNAME_MAX) : '';
  const fromAddress = typeof r.fromAddress === 'string' && isMailAddress(r.fromAddress.trim()) ? r.fromAddress.trim() : '';
  const password = typeof r.passwordEnc === 'string' && r.passwordEnc ? (decryptSmtpPassword(r.passwordEnc, deviceKey) ?? '') : '';
  const out: MailConfig = {
    enabled: r.enabled === true,
    host,
    port: typeof port === 'number' && Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_MAIL_PORT,
    security: r.security === 'starttls' ? 'starttls' : 'tls',
    username,
    password,
    fromAddress,
    ownerUserId: readStoredOwner(r.ownerUserId),
  };
  // An enabled block that cannot send (e.g. the password was encrypted with another device key) resumes as off.
  if (out.enabled && !isMailReady(out)) out.enabled = false;
  return out;
}

/** Writes the mail block, keeping every other key of server-settings.json (port, lanEnabled, remote). */
export function writeMailConfig(cfg: ServerConfig, deviceKey: Buffer, c: MailConfig): void {
  const raw = readRawServerSettings(cfg);
  raw.mail = {
    enabled: c.enabled,
    host: c.host,
    port: c.port,
    security: c.security,
    username: c.username,
    passwordEnc: c.password ? encryptSmtpPassword(c.password, deviceKey) : '',
    fromAddress: c.fromAddress,
    ownerUserId: c.ownerUserId,
  };
  writeRawServerSettings(cfg, raw);
}
