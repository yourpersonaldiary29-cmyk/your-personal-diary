# SITE - the public web site of Your Personal Diary

Version 2 of this specification (main session, 2026-11-15). Version 1 (2026-11-14) described one page; the builder,
the design, the staging and 15 translations of it exist in the tree and are the base of this work. Version 2
follows what the owner asked on 2026-11-15, after he saw the plan (Hebrew, his words, typos kept):

> "ולגבי האתר. אני רוצה שהוא יוצג במקור באנגלית. מתחת לאתר של הקישורים של התאורים וההורדות של התוכנה יהיה סימן של זכויות
> יוצרים ואז יהיו כתוב באנגלית לא יודע איך אומרים את זה אבל יהיה כתוב כל הזכויות שמורות לyour-personal-diary אבל בדיוק מעל זה
> יהיה מין משהו כזה של בחירת שפה כמו ביומן ואז זה משנה את כל היומן לשפה שהוא בחר מתוך 20 השפות. בתחילת האתר יהיה הלוגו של
> התוכנה. מתחת לשמע יש אפשרות רשימה של כמה דברים. תאור על האפליקצייה, תנאי שימוש, שאלות ותשובות תבחרי 30 שאלות שנראות לך,
> מדימיאות פרטיות והורדות. תעלי לשם את דף התנאים והמדימיאות ותאור קצר על האפליקצייה, ובהורדות תעלי לשם את כל הקבצים קובץ
> לאנדרוייד, למק, ולwindows. אבל תעשי מין קרטיסייה שצריך לבחור בין הפלטפורמות ואז אם הוא נגיד בחר windows אז זה ירא ה לא
> טבלה אם ה2 עמודות הבאים. גרסה, גודל, ולפני שאת מראה את הגרסה והגודל קאילו אחרי שרואים את השמות של העמודות יש קובץ הטקנה
> לכל גרסה. מתחת לכל הרשימה הזאת של הקישורים יש אפשרות ליצור קשר שימי שם את כתובת המייל של התוכנה
> yourpersonaldiary29@gmail.com ומתחת לשם יהיה תופס שיוצג תמיד כמו בכל האתרים גם אם אתה בקישור תנאי שימוש או הורדות מתחת למה
> שמופיע בקישור יש את הקותרת צור קשר באנגלית ואז את הכתובת מייל ואז תופס למילוי פרטים של שם פרטי, שם משפחה, אימייל, תוכן
> הפנייה מיתחת לזה יהיה כפטור שליחה והתלונה תישלח אלי למייל. כרגע תבני לי את האתר ואז אני יחבר איליו דומיין. ...
> כרגע תעלי את הגרסה הכי עדכנית של כל פלאטפורמה."

In short: a small site, English by default, in the 20 app languages. The logo and the name on top; under the name a
menu - About the app, Terms of Use, Questions and answers (30), Privacy Policy, Downloads - and a way to contact.
Under the content of every page: "Contact us", the e-mail address and a form (first name, last name, e-mail,
message, Send) whose message reaches the owner by e-mail. Then a language chooser like the one in the diary, and
last the line "(c) 2026 Your Personal Diary. All rights reserved." Downloads: tabs for Windows, Android and Mac;
each shows a table - the installer file, Version, Size - with one row per version; for now the newest version of
each. A domain will be connected later.

**Amended on 2026-11-22: two decisions of the owner** (Hebrew, his words, typos kept):

> "תוסיפי עמוד בתחילת הדף אם הלוגו וקשה לוחצים הלב זה קאילו פותח לך דף בית. אבל תמחקי את ההסברים של ההורדות הם לא צריכים
> לדעת על זה שהקובץ עוד לא חתום."

1. **A home page with the logo.** A page at the beginning with the logo, and a click on the logo opens the home
   page. So the site has a home page of its own (`/about/`, `/about/he/`, ...): the app icon, large, and the name,
   then the heading, the lead, three actions and the phone. "About the app" - which was also the home page until
   then - is a page of its own at `/about/app/` (`/about/he/app/`, ...). The menu starts with "Home"; the logo and
   the name of the header lead to the home page from every page, as before. That makes eight pages per language,
   8 x 20 = 160 (sections 1 to 3).
