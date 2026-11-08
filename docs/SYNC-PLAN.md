# Your Personal Diary – סנכרון בין המחשב לטלפון (תכנון)

נכתב 2026-10-16 (ARCHITECT, משימה קריאה-בלבד: `docs/android-tasks/SYNC-DESIGN.md`). המותג "Your Personal Diary" נשאר באנגלית. כל הדוגמאות בדויות.
חלק א' – סיכום בעברית לבעלים. חלק ב' – התכנון הטכני באנגלית (המחייב לבנייה).

---

## חלק א' – סיכום לבעלים (עברית)

### מה תקבל

- נרשמת בטלפון עם **אותו שם משתמש ואותה סיסמה** כמו במחשב, מחבר את חשבון Google שלך בכרטיס חדש בהגדרות
  ("סנכרון בין המכשירים שלי") – והיומן מהמחשב מופיע בטלפון. מכאן והלאה כל רשומה, הרגל, סימון הרגל ומחיקה
  שתעשה במכשיר אחד יופיעו בשני, גם כשאתה לא בבית וגם כשהמחשב כבוי (הטלפון מקבל את מה שהמחשב העלה
  בפעם האחרונה שהיה דלוק ומחובר).
- זה עובד לכל משתמש של התוכנה, לא רק לך: כל חשבון ביומן יכול לחבר חשבון Google משלו.
- ההבטחה נשמרת: מה שעולה ל-Google הוא **קבצים מוצפנים בלבד**. המפתח נגזר מהסיסמה שלך בלבד. Google (וגם אנחנו)
  רואים רק גושים חסרי משמעות, גודל קבצים ושעות. בלי הסיסמה אין גישה – לא לנו, לא ל-Google, לא למי שפרץ
  לחשבון ה-Google שלך. אין טלמטריה.

### איך זה עובד, בשתי שורות

הקבצים המוצפנים נשמרים **ב-Google Drive שלך**, בתיקייה פרטית וסמויה של האפליקציה (Google קוראים לה
"application data folder": היא לא מופיעה ב-Drive, ואפליקציה אחרת לא יכולה לגעת בה). כל מכשיר מעלה את
השינויים שלו ומוריד את השינויים של האחרים; ההצפנה והמיזוג נעשים במכשיר עצמו. לא צריך שרת, לא צריך
שהמחשב יהיה דלוק, לא צריך לפתוח פורטים בנתב (זה פותר את בעיית ה-CGNAT של הרשת הביתית), ולא עולה כסף.

### מה אתה תצטרך לעשות בעצמך (פעם אחת, כ-30–45 דקות, בלי קוד, בלי הרשאות מנהל)

הפעולות האלה נעשות באתר Google Cloud Console (console.cloud.google.com) עם חשבון ה-Google שלך. הסוכנים
יכינו לך מדריך עברי צעד-צעד עם צילומי מסך (`docs/SYNC-GOOGLE-SETUP.he.md`, חבילת עבודה WP-S8), ויתנו לך
בדיוק את הערכים שצריך להדביק.

1. **ליצור פרויקט** ב-Google Cloud Console (חינם; לא נדרש כרטיס אשראי).
2. **להפעיל את Google Drive API** בפרויקט (כפתור "Enable").
3. **למלא את מסך ההסכמה** (OAuth consent screen / "Google Auth platform"): סוג משתמשים "External", שם האפליקציה
   "Your Personal Diary", כתובת מייל לתמיכה (שלך – היא תוצג למשתמשים במסך ההסכמה של Google), קישור לדף
   הבית ולמדיניות הפרטיות (אותו דף פרטיות שממילא נדרש ל-Google Play, ראו `docs/ANDROID-PLAN.md` סעיף 7;
   שני הקישורים חייבים להיות באותו דומיין, למשל GitHub Pages), וההרשאה (scope) האחת: `drive.appdata`.
4. **לפרסם את האפליקציה ("In production")**. זה חשוב: כל עוד הפרויקט במצב "Testing", Google מפקיעה את
   האישור כל 7 ימים (תצטרך להתחבר מחדש כל שבוע) ורק רשימת בודקים מוגבלת יכולה להשתמש. מכיוון ש-`drive.appdata`
   היא הרשאה "לא רגישה" לפי Google, הפרסום **לא דורש בדיקת אבטחה** של Google.
5. **אימות המותג (brand verification)** – מומלץ, לא חובה לפעולה: כדי שמסך ההסכמה יציג את השם והלוגו של
   האפליקציה, Google מבקשת לאמת שהדומיין של דף הבית שלך (למשל `<שם>.github.io`) שייך לך דרך Google Search Console.
   בדרך כלל אוטומטי תוך דקות, לכל היותר 2–3 ימי עסקים.
6. **ליצור שני "לקוחות OAuth"** (Clients) באותו פרויקט:
   - מסוג **Desktop app** – למחשב. מקבלים "Client ID" ו-"Client secret"; מדביקים אותם בקובץ אחד בפרויקט
     (`shared/sync/google-client.ts`). Google מגדירה שבאפליקציות מותקנות ה-secret הזה אינו סוד אמיתי, אז מותר
     שיהיה בתוך התוכנה.
   - מסוג **Android** – לטלפון. צריך את שם החבילה `app.yourpersonaldiary` (ה-applicationId מ-2026-10-25; לא `com.mydiary.app`) ואת "טביעת האצבע SHA-1" של מפתח החתימה.
     הסוכנים יפיקו לך את טביעות האצבע (אחת למפתח הפיתוח, ואחת למפתח ההעלאה/החתימה של Google Play – אותה
     מוצאים ב-Play Console אחרי העלאה ראשונה). בלי זה הכפתור "חבר את Google Drive" בטלפון לא יעבוד.
7. **בתור משתמש** (אחרי שהגרסה תיבנה): בטלפון – להירשם עם אותו שם משתמש ואותה סיסמה כמו במחשב; בשני
   המכשירים – הגדרות → "סנכרון בין המכשירים שלי" → "חבר את Google Drive" → לבחור **אותו חשבון Google**
   בשניהם → להקליד את סיסמת היומן פעם אחת (ממנה נגזר מפתח ההצפנה; היא לא נשמרת ולא נשלחת לשום מקום).

**מה לא צריך**: לא שרת, לא דומיין, לא תשלום, לא פתיחת פורטים, לא הרשאות מנהל במחשב.

### דברים שחשוב לדעת

- **הסנכרון קורה כשהאפליקציה פתוחה**: בפתיחה, בחזרה אליה, כמה שניות אחרי כל שינוי, כל 5 דקות, וכשלוחצים
  "סנכרן עכשיו". כשהאפליקציה סגורה לגמרי הטלפון לא מסנכרן ברקע (Android מגביל את זה, וממילא הסנכרון דורש
  את מפתח היומן שנמצא רק כשהיומן פתוח). בפועל: פותחים את האפליקציה בטלפון – ותוך שניות רואים מה שנכתב במחשב.
- **שינוי סיסמה** באחד המכשירים: המכשיר השני יקבל הודעה "הסיסמה שונתה במכשיר אחר" ויבקש להתחבר עם הסיסמה
  החדשה. כל מה שצריך לזכור: סיסמה אחת לכל המכשירים.
- **אותה רשומה נערכה בשני מכשירים כשהם לא היו מחוברים** (נדיר): העריכה המאוחרת יותר "מנצחת", והגרסה השנייה
  נשמרת כרשומה נוספת באותו יום עם סימון "עותק מהתנגשות – נערך בשני מכשירים", כדי ששום מילה לא תאבד. אתה מוחק
  את מה שלא צריך.
