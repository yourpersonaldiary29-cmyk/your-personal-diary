/**
 * Catalogue keys and errors of the server archive (WP-H8, docs/android-tasks/SERVER-CARD.md item 2):
 * `POST /api/server/archive` (routes/server-status.ts) and its writer (hosted/archive.ts). Pure: no
 * imports beyond the errors module, so the route file - which the desktop and Android bundles carry
 * - stays free of the archive writer.
 */
import { ApiError } from '../errors';

/** 403 while the server has no archive writer (apps built without the hosted composition). */
export const ARCHIVE_UNAVAILABLE_KEY = 'server.archive.unavailable';
/** 400 VALIDATION: the body is not a JSON object. */
export const ARCHIVE_BAD_BODY_KEY = 'server.archive.badBody';
/** 400 VALIDATION (field 'password'): no account password in the body. */
export const ARCHIVE_PASSWORD_REQUIRED_KEY = 'server.archive.passwordRequired';
/** 400 WRONG_PASSWORD (field 'password'): the account password is wrong - not 401, the session stays. */
export const ARCHIVE_WRONG_PASSWORD_KEY = 'server.archive.wrongPassword';
/** 400 VALIDATION (field 'passphrase', {min}): missing or shorter than 12 characters. */
export const ARCHIVE_PASSPHRASE_SHORT_KEY = 'server.archive.passphraseShort';
/** 400 VALIDATION (field 'passphrase', {max}): longer than 1024 characters. */
export const ARCHIVE_PASSPHRASE_LONG_KEY = 'server.archive.passphraseLong';
/** 429 ({minutes}, Retry-After): one archive per 10 minutes, and never two at once. */
export const ARCHIVE_TOO_SOON_KEY = 'server.archive.tooSoon';
/** 507 ({needMb}, {freeMb}): free space is below 1.2 x the data size (or the disk filled up while writing). */
export const ARCHIVE_NO_SPACE_KEY = 'server.archive.noSpace';
/** 500: writing the archive failed for another reason (the partial file was removed). */
export const ARCHIVE_FAILED_KEY = 'server.archive.failed';

/** 429 'server.archive.tooSoon' with `Retry-After` = the seconds left (at least 1). */
export function archiveTooSoon(remainingMs: number): ApiError {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const e = ApiError.localized(429, 'FORBIDDEN', ARCHIVE_TOO_SOON_KEY, { minutes: Math.max(1, Math.ceil(seconds / 60)) });
  e.retryAfterSec = seconds;
  return e;
}

const MB = 1024 * 1024;

/** 507 'server.archive.noSpace' with the space needed and free in whole megabytes (rounded up / down). */
export function archiveNoSpace(needBytes: number, freeBytes: number | null): ApiError {
  return ApiError.localized(507, 'IO', ARCHIVE_NO_SPACE_KEY, {
    needMb: Math.max(1, Math.ceil(needBytes / MB)),
    freeMb: Math.max(0, Math.floor((freeBytes ?? 0) / MB)),
  });
}

/** 500 'server.archive.failed'. */
export function archiveFailed(): ApiError {
  return ApiError.localized(500, 'IO', ARCHIVE_FAILED_KEY);
}
