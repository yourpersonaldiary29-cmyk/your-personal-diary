# WP-H10: automatic offline mode (binding design)

Status: **BINDING**, written by the judge on 2026-10-23. It replaces both candidate designs, "A: safety-first" and "B: experience-first".

Inputs:
- `docs/android-tasks/OFFLINE-DESIGN-TASK.md`
- `docs/android-tasks/HOSTED-IMPL.md`, items 8-13. Item 11 is the requirement.
- `docs/android-tasks/ENV.md`

All paths are relative to `C:\Users\AVI\Projects\my-personal-diary`. All examples are fictional ("Dana", the entry "Morning walk").

The owner's words: the app notices by itself that there is no connection, keeps working, and when the connection returns it takes what the user wrote and saves it to the server.

---

## סיכום לבעלים (בעברית)

**מה תראה**
- כשאין חיבור לשרת, האפליקציה ממשיכה לעבוד. בראש המסך יופיע פס: "אין חיבור – מה שתכתוב יישמר בשרת כשהחיבור יחזור", ולידו "3 שינויים ממתינים".
- בלי חיבור אפשר:
  - לכתוב, לערוך ולמחוק רשומות;
  - לסמן הרגלים ולערוך סימונים;
  - ליצור, לערוך ולהעביר לארכיון הרגלים;
  - לשנות הגדרות.
- אחרי שמירה בלי חיבור תופיע ההודעה "נשמר במכשיר. יעלה לשרת כשהחיבור יחזור".
- כשהחיבור חוזר, הפס מראה "מעלה 3 שינויים…" ואחר כך "כל השינויים נשמרו בשרת". השינויים עולים לפי הסדר, כל שינוי פעם אחת בלבד, גם אם סגרת את האפליקציה בינתיים.
- **שינוי של אותה רשומה בשני מכשירים**: הגרסה החדשה יותר נשארת בשרת, ותופיע שורה אחת שמסבירה מה קרה. הגרסה השנייה נשמרת אצלך במכשיר עד שתלחץ "אישור". אפשר לשמור אותה כרשומה חדשה או להעתיק את הטקסט.
- **רשומה שנמחקה במכשיר אחר** לא חוזרת לחיים. מה שכתבת עליה נשמר אצלך במכשיר עם אותן אפשרויות.
- **פתיחה בלי חיבור**:
  - באפליקציות Windows ו-Android, אם בחרת "זכור אותי", האפליקציה נפתחת מהעותק השמור.
  - אחרת יופיע מסך "אין חיבור", כמו היום, כי כניסה לחשבון דורשת את השרת.
  - בדפדפן אי אפשר לפתוח את האתר בלי חיבור. אבל אם החיבור נופל באמצע העבודה, ממשיכים לעבוד, והשינויים נשמרים בדפדפן עד שיעלו.
- **נעילה בלי חיבור**: אם האפליקציה ננעלת כשאין חיבור (יציאה מהאפליקציה בטלפון, או 10 דקות בלי פעילות), פותחים אותה עם נעילת המסך של הטלפון או עם Windows Hello. אם במכשיר אין נעילת מסך, צריך חיבור כדי לפתוח.

**מה דורש חיבור** (תופיע הודעה ברורה)
- תובנות, חיפוש וסטטיסטיקה
- גיבוי ושחזור, וייצוא
- ניהול חשבון: סיסמה, פרטים, מכשירים מחוברים ומחיקת חשבון
- מחיקת הרגל וסידור הרגלים מחדש
- נתוני הדגמה
- כניסה והרשמה

**מה נשמר במכשירים שלך** (הכול מוצפן)
- השינויים שעוד לא עלו לשרת, עד שהם עולים.
- באפליקציות Windows ו-Android עם "זכור אותי" בלבד: עותק של מה שראית לאחרונה (רשומות אחרונות, הרגלים, נתוני היום, החודש בלוח השנה וההגדרות). בלי "זכור אותי" ובדפדפן, העותק הזה נשמר רק בזיכרון כל עוד האפליקציה פתוחה.
- **מפתח ההצפנה** נשמר בשרת, בתוך היומן המוצפן שלך. עם "זכור אותי" הוא נשמר גם במכשיר, מוגן על ידי Windows או על ידי ה-Keystore של Android.
- **לעולם לא נשמרים במכשיר**: הסיסמה ומפתח השחזור.
- ביציאה מהחשבון הכול נמחק מהמכשיר. אם יש שינויים שעוד לא עלו, תישאל קודם.

**בשרת**: אין שינוי במבנה מסד הנתונים, אין המרה של הנתונים הקיימים, ואפשר לחזור לגרסה הקודמת של השרת בלי לאבד דבר.

---

## 0. The decision in one screen

1. **Base: design A (safety-first).**
   - From A:
     - one sync endpoint with explicit outcomes;
     - acknowledge only after the data is on disk;
     - a per-account key held by the server (wrapped by DPAPI or the Keystore on the apps);
     - per-record chains;
     - a journal-based overlay;
     - the safe paths for logout, 401 and account switch;
     - a native outbox mirror;
     - offline unlock with the operating system's own user check.
   - **Grafted from B:**
     - zero schema change: sync bookkeeping lives in the existing `meta` table, `SCHEMA_VERSION` stays 1;
     - the facade in `src/api/index.ts`, so pages and page tests keep their calls;
     - coalescing of operations that were never sent;
     - the 2-second online confirmation;
     - the UX details: banner timing, badges, the attention list;
     - a memory-only read cache for sessions without "Remember me";
     - request timeouts;
     - the CORS trap;
     - the end-to-end harness in `mobile/test`.
2. **Fixed in both designs:** see §1.3. The main fixes:
   - the account id goes in the JSON body instead of A's custom header, which CORS would block;
   - operations are sealed before their first send, so B's coalescing cannot merge an operation the server may already have applied;
   - client ids are permanent, not B's 90-day idempotency keys;
   - a closed vault gives 503, not 401;
   - a restore "epoch" stops queued edits addressed by integer id from hitting a record that reused that id after a restore.
3. **Conflicts follow item 11 literally:** newer `editedAt` wins per record, and a record deleted on the server is never brought back.
   - The losing version is never silently lost. If the device's version loses, it stays on the device as a note. If the server's version loses, the server returns it once, and the device keeps it as a note.
   - Nothing is added to the diary automatically: no conflict-copy entries, unlike A's proposal.
4. **No owner decision is left open.** Offline unlock uses the device's own screen lock or Windows Hello (§5.7), with "Unlocking needs a connection" as the fallback.

---

## 1. Verdict: both designs checked against the code

### 1.1 Evidence that decided it

| # | Claim | Who | Checked in the code | Result |
|---|---|---|---|---|
| E1 | A schema bump breaks HOSTED-IMPL item 5 ("existing tests stay green without edits to their expectations") | B (A says the opposite) | `server/src/db/database.ts:101` runs `applySchema(db)` inside `DiaryDb.fromImage`. `mobile/test/compat/containers.test.ts:213` reads `expect(nodeSha256(exportImage(db))).toBe(manifest.diary.plainSha256);`. Any migration changes the re-exported image. | **B right.** A's "the equality checks I found compare a record with itself" is wrong, so A's `SCHEMA_VERSION = 2` is not allowed. `schema.ts:110-113` also refuses newer databases, so A's plan would have no server rollback (A concedes "fix-forward"). |
| E2 | The `meta` table is a free namespace | B | `getMeta`/`setMeta` (`server/src/db/settings-repo.ts:148-158`) have **no callers** in `server/src`, `src` or `mobile` (grep). `meta` is never listed or exported: `export/json.ts:35` dumps `data.entries` only. | **B right.** `sync:*` rows collide with nothing and stay inside the encrypted diary. |
| E3 | A custom request header works from the apps | A assumes it | `server/src/middleware/access.ts:204`: `'Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept-Language'`. The apps are cross-origin (`access.ts:27` `HOSTED_ORIGINS`: `http://tauri.localhost`, `https://localhost`). | **A wrong.** `X-Diary-Account` fails the preflight. `fetch` then rejects, `isConnectionError` is true, and the apps would look offline forever and never upload. The same-origin web UI would work, which would hide the bug. Binding fix: `account` goes in the JSON body, and no CORS change is needed. |
| E4 | Today an acknowledged write can be lost in a crash | both | `server/src/security/vault.ts:31`: `PERSIST_DEBOUNCE_MS = 250`. `onWrite` schedules the persist after the response. `persist()` is serialised ("a call during a write runs after it", `vault.ts:187-200`). | **Both right:** the server must `await vault.persist()` before the 200. One more catch: `writeNow` returns silently when the vault is closed (`if (this.closed) { if (strict) throw …; return; }`). The handler must check "closed" after the persist. A then answers 401, but `src/api/client.ts:339-342` clears the token on any 401 and signs the user out. Binding: 503, retryable. |
| E5 | B's coalescing is safe | B | B §4.2: "At start, ops left in `sending` … return to `waiting`". B §4.4: a timeout marks the op "waiting". B §4.3 merges any op "not in flight". | **B wrong.** An operation that was sent but never answered becomes mergeable. A create merged with a later edit is then either resent under its old key, so the server replays the old result and the edit is silently lost, or under a new key, which creates a second entry. Timeouts are common on mobile networks. Binding fix: **sealing** (§4.4). |
| E6 | Idempotency satisfies item 11 ("a `clientId` unique per account") | B | B prunes keys after 90 days and offers "Send anyway" after 80 days. | **B wrong.** Uniqueness expires, so duplicates come back. Binding: permanent `sync:cid:<kind>:<clientId>` rows (A's idea, without A's columns). |
| E7 | The localStorage "pending" sentinel detects eviction | B | localStorage, IndexedDB and the token share the origin's storage. | **B wrong.** Eviction removes the sentinel together with the data it should count. A's native mirror (§5.4) is kept. |
| E8 | An offline-unlock verifier on the device is acceptable | B | PBKDF2 of the **account password**, stored on the device. | **Rejected.** Anyone who can unwrap the store (rooted phone, a process running as the same Windows user) can guess the password offline, and that password also opens the server diary. A's OS user check stores nothing derived from the password. |
| E9 | Offline lock is a real problem | both | `mobile/platform/prefs.ts:22` `lockOnLeave: true`; `server/src/db/settings-repo.ts:19` `autoLockMinutes: 10`; `src/context/LockContext.tsx:65` "Best effort: when the server cannot be reached the screen is locked anyway." Unlocking calls `verify-password`. | **Both right:** without offline unlock the phone is unusable offline after any app switch. |
| E10 | Conflict copies are a good way to keep words | A | A's own D3: copies "count in stats until the user deletes one". A's D2 changes item 11's rule for deletes. | **Rejected.** It adds duplicates the owner never asked for. Binding: item 11's rule as written, and the losing version kept as a note on the device. |
| E11 | Integer ids are stable | both, implicitly | `schema.ts:36` `INTEGER PRIMARY KEY AUTOINCREMENT` never reuses an id. But a restore replaces the whole image, `sqlite_sequence` included (`backup.ts:136`, `:151`). | **Neither design handles this.** After a restore, a queued edit addressed by id can hit a different record. Binding: restore epoch (§3.7). |
| E12 | Pages and tests stay stable | B | Page tests mock `@/api` (`src/test/api-mock.ts`). A's `writes.entries.create(...)` changes every call site. | **B right.** Use a facade inside `src/api/index.ts`. |
| E13 | Reminders re-plan after habit changes | A | `mobile/platform/notifications.ts:348-353` `changesHabits` matches `/api/habits*`, `/api/settings`, `/api/backup/restore` and `/api/settings/seed-demo` only. | **A right:** `/api/sync/op` must be added. |
| E14 | Negative local ids | B | `src/pages/EntryPage.tsx:31` `validId = Number.isInteger(entryId) && entryId > 0`. `NewEntryPage.tsx:124` `navigate(PATHS.entry(saved.id))`. | **B right:** `validId` becomes `entryId !== 0`. |
| E15 | `navigator.onLine === false` means offline | A | MDN: on Windows the status depends on reaching a Microsoft server, which "may be blocked by firewalls or VPNs, even if the computer has Internet access" (quoted by B). | **A wrong.** It is only a hint that triggers a probe. |
| E16 | The offline wipe can live in `clearSignedOutAccountData` | both | `src/context/AuthContext.tsx:268-269` clears the token and then calls `clearSignedOutAccountData` synchronously. `endSession` (`:281-284`) calls it from account deletion. | **Wrong.** The wipe is asynchronous and must come **after** the pending-changes confirmation. Binding: explicit `offline.wipeAccount(userId)` (§4.8). |
| E17 | Sessions after a restart | both | `server/src/security/auth-service.ts:905-911` reopens a closed vault only with a remember-me wrapped key; regular sessions are removed and get 401. `shared/constants.ts:482-483`: 12 h and 90 days; `touch()` does not extend expiry. | **Both right.** |
| E18 | Quota blocks deletes | A | `server/src/middleware/quota.ts:34` `GROWING_METHODS = POST, PUT, PATCH`. A `POST /api/sync/op` carrying a delete would be blocked by `quotaGuard`. | **A right:** check quota per operation kind inside the handler. Do not mount `quotaGuard` on `/api/sync`. |