2. **A visitor is never told that a file is not signed.** The notes under the download tables and the answer about
   the warnings no longer say that a file is not signed (nor uncertified, not verified, not notarized, or from an
   unidentified developer or publisher) - in any of the 20 languages. What stays, because the visitor needs it: the
   names of the warnings ("Windows protected your PC", the message that the app is "damaged"), the steps to get
   past them, that the file does not come from Microsoft Store / an app store / Google Play, and the SHA-256 check
   (sections 3 and 7).

## 1. Pages and addresses

`<server>` is the fixed server of `src/config/server-default.json` (https://yourpersonaldiary.fly.dev). The site
lives under `/about/` there. English has no language folder; every other app locale has one:

| page | English | another locale, e.g. `he` |
|---|---|---|
| Home (the home page; since 2026-11-22 a page of its own) | `/about/` | `/about/he/` |
| About the app (since 2026-11-22 at `app/`) | `/about/app/` | `/about/he/app/` |
| Terms of Use | `/about/terms/` | `/about/he/terms/` |
| Questions and answers | `/about/faq/` | `/about/he/faq/` |
| Privacy Policy | `/about/privacy/` | `/about/he/privacy/` |
| Downloads | `/about/downloads/` | `/about/he/downloads/` |
| "Your message was sent" | `/about/contact/sent/` | `/about/he/contact/sent/` |
| "Your message was not sent" | `/about/contact/error/` | `/about/he/contact/error/` |

Shared by all pages: `/about/site.css`, `/about/site.js`, `/about/img/**`, `/about/files/**` (the installers).
There is no `/about/en/`. That is 8 x 20 = 160 pages.

**Every link inside the site is relative** (`../terms/`, `./he/`, `../../site.css`), computed by the builder from
the depth of the page, so the same tree works under any base address: `/about/` today, the root of the owner's
domain later. Absolute URLs appear only where they must: `canonical`, `hreflang`, `og:url`, `og:image` (built from
`siteBaseUrl`, section 6), the links to the web app and to the two legal pages that stay outside the site
(`<server>/support/<locale>/`, `<server>/delete-account/<locale>/`), and store links.

Connecting the domain is a later task (the hosted server answers 421 to any other host today -
`server/src/middleware/hosted-host.ts`); nothing of it is built now, but nothing here may stand in its way.

## 2. The frame of every page

Top to bottom, the same on every page (the two result pages leave out the contact block):

1. **Skip link** to the content.
2. **Header**: the app's logo (the icon of `public/favicon.svg`, inline or as `img/icon.svg`), and the name -
   always `<bdi lang="en" dir="ltr">Your Personal Diary</bdi>`. Logo and name together are one link to the home
   page of the current language - on every page, the home page included (the owner, 2026-11-22: a click on the
   logo opens the home page).
3. **Menu** (`<nav>` with a label; a `<ul>`): Home, About the app, Terms of Use, Questions and answers, Privacy
   Policy, Downloads, and last Contact us (a link to `#contact` on the same page). The current page's item carries
   `aria-current="page"`. On a phone the menu wraps or scrolls sideways; no script-driven "hamburger".
4. **`<main>`**: the page's own content; its first heading is the page's `<h1>` (on the home page the brand block -
   the icon and the name, no heading - stands before it).
5. **Contact block** (`<section id="contact">`): the heading "Contact us" (an `<h2>`), one sentence, the e-mail
   address as a `mailto:` link, and the form (section 5).
6. **Footer**: the language chooser, and under it the copyright line - nothing else.
   * Language chooser: a labelled `<select>` with the 20 languages in their own names (each `<option>` with its
     `lang`), the current one selected, and a button "Change" next to it. `site.js` makes the button open the
     same page in the chosen language. The page does not change by itself when an option is picked (WCAG 3.2.2;
     keyboard users pick with the arrow keys). Progressive enhancement, no `<noscript>`: the page is written with
     the select and button hidden and, in their place, the list of the 20 language links shown under its label
     (ordinary markup); `site.js` hides the list and shows the select and button. A visitor whose browser runs no
     script, or did not get `site.js` (a failed load, a blocker), keeps the list.
   * Copyright: `(c) <copyrightYear> Your Personal Diary. All rights reserved.` with the real copyright sign and
     the brand in `<bdi>`; the sentence "All rights reserved." is translated.

"Displayed in English by default" = `/about/` is English and nothing redirects by browser language.

## 3. The pages

**Home** (page id `home`, since 2026-11-22 a page of its own). ONE hero section and nothing else: first a brand
block - the app icon, large (the image of the header's logo, about 6rem, smaller on a narrow screen, `alt=""`
because the name stands next to it), and the name of the app as text; it is not a link, this is the home page -
then the `<h1>` (`hero.heading`), the lead (`hero.lead`), three actions - "Open in your browser" (the web app,
`<server>/`), "Downloads" (the Downloads page) and "About the app" (the About page) - the note (`hero.note`) and
the first phone screen in the page's language. Title and description: `title`, `description`.

**About the app** (page id `about`, folder `app/`; until 2026-11-22 it was the lower part of the home page). An
`<h1>` (`nav.about`) and a lead (`hero.lead`); then the eight feature cards (`#features`), the screenshots
(`#screens`: four phone screens and one desktop screen in the page's language, with captions and alt texts) and
the short privacy list (`#privacy`) with a link to the site's Privacy Policy page. Title: "About the app - Your
Personal Diary" (the pattern of the Questions page); description: `description`. The texts of version 1 (`hero`,
`features`, `screens`, `privacy`) are kept; change a sentence only where version 2 makes it untrue (for example
"Get the app" and the note about apps being linked "once published"). The two pages are built from texts that
existed; the one new text of 2026-11-22 is `nav.home`.

**Terms of Use** and **Privacy Policy**. The same documents as `<server>/terms/` and `<server>/privacy/`, rendered
inside the site's frame from the same sources (`legal/terms/terms-<locale>.md`, `legal/privacy/privacy-<locale>.md`)
with the functions of `scripts/legal/build-pages.mjs` (`parseSource`, `markdownToHtml`, `fillPlaceholders`,
`dateInWords`) - never a second copy of the text. Inside the site `{{TERMS_URL}}` and `{{PRIVACY_URL}}` lead to the
site's own pages of the same language; `{{SUPPORT_URL}}` and `{{DELETE_URL}}` keep leading to the standalone pages
on `<server>`; `{{SITE_URL}}` stays the web app's address. Each of these two pages names the standalone page as its
`canonical` (the stores and the apps link to those).

**Questions and answers**. Exactly 30, in groups with an `<h2>` each (About the app; Writing and features; Devices
and working offline; Privacy and security; Your account; Installing and updating). Each item is a `<details>`
with the question in `<summary>` (inside an `<h3>` is not valid HTML - keep `<summary>` plain and let the group
headings carry the structure). Answers are short and exact, taken from the vetted sources (below); an answer may
contain links with the link syntax of section 7. The questions must include: what it is; is it free; who
publishes it; which devices; which languages; trying it without an account (only where the tour really exists -
check the app); what an entry can hold; habits and reminders; what insights are and how to see the numbers behind
one; the three calendars; smart search; statistics; export formats; working offline; using several devices; what
happens when the same entry is changed on two devices; using it in the browser; what "Remember me" does; where the
diary is kept; who can read it (the honest limits of the privacy policy, section 4); is it end-to-end encrypted
(no - say what is true instead); ads and tracking; the locks (inactivity lock, the device's screen lock); a
forgotten password; backup and restore; deleting the account; the minimum age; why Windows / macOS / Android warn
when installing a file from this site and what to do; how to update to a new version; is it a medical tool (no).

**Downloads**. An `<h1>`, a lead, then:
* a **tab list** - Windows, Android, Mac - built as real tabs by `site.js` (WAI-ARIA tabs pattern: `role="tablist"`,
  `tab`, `tabpanel`, `aria-selected`, `aria-controls`, roving `tabindex`, Left/Right/Home/End, and the opposite
  arrow direction in right-to-left pages); the script selects the visitor's own platform first when it can tell,
  otherwise Windows. Without script the three panels are simply shown one after the other, each under its heading.
* in each panel a **table** with a caption and exactly these columns: **File** (the installer's file name as the
  download link, `download` attribute, in a `<th scope="row">`), **Version**, **Size**. One row per version, newest
  first. Under the table: what the platform needs (Windows 10 or 11; Android 7.0 or later; macOS 12.3 or later),
  two or three plain sentences on installing a file that is not from a store (what the system will ask and what to
  choose - true for the files as they are today), and a `<details>` "Check the file" with the SHA-256 of each row.
  **The owner's rule of 2026-11-22: a visitor is never told that a file is not signed.** The notes
  (`downloads.install.*`) and the answer about the warnings (`faq.items[28].a`) say where the file does not come
  from (Microsoft Store, an app store, Google Play), name the warning the system shows ("Windows protected your
  PC", the message that the app is "damaged") and give the steps past it - and never that a file or the app is
  unsigned, uncertified, not verified, not notarized, or from an unidentified developer or publisher. A test keeps
  the words for "signed" and "certificate" out of these texts in all 20 languages.
* under the tabs: one line on the web version (a link to the web app), and one on iPhone ("There is no installation
  file for iPhone: iPhone apps are installed from the App Store. The iPhone app is not available yet." - when
  `links.appStoreIphone` is set, a link instead). When a store link of section 6 is set, the matching panel shows
  it above its table.

**The two result pages**. An `<h1>` ("Your message was sent" / "Your message was not sent"), one or two sentences
(the error page gives the e-mail address as the other way), and a link back to the home page. `noindex`.

## 4. Downloads: where the files come from

```
site/downloads.json        the list (committed)
site/downloads/<file>      the installer files (NOT committed: git-ignored)
scripts/site/add-download.mjs
```

`site/downloads.json`:

```json
{
  "windows": [{ "version": "1.0.0", "date": "2026-11-13", "file": "YourPersonalDiary-1.0.0-windows-x64-setup.exe", "bytes": 2817354, "sha256": "..." }],
  "android": [{ "version": "1.0.0", "date": "2026-11-13", "file": "YourPersonalDiary-1.0.0-android.apk", "bytes": 6189146, "sha256": "..." }],
  "mac":     [{ "version": "1.0.0", "date": "2026-11-13", "file": "YourPersonalDiary-1.0.0-mac-universal.dmg", "bytes": 6497114, "sha256": "..." }]
}
```

* File names: ASCII letters, digits, dot and hyphen only; they are what the visitor's browser saves.
* `node scripts/site/add-download.mjs --platform=<windows|android|mac> --version=<x.y.z> --date=<YYYY-MM-DD> --from=<path of the installer>`
  copies the file into `site/downloads/` under the public name, measures it, computes the SHA-256 and puts the row
  first in its list. A row with the same platform and version is refused unless `--replace`. `--remove` takes a row
  (and its file) out. It never touches the source file.
* The builder refuses to build (and so the staging refuses to stage) when a listed file is missing or its size or
  SHA-256 differs; it copies the files to `about/files/`. `--check` reports the same problems.
* For this task: add the three installers of 2026-11-13 from `C:\Users\AVI\Projects\Your Personal Diary - installers`
  (read-only for you): the Windows setup exe, the Android apk and the Mac dmg, version 1.0.0, date 2026-11-13, and
  check each SHA-256 against `SHA256 - 1.0.0 - 2026-11-13.txt` in that folder.
* The sizes are shown in megabytes with one decimal, formatted for the page's language.
* Publishing a new version later = build the installers, run `add-download.mjs` three times, deploy. `site/README.md`
  explains it for a developer; `docs/HANDOVER.he.md` explains it to the owner in plain Hebrew (he asked: "how can I
  upload new version files to this site?").

The hosted image grows by the installers (about 15 MB per version kept). The page is still hosted-only: nothing of
the site is written into `public/`, `dist/` or any client bundle (version 1's staging at `ui/about/**` stays).

## 5. The contact form

The form is plain HTML and works without script:

```html
<form method="post" action="/api/contact"> first name, last name, e-mail, message, Send </form>
```

(`action` is the one absolute path of the site; when the domain is connected the server will answer it there too.)

Fields (all required, each with a visible `<label>`): `firstName` (`autocomplete="given-name"`, max 80),
`lastName` (`autocomplete="family-name"`, max 80), `email` (`type="email"`, `autocomplete="email"`, max 254),
`message` (a `<textarea>`, max 5000). Hidden: `lang` (the page's locale) and a honeypot text field named `website`
(kept out of sight and out of the tab order, `autocomplete="off"`, `aria-hidden` wrapper; a human leaves it
empty). Under the fields, before the button, one short notice: what is sent, to whom and why, with a link to the
Privacy Policy page ("Your name, e-mail address and message are sent to us by e-mail so that we can answer you.
They are not stored on the server.").

**The server side** (new, hosted mode only; the local server answers 404): `POST /api/contact`,
`application/x-www-form-urlencoded`, body limit 64 KB (a browser writes a non-ASCII character as 6 or 9 bytes, so
the longest form - 5000 characters of Chinese - is about 47 KB). It always answers **303** with a `Location` inside the site:
`/about/[<lang>/]contact/sent/` or `/about/[<lang>/]contact/error/` (`lang` is taken only from the list of the 20
locales; anything else means English). JSON clients are not served. Rules:

* Honeypot filled: answer "sent" and send nothing.
* Validation (trimmed values; the lengths above; no control characters; names without line breaks; the address
  must pass `isMailAddress` of `server/src/mail/mime.ts`): otherwise "error".
* `Origin` (or, when there is none, `Referer`) present and not the server's own public origin: "error", nothing
  sent. Both absent: accepted. `Origin: null` counts as the own origin only together with `Sec-Fetch-Site:
  same-origin` (the pages send their real origin: `<meta name="referrer" content="same-origin">`), and a
  `Sec-Fetch-Site` other than `same-origin` is another site.
* Limits, in memory only: 3 messages per client address per hour and 10 per day (the client address as the
  existing limiters take it - `DIARY_CLIENT_IP_HEADER`), and 100 messages per day for the whole server. Over a
  limit: "error". The counters hold no address longer than 24 hours and are bounded in size.
* Mail not ready (`MailService.ready()` false), or the switch `DIARY_CONTACT_FORM=off`: "error".
* Otherwise one e-mail through the existing `MailService`, to the contact address of `legal/settings.json`
  (`contactEmail`), with the visitor's address as `Reply-To` (a new optional field of `MailContent`; every header
  value goes through the existing safe encoders - no header injection). Subject: `Contact form: <first> <last>`
  (cut to a sane length). Body, plain text and a small HTML part with everything escaped: the two names, the
  address, the page language, the time (UTC), the message. Sending failed: "error".
* Nothing of a message is stored on the server or written to the log; the log gets one line per outcome without
  any personal data ("contact form: message sent", "contact form: refused (rate limit)", ...).
* The endpoint needs no session and sets no cookie.

`scripts/check-no-network.mjs` must stay green: the route uses the mail service, it imports no socket code.
`docs/API.md` documents the endpoint; `docs/HOSTED-RUNBOOK.he.md` gets a short section (what the form does, the
limits, the switch, what the owner sees in his mailbox, that mail must be set up in the "E-mail" card).

**Privacy policy.** The form collects personal data, so the policy must say so before the form goes live. Add to
`legal/privacy/privacy-en.md` (and, translated, to the other 19): in section 2 or 3, a short item "The contact
form on our website" - the first name, last name, e-mail address and message you type are sent to our mailbox by
e-mail and are not stored on the server; we use them only to answer you and keep the correspondence in the mailbox
for as long as it is needed for that; the server counts requests per network address in its memory as it does for
the other functions; legal basis: our legitimate interest in answering you (Article 6(1)(f)) - and in section 6
add the contact-form messages to what Google (Gmail) receives. Keep the style of the document. Do not change
`legal/settings.json` (the main session sets the new effective date and regenerates `public/` at the end).

## 6. `site/settings.json`

```json
{
  "siteBaseUrl": null,
  "copyrightYear": 2026,
  "links": { "googlePlay": null, "appStoreIphone": null, "appStoreMac": null, "microsoftStore": null }
}
```

* `siteBaseUrl`: `null` = `<server>/about/`; later the owner's domain (`https://example.org/`). Used only for the
  absolute URLs named in section 1. Validated: `https:`, ends with `/`.
* `links`: as in version 1 (https only, the store's own host). A set link is shown on the Downloads page.
* The publisher, the contact e-mail and the minimum age come from `legal/settings.json`.

## 7. The texts: `site/content/site-<locale>.json`

Same rules as version 1 (one JSON object per locale, plain text, the same keys and array lengths as English, the
placeholders `{{BRAND}}`, `{{MINIMUM_AGE}}`, `{{PUBLISHER_NAME}}`, `{{CONTACT_EMAIL}}`, the marker key `_status` with
`TODO-TRANSLATE` for a file - or, new, for single keys, see below). New in version 2:

* New key groups: `nav` (the menu texts and the menu's label; since 2026-11-22 with `nav.home` - the usual word of
  the language for the home page of a web site - first after the label), `contact` (heading, lead, the four field labels,
  the notice, the button, the two result pages' headings and texts, "Back to the home page"), `downloads` (heading,
  lead, the three tab names, the tab list's label, the three column headings, the table captions, the requirement
  and install notes of each platform, "Check the file", the web and iPhone lines, the store link texts), `faq`
  (heading, the group headings, 30 items of q/a), `footer` (the language label, "Change", "All rights reserved.",
  the label of the list of language links), `legal` (the two page titles as menu texts are in `nav`; here only what the frame
  needs around a legal document, if anything). Keys of version 1 that no page uses any more are removed
  (`get.*` that moved to `downloads`, the old `footer.*`).
* **Links inside a text**: `[[target|link text]]`, where target is one of `privacy`, `terms`, `faq`, `downloads`,
  `home`, `support`, `delete`, `webapp`, `contact`. The builder turns it into a link (relative inside the site; the
  standalone page of the same language for `support` and `delete`; the web app for `webapp`; `#contact` for
  `contact`). A locale must use the same targets as English in the same key; the link text is translated.
* **Keeping the 15 translations of version 1.** For every key whose English text did not change, the existing
  translation stays untouched. For every key that is new or whose English text changed, the base writer puts the
  new English text into the 19 other files **and lists the key in that file's `_status` entry**: `_status` becomes
  an object `{ "marker": "TODO-TRANSLATE", "keys": ["nav.about", "faq.items.7.q", ...] }` (for the four files that
  were never translated - `zh`, `ja`, `hi`, `th` - `"keys": "all"`). A translator translates exactly the listed
  keys and deletes `_status` when the file is done. `--strict` refuses a file that still has `_status`.

**English first.** The English file is final before any translation starts. Tone as in version 1: plain, calm,
concrete, honest; short sentences; no marketing cliches, no exclamation marks, no medical promises, no
superlatives, never "end-to-end", no claim about a store that has not published the app. Sources for facts: the
store listings (`play/listing/en-US/full.txt`, `appstore/listing/`, `store/listing/`), `legal/**-en.md`,
`appstore/ANSWERS.he.md`, `docs/apple-tasks/APPSTORE-FACTS.md`, and the app itself (`shared/i18n/messages/en/`).

## 8. Script and style

* `site.css`: one stylesheet for all pages (the design of version 1: colours from `src/styles/tokens.css`, light
  and dark by `prefers-color-scheme`, logical properties only, the legal pages' font stack, no animation).
* `site.js`: one small file, loaded with `defer`; no dependency, no network call (`fetch`, `XMLHttpRequest`,
  `WebSocket`, `import(` and URL literals are forbidden in it - a test checks), no storage, no cookie. It does two
  things: the language button and the Downloads tabs. Every page works without it.
* The server's Content-Security-Policy (`script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self'
  data:`, `form-action 'self'`) allows all of this; no inline script, no inline event handler, no `style=`
  attribute.
* Accessibility is a first-class requirement, as everywhere in this product (people who use a screen reader are
  among its first users - test with the accessibility tree, not only by eye): WCAG 2.2 AA; one `<h1>` per
  page and headings in order; landmarks with labels; every control reachable and operable by keyboard, with a
  visible focus ring; targets at least 44 x 44 CSS px; contrast at least 4.5:1 in both themes (computed in a test);
  tables with `<caption>` and `scope`; form fields with labels, `autocomplete` and `required`; `lang` and `dir` on
  `<html>`, right to left for `he` and `ar` with every Latin fragment isolated in `<bdi>`; nothing that moves.
* Budget: the HTML of a page under 60 KB, the two legal pages under 160 KB; `site.css` under 40 KB; `site.js`
  under 8 KB.
* Head of every page: `<title>`, description, canonical, the `hreflang` alternates of the same page in the 20
  locales + `x-default`, Open Graph, `color-scheme`, the icon. The result pages: `noindex`.

## 9. Tests and gates

The site tests (`scripts/site/*.test.mjs`, run by `node --test "scripts/**/*.test.mjs"`) keep everything version 1
tested and add: the 160 pages exist; every relative link and every `[[target|...]]` resolves to a page of the same
locale that exists in the tree; the tree works when moved to the root (no link starts with `/about/` or `/`,
except the form's action and absolute URLs); the menu has the seven items and exactly one `aria-current`; the
home page is the brand block and one hero, the About page has its three sections, and the logo of every page
leads to the home page; no text in any language says that a file is not signed; the
contact block is on every page except the result pages, with the six controls, labels, `autocomplete`, `maxlength`
and the hidden fields; the language chooser has 20 options in the fixed order and the right one selected; exactly
30 questions; the download tables match `site/downloads.json` (file, version, size, SHA-256) and every file in
`about/files/` has the listed size and hash; `add-download.mjs` on a scratch tree (add, refuse a duplicate,
`--replace`, `--remove`, a wrong hash is caught by the build); `site.js` passes the forbidden-pattern check and its
two behaviours are tested (with `node:test` and a minimal DOM double, or by pure functions - no new dependency);
the legal pages inside the site contain the whole document (every heading of the source) and the standalone
canonical, and in every language the "Mac app" item of the policy says nothing about Apple's signature (the
owner's decision of 2026-11-23, `legal/README.md`); the staged image contains `ui/about/` with the files, and no
client bundle does.

Server tests (vitest, `server/test`): the contact endpoint - a good message is sent once with the right
recipient, `Reply-To`, subject and escaped body (the test transport captures it); honeypot; each validation rule;
header-injection attempts (CR/LF in names, in the address, in `lang`); a foreign `Origin`; each of the three
limits and their reset; mail not ready; the switch; the 303 targets for every locale and for a bad `lang`; the
local (non-hosted) server answers 404; the log lines carry no personal data. The static test of version 1 is
extended to the new pages, `site.css`, `site.js` and one installer (its content type and that it is served whole).

Keep green, one suite at a time: `npx tsc --noEmit` (root and `server/`), root vitest, server vitest, `npm run
mobile:test`, `node --test "scripts/**/*.test.mjs"`, `node scripts/check-no-network.mjs`,
`node scripts/legal/build-pages.mjs --check --strict` (after `public/` is regenerated at the end),
`node scripts/site/build-site.mjs --check --strict`.

## 10. Not in this task

Deploying; the new effective date of the privacy policy and regenerating `public/`; the store kits; connecting a
domain (the host check, `siteBaseUrl`); a link from the app's sign-in screen; an upload screen for the owner; a
release-signed Android file (the owner has not created his signing key yet - the file on the site is the build he
installs today).
