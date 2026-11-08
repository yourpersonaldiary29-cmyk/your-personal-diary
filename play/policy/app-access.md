# Google Play - App access: instructions for the reviewers

Play Console -> your app -> **Policy -> App content -> App access**.

Source (read 2026-10-26): "Prepare your app for review" - https://support.google.com/googleplay/android-developer/answer/9859455
("If your entire app or parts of your app are restricted based on login credentials" you "must provide all
required details to enable access to your app"; use "Any other instructions" to explain "anything special about
your login mechanisms").

Rewritten 2026-10-28: registration on the server is open now, and the reviewers use the owner's demo account.

## Why the reviewers need an account

Everything in the app except the short tour needs a signed-in account on the diary server. Registration is
**open to everyone** since 2026-10-27 (`DIARY_REGISTRATION = "open"` in `deploy/hosted/fly.toml`), so a reviewer
could create an account - but a new account starts empty, and the server's own rules can stop reviewers who
register themselves: at most 5 registration attempts per hour and 20 per day from one network, counted on every
attempt (`server/src/hosted/policy.ts`), and every e-mail address can be registered only once. The reviewers
therefore get the ready **demo account** with sample data.

## The demo account

- **User name: `stor`.** The owner created it on the production server on 2026-10-27 and filled it with sample
  data (Settings -> Data -> "Load sample data"). It is the same account the owner made for the Microsoft Store
  certification (`store/certification-notes.md`, "The demo account"), so both stores test the same diary.
- **Password: typed only in Play Console** (and in Partner Center for the Microsoft Store); keep it in the
  password manager. It is never written into this repository, a chat or any other file.

## What the owner does before each submission (never in this repository, never in a chat)

1. Sign in once as `stor` (in the app or on the website) and check that the sample data is still there - a
   reviewer of an earlier submission may have changed it.
2. If the account is gone (someone deleted it): register it again - **Sign up**, user name `stor`, an e-mail
   address that reaches you but is not your own account's (for example a plus address of the support mailbox,
   `yourpersonaldiary29+stor@gmail.com`), a new password that is used nowhere else - then Settings -> Data ->
   "Load sample data". Enter the new password in Play Console and in Partner Center.
3. Enter the user name and the password **only** in Play Console (the fields below).

## What to enter in Play Console

| Field | Value |
| --- | --- |
| All or some functionality in my app is restricted | Selected |
| Name of the instructions | Reviewer account |
| Username, email address or phone number | `stor` |
| Password | {{REVIEW_PASSWORD}} - the demo account's password, typed in Play Console only |
| Any other instructions | the text below |

Text for "Any other instructions" (copy as is):

> Your Personal Diary is a private diary. Open the app, tap "Log in" and sign in with the user name and password
> above (no second factor, no code by e-mail). The account already contains sample entries and habits. All data
> is stored on the developer's own server at https://yourpersonaldiary.fly.dev; the app needs an internet
> connection to sign in. Registration is open, but the server accepts only a few registrations per hour from one
> network, so please use this account. Without signing in you can also tap "Skip - just look around" for a
> 30-minute tour with sample data. Please do not delete this account: to test account deletion, create an account
> of your own ("Sign up") and delete it in Settings -> Delete account (it needs the password); the same steps are
> described at https://yourpersonaldiary.fly.dev/delete-account/. The privacy policy is at
> https://yourpersonaldiary.fly.dev/privacy/ (link in Settings -> Privacy and on the registration screen).

## Rules

- The account must keep working for every review: do not change its password without updating Play Console (and
  Partner Center). Ten wrong passwords lock sign-in from one network for 15 minutes only; the account itself is
  never locked.
- Never put the server key, an archive passphrase or any personal password into Play Console text fields, listing
  texts or this repository. The demo account's password goes into the Play Console **Password** field only.
- If registration is closed again (`DIARY_REGISTRATION = "closed"` or `"invite"`), the demo account still works;
  the sentence "Registration is open ..." and the "create an account of your own" part are then removed from the
  instructions.
