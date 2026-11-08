#!/usr/bin/env node
/**
 * scripts/play/render-screenshots.mjs - the Google Play phone screenshots of Your Personal Diary, one
 * LOCALIZED set per listing language (docs/play-tasks/PLAY-SCREENSHOTS.md + its amendment): each set
 * shows the app in that language with that language's demo content, so a user whose phone language
 * matches sees the diary in his language; en-US is the default set (Play shows it wherever a language
 * has no set of its own).
 *
 *   node scripts/play/render-screenshots.mjs                      all 20 listing languages
 *   node scripts/play/render-screenshots.mjs --locale en-US,iw-IL only these Play locale folders
 *   node scripts/play/render-screenshots.mjs --only 01,07         only these shot numbers
 *   node scripts/play/render-screenshots.mjs --theme dark         the dark-mode variant (with --out)
 *   node scripts/play/render-screenshots.mjs --out <dir>          write somewhere else (default play/screenshots)
 *   node scripts/play/render-screenshots.mjs --profile <name>     another viewport profile (PROFILES below:
 *                                                                 "phone" = this Play set, the default;
 *                                                                 "desktop" = the Microsoft Store set of the
 *                                                                 Windows app, store/screenshots/<Store tag>/ -
 *                                                                 see DESKTOP PROFILE below)
 *   node scripts/play/render-screenshots.mjs --keep               keep the temporary folder (UI build, data, log)
 *   node scripts/play/render-screenshots.mjs --keep-going         on a failed shot go on with the next one and list
 *                                                                 every failure at the end (exit code 1; no render log)
 *
 * Output: play/screenshots/<play-locale>/01-home.png ... 07-offline.png - 24-bit PNG (RGB, no alpha
 * channel), 1080x1920 (9:16). The folder names are the Play Console locale codes of play/listing/**
 * (PLAY_LOCALES of check-listing.mjs; Hebrew is "iw-IL" on Play). Check the result with
 * `node scripts/play/check-screenshots.mjs`.
 *
 * Why 1080x1920 and not the 1080x2400 of the task text: Play Console Help "Add preview assets"
 * (support.google.com/googleplay/android-developer/answer/9866151) says "JPEG or 24-bit PNG (no alpha)",
 * "Minimum dimension: 320 px", "Maximum dimension: 3840 px" and "The maximum dimension of your screenshot
 * can't be more than twice as long as the minimum dimension" - 2400 / 1080 = 2.22 would be refused. The
 * task's "(9:16)" is 1080x1920, which is also the size Play recommends for promotion-eligible phone
 * screenshots (portrait 9:16, at least 1080 px). docs/PLAY-RELEASE.he.md and scripts/play/preflight.mjs
 * already apply the same rule (maxRatio 2).
 *
 * HOW (everything on this computer, nothing deployed, no real data):
 *   1. A free loopback port is chosen (never 47321, the owner's own server).
 *   2. The Android UI is built exactly like `npm run mobile:build` (vite -c mobile/vite.config.mobile.ts,
 *      the server-only build) into a temporary folder, pointed at the loopback server through the
 *      documented developer override `VITE_API_BASE=http://127.0.0.1:<port>` (src/config/server-default.ts)
 *      - never the real server. The hosted server serves that build itself, so the page and its API share
 *      one origin and the page's own CSP (connect-src 'self') is enough.
 *   3. The REAL hosted composition (server/src/hosted.ts `startHosted`, DIARY_MODE=hosted) runs in this
 *      process from source, the way mobile/test/offline-e2e/hosted-rig.ts boots it: Vite's module runner
 *      over server/src, a temporary data directory, a fictional device key, a fast KDF, 127.0.0.1 only.
 *   4. A fictional operator account is registered first and made the server's owner (as DIARY_OWNER_ID
 *      on the real server), so the screenshot accounts are ordinary users: no owner cards, no "Account ID"
 *      row. Then per language: a FICTIONAL account is registered (FICTIONAL_PEOPLE: first name = slot 1 of
 *      that language's demo people, server/src/db/seed-content/<locale>.ts; a placeholder surname, an
 *      ASCII user name and an @example.com address; a random password that is never printed or stored)
 *      in that language, and "Load sample data" (POST /api/settings/seed-demo) fills it with that
 *      language's 120-day demo.
 *   5. Headless Microsoft Edge (playwright-core from the screenshot tool folder, the same tool as the
 *      Microsoft Store screenshots - scripts/store-shots) opens the app with the account's session token,
 *      a phone viewport of 432x768 CSS px at device scale 2.5 (= 1080x1920 pixels; a large phone such as
 *      a Pixel 8 Pro is 448 CSS px wide), the language as the phone language, and takes the shots of SHOTS
 *      below.
 *   6. Every shot is checked on the screen before it is written (layoutProbe, LAYOUT RULES below); the
 *      scroll position is moved a few pixels when that makes the screen clean, and the run FAILS when no
 *      clean position exists.
 *
 * LAYOUT RULES (Google: screenshots must not be misleading, text must be legible - and the owner: no cut
 * or covered text): in the visible part of the screen no line of text may be cut by the top app bar or
 * the bottom navigation, lie (even partly) under the floating "New entry" button, straddle the edge of a
 * toast, be cut off by its own box (an ellipsis "...", a clamped label, a box that scrolls sideways) or run
 * off the screen, and no word may be broken across two lines (an address like "x@example.c / om"; in
 * Chinese, Japanese and Thai, which break between characters, only Latin words and numbers are checked).
 * The same rules hold for small framed things (buttons, badges, chips, fields): none may be cut by a bar,
 * lie under the floating button or cross a toast's edge - except, as a last resort when no position is
 * clean otherwise, the frame of one running under the top app bar like any scrolled content (its label,
 * being text, is still never cut; render-log.json then says "boxUnderTopBar" for that file). A shot can
 * also name elements that must be entirely on the screen (`show`).
 *
 * DETERMINISTIC: one fixed clock for the server and the browser (FIXED_TIME, UTC; the server's clock is
 * re-anchored to it before every language and every shot, so every set sees the same "today" and the same
 * demo days), a fixed viewport and scale, animations and transitions off, reduced motion, the caret
 * hidden, fonts awaited, software rasterising on one thread with greyscale text anti-aliasing (GPU and
 * multi-threaded tile rasterising gave a few pixels of difference between runs), the same demo seed (42)
 * in every language. The same tree renders the same bytes (checked: three runs, identical SHA-256; again
 * after the layout rules and the offline shot were added: two independent runs, 140 of 140 identical).
 * Right to left for he / ar is checked (html dir="rtl") before every shot, and the page language
 * (html lang) must be the set's language. Nothing that changes from run to run may be in a shot
 * (NEVER_VISIBLE).
 *
 * NETWORK: the browser may reach http://127.0.0.1:<port> only. Every request of every page is logged
 * (the transport log) and routed: anything else is aborted and fails the run. Edge is also started with
 * every host name except 127.0.0.1 unresolvable (--host-resolver-rules) and a proxy on a closed loopback
 * port for anything that would still go out, so not even the browser's own background services leave
 * this computer. The script's own API calls (registration, sample data) go to the same origin and are in
 * the same log. At the end the log is checked once more (assertLoopbackOnly) and summarised.
 *
 * Prerequisites (once): Microsoft Edge installed (it is, on Windows 11) and playwright-core in the
 * screenshot tool folder: $MPD_STORE_TOOLS, else <project>/mpd-store-tools, else
 * C:\Users\AVI\Projects\mpd-store-tools (`npm init -y && npm install playwright-core` THERE; the project's
 * package.json is never touched). Nothing is downloaded by this script.
 *
 * DESKTOP PROFILE (`--profile desktop`, docs/store-tasks/STORE-2026-10.md package S2): the Microsoft Store
 * set of the Windows app, one per Store listing language (STORE_FOLDERS: the 20 BCP-47 tags of
 * store/listing, en-US the default). Everything above holds for it too (the same hosted server from source,
 * the same fixed clock, fictional people, transport log, layout rules and determinism); what differs is
 * the profile entry: the ROOT UI build (`vite build`, the UI the Tauri window of the Windows app shows -
 * not the Android build), a desktop window of 1536x864 CSS px at device scale 1.25 (= 1920x1080 pixels:
 * a maximized window on a 1920x1080 screen at Windows' 125 % scaling; Microsoft: desktop screenshots
 * "1366 x 768 pixels or larger", PNG), no touch, the desktop frame (sticky header, navigation row, no
 * bottom bar and no floating button: the bottom edge of the window takes the bottom bar's place in the
 * layout rules), its own shot list (DESKTOP_SHOTS: Home, My diary, an entry, Calendar, Habits, Insights,
 * Settings, the offline status bar) and the output store/screenshots/<tag>/. Desktop-only additions
 * (DESKTOP_CHROME / PROFILES.desktop): the navigation row's links count as framed things (a filled tab
 * half under the header is refused); a list card's excerpt that the server cut at 160 characters in the
 * middle of a word is refused, and the demo texts of today and yesterday longer than that are shortened
 * to whole sentences before the shots (`wholeExcerpts`, a data change); the layout rules also go by the
 * glyphs' INK, measured from the font (DESKTOP_CHROME.ink: the image's bottom edge keeps 3 CSS px of air
 * under the last line's ink, and no glyph of a line under the header may peek out below it - the line-box
 * leeway alone let descenders touch the image edge and an Arabic hamza show under the header); the entry
 * written offline in shot 08 has three more demo sentences than the phone's (desktopOfflineEntry), so its
 * page has a clean position; the account signs in as the
 * Windows app does (device name "Computer", localized). Check the set with
 * `node scripts/store-shots/check-screenshots.mjs`; store/screenshots/README.md is the owner's guide.
 * The phone profile is untouched by it: the same tree renders the same Play bytes as before the desktop
 * profile existed (checked 2026-10-27: en-US and iw-IL re-rendered, 14 of 14 files SHA-256-identical to
 * play/screenshots; the desktop set itself: 40 of 40 identical on a second render of five languages;
 * checked again after the ink rule and the longer offline entry: en-US, iw-IL and ar, 21 of 21 Play files
 * identical; the desktop set: 38 of 38 and 16 of 16 identical between independent renders).
 * With --keep, the screen of a failed shot is saved to <temporary folder>/failed/ for a look.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAY_LOCALES } from './check-listing.mjs';
import { decodePng, encodePng } from './render-graphics.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const DEFAULT_OUT_DIR = path.join(ROOT, 'play', 'screenshots');

/** The owner's own server port: never used here. */
export const FORBIDDEN_PORT = 47321;
/**
 * The one instant every set shows as "now": Friday 23 October 2026, 21:30 UTC (the browser runs in UTC
 * too). The demo repeats a weekly pattern, and on a Friday it is at its best for a listing: two entries
 * today (11:00 and 20:00 - both before 21:30, so both exist), habits logged today, and the first insight
 * is an encouraging upward trend.
 */
