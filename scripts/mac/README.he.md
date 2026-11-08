# אפליקציית ה-Mac - איך בונים אותה ומה רואים בה

**בקצרה, לבעלים:** אפליקציית ה-Mac היא אותה אפליקציה של Windows (אותו ממשק, אותו שרת, אותו יומן), שנבנית במחשב ה-Mac שלך. ב-6.11.2026 נבנתה הגרסה הראשונה (גרסת בדיקה, בלי חתימה רשמית של אפל) והותקנה אצלך בתיקיית Applications. עכשיו נוסף לה החלק של ה-Mac לעבודה בלי חיבור: שמירת "מפתח העותק" ב-**Keychain** (מחזיק המפתחות של macOS), פתיחת הנעילה בלי חיבור עם **Touch ID או סיסמת ה-Mac**, ופתיחת דפי המדיניות בדפדפן. באנדרואיד ובאתר לא השתנה דבר; ב-Windows משתנה דבר אחד, שמוסבר בהערה השלישית למטה.

* התוכנית המלאה: [`docs/APPLE-PLAN.md`](../../docs/APPLE-PLAN.md) (סעיף 9: WP-M1, WP-M2, WP-M3).
* סיסמת ה-Mac מקלידים רק בחלונות של ה-Mac - אף פעם לא בצ'אט ולא בקובץ. האפליקציה עצמה **לעולם לא מבקשת** את סיסמת ה-Mac בשביל ה-Keychain (סעיף 2).
* **מה נכנס בעדכון של 7.11.2026:** עד עכשיו קוד הפתיחה של הממשק (`src/main.tsx`) לא "חיבר" את החלק הזה - לא במק ולא ב-Windows (ב-Windows זה אומר שעד היום המפתח לא נשמר מוגן ב-DPAPI, לא היה עותק בקבצים ולא היה Windows Hello, בניגוד לתיעוד). השורה החסרה נכנסת באותו עדכון (החלטה D1 של הסשן הראשי): במק מתחילים לפעול ה-Keychain וה-Touch ID, וב-Windows - מה שהתיעוד מתאר (גרסה 7 של Windows, שאתה בודק). פתיחת דפי המדיניות בדפדפן לא תלויה בשורה הזו: היא פועלת בכל בנייה שכוללת את קוד ה-Mac. את הבדיקות של סעיף 3 עושים אחרי שבונים ומתקינים את הגרסה הבאה.

---

## 1. איך בונים את אפליקציית ה-Mac

**מה הותקן ב-Mac (6.11.2026), בלי סיסמת מנהל, בלי Homebrew ובלי לגעת בהגדרות המערכת:**

| כלי | גרסה | איפה |
|---|---|---|
| Node.js | 24.20.0 | `~/Developer/tools/node` |
| Rust (דרך rustup) | 1.99.1, יעדים `aarch64-apple-darwin` ו-`x86_64-apple-darwin` (יעד ה-Intel נוסף ב-8.11.2026, 147 MB) | `~/.cargo`, `~/.rustup` |
| Xcode Command Line Tools | Apple clang 16, macOS SDK 15.2 | `/Library/Developer/CommandLineTools` (אתה אישרת את ההתקנה על המסך) |

אין Xcode מלא - לא צריך אותו לאפליקציית ה-Mac (הוא נדרש רק ל-iPhone ול-App Store).

**העותק של הפרויקט ב-Mac:** `~/Developer/my-personal-diary`. מקור האמת הוא המחשב (PC): כל שינוי נעשה שם, ואז מועתק ל-Mac בהעתקה **חד-כיוונית** (PC ← Mac), שמשאירה ב-Mac רק את מה שנבנה שם (`node_modules`, `dist`, `src-tauri/target`, `src-tauri/gen/schemas`, `ios/`). קובץ שה-Mac מייצר וצריך לשמור - בעיקר `src-tauri/Cargo.lock` אחרי הוספת רכיב - מועתק מיד בחזרה ל-PC, לפני ההעתקה הבאה.

**הבנייה** (ב-Terminal של ה-Mac, או מרחוק). מ-8.11.2026 הבנייה הרשמית היא **אוניברסלית** - קובץ אחד לשבבי Apple ולמעבדי Intel:

