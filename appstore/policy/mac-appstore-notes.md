# The Mac App Store record - what differs from the iPhone record

Package ANSWERS, written 2026-11-08. The Mac app has two routes (ENV-FINAL decision 8): **route 1** = Developer ID + notarization + DMG, downloaded from the owner's own channel - it needs **no** App Store Connect record (FACTS 13.20); **route 2** = the Mac App Store - prepared but **untested** (needs Apple credentials, a provisioning profile and a first real build). Everything below is for route 2. The owner's step-by-step guide for both routes is `docs/MAC-RELEASE.he.md` (section 8 for route 2); this file lists only what the App Store Connect record needs.

## 1. The record

| Item | Mac record | Source |
| --- | --- | --- |
| Platform | macOS | FACTS 2.1 |
| Name | `Your Personal Diary for Mac` (every localization) - the iPhone record already uses `Your Personal Diary` | FACTS 2.3; ANSWERS amendment 3 |
| Bundle ID | `app.yourpersonaldiary.mac` (`src-tauri/tauri.macos.conf.json` `identifier`) | ENV-FINAL decision 1 |
| SKU | `ypd-mac-001` | `app-information.md` |
| Categories | Primary Lifestyle, Secondary Productivity. For macOS the category is also set in the build and must match: the bundle carries `LSApplicationCategoryType = public.app-category.lifestyle` from `"category": "Lifestyle"` in `src-tauri/tauri.macos.conf.json` (verified in the built bundle by WP-M4, `docs/APPLE-PLAN.md` 7.1) | FACTS 2.21 |
| Subtitle, description, keywords, promotional text, URLs | the same files as the iPhone record (`appstore/listing/<locale>/`), optionally the Mac wording of `platform-notes.md` | ENV-FINAL decision 1 |
| Age rating | the same answers and the same override to 16+ (`age-rating.md`) | FACTS 3.7 |
| App Privacy | the same six data types (`app-privacy.md`); the Mac record answers separately | FACTS 4.1 |
| Pricing and Availability | Free, All Countries or Regions | FACTS 2.25 |
| Copyright | `2026 Ouriel Sebag` | FACTS 2.14 |
| App Review Information | the same demo account `stor` and the same notes file (its last paragraph is about the Mac) | FACTS 2.27 |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` in `src-tauri/Info.plist` | `export-compliance.md` |
| Icon | from the build (the "App Store - 2x" image, 1024 px); App Store Connect has no icon upload | FACTS 7.2 |

## 2. Screenshots

Required for Mac apps: one of 1280 x 800, 1440 x 900, 2560 x 1600 or 2880 x 1800 pixels (16:10), up to 10 per size (FACTS 6.1, 6.5). The kit has 8 per language at **2880 x 1800**: `appstore/screenshots/mac/<locale>/01-home.png` ... `08-offline.png` (SHOTS package; `appstore/screenshots/README.he.md` section 3 step 7).

## 3. The build: sandbox, signing, package, upload

- **App Sandbox is required** for the Mac App Store (FACTS 9.6). The entitlements are prepared in `src-tauri/entitlements/mac-appstore.plist`: `com.apple.security.app-sandbox`, `com.apple.security.network.client` (the app is a client of the server; it never listens, so `network.server` is absent) and `com.apple.security.files.user-selected.read-write` (save/open panels for backup, export and restore). `scripts/mac/build-appstore.sh` adds the two team keys (`com.apple.application-identifier`, `com.apple.developer.team-identifier`) at build time from `APPLE_TEAM_ID`.
- **Certificates**: "Apple Distribution" (or "Mac App Distribution") for the app and "Mac Installer Distribution" ("3rd Party Mac Developer Installer: <name> (<TeamID>)") for the package (FACTS 9.1, 9.6); a "Mac App Store" provisioning profile for `app.yourpersonaldiary.mac`, embedded as `Contents/embedded.provisionprofile`.
- **Package**: a signed `.pkg` made with `productbuild --sign <Identity> --component <app> /Applications <pkg>` (FACTS 9.6); the script removes the `com.apple.quarantine` attribute first (`xattr -cr`), which Apple requires for uploads since 18 February 2025 (FACTS 9.6).
- **Upload**: Transporter or `altool` (FACTS 8.4, 8.5, 9.6). `altool` is not in the build Mac's Command Line Tools (checked by WP-M4, `docs/MAC-RELEASE.he.md` section 8); **Transporter** (free, from the Mac App Store) takes the `.pkg` without Xcode.
- **Build number**: `APPSTORE_BUILD_NUMBER` (`app-information.md` section 2).
- **Notarization is not needed** for the Mac App Store (FACTS 9.2: "you aren't required to notarize software that you distribute through the Mac App Store"). It is needed for route 1.

## 4. The Keychain under the sandbox

The offline key of the Mac app is a Keychain item. The ad-hoc and Developer ID builds without a provisioning profile use the login (file-based) keychain; a build signed with a provisioning profile can use the **data-protection keychain**, which Apple recommends as the default (FACTS 9.7). The code already chooses the data-protection keychain when the build has the entitlements for it; on the first online start after the switch the item is replaced, and a first offline start right after the switch shows "no connection" once (`docs/MAC-RELEASE.he.md` section 8, "ה-Keychain"). No Apple rule forces a change for the login keychain under the sandbox (FACTS 9.7 - NOT FOUND). Untested until a sandboxed build runs.

## 5. The SDK / Xcode rule and the build Mac

- Apple's rule "built with Xcode 26 or later" names iOS, iPadOS, tvOS, visionOS and watchOS - **not macOS** (FACTS 8.1); the upload table lists macOS apps as built with "Xcode 6 or later" (FACTS 8.4, a reading of a flattened table). So, as Apple's pages stood on 2026-11-08, the Mac App Store build has no Xcode-26 floor, and the Tauri build itself needs only the Command Line Tools - the owner's MacBook Pro on macOS Sonoma 14.6.1 may suffice for route 2 (not tested).
- The **iPhone** app does need Xcode 26+, which runs on macOS Sequoia 15.6 or later (Xcode 26.0-26.3) or Tahoe 26.2+ (FACTS 8.2, 8.3; ANSWERS amendment 8). Since the owner's Mac must be upgraded for the iPhone app anyway (to Tahoe 26.7.2 per the sprint plan), the same upgraded Mac then serves both records.
- Apple may extend the SDK rule to macOS at any time: check `developer.apple.com/news/upcoming-requirements/` before the first Mac upload (FACTS 8.1 source).

## 6. Open points of route 2 (for whoever builds it first)

1. A privacy manifest with the data types in the Mac bundle is "harmless and recommended" for this route (FACTS 4.8); none exists today (`app-privacy.md` section 5). A copy of the iPhone manifest's `NSPrivacyCollectedDataTypes` part (with Health and Fitness) would serve.
2. Certificate names, the profile embedding, the data-protection keychain under the sandbox and `/usr/bin/open` for the legal pages under the sandbox are untested (`docs/MAC-RELEASE.he.md`, appendix C).
3. The App Review notes describe the Mac app in their last paragraph; if the Mac build behaves differently on review (for example the legal links), update that paragraph.
