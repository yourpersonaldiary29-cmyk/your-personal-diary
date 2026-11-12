# אפליקציית ה-iPhone - מה מריצים במחשב ה-Mac

## מצב נכון ל-12.11.2026

**אפליקציית ה-iPhone נוצרה ונבנתה במחשב ה-Mac שלך.** ב-12.11.2026 נוצר פרויקט ה-Xcode של האפליקציה (התיקייה `ios`), דרך חיבור מרחוק ובלי לגעת במסך של ה-Mac, והועתק גם לתיקיית הפרויקט במחשב Windows. זה נעשה עם macOS 27.2.1 ו-Xcode 27.2.

**מה יש עכשיו בתיקייה `ios`:**

* פרויקט Xcode שלם: `ios/App/App.xcodeproj`. המזהה `app.yourpersonaldiary`, השם Your Personal Diary, **iPhone בלבד** (בלי iPad), iOS 16.0 לפחות, גרסה 1.0.0 (Build 1), והסמל של ה-App Store (`appstore/icon/AppIcon-1024.png`).
* המסך שמופיע לרגע כשהאפליקציה נפתחת (Launch screen): רקע חלק בצבע של היומן - בהיר, או כהה כשה-iPhone במצב כהה.
* צעדים 2 עד 5.5 שלמטה **כבר בוצעו** בפרויקט הזה, ולא חוזרים עליהם: ה-View Controller של היומן, התוספות ל-Info.plist (הטקסט של Face ID, `ITSAppUsesNonExemptEncryption = false`, 20 השפות, קובצי הגיבוי `.mpd`), ה-Privacy manifest (כולל Health ו-Fitness, כמו בתשובות של App Store Connect), וחמשת קובצי ה-Swift.
* הבנייה לסימולטור, בלי חתימה, הצליחה (BUILD SUCCEEDED) - בלי שגיאות ובלי אזהרות בקוד של היומן. גם Archive ל-iPhone אמיתי - כמו בשלב ד, אבל בלי חתימה - הצליח.
* האפליקציה נפתחה בסימולטור של iPhone 18 Pro עם iOS 27.2 במסך הפתיחה (הכפתורים "הרשמה" ו"התחבר"), בעברית - השפה של המכשיר. לא נרשמנו ולא התחברנו: האפליקציה מחוברת לשרת האמיתי.

**מה נשאר - רק אתה יכול, כי צריך את חשבון האפל שלך.** את הסיסמה של חשבון האפל מקלידים רק בחלונות של אפל ושל Xcode.

### א. פתיחת הפרויקט ב-Xcode

1. ב-Mac פותחים את Terminal: Cmd+רווח, מקלידים Terminal ולוחצים Enter.
2. מדביקים את השורות האלה ולוחצים Enter. הן בונות את הממשק של היומן מהקבצים העדכניים של הפרויקט, מעתיקות אותו לתוך פרויקט ה-Xcode, ובסוף פותחות את Xcode. זה לוקח כדקה. השורה השנייה מוסיפה לחלון את Node.js שמותקן ב-Mac שלך - בלעדיה Terminal כותב `command not found: npm`. אם Xcode לא נפתח ובחלון מופיעות שורות עם `error` - הבנייה נכשלה: לא ממשיכים, ושומרים את מה שכתוב בחלון בשביל מפתח.

```bash
cd ~/Developer/my-personal-diary
export PATH="$HOME/Developer/tools/node/bin:$PATH"
npm run mobile:build && CI=1 npx cap sync ios && open ios/App/App.xcodeproj
```

3. Xcode נפתח. אם למעלה כתוב "Resolving Package Graph" - מחכים שזה ייעלם (Xcode מוריד את החלקים של Capacitor מהאינטרנט).
4. אם מופיעה הודעה צהובה "Update to recommended settings" - לא לוחצים עליה; היא לא נחוצה.

### ב. חתימה - Signing & Capabilities ← Team

1. בעמודה השמאלית של Xcode לוחצים על הסמל הכחול **App** שבראש הרשימה.
2. באמצע החלון, תחת **TARGETS**, בוחרים **App**, ולמעלה בוחרים את הלשונית **Signing & Capabilities**.
3. מסמנים **Automatically manage signing**.
4. ב-**Team** בוחרים את החשבון שלך. אם אין שם חשבון: בתפריט Xcode ← Settings... ← Accounts ← הכפתור **+** בתחתית ← Apple Account ← נכנסים עם ה-Apple ID שלך, וחוזרים לבחור אותו ב-Team.
5. לחנות צריך את הצוות של Apple Developer Program (99 דולר לשנה). להרצה על ה-iPhone שלך בלבד מספיק הצוות החינמי, "Personal Team".
6. **אם אתה מתכוון לפרסם את האפליקציה בחנות** - קודם מצטרפים ל-Apple Developer Program (`appstore/CHECKLIST.he.md` שלב 1), וכבר בהרצה הראשונה על ה-iPhone בוחרים ב-Team את הצוות בתשלום, לא את Personal Team. הסיבה: Xcode רושם את המזהה `app.yourpersonaldiary` על שם הצוות שנבחר, ומזהה שנרשם בצוות החינמי עלול להיות אחר כך "לא זמין" לצוות בתשלום. את Personal Team בוחרים רק אם לא תפרסם את האפליקציה בחנות.
7. **Bundle Identifier** נשאר `app.yourpersonaldiary`. אם Xcode כותב שהמזהה תפוס או לא זמין - לא משנים אותו (הוא הזהות של האפליקציה); בודקים שנכנסת עם החשבון הנכון ושנבחר הצוות הנכון (הפריט הקודם). אם גם אז הוא לא זמין - פונים לתמיכה של אפל למפתחים (developer.apple.com ← Contact Us).

### ג. הרצה על ה-iPhone שלך

