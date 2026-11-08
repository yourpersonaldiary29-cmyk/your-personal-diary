TASK: show the signed-in user's ACCOUNT ID in Settings so the owner of the hosted server can copy it into DIARY_OWNER_ID.

Why: the production server (https://yourpersonaldiary.fly.dev) now holds the owner's migrated accounts, but its owner-only cards (e-mail, server) stay off until the operator runs `flyctl secrets set DIARY_OWNER_ID=u_... -a yourpersonaldiary` (server/src/hosted/owner.ts: no first-account fallback, by design). docs/HOSTED-DEPLOY.he.md step "שלב ו" tells the owner to copy "מזהה חשבון" from Settings -> Account, but the UI does not show it anywhere. Nobody may read the server's accounts.json to find the id: the owner must be able to read his own id in the app.

READ FIRST: docs/android-tasks/ENV.md (shared rules for agents), src/pages/settings/AccountSection.tsx (the Account card, DefinitionList rows), src/pages/settings/PrivacySection.tsx (how hosted mode is detected: useHostedServer from src/context/ConnectionContext.tsx), src/pages/settings/hosted.test.tsx (hosted-mode Settings tests), src/pages/settings/texts.ts (ST), shared/i18n/messages/<locale>/ (20 locales; the parity test), the User type (user.id).

DO:
1. In the Account card, add one row "Account ID" whose value is user.id in an LTR monospace span plus a small secondary "Copy" button (navigator.clipboard.writeText; on success a polite announcement + toast "Account ID copied"; on failure a toast telling the user to select and copy the text by hand - never throw). Show the row ONLY when the app talks to a hosted server (useHostedServer() true). Local/developer mode renders exactly as before, so existing tests keep their expectations unchanged.
2. Under the row, one short muted hint: "Only the server owner needs this, to turn on the owner cards." Keep it a single sentence.
3. New texts in all 20 locales (real translations, not English copies; the brand stays English; "DIARY_OWNER_ID" is never shown in the UI). i18n parity test green.
4. Tests: hosted mode shows the row with the id, copy success and copy failure paths, local mode does not show it (extend hosted.test.tsx or a new AccountSection test next to the file).
5. Fix docs/HOSTED-DEPLOY.he.md step "שלב ו" so its wording matches the real UI (card name, row name, the Copy button) in Hebrew. Do not touch other steps.

DO NOT: touch server/**, mobile/**, src-tauri/**, scripts/**, store/**, deploy/** (other agents own them right now); run fly, deploy, or contact the real servers; read any real data directory.

GATES (run and quote the results): root `npx tsc -p tsconfig.json --noEmit` (or the project's typecheck script), the root vitest suite (whole suite, not only your files), the i18n parity test, `npx vite build`, `node scripts/check-no-network.mjs`.

RETURN: summary, files changed, gate results with numbers, open issues.
