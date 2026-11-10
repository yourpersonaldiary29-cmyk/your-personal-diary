# LEGAL-DIFF - the English reference for the translators (package LEGAL, base writer, 2026-11-08)

Read docs/apple-tasks/LEGAL.md (your role) and this file completely before touching a locale. The English and
Hebrew files are finished and are the reference: `legal/privacy/privacy-en.md`, `legal/privacy/privacy-he.md`
(how the same changes look in RTL), `legal/support/support-en.md`, `legal/support/support-he.md`.

## 0. What is already in your locale's files (do not be surprised)

So that the build and the tests stayed green while you work, the base writer left **English placeholders marked
`TODO-TRANSLATE`** in the 18 other locales:

1. `legal/privacy/privacy-<locale>.md` section 5: the two new bullets (Mac app, iPhone app) are already inserted
   in English, right after the Android bullet, each starting with `- TODO-TRANSLATE: `. Replace each whole line
   with your translation (keep it one bullet line each, starting with `- **...:**` like the neighbours; remove
   the marker).
2. `legal/support/support-<locale>.md` exists as a copy of the English page: the front matter already has your
   language's `languages` and `otherPage` labels (taken from your deletion page); `title` and `description`
   start with `TODO-TRANSLATE`; the body is English. Rewrite the whole file in your language (same headings,
   same number of `###` questions, same bullets, same links and placeholders).

`node scripts/legal/build-pages.mjs --check --strict` stays red and lists every source that still carries the
marker - yours disappear from the list as you finish; the other translator's stay until he finishes. That is
expected. Use `node scripts/legal/build-pages.mjs` (rebuild public/) and then `--check` to prove that your pages
are in sync; the verifier runs `--check --strict` at the end, when no marker is left anywhere.

Vocabulary: take the feature names from the app's catalogue of your language -
`shared/i18n/messages/<locale>/auth.ts` (`auth.rememberMe` = "Remember me", `auth.forgotPasswordLink` =
"Forgot password?"), `settings.ts` (`settings.title` = "Settings", `settings.language.title` = "Language",
`settings.backup.title` = "Backup", `settings.export.title` = "Export", `settings.reminders.title` =
"Reminders", `settings.deleteAccount.title` = "Delete account"), `shell.ts` (`shell.sync.tryNow` = "Try now").
The brand "Your Personal Diary" stays in Latin letters everywhere. Keep every `{{PLACEHOLDER}}` exactly as in
English. Product names stay as they are: Windows Hello, Touch ID, Face ID, Keychain, iCloud, Android Keystore,
Google Play, Microsoft Store, App Store, Mac App Store, Migration Assistant, Time Machine, Application Support,
app.yourpersonaldiary.mac, "Your Personal Diary offline key" (a keychain item name - do not translate it).

The structure test (`src/components/legal/legal-pages.test.ts`) compares every locale with English: the number
of `#`, `##` and `###` headings, of list items (`- ` and `1. `), of links `](` and the set of placeholders must
be identical. Section numbers and headings stay as they are in your file; only the sentences below change.

## 1. PART 1 - privacy policy, the English sentences before -> after

Apply every item at the same place in your locale. "Before" is the sentence as it stands in every locale today
(translated); "after" is what it must say. Only these sentences change; nothing else in the policy moves.

### (a) Front matter `description`

Before: `How Your Personal Diary (Android app, Windows app and website) stores and protects your data.`

After: `How Your Personal Diary (the Android, Windows, Mac and iPhone apps and the website) stores and protects your data.`

### (a) "In short", first bullet

Before:

> Your Personal Diary is one service with three ways in: the **Android app** (Google Play), the **Windows app** (Microsoft Store or a setup file) and the **website** [{{SITE_URL}}]({{SITE_URL}}). All three use the same server and the same account.

After:

> Your Personal Diary is one service with five ways in: the **Android app** (Google Play), the **Windows app** (Microsoft Store or a setup file), the **Mac app** (a download or the Mac App Store), the **iPhone app** (App Store, when it is published) and the **website** [{{SITE_URL}}]({{SITE_URL}}). All of them use the same server and the same account.

