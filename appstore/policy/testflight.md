# TestFlight - internal and external testing

Package ANSWERS, written 2026-11-08. Apple facts: FACTS 8.7-8.9 and 5.6. TestFlight exists for iOS and macOS (FACTS 8.7), so both records can use it; the Mac record only through the Mac App Store route (a `.pkg` upload, `mac-appstore-notes.md`).

## 1. The order

1. **Upload a build** (Xcode Organizer "TestFlight & App Store", or Transporter; FACTS 8.4). Apple processes it and sends an e-mail when it appears (FACTS 8.9).
2. **Export compliance**: answered by `ITSAppUsesNonExemptEncryption = NO` in the Info.plist, so the build does not stop at "Missing Compliance" (FACTS 5.6, 8.8; `export-compliance.md`). If it does stop there, click Manage next to the build and answer as in `export-compliance.md` section 2.
3. **Internal testing first** - up to 100 App Store Connect users of the team (FACTS 8.7); the owner is one of them. A build in "Ready to Submit" "can be distributed to internal testers" without review (FACTS 8.7, build-status reference). The owner installs Apple's **TestFlight** app on his iPhone (and, for the Mac build, on the Mac), accepts the invitation and tests.
4. **External testing (optional)** - up to 10,000 people by e-mail or public link; the first build added to an external group goes to TestFlight App Review, later builds "may not require a full review" (FACTS 8.7). For a one-person release, internal testing is enough; external testing is useful only to let friends test before release.
5. Every build can be tested for **90 days**; after that its status is "Expired" (FACTS 8.7). Upload a new build (higher build number, `app-information.md` section 2) to keep testing.

## 2. What to fill (TestFlight tab > Test Information)

The field names below are the usual ones of the TestFlight Test Information page; FACTS does not quote that page, so if a label differs, match by meaning.

| Field | Value |
| --- | --- |
| Beta App Description | `A private diary: entries, moods, habits with reminders, a calendar and insights about your own entries, in 20 languages. Requires an account on the Your Personal Diary server.` |
| Feedback Email | `yourpersonaldiary29@gmail.com` |
| Marketing URL | blank |
| Privacy Policy URL | `https://yourpersonaldiary.fly.dev/privacy/` |
| Beta App Review Information - contact | the owner's legal name, phone in `+972...` format (the field refuses numbers without "+" and country code, FACTS 2.27), `yourpersonaldiary29@gmail.com` |
| Beta App Review Information - sign-in required | yes; user name `stor`; password: (the owner types the password only in App Store Connect) |
| Beta App Review Information - notes | the text of `appstore/policy/review-notes.txt` |
| What to Test (per build) | the text in section 3 |

The demo account must stay usable for every review and must not expire (FACTS 2.27); before each submission sign in once as `stor` and check the sample data (`play/policy/app-access.md`, "What the owner does before each submission").

## 3. "What to Test" (copy as is; short form of `docs/OFFLINE-TEST.he.md` part A)

```
Please test the diary with and without a connection:
1. Sign in with "Remember me" on. Open Home, Diary, Habits, Calendar and Settings once.
2. Turn on Airplane Mode and open another page: a thin bar says there is no connection, and pages keep opening.
3. Write a new entry and save it: "Saved on this device" appears and the entry is marked "not uploaded yet".
4. Edit the same entry, tick a habit for today and change one setting (e.g. the dark theme): the pending counter shows 3 changes.
5. Insights, search and backup need a connection: they say so - that is expected.
6. Close the app completely and open it again, still offline: it opens, the entry, the habit tick and the theme are there.
7. Leave the app and come back: the lock screen accepts your password offline and offers to unlock with Face ID / Touch ID / the passcode.
8. Turn Airplane Mode off: the bar uploads the 3 changes and disappears; on another device the entry appears exactly once.
Report anything unexpected to yourpersonaldiary29@gmail.com.
```

## 4. Before submitting to the App Store

The build tested in TestFlight is the one selected on the version page (Build section, FACTS 8.6 - one build per app version, changeable until submission). The App Store submission then uses the App Review Information of the version page (`review-notes.txt`), not the TestFlight fields.
