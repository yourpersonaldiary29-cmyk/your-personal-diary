/**
 * Tests of scripts/site/build-site.mjs - the public site, version 2 (docs/site-tasks/SITE.md section 9).
 * Node's own test runner (no vitest project covers scripts/):
 *
 *   node --test scripts/site/build-site.test.mjs
 *
 * Against the real tree, with a fictional publisher and e-mail (the owner's values are never written into a
 * test): the 20 content files have the keys, list lengths, placeholders and link targets of the English one,
 * and a key that no longer waits for its translation is not an English copy; the English text keeps to the
 * fixed facts (29 questions in their order, no medical promise, no superlative, "end-to-end" only as a question
 * that is answered "No", a store named only where the text says the file does NOT come from it), and no text in
 * any of the 20 languages tells a visitor that a file is not signed (the owner's rule of 2026-11-22); the site does
 * not offer the web version (the owner's rule of 2026-11-23: "delete the option of opening the app in the browser.
 * I want them to download.") - no page links to the root of the server, no text has a link target, a key or a
 * sentence for it in any of the 20 languages, the home page has two actions and the Downloads page ends with the
 * tabs (2026-11-24: the note about the iPhone is gone too; the iPhone section stands there only once an App Store
 * link is set); the 160 pages exist and each has the frame of section 2 - skip link, header (the logo leads to the
 * home page), the menu with seven items and one current item, one h1, the contact block with its six controls (not
 * on the two result pages), the language chooser with 20 options, the copyright line; the home page is the brand
 * block and one hero, and "About the app" is a page of its own; every address in a page is relative and leads to a
 * file of the tree and to a page of the same language, and the tree works under another name; the download tables
 * are the rows of site/downloads.json and the copied installers have the listed size and SHA-256; the two legal
 * pages hold the whole document and name the standalone page as canonical (the address of the server in them is
 * text, not a link), and the Mac item of the policy says nothing about Apple's signature in any language (the
 * owner's decision of 2026-11-23); right-to-left pages isolate every Latin fragment;
 * the colours are the app's theme tokens with a contrast of at least 4.5:1 (controls 3:1) in light and dark;
 * site.js holds nothing forbidden; the site is in no client tree.
 * Against fixture trees in a temp folder (scripts/site/fixture-tree.mjs): the settings, the problems the builder
 * reports in one error (a page with an address that leads to the root of the server is one: such a page is not
 * built), the store links, the command line with --check / --strict / --out, identical builds.
 *
 * The script of the pages has its own tests (site-js.test.mjs), add-download.mjs too (add-download.test.mjs);
 * server/test/hosted-site-page.test.ts covers the staged image and the hosted server (vitest).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BRAND, dateInWords, DEFAULT_LOCALE, LOCALES, markdownToHtml, pagePath, parseSource, readSiteUrl } from '../legal/build-pages.mjs';
import { PUBLIC_NAMES } from './add-download.mjs';
import {
  buildSite,
  COLOR_PAIRS,
  compareVersions,
  CONTACT_ACTION,
  CONTENT_DIR,
  CONTENT_SCHEMA,
  contentFile,
  contentProblems,
  contentStatus,
  CONTROL_PAIRS,
  CSS_NAME,
  DECOR_COLORS,
  DOWNLOADS_DIR,
  DOWNLOADS_FILE,
  downloadsProblems,
  FAQ_COUNT,
  FAQ_GROUP_SIZES,
  fileSha256,
  FILES_DIR,
  flattenContent,
  FONT_STACK,
  formatDownloads,
  GENERATOR_TAG,
  ICON_IMAGE,
  IMAGE_LIST_FILE,
  legalOutline,
  legalOutlineGap,
  legalSourceFile,
  LEGAL_KINDS,
  LINK_TARGETS,
  linkTargetsOf,
  main,
  MARKER_KEY,
  MAX_CSS_BYTES,
  MAX_LEGAL_PAGE_BYTES,
  MAX_PAGE_BYTES,
  MAX_SCRIPT_BYTES,
  megabytes,
  MENU,
  pageFile,
  PLACEHOLDERS,
  placeholdersOf,
  PLATFORMS,
  PLAY_FOLDER,
  readDownloads,
  readSiteSettings,
  readThemeTokens,
  relativeHref,
  ROOT,
  SCRIPT_FILE,
  SCRIPT_FORBIDDEN,
  SCRIPT_NAME,
  scriptProblems,
  serverRootAddresses,
  SHARE_IMAGE,
  SHOTS,
  SITE_ID,
  SITE_PAGES,
  siteBaseOf,
  siteDir,
  siteFolderProblems,
  siteSettingsProblems,
  siteTreeProblems,
  STORE_FOLDER,
  STORE_LINKS,
  storeHosts,
  THEME_TOKENS,
  TOKENS_FILE,
  untranslatedContent,
  UNTRANSLATED_MARKER,
  writeSite,
} from './build-site.mjs';
import { CODES, fakePng, FILLED, fixture, FIXTURE_FILES, FIXTURE_HOST, fixtureDownloads, legalSource, NO_LINKS, readJson, sha256, SITE_SETTINGS, write } from './fixture-tree.mjs';

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** The real tree, built once with fictional settings. */
let realSite = null;
const real = () => (realSite ??= buildSite({ settings: FILLED }));
const SITE_URL = readSiteUrl();
const SERVER_HOST = new URL(SITE_URL).host;
/** The public address of the top of the site while "siteBaseUrl" is null. */
const SITE_BASE = `${SITE_URL}/${SITE_ID}/`;
const PAGE_COUNT = SITE_PAGES.length * LOCALES.length;
const IMAGE_COUNT = CODES.length * SHOTS.length + 2;
/** The real tree as it will be once the owner connects a domain: the site at the root of another host. Built once. */
const MOVED_BASE = 'https://diary.example.org/';
let movedSiteCache = null;
const movedSite = () => (movedSiteCache ??= buildSite({ settings: FILLED, siteSettings: { ...SITE_SETTINGS, siteBaseUrl: MOVED_BASE } }));

/**
 * Whether an address in a page leads to the root of the server - where the web version of the diary is. `pageUrl`
 * is the public address of the page that holds it (a relative address is resolved from there); a query or a
 * fragment does not make it another place. The owner's rule of 2026-11-23: no page of the site holds such an address.
 */
function leadsToServerRoot(address, pageUrl) {
  let url;
  try {
    url = new URL(address, pageUrl);
  } catch {
    return false;
  }
  return /^https?:$/.test(url.protocol) && url.host === SERVER_HOST && url.pathname === '/';
}

const english = () => readJson(contentFile(ROOT, DEFAULT_LOCALE));
const contentOf = (code) => readJson(contentFile(ROOT, code));
const ageOf = (l, age = FILLED.minimumAge) => new Intl.NumberFormat(l.intl, { useGrouping: false }).format(age);

/** Every text of a JSON value, by its own walk (not the builder's): dotted key -> value (faq.items.7.q). */
function leavesOf(value, where = '', out = new Map()) {
  if (Array.isArray(value)) value.forEach((entry, i) => leavesOf(entry, where ? `${where}.${i}` : String(i), out));
  else if (value && typeof value === 'object') for (const [key, entry] of Object.entries(value)) leavesOf(entry, where ? `${where}.${key}` : key, out);
  else out.set(where, value);
  return out;
}

/** A text of a content file as a visitor reads it: the placeholders filled, a link as its text. */
function plain(text, l, settings = FILLED) {
  const values = { BRAND, MINIMUM_AGE: ageOf(l, settings.minimumAge), PUBLISHER_NAME: settings.publisherName, CONTACT_EMAIL: settings.contactEmail };
  return text.replace(/\[\[[a-z]+\|([^\]]+)\]\]/g, '$1').replace(/\{\{([A-Z_]+)\}\}/g, (whole, name) => values[name] ?? whole);
}

const decode = (text) => text.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const VOID = new Set(['meta', 'link', 'img', 'input']);

/**
 * A small parser for the pages this builder writes (attributes are always double-quoted). Returns the elements
 * (tag, attrs, parents) and the text nodes (text, parents); fails on anything that does not nest properly.
 */
