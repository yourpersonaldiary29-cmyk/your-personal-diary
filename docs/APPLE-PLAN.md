# Apple plan: the Mac app and the iPhone app

Status: **plan** (docs/android-tasks/APPLE-PREP.md, deliverable 1), written 2026-11-03, corrected 2026-11-06 (the build Mac's macOS floor after Xcode 27, iOS 16.0 for test iPhones, the platform split as delivered; after the first Mac build: the Mac identifier `app.yourpersonaldiary.mac`, the Keychain service name, the macOS mirror root and the status of WP-M1, WP-M2 and WP-M3; 2026-11-08: the "as built" notes of sections 7.1 and 7.2 and the status of WP-M4). Inputs read: APPLE-PREP.md, ENV.md (last update current), README sections 1, 2, 5, ARCHITECTURE.md, docs/android-tasks/HOSTED-IMPL.md items 8-14, docs/android-tasks/OFFLINE-DESIGN.md sections 5 and 7, `src-tauri/src/{lib.rs,offline.rs,opener.rs}`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `mobile/**`, `capacitor.config.ts`, `package.json`, `scripts/android/**`, `play/policy/data-safety.md`, `legal/settings.json`.

Every external requirement, price and rule below carries a source tag `[S<n>]`; section 12 lists the sources, all read with WebFetch on **2026-11-03**, S33 and S34 again and S75 on **2026-11-06** (Apple reference pages that render with JavaScript were read through Apple's own documentation feed, `developer.apple.com/tutorials/data/documentation/...json`, which serves the same text). Prices are the ones shown on that date and change without notice.

This plan changes nothing. Nothing in it may change behaviour on Windows, Android or the web; the Windows-side work it describes (section 9, WP-A1..A3) is behaviour-neutral preparation, and everything that needs a Mac is listed honestly in section 10.

---

## סיכום לבעלים

**מה זה**

* **אפליקציית Mac** = אותה קליפת Tauri 2 של אפליקציית Windows, נבנית במחשב Mac. אותו ממשק, אותו שרת, אותו יומן. במקום WebView2 של Windows, macOS מספק WKWebView.
* **אפליקציית iPhone** = אותה אפליקציית Capacitor 8 של אנדרואיד, עם יעד iOS. אותו ממשק, אותו שרת.
* ב-Windows, באנדרואיד ובאתר **שום דבר לא משתנה**. מה שאפשר להכין עכשיו ב-Windows (סידור הקוד הייעודי ל-Windows במודול פלטפורמה, הכנת פרויקט Capacitor ל-iOS) מוכן בלי שינוי התנהגות; את הבנייה, החתימה וההרצה אפשר לעשות **רק במחשב Mac**.

**מה צריך לקנות ולעשות**

1. **Apple Developer Program**: 99 דולר לשנת חברות; המחיר מוצג במטבע מקומי בזמן ההרשמה ועשוי להשתנות לפי מדינה [S2]. נרשמים כיחיד עם Apple Account עם אימות דו-שלבי; השם האישי שלך יופיע כ"מוכר" בחנות [S2]. בלי החברות אין App Store, אין TestFlight ואין חתימה (Notarization) למק [S3][S44].
2. **מחשב Mac** שמריץ **macOS Tahoe 26.6 ומעלה**: מ-28.4.2026 אפל מקבלת רק אפליקציות שנבנו ב-Xcode 26 ומעלה [S33]; ה-App Store מתקין את ה-Xcode החדש ביותר - ב-6.11.2026 זה Xcode 27.2, ו-Xcode 27 בכל גרסאותיו דורש macOS Tahoe 26.6 ומעלה (Xcode 26.6, האחרון בסדרה 26, הסתפק ב-Tahoe 26.2) [S34]; Capacitor 8 דורש Xcode 26.0 ומעלה [S54]. Tahoe רץ על Mac mini M1 (2020) ומעלה, MacBook Air M1 ומעלה ועוד [S35]. האפשרויות:
   * **Mac mini M6 חדש**: מ-899 דולר (ארה"ב) [S36]. גם Mac mini M1 יד שנייה מספיק [S35].
   * **Mac בענן לבנייה אוטומטית**: GitHub Actions - 0.062 דולר לדקת macOS, חינם לגמרי ברפו ציבורי, ובתוכנית החינמית כלולים 12 דולר בחודש (כ-190 דקות) [S70][S71]; Codemagic - 500 דקות חינם בחודש על Mac mini M2, אחר כך 0.095 דולר לדקה [S72]; MacStadium - Mac mini ייעודי מ-109 דולר לחודש [S73].
   * **ההמלצה**: Mac mini משלך. הוא גם מכשיר הבדיקה של אפליקציית ה-Mac, ובו בודקים את ה-iPhone בסימולטור. ענן מתאים לבניות חוזרות אחרי שהכול עובד.
3. **מכשיר בדיקה**: iPhone עם **iOS 16.0 ומעלה**, ל-TestFlight. זו הגרסה המינימלית שהאפליקציה נבנית אליה (סעיף 3), ולכן iPhone שנשאר ב-iOS 15 לא יכול להתקין אותה; iOS 16 רץ על iPhone 8 ועל iPhone SE (דור 2) ומעלה [S75]. הסימולטור ב-Mac מכסה את רוב הבדיקות.
4. **App Store Connect** (כלול בחברות): רשומת אפליקציה, תשובות הפרטיות, דירוג גיל, צילומי מסך, חשבון הדגמה לבודק (`stor`, כמו ב-Play). **TestFlight**: עד 100 בודקים פנימיים ו-10,000 חיצוניים, כל גרסה תקפה 90 יום [S32].

**מה מתחלף בקוד, לפי פלטפורמה** (הפירוט בסעיף 4)

* מפתח העותק לעבודה בלי חיבור: DPAPI של Windows ← **Keychain** של אפל (במק וב-iPhone).
* פתיחת הנעילה בלי חיבור: Windows Hello ← **Touch ID / Face ID או סיסמת המכשיר** (LocalAuthentication).
* פתיחת דפי המדיניות בדפדפן: ShellExecuteW ← `/usr/bin/open` במק (כך נבנה ב-WP-M2, בלי NSWorkspace ובלי רכיב חדש), UIApplication ב-iPhone.
* התראות: Toast של Microsoft Store ← מערכת ההתראות של אפל (UNUserNotificationCenter); ב-iPhone יש תקרה של 64 תזכורות מתוכננות.
* נתיבי ה-MSIX ו-WebView2 (גרסת Microsoft Store): לא פועלים במק. רק הקריאות למערכת של Windows (זהות החבילה וההתראה של ה-Store) מבודדות כך שבמק הן לא נבנות; שאר הכללים של חבילת ה-Store (התיקיות הפרטיות, פרופיל ה-WebView2, נוסח ההתראה) נשארו קוד רגיל שנבנה גם במק - אבל לא מופעל שם אף פעם, כי מחוץ ל-Windows התשובה לשאלה "האם זו חבילת Store?" היא תמיד "לא".
* "שמירה בשם" ובחירת קובץ: חלונות המערכת של אפל.

**חוקי אפל שנוגעים לאפליקציה** - כולם מתקיימים או ניתנים לקיום (סעיפים 5-6):

* **Sign in with Apple לא נדרש**: ההנחיה 4.8 פוטרת אפליקציה "שמשתמשת אך ורק במערכת החשבונות והכניסה שלה עצמה" [S4] - זה המצב שלנו.
* **מחיקת חשבון בתוך האפליקציה** - חובה [S4][S5] - קיימת (הגדרות ← מחיקת חשבון), ויש גם דף מחיקה באתר.
* **מדיניות פרטיות** - קישור בחנות ובתוך האפליקציה [S4] - קיים.
* **Privacy manifest** (קובץ PrivacyInfo.xcprivacy) ותשובות "App Privacy" בחנות - אותן תשובות כמו בטופס Data safety של Play.
* **הצהרת הצפנה** (ייצוא): האפליקציה משתמשת רק בהצפנה של מערכת ההפעלה (HTTPS, Web Crypto / CryptoKit, Keychain) - לפי אפל שימוש כזה "בדרך כלל פטור" [S28]; האישור בטופס - שלך.
* **סיכון בביקורת**: הנחיה 4.2 נגד "אתר ארוז מחדש" [S4]. יש לנו תכונות מקוריות (עבודה בלי חיבור, Face ID, תזכורות, קבצים), והממשק ארוז בתוך האפליקציה ולא נטען מהאינטרנט.

**מה אי אפשר לבדוק ב-Windows**: שום בנייה, חתימה או הרצה של Mac ו-iOS. ב-Windows מוכיחים רק שהקוד של Windows לא השתנה ושהחלקים החדשים מתקמפלים בתנאי cfg. הרשימה המלאה בסעיף 10.

**סדר העבודה** (סעיף 9): (1) עכשיו, ב-Windows: WP-A1 פיצול קוד הפלטפורמה ב-`src-tauri`, WP-A2 הכנת Capacitor ל-iOS, WP-A3 תיעוד. (2) כשיש Mac: WP-M1 בנייה ראשונה, WP-M2 מודול macOS (Keychain, Touch ID, פתיחת קישורים), WP-M3 התאמות ממשק קטנות, WP-M4 חתימה + Notarization + DMG (ואופציונלית Mac App Store). (3) iPhone: WP-I1 יצירת פרויקט ה-iOS, WP-I2 התוספים ב-Swift, WP-I3 TestFlight והגשה.

**עלות**: שנה ראשונה 99 דולר חובה + Mac (0 עד 899 דולר לפי הבחירה) + שעות העבודה. אחר כך 99 דולר לשנה.

**החלטות שצריך ממך** (סעיף 11): Mac משלך או ענן; הפצת ה-Mac כ-DMG להורדה (Developer ID) ו/או Mac App Store; שפת הפתיחה במק; הצהרת "בריאות וכושר" ב-App Privacy (כמו ההחלטה ב-Play); iPhone בלבד או גם iPad; בולגרית - ל-App Store אין לוקליזציה בולגרית (19 מתוך 20 השפות שלנו נתמכות בדף החנות; בתוך האפליקציה כל ה-20 כרגיל).

---

## 1. The two apps

| | Mac app | iPhone app |
|---|---|---|
| What it is | The same Tauri 2 shell as the Windows app (`src-tauri/`), built on macOS: a thin client of `https://yourpersonaldiary.fly.dev` (HOSTED-IMPL items 8, 10), the same `dist/` UI | The same Capacitor 8 app as the Android app (`mobile/**`, `capacitor.config.ts`), iOS target: the same `mobile-dist/` UI, server-only |
| Web engine | WKWebView (WebKit), the one that ships with macOS [S48] | WKWebView |
| Page origin | `tauri://localhost` (macOS and Linux use `<scheme>://localhost`; Windows and Android use `http(s)://<scheme>.localhost`) [S46]. Already allowed by the server: `ALLOWED_ORIGINS` in `server/src/middleware/access.ts:15` | `capacitor://localhost` (Capacitor's default `server.iosScheme` is `capacitor`; it cannot be `http`/`https` on iOS) [S57]. Already allowed: `HOSTED_ORIGINS` in `access.ts:29` ("the iOS scheme reserved for a later build") |
| Identifier | `app.yourpersonaldiary.mac` (the `identifier` of `src-tauri/tauri.macos.conf.json`, which Tauri merges on macOS only [S47]; the Windows app keeps `com.mydiary.app` of `tauri.conf.json` - on macOS Tauri warns that an identifier ending in `.app` conflicts with the app-bundle extension). An App Store Connect bundle ID would be this one: it must equal the identifier [S45] | `app.yourpersonaldiary` (`capacitor.config.ts` `appId`, used when `cap add` creates the project; same as Android). WP-I1 checks in App Store Connect that this bundle ID is still free for a new App ID |
| Artefacts | `.app` and `.dmg` from `tauri build` on a Mac [S42][S43]; optionally a signed `.pkg` for the Mac App Store [S45] | `.ipa` from Xcode, uploaded to App Store Connect, tested through TestFlight, released on the App Store [S69][S32] |
| Minimum OS (section 3) | macOS 12.3 (recommended `bundle.macOS.minimumSystemVersion: "12.3"`; Tauri's default is 10.13 [S42][S46]) | iOS 16.0, the deployment target (`scripts/ios/README.he.md` step 5.4): no iPhone on an older iOS can install the app. The web engine alone would allow iOS 15.4, Capacitor 8 needs 15.0 [S56] |

What stays identical by construction: the UI bundles, the API client (`src/api/client.ts`), the offline engine (`src/offline/**`, OFFLINE-DESIGN section 7: one implementation, platform seams), the CSP (`'self'` + the one server origin), the 20 locales, the file formats.

## 2. What the owner must buy or do

### 2.1 Apple Developer Program

* Fee: "The Apple Developer Program is 99 USD per membership year. Prices may vary by region and are listed in local currency during the enrollment process." [S2] (The programs page shows "$99 annual membership" [S1].)
* What it includes: TestFlight ("Invite testers and manage beta builds with TestFlight"), App Store distribution, Xcode Cloud-free code-level support [S1].
* Enrolling as an individual: "an Apple Account with two-factor authentication turned on and be the legal age of majority in your region"; "Your personal legal name is needed so that you can enter into contracts with Apple. Your name will be displayed as the seller name of your apps on the App Store"; email, phone and address, no P.O. boxes [S2]. The publisher name in `legal/settings.json` (`publisherName`) must then match the seller name shown by Apple (owner check).
* Without the paid program: a free Apple account can run apps on up to 3 of your own devices for 7 days, with up to 10 App IDs [S3]; "To build more advanced app capabilities and distribute apps, you'll need to be an Apple Developer Program member" [S3]; Tauri: with the free plan "you will not be able to notarize your application" [S44].
* Developer ID certificates (needed for a Mac download outside the store) are generated by the **Account Holder** of the team [S10]; as an individual you are the Account Holder.

### 2.2 A Mac: buy or rent

Hard facts that decide the Mac:

* App Store Connect accepts only apps built with Xcode 26 or later (SDK iOS 26 etc.) since 2026-04-28 [S33]. The Mac App Store installs the newest Xcode: on 2026-11-06 that is Xcode 27.2 (27.3 is in beta), and Xcode 27, 27.1 and 27.2 all need "macOS Tahoe 26.6 or later"; the last 26.x release, Xcode 26.6, runs on "macOS Tahoe 26.2 - macOS Tahoe 26.x" [S34]. **So the build Mac needs macOS Tahoe 26.6 or later.** Capacitor 8 "requires a minimum of Xcode 26.0" [S54][S56]; Tauri needs Xcode (or the Command Line Tools for desktop-only builds), Rust and a macOS 10.15+ host [S41].
* macOS Tahoe 26 runs on Mac mini (M1, 2020), (2023), (2024); MacBook Air (M1, 2020) and later; MacBook Pro (13-inch, M1, 2020) and later, plus some 2019/2020 Intel models [S35]. Any Apple-silicon Mac is enough; Xcode and simulators want 16 GB RAM in practice.
* iOS apps cannot be built on Windows at all: "To build iOS apps, you will need macOS" [S54][S55]; code signing for macOS "requires an Apple Developer account which is either paid (99$ per year)" and "You also need an Apple device where you perform the code signing" [S44].

| Option | Price (2026-11-03) | Good for | Limits |
|---|---|---|---|
| **Own Mac mini M6** | from $899 (U.S.), $799 education [S36]; a used Mac mini M1 (2020) also runs Tahoe [S35] | everything: builds, signing, notarization, Xcode, iOS Simulator, manual QA of the Mac app, Wireless debugging of the iPhone | one-time cost |
| **GitHub Actions macOS runner** (CI) | $0.062/min for the standard macOS runner, $0.077/min 12-core, $0.102/min 5-core M2 Pro [S71]; public repositories: standard runners free; GitHub Free includes $12/month of compute (about 193 standard macOS minutes) [S70] | repeatable builds, `cargo test` on macOS, Xcode archives, signing/notarization and TestFlight uploads with the certificate and an App Store Connect API key stored as CI secrets | no screen: no manual QA, no Simulator interaction; the project is private, so minutes count |
| **Codemagic** (CI for mobile) | 500 free Mac mini M2 minutes per month, then $0.095/min (M2) or $0.114/min (M4); fixed plans from $3,990/year [S72] | the same as GitHub Actions, with App Store/TestFlight publishing built in | same |
| **MacStadium** (hosted dedicated Mac) | Mac mini M2.S $109/month, M4.S $149/month, up to M4.L $349/month, billed monthly [S73] | a real Mac you reach over the network: Xcode, Simulator, manual QA of the Mac app by screen sharing | monthly cost; no physical iPhone attached |
| **AWS EC2 Mac** | Dedicated Hosts, "per second with a 24-hour minimum allocation period" [S74]; the hourly rate is on AWS's pricing pages, not quoted here | occasional long sessions | 24-hour minimum, more setup than the others |

Recommendation: a Mac mini of your own (new M6 or used M1+), because the Mac app needs a human on a Mac anyway (section 10), and later a CI runner for repeat builds if wanted.

### 2.3 Test devices

* Mac: the build Mac itself (macOS Tahoe; the app must also be smoke-tested on the oldest macOS you declare, see section 3).
* iPhone: one device with iOS 16.0 or later - the deployment target (section 3), so a device that stays on iOS 15 cannot install the build; iOS 16 runs on iPhone 8 and iPhone SE (2nd generation) and later [S75] - with the TestFlight app ("Testers install the free TestFlight app on their devices" [S32]). The iOS Simulator in Xcode covers layout, 20 locales, offline mode logic and the plugins' logic; Keychain, Face ID hardware, notifications timing, Files app flows and real network behaviour must be tried on the device.
* iPad: only if the owner decides to support it (section 11); then a 13-inch screenshot set is mandatory [S37].

### 2.4 App Store Connect and TestFlight

* One app record per platform family (iOS; macOS if the Mac goes to the Mac App Store), with: privacy policy URL (`https://yourpersonaldiary.fly.dev/privacy/`, required in the metadata and inside the app [S4]), the App Privacy answers (section 6.2), the age rating questionnaire (new system since 2026-01-31 [S33]), screenshots (section 5.7), review notes with the demo account (`stor`, as for Google Play: `play/policy/app-access.md`) - "include demo account info (and turn on your back-end service!) if your app includes a login" [S4].
* TestFlight: "up to 10,000 people" external testers, "up to 100 App Store Connect users" internal; "You can test a build for up to 90 days"; the first external build goes through App Review ("A review is required only for the first build") [S32]; platforms "iOS macOS visionOS tvOS watchOS" [S32].

## 3. Toolchain and version floors

| Item | Fact | Source |
|---|---|---|
| Xcode for uploads | "Apps uploaded to App Store Connect must be built with Xcode 26 or later using an SDK for iOS 26 ..." since April 28, 2026 (still the newest such rule on 2026-11-06) | [S33] |
| Xcode 27.x (the Mac App Store's Xcode: 27.2 is the newest release on 2026-11-06, 27.3 is in beta) | Xcode 27, 27.1, 27.2 and 27.3 beta: "macOS Tahoe 26.6 or later"; deployment targets iOS 15-27, macOS 12-27; Swift 6.4 compiler | [S34] |
| Xcode 26.6 (the last 26.x) | runs on macOS Tahoe 26.2 - 26.x; deployment targets iOS 15-26.5, macOS 11-26.5; Swift 6.3 compiler | [S34] |
| Capacitor 8 | Node.js 22+, Xcode 26.0+, iOS deployment target 15.0, Swift Package Manager is the default package manager for new iOS projects (CocoaPods through `npx cap add ios --packagemanager CocoaPods`); Android stays at minSdk 24 / SDK 36 / AGP 8.13.0 / Gradle 8.14.3, as the project already is | [S56][S54][S60][S61] |
| Tauri 2 on macOS | Xcode or Command Line Tools (`xcode-select --install`), Rust (rustup), macOS Catalina 10.15+ host; the `.app` is built with `tauri build --bundles app` on a Mac; `--target universal-apple-darwin` gives one binary for Apple silicon and Intel | [S41][S42][S45] |
| WebKit floor | The offline engine uses `structuredClone` (`src/offline/store/memory.ts`), the Web Locks API and `BroadcastChannel` (`src/offline/replayer.ts`, `engine.ts`); Safari 15.4 "Added `self.structuredClone()`" and "Added support for the Web Locks API" and ships "with the iOS and iPadOS 15.4 and macOS 12.3" | [S39] |
| `AbortSignal.any` | used with a hand-linked fallback (`src/api/client.ts:355`); added in Safari 17.4 (iOS 17.4, macOS Sonoma/Ventura/Monterey) - no floor | [S40] |
| `crypto.randomUUID` | used with a fallback (`src/offline/crypto.ts:79`) - no floor | code |
| Resulting floors | **macOS 12.3** (`bundle.macOS.minimumSystemVersion: "12.3"`; Tauri's default "10.13" is below the engine's needs [S46]); **iOS 16.0**, the deployment target WP-I1 sets (`scripts/ios/README.he.md` step 5.4) and therefore the oldest iOS the app installs on, test devices included: the engine itself would run from 15.4, and 16.0 means fewer OS variants to test, inside Capacitor's 15.0 floor and the deployment range of Xcode 26.6 and 27.x (both from iOS 15); **build Mac: macOS Tahoe 26.6** or later, the floor of the App Store's Xcode 27.x | [S39][S56][S34] |
| Mac architecture | universal build (`aarch64` + `x86_64`): Tahoe still runs on 2019/2020 Intel MacBook Pros [S35]; Tauri: Apple-silicon-only builds need `minimumSystemVersion` 12.0 anyway | [S45] |

## 4. Per-platform replacements

The Windows-only code was in `src-tauri/src/lib.rs` (package identity, MSIX data folders, WebView2 profile redirect, Store toast), `offline.rs` (DPAPI, mirror root, Windows Hello) and `opener.rs` (ShellExecuteW). WP-A1 moved its operating-system calls - DPAPI, Windows Hello, `ShellExecuteW`, the kernel32 package identity and the WinRT toast - behind `src-tauri/src/platform/{mod.rs,windows.rs,unsupported.rs}`, so that macOS is "add `macos.rs`" (section 9). The MSIX rules themselves (the package folders, the WebView2 profile redirect, the AppUserModelID and the toast XML in `lib.rs`, the package branch of the mirror root in `offline.rs`) stayed where they were: portable path and text code, compiled for every target, that acts only when `platform::package_identity::family_name()` names a package - never outside Windows (WP-A1 below). The table is the contract of the platform module and of the iOS plugins.

| Concern | Windows today | macOS (Tauri, `platform/macos.rs`) | iOS (Capacitor, Swift plugins) |
|---|---|---|---|
| **Offline key (AOK) at rest** (OFFLINE-DESIGN 5.1) | `CryptProtectData`, current user, entropy `ypd-offline-v1:<userId>`; the blob lives in IndexedDB; `remove()` is a no-op (`src/offline/native/tauri.ts:60`) | As built (WP-M2, `platform/macos.rs`): a Keychain generic-password item - service `app.yourpersonaldiary.mac.offline.v1`, account `<userId>`, data = the AOK bytes, label "Your Personal Diary offline key", `kSecAttrGeneric` = a 16-byte random nonce, never synchronizable - through the `objc2-security` bindings 0.3.2 (Zlib/Apache-2.0/MIT: `SecItemAdd` / `SecItemCopyMatching` / `SecItemDelete`, `SecRandomCopyBytes`), not the `security-framework` crate [S52] first planned. Where: the data-protection keychain (`kSecUseDataProtectionKeychain = true` [S18] with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` [S19]) only when the build has the keychain entitlements (a signed build with a provisioning profile, WP-M4); otherwise - today's ad-hoc build, which gets errSecMissingEntitlement (-34018) from every write there - the user's login keychain, named explicitly in every call, with no device-only class (a Migration Assistant or Time Machine copy carries it, still locked with the login password). `wrap` reads the account's item first and keeps it when this build can read it and it holds the same key (the same marker, nothing written); otherwise it replaces it (delete + add) and answers the marker `keychain-v1:<dp|file>:<userId>:<32 hex>` (text, no secret), which offline.rs base64-encodes and the engine keeps in IndexedDB as today; `unwrap` checks version, place, user id and nonce and reads the item; the command **`offline_key_remove`** (WP-M3) deletes it in both places. Every vault call is serialized and runs with the Keychain's user interaction switched off: a read that would need the legacy keychain's dialog fails (-25293 / -25308) instead of prompting, so a rebuilt ad-hoc app cannot read the previous build's item and replaces it at its next online start (the first offline start after an update shows "no connection"). No new cryptography in the shell. Details and the experiments: `scripts/mac/README.he.md` appendix D | `DiaryOffline` Swift plugin with the same JS contract as Android (`mobile/plugins/diary-offline/index.ts`): a random 256-bit key-encryption key in the Keychain (same accessibility), the AOK wrapped with CryptoKit `AES.GCM.seal(_:using:nonce:authenticating:)` (iOS 13+) [S22] with the additional data `ypd-offline-v1:<userId>` exactly as `DiaryOfflinePlugin.java`; blob in IndexedDB; `deleteKey` removes the key. Hardening option for later: a Secure Enclave P-256 key ("Works only with NIST P-256 elliptic curve keys ... elliptic curve Diffie-Hellman key exchange (and by extension, symmetric encryption)" with `eciesEncryptionCofactorX963SHA256AESGCM`; Macs with Touch ID or M1+, iPhones with A7+) [S21] |
| **Device user check** (offline unlock, 5.7) | `UserConsentVerifier` / `IUserConsentVerifierInterop` (Windows Hello) | `LAContext.canEvaluatePolicy` / `evaluatePolicy(.deviceOwnerAuthentication, localizedReason:)` - "biometry, Apple Watch, or the device passcode" (on a Mac: Touch ID or the account password) [S14][S15], through the `objc2-local-authentication` crate 0.3.2 (Zlib/Apache-2.0/MIT; targets aarch64/x86_64-apple-darwin) [S53]. Mapping: success -> `ok`; `userCancel`/`systemCancel`/`appCancel` -> `cancelled`; `authenticationFailed` -> `failed`; not available/not enrolled/passcode not set -> `unavailable`. `available()` = `canEvaluatePolicy`. No usage string is needed for Touch ID ("The system doesn't require a comparable usage description for Touch ID") [S14] | `DiaryOffline.canVerifyUser` / `verifyUser`: the same `LAContext` with `.deviceOwnerAuthentication` (Face ID / Touch ID / passcode) [S14][S15]; **`NSFaceIDUsageDescription` in Info.plist is required** ("This key is required if your app uses APIs that access Face ID") [S16], localised in the 20 languages |
| **External URL opener** (legal pages only, `opener.rs`) | `ShellExecuteW` after `open_checked` | As built (WP-M2): `open_checked` (the allow-rule) stays shared; the platform call is `/usr/bin/open <url>` through `std::process::Command` - the checked https address as one argument of its own, no shell, working folder `/` - the same tool the Tauri opener plugin uses on macOS [S49], and no crate (`NSWorkspace.shared.open(url)` [S23] and the plugin were the planned alternatives). The JS side is unchanged (`PrivacyPolicyLink.tsx` already calls `open_external_url` whenever `isTauri()`), so the links work in every Mac build that has `macos.rs`, independent of the offline adapter | No shell command: as on Android, the anchor's own default action is enough - Capacitor hands a link to another origin to the system browser (`UIApplication.open(_:options:completionHandler:)`: "If the specified URL scheme is handled by another app, iOS launches that app" - `http`/`https` are supported schemes) [S24]; keep `server.allowNavigation` unset so the server's pages never load inside the WebView (verify on the Simulator, section 10) |
| **Store toast / reminders** | NSIS: `tauri-plugin-notification`; MSIX: WinRT toast (`show_store_notification`), because a packaged app must use its own AppUserModelID | `show_store_notification` answers `not-packaged` (no package identity outside Windows), so `useReminders.ts` keeps the plugin: `tauri-plugin-notification` lists macOS [S50]; the minute poll (`REMINDER_POLL_MS`) stays. Apple's API underneath: `UNUserNotificationCenter`, macOS 10.14+ [S26]. Verify that notifications show from the signed, bundled app (section 10) | `@capacitor/local-notifications` (UNUserNotificationCenter; since 8.3.0 `schedule()` asks for permission if not granted) [S62]. Android-only options (`channelId`, `smallIcon`, `isExactNotification`, `allowWhileIdle`, `createChannel`) are ignored or must be skipped on iOS [S62]. **Cap**: "the system keeps the soonest-firing 64 notifications ... and discards the rest" [S27] - the platform passes `maxScheduled: 60` (the scheduler already supports `maxScheduled`, `mobile/platform/notifications.ts`), so 14 days x up to 4 habits; more habits shorten the horizon. No boot receiver exists on iOS; pending requests "remain active until ... you cancel them explicitly" [S25] |
| **Save dialog** (backup / export, `save_file`) | `tauri-plugin-dialog` save + `std::fs::write` | The same command: the dialog plugin supports macOS (NSSavePanel) [S51]. Under App Sandbox (Mac App Store only) the write needs `com.apple.security.files.user-selected.read-write` [S12] | `DiaryFiles` Swift: `createDocument` answers a temp `file://` URI at once; `openWrite`/`writeChunk` append to the temp file; `closeWrite` presents `UIDocumentPickerViewController(forExporting:)` and resolves after the user chose a place - so **cancel surfaces at `closeWrite`** (code `CANCELLED`), which `mobile/platform/files.ts` must map to `'cancelled'` on iOS (today it would throw) |
| **Restore picker** | `<input type="file">` | the same (NSOpenPanel) | `DiaryFiles.openDocument` -> `UIDocumentPickerViewController(forOpeningContentTypes: [.data])`, then `openRead`/`readChunk` with `FileHandle` under `startAccessingSecurityScopedResource` |
| **"Open with" a `.mpd`** | not registered on Windows | not planned (could use `CFBundleDocumentTypes` later) | `CFBundleDocumentTypes` ("The document types supported by the bundle", iOS 2.0+) [S31] with an imported UTI for `.mpd`; the file URL arrives through Capacitor's `appUrlOpen` ("Universal Links on iOS") / `getLaunchUrl` [S65]; the plugin keeps the `seq` semantics of `takeOpenedFile` / `openFile` |
| **Package identity, MSIX data folders, WebView2 profile** | `package_identity`, `packaged_webview_data_dir`, `redirect_webview_profile_when_packaged` (`WEBVIEW2_USER_DATA_FOLDER`), `packaged_data_dir` (local mode) | Not applicable, through one gate: `platform::package_identity::family_name()` answers `None` outside Windows (the stub's answer, which `macos.rs` will re-use - `platform/mod.rs`, "Adding an implementation"), so `own_package_family_name()` is `None`, no package folder is selected, the profile redirect does nothing and WKWebView keeps its default persistent data store. The path and text functions are compiled on macOS too, and stay inert there (Rust test `without_a_package_identity_the_store_package_rules_never_apply`). **The three literal strings `scripts/store/msix-lib.mjs` looks for in the Windows exe (`WEBVIEW2_USER_DATA_FOLDER`, `offline mirror: no local data folder`, `msix-store-toast`) must stay in the Windows build** - WP-A1 acceptance | n/a |
| **Outbox mirror root** (5.4) | `%LOCALAPPDATA%\com.mydiary.app\offline\<userId>` (package-private inside MSIX) | `~/Library/Application Support/app.yourpersonaldiary.mac/offline/<userId>` (`app.path().local_data_dir()`, which Tauri resolves to `~/Library/Application Support`, plus the macOS identifier; under App Sandbox inside the app container) - the same atomic `.tmp` + rename code, which is already portable Rust | `@capacitor/filesystem` `Directory.Data` is **the Documents directory on iOS** ("Data ... On iOS, uses the Documents directory") [S63], so `offline/<userId>/` lands in Documents: keep `UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace` unset (then Documents is not shown in the Files app) [S63], and let the `DiaryOffline` plugin mark the `offline` folder `isExcludedFromBackup = true` at start ("To indicate the system can exclude a group of related files from iCloud Backup, move those files into a directory and update the directory's isExcludedFromBackup resource value"; note Apple calls it guidance, not a guarantee) [S30]. Files in the container are protected by iOS Data Protection by default; the plugin can raise its own files to `completeUntilFirstUserAuthentication` explicitly |
| **Startup language** | NSIS `install-locale.txt`; MSIX: English | A `.app` has no installer, so `get_install_locale()` is `None` and the Mac opens in English, like the MSIX build (`src/i18n/runtime.ts` `detectLocale`: the desktop ignores system languages by owner decision). Owner decision (section 11): keep English, or a Mac-only rule "system language when it is one of the 20" | Same as Android: `detectLocale` uses `navigator.languages` in the native app, which WKWebView fills from the iOS language list (verify on the Simulator) |
| **Privacy screen** | n/a | n/a | `DiaryPrivacyScreen` Swift: a cover view while the app is inactive (so the app switcher snapshot is blank); iOS has no FLAG_SECURE, screenshots cannot be blocked - the setting text on iOS must say "hide content in the app switcher" only (texts in 20 locales, `mobile.*` keys) |
| **Lifecycle, Back** | n/a | n/a | `appStateChange` works on iOS (willResignActive / didBecomeActive) [S65]; `backButton` and `minimizeApp` are Android-only [S65] - the listeners are harmless no-ops; the `suspendLock` logic stays (document pickers are in-process on iOS, so `appStateChange` does not fire for them - verify) |
| **Share** | n/a | n/a | `@capacitor/share` works on iOS with `files` as `file://` URLs [S64]; the copy in `Directory.Cache` stays |
| **System bars / theme** | n/a | n/a | Capacitor's SystemBars plugin on iOS styles the status bar; `env(safe-area-inset-*)` already in `src/styles/mobile.css` (verify) |
| **Biometric unlock of the server lock** (`BIOMETRIC_UNLOCK_ENABLED = false`) | n/a | n/a | stays off; the iOS `DiaryBiometric` skeleton answers `unsupported` until the server contract of `mobile/platform/biometric.ts` exists; the future implementation is a Keychain item with `SecAccessControlCreateWithFlags(..., .biometryCurrentSet)` (the CryptoObject analogue) [S21] |
| **CSP / origins** | `http://tauri.localhost`, CSP in `tauri.conf.json` | `tauri://localhost` [S46], same CSP; `isSecureContext` on this custom scheme must be verified (section 10), otherwise offline mode stays off by design (OFFLINE-DESIGN 5.2) | `capacitor://localhost` [S57]; CSP from `mobile/index.html` + the server origin added by the mobile build; same `isSecureContext` check on the device |
| **Network rules** | ATS n/a | n/a (no ATS on Tauri's side; WKWebView enforces TLS as Safari does) | App Transport Security is on by default for apps linked against iOS 9+ SDKs: HTTPS, TLS 1.2+, RSA 2048+/ECC 256+, SHA-256, ECDHE forward secrecy [S29]; `yourpersonaldiary.fly.dev` must satisfy it (verify with `nscurl --ats-diagnostics` on the Mac); no `NSAllowsArbitraryLoads` (justification required and extra review) [S29] |

## 5. Apple's review and privacy rules that touch this app

| Rule | Text (verbatim where it matters) | Status for Your Personal Diary |
|---|---|---|
| 4.8 Login Services | "Apps that use a third-party or social login service (such as Facebook Login, Google Sign-In ...) ... must also offer as an equivalent option another login service ... Another login service is not required if: Your app exclusively uses your company's own account setup and sign-in systems." [S4] | **Sign in with Apple is not required.** The app has only its own username/e-mail + password accounts (`server/src/security/*`, README 3.1); no third-party login exists. Nothing to add. |
| 5.1.1(v) Account Sign-In | "If your app supports account creation, you must also offer account deletion within the app." [S4]; "Offer to delete the entire account record, along with associated personal data ... only offering to temporarily deactivate or disable an account is insufficient"; "It's appropriate to confirm the user genuinely intends to delete their account"; a website link is allowed only as a direct link to the deletion page [S5] | **Met.** Settings -> "Delete account" (password + confirmation) deletes the account, diary, habits, settings, sessions and reset links on the server and the device copy (ARCHITECTURE 5, README 3.4); the web page `https://yourpersonaldiary.fly.dev/delete-account/` exists for people who cannot sign in. |
| 5.1.1(i) Privacy policy | "All apps must include a link to their privacy policy in the App Store Connect metadata field and within the app in an easily accessible manner", and the policy must say what is collected, how, all uses, third parties, retention/deletion and how to revoke consent [S4] | **Met**: the Privacy card links `https://yourpersonaldiary.fly.dev/privacy/` (20 locales, `legal/`). The Keychain wording for Mac/iPhone (today the policy says "Windows Data Protection or ... the Android Keystore", OFFLINE-DESIGN section 10) is a `legal/**` change that is **not** part of this package: handed to the main session (section 11). |
| 5.1.1(ii)-(iv), 5.1.2(i) | consent for data collection, data minimisation, respect permission settings; "you may not use, transmit, or share someone's personal data without first obtaining their permission" [S4] | Registration asks only name, e-mail, user name, password and the privacy checkbox (README 3.1); permissions requested only from the feature that needs them (notifications from the Reminders card; Face ID on the lock screen). No analytics, no SDKs (`scripts/check-no-network.mjs`). |
| 2.1(a) App Completeness | "include demo account info (and turn on your back-end service!) if your app includes a login"; the "Before You Submit" list: "provide either an active demo account or fully-featured demo mode" [S4] | The demo account `stor` of `play/policy/app-access.md` (password only in the consoles) goes into App Store Connect -> App Review Information. The Android-only "Skip - just look around" tour is not on iOS by owner decision (HOSTED-IMPL 12) unless the owner extends it (section 11). |
| 4.2 Minimum Functionality | "Your app should include features, content, and UI that elevate it beyond a repackaged website. If your app is not particularly useful, unique, or 'app-like,' it doesn't belong on the App Store." [S4] | **Risk to manage**: the UI is a bundled web app. Arguments: the UI is packaged in the app (no `server.url`), it works offline with a native Keychain-protected cache, Face ID / Touch ID unlock, native notifications, native file export/import and "open with", 20 locales, full screen-reader support. Review notes should say so. |
| 2.3 Accurate metadata | "make sure all your app metadata, including privacy information, your app description, screenshots, and previews accurately reflect the app's core experience" [S4] | The App Privacy answers (section 6.2) must match `legal/privacy/*` and `play/policy/data-safety.md`. |
| Privacy manifest | `PrivacyInfo.xcprivacy` records "The types of data collected by your app" (all platforms) and "The required reasons APIs your app ... uses" (iOS, iPadOS, tvOS, visionOS, watchOS) [S6]; "Starting May 1, 2024, apps that don't describe their use of required reason API in their privacy manifest file aren't accepted by App Store Connect" [S7] | iOS: needed (section 6.1). macOS Tauri app: data types only (no required-reason declaration on macOS per [S6]); only relevant for the Mac App Store route. |
| Export compliance | "Set the value to NO if your app ... doesn't use encryption, or if it only uses forms of encryption that are exempt"; "Typically, the use of encryption that's built into the operating system - for example, when your app makes HTTPS connections using URLSession - is exempt" [S28] | The apps use HTTPS (OS), Web Crypto AES-GCM in WebKit (OS), CryptoKit / Keychain (OS); the server-side scrypt/AES runs on the server, not in the app. Expected answer `ITSAppUsesNonExemptEncryption = NO` in both Info.plists [S28][S45]; Apple also notes a possible year-end self-classification report to the U.S. government even for exempt uses [S28] - owner reads the linked guidance and decides. |
| Age rating | "Provide responses to the updated age rating questions for each of your apps by January 31, 2026" [S33] | New questionnaire per app; the policy's minimum age is 16 (`legal/settings.json` `minimumAge`) - answer consistently. |
| ATS | on by default; exceptions need justification [S29] | No exceptions planned. |
| Notarization (Mac outside the store) | "Beginning in macOS 10.15, all software built after June 1, 2019, and distributed with Developer ID must be notarized"; requirements: Developer ID certificate, Hardened Runtime, secure timestamp, no `get-task-allow`; "not required to notarize software that you distribute through the Mac App Store" [S9]; "To upload a macOS app to be notarized, you must enable the Hardened Runtime capability" [S13] | Tauri does it: `hardenedRuntime` defaults to `true` [S46]; notarization credentials through environment variables [S44] (section 7.1). |
| App Sandbox (Mac App Store only) | "To distribute a macOS app through the Mac App Store, you must enable the App Sandbox capability" [S12]; outside the store it is "Recommended" [S11] | Needed only for the Mac App Store route (section 7.2). |

## 6. Privacy: manifest and App Privacy answers

### 6.1 `PrivacyInfo.xcprivacy` (iOS app, `ios/App/App/PrivacyInfo.xcprivacy`)

* `NSPrivacyTracking`: `false`; `NSPrivacyTrackingDomains`: empty (no tracking, no third-party domains; the app talks to one origin) [S6].
* `NSPrivacyCollectedDataTypes`: the same facts as the Play Data safety form (`play/policy/data-safety.md`): Name, Email Address, User ID (user name + account id), Other User Content (the diary), optionally Health and Fitness (sleep, stress, exercise fields - the owner's Play decision applies, section 11); each "linked to the user", "not used for tracking", purpose "App Functionality" [S8]. Search questions are answered in memory and not stored - under Apple's definition ("transmitting data off the device in a way that allows you ... to access it for a period longer than what is necessary to service the transmitted request in real time") they are not "collected" [S8]. IP addresses used only as in-memory rate-limit keys have no Apple data type; the privacy policy discloses them - owner decision whether to list "Other Data Types" (section 11).
* `NSPrivacyAccessedAPITypes` (required reasons) [S7]:
  * `NSPrivacyAccessedAPICategoryUserDefaults`, reason `CA92.1` - `@capacitor/preferences` stores in `UserDefaults` on iOS and requires exactly this entry [S66][S68]; our Swift plugins (`DiaryPrivacyScreen` setting, `DiaryOffline` account set) use `UserDefaults` too.
  * `NSPrivacyAccessedAPICategoryFileTimestamp`, reason `C617.1` - required by `@capacitor/filesystem` ("the required dictionary key is `NSPrivacyAccessedAPICategoryFileTimestamp` ... the recommended reason is C617.1"; the file "must" be created "in `/ios/App`") [S63].
* Capacitor's guidance: create the file in Xcode (File > New File > App Privacy) [S68].

### 6.2 App Privacy answers (App Store Connect, both apps)

| Apple data type | Collected | Linked to user | Tracking | Purpose | Reason (same as Play) |
|---|---|---|---|---|---|
| Contact Info > Name | yes | yes | no | App Functionality | first and last name at registration |
| Contact Info > Email Address | yes | yes | no | App Functionality | sign-in, password reset, security notices; no marketing |
| Identifiers > User ID | yes | yes | no | App Functionality | user name and account id |
| User Content > Other User Content | yes | yes | no | App Functionality | the diary (entries, habits, settings) |
| Health & Fitness > Health, Fitness | owner decision | yes | no | App Functionality | optional sleep / stress / exercise fields (Play: declared conservatively) |
| Search History | **no** | - | - | - | answered in memory, never stored on the server (Apple's "collect" definition [S8]) |
| Diagnostics, Usage Data, Location, Contacts, Purchases, Browsing History, Device ID | no | - | - | - | no analytics, crash reporting, ads or SDKs (`check-no-network`) |

"Data not linked to you" and "Data used to track you" stay empty. Apple: "You're responsible for keeping your responses accurate and up to date ... you do not need to submit an app update in order to change your answers" [S8].

## 7. Signing, notarization and distribution steps

### 7.1 Mac, download outside the store (Developer ID + notarization) - the first route

1. Apple Developer Program [S2]; in Certificates, Identifiers & Profiles create a **Developer ID Application** certificate (Account Holder) [S10][S44].
2. `src-tauri/tauri.macos.conf.json` (merged automatically on macOS by JSON Merge Patch, so Windows builds are untouched [S47]): `bundle.targets: ["app", "dmg"]`, `bundle.macOS.minimumSystemVersion: "12.3"`, `bundle.macOS.entitlements` unset for Developer ID (no sandbox), `bundle.macOS.dmg` layout [S43][S46]; `src-tauri/Info.plist` with `ITSAppUsesNonExemptEncryption = false` (merged into the generated Info.plist [S42]).
3. On the Mac: `APPLE_SIGNING_IDENTITY="Developer ID Application: <name> (<TEAMID>)"` (or `APPLE_CERTIFICATE` + `APPLE_CERTIFICATE_PASSWORD` for CI) and notarization credentials `APPLE_ID` + `APPLE_PASSWORD` (app-specific password) + `APPLE_TEAM_ID`, or `APPLE_API_ISSUER` + `APPLE_API_KEY` + `APPLE_API_KEY_PATH`; then `npm run tauri build -- --bundles app dmg --target universal-apple-darwin` [S44][S45]. "Notarization is required when using a Developer ID Application certificate" [S44]; Tauri signs with the hardened runtime (`hardenedRuntime` default `true` [S46]) and staples (skip with `--skip-stapling`) [S44].
4. Verify on a second Mac user/account: Gatekeeper launches the stapled app without the "unidentified developer" block [S9][S10]; `spctl --assess` is the command-line check.
5. The `.dmg` is distributed like the Windows installer (the owner's channel; a download page on the server is a later, separate decision).

As built (2026-11-08, WP-M4; owner's guide `docs/MAC-RELEASE.he.md`): the route is one script, `scripts/mac/release.sh`. It differs from the steps above in three places. (a) The DMG is not Tauri's `dmg` bundle target (its layout step drives Finder through AppleScript, impossible over SSH): `scripts/mac/make-dmg.sh` makes it with `hdiutil create -format UDZO -fs HFS+` from a staging folder (app + `Applications` symlink) and verifies it by mounting and `cmp`; `tauri.macos.conf.json` keeps `bundle.targets` `["app"]`. (b) Notarization is not Tauri's `APPLE_ID`/`APPLE_PASSWORD` environment route: the script unsets those for the build and runs `xcrun notarytool submit --keychain-profile ypd-notary --wait` itself (printing Apple's log every time), then `xcrun stapler staple`, on the app and again on the DMG - which it first code-signs with the same identity, as Apple's packaging guide says (APPSTORE-FACTS.md 9.4) - and ends with `spctl --assess --type execute` (app) and `spctl --assess --type open --context context:primary-signature` (DMG); the owner creates the profile once with `xcrun notarytool store-credentials`. (c) The hardened-runtime entitlements file exists and is empty: `src-tauri/entitlements/developer-id.plist`. `src-tauri/Info.plist` (`ITSAppUsesNonExemptEncryption = false`, `NSHumanReadableCopyright`) and `bundle.category: "Lifestyle"` were verified in the universal build's Info.plist. Without a certificate the script builds the ad-hoc universal app and the DMG and exits with code 2 and a warning (run end to end on the build Mac); the signed path is untested until the owner has the certificate.

### 7.2 Mac App Store (optional second route)

App Store Connect record with bundle ID `app.yourpersonaldiary.mac` (the macOS identifier, section 1) [S45]; `Entitlements.plist` with `com.apple.security.app-sandbox = true` (required for the store [S12]), `com.apple.application-identifier = $TEAM_ID.app.yourpersonaldiary.mac`, `com.apple.developer.team-identifier` [S45], plus `com.apple.security.network.client` ("may open outgoing network connections") and `com.apple.security.files.user-selected.read-write` ("read-write access to files the user has selected using an Open or Save dialog") [S12] for the server connection and `save_file`; the "Mac App Store Connect" provisioning profile as `embedded.provisionprofile` under `bundle.macOS.files`; `bundle.category`; build with `--bundles app --target universal-apple-darwin`; `xcrun productbuild --sign "<Mac Installer Distribution identity>"` to a `.pkg`; upload with `xcrun altool --upload-app --type macos` using an App Store Connect API key; the build then appears in TestFlight [S45]. Since 2025-02-18 the uploaded app must not carry the `com.apple.quarantine` attribute [S33]. The Keychain code must then use the data-protection keychain and may need the `keychain-access-groups` entitlement (verify on the Mac, section 10).

As built (2026-11-08, WP-M4, untested beyond `--dry-run`): `scripts/mac/build-appstore.sh`. The entitlements file is `src-tauri/entitlements/mac-appstore.plist` (not `src-tauri/Entitlements.plist`): sandbox, network client, user-selected files; the two team keys are added at build time from `APPLE_TEAM_ID` (example with placeholders: `mac-appstore.team.example.plist`). The profile goes in through `bundle.macOS.files` `{"embedded.provisionprofile": ...}` as planned, the `.pkg` through `xcrun productbuild --component <app> /Applications --sign "3rd Party Mac Developer Installer: ..."`. `xcrun altool` is absent from the build Mac's Command Line Tools (it ships with Xcode.app only), so the upload needs Xcode or the Transporter app; the script says so instead of failing silently. The script runs `xattr -cr` on the bundle before `productbuild` (Apple's quarantine rule of 2025-02-18). APPSTORE-FACTS.md 8.1/9.6 (read 2026-11-08) found that Apple's "built with Xcode 26" rule names iOS, iPadOS, tvOS, visionOS and watchOS but not macOS, so the Tahoe/Xcode 27 floor of section 3 is established for the iPhone app only; for the Mac App Store route the build Mac (Sonoma 14.6.1, Command Line Tools) may suffice with Transporter - unverified.

### 7.3 iPhone

1. `npx cap add ios` on the Mac (SPM; `--packagemanager Cocoapods` is the alternative) [S61][S60], then `npx cap sync ios`, `npx cap open ios` [S54].
2. Xcode: team + automatic signing (Capacitor's `ios.buildOptions.signingStyle` defaults to `automatic`, `exportMethod` to `app-store-connect`) [S57]; bundle ID `app.yourpersonaldiary`; deployment target 16.0 (Capacitor sets 15.0 [S56]); device family iPhone (or iPhone + iPad by decision); `Info.plist` (section 4: `NSFaceIDUsageDescription`, `CFBundleDocumentTypes` + imported UTI for `.mpd`, `ITSAppUsesNonExemptEncryption = false`, `CFBundleLocalizations` for 20 languages); `PrivacyInfo.xcprivacy` (6.1); app icons and launch screen from `design/app-icon.svg`.
3. Product > Archive -> Distribute to App Store Connect -> TestFlight internal testing on the owner's iPhone -> external group (first build reviewed) -> App Store submission with screenshots (section 5.7 below), App Privacy, age rating, review notes [S69][S32].

### 7.4 Screenshots and listing

* iPhone: at least one screenshot for the "iPhone with Dynamic Island (medium display)" class (1179 x 2556 / 1206 x 2622), up to 10 per device size, PNG/JPEG without transparency; iPad 13-inch (2064 x 2752 / 2048 x 2732) only if the app runs on iPad; Mac App Store: 1280 x 800, 1440 x 900, 2560 x 1600 or 2880 x 1800 [S37]. The existing Play screenshot tooling (`scripts/play/render-screenshots.mjs`) can render these sizes - a later package.
* Listing texts: reuse `play/listing/` for the 19 locales that exist on the App Store; **Bulgarian has no App Store localization** (Hebrew, Arabic, Thai, Hindi, Greek, Czech, Hungarian, Romanian, Polish, Turkish, Russian ... all exist; Bulgarian does not) [S38] - Bulgarian users get the primary-language listing; the app itself keeps all 20.

## 8. Costs

| Item | Amount | Note |
|---|---|---|
| Apple Developer Program | 99 USD / year (local currency at enrolment) [S2] | mandatory for both apps |
| Mac | 0 (CI only) to 899 USD (Mac mini M6) [S36]; or 109-349 USD / month hosted [S73]; or CI minutes: GitHub 0.062 USD/min after the included 12 USD/month [S70][S71], Codemagic 500 free minutes/month then 0.095 USD/min [S72] | section 2.2 |
| iPhone for testing | owner's choice (any iPhone on iOS 16.0 or later: iPhone 8 / iPhone SE 2nd generation and newer [S75]) | TestFlight is free [S1] |
| App Store Connect, TestFlight, notarization | included in the membership [S1][S44] | |
| Server | unchanged: the apps are clients of the existing Fly.io server (README 4.4) | |

## 9. Work packages

ENV.md rules apply (disjoint files, re-read before editing, tree green after every step, gates pasted, fictional data, no deploy, no `server/**`, `play/**`, `store/**`, `legal/**`). Order: **A1 || A2 -> A3** now on Windows; **M1 -> M2 || M3 -> M4** once a Mac exists; **I1 -> I2 -> I3** after A2 and M1 (the Mac roadmap first, per the owner's 2026-10-25 order: Play kit, Store kit, then the Mac build).

### WP-A1 - Platform split of the Windows shell (Windows, now; APPLE-PREP deliverable 2)

* Owns: new `src-tauri/src/platform/mod.rs`, `platform/windows.rs`, `platform/unsupported.rs` (`#[cfg(not(windows))]`, compiles and answers "unsupported" errors); edits to `src-tauri/src/lib.rs`, `offline.rs`, `opener.rs` (call sites only); `src-tauri/Cargo.toml` comments only (no new dependency).
* Contract of `platform::*` as delivered (the table in `src-tauri/src/platform/mod.rs`; every function also documented for macOS in section 4): `key_protect(user_id, key) -> Result<Vec<u8>>`, `key_unprotect(user_id, blob) -> Result<Vec<u8>>`, `key_remove(user_id) -> Result<()>` (Windows: `Ok(())`, nothing stored), `user_check_available() -> Result<bool>`, `window_handle(&window) -> Result<WindowHandle>`, `user_check(window_handle, message) -> Result<UserCheck>`, `open_url(url) -> Result<()>` (after the shared `open_checked`), `package_identity::family_name()`, `package_identity::install_path()`, `store_toast::show(aumid, xml)`. The planned `webview_profile_redirect(identifier)` and `mirror_root(local_app_data, own_family, identifier)` did not become platform functions: they stayed in `lib.rs` (`redirect_webview_profile_when_packaged`) and `offline.rs` (`mirror_root`) with the other MSIX path and text rules (`packaged_webview_data_dir`, `select_webview_data_dir`, `packaged_aumid`, `toast_xml`, `notify_as_store_app`) - portable code, compiled on every target and inert without a package identity, because `package_identity::family_name()` is their only gate (`platform/mod.rs`, "What is not here").
* Behaviour-neutral rules: identical command names and JSON shapes (`src/offline/native/tauri.ts`, `PrivacyPolicyLink.tsx` unchanged); the three exe marker strings of `scripts/store/msix-lib.mjs` (`REQUIRED_EXE_MARKERS`) remain in the Windows binary; the `local-server` feature still compiles.
* Acceptance (quote numbers): `cargo test --lib --offline` and `cargo check --offline` in `src-tauri` with all existing tests unchanged and green; new tests that prove the stub on Windows: `unsupported.rs` is normally compiled only under `#[cfg(not(windows))]`, so a test-only module includes the same source a second time (`#[cfg(test)] mod stub { #[path = "unsupported.rs"] mod unsupported; ... }`) and asserts that every function exists with the contract's signature and answers an "unsupported" error without panicking - this compiles and runs on Windows and is the strongest proof available there; `npx tauri build --bundles nsis` still produces the installer and `installer.nsi` lists no server files; `node scripts/check-no-network.mjs` passes; a reviewer's statement of what could and could not be proven (a `cargo check --target aarch64-apple-darwin` needs the target and the macOS-only crates downloaded - not possible offline on Windows; say so).

### WP-A2 - Capacitor ready for `npx cap add ios` (Windows, now; deliverable 3)

* Owns: audit note `docs/android-tasks/IOS-AUDIT.md` (or a section in `scripts/ios/README.he.md`); `capacitor.config.ts` (`ios` section: `contentInset: 'never'`, `scheme: 'App'`, `limitsNavigationsToAppBoundDomains: false`, `handleApplicationNotifications: true`, `backgroundColor`, no `webContentsDebuggingEnabled` so release builds stay non-debuggable [S57]; `server.iosScheme` left at its default `capacitor` because `HOSTED_ORIGINS` already lists `capacitor://localhost`); new `mobile/plugins/<name>/ios/*.swift` skeletons (plain source files, no Xcode project, no CocoaPods run - allowed by APPLE-PREP) for `DiaryOffline`, `DiaryFiles`, `DiaryPrivacyScreen`, `DiaryBiometric` (the last answering `unsupported`), each a `CAPPlugin, CAPBridgedPlugin` class with `identifier`, `jsName`, `pluginMethods` and `@objc func` methods [S58][S59], plus `ios/MyViewController.swift` overriding `capacitorDidLoad()` with `bridge?.registerPluginInstance(...)` [S59]; iOS branches in `mobile/platform/{files,notifications,offline,index,privacy-screen}.ts` behind `Capacitor.getPlatform() === 'ios'` (Android path byte-identical; tests for both branches); `scripts/ios/README.he.md` (exact Mac commands: `npm ci`, `npm run mobile:build`, `npx cap add ios`, copying the Swift files into `ios/App/App/`, `npx cap sync ios`, `npx cap open ios`, Info.plist and PrivacyInfo entries, `npx cap run ios`); `scripts/check-no-network.mjs` + its tests: add `.swift` to `EXT` and `ios/App/App` to `SCAN_DIRS` when present (today `EXT` has no `.swift`, so Swift sources would be unscanned).
* Android-only assumptions found in the audit (from this plan's reading, to be confirmed by WP-A2): Java-only plugin implementations; `Directory.Data` = Documents on iOS (backup exclusion needed); `createDocument`-before-write save flow (cancel point differs on iOS); `ACTION_VIEW` intent `seq` semantics; `backButton` / `minimizeApp`; notification `channelId`, `smallIcon`, `isExactNotification`, `allowWhileIdle`, `createChannel`, `MAX_SCHEDULED_REMINDERS = 200` vs. iOS's 64; `RECEIVE_BOOT_COMPLETED` reasoning; FLAG_SECURE semantics; `BiometricPrompt` texts (`negative` button is Android's); `android/` verify scripts.
* Acceptance: `npm run mobile:typecheck`, `npm run mobile:test`, `npm run mobile:build` green with the counts quoted; `node scripts/check-no-network.mjs` and `node --test "scripts/**/*.test.mjs"` green; `npm run android:verify` unchanged; **no `npx cap add ios` on Windows**; the desktop `dist` free of Capacitor code (`mobile/test/desktop-dist-clean.test.ts`).

### WP-A3 - Docs (Windows, now; deliverable 4)

* Owns: README section 6 (one line: Apple prep done, the build needs a Mac), `docs/android-tasks/ENV.md` status note.
* Acceptance: `node scripts/legal/build-pages.mjs --check` unaffected; no other file touched.

### WP-M1 - First Mac build, unsigned (Mac)

* Owns: `src-tauri/tauri.macos.conf.json`, `src-tauri/Info.plist`, `scripts/mac/{build.sh,README.he.md}`.
* Work: toolchain (Xcode 26 or later - the App Store's Xcode 27.x needs macOS Tahoe 26.6+ [S34]; `xcode-select --install`, rustup with `aarch64-apple-darwin` + `x86_64-apple-darwin`, Node 22+) [S41][S55]; `npm ci`; `npm run tauri build -- --bundles app --target universal-apple-darwin` [S45]; run the `.app`: sign-in against the server, the window CSP, `window.isSecureContext && crypto.subtle` in `tauri://localhost`, copy/paste through the default macOS Edit menu, keyboard shortcuts (`Cmd` already counts as `Ctrl` in `useKeyboardShortcuts.ts:92`; `Alt+1..0` on a Mac types symbols - check `e.key` vs `e.code`), the save dialog, the restore file input, reminders, the 20 locales and RTL.
* Acceptance: the unsigned app runs on the build Mac; findings written to `scripts/mac/README.he.md`; Windows gates untouched (no Windows file changed).
* Status (2026-11-06): **first unsigned build done** on the owner's MacBook Pro (Apple M1 Max, macOS Sonoma 14.6.1, Xcode Command Line Tools only - enough for the Mac app; the App Store and iOS still need the macOS and Xcode floors of section 3): `npx tauri build --bundles app` (Apple silicon only: the `x86_64-apple-darwin` target is not installed, so no universal build yet), ad-hoc signed through `src-tauri/tauri.macos.conf.json` (`identifier` `app.yourpersonaldiary.mac`, `bundle.targets` `["app"]`, `minimumSystemVersion` 12.3, `signingIdentity` `"-"`), installed in /Applications for the owner's tests (the run checks above are his, in progress). Build steps: `scripts/mac/README.he.md`.

### WP-M2 - `platform/macos.rs` (Mac)

* Owns: `src-tauri/src/platform/macos.rs`, `src-tauri/Cargo.toml` `[target.'cfg(target_os = "macos")'.dependencies]` (`security-framework` [S52], `objc2-local-authentication` + `objc2-foundation`/`block2` [S53], `tauri-plugin-opener` or `objc2-app-kit` [S49][S23]), `src-tauri/Cargo.lock`, `src-tauri/src/platform/mod.rs` (the `cfg(target_os = "macos")` arm), Rust tests for macOS (`#[cfg(target_os = "macos")]`: Keychain round trip + another account fails, `user_check_available` returns without UI, `open_url` of a refused address never reaches NSWorkspace).
* Acceptance: `cargo test --lib` on the Mac green; on Windows `cargo test --lib --offline` and `cargo check --offline` still green (the lockfile gains macOS-only crates that Windows never downloads - verify the offline build on Windows right after); `node scripts/check-no-network.mjs` green (no new hosts).
* Status (2026-11-06, review fixes 2026-11-07): **done** - `platform/macos.rs` with the objc2 bindings instead of the crates named above (`objc2-security` for the Keychain, `objc2-local-authentication` + `objc2-foundation` / `block2` / `objc2` / `objc2-core-foundation`; only the first two are new in Cargo.lock) and `/usr/bin/open` for the legal pages (no crate). Decided on the build Mac: an ad-hoc signed build gets errSecMissingEntitlement (-34018) from the data-protection keychain, so the vault uses it when the build may (a later signed build with a provisioning profile) and the login keychain otherwise; a wrap keeps the account's item when this build can read it and it holds the same key, and replaces it otherwise (a rebuilt ad-hoc app cannot read the old one but may replace it; after a successful data-protection add the login-keychain cleanup is best effort). Designed so that no Keychain dialog appears (the Keychain's user interaction is off while a vault call runs; a call that would need a dialog fails instead) - the GUI check by the owner is pending (`scripts/mac/README.he.md` section 3, check 1). The offline unlock runs inside an autorelease pool and waits at most 5 minutes for the dialog's reply, then invalidates the context and answers cancelled. `cargo test --lib` on the Mac: 76 passed, none ignored (Keychain tests on a temporary keychain only, the shipped `data_protection: true` path included behind a -34018 probe); the Windows lockfile gate needed one `cargo fetch --target x86_64-pc-windows-msvc` for the two new index entries. Details and what the owner sees: `scripts/mac/README.he.md`.

### WP-M3 - UI adapter and Mac touches (Mac, small `src/` edits, Windows-neutral)

* Owns: `src/offline/seams.ts` (`kind: 'dpapi' | 'keystore' | 'keychain'`), `src/offline/native/tauri.ts` (report `'keychain'` on a Mac - `navigator.userAgent` contains `Macintosh` in WKWebView - and call the new `offline_key_remove` there; the Windows path unchanged), `src/hooks/useKeyboardShortcuts.ts` only if WP-M1 found the `Alt+digit` problem (Mac-only branch), `src/i18n/runtime.ts` only if the owner chooses the system language on macOS (Mac-only branch), their tests.
* Acceptance: root gates on Windows (`npx tsc --noEmit`, `npx vitest run`, `npx vite build`, `node scripts/check-no-network.mjs`) green with existing tests unchanged; on the Mac: offline start with "Remember me" after a relaunch, offline unlock with Touch ID / password, logout wipes the Keychain item (`security find-generic-password -s app.yourpersonaldiary.mac.offline.v1` finds nothing).
* Status (2026-11-06; wiring 2026-11-07): **code done and wired, Mac checks pending** - `seams.ts` has the `'keychain'` kind; `tauri.ts` installs `tauriKeychainVault` (kind `'keychain'`, `remove()` -> the new command `offline_key_remove`, registered in both invoke handlers of `lib.rs`) when the user agent says `Macintosh`, and the unchanged DPAPI vault otherwise; tests for both branches; Windows gates green. Until 2026-11-07 nothing in `src/` called `installTauriOfflinePlatform()` - on Windows neither - so none of it ran; decision D1 of the main session wires the adapter in `src/main.tsx` (desktop branch: when `isTauri()`, a dynamic import of `@/offline/native/tauri` before the first offline start, so the hosted web bundle never loads Tauri code). On Windows this deliberately makes the DPAPI-protected key at rest, the outbox mirror and the Windows Hello unlock live, as ARCHITECTURE.md and docs/OFFLINE-TEST.he.md describe (Windows release 7, tested by the owner); decision D2 makes the engine remove the vault key whenever it drops the wrapped key (401, account switch, a start without "Remember me"). The Mac acceptance checks above wait for the owner's run of the next build. `useKeyboardShortcuts.ts` and `runtime.ts` are untouched (owner feedback pending).

### WP-M4 - Signing, notarization, DMG; optional Mac App Store (Mac)

* Owns: `scripts/mac/release.sh`, `docs/MAC-RELEASE.he.md`, `src-tauri/Entitlements.plist` (store route only), `src-tauri/tauri.macos.conf.json` additions. (As delivered 2026-11-08: `scripts/mac/{release.sh,make-dmg.sh,build-appstore.sh}`, `src-tauri/entitlements/{developer-id.plist,mac-appstore.plist,mac-appstore.team.example.plist,README.md}`, `src-tauri/Info.plist`, `docs/MAC-RELEASE.he.md`.)
* Work: section 7.1 (and 7.2 if decided). Hand the privacy-policy sentence for the Keychain to the main session (`legal/**` is frozen for agents).
* Acceptance: a notarized, stapled DMG opens on a clean Mac user without Gatekeeper warnings [S9]; `spctl --assess --type execute` passes; the policy wording request recorded in openIssues.
* Status (2026-11-08): **machinery done, signing pending the owner's Apple account.** On the build Mac: `x86_64-apple-darwin` installed, universal ad-hoc build verified (`lipo`: `x86_64 arm64`; `codesign --verify --deep --strict`; Info.plist keys incl. `ITSAppUsesNonExemptEncryption false`, `LSApplicationCategoryType public.app-category.lifestyle`), DMG made and verified by `make-dmg.sh`, `release.sh` run end to end without credentials (exit 2 + warning, as designed), `build-appstore.sh --dry-run` run, entitlements linted. The acceptance line above (notarized DMG on a clean user) cannot be met without a Developer ID certificate - it is the owner's first run of `release.sh`, described step by step in `docs/MAC-RELEASE.he.md`. The policy sentence went to the LEGAL package of the final sprint.

### WP-I1 - iOS project (Mac)

* Owns: `ios/**` (generated by `npx cap add ios` [S61], then edited: `Info.plist`, `PrivacyInfo.xcprivacy`, `InfoPlist.strings` for 20 locales, icons, launch screen, deployment target, device family), `scripts/ios/*.sh`, `docs/IOS-RELEASE.he.md`.
* Acceptance: `npx cap sync ios` clean; the app runs in the Simulator and on the owner's iPhone; `isSecureContext` true in `capacitor://localhost`; sign-in and the 20 locales work; ATS accepts the server (no exception).

### WP-I2 - Swift plugins and the iOS platform branches (Mac)

* Owns: `ios/App/App/plugins/*.swift` (from the WP-A2 skeletons), `ios/App/App/MyViewController.swift`, `mobile/platform/**` iOS fixes found on the device, `mobile/test/**` additions.
* Acceptance: the manual checklist of `docs/OFFLINE-TEST.he.md` passes on the iPhone (airplane mode, relaunch, reconnect, conflict, offline unlock with Face ID); save / share / restore / open-with `.mpd`; reminders fire while the app is closed (<= 60 pending); after a reboot pending reminders still exist; the app-switcher cover; `npm run mobile:test` on Windows still green.

### WP-I3 - TestFlight and App Store submission (Mac + App Store Connect)

* Owns: an `appstore/` kit (listing texts for 19 locales from `play/listing/`, screenshots, the privacy answers of 6.2, review notes, age-rating answers) - a new folder, nothing in `play/**` or `store/**` is edited.
* Acceptance: TestFlight internal build installed on the owner's iPhone; the first external build approved by Beta App Review; submission with all metadata; the review outcome recorded.

## 10. What cannot be verified on Windows (honest list)

* Any compilation of `platform/macos.rs` or of Swift: no Apple SDK, no Xcode, no Swift compiler on Windows. WP-A1 proves only that the Windows build is unchanged and that `unsupported.rs` compiles for a non-Windows cfg through cfg-gated tests; `cargo check --target aarch64-apple-darwin` would need the Rust target installed and the macOS-only crates downloaded (a network action the ENV rules forbid at build time), and even then would not cover linking.
* Signing, notarization, Gatekeeper, the App Sandbox, keychain prompts, `spctl`, TestFlight, App Review and Beta App Review outcomes, the 4.2 "repackaged website" judgement.
* WKWebView facts that decide behaviour: `window.isSecureContext` on `tauri://localhost` and `capacitor://localhost` (offline mode stays off without it, by design); IndexedDB persistence and eviction in WKWebView; the default macOS Edit menu and copy/paste; `Alt`/`Option` + digit shortcuts; `navigator.languages` in WKWebView; `target="_blank"` handling on iOS.
* Notifications from the signed Mac bundle (`tauri-plugin-notification`), the 64-request cap in practice, reminders after an iPhone reboot.
* Keychain accessibility after a restart (`AfterFirstUnlockThisDeviceOnly`), Touch ID / Face ID prompt flows and their error codes, Secure Enclave availability.
* iOS file flows: `UIDocumentPickerViewController` export/open, security-scoped URLs, "open with" delivery, iCloud backup exclusion of `Documents/offline`, Data Protection classes.
* ATS acceptance of `yourpersonaldiary.fly.dev` (expected fine: TLS 1.2+ with modern ciphers), `nscurl --ats-diagnostics`.
* The exact local-currency fee at enrolment and the current prices of the Mac options (section 2.2 quotes 2026-11-03).
* Whether `app.yourpersonaldiary` is still available as an Apple App ID.

## 11. Decisions needed from the owner

1. **Mac**: buy a Mac mini (M6 new or M1+ used) or rent/CI (section 2.2). Recommendation: buy.
2. **Mac distribution**: DMG download with Developer ID + notarization first (7.1); Mac App Store later or never (7.2, needs App Sandbox and entitlements).
3. **Startup language on macOS**: English (as the MSIX build) or the system language when it is one of the 20 (as Android). Default in this plan: English (no code change).
4. **Health & Fitness in App Privacy**: declare (the conservative Play choice) or not - keep it identical to the Play Data safety answer.
5. **IP addresses in App Privacy**: Apple has no IP data type; the policy discloses the in-memory rate limits. Declare "Other Data Types" or nothing. Default in this plan: nothing, policy wording unchanged.
6. **iPad**: iPhone-only (fewer screenshots, one layout) or iPhone + iPad.
7. **Bulgarian listing**: accept the primary-language listing for Bulgaria on the App Store (no localization exists) [S38].
8. **Guest tour on iOS**: today Android-only (HOSTED-IMPL 12); App Review accepts a demo account instead [S4]. Default: no tour on iOS.
9. **Privacy policy wording** for the Keychain on Mac/iPhone: a `legal/**` edit for the main session before the first TestFlight build.

## 12. Sources (accessed 2026-11-03; S33 and S34 re-read and S75 read on 2026-11-06)

* [S1] Apple Developer Program - https://developer.apple.com/programs/ ("$99 annual membership"; TestFlight; distribution).
* [S2] Enroll - https://developer.apple.com/programs/enroll/ (99 USD per membership year; local currency; individual requirements; seller name).
* [S3] Choosing a membership - https://developer.apple.com/support/compare-memberships/ (free account limits; distribution needs the program).
* [S4] App Review Guidelines - https://developer.apple.com/app-store/review/guidelines/ (4.8, 5.1.1(i)-(v), 5.1.2(i), 2.1(a), 2.3, 4.2).
* [S5] Offering account deletion in your app - https://developer.apple.com/support/offering-account-deletion-in-your-app/
* [S6] Privacy manifest files - https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
* [S7] Describing use of required reason API - https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api (May 1, 2024).
* [S8] App privacy details on the App Store - https://developer.apple.com/app-store/app-privacy-details/
* [S9] Notarizing macOS software before distribution - https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
* [S10] Developer ID - https://developer.apple.com/developer-id/
* [S11] Distributing Mac apps - https://developer.apple.com/macos/distribution/ (sandbox required for the Mac App Store, recommended outside).
* [S12] App Sandbox - https://developer.apple.com/documentation/security/app-sandbox (entitlements).
* [S13] Hardened Runtime - https://developer.apple.com/documentation/security/hardened-runtime
* [S14] Logging a user into your app with Face ID or Touch ID - https://developer.apple.com/documentation/localauthentication/logging-a-user-into-your-app-with-face-id-or-touch-id
* [S15] LAPolicy - https://developer.apple.com/documentation/localauthentication/lapolicy (iOS 8+, macOS 10.10+).
* [S16] NSFaceIDUsageDescription - https://developer.apple.com/documentation/bundleresources/information-property-list/nsfaceidusagedescription
* [S17] Keychain services - https://developer.apple.com/documentation/security/keychain-services
* [S18] kSecUseDataProtectionKeychain - https://developer.apple.com/documentation/security/ksecusedataprotectionkeychain
* [S19] kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly - https://developer.apple.com/documentation/security/ksecattraccessibleafterfirstunlockthisdeviceonly
* [S20] Restricting keychain item accessibility - https://developer.apple.com/documentation/security/restricting-keychain-item-accessibility
* [S21] Protecting keys with the Secure Enclave - https://developer.apple.com/documentation/security/protecting-keys-with-the-secure-enclave
* [S22] CryptoKit AES.GCM - https://developer.apple.com/documentation/cryptokit/aes/gcm
* [S23] NSWorkspace.open(_:) - https://developer.apple.com/documentation/appkit/nsworkspace/open(_:)
* [S24] UIApplication.open(_:options:completionHandler:) - https://developer.apple.com/documentation/uikit/uiapplication/open(_:options:completionhandler:)
* [S25] Scheduling a notification locally from your app - https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app
* [S26] UNUserNotificationCenter - https://developer.apple.com/documentation/usernotifications/unusernotificationcenter (iOS 10+, macOS 10.14+).
* [S27] UILocalNotification (the 64 soonest-firing notifications rule) - https://developer.apple.com/documentation/uikit/uilocalnotification
* [S28] Complying with encryption export regulations - https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations
* [S29] Preventing insecure network connections (ATS) - https://developer.apple.com/documentation/security/preventing-insecure-network-connections
* [S30] Optimizing your app's data for iCloud backup - https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup
* [S31] CFBundleDocumentTypes - https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundledocumenttypes
* [S32] TestFlight overview (App Store Connect Help) - https://developer.apple.com/help/app-store-connect/test-a-beta-version/overview-of-testflight ; TestFlight - https://developer.apple.com/testflight/
* [S33] Upcoming requirements - https://developer.apple.com/news/upcoming-requirements/ (Xcode 26 since 2026-04-28; age ratings 2026-01-31; required reasons 2024-05-01; quarantine attribute 2025-02-18; re-read 2026-11-06: still "Xcode 26 or later", no Xcode 27 rule announced).
* [S34] Xcode support - https://developer.apple.com/support/xcode/ (re-read 2026-11-06: Xcode 27, 27.1, 27.2 and 27.3 beta "macOS Tahoe 26.6 or later", deployment targets iOS 15-27 and macOS 12-27, Swift 6.4; Xcode 26.6: "macOS Tahoe 26.2 - macOS Tahoe 26.x", iOS 15-26.5, macOS 11-26.5).
* [S35] macOS Tahoe 26 is compatible with these computers - https://support.apple.com/en-us/122867
* [S36] Apple Newsroom, 2026-09-22, "The new Mac mini and Mac Studio are available today" - https://www.apple.com/newsroom/2026/09/the-new-mac-mini-and-mac-studio-are-available-today/ (Mac mini with M6 "starts at $899 (U.S.) and $799 (U.S.) for education").
* [S37] Screenshot specifications - https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications
* [S38] App Store localizations - https://developer.apple.com/help/app-store-connect/reference/app-store-localizations
* [S39] Safari 15.4 release notes - https://developer.apple.com/documentation/safari-release-notes/safari-15_4-release-notes (structuredClone, Web Locks, BroadcastChannel; iOS 15.4, macOS 12.3).
* [S40] Safari 17.4 release notes - https://developer.apple.com/documentation/safari-release-notes/safari-17_4-release-notes (AbortSignal.any).
* [S41] Tauri prerequisites - https://v2.tauri.app/start/prerequisites/
* [S42] Tauri macOS application bundle - https://v2.tauri.app/distribute/macos-application-bundle/
* [S43] Tauri DMG - https://v2.tauri.app/distribute/dmg/
* [S44] Tauri macOS code signing - https://v2.tauri.app/distribute/sign/macos/
* [S45] Tauri App Store distribution - https://v2.tauri.app/distribute/app-store/
* [S46] Tauri configuration reference - https://v2.tauri.app/reference/config/ (MacConfig, `useHttpsScheme`, bundle targets).
* [S47] Tauri configuration files (platform-specific files) - https://v2.tauri.app/develop/configuration-files/
* [S48] Tauri webview versions - https://v2.tauri.app/reference/webview-versions/
* [S49] Tauri opener plugin - https://v2.tauri.app/plugin/opener/
* [S50] Tauri notification plugin - https://v2.tauri.app/plugin/notification/
* [S51] Tauri dialog plugin - https://v2.tauri.app/plugin/dialog/
* [S52] security-framework crate 3.7.0, `passwords` module - https://docs.rs/security-framework/latest/security_framework/passwords/index.html
* [S53] objc2-local-authentication crate 0.3.2 - https://docs.rs/objc2-local-authentication/latest/objc2_local_authentication/
* [S54] Capacitor iOS - https://capacitorjs.com/docs/ios
* [S55] Capacitor environment setup - https://capacitorjs.com/docs/getting-started/environment-setup
* [S56] Updating to Capacitor 8 - https://capacitorjs.com/docs/updating/8-0
* [S57] Capacitor configuration - https://capacitorjs.com/docs/config
* [S58] Capacitor iOS plugin guide - https://capacitorjs.com/docs/plugins/ios
* [S59] Capacitor custom native iOS code - https://capacitorjs.com/docs/ios/custom-code
* [S60] Capacitor Swift Package Manager - https://capacitorjs.com/docs/ios/spm
* [S61] Capacitor CLI `cap add` - https://capacitorjs.com/docs/cli/commands/add
* [S62] Capacitor Local Notifications - https://capacitorjs.com/docs/apis/local-notifications
* [S63] Capacitor Filesystem - https://capacitorjs.com/docs/apis/filesystem
* [S64] Capacitor Share - https://capacitorjs.com/docs/apis/share
* [S65] Capacitor App - https://capacitorjs.com/docs/apis/app
* [S66] Capacitor Preferences - https://capacitorjs.com/docs/apis/preferences
* [S67] Capacitor iOS configuration - https://capacitorjs.com/docs/ios/configuration
* [S68] Capacitor privacy manifest - https://capacitorjs.com/docs/ios/privacy-manifest
* [S69] Capacitor deploying to the App Store - https://capacitorjs.com/docs/ios/deploying-to-app-store
* [S70] GitHub Actions billing - https://docs.github.com/en/billing/managing-billing-for-your-products/about-billing-for-github-actions
* [S71] GitHub Actions runner pricing - https://docs.github.com/en/billing/reference/actions-runner-pricing
* [S72] Codemagic pricing - https://codemagic.io/pricing/
* [S73] MacStadium pricing - https://www.macstadium.com/pricing
* [S74] Amazon EC2 Mac instances - https://aws.amazon.com/ec2/instance-types/mac/
* [S75] iPhone User Guide for iOS 16, "iPhone models compatible with iOS 16" - https://support.apple.com/guide/iphone/supported-iphone-models-iphe3fa5df43/16.0/ios/16.0 (the guide's model list starts with iPhone 8 / 8 Plus and includes iPhone SE (2nd generation); iPhone 6s, 7 and SE (1st generation) are not in it).

Not reachable on 2026-11-03 (HTTP 403/404 through WebFetch): MacinCloud pricing, Scaleway Mac mini pricing, Apple's archived `open(1)` man page. They are therefore not cited; the Mac options above are the ones with verified prices.
