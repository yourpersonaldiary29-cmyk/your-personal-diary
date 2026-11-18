#!/usr/bin/env node
/**
 * scripts/site/build-site.mjs - the public web site of Your Personal Diary (docs/site-tasks/SITE.md, version 2):
 * a small static site in the app's 20 languages, English by default. The hosted server serves it as files:
 *
 *   <server>/about/                    About the app (the home page), English
 *   <server>/about/terms/              Terms of Use            - the document of legal/terms/, inside the site's frame
 *   <server>/about/faq/                Questions and answers   - 30, in six groups
 *   <server>/about/privacy/            Privacy Policy          - the document of legal/privacy/, inside the frame
 *   <server>/about/downloads/          Downloads               - a tab per platform, a table of installer files
 *   <server>/about/contact/sent/       "Your message was sent"      (where POST /api/contact sends the visitor)
 *   <server>/about/contact/error/      "Your message was not sent"
 *   <server>/about/<locale>/...        the same seven pages in each other app language (there is no /about/en/)
 *   <server>/about/site.css, site.js, img/**, files/**   shared by all pages (files/ = the installers)
 *
 * That is 7 x 20 = 140 pages. Every page has the same frame: skip link, header (logo and name), menu, the page's
 * own content, the contact block with the form (not on the two result pages), and the footer with the language
 * chooser and the copyright line. EVERY LINK INSIDE THE SITE IS RELATIVE, computed from the depth of the page, so
 * the same tree works under /about/ today and at the root of the owner's domain later. Absolute addresses appear
 * only where they must: canonical, hreflang, og:url and og:image (built from "siteBaseUrl"), the links to the web
 * app and to the two documents that stay outside the site (support, account deletion), store links, and the one
 * absolute path of the site: the form's action, /api/contact.
 *
 * The site is hosted-only. It is NOT written into public/ (public/ goes into every client: the Windows and Mac
 * installers, the Android and iPhone bundles). scripts/hosted/stage-image.mjs calls buildSite() / writeSite()
 * while it stages the hosted image and puts the tree at ui/about/** next to the web UI (server/src/app.ts:
 * express.static before the SPA fallback).
 *
 * The Downloads pages and the installers are the one part the hosted server changes at run time
 * (docs/server-tasks/SERVER-CARD-V2.md Part A): the owner can publish and remove installer files in the Server
 * card. So the tree also holds files/downloads.json, the list the pages were built from, and each platform panel
 * marks the parts that depend on the list (the rows, the checksums, the empty-state text) with HTML comments; the
 * server writes those parts again for the list it merged, with the functions of ./downloads-shared.mjs - the same
 * ones this builder uses, so an unchanged list gives these pages byte for byte. The tree stays complete on its own.
 *
 * Sources (nothing generated is committed):
 *   site/content/site-<locale>.json   the texts, the same keys in all 20 files (CONTENT_SCHEMA below). Plain text:
 *                                     no HTML, no Markdown. Placeholders: {{BRAND}} {{MINIMUM_AGE}}
 *                                     {{PUBLISHER_NAME}} {{CONTACT_EMAIL}}. Links, where the schema allows them:
 *                                     [[target|link text]] with a target of LINK_TARGETS.
 *   site/settings.json                { "siteBaseUrl": null | "https://.../", "copyrightYear": 2026, "links": { the
 *                                     four store links, null = not published } }
 *   site/downloads.json               the installer files of the Downloads page (scripts/site/add-download.mjs
 *                                     maintains it); the files themselves are in site/downloads/ (git-ignored).
 *                                     Written into the tree as files/downloads.json, next to the copied files
 *   site/site.js                      the one script of the pages, published as it is
 *   legal/settings.json               the publisher name, the contact e-mail and the minimum age (one place for them)
 *   legal/terms/, legal/privacy/      the two documents, rendered with the functions of scripts/legal/build-pages.mjs
 *   src/config/server-default.json    the fixed server
 *   src/styles/tokens.css             the app's theme tokens: the colours of the site, light and dark
 *   public/favicon.svg                the app icon (the logo of the header)
 *   play/screenshots/<Play locale>/   four phone screens (1080x1920) in the page's own language
 *   store/screenshots/<Store tag>/    one desktop screen (1920x1080) in the page's own language
 *   play/graphics/feature-1024x500.png  the sharing image (og:image)
 * Images and installers are copied as they are; no image library is used. A listed installer that is missing,
 * or whose size or SHA-256 differs from site/downloads.json, stops the build.
 *
 * The pages: one style sheet (site.css) and one small script (site.js, loaded with defer; every page works
 * without it), no external resource, no inline script, no style attribute, light and dark by
 * prefers-color-scheme, right to left for he and ar, nothing that moves.
 *
 * A content file that still waits for translations carries the key "_status":
 *   { "marker": "TODO-TRANSLATE", "keys": ["nav.about", "faq.items.7.q", ...] }   or   "keys": "all"
 * It is built like any other, so that the tree and the tests work while the translators are at it. --strict
 * refuses to go on while one is left, exactly as scripts/legal/build-pages.mjs does - and while a translation of the
 * two legal documents lacks a heading or a list item of the English one (legalOutline: the English text grew).
 *
 * Usage:
 *   node scripts/site/build-site.mjs              write site/out/about/** (a preview; site/out is git-ignored)
 *   node scripts/site/build-site.mjs --out=<dir>  write <dir>/about/** instead
 *   node scripts/site/build-site.mjs --check      build in memory, write nothing; exit 1 on any problem (a key, a
 *                                                 placeholder or a link that differs from English, a missing image,
 *                                                 a missing or changed installer, a bad setting)
 *   node scripts/site/build-site.mjs --strict     also exit 1 while a text is marked TODO-TRANSLATE, a legal translation
 *                                                 is behind the English document or a value of legal/settings.json is
 *                                                 unset (use before a deploy; goes with --check)
 * Exit code 0 = fine; 1 = a problem in the sources; 2 = usage.
 */
import { createHash } from 'node:crypto';
import { closeSync, copyFileSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BRAND,
  dateInWords,
  DEFAULT_LOCALE,
  escapeHtml,
  fillPlaceholders,
  LOCALES,
  markdownToHtml,
  PAGES as LEGAL_PAGES,
  pagePath,
  parseSource,
  readSettings,
  readSiteUrl,
  ROOT,
  sourceFile,
  UNTRANSLATED_MARKER,
  unsetSettings,
} from '../legal/build-pages.mjs';
import { PLAY_LOCALES } from '../play/check-listing.mjs';
import { FEATURE, pngInfo } from '../play/render-graphics.mjs';
import { STORE_LOCALES } from '../store/check-listing.mjs';
import {
  cleanDownloads,
  compareVersions,
  DOWNLOAD_PLATFORMS,
  DOWNLOAD_ROW_KEYS,
  downloadRegions,
  downloadsProblems,
  FILES_DIR,
  formatDownloads,
  IMAGE_LIST_FILE,
  isIsoDate,
  isolateLatin,
  isVersion,
  megabytes,
  PLATFORMS,
  relativeHref,
} from './downloads-shared.mjs';

export { ROOT, UNTRANSLATED_MARKER };
// The list and its markup live in ./downloads-shared.mjs (the hosted server uses them too); exported here as before.
export { compareVersions, DOWNLOAD_PLATFORMS, DOWNLOAD_ROW_KEYS, downloadsProblems, FILES_DIR, formatDownloads, IMAGE_LIST_FILE, isIsoDate, isVersion, megabytes, PLATFORMS, relativeHref };

/** The URL path segment of the site on the fixed server and the name of its folder in a built tree. */
export const SITE_ID = 'about';
export const SETTINGS_FILE = path.join('site', 'settings.json');
export const CONTENT_DIR = path.join('site', 'content');
export const DOWNLOADS_FILE = path.join('site', 'downloads.json');
export const DOWNLOADS_DIR = path.join('site', 'downloads');
export const SCRIPT_FILE = path.join('site', 'site.js');
export const DEFAULT_OUT_DIR = path.join('site', 'out');
export const TOKENS_FILE = path.join('src', 'styles', 'tokens.css');
export const ICON_FILE = path.join('public', 'favicon.svg');
/** The top-level key of a content file that still waits for translations. A finished file has no such key. */
export const MARKER_KEY = '_status';
/** The budgets (SITE.md section 8): one page, one of the two legal pages, the style sheet, the script. */
export const MAX_PAGE_BYTES = 60 * 1024;
export const MAX_LEGAL_PAGE_BYTES = 160 * 1024;
export const MAX_CSS_BYTES = 40 * 1024;
export const MAX_SCRIPT_BYTES = 8 * 1024;
/** Written into every page; writeSite() replaces a folder only when its index.html carries this line. */
export const GENERATOR_TAG = '<meta name="generator" content="scripts/site/build-site.mjs">';
/** The one absolute path of the site: where the contact form posts (the hosted server, SITE.md section 5). */
export const CONTACT_ACTION = '/api/contact';
/** The published names of the style sheet and the script, relative to the site (the installers: FILES_DIR). */
export const CSS_NAME = 'site.css';
export const SCRIPT_NAME = 'site.js';

const slash = (p) => p.split(path.sep).join('/');
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * What site.js may never hold (SITE.md section 8): a network call, a module loader, storage, a cookie, code made
 * from a text, markup made from a text, or an address. The whole file is searched, its comments too, so that
 * nothing has to be parsed: [what it is called in the message, the pattern].
 */
