# Your Personal Diary

יומן אישי חכם ומוצפן, שמזהה דפוסים בנתונים שלך לאורך שבועות, חודשים ושנים.
שם המוצר, **Your Personal Diary**, נכתב תמיד באנגלית, בכל שפת ממשק.

**חשבון אחד, שלוש דרכים להיכנס**: אפליקציית Windows, אפליקציית Android והאתר. שלושתם פונים לשרת אחד בלבד - `https://yourpersonaldiary.fly.dev` (Fly.io, מרכז הנתונים בפרנקפורט) - ולכן בכל מכשיר רואים את אותו יומן. היומן נשמר בשרת, מוצפן לכל חשבון בנפרד במפתח שנגזר מהסיסמה, ואין Telemetry, Analytics או פרסומות. כשאין חיבור, האפליקציות ממשיכות לעבוד ומעלות את השינויים כשהחיבור חוזר (סעיף 1.4).

* רשומות יומן עם מצב רוח, רגשות, אנרגיה, לחץ, שינה, פעילות גופנית, אירועים, אנשים, מקום, הערות ותגיות
* מעקב הרגלים (יומיים ושבועיים) עם תזכורות
* מנוע ניתוח מבוסס כללים שמוצא קשרים אפשריים ("נראה שבנתונים שלך...") ומסביר בדיוק על אילו מספרים הוא מסתמך
* ציר זמן, לוח שנה (לועזי, עברי והג׳רי, עם חגים), סטטיסטיקות וגרפים נגישים, וחיפוש חכם בשאלות בשפה חופשית
* נעילה אוטומטית, גיבוי ושחזור מוצפנים, ייצוא ל-TXT/CSV/JSON/PDF
* "שכחת סיסמה?" - איפוס במייל בלי לאבד את מה שכתוב ביומן
* 20 שפות ממשק, ונגישות מלאה לקוראי מסך (JAWS) ולניווט במקלדת