function parse(html, name) {
  const doctype = '<!doctype html>\n';
  assert.ok(html.startsWith(doctype), `${name}: starts with the doctype`);
  const elements = [];
  const texts = [];
  const stack = [];
  const tagRe = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s"'<>/=]+(?:="[^"]*")?)*)\s*(\/?)>/g;
  let last = doctype.length;
  tagRe.lastIndex = last;
  const text = (raw) => {
    assert.ok(!/[<>]/.test(raw), `${name}: stray < or > in ${JSON.stringify(raw.slice(0, 60))}`);
    // The builder writes one line per block; a lone line break is layout, every other text (a space between
    // two isolated fragments too) belongs to the page.
    if (raw !== '' && raw !== '\n') texts.push({ text: decode(raw), parents: [...stack] });
  };
  let m;
  while ((m = tagRe.exec(html))) {
    text(html.slice(last, m.index));
    last = tagRe.lastIndex;
    // A comment is neither an element nor a text (the builder marks the list regions of the Downloads pages with them).
    if (m[0].startsWith('<!--')) continue;
    const [, closing, tag, rawAttrs, selfClosing] = m;
    if (closing) {
      const open = stack.pop();
      assert.equal(open?.tag, tag, `${name}: </${tag}> closes <${open?.tag}>`);
      continue;
    }
    const attrs = {};
    for (const a of rawAttrs.matchAll(/\s+([^\s"'<>/=]+)(?:="([^"]*)")?/g)) {
      assert.ok(!(a[1] in attrs), `${name}: <${tag}> repeats ${a[1]}`);
      attrs[a[1]] = decode(a[2] ?? '');
    }
    const el = { tag, attrs, parents: [...stack] };
    elements.push(el);
    if (!selfClosing && !VOID.has(tag)) stack.push(el);
  }
  text(html.slice(last));
  assert.deepEqual(stack.map((el) => el.tag), [], `${name}: every element is closed`);
  const textOf = (el) => texts.filter((t) => t.parents.includes(el)).map((t) => t.text).join('');
  const inside = (el, tag) => elements.filter((other) => other.parents.includes(el) && (!tag || other.tag === tag));
  const children = (el) => elements.filter((other) => other.parents.at(-1) === el);
  return { elements, texts, textOf, inside, children, all: (tag) => elements.filter((el) => el.tag === tag) };
}

const classes = (el) => (el.attrs.class ?? '').split(' ').filter(Boolean);
const hasClass = (el, name) => classes(el).includes(name);

/** Every page of a built site, with its definition, its locale and its folder. */
function pagesOf(site) {
  return LOCALES.flatMap((l) => SITE_PAGES.map((def) => ({ rel: pageFile(def.id, l.code), html: site.pages.get(pageFile(def.id, l.code)), def, l, dir: siteDir(def.id, l.code) })));
}

/** The pages of the real tree, parsed once. */
const parsedPages = new Map();
function parsed(rel) {
  if (!parsedPages.has(rel)) parsedPages.set(rel, parse(real().pages.get(rel), rel));
  return parsedPages.get(rel);
}

/** Where a relative address of a page in `dir` leads, from the top of the site ('', 'he/terms/', 'site.css'); null = outside it. */
function resolveAddress(dir, address) {
  const place = path.posix.normalize(`${dir}${address.replace(/[#?].*$/, '')}`);
  if (place.startsWith('..')) return null;
  return place === '.' || place === './' ? '' : place;
}

/** Width and height from the IHDR chunk of a PNG file, read here (not with the builder's reader). */
function ihdr(file) {
  const buf = readFileSync(file);
  assert.deepEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${file}: PNG signature`);
  assert.equal(buf.toString('latin1', 12, 16), 'IHDR', `${file}: the first chunk is IHDR`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Runs the command line in a tree and collects what it prints. */
function run(argv, root) {
  const out = [];
  const log = { log: (m) => out.push(m), warn: (m) => out.push(m), error: (m) => out.push(m) };
  return { code: main(argv, { root, log }), out: out.join('\n') };
}

const filesUnder = (dir) => readdirSync(dir, { recursive: true }).map((f) => String(f).split(path.sep).join('/')).filter((f) => statSync(path.join(dir, f)).isFile()).sort();
const temp = (t, name) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), name));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};
/** The problems of a build that must fail. */
function problemsOf(build) {
  let error = null;
  try {
    build();
  } catch (e) {
    error = e;
  }
  assert.ok(error, 'the build fails');
  assert.ok(Array.isArray(error.problems), 'one error that lists the problems');
  return error.problems;
}

/** WCAG relative luminance and contrast ratio of two #rrggbb colours. */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------------------------
// The texts
// ---------------------------------------------------------------------------------------------

test('content: the 20 locales have the keys, list lengths, placeholders and link targets of the English file', () => {
  assert.deepEqual(readdirSync(path.join(ROOT, CONTENT_DIR)).sort(), CODES.map((c) => `site-${c}.json`).sort(), 'one file per app locale and nothing else');
  const base = leavesOf(english());
  assert.ok(base.size > 150, 'the English file has all its texts');
  assert.ok(!(MARKER_KEY in english()), 'the English file carries no marker');
  const names = (t) => [...new Set([...t.matchAll(/\{\{([^{}]*)\}\}/g)].map((m) => m[1]))].sort();
  const targets = (t) => [...t.matchAll(/\[\[([a-z]+)\|[^\]]+\]\]/g)].map((m) => m[1]).sort();
  for (const code of CODES) {
    const raw = readFileSync(contentFile(ROOT, code), 'utf8');
    assert.ok(raw.charCodeAt(0) !== 0xfeff && !raw.includes('\r') && raw.endsWith('}\n'), `${code}: UTF-8 without BOM, LF line endings`);
    const content = JSON.parse(raw);
    const { [MARKER_KEY]: status, ...texts } = content;
    const leaves = leavesOf(texts);
    assert.deepEqual([...leaves.keys()].sort(), [...base.keys()].sort(), `${code}: the same keys and the same list lengths`);
    for (const [where, text] of leaves) {
      assert.equal(typeof text, 'string', `${code} ${where}: a text`);
      assert.ok(text.length > 0, `${code} ${where}: not empty`);
      assert.equal(text, text.trim(), `${code} ${where}: no leading or trailing space`);
      assert.ok(!/[<>]/.test(text), `${code} ${where}: no < or >`);
      assert.ok(!/[\u0000-\u001f]/.test(text), `${code} ${where}: no line break or tab`);
      assert.deepEqual(names(text), names(base.get(where)), `${code} ${where}: the placeholders of the English text`);
      assert.deepEqual(targets(text), targets(base.get(where)), `${code} ${where}: the link targets of the English text`);
      assert.ok(!/[{}]/.test(text.replace(/\{\{[A-Z_]+\}\}/g, '')) && !/\[\[|\]\]/.test(text.replace(/\[\[[a-z]+\|[^[\]|{}]+\]\]/g, '')), `${code} ${where}: no broken placeholder or link`);
    }
    assert.deepEqual(contentProblems(content, code === DEFAULT_LOCALE ? null : english()), [], `${code}: the builder agrees`);
    // The texts of the menu, in the order of the menu: nav.home (2026-11-22) stands first, after the label of the menu.
    assert.deepEqual(Object.keys(content.nav), ['label', 'home', 'about', 'terms', 'faq', 'privacy', 'downloads', 'contact'], `${code}: the keys of nav, in their order`);
    assert.notEqual(content.nav.home, content.nav.about, `${code}: "Home" and "About the app" are two items of the menu`);
    if (code === DEFAULT_LOCALE) continue;
    // The marker: none (the file is translated), every key ("all": an English copy), or the keys that still wait.
    let waiting = [];
    if (status !== undefined) {
      assert.deepEqual(Object.keys(status).sort(), ['keys', 'marker'], `${code}: the shape of "${MARKER_KEY}"`);
      assert.equal(status.marker, UNTRANSLATED_MARKER, `${code}: the marker value`);
      if (status.keys === 'all') {
        assert.deepEqual(texts, english(), `${code}: "keys": "all" marks an English copy`);
        assert.equal(contentStatus(content), 'all');
        continue;
      }
      assert.ok(Array.isArray(status.keys) && status.keys.length > 0, `${code}: "keys" is "all" or a list`);
      assert.equal(new Set(status.keys).size, status.keys.length, `${code}: no key is listed twice`);
      for (const key of status.keys) assert.ok(base.has(key), `${code}: the listed key ${key} is a text of the file`);
      assert.deepEqual(contentStatus(content), status.keys);
      waiting = status.keys;
    } else assert.equal(contentStatus(content), null);
    // A key that does not wait is translated: none of the longer sentences is still the English one.
    for (const [where, text] of leaves) {
      if (!waiting.includes(where) && base.get(where).length > 40) {
        assert.notEqual(text, base.get(where), `${code} ${where}: still the English text - translate it, or list the key in "${MARKER_KEY}" until it is done`);
      }
    }
    assert.equal(new Set([content.languagesLabel, content.nav.label, content.footer.languagesLabel]).size, 3, `${code}: the language label, the menu label and the label of the language list differ`);
  }
  for (const where of base.keys()) for (const name of placeholdersOf(base.get(where))) assert.ok(PLACEHOLDERS.includes(name), `${where}: {{${name}}} is a known placeholder`);
  for (const where of base.keys()) for (const target of linkTargetsOf(base.get(where))) assert.ok(LINK_TARGETS.includes(target), `${where}: [[${target}|...]] is a known target`);
  assert.deepEqual(untranslatedContent().sort(), CODES.filter((code) => MARKER_KEY in contentOf(code)).map((code) => `site/content/site-${code}.json`).sort());
});

test('content: the English text keeps to the fixed facts - 29 questions, no promise, superlative, cliche or exclamation mark', () => {
  const FORBIDDEN = [
    // security superlatives (the server holds the keys of the accounts: "end-to-end" is checked separately below)
    /zero[\s-]knowledge/i, /military[\s-]grade/i, /bank[\s-]level/i, /most secure/i, /unbreakable/i, /100\s?%/, /\bguarantee/i,
    // medical or therapeutic promises
    /mental health/i, /reduces? (?:your )?stress/i, /\btherap/i, /\bcures?\b/i, /\bheal(?:s|ing)?\b/i, /\btreat(?:s|ment)?\b/i, /\bimproves? your\b/i, /well-?being/i,
    // superlatives, numbers of users or downloads, reviews, awards, comparisons
    /\bbest\b/i, /\b#\s?1\b/, /number one/i, /\bleading\b/i, /world'?s/i, /\baward/i, /\breviews?\b/i, /\brated\b/i, /\bstars?\b/i, /\busers\b/i, /\d[\d.,]*\s*(?:k|thousand|million)?\s*(?:downloads|installs)/i, /better than/i, /\bunlike\b/i, /\bcompared\b/i,
    // marketing cliches
    /seamless/i, /powerful/i, /\bunlock/i, /journey/i, /elevate/i, /effortless/i, /robust/i, /cutting[\s-]edge/i, /revolution/i, /game[\s-]chang/i, /supercharge/i, /\bamazing\b/i, /next[\s-]level/i,
    /!/,
    // the diary is kept in the account on the server: never "only on your device", never "no cloud"
    /only on (?:your|this) (?:device|phone)/i, /no (?:cloud|server)\b/i,
    // no store has published the app: nothing says it is there
    /(?:available|published|listed|find it|now) (?:on|in|at) (?:the )?(?:Google Play|App Store|Mac App Store|Microsoft Store)/i,
  ];
  const content = english();
  const leaves = leavesOf(content);
  // A store is named only by its own link text (shown once the link is set) and where a text says where a file does NOT come from.
  const STORE_KEYS = ['downloads.install.windows', 'downloads.install.android', 'downloads.iphoneStore', ...Object.keys(STORE_LINKS).map((key) => `downloads.storeLinks.${key}`)];
  for (const [where, text] of leaves) {
    for (const re of FORBIDDEN) assert.ok(!re.test(text), `${where}: ${re} matches "${text}"`);
    if (!STORE_KEYS.includes(where)) assert.ok(!/Google Play|App Store|Microsoft Store/.test(text), `${where}: no store is named here`);
  }
  // The owner's rule of 2026-11-22: a visitor is never told that a file is not signed. The notes say where the file does
  // not come from, name the warnings and give the steps past them (all 20 languages: the test of the rule below).
  assert.match(content.downloads.install.windows, /^This setup file does not come from Microsoft Store\. Your browser may first warn that the file is not commonly downloaded \(choose to keep it\), and when you open it, Windows may show/);
  assert.match(content.downloads.install.windows, /"Windows protected your PC": choose More info, then Run anyway/);
  assert.match(content.downloads.install.android, /installed directly, not through Google Play/);
  assert.match(content.downloads.install.android, /allow your browser or file manager to install apps/);
  assert.match(content.downloads.install.mac, /^Open the disk image, drag the app to the Applications folder and open it from there\. The first time, macOS does not open it, and the message may even say that the app is damaged\. /);
  assert.match(content.downloads.install.mac, /System Settings, then Privacy & Security, scroll down and choose Open Anyway \(on macOS 12: System Preferences, then Security & Privacy, then Open Anyway\)/);
  // macOS may call such an app "damaged" (docs/MAC-RELEASE.he.md 5.3): the note says so before the visitor throws it away.
  assert.match(content.downloads.install.mac, /may even say that the app is damaged\. Do not move it to the Bin/);
  assert.match(content.faq.items[27].a, /^Because the file is not from an app store\. Windows may show "Windows protected your PC": choose More info, then Run anyway\. macOS does not open the app the first time/);
  assert.match(content.faq.items[27].a, /may even say that it is damaged: do not move it to the Bin.*on macOS 12: System Preferences, then Security & Privacy/);
  // Android 7 (the oldest the app runs on) has one switch, Unknown sources, instead of a permission per app.
  assert.match(content.downloads.install.android, /on Android 7 this setting is called Unknown sources/);
  // The iPhone app is named like the other apps (the owner's wording of 2026-11-18): no "not available yet". The
  // note of the Downloads page ("There is no installation file for iPhone: the iPhone app is installed from the App
  // Store.") is gone since 2026-11-24 (the owner: delete it); the sentence with the App Store link is shown only
  // once that link is set.
  assert.ok(!('iphone' in content.downloads), 'downloads.iphone: the note about the iPhone is gone');
  assert.equal(content.downloads.iphoneStore, 'On an iPhone, the app is installed from the App Store.');
  assert.match(content.faq.items[3].a, /an iPhone with iOS 16 or later/);
  for (const [where, text] of leaves) assert.ok(!/not available yet|when it is published/i.test(text), `${where}: the iPhone app is not called unpublished`);
  assert.match(content.downloads.requires.windows, /Windows 10 or Windows 11/);
  assert.match(content.downloads.requires.android, /Android 7\.0 or later/);
  assert.match(content.downloads.requires.mac, /macOS 12\.3 or later/);

  // "end-to-end": one question asks it, and the answer is No.
  const endToEnd = [...leaves].filter(([, text]) => /end[\s-]to[\s-]end/i.test(text)).map(([where]) => where);
  assert.deepEqual(endToEnd, ['faq.items.20.q'], '"end-to-end" stands only in the question that asks it');
  assert.match(content.faq.items[20].a, /^No\. /);
  assert.match(content.faq.items[20].a, /the server opens it in its memory/);

  // The 29 questions, in the six groups, each on its subject (the translations follow these positions). Until
  // 2026-11-23 there were 30: the 18th, "Can I use it in a browser, without installing anything?", was deleted with
  // the option itself (the owner's rule, tested below), so the third group has four questions and every later
  // question stands one place earlier.
  assert.equal(FAQ_COUNT, 29);
  assert.equal(content.faq.items.length, 29);
  assert.deepEqual(FAQ_GROUP_SIZES, [7, 7, 4, 5, 4, 2]);
  assert.deepEqual(content.faq.groups, ['About the app', 'Writing and features', 'Devices and working offline', 'Privacy and security', 'Your account', 'Installing and updating']);
  const SUBJECTS = [
    /^What is \{\{BRAND\}\}\?$/, /free/, /publishes/, /devices/, /languages/, /medical tool/, /without an account/,
    /diary entry/, /habits and reminders/, /insights.*numbers behind/, /calendars/, /smart search/, /statistics/, /formats.*export/,
    /offline/, /several devices/, /same entry on two devices/, /"Remember me"/,
    /Where is my diary kept/, /Who can read my diary/, /end-to-end encrypted/, /ads or tracking/, /locked/,
    /forget my password/, /back up.*restore/, /delete my account/, /How old/,
    /warn.*install a file from this site/, /update to a new version/,
  ];
  assert.equal(SUBJECTS.length, 29);
  content.faq.items.forEach((item, i) => {
    assert.match(item.q, SUBJECTS[i], `question ${i}`);
    assert.ok(item.q.endsWith('?'), `question ${i} is a question`);
    assert.ok(item.a.length >= 60 && item.a.length <= 700, `answer ${i} is short (${item.a.length} characters)`);
  });
  assert.equal(new Set(content.faq.items.map((item) => item.q)).size, 29, 'no question twice');
  // The questions of each group, by the first and the last of the group: the group that lost a question still
  // starts with working offline and ends with "Remember me".
  const groupStarts = FAQ_GROUP_SIZES.map((size, g) => FAQ_GROUP_SIZES.slice(0, g).reduce((sum, n) => sum + n, 0));
  assert.deepEqual(groupStarts, [0, 7, 14, 18, 23, 27]);
  assert.match(content.faq.items[groupStarts[2]].q, /offline/);
  assert.match(content.faq.items[groupStarts[3] - 1].q, /"Remember me"/);
  assert.match(content.faq.items[groupStarts[3]].q, /Where is my diary kept/);

  // The careful words that must be there.
  assert.match(content.faq.items[5].a, /^No\. .*not a medical or diagnostic tool.*not medical or psychological advice/);
  assert.match(content.faq.items[6].a, /^In the Android app, yes\./, 'the tour exists in the Android app only');
  assert.match(content.faq.items[19].a, /could technically reset the password of any account and read its diary without knowing the password\. We promise not to do this/);
  // Backup is a page of the menu (in the Android and iPhone apps under More), not a card of Settings; "Remember me" is ticked at first.
  assert.match(content.faq.items[24].a, /^Open Backup in the menu \(in the Android and iPhone apps, under More\)/);
  // The iPhone app is named with the others wherever the answer is true for it too (the owner's wording of 2026-11-18,
  // "the iPhone app in all places"); the tour stays Android only.
  assert.match(content.faq.items[0].a, /as an app for Windows, Mac, Android and iPhone, with one account for all of them/);
  assert.match(content.faq.items[6].a, /In the Windows, Mac and iPhone apps you need an account/);
  assert.match(content.faq.items[8].a, /On an Android phone or an iPhone that allows notifications for the app/);
  assert.match(content.faq.items[17].a, /In the Windows, Mac, Android and iPhone apps it also keeps an encrypted copy/);
  assert.match(content.faq.items[22].a, /In the Android and iPhone apps you can also have it lock whenever you leave the app\./);
  // No app offers a fingerprint / face unlock online: the device's screen lock is offered only without a connection.
  assert.match(content.faq.items[22].a, /Without a connection, an app can also open with the screen lock of your device instead of the password \(Windows Hello, Touch ID or the Mac password, Face ID \/ Touch ID or the iPhone passcode, or the Android screen lock\)/);
  assert.ok(!/open it with your fingerprint or face/.test(content.faq.items[22].a), 'no online fingerprint unlock is promised');
  // The lead of the Downloads page names the three systems that have a file, and no other (2026-11-24: its iPhone
  // clause went with the note); the device in use cannot be disconnected from the list (sign out there).
  assert.match(content.downloads.lead, /for Windows, Android and Mac\. One account works in all of them\.$/);
  assert.ok(!/iPhone/.test(content.downloads.lead), 'the lead of the Downloads page does not name the iPhone');
  assert.match(content.faq.items[15].a, /and you can disconnect any of them except the one you are using\.$/);
  assert.ok(![...leaves.values()].some((text) => /Settings - Backup/.test(text)), 'no text sends the visitor to a Backup card in Settings');
  assert.match(content.faq.items[17].a, /it is ticked at first: on a device that other people also use, clear it/);
  assert.ok(content.faq.items[26].a.includes('{{MINIMUM_AGE}}') && !/\p{Nd}/u.test(content.faq.items[26].a), 'the age comes from legal/settings.json, never a literal');
  assert.match(content.faq.items[27].a, /More info, then Run anyway.*Open Anyway/);
  assert.match(content.faq.items[28].a, /do not update themselves/);
  assert.match(content.privacy.items.join(' '), /stored encrypted/);
  assert.match(content.privacy.items.join(' '), /opens your diary in its memory/);
  assert.match(content.features.items[2].text, /never claim that one thing causes another/);
  assert.equal(content.contact.notice, 'Your name, e-mail address and message are sent to us by e-mail so that we can answer you. They are not stored on the server. More in the [[privacy|Privacy Policy]].');
  assert.equal(content.footer.rights, 'All rights reserved.');
  assert.deepEqual(content.nav, { label: 'Site menu', home: 'Home', about: 'About the app', terms: 'Terms of Use', faq: 'Questions and answers', privacy: 'Privacy Policy', downloads: 'Downloads', contact: 'Contact us' });
  assert.deepEqual(content.downloads.columns, { file: 'File', version: 'Version', size: 'Size' });
  assert.deepEqual(content.downloads.tabs, { windows: 'Windows', android: 'Android', mac: 'Mac' });
  assert.deepEqual([content.contact.sentTitle, content.contact.errorTitle], ['Your message was sent', 'Your message was not sent']);
  assert.equal(content.features.items.length, 8);
  assert.equal(content.screens.items.length, SHOTS.length);
  // The e-mail address is a link: only the text of the error page carries it; the publisher is named once.
  assert.deepEqual([...leaves].filter(([, text]) => text.includes('{{CONTACT_EMAIL}}')).map(([where]) => where), ['contact.errorText']);
  assert.deepEqual([...leaves].filter(([, text]) => text.includes('{{PUBLISHER_NAME}}')).map(([where]) => where), ['faq.items.2.a']);
});

/**
 * THE OWNER'S RULE OF 2026-11-22 (his words: the visitors "do not need to know that the file is not signed yet"):
 * no text of the site, in any language, tells a visitor that a file or the app is not signed. Until that day three
 * texts of every language said so - downloads.install.windows, downloads.install.mac and the answer about the
 * warnings (then faq.items.28.a; faq.items.27.a since the question about the browser was deleted on 2026-11-23) -
 * and that clause, and nothing else, left them. The table holds the words each language used there for "signed" and for
 * "certificate", read from the files of commit 20c1071 (a stem where the word is inflected; Arabic and Hebrew used
 * two forms). A text that brings one of them back fails this test: change the text, not the table.
 */
const UNSIGNED_WORDS = {
  ar: { signed: ['موقعا', 'موقعة'], certificate: ['شهادة'] },
  bg: { signed: ['подписан'], certificate: ['сертификат'] },
  cs: { signed: ['podepsan'], certificate: ['certifikát'] },
  de: { signed: ['signiert'], certificate: ['zertifikat'] },
  el: { signed: ['υπογραφεί'], certificate: ['πιστοποιητικό'] },
  en: { signed: ['signed'], certificate: ['certificate'] },
  es: { signed: ['firmad'], certificate: ['certificado'] },
  fr: { signed: ['signé'], certificate: ['certificat'] },
  he: { signed: ['חתום', 'חתומ'], certificate: ['תעודת'] },
  hi: { signed: ['हस्ताक्षरित'], certificate: ['प्रमाणपत्र'] },
  hu: { signed: ['aláírva'], certificate: ['tanúsítván'] },
  it: { signed: ['firmat'], certificate: ['certificato'] },
  ja: { signed: ['署名'], certificate: ['証明書'] },
  pl: { signed: ['podpisan'], certificate: ['certyfikat'] },
  pt: { signed: ['assinad'], certificate: ['certificado'] },
  ro: { signed: ['semnat'], certificate: ['certificat'] },
  ru: { signed: ['подписан'], certificate: ['сертификат'] },
  th: { signed: ['ลงนาม'], certificate: ['ใบรับรอง'] },
  tr: { signed: ['imzalan'], certificate: ['sertifika'] },
  zh: { signed: ['签名'], certificate: ['证书'] },
};
/** The three texts that told it, as dotted keys. */
const INSTALL_TEXTS = ['downloads.install.windows', 'downloads.install.mac', 'faq.items.27.a'];

test('content: no text in any of the 20 languages tells a visitor that a file is not signed (the owner, 2026-11-22)', () => {
  assert.deepEqual(Object.keys(UNSIGNED_WORDS).sort(), [...CODES].sort(), 'the table has a row for every app locale');
  for (const code of CODES) {
    const leaves = leavesOf(contentOf(code));
    const { signed, certificate } = UNSIGNED_WORDS[code];
    assert.ok(signed.length >= 1 && certificate.length >= 1 && [...signed, ...certificate].every((word) => word.trim().length >= 2), `${code}: a word for "signed" and a word for "certificate"`);
    for (const where of INSTALL_TEXTS) {
      const text = leaves.get(where).toLowerCase();
      for (const word of [...signed, ...certificate]) assert.ok(!text.includes(word.toLowerCase()), `${code} ${where}: "${word}" is back - a visitor is not told that a file is not signed`);
    }
    // No other text of the language names a certificate either.
    for (const [where, text] of leaves) for (const word of certificate) assert.ok(!text.toLowerCase().includes(word.toLowerCase()), `${code} ${where}: "${word}"`);
    // What the visitor needs stayed: where the file does not come from, the systems by their names, the older
    // versions with their own steps, the Downloads page with its checksums. (Czech and Polish decline "Android".)
    const android7 = /Android\p{L}{0,3} 7/u;
    assert.ok(leaves.get('downloads.install.windows').includes('Microsoft Store') && leaves.get('downloads.install.windows').includes('Windows'), `${code}: the Windows note names Microsoft Store`);
    assert.ok(leaves.get('downloads.install.android').includes('Google Play') && android7.test(leaves.get('downloads.install.android')), `${code}: the Android note names Google Play and Android 7`);
    assert.ok(leaves.get('downloads.install.mac').includes('macOS') && leaves.get('downloads.install.mac').includes('macOS 12'), `${code}: the Mac note has the steps of both versions of macOS`);
    for (const name of ['Windows', 'macOS', 'macOS 12', 'Android', 'SHA-256', '[[downloads|']) assert.ok(leaves.get('faq.items.27.a').includes(name), `${code}: the answer about the warnings still names ${name}`);
    assert.match(leaves.get('faq.items.27.a'), android7, `${code}: the answer about the warnings still names Android 7`);
  }
  // The table is not blind: it catches the two sentences that left the English file.
  for (const old of ['This setup file does not come from Microsoft Store and is not signed with a publisher certificate yet.', 'The app is not signed with an Apple developer certificate yet, so the first time macOS does not open it']) {
    assert.ok(UNSIGNED_WORDS.en.signed.some((word) => old.includes(word)) && UNSIGNED_WORDS.en.certificate.some((word) => old.includes(word)), old);
  }
  // The rule in English words, over every English text: not signed, not certified, not verified, not notarized,
  // an unidentified developer or publisher. ("Unknown sources" is the name of a setting of Android 7 and stays.)
  const RULE = [/\bunsigned\b/i, /\bnot (?:yet |been )?signed\b/i, /\bcertificat/i, /\buncertified\b/i, /\bnot (?:yet )?certified\b/i, /\bunverified\b/i, /\bnot (?:yet )?verified\b/i, /notari[sz]/i, /\b(?:unidentified|unknown|unverified) (?:developer|publisher)\b/i];
  for (const [where, text] of leavesOf(english())) for (const re of RULE) assert.ok(!re.test(text), `${where}: ${re} matches "${text}"`);
  for (const sample of ['The file is unsigned.', 'It is not signed yet.', 'It has no publisher certificate.', 'The app is not notarized.', 'macOS says it is from an unidentified developer.', 'The file was not verified.']) {
    assert.ok(RULE.some((re) => re.test(sample)), `the rule catches: ${sample}`);
  }

  // The English and the Hebrew texts are the ones the owner approved, word for word.
  const en = english();
  assert.equal(en.downloads.install.windows, 'This setup file does not come from Microsoft Store. Your browser may first warn that the file is not commonly downloaded (choose to keep it), and when you open it, Windows may show "Windows protected your PC": choose More info, then Run anyway. The setup asks for your language and installs the app for your own Windows account, without an administrator password.');
  assert.equal(en.downloads.install.mac, 'Open the disk image, drag the app to the Applications folder and open it from there. The first time, macOS does not open it, and the message may even say that the app is damaged. Do not move it to the Bin (Trash): close the message, open System Settings, then Privacy & Security, scroll down and choose Open Anyway (on macOS 12: System Preferences, then Security & Privacy, then Open Anyway), enter your Mac password if asked, and choose Open.');
  assert.equal(en.faq.items[27].a, 'Because the file is not from an app store. Windows may show "Windows protected your PC": choose More info, then Run anyway. macOS does not open the app the first time and may even say that it is damaged: do not move it to the Bin (Trash), but open System Settings, then Privacy & Security (on macOS 12: System Preferences, then Security & Privacy), and choose Open Anyway. Android asks you to allow your browser or file manager to install apps (on Android 7: Unknown sources). The [[downloads|Downloads]] page has the steps for each system, and a SHA-256 checksum for every file to check that your copy is unchanged.');
  const he = contentOf('he');
  assert.equal(he.downloads.install.windows, 'קובץ ההתקנה הזה לא מגיע מ-Microsoft Store. ייתכן שהדפדפן יזהיר קודם שהקובץ לא מורד לעתים קרובות (בחרו לשמור אותו), וכשתפתחו אותו, Windows עשוי להציג "Windows protected your PC" (Windows הגן על המחשב שלך): בחרו "מידע נוסף" ואז "הפעל בכל זאת". ההתקנה שואלת מה השפה שלכם ומתקינה את האפליקציה בחשבון ה-Windows שלכם בלבד, בלי סיסמת מנהל.');
  assert.ok(he.downloads.install.mac.startsWith('פתחו את תמונת הדיסק, גררו את האפליקציה לתיקייה "יישומים" ופתחו אותה משם. בפעם הראשונה macOS לא פותח אותה, וההודעה עשויה אף לומר שהאפליקציה פגומה. אל תעבירו אותה לפח: סגרו את ההודעה, '), 'he: the Mac note starts with the steps, then "the first time"');
  assert.ok(he.faq.items[27].a.startsWith('כי הקובץ לא מגיע מחנות אפליקציות. Windows עשוי להציג "Windows protected your PC" (Windows הגן על המחשב שלך): '), 'he: the answer starts with the store, then the warning of Windows');
});

/**
 * THE OWNER'S RULE OF 2026-11-23 (his words, translated: "on the site, delete the option of opening the app in the
 * browser. I want them to download."): the site does not offer the web version. The web version itself keeps
 * working at the root of the server, and the two legal documents - shown inside the site unchanged - still describe
 * it. But no page of the site links to it, and no text of site/content/, in any language, tells a visitor that the
 * diary can be opened, used or read in a web browser. Until that day every language had: a first button on the home
 * page (hero.openAction), a question "Can I use it in a browser, without installing anything?" (faq.items.17), a
 * paragraph on the Downloads page (downloads.web), the link target [[webapp|...]], and the browser or "the web
 * version" named in eight more texts (six answers, the lead of the Downloads page and the heading under its tabs).
 *
 * The table holds, for each language, the word it uses for "browser" and the words it used for "the web version",
 * read from the files of commit 9cdfb9a - a stem where the word is inflected, so that every form of it is seen.
 * Where one stem cannot do that, the row holds the case forms one by one, also those no text used: Greek (the
 * accent moves - πρόγραμμα, προγράμματος - and each form is cut before the ending of its last word, which takes a
 * second accent before "σας") and Polish (wersja, wersji, wersję, wersją). Japanese writes "browser" as ブラウザー
 * and as ブラウザ: the row holds what the two spellings share.
 *
 * The word for "browser" legitimately STAYS in exactly three texts, where a file is downloaded or installed - the
 * Windows note, the Android note and the answer about the warnings - and the test wants it there and nowhere else,
 * so a wrong word in the table fails as surely as a text that brings the option back. Change the text, not the table.
 */
const WEB_VERSION_WORDS = {
  ar: { browser: ['متصفح'], webVersion: ['نسخة الويب'] },
  bg: { browser: ['браузър'], webVersion: ['уеб верси'] },
  cs: { browser: ['prohlížeč'], webVersion: ['webov'] },
  de: { browser: ['browser'], webVersion: ['webversion'] },
  el: { browser: ['πρόγραμμα περιήγησ', 'προγράμματος περιήγησ', 'προγράμματα περιήγησ', 'προγραμμάτων περιήγησ'], webVersion: ['διαδικτυακή έκδοσ', 'διαδικτυακής έκδοσ'] },
  en: { browser: ['browser'], webVersion: ['web version'] },
  es: { browser: ['navegador'], webVersion: ['versión web'] },
  fr: { browser: ['navigateur'], webVersion: ['version web'] },
  he: { browser: ['דפדפן'], webVersion: ['גרסת הדפדפן'] },
  hi: { browser: ['ब्राउज़र'], webVersion: ['वेब संस्करण'] },
  hu: { browser: ['böngész'], webVersion: ['webes verzi'] },
  it: { browser: ['browser'], webVersion: ['versione web'] },
  ja: { browser: ['ブラウザ'], webVersion: ['ウェブ版'] },
  pl: { browser: ['przeglądar'], webVersion: ['wersji internetowej', 'wersja internetowa', 'wersję internetową', 'wersją internetową'] },
  pt: { browser: ['navegador'], webVersion: ['versão web'] },
  ro: { browser: ['browser'], webVersion: ['versiunea web'] },
  ru: { browser: ['браузер'], webVersion: ['веб-верси'] },
  th: { browser: ['เบราว์เซอร์'], webVersion: ['เวอร์ชันเว็บ'] },
  tr: { browser: ['tarayıcı'], webVersion: ['web sürüm'] },
  zh: { browser: ['浏览器'], webVersion: ['网页版'] },
};
/** The three texts where a browser downloads or installs a file, in the order of a content file. */
const BROWSER_TEXTS = ['faq.items.27.a', 'downloads.install.windows', 'downloads.install.android'];

/**
 * Every address in the markup of a page, read with a plain scan (not with the parser above): [tag, attribute, address].
 * The content of a <meta http-equiv="refresh"> is "seconds; url=address" (the "url=" and quotes around the address
 * are optional): there the address is the part a browser would go to.
 */
function addressesOf(html) {
  const found = [];
  for (const tag of html.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s"'<>/=]+(?:="[^"]*")?)*)\s*\/?>/g)) {
    for (const attribute of tag[2].matchAll(/\s+(href|src|srcset|action|formaction|poster|data|value|content)="([^"]*)"/g)) {
      const value = decode(attribute[2]);
      const refresh = attribute[1] === 'content' ? /^\s*\d+\s*[;,]\s*(?:url\s*=\s*)?(.*)$/i.exec(value) : null;
      found.push([tag[1], attribute[1], refresh ? refresh[1].trim().replace(/^(['"])(.*)\1$/, '$2') : value]);
    }
  }
  return found;
}

test('the web version: no page of the site links to the root of the server (the owner, 2026-11-23)', () => {
  // The check itself: what leads to the root of the server, from where - and what does not. The builder has a check
  // of its own (serverRootAddresses; buildSite refuses a page that fails it) and reads every sample the same way.
  for (const [address, pageUrl] of [
    [`${SITE_URL}/`, SITE_BASE],
    [SITE_URL, SITE_BASE],
    [`${SITE_URL}/?lang=he`, `${SITE_BASE}he/`],
    [`${SITE_URL}/#/login`, SITE_BASE],
    [`${SITE_URL.replace('https:', 'http:')}/`, SITE_BASE],
    ['../', SITE_BASE],
    ['../../', `${SITE_BASE}he/`],
    ['../../../', `${SITE_BASE}he/faq/`],
    ['/', `${SITE_BASE}downloads/`],
    [`${SITE_URL}/`, MOVED_BASE],
  ]) {
    assert.ok(leadsToServerRoot(address, pageUrl), `${address} in ${pageUrl} leads to the web version`);
    assert.deepEqual(serverRootAddresses(`<a href="${address}">x</a>`, pageUrl, SITE_URL), [address], `the builder: ${address} in ${pageUrl} leads to the web version`);
  }
  for (const [address, pageUrl] of [
    ['./', SITE_BASE],
    ['../', `${SITE_BASE}he/`],
    ['../downloads/', `${SITE_BASE}faq/`],
    [`${SITE_URL}/${SITE_ID}/`, SITE_BASE],
    [`${SITE_URL}/support/`, SITE_BASE],
    [`${SITE_URL}/delete-account/he/`, `${SITE_BASE}he/faq/`],
    [`${SITE_URL}/privacy/`, `${SITE_BASE}privacy/`],
    ['#contact', SITE_BASE],
    [CONTACT_ACTION, SITE_BASE],
    ['mailto:help@example.test', SITE_BASE],
    ['../', `${MOVED_BASE}he/`],
    [MOVED_BASE, MOVED_BASE],
  ]) {
    assert.ok(!leadsToServerRoot(address, pageUrl), `${address} in ${pageUrl} does not lead to the web version`);
    assert.deepEqual(serverRootAddresses(`<a href="${address}">x</a>`, pageUrl, SITE_URL), [], `the builder: ${address} in ${pageUrl} does not lead to the web version`);
  }
  // It catches the three links the pages held until 2026-11-23: the first button of the home page, the link of the
  // answer about the browser and the link of the Downloads page - and the link of a legal document to the server.
  const old = [
    `<p class="actions"><a class="btn primary" href="${SITE_URL}/"><span>Open in your browser</span></a></p>`,
    `<p>Yes. <a href="${SITE_URL}/">Open the web version</a> in any modern browser.</p>`,
    `<p>Nothing to install. <a href="${SITE_URL}/">Open it in your browser</a>.</p>`,
    `<li>the <strong>website</strong> <a href="${SITE_URL}" dir="ltr">${SITE_URL}</a>.</li>`,
  ];
  for (const html of old) {
    assert.equal(addressesOf(html).filter(([, , address]) => leadsToServerRoot(address, SITE_BASE)).length, 1, html);
    assert.equal(serverRootAddresses(html, SITE_BASE, SITE_URL).length, 1, `the builder: ${html}`);
  }
  // A redirect is an address too: the content of a <meta http-equiv="refresh"> names where the browser goes by itself.
  // Both checks read it, in the forms a browser accepts, and leave alone a redirect to another place and a content
  // that is no redirect.
  for (const [html, count] of [
    [`<meta http-equiv="refresh" content="0; url=${SITE_URL}/">`, 1],
    [`<meta http-equiv="refresh" content="0;URL='${SITE_URL}/'">`, 1],
    [`<meta http-equiv="refresh" content="3; ${SITE_URL}">`, 1],
    ['<meta http-equiv="refresh" content="0, ../">', 1],
    ['<meta http-equiv="refresh" content="0; url=./downloads/">', 0],
    ['<meta name="viewport" content="width=device-width, initial-scale=1"><meta property="og:image:width" content="1024">', 0],
  ]) {
    assert.equal(addressesOf(html).filter(([, , address]) => leadsToServerRoot(address, SITE_BASE)).length, count, html);
    assert.equal(serverRootAddresses(html, SITE_BASE, SITE_URL).length, count, `the builder: ${html}`);
  }

  // The 160 pages as they are served today under <server>/about/, and the same pages at the root of a domain of the
  // owner: no element of any page holds an address that leads to the root of the server - no link, no button, no
  // form, no redirect.
  for (const [site, base] of [[real(), SITE_BASE], [movedSite(), MOVED_BASE]]) {
    assert.equal(site.pages.size, PAGE_COUNT);
    for (const { rel, html, dir } of pagesOf(site)) {
      const addresses = addressesOf(html);
      // The scan sees the page: at least the style sheet, the script, the logo, the menu and the language list.
      assert.ok(addresses.length >= 40, `${base}${rel}: the addresses of the page were read`);
      const toRoot = addresses.filter(([, , address]) => leadsToServerRoot(address, `${base}${dir}`)).map(([tag, name, address]) => `<${tag} ${name}="${address}">`);
      assert.deepEqual(toRoot, [], `${base}${rel}: an address leads to the web version at the root of the server - the site does not offer it`);
      assert.ok(!html.includes(`href="${SITE_URL}"`) && !html.includes(`href="${SITE_URL}/"`), `${base}${rel}: no link to ${SITE_URL}/`);
      // No page sends a visitor on by itself: there is no <meta http-equiv> at all (the character set is <meta charset>).
      assert.ok(!/http-equiv/i.test(html), `${base}${rel}: no <meta http-equiv>, so no redirect`);
      assert.deepEqual(serverRootAddresses(html, `${base}${dir}`, SITE_URL), [], `${base}${rel}: the builder's own check finds no such address either`);
    }
  }
  // (That buildSite refuses a page with such an address, and --check with it, is shown on a fixture tree: the test
  // "fixture tree: a broken list, a broken document, a link to the web version ..." below.)
  // The same by the parsed pages: every <a> of every page leads somewhere else - into the site, or to one of the
  // two documents outside it (the support page, the account-deletion page) - never to "/". A store link, once
  // site/settings.json names one (none today), leads to the store itself: this rule has nothing to say about it.
  const stores = storeHosts(readSiteSettings());
  const paths = new Set();
  for (const { rel, dir } of pagesOf(real())) {
    for (const link of parsed(rel).all('a')) {
      const url = new URL(link.attrs.href, `${SITE_BASE}${dir}`);
      if (url.protocol === 'mailto:' || stores.includes(url.host)) continue;
      assert.equal(url.host, SERVER_HOST, `${rel}: ${link.attrs.href}`);
      assert.notEqual(url.pathname, '/', `${rel}: <a href="${link.attrs.href}"> opens the web version`);
      paths.add(url.pathname.split('/')[1]);
    }
  }
  assert.deepEqual([...paths].sort(), [SITE_ID, 'delete-account', 'support'], 'the links of the pages lead into the site, to the support page and to the deletion page');
});

