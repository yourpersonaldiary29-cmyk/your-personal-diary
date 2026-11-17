#!/usr/bin/env node
/**
 * scripts/site/add-download.mjs - puts an installer file on the Downloads page of the public site
 * (docs/site-tasks/SITE.md section 4), or takes one off.
 *
 *   site/downloads.json      the list the page shows: for windows, android and mac one row per version, the
 *                            newest first - { "version", "date", "file", "bytes", "sha256" } (committed)
 *   site/downloads/<file>    the installer files under their public names (NOT committed: git-ignored)
 *
 * Add a file (the three files of a new version = three runs):
 *   node scripts/site/add-download.mjs --platform=<windows|android|mac> --version=<x.y.z> --date=<YYYY-MM-DD> --from=<path of the installer>
 * The file is copied to site/downloads/ under its public name (PUBLIC_NAMES below: ASCII letters, digits, dots
 * and hyphens - it is the name the visitor's browser saves), measured and hashed (SHA-256), and its row is put
 * into the list of its platform, the newest version first. The source file is only read, never changed or moved.
 * A row with the same platform and version is refused; --replace puts the new file in its place.
 *
 * Take a file off:
 *   node scripts/site/add-download.mjs --platform=<windows|android|mac> --version=<x.y.z> --remove
 * The row leaves the list and its file leaves site/downloads/.
 *
 * Then: node scripts/site/build-site.mjs --check (the builder refuses a listed file that is missing or whose size
 * or SHA-256 differs), and a deploy of the hosted server publishes the page with the files (site/README.md).
 *
 * Exit code 0 = done; 1 = refused (a duplicate, a missing or wrong file, a broken list); 2 = usage.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareVersions, DOWNLOAD_PLATFORMS, DOWNLOAD_ROW_KEYS, DOWNLOADS_DIR, DOWNLOADS_FILE, downloadsProblems, fileSha256, formatDownloads, isIsoDate, isVersion, PLATFORMS, ROOT } from './build-site.mjs';

/** The public name of the installer of a platform and a version. */
export const PUBLIC_NAMES = {
  windows: (version) => `YourPersonalDiary-${version}-windows-x64-setup.exe`,
  android: (version) => `YourPersonalDiary-${version}-android.apk`,
  mac: (version) => `YourPersonalDiary-${version}-mac-universal.dmg`,
};

export const USAGE =
  'usage: node scripts/site/add-download.mjs --platform=<windows|android|mac> --version=<x.y.z> --date=<YYYY-MM-DD> --from=<path of the installer> [--replace]\n' +
  '       node scripts/site/add-download.mjs --platform=<windows|android|mac> --version=<x.y.z> --remove';

const slash = (p) => p.split(path.sep).join('/');
const LIST = slash(DOWNLOADS_FILE);

/** A problem the command line reports: code 1 = refused, 2 = usage. */
class Refusal extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

/** The list as it is on disk: the three lists, each may still be empty (a list that does not exist yet = three empty lists). */
function readList(root) {
  const file = path.join(root, DOWNLOADS_FILE);
  if (!existsSync(file)) return Object.fromEntries(PLATFORMS.map((platform) => [platform, []]));
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Refusal(`${LIST}: cannot read it (${e.message})`);
  }
  const problems = downloadsProblems(raw, { allowEmpty: true });
  if (problems.length) throw new Refusal(`${LIST}: ${problems.join('; ')} - repair the file first`);
  return Object.fromEntries(PLATFORMS.map((platform) => [platform, raw[platform].map((row) => Object.fromEntries(DOWNLOAD_ROW_KEYS.map((key) => [key, row[key]])))]));
}

function writeList(root, list) {
  const file = path.join(root, DOWNLOADS_FILE);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, formatDownloads(list), 'utf8');
}

/**
 * Copies `from` into site/downloads/ of `root` under its public name and lists it. Returns the new row.
 * Throws a Refusal when the row exists already (without `replace`) or the source is not a usable file.
 */
