/**
 * Backup and restore (ARCHITECTURE.md section 6, docs/API.md "גיבוי ושחזור").
 *
 * A backup file is exactly the `.mpd` container: the current in-memory database image
 * encrypted either with the account key (header = the account's salt/KDF parameters) or,
 * when the user chooses a different backup password, with a key derived from that
 * password and a fresh salt.
 *
 * Restore decrypts with the backup password, verifies the SQLite image (integrity check,
 * migrations) and swaps it into the vault, which re-encrypts it with the ACCOUNT key -
 * the account password never changes because of a restore. A backup whose schema is newer than
 * this version of the app is refused ('server.backup.newerVersion') and nothing changes.
 *
 * Errors are catalogue keys ('server.backup.*') rendered in the request language;
 * `inspectBackup` renders its description directly in the locale it receives.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_LOCALE, formatNumber, t, type Locale } from '@shared/i18n';
import type { BackupFileInfo, RestoreInfo } from '@shared/types';
import { DiaryDb } from '../db/database';
import { NewerSchemaError } from '../db/schema';
import { ApiError, ref, type MessageRef } from '../errors';
import { decryptWithPassword, encryptContainer, isContainer, parseHeader } from '../security/container';
import { DEFAULT_KDF, deriveSecret, newSalt, splitSecret, wipe } from '../security/kdf';
import { weakPasswordError } from '../security/password-policy';
import type { AccountRecord, UserVault } from '../security/session-types';
import { exportImage, headerParamsOf } from '../security/vault';
import { carriesSyncState, carrySyncState } from '../sync/restore';
import { nowIso } from '../util/dates';

/** Catalogue key of the 400 BACKUP answered when a backup made by a newer version of the app is restored. */
export const NEWER_BACKUP_VERSION_KEY = 'server.backup.newerVersion';

/** Largest backup we accept for inspect/restore (also the JSON body limit of the server). */
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

/** Human-readable size in `locale` ('512 bytes', '1.5 KB', '25 MB'), through the shell size templates. */
export function formatSize(locale: Locale, bytes: number): string {
  if (bytes < 1024) return t(locale, 'shell.format.bytes', { count: bytes });
  if (bytes < 1024 * 1024) return t(locale, 'shell.format.kilobytes', { value: formatNumber(locale, bytes / 1024, 1) });
  return t(locale, 'shell.format.megabytes', { value: formatNumber(locale, bytes / (1024 * 1024), 1) });
}

/** The maximum size as a nested message parameter ('25 MB' in every language). */
function maxSizeRef(): MessageRef {
  return ref('shell.format.megabytes', { value: MAX_BACKUP_BYTES / (1024 * 1024) });
}

function tooLarge(): ApiError {
  return ApiError.backup('server.backup.tooLarge', { max: maxSizeRef() });
}

/**
 * Encrypted bytes of the user's current diary. With `password` the file gets its own salt
 * and key (the same password policy as accounts applies); without it the account key is used.
 */
export async function createBackupBytes(vault: UserVault, account: AccountRecord, password?: string): Promise<Buffer> {
  const image = exportImage(vault.db);
  if (password !== undefined && password !== '') {
    if (typeof password !== 'string') throw ApiError.validation('server.backup.badPassword', 'password');
    const weak = weakPasswordError(password);
    if (weak) throw weak;
    const salt = newSalt();
    const secret = await deriveSecret(password, salt, DEFAULT_KDF);
    const { key, verifierSource } = splitSecret(secret);
    wipe(secret);
    wipe(verifierSource);
    try {
      return encryptContainer(image, key, salt, DEFAULT_KDF);
    } finally {
      wipe(key);
    }
  }
  const header = headerParamsOf(account);
  const key = vault.getKey();
  try {
    return encryptContainer(image, key, header.salt, header.kdf);
  } finally {
    wipe(key);
  }
}

