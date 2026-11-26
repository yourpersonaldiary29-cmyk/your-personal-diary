/**
 * scripts/site/downloads-shared.mjs - the installer list of the public site's Downloads page and the markup of its
 * rows, shared by the site builder (build-site.mjs, add-download.mjs) and the hosted server
 * (server/src/hosted/downloads.ts; docs/server-tasks/SERVER-CARD-V2.md Part A).
 *
 * The list: { windows: [row, ...], android: [...], mac: [...] }, each row { version, date, file, bytes, sha256 }, the
 * newest version first. It lives in three places with the same shape:
 *   site/downloads.json                 the project (scripts/site/add-download.mjs maintains it)
 *   ui/about/files/downloads.json       the hosted image: the builder writes the list it built the pages from next
 *                                       to the installers (IMAGE_LIST_FILE, relative to the top of the site)
 *   /data/site/downloads.json           the volume: the files the owner uploaded in the Server card
 * The hosted server merges the last two and never serves the list file itself.
 *
 * The markup: each platform panel of a Downloads page holds three regions between HTML comments - the rows of the
 * table, the checksum list and the empty-state text:
 *
 *   <!-- downloads:windows:rows -->      one <tr> per row               <!-- /downloads:windows:rows -->
 *   <!-- downloads:windows:sums -->      one <dt><dd> per row           <!-- /downloads:windows:sums -->
 *   <!-- downloads:windows:empty -->     <p class="empty" hidden>...</p> <!-- /downloads:windows:empty -->
 *
 * The builder writes them with downloadRegions(); the hosted server replaces them with replaceDownloadRegions() for
 * the list it merged - the same function, so an unchanged list gives the builder's page byte for byte, and another
 * list gives exactly the page the builder would have written for it. The empty-state text (downloads.empty of the
 * content files) is always in the page, hidden while the platform has a file: the server takes it from there and
 * never needs the content files.
 *
 * No import of any kind: the hosted bundle carries this file, and the builder runs it under plain Node.
 */

/** The folder of the installers inside the site, and the list the builder writes next to them. */
export const FILES_DIR = 'files';
export const IMAGE_LIST_FILE = `${FILES_DIR}/downloads.json`;
/**
 * The store links of site/settings.json (`links`, the ONE place for them), written by the builder next to the list
 * of the installers - { googlePlay, appStoreIphone, appStoreMac, microsoftStore }, each an https address or null -
 * so that the hosted server knows them at run time without the owner typing a link a second time: the required
 * update (server/src/hosted/app-update.ts) gives the phone apps the link of their store. Never served itself.
 */
export const STORE_LINKS_FILE = `${FILES_DIR}/store-links.json`;
/** The keys of STORE_LINKS_FILE, in order (the keys of `links` in site/settings.json). */
export const STORE_LINK_KEYS = ['googlePlay', 'appStoreIphone', 'appStoreMac', 'microsoftStore'];

/** The text of STORE_LINKS_FILE for `links` (missing keys are null), one key per line. */
export function formatStoreLinks(links) {
  const lines = STORE_LINK_KEYS.map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(typeof links?.[key] === 'string' ? links[key] : null)}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

/** The platforms of the Downloads page, in tab order, and the kind of file each one lists. */
export const DOWNLOAD_PLATFORMS = {
  windows: { extension: '.exe' },
  android: { extension: '.apk' },
  mac: { extension: '.dmg' },
};
export const PLATFORMS = Object.keys(DOWNLOAD_PLATFORMS);
export const DOWNLOAD_ROW_KEYS = ['version', 'date', 'file', 'bytes', 'sha256'];

/** The public name of the installer of a platform and a version: what the visitor's browser saves. */
export const PUBLIC_NAMES = {
  windows: (version) => `YourPersonalDiary-${version}-windows-x64-setup.exe`,
  android: (version) => `YourPersonalDiary-${version}-android.apk`,
  mac: (version) => `YourPersonalDiary-${version}-mac-universal.dmg`,
};

const VERSION_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
/** A published file name: ASCII letters, digits, dots and hyphens; it is what the visitor's browser saves. */
const FILE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9.-]{0,99}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const isVersion = (value) => typeof value === 'string' && VERSION_RE.test(value);
export const isIsoDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
export const isFileName = (value) => typeof value === 'string' && FILE_NAME_RE.test(value);
export const isSha256 = (value) => typeof value === 'string' && SHA256_RE.test(value);

