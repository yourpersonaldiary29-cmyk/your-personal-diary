TASK (Windows app): links to the privacy policy and the delete-account page must open in the system browser in the Windows app. Today src/components/legal/PrivacyPolicyLink.tsx calls `plugin:opener|open_url`, which the shell does not have, so the Windows app shows the address as text instead.

READ FIRST: docs/android-tasks/ENV.md (last update is current), src-tauri/src/lib.rs (commands, both handler lists, the save_file command as a pattern), src-tauri/Cargo.toml (the `windows` crate and its features), src-tauri/capabilities/**, src-tauri/tauri.conf.json (CSP), src/components/legal/PrivacyPolicyLink.tsx (+ test), src/config/server-default.ts (the fixed server origin), scripts/check-no-network.mjs.

DO:
1. A new shell command `open_external_url(url: String)`: accepts ONLY an absolute https URL whose origin is exactly the fixed server origin (https://yourpersonaldiary.fly.dev) and whose path starts with /privacy/ or /delete-account/ - everything else is rejected with an error, never opened. Open it with the Windows shell (ShellExecuteW through the EXISTING `windows` crate - add only a feature flag of that crate if needed; NO new crate, the build must work with `cargo ... --offline`). Rust unit tests for the URL rule (accepted, wrong scheme, wrong host, user-info tricks, encoded tricks, other paths, javascript:, file:).
2. Register it in both handler lists and the capabilities if required; keep CSP unchanged unless needed (say why).
3. PrivacyPolicyLink uses `invoke('open_external_url', { url })` in the Windows app; on failure it falls back to showing the address as text (today's behaviour). Tests (Tauri invoke mocked).
4. Do not build the installer (the main session does).

DO NOT: touch server/**, legal/**, play/**, scripts/play/**, src/offline/**, mobile/**.

GATES (quote numbers): `cargo test --lib --offline` in src-tauri; root `npx tsc --noEmit` + whole root vitest; `npx vite build`; `node scripts/check-no-network.mjs`.
