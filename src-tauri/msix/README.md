# src-tauri/msix - Microsoft Store (MSIX) package sources

| File | Purpose |
| --- | --- |
| `AppxManifest.template.xml` | Package manifest template. `scripts/store/build-msix.mjs` fills in the `{{PLACEHOLDERS}}` (identity from `store/identity.json`, the version, the 20 resource languages) and writes `AppxManifest.xml` into the package. |
| `package-version.json` | **The one place of the Store package version** (`"packageVersion": "1.0.0.0"` for the first submission). Raise it for every new submission (for example `1.0.1.0`, `1.1.0.0`); the fourth part always stays `0`. It is independent of the app version in `tauri.conf.json` (0.1.0), which the Store would reject (first part 0). |
| `assets/` | Optional hand-made logo files that replace generated ones (see `assets/README.md`). Empty by default: all logos are generated from `src-tauri/icons/icon.png` at build time. |

Build, validation, research and decisions: `store/MSIX-BUILD.md`.

Notes

- The Windows app is a SERVER-ONLY thin client: the package holds `your-personal-diary.exe`
  (the UI is embedded in it), the logos, the manifest and `resources.pri` - no sidecar, no
  server files, no Node.js. The build and the check refuse anything else, and refuse a shell
  executable built with the developer-only `local-server` feature.
- Because the UI and `src-tauri/src` are compiled into that executable, a Store package is also
  refused when the executable is not the build of the current tree (its embedded UI is not
  `dist/`, or a UI / shell source is newer than it): run `npm run tauri:build` right before
  `build-msix.mjs` (`store/MSIX-BUILD.md`, section 1.3).
- The package is a full-trust desktop package (`EntryPoint="Windows.FullTrustApplication"`,
  capability `runFullTrust` only). Do not add network capabilities: they apply to AppContainer
  apps only.
- `Application Id` (`YourPersonalDiary`) is part of the app user model id
  (`<PackageFamilyName>!YourPersonalDiary`, also used by the Store toasts in `src-tauri/src/lib.rs`,
  `MSIX_APPLICATION_ID`). Do not change it after the first Store release.
- `MinVersion` 10.0.19041.0 = Windows 10 version 2004. `MaxVersionTested` is the Windows SDK /
  OS build the package was built and tried with (10.0.26100.0).
- The package is never signed here. The Microsoft Store signs it after certification.
- Per-user data of a Store install (src-tauri/src/lib.rs `packaged_webview_data_dir`,
  src-tauri/src/offline.rs `mirror_root`):
  `%LOCALAPPDATA%\Packages\<PackageFamilyName>\LocalCache\Local\com.mydiary.app\` with
  `EBWebView\` (the WebView2 profile: session, IndexedDB of the offline engine) and
  `offline\<userId>\` (the offline mirror). Windows removes it when the app is uninstalled.
