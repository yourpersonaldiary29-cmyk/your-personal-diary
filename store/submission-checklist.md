# Submission checklist - Your Personal Diary in the Microsoft Store (MSIX)

Every Partner Center section in the order it appears, the file to paste from, and the limit of each field.
Rewritten 2026-10-27 for the current app: a client of the Your Personal Diary server
(`https://yourpersonaldiary.fly.dev`) with sync between devices and the automatic offline mode.

Before you start, run `node store/render.mjs` and paste from **`store/out/`** - those copies have the publisher
name and the contact e-mail filled in (from `store/config.json`; copy `store/config.example.json`, which already
holds the owner's values). The same run writes plain-text copies that open in Notepad into `store/out/txt/` (this
checklist, the age-rating answers, and the two paste-ready blocks of the certification notes as
`certification-notes-A.txt` and `certification-notes-B.txt`) and the owner's Hebrew guide as a web page,
`store/out/STORE-RELEASE.he.html` (the guide itself: `docs/STORE-RELEASE.he.md`).

Owner decisions (2026-10-26/27): 20 listing languages, **English is the default** (a customer whose language has
no listing sees English); one listing per language with its own screenshots; the brand "Your Personal Diary" stays
English everywhere; publisher "Ouriel Sebag"; support contact yourpersonaldiary29@gmail.com; privacy policy
https://yourpersonaldiary.fly.dev/privacy/ ; free, no in-app purchases, no ads.

## Limits and actual lengths

Checked by `node scripts/store/check-listing.mjs` (also `node store/render.mjs --check`), which counts UTF-16 code
units (the stricter count - Microsoft does not say how it counts) after filling the placeholders. Measured
2026-10-27.

| Field (file in `store/listing/<tag>/`) | Store limit | en-US | he-IL |
| --- | --- | --- | --- |
| Product name (`title.txt`) | the reserved name, exactly "Your Personal Diary" in every language | 19 | 19 |
| Short description (`short-description.txt`) | 1,000 characters; keep it under 270 (only the first 270 are shown in some views); one paragraph | 242 | 202 |
| Description (`description.txt`) | 10,000 characters, plain text, no HTML, no URLs; the first paragraph says that an account on the server and an internet connection are needed | 3,874 | 3,026 |
| What's new in this version (`whats-new.txt`) | 1,500 characters - **leave blank on the first submission** | 263 | 198 |
| Product features (`features.txt`) | up to 20 features, 200 characters each, no own bullets | 20, longest 99 | 20, longest 83 |
| Search terms (`keywords.txt`) | up to 7 terms, 40 characters each, 21 words in total, unique, relevant, no price terms | 7, longest 15, 12 words | 7, longest 12, 14 words |
| Copyright and trademark info (`copyright.txt`) | 200 characters | 41 | 39 |
| Support contact info (`support-contact.txt`, Properties page) | the contact e-mail, the same in every language | 29 | 29 |
| Screenshot caption (`store/screenshots/captions.json`) | 200 characters each | see that file | see that file |
| Desktop screenshots (`store/screenshots/<tag>/`) | PNG, 1366 x 768 or larger (4K supported), at most 10 per language, 50 MB each | see `store/screenshots/README.md` | |

### Sources (quoted; read 2026-10-27 unless marked)

- "Add and edit Store listing info for MSIX app" (updated 2026-08-24) - https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/add-and-edit-store-listing-info
  - "The minimum required for the Store listings step to be considered complete is a text description and at least one screenshot."
  - "You must complete the Store listing page for at least one language. We recommend providing a Store listing in each language that your packages support, but you have flexibility to remove languages".
  - Description: "This field is required, and will accept up to 10,000 characters of plain text."
  - What's new: "If this is the first time you're submitting your app, leave this field blank. ... This field has a 1500 character limit."
  - Product features: "no more than 200 characters) per feature. You may include up to 20 features." - "don't add your own bullets."
  - Short description: "keep your short description under 270 characters. The field has a 1000 character limit".
  - Short title 50, Sort title 255, Voice title 255 characters (not used); Additional system requirements: "up to 11 items ... no more than 200 characters" (not used).
  - "Do not include HTML, code snippets, or URLs in the description field. Instead, provide support, privacy policy, and website links in their designated submission fields."