### 1.2 Scores (1 = poor, 5 = strong)

| Criterion | A | B | Notes |
|---|---|---|---|
| Exactly-once | 5 | 2 | A: ledger, permanent uid, persist before 200. B: coalescing of sent operations (E5); keys expire (E6). |
| Conflicts | 3 | 4 | A: conflict copies pollute the diary (E10); the delete rule deviates from item 11. B: faithful to item 11, but the server-side loser disappears without trace. |
| No data loss | 4 | 3 | A: native mirror and safe paths. B: the sentinel cannot see eviction (E7). |
| Account isolation | 2 | 3 | A: the header is CORS-blocked (E3). B: no server-side check. |
| Security at rest | 5 | 2 | A: key held by the server, never stored on the web, nothing derived from the password. B: web key readable from the profile; password verifier (E8). |
| Migration safety | 1 | 5 | A: breaks item 5 (E1) and has no rollback. B: zero DDL, so rollback is safe. |
| Implementability | 3 | 3 | A: triggers and migration, every page call site changes. B: response-wrapping middleware on three routers, CORS lists, a versions endpoint. |
| Testability | 4 | 4 | |
| **Total** | **27** | **26** | A is the stronger base once its storage is replaced by B's and E3 is fixed. B's client-side flaws (E5, E6, E8) go deeper into its protocol. |

### 1.3 What the binding design takes, drops and fixes

| From A (base) | From B (grafted) | New, fixing both |
|---|---|---|
| `POST /api/sync/op` with outcomes in a 200 body; `GET /api/sync/key` | zero DDL: rows in `meta` under `sync:` (§3.1) | `account` in the body, not a header (E3) |
| await `vault.persist()` before the answer | per-key settings, field-scoped habit archive | sealing before the first send, coalescing only before it (E5) |
| permanent `clientId` per create | `src/api/index.ts` facade; negative local ids plus an id map | content compare-and-set for habits, logs and settings; no separate versions endpoint |
| per-record chains and dependencies; immutable after the first send | 2 s online confirmation; banner timing 1.5 s / 1 s / 2.5 s | the server returns the losing version (`replaced`) and the device keeps it as a note (E10) |
| server-held account key, wrapped by DPAPI or the Keystore on the apps, memory only on the web | read cache on disk only for remember-me on the apps | restore epoch (E11) |
| journal overlay rule `appliedAt > cachedAt` | `timeoutMs` in `request()`, AbortSignal composition | closed vault gives 503, never 401 (E4) |
| native outbox mirror | CORS-trap detection | explicit, confirmed wipe (E16) |
| OS-verified offline unlock | coalescing table; attention list; inline badges | correctness without an op ledger: idempotent operations plus monotonic versions (§3.6) |
| safe paths for 401, logout, account switch and deletion | e2e in `mobile/test` on the real hosted composition | `/api/sync/op` added to `changesHabits` (E13) |

---

## 2. Requirements trace (HOSTED-IMPL item 11)

| Item 11 says | Where |
|---|---|
| detects by itself that the server is unreachable (`navigator.onLine` plus a failed health check or request) | §4.2 |
| non-blocking banner with the given text, 20 locales | §6.1, §6.3 |
| user keeps working; uploads in order, exactly once, even if the app was closed in between | §3.6, §4.3-4.5 |
| v1 writes: entry create, update and delete; habit quick log and log edits; habit create, edit and archive; settings | §3.4, §4.4 |
| offline reads: per-account cache of recent entries, habits, today, calendar month and settings, with queued changes merged in | §4.6 |
| insights, search, stats, backup/restore, exports and account management need a connection (clear message) | §6.2 |
| newer `updatedAt` wins per record; a server-deleted record is not resurrected; one-line note | §3.5, §4.9 |
| client-generated UUIDs, `clientId` unique per account | §3.1 (`sync:cid:*`), §3.4 |
| optimistic concurrency check | §3.5 (entries: `updatedAt`; others: compare-and-set on content) |
| "minimal schema change with migration and tests" | **zero DDL** (E1 makes any DDL a breach of item 5); the tests run against the real-shaped fixture (§8, WP-H10a) |
| IndexedDB in the sandbox, per account, encrypted, key storage designed, residual risk documented | §5 |
| cleared on logout and account deletion | §4.8, §5.5 |
| replay on reconnect, start and resume, with exponential backoff | §4.2, §4.5 |
| "N changes waiting" and per-item errors | §6.1, §4.9 |
| Windows, Android and web: one implementation in `src/` | §7 |
| tests: queue unit tests, replay against the hosted server, component tests | §8, §9 |
| privacy policy mentions the cache and queue | §10 |

---

## 3. Server contract (hosted only; local mode byte-identical)

### 3.1 Storage: zero DDL, rows in `meta`

`SCHEMA_VERSION` stays **1**. `applySchema` is untouched, and no statement runs when a diary is opened. Every row below is written lazily by the sync code, only in hosted mode. Each row is inside the user's encrypted diary and travels with backups.

| Key | Value | Written by | Removed |
|---|---|---|---|
| `sync:key` | base64 of 32 random bytes: the **account offline key (AOK)** | first `GET /api/sync/key` | with the account (never rotated in v1) |
| `sync:epoch` | 16 hex chars | first `GET /api/sync/key`; replaced by every restore | — |
| `sync:cid:entry:<clientId>` | the entry id (decimal) | `entry.create` | never (it makes a replayed create recognisable, even after the entry was deleted) |
| `sync:cid:habit:<clientId>` | the habit id | `habit.create` | never |
| `sync:t:habit:<id>` | ISO time of the last sync write to the habit | habit ops | pruned when older than 180 days (rows of deleted habits included); no existing route is touched |
| `sync:t:log:<habitId>:<date>` | ISO time | log ops | pruned when older than 180 days |
| `sync:t:set:<key>` | ISO time | `settings.patch` | never (about 20 rows at most) |

- **Entries need no time row.** Their existing `updated_at` is both the version and the time, and every write path sets it (`entries-repo.ts:278`, `:335`).
- **Size.** About 70 bytes per created record, plus about 60 bytes per synced log. That is far below the 10 MB quota (`config.ts:145`).
- **Pruning.** At most once per open vault per process (tracked in a WeakSet of `DiaryDb`), on the first sync request, run this statement and nothing else:
  `DELETE FROM meta WHERE ((key >= 'sync:t:habit:' AND key < 'sync:t:habit;') OR (key >= 'sync:t:log:' AND key < 'sync:t:log;')) AND value < <now - 180 days>`
  A pruned time counts as "older than any queued change", see §3.5. Settings times (`sync:t:set:*`), `sync:cid:*`, `sync:key` and `sync:epoch` are never pruned.

### 3.2 Capability flag and kill switch

- `ServerInfo.offlineSync?: 1` (`shared/types.ts`) is reported by the hosted `GET /api/server/info` (`routes/server.ts:191`) unless `DIARY_OFFLINE_SYNC=0`. Local mode never reports it.
- Clients create offline work **only** while the flag is present. With the flag absent they behave exactly as today, so a client released before the server is safe.
- The `/api/sync` routes stay mounted even when the flag is off, so outboxes that already exist can drain.
- Mount, in `app.ts`, hosted only, before `app.use('/api', notFoundApi)`:
  `app.use('/api/sync', guard, refuseGuest, dataJson, syncRouter(deps))`
  - No `quotaGuard` here (E18).
  - `guard` answers 423 for a locked session: `/api/sync` is not in `allowedWhileLocked`.
  - Every response carries `Cache-Control: no-store`.

### 3.3 `GET /api/sync/key`

- Answers `{ key: string /* base64, 32 bytes */, epoch: string, serverNow: string }`.
- Creates `sync:key` and `sync:epoch` on the first call, in one transaction, and **awaits `vault.persist()` before answering**. A key that a device holds therefore always survives a server crash.
- Returns 403 for a guest and 423 when locked.

### 3.4 `POST /api/sync/op`

**Contract: `shared/sync.ts`, frozen in the first commit of WP-H10a**

```ts
export const SYNC_PROTOCOL = 1;
export type SyncRef = { id: number } | { clientId: string };           // server id, or the clientId of a queued create
export type HabitFields = Pick<Habit, 'name' | 'description' | 'target' | 'unit' | 'frequency' | 'reminderTime' | 'reminderEnabled'>;
export type LogFields = { value: number; note: string };
interface OpCommon { v: 1; account: string; opId: string; editedAt: string; epoch: string }
export type SyncOp = OpCommon & (
  | { kind: 'entry.create'; clientId: string; payload: EntryInput }
  | { kind: 'entry.update'; target: SyncRef; base?: string; payload: EntryInput }        // base = Entry.updatedAt seen
  | { kind: 'entry.delete'; target: SyncRef; base?: string }
  | { kind: 'habit.create'; clientId: string; payload: HabitInput }
  | { kind: 'habit.update'; target: SyncRef; base?: HabitFields; payload: HabitInput }
  | { kind: 'habit.archive'; target: SyncRef; base?: { archived: boolean }; payload: { archived: boolean } }
  | { kind: 'log.set'; habit: SyncRef; date: string; base?: LogFields | null; payload: LogFields }  // null = no log was there
  | { kind: 'log.delete'; habit: SyncRef; date: string; base?: LogFields | null }
  | { kind: 'settings.patch'; base?: Partial<AppSettings>; payload: Partial<AppSettings> });
export type SyncOutcome = 'applied' | 'unchanged' | 'conflict-won' | 'conflict-lost' | 'gone' | 'stale';
export interface SyncOpResult {
  opId: string; outcome: SyncOutcome;
  record: Entry | Habit | HabitLog | AppSettings | null;               // current server state after the op
  replaced?: Entry | Habit | HabitLog | Partial<AppSettings>;          // only for conflict-won: what was overwritten or deleted
  keys?: Partial<Record<keyof AppSettings, 'applied' | 'unchanged' | 'conflict-won' | 'conflict-lost'>>;
  serverNow: string; epoch: string;
}
export interface SyncKeyResponse { key: string; epoch: string; serverNow: string }
export const SYNC_MAX_OP_BYTES = 2 * 1024 * 1024 - 16 * 1024;           // under DATA_BODY_LIMIT '2mb' (app.ts:78)
export function clampEditedAt(editedAt: string, now: string): string;   // min(editedAt, now)
export function nextVersion(stored: string, ts: string): string;        // max(stored + 1 ms, ts); stored '' -> ts
export function decide(i: { exists: boolean; same: boolean; baseKnown: boolean; baseMatches: boolean;
                            ts: string; storedAt: string }): 'gone' | 'unchanged' | 'applied' | 'conflict-won' | 'conflict-lost';
```

Notes on the contract:
- `base` omitted means "not known". The server then skips the compare-and-set and goes straight to the time rule.
- `opId` and `clientId` are `crypto.randomUUID()` values.
- `editedAt` is UTC ISO with milliseconds (`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/`): the time of the user's edit, from the device clock plus the learned offset (§4.4).

**Handler order**
1. **Validate.** Check the shape, `v === 1`, the kind, the UUIDs and the date format. Check payloads with the existing validators (`validateEntryInput`, `validateHabitInput`, `validateHabitLogInput`, and `validateSetting` per key; unknown setting keys are ignored, as `saveSettings` does).
   - Failure: 400 `VALIDATION` with `field`.
   - A `SyncRef` with an unknown `clientId`: 400 `server.sync.unknownClientId`.
