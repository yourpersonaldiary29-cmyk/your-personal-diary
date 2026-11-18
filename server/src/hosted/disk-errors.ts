/**
 * Catalogue keys and errors of the disk button (docs/server-tasks/SERVER-CARD-V2.md Part B):
 * `GET /api/server/disk`, `POST /api/server/disk/extend` and `POST /api/server/disk/restart`
 * (routes/server-disk.ts) and the controller behind them (hosted/disk.ts). Pure: no imports beyond the
 * errors module, so the route file - which the desktop and Android bundles carry - stays free of the
 * controller and of the Fly API client.
 */
import type { ServerDiskReason } from '@shared/types';
import { ApiError } from '../errors';

/** 403 while the server has no disk controller (apps built without the hosted composition). */
export const DISK_UNAVAILABLE_KEY = 'server.disk.unavailable';
/** 400 VALIDATION: the body is not a JSON object. */
export const DISK_BAD_BODY_KEY = 'server.disk.badBody';
/** 400 VALIDATION (field 'password'): no account password in the body. */
export const DISK_PASSWORD_REQUIRED_KEY = 'server.disk.passwordRequired';
/** 400 WRONG_PASSWORD (field 'password'): the account password is wrong - not 401, the session stays. */
export const DISK_WRONG_PASSWORD_KEY = 'server.disk.wrongPassword';
/** 400 VALIDATION (field 'sizeGb'): not a whole number of GB. */
export const DISK_SIZE_WHOLE_KEY = 'server.disk.sizeWhole';
/** 400 VALIDATION (field 'sizeGb', {max}): above DIARY_DISK_MAX_GB. */
export const DISK_SIZE_TOO_LARGE_KEY = 'server.disk.sizeTooLarge';
/** 400 VALIDATION (field 'sizeGb', {current}): not larger than the size Fly reports now. */
export const DISK_SIZE_NOT_LARGER_KEY = 'server.disk.sizeNotLarger';
/** 409: a change is running. */
export const DISK_BUSY_KEY = 'server.disk.busy';
/** 409: the last change waits for a restart (or is restarting). */
export const DISK_RESTART_FIRST_KEY = 'server.disk.restartFirst';
/** 409: a restart was asked for, but no change waits for one. */
export const DISK_NO_RESTART_NEEDED_KEY = 'server.disk.noRestartNeeded';
/** 429 ({max}, {hours}, Retry-After): SERVER_DISK_CHANGES_PER_DAY changes were started in the last 24 hours. */
export const DISK_DAILY_LIMIT_KEY = 'server.disk.dailyLimit';

/** The text of each `ServerDiskReason` - the error of a request that needs what is missing, and the card's explanation. */
export const DISK_REASON_KEYS: Readonly<Record<ServerDiskReason, string>> = Object.freeze({
  'not-fly': 'server.disk.reason.notFly',
  'no-token': 'server.disk.reason.noToken',
  'bad-token': 'server.disk.reason.badToken',
  'no-volume': 'server.disk.reason.noVolume',
  unauthorized: 'server.disk.reason.unauthorized',
  'fly-error': 'server.disk.reason.flyError',
});

/** Why a change failed, or why its restart did not happen (`ServerDiskChange.errorKey`). */
export const DISK_ERROR_KEYS = Object.freeze({
  /** The snapshot could not be made (or Fly reported it failed): nothing was changed. */
  snapshotFailed: 'server.disk.error.snapshotFailed',
  /** No snapshot was ready after 10 minutes: nothing was changed. */
  snapshotTimeout: 'server.disk.error.snapshotTimeout',
  /** Fly refused the token during the change: nothing was changed. */
  unauthorized: 'server.disk.error.unauthorized',
  /** Fly refused to extend the volume: nothing was changed. */
  extendRefused: 'server.disk.error.extendRefused',
  /** The extend got no answer: the volume may or may not be larger now (it is never asked again). */
  extendUnknown: 'server.disk.error.extendUnknown',
  /** The server stopped in the middle of a change. */
  interrupted: 'server.disk.error.interrupted',
  /** After the restart the file system still shows the old size. */
  notGrown: 'server.disk.error.notGrown',
  /** Fly refused the restart. */
  restartRefused: 'server.disk.error.restartRefused',
  /** The restart got no answer, or had no effect. */
  restartFailed: 'server.disk.error.restartFailed',
});

/** 409 (or 502 / 503 for what Fly answered) with the text of `reason`. */
export function diskReasonError(reason: ServerDiskReason): ApiError {
  const key = DISK_REASON_KEYS[reason];
  if (reason === 'fly-error') return ApiError.localized(503, 'OTHER', key);
  if (reason === 'unauthorized' || reason === 'no-volume') return ApiError.localized(502, 'OTHER', key);
  return ApiError.localized(409, 'FORBIDDEN', key);
}

export function diskBusy(): ApiError {
  return ApiError.localized(409, 'FORBIDDEN', DISK_BUSY_KEY);
}

export function diskRestartFirst(): ApiError {
  return ApiError.localized(409, 'FORBIDDEN', DISK_RESTART_FIRST_KEY);
}

export function diskNoRestartNeeded(): ApiError {
  return ApiError.localized(409, 'FORBIDDEN', DISK_NO_RESTART_NEEDED_KEY);
}

/** 429 'server.disk.dailyLimit' with `Retry-After` = the seconds until the oldest counted change is 24 hours old (at least 1). */
export function diskDailyLimit(remainingMs: number, max: number): ApiError {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const e = ApiError.localized(429, 'FORBIDDEN', DISK_DAILY_LIMIT_KEY, { max, hours: Math.max(1, Math.ceil(seconds / 3600)) });
  e.retryAfterSec = seconds;
  return e;
}

export function diskSizeWhole(): ApiError {
  return ApiError.validation(DISK_SIZE_WHOLE_KEY, 'sizeGb');
}

export function diskSizeTooLarge(max: number): ApiError {
  return ApiError.validation(DISK_SIZE_TOO_LARGE_KEY, 'sizeGb', { max });
}

export function diskSizeNotLarger(current: number): ApiError {
  return ApiError.validation(DISK_SIZE_NOT_LARGER_KEY, 'sizeGb', { current });
}
