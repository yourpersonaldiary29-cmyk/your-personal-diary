write:readme: ARCHITECTURE.md section 12 (line 307) says the NSIS installer contains the WebView2 bootstrapper. tauri.conf.json uses webviewInstallMode 'downloadBootstrapper': the generated installer.nsi packs only the main binary and downloads MicrosoftEdgeWebview2Setup.exe from go.microsoft.com only when WebView2 is missing. The old README had the same wrong claim; it is fixed in README.

write:readme: ARCHITECTURE.md line 63 (folder tree) and line 271 (section 11ב) name server/src/mail/smtp.ts, which no longer exists. The mail code is now node-transport.ts, transport.ts, errors.ts and env-overrides.ts. Section 1 principles 3-4 and the section 4 diagram still describe the local sidecar/LAN design as the product.

write:readme: docs/HOSTED-DEPLOY.he.md line 111 says production registration is invite-only (DIARY_REGISTRATION = "invite" in fly.toml), but fly.toml now has "open" (2026-10-27). Line 160 says the monthly archive 'arrives with WP-H8', but it already exists in the Server card.

write:readme: play/policy/app-access.md lines 13-21 and docs/PLAY-RELEASE.he.md line 53 still describe the server as invite-only and tell the owner to give Google's reviewers an invite code. Registration is open now, so the App access answers need updating before a Play submission.

write:readme: legal/README.md line 9 says publisherName and contactEmail are null until the owner fills them; legal/settings.json already has both filled.

write:readme: UI text bug, hosted mode, 20 locales: DeleteAccountSection.tsx (ownerNote) shows the owner settings.deleteAccount.ownerMail when isMailOwner is true. That text says '...on this computer... the oldest remaining account will become the owner', but on the hosted server deleting the owner deletes the mail settings and promotes nobody (docs/API.md 'בעלות', server/src/hosted/owner.ts).

write:readme: Capacity rule: docs/HOSTED-RUNBOOK.he.md chapter 5 says DIARY_MAX_ACCOUNTS should be the disk size divided by 30 MB, which is about 100 for the 3 GB volume. fly.toml sets 5000 on initial_size 3gb, with a 10 MB default diary quota per account. The disk alarm (/api/health/strict, and the Server card below 15% free) is the only safeguard. The owner may want to extend the volume or revise the rule.

write:readme: The privacy policy promises deletion within 30 days for e-mail requests from people who cannot sign in, but the admin.cjs tool described in docs/HOSTED-RUNBOOK.he.md chapter 9 is not built yet, so there is no documented tool to do it.

write:readme: Stale descriptions in code and metadata: the header comment of capacitor.config.ts (line 5) says the diary core runs in a WebView Web Worker and the app has no server URL. The server/package.json description says 'Local-only Node.js backend... no cloud'. The docs/API.md title is still 'חוזה ה-API של השרת המקומי'.

write:readme: Developer flow gaps (README documents the flows that work): `npx tauri dev` or `npm run tauri:dev` without VITE_API_BASE points the dev window (http://localhost:1420) at production, whose CORS (HOSTED_ORIGINS, dev off) refuses that origin. In the default server build, `npm run mobile:dev` in a plain browser has no API base, and DEV_ORIGINS covers only port 1420, so only MOBILE_LOCAL_CORE=1 works there.

write:readme: docs/HOSTED-DEPLOY.he.md step ב.6 tells the owner to move the device-key copy into a password manager and delete the file. docs/HOSTED-RUNBOOK.he.md 6ב step 2 expects that file's path ($keyCopy) for the restore drill. These two instructions do not agree.

write:readme: h10c-tmp/ in the project root holds leftover agent scratch files (t1-t5.mjs, insert.mjs, logs). The README lists it as not part of the product; the main session could delete it.

write:readme: Not verified (production was not contacted): whether DIARY_OWNER_ID is actually set on Fly and whether the uptime monitor exists. The README describes both without claiming they are configured (the monitor is marked 'recommended').

fix:readme: TEST NOW RED: mobile/test/scaffold.test.ts:86-104 ('README has the Android (in progress) note, with the android:sync caveat and the installed versions') requires the old README section 'Android (בתהליך / in progress)', including 'core not ready' and 'android:sync ... נכשל עד ש-WP-14'. The brief requires removing that text, and putting it back would be false. So `npm run mobile:test` and `npm run check:all` fail until whoever owns that test deletes it or rewrites it to check the current Android build commands in README 5.5. Failure: AssertionError: expected -1 to be greater than -1 (scaffold.test.ts:89).

fix:readme: src-tauri/Cargo.toml:27 says `see README "מצב מקומי למפתחים"`. No heading with that name exists; local mode is now README 5.3 'המצב המקומי - לפיתוח ולבדיקות בלבד, לא מופץ'.

fix:readme: scripts/build-server.mjs:15 points to 'README section 2' for the `--features local-server` build; it is now README 5.3 (section 2 is now privacy and security).

fix:readme: ARCHITECTURE.md:28 says '(README סעיף 2)' for the local-mode switches; it is now README 5.3.

fix:readme: docs/android-tasks/HOSTED-IMPL.md:22 (item 14) says '(README section 4א, ...)'; the offline content is now README 1.4 and 2.2.

fix:readme: play/policy/app-access.md:11-13, and owner step 1, still say the server is invite-only (DIARY_REGISTRATION=invite) and that the app has no field for an invite code. deploy/hosted/fly.toml has DIARY_REGISTRATION = "open" and DIARY_MAX_ACCOUNTS = "5000". The App-access answer must be rewritten before a Play submission.

fix:readme: docs/PLAY-RELEASE.he.md line 53 and part ד item 2 (lines 158-159) tell the owner to write the server's invite code into Play Console's 'Any other instructions'. That is stale now that registration is open, and it contradicts play/policy/app-access.md ('The invite code is never written into Play Console').

fix:readme: docs/HOSTED-DEPLOY.he.md step ז (lines 152-154) calls the button 'שלח מייל בדיקה' and the card 'דואר אלקטרוני'. The UI strings are 'שליחת מייל בדיקה' (settings.mail.test) and 'דואר אלקטרוני לאיפוס סיסמה' (settings.mail.title), and the step never mentions the 'כתובת Gmail' field (settings.mail.address).

fix:readme: The two guides disagree about the server-key copy. docs/HOSTED-DEPLOY.he.md step ב.6 says to copy its last line into the password manager and delete the file. docs/HOSTED-RUNBOOK.he.md chapter 10 says to keep the file offline ('לא בענן'), and the 6ב drill (lines 146-148) needs the file's path, so an owner who followed ב.6 must recreate the file. README 4.1 now names both options.