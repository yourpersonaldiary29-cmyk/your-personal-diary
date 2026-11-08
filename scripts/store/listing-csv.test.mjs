/**
 * Tests of the Partner Center listing CSV generator (Node's own test runner):
 *
 *   node --test scripts/store/listing-csv.test.mjs
 *
 * The export below imitates the layout Microsoft documents ("Import and export Store listings for your MSIX
 * app": columns Field, ID, Type, default; one row per listing item, Feature1..Feature20, DesktopScreenshot1...);
 * the IDs are made up - the generator never writes or changes them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LISTING_DIR, itemsOf, normalise } from './check-listing.mjs';
import { buildImport, parseCsv, toCsv } from './listing-csv.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'listing-csv.mjs');
const VALUES = { publisherName: 'Fictional Publisher', contactEmail: 'support@example.com', source: 'test' };
const PATH_TYPE = 'Relative path (or URL to file in Partner Center)';

function exportCsv({ searchTerms = true, captions = true, extraLanguages = [] } = {}) {
  const rows = [['Field', 'ID', 'Type', 'default', ...extraLanguages]];
  let id = 1;
  const add = (name, type = 'Text', value = '') => rows.push([name, String(id++), type, value]);
  add('Description');
  add('ReleaseNotes', 'Text', 'Old notes, "quoted", with a comma');
  add('Title');
  add('ShortTitle');
  add('SortTitle');
  add('VoiceTitle');
  add('ShortDescription');
  add('DevStudio');
  add('CopyrightAndTrademarkInfo');
  add('AdditionalLicenseTerms');
  for (let n = 1; n <= 20; n += 1) add(`Feature${n}`);
  if (searchTerms) for (let n = 1; n <= 7; n += 1) add(`SearchTerm${n}`);
  for (let n = 1; n <= 10; n += 1) add(`DesktopScreenshot${n}`, PATH_TYPE);
  if (captions) for (let n = 1; n <= 10; n += 1) add(`DesktopScreenshotCaption${n}`);
  add('StoreLogo300x300', PATH_TYPE);
  return toCsv({ rows, bom: true, eol: '\r\n' });
}

function table(csvText) {
  const { rows } = parseCsv(csvText);
  const header = rows[0].map((h) => h.toLowerCase());
  const byField = new Map(rows.slice(1).map((r) => [r[0], r]));
  return { rows, header, cell: (field, column) => byField.get(field)?.[header.indexOf(column.toLowerCase())] ?? '' };
}

const listing = (tag, file) => normalise(readFileSync(path.join(DEFAULT_LISTING_DIR, tag, file), 'utf8'));

// ---------------------------------------------------------------------------------------------
test('CSV: quotes, commas, line breaks, BOM and CRLF survive a round trip', () => {
  const text = '﻿Field,ID,Type,default\r\nDescription,1,Text,"Line one\nLine ""two"", with a comma"\r\nTitle,2,Text, padded \r\n';
  const parsed = parseCsv(text);
  assert.equal(parsed.bom, true);
  assert.equal(parsed.eol, '\r\n');
  assert.deepEqual(parsed.rows[1], ['Description', '1', 'Text', 'Line one\nLine "two", with a comma']);
  assert.equal(parsed.rows[2][3], ' padded ');
  assert.deepEqual(parseCsv(toCsv(parsed)).rows, parsed.rows);
  assert.throws(() => parseCsv('a,"b\n'), /inside a quoted cell/);
});

test('fills the en-us and he-il columns and the default column, keeps Field / ID / Type', () => {
  const before = table(exportCsv());
  const result = buildImport(exportCsv(), { tags: ['en-US', 'he-IL'], values: VALUES });
  const after = table(result.csv);
  assert.deepEqual(result.added, ['en-us', 'he-il']);
  assert.deepEqual(after.header.slice(0, 6), ['field', 'id', 'type', 'default', 'en-us', 'he-il']);
  // Field, ID and Type are untouched, row for row.
  assert.deepEqual(after.rows.slice(1).map((r) => r.slice(0, 3)), before.rows.slice(1).map((r) => r.slice(0, 3)));

  assert.equal(after.cell('Title', 'en-us'), 'Your Personal Diary');
  assert.equal(after.cell('Title', 'he-il'), 'Your Personal Diary');
  assert.equal(after.cell('Description', 'en-us'), listing('en-US', 'description.txt'));
  assert.equal(after.cell('Description', 'he-il'), listing('he-IL', 'description.txt'));
  assert.equal(after.cell('Description', 'default'), listing('en-US', 'description.txt'));
  assert.equal(after.cell('ShortDescription', 'he-il'), listing('he-IL', 'short-description.txt'));
  assert.equal(after.cell('CopyrightAndTrademarkInfo', 'en-us'), '© 2026 Fictional Publisher. All rights reserved.');
  const features = itemsOf(listing('he-IL', 'features.txt'));
  assert.equal(after.cell('Feature1', 'he-il'), features[0]);
  assert.equal(after.cell('Feature20', 'he-il'), features[19]);
  assert.equal(after.cell('Feature1', 'default'), '', 'list items never fall back to English');
  const terms = itemsOf(listing('en-US', 'keywords.txt'));
  assert.equal(after.cell('SearchTerm1', 'en-us'), terms[0]);
  assert.equal(after.cell('SearchTerm7', 'en-us'), terms[6] ?? '');
  // Rows we do not own stay as exported.
  assert.equal(after.cell('ShortTitle', 'en-us'), '');
  assert.equal(after.cell('StoreLogo300x300', 'default'), '');
  assert.deepEqual(result.missing, []);
  assert.ok(result.csv.startsWith('﻿'), 'keeps the UTF-8 byte-order mark of the export');
  assert.ok(result.csv.includes('\r\n'), 'keeps the CRLF line ends of the export');
});

test("What's new stays blank on the first submission and is filled only with --whats-new", () => {
  const first = table(buildImport(exportCsv(), { tags: ['en-US', 'he-IL'], values: VALUES }).csv);
  assert.equal(first.cell('ReleaseNotes', 'default'), '');
  assert.equal(first.cell('ReleaseNotes', 'en-us'), '');
  const update = table(buildImport(exportCsv(), { tags: ['en-US', 'he-IL'], values: VALUES, whatsNew: true }).csv);
  assert.equal(update.cell('ReleaseNotes', 'he-il'), listing('he-IL', 'whats-new.txt'));
});

test('reports fields the export has no row for instead of inventing rows', () => {
  const result = buildImport(exportCsv({ searchTerms: false }), { tags: ['en-US'], values: VALUES });
  assert.ok(result.missing.some((m) => /^SearchTerm1 \(keywords\.txt line 1\)/.test(m)), JSON.stringify(result.missing));
  assert.ok(!table(result.csv).rows.some((r) => /^SearchTerm/.test(r[0])));
});

test('reuses an existing language column and warns about languages without a folder', () => {
  const result = buildImport(exportCsv({ extraLanguages: ['en-us', 'fr-fr'] }), { tags: ['en-US'], values: VALUES });
  const t = table(result.csv);
  assert.deepEqual(result.added, []);
  assert.equal(t.header.filter((h) => h === 'en-us').length, 1);
  assert.equal(t.cell('Title', 'en-us'), 'Your Personal Diary');
  assert.ok(result.notes.some((n) => /fr-fr/.test(n)));
});

test('refuses a file that is not a Partner Center listing export, and a set without en-US', () => {
  assert.throws(() => buildImport('Name,Value\r\nDescription,x\r\n', { values: VALUES }), /not a Partner Center listing export/);
  assert.throws(() => buildImport(exportCsv(), { tags: ['he-IL'], values: VALUES }), /en-US listing is required/);
});

test('screenshots: paths under the import folder, captions checked for claims and length', () => {
  const shots = mkdtempSync(path.join(os.tmpdir(), 'store-shots-'));
  try {
    mkdirSync(path.join(shots, 'en-US'));
    for (const f of ['02-diary.png', '01-home.png', 'notes.txt']) writeFileSync(path.join(shots, 'en-US', f), 'x');
    writeFileSync(path.join(shots, 'captions.json'), JSON.stringify({
      _comment: 'test',
      'en-US': { '01-home.png': 'Home: today at a glance.', '02-diary.png': 'Your diary, stored only on your PC.' },
    }));
    const result = buildImport(exportCsv(), { tags: ['en-US', 'he-IL'], values: VALUES, screenshots: true, shotsDir: shots, rootName: 'my_import' });
    const t = table(result.csv);
    assert.equal(t.cell('DesktopScreenshot1', 'en-us'), 'my_import/screenshots/en-US/01-home.png');
    assert.equal(t.cell('DesktopScreenshot2', 'en-us'), 'my_import/screenshots/en-US/02-diary.png');
    assert.equal(t.cell('DesktopScreenshot3', 'en-us'), '');
    assert.equal(t.cell('DesktopScreenshotCaption1', 'en-us'), 'Home: today at a glance.');
    assert.equal(t.cell('DesktopScreenshotCaption2', 'en-us'), '', 'a caption with a forbidden claim is left out');
    assert.ok(result.notes.some((n) => /02-diary\.png: caption left out/.test(n)));
    assert.ok(result.notes.some((n) => /he-IL: no screenshots/.test(n)));
    assert.deepEqual(result.copies.map((c) => c.to), ['screenshots/en-US/01-home.png', 'screenshots/en-US/02-diary.png']);
  } finally {
    rmSync(shots, { recursive: true, force: true });
  }
});

test('command line: needs --export, writes listings.csv into the output folder', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'store-csv-'));
  try {
    let run = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /Export listing/);
    const exported = path.join(tmp, 'exported.csv');
    writeFileSync(exported, exportCsv(), 'utf8');
    const out = path.join(tmp, 'listing-import');
    run = spawnSync(process.execPath, [SCRIPT, '--export', exported, '--out', out, '--only', 'en-US,he-IL'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.ok(existsSync(path.join(out, 'listings.csv')));
    assert.match(run.stdout, /What's new: left blank/);
    const t = table(readFileSync(path.join(out, 'listings.csv'), 'utf8'));
    assert.equal(t.cell('Title', 'he-il'), 'Your Personal Diary');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
