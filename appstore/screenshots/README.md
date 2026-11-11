# App Store screenshots - iPhone and Mac, 19 localizations

The App Store screenshot sets of **Your Personal Diary** for the two Apple app records: the **iPhone app** (bundle id
`app.yourpersonaldiary`, Capacitor) and the **Mac app** (bundle id `app.yourpersonaldiary.mac`, Tauri). One set per
App Store Connect localization of `appstore/locales.json` (19; Bulgarian has no App Store localization), each set in
that language with that language's demo diary, fictional accounts only. Rendered 2026-11-09, all three sets rendered again from the
current tree on 2026-11-10; in the fixer pass of the same evening the Mac `08-offline.png` of all 19 localizations and
the iPhone `07-offline.png` of `ja` and `zh-Hans` (both iPhone sets) were rendered again (final sprint, brief
`docs/apple-tasks/SHOTS.md`, rules `docs/apple-tasks/ENV-FINAL.md`, Apple's requirements `docs/apple-tasks/APPSTORE-FACTS.md`
sections 6 and 7). The Hebrew owner's guide is `README.he.md`; this file is the developer's reference.

## 1. What is in this folder

| Path | Set | Pixels | Images | Goes to |
| --- | --- | --- | --- | --- |
| `iphone-6.3/<code>/01-home.png` ... `07-offline.png` | iPhone, Apple's class **iPhone with Dynamic Island (medium display)** - the one iPhone class Apple requires | **1206 x 2622** (portrait) | 19 x 7 = 133 | iPhone app record, slot **iPhone 6.3" Display** |
| `iphone-6.9/<code>/01-home.png` ... `07-offline.png` | iPhone, Apple's class **iPhone with Dynamic Island (large display)** - optional; uploaded so Max / Plus / Air phones get a full-size set instead of a scaled one | **1320 x 2868** (portrait) | 19 x 7 = 133 | iPhone app record, slot **iPhone 6.9" Display** |
| `mac/<code>/01-home.png` ... `08-offline.png` | Mac - required for a Mac app | **2880 x 1800** (16:10) | 19 x 8 = 152 | Mac app record, slot **Mac** |
| `<set>/render-log.json` | the render's record: size and SHA-256 of every file, `"layout": "clean"` (the layout rules passed), the transport log (127.0.0.1 only). Read by the checker. **Not uploaded.** | | | |
| `README.md`, `README.he.md` | this file and the Hebrew guide | | | |

418 images in all. Every image is a 24-bit PNG (colour type 2, RGB, no alpha channel, no transparency), about
150-450 KB. `<code>` is Apple's locale shortcode and the folder name of `appstore/listing/<code>`: `en-US` (the
primary language), `he`, `ar-SA`, `zh-Hans`, `ja`, `hi`, `th`, `es-ES`, `pt-PT`, `fr-FR`, `it`, `de-DE`, `ro`, `el`,
`pl`, `cs`, `hu`, `ru`, `tr`.

**The images are not in the git repository.** `.gitignore` excludes every PNG under `appstore/screenshots/` (418
files, about 100 MB, all regenerable); the repository holds only the two READMEs and the three `render-log.json`
files. A fresh clone therefore has the set folders with their render logs and no image: the checker then reports one
`<set>/: no images at all - the PNGs are not kept in the git repository` line per set (plus the per-localization
FAILs), and its project test (`check-screenshots.test.mjs`, "the project's own App Store sets") is skipped with
"the App Store PNGs are not in this copy of the project (git-ignored)". To get the images back, render the three sets
(section 6 - the tool folder `mpd-store-tools/` is git-ignored too and has to be set up first). The play/ and store/
screenshot sets, by contrast, are committed. Upload from the machine that rendered them, or render again.

No iPad set: the iPhone app is iPhone-only (ENV-FINAL decision 2; `TARGETED_DEVICE_FAMILY = 1`, APPSTORE-FACTS 6.4),
so Apple asks for no iPad screenshots. To add iPad later: a new profile in `scripts/play/render-screenshots.mjs`
with Apple's 13-inch size (2064 x 2752 or 2048 x 2732 portrait), a new set folder here, its class in
`APPLE_CLASSES` of `scripts/appstore/check-screenshots.mjs`, and the iPad build setting in Xcode.

