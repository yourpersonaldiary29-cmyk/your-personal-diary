/**
 * The version of the privacy policy that a new account confirms at registration
 * (docs/android-tasks/PRIVACY-CHECKBOX.md): the policy's effective date, `YYYY-MM-DD`.
 *
 * It is NOT written here a second time: it is the `effectiveDate` of legal/settings.json - the one place
 * where the owner sets it and the value scripts/legal/build-pages.mjs prints at the top of every policy
 * page (public/privacy/**). The hosted server stores it with every new account as `privacyVersion`
 * (server/src/security/auth-service.ts), so the stored version and the published page can never
 * disagree; server/test/privacy-consent.test.ts checks it against the generator and the built pages.
 * Changing the date = edit legal/settings.json, run `node scripts/legal/build-pages.mjs`, deploy.
 *
 * Only the date is imported (a named import of one JSON field), so the bundles carry nothing else of
 * the settings file.
 */
import { effectiveDate } from '../legal/settings.json';

/** A calendar date `YYYY-MM-DD` that exists (the shape the legal page generator accepts). */
export function isPolicyVersion(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function checkedVersion(value: unknown): string {
  // A bad edit of legal/settings.json fails the build and every test, never a user.
  if (!isPolicyVersion(value)) throw new Error('legal/settings.json: "effectiveDate" must be a date in the form YYYY-MM-DD');
  return value;
}

/** The effective date of the privacy policy now published, e.g. '2026-10-28'. */
export const PRIVACY_POLICY_VERSION: string = checkedVersion(effectiveDate);
