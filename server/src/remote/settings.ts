/**
 * Remote-access settings: the `remote` block of `<dataDir>/server-settings.json`.
 *
 *   "remote": { "enabled": false, "hostname": "yourpersonaldiary.duckdns.org",
 *               "duckdnsTokenEnc": "<base64 nonce|ciphertext|tag>", "publicPort": 443,
 *               "upnp": true, "staging": false, "ownerUserId": "u_0123456789abcdef" }
 *
 * The DuckDNS token is encrypted with the device key (AES-256-GCM, its own AAD), so the settings
 * file alone does not reveal it; it is decrypted in memory only and never sent to a client (the
 * API reports `tokenSet`).
 *
 * `ownerUserId` is the account that saved these settings ('' until the first save, or until the
 * server writes unowned settings down as the first account's). Remote access belongs to the owner of
 * this computer: the stored owner, or while none is stored the first account created on this
 * computer (security/owner.ts). Only that account may view or change remote access
 * (routes/server.ts, remote/manager.ts); the owner is never taken from a request body. A stored
 * value that is not an account id reads as `UNREADABLE_OWNER`, which is released like a deleted owner.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { RemoteAccessSettings } from '@shared/types';
import { readRawServerSettings, writeRawServerSettings, type ServerConfig } from '../config';
import { ApiError } from '../errors';
import { readStoredOwner } from '../security/owner';
import { DUCKDNS_SUFFIX } from './duckdns';

export interface RemoteConfig {
  enabled: boolean;
  /** Normalised DuckDNS name ('' when not set). */
  hostname: string;
  /** Plain token, in memory only ('' when not set). */
  duckdnsToken: string;
  publicPort: number;
  upnp: boolean;
  staging: boolean;
  /**
   * Id of the account that saved the settings ('' while none is stored: the first account owns them
   * then; `UNREADABLE_OWNER` when the file holds something that is not an account id).
   */
  ownerUserId: string;
}

export const DEFAULT_PUBLIC_PORT = 443;

export const REMOTE_DEFAULTS: Readonly<RemoteConfig> = Object.freeze({
  enabled: false,
  hostname: '',
  duckdnsToken: '',
  publicPort: DEFAULT_PUBLIC_PORT,
  upnp: true,
  staging: false,
  ownerUserId: '',
});

/** A DuckDNS token is a UUID: 8-4-4-4-12 hexadecimal digits. */
export const DUCKDNS_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Token encryption ------------------------------------------------------------------------------

const TOKEN_AAD = Buffer.from('mpd-duckdns-token-v1', 'utf8');
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

export function encryptToken(token: string, deviceKey: Buffer): string {
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', deviceKey, nonce, { authTagLength: TAG_LENGTH });
  cipher.setAAD(TOKEN_AAD);
  const body = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, body, cipher.getAuthTag()]).toString('base64');
}

