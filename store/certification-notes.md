# Certification notes - Your Personal Diary

Two texts to paste on the **Submission options** page of Partner Center. Paste only what is between the
lines `-----`. In Partner Center, before you save: add today's date at the top of block A (Microsoft asks for "The
date you're entering the notes") and replace the two brackets in its last line with the demo account's user name
and password (see "The demo account" below - it is required).

Rewritten 2026-10-27 for the current app: a client of the Your Personal Diary server with the automatic offline
mode (the notes of the old local-only app - local helper process, 127.0.0.1, DuckDNS - are gone).

## A. Notes for certification

-----
Thank you for testing Your Personal Diary.

1. Account and internet. The app is the Windows client of the Your Personal Diary service (https://yourpersonaldiary.fly.dev). It needs an internet connection to sign in for the first time and to create an account. Please use the demo account at the end of these notes: on the first screen choose "Log in", enter its user name and password, and tick "Remember me" if you want to test opening the app without a connection. The demo account already has sample data.

2. Your own account (optional). On the first screen choose "Sign up", fill in the form (the password needs at least 8 characters with letters and digits) and choose "Create account". The e-mail address is not verified, but each address can be registered only once, so use one that nobody else has used (for example with today's date and time in it). It is used for "Forgot password?" messages and for security notices (password changed with a reset message, e-mail address changed). The server accepts at most 5 registration attempts per hour and 20 per day from one network, so on a shared network please use the demo account.

3. Test data. In a new account, open Settings > Data > "Load sample data" (shown while the diary is empty). It creates about 120 days of fictional entries and habits, so that Home, Insights, Statistics, Calendar and Search have content.

4. Language. The app opens in English. Settings > Language offers 20 languages (Hebrew and Arabic are right to left); the choice is saved with the account.

5. Without a connection. After the first sign-in the app keeps working offline: disconnect the network and a bar says "No connection – what you write will be saved to the server when the connection returns." New and edited entries, habit ticks and settings are kept encrypted on the PC and uploaded automatically, in order and only once, when the connection returns - also after the app was closed. With "Remember me" ticked at sign-in, the app also opens without a connection and shows what was viewed recently. Insights, search, statistics, backup, export and the account settings say "This needs a connection to the diary server." while offline.

6. Network use. The app connects only to https://yourpersonaldiary.fly.dev, over HTTPS; the privacy-policy link opens in the default browser. There are no ads, no analytics and no third-party SDKs. Signing out deletes the encrypted local copy.

7. Other places: lock with Ctrl+L; the Backup page has the encrypted backup, restore and export (TXT, CSV, JSON, PDF); habit reminders appear as Windows notifications while the app is running; Settings > "Delete account" (the last card) deletes the account and its diary from the server. Please do not delete the demo account.

8. The app is a personal journaling tool, not a medical or diagnostic tool. Its insights only describe possible relationships in the user's own entries.

Demo account - user name: [USER NAME], password: [PASSWORD]
-----

## B. Restricted capability justification (runFullTrust)

-----
Your Personal Diary is a packaged Win32 desktop application (Tauri 2: a Rust executable that hosts a WebView2 window), so it needs runFullTrust to run at all. It is not a UWP app and cannot run in an AppContainer.

How the capability is used:
- The executable (your-personal-diary.exe) creates the app window with the Evergreen WebView2 runtime and shows the app's own interface, which is inside the package. It bundles no helper processes (only the WebView2 runtime starts its usual browser processes).
- The window talks only to the Your Personal Diary server (https://yourpersonaldiary.fly.dev) over HTTPS; its Content-Security-Policy allows no other address.
- The app reads and writes only its own data folder (the WebView2 profile and an encrypted copy for offline use, whose key is protected with DPAPI for the current Windows user) and the files the user picks in the standard save and open dialogs (backup, restore and export).
- It shows habit reminders as Windows toast notifications.

The app does not install drivers or services, does not run at startup, does not change system settings and does not download or execute code.
-----

## The demo account (required - its password never goes into this repository)

Microsoft requires it: Store Policies 7.20 (updated 2026-09-15), 10.3.1: "If your product requires login
credentials, provide us with a working demo account using the Notes for certification field." The app requires
signing in, so block A ends with the demo account's line. Open registration alone is not enough, because the
testers can be blocked by the server's own rules:

- at most 5 registration attempts per hour and 20 per day from one IPv4 address or IPv6 /64, counted on every
  attempt, successful or not (`REGISTER_PER_HOUR` / `REGISTER_PER_DAY` in `server/src/hosted/policy.ts`, used with
  these defaults by `server/src/hosted.ts`) - testers who share a network get "Too many registrations from your
  network. Please try again later.";
- every e-mail address can be registered only once (`server/src/security/auth-service.ts`, `register`), so two
  testers who type the same made-up address collide ("This email address is already registered.").

How to make it (the owner, once, shortly before the first submission):

1. In the app (the Store build or the current Windows app): on the first screen **Sign up**. User name for example
   `storetest`; first and last name `Store` / `Tester`; e-mail address: one that reaches you but is not your own
   account's address, for example the support mailbox with a plus tag (`yourpersonaldiary29+storetest@gmail.com`
   - Gmail delivers it to the same mailbox, and the server treats it as a different address); a new password that
   you use nowhere else. **Create account**.
2. Settings > Data > **Load sample data**, so the testers see a full diary.
3. In Partner Center, in block A's last line, replace `[USER NAME]` and `[PASSWORD]` with the two values. Type them
   **only there** - never into this repository, a chat or another file.
4. Keep the account: every later submission (each update) is tested again with the same notes. If you change its
   password, change it in the notes of the next submission too. Delete it (Settings > Delete account) only if the
   app is withdrawn from the Store.

## Background for whoever maintains these notes (do not paste)

- Microsoft's guidance (read 2026-10-27, "Manage submission options for MSIX app", updated 2026-08-17,
  https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/manage-submission-options):
  "Be succinct and keep instructions simple"; "If your app requires users to log in to a service or social media
  account, provide the user name and password for a test account"; "Services and external components must be
  online and available ... If your app can't connect to a service it needs during testing, it may fail
  certification"; for restricted capabilities "tell us why your app needs to declare the capability and how it is
  used". Store Policies 7.20 (updated 2026-09-15): 10.3.1 (demo account, required - see above) and 10.3.2 ("If
  your product requires access to a server, the server must be functional").
- Before submitting, check that registration on the server is open (no invite code is set): create the demo account
  in the Store build (above). If an invite code is required, give it in block A - or open registration first.
- Facts behind the notes: the fixed server address `src/config/server-default.ts` (HOSTED-IMPL item 8, server-only
  apps); the first screen is the Welcome page (`src/router.tsx`, `src/pages/WelcomePage.tsx`) with the buttons
  "Sign up" and "Log in" (`shell.register`, `shell.login` in `shared/i18n/messages/en/shell.ts`); the Sign up page
  submits with "Create account" (`auth.createAccount`, `src/pages/RegisterPage.tsx`); registration fields and
  `PASSWORD_MIN_LENGTH = 8` (`shared/constants.ts`, "At least 8 characters, with letters and digits" in
  `shared/i18n/messages/en/auth.ts`); no e-mail verification in v1 (HOSTED-IMPL item 6); what the e-mail address is
  used for (legal/privacy section 3: password reset messages and security notices); the registration limits and the
  unique e-mail address (see "The demo account"; the messages `server.auth.tooManyRegistrations` and
  `server.auth.emailTaken` in `shared/i18n/messages/en/server.ts`); sample data `POST /api/settings/seed-demo`
  behind Settings > Data (`src/pages/settings/DataSection.tsx`, only while the diary is empty and online;
  `SEED_DEFAULT_DAYS = 120` in `server/src/db/seed.ts`); the Store build opens in English (`src/i18n/runtime.ts`);
  the offline bar and "needs a connection" texts (`shell.sync.offline`, `shell.sync.needsConnection` in
  `shared/i18n/messages/en/shell.ts`); what works offline and the local copy (docs/android-tasks/OFFLINE-DESIGN.md
  section 10, legal/privacy section 5, `store/policy/partner-center-privacy.md`); reminders as toasts
  (`src/hooks/useReminders.ts`, the shell command in `src-tauri/src/lib.rs`); Ctrl+L
  (`src/hooks/useKeyboardShortcuts.ts`). The manifest's only restricted capability is runFullTrust
  (`src-tauri/msix/AppxManifest.template.xml`).
- If the package later declares more capabilities (see `store/MSIX-BUILD.md`), add a short paragraph for each
  restricted one to block B.
- `node store/render.mjs` also writes blocks A and B as plain text files that open in Notepad:
  `store/out/txt/certification-notes-A.txt` and `store/out/txt/certification-notes-B.txt`. The lines `-----` are the
  markers the script cuts at - keep exactly two of them around each block.
