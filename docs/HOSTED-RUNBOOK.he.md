# Your Personal Diary – ספר תפעול לשרת ב-Fly.io

נכתב 2026-10-18 (WP-H4); עודכן 2026-10-27 (WP-H8: כרטיס "שרת", ארכיון השרת החודשי ושחזורו – פרקים 6א, 6ב, 10), 2026-10-28
(תקרת החשבונות בפרק 5, הרשמה עם קוד הזמנה בפרק 10, שתי הצורות של עותק המפתח בפרקים 6ב ו-10) ו-2026-11-01 (ADMIN-TOOL: כלי הניהול
`admin.cjs` קיים – פרק 9 נכתב מחדש עם שורות ה-PowerShell המדויקות, שורה בפרק 10, הפקודות בפרק 13).
המותג "Your Personal Diary" נשאר באנגלית. הדוגמאות בדויות.
מדריך ההעלאה הראשונית: `docs/HOSTED-DEPLOY.he.md`. התכנון: `docs/HOSTED-PLAN.md` חלק ב' + `docs/android-tasks/HOSTED-IMPL.md`.

בכל הפקודות `<app>` הוא `yourpersonaldiary` (ייצור) או `yourpersonaldiary-staging` (ניסיון). אם `flyctl` לא מוכר – הנתיב המלא:
`C:\Users\AVI\.fly\bin\flyctl.exe`. **כל תרגיל מסוכן עושים קודם על הניסיון.**

---

## 1. מבט מהיר – האם הכול בסדר?

| שאלה | פקודה / כתובת | תשובה טובה |
|---|---|---|
| השרת עונה? | `https://<app>.fly.dev/api/health` בדפדפן | `{"ok":true,...}` |
| גם הדיסק בסדר? | `https://<app>.fly.dev/api/health/strict` | אותו דבר; "שגיאה 503" = דיסק מלא או כמעט מלא (פרק 5) |
| המכונה רצה? | `flyctl status -a <app>` | מכונה אחת, `started`, בדיקת הבריאות `passing` |
| מה קרה לאחרונה? | `flyctl logs -a <app> --no-tail` | בלי שורות `fatal`, `persist failed`, `[data-tools] FAILED` |
| כמה מקום נשאר? | כרטיס "השרת" באפליקציה (לבעלים) או `flyctl ssh console -a <app> -C "df -h /data"` | פחות מ-80 % בשימוש |

הלוג לא מכיל תוכן יומנים, כתובות מייל או כתובות IP – מותר להראות אותו לסוכן.

## 2. הפעלה מחדש

```
flyctl status -a <app>                               ← מזהה המכונה (עמודת ID)
flyctl machine restart <machine-id> -a <app> --signal SIGTERM --time 25
```
`SIGTERM` + 25 שניות נותנים לשרת לסגור יפה: הוא כותב כל יומן פתוח לדיסק (`stopped` בלוג) ורק אז יורד. בלי מזהה –
`flyctl machine restart -a <app>` מפעיל מחדש את כל המכונות של האפליקציה (יש רק אחת). ההשבתה למשתמשים: כמה שניות
(מסך "אין חיבור" עם "נסה שוב").

## 3. לוגים

```
flyctl logs -a <app>              ← חי (Ctrl+C ליציאה)
flyctl logs -a <app> --no-tail    ← הדקות האחרונות ויציאה
```
שורות שכדאי להכיר: `{"event":"listening",...}` – השרת עלה; `[entrypoint] data dir /data ready` – ההרשאות תוקנו;
`[data-tools] applied` – הועברו נתונים מהמחשב; `stopped` – סגירה מסודרת; `persist failed for u_…` – כתיבה נכשלה (בודקים דיסק);
`register refused (rate)` – מישהו מנסה להירשם יותר מדי (לא דחוף); `registrations in the last 24 h: <N> - consider DIARY_REGISTRATION=closed (invite only together with DIARY_INVITE_CODE)`
– יותר מ-50 הרשמות ביממה: פרק 9, "גל הרשמות מזויפות" (`invite` רק יחד עם קוד הזמנה – פרק 10; בלי קוד השרת לא עולה).

## 4. השרת לא עונה – רשימת בדיקה

1. `flyctl status -a <app>` – אם אין מכונה כלל: `flyctl scale count 1 -a <app> -y`.
2. אם המכונה `stopped`/`failed`: `flyctl machine start <machine-id> -a <app>` ואז לוגים.
3. אם היא `started` אבל הבריאות נכשלת: `flyctl logs -a <app> --no-tail` – לחפש `fatal`. סיבות נפוצות: `DIARY_PUBLIC_URL` חסר/שגוי
   (`flyctl config validate --config deploy\hosted\fly.toml`), מפתח שרת לא תקין (`flyctl secrets list -a <app>` – חייב להופיע `DIARY_DEVICE_KEY`).
4. הפעלה מחדש (פרק 2). עדיין לא? פריסה מחדש: `.\scripts\hosted\deploy.ps1` (הסשן הראשי).
5. אם Fly עצמו בתקלה: `https://status.flyio.net` – מחכים. למשתמשים זה נראה כמו "אין חיבור"; שום דבר לא אובד (היומנים על הדיסק).

## 5. דיסק מלא או כמעט מלא

סימנים: `/api/health/strict` עונה 503, המוניטור שולח מייל, כרטיס "שרת" מציג אזהרה (פחות מ-15 % פנוי, או "השמירה לדיסק לא תקינה"),
"הכנת ארכיון שרת" עונה "אין מספיק מקום פנוי" (צריך פנוי לפחות פי 1.2 מגודל הנתונים), בלוג `persist failed`. השרת ממשיך לקרוא; כתיבות
נשמרות בזיכרון וחוזרות על עצמן.

1. כמה יש: `flyctl volumes list -a <app>` (עמודות SIZE / ATTACHED).
2. להגדיל (אונליין, בלי אובדן נתונים; רק להגדיל, אף פעם לא להקטין):
   ```
   flyctl volumes extend <vol-id> -s 5 -a <app>        ← ל-5 GB
   ```
   אם אחרי דקה הכרטיס עדיין מראה את הגודל הישן – הפעלה מחדש (פרק 2).
3. **תקרת החשבונות** (`DIARY_MAX_ACCOUNTS`). הכלל הזהיר: גודל הדיסק חלקי 30 MB – כל יומן יכול להגיע למכסה של 10 MB
   (`DIARY_MAX_DIARY_BYTES`), והוא תופס על הדיסק עד פי 3 מגודלו (היומן, `.mpd.prev`, והקובץ הזמני בזמן כתיבה); לדיסק של 3 GB
   זה כ-100 חשבונות.
   **בייצור מוגדרים 5000** (החלטת הבעלים 2026-10-27; ב-`fly.toml` וגם כסוד ב-Fly), הרבה מעל הכלל – כלומר התקרה לא שומרת על
   הדיסק. מה ששומר עליו: האזעקה (`/api/health/strict` עונה 503 מתחת ל-10 % פנוי, וכרטיס "שרת" מזהיר מתחת ל-15 %) והגדלת הדיסק
   בסעיף 2 כשהיא מצלצלת. יומן רגיל קטן בהרבה מהמכסה (עד כ-1 MB; `docs/HOSTED-PLAN.md` 3.7), ולכן בפועל הדיסק מתמלא הרבה אחרי
   100 חשבונות – אבל אין לכך הבטחה. כדי לחזור לכלל מגדילים את הדיסק (5000 × 30 MB ≈ 150 GB) או מורידים את התקרה – החלטה שלך.
   שינוי התקרה: `flyctl secrets set DIARY_MAX_ACCOUNTS=<מספר> -a <app>` (הסוד גובר על `fly.toml`), והסשן הראשי מעדכן גם את `fly.toml`.
