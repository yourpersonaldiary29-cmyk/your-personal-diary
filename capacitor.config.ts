/**
 * Capacitor configuration of the Android app (docs/ANDROID-PLAN.md) and - prepared, not built yet -
 * of the iPhone app (docs/APPLE-PLAN.md; the `ios` section and the iOS notes at the end).
 *
 * The web assets are the mobile build of the same React UI (`npm run mobile:build` -> mobile-dist/).
 * The published app is a client of the Your Personal Diary server (docs/android-tasks/HOSTED-IMPL.md
 * item 8): the bundled UI calls the fixed server address baked in from src/config/server-default.json.
 * `server.url` (Capacitor's option to load the web content from a URL) must stay unset - the WebView
 * only ever loads the bundled assets. The in-WebView core (mobile/core/: the server logic in a Web
 * Worker) exists in the developer build with MOBILE_LOCAL_CORE=1 only (README section 5.3).
 * No live reload and no cleartext either: the native project (android/, WP-14) sets
 * usesCleartextTraffic=false and a network security config on top of the CSP of mobile/index.html.
 *
 * Deliberately left at Capacitor's defaults (WP-14):
 *  - `android.webContentsDebuggingEnabled`: unset = on for debuggable (debug) builds only, off in
 *    release (CapConfig reads the flag with the build's debuggable state as the default);
 *  - the SystemBars plugin (built into Capacitor 8): `insetsHandling` "css" passes the safe-area
 *    insets through, so the app's `env(safe-area-inset-*)` CSS (src/styles/mobile.css) is what
 *    handles edge-to-edge, and the bar icon style follows the system light/dark theme like the
 *    DayNight theme of android/app/src/main/res/values/styles.xml.
 *
 * iOS (docs/APPLE-PLAN.md WP-A2). The same file configures the iPhone app; the `ios` section below
 * is read by the iOS runtime only (the Android runtime never looks at it), and no iOS project exists
 * until `npx cap add ios` is run ON A MAC (scripts/ios/README.he.md - never on Windows). Deliberately
 * left at Capacitor's defaults there:
 *  - `server.iosScheme` (`capacitor`) and `server.hostname` (`localhost`): the page's origin is
 *    capacitor://localhost, which the diary server already lists among the origins it answers
 *    (server/src/middleware/access.ts HOSTED_ORIGINS). Changing either would lock the app out;
 *  - `server.allowNavigation`: unset, so a link to another origin (the privacy policy) is handed to
 *    the system browser and never loads inside the app;
 *  - `ios.backgroundColor`: unset = the system background colour, which follows light / dark mode
 *    (a fixed colour here could not), so there is no flash before the page paints;
 *  - `ios.webContentsDebuggingEnabled`: unset = Safari's Web Inspector attaches to debug builds
 *    only, as on Android;
 *  - `ios.limitsNavigationsToAppBoundDomains` (false): the app declares no WKAppBoundDomains.
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // The Android application id (owner decision 2026-10-25; com.mydiary.app is taken on Google Play).
  // It cannot be changed after the first Play upload. It must equal `appId` of
  // android/app/build.gradle - the one place the build reads; the Java namespace stays
  // com.mydiary.app there. Capacitor 8 uses this value only when `cap add` creates a platform
  // project (package name, strings.xml) and copies it into assets/capacitor.config.json on
  // `cap sync`; the Android runtime never reads it (the bridge uses the real package name).
  // The Windows app keeps its own identifier com.mydiary.app (src-tauri).
  appId: 'app.yourpersonaldiary',
  // The brand is always English.
  appName: 'Your Personal Diary',
  webDir: 'mobile-dist',
  server: {
    // The bundled UI is served from the secure local origin of the WebView (localStorage, crypto.subtle).
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    // The page reaches under the status bar and the home indicator and pads itself with
    // env(safe-area-inset-*) (viewport-fit=cover in mobile/index.html, src/styles/mobile.css), so
    // the web view must not add insets of its own. Capacitor's default, spelled out because the
    // layout depends on it.
    contentInset: 'never',
    // An iPad would otherwise ask for the desktop site (a Mac user agent); the app has one phone UI.
    preferredContentMode: 'mobile',
    // No preview bubble on a long press of a link: it would open a second view of an app page.
    allowsLinkPreview: false,
  },
};

export default config;
