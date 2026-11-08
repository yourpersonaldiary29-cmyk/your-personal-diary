# הפצת אפליקציית ה-Mac - המדריך של הבעלים

**תאריך:** 8.11.2026 (חבילת MAC-M4 של הספרינט הסופי). **למי:** לך, הבעלים. בסוף יש נספח באנגלית למפתח שיבוא אחריך.

**בקצרה**

1. אפליקציית ה-Mac בנויה ועובדת. היום היא חתומה "חתימה עצמית" (ad-hoc): היא נפתחת ב-Mac שלך, אבל Mac אחר חוסם אותה.
2. כדי שכל Mac יפתח אותה צריך **חשבון Apple Developer** (99 דולר לשנה) ו**תעודת Developer ID**. בלי זה אין מה לעשות עוד בצד שלנו - הכול מוכן ומחכה לתעודה.
3. כשיש תעודה, ההפצה היא **פקודה אחת** ב-Terminal של ה-Mac: `bash scripts/mac/release.sh`. היא בונה, חותמת, שולחת לאפל לבדיקה האוטומטית (Notarization), ומייצרת קובץ **DMG** להורדה.
4. ה-DMG הוא מה שנותנים למשתמשים (כמו קובץ ההתקנה של Windows). עמוד הורדה באתר - החלטה נפרדת, בהמשך; בינתיים AirDrop, דיסק-און-קי או מייל.
5. את ה-Mac App Store (מסלול 2) הכנו אבל **לא בדקנו** - אין לו תעודות, והוא דורש macOS חדש יותר. סעיף 8 מסביר.

---

## 1. מה קיים היום (8.11.2026)

| מה | איפה | מצב |
|---|---|---|
| האפליקציה המותקנת אצלך | `/Applications/Your Personal Diary.app` | בנייה 3 מ-7.11.2026, Apple silicon בלבד, חתימה עצמית. נשארת כמו שהיא. |
| בנייה **אוניברסלית** (Apple silicon + Intel) | `~/Developer/my-personal-diary/src-tauri/target/universal-apple-darwin/release/bundle/macos/Your Personal Diary.app` | נבנתה ב-8.11.2026, חתימה עצמית. **לא הותקנה** בשום מקום. |
| DMG לבדיקה שלך | `~/Developer/my-personal-diary/src-tauri/target/universal-apple-darwin/release/bundle/dmg/Your Personal Diary_0.1.0_universal.dmg` (+ קובץ `.sha256` לידו) | 5.8 MB (6,093,087 בייט), SHA-256 `996c3bd63470740d423c433cfa4c76120e684a8c22a0d67d2f6b00c6f1ad7d87` (הקובץ נוצר מחדש בכל הרצה של `release.sh`, ואז גם ה-SHA-256 שלו משתנה - תמיד לקרוא אותו מקובץ ה-`.sha256` שלידו). **לא עבר Notarization** - טוב לבדיקה ב-Mac שלך בלבד (סעיף 5). |
| הסקריפטים | `scripts/mac/release.sh`, `scripts/mac/make-dmg.sh`, `scripts/mac/build-appstore.sh` | מוכנים. המסלול בלי תעודה נבדק מקצה לקצה ב-Mac שלך; המסלול עם תעודה לא יכול היה להיבדק (אין תעודה). |
| קובצי ההרשאות (entitlements) | `src-tauri/entitlements/` | `developer-id.plist` (ריק בכוונה), `mac-appstore.plist` (ארגז החול של החנות), דוגמה ו-README. |
| פרטי האפליקציה | `src-tauri/Info.plist`, `src-tauri/tauri.macos.conf.json`, `src-tauri/tauri.conf.json` | הצהרת ההצפנה (`ITSAppUsesNonExemptEncryption = false`), זכויות יוצרים "© 2026 Ouriel Sebag", קטגוריה Lifestyle, מפרסם "Ouriel Sebag". נבדקו בתוך האפליקציה הבנויה. |

**מה לא נבדק, כי אי אפשר בלי חשבון Apple:** חתימה עם תעודה אמיתית, Notarization, הצמדת האישור (stapling), ההתנהגות של Gatekeeper ב-Mac אחר, וכל מסלול 2. הסקריפטים כתובים לפי התיעוד של אפל ושל Tauri, אבל הריצה הראשונה עם תעודה היא הבדיקה האמיתית - סעיף 9 מכין אותך למה שעלול להישבר.

---

## 2. מה צריך להשיג מאפל (פעם אחת)

> הפרטים המחייבים של אפל (מחירים, שדות, מגבלות) נמצאים בקובץ `docs/apple-tasks/APPSTORE-FACTS.md` (סעיף 1 - ההרשמה; סעיף 9 - הפצת Mac). אם משהו כאן סותר אותו - הוא צודק.

### 2.1 חברות ב-Apple Developer Program

1. צריך Apple Account (מה שנקרא פעם Apple ID) עם **אימות דו-שלבי** פעיל, ותעודה מזהה ממשלתית לאימות זהות.
2. נרשמים כ**יחיד** (Individual) באתר `developer.apple.com/programs/enroll/` או באפליקציית **Apple Developer** באייפון. שם ה"מוכר" שיופיע בחנות הוא השם המשפטי שלך - "Ouriel Sebag", כמו ב-`legal/settings.json`.
3. המחיר: 99 דולר לשנת חברות (אפל מציגה את המחיר במטבע מקומי בזמן ההרשמה). האישור לוקח בדרך כלל יום-יומיים; מגיע מייל.
4. אחרי האישור, ב-`developer.apple.com` ← Account ← **Membership details** רשום ה-**Team ID**: 10 תווים (אותיות ומספרים). תצטרך אותו בכמה מקומות - תעתיק אותו למקום נוח.

### 2.2 תעודת Developer ID Application

התעודה הזו היא מה שמאפשר ל-Mac של אחרים לפתוח את האפליקציה. רק **בעל החשבון** (Account Holder - אתה) יכול ליצור אותה. יש שתי דרכים; **דרך א** עובדת ב-Mac שלך היום, בלי Xcode.

**דרך א - באתר developer.apple.com (מומלצת לך)**