- **מכשיר אבד**: במכשיר השני – "הסר מכשיר" בכרטיס הסנכרון, לשנות סיסמה (אז המכשיר האבוד לא יוכל לקרוא שום
  דבר חדש), ובחשבון Google – "אבטחה → גישה של צד שלישי" → להסיר את Your Personal Diary (מבטל את האישור
  של כל המכשירים; מתחברים מחדש במכשיר שנשאר).
- **שכחת את הסיסמה**: הסנכרון לא עוזר כאן – הקבצים בענן מוצפנים באותה סיסמה. "שכחתי סיסמה" ממשיך לעבוד רק
  כמו היום (איפוס במייל, במכשיר שבו החשבון נמצא).
- **מה Google רואה**: שיש אפליקציה בשם Your Personal Diary עם קבצים מוצפנים בתיקייה הסמויה שלה, את גודלם,
  את זמני העדכון ואת מספר המכשירים. לא תוכן, לא שם משתמש, לא כתובות מייל של חשבונות היומן.
- **טלפון בלי שירותי Google** (למשל Huawei חדש): חיבור Google לא יעבוד שם. לכך יש "סנכרון ברשת הביתית"
  (אופציונלי, שלב המשך) שעובד רק כשהטלפון והמחשב באותו Wi-Fi.
- **iPhone בעתיד**: אותו מנגנון, עם לקוח OAuth מסוג iOS (דורש חשבון מפתח של Apple).

### החלטות שצריך ממך (אפשר לענות בעברית חופשית)

1. **Google Drive בלבד** בשלב הראשון (OneDrive/iCloud אולי בהמשך)? ההמלצה: כן.
2. מסך ההסכמה של Google יציג את **כתובת המייל שלך לתמיכה** לכל משתמש שמחבר את Drive – מקובל עליך?
3. "עותק מהתנגשות" (ההמלצה) – או שהעריכה המאוחרת פשוט מנצחת בשקט?
4. כשמוחקים חשבון במכשיר: למחוק גם את העותק המוצפן מ-Google Drive? ההמלצה: לשאול בכל פעם, ברירת מחדל "לא".
5. האם להשקיע גם בסנכרון ברשת הביתית (WP-S7) – בעיקר לטלפונים בלי Google ולמי שלא רוצה ענן בכלל?

---

## Part B – Technical design (English)

### 0. Baseline: what the code does today (evidence)

All quotes are from the tree at `C:\Users\AVI\Projects\my-personal-diary` on 2026-10-16.

