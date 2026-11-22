# site/ - the public web site of the app

A small static site for a visitor who has never seen Your Personal Diary: a home page with the logo, what the app
is, the Terms of Use, questions and answers, the Privacy Policy, the installation files, and a way to write to us.
Eight pages in each of the app's 20 languages, English by default. The decisions behind it:
`docs/site-tasks/SITE.md` (version 2, and the owner's two decisions of 2026-11-22).

## Pages and addresses

`<server>` is the fixed server (`src/config/server-default.json`). The site lives under `/about/` there. English has
no folder of its own; every other language has one (`he`, `ar`, ...). There is no `/about/en/`.

| Page | English | Another language |
| --- | --- | --- |
| Home (the home page) | `/about/` | `/about/he/` |
| About the app | `/about/app/` | `/about/he/app/` |
| Terms of Use | `/about/terms/` | `/about/he/terms/` |
| Questions and answers (30) | `/about/faq/` | `/about/he/faq/` |
| Privacy Policy | `/about/privacy/` | `/about/he/privacy/` |
| Downloads | `/about/downloads/` | `/about/he/downloads/` |
| "Your message was sent" | `/about/contact/sent/` | `/about/he/contact/sent/` |
| "Your message was not sent" | `/about/contact/error/` | `/about/he/contact/error/` |

That is 8 x 20 = 160 pages. Shared by all of them: `/about/site.css`, `/about/site.js`, `/about/img/**`,
`/about/files/**` (the installers).

The home page is a page of its own since 2026-11-22 (the owner asked for a page at the beginning with the logo,
which a click on the logo opens): the app icon, large, and the name, then the heading, the lead, three actions (the
web app, Downloads, About the app) and the phone. "About the app", which was also the home page until then, shows
what you can do, what it looks like and your privacy. Both are built from the same texts (`hero`, `features`,
`screens`, `privacy`); the list of pages is `SITE_PAGES` in the builder, the menu is `MENU`.

Every page has the same frame: skip link, header (logo and name: one link to the home page of the language), menu
(Home, About the app, Terms of Use, Questions and answers, Privacy Policy, Downloads, Contact us; the current page
is marked), the page's own content, the contact block with the form (not on the two result pages), and the footer
with the language chooser and the copyright line.

**Every address inside the site is relative** (`../terms/`, `./he/`, `../../site.css`), computed from the depth of the
page. The same tree therefore works under `/about/` today and at the root of the owner's domain later. Absolute
addresses appear only where they must: `canonical`, `hreflang`, `og:url`, `og:image`, the links to the web app and to
the two documents that stay outside the site (support, account deletion), store links, and the one absolute path of the
site - the form's action, `/api/contact`.

## Where things are

| What | Where |
| --- | --- |
| The texts, one file per language, the same keys in all 20 | `site/content/site-<locale>.json` |
| The base address, the copyright year, the store links | `site/settings.json` |
| The list of installer files (committed) | `site/downloads.json` |
| The installer files themselves (**not** committed) | `site/downloads/` |
| The one script of the pages | `site/site.js` (published as it is) |
| The builder and the tool for the Downloads list | `scripts/site/build-site.mjs`, `scripts/site/add-download.mjs` |
| The rules of the Downloads list and the markup of its rows (the hosted server uses them too) | `scripts/site/downloads-shared.mjs` |
| The publisher name, the contact e-mail, the minimum age | `legal/settings.json` (one place for them) |
| The two legal documents | `legal/terms/`, `legal/privacy/` - rendered with the functions of `scripts/legal/build-pages.mjs`, never a second copy |
| The colours | the app's own theme tokens, `src/styles/tokens.css` (light and dark), read at build time |
| The images | `play/screenshots/` (phone), `store/screenshots/` (desktop), `play/graphics/feature-1024x500.png` (sharing image), `public/favicon.svg` (the logo of the header, and large on the home page) - copied as they are |
| Tests | `scripts/site/*.test.mjs`, `server/test/hosted-site-page.test.ts` |

The site is **hosted-only**. It is never written into `public/`, so it is in no installer and in no app bundle.
`scripts/hosted/stage-image.mjs` builds it into the hosted image at `ui/about/`, and the server serves it as static
files. Nothing generated is committed (`site/out/` is git-ignored).

## The texts

One JSON object per language; the keys are fixed by `CONTENT_SCHEMA` in the builder. Plain text only: no HTML, no
Markdown, no line breaks.

- Placeholders: `{{BRAND}}`, `{{MINIMUM_AGE}}`, `{{PUBLISHER_NAME}}`, `{{CONTACT_EMAIL}}`. A translation uses exactly
  the placeholders of the English text. The minimum age is never written as a number.
- Links, in the answers of the questions and in a few other texts: `[[target|link text]]`. The targets: `privacy`,
  `terms`, `faq`, `downloads`, `home` (pages of the site, in the language of the page), `support`, `delete` (the two
  documents outside the site), `webapp`, `contact` (the contact block). A translation keeps the targets and translates
  the link text.
- `faq.items` has exactly 30 questions, in six groups of 7, 7, 5, 5, 4 and 2 (`faq.groups`).
- Every text must be true of the app as it is: no medical promise, no superlative, no "end-to-end" (one question
  asks it, and the answer is No), no claim that a store has published the app.
- **No text tells a visitor that a file is not signed** (the owner's rule of 2026-11-22) - nor that it is
  uncertified, not verified, not notarized, or from an unidentified developer or publisher. The installing notes
  (`downloads.install.*`) and the answer about the warnings (`faq.items[28].a`) say where the file does not come
  from, name the warning the system shows and give the steps past it. A test keeps the words for "signed" and
  "certificate" out of these texts in all 20 languages (`UNSIGNED_WORDS` in `scripts/site/build-site.test.mjs`).
- `nav.home` is the usual word of the language for the home page of a web site, as a menu item ("Home", "דף הבית").

### Change a text

1. Change the English sentence in `site/content/site-en.json`.
2. Change the same key in the other 19 files.
3. `node scripts/site/build-site.mjs --check --strict` must exit 0, and `node --test "scripts/site/*.test.mjs"` must pass.

### Texts that wait for their translation

A file that still holds English text carries the key `_status` at the top:

```json
"_status": { "marker": "TODO-TRANSLATE", "keys": ["nav.about", "faq.items.7.q"] }
```

`keys` lists the texts that are still English (a key is the path of the text with dots, list items by their number
from 0); `"keys": "all"` marks a file that is an English copy. A translator translates exactly the listed keys,
leaves every other key as it is, and deletes `_status` when the file is done. The pages are built in the meantime, so
that the work can be looked at; `--strict` refuses to pass while one `_status` is left.

The two legal documents have no `_status`: a translation of `legal/terms/` or `legal/privacy/` that lacks a heading or
a list item of the English document (the English text grew, as the privacy policy did for the contact form) is
reported as "behind the English document", with the first section that differs - a warning, and an error with
`--strict` - until the translator has added the missing part.

## Downloads: publish a new version

The Downloads page has a tab per platform (Windows, Android, Mac) and in each a table: File, Version, Size - one row
per version, the newest first, and under it the SHA-256 of each file.

1. Build the three installers of the version.
2. Put each one on the list - three runs:

   ```bash
   node scripts/site/add-download.mjs --platform=windows --version=1.1.0 --date=2026-12-01 --from="C:\path\to\setup.exe"
   node scripts/site/add-download.mjs --platform=android --version=1.1.0 --date=2026-12-01 --from="C:\path\to\app.apk"
   node scripts/site/add-download.mjs --platform=mac     --version=1.1.0 --date=2026-12-01 --from="C:\path\to\app.dmg"
   ```

   The tool copies the file into `site/downloads/` under its public name (`YourPersonalDiary-<version>-windows-x64-setup.exe`,
   `...-android.apk`, `...-mac-universal.dmg`), measures it, computes its SHA-256 and puts its row first in
   `site/downloads.json`. The source file is only read. The same platform and version again is refused; `--replace`
   puts the new file in its place.
3. `node scripts/site/build-site.mjs --check --strict`.
4. Commit `site/downloads.json` and deploy the server (below). The files travel inside the hosted image.

Take an old version off the page: `node scripts/site/add-download.mjs --platform=windows --version=1.0.0 --remove`
(the row leaves the list, its file leaves `site/downloads/`). Every version that is kept adds about 15 MB to the image.

The builder refuses to build - and so `stage-image.mjs` refuses to stage - while a listed file is missing from
`site/downloads/` or its size or SHA-256 differs from the list. Because the files are not committed, a fresh clone
has none: copy them in again with `add-download.mjs ... --replace` before building, staging or running the tests.

If the notes under a table stop being true (for example once a system no longer shows the warning they describe),
change `downloads.install.*` and the question about installing in the content files - in all 20 languages, and
without telling the visitor whether a file is signed (the rule above).

### Files the owner publishes in the Server card

Without a deploy, the owner can also publish a file (and take one off) in the app's Server card
(`docs/server-tasks/SERVER-CARD-V2.md` Part A, `docs/API.md` "קבצי דף ההורדות"). Those files live on the server's
volume, not in the image. The builder therefore writes, next to the installers, the list it built the pages from
(`files/downloads.json`), and marks in each platform panel the parts that depend on the list - the rows, the checksums
and the empty-state text `downloads.empty` - with HTML comments (`<!-- downloads:windows:rows -->` ...
`<!-- /downloads:windows:rows -->`). The hosted server merges the list of the image with the uploaded files and writes
those parts again with the same functions (`scripts/site/downloads-shared.mjs`), so with nothing uploaded or removed
the live pages are the built pages byte for byte. A row the owner removed there stays removed after later deploys.

## `site/settings.json`

```json
{
  "siteBaseUrl": null,
  "copyrightYear": 2026,
  "links": { "googlePlay": null, "appStoreIphone": null, "appStoreMac": null, "microsoftStore": null }
}
```

- `siteBaseUrl`: `null` = `<server>/about/`. When the owner connects a domain: the address of the site there, with
  `https:` and a final `/` (`"https://example.org/"`). Only `canonical`, `hreflang`, `og:url`, `og:image` and the
  addresses a legal document shows as text follow it; the pages need no other change. Serving the site on that host
  is a server task of its own (the host check, the answers of `/api/contact`).
- `copyrightYear`: the year of the line `(c) <year> Your Personal Diary. All rights reserved.`
- `links`: when a store has published the app, put its link in place of `null`. Only `https` links on the store's own
  host are accepted (`play.google.com`, `apps.apple.com`, `apps.microsoft.com`, `www.microsoft.com`). The link is then
  shown on the Downloads page, above the table of its platform; the iPhone link replaces the sentence "not available
  yet".

## The contact form

Plain HTML that works without script: `<form method="post" action="/api/contact">` with `firstName`, `lastName`,
`email`, `message`, the hidden `lang` (the language of the page) and the honeypot `website` (out of sight, out of the
tab order). The hosted server answers with a redirect to `contact/sent/` or `contact/error/` of that language
(`server/src/hosted/contact.ts`, `docs/API.md`). Every page carries `<meta name="referrer" content="same-origin">`:
the server sends `Referrer-Policy: no-referrer`, under which a browser would post the form with `Origin: null`; with
this line the form says where it comes from, and nothing is told to any other site.

## Style and script

- `site.css` is written by the builder (`siteCss`): the app's colours, light and dark by `prefers-color-scheme`,
  logical properties only (the layout mirrors itself in Hebrew and Arabic), no animation, every control at least 44 px
  high, a visible focus ring. The tests compute the contrast of every colour pair.
- `site/site.js` does two things: the "Change" button of the language chooser, and the tabs of the Downloads page.
  Every page works without it (a list of language links; the three platforms one after the other). It makes no
  network call, keeps nothing and names no address - the builder refuses the file otherwise (`scriptProblems`).
- No inline script, no event handler attribute, no `style` attribute: the server's Content-Security-Policy would
  block them.

## Preview

```bash
node scripts/site/build-site.mjs              # writes site/out/about/**
node scripts/site/build-site.mjs --out=<dir>  # writes <dir>/about/** instead
node scripts/site/build-site.mjs --check      # builds in memory, writes nothing; exit 1 on any problem
node scripts/site/build-site.mjs --strict     # also exit 1 while a text waits for its translation (a _status, or a legal
                                              # translation behind the English document) or a setting is unset
```

Serve `site/out` with any static file server on `127.0.0.1` and open `/about/`. Because every address is relative,
serving the folder `site/out/about` itself as the web root works too. The form needs the hosted server.

## Tests

```bash
node --test "scripts/site/*.test.mjs"                          # the builder, site.js, add-download.mjs, the shared list
cd server && npx vitest run test/hosted-site-page.test.ts      # the staged image and the hosted server
cd server && npx vitest run test/hosted-downloads.test.ts      # the files the owner publishes in the Server card
```

## Deploy

The site goes live with a deploy of the hosted server (`scripts/hosted/deploy.ps1`, the main session with the owner):
`stage-image.mjs` builds it into `deploy/hosted/dist/ui/about/` on every run and refuses a web UI that already holds an
`about` entry. Before a deploy `node scripts/site/build-site.mjs --check --strict` must exit 0. For the owner, in
Hebrew: `docs/HANDOVER.he.md`; for the operator: `docs/HOSTED-RUNBOOK.he.md`, section 11א.