1. פותחים את **Keychain Access** (Applications ← Utilities ← Keychain Access).
2. בתפריט העליון: **Keychain Access ← Certificate Assistant ← Request a Certificate From a Certificate Authority...**
3. בחלון שנפתח: **User Email Address** - המייל של ה-Apple Account; **Common Name** - `Ouriel Sebag`; **CA Email Address** - להשאיר ריק; מסמנים **Saved to disk**; לוחצים **Continue** ושומרים את הקובץ `CertificateSigningRequest.certSigningRequest` (למשל על שולחן העבודה). **חשוב:** לעשות את זה ב-Mac שממנו תבנה - המפתח הפרטי נוצר ונשמר ב-Mac הזה.
4. בדפדפן: `developer.apple.com` ← **Account** ← **Certificates, Identifiers & Profiles** ← **Certificates** ← כפתור **+** (Create a New Certificate).
5. ברשימה, תחת **Software**, מסמנים **Developer ID Application** ← **Continue**. אם מופיעה בחירה "Profile Type" - משאירים את ברירת המחדל (**G2 Sub-CA**).
6. **Choose File** ← בוחרים את קובץ ה-`.certSigningRequest` מצעד 3 ← **Continue** ← **Download**. יורד קובץ `developerID_application.cer`.
7. לוחצים פעמיים על הקובץ שירד. ב-Keychain Access ← **login** ← **My Certificates** מופיעה שורה בשם `Developer ID Application: Ouriel Sebag (XXXXXXXXXX)` עם משולש קטן לידה (המפתח הפרטי). **השם המלא הזה, כולל הסוגריים, הוא מה שמכניסים לסקריפט** (סעיף 4).

**דרך ב - ב-Xcode** (אם יש לך Xcode מותקן): **Xcode ← Settings ← Accounts** ← **+** ← Apple ID ← נכנסים ← בוחרים את הצוות (Team) ← **Manage Certificates...** ← **+** (למטה משמאל) ← **Developer ID Application**. התעודה נכנסת ל-Keychain לבד.

**גיבוי התעודה - חובה.** המפתח הפרטי קיים רק ב-Mac שבו נוצרה הבקשה; מהאתר אפשר להוריד שוב רק את החלק הציבורי, שלא שווה כלום בלי המפתח. אם ה-Mac הולך לאיבוד - יוצרים תעודה חדשה, וביטול של תעודה שנחשפה דורש מייל לאפל (`product-security@apple.com`, לפי `APPSTORE-FACTS.md` 9.1). לכן: ב-Keychain Access ← **My Certificates** ← לחיצה ימנית על `Developer ID Application: Ouriel Sebag (...)` ← **Export "Developer ID Application: ..."** ← פורמט **.p12** ← שומרים ובוחרים סיסמה לקובץ. את קובץ ה-`.p12` ואת הסיסמה שומרים **מחוץ ל-Mac** (דיסק-און-קי או מנהל סיסמאות), לא בתיקיית הפרויקט (הסנכרון מהמחשב מדלג על קבצי `.p12` בכוונה).

### 2.3 סיסמה ייעודית ליישום (app-specific password) - ל-Notarization

1. בדפדפן: `account.apple.com` (בעבר `appleid.apple.com`) ← נכנסים ← **Sign-In and Security** ← **App-Specific Passwords**.
2. **+** (Generate an app-specific password) ← שם: `ypd-notary` ← **Create** ← מוצגת סיסמה בצורת `xxxx-xxxx-xxxx-xxxx`. מעתיקים אותה **עכשיו** - היא מוצגת פעם אחת.
3. את הסיסמה מקלידים **רק** בצעד הבא, בחלון ה-Terminal שמבקש אותה. לא בקובץ, לא בצ'אט.

### 2.4 שמירת פרטי ה-Notarization ב-Mac (פעם אחת)

ב-Terminal של ה-Mac (מחליפים את המייל וה-Team ID בשלך):

```bash
xcrun notarytool store-credentials ypd-notary --apple-id "your.appleid@example.com" --team-id XXXXXXXXXX
```

הפקודה מבקשת: `App-specific password for your.appleid@example.com:` - מדביקים את הסיסמה מ-2.3 (לא רואים מה מוקלד) ולוחצים Enter. התשובה הטובה:

```
Validating your credentials...
Success. Credentials validated.
Credentials saved to Keychain.
To use them, specify `--keychain-profile "ypd-notary"`
```

מרגע זה הפרופיל `ypd-notary` שמור ב-Keychain של ה-Mac, והסקריפט משתמש בו בלי לשאול כלום. אם תחליף את הסיסמה הייעודית - מריצים את הפקודה שוב.

---

## 3. מה ה-Mac צריך, לפי מסלול

| | מסלול 1 - Developer ID + Notarization + DMG (הורדה ישירה) | מסלול 2 - Mac App Store | אפליקציית ה-iPhone |
|---|---|---|---|
| macOS | **ה-Mac שלך היום מספיק**: macOS Sonoma 14.6.1 | כנראה מספיק גם כאן: כלל "נבנה עם Xcode 26" של אפל מזכיר iOS, iPadOS, tvOS, visionOS ו-watchOS - **לא macOS** (`APPSTORE-FACTS.md` 8.1, 9.6). לא נבדק. | **לא מספיק**: צריך Xcode 26 ומעלה, שרץ על macOS Sequoia 15.6 ומעלה (Xcode 26.0-26.3) או Tahoe (`APPSTORE-FACTS.md` 8.2-8.3) |
| כלי פיתוח | **Xcode Command Line Tools** (מותקנים) - כוללים `notarytool`, `stapler`, `codesign`, `productbuild` (נבדק ב-8.11.2026) | Command Line Tools לבנייה ול-`.pkg`; להעלאה - אפליקציית **Transporter** (חינם), או Xcode מלא בשביל `altool` | Xcode 26/27 מלא |
| מקום פנוי בדיסק | כ-6 GB לבנייה אוניברסלית ראשונה, כ-2 GB לבניות חוזרות (ב-8.11.2026 נשארו כ-8.6 GB) | כמו מסלול 1 (+ Xcode, אם מתקינים) | כ-60 GB (Xcode + סימולטורים) |
| חשבון Apple | Apple Developer Program + תעודת Developer ID Application + פרופיל `ypd-notary` | Apple Developer Program + תעודות הפצה לחנות + פרופיל הקצאה (סעיף 8) | כמו מסלול 2 |
| מה יוצא | קובץ DMG שכל Mac פותח | אפליקציה בחנות | אפליקציה בחנות |