export const FIXED_TIME = '2026-10-23T21:30:00.000Z';
export const TIME_ZONE = 'UTC';
/** Cheap scrypt parameters for the fictional accounts (as the hosted rig; the formats do not depend on them). */
export const FAST_KDF = { N: 1024, r: 8, p: 1 };
/** A fictional, fixed device key (base64 of 32 bytes) - a test value, as in the hosted rig. */
const TEST_DEVICE_KEY = Buffer.alloc(32, 0x5a).toString('base64');
/** The default set (Play shows it for every language without a set of its own). */
export const DEFAULT_LOCALE = 'en-US';

/** Where the Microsoft Store set goes (desktop profile). */
export const STORE_OUT_DIR = path.join(ROOT, 'store', 'screenshots');

/**
 * The Microsoft Store listing languages (docs/store-tasks/LANG.md; folder = the BCP-47 tag of
 * store/listing/<tag>, value = the app locale). Every tag is in Microsoft's list of supported languages
 * (learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements,
 * "Supported languages": ar-sa, bg-bg, cs-cz, de-de, el-gr, en-us, es-es, fr-fr, he-il, hi-in, hu-hu,
 * it-it, ja-jp, pl-pl, pt-pt, ro-ro, ru-ru, th-th, tr-tr, zh-cn). en-US first: the default listing.
 */
export const STORE_FOLDERS = {
  'en-US': 'en',
  'he-IL': 'he',
  'zh-CN': 'zh',
  'es-ES': 'es',
  'pl-PL': 'pl',
  'ru-RU': 'ru',
  'fr-FR': 'fr',
  'ar-SA': 'ar',
  'ja-JP': 'ja',
  'tr-TR': 'tr',
  'cs-CZ': 'cs',
  'hu-HU': 'hu',
  'bg-BG': 'bg',
  'el-GR': 'el',
  'pt-PT': 'pt',
  'de-DE': 'de',
  'ro-RO': 'ro',
  'it-IT': 'it',
  'th-TH': 'th',
  'hi-IN': 'hi',
};

/**
 * The fixed parts of a frame, for the layout rules (layoutProbe), the scroll helper and the privacy guard:
 * `top` the sticky bar the page scrolls under, `bottom` / `nav` the fixed bar at the bottom (null: the
 * window's own bottom edge), `fab` the floating button (null: none). PHONE_CHROME is the Android shell
 * (MobileShell); DESKTOP_CHROME the desktop shell (AppShell: the sticky .header, the .nav row that
 * scrolls with the page, the footer at the end of the page).
 */
export const PHONE_CHROME = {
  top: '.mobile-shell__top',
  bottom: '.mobile-shell__bottom',
  nav: '.bottom-nav',
  fab: '.fab',
  topName: 'the top app bar',
  bottomName: 'the bottom navigation',
  /** How the offline shot opens the new-entry form and then "My diary" without a page load. */
  newEntryLink: 'a.fab',
  diaryLink: '.bottom-nav a[href$="#/diary"]',
};
export const DESKTOP_CHROME = {
  top: '.header',
  bottom: null,
  nav: null,
  fab: null,
  topName: 'the header',
  bottomName: 'the bottom edge of the window',
  /** More framed things for the layout rules: the navigation row's links (the current one is a filled tab - half of it under the header looks cut). */
  boxes: '.nav__link',
  /**
   * A list card's excerpt is the server's first 160 characters of the text, cut wherever they end
   * (server/src/db/entries-repo.ts makeExcerpt): one that is that long and ends in a letter is a cut word.
   */
  excerpt: { selector: '.entry-card__excerpt', length: 160 },
  /**
   * The layout rules by the glyphs' ink, not only by the line boxes (layoutProbe `frame.ink`): the window's
   * bottom edge is the edge of the image here, so a line on the screen keeps `air` CSS px (3.75 image px)
   * under its lowest ink - the line-box leeway let descenders of a last line sit on, and lose a pixel to,
   * the image edge (fr / ru / bg Insights) - and a line under the header counts as hidden only when none
   * of its ink shows below it (Arabic hamza-below of the scrolled navigation row showed in ar 08).
   */
  ink: { air: 3 },
  newEntryLink: '.nav a[href$="#/new"]',
  diaryLink: '.nav a[href$="#/diary"]',
};

/**
 * Viewport profiles. `phone` is the Google Play set; `desktop` the Microsoft Store set of the Windows app
 * (DESKTOP PROFILE in the header). A profile without `shots` / `chrome` / `deviceName` takes the phone's
 * (SHOTS, PHONE_CHROME, 'Android').
 */
export const PROFILES = {
  phone: {
    label: 'Google Play phone screenshots, 1080x1920 (9:16)',
    // 432 x 2.5 = 1080 and 768 x 2.5 = 1920 exactly. The narrower 360x640 @3 of the first render cut the
    // offline bar, the e-mail address and the Greek navigation labels; a large phone's width shows the
    // same screens without that, and the text is still large (16 CSS px = 40 image px).
    viewport: { width: 432, height: 768 },
    deviceScaleFactor: 2.5,
    isMobile: true,
    hasTouch: true,
    /** Which UI build: 'mobile' = `npm run mobile:build` (the Android app), 'web' = the root `vite build`. */
    build: 'mobile',
    outDir: DEFAULT_OUT_DIR,
    /** Output folder name -> app locale: the Play Console codes of play/listing/**. */
    folders: Object.fromEntries(Object.entries(PLAY_LOCALES).map(([play, def]) => [play, def.app])),
  },
  desktop: {
    label: 'Microsoft Store desktop screenshots, 1920x1080 (16:9)',
    // 1536 x 1.25 = 1920 and 864 x 1.25 = 1080 exactly: the Windows app's window maximized on a 1920x1080
    // screen at Windows' 125 % display scaling (its content area, without the title bar and the taskbar).
    // At device scale 1 the same pixels would show the 74rem content column with wide empty margins and
    // 16 px text that the Store shrinks to about half its size in a listing.
    viewport: { width: 1536, height: 864 },
    deviceScaleFactor: 1.25,
    isMobile: false,
    hasTouch: false,
    /** The root `vite build`: the UI of the Windows app (the Tauri window loads this build). */
    build: 'web',
    outDir: STORE_OUT_DIR,
    /** Output folder name -> app locale: the Microsoft Store listing tags. */
    folders: STORE_FOLDERS,
    chrome: DESKTOP_CHROME,
    /** Demo texts of today and yesterday longer than the list's excerpt end at a whole sentence (prepareAccount). */
    wholeExcerpts: 160,
    /** The device name the Windows app sends at sign-in (src/utils/platform.ts deviceName: "Computer", localized). */
    deviceName: (t) => t('shell.device.computer'),
    /** The entry written offline in shot 08: a longer free text than the phone's (desktopOfflineEntry). */
    offlineEntry: desktopOfflineEntry,
    get shots() {
      return DESKTOP_SHOTS;
    },
  },
};

/** The browser language of a set (the phone language a user would have): Play's "iw-IL" is "he-IL" on a phone. */
export function browserLocaleOf(folder) {
  return folder === 'iw-IL' ? 'he-IL' : folder;
}

/** Right-to-left app languages. */
export const RTL = new Set(['he', 'ar']);

// ---------------------------------------------------------------------------------------------
// The fictional people (step 4)
// ---------------------------------------------------------------------------------------------

/**
 * The fictional account of each language. The FIRST name is not listed here: it is slot 1 of that
 * language's demo people (server/src/db/seed-content/<locale>.ts, `people[0]`), read at run time, so the
 * account and its demo diary belong together and the name is the one the seed content already uses
 * (en "Dana", he "דנה", ar "سارة", ...). The SURNAME is the language's own "John Doe" placeholder family
 * name where it has one (Doe, ישראלי, الفلاني, Mustermann, Dupont, Rossi, Kowalska, Nováková, Иванова,
 * de Tal, Popescu, ใจดี ...), so the name reads as made up to a native speaker; the user name is a plain
 * ASCII spelling of both (the app accepts A-Z a-z 0-9 _ . -) and the address is under example.com, the
 * domain reserved for examples (RFC 2606). Nothing here belongs to a real person.
 * Where "first.surname@example.com" does not fit on one line of that language's Settings account card
 * (its labels are wider: "Nom d'utilisateur", "Имя пользователя"...), the user name is the first name and
 * the surname's initial (fr, de, el, pl, cs, ru, bg) - the layout rules would refuse the broken address.
 */
export const FICTIONAL_PEOPLE = {
  en: { surname: 'Doe', username: 'dana.doe' },
  he: { surname: 'ישראלי', username: 'dana.israeli' },
  ar: { surname: 'الفلاني', username: 'sara.alfulani' },
  zh: { surname: '张', username: 'zhang.xiaowen' },
  ja: { surname: '山田', username: 'yamada.misaki' },
  hi: { surname: 'कुमार', username: 'priya.kumar' },
  th: { surname: 'ใจดี', username: 'malee.jaidee' },
  es: { surname: 'de Tal', username: 'lucia.detal' },
  pt: { surname: 'de Tal', username: 'marta.detal' },
  fr: { surname: 'Dupont', username: 'camille.d' },
  it: { surname: 'Rossi', username: 'giulia.rossi' },
  de: { surname: 'Mustermann', username: 'anna.m' },
  ro: { surname: 'Popescu', username: 'ana.popescu' },
  el: { surname: 'Παπαδοπούλου', username: 'maria.p' },
  pl: { surname: 'Kowalska', username: 'anna.k' },
  cs: { surname: 'Nováková', username: 'anna.n' },
  hu: { surname: 'Minta', username: 'anna.minta' },
  ru: { surname: 'Иванова', username: 'anna.i' },
  bg: { surname: 'Иванова', username: 'maria.i' },
  tr: { surname: 'Yılmaz', username: 'elif.yilmaz' },
};