- "Store listing" (Partner Center, games page, updated 2026-09-09; the apps page no longer lists these fields) - https://learn.microsoft.com/en-us/gaming/game-publishing/concepts/store-listing
  - Keywords: "up to seven search terms with a maximum of 40 characters each, and can use no more than 21 separate words across all search terms."
  - "Copyright and trademark info ... This field has a 200-character limit."; "Developed by ... 255-character limit" (not used).
- Microsoft Store Policies 7.20 (updated 2026-09-15) - https://learn.microsoft.com/en-us/windows/apps/publish/store-policies
  - 10.1.1: metadata "should accurately describe the functions, features, user experience and any important limitations of your product"; the title "must not contain marketing or descriptive text".
  - 10.1.3: search terms "Not exceed seven unique terms or phrases", "Be relevant to your product", "Not include pricing terms".
  - 10.2.4: "Your product may depend on non-integrated software (such as another product, module, or service) to deliver its primary functionality if you disclose the dependency at the beginning of the description in metadata." - hence the first paragraph of `description.txt`.
  - 10.3.1: "If your product requires login credentials, provide us with a working demo account using the Notes for certification field." - the app requires signing in, so the demo account is required (section 0). 10.3.2: "If your product requires access to a server, the server must be functional".
- "Import and export Store listings for your MSIX app" (updated 2026-03-06) - https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/import-and-export-store-listings (see "Listings by CSV" below).
- "App package requirements for MSIX app", Supported languages (updated 2026-08-24) - https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements#supported-languages - all 20 tags are on the list (en-us, he-il, zh-cn, es-es, pl-pl, ru-ru, fr-fr, ar-sa, ja-jp, tr-tr, cs-cz, hu-hu, bg-bg, el-gr, pt-pt, de-de, ro-ro, it-it, th-th, hi-in). Portuguese is pt-PT because the app's Portuguese is European (`shared/i18n/locales.ts`).
- "App screenshots, images, and trailers for MSIX app" (updated 2026-08-24) - https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images
  - "up to 10 desktop screenshots"; "Each screenshot must be a .png file ... the file size can't be larger than 50 MB"; "Desktop 1366 x 768 pixels or larger. Supports 4K images"; "a short caption that describes each screenshot in 200 characters or less"; "You'll need to upload images for each language separately".
- "Categories and subcategories for MSIX app" (updated 2026-05-27) - https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/categories-and-subcategories
  - Productivity: "Apps which help user to complete a particular task more efficiently" - examples include "note-taking". Medical: "health information management or health records of patients" (not this app).
- "Manage submission options for MSIX app" (updated 2026-08-17) - https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/manage-submission-options
  - "If your app requires users to log in to a service or social media account, provide the user name and password for a test account."; "For each capability, tell us why your app needs to declare the capability and how it is used."
- Privacy, support info, age ratings, product declarations: quoted in `store/policy/partner-center-privacy.md` (read 2026-10-26).
- Developer account - https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account (quoted 2026-10-02: "there are no registration fees for either account type"; identity check "with a government-issued ID and selfie").

## 0. Before Partner Center

- [ ] Developer account opened at https://storedeveloper.microsoft.com (Individual), publisher display name **Ouriel Sebag**.
- [ ] Name "Your Personal Diary" reserved (Partner Center > Apps and games > New product > MSIX or PWA app).
- [ ] The three identity values copied from **Product management > Product identity** into `store/identity.json` (see `store/MSIX-BUILD.md`), and the Store `.msix` built from them (version **1.0.0.0** for the first submission).
- [ ] The privacy policy is live: open https://yourpersonaldiary.fly.dev/privacy/ and check that no `{{...}}` is left.
- [ ] The demo account exists (**required**, policy 10.3.1): in the Store build, **Sign up** (this also proves that
      registration is open - no invite code), then Settings > Data > **Load sample data**. Only you keep its password;
      how and why: `store/certification-notes.md`, "The demo account". Testers cannot rely on registering
      themselves: the server allows 5 registration attempts per hour per network, and an e-mail address only once.
