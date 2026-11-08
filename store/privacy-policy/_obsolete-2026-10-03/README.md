# Obsolete - do not publish

These four files (`index.html`, `he.html`, `privacy-en.txt`, `privacy-he.txt`, written 2026-10-03) are the privacy
policy of the OLD local-only Windows app ("your diary is stored only on your own device"). Since the apps became
clients of the Your Personal Diary server they are wrong for every published app. They are kept only as history.

The current policy - ONE policy for the Android app (Google Play), the Windows app (Microsoft Store) and the
website, in 20 languages, English by default:

- Public address (enter it in Partner Center and in Play Console): **https://yourpersonaldiary.fly.dev/privacy/**
  (the account-deletion page: https://yourpersonaldiary.fly.dev/delete-account/)
- Sources: `legal/privacy/privacy-<locale>.md` and `legal/delete-account/delete-account-<locale>.md`
- The one place for the publisher name, contact e-mail, effective date and minimum age: `legal/settings.json`
- Build the pages after any change: `node scripts/legal/build-pages.mjs` (writes `public/privacy/**` and
  `public/delete-account/**`; the next server deploy publishes them)
- Microsoft Store answers: `store/policy/partner-center-privacy.md`; Google Play answers: `play/policy/*.md`