/** Languages that write the family name first (only the console line uses `displayName`). */
const FAMILY_NAME_FIRST = new Set(['zh', 'ja', 'hu']);

/** The fictional account of one set (no password: that is made at run time and never leaves the process). */
export function fictionalAccount(appLocale, firstName) {
  const person = FICTIONAL_PEOPLE[appLocale];
  if (!person) throw new Error(`no fictional account for ${appLocale}`);
  return {
    firstName,
    lastName: person.surname,
    displayName: FAMILY_NAME_FIRST.has(appLocale) ? `${person.surname}${appLocale === 'hu' ? ' ' : ''}${firstName}` : `${firstName} ${person.surname}`,
    username: person.username,
    email: `${person.username}@example.com`,
  };
}

// ---------------------------------------------------------------------------------------------
// Transport log: what may be contacted
// ---------------------------------------------------------------------------------------------

/**
 * True when `url` may be fetched by the render: the loopback server itself (http://127.0.0.1:<port>), or a
 * URL that never leaves the page (data:, blob:, about:). Everything else - another port, another host,
 * localhost by name, https - is refused.
 */
export function isAllowedUrl(url, base) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'about:') return true;
  const b = new URL(base);
  return u.protocol === 'http:' && u.hostname === '127.0.0.1' && b.hostname === '127.0.0.1' && u.port === b.port;
}

/** The transport log's verdict: throws with every refused URL when anything else than `base` was contacted. */
export function assertLoopbackOnly(log, base) {
  const outside = [...new Set(log.filter((entry) => !isAllowedUrl(entry.url, base)).map((entry) => `${entry.from}: ${entry.url}`))];
  if (outside.length) throw new Error(`the render contacted something other than ${base}:\n  ${outside.join('\n  ')}`);
  const hosts = new Set(log.map((entry) => { try { return new URL(entry.url).host; } catch { return '?'; } }));
  return { requests: log.length, hosts: [...hosts].filter((h) => h !== '') };
}

// ---------------------------------------------------------------------------------------------
// The shots
// ---------------------------------------------------------------------------------------------

/**
 * The fixed set, in Play order. `route` is the hash route (a function gets the per-set context);
 * `scrollTo` scrolls the page until that element (its last one with `scrollToLast`) sits just under the
 * top app bar, or to the end of the page ('end') - the bar stays, as on the phone; the page is scrolled,
 * nothing is hidden or edited; from there the LAYOUT RULES may move the page up to `up` / `down` CSS px
 * (in 1 px steps, the smallest move first) to a clean position; `show` names elements that must be
 * entirely on the screen, `prefer` ones that should be when a clean position allows it (layoutProbe has
 * the forms); `offline: 'write'` makes the shot of the offline mode (writeOffline - the last shot).
 * Every shot is the real page as the app renders it.
 *
 *   01 Home: the greeting, today's summary (two entries on the fixed Friday, the writing streak) and the
 *      7-day averages. The app's Home has no list of today's entries (only their number), and its
 *      "Today's habits" card starts more than a screen further down - the habits are shot 04.
 *   02 My diary: the week's list at its end - today's heading ("Friday, 23 October 2026 · Today") and
 *      today's two entries. Higher up the list the wide floating button always covers a line or an
 *      "Open" button in some language; the list's bottom space is there for it. (`prefer`: today's
 *      heading on the screen when a clean position has it, else the nearest clean position.)
 *   03 One entry: the richest good-mood entry of the last two weeks (prepareAccount picks it).
 *   04 Habits: the habit cards with streaks and progress bars (from the 2nd card, "Drinking water",
 *      the one with a running streak - the 1st, "Walking", has none on the fixed day).
 *   05 Insights: the analysis cards, from the first group (an encouraging upward trend on the fixed day).
 *   06 Settings: the language picker (20 languages) and the account card with all its fields.
 *   07 Writing without a connection: an entry written with the network cut (DevTools offline emulation,
 *      the app's own detection; writeOffline), then "My diary": the end of the list with the new entry
 *      and its "Not uploaded yet" badge, and the app's own message "Saved on this device. It will be
 *      uploaded to the server when the connection returns." The one-line offline bar of the phone layout
 *      cannot show its whole sentence (it ends in "..."), so it stays at the top of the list, off the
 *      screen; the message says the same in full.
 */
export const SHOTS = [
  { n: '01', slug: 'home', route: '/', down: 240 },
  {
    n: '02',
    slug: 'diary',
    route: '/diary',
    scrollTo: '.timeline__heading',
    scrollToLast: true,
    up: 480,
    down: 480,
    prefer: [{ selector: '.timeline__heading', last: true }],
  },
  { n: '03', slug: 'entry', route: (ctx) => `/entry/${ctx.entryId}`, down: 240 },
  { n: '04', slug: 'habits', route: '/habits', scrollTo: 'main ul.stack > li:nth-child(2)', up: 48, down: 240 },
  { n: '05', slug: 'insights', route: '/insights', scrollTo: 'main section[aria-labelledby^="insights-group-"]', up: 48, down: 240 },
  { n: '06', slug: 'settings', route: '/settings', down: 640, show: ['main select', 'main dl'] },
  {
    n: '07',
    slug: 'offline',
    route: '/',
    offline: 'write',
    scrollTo: 'end',
    up: 480,
    show: ['main .entry-card .pending-badge', '.toast-region > *'],
  },
];

/**
 * The calendar system of the desktop Calendar shot per app language (the app's own `?system=` view of
 * the Calendar page, src/pages/CalendarPage.tsx): the Hebrew calendar for Hebrew and the Hijri calendar
 * for Arabic, as the round-one Store screenshots; the Gregorian month everywhere else.
 */
export const CALENDAR_SYSTEM = { he: 'hebrew', ar: 'hijri' };

/**
 * The desktop set (`--profile desktop`), in Store order - 8 shots, the top of Microsoft's recommended
 * 5-8 per listing language (Partner Center allows up to 10 desktop screenshots). The fields are those
 * of SHOTS; `afterWrite: 'entry'` keeps the offline shot on the entry page the user just saved.
 *
 *   01 Home: the greeting, today's summary (two entries on the fixed Friday), the writing streak, the
 *      7-day averages - the page as it opens.
 *   02 My diary: the week's list at its end - today's heading and today's two entries.
 *   03 One entry: the richest good-mood entry of the last two weeks (pickEntry), as on the phone.
 *   04 Calendar: the month of the fixed day with every day's mood / energy / habits and the holidays,
 *      in the language's calendar system (CALENDAR_SYSTEM).
 *   05 Habits: the habit cards with streaks and progress bars.
 *   06 Insights: the analysis cards from the first group.
 *   07 Settings: the language picker (20 languages) and the account card.
 *   08 Writing without a connection: an entry written with the network cut (writeOffline, the app's own
 *      detection; its text is desktopOfflineEntry's) - the entry page as the app shows it after "Save": the offline status bar in full
 *      ("No connection - what you write will be saved to the server when the connection returns." with
 *      "1 change waiting") and the entry with its "Not uploaded yet" badge. The app's passing message
 *      ("Saved on this device...", bottom corner, closes by itself after a few seconds) is not kept
 *      (`keepToast: false`): on the desktop it lies over the entry's last line and the footer, and the
 *      bar already says the same in full.
 */
export const DESKTOP_SHOTS = [
  { n: '01', slug: 'home', route: '/', down: 240 },
  {
    n: '02',
    slug: 'diary',
    route: '/diary',
    scrollTo: '.timeline__heading',
    scrollToLast: true,
    up: 480,
    down: 480,
    prefer: [{ selector: '.timeline__heading', last: true }],
  },
  { n: '03', slug: 'entry', route: (ctx) => `/entry/${ctx.entryId}`, down: 240 },
  { n: '04', slug: 'calendar', route: (ctx) => (CALENDAR_SYSTEM[ctx.appLocale] ? `/calendar?system=${CALENDAR_SYSTEM[ctx.appLocale]}` : '/calendar'), down: 320 },
  { n: '05', slug: 'habits', route: '/habits', down: 240 },
  { n: '06', slug: 'insights', route: '/insights', scrollTo: 'main section[aria-labelledby^="insights-group-"]', up: 160, down: 240 },
  { n: '07', slug: 'settings', route: '/settings', down: 640, show: ['main select', 'main dl'] },
  {
    n: '08',
    slug: 'offline',
    route: '/',
    offline: 'write',
    afterWrite: 'entry',
    keepToast: false,
    down: 240,
    show: ['main .sync-bar--offline', 'main .pending-badge'],
  },
];

/** Languages whose lines may break between any two characters (no spaces between words). */
export const NO_WORD_SPACES = new Set(['zh', 'ja', 'th']);

/**
 * The scroll positions the LAYOUT RULES try, nearest first: y0, y0+step, y0-step, y0+2*step, ... within
 * [y0-up, y0+down] and [0, maxY].
 */
export function scrollCandidates(y0, { up = 0, down = 0, step = 2, maxY = Infinity } = {}) {
  const lo = Math.max(0, y0 - up);
  const hi = Math.min(maxY, y0 + down);
  const out = [];
  if (y0 >= lo && y0 <= hi) out.push(y0);
  for (let d = step; d <= Math.max(y0 - lo, hi - y0); d += step) {
    if (y0 + d <= hi) out.push(y0 + d);
    if (y0 - d >= lo) out.push(y0 - d);
  }
  return out;
}

/**
 * True when a line break between `before` and `after` cuts a word: both are letters / digits (with
 * their marks) - or, in a language without spaces between words (`spaced` false), both are Latin
 * letters / digits. A break after a space, a hyphen, a dash or a slash is an ordinary one.
 */
export function isMidWordBreak(before, after, spaced = true) {
  if (!before || !after || /\s/u.test(before) || /\s/u.test(after)) return false;
  if (/[-\u2010-\u2015/\u00ad]/u.test(before)) return false;
  return spaced ? /[\p{L}\p{N}\p{M}]/u.test(before) && /[\p{L}\p{N}\p{M}]/u.test(after) : /[A-Za-z0-9]/.test(before) && /[A-Za-z0-9]/.test(after);
}