```bash
cd ~/Developer/my-personal-diary
caffeinate -i npx tauri build --bundles app --target universal-apple-darwin
```

האפליקציה נוצרת כאן:

`~/Developer/my-personal-diary/src-tauri/target/universal-apple-darwin/release/bundle/macos/Your Personal Diary.app`

(הבנייה הישנה, ל-Apple silicon בלבד - `caffeinate -i npx tauri build --bundles app`, תוצאה ב-`src-tauri/target/release/bundle/macos/` - עדיין עובדת ומהירה יותר, ומתאימה לבדיקות מקומיות.) לוקח 1.5 עד 3 דקות כשכבר נבנה פעם אחת (`caffeinate` שומר שה-Mac לא יירדם באמצע); בנייה אוניברסלית ראשונה לוקחת יותר (8.11.2026: ראו `docs/MAC-RELEASE.he.md`). להפצה - DMG, חתימה ו-Notarization - משתמשים בפקודה האחת `bash scripts/mac/release.sh`, שמוסברת ב-`docs/MAC-RELEASE.he.md`.

**ההתקנה ל-Applications** (עושים יחד איתך): סוגרים את האפליקציה (Cmd+Q), ואז:

```bash
cd ~/Developer/my-personal-diary
rm -rf "/Applications/Your Personal Diary.app"
ditto "src-tauri/target/release/bundle/macos/Your Personal Diary.app" "/Applications/Your Personal Diary.app"
```

זה מחליף רק את האפליקציה. היומן שלך נמצא בשרת; מה שנשמר ב-Mac (ההעדפות, העותק המוצפן לעבודה בלי חיבור, פריט ה-Keychain) נשאר במקומו. אפליקציה שנבנתה ב-Mac הזה נפתחת בלי אזהרה; ב-Mac אחר היא תיחסם עד החתימה הרשמית (סעיף 4).

**הבדיקות של קוד ה-Mac:** `cd ~/Developer/my-personal-diary/src-tauri && cargo test --lib` - ב-7.11.2026: 76 בדיקות, כולן עברו, אף אחת לא דולגה.

---

## 2. מפתח העותק ב-Keychain - ומה אתה תראה

**מה נשמר ואיפה.** כשנכנסים עם "זכור אותי" והאפליקציה מחוברת, השרת שולח לה את "מפתח העותק" (המפתח שבו מוצפן העותק שעל המכשיר). במק הוא נשמר ב-Keychain, כפריט בשם **Your Personal Diary offline key** (בתוכנה "Keychain Access" ← login). הפריט לא מסונכרן ל-iCloud, ואין בו סיסמה שלך ושום דבר שנגזר ממנה. בגרסת הבדיקה של היום הוא נשמר ב-login keychain של המשתמש שלך במק: הוא נעול עם סיסמת הכניסה למק, ויכול לעבור למק חדש יחד עם שאר ה-login keychain אם מעבירים את המחשב ב-Migration Assistant או משחזרים מגיבוי Time Machine. "למכשיר הזה בלבד" הוא יהיה רק אחרי החתימה הרשמית עם פרופיל הקצאה (סעיף 4). האפליקציה שומרת לעצמה רק "פתק" שמצביע על הפריט; הפתק לבדו לא פותח כלום.

**מה תראה בכל מצב:**

