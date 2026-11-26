/**
 * Catalogue keys of the required update (app version 1.1.0): the owner's routes (routes/server-app-update.ts) and
 * the controller of the hosted composition (hosted/app-update.ts). Pure: no imports beyond the errors module, so
 * the route file - which the desktop and Android bundles carry - stays free of the controller.
 *
 * Where a text of the Downloads page already says exactly the same thing, its key is reused (the body that cannot be
 * read, the version that is not a.b.c, the password missing or wrong).
 */
import { ApiError } from '../errors';
import { DOWNLOADS_BAD_BODY_KEY, DOWNLOADS_PASSWORD_REQUIRED_KEY, DOWNLOADS_VERSION_KEY, DOWNLOADS_WRONG_PASSWORD_KEY } from './downloads-errors';

/** 403 while the server has no required-update controller (apps built without the hosted composition). */
export const APP_UPDATE_UNAVAILABLE_KEY = 'server.appUpdate.unavailable';
/** 400 VALIDATION: the body is not a JSON object. */
export const APP_UPDATE_BAD_BODY_KEY = DOWNLOADS_BAD_BODY_KEY;
/** 400 VALIDATION (field 'platform'): not android, ios, windows or mac. */
export const APP_UPDATE_PLATFORM_KEY = 'server.appUpdate.platformInvalid';
/** 400 VALIDATION (field 'minVersion'): neither null nor a.b.c (each part 0..9999, no leading zero). */
export const APP_UPDATE_VERSION_KEY = DOWNLOADS_VERSION_KEY;
/** 400 VALIDATION (field 'minVersion', {version} = the server's own version): higher than the server's own version. */
export const APP_UPDATE_TOO_NEW_KEY = 'server.appUpdate.tooNew';
/**
 * 400 VALIDATION (field 'minVersion', {version} = FIRST_UPDATE_AWARE_VERSION): lower than the first version that knows
 * the "Update needed" screen - such a rule would refuse nobody (LAST_UNMARKED_VERSION) while the owner's card said
 * otherwise.
 */
export const APP_UPDATE_TOO_OLD_KEY = 'server.appUpdate.tooOld';
/** 400 VALIDATION (field 'password'): no account password in the body. */
export const APP_UPDATE_PASSWORD_REQUIRED_KEY = DOWNLOADS_PASSWORD_REQUIRED_KEY;
/** 400 WRONG_PASSWORD (field 'password'): the account password is wrong - not 401, the session stays. */
export const APP_UPDATE_WRONG_PASSWORD_KEY = DOWNLOADS_WRONG_PASSWORD_KEY;
/** 500: the rule could not be saved (nothing changed). */
export const APP_UPDATE_FAILED_KEY = 'server.appUpdate.failed';

/**
 * The answer to a version before 1.1.0 on a session route while its platform's rule is 1.1.0 or later (hosted/app-update.ts):
 * 503 with the server's ordinary JSON error body - an old client then keeps its session token, shows this message
 * and starts nothing from its cache (src/context/AuthContext.tsx and src/api/client.ts of 1.0.0 and 1.0.1).
 */
export const UPDATE_REQUIRED_STATUS = 503;
/**
 * {store}: the store's name. Only the iPhone gets this message ("App Store"): an unmarked Android request is always
 * sent to the Downloads page of the site (hosted/app-update.ts `refusalFor`).
 */
export const UPDATE_REQUIRED_STORE_KEY = 'server.app.updateRequiredStore';
/** {url}: the Downloads page of the site in the request's language. */
export const UPDATE_REQUIRED_SITE_KEY = 'server.app.updateRequiredSite';

/** 503 UPDATE_REQUIRED with the message that says where the new version is. */
export function updateRequired(where: { store: string } | { url: string }): ApiError {
  return 'store' in where
    ? ApiError.localized(UPDATE_REQUIRED_STATUS, 'UPDATE_REQUIRED', UPDATE_REQUIRED_STORE_KEY, { store: where.store })
    : ApiError.localized(UPDATE_REQUIRED_STATUS, 'UPDATE_REQUIRED', UPDATE_REQUIRED_SITE_KEY, { url: where.url });
}

/** 500 'server.appUpdate.failed'. */
export function appUpdateFailed(): ApiError {
  return ApiError.localized(500, 'IO', APP_UPDATE_FAILED_KEY);
}
