# Entitlements of the Mac app (package MAC-M4, 2026-11-08)

Three files, two distribution routes. The owner's guide is `docs/MAC-RELEASE.he.md`; the scripts that
use these files are in `scripts/mac/`. Lint any change with `plutil -lint <file>` on a Mac.

| File | Route | Used by | Content |
|---|---|---|---|
| `developer-id.plist` | 1 - Developer ID + notarization + DMG | `scripts/mac/release.sh` (`bundle.macOS.entitlements`, hardened runtime on) | empty dictionary: the app needs no hardened-runtime exception (the comment inside says why) |
| `mac-appstore.plist` | 2 - Mac App Store (App Sandbox), **untested** | `scripts/mac/build-appstore.sh` | `com.apple.security.app-sandbox`, `com.apple.security.network.client`, `com.apple.security.files.user-selected.read-write`; no application group |
| `mac-appstore.team.example.plist` | 2, documentation only | nobody (never signed with) | the two team keys the script adds at build time, with the placeholder `TEAMID` |

The Windows build and the Android app never read this folder. Tauri reads an entitlements file only
when `bundle.macOS.entitlements` names it: `src-tauri/tauri.macos.conf.json` does not, so a plain
`npx tauri build --bundles app` (the ad-hoc test build) signs without entitlements, exactly as before.
