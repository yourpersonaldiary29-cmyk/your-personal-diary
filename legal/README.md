# legal/ - the privacy policy, the Terms of Use, the account-deletion page and the support page

ONE privacy policy for the Android app (Google Play), the Windows app (Microsoft Store and setup file), the Mac
app (download or Mac App Store), the iPhone app (App Store) and the website, in the app's
20 languages, English by default - plus the Terms of Use (confirmed together with the policy by one checkbox at registration), the
account-deletion page and the support page (the App Store "Support URL": contact details and frequent questions)
in the same languages.

| What | Where |
| --- | --- |
| Sources (Markdown, one file per language) | `legal/privacy/privacy-<locale>.md`, `legal/delete-account/delete-account-<locale>.md`, `legal/support/support-<locale>.md`, `legal/terms/terms-<locale>.md` |
| The one place for the owner's values | `legal/settings.json` - `publisherName`, `contactEmail` (both filled by the owner on 2026-10-27), `effectiveDate` (the policy), `termsEffectiveDate` (the Terms of Use), `minimumAge`. The hosted server stores both dates with every new account as `privacyVersion` / `termsVersion` (through `shared/legal.ts`) |
| Build the web pages | `node scripts/legal/build-pages.mjs` -> `public/privacy/**`, `public/delete-account/**`, `public/support/**`, `public/terms/**` (`--check` compares, `--strict` also refuses unset values and sources still marked `TODO-TRANSLATE`) |
| Public addresses (served by the hosted server; a change goes live with the next server deploy) | `https://yourpersonaldiary.fly.dev/privacy/`, `https://yourpersonaldiary.fly.dev/delete-account/`, `https://yourpersonaldiary.fly.dev/support/` and `https://yourpersonaldiary.fly.dev/terms/` (+ `<locale>/`) |
| Tests | `src/components/legal/legal-pages.test.ts` (pages, placeholders, translations), `scripts/legal/build-pages.test.mjs` (the generator), `server/test/hosted-legal-pages.test.ts` (served by the hosted server) |
| Store answers | `play/policy/*.md` (Google Play), `store/policy/partner-center-privacy.md` (Microsoft Store) |

Rules:
- Change the English text first, then the same sentences in the other 19 files (the test compares their structure:
  sections, list items, links and placeholders), then run the build script. The brand "Your Personal Diary" stays
  English everywhere.
- Placeholders: `{{PUBLISHER_NAME}}`, `{{CONTACT_EMAIL}}`, `{{EFFECTIVE_DATE}}`, `{{TERMS_EFFECTIVE_DATE}}`, `{{MINIMUM_AGE}}` come from
  `settings.json`; `{{SITE_URL}}`, `{{PRIVACY_URL}}`, `{{DELETE_URL}}`, `{{SUPPORT_URL}}`, `{{TERMS_URL}}` come from `src/config/server-default.json`.
  While a value is `null` the page shows the placeholder itself, and `scripts/play/preflight.mjs` stops the release.
- A change in what the apps do with data changes this policy, `play/policy/data-safety.md` and
  `store/policy/partner-center-privacy.md` together; update `effectiveDate`. A change of the Terms of Use updates `termsEffectiveDate`.
- **The "Mac app" item of section 5 of the policy says nothing about the app's signature** (the owner's decision of
  2026-11-23). Its last sentence until then - "Once the app is distributed with Apple's signature, the item will move
  to the keychain that stays on this Mac only." - was deleted, not reworded, in all 20 languages, with a new
  `effectiveDate`. The item ends with the sentence about a Migration Assistant or Time Machine copy.
  The tests keep the deleted sentence out without a table of translations: in every language the item names no
  "Apple" (`scripts/legal/build-pages.test.mjs`, `src/components/legal/legal-pages.test.ts`, and
  `scripts/site/build-site.test.mjs` for the pages of the site). The planned move of the key itself
  (`src-tauri/src/platform/macos.rs`) is unchanged: a build that keeps the key in the other keychain changes what
  the app does with data, so by the rule above this item changes with it.

בעברית, לבעלים: שם המפרסם וכתובת הדואר לפניות כבר ממולאים ב-`legal/settings.json` (מ-2026-10-27). כדי לשנות אותם -
פותחים את הקובץ, מחליפים את הערך (בין מירכאות), ומבקשים מ-Claude להריץ את סקריפט הבנייה ולפרוס. זה המקום היחיד שבו הם נכתבים.
