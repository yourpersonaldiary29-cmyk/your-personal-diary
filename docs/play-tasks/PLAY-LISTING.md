TASK: the store-listing part of the Google Play kit (WP-17) - texts and graphics, NOT screenshots (a later package renders those once the offline-mode UI is final).

READ FIRST: docs/android-tasks/ENV.md (last update is current), docs/ANDROID-PLAN.md (sections 3-4 and 7), store/listing/{en-US,he-IL}/** (the Windows Store texts: reuse what is true, drop what is not - the apps are now server-based with sync between devices and an automatic offline mode; no "stored only on your computer" claims), the app's features (README.md, ARCHITECTURE.md, src/pages/**), the brand assets (src-tauri/icons/**, android/app/src/main/res/mipmap-*/**, the logos under store/screenshots/**), and Google Play's CURRENT listing rules (WebFetch, cite): title <= 30 characters, short description <= 80, full description <= 4000, no keyword stuffing, no "best/#1", no emoji spam, the graphic specs (hi-res icon 512x512 32-bit PNG with alpha; feature graphic 1024x500 JPEG or 24-bit PNG without alpha), the Metadata policy.

DELIVER (new folder play/ at the repo root):

1. play/listing/<locale>/{title.txt, short.txt, full.txt} for all 20 app locales, using Play's exact locale codes (check them: e.g. en-US, he-IL, ar, zh-CN, ja-JP, hi-IN, th, es-ES, pt-BR, fr-FR, it-IT, de-DE, ro, el-GR, pl-PL, cs-CZ, hu-HU, ru-RU, bg, tr-TR). Real translations; the brand "Your Personal Diary" stays English; honest claims only (encrypted per account on the server, private, no ads, no tracking, works offline and syncs when the connection returns, 20 languages, habits, insights, reminders, backup and export). A script scripts/play/check-listing.mjs validates the limits (counting characters the way Play does), that every locale has all three files, no URL or emoji spam, and that no text claims "stored only on your device". A test runs it.

2. play/graphics/icon-512.png (from the existing app icon, 512x512, with alpha) and play/graphics/feature-1024x500.png (prefer a design without text so one file fits every locale; if it has text, one variant per locale), rendered by a script (scripts/play/render-graphics.mjs) with the tools already in the project (e.g. the approach of store/render.mjs, or sharp/resvg if already installed; no new downloads unless unavoidable - say so). Deterministic output; a test checks the dimensions and the alpha rules.

3. Seed content for the 6 locales that still lack it: server/src/db/seed-content/{el,pl,cs,hu,ru,bg}.ts plus the registry index.ts, following server/src/db/seed-content/README and the existing 14 locales exactly (same structure, natural fictional content in that language). The screenshot package will use it. Server tests green.

4. play/README.he.md - what is in the folder and what the owner uploads where in Play Console (Hebrew, short).

DO NOT: touch store/**, src/** (read only), server/src except server/src/db/seed-content/**, src-tauri/**, mobile/**, android/**, deploy/**; run fly or deploy; read real data directories.

GATES (quote the numbers): `node scripts/play/check-listing.mjs`, the new tests, the whole server vitest (seed content), `node scripts/check-no-network.mjs`.
