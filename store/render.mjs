#!/usr/bin/env node
/**
 * store/render.mjs - fills the placeholders of the Store texts. Plain Node, no dependencies.
 *
 *   node store/render.mjs                 copy store/ -> store/out/ with the values of store/config.json
 *   node store/render.mjs --example       the same with store/config.example.json (a test run)
 *   node store/render.mjs --config <file> the same with another config file
 *   node store/render.mjs --sync-txt      (retired 2026-10-26: the privacy policy moved to legal/ and is served at
 *                                         <server>/privacy/ - see store/privacy-policy/README.md; the old local-only
 *                                         texts in privacy-policy/_obsolete-2026-10-03/ are never rendered)
 *   node store/render.mjs --check         run scripts/store/check-listing.mjs on store/listing/ (all 20 languages:
 *                                         limits, forbidden claims, placeholders, complete folders; exit code 1 on
 *                                         a problem); --check --only en-US,he-IL checks only those folders
 *   node store/render.mjs --guide         only write the owner's guide (docs/STORE-RELEASE.he.md) as a web page,
 *                                         store/out/STORE-RELEASE.he.html; needs no config (a full run writes it too)
 *
 * Placeholders: {{PUBLISHER_NAME}} {{CONTACT_EMAIL}} {{EFFECTIVE_DATE}} {{PRIVACY_POLICY_URL}}
 * Config (store/config.json, see store/config.example.json):
 *   { "publisherName": "...", "contactEmail": "...", "privacyPolicyUrl": "https://...", "effectiveDate": "YYYY-MM-DD" }
 *
 * What is copied: the texts that are pasted into Partner Center or published - listing/, privacy-policy/,
 * certification-notes.md, age-rating-answers.md and submission-checklist.md. Screenshots have no placeholders
 * (upload them straight from store/screenshots/), and MSIX-BUILD.md / identity files are not copied.
 * privacyPolicyUrl may stay empty until the policy is published (a warning is printed).
 * The effective date is written in words: English in the English files, Hebrew in he.html, privacy-he.txt
 * and listing/he-IL/. Values are HTML-escaped inside .html files. The run fails if a placeholder is left.
 *
 * Plain-text copies for the owner (Windows has no program for .md files; .txt opens in Notepad) are
 * written to store/out/txt/:
 *   certification-notes-A.txt   block A of certification-notes.md, ready to paste (Notes for certification)
 *   certification-notes-B.txt   block B, ready to paste (runFullTrust justification)
 *   age-rating-answers.txt      age-rating-answers.md without the Markdown markup
 *   submission-checklist.txt    submission-checklist.md without the Markdown markup
 *   screenshot-captions.txt     store/screenshots/README.md without the markup (only when that file exists)
 * and the owner's guide is written as store/out/STORE-RELEASE.he.html (double-click opens it in the browser).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkListing, formatReport } from '../scripts/store/check-listing.mjs';

const storeDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(storeDir, 'out');
const args = process.argv.slice(2);

const TEXT_EXT = new Set(['.txt', '.html', '.md']);
/** Top-level entries of store/ that are rendered; everything else belongs to other tools. */
const RENDERED = new Set(['listing', 'privacy-policy', 'certification-notes.md', 'age-rating-answers.md', 'submission-checklist.md']);

/**
 * The listing checks live in scripts/store/check-listing.mjs (limits from Microsoft's current pages, forbidden
 * claims in all 20 languages, placeholders, complete folders); --check and every render run it.
 */
export { FIELDS as LIMITS } from '../scripts/store/check-listing.mjs';

function fail(message) {
  console.error(`render: ${message}`);
  process.exit(1);
}

/** Length the way a person counts it: user-perceived characters, without the final line break. */
function textLength(text) {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(clean)].length;
}

function walk(dir, list = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (dir === storeDir && !RENDERED.has(name)) continue;
    // Superseded texts kept for history only (privacy-policy/_obsolete-2026-10-03/) are never rendered.
    if (name.startsWith('_obsolete')) continue;
    // Notes for the translators (store/listing/README.md) are not Store texts.
    if (name === 'README.md' && path.basename(dir) === 'listing') continue;
    if (statSync(full).isDirectory()) {
      walk(full, list);
    } else {
      list.push(full);
    }
  }
  return list;
}

