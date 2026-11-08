# MSIX package for the Microsoft Store - build notes

Technical notes for the main session / a developer (the owner's Hebrew step-by-step guide is
`docs/STORE-RELEASE.he.md`). This file explains how `scripts/store/build-msix.mjs` builds the
Store package of the Windows app, what is checked, what was researched (quoted sources), and
what could not be verified on the build machine.

Second round, 2026-10-27. The Windows app is now a SERVER-ONLY thin client of
https://yourpersonaldiary.fly.dev with the automatic offline mode
(docs/android-tasks/HOSTED-IMPL.md items 8-13, OFFLINE-DESIGN.md). The package therefore holds
the shell executable only - no `diary-server.exe` sidecar, no `server/` resources, no Node.js.
The first round (2026-10-03, local app with a sidecar and diaries on the PC) is superseded; its
data-folder research (diaries forking between the downloaded and the Store version) no longer
applies because no diary is stored on the PC any more - see 4a.

Contents: 1. Commands - 2. What the package contains and what is checked - 3. Validation done
here, local install test - 4. Research with sources - 5. Not verified / open questions.

## 1. Commands

Prerequisites: Node (the project's own), the Windows SDK tools `makeappx.exe` and `makepri.exe`
(found automatically under `C:\Program Files (x86)\Windows Kits\10\bin\<version>\x64`; override
with `--sdk-bin <dir>` or the environment variable `WINDOWS_SDK_BIN`). No npm dependencies.

### 1.1 The identity - one place: `store/identity.json`

After the owner reserves the name "Your Personal Diary" in Partner Center, he opens
Product management -> Product identity and copies three values into `store/identity.json`
(copy `store/identity.example.json`, replace the three values; the `_readme` line may stay):

| Field | Partner Center value (Product identity) | Format |
| --- | --- | --- |
| `identityName` | Package/Identity/Name | e.g. `12345OurielSebag.YourPersonalDiary` (the digits come from Partner Center) |
| `publisher` | Package/Identity/Publisher | `CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX` - copy exactly, with `CN=` |
| `publisherDisplayName` | Package/Properties/PublisherDisplayName | the publisher name of the developer account (owner decision: "Ouriel Sebag") |
| `displayName` (optional) | only if the reserved product name is not `Your Personal Diary` | |

"Values in the manifest are case-sensitive. Spaces and other punctuation must also match.
Enter the values carefully and review them to ensure that they are correct." [S1]

Never invent these values. The build refuses a Store package when `store/identity.json` is
missing, when any value is still an example / placeholder value (`12345PublisherName.`,
`CN=00000000-...`, `Publisher Name`, anything containing "placeholder"), when a value is
malformed, and when the file contains a `version` field (the version has its own place) or
an unknown field.

### 1.2 The version - one place: `src-tauri/msix/package-version.json`

`{ "packageVersion": "1.0.0.0" }` for the first submission. Every later submission that should
update existing users needs a higher number (`1.0.1.0`, `1.1.0.0`, ...); the fourth part always
stays 0. It is deliberately independent of the app version in `tauri.conf.json` (0.1.0), whose
`0.1.0.0` the Store would reject [S1]: "the last (fourth) section of the version number is
reserved for Store use and must be left as 0 when you build your package (although the Store may
change the value in this section). The other sections must be set to an integer between 0 and
65535 (except for the first section, which cannot be 0)." `--version` exists for test packages
only; a Store package always takes this file.

### 1.3 The exact commands (main session, after the final release build)

    npm run tauri:build
    node scripts/store/build-msix.mjs
    node scripts/store/check-msix.mjs --release

- `npm run tauri:build` builds the thin client (default Cargo features, `tauri.conf.json`
  without the `tauri.local.conf.json` overlay). Run it right before `build-msix.mjs` and change
  nothing in between: the UI (`dist/`, `build.frontendDist`) and `src-tauri/src` are compiled
  INTO `your-personal-diary.exe`, the only application file, so the build script checks that
  this executable is the build of the current tree and refuses a Store package otherwise
  (`msix-lib.mjs releaseBuildProblems`):
  - Embedded UI = `dist/`: every file of `dist/` must be embedded in the executable
    (tauri-codegen stores each one under its path, e.g. `/assets/index-<hash>.js`), and the
    executable must not embed an `/assets/*.js|css` bundle that `dist/` no longer has. Vite
    names the bundles after a hash of their content, so a rebuilt UI has names the old
    executable does not contain.
  - No newer source: no UI or shell build input may be newer than the executable (2 s
    tolerance): `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`,
    `package-lock.json`, `src/`, `shared/`, `public/`, `src-tauri/src/`, `src-tauri/build.rs`,
    `Cargo.toml`, `Cargo.lock`, `tauri.conf.json`, `src-tauri/capabilities/`,
    `src-tauri/icons/` (test files and `test`/`tests`/`__tests__`/`test-utils` folders left out).
  - Same file list as the generated `installer.nsi` (the executable only).
  - Not a local-server developer build (marker strings, see 2).

  Limits: the time check also fires for a file that was only touched (a new `npm run
  tauri:build` clears it); it cannot see a change outside these inputs (a `VITE_*` variable set
  only for one build, a package changed inside `node_modules` without `package-lock.json`), and
  the content of `index.html` and the `public/` files is covered by the time check only (their
  names carry no hash).
- Output: `src-tauri/target/release/bundle/msix/YourPersonalDiary_1.0.0.0_x64.msix` plus
  `YourPersonalDiary_1.0.0.0_x64.files.json` (staged file list with sizes and SHA-256).
  Upload the `.msix` in Partner Center -> the submission -> Packages. It is not signed - "The
  Microsoft Store will automatically re-sign your MSIX/AppX packages with a Microsoft certificate
  during the publishing process after your app passes certification." [S1]
- `check-msix.mjs --release` must end with `PASSED` (warnings allowed only for listing folders
  that package S1 has not created yet). It compares the package with `store/identity.json`,
  `package-version.json`, the current release build and the NSIS file list.

### 1.4 Local TEST package (never uploaded)

    node scripts/store/build-msix.mjs --test [--layout <empty folder>] [--allow-stale-build]
    node scripts/store/check-msix.mjs

`--allow-stale-build` (test packages only) packages an executable that is not the build of the
current tree (1.3) and lists why as a warning; `check-msix.mjs` then warns as well, and
`--release` fails. `--test` (old name `--placeholder`) uses the clearly marked test identity: Name
`Placeholder.YourPersonalDiary`, Publisher `CN=PLACEHOLDER`, publisher display name
`PLACEHOLDER - local test package`, display name `Your Personal Diary (TEST)` (so it can never be
mistaken for the real app in the Start menu), file name `..._x64_TEST.msix`. Partner Center
rejects it, and `check-msix.mjs --release` fails on it. `--layout <dir>` additionally keeps the
unpacked package folder (what a Developer Mode registration needs, section 3.2).

Unit tests of the helpers and of the refusals (Node's own runner, no makeappx needed):

    node --test scripts/store/msix-lib.test.mjs

All options: the header comment of each script, or `--help`.

## 2. What the package contains and what is checked

Package content (69 files, about 3.1 MB):

| Path | What |
| --- | --- |
| `your-personal-diary.exe` | the Tauri shell with the React UI embedded (the only application file - exactly what the NSIS installer installs: `File "${MAINBINARYSRCPATH}"`, nothing else) |
| `Assets\*.png` | 66 logos generated from `src-tauri/icons/icon.png` by `msix-assets.mjs` (StoreLogo, Square44x44Logo incl. targetsize-16..256 plain / unplated / light-unplated, Square150x150Logo, Wide310x150Logo, Square310x310Logo in scale-100..400) |
| `AppxManifest.xml` | from `src-tauri/msix/AppxManifest.template.xml` |
| `resources.pri` | `makepri` index: 5 named resources, 66 candidates |
| `AppxBlockMap.xml`, `[Content_Types].xml` | written by `makeappx pack` |

Manifest: Identity (Name, Publisher, Version, `ProcessorArchitecture="x64"`); DisplayName
"Your Personal Diary" (English in every language - the brand is never translated, and
"that name comes from the manifest of the package that gets installed" [S2]); 20
`<Resource Language>` entries in the app's own order, en-US first (default): en-US he-IL ar-SA
zh-CN ja-JP hi-IN th-TH es-ES pt-PT fr-FR it-IT de-DE ro-RO el-GR pl-PL cs-CZ hu-HU ru-RU bg-BG
tr-TR (mapped from `shared/i18n/locales.ts`; a new UI language without a mapping stops the
build); `TargetDeviceFamily Windows.Desktop` 10.0.19041.0 .. 10.0.26100.0; one Application
(`Id="YourPersonalDiary"`, `Executable="your-personal-diary.exe"`,
`EntryPoint="Windows.FullTrustApplication"`); `uap:VisualElements` + `uap:DefaultTile`;
capability `rescap:runFullTrust` only (4c).

`build-msix.mjs` refuses (exit 1, clear message) - each refusal is covered by
`msix-lib.test.mjs` or was run in section 3:

- Store package: no `store/identity.json`; placeholder / example / malformed identity values;
  `version` in the identity file; `--version` (one place only); a version the Store rejects in
  `package-version.json`; `--allow-stale-build`; an output named `*_TEST.msix`.
- Not the thin client: `tauri.conf.json` with `bundle.externalBin` (sidecar) or
  `bundle.resources`; more than one application file; any file matching the forbidden list
  (`diary-server*.exe`, `node.exe`, `server/` or `resources/server/`, `*.cjs *.mjs *.js *.node
  *.wasm`, loose `*.html *.css` / fonts, uninstaller, `install-locale.txt`, NSIS / MSI files,
  `.pdb`, certificates / keys, a signature, diary data / logs).
- Shell executable checks (byte strings inside `your-personal-diary.exe`):
  - must contain `WEBVIEW2_USER_DATA_FOLDER` (package-private WebView2 profile,
    `lib.rs redirect_webview_profile_when_packaged`), `offline mirror: no local data folder`
    (offline mirror commands of `offline.rs`, whose packaged root is that profile folder) and
    `msix-store-toast` (reminder toasts of the package, `lib.rs show_store_notification`) -
    otherwise it was built before the current release (error for a Store package, warning for
    `--test`);
  - must NOT contain `get_server_info`, `diary-server` or the local-mode CSP
    `connect-src 'self' http://127.0.0.1:* http://localhost:* ipc:` - those exist only in a
    `--features local-server` build with `tauri.local.conf.json` (always an error).
  - x64 PE file.
- Stale release build (1.3): the UI embedded in the executable is not the one in `dist/`, a UI
  or shell build input is newer than the executable, or the file list differs from the
  generated `installer.nsi` (test packages: `--allow-stale-build` turns it into a warning).

`check-msix.mjs` re-validates a built package WITHOUT installing it: `makeappx unpack` into a
temp folder, then container (manifest, block map, content types, `resources.pri`, unsigned, no
duplicates), every manifest field above, exactly 20 resource languages equal to the app's list
and en-US first, version against `package-version.json`, identity against
`store/identity.json`, test marker in the display name only for the test identity, the
application files (only the executable; "no server files"; byte-identical to the current
release build; the UI embedded in the packaged executable equals `dist/`; no UI / shell build
input newer than the release executable (1.3); same list as `installer.nsi` and as the
`.files.json` staged at build time, with sizes and SHA-256), forbidden files, ASCII names, the
executable markers, the asset sizes and a
`makepri dump` proving every logo resolves to existing files. It also compares the declared
languages with the `store/listing/<tag>/` folders of package S1 (warning only). `--release`
turns the test-build items into errors.

## 3. Validation done here (2026-10-27), local install test

### 3.1 Results

Release build used: `src-tauri/target/release/your-personal-diary.exe` 2026-10-27 02:42:10,
5,678,080 bytes, with `nsis/x64/installer.nsi` 02:42 (main session build).

| Step | Result |
| --- | --- |
| `node scripts/store/build-msix.mjs` (no `store/identity.json`) | REFUSED, exit 1: "no package identity: store\identity.json does not exist." with the two ways out |
| `node scripts/store/build-msix.mjs --test --layout src-tauri/target/release/bundle/msix/layout-TEST` | exit 0; 1 application file (`your-personal-diary.exe`, 5,678,080 bytes) + 66 assets + manifest + `resources.pri`; makepri "Named Resources: 5, Resource Candidates: 66"; makeappx "Package creation succeeded." (schema validation of the manifest); `YourPersonalDiary_1.0.0.0_x64_TEST.msix`, 3,211,912 bytes (3.1 MB; final rebuild after the last template edit), family `Placeholder.YourPersonalDiary_e9xxthmdhp5wa`; the layout folder holds `AppxManifest.xml`, `Assets\` (66 PNG), `resources.pri`, `your-personal-diary.exe` |
| `node scripts/store/check-msix.mjs <TEST package>` | PASSED WITH WARNINGS: 72 passed, 0 errors, 2 warnings (test identity; 18 languages without a `store/listing` folder yet - package S1 is creating them). Includes "exactly 20 Resource languages", "the only application file is your-personal-diary.exe", "no server files", "exactly one executable", "contains no local-server (developer) code", "the unpacked file list equals the staged file list (69 files)" |
| `check-msix.mjs <TEST package> --release` | FAILED as intended: 2 errors (test identity; no `store/identity.json`) |
| Store path with a fictional identity file in a scratch folder (`--identity`, publisher display name with `&`, quotes and `<>`; deleted afterwards) | build exit 0, version 1.0.0.0 from `package-version.json`, 3,211,925 bytes; `check-msix.mjs --release --identity <that file>`: 75 passed, 0 errors, 1 warning (listing folders) |
| `node --test scripts/store/msix-lib.test.mjs` | 16 tests, 16 passed (incl. publisher id `8wekyb3d8bbwe` for Microsoft's publisher, the refusals of the build script, the real release shell carrying the required markers and none of the forbidden ones) |

The fictional-identity row above passed although the UI had already changed after that build:
the old stale check compared payload files only, and the thin client's only payload file is
the executable itself. Fixed the same day (1.3); re-run 2026-10-27 afternoon with the
02:42:10 executable, `dist/index.html` 13:31:22 (it loads `assets/index-CV-6e_DI.js`, the
executable embeds `assets/index-D01ez34v.js`) and `src/pages/CalendarPage.tsx` 13:21:39:

| Step | Result |
| --- | --- |
| Store path, fictional identity (`--identity`, scratch folder) | REFUSED, exit 1: "the release build is out of date" - `assets/index-CV-6e_DI.js` not embedded, the executable embeds `/assets/index-D01ez34v.js` which `dist` no longer has, 2 sources changed after the build (`CalendarPage.tsx`, `calendar-years.ts`) |
| `--test` without `--allow-stale-build` | REFUSED, exit 1, same three reasons |
| Store path with `--allow-stale-build` | REFUSED: "--allow-stale-build is for --test packages only" |
| `--test --allow-stale-build` (scratch folder) | exit 0, 3,211,913 bytes, the three reasons listed as warnings ("Do not upload this package") |
| `check-msix.mjs <that TEST package>` | PASSED WITH WARNINGS: 72 passed, 3 warnings (test identity; embedded UI is not `dist/`; sources newer than the release build), 0 errors - incl. "exactly 20 Resource languages", "no server files" |
| `check-msix.mjs <that TEST package> --release --identity <fictional>` | FAILED as intended: 4 errors (test identity, identity differs, embedded UI, newer sources) |
| `node --test scripts/store/msix-lib.test.mjs` | 20 tests, 20 passed (new: embedded UI vs. `dist/`, newer sources incl. test-file exclusion and tolerance, `frontendDist` from `tauri.conf.json`, both combined on a fixture tree) |

So the 02:42 executable is no longer the current Windows app: run `npm run tauri:build`
before building the Store package (1.3).
| `node scripts/check-no-network.mjs` | "Network audit passed: no outbound network code or external URLs found", exit 0 |

### 3.2 Local install test - not possible here; steps for the owner

Checked on this PC (read-only): `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock`
has no `AllowDevelopmentWithoutDevLicense` value (Developer Mode is OFF) and the session is not
elevated. Every documented way to install a package needs a setting the owner must change:

- Loose registration (`Add-AppxPackage -Register <layout>\AppxManifest.xml`): "registers an
  application in development mode. You can use development mode to install applications from a
  folder of unpackaged files." [S5] - needs Developer Mode, and "Enabling Developer mode requires
  administrator access." [S6]
- Signed `.msix` with a self-signed test certificate: "In order to install an app signed with
  this certificate, the certificate must be imported into the Local Machine Trusted People
  certificate store." ... "from an admin PowerShell session" [S7] - a machine-wide trust change
  (a CurrentUser store is not enough), and it would also mean creating a certificate.
- Unsigned package (`-AllowUnsigned`, Windows 11): "an unsigned package containing executable
  content must be installed for all users. Since that can affect more than just the current
  user, it requires administrator privilege." [S8] - machine-wide.
- [S1]: "until we certify your app and make it available from the Microsoft Store, it can only
  be installed and run on computers that have developer licenses."

So nothing was installed. Steps for the owner (optional; the first real test can also be a
Partner Center package flight once the identity exists):

1. Windows Settings -> System -> Advanced (Windows 11 25H2; older: System -> For developers) ->
   "Developer Mode" -> On -> Yes [S6].
2. In the project folder: `npm run tauri:build`, then
   `node scripts/store/build-msix.mjs --test --layout C:\Users\<you>\Desktop\ypd-msix-test`
   (any new empty folder outside `WindowsApps`).
3. PowerShell (normal, not admin):
   `Add-AppxPackage -Register "C:\Users\<you>\Desktop\ypd-msix-test\AppxManifest.xml"`
4. Start menu -> "Your Personal Diary (TEST)" -> it opens in English, sign in with a test
   account, then run the checklist in section 5 (data folder, offline mode, legal links,
   toasts).
5. Remove it: `Get-AppxPackage Placeholder.YourPersonalDiary | Remove-AppxPackage`, then turn
   Developer Mode off again (step 1). Windows deletes the package's `LocalCache` with it.

The Windows App Certification Kit was not run: in round one `appcert.exe test` failed with "The
requested operation requires elevation" (Win32 error 740), and the kit installs the package for
its tests. Partner Center runs the same kit during certification.

## 4. Research with sources

Fetched 2026-10-27 (page update dates in brackets):

- [S1] https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements (2026-08-24)
- [S2] https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/add-and-edit-store-listing-info (2026-08-24)
- [S3] https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-behind-the-scenes (2026-10-12)
- [S4] https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/app-capability-declarations (2026-10-02)
- [S5] https://learn.microsoft.com/en-us/powershell/module/appx/add-appxpackage (2025-05-14)
- [S6] https://learn.microsoft.com/en-us/windows/advanced-settings/developer-mode (2026-03-06)
- [S7] https://learn.microsoft.com/en-us/windows/msix/package/create-certificate-package-signing (2025-06-10)
- [S8] https://learn.microsoft.com/en-us/windows/msix/package/unsigned-package (2026-04-15)

Fetched 2026-10-03 (round one, still cited for unchanged points):

- [S9] https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution
- [S10] https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/webview2-idl
- [S11] https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/user-data-folder
- [S12] https://learn.microsoft.com/en-us/windows/apps/publish/store-policies (version 7.20)

Re-checked 2026-10-27: [S10] (the `CreateCoreWebView2EnvironmentWithOptions` text used in 4a)
and, for 4b and section 5 item 5:

- [S13] https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-prepare (2025-06-10)

### a. Per-user data of the packaged thin client

What the shipped shell keeps on the PC (src-tauri/src, read-only for this package):

| Data | Unpackaged (NSIS) | Store package |
| --- | --- | --- |
| WebView2 profile (session, settings, IndexedDB of the offline engine incl. the DPAPI-wrapped offline key blob) | `%LOCALAPPDATA%\com.mydiary.app\EBWebView` | `%LOCALAPPDATA%\Packages\<family>\LocalCache\Local\com.mydiary.app\EBWebView` (`lib.rs packaged_webview_data_dir`, set through `WEBVIEW2_USER_DATA_FOLDER` before the window exists) |
| Offline mirror of the outbox / notes (ciphertext only) | `%LOCALAPPDATA%\com.mydiary.app\offline\<userId>\` | `...\LocalCache\Local\com.mydiary.app\offline\<userId>\` (`offline.rs mirror_root`: same rule, next to the IndexedDB it backs) |
| Diaries | on the server | on the server |

Documentation: "All newly created files and folders in the user's `AppData` folder ... are
written to a private per-user, per-app location; but merged at runtime to appear in the real
`AppData` location." ... "In response to a file open command, the OS will open the file from
the per-user, per-package location first. If that location doesn't exist, then the OS will
attempt to open the file from the real `AppData` location." [S3] With the explicit
package-private paths the Store version never opens the downloaded version's profile or mirror
through that merged view, and for a new user the folder is the one the redirection would have
given anyway.

Why an environment variable: Tauri creates the configured window before `setup` runs and
always passes `%LOCALAPPDATA%\<identifier>` as the WebView2 user data folder. The
`CreateCoreWebView2EnvironmentWithOptions` documentation says the folder (with the other
environment options) "may be overridden by values either specified in environment variables
or in the registry" [S10]; `WEBVIEW2_USER_DATA_FOLDER` is in its list of variables checked when
the environment is created, and the registry is consulted only when none of them is set. So
`lib.rs redirect_webview_profile_when_packaged` sets that variable for its own process before
the window exists (a value already present in the environment is left alone).

Consequences:

1. A user of the downloaded version who installs the Store version signs in once more (the
   profile is new); the diary itself comes from the server - nothing is forked. The downloaded
   version keeps its own profile and offline queue untouched; the user should let it sync
   (open it once online) before uninstalling it.
2. Uninstall: "When a package is uninstalled by the user, all files and folders located under
   `C:\Program Files\WindowsApps\<package_full_name>` are removed, as well as any redirected
   writes to `AppData`" [S3]; WebView2: "If you want to uninstall a packaged Windows Store app.
   In this case, Windows deletes UDFs automatically." [S11] - so entries written offline and not
   yet synced are lost when the Store app is uninstalled while offline. Texts for the user
   (certification notes / listing / guide - package S1): "connect to the internet so that your
   changes are synced before you uninstall the app."
3. DPAPI (current-user scope) and Windows Hello (`UserConsentVerifier`) work the same in a
   full-trust package; nothing is declared for them in the manifest.

### b. Writes next to the executable / into the package

"Writes to files/folders in the app package aren't allowed." and "Write inside the package -
Not allowed. The package is read-only." [S3]

| Code (shipped build) | Writes to | Packaged |
| --- | --- | --- |
| WebView2 | its profile folder (4a) | OK, package-private |
| `offline.rs` `mirror_put` / `mirror_delete` / `mirror_clear` | `<profile folder>\offline\<userId>\` | OK, package-private |
| `lib.rs` `write_chosen_file` | the path the user picked in the save dialog | OK, outside the package |
| `lib.rs` `push_log` | memory only (no data directory in the shipped build) | OK |
| `lib.rs` `get_install_locale` | reads `<exe dir>\install-locale.txt` | read only; absent in the package -> `None` -> the app opens in English (HOSTED-IMPL item 12, `src/i18n/runtime.ts`) |

Nothing writes into the install directory.

Other processes (shipped build): the package bundles no helper executable (the sidecar code is
compiled only with `--features local-server`, which the build refuses). Two kinds of process
still start because of the app:

- the WebView2 runtime's own browser processes (as for every WebView2 app);
- the user's default web browser: `opener.rs open_external_url` (registered in the shipped
  build, `lib.rs` `#[cfg(not(feature = "local-server"))]` handler list) hands an address to
  `ShellExecuteW(None, "open", url, ...)`, which makes Windows open it in the default browser.
  It accepts only the privacy policy and delete-account pages of the diary server
  (`https://yourpersonaldiary.fly.dev/privacy/...`, `/delete-account/...`; anything else is
  refused before Windows sees it); the UI calls it from the privacy policy links (Settings ->
  Privacy, the registration page - `src/components/legal/PrivacyPolicyLink.tsx`).

The app never starts a command utility such as PowerShell or cmd.exe, which [S13] tells
packaged apps to avoid (they cannot start at all on Windows 10 S).

### c. Capabilities, network, WebView2

- "Medium IL apps-which are also known as *full trust apps*-don't run in an AppContainer."
  "The **internetClient** and **enterpriseAuthentication** capabilities ... apply only to
  AppContainer apps. Conversely, a Medium IL app is already running as the user; so an app like
  that can already perform those operations without requiring those capabilities." "In fact, a
  Medium IL app *needs* to declare the **runFullTrust** restricted capability." [S4]
  So the manifest declares `rescap:runFullTrust` only; the HTTPS connection to the server needs
  no capability. The app opens no listening port any more (no local server).
- [S4] recommends declaring privacy-sensitive device capabilities even for Medium IL apps; the
  app uses none (no camera, microphone, location; Windows Hello consent and toasts need none).
- WebView2: "The Evergreen WebView2 Runtime will be included as part of the Windows 11 operating
  system." / "A small number of Windows 10 devices don't have the WebView2 Runtime installed."
  [S9] The package cannot run the NSIS installer's WebView2 bootstrapper; on such a Windows 10
  PC the window cannot open. Disclose in the listing's system requirements (S1).

### d. Store points that matter for certification

- Restricted capability: "If your app declares any restricted capabilities, then you must
  provide info ... on the Submission options page of your submission, explaining how your app
  uses each restricted capability that it declares." ... "Be sure to provide as much detail as
  possible" [S4]. Technical justification for the thin client (the round-one text named the
  local server and must not be used any more). The text the owner pastes into Partner Center
  (Submission options -> Restricted capabilities) is block B of `store/certification-notes.md`
  (package S1); it must agree with this one:

  > Your Personal Diary is a classic Win32 desktop application (Tauri: a Rust executable that
  > hosts the Microsoft Edge WebView2 control) packaged as MSIX. runFullTrust is required because
  > the application's only executable, your-personal-diary.exe, is a full-trust (medium
  > integrity) Win32 process. It connects over HTTPS to the app's own service
  > (yourpersonaldiary.fly.dev), where each user's diary is stored encrypted per account, keeps
  > an encrypted offline copy of unsent changes in its package data folder, protects the offline
  > key with Windows DPAPI, can confirm offline unlock with Windows Hello, and shows reminder
  > notifications. The package contains no other executable. Besides the WebView2 runtime's own
  > browser processes, the only program the app causes to start is the user's default web
  > browser: when the user clicks a privacy policy link, the app asks Windows to open that page
  > of yourpersonaldiary.fly.dev in the default browser (only the privacy policy and
  > account-deletion pages of that site can be opened this way). It does not
  > require elevation, installs no drivers or services, and does not modify system settings.

