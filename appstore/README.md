# App Store kit - the listing texts (`appstore/listing/`)

The App Store texts of **Your Personal Diary**, one folder per App Store Connect localization, shared by the two app
records: the **iPhone app** (bundle id `app.yourpersonaldiary`, Capacitor) and the **Mac app** (bundle id
`app.yourpersonaldiary.mac`, Tauri). Every sentence is written to be true on both platforms, so the same files are
pasted into both records; `platform-notes.md` (in `en-US/` and `he/`) lists the few sentences a record may word more
precisely. Written 2026-11-08 (FINAL sprint, brief `docs/apple-tasks/LISTING.md`, rules `docs/apple-tasks/ENV-FINAL.md`).

The limits and field labels below are those of App Store Connect as the brief states them. `docs/apple-tasks/APPSTORE-FACTS.md`
(section 2, the FACTS package) is the verified reference: where it differs, it wins, and `scripts/appstore/check-listing.mjs`
(`FIELDS`) must be updated to match.

Related kit files, written by other packages of the same sprint: `appstore/ANSWERS.he.md` and `appstore/CHECKLIST.he.md`
(every App Store Connect question answered, the owner's to-do list), `appstore/policy/` (App Privacy, age rating, export
compliance, review notes, fixed app information), `appstore/screenshots/` and `appstore/icon/` (SHOTS package).

## 1. Folders and `appstore/locales.json`

`appstore/locales.json` maps each of the app's 20 UI languages (`shared/i18n/locales.ts`, same order) to its App Store
Connect localization: `folder` is Apple's code and the folder name under `appstore/listing/`, `appleName` is the name
App Store Connect shows in its language menu, `note` records decisions.

| App locale | Folder | App Store Connect name | App locale | Folder | App Store Connect name |
| --- | --- | --- | --- | --- | --- |
| en | `en-US` | English (U.S.) - **primary** | it | `it` | Italian |
| he | `he` | Hebrew | de | `de-DE` | German |
| ar | `ar-SA` | Arabic | ro | `ro` | Romanian |
| zh | `zh-Hans` | Chinese (Simplified) | el | `el` | Greek |
| ja | `ja` | Japanese | pl | `pl` | Polish |
| hi | `hi` | Hindi | cs | `cs` | Czech |
| th | `th` | Thai | hu | `hu` | Hungarian |
| es | `es-ES` | Spanish (Spain) | ru | `ru` | Russian |
| pt | `pt-PT` | Portuguese (Portugal) | bg | - | **none** (see below) |
| fr | `fr-FR` | French | tr | `tr` | Turkish |

* **Portuguese = pt-PT.** The app's own catalogue (`shared/i18n/messages/pt/*.ts`) is European Portuguese
  (`palavra-passe`, `ficheiro`, `definições`, `telemóvel`, `utilizador`, `ecrã`; `você` never occurs), so the App Store
  localization is Portuguese (Portugal), like the Microsoft Store listing. A reader in Brazil sees en-US until someone
  adds a `pt-BR` folder (copy pt-PT, adapt the spelling, register it in `locales.json`).
* **Bulgarian cannot be entered.** App Store Connect has no Bulgarian localization. `listing/bg/NOTE.txt` says so
  (English and Hebrew); a Bulgarian reader sees en-US; the app itself has Bulgarian.
* Folders starting with `_` are ignored by the checker (drafts, archives).

## 2. The files and where they go in App Store Connect

One UTF-8 text file per field, LF or CRLF, one line break at the end, no tabs, no trailing spaces, no placeholders. All
limits are in Unicode code points (`Array.from(text).length`), without the final line break.