Node.js ו-Rust כבר מותקנים ב-Mac שלך (`~/Developer/tools/node`, `~/.cargo`), כולל שני יעדי הבנייה של Rust (Apple silicon ו-Intel; יעד ה-Intel נוסף ב-8.11.2026, 147 MB).

---

## 4. הפקודות, לפי הסדר (מסלול 1)

### 4.1 הכנה - בכל פעם שפותחים Terminal חדש

```bash
export PATH="$HOME/Developer/tools/node/bin:$HOME/.cargo/bin:$PATH"
cd ~/Developer/my-personal-diary
export APPLE_SIGNING_IDENTITY="Developer ID Application: Ouriel Sebag (XXXXXXXXXX)"
```

* השורה הראשונה מלמדת את ה-Terminal איפה Node ו-Rust (הם לא הותקנו "למערכת", בכוונה).
* בשורה השלישית מחליפים את `XXXXXXXXXX` ב-Team ID שלך. השם חייב להיות **בדיוק** כמו ב-Keychain Access (סעיף 2.2, צעד 7).
* **סנכרון מהמחשב לא נדרש**: הפרויקט כבר נמצא ב-Mac, ב-`~/Developer/my-personal-diary`. (איך מפתח עתידי מעדכן את העותק - סעיף 4.7.)

### 4.2 ההרצה

```bash
bash scripts/mac/release.sh
```

זה הכול. הסקריפט עוצר בשגיאה הראשונה ואומר מה קרה (שורה שמתחילה ב-`release: ERROR:`). הכול נרשם גם לקובץ `~/Developer/release-<תאריך>.log`.

### 4.3 מה רואים בכל שלב כשהכול עובד

| שלב | מה מודפס |
|---|---|
| `==> 1/7 checks` | גרסת macOS, Node, Rust; `Rust targets: aarch64-apple-darwin, x86_64-apple-darwin`; `free disk space: N GiB (required: ...)`; `signing identity: Developer ID Application: ...`; `notarization: keychain profile "ypd-notary"` |
| `==> 2/7 dependencies` | `node_modules present - npm ci skipped` (או התקנה של דקה-שתיים בפעם הראשונה במחשב חדש) |
| `==> 3/7 universal build` | שורות של Vite (`✓ built in ...`), אחר כך `Compiling ...` של Rust, `Finished release`, `Bundling Your Personal Diary.app`, `Signing with identity "Developer ID Application: ..."`. בפעם הראשונה כ-3 דקות (8.11.2026 ב-Mac שלך: 192 שניות); אחר כך דקה-שתיים. |
| `==> 4/7 verifying the app bundle` | `architectures: x86_64 arm64`; `valid on disk` + `satisfies its Designated Requirement`; טבלת המפתחות: `CFBundleIdentifier app.yourpersonaldiary.mac`, `LSMinimumSystemVersion 12.3`, `LSApplicationCategoryType public.app-category.lifestyle`, `ITSAppUsesNonExemptEncryption false`, `NSHumanReadableCopyright © 2026 Ouriel Sebag`; שורות `Authority=Developer ID Application: ...`, `Authority=Developer ID Certification Authority`, `Authority=Apple Root CA`, `TeamIdentifier=...`, `Timestamp=...` (אם חסרה חותמת הזמן, הסקריפט חותם שוב בעצמו ואומר זאת) |
| `==> 5/7 notarizing and stapling the app` | `submitting the app to Apple's notary service and waiting for the verdict`; `Conducting pre-submission checks`, `Successfully uploaded file`, `Waiting for processing to complete.`, ובסוף `status: Accepted`; אחר כך יומן ה-JSON של אפל (`"issues": []` כשהכול נקי - אפל מבקשת לקרוא אותו גם כשהתשובה חיובית) ו-`The staple and validate action worked!` |
| `==> 6/7 DMG` | `make-dmg: staging a copy of the app`, `created: .../Your Personal Diary_<גרסה>_universal.dmg`, `hdiutil: verify: checksum ... is VALID`, `verified: binary identical, signature valid, Applications link present`, `sha256: ...` |
| `==> 7/7 signing, notarizing and stapling the DMG, Gatekeeper assessment` | חתימת ה-DMG (`valid on disk`), שוב `status: Accepted` + היומן ו-`The staple and validate action worked!`; `accepted` + `source=Notarized Developer ID` פעמיים (ל-DMG ולאפליקציה); ולבסוף מסגרת `RELEASE READY` עם הנתיב, הגודל וה-SHA-256 |

הסקריפט מסתיים עם **קוד יציאה 0** רק כשהכול הצליח. אם הוא נעצר - סעיף 9.

### 4.4 כמה זמן זה לוקח

* בנייה אוניברסלית ראשונה: כ-3 דקות ב-Mac שלך (192 שניות ב-8.11.2026). בניות הבאות: דקה עד שלוש.
* Notarization: אפל עונה בדרך כלל תוך דקה עד רבע שעה, פעמיים (אפליקציה ו-DMG). הסקריפט מחכה; לא לסגור את ה-Terminal.
* ה-Mac לא יירדם באמצע: הסקריפט מריץ את הבנייה דרך `caffeinate`. בכל זאת כדאי להשאיר את המטען מחובר.

### 4.5 איפה התוצאה

```
~/Developer/my-personal-diary/src-tauri/target/universal-apple-darwin/release/bundle/dmg/
    Your Personal Diary_<גרסה>_universal.dmg
    Your Personal Diary_<גרסה>_universal.dmg.sha256
```

ה-`.sha256` הוא "טביעת אצבע" של הקובץ: מי שמוריד יכול לוודא שהקובץ הגיע שלם (`shasum -a 256 -c <הקובץ>.sha256` בתיקייה שבה שניהם נמצאים). אפשר לתת תיקיית פלט אחרת: `bash scripts/mac/release.sh ~/Desktop/diary-release`.

