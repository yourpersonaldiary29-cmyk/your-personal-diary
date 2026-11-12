PACKAGE OFFLINE-CALENDARS (2026-11-12) - every calendar system works without a connection, on all platforms (Windows app, Mac app, Android app, website; the iPhone app shares the same code).

THE OWNER'S REQUEST (his words, 2026-11-12): "ועוד בעיה. לשלושת הפלתפורמות. כשאין חיבור אתה יכול לראות רק את לוח השנה הלועזי. תסדרי את זה שיהיה אפשר לראות את כל הלוחות בלי חיבור. שתסיימי תכיני קובץ הטקנה חדש"
Translation: "Another problem, on all three platforms: without a connection you can see only the Gregorian calendar. Fix it so that all the calendars can be seen without a connection. When you finish, prepare a new installer." (The installers are the main session's job, not this package's.)

ROOT CAUSE (found by the main session; confirm it before you change anything):
- src/pages/CalendarPage.tsx loads a plain Gregorian month with calendarApi.month(year, month) (/api/calendar/month). Every other system (Hebrew, Hijri, the Chinese/Korean/other calendars of shared/calendars) loads its month with calendarApi.range(firstDay, lastDay) (/api/calendar/range).
- Both go through useApi(..., { offline: true }) into src/offline/facade.ts.
  - readMonth has a `synthesise`: offline, with the month not cached, it builds the month from the cached entries and marks it partial (markPartial; the page shows shell.sync.partialView).
  - readRange has NO `synthesise`: offline, unless that exact from/to range was cached while online, cachedRead throws NotCachedError, and the page shows the "needs a connection" state instead of a grid.
  - The range key depends on the calendar's own month boundaries, so in practice only the Gregorian calendar works offline.
- warmUp() caches only the current Gregorian month, never the range of the device's preferred system (readStoredSystem() in src/utils/calendar-extras.ts, localStorage CALENDAR_SYSTEM_KEY).
- The holidays (monthHolidays / systemTraditions) and the month grid itself (shared/calendars month-view) are computed locally and need no server.

