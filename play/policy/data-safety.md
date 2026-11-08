# Google Play - Data safety form: the answers for Your Personal Diary

Play Console -> your app -> **Policy -> App content -> Data safety**. Written 2026-10-26 for the app as it is
now (updated 2026-10-27 for docs/android-tasks/PRIVACY-HARDENING.md: a password-reset request no longer opens the diary, deleted
text is overwritten on the server): a server-only client of `https://yourpersonaldiary.fly.dev` (Fly.io, Frankfurt) with the automatic offline
mode. Every answer has its reason, taken from the code and from `legal/privacy/privacy-en.md` (the policy at
`https://yourpersonaldiary.fly.dev/privacy/`) - the form and the policy must say the same thing.

Sources (read 2026-10-26):
- "Provide information for Google Play's Data safety section" - https://support.google.com/googleplay/android-developer/answer/10787469
  ("'Collect' means transmitting data from your app off a user's device"; "'Sharing' refers to transferring user
  data collected from your app to a third party"; a "service provider" that "processes user data on behalf of the
  developer and based on the developer's instructions" is not sharing; data "only processed locally on the user's
  device and not sent off device does not need to be disclosed"; ephemeral = "only stored in memory and retained for
  no longer than necessary to service the specific request in real-time"; "Approximate location that is inferred,
  such as via IP address ... must be disclosed"; Device or other IDs = "Identifiers that relate to an individual
  device, browser or app"; on IP addresses: "you should disclose your collection, use and sharing of IP addresses"
  "based on their particular usage and practices"; the purpose "Fraud prevention, security, and compliance", for
  example "monitoring failed login attempts to identify possible fraudulent activity". Re-read 2026-10-27).
- "Understanding Google Play's app account deletion requirements" - https://support.google.com/googleplay/android-developer/answer/13327111
  (an in-app path AND "a web link resource where users can request app account deletion and associated data
  deletion"; disclose it "and provide the web link within your Data safety form").
- "User Data" policy - https://support.google.com/googleplay/android-developer/answer/10144311 (privacy policy in the
  Play Console field and inside the app; "merely freezing the account is not sufficient").

The form's wording changes from time to time; if a question reads differently, answer it with the fact in the
"Reason" column.

## Step 1 - Data collection and security

| Question | Answer | Reason |
| --- | --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** | The account details and the diary are sent to the server and stored there. |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | The app talks only to `https://yourpersonaldiary.fly.dev` (HTTPS/TLS; the app's Content-Security-Policy allows no other server, the Android manifest disables cleartext traffic, the server sends HSTS). Password-reset e-mails leave the server over TLS to Gmail. |
| Which methods of account creation does your app support? | **Username and password** | Registration asks first name, last name, e-mail, user name and password, and the user must tick "I have read the Privacy policy and agree to it" (the account keeps when, and the policy version - account data, no new data type); sign-in with user name or e-mail plus password. No Google/OAuth sign-in. |
| Delete account URL | **`https://yourpersonaldiary.fly.dev/delete-account/`** | The web resource of the account-deletion rule: names the app and the publisher, gives the in-app steps, the e-mail route for people who cannot sign in, what is deleted and the 30-day snapshot window. Works without installing the app. |
| Do you provide a way for users to request that their data is deleted? | **Yes** | In the app and on the website: Settings -> Delete account (immediate, server and this device). By e-mail from the registered address to the contact address (within 30 days). |
| (If asked) Can users ask to delete some data without deleting the account? | **Yes** | Every entry, habit and habit record can be deleted in the app at any time; it is gone from the app, the search, the statistics and the exports at once. Its old text is also erased from the user's diary file on the server at the next save, a moment later: the hosted server runs every diary with SQLite `PRAGMA secure_delete = ON`, and every diary written before was compacted once with `VACUUM` at its first opening after the deploy (`server/src/security/vault.ts`, `server/src/db/database.ts`). The file's previous copy (`.mpd.prev`, kept in case a save fails) is replaced at the next save. Older copies remain only in the 30-day storage snapshots, encrypted in unused disk space until it is reused, and in backups the user made earlier. Deleting the account removes the whole file. The privacy policy says this (section 7). |

## Step 2 - Data types

"Shared" is **No** for every type: the only recipients are the operator's service providers (Fly.io hosting,
Google Gmail for reset mail), which process data on the operator's behalf - the form's service-provider rule.
No advertising, analytics or tracking SDK is in the app (the Android manifest and `scripts/check-no-network.mjs`
prove it).

### Collected

