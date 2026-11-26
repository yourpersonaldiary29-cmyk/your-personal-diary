/**
 * Tests of scripts/site/downloads-shared.mjs - the installer list of the Downloads page and the markup of its rows,
 * shared by the site builder and the hosted server (docs/server-tasks/SERVER-CARD-V2.md Part A):
 *
 *   node --test scripts/site/downloads-shared.test.mjs
 *
 * The builder and add-download.mjs use the shared rules themselves (the same objects, not copies); the module has no
 * import (the hosted bundle carries it); every Downloads page holds the nine list regions in panel order, with the
 * empty-state text hidden while a platform has a file; the server's replacement of the regions gives, for the list
 * the page was built from, the builder's page byte for byte in all 20 languages - and for another list exactly the
 * page the builder writes for that list (a new row, a platform without a file); a page that is not the builder's is
 * left alone; a built tree carries files/downloads.json and siteFolderProblems notices when it is missing, broken or
 * another list. The server side (merging, serving, the owner's API) is tested in
 * server/test/hosted-downloads.test.ts (vitest).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { escapeHtml as legalEscapeHtml, LOCALES, readSiteUrl } from '../legal/build-pages.mjs';
import * as addDownload from './add-download.mjs';
import * as builder from './build-site.mjs';
import { buildSite, contentFile, pageFile, readSiteSettings, renderSitePage, ROOT, SITE_PAGES, siteDir, siteFolderProblems, writeSite } from './build-site.mjs';
import * as shared from './downloads-shared.mjs';
import {
  DOWNLOAD_PLATFORMS,
  DOWNLOAD_REGIONS,
  downloadMarker,
  downloadRegions,
  downloadRowHtml,
  downloadSumHtml,
  escapeHtml,
  FILES_DIR,
  formatDownloads,
  formatStoreLinks,
  IMAGE_LIST_FILE,
  isolateLatin,
  megabytes,
  PLATFORMS,
  PUBLIC_NAMES,
  relativeHref,
  replaceDownloadRegions,
  STORE_LINK_KEYS,
  STORE_LINKS_FILE,
} from './downloads-shared.mjs';
import { FILLED, fixture, fixtureDownloads, readJson } from './fixture-tree.mjs';

const MODULE = path.join(ROOT, 'scripts', 'site', 'downloads-shared.mjs');
const site = buildSite({ settings: FILLED });
const siteSettings = readSiteSettings();
const siteUrl = readSiteUrl();
const pageOf = (l) => ({ dir: siteDir('downloads', l.code), rtl: l.dir === 'rtl', intl: l.intl });
const contentOf = (code) => readJson(contentFile(ROOT, code));
const ROW = { version: '1.1.0', date: '2026-11-18', file: PUBLIC_NAMES.windows('1.1.0'), bytes: 3_456_789, sha256: 'ab'.repeat(32) };

test('the builder and add-download.mjs use the shared rules themselves, and the module imports nothing', () => {
  for (const name of ['PLATFORMS', 'DOWNLOAD_PLATFORMS', 'DOWNLOAD_ROW_KEYS', 'downloadsProblems', 'formatDownloads', 'compareVersions', 'isVersion', 'isIsoDate', 'relativeHref', 'megabytes', 'FILES_DIR', 'IMAGE_LIST_FILE', 'formatStoreLinks', 'STORE_LINKS_FILE']) {
    assert.ok(shared[name] !== undefined && builder[name] === shared[name], `build-site.mjs exports ${name} of downloads-shared.mjs`);
  }
  assert.equal(addDownload.PUBLIC_NAMES, PUBLIC_NAMES);
  assert.deepEqual(PLATFORMS, ['windows', 'android', 'mac']);
  assert.deepEqual(Object.values(DOWNLOAD_PLATFORMS).map((p) => p.extension), ['.exe', '.apk', '.dmg']);
  assert.deepEqual([PUBLIC_NAMES.windows('1.2.3'), PUBLIC_NAMES.android('1.2.3'), PUBLIC_NAMES.mac('1.2.3')], [
    'YourPersonalDiary-1.2.3-windows-x64-setup.exe',
    'YourPersonalDiary-1.2.3-android.apk',
    'YourPersonalDiary-1.2.3-mac-universal.dmg',
  ]);
  assert.equal(IMAGE_LIST_FILE, 'files/downloads.json');
  // The hosted bundle carries this file: no import, no require, no address.
  const source = readFileSync(MODULE, 'utf8');
  assert.ok(!/^\s*(?:import|export\s+\*)\b.*\bfrom\b/m.test(source) && !/\brequire\s*\(/.test(source) && !/\bimport\s*\(/.test(source), 'no import of any kind');
  assert.ok(!/https?:\/\//.test(source), 'no address');
  // The escaping of the rows is the escaping of the rest of the pages.
  for (const text of ['a & b < c > d "e" \'f\'', '&amp;', 'plain', '<script>', '']) assert.equal(escapeHtml(text), legalEscapeHtml(text), text);
});

test('rows: the markup of a row and of its checksum, left to right and right to left', () => {
  const english = { dir: 'downloads/', rtl: false, intl: 'en-GB' };
  const hebrew = { dir: 'he/downloads/', rtl: true, intl: 'he-IL' };
  assert.equal(
    downloadRowHtml(ROW, english),
    `<tr data-file="${ROW.file}" data-bytes="3456789" data-sha256="${ROW.sha256}"><th scope="row"><a class="get" href="../files/${ROW.file}" download><bdi dir="ltr">${ROW.file}</bdi></a></th><td>1.1.0</td><td>${escapeHtml(megabytes(ROW.bytes, 'en-GB'))}</td></tr>`,
  );
  assert.equal(megabytes(ROW.bytes, 'en-GB'), '3.3 MB');
  assert.equal(
    downloadRowHtml(ROW, hebrew),
    `<tr data-file="${ROW.file}" data-bytes="3456789" data-sha256="${ROW.sha256}"><th scope="row"><a class="get" href="../../files/${ROW.file}" download><bdi dir="ltr">${ROW.file}</bdi></a></th><td><bdi>1.1.0</bdi></td><td>${isolateLatin(megabytes(ROW.bytes, 'he-IL'))}</td></tr>`,
  );
  assert.equal(downloadSumHtml(ROW), `<dt><bdi dir="ltr">${ROW.file}</bdi></dt><dd><code dir="ltr">${ROW.sha256}</code></dd>`);
  // The regions: the markers around them; a platform without a row shows its empty-state text.
  const two = downloadRegions('windows', [ROW, fixtureDownloads().windows[0]], { ...english, emptyHtml: 'Nothing yet.' });
  assert.equal(two.rows, `<!-- downloads:windows:rows -->\n${downloadRowHtml(ROW, english)}\n${downloadRowHtml(fixtureDownloads().windows[0], english)}\n<!-- /downloads:windows:rows -->`);
  assert.equal(two.empty, '<!-- downloads:windows:empty -->\n<p class="empty" hidden>Nothing yet.</p>\n<!-- /downloads:windows:empty -->');
  assert.equal(two.sums, `<!-- downloads:windows:sums -->\n${downloadSumHtml(ROW)}\n${downloadSumHtml(fixtureDownloads().windows[0])}\n<!-- /downloads:windows:sums -->`);
  const none = downloadRegions('mac', [], { ...english, emptyHtml: 'Nothing yet.' });
  assert.deepEqual(none, {
    rows: '<!-- downloads:mac:rows -->\n<!-- /downloads:mac:rows -->',
    empty: '<!-- downloads:mac:empty -->\n<p class="empty">Nothing yet.</p>\n<!-- /downloads:mac:empty -->',
    sums: '<!-- downloads:mac:sums -->\n<!-- /downloads:mac:sums -->',
  });
  assert.equal(downloadMarker('android', 'sums', true), '<!-- /downloads:android:sums -->');
  assert.equal(relativeHref('he/downloads/', `${FILES_DIR}/${ROW.file}`), `../../files/${ROW.file}`);
});

test('every Downloads page holds the nine list regions in panel order, the empty-state text hidden while a platform has a file', () => {
  const expectedOrder = PLATFORMS.flatMap((platform) => DOWNLOAD_REGIONS.flatMap((region) => [`${platform}:${region}`, `/${platform}:${region}`]));
  assert.deepEqual(DOWNLOAD_REGIONS, ['rows', 'empty', 'sums'], 'the order of the regions in a panel');
  for (const l of LOCALES) {
    const html = site.pages.get(pageFile('downloads', l.code));
    const markers = [...html.matchAll(/<!-- (\/?)downloads:([a-z]+):([a-z]+) -->/g)].map((m) => `${m[1]}${m[2]}:${m[3]}`);
    assert.deepEqual(markers, expectedOrder, `${l.code}: the markers`);
    const content = contentOf(l.code);
    const text = (l.dir === 'rtl' ? isolateLatin : escapeHtml)(content.downloads.empty);
    for (const platform of PLATFORMS) {
      assert.ok(html.includes(`<!-- downloads:${platform}:empty -->\n<p class="empty" hidden>${text}</p>\n<!-- /downloads:${platform}:empty -->`), `${l.code} ${platform}: the empty-state text, hidden`);
      // Inside the box of the table, right after it; the rows inside the table body, the checksums inside their list.
      assert.ok(html.includes(`</table>\n<!-- downloads:${platform}:empty -->`) && html.includes(`<!-- /downloads:${platform}:empty -->\n</div>`), `${l.code} ${platform}: the place of the empty-state text`);
      assert.ok(html.includes(`<tbody>\n<!-- downloads:${platform}:rows -->`) && html.includes(`<!-- /downloads:${platform}:rows -->\n</tbody>`), `${l.code} ${platform}: the rows in the table body`);
      assert.ok(html.includes(`<dl class="sums">\n<!-- downloads:${platform}:sums -->`) && html.includes(`<!-- /downloads:${platform}:sums -->\n</dl>`), `${l.code} ${platform}: the checksums in their list`);
    }
  }
  assert.equal(contentOf('en').downloads.empty, 'No installation file for this system yet.');
  // No other page holds a marker.
  for (const [rel, html] of site.pages) if (!rel.endsWith('downloads/index.html')) assert.ok(!html.includes('<!-- downloads:'), rel);
  assert.ok(site.files.get('site.css').includes('.files>.empty{'), 'the empty-state text has its style');
  // While a platform shows it, its empty table, its empty checksum list and the paragraph about opening "this setup
  // file" are hidden - from screen readers too; the system requirement stays.
  assert.ok(
    site.files.get('site.css').includes('.files:has(>.empty:not([hidden]))>table,.panel:has(>.files>.empty:not([hidden]))>.qa,.panel:has(>.files>.empty:not([hidden]))>.files~p:not(.need){display:none}'),
    'an empty platform hides its table, its checksums and its install paragraph',
  );
  for (const platform of PLATFORMS) {
    const panel = new RegExp(`<section class="panel" id="${platform}">\\n<h2>[^\\n]*</h2>\\n(?:<p class="actions">[^\\n]*</p>\\n)?<div class="files">\\n<table>[\\s\\S]*?</table>\\n<!-- downloads:${platform}:empty -->[\\s\\S]*?<!-- /downloads:${platform}:empty -->\\n</div>\\n<p class="need">[^\\n]*</p>\\n<p>[^\\n]*</p>\\n<details class="qa">\\n[\\s\\S]*?<dl class="sums">\\n<!-- downloads:${platform}:sums -->[\\s\\S]*?</details>\\n</section>`);
    assert.match(site.pages.get(pageFile('downloads', 'en')), panel, `${platform}: the table and the checksums are children of the panel those rules name`);
  }
});

test("the server's replacement: the list of the page gives the builder's page byte for byte; another list gives the builder's page of that list", () => {
  for (const l of LOCALES) {
    const rel = pageFile('downloads', l.code);
    const built = site.pages.get(rel);
    const page = pageOf(l);
    assert.equal(replaceDownloadRegions(built, site.downloads, page), built, `${l.code}: an unchanged list is the builder's page`);
    // A new Windows version above the old one, Android without a file, the Mac list as it was.
    const lists = { windows: [ROW, ...site.downloads.windows], android: [], mac: site.downloads.mac };
    const expected = renderSitePage({ page: 'downloads', locale: l.code, content: contentOf(l.code), settings: FILLED, siteSettings, siteUrl, downloads: lists });
    const replaced = replaceDownloadRegions(built, lists, page);
    assert.equal(replaced, expected, `${l.code}: the page the builder writes for that list`);
    assert.ok(replaced.includes(downloadRowHtml(ROW, page)), `${l.code}: the new row`);
    assert.ok(replaced.includes('<!-- downloads:android:empty -->\n<p class="empty">'), `${l.code}: Android shows its empty-state text`);
    assert.ok(replaced.includes('<!-- downloads:android:rows -->\n<!-- /downloads:android:rows -->'), `${l.code}: and no row`);
    // And back: the regions of a replaced page can be replaced again.
    assert.equal(replaceDownloadRegions(replaced, site.downloads, page), built, `${l.code}: back to the list of the image`);
  }
});

test('a page that is not the builder\'s is left alone (null): a marker missing or twice, another empty-state shape, another page', () => {
  const l = LOCALES.find((x) => x.code === 'en');
  const built = site.pages.get(pageFile('downloads', 'en'));
  const page = pageOf(l);
  assert.equal(replaceDownloadRegions(built.replace('<!-- /downloads:mac:sums -->', ''), site.downloads, page), null, 'a closing marker missing');
  assert.equal(replaceDownloadRegions(built.replace('<!-- downloads:android:rows -->', '<!-- downloads:mac:rows -->'), site.downloads, page), null, 'a marker that does not match its partner');
  const region = /<!-- downloads:windows:rows -->[\s\S]*?<!-- \/downloads:windows:rows -->/.exec(built)[0];
  assert.equal(replaceDownloadRegions(built.replace('</table>', `</table>\n${region}`), site.downloads, page), null, 'a region twice');
  assert.equal(replaceDownloadRegions(built.replace('<p class="empty" hidden>', '<p class="other" hidden>'), site.downloads, page), null, 'an empty-state text of another shape');
  for (const id of SITE_PAGES.map((p) => p.id).filter((id) => id !== 'downloads')) assert.equal(replaceDownloadRegions(site.pages.get(pageFile(id, 'en')), site.downloads, page), null, id);
});

test('a built tree carries files/downloads.json; siteFolderProblems notices it missing, broken or another list', (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const out = mkdtempSync(path.join(os.tmpdir(), 'downloads-shared-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));
  const built = buildSite({ root });
  const folder = writeSite(built, out);
  const listFile = path.join(folder, ...IMAGE_LIST_FILE.split('/'));
  assert.equal(readFileSync(listFile, 'utf8'), formatDownloads(fixtureDownloads()));
  assert.deepEqual(siteFolderProblems(folder), []);
  rmSync(listFile);
  assert.deepEqual(siteFolderProblems(folder), [`${IMAGE_LIST_FILE} is missing (the hosted server reads the list of the installers from it)`]);
  writeFileSync(listFile, '{ not json');
  assert.match(siteFolderProblems(folder)[0], /^files\/downloads\.json: cannot read it \(/);
  writeFileSync(listFile, formatDownloads({ ...fixtureDownloads(), mac: [] }));
  assert.deepEqual(siteFolderProblems(folder), [`${IMAGE_LIST_FILE}: "mac" must be a list with at least one file`]);
  const other = fixtureDownloads();
  other.android[0].sha256 = 'cd'.repeat(32);
  writeFileSync(listFile, formatDownloads(other));
  assert.deepEqual(siteFolderProblems(folder), [`${IMAGE_LIST_FILE} does not list exactly the files of the Downloads page`]);
  writeFileSync(listFile, formatDownloads(fixtureDownloads()));
  assert.deepEqual(siteFolderProblems(folder), []);
});

test('a built tree carries files/store-links.json - the store links of site/settings.json for the hosted server; siteFolderProblems notices it missing or broken', (t) => {
  assert.equal(STORE_LINKS_FILE, 'files/store-links.json');
  assert.deepEqual(STORE_LINK_KEYS, ['googlePlay', 'appStoreIphone', 'appStoreMac', 'microsoftStore']);
  // One key per line, every key present; anything that is not a string is null.
  assert.equal(formatStoreLinks(null), '{\n  "googlePlay": null,\n  "appStoreIphone": null,\n  "appStoreMac": null,\n  "microsoftStore": null\n}\n');
  assert.deepEqual(JSON.parse(formatStoreLinks({ googlePlay: 'https://play.google.com/store/apps/details?id=app.example', appStoreIphone: 7 })), {
    googlePlay: 'https://play.google.com/store/apps/details?id=app.example',
    appStoreIphone: null,
    appStoreMac: null,
    microsoftStore: null,
  });
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const out = mkdtempSync(path.join(os.tmpdir(), 'downloads-shared-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));
  const links = { googlePlay: 'https://play.google.com/store/apps/details?id=app.example', appStoreIphone: null, appStoreMac: null, microsoftStore: null };
  const built = buildSite({ root, siteSettings: { ...readSiteSettings(root), links } });
  const folder = writeSite(built, out);
  const linksFile = path.join(folder, ...STORE_LINKS_FILE.split('/'));
  assert.deepEqual(JSON.parse(readFileSync(linksFile, 'utf8')), links, 'the links the site was built with');
  assert.deepEqual(siteFolderProblems(folder), []);
  rmSync(linksFile);
  assert.deepEqual(siteFolderProblems(folder), [`${STORE_LINKS_FILE} is missing (the hosted server reads the store links from it)`]);
  writeFileSync(linksFile, '{ not json');
  assert.match(siteFolderProblems(folder)[0], /^files\/store-links\.json: cannot read it \(/);
  for (const bad of [{ googlePlay: null }, { ...links, other: null }, { ...links, googlePlay: 'http://play.google.com/x' }, []]) {
    writeFileSync(linksFile, JSON.stringify(bad));
    assert.deepEqual(siteFolderProblems(folder), [`${STORE_LINKS_FILE}: must hold googlePlay, appStoreIphone, appStoreMac, microsoftStore, each null or an https link`], JSON.stringify(bad));
  }
  writeFileSync(linksFile, formatStoreLinks(links));
  assert.deepEqual(siteFolderProblems(folder), []);
});