- Version: rule of [S1] (section 1.2); first submission `1.0.0.0`.
- Signing: never signed here; the Store re-signs [S1].
- File names: "Be sure that all your filenames use ANSI." [S1] - checked (ASCII).
- Size: "msix or .appx packages targeting Windows 10 or Windows 11: 25 GB maximum per package" [S1] - 3.1 MB.
- Languages: [S1] "Language codes that are not included here are not supported by the Store."
  All 20 manifest tags are in that list (Arabic ar-sa, Bulgarian bg-bg, Chinese (Simplified)
  zh-cn, Czech cs-cz, English en-us, French fr-fr, German de-de, Greek el-gr, Hebrew he-il,
  Hindi hi-in, Hungarian hu-hu, Italian it-it, Japanese ja-jp, Polish pl-pl, Portuguese
  (Portugal) pt-pt, Romanian ro-ro, Russian ru-ru, Spanish es-es, Thai th-th, Turkish tr-tr).
- Listing languages follow the package: "If you've already uploaded packages, you'll see their
  languages listed in the **Languages supported by your packages** section." and "We recommend
  providing a Store listing in each language that your packages support" [S2] - so the 20
  `store/listing/<tag>` folders of package S1 must use exactly these tags (check-msix warns
  otherwise). Product name: the listing's name "does not impact the name displayed when a
  customer installs the app; that name comes from the manifest of the package that gets
  installed. To avoid confusion, we recommend that each language's package(s) and Store listing
  use the same name." [S2] - the manifest has one English DisplayName for all languages, as the
  owner decided for the brand.
