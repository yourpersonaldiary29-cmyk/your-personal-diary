# TERMS-DIFF - what the translators carry into their languages (TERMS package, 2026-11-08)

Written by the TERMS base writer (docs/apple-tasks/TERMS.md). English is the reference; Hebrew is done and can be
read as a second model (`legal/terms/terms-he.md`, the `he` catalogue lines). Every other app language
(ar, zh, ja, hi, th, es, pt, fr, it, de, ro, el, pl, cs, hu, ru, bg, tr) holds an **English placeholder marked
`TODO-TRANSLATE`** in each place below, so the build and the parity tests pass meanwhile. A translator replaces
the placeholder of his locales and removes the marker; `node scripts/legal/build-pages.mjs --strict` and the
verifier refuse to finish while one marker is left.

Four parts, in this order:

1. the Terms of Use page (`legal/terms/terms-<locale>.md`) - translate it whole;
2. five catalogue keys (`shared/i18n/messages/<locale>/{auth,settings,server}.ts`);
3. the consent sentence of the privacy policy, section 2 (`legal/privacy/privacy-<locale>.md`);
4. the offline-password sentences of the privacy policy, section 5 (docs/apple-tasks/LEGAL-FOLLOWUP.md) - the
   final English and Hebrew wording.

Then: `node scripts/legal/build-pages.mjs` (writes public/), `node scripts/legal/build-pages.mjs --check`, and the
i18n parity test (`npx vitest run shared/i18n`).

## 1. The Terms of Use page - legal/terms/terms-en.md (complete)

Rules for the translation:

- Translate the front matter too: `title` (keep "Your Personal Diary" in Latin letters; the words "Terms of Use"
  in your language), `description`. `languages` and `otherPage` are already right in your placeholder file (they
  are the labels of your support page: "Languages" and the link text of the Privacy Policy).
- Keep **every** heading level and number (`#`, `## In short`, `## 1.` ... `## 15.`), every list item, every link
  and every `{{PLACEHOLDER}}` exactly where English has them: a test compares the shape (h1/h2/h3 count, list
  items, links, placeholder names) with English.
- Keep the sentence your placeholder already has under the effective date - translated: "If a translation differs
  from the English version, the English version applies." (English itself does not carry it.) It is a plain
  paragraph, so it does not change the shape.
- Section 3 ("One account per person") is the owner's own rule: translate its first sentence faithfully and keep
  it **bold**, keep the e-mail link.
- Use the app's own names for what the user sees, from `shared/i18n/messages/<locale>/{auth,settings,shell}.ts`:
  "Remember me" (`auth.rememberMe`), **Settings - Backup** (`settings.backup.title`), **Settings - Delete account**
  (`settings.deleteAccount.title`), and the name your privacy policy uses for "Privacy Policy".
- Address the reader the way your privacy policy does (Hebrew, for example, uses the plural "אתם").
- Section 12 keeps "as is" / "as available" (you may add the English words in brackets, as Hebrew does).
- "the iPhone app (when it is published)" - keep the qualifier.

