# פרסום Your Personal Diary ב-Google Play – מדריך לבעלים

המדריך הזה כתוב בשבילך, שלב אחרי שלב, מסך אחרי מסך. כל מה שטכני (בניית הקובץ, בדיקות) נעשה
בפקודה אחת שמוכנה מראש, או על ידי Claude כשכתוב "לבקש מ-Claude". שמות הכפתורים והתפריטים
ב-Play Console מופיעים באנגלית כפי שהם על המסך (Google משנה מדי פעם שמות של תפריטים – אם כפתור
לא נמצא במקום שכתוב, מחפשים אותו בתיבת החיפוש של Play Console למעלה).

**מ-11.11.2026:** העבודה עם Claude הסתיימה. בכל מקום שכתוב "לבקש מ-Claude", הכוונה עכשיו למפתח, או לעוזר AI שעובד על הפרויקט במחשב הזה. הפקודות המדויקות כתובות ליד כל שלב ובקובצי ההוראות שבפרויקט. נקודת ההתחלה היא `docs/HANDOVER.he.md`.

**מה המצב כיום (2026-10-26):** האפליקציה היא לקוח של השרת המאוחסן https://yourpersonaldiary.fly.dev
עם מצב לא-מקוון אוטומטי. המזהה שלה ב-Play הוא `app.yourpersonaldiary` – קבוע לתמיד אחרי ההעלאה
הראשונה (לכן הסקריפטים בודקים אותו שוב ושוב).

## מה צריך להכין מראש

- **חשבון מפתח אישי ב-Google Play** (תשלום חד-פעמי של 25$): נרשמים ב-https://play.google.com/console
  עם חשבון Google. ההרשמה כוללת אימות זהות (תעודה מזהה) ואימות של מכשיר Android דרך אפליקציית
  Play Console בטלפון. זה יכול לקחת כמה ימים – כדאי להתחיל לפני כל השאר.
- **כתובת דואר אלקטרוני** שתופיע בחנות כ"יצירת קשר" (אותה כתובת שממלאים במדיניות הפרטיות).
- **12 בודקים לפחות**, כל אחד עם חשבון Google ועם טלפון Android – חברים, משפחה. הם יצטרכו
  להתקין את האפליקציה מ-Play ולהשאיר אותה מותקנת 14 יום ברצף (חלק ז). כדאי לגייס 15, למקרה שמישהו
  יסיר באמצע.
- **מדיניות הפרטיות באוויר**: הדף https://yourpersonaldiary.fly.dev/privacy חייב להיפתח בדפדפן
  (חבילת PLAY-LEGAL בונה אותו; Claude מעלה אותו לשרת). גם https://yourpersonaldiary.fly.dev/delete-account.
- **טלפון Android** להתקנת בדיקה של הקובץ לפני ההעלאה (לא חובה, מומלץ).

## הערכה (kit) – איזה קובץ הולך לאן

כל הקבצים נמצאים בתיקיית הפרויקט `C:\Users\AVI\Projects\my-personal-diary`. פותחים קובץ `.txt`
בלחיצה כפולה (פנקס רשימות); כדי להעתיק את כולו: Ctrl+A ואז Ctrl+C, ובאתר Ctrl+V.

| הקובץ בערכה | לאן הוא הולך ב-Play Console |
|---|---|
| `play\listing\en-US\title.txt` | Main store listing ← **App name** |
| `play\listing\en-US\short.txt` | Main store listing ← **Short description** |
| `play\listing\en-US\full.txt` | Main store listing ← **Full description** |
| `play\listing\<שפה>\...` (19 תיקיות נוספות) | Main store listing ← **Manage translations** ← השפה המתאימה (טבלת השפות בחלק ה) |
| `play\graphics\icon-512.png` | Main store listing ← **App icon** |
| `play\graphics\feature-1024x500.png` | Main store listing ← **Feature graphic** |
| `play\screenshots\<שפה>\01-home.png … 06-settings.png` | Main store listing ← **Phone screenshots** (לכל שפה בנפרד; מגיעים מחבילת צילומי המסך) |
| `play\policy\app-access.md` | App content ← **App access** (הוראות לבודק של Google) |
| `play\policy\content-rating.md` | App content ← **Content ratings** (תשובות השאלון) |
| `play\policy\target-audience.md` | App content ← **Target audience and content** |
| `play\policy\data-safety.md` | App content ← **Data safety** (תשובות הטופס) |
| `android\app\build\outputs\bundle\release\app-release.aab` | Closed testing / Production ← **Create new release** ← App bundles |
| `android\app\build\outputs\mapping\release\mapping.txt` | אותו release ← **App bundle explorer** ← Downloads ← Upload ReTrace mapping file |
| `play\last-upload.json` | **לא מעלים** – מעדכנים בו אחרי כל העלאה איזה versionCode עלה (חלק ז, סעיף 7) |
| `play\README.he.md` | הסבר קצר על תיקיית `play` (לקריאה) |