- Privacy policy: [S12] 10.5 "Product types that inherently have access to Personal Information
  must always have privacy policies. These include, but are not limited to, Desktop Bridge and
  Win32 products." - URL https://yourpersonaldiary.fly.dev/privacy/ (`store/config.example.json`
  carries it with the other public values of `legal/settings.json`).
- Test account: [S12] 10.3 "If your product requires login credentials, provide us with a
  working demo account using the **Notes for certification** field." - registration is open, so
  the notes tell testers to create their own account (internet needed for the first sign-in) -
  package S1.

## 5. Not verified here / open questions

Nothing could be installed (3.2). Checklist for the first install (Developer Mode test of 3.2
or a Partner Center package flight), app opened and signed in:

1. The app opens in English (no installer language), the window and the UI work from
   `C:\Program Files\WindowsApps\...` (or the layout folder).
2. `%LOCALAPPDATA%\Packages\<family>\LocalCache\Local\com.mydiary.app\EBWebView` exists, and NO
   nested `...\LocalCache\Local\Packages\...` folder appeared (that would mean the explicit path
   was redirected a second time). The downloaded version's `%LOCALAPPDATA%\com.mydiary.app` is
   unchanged (file times before / after).
3. Offline: disconnect the network, write an entry, check that
   `...\LocalCache\Local\com.mydiary.app\offline\<userId>\` gets `.op` files; reconnect, the
   entry syncs and the files go away.
4. Settings -> Privacy -> the privacy policy link opens
   https://yourpersonaldiary.fly.dev/privacy/... in the default browser (4b), and the app window
   stays as it was.
5. Reminder toasts. Why this needs its own test: tauri-plugin-notification sends every toast
   with the AppUserModelID (AUMID) `com.mydiary.app`, the bundle identifier. A packaged process
   may only use the AUMID Windows generated for its package and cannot define its own [S13], so
   inside the package such a toast belongs to an app that does not exist and is never shown -
   while the plugin still reports success, which also skipped the in-app fallback: the reminder
   was lost. The shell therefore sends the Store version's toasts itself, as the packaged app
   (`lib.rs show_store_notification`, AUMID `<PackageFamilyName>!YourPersonalDiary`, printed by
   `build-msix.mjs` as "App user model id"; marker `msix-store-toast`, section 2), and answers
   `not-packaged` outside the package so that the downloaded version keeps using the plugin.
   Test: a habit reminder shows a Windows toast named "Your Personal Diary (TEST)" / the Store
   name; with notifications turned off for the app in Windows Settings the reminder appears
   inside the app instead. For that reason the `Application Id` and the identity must never
   change after the first release (open question 3).
6. After `Remove-AppxPackage` / uninstall the whole `Packages\<family>` folder is gone.

Open questions / items for other packages:

1. Certification notes block B (runFullTrust) and the listing / guide texts must use the thin
   client facts above (4a consequence 2, 4d) - files of package S1.
2. Windows 10 PCs without the WebView2 runtime (4c): disclose in the system requirements, or
   raise `MinVersion` to Windows 11 (10.0.22000.0) later.
3. Update rule: each new submission raises `src-tauri/msix/package-version.json`; the
   `Application Id` `YourPersonalDiary` and the identity must never change after the first
   release (the AUMID of the toasts and pinned tiles depend on them).
