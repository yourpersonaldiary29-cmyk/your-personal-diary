#!/usr/bin/env node
/**
 * scripts/store/listing-csv.mjs - fills Partner Center's "Export listing" .csv with the texts of store/listing/
 * (and, optionally, the screenshots of store/screenshots/) so that all languages are imported in one go.
 *
 *   node scripts/store/listing-csv.mjs --export <exported.csv>
 *        reads the file Partner Center exported (app overview -> Store listings -> Export listing) and writes
 *        store/out/listing-import/listings.csv (only that file: Partner Center -> Import listings -> Import .csv)
 *   ... --screenshots       also copies store/screenshots/<tag>/*.png next to it and fills DesktopScreenshot1..N
 *                           (+ captions from store/screenshots/captions.json); import with "Import folder"
 *   ... --whats-new         also fills "What's new" (ReleaseNotes) - only for an UPDATE: Microsoft says to leave
 *                           it blank on the first submission
 *   ... --out <folder>      another output folder (its name becomes the root of the screenshot paths)
 *   ... --only en-US,he-IL  only these languages (default: every language folder that exists)
 *
 * Why it starts from Microsoft's own export (source, read 2026-10-27: "Import and export Store listings for your
 * MSIX app", updated 2026-03-06, https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/import-and-export-store-listings):
 *   - "click Export listing ... to generate a .csv file encoded in UTF-8"; with no listings yet it has "columns for
 *     Field, ID, and Type, and default, and rows which correspond to every item that can appear in a Store listing";
 *   - "Don't change any of the info in the Field, ID, or Type columns. The info in these columns must remain
 *     unchanged in order for your imported file to be processed." - the IDs are not published, so this script
 *     never invents a row: it fills the rows it recognises by their Field name and reports the rest;
 *   - "You can create listings for new languages by adding the language-locale code into the next empty column
 *     in the top row" (codes from the Supported languages list: en-us, he-il, ...);
 *   - "If the field for a given language is left blank, the info from the default column will be used" - the
 *     default column gets the en-US text (owner decision: English is the default listing);
 *   - images: "importing your listings as a folder ... enter the full path, including the root folder name"
 *     (e.g. my_folder/screenshot1.png); "Make sure there is only one .csv file in your folder";
 *   - "If you use a different editor ... make sure the .csv file is encoded in UTF-8 before you upload."
 * Field names the page itself shows: Description, ReleaseNotes, Title, Feature1..Feature20, DesktopScreenshot1,
 * StoreLogo300x300. The others are matched by the candidate names below and, when the export has no such row,
 * listed at the end as "paste by hand" - nothing is guessed into the file.
 *
 * The listing texts must pass scripts/store/check-listing.mjs first; the placeholders ({{PUBLISHER_NAME}})
 * are filled from store/config.json / legal/settings.json. Support contact info is a Properties field and is
 * not part of the listing CSV.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_LISTING_DIR,
  DEFAULT_TAG,
  ROOT,
  STORE_LOCALES,
  checkListing,
  claimProblems,
  fillPlaceholders,
  itemsOf,
  loadValues,
  normalise,
} from './check-listing.mjs';

export const DEFAULT_OUT = path.join(ROOT, 'store', 'out', 'listing-import');
export const DEFAULT_SCREENSHOTS = path.join(ROOT, 'store', 'screenshots');
/** Partner Center accepts up to 10 desktop screenshots per language (screenshots-and-images page). */
export const MAX_SCREENSHOTS = 10;
export const CAPTION_LIMIT = 200;

// ---------------------------------------------------------------------------------------------
// CSV (RFC 4180): quoted cells may hold commas, quotes ("") and line breaks
// ---------------------------------------------------------------------------------------------
export function parseCsv(text) {
  const bom = text.charCodeAt(0) === 0xfeff;
  const src = bom ? text.slice(1) : text;
  const eol = /\r\n/.test(src) ? '\r\n' : '\n';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && cell === '') {
      quoted = true;
      i += 1;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
      i += 1;
    } else if (ch === '\r' && src[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 2;
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else {
      cell += ch;
      i += 1;
    }
  }
  if (quoted) throw new Error('the .csv file ends inside a quoted cell');
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return { rows, bom, eol };
}