test('the web version: no text, key or link target of the site offers it, in any of the 20 languages (the owner, 2026-11-23)', () => {
  // The builder knows no such thing any more: no link target, no key of the hero, no key of the Downloads page.
  assert.deepEqual(LINK_TARGETS, ['privacy', 'terms', 'faq', 'downloads', 'home', 'support', 'delete', 'contact']);
  assert.ok(!LINK_TARGETS.includes('webapp'), 'there is no link target for the web version');
  assert.deepEqual(Object.keys(CONTENT_SCHEMA.hero), ['heading', 'lead', 'note'], 'the hero has no text for a button that opens the web version');
  assert.ok(!('web' in CONTENT_SCHEMA.downloads) && !('openAction' in CONTENT_SCHEMA.hero));
  // Under the tabs: only the iPhone section of the App Store link (its heading and its sentence). The note that stood
  // there while no link is set (downloads.iphone) is gone - the owner, 2026-11-24.
  assert.deepEqual(Object.keys(CONTENT_SCHEMA.downloads).slice(-4), ['checkText', 'moreHeading', 'iphoneStore', 'storeLinks'], 'under the tabs: the heading and the sentence of the App Store link');
  assert.ok(!('iphone' in CONTENT_SCHEMA.downloads), 'the Downloads page has no note about the iPhone');
  // A content file that brings one of them back is refused: as the English file, and as a translation of it.
  const base = english();
  const broken = (change, against = base) => {
    const copy = structuredClone(base);
    change(copy);
    return contentProblems(copy, against);
  };
  assert.deepEqual(broken((c) => { c.hero.openAction = 'Open in your browser'; }), ['unknown key hero.openAction']);
  assert.deepEqual(broken((c) => { c.hero.openAction = 'Open in your browser'; }, null), ['unknown key hero.openAction']);
  assert.deepEqual(broken((c) => { c.downloads.web = 'Nothing to install: {{BRAND}} also works in any modern browser.'; }), ['unknown key downloads.web']);
  assert.deepEqual(broken((c) => { c.downloads.web = 'Nothing to install.'; }, null), ['unknown key downloads.web']);
  assert.deepEqual(broken((c) => { c.downloads.iphone = 'There is no installation file for iPhone: the iPhone app is installed from the App Store.'; }), ['unknown key downloads.iphone']);
  assert.deepEqual(broken((c) => { c.downloads.iphone = 'There is no installation file for iPhone.'; }, null), ['unknown key downloads.iphone']);
  const linked = (c) => { c.faq.items[0].a = `${c.faq.items[0].a} [[webapp|Open the web version]].`; };
  assert.deepEqual(broken(linked, null), ['faq.items.0.a unknown link target [[webapp|...]] (the targets: privacy, terms, faq, downloads, home, support, delete, contact)']);
  assert.deepEqual(broken(linked), [
    'faq.items.0.a unknown link target [[webapp|...]] (the targets: privacy, terms, faq, downloads, home, support, delete, contact)',
    'faq.items.0.a must hold exactly the links of the English text (none); found [[webapp|...]]',
  ]);
  assert.match(broken((c) => { c.faq.items.splice(17, 0, { q: 'Can I use it in a browser, without installing anything?', a: 'Yes. Open the web version in any modern browser, on a computer or a phone, and sign in with the same account.' }); })[0], /^faq\.items must have 29 items \(found 30\)$/);

  // The 20 files, by their structure: no such key, no such link, 29 questions; the heading of the iPhone section names
  // the iPhone only, and (2026-11-24) the Downloads page has no note about the iPhone and its lead does not name it.
  assert.deepEqual(Object.keys(WEB_VERSION_WORDS).sort(), [...CODES].sort(), 'the table has a row for every app locale');
  for (const code of CODES) {
    const raw = readFileSync(contentFile(ROOT, code), 'utf8');
    const content = JSON.parse(raw);
    const leaves = leavesOf(content);
    assert.ok(!raw.includes('[[webapp|') && !raw.includes('webapp'), `${code}: no [[webapp|...]] link`);
    assert.ok(!raw.includes('openAction'), `${code}: no hero.openAction`);
    assert.deepEqual(Object.keys(content.hero), ['heading', 'lead', 'note'], `${code}: the texts of the hero`);
    assert.ok(!('web' in content.downloads), `${code}: no downloads.web`);
    assert.equal(content.faq.items.length, 29, `${code}: 29 questions`);
    assert.equal(content.downloads.moreHeading, 'iPhone', `${code}: the heading under the tabs names the iPhone, and nothing else`);
    assert.ok(!('iphone' in content.downloads), `${code}: no downloads.iphone - the note about the iPhone is gone`);
    assert.ok(!content.downloads.lead.includes('iPhone'), `${code}: the lead of the Downloads page does not name the iPhone`);
    // No link of any text leads anywhere but to the eight targets.
    for (const [where, text] of leaves) for (const target of linkTargetsOf(text)) assert.ok(LINK_TARGETS.includes(target), `${code} ${where}: [[${target}|...]]`);

    // By the words of the language: "browser" only where a file is downloaded or installed, "the web version" nowhere.
    const { browser, webVersion } = WEB_VERSION_WORDS[code];
    assert.ok(browser.length >= 1 && webVersion.length >= 1 && [...browser, ...webVersion].every((word) => word.trim().length >= 3), `${code}: a word for "browser" and a word for "the web version"`);
    const textsWith = (words) => [...leaves].filter(([, text]) => words.some((word) => text.toLowerCase().includes(word.toLowerCase()))).map(([where]) => where);
    assert.deepEqual(textsWith(browser), BROWSER_TEXTS, `${code}: "${browser.join('", "')}" stands in the three texts about downloading and installing a file, and in no other - a visitor is not told that the diary can be used in a browser`);
    assert.deepEqual(textsWith(webVersion), [], `${code}: "${webVersion.join('", "')}" is back - the site does not offer the web version`);
  }

  // The English texts, word for word: the sentences that named the browser or the web version, as they read now.
  const en = english();
  assert.ok(en.faq.items[0].a.endsWith(' It runs as an app for Windows, Mac, Android and iPhone, with one account for all of them.'), 'What is it: it runs as an app');
  assert.ok(en.faq.items[3].a.startsWith('A computer with Windows 10 or 11, a Mac with macOS 12.3 or later, an Android phone with Android 7.0 or later, or an iPhone with iOS 16 or later. The installation files are on the [[downloads|Downloads]] page.'), 'Which devices: four, and the Downloads page');
  assert.ok(en.faq.items[6].a.endsWith(' In the Windows, Mac and iPhone apps you need an account; creating one is free.'), 'Without an account: the three apps that need one');
  assert.ok(en.faq.items[8].a.includes('a reminder arrives even when the app is closed; on a computer it appears while the diary is open. Reminders are created on the device itself'), 'Reminders: on a computer');
  assert.equal(en.faq.items[16].q, 'What happens if I change the same entry on two devices?');
  assert.equal(en.faq.items[17].q, 'What does "Remember me" do?', 'the question about the browser stood between these two');
  assert.equal(en.faq.items[18].a, 'In your own account on the {{BRAND}} server, in a separate encrypted file for each account. The server runs at the hosting provider Fly.io, in its data centre in Frankfurt, Germany. The apps all show this one diary. The [[privacy|Privacy Policy]] says exactly what is stored and where.');
  assert.equal(en.faq.items[21].a, 'No. There is no advertising, no analytics and no tracking, in the apps or on this site. We do not sell or share your data, and your diary is never used to train any AI. The apps connect only to the {{BRAND}} server, always over HTTPS.');
  assert.equal(en.downloads.lead, 'Installation files of {{BRAND}} for Windows, Android and Mac. One account works in all of them.');
  assert.equal(en.downloads.moreHeading, 'iPhone');
  // What stays: the short privacy list still names the website (the web version exists, and the site is one too).
  assert.equal(en.privacy.items[2], 'The apps and the website connect only to the {{BRAND}} server, always over HTTPS.');
  // The rule in English words, over every English text. ("Your browser may first warn ..." and "allow your browser
  // or file manager to install apps" are about a downloaded file and stay.)
  const RULE = [/\bweb (?:version|app)\b/i, /\bweb-?app\b/i, /\bin (?:a|any|the|your)(?: modern)? browser\b/i, /\bany modern browser\b/i, /\bwithout installing\b/i, /\bnothing to install\b/i, /\bopen (?:it )?in (?:a|the|your) browser\b/i, /\band the browser\b/i];
  for (const [where, text] of leavesOf(en)) for (const re of RULE) assert.ok(!re.test(text), `${where}: ${re} matches "${text}"`);
  for (const sample of [
    'Open in your browser',
    'It runs in a browser and as an app for Windows, Mac, Android and iPhone, with one account for all of them.',
    'an iPhone with iOS 16 or later, and any modern browser on a computer or a phone.',
    'In the Windows, Mac and iPhone apps and in the browser you need an account; creating one is free.',
    'on a computer and in the browser it appears while the diary is open.',
    'Can I use it in a browser, without installing anything?',
    'Yes. Open the web version in any modern browser, on a computer or a phone, and sign in with the same account.',
    'The apps and the browser all show this one diary.',
    'There is no advertising, no analytics and no tracking, in the apps, in the web version or on this site.',
    'One account works in all of them, in the iPhone app and in the browser.',
    'Nothing to install: Your Personal Diary also works in any modern browser, on a computer or a phone. Open it in your browser.',
  ]) {
    assert.ok(RULE.some((re) => re.test(sample)), `the rule catches: ${sample}`);
  }
  for (const where of BROWSER_TEXTS) assert.ok(/\byour browser\b/i.test(leavesOf(en).get(where)) && !RULE.some((re) => re.test(leavesOf(en).get(where))), `${where}: the browser that downloads or installs the file stays`);
  // The Hebrew texts, as the owner reads them.
  const he = contentOf('he');
  assert.ok(he.faq.items[0].a.endsWith(' היא פועלת כאפליקציה ל-Windows, ל-Mac, ל-Android ול-iPhone, עם חשבון אחד לכולם.'));
  assert.ok(he.faq.items[3].a.startsWith('מחשב עם Windows 10 או 11, Mac עם macOS 12.3 ואילך, טלפון Android עם Android 7.0 ואילך, או iPhone עם iOS 16 ואילך. '));
  assert.ok(he.faq.items[18].a.includes(' האפליקציות מציגות כולן את אותו יומן. '));
  assert.equal(he.downloads.lead, 'קובצי התקנה של {{BRAND}} ל-Windows, ל-Android ול-Mac. חשבון אחד עובד בכולם.');
});

