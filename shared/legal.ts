/**
 * The versions of the two legal documents that a new account confirms at registration with ONE checkbox
 * ("I have read the Privacy Policy and the Terms of Use, and I agree to them" - docs/android-tasks/PRIVACY-CHECKBOX.md,
 * docs/apple-tasks/TERMS.md): each document's effective date, `YYYY-MM-DD`.
 *
 * They are NOT written here a second time: they are `effectiveDate` (the privacy policy) and `termsEffectiveDate`
 * (the Terms of Use) of legal/settings.json - the one place where the owner sets them and the values
 * scripts/legal/build-pages.mjs prints at the top of every page (public/privacy/**, public/terms/**). The hosted
 * server stores them with every new account as `privacyVersion` and `termsVersion`
 * (server/src/security/auth-service.ts), so the stored versions and the published pages can never disagree;
 * server/test/privacy-consent.test.ts and server/test/terms-consent.test.ts check them against the generator
 * and the built pages. Changing a date = edit legal/settings.json, run `node scripts/legal/build-pages.mjs`, deploy.
 *
 * Only the two dates are imported (named imports of two JSON fields), so the bundles carry nothing else of the
 * settings file.
 */
import { effectiveDate, termsEffectiveDate } from '../legal/settings.json';

/** A calendar date `YYYY-MM-DD` that exists (the shape the legal page generator accepts). */
export function isPolicyVersion(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function checkedVersion(value: unknown, key: string): string {
  // A bad edit of legal/settings.json fails the build and every test, never a user.
  if (!isPolicyVersion(value)) throw new Error(`legal/settings.json: "${key}" must be a date in the form YYYY-MM-DD`);
  return value;
}

/** The effective date of the privacy policy now published, e.g. '2026-10-28'. */
export const PRIVACY_POLICY_VERSION: string = checkedVersion(effectiveDate, 'effectiveDate');

/** The effective date of the Terms of Use now published, e.g. '2026-11-12'. */
export const TERMS_VERSION: string = checkedVersion(termsEffectiveDate, 'termsEffectiveDate');
