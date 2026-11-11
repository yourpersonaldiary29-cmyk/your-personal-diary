# App Store kit - the listing texts (`appstore/listing/`)

The App Store texts of **Your Personal Diary**, one folder per App Store Connect localization, for the two app
records: the **iPhone app** (bundle id `app.yourpersonaldiary`, Capacitor) and the **Mac app** (bundle id
`app.yourpersonaldiary.mac`, Tauri). **Everything is shared except the name**: `name.txt` (`Your Personal Diary`) is
the iPhone record's name and `name-mac.txt` (`Your Personal Diary for Mac`) the Mac record's, because Apple allows one
app name per localization in an account ("You can use an app name for one app per localization",
`docs/apple-tasks/APPSTORE-FACTS.md` 2.3). Every other sentence is written to be true on both platforms, so the same
files are pasted into both records; `platform-notes.md` (in `en-US/` and `he/`) lists the few sentences a record may
word more precisely. Written 2026-11-08 (FINAL sprint, brief `docs/apple-tasks/LISTING.md`, rules
`docs/apple-tasks/ENV-FINAL.md`); the fixer pass of 2026-11-10 added the Mac name, the keyword byte limit and the
minimum-age rule.

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
* Folders starting with `_` are ignored by the checker command (drafts, archives). **`_bg/`** holds a complete
  Bulgarian translation of the ten files (translator B, 2026-11-08), kept for reuse: nothing from it can be pasted
  today. The scripts test `the Bulgarian draft _bg (kept for reuse, skipped by the command) follows the same rules`
  checks it with every rule of the other folders (`node --test scripts/appstore/check-listing.test.mjs`).

## 2. The files and where they go in App Store Connect

One UTF-8 text file per field, LF or CRLF, one line break at the end, no tabs, no trailing spaces, no placeholders. All
limits are in Unicode code points (`Array.from(text).length`), without the final line break - except the keywords,
which are limited in bytes.

| File | App Store Connect: page > section > field | Limit / rule |
| --- | --- | --- |
| `name.txt` | **iPhone record**: the New App dialog > **Name**, then App Information > Localizable Information > **Name** in every localization | 30; exactly `Your Personal Diary` in every language |
| `name-mac.txt` | **Mac record**: the New App dialog > **Name**, then App Information > Localizable Information > **Name** in every localization | 30; exactly `Your Personal Diary for Mac` (27 characters) in every language - Apple allows one app name per localization in an account (`APPSTORE-FACTS.md` 2.3), and the iPhone record carries `Your Personal Diary` |
| `subtitle.txt` | App Information > Localizable Information > **Subtitle** | 30 |
| `privacy-url.txt` | App Privacy > Privacy Policy > **Privacy Policy URL** (per localization; older layouts show the field under App Information > Localizable Information) | exactly `https://yourpersonaldiary.fly.dev/privacy/<app-locale>/` (en-US: `.../privacy/`) |
| `promotional-text.txt` | the version page (iOS App or macOS App > 1.0 Prepare for Submission, the localization in the language menu) > **Promotional Text** | 170 |
| `description.txt` | version page > **Description** | 4000; at least 600 here; plain text; blank line between paragraphs; `- ` as the only bullet; the first paragraph names the app and says what it is; the last paragraph states the minimum age of `legal/settings.json` (section 3) |
| `keywords.txt` | version page > **Keywords** | **100 bytes of UTF-8** including the commas (`APPSTORE-FACTS.md` 2.8: "up to 100 bytes of content"): a Latin letter is 1 byte, a Hebrew, Arabic, Cyrillic or Greek letter 2, a Chinese, Japanese, Thai or Devanagari character 3; one line; `a,b,c` with no space after a comma; each keyword at least 3 characters - except that a two-character Chinese or Japanese word is a whole word and is allowed (if App Store Connect ever refuses one, replace it with a longer form, e.g. `心情日志` in Chinese or `日記帳` in Japanese, keeping the list within 100 bytes); no word already in the name, the Mac name (`for`, `mac`) or the subtitle (in Thai, Chinese and Japanese: no keyword that is a part of them); no brand or competitor names; no plural next to its singular; ordered by importance |
| `support-url.txt` | version page > **Support URL** | exactly `https://yourpersonaldiary.fly.dev/support/<app-locale>/` (en-US: `.../support/`) |
| `marketing-url.txt` | version page > **Marketing URL** | empty file - there is no marketing site (the domain yourpersonaldiary.org has no site yet) |
| `whats-new.txt` | version page > **What's New in This Version** | 4000; App Store Connect does not show this field for the first version (`APPSTORE-FACTS.md` 2.9), so nothing is pasted for 1.0. The file describes version 1.0 ("the first release") and must **not** be pasted as it is into an update: before the first update, rewrite it in all 19 folders to say what changed in that version (Guideline 2.3.12: "Apps must clearly describe new features and product changes"), then run the check |
| `platform-notes.md` | not a field - notes for the person pasting (`en-US` and `he` only) | - |

Not in this folder, because they are not per-language texts: the **Copyright** field of the version page is
`2026 Ouriel Sebag` - typed without ©, because App Store Connect adds the symbol (`APPSTORE-FACTS.md` 2.14; publisher
name from `legal/settings.json`); categories (Lifestyle, Productivity), age rating,
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