test('the web version: the pages of all 20 languages - two actions on the home page, 29 questions, nothing under the tabs of the Downloads page', () => {
  for (const l of LOCALES) {
    const content = contentOf(l.code);
    // The home page: Downloads first, as the primary button, then About the app. Both lead into the site.
    const homeRel = pageFile('home', l.code);
    const home = parsed(homeRel);
    const homeDir = siteDir('home', l.code);
    const buttons = home.inside(home.all('main')[0], 'a');
    assert.deepEqual(
      buttons.map((el) => [el.attrs.class, resolveAddress(homeDir, el.attrs.href), home.textOf(el)]),
      [['btn primary', siteDir('downloads', l.code), content.nav.downloads], ['btn', siteDir('about', l.code), content.nav.about]],
      `${homeRel}: the links of the home page are "Downloads" (the primary button) and "About the app"`,
    );
    // The Questions page: 29 questions, and none of them is the one about the browser.
    const faqRel = pageFile('faq', l.code);
    const faq = parsed(faqRel);
    assert.equal(faq.all('details').length, 29, `${faqRel}: 29 questions`);
    assert.deepEqual(faq.all('section').filter((el) => hasClass(el, 'group')).map((group) => faq.inside(group, 'details').length), [7, 7, 4, 5, 4, 2], `${faqRel}: the questions of the six groups`);
    assert.deepEqual(faq.all('summary').map((el) => faq.textOf(el)), content.faq.items.map((item) => plain(item.q, l)), `${faqRel}: the questions of the content file, in order`);
    // The Downloads page: it ends with the tabs, and nothing on it names the iPhone - an iPhone owner has nothing to
    // download yet, and the owner had the note that stood under the tabs deleted (2026-11-24). (This is the page
    // while site/settings.json names no App Store link, as today. With that link set, a section with the heading
    // "iPhone", the sentence downloads.iphoneStore and the button of the App Store stands under the tabs - the test
    // "downloads: a store link that is set ..." describes that page - and the checks below must then expect it.)
    const downloadsRel = pageFile('downloads', l.code);
    const downloads = parsed(downloadsRel);
    assert.deepEqual(downloads.all('section').filter((el) => hasClass(el, 'more')), [], `${downloadsRel}: no section under the tabs (while no App Store link is set)`);
    const downloadsMain = downloads.all('main')[0];
    assert.ok(!downloads.textOf(downloadsMain).includes('iPhone'), `${downloadsRel}: the page does not name the iPhone (while no App Store link is set)`);
    assert.deepEqual(downloads.inside(downloadsMain, 'section').map((el) => el.attrs.class), ['panel', 'panel', 'panel'], `${downloadsRel}: the three panels of the tabs are the only sections of the page`);
    // "Nothing under the tabs" in full: the page is the heading, the lead and the tabs - no further paragraph either.
    const downloadsWrap = downloads.inside(downloadsMain, 'div').find((el) => hasClass(el, 'wrap') && hasClass(el, 'page'));
    assert.ok(downloadsWrap, `${downloadsRel}: the page wrap`);
    assert.deepEqual(downloads.children(downloadsWrap).map((el) => `${el.tag}${el.attrs.class ? `.${el.attrs.class}` : ''}${el.attrs.id ? `#${el.attrs.id}` : ''}`), ['h1', 'p.lead', 'div.tabs#platforms'], `${downloadsRel}: the heading, the lead and the tabs - nothing after them (while no App Store link is set)`);
  }
});

test('contentProblems: what the builder refuses in a content file', () => {
  const base = english();
  const broken = (change) => {
    const copy = structuredClone(base);
    change(copy);
    return contentProblems(copy, base);
  };
  const marked = (keys) => ({ [MARKER_KEY]: { marker: UNTRANSLATED_MARKER, keys }, ...base });
  assert.deepEqual(contentProblems(base), []);
  // The marker.
  assert.deepEqual(contentProblems(marked('all'), base), [], 'an English copy with the marker is a valid translation-to-be');
  assert.deepEqual(contentProblems(marked(['nav.about', 'faq.items.7.q']), base), [], 'single keys that wait');
  assert.deepEqual(contentProblems(marked('all')), [`"${MARKER_KEY}" does not belong in the English file`]);
  assert.match(contentProblems({ [MARKER_KEY]: UNTRANSLATED_MARKER, ...base }, base)[0], /"_status" must be \{ "marker": "TODO-TRANSLATE", "keys": "all" \} or/);
  assert.match(contentProblems({ [MARKER_KEY]: { marker: 'done', keys: 'all' }, ...base }, base)[0], /"_status" must be/);
  assert.match(contentProblems({ [MARKER_KEY]: { marker: UNTRANSLATED_MARKER, keys: 'all', note: 'x' }, ...base }, base)[0], /"_status" must be/);
  assert.match(contentProblems(marked([]), base)[0], /"_status" must be/);
  assert.deepEqual(contentProblems(marked(['nav.about', 'nav.nothing']), base), ['"_status" lists "nav.nothing", which is not a text of the file (write keys like nav.about or faq.items.7.q)']);
  assert.deepEqual(contentProblems(marked(['nav', 'faq.items.29.q']), base).length, 2, 'a group and a question that does not exist are not texts');
  assert.deepEqual(contentProblems(marked(['faq.items.28.q']), base), [], 'the last question is faq.items.28');
  assert.deepEqual(contentProblems(marked(['nav.about', 'nav.about']), base), ['"_status" lists nav.about twice']);
  // Keys and lists.
  assert.deepEqual(broken((c) => { delete c.hero.lead; }), ['hero.lead is missing']);
  assert.deepEqual(broken((c) => { c.hero.extra = 'x'; }), ['unknown key hero.extra']);
  assert.deepEqual(broken((c) => { c.get = { heading: 'Get the app' }; }), ['unknown key get'], 'a key of version 1 that no page uses any more');
  assert.match(broken((c) => { c.features.items.pop(); })[0], /features\.items must have 8 items \(found 7\)/);
  assert.match(broken((c) => { c.faq.items.push({ q: 'Q', a: 'A' }); })[0], /faq\.items must have 29 items \(found 30\)/);
  assert.match(broken((c) => { c.faq.items.pop(); })[0], /faq\.items must have 29 items \(found 28\)/);
  assert.match(broken((c) => { c.faq.groups.pop(); })[0], /faq\.groups must have 6 items \(found 5\)/);
  assert.match(broken((c) => { c.privacy.items.pop(); })[0], new RegExp(`privacy\\.items must have ${base.privacy.items.length} items`));
  assert.deepEqual(broken((c) => { c.privacy.items = 'one text'; }), ['privacy.items must be a list']);
  assert.deepEqual(contentProblems([], base), ['the file must be an object']);
  // Texts.
  assert.deepEqual(broken((c) => { c.skipLink = '  '; }), ['skipLink is empty']);
  assert.deepEqual(broken((c) => { c.skipLink = 7; }), ['skipLink must be a text']);
  assert.deepEqual(broken((c) => { c.hero.note = ' padded'; }), ['hero.note starts or ends with a space']);
  assert.deepEqual(broken((c) => { c.hero.note = 'A <b>bold</b> claim'; }), ['hero.note may not contain < or > (plain text only, no HTML)']);
  assert.match(broken((c) => { c.hero.note = 'two\nlines'; })[0], /hero\.note contains a line break/);
  // Placeholders.
  assert.match(broken((c) => { c.hero.lead = c.hero.lead.replace('{{BRAND}}', 'Your Personal Diary'); })[0], /hero\.lead must use exactly the placeholders of the English text \(\{\{BRAND\}\}\); found none/);
  assert.match(broken((c) => { c.hero.note = 'By {{PUBLISHER}}'; }).join('\n'), /hero\.note unknown placeholder \{\{PUBLISHER\}\}/);
  assert.match(broken((c) => { c.hero.lead = c.hero.lead.replace('{{BRAND}}', '{{BRAND}'); }).join('\n'), /hero\.lead broken placeholder/);
  assert.match(broken((c) => { c.hero.note = 'Write to {{CONTACT_EMAIL}}'; }).join('\n'), /hero\.note may not use \{\{CONTACT_EMAIL\}\}/);
  assert.match(broken((c) => { c.faq.items[26].a = 'You must be 16.'; })[0], /faq\.items\.26\.a must use exactly the placeholders of the English text \(\{\{MINIMUM_AGE\}\}\); found none/);
  // Links: only where the schema allows them, only the known targets, the same targets as English.
  assert.match(broken((c) => { c.hero.note = 'See the [[privacy|policy]]'; }).join('\n'), /hero\.note may not hold a link/);
  assert.match(broken((c) => { c.contact.notice = 'More in the [[policy|Privacy Policy]].'; }).join('\n'), /contact\.notice unknown link target \[\[policy\|\.\.\.\]\]/);
  // "webapp" was a target until 2026-11-23 (the web version); it is refused like any other unknown one.
  assert.match(broken((c) => { c.contact.notice = 'More in the [[privacy|Privacy Policy]], or [[webapp|open the diary]].'; }).join('\n'), /contact\.notice unknown link target \[\[webapp\|\.\.\.\]\] \(the targets: privacy, terms, faq, downloads, home, support, delete, contact\)/);
  assert.match(broken((c) => { c.contact.notice = 'More in the Privacy Policy.'; })[0], /contact\.notice must hold exactly the links of the English text \(\[\[privacy\|\.\.\.\]\]\); found none/);
  assert.match(broken((c) => { c.contact.notice = 'More in the [[terms|Terms of Use]].'; })[0], /contact\.notice must hold exactly the links of the English text \(\[\[privacy\|\.\.\.\]\]\); found \[\[terms\|\.\.\.\]\]/);
  assert.match(broken((c) => { c.contact.notice = 'More in the [[privacy|Privacy Policy].'; }).join('\n'), /contact\.notice broken link/);
  assert.match(broken((c) => { c.contact.notice = 'More in the [[privacy| Privacy Policy]].'; }).join('\n'), /the link text of \[\[privacy\|\.\.\.\]\] starts or ends with a space/);
  assert.deepEqual(broken((c) => { c.contact.notice = 'En savoir plus : [[privacy|politique de confidentialité]].'; }), [], 'the link text is translated, the target stays');
  // The schema and the flattened English file name the same texts.
  assert.deepEqual([...flattenContent(base).keys()], [...leavesOf(base).keys()]);
  assert.deepEqual(Object.keys(base), Object.keys(CONTENT_SCHEMA));
  assert.deepEqual(Object.keys(CONTENT_SCHEMA), ['title', 'description', 'skipLink', 'languagesLabel', 'nav', 'hero', 'features', 'screens', 'privacy', 'faq', 'downloads', 'contact', 'footer']);
});

// ---------------------------------------------------------------------------------------------
// site/settings.json, the addresses, site/downloads.json
// ---------------------------------------------------------------------------------------------

test('settings: the base address, the copyright year and the four store links', () => {
  const withLink = (key, value) => ({ ...SITE_SETTINGS, links: { ...NO_LINKS, [key]: value } });
  assert.deepEqual(siteSettingsProblems(SITE_SETTINGS), [], 'null = the fixed server, and no store has published the app');
  assert.deepEqual(readSiteSettings(), SITE_SETTINGS, 'the real file: no domain yet, nothing is published yet');
  // The base address of the site.
  for (const good of ['https://example.org/', 'https://www.example.org/diary/', 'https://xn--mnchen-3ya.example/']) assert.deepEqual(siteSettingsProblems({ ...SITE_SETTINGS, siteBaseUrl: good }), [], good);
  for (const [bad, reason] of [
    ['http://example.org/', /"siteBaseUrl" must start with https:\/\//],
    ['https://example.org', /"siteBaseUrl" must be written as https:\/\/example\.org\//],
    ['https://example.org/diary', /"siteBaseUrl" must end with \//],
    ['https://example.org/?x=1', /"siteBaseUrl" may not carry a query or a fragment/],
    ['https://example.org/#top', /"siteBaseUrl" may not carry a query or a fragment/],
    ['https://user:secret@example.org/', /may not carry a user name/],
    ['https://example.org:8443/', /may not carry a user name, a password or a port/],
    ['https://EXAMPLE.org/', /"siteBaseUrl" must be written as https:\/\/example\.org\//],
    ['example.org/', /"siteBaseUrl" is not a link/],
    ['', /"siteBaseUrl" must be null/],
    [42, /"siteBaseUrl" must be null/],
  ]) {
    assert.match(siteSettingsProblems({ ...SITE_SETTINGS, siteBaseUrl: bad }).join('; '), reason, String(bad));
  }
  assert.equal(siteBaseOf(SITE_SETTINGS, SITE_URL), SITE_BASE);
  assert.equal(siteBaseOf({ ...SITE_SETTINGS, siteBaseUrl: 'https://example.org/' }, SITE_URL), 'https://example.org/');
  // The copyright year.
  for (const bad of [2025, 2101, '2026', 2026.5, null]) assert.deepEqual(siteSettingsProblems({ ...SITE_SETTINGS, copyrightYear: bad }), ['"copyrightYear" must be a year from 2026 to 2100'], String(bad));
  assert.deepEqual(siteSettingsProblems({ ...SITE_SETTINGS, copyrightYear: 2027 }), []);
  // The store links: https only, the store's own host.
  const good = {
    googlePlay: 'https://play.google.com/store/apps/details?id=app.yourpersonaldiary',
    appStoreIphone: 'https://apps.apple.com/app/id1234567890',
    appStoreMac: 'https://apps.apple.com/app/id1234567891?mt=12',
    microsoftStore: 'https://apps.microsoft.com/detail/9NBLGGH4R315',
  };
  assert.deepEqual(siteSettingsProblems({ ...SITE_SETTINGS, links: good }), []);
  assert.deepEqual(siteSettingsProblems(withLink('microsoftStore', 'https://www.microsoft.com/store/apps/9NBLGGH4R315')), []);
  for (const [key, value] of [
    ['googlePlay', 'https://example.com/store/apps/details?id=app.yourpersonaldiary'],
    ['googlePlay', 'https://play.google.com.example.net/store/apps/details?id=x'],
    ['googlePlay', 'https://apps.apple.com/app/id1234567890'],
    ['appStoreIphone', 'https://play.google.com/store/apps/details?id=x'],
    ['appStoreMac', 'https://apple.com/app/id1'],
    ['microsoftStore', 'https://microsoft.com/store/apps/9NBLGGH4R315'],
    ['microsoftStore', `${SITE_URL}/download/setup.exe`],
  ]) {
    assert.match(siteSettingsProblems(withLink(key, value)).join('; '), new RegExp(`^"links\\.${key}" must point to `), `${key} = ${value}`);
  }
  for (const value of ['http://play.google.com/store/apps/details?id=x', 'ftp://play.google.com/x', 'javascript:alert(1)', '//play.google.com/store']) {
    assert.match(siteSettingsProblems(withLink('googlePlay', value)).join('; '), /must start with https:\/\/|is not a link/, value);
  }
  assert.match(siteSettingsProblems(withLink('googlePlay', 'https://play.google.com/"onclick="x'))[0], /may not contain spaces, quotes/);
  assert.match(siteSettingsProblems(withLink('googlePlay', ''))[0], /must be null \(not published yet\) or a link/);
  // The shape of the file.
  assert.deepEqual(siteSettingsProblems(null), ['not a JSON object']);
  assert.deepEqual(siteSettingsProblems({}), ['"siteBaseUrl" is missing', '"copyrightYear" is missing', '"links" is missing']);
  assert.deepEqual(siteSettingsProblems({ ...SITE_SETTINGS, links: 'none' }), ['"links" must be an object with the four store links']);
  assert.deepEqual(siteSettingsProblems({ ...SITE_SETTINGS, links: { ...NO_LINKS, amazon: null }, direct: 'x' }), ['unknown key "direct"', 'unknown key "links.amazon"']);
  const { microsoftStore: _omit, ...three } = NO_LINKS;
  assert.deepEqual(siteSettingsProblems({ ...SITE_SETTINGS, links: three }), ['"links.microsoftStore" is missing (null = not published yet)']);
  assert.deepEqual(storeHosts(SITE_SETTINGS), []);
  assert.deepEqual(storeHosts({ ...SITE_SETTINGS, links: good }).sort(), ['apps.apple.com', 'apps.microsoft.com', 'play.google.com']);
  // Every store link belongs to a platform of the Downloads page (or to the iPhone section that its link brings) and has its link text.
  for (const [key, link] of Object.entries(STORE_LINKS)) {
    assert.ok([...PLATFORMS, 'iphone'].includes(link.platform), key);
    assert.equal(typeof english().downloads.storeLinks[key], 'string');
  }
});

test('addresses: eight pages per language, English without a folder, every address relative', () => {
  // The home page is a page of its own since 2026-11-22; "About the app" moved to app/.
  assert.deepEqual(SITE_PAGES.map((p) => [p.id, p.dir]), [['home', ''], ['about', 'app/'], ['terms', 'terms/'], ['faq', 'faq/'], ['privacy', 'privacy/'], ['downloads', 'downloads/'], ['sent', 'contact/sent/'], ['error', 'contact/error/']]);
  assert.equal(SITE_PAGES.length, 8);
  assert.equal(new Set(SITE_PAGES.map((p) => p.dir)).size, 8, 'every page has a folder of its own');
  // No page folder can be taken for the folder of a language (app/ next to he/, ar/, ...).
  for (const p of SITE_PAGES) assert.ok(!CODES.includes(p.dir.split('/')[0]), `${p.id}: ${p.dir} is not a language code`);
  assert.deepEqual(SITE_PAGES.filter((p) => !p.contact).map((p) => p.id), ['sent', 'error'], 'the two result pages have no contact block');
  assert.deepEqual(SITE_PAGES.filter((p) => p.noindex).map((p) => p.id), ['sent', 'error']);
  assert.deepEqual(SITE_PAGES.filter((p) => p.legal).map((p) => [p.id, p.legal]), [['terms', 'terms'], ['privacy', 'privacy']]);
  assert.deepEqual(MENU.map(([id, key]) => `${id}:${key}`), ['home:home', 'about:about', 'terms:terms', 'faq:faq', 'privacy:privacy', 'downloads:downloads']);
  // Every item of the menu is a page, in the order of the pages, and has its text in nav.*.
  assert.deepEqual(MENU.map(([id]) => id), SITE_PAGES.filter((p) => p.contact).map((p) => p.id), 'the menu: every page but the two result pages, in page order');
  for (const [, key] of MENU) assert.equal(typeof english().nav[key], 'string', `nav.${key}`);
  assert.equal(siteDir('home', 'en'), '');
  assert.equal(siteDir('about', 'en'), 'app/');
  assert.equal(siteDir('terms', 'en'), 'terms/');
  assert.equal(siteDir('home', 'he'), 'he/');
  assert.equal(siteDir('about', 'he'), 'he/app/');
  assert.equal(siteDir('sent', 'he'), 'he/contact/sent/');
  assert.equal(pageFile('home', 'en'), 'index.html');
  assert.equal(pageFile('about', 'en'), 'app/index.html');
  assert.equal(pageFile('about', 'ja'), 'ja/app/index.html');
  assert.equal(pageFile('error', 'ar'), 'ar/contact/error/index.html');
  assert.throws(() => siteDir('app', 'en'), /unknown page app/, 'a page is named by its id, not by its folder');
  assert.throws(() => siteDir('nothing', 'en'), /unknown page nothing/);
  for (const [from, to, want] of [
    ['', '', './'],
    ['', 'app/', './app/'],
    ['app/', '', '../'],
    ['app/', 'he/app/', '../he/app/'],
    ['he/app/', 'he/', '../'],
    ['he/app/', 'app/', '../../app/'],
    ['he/app/', 'img/he/phone-home.png', '../../img/he/phone-home.png'],
    ['he/contact/sent/', 'he/app/', '../../app/'],
    ['', 'terms/', './terms/'],
    ['', 'he/', './he/'],
    ['', 'site.css', './site.css'],
    ['terms/', '', '../'],
    ['terms/', 'terms/', './'],
    ['terms/', 'faq/', '../faq/'],
    ['terms/', 'he/terms/', '../he/terms/'],
    ['he/', '', '../'],
    ['he/', 'ar/', '../ar/'],
    ['he/terms/', 'he/', '../'],
    ['he/terms/', 'he/faq/', '../faq/'],
    ['he/terms/', 'terms/', '../../terms/'],
    ['he/terms/', 'site.css', '../../site.css'],
    ['he/contact/sent/', 'he/', '../../'],
    ['he/contact/sent/', 'contact/sent/', '../../../contact/sent/'],
    ['contact/error/', 'img/icon.svg', '../../img/icon.svg'],
    ['he/downloads/', 'files/a.exe', '../../files/a.exe'],
  ]) {
    assert.equal(relativeHref(from, to), want, `${from || '(top)'} -> ${to || '(top)'}`);
    assert.equal(resolveAddress(from, want), to, 'and back');
  }
});

test('downloads list: the shape of site/downloads.json, the newest version first, sizes in megabytes', () => {
  const list = fixtureDownloads();
  assert.deepEqual(downloadsProblems(list), []);
  assert.deepEqual(PLATFORMS, ['windows', 'android', 'mac'], 'the order of the tabs');
  const row = list.windows[0];
  const change = (platform, rows) => downloadsProblems({ ...list, [platform]: rows });
  assert.deepEqual(downloadsProblems(null), ['not a JSON object']);
  assert.deepEqual(downloadsProblems({ windows: list.windows, android: list.android }), ['"mac" is missing']);
  assert.deepEqual(downloadsProblems({ ...list, iphone: [] }), ['unknown key "iphone"']);
  assert.deepEqual(change('mac', []), ['"mac" must be a list with at least one file']);
  assert.deepEqual(downloadsProblems({ ...list, mac: [] }, { allowEmpty: true }), [], 'add-download.mjs fills the lists one by one');
  assert.deepEqual(change('windows', ['x']), ['windows[0] must be an object']);
  assert.deepEqual(change('windows', [{ ...row, note: 'x' }]), ['unknown key windows[0].note']);
  const { date: _date, ...undated } = row;
  assert.deepEqual(change('windows', [undated]), ['windows[0].date is missing']);
  assert.deepEqual(change('windows', [{ ...row, version: '1.0' }]), ['windows[0].version must look like 1.0.0']);
  assert.deepEqual(change('windows', [{ ...row, date: '13.11.2026' }]), ['windows[0].date must look like 2026-11-13']);
  assert.deepEqual(change('windows', [{ ...row, date: '2026-02-30' }]), ['windows[0].date must look like 2026-11-13']);
  assert.deepEqual(change('windows', [{ ...row, file: 'Your Personal Diary.exe' }]), ['windows[0].file may hold only ASCII letters, digits, dots and hyphens']);
  assert.deepEqual(change('windows', [{ ...row, file: '../setup.exe' }]), ['windows[0].file may hold only ASCII letters, digits, dots and hyphens']);
  assert.deepEqual(change('windows', [{ ...row, file: 'setup.msi' }]), ['windows[0].file must end with .exe']);
  assert.deepEqual(change('android', [{ ...list.android[0], file: 'app.exe' }]), ['android[0].file must end with .apk']);
  assert.deepEqual(change('windows', [{ ...row, bytes: 0 }]), ['windows[0].bytes must be the size of the file in bytes']);
  assert.deepEqual(change('windows', [{ ...row, sha256: row.sha256.toUpperCase() }]), ['windows[0].sha256 must be 64 lower-case hexadecimal digits']);
  // Newest first, each version once, each file name once.
  const older = { ...row, version: '0.9.0', file: 'YourPersonalDiary-0.9.0-windows-x64-setup.exe' };
  assert.deepEqual(change('windows', [row, older]), []);
  assert.match(change('windows', [older, row])[0], /"windows": 1\.0\.0 stands after 0\.9\.0 - the newest version comes first/);
  assert.match(change('windows', [row, { ...row, file: 'Other-1.0.0.exe' }])[0], /1\.0\.0 stands after 1\.0\.0/);
  assert.deepEqual(change('windows', [row, { ...older, file: row.file.toUpperCase().replace('.EXE', '.exe') }]), ['windows[1].file repeats windows[0]']);
  assert.ok(compareVersions('1.10.0', '1.9.9') > 0 && compareVersions('1.0.0', '1.0.0') === 0 && compareVersions('0.9.9', '1.0.0') < 0);
  // The file is written one row per line and read back unchanged.
  const text = formatDownloads(list);
  assert.deepEqual(JSON.parse(text), list);
  assert.equal(text.split('\n').length, 12, 'one row per line');
  assert.equal(formatDownloads({ windows: [], android: [], mac: [] }), '{\n  "windows": [],\n  "android": [],\n  "mac": []\n}\n');
  // Megabytes with one decimal, in the form of the language.
  assert.equal(megabytes(2817354, 'en-GB'), '2.7 MB');
  assert.equal(megabytes(6189146, 'de-DE'), '5,9 MB');
  assert.equal(megabytes(1024 * 1024, 'en-GB'), '1.0 MB');
  assert.equal(megabytes(15 * 1024 * 1024 + 1, 'en-GB'), '15.0 MB');
  for (const l of LOCALES) assert.match(megabytes(6497114, l.intl), /^6[.,٫]2\s\S+$/u, `${l.code}: one decimal and a unit`);
});

test('downloads list: the real site/downloads.json lists the installers that are in site/downloads/', () => {
  const list = readDownloads();
  assert.equal(readFileSync(path.join(ROOT, DOWNLOADS_FILE), 'utf8'), formatDownloads(list), 'the file is written as add-download.mjs writes it');
  for (const platform of PLATFORMS) {
    assert.ok(list[platform].length >= 1, `${platform}: at least one version`);
    for (const row of list[platform]) {
      assert.equal(row.file, PUBLIC_NAMES[platform](row.version), `${platform} ${row.version}: the public name`);
      // The files themselves are not committed (git-ignored): on this machine they must be the listed ones.
      const file = path.join(ROOT, DOWNLOADS_DIR, row.file);
      assert.ok(existsSync(file), `site/downloads/${row.file} is missing - copy it in with: node scripts/site/add-download.mjs --platform=${platform} --version=${row.version} --date=${row.date} --from=<installer> --replace`);
      assert.equal(statSync(file).size, row.bytes, `${row.file}: the listed size`);
      assert.equal(fileSha256(file), row.sha256, `${row.file}: the listed SHA-256`);
      assert.equal(sha256(readFileSync(file)), row.sha256, `${row.file}: the same by another reader`);
    }
  }
  assert.deepEqual(readdirSync(path.join(ROOT, DOWNLOADS_DIR)).sort(), PLATFORMS.flatMap((p) => list[p].map((row) => row.file)).sort(), 'site/downloads/ holds the listed files and nothing else');
  assert.ok(readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/).includes('site/downloads/'), 'the installer files are git-ignored');
  assert.deepEqual(real().downloads, list);
});

// ---------------------------------------------------------------------------------------------
// The built tree: images, installers, the style sheet and the script
// ---------------------------------------------------------------------------------------------

test('tree: the 160 pages, site.css, site.js, every image and every installer - and a hole is noticed', (t) => {
  assert.deepEqual(Object.keys(PLAY_FOLDER).sort(), [...CODES].sort(), 'a Play screenshot folder for every app locale');
  assert.deepEqual(Object.keys(STORE_FOLDER).sort(), [...CODES].sort(), 'a Store screenshot folder for every app locale');
  assert.deepEqual([PLAY_FOLDER.he, PLAY_FOLDER.pt, STORE_FOLDER.he, STORE_FOLDER.pt, STORE_FOLDER.ar], ['iw-IL', 'pt-BR', 'he-IL', 'pt-PT', 'ar-SA']);
  assert.deepEqual(SHOTS.map((s) => `${s.kind} ${s.file} ${s.width}x${s.height}`), ['phone 01-home.png 1080x1920', 'phone 03-entry.png 1080x1920', 'phone 04-habits.png 1080x1920', 'phone 05-insights.png 1080x1920', 'desktop 01-home.png 1920x1080']);

  const site = real();
  const installers = PLATFORMS.flatMap((p) => site.downloads[p]);
  assert.deepEqual([...site.pages.keys()], LOCALES.flatMap((l) => SITE_PAGES.map((p) => pageFile(p.id, l.code))), 'eight pages for each of the 20 locales');
  assert.equal(site.pages.size, 160);
  assert.equal(PAGE_COUNT, 160);
  assert.ok(!site.pages.has('en/index.html'), 'there is no en/ folder');
  // The eight pages of English and of Hebrew, by their literal files.
  for (const rel of ['index.html', 'app/index.html', 'terms/index.html', 'faq/index.html', 'privacy/index.html', 'downloads/index.html', 'contact/sent/index.html', 'contact/error/index.html']) {
    assert.ok(site.pages.has(rel), rel);
    assert.ok(site.pages.has(`he/${rel}`), `he/${rel}`);
  }
  assert.equal([...site.pages.keys()].filter((rel) => rel.endsWith('app/index.html')).length, 20, 'one About page per language');
  assert.deepEqual([...site.files.keys()], [CSS_NAME, SCRIPT_NAME, IMAGE_LIST_FILE]);
  assert.equal(site.files.get(IMAGE_LIST_FILE), formatDownloads(site.downloads), 'the list of the installers, for the hosted server');
  assert.equal(site.assets.size, IMAGE_COUNT + installers.length);
  assert.deepEqual([...site.assets.keys()].filter((rel) => rel.startsWith(`${FILES_DIR}/`)).sort(), installers.map((row) => `${FILES_DIR}/${row.file}`).sort());
  assert.equal(site.siteBase, SITE_BASE);
  assert.deepEqual(site.unset, []);

  const out = temp(t, 'site-out-');
  const target = writeSite(site, out);
  assert.equal(target, path.join(out, SITE_ID));
  assert.deepEqual(filesUnder(target), [...site.pages.keys(), ...site.files.keys(), ...site.assets.keys()].sort(), 'the tree is the pages, the three files, the images and the installers - nothing else');
  assert.deepEqual(siteTreeProblems(out), []);
  assert.deepEqual(siteFolderProblems(target), []);

  // The screenshots: the hero image of the home page (it loads at once) and the five screens of the About page -
  // each in the language of its page, with the stated size and an alt text. The two icons are checked with the frame.
  const isIcon = (el) => hasClass(el, 'app-icon') || hasClass(el, 'home-icon');
  for (const l of LOCALES) {
    for (const [id, ids] of [['home', ['phone-home']], ['about', SHOTS.map((s) => s.id)]]) {
      const rel = pageFile(id, l.code);
      const dir = siteDir(id, l.code);
      const page = parsed(rel);
      const images = page.all('img').filter((el) => !isIcon(el));
      assert.deepEqual(images.map((image) => image.attrs.src), ids.map((shot) => relativeHref(dir, `img/${l.code}/${shot}.png`)), `${rel}: ${id === 'home' ? 'the hero image' : 'the five screens'}, of its own language`);
      for (const image of images) {
        const size = ihdr(path.join(target, ...resolveAddress(dir, image.attrs.src).split('/')));
        assert.deepEqual({ width: Number(image.attrs.width), height: Number(image.attrs.height) }, size, `${rel}: ${image.attrs.src} is ${size.width}x${size.height}`);
        assert.ok(image.attrs.alt.trim().length >= 5, `${rel}: ${image.attrs.src} has an alt text`);
        assert.equal(image.attrs.decoding, 'async');
        assert.deepEqual([image.attrs.loading, image.attrs.fetchpriority], id === 'home' ? [undefined, 'high'] : ['lazy', undefined], `${rel}: ${image.attrs.src} - only the hero image loads at once`);
      }
      assert.equal(page.all('figure').length, id === 'home' ? 0 : SHOTS.length, `${rel}: the figures`);
      assert.equal(page.all('figcaption').length, id === 'home' ? 0 : SHOTS.length);
    }
    // No other page of the language shows a screenshot.
    for (const def of SITE_PAGES.filter((p) => p.id !== 'home' && p.id !== 'about')) {
      assert.deepEqual(parsed(pageFile(def.id, l.code)).all('img').filter((el) => !isIcon(el)).map((el) => el.attrs.src), [], `${pageFile(def.id, l.code)}: no screenshot`);
    }
  }
  assert.deepEqual(ihdr(path.join(target, ...SHARE_IMAGE.rel.split('/'))), { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height });
  assert.ok(readFileSync(path.join(target, ...ICON_IMAGE.rel.split('/')), 'utf8').startsWith('<svg'), 'the icon');
  // The copies are the files of the kits and of site/downloads/, byte for byte.
  assert.deepEqual(readFileSync(path.join(target, 'img', 'he', 'phone-entry.png')), readFileSync(path.join(ROOT, 'play', 'screenshots', 'iw-IL', '03-entry.png')));
  assert.deepEqual(readFileSync(path.join(target, 'img', 'pt', 'desktop-home.png')), readFileSync(path.join(ROOT, 'store', 'screenshots', 'pt-PT', '01-home.png')));
  assert.deepEqual(readFileSync(path.join(target, 'img', 'icon.svg')), readFileSync(path.join(ROOT, 'public', 'favicon.svg')));
  for (const row of installers) {
    const copy = path.join(target, FILES_DIR, row.file);
    assert.equal(statSync(copy).size, row.bytes, `${FILES_DIR}/${row.file}: the listed size`);
    assert.equal(sha256(readFileSync(copy)), row.sha256, `${FILES_DIR}/${row.file}: the listed SHA-256`);
  }
  assert.equal(readFileSync(path.join(target, CSS_NAME), 'utf8'), site.files.get(CSS_NAME));
  assert.equal(readFileSync(path.join(target, SCRIPT_NAME), 'utf8'), readFileSync(path.join(ROOT, SCRIPT_FILE), 'utf8'), 'site.js is published as it is');

  // A tree with a hole is noticed (stage-image.mjs runs this check on ui/ of a staged image).
  const windowsFile = site.downloads.windows[0].file;
  rmSync(path.join(target, 'img', 'ja', 'phone-habits.png'));
  rmSync(path.join(target, 'he', 'faq', 'index.html'));
  rmSync(path.join(target, CSS_NAME));
  rmSync(path.join(target, FILES_DIR, windowsFile));
  writeFileSync(path.join(target, FILES_DIR, site.downloads.mac[0].file), 'not the disk image');
  assert.deepEqual(siteTreeProblems(out), [
    'about/he/faq/index.html is missing',
    `about/${FILES_DIR}/${windowsFile} is missing (downloads/index.html refers to it)`,
    'about/img/ja/phone-habits.png is missing (ja/app/index.html refers to it)',
    'about/site.css is missing (index.html refers to it)',
    `about/${FILES_DIR}/${site.downloads.mac[0].file} is 18 bytes, the Downloads page says ${site.downloads.mac[0].bytes}`,
  ]);
  // A second build replaces the first; a folder that is not ours is never replaced.
  writeFileSync(path.join(target, 'stale.html'), 'left over');
  writeSite(site, out);
  assert.deepEqual(siteTreeProblems(out), []);
  assert.ok(!existsSync(path.join(target, 'stale.html')));
  const foreign = temp(t, 'site-foreign-');
  write(path.join(foreign, 'about', 'index.html'), '<h1>Somebody else</h1>');
  assert.throws(() => writeSite(site, foreign), /was not written by this script - refusing to replace it/);
  assert.equal(readFileSync(path.join(foreign, 'about', 'index.html'), 'utf8'), '<h1>Somebody else</h1>');
});

test('tree: it works under any name and at the root - every address is relative and stays inside', (t) => {
  const site = real();
  const out = temp(t, 'site-root-');
  writeSite(site, out);
  // The content of about/ as the web root of another server: nothing in it knows the name "about".
  const moved = path.join(out, 'www');
  renameSync(path.join(out, SITE_ID), moved);
  assert.deepEqual(siteFolderProblems(moved), []);
  assert.ok(siteTreeProblems(out).length > 0, 'and about/ itself is gone');

  for (const { rel, html, def, l, dir } of pagesOf(site)) {
    const page = parsed(rel);
    const own = new Set(SITE_PAGES.map((p) => pageFile(p.id, l.code)));
    for (const el of page.elements) {
      for (const name of ['href', 'src', 'action', 'srcset', 'poster', 'data', 'formaction']) {
        if (!(name in el.attrs)) continue;
        const address = el.attrs[name];
        const where = `${rel}: <${el.tag} ${name}="${address}">`;
        if (name === 'action') {
          assert.equal(address, CONTACT_ACTION, `${where}: the one absolute path of the site`);
          continue;
        }
        if (address.startsWith('#') || address.startsWith('mailto:')) continue;
        if (/^[a-z][a-z0-9+.-]*:/i.test(address)) {
          assert.ok(address === SITE_URL || address.startsWith(`${SITE_URL}/`), `${where}: an absolute address leads to the fixed server`);
          assert.ok(el.tag === 'link' || el.tag === 'a', where);
          continue;
        }
        assert.match(address, /^\.\.?\//, `${where}: relative (never from the root of the server)`);
        assert.ok(!/(?:^|\/)about\//.test(address), `${where}: the name of the folder is not part of an address`);
        const place = resolveAddress(dir, address);
        assert.notEqual(place, null, `${where}: stays inside the site`);
        const file = place === '' || place.endsWith('/') ? `${place}index.html` : place;
        assert.ok(site.pages.has(file) || site.files.has(file) || site.assets.has(file), `${where}: ${file} exists in the tree`);
        // A link to a page stays in the language of the page (the language chooser and the language list aside).
        if (el.tag === 'a' && site.pages.has(file) && !('hreflang' in el.attrs)) assert.ok(own.has(file), `${where}: a page of the same language`);
      }
    }
    // The language chooser: the same page in each language.
    for (const option of page.all('option')) assert.ok(site.pages.has(`${resolveAddress(dir, option.attrs.value)}index.html`), `${rel}: the option ${option.attrs.value} leads to a page`);
    assert.ok(!/(?:href|src|action|value)="\/(?!api\/contact")/.test(html), `${rel}: no address from the root of the server but the form's action`);
    assert.ok(def.contact === html.includes(`action="${CONTACT_ACTION}"`), rel);
  }

  // What the check catches: an address from the root, an address that leaves the site, a missing target.
  const home = path.join(moved, 'index.html');
  const original = readFileSync(home, 'utf8');
  writeFileSync(home, original.replace('href="./terms/"', 'href="/about/terms/"').replace('href="./faq/"', 'href="../faq/"').replace('href="./downloads/"', 'href="./download/"'));
  assert.deepEqual(siteFolderProblems(moved), [
    'index.html: the address /about/terms/ is not relative (it would break when the site moves)',
    'index.html: the address ../faq/ leaves the site',
    'download/index.html is missing (index.html refers to it)',
  ]);
  writeFileSync(home, original.replace(GENERATOR_TAG, ''));
  assert.deepEqual(siteFolderProblems(moved), ['index.html was not written by scripts/site/build-site.mjs']);
});

// ---------------------------------------------------------------------------------------------
// The frame of every page
// ---------------------------------------------------------------------------------------------

test('pages: the frame of all 160 - head, skip link, header, menu, one h1, contact block, language chooser, copyright', () => {
  const site = real();
  for (const { rel, html, def, l, dir } of pagesOf(site)) {
    const page = parsed(rel);
    const content = contentOf(l.code);
    const to = (target) => relativeHref(dir, target);
    const toPage = (id, code = l.code) => to(siteDir(id, code));

    // The budget, and nothing left over from the sources.
    const bytes = Buffer.byteLength(html, 'utf8');
    const limit = def.legal ? MAX_LEGAL_PAGE_BYTES : MAX_PAGE_BYTES;
    assert.ok(bytes < limit, `${rel}: ${bytes} bytes, under ${limit}`);
    assert.ok(!html.includes('{{'), `${rel}: every placeholder is filled`);
    assert.ok(!html.includes('[[') && !html.includes(']]'), `${rel}: every link of a text became a link`);
    assert.ok(!html.includes('\r') && !html.includes(UNTRANSLATED_MARKER) && !html.includes(MARKER_KEY), `${rel}: LF only, and the marker never reaches a page`);

    // lang and dir: right to left exactly for Hebrew and Arabic.
    assert.deepEqual(page.all('html')[0].attrs, { lang: l.code, dir: ['he', 'ar'].includes(l.code) ? 'rtl' : 'ltr' }, rel);

    // One h1, the first heading; the headings never skip a level.
    const levels = page.elements.filter((el) => /^h[1-6]$/.test(el.tag)).map((el) => Number(el.tag[1]));
    assert.equal(levels.filter((n) => n === 1).length, 1, `${rel}: exactly one h1`);
    assert.equal(levels[0], 1, `${rel}: the first heading is the h1`);
    levels.reduce((previous, level) => {
      assert.ok(level <= previous + 1, `${rel}: h${level} follows h${previous}`);
      return level;
    });
    const [h1] = page.all('h1');
    const [mainEl] = page.all('main');
    assert.ok(h1.parents.includes(mainEl), `${rel}: the h1 is in <main>`);
    // At least two characters: a whole word in Chinese or Japanese can be two (下载, "Downloads").
    assert.ok(page.textOf(h1).trim().length >= 2, `${rel}: the h1 has a text`);

    // Landmarks: one header, one main, one footer; the menu and the language list, each with its own label.
    for (const tag of ['header', 'main', 'footer', 'title']) assert.equal(page.all(tag).length, 1, `${rel}: one <${tag}>`);
    assert.deepEqual(mainEl.attrs, { id: 'main' }, rel);
    const navs = page.all('nav');
    const nameOf = (el) => el.attrs['aria-label'] ?? page.textOf(page.elements.find((x) => x.attrs.id === el.attrs['aria-labelledby']));
    assert.deepEqual(navs.map((el) => [el.attrs.class, nameOf(el)]), [['menu', content.nav.label], ['langs', content.footer.languagesLabel]], `${rel}: two labelled navigations`);
    const [header] = page.all('header');
    const [footer] = page.all('footer');
    assert.ok(navs[0].parents.includes(header) && navs[1].parents.includes(footer), `${rel}: the menu in the header, the language list in the footer`);
    // The language list is ordinary markup, never in <noscript>: a browser that runs script but did not get site.js
    // would otherwise show no way to change the language.
    assert.equal(page.all('noscript').length, 0, `${rel}: no <noscript>`);

    // The head.
    const metas = Object.fromEntries(page.all('meta').map((el) => [el.attrs.name ?? el.attrs.property ?? 'charset', el.attrs.content ?? el.attrs.charset]));
    const links = page.all('link');
    const canonical = def.legal ? `${SITE_URL}${pagePath(def.legal, l.code)}` : `${SITE_BASE}${dir}`;
    assert.deepEqual(links.filter((el) => el.attrs.rel === 'canonical').map((el) => el.attrs.href), [canonical], `${rel}: one canonical link`);
    assert.deepEqual(
      links.filter((el) => el.attrs.rel === 'alternate').map((el) => [el.attrs.hreflang, el.attrs.href]),
      [...CODES.map((c) => [c, `${SITE_BASE}${siteDir(def.id, c)}`]), ['x-default', `${SITE_BASE}${siteDir(def.id, DEFAULT_LOCALE)}`]],
      `${rel}: the same page in the 20 locales and x-default`,
    );
    const title = page.textOf(page.all('title')[0]);
    assert.ok(title.includes(BRAND) && title.length > BRAND.length, `${rel}: the title names the page and the brand`);
    assert.equal(metas.charset, 'utf-8');
    assert.equal(metas.viewport, 'width=device-width, initial-scale=1');
    assert.equal(metas['color-scheme'], 'light dark');
    assert.equal(metas.referrer, 'same-origin', `${rel}: the form says where it comes from, nothing leaves the site`);
    assert.ok(metas.description.length > 20, `${rel}: a description`);
    assert.equal(metas['og:type'], 'website');
    assert.equal(metas['og:url'], canonical);
    assert.equal(metas['og:title'], title);
    assert.equal(metas['og:description'], metas.description);
    assert.equal(metas['og:image'], `${SITE_BASE}${SHARE_IMAGE.rel}`);
    assert.match(metas['og:locale'], /^[a-z]{2}_[A-Z]{2}$/);
    assert.equal(metas['og:site_name'], BRAND);
    assert.equal(metas.robots, def.noindex ? 'noindex' : undefined, `${rel}: only the two result pages keep search engines away`);
    assert.ok(html.includes(GENERATOR_TAG));
    assert.deepEqual(links.filter((el) => el.attrs.rel === 'icon').map((el) => el.attrs.href), [to(ICON_IMAGE.rel)]);
    assert.deepEqual(links.filter((el) => el.attrs.rel === 'stylesheet').map((el) => el.attrs.href), [to(CSS_NAME)], `${rel}: one style sheet, a file`);
    assert.deepEqual(page.all('script').map((el) => el.attrs), [{ src: to(SCRIPT_NAME), defer: '' }], `${rel}: one script, a file, loaded with defer`);
    assert.equal(page.textOf(page.all('script')[0]), '', `${rel}: no inline script`);

    // Nothing the Content-Security-Policy of the server would refuse, and nothing that moves.
    for (const tag of ['style', 'iframe', 'object', 'embed', 'base', 'audio', 'video', 'marquee', 'canvas']) assert.equal(page.all(tag).length, 0, `${rel}: no <${tag}>`);
    for (const el of page.elements) {
      for (const [name, value] of Object.entries(el.attrs)) {
        assert.ok(!/^on/i.test(name), `${rel}: <${el.tag} ${name}> is an event handler`);
        assert.ok(!/^\s*(?:javascript|data|vbscript)\s*:/i.test(value), `${rel}: <${el.tag} ${name}="${value}">`);
        assert.notEqual(name, 'style', `${rel}: <${el.tag}> has a style attribute`);
      }
    }
    assert.ok(!/javascript:/i.test(html) && !/@import|expression\(/i.test(html), `${rel}: no javascript: URL, no @import`);
    const hosts = new Set([...html.matchAll(/https?:\/\/([^/"'\s<>)]+)/g)].map((m) => m[1]));
    assert.deepEqual([...hosts], [SERVER_HOST], `${rel}: no http(s) URL of another host`);
    assert.ok(!/["'(]\/\/[a-z0-9]/i.test(html), `${rel}: no protocol-relative URL`);

    // Ids are unique; every same-page #anchor, label and ARIA reference resolves.
    const ids = page.elements.filter((el) => 'id' in el.attrs).map((el) => el.attrs.id);
    assert.equal(new Set(ids).size, ids.length, `${rel}: unique ids`);
    for (const el of page.elements) {
      if ((el.attrs.href ?? '').startsWith('#')) assert.ok(ids.includes(el.attrs.href.slice(1)), `${rel}: ${el.attrs.href} exists`);
      for (const name of ['for', 'aria-labelledby', 'aria-describedby', 'aria-controls']) if (name in el.attrs) assert.ok(ids.includes(el.attrs[name]), `${rel}: ${name}="${el.attrs[name]}" exists`);
    }

    // 1. The skip link: the first thing in the page.
    const [body] = page.all('body');
    const first = page.children(body)[0];
    assert.deepEqual([first.tag, first.attrs.class, first.attrs.href, page.textOf(first)], ['a', 'skip', '#main', content.skipLink], `${rel}: the skip link`);

    // 2. The header: the logo and the name, one link to the home page of the language.
    const brand = page.inside(header, 'a').filter((el) => hasClass(el, 'brand'));
    assert.deepEqual(brand.map((el) => [el.attrs.href, page.textOf(el)]), [[toPage('home'), BRAND]], `${rel}: logo and name lead to the home page`);
    const [logo, name] = page.children(brand[0]);
    assert.deepEqual([logo.tag, logo.attrs.src, logo.attrs.alt, logo.attrs.width, logo.attrs.height], ['img', to(ICON_IMAGE.rel), '', '32', '32'], `${rel}: the logo (the name next to it is its text)`);
    assert.deepEqual([name.tag, name.attrs], ['bdi', { lang: 'en', dir: 'ltr' }], `${rel}: the name`);

    // 3. The menu: seven items in the fixed order, exactly one of them current.
    const menu = page.inside(navs[0], 'a');
    assert.deepEqual(page.children(navs[0]).map((el) => el.tag), ['ul'], `${rel}: the menu is a list`);
    assert.equal(page.inside(navs[0], 'li').length, 7);
    const contactHref = def.contact ? '#contact' : `${toPage('home')}#contact`;
    assert.deepEqual(
      menu.map((el) => [el.attrs.href, page.textOf(el)]),
      [
        [toPage('home'), content.nav.home],
        [toPage('about'), content.nav.about],
        [toPage('terms'), content.nav.terms],
        [toPage('faq'), content.nav.faq],
        [toPage('privacy'), content.nav.privacy],
        [toPage('downloads'), content.nav.downloads],
        [contactHref, content.nav.contact],
      ],
      `${rel}: Home, About the app, Terms of Use, Questions and answers, Privacy Policy, Downloads, Contact us`,
    );
    assert.deepEqual(menu.slice(0, -1).map((el) => el.attrs.href), MENU.map(([id]) => toPage(id)), `${rel}: the menu follows MENU`);
    const current = menu.filter((el) => 'aria-current' in el.attrs);
    assert.equal(current.length, 1, `${rel}: exactly one current item`);
    // The two result pages belong to "Contact us", whose link leads to another page: the current item, not the current page.
    assert.equal(current[0].attrs['aria-current'], def.contact ? 'page' : 'true', `${rel}: aria-current`);
    assert.equal(menu.indexOf(current[0]), def.contact ? MENU.findIndex(([id]) => id === def.id) : 6, `${rel}: the current item is the page itself`);
    assert.equal(page.textOf(current[0]), def.contact ? content.nav[def.id] : content.nav.contact, `${rel}: the current item names the page`);

    // 5. The contact block: on every page but the two result pages.
    const contact = page.elements.filter((el) => el.attrs.id === 'contact');
    const forms = page.all('form');
    if (!def.contact) {
      assert.deepEqual([contact.length, forms.length, page.all('input').length, page.all('textarea').length], [0, 0, 0, 0], `${rel}: a result page has no contact block`);
    } else {
      assert.equal(contact.length, 1, `${rel}: one contact block`);
      const [block] = contact;
      assert.equal(block.tag, 'section');
      assert.ok(!block.parents.includes(mainEl) && page.elements.indexOf(block) > page.elements.indexOf(mainEl) && page.elements.indexOf(block) < page.elements.indexOf(footer), `${rel}: between <main> and the footer`);
      const heading = page.elements.find((el) => el.attrs.id === block.attrs['aria-labelledby']);
      assert.deepEqual([heading.tag, page.textOf(heading)], ['h2', content.contact.heading], `${rel}: the block is named by its h2`);
      assert.ok(page.textOf(block).includes(plain(content.contact.lead, l)), `${rel}: the sentence of the block`);
      const mail = page.inside(block, 'a').filter((el) => el.attrs.href.startsWith('mailto:'));
      assert.deepEqual(mail.map((el) => [el.attrs.href, page.textOf(el)]), [[`mailto:${FILLED.contactEmail}`, FILLED.contactEmail]], `${rel}: the e-mail address as a mailto link`);
      assert.equal(forms.length, 1);
      const [form] = forms;
      assert.ok(form.parents.includes(block));
      assert.deepEqual([form.attrs.method, form.attrs.action, form.attrs.enctype, form.attrs.novalidate], ['post', CONTACT_ACTION, undefined, undefined], `${rel}: a plain form that works without script`);
      const controls = page.elements.filter((el) => el.parents.includes(form) && ['input', 'textarea', 'select', 'button'].includes(el.tag));
      const { class: _class, ...buttonAttrs } = controls.at(-1).attrs;
      assert.deepEqual(
        controls.slice(0, -1).map((el) => [el.tag, el.attrs]),
        [
          ['input', { type: 'hidden', name: 'lang', value: l.code }],
          ['input', { type: 'text', id: 'contact-website', name: 'website', tabindex: '-1', autocomplete: 'off' }],
          ['input', { type: 'text', id: 'contact-first', name: 'firstName', autocomplete: 'given-name', maxlength: '80', dir: 'auto', required: '' }],
          ['input', { type: 'text', id: 'contact-last', name: 'lastName', autocomplete: 'family-name', maxlength: '80', dir: 'auto', required: '' }],
          ['input', { type: 'email', id: 'contact-email', name: 'email', autocomplete: 'email', maxlength: '254', dir: 'ltr', required: '' }],
          ['textarea', { id: 'contact-message', name: 'message', rows: '6', maxlength: '5000', dir: 'auto', required: '' }],
        ],
        `${rel}: lang, the honeypot, first name, last name, e-mail, message`,
      );
      assert.deepEqual([controls.at(-1).tag, buttonAttrs, page.textOf(controls.at(-1))], ['button', { type: 'submit' }, content.contact.send], `${rel}: the Send button`);
      // Every field has a visible label; the honeypot and its label are out of sight and out of the accessibility tree.
      const labels = Object.fromEntries(page.inside(form, 'label').map((el) => [el.attrs.for, page.textOf(el)]));
      assert.deepEqual(labels, { 'contact-website': content.contact.honeypot, 'contact-first': content.contact.firstName, 'contact-last': content.contact.lastName, 'contact-email': content.contact.email, 'contact-message': content.contact.message }, `${rel}: a label for every field`);
      const trap = controls[1].parents.at(-1);
      assert.deepEqual([trap.tag, trap.attrs], ['div', { class: 'hp', 'aria-hidden': 'true' }], `${rel}: the honeypot is hidden from everyone but a robot`);
      assert.ok(page.inside(form, 'label').find((el) => el.attrs.for === 'contact-website').parents.includes(trap));
      assert.ok(page.textOf(form).includes(content.contact.required), `${rel}: "All fields are required" is said in words`);
      // The notice stands before the button and links to the Privacy Policy page of the language.
      const notice = page.inside(form, 'p').find((el) => hasClass(el, 'notice'));
      assert.equal(page.textOf(notice), plain(content.contact.notice, l), `${rel}: the notice`);
      assert.deepEqual(page.inside(notice, 'a').map((el) => el.attrs.href), [toPage('privacy')]);
      assert.ok(page.elements.indexOf(notice) > page.elements.indexOf(controls[5]) && page.elements.indexOf(notice) < page.elements.indexOf(controls.at(-1)), `${rel}: under the fields, before the button`);
    }

    // 6. The footer: the language chooser (in the markup: the list of language links), and under it the copyright
    // line - nothing else.
    assert.deepEqual(page.children(page.children(footer)[0]).map((el) => `${el.tag}.${el.attrs.class ?? ''}`), ['div.chooser', 'nav.langs', 'p.copy'], `${rel}: the footer`);
    const chooser = page.elements.find((el) => el.attrs.id === 'lang-chooser');
    assert.deepEqual(chooser.attrs, { class: 'chooser', id: 'lang-chooser', role: 'group', 'aria-labelledby': 'lang-label', hidden: '' }, `${rel}: hidden until the script shows it`);
    const [label, select, button] = page.children(chooser);
    assert.deepEqual([label.tag, label.attrs, page.textOf(label)], ['label', { id: 'lang-label', for: 'lang-select' }, content.languagesLabel], `${rel}: the label of the list`);
    assert.deepEqual([select.tag, select.attrs], ['select', { id: 'lang-select', autocomplete: 'off' }]);
    assert.deepEqual([button.tag, button.attrs, page.textOf(button)], ['button', { class: 'btn', id: 'lang-change', type: 'button' }, content.footer.change], `${rel}: the Change button`);
    const options = page.inside(select, 'option');
    assert.deepEqual(options.map((el) => [el.attrs.lang, el.attrs.value, page.textOf(el)]), LOCALES.map((x) => [x.code, toPage(def.id, x.code), x.name]), `${rel}: the 20 languages in their own names, each leading to the same page`);
    assert.deepEqual(options.filter((el) => 'selected' in el.attrs).map((el) => el.attrs.lang), [l.code], `${rel}: the language of the page is selected`);
    // The list of language links: shown in the markup (no hidden attribute), under its visible label; site.js hides it.
    assert.deepEqual(navs[1].attrs, { class: 'langs', id: 'lang-list', 'aria-labelledby': 'lang-list-label' }, `${rel}: the list is shown until the script replaces it`);
    const listParts = page.children(navs[1]);
    assert.deepEqual(listParts.map((el) => [el.tag, el.attrs]), [['p', { id: 'lang-list-label' }], ['ul', {}]], `${rel}: the label, and under it the list`);
    assert.equal(page.textOf(listParts[0]), content.footer.languagesLabel, `${rel}: the label of the list`);
    const listLinks = page.inside(navs[1], 'a');
    assert.deepEqual(listLinks.map((el) => [el.attrs.hreflang, el.attrs.lang, el.attrs.href, page.textOf(el)]), LOCALES.map((x) => [x.code, x.code, toPage(def.id, x.code), x.name]), `${rel}: the list of language links for a browser without script or without site.js`);
    assert.deepEqual(listLinks.filter((el) => el.attrs['aria-current'] === 'page').map((el) => el.attrs.hreflang), [l.code]);
    const copy = page.children(page.children(footer)[0])[2];
    assert.equal(page.textOf(copy), `© ${SITE_SETTINGS.copyrightYear} ${BRAND}. ${content.footer.rights}`, `${rel}: the copyright line`);
    assert.ok(page.texts.some((node) => node.text.startsWith('©') && node.parents.at(-1).tag === 'bdi' && node.parents.at(-1).attrs.dir === 'ltr'), `${rel}: the line reads left to right`);

    // Buttons, menu items and <summary> rows are flex boxes: their text sits in ONE child element, never loose
    // next to an isolated fragment (a <bdi> beside loose text would become a column).
    const boxes = page.elements.filter((el) => el.tag === 'summary' || el.tag === 'button' || (el.tag === 'a' && (hasClass(el, 'btn') || hasClass(el, 'brand') || el.parents.includes(navs[0]) || el.parents.includes(navs[1]))));
    // At least: the logo, seven menu items, 20 language links, the Change button and one button of the page or of the form.
    assert.ok(boxes.length >= 30, `${rel}: the menu, the language list, the buttons`);
    for (const box of boxes) {
      assert.deepEqual(page.texts.filter((node) => node.parents.at(-1) === box).map((node) => node.text), [], `${rel}: no loose text in <${box.tag} class="${box.attrs.class ?? ''}">`);
      assert.ok(page.children(box).length >= 1, `${rel}: <${box.tag}> has a child element`);
    }
    // Every link has a text; every image its size and an alt attribute; icons are decoration.
    for (const el of page.all('a')) assert.ok(page.textOf(el).trim().length > 0, `${rel}: the link ${el.attrs.href} has a text`);
    for (const image of page.all('img')) {
      assert.match(image.attrs.width, /^\d+$/);
      assert.match(image.attrs.height, /^\d+$/);
      assert.ok('alt' in image.attrs, `${rel}: ${image.attrs.src} has an alt attribute`);
    }
    for (const svg of page.all('svg')) assert.equal(svg.attrs['aria-hidden'], 'true', `${rel}: an icon is aria-hidden`);
    assert.ok(!html.includes('xmlns'), `${rel}: inline SVG needs no namespace URL`);
    for (const use of page.all('use')) assert.ok(ids.includes(use.attrs.href.slice(1)), `${rel}: the icon ${use.attrs.href} is in the sprite`);
    // The brand: always the same Latin words (in the texts of the site: isolated, marked as English).
    if (!def.legal) {
      for (const node of page.texts.filter((t) => t.text.includes(BRAND) && !t.parents.some((el) => el.tag === 'title'))) {
        const bdi = node.parents.at(-1);
        assert.deepEqual([bdi.tag, bdi.attrs.lang, bdi.attrs.dir, node.text], ['bdi', 'en', 'ltr', BRAND], `${rel}: the brand in <bdi lang="en" dir="ltr">`);
      }
    }
    // Only the script may add roles: the static page has the two it needs (the strip of screens is on the About page).
    assert.deepEqual(page.elements.filter((el) => 'role' in el.attrs).map((el) => el.attrs.role).sort(), def.id === 'about' ? ['group', 'region'] : ['group'], `${rel}: no tab role without the script`);
    assert.deepEqual(page.elements.filter((el) => 'tabindex' in el.attrs).map((el) => `${el.attrs.class ?? el.attrs.name}:${el.attrs.tabindex}`), [...(def.id === 'about' ? ['strip:0'] : []), ...(def.contact ? ['website:-1'] : [])], `${rel}: the focus order is the order of the page`);
    // The icon sprite: only where a page draws icons (the cards and the checks of the About page, the chevrons of
    // the questions and of "Check the file").
    assert.equal(page.elements.filter((el) => hasClass(el, 'sprite')).length, ['about', 'faq', 'downloads'].includes(def.id) ? 1 : 0, `${rel}: the sprite`);
    assert.equal(page.all('use').length > 0, ['about', 'faq', 'downloads'].includes(def.id), `${rel}: icons`);
  }
});

// ---------------------------------------------------------------------------------------------
// The pages themselves
// ---------------------------------------------------------------------------------------------

test('home: the brand block with the large icon and the name, then the h1, the lead, two actions, the note and the phone - nothing else', () => {
  for (const l of LOCALES) {
    const rel = pageFile('home', l.code);
    const page = parsed(rel);
    const content = contentOf(l.code);
    const dir = siteDir('home', l.code);
    const [mainEl] = page.all('main');
    assert.equal(page.textOf(page.all('title')[0]), plain(content.title, l), `${rel}: the title`);
    assert.equal(page.all('meta').find((el) => el.attrs.name === 'description').attrs.content, plain(content.description, l), `${rel}: the description`);

    // ONE hero section is the whole content of the page.
    assert.deepEqual(page.children(mainEl).map((el) => [el.tag, el.attrs]), [['section', { class: 'hero' }]], `${rel}: <main> holds the hero and nothing else`);
    assert.deepEqual(page.inside(mainEl, 'section').length, 1, `${rel}: one section in <main>`);
    for (const id of ['features', 'screens', 'privacy']) assert.ok(!page.elements.some((el) => el.attrs.id === id), `${rel}: no #${id} section - it is on the About page`);
    for (const name of ['cards', 'card', 'strip', 'shot', 'checks', 'policy', 'page-head']) assert.ok(!page.elements.some((el) => hasClass(el, name)), `${rel}: no .${name}`);
    assert.deepEqual(page.elements.filter((el) => /^h[1-6]$/.test(el.tag)).map((el) => el.tag), ['h1', 'h2'], `${rel}: the h1 of the page and the h2 of the contact block`);
    assert.equal(page.all('svg').length, 0, `${rel}: no icon, so no sprite`);

    // FIRST the brand block: the app icon, large, and the name next to it. Not a link: this is the home page.
    const [hero] = page.children(mainEl);
    const [wrap] = page.children(hero);
    const [column, shot] = page.children(wrap);
    assert.deepEqual([wrap.attrs.class, page.children(wrap).length, column.tag, column.attrs], ['wrap', 2, 'div', {}], `${rel}: the text and the phone`);
    const [block, h1, lead, actionsBox, note] = page.children(column);
    assert.equal(page.children(column).length, 5, `${rel}: brand block, heading, lead, actions, note`);
    assert.deepEqual([block.tag, block.attrs], ['p', { class: 'home-brand' }], `${rel}: the brand block comes first`);
    const [icon, name] = page.children(block);
    assert.equal(page.children(block).length, 2, `${rel}: the icon and the name`);
    assert.deepEqual([icon.tag, icon.attrs], ['img', { class: 'home-icon', src: relativeHref(dir, ICON_IMAGE.rel), width: '96', height: '96', alt: '' }], `${rel}: the icon of the header, large; the name next to it is its text`);
    assert.deepEqual([name.tag, name.attrs, page.textOf(name)], ['bdi', { lang: 'en', dir: 'ltr' }, BRAND], `${rel}: the name of the app`);
    assert.equal(page.textOf(block), BRAND, `${rel}: the block says the name and nothing else`);
    assert.ok(!block.parents.some((el) => el.tag === 'a') && page.inside(block, 'a').length === 0, `${rel}: the brand block is not a link`);
    assert.equal(page.elements.filter((el) => hasClass(el, 'home-brand')).length, 1);
    // The same image as the logo of the header.
    const logo = page.all('img').find((el) => hasClass(el, 'app-icon'));
    assert.equal(icon.attrs.src, logo.attrs.src, `${rel}: one icon file for the header and the brand block`);

    // Then the h1, the lead, the two actions and the note. Until 2026-11-23 a first action, "Open in your browser",
    // opened the web version at the root of the server; the owner had it removed ("I want them to download"), and
    // "Downloads" is the primary button since.
    assert.equal(h1.tag, 'h1');
    assert.ok(page.elements.indexOf(block) < page.elements.indexOf(h1), `${rel}: the brand block stands before the h1`);
    assert.equal(page.textOf(h1), plain(content.hero.heading, l), `${rel}: the heading`);
    assert.deepEqual([lead.tag, lead.attrs.class, page.textOf(lead)], ['p', 'lead', plain(content.hero.lead, l)], `${rel}: the lead`);
    assert.deepEqual([actionsBox.tag, actionsBox.attrs.class], ['p', 'actions']);
    const actions = page.all('a').filter((el) => hasClass(el, 'btn') && el.parents.at(-1) === actionsBox);
    assert.deepEqual(
      actions.map((el) => [el.attrs.href, page.textOf(el), el.attrs.class]),
      [
        [relativeHref(dir, siteDir('downloads', l.code)), content.nav.downloads, 'btn primary'],
        [relativeHref(dir, siteDir('about', l.code)), content.nav.about, 'btn'],
      ],
      `${rel}: "Downloads" (the primary button) and "About the app"`,
    );
    assert.equal(page.children(actionsBox).length, 2, `${rel}: exactly two actions`);
    assert.equal(page.elements.filter((el) => hasClass(el, 'primary') && el.parents.includes(mainEl)).length, 1, `${rel}: one primary button, "Downloads"`);
    // Where the two actions lead: the Downloads page and the About page of the same language, files of the tree.
    assert.equal(resolveAddress(dir, actions[0].attrs.href), `${l.code === DEFAULT_LOCALE ? '' : `${l.code}/`}downloads/`, `${rel}: the first action opens the Downloads page`);
    assert.equal(resolveAddress(dir, actions[1].attrs.href), `${l.code === DEFAULT_LOCALE ? '' : `${l.code}/`}app/`, `${rel}: the second action opens the About page`);
    for (const action of actions) assert.ok(real().pages.has(`${resolveAddress(dir, action.attrs.href)}index.html`), `${rel}: ${action.attrs.href} is a page of the tree`);
    assert.deepEqual([note.tag, note.attrs.class, page.textOf(note)], ['p', 'note', plain(content.hero.note, l)], `${rel}: the note`);
    assert.equal(page.all('a').filter((el) => el.attrs.href === `${SITE_URL}/` || el.attrs.href === SITE_URL).length, 0, `${rel}: no link to the web version`);
    assert.ok(!('openAction' in content.hero), `${rel}: the content file has no text for such a button`);

    // The phone: the first screen of the app in the language of the page.
    assert.deepEqual([shot.tag, shot.attrs.class], ['div', 'hero-shot phone']);
    const [phone] = page.children(shot);
    assert.deepEqual([phone.tag, phone.attrs.src, phone.attrs.alt, phone.attrs.fetchpriority], ['img', relativeHref(dir, `img/${l.code}/phone-home.png`), plain(content.screens.items[0].alt, l), 'high'], `${rel}: the phone image`);

    // The contact block and the footer follow as on every page (the frame test has their details).
    assert.equal(page.elements.filter((el) => el.attrs.id === 'contact').length, 1, `${rel}: the contact block`);
    assert.equal(page.all('footer').length, 1);
  }
  // By its literal markup, English.
  const html = real().pages.get('index.html');
  assert.ok(html.includes('<p class="home-brand"><img class="home-icon" src="./img/icon.svg" width="96" height="96" alt=""><bdi lang="en" dir="ltr">Your Personal Diary</bdi></p>\n<h1>A private diary that helps you notice your own patterns</h1>'), 'en: the brand block, then the h1');
  assert.ok(html.includes('<p class="actions"><a class="btn primary" href="./downloads/"><span>Downloads</span></a><a class="btn" href="./app/"><span>About the app</span></a></p>'), 'en: the two actions');
  assert.ok(real().pages.get('he/index.html').includes('<p class="actions"><a class="btn primary" href="./downloads/"><span>הורדות</span></a><a class="btn" href="./app/"><span>על האפליקציה</span></a></p>'), 'he: the two actions');
  assert.ok(!html.includes('Open in your browser') && !html.includes(`href="${SITE_URL}/"`), 'en: the button that opened the web version is gone');
});

test('about: its own page - the h1 and the lead, then eight cards, the screens and the privacy list with its link', () => {
  for (const l of LOCALES) {
    const rel = pageFile('about', l.code);
    const page = parsed(rel);
    const content = contentOf(l.code);
    const dir = siteDir('about', l.code);
    const [mainEl] = page.all('main');
    assert.equal(rel, `${l.code === DEFAULT_LOCALE ? '' : `${l.code}/`}app/index.html`, `${l.code}: the address of the About page`);
    // The title follows the pattern of the Questions page; the description is the one of the site.
    assert.equal(page.textOf(page.all('title')[0]), `${content.nav.about} - ${BRAND}`, `${rel}: the title`);
    assert.equal(page.all('meta').find((el) => el.attrs.name === 'description').attrs.content, plain(content.description, l), `${rel}: the description`);
    assert.notEqual(page.textOf(page.all('title')[0]), plain(content.title, l), `${rel}: not the title of the home page`);

    // The head of the page, then the three sections with their ids, in this order.
    assert.deepEqual(
      page.children(mainEl).map((el) => [el.tag, el.attrs]),
      [['div', { class: 'wrap page-head' }], ['section', { id: 'features' }], ['section', { id: 'screens', class: 'band' }], ['section', { id: 'privacy' }]],
      `${rel}: the head, #features, #screens, #privacy`,
    );
    const [head, features, screens, privacy] = page.children(mainEl);
    const [h1, lead] = page.children(head);
    assert.equal(page.children(head).length, 2, `${rel}: the head is the h1 and the lead`);
    assert.deepEqual([h1.tag, page.textOf(h1)], ['h1', content.nav.about], `${rel}: the h1 is the name of the page in the menu`);
    assert.deepEqual([lead.tag, lead.attrs.class, page.textOf(lead)], ['p', 'lead', plain(content.hero.lead, l)], `${rel}: the lead`);
    assert.ok(!page.elements.some((el) => hasClass(el, 'hero') || hasClass(el, 'home-brand') || hasClass(el, 'home-icon') || hasClass(el, 'hero-shot')), `${rel}: no hero and no brand block - they are the home page`);

    const levels = page.elements.filter((el) => /^h[1-6]$/.test(el.tag)).map((el) => el.tag);
    assert.deepEqual(levels, ['h1', 'h2', ...Array(8).fill('h3'), 'h2', 'h2', 'h2'], `${rel}: features (eight cards), screens, privacy, contact`);
    // What you can do: eight cards, each with its icon.
    assert.equal(page.textOf(page.inside(features, 'h2')[0]), plain(content.features.heading, l), `${rel}: the heading of the cards`);
    const cards = page.inside(features, 'li');
    assert.equal(cards.length, 8, `${rel}: eight cards`);
    assert.deepEqual(page.inside(features, 'h3').map((el) => page.textOf(el)), content.features.items.map((item) => plain(item.title, l)));
    assert.deepEqual(cards.map((card) => page.textOf(page.inside(card, 'p')[0])), content.features.items.map((item) => plain(item.text, l)), `${rel}: the texts of the cards`);
    assert.equal(page.inside(features, 'use').length, 8, `${rel}: an icon on every card`);
    // What it looks like: the five screens in a labelled, focusable strip.
    assert.equal(page.textOf(page.inside(screens, 'h2')[0]), plain(content.screens.heading, l));
    assert.deepEqual(page.inside(screens, 'figcaption').map((el) => page.textOf(el)), content.screens.items.map((item) => plain(item.caption, l)));
    assert.deepEqual(page.inside(screens, 'img').map((el) => [el.attrs.src, el.attrs.alt]), SHOTS.map((s, i) => [relativeHref(dir, `img/${l.code}/${s.id}.png`), plain(content.screens.items[i].alt, l)]), `${rel}: the five screens of its own language with their alt texts`);
    const strip = page.elements.find((el) => hasClass(el, 'strip'));
    assert.ok(strip.parents.includes(screens));
    assert.deepEqual([strip.attrs.role, strip.attrs.tabindex, page.textOf(page.elements.find((el) => el.attrs.id === strip.attrs['aria-labelledby']))], ['region', '0', plain(content.screens.heading, l)], `${rel}: the strip of screens is a labelled, focusable region`);
    // Your privacy: the list and the button to the Privacy Policy page of the site.
    assert.equal(page.textOf(page.inside(privacy, 'h2')[0]), plain(content.privacy.heading, l));
    assert.ok(page.textOf(privacy).includes(plain(content.privacy.lead, l)), `${rel}: the sentence of the privacy section`);
    const checks = page.elements.find((el) => hasClass(el, 'checks'));
    assert.ok(checks.parents.includes(privacy));
    assert.deepEqual(page.children(checks).map((li) => page.textOf(li)), content.privacy.items.map((item) => plain(item, l)), `${rel}: the privacy list`);
    const policy = page.all('a').find((el) => el.parents.at(-1).attrs.class === 'policy');
    assert.deepEqual([policy.attrs.href, page.textOf(policy), policy.attrs.class], [relativeHref(dir, siteDir('privacy', l.code)), content.privacy.policyLink, 'btn'], `${rel}: the button to the Privacy Policy page of the site`);
    assert.equal(page.all('a').filter((el) => el.attrs.href === `${SITE_URL}/` || el.attrs.href === SITE_URL).length, 0, `${rel}: no link to the web version`);

    // The menu marks this page; the home page is another item.
    const current = page.inside(page.all('nav')[0], 'a').filter((el) => 'aria-current' in el.attrs);
    assert.deepEqual(current.map((el) => [el.attrs.href, el.attrs['aria-current'], page.textOf(el)]), [['./', 'page', content.nav.about]], `${rel}: the current item of the menu is "About the app"`);
    // Its own address in the head, and the About page of each language in the links of the languages.
    const links = page.all('link');
    assert.deepEqual(links.filter((el) => el.attrs.rel === 'canonical').map((el) => el.attrs.href), [`${SITE_BASE}${dir}`], `${rel}: canonical`);
    assert.equal(page.all('meta').find((el) => el.attrs.property === 'og:url').attrs.content, `${SITE_BASE}${dir}`, `${rel}: og:url`);
    assert.deepEqual(
      links.filter((el) => el.attrs.rel === 'alternate').map((el) => [el.attrs.hreflang, el.attrs.href]),
      [...CODES.map((c) => [c, `${SITE_BASE}${c === DEFAULT_LOCALE ? '' : `${c}/`}app/`]), ['x-default', `${SITE_BASE}app/`]],
      `${rel}: the 20 hreflang links and x-default lead to the About pages`,
    );
    const languageLinks = page.inside(page.all('nav')[1], 'a');
    assert.deepEqual(languageLinks.map((el) => [el.attrs.hreflang, resolveAddress(dir, el.attrs.href)]), CODES.map((c) => [c, `${c === DEFAULT_LOCALE ? '' : `${c}/`}app/`]), `${rel}: the language links lead to the About page of each language`);
    assert.deepEqual(page.all('option').map((el) => [el.attrs.lang, resolveAddress(dir, el.attrs.value)]), CODES.map((c) => [c, `${c === DEFAULT_LOCALE ? '' : `${c}/`}app/`]), `${rel}: and so do the options of the language chooser`);
    assert.equal(page.elements.filter((el) => el.attrs.id === 'contact').length, 1, `${rel}: it ends with the contact block`);
  }
  // The addresses by their literal form: English and Hebrew.
  const en = real().pages.get('app/index.html');
  assert.ok(en.includes('<title>About the app - Your Personal Diary</title>'));
  assert.ok(en.includes(`<link rel="canonical" href="${SITE_BASE}app/">`));
  assert.ok(en.includes(`<link rel="alternate" hreflang="he" href="${SITE_BASE}he/app/">`));
  assert.ok(en.includes('<div class="wrap page-head">\n<h1>About the app</h1>\n<p class="lead">Write about your day in your own words.'));
  assert.ok(en.includes('<li><a href="../"><span>Home</span></a></li>\n<li><a href="./" aria-current="page"><span>About the app</span></a></li>'), 'en: Home, then the current item');
  assert.ok(en.includes('<li><a href="../he/app/" hreflang="he" lang="he"><bdi>עברית</bdi></a></li>'), 'en: the Hebrew About page in the list of languages');
  const he = real().pages.get('he/app/index.html');
  assert.ok(he.includes(`<link rel="canonical" href="${SITE_BASE}he/app/">`));
  assert.ok(he.includes('<li><a href="../../app/" hreflang="en" lang="en"><bdi>English</bdi></a></li>'), 'he: the English About page in the list of languages');
  assert.ok(he.includes('<li><a href="./" hreflang="he" lang="he" aria-current="page"><bdi>עברית</bdi></a></li>'), 'he: its own language is the current one of the list');
  assert.ok(he.includes('<option value="../../ar/app/" lang="ar">'), 'he: the Arabic About page in the language chooser');
});

test('logo: on every page the logo and the name of the header are one link to the home page of the language', () => {
  const site = real();
  for (const { rel, def, l, dir } of pagesOf(site)) {
    const page = parsed(rel);
    const [header] = page.all('header');
    const links = page.inside(header, 'a').filter((el) => hasClass(el, 'brand'));
    assert.equal(links.length, 1, `${rel}: one logo link`);
    const [link] = links;
    // Where the link leads, resolved from the folder of the page: the top of the language - the home page.
    const home = l.code === DEFAULT_LOCALE ? '' : `${l.code}/`;
    assert.equal(resolveAddress(dir, link.attrs.href), home, `${rel}: the logo leads to the home page of the language`);
    assert.equal(`${resolveAddress(dir, link.attrs.href)}index.html`, pageFile('home', l.code));
    assert.ok(site.pages.has(`${home}index.html`), `${rel}: the home page exists`);
    assert.match(link.attrs.href, /^(?:\.\/|(?:\.\.\/)+)$/, `${rel}: a relative address, no file name`);
    // The logo and the name are both inside the link, and the link is the first thing of the header.
    assert.deepEqual(page.children(link).map((el) => el.tag), ['img', 'bdi'], `${rel}: the logo and the name`);
    assert.equal(page.inside(header, 'a')[0], link, `${rel}: the logo comes before the menu`);
    // The page it opens is the home page: the brand block, one hero - not the About page.
    const target = parsed(`${home}index.html`);
    assert.equal(target.elements.filter((el) => hasClass(el, 'home-brand')).length, 1, `${rel}: the logo opens the page with the brand block`);
    assert.equal(target.elements.filter((el) => el.attrs.id === 'features').length, 0);
    // The "Home" item of the menu leads to the same page; only on the home page itself it is the current item.
    const first = page.inside(page.all('nav')[0], 'a')[0];
    assert.deepEqual([first.attrs.href, page.textOf(first), first.attrs['aria-current']], [link.attrs.href, contentOf(l.code).nav.home, def.id === 'home' ? 'page' : undefined], `${rel}: the first item of the menu is Home`);
  }
  // By their literal addresses.
  const hrefOf = (rel) => /<a class="brand" href="([^"]+)">/.exec(site.pages.get(rel))[1];
  assert.deepEqual(
    ['index.html', 'app/index.html', 'faq/index.html', 'contact/sent/index.html', 'he/index.html', 'he/app/index.html', 'he/downloads/index.html', 'he/contact/error/index.html'].map(hrefOf),
    ['./', '../', '../', '../../', './', '../', '../', '../../'],
  );
});

test('questions: exactly 29, in six groups, each a <details> with a plain <summary>; the links of the answers lead on', () => {
  for (const l of LOCALES) {
    const rel = pageFile('faq', l.code);
    const page = parsed(rel);
    const content = contentOf(l.code);
    const dir = siteDir('faq', l.code);
    const to = (id) => relativeHref(dir, siteDir(id, l.code));
    // Where each target of LINK_TARGETS leads. There is no target for the web version (the owner, 2026-11-23).
    const hrefs = { home: to('home'), privacy: to('privacy'), terms: to('terms'), faq: to('faq'), downloads: to('downloads'), support: `${SITE_URL}${pagePath('support', l.code)}`, delete: `${SITE_URL}${pagePath('delete-account', l.code)}`, contact: '#contact' };
    assert.deepEqual(Object.keys(hrefs).sort(), [...LINK_TARGETS].sort(), 'an address for every link target, and no other');
    assert.equal(page.textOf(page.all('title')[0]), `${content.faq.heading} - ${BRAND}`);
    assert.equal(page.textOf(page.all('h1')[0]), content.faq.heading);
    const groups = page.all('section').filter((el) => hasClass(el, 'group'));
    assert.equal(groups.length, 6, `${rel}: six groups`);
    const details = page.all('details');
    assert.equal(details.length, 29, `${rel}: exactly 29 questions`);
    assert.equal(page.all('summary').length, 29);
    let index = 0;
    groups.forEach((group, g) => {
      const [heading, ...items] = page.children(group);
      assert.deepEqual([heading.tag, page.textOf(heading)], ['h2', content.faq.groups[g]], `${rel}: the heading of group ${g}`);
      assert.deepEqual(items.map((el) => el.tag), Array(FAQ_GROUP_SIZES[g]).fill('details'), `${rel}: group ${g} has ${FAQ_GROUP_SIZES[g]} questions`);
      for (const item of items) {
        const { q, a } = content.faq.items[index];
        const [summary, answer] = page.children(item);
        assert.deepEqual([summary.tag, answer.tag, page.children(item).length], ['summary', 'p', 2], `${rel}: question ${index}`);
        assert.ok(!('open' in item.attrs), `${rel}: question ${index} starts closed`);
        assert.equal(page.textOf(summary), plain(q, l), `${rel}: question ${index}`);
        assert.equal(page.textOf(answer), plain(a, l), `${rel}: answer ${index}`);
        // The summary is plain: no heading inside it (the group headings carry the structure).
        assert.ok(!page.inside(summary).some((el) => /^h[1-6]$/.test(el.tag)), `${rel}: no heading in <summary>`);
        // Every [[target|text]] of the answer is a link to its place, in the order of the text.
        const wanted = [...a.matchAll(/\[\[([a-z]+)\|([^\]]+)\]\]/g)].map((m) => [hrefs[m[1]], m[2]]);
        for (const [href, text] of wanted) assert.equal(typeof href, 'string', `${rel}: the target of the link "${text}" of answer ${index} is known`);
        const found = page.inside(answer, 'a').filter((el) => !el.attrs.href.startsWith('mailto:')).map((el) => [el.attrs.href, page.textOf(el)]);
        assert.deepEqual(found, wanted, `${rel}: the links of answer ${index}`);
        index += 1;
      }
    });
    assert.equal(index, FAQ_COUNT);
    // The publisher and the minimum age come from legal/settings.json.
    assert.ok(page.textOf(details[2]).includes(FILLED.publisherName), `${rel}: who publishes it`);
    assert.ok(page.textOf(details[26]).includes(ageOf(l)), `${rel}: the minimum age`);
    // No answer links to the web version.
    assert.equal(page.all('a').filter((el) => el.attrs.href === `${SITE_URL}/` || el.attrs.href === SITE_URL).length, 0, `${rel}: no link to the web version`);
  }
  // The targets in use: each leads where the specification says (English, by its literal address).
  const page = parsed(pageFile('faq', 'en'));
  const hrefOf = (text) => page.all('a').filter((el) => page.textOf(el) === text).map((el) => el.attrs.href);
  assert.deepEqual(hrefOf('contact form'), ['#contact']);
  assert.deepEqual(hrefOf('Open the web version'), [], 'the answer that opened the web version was deleted with its question (2026-11-23)');
  assert.deepEqual(hrefOf('account-deletion page'), [`${SITE_URL}/delete-account/`]);
  assert.deepEqual([...new Set(hrefOf('Privacy Policy'))], ['../privacy/']);
  assert.deepEqual([...new Set(hrefOf('Downloads'))], ['../downloads/']);
});

test('downloads: three panels in tab order, each a table of File, Version and Size - the rows of site/downloads.json', () => {
  const site = real();
  for (const l of LOCALES) {
    const rel = pageFile('downloads', l.code);
    const page = parsed(rel);
    const content = contentOf(l.code);
    const texts = content.downloads;
    const dir = siteDir('downloads', l.code);
    assert.equal(page.textOf(page.all('title')[0]), `${texts.heading} - ${BRAND}`);
    assert.equal(page.textOf(page.all('h1')[0]), texts.heading);
    const box = page.elements.find((el) => el.attrs.id === 'platforms');
    assert.deepEqual(box.attrs, { class: 'tabs', id: 'platforms', 'data-tabs-label': texts.tabsLabel }, `${rel}: the script names the tab list by this label`);
    const panels = page.children(box);
    assert.deepEqual(panels.map((el) => [el.tag, el.attrs.class, el.attrs.id]), PLATFORMS.map((p) => ['section', 'panel', p]), `${rel}: Windows, Android, Mac - one after the other without script`);
    assert.equal(page.all('table').length, 3);
    for (const [i, platform] of PLATFORMS.entries()) {
      const panel = panels[i];
      const rows = site.downloads[platform];
      const where = `${rel} ${platform}`;
      const [heading] = page.children(panel);
      assert.deepEqual([heading.tag, page.textOf(heading)], ['h2', texts.tabs[platform]], `${where}: the heading the tab takes its name from`);
      const [table] = page.inside(panel, 'table');
      const [caption, thead, tbody] = page.children(table);
      assert.deepEqual([caption.tag, page.textOf(caption)], ['caption', texts.captions[platform]], `${where}: the caption`);
      assert.deepEqual(page.inside(thead, 'th').map((el) => [el.attrs.scope, page.textOf(el)]), [['col', texts.columns.file], ['col', texts.columns.version], ['col', texts.columns.size]], `${where}: exactly the columns File, Version, Size`);
      const trs = page.children(tbody);
      assert.equal(trs.length, rows.length, `${where}: one row per version`);
      rows.forEach((row, r) => {
        const tr = trs[r];
        assert.deepEqual(tr.attrs, { 'data-file': row.file, 'data-bytes': String(row.bytes), 'data-sha256': row.sha256 }, `${where}: row ${r}`);
        const [file, version, size] = page.children(tr);
        assert.deepEqual([file.tag, file.attrs.scope, version.tag, size.tag, page.children(tr).length], ['th', 'row', 'td', 'td', 3], `${where}: the file names its row`);
        const [link] = page.children(file);
        assert.deepEqual([link.tag, link.attrs, page.textOf(link)], ['a', { class: 'get', href: relativeHref(dir, `${FILES_DIR}/${row.file}`), download: '' }, row.file], `${where}: the file name is the download link`);
        assert.deepEqual([page.textOf(version), page.textOf(size)], [row.version, megabytes(row.bytes, l.intl)], `${where}: version and size`);
        assert.ok(site.assets.has(`${FILES_DIR}/${row.file}`), `${where}: the file is in the tree`);
      });
      for (let r = 1; r < rows.length; r += 1) assert.ok(compareVersions(rows[r - 1].version, rows[r].version) > 0, `${where}: newest first`);
      // Under the table: what the platform needs, how to install a file that is not from a store, the checksums.
      const paragraphs = page.children(panel).filter((el) => el.tag === 'p');
      assert.deepEqual(paragraphs.map((el) => page.textOf(el)), [plain(texts.requires[platform], l), plain(texts.install[platform], l)], `${where}: the requirement and the installing note`);
      const check = page.children(panel).at(-1);
      assert.equal(check.tag, 'details', `${where}: "Check the file"`);
      assert.equal(page.textOf(page.children(check)[0]), texts.checkFile);
      assert.equal(page.textOf(page.children(check)[1]), plain(texts.checkText, l));
      const sums = page.inside(check, 'dl')[0];
      assert.deepEqual(page.children(sums).map((el) => [el.tag, page.textOf(el)]), rows.flatMap((row) => [['dt', row.file], ['dd', row.sha256]]), `${where}: the SHA-256 of each row`);
      for (const code of page.inside(sums, 'code')) assert.equal(code.attrs.dir, 'ltr');
      // site/settings.json names no store link today (the settings test: "nothing is published yet"), and the checks
      // of the real tree describe the pages as they are without one: this one, the missing iPhone section and the
      // links of the page below, and the end of the page in the test "the web version: the pages of all 20 languages
      // ...". On the day the owner sets a link they must follow; the page with links is described by the next test.
      assert.equal(page.inside(panel, 'a').length, rows.length, `${where}: no store link while none is set`);
    }
    // Under the tabs: nothing. The iPhone section (heading, sentence, button of the App Store) stands there only while
    // an App Store link is set - the next test. The note about the iPhone that stood there without a link
    // (downloads.iphone) is gone - the owner, 2026-11-24 - and so is, since 2026-11-23, the paragraph about the web
    // version with its link (downloads.web).
    assert.equal(page.all('section').find((el) => hasClass(el, 'more')), undefined, `${rel}: no section under the tabs while no App Store link is set`);
    assert.ok(!('web' in texts) && !('iphone' in texts), `${rel}: the content file has no text about the web version and no note about the iPhone`);
    assert.equal(typeof texts.moreHeading, 'string', `${rel}: the heading of the iPhone section waits for the App Store link`);
    assert.deepEqual(page.elements.filter((el) => /^h[1-6]$/.test(el.tag)).map((el) => el.tag), ['h1', 'h2', 'h2', 'h2', 'h2'], `${rel}: three platforms, "Contact us"`);
    // The only links of the page content are the installer files.
    assert.deepEqual(page.inside(page.all('main')[0], 'a').map((el) => el.attrs.class), PLATFORMS.flatMap((platform) => site.downloads[platform].map(() => 'get')), `${rel}: the links of the page are the download links (while no store link is set)`);
  }
  assert.equal(parsed(pageFile('downloads', 'en')).textOf(parsed(pageFile('downloads', 'en')).all('caption')[0]), 'Installation files for Windows, newest version first');
});

test('downloads: a store link that is set stands above the table of its platform; the iPhone link brings its own section under the tabs', () => {
  const links = { googlePlay: 'https://play.google.com/store/apps/details?id=app.yourpersonaldiary&hl=en', appStoreIphone: 'https://apps.apple.com/app/id1234567890', appStoreMac: null, microsoftStore: null };
  const site = buildSite({ settings: FILLED, siteSettings: { ...SITE_SETTINGS, links } });
  for (const code of ['en', 'he']) {
    const rel = pageFile('downloads', code);
    const html = site.pages.get(rel);
    const page = parse(html, `${rel} with store links`);
    const texts = contentOf(code).downloads;
    const l = LOCALES.find((x) => x.code === code);
    const panelOf = (id) => page.elements.find((el) => el.attrs.id === id);
    const storeLinks = (el) => page.inside(el, 'a').filter((a) => hasClass(a, 'btn'));
    const android = panelOf('android');
    assert.deepEqual(storeLinks(android).map((a) => [a.attrs.href, page.textOf(a)]), [[links.googlePlay, texts.storeLinks.googlePlay]], `${rel}: Google Play in the Android panel`);
    assert.ok(page.elements.indexOf(storeLinks(android)[0]) < page.elements.indexOf(page.inside(android, 'table')[0]), `${rel}: above the table`);
    assert.ok(html.includes('href="https://play.google.com/store/apps/details?id=app.yourpersonaldiary&amp;hl=en"'), 'the link is escaped');
    for (const id of ['windows', 'mac']) assert.deepEqual(storeLinks(panelOf(id)), [], `${rel}: ${id} has no store link yet`);
    const more = page.all('section').find((el) => hasClass(el, 'more'));
    assert.ok(more && page.elements.indexOf(more) > page.elements.indexOf(panelOf('mac')), `${rel}: with an App Store link the iPhone section stands under the tabs`);
    assert.ok(!more.parents.includes(page.elements.find((el) => el.attrs.id === 'platforms')), `${rel}: the iPhone section stands outside the box of the tabs, not inside it`);
    assert.deepEqual(storeLinks(more).map((a) => [a.attrs.href, page.textOf(a)]), [[links.appStoreIphone, texts.storeLinks.appStoreIphone]], `${rel}: the App Store link in the iPhone section`);
    assert.equal(page.textOf(page.children(more)[0]), texts.moreHeading, `${rel}: the heading of the iPhone section`);
    assert.ok(page.textOf(more).includes(plain(texts.iphoneStore, l)), `${rel}: the sentence of the App Store link`);
    // Under the tabs: the heading, the iPhone sentence and the button of the App Store - still no word about a browser.
    assert.deepEqual(page.children(more).map((el) => [el.tag, el.attrs.class]), [['h2', undefined], ['p', undefined], ['p', 'actions']], `${rel}: the heading, the sentence, the store link`);
    assert.equal(page.inside(more, 'a').length, 1, `${rel}: the one link under the tabs is the App Store`);
    const hosts = new Set([...html.matchAll(/https?:\/\/([^/"'\s<>)]+)/g)].map((m) => m[1]));
    assert.deepEqual([...hosts].sort(), ['apps.apple.com', 'play.google.com', SERVER_HOST].sort(), `${rel}: the store hosts appear only because the settings name them`);
  }
  // No other page names a store host.
  for (const [rel, html] of site.pages) if (!rel.endsWith('downloads/index.html')) assert.ok(!/play\.google\.com|apps\.apple\.com/.test(html), rel);
});

test('legal pages: the whole document of legal/ inside the frame, the standalone page as canonical, the links of the site', () => {
  for (const kind of LEGAL_KINDS) {
    for (const l of LOCALES) {
      const rel = pageFile(kind, l.code);
      const page = parsed(rel);
      const dir = siteDir(kind, l.code);
      const { meta, body } = parseSource(readFileSync(legalSourceFile(ROOT, kind, l.code), 'utf8'), rel);
      assert.equal(page.textOf(page.all('title')[0]), meta.title, `${rel}: the title of the document`);
      assert.equal(page.all('meta').find((el) => el.attrs.name === 'description').attrs.content, meta.description);
      const doc = page.elements.find((el) => hasClass(el, 'doc'));
      assert.ok(doc.parents.includes(page.all('main')[0]));
      // Every heading, paragraph and list item of the source is in the page, in order.
      const source = markdownToHtml(body);
      const count = (html, tag) => html.split(`<${tag}>`).length - 1;
      for (const tag of ['h1', 'h2', 'h3', 'p', 'li', 'ul', 'ol', 'strong']) assert.equal(page.inside(doc, tag).length, count(source, tag), `${rel}: every <${tag}> of the source`);
      const headings = [...body.matchAll(/^(#{1,3})\s+(.*)$/gm)].map((m) => [`h${m[1].length}`, m[2].trim()]);
      assert.ok(headings.length >= 10 && headings[0][0] === 'h1', `${rel}: the source has its headings`);
      const found = page.inside(doc).filter((el) => /^h[1-3]$/.test(el.tag));
      assert.deepEqual(found.map((el) => el.tag), headings.map(([tag]) => tag), `${rel}: the headings of the source, in order`);
      found.forEach((el, i) => {
        if (!headings[i][1].includes('{{') && !/[*`[\]]/.test(headings[i][1])) assert.equal(page.textOf(el), headings[i][1], `${rel}: heading ${i}`);
      });
      // The effective date of this document, written out in the language of the page.
      assert.ok(page.textOf(doc).includes(dateInWords(kind === 'terms' ? FILLED.termsEffectiveDate : FILLED.effectiveDate, l.intl)), `${rel}: the effective date`);
      // The links: the two documents of the site lead to the site's own pages of the same language (relative);
      // the support page and the deletion page stay on the server. The address of the server itself, where the web
      // version is, is NOT a link inside the site (the owner's rule of 2026-11-23): the document still names it -
      // the web version is part of the service it describes - but as text, read left to right.
      const other = kind === 'terms' ? 'privacy' : 'terms';
      const allowed = new Set([relativeHref(dir, siteDir('terms', l.code)), relativeHref(dir, siteDir('privacy', l.code)), `${SITE_URL}${pagePath('support', l.code)}`, `${SITE_URL}${pagePath('delete-account', l.code)}`, `mailto:${FILLED.contactEmail}`]);
      const hrefs = page.inside(doc, 'a').map((el) => el.attrs.href);
      for (const href of hrefs) assert.ok(allowed.has(href), `${rel}: the link ${href}`);
      assert.ok(!hrefs.includes(SITE_URL) && !hrefs.includes(`${SITE_URL}/`), `${rel}: no link to the web version`);
      assert.ok(hrefs.includes(relativeHref(dir, siteDir(other, l.code))), `${rel}: links the other document inside the site`);
      assert.ok(!hrefs.includes(`${SITE_URL}${pagePath(other, l.code)}`), `${rel}: not the standalone page`);
      // Every place where the source names the address of the server shows it, isolated, and none of them is a link.
      const named = body.split('[{{SITE_URL}}]({{SITE_URL}})').length - 1;
      assert.equal(body.split('{{SITE_URL}}').length - 1, named * 2, `${rel}: the source names the address of the server only as [{{SITE_URL}}]({{SITE_URL}})`);
      assert.equal(named, kind === 'terms' ? 2 : 1, `${rel}: the source names the address of the server`);
      const shown = page.inside(doc, 'bdi').filter((el) => el.attrs.dir === 'ltr' && page.textOf(el) === SITE_URL);
      assert.equal(shown.length, named, `${rel}: the address of the server, as text, wherever the document names it`);
      for (const el of shown) assert.ok(!el.parents.some((parent) => parent.tag === 'a') && page.inside(el).length === 0, `${rel}: the address of the server is not a link`);
      // (An address below it - the support page, the page of the site - is another address: only the bare one counts.)
      const bare = new RegExp(`${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![/\\w.-])`);
      assert.equal(page.texts.filter((node) => bare.test(node.text) && node.parents.includes(doc)).length, named, `${rel}: and it stands nowhere else in the document`);
      // Where the document shows such an address as text, it shows the address of the site's page.
      for (const el of page.inside(doc, 'a')) {
        const text = page.textOf(el);
        if (/^https:/.test(text) && el.attrs.href.startsWith('.')) assert.equal(text, `${SITE_BASE}${resolveAddress(dir, el.attrs.href)}`, `${rel}: the address shown is where the link leads`);
      }
    }
  }
  const terms = parsed(pageFile('terms', 'en'));
  assert.equal(terms.textOf(terms.all('h1')[0]), 'Terms of Use - Your Personal Diary');
  assert.ok(terms.all('a').some((el) => el.attrs.href === '../privacy/' && terms.textOf(el) === `${SITE_BASE}privacy/`));
  assert.deepEqual(terms.all('link').filter((el) => el.attrs.rel === 'canonical').map((el) => el.attrs.href), [`${SITE_URL}/terms/`], 'the stores and the apps link to the standalone page');
  assert.deepEqual(parsed(pageFile('privacy', 'he')).all('link').filter((el) => el.attrs.rel === 'canonical').map((el) => el.attrs.href), [`${SITE_URL}/privacy/he/`]);
  // By its literal markup, English: the policy names the website with its address - the words of legal/ unchanged,
  // the address as text. (The standalone page, which scripts/legal/build-pages.mjs writes, keeps the link.)
  const policy = real().pages.get(pageFile('privacy', 'en'));
  assert.ok(policy.includes(`the <strong>iPhone app</strong> (App Store) and the <strong>website</strong> <bdi dir="ltr">${SITE_URL}</bdi>. All of them use the same server and the same account.`), 'en: the address of the server in the policy is text');
  assert.ok(!policy.includes(`<a href="${SITE_URL}"`) && !real().pages.get(pageFile('terms', 'en')).includes(`<a href="${SITE_URL}"`), 'en: and not a link, in the policy and in the terms');
  assert.ok(real().pages.get(pageFile('terms', 'en')).includes(`we will announce it on <bdi dir="ltr">${SITE_URL}</bdi> at least 30 days before it ends.`), 'en: the terms name where the end of the service would be announced');
});

test("legal pages: the Mac item of the policy says nothing about Apple's signature, in any language (the owner, 2026-11-23)", () => {
  // The "Mac app" item of section 5 ended with "Once the app is distributed with Apple's signature, the item will move
  // to the keychain that stays on this Mac only." The owner had the sentence deleted - not reworded - in all 20
  // languages: like the texts of the site (his rule of 2026-11-22, above), the policy does not tell a reader that the
  // app is not signed yet. The item is found by the product names, which stay in Latin letters in every language;
  // since the deletion it names no "Apple" at all. The rule on the sources, with the proof that it is not blind, is in
  // scripts/legal/build-pages.test.mjs.
  for (const l of LOCALES) {
    const rel = pageFile('privacy', l.code);
    const page = parsed(rel);
    const doc = page.elements.find((el) => hasClass(el, 'doc'));
    const items = page.inside(doc, 'li').map((el) => page.textOf(el)).filter((text) => text.includes('Migration Assistant'));
    assert.equal(items.length, 1, `${rel}: one list item names Migration Assistant`);
    assert.ok(!items[0].includes('Apple'), `${rel}: the Mac item names Apple - the sentence about Apple's signature is back`);
    for (const name of ['Time Machine', 'iCloud Keychain']) assert.ok(items[0].includes(name), `${rel}: the Mac item still names ${name}`);
    // In English, word for word: the item ends with the sentence about the copies.
    if (l.code === DEFAULT_LOCALE) assert.ok(items[0].endsWith('A Migration Assistant or Time Machine copy of your user account carries the item, still protected by that password.'), `${rel}: the end of the Mac item`);
  }
});

test('legal pages: a translation without a heading or a list item of the English document is behind it', () => {
  const en = legalSource('privacy');
  assert.deepEqual(legalOutline(en).map((h) => [h.level, h.items]), [[1, 0], [2, 0], [2, 3], [3, 0]]);
  // A paragraph more (the note on the English version) is no gap; a list item, a heading or a level is.
  assert.equal(legalOutlineGap(en.replace('## 1. Who we are', 'A note on the English version.\n\n## 1. Who we are'), en), null);
  assert.equal(legalOutlineGap(en, en.replace('- Support:', '- An item that was added to English.\n- Support:')), '"2. The other documents": 3 list items, English 4');
  assert.equal(legalOutlineGap(en.replace('### 2.1 Age', ''), en), '3 headings, English 4');
  assert.equal(legalOutlineGap(en.replace('### 2.1 Age', '## 2.1 Age'), en), 'its headings are not those of the English document');
  // The real tree: the result agrees with the sources, and a document that did not change has no gap.
  const behind = real().behind.map((entry) => entry.split(' ')[0]);
  for (const kind of LEGAL_KINDS) {
    const base = readFileSync(legalSourceFile(ROOT, kind, DEFAULT_LOCALE), 'utf8');
    for (const code of CODES.filter((c) => c !== DEFAULT_LOCALE)) {
      const name = `legal/${kind}/${kind}-${code}.md`;
      assert.equal(behind.includes(name), legalOutlineGap(readFileSync(legalSourceFile(ROOT, kind, code), 'utf8'), base) !== null, name);
    }
  }
  assert.ok(!behind.some((name) => name.startsWith('legal/terms/')), 'every translation of the Terms of Use has the outline of the English one');
});

test('result pages: a heading, a sentence or two and the way back - no contact block, noindex', () => {
  for (const l of LOCALES) {
    const content = contentOf(l.code);
    for (const [id, heading, text] of [['sent', content.contact.sentTitle, content.contact.sentText], ['error', content.contact.errorTitle, content.contact.errorText]]) {
      const rel = pageFile(id, l.code);
      const page = parsed(rel);
      const [mainEl] = page.all('main');
      assert.equal(page.textOf(page.all('title')[0]), `${heading} - ${BRAND}`);
      assert.equal(page.textOf(page.all('h1')[0]), heading, `${rel}: the heading`);
      assert.deepEqual(page.elements.filter((el) => /^h[1-6]$/.test(el.tag)).length, 1, `${rel}: nothing but the h1`);
      const lead = page.inside(mainEl, 'p').find((el) => hasClass(el, 'lead'));
      assert.equal(page.textOf(lead), plain(text, l), `${rel}: the text`);
      const back = page.inside(mainEl, 'a').filter((el) => hasClass(el, 'btn'));
      assert.deepEqual(back.map((el) => [el.attrs.href, page.textOf(el)]), [[relativeHref(siteDir(id, l.code), siteDir('home', l.code)), content.contact.backHome]], `${rel}: back to the home page of the language`);
      // The error page gives the e-mail address as the other way.
      assert.deepEqual(page.inside(mainEl, 'a').filter((el) => el.attrs.href.startsWith('mailto:')).map((el) => el.attrs.href), id === 'error' ? [`mailto:${FILLED.contactEmail}`] : [], `${rel}: the e-mail address`);
      assert.equal(page.all('meta').find((el) => el.attrs.name === 'robots').attrs.content, 'noindex');
    }
  }
});

test('pages: in the right-to-left pages every Latin fragment, number and address is isolated', () => {
  for (const code of ['he', 'ar']) {
    for (const def of SITE_PAGES) {
      const rel = pageFile(def.id, code);
      const page = parsed(rel);
      // <title> and <option> hold text only; an option is one name in one script.
      const isolated = (node) => node.parents.slice(1).some((el) => el.tag === 'bdi' || 'dir' in el.attrs || el.tag === 'title' || el.tag === 'option');
      const loose = page.texts.filter((node) => /[\p{Script=Latin}0-9]/u.test(node.text) && !isolated(node));
      assert.deepEqual(loose.map((node) => node.text), [], `${rel}: Latin text outside <bdi>`);
      for (const mail of page.all('a').filter((el) => el.attrs.href.startsWith('mailto:'))) {
        const inner = page.children(mail)[0];
        assert.ok(mail.attrs.dir === 'ltr' || (inner?.tag === 'bdi' && inner.attrs.dir === 'ltr'), `${rel}: the e-mail address reads left to right`);
      }
    }
  }
  // File names and checksums are left-to-right fragments in every language.
  const downloads = parsed(pageFile('downloads', 'he'));
  for (const link of downloads.all('a').filter((el) => hasClass(el, 'get'))) assert.deepEqual(downloads.children(link).map((el) => [el.tag, el.attrs.dir]), [['bdi', 'ltr']]);
  // A left-to-right page needs no isolation of its own script, only the fixed pieces. Since 2026-11-22 what the
  // English home page held (the hero, the cards, the screens, the privacy list) is on two pages: both are checked.
  for (const id of ['home', 'about']) {
    const html = real().pages.get(pageFile(id, 'en'));
    assert.equal((html.match(/<bdi>/g) ?? []).length, CODES.length, `en ${id}: only the names of the language list`);
  }
});

test('pages: the publisher, the e-mail address and the minimum age come from legal/settings.json', () => {
  // The minimum age, in the digits of the language.
  const older = buildSite({ settings: { ...FILLED, minimumAge: 17 } });
  for (const l of LOCALES) {
    const rel = pageFile('faq', l.code);
    const page = parse(older.pages.get(rel), rel);
    const age = ageOf(l, 17);
    assert.ok(older.pages.get(rel).includes(`<bdi>${age}</bdi>`), `${l.code}: ${age}, isolated`);
    assert.equal(page.textOf(page.children(page.all('details')[26])[1]), plain(contentOf(l.code).faq.items[26].a, l, { ...FILLED, minimumAge: 17 }), `${l.code}: the sentence of the content file with the number of the settings`);
  }
  // A setting that is not set yet leaves its placeholder visible, as in the legal pages.
  const unset = buildSite({ settings: { ...FILLED, publisherName: null, contactEmail: null } });
  assert.deepEqual(unset.unset.sort(), ['CONTACT_EMAIL', 'PUBLISHER_NAME']);
  const faq = unset.pages.get(pageFile('faq', 'en'));
  assert.ok(faq.includes('is published and operated by {{PUBLISHER_NAME}}.'));
  assert.ok(faq.includes('<p>{{CONTACT_EMAIL}}</p>') && !faq.includes('mailto:'), 'the contact block shows the placeholder, not a broken link');
  assert.ok(unset.pages.get(pageFile('error', 'en')).includes('or write to us by e-mail: {{CONTACT_EMAIL}}'));
  assert.ok(unset.pages.get(pageFile('terms', 'en')).includes('{{PUBLISHER_NAME}}'));
  // The base address of the site: only the absolute addresses of the head follow it.
  const moved = movedSite();
  assert.equal(MOVED_BASE, 'https://diary.example.org/');
  assert.equal(moved.siteBase, 'https://diary.example.org/');
  const home = moved.pages.get(pageFile('faq', 'he'));
  assert.ok(home.includes('<link rel="canonical" href="https://diary.example.org/he/faq/">'));
  assert.ok(home.includes('<link rel="alternate" hreflang="x-default" href="https://diary.example.org/faq/">'));
  assert.ok(home.includes('<meta property="og:image" content="https://diary.example.org/img/share.png">'));
  const strip = (html) => html.split('\n').filter((line) => !/^<(?:link rel="(?:canonical|alternate)"|meta property="og:(?:url|image)")/.test(line)).join('\n');
  for (const def of SITE_PAGES.filter((p) => !p.legal)) assert.equal(strip(moved.pages.get(pageFile(def.id, 'he'))), strip(real().pages.get(pageFile(def.id, 'he'))), `${def.id}: everything else is the same page`);
  assert.ok(moved.pages.get(pageFile('terms', 'en')).includes('<a href="../privacy/" dir="ltr">https://diary.example.org/privacy/</a>'), 'a legal document shows the address of the page on the new site');
  assert.ok(moved.pages.get(pageFile('terms', 'en')).includes(`<link rel="canonical" href="${SITE_URL}/terms/">`), 'and keeps the standalone page as canonical');
});

// ---------------------------------------------------------------------------------------------
// The look: the app's colours, contrast, direction, nothing that moves
// ---------------------------------------------------------------------------------------------

test('style: site.css - the app theme tokens, contrast of at least 4.5:1 (controls 3:1), logical properties, no motion', () => {
  const css = real().files.get(CSS_NAME);
  assert.ok(Buffer.byteLength(css, 'utf8') < MAX_CSS_BYTES, `site.css is ${Buffer.byteLength(css, 'utf8')} bytes, under ${MAX_CSS_BYTES}`);
  const lightBlockOf = /^:root\{color-scheme:light dark;([^}]*)\}/.exec(css);
  const darkBlockOf = /@media \(prefers-color-scheme:dark\)\{:root\{([^}]*)\}\}/.exec(css);
  assert.ok(lightBlockOf && darkBlockOf, 'the style sheet starts with the light variables and has the dark ones');
  const vars = (block) => Object.fromEntries(block.split(';').map((d) => d.split(':')).map(([k, ...v]) => [k.replace(/^--/, ''), v.join(':')]));
  const light = vars(lightBlockOf[1]);
  const dark = vars(darkBlockOf[1]);
  const rules = css.replace(lightBlockOf[0], '').replace(darkBlockOf[0], '');
  // The values come from src/styles/tokens.css: the light theme from :root, the dark one from [data-theme="dark"].
  const tokens = readFileSync(path.join(ROOT, TOKENS_FILE), 'utf8');
  const lightBlock = /:root \{([^}]*)\}/.exec(tokens)[1];
  const darkBlock = /\[data-theme="dark"\] \{([^}]*)\}/.exec(tokens)[1];
  const token = (block, name) => new RegExp(`--${name}:\\s*([^;]+);`).exec(block)[1].trim();
  assert.deepEqual(Object.keys(light), Object.keys(THEME_TOKENS));
  assert.deepEqual(Object.keys(dark), Object.keys(THEME_TOKENS));
  for (const [name, source] of Object.entries(THEME_TOKENS)) {
    assert.equal(light[name], token(lightBlock, typeof source === 'string' ? source : source.light), `light --${name}`);
    assert.equal(dark[name], token(darkBlock, typeof source === 'string' ? source : source.dark), `dark --${name}`);
  }
  assert.equal(light.accent, '#2b4c7e', 'the navy of the app');
  assert.deepEqual(readThemeTokens(), { light, dark });

  // Contrast: every text / background pair the style sheet uses, and every mark of a control, in both themes.
  for (const [mode, theme] of Object.entries({ light, dark })) {
    for (const [text, background] of COLOR_PAIRS) {
      const ratio = contrast(theme[text], theme[background]);
      assert.ok(ratio >= 4.5, `${mode}: --${text} on --${background} is ${ratio.toFixed(2)}:1`);
    }
    for (const [mark, background] of CONTROL_PAIRS) {
      const ratio = contrast(theme[mark], theme[background]);
      assert.ok(ratio >= 3, `${mode}: the mark --${mark} on --${background} is ${ratio.toFixed(2)}:1`);
    }
  }
  // Completeness: the rules use no literal colour, every text colour and every background is in the list of
  // pairs (or is pure decoration), and every variable that is defined is used.
  assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(rules), 'the rules name colours only through the variables');
  assert.ok(!/(?:color|background|border[a-z-]*|outline|fill|stroke|box-shadow):[^;}]*\b(?:white|black|red|green|blue|gray|grey|silver|navy)\b/i.test(rules), 'no named colour either');
  const used = (re) => [...new Set([...rules.matchAll(re)].map((m) => m[1]))];
  const textColours = used(/(?:^|[;{])color:var\(--([a-z-]+)\)/gm);
  const backgrounds = used(/background(?:-color)?:[^;}]*?var\(--([a-z-]+)\)/g).concat(used(/linear-gradient\(var\(--[a-z-]+\),var\(--([a-z-]+)\)\)/g));
  const pairText = new Set(COLOR_PAIRS.map(([text]) => text));
  const pairBackground = new Set(COLOR_PAIRS.map(([, background]) => background));
  assert.ok(textColours.length >= 5 && backgrounds.length >= 5, 'the style sheet was read');
  for (const name of textColours) assert.ok(pairText.has(name), `color:var(--${name}) is a text colour of COLOR_PAIRS`);
  for (const name of backgrounds) assert.ok(pairBackground.has(name) || DECOR_COLORS.includes(name), `background var(--${name}) is a background of COLOR_PAIRS`);
  for (const name of pairText) assert.ok(textColours.includes(name), `--${name} of COLOR_PAIRS is used as a text colour`);
  for (const name of pairBackground) assert.ok(backgrounds.includes(name), `--${name} of COLOR_PAIRS is used as a background`);
  for (const name of DECOR_COLORS) assert.ok(!pairText.has(name) && !pairBackground.has(name) && !textColours.includes(name), `--${name} is decoration only`);
  for (const name of Object.keys(THEME_TOKENS)) assert.ok(rules.includes(`var(--${name})`), `--${name} is used`);
  for (const m of rules.matchAll(/var\(--([a-z-]+)\)/g)) assert.ok(m[1] in THEME_TOKENS, `var(--${m[1]}) is defined`);
  for (const [mark, background] of CONTROL_PAIRS) assert.ok(mark in THEME_TOKENS && background in THEME_TOKENS, `${mark} on ${background}`);
  // The borders of the fields, the language list and the selected tab are the strong line; the focus ring is the focus colour.
  assert.match(css, /\.field input,\.field textarea\{[^}]*border:1px solid var\(--line-strong\)/);
  assert.match(css, /\.chooser select\{[^}]*border:1px solid var\(--line-strong\)/);
  assert.match(css, /\.tab\[aria-selected=true\]\{border-color:var\(--line-strong\)/);

  // Right to left by logical properties only; nothing moves; the fonts of the legal pages; a visible focus ring.
  assert.ok(!/\b(?:left|right)\b/.test(rules), 'no physical left / right in the style sheet');
  assert.ok(!/transition|animation|@keyframes|scroll-behavior|marquee|blink/i.test(css), 'no transition and no animation');
  assert.ok(!/@import|@font-face|url\(/i.test(css), 'no other file is loaded by the style sheet');
  assert.ok(css.includes(`font:1rem/1.6 ${FONT_STACK};`));
  assert.ok(readFileSync(path.join(ROOT, 'scripts', 'legal', 'build-pages.mjs'), 'utf8').includes(`font:16px/1.6 ${FONT_STACK};`), 'the font stack of the legal pages');
  assert.match(css, /^a:focus-visible,summary:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,\.strip:focus-visible,\.panel:focus-visible\{outline:3px solid var\(--focus\);outline-offset:2px\}$/m);
  assert.ok(!/outline:(?:0|none)/.test(css), 'the focus ring is never removed');
  assert.ok(css.includes('overflow-x:auto;scroll-snap-type:x'), 'the screenshot strip scrolls with scroll-snap');
  assert.ok(css.endsWith('\n') && !css.includes('\r'));
  // Targets: the logo, the menu, buttons, tabs, questions, download links, the language list and the fields are
  // at least 44 px high (2.75rem).
  for (const selector of ['.brand', '.menu a', '.btn', '.qa summary', '.tab', '.get', '.chooser select', '.langs a', '.field input,.field textarea', '.send .btn']) {
    assert.match(css, new RegExp(`^${selector.replace(/[.]/g, '\\.')}\\{[^}]*min-height:(?:2\\.75|3)rem`, 'm'), `${selector} is at least 44 px high`);
  }
  // The brand block of the home page (2026-11-22): the icon about 6rem wide and smaller on a narrow screen, the name
  // in the colour of the logo, a row that may wrap; the head of the About page starts like the other pages. Sizes in
  // rem, never in pixels, so that nothing breaks on a narrow screen.
  assert.match(css, /^\.home-icon\{flex:none;width:4rem;height:4rem\}$/m);
  assert.match(css, /^@media \(min-width:34rem\)\{.*\.home-icon\{width:6rem;height:6rem\}\}$/m);
  assert.match(css, /^\.home-brand\{display:flex;flex-wrap:wrap;[^}]*color:var\(--accent\)\}$/m);
  assert.match(css, /^\.home-brand bdi\{white-space:normal\}$/m, 'the name may wrap when there is no room for it in one line');
  assert.match(css, /^\.page-head\{padding-block-start:2\.5rem\}$/m);
  assert.ok(COLOR_PAIRS.some(([text, background]) => text === 'accent' && background === 'bg'), 'the name of the app stands in the accent colour on the hero: the pair is computed above');
  const added = [...css.matchAll(/\.(?:home-brand|home-icon|page-head)[^{}]*\{[^}]*\}/g)].map((m) => m[0]);
  assert.equal(added.length, 7, 'the rules of the brand block and of the page head, on a narrow and on a wide screen');
  for (const rule of added) assert.ok(!/\dpx/.test(rule), `${rule}: no pixel size`);
  // What the script adds is styled; a panel is hidden by the hidden attribute.
  assert.match(css, /^\[hidden\]\{display:none!important\}$/m);
  for (const selector of ['.tablist{', '.tab{', '.tab[aria-selected=true]{', '.tabs-on .panel{']) assert.ok(css.includes(`\n${selector}`), `${selector} has its rule`);
  // Every class a page uses has a rule or is a hook of the script, and the other way round.
  const inCss = new Set([...css.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1]).filter((name) => !/^\d/.test(name)));
  const inPages = new Set();
  for (const [, html] of real().pages) for (const m of html.matchAll(/ class="([^"]+)"/g)) for (const name of m[1].split(' ')) inPages.add(name);
  const SCRIPT_CLASSES = ['tablist', 'tab', 'tabs-on'];
  // The iPhone section under the tabs of the Downloads page (.more) is on a page only while an App Store link is set
  // (2026-11-24: the note that stood there without a link is gone). No page of the real tree has it today; the page
  // with the link does, and its rule waits for that day.
  const STORE_LINK_CLASSES = ['more'];
  const withStoreLink = buildSite({ settings: FILLED, siteSettings: { ...SITE_SETTINGS, links: { ...NO_LINKS, appStoreIphone: 'https://apps.apple.com/app/id1234567890' } } });
  const inStoreLinkPages = new Set();
  for (const [, html] of withStoreLink.pages) for (const m of html.matchAll(/ class="([^"]+)"/g)) for (const name of m[1].split(' ')) inStoreLinkPages.add(name);
  for (const name of STORE_LINK_CLASSES) assert.ok(!inPages.has(name) && inStoreLinkPages.has(name), `.${name} is on a page only once an App Store link is set`);
  for (const name of inStoreLinkPages) assert.ok(inCss.has(name), `the class ${name} of a page with a store link has a rule`);
  for (const name of inPages) assert.ok(inCss.has(name), `the class ${name} of a page has a rule`);
  for (const name of inCss) assert.ok(inPages.has(name) || SCRIPT_CLASSES.includes(name) || STORE_LINK_CLASSES.includes(name), `the rule of .${name} is used by a page, by the script, or by the page with an App Store link`);
});

test('script: site.js is small, is published as it is, and holds nothing forbidden', () => {
  const source = readFileSync(path.join(ROOT, SCRIPT_FILE), 'utf8');
  assert.ok(!source.includes('\r') && source.charCodeAt(0) !== 0xfeff && source.endsWith('\n'));
  assert.equal(real().files.get(SCRIPT_NAME), source);
  assert.ok(Buffer.byteLength(source, 'utf8') < MAX_SCRIPT_BYTES, `site.js is ${Buffer.byteLength(source, 'utf8')} bytes, under ${MAX_SCRIPT_BYTES}`);
  assert.deepEqual(scriptProblems(source), []);
  // The list covers what SITE.md names, and each pattern catches its thing.
  const SAMPLES = [
    "fetch('./x')", 'new XMLHttpRequest()', "new WebSocket('x')", "new EventSource('x')", "navigator.sendBeacon('x')", "import('./more.js')", "import x from './x.js';",
    "importScripts('x.js')", "new Worker('w.js')", "eval('1')", "new Function('return 1')()", "localStorage.setItem('a', 'b')", "sessionStorage.getItem('a')", "indexedDB.open('db')",
    "document.cookie = 'a=b'", "var u = 'https://example.org/'", "var u = '//example.org/x'", "var u = 'www.example.org'", "el.innerHTML = '<b>x</b>'", "document.write('x')",
  ];
  for (const sample of SAMPLES) assert.equal(scriptProblems(`(function () {\n${sample};\n})();`).length >= 1, true, `${sample} is refused`);
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'import(']) assert.ok(SCRIPT_FORBIDDEN.some(([label]) => label === name), `${name} is on the list`);
  assert.deepEqual(scriptProblems('var a = 1; // nothing here'), []);
  // A classic script for every browser: no module syntax, no arrow function, no template text.
  assert.ok(!/=>|`|\bconst\b|\blet\b|\bclass\b|\basync\b|\bawait\b/.test(source), 'plain ES5');
  assert.match(source, /^\(function \(\) \{\n {2}'use strict';/m);
  // The pages give the script what it looks for.
  for (const id of ['lang-chooser', 'lang-select', 'lang-change', 'lang-list', 'platforms']) assert.ok(source.includes(`getElementById('${id}')`), `the script uses #${id}`);
  assert.ok(source.includes("querySelectorAll('.panel')") && source.includes("getAttribute('data-tabs-label')"));
});

// ---------------------------------------------------------------------------------------------
// Hosted-only
// ---------------------------------------------------------------------------------------------

test('hosted-only: the site is in no client tree (public/ goes into every installer and bundle)', () => {
  // public/ is copied into dist/, and dist/ into the Windows and Mac installers; mobile-dist/ into the Android and
  // iPhone bundles. None of them may hold an "about" entry: scripts/hosted/stage-image.mjs adds it to the hosted image only.
  for (const tree of ['public', 'dist', 'mobile-dist', 'android/app/src/main/assets/public', 'ios/App/App/public', 'src-tauri/resources/server/ui', 'deploy/hosted/build/ui']) {
    assert.ok(!existsSync(path.join(ROOT, ...tree.split('/'), SITE_ID)), `${tree}/${SITE_ID} must not exist`);
  }
  const ignored = readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/);
  assert.ok(ignored.includes('site/out'), 'the preview folder is git-ignored');
  assert.ok(ignored.includes('site/downloads/'), 'the installer files are git-ignored');
  const stage = readFileSync(path.join(ROOT, 'scripts', 'hosted', 'stage-image.mjs'), 'utf8');
  assert.ok(stage.includes("from '../site/build-site.mjs'"), 'stage-image.mjs builds the site into the hosted image');
  // No source of a client names the site's files.
  for (const file of ['index.html', 'vite.config.ts', 'capacitor.config.ts']) assert.ok(!/site\/(?:content|downloads|site\.js)/.test(readFileSync(path.join(ROOT, file), 'utf8')), file);
});

// ---------------------------------------------------------------------------------------------
// Fixture trees: problems, the command line, --strict, identical builds
// ---------------------------------------------------------------------------------------------

test('fixture tree: one error lists every problem - a text, a link, an image, a document, an installer, the script, a setting', () => {
  const root = fixture();
  try {
    const site = buildSite({ root });
    assert.equal(site.pages.size, PAGE_COUNT);
    assert.equal(site.assets.size, IMAGE_COUNT + 3);
    assert.deepEqual(site.untranslated, []);
    assert.deepEqual(site.behind, []);
    assert.equal(site.siteBase, `${FIXTURE_HOST}/about/`);
    assert.ok(site.pages.get('index.html').includes(`<link rel="canonical" href="${FIXTURE_HOST}/about/">`));
    assert.ok(site.pages.get('he/terms/index.html').includes(`<a href="../privacy/" dir="ltr">${FIXTURE_HOST}/about/he/privacy/</a>`), 'the document shows the address of the page of the site');
    assert.ok(site.pages.get('he/terms/index.html').includes(`<a href="${FIXTURE_HOST}/support/he/" dir="ltr">${FIXTURE_HOST}/support/he/</a>`), 'the support page stays outside');
    // The address of the server itself is text, not a link (the owner's rule of 2026-11-23), on another server too.
    for (const rel of ['terms/index.html', 'de/privacy/index.html']) assert.ok(site.pages.get(rel).includes(`The website: <bdi dir="ltr">${FIXTURE_HOST}</bdi>.`), `${rel}: the address of the server as text`);
    assert.ok(site.pages.get('he/privacy/index.html').includes(`<bdi dir="ltr">${FIXTURE_HOST}</bdi>`), 'he: and in a right-to-left page, read left to right');
    for (const [rel, html] of site.pages) assert.ok(!html.includes(`href="${FIXTURE_HOST}"`) && !html.includes(`href="${FIXTURE_HOST}/"`), `${rel}: no link to the root of the server`);

    const de = readJson(contentFile(root, 'de'));
    de.hero.heading = 'Ein <b>Tagebuch</b>';
    // What the site offered until 2026-11-23: the button of the home page and a link to the web version.
    de.hero.openAction = 'Im Browser öffnen';
    de.faq.items[0].a = `${de.faq.items[0].a} [[webapp|Webversion öffnen]].`;
    de.faq.items[26].a = 'Ab 16 Jahren.';
    de.contact.notice = 'Mehr in den [[terms|Nutzungsbedingungen]].';
    delete de.faq.heading;
    write(contentFile(root, 'de'), JSON.stringify(de));
    write(contentFile(root, 'fr'), '{ not json');
    rmSync(contentFile(root, 'it'));
    rmSync(path.join(root, 'play', 'screenshots', 'ja-JP', '04-habits.png'));
    write(path.join(root, 'store', 'screenshots', 'th-TH', '01-home.png'), fakePng(1366, 768));
    write(path.join(root, 'play', 'screenshots', 'ro', '01-home.png'), 'not a png at all, just some text that is long enough');
    rmSync(legalSourceFile(root, 'terms', 'pl'));
    write(path.join(root, 'site', 'settings.json'), JSON.stringify({ ...SITE_SETTINGS, siteBaseUrl: 'https://example.org', links: { ...NO_LINKS, googlePlay: 'http://play.google.com/x' } }));
    // The installers: one missing, one of another size, one with the right size and another content.
    rmSync(path.join(root, DOWNLOADS_DIR, FIXTURE_FILES.android.file));
    write(path.join(root, DOWNLOADS_DIR, FIXTURE_FILES.windows.file), 'shorter');
    write(path.join(root, DOWNLOADS_DIR, FIXTURE_FILES.mac.file), FIXTURE_FILES.mac.text.replace('Mac', 'MAC'));
    write(path.join(root, SCRIPT_FILE), `${readFileSync(path.join(root, SCRIPT_FILE), 'utf8')}\nfetch('./x');\n`);
    const problems = problemsOf(() => buildSite({ root }));
    const text = problems.join('\n');
    const fix = ' - put the file there again with scripts/site/add-download.mjs (--replace)';
    for (const needle of [
      'site/settings.json: "siteBaseUrl" must be written as https://example.org/; "links.googlePlay" must start with https://',
      'site/site.js: it may not hold fetch (the script makes no network call, keeps nothing and names no address)',
      'site/content/site-de.json: hero.heading may not contain < or >',
      'site/content/site-de.json: unknown key hero.openAction',
      'site/content/site-de.json: faq.items.0.a unknown link target [[webapp|...]] (the targets: privacy, terms, faq, downloads, home, support, delete, contact)',
      'site/content/site-de.json: faq.items.0.a must hold exactly the links of the English text (none); found [[webapp|...]]',
      'site/content/site-de.json: faq.heading is missing',
      'site/content/site-de.json: faq.items.26.a must use exactly the placeholders of the English text ({{MINIMUM_AGE}}); found none',
      'site/content/site-de.json: contact.notice must hold exactly the links of the English text ([[privacy|...]]); found [[terms|...]]',
      'site/content/site-fr.json: not valid JSON',
      'site/content/site-it.json is missing',
      'legal/terms/terms-pl.md is missing',
      'play/screenshots/ja-JP/04-habits.png is missing',
      'store/screenshots/th-TH/01-home.png is 1366x768, expected 1920x1080',
      'play/screenshots/ro/01-home.png is not a PNG file',
      `site/downloads/${FIXTURE_FILES.windows.file} is 7 bytes, site/downloads.json says ${Buffer.byteLength(FIXTURE_FILES.windows.text)}${fix}`,
      `site/downloads/${FIXTURE_FILES.android.file} is missing (site/downloads.json lists it)${fix}`,
      `site/downloads/${FIXTURE_FILES.mac.file} does not have the SHA-256 that site/downloads.json states${fix}`,
    ]) {
      assert.ok(text.includes(needle), `${needle}\n--- found:\n${text}`);
    }
    assert.equal(problems.length, 18, text);
    assert.equal(run(['--check'], root).code, 1, '--check exits 1');
    assert.match(run(['--check'], root).out, /^build-site: the site cannot be built:\n {2}site\/settings\.json: /);
    assert.equal(run([], root).code, 1);
    assert.ok(!existsSync(path.join(root, 'site', 'out')), 'nothing is written');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fixture tree: a broken list, a broken document, a link to the web version, a lost theme token and a page over the budget are build errors', () => {
  const root = fixture();
  try {
    // site/downloads.json itself.
    const list = fixtureDownloads();
    write(path.join(root, DOWNLOADS_FILE), JSON.stringify({ ...list, mac: [] }));
    assert.deepEqual(problemsOf(() => buildSite({ root })), ['site/downloads.json: "mac" must be a list with at least one file']);
    rmSync(path.join(root, DOWNLOADS_FILE));
    assert.match(problemsOf(() => buildSite({ root }))[0], /^site\/downloads\.json: cannot read it/);
    write(path.join(root, DOWNLOADS_FILE), formatDownloads(list));
    assert.equal(buildSite({ root }).pages.size, PAGE_COUNT);
    // A legal document: an unknown placeholder, a second "# " heading.
    const terms = legalSourceFile(root, 'terms', 'he');
    const original = readFileSync(terms, 'utf8');
    write(terms, original.replace('{{MINIMUM_AGE}}', '{{MAXIMUM_AGE}}'));
    assert.deepEqual(problemsOf(() => buildSite({ root })), ['he/terms/index.html: terms-he.md: unknown placeholder {{MAXIMUM_AGE}}']);
    write(terms, `${original}\n# A second title\n`);
    assert.deepEqual(problemsOf(() => buildSite({ root })), ['he/terms/index.html: terms-he.md: the document must start with its one "# " heading (it is the heading of the page)']);
    write(terms, original.replace('---\ntitle', '---\nnotitle'));
    assert.match(problemsOf(() => buildSite({ root }))[0], /^he\/terms\/index\.html: terms-he\.md: front matter needs "title"/);
    // A document that outgrows the budget of a page.
    write(terms, `${original}\n${'A long paragraph about nothing in particular. '.repeat(4000)}\n`);
    assert.match(problemsOf(() => buildSite({ root }))[0], /^he\/terms\/index\.html is \d+ bytes, over the budget of 163840$/);
    // A document that links to the root of the server in a form the builder does not turn into text (it does so
    // for the bare address, [{{SITE_URL}}]({{SITE_URL}})): the page would lead a visitor to the web version, so it
    // is not built (the owner's rule of 2026-11-23) - and --check, the gate before a deploy, exits 1 with the reason.
    write(terms, `${original}\nOpen the diary: [the web version]({{SITE_URL}}/?lang=he).\n`);
    const offered = `he/terms/index.html: the address ${FIXTURE_HOST}/?lang=he leads to the root of the server, where the web version is - the site does not offer it (the owner's decision of 2026-11-23)`;
    assert.deepEqual(problemsOf(() => buildSite({ root })), [offered]);
    const refused = run(['--check', '--strict'], root);
    assert.deepEqual([refused.code, refused.out], [1, `build-site: the site cannot be built:\n  ${offered}`]);
    // The same link to a page below the root - the support page - is no such address.
    write(terms, `${original}\nWrite to us: [the support page]({{SITE_URL}}/support/).\n`);
    assert.equal(buildSite({ root }).pages.size, PAGE_COUNT);
    write(terms, original);
    // The theme: a token that left the app is a build error, not a silent default.
    const file = path.join(root, TOKENS_FILE);
    write(file, readFileSync(file, 'utf8').replaceAll('--color-primary-soft:', '--color-primary-pale:'));
    assert.throws(() => readThemeTokens(root), /src\/styles\/tokens\.css: the light theme has no --color-primary-soft/);
    assert.deepEqual(problemsOf(() => buildSite({ root })), ['src/styles/tokens.css: the light theme has no --color-primary-soft']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('command line: --strict fails while a marker is left and passes without; --check writes nothing; two builds are byte-identical', () => {
  const summary = `${PAGE_COUNT} pages (20 locales), ${IMAGE_COUNT} images and 3 installer files`;
  const root = fixture({ marked: ['he', 'ja'] });
  try {
    assert.deepEqual(untranslatedContent(root), ['site/content/site-he.json', 'site/content/site-ja.json']);
    // Without --strict a marked file is a warning: the tree is built, so the translators can look at it.
    const check = run(['--check'], root);
    assert.equal(check.code, 0, check.out);
    assert.match(check.out, /warning - 2 file\(s\) still marked TODO-TRANSLATE .*site-he\.json, site\/content\/site-ja\.json/);
    assert.ok(check.out.endsWith(`build-site: ${summary} check out; nothing written`), check.out);
    assert.ok(!existsSync(path.join(root, 'site', 'out')), '--check writes nothing');
    // --strict refuses, with and without --check, and writes nothing.
    const strict = run(['--check', '--strict'], root);
    assert.equal(strict.code, 1, strict.out);
    assert.match(strict.out, /^build-site: 2 file\(s\) still marked TODO-TRANSLATE/);
    assert.equal(run(['--strict'], root).code, 1);
    assert.ok(!existsSync(path.join(root, 'site', 'out')), 'a refused --strict build writes nothing');
    // A file with single keys that wait counts too, and so does a legal document that waits.
    const base = english();
    write(contentFile(root, 'ja'), JSON.stringify(base));
    write(contentFile(root, 'he'), JSON.stringify({ [MARKER_KEY]: { marker: UNTRANSLATED_MARKER, keys: ['nav.about'] }, ...base }));
    assert.deepEqual(untranslatedContent(root), ['site/content/site-he.json']);
    assert.match(run(['--check', '--strict'], root).out, /1 file\(s\) still marked TODO-TRANSLATE .*: site\/content\/site-he\.json$/m);
    write(contentFile(root, 'he'), JSON.stringify(base));
    const privacy = legalSourceFile(root, 'privacy', 'th');
    writeFileSync(privacy, `${readFileSync(privacy, 'utf8')}\n${UNTRANSLATED_MARKER}\n`);
    const waiting = run(['--check', '--strict'], root);
    assert.equal(waiting.code, 1);
    assert.match(waiting.out, /1 file\(s\) still marked TODO-TRANSLATE .*: legal\/privacy\/privacy-th\.md$/m);
    writeFileSync(privacy, readFileSync(privacy, 'utf8').replace(`\n${UNTRANSLATED_MARKER}\n`, ''));
    // The English document grew by a list item that no translation has yet: a warning, and an error with --strict.
    const englishPrivacy = legalSourceFile(root, 'privacy', DEFAULT_LOCALE);
    const originalPrivacy = readFileSync(englishPrivacy, 'utf8');
    writeFileSync(englishPrivacy, originalPrivacy.replace('- Support:', '- An item that was added to English.\n- Support:'));
    const grown = run(['--check'], root);
    assert.equal(grown.code, 0, grown.out);
    assert.match(grown.out, /warning - 19 legal translation\(s\) behind the English document \(translate what was added to it\): legal\/privacy\/privacy-ar\.md \("2\. The other documents": 3 list items, English 4\), /);
    assert.equal(run(['--check', '--strict'], root).code, 1);
    writeFileSync(englishPrivacy, originalPrivacy);
    // Once the last marker is gone, --strict passes.
    assert.deepEqual(untranslatedContent(root), []);
    const clean = run(['--check', '--strict'], root);
    assert.deepEqual([clean.code, clean.out], [0, `build-site: ${summary} check out; nothing written`]);

    // The default output is site/out/about; a second build gives the same bytes; --out goes elsewhere.
    const first = run([], root);
    assert.equal(first.code, 0, first.out);
    assert.equal(first.out, `build-site: wrote ${summary} to ${path.join(root, 'site', 'out', 'about')}`);
    const outDir = path.join(root, 'site', 'out');
    const snapshot = () => new Map(filesUnder(outDir).map((f) => [f, readFileSync(path.join(outDir, f)).toString('base64')]));
    const before = snapshot();
    // The pages, site.css, site.js and the list of the installers (files/downloads.json), the images, the three installers.
    assert.equal(before.size, PAGE_COUNT + 3 + IMAGE_COUNT + 3);
    for (const rel of ['about/index.html', 'about/he/contact/sent/index.html', 'about/site.css', 'about/site.js', `about/${IMAGE_LIST_FILE}`, 'about/img/he/phone-home.png', 'about/img/share.png', 'about/img/icon.svg', `about/files/${FIXTURE_FILES.android.file}`]) assert.ok(before.has(rel), rel);
    assert.ok(!before.has('about/en/index.html'));
    writeFileSync(path.join(outDir, 'about', 'stale.html'), 'left over');
    assert.equal(run([], root).code, 0);
    assert.deepEqual(snapshot(), before, 'the second build is byte-identical and removes what does not belong');
    const elsewhere = path.join(root, 'preview');
    assert.equal(run([`--out=${elsewhere}`], root).code, 0);
    assert.deepEqual(filesUnder(elsewhere), [...before.keys()]);
    assert.equal(readFileSync(path.join(elsewhere, 'about', 'ar', 'faq', 'index.html'), 'utf8'), Buffer.from(before.get('about/ar/faq/index.html'), 'base64').toString('utf8'));
    assert.deepEqual(siteTreeProblems(elsewhere), []);

    // Usage errors.
    assert.equal(run(['--bogus'], root).code, 2);
    assert.equal(run(['--out='], root).code, 2);
    assert.equal(run(['--check', `--out=${elsewhere}`], root).code, 2);
    // A folder that is not an earlier output is not replaced.
    write(path.join(root, 'other', 'about', 'notes.txt'), 'mine');
    const refused = run([`--out=${path.join(root, 'other')}`], root);
    assert.equal(refused.code, 1);
    assert.match(refused.out, /refusing to replace it/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  // An unset value of legal/settings.json: a warning, and an error with --strict.
  const unset = fixture({ settings: { ...FILLED, contactEmail: null } });
  try {
    const loose = run(['--check'], unset);
    assert.equal(loose.code, 0);
    assert.match(loose.out, /warning - not set yet in legal\/settings\.json: \{\{CONTACT_EMAIL\}\}/);
    assert.equal(run(['--check', '--strict'], unset).code, 1);
  } finally {
    rmSync(unset, { recursive: true, force: true });
  }
});

test('the real tree: two builds are byte-identical, and the command line agrees with the sources', () => {
  const again = buildSite({ settings: FILLED });
  assert.deepEqual([...again.pages], [...real().pages]);
  assert.deepEqual([...again.files], [...real().files]);
  assert.deepEqual([...again.assets], [...real().assets]);
  const installers = PLATFORMS.reduce((sum, p) => sum + real().downloads[p].length, 0);
  const script = path.join(ROOT, 'scripts', 'site', 'build-site.mjs');
  const cli = spawnSync(process.execPath, [script, '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.ok(cli.stdout.includes(`build-site: ${PAGE_COUNT} pages (20 locales), ${IMAGE_COUNT} images and ${installers} installer files check out; nothing written`), cli.stdout);
  const strict = spawnSync(process.execPath, [script, '--check', '--strict'], { cwd: ROOT, encoding: 'utf8' });
  const actual = buildSite();
  assert.equal(strict.status, actual.untranslated.length || actual.behind.length || actual.unset.length ? 1 : 0, 'exit 1 exactly while a text is marked TODO-TRANSLATE, a legal translation is behind or a setting is unset');
  const usage = spawnSync(process.execPath, [script, '--nope'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /unknown argument --nope/);
});
