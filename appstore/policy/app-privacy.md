# App Privacy (the "privacy nutrition label") - the answers for both records

Package ANSWERS, written 2026-11-08. Same answers for the iPhone record and the Mac record (each record answers separately, FACTS 4.1). They follow the Google Play Data safety answers (`play/policy/data-safety.md`, ENV-FINAL decision 4) and the privacy policy `legal/privacy/privacy-en.md` (the version read for this file: the one with the Mac and iPhone sections, the Keychain wording and the offline-password sentence of section 5, effective date `2026-11-08` in `legal/settings.json`).

Where: App Store Connect > the app > **App Privacy** > Get Started > "Yes, we collect data from this app" > select the data types > answer the questions of each type > **Publish** (FACTS 4.1). The answers can be changed at any time without a new version (FACTS 4.1); keeping them accurate is the developer's duty (FACTS 4.1, [A25]).

Apple's definitions used below: "collect" = sent off the device and kept longer than needed to answer the request in real time (FACTS 4.2); personal data is "linked" (FACTS 4.3); "tracking" = combining with third-party data for advertising or sharing with a data broker (FACTS 4.4); purpose "App Functionality" (FACTS 4.6).

## 1. Collected (6 data types)

For every row: **Collected = yes; Linked to the user = yes; Used for tracking = no; Purpose = App Functionality only** (not Analytics, not Product Personalization, not Developer's Advertising or Marketing, not Third-Party Advertising, not Other Purposes).

| Apple category > data type | What the app sends and the server keeps | Code / policy evidence |
| --- | --- | --- |
| Contact Info > **Name** | First and last name, required at registration; shown in the greeting and used in the password-reset e-mail | `AccountRecord.firstName` / `lastName` in `server/src/security/session-types.ts`; policy section 2 |
| Contact Info > **Email Address** | The e-mail address of the account (sign-in by e-mail, password reset, security notices); the previous address after a change, until the next change | `AccountRecord.email`, `previousEmail`, `emailChangedAt`; `server/src/mail/templates.ts`; policy sections 2-3 |
| Identifiers > **User ID** | The user name the person chooses and the account ID the server assigns | `AccountRecord.id`, `username`; policy section 2 |
| User Content > **Other User Content** | The diary: entry title and text, mood, emotions, energy, events, people, place, notes, tags; habits and habit records; the diary settings (including the interface language, also kept in the account record) | tables `entries`, `habits`, `habit_logs`, `settings`, `meta` in `server/src/db/schema.ts`; `AccountRecord.language`; policy section 2 |
| Health & Fitness > **Health** | Optional sleep hours, sleep quality and stress rating of an entry | `entries.sleep_hours`, `sleep_quality`, `stress` in `server/src/db/schema.ts` |
| Health & Fitness > **Fitness** | Optional minutes and type of physical activity of an entry | `entries.exercise_minutes`, `exercise_type` |

Why Health and Fitness are declared although they are optional fields: Apple's Health type includes "any other user provided health or medical data" and Fitness "fitness and exercise data" (FACTS 4.6); the data are stored on the server as part of the diary - the app's primary functionality - so the optional-disclosure exception does not apply (FACTS 4.5: it requires collection "only in infrequent cases that are not part of your app's primary functionality"). This is the same conservative choice as on Google Play (`play/policy/data-safety.md`, "Health info" and "Fitness info"). Guideline 5.1.3 consequences are met: the data is not used for advertising or data mining and is not stored in iCloud (FACTS 4.10, 10.9).

Optional-disclosure questions: if App Store Connect asks whether a type qualifies for optional disclosure, the answer is **no** for all six (FACTS 4.5 - collection is ongoing and part of the primary functionality). "Data Used to Track You" stays empty; "Data Not Linked to You" stays empty.

Data that also belongs to the account but needs no separate type: the time of registration and of the last sign-in, the record of the privacy-policy confirmation (time + policy version) and, once the TERMS package is deployed, the same record for the Terms of Use (`privacyAcceptedAt` / `privacyVersion`, and `termsAcceptedAt` / `termsVersion` per `docs/apple-tasks/TERMS.md`) - account metadata of the declared types, the same reading as `play/policy/data-safety.md` ("account data, no new data type").

## 2. Not collected

| Apple category / type | Why not | Evidence |
| --- | --- | --- |
| Diagnostics (Crash Data, Performance Data, Other Diagnostic Data) | No crash reporting, no performance telemetry, no SDK. The server's technical log stays on the server and holds no user content, no e-mail and no IP address. | `scripts/check-no-network.mjs`; policy sections 2 and 6 |
| Usage Data (Product Interaction, Advertising Data, Other Usage Data) | No analytics, no ads | policy section 3 ("Never") |
| Location (Precise, Coarse) | No location permission; the "place" of an entry is free text the user types (declared as Other User Content); the IP address is not used to infer a location | `entries.location` is TEXT; policy section 2 |
| Contacts | The contact list is never read; the "people" of an entry are names the user types | `entries.people_json` |
| Identifiers > Device ID | No advertising identifier or device identifier is read. The sign-in session stores a label of the kind of device ("Computer", "Phone" or "Browser" in the user's language), not an identifier. | `deviceName()` in `src/utils/platform.ts`; `Session.deviceName` in `server/src/security/session-types.ts`; policy section 2 |
| Search History | A search question is answered in the server's memory and not kept (Apple's "collect" needs storage longer than the real-time request, FACTS 4.2); the list of recent questions stays on the device and is removed at sign-out | policy sections 3 and 5 |
| Browsing History | The app has no browser | - |
| Purchases | Free, no in-app purchases | ENV-FINAL decision 6 |
| Financial Info | No payment data | - |
| Contact Info > Phone Number, Physical Address, Other User Contact Info | Not asked for | registration fields: first name, last name, e-mail, user name, password (`src/pages/RegisterPage.tsx`) |
| User Content > Emails or Text Messages, Photos or Videos, Audio Data, Gameplay Content, Customer Support | Not used. A support e-mail that a person writes to the contact address does not pass through the app. | - |
| Sensitive Info | Not asked for (see section 3) | - |
| Other Data Types | Nothing else is stored. IP addresses: see section 4. | - |

The category and type names above are those of FACTS 4.6 plus the remaining types of Apple's App Privacy screen as known to this package; FACTS 4.6 quotes only the definitions it needed. If the screen lists a type not named here, the answer is "not collected".

## 3. Free text in the diary and "Sensitive Info"

A diary may contain anything its owner writes - health, beliefs, sexuality. Apple's "Sensitive Info" lists categories such as "racial or ethnic data, sexual orientation, pregnancy or childbirth information, disability, religious or philosophical beliefs" (FACTS 4.6). The reading of this package (FACTS 4.7: Apple's page does not address free text - NOT FOUND there): Sensitive Info is declared when an app **asks for** such data; the app asks for none, and what a person chooses to write is "Other User Content" ("Any other user-generated content", FACTS 4.6), which is declared. The privacy policy states openly that a diary may contain sensitive information and how it is processed (policy section 3, "Legal basis").