export const SCRIPT_FORBIDDEN = [
  ['fetch', /\bfetch\b/],
  ['XMLHttpRequest', /XMLHttpRequest/],
  ['WebSocket', /WebSocket/],
  ['EventSource', /EventSource/],
  ['sendBeacon', /sendBeacon/],
  ['import(', /\bimport\s*\(/],
  ['an import or export statement (the file is a classic script)', /^\s*(?:import|export)\b/m],
  ['importScripts', /importScripts/],
  ['a worker', /Worker\b/],
  ['eval', /\beval\s*\(/],
  ['the Function constructor', /\bFunction\s*\(/],
  ['localStorage or sessionStorage', /(?:local|session)Storage/],
  ['indexedDB', /indexedDB/i],
  ['a cookie', /\.\s*cookie\b/],
  ['an address (http:, https:, //host or www.)', /https?:|["'`]\/\/|\bwww\./i],
  ['markup made from a text (innerHTML, outerHTML, insertAdjacentHTML, document.write)', /innerHTML|outerHTML|insertAdjacentHTML|document\s*\.\s*write/],
];

/** What is wrong with the text of site.js (empty when it holds nothing of SCRIPT_FORBIDDEN). */
export function scriptProblems(text) {
  return SCRIPT_FORBIDDEN.filter(([, pattern]) => pattern.test(text)).map(([name]) => `it may not hold ${name}`);
}

// ---------------------------------------------------------------------------------------------
// The pages and their addresses
// ---------------------------------------------------------------------------------------------

/**
 * The seven pages of a language. dir = the folder of the page inside the language's folder; contact = the page
 * ends with the contact block; legal = the document of legal/<kind>/ it shows.
 */
export const SITE_PAGES = [
  { id: 'home', dir: '', contact: true },
  { id: 'terms', dir: 'terms/', contact: true, legal: 'terms' },
  { id: 'faq', dir: 'faq/', contact: true },
  { id: 'privacy', dir: 'privacy/', contact: true, legal: 'privacy' },
  { id: 'downloads', dir: 'downloads/', contact: true },
  { id: 'sent', dir: 'contact/sent/', contact: false, noindex: true },
  { id: 'error', dir: 'contact/error/', contact: false, noindex: true },
];
/** The menu, in page order: page id -> the key of its text in nav.* ("Contact us" is added last by the frame). */
export const MENU = [
  ['home', 'about'],
  ['terms', 'terms'],
  ['faq', 'faq'],
  ['privacy', 'privacy'],
  ['downloads', 'downloads'],
];

function sitePage(id) {
  const page = SITE_PAGES.find((p) => p.id === id);
  if (!page) throw new Error(`unknown page ${id}`);
  return page;
}

function localeOf(code) {
  const def = LOCALES.find((l) => l.code === code);
  if (!def) throw new Error(`unknown locale ${code}`);
  return def;
}

/** The folder of a page relative to the top of the site: '' (English home), 'terms/', 'he/', 'he/terms/'. */
export function siteDir(pageId, locale) {
  return `${locale === DEFAULT_LOCALE ? '' : `${locale}/`}${sitePage(pageId).dir}`;
}

/** The file of a page relative to the top of the site: 'index.html', 'he/terms/index.html'. */
export function pageFile(pageId, locale) {
  return `${siteDir(pageId, locale)}index.html`;
}

// ---------------------------------------------------------------------------------------------
// site/settings.json: the base address, the copyright year, the store links
// ---------------------------------------------------------------------------------------------

/**
 * The four store links: the hosts a link may point to and the platform it belongs to. A link that is set is
 * shown on the Downloads page (above the table of its platform; the iPhone link in the line about iPhone), with
 * the text downloads.storeLinks.<key> of the content files. Anything else in site/settings.json is a build error.
 */
export const STORE_LINKS = {
  googlePlay: { hosts: ['play.google.com'], platform: 'android' },
  appStoreIphone: { hosts: ['apps.apple.com'], platform: 'iphone' },
  appStoreMac: { hosts: ['apps.apple.com'], platform: 'mac' },
  microsoftStore: { hosts: ['apps.microsoft.com', 'www.microsoft.com'], platform: 'windows' },
};
export const SITE_SETTING_KEYS = ['siteBaseUrl', 'copyrightYear', 'links'];

function addressProblem(value) {
  if (/[\s"'<>\\^`{|}]/.test(value)) return 'may not contain spaces, quotes or < > \\ ^ ` { | }';
  let url;
  try {
    url = new URL(value);
  } catch {
    return 'is not a link';
  }
  if (url.protocol !== 'https:') return 'must start with https://';
  if (url.username || url.password || url.port) return 'may not carry a user name, a password or a port';
  return null;
}

function storeLinkProblem(value, hosts) {
  if (typeof value !== 'string' || !value.trim()) return 'must be null (not published yet) or a link';
  const problem = addressProblem(value);
  if (problem) return problem;
  const { hostname } = new URL(value);
  if (!hosts.includes(hostname)) return `must point to ${hosts.join(' or ')} (found ${hostname})`;
  return null;
}

function baseUrlProblem(value) {
  if (typeof value !== 'string' || !value.trim()) return `must be null (the fixed server, under /${SITE_ID}/) or the address of the site`;
  const problem = addressProblem(value);
  if (problem) return problem;
  const url = new URL(value);
  if (url.search || url.hash) return 'may not carry a query or a fragment';
  if (!url.pathname.endsWith('/')) return 'must end with /';
  if (url.href !== value) return `must be written as ${url.href}`;
  return null;
}

/** What is wrong with a site settings object (empty when it is valid). */
export function siteSettingsProblems(raw) {
  if (!isObject(raw)) return ['not a JSON object'];
  const problems = [];
  for (const key of SITE_SETTING_KEYS) if (!(key in raw)) problems.push(`"${key}" is missing`);
  for (const key of Object.keys(raw)) if (!SITE_SETTING_KEYS.includes(key)) problems.push(`unknown key "${key}"`);
  if (raw.siteBaseUrl !== null && raw.siteBaseUrl !== undefined) {
    const problem = baseUrlProblem(raw.siteBaseUrl);
    if (problem) problems.push(`"siteBaseUrl" ${problem}`);
  }
  if ('copyrightYear' in raw && !(Number.isInteger(raw.copyrightYear) && raw.copyrightYear >= 2026 && raw.copyrightYear <= 2100)) {
    problems.push('"copyrightYear" must be a year from 2026 to 2100');
  }
  if ('links' in raw) {
    const links = raw.links;
    if (!isObject(links)) return [...problems, '"links" must be an object with the four store links'];
    for (const key of Object.keys(STORE_LINKS)) if (!(key in links)) problems.push(`"links.${key}" is missing (null = not published yet)`);
    for (const key of Object.keys(links)) if (!(key in STORE_LINKS)) problems.push(`unknown key "links.${key}"`);
    for (const [key, def] of Object.entries(STORE_LINKS)) {
      if (links[key] === null || links[key] === undefined) continue;
      const problem = storeLinkProblem(links[key], def.hosts);
      if (problem) problems.push(`"links.${key}" ${problem}`);
    }
  }
  return problems;
}

/** Reads and validates site/settings.json. Throws with a plain reason. */
export function readSiteSettings(root = ROOT, file = path.join(root, SETTINGS_FILE)) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${slash(path.relative(root, file))}: cannot read it (${e.message})`);
  }
  const problems = siteSettingsProblems(raw);
  if (problems.length) throw new Error(`${slash(path.relative(root, file))}: ${problems.join('; ')}`);
  const links = {};
  for (const key of Object.keys(STORE_LINKS)) links[key] = raw.links[key] === null ? null : new URL(raw.links[key]).href;
  return { siteBaseUrl: raw.siteBaseUrl ?? null, copyrightYear: raw.copyrightYear, links };
}

/** The hosts of the store links that are set (the only hosts a page may name besides the server and the site). */
export function storeHosts(siteSettings) {
  return [...new Set(Object.values(siteSettings.links).filter(Boolean).map((href) => new URL(href).hostname))];
}

/** The public address of the top of the site, with its final slash: "siteBaseUrl", or <server>/about/. */
export function siteBaseOf(siteSettings, siteUrl) {
  return siteSettings.siteBaseUrl ?? `${siteUrl}/${SITE_ID}/`;
}

// ---------------------------------------------------------------------------------------------
// site/downloads.json: the installer files (the rules of the list: ./downloads-shared.mjs)
// ---------------------------------------------------------------------------------------------

/** Reads and validates site/downloads.json: { windows: [row, ...], android: [...], mac: [...] }. Throws with a plain reason. */
export function readDownloads(root = ROOT, file = path.join(root, DOWNLOADS_FILE)) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${slash(path.relative(root, file))}: cannot read it (${e.message})`);
  }
  const problems = downloadsProblems(raw);
  if (problems.length) throw new Error(`${slash(path.relative(root, file))}: ${problems.join('; ')}`);
  return cleanDownloads(raw);
}

/** The SHA-256 of a file, as lower-case hexadecimal digits. */
export function fileSha256(file) {
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const fd = openSync(file, 'r');
  try {
    for (;;) {
      const count = readSync(fd, buffer, 0, buffer.length, null);
      if (!count) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest('hex');
}

/**
 * What is wrong with the file of a row in the folder `dir` (null when the file is there, with the listed size
 * and SHA-256). `name` is how the folder is called in the message, `list` what states the size and the SHA-256.
 */
export function downloadFileProblem(dir, row, name = slash(DOWNLOADS_DIR), list = slash(DOWNLOADS_FILE)) {
  const file = path.join(dir, row.file);
  let stat;
  try {
    stat = statSync(file);
  } catch {
    return `${name}/${row.file} is missing (${list} lists it)`;
  }
  if (!stat.isFile()) return `${name}/${row.file} is not a file`;
  if (stat.size !== row.bytes) return `${name}/${row.file} is ${stat.size} bytes, ${list} says ${row.bytes}`;
  if (fileSha256(file) !== row.sha256) return `${name}/${row.file} does not have the SHA-256 that ${list} states`;
  return null;
}

// ---------------------------------------------------------------------------------------------
// site/content/site-<locale>.json: the texts
// ---------------------------------------------------------------------------------------------

/** Every placeholder a text may use. */
export const PLACEHOLDERS = ['BRAND', 'MINIMUM_AGE', 'PUBLISHER_NAME', 'CONTACT_EMAIL'];
/**
 * The targets of a link inside a text, [[target|link text]]: five pages of the site (in the language of the
 * page), the two documents that stay outside it (support, delete), the web app and the contact block.
 */
export const LINK_TARGETS = ['privacy', 'terms', 'faq', 'downloads', 'home', 'support', 'delete', 'webapp', 'contact'];
const PLACEHOLDER_RE = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;
const LINK_RE = /\[\[([a-z]+)\|([^[\]|{}]+)\]\]/g;
/** One pass over a text: a placeholder (group 1) or a link (groups 2 and 3). */
const TOKEN_RE = /\{\{([A-Z][A-Z0-9_]*)\}\}|\[\[([a-z]+)\|([^[\]|{}]+)\]\]/g;

/** T = one plain text. R = a text that may also hold links ([[target|text]]) and {{CONTACT_EMAIL}} (it becomes a link). */
const T = 'text';
const R = 'rich';
const platformTexts = { windows: T, android: T, mac: T };
/** The questions of each group of the Questions page, in the order of faq.groups; together faq.items. */
export const FAQ_GROUP_SIZES = [7, 7, 5, 5, 4, 2];
export const FAQ_COUNT = FAQ_GROUP_SIZES.reduce((sum, size) => sum + size, 0);
/**
 * The keys of a content file. [n, item] = a list of exactly n items (the page has that many icons, images or
 * questions); [0, item] = as many items as the English file has, at least one.
 */
export const CONTENT_SCHEMA = {
  title: T,
  description: T,
  skipLink: T,
  languagesLabel: T,
  nav: { label: T, about: T, terms: T, faq: T, privacy: T, downloads: T, contact: T },
  hero: { heading: T, lead: T, openAction: T, note: T },
  features: { heading: T, items: [8, { title: T, text: T }] },
  screens: { heading: T, items: [5, { caption: T, alt: T }] },
  privacy: { heading: T, lead: T, items: [0, T], policyLink: T },
  faq: { heading: T, lead: T, groups: [FAQ_GROUP_SIZES.length, T], items: [FAQ_COUNT, { q: T, a: R }] },
  downloads: {
    heading: T,
    lead: T,
    tabsLabel: T,
    tabs: platformTexts,
    columns: { file: T, version: T, size: T },
    captions: platformTexts,
    // What a platform without a file shows (the hosted server, after the owner removed its last file).
    empty: T,
    requires: platformTexts,
    install: platformTexts,
    checkFile: T,
    checkText: T,
    moreHeading: T,
    web: R,
    iphone: T,
    iphoneStore: T,
    storeLinks: { googlePlay: T, appStoreIphone: T, appStoreMac: T, microsoftStore: T },
  },
  contact: {
    heading: T,
    lead: T,
    required: T,
    firstName: T,
    lastName: T,
    email: T,
    message: T,
    honeypot: T,
    notice: R,
    send: T,
    sentTitle: T,
    sentText: T,
    errorTitle: T,
    errorText: R,
    backHome: T,
  },
  footer: { languagesLabel: T, change: T, rights: T },
};

/** The names of the placeholders in a text, sorted, each once. */
export function placeholdersOf(text) {
  return [...new Set([...String(text).matchAll(PLACEHOLDER_RE)].map((m) => m[1]))].sort();
}

/** The targets of the links in a text, sorted (a target that is used twice appears twice). */
export function linkTargetsOf(text) {
  return [...String(text).matchAll(LINK_RE)].map((m) => m[1]).sort();
}

function textProblems(value, kind) {
  if (typeof value !== 'string') return ['must be a text'];
  if (!value.trim()) return ['is empty'];
  const problems = [];
  if (value !== value.trim()) problems.push('starts or ends with a space');
  if (/[<>]/.test(value)) problems.push('may not contain < or > (plain text only, no HTML)');
  if (/[\u0000-\u001f\u007f]/.test(value)) problems.push('contains a line break, a tab or another control character');
  for (const name of placeholdersOf(value)) if (!PLACEHOLDERS.includes(name)) problems.push(`unknown placeholder {{${name}}}`);
  const links = [...value.matchAll(LINK_RE)];
  const rest = value.replace(LINK_RE, '');
  if (/[{}]/.test(rest.replace(PLACEHOLDER_RE, ''))) problems.push(`broken placeholder (write it exactly like {{${PLACEHOLDERS[0]}}})`);
  if (/\[\[|\]\]/.test(rest)) problems.push('broken link (write it exactly like [[privacy|link text]], the text without [ ] | { })');
  if (kind === R) {
    for (const [, target, text] of links) {
      if (!LINK_TARGETS.includes(target)) problems.push(`unknown link target [[${target}|...]] (the targets: ${LINK_TARGETS.join(', ')})`);
      if (text !== text.trim()) problems.push(`the link text of [[${target}|...]] starts or ends with a space`);
    }
  } else {
    if (links.length) problems.push('may not hold a link ([[...]]): this text is a heading, a label or an attribute');
    if (placeholdersOf(value).includes('CONTACT_EMAIL')) problems.push('may not use {{CONTACT_EMAIL}} (it becomes a link, and this text is a heading, a label or an attribute)');
  }
  return problems;
}

const join = (where, key) => (where ? `${where}.${key}` : String(key));

function walk(value, schema, where, base, problems, leaves) {
  if (schema === T || schema === R) {
    for (const problem of textProblems(value, schema)) problems.push(`${where} ${problem}`);
    if (typeof value === 'string') leaves.set(where, value);
    return;
  }
  if (Array.isArray(schema)) {
    const [count, item] = schema;
    if (!Array.isArray(value)) {
      problems.push(`${where} must be a list`);
      return;
    }
    const want = count || (Array.isArray(base) ? base.length : 0);
    if (want ? value.length !== want : value.length < 1) problems.push(`${where} must have ${want ? `${want} items` : 'at least one item'} (found ${value.length})`);
    value.forEach((entry, i) => walk(entry, item, join(where, i), Array.isArray(base) ? base[i] : undefined, problems, leaves));
    return;
  }
  if (!isObject(value)) {
    problems.push(`${where || 'the file'} must be an object`);
    return;
  }
  for (const key of Object.keys(schema)) {
    if (!(key in value)) problems.push(`${join(where, key)} is missing`);
    else walk(value[key], schema[key], join(where, key), isObject(base) ? base[key] : undefined, problems, leaves);
  }
  for (const key of Object.keys(value)) {
    if (!(key in schema) && !(where === '' && key === MARKER_KEY)) problems.push(`unknown key ${join(where, key)}`);
  }
}

/**
 * Every text of a content object: key -> text. A key is the path of the text with dots, list items by their
 * number from 0 (features.items.2.title, faq.items.7.q) - the form "_status.keys" uses. Unknown keys are left out.
 */
export function flattenContent(content) {
  const leaves = new Map();
  walk(content, CONTENT_SCHEMA, '', undefined, [], leaves);
  return leaves;
}

/**
 * The translation state of a content object: null = finished (no "_status"), 'all' = an English copy, or the
 * list of the keys that still hold English text. Meant for a valid object (contentProblems checks the shape).
 */
export function contentStatus(content) {
  if (!isObject(content) || !(MARKER_KEY in content)) return null;
  const status = content[MARKER_KEY];
  if (isObject(status) && Array.isArray(status.keys)) return [...status.keys];
  return 'all';
}

function statusProblems(status, leaves) {
  const shape = `"${MARKER_KEY}" must be { "marker": "${UNTRANSLATED_MARKER}", "keys": "all" } or { "marker": "${UNTRANSLATED_MARKER}", "keys": [the keys that still wait] } (delete it when the file is translated)`;
  if (!isObject(status) || status.marker !== UNTRANSLATED_MARKER || Object.keys(status).sort().join() !== 'keys,marker') return [shape];
  if (status.keys === 'all') return [];
  if (!Array.isArray(status.keys) || !status.keys.length) return [shape];
  const problems = [];
  const seen = new Set();
  for (const key of status.keys) {
    if (typeof key !== 'string' || !leaves.has(key)) problems.push(`"${MARKER_KEY}" lists ${JSON.stringify(key)}, which is not a text of the file (write keys like nav.about or faq.items.7.q)`);
    else if (seen.has(key)) problems.push(`"${MARKER_KEY}" lists ${key} twice`);
    seen.add(key);
  }
  return problems;
}

/**
 * What is wrong with a content object (empty when it is valid). `base` is the English content: a translation
 * must have its list lengths and, key by key, exactly its placeholders and its link targets.
 */
export function contentProblems(content, base = null) {
  const problems = [];
  const leaves = new Map();
  walk(content, CONTENT_SCHEMA, '', base ?? undefined, problems, leaves);
  if (isObject(content) && MARKER_KEY in content) {
    if (!base) problems.push(`"${MARKER_KEY}" does not belong in the English file`);
    else problems.push(...statusProblems(content[MARKER_KEY], leaves));
  }
  if (base) {
    const english = flattenContent(base);
    const list = (names, wrap) => (names.length ? names.map(wrap).join(' ') : 'none');
    for (const [where, text] of leaves) {
      if (!english.has(where)) continue;
      const wantNames = placeholdersOf(english.get(where));
      const foundNames = placeholdersOf(text);
      if (wantNames.join() !== foundNames.join()) {
        const wrap = (name) => `{{${name}}}`;
        problems.push(`${where} must use exactly the placeholders of the English text (${list(wantNames, wrap)}); found ${list(foundNames, wrap)}`);
      }
      const wantLinks = linkTargetsOf(english.get(where));
      const foundLinks = linkTargetsOf(text);
      if (wantLinks.join() !== foundLinks.join()) {
        const wrap = (target) => `[[${target}|...]]`;
        problems.push(`${where} must hold exactly the links of the English text (${list(wantLinks, wrap)}); found ${list(foundLinks, wrap)}`);
      }
    }
  }
  return problems;
}

/** The content file of a locale. */
export function contentFile(root, locale) {
  return path.join(root, CONTENT_DIR, `site-${locale}.json`);
}

/** Content files (project-relative, forward slashes) that still carry the marker; empty when all are translated. */
export function untranslatedContent(root = ROOT) {
  const found = [];
  for (const l of LOCALES) {
    const file = contentFile(root, l.code);
    if (existsSync(file) && readFileSync(file, 'utf8').includes(UNTRANSLATED_MARKER)) found.push(slash(path.relative(root, file)));
  }
  return found;
}

// ---------------------------------------------------------------------------------------------
// The two legal documents inside the site
// ---------------------------------------------------------------------------------------------

/** The documents the site shows in its own frame; the other two (support, account deletion) stay outside it. */
export const LEGAL_KINDS = ['terms', 'privacy'];

/** The source of a legal document in a locale: legal/<kind>/<kind>-<locale>.md. */
export function legalSourceFile(root, kind, locale) {
  return sourceFile(root, LEGAL_PAGES.find((page) => page.id === kind), locale);
}

/**
 * The outline of a legal source: its headings in order, each with its level and the number of list items under it.
 * A translation has the outline of the English document - it may add a paragraph (the note on the English version)
 * but no heading and no list item - so another outline means that the translation was not brought up to date when
 * the English document grew (SITE.md section 5: the policy describes the contact form before the form goes live).
 */
export function legalOutline(source) {
  const outline = [];
  for (const line of source.replace(/\r\n/g, '\n').replace(/^﻿?---\n[\s\S]*?\n---\n/, '').split('\n')) {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) outline.push({ level: heading[1].length, title: heading[2].trim(), items: 0 });
    else if (outline.length && /^(?:- |\d+\. )/.test(line)) outline.at(-1).items += 1;
  }
  return outline;
}

/** Where the outline of a translation first differs from the English one, in words; null when they are the same. */
export function legalOutlineGap(source, englishSource) {
  const mine = legalOutline(source);
  const base = legalOutline(englishSource);
  const levels = (outline) => outline.map((h) => h.level).join(' ');
  if (levels(mine) !== levels(base)) return mine.length === base.length ? 'its headings are not those of the English document' : `${mine.length} headings, English ${base.length}`;
  const i = base.findIndex((h, n) => h.items !== mine[n].items);
  return i < 0 ? null : `"${base[i].title}": ${mine[i].items} list items, English ${base[i].items}`;
}

// ---------------------------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------------------------

/** App locale -> the folder of its phone screenshots (the Play locale codes of scripts/play/check-listing.mjs). */
export const PLAY_FOLDER = Object.fromEntries(Object.entries(PLAY_LOCALES).map(([folder, def]) => [def.app, folder]));
/** App locale -> the folder of its desktop screenshots (the Store tags of scripts/store/check-listing.mjs). */
export const STORE_FOLDER = Object.fromEntries(Object.entries(STORE_LOCALES).map(([folder, def]) => [def.app, folder]));

/** The five screenshots of a home page, in the order of screens.items in the content files. The first is the hero image. */
export const SHOTS = [
  { id: 'phone-home', kind: 'phone', file: '01-home.png', width: 1080, height: 1920 },
  { id: 'phone-entry', kind: 'phone', file: '03-entry.png', width: 1080, height: 1920 },
  { id: 'phone-habits', kind: 'phone', file: '04-habits.png', width: 1080, height: 1920 },
  { id: 'phone-insights', kind: 'phone', file: '05-insights.png', width: 1080, height: 1920 },
  { id: 'desktop-home', kind: 'desktop', file: '01-home.png', width: 1920, height: 1080 },
];
/** The sharing image (og:image) and the icon, one copy for all languages. rel = the place inside the site. */
export const SHARE_IMAGE = { rel: 'img/share.png', source: path.join('play', 'graphics', FEATURE.file), width: FEATURE.width, height: FEATURE.height };
export const ICON_IMAGE = { rel: 'img/icon.svg', source: ICON_FILE };

/** The screenshots of a locale: where each is published (relative to the top of the site) and where it comes from. */
export function shotsOf(locale) {
  return SHOTS.map((shot) => ({
    ...shot,
    rel: `img/${locale}/${shot.id}.png`,
    source: shot.kind === 'phone' ? path.join('play', 'screenshots', String(PLAY_FOLDER[locale]), shot.file) : path.join('store', 'screenshots', String(STORE_FOLDER[locale]), shot.file),
  }));
}

/** Width and height of a PNG file (its IHDR chunk). Throws when the file is not a PNG. */
export function pngSize(file) {
  const head = Buffer.alloc(32);
  const fd = openSync(file, 'r');
  try {
    readSync(fd, head, 0, head.length, 0);
  } finally {
    closeSync(fd);
  }
  const { width, height } = pngInfo(head);
  return { width, height };
}

function imageProblem(root, image) {
  const file = path.join(root, image.source);
  if (!existsSync(file)) return `${slash(image.source)} is missing`;
  let size;
  try {
    size = pngSize(file);
  } catch {
    return `${slash(image.source)} is not a PNG file`;
  }
  if (size.width !== image.width || size.height !== image.height) return `${slash(image.source)} is ${size.width}x${size.height}, expected ${image.width}x${image.height}`;
  return null;
}

/** What is wrong with the icon (null when it is a plain SVG image: the header shows it and the browser tab too). */
function iconProblem(root) {
  let svg;
  try {
    svg = readFileSync(path.join(root, ICON_FILE), 'utf8');
  } catch (e) {
    return `${slash(ICON_FILE)}: cannot read it (${e.message})`;
  }
  if (!/^\s*<svg\b[^>]*\bviewBox="[\d\s.-]+"/.test(svg) || !svg.trim().endsWith('</svg>') || /<script|<foreignObject|\son\w+\s*=|href\s*=/i.test(svg)) {
    return `${slash(ICON_FILE)}: expected one plain, self-contained <svg> with a viewBox`;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// The colours: the app's own theme tokens
// ---------------------------------------------------------------------------------------------

/**
 * Colour of the site -> the token of src/styles/tokens.css it takes its value from, in the light theme (:root)
 * and in the dark one ([data-theme="dark"]). One accent colour (the app's navy / its light blue in the dark).
 */
export const THEME_TOKENS = {
  bg: 'color-bg',
  card: 'color-surface',
  alt: 'color-surface-alt',
  fg: 'color-text',
  muted: 'color-text-muted',
  line: 'color-border',
  'line-strong': 'color-border-strong',
  accent: 'color-primary',
  'accent-hover': 'color-primary-hover',
  'on-accent': 'color-on-primary',
  soft: 'color-primary-soft',
  link: 'color-link',
  focus: 'color-focus',
  shadow: 'color-shadow',
  // The frame around a phone screenshot: nearly black on the light page, a quiet grey on the dark one.
  frame: { light: 'color-text', dark: 'color-border' },
};

/**
 * Text colour on background colour, as the style sheet uses them. The test computes the contrast of every pair
 * in both themes (at least 4.5:1) and checks that the style sheet uses no colour that is not listed here.
 */
export const COLOR_PAIRS = [
  ['fg', 'bg'],
  ['muted', 'bg'],
  ['link', 'bg'],
  ['fg', 'card'],
  ['muted', 'card'],
  ['link', 'card'],
  ['accent', 'card'],
  ['fg', 'alt'],
  ['muted', 'alt'],
  ['link', 'alt'],
  ['link', 'soft'],
  ['accent', 'soft'],
  ['on-accent', 'accent'],
  ['on-accent', 'accent-hover'],
];
/**
 * What marks a control or its state - the border of a field, of the language list and of the tab panel, the bar
 * of the current menu item and of the selected tab, the focus ring - on the surface it stands on. The test
 * computes at least 3:1 for each in both themes (WCAG 1.4.11).
 */
export const CONTROL_PAIRS = [
  ['line-strong', 'bg'],
  ['line-strong', 'card'],
  ['line-strong', 'alt'],
  ['accent', 'card'],
  ['accent', 'soft'],
  ['focus', 'bg'],
  ['focus', 'card'],
  ['focus', 'alt'],
];
/** Colours that are never behind or in a text: borders, the focus ring, shadows, the device frames. */
export const DECOR_COLORS = ['line', 'line-strong', 'focus', 'shadow', 'frame'];

function cssVariables(css, selector, name) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`${slash(TOKENS_FILE)}: the ${name} theme block (${selector}) was not found`);
  const vars = {};
  for (const m of block[1].replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

/** The colours of the site in both themes, read from the app's tokens: { light: { bg: '#f4f6f9', ... }, dark: { ... } }. */
export function readThemeTokens(root = ROOT) {
  let css;
  try {
    css = readFileSync(path.join(root, TOKENS_FILE), 'utf8').replace(/\r\n/g, '\n');
  } catch (e) {
    throw new Error(`${slash(TOKENS_FILE)}: cannot read it (${e.message})`);
  }
  const sources = { light: cssVariables(css, ':root', 'light'), dark: cssVariables(css, '[data-theme="dark"]', 'dark') };
  const theme = { light: {}, dark: {} };
  for (const mode of ['light', 'dark']) {
    for (const [name, token] of Object.entries(THEME_TOKENS)) {
      const tokenName = typeof token === 'string' ? token : token[mode];
      const value = sources[mode][tokenName];
      if (!value) throw new Error(`${slash(TOKENS_FILE)}: the ${mode} theme has no --${tokenName}`);
      const ok = name === 'shadow' ? /^rgba?\([\d\s.,%]+\)$/.test(value) : /^#[0-9a-f]{6}$/i.test(value);
      if (!ok) throw new Error(`${slash(TOKENS_FILE)}: --${tokenName} (${mode}) is "${value}", expected ${name === 'shadow' ? 'an rgba() colour' : 'a #rrggbb colour'}`);
      theme[mode][name] = value.toLowerCase();
    }
  }
  return theme;
}

/** The font stack of the legal pages (scripts/legal/build-pages.mjs STYLE; a test keeps the two equal). */
export const FONT_STACK =
  'system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans","Noto Sans Hebrew","Noto Sans Arabic","Noto Sans Devanagari","Noto Sans Thai","Noto Sans CJK SC","Microsoft YaHei","Yu Gothic",Arial,sans-serif';

const cssVars = (colours) => Object.entries(colours).map(([name, value]) => `--${name}:${value}`).join(';');

/**
 * The style sheet of the site (site.css), one rule per line. Logical properties only (margin-inline,
 * inset-inline, border-start-start-radius, text-align:start), so the layout mirrors itself in a right-to-left
 * page; no transition and no animation. Every control is at least 2.75rem (44 px) high.
 */
export function siteCss(theme) {
  return `${`
:root{color-scheme:light dark;${cssVars(theme.light)}}
@media (prefers-color-scheme:dark){:root{${cssVars(theme.dark)}}}
*,::before,::after{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{display:flex;flex-direction:column;min-height:100vh;margin:0;background:var(--bg);color:var(--fg);font:1rem/1.6 ${FONT_STACK};overflow-wrap:anywhere}
h1,h2,h3,p,ul,ol,dl,dd,figure{margin:0}
ul,ol{padding:0;list-style:none}
h1,h2{text-wrap:balance}
img,svg{display:block;max-width:100%}
a{color:var(--link);text-underline-offset:.15em}
bdi[lang]{white-space:nowrap}
button,input,select,textarea{margin:0;font:inherit}
a:focus-visible,summary:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,.strip:focus-visible,.panel:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.wrap{max-width:72rem;margin-inline:auto;padding-inline:1.25rem}
.sprite{position:absolute;width:0;height:0;overflow:hidden}
.ic{flex:none;width:1.5rem;height:1.5rem;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.skip{position:absolute;z-index:3;inset-block-start:-5rem;inset-inline-start:.75rem;padding:.6rem 1rem;border-radius:10px;background:var(--accent);color:var(--on-accent);font-weight:600}
.skip:focus{inset-block-start:.75rem}
.top{background:var(--card);border-block-end:1px solid var(--line)}
.brand{display:inline-flex;align-items:center;gap:.6rem;min-height:2.75rem;margin-block-start:.6rem;font-size:1.15rem;font-weight:700;color:var(--accent);text-decoration:none}
.app-icon{flex:none;width:2rem;height:2rem}
.menu ul{display:flex;flex-wrap:wrap;gap:.125rem .25rem;margin-inline:-.75rem;padding-block:.25rem .5rem}
.menu a{display:flex;align-items:center;min-height:2.75rem;padding-inline:.75rem;border-radius:10px;color:var(--fg);font-weight:600;text-decoration:none}
.menu a:hover{background:var(--alt)}
.menu a[aria-current]{background:var(--soft);color:var(--accent);box-shadow:inset 0 -3px 0 var(--accent)}
.hero{padding-block:2.5rem 3rem;background:linear-gradient(var(--card),var(--bg))}
.hero .wrap{display:grid;gap:2.5rem;align-items:center}
h1{font-size:clamp(1.75rem,1.1rem + 3.3vw,3rem);line-height:1.2}
.lead{max-width:42rem;margin-block-start:1rem;font-size:1.15rem;color:var(--muted)}
.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-block-start:1.75rem}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:2.75rem;padding:.55rem 1.25rem;border:1px solid var(--accent);border-radius:10px;background:var(--card);color:var(--link);font-weight:600;text-align:center;text-decoration:none;cursor:pointer}
.btn:hover{background:var(--soft)}
.btn.primary{background:var(--accent);color:var(--on-accent)}
.btn.primary:hover{background:var(--accent-hover)}
.actions .btn{flex:1 1 auto}
.note{margin-block-start:1rem;font-size:.95rem;color:var(--muted)}
.hero-shot{justify-self:center;width:min(17rem,78%)}
.phone{padding:.4rem;border-radius:1.9rem;background:var(--frame);box-shadow:0 1rem 2.5rem var(--shadow)}
.phone img{width:100%;height:auto;border-radius:1.5rem;background:var(--alt)}
.desk{overflow:hidden;border:1px solid var(--line-strong);border-radius:12px;background:var(--card);box-shadow:0 1rem 2.5rem var(--shadow)}
.desk img{width:100%;height:auto}
.dots{display:flex;gap:.35rem;padding:.55rem .7rem;border-block-end:1px solid var(--line)}
.dots span{width:.55rem;height:.55rem;border-radius:50%;background:var(--line-strong)}
section{padding-block:3.25rem}
.band{border-block:1px solid var(--line);background:var(--alt)}
h2{font-size:clamp(1.45rem,1.15rem + 1.5vw,2rem);line-height:1.25}
h2::before{content:"";display:block;width:2.5rem;height:.25rem;margin-block-end:.9rem;border-radius:2px;background:var(--accent)}
.sub{max-width:42rem;margin-block-start:.5rem;font-size:1.05rem;color:var(--muted)}
.cards{display:grid;gap:1rem;margin-block-start:1.75rem}
.card{padding:1.25rem;border:1px solid var(--line);border-radius:16px;background:var(--card)}
.tile{display:flex;align-items:center;justify-content:center;width:2.75rem;height:2.75rem;border-radius:10px;background:var(--soft);color:var(--accent)}
h3{margin-block:.9rem .3rem;font-size:1.1rem;line-height:1.3}
.card p{color:var(--muted)}
.strip{display:flex;gap:1.25rem;margin-block-start:1.75rem;margin-inline:-1.25rem;padding:.5rem 1.25rem 1.25rem;overflow-x:auto;scroll-snap-type:x proximity;scroll-padding-inline:1.25rem}
.strip:focus-visible{outline-offset:-3px}
.shot{flex:none;width:min(15rem,72vw);scroll-snap-align:start}
.shot.wide{width:min(44rem,88vw)}
figcaption{margin-block-start:.9rem;font-size:.95rem;color:var(--muted);text-align:center}
.split{display:grid;grid-template-areas:"head" "list";gap:1.5rem}
.split.plus{grid-template-areas:"head" "list" "more"}
.split>.head{grid-area:head}
.split>.list{grid-area:list}
.split>.policy{grid-area:more}
.checks{display:grid;gap:.9rem}
.checks li{display:grid;grid-template-columns:auto 1fr;gap:.75rem;align-items:start}
.checks .ic{margin-block-start:.1rem;color:var(--accent)}
.page{padding-block:2.5rem 3.5rem}
.page section{padding-block:0}
.group{margin-block-start:2.5rem}
.group>h2{margin-block-end:1.25rem}
.qa{border:1px solid var(--line);border-radius:10px;background:var(--card)}
.qa+.qa{margin-block-start:.75rem}
.qa summary{display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:2.75rem;padding:.75rem 1rem;border-radius:10px;font-weight:600;cursor:pointer;list-style:none}
.qa summary::-webkit-details-marker{display:none}
.qa[open] summary .ic{transform:rotate(180deg)}
.qa>p{max-width:52rem;padding:0 1rem 1rem}
.doc{max-width:50rem}
.doc h1{font-size:clamp(1.6rem,1.2rem + 2vw,2.25rem)}
.doc h2{margin-block:2.25rem .5rem;font-size:1.3rem;line-height:1.35}
.doc h2::before{content:none}
.doc h3{margin-block:1.5rem .25rem}
.doc p,.doc ul,.doc ol{margin-block:.6rem}
.doc ul,.doc ol{padding-inline-start:1.4rem}
.doc ul{list-style:disc}
.doc ol{list-style:decimal}
.doc li{margin-block:.3rem}
code{padding-inline:.25rem;border:1px solid var(--line);border-radius:4px;background:var(--card);font-family:ui-monospace,Consolas,monospace;font-size:.92em}
.tabs{margin-block-start:2rem}
.tablist{display:flex;flex-wrap:wrap;gap:.25rem;border-block-end:1px solid var(--line-strong)}
.tab{min-width:5.5rem;min-height:2.75rem;margin-block-end:-1px;padding:.5rem 1.1rem;border:1px solid transparent;border-start-start-radius:10px;border-start-end-radius:10px;background:none;color:var(--fg);font-weight:600;cursor:pointer}
.tab:hover{background:var(--alt)}
.tab[aria-selected=true]{border-color:var(--line-strong);border-block-end-color:var(--card);background:var(--card);color:var(--accent);box-shadow:inset 0 3px 0 var(--accent)}
.panel+.panel{margin-block-start:2.5rem}
.panel>h2{margin-block-end:1.25rem}
.panel>p{max-width:46rem;margin-block-start:1rem}
.panel>.qa{margin-block-start:1.25rem}
.tabs-on .panel{margin-block-start:0;padding:1.25rem;border:1px solid var(--line-strong);border-block-start:0;border-end-start-radius:16px;border-end-end-radius:16px;background:var(--card)}
.tabs-on .panel>h2{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.files{overflow:hidden;border:1px solid var(--line);border-radius:10px;background:var(--card)}
table{width:100%;border-collapse:collapse}
caption{padding:.75rem 1rem;color:var(--muted);font-weight:600;text-align:start}
th,td{padding:.4rem 1rem;border-block-start:1px solid var(--line);text-align:start;vertical-align:middle}
thead th{font-size:.9rem;color:var(--muted);white-space:nowrap}
td{white-space:nowrap}
.get{display:inline-flex;align-items:center;min-height:2.75rem;font-weight:600}
.files>.empty{padding:.75rem 1rem}
.files:has(>.empty:not([hidden]))>table,.panel:has(>.files>.empty:not([hidden]))>.qa,.panel:has(>.files>.empty:not([hidden]))>.files~p:not(.need){display:none}
.need{font-weight:600}
.sums{display:grid;gap:.25rem;padding:0 1rem 1rem}
.sums dt{margin-block-start:.5rem;font-weight:600}
.more{margin-block-start:3rem}
.more p{max-width:46rem;margin-block-start:1rem}
.form{display:grid;gap:1.1rem;padding:1.25rem;border:1px solid var(--line);border-radius:16px;background:var(--card)}
.hp{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.row{display:grid;gap:1.1rem}
.field{display:grid;gap:.35rem}
.field label{font-weight:600}
.field input,.field textarea{width:100%;min-height:3rem;padding:.6rem .8rem;border:1px solid var(--line-strong);border-radius:10px;background:var(--bg);color:var(--fg)}
.field textarea{min-height:9rem;resize:vertical}
.hint,.notice{font-size:.95rem;color:var(--muted)}
.send .btn{min-width:10rem;min-height:3rem}
.mail{display:inline-block;padding-block:.65rem;font-weight:600}
footer{margin-block-start:auto;padding-block:2rem 2.5rem;border-block-start:1px solid var(--line);background:var(--card);font-size:.95rem;color:var(--muted)}
.chooser{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem .75rem}
.chooser label{color:var(--fg);font-weight:600}
.chooser select{flex:0 1 13rem;min-width:0;min-height:2.75rem;padding:.4rem .75rem;border:1px solid var(--line-strong);border-radius:10px;background:var(--card);color:var(--fg)}
.langs p{color:var(--fg);font-weight:600}
.langs ul{display:flex;flex-wrap:wrap;gap:0 1.25rem}
.langs a{display:inline-flex;align-items:center;min-height:2.75rem}
.langs a[aria-current]{color:var(--fg);font-weight:700;text-decoration:none}
.copy{margin-block-start:1.25rem}
:lang(ar) h1,:lang(hi) h1,:lang(th) h1,:lang(ar) h2,:lang(hi) h2,:lang(th) h2{line-height:1.45}
@media (max-width:33.99rem){.cards>.card{display:grid;grid-template-columns:auto 1fr;gap:.7rem .8rem;align-items:center}.cards>.card h3{margin:0}.cards>.card p{grid-column:1/-1}.cards .tile{width:2.5rem;height:2.5rem}th,td,caption{padding-inline:.6rem}.tabs-on .panel,.form{padding:1rem .75rem}.chooser label{flex-basis:100%}.menu ul{margin-inline:-.5rem}.menu a{padding-inline:.5rem;font-size:.95rem}.tab{flex:1 1 0;min-width:0;padding-inline:.5rem}}
@media (min-width:30rem){.actions .btn{flex:0 1 auto}}
@media (min-width:34rem){.features{grid-template-columns:repeat(2,minmax(0,1fr))}.row{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (min-width:54rem){.top .wrap{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0 2rem}.brand{margin-block:.6rem}.menu ul{padding-block:.5rem}.hero{padding-block:4rem 3rem}.hero .wrap{grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:3rem}.hero-shot{width:min(19rem,100%)}section{padding-block:4.5rem}.split{grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);grid-template-areas:"head list";column-gap:3rem;align-items:start}.split.plus{grid-template-areas:"head list" "more list";grid-template-rows:auto 1fr}.page{padding-block:3.5rem 4.5rem}}
@media (min-width:61rem){.features{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (min-width:68rem){.strip{flex-wrap:wrap;justify-content:center;row-gap:2.5rem;margin-inline:0;padding-inline:0;overflow:visible}.shot.wide{width:46rem}}
`.trim()}\n`;
}

// ---------------------------------------------------------------------------------------------
// The pages
// ---------------------------------------------------------------------------------------------

/** The line icons of the pages (24x24, drawn for this site; no icon library). */
const ICONS = {
  write: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/>',
  habits: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  insights: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.6 1 2.5h6c0-.9.3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  stats: '<path d="M4 20h16M7 20v-6M12 20V6M17 20v-9"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.5-3.5M4 5v3.5h3.5"/><path d="M4 13a8 8 0 0 0 14.5 3.5M20 19v-3.5h-3.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  access: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="7.5" r=".6"/><path d="M7.5 10.5h9M12 10.5v4M12 14.5l-2.5 3.5M12 14.5l2.5 3.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
};
/** The icon of each feature card (features.items of the content files, in order). */
const FEATURE_ICONS = ['write', 'habits', 'insights', 'calendar', 'stats', 'sync', 'globe', 'access'];
/** The icons a page draws; a page without icons carries no sprite. */
const PAGE_ICONS = { home: [...FEATURE_ICONS, 'check'], faq: ['chevron'], downloads: ['chevron'] };

const sprite = (ids) => `<svg class="sprite" aria-hidden="true" focusable="false">${ids.map((id) => `<symbol id="i-${id}" viewBox="0 0 24 24">${ICONS[id]}</symbol>`).join('')}</svg>`;
const icon = (id) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-${id}"/></svg>`;

/** og:locale wants language_TERRITORY; Arabic has no territory in the app (ar), Open Graph calls it ar_AR. */
const ogLocale = (def) => (def.intl.includes('-') ? def.intl.replace('-', '_') : `${def.intl}_${def.intl.toUpperCase()}`);

// isolateLatin (a text of a right-to-left page, escaped, with every Latin-only fragment and number in <bdi>) comes from
// ./downloads-shared.mjs: the rows of the download tables use it on the hosted server too.

const unescapeHtml = (text) => text.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/**
 * The same isolation for a rendered legal document of a right-to-left page: every text node outside an element
 * that carries its own direction (the addresses and the code fragments, dir="ltr") gets its Latin fragments in
 * <bdi>. A placeholder that is still visible ({{NAME}}, a setting that is not set yet) stays as it is.
 */
function isolateLatinInHtml(html) {
  const text = (raw) =>
    raw
      .split(/(\{\{[A-Z][A-Z0-9_]*\}\})/)
      .map((part, i) => (i % 2 ? part : isolateLatin(unescapeHtml(part))))
      .join('');
  const open = [];
  let out = '';
  let last = 0;
  for (const m of html.matchAll(/<(\/?)[a-z][a-z0-9]*((?:\s+[^\s"<>=]+(?:="[^"]*")?)*)\s*>/g)) {
    const before = html.slice(last, m.index);
    out += (open.includes(true) ? before : text(before)) + m[0];
    if (m[1]) open.pop();
    else open.push(/\sdir="/.test(m[2]));
    last = m.index + m[0].length;
  }
  return out + text(html.slice(last));
}

/**
 * A legal document for a page of the site: { title, description, html }. The text is the source of legal/, through
 * the functions of scripts/legal/build-pages.mjs - never a second copy. Inside the site {{TERMS_URL}} and
 * {{PRIVACY_URL}} lead to the site's own pages of the same language (`links`, relative), and where a document
 * shows such an address as text it shows the address of that page (`shown`, absolute); {{SUPPORT_URL}} and
 * {{DELETE_URL}} keep leading to the standalone pages on the server; {{SITE_URL}} stays the web app's address.
 */
export function renderLegalDocument({ kind, locale, source, settings, siteUrl, links, shown }) {
  const def = localeOf(locale);
  const name = `${kind}-${locale}.md`;
  const { meta, body } = parseSource(source, name);
  const values = {
    PUBLISHER_NAME: settings.publisherName,
    CONTACT_EMAIL: settings.contactEmail,
    EFFECTIVE_DATE: dateInWords(settings.effectiveDate, def.intl),
    TERMS_EFFECTIVE_DATE: dateInWords(settings.termsEffectiveDate, def.intl),
    MINIMUM_AGE: new Intl.NumberFormat(def.intl, { useGrouping: false }).format(settings.minimumAge),
    SITE_URL: siteUrl,
    PRIVACY_URL: shown.privacy,
    TERMS_URL: shown.terms,
    DELETE_URL: `${siteUrl}${pagePath('delete-account', locale)}`,
    SUPPORT_URL: `${siteUrl}${pagePath('support', locale)}`,
  };
  const linked = markdownToHtml(body).replaceAll('href="{{PRIVACY_URL}}"', `href="${links.privacy}"`).replaceAll('href="{{TERMS_URL}}"', `href="${links.terms}"`);
  const html = fillPlaceholders(linked, values, name);
  if (!html.startsWith('<h1>') || html.split('<h1>').length !== 2) throw new Error(`${name}: the document must start with its one "# " heading (it is the heading of the page)`);
  return { title: meta.title, description: meta.description, html: def.dir === 'rtl' ? isolateLatinInHtml(html) : html };
}

/**
 * One complete page: `page` is an id of SITE_PAGES, `source` the Markdown source of its legal document (the two
 * legal pages only), `downloads` the rows of site/downloads.json (the Downloads page only).
 */
export function renderSitePage({ page: pageId, locale, content, settings, siteSettings, siteUrl, downloads, source }) {
  const page = sitePage(pageId);
  const def = localeOf(locale);
  const rtl = def.dir === 'rtl';
  const dir = siteDir(pageId, locale);
  const siteBase = siteBaseOf(siteSettings, siteUrl);
  /** A relative address from this page to a place of the site (relative to its top). */
  const to = (target) => relativeHref(dir, target);
  const toPage = (id, code = locale) => to(siteDir(id, code));

  const values = {
    BRAND,
    MINIMUM_AGE: new Intl.NumberFormat(def.intl, { useGrouping: false }).format(settings.minimumAge),
    PUBLISHER_NAME: settings.publisherName,
    CONTACT_EMAIL: settings.contactEmail,
  };
  // A setting that is still null leaves its {{PLACEHOLDER}} visible, as in the legal pages.
  const filled = (name) => values[name] !== null && values[name] !== undefined;
  const brand = `<bdi lang="en" dir="ltr">${escapeHtml(BRAND)}</bdi>`;
  const mailLink = (address) => `<a class="mail" href="mailto:${escapeHtml(address)}"><bdi dir="ltr">${escapeHtml(address)}</bdi></a>`;
  const placeholderHtml = (name) => {
    if (!filled(name)) return `{{${name}}}`;
    if (name === 'BRAND') return brand;
    if (name === 'CONTACT_EMAIL') return mailLink(values[name]);
    return `<bdi>${escapeHtml(values[name])}</bdi>`;
  };
  const literal = rtl ? isolateLatin : escapeHtml;
  /** Where a link of a text leads: the pages of the site in this language, the documents outside it, the web app. */
  const linkHref = {
    home: toPage('home'),
    privacy: toPage('privacy'),
    terms: toPage('terms'),
    faq: toPage('faq'),
    downloads: toPage('downloads'),
    support: `${siteUrl}${pagePath('support', locale)}`,
    delete: `${siteUrl}${pagePath('delete-account', locale)}`,
    webapp: `${siteUrl}/`,
    contact: page.contact ? '#contact' : `${toPage('home')}#contact`,
  };
  /** A text as HTML: escaped, the placeholders filled, the links made, direction-neutral fragments isolated. */
  const rich = (text) => {
    let out = '';
    let last = 0;
    for (const m of text.matchAll(TOKEN_RE)) {
      out += literal(text.slice(last, m.index));
      out += m[1] ? placeholderHtml(m[1]) : `<a href="${escapeHtml(linkHref[m[2]])}">${literal(m[3])}</a>`;
      last = m.index + m[0].length;
    }
    return out + literal(text.slice(last));
  };
  /** A text for an attribute or the title: escaped, the placeholders filled as plain text, a link as its text. */
  const attr = (text) => escapeHtml(text.replace(LINK_RE, '$2').replace(PLACEHOLDER_RE, (whole, name) => (filled(name) ? values[name] : whole)));
  /**
   * The text of a button or of a link that is laid out as a flex box: ONE element, so that an isolated fragment
   * inside it (<bdi>Google Play</bdi> in a Hebrew sentence) stays in the line instead of becoming a column.
   */
  const label = (text) => `<span>${rich(text)}</span>`;

  // The page's own content ------------------------------------------------------------------------
  let title;
  let description;
  let canonical = `${siteBase}${dir}`;
  let main;

  if (page.legal) {
    const doc = renderLegalDocument({
      kind: page.legal,
      locale,
      source,
      settings,
      siteUrl,
      links: { privacy: toPage('privacy'), terms: toPage('terms') },
      shown: { privacy: `${siteBase}${siteDir('privacy', locale)}`, terms: `${siteBase}${siteDir('terms', locale)}` },
    });
    title = escapeHtml(doc.title);
    description = escapeHtml(doc.description);
    // The stores and the apps link to the standalone page: it is the canonical address of the document.
    canonical = `${siteUrl}${pagePath(page.legal, locale)}`;
    main = ['<div class="wrap page">', '<div class="doc">', doc.html, '</div>', '</div>'];
  } else if (pageId === 'home') {
    const shots = shotsOf(locale);
    const img = (shot, alt, hero = false) =>
      `<img src="${to(shot.rel)}" width="${shot.width}" height="${shot.height}" alt="${attr(alt)}"${hero ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
    const figure = (shot, i) => {
      const { caption, alt } = content.screens.items[i];
      const frame =
        shot.kind === 'phone'
          ? `<div class="phone">${img(shot, alt)}</div>`
          : `<div class="desk"><div class="dots" aria-hidden="true"><span></span><span></span><span></span></div>${img(shot, alt)}</div>`;
      return `<figure class="shot${shot.kind === 'phone' ? '' : ' wide'}">${frame}<figcaption>${rich(caption)}</figcaption></figure>`;
    };
    title = attr(content.title);
    description = attr(content.description);
    main = [
      '<section class="hero">',
      '<div class="wrap">',
      '<div>',
      `<h1>${rich(content.hero.heading)}</h1>`,
      `<p class="lead">${rich(content.hero.lead)}</p>`,
      `<p class="actions"><a class="btn primary" href="${siteUrl}/">${label(content.hero.openAction)}</a><a class="btn" href="${toPage('downloads')}">${label(content.nav.downloads)}</a></p>`,
      `<p class="note">${rich(content.hero.note)}</p>`,
      '</div>',
      `<div class="hero-shot phone">${img(shots[0], content.screens.items[0].alt, true)}</div>`,
      '</div>',
      '</section>',
      '<section id="features">',
      '<div class="wrap">',
      `<h2>${rich(content.features.heading)}</h2>`,
      '<ul class="cards features">',
      ...content.features.items.map((item, i) => `<li class="card"><div class="tile">${icon(FEATURE_ICONS[i])}</div><h3>${rich(item.title)}</h3><p>${rich(item.text)}</p></li>`),
      '</ul>',
      '</div>',
      '</section>',
      '<section id="screens" class="band">',
      '<div class="wrap">',
      `<h2 id="screens-h">${rich(content.screens.heading)}</h2>`,
      '<div class="strip" role="region" aria-labelledby="screens-h" tabindex="0">',
      ...shots.map(figure),
      '</div>',
      '</div>',
      '</section>',
      '<section id="privacy">',
      '<div class="wrap split plus">',
      '<div class="head">',
      `<h2>${rich(content.privacy.heading)}</h2>`,
      `<p class="sub">${rich(content.privacy.lead)}</p>`,
      '</div>',
      '<ul class="card checks list">',
      ...content.privacy.items.map((text) => `<li>${icon('check')}<span>${rich(text)}</span></li>`),
      '</ul>',
      `<p class="policy"><a class="btn" href="${toPage('privacy')}">${label(content.privacy.policyLink)}</a></p>`,
      '</div>',
      '</section>',
    ];
  } else if (pageId === 'faq') {
    title = `${attr(content.faq.heading)} - ${escapeHtml(BRAND)}`;
    description = attr(content.faq.lead);
    const groups = [];
    let first = 0;
    FAQ_GROUP_SIZES.forEach((size, g) => {
      groups.push(
        '<section class="group">',
        `<h2>${rich(content.faq.groups[g])}</h2>`,
        ...content.faq.items.slice(first, first + size).map(({ q, a }) => `<details class="qa"><summary><span>${rich(q)}</span>${icon('chevron')}</summary><p>${rich(a)}</p></details>`),
        '</section>',
      );
      first += size;
    });
    main = ['<div class="wrap page">', `<h1>${rich(content.faq.heading)}</h1>`, `<p class="lead">${rich(content.faq.lead)}</p>`, ...groups, '</div>'];
  } else if (pageId === 'downloads') {
    const texts = content.downloads;
    title = `${attr(texts.heading)} - ${escapeHtml(BRAND)}`;
    description = attr(texts.lead);
    const storeLink = (key) => `<a class="btn primary" href="${escapeHtml(siteSettings.links[key])}">${label(texts.storeLinks[key])}</a>`;
    const panel = (platform) => {
      const store = Object.keys(STORE_LINKS).find((key) => STORE_LINKS[key].platform === platform && siteSettings.links[key]);
      // The parts that depend on the list, between their markers (./downloads-shared.mjs): the hosted server writes
      // them again with the same function for the list it merged from the image and the files the owner uploaded.
      const list = downloadRegions(platform, downloads[platform], { dir, rtl, intl: def.intl, emptyHtml: rich(texts.empty) });
      return [
        `<section class="panel" id="${platform}">`,
        `<h2>${rich(texts.tabs[platform])}</h2>`,
        ...(store ? [`<p class="actions">${storeLink(store)}</p>`] : []),
        '<div class="files">',
        '<table>',
        `<caption>${rich(texts.captions[platform])}</caption>`,
        `<thead><tr><th scope="col">${rich(texts.columns.file)}</th><th scope="col">${rich(texts.columns.version)}</th><th scope="col">${rich(texts.columns.size)}</th></tr></thead>`,
        '<tbody>',
        list.rows,
        '</tbody>',
        '</table>',
        list.empty,
        '</div>',
        `<p class="need">${rich(texts.requires[platform])}</p>`,
        `<p>${rich(texts.install[platform])}</p>`,
        '<details class="qa">',
        `<summary><span>${rich(texts.checkFile)}</span>${icon('chevron')}</summary>`,
        `<p>${rich(texts.checkText)}</p>`,
        '<dl class="sums">',
        list.sums,
        '</dl>',
        '</details>',
        '</section>',
      ];
    };
    const iphone = siteSettings.links.appStoreIphone ? `<p>${rich(texts.iphoneStore)}</p>\n<p class="actions">${storeLink('appStoreIphone')}</p>` : `<p>${rich(texts.iphone)}</p>`;
    main = [
      '<div class="wrap page">',
      `<h1>${rich(texts.heading)}</h1>`,
      `<p class="lead">${rich(texts.lead)}</p>`,
      `<div class="tabs" id="platforms" data-tabs-label="${attr(texts.tabsLabel)}">`,
      ...PLATFORMS.flatMap(panel),
      '</div>',
      '<section class="more">',
      `<h2>${rich(texts.moreHeading)}</h2>`,
      `<p>${rich(texts.web)}</p>`,
      iphone,
      '</section>',
      '</div>',
    ];
  } else {
    const sent = pageId === 'sent';
    const heading = sent ? content.contact.sentTitle : content.contact.errorTitle;
    const text = sent ? content.contact.sentText : content.contact.errorText;
    title = `${attr(heading)} - ${escapeHtml(BRAND)}`;
    description = attr(text);
    main = [
      '<div class="wrap page">',
      `<h1>${rich(heading)}</h1>`,
      `<p class="lead">${rich(text)}</p>`,
      `<p class="actions"><a class="btn primary" href="${toPage('home')}">${label(content.contact.backHome)}</a></p>`,
      '</div>',
    ];
  }

  // The frame --------------------------------------------------------------------------------------
  const alternates = [
    ...LOCALES.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${siteBase}${siteDir(pageId, l.code)}">`),
    `<link rel="alternate" hreflang="x-default" href="${siteBase}${siteDir(pageId, DEFAULT_LOCALE)}">`,
  ];
  const menu = [
    ...MENU.map(([id, key]) => `<li><a href="${toPage(id)}"${id === pageId ? ' aria-current="page"' : ''}>${label(content.nav[key])}</a></li>`),
    // The two result pages have no contact block: there "Contact us" is the current item and leads to the form of the
    // home page - the current item of the menu (aria-current="true"), not the page the link opens ("page").
    `<li><a href="${linkHref.contact}"${page.contact ? '' : ' aria-current="true"'}>${label(content.nav.contact)}</a></li>`,
  ];
  const field = (id, name, text, control) => `<div class="field"><label for="contact-${id}">${rich(text)}</label>${control(`id="contact-${id}" name="${name}"`)}</div>`;
  const contact = page.contact
    ? [
        '<section id="contact" class="band" aria-labelledby="contact-h">',
        '<div class="wrap split">',
        '<div class="head">',
        `<h2 id="contact-h">${rich(content.contact.heading)}</h2>`,
        `<p class="sub">${rich(content.contact.lead)}</p>`,
        `<p>${filled('CONTACT_EMAIL') ? mailLink(values.CONTACT_EMAIL) : '{{CONTACT_EMAIL}}'}</p>`,
        '</div>',
        `<form class="form list" method="post" action="${CONTACT_ACTION}">`,
        `<p class="hint">${rich(content.contact.required)}</p>`,
        `<input type="hidden" name="lang" value="${locale}">`,
        `<div class="hp" aria-hidden="true"><label for="contact-website">${rich(content.contact.honeypot)}</label><input type="text" id="contact-website" name="website" tabindex="-1" autocomplete="off"></div>`,
        '<div class="row">',
        field('first', 'firstName', content.contact.firstName, (ids) => `<input type="text" ${ids} autocomplete="given-name" maxlength="80" dir="auto" required>`),
        field('last', 'lastName', content.contact.lastName, (ids) => `<input type="text" ${ids} autocomplete="family-name" maxlength="80" dir="auto" required>`),
        '</div>',
        field('email', 'email', content.contact.email, (ids) => `<input type="email" ${ids} autocomplete="email" maxlength="254" dir="ltr" required>`),
        field('message', 'message', content.contact.message, (ids) => `<textarea ${ids} rows="6" maxlength="5000" dir="auto" required></textarea>`),
        `<p class="notice">${rich(content.contact.notice)}</p>`,
        `<p class="send"><button class="btn primary" type="submit">${label(content.contact.send)}</button></p>`,
        '</form>',
        '</div>',
        '</section>',
      ]
    : [];
  const options = LOCALES.map((l) => `<option value="${toPage(pageId, l.code)}" lang="${l.code}"${l.code === locale ? ' selected' : ''}>${escapeHtml(l.name)}</option>`);
  // <bdi>, not dir on the link: the name keeps its own direction and the list keeps the alignment of the page.
  const languageLinks = LOCALES.map((l) => `<li><a href="${toPage(pageId, l.code)}" hreflang="${l.code}" lang="${l.code}"${l.code === locale ? ' aria-current="page"' : ''}><bdi>${escapeHtml(l.name)}</bdi></a></li>`);
  const icons = PAGE_ICONS[pageId];

  return [
    '<!doctype html>',
    `<html lang="${def.code}" dir="${def.dir}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    `<meta name="description" content="${description}">`,
    '<meta name="color-scheme" content="light dark">',
    // The server sends "Referrer-Policy: no-referrer"; with it a browser posts the form with "Origin: null".
    // This line makes the form (and nothing that leaves the site) say where it comes from.
    '<meta name="referrer" content="same-origin">',
    ...(page.noindex ? ['<meta name="robots" content="noindex">'] : []),
    GENERATOR_TAG,
    `<link rel="canonical" href="${canonical}">`,
    ...alternates,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${escapeHtml(BRAND)}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${siteBase}${SHARE_IMAGE.rel}">`,
    `<meta property="og:image:width" content="${SHARE_IMAGE.width}">`,
    `<meta property="og:image:height" content="${SHARE_IMAGE.height}">`,
    `<meta property="og:locale" content="${ogLocale(def)}">`,
    `<link rel="icon" type="image/svg+xml" href="${to(ICON_IMAGE.rel)}">`,
    `<link rel="stylesheet" href="${to(CSS_NAME)}">`,
    `<script src="${to(SCRIPT_NAME)}" defer></script>`,
    '</head>',
    '<body>',
    `<a class="skip" href="#main">${rich(content.skipLink)}</a>`,
    ...(icons ? [sprite(icons)] : []),
    '<header class="top">',
    '<div class="wrap">',
    `<a class="brand" href="${toPage('home')}"><img class="app-icon" src="${to(ICON_IMAGE.rel)}" width="32" height="32" alt="">${brand}</a>`,
    `<nav class="menu" aria-label="${attr(content.nav.label)}">`,
    '<ul>',
    ...menu,
    '</ul>',
    '</nav>',
    '</div>',
    '</header>',
    '<main id="main">',
    ...main,
    '</main>',
    ...contact,
    '<footer>',
    '<div class="wrap">',
    '<div class="chooser" id="lang-chooser" role="group" aria-labelledby="lang-label" hidden>',
    `<label id="lang-label" for="lang-select">${rich(content.languagesLabel)}</label>`,
    '<select id="lang-select" autocomplete="off">',
    ...options,
    '</select>',
    `<button class="btn" id="lang-change" type="button">${label(content.footer.change)}</button>`,
    '</div>',
    // The list of language links is ordinary markup, shown under its label: a browser that runs no script, or did
    // not get site.js, changes the language with it. site.js hides it and shows the chooser above instead.
    '<nav class="langs" id="lang-list" aria-labelledby="lang-list-label">',
    `<p id="lang-list-label">${rich(content.footer.languagesLabel)}</p>`,
    '<ul>',
    ...languageLinks,
    '</ul>',
    '</nav>',
    `<p class="copy"><bdi dir="ltr">© ${siteSettings.copyrightYear} ${brand}.</bdi> ${rich(content.footer.rights)}</p>`,
    '</div>',
    '</footer>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// Build, check, write
// ---------------------------------------------------------------------------------------------

/**
 * Builds the whole site in memory. Every path is relative to the top of the site (the folder about/ of a tree):
 *   pages         'index.html', 'he/terms/index.html', ... -> HTML (140)
 *   files         'site.css', 'site.js', 'files/downloads.json' (the list of the installers, for the hosted server:
 *                 IMAGE_LIST_FILE) -> their text
 *   assets        'img/he/phone-home.png', 'files/<installer>', ... -> the file to copy
 *   downloads     the rows of site/downloads.json by platform
 *   siteBase      the public address of the top of the site
 *   untranslated  content files and legal sources that still carry the TODO-TRANSLATE marker
 *   behind        legal translations whose outline is not the English one (legalOutlineGap), with the first gap:
 *                 'legal/privacy/privacy-he.md ("3. How we use your data": 3 list items, English 4)'
 *   unset         placeholders of legal/settings.json values that are still null
 * Throws ONE error that lists every problem found (a key, placeholder or link that differs from English, a
 * missing or wrong-sized image, a missing or changed installer, a bad setting, a page over the budget); nothing
 * is written here.
 */
export function buildSite({ root = ROOT, settings, siteSettings, siteUrl } = {}) {
  const problems = [];
  const attempt = (read) => {
    try {
      return read();
    } catch (e) {
      problems.push(e.message);
      return null;
    }
  };
  const legal = settings ?? attempt(() => readSettings(root));
  const store = siteSettings ?? attempt(() => readSiteSettings(root));
  const origin = siteUrl ?? attempt(() => readSiteUrl(root));
  const theme = attempt(() => readThemeTokens(root));
  const downloads = attempt(() => readDownloads(root));
  const script = attempt(() => {
    try {
      return readFileSync(path.join(root, SCRIPT_FILE), 'utf8').replace(/\r\n/g, '\n');
    } catch (e) {
      throw new Error(`${slash(SCRIPT_FILE)}: cannot read it (${e.message})`);
    }
  });
  if (script !== null) for (const problem of scriptProblems(script)) problems.push(`${slash(SCRIPT_FILE)}: ${problem} (the script makes no network call, keeps nothing and names no address)`);

  // The texts: English first (the base), then every other locale against it.
  const contents = new Map();
  const untranslated = [];
  let english = null;
  for (const l of [...LOCALES].sort((a, b) => Number(b.code === DEFAULT_LOCALE) - Number(a.code === DEFAULT_LOCALE))) {
    const file = contentFile(root, l.code);
    const name = slash(path.relative(root, file));
    if (!existsSync(file)) {
      problems.push(`${name} is missing`);
      continue;
    }
    const raw = readFileSync(file, 'utf8');
    const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw; // a byte order mark is not part of the JSON
    let content;
    try {
      content = JSON.parse(text);
    } catch (e) {
      problems.push(`${name}: not valid JSON (${e.message})`);
      continue;
    }
    const isBase = l.code === DEFAULT_LOCALE;
    if (!isBase && !english) continue; // the English file is broken: its own problems are enough
    const found = contentProblems(content, isBase ? null : english);
    for (const problem of found) problems.push(`${name}: ${problem}`);
    if (isBase && !found.length) english = content;
    if (text.includes(UNTRANSLATED_MARKER)) untranslated.push(name);
    if (!found.length) contents.set(l.code, content);
  }

  // The two legal documents of every locale.
  const sources = new Map();
  for (const kind of LEGAL_KINDS) {
    for (const l of LOCALES) {
      const file = legalSourceFile(root, kind, l.code);
      const name = slash(path.relative(root, file));
      if (!existsSync(file)) {
        problems.push(`${name} is missing`);
        continue;
      }
      const source = readFileSync(file, 'utf8');
      sources.set(`${kind}/${l.code}`, source);
      if (source.includes(UNTRANSLATED_MARKER)) untranslated.push(name);
    }
  }
  // A translation without a heading or a list item that the English document has waits for that part.
  const behind = [];
  for (const kind of LEGAL_KINDS) {
    const base = sources.get(`${kind}/${DEFAULT_LOCALE}`);
    for (const l of LOCALES) {
      const source = sources.get(`${kind}/${l.code}`);
      const gap = base === undefined || source === undefined || l.code === DEFAULT_LOCALE ? null : legalOutlineGap(source, base);
      if (gap) behind.push(`${slash(path.relative(root, legalSourceFile(root, kind, l.code)))} (${gap})`);
    }
  }

  // The images: every source exists and has the stated size. The installers: there, with the listed size and SHA-256.
  const assets = new Map();
  for (const l of LOCALES) {
    if (!PLAY_FOLDER[l.code]) problems.push(`no Play screenshot folder is known for the locale ${l.code}`);
    if (!STORE_FOLDER[l.code]) problems.push(`no Store screenshot folder is known for the locale ${l.code}`);
    if (!PLAY_FOLDER[l.code] || !STORE_FOLDER[l.code]) continue;
    for (const shot of shotsOf(l.code)) {
      const problem = imageProblem(root, shot);
      if (problem) problems.push(problem);
      else assets.set(shot.rel, path.join(root, shot.source));
    }
  }
  const shareProblem = imageProblem(root, SHARE_IMAGE);
  if (shareProblem) problems.push(shareProblem);
  else assets.set(SHARE_IMAGE.rel, path.join(root, SHARE_IMAGE.source));
  const iconTrouble = iconProblem(root);
  if (iconTrouble) problems.push(iconTrouble);
  else assets.set(ICON_IMAGE.rel, path.join(root, ICON_IMAGE.source));
  if (downloads) {
    for (const platform of PLATFORMS) {
      for (const row of downloads[platform]) {
        const problem = downloadFileProblem(path.join(root, DOWNLOADS_DIR), row);
        if (problem) problems.push(`${problem} - put the file there again with scripts/site/add-download.mjs (--replace)`);
        else assets.set(`${FILES_DIR}/${row.file}`, path.join(root, DOWNLOADS_DIR, row.file));
      }
    }
  }

  const pages = new Map();
  const files = new Map();
  if (!problems.length) {
    const css = siteCss(theme);
    for (const [name, text, limit] of [[CSS_NAME, css, MAX_CSS_BYTES], [SCRIPT_NAME, script, MAX_SCRIPT_BYTES]]) {
      const bytes = Buffer.byteLength(text, 'utf8');
      if (bytes > limit) problems.push(`${name} is ${bytes} bytes, over the budget of ${limit}`);
      files.set(name, text);
    }
    // The list the Downloads pages are built from, next to the installers: the hosted server merges it with the files
    // the owner uploads (server/src/hosted/downloads.ts). It never serves this file itself.
    files.set(IMAGE_LIST_FILE, formatDownloads(downloads));
    for (const l of LOCALES) {
      for (const page of SITE_PAGES) {
        const rel = pageFile(page.id, l.code);
        let html;
        try {
          html = renderSitePage({ page: page.id, locale: l.code, content: contents.get(l.code), settings: legal, siteSettings: store, siteUrl: origin, downloads, source: page.legal ? sources.get(`${page.legal}/${l.code}`) : undefined });
        } catch (e) {
          problems.push(`${rel}: ${e.message}`);
          continue;
        }
        const bytes = Buffer.byteLength(html, 'utf8');
        const limit = page.legal ? MAX_LEGAL_PAGE_BYTES : MAX_PAGE_BYTES;
        if (bytes > limit) problems.push(`${rel} is ${bytes} bytes, over the budget of ${limit}`);
        pages.set(rel, html);
      }
    }
  }
  if (problems.length) {
    const error = new Error(problems.join('\n  '));
    error.problems = problems;
    throw error;
  }
  return { pages, files, assets, downloads, siteBase: siteBaseOf(store, origin), untranslated: untranslated.sort(), behind: behind.sort(), unset: unsetSettings(legal) };
}

/** Why `target` (a folder named about) may not be replaced, or null: only a missing, empty or earlier-built folder may. */
function outputProblem(target) {
  let stat;
  try {
    stat = lstatSync(target);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
  if (!stat.isDirectory()) return `${target} exists and is not a folder`;
  if (readdirSync(target).length === 0) return null;
  const index = path.join(target, 'index.html');
  if (existsSync(index) && readFileSync(index, 'utf8').includes(GENERATOR_TAG)) return null;
  return `${target} is not empty and was not written by this script - refusing to replace it; choose another folder`;
}

/**
 * Writes a built site under `webRoot` (the folder a server serves as "/"): webRoot/about/**. An earlier output
 * there is replaced; any other non-empty about/ is refused. Returns the folder written.
 */
export function writeSite(site, webRoot) {
  const target = path.join(webRoot, SITE_ID);
  const problem = outputProblem(target);
  if (problem) throw new Error(problem);
  rmSync(target, { recursive: true, force: true });
  const place = (rel) => {
    const full = path.join(target, ...rel.split('/'));
    mkdirSync(path.dirname(full), { recursive: true });
    return full;
  };
  for (const [rel, text] of [...site.pages, ...site.files]) writeFileSync(place(rel), text, 'utf8');
  for (const [rel, source] of site.assets) copyFileSync(source, place(rel));
  return target;
}

/**
 * What is wrong with a built site in `folder` (empty when it is complete), wherever the folder stands and
 * whatever it is called: the 140 pages are there, every relative address in them leads to a file of the folder
 * (a page, the style sheet, the script, an image, an installer), nothing in them needs the folder to be called
 * about, every installer has the size and the SHA-256 its row of the Downloads page states, and files/downloads.json
 * (the list the hosted server reads) lists exactly the rows of the download tables.
 */
export function siteFolderProblems(folder) {
  const problems = [];
  const expected = LOCALES.flatMap((l) => SITE_PAGES.map((page) => pageFile(page.id, l.code)));
  /** The files the pages refer to: file -> the first page that does. */
  const wanted = new Map();
  /** The rows of the download tables: file name -> its row. */
  const rows = new Map();
  for (const rel of expected) {
    const file = path.join(folder, ...rel.split('/'));
    if (!existsSync(file)) {
      problems.push(`${rel} is missing`);
      continue;
    }
    const html = readFileSync(file, 'utf8');
    if (!html.includes(GENERATOR_TAG)) problems.push(`${rel} was not written by scripts/site/build-site.mjs`);
    const dir = rel.slice(0, -'index.html'.length);
    for (const m of html.matchAll(/\s(?:href|src|action)="([^"]*)"/g)) {
      const address = m[1].replace(/&amp;/g, '&');
      // Absolute by design: canonical, hreflang, the web app, the documents outside the site, a store, the form's action.
      if (/^(?:https:\/\/|mailto:|#)/.test(address) || address === CONTACT_ACTION) continue;
      if (!/^\.\.?\//.test(address)) {
        problems.push(`${rel}: the address ${address} is not relative (it would break when the site moves)`);
        continue;
      }
      const place = path.posix.normalize(`${dir}${address.replace(/[#?].*$/, '')}`);
      if (place.startsWith('..')) {
        problems.push(`${rel}: the address ${address} leaves the site`);
        continue;
      }
      const target = place === '.' || place === './' ? 'index.html' : place.endsWith('/') ? `${place}index.html` : place;
      if (!wanted.has(target)) wanted.set(target, rel);
    }
    for (const m of html.matchAll(/<tr data-file="([^"]+)" data-bytes="(\d+)" data-sha256="([0-9a-f]{64})">/g)) rows.set(m[1], { file: m[1], bytes: Number(m[2]), sha256: m[3] });
  }
  for (const [rel, from] of [...wanted].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (!expected.includes(rel) && !existsSync(path.join(folder, ...rel.split('/')))) problems.push(`${rel} is missing (${from} refers to it)`);
  }
  // A missing installer is already named above (its row links to it); here: one that is there but is another file.
  for (const row of [...rows.values()].sort((a, b) => (a.file < b.file ? -1 : 1))) {
    if (!existsSync(path.join(folder, FILES_DIR, row.file))) continue;
    const problem = downloadFileProblem(path.join(folder, FILES_DIR), row, FILES_DIR, 'the Downloads page');
    if (problem) problems.push(problem);
  }
  // The list of the installers, which the hosted server merges with the files the owner uploads: there, valid, and
  // exactly the rows of the tables - the server shows and serves an installer of the image only when it is listed.
  const listFile = path.join(folder, ...IMAGE_LIST_FILE.split('/'));
  if (!existsSync(listFile)) problems.push(`${IMAGE_LIST_FILE} is missing (the hosted server reads the list of the installers from it)`);
  else {
    let list = null;
    try {
      const raw = JSON.parse(readFileSync(listFile, 'utf8'));
      const found = downloadsProblems(raw);
      if (found.length) problems.push(`${IMAGE_LIST_FILE}: ${found.join('; ')}`);
      else list = cleanDownloads(raw);
    } catch (e) {
      problems.push(`${IMAGE_LIST_FILE}: cannot read it (${e.message})`);
    }
    if (list) {
      const key = (row) => `${row.file} ${row.bytes} ${row.sha256}`;
      const listed = PLATFORMS.flatMap((platform) => list[platform].map(key)).sort();
      const shown = [...rows.values()].map(key).sort();
      if (listed.join('\n') !== shown.join('\n')) problems.push(`${IMAGE_LIST_FILE} does not list exactly the files of the Downloads page`);
    }
  }
  return problems;
}

/**
 * The same for a tree with the site at <webRoot>/about/ (ui/ of a staged image; scripts/hosted/stage-image.mjs
 * runs this): the problems name their files from the web root (about/he/index.html is missing).
 */
export function siteTreeProblems(webRoot) {
  return siteFolderProblems(path.join(webRoot, SITE_ID)).map((problem) => `${SITE_ID}/${problem}`);
}

/** The command line. Returns the exit code; `root` and `log` are replaced by the tests. */
export function main(argv, { root = ROOT, log = console } = {}) {
  const outArg = argv.find((a) => a.startsWith('--out='));
  const unknown = argv.filter((a) => !['--check', '--strict'].includes(a) && !a.startsWith('--out='));
  const check = argv.includes('--check');
  const strict = argv.includes('--strict');
  if (unknown.length || (outArg !== undefined && (!outArg.slice('--out='.length) || check))) {
    log.error(
      unknown.length
        ? `build-site: unknown argument ${unknown[0]} (usage: node scripts/site/build-site.mjs [--out=<dir>] [--check] [--strict])`
        : check
          ? 'build-site: --check writes nothing - leave --out away'
          : 'build-site: --out needs a folder: --out=<dir>',
    );
    return 2;
  }
  let site;
  try {
    site = buildSite({ root });
  } catch (e) {
    log.error(`build-site: the site cannot be built:\n  ${e.message}`);
    return 1;
  }
  let failed = false;
  const report = (msg) => {
    if (strict) {
      log.error(`build-site: ${msg}`);
      failed = true;
    } else {
      log.warn(`build-site: warning - ${msg}`);
    }
  };
  if (site.unset.length) report(`not set yet in legal/settings.json: ${site.unset.map((p) => `{{${p}}}`).join(', ')} - the pages show the placeholder until the owner fills it`);
  if (site.untranslated.length) {
    report(`${site.untranslated.length} file(s) still marked ${UNTRANSLATED_MARKER} (English texts waiting for their translation): ${site.untranslated.join(', ')}`);
  }
  if (site.behind.length) {
    report(`${site.behind.length} legal translation(s) behind the English document (translate what was added to it): ${site.behind.join(', ')}`);
  }
  const installers = PLATFORMS.reduce((sum, platform) => sum + site.downloads[platform].length, 0);
  const summary = `${site.pages.size} pages (${LOCALES.length} locales), ${site.assets.size - installers} images and ${installers} installer files`;
  if (check) {
    log.log(`build-site: ${summary} check out; nothing written`);
    return failed ? 1 : 0;
  }
  if (failed) return 1;
  const webRoot = outArg ? path.resolve(outArg.slice('--out='.length)) : path.join(root, DEFAULT_OUT_DIR);
  let target;
  try {
    target = writeSite(site, webRoot);
  } catch (e) {
    log.error(`build-site: ${e.message}`);
    return 1;
  }
  log.log(`build-site: wrote ${summary} to ${target}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
