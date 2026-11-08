/// <reference types="vite/client" />

/**
 * Build-time flag (Vite `define`): true only in the Android build (mobile/vite.config.mobile.ts),
 * false in the desktop/browser build (vite.config.ts), so `if (__MOBILE__)` branches are removed
 * from the desktop bundle. Not defined under the root vitest config - code that runs in tests
 * must read it through `typeof __MOBILE__ !== 'undefined'` (see src/utils/platform.ts).
 */
declare const __MOBILE__: boolean;

/**
 * Build-time flag of the Android build only (a Vite `define` in mobile/vite.config.mobile.ts, default
 * `false`): true boots the in-process diary core worker (local mode on the phone) instead of talking to
 * the Your Personal Diary server. Not defined in the desktop build nor under vitest - always read it
 * through `typeof __MOBILE_LOCAL_CORE__ !== 'undefined'` (see src/config/server-default.ts,
 * `shouldBootLocalCore()`).
 */
declare const __MOBILE_LOCAL_CORE__: boolean;

/** Developer / test switches of the build (src/config/server-default.ts); none is reachable from the UI. */
interface ImportMetaEnv {
  /** Overrides the API base (the Vite dev server, a local test server). */
  readonly VITE_API_BASE?: string;
  /** '1' makes the desktop build discover its local sidecar's port (local mode) instead of using the fixed server. */
  readonly VITE_LOCAL_SERVER?: string;
}
