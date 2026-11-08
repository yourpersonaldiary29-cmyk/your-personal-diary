# אפליקציית ה-iPhone - מה מריצים במחשב ה-Mac

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
| ארבעת התוספים בשפת Swift (טיוטות, **לא קומפלו מעולם**) | `mobile/plugins/diary-files/ios/DiaryFilesPlugin.swift`, `mobile/plugins/diary-offline/ios/DiaryOfflinePlugin.swift`, `mobile/plugins/diary-privacy-screen/ios/DiaryPrivacyScreenPlugin.swift`, `mobile/plugins/diary-biometric/ios/DiaryBiometricPlugin.swift` | אותם שמות ואותן פעולות כמו התוספים ב-Java של Android |
| ה-View Controller של האפליקציה (טיוטה) | `mobile/ios-app/DiaryBridgeViewController.swift` | רושם את ארבעת התוספים ומוציא את נתוני ה-WebView מגיבוי iCloud |
| תוספות ל-Info.plist | `mobile/ios-app/InfoAdditions.plist` | טקסט Face ID, הצהרת הצפנה, 20 השפות, סוג הקובץ `.mpd` |
| Privacy manifest | `mobile/ios-app/PrivacyInfo.xcprivacy` | אותן עובדות כמו טופס Data safety של Google Play |
| הבדיקות של כל אלה | `mobile/test/ios-prep.test.ts` | רצות ב-Windows (חלק מ-`npm run mobile:test`); ב-Mac, אחרי צעד 5, בודקות גם את פרויקט ה-Xcode |

---

## 1. מה צריך לפני שמתחילים

* **Mac עם שבב של אפל (M1 ומעלה).**
* **macOS Tahoe 26.6 ומעלה** ו-**Xcode 26 ומעלה**: מ-28.4.2026 אפל מקבלת רק אפליקציות שנבנו ב-Xcode 26 ומעלה, ו-Capacitor 8 דורש Xcode 26.0 ומעלה. ה-App Store מתקין תמיד את ה-Xcode החדש ביותר - ב-6.11.2026 זה Xcode 27.2, ו-Xcode 27 בכל גרסאותיו דורש **macOS Tahoe 26.6 ומעלה** ([`docs/APPLE-PLAN.md`](../../docs/APPLE-PLAN.md) סעיף 3). ב-Mac עם macOS ישן יותר (למשל Sonoma 14, או Tahoe 26.5 ומטה) - קודם מעדכנים: הגדרות המערכת ← כללי ← עדכון תוכנה. כל Mac עם שבב של אפל מקבל את Tahoe.
* **iPhone לבדיקה** (לא חובה בהתחלה - הסימולטור מספיק): עם iOS 16.0 ומעלה, כי זו הגרסה המינימלית שצעד 5.4 קובע; iPhone שנשאר ב-iOS 15 לא יכול להתקין את האפליקציה. מתאים iPhone 8 או iPhone SE (דור 2) ומעלה ([`docs/APPLE-PLAN.md`](../../docs/APPLE-PLAN.md) סעיף 2.3).
* **Apple Account** (חינמי) - מספיק לסימולטור ולהרצה על ה-iPhone של הבעלים (התקנה תקפה 7 ימים, עד 3 מכשירים). **Apple Developer Program** (99 דולר לשנה) נדרש רק ל-TestFlight ול-App Store - החלטה של הבעלים, לא צריך אותו כדי להתחיל.
* **Node.js 22 ומעלה** (דרישה של Capacitor 8). ב-Windows הפרויקט נבנה עם Node 24.20 - כדאי Node 24 גם ב-Mac (המתקין מ-nodejs.org, גרסת LTS).
* **חיבור לאינטרנט** ב-Mac: npm, וחבילות Swift שנמשכות מ-GitHub בבנייה הראשונה.
* **תיקיית הפרויקט** ב-Mac (העתקה או git), **בלי** תיקיות שנוצרות בבנייה: `node_modules` (גם זו שב-`server/`), `dist`, `mobile-dist`, `src-tauri/target` (בניות Windows, יותר מ-10 GB) ו-`android/app/build` - הן נוצרות מחדש או לא נחוצות ב-Mac.

