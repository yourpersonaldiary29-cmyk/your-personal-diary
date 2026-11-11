#!/usr/bin/env node
/**
 * scripts/legal/build-pages.mjs - the privacy policy, the account-deletion page, the support page and the Terms of
 * Use of Your Personal Diary (docs/play-tasks/PLAY-LEGAL.md; the support page: docs/apple-tasks/LEGAL.md; the terms:
 * docs/apple-tasks/TERMS.md), from the Markdown sources in legal/ to self-contained HTML pages in public/.
 * Vite copies public/ into dist/ ("npx vite build"), and the hosted server serves dist/ as static files
 * (server/src/app.ts: express.static before the SPA fallback), so the pages are reachable at
 *   <server>/privacy/              English (the default) with links to the 19 other languages
 *   <server>/privacy/<locale>/     one page per app language (en included), each linking back to English
 *   <server>/delete-account/       the same for the Play "data deletion" web resource
 *   <server>/support/              the same for the App Store "Support URL" (contact details, frequent questions)
 *   <server>/terms/                the same for the Terms of Use (confirmed together with the policy at registration)
 * without any server change. A text change is one edit of a legal/ source plus one run of this script.
 *
 * Sources: legal/<kind>/<kind>-<locale>.md (kinds: privacy, delete-account, support, terms) for the 20 app locales
 * (shared/i18n/locales.ts). Each starts with a front-matter block (title, description, languages = the label of
 * the language list, otherPage = the link text of the page the footer leads to: privacy <-> delete-account,
 * support -> privacy, terms -> privacy) followed by Markdown: # / ## / ### headings, paragraphs, "- " and "1. " lists, **bold**,
 * `code` and [text](url) links.
 *
 * The ONE place for the values the owner fills: legal/settings.json
 *   { "publisherName": null | "...", "contactEmail": null | "...", "effectiveDate": "YYYY-MM-DD",
 *     "termsEffectiveDate": "YYYY-MM-DD", "minimumAge": 16 }
 * (effectiveDate = the privacy policy's, termsEffectiveDate = the Terms of Use's; shared/legal.ts exports both as
 * the versions the hosted server records at registration.)
 * Placeholders in the sources: {{PUBLISHER_NAME}} {{CONTACT_EMAIL}} {{EFFECTIVE_DATE}} {{TERMS_EFFECTIVE_DATE}}
 * {{MINIMUM_AGE}} and the computed {{SITE_URL}} (the fixed server of src/config/server-default.json), {{PRIVACY_URL}} /
 * {{DELETE_URL}} / {{SUPPORT_URL}} / {{TERMS_URL}} (the same-language page of each document). A setting that is still null leaves its {{PLACEHOLDER}} visible
 * in the pages on purpose: scripts/play/preflight.mjs refuses to go on while one is left.
 *
 * The pages: no script (the server's CSP is script-src 'self'), no external resource (inline CSS only, system
 * fonts), RTL for he and ar, readable on a phone, light and dark. The only absolute URLs in them are those of
 * the fixed server (the Android bundle carries public/ too, and its test allows no other host).
 *
 * A source that still contains the marker TODO-TRANSLATE is an English placeholder waiting for its translation
 * (when a page is new, the base writer leaves one per locale so that the build and the structure tests work
 * while the translators are at it; a translator replaces the whole file). --strict refuses to go on while one
 * is left, exactly as it does for an unset setting; without --strict it is a warning.
 *
 * Usage:
 *   node scripts/legal/build-pages.mjs            write public/privacy/**, public/delete-account/**, public/support/**
 *                                                 and public/terms/**
 *   node scripts/legal/build-pages.mjs --check    exit 1 when public/ is not what the sources produce
 *   node scripts/legal/build-pages.mjs --strict   also exit 1 while a setting is unset or a source is still
 *                                                 marked TODO-TRANSLATE (use before publishing)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');
export const SETTINGS_FILE = path.join('legal', 'settings.json');
export const SERVER_DEFAULT_FILE = path.join('src', 'config', 'server-default.json');
export const BRAND = 'Your Personal Diary';

/** The 20 app locales in the order of shared/i18n/locales.ts (a test keeps them equal). */
export const LOCALES = [
  { code: 'en', name: 'English', dir: 'ltr', intl: 'en-GB' },
  { code: 'he', name: 'עברית', dir: 'rtl', intl: 'he-IL' },
  { code: 'ar', name: 'العربية', dir: 'rtl', intl: 'ar' },
  { code: 'zh', name: '中文', dir: 'ltr', intl: 'zh-CN' },
  { code: 'ja', name: '日本語', dir: 'ltr', intl: 'ja-JP' },
  { code: 'hi', name: 'हिन्दी', dir: 'ltr', intl: 'hi-IN' },
  { code: 'th', name: 'ไทย', dir: 'ltr', intl: 'th-TH' },
  { code: 'es', name: 'Español', dir: 'ltr', intl: 'es-ES' },
  { code: 'pt', name: 'Português', dir: 'ltr', intl: 'pt-PT' },
  { code: 'fr', name: 'Français', dir: 'ltr', intl: 'fr-FR' },
  { code: 'it', name: 'Italiano', dir: 'ltr', intl: 'it-IT' },
  { code: 'de', name: 'Deutsch', dir: 'ltr', intl: 'de-DE' },
  { code: 'ro', name: 'Română', dir: 'ltr', intl: 'ro-RO' },
  { code: 'el', name: 'Ελληνικά', dir: 'ltr', intl: 'el-GR' },
  { code: 'pl', name: 'Polski', dir: 'ltr', intl: 'pl-PL' },
  { code: 'cs', name: 'Čeština', dir: 'ltr', intl: 'cs-CZ' },
  { code: 'hu', name: 'Magyar', dir: 'ltr', intl: 'hu-HU' },
  { code: 'ru', name: 'Русский', dir: 'ltr', intl: 'ru-RU' },
  { code: 'bg', name: 'Български', dir: 'ltr', intl: 'bg-BG' },
  { code: 'tr', name: 'Türkçe', dir: 'ltr', intl: 'tr-TR' },
];
export const DEFAULT_LOCALE = 'en';