Keep the qualifier "when it is published" for the iPhone app wherever it appears below: the iPhone app does not
exist in the App Store yet, and the policy must stay true before it does.

### (a) Section 1 "Who we are", second paragraph

Before:

> This policy applies to the Android app, the Windows app and the website. They show the same diary and follow the same rules; where an app behaves differently, this policy says so.

After:

> This policy applies to the Android app, the Windows app, the Mac app, the iPhone app (when it is published) and the website. They show the same diary and follow the same rules; where an app behaves differently, this policy says so.

### (b) Section 5 "What is stored on your device", paragraph "Without a connection." - three changes inside it

1. Before: `In the Windows and Android apps, if you chose "Remember me", the app also keeps an encrypted copy ...`

   After: `In the Windows, Mac, Android and iPhone apps, if you chose "Remember me", the app also keeps an encrypted copy ...`

2. Before: `with "Remember me", the Windows and Android apps also keep it on the device, protected by Windows Data Protection or by the Android Keystore, so that the app can open without a connection.`

   After: `with "Remember me", the Windows, Mac, Android and iPhone apps also keep it on the device, protected by Windows Data Protection, by the macOS Keychain, by the Android Keystore or by the iOS Keychain, so that the app can open without a connection.`

3. (g, see below) Directly after the sentence `Your password and your recovery key are never stored on the device.` and before `So that every change is uploaded exactly once, ...` add two sentences:

   > In the apps that keep that key on the device with "Remember me", the app also keeps a copy of it encrypted with a key derived from your password, so that you can unlock the app without a connection by typing your password; the password itself is not stored, and this copy is deleted together with the key - when you sign out, when the sign-in ends, or when the account is deleted. Someone with a copy of this device's data could try to guess your password against that copy, at the same cost as against the server; a strong password is what protects it.

### (b) Section 5, the device list: two new bullets after the Android bullet (already in your file, marked)

> - **Mac app:** these copies are kept in the app's folder inside your user Library (Application Support/app.yourpersonaldiary.mac). The key is kept as an item of your Mac user's login keychain, named "Your Personal Diary offline key" and never synchronized to iCloud Keychain; it is protected by your Mac login password and can be read only by the app. A Migration Assistant or Time Machine copy of your user account carries the item, still protected by that password. Once the app is distributed with Apple's signature, the item will move to the keychain that stays on this Mac only.
> - **iPhone app:** these copies are kept in the app's private storage, excluded from iCloud backup. The key is kept in the iOS Keychain, available only on this device after it was unlocked once, and removed when you sign out.

The order of the bullets is: Windows app, Android app, Mac app, iPhone app, Website.

### (b) Section 5, the screen-lock paragraph

Before:

> If the app offers to unlock with your device's screen lock (Windows Hello, or the Android screen lock or fingerprint), the check is done by the operating system. Nothing about your fingerprint, face or PIN reaches the app or us. Habit reminders in the Android app are scheduled on the phone itself; no push service is involved.

After:

> If the app offers to unlock with your device's screen lock (Windows Hello, Touch ID or the Mac password, Face ID / Touch ID or the iPhone passcode, or the Android screen lock or fingerprint), the check is done by the operating system. Nothing about your fingerprint, face or PIN reaches the app or us. Habit reminders in the Android and iPhone apps are scheduled on the device itself; no push service is involved.

### (c) Section 6 "Who else receives data", the app stores paragraph

Before:

> The app stores also process data under their own privacy policies when you download the apps: **Google Play** for the Android app and the **Microsoft Store** for the Windows app (for example installations, ratings and crash reports that their systems collect). The apps contain no code from them or from anyone else that sends data to them.

After:

