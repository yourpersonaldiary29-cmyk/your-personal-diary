/**
 * Catalogue keys and errors of the Downloads page in the Server card (docs/server-tasks/SERVER-CARD-V2.md Part A):
 * the routes (routes/server-downloads.ts) and the controller (hosted/downloads.ts). Pure: no imports beyond the
 * errors module, so the route file - which the desktop and Android bundles carry - stays free of the controller.
 */
import { ApiError } from '../errors';

/** 403 while the server has no Downloads controller (apps built without the hosted composition). */
export const DOWNLOADS_UNAVAILABLE_KEY = 'server.downloads.unavailable';
/** 400 VALIDATION: the body is not a JSON object, or `removeOlder` / `bytes` is of the wrong kind. */
export const DOWNLOADS_BAD_BODY_KEY = 'server.downloads.badBody';
/** 400 VALIDATION (field 'platform'): not windows, android or mac. */
export const DOWNLOADS_PLATFORM_KEY = 'server.downloads.platformInvalid';
/** 400 VALIDATION (field 'version'): not x.y.z. */
export const DOWNLOADS_VERSION_KEY = 'server.downloads.versionInvalid';
/** 400 VALIDATION (field 'password'): no account password in the body. */
export const DOWNLOADS_PASSWORD_REQUIRED_KEY = 'server.downloads.passwordRequired';
/** 400 WRONG_PASSWORD (field 'password'): the account password is wrong - not 401, the session stays. */
export const DOWNLOADS_WRONG_PASSWORD_KEY = 'server.downloads.wrongPassword';
/** 409 VALIDATION (field 'version', {platform} {version}): that platform and version is on the page already. */
export const DOWNLOADS_EXISTS_KEY = 'server.downloads.exists';
/** 404 NOT_FOUND ({platform} {version}): that platform and version is not on the page. */
export const DOWNLOADS_NOT_LISTED_KEY = 'server.downloads.notListed';
/** 429: another upload is running. */
export const DOWNLOADS_BUSY_KEY = 'server.downloads.busy';
/** 429 ({max}, Retry-After): the uploads of the last 24 hours reached the limit. */
export const DOWNLOADS_TOO_MANY_KEY = 'server.downloads.tooMany';
/** 403 ({minutes}): the upload token is unknown, used, expired or belongs to another sign-in. */
export const DOWNLOADS_TOKEN_KEY = 'server.downloads.tokenInvalid';
/** 415: the file was not sent as `application/octet-stream`. */
export const DOWNLOADS_CONTENT_TYPE_KEY = 'server.downloads.contentType';
/** 411: the request does not say how large the file is (`Content-Length`). */
export const DOWNLOADS_LENGTH_REQUIRED_KEY = 'server.downloads.lengthRequired';
/** 413 ({maxMb}): larger than the limit. */
export const DOWNLOADS_TOO_LARGE_KEY = 'server.downloads.tooLarge';
/** 400 VALIDATION (field 'file', {minMb}): smaller than an installer can be. */
export const DOWNLOADS_TOO_SMALL_KEY = 'server.downloads.tooSmall';
/** 400 VALIDATION (field 'file'): the upload ended before the whole file arrived. */
export const DOWNLOADS_INCOMPLETE_KEY = 'server.downloads.incomplete';
/** 400 VALIDATION (field 'file'): the file is not an installer of the chosen platform. */
export const DOWNLOADS_NOT_WINDOWS_KEY = 'server.downloads.notWindows';
export const DOWNLOADS_NOT_ANDROID_KEY = 'server.downloads.notAndroid';
export const DOWNLOADS_NOT_MAC_KEY = 'server.downloads.notMac';
/** 507 ({needMb}, {freeMb}): the file and the low-disk margin do not fit on the disk. */
export const DOWNLOADS_NO_SPACE_KEY = 'server.downloads.noSpace';
/** 500: the file could not be saved (nothing was published). */
export const DOWNLOADS_FAILED_KEY = 'server.downloads.failed';

const MB = 1024 * 1024;

/** 429 'server.downloads.tooMany' with `Retry-After` = the seconds until the oldest upload of the day leaves the window. */
export function downloadsTooMany(max: number, retryAfterMs: number): ApiError {
  const e = ApiError.localized(429, 'FORBIDDEN', DOWNLOADS_TOO_MANY_KEY, { max });
  e.retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return e;
}

/** 507 'server.downloads.noSpace' with the space needed and free in whole megabytes (rounded up / down). */
export function downloadsNoSpace(needBytes: number, freeBytes: number): ApiError {
  return ApiError.localized(507, 'IO', DOWNLOADS_NO_SPACE_KEY, {
    needMb: Math.max(1, Math.ceil(needBytes / MB)),
    freeMb: Math.max(0, Math.floor(freeBytes / MB)),
  });
}

/** 500 'server.downloads.failed'. */
export function downloadsFailed(): ApiError {
  return ApiError.localized(500, 'IO', DOWNLOADS_FAILED_KEY);
}