## 4. IP addresses

Apple has no IP-address data type. The server receives the connecting IP address and uses it only in memory for rate limits and the sign-in lockout (at most 24 hours), never writing it to storage or the log (policy section 2). Decision (ENV-FINAL decision 4): not declared; the policy discloses the use. Google Play, which has no IP type either, got the closest type "Device or other IDs" - that difference is deliberate and comes from the two stores' different type lists.

## 5. The privacy manifest of the iPhone app (`PrivacyInfo.xcprivacy`)

The template is `mobile/ios-app/PrivacyInfo.xcprivacy` (copied on the Mac to `ios/App/App/PrivacyInfo.xcprivacy`, `scripts/ios/README.he.md`). Checked against the table above on 2026-11-08:

| Key | Template today | Must be |
| --- | --- | --- |
| `NSPrivacyTracking` | `false` | `false` - correct |
| `NSPrivacyTrackingDomains` | empty array | empty - correct |
| `NSPrivacyCollectedDataTypes` | Name, EmailAddress, UserID, OtherUserContent - each linked, not tracking, purpose AppFunctionality | **add two entries** of the same shape: `NSPrivacyCollectedDataTypeHealth` and `NSPrivacyCollectedDataTypeFitness` (linked `true`, tracking `false`, purposes `NSPrivacyCollectedDataTypePurposeAppFunctionality`). The template itself names this as the owner decision; decision 4 has now taken it ("Health, Fitness - collected"). Without them the manifest contradicts the App Store Connect answers. |
| `NSPrivacyAccessedAPITypes` | UserDefaults `CA92.1`; FileTimestamp `C617.1` | correct (FACTS 4.9): `CA92.1` covers `@capacitor/preferences` and the app's own `UserDefaults` keys (`DiaryOfflinePlugin.swift` wrapped-users list, `DiaryPrivacyScreenPlugin.swift` setting); `C617.1` covers `@capacitor/filesystem` on files inside the app container. The import picker uses `UIDocumentPickerViewController(..., asCopy: true)` (`mobile/plugins/diary-files/ios/DiaryFilesPlugin.swift`), so the file read is a copy inside the container, and the only metadata read is `.fileSizeKey`, which is not in the FileTimestamp API list of FACTS 4.9. `3B52.1` is therefore not needed; add it only if Xcode's privacy report (Product > Archive > Generate Privacy Report) names the document picker. |

Who changes it: the IOS package / the developer on the Mac (the file is not in this package's ownership). The Mac app has no manifest; FACTS 4.8 calls a data-types-only manifest in the Mac bundle "harmless and recommended for the Mac App Store route" - an open point for the Mac App Store build (`mac-appstore-notes.md`).

## 6. When to update

Whenever the app starts storing a new kind of data, adds an SDK, changes the server location or a service provider, or adds a sign-in method: update this file, `play/policy/data-safety.md`, `legal/privacy/*.md`, the manifest, and the App Privacy answers of both records together.