> The app stores also process data under their own privacy policies when you download the apps: **Google Play** for the Android app, the **Microsoft Store** for the Windows app, and the **App Store** and the **Mac App Store** (Apple) for the iPhone and Mac apps (for example installations, ratings and crash reports that their systems collect). The apps contain no code from them or from anyone else that sends data to them.

### (d) Section 7, the bullet "Uninstalling the app does not delete your account." - two sentences appended at its end

After the sentence `On Windows, uninstalling the downloaded (setup file) version keeps the encrypted copy unless you choose to delete the application data; sign out first to be sure.` add:

> On a Mac, moving the app to the Bin keeps the encrypted copies in your Library and the key in your keychain until you sign out or delete them; sign out first. Deleting the iPhone app removes its storage; the keychain item is removed when you sign out - sign out first to be sure.

### (e) Section 8 "Security measures", last bullet

Before: `Someone who can run programs as your Windows user, or who has full control of a rooted phone, could read the copy kept for "Remember me".`

After: `Someone who can run programs as your Windows or Mac user, or who has full control of a rooted or jailbroken phone, could read the copy kept for "Remember me".`

### (f) `legal/settings.json`

`effectiveDate` is `2026-11-08` (done by the base writer; nothing for translators - the date is printed by the generator in every language).

### (g) The offline unlock by password (source: docs/apple-tasks/LEGAL-FOLLOWUP.md, owner decision 2026-11-08)

The two sentences of (b) item 3 come from the OFFLINE-PASSWORD package, which implemented the feature
(`src/offline/engine.ts`, `password-wrap`): with "Remember me", the lock screen also accepts the diary password
without a connection. LEGAL-FOLLOWUP.md asked the LEGAL translators to carry them into the other languages, so
they are part of this diff. The Hebrew wording is in that file and in `privacy-he.md`.

## 2. PART 2 - the complete English support page (legal/support/support-en.md)

Translate it whole (front matter and body). Front matter: `title` (keep "Your Personal Diary" in Latin letters,
the word "Support" in your language), `description`, `languages` and `otherPage` (your file already has the
right labels for the last two). The body has: one intro paragraph (operator + e-mail - Apple requires the
contact details near the top), `## 1.`, `## 2.` with nine `###` questions, `## 3.` with two bullets, `## 4.`.
Seven links in all; placeholders PUBLISHER_NAME, CONTACT_EMAIL, DELETE_URL, SITE_URL, PRIVACY_URL.