export function addDownload({ root = ROOT, platform, version, date, from, replace = false }) {
  const { extension } = DOWNLOAD_PLATFORMS[platform];
  const source = path.resolve(from);
  let stat;
  try {
    stat = statSync(source);
  } catch {
    throw new Refusal(`--from: ${source} does not exist`);
  }
  if (!stat.isFile()) throw new Refusal(`--from: ${source} is not a file`);
  if (!stat.size) throw new Refusal(`--from: ${source} is empty`);
  if (!source.toLowerCase().endsWith(extension)) throw new Refusal(`--from: a ${platform} installer ends with ${extension}; ${path.basename(source)} does not`);

  const list = readList(root);
  const rows = list[platform];
  const existing = rows.findIndex((row) => row.version === version);
  if (existing >= 0 && !replace) {
    throw new Refusal(`${LIST} already lists ${platform} ${version} (${rows[existing].file}, ${rows[existing].date}) - to put this file in its place, add --replace`);
  }

  // Copy first, under a temporary name, and list the file only when the copy is whole.
  const file = PUBLIC_NAMES[platform](version);
  const dir = path.join(root, DOWNLOADS_DIR);
  const target = path.join(dir, file);
  if (path.resolve(target) === source) throw new Refusal(`--from: ${source} is the published copy itself; give the installer as the build wrote it`);
  mkdirSync(dir, { recursive: true });
  const partial = `${target}.part`;
  copyFileSync(source, partial);
  const sha256 = fileSha256(partial);
  if (statSync(partial).size !== stat.size || sha256 !== fileSha256(source)) {
    rmSync(partial, { force: true });
    throw new Refusal(`the copy of ${source} is not the same as the file - try again`);
  }
  renameSync(partial, target);

  const row = { version, date, file, bytes: stat.size, sha256 };
  if (existing >= 0) rows[existing] = row;
  else {
    // The newest version first.
    const before = rows.findIndex((other) => compareVersions(other.version, version) < 0);
    rows.splice(before < 0 ? rows.length : before, 0, row);
  }
  writeList(root, list);
  return row;
}

/** Takes the row of a platform and a version out of the list and deletes its file. Returns the row that left. */
export function removeDownload({ root = ROOT, platform, version }) {
  const list = readList(root);
  const rows = list[platform];
  const index = rows.findIndex((row) => row.version === version);
  if (index < 0) throw new Refusal(`${LIST} lists no ${platform} ${version}`);
  const [row] = rows.splice(index, 1);
  writeList(root, list);
  rmSync(path.join(root, DOWNLOADS_DIR, row.file), { force: true });
  return { row, left: rows.length };
}

/** The command line. Returns the exit code; `root` and `log` are replaced by the tests. */
export function main(argv, { root = ROOT, log = console } = {}) {
  const names = ['--platform', '--version', '--date', '--from'];
  const flags = ['--replace', '--remove'];
  const values = {};
  try {
    for (const arg of argv) {
      const name = names.find((n) => arg.startsWith(`${n}=`));
      if (name) {
        if (name in values) throw new Refusal(`${name} is given twice`, 2);
        values[name] = arg.slice(name.length + 1);
      } else if (!flags.includes(arg)) throw new Refusal(`unknown argument ${arg}`, 2);
    }
    const remove = argv.includes('--remove');
    const replace = argv.includes('--replace');
    const platform = values['--platform'];
    const version = values['--version'];
    if (!PLATFORMS.includes(platform)) throw new Refusal(`--platform must be one of ${PLATFORMS.join(', ')}`, 2);
    if (!isVersion(version)) throw new Refusal('--version must look like 1.0.0', 2);
    if (remove) {
      if (replace || '--date' in values || '--from' in values) throw new Refusal('--remove takes only --platform and --version', 2);
      const { row, left } = removeDownload({ root, platform, version });
      log.log(`add-download: removed ${platform} ${version} (${row.file}) from ${LIST} and from ${slash(DOWNLOADS_DIR)}/`);
      if (!left) log.warn(`add-download: warning - no ${platform} file is listed now; the site cannot be built until one is added`);
      return 0;
    }
    if (!isIsoDate(values['--date'])) throw new Refusal('--date must look like 2026-11-13 (the day the installer was built)', 2);
    if (!values['--from']) throw new Refusal('--from needs the path of the installer file', 2);
    const row = addDownload({ root, platform, version, date: values['--date'], from: values['--from'], replace });
    log.log(`add-download: ${platform} ${row.version} (${row.date}) -> ${slash(DOWNLOADS_DIR)}/${row.file}, ${row.bytes} bytes, SHA-256 ${row.sha256}`);
    log.log(`add-download: ${LIST} updated; check with: node scripts/site/build-site.mjs --check`);
    return 0;
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    log.error(`add-download: ${e.message}${e.code === 2 ? `\n${USAGE}` : ''}`);
    return e.code;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