| מצב | מה קורה | חלון? |
|---|---|---|
| כניסה עם "זכור אותי", עם אינטרנט | המפתח נשמר. בפתיחות הבאות עם אינטרנט האפליקציה בודקת שהפריט הקיים קריא ומכיל את אותו מפתח, ומשאירה אותו כמו שהוא; היא מחליפה אותו רק אחרי עדכון של גרסת הבדיקה או כשהשרת נתן מפתח חדש | לא |
| פתיחה בלי אינטרנט, אותה גרסה של האפליקציה | המפתח נקרא והאפליקציה נפתחת מהעותק שבמכשיר | לא |
| נעילה, ואז "פתיחה עם נעילת המסך של המכשיר" בלי חיבור | חלון של macOS: Touch ID, או "Use Password..." וסיסמת ה-Mac | **כן** - זה החלון היחיד |
| **אחרי עדכון של גרסת הבדיקה**, פתיחה ראשונה **עם** אינטרנט | האפליקציה מחליפה את הפריט בשקט | לא |
| **אחרי עדכון**, פתיחה ראשונה **בלי** אינטרנט | macOS לא נותן לגרסה החדשה לקרוא את מה שהגרסה הקודמת שמרה. האפליקציה לא מבקשת סיסמה: היא מציגה את מסך "אין חיבור", כמו בלי "זכור אותי". כשהאינטרנט חוזר הכול נפתח, ומהפעם הבאה גם הפתיחה בלי אינטרנט עובדת | לא |
| יציאה עם "מחק" או מחיקת החשבון; ומאותו עדכון (7.11.2026, החלטה D2 - שינוי במנוע המשותף) גם ניתוק של המכשיר מרחוק, כניסה של חשבון אחר, וכניסה בלי "זכור אותי" | הפריט נמחק מה-Keychain | לא |
| חלון ה-Touch ID נשאר פתוח יותר מחמש דקות בלי תשובה | האפליקציה סוגרת אותו ונשארת נעולה; לוחצים שוב | - |

**למה העדכון משנה משהו:** גרסת הבדיקה חתומה "חתימה עצמית" (בלי חשבון מפתחים של אפל), וכל בנייה חדשה מקבלת חתימה חדשה. macOS מקשר כל פריט ב-Keychain לחתימה של מי שיצר אותו. אחרי החתימה הרשמית (Developer ID, סעיף 4) כל העדכונים אמורים להיחשב "אותה אפליקציה" (כך אפל מתארת את זה; נוודא בשתי הגרסאות החתומות הראשונות), ואז גם פתיחה ראשונה בלי אינטרנט אחרי עדכון עובדת. במעבר מגרסת הבדיקה לגרסה החתומה זה יקרה פעם אחת אחרונה.

**חלון שלא אמור להופיע:** "Your Personal Diary wants to use your confidential information stored in ... in your keychain", עם בקשה לסיסמה של ה-"login" keychain. האפליקציה מכבה את החלונות האלה בזמן שהיא ניגשת ל-Keychain. אם בכל זאת הוא מופיע - **לא להקליד סיסמה**: ללחוץ Deny ולספר. (את זה אי אפשר היה לבדוק מרחוק - ראו סעיף 3, בדיקה 1.)

**הנוסח של חלון ה-Touch ID:** macOS כותב "“Your Personal Diary” is trying to" ואחריו את הטקסט של האפליקציה. הטקסט היום הוא "Unlock Your Personal Diary", ולכן יוצא "is trying to Unlock Your Personal Diary". עובד, אבל לא יפה - הצעה לתיקון בסעיף 4.

---

## 3. בדיקות שרק אתה יכול לעשות (על המסך של ה-Mac)

את אלה עושים אחרי שבונים ומתקינים את הגרסה הבאה (זו שכוללת את החיבור של 7.11.2026). בדיקה 5 (דפי המדיניות) לא תלויה בחיבור הזה, ואפשר לעשות אותה בכל בנייה שכוללת את קוד ה-Mac. כל אחת לוקחת דקה-שתיים.

1. **הבדיקה החשובה - פתיחה ראשונה בלי אינטרנט אחרי עדכון.** אחרי התקנת גרסה חדשה: לכבות Wi-Fi **לפני** שפותחים אותה, ואז לפתוח. מצופה: **שום חלון של Keychain**, ומסך "אין חיבור". להדליק Wi-Fi - האפליקציה נפתחת. לסגור, לכבות Wi-Fi, לפתוח שוב - נפתחת מהעותק שבמכשיר. אם הופיע חלון שמבקש את סיסמת ה-"login" keychain: Deny, ולספר לנו.
2. **פתיחה בלי אינטרנט.** להיכנס עם "זכור אותי", לסגור את האפליקציה, לכבות Wi-Fi, לפתוח - האפליקציה נפתחת עם הפס "אין חיבור" למעלה, ומה שכותבים נשמר ונשלח כשהחיבור חוזר.
3. **פתיחת נעילה בלי חיבור.** בלי Wi-Fi, לנעול את היומן (או לחכות לנעילה האוטומטית) וללחוץ "פתיחה עם נעילת המסך של המכשיר": מופיע חלון Touch ID. לנסות פעם Cancel (נשאר נעול, אפשר לנסות שוב) ופעם אצבע או סיסמה (נפתח). חלון שמשאירים פתוח יותר מחמש דקות נסגר מעצמו והיומן נשאר נעול.
4. **יציאה מוחקת את המפתח.** לצאת עם "מחק", ואז ב-Terminal:
   `security find-generic-password -s app.yourpersonaldiary.mac.offline.v1`
   מצופה: "The specified item could not be found in the keychain." (הפקודה מציגה רק את שם הפריט, אף פעם לא את התוכן, ולא שואלת כלום.)
