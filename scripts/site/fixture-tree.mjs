/**
 * scripts/site/fixture-tree.mjs - a complete, small source tree for the tests of the site builder
 * (build-site.test.mjs, add-download.test.mjs). Not a test itself and not used by any build.
 *
 *   const root = fixture();            // a temp folder that buildSite({ root }) builds without a warning
 *   ...                                // break something in it, build, look at the problems
 *   rmSync(root, { recursive: true, force: true });
 *
 * The tree holds the real English texts for every locale, the real theme tokens, icon and site.js, and stand-ins
 * for everything that is large or belongs to the owner: fictional settings and a fictional server, fake PNG
 * headers of the right sizes (the builder reads the IHDR chunk only), two short legal documents per locale that
 * use every placeholder, and three small "installer" files with a true size and SHA-256.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LOCALES } from '../legal/build-pages.mjs';
import { contentFile, DOWNLOADS_DIR, DOWNLOADS_FILE, formatDownloads, ICON_IMAGE, legalSourceFile, LEGAL_KINDS, MARKER_KEY, ROOT, SCRIPT_FILE, SETTINGS_FILE, SHARE_IMAGE, shotsOf, TOKENS_FILE, UNTRANSLATED_MARKER } from './build-site.mjs';

/** Fictional values: the owner's are never written into a test. */
export const FILLED = { publisherName: 'Example Publisher', contactEmail: 'help@example.test', effectiveDate: '2026-11-08', termsEffectiveDate: '2026-11-12', minimumAge: 16 };
export const NO_LINKS = { googlePlay: null, appStoreIphone: null, appStoreMac: null, microsoftStore: null };
export const SITE_SETTINGS = { siteBaseUrl: null, copyrightYear: 2026, links: NO_LINKS };
export const FIXTURE_HOST = 'https://diary.example';
export const CODES = LOCALES.map((l) => l.code);

export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
export const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/** Writes a file and the folders above it. */
export function write(file, content) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

/** A PNG header: signature + IHDR (width, height) + IEND. */
export function fakePng(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 2;
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    return Buffer.concat([len, Buffer.from(type, 'latin1'), body, Buffer.alloc(4)]);
  };
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', data), chunk('IEND', Buffer.alloc(0))]);
}

/** The stand-in installers of a fixture tree: one row per platform, version 1.0.0. */
export const FIXTURE_FILES = {
  windows: { version: '1.0.0', date: '2026-11-13', file: 'YourPersonalDiary-1.0.0-windows-x64-setup.exe', text: 'a stand-in for the Windows setup file\n' },
  android: { version: '1.0.0', date: '2026-11-13', file: 'YourPersonalDiary-1.0.0-android.apk', text: 'a stand-in for the Android package, a little longer than the others\n' },
  mac: { version: '1.0.0', date: '2026-11-13', file: 'YourPersonalDiary-1.0.0-mac-universal.dmg', text: 'a stand-in for the Mac disk image\n' },
};

/** The downloads list of the stand-in installers, as site/downloads.json holds it. */
export function fixtureDownloads() {
  return Object.fromEntries(
    Object.entries(FIXTURE_FILES).map(([platform, { text, ...row }]) => [platform, [{ ...row, bytes: Buffer.byteLength(text), sha256: sha256(text) }]]),
  );
}

/** A short legal document that uses every placeholder a real one may use. */
export function legalSource(kind) {
  const name = kind === 'terms' ? 'Terms of Use' : 'Privacy Policy';
  return [
    '---',
    `title: ${name} - Your Personal Diary`,
    `description: The fixture ${name.toLowerCase()} of the site tests.`,
    'languages: Languages',
    'otherPage: The other page',
    '---',
    '',
    `# ${name} - Your Personal Diary`,
    '',
    `Effective date: ${kind === 'terms' ? '{{TERMS_EFFECTIVE_DATE}}' : '{{EFFECTIVE_DATE}}'}`,
    '',
    '## 1. Who we are',
    '',
    'The service is operated by {{PUBLISHER_NAME}}. Contact: [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}). The website: [{{SITE_URL}}]({{SITE_URL}}).',
    '',
    '## 2. The other documents',
    '',
    '- The policy: [{{PRIVACY_URL}}]({{PRIVACY_URL}}), and in words: the [Privacy Policy]({{PRIVACY_URL}}).',
    '- The terms: [{{TERMS_URL}}]({{TERMS_URL}}), and in words: the [Terms of Use]({{TERMS_URL}}).',
    '- Support: [{{SUPPORT_URL}}]({{SUPPORT_URL}}). Deleting an account: [{{DELETE_URL}}]({{DELETE_URL}}).',
    '',
    '### 2.1 Age',
    '',
    'You must be at least {{MINIMUM_AGE}} years old. Open **Settings** and type `shasum -a 256`.',
    '',
  ].join('\n');
}

/**
 * Writes a complete fixture tree into a new temp folder and returns the folder.
 *   marked    the locales whose content file is an English copy that still waits ("_status", keys: "all")
 *   settings  legal/settings.json
 *   site      site/settings.json
 *   downloads site/downloads.json (the files of FIXTURE_FILES are always written)
 */
export function fixture({ marked = [], settings = FILLED, site = SITE_SETTINGS, downloads = fixtureDownloads() } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'site-tree-'));
  write(path.join(root, 'legal', 'settings.json'), JSON.stringify(settings));
  write(path.join(root, SETTINGS_FILE), JSON.stringify(site));
  write(path.join(root, 'src', 'config', 'server-default.json'), JSON.stringify({ url: FIXTURE_HOST }));
  for (const file of [TOKENS_FILE, ICON_IMAGE.source, SCRIPT_FILE]) write(path.join(root, file), readFileSync(path.join(ROOT, file)));
  write(path.join(root, SHARE_IMAGE.source), fakePng(SHARE_IMAGE.width, SHARE_IMAGE.height));
  write(path.join(root, DOWNLOADS_FILE), formatDownloads(downloads));
  for (const { file, text } of Object.values(FIXTURE_FILES)) write(path.join(root, DOWNLOADS_DIR, file), text);
  const base = readJson(contentFile(ROOT, 'en'));
  for (const code of CODES) {
    const content = marked.includes(code) ? { [MARKER_KEY]: { marker: UNTRANSLATED_MARKER, keys: 'all' }, ...base } : base;
    write(contentFile(root, code), `${JSON.stringify(content, null, 2)}\n`);
    for (const shot of shotsOf(code)) write(path.join(root, shot.source), fakePng(shot.width, shot.height));
    for (const kind of LEGAL_KINDS) write(legalSourceFile(root, kind, code), legalSource(kind));
  }
  return root;
}