**מה אסור לשתף עם איש, לא להעלות ל-Git ולא להדביק בצ'אט:**

- הקובץ `C:\Users\AVI\Projects\android-signing\upload-keystore.jks` (מפתח ההעלאה) והקובץ
  `keystore.properties` שלידו (מכיל את הסיסמה).
- הסיסמה של מפתח ההעלאה.
- הסיסמה של חשבון ההדגמה `stor` – נכתבת רק בשדה **Password** של App access ב-Play Console (חלק ד,
  סעיף 2), ששם רק בודקי Google רואים אותה (ול-Microsoft Store – רק ב-Partner Center).
- רשימת כתובות המייל של הבודקים.

---

## חלק א – מפתח ההעלאה (פעם אחת, לכל חיי האפליקציה)

**מה זה:** ב-Google Play יש שני מפתחות. **מפתח החתימה של האפליקציה** (app signing key) נמצא אצל
Google – בו נחתם מה שהמשתמשים מתקינים. **מפתח ההעלאה** (upload key) נמצא אצלך – בו נחתם הקובץ
שאתה מעלה ל-Play Console, וכך Google יודעת שההעלאה באה ממך. אפליקציה חדשה נרשמת ל-Play App
Signing אוטומטית עם ההעלאה הראשונה. אם מפתח ההעלאה אובד – לא מאבדים את האפליקציה, אבל כל העלאה
נעצרת עד שמבקשים מגוגל איפוס (Request upload key reset) ומחכים לתשובה. לכן: גיבוי.

1. פותחים PowerShell: מקש Windows, כותבים `PowerShell`, Enter.
2. עוברים לתיקיית הפרויקט:

   ```
   cd C:\Users\AVI\Projects\my-personal-diary
   ```

