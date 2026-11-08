# Google Play - Target audience and content: recommendation and owner decision

Play Console -> your app -> **Policy -> App content -> Target audience and content**.

Sources (read 2026-10-26):
- "Manage target audience and app content settings" - https://support.google.com/googleplay/android-developer/answer/9867159
  (age groups "Age 5 and under", "Ages 6-8", "Ages 9-12", "Ages 13-15", "Ages 16-17", "Ages 18 and over"; select
  more than one group only if the app is designed and suitable for each; apps designed primarily for children under
  13 must comply with the Families Policy; "Ages 13-15" and "Ages 16-17" "may be considered to include children in
  some locales"; for users under 21, consider whether they are children under local laws; Play "may reject your
  app" if a listing that is not for children has marketing elements that appeal to children).
- GDPR Article 8(1) - https://gdpr-info.eu/art-8-gdpr/ (for information society services offered directly to a
  child on the basis of consent, the child must be at least 16, below that a parent must consent; "Member States
  may provide by law for a lower age ... not below 13 years").
- Israel: the Protection of Privacy Law sets no separate digital age of consent; a minor's consent falls under the
  general rules of the Legal Capacity and Guardianship Law (under 18), and the Privacy Protection Authority has
  required parental consent for collecting children's data (a 2012 enforcement case). Secondary sources, read
  2026-10-26 - confirm with a lawyer if the app is marketed to minors in Israel.

## The decision to make: minimum age **16** (recommended) or 13

| | 16 and over (recommended) | 13 and over |
| --- | --- | --- |
| Play age groups to tick | **Ages 16-17** and **Ages 18 and over** | Ages 13-15, 16-17 and 18 and over |
| EU | Meets the GDPR default (16) in every member state without a parental-consent step. | Several member states keep 16 (for example Germany, the Netherlands and Ireland); users aged 13-15 there would need parental consent, which the app cannot collect. |
| Israel | Teenagers of 16-17 are still minors; a personal diary used privately is the kind of everyday act the law accepts, but there is no parental step either way. | A 13-year-old's account without a parent is harder to justify. |
| Play | 16-17 "may be considered children in some locales" - no Families Policy obligations unless under 13 is ticked. | 13-15 brings more scrutiny of the listing and of the data practices. |
| The content | A diary may hold sensitive data (health, feelings, relationships) and the operator can technically read it (privacy policy section 4) - a reason not to invite young teenagers. | Same data, younger users. |

**Recommendation: 16 and over.** It is what `legal/settings.json` (`"minimumAge": 16`) puts into the privacy
policy in all 20 languages ("You must be at least 16 years old to create an account"). If the owner chooses 13,
change `minimumAge` to 13, run `node scripts/legal/build-pages.mjs`, and tick Ages 13-15 as well.

## The answers (with the recommendation)

| Question | Answer | Reason |
| --- | --- | --- |
| Target age groups | **Ages 16-17, Ages 18 and over** | The minimum age of the policy. Nothing under 13 is ticked, so the Families Policy does not apply. |
| Could your store listing unintentionally appeal to children? / Appeal to children | **No** | Calm, adult design; no cartoon characters or games; the listing texts (`play/listing/**`) and graphics (`play/graphics/**`) describe a private diary, habits and statistics. |
| Ads | The app contains **no ads** (answer "No" in the separate Ads declaration). | No ad SDK, no ad network. |
| Restrict Minor Access (only offered for "18 and over" only) | Not used | The audience includes 16-17. |

## Related, not required today

- The app does not ask for a date of birth or an age confirmation. An optional "I am at least 16 years old"
  checkbox on the registration screen would make the rule visible in the app; it is not required by Play for a
  16+ audience. Owner decision - not implemented in this package.
- If the target audience ever includes children under 13, the Families Policy, COPPA (United States) and a
  parental-consent flow come into play - a separate project.
