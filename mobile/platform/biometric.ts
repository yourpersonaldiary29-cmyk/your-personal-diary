/**
 * "Unlock with fingerprint or face" (WP-9) - the honest design.
 *
 * The lock is a SERVER-side session lock: while locked, the data routes answer 423 and only the
 * account password (POST /api/auth/verify-password) unlocks. Biometrics can therefore never
 * replace the password at login or for password confirmations, and this module never stores the
 * password. What it stores (in the Android Keystore, bound to biometric authentication - see
 * mobile/plugins/diary-biometric) is an UNLOCK TOKEN the core issues when the user turns the
 * setting on with their password, and which the core accepts for unlocking a locked session of
 * that account only.
 *
 * THE CORE CONTRACT THIS NEEDS (not part of this package's ownership: mobile/core, server/src):
 *   POST /api/auth/biometric/enroll   body { password }  -> 200 { token }     (401 WRONG_PASSWORD)
 *        verifies the password of the signed-in account, creates a random 32-byte token, stores
 *        only its hash with the account (device-local data, never in the backup), answers the
 *        token once (base64url). A second enroll replaces the previous token.
 *   POST /api/auth/biometric/unlock   body { token }     -> 204               (401 BIOMETRIC_REJECTED)
 *        for a LOCKED session of the account that enrolled this token: clears the session's lock
 *        (what verify-password does), counts failures and revokes the token after 5 wrong ones.
 *   DELETE /api/auth/biometric                           -> 204
 *        revokes the token (also called by logout / password change / account deletion on the core side).
 * Until the core answers these (today: 404), BIOMETRIC_UNLOCK_ENABLED is false: the setting and
 * the lock-screen button are not shown. Nothing is faked.
 */
import type { BiometricPromptTexts, DiaryBiometricPlugin } from '../plugins/diary-biometric';

/** Feature flag: flipped to true once the core implements the contract above. */
export const BIOMETRIC_UNLOCK_ENABLED = false;

export type BiometricLike = Pick<DiaryBiometricPlugin, 'isAvailable' | 'enroll' | 'unlock' | 'clear'>;

/** The core side of the contract (injected; mobile/platform/index.ts calls the endpoints above). */
export interface BiometricCore {
  createToken(password: string): Promise<string>;
  unlockWithToken(token: string): Promise<boolean>;
  revokeToken(): Promise<void>;
}

export interface BiometricDeps {
  plugin: BiometricLike;
  core: BiometricCore;
  texts: () => BiometricPromptTexts;
  /** Persists the phone setting (`biometricUnlock`). */
  onEnabledChange: (enabled: boolean) => Promise<void>;
}

export type BiometricUnlockResult = 'unlocked' | 'cancelled' | 'failed' | 'not-enrolled';

export interface BiometricUnlock {
  isAvailable(): Promise<boolean>;
  /** Turns the setting on: the password creates the token, the prompt stores it. False when not done. */
  enable(password: string): Promise<boolean>;
  disable(): Promise<void>;
  unlock(): Promise<BiometricUnlockResult>;
}

export function createBiometricUnlock(deps: BiometricDeps): BiometricUnlock {
  const noop = () => undefined;
  return {
    async isAvailable() {
      try {
        return (await deps.plugin.isAvailable()).status === 'available';
      } catch {
        return false;
      }
    },
    async enable(password) {
      const token = await deps.core.createToken(password);
      const result = await deps.plugin.enroll({ token, ...deps.texts() });
      if (!result.ok) {
        // The token exists in the core but nowhere else: revoke it rather than leave it dangling.
        await deps.core.revokeToken().catch(noop);
        return false;
      }
      await deps.onEnabledChange(true);
      return true;
    },
    async disable() {
      await deps.plugin.clear().catch(noop);
      await deps.core.revokeToken().catch(noop);
      await deps.onEnabledChange(false);
    },
    async unlock() {
      const result = await deps.plugin.unlock(deps.texts());
      if (!result.token) {
        if (result.reason === 'cancelled') return 'cancelled';
        if (result.reason === 'invalidated' || result.reason === 'not-enrolled') {
          // A new fingerprint / face was enrolled (the key is gone) or nothing is stored: the
          // setting cannot work any more - turn it off; the password remains.
          await deps.plugin.clear().catch(noop);
          await deps.core.revokeToken().catch(noop);
          await deps.onEnabledChange(false).catch(noop);
          return 'not-enrolled';
        }
        return 'failed';
      }
      let accepted = false;
      try {
        accepted = await deps.core.unlockWithToken(result.token);
      } catch {
        accepted = false;
      }
      if (accepted) return 'unlocked';
      return 'failed';
    },
  };
}