3. מריצים את הסקריפט (אפשר קודם עם `-DryRun` בסוף – הוא רק מדפיס מה הוא עומד לעשות ולא יוצר כלום):

   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\android\create-upload-key.ps1
   ```

4. הסקריפט מבקש **סיסמה אחת** (מקלידים – לא רואים את התווים – Enter, ושוב לאישור). כללים: 8–64
   תווים, אותיות לטיניות, ספרות וסימני פיסוק, בלי רווחים ובלי לוכסן אחורי `\`. למפתח מסוג PKCS12
   יש סיסמה אחת למאגר ולמפתח – לכן מבקשים אחת.
5. הסקריפט יוצר (ומסרב לדרוס, אם כבר קיים):
   - `C:\Users\AVI\Projects\android-signing\upload-keystore.jks` – המפתח (RSA 2048, תוקף 10,000 יום ≈ 27 שנה; Google דורשת לפחות 25).
   - `C:\Users\AVI\Projects\android-signing\keystore.properties` – הקובץ ש-Gradle קורא בבנייה (מכיל את הסיסמה; הרשאות קריאה רק לך).
   ומדפיס רק את **טביעת האצבע SHA-256** של האישור – לא את הסיסמה. אותה טביעת אצבע תופיע אחר כך
   ב-Play Console (חלק ו) – כך יודעים שהקובץ שעלה נחתם במפתח הנכון.
6. **עכשיו, לפני שסוגרים את החלון:** מעתיקים את הקובץ `upload-keystore.jks` ואת הסיסמה למנהל
   סיסמאות (או לכונן חיצוני). הסיסמה לא נשמרת בשום מקום אחר חוץ מ-`keystore.properties`.
7. לא מריצים את הסקריפט שוב. אם בטעות מריצים – הוא מסרב לדרוס את הקבצים הקיימים.

## חלק ב – בניית הקובץ להעלאה (לפני כל העלאה)

הקובץ שמעלים ל-Google Play הוא **Android App Bundle** (סיומת `.aab`) – מאז אוגוסט 2021 Play
מקבל רק אותו עבור אפליקציות חדשות. בכל העלאה חייב להיות **versionCode** (מספר פנימי) גבוה מכל
העלאה קודמת – לכן הפקודה כוללת `-Bump`, שמעלה את המספר באחד.

1. ב-PowerShell, בתיקיית הפרויקט:

   ```
   npm run android:aab -- -Bump
   ```

   (עם שני המינוסים ורווח לפני `-Bump`). זה לוקח כמה דקות: בניית ממשק המשתמש, סנכרון לפרויקט
   האנדרואיד, בניית ה-bundle עם R8.
2. בסוף מופיע סיכום. בודקים:
   - `Version:` – המספרים (versionName כמו במחשב, versionCode חדש).
   - `App id:  app.yourpersonaldiary` – לא שום דבר אחר.
   - `Signed:  yes` ואחריו `Signer:  SHA-256 …` – אותה טביעת אצבע כמו בחלק א. אם כתוב `Signed: NO` – חלק א לא בוצע, או שהקובץ `keystore.properties` לא במקומו.
   - `AAB:` – הנתיב של הקובץ, בדרך כלל `android\app\build\outputs\bundle\release\app-release.aab`.
   - `Mapping:` – הקובץ `mapping.txt` שמעלים יחד עם ה-bundle (כדי שדיווחי קריסות יהיו קריאים).
3. שורות על **bundletool**: זה כלי של Google שבודק את ה-bundle כמו ש-Play יבדוק, ובונה ממנו קובץ
   APK אחד להתקנת בדיקה בטלפון. הוא לא חלק מערכת הכלים ואף סקריפט לא מוריד אותו לבד. אם כתוב
   `bundletool: not found` – אפשר להמשיך בלעדיו (ה-bundle שלם); או להוריד ידנית מ-
   https://github.com/google/bundletool/releases את `bundletool-all-<גרסה>.jar`, לשמור בשם
   `C:\Users\AVI\Tools\bundletool\bundletool.jar`, ולהריץ שוב `npm run android:aab -- -SkipWeb -SkipSync`.
   אז הסקריפט גם מריץ `verify-apk.ps1 -Release` על ה-APK האוניברסלי, ואפשר להתקין אותו בטלפון
   לבדיקה (`adb install -r <הנתיב שמודפס>`; או לבקש מ-Claude). ה-APK הזה חתום במפתח debug – רק
   להתקנת בדיקה, לא להפצה; Play חותם בעצמו את מה שהמשתמשים מקבלים.
4. **בדיקת מוכנות** – לפני שפותחים את Play Console:

   ```
   node scripts\play\preflight.mjs
   ```

   כל שורה היא בדיקה: `[PASS]` טוב, `[WARN]` לשיקולך (למשל צילומי מסך שעוד לא נוצרו), `[FAIL]`
   חייבים לתקן לפני העלאה – השורה אומרת מה ואיך. הבדיקות: 20 שפות של טקסטי החנות בתוך המגבלות
   (30 / 80 / 4000 תווים), הגרפיקה בגדלים הנכונים, צילומי המסך, דפי הפרטיות בנויים ובלי שדות
   `{{...}}` לא ממולאים, המזהה `app.yourpersonaldiary`, ה-versionCode גבוה מההעלאה הקודמת
   (`play\last-upload.json`), וקובץ החתימה במקומו.

## חלק ג – יצירת האפליקציה ב-Play Console

1. נכנסים ל-https://play.google.com/console ולוחצים **Create app** (למעלה מימין בדף All apps).
2. ממלאים:
   - **App name:** `Your Personal Diary` (בדיוק כמו ב-`play\listing\en-US\title.txt`).
   - **Default language:** **English (United States) – en-US**. זו שפת הבסיס של הדף; כל שאר השפות
     נוספות אחר כך כתרגומים.
   - **App or game:** App.
   - **Free or paid:** Free. (לפי Google אפליקציה שפורסמה כחינמית לא ניתן להפוך אחר כך לבתשלום – לנו זה לא רלוונטי.)
3. **Declarations:** מסמנים את שתי ההצהרות (Developer Program Policies, US export laws) ומאשרים
   את **Play App Signing Terms of Service** – זו ההצטרפות ל-Play App Signing (Google שומרת את מפתח
   החתימה, אתה את מפתח ההעלאה).
4. **Create app**. נפתח ה-**Dashboard** (לוח הבקרה) של האפליקציה. הוא מציג רשימות משימות – עוברים
   עליהן לפי הסדר של המדריך.

## חלק ד – לוח הבקרה: "Set up your app" – ההצהרות

ב-Dashboard, בקטע **Set up your app**, לוחצים **View tasks**. כל משימה פותחת מסך בדף **App content**
(אפשר להגיע לכל אחת גם ישירות: בתפריט השמאלי, Policy ← **App content**). אחרי כל מסך לוחצים **Save**.

1. **Set privacy policy** (מדיניות פרטיות): מדביקים `https://yourpersonaldiary.fly.dev/privacy`.
   חובה שהדף ייפתח בדפדפן באותו רגע. Google דורשת שהמדיניות תהיה גם בתוך האפליקציה (יש קישור
   בהגדרות ← פרטיות ובמסך ההרשמה) וגם בשדה הזה.