### 4.6 מה קורה בלי תעודה

אם `APPLE_SIGNING_IDENTITY` לא מוגדר, הסקריפט בונה את אותה אפליקציה עם חתימה עצמית, יוצר DMG, ומדפיס מסגרת אזהרה גדולה (`UNSIGNED BUILD - NOT FOR DISTRIBUTION`) ומסתיים עם **קוד יציאה 2**, כדי שאף אחד לא יחשוב שזו גרסה להפצה. זה בדיוק מה שהרצנו ב-8.11.2026, וזו הדרך לבדוק שהכול בונה גם לפני שיש תעודה.

### 4.7 למפתח עתידי: איך מעדכנים את העותק של הפרויקט ב-Mac

מקור האמת של הקוד הוא תיקיית הפרויקט במחשב ה-Windows (ובעתיד - בכל מקום שתשמור אותה). ב-Mac נמצא עותק. כדי לעדכן אותו:

* **מהמחשב, ברשת הביתית** (Git Bash, עם מפתח ה-SSH `~/.ssh/diary_mac`): `bash scripts/mac/sync-to-mac.sh` - מעתיק את הקוד ומשאיר ב-Mac את מה שנבנה שם.
* **בלי רשת / במחשב אחר**: להעתיק את תיקיית הפרויקט כולה (בלי `node_modules`, `dist`, `mobile-dist`, `src-tauri/target`, `android/app/build`) לדיסק-און-קי, ולשים אותה ב-Mac ב-`~/Developer/my-personal-diary`. בהרצה הבאה `release.sh` רואה ש-`node_modules` חסר ומריץ `npm ci` לבד.
* ב-Mac חדש לגמרי: להתקין Node.js (24 ומעלה), Rust דרך `rustup` (עם `rustup target add aarch64-apple-darwin x86_64-apple-darwin`) ואת Xcode Command Line Tools (`xcode-select --install`), ואז סעיפים 2.2-2.4 ו-4.

---

## 5. איך בודקים את ה-DMG

### 5.1 בחשבון שלך ב-Mac

1. לחיצה כפולה על קובץ ה-DMG. נפתח חלון עם האפליקציה ועם קיצור בשם **Applications**.
2. גוררים את **Your Personal Diary** אל **Applications** שבאותו חלון. אם macOS שואל אם להחליף - זו ההתקנה הקיימת שלך; אפשר להחליף (היומן נמצא בשרת, וההעדפות ופריט ה-Keychain נשארים ב-Mac). אם אתה מעדיף לא לגעת בהתקנה הקיימת - גוררים את האפליקציה לשולחן העבודה במקום.
3. מוציאים את ה-DMG (לחיצה על סמל ההוצאה ליד "Your Personal Diary" בסרגל הצד של Finder) ופותחים את האפליקציה **מהמקום שאליו גררת** - לא מתוך חלון ה-DMG (אפליקציה שמופעלת ישירות מתוך DMG מורד מופעלת על ידי macOS מנתיב אקראי זמני, ולא תזכור הגדרות כמו שצריך).

ה-DMG של הבדיקה (חתימה עצמית) נפתח אצלך בלי אזהרה כשהוא נוצר ב-Mac הזה. אם הוא הגיע אליך **בהורדה** (מייל, AirDrop, דפדפן), macOS מסמן אותו כ"הורד מהאינטרנט" ומתנהג כמו בסעיף 5.3.

### 5.2 בחשבון משתמש אחר ב-Mac - הבדיקה הנקייה של Gatekeeper

כך רואים בדיוק מה שמשתמש אחר יראה:

1. **System Settings ← Users & Groups ← Add User...** ← סוג **Standard**, שם למשל `diary-test`, סיסמה ← **Create User**.
2. יוצאים מהחשבון שלך (תפריט Apple ← **Log Out**) ונכנסים ל-`diary-test`.
3. מעבירים לשם את ה-DMG **כמו שמשתמש היה מקבל אותו** - למשל שולחים לעצמך במייל ומורידים, או AirDrop מהאייפון. (העתקה ישירה בין תיקיות לא מסמנת "הורד מהאינטרנט" ולא בודקת כלום. מי שמכיר Terminal יכול לסמן ידנית: `xattr -w com.apple.quarantine "0081;00000000;Safari;" "<קובץ ה-DMG>"`.)
4. פותחים את ה-DMG, גוררים ל-Applications, פותחים את האפליקציה, ומשווים למה שכתוב ב-5.3.
5. בסוף אפשר למחוק את המשתמש `diary-test` באותו מקום ב-System Settings.

### 5.3 מה Gatekeeper מראה

| המצב של האפליקציה | מה macOS מראה בפתיחה הראשונה | מה עושים |
|---|---|---|
| חתומה ב-Developer ID, עברה Notarization (מה ש-`release.sh` מייצר עם תעודה) | חלון אחד: **"Your Personal Diary" is an app downloaded from the Internet. Are you sure you want to open it?** | **Open**. מכאן והלאה נפתחת רגיל. זה המצב הרצוי. |
| חתימה עצמית (ה-DMG של היום) ב-**macOS Sonoma 14** (כמו ה-Mac שלך) ומוקדם יותר | **"Your Personal Diary" cannot be opened because the developer cannot be verified**, או **"Your Personal Diary" is damaged and can't be opened. You should move it to the Trash** | לא למחוק. לוחצים **Cancel**, ואז **Control + לחיצה** על האפליקציה ← **Open** ← **Open** בחלון שנפתח. לחלופין: **System Settings ← Privacy & Security** ← גוללים ל-**Security** ← **Open Anyway** ← סיסמת ה-Mac. |
| חתימה עצמית ב-**macOS Sequoia 15 / Tahoe 26** | אותן הודעות | ב-Sequoia אפל ביטלה את המעקף של Control + לחיצה. נשאר רק: ניסיון פתיחה אחד (נחסם), ואז **System Settings ← Privacy & Security ← Open Anyway** ← סיסמה ← **Open**. |

"damaged" **לא** אומר שהקובץ פגום: זו ההודעה של macOS לאפליקציה עם סימון "הורד מהאינטרנט" שאין לה חתימת מפתח מזוהה. אחרי Notarization ההודעה הזו לא אמורה להופיע אף פעם; אם היא מופיעה בכל זאת - סעיף 9.

