# Microsoft Store listing texts - notes for the translators

One folder per listing language, named with the tag of the MSIX package's resource language:
en-US he-IL zh-CN es-ES pl-PL ru-RU fr-FR ar-SA ja-JP tr-TR cs-CZ hu-HU bg-BG el-GR pt-PT de-DE ro-RO it-IT th-TH hi-IN.
**en-US is the source and the default listing.** he-IL is done. Translate the other 18 from en-US.

Check your folder with `node scripts/store/check-listing.mjs --only <tag>` (all folders: no `--only`). It must say
"all within the Store limits and rules".

## The 8 files and their limits

Counted in UTF-16 code units (JavaScript `String.length`), without the final line break.

| File | Partner Center field | Limit / rule |
| --- | --- | --- |
| `title.txt` | Product name | exactly `Your Personal Diary` (the brand stays English) |
| `short-description.txt` | Short description | one paragraph, max 1000; **keep it under 270** (the checker warns above) |
| `description.txt` | Description | max 10000, plain text; **same blocks as en-US** (same number of paragraphs and of `- ` lines); the first paragraph must name `Your Personal Diary` and say that an account on the server and an internet connection are needed |
| `whats-new.txt` | What's new in this version | max 1500; same blocks and `- ` lines as en-US |
| `features.txt` | Product features | **exactly 20 lines** (as en-US), max 200 characters each, no bullet at the start |
| `keywords.txt` | Search terms | max 7 lines, max 40 characters each, max 21 words in total, all different; words people would search for in your language; no "free"/price words, no other app names, not the product name |
| `copyright.txt` | Copyright and trademark info | `© 2026 {{PUBLISHER_NAME}}.` + "All rights reserved." in your language; max 200 after filling |
| `support-contact.txt` | Support contact info | exactly `{{CONTACT_EMAIL}}` |

Placeholders: only `{{PUBLISHER_NAME}}` (copyright.txt) and `{{CONTACT_EMAIL}}` (support-contact.txt); keep them
as they are, `store/render.mjs` and the CSV generator fill them in.

## Content rules

The checker has patterns for the forbidden claims below in all 20 languages (Latin, Hebrew, Arabic, Cyrillic, Greek,
CJK, Thai, Devanagari). Patterns catch the usual wordings ("only on your PC", "on your PC only", "stays on your PC",
"no server", "remote access", "home network", "no account needed"), not every paraphrase - so passing the checker
is necessary, not sufficient: read your translation once against these rules.

- A real translation in the language's own script; natural, everyday wording; reuse the app's own words for its
  screens and buttons (`shared/i18n/messages/<locale>/shell.ts`, `settings.ts`, `auth.ts`): Home, My diary,
  Calendar, Habits, Insights, Statistics, Search, Backup, Settings, Language, "Remember me", "Why did I get this
  insight?", Delete account.
- Keep as they are: `Your Personal Diary`, `Windows`, `Ctrl+L`, `AES-256`, `HTTPS`, `TXT`, `CSV`, `JSON`, `PDF`.
- Say nothing the English text does not say. In particular never: "stored only on your PC/device", "no cloud",
  "no server", "fully offline", "end-to-end", "zero-knowledge", "only you can read it", Windows Hello /
  fingerprint / face unlock, remote access, home network, DuckDNS; no "best", "#1", "top", "free", "download now".
- No web addresses, no HTML, no emoji, no ALL-CAPS words, no repeated punctuation ("!!", "...").
- Plain UTF-8 without BOM, Unix or Windows line breaks, one line break at the end, no tabs, no double spaces.
- The app opens in English on Windows; the description says so ("choose your language in Settings, under
  Language") - keep that sentence, and because the reader sees the English screen at that moment, give the English
  labels in brackets after your own words, as every translation does: `Einstellungen (Settings)` ... `„Sprache“
  (Language)`, `“设置”（Settings）` ... `“语言”（Language）`.