בדיקה בחלון Terminal:

```bash
sw_vers              # macOS - ProductVersion 26.6 ומעלה
xcodebuild -version  # Xcode 26 ומעלה (מה-App Store בנובמבר 2026: Xcode 27.2)
node -v              # v22 ומעלה (מומלץ v24)
```

התקנת Xcode **[חלון Xcode]**: App Store ← Xcode ← התקנה (אם ה-App Store כותב שה-Xcode דורש macOS חדש יותר - מעדכנים קודם את macOS, כמו למעלה); פותחים פעם אחת, מאשרים את הרישיון ומתקינים את רכיב ה-iOS (Platform + Simulator). אחר כך ב-Terminal:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer   # הסיסמה של ה-Mac - הבעלים מקליד
xcodebuild -runFirstLaunch
xcrun simctl list devices available | grep -i iphone | head -5    # יש סימולטורים של iPhone
```

---

## 2. התלויות של הפרויקט

בתיקיית הפרויקט:

```bash
npm ci
npm --prefix server ci
```

קובץ הנעילה (`package-lock.json`) כבר כולל את גרסאות ה-macOS של החבילות הנייטיביות (rolldown, lightningcss, Tauri CLI), כך ש-`npm ci` עובד כמו ב-Windows.

התוספת היחידה שקיימת רק ב-Mac - חבילת הפלטפורמה של iOS, **באותה גרסה בדיוק** כמו `@capacitor/core` ו-`@capacitor/android`:

```bash
npm install --save-dev --save-exact @capacitor/ios@8.5.2
```

* זה משנה את `package.json` ואת `package-lock.json`. את השינוי הזה מחזירים לפרויקט הראשי (הוא חלק מ-WP-I1). Windows ו-Android לא מושפעים: שום קוד שלהם לא טוען את `@capacitor/ios`. הבדיקה `mobile/test/ios-prep.test.ts` מוודאת שהגרסה זהה לשאר Capacitor.
* לא מתקינים CocoaPods: ב-Capacitor 8 פרויקט iOS חדש משתמש ב-Swift Package Manager.

ושהכול תקין לפני שנוגעים ב-iOS:

```bash
npm run mobile:typecheck
npm run mobile:test
```

---

## 3. בניית הממשק

```bash
npm run mobile:build   # אותו ממשק כמו ב-Android, ל-mobile-dist/
```

---

## 4. יצירת פרויקט ה-iOS - פעם אחת בלבד

```bash
npx cap add ios
```

* נוצרת התיקייה `ios/` עם פרויקט ה-Xcode (`ios/App/App.xcodeproj`) ותיקיית החבילות `ios/App/CapApp-SPM` (**לא עורכים אותה** - Capacitor מנהל אותה).
* המזהה (`app.yourpersonaldiary`) והשם (Your Personal Diary) נלקחים מ-`capacitor.config.ts`.
* אם מופיעה הודעה שפלטפורמת ios כבר קיימת - הפרויקט כבר נוצר; ממשיכים לצעד 5 (או לצעד 6, אם גם צעד 5 כבר נעשה).

---

## 5. חיבור הקבצים שהוכנו ב-Windows - פעם אחת

### 5.1 ה-View Controller

Capacitor 8 יוצר את המסך הראשי בקוד, בקובץ `ios/App/App/SceneDelegate.swift`. מחליפים שם שורה אחת:

```bash
sed -i '' 's/window?.rootViewController = CAPBridgeViewController()/window?.rootViewController = DiaryBridgeViewController()/' ios/App/App/SceneDelegate.swift
grep -n "rootViewController" ios/App/App/SceneDelegate.swift
```

התוצאה הצפויה: `window?.rootViewController = DiaryBridgeViewController()`. בלי השינוי הזה ארבעת התוספים לא נרשמים - ושמירת הגיבוי, העבודה בלי חיבור ומסך הפרטיות לא יעבדו.

### 5.2 התוספות ל-Info.plist

```bash
/usr/libexec/PlistBuddy -c "Merge mobile/ios-app/InfoAdditions.plist" ios/App/App/Info.plist
plutil -lint ios/App/App/Info.plist
```

אף אחד מהמפתחות האלה לא קיים בקובץ שנוצר, ולכן שום דבר לא נדרס. הודעה "Duplicate Entry Was Skipped" פירושה שהצעד כבר נעשה. מה כל מפתח עושה - בהערות שבראש `mobile/ios-app/InfoAdditions.plist`. שני דברים לבעלים: הטקסט של Face ID כתוב באנגלית (19 השפות האחרות - ב-WP-I1), ו-`ITSAppUsesNonExemptEncryption = false` (רק הצפנה של מערכת ההפעלה) הוא תשובה שהבעלים מאשר לפני ההעלאה הראשונה.

### 5.3 הוספת ששת הקבצים לפרויקט **[חלון Xcode]**

```bash
npx cap open ios
```

ב-Xcode, בעמודה השמאלית (Project navigator): קליק ימני על התיקייה הצהובה **App** (מתחת לפרויקט הכחול App) ← **Add Files to "App"...**, ובוחרים (Cmd+Shift+G פותח שדה להקלדת נתיב):

* `mobile/ios-app/DiaryBridgeViewController.swift`
* `mobile/plugins/diary-files/ios/DiaryFilesPlugin.swift`
* `mobile/plugins/diary-offline/ios/DiaryOfflinePlugin.swift`
* `mobile/plugins/diary-privacy-screen/ios/DiaryPrivacyScreenPlugin.swift`
* `mobile/plugins/diary-biometric/ios/DiaryBiometricPlugin.swift`
* `mobile/ios-app/PrivacyInfo.xcprivacy`

ובחלון האפשרויות: **Reference files in place** (ב-Xcode ישן יותר: לבטל את "Copy items if needed"), **Create groups**, וב-Targets לסמן את **App**. כך יש לכל קובץ עותק אחד בלבד - זה שב-`mobile/`, שהבדיקות ב-Windows בודקות. (אם בכל זאת מעתיקים: הבדיקה של צעד 5.5 דורשת שכל עותק יהיה זהה למקור, ושינוי עושים תמיד במקור.)

**דרך בלי המסך (סשן ב-SSH)** - אותה פעולה בעזרת ה-gem `xcodeproj` של CocoaPods. לא הורץ ב-Windows; אם ההתקנה או הסקריפט נכשלים, עושים את הצעד בחלון Xcode. התוצאה נבדקת בצעד 5.5:

```bash
gem install --user-install xcodeproj
ruby - <<'RUBY'
require 'xcodeproj'
project = Xcodeproj::Project.open('ios/App/App.xcodeproj')
target = project.targets.find { |t| t.name == 'App' } or abort('no App target')
group = project.main_group['App'] or abort('no App group')
diary = group['Diary'] || group.new_group('Diary')
have = target.source_build_phase.files_references.compact.map { |r| File.basename(r.path.to_s) } +
       target.resources_build_phase.files_references.compact.map { |r| File.basename(r.path.to_s) }