1. מחברים את ה-iPhone ל-Mac בכבל. ב-iPhone, בשאלה אם לסמוך על המחשב, לוחצים **סמוך** ומקלידים את הקוד של ה-iPhone.
2. ב-iPhone: **הגדרות ← פרטיות ואבטחה ← מצב מפתח** (Developer Mode) ← מפעילים ← **הפעל מחדש**. אחרי שה-iPhone עולה מאשרים **הפעל** ומקלידים את הקוד. האפשרות "מצב מפתח" מופיעה רק אחרי שה-iPhone חובר ל-Xcode פעם אחת.
3. ב-Xcode, בסרגל העליון, ליד המילה App, בוחרים ברשימת המכשירים את ה-iPhone שלך.
4. לוחצים ▶ (או Cmd+R). בפעם הראשונה Xcode מכין את ה-iPhone כמה דקות. אם נפתח חלון של codesign שמבקש את הסיסמה של ה-Mac - מקלידים אותה ולוחצים **Always Allow**.
5. אם ב-iPhone מופיע שהמפתח לא מהימן: **הגדרות ← כללי ← VPN וניהול מכשירים** ← בוחרים את ה-Apple ID שלך ← **סמוך**, ופותחים שוב את האפליקציה.
6. עם ה-Personal Team החינמי האפליקציה עובדת 7 ימים; אחרי זה מחברים שוב ולוחצים ▶.
7. מה בודקים באפליקציה: הטבלה של סעיף 8 למטה (כניסה לחשבון שלך, שפות, מצב טיסה, תזכורות, גיבוי).

### ד. Archive והעלאה ל-App Store Connect

רק אחרי ההצטרפות ל-Apple Developer Program, ואחרי שרשומת האפליקציה נוצרה לפי `appstore/CHECKLIST.he.md`:

1. **מיד לפני כל Archive, גם הראשון:** מדביקים שוב ב-Terminal את שלוש השורות של שלב א.2 ומחכים ש-Xcode חוזר לחזית. כך ה-Archive כולל את הממשק העדכני של היומן. בלי זה הוא לוקח את הממשק מהפעם הקודמת שבה השורות הורצו - אולי בלי תיקונים שנעשו מאז.
2. בלשונית **General** של היעד App, תחת **Identity**, בודקים: **Version** = `1.0.0` ו-**Build** = `1` (כבר מוגדרים כך בפרויקט). בכל העלאה חדשה Build גבוה יותר: 2, 3 וכן הלאה.
3. בסרגל העליון, ברשימת המכשירים, בוחרים **Any iOS Device (arm64)**.
4. בתפריט **Product ← Archive**. בסוף נפתח החלון **Organizer** עם הארכיון.
5. לפני ההעלאה הראשונה: קליק ימני על הארכיון ← **Generate Privacy Report**. בדוח צריכים להופיע אותם סוגי מידע כמו ב-`mobile/ios-app/PrivacyInfo.xcprivacy` (סעיף 8, שורה 12).
6. **Distribute App ← TestFlight & App Store ← Distribute**. Xcode חותם ומעלה.
7. אפל שולחת מייל כשהבנייה מוכנה. ממשיכים ב-`appstore/CHECKLIST.he.md` משלב 11 (TestFlight).

### ידוע ועדיין פתוח

* הטקסט של Face ID כתוב באנגלית בלבד; עוד לא נוספו 19 השפות האחרות שלו.
* **נסגר ב-12.11.2026:** ב-iPhone ההגדרה בכרטיס האבטחה נקראת עכשיו "הסתרת התוכן במחליף האפליקציות" ולא מבטיחה לחסום צילומי מסך, ב-20 השפות.
* **נסגר ב-12.11.2026:** הכפתור "דילוג - רק להסתכל" כבר לא מוצג ב-iPhone, כמו שהוחלט (`docs/apple-tasks/ENV-FINAL.md`, החלטה 10). הוא נשאר רק ב-Android. כדי שהשינוי יגיע לפרויקט ה-iPhone, מריצים את שלוש השורות של שלב A.2 לפני ה-Archive.
* לא נבדקו, כי צריך iPhone אמיתי, את חשבון האפל או את המסך של ה-Mac: החתימה, הכניסה לחשבון, Face ID, התראות, שמירה ושיתוף של גיבוי, "פתיחה באמצעות", והבדיקה `isSecureContext` (סעיף 8, שורה 2).
* נבדק ועבר: האפליקציה עולה בסימולטור; הנתונים שלה מוחרגים מגיבוי iCloud (סעיף 8, שורה 10); והחיבור לשרת עומד בכללי האבטחה של אפל (ATS) בלי שום חריגה (סעיף 8, שורה 11 - נבדק ב-Mac ב-12.11.2026).

**For a developer (English):** generated 2026-11-12 on the owner's Mac over SSH - macOS 27.2.1 (26B131), Xcode 27.2 (27B52), iOS 27.2 SDK, simulator runtime iOS 27.2 (24B8117). Capacitor CLI 8.5.2 with Swift Package Manager (`ios/App/CapApp-SPM`; capacitor-swift-pm 8.5.2 and ion-ios-filesystem 1.1.4 pinned in `ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`), no CocoaPods. The five Swift files and the privacy manifest are referenced in place from `mobile/` (group "Diary", step 5.3), so a fix there reaches the Mac with `scripts/mac/sync-to-mac.sh` alone (the sync never touches the Mac's `ios/`). Unsigned simulator build: `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`. Logs on the Mac: `~/Developer/ios-add.log`, `~/Developer/ios-sync.log`, `~/Developer/ios-edits.log`, `~/Developer/ios-build-sim.log`, `~/Developer/ios-sim-run.log`, and after the verification fixes `~/Developer/ios-fix-build-sim.log`, `~/Developer/ios-fix-archive.log`. On the owner's Mac, Node 24.20 is in `~/Developer/tools/node/bin`, which is not on the default PATH (he has no shell profile): every command block of this file that runs `node`, `npm` or `npx` starts with `export PATH="$HOME/Developer/tools/node/bin:$PATH"`. `ios/App/App/public`, `capacitor.config.json` and `config.xml` are written by `npx cap sync ios` and are git-ignored - so the web bundle inside the Xcode project is whatever the last `npm run mobile:build` + `npx cap sync ios` on the Mac produced; that is why steps A.2 and D.1 run both every time. `CI=1` in front of `npx cap` keeps the Capacitor CLI non-interactive: in an interactive Terminal, Capacitor 8 switches its anonymous usage telemetry on by itself at the first command and starts sending it (`npx cap telemetry off` stops it for good); `npx cap run ios` needs the interactive device list, so it has no `CI=1`. Version: `MARKETING_VERSION = 1.0.0` and `CURRENT_PROJECT_VERSION = 1` in both App target configurations (Capacitor generates 1.0). Launch screen: `ios/App/App/Base.lproj/LaunchScreen.storyboard` is one plain view whose background is the named colour `LaunchBackground` (`ios/App/App/Assets.xcassets/LaunchBackground.colorset`: #F4F6F9, dark appearance #121417 - the page colours of `src/styles/tokens.css`, the same as Android's launch theme and the web splash of `mobile/index.html`); Capacitor's `Splash.imageset` (its logo on white) was removed because nothing else used it - add an image back only together with `@capacitor/splash-screen`.

