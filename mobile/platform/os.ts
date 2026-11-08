/**
 * Which phone the Capacitor app runs on (docs/APPLE-PLAN.md, WP-A2): the few places of
 * mobile/platform that differ between Android and iOS branch on this value, injected by
 * mobile/platform/index.ts from `Capacitor.getPlatform()`. Every other value - 'web' in
 * `npm run mobile:dev`, an unknown platform, nothing at all - is treated as Android, so the Android
 * app keeps exactly the paths it had before iOS existed and the tests that pass no `os` test them.
 */
export type PhoneOs = 'android' | 'ios';

/** The phone OS of a Capacitor platform name; Android for everything that is not iOS. */
export function phoneOsOf(platform: string | null | undefined): PhoneOs {
  return platform === 'ios' ? 'ios' : 'android';
}
