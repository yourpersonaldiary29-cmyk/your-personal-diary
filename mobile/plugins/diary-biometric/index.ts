/**
 * `DiaryBiometric` - the biometric half of "Unlock with fingerprint or face" (WP-9).
 * Java: android/app/src/main/java/com/mydiary/app/plugins/DiaryBiometricPlugin.java.
 *
 * What it stores: ONE secret the diary core issued (an unlock token - never the password), encrypted
 * with an AES-GCM key of the Android Keystore that
 *   - requires a biometric authentication for every use (setUserAuthenticationRequired, timeout 0,
 *     AUTH_BIOMETRIC_STRONG on Android 11+),
 *   - is invalidated when a fingerprint / face is added or removed (setInvalidatedByBiometricEnrollment),
 *   - never leaves the secure hardware.
 * The BiometricPrompt is shown with a CryptoObject around that key's cipher, so the token is only
 * decrypted when the prompt succeeded - there is no "yes/no" answer the JavaScript could fake.
 * Android 9+ (API 28, framework BiometricPrompt); older phones report `unsupported`.
 */
import { registerPlugin } from '@capacitor/core';

export type BiometricAvailability = 'available' | 'none-enrolled' | 'no-hardware' | 'unsupported' | 'unavailable';

export interface BiometricPromptTexts {
  title: string;
  subtitle?: string;
  /** Label of the mandatory "use password instead" button. */
  negative: string;
}

export interface DiaryBiometricPlugin {
  /** Whether a biometric prompt can be shown, and whether a token is stored (`enrolled`). */
  isAvailable(): Promise<{ status: BiometricAvailability; enrolled: boolean }>;
  /** Shows the prompt and, when it succeeds, stores `token` encrypted with the biometric-bound key. */
  enroll(options: { token: string } & BiometricPromptTexts): Promise<{ ok: boolean; reason?: 'cancelled' | 'failed' | 'unavailable' }>;
  /** Shows the prompt and returns the stored token; `token` is null with the reason otherwise. */
  unlock(options: BiometricPromptTexts): Promise<{ token: string | null; reason?: 'cancelled' | 'failed' | 'invalidated' | 'not-enrolled' | 'unavailable' }>;
  /** Forgets the token and deletes the key. */
  clear(): Promise<void>;
}

export const DiaryBiometric = registerPlugin<DiaryBiometricPlugin>('DiaryBiometric');
