# legal/ - the privacy policy and the account-deletion page

ONE privacy policy for the Android app (Google Play), the Windows app (Microsoft Store and setup file) and the
website, in the app's 20 languages, English by default.

| What | Where |
| --- | --- |
| Sources (Markdown, one file per language) | `legal/privacy/privacy-<locale>.md`, `legal/delete-account/delete-account-<locale>.md` |
| The one place for the owner's values | `legal/settings.json` - `publisherName`, `contactEmail` (both filled by the owner on 2026-10-27), `effectiveDate`, `minimumAge` |
| Build the web pages | `node scripts/legal/build-pages.mjs` -> `public/privacy/**`, `public/delete-account/**` (`--check` compares, `--strict` also refuses unset values) |
| Public addresses (served by the hosted server; a change goes live with the next server deploy) | `https://yourpersonaldiary.fly.dev/privacy/` and `https://yourpersonaldiary.fly.dev/delete-account/` (+ `<locale>/`) |
| Tests | `src/components/legal/legal-pages.test.ts` (pages, placeholders, translations), `server/test/hosted-legal-pages.test.ts` (served by the hosted server) |
| Store answers | `play/policy/*.md` (Google Play), `store/policy/partner-center-privacy.md` (Microsoft Store) |

Rules:
- Change the English text first, then the same sentences in the other 19 files (the test compares their structure:
  sections, list items, links and placeholders), then run the build script. The brand "Your Personal Diary" stays
  English everywhere.
- Placeholders: `{{PUBLISHER_NAME}}`, `{{CONTACT_EMAIL}}`, `{{EFFECTIVE_DATE}}`, `{{MINIMUM_AGE}}` come from
  `settings.json`; `{{SITE_URL}}`, `{{PRIVACY_URL}}`, `{{DELETE_URL}}` come from `src/config/server-default.json`.
  While a value is `null` the page shows the placeholder itself, and `scripts/play/preflight.mjs` stops the release.
- A change in what the apps do with data changes this policy, `play/policy/data-safety.md` and
  `store/policy/partner-center-privacy.md` together; update `effectiveDate`.

בעברית, לבעלים: שם המפרסם וכתובת הדואר לפניות כבר ממולאים ב-`legal/settings.json` (מ-2026-10-27). כדי לשנות אותם -
פותחים את הקובץ, מחליפים את הערך (בין מירכאות), ומבקשים מ-Claude להריץ את סקריפט הבנייה ולפרוס. זה המקום היחיד שבו הם נכתבים.