2. **App access** (גישה לאפליקציה): בוחרים **All or some functionality in my app is restricted**
   (כי צריך חשבון כדי להשתמש). לוחצים **Add new instructions** וממלאים מתוך
   `play\policy\app-access.md`: שם ההוראה, שם המשתמש של **חשבון ההדגמה** – `stor` (לא החשבון שלך!) –
   והסיסמה שלו, ובשדה **Any other instructions** – הטקסט באנגלית מאותו קובץ. ההרשמה בשרת פתוחה, ובכל
   זאת הבודקים נכנסים לחשבון ההדגמה: כבר יש בו נתוני דוגמה, והשרת מקבל רק כמה הרשמות בשעה מאותה רשת.
   הסיסמה נכתבת רק בשדה Password הזה – לא בקובץ ולא בצ'אט. לפני כל הגשה נכנסים פעם אחת ל-`stor`
   ובודקים שנתוני הדוגמה עדיין שם (`app-access.md`, "What the owner does before each submission").
3. **Ads** (פרסומות): **No, my app does not contain ads**.
4. **Content ratings** (דירוג תוכן): **Start questionnaire**. כתובת מייל (שלך), **Category:**
   `Utility, Productivity, Communication, or Other`. עונים על השאלות לפי `play\policy\content-rating.md`
   (ליומן אישי: אין אלימות, אין תוכן מיני, אין קניות, אין שיתוף תוכן בין משתמשים; קוראים את הקובץ – שם
   ההחלטות המנומקות). **Save** ← **Next** ← בודקים את הסיכום (צפוי "Everyone" / PEGI 3) ← **Submit**.
   אם משנים בעתיד תכונות שמשפיעות על התשובות, ממלאים את השאלון מחדש.
5. **Target audience and content** (קהל יעד): בוחרים את קבוצות הגיל לפי ההחלטה ב-
   `play\policy\target-audience.md`. **לא** לסמן גילאים מתחת ל-13 (אז חלות דרישות Families).
   שימו לב: לפי Google, קבוצת 13–15 עשויה להיחשב "ילדים" במדינות מסוימות – לכן ההמלצה היא 16–17
   ו-18+ בלבד, או 18+ בלבד (לפי הקובץ). לשאלה אם האפליקציה עשויה למשוך ילדים – **No**.
6. **News apps** (אפליקציית חדשות): **No**.
7. **COVID-19 contact tracing and status apps**: **My app is not a publicly available COVID-19 contact tracing or status app**.
8. **Data safety** (בטיחות נתונים): **Start**. עונים בדיוק לפי `play\policy\data-safety.md`, שאלה
   אחרי שאלה (הקובץ כתוב באותו סדר): האפליקציה אוספת נתונים – כן; מוצפנים בדרך – כן; אפשר לבקש
   מחיקה – כן, וכתובת המחיקה היא `https://yourpersonaldiary.fly.dev/delete-account`; סוגי הנתונים
   (כתובת מייל, מזהה משתמש, התוכן שהמשתמש כותב) – נאספים, **לא** משותפים, לצורך App functionality
   ו-Account management. בסוף – **Submit**. אחר כך בודקים בתצוגה המקדימה שמה שיופיע בחנות הגיוני.
9. **Government apps** (אפליקציה ממשלתית): **No**.
10. **Financial features** (שירותים פיננסיים): **My app doesn't provide any financial features**.
11. **Health** (בריאות): **My app does not have any health features** (מעקב ההרגלים אינו שירות רפואי).
12. **Advertising ID** (מופיע לאפליקציות שמיועדות ל-Android 13 ומעלה – שלנו כן): **No, my app does
    not use advertising ID**. האפליקציה לא מבקשת את ההרשאה `com.google.android.gms.permission.AD_ID`
    (סקריפט האימות של ה-APK בודק את רשימת ההרשאות המדויקת), אז ההצהרה והקובץ מסכימים.

בנוסף, באותו דף App content או תחת **Store settings** (בתפריט: Grow ← Store presence ← Store settings):