5. **דפי המדיניות.** הגדרות ← פרטיות ← הקישור למדיניות הפרטיות: נפתח בדפדפן הרגיל שלך (Safari או אחר), והאפליקציה נשארת במקומה.

---

## 4. מה עוד חסר

**נכנס בעדכון של 7.11.2026 (לא חסר יותר):**
* החיבור של קוד הפלטפורמה לממשק ב-`src/main.tsx` (החלטה D1): עד אז לא במק ולא ב-Windows נקרא `installTauriOfflinePlatform()`, ולכן אפליקציית Windows עבדה בלי DPAPI, בלי העותק בקבצים ובלי Windows Hello, והמק בלי ה-Keychain החדש.
* מחיקת המפתח מה-Keychain גם בניתוק מרחוק, במעבר חשבון ובכניסה בלי "זכור אותי" (החלטה D2, במנוע המשותף; ב-Windows אין מה למחוק מחוץ לפתק).
* שניהם משנים את Windows: גרסה 7 של Windows, שאתה בודק.

**נכנס ב-8.11.2026 (חבילת MAC-M4; המדריך המלא: `docs/MAC-RELEASE.he.md`):**
* **גרסה לכל סוגי ה-Mac:** יעד ה-Intel `x86_64-apple-darwin` הותקן, והבנייה האוניברסלית (`--target universal-apple-darwin`) נבנתה ואומתה (`lipo`: `x86_64 arm64`). לא הותקנה אצלך - ההתקנה ב-Applications היא עדיין בנייה 3.
* **DMG:** `scripts/mac/make-dmg.sh` יוצר ובודק DMG עם `hdiutil` בלבד; קיים DMG של הבנייה האוניברסלית לבדיקה שלך (חתימה עצמית, בלי Notarization).
* **מכונת ההפצה:** `scripts/mac/release.sh` - פקודה אחת לבנייה, חתימה ב-Developer ID, Notarization, הצמדת האישור, DMG ובדיקת Gatekeeper; `scripts/mac/build-appstore.sh` למסלול ה-Mac App Store (לא נבדק); קובצי ההרשאות ב-`src-tauri/entitlements/`; `src-tauri/Info.plist` עם הצהרת ההצפנה וזכויות היוצרים, קטגוריה Lifestyle.

