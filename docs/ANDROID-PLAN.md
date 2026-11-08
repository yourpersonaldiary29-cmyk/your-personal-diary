# Your Personal Diary – תוכנית הגרסה לאנדרואיד

נכתב 2026-09-30 על סמך שלוש הצעות ארכיטקטורה עצמאיות (Capacitor, Tauri Mobile, Node משובץ)
ובקשות הבעלים. זהו המסמך המחייב לבנייה. השם "Your Personal Diary" נשאר באנגלית בכל שפה.

## 1. הבחירה: Capacitor 8 עם "ליבה" בתוך ה-WebView

| קריטריון | Capacitor (A) | Tauri Mobile (B) | Node משובץ (C) |
|---|---|---|---|
| ניתן לבנות במחשב הזה (בלי הרשאות מנהל) | כן | **חסום**: ה-CLI יוצר symlink שדורש Developer Mode (tauri#16087) | כן, אבל דורש NDK (~1 GB) |
| שימוש חוזר בקוד הקיים | כל server/src + כל ה-UI, ללא שינוי | אותו דבר, אבל דרך IPC איטי (postMessage) | כל השרת כמו שהוא |
| פרטיות ואבטחה | הרשאת רשת רק ל-SMTP; פורמטים זהים | זהה | זהה, אבל Node 18 שפג תוקפו (nodejs-mobile לא מתוחזק) |
| תחזוקה | קהילה גדולה, עדכון targetSdk שנתי פשוט | קהילה קטנה, באגים פתוחים ב-Android | תלוי בפרויקט תקוע; כלל 16 KB של Play |
| גודל התקנה | ~15 MB | ~20 MB (3 ABI) | ~100–130 MB |
| iOS אחר כך | ~90% שימוש חוזר (WKWebView) | תלוי ב-CLI תקין | קשה |

**החלטה: A.** נימוק מרכזי: ב-B הבנייה חסומה במחשב הזה, וב-C הזמן-ריצה אינו מתוחזק וכבד. ב-A כל
לוגיקת השרת (אימות, הצפנה, ניתוח, חיפוש, לוח שנה, ייצוא) רצה ללא שינוי בתוך Web Worker בטלפון,
ולכן קובצי ה-.mpd וקובצי הגיבוי זהים בייט-לבייט למחשב (אותו קוד כותב אותם).

## 2. איך זה עובד

- **UI:** אותו React מ-`src/`, נבנה עם `__MOBILE__=true`. קוד Capacitor רק מאחורי `if (__MOBILE__)`,
  כך ש-dist של המחשב לא משתנה.
- **תעבורה:** ב-`src/api/client.ts` נקודת חיבור אחת, `setApiTransport()`. בטלפון הבקשות נשלחות ל-Worker
  במקום ל-fetch, וחוזרות כ-`Response` רגיל. כל הטיפול בשגיאות, 401/423, Accept-Language נשאר.
- **הליבה (Worker):** `mobile/core/boot.ts` בונה ServerConfig עם נתיבים וירטואליים ומרכיב את אותם ראוטרים
  מ-`server/src/routes/*` באותו סדר middleware כמו `server/src/app.ts`. Express מוחלף ב-express-shim קטן.
- **Shims ל-Node (Vite resolve plugin, רק ליבואים מתוך server/src):**
  `node:crypto` → @noble/hashes (scrypt, sha256) + @noble/ciphers (AES-256-GCM) + getRandomValues;
  `node:fs` → VFS (מראה סינכרונית בזיכרון + כתיבה אטומית tmp→rename דרך @capacitor/filesystem);
  `node:path` → path-browserify; `node:os`/`node:net` → stubs; `sql.js` → build לדפדפן; `pdfkit` → עטיפה
  שקוראת גופנים מה-VFS; `Buffer`/`process` → globals.
- **אחסון:** `Directory.Data` (files/diary/) פרטי לאפליקציה; `allowBackup=false` + dataExtractionRules,
  כדי שגיבוי הענן של Google לא יעלה את device.key יחד עם היומנים.
- **חובה לוודא בספייק הראשון על הטלפון:** Worker inline (WebView לא מיירט בקשות של Worker), טעינת WASM
  וגופנים מה-main thread והעברתם ל-Worker, זמן scrypt (יעד: התחברות ≤ 2 שניות; אם איטי → hash-wasm).

## 3. שלושת הדברים שביקש הבעלים (2026-09-30)

### 3.1 שליחת מיילים כמו במחשב
- הכרטיס "דואר אלקטרוני לאיפוס סיסמה" קיים גם בטלפון, לבעלים בלבד (החשבון הראשון בטלפון).
- לקוח ה-SMTP הקיים (`server/src/mail/smtp.ts`) בנוי על node:net/node:tls, שאין ב-WebView. לכן:
  **פלאגין Capacitor מקומי `mobile/plugins/diary-mail`** (Java, javax.net.ssl + socket) שמממש את אותו
  פרוטוקול: implicit TLS / STARTTLS חובה, AUTH PLAIN/LOGIN, אימות תעודה מלא, timeout 20 s. ה-Worker
  קורא לו דרך ערוץ הבקרה; `mail/service.ts` ו-`password-reset.ts` נשארים ללא שינוי (רק ה-transport מוזרק).
- **הרשאת INTERNET נשארת במניפסט** (בניגוד להצעה A המקורית). כדי לשמור את הבטחת הפרטיות:
  1. CSP: `connect-src 'self'` – ה-WebView עצמו לא יכול לפנות לרשת.
  2. הפלאגין מתחבר רק ל-host שהבעלים הגדיר בכרטיס; אין כתובות קבועות בקוד.
  3. `scripts/check-no-network.mjs` סורק גם `mobile/**` ואת ה-Java, ומאשר רק את diary-mail.
- קישור האיפוס בטלפון: `yourpersonaldiary://reset?token=…` (deep link ל-App) + הקוד בן 6 הספרות שעובד
  תמיד. לכן "שכחתי סיסמה" עובד בטלפון בדיוק כמו במחשב.

### 3.2 פתיחה ראשונה: שפת הטלפון → הרשמה/התחברות
- **עודכן 2026-10-23 (החלטת הבעלים, `docs/android-tasks/HOSTED-IMPL.md` סעיף 13): אין מסך בחירת שפה.**
  האפליקציה נפתחת ישר במסך הפתיחה/הכניסה בשפת הטלפון כשהיא אחת מ-20 השפות (השפה הראשונה ברשימת
  השפות של הטלפון שהאפליקציה תומכת בה), אחרת באנגלית; מחליפים בהגדרות → שפה, והבחירה נשארת.
  שפה שזוהתה לא נשמרת, ולכן כל עוד לא נבחרה שפה, שינוי שפת הטלפון נקלט בהפעלה הבאה - גם אחרי
  יציאה מחשבון בשפה אחרת (שפת החשבון נשמרת בנפרד, `mpd.language.session`, ונמחקת ביציאה). חשבון חדש
  מקבל את שפת המסך (השרת, `Accept-Language`); כשמחוברים - שפת החשבון. עברית וערבית מימין לשמאל
  מהמסך הראשון. סינית מסורתית (`zh-TW`/`zh-HK`) מקבלת את הסינית (המפושטת) של האפליקציה.
  הפרטים: `ARCHITECTURE.md` סעיף 10. מסך `FirstRunLanguagePage` שתוכנן כאן (WP-11) הוסר; עותק
  שלו נשמר ב-`C:\Users\AVI\Projects\mpd-probe\removed-2026-10-23-first-run\`.
  במחשב: שפת המתקין, ובגרסת ה-MSIX - אנגלית.

### 3.3 כפתור "דילוג" – סיור באפליקציה
- במסך הכניסה/ההרשמה כפתור משני "דילוג – רק להסתכל" (מתורגם ל-20 שפות).
- לחיצה יוצרת **חשבון אורח זמני** בליבה (שם משתמש פנימי `_guest`, סיסמה אקראית, נתוני הדגמה
  נטענים אוטומטית), עם דגל `guest: true` ב-session. הכול עובד (רשומות, תובנות, לוח שנה, חיפוש),
  אבל **שום דבר לא נשמר לדיסק** (VFS במצב זיכרון-בלבד לחשבון הזה) ובסגירת האפליקציה הוא נמחק.
- פס עליון קבוע: "מצב סיור – מה שתכתוב לא יישמר. [הרשמה]". לחיצה על הרשמה מוחקת את האורח
  ופותחת את טופס ההרשמה. אורח לא רואה: הגדרות דואר/בעלים, גיבוי, מחיקת חשבון, שינוי סיסמה.
- בשרת: `POST /api/auth/guest` זמין רק כשהבקשה מקומית ובבנייה למובייל (`deps.guestAllowed`); במחשב
  הנתיב לא מורכב, כך שהתנהגות המחשב לא משתנה. בדיקות: אורח לא יוצר קבצים; רישום אחרי אורח
  מתחיל נקי; הבעלים = החשבון הראשון **האמיתי** (אורח לא נספר).

## 4. מה זהה למחשב ומה שונה

זהה: הרשמה/התחברות/זכור אותי/כמה חשבונות, רשומות, הרגלים, תובנות, לוח שנה בשלוש המערכות
והחגים, סטטיסטיקה, חיפוש חכם ב-20 שפות, נעילה (server-side, 423), גיבוי ושחזור (אותו קובץ),
ייצוא TXT/CSV/JSON/PDF (הגופנים באפליקציה), הגדרות (שפה, תצוגה, חשבון, שינוי סיסמה, מחיקת חשבון),
דואר לאיפוס סיסמה (ראו 3.1).

שונה בטלפון:
- מעטפת Android: סרגל עליון (חץ חזרה בצד ההתחלה, מתהפך ב-RTL), ניווט תחתון (בית, יומן, לוח שנה,
  הרגלים, עוד), כפתור צף "רשומה חדשה", גיליון "עוד" (תובנות, סטטיסטיקה, חיפוש, גיבוי, הגדרות).
- `src/styles/mobile.css`: safe-areas (edge-to-edge), יעדי מגע ≥ 48dp, קלט ≥ 16px, דיאלוגים כגיליון תחתון,
  לוח שנה דחוס ב-≤ 412px, ללא hover.
- כפתור Back של המערכת: סוגר דיאלוג → אחורה → ממזער (מכבד את שומר "שינויים לא נשמרו").
- תזכורות = התראות מתוזמנות של המערכת (@capacitor/local-notifications), כולל אחרי אתחול; בקשת
  הרשאה ב-Android 13+; טקסט גנרי אלא אם המשתמש בחר להציג שמות הרגלים.
- נעילה: "נעל כשאני יוצא מהאפליקציה", פתיחה בטביעת אצבע (BiometricPrompt, הסיסמה תמיד זמינה),
  FLAG_SECURE (הסתרה ב-Recents וצילומי מסך), flush של הליבה באירוע pause.
- קבצים: "שמור במכשיר" (Storage Access Framework), "שתף", פתיחת .mpd מ-Files/WhatsApp → שחזור.
- לא קיים בטלפון: גישה מרחוק (DuckDNS/HTTPS), גישה מהרשת הביתית, כרטיס אבחון, קיצורי מקלדת
  (נשארים למקלדת Bluetooth). כרטיס "אודות" במקום אבחון: גרסה, נפח אחסון, רישיונות, לוג.
- כרטיס פרטיות: משפט אחד – "היומן שמור ומוצפן בטלפון הזה בלבד. האפליקציה מתחברת לרשת רק לשרת
  הדואר שהבעלים הגדיר."

## 5. חבילות עבודה (מקסימום 2–3 סוכנים במקביל)

| # | חבילה | תלוי ב | צריך כלי Android | קבלה |
|---|---|---|---|---|
| WP-1 | Scaffold: `mobile/`, capacitor.config.ts, vite.config.mobile.ts, סקריפטים mobile:* ו-android:* | – | לא | mobile:build עובד עם worker-stub; dist של המחשב ללא Capacitor; כל הבדיקות ירוקות |
| WP-2 | ריפקטורים בשרת ששומרים על המחשב: mail/errors.ts, mail transport מוזרק, fonts.ts (Android), guard לסכימה חדשה, נתיב אורח מאחורי דגל | – | לא | בדיקות שרת ירוקות + חדשות; server.cjs עובר smoke |
| WP-3 | Shims + חבילת תאימות בייט-לבייט (וקטורי RFC 7914, 60 סיסמאות כולל NFKC/עברית/ערבית/CJK, .mpd מהמחשב נפתח ב-shim ולהפך) | WP-1 | לא | 0 יבואי node: לא פתורים; כל הווקטורים עוברים |
| WP-4 | VFS + גשר אחסון (אטומי, Node-style errors, drain barrier, מצב זיכרון-בלבד לאורח) | WP-1 | לא | הזרקת קריסה תמיד משאירה יומן שנפתח מ-.mpd/.tmp/.prev |
| WP-5 | ליבה: express-shim, app.ts, boot.ts, worker.ts, core-client; ערוץ בקרה (flushAll/lockAll/biometric/mail) | WP-2,3,4 | לא | חבילת חוזה: אותם סטטוסים וגופי JSON כמו במחשב ל-25 תרחישים |
| WP-6 | נקודת תעבורה ב-client.ts + אתחול מובייל ב-main.tsx + platform.ts | WP-1 | לא | dist מחשב זהה (למעט hash); mobile:dev בדפדפן: הרשמה → בית עם הליבה האמיתית |
| WP-7 | קבצים: SAF/Share/Open .mpd (פלאגין diary-files) | WP-6 | כן | גיבוי + 4 ייצואים נשמרים דרך דיאלוג המערכת; .mpd נפתח לשחזור עם עותק בטיחות |
| WP-8 | תזכורות כהתראות מערכת | WP-6 | כן | תזכורת ל-+2 דק' יורה כשהאפליקציה סגורה ואחרי אתחול; ביטול בעת רישום ההרגל |
| WP-9 | נעילה, מחזור חיים, ביומטריה, FLAG_SECURE | WP-6 | כן | pause עושה flush; "נעל כשאני יוצא" → 423; טביעת אצבע פותחת; Back מדורג |
| WP-10 | מעטפת Android + mobile.css | WP-1 | לא | 360×800 ו-412×915 ב-en/he/ar: ניווט, FAB, גיליון, ללא גלילה אופקית; snapshots מחשב ללא שינוי |
| WP-11 | מסך בחירת שפה ראשונה + כפתור דילוג/מצב אורח + הגדרות/אימות לטלפון (About, פרטיות) | WP-5,6,10 | לא | סעיפים 3.2–3.3 מתקיימים; כרטיסי מחשב-בלבד לא מוצגים; אורח לא כותב לדיסק |
| WP-12 | דואר בטלפון: פלאגין diary-mail (Java SMTP) + חיבור ל-mail/service + deep link לאיפוס | WP-5,9 | כן | מייל בדיקה ואיפוס מלא מול mock SMTP מקומי; check-no-network מאשר רק את הפלאגין |
| WP-13 | תרגום כל אזורי mobile* + טקסטי החנות ל-18 השפות (3 סוכנים × 6 שפות) | WP-7..12 | לא | parity ירוק; 30/80/4000 תווים; המותג באנגלית |
| WP-14 | פרויקט Android: `cap add android`, applicationId, min 24/target 36, allowBackup=false, supportsRtl, locales_config (20), אייקונים, R8, חתימה, סקריפטי build/install | WP-1,5 | כן | APK debug נבנה ומותקן דרך Wireless debugging; AAB חתום עובר bundletool; אין .so משלנו |
| WP-15 | ביקורת רשת/אריזה למובייל (check-no-network ל-mobile/** + Java; check-apk) | WP-14 | כן | הוספת fetch חיצוני או הרשאה זרה מפילה את הבדיקה |
| WP-16 | QA: סבב תאימות מחשב↔טלפון, ביצועים בטלפון, 20 שפות, TalkBack, מצב אורח | WP-7..15 | כן | גיבוי מהמחשב משוחזר בטלפון עם אותם מספרים ולהפך; התחברות ≤ 2 s; PDF 90 יום ≤ 10 s |
| WP-17 | ערכת Google Play: מדיניות פרטיות (en/he), דף מחיקת נתונים, Data safety, דירוג תוכן, גרפיקה, מדריך לבעלים בעברית | WP-13,14,16 | כן | הבעלים יכול לעבור את התהליך בלי קוד |
| WP-L1 | אופציונלי: device.key עטוף ב-Android Keystore | WP-14 | כן | העתקת קובצי האפליקציה למכשיר אחר לא פותחת sessions |

סדר מומלץ: WP-1+WP-2 → WP-3+WP-4+WP-6 → WP-5+WP-10 → WP-11+WP-14 → WP-7+WP-8+WP-9 → WP-12 →
WP-13+WP-15 → WP-16 → WP-17. הערכה: 18–24 ימי-סוכן; בקצב של 2–3 במקביל, כ-2–3 שבועות קלנדריים.

### מצב ביצוע

- **WP-1 – בוצע (2026-10-01).** `mobile/`, `capacitor.config.ts`, הסקריפטים `mobile:*` ו-`android:sync` (נכשל עד WP-14), Capacitor 8.5.2 בגרסאות נעולות; `mobile:build` מפיק `mobile-dist/` עם worker-stub, ו-`mobile:test` מוודא ש-dist של המחשב ללא Capacitor וש-`check-no-network` סורק את `mobile/**`.
- **WP-3 – בוצע (2026-10-02).** Shims ל-Node תחת `mobile/core/shims/**` (crypto על ‎@noble, ‏Buffer, ‏path, ‏sql.js בגרסת הדפדפן, ‏pdfkit standalone, ומודולי רשת שנטענים אך זורקים בקריאה) ותוסף ההפניה `mobile/core/alias-plugin.ts`, שפועל רק על קוד `server/src` ו-`shared/` ומפיל את הבנייה על built-in בלי shim או על מודול שרת שדורש Node (`server.ts`, `index.ts`, `remote/**`, `mail/node-transport.ts`, `middleware/host-check.ts`). חבילת התאימות `mobile/test/compat/**` רצה מול fixtures שנוצרו בקוד המחשב (`scripts/mobile/make-fixtures.mjs`): וקטורי scrypt ל-62 סיסמאות, AES-256-GCM, ו-`.mpd`/גיבויים מהמחשב שנפתחים דרך ה-shims ולהפך.
- **WP-4 – בוצע (2026-10-03).** VFS תואם `node:fs` (`mobile/core/vfs/**`, מאחורי `mobile/core/shims/fs.ts`): מראה בזיכרון של `/data`, כתיבות עמידות בתור לפי סדר, שגיאות בסגנון Node, מחסום `drain()`, נכסים לקריאה בלבד ב-`/assets`. גשר האחסון: `mobile/shared/storage-protocol.ts`, ‏`mobile/host/storage-rpc.ts`, ‏`MemoryStorage` ו-`createCapacitorFilesystemStorage()`. בדיקות `mobile/test/vfs/**` כולל הזרקת קריסות (crash-safety, chaos).
- **WP-5 – בוצע (2026-10-04).** הליבה האמיתית רצה ב-Worker במקום `worker-stub`, עם תפר אופציונלי יחיד ב-`server/src` (`ForgotInput.resetLink` ב-`security/password-reset.ts` – קישור האיפוס של הטלפון; במחשב לא בשימוש, ההתנהגות שם זהה):
  - `mobile/core/express-shim/**` – תת-הקבוצה של Express 5 שהשרת משתמש בה; `mobile/core/app.ts` – אותם middleware ונתבים של `server/src/app.ts`, בלי גישה מרחוק ו-LAN, עם `guestAllowed`, כל בקשה מקומית, ו-400 ל-`destPath`/`srcPath` (קבצים יוצאים דרך המארח – WP-7).
  - `mobile/core/boot.ts` + `worker.ts` – VFS → נכסים (wasm של SQLite ו-8 גופנים) → `vfs.boot()` → השירותים כמו ב-`server.ts`; לפני כל תשובה לבקשה ששינתה משהו: שמירת קובץ היומן עצמו (`persistIfDirty`, לא 250ms אחרי התשובה) ו-`drain()` – כל שלב עם ניסיון חוזר אחד, ואחריו 500 `IO` בשפת הבקשה, אבל רק לבקשה שהשינוי **שלה** לא נשמר; בקרה `flushAll`/`lockAll`/`shutdown`; אירועים `ready`/`fatal`/`log`/`habits-changed` (נשלח אחרי התשובה)/`storage-failed`/`storage-recovered`. דואר: transport זמני שנכשל ב-`server.mail.error.connect` עד WP-12; קישור האיפוס במייל שנשלח מהטלפון הוא `yourpersonaldiary://reset?token=…` (ה-deep link של סעיף 3.1 בדיוק; `mobileResetLink` ב-`mobile/core/app.ts`, מוזרק לשירות דרך `ForgotInput.resetLink`; את הסכמה רושמת החבילה הנייטיבית – WP-12), לא `http://127.0.0.1:0`.
  - אחסון שמסרב לכתיבות (טלפון מלא) לא משבית את היומן: הליבה עולה, וקריאה, חיפוש, ייצוא, הורדת גיבוי, כניסה, נעילה ופתיחה ממשיכים לעבוד; רק שמירה שלא הגיעה לאחסון נענית ב-500 `IO`. המארח מקבל `storage-failed` פעם אחת (לבאנר), הליבה מנסה שוב לבד (5 שניות, מוכפל עד דקה) ושולחת `storage-recovered` כשהכול נשמר. אחרי `shutdown` ה-Worker סגור: `core-client` מכשיל מיד כל בקשה (status 0) – צריך לטעון מחדש את הדף.
  - מארח: `mobile/host/assets.ts` מביא את הנכסים מ-`core-assets/`, ו-`boot.ts` מגיש את האחסון לפני `ready` (Capacitor Filesystem באפליקציה; `MemoryStorage` בדפדפן – **רענון מוחק את היומן**, וההודעה על כך במסוף).
  - חבילת החוזה `mobile/test/core/**` מריצה אותו תרחיש מול הליבה ומול שרת המחשב ומשווה סטטוסים וגופי JSON: הרשמה (מסך בעברית → שפת חשבון he), התחברות, "זכור אותי" אחרי הפעלה מחדש, סיסמה שגויה, כפילויות, נעילה → 423 → אימות, רשומות, הרגלים, לוח שנה בשלוש השיטות, תובנות וסטטיסטיקה, חיפוש en/he/ar, הגדרות, גיבוי ושחזור לשני הכיוונים (כולל fixture שנוצר במחשב), ייצוא TXT/CSV/JSON/PDF, שינוי סיסמה, מחיקת חשבון ומצב אורח (כלום לא נכתב לאחסון, גם אחרי `flushAll`).
  - נבדק בדפדפן מול `mobile-dist` (CSP מחמיר): בחירת שפה → דילוג (אורח) → הרשמה → בית → רשומה חדשה → יומן → לוח שנה → ייצוא PDF → יציאה והתחברות → רענון, בלי שגיאות במסוף; וגם מול `mobile:dev` (שם נדרשו עטיפת ESM לשני קובצי ה-vendor ו-`optimizeDeps` ב-`vite.config.mobile.ts`).
  - מדידות בדפדפן שולחני (לא בטלפון): Worker ‏5.35MB (‏1.38MB ב-gzip), האפליקציה על המסך 1.0–1.4 שניות מתחילת הטעינה, התחברות/הרשמה (scrypt) כ-0.6 שניות, PDF של רשומה אחת 0.46 שניות.
- **WP-14 – בוצע (2026-10-16), ממתין לבדיקה בטלפון.** פרויקט ה-Android ב-`android/` (`npx cap add android` עם Capacitor 8.5.2 + ההתאמות: minSdk 24, compileSdk/targetSdk 36, Gradle 8.14.3, AGP 8.13.0, Kotlin 2.2.20, JDK 21). זהות במקום אחד (`android/app/build.gradle`: applicationId `app.yourpersonaldiary` מ-2026-10-25 (לפני כן `com.mydiary.app`; ה-namespace של ה-Java נשאר `com.mydiary.app`, ראו סעיף 7.3) – קבוע רק מההעלאה הראשונה ל-Play; `versionName` מ-`package.json`, `versionCode` מ-`android/app/version.properties` + `scripts/android/bump-version.mjs`). מניפסט: `allowBackup=false` + `dataExtractionRules`/`fullBackupContent` שמחריגים הכול, `supportsRtl`, בלי cleartext (+ network security config), `localeConfig` עם 20 השפות, `singleTask`, `adjustResize`, `configChanges` לסיבוב/מקלדת/שפה/צפיפות/מצב כהה/גודל גופן של המערכת (fontScale, fontWeightAdjustment, colorMode, grammaticalGender – `verify-apk.ps1` בודק את המסכה הממוזגת), `INTERNET` בלבד, פעילות אחת מיוצאת (ה-receiver של profileinstaller הוסר). מראה: אייקון אדפטיבי וקטורי מ-`design/app-icon.svg` (+ monochrome, + PNG ישנים ל-Android 7), splash של Android 12 בצבעי הדף, ערכת DayNight שבה הרקע ופסי המערכת עוקבים אחרי בהיר/כהה (SystemBars של Capacitor 8 מטפל ב-insets; ה-CSS של `env(safe-area-inset-*)` נשאר). Release: R8 + shrinkResources עם כללי keep ל-Capacitor ולתוספים, חתימה מקובץ חיצוני `C:\Users\AVI\Projects\android-signing\keystore.properties` (ללא הקובץ – לא חתום; שום keystore לא נוצר). סקריפטים ב-`scripts/android/`: `env.ps1`/`env.sh`, `doctor.ps1`, `build-apk.ps1`, `build-aab.ps1`, `verify-apk.ps1` (אימות סטטי: aapt2/zipalign/apkanalyzer), `install-phone.ps1` (Wireless debugging + logcat), ו-`npm run android:*`. `check-no-network` סורק גם את ה-Java/Kotlin של האפליקציה ואת הרשאות המניפסט. APK debug: 9.7 MB בקובץ (כ-8.1 MB להורדה לפי apkanalyzer), ללא `.so` (אין מה ליישר ל-16 KB). ארבעת ממצאי המאמת (install-phone.ps1 מול stderr של adb, המדריך מול טקסטי ה-UI האמיתיים, ייבוא-כוכבית של java.net ב-check-no-network, fontScale ב-configChanges) תוקנו ואומתו 2026-10-17. מדריך לבעלים: `docs/ANDROID-PHONE-TEST.he.md`. נותר לבדוק רק בטלפון אמיתי (אין אמולטור במחשב הזה): הזרקת ה-bridge של Capacitor מול ה-CSP, שמירה לדיסק, מקלדת/סיבוב, מצב כהה, גרסת WebView ≥ 140 ל-safe-area.
- **WP-6 – בוצע (2026-10-01; הקבלה מול הליבה האמיתית הושלמה 2026-10-04).** `setApiTransport()` ב-`client.ts`, `platform.ts`, ואתחול המובייל ב-`main.tsx` → `mobile/host/boot.ts` (Worker inline, `core-client`, מסך פתיחה). נבדק בדפדפן מול `mobile-dist` עם ה-CSP המחמיר: ה-Worker עולה מ-blob ומסך הפתיחה יורד, בלי שום בקשת HTTP ל-API. חלק הקבלה "`mobile:dev` בדפדפן: הרשמה → בית עם הליבה האמיתית" נבדק ועבר עם WP-5, גם ב-`mobile:dev` וגם מול `mobile-dist`.
- **WP-7 + WP-8 + WP-9 – בוצע (2026-10-22), ממתין לבדיקה בטלפון (`docs/ANDROID-PHONE-TEST.he.md` חלק שני).** הכול תחת `mobile/platform/**` ומותקן לפני הרינדור רק בתוך האפליקציה המותקנת (`installPhonePlatform`), דרך תפרים שהמחשב לא ממלא (`setPhoneFiles`, `setPhoneReminders`, `setPhoneSecurity`). קבצים: פלאגין מקומי `diary-files` (Java, ‏SAF ‏`ACTION_CREATE_DOCUMENT` – "שמירה במכשיר" בלי הרשאת אחסון; פתיחת `.mpd` מאפליקציה אחרת) ו-`@capacitor/share` (עותק במטמון שנמחק בהפעלה הבאה). תזכורות: `@capacitor/local-notifications` 8.3.1 – התראות לא-מדויקות בלבד (`SCHEDULE_EXACT_ALARM` ו-`WAKE_LOCK` הוסרו מהמניפסט), `POST_NOTIFICATIONS` נשאלת רק מכרטיס התזכורות, חימוש מחדש אחרי אתחול (`RECEIVE_BOOT_COMPLETED`), תכנון מחדש אחרי כל שינוי בהרגלים ובחזרה לאפליקציה. נעילה ומחזור חיים: "נעל כשאני יוצא" → `lockAll` (+`flushAll`), חלונות שהאפליקציה פותחת בעצמה (שמירה, בחירת קובץ, שיתוף) מחזיקים `suspendLock()` ולא נועלים; `FLAG_SECURE` (פלאגין `diary-privacy-screen`), Back מדורג, פסי מערכת לפי ערכת הנושא. ביומטריה: פלאגין `diary-biometric` (BiometricPrompt + מפתח Keystore) מוכן, מוסתר מאחורי `BIOMETRIC_UNLOCK_ENABLED = false` עד שיהיה חוזה "אסימון פתיחה" בצד היומן. שני הממצאים החמורים של המאמת (2026-10-18: נעילה בחלונות המערכת ששברה שמירה/שחזור; 423 שביטל את כל התזכורות) תוקנו. הרשאות APK: ‏INTERNET, ‏POST_NOTIFICATIONS, ‏RECEIVE_BOOT_COMPLETED, ‏USE_BIOMETRIC.
- **WP-H6 – בוצע (2026-10-23): אפליקציית Android בגרסת "שרת בלבד"** (`docs/HOSTED-PLAN.md` 4c + `docs/android-tasks/HOSTED-IMPL.md` סעיפים 8–12, שגוברים על התוכנית): האפליקציה שמתפרסמת מחוברת קבוע ל-`https://yourpersonaldiary.fly.dev` (הכתובת במקום אחד – `src/config/server-default.json`), בלי מסך בחירה ובלי הגדרה לשנות שרת. `npm run mobile:build` בונה כברירת מחדל את גרסת השרת: `__MOBILE_LOCAL_CORE__ = false`, כך שענף הליבה המקומית ב-`src/main.tsx` – `mobile/host/boot.ts`, ה-Worker ו-`mobile/core` – נמחק כקוד מת; `core-assets/` (wasm של SQLite ו-8 הגופנים) לא נפלטים; ההפעלה עוברת דרך `mobile/host/server-mode.ts` (תכונות הטלפון על מארח בלי ליבה: התעבורה `fetch`, "נעל כשאני יוצא" = `POST /api/auth/lock` בשרת, `flushAll` ריק, תזכורות מתוכננות מחדש לפי בקשות שמשנות הרגלים). ה-CSP של הדף הבנוי: `connect-src 'self' https://yourpersonaldiary.fly.dev`, בלי `wasm-unsafe-eval` ובלי worker מ-`blob:` (`mobile/dev-server-csp.ts` `serverBuildCsp`); `network_security_config.xml` מתיר רק את המארח הזה, TLS בלבד, אמון במאגר המערכת בלבד, בלי pinning (התעודות מתחדשות אצל הספק). הליבה המקומית נשארת בקוד כתצורת מפתחים/בדיקות: `MOBILE_LOCAL_CORE=1 npm run mobile:build` (עם `core-assets` ו-`connect-src 'self'`), וכל בדיקות הליבה רצות כמקודם – בסיס למצב לא-מקוון עתידי (WP-H10). מדידה: גרסת השרת 4.05MB ב-17 קבצים מול 12.31MB ב-32 קבצים לליבה המקומית; APK debug ‏8.1MB (כ-5.1MB להורדה) במקום 10.9MB. בדיקות: `mobile/test/desktop-dist-clean.test.ts` (בונה את שלוש הגרסאות ומוכיח מה כל אחת מכילה), `server-mode.test.ts`, `android-config.test.ts`, `dev-server-csp.test.ts`, ו-`hosted-server.test.ts` – קוד הלקוח של האפליקציה מול השרת המארח (`startHosted` על תיקייה זמנית): CORS ל-`https://localhost`, סיור אורח, הרשמה וכניסה, רשומה, הרגלים לתזכורות, נעילה → 423 → סיסמה, גיבוי שיורד, נבדק ומשוחזר, ושגיאת חיבור כשהשרת נופל. נותר לבדוק בטלפון (מדריך לבעלים, חלק שלישי): כניסה עם החשבון שהועבר על חבילת גלישה, רשומה שמופיעה במחשב, תזכורת, שמירת גיבוי, "אין חיבור" במצב טיסה.
- **שפת המערכת ב-Android – בוצע (2026-10-23; `docs/android-tasks/ANDROID-SYSTEM-LANGUAGE.md`, HOSTED-IMPL סעיף 13).** מסך בחירת השפה הוסר מכל הפלטפורמות (`FirstRunLanguagePage`, `first-run.ts`, `first-run.css`, הבדיקות שלהם, החיווט בנתב ובמעטפת הטלפון, ו-3 מפתחות `mobile.firstRun.*` ב-20 השפות; גיבוי ב-`C:\Users\AVI\Projects\mpd-probe\removed-2026-10-23-first-run\`). אפליקציית Android נפתחת בשפת הטלפון (`navigator.languages` של ה-WebView = `LocaleList.getDefault()`, בלי קוד נייטיבי), אחרת אנגלית; `negotiateLocale` קורא תגים אמיתיים של Android (אזור, `_`, `iw`/`in`, script, `zh-TW` → `zh`). Windows ללא שינוי (מתקין, אחרת אנגלית), ווב ללא שינוי (שפות הדפדפן). בדיקות: `src/i18n/startup-language.test.tsx`, `shared/i18n/i18n.test.ts`. נותר לבדוק בטלפון: מדריך לבעלים, חלק שלישי, סעיף 9.

## 6. כלים (מותקנים 2026-09-30 באישור הבעלים)

- Temurin JDK 21.0.12.1 – `C:\Users\AVI\Tools\jdk-21`
- Android SDK – `C:\Users\AVI\Tools\android-sdk`: cmdline-tools 16111833, platform-tools r37.0.1,
  platforms;android-36, build-tools;36.1.0, רישיון מאושר.
- אין NDK (לא נדרש ב-A). אין אמולטור (דורש Hypervisor עם הרשאות מנהל) – בדיקות על הטלפון של הבעלים
  דרך Wireless debugging (Android 11+, `adb pair`).
- כל סקריפט מגדיר JAVA_HOME/ANDROID_HOME בעצמו (`scripts/android/env.ps1`); אין setx (וירטואלי
  בתוך ה-MSIX של Claude). Gradle home: `C:\Users\AVI\Tools\gradle-home` (קצר, בגלל MAX_PATH).

## 7. Google Play – מה שהבעלים עושה בעצמו

1. חשבון מפתח אישי (25$ חד-פעמי), אימות זהות + אימות מכשיר Android דרך אפליקציית Play Console.
2. **בדיקה סגורה חובה**: 12+ בודקים מחוברים ברציפות 14 יום, ואז "Apply for production" (סקירה ~7 ימים).
3. החלטות קבועות: `applicationId` – **הוחלט (2026-10-25): `app.yourpersonaldiary`**. `com.mydiary.app` כבר תפוס
   ב-Google Play על ידי אפליקציה של מפתח אחר, ושם חבילה צריך לפחות שני חלקים – לכן "yourpersonaldiary" נכתב
   כ-`app.yourpersonaldiary`, בהתאם לדומיין המתוכנן yourpersonaldiary.app (פנוי ב-Play, נבדק 2026-10-25). לא ניתן
   לשינוי אחרי ההעלאה הראשונה. ה-namespace של הקוד (חבילת ה-Java) נשאר `com.mydiary.app` – Android מתיר
   namespace שונה מ-applicationId, והמשתמש ו-Play לא רואים אותו; גם המזהה של אפליקציית Windows נשאר `com.mydiary.app`.
   פירוט: `docs/android-tasks/ANDROID-APP-ID.md`.
4. מפתח העלאה (upload key) – נוצר ב-`scripts/android/create-upload-key.ps1` ומגובה על ידי הבעלים.
5. אירוח מדיניות הפרטיות (GitHub Pages/Google Sites – לא בדומיין הביתי החסום).
6. Data safety: נאסף – כתובת מייל (אופציונלי, לאיפוס), מוצפן, לא משותף; אין ניתוח/פרסום.
7. targetSdk מתעדכן כל אוגוסט – לתכנן סשן סוכן שנתי.

## 8. סיכונים והחלטות פתוחות

- **ביצועים:** scrypt ב-JS ~0.5–2 s להתחברות; אם איטי בטלפון של הבעלים → hash-wasm (אותו פלט).
- **שני יומנים נפרדים:** שחזור מחליף ולא ממזג. אזהרה עם מספרים + עותק בטיחות אוטומטי. סנכרון ב-Wi-Fi
  ביתי (מיזוג לפי id) – שלב המשך.
- **שכחת סיסמה בלי מייל מוגדר:** היומן בטלפון אבוד ללא גיבוי. הסבר במסך ההרשמה.
- **WebView ישן** (Android 8/9): ICU לוחות שנה, `<dialog>`; מסך "עדכן את Android System WebView" אם חסר.
- **מקלדת:** WebView לא יכול לכבות למידה אישית של Gboard; Autofill עלול להציע לשמור את סיסמת היומן.
- **החלטת בעלים:** האם להוסיף "איפוס עם נעילת המסך של הטלפון" (WP-L3) כגיבוי כשאין מייל.