---

**בקצרה, לבעלים:** ב-Windows הוכן כל מה שאפשר בלי Mac - הקוד של אפליקציית Android יודע עכשיו גם "לדבר iPhone", ונכתבו טיוטות של החלקים שכתובים בשפת Swift. את אפליקציית ה-iPhone עצמה אפשר ליצור, לבנות ולהריץ **רק במחשב Mac**: הקובץ הזה הוא רשימת הצעדים המדויקת לשם, לפי הסדר. ב-Windows, באנדרואיד ובאתר לא השתנה דבר.

* התוכנית המלאה (מה קונים, חוקי אפל, עלויות): [`docs/APPLE-PLAN.md`](../../docs/APPLE-PLAN.md) - הקובץ הזה מממש את סעיף 9 שלה, WP-A2 (ההכנה), ומפרט את WP-I1 (יצירת פרויקט ה-iOS) ואת תחילת WP-I2.
* מי מריץ: הבעלים מול ה-Mac, או סשן של Claude שעובד ב-Mac (בחלון ה-Terminal שלו, או מרחוק דרך SSH מהמחשב). צעד שמסומן **[חלון Xcode]** צריך את המסך של ה-Mac.
* **אסור להריץ `npx cap add ios` ב-Windows** - רק ב-Mac, ורק פעם אחת (צעד 4).
* סיסמאות (של ה-Mac, של חשבון אפל, של חשבון ההדגמה `stor`) מקלידים רק בחלונות של ה-Mac ושל אפל - אף פעם לא בצ'אט ולא בקובץ בפרויקט.
* אפליקציית ה-**Mac** (Tauri, המחשב השולחני) היא משימה נפרדת: WP-M1 ב-[`docs/APPLE-PLAN.md`](../../docs/APPLE-PLAN.md). הקובץ הזה הוא ל-iPhone בלבד.

---

## 0. מה כבר מוכן (נעשה ב-Windows)

| מה | איפה | הערה |
|---|---|---|
| הגדרות iOS של Capacitor | `capacitor.config.ts` (הסעיף `ios`) | מקור הדף נשאר `capacitor://localhost` - השרת כבר מתיר אותו (`server/src/middleware/access.ts`, `HOSTED_ORIGINS`) |
| ענפי iOS בקוד הטלפון | `mobile/platform/os.ts` (מי הטלפון), `mobile/platform/files.ts`, `mobile/platform/notifications.ts`, `mobile/platform/lifecycle.ts`, `mobile/platform/offline.ts`, `mobile/platform/index.ts` | ב-Android הקוד עושה בדיוק מה שעשה; כל ענף נבדק בבדיקות של שני הצדדים |
| ארבעת התוספים בשפת Swift (נכתבו ב-Windows; **קומפלו לראשונה ב-Mac ב-12.11.2026, בלי שגיאות**) | `mobile/plugins/diary-files/ios/DiaryFilesPlugin.swift`, `mobile/plugins/diary-offline/ios/DiaryOfflinePlugin.swift`, `mobile/plugins/diary-privacy-screen/ios/DiaryPrivacyScreenPlugin.swift`, `mobile/plugins/diary-biometric/ios/DiaryBiometricPlugin.swift` | אותם שמות ואותן פעולות כמו התוספים ב-Java של Android |
| ה-View Controller של האפליקציה | `mobile/ios-app/DiaryBridgeViewController.swift` | רושם את ארבעת התוספים ומוציא את נתוני ה-WebView מגיבוי iCloud |
| תוספות ל-Info.plist | `mobile/ios-app/InfoAdditions.plist` | טקסט Face ID, הצהרת הצפנה, 20 השפות, סוג הקובץ `.mpd` |
| Privacy manifest | `mobile/ios-app/PrivacyInfo.xcprivacy` | אותן עובדות כמו טופס Data safety של Google Play |
| הבדיקות של כל אלה | `mobile/test/ios-prep.test.ts` | רצות ב-Windows (חלק מ-`npm run mobile:test`); מאז שהתיקייה `ios/` נמצאת בפרויקט (12.11.2026) הן בודקות גם את פרויקט ה-Xcode |

---

## 1. מה צריך לפני שמתחילים

