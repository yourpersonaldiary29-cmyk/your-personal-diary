/**
 * Who owns this computer's diary - and with it the two computer-wide settings only one account may
 * view or change: remote access (server/src/remote, the DuckDNS domain) and sending e-mail
 * (server/src/mail, the SMTP account for password reset).
 *
 * The owner is the account created first on this computer: the earliest `createdAt` in
 * accounts.json, ties broken by the lowest id. It is fixed from the start - before anything is
 * configured - so another account can never take these settings by saving them first.
 * The owner is always a REAL account: the temporary guest of the tour mode (security/guest.ts) is
 * never counted, whenever it was created.
 *
 * Each settings block also stores `ownerUserId` (written on every save), and a stored owner always
 * wins over the first account:
 *   - settings saved by another account before this rule existed keep that owner (never
 *     transferred silently; the server logs a one-line notice at startup);
 *   - when the owner account is deleted, its settings are cleared first (`releaseOwner`: stored
 *     owner, secrets and names forgotten) and only then does the next-oldest account become the
 *     owner. A stored owner whose account no longer exists is released the same way - at startup
 *     and on the next /api/server/remote* or /api/server/mail* request - before anyone else gets in.
 *     So is a stored owner field that is not an account id at all (`UNREADABLE_OWNER`).
 *   - settings without a stored owner (written before owners were stored) are written down as the
 *     first account's as soon as there is one - at startup, right after an account is registered,
 *     and right before an account is deleted (`pinOwner`) - so that deleting that account clears
 *     them too instead of handing them to the next account.
 */
import type { AccountRecord } from './session-types';

type AccountLike = Pick<AccountRecord, 'id' | 'createdAt'> & Pick<Partial<AccountRecord>, 'guest'>;

/** Shape of an account id as stored in the settings file (accounts.ts: 'u_' + 16 hex digits). */
const OWNER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Stands in for a stored `ownerUserId` that is present but not an account id (a damaged or edited
 * settings file). The '!' is outside the id alphabet, so it never matches an account: such settings
 * are treated like those of an owner whose account is gone - released (cleared) at startup and on
 * the next settings request - and never handed to the first account as if nobody owned them.
 */
export const UNREADABLE_OWNER = '!unreadable';

/**
 * The owner stored in a settings block: '' when there is none (field missing, null or ''), the id
 * when it has the shape of an account id, otherwise `UNREADABLE_OWNER`.
 */
export function readStoredOwner(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  return typeof value === 'string' && OWNER_ID_PATTERN.test(value) ? value : UNREADABLE_OWNER;
}

/** Creation time in ms; an unreadable `createdAt` sorts after every readable one. */
function createdMs(a: AccountLike): number {
  const ms = Date.parse(a.createdAt);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

/**
 * Id of the real account created first (earliest `createdAt`, ties: lowest id); '' while there is
 * none. Guest accounts are skipped.
 */
export function firstAccountId(accounts: readonly AccountLike[]): string {
  let first: AccountLike | null = null;
  let firstMs = 0;
  for (const a of accounts) {
    if (a.guest) continue;
    const ms = createdMs(a);
    if (!first || ms < firstMs || (ms === firstMs && a.id < first.id)) {
      first = a;
      firstMs = ms;
    }
  }
  return first ? first.id : '';
}

/**
 * The owner of a settings block that stores `storedOwner`: that account while one is stored
 * (even one whose account is gone - it must be released, and its settings cleared, before anyone
 * else gets them), otherwise the first account ('' while there is none).
 */
export function settingsOwner(storedOwner: string, firstAccount: string): string {
  return storedOwner || firstAccount;
}