- **App category:** `Lifestyle` (אפשר גם `Productivity`). **Tags:** לא חובה.
- **Store listing contact details:** כתובת המייל ליצירת קשר (חובה). טלפון ואתר – לא חובה.
- **External marketing:** אפשר להשאיר כבוי.

## חלק ה – דף החנות (Main store listing)

בתפריט השמאלי: Grow (או Grow users) ← Store presence ← **Main store listing**.

1. **App name:** מדביקים את `play\listing\en-US\title.txt` (עד 30 תווים).
2. **Short description:** מדביקים את `play\listing\en-US\short.txt` (עד 80 תווים).
3. **Full description:** מדביקים את `play\listing\en-US\full.txt` (עד 4,000 תווים).
4. **Graphics:**
   - **App icon:** מעלים `play\graphics\icon-512.png` (512×512, PNG עם שקיפות).
   - **Feature graphic:** מעלים `play\graphics\feature-1024x500.png` (1024×500, בלי שקיפות).
   - **Phone screenshots:** מעלים 2 עד 8 תמונות מ-`play\screenshots\en-US\` (`01-home.png` …
     `06-settings.png`), לפי הסדר. אם התיקייה עוד לא קיימת – חבילת צילומי המסך עוד לא סיימה; אי
     אפשר לפרסם בלי לפחות 2 צילומי מסך לשפת הבסיס. כללי Google לתמונה: JPEG או PNG בלי שקיפות, כל
     צלע 320–3840 פיקסלים, והצלע הארוכה **לא יותר מכפול** מהקצרה (1080×1920 מתקבל; 1080×2400 נדחה).
     בדיקת המוכנות (חלק ב, סעיף 4) בודקת את זה מראש.
   - **7-inch tablet / 10-inch tablet screenshots:** לא חובה. אפשר להעלות את אותם קבצים או להשאיר ריק.
   - **Video:** לא חובה.
5. **Save**.
6. **תרגומים:** למעלה בדף Main store listing לוחצים **Manage translations** ← **Add your own
   translation texts**, מסמנים את 19 השפות לפי הטבלה, ו-**Add**. אז מופיע בורר שפה בראש הדף: עוברים
   שפה-שפה, ומדביקים את `title.txt`, `short.txt`, `full.txt` מהתיקייה המתאימה (ואם יש – את צילומי
   המסך של אותה שפה; האייקון ו-feature graphic משותפים לכולן). **Save** בכל שפה.

   | תיקייה בערכה | השפה ב-Play Console |
   |---|---|
   | `he-IL` | Hebrew – **iw-IL** (ב-Play העברית מסומנת בקוד הישן iw) |
   | `ar` | Arabic – ar |
   | `zh-CN` | Chinese (Simplified) – zh-CN |
   | `ja-JP` | Japanese – ja-JP |
   | `hi-IN` | Hindi – hi-IN |
   | `th` | Thai – th |
   | `es-ES` | Spanish (Spain) – es-ES |
   | `pt-BR` | Portuguese (Brazil) – pt-BR |
   | `fr-FR` | French (France) – fr-FR |
   | `it-IT` | Italian – it-IT |
   | `de-DE` | German – de-DE |
   | `ro` | Romanian – ro |
   | `el-GR` | Greek – el-GR |
   | `pl-PL` | Polish – pl-PL |
   | `cs-CZ` | Czech – cs-CZ |
   | `hu-HU` | Hungarian – hu-HU |
   | `ru-RU` | Russian – ru-RU |
   | `bg` | Bulgarian – bg |
   | `tr-TR` | Turkish – tr-TR |

   (אם תיקיית הערכה כבר נקראת `iw-IL` – זה אותו דבר.)

## חלק ו – Play App Signing (רק לוודא)

אחרי ההעלאה הראשונה (חלק ז) נכנסים ל-**Test and release ← Setup ← App signing** (בגרסאות חדשות
של הקונסולה: **Protected with Play ← Play app signing**). שם רואים:

- שההצטרפות פעילה (Google יצרה את מפתח החתימה).
- **Upload key certificate** עם טביעת אצבע **SHA-256** – חייבת להיות זהה למה שהדפיס
  `create-upload-key.ps1` (חלק א) ו-`build-aab.ps1` (חלק ב, שורת `Signer:`). אם לא זהה – הקובץ
  נחתם במפתח אחר, לא מעלים הלאה.

לא מורידים משם כלום ולא מעלים לשם את קובץ ה-`.jks` – לעולם.

## חלק ז – בדיקה סגורה (Closed testing)

לחשבון מפתח אישי Google דורשת, לפני שמותר לפרסם לכולם: **לפחות 12 בודקים** שמחוברים לבדיקה
הסגורה **ברצף 14 יום**. רק אחר כך אפשר להגיש "Apply for production" (חלק ח).

1. **רשימת הבודקים:** Test and release ← Testing ← **Closed testing**. יש כבר מסלול מוכן (בדרך
   כלל בשם "Alpha" / "Closed testing – Alpha"); לוחצים **Manage track**. בלשונית **Testers**:
   **Create email list** ← שם לרשימה (למשל `Diary testers`) ← מדביקים את כתובות המייל של הבודקים
   מופרדות בפסיקים (חשבון Google של כל אחד – זה החשבון שמותקן בטלפון שלהם) ← **Save changes** ←
   **Create**. חוזרים ללשונית Testers, מסמנים את הרשימה, ממלאים **Feedback URL or email address**
   (כתובת המייל שלך) ו-**Save changes**.
2. **ההעלאה:** לשונית **Releases** ← **Create new release**. תחת **App bundles** לוחצים **Upload**
   ובוחרים את `app-release.aab` (הנתיב מחלק ב). מחכים שהעיבוד יסתיים. **Release name** מתמלא לבד
   (versionCode / versionName) – אפשר להשאיר. **Release notes:** בתוך הבלוק `<en-US> … </en-US>`
   כותבים משפט באנגלית, למשל `First closed test of Your Personal Diary.` ← **Next**.
3. מסך הסיכום מציג שגיאות ואזהרות. אזהרות (למשל על קובץ מיפוי) מותר להמשיך; שגיאה – מתקנים. לוחצים
   **Save and publish** (או **Start rollout to Closed testing**) ומאשרים.
4. **קובץ המיפוי:** באותו release, תחת App bundles, הקישור של ה-bundle ← **App bundle explorer** ←
   לשונית **Downloads** ← **Upload ReTrace mapping file** ← `mapping.txt` (הנתיב מחלק ב). לא חובה, אבל אז
   דיווחי קריסות ב-Play יהיו קריאים.
5. **הסקירה הראשונה:** הגרסה הראשונה של אפליקציה חדשה נבדקת על ידי Google – לפי Google זה יכול
   לקחת **עד 7 ימים, ולפעמים יותר**. עוקבים ב-Dashboard. כשהסטטוס הופך ל-**Published** (או
   "Available to testers"), בלשונית Testers מופיע **קישור ההצטרפות** (opt-in link, בצורה
   `https://play.google.com/apps/testing/app.yourpersonaldiary`); אחרי הפרסום הראשון הקישור יכול
   לקחת עוד כמה שעות להופיע.