ב-Terminal אפשר לראות את החלטת Gatekeeper בלי לפתוח כלום:

```bash
spctl --assess --type execute -vv "/Applications/Your Personal Diary.app"
```

תשובה טובה: `accepted` ו-`source=Notarized Developer ID`. לגרסה של היום התשובה היא `rejected` (נבדק ב-8.11.2026) - זה צפוי.

---

## 6. איך מוסרים את ה-DMG למשתמשים

* **מה נותנים:** את קובץ ה-DMG (וכדאי גם את ה-`.sha256`). לא את תיקיית הפרויקט ולא את ה-`.app` לבד.
* **איך, בינתיים:** AirDrop, דיסק-און-קי, Google Drive / iCloud Drive, מייל (הקובץ קטן - כ-6 MB). עמוד הורדה באתר `yourpersonaldiary.org` הוא החלטה נפרדת שעוד לא התקבלה; כשיהיה אתר, זה הקובץ שמעלים אליו.
* **מה המשתמש עושה:** לחיצה כפולה על ה-DMG ← גרירה ל-Applications ← פתיחה ← **Open** בחלון "downloaded from the Internet". דרישה: macOS 12.3 (Monterey) ומעלה, Apple silicon או Intel.
* **מה לכתוב ליד הקובץ** (משפט אחד): "להתקנה: לפתוח את קובץ ה-DMG ולגרור את Your Personal Diary לתיקיית Applications. בפתיחה הראשונה macOS שואל אם לפתוח אפליקציה שהורדה מהאינטרנט - לוחצים Open."
* **אין עדכון אוטומטי**: גרסה חדשה = DMG חדש שמורידים ומחליפים (סעיף 7). ההגדרות והיומן לא נפגעים.

---

## 7. איך מוציאים גרסה חדשה

1. במחשב (מקור האמת) משנים את מספר הגרסה **בשלושה קבצים** לאותו ערך, למשל `1.0.1`: `package.json` (שדה `"version"`), `src-tauri/Cargo.toml` (שורת `version = `), `src-tauri/tauri.conf.json` (שדה `"version"`). (`src-tauri/Cargo.lock` מתעדכן לבד בבנייה הבאה; את גרסת אנדרואיד מעלים בנפרד, בקובץ שלה.)
2. מעדכנים את העותק ב-Mac (סעיף 4.7).
3. מריצים שוב את סעיף 4 במלואו. **כל גרסה חייבת לעבור Notarization מחדש** - הסקריפט עושה את זה לבד.
4. ה-DMG החדש נקרא על שם הגרסה (`Your Personal Diary_1.0.1_universal.dmg`). משתמשים מורידים ומחליפים את האפליקציה ב-Applications; היומן שלהם בשרת וההעדפות ב-Mac נשארים.
5. פריט ה-Keychain של "מפתח העותק" (ראו `scripts/mac/README.he.md` סעיף 2): בגרסאות החתומות ב-Developer ID הוא אמור להישאר קריא גם אחרי עדכון (כך אפל מתארת זאת; נוודא בשתי הגרסאות החתומות הראשונות). במעבר **מגרסת הבדיקה של היום לגרסה החתומה הראשונה** הוא יוחלף פעם אחת: הפתיחה הראשונה צריכה אינטרנט.

---

## 8. מסלול 2 - Mac App Store (הוכן, לא נבדק)

**מה שונה ממסלול 1**

| נושא | מסלול 1 (DMG) | מסלול 2 (חנות) |
|---|---|---|
| ארגז חול (App Sandbox) | לא | **חובה** - `src-tauri/entitlements/mac-appstore.plist`: ארגז חול, רשת יוצאת, קבצים שהמשתמש בחר. הסקריפט מוסיף בזמן הבנייה את שני ערכי הצוות (`com.apple.application-identifier`, `com.apple.developer.team-identifier`), שאין להם ערך קבוע בלי Team ID. |
| תעודות | Developer ID Application | **Apple Distribution** (או "3rd Party Mac Developer Application") לאפליקציה + **Mac Installer Distribution** ("3rd Party Mac Developer Installer") לחבילת ההתקנה |
| פרופיל הקצאה | לא צריך | **Mac App Store** provisioning profile למזהה `app.yourpersonaldiary.mac`, נוצר ב-developer.apple.com ← Profiles, ומוטמע באפליקציה (`Contents/embedded.provisionprofile`) |
| הקובץ שמעלים | DMG | **`.pkg`** חתום, שנוצר עם `productbuild` |
| Notarization | חובה | לא (אפל בודקת בחנות) |
| העלאה | - | `xcrun altool --upload-app --type macos` עם מפתח API של App Store Connect - **`altool` לא קיים ב-Command Line Tools** של ה-Mac שלך (בדקנו), רק ב-Xcode המלא. חלופה בלי Xcode: אפליקציית **Transporter** (חינם, ב-Mac App Store) - גוררים את ה-`.pkg` ולוחצים Deliver. מה אפל מקבלת היום - `APPSTORE-FACTS.md` סעיף 9. |
| ה-Mac | Sonoma מספיק | לפי דפי אפל שנקראו ב-8.11.2026 כלל ה-Xcode 26 לא חל על אפליקציות Mac (`APPSTORE-FACTS.md` 8.1, 9.6), כך ש-Sonoma עם Command Line Tools + Transporter כנראה מספיקים; Xcode מלא נדרש רק ל-`altool`. לא נבדק. |
| רשומה בחנות | - | App Store Connect: רשומת Mac נפרדת עם המזהה `app.yourpersonaldiary.mac`; הטקסטים, התמונות והתשובות בתיקיית `appstore/` |
| ה-Keychain | פריט ב-login keychain | הבנייה החתומה עם פרופיל ההקצאה עוברת **לבד** ל-Keychain המוגן של אפל (data-protection keychain; הקוד כבר יודע). בפתיחה המקוונת הראשונה הפריט מוחלף; פתיחה ראשונה בלי אינטרנט מיד אחרי המעבר תראה "אין חיבור" פעם אחת. |

