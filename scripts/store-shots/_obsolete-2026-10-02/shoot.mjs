/**
 * Microsoft Store listing screenshots of Your Personal Diary (desktop, 1920x1080 PNG), in
 * English (store/screenshots/en-US) and Hebrew (store/screenshots/he-IL).
 *
 * Needs: the screenshot server running at BASE_URL (see run.mjs for the one-command version),
 * playwright-core in the TOOL folder's node_modules, Microsoft Edge installed.
 *
 *   node scripts/store-shots/shoot.mjs                 all shots, both languages
 *   node scripts/store-shots/shoot.mjs --only 04,08    only these shot numbers
 *   node scripts/store-shots/shoot.mjs --lang he-IL    only one listing language
 *
 * How a shot is taken: a fresh headless Edge context per language (viewport 1920x1080,
 * deviceScaleFactor 1, colorScheme light, browser locale of the account), the session token from
 * the API placed where the app expects it (src/api/client.ts TOKEN_KEY in sessionStorage - same
 * as a login without "remember me"), then for every shot a full page load of the route, waiting
 * for the data (no spinner, no loading text, network idle) and the fonts, the toasts removed, the
 * bottom edge moved off the middle of a line where the page allows it (snapBottomEdge), and
 * `page.screenshot` of the viewport. Nothing is submitted; the only writes are the demo data of
 * seed.mjs and the theme switch for the dark-mode shot (switched back afterwards).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ACCOUNTS, BASE_URL, requireFromTools, SCREENSHOTS_DIR, VIEWPORT } from './config.mjs';
import { api, ensureAccounts } from './seed.mjs';

const { chromium } = requireFromTools('playwright-core');

// ---------------------------------------------------------------------------
// Per-language content of the shots that type something
// ---------------------------------------------------------------------------

const CONTENT = {
  en: {
    browserLocale: 'en-US',
    newEntry: {
      title: 'An afternoon at the lake',
      body:
        'We drove out to the lake after lunch. The water was calm and the light was soft; I swam for twenty minutes and then read on the grass while Noa sketched the boats.\n\nOn the way back we stopped for ice cream and talked about her new job. I came home tired in the best way.',
      mood: 9,
      energy: 7,
      stress: 2,
      sleepQuality: 8,
      sleepHours: '7.5',
      emotions: ['happy', 'calm', 'satisfied'],
      exerciseMinutes: '20',
      exerciseType: 'swimming',
      events: ['Trip to the lake'],
      people: ['Noa'],
      location: 'Lake',
      tags: ['nature', 'friends'],
    },
    // 'search.example.1' - a question the parser understands in every language.
    searchQuestion: 'Which days in the last month did I feel best?',
    // Calendar month with Christian holidays AND demo data: April 2026 (Easter week, both rites).
    calendarRoute: '/calendar?year=2026&month=4',
  },
  he: {
    browserLocale: 'he-IL',
    newEntry: {
      title: 'אחר צהריים באגם',
      body:
        'נסענו לאגם אחרי הצהריים. המים היו רגועים והאור רך; שחיתי עשרים דקות ואחר כך קראתי על הדשא בזמן שנועה ציירה את הסירות.\n\nבדרך חזרה עצרנו לגלידה ודיברנו על העבודה החדשה שלה. חזרתי הביתה עייפה בצורה הכי טובה שיש.',
      mood: 9,
      energy: 7,
      stress: 2,
      sleepQuality: 8,
      sleepHours: '7.5',
      emotions: ['happy', 'calm', 'satisfied'],
      exerciseMinutes: '20',
      exerciseType: 'שחייה',
      events: ['טיול לאגם'],
      people: ['נועה'],
      location: 'אגם',
      tags: ['טבע', 'חברים'],
    },
    searchQuestion: 'אילו ימים בחודש האחרון הרגשתי הכי טוב?',
    // The Hebrew calendar system: the current Hebrew month with the Jewish holidays.
    calendarRoute: '/calendar?system=hebrew',
  },
};

/** The Privacy card of the Settings page (the card that holds the "Offline privacy mode" switch). */
const PRIVACY_CARD = '.card:has(#settings-offline-mode)';

/**
 * The ten listing screenshots, in Store order. `route` is the hash route; `prepare` acts on the
 * loaded page; `edge` are the options of snapBottomEdge (the bottom-edge polish, see there).
 */