/**
 * The entry of shot 07, in the set's language, from that language's demo texts (seed content): a
 * good-day title, three sentences of the demo's own diary and good ratings (mood 8, energy 7, stress 3).
 * Fictional, like the rest of the demo.
 */
export function offlineEntry(content) {
  const title = content.titles?.high?.[4];
  const opener = content.openers?.high?.[0];
  const sleep = typeof content.sleep === 'function' ? content.sleep(8, false) : '';
  const evening = typeof content.secondEntry === 'function' ? content.secondEntry('evening') : '';
  if (!title || !opener) throw new Error('the seed content has no titles.high[4] / openers.high[0]');
  return { title, body: [opener, sleep, evening].filter(Boolean).join(' '), ratings: { mood: 8, energy: 7, stress: 3 } };
}

/**
 * The entry of the desktop's offline shot (DESKTOP_SHOTS 08, `PROFILES.desktop.offlineEntry`): the phone's
 * (offlineEntry - the same title and ratings, the same demo sentences) with three more sentences of the
 * set's own demo texts (an afternoon walk, a meeting with a demo person, the demo's evening note), joined
 * the language's way (sentenceSeparator: none after "。" in zh / ja). Why: with the phone's three
 * sentences the entry page was only 32 px taller than the window, and the one position that shows its
 * footer whole left the navigation row's labels ending at the header's edge - the hamza below of the
 * Arabic labels showed under it. The free text now takes at least one more line, so a position exists
 * with the navigation row either whole or entirely under the header. Fictional, like the rest of the demo.
 */
export function desktopOfflineEntry(content) {
  const phone = offlineEntry(content);
  const opener = content.openers.high[0];
  const sleep = typeof content.sleep === 'function' ? content.sleep('8', false, 8) : '';
  const walk = typeof content.exercise === 'function' && content.exerciseTypes?.[0] ? content.exercise(content.exerciseTypes[0], '30', 'evening', 30) : '';
  const met = typeof content.peopleSentence === 'function' && content.people?.[1] ? content.peopleSentence([content.people[1]], true) : '';
  const evening = typeof content.secondEntry === 'function' ? content.secondEntry('evening') : '';
  if (!walk || !met || !content.note) throw new Error('the seed content has no exercise() / peopleSentence() / people[1] / note');
  return { ...phone, body: [opener, sleep, walk, met, evening, content.note].filter(Boolean).join(content.sentenceSeparator ?? ' ') };
}

/**
 * What must never be in a Play screenshot: the account's internal id (random per run - it would make
 * the sets differ from run to run - and of no interest to a shopper) and the diary-server line of the
 * Privacy card (here it would name the loopback test server, 127.0.0.1:<port>). A shot fails when one of
 * them is inside the visible part of the page.
 */
export const NEVER_VISIBLE = ['[data-testid="account-id"]', '[data-testid="server-address"]'];

// ---------------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------------

export function parseArgs(argv) {
  const out = { locales: null, only: null, theme: 'light', out: null, profile: 'phone', keep: false, keepGoing: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--locale' || a === '--locales') out.locales = value().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--only') out.only = new Set(value().split(',').map((s) => s.trim().padStart(2, '0')));
    else if (a === '--theme') out.theme = value();
    else if (a === '--out') out.out = path.resolve(value());
    else if (a === '--profile') out.profile = value();
    else if (a === '--keep') out.keep = true;
    else if (a === '--keep-going') out.keepGoing = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!PROFILES[out.profile]) throw new Error(`unknown profile "${out.profile}" (known: ${Object.keys(PROFILES).join(', ')})`);
  if (out.theme !== 'light' && out.theme !== 'dark') throw new Error('--theme must be light or dark');
  const folders = PROFILES[out.profile].folders;
  if (out.locales) {
    const unknown = out.locales.filter((l) => !(l in folders));
    if (unknown.length) throw new Error(`unknown locale folder(s): ${unknown.join(', ')} (known: ${Object.keys(folders).join(' ')})`);
  }
  if (out.theme === 'dark' && !out.out) throw new Error('--theme dark needs --out <dir> (play/screenshots holds the light set Play gets)');
  return out;
}

// ---------------------------------------------------------------------------------------------
// The clock (server side): this process runs the server, so its Date is the server's clock
// ---------------------------------------------------------------------------------------------

/**
 * Replaces the global Date of THIS process with one whose "now" is `anchor()`ed to a fixed instant and
 * then runs at the normal pace (sessions, timeouts and limiters keep working). The browser gets the same
 * instant through Playwright's clock. Returns { anchor(ms), restore() }.
 */
export function installServerClock() {
  const RealDate = globalThis.Date;
  let offset = 0;
  class AnchoredDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + offset);
      else super(...args);
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = AnchoredDate;
  return {
    anchor(ms) {
      offset = ms - RealDate.now();
    },
    restore() {
      globalThis.Date = RealDate;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------------------------

/** The folder with playwright-core (the Store screenshot tool folder). */
export function toolDir() {
  const candidates = [process.env.MPD_STORE_TOOLS, path.join(ROOT, 'mpd-store-tools'), 'C:\\Users\\AVI\\Projects\\mpd-store-tools'].filter(Boolean);
  for (const dir of candidates) if (fs.existsSync(path.join(dir, 'node_modules', 'playwright-core', 'package.json'))) return dir;
  throw new Error(
    `playwright-core was not found in ${candidates.join(' or ')}. In ONE of those folders run: npm init -y && npm install playwright-core (never in the project itself).`,
  );
}

export function loadPlaywright() {
  const dir = toolDir();
  const req = createRequire(path.join(dir, 'package.json'));
  const version = JSON.parse(fs.readFileSync(path.join(dir, 'node_modules', 'playwright-core', 'package.json'), 'utf8')).version;
  return { chromium: req('playwright-core').chromium, version, dir };
}

/** A free loopback port (never FORBIDDEN_PORT). */
export function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => (port === FORBIDDEN_PORT ? freePort().then(resolve, reject) : resolve(port)));
    });
  });
}

/** Builds the UI of `kind` into `outDir`, pointed at `apiBase` through VITE_API_BASE. */
export function buildUi(kind, outDir, apiBase) {
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(vite)) throw new Error(`vite not found at ${vite} - run npm install in the project first`);
  const args = [vite, 'build', ...(kind === 'mobile' ? ['-c', 'mobile/vite.config.mobile.ts'] : []), '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'];
  // The server build (the published Android app), not the local-core one.
  const env = { ...process.env, VITE_API_BASE: apiBase, VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true' };
  delete env.MOBILE_LOCAL_CORE;
  delete env.VITE_LOCAL_SERVER;
  const r = spawnSync(process.execPath, args, { cwd: ROOT, env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`UI build failed (${r.status}):\n${r.stdout}\n${r.stderr}`);
  const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const bundle = fs.readdirSync(path.join(outDir, 'assets')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(outDir, 'assets', f), 'utf8')).join('\n');
  if (!bundle.includes(apiBase)) throw new Error(`the UI build does not carry the developer API base ${apiBase}`);
  // The Android build carries its CSP in index.html; the root build gets its CSP from the Tauri window
  // (src-tauri/tauri.conf.json app.security.csp) or, served by the hosted server, from its headers.
  if (kind === 'mobile' && !html.includes('Content-Security-Policy')) throw new Error('the UI build has no CSP');
}