/**
 * The four documents: id = the URL path segment and the folder under public/; footer = the id of the page the
 * footer link (front matter "otherPage") leads to. The other links are in the bodies: the policy links the Terms of
 * Use (section 2, {{TERMS_URL}}); the support page links the deletion page and the Terms of Use (section 3); the
 * Terms of Use link the policy, the deletion page and the support page.
 */
export const PAGES = [
  { id: 'privacy', sourceDir: path.join('legal', 'privacy'), prefix: 'privacy', footer: 'delete-account' },
  { id: 'delete-account', sourceDir: path.join('legal', 'delete-account'), prefix: 'delete-account', footer: 'privacy' },
  { id: 'support', sourceDir: path.join('legal', 'support'), prefix: 'support', footer: 'privacy' },
  { id: 'terms', sourceDir: path.join('legal', 'terms'), prefix: 'terms', footer: 'privacy' },
];

/** Placeholders filled from legal/settings.json (null = not set yet: the placeholder stays visible). */
export const SETTING_PLACEHOLDERS = { PUBLISHER_NAME: 'publisherName', CONTACT_EMAIL: 'contactEmail' };
/** Every placeholder a source may use. */
export const PLACEHOLDERS = ['PUBLISHER_NAME', 'CONTACT_EMAIL', 'EFFECTIVE_DATE', 'TERMS_EFFECTIVE_DATE', 'MINIMUM_AGE', 'SITE_URL', 'PRIVACY_URL', 'DELETE_URL', 'SUPPORT_URL', 'TERMS_URL'];
const PLACEHOLDER_RE = /\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/g;
const FRONT_MATTER_KEYS = ['title', 'description', 'languages', 'otherPage'];

// ---------------------------------------------------------------------------------------------
// Settings and the server address
// ---------------------------------------------------------------------------------------------