REQUIRED BEHAVIOUR:
- Offline, the calendar page shows a month grid in EVERY system the engine supports (isSystemSupported), with whatever this device knows:
  - the days of cached /api/calendar/month and /api/calendar/range answers (mood, energy, stress, sleep, entries, titles, habits) - for each date the day of the most recently cached answer that contains it;
  - for dates no cached calendar answer covers, the cached entries of that date (hasEntry, entryCount, titles - as readMonth's synthesise does today);
  - the pending offline changes on top (the existing overlayRange / overlayMonth with calendarContext).
- The synthesised view is marked partial, so the page keeps saying it was put together from what is on this device. It is never the "needs a connection" error. An empty month (nothing known) is an empty grid marked partial, not an error.
- Range answers keep the server's semantics (only days that have data); month answers keep theirs (every day of the month).
- Online behaviour is unchanged: fresh answers are fetched, cached and overlaid exactly as today.
- Warm-up: after the Gregorian month, when the stored system is not Gregorian, also fetch the /api/calendar/range of today's month in that system with exactly the from/to the page will ask for (use the same month-view helpers as the page, so the cache key matches). Errors there must not stop the rest of the warm-up.

IMPLEMENTATION GUIDANCE (follow the existing style of src/offline/facade.ts; small, tested functions):
1. One helper that builds the known days of [from, to] from:
   - e.cache.allOf('calMonth') and e.cache.allOf('calRange');
   - cachedEntries(e).
   Day objects follow shared/types CalendarDay.
2. readRange gets a `synthesise` using it, then overlayRange.
3. readMonth's synthesise uses the same helper for the month's dates and fills the rest with empty days. Keep its current fields and the habitsTotal rules of mergeViewDays in mind: past days take the habit total of the reported past days, future days 0.
4. warmUp addition as above.
5. CalendarPage: check that the partial note appears for a synthesised range too. isPartialView on an array is the question; if it does not, fix it there. Check also that no error state is shown.
6. Update docs/android-tasks/OFFLINE-DESIGN.md section 4.6 ("Missing views") and README.md section 1.4 with one sentence each: all calendars work offline, built from what the device has.

TESTS (vitest; add, do not weaken existing ones):
- src/offline/facade.test.ts, offline (dataOffline):
  - an uncached Hebrew month range is synthesised from cached Gregorian months and cached entries;
  - the same for a Hijri month;
  - a range that crosses a Gregorian month and a year boundary;
  - a Hebrew leap-year month (Adar I / Adar II);
  - an outbox create / edit / delete of an entry inside the range shows / changes / disappears;
  - nothing known -> [] marked partial;
  - a cached exact range still wins over synthesis;
  - online path unchanged;
  - warm-up fetches the preferred system's range and survives its failure.
- src/pages/CalendarPage.test.tsx: offline, the Hebrew (and one more non-Gregorian) view renders a grid with the entries and the partial note, and no "needs a connection" message.
- Also run the mobile suite (the phone app uses the same src/offline).

GATES:
- npx tsc --noEmit (root)
- npx vitest run (root, the full suite, run alone)
- npm run mobile:typecheck
- npm run mobile:test (run alone)
- node --test "scripts/**/*.test.mjs"
- node scripts/check-no-network.mjs

RULES:
- ANOTHER WORKFLOW IS BUILDING THE IPHONE PROJECT ON THE MAC RIGHT NOW from this same tree. Never sync to the Mac and never ssh to it. Never touch ios/, scripts/mac/, scripts/ios/, mobile/ios-app/, mobile/plugins/*/ios/, docs/apple-tasks/IOS-I2.md, package.json or package-lock.json. Keep the tree compiling at every save: write each file in one go, so a build started by the other workflow never sees half an edit.
- No server change is needed (/api/calendar/month and /range stay as they are). Do not deploy, do not build installers.
- Only read-only git (the main session commits).
- The browser pane: your own tab, 127.0.0.1 only.

VERIFIER A (code, edits nothing):
- Read the diff and try to break it:
  - boundaries (first/last day of a range, ranges across years, the calendar limits CALENDAR_MIN_ISO / CALENDAR_MAX_ISO);
  - two cached answers overlapping (which one wins);
  - stale cached days vs newer outbox changes;
  - deleted entries;
  - the partial marker on arrays;
  - warm-up key equality with the page's request;
  - performance with many cached entries (allOf cost).
- Also check that online behaviour is unchanged and that every existing test still passes.
- Findings with evidence.

VERIFIER B (end to end in a real browser, edits nothing in the project):
- Setup:
  - Build the UI (npx vite build) and a hosted bundle into C:\Users\AVI\Projects\mpd-probe\e2e-cal\build (node scripts/build-hosted.mjs --out <that folder>).
  - Start it with PowerShell Start-Process on 127.0.0.1:47491. Data folder C:\Users\AVI\Projects\mpd-probe\e2e-cal\data. Variables: DIARY_MODE=hosted, DIARY_PUBLIC_URL=http://127.0.0.1:47491, DIARY_BIND=127.0.0.1, DIARY_PORT=47491, DIARY_REGISTRATION=open, DIARY_CLIENT_IP_HEADER=x-e2e-client-ip. The header is test only: send a distinct made-up IPv4 per API registration.
  - Register a test user and create entries on several dates of the current Gregorian month and the next one (API with the token).
  - In your own browser-pane tab, sign in. Open the calendar in Gregorian and in Hebrew online.
- Offline test:
  - Stop the server process you started. That makes the app offline.
  - Without reloading the page, switch to months and systems you did NOT open while online: Hebrew next month, Hijri, and every other supported system.
  - Each must show a grid with the entries on their days and the partial note, and must not show "needs a connection".
  - Also check a Gregorian month not opened before.
- Back online:
  - Start the server again.
  - The views become complete (fresh answers); nothing is duplicated or lost.
- Report with screenshots, or read_page text if the pane is hidden. Stop your server at the end.

FIXER: applies the confirmed findings of both verifiers, re-runs the gates, reports old -> new per file.
