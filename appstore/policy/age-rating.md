# Age rating - the questionnaire, answered

Package ANSWERS, written 2026-11-08. Same answers for the iPhone record and the Mac record.

Where: App Store Connect > the app > **App Information** > **Age Ratings** > "Set Up Age Ratings" (or Edit); first the in-app controls and capabilities, then each section with a frequency level for each content type; optional Age Suitability URL; **Save** (FACTS 3.2). Role: Account Holder, Admin, App Manager or Marketing. The questionnaire is the one in force since 31 January 2026 (FACTS 3.1). Apple: "Answer the age rating questions in App Store Connect honestly" (Guideline 2.3.6, FACTS 3.2).

Frequency answers are "None" / "Infrequent or Mild" / "Frequent or Intense" (API values `NONE` / `INFREQUENT_OR_MILD` / `FREQUENT_OR_INTENSE`, FACTS 3.3); Yes/No questions are Booleans.

## 1. The answers

| Section | Question (Apple's label) | Answer | Why (from the app) |
| --- | --- | --- | --- |
| In-App Controls | Parental Controls | **No** | The app has no settings for parents to monitor or restrict a child. |
| In-App Controls | Age Assurance | **No** | The app does not confirm anyone's age (no declared-age API, no estimation, no ID check). The 16+ minimum is a rule of the Terms of Use and the privacy policy (section 10), not a mechanism in the app. |
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
| Medical or Wellness | Health or Wellness Topics | **No** | Apple's definition: "Content that provides self-care or lifestyle recommendations. May include: calorie tracking, dieting advice, or exercise recommendations." (FACTS 3.3). The app records optional sleep, stress and activity values that the user types and describes relationships in the user's own entries; it gives no recommendations (the insight texts contain no advice, only "possible relationships"; checked in `shared/i18n/messages/en/insights.ts` and `analysis.ts`). FACTS 3.4 reads it the same way. If a reviewer disagrees, "Yes" gives 9+ (FACTS 3.5) - it changes nothing for the customer, because the override below shows 16+ anyway. |
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
- **Override to Higher Age Rating: 16+.** Apple: "If your app has a EULA with minimum age requirements that exceed the rating that Apple calculated, you must override to a rating that adheres to the requirements." (FACTS 3.7). The service requires 16 years (`legal/settings.json` `minimumAge` = 16; privacy policy section 10; Terms of Use section 2, `docs/apple-tasks/TERMS.md`). The app uses Apple's standard EULA, so whether Apple counts our Terms of Use as "a EULA with minimum age requirements" is not spelled out; the override is allowed in any case ("if you believe your app should be rated higher", FACTS 3.7), so **16+** is correct either way (ANSWERS amendment 2). The store then shows 16+ while the content descriptions still reflect the answers (FACTS 3.7). The API value is `SIXTEEN_PLUS` (FACTS 3.7).
- The override applies in every region; Apple may map it to a different value per region (FACTS 3.7).

## 3. "Minimum age" and "age assurance" - how to answer

- The questionnaire has no question about accounts, sign-in or a minimum age (FACTS 3.4). The 16+ rule is expressed only through the **override**, not through any answer.
- **Age Assurance = No** is truthful: the app does not check age; registration contains a consent sentence and the Terms of Use state the minimum age, which is a contractual rule, not an age-assurance mechanism in Apple's sense ("declared age range API; age estimation capabilities; age verification via government-issued ...", FACTS 3.3).
- If App Review asks how minors are kept out: "The service's Terms of Use and Privacy Policy require users to be at least 16; the app is rated 16+ through Override to Higher Age Rating; we do not knowingly keep data of younger users and delete such an account on request (privacy policy section 10)."