**לפני הפצה למחשבי Mac אחרים - מה שרק אתה יכול לעשות:**
* **חשבון ותעודה (WP-M4, הצד של אפל):** חברות ב-Apple Developer Program (99 דולר לשנה), תעודת Developer ID Application, סיסמה ייעודית ל-Notarization ופרופיל `ypd-notary` - צעד אחר צעד ב-`docs/MAC-RELEASE.he.md` סעיף 2. אחרי זה ההפצה היא `bash scripts/mac/release.sh`. בלי זה Mac אחר חוסם את האפליקציה ("לא ניתן לבדוק אותה").
* **מדיניות הפרטיות:** משפט על ה-Keychain של אפל ועל אפליקציות ה-Mac וה-iPhone - מטופל בחבילת LEGAL של אותו ספרינט (`legal/**`, תאריך תוקף 8.11.2026). הנוסח הנכון למצב של היום: הפריט נשמר ב-login keychain של המשתמש במק, לא מסונכרן ל-iCloud, ויכול לעבור למק אחר רק יחד עם ה-keychain כולו (העברת מחשב או שחזור מגיבוי) - לא "למכשיר הזה בלבד" עד שיש פרופיל הקצאה.
* **הנוסח של חלון ה-Touch ID** (סעיף 2): טקסט ייעודי למק בסגנון "unlock your diary" (באותיות קטנות, כי macOS מכניס אותו באמצע משפט) - שינוי טקסטים ב-20 השפות, לא בחבילה הזו.
* **אופציונלי, עם החתימה:** פרופיל הקצאה (provisioning profile) עם הרשאות ה-Keychain. אז האפליקציה עוברת לבד ל-Keychain החדש של אפל (data-protection keychain), שבו הפריט נעול עד הכניסה הראשונה למחשב ואינו עובר למחשב אחר בגיבוי, ומוחקת את הפריט הישן מה-login keychain בפתיחה המקוונת הראשונה (או בפעם הבאה, אם ה-login keychain היה נעול באותו רגע).
* **ממתין למשוב שלך:** קיצורי המקלדת (Alt/Option + ספרה במק) ושפת הפתיחה במק.

---

## Technical appendix (English)

### A. Machine and toolchain (2026-11-06)

* MacBook Pro 16" 2021, Apple M1 Max, 32 GB, macOS Sonoma 14.6.1. About 19 GB free on the data volume after the build; `src-tauri/target` on the Mac is about 2.7 GB.
* Node 24.20.0 + npm 11.19 in `~/Developer/tools/node`; Rust 1.99.1 stable via rustup (`--no-modify-path`, minimal profile: no clippy / rustfmt), target `aarch64-apple-darwin` only, in `~/.cargo` / `~/.rustup`; Xcode Command Line Tools (Apple clang 16.0.0, macOS SDK 15.2). No Homebrew, no sudo, no full Xcode, shell profiles untouched: remote commands start with `export PATH="$HOME/Developer/tools/node/bin:$HOME/.cargo/bin:$PATH"`.
* The Mac sleeps after a minute of idle and drops off the network: start `caffeinate -ims -t 28800` (nohup) at the beginning of a session.

### B. Sync and lockfile

* One-way PC -> Mac mirror: `tar` of the PC tree (without `node_modules`, `dist`, `mobile-dist`, `src-tauri/target`, `src-tauri/binaries`, `src-tauri/resources/server`, `src-tauri/gen/schemas`, store/play/deploy kits, key and data files) piped over ssh from Git Bash (PowerShell pipes corrupt binary data), unpacked into a staging folder and mirrored with `rsync -a --delete`, which keeps `node_modules`, `/dist`, `/mobile-dist`, `/src-tauri/target`, `/src-tauri/gen/schemas` and `/ios` on the Mac. `npm ci` on the Mac works with the Windows lockfile.
* After a dependency change the Mac rewrites `src-tauri/Cargo.lock`: copy it back to the PC at once (`ssh ... 'cat ~/Developer/my-personal-diary/src-tauri/Cargo.lock' > src-tauri/Cargo.lock`), before the next sync overwrites it. WP-M2 added exactly two packages (`objc2-security` 0.3.2, `objc2-local-authentication` 0.3.2) and six dependency names of the shell; no existing version changed.
* Windows `--offline` builds need the crates.io index entries of every package in the lockfile, macOS-only ones included (resolution is target-independent; nothing of them is downloaded or compiled). After the lockfile change the PC needed one `cargo fetch --target x86_64-pc-windows-msvc` (index entries only; no macOS crate downloaded, lockfile unchanged); `cargo check --offline` and `cargo test --lib --offline` pass since.

### C. Build, verify, install

```bash
cd ~/Developer/my-personal-diary && caffeinate -i npx tauri build --bundles app
codesign --verify --deep --strict --verbose=2 "src-tauri/target/release/bundle/macos/Your Personal Diary.app"
cd src-tauri && cargo test --lib
```