6. **הבודקים:** שולחים לכל אחד את קישור ההצטרפות עם ההוראות: לפתוח את הקישור בטלפון כשמחוברים
   לחשבון Google שברשימה ← **Become a tester** ← להתקין מ-Google Play ← להשתמש ← **לא להסיר ולא
   לצאת מהבדיקה (Leave the program) במשך 14 יום**. איך הזמן נספר: ה-14 יום חייבים להיות רצופים, ועם
   12 בודקים לפחות **בו-זמנית**. בודק שיצא וחזר מתחיל את 14 הימים שלו מההתחלה; אם ירדתם מתחת ל-12 –
   הספירה לא מתקדמת. ה-Dashboard מציג כמה בודקים מחוברים וכמה ימים נותרו.
7. **אחרי כל העלאה מוצלחת – מעדכנים את `play\last-upload.json`:** כותבים שם את ה-versionCode שעלה,
   את versionName, את התאריך ואת המסלול (`closed-testing`). הפשוט ביותר: לכתוב ל-Claude "העליתי
   versionCode 2 לבדיקה סגורה ב-26.10.2026" והוא יעדכן. בלי זה, בדיקת המוכנות לא תדע לעצור העלאה
   עם מספר שכבר היה.
8. **עדכון בזמן הבדיקה:** חוזרים לחלק ב (`npm run android:aab -- -Bump`, בדיקת מוכנות), ואז Closed
   testing ← Releases ← **Create new release** ← מעלים את ה-bundle החדש ← Next ← Save and publish.
   הבודקים מקבלים את העדכון מ-Play. עדכון לא מאפס את ספירת 14 הימים.

## חלק ח – בקשה לפרסום לכולם (Apply for production)