/** The real hosted composition from server/src, in this process (as mobile/test/offline-e2e/hosted-rig.ts). */
export async function startHostedServer({ port, dataDir, staticDir, limiterNow, ownerId = () => '' }) {
  const { createServer, createServerModuleRunner } = await import('vite');
  const vite = await createServer({
    configFile: false,
    root: path.join(ROOT, 'server'),
    logLevel: 'error',
    appType: 'custom',
    resolve: { alias: { '@shared': path.join(ROOT, 'shared') } },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const runner = createServerModuleRunner(vite.environments.ssr, { hmr: false });
  const load = (module) => runner.import(`/src/${module}.ts`);
  const hosted = await load('hosted');
  const config = await load('config');
  const seed = await load('db/seed-content/index');
  const base = `http://127.0.0.1:${port}`;
  const env = config.loadHostedEnv({
    DIARY_MODE: 'hosted',
    // http is accepted for a loopback public address only (tests); the real server is https.
    DIARY_PUBLIC_URL: base,
    DIARY_BIND: '127.0.0.1',
    PORT: String(port),
    DIARY_DEVICE_KEY: TEST_DEVICE_KEY,
    DIARY_LOGIN_PER_MINUTE: '1000',
    DIARY_AUTH_GLOBAL_PER_MINUTE: '5000',
  });
  const serverConfig = config.loadConfig(['--data-dir', dataDir, '--static', staticDir], { DIARY_MODE: 'hosted' });
  const running = await hosted.startHosted(serverConfig, env, { port, bind: '127.0.0.1', quiet: true, auth: { kdf: FAST_KDF }, now: limiterNow, ownerId });
  return {
    base,
    seedContent: seed.SEED_CONTENT,
    /** The app's own message catalogue (shared/i18n `makeT`) for `locale` - loaded only when asked for. */
    async translator(locale) {
      const i18n = await runner.import('@shared/i18n/index');
      return i18n.makeT(locale);
    },
    async stop() {
      await running.stop();
      await runner.close();
      await vite.close();
    },
  };
}

/** One API call of the script itself, logged in the transport log. */
export async function api(base, log, pathname, { method = 'GET', body, token, locale } = {}) {
  const url = `${base}${pathname}`;
  log.push({ from: 'script', url });
  if (!isAllowedUrl(url, base)) throw new Error(`refusing to contact ${url}`);
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (locale) headers['Accept-Language'] = locale;
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${pathname} -> ${res.status} ${text.slice(0, 300)}`);
  return data;
}

/** A strong random password for a fictional account: kept in memory only, never printed or written. */
function randomPassword() {
  return `${crypto.randomBytes(18).toString('base64url')}aA1!`;
}

// ---------------------------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------------------------

/** No animation, no transition, no caret, no smooth scrolling - inserted before the app's own CSS runs. */
const STILL_CSS =
  '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;' +
  'transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}';

async function settle(page) {
  await page.waitForFunction(() => !document.getElementById('mobile-splash'), null, { timeout: 30000 });
  await page.waitForSelector('main h1', { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('.spinner, [aria-busy="true"]'), null, { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

async function removeToasts(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.toast-region > *').forEach((el) => el.remove());
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
}

/**
 * Scrolls the page so that the first element of `selector` starts `gap` CSS px below the sticky top
 * app bar (.mobile-shell__top) - an ordinary scroll position of the app. Throws when it is missing.
 */
async function scrollUnderTopBar(page, selector, gap = 12, last = false, top = PHONE_CHROME.top) {
  const moved = await page.evaluate(
    ({ selector, gap, last, top }) => {
      const all = document.querySelectorAll(selector);
      const el = last ? all[all.length - 1] : all[0];
      if (!el) return null;
      const bar = document.querySelector(top);
      const barBottom = bar ? bar.getBoundingClientRect().bottom : 0;
      const by = Math.round(el.getBoundingClientRect().top - barBottom - gap);
      window.scrollBy(0, by);
      return by;
    },
    { selector, gap, last, top },
  );
  if (moved === null) throw new Error(`scroll target "${selector}" is not on the page`);
  await page.waitForTimeout(200);
}

/** Throws when an element of NEVER_VISIBLE is inside the visible part of the page (between the top app bar and the bottom navigation). */
async function assertNothingPrivate(page, chrome = PHONE_CHROME) {
  const seen = await page.evaluate(
    ({ selectors, topSel, bottomSel }) => {
      const top = document.querySelector(topSel)?.getBoundingClientRect().bottom ?? 0;
      const bottom = (bottomSel && document.querySelector(bottomSel)?.getBoundingClientRect().top) ?? window.innerHeight;
      const out = [];
      for (const selector of selectors) {
        for (const el of document.querySelectorAll(selector)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.bottom > top && r.top < bottom) out.push(selector);
        }
      }
      return out;
    },
    { selectors: NEVER_VISIBLE, topSel: chrome.top, bottomSel: chrome.bottom },
  );
  if (seen.length) throw new Error(`would show ${seen.join(', ')} - must never be in a store screenshot`);
}

/**
 * The LAYOUT RULES, measured IN THE PAGE (passed to page.evaluate, so it is self-contained). Measures
 * every line of text once (range rects), then judges scroll positions without scrolling: the app bar is
 * sticky and the navigation, the floating button and the toasts are fixed, so only the page moves.
 *
 *   args.find      false: judge the current position; true: try scrollCandidates-like positions around
 *                  it (args.up / args.down / args.step) and scroll to the first clean one
 *   args.show      selectors whose first element must be entirely on the screen
 *   args.spaced    false for zh / ja / th (see isMidWordBreak)
 *
 * Returns { y, moved, problems, navHeight } - `problems` empty when the screen is clean at `y`.
 */
export function layoutProbe(args) {
  // Tolerances in CSS px: EPS for a line of text (the top and bottom of a line box are empty leading),
  // HIDE for "entirely under a bar" and for a framed box (a sliver of a 1 px border shows).
  const EPS = 1.5;
  const HIDE = 0.5;
  const H = window.innerHeight;
  const W = window.innerWidth;
  // The frame (args.chrome: PHONE_CHROME / DESKTOP_CHROME; a null part is not there - the window's edge).
  const frame = { top: '.mobile-shell__top', bottom: '.mobile-shell__bottom', nav: '.bottom-nav', fab: '.fab', ...(args.chrome ?? {}) };
  const pick = (selector) => (selector ? document.querySelector(selector) : null);
  const topBar = pick(frame.top);
  const nav = pick(frame.nav);
  const chrome = [topBar, pick(frame.bottom), document.querySelector('.toast-region')].filter(Boolean);
  const inChrome = (node) => chrome.some((c) => c.contains(node));
  const quote = (s) => JSON.stringify(String(s).replace(/\s+/g, ' ').trim().slice(0, 60));
  const midWord = (before, after, spaced) => {
    if (!before || !after || /\s/u.test(before) || /\s/u.test(after)) return false;
    if (/[-\u2010-\u2015/\u00ad]/u.test(before)) return false;
    return spaced ? /[\p{L}\p{N}\p{M}]/u.test(before) && /[\p{L}\p{N}\p{M}]/u.test(after) : /[A-Za-z0-9]/.test(before) && /[A-Za-z0-9]/.test(after);
  };
  // Glyph ink (frame.ink - the desktop profile only; the phone profile has none and its rules are exactly as
  // before): where a line's glyphs really reach, from the font's own metrics (canvas measureText of the
  // node's text in its computed font: the actual ink above / below the baseline), placed in the line box
  // the way the browser places the font's ascent and descent. EPS / HIDE above are leeway for the EMPTY
  // parts of a line box - a descender or an Arabic hamza below can still reach into them.
  const INK_AA = 0.5; // the metrics come in whole px, and anti-aliasing reaches a little past the outline
  const inkCtx = frame.ink ? document.createElement('canvas').getContext('2d') : null;
  const inkCache = new Map();
  const inkOf = (text, cs) => {
    const tt = cs.textTransform;
    const t = tt === 'uppercase' ? text.toUpperCase() : tt === 'lowercase' ? text.toLowerCase() : tt && tt !== 'none' ? `${text}${text.toUpperCase()}` : text;
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const key = `${font}\n${t}`;
    if (!inkCache.has(key)) {
      inkCtx.font = font;
      const m = inkCtx.measureText(t);
      inkCache.set(key, { fA: m.fontBoundingBoxAscent, fD: m.fontBoundingBoxDescent, aA: m.actualBoundingBoxAscent, aD: m.actualBoundingBoxDescent });
    }
    return inkCache.get(key);
  };
  const glyphsIn = (r, k, off) => {
    const baseline = r.top + (r.height - (k.fA + k.fD)) / 2 + k.fA;
    return { inkTop: baseline - k.aA - INK_AA + off, inkBottom: baseline + k.aD + INK_AA + off };
  };

  // The fixed parts, in screen coordinates (the same at every scroll position).
  const topEdge = topBar ? topBar.getBoundingClientRect().bottom : 0;
  const navEdge = nav ? nav.getBoundingClientRect().top : H;
  const floats = [];
  const fab = pick(frame.fab);
  if (fab) floats.push({ what: 'the floating "New entry" button', r: fab.getBoundingClientRect(), wide: false });
  document.querySelectorAll('.toast-region > *').forEach((t) => floats.push({ what: 'a toast', r: t.getBoundingClientRect(), wide: true }));
  // A floating button entirely behind a toast is not on the screen while the toast is.
  const within = (a, b) => a.left >= b.left - EPS && a.right <= b.right + EPS && a.top >= b.top - EPS && a.bottom <= b.bottom + EPS;
  const floating = floats.filter((f) => f.r.width > 0 && f.r.height > 0 && (f.wide || !floats.some((t) => t.wide && within(f.r, t.r))));

  // Every line of text: page lines in page coordinates, the bars' own lines in screen coordinates.
  const y0 = window.scrollY;
  const lines = [];
  const faults = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.data;
    if (!text.trim()) continue;
    const el = node.parentElement;
    if (!el || el.closest('select, option, script, style, noscript, template, datalist')) continue;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    // Text for screen readers only (.visually-hidden: a clipped 1 px box) is not on the screen at all.
    let hidden = false;
    for (let a = el; a && a !== document.body && !hidden; a = a.parentElement) {
      const s = getComputedStyle(a);
      if ((s.clipPath && s.clipPath !== 'none') || (s.clip && s.clip !== 'auto')) hidden = true;
      else if (s.overflowX !== 'visible' && (a.clientWidth <= 2 || a.clientHeight <= 2)) hidden = true;
    }
    if (hidden) continue;
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter((r) => r.width >= 2 && r.height >= 2);
    if (!rects.length) continue;
    const fixed = inChrome(node);
    const off = fixed ? 0 : y0;
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight);
    const ink = inkCtx ? inkOf(text, cs) : null;
    for (const r of rects) {
      const line = { top: r.top + off, bottom: r.bottom + off, left: r.left, right: r.right, text, fixed, ...(ink ? glyphsIn(r, ink, off) : {}) };
      lines.push(line);
      // Cut off by a box of its own: an ellipsis, a clamped label, a box that scrolls sideways.
      const tolY = (Number.isFinite(lh) ? Math.max(0, (r.height - lh) / 2) : r.height * 0.2) + EPS;
      for (let a = el; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
        const s = a === el ? cs : getComputedStyle(a);
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        const b = a.getBoundingClientRect();
        const left = b.left + a.clientLeft;
        const top = b.top + a.clientTop;
        if (r.left < left - EPS || r.right > left + a.clientWidth + EPS || r.top < top - tolY || r.bottom > top + a.clientHeight + tolY) {
          const box = `${a.tagName.toLowerCase()}${typeof a.className === 'string' && a.className ? `.${a.className.trim().split(/\s+/).join('.')}` : ''}`;
          faults.push({ ...line, problem: `cut off by its own box ${box} (ellipsis / clamp / scrolling box): ${quote(text)}` });
          break;
        }
      }
      if (r.left < -EPS || r.right > W + EPS) faults.push({ ...line, problem: `runs off the screen: ${quote(text)}` });
    }
    // A word broken across two lines.
    if (new Set(rects.map((r) => Math.round(r.top))).size > 1) {
      const token = /^[\x21-\x7e]{4,}$/.test(text.trim());
      let lineTop = null;
      for (let i = 0; i < text.length; i++) {
        if (/\s/u.test(text[i]) || (text.charCodeAt(i) >= 0xdc00 && text.charCodeAt(i) <= 0xdfff)) continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const r = range.getClientRects()[0];
        if (!r || r.height < 2) continue;
        if (lineTop !== null && r.top > lineTop + r.height / 2 && i > 0 && (token || midWord(text[i - 1], text[i], args.spaced !== false))) {
          faults.push({ top: r.top + off, bottom: r.bottom + off, fixed, problem: `a word broken across two lines: ${quote(text)} at "${text.slice(Math.max(0, i - 8), i)}|${text.slice(i, i + 8)}"` });
        }
        if (lineTop === null || r.top > lineTop + r.height / 2) lineTop = r.top;
      }
    }
  }
  // Text the app itself cut at a fixed length (frame.excerpt, desktop): the word at its end is broken.
  if (frame.excerpt) {
    for (const el of document.querySelectorAll(frame.excerpt.selector)) {
      const text = (el.textContent || '').trim();
      if (Array.from(text).length < frame.excerpt.length || !/[\p{L}\p{N}\p{M}]$/u.test(text)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      faults.push({ top: r.top + y0, bottom: r.bottom + y0, fixed: false, problem: `a text the app cut at ${frame.excerpt.length} characters (a broken word at its end): ${quote(text.slice(-40))}` });
    }
  }
  // Small framed things - buttons, badges, chips, fields: half of one under a bar or the floating button
  // looks cut even when its text is not.
  const boxes = [];
  for (const el of document.querySelectorAll(`button, .btn, .badge, .chip, input:not([type="hidden"]), select, textarea${frame.boxes ? `, ${frame.boxes}` : ''}`)) {
    if (inChrome(el)) continue;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.height > 72) continue;
    const name = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('value') || '').trim() || el.tagName.toLowerCase();
    boxes.push({ top: r.top + y0, bottom: r.bottom + y0, left: r.left, right: r.right, text: `[${name}]` });
  }
  // `show` items: a selector (its first element), or { selector, last: true } (its last element), or
  // { selector, any: true } (any one of its elements will do).
  const shows = [];
  for (const item of args.show ?? []) {
    const selector = typeof item === 'string' ? item : item.selector;
    const all = [...document.querySelectorAll(selector)];
    const els = typeof item === 'string' ? all.slice(0, 1) : item.any ? all : item.last ? all.slice(-1) : all.slice(0, 1);
    if (!els.length) return { y: y0, moved: 0, problems: [`${selector} is not on the page`], navHeight: nav ? nav.getBoundingClientRect().height : 0 };
    shows.push({
      selector,
      options: els.map((el) => {
        const r = el.getBoundingClientRect();
        const fixed = inChrome(el);
        return { top: r.top + (fixed ? 0 : y0), bottom: r.bottom + (fixed ? 0 : y0), left: r.left, right: r.right, fixed };
      }),
    });
  }

  // The floating button gets a few pixels of air (text or a button touching it looks stuck to it); a
  // toast, an overlay across the screen, only must not cut anything (in the languages whose message
  // takes three lines it reaches down to the end of the list - the app's own bottom space).
  const AIR = 4;
  const overlaps = (a, top, bottom, f) => {
    const m = f.wide ? -HIDE : AIR;
    return !(a.right <= f.r.left - m || a.left >= f.r.right + m || bottom <= f.r.top - m || top >= f.r.bottom + m);
  };
  // Entirely behind a toast across the screen is "not on the screen" (not even a descender may show).
  const behind = (top, bottom, f) => f.wide && top >= f.r.top && bottom <= f.r.bottom;
  const problemsAt = (y) => {
    const out = [];
    for (const l of lines) {
      if (l.fixed) continue;
      const top = l.top - y;
      const bottom = l.bottom - y;
      // frame.ink: no glyph may be part under the top bar and part below it (a line counts as hidden there
      // only when none of its ink shows), and a line on the screen keeps `air` px between its lowest ink
      // and the bottom edge (text flush on the edge of the image looks cut even when it is legible).
      if (frame.ink && l.inkTop !== undefined) {
        const inkTop = l.inkTop - y;
        const inkBottom = l.inkBottom - y;
        if (inkTop < topEdge && inkBottom > topEdge) out.push(`glyphs cut by the top bar (ink shows under its edge): ${quote(l.text)}`);
        if (inkTop < navEdge && inkBottom > navEdge - frame.ink.air) out.push(`text on the bottom edge (its glyphs must end ${frame.ink.air} px above it): ${quote(l.text)}`);
      }
      if (bottom <= topEdge + HIDE || top >= navEdge - HIDE) continue; // scrolled under a bar: not on the screen
      if (top < topEdge - EPS) out.push(`cut by the top app bar: ${quote(l.text)}`);
      if (bottom > navEdge + EPS) out.push(`cut by the bottom navigation: ${quote(l.text)}`);
      for (const f of floating) {
        if (!overlaps(l, top, bottom, f)) continue;
        if (behind(top, bottom, f)) continue;
        out.push(`${f.wide ? 'cut by' : 'under'} ${f.what}: ${quote(l.text)}`);
      }
    }
    for (const b of boxes) {
      const top = b.top - y;
      const bottom = b.bottom - y;
      if (bottom <= topEdge + HIDE || top >= navEdge - HIDE) continue;
      // (args.boxUnderTopBar: a frame may run under the top bar - its text never may; see settleLayout)
      if (top < topEdge - HIDE && !args.boxUnderTopBar) out.push(`a box cut by the top app bar: ${quote(b.text)}`);
      if (bottom > navEdge + HIDE) out.push(`a box cut by the bottom navigation: ${quote(b.text)}`);
      for (const f of floating) {
        if (!overlaps(b, top, bottom, f)) continue;
        if (behind(top, bottom, f)) continue;
        out.push(`a box ${f.wide ? 'cut by' : 'under'} ${f.what}: ${quote(b.text)}`);
      }
    }
    for (const f of faults) {
      if (!f.fixed && (f.bottom - y <= topEdge + HIDE || f.top - y >= navEdge - HIDE)) continue;
      out.push(f.problem);
    }
    for (const s of shows) {
      const seen = s.options.some((o) => {
        const top = o.top - (o.fixed ? 0 : y);
        const bottom = o.bottom - (o.fixed ? 0 : y);
        if (top < (o.fixed ? 0 : topEdge) - EPS || bottom > (o.fixed ? H : navEdge) + EPS) return false;
        return o.fixed || !floating.some((f) => overlaps(o, top, bottom, f));
      });
      if (!seen) out.push(`${s.selector} is not entirely on the screen (or partly covered)`);
    }
    return [...new Set(out)];
  };

  const navHeight = nav ? Math.round(nav.getBoundingClientRect().height * 10) / 10 : 0;
  if (!args.find) return { y: y0, moved: 0, problems: problemsAt(y0), navHeight };
  const maxY = Math.max(0, document.documentElement.scrollHeight - H);
  const lo = Math.max(0, y0 - (args.up ?? 0));
  const hi = Math.min(maxY, y0 + (args.down ?? 0));
  const step = args.step ?? 2;
  let best = null;
  for (let d = 0; d <= Math.max(y0 - lo, hi - y0); d += step) {
    for (const y of d === 0 ? [y0] : [y0 + d, y0 - d]) {
      if (y < lo || y > hi) continue;
      const problems = problemsAt(y);
      if (problems.length === 0) {
        window.scrollTo(0, y);
        return { y, moved: y - y0, problems: [], navHeight };
      }
      if (!best || problems.length < best.problems.length) best = { y, problems };
    }
  }
  // Nothing clean: the position with the fewest problems, to say what stands in the way.
  return { y: best?.y ?? y0, moved: 0, problems: [`(tried ${lo}..${hi} of 0..${maxY}; fewest problems at ${best?.y ?? y0})`, ...(best?.problems ?? problemsAt(y0))], navHeight };
}

/**
 * Moves the page to the nearest clean position (layoutProbe) and checks it once more from scratch at
 * that position. Throws with the problems when there is none - such a shot is never written.
 */
async function settleLayout(page, shot, appLocale, chrome = PHONE_CHROME) {
  const { top, bottom, nav, fab, boxes, excerpt, ink } = chrome;
  const args = { show: shot.show ?? [], spaced: !NO_WORD_SPACES.has(appLocale), up: shot.up ?? 0, down: shot.down ?? 0, step: 1, chrome: { top, bottom, nav, fab, boxes, excerpt, ink } };
  // `prefer`: like `show`, but given up when no clean position has it on the screen.
  let found = shot.prefer ? await page.evaluate(layoutProbe, { ...args, show: [...args.show, ...shot.prefer], find: true }) : null;
  if (!found || found.problems.length) found = await page.evaluate(layoutProbe, { ...args, find: true });
  // Last resort: a button's frame may run under the top app bar (content scrolled under the bar, as on the
  // phone) - its label may not, nor anything at the bottom bar, the floating button or a toast.
  let relaxed = false;
  if (found.problems.length) {
    const again = await page.evaluate(layoutProbe, { ...args, boxUnderTopBar: true, find: true });
    if (!again.problems.length) [found, relaxed] = [again, true];
  }
  if (found.problems.length) throw new Error(`${shot.n}-${shot.slug}: no clean scroll position within -${args.up}/+${args.down} px:\n  ${found.problems.join('\n  ')}`);
  await page.waitForTimeout(150);
  const final = await page.evaluate(layoutProbe, { ...args, boxUnderTopBar: relaxed, find: false });
  if (final.problems.length) throw new Error(`${shot.n}-${shot.slug}: the screen is not clean at ${final.y}:\n  ${final.problems.join('\n  ')}`);
  return { scrollY: final.y, moved: found.moved, bottomNav: final.navHeight, ...(relaxed ? { boxUnderTopBar: true } : {}) };
}

/** Checks language and direction of the page against the set (a wrong language must never be shot). */
async function assertLanguage(page, appLocale) {
  const { lang, dir } = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));
  if (!lang.toLowerCase().startsWith(appLocale)) throw new Error(`page language is "${lang}", expected ${appLocale}`);
  const want = RTL.has(appLocale) ? 'rtl' : 'ltr';
  if ((dir || 'ltr') !== want) throw new Error(`page direction is "${dir}", expected ${want} for ${appLocale}`);
}

/**
 * The screenshot as a 24-bit PNG: decoded, checked to be fully opaque (a transparent pixel would mean the
 * capture is not what a phone shows) and encoded again as RGB without an alpha channel.
 */
export function toOpaqueRgbPng(png) {
  const img = decodePng(png);
  for (let i = 3; i < img.data.length; i += 4) {
    if (img.data[i] !== 255) throw new Error(`the capture has a transparent pixel at ${((i - 3) / 4) % img.width},${Math.floor((i - 3) / 4 / img.width)}`);
  }
  return encodePng(img, { alpha: false });
}

// ---------------------------------------------------------------------------------------------
// One language
// ---------------------------------------------------------------------------------------------

/**
 * How good an entry is for shot 03 (a shopper should see what an entry can hold): good mood first, then
 * exercise, a good night, people, events, a place, notes, emotions, tags. Ties go to the latest entry.
 */
export function entryScore(e) {
  const has = (v) => v !== null && v !== undefined && v !== '';
  return (
    ((e.mood ?? 0) >= 8 ? 100 : 0) +
    ((e.exerciseMinutes ?? 0) > 0 && has(e.exerciseType) ? 8 : 0) +
    ((e.sleepHours ?? 0) >= 7 ? 4 : 0) +
    ((e.sleepQuality ?? 0) >= 7 ? 2 : 0) +
    (e.people?.length ? 2 : 0) +
    (e.events?.length ? 2 : 0) +
    (has(e.location) ? 1 : 0) +
    (has(e.notes) ? 1 : 0) +
    (e.emotions?.length ? 1 : 0) +
    (e.tags?.length ? 1 : 0)
  );
}

/**
 * The longest beginning of `text` (whitespace collapsed, as the server's excerpt) that is made of whole
 * sentences and has at most `limit` characters (code points); null when even the first sentence is
 * longer. A sentence ends with . ! ? … or the Devanagari danda followed by a space or the end, or with a
 * CJK full stop / exclamation / question mark (no space follows those).
 */
export function wholeSentencesWithin(text, limit) {
  const norm = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (Array.from(norm).length <= limit) return norm;
  let best = null;
  const re = /[.!?…।](?=\s|$)|[。！？]/gu;
  for (let m = re.exec(norm); m; m = re.exec(norm)) {
    const prefix = norm.slice(0, m.index + m[0].length);
    if (Array.from(prefix).length > limit) break;
    best = prefix;
  }
  return best;
}

/** The entry of shot 03 among full entries (`entries` newest first): the best `entryScore`, the latest on a tie. */
export function pickEntry(entries) {
  let best = null;
  for (const e of entries) if (!best || entryScore(e) > entryScore(best)) best = e;
  return best;
}

/** The fictional owner of the loopback server (never shown in a screenshot). Returns its user profile. */
export async function registerOperator(base, log) {
  const password = randomPassword();
  const auth = await api(base, log, '/api/auth/register', {
    method: 'POST',
    locale: 'en-US',
    // privacyAccepted: the privacy checkbox of the registration form - the hosted server creates no account without it.
    body: { firstName: 'Server', lastName: 'Operator', username: 'operator', email: 'operator@example.com', password, confirmPassword: password, language: 'en', privacyAccepted: true },
  });
  return auth.user;
}

export async function prepareAccount({ base, log, folder, appLocale, seedContent, clock, deviceName = 'Android', wholeExcerpts = null, makeOfflineEntry = offlineEntry }) {
  clock.anchor(Date.parse(FIXED_TIME));
  const content = seedContent[appLocale];
  if (!content) throw new Error(`no seed content for ${appLocale}`);
  const account = fictionalAccount(appLocale, content.people[0]);
  const password = randomPassword();
  const lang = browserLocaleOf(folder);
  const auth = await api(base, log, '/api/auth/register', {
    method: 'POST',
    locale: lang,
    body: {
      firstName: account.firstName,
      lastName: account.lastName,
      username: account.username,
      email: account.email,
      password,
      confirmPassword: password,
      rememberMe: false,
      deviceName,
      language: appLocale,
      privacyAccepted: true,
    },
  });
  const token = auth.token;
  const settings = await api(base, log, '/api/settings', { token, locale: lang });
  if (settings.language !== appLocale) await api(base, log, '/api/settings', { method: 'PUT', token, locale: lang, body: { language: appLocale } });
  const seeded = await api(base, log, '/api/settings/seed-demo', { method: 'POST', token, locale: lang, body: {} });
  // The entry of shot 03: the best of the last two weeks (pickEntry). The demo is the same in every
  // language (same dates, ratings, pool slots), so every set shows the same entry, translated.
  const from = new Date(Date.parse(FIXED_TIME) - 13 * 86400000).toISOString().slice(0, 10);
  const to = FIXED_TIME.slice(0, 10);
  const list = await api(base, log, `/api/entries?from=${from}&to=${to}&limit=100&sortDesc=true`, { token, locale: lang });
  const full = [];
  for (const summary of list.items) full.push(await api(base, log, `/api/entries/${summary.id}`, { token, locale: lang }));
  const best = pickEntry(full);
  if (!best) throw new Error('the demo has no entry in the last two weeks');
  // `wholeExcerpts` (desktop): the list cards of today and yesterday show the server's excerpt, the
  // first N characters of the text cut wherever they end ("Ich habe mit Ma"). Such a demo text is
  // shortened to its whole sentences within N (a data change, the app is not touched), so the visible
  // excerpts end with a full sentence. The entry of shot 03 is never changed.
  if (wholeExcerpts) {
    const since = new Date(Date.parse(FIXED_TIME) - 86400000).toISOString().slice(0, 10);
    for (const e of full) {
      if (e.id === best.id || e.date < since || Array.from(String(e.body ?? '').replace(/\s+/g, ' ').trim()).length <= wholeExcerpts) continue;
      const body = wholeSentencesWithin(e.body, wholeExcerpts);
      if (!body) throw new Error(`entry ${e.date} ${e.time}: no whole sentence within ${wholeExcerpts} characters`);
      await api(base, log, `/api/entries/${e.id}`, { method: 'PUT', token, locale: lang, body: { ...e, body } });
    }
  }
  return { account, token, entryId: best.id, seeded, entryDate: best.date, entryTime: best.time, offlineEntry: makeOfflineEntry(content) };
}

async function shootLocale({ browser, profile, base, log, folder, appLocale, prepared, outDir, only, theme, clock, failures = null, debugDir = null }) {
  const lang = browserLocaleOf(folder);
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
    locale: lang,
    timezoneId: TIME_ZONE,
    colorScheme: theme,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const produced = [];
  // A whole set is rendered again from scratch: images of an older shot list must not stay behind.
  const setDir = path.join(outDir, folder);
  if (!only && fs.existsSync(setDir)) for (const name of fs.readdirSync(setDir)) if (/\.(?:png|jpe?g)$/i.test(name)) fs.rmSync(path.join(setDir, name));
  try {
    context.on('request', (req) => log.push({ from: `browser ${folder}`, url: req.url() }));
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (isAllowedUrl(url, base)) return route.continue();
      log.push({ from: `browser ${folder} (blocked)`, url });
      return route.abort('blockedbyclient');
    });
    await context.addInitScript(
      ({ token, username, css }) => {
        try {
          // Where a sign-in without "remember me" keeps the session (src/api/client.ts TOKEN_KEY).
          sessionStorage.setItem('mpd.token', token);
          localStorage.setItem('mpd.lastUsername', username);
        } catch {
          /* storage unavailable */
        }
        const still = () => {
          const style = document.createElement('style');
          style.setAttribute('data-play-screenshots', '');
          style.textContent = css;
          (document.head || document.documentElement).appendChild(style);
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', still, { once: true });
        else still();
      },
      { token: prepared.token, username: prepared.account.username, css: STILL_CSS },
    );
    if (theme === 'dark') await api(base, log, '/api/settings', { method: 'PUT', token: prepared.token, locale: lang, body: { theme: 'dark' } });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.clock.setFixedTime(new Date(FIXED_TIME));
    let counter = 0;
    const chrome = profile.chrome ?? PHONE_CHROME;
    for (const shot of profile.shots ?? SHOTS) {
      if (only && !only.has(shot.n)) continue;
      try {
        clock.anchor(Date.parse(FIXED_TIME));
        const route = typeof shot.route === 'function' ? shot.route({ ...prepared, appLocale }) : shot.route;
        // A changed query string forces a full load (a hash-only change would not).
        await page.goto(`${base}/?shot=${++counter}#${route}`, { waitUntil: 'load' });
        await settle(page);
        if (shot.offline) {
          await goOffline(context, page);
          if (shot.offline === 'write') await writeOffline(page, prepared.offlineEntry, chrome, shot.afterWrite);
        }
        if (shot.scrollTo === 'end') await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        else if (shot.scrollTo) await scrollUnderTopBar(page, shot.scrollTo, 12, !!shot.scrollToLast, chrome.top);
        await assertLanguage(page, appLocale);
        // The toast of the phone's offline shot is what that shot shows; elsewhere a toast is only a passing
        // notice (`keepToast: false`: the screen as it is once the notice has closed by itself).
        const keepToast = shot.offline === 'write' && shot.keepToast !== false;
        if (!keepToast) await removeToasts(page);
        else await blurFocus(page);
        await page.evaluate(() => document.fonts.ready);
        const layout = await settleLayout(page, shot, appLocale, chrome);
        await assertNothingPrivate(page, chrome);
        const raw = await page.screenshot({ type: 'png', fullPage: false, animations: 'disabled', caret: 'hide', scale: 'device' });
        // The app's toast closes by itself after 8 s: still there after the capture = it is in the capture.
        if (keepToast && !(await page.$('.toast-region > *'))) throw new Error(`${shot.n}-${shot.slug}: the message closed before the capture (a slow machine?) - render again`);
        const png = toOpaqueRgbPng(raw);
        const file = path.join(outDir, folder, `${shot.n}-${shot.slug}.png`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, png);
        produced.push({ folder, file, bytes: png.length, sha256: crypto.createHash('sha256').update(png).digest('hex'), ...layout });
        // After the offline entry the network stays cut until the context closes, so the entry never
        // reaches the server (it is the last shot of a set, and only lives in this context's storage).
        if (shot.offline && shot.offline !== 'write') await context.setOffline(false);
      } catch (e) {
        // --keep: the screen of a failed shot goes to the kept temporary folder (never to the output).
        if (debugDir) {
          fs.mkdirSync(debugDir, { recursive: true });
          await page.screenshot({ path: path.join(debugDir, `${folder}-${shot.n}-${shot.slug}.png`), scale: 'device' }).catch(() => {});
        }
        if (!failures) throw e;
        failures.push(`${folder} ${shot.n}-${shot.slug}: ${e.message}`);
        console.log(`  FAILED ${folder} ${shot.n}-${shot.slug}: ${e.message.split('\n').slice(0, 4).join(' | ')}`);
        await context.setOffline(false).catch(() => {});
      }
    }
  } finally {
    await context.close();
  }
  return produced;
}