4. דיסק שהתמלא מתיקיית `incoming/replaced-*` (שאריות העברה, פרק 7) – מוחקים אותה אחרי שווידאת שהכול עובד:
   `flyctl ssh console -a <app> -C "rm -rf /data/incoming/replaced-20261018T120000Z"` (עם השם המדויק מ-`ls /data/incoming`).
5. ארכיוני השרת (`/data/archive`, לכל היותר 2, פרק 6א) תופסים כל אחד בערך את גודל הנתונים. אחרי שהגדלת את הדיסק הם לא מפריעים; צריך מקום
   מיד? מוחקים את **הישן** מביניהם – רק אם עותק שלו כבר אצלך ונבדק (פרק 6א):
   `flyctl ssh console -a <app> -C "ls -la /data/archive"` ואז `flyctl ssh console -a <app> -C "rm /data/archive/<השם-הישן>.mpda /data/archive/<השם-הישן>.mpda.sha256"`.

## 6. תרגיל שחזור (לבצע פעם אחת על הניסיון לפני העלייה לאוויר, ולרשום כמה זמן לקח)

Fly מצלם את הדיסק אוטומטית כל יום (שמירה 30 יום בייצור). שחזור = יצירת דיסק חדש מהצילום וחיבורו למכונה חדשה.

1. **הכנה:** בכתובת הניסיון נרשמים לחשבון ניסיון, כותבים רשומה עם משפט מזהה.
2. **צילום עכשיו** (במקום לחכות ללילה):
   ```
   flyctl volumes list -a yourpersonaldiary-staging                 ← <vol-id> הנוכחי
   flyctl volumes snapshots create <vol-id> -a yourpersonaldiary-staging
   flyctl volumes snapshots list <vol-id> -a yourpersonaldiary-staging   ← לחכות עד שיש שורה חדשה (דקה-שתיים) ולרשום <snap-id>
   ```
3. **"אסון":** מוחקים את הרשומה באפליקציה.
4. **שחזור:**
   ```
   flyctl volumes create diary_data -a yourpersonaldiary-staging -r fra -s 1 --snapshot-id <snap-id> -y   ← <new-vol-id>
   flyctl machine stop <machine-id> -a yourpersonaldiary-staging
   flyctl machine clone <machine-id> -a yourpersonaldiary-staging -r fra --attach-volume <new-vol-id>:/data
   ```
   (מכונה חדשה עולה על הדיסק המשוחזר; הישנה עצורה – כך אף פעם לא רצות שתיים.)
5. **בדיקה:** כניסה לחשבון הניסיון – הרשומה חזרה; חשבונות אחרים לא נפגעו. בדיקת הבריאות ירוקה.
6. **ניקוי:** `flyctl machine destroy <old-machine-id> -a yourpersonaldiary-staging --force` ואז
   `flyctl volumes destroy <old-vol-id> -a yourpersonaldiary-staging -y`. לוודא ש-`flyctl status` מראה מכונה אחת.
7. לרשום כאן: תאריך, כמה דקות לקח, מה הפתיע. _(טרם בוצע – ממתין לפריסת הניסיון.)_

**שחזור בייצור** – אותם צעדים עם `yourpersonaldiary` וגודל הדיסק הנוכחי (`-s 3` או יותר). בין "stop" ל-"clone" השרת לא זמין
(דקה-שתיים). רשומות שנכתבו אחרי הצילום אובדות – לכן קודם מנסים את פרק 4.

צילומי Fly נשמרים אצל Fly. עותק שלא תלוי בהם – הארכיון החודשי (פרק 6א), ותרגיל השחזור שלו (פרק 6ב).

## 6א. ארכיון שרת חודשי (פעם בחודש, כ-10 דקות)

ארכיון השרת הוא עותק מוצפן של כל `/data` (חשבונות, יומנים, הגדרות מייל) **בלי** מפתח השרת, לשחזור גם אם Fly איבד הכול. הוא נכתב
לדיסק של השרת (שם נשמרים רק 2 האחרונים – הישנים נמחקים לבד) ומשם מורידים אותו **רק** בפקודה מהחלון שלך; אי אפשר להוריד אותו דרך
האתר או האפליקציה. כרטיס "שרת" מזכיר כשהארכיון האחרון ישן מ-30 יום.

1. באפליקציה, בחשבון הבעלים: **הגדרות ← כרטיס "שרת" ← "הכנת ארכיון שרת"**.
2. ממלאים: סיסמת החשבון שלך, ו**סיסמת ארכיון** (לפחות 12 תווים, פעמיים) – סיסמה נפרדת, לא סיסמת החשבון. שומרים אותה במנהל
   הסיסמאות (או על נייר) **במקום אחר** מהקובץ. **בלי סיסמת הארכיון אי אפשר לשחזר, ואין דרך לשחזר אותה.** מותר אותה סיסמת ארכיון בכל חודש.
3. "הכנת הארכיון" – אחרי כמה שניות הכרטיס מציג את שם הקובץ, הגודל, ה-SHA-256 ושתי פקודות. ארכיון אחד ל-10 דקות.
4. במחשב: פותחים PowerShell בתיקייה שבה שומרים (למשל `cd E:\diary-archives` בכונן חיצוני). בכרטיס: **"העתקת פקודת ההורדה"**,
   מדביקים בחלון ו-Enter. הפקודה נראית כך:
   ```
   C:\Users\AVI\.fly\bin\flyctl.exe ssh sftp get /data/archive/your-personal-diary-server-2026-11-01T09-30-00Z.mpda .\your-personal-diary-server-2026-11-01T09-30-00Z.mpda -a yourpersonaldiary
   ```
   (שגיאת התחברות? `C:\Users\AVI\.fly\bin\flyctl.exe auth login` ושוב.)
5. בכרטיס: **"העתקת פקודת הבדיקה"**, מדביקים באותו חלון ו-Enter. חייב להופיע `True`. `False` = הקובץ פגום: מוחקים אותו
   (`Remove-Item .\<השם>.mpda`) וחוזרים לסעיף 4.
6. שומרים מחוץ לרשת: הכונן החיצוני מנותק מהמחשב (לא בענן). שומרים את **3 הארכיונים האחרונים** ומוחקים ישנים יותר – כך כתוב גם
   במדיניות הפרטיות (חשבון שנמחק נעלם מהארכיונים תוך כמה חודשים).
7. בשרת אין מה לעשות: הוא משאיר רק את 2 האחרונים.