```markdown
---
title: Terms of Use - Your Personal Diary
description: The rules for using Your Personal Diary (the Windows, Mac and Android apps, the iPhone app when it is published, and the website): who may use it, one account per person, your content, acceptable use, and our responsibilities.
languages: Languages
otherPage: Privacy Policy
---

# Terms of Use - Your Personal Diary

Effective date: {{TERMS_EFFECTIVE_DATE}}

## In short

- Your Personal Diary is a free diary service. Your diary belongs to you.
- You must be at least {{MINIMUM_AGE}} years old, and each person may have **only one account** unless we approve more in writing.
- Keep your password secret, use the service lawfully, and keep a backup of what matters to you.
- The service is provided "as is". It is not medical advice.
- How we handle your data is explained in the Privacy Policy: [{{PRIVACY_URL}}]({{PRIVACY_URL}}).

## 1. Who we are and what these terms cover

Your Personal Diary is operated by {{PUBLISHER_NAME}} ("we", "us"). These Terms of Use apply to the Windows app, the Mac app, the Android app, the iPhone app (when it is published) and the website [{{SITE_URL}}]({{SITE_URL}}) - together, "the service". All of them use the same server and the same account.

By creating an account or using the service, you agree to these terms and to the Privacy Policy [{{PRIVACY_URL}}]({{PRIVACY_URL}}). When you create an account, you confirm this with one checkbox. If you do not agree, please do not use the service.

## 2. Who may use the service

- You must be at least {{MINIMUM_AGE}} years old to create an account.
- If you are a minor where you live, you may use the service only if a parent or guardian agrees, where the law of your country requires it.
- The details you give when you register (name, user name and e-mail address) must be accurate, and the e-mail address must be one that you can receive messages at. You can change them later in Settings.
- We may limit the number of accounts on the server and may pause new registrations at any time, for example to keep the service running well.

## 3. One account per person

**You may open and keep only one account.** Opening or using more than one account is allowed only with the prior written approval of the operator, requested by e-mail at [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}). Accounts opened without it may be closed.

An account is personal: do not share it with others, and do not use another person's account.

## 4. Your account and password

- Keep your password secret and do not use it for other services. Choose a strong one.
- You are responsible for what is done with your account. If you think someone else knows your password or uses your account, change the password at once and tell us at [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}).
- **We never ask for your password** - not by e-mail, not by phone and not in any other way. Anyone who asks for it is not us.
- On a device that other people also use, do not choose "Remember me", and sign out when you finish: with "Remember me" the app keeps you signed in and keeps encrypted copies on the device, as section 5 of the Privacy Policy explains.

## 5. Your content

- What you write in your diary belongs to you. We do not claim any ownership of it.
- We store and process your content only to provide the service to you - to keep it, show it, search it and make it the same on your devices. The Privacy Policy explains how.
- We do not read your diary. Section 4 of the Privacy Policy explains plainly what the operator of the server could technically do, and what we promise.
- You are responsible for what you write. Do not store content that is illegal, or content that belongs to someone else without their permission.
- You can take your content with you at any time: **Settings - Backup** creates an encrypted backup, and the export writes your entries as a readable file. These copies are yours to keep and use.

## 6. Acceptable use

When you use the service, you must not:

- use it for anything unlawful, or to harm, harass or threaten anyone;
- try to break or get around its security, its limits (for example the limits on sign-in attempts) or the protection of other accounts;
- access it with automated means (bots, scripts, scraping), except through the apps and the website as they are offered;
- overload or interfere with the server or with other users;
- resell the service, or offer it or access to it to others;
- copy, decompile or reverse engineer the server, except where the law allows it;
- share your account, or use more than one account without approval (section 3).

## 7. The service

- The service is **free of charge** today. If we ever want to charge for something, we will say so in advance, and nothing becomes paid without your agreement.
- Features may change, be added or be removed over time.
- We aim to keep the service available, but we do not promise that it will always be available or free of errors. Maintenance, updates or problems with the hosting may interrupt it.
- **Keep a backup** of what matters to you (Settings - Backup). We take care of the server and its backups, but we are not liable for lost content beyond what the law requires.
- Working without a connection (the copies on your device and offline mode) is a convenience. It may not be available on every device or at every moment.

## 8. Suspension and closing an account

- We may suspend or close an account that breaks these terms - after a notice where that is reasonably possible - and we may remove content where the law requires it.
- You may close your account at any time: sign in and open **Settings - Delete account**. If you cannot sign in, follow the steps on [{{DELETE_URL}}]({{DELETE_URL}}).
- What happens to your data when an account is closed or deleted is explained in section 7 of the Privacy Policy.

## 9. If the service ends

If we decide to end the service, we will announce it on [{{SITE_URL}}]({{SITE_URL}}) at least 30 days before it ends. During that time, backup and export will remain available, so that you can take your diary with you.

## 10. Not medical advice

The insights in the app describe possible relationships in your own entries. They do not prove cause and effect and they are not medical or psychological advice. If you are worried about your health or your mood, talk to a doctor or another professional.

## 11. Intellectual property

The apps, the website, their texts and their design belong to the operator and may be used only as these terms allow. "Your Personal Diary" is the name of the service. Open-source components included in the apps remain under their own licences.

## 12. Liability and warranty

- To the extent the law permits, the service is provided "as is" and "as available", without warranties of any kind.
- To the extent the law permits, we are not liable for indirect or consequential loss, such as loss of profit or loss of opportunity.
- The rights you have as a consumer under the mandatory law of your country are not affected by these terms.
- Nothing in these terms limits liability that cannot be limited by law.

## 13. Changes to these terms

When the service or these terms change, we update this page and the effective date at the top. Important changes are announced on this page before they apply. If you continue to use the service after a change applies, you accept the new terms; if you do not accept them, you can delete your account at any time (section 8). The version you agreed to when you registered is recorded with your account.

## 14. Disagreements

If you have a complaint or a disagreement with us, please write to us first at [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}) - we will try to settle it by e-mail. Nothing in these terms takes away the rights that the law of the country where you live gives you.

## 15. Contact

Questions about these terms: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}})

{{PUBLISHER_NAME}}

Support and frequent questions: [{{SUPPORT_URL}}]({{SUPPORT_URL}})
```