**הפקודה** (אחרי שיש את כל הנ"ל):

```bash
export PATH="$HOME/Developer/tools/node/bin:$HOME/.cargo/bin:$PATH"
cd ~/Developer/my-personal-diary
export APPLE_TEAM_ID=XXXXXXXXXX
export APPSTORE_APP_IDENTITY="Apple Distribution: Ouriel Sebag (XXXXXXXXXX)"
export APPSTORE_INSTALLER_IDENTITY="3rd Party Mac Developer Installer: Ouriel Sebag (XXXXXXXXXX)"
export APPSTORE_PROVISIONING_PROFILE="$HOME/Downloads/Your_Personal_Diary_Mac_App_Store.provisionprofile"
bash scripts/mac/build-appstore.sh --dry-run    # רק מדפיס מה יקרה
bash scripts/mac/build-appstore.sh              # בונה וחותם, יוצר את ה-.pkg
bash scripts/mac/build-appstore.sh --upload     # גם מעלה (דורש Xcode ומשתני APPLE_API_KEY_ID, APPLE_API_ISSUER)
```

`--dry-run` רץ ב-Mac שלך ב-8.11.2026 והדפיס את כל הפקודות בלי להריץ כלום. **הריצה האמיתית לא נבדקה אף פעם** - אין תעודות, אין פרופיל, ואין Xcode. מי שיפעיל אותה בפעם הראשונה צריך לקרוא קודם את `APPSTORE-FACTS.md` סעיף 9 ולצפות לתיקונים קטנים (שמות תעודות, חוקי SDK). שימו לב גם לסעיף 14.1 שם: אפל לא מרשה לשתי רשומות באותו חשבון לשאת אותו שם - לאפליקציית ה-Mac בחנות יידרש שם שונה במעט (החלטה שלך; הטקסטים בתיקיית `appstore/`).

---

## 9. פתרון תקלות

| מה רואים | מה זה אומר | מה עושים |
|---|---|---|
| `release: ERROR: not enough free disk space` | פחות מ-6 GB פנויים לבנייה ראשונה (או 2 GB לחוזרת) | לפנות מקום (סל המחזור, הורדות ישנות). אפשר לעקוף זמנית: `YPD_MIN_FREE_GIB=4 bash scripts/mac/release.sh` |
| `Rust target x86_64-apple-darwin is not installed` | ב-Mac חדש | `rustup target add x86_64-apple-darwin` |
| `the app is NOT signed with a Developer ID Application certificate` | השם ב-`APPLE_SIGNING_IDENTITY` לא תואם לתעודה ב-Keychain, או שהתעודה חסרה / בלי מפתח פרטי | ב-Terminal: `security find-identity -v -p codesigning` - מציג את השמות המדויקים של התעודות שלך. להעתיק את השם בדיוק (כולל הסוגריים). אם אין משולש ליד התעודה ב-Keychain Access - אין מפתח פרטי: לייבא את ה-`.p12` מהגיבוי (לחיצה כפולה עליו). |
| `errSecInternalComponent` בזמן החתימה | ה-Keychain נעול, או שהמפתח הפרטי לא מאפשר שימוש | לפתוח את Keychain Access (זה פותח את ה-login keychain) ולהריץ שוב; ב-Keychain Access ← המפתח הפרטי ← Get Info ← Access Control ← לאשר את `codesign`. |
| `unable to build chain to self-signed root` | חסר ל-Mac אישור הביניים של אפל "Developer ID - G2" | להוריד מ-`https://www.apple.com/certificateauthority/` את **Developer ID - G2 (Expiring 09/17/2031)**, לחיצה כפולה, להריץ שוב |
| Notarization: `status: Invalid` | אפל דחתה. הסקריפט מדפיס מיד את יומן הסיבות של אפל (`notarytool log`) | לקרוא את השורות `"message"`: למשל `The signature of the binary is invalid` (לבנות מחדש), `The executable does not have the hardened runtime enabled` (לא אמור לקרות - הסקריפט מפעיל אותו), `The binary is not signed with a valid Developer ID certificate` (תעודה לא נכונה). ידנית: `xcrun notarytool log <id> --keychain-profile ypd-notary` |
| Notarization: `Error: HTTP status code: 401. Unable to authenticate` | הסיסמה הייעודית בפרופיל `ypd-notary` לא תקפה (שונתה / נמחקה) או Team ID שגוי | סעיף 2.3 ו-2.4 מחדש (`store-credentials` דורס את הפרופיל הישן) |
| Notarization: `status: In Progress` לזמן רב | אפל עמוסה | לחכות; `--wait` ממשיך לחכות. אם ה-Terminal נסגר: `xcrun notarytool history --keychain-profile ypd-notary` ואז `info <id>` |
| `stapler`: `Error 65` / `CloudKit query ... failed` | האישור עוד לא זמין להורדה, או שאין אינטרנט, או שהקובץ לא עבר Notarization | לחכות דקה ולהריץ ידנית `xcrun stapler staple "<הנתיב>"`; אם עדיין - להריץ את `release.sh` שוב |
| `spctl`: `rejected` אחרי Notarization | ההצמדה נכשלה או שהקובץ שונה אחרי החתימה | `xcrun stapler validate "<הנתיב>"`; לבנות מחדש בלי לגעת בקבצים בזמן הריצה |
| משתמש רואה **"is damaged and can't be opened"** | אפליקציה בלי Notarization עם סימון "הורד מהאינטרנט" | ל-DMG של היום זה צפוי (סעיף 5.3). לגרסה חתומה - לוודא שהמשתמש הוריד את ה-DMG שיצא מ-`release.sh` (עם `RELEASE READY`), לא העתק ישן |
| `make-dmg: ERROR: the app is version X but ... says Y` | שינית גרסה ולא בנית מחדש | להריץ `release.sh` (הוא בונה קודם) |
| `hdiutil: ... Resource busy` | ה-DMG הקודם עדיין מחובר (mounted) | ב-Finder להוציא (Eject) את "Your Personal Diary" ולהריץ שוב |
| הבנייה נכשלת ב-`npm run build` / `tsc` | הקוד במחשב לא היה ירוק כשהועתק | לבנות קודם במחשב (`npx tsc --noEmit`) ולסנכרן שוב |

---

## 10. הקבצים שהחבילה הזו הוסיפה או שינתה

| קובץ | מה הוא | שינוי |
|---|---|---|
| `scripts/mac/release.sh` | הפקודה האחת של ההפצה (מסלול 1) | חדש |
| `scripts/mac/make-dmg.sh` | יוצר ובודק DMG עם `hdiutil` בלבד (גם לבד: `bash scripts/mac/make-dmg.sh [app] [תיקייה]`) | חדש |
| `scripts/mac/build-appstore.sh` | מסלול 2 (חנות), עם `--dry-run` | חדש, לא נבדק בריצה אמיתית |
| `src-tauri/entitlements/developer-id.plist` | הרשאות ה-hardened runtime למסלול 1 - ריק בכוונה, עם הסבר | חדש |
| `src-tauri/entitlements/mac-appstore.plist` | הרשאות ארגז החול למסלול 2 | חדש |
| `src-tauri/entitlements/mac-appstore.team.example.plist` | דוגמה לשני ערכי הצוות (placeholder `TEAMID`) | חדש |
| `src-tauri/entitlements/README.md` | הסבר קצר באנגלית על שלושת הקבצים | חדש |
| `src-tauri/Info.plist` | `ITSAppUsesNonExemptEncryption = false`, `NSHumanReadableCopyright` | חדש (7.11.2026), אומת בבנייה 8.11.2026 |
| `src-tauri/tauri.macos.conf.json` | `bundle.category: "Lifestyle"` | שורה אחת |
| `src-tauri/tauri.conf.json` | `bundle.publisher` "Ouriel Sebag", `bundle.copyright` "© 2026 Ouriel Sebag" | שני שדות (מגיעים גם למתקין של Windows) |
| `docs/MAC-RELEASE.he.md` | המסמך הזה | חדש |
| `scripts/mac/README.he.md` | סעיפים 1, 4 ונספח I עודכנו למצב החדש | עדכון |
| `docs/APPLE-PLAN.md` | שורת הסטטוס של WP-M4 והערות "כפי שנבנה" בסעיף 7 | עדכון |

---

## Appendix (English) - for the next developer

### A. What exists and how it is wired

* `scripts/mac/release.sh [<out dir>]` - route 1. Checks (macOS, node, npm, cargo, rustup with both `aarch64-apple-darwin` and `x86_64-apple-darwin`, xcrun/codesign/lipo/hdiutil/plutil/shasum/PlistBuddy, free space >= 6 GiB for a first universal build or 2 GiB when `src-tauri/target/universal-apple-darwin` exists, `YPD_MIN_FREE_GIB` overrides), `npm ci` only when `node_modules` is missing, then `npx tauri build --bundles app --target universal-apple-darwin`. With `APPLE_SIGNING_IDENTITY` set it adds `--config '{"bundle":{"macOS":{"signingIdentity":"<id>","hardenedRuntime":true,"entitlements":"<abs path of developer-id.plist>"}}}'` and exports the same identity for Tauri; `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH` are unset for the build so Tauri never notarizes by itself. Verification: `lipo -archs` must list `x86_64` and `arm64`, `codesign --verify --deep --strict --verbose=2`, the Info.plist keys, and in the signed path `codesign -dvv` must show `Authority=Developer ID Application`, the `runtime` flag and a `Timestamp=` line (notarization requires a secure timestamp; if Tauri's signature lacks it the script re-signs the bundle with `codesign --force --options runtime --timestamp --entitlements <developer-id.plist> --sign <identity>` and checks again). Signed path: `ditto -c -k --keepParent app app.zip`, `xcrun notarytool submit <zip> --keychain-profile "${NOTARY_PROFILE:-ypd-notary}" --wait`, then always `xcrun notarytool log <id> --keychain-profile ...` (Apple: read it even on success); any status other than `Accepted` exits 1; `xcrun stapler staple` + `validate` on the app; `make-dmg.sh`; `codesign --sign <identity> --timestamp --identifier app.yourpersonaldiary.mac <dmg>` (Apple's "sign the disk image", APPSTORE-FACTS.md 9.4); the same submit/log/staple on the DMG; `spctl --assess --type open --context context:primary-signature --verbose=2 <dmg>`; `spctl --assess --type execute --verbose=2 <app>`; SHA-256 rewritten after signing and stapling (both change the DMG). Apple notes that notarizing the outermost container (the DMG) is enough; the app is notarized and stapled first anyway so that a copy taken out of the DMG carries its own ticket offline. Exit 0 = distributable; exit 2 = unsigned build finished (loud warning); exit 1 = failure. Log: `~/Developer/release-<stamp>.log` (`RELEASE_LOG`).
* `scripts/mac/make-dmg.sh [<app>] [<out dir>]` - `hdiutil create -volname "Your Personal Diary" -srcfolder <staging> -ov -format UDZO -fs HFS+ -imagekey zlib-level=9 <dmg>`, staging = `ditto` copy of the app + symlink `Applications -> /Applications`; checks before: codesign of the app, `CFBundleShortVersionString` == `version` of `src-tauri/tauri.conf.json` (read with `plutil -extract version raw`); after: `hdiutil verify`, `hdiutil attach -nobrowse -readonly -mountpoint`, `cmp` of the binaries, codesign of the mounted copy, the link, `hdiutil detach`; prints `DMG: <path>` as the last line (release.sh parses it) and writes `<dmg>.sha256`. Name: `<productName>_<version>_<universal|aarch64|x64>.dmg` from `lipo -archs`.
* `scripts/mac/build-appstore.sh [--dry-run] [--upload] [--out <dir>]` - route 2, untested. Generates `<out>/entitlements.appstore.plist` = `mac-appstore.plist` + `com.apple.application-identifier` (`<TEAM>.<identifier>`) + `com.apple.developer.team-identifier` via PlistBuddy, builds with `--config '{"bundle":{"macOS":{"signingIdentity":"<APPSTORE_APP_IDENTITY>","entitlements":"<that file>","bundleVersion":"<APPSTORE_BUILD_NUMBER|version>","files":{"embedded.provisionprofile":"<APPSTORE_PROVISIONING_PROFILE>"}}}}'` (Tauri's App Store guide: `bundle.macOS.files` copies into `Contents/`), verifies sandbox + team id + the embedded profile, runs `xattr -cr <app>` (Apple's quarantine rule of 2025-02-18, APPSTORE-FACTS.md 9.6), `xcrun productbuild --sign "<APPSTORE_INSTALLER_IDENTITY>" --component "<app>" /Applications "<pkg>"` (Apple's command form), and with `--upload`: `xcrun altool --validate-app` / `--upload-app --type macos --file <pkg> --apiKey <APPLE_API_KEY_ID> --apiIssuer <APPLE_API_ISSUER>` when `xcrun --find altool` succeeds, otherwise an instruction to use Transporter. `--dry-run` prints every command (`printf %q`) with `<PLACEHOLDERS>` for unset variables and lists them at the end.
* `src-tauri/Info.plist` is picked up automatically by Tauri on macOS ("Tauri also looks for a `Info.plist` file in the same directory as the Tauri configuration file", config schema `bundle.macOS.infoPlist`) and merged into the generated Info.plist; `bundle.category: "Lifestyle"` becomes `LSApplicationCategoryType = public.app-category.lifestyle`; `bundle.copyright` also becomes `NSHumanReadableCopyright` (the literal in Info.plist is identical, so both agree).
* Scripts are plain Bash 3.2 (macOS's `/bin/bash`): no arrays passed with `"${a[@]}"`, no `mapfile`, no `${var,,}`. Line endings LF. All paths quoted; `rm -rf` only on folders made by `mktemp` with a name-pattern guard.

### B. Verified on the owner's MacBook Pro (Apple M1 Max, macOS 14.6.1, Command Line Tools) on 2026-11-08

* `rustup target add x86_64-apple-darwin`: 13 s, 147 MB in `~/.rustup/.../x86_64-apple-darwin`.
* `npx tauri build --bundles app --target universal-apple-darwin` (ad-hoc identity `-` from `tauri.macos.conf.json`): exit 0 in 192 s; log `~/Developer/build-4-universal.log`; output `src-tauri/target/universal-apple-darwin/release/bundle/macos/Your Personal Diary.app` (11 MB, binary 11,367,440 bytes); `lipo -archs` = `x86_64 arm64`; `codesign --verify --deep --strict` valid (`flags=0x10002(adhoc,runtime)`); Info.plist: `CFBundleIdentifier app.yourpersonaldiary.mac`, `CFBundleShortVersionString 0.1.0`, `LSMinimumSystemVersion 12.3`, `ITSAppUsesNonExemptEncryption false`, `NSHumanReadableCopyright © 2026 Ouriel Sebag`, `LSApplicationCategoryType public.app-category.lifestyle`. Disk: 9.89 GiB free before, 8.58 GiB after (the build cost 1.31 GiB); `src-tauri/target` grew from 3.5 GB to 4.8 GB (`universal-apple-darwin` 22 MB, `aarch64-apple-darwin` 654 MB, `x86_64-apple-darwin` 657 MB; the old `release` and `debug` folders stay). `cargo test --lib` on the Mac afterwards: `test result: ok. 76 passed; 0 failed; 0 ignored`.
* `make-dmg.sh` on that app: `Your Personal Diary_0.1.0_universal.dmg`, 5.8 MB; `hdiutil verify` VALID, mount/cmp/codesign/link checks passed, 11 s. The DMG is re-created by every `release.sh` run and its SHA-256 changes each time (HFS+ timestamps); the one left on the Mac on 2026-11-08 14:42 is 6,093,087 bytes, SHA-256 `996c3bd63470740d423c433cfa4c76120e684a8c22a0d67d2f6b00c6f1ad7d87` (also in the `.sha256` file next to it).
* `release.sh` without credentials, end to end, twice (the second run with the final script): checks, incremental universal build (1m03 + 1m02 of Rust), verification, DMG, warning, exit code 2; logs `~/Developer/release-20261108-143427.log` and `~/Developer/release-20261108-144017.log`. Free disk after everything: 8.58 GiB.
* `build-appstore.sh --dry-run`: printed all commands, listed the missing variables, exit 0; `xcrun --find altool` fails on this Mac (Command Line Tools only).
* `plutil -lint` of the three entitlements files: OK. `bash -n` of the three scripts: OK. `spctl --assess --type execute` on the ad-hoc app: `rejected` (expected).

### C. Not verified (needs an Apple Developer account, or a newer Mac)

* The signed path of `release.sh`: Developer ID signing, `notarytool submit`, `stapler`, `spctl` = accepted, Gatekeeper on a second Mac/user. The parsing of `notarytool` output (`id:` / `status:` lines) follows the tool's current format; if Apple changes it, the script reports "no status" and exits 1 rather than claiming success.
* Precedence between `APPLE_SIGNING_IDENTITY` and `bundle.macOS.signingIdentity` in Tauri 2.11: the script sets both to the same value and verifies the resulting Authority, so either precedence gives the same result.
* Whether a Developer ID build keeps the login-keychain item across updates (Apple's documented model; `scripts/mac/README.he.md` section 2).
* Route 2 entirely: certificate names, Apple's SDK/Xcode rule for Mac apps, `altool` availability, the provisioning profile embedding, the data-protection keychain under the sandbox, `/usr/bin/open` for the legal pages under the sandbox (brokered by Launch Services - expected to work, untested), reminders from a sandboxed bundle.
* `docs/apple-tasks/APPSTORE-FACTS.md` section 9 (read 2026-11-08) was applied to the scripts: the DMG is code-signed before notarization (9.4), the notarization log is always read (9.3), the store bundle is cleared of extended attributes with `xattr -cr` (9.6), `productbuild` uses Apple's argument order (9.6), and the Xcode 26 SDK rule is treated as not covering macOS apps (8.1, 9.6). Its open question "does notarytool come with the Command Line Tools alone" is answered: yes on this Mac (`xcrun notarytool --version` = `1.0.0 (37)`, `/Library/Developer/CommandLineTools/usr/bin/notarytool`; `stapler` next to it). Where that file and this guide disagree, the facts file wins.
