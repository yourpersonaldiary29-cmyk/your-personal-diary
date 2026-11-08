TASK (owner request 2026-10-27, his words: "just add more years to the calendars"): the calendars in the app already exist; only their YEAR RANGE goes further back:
- Gregorian (לועזי): from 1980.
- Hebrew (עברי): from the year 5731 (תשל"א).
- Hijri / Islamic (the owner calls it "Arabic"): 40 years back from the current Hijri year.
Upper limits stay as they are today. Nothing else changes in the calendars.

READ FIRST: docs/android-tasks/ENV.md (LAST update is current). Find every place that bounds the years: the calendar page(s) and their year/month pickers and navigation (src/pages/CalendarPage.tsx, src/pages/entries/CalendarExtras.tsx, src/utils/calendar-extras.ts, src/utils/dates.ts, any mobile-specific calendar UI), the date inputs used for entries if they share the bound, and the API/server validation the calendar view depends on (server routes and shared validation of dates/ranges/months; the offline overlay for calendar months in src/offline/overlay/**). Viewing a month in 1980 / 5731 / current-Hijri-40 must work end to end (UI -> API -> answer, also offline from cache rules), not just in the picker. If creating an entry on such an old date is blocked by an existing server rule, keep the rule unless it is the same constant as the calendar bound; report what you found either way.

DO: change the bounds in one clear place per calendar (named constants, the Hijri lower bound computed from the current Hijri year, not hard-coded), keep the upper bounds, keep all 20 languages working (Hebrew and Hijri year labels already localized - check the Hebrew year label for 5731 renders as תשל"א), tests for each lower bound (allowed, one below not offered/refused) on desktop and the mobile build, and no change to existing expectations except the bounds themselves.

DO NOT: touch store/**, play/**, scripts/store/**, scripts/play/**, src-tauri/** (other agents); deploy (the main session deploys); read real data directories.

GATES (quote numbers): root `npx tsc --noEmit` + whole root vitest + `npx vite build`; `npm run mobile:typecheck` + `npm run mobile:test`; if server/** or shared/** changed: server `npx tsc --noEmit` + whole server vitest; `node scripts/check-no-network.mjs`.