**בקובץ הזה**: [1. המוצר היום](#1-המוצר-היום) · [2. פרטיות ואבטחה](#2-פרטיות-ואבטחה) · [3. שימוש יומיומי](#3-שימוש-יומיומי) · [4. לבעלים](#4-לבעלים) · [5. למפתחים](#5-למפתחים) · [6. מצב החנויות](#6-מצב-החנויות) · [רישיונות](#רישיונות-של-רכיבים-מצורפים)

תיעוד נוסף: [ARCHITECTURE.md](ARCHITECTURE.md) (תכנון המערכת), [docs/API.md](docs/API.md) (חוזה ה-API; השרת הציבורי - בפרק "מצב מארח"), [docs/HOSTED-RUNBOOK.he.md](docs/HOSTED-RUNBOOK.he.md) (תפעול השרת), [docs/android-tasks/HOSTED-IMPL.md](docs/android-tasks/HOSTED-IMPL.md) (החלטות הבעלים על המעבר לשרת).

---

## 1. המוצר היום

### 1.1 שרת אחד, שלושה לקוחות

| | מה זה | הקוד |
|---|---|---|
| **אפליקציית Windows** | קליפת Tauri 2 (Rust + WebView2) עם הממשק המוטמע - לקוח רזה, בלי שרת מקומי ובלי Node.js. מתקין NSIS (או MSI), וחבילת MSIX ל-Microsoft Store | `src-tauri/`, `src/` |
| **אפליקציית Android** | אותו ממשק React בתוך Capacitor 8; המזהה `app.yourpersonaldiary`; Android 7.0 ומעלה | `android/`, `mobile/`, `src/` |
| **האתר** | אותו ממשק, שהשרת מגיש בכתובת שלו | `src/` |
| **השרת** | הקוד של `server/` (Node.js 24, Express 5, SQLite דרך sql.js) עם `DIARY_MODE=hosted`; מכונה אחת של 512 MB ודיסק שהתחיל ב-3 GB, ב-Fly.io באזור `fra` | `server/`, `deploy/hosted/` |

* כתובת השרת נקבעת בזמן הבנייה במקום אחד - `src/config/server-default.json` - ואין בממשק שום דרך לשנות אותה (לא בהגדרות ולא במסך פתיחה). האתר פונה למקור שממנו נטען.
* **ההרשמה פתוחה לכולם** (`DIARY_REGISTRATION = "open"` ב-[`deploy/hosted/fly.toml`](deploy/hosted/fly.toml)), עם תקרה של **5000 חשבונות** (`DIARY_MAX_ACCOUNTS`; ברירת המחדל בקוד היא 300). מאותה רשת אפשר לנסות להירשם עד 5 פעמים בשעה ו-20 ביממה, ואין מייל אימות. כל כתובת מייל וכל שם משתמש שייכים לחשבון אחד בלבד.
* **הבעלים** הוא החשבון שהמזהה שלו מוגדר בשרת במשתנה `DIARY_OWNER_ID` - הוא ורק הוא: אין "החשבון הראשון" ואין ירושה לחשבון אחר (ההגדרה: [`docs/HOSTED-DEPLOY.he.md`](docs/HOSTED-DEPLOY.he.md), שלב ו). רק הבעלים רואה בהגדרות את שני כרטיסי הבעלים:
  * **"דואר אלקטרוני לאיפוס סיסמה"** - חשבון ה-Gmail שממנו השרת שולח את מיילי "שכחת סיסמה?" והודעות האבטחה (עם סיסמת אפליקציה של Google, שנשמרת מוצפנת בשרת);
  * **"שרת"** - מצב השרת (גרסה, חשבונות מול התקרה, הרשמות ב-24 השעות האחרונות, דיסק, זיכרון, השמירה האחרונה) ו**ארכיון שרת** מוצפן (סעיף 4.2).

  כל עוד המשתנה לא מוגדר, אף אחד לא רואה את הכרטיסים האלה. מזהה החשבון מופיע ב**הגדרות ← חשבון** ("מזהה חשבון") - לכל משתמש רק עד שהבעלים מוגדר, ואחר כך רק לבעלים.

### 1.2 שפות

* 20 שפות ממשק: English, עברית, العربية, 中文 (סינית מפושטת), 日本語, हिन्दी, ไทย, Español, Português, Français, Italiano, Deutsch, Română, Ελληνικά, Polski, Čeština, Magyar, Русский, Български, Türkçe. מחליפים בכל עת ב**הגדרות ← שפה**, ושפת החשבון המחובר קודמת לכל השאר.
* **שפת הפתיחה** (`detectLocale` / `resolveStartupLocale` ב-`src/i18n/runtime.ts`), לפי פלטפורמה:
  * **Windows**: שפה שנבחרה בהגדרות במכשיר ← השפה שנבחרה במתקין ה-NSIS (סעיף 5.5) ← אנגלית. לגרסת ה-MSIX / Microsoft Store (וגם ל-MSI) אין שפת מתקין, ולכן היא נפתחת באנגלית. שפת Windows לא נלקחת בחשבון.
  * **Android**: שפת החשבון של הסשן השמור במכשיר ← שפה שנבחרה בהגדרות ← שפת הטלפון, כשהיא אחת מ-20 השפות ← אנגלית.
  * **אתר**: שפה שנבחרה בהגדרות ← שפות הדפדפן ← אנגלית.
* **אין מסך בחירת שפה בהפעלה הראשונה**, באף פלטפורמה.
* הכפתור **"דילוג - רק להסתכל"** (סיור עם נתוני דוגמה) קיים **רק באפליקציית Android**. הסיור הוא יומן אורח בזיכרון השרת בלבד, שנמחק אחרי 30 דקות; עד 3 סיורים בשעה מאותה רשת ועד 20 בו-זמנית. באפליקציית Windows ובאתר אין את הכפתור.

### 1.3 לוח שנה

* בדף **לוח שנה** בוחרים לוח - לועזי, עברי או הג׳רי-מוסלמי (הבחירה נזכרת במכשיר). הלוח שנבחר קובע את מספרי הימים בלוח, בדף היום ובדף הרשומה, ואת החגים שמוצגים: בלועזי - נוצריים (מערביים ואורתודוקסיים); בעברי - יהודיים, כולל צומות, ימי זיכרון וימים לאומיים לפי כללי הדחייה בישראל; בהג׳רי - מוסלמיים ודרוזיים. טווח החודש בשני הלוחות האחרים מופיע מעל הטבלה.
* **השנים בבחירת השנה** (`src/utils/calendar-years.ts`): לועזי מ-1980 עד השנה הנוכחית + 10; עברי מ-5731 (תשל״א) עד 5810; הג׳רי מהשנה ההג׳רית הנוכחית פחות 40 (מחושב, לא שנה קבועה) עד 1470.
* הכול מחושב בקוד (`shared/calendars/`: לוחות השנה של ICU דרך `Intl.DateTimeFormat`, וחישובים כמו נוסחת הפסחא) - בלי קובצי נתונים ובלי שירות חיצוני. התאריכים המוסלמיים הם לפי לוח אום אל-קורא; המועד בפועל נקבע לפי ראיית הירח ועשוי לזוז ביום.

### 1.4 עבודה בלי חיבור (אוטומטית)

* כשאין חיבור לשרת, האפליקציה מזהה זאת בעצמה ו**ממשיכה לעבוד**. בראש המסך מופיע "אין חיבור – מה שתכתוב יישמר בשרת כשהחיבור יחזור" ומספר השינויים שממתינים. כשהחיבור חוזר, השינויים עולים לפי הסדר, כל שינוי **פעם אחת בלבד**, גם אם האפליקציה נסגרה בינתיים. אותו מימוש (`src/offline/`) בשלוש הפלטפורמות.
* **עובד בלי חיבור**: כתיבה, עריכה ומחיקה של רשומות; סימון הרגלים ועריכת סימונים; יצירה, עריכה וארכוב של הרגלים; הגדרות. **דורש חיבור** (עם הודעה ברורה): תובנות, חיפוש וסטטיסטיקה; גיבוי, שחזור וייצוא; ניהול החשבון; מחיקה וסידור מחדש של הרגלים; נתוני דוגמה; כניסה והרשמה.
* **פתיחה בלי חיבור**: באפליקציות Windows, Mac ו-Android עם "זכור אותי" - מהעותק המוצפן שבמכשיר; אחרת, ובאתר, מופיע "אין חיבור לשרת היומן". מסך נעילה בלי חיבור נפתח **בסיסמת היומן** (היא נבדקת במכשיר מול עותק מוצפן של מפתח העותקים - הסיסמה עצמה לא נשמרת; אחרי 3 ניסיונות שגויים יש המתנה שגדלה עד דקה), או ב-Windows Hello, ב-Touch ID / סיסמת המק או בנעילת המסך של הטלפון.
* **אותה רשומה בשני מכשירים**: הגרסה החדשה יותר נשארת, ורשומה שנמחקה בשרת לא חוזרת לחיים. הגרסה שהפסידה לא נעלמת: היא נשמרת במכשיר כהערה עד "אישור", ואפשר לשמור אותה כרשומה חדשה או להעתיק את הטקסט.
* מה נשמר במכשיר - סעיף 2.2. התכנון המחייב: [`docs/android-tasks/OFFLINE-DESIGN.md`](docs/android-tasks/OFFLINE-DESIGN.md) (וגם ARCHITECTURE.md סעיף 11ג); הבדיקה הידנית: [`docs/OFFLINE-TEST.he.md`](docs/OFFLINE-TEST.he.md). מתג כיבוי בשרת: `DIARY_OFFLINE_SYNC=0` (אז הלקוחות מפסיקים ליצור עבודה לא מקוונת, ותורים קיימים עדיין מתרוקנים).

---

## 2. פרטיות ואבטחה

בקצרה ובכנות. הנוסח המחייב למשתמשים הוא מדיניות הפרטיות (סעיף 2.3).

### 2.1 בשרת

* **הצפנה לכל חשבון**: היומן של כל חשבון (תמונת SQLite) הוא קובץ אחד בשרת, מוצפן ב-**AES-256-GCM** במפתח שנגזר מהסיסמה ב-**scrypt** (`N=2^15, r=8, p=1`, salt אקראי של 16 בתים). מ-64 הבתים שנגזרים, 32 הראשונים הם מפתח היומן, ומ-32 האחרונים נשמר רק SHA-256 לאימות הסיסמה; הסיסמה עצמה לא נשמרת. nonce חדש בכל כתיבה, הכותרת מוגנת כ-AAD (כל שינוי בקובץ מזוהה), והכתיבה אטומית (הגרסה הקודמת נשמרת כ-`.prev`). הפורמט: [ARCHITECTURE.md, סעיף 6](ARCHITECTURE.md#6-פורמט-הקובץ-המוצפן-mpd).
* **בזמן שמחוברים, היומן פתוח בזיכרון השרת** - כדי שהשרת יוכל להציג, לחפש ולנתח אותו. זו **לא** הצפנה מקצה לקצה.
* **מפתח שחזור אצל המפעיל**: כדי ש"שכחת סיסמה?" יעבוד בלי לאבד את היומן, השרת שומר לכל חשבון עותק של מפתח היומן, עטוף במפתח השרת (`DIARY_DEVICE_KEY` - סוד של Fly: לא קובץ בדיסק של השרת, לא בפרויקט ולא בארכיונים; לבעלים יש עותק משלו, סעיף 4.1). לכן מי ששולט בשרת ובסודות שלו - המפעיל, ועקרונית גם ספק האירוח - יכול טכנית לאפס סיסמה של כל חשבון ולקרוא את היומן שלו. כך כתוב גם במדיניות הפרטיות. עותק של קובצי הדיסק לבדו לא פותח כלום. גם "זכור אותי" שומר בשרת את מפתח היומן עטוף במפתח הזה (סשן של 90 יום; בלי "זכור אותי" - 12 שעות, בזיכרון בלבד).
* **בקשת "שכחת סיסמה?" לא פותחת את היומן**: מייל האיפוס והודעות האבטחה נכתבים בשפה שנשמרת עם פרטי החשבון. רק השלמת האיפוס, עם הקישור או הקוד מהמייל, פותחת את היומן במפתח השחזור - כדי להצפין אותו מחדש תחת הסיסמה החדשה.
* **טקסט שנמחק נמחק באמת**: בשרת כל יומן רץ עם `PRAGMA secure_delete = ON`, כך שהטקסט של רשומה שנמחקה או נערכה נדרס כשהשינוי נשמר, והגרסה הקודמת של הקובץ (`.mpd.prev`) מתחלפת בשמירה הבאה; יומן מלפני ההגנה הזו נדחס פעם אחת (`VACUUM`) בפתיחה הראשונה שלו. מה שנשאר: צילומי הדיסק היומיים של Fly (עד 30 יום), ארכיוני השרת המוצפנים (סעיף 4.2), שאריות מוצפנות במקום הפנוי של הדיסק עד שהוא נכתב מחדש, וקובצי גיבוי שהמשתמש עצמו שמר.
* **פרטי החשבון** (שם, שם משתמש, מייל, שפה, מועדי יצירה וכניסה) אינם מוצפנים - השרת צריך אותם כדי להכניס את המשתמש ולכתוב לו. הלוג של השרת לא מכיל תוכן יומנים, כתובות מייל או כתובות IP.
* **הגנות**: HTTPS בלבד (עם HSTS); מגבלות קצב על כניסה, הרשמה, איפוס וגיבוי; 10 סיסמאות שגויות נועלות את הכניסה **מאותה רשת** ל-15 דקות, וניסיונות נוספים על החשבון מואטים - זר יכול להאט את בעל החשבון, לא לנעול אותו; הנעילה האוטומטית (ברירת מחדל: אחרי 10 דקות בלי פעילות) נועלת גם את הסשן בשרת; שינוי סיסמה, שינוי מייל ומחיקת חשבון דורשים את הסיסמה; מכסת יומן לחשבון (`DIARY_MAX_DIARY_BYTES`, ברירת מחדל 10 MB).

### 2.2 מה נשמר במכשיר

* בכל מכשיר: אסימון הכניסה, שם המשתמש האחרון, העדפות שפה ותצוגה, ושאלות החיפוש האחרונות (נמחקות ביציאה).
* **העותק לעבודה בלי חיבור** (סעיף 1.4), מוצפן ב-AES-GCM במפתח של החשבון: השינויים שעוד לא עלו לשרת, הערות על שינויים מתנגשים, ורישום של מה שהועלה ב-7 הימים האחרונים. באפליקציות Windows ו-Android **עם "זכור אותי"** - גם עותק של מה שהוצג לאחרונה (רשומות אחרונות, הרגלים, נתוני היום, החודש בלוח השנה וההגדרות); בלי "זכור אותי" העותק הזה נמצא בזיכרון בלבד, כל עוד האפליקציה פתוחה.
* **המפתח של העותק** נשמר בשרת, בתוך היומן המוצפן. עם "זכור אותי" הוא נשמר גם במכשיר, מוגן ב-DPAPI של Windows (רק למשתמש ה-Windows שלך) או ב-Keystore של Android. **לעולם לא נשמרים במכשיר**: הסיסמה ומפתח השחזור.
* **איפה**: ב-Windows - בפרופיל ה-WebView2 של התוכנה, ועותק גיבוי של התור ב-`%LOCALAPPDATA%\com.mydiary.app\offline\<userId>\` (בגרסת ה-MSIX - בתיקייה הפרטית של החבילה); ב-Android - באחסון הפרטי של האפליקציה, שמוחרג מגיבויים; באתר - רק התור, הרישום וההערות, והמפתח בזיכרון בלבד.
* **יציאה מהחשבון מוחקת את כל זה מהמכשיר** (אם יש שינויים שלא עלו - שואלים קודם). הסרת גרסת ה-NSIS בלי מחיקת נתוני האפליקציה משאירה את העותק המוצפן - כדאי להתנתק לפני הסרה.
* **סיכון שנשאר**: מי שמריץ תוכנות כמשתמש ה-Windows שלך, או ששולט בטלפון עם root, יכול לקרוא את העותק של "זכור אותי"; מכשיר שאבד ולא מתחבר שוב שומר עותק מוצפן של הרשומות האחרונות.

### 2.3 מדיניות הפרטיות ודף מחיקת החשבון

* **מדיניות פרטיות אחת** לאפליקציות Android,‏ Windows ו-Mac, לאפליקציית iPhone (כשתפורסם) ולאתר: `https://yourpersonaldiary.fly.dev/privacy/`, ו**דף מחיקת חשבון** (גם למי שלא יכול להיכנס): `https://yourpersonaldiary.fly.dev/delete-account/`. כל אחד מהם ב-20 השפות (`<locale>/`; אנגלית כברירת מחדל). הקישור למדיניות נמצא בכרטיס **פרטיות** בהגדרות.
* **תנאי השימוש**: `https://yourpersonaldiary.fly.dev/terms/` ו-`/terms/<locale>/` (20 השפות; המקור `legal/terms/`, תאריך התחולה `termsEffectiveDate` ב-`legal/settings.json`). בהרשמה תיבת סימון אחת מאשרת גם את מדיניות הפרטיות וגם את תנאי השימוש, והשרת שומר עם החשבון את מועד האישור ואת גרסאות שני המסמכים; בכרטיס **פרטיות** בהגדרות יש קישור גם לתנאי השימוש.
* **דף תמיכה** (ה-Support URL של App Store Connect, וגם לכל דפדפן): `https://yourpersonaldiary.fly.dev/support/` ו-`/support/<locale>/` - פרטי הקשר של המפעיל ותשובות לשאלות נפוצות, באותן 20 שפות; המקור `legal/support/`.
* **המקור** הוא קובצי Markdown ב-`legal/` (קובץ לכל שפה; [legal/README.md](legal/README.md)), והערכים של הבעלים (שם המפרסם, כתובת הפניות, תאריך התחולה, גיל מינימלי) נמצאים במקום אחד - `legal/settings.json`. `node scripts/legal/build-pages.mjs` בונה מהם את `public/privacy/`, את `public/delete-account/`, את `public/support/` ואת `public/terms/` (`--check` משווה, `--strict` גם מסרב לערך חסר); Vite מעתיק אותם לממשק שהשרת מגיש, כך שהם עולים לאוויר עם פריסת השרת הבאה.
* שינוי במה שהאפליקציות עושות עם מידע משנה יחד את המדיניות ב-20 השפות, את `play/policy/data-safety.md` ואת `store/policy/partner-center-privacy.md`.
* פניות בנושא פרטיות: `yourpersonaldiary29@gmail.com`.

### 2.4 רשת - מה יוצא מהמכשיר, ומה הביקורת מבטיחה

* **האפליקציות פונות לכתובת אחת בלבד** - שרת Your Personal Diary, ב-HTTPS. אין Telemetry, Analytics, דיווחי קריסות, פרסומות או עדכונים אוטומטיים. השרת עצמו פותח חיבור יוצא מסוג אחד בלבד: SMTP לשרת הדואר שהבעלים הגדיר בכרטיס הדואר (Gmail), כשנשלח מייל איפוס, הודעת אבטחה או מייל בדיקה.
* **הביקורת הסטטית** `node scripts/check-no-network.mjs` (או `npm run check:no-network`) נכשלת אם:
  * בקוד של הממשק (`src/`), השרת (`server/src/`), `shared/`, הקליפה של Windows (`src-tauri/src/`), `mobile/` או הקוד הנייטיבי של Android (`android/app/src/main/java|kotlin`) מופיעים קוד רשת יוצא, ספריית לקוח HTTP או כתובת חיצונית (שורות הערה, שורות CSP וקובצי בדיקה לא נבדקים). יש שני חריגים בלבד: `server/src/mail/` (לקוח ה-SMTP - רק `node:net` / `node:tls` אל שרת הדואר שהבעלים הגדיר, שברירת המחדל שלו בטופס היא `smtp.gmail.com`; בלי HTTP ובלי URL), ו-`server/src/remote/` (הגישה מרחוק של המצב המקומי למפתחים, סעיף 5.3 - רק DuckDNS, Let's Encrypt והנתב הביתי; הקוד הזה לא נכנס לבאנדל של השרת המארח, ו-`scripts/build-hosted.mjs` מסרב לבאנדל שמכיל אותו);
  * כתובת השרת של הלקוחות כתובה כמחרוזת בקוד של הלקוחות (`src/`, `mobile/`, `shared/`; בלי שורות הערה ושורות CSP) במקום לבוא מ-`src/config/server-default.json` (שחייבת להיות `https://<host>` בלי נתיב), או שהבאנדל הבנוי (`dist/assets/*.js`) מזכיר שרת אחר מלבד קישורי תיעוד של ספריות. קובצי הגדרות לא נסרקים: הכתובת כתובה בכוונה גם ב-CSP של `src-tauri/tauri.conf.json` (בדיקת Rust משווה אותו, ראו למטה) וב-`DIARY_PUBLIC_URL` של `deploy/hosted/fly.toml`;
  * המניפסט של Android מצהיר על הרשאה מחוץ לרשימה `INTERNET`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `USE_BIOMETRIC`;
  * יש תלות של לקוח HTTP או של Telemetry (למשל axios, Sentry, PostHog) ב-`package.json` או ב-`server/package.json`;
  * בקובצי תמונת השרת (`deploy/hosted/Dockerfile`, `entrypoint.sh`, `data-tools.sh`) יש `curl`, `wget`, `ADD` או כתובת `http(s)://`, או ש-`scripts/hosted/restore-archive.mjs` פותח חיבור. ההורדה היחידה בבניית התמונה - `apk add su-exec` ממאגרי Alpine של תמונת הבסיס - מותרת בכוונה.
* **שכבות נוספות**: ה-CSP של חלון Windows (`src-tauri/tauri.conf.json`) מתיר ב-`connect-src` רק את `'self'`, את מקור השרת ואת ה-IPC של Tauri (בדיקת Rust משווה אותו ל-`server-default.json`); ה-CSP של אפליקציית Android מתיר רק את `'self'` ואת מקור השרת; ו"מצב פרטיות לא מקוון" (מופעל כברירת מחדל, בכרטיס **פרטיות**) חוסם בממשק `fetch` / `XMLHttpRequest` / `WebSocket` לכל יעד אחר (`installNetworkGuard` ב-`src/api/client.ts`). ב-Windows קישור לדפי המדיניות נפתח בדפדפן של המערכת, ורק לשני הדפים האלה בשרת (`src-tauri/src/opener.rs`).
* **מה הביקורת לא מכסה**: את Fly.io ואת Gmail (ספקי השירות - ראו מדיניות הפרטיות), את החנויות, ואת מתקין ה-NSIS של Tauri, שמוריד מ-Microsoft את ה-bootstrapper של WebView2 רק אם WebView2 חסר במחשב (ב-Windows 11 הוא מובנה).

---

## 3. שימוש יומיומי

### 3.1 הרשמה וכניסה

* ההרשמה מבקשת שם פרטי, שם משפחה, דואר אלקטרוני, שם משתמש וסיסמה, וחשבון חדש מתחיל בשפה של מסך ההרשמה. נכנסים עם שם המשתמש **או** עם כתובת המייל; שם המשתמש האחרון מופיע מראש.
* בהרשמה חובה לסמן את התיבה **"קראתי את מדיניות הפרטיות והסכמתי לה"** (הקישור שבה פותח את המדיניות) - בלי הסימון החשבון לא נוצר, והשרת שומר עם החשבון מתי זה אושר ואת תאריך התחולה של המדיניות שאושרה (חשבונות קיימים לא נשאלים שוב).
* "זכור אותי" מסומן כברירת מחדל בהרשמה ובכניסה, כך שהאפליקציה נפתחת ישר ליומן. ב**הגדרות ← חשבון ← מכשירים מחוברים** רואים כל מכשיר מחובר ואפשר לנתק אותו.

### 3.2 "שכחת סיסמה?"

במסך הכניסה: "שכחת סיסמה?" ← כתובת המייל של החשבון ← מגיע מייל עם **קישור** ו**קוד בן 6 ספרות** (תקפים 30 דקות, לשימוש אחד; את הקוד אפשר להזין בכל מכשיר). אחרי בחירת סיסמה חדשה **כל מה שכתוב ביומן נשאר**, וכל המכשירים המחוברים מנותקים. התשובה למבקש זהה תמיד ("אם הכתובת הזו רשומה במערכת, שלחנו אליה קישור וקוד"), ויש מגבלה של 5 בקשות בשעה לכל כתובת מייל ו-10 לכל כתובת IP. השליחה עובדת רק אחרי שהבעלים הגדיר את כרטיס הדואר (סעיף 4.5). המייל לא מכיל שום תוכן מהיומן.

### 3.3 גיבוי, שחזור וייצוא

* עמוד **גיבוי** ← "צור קובץ גיבוי": היומן כולו כקובץ `.mpd` מוצפן (`your-personal-diary-backup-<שם משתמש>-<תאריך>.mpd`), בסיסמת החשבון או בסיסמה אחרת לבחירתכם. ב-Windows נפתח חלון "שמירה בשם", ב-Android יש "שמירה במכשיר" או "שיתוף", ובאתר זו הורדה רגילה. בלי הסיסמה אי אפשר לפתוח את הקובץ.
* **שחזור**: בוחרים קובץ גיבוי, מזינים את הסיסמה שלו ומאשרים - היומן של החשבון **מוחלף** בתוכן הגיבוי. סיסמת החשבון לא משתנה.
* **ייצוא** ל-TXT, CSV, JSON או PDF הוא קובץ רגיל וקריא (לא מוצפן) - כל מי שמקבל אותו יכול לקרוא אותו.

### 3.4 מחיקת חשבון

הכרטיס **האחרון** בהגדרות, **"מחיקת חשבון"**, הוא הדרך למחוק חשבון: סיסמת החשבון + "ידוע לי שלא ניתן לבטל את הפעולה הזו". נמחקים לצמיתות מהשרת החשבון, היומן, ההרגלים, ההגדרות, החיבורים בכל המכשירים וקישורי האיפוס, וגם העותק שבמכשיר הנוכחי; שינויים שעוד ממתינים במכשירים אחרים אובדים. קובצי גיבוי ששמרתם במקום אחר לא נפגעים. מי שלא יכול להיכנס - דף מחיקת החשבון (סעיף 2.3).

### 3.5 נגישות

* תמיכה מלאה בקוראי מסך (נבדק מול JAWS דרך WebView2), ניווט מלא במקלדת, סדר Tab הגיוני, כותרות ברורות ו-ARIA במקומות הנכונים.
* קיצורי מקלדת: `Alt+1..0` ניווט לפי סדר התפריט, `Ctrl+N` רשומה חדשה, `Ctrl+K` חיפוש, `Ctrl+L` נעילה, `Ctrl+S` שמירה, `Alt+←` חזרה, `Esc` סגירה, `Shift+?` רשימת הקיצורים.
* באפליקציית ה-Mac הקיצורים מוצגים בסמלי המק (⌘N, ⌘K, ⌘L, ⌘S, ⌥1..⌥0, ⌥←, ⇧?). בכל Mac (גם באתר בדפדפן) בתוך שדה טקסט Option + ספרה מקליד תו, Option+← זז מילה אחורה ו-Control+N / Control+K עורכים טקסט כמו בכל שדה במק. ב-Windows קוד Alt בתוך שדה (Alt + ספרות במקלדת הנומרית, למשל Alt+0150 ל-–) מקליד תו ולא מנווט.
* אף מידע לא מועבר בצבע בלבד; לכל גרף יש טבלת נתונים חלופית.
* ערכות נושא: לפי המערכת / בהיר / כהה / ניגודיות גבוהה, וגודל גופן מתכוונן.

---

## 4. לבעלים

### 4.1 איפה הכול

* **השרת**: `https://yourpersonaldiary.fly.dev`, האפליקציה `yourpersonaldiary` ב-Fly.io. ההגדרות שלו ב-[`deploy/hosted/fly.toml`](deploy/hosted/fly.toml) (אזור, מכונה, דיסק, הרשמה, תקרת חשבונות, בדיקת בריאות). **הסודות לא נמצאים באף קובץ של הפרויקט או של השרת**: הם נשמרים ב-Fly, ונוצרים מחלון PowerShell שלך ב-`scripts/hosted/set-secrets.ps1`. את שמות הסודות (בלי ערכים) רואים ב-`flyctl secrets list -a yourpersonaldiary`.
* **העותק שלך של מפתח השרת**: `set-secrets.ps1` כותב אותו (כברירת מחדל) לקובץ `Documents\yourpersonaldiary-device-key-<app>.txt`. אם עשית את שלב ב.6 ב-[`docs/HOSTED-DEPLOY.he.md`](docs/HOSTED-DEPLOY.he.md), השורה האחרונה שלו נמצאת במנהל הסיסמאות שלך והקובץ נמחק; אחרת - הקובץ הוא העותק, ושומרים אותו מחוץ לרשת, במקום אחר מהארכיון ומסיסמת הארכיון ([ספר התפעול](docs/HOSTED-RUNBOOK.he.md), פרק 10). הוא אחד משלושת הדברים שצריך לשחזור (סעיף 4.2).
* **המדריכים בעברית** (בתיקייה `docs/`):
  * [`HOSTED-DEPLOY.he.md`](docs/HOSTED-DEPLOY.he.md) - העלאת השרת: סודות, פריסה, מזהה הבעלים, כרטיס הדואר, ניטור, פתיחת ההרשמה, דומיין משלך;
  * [`HOSTED-RUNBOOK.he.md`](docs/HOSTED-RUNBOOK.he.md) - תפעול שוטף: בדיקה מהירה, הפעלה מחדש, לוגים, דיסק מלא, שחזור, ארכיון חודשי, סודות ומקרי חירום, עלויות;
  * [`OFFLINE-TEST.he.md`](docs/OFFLINE-TEST.he.md) - בדיקה ידנית של העבודה בלי חיבור (Windows והטלפון);
  * [`ANDROID-PHONE-TEST.he.md`](docs/ANDROID-PHONE-TEST.he.md) - התקנה בטלפון (Wireless debugging) ומה לבדוק;
  * [`PLAY-RELEASE.he.md`](docs/PLAY-RELEASE.he.md) ו-[`STORE-RELEASE.he.md`](docs/STORE-RELEASE.he.md) - פרסום בחנויות (סעיף 6).
* **מדיניות הפרטיות**: `legal/` (סעיף 2.3). **ערכות החנויות**: `play/` ו-`store/` (סעיף 5.5).
* **קובצי ההפצה נבנים בתוך הפרויקט** (סעיף 5.5): Windows ב-`src-tauri/target/release/bundle/` (`nsis/`, `msi/`, `msix/`), Android ב-`android/app/build/outputs/` (`apk/debug/app-debug.apk`, `bundle/release/app-release.aab`).

### 4.2 גיבויים

* **צילומי דיסק של Fly**: כל יום, ונשמרים 30 יום (`snapshot_retention = 30` ב-`fly.toml`). שחזור מצילום - פרק 6 בספר התפעול.
* **ארכיון שרת חודשי** - עותק שלא תלוי ב-Fly: בחשבון הבעלים, **הגדרות ← "שרת" ← "הכנת ארכיון שרת"**, עם סיסמת החשבון ו**סיסמת ארכיון** נפרדת (12 תווים לפחות). השרת כותב קובץ `.mpda` מוצפן של כל הנתונים **בלי מפתח השרת**, ושומר אצלו את 2 האחרונים. את הקובץ מורידים למחשב רק בפקודת `flyctl` שהכרטיס מעתיק (אי אפשר להוריד אותו דרך האתר או האפליקציה), בודקים את ה-SHA-256 בפקודה השנייה, ושומרים מחוץ לרשת - את 3 האחרונים. הכרטיס מזכיר כשהארכיון האחרון ישן מ-30 יום.
* **לשחזור צריך שלושה דברים, כל אחד במקום אחר**:
  1. קובץ הארכיון;
  2. סיסמת הארכיון - בלעדיה אין שום דרך לפתוח אותו;
  3. העותק שלך של מפתח השרת (`DIARY_DEVICE_KEY`) - הקובץ ש-`scripts/hosted/set-secrets.ps1` כתב, או השורה ממנו שבמנהל הסיסמאות (סעיף 4.1) - בלעדיו היומנים עדיין נפתחים בסיסמה, אבל "זכור אותי" ואיפוס סיסמה לא עובדים עד שכל משתמש נכנס פעם אחת.

  פותחים את הארכיון במחשב, בלי רשת: `node scripts/hosted/restore-archive.mjs <archive>.mpda <empty-dir>`. תרגיל השחזור המלא ומה עושים אם הכול אבד: [ספר התפעול](docs/HOSTED-RUNBOOK.he.md), פרקים 6, 6א, 6ב ו-10.
* גיבוי אישי של יומן אחד - עמוד **גיבוי** באפליקציה (סעיף 3.3).

### 4.3 ניטור

* **ניטור חיצוני** (מומלץ מאוד): שירות uptime monitor חינמי שבודק כל 5 דקות את `https://yourpersonaldiary.fly.dev/api/health/strict` ושולח מייל כשהתשובה אינה `200`. הכתובת הזו עונה `503` גם כשהשמירה לדיסק נכשלת או כשנשארו פחות מ-10% מקום פנוי - זו האזעקה האמיתית. ההגדרה: `docs/HOSTED-DEPLOY.he.md`, שלב ח; מה עושים כשהיא מצלצלת: פרקים 4-5 בספר התפעול.
* בנוסף Fly בודק את `/api/health` כל 30 שניות, ו-`[[restart]] policy = "always"` מעלה את השרת מחדש אם התהליך נופל.
* מבט מהיר: כרטיס **"שרת"** באפליקציה (עם אזהרה מתחת ל-15% מקום פנוי), `flyctl status -a yourpersonaldiary`, `flyctl logs -a yourpersonaldiary --no-tail`.

### 4.4 עלויות

כ-4-5 $ לחודש לייצור (מכונה של 512 MB, דיסק, צילומים); אפליקציית הניסיון עולה אותו דבר כל עוד היא רצה. פירוט ומעקב: [ספר התפעול, פרק 12](docs/HOSTED-RUNBOOK.he.md#12-מעקב-עלויות).

### 4.5 פעולות של הבעלים

* **כרטיס הדואר**: בחשבון ה-Gmail שממנו השרת ישלח: אבטחה ← אימות דו-שלבי ← "סיסמאות לאפליקציות" ← יוצרים סיסמת אפליקציה (16 אותיות). בכרטיס **"דואר אלקטרוני לאיפוס סיסמה"** ממלאים את **"כתובת Gmail"** (הכתובת של אותו חשבון; השדה מגיע ממולא ב-`yourpersonaldiary29@gmail.com`) ואת **"סיסמת אפליקציה (App Password)"**, מזינים את **"סיסמת החשבון שלך"** ביומן ובוחרים **"שמירה"**; אחר כך **"שליחת מייל בדיקה"** - והמייל חייב להגיע (`docs/HOSTED-DEPLOY.he.md`, שלב ז). סיסמת האפליקציה נשמרת מוצפנת בשרת - לא בקוד ולא במשתני סביבה.
* **גרסה חדשה של השרת**: הסשן הראשי מריץ `.\scripts\hosted\deploy.ps1 -Staging`, בודק, ואז `.\scripts\hosted\deploy.ps1` (סעיף 5.5). קודם השרת, ורק אחריו גרסאות חדשות של האפליקציות.
* **בקשת מחיקה ממי שלא יכול להיכנס**: מתקבלת רק מכתובת המייל הרשומה בחשבון; מדיניות הפרטיות מבטיחה מחיקה תוך 30 יום. הנוהל - פרק 9 בספר התפעול: בכרטיס **"שרת"** בהגדרות, בחלק **"בקשת מחיקה במייל"**, מקלידים את כתובת המבקש והכרטיס בונה את שתי הפקודות המוכנות ל-PowerShell במחשב שלך (איתור, ואז מחיקה עם `--confirm`), שמריצות את כלי הניהול `/app/admin.cjs` בתוך מכונת השרת דרך `flyctl ssh console` - כלומר עם הכניסה שלך ל-Fly בלבד; האפליקציה עצמה לא יכולה לחפש, להציג או למחוק חשבונות של אחרים.

---

## 5. למפתחים

### 5.1 סביבת הפיתוח (Windows 11)

| כלי | גרסה | הערות |
|---|---|---|
| Node.js | 24 LTS | `winget install OpenJS.NodeJS.LTS` |
| Rust | stable | `winget install Rustlang.Rustup` ואז `rustup default stable-msvc` |
| Visual Studio Build Tools 2022 | עם "Desktop development with C++" | `winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"` |
| WebView2 Runtime | כלול ב-Windows 11 | |
| ל-Android: JDK 21 ו-Android SDK | platform 36, build-tools 36.1.0 | הסקריפטים ב-`scripts/android/` מגדירים לעצמם `JAVA_HOME`, `ANDROID_HOME` ו-`GRADLE_USER_HOME` (`env.ps1`; ל-Git Bash `env.sh`); מיקום אחר: `DIARY_ANDROID_JDK`, `DIARY_ANDROID_SDK`, `DIARY_GRADLE_USER_HOME`. Gradle מגיע דרך ה-wrapper |
| ל-MSIX: Windows SDK | | `makeappx.exe` ו-`makepri.exe` ([`store/MSIX-BUILD.md`](store/MSIX-BUILD.md)) |
| לפריסת השרת: flyctl | | `%USERPROFILE%\.fly\bin\flyctl.exe` |

בתיקיית הפרויקט:

```bash
npm install
npm --prefix server install
```

אין צורך להתקין את Tauri CLI או את Capacitor CLI בנפרד - הם מגיעים דרך `npm install` (`@tauri-apps/cli`, `@capacitor/cli`).

### 5.2 הרצה בזמן פיתוח

האפליקציות פונות רק לשרת הקבוע, ושרת הייצור מתיר ב-CORS רק את המקורות של האפליקציות (`server/src/middleware/access.ts`) - לא את שרת הפיתוח של Vite. לכן מפתחים מול **שרת מארח מקומי**: אותו באנדל שרץ ב-Fly, על `127.0.0.1`, עם תיקיית נתונים זמנית:

```bash
npm run build && node scripts/build-hosted.mjs        # deploy/hosted/build/server-hosted.cjs (+ ui/)
DIARY_MODE=hosted DIARY_DATA_DIR=<תיקייה-זמנית> DIARY_PUBLIC_URL=http://127.0.0.1:48633 \
  PORT=48633 DIARY_BIND=127.0.0.1 node deploy/hosted/build/server-hosted.cjs --dev
```

`--dev` מתיר ב-CORS את מקור Vite (`http://localhost:1420`); כל משתני הסביבה של השרת: `docs/API.md` ← "מצב מארח". השרת הזה מגיש גם את הממשק עצמו בכתובת שלו (`http://127.0.0.1:48633`), בדיוק כמו האתר. ובטרמינל שני:

```bash
VITE_API_BASE=http://127.0.0.1:48633 npx tauri dev   # חלון Windows (Vite + Tauri)
VITE_API_BASE=http://127.0.0.1:48633 npm run dev     # או הממשק בדפדפן: http://localhost:1420
```

`VITE_API_BASE` הוא מתג פיתוח בלבד: אין אליו שום דרך מהממשק, ואסור שיהיה מוגדר בבנייה מופצת. ב-`devCsp` של חלון הפיתוח מותרים גם `127.0.0.1` / `localhost`; ב-CSP של הגרסה המופצת - רק השרת הקבוע.

ממשק הטלפון רץ בדפדפן גם מול השרת המארח המקומי שלמעלה - `VITE_API_BASE=http://127.0.0.1:48633 npm run mobile:dev` ← `http://127.0.0.1:1430` (`--dev` מתיר ב-CORS גם את המקור הזה, `localhost`/`127.0.0.1` על 1430; שרת הייצור - לעולם לא) - או עם הליבה המקומית (סעיף 5.3): `MOBILE_LOCAL_CORE=1 npm run mobile:dev`. את הגרסה האמיתית בודקים ב-APK על טלפון (סעיף 5.5).

### 5.3 המצב המקומי - לפיתוח ולבדיקות בלבד, לא מופץ

לפני המעבר לשרת, התוכנה רצה כולה על המחשב: שרת Node.js כ-sidecar ליד החלון, והיומן בתיקיית הנתונים של המחשב. הקוד הזה **נשאר בפרויקט לפיתוח ולבדיקות בלבד** (בדיקות השרת והממשק רצות עליו) **ואינו חלק מאף גרסה מופצת**. רק בו קיימים: גישה מהטלפון ברשת הביתית, גישה מרחוק דרך DuckDNS ו-Let's Encrypt (`server/src/remote/`), הגדרת המייל "במחשב", כרטיס "אבחון", רשימת המשתמשים במסך הכניסה ו"הבעלים = החשבון הראשון" (ARCHITECTURE.md, סעיפים 11-11ב).

* **Windows** - שלושה מתגים שמופעלים יחד: התכונה `local-server` ב-`src-tauri/Cargo.toml` (כבויה כברירת מחדל), קובץ העל `src-tauri/tauri.local.conf.json` (ה-sidecar, `resources/server/`, CSP ל-`127.0.0.1`), ו-`VITE_LOCAL_SERVER=1` לממשק (קובץ העל מגדיר אותו בעצמו):

  ```bash
  node scripts/build-server.mjs && node scripts/prepare-sidecar.mjs
  npx tauri dev --config src-tauri/tauri.local.conf.json --features local-server
  ```

  `npm run tauri:dev` עדיין מריץ את שני סקריפטי ההכנה ואז `tauri dev`, אבל בלי `--config` ו-`--features` התוצאה היא הלקוח הרזה.
* **שרת מקומי ודפדפן**: `npm run server:dev` (פורט 47321, תיקיית הנתונים `server/.dev-data`), ובטרמינל שני `VITE_API_BASE=http://127.0.0.1:47321 npm run dev` ← `http://localhost:1420`.
* **Android** - `MOBILE_LOCAL_CORE=1`: כל לוגיקת השרת רצה ב-Web Worker בתוך ה-WebView (`mobile/core/`), בלי שרת. `npm run android:apk` בונה ומאמת את התצורה הזו כשהמשתנה מוגדר. ברירת המחדל, וזו שמופצת, היא לקוח של השרת - בלי הליבה ובלי הנכסים שלה.

### 5.4 בדיקות

```bash
npm run check:all                            # טיפוסים (ממשק, שרת, mobile/) + Vitest של הממשק, של השרת (supertest) ושל mobile/
npm run check:no-network                     # ביקורת הרשת (סעיף 2.4)
(cd src-tauri && cargo test --lib)           # Rust: הגדרות ה-bundle וה-CSP, DPAPI ועותק הגיבוי של התור, פתיחת דפי המדיניות
node --test "scripts/**/*.test.mjs"          # הסקריפטים של ערכות Android, Play ו-Microsoft Store
node scripts/legal/build-pages.mjs --check   # דפי המדיניות ב-public/ תואמים למקור
```

* כל חלק לבד: `npm test`, `npm run server:test`, `npm run mobile:test`. ב-`mobile:test` נמצאת גם בדיקת הקצה לקצה של העבודה בלי חיבור (`mobile/test/hosted-offline.test.ts`): קוד הלקוח האמיתי מול ההרכבה המארחת האמיתית על `127.0.0.1`, עם ניתוקים, שני מכשירים והפעלות מחדש; היא גם בונה את החבילות המופצות ומוודאת שהתוספים המדומים של הבדיקה לא נמצאים בהן.
* בדיקות הערכות לפני הגשה: `node scripts/play/check-listing.mjs`, `node scripts/play/preflight.mjs`, `node scripts/store/check-listing.mjs`, `node scripts/store/check-msix.mjs`.
* בדיקות ידניות: [`docs/OFFLINE-TEST.he.md`](docs/OFFLINE-TEST.he.md), [`docs/ANDROID-PHONE-TEST.he.md`](docs/ANDROID-PHONE-TEST.he.md).

### 5.5 בנייה

**מתקין Windows (הלקוח הרזה)**

```bash
npx tauri build --bundles nsis
```

* `beforeBuildCommand` הוא `npm run build` (הממשק ל-`dist/`; כתובת השרת נאפית מ-`src/config/server-default.json`), ואחריו קומפילציית Rust **בלי** `local-server`.
* התוצר: `src-tauri/target/release/bundle/nsis/Your Personal Diary_0.1.0_x64-setup.exe` (כ-2.6 MB) - התקנה למשתמש הנוכחי, בלי הרשאות מנהל. **המתקין אינו כולל שרת**: `tauri.conf.json` לא מגדיר `externalBin` ולא `resources` (בדיקת Rust אוכפת זאת), ולכן קובץ התוכנה היחיד שהוא מתקין הוא `your-personal-diary.exe` (לצד המסיר ו-`install-locale.txt`). אם WebView2 חסר, המתקין מוריד את ה-bootstrapper של Microsoft (`downloadBootstrapper`).
* `npx tauri build --bundles nsis msi` מוסיף את `.../bundle/msi/Your Personal Diary_0.1.0_x64_he-IL.msi` - בעברית בלבד ובלי בחירת שפה. `npm run tauri:build` בונה את שניהם, ומריץ לפני כן גם את `server:build` ואת `sidecar:prepare` (הכנה למצב המקומי; התוצרים שלהם לא נארזים).
* **שפת המתקין**: בתחילת ההתקנה נפתח בורר עם 20 השפות, כל אחת בשמה שלה. מסומנת מראש שפת Windows כשהיא אחת מהן, אחרת אנגלית; בהתקנה חוזרת - הבחירה הקודמת. המתקין כולו מוצג בשפה הזו, ו-`src-tauri/nsis/hooks.nsh` כותב את קוד השפה ל-`install-locale.txt` ליד התוכנה (ההסרה מוחקת אותו). האפליקציה מחילה אותו **פעם אחת**: מסכי הכניסה וההרשמה בשפה הזו, וחשבון חדש מתחיל בה; חשבונות קיימים שומרים על השפה שלהם, ועם "זכור אותי" שפת המתקין ממתינה למסך הכניסה הראשון שאחרי יציאה. הודעות ש-Tauri לא מתרגם, או מתרגם עם שגיאות, נמצאות ב-`src-tauri/nsis/<Language>.nsh` - שמורות ב-UTF-8 **בלי BOM** (Tauri מוסיף BOM בעצמו).
* התקנה מעל גרסה ישנה שכללה את השרת המקומי מוחקת את `diary-server.exe` ואת קובצי `server\` שהיא השאירה, לפי שמם בלבד (`MPD_REMOVE_LEGACY_SERVER` ב-`hooks.nsh`, גם בהסרה).
* **חשוב**: בונים תמיד דרך `tauri build`. `cargo build --release` ישירות ב-`src-tauri` מפיק קובץ שמנסה לטעון את כתובת הפיתוח (`http://localhost:1420`).
* מתקין של המצב המקומי (לבדיקות בלבד, לא להפצה): `node scripts/build-server.mjs && node scripts/prepare-sidecar.mjs`, ואז `npx tauri build --config src-tauri/tauri.local.conf.json --features local-server --bundles nsis`.

**חבילת Microsoft Store (MSIX)** - צריך את `store/identity.json`: עותק של `store/identity.example.json` עם שלושת הערכים שמופיעים ב-Partner Center (Product identity). הקובץ עוד לא קיים, והבנייה מסרבת בלעדיו או עם ערכי הדוגמה. מיד אחרי `npm run tauri:build`:

```bash
node scripts/store/build-msix.mjs             # src-tauri/target/release/bundle/msix/YourPersonalDiary_1.0.0.0_x64.msix
node scripts/store/check-msix.mjs --release   # חייב להסתיים ב-PASSED
```

מספר הגרסה בחנות - `src-tauri/msix/package-version.json` (`1.0.0.0` בהגשה הראשונה). חבילת בדיקה שלא עולה לחנות: `--test`. הפרטים: [`store/MSIX-BUILD.md`](store/MSIX-BUILD.md).

**Android**

```bash
npm run android:doctor         # גרסאות הכלים (JDK, Gradle, AGP, SDK, Capacitor) ומצב הפרויקט
npm run android:apk            # mobile:build -> cap sync -> gradlew assembleDebug -> אימות סטטי: APK לבדיקה
npm run android:aab -- -Bump   # versionCode + 1 -> bundleRelease (R8): ה-AAB ל-Google Play
npm run android:verify         # האימות הסטטי לבדו (מזהה, הרשאות, מניפסט, 20 שפות, CSP)
npm run android:install -- -PairAddress <ip:port> -PairCode <6 ספרות> -ConnectAddress <ip:port>   # התקנה בטלפון
npm run android:bump           # versionCode + 1 (android/app/version.properties)
npm run android:sync           # cap sync android
```

* התוצרים: `android/app/build/outputs/apk/debug/app-debug.apk`, ו-`android/app/build/outputs/bundle/release/app-release.aab` (עם `mapping.txt`). חתימת ההעלאה ל-Play: [`docs/PLAY-RELEASE.he.md`](docs/PLAY-RELEASE.he.md), חלקים א-ב; בלי קובץ החתימה החיצוני ה-AAB נבנה לא חתום. ההתקנה בטלפון: [`docs/ANDROID-PHONE-TEST.he.md`](docs/ANDROID-PHONE-TEST.he.md).
* הפרויקט הנייטיבי: Capacitor 8.5.2, Gradle 8.14.3, Android Gradle Plugin 8.13.0, JDK 21; `minSdk 24`, `compileSdk` / `targetSdk 36`. המזהה `app.yourpersonaldiary` (קבוע אחרי ההעלאה הראשונה ל-Play) מוגדר ב-`android/app/build.gradle`, וה-namespace של הקוד נשאר `com.mydiary.app`. `versionName` נלקח מ-`package.json`, ו-`versionCode` מ-`android/app/version.properties`.
* המניפסט: `allowBackup=false` (היומן והעותק לא עולים לגיבוי בענן ולא עוברים בהעברת מכשיר), בלי cleartext, 20 שפות ב-`localeConfig`, ורק ההרשאות `INTERNET`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` ו-`USE_BIOMETRIC`.

**השרת (Fly.io)** - פריסה אמיתית מריץ רק הסשן הראשי, עם הבעלים (סוכנים - רק `-DryRun`):

```powershell
.\scripts\hosted\deploy.ps1 -Staging   # אפליקציית הניסיון yourpersonaldiary-staging
.\scripts\hosted\deploy.ps1            # ייצור
```

הסקריפט מריץ `npm run build` ← `node scripts/build-hosted.mjs` (`deploy/hosted/build/`) ← `node scripts/hosted/stage-image.mjs` (`deploy/hosted/dist/`) ← `fly deploy --ha=false --remote-only` (הבנייה בענן; אין Docker במחשב) ← `fly scale count 1` (תמיד מכונה אחת - השרת מחזיק מצב בזיכרון) ← בדיקה של `/api/health`. את הסודות הבעלים יוצר מחלון שלו ב-`scripts/hosted/set-secrets.ps1`. ההעלאה הראשונה: [`docs/HOSTED-DEPLOY.he.md`](docs/HOSTED-DEPLOY.he.md).

**דפי המדיניות**: `node scripts/legal/build-pages.mjs` (סעיף 2.3), לפני `npm run build` ופריסת השרת - `build-hosted.mjs` מסרב לממשק שנבנה לפני השינוי האחרון ב-`public/`.

**ערכות החנויות**

| | Google Play | Microsoft Store |
|---|---|---|
| התיקייה | `play/` - טקסטים ל-20 שפות (`listing/`), גרפיקה, צילומי מסך, תשובות המדיניות (`policy/`) | `store/` - טקסטים ל-20 שפות (`listing/`), צילומי מסך, תשובות הפרטיות, הערות לבודק ורשימת הגשה; `node store/render.mjs` מכין את `store/out/` |
| הסקריפטים | `scripts/play/` - `check-listing.mjs`, `render-graphics.mjs`, `render-screenshots.mjs`, `check-screenshots.mjs`, `preflight.mjs` | `scripts/store/` - `build-msix.mjs`, `check-msix.mjs`, `check-listing.mjs`, `listing-csv.mjs`; צילומי המסך: `scripts/store-shots/` |
| ההסבר | [`play/README.he.md`](play/README.he.md), [`docs/PLAY-RELEASE.he.md`](docs/PLAY-RELEASE.he.md) | [`store/listing/README.md`](store/listing/README.md), [`docs/STORE-RELEASE.he.md`](docs/STORE-RELEASE.he.md), [`store/MSIX-BUILD.md`](store/MSIX-BUILD.md) |

### 5.6 מבנה הפרויקט

| תיקייה | מה יש בה |
|---|---|
| `src/` | הממשק (React 19 + TypeScript + Vite) - אותו קוד ל-Windows, ל-Android ולאתר, כולל מנוע העבודה בלי חיבור (`src/offline/`) |
| `shared/` | החוזה המשותף לממשק ולשרת: טיפוסים וקבועים, 20 קטלוגי השפות (`shared/i18n/`), לוחות השנה והחגים (`shared/calendars/`), חוזה הסנכרון (`shared/sync.ts`) |
| `server/` | השרת (Node.js + Express 5 + sql.js): חשבונות, הצפנה, יומנים, ניתוח, חיפוש, ייצוא, גיבוי, מייל וסנכרון - אותו קוד במצב המארח ובמצב המקומי |
| `src-tauri/` | קליפת Windows (Rust, Tauri 2): `src/` (פקודות, DPAPI ו-Windows Hello, פתיחת דפי המדיניות), `nsis/` (המתקין), `msix/` (תבנית ה-MSIX), `icons/`, ו-`resources/server/fonts/` (גופני ה-PDF של השרת) |
| `mobile/` | צד ה-web של אפליקציית Android: אתחול (`host/`), הגישור לתוספים הנייטיביים (`platform/`), הגדרות Vite ו-Vitest, הליבה המקומית (`core/`, לפיתוח בלבד) והבדיקות (`test/`) |
| `android/` | פרויקט ה-Android הנייטיבי (Gradle, Capacitor 8, תוספים ב-Java) |
| `deploy/hosted/` | השרת ב-Fly.io: `fly.toml`, `fly.staging.toml`, `Dockerfile`, `entrypoint.sh`, `data-tools.sh`; `build/` ו-`dist/` נוצרים בבנייה |
| `scripts/` | בנייה ובדיקות: `build-hosted.mjs`, `check-no-network.mjs`, `build-server.mjs` ו-`prepare-sidecar.mjs` (מצב מקומי), ותיקיות `hosted/`, `android/`, `play/`, `store/`, `store-shots/`, `legal/`, `mobile/` |
| `legal/` | מדיניות הפרטיות ודף מחיקת החשבון ב-20 שפות (Markdown), ו-`settings.json` |
| `public/` | קבצים סטטיים של הממשק: אייקונים, `manifest.webmanifest`, ודפי המדיניות שנבנו (`privacy/`, `delete-account/`, `support/`, `terms/`) |
| `play/` | ערכת Google Play |
| `store/` | ערכת Microsoft Store (`store/out/` נוצר בבנייה) |
| `docs/` | התיעוד: המדריכים לבעלים (`*.he.md`), חוזה ה-API, התוכניות (`ANDROID-PLAN.md`, `HOSTED-PLAN.md`, `SYNC-PLAN.md`) ומשימות הסוכנים (`android-tasks/`, `play-tasks/`, `store-tasks/`) |
| `design/` | מקור האייקון (`app-icon.svg`) |
| `mpd-store-tools/` | תיקיית הכלים של צילומי המסך לחנויות (`playwright-core` מותקן שם, מחוץ לתלויות הפרויקט) |
| `h10c-tmp/` | שאריות עבודה זמניות של סוכן (סקריפטים ולוגים) - לא חלק מהמוצר |
| `dist/`, `mobile-dist/`, `node_modules/` | נוצרים בבנייה ובהתקנה |

---

## 6. מצב החנויות

הערכות ל-**Google Play** ול-**Microsoft Store** מוכנות: טקסטים ב-20 שפות, גרפיקה וצילומי מסך, תשובות המדיניות והפרטיות, סקריפטי בנייה ובדיקה, ומדריכים לבעלים (סעיף 5.5). תשובת ה-App access ל-Google Play ([`play/policy/app-access.md`](play/policy/app-access.md), וגם [`docs/PLAY-RELEASE.he.md`](docs/PLAY-RELEASE.he.md) חלק ד סעיף 2) נותנת לבודקים את חשבון ההדגמה `stor`, שיש בו נתוני דוגמה; הסיסמה שלו נכתבת רק ב-Play Console. **הפרסום נדחה בהחלטת הבעלים** - עוד לא הועלה דבר לאף חנות (`play/last-upload.json`, ו-`store/identity.json` עוד לא נוצר). הבאים בתור: גרסאות ל-**Mac** ול-**iPhone**.

**Mac ו-iPhone** (התוכנית: [`docs/APPLE-PLAN.md`](docs/APPLE-PLAN.md)):
* **אפליקציית ה-Mac** נבנית במחשב ה-Mac של הבעלים, קובץ אחד ל-Intel ול-Apple Silicon (`scripts/mac/release.sh`). היום היא חתומה רק חתימה מקומית (ad-hoc), ולכן מחשבי Mac אחרים חוסמים אותה. כדי להפיץ אותה צריך תעודת Developer ID מאפל ([`docs/MAC-RELEASE.he.md`](docs/MAC-RELEASE.he.md)).
* **אפליקציית ה-iPhone** מוכנה בקוד ([`scripts/ios/README.he.md`](scripts/ios/README.he.md)) ועוד לא נבנתה. הבנייה דורשת Xcode 26, ו-Xcode 26 דורש macOS חדש יותר מזה שמותקן היום במחשב ה-Mac.
* **ערכת ה-App Store** מוכנה ב-[`appstore/`](appstore/README.he.md):
  * טקסטים ב-19 השפות ש-App Store תומכת בהן;
  * צילומי מסך של iPhone ושל Mac;
  * אייקון;
  * תשובות לכל השדות של App Store Connect ([`appstore/ANSWERS.he.md`](appstore/ANSWERS.he.md));
  * רשימת משימות מאפס ועד החנות ([`appstore/CHECKLIST.he.md`](appstore/CHECKLIST.he.md)).

  הפרסום מחכה להרשמה של הבעלים ל-Apple Developer Program (99 דולר לשנה).

---

## רישיונות של רכיבים מצורפים

**אפליקציית Windows** - רכיב התוכנה היחיד במתקין ובחבילת ה-MSIX הוא קובץ ההרצה `your-personal-diary.exe` (לצדו בתיקיית ההתקנה רק המסיר ו-`install-locale.txt`, וב-MSIX רק קובצי החבילה: המניפסט, `resources.pri` והסמלים); אין בה Node.js ואין רכיבי שרת:

* Tauri 2 והתוספים `tauri-plugin-dialog` ו-`tauri-plugin-notification` - Apache-2.0 או MIT; בממשק: `@tauri-apps/api` והתוספים שלו - אותו רישיון.
* התלויות הישירות ב-Rust: `serde`, `serde_json`, `windows`, `windows-future` - MIT או Apache-2.0 (כל התלויות העקיפות: `src-tauri/Cargo.lock`).
* הממשק: React 19, React DOM, React Router 7 - MIT.

**אפליקציית Android** (כל מה שנארז ב-AAB ל-Google Play):

* אותו ממשק: React, React DOM, React Router - MIT.
* Capacitor 8 (`@capacitor/core`, `@capacitor/android`) והתוספים `app`, `filesystem`, `preferences`, `local-notifications`, `share` - MIT.
* הספריות הנייטיביות שהם מביאים איתם: Apache Cordova Android 14.0.1 (`org.apache.cordova:framework`, שכבת התאימות ש-Capacitor כולל), ספריות AndroidX, ספריית התקן של Kotlin ו-kotlinx.coroutines - Apache-2.0; ספריית הקבצים של Ionic (`io.ionic.libs:ionfilesystem-android`, של התוסף `filesystem`) - MIT.

**השרת** (רץ ב-Fly.io; לא מותקן אצל המשתמשים):

* Node.js 24 (תמונת הבסיס `node:24-alpine`) - MIT.
* express, pdfkit, bidi-js - MIT; sql.js - MIT (SQLite עצמו - Public Domain).
* גופני ה-PDF (`src-tauri/resources/server/fonts/`, מועתקים לבאנדל המארח): DejaVu Sans - רישיון Bitstream Vera / Arev (`LICENSE-DejaVu.txt`); Noto Sans Arabic, Noto Sans Devanagari ו-Noto Sans Thai - SIL Open Font License 1.1 (`OFL-NotoSans*.txt`).

**במצב המקומי למפתחים בלבד** (לא מופץ): המתקין שלו כולל גם את `diary-server.exe` - עותק של `node.exe` (Node.js, MIT; `src-tauri/binaries/LICENSE-nodejs.txt` נוצר בבנייה) - ואת משאבי השרת שלמעלה.