// ---------------------------------------------------------------------------------------------
// --check : listing field lengths
// ---------------------------------------------------------------------------------------------
/**
 * Runs scripts/store/check-listing.mjs on <baseDir>/listing. `only`: the tags to check (null = all 20; a render
 * checks the folders that exist, so it works while translations are still being written).
 */
export function checkListings(baseDir = storeDir, only = null) {
  return checkListing(path.join(baseDir, 'listing'), { only });
}

// ---------------------------------------------------------------------------------------------
// --sync-txt : privacy-en.txt / privacy-he.txt from the HTML pages
// ---------------------------------------------------------------------------------------------
function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function htmlToText(html) {
  let body = html.replace(/^[\s\S]*<main>/, '').replace(/<\/main>[\s\S]*$/, '');
  body = body.replace(/<p class="lang">[\s\S]*?<\/p>/, '');
  const inline = (s) => decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  const out = [];
  const block = /<(h1|h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = block.exec(body))) {
    const text = inline(m[2]);
    if (!text) continue;
    if (m[1] === 'h1') out.push(text, '');
    else if (m[1] === 'h2') out.push('', '', text, '');
    else if (m[1] === 'h3') out.push('', text, '');
    else if (m[1] === 'li') out.push(`- ${text}`);
    else out.push(text, '');
  }
  return `${out.join('\n').replace(/\n{4,}/g, '\n\n\n').trim()}\n`;
}

function syncTxt() {
  const dir = path.join(storeDir, 'privacy-policy');
  if (!existsSync(path.join(dir, 'index.html'))) {
    fail('the privacy policy moved to legal/ (one policy for Windows, Android and the website, served at <server>/privacy/): edit legal/privacy/*.md and run node scripts/legal/build-pages.mjs - see store/privacy-policy/README.md');
  }
  for (const [html, txt] of [['index.html', 'privacy-en.txt'], ['he.html', 'privacy-he.txt']]) {
    const text = htmlToText(readFileSync(path.join(dir, html), 'utf8'));
    writeFileSync(path.join(dir, txt), text, 'utf8');
    console.log(`wrote privacy-policy/${txt} (${textLength(text)} characters) from ${html}`);
  }
}

// ---------------------------------------------------------------------------------------------
// render : store/ -> store/out/
// ---------------------------------------------------------------------------------------------
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readConfig(file) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    fail(`cannot read ${file}: ${e.message}\nCopy store/config.example.json to store/config.json and fill in the four values.`);
  }
  const cfg = {
    publisherName: String(raw.publisherName ?? '').trim(),
    contactEmail: String(raw.contactEmail ?? '').trim(),
    privacyPolicyUrl: String(raw.privacyPolicyUrl ?? '').trim(),
    effectiveDate: String(raw.effectiveDate ?? '').trim(),
  };
  if (!cfg.publisherName) fail('config: publisherName is empty');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.contactEmail)) fail('config: contactEmail is not an e-mail address');
  if (!cfg.privacyPolicyUrl) console.warn('render: privacyPolicyUrl is still empty - fill it in after the policy is published.');
  else if (!/^https:\/\/\S+$/.test(cfg.privacyPolicyUrl)) fail('config: privacyPolicyUrl must start with https://');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cfg.effectiveDate) || Number.isNaN(Date.parse(`${cfg.effectiveDate}T00:00:00Z`))) {
    fail('config: effectiveDate must look like 2026-10-15 (year-month-day)');
  }
  return cfg;
}

function dateInWords(iso, hebrew) {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat(hebrew ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

function fill(text, cfg, html, hebrew) {
  const esc = html ? escapeHtml : (s) => s;
  const values = {
    PUBLISHER_NAME: esc(cfg.publisherName),
    CONTACT_EMAIL: esc(cfg.contactEmail),
    PRIVACY_POLICY_URL: esc(cfg.privacyPolicyUrl),
    EFFECTIVE_DATE: esc(dateInWords(cfg.effectiveDate, hebrew)),
  };
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key) => (key in values ? values[key] : whole));
}