2. **Account.** `account !== ctx.user.id` gives 409 `FORBIDDEN` `server.sync.accountMismatch`.
3. **Quota.** For `entry.create`, `entry.update`, `habit.create`, `habit.update`, `log.set` and `settings.patch`, when `diaryImageBytes(db) >= maxDiaryBytes`, answer 507 (`quotaExceeded`). Deletes and archive always pass.
4. `result = db.transaction(() => apply(db, op, nowIso()))`. This is synchronous: no `await` inside, so no other request interleaves.
5. **Persist.** `await vault.persist()`.
   - If it throws, or if `vault.isClosed` afterwards: 503 `IO` `server.sync.notSaved` with `Retry-After: 5`.
   - The change stays in memory. The client's retry finds it ("unchanged") and awaits the persist again.
6. **Answer** 200 `SyncOpResult`.

**`apply` per kind.** `ts = clampEditedAt(editedAt, now)`. `epochOk = op.epoch === meta('sync:epoch')`.

| Kind | Rule |
|---|---|
| `entry.create` | If `sync:cid:entry:<clientId>` exists: **unchanged**, `record` = that entry or null. Otherwise `createEntry(db, payload, { at: ts })`, write the cid row: **applied**. The epoch is ignored. |
| `entry.update` | If `!epochOk`: **stale**. Resolve the target, then the row: missing gives **gone**. If the validated payload equals the row's input fields: **unchanged**. Otherwise `decide({ baseMatches: base === row.updatedAt, storedAt: row.updatedAt })`. On applied or conflict-won, `updateEntry(db, id, payload, { at: nextVersion(row.updatedAt, ts) })`. On conflict-won, `replaced = row`. On conflict-lost, `record = row`. |
| `entry.delete` | If `!epochOk`: **stale**. Missing gives **unchanged** (already gone). Same `decide`. Applied or conflict-won deletes the entry (`replaced = row` on conflict-won). |
| `habit.create` | Like `entry.create`, with `createHabit(db, payload, { at: ts })` and `sync:t:habit:<id> = ts`. |
| `habit.update` | Stale and gone as above. The compare-and-set scope is the 7 `HabitFields`. `storedAt = sync:t:habit:<id>` or `''`. After a write, `sync:t:habit:<id> = nextVersion(storedAt, ts)`. |
| `habit.archive` | The compare-and-set scope is `isArchived` only. A rename on another device and an archive here both survive. Time row as above. |
| `log.set` / `log.delete` | Stale as above. Habit missing gives **gone**. The current log, or its absence, is compared with `base`, where `null` means "no log". `storedAt = sync:t:log:<habitId>:<date>` or `''`. Apply with `logHabit` or `deleteHabitLog`. `log.delete` of a missing log gives **unchanged**. |
| `settings.patch` | Per key: unchanged if equal; otherwise compare-and-set against `base[key]` and time `sync:t:set:<key>`. Applied keys go through one `saveSettings` call. `keys` reports each key. The outcome is applied if any key applied, else conflict-lost if any key lost, else unchanged. The epoch is ignored: keys are stable. |

**`decide`**
1. Not exists: **gone** (deletes handle "missing" themselves, see above).
2. `same`: **unchanged**.
3. `baseKnown && baseMatches`: **applied**.
4. `ts > storedAt`: **conflict-won**.
5. Otherwise: **conflict-lost**.

`storedAt` of `''` (no time recorded: the record was written by an older app, or the time was pruned) is older than any queued change.

**Repository changes**
- `createEntry`, `updateEntry` and `createHabit` gain an optional last parameter `{ at?: string }`. The default is `nowIso()`, so local mode is unchanged.
- An entry created offline yesterday keeps yesterday's `created_at`.
- A habit created offline keeps its `createdAt`, so `habitStartDate` counts the logs written offline.

### 3.5 Conflict rule, in words (item 11)

