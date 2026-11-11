# ארכיטקטורת המערכת - "Your Personal Diary"

מסמך זה מתאר את התכנון של התוכנה לפני המימוש ומשמש חוזה בין כל חלקי המערכת.

## 1. עקרונות

1. **שרת אחד, שלושה לקוחות.** המוצר הוא שרת Your Personal Diary אחד - `https://yourpersonaldiary.fly.dev` (Fly.io, `DIARY_MODE=hosted`; המצב המארח, סעיף 2 למטה) - ושלושה לקוחות של אותו ממשק React: אפליקציית Windows (Tauri), אפליקציית Android (Capacitor) והאתר שהשרת מגיש. כתובת השרת נאפית בבנייה (`src/config/server-default.json`) ואין בממשק דרך לשנות אותה. היומן נשמר בשרת. במכשיר נשמרים, **לא מוצפנים**, אסימון הכניסה, שם המשתמש האחרון, העדפות השפה והתצוגה ושאלות החיפוש האחרונות (טקסט שנגזר מהיומן; נמחקות ביציאה), ולעבודה בלי חיבור - עותק **מוצפן** של מה שהיא צריכה (סעיף 11ג); הרשימה המלאה: README סעיף 2.2. אין Telemetry, אין Analytics, אין עדכונים אוטומטיים ואין שום יעד רשת אחר (השרת עצמו פותח רק חיבור SMTP לשליחת מיילים - סעיף 11ב).
2. **הצפנה במנוחה.** כל יומן של משתמש הוא קובץ אחד מוצפן (AES-256-GCM) שמפתחו נגזר מהסיסמה (scrypt); קובץ שהועתק לבדו לא נקרא בלי הסיסמה. זו לא הצפנה מקצה לקצה: בזמן שמחוברים היומן פתוח בזיכרון השרת, ומפתח השחזור (סעיף 5.1) מאפשר למי ששולט בשרת ובסודות שלו לאפס סיסמה.
3. **מנוע אחד.** כל הלוגיקה (חשבונות, מסד נתונים, ניתוח דפוסים, חיפוש, ייצוא, גיבוי, מייל, סנכרון) יושבת בקוד השרת (`server/`, Node.js), שרץ כשרת המארח. שלושת הלקוחות מדברים עם אותו שרת ב-HTTPS, ולכן בכל מכשיר רואים את אותו יומן; בלי חיבור הם ממשיכים לעבוד ומעלים את השינויים כשהחיבור חוזר (סעיף 11ג).
4. **המצב המקומי הוא לפיתוח ולבדיקות בלבד.** אותו קוד שרת רץ גם על המחשב כ-sidecar של Tauri (המצב המקומי - סוף סעיף 2, README סעיף 5.3): עליו רצות הבדיקות, ורק בו יש גישה מהטלפון ברשת הביתית וגישה מרחוק דרך DuckDNS (סעיפים 11, 11א). הוא לא חלק מאף גרסה מופצת.
5. **נגישות היא דרישה, לא תוספת.** HTML סמנטי, ניווט מלא במקלדת, ARIA במקומות הנכונים, הודעות סטטוס ל-JAWS.
6. **שקיפות.** לכל תובנה יש "למה קיבלתי את התובנה הזאת?" עם המספרים שמאחוריה, וניסוח זהיר שלא מציג מתאם כסיבתיות.

## 2. טכנולוגיות

| שכבה | טכנולוגיה | למה |
|---|---|---|
| קליפת Desktop | **Tauri 2** (Rust) + WebView2 | קטן, מאובטח (CSP, בידוד תהליכים), עובד מצוין עם JAWS דרך WebView2 (Chromium) |
| ממשק | **React 19 + TypeScript + Vite** | רכיבים נגישים, RTL מלא, בדיקות עם Vitest + Testing Library |
| שרת | **Node.js 24 + Express 5 + TypeScript** | אותו קוד רץ על השרת המארח (Fly.io, `DIARY_MODE=hosted`), במצב המקומי במחשב ובליבת הטלפון (מצב מקומי של אנדרואיד) |
| מסד נתונים | **SQLite** דרך `sql.js` (WebAssembly) | SQLite אמיתי, בזיכרון, ללא מודולים בינאריים; הייצוא/ייבוא של תמונת ה-DB מאפשר הצפנה של הקובץ כולו |
| הצפנה | `node:crypto` - scrypt + AES-256-GCM | מובנה ב-Node, ללא תלות חיצונית |
| PDF | `pdfkit` + גופן DejaVu Sans (עברית) + `bidi-js` | יצירת PDF מקומית עם טקסט עברי מימין לשמאל |
| התקנה | Tauri bundler - **NSIS** (`.exe`) ו-**MSI**; חבילת **MSIX** ל-Microsoft Store (`scripts/store/build-msix.mjs`) | קובץ התקנה רגיל ל-Windows 11 |

