# צילומי מסך ל-Microsoft Store – מדריך לבעלים

> **Your Personal Diary** · סבב שני (אוקטובר 2026) · אפליקציית Windows כ"לקוח רזה" של השרת, עם מצב לא מקוון אוטומטי.
> כל הצילומים כאן הם של הממשק **הנוכחי** של אפליקציית Windows (בניית ה-UI הראשית, לא בניית האנדרואיד), ב-20 שפות, עם חשבונות **בדויים** בלבד.

## מה יש בתיקייה

| נתיב | מה זה |
|---|---|
| `<tag>/01-home.png` … `<tag>/08-offline.png` | 8 צילומי מסך לכל שפת רישום (20 שפות = 160 קבצים), PNG ‏1920×1080 |
| `captions.json` | כיתוב (Caption) לכל צילום בכל שפה – עד 200 תווים |
| `render-log.json` | יומן ההפקה: גודל ו-SHA-256 של כל קובץ, שהפריסה נבדקה ("clean"), ושהדפדפן פנה רק ל-127.0.0.1 |
| `logos/` | לוגואים לחנות (מהסבב הראשון, עדיין תקפים – נוצרו מאייקון האפליקציה) |
| `_obsolete-2026-10-02/` | צילומי הסבב הראשון (האפליקציה המקומית הישנה). **לא להעלות.** נשמרו לעיון בלבד |

תגי השפות (תיקיות): `en-US` (ברירת המחדל), `he-IL`, `zh-CN`, `es-ES`, `pl-PL`, `ru-RU`, `fr-FR`, `ar-SA`, `ja-JP`, `tr-TR`, `cs-CZ`, `hu-HU`, `bg-BG`, `el-GR`, `pt-PT`, `de-DE`, `ro-RO`, `it-IT`, `th-TH`, `hi-IN`.

## הכללים של Microsoft (ציטוט)

מקור: [App screenshots, images, and trailers for MSIX app](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images) (נקרא ב-27.10.2026; הדף עודכן ב-24.08.2026).

- כמות: "Only one screenshot (for any device family) is required for your submission, though you can provide several; up to 10 desktop screenshots" – ובשאלות הנפוצות: "Microsoft recommends including 5–8 high-quality screenshots". **אצלנו: 8 לכל שפה.**
- פורמט ונפח: "Each screenshot must be a .png file in either landscape or portrait orientation, and the file size can't be larger than 50 MB". **אצלנו: PNG, ‏75–203 KB לקובץ.**
- גודל: "Desktop 1366 x 768 pixels or larger. Supports 4K images (3840 x 2160)". **אצלנו: 1920×1080 (לרוחב).**
- כיתוב: "You can also provide a short caption that describes each screenshot in 200 characters or less". **אצלנו: 28–158 תווים.**
- לכל שפה בנפרד: "You'll need to upload images for each language separately (even if you are using the same images), and provide captions to use for each language".
- סדר: "Screenshots are displayed in your listing in order. After you upload your screenshots, you can drag and drop them to reorder them."
- לוגואים (רשות לאפליקציות): "1:1 App tile icon (300 x 300 pixels) … We **strongly recommend** that you provide this image for your app"; ה-2:3 Poster art ‏(720×1080) וה-1:1 box art ‏(1080×1080) – "For games … This does not apply to apps".

## מה הולך לאן ב-Partner Center

1. Partner Center ← האפליקציה ← ההגשה (Submission) ← **Store listings** ← בוחרים שפה (למשל English (United States)).
2. בקטע **Screenshots** ← לשונית **Desktop** ← מעלים את 8 הקבצים של אותה שפה **לפי הסדר**: `01-home.png`, `02-diary.png`, … `08-offline.png` (מהתיקייה `store/screenshots/<tag>/` של אותה שפה).
3. לכל צילום מדביקים את הכיתוב שלו מ-`captions.json` (באותה שפה ובאותו שם קובץ). בעברית ובאנגלית הכיתובים מופיעים גם בטבלה למטה.
4. חוזרים על שלבים 1–3 לכל אחת מ-20 השפות (התג בשם התיקייה = שפת הרישום: `he-IL` = Hebrew (Israel) וכן הלאה).
5. בקטע **Store logos** (פעם אחת לכל שפה, אותו קובץ): **1:1 App tile icon (300 x 300)** ← `logos/app-tile-icon-300x300.png`. את `logos/poster-art-720x1080.png` ו-`logos/box-art-1080x1080.png` אפשר להשאיר ריקים (הם למשחקים).
6. דרך מהירה יותר ל-20 שפות: ייבוא CSV של הרישומים – `scripts/store/listing-csv.mjs` עם האפשרות `--screenshots` ממלא את הצילומים והכיתובים מהתיקייה הזו (ההוראות המלאות ב-`docs/STORE-RELEASE.he.md`).