| File | App Store Connect: page > section > field | Limit / rule |
| --- | --- | --- |
| `name.txt` | App Information > Localizable Information > **Name** | 30; exactly `Your Personal Diary` in every language |
| `subtitle.txt` | App Information > Localizable Information > **Subtitle** | 30 |
| `privacy-url.txt` | App Privacy > Privacy Policy > **Privacy Policy URL** (per localization; older layouts show the field under App Information > Localizable Information) | exactly `https://yourpersonaldiary.fly.dev/privacy/<app-locale>/` (en-US: `.../privacy/`) |
| `promotional-text.txt` | the version page (iOS App or macOS App > 1.0 Prepare for Submission, the localization in the language menu) > **Promotional Text** | 170 |
| `description.txt` | version page > **Description** | 4000; at least 600 here; plain text; blank line between paragraphs; `- ` as the only bullet; the first paragraph names the app and says what it is |
| `keywords.txt` | version page > **Keywords** | 100 characters including the commas (and see the byte note in section 3); one line; `a,b,c` with no space after a comma; each keyword at least 3 characters; no word already in the name or subtitle; no brand or competitor names; no plural next to its singular; ordered by importance |
| `support-url.txt` | version page > **Support URL** | exactly `https://yourpersonaldiary.fly.dev/support/<app-locale>/` (en-US: `.../support/`) |
| `marketing-url.txt` | version page > **Marketing URL** | empty file - there is no marketing site (the domain yourpersonaldiary.org has no site yet) |
| `whats-new.txt` | version page > **What's New in This Version** | 4000; App Store Connect shows this field from the second version on - version 1.0 is not asked; the file is ready for the first update |
| `platform-notes.md` | not a field - notes for the person pasting (`en-US` and `he` only) | - |

Not in this folder, because they are not per-language texts: the **Copyright** field of the version page is
`© 2026 Ouriel Sebag` (publisher name from `legal/settings.json`); categories (Lifestyle, Productivity), age rating,
App Privacy, App Review sign-in (user name `stor`; the owner types the password only in App Store Connect), the
release option and the Mac differences are in `appstore/ANSWERS.he.md` and `appstore/policy/`.

**Promotional text** is the one text Apple lets you change at any time without a new build or a new review
submission. When it is changed in App Store Connect, change the file too, so the kit stays the truth.

## 3. The check script

```
node scripts/appstore/check-listing.mjs                  # every folder of locales.json: exit 1 lists the problems, exit 0 prints a table
node scripts/appstore/check-listing.mjs --only en-US,he  # only these folders (missing others are not reported)
node scripts/appstore/check-listing.mjs --json           # the result as JSON
node --test scripts/appstore/check-listing.test.mjs      # its tests; also part of: node --test "scripts/**/*.test.mjs"
```

It checks, for every folder named in `locales.json`: all nine files present and nothing else; the limits above in code
points; the name; the keyword rules; the URLs (https, this server, the locale path, the marketing URL empty); the
description's minimum and first paragraph; no Markdown (`**`, `##`, backticks), HTML, emoji or bullet other than `- `
in the texts; the forbidden platform terms (`android`, `google play`, `play store`, `windows`, `microsoft`, `msix`,
`exe` as words, and the same names in Hebrew, Arabic, Cyrillic, Chinese, Japanese, Hindi and Thai); no `{{`, tabs or
trailing spaces; that a translation is written in its language's script (at least 60% of its letters, brand and
product terms excluded) and is not the English text; `platform-notes.md` present in en-US and he and nowhere else;
`bg/NOTE.txt` present. The table on success shows the subtitle, promotional text, description and keyword counts per
localization.

It cannot check meaning: the quality of a translation, whether a sentence is true, whether a keyword is relevant. A
human reads each folder once against section 5 (the verifier role in `docs/apple-tasks/LISTING.md`).

**Keyword bytes.** Apple's reference page says the keywords take "up to 100 bytes of content" (`APPSTORE-FACTS.md`
2.8), while the App Store Connect form and Apple's App Store search guidance count 100 characters, which is what the
brief prescribes. The checker enforces 100 characters and prints the UTF-8 byte count as the last table column, with
a `warn` line above 100 bytes - every list in a non-Latin script will show one (a Hebrew letter is 2 bytes, a CJK
character 3). If App Store Connect refuses a list when it is pasted, delete keywords from the end until it accepts
(the lists are ordered by importance) and update the file. `--strict-keyword-bytes` turns the warning into a failure
for anyone who prefers to be safe under both readings.