/** Structural check of a backup file without decrypting it. Never throws. `locale` = language of `description`. */
export function inspectBackup(bytes: Buffer, locale: Locale = DEFAULT_LOCALE): BackupFileInfo {
  const sizeBytes = bytes.length;
  const appName = t(locale, 'shell.appName');
  if (sizeBytes > MAX_BACKUP_BYTES) {
    return {
      valid: false,
      version: null,
      sizeBytes,
      description: t(locale, 'server.backup.inspect.tooLarge', {
        size: formatSize(locale, sizeBytes),
        max: formatSize(locale, MAX_BACKUP_BYTES),
      }),
    };
  }
  if (!isContainer(bytes)) {
    return {
      valid: false,
      version: null,
      sizeBytes,
      description: t(locale, 'server.backup.inspect.notBackup', { appName }),
    };
  }
  try {
    const header = parseHeader(bytes);
    return {
      valid: true,
      version: header.version,
      sizeBytes,
      description: t(locale, 'server.backup.inspect.valid', { appName, version: header.version, size: formatSize(locale, sizeBytes) }),
    };
  } catch (e) {
    return {
      valid: false,
      version: null,
      sizeBytes,
      description: e instanceof ApiError ? e.messageFor(locale) : t(locale, 'server.backup.inspect.corrupt'),
    };
  }
}

/**
 * Decrypts the backup with `password`, validates the database and swaps it into the vault
 * (persisted with the account key). Returns what was restored.
 */
export async function restoreBackup(vault: UserVault, bytes: Buffer, password: string): Promise<RestoreInfo> {
  if (typeof password !== 'string' || !password) throw ApiError.validation('server.backup.passwordRequired', 'password');
  if (bytes.length > MAX_BACKUP_BYTES) throw tooLarge();
  if (!isContainer(bytes)) throw ApiError.backup('server.backup.notBackupFile', { appName: ref('shell.appName') });
  const { plain, key } = await decryptWithPassword(bytes, password);
  wipe(key);
  let newDb: DiaryDb;
  try {
    newDb = await DiaryDb.fromImage(plain);
  } catch (e) {
    // A backup made by a newer version of the app: the current diary stays as it is.
    if (e instanceof NewerSchemaError) throw ApiError.backup(NEWER_BACKUP_VERSION_KEY);
    throw ApiError.backup('server.backup.corruptDb');
  }
  let entries = 0;
  let habits = 0;
  try {
    entries = Number(newDb.scalar<number>('SELECT COUNT(*) FROM entries') ?? 0);
    habits = Number(newDb.scalar<number>('SELECT COUNT(*) FROM habits') ?? 0);
  } catch {
    newDb.close();
    throw ApiError.backup('server.backup.notDiaryDb');
  }
  // Offline sync (hosted vaults only): keep the account offline key, start a new epoch so queued
  // edits addressed by id become "stale". A local-mode restore is left exactly as restored, even when
  // the live diary holds sync rows from a hosted backup restored into it earlier.
  if (carriesSyncState(vault)) carrySyncState(vault.db, newDb);
  await vault.replaceDatabase(newDb);
  return { entries, habits, restoredAt: nowIso() };
}

/** Request body of inspect/restore: either a desktop path or the file content as Base64. */
export interface BackupSourceBody {
  srcPath?: unknown;
  fileBase64?: unknown;
  fileName?: unknown;
}

/**
 * Reads the backup bytes named by the request. Paths are only honoured for local (desktop)
 * requests - a phone on the LAN must upload the file content instead.
 */
export function readBackupSource(body: BackupSourceBody, isLocalRequest: boolean): Buffer {
  if (typeof body.srcPath === 'string' && body.srcPath.trim()) {
    if (!isLocalRequest) throw ApiError.forbidden('server.backup.pathLocalOnly');
    const srcPath = body.srcPath.trim();
    if (!path.isAbsolute(srcPath)) throw ApiError.validation('server.backup.srcPathAbsolute', 'srcPath');
    let stat: fs.Stats;
    try {
      stat = fs.statSync(srcPath);
    } catch {
      throw ApiError.backup('server.backup.fileNotFound');
    }
    if (!stat.isFile()) throw ApiError.backup('server.backup.notAFile');
    if (stat.size > MAX_BACKUP_BYTES) throw tooLarge();
    try {
      return fs.readFileSync(srcPath);
    } catch {
      throw ApiError.io('server.backup.readFailed');
    }
  }
  if (typeof body.fileBase64 === 'string' && body.fileBase64) {
    const text = body.fileBase64.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(text)) throw ApiError.validation('server.backup.badBase64', 'fileBase64');
    // 4 Base64 chars encode 3 bytes; refuse before decoding something huge.
    if ((text.length * 3) / 4 > MAX_BACKUP_BYTES + 3) throw tooLarge();
    const bytes = Buffer.from(text, 'base64');
    if (!bytes.length) throw ApiError.validation('server.backup.emptyFile', 'fileBase64');
    return bytes;
  }
  throw ApiError.validation('server.backup.chooseFile', 'srcPath');
}