function isHebrewFile(rel) {
  const p = rel.replace(/\\/g, '/');
  return p.includes('/he-IL/') || p.startsWith('listing/he-IL/') || /(^|\/)he\.html$/.test(p) || /privacy-he\.txt$/.test(p) || /\.he\.md$/.test(p);
}

// ---------------------------------------------------------------------------------------------
// plain-text copies of the .md files (store/out/txt/)
// ---------------------------------------------------------------------------------------------
/** The texts between pairs of `-----` lines (the paste-ready blocks of certification-notes.md). */
export function pasteBlocks(md) {
  const blocks = [];
  let current = null;
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    if (/^-{5,}\s*$/.test(line)) {
      if (current === null) current = [];
      else {
        blocks.push(current.join('\n').trim());
        current = null;
      }
    } else if (current !== null) current.push(line);
  }
  if (current !== null) fail('certification-notes.md: a ----- marker has no partner');
  return blocks;
}

/** Markdown -> text that reads well in Notepad: no markup, tables as "heading: value" lines. */
export function mdToPlain(md) {
  const inline = (s) =>
    s
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/`([^`]*)`/g, '$1')
      .trim();
  const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(inline);
  const out = [];
  let header = null;
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*\|/.test(line)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue; // the |---|---| row
      if (!header) {
        header = cells(line);
        continue;
      }
      const row = cells(line);
      row.forEach((cell, i) => {
        if (cell && cell !== '-') out.push(`${i === 0 ? '* ' : '    '}${header[i] ?? ''}: ${cell}`);
      });
      out.push('');
      continue;
    }
    header = null;
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const title = inline(h[2]);
      out.push(h[1].length <= 2 ? title.toUpperCase() : title, (h[1].length === 1 ? '=' : '-').repeat(Math.min(title.length, 80)));
      continue;
    }
    if (!line.trim()) {
      out.push('');
      continue;
    }
    const m = /^(\s*)(.*)$/.exec(line);
    out.push(m[1] + inline(m[2].replace(/^- \[ \]/, '[ ]')));
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/** Writes store/out/txt/*.txt from the already filled .md texts; returns the number of files. */
function writePlainCopies(filledByRel) {
  const dir = path.join(outDir, 'txt');
  mkdirSync(dir, { recursive: true });
  const crlf = (s) => s.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  let n = 0;
  const notes = filledByRel.get('certification-notes.md');
  if (notes !== undefined) {
    const blocks = pasteBlocks(notes);
    if (blocks.length !== 2) fail(`certification-notes.md must hold exactly two paste blocks between ----- lines (found ${blocks.length})`);
    writeFileSync(path.join(dir, 'certification-notes-A.txt'), crlf(`${blocks[0]}\n`), 'utf8');
    writeFileSync(path.join(dir, 'certification-notes-B.txt'), crlf(`${blocks[1]}\n`), 'utf8');
    n += 2;
  }
  for (const name of ['age-rating-answers', 'submission-checklist']) {
    const md = filledByRel.get(`${name}.md`);
    if (md === undefined) continue;
    writeFileSync(path.join(dir, `${name}.txt`), crlf(mdToPlain(md)), 'utf8');
    n += 1;
  }
  // The screenshot captions belong to the screenshots task; copied only when that file exists.
  const captions = path.join(storeDir, 'screenshots', 'README.md');
  if (existsSync(captions)) {
    writeFileSync(path.join(dir, 'screenshot-captions.txt'), crlf(mdToPlain(readFileSync(captions, 'utf8'))), 'utf8');
    n += 1;
  }
  return n;
}

// ---------------------------------------------------------------------------------------------
// --guide : docs/STORE-RELEASE.he.md -> store/out/STORE-RELEASE.he.html (opens in the browser)
// ---------------------------------------------------------------------------------------------
/**
 * A small Markdown -> HTML converter for the owner's guide. It knows exactly what that file uses:
 * # headings, paragraphs, **bold**, `code`, bare https links, numbered and bulleted lists nested by
 * indentation, an indented paragraph inside a list item, tables, > quotes and --- rules.
 */
export function mdToHtml(md) {
  const inline = (s) =>
    s
      .split(/(`[^`]*`)/)
      .map((part) => {
        if (part.length >= 2 && part.startsWith('`') && part.endsWith('`')) return `<code dir="ltr">${escapeHtml(part.slice(1, -1))}</code>`;
        return escapeHtml(part)
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/https?:\/\/[^\s<)]*[^\s<).,;:]/g, (u) => `<a href="${u}" dir="ltr">${u}</a>`);
      })
      .join('');
  const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const root = [];
  const lists = []; // open lists, outermost first: { indent, node }
  let para = null; // { target, lines }
  let table = null;
  const top = () => lists[lists.length - 1];
  const container = () => (lists.length ? top().node.items[top().node.items.length - 1] : root);
  const flush = () => {
    if (para) para.target.push({ t: 'p', text: para.lines.join(' ') });
    para = null;
  };
  let title = '';
  for (const raw of md.replace(/\r\n/g, '\n').split('\n')) {
    const text = raw.trim();
    if (!text) {
      flush();
      table = null;
      continue;
    }
    const indent = raw.length - raw.trimStart().length;
    const item = /^(\d+\.|-)\s+(.*)$/.exec(text);
    if (item && !/^-{3,}$/.test(text)) {
      flush();
      table = null;
      const type = item[1] === '-' ? 'ul' : 'ol';
      while (lists.length && top().indent > indent) lists.pop();
      if (lists.length && top().indent === indent && top().node.type !== type) lists.pop();
      if (!lists.length || top().indent < indent) {
        const node = { t: 'list', type, items: [] };
        container().push(node);
        lists.push({ indent, node });
      }
      const children = [];
      top().node.items.push(children);
      para = { target: children, lines: [item[2]] };
      continue;
    }
    if (para && !/^(#{1,6}\s|>|\||-{3,}$)/.test(text)) {
      para.lines.push(text); // a wrapped line of the same paragraph
      continue;
    }
    flush();
    while (lists.length && top().indent >= indent) lists.pop();
    if (text.startsWith('|')) {
      if (/^\|[\s:|-]+\|$/.test(text)) continue;
      if (!table) {
        table = { t: 'table', head: cells(text), rows: [] };
        container().push(table);
      } else table.rows.push(cells(text));
      continue;
    }
    table = null;
    const h = /^(#{1,6})\s+(.*)$/.exec(text);
    if (h) {
      if (h[1].length === 1 && !title) title = h[2];
      container().push({ t: 'h', level: h[1].length, text: h[2] });
    } else if (/^-{3,}$/.test(text)) container().push({ t: 'hr' });
    else if (text.startsWith('>')) container().push({ t: 'quote', text: text.replace(/^>\s*/, '') });
    else para = { target: container(), lines: [text] };
  }
  flush();
  const block = (b, firstInItem = false) => {
    if (b.t === 'p') return firstInItem ? inline(b.text) : `<p>${inline(b.text)}</p>`;
    if (b.t === 'h') return `<h${b.level}>${inline(b.text)}</h${b.level}>`;
    if (b.t === 'hr') return '<hr>';
    if (b.t === 'quote') return `<blockquote><p>${inline(b.text)}</p></blockquote>`;
    if (b.t === 'table') {
      const row = (r, tag) => `<tr>${r.map((c) => `<${tag}${tag === 'th' ? ' scope="col"' : ''}>${inline(c)}</${tag}>`).join('')}</tr>`;
      return `<table>\n<thead>${row(b.head, 'th')}</thead>\n<tbody>\n${b.rows.map((r) => row(r, 'td')).join('\n')}\n</tbody>\n</table>`;
    }
    return `<${b.type}>\n${b.items.map((children) => `<li>${children.map((c, i) => block(c, i === 0)).join('\n')}</li>`).join('\n')}\n</${b.type}>`;
  };
  return { title, body: root.map((b) => block(b)).join('\n') };
}

/** Writes the owner's guide as a web page into store/out/ (the folder is created when missing). */
function writeGuide() {
  const source = path.join(storeDir, '..', 'docs', 'STORE-RELEASE.he.md');
  if (!existsSync(source)) return null;
  const { title, body } = mdToHtml(readFileSync(source, 'utf8'));
  const page = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; --bg: #ffffff; --text: #1c2430; --muted: #4a5565; --accent: #1f5fa8; --line: #d5dbe3; --box: #f3f6fa; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #14181f; --text: #e8ecf2; --muted: #b3bdcb; --accent: #8fc1ff; --line: #3a4352; --box: #1d232d; }
  }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: "Segoe UI", system-ui, Arial, sans-serif; line-height: 1.7; }
  main { max-width: 52rem; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
  h1 { font-size: 1.8rem; line-height: 1.3; }
  h2 { font-size: 1.35rem; margin-top: 2.2rem; padding-top: 1rem; border-top: 1px solid var(--line); }
  li { margin: 0.4rem 0; }
  a { color: var(--accent); }
  a:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  code { direction: ltr; unicode-bidi: isolate; background: var(--box); border: 1px solid var(--line); border-radius: 0.25rem; padding: 0.05rem 0.3rem; font-family: Consolas, "Courier New", monospace; font-size: 0.95em; overflow-wrap: anywhere; user-select: all; }
  blockquote { margin: 1rem 0; padding: 0.5rem 1rem; background: var(--box); border-inline-start: 4px solid var(--line); }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid var(--line); padding: 0.4rem 0.6rem; text-align: start; vertical-align: top; }
  th { background: var(--box); }
  hr { border: 0; border-top: 1px solid var(--line); margin: 2rem 0; }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
  mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, 'STORE-RELEASE.he.html');
  writeFileSync(target, page, 'utf8');
  return target;
}