It checks, for every folder named in `locales.json`: all ten files present and nothing else; the limits above (code
points, and UTF-8 bytes for the keywords); the two names; the keyword rules; the URLs (https, this server, the locale
path, the marketing URL empty); the description's minimum, its first paragraph and the minimum age in its last
paragraph (below); no Markdown (`**`, `##`, backticks), HTML, emoji or bullet other than `- ` in the texts; the
forbidden platform terms (`android`, `google play`, `play store`, `windows`, `microsoft`, `msix`, `exe` as words, and
the same names in Hebrew, Arabic, Cyrillic, Chinese, Japanese, Hindi and Thai); no `{{`, tabs or trailing spaces; that
a translation is written in its language's script (at least 60% of its letters, brand and product terms excluded) and
is not the English text; `platform-notes.md` present in en-US and he and nowhere else; `bg/NOTE.txt` present. The
table on success shows the subtitle, promotional text and description characters and the keyword characters and bytes
per localization, then the minimum age the descriptions state. The tests (`node --test
scripts/appstore/check-listing.test.mjs`) also run the whole real kit and the Bulgarian draft `_bg/`.

It cannot check meaning: the quality of a translation, whether a sentence is true, whether a keyword is relevant. A
human reads each folder once against section 5 (the verifier role in `docs/apple-tasks/LISTING.md`).

**Keyword bytes.** The keyword limit is 100 bytes of UTF-8, not 100 characters: Apple's reference page says "You can
provide up to 100 bytes of content" (`APPSTORE-FACTS.md` 2.8 and 14.6; `docs/apple-tasks/LISTING.md` amendment
2026-11-08). The checker fails a list over 100 bytes, like any other limit, and prints the byte count in the last
table column. A Hebrew, Arabic, Russian or Greek list holds about 50 letters including the commas, a Chinese, Japanese,
Thai or Hindi list about 33 characters. To shorten a list, delete keywords from the end (the lists are ordered by
importance) and run the check again.

**Minimum age.** The last paragraph of every description ("Please note") states the minimum age of the account, and
`legal/settings.json` ("minimumAge") is the single source of that number for the legal pages, the Terms of Use and
these texts. The checker fails a description whose last paragraph does not give that number, or gives another number.
So if `minimumAge` changes, change the number in the last paragraph of every `description.txt` - the 19 folders and
`_bg/` - and run the check (and the tests, for `_bg/`). For 12, 13 or 16 only the digits change in all 20 languages;
another value needs a grammar check in some (Romanian writes `de 20 de ani` from 20 on, Russian `21 года`). The
Hungarian sentence uses `<N> éves kortól használható` ("usable from age N"), which is unambiguous for any number
(the earlier `<N> éven felülieknek` can also be read as "older than N").

## 4. Translating a folder (translators)

1. Create the folder named in `locales.json` and copy the ten `.txt` files of `en-US/` into it (not `platform-notes.md`).
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
   (the app locale, e.g. `de`, not the folder code `de-DE`). `marketing-url.txt` stays empty; `name.txt` and
   `name-mac.txt` stay as they are.
6. Keywords: one line, commas without spaces, at most 100 bytes of UTF-8, in your language (Latin terms where
   natural), no word already in the names or your subtitle, no plurals next to singulars, no brand or competitor
   names, no prices.
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
* **"No analytics" means no usage analytics** (telemetry about how people use the app). A translation must not say
  "no statistics" or "no analysis": the app has a Statistics page, and the description itself says the server
  analyses the diary for its owner. Write "no usage analytics" where the bare word is ambiguous (French
  `statistiques d’usage`, Japanese `利用状況の分析`, Turkish `kullanım analizi`, Spanish `analítica de uso`).
* **Never name other platforms or stores** (Guideline 2.3.10). Say "on all your devices" / "the same account on every
  device". The checker enforces the obvious words; do not paraphrase around it.
* **No prices, no "best", no superlatives, no security promises the privacy policy does not make.** The policy says
  the operator could technically reset a password and read a diary, so never "nobody can read it", "end-to-end" or
  "zero-knowledge"; write "encrypted on the server with a key derived from your password" and point to the policy.
* **Not said on purpose:** the guest tour (not in the Apple apps), hiding content in the app switcher or blocking
  screenshots, keyboard shortcuts by name (they differ per platform) - see `platform-notes.md`.
* The brand stays in Latin letters in every language; product terms stay as they are.

## 6. What a future developer may need

* Adding a localization Apple introduces later: copy `en-US/`, translate, name the folder with Apple's code, set
  `folder` and `appleName` in `locales.json`, run the checker. **Bulgarian is already translated**: delete
  `listing/bg/`, rename `listing/_bg/` to Apple's code, delete the `NOTE.txt` inside it, set `bg`'s `folder` and
  `appleName` in `locales.json`, and run the checker.
* Before the first update: rewrite `whats-new.txt` in all 19 folders (section 2).
* If `legal/settings.json` `minimumAge` changes: change the number in the last paragraph of every `description.txt`
  (section 3, "Minimum age").
* Not said yet, on purpose: since the OFFLINE-PASSWORD package (2026-11-08) the apps also unlock without a connection
  with the diary password (`src/pages/LockScreen.tsx`), while the descriptions name only Face ID, Touch ID and the
  device passcode or password - true, but incomplete. Adding it means changing that sentence in all 20 descriptions
  (and the two `platform-notes.md` tables) in the same version; several descriptions are within 40 characters of the
  4000 limit (fr-FR 3972, hu 3969, pt-PT 3968, es-ES 3967, ru 3967, de-DE 3965), so they need a shorter sentence
  elsewhere. A possible en-US wording: "If the diary is locked and there is no connection, unlock it with your diary
  password, with Face ID or Touch ID, or with the passcode or password of your device."
* Changing a limit or a field label: `FIELDS` in `scripts/appstore/check-listing.mjs`, the table in section 2, and
  the test `the field files and their App Store Connect limits`.
* The texts are also the source for the Hebrew owner guide `appstore/README.he.md`; keep the two in step.