- [ ] `store/config.json` exists (a copy of `store/config.example.json`) and `node store/render.mjs` runs without errors.
- [ ] `node scripts/store/check-listing.mjs` passes for all 20 languages (until the translations are in, see section 6).

## 1. Product setup

- [ ] Product type: **MSIX or PWA app**. Name: `Your Personal Diary`.

## 2. Pricing and availability

| Field | Value |
| --- | --- |
| Markets | All markets (leave every market selected) |
| Audience / visibility | Public - available and discoverable in the Store |
| Schedule | As soon as possible after certification, no end date |
| Base price | **Free** |
| Free trial / Sale pricing | None |
| Organizational licensing | Leave the defaults |

## 3. Properties

| Field | Value | Paste from |
| --- | --- | --- |
| Category | **Productivity** (no subcategory exists) | - |
| Secondary category (optional) | **Lifestyle** | - |
| Does this product access, collect or transmit personal information? | **Yes** | `store/policy/partner-center-privacy.md` section 1 |
| Privacy policy URL | **https://yourpersonaldiary.fly.dev/privacy/** | - |
| Website | **https://yourpersonaldiary.fly.dev/** | - |
| Support contact info | the contact e-mail | `store/out/listing/en-US/support-contact.txt` |
| Phone number and address | as Partner Center asks; optional for individual developers | - |
| Display mode | leave every box unchecked | - |
| System requirements | Keyboard: recommended. Mouse: recommended. Nothing "required". Leave memory, DirectX, video memory and processor empty. (The internet requirement is in the first paragraph of the description.) | - |

Why Productivity: a diary is note-taking and personal organisation, which is how the Store describes this category.
Do **not** choose Medical or Health + fitness: the app is not a medical tool and says so in the listing and the
privacy policy.

Product declarations (the reasons are in `store/policy/partner-center-privacy.md` section 2):

| Declaration | Value |
| --- | --- |
| This product allows users to make purchases, but does not use the Microsoft Store commerce system | unchecked |
| This product has been tested to meet accessibility guidelines | **unchecked** until Microsoft's full list (Narrator, Magnifier, On-Screen Keyboard, High Contrast, High DPI, Inspect...) has been run |
| Customers can install this product to alternate drives or removable storage | checked (default) |
| Windows can include this product's data in automatic backups to OneDrive | **uncheck** |
| Customers can use Windows features to record and broadcast clips of this game | unchecked (not a game) |
| This product supports pen and ink input | unchecked |
| This product incorporates generative AI features | **No** (insights, statistics and search answers come from fixed rules) |

## 4. Age ratings

- [ ] Preferred: enter the **IARC rating ID** from the Google Play certificate e-mail. Otherwise answer the
      questionnaire from `store/out/txt/age-rating-answers.txt` (source: `store/age-rating-answers.md`), then
      **Save and generate**. Expected: all ages (ESRB Everyone, PEGI 3, IARC 3+).

## 5. Packages

- [ ] Upload the Store `.msix` built with the identity from `store/identity.json` (how: `store/MSIX-BUILD.md`).
- [ ] The version has four parts and ends in `.0` - **1.0.0.0** for the first submission.
- [ ] Device families: Windows 10/11 Desktop only.
- [ ] If the page shows an error about Name / Publisher, the identity values in the package do not match
      **Product identity** - copy them again and rebuild.
- [ ] Partner Center now lists the package's 20 languages for the listings.

## 6. Store listings

The package declares 20 languages and each gets its own listing, from `store/out/listing/<tag>/` (the translated
texts) and `store/screenshots/<tag>/` (the screenshots in that language). English (United States) is the default.
`store/out/` is a copy: run `node store/render.mjs` again after any change under `store/listing/`, and check that
`store/out/listing/` has all 20 folders.

