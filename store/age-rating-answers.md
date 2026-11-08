# Age rating (IARC questionnaire) - answers for Your Personal Diary

Partner Center > your app > **Age ratings**. Rewritten 2026-10-27 for the current app (a client of the Your
Personal Diary server with the automatic offline mode). The answers are the same as on Google Play
(`play/policy/content-rating.md`) and as section 3 of `store/policy/partner-center-privacy.md`; if one of the three
changes, change the others.

Source (read 2026-10-27): "Age ratings for MSIX app" -
https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/age-ratings
("The first question asks you to choose the category that best describes your app... Based on your answer to this
question, you'll be presented with additional questions"; "If you have already completed the questionnaire for your
app in another storefront and have an IARC rating ID, you can select the option to provide us with your rating ID";
"we share your publisher display name and email address with IARC"; "When you have completed the questionnaire,
click Save and generate").

The question wording changes from time to time. The rule for any question not listed here: the app shows only its
own interface and the signed-in person's own diary; nothing a user writes is ever shown to another user - so the
answer is **No**.

## Fastest way: reuse the Google Play rating

If the Google Play questionnaire was already completed, IARC sent a certificate e-mail with a **rating ID**. On the
Age ratings page choose the option to provide an existing IARC rating ID and enter it. The answers are then the
same as on Google Play. Otherwise answer the questionnaire as below.

## First question: category

Choose the general, non-game category for **utility, productivity, communication or other** apps (not "Game", not
"Social networking or communication" between users, not "Reference, news or educational", not "Entertainment").
Reason: a private diary with habits and statistics about the person's own entries; no game play, no feed, nothing
published.

## Content questions

| Topic the questionnaire asks about | Answer | Reason |
| --- | --- | --- |
| Violence, blood, gore | No | The app has no such content; it shows its interface and the person's own notes. |
| Fear / horror content | No | None. |
| Sexual content or nudity | No | None. |
| Profanity or crude humour | No | The app's own texts contain none. |
| Drugs, alcohol or tobacco (references or use) | No | None. |
| Gambling, simulated gambling, cash prizes | No | None. |
| Discrimination or hate content | No | None. |
| Criminal instruction | No | None. |

## Interaction and other questions

| Question (as the questionnaire asks it) | Answer | Reason |
| --- | --- | --- |
| Does the app natively allow users to interact or exchange content with other users (chat, messaging, sharing text, images, audio)? | **No** | No user-to-user features. Every account sees only its own diary. The same person signing in on several devices is not interaction with others. |
| Does the app share user-generated content publicly or with other users? | **No** | Entries are private, encrypted per account on the server, and never published or shown to anyone else. |
| Does the app share the user's current physical location with other users? | **No** | The app does not use location services. The "place" field of an entry is private free text. |
| Does the app allow users to purchase digital goods (in-app purchases)? | **No** | The app is free and has no purchases, subscriptions or ads. |
| Does the app share personal information with third parties? | **No** | Only the operator's service providers process data on his behalf (Fly.io hosting, Gmail for the password-reset e-mail); no advertising, analytics or sale of data (`store/policy/partner-center-privacy.md`). |
| Does the app contain unrestricted internet access / a web browser? | **No** | The app talks only to its own server (its Content-Security-Policy allows no other address). The privacy-policy link opens that server's page in the user's own browser. |
| Does the app contain or link to user-generated content from others, or to social networks? | **No** | None. |
| Is the app's primary purpose to deliver news, education or streaming media? | **No** | It is a personal diary. |
| Controversial topics presented in a way unsuitable for young audiences | **No** | None. The calendar names religious and national holidays only. |
| Medical / health advice | **No** | The app says it is not a medical or diagnostic tool; insights describe possible relationships in the person's own entries. |

## Expected result

A rating suitable for all ages in every rating system (for example ESRB Everyone, PEGI 3, USK 0, IARC 3+) - the
same result as on Google Play. After the last question choose **Save and generate**; the ratings appear on the page
and IARC later sends a certificate by e-mail (to the publisher's contact address).

The rating describes the content. The audience is a different matter: accounts are for people aged **16 and over**
(`legal/settings.json` `minimumAge`, the privacy policy section 10, `play/policy/target-audience.md`), and the
description's last paragraph says so.

## Related question on the Properties page (not IARC)

"Does this product access, collect or transmit personal information?" - answer **Yes** and give the privacy policy
URL **https://yourpersonaldiary.fly.dev/privacy/**. Reason: the account details (name, user name, e-mail address)
and the encrypted diary are kept on the server (`store/policy/partner-center-privacy.md` section 1 lists everything
and why).
