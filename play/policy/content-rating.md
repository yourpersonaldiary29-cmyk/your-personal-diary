# Google Play - content rating (IARC questionnaire): the answers for Your Personal Diary

Play Console -> your app -> **Policy -> App content -> Content rating -> Start questionnaire**. The questionnaire
belongs to IARC (the International Age Rating Coalition); Google: "Apps without a content rating will be removed
from the Play Store" and "Misrepresentation of your app's content may result in its removal or suspension".

Sources (read 2026-10-26):
- "Content Ratings" - https://support.google.com/googleplay/android-developer/answer/9898843 ("a rating questionnaire
  on the Play Console that asks about the nature of your apps' content"; "Your app will be assigned a content rating
  from multiple rating authorities based on your questionnaire responses").
- "Content rating requirements for apps, games, and the ads served on both" - https://support.google.com/googleplay/android-developer/answer/188189
  (the steps: enter the e-mail address IARC writes to, "Select a category", answer, review the calculated ratings,
  submit; "App updates and submissions can be rejected for misrepresenting an app's content").
- "Ratings questionnaire help" - https://support.google.com/googleplay/android-developer/topic/6181287 (topics such as
  "Online Interaction or Content Exchange", "Social Networking, Forums, and UGC Sharing", "Displays User's Location
  to Others", "Digital Purchases").
- IARC, "How IARC Works" - https://www.globalratings.com/?p=18 ("IARC assigns the appropriate Age Rating, Content
  Descriptors, and Interactive Elements by region"; "Developers only have to complete the IARC questionnaire once").

The question wording changes from time to time. The rule for any question not listed here: the app shows only its
own interface and the signed-in person's own diary; nothing a user writes is ever shown to another user, so the
answer is **No**.

## Before the questions

| Field | Answer |
| --- | --- |
| E-mail address for IARC | The publisher's contact address ({{CONTACT_EMAIL}} - the same value as `legal/settings.json`). IARC sends the rating certificate there. |
| Category | The non-game category for **utility, productivity, communication or other** apps. Not "Game"; not "Social networking, forums, blogs and UGC sharing" (entries are private and never shared with other users); not "Reference, news or educational"; not "Content aggregators, consumer stores or commercial streaming". Reason: a private diary with habits and statistics about the person's own entries. |

## Content questions

| Topic | Answer | Reason |
| --- | --- | --- |
| Violence, blood, gore | No | The app has no such content; it shows its interface and the person's own notes. |
| Fear, horror | No | None. |
| Sexual content, nudity, provocative outfits | No | None. |
| Profanity, crude humour | No | The app's own texts contain none. |
| Drugs, alcohol, tobacco (references, use, incentives) | No | None. |
| Gambling, simulated gambling, casinos | No | None. |
| Discrimination, hate symbols (e.g. Nazi symbols) | No | None. |
| Criminal instruction | No | None. |
| Pixelated or childlike style used for adult themes | No | None. |

## Interaction and other questions

| Question (as the questionnaire asks it) | Answer | Reason |
| --- | --- | --- |
| Does the app natively allow users to interact or exchange content with other users (chat, messages, sharing text, images or audio)? | **No** | No user-to-user features. Each account sees only its own diary. The same person signs in on several devices; that is not interaction with others. |
| Social networking, forums, blogs, user-generated content sharing? | **No** | Diary entries are private, encrypted per account on the server, and never published. |
| Does the app display or share the user's location with other users? | **No** | No location permission; the "place" of an entry is private free text. |
| Does the app allow users to purchase digital goods (in-app purchases, loot boxes)? | **No** | Free, no purchases, no subscriptions, no ads. |
| Does the app share personal information with third parties? | **No** | Only the operator's service providers process data on his behalf (hosting, password-reset mail); see `data-safety.md`. |
| Does the app provide unrestricted internet access (a web browser, links to arbitrary sites)? | **No** | The app talks only to its own diary server. The one outside link is the privacy policy page of that same server, opened in the system browser. |
| Is the app's primary purpose news, education or streaming media? | No | A personal diary. |
| Controversial themes for young audiences | No | The calendar names religious and national holidays only. |
| Medical or health advice | No | The app says it is not a medical tool; insights describe correlations in the person's own entries. |

## Expected result

A rating for all ages in every system (for example ESRB Everyone, PEGI 3, USK 0, IARC 3+), with no interactive
element notices. A content rating describes the app's content, not who it is for: the audience is decided
separately in `target-audience.md` (16 and over is recommended) - an "Everyone" rating and a 16+ audience do not
contradict each other.

## Reuse for the Microsoft Store

The same IARC certificate serves the Windows app: Partner Center -> Age ratings offers "If you have already
completed the questionnaire for your app in another storefront and have an IARC rating ID, you can select the
option to provide us with your rating ID" (https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/age-ratings).
Keep the IARC e-mail with the rating ID. `store/policy/partner-center-privacy.md` gives the same answers for the
case where the questionnaire is answered again there.
