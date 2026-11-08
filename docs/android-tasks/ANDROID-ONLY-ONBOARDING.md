TASK: make the first-run language screen and the "Skip - just look around" tour button ANDROID-APP ONLY (owner decision 2026-10-23, docs/android-tasks/HOSTED-IMPL.md item 12).

Current behaviour (read the code, do not trust this summary blindly):
- src/pages/onboarding/first-run.ts `firstRunApplies()`: true in the phone UI (isMobileUi()), and on the desktop when there is no installer language and no stored language (MSIX case) - then the screen starts in English (DESKTOP_FIRST_RUN_LOCALE).
- src/pages/onboarding/SkipTourButton.tsx `tourOffered(info, phoneUi)`: true whenever the hosted server says guestTour: true - so the Windows app and the web UI now offer the tour too.

WANTED:
1. The first-run language screen applies only in the Android app (the mobile build / phone UI). Never on Windows (NSIS or MSIX) and never in the web UI served by the hosted server. Remove the desktop branch and its English-preselect logic cleanly (no dead code, comments updated). On Windows the language comes from the installer (install-locale) or the app's normal default resolution; Settings -> Language changes it. Make sure nothing else (router, shells, AppShell plain header while pending, etc.) still assumes a desktop first run.
2. The Skip tour button is offered only in the Android app (phone UI), on the welcome, login and registration screens, as today there. Never on Windows and never in the web UI, whatever ServerInfo.guestTour says. Keep the 404 handling. Do not change the server (POST /api/auth/guest stays for Android).
3. Decide precisely which predicate means "the Android app" in this code base (isMobileUi() from src/utils/mobile-ui.ts vs isNativeApp() from src/utils/platform.ts / src/api/client.ts) - read both, explain the choice in your report, and make sure a phone-sized browser window on the web UI does NOT get the screen or the button, while the Android app (including its browser-preview build mobile-dist used in tests) does.
4. Update the tests: FirstRunLanguagePage.test.tsx, SkipTour.test.tsx and any other test that expected the desktop screen or the desktop/web button - their expectations change because of the owner decision. Add tests that prove: desktop (Tauri, with and without install locale) never shows the screen; web never shows the screen; Windows and web never show the Skip button even with guestTour: true; the Android app still shows both.
5. Update ARCHITECTURE/README lines or docs that describe the desktop first-run screen or the desktop/web tour (grep for them), and docs/STORE-RELEASE.he.md only if it promises a first-run language screen in the MSIX build (one-line correction: the Store version opens in the default language and the user changes it in Settings).

DO NOT: touch server/**, mobile/core/**, src-tauri/**, scripts/**, store/**, deploy/**, src/pages/settings/AccountSection.tsx (another agent's); run fly or deploy; read real data directories.

GATES (run and quote the numbers): root typecheck, the whole root vitest suite, i18n parity, `npx vite build`, `npm run mobile:typecheck`, `npm run mobile:test`, `npm run mobile:build`, `node scripts/check-no-network.mjs`.

RETURN: summary, files changed, the predicate decision, gate results with numbers, open issues.