## 2. Apple's rules (APPSTORE-FACTS.md section 6, read 2026-11-08)

* "You must include at least one screenshot and can upload up to 10 screenshots per device size in .jpeg, .jpg, or
  .png formats" - **here 7 (iPhone) and 8 (Mac) per localization.**
* "Images can't include alpha channels or transparencies" - **here 24-bit RGB PNG, checked.**
* The one iPhone size Apple requires is the "iPhone with Dynamic Island (medium display)" class: 1206 x 2622 or
  1179 x 2556 portrait. The "large display" class (1320 x 2868 / 1290 x 2796 / 1260 x 2736) is not required; without
  it Max / Plus / Air phones show the medium set scaled. **Both are uploaded here** (FACTS 6.2-6.3). All smaller
  iPhones get scaled versions of the uploaded sets automatically.
* Mac: "One of the following, with a 16:10 aspect ratio: 1280 x 800 pixels; 1440 x 900 pixels; 2560 x 1600 pixels;
  2880 x 1800 pixels" and "Required for Mac apps" - **here 2880 x 1800** (FACTS 6.5).
* "If your app's user interface is consistent across multiple device sizes and localizations, you only need to
  provide screenshots for the highest required resolution. App Store Connect automatically scales them down for
  smaller device sizes." (FACTS 6.1)
* Localizations: "When you add a language to your app, screenshots and the properties for the new language default
  to those of the primary language" - a localization without its own upload shows the en-US set (FACTS 6.6). Here
  every localization has its own set.
* Content: "Screenshots should show the app in use, and not merely the title art, login page, or splash screen";
  "display fictional account information instead of data from a real person"; nothing of other platforms or stores
  (App Review Guidelines 2.3.3, 2.3.9, 2.3.10 - FACTS 6.1). The sets show the signed-in app with fictional accounts
  and the demo diary; no Android- or Windows-only element is on screen (the Android-only guest tour is before
  sign-in and never shot).
* Apple's specification page says nothing about a status bar, device frames or a colour space for current devices
  (FACTS 6.1 "NOT FOUND"): the images are plain page captures without a status bar, Dynamic Island cut-out or
  window title bar, and without a device frame.

## 3. Where each folder goes in App Store Connect