- [ ] While some translations are missing (`node scripts/store/check-listing.mjs` lists them as "language folder
      missing"): either wait, or under **Add/remove languages** click **Remove** for each language that has no
      folder yet - customers in those languages then see the English listing - and add them back in a later
      submission. Every listing needs a description and at least one screenshot.
- [ ] Fill each language by hand (the table) **or** all at once with the CSV import (next section).

| Partner Center field | File in `store/out/listing/<tag>/` | Note |
| --- | --- | --- |
| Product name | `title.txt` | A drop-down; choose "Your Personal Diary". |
| Description | `description.txt` | Required. Plain text, paste the whole file. |
| What's new in this version | `whats-new.txt` | **First submission: leave empty.** Use the file from the first update on. |
| Product features | `features.txt` | One line per box, 20 lines. Do not add bullets. |
| Screenshots (Desktop) | `store/screenshots/<tag>/*.png` | In file-name order. Captions: `store/screenshots/captions.json` (guide: `store/screenshots/README.md`). |
| Store logos - 1:1 App tile icon (300 x 300) | `store/screenshots/logos/` | Recommended. |
| Short description | `short-description.txt` | Under "Supplemental fields". |
| Short title, Sort title, Voice title | leave empty | Xbox only. |
| Additional system requirements | leave empty | - |
| Search terms | `keywords.txt` | One line per box, up to 7 lines. |
| Copyright and trademark info | `copyright.txt` | - |
| Additional license terms | leave empty | The Standard Application License Terms apply. |
| Developed by | leave empty | The publisher display name is shown anyway. |

### Listings by CSV (all languages in one import)

Microsoft supports importing all listings from a .csv file (source above: "you have the option to add or update
info by exporting your listings in a .csv file, entering your info and assets, and then importing the updated
file"). Its rows have IDs that only Partner Center knows ("Don't change any of the info in the Field, ID, or Type
columns"), so the file is made from **your own export**:

1. On the app overview page, in **Store listings**, click **Export listing** and save the .csv (for example to
   `store/out/exported-listing.csv`). Do it after the package is uploaded, so the 20 languages are known.
2. Run `node scripts/store/listing-csv.mjs --export store/out/exported-listing.csv --screenshots`. It checks the
   texts, fills Title, Description, ShortDescription, Feature1-20, the search terms and the copyright for every
   language that has a folder (the default column gets English), leaves What's new blank (first submission),
   copies the screenshots into `store/out/listing-import/screenshots/<tag>/` and writes
   `store/out/listing-import/listings.csv`. It never changes Field / ID / Type and never adds a row; anything it
   cannot place is printed as "paste by hand".
3. Partner Center > **Import listings** > **Import folder** > choose `store/out/listing-import` (with
   `--screenshots`; without it: **Import .csv** and choose `listings.csv`). "Make sure there is only one .csv file
   in your folder".
4. If Partner Center shows **View errors**, fix what it names and import again ("None of the info from your .csv
   file will be saved in Partner Center until all of the errors in your file have been resolved").
5. Open two or three languages in Partner Center and look at them once. Support contact info is not part of the
   listing CSV (Properties page).

For an update later: `--whats-new` also fills "What's new"; a new export already contains the screenshot URLs, so
`--screenshots` is needed only when the screenshots changed.

## 7. Submission options

| Field | Value | Paste from |
| --- | --- | --- |
| Publishing hold options | Publish this submission as soon as it passes certification | - |
| Notes for certification | block A, with today's date added as the first line and `[USER NAME]` / `[PASSWORD]` in its last line replaced with the demo account's values (required; typed only in Partner Center) | `store/out/txt/certification-notes-A.txt` |
| Restricted capabilities - runFullTrust | block B | `store/out/txt/certification-notes-B.txt` |

## 8. Submit

- [ ] Every section shows "Complete".
- [ ] **Submit to the Store**.
- [ ] After certification: install from the Store on a second Windows user or PC, create an account, load the
      sample data, switch the language in Settings, disconnect the network once (the offline bar appears, a new
      entry is uploaded after reconnecting) and check that the privacy policy link opens.

## For the translators (the other 18 languages)

Translate from `store/listing/en-US/` into `store/listing/<tag>/` - the same 8 files, UTF-8 without BOM, each
ending with one line break; then run `node scripts/store/check-listing.mjs --only <tag>`. The rules are in
`store/listing/README.md`.