## 2. Catalogue keys (five, in 20 locales)

The registration form now has ONE checkbox with ONE sentence and TWO links. The sentence replaces the former
`auth.privacyConsent` ("I have read the {policy} and agree to it") and its error replaces
`auth.privacyConsentRequired` - both former keys are gone in all 20 locales (your old wording is still in
`git show HEAD:shared/i18n/messages/<locale>/auth.ts`, which you may read as a model). The marker line
`// TODO-TRANSLATE (docs/apple-tasks/TERMS-DIFF.md): ...` sits above the new keys in each of your three files:
replace the English values and delete the marker line.

| File | Key | English | Hebrew |
| --- | --- | --- | --- |
| auth.ts | `auth.legalConsent` | `I have read the {policy} and the {terms}, and I agree to them` | `קראתי את {policy} ואת {terms} והסכמתי להם` |
| auth.ts | `auth.termsConsentLink` | `Terms of Use` | `תנאי השימוש` |
| auth.ts | `auth.legalConsentRequired` | `To create an account, tick this box to confirm that you have read the Privacy Policy and the Terms of Use and agree to them.` | `כדי ליצור חשבון, יש לסמן את התיבה ובכך לאשר שקראת את מדיניות הפרטיות ואת תנאי השימוש ושהסכמת להם.` |
| settings.ts | `settings.privacy.termsLink` | `Terms of Use` | `תנאי השימוש` |
| server.ts | `server.auth.termsRequired` | `To create an account, confirm that you have read the Terms of Use and agree to them. If you see no box to tick for this, update the app.` | `כדי ליצור חשבון יש לאשר שקראת את תנאי השימוש ושהסכמת להם. אם אין בטופס תיבה לסימון, יש לעדכן את האפליקציה.` |

Notes:

- `auth.legalConsent` MUST keep both placeholders `{policy}` and `{terms}` exactly once each (the parity test
  checks the names; the component cuts the sentence around them). Put them in the order your language needs.
  The links are the two link texts: `{policy}` = `auth.privacyConsentLink` (already translated - check that its
  case/form still fits the new sentence and adjust it if needed), `{terms}` = `auth.termsConsentLink` (word it for
  the place it takes in the sentence). One sentence, past or present tense, gender-neutral where your language
  allows it (Hebrew uses the past tense "קראתי ... והסכמתי" for that reason).
- `auth.legalConsentRequired` names both documents; follow the pattern of your former `auth.privacyConsentRequired`.
- `settings.privacy.termsLink` is the link under "Privacy policy" in the Settings -> Privacy card (a label, title
  case as your `settings.privacy.policyLink`).
- `server.auth.termsRequired` follows your `server.auth.privacyRequired` sentence right above it (an app built
  before the Terms of Use existed gets it: it says to update the app).
- English `auth.privacyConsentLink` became "Privacy Policy" (capital P, as the brief's sentence); that is an
  English-only change.

## 3. The consent sentence of the privacy policy, section 2 ("Account details")

Change only this sentence in `legal/privacy/privacy-<locale>.md`; English and Hebrew are done.

English before:

> When you create the account, we also keep a record of your confirmation that you have read this policy and agree to it: the time and the effective date of the version you confirmed.

English after:

> When you create the account, we also keep a record of your confirmation that you have read this policy and the Terms of Use and agree to them: the time and the effective dates of the versions you confirmed.

Hebrew before:

> ביצירת החשבון נשמר גם תיעוד של אישורכם שקראתם את המדיניות הזו ושאתם מסכימים לה: מועד האישור ותאריך התחולה של הגרסה שאישרתם.

Hebrew after:

> ביצירת החשבון נשמר גם תיעוד של אישורכם שקראתם את המדיניות הזו ואת תנאי השימוש ושאתם מסכימים להם: מועד האישור ותאריכי התחולה של הגרסאות שאישרתם.

Use the name of the Terms of Use your terms page uses (its `title`).

## 4. The offline unlock by password - privacy policy section 5, paragraph "Without a connection"

Source: docs/apple-tasks/LEGAL-FOLLOWUP.md (OFFLINE-PASSWORD package, owner decision 2026-11-08). The LEGAL base
writer placed both sentences in English and Hebrew directly after "Your password and your recovery key are never
stored on the device." (unchanged, stays in place). The TERMS base writer has now aligned the second sentence with
LEGAL-FOLLOWUP's recommended wording: it says again that the copy on the device can be tried **without a limit on
the number of tries** (the server limits tries; a copy does not). The words "without needing your device
account" of LEGAL-FOLLOWUP are part of the final text (fixer pass, verifier finding): the password-wrapped copy
is kept as plain JSON in the app's IndexedDB (`meta.passwordWrap`, src/offline/engine.ts
`rememberPasswordWrap`, src/offline/password-wrap.ts), NOT behind Windows DPAPI or the Keychain - it cannot be,
because it is what yields the key. Whoever has a copy of the profile or the disk (a backup, a Time Machine copy, a
disk image) can attack it by guessing passwords alone, without the Windows/Mac user account. (An earlier draft of
this file left the words out for the opposite, wrong reason.) Translate these two sentences - the final text -
into your language, in the register of the surrounding paragraph. Nothing else in section 5 changes.