כשה-Dashboard מראה שעמדתם בדרישה (12 בודקים, 14 יום), מופיע בו הכפתור **Apply for production**.

1. לוחצים עליו. הטופס מחולק לשלושה חלקים; **כל חלק נשמר רק כשלוחצים Next או Apply** – אם סוגרים
   באמצע, התשובות אבדו. כותבים באנגלית, פשוט וכנה.
2. **חלק 1 – על הבדיקה הסגורה:** כמה קל היה לגייס בודקים; עד כמה הם השתמשו (האם בכל התכונות – כתיבת
   רשומות, הרגלים, תובנות, תזכורות, גיבוי, מצב לא-מקוון); איזה משוב קיבלתם ואיך אספתם אותו (מייל, שיחות).
3. **חלק 2 – על האפליקציה:** קהל היעד (מבוגרים שרוצים יומן פרטי); הערך (יומן אישי מוצפן לפי חשבון,
   עובד גם בלי אינטרנט ומסתנכרן בין מכשירים, 20 שפות, בלי פרסומות ובלי מעקב); הערכת התקנות בשנה הראשונה.
4. **חלק 3 – מוכנות:** מה שיניתם בעקבות הבדיקה ואיך החלטתם שהאפליקציה מוכנה.
5. **Apply**. Google סוקרת ושולחת מייל לבעל החשבון – לפי Google "בדרך כלל עד שבעה ימים, לעיתים
   יותר". ייתכן שיבקשו להמשיך לבדוק אם היו פחות מ-12 בודקים או מעורבות נמוכה.

## חלק ט – שחרור לייצור (Production)

1. אחרי האישור: Test and release ← **Production** ← **Countries / regions** ← **Add countries /
   regions** – בוחרים את המדינות (אפשר את כולן; לפחות ישראל). **Save**.
2. **Create new release**. אפשר להעלות את אותו `app-release.aab` שנבדק, או ללחוץ **Add from
   library** ולבחור את ה-bundle שכבר הועלה לבדיקה הסגורה (לא חייבים לבנות מחדש). Release notes
   באנגלית ← **Next** ← **Save and publish** (או **Start rollout to Production**).
   אפשר שחרור הדרגתי (Staged rollout, למשל 20% מהמשתמשים) – לא חובה.
3. שוב סקירה של Google (עד 7 ימים, ולעיתים יותר). כשהסטטוס הופך ל-**Published**, האפליקציה
   זמינה בכתובת `https://play.google.com/store/apps/details?id=app.yourpersonaldiary`.
4. מעדכנים את `play\last-upload.json` (מסלול `production`).

**אפשרות:** **Managed publishing** (Publishing overview ← Managed publishing) – אז גם אחרי אישור
Google השינויים עולים לאוויר רק כשלוחצים **Publish**. נוח אם רוצים לתזמן.

## חלק י – אחרי כל גרסה ותחזוקה שוטפת

- **כל עדכון** עובר אותו מסלול: חלק ב (`-Bump`, בדיקת מוכנות) ← Production ← Create new release ←
  העלאה ← `last-upload.json`. ה-versionCode חייב לעלות בכל פעם; versionName הוא מספר הגרסה של
  package.json (משותף למחשב).
- **Data safety / Content ratings / Target audience:** אם משתנה מה שהאפליקציה אוספת או מה היא עושה,
  מעדכנים את ההצהרות (Google דורשת שהן יישארו נכונות).
- **targetSdk:** Google דורשת כל שנה (סביב אוגוסט) לעבור לגרסת Android חדשה. סשן סוכן שנתי
  (docs/ANDROID-PLAN.md, חלק 7).
- **הגיבוי של מפתח ההעלאה:** לבדוק פעם בשנה שהקובץ והסיסמה עדיין במנהל הסיסמאות.

## תקלות נפוצות