**Storage and crypto.** One encrypted container per account and per backup, `server/src/security/container.ts`:
"offset 0 8 magic `MPDIARY\x01` / 8 1 version = 1 / 9 4 scrypt N / 13 4 scrypt r / 17 4 scrypt p / 21 16 salt /
37 12 nonce (random per write) / 49 ... AES-256-GCM ciphertext || tag"; "AAD = the 49 header bytes ... The plaintext is
the raw SQLite image." `encryptContainer(plain, key, salt, kdf)` accepts any plaintext, not only SQLite. Keys:
`server/src/security/kdf.ts` – `DEFAULT_KDF = { N: 32768, r: 8, p: 1 }` ("~32 MB of memory, tens of milliseconds"),
`deriveSecret` NFKC-normalises the password, `splitSecret` gives `key = secret[0..32]` and the verifier source;
`accounts.json` stores `verifierHex`, `kdf.saltHex` and `recoveryWrappedKey` ("wrapped (AES-256-GCM) with the device key
(device.key), AAD bound to this account id ... Never sent to a client", `session-types.ts`). Every device creates its own
account with its own random salt (`register`: `const salt = newSalt()`), so **the same password yields a different diary
key on each device** – the sync key cannot be the local diary key.

**Persistence.** `server/src/security/vault.ts`: "`db.onWrite` schedules a persist 250 ms later" (`PERSIST_DEBOUNCE_MS = 250`),
"persist = export SQLite image -> encryptContainer -> write `<file>.tmp` -> fsync -> rename"; `DiaryDb.writeSequence`
lets a writer know whether anything changed meanwhile. On the phone `mobile/core/boot.ts` persists "at once
(`persistIfDirty`) ... before the answer is given" and reports `storage-failed` / `storage-recovered`.

**Ids and clocks.** `server/src/db/schema.ts` (`SCHEMA_VERSION = 1`): `entries.id INTEGER PRIMARY KEY AUTOINCREMENT`,
`habits.id INTEGER PRIMARY KEY AUTOINCREMENT`, `habit_logs ... UNIQUE(habit_id, date)`, `settings(key TEXT PRIMARY KEY, value)`,
`meta(key, value)`. `entries` has `created_at`/`updated_at` (set by `createEntry`/`updateEntry` with `nowIso()` = the
device's wall clock); `habits` has `created_at` only; `habit_logs` has no timestamp at all (`logHabit` is an
`ON CONFLICT(habit_id, date) DO UPDATE`). A newer schema is refused with `NewerSchemaError` ("written by a newer version
of the app ... Please update the app"). Usernames cannot be renamed: `ProfilePatch` has only `firstName`, `lastName`,
`email` (`session-types.ts`), and `accounts.ts` keeps them unique case-insensitively (`usernameLower`).

**Password change / reset.** `auth-service.ts` `changePasswordLocked`: "the re-encrypted file first ... then the verifier,
then the remembered keys", then "Every other device is signed out"; `resetPasswordLocked` opens the diary with the recovery
key and "re-encrypted under a key derived from `newPassword` with a new salt"; both run under `withAccountLock`. These are
the two hooks the sync design reuses.

**Settings.** `settings-repo.ts` `DEFAULT_SETTINGS`: `autoLockMinutes, offlinePrivacyMode, theme, fontScale, remindersEnabled,
firstDayOfWeek, reduceMotion, defaultPeriod, calendarExtras, language`.

**Network policy.** `scripts/check-no-network.mjs`: outbound code is allowed only in `server/src/remote/` to
`REMOTE_HOSTS = ['acme-v02.api.letsencrypt.org', 'acme-staging-v02.api.letsencrypt.org', 'www.duckdns.org']` and in
`server/src/mail/` (`node:net`/`node:tls` only); `SERVER_OUTBOUND = /\bfetch\(|\bhttp\.(?:request|get)\(|.../` is forbidden
elsewhere under `server/src/` and `shared/`; `FORBIDDEN` flags every `https?://` URL except loopback; "mobile/ gets the same
rules as the frontend and has no allow-list entry"; the Android manifest may declare only `android.permission.INTERNET`.
Secrets of optional features are stored "encrypted with the device key (AES-256-GCM, its own AAD)" –
`remote/settings.ts` (`duckdnsTokenEnc`, AAD `mpd-duckdns-token-v1`) and `mail/settings.ts` (`passwordEnc`); the API
reports only `tokenSet` / `smtpPasswordSet`. Composition of optional services: `server/src/server.ts` builds
`RemoteManager` and `MailService` next to `createAuthService` and calls `remote.resume()`; `mobile/core/boot.ts` composes
the same services for the phone "as server.ts composes them", with injected transports.

**Phone runtime.** `mobile/index.html` CSP: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; ...;
connect-src 'self'; worker-src 'self' blob:` – the WebView (and the blob: worker, which inherits the document's CSP) cannot
open any connection today. The worker protocol (`mobile/shared/transport.ts`, `CORE_PROTOCOL_VERSION = 1`) has
host→core requests/controls (`['flushAll', 'lockAll', 'shutdown']`) and core→host events; the storage RPC
(`mobile/shared/storage-protocol.ts`) is the existing core→host call pattern. `AndroidManifest.xml`: `INTERNET` only,
`usesCleartextTraffic="false"`, `applicationId app.yourpersonaldiary` (build.gradle, since 2026-10-25; the Java namespace stays com.mydiary.app). Desktop shell: `src-tauri/capabilities/default.json`
grants `dialog:*` and `notification:default` only; `Cargo.toml` already has `tauri-plugin-shell` (sidecar); the desktop
CSP allows `connect-src 'self' http://127.0.0.1:* http://localhost:* ipc: ...` – the UI never talks to the internet, the
Node sidecar does.

**Sizes measured** (demo data = short entries, ~90 characters of body+notes; command in Appendix A):

| demo `days` | entries | habit logs | SQLite image | `.mpd` container | gzip(image) | entries as JSON | gzip(JSON) |
|---|---|---|---|---|---|---|---|
| 120 | 128 | 364 | 132.0 KB | 132.1 KB | 25.0 KB | 60.6 KB (485 B/entry) | 7.6 KB |
| 365 | 380 | 1,122 | 292.0 KB | 292.1 KB | 60.5 KB | 180.5 KB | 19.4 KB |
| 730 | 722 | 2,266 | 504.0 KB | 504.1 KB | 108.3 KB | 343.2 KB | 35.2 KB |

The committed compat fixture (`mobile/test/fixtures/manifest.json`: 50 entries, 5 habits, 136 logs) is an 81,985-byte
container over an 81,920-byte image (20 SQLite pages of 4 KB). The design brief's "120 entries = 53 KB" is lower than the
measurement above because the demo seeder also writes ~3 habit logs per day; the order of magnitude is the same. A habit
log is 81 B as JSON. Extrapolation for a 5-year diary (1,825 entries): demo-length texts ≈ 1.3 MB image / ≈ 0.3 MB gzip;
realistic texts (1,500 characters, Hebrew = 2 bytes per character) ≈ 6–7 MB image / ≈ 2 MB gzip; one day's changes are
typically 1–10 KB.

### 1. Transport

Requirements that decide it: the owner is behind carrier-grade NAT (the PC is unreachable from outside, the PC may be
off), he cannot host anything and has no admin rights, every user must be able to use it, only ciphertext may leave the
device, no telemetry.

| | (a) user's own cloud, app-private folder via official API (Google Drive `appDataFolder`) | (b) user-chosen folder of an existing cloud client (OneDrive/Drive folder on Windows, SAF tree on Android) | (c) direct LAN sync PC↔phone | (d) relay server (owner's or ours) | (e) WebRTC peer-to-peer |
|---|---|---|---|---|---|
| Works away from home, PC off | yes | yes | **no** (home Wi-Fi only, PC on) | yes | **no** when the PC is off; needs signalling |
| CGNAT | irrelevant (both devices call out) | irrelevant | n/a | relay must be hosted outside the home | needs TURN relay behind CGNAT |
| What the owner must do once | Cloud Console project, consent screen, publish, 2 OAuth clients (section A) | nothing on the server side; every user picks a folder on each device | nothing | host/pay/operate a server – **the owner cannot host (CGNAT)**; "us" means cost and trust forever | run a signalling (+TURN) server – same as (d) |
| What a user does | tap "Connect Google Drive", pick the account | install OneDrive/Drive client on BOTH devices, pick the same folder, keep the client signed in | be at home | create an account with us | same as (d) |
| Change detection | `files.list` by `appProperties` (100 quota units), `modifiedTime`/`version` fields; `changes.list` supports `spaces=appDataFolder` | **unreliable**: Windows placeholders are "dehydrated" until opened (Cloud Files API), upload is asynchronous and the sync client "must handle merges according to their own specifications"; Android SAF gives no change feed, `takePersistableUriPermission` is lost "if the associated document is moved or deleted", cloud providers may expose "virtual files", the `Download` tree cannot be chosen (API 30+) | immediate | immediate | immediate |
| Background refresh | app-open only on the phone (section 4.3) | same, plus depends on the third-party client's own schedule | app-open, same Wi-Fi | same | same |
| Privacy | provider sees ciphertext, sizes, times, device count; scope is "non-sensitive", folder "hidden from the user and from other Google Drive apps" | provider sees the same; plus the folder is visible and editable by the user and every other app → accidental deletion/edit | nothing leaves the home | relay operator sees ciphertext + metadata + IP addresses of all users; a single point of failure and of trust | signalling server sees who talks to whom |
| Zero-knowledge possible | yes | yes | yes | yes | yes |
| Cost | free (Drive API, user's own quota) | free | free | money + operations + a privacy policy for a service we run | money (TURN bandwidth) |
| Verdict | **primary** | rejected (reliability, UX of two clients, user-visible folder) | **secondary, optional** (phones without Google Play, "no cloud at all" users) | rejected | rejected |

**Why (a) and specifically Google Drive first.** Evidence from developers.google.com:
- Folder semantics: "The application data folder is a special hidden folder that your app can use to store
  application-specific data ... only accessible by your app and its contents are hidden from the user and from other
  Google Drive apps"; it "can't be accessed using the Drive user interface"; files cannot be shared/moved/trashed
  (`notSupportedForAppDataFolderFiles`); "deleted when a user uninstalls your app from their My Drive"
  (Drive guide `appdata`).
- Scope class: `https://www.googleapis.com/auth/drive.appdata` – "View and manage the app's own configuration data in
  your Google Drive" – is listed among the **non-sensitive** scopes that "only require basic" OAuth app verification
  (guide `api-specific-auth`); the consent-screen guide recommends to "identify alternative non-sensitive scopes to avoid
  unnecessary additional reviews".
- Publishing: a project in **Testing** gets refresh tokens that "expire after 7 days" (OAuth 2.0 overview, expiration
  section); the owner must therefore publish ("In production"). Brand verification is required only when "Your app's user
  type is External and its status is Published" and "You want your app to display a logo or display name"; it needs a
  public home page, a privacy policy "hosted on the same domain as the home page" and domain ownership in Search Console;
  "Automated review usually finishes within a few minutes ... manual review usually take 2–3 business days"
  (`production-readiness/brand-verification`). The limit on test users is documented only on support.google.com (not on
  the allowed host list) – treat "Testing" as unusable for real users regardless.
- Quotas (guide `limits`): 1,000,000 quota units per minute per project and 325,000 per user per minute; `files.list` 100
  units, `files.get` 5, downloads 200, `files.update` 50; over-quota answers 403 "User rate limit exceeded" / 429, handled
  with exponential backoff. A sync run of section 4 costs ≈ 400 units; polling every 5 minutes ≈ 30,000 units per day per
  user – three orders of magnitude below the limits. Storage counts against the user's own Drive quota (15 GB free);
  `about.get` with `fields=storageQuota,user` is allowed with `drive.appdata` and gives the usage and the account e-mail
  for the status card.
- Uploads (guide `manage-uploads`): simple/multipart "5 MB or less", resumable above; "To update an existing file, use
  `PATCH`". Custom metadata: `appProperties` ("private to the requesting app"), "Maximum of 30 private properties per
  file", "124 bytes per property string (including both key and value)"; searchable with
  `appProperties has { key='space' and value='…' }` (guides `properties`, `search-files`).
- OAuth for the desktop (guide `native-app`): "it is assumed that these apps cannot keep secrets" (the Desktop client's
  `client_secret` may ship inside the app); the loopback redirect – "start an HTTP listener on a random available port",
  redirect URI `http://127.0.0.1:port` – is "the recommended mechanism" for "macOS, Linux, and Windows desktop" apps;
  installed apps "must open the system browser" (an embedded WebView answers `disallowed_useragent`); PKCE S256; "refresh
  tokens are always returned for installed applications"; token endpoint `https://oauth2.googleapis.com/token` with
  `code`, `client_id`, `client_secret` (optional), `redirect_uri`, `grant_type`, `code_verifier`.
- OAuth for Android (developer.android.com `identity/authorization`): Google's supported path is Google Identity
  Services' `AuthorizationClient` (`play-services-auth`), which needs "an Android client ID for your app ... your app's
  package name and SHA-1 signature"; the result carries `accessToken` ("lifespan of one hour"); storing refresh tokens on
  the device is "strongly discouraged" – with `AuthorizationClient` the phone never holds one (it asks Play services again,
  silently once consent was given). The loopback redirect "is DEPRECATED for Android" and "Custom URI schemes are no
  longer supported due to the risk of app impersonation" (guide `native-app`), so AppAuth-style Custom Tabs flows are not
  an option for a new Android client. Consequence: phones without Google Play services cannot connect Google Drive →
  transport (c).
- OneDrive as a later second provider: the App Folder needs `Files.ReadWrite.AppFolder`, lives in `Apps/<app name>`
  and "users can add, modify, and remove content from it" (learn.microsoft.com, `special-folders-appfolder`) – the same
  store interface fits (section 4.1), but the folder is user-visible, which is why Google's hidden folder is first.

**Why not (b).** Windows: OneDrive/Drive-for-desktop expose files as Cloud Files placeholders that hydrate on open
("Placeholder file: An empty representation of the file and only available if the sync service is available";
"the local sync client must handle merges according to their own specifications" – learn.microsoft.com `cfapi`), so a
`.mpd`-style write by our app is uploaded whenever the client decides, two clients writing the same file name produce
provider-specific conflict copies, and a watcher sees neither the upload state nor remote changes before hydration.
Android: a SAF tree on a cloud provider has no change feed, may serve "virtual files", loses the grant when the folder
is moved, and the user must install and sign in to a second app. For a non-programmer this is two products to keep
healthy; for us it is unobservable failure modes. Rejected.

**Why not (d)/(e).** The owner cannot run a server (CGNAT, no admin rights, PC off). A relay "by us" means a hosted
service, a privacy policy and uptime for every user forever, payment, and a trust relationship the app's promise ("no
cloud") explicitly avoids – even if it only forwards ciphertext, it learns IP addresses and the social graph of devices.
WebRTC needs the same signalling server plus TURN (behind CGNAT most direct connections fail), and both peers must be
online at the same time – which is exactly the case the owner says will not hold (PC off). Rejected.

**Recommendation.** Primary: (a) Google Drive `appDataFolder`, `drive.appdata` scope only, Desktop-app client on Windows
(loopback redirect served by the existing local Node listener), Android client via `AuthorizationClient` in a tiny local
Capacitor plugin. Secondary, optional and cheap because it shares the engine and only swaps the store (section 4.1):
(c) LAN sync, where the PC's existing LAN listener (`lanEnabled`) hosts the same file-store protocol and the phone pushes/pulls
over the home Wi-Fi. Both move ciphertext only.

### 2. Identity and keys

**The user's story is "same username and password on both devices".** Nothing else is typed: no pairing codes, no
space names. Everything below derives from (Google account, username, password).

2.1 **Sync space.** One space per diary account: `spaceId = hex(sha256('mpd-sync-space-v1:' + usernameLower))[0..32]`.
The Google account separates people (each `appDataFolder` belongs to one Google account and one OAuth client), so two
different people with the same username on two different Google accounts never meet; the same person's two devices meet
because they use the same Google account and the same username. The space is addressed by Drive `appProperties`
(`space=<spaceId>`) and a file-name prefix; the username itself is never stored in clear (only its hash), and no e-mail or
display name of the diary account is written anywhere in Drive.

2.2 **Sync key: dedicated, derived from the password with a space salt.** Reusing the local container salt is impossible
(each device has its own salt, section 0). So the creator of a space draws a fresh `spaceSalt` (16 B) and every device
derives `syncSecret = scrypt(password NFKC, spaceSalt, N=2^15, r=8, p=1, 64 B)` with the existing `deriveSecret`, then
`splitSecret`: `syncKey = secret[0..32]`, `verifierHex = sha256(secret[32..64])`. The same primitives, parameters and
verifier construction as `accounts.json` – nothing new to audit. The sync key is independent of the local diary key: a
password change rotates it (2.4) without touching how each device encrypts its local file, and vice versa.

2.3 **Space manifest (plain JSON, written once, immutable):** `mpd.<spaceId>.space.json`
`{ "format": 1, "space": "<id>", "usernameHash": "<sha256 hex>", "kdf": {"N":32768,"r":8,"p":1}, "gen": 1,
  "saltHex": "...", "verifierHex": "...", "createdAt": "...", "createdBy": "<deviceId>" }`.
A device that connects: lists the space; if no manifest exists it creates one (it is the first device); otherwise it derives
the key from the manifest's salt and compares the verifier:
- match → connected;
- mismatch → "A synced diary named *dana* already exists in this Google account, but its password differs from the one you
  entered. Use the same password on both devices." (no data is downloaded, nothing is written);
- two devices creating the same space concurrently (both registered offline, both connect at the same minute): Drive
  allows two files with the same name; readers take the manifest with the earliest server-side `createdTime`; the loser
  notices its own `createdBy` is not the winner's, asks for the password once more and re-derives with the winner's salt,
  then re-uploads its data. Rare and self-healing.

2.4 **Password change while another device is offline – generations.** The sync key of generation *g* is `K_g`.
Device A changes the password (`changePasswordLocked`, under `withAccountLock`): it derives `K_{g+1}` from the new
password with a new salt, uploads `mpd.<space>.gen.<g+1>.<deviceId>.json` (plain: salt, verifier, createdAt, by) and
`mpd.<space>.rekey.<g+1>.<deviceId>.bin` = `encryptContainer(K_{g+1} || newSalt, key=K_g)` (an envelope only a holder of
`K_g` can open), then writes its next segments/snapshot under `K_{g+1}`. Device B comes online later:
1. it sees a generation higher than the one it knows, opens the envelope with its stored `K_g` → has `K_{g+1}` → keeps
   syncing with no user action (its reads and writes continue);
2. its **local account** still has the old password. B does exactly what the desktop already does when a password is
   changed elsewhere ("Every other device is signed out"): it removes its sessions, stores a `passwordChangedElsewhere`
   marker with the new verifier in `sync.json`, and shows "Your password was changed on another device on 12 Oct. Sign in
   with the new password." At the next sign-in B checks the typed password against the **cloud verifier** (scrypt with the
   generation salt); on success it runs the existing `resetPassword(userId, newPassword)` path: the local diary key is
   recovered from `recoveryWrappedKey` (device-wrapped, never leaves B) and the local file is re-encrypted under the new
   password. The old password is refused from the moment B learned of the change (same semantics as the desktop today).
   `recoveryWrappedKey` exists for every account that signed in since the feature existed, and connecting sync requires a
   sign-in, so the path is always available; the fallback for an account whose recovery blob is unreadable (device.key
   replaced) is the current behaviour for that case: sign in once with the old password, then the app asks for the new one
   and runs `changePassword(old, new)`.
3. Two devices change the password while both are offline: two `gen.<g+1>` files. Deterministic winner: earliest
   `createdAt`, ties by `deviceId`; the loser can open the winner's envelope (both are under `K_g`), adopts `K_{g+1}` of the
   winner, re-encrypts what it uploaded under its own candidate key, and its local account is switched to the winner's
   password by the step-2 flow ("the password set on *Computer* on 12 Oct is the one to use"). Nothing is lost; the user
   learns which password won.

2.5 **What is stored on each device** (`<dataDir>/sync.json`, written atomically like `accounts.json`):
`{ "version": 1, "deviceId": "<8 random bytes hex>", "deviceName": "...", "accounts": { "<accountId>": { "provider": "gdrive",
  "space": "<id>", "gen": 3, "syncKeyWrapped": "<base64 nonce|ct|tag>", "googleRefreshTokenEnc": "<desktop only>",
  "googleAccount": "<e-mail shown in the card>", "cursors": { "<deviceId>": { "snap": 4, "log": 17 } }, "ownSeq": 42,
  "lastSyncAt": "...", "lastError": null, "passwordChangedElsewhere": null } } }`.
`syncKeyWrapped` and the refresh token are AES-256-GCM under `device.key` with their own AADs
(`mpd-sync-key-v1:<accountId>`, `mpd-google-refresh-v1:<accountId>`) – the same class of exposure as `remember me`, the
recovery key, the DuckDNS token and the SMTP password today (documented trade-off in ARCHITECTURE.md 5.1). Without a
cached, wrapped sync key a remember-me start could not sync; scrypt runs once at connect and once per generation change,
never per sync run. The device-wrapped **recovery key never leaves the device** and is not part of any sync file.

2.6 **Wrong password, renamed, deleted, clashes.** Wrong password → verifier mismatch → the message of 2.3, no access, no
scrypt beyond one derivation (the account lockout counter `CONFIRM_LOCKOUT_PREFIX` applies because the route first
confirms the password locally). Renamed account → impossible (no username change in the API), so the space id is stable;
first/last name and e-mail changes are local profile data and are not synced. Deleted account → the deletion dialog asks
"Also delete the synced copy in Google Drive?" (default no, needs the password); when yes, the device deletes every file
of the space and writes `mpd.<space>.deleted.json`; another device that finds the marker stops with "The synced copy was
deleted from Google Drive on 12 Oct from *Phone*" and offers "Connect again (upload this device's diary)". Two different
people with the same username on two different Google accounts → two `appDataFolder`s, no clash. Two people sharing one
Google account with the same username → verifier mismatch → the 2.3 message plus the hint "or connect a different Google
account".

2.7 **Google identity on each platform.**
- Windows: `POST /api/sync/google/start` (loopback only, signed in) creates `state` + PKCE verifier and returns the
  authorization URL (`accounts.google.com/o/oauth2/v2/auth`, `scope=https://www.googleapis.com/auth/drive.appdata`,
  `access_type=offline`, `prompt=consent`, `redirect_uri=http://127.0.0.1:<port>/api/sync/google/callback`, the real port
  of the running server – Google accepts any loopback port for Desktop clients); the UI opens it in the system browser
  through Tauri's opener plugin (`opener:allow-open-url` for `https://accounts.google.com/*`; `tauri-plugin-shell`'s
  deprecated `open` would also do). The callback route on the existing 127.0.0.1 listener verifies `state`, exchanges the
  code at `oauth2.googleapis.com/token`, stores the refresh token wrapped, and answers a small localized HTML page
  ("You can close this tab and return to Your Personal Diary"). No new port, no deep link, no registry change, no admin.
- Android: `mobile/plugins/diary-google-auth` (Java, `play-services-auth`) calls
  `Identity.getAuthorizationClient(activity).authorize(request)` with the Drive app-data scope; if `hasResolution()` the
  account picker/consent appears once; the plugin returns `accessToken` only. The worker asks the host for a token
  through a new core→host RPC (`mobile/shared/sync-protocol.ts`, modelled on `storage-protocol.ts`), caches it for its
  lifetime (≤ 1 h) and asks again on 401. Nothing persists. Requires the Android OAuth client (package + SHA-1 of the
  debug key and of the Play upload/app-signing key) in the owner's project.
- iOS later: an iOS client type and the Google Sign-In SDK; same store code.

### 3. Merge

3.1 **Global ids.** Migration 2 (`SCHEMA_VERSION = 2`) adds `uid TEXT` (22 chars base64url of 16 random bytes) to
`entries` and `habits` with unique indexes, backfilled in the migration for existing rows; integer `id`s stay for the
UI and every existing query. Habit logs are identified by `(habit uid, date)` – they need no uid. Settings are identified
by key. Habits also get `updated_at`. All tables that sync get `rev TEXT NOT NULL DEFAULT ''` and
`synced_rev TEXT NOT NULL DEFAULT ''`; `settings` gets a side table `settings_rev(key PRIMARY KEY, rev, synced_rev)`;
new tables `tombstones(kind, uid, rev, PRIMARY KEY(kind, uid))` (kinds `entry`, `habit`, `habit_log` with
`uid = habitUid + '|' + date`) and `sync_state(key PRIMARY KEY, value)` (holds the HLC's last value). Deleted rows are
**hard-deleted** as today plus a tombstone – no soft-delete flags, so `dataset.ts`, search, stats, calendar and export
keep their queries unchanged. The migration runs on every device at the next open, also for users who never sync; the
only visible consequence is the existing "newer version" guard for backups restored on an older app (`NewerSchemaError`).

3.2 **Clock: hybrid logical clock, not wall time, not version vectors.** `rev` is a 28-character string
`<physical ms, 14 digits>-<counter, 4 hex>-<deviceId, 8 hex>`; string order = total order; ties are impossible (the
device id is part of it). On a local write `physical = max(wallClock, last.physical)`, `counter = physical == last.physical ? last.counter + 1 : 0`;
on every imported record `last = max(last, imported)` (Lamport/HLC rule), so a device whose clock is behind cannot keep
losing, and a device whose clock is ahead drags the others' logical time forward instead of silently rewriting their
edits forever. Drift guard: an imported physical time more than 24 h ahead of this device's wall clock is accepted but
reported (`server.sync.clockSkew`, the status card shows "The clock of *Phone* seems wrong (3 days ahead)"); the HTTP
`Date` header of Drive responses is used only to detect and show local clock skew, never to rewrite revs. Why not
per-record version vectors: convergence does not need them – the value of every record is always the version with the
highest `rev` (a join-semilattice: commutative, associative, idempotent), so three devices applying the same set of
records in any order and any number of times end with identical tables. The only thing concurrency detection buys is
the decision to keep a loser as a conflict copy (3.4), and for that a per-device `synced_rev` is enough: a record is
*dirty* when `rev > synced_rev`; an incoming record is *foreign* when its `rev` is neither the local `rev` nor the local
`synced_rev`; dirty ∧ foreign ⇒ the two edits were concurrent. At least one of the two editors always detects it, the
copy it creates has a deterministic uid (`sha256('mpd-conflict-v1:' + loserUid + ':' + loserRev)`), so when both detect
it the copies collide on the uid and dedupe.

3.3 **Rules per kind.**
- `entry`: last-writer-wins per **record** (whole row) by `rev`; per-field merging is deliberately not done – a diary
  entry is one text the person wrote, mixing fields of two versions would produce a sentence nobody wrote. Concurrent
  edits (3.2 definition) keep the loser as a *conflict copy*: a new entry with the loser's date/time/fields, the tag
  `conflict` (a shared constant, not a localized string, so the data stays language-neutral) and the UI badge
  "Conflict copy – edited on two devices; keep one" rendered from i18n. The owner's simplicity argument: nothing ever
  vanishes, the resolution is "delete the one you don't want", which every user understands; silent LWW would lose
  words on the rare occasion and nobody would know.
- `habit`: LWW per record (name, description, target, unit, frequency, reminder, archived, sort_order); after a merge
  `recomputeCompleted` runs for every habit whose `target`/`frequency` changed (the existing function). No conflict copies
  for habits (they are definitions, not writing).
- `habit_log` keyed `(habit uid, date)`: LWW by `rev` ("max/latest" of the brief; `completed` is derived and
  recomputed, `value` and `note` travel). A log for a habit that has a tombstone, or whose habit is unknown, is ignored
  (and re-evaluated if the habit arrives later in the same run – logs are applied after habits).
- Deletions: tombstone per kind with the deleting `rev`; a tombstone beats every older version, an edit with a newer
  `rev` beats the tombstone (the record comes back – the user edited it after someone deleted it); deleting a habit
  tombstones the habit and drops its logs locally (the existing cascade) without individual log tombstones. Tombstones
  are kept forever (tens of bytes each) so a device offline for a year cannot resurrect what was deleted.
- `setting`: LWW per **key**, only for keys that belong to the account: `firstDayOfWeek`, `defaultPeriod`,
  `calendarExtras`. Per device and never synced: `language` (each device shows the language its user chose there; the
  sign-up screen language rule stays), `theme`, `fontScale`, `reduceMotion`, `autoLockMinutes` (the phone defaults
  differ), `offlinePrivacyMode`, `remindersEnabled` (otherwise both devices notify or neither does). Habit reminder
  times/flags are part of the habit record and do sync – both devices will remind unless the per-device
  `remindersEnabled` is off; the Reminders card says so.
- Insights, home/stats, search indexes: derived, recomputed locally, never synced. `meta`: per device.

3.4 **Engine shape.** `server/src/sync/merge.ts`: `applyRecords(db, records: SyncRecord[], clock): MergeReport` – pure
over the database, runs inside one `db.transaction`, assigns no new revs except for conflict copies (which get a fresh
local rev), returns counts for the status line ("12 entries, 3 habits updated from *Computer*"). It is plain TypeScript
on `DiaryDb`, imports nothing from Node, and runs unchanged in `server.cjs` and in the worker (like every other
`server/src/db` module already does – `mobile/test/vfs/server-modules.test.ts`). Determinism and idempotency are
properties, tested as such (WP-S1).

### 4. Protocol on the transport

4.1 **Store interface** (`server/src/sync/store.ts`), the only thing a transport implements:
`list(space) → {name, size, modifiedTime, serverId}[]`, `get(serverId) → bytes`, `put(name, bytes, appProperties) → serverId`
(create only, never overwrite), `delete(serverId)`, `about() → {account, usage, limit}`. Implementations: `drive/`
(section 1 evidence; `fetch`-based so one implementation serves Node and the worker), `lan/` (WP-S7), `memory` (tests).
The engine never issues a write that could race with another device: **every device writes only files whose name
contains its own device id**; the only shared-name files are the immutable manifest (2.3) and the per-device generation
files (2.4). No locks, no `If-Match` needed.

4.2 **Files in the space** (flat, all names ASCII, no user data in names; `appProperties`: `space`, `dev`, `kind`, `gen`, `seq`):
- `mpd.<space>.space.json` – manifest (plain, 2.3).
- `mpd.<space>.gen.<g>.<dev>.json`, `mpd.<space>.rekey.<g>.<dev>.bin` – generations (plain / envelope, 2.4).
- `mpd.<space>.<dev>.log.<g>.<seq>.bin` – an **append-only change segment**: the records this device changed since its
  previous segment (full rows, not diffs), JSON Lines → deflate → padded to a 1 KB multiple → `encryptContainer` under
  `K_g` (the inner plaintext starts with the line `{"mpd":"sync","format":1,...}` so a segment fed to Restore is rejected
  by the existing `fromImage` integrity check, and so the reader checks the format before parsing).
- `mpd.<space>.<dev>.snap.<g>.<seq>.bin` – a **snapshot**: the device's complete merged state (every entry, habit, log,
  synced setting, tombstone) in the same inner format; written when the device's own segments exceed 50 files or 2 MB,
  after a generation change, and on first connect; after a snapshot is uploaded the device deletes its own older
  segments and snapshots (its files only).
- `mpd.<space>.<dev>.info.bin` – device card (encrypted): name, platform, app version, last sync, head `seq`; rewritten at
  most hourly (as a new file + delete of the old one).
- `mpd.<space>.revoke.<dev>.json`, `mpd.<space>.deleted.json` – plain markers (2.6, 5.v).

Why segments **and** snapshots: segments make the common case cheap (one entry ≈ 0.5–4 KB instead of re-uploading a
multi-MB diary after every keystroke-level save), snapshots bound what a new or long-offline device must read and let a
device prune its own history. Because records are full rows with revs, applying a snapshot and applying its segments are
the same operation – order between files of one device, and between devices, does not matter (3.2). Sizes with the
measurements of section 0: a 5-year realistic diary snapshot ≈ 2 MB after deflate (resumable upload path, above 5 MB
multipart is not allowed anyway); a day's segment 1–10 KB (multipart upload, one request).

4.3 **When a device syncs** (per connected account, only while its vault is open – the key lives in memory with it):
on app start/unlock, on resume (phone: `@capacitor/app` `appStateChange`/`resume`), 10 s after the last mutating request
(debounced, coalescing), every 5 minutes while the app is open (one `files.list`, 100 units), on "Sync now". No
background work when the app is closed: Android's Doze "Suspends network access" and "WorkManager tasks don't run"
(developer.android.com `doze-standby`), periodic work has a 15-minute minimum, and the Background Runner is "a
standalone JavaScript environment" without the WebView – the engine needs the open vault and the worker, so a background
pull would have to be a second implementation in native code against encrypted data it cannot read. Not worth it:
"open the app and it is there within seconds" meets the requirement. On the desktop the sidecar lives as long as the
window; a tray/background mode is a separate decision.

4.4 **One run, in order** (`server/src/sync/engine.ts`): (1) credentials – desktop: refresh the access token if needed;
phone: ask the host; failure → status `needsReconnect` with a plain sentence; (2) `list(space)`; (3) markers: `deleted` →
stop with message; `revoke.<me>` → wipe this device's sync credentials and stop; a higher generation → 2.4; (4) **pull**: for
each other device, if its cursor is missing or a segment number is missing (pruned) take its newest snapshot and the
segments after it, else the segments after the cursor; download, `decryptContainer(K_g)`, inflate (cap 64 MB), guard
(4.6), `applyRecords` in one transaction; after `vault.persist()` succeeded (the phone's `persistIfDirty` barrier) advance
the cursor in `sync.json` – a crash in between re-applies the same files, which is a no-op; (5) **push**: collect rows with
`rev > synced_rev` and un-pushed tombstones, build one segment with `seq = ownSeq + 1`, upload, then set `synced_rev = rev`
for exactly the revs uploaded (rows edited during the upload keep a newer `rev` and stay dirty) and `ownSeq++`; (6)
compaction and the device card when due; (7) status + `lastSyncAt`. Any step failing marks the run failed with a
catalogue key and the next trigger retries with backoff (30 s, 1, 5, 15 min; 403/429 from Drive obey the documented
exponential backoff). **Partial failure**: a segment upload that died after Drive stored it leaves a duplicate `seq` – readers
dedupe by `(dev, seq)` and the next compaction deletes it. **Resume** needs no state beyond cursors and `synced_rev`.
**Months offline**: the device pulls snapshots+segments of the others (bounded by compaction) and pushes one segment with
everything it did; tombstones are permanent, so nothing resurrects. **Clock skew**: 3.2. **Quota**: the card shows Drive
usage from `about.get`; a `storageQuotaExceeded` answer becomes "Your Google Drive is full – free some space or the
diary cannot sync" and the engine keeps working locally.

4.5 **What the user sees** – Settings card "Sync between my devices" (`src/pages/settings/SyncSection.tsx`, after the
Backup card, all platforms, hidden on remote/LAN browsers like the owner cards): state line (Off / Connected as
*n…@gmail.com* / Syncing… / Last sync 14:03 / error in one sentence), buttons "Connect Google Drive", "Sync now",
"Disconnect" (keeps the cloud copy), "Delete the copy in Google Drive" (password), the devices list from the device cards
(name, platform, last sync, "Remove"), Drive usage, and a privacy sentence ("Only encrypted files leave this device.
Google cannot read your diary."). Errors are catalogue keys with parameters (`server.sync.*` from the engine,
`settings.sync.*` in the UI) in all 20 locales (`shared/i18n/messages/<locale>/settings.ts` + `server.ts`, parity test
`shared/i18n/i18n.test.ts`: "every locale defines exactly the English key set per area with the same placeholders").
API: `GET /api/sync` (status), `POST /api/sync/google/start`, `GET /api/sync/google/callback` (loopback, no auth, state
check), `POST /api/sync/connect {password}`, `POST /api/sync/now`, `POST /api/sync/disconnect {password, deleteRemote?}`,
`DELETE /api/sync/devices/:deviceId`; all under the small JSON limit, `/api/sync/*` loopback-only like `/api/server/remote*`;
`ServerInfo.syncAvailable` tells the UI whether this build has a Google client id.

4.6 **Schema guard for imported data.** Every record goes through the same validators user input goes through –
`validateEntryInput`, `validateHabitInput`, `validateHabitLogInput`, `validateSetting` (only the synced keys) – plus
`uid`/`rev` shape checks, `format` major check ("made by a newer version – update the app", no partial import), per-file
caps (encrypted ≤ 25 MB like `MAX_BACKUP_BYTES`, inflated ≤ 64 MB, ≤ 100,000 records), unknown record kinds skipped
(forward-compatible minors). AES-GCM authentication already rejects every byte not produced with the sync key, so the
guard is a second wall against a malicious holder of the password and against our own bugs.

### 5. First-use flows (numbered user steps)

(i) **Owner has the PC diary, installs the phone app.**
1. On the phone: language → Register with the same username, e-mail and password as on the PC (a new, empty local account).
2. Phone: Settings → Sync between my devices → Connect Google Drive → Google's account picker → choose the same account the
   PC will use → consent ("Your Personal Diary wants to: View and manage its own configuration data in your Google Drive")
   → enter the diary password once → "Connected. Nothing in Google Drive yet."
3. On the PC: Settings → Sync → Connect Google Drive → the system browser opens → same Google account → consent → the
   browser shows "You can close this tab" → back in the app: enter the diary password → the PC creates the space and
   uploads its first snapshot ("Uploading 1,204 entries…") → "Last sync just now".
4. Phone: open the app (or tap Sync now) → "1,204 entries, 6 habits received from *Computer*" → the diary is there. Order
   of 2 and 3 does not matter: whoever connects first creates the space.

(ii) **New user starts on the phone, later installs the PC app.**
1. Phone: register → write for weeks → Settings → Sync → Connect Google Drive → password → the phone creates the space
   and uploads.
2. PC: install → Register with the same username and password → Settings → Sync → Connect (browser) → password → the
   phone's diary appears on the PC. A different password at step 2 → the 2.3 message; the user fixes the PC password
   (Change password) or re-registers.

(iii) **A user who never wants sync.** Nothing changes: no Google prompt, no network call (WP-S4 test: with sync
disabled the engine's HTTP seam is never invoked), the card shows one line and one button, the migration of 3.1 is
invisible. The Privacy card's sentence gains "…and, if you turn sync on, to your own Google Drive".

(iv) **Password change.** 1. Change password on the PC (Settings → Account) – the PC re-encrypts locally, signs out other
PC sessions, uploads `gen.<g+1>` + the envelope, re-uploads under the new key. 2. Phone, next open: syncs (key switched
automatically), then signs out with "Your password was changed on *Computer* on 12 Oct. Sign in with the new password."
3. Phone sign-in with the new password → verified against the cloud verifier → local diary re-encrypted via the phone's
own recovery key → in. Old password refused from step 2 on.

(v) **Device lost.** 1. On the remaining device: Settings → Sync → devices → Remove *Phone* (writes the revoke marker; the
lost device drops its sync credentials the next time it syncs, if ever). 2. Change the password (new generation: the lost
device's cached key opens nothing written afterwards; its local copy is behind its own lock screen and Android's device
encryption – this app cannot wipe a device it does not control). 3. Google account → Security → Third-party access →
remove Your Personal Diary (revokes every token of every device; the remaining device reconnects with one tap). The card
text spells out these three steps.

### 6. Security review

**Threat model and answers.**
- *Cloud provider (Google) or anyone reading the Drive data*: sees ciphertext (AES-256-GCM under a scrypt-derived key
  with the app's existing parameters), file sizes rounded to 1 KB, timestamps, device count and a username hash. Cannot
  read, cannot forge (GCM tag + AAD header), can delete or roll back (availability). Metadata leakage is accepted and
  documented in the privacy policy.
- *Someone with the Google account but not the password*: gets the ciphertext plus the verifier, i.e. an offline guessing
  oracle at scrypt N=2^15 (~32 MB, tens of ms per guess on a desktop CPU) – the same exposure `accounts.json` has today
  for anyone with the PC profile; mitigated by the existing password policy. They can delete the space (local copies
  survive; the `deleted` marker explains) or plant files – which fail GCM authentication and are ignored with one log
  line.
- *Someone with the PC profile* (`device.key` + `sync.json`): can read the local diary already (ARCHITECTURE.md 5.1); now
  also obtains the sync key and the Google refresh token → can pull the cloud copy. Same class, same answer: revoke at
  Google + change password rotates everything. Optional hardening noted in ARCHITECTURE.md (DPAPI for `device.key`) would
  cover both.
- *Replay / rollback of old snapshots*: merge is monotonic by `rev`, tombstones are permanent, generations only go up
  (`gen` is persisted per device and lower ones are ignored), cursors only advance – an old snapshot re-served by the
  provider changes nothing; a sequence gap that goes backwards is logged as `server.sync.rollbackDetected` and shown.
- *Format downgrade*: inner `format` major is checked; a device never writes a format lower than the highest it has read.
- *Malicious snapshot content*: 4.6 – validators, caps, unknown kinds skipped, GCM first.
- *Phone without the password holder's consent* (lost, unlocked): the sync card needs the account password for connect,
  disconnect-with-delete and remote deletion; "Sync now" and status do not (they only move ciphertext of the already
  open vault); the lock screen (`423 LOCKED`) blocks the card like everything else.
- *Token handling*: desktop refresh token wrapped with `device.key` and its own AAD, never returned by the API (the card
  shows only the Google e-mail), scope `drive.appdata` only, PKCE, `state` checked, callback bound to loopback; phone:
  access tokens in worker memory only, obtained from Play services per run.
- *Rate of scrypt*: one derivation at connect, one per generation change, one per "password changed elsewhere" sign-in,
  bounded by the existing per-account confirm lockout (10 wrong → 15 minutes). None per sync run.
- *Audit rule to add to `scripts/check-no-network.mjs`*: `SYNC_DIR = 'server/src/sync/drive/'` may contain
  `fetch(` and URL literals for exactly `SYNC_HOSTS = ['www.googleapis.com', 'oauth2.googleapis.com', 'accounts.google.com']`
  (the third appears only in the authorization URL that is opened in the browser); every other file under `server/src/sync/`
  keeps the general rules. Mobile: `mobile/index.html`'s `connect-src` may list exactly these hosts (asserted by
  `mobile/test/desktop-dist-clean.test.ts`-style tests against the built `mobile-dist` and the desktop `dist`, which must
  stay without them); the Java plugin `mobile/plugins/diary-google-auth/**` may import `com.google.android.gms.auth.api.identity`
  and nothing from the JVM socket/HTTP list; no new manifest permission. Runtime proof in `server/test/sync-gate.test.ts`:
  an injected fetch spy is never called while no account has sync enabled, and is called only with `SYNC_HOSTS` URLs when
  it is. The banner the script prints gains "sync in server/src/sync/drive may contact only … and only for accounts that
  turned sync on".

### 7. Work packages

Ownership is disjoint per package; `server/src/sync/**` is new. Gates for every package: root `tsc`, `vitest`, `vite build`,
`check-no-network`; server `tsc` + `vitest`; `node scripts/build-server.mjs` + smoke; `mobile:typecheck/test/build`; desktop
behaviour unchanged for users without sync (snapshot tests of the Settings page without the card's content, API contract
tests unchanged).

| # | Package | Files (owner) | Depends on | Needs phone | Needs owner's Google client | Acceptance and tests |
|---|---|---|---|---|---|---|
| WP-S1 | Schema + clock + merge engine | `server/src/db/schema.ts` (migration 2), `entries-repo.ts`/`habits-repo.ts`/`settings-repo.ts` (assign `rev`, tombstones on delete), `server/src/sync/{clock,ids,records,merge,guard}.ts`, `server/test/sync-*.test.ts` | – | no | no | Property tests with a seeded PRNG: 3 simulated devices, random offline edits/deletes/reorders over 500 rounds, records exchanged in random order and duplicated → identical tables (convergence), applying twice = once (idempotency), A∘B = B∘A (commutativity); conflict copies deterministic; HLC monotonic under skew; migration of the compat fixture keeps every row and integer id; all existing server tests green |
| WP-S2 | Space, keys, generations, `sync.json` | `server/src/sync/{space,keys,sync-store-file}.ts`, hooks in `security/auth-service.ts` (`onPasswordChanged` seam, reuse of `resetPassword`), tests | S1 | no | no | Same password on two data dirs opens one space; wrong password → verifier mismatch message, no download; generation bump + envelope opened by the offline device; concurrent bumps pick one winner deterministically; recovery key never serialised into any sync file (test greps the produced bytes after decryption) |
| WP-S3 | Store interface + Google Drive store + desktop OAuth | `server/src/sync/store.ts`, `server/src/sync/drive/{oauth,client,store}.ts`, `shared/sync/google-client.ts` (ids), `scripts/check-no-network.mjs` (rule of §6), mock OAuth/Drive server in `server/test/sync-drive-mock.ts` | S2 | no | **yes** for the manual end-to-end; mocks for CI | Loopback redirect served by the running server port; PKCE + state; refresh wrapped with device.key; multipart ≤ 5 MB and resumable > 5 MB against the mock; 403/429 backoff; `about.get`; the audit passes and fails on a planted extra host |
| WP-S4 | Engine, scheduler, API, composition | `server/src/sync/engine.ts`, `server/src/routes/sync.ts`, `server/src/server.ts` + `mobile/core/boot.ts` (wiring only), `shared/types.ts` (`SyncStatus`), `docs/API.md` | S2, S3 | no | no | Full runs against the memory store: cursors, compaction, duplicate `seq`, months-offline device, deleted/revoke markers; the network gate test of §6; contract test: PC data dir → phone core (`mobile/test/core` rig) and back through the memory store with byte-identical merged exports |
| WP-S5 | UI card + i18n + flows | `src/pages/settings/SyncSection.tsx`, `src/pages/LoginPage.tsx` ("password changed elsewhere"), entry badge for `conflict`, Privacy sentence, `shared/i18n/messages/*/settings.ts` + `server.ts` (20 locales, parity) | S4 | no | no | Component tests (states, errors, RTL), parity green, a11y (live region announces "Sync finished: 3 entries received"), desktop snapshots without sync unchanged |
| WP-S6 | Android: OAuth plugin, worker token RPC, CSP | `mobile/plugins/diary-google-auth/**`, `mobile/shared/sync-protocol.ts`, `mobile/host/sync-bridge.ts`, `mobile/core/boot.ts` (inject token provider), `mobile/index.html` (connect-src), `android/app/**` (plugin registration, Gradle dep `play-services-auth`), `scripts/check-no-network.mjs` (plugin allow-list), `docs/ANDROID-PHONE-TEST.he.md` | S4, S5, WP-14 | **yes** | **yes** (Android client with SHA-1) | Debug APK: no new permission; the spike confirms `fetch` from the worker to `www.googleapis.com` under the new CSP (fallback: a host HTTP bridge via `CapacitorHttp` – documented risk: "parsing and transferring large amount of data from native to the web can cause issues"); consent once, silent token afterwards; flows (i) and (iv) on the owner's phone with fictional data |
| WP-S7 | LAN secondary transport (optional) | `server/src/sync/lan/{store,routes}.ts` (ciphertext endpoints on the existing LAN listener behind a pairing code shown as QR, `src/utils/qr.ts` exists), phone side in `mobile/host/lan-store.ts` | S4, S6 | yes | no | Same engine tests over the LAN store; works with sync of Google off; zero-knowledge (endpoints move opaque files only); `lanGuard` semantics kept |
| WP-S8 | QA, docs, owner guide, store/privacy texts | `docs/SYNC-GOOGLE-SETUP.he.md` (Cloud Console steps with screenshots), ARCHITECTURE.md §14, privacy policy + Play Data safety ("data encrypted in transit and at rest, not shared"), README | S1–S6 | yes | yes | PC snapshot ↔ phone round trip with the compat fixtures, 20-locale sweep of the card, chaos (kill during upload/apply), performance (5-year realistic diary: first sync ≤ 60 s on Wi-Fi, incremental ≤ 3 s) |

Suggested order: S1 → S2 → S3 ‖ S5(ui shell) → S4 → S6 → S8 → S7. Estimate: 12–16 agent-days; S6 and S8 need the
owner's phone and his Google Cloud client ids (section A, steps 1–6).

### 8. Open questions / decisions for the owner

1. Google Drive only in the first version (OneDrive via the same store interface later)? Recommended: yes.
2. The consent screen shows the owner's support e-mail and app name to every user – acceptable? (Required by Google.)
3. Conflict copies (recommended) vs. silent last-writer-wins for entries.
4. Default of "also delete the cloud copy" on account deletion (recommended: ask, default no).
5. Build WP-S7 (LAN) for phones without Google Play / users who refuse any cloud?
6. Not decided here: a desktop tray/background mode so the PC syncs while the window is closed (today the sidecar lives
   with the window).

---

### Appendix A – measurement command (read-only, scratchpad script)

```
cd server && npx tsx --tsconfig tsconfig.json <scratchpad>/measure-sizes.mts
# imports server/src/db/database.ts, db/seed.ts (seedDemoData(db, days, 42, todayIso(), 'he')),
# security/vault.ts exportImage, security/container.ts encryptContainer, zlib.gzipSync
```

### Appendix B – sources read (allowed hosts only)

developers.google.com: `workspace/drive/api/guides/appdata`, `.../api-specific-auth`, `.../limits`, `.../manage-uploads`,
`.../manage-changes`, `.../properties`, `.../search-files`, `workspace/drive/api/reference/rest/v3/files`,
`.../about/get`, `.../changes/list`, `identity/protocols/oauth2`, `identity/protocols/oauth2/native-app`,
`identity/protocols/oauth2/production-readiness/brand-verification`, `workspace/guides/configure-oauth-consent`.
developer.android.com: `identity/authorization`, `training/data-storage/shared/documents-files`,
`develop/background-work/background-tasks/persistent/getting-started/define-work`,
`training/monitoring-device-state/doze-standby`, `privacy-and-security/keystore`.
capacitorjs.com: `docs/apis/http`, `docs/apis/app`, `docs/apis/browser`, `docs/apis/preferences`,
`docs/apis/background-runner`, `docs/guides/deep-links`. tauri.app: `plugin/opener`, `plugin/deep-linking`.
learn.microsoft.com: `onedrive/developer/rest-api/concepts/special-folders-appfolder`,
`windows/win32/cfapi/build-a-cloud-file-sync-engine`.