English (final, in legal/privacy/privacy-en.md):

> In the apps that keep that key on the device with "Remember me", the app also keeps a copy of it encrypted with a key derived from your password, so that you can unlock the app without a connection by typing your password; the password itself is not stored, and this copy is deleted together with the key - when you sign out, when the sign-in ends, or when the account is deleted. Someone with a copy of this device's data could try to guess your password against that copy without needing your device account, each guess costing as much as against the server but with no limit on the number of tries; a strong password is what protects it.

Hebrew (final, in legal/privacy/privacy-he.md):

> באפליקציות ששומרות את המפתח הזה במכשיר עם "זכור אותי", האפליקציה שומרת גם עותק שלו, מוצפן במפתח שנגזר מהסיסמה שלכם, כדי שתוכלו לבטל את נעילת האפליקציה בלי חיבור על ידי הקלדת הסיסמה; הסיסמה עצמה לא נשמרת, והעותק הזה נמחק יחד עם המפתח - בהתנתקות, כשהחיבור לחשבון מסתיים או כשהחשבון נמחק. מי שבידיו העתק של נתוני המכשיר הזה יכול לנסות לנחש מולו את הסיסמה שלכם גם בלי חשבון המשתמש של המכשיר, כשכל ניחוש עולה כמו מול השרת אבל בלי הגבלה על מספר הניסיונות; סיסמה חזקה היא מה שמגן עליו.

## 5. What else changed (no translation needed)

- `legal/settings.json` gained `"termsEffectiveDate": "2026-11-12"` (a placeholder: the main session sets it to
  the deploy day, together with `effectiveDate`). The generator prints it at the top of every terms page
  (`{{TERMS_EFFECTIVE_DATE}}`), and the hosted server stores it as `termsVersion` with every new account.
- `scripts/legal/build-pages.mjs` has a fourth kind, `terms` (public/terms/ and public/terms/<locale>/, footer ->
  the Privacy Policy) and the placeholders `{{TERMS_EFFECTIVE_DATE}}` and `{{TERMS_URL}}`.
- The Windows/Mac shell (src-tauri/src/opener.rs) now opens /terms/ and /support/ pages too.

## 6. Fixer pass (verifier findings) - applied in all 20 languages

Already done by the LEGAL/TERMS fixer in every `legal/<kind>/<kind>-<locale>.md`; a later translator or editor
keeps these in place (the shape test compares list items and links with English):

- **Terms, section 2 - the minors sentence** (ENV-FINAL / TERMS.md amendment "MINIMUM AGE", 2026-11-10): a bullet
  right after the age bullet: "If you are a minor where you live, you may use the service only if a parent or
  guardian agrees, where the law of your country requires it." Hebrew (plural): "אם אתם קטינים לפי הדין במקום
  מגוריכם, מותר לכם להשתמש בשירות רק אם הורה או אפוטרופוס מסכימים לכך, כשהחוק במדינה שלכם דורש זאת." It holds
  for any value of `minimumAge`; no number is written.
- **Privacy policy, section 2 - a link to the Terms of Use**: the words "the Terms of Use" in the consent-record
  sentence are a link `[Terms of Use]({{TERMS_URL}})` (the same-language terms page).
- **Support page, section 3** is now "Privacy policy, Terms of Use and account deletion" with a third bullet
  between the two others: "Terms of Use: [{{TERMS_URL}}]({{TERMS_URL}}) - the rules for using the service,
  including one account per person." So every document reaches the terms page: privacy -> terms (body), support ->
  terms (body), terms -> privacy/delete-account/support, delete-account -> privacy.
- **Front-matter `description`** of the policy and the terms (the page's `<meta name="description">`) keeps the
  iPhone qualifier: "(the Android, Windows and Mac apps, the iPhone app when it is published, and the website)";
  the other languages append "; <the iPhone app> <when it is published>" inside the same brackets.