| ההודעה / הבעיה | מה זה אומר | מה עושים |
|---|---|---|
| "You uploaded an APK or Android App Bundle that was signed in debug mode" או "…that is not signed" | ה-bundle לא נחתם במפתח ההעלאה | חלק א לא בוצע, או `keystore.properties` לא בתיקייה. בונים מחדש (חלק ב) ובודקים `Signed: yes`. |
| "Version code N has already been used" | אותו versionCode כבר הועלה | `npm run android:aab -- -Bump`, ומעדכנים את `play\last-upload.json`. |
| "Your Android App Bundle is signed with the wrong key" | נחתם במפתח אחר מזה שרשום ב-Play | משחזרים את `upload-keystore.jks` מהגיבוי לתיקייה `android-signing`. אם אבד – איפוס מפתח (למטה). |
| "The package name … is already in use" / "You need to use a different package name" | המזהה תפוס | לא אמור לקרות: המזהה `app.yourpersonaldiary` נבדק פנוי. אם קרה – לבקש מ-Claude לבדוק את build.gradle. |
| "Your privacy policy URL is not valid" | הדף לא נפתח | בודקים ש-https://yourpersonaldiary.fly.dev/privacy נפתח בדפדפן; אם לא – לבקש מ-Claude להעלות את דפי הפרטיות לשרת. |
| קישור ההצטרפות לא עובד / "the app is not available" | הגרסה עוד לא פורסמה, או הבודק לא בחשבון Google שברשימה | מחכים לסטטוס Published (ועוד כמה שעות); הבודק פותח את הקישור כשהוא מחובר לחשבון מהרשימה. |
| מפתח ההעלאה אבד | אין אפשרות להעלות | App signing (חלק ו) ← **Request upload key reset**: יוצרים מפתח חדש בתיקייה אחרת (`create-upload-key.ps1 -OutputDir <תיקייה חדשה>`), מייצאים ממנו אישור PEM (`keytool -export -rfc -keystore <הקובץ> -alias upload -file upload_certificate.pem`), מעלים את ה-PEM בטופס, מחכים למייל מגוגל, ואז מחליפים את התיקייה. עד אז אין העלאות. |

## מקורות (מסמכי Google, נקראו 2026-10-26)

- Play App Signing – מפתח העלאה לעומת מפתח חתימה, RSA 2048 לפחות, איפוס מפתח העלאה:
  https://support.google.com/googleplay/android-developer/answer/9842756
- דרישות הבדיקה לחשבון מפתח אישי – 12 בודקים, 14 יום רצופים, Apply for production, סקירה "בדרך כלל עד שבעה ימים":
  https://support.google.com/googleplay/android-developer/answer/14151465
- הקמת בדיקה סגורה – רשימות מייל, קישור הצטרפות (מופיע רק כשהסטטוס Published):
  https://support.google.com/googleplay/android-developer/answer/9845334
- יצירת אפליקציה – שפת ברירת מחדל, App/Game, Free/Paid, ההצהרות:
  https://support.google.com/googleplay/android-developer/answer/9859152
- דף App content – App access (פרטי התחברות לבודק), מדיניות פרטיות (URL פעיל), הצהרת פרסומות:
  https://support.google.com/googleplay/android-developer/answer/9859455
- Data safety – ההגדרות של "נאסף" ו"משותף", הצפנה בדרך, בקשת מחיקה, חובת מדיניות פרטיות:
  https://support.google.com/googleplay/android-developer/answer/10787469
- מחיקת חשבון – נתיב בתוך האפליקציה וקישור אינטרנט בטופס Data safety:
  https://support.google.com/googleplay/android-developer/answer/13327111
- דירוג תוכן (IARC) – השאלון, הקטגוריות, מילוי מחדש כשהתוכן משתנה:
  https://support.google.com/googleplay/android-developer/answer/9859655
- קהל יעד ותוכן – קבוצות הגיל, 13–15 "עשויה להיחשב ילדים במדינות מסוימות", דרישות Families:
  https://support.google.com/googleplay/android-developer/answer/9867159
- Advertising ID – ההרשאה AD_ID ל-Android 13 ומעלה:
  https://support.google.com/googleplay/android-developer/answer/6048248
- לוח זמנים לסקירה – "עד שבעה ימים ויותר במקרים חריגים", Managed publishing:
  https://support.google.com/googleplay/android-developer/answer/9859751
- Android App Bundle – חובה לאפליקציות חדשות מאוגוסט 2021:
  https://developer.android.com/guide/app-bundle
- versionCode / versionName – מספר חיובי, עולה בכל גרסה, מקסימום 2100000000:
  https://developer.android.com/studio/publish/versioning
- מגבלות דף החנות וגרפיקה – תיאור קצר 80 תווים, אייקון 512×512 PNG 32 ביט, feature graphic 1024×500, צילומי מסך 2–8:
  https://support.google.com/googleplay/android-developer/answer/9866151
- שפות דף החנות וקודיהן (עברית = iw-IL):
  https://support.google.com/googleplay/android-developer/answer/9844778
- bundletool – הורדה מ-GitHub, `build-apks --mode=universal`, חתימה ב-debug key כשאין `--ks`:
  https://developer.android.com/tools/bundletool