App Store Connect > My Apps > the app record > the version page (**iOS App** 1.0 / **macOS App** 1.0, "Prepare for
Submission") > section **App Previews and Screenshots**. The language menu at the top right of the version page
chooses the localization; **English (U.S.)** is the primary language and is filled first (its set is also what any
localization without screenshots shows).

| Folder | App record | Device-size slot in App Store Connect | Files, in this order |
| --- | --- | --- | --- |
| `iphone-6.3/<code>/` | iPhone app (`app.yourpersonaldiary`) | **iPhone 6.3" Display** (Apple's specification calls the class "iPhone with Dynamic Island (medium display)"; the pixel size 1206 x 2622 identifies it) | `01-home.png`, `02-diary.png`, `03-entry.png`, `04-habits.png`, `05-insights.png`, `06-settings.png`, `07-offline.png` |
| `iphone-6.9/<code>/` | iPhone app | **iPhone 6.9" Display** ("iPhone with Dynamic Island (large display)", 1320 x 2868) | the same seven |
| `mac/<code>/` | Mac app (`app.yourpersonaldiary.mac`) | **Mac** (2880 x 1800) | `01-home.png`, `02-diary.png`, `03-entry.png`, `04-calendar.png`, `05-habits.png`, `06-insights.png`, `07-settings.png`, `08-offline.png` |

For each of the 19 localizations: pick the language in the language menu, open the slot, drag the files of that
language's folder in numeric order (01 first - the first one to three images are what search results show), and
Save. If App Store Connect shows only one iPhone slot, the other sizes are behind its "View All Sizes in Media
Manager" link (the label may differ between App Store Connect versions; the pixel sizes above are the sure guide).
Nothing is uploaded for sizes that are not listed above: Apple scales the uploaded sets for them.

The same 19 iPhone folders serve both iPhone slots of one record; the Mac folders go to the Mac record only. The
listing texts for the same localizations are in `appstore/listing/<code>/` (`appstore/README.md`).

## 4. The shots

The iPhone sets take the Google Play shot list (`SHOTS` in `scripts/play/render-screenshots.mjs`), the Mac set the
Microsoft Store desktop list (`DESKTOP_SHOTS`); nothing in the pages is edited or hidden, the page is only scrolled
to a clean position as a user would.

| iPhone | Mac | What it shows |
| --- | --- | --- |
| `01-home` | `01-home` | Home: the greeting, "Today" (two entries on the fixed Friday, the writing streak, the diary's total) and the 7-day averages |
| `02-diary` | `02-diary` | My diary: the end of the week's list - today's heading and today's two entries with mood / energy / stress / sleep / emotions |
| `03-entry` | `03-entry` | One entry (Monday 19 October 2026): ratings, sleep, exercise, emotions, free text, notes, a tag |
| - | `04-calendar` | Calendar: the month of the fixed day with every day's mood / energy / habits and the holidays; the Hebrew calendar for `he`, the Hijri calendar for `ar-SA`, Gregorian elsewhere |
| `04-habits` | `05-habits` | Habits: the habit cards with streaks, 30-day completion and progress bars |
| `05-insights` | `06-insights` | Insights: the first group of analysis cards (an encouraging upward trend on the fixed day) with "Why did I get this insight?" |
| `06-settings` | `07-settings` | Settings: the language picker (20 languages) and the account card with the connected devices - "Phone" (iPhone) / "Computer" (Mac) as the current device |
| `07-offline` | `08-offline` | Writing without a connection: an entry written with the network cut. iPhone: the end of "My diary" with the new entry, its "Not uploaded yet" badge and the app's message "Saved on this device. It will be uploaded to the server when the connection returns." (the phone layout's one-line offline bar cannot show its whole sentence and stays above the screen, as on Google Play). Mac: the entry page with the full offline status bar ("No connection - ..." with "1 change waiting") and the badge |

Fixed instant for every set: Friday 23 October 2026, 21:30 UTC (the demo's best day for a listing); the same demo
seed in every language, so every localization shows the same days and entries, translated.

## 5. The fictional accounts

First name = the first demo person of the language's seed content, surname = the language's "John Doe" placeholder,
address under `example.com` (reserved for examples), random password kept in memory only. The same people as the
Play and Store sets: en Dana Doe, he דנה ישראלי, ar سارة الفلاني, zh 张晓雯, ja 山田美咲, hi प्रिया कुमार, th มาลี ใจดี,
es Lucía de Tal, pt Marta de Tal, fr Camille Dupont, it Giulia Rossi, de Anna Mustermann, ro Ana Popescu, el Μαρία
Παπαδοπούλου, pl Anna Kowalska, cs Anna Nováková, hu Minta Anna, ru Анна Иванова, tr Elif Yılmaz.

User names: `first.surname` where it fits on one line of the account card, else the first name and the surname's
initial (Play convention: fr, de, el, pl, cs, ru). The **6.3-inch set is narrower (402 CSS px)** and broke the address
in four more languages, so there `ja` = `misaki.y`, `es` = `lucia.d`, `pt` = `marta.d`, `ro` = `ana.p`
(`IPHONE_MEDIUM_PEOPLE`, the `people` hook of the `iphone-medium` profile; the 6.9-inch and Mac sets use the
Play / Store names unchanged).

## 6. How the sets are made and re-rendered

```
node scripts/play/render-screenshots.mjs --profile iphone-medium     # -> appstore/screenshots/iphone-6.3/
node scripts/play/render-screenshots.mjs --profile iphone-large      # -> appstore/screenshots/iphone-6.9/
node scripts/play/render-screenshots.mjs --profile mac               # -> appstore/screenshots/mac/
node scripts/appstore/check-screenshots.mjs                          # the checker (section 8)
```

Each run (about 10-13 minutes for the iPhone profiles, 8 for the Mac) builds the UI into a temporary folder - the
mobile (server-only) build the Capacitor iPhone app embeds for the iPhone profiles, the root `vite build` the Tauri
window loads for the Mac profile - pointed at a hosted server (`server/src/hosted.ts`, `DIARY_MODE=hosted`) that the
script runs from source on 127.0.0.1 with a temporary data directory; registers a fictional operator and, per
localization, a fictional account filled with "Load sample data"; and shoots the pages in headless Microsoft Edge
(playwright-core from `mpd-store-tools/`) with the profile's viewport, device scale, device language and user agent.
Nothing is deployed, nothing leaves this computer (every request is logged and anything but 127.0.0.1 is blocked -
`render-log.json` records it), and the temporary folder is deleted at the end. Full details: the header of
`scripts/play/render-screenshots.mjs` ("HOW", "LAYOUT RULES", "DETERMINISTIC", "NETWORK", "APP STORE PROFILES").

Prerequisites (present on the owner's PC): Microsoft Edge (every Windows 11 has it; the scripts launch it with
`channel: 'msedge'`), the project's own `node_modules` (`npm install`), and `playwright-core` in the git-ignored tool
folder `mpd-store-tools/` - `$MPD_STORE_TOOLS`, else `<project>/mpd-store-tools`, else
`C:\Users\AVI\Projects\mpd-store-tools` (`toolDir()` in the render script). On a fresh clone, once, from the project
root: `npm install`, then `mkdir mpd-store-tools && cd mpd-store-tools && npm init -y && npm install
playwright-core@1.63.0 && cd ..` (1.63.0 rendered the current images; the project's own `package.json` is never
touched). The render itself downloads nothing.

Partial runs: `--locale he,ar-SA` (folder names) renders only those sets and keeps the others' log entries;
`--only 01,07` only those shots of each set; `--keep-going` goes on after a failed shot and lists every failure at
the end (exit 1, **no render log** - render the profile again, or the failed sets with `--locale`, once the cause is
fixed); `--keep` keeps the temporary folder and saves the screen of a failed shot under `failed/`. A shot fails -
and is never written - when the page has no clean scroll position (text cut by a bar, under the floating button,
a word broken across two lines, an ellipsis), when the page language or direction is wrong, or when something that
changes from run to run would be visible (the account id, the server address).

The profile definitions (`PROFILES` in `scripts/play/render-screenshots.mjs`):

| Profile | Viewport (CSS px) | Device scale | Pixels | UI build | Shots / chrome | Device locale, user agent, device name |
| --- | --- | --- | --- | --- | --- | --- |
| `iphone-medium` | 402 x 874 | 3 | 1206 x 2622 | mobile | `SHOTS`, `PHONE_CHROME`, `offlineEntry: appStoreOfflineEntry` | the language's full tag (he-IL, zh-CN, ...), an iPhone WebKit user agent, "Phone"; `people: IPHONE_MEDIUM_PEOPLE` |
| `iphone-large` | 440 x 956 | 3 | 1320 x 2868 | mobile | `SHOTS`, `PHONE_CHROME`, `offlineEntry: appStoreOfflineEntry` | the same, without `people` |
| `mac` | 1440 x 900 | 2 | 2880 x 1800 | web (root) | `DESKTOP_SHOTS`, `DESKTOP_CHROME`, `wholeExcerpts: 160`, `offlineEntry: appStoreOfflineEntry` | the language's full tag, a Mac WebKit user agent, "Computer" |

`appStoreOfflineEntry` is the text the offline shot writes: the phone's three demo sentences (`offlineEntry`, the Play
set's) joined the language's way - no space after "。" in `ja` and `zh-Hans` (the seed content's `sentenceSeparator`),
identical to the phone's text in the 17 other localizations. The Mac takes it instead of the Store set's longer
`desktopOfflineEntry`: in the 900 px high Mac window the longer text left no clean position at scroll 0 in 18 of 19
localizations (the footer line sat on the window's bottom edge), and the nearest one - 9 px down, 33 px in `de-DE`,
`fr-FR` and `ru` - needed the layout rules' last resort (`boxUnderTopBar`): the navigation row's frames ran under the
header, and at 33 px a strip of the row showed under it like a double rule. With the shorter text every Mac
`08-offline.png` is clean at scroll 0 without the last resort (checked in a scratch render first, then rendered into
the kit - 19 of 19 byte-identical): the navigation row whole, the offline bar, the entry with its badge and the footer.

The Play (`phone`: 432 x 768 at 2.5 = 1080 x 1920) and Store (`desktop`: 1536 x 864 at 1.25 = 1920 x 1080) profiles
are unchanged; the hooks the App Store profiles add (`browserLocale`, `userAgent`, `people`, and `offlineEntry` on the
iPhone) are absent from the phone entry and the desktop entry keeps its own `desktopOfflineEntry`, so those code paths
run exactly as before (`scripts/appstore/check-screenshots.test.mjs` asserts both entries, `people` included).

Determinism: one fixed clock for server and browser, animations off, software rasterising on one thread, the same
seed - the same tree renders the same bytes, so a re-render changes only what the UI, the translations or the demo
changed. Expect a re-render whenever the app's look, its texts or the demo content change, and after the version
number changes (section 7).

## 7. Known, accepted differences from a real iPhone / Mac

* **Fonts.** The renders run on Windows: the text is set in Segoe UI (and the Windows fonts for Hebrew, Arabic, CJK,
  Thai and Devanagari), while an iPhone or Mac shows the same screens in San Francisco and Apple's system fonts.
  Glyph shapes, line lengths, and in a few languages the height of the bottom navigation differ slightly; the
  layout, colours, texts and content are identical. Accepted for the first release. **Re-shooting on a Mac is
  optional and not set up:** the build Mac has no Edge, no Playwright browser and no tool folder (no Homebrew, little
  free disk). With **Microsoft Edge for macOS** installed, `playwright-core` in `mpd-store-tools/` (or
  `$MPD_STORE_TOOLS`) and the project's `node_modules`, the scripts run unchanged. **Playwright's own Chromium** does
  NOT work as they are: `scripts/play/render-screenshots.mjs` (`renderScreenshots`, the `chromium.launch` call) and
  `appstore/icon/render-icon.mjs` (`renderIcon`) both launch with `channel: 'msedge'`; that option has to be removed
  or made configurable first (e.g. read from an environment variable, defaulting to `'msedge'` so the Windows renders
  stay byte-identical), and the browser installed with `npx playwright-core install chromium` inside the tool folder
  (the `playwright-core` CLI installs the revision that matches its own version). The profiles need no change.
* **No status bar, no Dynamic Island cut-out, no Mac title bar, no device frame** - page captures, as the Play and
  Store sets. Apple's specification has no such requirement for current devices (FACTS 6.1).
* **The version in the Mac footer.** The desktop UI's footer shows the app version, and the footer is on the screen
  at the bottom of the Mac shots `02-diary`, `03-entry` and `08-offline`: they read **`v0.1.0`** (bottom right; bottom
  left in `he` / `ar-SA`). The footer prints `APP_VERSION` of `shared/constants.ts` (also Settings > Diagnostics "UI
  version", the server's health / status / admin responses and the `version` field of the JSON export), a constant
  that no script or test ties to `package.json` - and it is **not** on the sprint's version-bump list (ENV-FINAL:
  `package.json`, `Cargo.toml`, `tauri.conf.json`, `version.properties`). So the shots show `v1.0.0` only if
  `APP_VERSION` is changed too (a main-session decision: `shared/**` is frozen for the packages); then render the Mac
  set again (`node scripts/play/render-screenshots.mjs --profile mac`, about 8 minutes) and run the checker. If nothing
  else in the UI changed, only those three shots per localization come out different (the render is deterministic).
  Check it by eye - the checker does not read the version: bottom right of `mac/en-US/02-diary.png` must say
  `v1.0.0`. With `v0.1.0` the sets are still valid uploads (only the small version label is old). The iPhone layout
  has no footer, so the iPhone sets do not show the version.
* **The 6.3-inch iPhone set starts some screens slightly scrolled** (the 874 CSS px high screen has no other clean
  position - at scroll 0 a chip or a line at the bottom would be cut by the bottom navigation, and the layout rules
  take the nearest clean position): `03-entry` in 10 localizations (`en-US`, `he`, `ar-SA`, `zh-Hans`, `ja`, `hi`,
  `th`, `fr-FR`, `cs`, `hu`; `scrollY` 47) starts with the entry's date line - its title ("A wonderful morning") is
  under the app bar (the 6.9-inch set and the other nine localizations show it); `fr-FR/01-home.png` (`scrollY` 71)
  starts with the top edge of the greeting card ("Bonjour Camille") under the app bar; and `07-offline.png` of
  `en-US`, `pl` and `pt-PT` uses the layout rules' last resort (`boxUnderTopBar` in `render-log.json`): the bottoms
  of three empty emotion-chip outlines of the previous entry show just under the app bar (their labels are hidden).
  No text is cut anywhere. A fix would need another entry for shot 03 or a different demo text - not done (the shot-03
  entry is the same in every set by design). The Play set has the same last-resort case in `hi-IN` and `hu-HU` 07,
  the Store set in 03 (by 1 px) and `zh-CN` 08. The Mac set has none (see `appStoreOfflineEntry`, section 6).
* **The iPhone offline shot shows the badge and the message, not the yellow offline bar** (the phone layout keeps
  the one-line bar above the screen, as the Play set does - section 4). The Mac shot shows the full bar.
* The demo data is the app's own sample diary, translated per language; the dates are those of the fixed instant
  (October 2026).

## 8. The checker

```
node scripts/appstore/check-screenshots.mjs             # exit 0 and a table, or exit 1 and the problems
node scripts/appstore/check-screenshots.mjs --set mac   # one set (iphone-6.3, iphone-6.9, mac)
node scripts/appstore/check-screenshots.mjs --json
node scripts/appstore/check-screenshots.mjs --no-ios    # without the iPhone project's icon slot
node --test scripts/appstore/check-screenshots.test.mjs # its tests; also part of: node --test "scripts/**/*.test.mjs"
```

It checks, for each of the three sets and each localization of `appstore/locales.json`: the folder exists (en-US,
the primary language, included) and nothing else is there; exactly the shot list's file names; every file is a
complete PNG (every chunk's CRC, the whole pixel stream), 8-bit colour type 2 without a tRNS chunk (colour type 6 is
accepted only when every pixel is opaque, with a warning), exactly the set's pixel size, which must be one of Apple's
sizes for its class, not blank, 10 KB - 8 MB; the same file is not identical (SHA-256) in two localizations (that
would mean the language did not apply); `render-log.json` names the profile and size, has an entry per localization
whose files match the files on disk, says `"layout": "clean"`, the right app language and a transport log of
127.0.0.1 only. It also checks `appstore/icon/AppIcon-1024.png` (1024 x 1024, RGB, no alpha) and - once the iPhone
Xcode project is on this computer (`ios/`, made on the Mac by the IOS package and copied back) - that the image
`ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json` names for the 1024x1024 slot (the entry without
`appearances`; Capacitor's template calls it `AppIcon-512@2x.png`) is that icon: the same file, or the same pixels as
RGB without alpha. App Store Connect takes the App Store icon from the build, so Capacitor's placeholder there would
ship (`ios  FAIL ...`, with what to copy where). Without `ios/` the table says `ios   -   ... not on this computer
yet` (not a failure). A set folder without any localization folder (a fresh clone: the PNGs are git-ignored, section
1) gets one `no images at all` line. The last line on success: `check-screenshots (App Store): 3 sets, 418 images -
every set complete ...`.

It cannot judge what the eye sees: language and script, right-to-left layout, font rendering (no tofu boxes), no
English leftovers, no clipped text that the layout rules did not model. A person reads a sample after every
re-render (the visual check of `docs/apple-tasks/SHOTS.md`).

## 9. Related

* `appstore/icon/` - the 1024 x 1024 App Store icon and where it goes.
* `appstore/listing/` - the texts per localization; `appstore/ANSWERS.he.md`, `appstore/CHECKLIST.he.md` - every
  App Store Connect question and the owner's to-do list.
* `play/screenshots/README.he.md`, `store/screenshots/README.md` - the Google Play and Microsoft Store sets made by
  the same script.
