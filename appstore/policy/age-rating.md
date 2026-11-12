# Age rating - the questionnaire, answered

Package ANSWERS, written 2026-11-08; the override (section 2) follows the minimum-age amendment of 2026-11-10. Same answers for the iPhone record and the Mac record.

Where: App Store Connect > the app > **App Information** > **Age Ratings** > "Set Up Age Ratings" (or Edit); first the in-app controls and capabilities, then each section with a frequency level for each content type; optional Age Suitability URL; **Save** (FACTS 3.2). Role: Account Holder, Admin, App Manager or Marketing. The questionnaire is the one in force since 31 January 2026 (FACTS 3.1). Apple: "Answer the age rating questions in App Store Connect honestly" (Guideline 2.3.6, FACTS 3.2).

Frequency answers are "None" / "Infrequent or Mild" / "Frequent or Intense" (API values `NONE` / `INFREQUENT_OR_MILD` / `FREQUENT_OR_INTENSE`, FACTS 3.3); Yes/No questions are Booleans.

## 1. The answers

| Section | Question (Apple's label) | Answer | Why (from the app) |
| --- | --- | --- | --- |
| In-App Controls | Parental Controls | **No** | The app has no settings for parents to monitor or restrict a child. |
| In-App Controls | Age Assurance | **No** | The app does not confirm anyone's age (no declared-age API, no estimation, no ID check). The minimum age (`minimumAge` in `legal/settings.json`, shown in the Terms of Use and in the privacy policy section 10 through `{{MINIMUM_AGE}}`) is a rule of those documents, not a mechanism in the app. |
| Capabilities | Unrestricted Web Access | **No** | No browser and no in-app browsing. The only outside links are the service's own legal pages (privacy policy, Terms of Use, account deletion), which the app hands to the system browser (Mac: the Tauri command `open_external_url`, limited to those pages by `LEGAL_PAGE_PREFIXES` in `src-tauri/src/opener.rs`; iPhone: an ordinary link with `target="_blank"`, `src/components/legal/PrivacyPolicyLink.tsx`, which the iOS web view leaves to the system - to be seen on the first device test). FACTS 3.4 reads it the same way. |
| Capabilities | User-Generated Content | **No** | Apple's definition is "the broad distribution of content created by users" (FACTS 3.3). A diary is private: each account sees only its own entries; nothing is published or shared with other users. |
| Capabilities | Social Media | **No** | No feed, no sharing, no interaction between users. |
| Capabilities | Social Media Disabled for Users Under 13 | **No** (not applicable - there is no social media) | - |
| Capabilities | Messaging and Chat | **No** | Users cannot communicate with one another in the app. |
| Capabilities | Advertising | **No** | No ads of any kind. |
| Mature Themes | Profanity or Crude Humor | **None** | The app's own texts contain none. |
| Mature Themes | Horror/Fear Themes | **None** | - |
| Mature Themes | Alcohol, Tobacco, or Drug Use or References | **None** | - |
| Medical or Wellness | Medical or Treatment Information | **None** | The app gives no diagnoses, medication or treatment guidance. It says it is not a medical tool (`insights.disclaimer` in `shared/i18n/messages/en/insights.ts`; policy section 11). |
| Medical or Wellness | Health or Wellness Topics | **No** | Apple's definition: "Content that provides self-care or lifestyle recommendations. May include: calorie tracking, dieting advice, or exercise recommendations." (FACTS 3.3). The app records optional sleep, stress and activity values that the user types and describes relationships in the user's own entries; it gives no recommendations (the insight texts contain no advice, only "possible relationships"; checked in `shared/i18n/messages/en/insights.ts` and `analysis.ts`). FACTS 3.4 reads it the same way. If a reviewer disagrees, "Yes" gives 9+ (FACTS 3.5) - it changes nothing for the customer, because the override below is 13+ or higher anyway. |
| Sexuality or Nudity | Mature or Suggestive Themes | **None** | - |
| Sexuality or Nudity | Sexual Content or Nudity | **None** | - |
| Sexuality or Nudity | Graphic Sexual Content and Nudity | **None** | - |
| Violence | Cartoon or Fantasy Violence | **None** | - |
| Violence | Realistic Violence | **None** | - |
| Violence | Prolonged Graphic or Sadistic Realistic Violence | **None** | - |
| Violence | Guns or Other Weapons | **None** | - |
| Chance-Based Activities | Gambling | **No** | - |
| Chance-Based Activities | Simulated Gambling | **None** | - |
| Chance-Based Activities | Contests | **None** | Apple: "Events that allow users to compete with one another for rankings, rewards, or the achievement of personal goals." (FACTS 3.3). Habit streaks are personal records, but users never compete with one another. (Even "Infrequent" would still be 4+, FACTS 3.5.) |
| Chance-Based Activities | Loot Boxes | **No** | No purchases of any kind. |
| (optional) | Age Suitability URL | blank | Optional (FACTS 3.2, `developerAgeRatingInfoUrl` FACTS 3.3). |

What the user writes in a private diary is not "content of the app" in the questionnaire's sense: it is seen only by its author (the reading behind "User-Generated Content = No").

## 2. The result and the override

- **Calculated rating: 4+.** With every answer None/No the app falls in Apple's 4+ tier, which "contain[s] no objectionable material" (FACTS 3.5). Korea's tiers are computed from the same answers ("All", FACTS 3.8); devices with an OS older than 26 show Apple's older tiers - App Store Connect shows that mapping in "Operating Systems Earlier than Version 26" after the answers are saved (FACTS 3.6).
- **Made for Kids: No** (not chosen) - the service is not directed at children (policy section 10).
- **Override to Higher Age Rating: the lowest current tier that is not below the service's minimum age.** Apple: "If your app has a EULA with minimum age requirements that exceed the rating that Apple calculated, you must override to a rating that adheres to the requirements." (FACTS 3.7). This kit does not write the minimum age as a number: read `minimumAge` in `legal/settings.json` - the value that the Terms of Use (section 2, `docs/apple-tasks/TERMS.md`) and the privacy policy (section 10) show through `{{MINIMUM_AGE}}` (minimum-age amendment of 2026-11-10). The current tiers are 4+, 9+, 13+, 16+ and 18+ - there is no 12+ tier on current systems (FACTS 3.5) - so:

  | `minimumAge` in `legal/settings.json` | Override to Higher Age Rating | API value (`ageRatingOverrideV2`, FACTS 3.7) |
  | --- | --- | --- |
  | 12 or 13 | **13+** | `THIRTEEN_PLUS` |
  | 14, 15 or 16 | **16+** | `SIXTEEN_PLUS` |
  | 17 or 18 | **18+** | `EIGHTEEN_PLUS` |

  **Final decision (owner, 2026-11-11): the minimum age stays 16, so the override is 16+ (`SIXTEEN_PLUS`) in both records.** (On 2026-11-10 he had asked about 12; after hearing about the US children’s-privacy rules for under-13s he kept 16.) The app uses Apple's standard EULA, so whether Apple counts our Terms of Use as "a EULA with minimum age requirements" is not spelled out; the override is allowed in any case ("if you believe your app should be rated higher", FACTS 3.7), so the table is correct either way (ANSWERS amendment 2 as changed by the 2026-11-10 amendment). The store then shows the chosen tier while the content descriptions still reflect the answers (FACTS 3.7). If `minimumAge` ever changes, change the override of both records with it.
- The override applies in every region; Apple may map it to a different value per region (FACTS 3.7).

## 3. "Minimum age" and "age assurance" - how to answer

- The questionnaire has no question about accounts, sign-in or a minimum age (FACTS 3.4). The minimum-age rule is expressed only through the **override** (section 2), not through any answer.
- **Age Assurance = No** is truthful: the app does not check age; registration contains a consent sentence and the Terms of Use state the minimum age, which is a contractual rule, not an age-assurance mechanism in Apple's sense ("declared age range API; age estimation capabilities; age verification via government-issued ...", FACTS 3.3).
- If App Review asks how minors are kept out, answer with this text, after replacing `<N>` with `minimumAge` from `legal/settings.json` (the number that https://yourpersonaldiary.fly.dev/terms/ shows) and `<tier>` with the override chosen in section 2: "The service's Terms of Use and Privacy Policy require users to be at least `<N>` years old; the app is rated `<tier>` through Override to Higher Age Rating; we do not knowingly keep data of younger users and delete such an account on request (Privacy Policy section 10)." Add: "Where the law of their country requires it, a minor may use the service only if a parent or guardian agrees (Terms of Use, section 2)." (The published Terms of Use contain this sentence in all 20 languages.) With today’s values the answer reads "at least 16 years old" and "rated 16+".
