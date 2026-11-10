# App Store Connect - the fixed values of the two app records

Package ANSWERS of the final sprint, written 2026-11-08. Apple facts come from `docs/apple-tasks/APPSTORE-FACTS.md` (cited as "FACTS <claim>"); app facts from the files named. The owner's Hebrew walk-through is `appstore/ANSWERS.he.md`.

## 1. The two records

| Field (Apple's label) | iPhone record | Mac record | Source |
| --- | --- | --- | --- |
| Platforms (New App dialog) | iOS | macOS | FACTS 2.1 |
| Name | `Your Personal Diary` (19 characters) | `Your Personal Diary for Mac` (27 characters) | FACTS 2.3, 2.4 (one app name per localization in one account); ANSWERS amendment 3 |
| Primary Language | English (U.S.) | English (U.S.) | FACTS 2.17, 2.19 |
| Bundle ID | `app.yourpersonaldiary` | `app.yourpersonaldiary.mac` | ENV-FINAL decision 1; `capacitor.config.ts` `appId` / `src-tauri/tauri.macos.conf.json` `identifier` |
| SKU (cannot be changed later) | `ypd-ios-001` | `ypd-mac-001` | FACTS 2.15 (letters, digits, hyphens, periods, underscores; not starting with a hyphen, period or underscore) |
| User Access | Full Access | Full Access | FACTS 2.1 (a one-person team) |
| Apple ID of the record | blank until App Store Connect creates it (generated, not editable) | blank until created | FACTS 2.15 |
| Subtitle | `appstore/listing/<locale>/subtitle.txt` | same files | FACTS 2.5 (30 characters) |
| Primary Category | Lifestyle | Lifestyle (must equal the bundle's `LSApplicationCategoryType`, which `src-tauri/tauri.macos.conf.json` `"category": "Lifestyle"` sets to `public.app-category.lifestyle`) | FACTS 2.21; ENV-FINAL decision 6 |
| Secondary Category | Productivity | Productivity | FACTS 2.21 |
| Content Rights | does not contain, show or access third-party content | same | FACTS 2.22 |
| License Agreement | Apple's standard EULA (nothing to upload) | same | FACTS 2.23 |
| Age Rating | questionnaire per `age-rating.md`, then Override to Higher Age Rating = 16+ | same | FACTS 3.2-3.7 |
| Privacy Policy URL | `https://yourpersonaldiary.fly.dev/privacy/`; per localization `https://yourpersonaldiary.fly.dev/privacy/<app-locale>/` (`appstore/listing/<locale>/privacy-url.txt`) | same | FACTS 2.12; ENV-FINAL decision 12 |
| User Privacy Choices URL | blank (optional) | blank | FACTS 2.13 (optional) - see note 3 |
| Support URL | `https://yourpersonaldiary.fly.dev/support/` and per localization `/support/<app-locale>/` (`support-url.txt`) | same | FACTS 2.10 (must lead to contact details: the support page shows the operator's name and e-mail, `legal/support/support-en.md`) |
| Marketing URL | blank (`marketing-url.txt` is empty on purpose) | blank | FACTS 2.11 (not required); ENV-FINAL decision 12 |
| Copyright | `2026 Ouriel Sebag` - without the © sign | same | FACTS 2.14 ("The copyright symbol is added automatically."); ANSWERS amendment 1 |
| Version | `1.0.0` | `1.0.0` | ENV-FINAL (the main session sets 1.0.0) |
| Price | Free (0), All Countries or Regions, no pre-order | same | FACTS 2.25, 2.26; ENV-FINAL decision 6 |
| Version Release | Manually release this version | same | FACTS 2.24 |
| Sign-in required (App Review Information) | yes - user name `stor`; password: (the owner types the password only in App Store Connect) | same account | ENV-FINAL decision 7; FACTS 2.27 |
| Review notes | `appstore/policy/review-notes.txt` | same file | FACTS 2.27 (up to 4000 bytes) |
| Export compliance | `ITSAppUsesNonExemptEncryption` = NO | same | `export-compliance.md` |

The publisher name, contact e-mail and copyright holder come from `legal/settings.json` (`publisherName` "Ouriel Sebag", `contactEmail` "yourpersonaldiary29@gmail.com"). FACTS 1.2: the App Store shows the seller as the legal name of the Apple Account - it must equal `publisherName`.

## 2. Version and build numbers

| What | iPhone app | Mac app |
| --- | --- | --- |
| Version shown to customers (`CFBundleShortVersionString`) | Xcode target > General > Identity > **Version** (`MARKETING_VERSION` of `ios/App/App.xcodeproj`, the project `npx cap add ios` generates - `scripts/ios/README.he.md`) = `1.0.0` | `src-tauri/tauri.conf.json` `"version"` (the main session raises it to `1.0.0`; Tauri writes it into the bundle's Info.plist - `scripts/mac/release.sh` prints the value it finds) |
| Build number (`CFBundleVersion`) | Xcode > General > Identity > **Build** (`CURRENT_PROJECT_VERSION`): `1` for the first upload, then `2`, `3`, ... for every new upload of the same version | Route 2 (Mac App Store): `APPSTORE_BUILD_NUMBER` given to `scripts/mac/build-appstore.sh` (it becomes `bundle.macOS.bundleVersion`; default = the version string). Use `1`, `2`, `3`, ... |

Apple: `CFBundleVersion` is "one to three period-separated integers" containing only digits and periods, and identifies the build (FACTS 8.6). An explicit "must increase" sentence was not found (FACTS 8.6); the practice used here is a higher build number for every upload. The Xcode Organizer's "TestFlight & App Store" preset can also update the build number itself (FACTS 8.4).

## 3. Notes

1. **The Mac record's name.** Two records in one account cannot carry the same name in the same localization (FACTS 2.3). The iPhone record keeps `Your Personal Diary`; the Mac record is `Your Personal Diary for Mac` in every localization (Latin letters, 27 characters). All other texts are shared (ENV-FINAL decision 1).
2. **Terms of Use.** The service's own Terms of Use are published at `https://yourpersonaldiary.fly.dev/terms/` (per language `/terms/<app-locale>/`, package TERMS, `docs/apple-tasks/TERMS.md`); the app links them on the Sign up screen (one checkbox for the Privacy Policy and the Terms of Use) and in Settings > Privacy. They do **not** replace Apple's EULA: the License Agreement field stays Apple's standard EULA (FACTS 2.23 - a custom EULA is optional and would supersede Apple's for the chosen regions). App Store Connect has no Terms of Use field (FACTS 2.29 lists the properties); the review notes name the URL.
3. **User Privacy Choices URL** is optional (FACTS 2.13). Apple's example is "a webpage where users can ... request deletion"; `https://yourpersonaldiary.fly.dev/delete-account/` would qualify. It is left blank here to keep the first submission minimal; filling it later needs no new version (it is an App Privacy property, FACTS 2.29, and App Privacy answers can change at any time, FACTS 4.1).
4. **Availability in specific countries.** "All Countries or Regions" = the 175 storefronts and any future ones (FACTS 2.25). App Information also has rows about availability in the Republic of Korea, China mainland and Vietnam (FACTS 2.29); FACTS 13.5 reads "nothing to add" for this app. What those rows ask for was not researched (not in FACTS): if App Store Connect demands a document or number for one of these countries that the owner does not have, the simple way out is to untick that country in Pricing and Availability.