| Category -> data type | Collected | Shared | Processed ephemerally | Required or optional | Purposes | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| Personal info -> **Name** | Yes | No | No | **Required** | App functionality, Account management | First and last name are required at registration and stored in the account record (the greeting, the reset e-mail). |
| Personal info -> **Email address** | Yes | No | No | **Required** | Account management, App functionality | Required at registration; used to sign in and to send the password-reset message and the security notices. Not used for marketing ("Developer communications" is NOT selected: the only messages are ones the user triggers or security notices about the account). |
| Personal info -> **User IDs** | Yes | No | No | **Required** | Account management, App functionality | The user name the person chooses and the account ID (`u_` + 16 hex digits) the server assigns. |
| App activity -> **Other user-generated content** | Yes | No | No | **Required** | App functionality | The diary: entry text and the fields events, people, place, notes, tags, emotions and mood/energy/stress ratings, habits and their records, settings (the UI language is also kept in the account record, so that the reset e-mail is written in it without opening the diary). Storing it on the server is the app's core function (no local-only mode in the published app), so it is required. |
| App activity -> **In-app search history** | Yes | No | **Yes** | Optional | App functionality | A search question is sent to the server, answered in memory and not stored there (the recent questions list stays on the device and is removed at sign-out). Search is optional. Ephemeral data is reported here but Play may not show it publicly. |
| Health and fitness -> **Fitness info** | Yes | No | No | Optional | App functionality | An entry has optional fields for physical activity (minutes and type) - Google's example for this type is "exercise or other physical activity". |
| Health and fitness -> **Health info** | Yes | No | No | Optional | App functionality | Optional sleep (hours, quality) and stress ratings in an entry. Google's examples are "medical records or symptoms", so this is borderline; declared to be on the safe side, because under-declaring is the risk Play reviews for. **Owner decision** - see the note below. |
| Device or other IDs | Yes | No | **No** | Required | Fraud prevention, security, and compliance | The IP address of every connection (every website receives it). The server keeps it only in memory, as the key of its abuse limits: sign-in and the other account requests (per minute), the sign-in lockout (15 minutes), forgot-password requests (1 hour), registration and the tour (up to 24 hours) and backups (per minute). Because it is kept across requests, it is **not** ephemeral in Google's sense ("no longer than necessary to service the specific request in real-time"). It is never written to storage or the log, never used to infer a location and used for nothing else. Play has no separate IP type; its FAQ says to disclose IP addresses "based on their particular usage", and this is the closest type ("Identifiers that relate to an individual device, browser or app"). The privacy policy lists the same purposes (section 2). |

### Not collected (answer "No" / leave unticked)

| Category or type | Reason |
| --- | --- |
| Location (approximate, precise) | No location permission; the "place" of an entry is free text the user types (already user-generated content); the IP address is not used to infer a location. |
| Personal info: Address, Phone number, Race and ethnicity, Political or religious beliefs, Sexual orientation, Other info | The app does not ask for any of them. Whatever a person chooses to write in the diary is covered by "Other user-generated content". |
| Financial info (all) | The app is free, no purchases, no payment data. |
| Messages (Emails, SMS or MMS, Other in-app messages) | The app does not read the user's e-mails or messages and has no messaging between users. Sending a password-reset message to the user is not collecting their e-mails. |
| Photos and videos, Audio files | Not used. |
| Files and docs | The only file the user can upload is a backup of their own diary (Settings -> Restore), whose content is the diary already declared as user-generated content; no other files are read. |
| Calendar (Calendar events) | The diary has its own calendar view; the device calendar is never accessed. |
| Contacts | Not accessed; the "people" of an entry are names the user types. |
| App activity: App interactions, Installed apps, Other actions | No analytics, no usage tracking. |
| Web browsing | None. |
| App info and performance: Crash logs, Diagnostics, Other app performance data | The app sends no crash or diagnostic data (no SDK for it). Data that Google Play or Android itself collects (Android vitals) is not sent by the app. |

## Step 3 - Security practices shown on the listing

| Item | Answer | Reason |
| --- | --- | --- |
| Data is encrypted in transit | Yes | See step 1. |
| You can request that data be deleted | Yes | See step 1. |
| Committed to follow the Play Families Policy | No / not applicable | The app is not designed for children (see `target-audience.md`). |
| Independently validated against a global security standard | No | No independent security review has been done. |

## Note - health data and the Health apps declaration (owner decision)

Declaring "Fitness info" and "Health info" here is the conservative choice. The separate **Health apps
declaration** (Policy -> App content -> Health apps; every app must complete it,
https://support.google.com/googleplay/android-developer/answer/14738291) asks about health *features*. The
diary records optional exercise minutes and sleep hours, which touches "Activity and fitness" ("Apps that monitor
and record physical activities, exercise routines, and workouts") without being a fitness or sleep app. Pick one of
the two consistent pairs and keep it:
- **Recommended:** Data safety as above (Fitness info + Health info, optional) and, in the Health apps declaration,
  tick **Activity and fitness** only, with the explanation "optional fields of a personal diary entry (minutes of
  physical activity, hours of sleep); no health advice, no Health Connect, no sensors".
- Minimal: no Health info here (keep Fitness info) and "My app doesn't provide any health features" in the Health
  apps declaration. Defensible, but a reviewer could see the sleep and exercise fields and ask.
`docs/PLAY-RELEASE.he.md` (the release package) currently says "health = none"; whichever pair you choose, make
that guide say the same.

## When to update this form

Whenever the app starts sending a new kind of data, adds an SDK, changes the server location or a service
provider, or adds a sign-in method - update this file, `legal/privacy/*.md` (then `node
scripts/legal/build-pages.mjs`) and the form in Play Console together.
