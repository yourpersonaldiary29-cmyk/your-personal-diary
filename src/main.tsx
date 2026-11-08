/**
 * Entry point: installs the network guard, loads the styles, applies the
 * language chosen in the desktop installer and mounts the app inside its
 * providers. Order matters: AuthProvider needs the router (useNavigate),
 * SettingsProvider needs auth, LanguageProvider needs settings and the
 * announcer (it announces language changes), LockProvider needs auth. The
 * ConnectionProvider (the probe of the diary server, the "no connection"
 * state) needs nothing and sits outermost. The SyncProvider (the automatic
 * offline mode's review and sign-out dialogs and toasts) needs auth, the
 * router and the toasts; its dialogs render outside the app root, so they stay
 * usable over the lock screen.
 *
 * The published apps talk to the Your Personal Diary server (src/config/server-default.ts) and start
 * right away. The desktop app (Windows, Mac) first installs its offline seams (`installDesktopSeams`).
 * Only an Android build made with the `__MOBILE_LOCAL_CORE__` flag (local mode on the phone, the
 * developer / test configuration) first boots the mobile host - the diary core worker and its API
 * transport, mobile/host/boot.ts - see `shouldBootLocalCore()`.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './styles/index.css';
import { installNetworkGuard, isTauri } from './api/client';
import { shouldBootLocalCore } from './config/server-default';
import { AnnouncerProvider } from './context/AnnouncerContext';
import { AuthProvider } from './context/AuthContext';
import { ConnectionProvider } from './context/ConnectionContext';
import { LanguageProvider } from './context/LanguageContext';
import { LockProvider } from './context/LockContext';
import { SettingsProvider } from './context/SettingsContext';
import { SyncProvider } from './context/SyncContext';
import { ToastProvider } from './context/ToastContext';
import { initInstallLocale } from './i18n/install-locale';
import App from './App';

// Belt-and-braces: refuse any network call that is not the diary server.
installNetworkGuard();

function render(): void {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <HashRouter>
        <ConnectionProvider>
          <AuthProvider>
            <SettingsProvider>
              <AnnouncerProvider>
                <LanguageProvider>
                  <ToastProvider>
                    <SyncProvider>
                      <LockProvider>
                        <App />
                      </LockProvider>
                    </SyncProvider>
                  </ToastProvider>
                </LanguageProvider>
              </AnnouncerProvider>
            </SettingsProvider>
          </AuthProvider>
        </ConnectionProvider>
      </HashRouter>
    </React.StrictMode>,
  );
}

// Desktop: the installer's language is applied before the first render, so the first screen is
// already in it and a signed-in account's own language (LanguageProvider) still wins afterwards.
// In a browser this resolves immediately; it never rejects and waits at most ~1.5 s for the shell.
function start(): Promise<unknown> {
  return initInstallLocale().finally(render);
}

/**
 * The desktop shell (Windows, Mac): the Tauri offline seams - the key vault (DPAPI; the Keychain on the
 * Mac), the outbox mirror and the device unlock (Windows Hello; Touch ID or the Mac's password) - are
 * installed before anything renders, so the AuthProvider's first offline start (`offline.start` after
 * `me()`, or `offline.startFromCache` without a connection) already finds them: ARCHITECTURE.md
 * "offline seams", docs/OFFLINE-TEST.he.md, docs/android-tasks/OFFLINE-DESIGN.md section 7. With
 * "Remember me" the key is then kept at rest and the diary opens without a connection; without the
 * seams (a browser) the key lives in memory only and there is no offline start.
 *
 * The adapter is a dynamic import behind `isTauri()`: dist/ is also the web UI the diary server serves
 * to browsers (scripts/build-server.mjs and scripts/build-hosted.mjs copy it), and a browser never
 * requests that chunk (src/main.test.tsx). Never rejects: if the adapter cannot load, the app starts
 * as the web does rather than not at all.
 */
function installDesktopSeams(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return import('./offline/native/tauri')
    .then((adapter) => adapter.installTauriOfflinePlatform())
    .catch(() => undefined);
}

// `__MOBILE__` and `__MOBILE_LOCAL_CORE__` are build-time constants (vite.config.ts /
// mobile/vite.config.mobile.ts; neither is defined under vitest). The published Android build sets
// `__MOBILE_LOCAL_CORE__` to false, so the first branch below and the dynamic import behind it - the
// whole in-process core - are removed from its bundle, exactly as they are from the desktop bundle;
// the desktop build sets `__MOBILE__` to false, which removes both mobile branches.
if (typeof __MOBILE__ !== 'undefined' && __MOBILE__ && typeof __MOBILE_LOCAL_CORE__ !== 'undefined' && __MOBILE_LOCAL_CORE__ && shouldBootLocalCore()) {
  // Android local-core build: there is no HTTP server. The mobile host starts the diary core in a
  // Web Worker, routes the API client to it and only then starts the app (the splash of
  // mobile/index.html is on screen until then). bootMobile never rejects.
  void import('../mobile/host/boot').then(({ bootMobile }) => bootMobile(start));
} else if (typeof __MOBILE__ !== 'undefined' && __MOBILE__) {
  // The published Android app (server-only): the phone features (files, reminders, lock on leave,
  // back button) are installed without a core, then the app starts and the splash goes. The API
  // client talks to the fixed diary server. startServerMode never rejects.
  void import('../mobile/host/server-mode').then(({ startServerMode }) => startServerMode(start));
} else {
  // The desktop app, or the web UI in a browser (where `installDesktopSeams` does nothing).
  void installDesktopSeams().then(start);
}