* `src-tauri/tauri.macos.conf.json` (merged by Tauri on macOS only): `identifier` `app.yourpersonaldiary.mac` (Tauri warns that `com.mydiary.app` ends with `.app`, the bundle extension), `bundle.targets` `["app"]`, `bundle.macOS.minimumSystemVersion` `12.3`, `bundle.macOS.signingIdentity` `"-"` (ad-hoc: `flags=0x10002(adhoc,runtime)`, no team). Notarization is skipped (no credentials).
* WP-M2 build (2026-11-06): EXIT 0 in about 1m20s of Rust (release, LTO); `codesign --verify --deep --strict`: "valid on disk", "satisfies its Designated Requirement"; the binary links `Security`, `LocalAuthentication` and `CoreFoundation`. Not installed by the build: installing (section 1) is done with the owner.
* Data of the Mac app: WebKit data `~/Library/WebKit/app.yourpersonaldiary.mac`, outbox mirror `~/Library/Application Support/app.yourpersonaldiary.mac/offline/<userId>/`, caches `~/Library/Caches/app.yourpersonaldiary.mac`, the Keychain item below.

### D. The Keychain design (`src-tauri/src/platform/macos.rs`)

* One generic-password item per account: `kSecAttrService` = `app.yourpersonaldiary.mac.offline.v1` (the macOS identifier + `.offline.v1`; a Rust test keeps them in step), `kSecAttrAccount` = the user id, `kSecValueData` = the AOK, `kSecAttrLabel` = "Your Personal Diary offline key", `kSecAttrGeneric` = a 16-byte random nonce, `kSecAttrSynchronizable` = false. In the data-protection keychain also `kSecUseDataProtectionKeychain` = true and `kSecAttrAccessible` = `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.
* `key_protect` first reads the account's item (`kSecReturnAttributes` + `kSecReturnData`, `kSecMatchLimitOne`): the data-protection keychain first when the build may use it, then the login keychain, which every call names explicitly - `SecKeychainCopyDefault`, then `kSecUseKeychain` / `kSecMatchSearchList` - exactly as the tests name their temporary keychain, so no query is routed by guesswork. Readable by this build and holding the same key (an online start of the same build): the item stays and the answer is the marker of its nonce; nothing is written, so the marker the engine already holds never goes stale (a failed IndexedDB save of a new marker cannot leave a marker that opens nothing). Otherwise - no item, a new key, another build's item (-25293, or -25308 with the dialogs off) - the item is replaced: delete + add in the data-protection keychain, falling back to the login keychain on errSecMissingEntitlement; after a successful data-protection add (and whenever a data-protection item is reused) the login-keychain item of an unentitled build is deleted on a best-effort basis, so a locked login keychain never fails the wrap. The marker is `keychain-v1:<dp|file>:<userId>:<nonce, 32 hex>` (text, no secret; offline.rs base64-encodes it and the engine keeps it in IndexedDB `meta.wrappedKey` with `wrappedBy = 'keychain'`). `key_unprotect` checks the marker's version, place and user id and reads the item whose `kSecAttrGeneric` equals the nonce: another account's marker, the marker of a replaced item and a removed item all fail. `key_remove` deletes the item in both places (both are tried, the first error is the answer); none there = Ok. No cryptography of its own; errors carry the action and the OSStatus, never the key, the marker or the user id.
* Every vault call is serialized (one mutex) and runs with `SecKeychainSetUserInteractionAllowed(false)` (restored afterwards): a call that would need the legacy keychain's access dialog fails (-25293 / -25308) instead of prompting.
* Experiments on the build Mac (scratch binaries in /tmp, a temporary keychain file created with a random password and deleted afterwards; never the login keychain; user interaction off in every probe process):

| Probe (ad-hoc signed, no team, no entitlements) | OSStatus |
|---|---|
| Data-protection keychain: read of a random service | -25300 (not found - proves nothing) |
| Data-protection keychain: delete / add | **-34018** errSecMissingEntitlement - the same from an ad-hoc signed `.app` bundle with `CFBundleIdentifier`, with and without hardened runtime (the installed test build is exactly that: adhoc, runtime, no team) |
| Temporary file keychain: the creator reads its item | 0 |
| Another ad-hoc identity (other cdhash): read the data / read the attributes | **-25293** / 0 |
| ... update the data | 0 - but the access list still names the creator only (the creator reads, the updater gets -25293) |
| ... delete, then add its own item, then read it | 0, 0, 0 (no authorization needed; the old creator now gets -25293) |
| The same path re-signed (= an update of an ad-hoc build): read the old item / delete / add + read | -25293 / 0 / 0 + 0 |
| `kSecAttrAccessible`, `kSecAttrSynchronizable = false` on a file keychain | accepted (0); accessibility classes exist only in the data-protection keychain |
| `SecKeychainCreate` of the temporary keychain | the user's keychain search list stayed unchanged (only `login.keychain-db`), before and after |

* Hence: ad-hoc build today -> login keychain; the item is kept across online starts and replaced only after an update (the new build cannot read it) or when the key changed; after an update the first offline start cannot read the old item (the app falls back to "no connection", never a dialog). A Developer ID build (WP-M4) keeps its designated requirement and team across updates, so updates are expected to keep access (Apple's documented model; to be confirmed with the first two signed builds). With a provisioning profile that grants the keychain entitlements the same code moves to the data-protection keychain by itself (`dp` markers); the first online start after the switch deletes the old login-keychain item on a best-effort basis (the next one, if the login keychain was locked at that moment).
* The file-based keychain has no "this device only": a Migration Assistant or Time Machine restore can carry the login keychain (still locked with the login password) to another Mac. It is unlocked with the login as a whole; if the owner configured it to lock (after sleep or a timeout), vault calls fail instead of asking, and the app needs a connection once.
* Engine, same release (decision D2 of the main session, `src/offline/**`): whenever the engine drops the wrapped key - the 401 purge, another account signing in, a start without "Remember me" - it also calls the vault's `remove()`, so the Keychain item goes with the marker (before D2 the item stayed, and a sign-in without "Remember me" would not even have replaced it). On Windows `remove()` is empty: the DPAPI blob goes with the marker anyway.

### E. LocalAuthentication

* `user_check_available` = `LAContext.canEvaluatePolicy(.deviceOwnerAuthentication)`, no UI (over SSH: yes, about 10 ms). `user_check` = `evaluatePolicy(.deviceOwnerAuthentication, localizedReason:reply:)` with the caller's cleaned message (an empty one -> "unlock your diary"; macOS throws on an empty reason and shows the reason after "“<app>” is trying to"). The reply block runs on a private queue of the framework; it reads the error's domain and code inside the call and sends the mapped answer through a `sync_channel(1)`; the command's blocking thread waits on the receiver (never the main thread), the context stays alive until the reply, and the framework's own copy of the block keeps it alive until it replied (a block released without a reply ends the wait as `unavailable`).
* Mapping: success -> `ok`; `userCancel` / `systemCancel` / `appCancel` -> `cancelled`; `authenticationFailed` -> `failed`; everything else (not available, not enrolled, passcode not set, lockout, not interactive, fallback, other domains) -> `unavailable`.
* Both calls run inside an `objc2::rc::autoreleasepool` of their own, so the framework's autoreleased temporaries are freed when the call ends and not when tokio's reused blocking thread ends (the review measured on the build Mac: 4000 `canEvaluatePolicy` calls grew the process by about 6.7 MB without a pool and by 0.3 MB with one). The wait for the reply is bounded (`REPLY_TIMEOUT`, 5 minutes): then the context is invalidated - the dialog goes away and the framework replies `appCancel` to a block nobody waits for - and the answer is `cancelled`, so the user simply tries again. The tests cover the bound with a 50 ms channel wait and a zero-second bound on a real, non-interactive context.
* Tested without any UI: `interactionNotAllowed = true` makes the framework answer `notInteractive` (-1004) instead of showing its dialog (LAContext.h); over SSH the reply came after about 7 ms, also from 4 threads x 5 calls in the test suite.

### F. Opening the legal pages

`/usr/bin/open <url>` through `std::process::Command` (no shell; the URL as one argument; working folder `/`; stdin/stdout/stderr null), only after `opener::open_checked` accepted the address, and only for an `https://` address of visible ASCII (so it can never be read as an option). Chosen over NSWorkspace: no AppKit binding, no main-thread requirement, no new crate - and it is what the Tauri opener plugin does on macOS. Not run in tests (it would open the owner's browser); the tests check the command line only. Revisit for an App Sandbox build (Mac App Store route).

### G. Tests on the Mac

`cargo test --lib` (2026-11-07): 76 passed, 0 failed, **0 ignored** - 60 shared tests and 16 macOS tests. The macOS tests never touch the user's keychains: the contract functions of the test build work on a temporary keychain of the test's own thread (`macos::test_keychain`, created in `$TMPDIR/ypd-keychain-tests`, deleted when the test thread ends; leftovers older than an hour are swept), and every vault query names that keychain (`kSecUseKeychain` / `kSecMatchSearchList`). The data-protection keychain is reached in two ways only: a delete of a random, non-existent service (the probe: it shows -34018 and touches nothing), and - behind that probe, so only on a build the data-protection keychain refuses - the test of the app's own path `Keychains { data_protection: true, .. }`, whose every data-protection call answers -34018 and which therefore reads and writes the temporary keychain alone (a `file` marker, the item kept for the same key and replaced for a new one, an idempotent remove). The three Windows-path-literal tests are `#[cfg(windows)]`.

### H. What could not be observed over SSH (and the one manual check)

* An SSH session has no GUI, so every access that would need a dialog fails there anyway: the experiments cannot show that switching user interaction off also suppresses the dialog in the owner's GUI session. **The manual check:** after the next update, start the app first with Wi-Fi off (section 3, check 1) - expected: no Keychain dialog, the "no connection" screen; then online, then offline again works.
* The real Touch ID / password dialog and its answers (only the non-interactive path ran, plus a zero-second bound that invalidates a context mid-evaluation); the login keychain itself - the app's path `data_protection: true` runs in one test, on the temporary keychain and behind the -34018 probe, but the login keychain's lock state, its access dialogs in a GUI session and an entitled build's data-protection path (none exists yet) are out of the tests' reach; notifications from the bundle; the opener in the GUI.
* The vault and the unlock run in the app once `src/main.tsx` installs the Tauri adapter - this release (D1, section 4). The legal-page opener runs regardless: `PrivacyPolicyLink.tsx` invokes `open_external_url` whenever `isTauri()`.

### I. Missing before distribution (state of 2026-11-08, after package MAC-M4)

* Done by MAC-M4 (details and the verified numbers: `docs/MAC-RELEASE.he.md`, appendix B): the universal build (`rustup target add x86_64-apple-darwin` done; `npx tauri build --bundles app --target universal-apple-darwin` built and verified, ad-hoc), `scripts/mac/make-dmg.sh` (hdiutil, UDZO on HFS+, verified by mount + cmp), `scripts/mac/release.sh` (the whole route 1: Developer ID signing with the hardened runtime and `src-tauri/entitlements/developer-id.plist`, `notarytool submit --wait` through the keychain profile `ypd-notary`, code-signing of the DMG, stapling of app and DMG, `spctl --assess`), `scripts/mac/build-appstore.sh` (route 2, `--dry-run` only), `src-tauri/Info.plist` (`ITSAppUsesNonExemptEncryption`, `NSHumanReadableCopyright`) and `bundle.category` (verified in the built plist). Tauri's own DMG bundler (`bundle.targets` `["app", "dmg"]`) is not used: it needs Finder/AppleScript for the window layout, and the build Mac is driven over SSH.
* Still missing, and only the owner can supply it: the Apple Developer Program membership, a Developer ID Application certificate and the `ypd-notary` notarytool profile - then the signed path of `release.sh` runs for the first time (untested until then), including `spctl --assess` on a second Mac user. Optionally a Developer ID provisioning profile with the keychain entitlements (data-protection keychain).
* The Keychain sentence in the privacy policy is the LEGAL package of the same sprint (`legal/**`, effective date 2026-11-08; the wording of section 4: the login keychain of the user, not synced to iCloud, travels only with the whole keychain); a Mac wording for `shell.sync.lock.deviceReason`; the owner's decisions on `Alt`+digit shortcuts and the startup language (decided for this sprint: English stays). (The adapter wiring in `src/main.tsx` landed on 2026-11-07, D1.)