- **Per record.** A record is: an entry; a habit (its fields, with archive separate); a log (habit and date); a setting (key).
- **Newer wins.** The newer edit (`editedAt`, clamped to the server's clock) wins.
- **Deleted stays deleted.** A record deleted on the server is never recreated by an update, archive or log. That gives `gone`. "Save as a new entry" is always the user's explicit choice, never automatic.
- **A delete is an edit.** A queued delete of a record changed elsewhere **later** loses (`conflict-lost`: not deleted). If the record was changed **earlier**, the delete wins, and `replaced` carries the deleted version to the device.
- **Clocks.**
  - A device clock that runs fast is clamped to the server's `now`. Versions only move forward (`nextVersion`).
  - A device clock that runs slow can lose a race it should have won. The losing text is still kept as a note.
  - The client learns its offset from `serverNow` (§4.4), which makes this rare.

### 3.6 Exactly once: why it holds without an op ledger

| Window | Why there is exactly one effect |
|---|---|
| Device crashes before sending | The operation is still in the outbox (strict durability, §4.4). |
| Server applied and persisted, but the response was lost | Create: the cid row exists, so **unchanged**. Update, archive, log or settings: the content equals the payload, so **unchanged**. Delete: the row is missing, so **unchanged**. |
| Same as above, and another device changed the record before the retry | The stored version is `>= nextVersion(own result)`, so it is later than `ts`. The retry gives **conflict-lost** and never overwrites the later change. |
| Server applied in memory and crashed before persisting | No 200 was sent (persist before answer). The change was lost with the crash, so the retry applies it once. |
| Two copies of the same request in flight (timeout plus retry) | `apply` is synchronous. The second copy sees the first copy's in-memory effect (**unchanged**) and awaits the same persist queue. |
| Device crashes after the 200 but before deleting the operation | It resends, gets **unchanged**, and the operation is removed. |

A replayed `conflict-won` comes back as `unchanged`, so `replaced` is not repeated. That needs the 200 to be lost exactly then, which is accepted and documented. Correctness never depends on time-limited state: no 90-day or 180-day window applies to creates.

### 3.7 Restore, password change, account deletion

- **Restore** (`backup/backup.ts` `restoreBackup`). Right before `vault.replaceDatabase(newDb)`, `carrySyncState(vault.db, newDb)` runs. If the live database has `sync:key`, it copies `sync:key` into the new database and writes a **new** `sync:epoch`.
  - **Why the key is copied:** devices' outboxes stay readable.
  - **Why the epoch changes:** queued updates, deletes and logs addressed by integer id become `stale`, because ids may be reused after a restore (E11). Queued creates still apply.
  - In local mode no `sync:` row exists and nothing is written, so the behaviour is byte-identical.
- **Password change or reset (`rekey`).** The database content, and therefore the AOK, is unchanged. Other sessions get 401 and keep their outboxes (§4.8).
- **Account deletion.** The AOK goes with the diary. Outboxes for that account on other devices can no longer be decrypted, and only "Delete" is offered (§4.8). The deletion dialog says so.
- `UserVault` (`server/src/security/session-types.ts`) gains `readonly isClosed?: boolean`. `DiaryVault` already has the getter (`vault.ts:114`).

### 3.8 Error table (sync routes)

| Status | Code / key | Client action (§4.5) |
|---|---|---|
| 400 | `VALIDATION` (field) / `server.sync.badRequest`, `badEditedAt`, `unknownClientId` | definitive: note "not saved" |
| 401 | `UNAUTHORIZED` / `SESSION_EXPIRED` | stop; keep the outbox |
| 403 | `FORBIDDEN` (guest) | offline mode off for guests |
| 409 | `FORBIDDEN` / `server.sync.accountMismatch` | stop; never send this account's outbox with this token |
| 413 | body too large | definitive: note "too large" |
| 423 | `LOCKED` | pause until unlocked |
| 429 | rate limit | back off (`Retry-After`) |
| 503 | `IO` / `server.sync.notSaved`, `Retry-After: 5` | back off; the operation stays |
| 507 | `IO` / `server.vault.quota` | this chain waits (backoff, cap 10 min); deletes continue |

There are five new server keys in all 20 locales:
- `server.sync.badRequest`
- `server.sync.badEditedAt`
- `server.sync.unknownClientId`
- `server.sync.accountMismatch`
- `server.sync.notSaved`

### 3.9 Older clients and rollback

- **Older apps** do not change at all: no response shape changes, no CORS change, no new required field.
  - Their writes through the old routes set `updated_at` for entries as today.
  - For habits, logs and settings they leave no time row. Such a record counts as older than any queued change, and the overwritten version still reaches the replaying device as `replaced`.
- **Rollback.** A pre-H10 server opens a diary that contains `sync:` rows unchanged: `meta` is unused, and the schema version is still 1.
  - Rolling the server image back is therefore safe.
  - While the server is rolled back, clients see `/api/sync` give 404 and simply wait (§4.5).

---

## 4. Client engine: `src/offline/**`, one implementation for Windows, Android and the web

### 4.1 When it is on

Offline mode is **enabled** when all of the following hold:
- `apiBaseKind()` is the server, or same-origin with `ServerInfo.mode === 'hosted'`;
- `ServerInfo.offlineSync === 1`;
- the user is authenticated and not a guest;
- `window.isSecureContext && crypto.subtle` exist;
- the AOK is in memory.

Otherwise the facade passes every call straight to today's functions: local builds, page tests and old servers are untouched.

### 4.2 Connectivity (`src/offline/connectivity.ts`; it drives the existing `src/api/connection.ts` store)

- **Sources of truth:** request outcomes, as today (`reportConnectionLost` / `reportServerReached`), plus a probe.
  - A timeout counts as status 0.
  - `navigator.onLine` events only **trigger** a probe (E15).
- **Probe.** `GET /api/health`: anonymous, `cache: 'no-store'`, 5 s timeout. Online means 200 with JSON `ok === true`. A captive portal's HTML 200 counts as unreachable.
- **States.** ONLINE → SUSPECT → OFFLINE → SYNCING → ONLINE.
  - The data layer switches at the **first** failure: reads go to the cache, writes go to the outbox anyway.
  - The UI shows "offline" only after **1.5 s** of continuous failure, or after a failed probe.
  - **SYNCING** shows "Uploading N changes…" for at least 1 s. Then "All changes are saved on the server." shows for 2.5 s, and the bar hides. A blip that recovers within 1.5 s is never shown.
- **Probe schedule while OFFLINE and visible:** 2, 4, 8, 16, 32, then every 60 s, with ±20 % jitter. Paused while hidden.
- **Immediate probe.** At most one every 2 s, and the schedule resets to 2 s. Triggers:
  - `online`, `offline`, `visibilitychange` to visible, `focus`, `pageshow`;
  - the platform's `notifyResume()` (Capacitor `appStateChange` with `isActive`);
  - a write while offline;
  - "Try now".
- **Timeouts.** `request()` gains `timeoutMs?: number`, composed with the caller's signal through `AbortSignal.any` / `AbortSignal.timeout`, or a hand-linked `AbortController` where `AbortSignal.any` is missing. A timeout throws status 0. The default stays "none", so today's calls are unchanged.
  - Cached GETs through the facade: 10 s.
  - Sync operations: 20 s plus 1 s per 100 KB.
  - Key fetch: 10 s.
- **CORS or proxy trap.** If `POST /api/sync/op` fails with status 0 three times in a row while the probe succeeds, the chain is marked `blocked` and a note says "could not be sent". The operation stays.
- **When offline mode is enabled,** `ConnectionProvider`'s retry-on-`online`-only behaviour is replaced by this monitor. Otherwise it is unchanged.

### 4.3 Write path (the facade in `src/api/index.ts`)

- The groups `entries`, `habits`, `settings`, `calendar` and `insights.home` are wrapped by `offlineAware(group)` from `src/offline/facade.ts`. Signatures do not change.
- The in-scope writes are:
  - `entries.create`, `entries.update`, `entries.remove`;
  - `habits.create`, `habits.update`, `habits.archive`, `habits.log`, `habits.removeLog`;
  - `settings.update`.
- **Each write:**
  1. **Build the operation.** Its `base` is the version this device last showed for the record. The facade keeps a "seen" map of every record it returned. If the record was shown from a pending operation, the base is `{ op: opId }`, resolved at seal time (§4.4).
  2. **Store the operation.** Coalesce it (§4.4) and write it to IndexedDB in one `readwrite` transaction with `{ durability: 'strict' }`.
     - If the transaction fails (for example `QuotaExceededError`), the promise rejects with `shell.sync.notSavedOnDevice`. The form keeps its text.
  3. **Kick the replayer.**
  4. **Resolve** one of three ways:
     - **(a)** The server answers within `ONLINE_CONFIRM_MS = 2000`: resolve with the server record. This includes the real id: online behaviour is the same as today.
     - **(b)** 400 `VALIDATION` within that window: remove the operation and reject with the same `ApiClientError`. The form shows it inline, as today.
     - **(c)** Otherwise, or immediately when OFFLINE is known: resolve with an **optimistic record** and show the toast "Saved on this device…".
       - An optimistic create has a negative id: -1, -2 and so on, from a persisted counter.
       - The record carries a client-only marker read through `isPendingRecord(x)`.
- **Online-only writes run only when the outbox is empty.** These are habit delete and reorder, seed demo, restore, profile, password, sessions and account deletion.
  - They first call `offline.drain()`, which shows "Uploading your changes first…".
  - If anything is left after the drain, they show "Your changes have not been uploaded yet…" and do nothing.
  - So a direct write can never overtake a queued one.

### 4.4 Outbox

**Chains**

| Chain | Covers | Depends on |
|---|---|---|
| `entry:<clientId or id>` | each entry | — |
| `habits` | all habit definitions (creation order sets `sort_order`) | — |
| `log:<habit clientId or id>:<date>` | each log | the habit's create, when the habit is local |
| `settings` | settings | — |

- The replayer sends **one operation at a time**. It picks the operation with the lowest `seq` that is the head of its chain, whose dependencies are acknowledged, and whose chain is not waiting on backoff.
- A stuck chain never blocks the others.

**Sealing (fixes E5)**
- An operation is **unsealed** until the replayer, in a `readwrite` transaction, sets `sealed = true` and `attempts += 1`, and only then calls `fetch`.
- A sealed operation's payload and `base` never change, and it leaves the outbox only on a definitive answer.
- Transactions on the same store are serialised, so a coalesce in one tab and a seal in another cannot interleave.

**Coalescing (unsealed operations only).** The merged operation gets a **new** `opId` and keeps the first one's `seq`.

| Unsealed sequence on one record | Result |
|---|---|
| create + update(s) | one create with the final input |
| create + delete | both dropped; nothing is sent |
| update + update | one update: latest input, first base, latest `editedAt` |
| update + delete | one delete with the first base |
| `habit.create` + `habit.update` | one create with the final input |
| `habit.archive` + `habit.archive` | the last one, with the first base |
| `log.set` / `log.delete`, same habit and date | the last one, with the first base |
| `settings.patch` + `settings.patch` | merged per key: last value, first base for each key |

**Base resolution at seal time.** A base of `{ op: P }` becomes:
- the version P produced, when P was applied, conflict-won or unchanged (the `record` of its result, kept in the journal);
- otherwise P's own resolved base.

Chain order guarantees that P has been answered before its successor is sealed.

**Time.**
- `editedAt = new Date(Date.now() + offset)`.
- `offset` is learned from `serverNow` minus (send time + RTT/2) on every sync response, smoothed, persisted in `meta`, and capped at ±24 h.

**Persisted operation.** Plaintext fields: `{ seq, sealed, chainTag, deps, attempts, nextAt }`. `chainTag` = HMAC of the chain. Everything else is inside `ct`, AES-GCM (§5.2), including the kind.

**Limits.**
- An operation over `SYNC_MAX_OP_BYTES` is refused at enqueue with "too long to save", and the form keeps its text. This is the same limit as today's `PUT /api/entries`.
- The status panel warns above 500 operations or 20 MB.

### 4.5 Replayer (`src/offline/replayer.ts`)

**Single flight**
- `navigator.locks.request('ypd-outbox-' + userId)` across tabs and windows. If Web Locks are missing (the jsdom test environment), an in-process mutex is used.
- A `BroadcastChannel('ypd-offline-' + userId)` refreshes other tabs.

**Triggers**
- app start (after the session is restored);
- probe success;
- resume or visibility;
- every enqueue while ONLINE;
- after unlock and after login;
- "Try now".

Before the first operation it ensures the AOK and epoch are fresh (`GET /api/sync/key`, cached for the run).

| Answer | Action |
|---|---|
| 200 `applied` / `unchanged` | In one transaction: delete the operation; add a journal entry with the result; for creates, record id-map entries (`localId → {clientId, serverId}`). Then delete the mirror file. Continue. |
| 200 `conflict-won` | As applied. If `replaced` is present, add a **note** with it (§4.9). |
| 200 `conflict-lost` | Delete the operation; note with the user's version; refresh that record in the cache from `record`. |
| 200 `gone` | Delete the operation; note with the user's version; remove the record from the cache. |
| 200 `stale` | Delete the operation; note with the user's version ("restored from a backup"); drop the read cache and id map; keep the epoch from the answer. |
| status 0, timeout, gateway 502/503/504 without the server's JSON | Stop; OFFLINE; probe schedule. |
| 401 | Stop. Keep the outbox and notes (§4.8). The auth flow takes over (`UNAUTHORIZED_EVENT` already fires from `client.ts:341`). |
| 423 | Stop until unlocked. |
| 429 / 503 | Pause everything: `Retry-After`, or 2 s doubling to 5 min. |
| 500 / 507 | That chain waits: 2 s doubling, cap 10 min. After 5 attempts, a "still trying" line with the server's message. Other chains continue, so deletes still free space. |
| 400 / 413 | Definitive. The operation, and every later sealed or unsealed operation of the same chain and of chains that depend on it, become notes: "not saved" or "waits for a change that was not saved". The notes hold the full latest text. |
| 409 account mismatch, 404 route | Stop and report; never discard; retry at the next start. |

### 4.6 Read cache and overlay

**Allow-list.** Only these GET responses are cached, per account.

| Request | Kept | Warm-up when online |
|---|---|---|
| `/api/settings` | 1 | yes |
| `/api/habits?includeArchived=true` and `=false`; `/api/habits/templates` | 1 each | yes |
| `/api/habits/progress?date=D` | last 7 dates | today |
| `/api/habits/status?from&to` | LRU 3 | — |
| `/api/home` | 1 | yes |
| `/api/calendar/month?year&month`, `/api/calendar/range` | LRU 6 each | current month |
| `/api/entries?…` list pages | LRU 12 | last 30 days, `limit=500` |
| `/api/entries/:id` | everything from the last 30 days, plus LRU 200 | — |
| `/api/entries/day/:date` | LRU 31 | the 7 most recent dates with entries |
| `/api/entries/meta/tags`, `/people`, `/locations` | 1 each | yes |

- **Never cached:** insights, stats, search, backup, export, sessions, `/api/server/*`, due reminders, data-dir.
- **Session snapshot.** `/api/auth/me` is not served from the cache. The **session snapshot** (§4.7) is stored separately.

**Where and how**
- **Storage.**
  - On the Windows and Android apps **with "Remember me"**: IndexedDB.
  - Every other session (web, or no "Remember me"): memory only (B). After a restart the cache could not be used anyway.
- **Keys.** Records are keyed by HMAC(path and query), because URLs contain diary text such as `?text=`.
- **Size.** 25 MB per account, LRU on `lastUsed`.
- **Write-through.**
  - Each allow-listed GET that succeeds replaces its record whole.
  - A cached `GET /api/entries/:id` that now returns 404 deletes its record.
- **Warm-up.**
  - About 16 sequential GETs.
  - Runs after login, at start and after the outbox drains.
  - At most once every 15 min.

**Overlay** (`src/offline/overlay/*`): pure functions, computed at read time, never stored.
- Inputs: the cached or fresh view, plus pending operations, plus journal entries with `appliedAt > view.cachedAt`. Both times come from the device clock (A's rule).
- Creates are de-duplicated by `clientId`.
- Fresh server answers get the overlay of still-pending operations as well.

| View | Rule (B's table, adopted) |
|---|---|
| `Entry` by id | A pending create or update supplies the content. A pending delete gives `NOT_FOUND`. |
| `EntryPage` list | Insert, replace or remove summaries that match the filter (from, to, tag, emotion, text: the same fields the server searches). `makeExcerpt` at 160 characters. Sorted by (date, time, id). `total` adjusted. |
| `DaySummary` | Entries of that date, plus logs with names from cached habits. Averages recomputed as `getDay` does (mean rounded to 2 decimals; maximum sleep). |
| `CalendarMonth` / `CalendarDay[]` | `entryCount`, `hasEntry`, `titles`. Averages recomputed when the day's full entries are cached; otherwise kept. |
| `HabitWithProgress[]` | Create (zero progress), edit, archive, log value and note. `completed` follows the same rule as `isLogCompleted`. `weekTotal` adjusted by the delta. Streaks are kept and marked "updates when online". |
| `Habit[]`, `AppSettings` | Patches applied. |
| `HomeSummary` | `todayEntryCount`, `lastEntry`, `totalEntries`, `habitsToday`. Averages and the insight are kept. |
| tags, people, locations | Counts incremented from pending entries. |

**Missing views.**
- A view that was never cached is synthesised from cached records when possible, with the hint `shell.sync.partialView`.
- Otherwise the page shows `shell.sync.notCachedYet`.

**Pages re-run.** `useApi(..., { offline: true })` subscribes to the engine's data version. It is bumped after each acknowledgement and each refreshed view, and also through the BroadcastChannel.

**Local ids after upload.** `entries.get(-3)` resolves through the id map. `EntryPage` replaces `/entry/-3` with `/entry/<serverId>` once the mapping exists.

### 4.7 Offline start (Windows and Android apps; the web needs the server to load the page)

**Binding.** After every successful `me()` or login with "Remember me" on an app:
- store `localStorage['mpd.offline.current'] = { userId, tokenTag }`, where `tokenTag` = the first 16 hex characters of SHA-256 of the token;
- store the encrypted **session snapshot** in `meta`: `{ user, rememberMe, locked, lastActivityAt, serverInfo: { mode, publicUrl, offlineSync, guestTour, passwordResetAvailable } }`.

**At start, with a token**, `AuthProvider` behaves as follows:
1. The **first** `me()` failure with `isConnectionError` triggers cache start, if the binding matches. Cache start does not wait for today's 1 + 3 + 6 s retries (`AuthContext.tsx:130`).
2. **Cache start:**
   - open `ypd-offline-v1-<userId>`;
   - unwrap the AOK through the platform seam;
   - decrypt `keyCheck`, then the snapshot;
   - set `status: 'authenticated'` with `source: 'cache'`.
3. **Locked at start** if the snapshot was locked, or if `now - lastActivityAt > autoLockMinutes`.
4. `me()` keeps being retried in the background, and on every reconnect. The guard `if (connectionAttempt > 0 && statusRef.current === 'authenticated') return;` (`AuthContext.tsx:177`) must let cache sessions through.
   - 200: refresh the snapshot and switch to `source: 'server'`.
   - 401: §4.8.
5. `useConnectionDisplay` (`ConnectionContext.tsx:123`) returns the **bar**, not the full page, for a cache session.

**No token, no binding, a regular session, the guest, or the web:** today's `NoConnectionPage`. If any outbox exists on the device, one neutral line is added: "Changes written on this device are waiting. They will be uploaded after you sign in." No account name is shown.

### 4.8 Safe paths: never silently lose the user's text

| Event | Outbox and notes | Cache, journal, id map, snapshot, wrapped key | User sees |
|---|---|---|---|
| **Logout**, outbox empty | database deleted, mirror cleared | deleted | as today |
| **Logout** with pending operations or notes | if online, `drain()` first; if anything remains, **dialog before** the server logout | deleted only after "Delete" | "{n} changes on this device have not been uploaded yet. If you sign out now they will be deleted from this device." [Stay signed in] (default) [Review] [Delete them and sign out]. The lock screen's "Log out" uses the same dialog. |
| **401** (expired: 90 days, not sliding; revoked; password changed elsewhere; password reset; device key rotated; regular session after a server restart) | **kept** (ciphertext, plus mirror) | deleted; `mpd.offline.current` removed | login page: "Sign in again to upload the {n} changes saved on this device." The same `userId` signs in, the AOK comes from the server, and replay resumes. |
| **Another account signs in** on this device | the other account's outbox and notes stay in their own database and are never decrypted or sent | the other account's cache and wrapped key are deleted; the app tree is remounted with `key={userId}` | neutral line: "Changes written by another account on this device are waiting." [Delete] (with confirmation). No "copy": that would disclose another account's text. |
| **Account deleted on this device** | deleted (it is the user's own choice) | deleted | the delete dialog adds "{n} changes not yet uploaded will be deleted too. Changes still waiting on your other devices will be lost." |
| **Account deleted elsewhere** | undecryptable (the AOK is gone) | deleted at the first 401 | the line above, with [Delete] |
| **423 locked** | paused | kept | lock screen; after unlock, replay resumes |
| **Guest tour** | offline mode off | — | today's banner |
| **IndexedDB evicted** | recovered from the mirror after sign-in (§5.4) | rebuilt | "Recovered {n} changes saved on this device." |

`offline.wipeAccount(userId)` is called explicitly, by `logout` after the dialog and by `DeleteAccountSection` after the deletion succeeds. It is **not** called inside `clearSignedOutAccountData` (E16).

### 4.9 What the user sees for each item (notes)

- **Where notes live.** Notes are an encrypted store. They stay until the user acts, and the bar keeps "{n} changes need your attention – Review".
- **Review dialog.**
  - Waiting operations: kind, a short label ("Entry 'Morning walk', 23 Oct"; "Habit Water, 3 glasses"; "Setting: theme") and state (waiting, uploading, still trying).
  - Then the notes:

| Note | One line | Actions |
|---|---|---|
| entry `conflict-lost` | "'Morning walk' was changed on another device after your change; the newer version was kept." | [Show my version] [Save as a new entry] [Copy text] [OK] |
| entry `conflict-won` with `replaced` | "'Morning walk' was also changed on another device; your newer version was kept." | [Show the other version] [Save it as a new entry] [Copy text] [OK] |
| entry `gone` | "'Morning walk' was deleted on another device. Your change was not applied." | [Save as a new entry] [Copy text] [Discard] |
| delete `conflict-lost` | "'Morning walk' was changed on another device after you deleted it, so it was not deleted." | [OK] |
| delete `conflict-won` with `replaced` | "'Morning walk' was deleted, but it had been changed on another device." | [Save that version as a new entry] [Copy text] [OK] |
| `stale` | "Your diary was restored from a backup after this change; it was not applied." | [Save as a new entry] [Copy text] [Discard] |
| habit, log or setting (any conflict or gone) | one line, for example "Water, 23 Oct: the value from the other device was kept." | [OK] |
| rejected (400) | "Not saved: {server message}" | [Open and fix] (form prefilled from the payload) [Copy text] [Discard] |
| too large (413) | "Too large to upload." | [Copy text] [Discard] |
| blocked dependant | "Waits for a change that was not saved." | [Discard] |
| still trying | "Still trying: {server message}" | [Try now] |

- **Discard** always asks for confirmation.
- **"Save as a new entry"** enqueues an ordinary `entry.create` with a new `clientId`.
- **Badges on pages.** "Not uploaded yet" on `EntryCard` and `EntryPage` for records with pending operations, and "Needs attention" for records with notes.

---

## 5. Storage and security on the device

### 5.1 The key (AOK) per platform, and the residual risk

The AOK is 32 random bytes, generated and kept by the **server** inside the encrypted diary (§3.3). Rules:
- The client holds it in memory as raw bytes only long enough to derive the keys (§5.2), then zeroes them.
- It is fetched after every successful `me()` or login.
- The engine is armed only once it is present.

| Platform | AOK at rest | Protects against | Residual risk (stated honestly) |
|---|---|---|---|
| **Android app, "Remember me"** | Wrapped with AES-256-GCM by a non-exportable Android Keystore key, alias `com.mydiary.app.offline.v1`, no user-auth binding so it works at start. New plugin `DiaryOfflinePlugin` (`wrapKey` / `unwrapKey` / `deleteKey`). The blob is stored in IndexedDB `meta`. | copies of app files and forensic images without the secure hardware; backups (`AndroidManifest.xml:35` `allowBackup="false"`, and the extraction rules exclude everything) | A rooted phone, or code running as the app, can use the key. A lost phone that never reconnects keeps a readable copy of recent entries until it is wiped. |
| **Windows app, "Remember me"** | `CryptProtectData`, current-user scope, `CRYPTPROTECT_UI_FORBIDDEN`, entropy `ypd-offline-v1:<userId>`, through the Tauri commands `offline_key_protect` / `offline_key_unprotect`. The blob is stored in IndexedDB `meta`. | the profile folder copied to another PC or user; a stolen disk without the Windows login | Any process running as the same Windows user can unprotect it. It could already steal the remember-me token from the same WebView2 profile; the new exposure is offline readability after a revocation. A roaming profile can decrypt on another domain machine. |
| **Web, or any session without "Remember me"** | memory only | nothing decryptable at rest | XSS while the tab is open (as today). After a restart, the outbox stays ciphertext until the next sign-in. |

**Why not sessionStorage** (item 11's suggestion): it dies with the app, so it cannot serve offline start, and memory-only already covers the web.

**Why server-held:**
- A device that is signed out (401) loses the wrapped key at its first contact.
- A device that signs in again gets the key back, so queued text is never orphaned.
- No password, recovery key or diary key is involved.

### 5.2 Encryption format (Web Crypto, secure context only)

- **Keys.**
  - `enc = HKDF-SHA256(AOK, salt "ypd-offline-v1", info "enc|" + userId)` gives an AES-GCM-256 key, non-extractable.
  - `mac = HKDF(…, info "mac|" + userId)` gives an HMAC-SHA256 key, non-extractable, used for cache keys and chain tags.
- **Each value.** A random 12-byte IV, and AAD `ypd-offline-v1|<userId>|<store>|<recordKey>`. A blob moved to another account, store or slot fails to decrypt.
- **`keyCheck`.** `meta.keyCheck` = encryption of a fixed string. If it does not decrypt, the engine **never writes**: it shows "Changes saved on this device cannot be read right now" and keeps the data.
- **Secure context.**
  - Android uses `androidScheme: 'https'` (`capacitor.config.ts:28`).
  - Windows uses `http://tauri.localhost`; `*.localhost` is potentially trustworthy, and the installed build is checked in WP-H10d.
  - Without `crypto.subtle`, offline mode stays **off**: today's behaviour, logged.

### 5.3 IndexedDB layout

There is one database per account: `ypd-offline-v1-<userId>`.

| Store | Key | Plaintext | Ciphertext |
|---|---|---|---|
| `meta` | name | the wrapped-key blob (already protected by DPAPI or the Keystore), `nextLocalId`, `clockOffset`, `epoch`, `persistGranted` | `keyCheck`, the session snapshot (apps with remember-me only) |
| `outbox` | `seq` (autoIncrement) | `sealed`, `chainTag`, `deps`, `attempts`, `nextAt` | the operation |
| `notes` | autoIncrement | `createdAt` | the note, with the user's or the other version |
| `journal` | `opId` | `appliedAt` | the operation plus its result (kept 7 days) |
| `cache` | HMAC | `cachedAt`, `lastUsed`, `bytes` | the response (remember-me apps only; otherwise an in-memory twin) |
| `idmap` | `localId` | — | `{ clientId, serverId? }` |

**Visible metadata:** counts, sizes, times, and the user id in the database name. Contents, kinds, dates, titles and URLs are not visible.

### 5.4 Outbox mirror (A; fixes E7)

- **When written.** For every outbox or notes record written in IndexedDB, the same ciphertext is also written through the platform seam `OutboxMirror`.
- **Where.**
  - Android: `@capacitor/filesystem` `Directory.Data`, `offline/<userId>/<seq>-<opId>.op`. That folder is app-private and excluded from backup.
  - Windows: `offline_mirror_*` commands writing atomically (tmp, then rename) under `%LOCALAPPDATA%\com.mydiary.app\offline\<userId>\`. MSIX installs get the package-private equivalent, by the same logic as `lib.rs` `packaged_webview_data_dir`.
- **Deleted** after the IndexedDB delete commits.
- **At engine open:**
  - If the account's database has no `meta` (it was evicted or is new) but mirror files exist, import them (after `keyCheck` with the AOK fetched after sign-in) and replay. The server's idempotency (§3.6) makes any acknowledged leftover harmless.
  - If `meta` exists, mirror files whose `opId` is not in the outbox are orphans from an acknowledged operation. Delete them.
- **Web:** no mirror. The web asks for `navigator.storage.persist()` on the first enqueue (the apps do too) and records the answer.

### 5.5 Wiping

- **Logout and account deletion:** see §4.8.
- **What a full wipe does:** `indexedDB.deleteDatabase`, then `mirror.clear(userId)`, then remove `mpd.offline.current`, then `keyVault.delete(userId)` (removes the Keystore alias entry; DPAPI blobs live only in IndexedDB).
- **401:** deletes `meta.wrappedKey` and `meta.snapshot`, plus `cache`, `journal` and `idmap`. The outbox, notes and mirror stay.
- **Uninstall.**
  - Android removes app data.
  - MSIX: Windows deletes the user data folders.
  - NSIS: the WebView2 folder and the mirror folder are removed only with the uninstaller's "delete application data" option. WP-H10d verifies that this option covers `%LOCALAPPDATA%\com.mydiary.app`.
  - Whatever is left is ciphertext, plus the DPAPI-wrapped key on Windows.
  - Settings (Security card) adds: "Sign out before uninstalling to delete this device's copy."

### 5.6 Size and eviction

- Cache: 25 MB per account (LRU).
- Journal: 7 days.
- One operation: at most `SYNC_MAX_OP_BYTES`.
- The panel warns above 500 operations or 20 MB.
- Chromium's origin quota is not the binding limit.
- **Eviction.** Best-effort storage can be evicted under storage pressure. Defences: `persist()` is requested, the native mirror covers the apps, and on the web the honest residual risk is stated.

### 5.7 Offline unlock (A, recommended by both; adopted)

- **When it is offered.** Only while the connection state is OFFLINE and the session is authenticated (cache start or in-memory). The lock screen then offers "Unlock with this device's screen lock".
- **What it unlocks.** Only the local UI. If the server session was locked earlier, the next replay gets 423, and the lock screen asks for the password once: "Enter your password to upload your changes."
- **Android** (`DiaryOfflinePlugin.verifyUser`):
  - API 30+: `BiometricPrompt` with `BIOMETRIC_STRONG | DEVICE_CREDENTIAL`.
  - API 29: `setDeviceCredentialAllowed(true)`.
  - API 24-28 (`minSdkVersion = 24`): `KeyguardManager.createConfirmDeviceCredentialIntent`.
  - Availability: `KeyguardManager.isDeviceSecure()`.
- **Windows** (`offline_user_check_available`, `offline_user_check`): `UserConsentVerifier.CheckAvailabilityAsync`, then `IUserConsentVerifierInterop::RequestVerificationForWindowAsync(hwnd, message)`.
- **Web:** not available.
- **Fallback.** If the check is unavailable, or after 3 failed or cancelled checks: "Unlocking needs a connection to the diary server. What you wrote is saved on this device."
- **Nothing derived from the password is ever stored (E8).** The lock overlay is JavaScript state over data already in memory, so an OS-verified boolean is the right strength. This is unlike the server lock in `mobile/plugins/README.md`.
  - *2026-11-08:* the owner overrode this for the "Remember me" case - the lock screen now also accepts the diary password offline, checked on the device against a scrypt-derived wrap of the AOK; see the dated note in §13 ("offline unlock by password") for the rule, the format and the residual risk that replaces E8.
- **Existing flag untouched.** `BIOMETRIC_UNLOCK_ENABLED` (`mobile/platform/biometric.ts:28`, `false`) is unrelated and stays as it is.

### 5.8 Never stored on the device

- the password;
- the recovery key and the diary key;
- the server's device key;
- the AOK in plaintext;
- reset tokens or codes;
- a second copy of the session token: only `tokenTag`, a truncated hash;
- insights, stats, search questions or answers, backups, exports;
- data of other accounts, which live in separate databases and are never decrypted.

*2026-11-08:* the list stays true, with one addition made by the owner's decision in §13 ("offline unlock by password"): on an app with "Remember me" the AOK is also kept wrapped under a key derived from the password with scrypt (`meta.passwordWrap`) - the password itself is still never stored.

---

## 6. UI

### 6.1 Status bar (`SyncStatusBar` replaces `ConnectionBanner` for signed-in, non-guest users when offline mode is enabled; same slot, `role="status"`, one line on mobile)

| State | Text | Actions |
|---|---|---|
| offline, nothing waiting | `shell.sync.offline`: "No connection – what you write will be saved to the server when the connection returns." | Try now |
| offline, n waiting | the same, plus a chip `shell.sync.waiting` | Try now · Review |
| uploading | `shell.sync.uploading` | — |
| drained | `shell.sync.allSaved` (2.5 s) | — |
| attention > 0 (stays) | `shell.sync.attention` | Review |

- **Announcements.** One polite announcement per state change, through `AnnouncerContext`. Only "needs your attention" is assertive.
- **Wording.** It never says "offline mode": the Privacy card already has "Offline privacy mode" (`shell.offlineBlocked`, `OFFLINE_MODE_KEY`). New keys use the `shell.sync.*` prefix, and the code never calls `setOfflinePrivacyMode`.

### 6.2 Pages and controls that need a connection

These show `NeedsConnection` ("This needs a connection to the diary server." [Try again]), and their buttons are disabled offline with the same description:
- Insights, Stats and Search;
- Backup, Restore and Export;
- account management: profile, password, sessions, account deletion;
- habit delete, habit reorder, seed demo.

### 6.3 New texts (`shared/i18n/messages/<20 locales>/shell.ts`; real translations; ICU plurals; parity test green)

`shell.sync.`:
- offline, waiting, uploading, allSaved, attention, tryNow, review
- savedOnDevice, notSavedOnDevice, tooLongToSave
- needsConnection, notCachedYet, partialView, updatesWhenOnline
- badgeWaiting, badgeAttention
- panelTitle
- state.waiting, state.uploading, state.stillTrying
- reason.lost, reason.won, reason.gone, reason.deleteLost, reason.deleteWon, reason.stale, reason.otherLost, reason.rejected, reason.tooLarge, reason.blocked, reason.cannotSend, reason.unreadable
- action.showMine, action.showOther, action.saveAsNew, action.copy, action.openFix, action.discard, action.discardConfirm, action.ok
- logout.title, logout.text, logout.stay, logout.delete
- login.waiting, noConnection.waiting
- otherAccount.text, otherAccount.delete, otherAccount.confirm
- lock.offline, lock.deviceUnlock, lock.passwordToUpload
- drainFirst, drainFailed
- deleteAccount.pending, deleteAccount.otherDevices
- recovered, storageWarning, uninstallHint

That is about 55 keys. English wording as in §4.8, §4.9 and §6.1.

---

## 7. One implementation in `src/`, plus what each platform adds

| | Windows (Tauri) | Android (Capacitor) | Web |
|---|---|---|---|
| Engine | `src/offline/**` | same | same |
| Offline start | yes (bundled UI) | yes | no (no service worker: HOSTED-PLAN 4a) |
| AOK at rest | DPAPI commands; JS adapter `src/offline/native/tauri.ts` (lazy `invoke`, as `client.ts` already does) | `DiaryOfflinePlugin` (Keystore) through `mobile/platform/offline.ts` | memory only |
| Mirror | `offline_mirror_put/list/read/delete/clear` | `@capacitor/filesystem` `Directory.Data` | none |
| Offline unlock | Windows Hello | device credential or biometric | none |
| Resume | `visibilitychange`, `focus` | `appStateChange` → `notifyResume()` | `visibilitychange` |
| Reminders | the minute poll pauses offline, as today | planned natively, so they still fire; re-planned after replay (`changesHabits` plus `/api/sync/op`) | as today |
| CSP and network | `connect-src` already has the server; no new host | same | same-origin |

**Seams** (`src/offline/seams.ts`, frozen in WP-H10b's first commit):

```ts
export interface OfflineKeyVault { readonly kind: 'dpapi' | 'keystore'; wrap(userId: string, key: Uint8Array): Promise<string>;
  unwrap(userId: string, blob: string): Promise<Uint8Array>; remove(userId: string): Promise<void> }
export interface OutboxMirror { put(userId: string, name: string, bytes: Uint8Array): Promise<void>; list(userId: string): Promise<string[]>;
  read(userId: string, name: string): Promise<Uint8Array>; remove(userId: string, name: string): Promise<void>; clear(userId: string): Promise<void> }
export interface DeviceUserCheck { available(): Promise<boolean>; verify(reason: string): Promise<'ok' | 'cancelled' | 'failed' | 'unavailable'> }
export function setOfflinePlatform(p: { keyVault?: OfflineKeyVault; mirror?: OutboxMirror; userCheck?: DeviceUserCheck }): void;
export function notifyResume(): void;
```

> **Note 2026-11-07 (docs/APPLE-PLAN.md WP-M3, the Mac desktop app).** `OfflineKeyVault.kind` is now `'dpapi' | 'keystore' | 'keychain'`: the Mac app's vault is `tauriKeychainVault` (src/offline/native/tauri.ts) - the same protect / unprotect commands, but the key itself lives in the Keychain (src-tauri/src/platform/macos.rs) and the blob in `meta.wrappedKey` is only the marker of that item. A tenth command, `offline_key_remove` (table below), deletes the item; Windows' `remove()` still does nothing. Because a marker alone going would leave the key behind, the engine asks the vault to forget the account whenever it drops the wrapped key - the 401 purge, another account signing in, a start without "Remember me" - and not only on the full wipe of §5.5 (`removeVaultKey` in src/offline/keys.ts; a no-op on Windows, reference-counted per account on Android). Since the same day src/main.tsx installs the Tauri seams under the shell (`installTauriOfflinePlatform()`, a dynamic import, before the first render); Windows releases 1-6 never had them installed, so they ran with the key in memory only.

**Tauri command contract** (JSON over `invoke`; WP-H10b codes the adapter, WP-H10d the Rust side):

| Command | Arguments | Returns |
|---|---|---|
| `offline_key_protect` | `{ userId, keyB64 }` | `blobB64` |
| `offline_key_unprotect` | `{ userId, blobB64 }` | `keyB64` |
| `offline_key_remove` (2026-11-07, APPLE-PLAN WP-M3) | `{ userId }` | — (deletes the Keychain item; the Mac only) |
| `offline_mirror_put` | `{ userId, name, dataB64 }` | — |
| `offline_mirror_list` | `{ userId }` | `string[]` |
| `offline_mirror_read` | `{ userId, name }` | `dataB64` |
| `offline_mirror_delete` | `{ userId, name }` | — |
| `offline_mirror_clear` | `{ userId }` | — |
| `offline_user_check_available` | — | `bool` |
| `offline_user_check` | `{ message }` | `"ok" \| "cancelled" \| "failed" \| "unavailable"` |

- `userId` must match `^u_[0-9a-f]{16}$`; `name` must match `^[0-9]+-[0-9a-f-]{36}\.(op|note)$`. Anything else gives an error, and no path is built from unchecked input.
- `scripts/check-no-network.mjs` passes unchanged: DPAPI, Keystore, files and Hello only, and no new hosts.
- **Text to change.**
  - The `lib.rs` header comment "Nothing but the WebView2 profile (session token, device preferences) is written to the device" changes.
  - So do ARCHITECTURE §2 ("על המחשב נשמרים רק אסימון הסשן והעדפות המכשיר") and the HOSTED-IMPL item 8 sentence.

---

## 8. Work packages

ENV.md rules apply:
- disjoint files; re-read a file before editing it;
- the tree compiles after every step;
- gates pasted;
- fictional data only;
- never port 47321;
- no `store/**` (the Store freeze).

`src/pages/settings/AccountSection.tsx` belongs to the OWNER-ID agent. `src/pages/{WelcomePage,LoginPage}.tsx` and `src/router.tsx` belong to the android-only-onboarding and android-system-language packages until they finish.

**Order**

```
step 0  H10a commit 1: shared/sync.ts + ServerInfo.offlineSync (contract frozen)
        H10b commit 1: src/offline/seams.ts (seams frozen as in §7)
step 1  H10a  ||  H10b  ||  H10d-native (Rust, Java, plugin, mobile/platform/offline.ts)
step 2  H10c (after H10b is green and the onboarding/system-language packages are done)
step 3  H10d e2e + docs (after H10a and H10b; the manual checklist after H10c)
step 4  main session: Fly volume snapshot -> deploy H10a -> smoke -> then build/release the clients
```

### WP-H10a: Server sync contract (about 2 agent-days)

**Owns:**
- New:
  - `shared/sync.ts`
  - `server/src/sync/{validate,store,apply,restore}.ts`
  - `server/src/routes/sync.ts`
  - `server/test/sync-{apply,route,restore,fixture,prune}.test.ts`
- Edits:
  - `shared/types.ts`: `ServerInfo.offlineSync?: 1` only
  - `server/src/app.ts`: hosted mount
  - `server/src/routes/server.ts`: flag
  - `server/src/config.ts`, `server/src/hosted.ts`, `server/src/hosted/types.ts`: `DIARY_OFFLINE_SYNC`
  - `server/src/db/entries-repo.ts`, `server/src/db/habits-repo.ts`: optional `{ at }` on `createEntry`, `updateEntry`, `createHabit`
  - `server/src/backup/backup.ts`: one `carrySyncState` call
  - `server/src/security/session-types.ts`: `isClosed?`
  - `shared/i18n/messages/*/server.ts`: the five `server.sync.*` keys
  - `docs/API.md`: hosted section "Offline sync"

**Tests**
- **`sync-apply`** (unit, a `DiaryDb` in memory):
  - every kind × outcome, including field-scoped archive and settings per key;
  - `decide`, `clampEditedAt` and `nextVersion` tables;
  - the same operation twice, sequentially, gives one effect;
  - a replay after another device's later write never overwrites it;
  - the cid row survives deletion (create, delete, replayed create gives `unchanged` and no row);
  - `stale` after an epoch change;
  - the content-equality normalisation (tags and arrays).
- **`sync-route`** (hosted composition on 127.0.0.1):
  - the key is created once, persisted before the answer, and stable;
  - 403 for a guest, 423 when locked;
  - 409 account mismatch; 400 with `field`; 413 over 2 MB; 507 for growing kinds while deletes pass;
  - **the encrypted file on disk, decrypted, contains the change when the 200 arrives**;
  - an injected persist failure gives 503 `notSaved`, and the retry gives `unchanged`, persisted;
  - a vault closed during the persist gives 503;
  - two concurrent identical requests give one row;
  - `ServerInfo.offlineSync` appears only in hosted mode and disappears with `DIARY_OFFLINE_SYNC=0` while `/api/sync` still answers;
  - the local composition gives 404 on `/api/sync` and its `ServerInfo` is unchanged.
- **`sync-restore`:**
  - restore keeps `sync:key` and writes a new epoch;
  - an old-epoch update gives `stale`, an old-epoch create gives `applied`;
  - a local-mode restore with no `sync:` rows gives an image byte-identical to today's.
- **`sync-fixture`:**
  - copy `mobile/test/fixtures/desktop-data` (account `fixture_noa`; `.mpd.fixture` copied to `.mpd`) to a temp dir;
  - boot hosted with `DIARY_DEVICE_KEY` = the manifest's device key;
  - authenticate with the manifest's remember-me token;
  - do sync writes of every kind; restart; everything is persisted;
  - the hash of the untouched entries is unchanged;
  - the `.mpd` opens with the **local** composition: `currentVersion === 1`, `PRAGMA integrity_check` is `ok`, `sqlite_master` is identical before and after, and the only new rows are in `meta` with the `sync:` prefix;
  - a backup downloaded from hosted mode restores into a local-mode server.
- **`sync-prune`:** time rows older than 180 days go; cid rows never go.

**Acceptance**
- Server gates: `cd server && npx tsc --noEmit && npx vitest run`, all green, **no existing expectation edited**.
- Root and mobile suites green. `mobile/test/compat/containers.test.ts` untouched and green.
- `node scripts/build-server.mjs` and `node scripts/build-hosted.mjs` succeed.
- `SCHEMA_VERSION === 1`.
- `docs/API.md` documents both routes, every outcome and every error.

### WP-H10b: Client offline engine, no UI (about 3 agent-days)

**Owns:**
- New:
  - `src/offline/**`: `index`, `enabled`, `seams`, `crypto`, `keys`, `session`, `clock`, `connectivity`, `outbox`, `coalesce`, `replayer`, `notes`, `journal`, `ids`, `cache`, `facade`, `status`, `mirror`, `store/{types,idb,memory}`, `overlay/{entries,days,calendar,habits,home,settings,meta}`, `native/tauri`, `test-utils/fake-sync-server` (an in-memory server built on `shared/sync.ts` `decide`)
  - all tests for these
- Edits:
  - `src/api/client.ts`: `timeoutMs`, signal composition, timeout gives status 0. **Defaults unchanged.**
  - `src/api/index.ts`: `offlineAware` wrapping; signatures unchanged.
  - `src/api/connection.ts`: only if a field is needed for the 1.5 s visibility.
  - `package.json`, `package-lock.json`: devDependency `fake-indexeddb`, exact version pinned.

**Tests** (jsdom, plus `fake-indexeddb`, plus Node's `webcrypto` assigned to `globalThis.crypto.subtle` in the test setup of these files only)
- Enqueue uses strict durability; "Saved on this device" only after `complete`; a failed transaction rejects and keeps nothing half-written.
- The coalescing table; **sealing** (two engines on one fake IndexedDB: a coalesce never touches a sealed operation); a sealed operation's payload is byte-identical across retries.
- Chains, dependencies and blocked dependants; base resolution at seal time (predecessor applied or lost).
- **Replayer** against the fake server: every row of §4.5.
  - A lost response followed by a retry gives exactly one record.
  - A timeout during a write gives one record.
  - 401 keeps the outbox and notes and wipes the cache, wrapped key and snapshot.
  - 423 pauses; 429 honours `Retry-After`; 507 makes the chain wait while a delete in another chain passes.
  - Account switch: account A's operations are never sent with B's token.
  - Single flight with the in-process fallback.
- **Connectivity** with fake timers: a 300 ms blip shows nothing; the bar appears at 1.5 s; the probe schedule and jitter bounds; resume and visibility triggers; captive-portal HTML gives offline; the CORS trap gives `blocked`.
- **Overlay** golden tests for every view in §4.6.
- **Crypto:** round trip; swapping the AAD user, store or key fails; a `keyCheck` mismatch refuses writes; HMAC keys are stable per account and differ between accounts.
- **Cache:** allow-list only (an insights URL is never stored); LRU 25 MB; memory-only for regular sessions and the web; write-through; a 404 deletes the record.
- **Session:** binding and tag match; offline-start decision; locked-at-start rules.
- **Mirror:** recovery when the database is missing; orphan cleanup when it exists.
- **Facade:**
  - confirmed online within 2 s gives the server record;
  - after 2 s, an optimistic record;
  - 400 within 2 s rejects with an `ApiClientError` and removes the operation;
  - disabled facade gives requests identical to today (same URLs and bodies).

**Acceptance**
- Root gates: `npx tsc --noEmit && npx vitest run && npx vite build && node scripts/check-no-network.mjs`.
- **Every existing page test passes unchanged.**
- The desktop `dist` contains no Capacitor code.

### WP-H10c: UI and app integration (about 3 agent-days; starts after WP-H10b is green)

**Owns:**
- App shell: `src/main.tsx`, `src/App.tsx`, and their tests.
- Contexts: `src/context/{AuthContext,ConnectionContext,LockContext}.tsx` and their tests; new `src/context/SyncContext.tsx`.
- Components and hooks: `src/components/ConnectionBanner.tsx`; new `src/components/sync/{SyncStatusBar,PendingChangesDialog,NeedsConnection,PendingBadge,LogoutPendingDialog}.tsx` and their CSS; `src/hooks/useApi.ts`.
- Pages:
  - `src/pages/{EntryPage,NewEntryPage,DiaryPage,DayPage,HomePage,HabitsPage,CalendarPage,InsightsPage,StatsPage,SearchPage,BackupPage,NoConnectionPage,LoginPage,WelcomePage,LockScreen}.tsx` (WelcomePage and LoginPage only after the onboarding packages finish)
  - `src/pages/habits/{HabitQuickLog,HabitFormDialog}.tsx`
  - `src/pages/entries/EntryCard.tsx`
- Settings sections: `src/pages/settings/{BackupCreateSection,RestoreSection,ExportSection,DeleteAccountSection,SessionsList,ChangePasswordDialog,ProfileEditor,DataSection,SecuritySection}.tsx`. **Not** `AccountSection.tsx`.
- Test helpers: `src/test/**`.
- Texts: `shared/i18n/messages/*/shell.ts`.

**Work**
- Cache start and the `me()` re-run rule (§4.7).
- 401, logout, lock-screen logout and account deletion paths (§4.8), with `offline.wipeAccount` explicit.
- The display rule: bar, not page, for cache sessions.
- Remount with `key={userId}` on account switch.
- The status bar, the review dialog and the notes actions.
- Badges; `NeedsConnection` on the online-only pages and controls.
- `validId` changed to `entryId !== 0`, plus the URL replace after mapping.
- The toasts.
- The lock screen: offline unlock through `DeviceUserCheck`, fallback text, and the 423 password prompt.
- "Drain first" for the online-only writes.

**Tests (component)**
- Each bar state, including no flicker on a 300 ms drop, and the announcements.
- Offline save says "Saved on this device"; online save is unchanged (the existing tests are the proof).
- Start with a token while fetch rejects: the cached home renders as a bar, not the page. Without a binding: `NoConnectionPage`, plus the waiting line when an outbox exists.
- An offline create opens `/entry/-1` with the badge, and the URL is replaced after the mapping.
- The logout dialog (stay, review, delete).
- A 401 keeps the outbox and the login page shows the waiting line.
- Account switch: the other account's line and its delete confirmation.
- Notes render with their actions; "Save as a new entry" enqueues a create.
- Online-only pages show the notice offline.
- Offline unlock: available, ok, cancelled ×3 then fallback; unavailable gives the fallback.
- 20-locale parity test.

**Acceptance**
- Root gates green.
- `npx vite build`.
- The desktop `dist` is free of Capacitor code.
- No change to `AccountSection.tsx`.

### WP-H10d: Platforms, end-to-end test, docs (about 2-3 agent-days; Gradle debug build allowed per the ENV rule for native packages)

**Owns:**
- Windows:
  - `src-tauri/Cargo.toml`: `windows` 0.61 features `Win32_Security_Cryptography`, `Win32_Foundation`, `Security_Credentials_UI`, `Win32_System_WinRT`, `Foundation`, keeping the version in step with Tauri's copy
  - `src-tauri/Cargo.lock`, if it changes
  - `src-tauri/src/lib.rs`: register the commands in both handler lists, and fix the header comment
  - new `src-tauri/src/offline.rs`
- Android:
  - new `android/app/src/main/java/com/mydiary/app/plugins/DiaryOfflinePlugin.java`
  - `android/app/src/main/java/com/mydiary/app/MainActivity.java`: registration
  - new `mobile/plugins/diary-offline/**`
  - new `mobile/platform/offline.ts`, plus its test
  - `mobile/platform/index.ts`: install the seams; resume calls `notifyResume()`
  - `mobile/platform/notifications.ts`, plus its test: `changesHabits` also returns true for a 2xx `POST /api/sync/op`
- E2E: new `mobile/test/hosted-offline.test.ts`.
- Docs:
  - `README.md` and `ARCHITECTURE.md`: offline section; replace the "only the session token" sentences
  - `docs/ANDROID-PHONE-TEST.he.md`: airplane-mode steps
  - new `docs/OFFLINE-TEST.he.md`: the owner's manual checklist for Windows and the phone

**Tests**
- Rust (`cargo test`, Windows):
  - DPAPI round trip; wrong entropy (another `userId`) fails;
  - the mirror put, list, read, delete and clear cycle in a temp dir, with atomic writes;
  - invalid `userId` or `name` is rejected;
  - `offline_user_check_available` returns without UI.
- JS: plugin contract tests (`mobile/platform/offline.test.ts`), and `changesHabits` for `/api/sync/op`.
- `mobile/test/hosted-offline.test.ts`: the end-to-end test in §9.

**Acceptance**
- Root, server and mobile gates; `cargo test`; Gradle debug build; `node scripts/check-no-network.mjs` (no allow-list change).
- On the installed Windows build: `window.isSecureContext && crypto.subtle` is true, and a DPAPI round trip works after a reboot.
- On the phone: the Keystore unwrap works after a reboot, and the device-credential prompt works on the owner's phone.
- The NSIS "delete application data" option removes `%LOCALAPPDATA%\com.mydiary.app`. If it does not, the finding is recorded in `docs/OFFLINE-TEST.he.md` and in openIssues.

---

## 9. End-to-end test (`mobile/test/hosted-offline.test.ts`)

**Setup**
- **Server.** The real hosted composition (`openNativeServer` / `startHosted`, as in `mobile/test/hosted-server.test.ts`), with:
  - a temp data dir;
  - `127.0.0.1` on a free port (never 47321);
  - a test `DIARY_DEVICE_KEY`;
  - fast KDF;
  - a small `DIARY_MAX_DIARY_BYTES` for L6 only.
- **Clients.** `src/api` and `src/offline` with `fake-indexeddb` and Node `webcrypto`. Each "device" has its own IndexedDB factory and storage.
- **A switchable transport** with four modes:
  - `online`;
  - `down`: rejects with `TypeError`;
  - `blackhole`: never settles until aborted;
  - `drop-response`: forwards the request, then throws.
- A "restart" is a new engine on the same IndexedDB and storage.
- **Platform seams.** Fake seams (in-memory key vault and mirror) are installed only by the test. **The shipped `dist` is asserted not to contain the test seam module.**

**Steps**
1. Dana registers on device A with "Remember me", and the cache warms up. Device B signs in as Dana.
2. A goes `down`. On A:
   - create E1 (Hebrew text and emoji), then edit it (coalesced);
   - edit E0; delete E5;
   - quick-log habit H (+1);
   - create H2 and log it;
   - archive H3;
   - change the theme.
   
   Then check:
   - the waiting count;
   - the overlay of the diary list, the day, the calendar month, habit progress and home;
   - `/entry/-1` resolves;
   - nothing was sent.
3. Restart A while `down`: cache start, the overlay is intact, and the lock rule applies.
4. A goes online with `drop-response` on the first operation. The server has **exactly one** E1 (by `clientId`), and every change is applied in order. The notes are empty, and -1 maps to the real id.
5. Device B reads everything back through the API.
6. **Conflicts** (each from a fresh state):
   - **C1:** B edits E7 **after** A's offline edit. A gets `conflict-lost`; A's text is in a note; the server has B's version.
   - **C2:** A's offline edit is newer than B's. A gets `conflict-won`; the server has A's version; the note offers B's version (`replaced`).
   - **C3:** B deletes E8; A edits it offline. A gets `gone`; nothing comes back on the server; A's text is in a note.
   - **C4:** A deletes E9 offline; B edits it later. E9 is not deleted.
   - **C5:** settings. B changes the theme later; A changed language and theme offline. Language is applied, theme loses (`keys`).
   - **C6:** B renames H while A archives it offline. Both changes stay (field-scoped).
   - **C7:** B logs 3 on H for today, and A logs 2 later. A's value wins.
7. **Lifecycle:**
   - **L1:** server restart between the offline writes and the replay. The remember-me session reopens the vault, and the replay completes.
   - **L2:** a regular session plus a server restart. 401; the outbox is kept and the cache wiped; login; key; replay.
   - **L3:** password change on B. A gets 401, signs in with the new password, and replays.
   - **L4:** Lior signs in on A. Nothing of Dana's is sent with Lior's token. Dana's database is untouched. A hand-made operation with `account: dana` and Lior's token gets 409.
   - **L5:** the session is locked on the server (423). The replay pauses; unlock resumes it.
   - **L6:** quota reached. Creates wait (507), and a delete in another chain goes through.
   - **L7:** B restores an older backup. A's queued edit by id gives `stale` and a note; A's queued create is applied.
   - **L8:** A's IndexedDB is deleted (eviction) while mirror files remain. After sign-in the operations are recovered and applied exactly once.
   - **L9:** blackhole. The timeout leads to OFFLINE; recovery leads to exactly one record.
8. Every fetched URL is the test server.

**Manual** (`docs/OFFLINE-TEST.he.md`, the owner's Windows PC and phone):
- airplane mode; write; close the app; reopen offline; reconnect; see "Uploading…"; check in the web UI;
- a conflict between the phone and the PC;
- lock while offline, then unlock with the device's screen lock.

---

## 10. Privacy policy and store sentences

The privacy policy (`store/privacy-policy/privacy-{en,he}.txt`, Part B "hosted", WP-H7) is under the `store/**` freeze. These sentences are handed to WP-H7 or to the main session; WP-H10 agents do not edit `store/**`.

- **§2 "What the app stores, and where": add.**

  > "Without a connection. If the app cannot reach the server it keeps working: what you write is saved on your device, encrypted, and uploaded to the server automatically when the connection returns, even if the app was closed in between. In the Windows and Android apps, if you chose 'Remember me', the app also keeps an encrypted copy of what it showed you recently (recent entries, habits, today's data, the calendar month and your settings) so that you can read it without a connection; otherwise that copy exists only in memory while the app is open. The key to these copies is kept by the server inside your encrypted diary; with 'Remember me', the Windows and Android apps also keep it on the device, protected by Windows Data Protection or by the Android Keystore, so that the app can open without a connection. Your password and your recovery key are never stored on the device."

  Replace the item-8 sentence "nothing is stored on the device except the session token and device preferences" with the paragraph above.
- **§5 "When the app uses the network": add.**

  > "When the connection returns, the app uploads the changes you made, in the order you made them, each exactly once. If the same entry, habit or setting was also changed on another device, the newer change is kept and the app tells you in one line; the other version stays available to you on this device until you dismiss the note."
- **§8 "How to delete your data": add.**

  > "Signing out deletes these copies and the key from the device; if changes are still waiting to be uploaded, the app asks first. Deleting your account deletes them from the device you use; changes still waiting on your other devices can then no longer be uploaded and are lost. On Windows, uninstalling the downloaded version keeps the encrypted copy unless you choose to delete the application data; sign out first to be sure."
- **§10 "Security measures": add.**

  > "Someone who can run programs as your Windows user, or who has full control of a rooted phone, could read the copy kept for 'Remember me'."
- **Google Play Data safety:** unchanged. Data stored only on the device is not "collected", and the categories, encryption in transit and deletion answers stay the same.
- **Microsoft Store:** the answers are unchanged. Add to `store/certification-notes.md` (via WP-H7): "The app keeps an encrypted local copy so that it works without a connection; it is deleted when the user signs out."

---

## 11. Rollout

1. **Merge** WP-H10a, then take a **Fly volume snapshot**, then deploy (`fly deploy --ha=false`) and smoke-test:
   - `GET /api/server/info` reports `offlineSync: 1`;
   - a test account on staging, or the owner's account, gets a key and posts one fictional operation.
   
   No data is converted, so this step can be rolled back by redeploying the previous image.
2. **Clients.** Build Windows (NSIS/MSIX) and Android from WP-H10b-d, and run the manual checklist. They activate only where the flag is present.
3. **Kill switch.** `fly secrets set DIARY_OFFLINE_SYNC=0` removes the flag. Clients stop creating offline work and existing outboxes still drain.

Agents never deploy. The main session does it with the owner.

## 12. Residual risks (accepted)

- **Lost `replaced`.** The `replaced` version is lost if the 200 of a `conflict-won` itself is lost (§3.6). The device's own text is never affected.
- **Clock skew.** A device whose clock runs slow can lose a race it should have won (newer wins by clamped time). Its text is kept as a note.
- **Older apps.** Habit, log and settings writes from older apps carry no time, so a queued change wins against them. The overwritten value is returned as `replaced`.
- **The web.** No offline start, and no eviction mirror.
- **Platform guarantees.** No documented guarantee that Android WebView or WebView2 grants `persist()` (the mirror covers the apps). NSIS uninstall behaviour is to be verified (WP-H10d).
- **Lost device.** A lost device that never reconnects keeps an encrypted copy of recent entries. Someone who can use the device's own Windows user or Android app identity can read it (§5.1).
- **Size limit.** An entry body near the 1,000,000-character limit (`useEntryForm.ts:68`) can exceed the 2 MB request limit. That is true today as well. Offline, it is refused at enqueue with its text kept in the form.

## 13. Post-implementation notes (2026-10-25, binding; added by the main session from the H10a/H10b verify-and-fix rounds)

- **E3 corrected.** /api/sync answers expose `Retry-After` through CORS (hosted mode only), so the Windows and Android apps can honour the 503 `server.sync.notSaved` back-off. Other routes are unchanged.
- **§3.7 corrected.** The sync-state carry on restore (`sync:key` kept, new `sync:epoch`) is hosted-only; a local-mode restore of an image without `sync:` rows stays byte-identical.
- **§3.9 / §11 rollback window.** No backup may be restored while the server runs a pre-H10 version. If one was restored anyway, the account makes a backup and restores it right after the H10a redeploy, before its devices reconnect if possible. docs/API.md has the same text.
- **settings.patch outcome.** The code reports `conflict-won` when any key won (with `replaced`), else `applied`, else `conflict-lost`, else `unchanged`; the per-key truth is in `keys`, and the client turns every losing key into a note.
- **Eviction recovery.** A database without a `meta.keyCheck` row counts as fresh: mirror files are imported, never deleted as orphans; a cache start never creates a missing database.
- **Stale answers** drop the id-map entry of that record, so after a restore a local id never resolves to another record.
- **401 at rest.** The engine listens to UNAUTHORIZED_EVENT from app start and purges the bound account's key, snapshot and cache on any 401 that the AuthProvider does not suppress. The AuthProvider's suppression listener (wrong password on the login form) MUST stay in the capture phase on window.
- **Captive portals.** The probe and the monitor treat non-JSON health answers as offline; ordinary requests still report "reached" before parsing (unchanged defaults); the probe schedule brings the bar back.
- **Known limit.** Id-map entries of creates acknowledged before an eviction are not mirrored, so an /entry/-N URL kept from before the eviction stops resolving in that run only.

### 2026-11-08, owner decision: offline unlock by password (package docs/apple-tasks/OFFLINE-PASSWORD.md)

The owner's words (2026-11-08): the user "will not be forced to unlock only with Touch ID; he can also use the diary password". This replaces the E8 rule of §5.7 for the "Remember me" case and adds to §5.8; nothing changes for the server lock, for the 423 path or for sessions without "Remember me" at rest.

- **The rule.** Offline (connection state OFFLINE), the lock screen shows the password form as it does online, with the note `shell.sync.lock.passwordOffline` ("No connection: your password is checked on this device."). The device's own user check (Windows Hello, Touch ID / the Mac password, the phone's screen lock) stays as a second way, unchanged. The "needs a connection" fallback (`shell.sync.lock.offline`, unchanged text) appears only when neither way exists on this device. A correct password unlocks this device's screen only (`unlockOffline`, exactly like the device check): the server session stays whatever it was, and a 423 at the next upload still asks for the password "to upload your changes".
- **The wrap** (`src/offline/password-wrap.ts`): `{ v: 1, kdf: 'scrypt', N: 32768, r: 8, p: 1, salt: base64 of 16 random bytes, nonce: base64 of 12 random bytes, ct: base64 of AES-256-GCM(plaintext = AOK, key = scrypt(NFKC(password), salt, N, r, p, 32 bytes), additionalData = utf8('ypd-offline-pw-v1:' + userId)) }`. The scrypt parameters are the server's (`server/src/security/kdf.ts` DEFAULT_KDF), so guessing offline costs exactly what guessing against the server's stored verifier costs. The password is NFKC-normalised exactly as `kdf.ts deriveSecret` does before scrypt (nothing else is trimmed or changed), so the wrap accepts precisely the strings the server accepts. A wrap that records other parameters is not opened (a row edited to ask for a huge N would otherwise cost gigabytes). Every failure answers null; a wrong password costs the full derivation like the right one (about 240 ms on the development PC under vitest; `scryptAsync` yields so the UI stays responsive). The AOK bytes and the derived key material are zeroed as soon as they were used; the AES key is a non-extractable CryptoKey.
- **Proof of a correct password:** the AOK that comes out of the wrap must derive the keys (HKDF, §5.2) that decrypt `meta.keyCheck`. A read-only engine (key-check mismatch) never keeps a wrap - it would open and then fail the check, telling the user the right password is wrong.
- **Where it lives (the lifecycle of `meta.wrappedKey`).** In the engine's memory for the run, for every session that had the password in hand; at rest in `meta.passwordWrap` ONLY when the engine is persistent (an app with "Remember me"). The password is "in hand" when the server has just accepted it: a login or registration (`StartArgs.password`, passed once by the AuthProvider and cleared on the next render - a cache start or a `me()` carries none), a successful `verifyPassword` (the online lock screen, the 423 prompt), a successful password change (the NEW password). A failed check writes nothing. A refresh (`refreshPasswordWrap`: the `verifyPassword` success and the password change) drops the wrap in hand FIRST and only then fetches the key: a password change forgets the old wrap even when the new one cannot be made (key fetch failed, engine stopped) - the device is then left without a wrap until the next server check, never with one under a password the user may have changed because it leaked (fixer decision 2026-11-10, "write less at rest"). Whether a start writes at rest follows THAT start's "Remember me", not the persistence of an engine that was already running. The wrap is deleted by every path that deletes the wrapped key - `purgeSensitive` (401 while running, account switch), `purgeAccountAtRest` (401 for the account at rest), `removeWrappedKey` (a start without "Remember me"), `wipeAccount` (sign-out, account deletion) - and the memory copy dies with the engine (teardown). A cache start (the app reopened without a connection) is served by the wrap at rest.
- **Throttle.** The first three wrong passwords cost only the derivation; from the third on the next attempt must wait 2 s, 4 s, 8 s ... capped at 60 s (`shell.sync.lock.wait`, ICU plural), and an attempt during the wait is refused unchecked - even with the right password. The counter lives in the engine per account, mirrored in `sessionStorage`, so a reload of the page in the same run keeps it; a restart of the app, a fresh WebView window or moving the system clock forward (the wait compares wall-clock times) resets it - documented limits: the counter is a courtesy against hasty typing, NOT a security control; the derivation cost is the real defence against guessing (writing the counter at rest would contradict "write less at rest"). A successful unlock or a reconnection resets it. Whether a wrap exists is not hidden by the error texts: the fallback already tells the user when neither way exists.
- **Residual risk (replaces E8 for "Remember me").** Unlike `meta.wrappedKey`, which only the device's own user (DPAPI / Keystore / Keychain) can open, `meta.passwordWrap` can be attacked from a bare copy of the device's data (the IndexedDB of the WebView profile), with NO device user: each guess costs one scrypt derivation (N=2^15, r=8, p=1 - the server's parameters, the same cost as against the server's stored verifier in `accounts.json`), with no server-side rate limit and a counter that a restart resets. A weak password is the risk; a strong one is the protection. Nothing changes for sessions without "Remember me" (memory only, dies with the page) or for the web. The privacy policy's section 5 gains one sentence (docs/apple-tasks/LEGAL-FOLLOWUP.md; applied by the LEGAL package / the main session).
- **Texts:** `shell.sync.lock.passwordOffline` and `shell.sync.lock.wait` in all 20 catalogues (parity test). **Tests:** `src/offline/password-wrap.test.ts`, `src/offline/password-unlock.test.ts`, `src/pages/LockScreen.offline.test.tsx`, `src/context/AuthContext.test.tsx`; the owner's manual steps are docs/OFFLINE-TEST.he.md part A step 8 and part B step 6 (pinned by `mobile/test/offline-e2e/manual-checklist.test.ts`).