## 4. Translating a folder (translators)

1. Create the folder named in `locales.json` and copy the nine `.txt` files of `en-US/` into it (not `platform-notes.md`).
2. Translate from `en-US`, with `he` as a second reference for tone. Shorten gracefully to stay within the limits -
   never truncate mid-sentence. Keep the same blocks (headings, `- ` lines) where the language allows it.
3. Keep as they are: `Your Personal Diary` (Latin letters, never translated or transliterated), `Face ID`, `Touch ID`,
   `HTTPS`, `TXT`, `CSV`, `JSON`, `PDF`.
4. Use the app's own words for its screens and features (`shared/i18n/messages/<locale>/`): the navigation names in
   `shell.ts` (`shell.nav.*`: Home, My diary, Calendar, Habits, Insights, Statistics, Search, Backup, Settings),
   `auth.ts` (`auth.rememberMe` = "Remember me"), `settings.ts` (`settings.language.title`, `settings.security.lockNow`
   = "Lock now", backup and export labels), `insights.ts` (`insights.card.why` = "Why did I get this insight?"),
   `calendar.ts` (`calendar.system.*` = the three calendar names), `habits.ts` (reminders).
5. `support-url.txt` and `privacy-url.txt`: the same server with `/support/<app-locale>/` and `/privacy/<app-locale>/`
   (the app locale, e.g. `de`, not the folder code `de-DE`). `marketing-url.txt` stays empty; `name.txt` stays.
6. Keywords: one line, commas without spaces, in your language (Latin terms where natural), no word already in the name
   or your subtitle, no plurals next to singulars, no brand or competitor names, no prices.
7. Right script and punctuation for the language (Arabic comma, CJK punctuation, Thai spacing, French no-break spaces
   before `; : ! ?`). Right-to-left text needs no markers in plain files.
8. Run `node scripts/appstore/check-listing.mjs --only <folder>`; then read your text once more against section 5.

## 5. Content rules (why the texts say what they say)

* **Truthful about today's product** (App Review Guideline 2.3): one account on a server (Frankfurt); the first sign-in
  needs a connection, afterwards the app keeps working without one and uploads when the connection returns; "Remember
  me" keeps an encrypted copy on the device; unlock without a connection with Face ID / Touch ID / the device passcode
  (iPhone) or Touch ID / the Mac password (Mac); 20 languages; Gregorian, Hebrew and Hijri calendars with holidays;
  mood, energy, stress, sleep and activity fields; habits with reminders; insights worded carefully (no medical claims;
  the app "does not prove cause and effect"); smart search in your own language; encrypted backups; exports to TXT,
  CSV, JSON and PDF; account deletion in Settings; no ads, no analytics, no tracking; free (but the texts never say
  "free" - price words do not belong in metadata).
* **Never name other platforms or stores** (Guideline 2.3.10). Say "on all your devices" / "the same account on every
  device". The checker enforces the obvious words; do not paraphrase around it.
* **No prices, no "best", no superlatives, no security promises the privacy policy does not make.** The policy says
  the operator could technically reset a password and read a diary, so never "nobody can read it", "end-to-end" or
  "zero-knowledge"; write "encrypted on the server with a key derived from your password" and point to the policy.
* **Not said on purpose:** the guest tour (not in the Apple apps), hiding content in the app switcher or blocking
  screenshots, keyboard shortcuts by name (they differ per platform) - see `platform-notes.md`.
* The brand stays in Latin letters in every language; product terms stay as they are.

## 6. What a future developer may need

* Adding a localization Apple introduces later (e.g. Bulgarian): copy `en-US/`, translate, name the folder with
  Apple's code, set `folder` and `appleName` in `locales.json`, run the checker.
* Changing a limit or a field label: `FIELDS` in `scripts/appstore/check-listing.mjs`, the table in section 2, and
  the test `the field files and their App Store Connect limits`.
* The texts are also the source for the Hebrew owner guide `appstore/README.he.md`; keep the two in step.