/** Reads and validates legal/settings.json. Throws with a plain reason. */
export function readSettings(root = ROOT, file = path.join(root, SETTINGS_FILE)) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${path.relative(root, file)}: cannot read it (${e.message})`);
  }
  const problems = settingsProblems(raw);
  if (problems.length) throw new Error(`${path.relative(root, file)}: ${problems.join('; ')}`);
  return {
    publisherName: raw.publisherName === null ? null : String(raw.publisherName).trim(),
    contactEmail: raw.contactEmail === null ? null : String(raw.contactEmail).trim(),
    effectiveDate: raw.effectiveDate,
    termsEffectiveDate: raw.termsEffectiveDate,
    minimumAge: raw.minimumAge,
  };
}

/** The keys of legal/settings.json (all required). */
export const SETTING_KEYS = ['publisherName', 'contactEmail', 'effectiveDate', 'termsEffectiveDate', 'minimumAge'];

/** What is wrong with a settings object (empty when it is valid; null values are valid = not set yet). */
export function settingsProblems(raw) {
  const problems = [];
  if (!raw || typeof raw !== 'object') return ['not a JSON object'];
  for (const key of SETTING_KEYS) {
    if (!(key in raw)) problems.push(`"${key}" is missing`);
  }
  for (const key of Object.keys(raw)) {
    if (!SETTING_KEYS.includes(key)) problems.push(`unknown key "${key}"`);
  }
  if (raw.publisherName !== null && raw.publisherName !== undefined) {
    if (typeof raw.publisherName !== 'string' || !raw.publisherName.trim()) problems.push('"publisherName" must be null (not set yet) or a name');
    else if (/[{}<>]/.test(raw.publisherName)) problems.push('"publisherName" may not contain { } < >');
  }
  if (raw.contactEmail !== null && raw.contactEmail !== undefined) {
    if (typeof raw.contactEmail !== 'string' || !/^[^\s@<>"{}]+@[^\s@<>"{}]+\.[^\s@<>"{}]+$/.test(raw.contactEmail.trim())) {
      problems.push('"contactEmail" must be null (not set yet) or an e-mail address');
    }
  }
  for (const key of ['effectiveDate', 'termsEffectiveDate']) {
    if (raw[key] === undefined) continue;
    const ok = typeof raw[key] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw[key]) && !Number.isNaN(Date.parse(`${raw[key]}T00:00:00Z`));
    if (!ok) problems.push(`"${key}" must look like 2026-10-26`);
  }
  if (raw.minimumAge !== undefined && !(Number.isInteger(raw.minimumAge) && raw.minimumAge >= 13 && raw.minimumAge <= 18)) {
    problems.push('"minimumAge" must be a whole number from 13 to 18');
  }
  return problems;
}

/** The names of the settings that are still null (the owner fills them before publishing). */
export function unsetSettings(settings) {
  return Object.entries(SETTING_PLACEHOLDERS)
    .filter(([, key]) => settings[key] === null)
    .map(([placeholder]) => placeholder);
}

/** The origin of the fixed diary server (src/config/server-default.json), without a trailing slash. */
export function readSiteUrl(root = ROOT) {
  const raw = JSON.parse(readFileSync(path.join(root, SERVER_DEFAULT_FILE), 'utf8'));
  const url = new URL(String(raw.url));
  if (url.protocol !== 'https:' || !['', '/'].includes(url.pathname) || url.search || url.hash) {
    throw new Error(`${SERVER_DEFAULT_FILE}: "url" must be https://<host>`);
  }
  return url.origin;
}