הודעות שאפשר לקבל: "אפשר להכין ארכיון שרת פעם אחת בכל 10 דקות" – מחכים (הכרטיס אומר מאיזו שעה); "אין בשרת מספיק מקום פנוי
לארכיון" – פרק 5; סיסמת חשבון שגויה 10 פעמים ברצף – נעילה לכמה דקות, כמו בכרטיס המייל; "לא ניתן היה לכתוב את ארכיון השרת" – לוגים
(פרק 3) ולנסות שוב.

## 6ב. תרגיל שחזור ארכיון (פעם אחת לפני העלייה לאוויר – קודם על הניסיון – ואחר כך פעם בשנה)

מוכיח שהארכיון שלם ושיש לך את מפתח השרת הנכון. הכול רץ **רק במחשב שלך** (`127.0.0.1`), בחלון PowerShell חדש שלך, בתיקיית הפרויקט
`C:\Users\AVI\Projects\my-personal-diary`. צריך: קובץ ארכיון מפרק 6א (בניסיון הפקודה בכרטיס כבר כוללת `-a yourpersonaldiary-staging`),
סיסמת הארכיון, ותיקייה `deploy\hosted\dist` עדכנית (הסשן הראשי מכין אותה כמו לפני פריסה).

1. **פתיחת הארכיון** לתיקייה חדשה וריקה:
   ```
   node scripts\hosted\restore-archive.mjs E:\diary-archives\<השם>.mpda C:\drill\data
   ```
   הוא שואל את סיסמת הארכיון (לא מוצגת), בודק את כל הקובץ לפני שכותב משהו, מדפיס `SHA-256:` (להשוות לכרטיס) ומספרים בלבד.
   קודי יציאה: 0 הצליח; 2 התיקייה לא ריקה או שימוש שגוי; 3 סיסמת ארכיון שגויה או קובץ פגום; 4 הפריסה נכשלה באמצע.
2. **הפעלת שרת על הנתונים המשוחזרים** (באותו חלון). קודם משנים **שורה אחת**: בשורה `$keyCopy = ...` שמים בין הגרשיים את הנתיב
   המלא של עותק המפתח שלך – הקובץ ש-`set-secrets.ps1` כתב (בהתחלה ב-Documents; אם הזזת אותו – המיקום החדש; בניסיון שמו מסתיים
   ב-`-staging.txt`). **שמרת רק את השורה במנהל הסיסמאות** (HOSTED-DEPLOY, שלב ב.6)? יוצרים ממנה קובץ זמני לתרגיל: בפנקס רשימות,
   קובץ חדש עם השורה `DIARY_DEVICE_KEY=...` בדיוק כמו במנהל הסיסמאות, שמירה בשם `C:\drill\key.txt`, ובשורה `$keyCopy` שמים את
   הנתיב הזה (סעיף 5 מוחק אותו יחד עם `C:\drill`). המפתח נקרא מהקובץ ולא מוצג:
   ```
   $env:DIARY_MODE='hosted'; $env:DIARY_DATA_DIR='C:\drill\data'; $env:PORT='47950'; $env:DIARY_BIND='127.0.0.1'
   $env:DIARY_PUBLIC_URL='http://127.0.0.1:47950'; $env:DIARY_REGISTRATION='closed'; $env:DIARY_MAX_GUESTS='0'
   $env:DIARY_STATIC_DIR="$PWD\deploy\hosted\dist\ui"; $env:DIARY_ASSETS_DIR="$PWD\deploy\hosted\dist"
   $keyCopy = 'X:\full\path\of\yourpersonaldiary-device-key-yourpersonaldiary.txt'
   $env:DIARY_DEVICE_KEY = $null; if (Test-Path -LiteralPath $keyCopy -PathType Leaf) { $k = Get-Content -LiteralPath $keyCopy | Where-Object { $_ -like 'DIARY_DEVICE_KEY=*' } | Select-Object -First 1; if ($k) { $env:DIARY_DEVICE_KEY = $k.Substring(17).Trim() } }
   if ($env:DIARY_DEVICE_KEY) { node deploy\hosted\dist\server-hosted.cjs } else { Write-Host 'STOP - the server was NOT started: the $keyCopy file was not found or has no DIARY_DEVICE_KEY= line. Fix the $keyCopy line and paste the last three lines again.' -ForegroundColor Red }
   ```
   הופיע `STOP` – השרת **לא** הופעל, וטוב שכך: שרת בלי המפתח יוצר לעצמו מפתח חדש ואקראי, וסעיף 3 היה "מוכיח" מפתח שגוי כשרק
   הנתיב שגוי. מתקנים את שורת `$keyCopy` ומדביקים שוב את שלוש השורות האחרונות. (אם בייצור המפתח הוא קובץ `device.key` – פרק 10 –
   מעתיקים אותו ל-`C:\drill\data\device.key`, ובמקום שלוש השורות האחרונות מריצים `node deploy\hosted\dist\server-hosted.cjs`.)
3. **בדיקת המפתח – לפני שנכנסים** (כניסה מחדשת את עותק השחזור ומסתירה מפתח שגוי): בדפדפן `http://127.0.0.1:47950` ←
   "שכחתי סיסמה" לחשבון הניסיון. מגיע מייל (השרת שבמחשב שולח דרך הגדרות המייל שבארכיון) ← הקישור שבו ← סיסמה חדשה. עבד = המפתח
   נכון. לא הגיע מייל, או "עדיין אי אפשר לאפס את הסיסמה של החשבון הזה" = המפתח לא נכון (או שבשרת הזה לא הוגדר מייל – אז מדלגים).
4. **בדיקת הנתונים:** נכנסים לחשבון הניסיון – הרשומות שם. זה מוכיח שהארכיון שלם.
5. **ניקוי:** Ctrl+C בחלון, סוגרים אותו (המשתנים נעלמים איתו), ואז `Remove-Item -Recurse -Force C:\drill` – זה עותק פתוח של הנתונים.
6. לרשום כאן: תאריך, כמה דקות לקח. _(טרם בוצע.)_

בלי המפתח השרת עולה והכניסה בסיסמה עובדת; "זכור אותי" ואיפוס סיסמה לא, עד שכל משתמש נכנס פעם אחת בסיסמה (פרק 10).

**אם הכול אבד ב-Fly** (הדיסק וגם הצילומים): פותחים את הארכיון האחרון כמו בסעיף 1, והסשן הראשי מעלה את התיקייה לשרת חדש עם
`scripts\hosted\migrate-from-pc.ps1 -SourceDir C:\drill\data` (כמו ההעברה מהמחשב, פרק 7), עם `DIARY_DEVICE_KEY` מהעותק שלך.
המשתמשים נכנסים מחדש פעם אחת; מה שנכתב אחרי הארכיון – אבד.

## 7. ההעברה מהמחשב – מה נשאר אחריה

`scripts/hosted/migrate-from-pc.ps1` משאיר על הדיסק של השרת: `/data/incoming/last-apply.txt` (תאריך ומספרים) ו-`/data/incoming/replaced-<זמן>/`
אם היו כבר נתונים בשרת (הועברו הצידה, לא נמחקו). לראות: `flyctl ssh console -a <app> -C "/usr/local/bin/diary-data-tools incoming /data"`.
לספור חשבונות ויומנים (בלי שמות): `flyctl ssh console -a <app> -C "/usr/local/bin/diary-data-tools count /data"`.
אחרי שווידאת שהכול עובד – מוחקים את `replaced-*` (פרק 5 סעיף 4). ביטול העברה שהועלתה אך עוד לא הוחלה:
`flyctl ssh console -a <app> -C "/usr/local/bin/diary-data-tools disarm /data"`.