**האפליקציה המופצת ל-Windows היא לקוח רזה** של שרת Your Personal Diary (המצב המארח - `docs/API.md` "מצב מארח", `docs/HOSTED-PLAN.md` חלק ב', `docs/android-tasks/HOSTED-IMPL.md` סעיפים 8–10): הממשק המוטמע בה פונה לכתובת אחת קבועה שנאפית בזמן הבנייה מ-`src/config/server-default.json` (`DEFAULT_SERVER_URL` ב-`src/config/server-default.ts`), אין בממשק דרך לשנות אותה, וההתקנה אינה כוללת Node.js, `server.cjs` או משאבי שרת. על המחשב נשמרים - לא מוצפנים - אסימון הסשן, שם המשתמש האחרון, העדפות המכשיר ושאלות החיפוש האחרונות (README סעיף 2.2), ו - לעבודה בלי חיבור (סעיף 11ג) - עותק מוצפן של השינויים שממתינים להעלאה, ועם "זכור אותי" גם של מה שהוצג לאחרונה ושל מפתח העותק עטוף ב-DPAPI (פרופיל WebView2, ועותק גיבוי של התור ב-`%LOCALAPPDATA%\com.mydiary.app\offline\<userId>\`); הקליפה אינה יוצרת קובץ לוג.

**המצב המקומי** - אותו שרת Node.js רץ על המחשב כ-sidecar (`diary-server.exe` = node.exe) יחד עם קובץ השרת המאוגד (`server.cjs`) - נשאר בקוד כתצורת פיתוח ובדיקה בלבד (כל הבדיקות רצות עליו) ומופעל רק בבנייה מפורשת: התכונה `local-server` ב-`src-tauri/Cargo.toml` + קובץ העל `src-tauri/tauri.local.conf.json` + `VITE_LOCAL_SERVER=1` לממשק (README סעיף 5.3). חלקי המסמך שמתארים את ה-sidecar, את תיקיית הנתונים במחשב, את הגישה מהטלפון ברשת הביתית ואת הגישה מרחוק (התרשים השני בסעיף 4, "גישה מהטלפון" בסעיף 11, וסעיף 11א) מתייחסים למצב הזה בלבד; בשאר הסעיפים מה שקיים רק בו מסומן "במצב המקומי" - למשל בסעיפים 5 ו-5.1 רשימת החשבונות במסך הכניסה, `device.key` כקובץ במחשב וקישורי האיפוס ל-`127.0.0.1` או לכתובת הגישה מרחוק.

## 3. מבנה התיקיות

```
my-personal-diary/
├── ARCHITECTURE.md              מסמך זה
├── README.md                    התקנה, הרצה, בנייה, גיבוי, פרטיות
├── package.json                 סקריפטים של הפרויקט (ממשק + הפעלת שרת + Tauri)
├── shared/                      חוזה משותף לממשק ולשרת
│   ├── types.ts                 כל הטיפוסים שעוברים ב-HTTP
│   └── constants.ts             רגשות, תבניות הרגלים, תקופות, ניווט, ספי ניתוח
├── docs/
│   └── API.md                   חוזה ה-REST API
├── src/                         ממשק (React)
│   ├── main.tsx / App.tsx       אתחול, ספקי הקשר, מעטפת העמוד, נעילה, קיצורים
│   ├── router.tsx               טבלת הנתיבים + RequireAuth (הפניה ל-/login)
│   ├── api/                     client.ts (HTTP + טוקן + מגן רשת), index.ts (פונקציות לכל נתיב)
│   ├── models/                  re-export של shared
│   ├── constants/               routes.ts, texts.ts (כל המחרוזות המשותפות), shortcuts.ts, settings.ts
│   ├── context/                 AuthContext, SettingsContext, AnnouncerContext (live regions), ToastContext, LockContext
│   ├── components/              a11y/ (SkipLink, LiveRegion, FocusHeading, Dialog, RouteAnnouncer), ui/ (Button, Card, Field, inputs, Tabs, ConfirmDialog, ...), forms/ (RatingInput, EmotionPicker, TagInput, DurationInput, ...), charts/ (LineChart, BarChart, DataTableToggle), layout/ (AppShell, Header, NavBar, BackButton, TodayDate, Greeting)
│   ├── pages/                   עמוד לכל נתיב + תיקיות משנה: entries/ (EntryForm, EntryCard, EntryDetails, DayNavigator), insights/ (InsightCard, HabitDialog, ...), settings/ (ChangePasswordDialog, BackupCreateSection, RestoreSection, ExportSection, PrivacySection, RemoteAccessSection, ...)
│   ├── hooks/                   useApi, useAutoLock, useKeyboardShortcuts, useReminders, useUnsavedChangesGuard, useLocalStorageState, ...
│   ├── styles/                  tokens.css (צבעים/גדלים/ערכות), base.css (RTL, focus), layout.css, forms.css, components.css
│   ├── utils/                   תאריכים, פורמט מספרים, פלטפורמה (דיאלוגים/התראות של Tauri), הורדות, qr.ts (מקודד QR זעיר, ללא תלות)
│   └── test/                    setup + עוזרי רינדור; הבדיקות עצמן ליד הרכיבים (*.test.tsx)
├── server/                      השרת (Node.js) - השרת המארח של המוצר, ובפיתוח ובבדיקות גם המצב המקומי
│   ├── src/hosted-index.ts      נקודת הכניסה של השרת המארח (`DIARY_MODE=hosted`); ההרכבה ב-src/hosted.ts (`startHosted`)
│   ├── src/hosted/              owner.ts (הבעלים = `DIARY_OWNER_ID`), policy.ts (הרשמה, סיור), archive.ts (ארכיון השרת)
│   ├── src/sync/                הסנכרון של העבודה בלי חיבור (`/api/sync`, סעיף 11ג)
│   ├── src/index.ts             נקודת הכניסה של המצב המקומי (sidecar)
│   ├── src/server.ts            מחזור החיים במצב המקומי: פורט, מאזין loopback, מאזין LAN אופציונלי, מנהל הגישה מרחוק
│   ├── src/app.ts               Express: middleware, נתיבים, הגשת הממשק (האתר; במצב המקומי - לטלפון)
│   ├── src/config.ts            ארגומנטים, תיקיית הנתונים, server-settings.json
│   ├── src/errors.ts            ApiError - קוד + הודעה בעברית
│   ├── src/middleware/          auth (Bearer), access (CORS, LAN guard, CSP, rate limit), error
│   ├── src/security/            kdf.ts, container.ts (פורמט הקובץ המוצפן), accounts.ts, sessions.ts, vault.ts, auth-service.ts, device-key.ts (גם מפתח השחזור), resets.ts + password-reset.ts ("שכחת סיסמה?", סעיף 5.1), owner.ts (הבעלים במצב המקומי - החשבון הראשון במחשב; סעיף 11א "בעלות")
│   ├── src/mail/                שליחת מייל (סעיף 11ב): node-transport.ts (לקוח SMTP בלי תלויות - המודול היחיד שפותח sockets), transport.ts (הממשק בין השירות ללקוח), errors.ts (`SmtpError`), env-overrides.ts (עקיפות לבדיקות), mime.ts, templates.ts, settings.ts, service.ts
│   ├── src/db/                  database.ts (sql.js), schema.ts, dataset.ts (אגרגציה יומית), entries-repo.ts, habits-repo.ts, settings-repo.ts, seed.ts
│   ├── src/analysis/            engine.ts, math.ts, detectors/*.ts (כל דפוס = גלאי), phrasing.ts, provider.ts (ממשק למודל AI עתידי)
│   ├── src/search/              parser.ts (שאלה בעברית -> ParsedQuery), executor.ts
│   ├── src/stats/               series.ts, calendar.ts, home.ts
│   ├── src/export/              txt.ts, csv.ts, json.ts, pdf.ts
│   ├── src/backup/              backup.ts (יצירה/בדיקה/שחזור)
│   ├── src/remote/              גישה מרחוק (אופציונלי, סעיף 11א): manager.ts, duckdns.ts, acme.ts + csr.ts/der.ts, dns-check.ts, upnp.ts, tls.ts, tls-store.ts, settings.ts, http.ts, errors.ts
│   ├── src/routes/              נתיב Express לכל תחום
│   └── test/                    בדיקות (vitest + supertest)
├── src-tauri/                   קליפת Desktop (לקוח רזה של השרת)
│   ├── src/lib.rs               פקודות get_install_locale / show_store_notification; במצב המקומי (feature local-server) גם הפעלת ה-sidecar, גילוי הפורט ו-get_server_info/get_server_log/restart_server
│   ├── tauri.conf.json          חלון, CSP (connect-src: מקור השרת הקבוע בלבד), bundling (NSIS/MSI) - בלי sidecar ובלי resources
│   ├── tauri.local.conf.json    קובץ-על למצב המקומי למפתחים (--config): sidecar, resources/server, CSP ל-127.0.0.1, VITE_LOCAL_SERVER=1
│   ├── nsis/                    מתקין NSIS: hooks.nsh (בורר שפות, install-locale.txt) והודעות המתקין בשפות ש-Tauri לא מתרגם (<Language>.nsh)
│   ├── capabilities/default.json הרשאות: dialog, notification
│   ├── binaries/                diary-server-<triple>.exe (עותק של node.exe, נוצר בבנייה; מצב מקומי בלבד - לא נארז במתקין המופץ)
│   ├── resources/server/        server.cjs, sql-wasm.wasm, pdfkit-data/, ui/ (נוצר בבנייה; מצב מקומי בלבד), fonts/ (במאגר; גם מקור הגופנים של הבאנדל המארח)
│   └── icons/                   אייקונים (נוצרו מ-design/app-icon.svg)
└── scripts/                     build-server.mjs, prepare-sidecar.mjs (מצב מקומי), build-hosted.mjs + hosted/ (השרת המארח), check-no-network.mjs
```

העץ מציג את עיקר הממשק, השרת והקליפה של Windows; הרשימה המלאה של התיקיות (גם `mobile/`, `android/`, `deploy/hosted/`, `legal/`, `play/`, `store/`) - README סעיף 5.6.

## 4. זרימת נתונים

**המוצר** - שלושה לקוחות, שרת אחד (המצב המארח):

```
┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│ Windows app              │   │ Android app              │   │ Website (browser)        │
│ Tauri 2 + WebView2       │   │ Capacitor 8 (WebView)    │   │ the UI the server serves │
│ React UI (dist/)         │   │ React UI (mobile-dist/)  │   │ (same origin)            │
└─────────────┬────────────┘   └─────────────┬────────────┘   └─────────────┬────────────┘
              │                              │                              │
              │ HTTPS                        │ HTTPS                        │ HTTPS
              └──────────────────────────────┼──────────────────────────────┘
                                             ▼
            ┌────────────────────────────────┴───────────────────────────────┐
            │ https://yourpersonaldiary.fly.dev  (Fly.io, fra, one machine)  │
            │ Node.js 24 + Express 5, DIARY_MODE=hosted                      │
            │  ├─ auth: accounts, sessions, "Forgot password?", owner        │
            │  ├─ vault: one encrypted DB in memory per signed-in user       │
            │  ├─ analysis / search / stats / export / backup / mail         │
            │  ├─ sync: /api/sync (offline mode)                             │
            │  └─ static: the website UI + the privacy pages                 │
            └────────────────────────────────┬───────────────────────────────┘
                                             │  files on the Fly volume (/data)
              accounts.json, sessions.json, resets.json, server-settings.json,
              users/<id>.mpd (encrypted), archive/*.mpda; server key: the secret DIARY_DEVICE_KEY
```

**המצב המקומי** - לפיתוח ולבדיקות בלבד, לא מופץ (סוף סעיף 2): אותו קוד שרת כ-sidecar על המחשב, והטלפון ברשת הביתית:

```
┌──────────────────────────────┐        ┌──────────────────────────────────────────────┐
│  חלון Tauri (WebView2)       │        │  diary-server (Node.js, sidecar)             │
│  React UI  ──fetch──────────────────▶ │  Express  /api/*                             │
│  tauri://localhost           │        │   ├─ auth: חשבונות, סשנים, סיסמאות           │
│  dialogs / notifications ──▶ │ Rust   │   ├─ vault: DB מוצפן בזיכרון לכל משתמש       │
└──────────────┬───────────────┘        │   ├─ analysis / search / stats / export      │
               │ spawn + stdout          │   └─ static: dist/ לטלפון                    │
               └────────────────────────▶│  127.0.0.1:47321  (+ 0.0.0.0 כש-LAN מופעל)  │
                                         └──────────────┬───────────────────────────────┘
                                                        │ קבצים
                                         %APPDATA%\com.mydiary.app\
                                           accounts.json, server-settings.json, device.key,
                                           sessions.json, users\<id>.mpd (מוצפן)
       טלפון (דפדפן, אותה רשת Wi-Fi)  ──http://<ip>:47321──▶  אותו שרת, אותם נתונים
```

* **האפליקציה המופצת (לקוח רזה)**: הממשק טעון מתוך ההתקנה (`http://tauri.localhost` ב-Windows) ופונה ישירות ל-`https://<שרת Your Personal Diary>` - `DEFAULT_SERVER_URL`, בלי גילוי פורט ובלי פקודת `get_server_info`. ה-CSP של החלון מתיר ב-`connect-src` רק את המקור הזה (ואת ה-IPC של Tauri); השרת המארח מתיר את מקור המעטפת ב-CORS (`HOSTED_ORIGINS` ב-`server/src/middleware/access.ts`: `http://tauri.localhost`, `tauri://localhost`, `https://tauri.localhost`). כשאין חיבור, הממשק ממשיך לעבוד מהעותק המוצפן שבמכשיר וכתיבות נכנסות לתור שעולה כשהחיבור חוזר (סעיף 11ג, WP-H10); רק כשאין עותק (כניסה ראשונה, בלי "זכור אותי", דפדפן אחרי טעינה מחדש) מוצג המסך "אין חיבור לשרת היומן" עם "נסו שוב" (`src/context/ConnectionContext.tsx`).
* **אפליקציית Android**: הממשק (`mobile-dist/`) נטען מתוך ה-APK, במקור `https://localhost` של ה-WebView, ופונה ל-`DEFAULT_SERVER_URL`; השרת המארח מתיר את המקור הזה ב-CORS (`https://localhost`, `capacitor://localhost`), וה-CSP של האפליקציה מתיר רק את `'self'` ואת מקור השרת. הליבה שמריצה את קוד השרת בתוך ה-WebView (`mobile/core/`) קיימת רק בבניית פיתוח עם `MOBILE_LOCAL_CORE=1` (README סעיף 5.3).
* **האתר**: השרת המארח מגיש את הממשק בכתובת שלו, והממשק פונה למקור שממנו נטען (same-origin).
* **חיבור יוצא מהשרת**: רק SMTP לשרת הדואר שהבעלים הגדיר בכרטיס הדואר (סעיף 11ב).
* **במצב המקומי** הממשק (שנבנה עם `VITE_LOCAL_SERVER=1`) פונה ל-`http://127.0.0.1:<port>`, והפורט מתגלה דרך הפקודה `get_server_info`.
* מחזור חיים של השרת במצב המקומי: הקליפה מפעילה את ה-sidecar עם `--data-dir`, `--assets`, `--static` (הממשק לטלפון) ו-`--parent-pid <pid>`. השרת בודק כל 2 שניות שתהליך הקליפה עדיין קיים ונסגר בעצמו כשהוא נעלם (גם בקריסה או בסגירה כפויה), ובסגירה רגילה הקליפה הורגת אותו מיד. כך לא נשאר שרת יתום.
* במצב המקומי טלפון ברשת הביתית מקבל את אותו ממשק מהשרת עצמו (`/`), ולכן ה-API הוא same-origin.
* גיבוי, ייצוא ושחזור באפליקציה המופצת: הממשק מוריד את הקובץ מהשרת (`backup.download` / `exportApi.download`) והמעטפת שומרת אותו בדיאלוג "שמירה בשם" המקומי - הפקודה `save_file` ב-`src-tauri/src/lib.rs` מקבלת את הבתים ושם מוצע בלבד, מציגה את הדיאלוג וכותבת את הקובץ, כך שהדף לעולם לא קובע נתיב; שחזור מעלה את הקובץ שנבחר בשדה הקובץ, כמו בדפדפן. רק במצב המקומי (`usesLocalFilePaths()` ב-`src/utils/platform.ts`) נשלח לשרת נתיב (`destPath`/`srcPath`) שנבחר בדיאלוג של תוסף Tauri, והשרת המקומי כותב/קורא את הקובץ בעצמו - השרת המארח דוחה נתיב. התראות מגיעות מתוסף Tauri; בדפדפן מתבצעת הורדה רגילה, ובאפליקציית Android "שמירה במכשיר" / "שיתוף".

## 5. חשבונות, סשנים ונעילה

* **הרשמה**: שם פרטי, שם משפחה, דואר אלקטרוני (חובה; נבדק רק מבחינת מבנה - אין מייל אימות; משמש לאיפוס סיסמה במייל כשהבעלים הגדיר שליחת מייל), שם משתמש, סיסמה + אישור. כתובת מייל שייכת לחשבון אחד בלבד וגם שם משתמש (שניהם בלי תלות באותיות גדולות/קטנות, גם בעריכת הפרטים); שם פרטי ושם משפחה יכולים לחזור. נוצר `AccountRecord` ב-`accounts.json` בשרת (בלי סיסמה; פרטי החשבון לא מוצפנים - README סעיף 2.1) ויומן מוצפן ריק `users/<id>.mpd`. **מי יכול להירשם** בשרת המארח (`server/src/hosted/policy.ts`; `docs/API.md` "מצב מארח" ← "הרשמה"): לפי `DIARY_REGISTRATION` - בייצור `open`, כלומר כל אחד מהאינטרנט (`deploy/hosted/fly.toml`); `invite` דורש גם `DIARY_INVITE_CODE` (בלעדיו השרת לא עולה), ו-`closed` עוצר הרשמות חדשות - עם מגבלה של 5 ניסיונות לשעה ו-20 ליממה מאותה רשת ותקרת חשבונות (`DIARY_MAX_ACCOUNTS`, בייצור 5000). במצב המקומי אין הרשמה דרך מאזין ה-HTTPS של הגישה מרחוק (סעיף 11א).
* **התחברות** מתקבלת עם שם משתמש **או** כתובת הדוא"ל (ללא תלות באותיות גדולות/קטנות). שם המשתמש האחרון נשמר ב-localStorage ומופיע מראש, ו"זכור אותי" מסומן כברירת מחדל. **במצב המקומי בלבד** מסך ההתחברות במחשב מציג גם את החשבונות הרשומים לבחירה בלחיצה (`GET /api/auth/accounts`, זמין רק מבקשות loopback): בשרת המארח אף בקשה אינה loopback, ולכן הנתיב עונה `403` והמסך לא מבקש אותו (`ServerInfo.isLocalRequest`; `docs/API.md` "מצב מארח").
* **גזירת מפתח**: `secret = scrypt(password, salt(16B), N=2^15, r=8, p=1, 64B)`. 32 הבתים הראשונים = מפתח ה-DB. `verifier = sha256(secret[32..64])` נשמר לאימות הסיסמה. אין דרך לשחזר את הסיסמה או המפתח מה-verifier.
* **התחברות**: שם משתמש + סיסמה (+ "זכור אותי"). הודעת שגיאה זהה לשם משתמש לא קיים ולסיסמה שגויה.
* **סשן**: טוקן אקראי (32B) שנשלח ב-`Authorization: Bearer`. בשרת נשמר רק `sha256(token)`. סשן רגיל חי 12 שעות בזיכרון בלבד.
* **זכור אותי**: סשן ל-90 יום שנשמר ב-`sessions.json` יחד עם מפתח ה-DB עטוף ב-AES-GCM ב**מפתח השרת** (32B). בשרת המארח זה הסוד `DIARY_DEVICE_KEY` - סוד של Fly, לא קובץ בדיסק של השרת ולא בארכיון השרת (README סעיף 2.1; בלי הסוד השרת משתמש בקובץ `<dataDir>/device.key`); במצב המקומי - `device.key`, 32B אקראיים בקובץ בתיקיית הנתונים שבפרופיל המשתמש. כך השרת פותח את היומן בלי הסיסמה אחרי הפעלה מחדש (או אחרי פינוי מהזיכרון, למטה) - רק עם אותו מפתח: החלפת המפתח מבטלת את הסשנים הזכורים ואת איפוס הסיסמה עד הכניסה הבאה בסיסמה, אבל לא את היומנים (`docs/API.md` "מצב מארח"). הלקוח שומר את הטוקן ב-localStorage (זכור אותי) או sessionStorage.
* **Vault משותף**: כל הסשנים של אותו משתמש (בכל המכשירים) חולקים אובייקט `UserVault` אחד עם ה-DB הפתוח בזיכרון השרת. הוא נסגר (והמפתח נמחק מהזיכרון) כשהסשן האחרון מסתיים, ובשרת המארח גם כשלא הגיעה אליו בקשה במשך `DIARY_VAULT_IDLE_MINUTES` וכל הסשנים שלו "זכור אותי" - הבקשה הבאה פותחת אותו שוב במפתח העטוף.
* **נעילה אוטומטית**: אחרי X דקות ללא פעילות הממשק מציג מסך נעילה ודורש סיסמה (`/api/auth/verify-password`) - הסשן עצמו נשאר תקף, כך ש"זכור אותי" ממשיך לעבוד.
* **שינוי סיסמה**: אימות הישנה, גזירת מפתח חדש, הצפנה מחדש של היומן, עדכון ה-verifier ועטיפה מחדש של מפתחות "זכור אותי" ושל מפתח השחזור.
* **התנתקות**: מחיקת הסשן (גם מהדיסק). **מחיקת חשבון** (הכרטיס האחרון בהגדרות, `DeleteAccountSection`): אימות סיסמה, ואז - בזמן שבקשות של החשבון נדחות והיומן לא יכול להיפתח מחדש (`deleting`) - קישורי האיפוס (`resets.json`), כל הסשנים בכל המכשירים (`sessions.json` נכתב מחדש), מוני חסימת הכניסה, הרשומה ב-`accounts.json` עם מפתח השחזור, ורק אז היומן (נסגר בלי שמירה; `.mpd`, `.mpd.prev`, `.mpd.tmp`). חשבונות אחרים לא נפגעים. **כשלים**: כל כתיבה לרשומות (resets / sessions / accounts) קודמת לנגיעה ביומן, וכל מאגר כותב את הקובץ לפני שהוא משנה את הזיכרון - כתיבה שנכשלה עוצרת את המחיקה והחשבון נשאר שלם (רשומה, מפתח שחזור, יומן; אם הסשנים כבר נמחקו, היומן נסגר עם שמירה), כך שאפשר להיכנס ולמחוק שוב. מרגע שהרשומה נמחקה - החשבון נמחק: שם קובץ היומן נרשם באותה כתיבה ב-`accounts.json` תחת `pendingDeletes`, ויוצא משם אחרי שהקבצים נמחקו; קובץ שלא ניתן למחיקה באותו רגע נמחק במחיקה הבאה או בהפעלת השרת (`purgeDeletedDiaries`, שלעולם לא נוגע ביומן של חשבון קיים או בשם שאינו `<שם>.mpd` פשוט בתוך `users/`).

### 5.1 "שכחת סיסמה?" - מפתח שחזור ואיפוס במייל

הבעיה: היומן מוצפן במפתח שנגזר מהסיסמה. איפוס שרק קובע סיסמה חדשה היה משאיר את היומן הקיים בלתי קריא.

* **מפתח שחזור (key escrow)**: לכל חשבון נשמר ב-`accounts.json` השדה `recoveryWrappedKey` - מפתח היומן (32B) עטוף ב-AES-256-GCM במפתח השרת (סעיף 5, "זכור אותי"), עם AAD `mpd-recovery-key-v1:<accountId>` (כך שאי אפשר לבלבל אותו עם עטיפת "זכור אותי" או להעביר אותו לחשבון אחר), ב-base64. הוא נוצר בהרשמה, מוודא (ונעטף מחדש אם חסר או לא תואם) בכל התחברות ובכל פתיחת יומן בסשן "זכור אותי", ומתעדכן אחרי שינוי סיסמה ואחרי איפוס. חשבונות קיימים מקבלים אותו בהתחברות הבאה שלהם; עד אז בקשת איפוס שולחת לכתובת החשבון רק הסבר בלי קישור וקוד (`resetUnavailableEmail`: "יש להתחבר פעם אחת עם הסיסמה").
* **המחיר (trade-off)**: מי שמחזיק גם את מפתח השרת וגם את `accounts.json` + `users/<id>.mpd` יכול לפתוח את היומן בלי הסיסמה - **אותה חשיפה כמו "זכור אותי"**, שכבר שומר את המפתח עטוף במפתח השרת. בשרת המארח אלה מי ששולט בשרת ובסודות שלו - המפעיל, ועקרונית גם ספק האירוח (README סעיף 2.1; כך כתוב גם במדיניות הפרטיות); במצב המקומי - מי שיש לו גישה מלאה לקבצים במחשב. ההגנה העיקרית שנשארת: קובץ `.mpd` שהועתק לבדו (או גיבוי) לא נקרא בלי הסיסמה, וגם עותק של כל קובצי הנתונים בלי המפתח לא פותח כלום - בשרת המארח המפתח הוא סוד של Fly, שאינו בדיסק ואינו בארכיון השרת, ובמצב המקומי `device.key` לא יוצא מהמחשב.
  * **הבהרה למצב המקומי (סקירת אבטחה 2026-09-30)**: החשיפה רחבה מ"זכור אותי": מפתח השחזור נשמר **לכל** חשבון, גם כשאיפוס במייל לא הוגדר, ו-`device.key` הוא קובץ רגיל (ההרשאה `0o600` לא משפיעה ב-Windows; אין DPAPI). לכן כל תהליך שרץ בשם אותו משתמש Windows, כל חשבון אחר באותו משתמש Windows וכל העתק של `%APPDATA%\com.mydiary.app` (כולל `device.key`) יכולים לפענח את כל היומנים. חשבונות שחולקים משתמש Windows אחד אינם מבודדים זה מזה. כיווני תיקון (לא יושמו - החלטת עיצוב): הגנה על `device.key` ב-DPAPI דרך המעטפת, ומפתח שחזור רק כשאיפוס במייל מופעל.
* **נעילה בשרת**: מסך הנעילה נועל גם את הסשן בשרת (`POST /api/auth/lock`, `Session.locked`, נשמר עם סשן "זכור אותי"): עד שהסיסמה מוזנת (`verify-password`) נתיבי הנתונים עונים `423 LOCKED`, כך שרענון הדף או הטוקן לבדו לא חושפים דבר.
* **אישור בסיסמה**: שינוי סיסמה, שינוי כתובת המייל (שאליה נשלחים קישורי האיפוס), מחיקת חשבון, פתיחת נעילה וכרטיסי הבעלים דורשים את הסיסמה, ו-10 שגיאות ברצף נועלות את האישורים של החשבון ל-15 דקות. שינוי סיסמה מנתק את כל שאר הסשנים.
* **איפוס** (`server/src/security/password-reset.ts`, `resets.ts`): `POST /api/auth/forgot-password` עונה תמיד אותה תשובה, וכל העבודה שתלויה בחשבון רצה אחרי התשובה ואחרי השהיה אקראית (0.2-1.2 שניות), כדי שגם העומס הקצר שהיא יוצרת לא יסגיר כתובת רשומה; עבור כתובת רשומה עם מפתח שחזור נוצרים טוקן (32B אקראיים, נשמר רק sha256) וקוד בן 6 ספרות (נשמר רק גיבוב ממולח) ב-`<dataDir>/resets.json` - 30 דקות, שימוש יחיד, עד 3 חיים לחשבון, 5 קודים שגויים מבטלים - ונשלח מייל בשפת החשבון. `POST /api/auth/reset-password` צורך את הטוקן/הקוד, פותח את מפתח היומן ממפתח השחזור, ומריץ את מסלול שינוי הסיסמה: salt חדש, מפתח חדש מהסיסמה החדשה, הצפנה מחדש (`vault.rekey`), verifier ומפתח שחזור חדשים. אחר כך **כל הסשנים של החשבון מנותקים**, הנעילות מתאפסות ונשלח מייל "הסיסמה שונתה". **אותן רשומות** נשארות ביומן.
* הקישור במייל: `<בסיס>/#/reset-password?token=...`, והקוד עובד מכל מכשיר. בשרת המארח הבסיס הוא `DIARY_PUBLIC_URL` - בייצור `https://yourpersonaldiary.fly.dev`, גם כשמוגדר דומיין נוסף ב-`DIARY_EXTRA_HOSTS` (`remoteStub` ב-`server/src/hosted.ts` מזין אותו ל-`resetLinkBase` ב-`server/src/routes/auth.ts`). במצב המקומי: `https://<שם הגישה מרחוק>` כשהגישה מרחוק פעילה, אחרת `http://127.0.0.1:<port>` (נפתח במחשב עצמו); שם האיפוס עובד גם מכתובת ה-HTTPS (הקישור מוכיח גישה למייל), אבל הרשמה מהאינטרנט חסומה (סעיף 11א) - בשרת המארח, להפך, ההרשמה מהאינטרנט היא הדרך הרגילה (סעיף 5).

## 6. פורמט הקובץ המוצפן (`.mpd`)

משמש גם ליומן וגם לקובץ הגיבוי.

| היסט | גודל | שדה |
|---|---|---|
| 0 | 8 | magic `MPDIARY\x01` |
| 8 | 1 | version = 1 |
| 9 | 4 | scrypt N (LE u32) |
| 13 | 4 | scrypt r (LE u32) |
| 17 | 4 | scrypt p (LE u32) |
| 21 | 16 | salt |
| 37 | 12 | nonce (אקראי לכל כתיבה) |
| 49 | ... | AES-256-GCM ciphertext ‖ tag (16B) |

* AAD = 49 בתי הכותרת. ה-plaintext הוא תמונת SQLite גולמית (`db.export()`).
* כתיבה אטומית: `users/<id>.mpd.tmp` → `fsync` → `rename` ל-`.mpd`; הגרסה הקודמת נשמרת כ-`.mpd.prev`.
* שמירה מתבצעת אחרי כל בקשה משנה (debounce קצר של 250ms כדי לאחד כתיבות רצופות).
* גיבוי = אותו פורמט, עם סיסמת החשבון או סיסמה אחרת שהמשתמש בוחר. שחזור = פענוח בסיסמת הגיבוי, בדיקת `integrity_check`, החלפת היומן ושמירה מחדש במפתח החשבון.

## 7. סכמת מסד הנתונים

ראו `server/src/db/schema.ts`: `entries` (רשומות, רשימות כ-JSON), `habits`, `habit_logs` (ייחודי לפי הרגל+תאריך), `settings`, `meta`, `schema_version`. מיגרציות ממוספרות ומופעלות בכל פתיחה.

## 8. מנוע הניתוח

### 8.1 מבנה
1. `db/dataset.ts` בונה `DayRecord` לכל יום עם נתונים: ממוצעי מצב רוח/אנרגיה/לחץ, שינה, פעילות, רגשות, תגיות, ערכי הרגלים.
2. כל **גלאי** (`analysis/detectors/*.ts`) מקבל את ה-`Dataset` ומחזיר `Insight[]`. גלאים:
   * `sleep-mood`, `sleep-energy` - ימים עם פחות מ-6 שעות שינה לעומת השאר, ומתאם פירסון.
   * `exercise-energy`, `exercise-mood` - ימים עם/בלי פעילות.
   * `habit-mood` - לכל הרגל: ימים שהושלם לעומת לא; להרגלים שבועיים - שבועות עם ≥ יעד לעומת פחות.
   * `weekday` - יום בשבוע עם לחץ/מצב רוח שונה מהממוצע.
   * `time-of-day` - חלון השעות שבו מצב הרוח המדווח הוא הגבוה ביותר.
   * `trends` - מגמות שבועיות/חודשיות (שיפוע רגרסיה על ממוצע נע 7 ימים) למצב רוח, לחץ, שינה.
   * `period-compare` - החודש הנוכחי לעומת הקודם.
   * `habits-trend` - הרגלים שהשתפרו/נחלשו (שיעור השלמה בשבועיים אחרונים לעומת הקודמים).
   * `best-worst-days` - ימים טובים/קשים במיוחד (ציון משולב).
   * `streaks` - רצפי כתיבה והשלמת הרגלים.
   * `anomalies` - ימים עם z-score > 2.
   * `emotion-pattern` - רגשות שחוזרים בימים מסוימים / עם אנשים ומקומות.
3. `analysis/engine.ts` מריץ את הגלאים דרך `AnalysisProvider` (ממשק). היום יש `RulesProvider`; בעתיד אפשר להוסיף `LocalModelProvider` שיקבל את אותו `Dataset` ויחזיר `Insight[]` - בלי לשנות את הממשק או את ה-API.

### 8.2 ספים ועוצמה (`shared/constants.ts` → `ANALYSIS`)
* קשר בין שני משתנים מוצג רק עם ≥14 ימים עם שני הערכים ו-≥5 ימים בכל קבוצה.
* עוצמה: **חלש** |r| ≥ 0.2 או הפרש ≥ 0.5 נק'; **בינוני** |r| ≥ 0.35 או הפרש ≥ 1.0; **חזק** |r| ≥ 0.5 או הפרש ≥ 1.5.
* מתחת לסף - התובנה לא מוצגת, ובמקומה הערה "אין מספיק נתונים כדי לבדוק...".
* ניסוח: תמיד "נראה שבנתונים שלך...", "קיים קשר אפשרי בין...". אסור "X גורם ל-Y".
* שקיפות: `explanation` מכיל את המספרים: "בדקתי 43 ימים. ב-17 ימים ביצעת פעילות גופנית. מצב הרוח הממוצע בימים האלה היה 8.1, לעומת 6.9 בשאר הימים."

## 9. חיפוש חכם

`search/parser.ts` מנתח שאלה בעברית בקוד השרת עצמו, לפי כללים - בלי מודל AI ובלי שירות חיצוני (ולכן החיפוש דורש חיבור לשרת):
* **כוונה**: "הכי טוב/טוב ביותר" → `best_days`; "הכי גרוע/קשה" → `worst_days`; "מתי כתבתי ש..." → `text_mention`; "איך השתנה..." → `trend_summary`; "באילו ימים ... פחות מ-N" → `metric_filter`; "הרגשתי עייף" → `emotion_days` (דרך קטלוג הרגשות והכינויים).
* **מדד**: מצב רוח / אנרגיה / לחץ / שינה / פעילות. **השוואה**: פחות מ, יותר מ, לפחות, עד. **מספרים** בספרות או במילים (חמש, שש...).
* **תקופה**: "בחודש האחרון", "בשבוע האחרון", "בשלושת החודשים האחרונים", "השנה", "אתמול", חודש בשם ("ביולי"), טווח מפורש.
* `executor.ts` מריץ את השאילתה על ה-Dataset/DB ומחזיר תשובה בעברית + רשומות/ימים/סדרה רלוונטיים, ואת "כך הבנתי את השאלה".

## 9א. לוחות שנה וחגים (`shared/calendars`)

* `hebrew.ts` - המרה לתאריך עברי דרך `Intl.DateTimeFormat('en-u-ca-hebrew')`, מספור עברי (י״ד, תשפ״ז) ועיצוב.
* `hijri.ts` - המרה לתאריך הג׳רי דרך `islamic-umalqura` (נסיגה ל-`islamic-civil` כשאינו נתמך).
* `easter.ts` - נוסחת הפסחא הגרגוריאנית והיוליאנית (אורתודוקסית).
* `holidays/{jewish,muslim,christian,druze}.ts` - טבלאות חגים על גבי התאריכים הדתיים, כולל כללי דחייה ישראליים (יום העצמאות, יום השואה, צומות בשבת).
* `holidays/index.ts` - `holidaysOn`, `holidaysInRange`, `holidaysByDate`, `describeDay` (משפט לקורא מסך), עם memoisation לפי שנה.
* הכול טהור, ללא תלויות, רץ בשרת (Node) ובממשק (WebView2/דפדפן). ההעדפות (`AppSettings.calendarExtras`) נשמרות במסד הנתונים המוצפן של המשתמש ומאומתות בשרת.

## 10. ממשק ונגישות

* `html lang="he" dir="rtl"`, גופן מערכת (Segoe UI), ניגודיות AA לפחות, ערכת "ניגודיות גבוהה".
* מבנה כל עמוד: `<header>` (תאריך היום, כפתור "חזרה" בצד ימין, שלום {שם}) → `<nav aria-label="ניווט ראשי">` → `<main>` עם `<h1>` אחד שמקבל פוקוס אחרי ניווט.
* קישור "דלג לתוכן" ראשון ב-Tab.
* **שפת הפתיחה** (`detectLocale` / `resolveStartupLocale` ב-`src/i18n/runtime.ts`; אין מסך בחירת שפה באף פלטפורמה - `docs/android-tasks/HOSTED-IMPL.md` סעיף 13): שפת החשבון המחובר ← שפה שנבחרה במכשיר (הגדרות ← שפה, `mpd.language`) ← שפת המתקין (Windows בלבד) ← שפות המערכת / הדפדפן (אפליקציית Android וממשק הווב בלבד) ← אנגלית. באפליקציית Android אלה שפות הטלפון: ה-WebView ממלא את `navigator.languages` מ-`LocaleList.getDefault()` - רשימת השפות של הגדרות ← מערכת ← שפות, לפי הסדר (Android 7 ומעלה, ‏minSdk 24; ‏Capacitor מסרב ל-WebView מתחת לגרסה 60) - ולכן אין קריאה נייטיבית. השפה נקבעת באופן סינכרוני כשהמודול נטען, לפני הרינדור הראשון, ו-`<html lang/dir>` מוחלים באותו commit של המסך הראשון (`LanguageProvider`, ‏`useLayoutEffect`) - בלי הבזק משמאל-לימין בעברית ובערבית. שפה שזוהתה אינה נשמרת: `mpd.language` נכתב רק לבחירה בהגדרות, לשפת המתקין, וב-Windows ובממשק הווב גם לשפת חשבון ששונה מזו שעל המסך (כדי שסשן "זכור אותי" ייפתח בה). באפליקציית Android שפת החשבון נשמרת בנפרד (`mpd.language.session`): היא קודמת לבחירת המכשיר בהפעלה של סשן זכור, ונמחקת כשהמכשיר מתנתק (יציאה, סשן שפג, או הפעלה בלי סשן) - אז חוזרים, עוד לפני הציור הראשון, לשפה שנבחרה בהגדרות ובהיעדרה לשפת הטלפון. לכן כל עוד לא נבחרה שפה, שינוי שפת הטלפון נקלט בהפעלה הבאה - גם אחרי יציאה מחשבון בשפה אחרת. אפליקציית Windows לא מתייעצת בשפת Windows / WebView2: גרסת ה-MSIX נפתחת באנגלית. בדיקות: `src/i18n/startup-language.test.tsx` (Android, ‏Windows, ווב).
* **קריאת תגי שפה** (`negotiateLocale` / `localeFromTag` ב-`shared/i18n/locales.ts`; גם השרת משתמש בה ל-`Accept-Language`): השפה הראשונה ברשימה שהאפליקציה תומכת בה מנצחת. האזור לא משנה (`pt-BR`, `es-419`, `fr-CA` → pt / es / fr), אותיות גדולות או קטנות ו-`_` במקום `-` מתקבלים, קודים ישנים מתעדכנים (`iw` → he; ‏`in` → אינדונזית, שאינה מ-20 השפות, ולכן ממשיכים לשפה הבאה), ובלי אף התאמה - אנגלית. **סינית מסורתית** (`zh-TW`, ‏`zh-HK`, ‏`zh-MO`, ‏`zh-Hant-*`; ה-WebView של Android משמיט את ה-script, ולכן האזור הוא שמזהה אותה) מקבלת את הקטלוג הסיני היחיד של האפליקציה, שכתוב בסינית מפושטת (`zh`), ולא אנגלית: זו שפת המשתמש, קוראי סינית מסורתית קוראים מפושטת הרבה יותר בקלות מאנגלית, ההגדרות ← שפה מאפשרות להחליף, וכך עבדו ממשק הווב והשרת גם קודם. אם יתווסף קטלוג מסורתי, ממפים אליו את `Hant` בטבלה `CHINESE_CATALOGUE_BY_SCRIPT`.
* אזור `aria-live="polite"` גלובלי להודעות סטטוס ("הרשומה נשמרה"), ו-`assertive` לשגיאות.
* דיאלוגים ב-`<dialog>` עם `showModal()` (מלכודת פוקוס מובנית, Escape סוגר, החזרת פוקוס).
* לכל שדה `label`; שגיאות ב-`aria-describedby` + `aria-invalid`; קבוצות רדיו/צ'קבוקס ב-`fieldset/legend`.
* דירוג 1-10 = `input type="range"` עם `aria-valuetext` ("7 מתוך 10") **וגם** שדה מספר; רגשות = צ'קבוקסים.
* גרפים: SVG עם `role="img"` + `aria-label` מסכם, ולידם כפתור "הצג כטבלה" עם `<table>` אמיתית. אף מידע לא מועבר בצבע בלבד (גם טקסט/סמל).
* קיצורי מקלדת: `Alt+1..0` ניווט לפי סדר התפריט, `Ctrl+N` רשומה חדשה, `Ctrl+K` חיפוש, `Ctrl+L` נעילה, `Ctrl+S` שמירה בטופס, `Alt+←` חזרה, `Shift+?` רשימת קיצורים. כולם מתועדים בדיאלוג "קיצורי מקלדת". באפליקציית ה-Mac התוויות הן ⌘/⌥/⇧ (`src/utils/platform-keys.ts`); בכל Mac (אפליקציה או דפדפן) בשדה טקסט Option+ספרה, Option+← ו-Control הפיזי נשארים ל-macOS (`isTextEntryTarget` / `macTextField` ב-`src/hooks/useKeyboardShortcuts.ts`), ובכל פלטפורמה Alt + ספרה מהמקלדת הנומרית בתוך שדה הוא קוד Alt של Windows ולא קיצור (`altCodeInField`).
* סדר Tab הגיוני, ללא `tabindex` חיוביים.

## 11. פרטיות ורשת

* **CSP** בחלון ה-Desktop (`src-tauri/tauri.conf.json`): `connect-src 'self' https://<שרת Your Personal Diary> ipc: http://ipc.localhost` - מקור אחד קבוע (אותה כתובת כמו ב-`src/config/server-default.json`; בדיקת Rust ב-`lib.rs` משווה ביניהם), בלי `127.0.0.1`/`localhost` ובלי תווים כלליים - אין אפשרות טכנית לפנות מהממשק לשום יעד אחר. קובץ העל של המצב המקומי מחזיר את `http://127.0.0.1:* http://localhost:*` ומסיר את מקור השרת.
* **מגן רשת** ב-`src/api/client.ts`: כש"מצב פרטיות לא מקוון" מופעל (ברירת מחדל), `fetch`/`XMLHttpRequest`/`WebSocket` נחסמים לכל יעד שאינו שרת היומן (`DEFAULT_SERVER_URL` באפליקציות המופצות, השרת המקומי במצב המקומי).
* **השרת** לא כולל שום ספריית לקוח HTTP ולא יוצר חיבורים יוצאים - מלבד מודול הגישה מרחוק (`server/src/remote/`, סעיף 11א; במצב המקומי בלבד - הוא לא נכנס לבאנדל של השרת המארח) ולקוח ה-SMTP לאיפוס סיסמה (`server/src/mail/`, סעיף 11ב), שפועלים רק כשהבעלים הפעיל אותם. `scripts/check-no-network.mjs` סורק את הקוד ואת התלויות ומכשיל בנייה אם מופיע קוד רשת יוצא; החריגים היחידים שהוא מתיר: `server/src/remote/**`, ורק אל `www.duckdns.org`, `acme-v02.api.letsencrypt.org`, `acme-staging-v02.api.letsencrypt.org` ואל הנתב ברשת הביתית; ו-`server/src/mail/**`, רק `node:net`/`node:tls` (בלי HTTP, DNS, UDP או כתובות URL) אל שרת ה-SMTP שהבעלים הגדיר.
* **גישה מהטלפון** (`lanEnabled`; במצב המקומי בלבד - באפליקציות המופצות הטלפון הוא אפליקציית Android או האתר, מול השרת המארח): מאזין נוסף על `0.0.0.0` נפתח רק כשהמשתמש מפעיל זאת בכרטיס "פרטיות" בהגדרות, במחשב. Windows Firewall יבקש אישור בפעם הראשונה. כשכבוי - כל בקשה מכתובת שאינה loopback נדחית ב-403.
* כרטיס "פרטיות" בהגדרות (`src/pages/settings/PrivacySection.tsx`) מציג משפט הרגעה אחד, את הקישור למדיניות הפרטיות ואת המתג "מצב פרטיות לא מקוון". עם שרת Your Personal Diary הוא מציג גם את כתובת השרת לקריאה בלבד; במצב המקומי - גם את המתג "גישה מהטלפון ברשת הביתית", ומיד אחריו כרטיס "גישה מרחוק".

## 11א. גישה מרחוק (`server/src/remote`, `RemoteAccessSection`)

מטרה: לפתוח את היומן מכל מקום (טלפון, מחשב אחר) ולראות הכול - **בלי ענן**. היומן נשאר במחשב; השרת המקומי נעשה נגיש בכתובת ה-DuckDNS של הבעלים (למשל `yourpersonaldiary.duckdns.org`) ב-HTTPS. אופציונלי וכבוי כברירת מחדל; כשכבוי, התוכנה שומרת על ההבטחה "אין חיבורים יוצאים".

**הגדרות** - `ServerSettings.remote` ב-`server-settings.json`: `enabled`, `hostname`, `publicPort` (ברירת מחדל 443), `upnp` (ברירת מחדל true), `staging` (Let's Encrypt staging, לבדיקות) ו-token של DuckDNS **מוצפן במפתח המכשיר**. ה-API לא מחזיר את ה-token לעולם - רק `tokenSet`.

**מודולים בשרת** (`server/src/remote/`, רק מודולים מובנים של Node - `node:crypto`, `node:https`, `node:http` (לנתב ברשת הביתית), `node:dgram`, `node:dns`, `node:net` - בלי תלויות חדשות):

| קובץ | תפקיד |
| --- | --- |
| `manager.ts` | תזמור: הפעלה/כיבוי/מצב/חידוש, ארבעת השלבים `duckdns → certificate → listener → upnp` עם סטטוס מתורגם לכל שלב (`messageKey` + `params`), עדכון IP כל 5 דקות, בדיקת תעודה יומית (חידוש מתחת ל-30 יום), רענון UPnP כל שעה, ניסיונות חוזרים בהשהיה גדלה, חידוש אחרי הפעלה מחדש של השרת. שום סוד לא נכתב ללוג |
| `duckdns.ts` | `updateIp` / `setTxt` / `clearTxt` מול `https://www.duckdns.org/update` (תשובה `OK`/`KO`) |
| `acme.ts`, `csr.ts`, `der.ts` | לקוח ACME v2 מינימלי: מפתח חשבון EC P-256 (JWS ES256), nonce, `newAccount`, `newOrder`, אתגר dns-01 (ערך TXT = base64url(sha256(keyAuthorization)) דרך DuckDNS), `finalize` עם CSR שנבנה ב-DER ידנית (CN + subjectAltName, ecdsa-with-SHA256), הורדת שרשרת PEM |
| `dns-check.ts` | המתנה לפרסום רשומת ה-TXT (שאילתות לשרתי השמות של DuckDNS, עד כשתי דקות) ובדיקת DNS של השם |
| `tls-store.ts` | `<dataDir>/tls/`: `account.key`, `cert.key`, `cert.pem`, `cert.json` (הרשאות לבעלים בלבד) |
| `tls.ts` | `https.Server` על `0.0.0.0:<publicPort>` (8443 אם הפורט לא נפתח) שמגיש את אותה אפליקציית Express, עם HSTS (שנה), `X-Content-Type-Options`, `frame-ancestors 'none'` וטעינה חמה של תעודה מחודשת. מאזין ה-HTTP המקומי/LAN נשאר כמו שהוא |
| `upnp.ts` | SSDP (`239.255.255.250:1900`, M-SEARCH ל-WANIPConnection/WANPPPConnection/IGD:2), תיאור ההתקן, SOAP `AddPortMapping` / `DeletePortMapping` / `GetExternalIPAddress`. כשלון = "נדרשת העברת פורט ידנית" |

**הקשחה לחשיפה לאינטרנט**: בדיקת Host (כשהגישה מרחוק מופעלת, Host שאינו השם, כתובת LAN או localhost נענה ב-421), נעילת חשבון אחרי 10 כשלונות כניסה ל-15 דקות (הודעה מתורגמת; מונה נפרד להתחברויות מהרשת, כך שהמחשב עצמו לעולם לא ננעל מבחוץ), אין הרשמה דרך מאזין ה-HTTPS מהאינטרנט (`server.remote.registerRemote`), תעודה שפג תוקפה סוגרת את ה-HTTPS מיד, לקוח ה-ACME לא יוצא מה-origin של ה-directory, עצירת השרת מסירה את מיפוי הפורט בנתב, הגבלת הקצב הקיימת, רשימת החשבונות (`GET /api/auth/accounts`) ונתיבי `/api/server/remote*` זמינים מ-loopback בלבד, כותרות אבטחה, ובאנר ב-`server.log` בעלייה כשהגישה מרחוק מופעלת.

**API** (docs/API.md): `GET /api/server/remote` → `RemoteStatus`; `PUT /api/server/remote` (`RemoteSettingsUpdate`) מפעיל/מכבה ומחזיר `RemoteStatus`; `POST /api/server/remote/renew` מאלץ חידוש; `POST /api/server/remote/test` מריץ עדכון DuckDNS + חיפוש UPnP + בדיקת DNS ומחזיר `RemoteTestResult`. הטיפוסים ב-`shared/types.ts`.

**בעלות** (`server/src/security/owner.ts`; משותף לגישה מרחוק ולשליחת מייל, 11ב):

* הבעלים הוא **החשבון הראשון שנוצר במחשב** (`createdAt` המוקדם ביותר ב-`accounts.json`, בתיקו - המזהה הנמוך), קבוע מההתחלה - עוד לפני שמשהו הוגדר. רק הוא עובר את השער של `/api/server/remote*` ו-`/api/server/mail*` (`routes/server.ts`: `ownerGate` / `mailGate`); כל חשבון אחר מקבל `403` (`server.remote.notOwner` / `server.mail.notOwner`), גם בשמירה ראשונה. הבדיקה חוזרת ברגע הכתיבה (`RemoteManager.update` בתוך `exclusive`, `MailService.update`).
* כל שמירה כותבת את השומר ל-`ownerUserId`, ו**בעלים שמור גובר**: `owner = ownerUserId || firstAccountId(accounts)`. כך הגדרות שנשמרו בגרסה קודמת על ידי חשבון אחר נשארות שלו (בהפעלה: `checkOwner()` כותב שורת הודעה אחת ללוג). הגדרות קיימות בלי `ownerUserId` נרשמות על שם החשבון הראשון (`pinOwner`) - בהפעלה, ואם השרת עלה בלי חשבונות: מיד אחרי ההרשמה הראשונה, ובכל מקרה שוב לפני כל `delete-account` (`pinUnownedSettings` ב-`routes/server.ts`; כישלון כאן = `500` ושום דבר לא נמחק). בלי זה החשבון הראשון היה הבעלים רק במשתמע (`'' || first`), `releaseOwner` (שמשחרר רק בעלים **שמור**) לא היה מוחק כלום, והחשבון הוותיק הבא היה יורש את האסימון / סיסמת ה-SMTP. `ownerUserId` שקיים בקובץ אבל אינו מזהה חשבון נקרא כ-`UNREADABLE_OWNER` (`readStoredOwner`), שלעולם לא תואם חשבון - ולכן משוחרר בהפעלה כמו בעלים שנמחק, במקום להיחשב "בלי בעלים" ולעבור לחשבון הראשון.
* **מחיקת הבעלים**: `POST /api/auth/delete-account` קורא ל-`releaseOwner` - ההגדרות נמחקות (כולל `ownerUserId`) ורק אז `firstAccountId` מחזיר את החשבון הוותיק הבא. `ownerUserId` של חשבון שאינו קיים עוד (שחרור שנכשל, מחיקה מחוץ לתוכנה) חוסם את כולם, גם בכתיבה, עד שהוא משוחרר - בהפעלת השרת או בבקשת `/remote*` / `/mail*` הבאה מהמחשב.
* **ממשק**: `GET /api/server/settings` מחזיר `isRemoteOwner` / `isMailOwner` (אופציונליים, תואם לאחור); `src/pages/settings/useOwnerCard.ts` מציג את כרטיסי "גישה מרחוק" ו"דואר אלקטרוני" רק כשהדגל `true` (ובשרת שלא מחזיר דגל - לפי ה-`403` של הכרטיס עצמו), כך שחשבון אחר לא רואה אותם אפילו לרגע.
* ההגנות האחרות לא השתנו: מ-loopback בלבד (גם הבעלים מקבל `403` מהרשת הביתית או מהאינטרנט), וכל `PUT` דורש את סיסמת החשבון.

**ממשק** - `src/pages/settings/RemoteAccessSection.tsx`, כרטיס מיד אחרי "פרטיות", מוצג רק כש-`server.info().isLocalRequest` (במחשב עצמו):

* מתג "אפשר גישה מהאינטרנט"; שדות: שם DuckDNS (ממולא מראש `yourpersonaldiary.duckdns.org`, מנורמל ומאומת `*.duckdns.org`), token (שדה סיסמה עם "הצג אסימון", כתיבה בלבד - "אסימון כבר שמור"), פורט בנתב, "פתח את הפורט בנתב אוטומטית (UPnP)"; "שמור פרטים", "בדוק חיבור" (כשמופעל).
* רשימת השלבים / תוצאות הבדיקה: סמל צורה (✓ ✗ … ○ ⚠ –) + שם השלב + המצב במילים + ההודעה מהשרת (`tr(messageKey, params)`) - אף פעם לא צבע בלבד. בזמן `busy` הכרטיס מושך את המצב כל 2.5 שניות (וכל 30 שניות כשמופעל), ומכריז בסיום "מוכן: <כתובת>" או את השגיאה.
* התעודה (תוקף, ימים שנותרו, מנפיק) + "חדש תעודה"; הכתובת עם כפתור העתקה ו**קוד QR** כ-SVG מוטבע (`src/utils/qr.ts`: מקודד QR ללא תלות - מצב byte, רמת תיקון M, גרסאות 1-10, Reed-Solomon על GF(256), בחירת מסכה לפי ניקוד העונשין); הוראות (כולל העברת פורט ידנית עם כתובת ה-LAN והפורט בפועל) והערת פרטיות.
* **יחסי הגומלין עם "מצב פרטיות לא מקוון"**: הדלקת הגישה מרחוק מכבה את המצב (`settings.update({ offlinePrivacyMode: false })` + `setOfflinePrivacyMode(false)`, מוכרז); הדלקת המצב בזמן שהגישה מרחוק פועלת פותחת דיאלוג אישור ואז מכבה את הגישה מרחוק. המצב האחרון משותף בין שני הכרטיסים דרך `src/pages/settings/remoteAccessStore.ts`.
* המחרוזות: `settings.remote.*` (ממשק) ו-`server.remote.*` (הודעות השלבים מהשרת) בקטלוגים.

בטלפון/בדפדפן אין מה להגדיר: אותו ממשק מוגש מאותו מקור (same origin) ב-HTTPS.

## 11ב. שליחת מייל לאיפוס סיסמה (`server/src/mail`, `MailSection`)

מטרה: "שכחת סיסמה?" במסך ההתחברות (סעיף 5.1) - התוכנה שולחת קישור + קוד לכתובת שהמשתמש נרשם איתה. השליחה עוברת דרך חשבון מייל של הבעלים (למשל כתובת Gmail שנפתחה לתוכנה). אופציונלי וכבוי כברירת מחדל.

* **הגדרות** - `server-settings.json` → `mail`: `enabled`, `host` (ברירת מחדל `smtp.gmail.com`), `port` (465), `security` (`tls` = SSL/TLS מובלע, `starttls` = פורט 587), `username`, `passwordEnc` (סיסמת ה-SMTP מוצפנת ב-AES-256-GCM במפתח השרת - סעיף 5, "זכור אותי" - עם AAD משלה), `fromAddress`, `ownerUserId`. בעלות וסיסמת חשבון בכל שמירה - במצב המקומי בדיוק כמו בגישה מרחוק (סעיף 11א "בעלות": הבעלים הוא החשבון הראשון שנוצר במחשב, או בעלים שמור מגרסה קודמת; לאחרים 403, גם בשמירה ראשונה). ה-API מחזיר רק `smtpPasswordSet` ולעולם לא את הסיסמה; היא לא נכתבת ללוג.
* **בשרת המארח** הבעלים של כרטיס המייל הוא `DIARY_OWNER_ID` בלבד - אין "החשבון הראשון" ואין ירושה: מחיקת חשבון הבעלים מוחקת את הגדרות המייל (והסיסמה) ולא מקדמת אף חשבון, ועד שהמפעיל מגדיר שוב את `DIARY_OWNER_ID` לחשבון קיים כרטיסי הבעלים (מייל, "שרת") כבויים לכולם (`server/src/hosted/owner.ts`; `docs/API.md` "מצב מארח" ← "בעלות"). דיאלוג "מחיקת חשבון" אומר זאת לבעלים (`settings.deleteAccount.ownerHosted`).
* **Gmail**: סיסמת החשבון הרגילה לא עובדת ב-SMTP. נדרשים אימות דו-שלבי + **סיסמת אפליקציה** (16 אותיות). הבעלים מזין אותה בעצמו בכרטיס "דואר אלקטרוני לאיפוס סיסמה" בהגדרות; הרווחים שבתצוגה של Google מוסרים.
* **לקוח SMTP** (`node-transport.ts` - המודול היחיד של קוד המייל שפותח sockets, רק `node:net` + `node:tls`; השירות פונה אליו דרך הממשק `SmtpTransport` שב-`transport.ts`, והכשלים הם `SmtpError` מ-`errors.ts`; `env-overrides.ts` מפנה את החיבור לשרת דואר מדומה על loopback בבדיקות): TLS מובלע או STARTTLS (חובה - בלי STARTTLS לא נשלחת סיסמה; תשובה שהוזרקה לפני ה-handshake מפילה את החיבור), EHLO, AUTH PLAIN/LOGIN, MAIL/RCPT/DATA עם dot-stuffing, QUIT; אימות תעודה תמיד פעיל (TLS 1.2+, שם השרת); 20 שניות timeout לכל שלב; שגיאות כמפתחות קטלוג (`server.mail.error.*`) עם פרמטרים בלבד (שרת, פורט, קוד SMTP) - אף פעם לא הסיסמה או טקסט התשובה.
* **MIME** (`mime.ts`): UTF-8, נושא ב-RFC 2047 (encoded-words עד 75 תווים שלא חותכים תו), `multipart/alternative` (טקסט + HTML פשוט עם `lang`/`dir` של השפה), base64 בשורות של 76, `Date`, `Message-ID`, `Auto-Submitted`, שולח `"Your Personal Diary" <from>`. כתובות נבדקות לפני שהן נכנסות לכותרת (אין הזרקת כותרות).
* **תבניות** (`templates.ts`, מפתחות `server.email.*`): מייל איפוס (ברכה בשם הפרטי, קישור, קוד, תוקף, "אם לא ביקשת - התעלם"), הודעת "הסיסמה שונתה", מייל בדיקה. בשפת החשבון.
* **רשת**: חיבור יוצא רק אל שרת ה-SMTP שהוגדר, רק כשהשליחה מופעלת ונשלח מייל (איפוס, הודעה או "שליחת מייל בדיקה"). `scripts/check-no-network.mjs` מתיר ב-`server/src/mail/**` רק `node:net`/`node:tls`.
* **ממשק**: `src/pages/settings/MailSection.tsx` (בעלים בלבד, נעול אחרי ההגדרה, עריכה בסיסמת החשבון - כמו `RemoteAccessSection`), `ForgotPasswordPage` / `ResetPasswordPage` (נתיבים ציבוריים `/forgot-password`, `/reset-password`).

## 11ג. עבודה בלי חיבור (`src/offline`, `/api/sync`, WP-H10)

התכנון המחייב הוא [`docs/android-tasks/OFFLINE-DESIGN.md`](docs/android-tasks/OFFLINE-DESIGN.md); החוזה בין השרת ללקוח הוא `shared/sync.ts` (מתועד ב-`docs/API.md` ← "סנכרון לא מקוון"). מימוש אחד ב-`src/` לשלוש הפלטפורמות; מה שכל פלטפורמה מוסיפה עובר דרך "תפרים" (`src/offline/seams.ts`).

**הזרימה.** הקבוצות `entries`, `habits`, `settings`, `calendar` ו-`insights.home` ב-`src/api/index.ts` עטופות ב-`offlineAware` (`src/offline/facade.ts`) בלי לשנות חתימה. כל עוד המנוע לא "חמוש" (מצב מקומי, שרת בלי `ServerInfo.offlineSync`, אורח, בדיקות הדפים) כל קריאה עוברת ישר לפונקציה הרגילה. כשהוא חמוש:
* **כתיבה** (יצירה/עריכה/מחיקה של רשומה; יצירה/עריכה/ארכוב של הרגל; רישום ומחיקת רישום; הגדרות) נבנית כפעולת `SyncOp` שה-`base` שלה הוא הגרסה שהמכשיר הציג, נכתבת לתור (`outbox`) בטרנזקציה אחת עם `durability: 'strict'`, והמשחזר (`replayer.ts`) מתבקש לשלוח. אם השרת עונה תוך 2 שניות - הדף מקבל את הרשומה מהשרת, כמו היום; אחרת (או כשידוע שאין חיבור) - רשומה אופטימית (יצירה מקבלת מזהה שלילי ממונה שמור), וההודעה "נשמר במכשיר".
* **קריאה** מרשימת היתר (הגדרות, הרגלים, התקדמות, בית, חודש/טווח בלוח השנה, רשימות ורשומות, יום, תגיות/אנשים/מקומות) עוברת לשרת עם מגבלת זמן של 10 שניות ונכתבת למטמון; מהכישלון הראשון היא נענית מהמטמון. בשני המקרים מונחת עליה **שכבת-על** (`overlay/*`, פונקציות טהורות): הפעולות שעוד בתור, ורשומות היומן (`journal`) שאושרו אחרי שהתצוגה נשמרה. תצוגה שמעולם לא נשמרה מורכבת מרשומות שמורות כשאפשר (`isPartialView`), אחרת `NotCachedError`.
* **קישוריות** (`connectivity.ts`): ONLINE → SUSPECT → OFFLINE → SYNCING → ONLINE. שכבת הנתונים עוברת למטמון בכישלון הראשון; הפס מוצג רק אחרי 1.5 שניות של כישלון רצוף או בדיקה (`GET /api/health`, 5 שניות) שנכשלה; `navigator.onLine` רק מעורר בדיקה. לוח בדיקות 2/4/8/16/32 ואז כל 60 שניות (±20%), מושהה כשהדף מוסתר; בדיקה מיידית ב-`online`, `focus`, `visibilitychange`, `pageshow`, `notifyResume()` של הפלטפורמה, כתיבה בלי חיבור ו"נסה שוב".

**התור והמשחזר.**
* שרשראות: `entry:<מפתח>` לכל רשומה, `habits` לכל הגדרות ההרגלים, `log:<הרגל>:<תאריך>` (תלוי ביצירת ההרגל כשהוא מקומי), `settings`. נשלחת פעולה אחת בכל פעם - הנמוכה ביותר שהיא ראש השרשרת שלה ושהתלויות שלה אושרו; שרשרת תקועה לא עוצרת אחרות.
* **חתימה לפני שליחה**: פעולה מסומנת `sealed` (ו-`attempts += 1`) בטרנזקציה לפני ה-`fetch`; מאז התוכן שלה לא משתנה וכל ניסיון חוזר שולח את אותם בייטים. **איחוד** (`coalesce.ts`) רק לפעולות שלא נחתמו (יצירה+עריכה → יצירה אחת; יצירה+מחיקה → כלום; וכו').
* תשובות: `applied`/`unchanged`/`conflict-won` מוחקות את הפעולה ורושמות ביומן (7 ימים) ובמיפוי המזהים; `conflict-lost`/`gone`/`stale` מוחקות ומשאירות **הערה** עם הגרסה של המשתמש; 401/423/409/404 עוצרים (התור נשמר); 429/503 משהים הכול (`Retry-After` או 2 שניות כפול עד 5 דקות); 500/507 משהים רק את השרשרת (עד 10 דקות); 400/413 סופיים והופכים את הפעולה ואת התלויות בה להערות. שלושה כישלונות רשת של שליחה כשהבדיקה מצליחה מסמנים את השרשרת "חסומה" (מלכודת CORS/proxy). ריצה אחת בכל פעם לחשבון (`navigator.locks`, ובלעדיהם mutex בתהליך), ו-`BroadcastChannel` מרענן לשוניות אחרות.
* **פעם אחת בדיוק** בלי יומן פעולות בשרת: יצירה מזוהה לפי `clientId` קבוע (`sync:cid:*`), עריכה שכבר חלה נענית `unchanged`, מחיקה של רשומה חסרה - `unchanged`; השרת עונה רק אחרי שהשינוי על הדיסק, וגרסאות רק מתקדמות (`nextVersion`), כך שניסיון חוזר לעולם לא דורס שינוי מאוחר של מכשיר אחר.

**אחסון והצפנה במכשיר.** מסד IndexedDB אחד לכל חשבון, `ypd-offline-v1-<userId>`, עם המאגרים `meta`, `outbox`, `notes`, `journal`, `cache`, `idmap`. גלויים רק מספרים, גדלים, זמנים ודגלים; כל תוכן הוא AES-GCM במפתח שנגזר (HKDF) ממפתח החשבון (AOK, `GET /api/sync/key`, נשמר בשרת בתוך היומן), עם AAD של חשבון/מאגר/רשומה. `meta.keyCheck` שלא מתפענח → המנוע לא כותב. המטמון נשמר ב-IndexedDB רק באפליקציות עם "זכור אותי" (25MB, LRU), ובכל מקרה אחר בזיכרון. "פתיחה מהעותק" (`startFromCache`) נשענת על `localStorage['mpd.offline.current'] = { userId, tokenTag }` (16 תווי hex מ-SHA-256 של האסימון - לא האסימון) ועל תמונת סשן מוצפנת ב-`meta`. 401 מוחק את המטמון, היומן, מיפוי המזהים, תמונת הסשן והמפתח העטוף, ומשאיר את התור, ההערות ועותק הגיבוי; יציאה מהחשבון מוחקת הכול (`offline.wipeAccount`), אחרי שאלה אם יש שינויים שממתינים.

**התפרים לכל פלטפורמה** (`setOfflinePlatform`): `OfflineKeyVault` - DPAPI ב-Windows (`src/offline/native/tauri.ts` → פקודות Tauri `offline_key_*` ב-`src-tauri/src/offline.rs`), Keychain במק (`tauriKeychainVault` באותו קובץ → אותן פקודות, `src-tauri/src/platform/macos.rs`, שירות `app.yourpersonaldiary.mac.offline.v1`), Android Keystore (`mobile/platform/offline.ts` → `DiaryOfflinePlugin`); `OutboxMirror` - עותק של כל רשומת תור/הערה כקובץ (`offline_mirror_*` ב-Windows, `@capacitor/filesystem` `Directory.Data` ב-Android), שממנו מסד שנמחק משוחזר אחרי כניסה; `DeviceUserCheck` - Windows Hello / Touch ID (או סיסמת המק) / נעילת המסך של הטלפון לפתיחת מסך הנעילה בלי חיבור; `notifyResume()` - חזרה לחזית. באתר אין אף אחד מהם: המפתח בזיכרון בלבד, אין עותק גיבוי ואין פתיחה בלי חיבור. **סיסמת היומן בלי חיבור** (בכל הפלטפורמות, החלטת הבעלים 8.11.2026): `src/offline/password-wrap.ts` עוטף את מפתח העותקים במפתח שנגזר מהסיסמה (scrypt N=2^15, r=8, p=1 אחרי NFKC כמו בשרת; AES-256-GCM עם AAD `ypd-offline-pw-v1:<userId>`). העטיפה בזיכרון בכל ריצה, וב-`meta.passwordWrap` רק עם "זכור אותי" (אותו מחזור חיים כמו `meta.wrappedKey`); הסיסמה עצמה לא נשמרת. ניסיונות שגויים: 3 חופשיים, אחר כך 2, 4, 8 שניות ועד 60 (`sessionStorage`).

**בשרת** (מצב מארח בלבד): `app.use('/api/sync', guard, refuseGuest, dataJson, syncRouter)` - בלי `quotaGuard` (המכסה נבדקת לפי סוג: מחיקות וארכוב עוברים תמיד). אפס שינוי סכימה - כל ההנהלה בשורות `sync:*` בטבלת `meta`; שחזור גיבוי מעתיק את המפתח וכותב `sync:epoch` חדש, כך שעריכות לפי מזהה שבתור הופכות ל-`stale` (מזהים יכולים לחזור אחרי שחזור) ויצירות עדיין חלות. יומן סגור או שחזור באמצע בקשה → `503 server.sync.notSaved`, לעולם לא 401.

**הבדיקה מקצה לקצה** (`mobile/test/hosted-offline.test.ts`, העזרים ב-`mobile/test/offline-e2e/`): ההרכבה המארחת האמיתית (`startHosted` מקוד המקור תחת Node, `127.0.0.1` בפורט פנוי - לעולם לא 47321 - תיקיית נתונים זמנית, `DIARY_DEVICE_KEY` של בדיקה, KDF מהיר; שרת שני עם `DIARY_MAX_DIARY_BYTES` קטן למקרה המכסה) מול קוד הלקוח האמיתי בתצורת אפליקציית Android: `fake-indexeddb` (מפעל IndexedDB משלו למכשיר), Web Crypto של Node, תפרים מדומים שרק הבדיקה מתקינה, ו**תעבורה מתחלפת** (`online` / `down` / `blackhole` / `drop-response`) שגם מחקה את בדיקות ה-CORS של ה-WebView (preflight, `Access-Control-Allow-Origin`, רק כותרות תשובה חשופות). מכשיר B הוא לקוח HTTP פשוט של אותו חשבון (עריכות דרך הנתיבים הרגילים ודרך `/api/sync/op`). "הפעלה מחדש" = מנוע חדש על אותו IndexedDB ואותו אחסון. המנוע מחזיק מצב ברמת המודול (מנוע חמוש אחד לדף), ולכן רק מכשיר אחד מריץ מנוע בכל רגע. הבדיקה מכסה את שלבי סעיף 9 בתכנון (1-8), ההתנגשויות C1-C7 ומחזור החיים L1-L9, בודקת שכל כתובת שנשלפה היא שרת הבדיקה, ובונה את שתי החבילות המופצות כדי לוודא שהתפרים המדומים לא נמצאים בהן.

## 12. בנייה והתקנה

**המתקין המופץ (לקוח רזה)** - `npx tauri build --bundles nsis`:

1. `npm run build` - הממשק ל-`dist/` (כתובת השרת נאפית מ-`src/config/server-default.json`).
2. `tauri build` - קומפילציית Rust (בלי `local-server`) ויצירת `src-tauri/target/release/bundle/nsis/*.exe` (ועם `--bundles nsis msi` גם `msi/*.msi`).

`tauri.conf.json` אינו מגדיר `externalBin` ולא `resources`, ולכן המתקין מכיל רק את קובץ ההרצה ואת קובצי המתקין עצמו (המסיר ו-`install-locale.txt` נכתבים בהתקנה) - בלי Node.js, `server.cjs`, `sql-wasm.wasm`, גופנים או `ui/` (ב-`installer.nsi` שנוצר שורת ה-`File` היחידה של התוכנה היא קובץ ההרצה, ואין אף שורת `File` של `server\...`). גם ה-bootstrapper של WebView2 **לא** ארוז בו: `bundle.windows.webviewInstallMode` הוא `downloadBootstrapper`, כך שהמתקין בודק ברישום אם WebView2 מותקן, ורק כשהוא חסר מוריד את `MicrosoftEdgeWebview2Setup.exe` מ-`go.microsoft.com` ומריץ אותו בשקט (ב-Windows 11 WebView2 מובנה). `npm run tauri:build` עדיין מריץ קודם את `server:build` ואת `sidecar:prepare`; התוצרים שלהם נשארים מחוץ למתקין. מעבר מגרסה קודמת: התקנה מעל התקנה ישנה שכללה את השרת המקומי בלי להסיר אותה קודם (ברירת המחדל "Add/Reinstall" כשמספר הגרסה זהה) הייתה משאירה את `diary-server.exe` ואת `server\` לתמיד, כי המסיר החדש לא מכיר אותם; לכן `hooks.nsh` מגדיר `MPD_REMOVE_LEGACY_SERVER`, שמוחק בדיוק את הקבצים שהמתקין הישן התקין (לפי שם, בלי מחיקה רקורסיבית, ורק כש-`diary-server.exe` או `server\server.cjs` קיימים), ומפעיל אותו ב-`NSIS_HOOK_POSTINSTALL` וב-`NSIS_HOOK_POSTUNINSTALL`.

**מתקין של המצב המקומי למפתחים** (לבדיקות בלבד):

1. `node scripts/build-server.mjs` - `esbuild` מאגד את השרת ל-`src-tauri/resources/server/server.cjs` ומעתיק `sql-wasm.wasm`, גופנים ואת `dist/` (ל-`ui/`).
2. `node scripts/prepare-sidecar.mjs` - מעתיק את `node.exe` ל-`src-tauri/binaries/diary-server-x86_64-pc-windows-msvc.exe`.
3. `npx tauri build --config src-tauri/tauri.local.conf.json --features local-server --bundles nsis` - קובץ העל מחזיר את ה-sidecar ואת `resources/server/` ל-bundle, בונה את הממשק עם `VITE_LOCAL_SERVER=1` ומחזיר ל-CSP את `127.0.0.1`; התכונה מחזירה לקליפה את קוד ה-sidecar.

**שפת המתקין (NSIS בלבד; ה-MSI נשאר בעברית, בלי בחירת שפה)**:

* `bundle.windows.nsis`: `displayLanguageSelector` עם 20 השפות (`languages`, אנגלית ראשונה - ברירת המחדל כששפת Windows אינה אחת מהן), `customLanguageFiles` לשפות ש-Tauri לא מתרגם או מתרגם עם שגיאות (Hebrew, Polish, Czech, Hungarian, Greek, German, Romanian, Italian, Thai, Hindi - כל 27 מחרוזות Tauri, UTF-8 בלי BOM), ו-`installerHooks: ./nsis/hooks.nsh`.
* `hooks.nsh` נכלל בראש `installer.nsi`: מגדיר `MUI_LANGDLL_ALWAYSSHOW` (הבורר מוצג גם בהתקנה חוזרת, עם השפה הקודמת מסומנת) ו-`MUI_LANGDLL_ALLLANGUAGES` (כל השפות, בלי סינון לפי code page); `NSIS_HOOK_POSTINSTALL` ממפה את `$LANGUAGE` (`${LANG_*}`) לקוד השפה של הממשק וכותב אותו (ASCII) ל-`$INSTDIR\install-locale.txt`; `NSIS_HOOK_POSTUNINSTALL` מוחק את הקובץ ואת תיקיית ההתקנה שהתרוקנה.
* הקליפה: הפקודה `get_install_locale` קוראת את הקובץ שליד קובץ ההרצה ומחזירה רק אחד מ-20 הקודים (אחרת `null`).
* הממשק (`src/i18n/install-locale.ts`, נקרא מ-`main.tsx` לפני הרינדור הראשון, ממתין עד 1.5 שניות): שפת המתקין נכנסת לסדר הקדימות - שפת החשבון המחובר ← שפת המכשיר (`mpd.language`) ← שפת המתקין ← שפות הדפדפן ← אנגלית (`resolveStartupLocale` ב-`src/i18n/runtime.ts`; שפות הדפדפן נלקחות רק בממשק הדפדפן ובאפליקציית Android, שם הן שפות הטלפון - אפליקציית Windows לא מתייעצת בשפת Windows/WebView2, ולכן גרסת ה-Microsoft Store / MSIX, שאין לה שפת מתקין, נפתחת באנגלית, `detectLocale`) - ומוחלת **פעם אחת** על שפת המכשיר כשהיא שונה מזו שהמכשיר כבר החיל (`mpd.language.installApplied`). כך מסכי הכניסה וההרשמה מופיעים בשפה שנבחרה במתקין, חשבון חדש מתחיל בה (השרת שומר את שפת מסך ההרשמה, `Accept-Language`), וחשבונות קיימים נשארים בשפתם (ה-`LanguageContext` מחיל את שפת החשבון אחרי הכניסה). מאחר שה-`LanguageContext` משקף את שפת החשבון גם לשפת המכשיר, סשן "זכור אותי" היה מוחק את בחירת המתקין לפני שמסך יציאה כלשהו הציג אותה; לכן היא נשמרת גם כ**ממתינה** (`mpd.language.installPending`), וה-`LanguageContext` מחיל אותה על שפת המכשיר במסך הראשון במצב `anonymous` (כניסה / הרשמה) ומוחק אותה (`takePendingInstallLocale`) - גם בהפעלה מאוחרת יותר אם היומן נסגר בלי יציאה. בחירת שפה של המשתמש (`setLocale`, הגדרות ← שפה) מבטלת אותה (`clearPendingInstallLocale`).

## 13. בדיקות

* `server/test` - הצפנה (round-trip, סיסמה שגויה, קובץ פגום), חשבונות וסשנים, CRUD, מנוע ניתוח (נתונים סינתטיים עם דפוס ידוע → תובנה צפויה; נתונים אקראיים → אין תובנה), פרסר החיפוש (עשרות שאלות בעברית), ייצוא, גיבוי/שחזור, LAN guard.
* `src/**/*.test.tsx` - טפסים (שגיאות נגישות), ניווט במקלדת, LiveRegion, מגן הרשת, רכיבי גרף (טבלה חלופית).
* `scripts/check-no-network.mjs` - ביקורת סטטית.
* עבודה בלי חיבור (סעיף 11ג): `src/offline/**/*.test.ts` - המנוע מול שרת מדומה (`src/offline/test-utils/fake-sync-server.ts`, בנוי על `decide` של `shared/sync.ts`): תור, איחוד, חתימה, הצפנה, מטמון, שכבת-על, קישוריות עם שעונים מדומים, עותק הגיבוי; `server/test/sync-*.test.ts` - החוזה בשרת; `mobile/test/hosted-offline.test.ts` - מקצה לקצה מול ההרכבה המארחת האמיתית (סעיף 11ג, "הבדיקה מקצה לקצה").