// ---------------------------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------------------------

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Splits a source into its front matter (key: value lines between --- lines) and the Markdown body. */
export function parseSource(text, name = 'source') {
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n/.exec(src);
  if (!m) throw new Error(`${name}: missing the front-matter block (--- title / description / languages / otherPage ---)`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    if (!line.trim()) continue;
    const colon = line.indexOf(':');
    if (colon < 0) throw new Error(`${name}: front-matter line without "key:": ${line}`);
    meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  for (const key of FRONT_MATTER_KEYS) if (!meta[key]) throw new Error(`${name}: front matter needs "${key}"`);
  return { meta, body: src.slice(m[0].length) };
}

/** Inline Markdown of one (already joined) text: escaped, then `code`, **bold** and [text](url). */
export function inline(text) {
  const parts = text.split(/(`[^`]+`)/);
  return parts
    .map((part) => {
      if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) return `<code dir="ltr">${escapeHtml(part.slice(1, -1))}</code>`;
      return escapeHtml(part)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_all, label, href) => {
          // Addresses and e-mail links read left to right inside Hebrew and Arabic text - but a link whose text is
          // Hebrew or Arabic words (the policy's "Terms of Use" link) keeps the direction of its paragraph.
          const ltr = /^(?:mailto:|https?:|\{\{)/.test(href) && !/[֐-ࣿיִ-﷿ﹰ-﻿]/.test(label) ? ' dir="ltr"' : '';
          return `<a href="${href}"${ltr}>${label}</a>`;
        });
    })
    .join('');
}

/** Block Markdown -> HTML: headings, paragraphs, "- " and "1. " lists (an indented line continues an item). */
export function markdownToHtml(md) {
  const out = [];
  let para = [];
  let list = null; // { tag, items: string[][] }
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((item) => `<li>${inline(item.join(' '))}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (const raw of md.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      continue;
    }
    const bullet = /^- (.*)$/.exec(line);
    const numbered = /^\d+\. (.*)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push([(bullet ?? numbered)[1]]);
      continue;
    }
    if (list && /^\s+\S/.test(raw)) {
      list.items[list.items.length - 1].push(line.trim());
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return out.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------------------------

/** The site-relative path of a page in a locale: English is the page itself, the others a sub-folder. */
export function pagePath(pageId, locale) {
  return locale === DEFAULT_LOCALE ? `/${pageId}/` : `/${pageId}/${locale}/`;
}

function localeOf(code) {
  const def = LOCALES.find((l) => l.code === code);
  if (!def) throw new Error(`unknown locale ${code}`);
  return def;
}

/** The effective date written out in the page's language. */
export function dateInWords(iso, intl) {
  return new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
}

/** Fills the placeholders of a rendered page; unknown names throw, unset settings stay as {{NAME}}. */
export function fillPlaceholders(html, values, name = 'page') {
  return html.replace(PLACEHOLDER_RE, (whole, key) => {
    if (!PLACEHOLDERS.includes(key)) throw new Error(`${name}: unknown placeholder {{${key}}}`);
    const value = values[key];
    return value === null || value === undefined ? `{{${key}}}` : escapeHtml(value);
  });
}

const STYLE = `
:root{--bg:#fbfaf7;--fg:#1f2328;--muted:#5b6169;--line:#d9d6cf;--accent:#2f5d8a;--card:#ffffff}
@media (prefers-color-scheme:dark){:root{--bg:#16181c;--fg:#e8e6e1;--muted:#a3a7ad;--line:#33373d;--accent:#8db8e3;--card:#1d2025}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans","Noto Sans Hebrew","Noto Sans Arabic","Noto Sans Devanagari","Noto Sans Thai","Noto Sans CJK SC","Microsoft YaHei","Yu Gothic",Arial,sans-serif;overflow-wrap:anywhere}
.wrap{max-width:46rem;margin:0 auto;padding:16px}
header{border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:8px}
.brand{font-weight:700;margin:0 0 8px}
.langs{display:flex;flex-wrap:wrap;gap:4px 14px;margin:0;padding:0;list-style:none;font-size:.9rem}
.langs a{color:var(--accent)}
.langs a[aria-current]{color:var(--fg);font-weight:700;text-decoration:none}
h1{font-size:1.6rem;line-height:1.3;margin:20px 0 8px}
h2{font-size:1.2rem;line-height:1.35;margin:28px 0 6px}
h3{font-size:1.05rem;margin:20px 0 4px}
p,ul,ol{margin:8px 0}
ul,ol{padding-inline-start:1.4rem}
li{margin:4px 0}
a{color:var(--accent)}
code{font-family:ui-monospace,Consolas,monospace;font-size:.92em;background:var(--card);border:1px solid var(--line);border-radius:4px;padding:0 3px}
footer{border-top:1px solid var(--line);margin-top:32px;padding-top:12px;font-size:.9rem;color:var(--muted)}
footer a{margin-inline-end:14px}
`
  .trim()
  .replace(/\n/g, '');

/**
 * One complete page in one locale. The English page is written twice - at /<page>/ (the default address) and
 * at /<page>/en/ - with the same text; both name /<page>/ as canonical.
 */
export function renderPage({ page, locale, source, settings, siteUrl }) {
  const def = localeOf(locale);
  const other = PAGES.find((p) => p.id === page.footer);
  if (!other) throw new Error(`${page.id}: the footer page "${page.footer}" is not one of the documents`);
  const { meta, body } = parseSource(source, `${page.prefix}-${locale}.md`);
  const langLinks = LOCALES.map((l) => {
    const current = l.code === locale ? ' aria-current="page"' : '';
    const dir = l.dir === 'rtl' ? ' dir="rtl"' : '';
    return `<li><a href="${pagePath(page.id, l.code)}" hreflang="${l.code}" lang="${l.code}"${dir}${current}>${escapeHtml(l.name)}</a></li>`;
  }).join('');
  const alternates = [
    ...LOCALES.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${siteUrl}${pagePath(page.id, l.code)}">`),
    `<link rel="alternate" hreflang="x-default" href="${siteUrl}${pagePath(page.id, DEFAULT_LOCALE)}">`,
  ].join('\n');
  const values = {
    PUBLISHER_NAME: settings.publisherName,
    CONTACT_EMAIL: settings.contactEmail,
    EFFECTIVE_DATE: dateInWords(settings.effectiveDate, def.intl),
    TERMS_EFFECTIVE_DATE: dateInWords(settings.termsEffectiveDate, def.intl),
    MINIMUM_AGE: new Intl.NumberFormat(def.intl, { useGrouping: false }).format(settings.minimumAge),
    SITE_URL: siteUrl,
    PRIVACY_URL: `${siteUrl}${pagePath('privacy', locale)}`,
    DELETE_URL: `${siteUrl}${pagePath('delete-account', locale)}`,
    SUPPORT_URL: `${siteUrl}${pagePath('support', locale)}`,
    TERMS_URL: `${siteUrl}${pagePath('terms', locale)}`,
  };
  const englishLink = locale === DEFAULT_LOCALE ? '' : `<a href="${pagePath(page.id, DEFAULT_LOCALE)}" hreflang="en" lang="en" dir="ltr">English</a>`;
  const html = [
    '<!doctype html>',
    `<html lang="${def.code}" dir="${def.dir}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}">`,
    '<meta name="color-scheme" content="light dark">',
    `<link rel="canonical" href="${siteUrl}${pagePath(page.id, locale)}">`,
    alternates,
    `<style>${STYLE}</style>`,
    '</head>',
    '<body>',
    '<div class="wrap">',
    '<header>',
    `<p class="brand" lang="en" dir="ltr">${BRAND}</p>`,
    `<nav aria-label="${escapeHtml(meta.languages)}"><ul class="langs">${langLinks}</ul></nav>`,
    '</header>',
    '<main>',
    markdownToHtml(body),
    '</main>',
    '<footer>',
    `<a href="${pagePath(other.id, locale)}">${escapeHtml(meta.otherPage)}</a>${englishLink}`,
    '</footer>',
    '</div>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
  return fillPlaceholders(html, values, `${page.prefix}-${locale}.md`);
}

/** The source file of a page in a locale. */
export function sourceFile(root, page, locale) {
  return path.join(root, page.sourceDir, `${page.prefix}-${locale}.md`);
}

/**
 * Every page under public/: a map of public-relative path (forward slashes) -> HTML.
 * Throws when a source is missing or broken.
 */
export function buildAll({ root = ROOT, settings = readSettings(root), siteUrl = readSiteUrl(root) } = {}) {
  const files = new Map();
  const missing = [];
  for (const page of PAGES) {
    for (const l of LOCALES) {
      const file = sourceFile(root, page, l.code);
      if (!existsSync(file)) {
        missing.push(path.relative(root, file).split(path.sep).join('/'));
        continue;
      }
      const source = readFileSync(file, 'utf8');
      files.set(`${page.id}/${l.code}/index.html`, renderPage({ page, locale: l.code, source, settings, siteUrl }));
      if (l.code === DEFAULT_LOCALE) files.set(`${page.id}/index.html`, renderPage({ page, locale: l.code, source, settings, siteUrl }));
    }
  }
  if (missing.length) throw new Error(`missing sources: ${missing.join(', ')}`);
  return files;
}

/** Files under public/<page>/ on disk (public-relative, forward slashes). */
export function existingPages(root = ROOT) {
  const found = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else found.push(path.relative(path.join(root, 'public'), full).split(path.sep).join('/'));
    }
  };
  for (const page of PAGES) walk(path.join(root, 'public', page.id));
  return found.sort();
}

/** The marker of an English placeholder source that still waits for its translation (see the header). */
export const UNTRANSLATED_MARKER = 'TODO-TRANSLATE';

/** Sources (project-relative, forward slashes) that still carry the marker; empty when every page is translated. */
export function untranslatedSources(root = ROOT) {
  const found = [];
  for (const page of PAGES) {
    for (const l of LOCALES) {
      const file = sourceFile(root, page, l.code);
      if (existsSync(file) && readFileSync(file, 'utf8').includes(UNTRANSLATED_MARKER)) {
        found.push(path.relative(root, file).split(path.sep).join('/'));
      }
    }
  }
  return found;
}

/** Differences between what the sources give and public/ on disk (empty = in sync). */
export function diffWithDisk(files, root = ROOT) {
  const problems = [];
  for (const [rel, html] of files) {
    const full = path.join(root, 'public', rel);
    if (!existsSync(full)) problems.push(`public/${rel} is missing`);
    else if (readFileSync(full, 'utf8') !== html) problems.push(`public/${rel} is out of date`);
  }
  for (const rel of existingPages(root)) if (!files.has(rel)) problems.push(`public/${rel} is not produced by any source`);
  return problems;
}

/** Writes the pages (and removes stale files under public/<page>/ of every document). */
export function writeAll(files, root = ROOT) {
  for (const rel of existingPages(root)) if (!files.has(rel)) rmSync(path.join(root, 'public', rel), { force: true });
  for (const [rel, html] of files) {
    const full = path.join(root, 'public', rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, html, 'utf8');
  }
}

function main(argv) {
  const check = argv.includes('--check');
  const strict = argv.includes('--strict');
  let settings;
  let files;
  try {
    settings = readSettings();
    files = buildAll({ settings });
  } catch (e) {
    console.error(`build-pages: ${e.message}`);
    return 1;
  }
  const unset = unsetSettings(settings);
  if (unset.length) {
    const msg = `not set yet in ${SETTINGS_FILE.split(path.sep).join('/')}: ${unset.map((p) => `{{${p}}}`).join(', ')} - the pages show the placeholder until the owner fills it`;
    if (strict) {
      console.error(`build-pages: ${msg}`);
      return 1;
    }
    console.warn(`build-pages: warning - ${msg}`);
  }
  // Placeholder sources are reported but still built, so that the tree stays consistent while the translators work.
  let failed = false;
  const untranslated = untranslatedSources();
  if (untranslated.length) {
    const msg = `${untranslated.length} source(s) still marked ${UNTRANSLATED_MARKER} (English placeholders waiting for their translation): ${untranslated.join(', ')}`;
    if (strict) {
      console.error(`build-pages: ${msg}`);
      failed = true;
    } else {
      console.warn(`build-pages: warning - ${msg}`);
    }
  }
  if (check) {
    const problems = diffWithDisk(files);
    if (problems.length) {
      console.error(`build-pages: public/ is not in sync with legal/ (run node scripts/legal/build-pages.mjs):\n  ${problems.join('\n  ')}`);
      return 1;
    }
    console.log(`build-pages: ${files.size} pages in public/ match the sources`);
    return failed ? 1 : 0;
  }
  writeAll(files);
  console.log(`build-pages: wrote ${files.size} pages (${PAGES.map((p) => `public/${p.id}/`).join(', ')}; ${LOCALES.length} locales each)`);
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