const SHOTS = [
  // The home page exactly as it looks right after signing in: top of the page, navigation in view.
  { n: '01', slug: 'home', route: '/', edge: { hold: true } },
  { n: '02', slug: 'new-entry', route: '/new', prepare: fillNewEntry },
  // Month view of the previous (complete) month: the current month may be a few days old.
  { n: '03', slug: 'diary-timeline', route: () => `/diary?date=${previousMonthMidIso()}`, storage: { 'mpd.diary.view': JSON.stringify('month') } },
  { n: '04', slug: 'calendar', route: (c) => c.calendarRoute, prepare: fitCalendarGrid, edge: { keep: 'table.calendar__table' } },
  { n: '05', slug: 'habits', route: '/habits' },
  { n: '06', slug: 'insights', route: '/insights', prepare: openFirstInsightWhy },
  { n: '07', slug: 'statistics', route: '/stats', prepare: waitForCharts },
  { n: '08', slug: 'search', route: (c) => `/search?q=${encodeURIComponent(c.searchQuestion)}`, prepare: waitForSearchAnswer },
  // titleGap 3 (default 6): in Hebrew the card after Privacy starts with a button in its header;
  // 3 px less air above the page title is what lets that header fit in whole instead of cut in half.
  { n: '09', slug: 'settings-language-and-privacy', route: '/settings', prepare: settingsLanguageAndPrivacy, edge: { keep: PRIVACY_CARD, titleGap: 3 } },
  { n: '10', slug: 'dark-theme', route: '/', theme: 'dark', edge: { hold: true } },
];

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

function previousMonthMidIso() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
}