## 8. גודל המכונה (scaling)

מתי: כרטיס "השרת" מראה זיכרון (RSS) מעל 70 % מ-512 MB לאורך זמן, או בלוג מופיע `out of memory` / המכונה מופעלת מחדש לבד.
```
flyctl scale memory 1024 -a <app>          ← ל-1 GB (אפשר לחזור ל-512 באותה דרך)
```
אחרי שינוי זיכרון הסשן הראשי מעדכן ב-Dockerfile את `NODE_OPTIONS=--max-old-space-size` ל-(זיכרון − 128) MB ופורס מחדש.
**לעולם לא** `scale count 2` – השרת מחזיק מצב בזיכרון (חלק ב' 3.8). צריך יותר? מכונה גדולה יותר, לא יותר מכונות.

## 9. חשבונות: מחיקה לפי בקשה, שחרור נעילה, ניתוק מכשירים, ניקוי ניצול לרעה (כלי הניהול `admin.cjs`)

**מה יש.** בתוך מכונת השרת יש כלי מפעיל, `/app/admin.cjs` (נבנה יחד עם השרת ומגיע בכל פריסה מ-2026-11-01 ואילך; התכנון:
`docs/HOSTED-PLAN.md` 3.10, החוזה: `docs/API.md` "ה-API הניהולי"). הוא מדבר **רק** עם השרת שרץ באותה מכונה (`127.0.0.1`) ומזדהה
באסימון שהשרת כותב בכל הפעלה לקובץ `/data/.admin-token`, שרק משתמש השרת (ו-root בתוך המכונה) יכול לקרוא. לכן צריך **שתי הרשאות
בלתי תלויות**: הכניסה שלך ל-Fly (`flyctl` במחשב שלך – זה מה שפותח מעטפת בתוך המכונה) ואת הקובץ שבפנים. מי שגנב את סיסמת האפליקציה
שלך לא מגיע לשום דבר מזה, ושום מסך באפליקציה לא מציג, לא מחפש ולא מוחק חשבונות של אחרים – גם לא כרטיס "שרת" (הוא רק מכין לך את
הטקסט של הפקודות, ראו 9.1). מהאינטרנט הנתיב `/api/admin` פשוט לא קיים (404 כמו כל נתיב לא מוכר). הכלי אף פעם לא פותח יומן, לא קורא
רשומות ולא מאפס סיסמה; כל פעולה נרשמת בלוג של Fly **בלי** שם ובלי כתובת (`admin: account deleted (1)`).

**הצורה של כל פקודה – מ-PowerShell במחשב שלך, שורה אחת:**
```
C:\Users\AVI\.fly\bin\flyctl.exe ssh console -a yourpersonaldiary -C 'node /app/admin.cjs <פקודה>'
```
הפקודות: `list` (כל החשבונות), `find <מייל-או-שם-משתמש>` (חשבון אחד, לא משנה כלום), `delete --email <מייל> --confirm <שם>`
(או `delete --username <שם> --confirm <שם>`), `revoke --username <שם>`, `unlock --username <שם>`, `status` (מונים בלבד), `help`.
כל הודעה של הכלי יוצאת באנגלית ואז בעברית (בחלון קונסולה ישן העברית עלולה להופיע הפוכה – השורה האנגלית תמיד קריאה).

כללי הכתיבה, נבדקו ב-Windows PowerShell 5.1 (`powershell.exe`):
- את כל מה שאחרי `-C` עוטפים ב**גרשיים בודדים** `'...'`, ובפנים אין אף גרש. **לא** גרשיים כפולים: בתוך `"..."` PowerShell מחליף
  `$משהו` במשתנה – בבדיקה `pay$day@example.com` הגיע לשרת בתור `pay@example.com`.
- הנתיב המלא של `flyctl.exe` עובד בלי `&` (אין בו רווחים), גם כש-`flyctl` לא ב-PATH.
- **שם משתמש** לא צריך שום עטיפה (מותרים בו רק אותיות באנגלית או בעברית, ספרות, `_`, `.` ו-`-`); גם שם בעברית עבד כמו שהוא.
  **חריג – שם שמתחיל במקף** (`-abc`, `--abc`; הכלל מתיר, וחשבון זבל עלול לבחור כזה בכוונה): הכלי קורא אותו כערך ולא כאפשרות
  (`find --abc`, `--username --abc` עובדים), חוץ משם שהוא **בדיוק** אחת האפשרויות של הכלי (`--help`, `--json`, `--username`...) – אותו
  כותבים אחרי `=` או אחרי `--`: `delete --username=--help --confirm=--help`, `find -- --help`. הצורה עם `=` עובדת לכל שם, ו-`find` מדפיס
  את פקודת המחיקה המוכנה בצורה הזו בעצמו לכל שם שמתחיל במקף.
- **עברית דרך צינור ב-PowerShell** (`| Out-String`, `| Select-String`, `| ConvertFrom-Json`, `> קובץ`): Windows PowerShell 5.1 מפענח פלט של
  תוכנות לפי דף הקוד של החלון – במחשב שלך 850, לא UTF-8 – והעברית בפלט (שמות משתמש, מיילים, השורה העברית של כל הודעה) יוצאת ג'יבריש
  כמו `ÎùÎ®ÎæÎòÎáÎòÎ¬`. לפני כן מריצים פעם אחת בחלון (תקף עד שסוגרים אותו): `[Console]::OutputEncoding = [Text.Encoding]::UTF8`.
  `list --json` יוצא תמיד ב-ASCII בלבד (אותיות שאינן לטיניות כ-`\uXXXX`), ולכן `ConvertFrom-Json` מחזיר אותו נכון גם בלי השורה הזו.
- **כתובת מייל רגילה** – אותיות וספרות בכל שפה ו-`. _ % + = @ -` בלבד – נכתבת כמו שהיא. כתובת עם **כל תו אחר** (גרש כמו
  `o'brien@example.com`, `$`, גרשיים, רווח, `&`, `|`, סוגריים...) **חייבת** לעבור בצורה `b64:<הכתובת ב-UTF-8 כ-base64url, בלי =>`;
  הכלי מפענח אותה. דוגמה: `o'brien@example.com` ← `b64:bydicmllbkBleGFtcGxlLmNvbQ`. כרטיס "שרת" מקודד כך בעצמו ואומר שעשה זאת;
  ביד אפשר ב-PowerShell: `'b64:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('הכתובת')).TrimEnd('=').Replace('+','-').Replace('/','_')`
  (הכתובת בגרשיים בודדים; גרש בתוכה מכפילים: `'o''brien@example.com'`).
  בצורה הרגילה הגרש נשבר בשורת הפקודה של המכונה; בצורת `b64:` עבדו גם `find` וגם `delete --email`.
- על הניסיון: `-a yourpersonaldiary-staging`. **לפני הפעם הראשונה בייצור – פעם אחת על הניסיון:**
  `C:\Users\AVI\.fly\bin\flyctl.exe ssh console -a yourpersonaldiary-staging -C 'node /app/admin.cjs status'` צריך להדפיס שורה כמו
  `version 0.1.0; accounts 3; open diaries 0; live sessions 0; registration open; owner configured yes` (ואחריה אותה שורה בעברית).
- אפשר גם **אינטראקטיבי**, בלי `-C`: `C:\Users\AVI\.fly\bin\flyctl.exe ssh console -a yourpersonaldiary`, בפנים `node /app/admin.cjs delete --username dana`
  (הכלי מציג את פרטי החשבון ומבקש להקליד את שם המשתמש שוב; Enter ריק מבטל), ובסוף `exit`. ההקלדה החוזרת מיועדת למעטפת הזו; דרך `-C` נותנים תמיד `--confirm`.
- השורה עם הכתובת נשארת בהיסטוריית הפקודות של PowerShell במחשב שלך (הקובץ `%APPDATA%\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt`);
  מי שמקפיד – מוחק משם את השורה אחרי הטיפול.
- `Cannot find module '/app/admin.cjs'` – השרת עוד לא נפרס מחדש מאז שהכלי נוסף: קודם פריסה (פרק 11), אחר כך הטיפול.

### 9.1 בקשת מחיקה במייל (מי שלא יכול להיכנס)

מדיניות הפרטיות ודף מחיקת החשבון מבטיחים למי שלא יכול להיכנס מחיקה **תוך 30 יום** מהבקשה (במייל ל-`yourpersonaldiary29@gmail.com`,
מהכתובת הרשומה בחשבון, עם שם המשתמש). הנוהל:

1. **הבקשה חייבת להגיע מכתובת המייל הרשומה בחשבון.** זה הצעד שמגן על כולם – בלעדיו כל אחד יכול לבקש למחוק חשבון של מישהו אחר.
   הגיעה מכתובת אחרת? עונים ומבקשים שהבקשה תישלח (או תאושר) מהכתובת הרשומה, ולא מוחקים לפני כן. מי שאין לו גישה לכתובת הרשומה
   אינו ניתן לאימות – לא מוחקים לפי בקשתו (זה בדיוק מה שהנוהל נועד למנוע). החריג היחיד: הודעה שילד מתחת לגיל המינימלי יצר חשבון
   (מדיניות הפרטיות, סעיף 10 – "כתבו לנו ונמחק אותו"); אז מאמתים ככל האפשר (המבקש יודע את שם המשתמש ואת הכתובת הרשומה) ומוחקים לפי 9.1 שלב 3.
   **רושמים לעצמך את תאריך קבלת הבקשה** – 30 הימים נספרים ממנו.
   נוסח תשובה לכתובת לא מתאימה: _"שלום, כדי להגן על החשבון אנחנו מוחקים רק לפי בקשה שנשלחת מכתובת הדואר הרשומה בחשבון. אנא שלחו
   את הבקשה שוב מאותה כתובת – או, אם יש לכם גישה אליה, השתמשו ב'שכחתי סיסמה' במסך הכניסה ומחקו את החשבון בעצמכם בהגדרות."_
   (באנגלית: _"Hello, to protect the account we delete only on a request sent from the e-mail address registered in it. Please send the
   request again from that address – or, if you can receive mail there, use 'Forgot password?' on the sign-in screen and delete the
   account yourself in Settings."_)
2. **מציעים קודם את הדרך העצמית**, שעובדת לכל מי ששולט בכתובת הרשומה (כל עוד כרטיס הדואר מוגדר – HOSTED-DEPLOY, שלב ז): באתר
   `https://yourpersonaldiary.fly.dev` (או באפליקציה) "שכחת סיסמה?" ← הקישור או הקוד מהמייל ← סיסמה חדשה ← הגדרות ← "מחיקת חשבון".
   כך כתוב גם בדף מחיקת החשבון; החשבון נמחק מיד, בלי שאתה נוגע בו. נוסח אישור קבלה: _"שלום, קיבלנו את בקשתכם למחיקת החשבון
   ב-Your Personal Diary. החשבון והיומן יימחקו בתוך 30 יום (בדרך כלל באותו יום), ונכתוב שוב כשזה בוצע. כדי למחוק מיד בעצמכם:
   'שכחתי סיסמה' במסך הכניסה ← סיסמה חדשה ← הגדרות ← 'מחיקת חשבון'."_ (באנגלית: _"Hello, we received your request to delete your
   Your Personal Diary account. The account and its diary will be deleted within 30 days (usually the same day), and we will write again
   when it is done. To delete it yourself right away: 'Forgot password?' on the sign-in screen → new password → Settings → 'Delete account'."_)
3. **כשזה לא מתאים** (המבקש לא מצליח; הורה שמבקש למחוק חשבון של ילד מתחת לגיל המינימלי – מדיניות הפרטיות, סעיף 10; או שהמבקש פשוט
   רוצה שזה ייעשה בשבילו) – מוחקים בעצמך, **בשני שלבים, תמיד איתור לפני מחיקה**. הכי פשוט דרך האפליקציה: **הגדרות ← כרטיס "שרת" ←
   "בקשת מחיקה במייל"**: מקלידים את הכתובת שממנה הגיעה הבקשה, והכרטיס מציג את פקודת האיתור עם כפתור העתקה; אחרי האיתור מקלידים
   בכרטיס את שם המשתמש שהוא הדפיס, ומופיעה פקודת המחיקה עם כפתור העתקה. הכרטיס רק בונה טקסט: הוא לא שולח כלום לשרת ולא יכול למחוק
   בעצמו, ומה שהוקלד בו נשכח בנעילת האפליקציה. בלי האפליקציה – אותן שתי שורות ביד (`dana@example.com` ו-`dana` הם דוגמה בדויה):

   **שלב 1 – איתור (לא משנה כלום):**
   ```
   C:\Users\AVI\.fly\bin\flyctl.exe ssh console -a yourpersonaldiary -C 'node /app/admin.cjs find dana@example.com'
   ```
   מדפיס `Found one account:` ואת פרטי החשבון – שם משתמש, מייל, תאריך הרשמה, כניסה אחרונה, גודל היומן, מכשירים מחוברים, נעול?,
   מזהה – ואחריהם את פקודת המחיקה המוכנה (`To delete it in one line: ...`), גם כשורת PowerShell מלאה (`From Windows PowerShell on
   your computer:`; היא משתמשת ב-`--username` – שקולה לשורה של שלב 2). בודקים שהמייל שהודפס הוא **בדיוק** הכתובת שממנה הגיעה הבקשה.
   `No account has the username or e-mail address "..."` – אין חשבון עם הכתובת הזו (ההתאמה מדויקת, בלי הבדל בין אותיות גדולות
   לקטנות): עונים למבקש ששום חשבון לא רשום על הכתובת הזו ואין מה למחוק (_"שלום, לא רשום אצלנו חשבון עם כתובת הדואר הזו, ולכן אין מה
   למחוק. אם נרשמתם בכתובת אחרת – אנא כתבו מאותה כתובת."_). `Found 2 accounts` – לא אמור לקרות; הכלי מסרב למחוק התאמה כפולה, פונים לסשן הראשי.

   **שלב 2 – מחיקה, עם שם המשתמש שהאיתור הדפיס אחרי `--confirm`:**
   ```
   C:\Users\AVI\.fly\bin\flyctl.exe ssh console -a yourpersonaldiary -C 'node /app/admin.cjs delete --email dana@example.com --confirm dana'
   ```
   הכלי מציג שוב `This account will be deleted for good - its diary cannot be brought back:` עם שם המשתמש, תאריך ההרשמה וגודל היומן,
   מוחק, ומדפיס `Deleted: the account "dana" (registered 2026-10-20) with its diary, its sessions on every device and its pending
   password resets. Note today's date (2026-11-01 UTC) in your log.` נמחקים לצמיתות: החשבון, היומן (גם העותקים `.prev` ו-`.tmp`),
   החיבורים בכל המכשירים ובקשות איפוס ממתינות; חשבונות אחרים לא מושפעים. `--confirm` שאינו **בדיוק** שם המשתמש (גם אות גדולה במקום
   קטנה) – הכלי מסרב ולא מוחק דבר (`--confirm "X" is not exactly the username "dana" - nothing was deleted.`). בלי `--confirm` הכלי
   מבקש להקליד את שם המשתמש שוב (זה למעטפת האינטראקטיבית; דרך `-C` נותנים `--confirm`) – Enter ריק או סוף הקלט = לא אושר, לא נמחק
   (`Not confirmed - nothing was deleted.`).
4. **רושמים ועונים.** ביומן שלך: תאריך הבקשה, הכתובת, שם המשתמש ותאריך המחיקה – זה שהכלי הדפיס (UTC). למבקש עונים מ-`yourpersonaldiary29@gmail.com`
   (בלי פרטים אחרים של החשבון): _"שלום, החשבון <שם משתמש> והיומן שלו נמחקו מהשרת ב-<תאריך>. עותקים בצילומי האחסון היומיים של ספק האירוח
   נמחקים אוטומטית בתוך 30 יום, וארכיוני השרת המוצפנים מתחלפים בתוך כשלושה חודשים, כמפורט בדף מחיקת החשבון. קובצי גיבוי או ייצוא
   ששמרתם בעצמכם לא נפגעו – מחקו אותם בעצמכם אם תרצו."_ (באנגלית: _"Hello, the account <username> and its diary were deleted from the
   server on <date>. Copies in the hosting provider's daily storage snapshots are removed automatically within 30 days, and the encrypted
   server archives are replaced within about three months, as the account-deletion page explains. Backup or export files you saved
   yourself are not affected – delete them yourself if you wish."_)

אם החשבון שנמחק היה **חשבון הבעלים** (`DIARY_OWNER_ID`), הכלי מוסיף `This was the owner account (DIARY_OWNER_ID): the owner cards stay
off until DIARY_OWNER_ID names an existing account.` – כרטיסי "דואר אלקטרוני" ו"שרת" כבויים לכולם עד שהסוד מצביע על חשבון קיים
(HOSTED-DEPLOY, שלב ו). מוחקים את חשבון הבעלים רק בכוונה.

### 9.2 שחרור נעילה

10 סיסמאות שגויות ברצף נועלות ל-15 דקות **רק את הרשת של המנסה**; את בעל החשבון עצמו הן רק מאטות (השהיה גדלה לפני כל ניסיון נוסף).
לכן בדרך כלל מספיק לחכות. מי שכותב שהוא "נעול" ולא מצליח להיכנס גם אחרי רבע שעה – מאפסים לו את המונים (מאמתים קודם, כמו בבקשת
מחיקה, שהפנייה הגיעה מהכתובת הרשומה בחשבון, או לפחות שהוא יודע את שם המשתמש):
```
C:\Users\AVI\.fly\bin\flyctl.exe ssh console -a yourpersonaldiary -C 'node /app/admin.cjs unlock --username dana'
```
מדפיס `Unlocked: "dana" - its failed sign-in counters were reset; it can sign in right away.` – או `"dana" was not locked; its counters
were reset anyway.` כשלא הייתה נעילה (ואז הבעיה אחרת – סיסמה שגויה; מפנים ל"שכחת סיסמה?"). מתאפסים: נעילות הרשת של החשבון, ההשהיה
המתקדמת, נעילת "אישור בסיסמה" של ההגדרות ומונה קודי האיפוס השגויים. הסיסמה **לא** משתנה ושום דבר לא נמחק. אפשר גם `--email <מייל>`.

### 9.3 ניתוק מכל המכשירים

כל משתמש מנתק בעצמו מכשירים ב**הגדרות ← חשבון ← מכשירים מחוברים**, ושינוי סיסמה מנתק את כל השאר. ניתוק בשבילו – רק כשהוא לא יכול
להיכנס (טלפון אבד או נגנב עם האפליקציה פתוחה) וכתב מהכתובת הרשומה:
```
C:\Users\AVI\.fly\bin\flyctl.exe ssh console -a yourpersonaldiary -C 'node /app/admin.cjs revoke --username dana'
```
מדפיס `Signed out on every device: "dana" (2 sessions ended). The account and its diary stay.` ממליצים לו להחליף סיסמה מיד ("שכחת
סיסמה?" אם אינו זוכר אותה). היומן בשרת לא נפגע, והמכשיר שנותק לא יכול יותר לקרוא ממנו או לכתוב אליו בלי כניסה מחדש בסיסמה.

### 9.4 גל הרשמות מזויפות (ניצול לרעה)

הסימן: יותר מ-50 הרשמות ביממה בלוג (פרק 3) או בכרטיס "שרת" ("הרשמות ב-24 השעות"). קודם מסתכלים:
```
C:\Users\AVI\.fly\bin\flyctl.exe ssh console -a yourpersonaldiary -C 'node /app/admin.cjs list'
```
טבלה `USERNAME  E-MAIL  REGISTERED  LAST SIGN-IN  DIARY  DEVICES  STATE  ID`, מהישן לחדש, ובסוף `N accounts, oldest first.` חשבונות
מזויפים נראים כך: נרשמו בצרור באותו יום, יומן של 0 B או כמה בייטים, בלי כניסה אחרונה, שמות או כתובות ממוחזרים. מוחקים את **הברורים**
אחד-אחד – `delete --username <שם> --confirm <שם>` (כשיש ספק: `find` קודם, ומי שיש לו יומן אמיתי נשאר) – ואז עוצרים את הגל: סגירת
ההרשמה `flyctl secrets set DIARY_REGISTRATION=closed -a yourpersonaldiary` (מפעיל מחדש), או הרשמה עם קוד הזמנה – **רק** בפקודה של
פרק 10 (לעולם לא `invite` בלי `DIARY_INVITE_CODE`: בלי קוד השרת לא עולה והאתר לא זמין). מונים מהירים בלי טבלה: `status`.
`list --json` נותן את אותן שורות כ-JSON, ב-ASCII בלבד (אותיות לא לטיניות כ-`\uXXXX`, ולכן תקין בכל דף קוד), למי שרוצה לסנן ב-PowerShell –
למשל החשבונות עם יומן ריק:
```
C:\Users\AVI\.fly\bin\flyctl.exe ssh console -a yourpersonaldiary -C 'node /app/admin.cjs list --json' | Out-String | ConvertFrom-Json | Where-Object { $_.diaryBytes -eq 0 } | Select-Object username, email, createdAt
```
(לפלט הרגיל דרך צינור – שורת הקידוד `[Console]::OutputEncoding` מראש הפרק, אחרת העברית יוצאת ג'יבריש.)

### 9.5 שגיאות, ומה הכלי לא עושה

- `The admin token file /data/.admin-token does not exist. Is the server running?` או `Cannot reach the server at 127.0.0.1:8080` – השרת
  לא רץ או באמצע הפעלה מחדש: `flyctl status -a yourpersonaldiary` (פרק 1), ומנסים שוב בעוד דקה.
- `The server did not accept the admin token (answer 421)` (המספר הוא תשובת בדיקת ה-Host של השרת לפנייה הפנימית של הכלי; לעיתים 404) –
  השרת הופעל מחדש בין הקריאה לפקודה (האסימון מתחלף בכל הפעלה): פשוט מריצים שוב.
- `Wrong command line: ...` – טעות בשורה; `... -C 'node /app/admin.cjs help'` מדפיס את כל הצורות.
- `No account has ...` / `2 accounts match ...` – לא נמצא או התאמה כפולה; הכלי לא פועל על אף אחד מהם.
- קודי היציאה של הכלי (בתוך המכונה; דרך `flyctl` הם לא בהכרח מגיעים ל-`$LASTEXITCODE` במחשב שלך): `0` בוצע; `1` סורב, לא נמצא, לא אושר
  או נכשל בשרת; `2` שורת פקודה שגויה; `3` קובץ האסימון או השרת לא נגישים. לכן תמיד קוראים את ההודעה – היא אומרת בדיוק מה קרה ומה לא השתנה.
- הכלי **לא** פותח יומן, לא מציג רשומות, לא מאפס או משנה סיסמה, לא משנה כתובת מייל ולא יוצר חשבונות. מחיקה היא לצמיתות ואין "ביטול".
- אף פעם לא מוחקים ידנית קבצים של חשבונות ב-`/data` בזמן שהשרת רץ (HOSTED-DEPLOY, פרק 5 "מה לא לעשות") – לכן הכלי פועל מול השרת החי.

## 9א. מה תנאי השימוש מחייבים אותך (המפעיל)

תנאי השימוש (`legal/terms/terms-he.md`, באתר `/terms/`) כוללים שלוש התחייבויות שלך. אין להן כפתור באפליקציה – אתה מבצע אותן בעצמך, בדואר האלקטרוני ובכלי הניהול של פרק 9:

1. **חשבון נוסף לאותו אדם – רק באישור בכתב (סעיף 3).** מי שצריך יותר מחשבון אחד כותב ל-`yourpersonaldiary29@gmail.com`. אם אתה מאשר, ענה לו במייל ("מאושר: חשבון נוסף אחד עבור ...") ושמור את ההתכתבות – זה התיעוד שהחשבון הנוסף אושר. בשרת אין שום רישום כזה.
2. **סגירת חשבונות שנפתחו בלי אישור (סעיפים 3 ו-8).** כשברור שאותו אדם פתח כמה חשבונות בלי אישור: קודם הודעה אליו, היכן שאפשר באופן סביר (סעיף 8). אחר כך `find` ואז `delete` בכלי הניהול (9.1). גל הרשמות של זבל – 9.4. המחיקה סופית, והכלי מראה רק מייל ושם משתמש – לכן מחליטים רק לפי מה שברור.
3. **הודעה של 30 יום לפני שהשירות נסגר (סעיף 9).** אם תחליט אי פעם להפסיק את השירות:
   - **מודיעים:** הודעה באתר לפחות 30 יום מראש. זה שינוי בדף או בממשק ופריסה, ולכן צריך מפתח.
   - **ממתינים:** כל התקופה הזו השרת ממשיך לעבוד, כדי שכל אחד יוכל לקחת גיבוי וייצוא.
   - **מכבים:** רק אחר כך – ארכיון אחרון (פרק 6א) ומחיקת האפליקציה ב-Fly.

**שינוי בתנאים או במדיניות:**
1. משנים את הקבצים ב-`legal/`.
2. מעדכנים את התאריך ב-`legal/settings.json`: `termsEffectiveDate` לתנאים, `effectiveDate` למדיניות.
3. מריצים `node scripts/legal/build-pages.mjs`.
4. בונים ופורסים (פרק 11).

את שינוי חשוב מפרסמים בדף לפני שהוא חל (סעיף 13). כל חשבון שומר ב-`accounts.json` את גרסת התנאים והמדיניות שאושרה בהרשמה (`termsVersion`, `privacyVersion`).

## 10. סודות ומקרי חירום

| מצב | מה עושים |
|---|---|
| הרשמה רק עם קוד הזמנה (`invite`), או קוד הזמנה שדלף | מהחלון שלך, הקוד והמצב **באותה פקודה**: `flyctl secrets set DIARY_INVITE_CODE=<קוד-חדש> DIARY_REGISTRATION=invite -a yourpersonaldiary` (קוד של 8–64 תווים: אותיות באנגלית, ספרות, `-`, `_` או `.`; הוא יישאר בהיסטוריית הפקודות של PowerShell במחשב שלך). **לעולם לא** `DIARY_REGISTRATION=invite` לבד: בלי `DIARY_INVITE_CODE` – ושלב ט ב-HOSTED-DEPLOY מסיר אותו – השרת לא עולה, Fly מנסה להפעיל אותו שוב ושוב והאתר לא זמין. גם לא `set-secrets.ps1` בשביל הקוד: הוא שולח תמיד גם את מפתח השרת, ובלי `-FromDeviceKeyFile` – מפתח חדש ("זכור אותי" ואיפוס סיסמה נעצרים לכולם, כמו בשורה הבאה). במקום קוד: `DIARY_REGISTRATION=closed`; חזרה להרשמה פתוחה: `flyctl secrets set DIARY_REGISTRATION=open -a yourpersonaldiary`. |
| מפתח השרת אבד (אין עותק) | היומנים בטוחים (נפתחים בסיסמה). "זכור אותי" ואיפוס סיסמה מפסיקים לעבוד עד שכל משתמש נכנס פעם אחת עם הסיסמה (השרת יוצר אז עותק שחזור חדש). יוצרים מפתח חדש: `.\scripts\hosted\set-secrets.ps1 -NoInviteCode -KeyCopyFile <נתיב-חדש>` (הפעלה מחדש אוטומטית). אחר כך מכינים ארכיון חדש (פרק 6א): ארכיונים ישנים ישוחזרו בלי "זכור אותי" ואיפוס. |
| מפתח השרת וארכיון השרת | הארכיון **אף פעם** לא מכיל את המפתח. העותק שלך הוא מה שמשלים אותו, באחת משתי צורות (README סעיף 4.1): **הקובץ** `yourpersonaldiary-device-key-yourpersonaldiary.txt` ש-`set-secrets.ps1` כתב (בהתחלה ב-Documents) – שומרים אותו מחוץ לרשת (לא בתיקיית הפרויקט ולא בענן) וזוכרים איפה, כי תרגיל השחזור (פרק 6ב סעיף 2) מבקש את הנתיב שלו; **או השורה האחרונה שלו** (`DIARY_DEVICE_KEY=...`) במנהל הסיסמאות שלך, אם עשית את HOSTED-DEPLOY שלב ב.6 ומחקת את הקובץ – אז לתרגיל יוצרים ממנה קובץ זמני (פרק 6ב סעיף 2). בשתי הצורות העותק נשמר במקום אחר מהארכיון ומסיסמת הארכיון (כשהשורה במנהל הסיסמאות – את סיסמת הארכיון שומרים במקום אחר, למשל על נייר). אם בייצור המפתח הוא קובץ `/data/device.key` (העברה עם `-IncludeDeviceKey`) ולא סוד – שומרים עותק של ה-`device.key` מהמחשב, כי הארכיון מדלג עליו. |
| סיסמת הארכיון אבדה | את הארכיונים שהוצפנו בה אי אפשר לפתוח – אין דרך עקיפה. מכינים מיד ארכיון חדש עם סיסמה חדשה (פרק 6א) ומוחקים את הישנים מהכונן. |
| חשד שמפתח השרת נחשף | אותו צעד – מפתח חדש. תוצאה זהה: כניסה מחדש פעם אחת לכולם. |
| חשד שהחשבון ב-Fly נפרץ | `flyctl auth logout` בכל המחשבים, שינוי סיסמה + אימות דו-שלבי ב-fly.io, ואז מפתח חדש. |
| מישהו מנסה לנחש סיסמאות | כלום – הנעילה היא לפי רשת של התוקף (15 דקות), והיא מאיטה אבל לא נועלת את בעל החשבון. אם זה מציף את הלוג: `DIARY_REGISTRATION=closed` זמנית לא עוזר לכניסות; פשוט מחכים. אם בעל החשבון עצמו כותב שהוא נעול או מואט: `unlock` – פרק 9.2 (מאפס את המונים, לא את הסיסמה). |

שמות הסודות המוגדרים (בלי ערכים): `flyctl secrets list -a <app>`. ערך של סוד אי אפשר לקרוא בחזרה – בכוונה.

## 11. עדכוני תוכנה

- גרסה חדשה של השרת/הממשק: הסשן הראשי מריץ `.\scripts\hosted\deploy.ps1 -Staging`, בודק, ואז `.\scripts\hosted\deploy.ps1`. השבתה: שניות.
- **סדר נכון:** קודם השרת, אחר כך פרסום גרסאות האפליקציות (Windows / Android) שכותבות מבנה נתונים חדש. לעולם לא מחזירים את השרת לגרסה
  ישנה יותר ממה שהדיסק כבר מכיל – משחזרים מגיבוי במקום.
- פעם בחודש (סוכן): `npm audit --omit=dev` ועדכון תמונת הבסיס `node:24-alpine` ב-Dockerfile, ואז פריסה. פעם בשנה: מעבר Node גדול.
- אחרי כל פריסה הסקריפט כבר בודק בריאות וכותרות; כדאי גם כניסה אחת מהטלפון.

## 12. מעקב עלויות

מה משלמים (הערכה לפי דף המחירים של Fly, 2026-10): מכונה `shared-cpu-1x` 512 MB בפרנקפורט ≈ 3.5–4 $ לחודש; דיסק 0.15 $ ל-GB לחודש
(3 GB ≈ 0.45 $); צילומי דיסק – 10 GB הראשונים חינם, אחר כך 0.08 $ ל-GB; IPv4 משותף ותעודת `fly.dev` – חינם; תעבורה יוצאת – זניחה ליומן.
**ייצור ≈ 4–5 $ לחודש. ניסיון – אותו דבר כל עוד הוא רץ.**

- פעם בחודש: `flyctl dashboard -a yourpersonaldiary` ← Billing/Usage. חשבונית מעל 10 $ = משהו לא צפוי (מכונה שנייה? דיסק גדל? ניסיון רץ סתם?).
- ניסיון שלא בשימוש: `flyctl scale count 0 -a yourpersonaldiary-staging` (נשאר רק הדיסק, סנטים). להחזיר: `.\scripts\hosted\deploy.ps1 -Staging`.
  לסיים לגמרי: `flyctl apps destroy yourpersonaldiary-staging` (מוחק גם את הדיסק והצילומים שלו).
- לוודא שאין מכונות מיותרות: `flyctl machine list -a <app>` – שורה אחת.
- הגדלת זיכרון ל-1 GB מוסיפה בערך 2–3 $ לחודש; דיסק 10 GB ≈ 1.5 $.

## 13. גיליון פקודות

```
flyctl status -a <app>                                   מצב
flyctl logs -a <app> [--no-tail]                         לוג
flyctl machine list -a <app>                             מכונות (חייבת להיות אחת)
flyctl machine restart <id> -a <app> --signal SIGTERM --time 25
flyctl scale count 1 -a <app> -y                         להבטיח מכונה אחת
flyctl scale count 0 -a <app> -y                         להשבית (הדיסק נשאר)
flyctl scale memory 1024 -a <app>                        זיכרון
flyctl volumes list -a <app>                             דיסקים
flyctl volumes snapshots list <vol-id> -a <app>          צילומים
flyctl volumes snapshots create <vol-id> -a <app>        צילום עכשיו
flyctl volumes extend <vol-id> -s <GB> -a <app>          הגדלת דיסק
flyctl secrets list -a <app>                             שמות הסודות
flyctl secrets set NAME=VALUE -a <app>                   סוד/משתנה (מפעיל מחדש)
flyctl ssh console -a <app> [-C "<פקודה>"]               לתוך המכונה (רק אתה)
flyctl ssh console -a <app> -C "sh /app/smoke-smtp.sh"   בדיקת SMTP
flyctl ssh console -a <app> -C 'node /app/admin.cjs status'                    כלי הניהול (פרק 9): מונים. אחרי -C גרשיים בודדים
flyctl ssh console -a <app> -C 'node /app/admin.cjs list'                      כל החשבונות, מהישן לחדש (9.4)
flyctl ssh console -a <app> -C 'node /app/admin.cjs find <מייל-או-שם>'          חשבון אחד – לא משנה כלום (9.1 שלב 1)
flyctl ssh console -a <app> -C 'node /app/admin.cjs delete --email <מייל> --confirm <שם>'   מחיקה לפי בקשה (9.1 שלב 2)
flyctl ssh console -a <app> -C 'node /app/admin.cjs unlock --username <שם>'    שחרור נעילה (9.2)
flyctl ssh console -a <app> -C 'node /app/admin.cjs revoke --username <שם>'    ניתוק מכל המכשירים (9.3)
flyctl ssh sftp get <remote> <local> -a <app>            הורדת קובץ מהדיסק (ארכיון: הפקודה המוכנה בכרטיס "שרת", פרק 6א)
node scripts\hosted\restore-archive.mjs <file>.mpda <empty-dir>   פתיחת ארכיון שרת במחשב (פרק 6ב)
.\scripts\hosted\deploy.ps1 [-Staging]                   פריסה (הסשן הראשי)
.\scripts\hosted\set-secrets.ps1 ...                     סודות (אתה)
.\scripts\hosted\migrate-from-pc.ps1 -SourceDir ... [-DryRun]   העברה מהמחשב (הסשן הראשי איתך)
```