/**
 * Cuts the network with the browser's DevTools offline emulation (Playwright `setOffline`: the page's
 * requests fail and navigator.onLine turns false, as when a phone loses its connection) and waits until
 * the app itself notices and shows the offline mode's status bar (src/components/sync/SyncStatusBar.tsx;
 * the engine reports "offline" after its own failure / probe timing). Nothing is faked inside the page.
 */
async function goOffline(context, page) {
  await context.setOffline(true);
  await page.waitForSelector('.sync-bar--offline', { timeout: 30000 });
  await page.waitForTimeout(300);
}

/**
 * Shot 07: with the network cut, writes an entry the way a user does - the floating "New entry" button
 * (an in-app navigation; a page load would need the network), the title and the text typed into the
 * form, "Save" - and waits for what the app then shows by itself: the entry page with the "Not uploaded
 * yet" badge (src/components/sync/PendingBadge.tsx) and the toast "Saved on this device. It will be
 * uploaded to the server when the connection returns." (src/components/sync/syncGate.ts).
 */
async function writeOffline(page, entry, chrome = PHONE_CHROME, afterWrite = 'diary') {
  await page.click(chrome.newEntryLink);
  await page.waitForSelector('main input[name="title"]');
  await page.fill('main input[name="title"]', entry.title);
  await page.fill('main textarea[name="body"]', entry.body);
  // The ratings through their number boxes (the slider's twin), as a user can type them.
  for (const [field, value] of Object.entries(entry.ratings ?? {})) {
    const box = page.locator(`main #entry-${field} + input[type="number"]`);
    await box.fill(String(value));
    await box.blur();
  }
  await page.locator('main form button[type="submit"]').first().click();
  await page.waitForFunction(() => /#\/entry\/-?\d+/.test(location.hash), null, { timeout: 30000 });
  await page.waitForSelector('main .pending-badge', { timeout: 30000 });
  await page.waitForSelector('.toast-region > *', { timeout: 30000 });
  // `afterWrite: 'entry'` (desktop): the entry page as the app shows it right after "Save" (the desktop
  // offline bar says the whole sentence, so that shot does without the passing message - DESKTOP_SHOTS 08).
  if (afterWrite === 'entry') {
    await page.waitForFunction(() => !document.querySelector('.spinner, [aria-busy="true"]'), null, { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    return;
  }
  // Then "My diary" in the bottom navigation (in-app again): the week's list, read from this device,
  // with the new entry at its end. On the entry page itself the message would cover the entry's lines
  // in most languages; at the end of the list it covers only the list's bottom space.
  await page.click(chrome.diaryLink);
  await page.waitForFunction(() => /#\/diary/.test(location.hash), null, { timeout: 30000 });
  await page.waitForSelector('main .entry-card .pending-badge', { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('.spinner, [aria-busy="true"]'), null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

/** No focus ring in a shot (the button that was pressed last keeps the focus otherwise). */
async function blurFocus(page) {
  await page.evaluate(() => {
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

/** The name of the render log next to the locale folders (read by check-screenshots.mjs). */
export const RENDER_LOG = 'render-log.json';

/**
 * Writes `<outDir>/render-log.json`: how the sets were made and, per set, its files (size, SHA-256) and
 * its part of the transport log (number of requests, the hosts contacted - only ever 127.0.0.1 - and the
 * refused ones: 0, or the set would not exist). A run of some sets (--locale) keeps the entries of the
 * others. No time stamp and no port, so the same render gives the same file.
 */
export function writeRenderLog(outDir, profile, options, sets) {
  const file = path.join(outDir, RENDER_LOG);
  let previous = {};
  try {
    previous = JSON.parse(fs.readFileSync(file, 'utf8')).sets ?? {};
  } catch {
    /* first run */
  }
  const merged = { ...previous };
  // A set rendered again replaces its entry; with --only, the files not rendered this time keep theirs.
  for (const [folder, set] of Object.entries(sets)) merged[folder] = { ...set, files: options.only ? { ...(previous[folder]?.files ?? {}), ...set.files } : set.files };
  const log = {
    generator: 'scripts/play/render-screenshots.mjs',
    profile: options.profile,
    size: `${profile.viewport.width * profile.deviceScaleFactor}x${profile.viewport.height * profile.deviceScaleFactor}`,
    viewport: `${profile.viewport.width}x${profile.viewport.height} CSS px at device scale ${profile.deviceScaleFactor}`,
    theme: options.theme,
    fixedTime: FIXED_TIME,
    timeZone: TIME_ZONE,
    ui: profile.build === 'mobile' ? 'npm run mobile:build (server build) with VITE_API_BASE=http://127.0.0.1:<port>' : 'vite build with VITE_API_BASE=http://127.0.0.1:<port>',
    server: 'server/src/hosted.ts startHosted (DIARY_MODE=hosted) on 127.0.0.1, temporary data directory',
    sets: Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]])),
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(log, null, 2)}\n`);
}

export async function renderScreenshots(options) {
  const profile = PROFILES[options.profile];
  const folders = options.locales ?? Object.keys(profile.folders);
  const outDir = options.out ?? profile.outDir;
  const { chromium, version, dir } = loadPlaywright();
  const log = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mpd-play-shots-'));
  const uiDir = path.join(tmp, 'ui');
  const dataDir = path.join(tmp, 'data');
  fs.mkdirSync(dataDir);
  process.env.TZ = TIME_ZONE;
  const clock = installServerClock();
  let server = null;
  let browser = null;
  const produced = [];
  const started = performance.now();
  try {
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    console.log(`[1/4] UI build (${profile.build}) with VITE_API_BASE=${base} -> ${uiDir}`);
    buildUi(profile.build, uiDir, base);
    // Each registration moves the limiters' clock on by two hours: the hosted register limit (5 an hour
    // per address) is for strangers on the internet, not for 20 fictional accounts made in a row here.
    let limiterShift = 0;
    console.log(`[2/4] hosted server (DIARY_MODE=hosted) on ${base}, data in ${dataDir}`);
    let owner = '';
    server = await startHostedServer({ port, dataDir, staticDir: uiDir, limiterNow: () => Date.now() + limiterShift, ownerId: () => owner });
    // The real server has an owner (DIARY_OWNER_ID), so an ordinary user sees no owner cards and no
    // "Account ID" row. The same here: a fictional operator account owns this server, and the 20
    // screenshot accounts are ordinary users.
    clock.anchor(Date.parse(FIXED_TIME));
    owner = (await registerOperator(server.base, log)).id;
    limiterShift += 2 * 3600_000;
    const deadPort = await freePort();
    console.log(`[3/4] Microsoft Edge (playwright-core ${version} from ${dir})`);
    browser = await chromium.launch({
      channel: 'msedge',
      headless: true,
      args: ['--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-pings', '--disable-gpu', '--num-raster-threads=1', '--disable-lcd-text'],
      proxy: { server: `http://127.0.0.1:${deadPort}`, bypass: '127.0.0.1' },
    });
    console.log(`[4/4] ${folders.length} set(s), fixed time ${FIXED_TIME} (${TIME_ZONE}), ${profile.viewport.width}x${profile.viewport.height} @${profile.deviceScaleFactor}`);
    const sets = {};
    const failures = options.keepGoing ? [] : null;
    for (const folder of folders) {
      const appLocale = profile.folders[folder];
      const t0 = performance.now();
      const logStart = log.length;
      // The device name the platform's app sends at sign-in (shown in Settings -> devices): "Android" on
      // the phone (as before the desktop profile existed), the localized "Computer" in the Windows app.
      const deviceName = profile.deviceName ? profile.deviceName(await server.translator(appLocale)) : 'Android';
      const prepared = await prepareAccount({ base, log, folder, appLocale, seedContent: server.seedContent, clock, deviceName, wholeExcerpts: profile.wholeExcerpts ?? null, makeOfflineEntry: profile.offlineEntry ?? offlineEntry });
      limiterShift += 2 * 3600_000;
      const files = await shootLocale({ browser, profile, base, log, folder, appLocale, prepared, outDir, only: options.only, theme: options.theme, clock, failures, debugDir: options.keep ? path.join(tmp, 'failed') : null });
      produced.push(...files);
      // This set's part of the transport log, checked on its own (a set is never written when it fails).
      const transport = assertLoopbackOnly(log.slice(logStart), base);
      sets[folder] = {
        appLocale,
        account: prepared.account.displayName,
        entry: `${prepared.entryDate} ${prepared.entryTime}`,
        // scrollY: where the page stood (CSS px); bottomNav: the navigation's height (CSS px) - it grows
        // when a label wraps (the app wraps a long label, and the current section's bold label can need
        // one line more than the same label in normal weight).
        files: Object.fromEntries(files.map((f) => [path.basename(f.file), { bytes: f.bytes, sha256: f.sha256, scrollY: f.scrollY, bottomNav: f.bottomNav, ...(f.boxUnderTopBar ? { boxUnderTopBar: true } : {}) }])),
        layout: 'clean',
        transport: { requests: transport.requests, hosts: transport.hosts.map((h) => h.replace(/:\d+$/, '')).filter((h, i, a) => a.indexOf(h) === i), refused: 0 },
      };
      const kb = files.map((f) => `${path.basename(f.file)} ${(f.bytes / 1024).toFixed(0)} KB`).join(', ');
      console.log(`  ${folder.padEnd(6)} (${appLocale}, ${prepared.account.displayName}, ${prepared.seeded.entries ?? '?'} entries) ${((performance.now() - t0) / 1000).toFixed(1)} s: ${kb}`);
      const navHeights = [...new Set(files.map((f) => f.bottomNav))];
      if (navHeights.length > 1) console.log(`         note: the bottom navigation is ${navHeights.join(' / ')} px high in this set (a label of the current section wraps in bold)`);
    }
    if (failures?.length) throw new Error(`${failures.length} shot(s) failed (--keep-going; no render log written):\n${failures.join('\n')}`);
    const verdict = assertLoopbackOnly(log, base);
    console.log(`transport log: ${verdict.requests} requests, all to ${verdict.hosts.join(', ') || '(none)'}`);
    writeRenderLog(outDir, profile, options, sets);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await server.stop().catch((e) => console.error(`server stop: ${e.message}`));
    clock.restore();
    if (options.keep) console.log(`kept ${tmp}`);
    else fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
  console.log(`${produced.length} screenshot(s) in ${path.relative(ROOT, outDir) || outDir} in ${((performance.now() - started) / 1000).toFixed(0)} s`);
  return { produced, log };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`render-screenshots: ${e.message}`);
    process.exit(2);
  }
  renderScreenshots(options)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