* **Mac עם שבב של אפל (M1 ומעלה).**
* **macOS Tahoe 26.6 ומעלה** ו-**Xcode 26 ומעלה**: מ-28.4.2026 אפל מקבלת רק אפליקציות שנבנו ב-Xcode 26 ומעלה, ו-Capacitor 8 דורש Xcode 26.0 ומעלה. ה-App Store מתקין תמיד את ה-Xcode החדש ביותר - ב-6.11.2026 זה Xcode 27.2, ו-Xcode 27 בכל גרסאותיו דורש **macOS Tahoe 26.6 ומעלה** ([`docs/APPLE-PLAN.md`](../../docs/APPLE-PLAN.md) סעיף 3). ב-Mac עם macOS ישן יותר (למשל Sonoma 14, או Tahoe 26.5 ומטה) - קודם מעדכנים: הגדרות המערכת ← כללי ← עדכון תוכנה. כל Mac עם שבב של אפל מקבל את Tahoe.
* **iPhone לבדיקה** (לא חובה בהתחלה - הסימולטור מספיק): עם iOS 16.0 ומעלה, כי זו הגרסה המינימלית שצעד 5.4 קובע; iPhone שנשאר ב-iOS 15 לא יכול להתקין את האפליקציה. מתאים iPhone 8 או iPhone SE (דור 2) ומעלה ([`docs/APPLE-PLAN.md`](../../docs/APPLE-PLAN.md) סעיף 2.3).
* **Apple Account** (חינמי) - מספיק לסימולטור ולהרצה על ה-iPhone של הבעלים (התקנה תקפה 7 ימים, עד 3 מכשירים). **Apple Developer Program** (99 דולר לשנה) נדרש רק ל-TestFlight ול-App Store - החלטה של הבעלים, לא צריך אותו כדי להתחיל. אבל אם האפליקציה תפורסם בחנות, מצטרפים אליו לפני ההרצה הראשונה על ה-iPhone (הסיבה בשלב ב.6 בראש הקובץ).
* **Node.js 22 ומעלה** (דרישה של Capacitor 8). ב-Windows הפרויקט נבנה עם Node 24.20 - כדאי Node 24 גם ב-Mac (המתקין מ-nodejs.org, גרסת LTS).
* **חיבור לאינטרנט** ב-Mac: npm, וחבילות Swift שנמשכות מ-GitHub בבנייה הראשונה.
* **תיקיית הפרויקט** ב-Mac (העתקה או git), **בלי** תיקיות שנוצרות בבנייה: `node_modules` (גם זו שב-`server/`), `dist`, `mobile-dist`, `src-tauri/target` (בניות Windows, יותר מ-10 GB) ו-`android/app/build` - הן נוצרות מחדש או לא נחוצות ב-Mac.

בדיקה בחלון Terminal. מה צריך לראות: `sw_vers` - ProductVersion של macOS הוא 26.6 ומעלה; `xcodebuild -version` - Xcode 26 ומעלה (מה-App Store בנובמבר 2026: Xcode 27.2); `node -v` - v22 ומעלה (מומלץ v24).

בכל קטע פקודות בקובץ הזה שמריץ `node`, `npm` או `npx`, השורה `export PATH=...` מוסיפה לחלון את Node.js שמותקן ב-Mac של הבעלים (בתיקייה `~/Developer/tools/node`, מחוץ לנתיב הרגיל - בלעדיה Terminal כותב `command not found`), והשורה `cd ~/Developer/my-personal-diary` עוברת לתיקיית הפרויקט. ב-Mac אחר מתאימים את שתיהן:

```bash
sw_vers
xcodebuild -version
export PATH="$HOME/Developer/tools/node/bin:$PATH"
node -v
```