/** Compares two x.y.z versions: negative when a is older than b. */
export function compareVersions(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/**
 * What is wrong with a downloads object (empty when it is valid): the shape only, not the files. The site needs
 * at least one file for every platform; scripts/site/add-download.mjs, which fills the lists one by one, and the
 * hosted server, whose volume list starts empty, pass `allowEmpty`.
 */
export function downloadsProblems(raw, { allowEmpty = false } = {}) {
  if (!isObject(raw)) return ['not a JSON object'];
  const problems = [];
  for (const platform of PLATFORMS) if (!(platform in raw)) problems.push(`"${platform}" is missing`);
  for (const key of Object.keys(raw)) if (!PLATFORMS.includes(key)) problems.push(`unknown key "${key}"`);
  const seen = new Map();
  for (const platform of PLATFORMS) {
    if (!(platform in raw)) continue;
    const rows = raw[platform];
    if (!Array.isArray(rows) || !(rows.length || allowEmpty)) {
      problems.push(`"${platform}" must be a list with at least one file`);
      continue;
    }
    const { extension } = DOWNLOAD_PLATFORMS[platform];
    let ordered = true;
    rows.forEach((row, i) => {
      const where = `${platform}[${i}]`;
      if (!isObject(row)) {
        problems.push(`${where} must be an object`);
        ordered = false;
        return;
      }
      for (const key of DOWNLOAD_ROW_KEYS) if (!(key in row)) problems.push(`${where}.${key} is missing`);
      for (const key of Object.keys(row)) if (!DOWNLOAD_ROW_KEYS.includes(key)) problems.push(`unknown key ${where}.${key}`);
      if ('version' in row && !isVersion(row.version)) problems.push(`${where}.version must look like 1.0.0`);
      if ('date' in row && !isIsoDate(row.date)) problems.push(`${where}.date must look like 2026-11-13`);
      if ('file' in row) {
        if (!isFileName(row.file)) problems.push(`${where}.file may hold only ASCII letters, digits, dots and hyphens`);
        else if (!row.file.toLowerCase().endsWith(extension)) problems.push(`${where}.file must end with ${extension}`);
        else if (seen.has(row.file.toLowerCase())) problems.push(`${where}.file repeats ${seen.get(row.file.toLowerCase())}`);
        else seen.set(row.file.toLowerCase(), where);
      }
      if ('bytes' in row && !(Number.isInteger(row.bytes) && row.bytes > 0)) problems.push(`${where}.bytes must be the size of the file in bytes`);
      if ('sha256' in row && !isSha256(row.sha256)) problems.push(`${where}.sha256 must be 64 lower-case hexadecimal digits`);
      if (!isVersion(row.version)) ordered = false;
    });
    if (ordered) {
      for (let i = 1; i < rows.length; i += 1) {
        if (compareVersions(rows[i - 1].version, rows[i].version) <= 0) {
          problems.push(`"${platform}": ${rows[i].version} stands after ${rows[i - 1].version} - the newest version comes first, and each version once`);
        }
      }
    }
  }
  return problems;
}

/** The rows of a valid downloads object with exactly the keys of a row, in their order. */
export function cleanDownloads(raw) {
  return Object.fromEntries(PLATFORMS.map((platform) => [platform, raw[platform].map((row) => Object.fromEntries(DOWNLOAD_ROW_KEYS.map((key) => [key, row[key]])))]));
}

/** The text of a downloads object as site/downloads.json holds it: one row per line. */
export function formatDownloads(downloads) {
  const lists = PLATFORMS.map((platform) => {
    const rows = downloads[platform].map((row) => `    { ${DOWNLOAD_ROW_KEYS.map((key) => `${JSON.stringify(key)}: ${JSON.stringify(row[key])}`).join(', ')} }`);
    return `  ${JSON.stringify(platform)}: [${rows.length ? `\n${rows.join(',\n')}\n  ` : ''}]`;
  });
  return `{\n${lists.join(',\n')}\n}\n`;
}

// ---------------------------------------------------------------------------------------------
// The markup
// ---------------------------------------------------------------------------------------------

/** The escaping of the pages (the same function as escapeHtml of scripts/legal/build-pages.mjs; a test keeps them equal). */
export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A run of Latin letters and digits with the spaces and marks between them: one left-to-right fragment. */
const LATIN_RUN = /[\p{Script=Latin}\d](?:[\p{Script=Latin}\d .,:/+'&#@_-]*[\p{Script=Latin}\d%])?/gu;

/** Escapes a text of a right-to-left page and isolates every Latin-only fragment and number in <bdi>. */
export function isolateLatin(text) {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(LATIN_RUN)) {
    out += `${escapeHtml(text.slice(last, m.index))}<bdi>${escapeHtml(m[0])}</bdi>`;
    last = m.index + m[0].length;
  }
  return out + escapeHtml(text.slice(last));
}

/**
 * A relative address from the folder `fromDir` to `target`, both relative to the top of the site:
 * ('he/terms/', 'he/faq/') -> '../faq/', ('', 'he/') -> './he/', ('he/terms/', 'site.css') -> '../../site.css'.
 */
export function relativeHref(fromDir, target) {
  const from = fromDir.split('/').filter(Boolean);
  const to = target.split('/');
  const file = to.pop();
  let common = 0;
  while (common < from.length && common < to.length && from[common] === to[common]) common += 1;
  const rel = `${'../'.repeat(from.length - common)}${to.slice(common).map((segment) => `${segment}/`).join('')}${file}`;
  return rel.startsWith('../') ? rel : `./${rel}`;
}

/** A size in megabytes (1024 x 1024 bytes, as the app counts them) with one decimal, in the form of the language. */
export function megabytes(bytes, intl) {
  return new Intl.NumberFormat(intl, { style: 'unit', unit: 'megabyte', unitDisplay: 'short', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bytes / (1024 * 1024));
}

/** The three list regions of a platform panel, in the order they stand in the page. */
export const DOWNLOAD_REGIONS = ['rows', 'empty', 'sums'];

/** The comment that opens (or, with `end`, closes) a region: <!-- downloads:windows:rows -->. */
export function downloadMarker(platform, region, end = false) {
  return `<!-- ${end ? '/' : ''}downloads:${platform}:${region} -->`;
}

/** A fixed left-to-right fragment (a file name): isolated in every language. */
const ltr = (text) => `<bdi dir="ltr">${escapeHtml(text)}</bdi>`;

/**
 * One row of a download table. `page`: dir = the folder of the page relative to the top of the site
 * ('downloads/', 'he/downloads/'), rtl = a right-to-left page, intl = the number format of its language.
 */
export function downloadRowHtml(row, page) {
  const literal = page.rtl ? isolateLatin : escapeHtml;
  const href = relativeHref(page.dir, `${FILES_DIR}/${row.file}`);
  return `<tr data-file="${escapeHtml(row.file)}" data-bytes="${row.bytes}" data-sha256="${escapeHtml(row.sha256)}"><th scope="row"><a class="get" href="${escapeHtml(href)}" download>${ltr(row.file)}</a></th><td>${literal(row.version)}</td><td>${literal(megabytes(row.bytes, page.intl))}</td></tr>`;
}

/** One entry of the checksum list. */
export function downloadSumHtml(row) {
  return `<dt>${ltr(row.file)}</dt><dd><code dir="ltr">${escapeHtml(row.sha256)}</code></dd>`;
}

/**
 * The three regions of a platform panel for `rows`, each with its two markers: { rows, empty, sums }. `page` as for
 * downloadRowHtml, plus emptyHtml = the empty-state text as HTML (the builder renders downloads.empty; the server
 * takes it from the page).
 */
export function downloadRegions(platform, rows, page) {
  const wrap = (region, inner) => `${downloadMarker(platform, region)}${inner}\n${downloadMarker(platform, region, true)}`;
  return {
    rows: wrap('rows', rows.map((row) => `\n${downloadRowHtml(row, page)}`).join('')),
    empty: wrap('empty', `\n<p class="empty"${rows.length ? ' hidden' : ''}>${page.emptyHtml}</p>`),
    sums: wrap('sums', rows.map((row) => `\n${downloadSumHtml(row)}`).join('')),
  };
}

const regionPattern = () => /<!-- downloads:(windows|android|mac):(rows|empty|sums) -->([\s\S]*?)\n<!-- \/downloads:\1:\2 -->/g;
const EMPTY_RE = /^\n<p class="empty"(?: hidden)?>([\s\S]*)<\/p>$/;

/**
 * A built Downloads page with its list regions written for `downloads` instead (the rows of every platform; a
 * platform without rows shows its empty-state text). `page` = { dir, rtl, intl } of that page. Null when the page
 * does not hold every region exactly once - a page that was not written by this builder: serve it as it is.
 */
export function replaceDownloadRegions(html, downloads, page) {
  const found = new Map();
  for (const m of html.matchAll(regionPattern())) {
    const key = `${m[1]}:${m[2]}`;
    if (found.has(key)) return null;
    found.set(key, m[3]);
  }
  if (found.size !== PLATFORMS.length * DOWNLOAD_REGIONS.length) return null;
  const emptyHtml = {};
  for (const platform of PLATFORMS) {
    const inner = EMPTY_RE.exec(found.get(`${platform}:empty`));
    if (!inner) return null;
    emptyHtml[platform] = inner[1];
  }
  return html.replace(regionPattern(), (whole, platform, region) => downloadRegions(platform, downloads[platform] ?? [], { ...page, emptyHtml: emptyHtml[platform] })[region]);
}