%w[
  mobile/ios-app/DiaryBridgeViewController.swift
  mobile/plugins/diary-files/ios/DiaryFilesPlugin.swift
  mobile/plugins/diary-offline/ios/DiaryOfflinePlugin.swift
  mobile/plugins/diary-privacy-screen/ios/DiaryPrivacyScreenPlugin.swift
  mobile/plugins/diary-biometric/ios/DiaryBiometricPlugin.swift
  mobile/ios-app/PrivacyInfo.xcprivacy
].each do |file|
  next if have.include?(File.basename(file))
  ref = diary.new_reference(File.expand_path(file))
  file.end_with?('.swift') ? target.add_file_references([ref]) : target.add_resources([ref])
end
project.save
RUBY
```

### 5.4 גרסת ה-iOS המינימלית והמכשירים

* **iOS 16.0 לפחות** (התוכנית, סעיף 3; Capacitor יוצר 15.0). ב-Xcode **[חלון Xcode]**: היעד App ← General ← Minimum Deployments ← iOS 16.0. או ב-Terminal:

  ```bash
  sed -i '' 's/IPHONEOS_DEPLOYMENT_TARGET = 15.0;/IPHONEOS_DEPLOYMENT_TARGET = 16.0;/g' ios/App/App.xcodeproj/project.pbxproj
  grep -c "IPHONEOS_DEPLOYMENT_TARGET = 16.0;" ios/App/App.xcodeproj/project.pbxproj   # 4
  ```

* **iPhone בלבד או גם iPad** - החלטה של הבעלים ([`docs/APPLE-PLAN.md`](../../docs/APPLE-PLAN.md) סעיף 11, סעיף 6). Capacitor יוצר את שניהם (`TARGETED_DEVICE_FAMILY = "1,2"`). ל-iPhone בלבד, רק אחרי שהבעלים החליט: General ← Supported Destinations - להשאיר רק iPhone.

### 5.5 הבדיקה של החיבור

```bash
npm run mobile:test -- mobile/test/ios-prep.test.ts
```

עכשיו, כשיש `ios/`, רץ גם הבלוק "the generated iOS project": חמשת קובצי ה-Swift נבנים (in Sources), ה-Privacy manifest נארז (in Resources), `SceneDelegate.swift` מפעיל את `DiaryBridgeViewController`, וכל התוספות נמצאות ב-`ios/App/App/Info.plist`. חייב לעבור בלי כשלים.

---

## 6. סנכרון ובנייה - בכל פעם שהקוד משתנה

```bash
npm run mobile:build
npx cap sync ios
```

`npx cap sync ios` מעתיק את `mobile-dist/` ואת ההגדרות לתוך `ios/App/App`, ומוסיף לפרויקט את התוספים של Capacitor מ-npm (app, filesystem, local-notifications, preferences, share).

---

## 7. הרצה ראשונה

**בסימולטור** (בלי חתימה):

```bash
npx cap run ios   # בוחרים iPhone מהרשימה
```

או ב-Xcode **[חלון Xcode]**: בוחרים סימולטור של iPhone בסרגל העליון ← ▶ (Cmd+R). הבנייה הראשונה מורידה את חבילות ה-Swift ונמשכת כמה דקות.

* **שגיאות קומפילציה בטיוטות ה-Swift צפויות** בבנייה הראשונה - הן נכתבו בלי קומפיילר. מתקנים אותן בקבצים שב-`mobile/` (Xcode מצביע אליהם), ואחר כך מריצים שוב את `npm run mobile:test` - הבדיקות בודקות שהשמות והפעולות עדיין זהים ל-TypeScript ול-Java.
* ההערות שבראש כל קובץ Swift ("Checks for the Mac") הן רשימת הבדיקות של אותו קובץ.

**על ה-iPhone של הבעלים:** ב-Xcode, היעד App ← Signing & Capabilities ← Team: חשבון האפל של הבעלים (Personal Team מספיק), ו-Automatically manage signing מסומן. ב-iPhone: הגדרות ← פרטיות ואבטחה ← מצב מפתח (Developer Mode) ← פעיל, ואחרי ההתקנה הראשונה: הגדרות ← כללי ← VPN וניהול מכשירים ← לאשר את המפתח. אם Xcode מודיע שהמזהה `app.yourpersonaldiary` תפוס - **עוצרים** ומודיעים לסשן הראשי; לא ממציאים מזהה אחר (הוא הזהות של האפליקציה, התוכנית סעיף 1).

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
| 11 | אבטחת החיבור (ATS) | `nscurl --ats-diagnostics https://yourpersonaldiary.fly.dev` | PASS בתצורת ברירת המחדל - בלי שום חריגה ב-Info.plist |
| 12 | דוח הפרטיות | Product ← Archive ← Organizer ← Generate Privacy Report (לפני העלאה ראשונה) | אותם סוגי מידע כמו ב-`mobile/ios-app/PrivacyInfo.xcprivacy` |

