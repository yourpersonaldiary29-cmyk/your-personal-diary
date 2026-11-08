# Microsoft Store (Partner Center) - privacy answers for Your Personal Diary

The Windows app (MSIX on the Microsoft Store, and the setup-file version) is a client of the Your Personal Diary
server `https://yourpersonaldiary.fly.dev` (Fly.io, Frankfurt), with the automatic offline mode. It has the SAME
privacy policy as the Android app and the website - one URL, 20 languages, English by default. Written 2026-10-26, updated 2026-10-27 (docs/android-tasks/PRIVACY-HARDENING.md);
it replaces the local-only answers of `store/age-rating-answers.md` and `store/privacy-policy/_obsolete-2026-10-03/`.

Sources (read 2026-10-26):
- "Support info for MSIX app" - https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/support-info
  ("you must indicate whether or not your app accesses, collects, or transmits any personal information. If you
  answer Yes, a privacy policy is required"; "If you already have a privacy policy hosted on your domain, you can
  directly provide that link"; "Microsoft doesn't provide a default privacy policy for your app").
- Microsoft Store Policies version 7.20, section 10.5 "Personal Information" - https://learn.microsoft.com/en-us/windows/apps/publish/store-policies#105-personal-information
  (10.5.1: the policy must "inform users of the Personal Information accessed, collected or transmitted by your
  product, how that information is used, stored and secured, and indicate the types of parties to whom it is
  disclosed", describe the users' controls and how they access their information, and be kept up to date;
  "Desktop Bridge and Win32 products" "must always have privacy policies"; 10.5.4: collect, store and transmit
  "securely, by using modern cryptography methods"; 10.5.5: "highly sensitive personal information, such as health
  or financial data" only when "related to the product's functionality" and with "express user consent";
  10.5.8: laws on children's data).
- "Age ratings for MSIX app" - https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/age-ratings
  (IARC questionnaire; "If you have already completed the questionnaire for your app in another storefront and have
  an IARC rating ID, you can select the option to provide us with your rating ID"; "we share your publisher display
  name and email address with IARC").
- "Product declarations for MSIX app" - https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/product-declarations
  ("Windows can include this product's data in automatic backups to OneDrive" - "checked by default").

## 1. Properties -> Privacy policy

| Partner Center question | Answer |
| --- | --- |
| Does this product access, collect, or transmit personal information? | **Yes** |
| Privacy policy URL | **https://yourpersonaldiary.fly.dev/privacy/** (English; the page links to the 19 other languages) |

Before entering the URL: fill `publisherName` and `contactEmail` in `legal/settings.json`, run
`node scripts/legal/build-pages.mjs`, deploy the server, and open the URL once to see that no `{{...}}` is left.

### What the app collects or transmits, and why (for the reviewer's questions; the policy says the same)

| Personal information | Why | Where it goes |
| --- | --- | --- |
| First name, last name, user name, e-mail address, account ID, the user's UI language; for accounts created since the privacy checkbox exists, when the user ticked "I have read the Privacy policy and agree to it" and the policy version (its effective date) | Create the account, sign in, greet the user, send the password-reset message and security notices (in the user's language, without opening the diary); the checkbox record shows that the user confirmed the policy | Stored on the server (Fly.io, Frankfurt), not encrypted by the app (needed to sign in and to write to the user) |
| The diary: entries (text; optional mood, emotions, energy, stress, sleep, physical activity, events, people, place, notes, tags), habits, settings | The app's purpose: keep the diary and show it on every device of the user | Stored on the server in a per-account file encrypted with AES-256-GCM (key derived from the password); decrypted in the server's memory while the user is signed in. A password-reset request does not open it (the e-mail language is kept in the account record); only completing the reset with the mailed link or code opens it with the recovery key, to re-encrypt it under the new password. Deleted or changed text is overwritten in the file at the next save (SQLite `secure_delete`; diaries from before were compacted once with `VACUUM`); older copies remain only in the 30-day storage snapshots and, encrypted, in unused disk space until it is reused |
| Password | Sign-in | Never stored; the server keeps a scrypt-derived verifier only |
| Search questions | Answer a search over the user's own diary | Sent to the server, answered in memory, not stored |
| Sign-in sessions (device kind, times; token as a hash) | Stay signed in, "Remember me" | Stored on the server; the token itself on the device |
| IP address (inherent to every connection) | Abuse limits: how many sign-in and other account requests, forgot-password requests, registrations, tours and backups can come from one network, and the sign-in lockout | Kept in the server's memory only, as the key of those counters (from one minute up to 24 hours); never written to storage or the log, never used for location |
| On the PC: an encrypted copy of what was shown recently (with "Remember me"), of the changes not yet uploaded, of a 7-day record of the uploaded changes and of the conflict notes (automatic offline mode) | Work without a connection, upload every change exactly once | In the app's data folders of the user's Windows profile (MSIX: the package's own folder); the key is protected with DPAPI (current user), so a program running as the same Windows user could read the "Remember me" copy (the policy says so, section 8); deleted at sign-out |

- Parties it is disclosed to: only the operator's service providers - Fly.io, Inc. (hosting, United States company,
  data centre in Frankfurt, Germany) and Google (Gmail, sends the reset e-mails). No advertising, analytics or
  tracking; no sale or sharing. (10.5.1)
- Security: HTTPS/TLS only (the app's Content-Security-Policy allows only the diary server), AES-256-GCM per account
  on the server, the provider's disk encryption, DPAPI for the device copy. (10.5.4)
- User controls: export and backup in Settings; edit or delete any entry; **Settings - Delete account** deletes the
  account and diary from the server at once (storage snapshots expire within 30 days); deletion by e-mail for
  users who cannot sign in: https://yourpersonaldiary.fly.dev/delete-account/. (10.5.1)
- Sensitive data (10.5.5): the optional sleep, stress, mood and physical-activity fields of an entry can be seen
  as health-related. They exist only to serve the diary and its statistics (the product's functionality); the user
  types them in deliberately, and no account is created until the user ticks "I have read the Privacy policy and
  agree to it" at registration (the policy explains these fields; docs/android-tasks/PRIVACY-CHECKBOX.md). **Owner
  decision:** if Microsoft asks for an express consent specific to this data, add that one sentence at registration
  (not implemented).
- Children (10.5.8): not directed at children; minimum age 16 (`legal/settings.json`, `play/policy/target-audience.md`).

## 2. Properties -> Product declarations (privacy-relevant boxes)

| Declaration | Answer | Reason |
| --- | --- | --- |
| Windows can include this product's data in automatic backups to OneDrive | **Uncheck** | The diary lives on the server. The only local data is a per-device encrypted copy whose key is bound to this Windows user by DPAPI, plus the sign-in token; copying them to OneDrive gives no benefit and would put a sign-in token in a cloud backup. |
| This product incorporates generative AI features | **No** | Insights, statistics and search answers are computed by fixed rules from the user's own entries; no AI model generates content. |
| This product allows users to make purchases, but does not use the Microsoft Store commerce system | No | No purchases. |
| Customers can install this product to alternate drives or removable storage | Keep the default | Not privacy related. |

## 3. Age ratings (IARC) - consistent with `play/policy/content-rating.md`

Preferred: if the Google Play questionnaire was completed first, choose **"I have an IARC rating ID"** and enter the
ID from the IARC certificate e-mail. Otherwise answer the questionnaire like this:

| Question | Answer | Reason |
| --- | --- | --- |
| Category | The non-game category for **utility, productivity, communication or other** apps | A private diary; not a game, not social networking or UGC sharing, not reference/news/education, not entertainment. |
| Violence, fear, sexual content or nudity, profanity, drugs/alcohol/tobacco, gambling, discrimination or hate, crime | No (each) | The app shows only its own interface and the signed-in user's own diary. |
| Does the app allow users to interact or exchange content with other users (chat, messages, sharing text, images, audio)? | **No** | Every account sees only its own diary; the same person on several devices is not interaction with others. |
| Does the app share user-generated content publicly or with other users? | **No** | Entries are private, encrypted per account on the server, never published. |
| Does the app share the user's location with other users? | **No** | No location access; the "place" field is private free text. |
| Does the app allow users to purchase digital goods? | **No** | Free, no purchases, no ads. |
| Does the app share personal information with third parties? | **No** | Only the operator's service providers process data on his behalf (hosting, reset e-mail). |
| Does the app provide unrestricted internet access or a web browser? | **No** | The app talks only to its own server; the privacy-policy link opens that server's page in the user's own browser. |

Expected result: suitable for all ages (for example ESRB Everyone, PEGI 3, USK 0, IARC 3+) - the same result as on
Google Play. The rating is about content; the audience (16+) is stated in the privacy policy.

## 4. Support info (Properties)

| Field | Value |
| --- | --- |
| Website | https://yourpersonaldiary.fly.dev/ |
| Support contact info | {{CONTACT_EMAIL}} (the value of `legal/settings.json`; never the owner's private address unless he chooses it) |

## 5. The rest of the Store kit

Rewritten on 2026-10-27 for the current server-only app and consistent with this file: `store/certification-notes.md`
(the app connects only to https://yourpersonaldiary.fly.dev over HTTPS; it keeps an encrypted local copy so that it
works without a connection, deleted when the user signs out), the listing texts in `store/listing/**` (20 languages,
checked by `scripts/store/check-listing.mjs`) and `store/age-rating-answers.md`. The old local-only privacy texts
are kept, unused, in `store/privacy-policy/_obsolete-2026-10-03/`.
