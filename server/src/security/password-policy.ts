/**
 * Localised password / username policy checks for the server.
 *
 * The policy itself lives in shared/constants (`passwordProblem`, `usernameProblem`, used by
 * the registration form before sending). Those helpers answer with a fixed text; the server
 * needs a catalogue key so the error renders in the request language. `passwordProblemKey`
 * defers to the shared function for the accept/reject decision (so the UI and the server can
 * never disagree) and only picks the matching key.
 */
import { PASSWORD_MIN_LENGTH, passwordProblem, usernameProblem } from '@shared/constants';
import type { Params } from '@shared/i18n';
import { ApiError } from '../errors';

export interface PolicyProblem {
  key: string;
  params?: Params;
}

/** Longest password accepted (mirrors shared/constants `passwordProblem`). */
export const PASSWORD_MAX_LENGTH = 256;

/** Catalogue key of the password policy violation, or null when the password is acceptable. */
export function passwordProblemKey(pw: string): PolicyProblem | null {
  if (passwordProblem(pw) === null) return null;
  if (pw.length < PASSWORD_MIN_LENGTH) return { key: 'server.auth.passwordTooShort', params: { min: PASSWORD_MIN_LENGTH } };
  if (pw.length > PASSWORD_MAX_LENGTH) return { key: 'server.auth.passwordTooLong' };
  return { key: 'server.auth.passwordNeedsLettersAndDigits' };
}

/** Catalogue key of the username policy violation, or null when the username is acceptable. */
export function usernameProblemKey(u: string): PolicyProblem | null {
  return usernameProblem(u) === null ? null : { key: 'server.auth.usernameInvalid' };
}

/** 400 WEAK_PASSWORD (field 'password') for a password the policy rejects, or null. */
export function weakPasswordError(pw: string): ApiError | null {
  const problem = passwordProblemKey(pw);
  return problem ? ApiError.weakPassword(problem.key, problem.params) : null;
}