ממצאים כותבים לסשן הראשי (מה נבדק, על איזה מכשיר ואיזו גרסת iOS, מה יצא).

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
| 9 | FLAG_SECURE חוסם צילומי מסך | מסך הפרטיות | ב-iOS רק כיסוי במחליף האפליקציות. **פתוח**: הטקסט של ההגדרה (ב-`shared/i18n/`) מבטיח חסימת צילומי מסך - צריך נוסח ל-iOS ב-20 שפות (WP-I2) |
| 10 | BiometricPrompt עם כפתור `negative` | `mobile/platform/biometric.ts` | התכונה כבויה בכל הפלטפורמות; התוסף ב-iOS עונה "unsupported" |
| 11 | מפתח ב-Android Keystore | `DiaryOffline` | מפתח ב-Keychain (המכשיר הזה בלבד) + AES-GCM של CryptoKit, אותו מבנה ואותו AAD. הסוג נשאר `'keystore'` (ב-`src/offline/seams.ts` יש מאז APPLE-PLAN WP-M3 גם `'keychain'`, אבל הוא של אפליקציית ה-Mac - `src/offline/native/tauri.ts`; לתוסף הטלפון הערך רק מבדיל בין סוגי כספות, ולכן נשאר) |
| 12 | `allowBackup=false` | המניפסט של Android | `Library/WebKit` (נתוני ה-WebView) ו-`Library/NoCloud/offline` מוצאים מהגיבוי; אחרי שחזור iPhone מגיבוי האפליקציה מתחילה מנותקת - כמו ב-Android |
| 13 | 20 השפות ב-`localeConfig` | `android/app/src/main/res/xml/locales_config.xml` | אותה רשימה ב-`CFBundleLocalizations` |
| 14 | cleartext כבוי ו-network security config | Android | ATS של iOS, בלי חריגות |
| 15 | המקור `https://localhost` | `androidScheme` | ב-iOS `capacitor://localhost` - כבר ב-`HOSTED_ORIGINS` |
| 16 | סקריפטי האימות ב-`scripts/android/` | Android | אין עדיין מקבילה ל-iOS (WP-I1) |
| 17 | "דלג - רק להסתכל" (סיור אורח) הוא "ל-Android בלבד" | `src/pages/onboarding/SkipTourButton.tsx` | **פתוח**: הכפתור מוצג בממשק הטלפון של בניית המובייל, ולכן יופיע גם ב-iPhone. התוכנית מציעה בלי סיור ב-iOS (סעיף 11, סעיף 8) - החלטה של הבעלים; שום קוד לא שונה |
| 18 | ביקורת הרשת לא קוראת Swift | `scripts/check-no-network.mjs` | `mobile/test/ios-prep.test.ts` סורק את קובצי ה-Swift; **פתוח**: להוסיף `.swift` לסקריפט עצמו (מחוץ לחבילה הזו) |

---

## 11. מה אי אפשר היה לבדוק ב-Windows

* קומפילציה של Swift, וכל התנהגות של UIKit: חלונות השמירה והפתיחה, "פתיחה באמצעות", כיסוי מסך הפרטיות.
* Keychain (נגישות אחרי הפעלה מחדש, מחיקה והתקנה מחדש), Face ID ו-Touch ID וקודי השגיאה שלהם.
* התראות בפועל: הרשאה, תקרת ה-64, תזכורות אחרי הפעלה מחדש.
* עובדות של ה-WebView: `isSecureContext` ב-`capacitor://localhost`, `navigator.languages`, שמירת IndexedDB.
* ATS מול השרת, ההחרגה מגיבוי iCloud, דוח הפרטיות של Xcode.

כל אלה הם הבדיקות של צעדים 7-8.