התקנת Xcode **[חלון Xcode]**: App Store ← Xcode ← התקנה (אם ה-App Store כותב שה-Xcode דורש macOS חדש יותר - מעדכנים קודם את macOS, כמו למעלה); פותחים פעם אחת, מאשרים את הרישיון ומתקינים את רכיב ה-iOS (Platform + Simulator). אחר כך ב-Terminal. בשורה הראשונה ה-Mac מבקש את הסיסמה שלו - הבעלים מקליד אותה; השורה האחרונה מציגה את סימולטורי ה-iPhone שהותקנו:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -runFirstLaunch
xcrun simctl list devices available | grep -i iphone | head -5
```

---

## 2. התלויות של הפרויקט

בתיקיית הפרויקט:

```bash
cd ~/Developer/my-personal-diary
export PATH="$HOME/Developer/tools/node/bin:$PATH"
npm ci
npm --prefix server ci
```

קובץ הנעילה (`package-lock.json`) כבר כולל את גרסאות ה-macOS של החבילות הנייטיביות (rolldown, lightningcss, Tauri CLI), כך ש-`npm ci` עובד כמו ב-Windows.

התוספת היחידה שקיימת רק ב-Mac - חבילת הפלטפורמה של iOS, **באותה גרסה בדיוק** כמו `@capacitor/core` ו-`@capacitor/android`:

```bash
cd ~/Developer/my-personal-diary
export PATH="$HOME/Developer/tools/node/bin:$PATH"
npm install --save-dev --save-exact @capacitor/ios@8.5.2
```

* זה משנה את `package.json` ואת `package-lock.json`. את השינוי הזה מחזירים לפרויקט הראשי (הוא חלק מ-WP-I1). Windows ו-Android לא מושפעים: שום קוד שלהם לא טוען את `@capacitor/ios`. הבדיקה `mobile/test/ios-prep.test.ts` מוודאת שהגרסה זהה לשאר Capacitor.
* נעשה ב-12.11.2026: הפקודה הורצה בעותק הראשי שב-Windows, ואחרי הסנכרון `npm install` ב-Mac. מאז `@capacitor/ios` רשום ב-`package.json`, ולכן `npm ci` לבדו מתקין אותו.
* לא מתקינים CocoaPods: ב-Capacitor 8 פרויקט iOS חדש משתמש ב-Swift Package Manager.

ושהכול תקין לפני שנוגעים ב-iOS:

```bash
cd ~/Developer/my-personal-diary
export PATH="$HOME/Developer/tools/node/bin:$PATH"
npm run mobile:typecheck
npm run mobile:test
```

---

## 3. בניית הממשק

אותו ממשק כמו ב-Android; התוצאה נכתבת לתיקייה `mobile-dist/`:

```bash
cd ~/Developer/my-personal-diary
export PATH="$HOME/Developer/tools/node/bin:$PATH"
npm run mobile:build
```

---

## 4. יצירת פרויקט ה-iOS - פעם אחת בלבד

```bash
cd ~/Developer/my-personal-diary
export PATH="$HOME/Developer/tools/node/bin:$PATH"
CI=1 npx cap add ios
```

* נוצרת התיקייה `ios/` עם פרויקט ה-Xcode (`ios/App/App.xcodeproj`) ותיקיית החבילות `ios/App/CapApp-SPM` (**לא עורכים אותה** - Capacitor מנהל אותה).
* המזהה (`app.yourpersonaldiary`) והשם (Your Personal Diary) נלקחים מ-`capacitor.config.ts`.
* אם מופיעה הודעה שפלטפורמת ios כבר קיימת - הפרויקט כבר נוצר; ממשיכים לצעד 5 (או לצעד 6, אם גם צעד 5 כבר נעשה).

---

## 5. חיבור הקבצים שהוכנו ב-Windows - פעם אחת

### 5.1 ה-View Controller

Capacitor 8 יוצר את המסך הראשי בקוד, בקובץ `ios/App/App/SceneDelegate.swift`. מחליפים שם שורה אחת:

```bash
cd ~/Developer/my-personal-diary
sed -i '' 's/window?.rootViewController = CAPBridgeViewController()/window?.rootViewController = DiaryBridgeViewController()/' ios/App/App/SceneDelegate.swift
grep -n "rootViewController" ios/App/App/SceneDelegate.swift
```

התוצאה הצפויה: `window?.rootViewController = DiaryBridgeViewController()`. בלי השינוי הזה ארבעת התוספים לא נרשמים - ושמירת הגיבוי, העבודה בלי חיבור ומסך הפרטיות לא יעבדו.

### 5.2 התוספות ל-Info.plist

```bash
cd ~/Developer/my-personal-diary
/usr/libexec/PlistBuddy -c "Merge mobile/ios-app/InfoAdditions.plist" ios/App/App/Info.plist
plutil -lint ios/App/App/Info.plist
```

אף אחד מהמפתחות האלה לא קיים בקובץ שנוצר, ולכן שום דבר לא נדרס. הודעה "Duplicate Entry Was Skipped" פירושה שהצעד כבר נעשה. מה כל מפתח עושה - בהערות שבראש `mobile/ios-app/InfoAdditions.plist`. שני דברים לבעלים: הטקסט של Face ID כתוב באנגלית (19 השפות האחרות - ב-WP-I1), ו-`ITSAppUsesNonExemptEncryption = false` (רק הצפנה של מערכת ההפעלה) הוא תשובה שהבעלים מאשר לפני ההעלאה הראשונה.

### 5.3 הוספת ששת הקבצים לפרויקט **[חלון Xcode]**

```bash
cd ~/Developer/my-personal-diary
export PATH="$HOME/Developer/tools/node/bin:$PATH"
CI=1 npx cap open ios
```

ב-Xcode, בעמודה השמאלית (Project navigator): קליק ימני על התיקייה הצהובה **App** (מתחת לפרויקט הכחול App) ← **Add Files to "App"...**, ובוחרים (Cmd+Shift+G פותח שדה להקלדת נתיב):

* `mobile/ios-app/DiaryBridgeViewController.swift`
* `mobile/plugins/diary-files/ios/DiaryFilesPlugin.swift`
* `mobile/plugins/diary-offline/ios/DiaryOfflinePlugin.swift`
* `mobile/plugins/diary-privacy-screen/ios/DiaryPrivacyScreenPlugin.swift`
* `mobile/plugins/diary-biometric/ios/DiaryBiometricPlugin.swift`
* `mobile/ios-app/PrivacyInfo.xcprivacy`

ובחלון האפשרויות: **Reference files in place** (ב-Xcode ישן יותר: לבטל את "Copy items if needed"), **Create groups**, וב-Targets לסמן את **App**. כך יש לכל קובץ עותק אחד בלבד - זה שב-`mobile/`, שהבדיקות ב-Windows בודקות. (אם בכל זאת מעתיקים: הבדיקה של צעד 5.5 דורשת שכל עותק יהיה זהה למקור, ושינוי עושים תמיד במקור.)

**דרך בלי המסך (סשן ב-SSH)** - אותה פעולה בעזרת החבילה `xcode` של npm, שמגיעה כבר עם `@capacitor/cli` (לא מתקינים שום דבר: לא gem, לא CocoaPods). כך נוספו הקבצים לפרויקט שב-`ios/` ב-12.11.2026, וכך הם נבנו בהצלחה. מה הסקריפט עושה: יוצר בתוך התיקייה הצהובה App קבוצה בשם **Diary**, מוסיף אליה את ששת הקבצים כהפניה למקום שלהם ב-`mobile/` (עותק אחד בלבד), שם את חמשת קובצי ה-Swift בשלב הבנייה (Sources) ואת ה-Privacy manifest במשאבים (Resources). הוא לא נוגע בשום דבר אחר בפרויקט, והרצה שנייה לא משנה כלום. החבילה `xcode` מורידה את האפס שבתחילת שני מספרי גרסה בראש הקובץ (0920), והשורה של `fs.writeFileSync` בסוף הסקריפט מחזירה אותו. מריצים מתיקיית הפרויקט; בסוף מודפסת רשימת הקבצים של הקבוצה Diary, והתוצאה נבדקת בצעד 5.5:

```bash
cd ~/Developer/my-personal-diary
export PATH="$HOME/Developer/tools/node/bin:$PATH"
node - <<'NODE'
const fs = require('fs');
const xcode = require('xcode');
const PbxFile = require('xcode/lib/pbxFile');
const pbxPath = 'ios/App/App.xcodeproj/project.pbxproj';
const files = [
  'mobile/ios-app/DiaryBridgeViewController.swift',
  'mobile/plugins/diary-files/ios/DiaryFilesPlugin.swift',
  'mobile/plugins/diary-offline/ios/DiaryOfflinePlugin.swift',
  'mobile/plugins/diary-privacy-screen/ios/DiaryPrivacyScreenPlugin.swift',
  'mobile/plugins/diary-biometric/ios/DiaryBiometricPlugin.swift',
  'mobile/ios-app/PrivacyInfo.xcprivacy',
];
const project = xcode.project(pbxPath).parseSync();
const groups = project.hash.project.objects.PBXGroup;
const groupKey = (name) => Object.keys(groups).find((key) => groups[key + '_comment'] === name);
const app = groupKey('App');
if (app === undefined) throw new Error('no App group in ' + pbxPath);
let diary = groupKey('Diary');
if (diary === undefined) {
  diary = project.pbxCreateGroup('Diary');
  project.addToPbxGroup(diary, app);
}
const target = project.getFirstTarget().uuid;
for (const file of files) {
  if (fs.existsSync(file) === false) throw new Error('missing ' + file);
  const ref = '../../../' + file;
  if (project.hasFile(ref)) continue;
  if (file.endsWith('.swift')) {
    project.addSourceFile(ref, { target }, diary);
  } else {
    const resource = new PbxFile(ref, { lastKnownFileType: 'text.xml' });
    resource.uuid = project.generateUuid();
    resource.fileRef = project.generateUuid();
    resource.target = target;
    project.addToPbxBuildFileSection(resource);
    project.addToPbxResourcesBuildPhase(resource);
    project.addToPbxFileReferenceSection(resource);
    project.addToPbxGroup(resource, diary);
  }
}
const text = project.writeSync({ omitEmptyValues: true });
fs.writeFileSync(pbxPath, text.replace(/(LastSwiftUpdateCheck|LastUpgradeCheck) = (\d{3});/g, '$1 = 0$2;'));
console.log('Diary group: ' + groups[diary].children.map((c) => c.comment).join(', '));
NODE
plutil -lint ios/App/App.xcodeproj/project.pbxproj
```

### 5.4 גרסת ה-iOS המינימלית והמכשירים

* **iOS 16.0 לפחות** (התוכנית, סעיף 3; Capacitor יוצר 15.0). ב-Xcode **[חלון Xcode]**: היעד App ← General ← Minimum Deployments ← iOS 16.0. או ב-Terminal; ה-grep צריך להדפיס 4:

  ```bash
  cd ~/Developer/my-personal-diary
  sed -i '' 's/IPHONEOS_DEPLOYMENT_TARGET = 15.0;/IPHONEOS_DEPLOYMENT_TARGET = 16.0;/g' ios/App/App.xcodeproj/project.pbxproj
  grep -c "IPHONEOS_DEPLOYMENT_TARGET = 16.0;" ios/App/App.xcodeproj/project.pbxproj
  ```

* **iPhone בלבד** - הוחלט: בגרסה הראשונה אין iPad ([`docs/APPLE-PLAN.md`](../../docs/APPLE-PLAN.md) סעיף 11, סעיף 6; `docs/apple-tasks/ENV-FINAL.md`, החלטה 2). Capacitor יוצר את שניהם (`TARGETED_DEVICE_FAMILY = "1,2"`). ב-Xcode **[חלון Xcode]**: General ← Supported Destinations - להשאיר רק iPhone. או ב-Terminal; ה-grep צריך להדפיס 2:

  ```bash
  cd ~/Developer/my-personal-diary
  sed -i '' 's/TARGETED_DEVICE_FAMILY = "1,2";/TARGETED_DEVICE_FAMILY = 1;/g' ios/App/App.xcodeproj/project.pbxproj
  grep -c "TARGETED_DEVICE_FAMILY = 1;" ios/App/App.xcodeproj/project.pbxproj
  ```

* **אחרי השינוי של הגרסה המינימלית** מריצים שוב `npx cap sync ios` (צעד 6): Capacitor קורא את הגרסה מהפרויקט וכותב אותה לחבילה `ios/App/CapApp-SPM/Package.swift` (`.iOS(.v16)`).

### 5.5 הבדיקה של החיבור

```bash
cd ~/Developer/my-personal-diary
export PATH="$HOME/Developer/tools/node/bin:$PATH"
npm run mobile:test -- mobile/test/ios-prep.test.ts
```

עכשיו, כשיש `ios/`, רץ גם הבלוק "the generated iOS project": חמשת קובצי ה-Swift נבנים (in Sources), ה-Privacy manifest נארז (in Resources), `SceneDelegate.swift` מפעיל את `DiaryBridgeViewController`, וכל התוספות נמצאות ב-`ios/App/App/Info.plist`. חייב לעבור בלי כשלים.

---

## 6. סנכרון ובנייה - בכל פעם שהקוד משתנה

```bash
cd ~/Developer/my-personal-diary
export PATH="$HOME/Developer/tools/node/bin:$PATH"
npm run mobile:build
CI=1 npx cap sync ios
```

`npx cap sync ios` מעתיק את `mobile-dist/` ואת ההגדרות לתוך `ios/App/App`, ומוסיף לפרויקט את התוספים של Capacitor מ-npm (app, filesystem, local-notifications, preferences, share).

---

## 7. הרצה ראשונה

**בסימולטור** (בלי חתימה). הפקודה מציגה רשימת מכשירים, ובוחרים ממנה iPhone:

```bash
cd ~/Developer/my-personal-diary
export PATH="$HOME/Developer/tools/node/bin:$PATH"
npx cap run ios
```

או ב-Xcode **[חלון Xcode]**: בוחרים סימולטור של iPhone בסרגל העליון ← ▶ (Cmd+R). הבנייה הראשונה מורידה את חבילות ה-Swift ונמשכת כמה דקות.

* **בבנייה הראשונה (12.11.2026) לא היו שגיאות קומפילציה** בקובצי ה-Swift, שנכתבו בלי קומפיילר, וגם לא אזהרות בקוד שלהם. אם שינוי עתידי יוצר שגיאה - מתקנים אותה בקבצים שב-`mobile/` (Xcode מצביע אליהם), ואחר כך מריצים שוב את `npm run mobile:test` - הבדיקות בודקות שהשמות והפעולות עדיין זהים ל-TypeScript ול-Java.
* ההערות שבראש כל קובץ Swift ("Checks for the Mac") הן רשימת הבדיקות של אותו קובץ.

**על ה-iPhone של הבעלים:** ב-Xcode, היעד App ← Signing & Capabilities ← Team: הצוות של Apple Developer Program אם האפליקציה תפורסם בחנות (Personal Team החינמי רק אם לא - הסיבה בשלב ב.6 בראש הקובץ), ו-Automatically manage signing מסומן. ב-iPhone: הגדרות ← פרטיות ואבטחה ← מצב מפתח (Developer Mode) ← פעיל, ואחרי ההתקנה הראשונה: הגדרות ← כללי ← VPN וניהול מכשירים ← לאשר את המפתח. אם Xcode מודיע שהמזהה `app.yourpersonaldiary` תפוס - **לא** ממציאים מזהה אחר (הוא הזהות של האפליקציה, התוכנית סעיף 1); עושים את מה שכתוב בשלב ב.7 בראש הקובץ.

---

## 8. מה בודקים

| # | בדיקה | איך | התוצאה הצפויה |
|---|---|---|---|
| 1 | פתיחה וכניסה | חשבון של הבעלים או חשבון בדיקה (הסיסמה מוקלדת רק באפליקציה) | נכנסים, הרשומות מהשרת מוצגות |
| 2 | הקשר המאובטח והמקור | Safari ב-Mac ← Settings ← Advanced ← Show features for web developers; אחר כך Develop ← Simulator ← הדף של האפליקציה, וב-Console: `window.isSecureContext && !!crypto.subtle`, `location.origin`, `navigator.languages` | `true`; `capacitor://localhost`; שפת הטלפון. בלי `true` העבודה בלי חיבור כבויה, בכוונה ([`docs/android-tasks/OFFLINE-DESIGN.md`](../../docs/android-tasks/OFFLINE-DESIGN.md) סעיף 5.2) |
| 3 | שפות | בסימולטור: הגדרות ← כללי ← שפה ואזור; עברית, ערבית, אנגלית, סינית | האפליקציה נפתחת בשפת הטלפון, עברית וערבית מימין לשמאל. טלפון בסינית מסורתית: האפליקציה מצהירה רק על סינית מפושטת (`zh-Hans`, כמו ב-Android) - לרשום מה מוצג (ב-Android: סינית מפושטת; ב-iOS ייתכן אנגלית) |
| 4 | עבודה בלי חיבור | הרשימה של [`docs/OFFLINE-TEST.he.md`](../../docs/OFFLINE-TEST.he.md) (במכשיר אמיתי: מצב טיסה); נעילה בלי חיבור בסימולטור: Features ← Face ID ← Enrolled, ואז Matching / Non-matching Face | כמו ב-Android; Face ID או קוד המכשיר פותחים את הנעילה |
| 5 | תזכורות | כרטיס התזכורות ← לאשר התראות (חלון המערכת מופיע פעם אחת) | תזכורת מגיעה כשהאפליקציה סגורה; אחרי הפעלה מחדש של הטלפון התזכורות עדיין מתוכננות |
| 6 | שמירה, שיתוף ושחזור | גיבוי ← "שמירה במכשיר"; "שיתוף"; שחזור ← בחירת קובץ | בשמירה חלון "Save to Files" מופיע **בסוף**; ביטול = "בוטל" ושום קובץ לא נשאר; קובץ שנשמר נפתח לשחזור |
| 7 | "פתיחה באמצעות" | באפליקציית Files: קובץ `.mpd` ← שיתוף ← Your Personal Diary; גם כשהאפליקציה סגורה וגם כשהיא פתוחה | כרטיס השחזור נפתח עם הקובץ; העותק ב-Documents/Inbox נמחק אחרי הקריאה |
| 8 | מסך הפרטיות | מחליקים למעלה עד מחליף האפליקציות | הכרטיס של האפליקציה ריק. **צילומי מסך לא נחסמים ב-iOS** (אין מקבילה ל-FLAG_SECURE) |
| 9 | "נעילה כשיוצאים" | ההגדרה פעילה; לחיצה על הבית וחזרה; משיכת מרכז הבקרה וחזרה | בית: נעול. מרכז הבקרה: לא נעול (ב-iOS זו הפרעה, לא יציאה) |
| 10 | מחוץ לגיבוי iCloud | `C=$(xcrun simctl get_app_container booted app.yourpersonaldiary data)` ואז `xattr -l "$C/Library/WebKit" "$C/Library/NoCloud/offline"` | בשתי התיקיות: `com.apple.metadata:com_apple_backup_excludeItem` |
| 11 | אבטחת החיבור (ATS) | `nscurl --ats-diagnostics https://yourpersonaldiary.fly.dev` | PASS בתצורת ברירת המחדל - בלי שום חריגה ב-Info.plist. **עבר ב-12.11.2026** במחשב ה-Mac: 61 תוצאות PASS, אף FAIL |
| 12 | דוח הפרטיות | Product ← Archive ← Organizer ← Generate Privacy Report (לפני העלאה ראשונה) | אותם סוגי מידע כמו ב-`mobile/ios-app/PrivacyInfo.xcprivacy` |