```markdown
---
title: Support - Your Personal Diary
description: Help with Your Personal Diary - how to contact us, and answers to frequent questions about passwords, signing in, working without a connection, languages, your data and your account.
languages: Languages
otherPage: Privacy policy
---

# Support - Your Personal Diary

Your Personal Diary is operated by {{PUBLISHER_NAME}}. Contact: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}).

## 1. How to contact us

Write to [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}). We answer within 30 days, usually much sooner. For anything about your account, write from the e-mail address registered in that account, so that we can tell it is you. Never send your password: we never ask for it, and we do not need it to help you.

## 2. Frequent questions

### I forgot my password

On the sign-in screen choose **Forgot password?** and enter the e-mail address you registered with. A message with a link and a 6-digit code is sent from the operator's own e-mail address; if it does not arrive within a few minutes, check the spam folder. The link and the code are valid for 30 minutes and can be used once. Your diary is kept: choosing a new password deletes nothing.

### I cannot sign in, or the app says "too many attempts"

Check the user name or e-mail address and the password (mind the keyboard language and capital letters). After 10 wrong passwords, sign-in from your network is locked for 15 minutes; wait, then try again. If you no longer know the password, use **Forgot password?**. If the app says there is no connection, see the next question.

### The app says there is no connection

The app needs the server to sign in, to search, for statistics and insights, for backups and exports, and for changes to your account. Without a connection you can still write: what you write is saved on your device, encrypted, and uploaded when the connection returns, even if the app was closed in between. If you chose **Remember me**, the Windows, Mac, Android and iPhone apps also open your recent entries, habits and today's data from the encrypted copy on the device; you unlock them with your password or with the device's screen lock (Windows Hello, Touch ID, Face ID or the phone's screen lock). Check the device's internet connection, then choose **Try now** in the app.

### How do I change the language?

Open **Settings** and, in the **Language** card, choose the interface language from the list; the whole diary switches at once. Before you sign in, the choice is kept on this device; after you sign in it is saved to your account, so your other devices follow it. The diary has 20 languages.

### How do I get my data out?

In **Settings - Backup** you can create a **backup**: an encrypted copy of the whole diary (entries, habits and settings) in the app's own format, protected by a password, which you can restore later in the app. The **export** on the same page writes your entries as a readable file - TXT, CSV, JSON or PDF - for reading, printing or another program. An export file is not encrypted: anyone who has the file can read it, so keep it as carefully as the diary itself.

### How do I delete my account?

Sign in, open **Settings** and go to the last card, **Delete account**: enter your password and confirm. This deletes your account, your diary, habits and settings from the server at once and signs you out on every device; it cannot be undone, and backup files you saved yourself are not touched. If you cannot sign in, follow the steps on the account-deletion page: [{{DELETE_URL}}]({{DELETE_URL}}).

### On which devices can I use the diary?

In the apps for **Windows**, **Mac**, **Android** and **iPhone** (when it is published), and on the website [{{SITE_URL}}]({{SITE_URL}}) in any browser. It is one account everywhere: whatever you write on one device is on all the others as soon as they connect.

### How do reminders work?

Reminders belong to habits: you set the time for each habit on the habits page and turn reminders on in **Settings - Reminders**. On a phone, the app asks for permission to show notifications; if you declined, allow notifications for Your Personal Diary in the phone's settings, otherwise reminders appear only while the app is open. On the computer and in the browser, a reminder appears while the diary is open. Reminders are created on the device itself; nothing is sent out.

### Is the app medical advice?

No. The insights in the app describe possible relationships in your own entries. They do not prove cause and effect and they are not medical or psychological advice. If you are worried about your health or your mood, talk to a doctor or another professional.

## 3. Privacy policy and account deletion

- Privacy policy: [{{PRIVACY_URL}}]({{PRIVACY_URL}}) - what we store, where, and how it is protected.
- Account deletion: [{{DELETE_URL}}]({{DELETE_URL}}) - also for anyone who cannot sign in.

## 4. Operator

{{PUBLISHER_NAME}} - [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}})
```

Facts behind the answers (so that a translation never promises more than the app does): the reset link and
code are valid 30 minutes and once (policy section 2); 10 wrong passwords lock sign-in from that network for
15 minutes (section 8); the server answers search, statistics and insights, backups, exports and account
changes; writing works offline and is uploaded later; reading from the device copy needs "Remember me" in the
four apps, not on the website (section 5); the language card is Settings - Language; backup = encrypted .mpd
file, export = TXT/CSV/JSON/PDF readable by anyone (section 5); account deletion = Settings - Delete account or
the deletion page (section 7); reminders are local notifications (section 5 and the app's reminder texts);
the medical sentence is section 11 of the policy, word for word.

## 3. Checklist per locale (translator)

1. `legal/privacy/privacy-<locale>.md`: items (a) x3, (b) x3 + the two marked bullets, (c), (d), (e); no
   `TODO-TRANSLATE` left; headings, numbering and every other sentence untouched.
2. `legal/support/support-<locale>.md`: the whole page in your language; no `TODO-TRANSLATE` left; the title
   contains "Your Personal Diary"; 1 `#`, 4 `##`, 9 `###`, 2 list items, 7 links, the five placeholders.
3. `node scripts/legal/build-pages.mjs` (writes public/), then `node scripts/legal/build-pages.mjs --check`
   ("63 pages in public/ match the sources"); `--strict` lists only the other translator's remaining files.
4. `npx vitest run src/components/legal/legal-pages.test.ts` green (structure parity against English).
5. Never edit another translator's locale, the en/he files, the script or public/ by hand.