async function settle(page) {
  // The app shell + the page's data: a heading, no spinner, fonts loaded, network quiet.
  await page.waitForSelector('main h1, h1', { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('.spinner'), null, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

async function removeToasts(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.toast-region > *').forEach((el) => el.remove());
  });
}

/** React-compatible value change for inputs (number / range / text) and textareas. */
async function setValue(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.evaluate(
    ({ selector, value }) => {
      const el = document.querySelector(selector);
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { selector, value },
  );
}

async function addChips(page, selector, values) {
  const input = page.locator(selector);
  for (const v of values) {
    await input.fill(v);
    await input.press('Enter');
  }
}

async function fillNewEntry(page, content) {
  const e = content.newEntry;
  await page.locator('#entry-title').fill(e.title);
  await page.locator('#entry-body').fill(e.body);
  await setValue(page, '#entry-mood', String(e.mood));
  for (const key of e.emotions) await page.locator(`#entry-emotions-${key}`).check();
  await setValue(page, '#entry-energy', String(e.energy));
  await setValue(page, '#entry-stress', String(e.stress));
  await setValue(page, '#entry-sleepQuality', String(e.sleepQuality));
  await page.locator('#entry-sleepHours').fill(e.sleepHours);
  await page.locator('#entry-exerciseMinutes-minutes').fill(e.exerciseMinutes);
  await page.locator('#entry-exerciseType').fill(e.exerciseType);
  await addChips(page, '#entry-events', e.events);
  await addChips(page, '#entry-people', e.people);
  await page.locator('#entry-location').fill(e.location);
  await addChips(page, '#entry-tags', e.tags);
  // Back to the top: the title, the text and the mood are the story of this shot.
  await page.evaluate(() => {
    document.activeElement && document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
}

/**
 * A negative number in running text: a hyphen-minus right before a digit, at the start of the
 * text or after a space, bracket, colon or comma (so the "-" of a date range such as
 * "5.9.2026-4.10.2026" does not count).
 */
const NEGATIVE_NUMBER = /(^|[\s(:,])-\d/;

/**
 * Opens the "Why did I get this insight?" disclosure of the first insight on the page. The seed
 * data makes the first insight an encouraging upward trend with positive numbers; should another
 * insight come first and its evidence contain negative numbers, the next one is tried instead
 * (negative numbers inside RTL text are rendered with the sign on the wrong side by the current
 * app - a known defect noted in the task report - and a listing screenshot should not show it).
 * The chosen card is scrolled to the top of the viewport when it is not the first.
 */
async function openFirstInsightWhy(page) {
  const buttons = page.locator('.insight button[aria-expanded]');
  await buttons.first().waitFor({ timeout: 15000 });
  const count = await buttons.count();
  let chosen = 0;
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    await button.click();
    await page.waitForSelector('.insight button[aria-expanded="true"]', { timeout: 10000 });
    const text = await page.evaluate((i) => document.querySelectorAll('.insight')[i].textContent, i);
    chosen = i;
    // Every insight has negative numbers: keep the last one open rather than none.
    if (!NEGATIVE_NUMBER.test(text) || i === count - 1) break;
    await button.click(); // close it and try the next
  }
  await page.evaluate((i) => {
    document.activeElement && document.activeElement.blur();
    if (i === 0) {
      window.scrollTo(0, 0);
      return;
    }
    const card = document.querySelectorAll('.insight')[i];
    const header = document.querySelector('header.header');
    const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
    window.scrollBy(0, Math.floor(card.getBoundingClientRect().top - headerBottom - 16));
  }, chosen);
  await page.waitForTimeout(300);
}

async function waitForCharts(page) {
  await page.waitForSelector('main svg', { timeout: 20000 });
  await page.waitForTimeout(500);
}

async function waitForSearchAnswer(page) {
  await page.waitForSelector('#search-results-title', { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('.spinner'), null, { timeout: 30000 });
  await page.evaluate(() => {
    document.activeElement && document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
}

/**
 * Brings the element `selector` fully into the 1080 px viewport when it does not fit, by scrolling
 * the page. The top bar (.header) is sticky and the nav row scrolls under it, so a half-scrolled
 * nav row looks broken: the page is scrolled at least far enough that the nav row is just hidden
 * under the bar (a normal scrolled state of the app), and never so far that the page title leaves
 * the viewport. Nothing happens when the element already fits.
 */
async function revealBelowTheFold(page, selector, margin = 16) {
  await page.evaluate(
    ({ selector, margin }) => {
      const target = document.querySelector(selector);
      if (!target) return;
      const header = document.querySelector('header.header');
      const nav = document.querySelector('nav.nav');
      const h1 = document.querySelector('main h1, h1');
      const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
      const need = Math.ceil(target.getBoundingClientRect().bottom + margin - window.innerHeight);
      if (need <= 0) return;
      const hideNav = nav ? Math.ceil(nav.getBoundingClientRect().bottom - headerBottom) + 1 : 0;
      const keepTitle = h1 ? Math.floor(h1.getBoundingClientRect().top - headerBottom - 12) : need;
      const by = Math.max(0, Math.min(Math.max(need, hideNav), keepTitle));
      if (by > 0) window.scrollBy(0, by);
    },
    { selector, margin },
  );
  await page.waitForTimeout(300);
}

async function fitCalendarGrid(page) {
  // A month that spans six week rows (e.g. Tishrei 5787 in the Hebrew calendar) is taller than the
  // viewport with the nav row shown: scroll so the whole grid is in the picture.
  await page.waitForSelector('table.calendar__table', { timeout: 15000 });
  await revealBelowTheFold(page, 'table.calendar__table');
}

async function settingsLanguageAndPrivacy(page) {
  // The listing shot shows the language picker and the Privacy card. The Account card (name, user
  // name, e-mail address, connected devices) sits between them: hide it for the capture only (the
  // app is untouched; store/screenshots/README.md discloses it).
  // Why not keep the card and just have no address in it (checked 2026-10-04):
  //   - an account cannot exist without an e-mail: POST /api/auth/register and PUT /api/auth/profile
  //     both answer 400 VALIDATION "email" for a missing or empty address (validateEmail in
  //     server/src/security/auth-service.ts);
  //   - even without an address the card would not fit: the title and the Language, Display and
  //     Privacy cards already fill the 1080 px viewport (the page is scrolled to fit them), and the
  //     Account card adds several hundred px between them (1,085 px when measured, with a few
  //     devices in its list), so no single capture could show the language picker AND the Privacy
  //     card, which is what this shot is for (docs/store-tasks/SHOTS.md, shot 09).
  await page.addStyleTag({ content: '.settings-language + .card { display: none !important; }' });
  await page.waitForSelector('#settings-font-scale', { timeout: 15000 });
  await page.waitForSelector('#settings-offline-mode', { timeout: 15000 });
  await page.waitForTimeout(300);
  // Title + Language + Display + Privacy are a little taller than the viewport: scroll so the whole
  // Privacy card is in the picture while the page title stays visible.
  await revealBelowTheFold(page, PRIVACY_CARD);
}

/** Elements that count as one visual piece at the bottom edge (besides every line of text). */
const EDGE_BOXES = 'button, .btn, input, select, textarea, img, svg, canvas, progress, meter, tr, .badge, .chip, .progress__track';

/**
 * Bottom-edge polish. The pages scroll, so the 1080 px viewport normally ends somewhere inside the
 * page, and a capture that ends in the middle of a line of text, a button or a table row looks
 * careless. This looks for the nearest scroll position at which the bottom edge falls BETWEEN such
 * pieces and scrolls there - but only to a position that is a normal state of the app and keeps
 * the story of the shot:
 *   - the page is at the very top, or the nav row is completely under the sticky top bar (a
 *     half-scrolled nav row looks broken);
 *   - the page title stays in the picture (when it was in the picture before);
 *   - the element `keep` (what the shot is about) stays completely in the picture.
 * `hold: true` never scrolls (the shot must stay where it is) and only reports. When no clean
 * position exists the page is left where it is and `clean: false` comes back with the text that
 * the edge cuts; the caller prints it and store/screenshots/README.md says so honestly.
 *
 * "Cut" means: more than 3 px of a line box (1 px of a box) show above the edge while more than
 * half a pixel of it is hidden below the edge.
 */
async function snapBottomEdge(page, { keep = null, hold = false, margin = 8, titleGap = 6 } = {}) {
  const result = await page.evaluate(
    ({ keep, hold, margin, titleGap, boxes }) => {
      const H = window.innerHeight;
      const header = document.querySelector('header.header');
      const nav = document.querySelector('nav.nav');
      const h1 = document.querySelector('main h1, h1');
      const keepEl = keep ? document.querySelector(keep) : null;
      const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
      // `peek`: how much of a piece may show above the edge while the rest is below it (the top
      // 3 px of a line box are empty space above the glyphs; a box shows its border at once).
      // `lost`: how much may be hidden below the edge (descenders and underlines sit at the very
      // bottom of a line box, so practically nothing).
      const TEXT_TOL = { peek: 3, lost: 0.5 };
      const BOX_TOL = { peek: 1, lost: 0.5 };

      /** Every line of visible text and every box of `boxes`, in viewport coordinates. */
      const collect = () => {
        const atoms = [];
        const unseen = (el) => !el || (header && header.contains(el)) || el.closest('.visually-hidden, .toast-region') !== null;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.nodeValue.trim();
          if (!text) continue;
          const parent = node.parentElement;
          if (unseen(parent) || getComputedStyle(parent).visibility !== 'visible') continue;
          range.selectNodeContents(node);
          for (const r of range.getClientRects()) {
            if (r.width > 0 && r.height > 0) atoms.push({ top: r.top, bottom: r.bottom, tol: TEXT_TOL, what: text.slice(0, 48) });
          }
        }
        for (const el of document.querySelectorAll(boxes)) {
          if (unseen(el) || getComputedStyle(el).visibility !== 'visible') continue;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            const label = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 32);
            atoms.push({ top: r.top, bottom: r.bottom, tol: BOX_TOL, what: `<${el.tagName.toLowerCase()}>${label ? ` ${label}` : ''}` });
          }
        }
        return atoms;
      };
      /** The first piece the bottom edge would cut after scrolling by `delta`, or null. */
      const slicedBy = (atoms, delta) => atoms.find((a) => a.top - delta < H - a.tol.peek && a.bottom - delta > H + a.tol.lost) || null;

      const atoms = collect();
      const before = slicedBy(atoms, 0);
      if (!before) return { clean: true, delta: 0 };
      if (hold) return { clean: false, delta: 0, sliced: before.what };

      const rectOf = (el) => (el ? el.getBoundingClientRect() : null);
      const navR = rectOf(nav);
      const h1R = rectOf(h1);
      const keepR = rectOf(keepEl);
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - H;
      const titleShown = !!h1R && h1R.top >= headerBottom;
      const keepShown = !!keepR && keepR.top >= headerBottom - 1 && keepR.bottom <= H;
      const allowed = (delta) => {
        const y = scrollY + delta;
        if (y < 0 || y > maxScroll) return false;
        if (y > 0 && navR && navR.bottom - delta > headerBottom) return false;
        if (titleShown && h1R.top - delta < headerBottom + titleGap) return false;
        if (keepShown && (keepR.top - delta < headerBottom - 1 || keepR.bottom - delta > H)) return false;
        return !slicedBy(atoms, delta);
      };
      // Candidate positions: a piece just inside the edge, or just outside it - first with a little
      // air (`margin`) between the piece and the edge, then without.
      let best = null;
      for (const air of [margin, 0]) {
        for (const a of atoms) {
          if (Math.abs(a.top - H) > 800 && Math.abs(a.bottom - H) > 800) continue;
          for (const d of [Math.ceil(a.bottom - H + air), Math.floor(a.top - H - air)]) {
            if (d === 0 || !allowed(d)) continue;
            if (best === null || Math.abs(d) < Math.abs(best) || (Math.abs(d) === Math.abs(best) && d > best)) best = d;
          }
        }
        if (best !== null) break;
      }
      if (best === null) return { clean: false, delta: 0, sliced: before.what };
      window.scrollTo(0, scrollY + best);
      const after = slicedBy(collect(), 0);
      return { clean: !after, delta: best, ...(after ? { sliced: after.what } : {}) };
    },
    { keep, hold, margin, titleGap, boxes: EDGE_BOXES },
  );
  if (result.delta) await page.waitForTimeout(300);
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { only: null, lang: null, base: BASE_URL };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') out.only = new Set(String(argv[++i]).split(',').map((s) => s.trim().padStart(2, '0')));
    else if (a === '--lang') out.lang = argv[++i];
    else if (a === '--base') out.base = argv[++i];
  }
  return out;
}

export async function shootAll({ only = null, lang = null, base = BASE_URL } = {}) {
  const sessions = (await ensureAccounts(base)).filter((s) => !lang || s.account.key === lang);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const produced = [];
  try {
    for (const session of sessions) {
      const { account, token } = session;
      const content = CONTENT[account.locale];
      const outDir = path.join(SCREENSHOTS_DIR, account.key);
      fs.mkdirSync(outDir, { recursive: true });

      const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
        colorScheme: 'light',
        locale: content.browserLocale,
        reducedMotion: 'reduce',
      });
      await context.addInitScript(
        ({ token, username }) => {
          try {
            // Same place as a login without "remember me" (src/api/client.ts TOKEN_KEY).
            sessionStorage.setItem('mpd.token', token);
            localStorage.setItem('mpd.lastUsername', username);
          } catch {
            /* storage unavailable */
          }
        },
        { token, username: account.username },
      );
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      let counter = 0;

      for (const shot of SHOTS) {
        if (only && !only.has(shot.n)) continue;
        const file = path.join(outDir, `${shot.n}-${shot.slug}.png`);
        process.stdout.write(`${account.key} ${shot.n}-${shot.slug} ... `);

        if (shot.theme) await api(base, '/api/settings', { method: 'PUT', body: { theme: shot.theme }, token, locale: account.locale });
        try {
          if (shot.storage) {
            await page.evaluate((items) => {
              for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
            }, shot.storage);
          }
          const route = typeof shot.route === 'function' ? shot.route(content) : shot.route;
          // A changed query string forces a full reload (a hash-only change would not).
          await page.goto(`${base}/?shot=${++counter}#${route}`, { waitUntil: 'load' });
          await settle(page);
          if (shot.theme) await page.waitForSelector(`html[data-theme="${shot.theme}"]`, { timeout: 10000 });
          if (shot.prepare) await shot.prepare(page, content, session);
          await removeToasts(page);
          const edge = await snapBottomEdge(page, shot.edge);
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path: file, type: 'png', fullPage: false });
          const size = fs.statSync(file).size;
          produced.push({ lang: account.key, file, bytes: size, edge });
          const moved = edge.delta ? ` after scrolling ${edge.delta > 0 ? '+' : ''}${edge.delta} px` : '';
          console.log(
            `${(size / 1024).toFixed(0)} KB, bottom edge ${edge.clean ? `clean${moved}` : `cuts "${edge.sliced}"${moved}${shot.edge && shot.edge.hold ? ' (position held)' : ' (no clean position)'}`}`,
          );
        } finally {
          if (shot.theme) await api(base, '/api/settings', { method: 'PUT', body: { theme: 'light' }, token, locale: account.locale });
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return produced;
}

/** One line for the end of a run: which captures end on a clean bottom edge and which do not. */
export function edgeSummary(files) {
  const cut = files.filter((f) => f.edge && !f.edge.clean).map((f) => `${f.lang}/${path.basename(f.file)}`);
  return cut.length === 0
    ? `Bottom edge: clean in all ${files.length} screenshot(s).`
    : `Bottom edge: clean in ${files.length - cut.length} of ${files.length}; a line is cut in ${cut.join(', ')}.`;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;
if (isMain) {
  shootAll(parseArgs(process.argv.slice(2)))
    .then((files) => {
      console.log(`${files.length} screenshot(s) written under ${SCREENSHOTS_DIR}`);
      console.log(edgeSummary(files));
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