function render(configFile) {
  const cfg = readConfig(configFile);
  rmSync(outDir, { recursive: true, force: true });
  let count = 0;
  const leftovers = [];
  const filledMd = new Map();
  for (const file of walk(storeDir)) {
    const rel = path.relative(storeDir, file);
    if (!TEXT_EXT.has(path.extname(file).toLowerCase())) continue;
    const text = readFileSync(file, 'utf8');
    const filled = fill(text, cfg, path.extname(file).toLowerCase() === '.html', isHebrewFile(rel));
    // Documentation files may mention a placeholder by name inside backticks; only real leftovers count.
    const rest = filled.replace(/`[^`\n]*`/g, '').match(/\{\{[A-Z_]+\}\}/g);
    if (rest) leftovers.push(`${rel}: ${[...new Set(rest)].join(' ')}`);
    const target = path.join(outDir, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, filled, 'utf8');
    count += 1;
    if (path.extname(file).toLowerCase() === '.md') filledMd.set(rel.replace(/\\/g, '/'), filled);
  }
  if (leftovers.length) fail(`unknown placeholders left in:\n  ${leftovers.join('\n  ')}`);
  count += writePlainCopies(filledMd);
  if (writeGuide()) count += 1;
  const present = readdirSync(path.join(outDir, 'listing')).filter((n) => statSync(path.join(outDir, 'listing', n)).isDirectory());
  const result = checkListings(outDir, present);
  console.log(`render: ${count} files written to ${path.relative(process.cwd(), outDir) || outDir}`);
  console.log(`  publisher: ${cfg.publisherName}`);
  console.log(`  contact:   ${cfg.contactEmail}`);
  console.log(`  policy:    ${cfg.privacyPolicyUrl || '(not set yet)'}`);
  console.log(`  effective: ${dateInWords(cfg.effectiveDate, false)} / ${dateInWords(cfg.effectiveDate, true)}`);
  console.log(formatReport(result));
  if (!result.ok) fail('a listing text breaks a Store limit or rule after filling the placeholders (see above)');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (args.includes('--sync-txt')) {
    syncTxt();
  } else if (args.includes('--guide')) {
    const target = writeGuide();
    if (!target) fail('docs/STORE-RELEASE.he.md was not found');
    console.log(`wrote ${path.relative(process.cwd(), target)}`);
  } else if (args.includes('--check')) {
    const i = args.indexOf('--only');
    const only = i >= 0 && args[i + 1] ? args[i + 1].split(',') : null;
    const result = checkListings(storeDir, only);
    console.log(formatReport(result));
    process.exit(result.ok ? 0 : 1);
  } else {
    const i = args.indexOf('--config');
    const configFile = i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : path.join(storeDir, args.includes('--example') ? 'config.example.json' : 'config.json');
    render(configFile);
  }
}
