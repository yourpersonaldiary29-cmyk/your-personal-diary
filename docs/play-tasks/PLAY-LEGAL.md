TASK: the legal/policy part of the Google Play kit (WP-17) - for the app as it really is NOW: a server-only client of the hosted server https://yourpersonaldiary.fly.dev (Fly.io, region Frankfurt, EU), with the automatic offline mode of docs/android-tasks/OFFLINE-DESIGN.md (its section 10 has the binding sentences about the device copy). The existing store/privacy-policy/privacy-{en,he}.txt describe the OLD local-only Windows app and are wrong for every published app now.

READ FIRST: docs/android-tasks/ENV.md (last update is current), docs/android-tasks/HOSTED-IMPL.md (items 6, 8-13), docs/HOSTED-PLAN.md (the Hebrew owner summary and section 6 "Privacy policy and Store/Play consequences"), docs/android-tasks/OFFLINE-DESIGN.md section 10, store/privacy-policy/** (the old texts: structure, tone, what they covered), the server code that decides what is stored (server/src/security/**, server/src/mail/**, server/src/hosted/**, server/src/sync/**), src/pages/settings/{PrivacySection,DeleteAccountSection}.tsx, src/pages/RegisterPage.tsx. Read Google's CURRENT rules with WebFetch and cite them: the Play User Data policy (privacy policy in the Play Console field AND inside the app), the Data safety form definitions ("collected", "shared", service providers, encryption in transit, deletion requests), the account-deletion requirement (an in-app path AND a web resource where a user can request deletion without reinstalling the app), the content rating (IARC) questionnaire, Target audience and content.

DELIVER (new folder legal/ at the repo root; never under store/**, which stays frozen):

1. legal/privacy/privacy-en.md and privacy-he.md - the privacy policy of the hosted service and its apps (Windows, Android, web):
   - who operates it ({{PUBLISHER_NAME}}, {{CONTACT_EMAIL}} placeholders - the owner fills them; keep one single place to set them);
   - what is stored on the server (account details, the encrypted diary per account, sessions, password-reset records, the owner's mail settings) and where (Fly.io, Frankfurt, EU);
   - encryption at rest per account (AES-256-GCM, key derived from the password) and what that does NOT protect against: the diary is decrypted in the server's memory while signed in, and the operator holds the recovery-key escrow and could reset a password - say it plainly (HOSTED-PLAN section 6);
   - what is on the device (session token, preferences, the offline copy and outbox per OFFLINE-DESIGN section 10);
   - e-mail use (password reset only); no ads, analytics, tracking or selling of data;
   - sub-processors (Fly.io hosting; Google's Gmail SMTP for sending reset mail);
   - retention and deletion (Settings -> Delete account removes the account and diary from the server; snapshots of the server volume are kept up to 30 days - state it);
   - children: decide and justify the minimum age for a personal diary (recommend 13+ or 16+, citing the EU/Israel rules) and flag it as an owner decision;
   - changes to the policy; contact.
   Plain language, short sections, the same facts in both languages.

2. The other 18 languages (ar, zh, ja, hi, th, es, pt, fr, it, de, ro, el, pl, cs, hu, ru, bg, tr): real translations of the English policy, same structure; the brand stays English.

3. Web pages served by the hosted server, from Vite's public/ folder so they land in dist/ and the server's static handler serves them without a server change. Verify that claim in server/src first - if the SPA fallback, the Host check or the CSP blocks it, make the smallest change and test it.
   - public/privacy/index.html (language links + the English text) and public/privacy/<locale>/index.html for all 20 locales;
   - public/delete-account/index.html (+ he and the other locales): the Play "data deletion" web resource - how to delete the account in the app or on the website (sign in at the address, Settings -> Delete account), how to ask the operator by e-mail if you cannot sign in ({{CONTACT_EMAIL}}), what is deleted and when.
   - Self-contained HTML, no external resources, RTL for he/ar, readable on a phone.
   - Generate them from the .md sources with a small script (scripts/legal/build-pages.mjs) so a text change is one edit; a test proves every locale page exists and that the placeholders are replaced from the one settings place.

4. In-app links: a "Privacy policy" link in Settings -> Privacy card and a short line with the link on the registration screen ("By creating an account you agree to ... Privacy policy"), opening the page in the system browser on Windows and Android (reuse the app's existing external-link mechanism if there is one; if there is none, add the smallest safe one and keep scripts/check-no-network.mjs green - the only allowed origin is the fixed server). New texts in all 20 locales (parity green), tests.

5. play/policy/data-safety.md - the exact answers for the Play Data safety form, question by question, with the reason for each (data types such as name, e-mail address, user IDs, and the diary entries/habits as user-generated content in the best-fitting current category; collected yes, shared no; encrypted in transit yes; users can request deletion yes; required vs optional per type; purposes: App functionality, Account management). play/policy/content-rating.md - the IARC questionnaire answers (decide the category with evidence). play/policy/target-audience.md - the recommendation and the owner decision to make. play/policy/app-access.md - the reviewer access instructions (Play review needs a way in: a test account using the invite code - a placeholder the owner fills, never the real code).

6. Report in openIssues that store/privacy-policy/** is now obsolete (store/** is frozen; the main session handles it when the Store work resumes).

DO NOT: touch store/**, src/offline/**, src/api/**, server/src/sync/**, src-tauri/**, mobile/platform/**, android/**, deploy/**; run fly or deploy; read real data directories; write any real personal data (the owner's name and e-mail stay placeholders).

GATES (quote the numbers): root typecheck, whole root vitest, i18n parity, `npx vite build` (dist/privacy/** and dist/delete-account/** present), `node scripts/check-no-network.mjs`; the whole server vitest if you touched server/**.

AMENDMENT (owner, 2026-10-26 - overrides the lines above where they conflict):
A. ONE privacy policy for BOTH published apps (Android on Google Play AND Windows on the Microsoft Store) and the website - same facts, same URL https://yourpersonaldiary.fly.dev/privacy. Write it so it names both apps explicitly (what is on a Windows PC: the offline copy under the user's profile protected with DPAPI when "Remember me" is on; on Android: app-private storage with the Keystore - per OFFLINE-DESIGN section 10 and the code).
B. DEFAULT LANGUAGE = ENGLISH everywhere: /privacy and /delete-account open in English with links to the 19 other languages (each page links back to English); if you add language auto-detection on the page, English stays the fallback and nothing is chosen automatically without a visible link to switch.
C. store/** is UNFROZEN for privacy only: replace the obsolete store/privacy-policy/** (local-only Windows texts) - keep the old files by moving them to store/privacy-policy/_obsolete-2026-10-03/ (do not delete), and put there a README.md that points to the new policy URL and the legal/ sources. Add store/policy/partner-center-privacy.md: the exact answers for the Microsoft Store Partner Center privacy questions (privacy policy URL; does the app collect/transmit personal information - yes, what and why; the age rating questionnaire answers consistent with play/policy/content-rating.md), with citations of Microsoft's current pages (WebFetch).
D. Item 6 of DELIVER is replaced by C.