## הצילומים (אותם 8 בכל שפה)

| # | קובץ | מה רואים |
|---|---|---|
| 1 | `01-home.png` | דף הבית: ברכה, "היום" (2 רשומות היום, רצף כתיבה), ממוצעי 7 ימים |
| 2 | `02-diary.png` | היומן שלי: סוף רשימת השבוע – אתמול והיום עם שתי הרשומות של היום |
| 3 | `03-entry.png` | רשומה אחת מלאה (19.10.2026): דירוגים, שינה, שחייה, רגשות, טקסט, הערות, תגית |
| 4 | `04-calendar.png` | לוח שנה של החודש: מצב רוח/אנרגיה/הרגלים/רשומות בכל יום. **עברית – הלוח העברי (חשוון תשפ"ז, ראש חודש)**, ערבית – הלוח ההיג'רי, שאר השפות – הגרגוריאני |
| 5 | `05-habits.png` | הרגלים: הליכה ושתיית מים עם רצפים ואחוזי השלמה |
| 6 | `06-insights.png` | תובנות: קבוצת "מגמות" עם כפתורי "למה קיבלתי את התובנה הזאת?" |
| 7 | `07-settings.png` | הגדרות: בורר השפה (20 שפות) וכרטיס החשבון עם "מכשירים מחוברים" (מחשב – המכשיר הנוכחי) |
| 8 | `08-offline.png` | כתיבה בלי חיבור: פס "אין חיבור – מה שתכתוב יישמר בשרת כשהחיבור יחזור" + "שינוי אחד ממתין" + תג "עוד לא הועלה" על הרשומה |

החשבונות הבדויים (שם פרטי מתוך דמויות הדמו של כל שפה + שם משפחה "פלוני" של אותה שפה, כתובת ‎@example.com): en-US Dana Doe · he-IL דנה ישראלי · zh-CN 张晓雯 · es-ES Lucía de Tal · pl-PL Anna Kowalska · ru-RU Анна Иванова · fr-FR Camille Dupont · ar-SA سارة الفلاني · ja-JP 山田美咲 · tr-TR Elif Yılmaz · cs-CZ Anna Nováková · hu-HU Minta Anna · bg-BG Мария Иванова · el-GR Μαρία Παπαδοπούλου · pt-PT Marta de Tal · de-DE Anna Mustermann · ro-RO Ana Popescu · it-IT Giulia Rossi · th-TH มาลี ใจดี · hi-IN प्रिया कुमार.

## כיתובים – אנגלית ועברית

(כל 20 השפות: `captions.json`.)

| קובץ | English (en-US) | עברית (he-IL) |
|---|---|---|
| 01-home.png | Home: today at a glance – your entries, your writing streak and the 7-day averages of mood, energy, stress and sleep. | דף הבית: היום במבט אחד – הרשומות שלכם, רצף הכתיבה וממוצעי מצב הרוח, האנרגיה, הלחץ והשינה בשבעת הימים האחרונים. |
| 02-diary.png | My diary: your entries day by day, each with its mood, energy, stress, sleep and emotions. | היומן שלי: הרשומות שלכם יום אחר יום, כל אחת עם מצב הרוח, האנרגיה, הלחץ, השינה והרגשות שלה. |
| 03-entry.png | An entry: your own text, ratings, sleep, exercise, emotions, notes and tags – write as much or as little as you like. | רשומה: טקסט חופשי, דירוגים, שינה, פעילות גופנית, רגשות, הערות ותגיות – כותבים כמה שרוצים. |
| 04-calendar.png | Calendar: mood, energy, habits and entries on every day of the month, in the Gregorian, Hebrew or Hijri calendar. | לוח שנה: מצב רוח, אנרגיה, הרגלים ורשומות בכל יום בחודש – בלוח הגרגוריאני, העברי או המוסלמי. |
| 05-habits.png | Habits: daily goals with streaks, 30-day completion and a quick way to log today's progress. | הרגלים: יעדים יומיים עם רצפים, אחוז השלמה ב-30 הימים האחרונים ועדכון מהיר של היום. |
| 06-insights.png | Insights: patterns found in your own entries – and each one explains why you got it. | תובנות: דפוסים שנמצאו ברשומות שלכם – וכל תובנה מסבירה למה קיבלתם אותה. |
| 07-settings.png | Settings: 20 interface languages, your account and the devices signed in to it. | הגדרות: 20 שפות ממשק, החשבון שלכם והמכשירים שמחוברים אליו. |
| 08-offline.png | No connection? Keep writing: the entry is saved on this device and uploaded to the server when the connection returns. | אין חיבור? ממשיכים לכתוב: הרשומה נשמרת במכשיר ועולה לשרת כשהחיבור חוזר. |

הכיתובים עומדים בכללי "טענות כנות" של הרישומים: אין "נשמר רק במחשב", אין "הצפנה מקצה לקצה", אין "חינם / הכי טוב", אין כתובות אתרים ואין אמוג'י.

## איך מייצרים מחדש (פקודה אחת)

מתיקיית הפרויקט:

```
node scripts/play/render-screenshots.mjs --profile desktop
node scripts/store-shots/check-screenshots.mjs
```

- הפקודה הראשונה בונה את ה-UI הראשי לתיקייה זמנית, מריצה מהקוד את השרת המתארח (DIARY_MODE=hosted) על 127.0.0.1 בלבד עם תיקיית נתונים זמנית, יוצרת 20 חשבונות בדויים עם נתוני הדמו של כל שפה, ומצלמת ב-Microsoft Edge ללא ממשק (חלון 1536×864 בקנה מידה 1.25 = ‏1920×1080 פיקסלים – חלון מוגדל במסך 1920×1080 עם הגדלה של 125% ב-Windows). בסוף התיקייה הזמנית נמחקת. כ-6 דקות.
- שפה אחת או צילום אחד: `--locale he-IL` ‏/ `--only 04`.
- דרישה מוקדמת (פעם אחת): `playwright-core` בתיקיית הכלים `mpd-store-tools` (לא בפרויקט עצמו); Edge מותקן ב-Windows 11.
- הבדיקה: `node --test scripts/store-shots/check-screenshots.test.mjs` (בדיקות הבודק עצמו).

## מה נבדק בכל צילום

- **כללי פריסה** (לפני שהקובץ נכתב): אף שורת טקסט לא חתוכה בכותרת העליונה או בתחתית החלון, אין מילה שבורה בין שורות, אין טקסט שנחתך ב"…" או בתיבה, ואין כפתור או לשונית ניווט שחציים מתחת לכותרת. הבדיקה נעשית גם לפי הדיו של האותיות עצמן (מדידת הגופן, לא רק לפי תיבת השורה): מתחת לשורה האחרונה נשארים לפחות 3 פיקסלים (CSS; ‏3.75 בתמונה) עד הקצה התחתון של התמונה, ושום שארית של אות (למשל הַמְזָה שמתחת לאלף בערבית) לא מציצה מתחת לכותרת. אם אין מיקום גלילה "נקי" – הצילום נכשל ולא נכתב.
- **קטעי תצוגה**: השרת מקצר את תקציר הרשומה ברשימה ל-160 תווים בלי "…" (נראה כמו מילה חתוכה). בצילומים, טקסטי הדמו של היום ושל אתמול שארוכים מזה קוצרו לפני הצילום למשפטים שלמים (שינוי בנתוני הדמו, לא באפליקציה). ברשומה שנכתבת בלי חיבור (צילום 8) יש שלושה משפטי דמו יותר מאשר ב-Google Play (הליכה אחר הצהריים, פגישה עם אחד מאנשי הדמו, ההערה של הדמו), כדי שהעמוד יהיה ארוך מספיק למיקום גלילה נקי – בלי טקסט שנוגע בכותרת או בקצה.
- **שפה וכיוון**: `lang` של הדף הוא שפת הסט, ו-`dir="rtl"` בעברית ובערבית.
- **פרטיות**: נתונים בדויים בלבד; מזהה החשבון וכתובת השרת לעולם לא מופיעים; הדפדפן פנה רק ל-127.0.0.1 (כל פנייה אחרת נחסמת ומכשילה את ההפקה).
- **דטרמיניזם**: שעון קבוע (יום שישי 23.10.2026, 21:30 UTC), ללא אנימציות, אותו פלט בכל הפקה.
- ובנוסף נבדקו בעין: כל 20 השפות (שפה נכונה, RTL, אין "טוען", אין מפתחות טקסט גולמיים, אין הודעות שגיאה).

## הערה על הגרסה בכותרת התחתונה

הכותרת התחתונה של האפליקציה מציגה `v0.1.0` (הגרסה של האפליקציה הנוכחית). אם חבילת ה-Store תצא בגרסה אחרת, כדאי לעדכן את גרסת האפליקציה ולהפיק את הצילומים מחדש (פקודה אחת, למעלה).