export function toCsv({ rows, bom, eol }) {
  const quote = (c) => (/[",\r\n]|^\s|\s$/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  const width = Math.max(...rows.map((r) => r.length));
  const body = rows.map((r) => Array.from({ length: width }, (_, i) => quote(r[i] ?? '')).join(',')).join(eol);
  return `${bom ? '﻿' : ''}${body}${eol}`;
}

// ---------------------------------------------------------------------------------------------
// Field rows
// ---------------------------------------------------------------------------------------------
/** Our field files -> the Field names of the export (first match wins, case-insensitive). */
export function fieldPlan({ whatsNew = false } = {}) {
  const plan = [
    { key: 'title', names: ['Title'], file: 'title.txt' },
    { key: 'description', names: ['Description'], file: 'description.txt' },
    { key: 'shortDescription', names: ['ShortDescription'], file: 'short-description.txt' },
    { key: 'copyright', names: ['CopyrightAndTrademarkInfo', 'CopyrightAndTrademarkInformation', 'CopyrightTrademarkInformation', 'CopyrightTrademarkInfo', 'Copyright'], file: 'copyright.txt' },
  ];
  if (whatsNew) plan.push({ key: 'releaseNotes', names: ['ReleaseNotes', 'WhatsNew'], file: 'whats-new.txt' });
  for (let n = 1; n <= 20; n += 1) plan.push({ key: `feature${n}`, names: [`Feature${n}`, `ProductFeature${n}`], file: 'features.txt', item: n - 1 });
  for (let n = 1; n <= 7; n += 1) plan.push({ key: `searchTerm${n}`, names: [`SearchTerm${n}`, `Keyword${n}`, `SearchTerms${n}`], file: 'keywords.txt', item: n - 1 });
  return plan;
}

/** The value of one planned field for one language ('' for an unused list item). */
function valueOf(entry, dir, tag, values) {
  const raw = readFileSync(path.join(dir, tag, entry.file), 'utf8');
  const text = fillPlaceholders(normalise(raw), values);
  if (entry.item === undefined) return text;
  return itemsOf(text)[entry.item] ?? '';
}

/** PNG files of store/screenshots/<tag>/ in name order (01-..., 02-...), at most MAX_SCREENSHOTS. */
export function screenshotsOf(shotsDir, tag) {
  const dir = path.join(shotsDir, tag);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => /\.png$/i.test(n) && statSync(path.join(dir, n)).isFile())
    .sort()
    .slice(0, MAX_SCREENSHOTS);
}

/** Captions from store/screenshots/captions.json: { "<tag>": { "<file>": "caption" } } or { "<tag>": ["caption", ...] }. */
export function captionsOf(shotsDir, tag, files) {
  const file = path.join(shotsDir, 'captions.json');
  if (!existsSync(file)) return files.map(() => '');
  let json;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return files.map(() => '');
  }
  const forTag = json?.[tag];
  if (Array.isArray(forTag)) return files.map((_, i) => (typeof forTag[i] === 'string' ? forTag[i] : forTag[i]?.caption ?? ''));
  if (forTag && typeof forTag === 'object') return files.map((f) => (typeof forTag[f] === 'string' ? forTag[f] : forTag[f]?.caption ?? ''));
  return files.map(() => '');
}

/**
 * Builds the import .csv. Returns { csv, filled, missing, added, notes, copies } where copies are the screenshot
 * files to copy ({ from, to }) when `screenshots` is on. Throws when the export is not a Partner Center export.
 */
