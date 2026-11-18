/**
 * Tests of scripts/site/build-site.mjs - the public site, version 2 (docs/site-tasks/SITE.md section 9).
 * Node's own test runner (no vitest project covers scripts/):
 *
 *   node --test scripts/site/build-site.test.mjs
 *
 * Against the real tree, with a fictional publisher and e-mail (the owner's values are never written into a
 * test): the 20 content files have the keys, list lengths, placeholders and link targets of the English one,
 * and a key that no longer waits for its translation is not an English copy; the English text keeps to the
 * fixed facts (30 questions in their order, no medical promise, no superlative, "end-to-end" only as a question
 * that is answered "No", a store named only where the text says the file does NOT come from it); the 140 pages
 * exist and each has the frame of section 2 - skip link, header, the menu with six items and one current item,
 * one h1, the contact block with its six controls (not on the two result pages), the language chooser with 20
 * options, the copyright line; every address in a page is relative and leads to a file of the tree and to a
 * page of the same language, and the tree works under another name; the download tables are the rows of
 * site/downloads.json and the copied installers have the listed size and SHA-256; the two legal pages hold the
 * whole document and name the standalone page as canonical; right-to-left pages isolate every Latin fragment;
 * the colours are the app's theme tokens with a contrast of at least 4.5:1 (controls 3:1) in light and dark;
 * site.js holds nothing forbidden; the site is in no client tree.
 * Against fixture trees in a temp folder (scripts/site/fixture-tree.mjs): the settings, the problems the builder
 * reports in one error, the store links, the command line with --check / --strict / --out, identical builds.
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

test('content: the English text keeps to the fixed facts - 30 questions, no promise, superlative, cliche or exclamation mark', () => {
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
  const STORE_KEYS = ['downloads.install.windows', 'downloads.install.android', 'downloads.iphone', 'downloads.iphoneStore', ...Object.keys(STORE_LINKS).map((key) => `downloads.storeLinks.${key}`)];
  for (const [where, text] of leaves) {
    for (const re of FORBIDDEN) assert.ok(!re.test(text), `${where}: ${re} matches "${text}"`);
    if (!STORE_KEYS.includes(where)) assert.ok(!/Google Play|App Store|Microsoft Store/.test(text), `${where}: no store is named here`);
  }
  assert.match(content.downloads.install.windows, /does not come from Microsoft Store and is not signed with a publisher certificate yet/);
  assert.match(content.downloads.install.windows, /"Windows protected your PC": choose More info, then Run anyway/);
  assert.match(content.downloads.install.android, /installed directly, not through Google Play/);
  assert.match(content.downloads.install.android, /allow your browser or file manager to install apps/);
  assert.match(content.downloads.install.mac, /not signed with an Apple developer certificate yet/);
  assert.match(content.downloads.install.mac, /System Settings, then Privacy & Security, scroll down and choose Open Anyway \(on macOS 12: System Preferences, then Security & Privacy, then Open Anyway\)/);
  // An app that is not notarized may be called "damaged" (docs/MAC-RELEASE.he.md 5.3): the note says so before the visitor throws it away.
  assert.match(content.downloads.install.mac, /may even say that the app is damaged\. Do not move it to the Bin/);
  assert.match(content.faq.items[28].a, /may even say that it is damaged: do not move it to the Bin.*on macOS 12: System Preferences, then Security & Privacy/);
  // Android 7 (the oldest the app runs on) has one switch, Unknown sources, instead of a permission per app.
  assert.match(content.downloads.install.android, /on Android 7 this setting is called Unknown sources/);
  // The iPhone app is named like the other apps (the owner's wording of 2026-11-18): no "not available yet".
  assert.equal(content.downloads.iphone, 'There is no installation file for iPhone: the iPhone app is installed from the App Store.');
  assert.match(content.faq.items[3].a, /an iPhone with iOS 16 or later/);
  for (const [where, text] of leaves) assert.ok(!/not available yet|when it is published/i.test(text), `${where}: the iPhone app is not called unpublished`);
  assert.match(content.downloads.requires.windows, /Windows 10 or Windows 11/);
  assert.match(content.downloads.requires.android, /Android 7\.0 or later/);
  assert.match(content.downloads.requires.mac, /macOS 12\.3 or later/);

  // "end-to-end": one question asks it, and the answer is No.
  const endToEnd = [...leaves].filter(([, text]) => /end[\s-]to[\s-]end/i.test(text)).map(([where]) => where);
  assert.deepEqual(endToEnd, ['faq.items.21.q'], '"end-to-end" stands only in the question that asks it');
  assert.match(content.faq.items[21].a, /^No\. /);
  assert.match(content.faq.items[21].a, /the server opens it in its memory/);

  // The 30 questions, in the six groups, each on its subject (the translations follow these positions).
  assert.equal(FAQ_COUNT, 30);
  assert.equal(content.faq.items.length, 30);
  assert.deepEqual(FAQ_GROUP_SIZES, [7, 7, 5, 5, 4, 2]);
  assert.deepEqual(content.faq.groups, ['About the app', 'Writing and features', 'Devices and working offline', 'Privacy and security', 'Your account', 'Installing and updating']);
  const SUBJECTS = [
    /^What is \{\{BRAND\}\}\?$/, /free/, /publishes/, /devices/, /languages/, /medical tool/, /without an account/,
    /diary entry/, /habits and reminders/, /insights.*numbers behind/, /calendars/, /smart search/, /statistics/, /formats.*export/,
    /offline/, /several devices/, /same entry on two devices/, /browser, without installing/, /"Remember me"/,
    /Where is my diary kept/, /Who can read my diary/, /end-to-end encrypted/, /ads or tracking/, /locked/,
    /forget my password/, /back up.*restore/, /delete my account/, /How old/,
    /warn.*install a file from this site/, /update to a new version/,
  ];
  assert.equal(SUBJECTS.length, 30);
  content.faq.items.forEach((item, i) => {
    assert.match(item.q, SUBJECTS[i], `question ${i}`);
    assert.ok(item.q.endsWith('?'), `question ${i} is a question`);
    assert.ok(item.a.length >= 60 && item.a.length <= 700, `answer ${i} is short (${item.a.length} characters)`);
  });
  assert.equal(new Set(content.faq.items.map((item) => item.q)).size, 30, 'no question twice');

  // The careful words that must be there.
  assert.match(content.faq.items[5].a, /^No\. .*not a medical or diagnostic tool.*not medical or psychological advice/);
  assert.match(content.faq.items[6].a, /^In the Android app, yes\./, 'the tour exists in the Android app only');
  assert.match(content.faq.items[20].a, /could technically reset the password of any account and read its diary without knowing the password\. We promise not to do this/);
  // Backup is a page of the menu (in the Android app under More), not a card of Settings; "Remember me" is ticked at first.
  assert.match(content.faq.items[25].a, /^Open Backup in the menu \(in the Android app, under More\)/);
  assert.ok(![...leaves.values()].some((text) => /Settings - Backup/.test(text)), 'no text sends the visitor to a Backup card in Settings');
  assert.match(content.faq.items[18].a, /it is ticked at first: on a device that other people also use, clear it/);
  assert.ok(content.faq.items[27].a.includes('{{MINIMUM_AGE}}') && !/\p{Nd}/u.test(content.faq.items[27].a), 'the age comes from legal/settings.json, never a literal');
  assert.match(content.faq.items[28].a, /More info, then Run anyway.*Open Anyway/);
  assert.match(content.faq.items[29].a, /do not update themselves/);
  assert.match(content.privacy.items.join(' '), /stored encrypted/);
  assert.match(content.privacy.items.join(' '), /opens your diary in its memory/);
  assert.match(content.features.items[2].text, /never claim that one thing causes another/);
  assert.equal(content.contact.notice, 'Your name, e-mail address and message are sent to us by e-mail so that we can answer you. They are not stored on the server. More in the [[privacy|Privacy Policy]].');
  assert.equal(content.footer.rights, 'All rights reserved.');
  assert.deepEqual(content.nav, { label: 'Site menu', about: 'About the app', terms: 'Terms of Use', faq: 'Questions and answers', privacy: 'Privacy Policy', downloads: 'Downloads', contact: 'Contact us' });
  assert.deepEqual(content.downloads.columns, { file: 'File', version: 'Version', size: 'Size' });
  assert.deepEqual(content.downloads.tabs, { windows: 'Windows', android: 'Android', mac: 'Mac' });
  assert.deepEqual([content.contact.sentTitle, content.contact.errorTitle], ['Your message was sent', 'Your message was not sent']);
  assert.equal(content.features.items.length, 8);
  assert.equal(content.screens.items.length, SHOTS.length);
  // The e-mail address is a link: only the text of the error page carries it; the publisher is named once.
  assert.deepEqual([...leaves].filter(([, text]) => text.includes('{{CONTACT_EMAIL}}')).map(([where]) => where), ['contact.errorText']);
  assert.deepEqual([...leaves].filter(([, text]) => text.includes('{{PUBLISHER_NAME}}')).map(([where]) => where), ['faq.items.2.a']);
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
  assert.deepEqual(contentProblems(marked(['nav', 'faq.items.30.q']), base).length, 2, 'a group and a question that does not exist are not texts');
  assert.deepEqual(contentProblems(marked(['nav.about', 'nav.about']), base), ['"_status" lists nav.about twice']);
  // Keys and lists.
  assert.deepEqual(broken((c) => { delete c.hero.lead; }), ['hero.lead is missing']);
  assert.deepEqual(broken((c) => { c.hero.extra = 'x'; }), ['unknown key hero.extra']);
  assert.deepEqual(broken((c) => { c.get = { heading: 'Get the app' }; }), ['unknown key get'], 'a key of version 1 that no page uses any more');
  assert.match(broken((c) => { c.features.items.pop(); })[0], /features\.items must have 8 items \(found 7\)/);
  assert.match(broken((c) => { c.faq.items.push({ q: 'Q', a: 'A' }); })[0], /faq\.items must have 30 items \(found 31\)/);
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
  assert.match(broken((c) => { c.faq.items[27].a = 'You must be 16.'; })[0], /faq\.items\.27\.a must use exactly the placeholders of the English text \(\{\{MINIMUM_AGE\}\}\); found none/);
  // Links: only where the schema allows them, only the known targets, the same targets as English.
  assert.match(broken((c) => { c.hero.note = 'See the [[privacy|policy]]'; }).join('\n'), /hero\.note may not hold a link/);
  assert.match(broken((c) => { c.contact.notice = 'More in the [[policy|Privacy Policy]].'; }).join('\n'), /contact\.notice unknown link target \[\[policy\|\.\.\.\]\]/);
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
  // Every store link belongs to a platform of the Downloads page (or to the iPhone line) and has its link text.
  for (const [key, link] of Object.entries(STORE_LINKS)) {
    assert.ok([...PLATFORMS, 'iphone'].includes(link.platform), key);
    assert.equal(typeof english().downloads.storeLinks[key], 'string');
  }
});

test('addresses: seven pages per language, English without a folder, every address relative', () => {
  assert.deepEqual(SITE_PAGES.map((p) => [p.id, p.dir]), [['home', ''], ['terms', 'terms/'], ['faq', 'faq/'], ['privacy', 'privacy/'], ['downloads', 'downloads/'], ['sent', 'contact/sent/'], ['error', 'contact/error/']]);
  assert.deepEqual(SITE_PAGES.filter((p) => !p.contact).map((p) => p.id), ['sent', 'error'], 'the two result pages have no contact block');
  assert.deepEqual(SITE_PAGES.filter((p) => p.noindex).map((p) => p.id), ['sent', 'error']);
  assert.deepEqual(SITE_PAGES.filter((p) => p.legal).map((p) => [p.id, p.legal]), [['terms', 'terms'], ['privacy', 'privacy']]);
  assert.deepEqual(MENU.map(([id, key]) => `${id}:${key}`), ['home:about', 'terms:terms', 'faq:faq', 'privacy:privacy', 'downloads:downloads']);
  assert.equal(siteDir('home', 'en'), '');
  assert.equal(siteDir('terms', 'en'), 'terms/');
  assert.equal(siteDir('home', 'he'), 'he/');
  assert.equal(siteDir('sent', 'he'), 'he/contact/sent/');
  assert.equal(pageFile('home', 'en'), 'index.html');
  assert.equal(pageFile('error', 'ar'), 'ar/contact/error/index.html');
  assert.throws(() => siteDir('about', 'en'), /unknown page about/);
  for (const [from, to, want] of [
    ['', '', './'],
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

test('tree: the 140 pages, site.css, site.js, every image and every installer - and a hole is noticed', (t) => {
  assert.deepEqual(Object.keys(PLAY_FOLDER).sort(), [...CODES].sort(), 'a Play screenshot folder for every app locale');
  assert.deepEqual(Object.keys(STORE_FOLDER).sort(), [...CODES].sort(), 'a Store screenshot folder for every app locale');
  assert.deepEqual([PLAY_FOLDER.he, PLAY_FOLDER.pt, STORE_FOLDER.he, STORE_FOLDER.pt, STORE_FOLDER.ar], ['iw-IL', 'pt-BR', 'he-IL', 'pt-PT', 'ar-SA']);
  assert.deepEqual(SHOTS.map((s) => `${s.kind} ${s.file} ${s.width}x${s.height}`), ['phone 01-home.png 1080x1920', 'phone 03-entry.png 1080x1920', 'phone 04-habits.png 1080x1920', 'phone 05-insights.png 1080x1920', 'desktop 01-home.png 1920x1080']);

  const site = real();
  const installers = PLATFORMS.flatMap((p) => site.downloads[p]);
  assert.deepEqual([...site.pages.keys()], LOCALES.flatMap((l) => SITE_PAGES.map((p) => pageFile(p.id, l.code))), 'seven pages for each of the 20 locales');
  assert.equal(site.pages.size, 140);
  assert.ok(!site.pages.has('en/index.html'), 'there is no en/ folder');
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

  // The images of a home page: its own language, the stated size, an alt text; the hero image loads at once.
  for (const l of LOCALES) {
    const rel = pageFile('home', l.code);
    const page = parsed(rel);
    const images = page.all('img').filter((el) => !hasClass(el, 'app-icon'));
    assert.equal(images.length, 1 + SHOTS.length, `${rel}: the hero image and the five screens`);
    assert.deepEqual(images.map((image) => image.attrs.src), ['phone-home', ...SHOTS.map((s) => s.id)].map((id) => relativeHref(siteDir('home', l.code), `img/${l.code}/${id}.png`)), `${rel}: the screens of its own language`);
    for (const [i, image] of images.entries()) {
      const size = ihdr(path.join(target, ...resolveAddress(siteDir('home', l.code), image.attrs.src).split('/')));
      assert.deepEqual({ width: Number(image.attrs.width), height: Number(image.attrs.height) }, size, `${rel}: ${image.attrs.src} is ${size.width}x${size.height}`);
      assert.ok(image.attrs.alt.trim().length >= 5, `${rel}: ${image.attrs.src} has an alt text`);
      assert.equal(image.attrs.decoding, 'async');
      assert.equal(image.attrs.loading, i === 0 ? undefined : 'lazy', `${rel}: image ${i}`);
    }
    assert.equal(page.all('figure').length, SHOTS.length);
    assert.equal(page.all('figcaption').length, SHOTS.length);
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
    'about/img/ja/phone-habits.png is missing (ja/index.html refers to it)',
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

test('pages: the frame of all 140 - head, skip link, header, menu, one h1, contact block, language chooser, copyright', () => {
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

    // 3. The menu: six items in the fixed order, exactly one of them current.
    const menu = page.inside(navs[0], 'a');
    assert.deepEqual(page.children(navs[0]).map((el) => el.tag), ['ul'], `${rel}: the menu is a list`);
    assert.equal(page.inside(navs[0], 'li').length, 6);
    const contactHref = def.contact ? '#contact' : `${toPage('home')}#contact`;
    assert.deepEqual(
      menu.map((el) => [el.attrs.href, page.textOf(el)]),
      [...MENU.map(([id, key]) => [toPage(id), content.nav[key]]), [contactHref, content.nav.contact]],
      `${rel}: About the app, Terms of Use, Questions and answers, Privacy Policy, Downloads, Contact us`,
    );
    const current = menu.filter((el) => 'aria-current' in el.attrs);
    assert.equal(current.length, 1, `${rel}: exactly one current item`);
    // The two result pages belong to "Contact us", whose link leads to another page: the current item, not the current page.
    assert.equal(current[0].attrs['aria-current'], def.contact ? 'page' : 'true', `${rel}: aria-current`);
    assert.equal(menu.indexOf(current[0]), def.contact ? MENU.findIndex(([id]) => id === def.id) : 5, `${rel}: the current item is the page itself`);

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
    assert.ok(boxes.length >= 29, `${rel}: the menu, the language list, the buttons`);
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
    // Only the script may add roles: the static page has the two it needs.
    assert.deepEqual(page.elements.filter((el) => 'role' in el.attrs).map((el) => el.attrs.role).sort(), def.id === 'home' ? ['group', 'region'] : ['group'], `${rel}: no tab role without the script`);
    assert.deepEqual(page.elements.filter((el) => 'tabindex' in el.attrs).map((el) => `${el.attrs.class ?? el.attrs.name}:${el.attrs.tabindex}`), [...(def.id === 'home' ? ['strip:0'] : []), ...(def.contact ? ['website:-1'] : [])], `${rel}: the focus order is the order of the page`);
  }
});

// ---------------------------------------------------------------------------------------------
// The pages themselves
// ---------------------------------------------------------------------------------------------

test('home: the lead, the two actions, eight cards, the screens and the privacy list with its link', () => {
  for (const l of LOCALES) {
    const rel = pageFile('home', l.code);
    const page = parsed(rel);
    const content = contentOf(l.code);
    const dir = siteDir('home', l.code);
    assert.equal(page.textOf(page.all('title')[0]), plain(content.title, l), `${rel}: the title`);
    assert.equal(page.textOf(page.all('h1')[0]), plain(content.hero.heading, l));
    const actions = page.all('a').filter((el) => hasClass(el, 'btn') && el.parents.at(-1).attrs.class === 'actions');
    assert.deepEqual(actions.map((el) => [el.attrs.href, page.textOf(el)]), [[`${SITE_URL}/`, content.hero.openAction], [relativeHref(dir, siteDir('downloads', l.code)), content.nav.downloads]], `${rel}: "Open in your browser" and "Downloads"`);
    const levels = page.elements.filter((el) => /^h[1-6]$/.test(el.tag)).map((el) => el.tag);
    assert.deepEqual(levels, ['h1', 'h2', ...Array(8).fill('h3'), 'h2', 'h2', 'h2'], `${rel}: features (eight cards), screens, privacy, contact`);
    assert.deepEqual(page.all('h3').map((el) => page.textOf(el)), content.features.items.map((item) => plain(item.title, l)));
    assert.deepEqual(page.all('figcaption').map((el) => page.textOf(el)), content.screens.items.map((item) => plain(item.caption, l)));
    const strip = page.elements.find((el) => hasClass(el, 'strip'));
    assert.deepEqual([strip.attrs.role, strip.attrs.tabindex, page.textOf(page.elements.find((el) => el.attrs.id === strip.attrs['aria-labelledby']))], ['region', '0', plain(content.screens.heading, l)], `${rel}: the strip of screens is a labelled, focusable region`);
    const checks = page.elements.find((el) => hasClass(el, 'checks'));
    assert.deepEqual(page.children(checks).map((li) => page.textOf(li)), content.privacy.items.map((item) => plain(item, l)), `${rel}: the privacy list`);
    const policy = page.all('a').find((el) => el.parents.at(-1).attrs.class === 'policy');
    assert.deepEqual([policy.attrs.href, page.textOf(policy)], [relativeHref(dir, siteDir('privacy', l.code)), content.privacy.policyLink], `${rel}: the link to the Privacy Policy page of the site`);
    assert.equal(page.all('a').filter((el) => el.attrs.href === `${SITE_URL}/`).length, 1, `${rel}: one link to the web app`);
  }
});

test('questions: exactly 30, in six groups, each a <details> with a plain <summary>; the links of the answers lead on', () => {
  for (const l of LOCALES) {
    const rel = pageFile('faq', l.code);
    const page = parsed(rel);
    const content = contentOf(l.code);
    const dir = siteDir('faq', l.code);
    const to = (id) => relativeHref(dir, siteDir(id, l.code));
    const hrefs = { home: to('home'), privacy: to('privacy'), terms: to('terms'), faq: to('faq'), downloads: to('downloads'), support: `${SITE_URL}${pagePath('support', l.code)}`, delete: `${SITE_URL}${pagePath('delete-account', l.code)}`, webapp: `${SITE_URL}/`, contact: '#contact' };
    assert.equal(page.textOf(page.all('title')[0]), `${content.faq.heading} - ${BRAND}`);
    assert.equal(page.textOf(page.all('h1')[0]), content.faq.heading);
    const groups = page.all('section').filter((el) => hasClass(el, 'group'));
    assert.equal(groups.length, 6, `${rel}: six groups`);
    const details = page.all('details');
    assert.equal(details.length, 30, `${rel}: exactly 30 questions`);
    assert.equal(page.all('summary').length, 30);
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
        const found = page.inside(answer, 'a').filter((el) => !el.attrs.href.startsWith('mailto:')).map((el) => [el.attrs.href, page.textOf(el)]);
        assert.deepEqual(found, wanted, `${rel}: the links of answer ${index}`);
        index += 1;
      }
    });
    assert.equal(index, FAQ_COUNT);
    // The publisher and the minimum age come from legal/settings.json.
    assert.ok(page.textOf(details[2]).includes(FILLED.publisherName), `${rel}: who publishes it`);
    assert.ok(page.textOf(details[27]).includes(ageOf(l)), `${rel}: the minimum age`);
  }
  // The targets in use: each leads where the specification says (English, by its literal address).
  const page = parsed(pageFile('faq', 'en'));
  const hrefOf = (text) => page.all('a').filter((el) => page.textOf(el) === text).map((el) => el.attrs.href);
  assert.deepEqual(hrefOf('contact form'), ['#contact']);
  assert.deepEqual(hrefOf('Open the web version'), [`${SITE_URL}/`]);
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
      assert.equal(page.inside(panel, 'a').length, rows.length, `${where}: no store link while none is set`);
    }
    // Under the tabs: the web version, and the iPhone line.
    const more = page.all('section').find((el) => hasClass(el, 'more'));
    assert.ok(page.elements.indexOf(more) > page.elements.indexOf(panels[2]) && !more.parents.includes(box), `${rel}: under the tabs`);
    const [moreHeading, web, iphone] = page.children(more);
    assert.deepEqual([moreHeading.tag, page.textOf(moreHeading)], ['h2', texts.moreHeading]);
    assert.equal(page.textOf(web), plain(texts.web, l), `${rel}: the web version`);
    assert.deepEqual(page.inside(web, 'a').map((el) => el.attrs.href), [`${SITE_URL}/`]);
    assert.equal(page.textOf(iphone), texts.iphone, `${rel}: the iPhone line`);
    assert.equal(page.children(more).length, 3);
    assert.deepEqual(page.elements.filter((el) => /^h[1-6]$/.test(el.tag)).map((el) => el.tag), ['h1', 'h2', 'h2', 'h2', 'h2', 'h2'], `${rel}: three platforms, "Browser and iPhone", "Contact us"`);
  }
  assert.equal(parsed(pageFile('downloads', 'en')).textOf(parsed(pageFile('downloads', 'en')).all('caption')[0]), 'Installation files for Windows, newest version first');
});

test('downloads: a store link that is set stands above the table of its platform; the iPhone link replaces the iPhone sentence', () => {
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
    assert.deepEqual(storeLinks(more).map((a) => [a.attrs.href, page.textOf(a)]), [[links.appStoreIphone, texts.storeLinks.appStoreIphone]], `${rel}: the App Store link in the iPhone line`);
    assert.ok(page.textOf(more).includes(plain(texts.iphoneStore, l)) && !page.textOf(more).includes(texts.iphone), `${rel}: "not available yet" is gone`);
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
      // the support page and the deletion page stay on the server; the web app keeps its address.
      const other = kind === 'terms' ? 'privacy' : 'terms';
      const allowed = new Set([relativeHref(dir, siteDir('terms', l.code)), relativeHref(dir, siteDir('privacy', l.code)), SITE_URL, `${SITE_URL}${pagePath('support', l.code)}`, `${SITE_URL}${pagePath('delete-account', l.code)}`, `mailto:${FILLED.contactEmail}`]);
      const hrefs = page.inside(doc, 'a').map((el) => el.attrs.href);
      for (const href of hrefs) assert.ok(allowed.has(href), `${rel}: the link ${href}`);
      assert.ok(hrefs.includes(relativeHref(dir, siteDir(other, l.code))), `${rel}: links the other document inside the site`);
      assert.ok(!hrefs.includes(`${SITE_URL}${pagePath(other, l.code)}`), `${rel}: not the standalone page`);
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
  // A left-to-right page needs no isolation of its own script, only the fixed pieces.
  const englishHome = real().pages.get(pageFile('home', 'en'));
  assert.equal((englishHome.match(/<bdi>/g) ?? []).length, CODES.length, 'en: only the names of the language list');
});

test('pages: the publisher, the e-mail address and the minimum age come from legal/settings.json', () => {
  // The minimum age, in the digits of the language.
  const older = buildSite({ settings: { ...FILLED, minimumAge: 17 } });
  for (const l of LOCALES) {
    const rel = pageFile('faq', l.code);
    const page = parse(older.pages.get(rel), rel);
    const age = ageOf(l, 17);
    assert.ok(older.pages.get(rel).includes(`<bdi>${age}</bdi>`), `${l.code}: ${age}, isolated`);
    assert.equal(page.textOf(page.children(page.all('details')[27])[1]), plain(contentOf(l.code).faq.items[27].a, l, { ...FILLED, minimumAge: 17 }), `${l.code}: the sentence of the content file with the number of the settings`);
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
  const moved = buildSite({ settings: FILLED, siteSettings: { ...SITE_SETTINGS, siteBaseUrl: 'https://diary.example.org/' } });
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
  // What the script adds is styled; a panel is hidden by the hidden attribute.
  assert.match(css, /^\[hidden\]\{display:none!important\}$/m);
  for (const selector of ['.tablist{', '.tab{', '.tab[aria-selected=true]{', '.tabs-on .panel{']) assert.ok(css.includes(`\n${selector}`), `${selector} has its rule`);
  // Every class a page uses has a rule or is a hook of the script, and the other way round.
  const inCss = new Set([...css.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1]).filter((name) => !/^\d/.test(name)));
  const inPages = new Set();
  for (const [, html] of real().pages) for (const m of html.matchAll(/ class="([^"]+)"/g)) for (const name of m[1].split(' ')) inPages.add(name);
  const SCRIPT_CLASSES = ['tablist', 'tab', 'tabs-on'];
  for (const name of inPages) assert.ok(inCss.has(name), `the class ${name} of a page has a rule`);
  for (const name of inCss) assert.ok(inPages.has(name) || SCRIPT_CLASSES.includes(name), `the rule of .${name} is used by a page or by the script`);
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

    const de = readJson(contentFile(root, 'de'));
    de.hero.heading = 'Ein <b>Tagebuch</b>';
    de.faq.items[27].a = 'Ab 16 Jahren.';
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
      'site/content/site-de.json: faq.heading is missing',
      'site/content/site-de.json: faq.items.27.a must use exactly the placeholders of the English text ({{MINIMUM_AGE}}); found none',
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
    assert.equal(problems.length, 15, text);
    assert.equal(run(['--check'], root).code, 1, '--check exits 1');
    assert.match(run(['--check'], root).out, /^build-site: the site cannot be built:\n {2}site\/settings\.json: /);
    assert.equal(run([], root).code, 1);
    assert.ok(!existsSync(path.join(root, 'site', 'out')), 'nothing is written');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fixture tree: a broken list, a broken document, a lost theme token and a page over the budget are build errors', () => {
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
