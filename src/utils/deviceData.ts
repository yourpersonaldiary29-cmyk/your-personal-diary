/**
 * Per-account data this device keeps in localStorage outside the encrypted diary: the recent
 * search questions (diary-derived text) and the account's remembered UI language. Keyed by the
 * account id, so the next account signed in on the same computer never sees another account's
 * questions; removed when the account signs out and when it is deleted.
 */
import { forgetUserLocale } from '@/i18n/runtime';

/** Recent search questions of one account: `mpd.search.recent.<userId>`. */
export const RECENT_QUESTIONS_PREFIX = 'mpd.search.recent.';
/**
 * The device-wide key older versions used for every account. Never read any more (whose questions
 * they were is unknown); removed at the next sign-out or deletion.
 */
export const LEGACY_RECENT_QUESTIONS_KEY = 'mpd.search.recent';

export function recentQuestionsKey(userId: string): string {
  return `${RECENT_QUESTIONS_PREFIX}${userId}`;
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

/** Sign-out: the account's recent questions go (and the old device-wide list). */
export function clearSignedOutAccountData(userId: string | null | undefined): void {
  remove(LEGACY_RECENT_QUESTIONS_KEY);
  if (userId) remove(recentQuestionsKey(userId));
}

/** Account deletion: everything this device remembered for the account. */
export function forgetAccountOnThisDevice(userId: string | null | undefined): void {
  clearSignedOutAccountData(userId);
  if (userId) forgetUserLocale(userId);
}