את התוצאות רושמים - מה נבדק, על איזה מכשיר ובאיזו גרסת iOS, ומה יצא - ושומרים אותן ליד הפרויקט, בשביל מפתח שימשיך לעבוד על האפליקציה.

---

## 9. מה לא עושים

* `npx cap add ios` ב-Windows.
* `server.url` או `server.allowNavigation` ב-`capacitor.config.ts` - הממשק נארז באפליקציה ולא נטען מהאינטרנט, וקישור החוצה (מדיניות הפרטיות) נפתח ב-Safari.
* `UIFileSharingEnabled`, `NSAllowsArbitraryLoads` או חריגת ATS כלשהי, מצבי רקע (`UIBackgroundModes`).
* עריכה של `ios/App/CapApp-SPM` (מנוהל על ידי Capacitor).
* סיסמאות, מפתחות API של App Store Connect או קובצי חתימה בתוך הפרויקט.
* העלאה ל-TestFlight או ל-App Store בלי החלטה של הבעלים (צריך את Apple Developer Program, ואת ההחלטות של [`docs/APPLE-PLAN.md`](../../docs/APPLE-PLAN.md) סעיף 11).

---

## 10. ההנחות של Android שנמצאו בקוד, ומה נעשה עם כל אחת

הביקורת של APPLE-PREP סעיף 3 על `mobile/platform/` ועל `mobile/plugins/`:

| # | ההנחה | איפה | ב-iOS |
|---|---|---|---|
| 1 | התוספים קיימים רק ב-Java | `mobile/plugins/*/index.ts` | טיוטות Swift לכל הארבעה, באותם שמות ופעולות (`mobile/test/ios-prep.test.ts` משווה ל-TypeScript ול-Java) |
| 2 | `Directory.Data` היא תיקייה פרטית | `mobile/platform/offline.ts` | ב-iOS זו תיקיית Documents (שנכנסת לגיבוי); העותק לעבודה בלי חיבור עובר ל-`Directory.LibraryNoCloud` (`mirrorDirectory`), ו-`DiaryOfflinePlugin.swift` מוציא אותו מהגיבוי |
| 3 | "שמירה בשם" שואלת איפה לפני הכתיבה | `mobile/platform/files.ts` | ב-iOS: קובץ זמני, הכתיבה, וחלון השמירה בסוף (`saveToDeviceIos`); ביטול מגיע מ-`closeWrite` (`cancelled: true`) |
| 4 | `appStateChange(false)` = יצאו מהאפליקציה | `mobile/platform/lifecycle.ts` | ב-iOS זה גם מרכז הבקרה, התראת מערכת או Face ID; היציאה היא האירוע `pause` |
| 5 | ערוץ התראות, שדות של Android בלבד, עד 200 תזכורות | `mobile/platform/notifications.ts` | בלי `createChannel` (ב-iOS הקריאה נכשלת), בלי השדות האלה, ועד 60 (ל-iOS יש תקרה של 64) |
| 6 | `RECEIVE_BOOT_COMPLETED` מחזיר תזכורות אחרי הפעלה מחדש | המניפסט של Android | לא צריך: ב-iOS תזכורות מתוכננות נשמרות |
| 7 | כפתור "חזרה" ו-`minimizeApp` | `mobile/platform/lifecycle.ts` | לא קיימים ב-iOS; המאזין מותקן ופשוט שותק |
| 8 | קובץ נפתח דרך intent עם מספר רץ (`seq`) | `DiaryFiles` | ב-iOS דרך אירוע open-URL של Capacitor, עם אותו `seq`; העותק ב-Documents/Inbox נמחק |
| 9 | FLAG_SECURE חוסם צילומי מסך | מסך הפרטיות | ב-iOS רק כיסוי במחליף האפליקציות. **נסגר ב-12.11.2026**: להגדרה יש ב-iOS נוסח משלו ב-20 השפות, בלי הבטחה לחסום צילומי מסך (`mobile.security.privacyScreenIos*`) |
| 10 | BiometricPrompt עם כפתור `negative` | `mobile/platform/biometric.ts` | התכונה כבויה בכל הפלטפורמות; התוסף ב-iOS עונה "unsupported" |
| 11 | מפתח ב-Android Keystore | `DiaryOffline` | מפתח ב-Keychain (המכשיר הזה בלבד) + AES-GCM של CryptoKit, אותו מבנה ואותו AAD. הסוג נשאר `'keystore'` (ב-`src/offline/seams.ts` יש מאז APPLE-PLAN WP-M3 גם `'keychain'`, אבל הוא של אפליקציית ה-Mac - `src/offline/native/tauri.ts`; לתוסף הטלפון הערך רק מבדיל בין סוגי כספות, ולכן נשאר) |
| 12 | `allowBackup=false` | המניפסט של Android | `Library/WebKit` (נתוני ה-WebView) ו-`Library/NoCloud/offline` מוצאים מהגיבוי; אחרי שחזור iPhone מגיבוי האפליקציה מתחילה מנותקת - כמו ב-Android |
| 13 | 20 השפות ב-`localeConfig` | `android/app/src/main/res/xml/locales_config.xml` | אותה רשימה ב-`CFBundleLocalizations` |
| 14 | cleartext כבוי ו-network security config | Android | ATS של iOS, בלי חריגות |
| 15 | המקור `https://localhost` | `androidScheme` | ב-iOS `capacitor://localhost` - כבר ב-`HOSTED_ORIGINS` |
| 16 | סקריפטי האימות ב-`scripts/android/` | Android | אין עדיין מקבילה ל-iOS (WP-I1) |
| 17 | "דלג - רק להסתכל" (סיור אורח) הוא "ל-Android בלבד" | `src/pages/onboarding/SkipTourButton.tsx` | **נסגר ב-12.11.2026**: `tourOffered` מחזיר false כש-`platformName()` הוא `ios` (מאחורי `__MOBILE__`, כדי שבניית ה-Windows תישאר בלי קוד Capacitor); בדיקה ב-`src/pages/onboarding/SkipTour.test.tsx` |
| 18 | ביקורת הרשת לא קוראת Swift | `scripts/check-no-network.mjs` | `mobile/test/ios-prep.test.ts` סורק את קובצי ה-Swift; **פתוח**: להוסיף `.swift` לסקריפט עצמו (מחוץ לחבילה הזו) |

---

## 11. מה אי אפשר היה לבדוק ב-Windows

* קומפילציה של Swift, וכל התנהגות של UIKit: חלונות השמירה והפתיחה, "פתיחה באמצעות", כיסוי מסך הפרטיות.
* Keychain (נגישות אחרי הפעלה מחדש, מחיקה והתקנה מחדש), Face ID ו-Touch ID וקודי השגיאה שלהם.
* התראות בפועל: הרשאה, תקרת ה-64, תזכורות אחרי הפעלה מחדש.
* עובדות של ה-WebView: `isSecureContext` ב-`capacitor://localhost`, `navigator.languages`, שמירת IndexedDB.
* ATS מול השרת, ההחרגה מגיבוי iCloud, דוח הפרטיות של Xcode.

כל אלה הם הבדיקות של צעדים 7-8.