export function buildImport(exportText, {
  listingDir = DEFAULT_LISTING_DIR,
  tags = null,
  values = loadValues(),
  whatsNew = false,
  screenshots = false,
  shotsDir = DEFAULT_SCREENSHOTS,
  rootName = 'listing-import',
} = {}) {
  const parsed = parseCsv(exportText);
  const { rows } = parsed;
  if (!rows.length) throw new Error('the exported .csv is empty');
  const header = rows[0];
  const col = (name) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const fieldCol = col('Field');
  const defaultCol = col('default');
  if (fieldCol !== 0 || col('ID') < 0 || col('Type') < 0 || defaultCol < 0) {
    throw new Error('this is not a Partner Center listing export: the first row must have the columns Field, ID, Type and default');
  }
  const rowByName = new Map();
  rows.slice(1).forEach((r, i) => {
    const name = (r[fieldCol] ?? '').trim();
    if (name) rowByName.set(name.toLowerCase(), i + 1);
  });

  const languages = (tags ?? Object.keys(STORE_LOCALES).filter((t) => existsSync(path.join(listingDir, t)))).filter((t) => STORE_LOCALES[t]);
  if (!languages.includes(DEFAULT_TAG)) throw new Error(`the ${DEFAULT_TAG} listing is required (it fills the default column)`);
  const added = [];
  const columnOf = {};
  for (const tag of languages) {
    let c = col(tag);
    if (c < 0) {
      c = header.length;
      header.push(tag.toLowerCase());
      added.push(tag.toLowerCase());
    }
    columnOf[tag] = c;
  }
  const set = (rowIndex, c, value) => {
    const r = rows[rowIndex];
    while (r.length <= c) r.push('');
    r[c] = value;
  };

  const filled = [];
  const missing = [];
  for (const entry of fieldPlan({ whatsNew })) {
    const name = entry.names.find((n) => rowByName.has(n.toLowerCase()));
    if (!name) {
      // A list item beyond what we use needs no row; report only rows that would carry text.
      const needed = languages.some((tag) => valueOf(entry, listingDir, tag, values) !== '');
      if (needed) missing.push(`${entry.names[0]} (${entry.file}${entry.item !== undefined ? ` line ${entry.item + 1}` : ''})`);
      continue;
    }
    const r = rowByName.get(name.toLowerCase());
    for (const tag of languages) set(r, columnOf[tag], valueOf(entry, listingDir, tag, values));
    // The default column carries the English text of the single fields (a language without its own text falls
    // back to it); list items stay empty there, so that a language never inherits an English feature or term.
    set(r, defaultCol, entry.item === undefined ? valueOf(entry, listingDir, DEFAULT_TAG, values) : '');
    filled.push(name);
  }
  // First submission: Microsoft says to leave "What's new" blank - clear whatever the export carries.
  if (!whatsNew) {
    for (const n of ['ReleaseNotes', 'WhatsNew']) {
      const r = rowByName.get(n.toLowerCase());
      if (r === undefined) continue;
      for (const tag of languages) set(r, columnOf[tag], '');
      set(r, defaultCol, '');
    }
  }

  const notes = [];
  const copies = [];
  const ours = new Set(languages.map((t) => t.toLowerCase()));
  const others = header.slice(4).filter((h) => h.trim() && !ours.has(h.trim().toLowerCase()));
  if (others.length) {
    notes.push(`the export has columns for languages without a listing folder here (${others.join(' ')}): they get the default (English) texts - remove those languages in Partner Center (Add/remove languages) or translate them first; every listing needs a description and a screenshot`);
  }
  if (screenshots) {
    for (const tag of languages) {
      const files = screenshotsOf(shotsDir, tag);
      if (!files.length) {
        notes.push(`${tag}: no screenshots in store/screenshots/${tag}/ - upload them by hand`);
        continue;
      }
      const captions = captionsOf(shotsDir, tag, files);
      files.forEach((f, i) => {
        const n = i + 1;
        const shotRow = rowByName.get(`desktopscreenshot${n}`);
        if (shotRow === undefined) {
          missing.push(`DesktopScreenshot${n} (${tag}/${f})`);
          return;
        }
        const rel = `screenshots/${tag}/${f}`;
        set(shotRow, columnOf[tag], `${rootName}/${rel}`);
        copies.push({ from: path.join(shotsDir, tag, f), to: rel });
        const caption = (captions[i] ?? '').trim();
        if (!caption) return;
        const bad = claimProblems(tag, caption);
        if (caption.length > CAPTION_LIMIT) bad.push(`${caption.length} characters, the limit is ${CAPTION_LIMIT}`);
        if (bad.length) {
          notes.push(`${tag}/${f}: caption left out - ${bad.join('; ')}`);
          return;
        }
        const capName = [`DesktopScreenshotCaption${n}`, `DesktopScreenshotComment${n}`].find((c) => rowByName.has(c.toLowerCase()));
        if (capName) set(rowByName.get(capName.toLowerCase()), columnOf[tag], caption);
        else notes.push(`${tag}/${f}: the export has no caption row for screenshot ${n} - type the caption by hand`);
      });
    }
  }
  return { csv: toCsv(parsed), filled, missing: [...new Set(missing)], added, notes, copies, languages };
}

// ---------------------------------------------------------------------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : null;
  };
  const fail = (msg) => {
    console.error(`listing-csv: ${msg}`);
    process.exit(1);
  };
  const exportFile = opt('--export');
  if (!exportFile) {
    fail('give the file Partner Center exported: node scripts/store/listing-csv.mjs --export <path to the exported .csv>\n' +
      '(Partner Center -> your app -> Store listings -> Export listing; see store/submission-checklist.md, "Listings by CSV")');
  }
  if (!existsSync(exportFile)) fail(`${exportFile} does not exist`);
  const outDir = path.resolve(opt('--out') ?? DEFAULT_OUT);
  const tags = opt('--only') ? opt('--only').split(',').map((s) => s.trim()) : null;
  const check = checkListing(DEFAULT_LISTING_DIR, { only: tags ?? Object.keys(STORE_LOCALES).filter((t) => existsSync(path.join(DEFAULT_LISTING_DIR, t))) });
  if (!check.ok) fail('the listing texts do not pass node scripts/store/check-listing.mjs - fix them first');
  let result;
  try {
    result = buildImport(readFileSync(exportFile, 'utf8'), {
      tags,
      whatsNew: args.includes('--whats-new'),
      screenshots: args.includes('--screenshots'),
      rootName: path.basename(outDir),
    });
  } catch (e) {
    fail(e.message);
  }
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'listings.csv'), result.csv, 'utf8');
  for (const c of result.copies) {
    mkdirSync(path.dirname(path.join(outDir, c.to)), { recursive: true });
    copyFileSync(c.from, path.join(outDir, c.to));
  }
  console.log(`listing-csv: wrote ${path.relative(process.cwd(), path.join(outDir, 'listings.csv'))}`);
  console.log(`  languages: ${result.languages.join(' ')}${result.added.length ? ` (new columns: ${result.added.join(' ')})` : ''}`);
  console.log(`  fields filled: ${result.filled.length} rows`);
  if (result.copies.length) console.log(`  screenshots: ${result.copies.length} files copied - import the FOLDER ${outDir}`);
  else console.log('  import the .csv file alone (Import listings -> Import .csv)');
  if (!args.includes('--whats-new')) console.log("  What's new: left blank (first submission)");
  for (const m of result.missing) console.log(`  paste by hand (no such row in the export): ${m}`);
  for (const n of result.notes) console.log(`  note: ${n}`);
}
