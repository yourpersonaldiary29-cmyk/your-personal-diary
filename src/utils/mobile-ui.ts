/**
 * The phone UI switch.
 *
 * The Android app is the same React UI built with `__MOBILE__ = true` (mobile/vite.config.mobile.ts).
 * In that build the app gets the Android-comfortable shell (top app bar, bottom navigation, floating
 * "New entry" button, "More" sheet - src/components/layout/MobileShell.tsx) and the "Skip - just look
 * around" tour button (src/pages/onboarding/SkipTourButton.tsx). In the desktop / browser build - the
 * Windows app and the web UI served by the diary server - the flag is the constant `false`, so
 * nothing of it is ever shown there, whatever the window size (docs/android-tasks/HOSTED-IMPL.md
 * item 12). No build has a first-run language screen (item 13): the Android app starts in the
 * phone's system language (src/i18n/runtime.ts).
 *
 * `isMobileUi()` is true for the whole mobile build - inside the installed app and when that build is
 * opened in a plain browser during development (`npm run mobile:dev`), so the phone UI can be
 * checked without a phone. Code that needs the native runtime itself (plugins) asks
 * `isNativeApp()` from './platform' instead.
 *
 * Where a whole module must stay out of the desktop bundle, the call site spells the condition out
 * (`typeof __MOBILE__ !== 'undefined' && __MOBILE__`): the bundler folds that to `false` and drops
 * the branch together with the import behind it (see AppShell.tsx and router.tsx). Under the root
 * vitest config the flag is not defined at all; tests turn the phone UI on with
 * `vi.stubGlobal('__MOBILE__', true)`.
 */

/** True in the Android build of the UI (see the module comment). Always false on the desktop. */
export function isMobileUi(): boolean {
  return typeof __MOBILE__ !== 'undefined' && __MOBILE__ === true;
}

/** Class set on <html> while the phone shell is mounted; every rule of src/styles/mobile.css hangs on it. */
export const MOBILE_UI_CLASS = 'platform-mobile';
