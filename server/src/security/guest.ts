/**
 * Guest mode ("tour"): a temporary account so a new user can look around before registering.
 * Mobile only - the route that starts it (POST /api/auth/guest) is mounted only when the app is
 * built with `guestAllowed` (the Android core); the desktop server never sets it.
 *
 * What a guest is:
 *   - an account record that lives in memory only (username '_guest_<random>', id 'g_<random>',
 *     a random diary key and a random verifier - there is no password that opens it), marked
 *     `guest: true`;
 *   - a memory-only diary (security/vault.ts `createMemoryVault`) filled with the demo data, in the
 *     language of the request;
 *   - one ordinary, non-remembered session marked `guest: true`.
 * Nothing of it ever reaches the disk: accounts.json, sessions.json and users/ stay untouched.
 * It ends at logout, when the session expires and when the server stops. On a phone (the local
 * rule) there is at most one guest at a time, and a real registration or sign-in ends it. On the
 * hosted server (docs/android-tasks/HOSTED-IMPL.md item 9; `AuthServiceOptions.guests`) many
 * visitors take the tour at once - up to a cap, each ended by itself after its lifetime, and a
 * real sign-in ends nobody's tour.
 *
 * What a guest is not: it is never the owner of the computer / phone (security/owner.ts skips it),
 * it is not listed among the accounts, and it cannot do anything that needs a real account -
 * change the password, edit the profile, lock the diary, delete the account, back up or restore,
 * see or change the remote-access / mail settings (403).
 */
import { randomBytes } from 'node:crypto';
import { ApiError } from '../errors';
import type { AccountRecord, Session } from './session-types';

/** Usernames of guest accounts start with this (followed by '_' and random hex digits). */
export const GUEST_USERNAME_PREFIX = '_guest';
/** Ids of guest accounts: 'g_' + 16 hex digits (real accounts: 'u_' + 16 hex digits). */
export const GUEST_ID_PREFIX = 'g_';
/** Catalogue key of the 403 answered when a guest tries something that needs a real account. */
export const GUEST_NOT_ALLOWED_KEY = 'server.auth.guestNotAllowed';
/** Catalogue key of the 503 answered on a hosted server when the cap of concurrent guests is reached. */
export const GUESTS_FULL_KEY = 'server.auth.guestsFull';
/** `Retry-After` of that 503, in seconds (tours end by themselves; a slot frees up within minutes). */
export const GUESTS_FULL_RETRY_AFTER_SEC = 120;

export function newGuestAccountId(): string {
  return `${GUEST_ID_PREFIX}${randomBytes(8).toString('hex')}`;
}

export function newGuestUsername(): string {
  return `${GUEST_USERNAME_PREFIX}_${randomBytes(4).toString('hex')}`;
}

/** 403 FORBIDDEN 'server.auth.guestNotAllowed'. */
export function guestNotAllowed(): ApiError {
  return ApiError.forbidden(GUEST_NOT_ALLOWED_KEY);
}

/** 503 OTHER 'server.auth.guestsFull' with `Retry-After` (hosted mode: every guest slot is taken). */
export function guestsFull(): ApiError {
  const e = ApiError.localized(503, 'OTHER', GUESTS_FULL_KEY);
  e.retryAfterSec = GUESTS_FULL_RETRY_AFTER_SEC;
  return e;
}

/** True when the request context belongs to a guest (the account or the session says so). */
export function isGuestContext(ctx: { account?: Pick<AccountRecord, 'guest'>; session?: Pick<Session, 'guest'> } | null | undefined): boolean {
  return ctx?.account?.guest === true || ctx?.session?.guest === true;
}