/** The token, or null when the blob is not valid for this device key. */
export function decryptToken(blob: string, deviceKey: Buffer): string | null {
  try {
    const raw = Buffer.from(blob, 'base64');
    if (raw.length <= NONCE_LENGTH + TAG_LENGTH) return null;
    const nonce = raw.subarray(0, NONCE_LENGTH);
    const tag = raw.subarray(raw.length - TAG_LENGTH);
    const body = raw.subarray(NONCE_LENGTH, raw.length - TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', deviceKey, nonce, { authTagLength: TAG_LENGTH });
    decipher.setAAD(TOKEN_AAD);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// Normalisation / validation ---------------------------------------------------------------------

/**
 * 'YourPersonalDiary', 'yourpersonaldiary.duckdns.org', 'https://yourpersonaldiary.duckdns.org/'
 * -> 'yourpersonaldiary.duckdns.org'. null when it is not a DuckDNS name.
 */
export function normalizeHostname(input: string): string | null {
  let s = input.trim().toLowerCase();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  s = s.replace(/[/?#].*$/, '');
  s = s.replace(/:\d*$/, '');
  s = s.replace(/\.$/, '');
  if (!s) return null;
  if (!s.includes('.')) s = `${s}${DUCKDNS_SUFFIX}`;
  if (!s.endsWith(DUCKDNS_SUFFIX)) return null;
  const label = s.slice(0, -DUCKDNS_SUFFIX.length);
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return null;
  return s;
}

function bodyOf(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw ApiError.validation('server.remote.badBody');
  return raw as Record<string, unknown>;
}

function booleanField(body: Record<string, unknown>, name: string, current: boolean): boolean {
  if (body[name] === undefined) return current;
  if (typeof body[name] !== 'boolean') throw ApiError.validation('server.remote.mustBeBoolean', name);
  return body[name] as boolean;
}

/**
 * Applies a `PUT /api/server/remote` body to `current`. Throws VALIDATION (catalogue keys
 * 'server.remote.*', with the field name) for bad values, and when the result would be enabled
 * without a hostname or a token.
 */
export function applyRemoteUpdate(raw: unknown, current: RemoteConfig): RemoteConfig {
  const body = bodyOf(raw);
  const next: RemoteConfig = { ...current };
  if (body.hostname !== undefined) {
    if (typeof body.hostname !== 'string') throw ApiError.validation('server.remote.hostnameInvalid', 'hostname');
    if (body.hostname.trim() === '') next.hostname = '';
    else {
      const h = normalizeHostname(body.hostname);
      if (!h) throw ApiError.validation('server.remote.hostnameInvalid', 'hostname');
      next.hostname = h;
    }
  }
  if (body.duckdnsToken !== undefined) {
    if (typeof body.duckdnsToken !== 'string') throw ApiError.validation('server.remote.tokenInvalid', 'duckdnsToken');
    const token = body.duckdnsToken.trim();
    if (token && !DUCKDNS_TOKEN_PATTERN.test(token)) throw ApiError.validation('server.remote.tokenInvalid', 'duckdnsToken');
    next.duckdnsToken = token.toLowerCase();
  }
  if (body.publicPort !== undefined) {
    const p = body.publicPort;
    if (typeof p !== 'number' || !Number.isInteger(p) || p < 1 || p > 65535) {
      throw ApiError.validation('server.remote.portInvalid', 'publicPort', { min: '1', max: '65535' });
    }
    next.publicPort = p;
  }
  next.enabled = booleanField(body, 'enabled', current.enabled);
  next.upnp = booleanField(body, 'upnp', current.upnp);
  next.staging = booleanField(body, 'staging', current.staging);
  if (next.enabled) {
    if (!next.hostname) throw ApiError.validation('server.remote.hostnameRequired', 'hostname');
    if (!next.duckdnsToken) throw ApiError.validation('server.remote.tokenRequired', 'duckdnsToken');
  }
  return next;
}

export function toPublicSettings(c: RemoteConfig): RemoteAccessSettings {
  return {
    enabled: c.enabled,
    hostname: c.hostname,
    tokenSet: c.duckdnsToken !== '',
    publicPort: c.publicPort,
    upnp: c.upnp,
    staging: c.staging,
  };
}

// Persistence ------------------------------------------------------------------------------------

/**
 * Reads the remote block (defaults for anything missing or invalid; an undecryptable token counts as
 * not set). A present but malformed `ownerUserId` reads as `UNREADABLE_OWNER`, not as "no owner".
 */
export function readRemoteConfig(cfg: ServerConfig, deviceKey: Buffer): RemoteConfig {
  const raw = readRawServerSettings(cfg).remote;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...REMOTE_DEFAULTS };
  const r = raw as Record<string, unknown>;
  const hostname = typeof r.hostname === 'string' ? (normalizeHostname(r.hostname) ?? '') : '';
  const token = typeof r.duckdnsTokenEnc === 'string' && r.duckdnsTokenEnc ? (decryptToken(r.duckdnsTokenEnc, deviceKey) ?? '') : '';
  const port = r.publicPort;
  const out: RemoteConfig = {
    enabled: r.enabled === true,
    hostname,
    duckdnsToken: token,
    publicPort: typeof port === 'number' && Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PUBLIC_PORT,
    upnp: typeof r.upnp === 'boolean' ? r.upnp : REMOTE_DEFAULTS.upnp,
    staging: r.staging === true,
    ownerUserId: readStoredOwner(r.ownerUserId),
  };
  // An enabled block without a usable name/token cannot run: resume it as off.
  if (out.enabled && (!out.hostname || !out.duckdnsToken)) out.enabled = false;
  return out;
}

/** Writes the remote block, keeping every other key of server-settings.json (port, lanEnabled). */
export function writeRemoteConfig(cfg: ServerConfig, deviceKey: Buffer, c: RemoteConfig): void {
  const raw = readRawServerSettings(cfg);
  raw.remote = {
    enabled: c.enabled,
    hostname: c.hostname,
    duckdnsTokenEnc: c.duckdnsToken ? encryptToken(c.duckdnsToken, deviceKey) : '',
    publicPort: c.publicPort,
    upnp: c.upnp,
    staging: c.staging,
    ownerUserId: c.ownerUserId,
  };
  writeRawServerSettings(cfg, raw);
}
