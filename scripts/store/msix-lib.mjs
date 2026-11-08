/**
 * Shared helpers of scripts/store/build-msix.mjs and scripts/store/check-msix.mjs
 * (plain Node, no dependencies). See store/MSIX-BUILD.md.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TAURI_DIR = path.join(ROOT, 'src-tauri');
export const RELEASE_DIR = path.join(TAURI_DIR, 'target', 'release');
export const NSIS_SCRIPT = path.join(RELEASE_DIR, 'nsis', 'x64', 'installer.nsi');
export const MANIFEST_TEMPLATE = path.join(TAURI_DIR, 'msix', 'AppxManifest.template.xml');
export const ASSET_OVERRIDE_DIR = path.join(TAURI_DIR, 'msix', 'assets');
export const ICON_SOURCE = path.join(TAURI_DIR, 'icons', 'icon.png');
export const DEFAULT_IDENTITY_FILE = path.join(ROOT, 'store', 'identity.json');
export const DEFAULT_OUT_DIR = path.join(RELEASE_DIR, 'bundle', 'msix');
export const RUST_TARGET_TRIPLE = 'x86_64-pc-windows-msvc';
/** THE one place of the Store package version (store/MSIX-BUILD.md, section 1). */
export const VERSION_FILE = path.join(TAURI_DIR, 'msix', 'package-version.json');
/** Store listing folders (package S1): store/listing/<language tag>/. */
export const LISTING_DIR = path.join(ROOT, 'store', 'listing');

/**
 * Identity of a local TEST package (--test, old name --placeholder). Never upload such a
 * package: Partner Center rejects it, and the build script refuses a Store build with it.
 */
export const PLACEHOLDER_IDENTITY = {
  identityName: 'Placeholder.YourPersonalDiary',
  publisher: 'CN=PLACEHOLDER',
  publisherDisplayName: 'PLACEHOLDER - local test package',
};
/** Appended to the display name of a test package, so that it is never mistaken for the real app. */
export const TEST_DISPLAY_NAME_SUFFIX = ' (TEST)';

export const MIN_WINDOWS_VERSION = '10.0.19041.0';
export const MAX_WINDOWS_VERSION_TESTED = '10.0.26100.0';
export const APPLICATION_ID = 'YourPersonalDiary';
/** The app has 20 UI languages (shared/i18n/locales.ts); the manifest declares each one. */
export const EXPECTED_LANGUAGE_COUNT = 20;

/**
 * The shipped Windows app is a SERVER-ONLY thin client (docs/android-tasks/HOSTED-IMPL.md items 8
 * and 10): the package holds the shell executable and nothing else - the UI is embedded in it.
 * Byte strings the shell executable of the CURRENT release must contain (src-tauri/src):
 */
export const REQUIRED_EXE_MARKERS = [
  {
    text: 'WEBVIEW2_USER_DATA_FOLDER',
    what: 'package-private WebView2 profile (lib.rs redirect_webview_profile_when_packaged)',
  },
  {
    text: 'offline mirror: no local data folder',
    what: 'offline mirror commands (offline.rs; inside the package the mirror lives in the WebView2 profile folder)',
  },
  {
    text: 'msix-store-toast',
    what: 'reminder toasts of the Store package (lib.rs show_store_notification)',
  },
];
/** ...and must NOT contain: these only exist in a local-server (developer) build. */
export const FORBIDDEN_EXE_MARKERS = [
  { text: 'get_server_info', what: 'local-server feature (sidecar commands, Cargo feature "local-server")' },
  { text: 'diary-server', what: 'local-server sidecar (Cargo feature "local-server")' },
  {
    text: "connect-src 'self' http://127.0.0.1:* http://localhost:* ipc:",
    what: 'local-mode content security policy (src-tauri/tauri.local.conf.json)',
  },
];

/**
 * UI language (shared/i18n/locales.ts) -> language tag declared in the manifest. Every tag is
 * in the Microsoft Store list of supported language codes. English is the default (first).
 */
export const MANIFEST_LANGUAGES = {
  en: 'en-US',
  he: 'he-IL',
  zh: 'zh-CN',
  es: 'es-ES',
  pl: 'pl-PL',
  ru: 'ru-RU',
  fr: 'fr-FR',
  ar: 'ar-SA',
  ja: 'ja-JP',
  tr: 'tr-TR',
  cs: 'cs-CZ',
  hu: 'hu-HU',
  bg: 'bg-BG',
  el: 'el-GR',
  pt: 'pt-PT',
  de: 'de-DE',
  ro: 'ro-RO',
  it: 'it-IT',
  th: 'th-TH',
  hi: 'hi-IN',
};

/** Files that must never be inside the package (matched against the lower-cased relative path). */
export const FORBIDDEN_FILE_PATTERNS = [
  { re: /(^|\/)uninstall\.exe$/, why: 'NSIS uninstaller' },
  { re: /(^|\/)install-locale\.txt$/, why: 'NSIS installer language file' },
  { re: /\.(nsi|nsh)$/, why: 'NSIS script' },
  { re: /\.(msi|wixobj|wixpdb|wxs)$/, why: 'MSI / WiX file' },
  { re: /\.pdb$/, why: 'debug symbols' },
  { re: /\.(pfx|p12|pvk|cer|snk|key|pem)$/, why: 'certificate or key file' },
  { re: /(^|\/)appxsignature\.p7x$/, why: 'package signature (the Store signs the package)' },
  { re: /(^|\/)microsoftedgewebview2(setup|runtimeinstaller[^/]*)\.exe$/, why: 'WebView2 installer' },
  { re: /\.(mpd|mpd\.prev|mpd\.tmp)$/, why: 'diary data' },
  { re: /(^|\/)(accounts|sessions|resets|server-settings)\.json$/, why: 'diary data' },
  { re: /(^|\/)device\.key$/, why: 'diary data' },
  { re: /(^|\/)server\.log(\.1)?$/, why: 'log file' },
  // The thin client ships no local server: no sidecar, no Node.js, no server resources, no loose UI.
  { re: /(^|\/)diary-server(-[^/]*)?(\.exe)?$/, why: 'local server sidecar (the Store app is a thin client)' },
  { re: /(^|\/)node(\.exe)?$/, why: 'Node.js runtime (the Store app is a thin client)' },
  { re: /^(resources\/)?server\//, why: 'local server resources (the Store app is a thin client)' },
  { re: /\.(cjs|mjs|js|node|wasm)$/, why: 'server / Node.js code (the UI is embedded in the shell executable)' },
  { re: /\.(html?|css|ttf|otf|woff2?)$/, why: 'loose UI or server font file (the UI is embedded in the shell executable)' },
];

/** File names of the server half; check-msix reports "no server files" with this list. */
export const SERVER_FILE_HINTS = ['diary-server.exe', 'node.exe', 'server/', '*.cjs', '*.js', '*.wasm', '*.node', 'loose UI / fonts'];

/** Package files written by makeappx / makepri (not part of the application payload). */
export const PACKAGE_METADATA_FILES = ['AppxManifest.xml', 'AppxBlockMap.xml', '[Content_Types].xml', 'resources.pri'];

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

export function readTauriConf() {
  return readJson(path.join(TAURI_DIR, 'tauri.conf.json'));
}

/** `--name value` / `--name=value` / boolean `--flag` command line parser. */
export function parseArgs(argv, { booleans = [], values = [] }) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const name = eq > 0 ? arg.slice(2, eq) : arg.slice(2);
    if (booleans.includes(name)) {
      if (eq > 0) throw new Error(`--${name} takes no value`);
      out[name] = true;
    } else if (values.includes(name)) {
      if (eq > 0) out[name] = arg.slice(eq + 1);
      else if (i + 1 < argv.length) out[name] = argv[(i += 1)];
      else throw new Error(`--${name} needs a value`);
    } else {
      throw new Error(`unknown option --${name}`);
    }
  }
  return out;
}

/** Recursive file list of a directory: relative paths with forward slashes, sorted. */
export function listFiles(dir) {
  const out = [];
  const walk = (current, prefix) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(current, entry.name), rel);
      else out.push(rel);
    }
  };
  walk(dir, '');
  return out.sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0));
}

export function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * What tauri.conf.json says the installers contain: the main executable, the external binaries
 * (sidecar) and the resource trees. Returns [{ dest, src }] with `dest` relative to the install
 * directory (forward slashes).
 */
export function payloadFromTauriConf(conf = readTauriConf()) {
  const payload = [];
  const mainName = `${conf.mainBinaryName || conf.productName}.exe`;
  payload.push({ dest: mainName, src: path.join(RELEASE_DIR, mainName) });

  for (const bin of conf.bundle?.externalBin ?? []) {
    const name = path.basename(bin);
    payload.push({ dest: `${name}.exe`, src: path.join(TAURI_DIR, `${bin}-${RUST_TARGET_TRIPLE}.exe`) });
  }

  const resources = conf.bundle?.resources ?? {};
  if (Array.isArray(resources)) {
    throw new Error('tauri.conf.json bundle.resources is a list; this script supports the { "source/": "target/" } map only');
  }
  for (const [from, to] of Object.entries(resources)) {
    if (/[*?[\]{}]/.test(from)) throw new Error(`bundle.resources "${from}": glob patterns are not supported by this script`);
    const srcPath = path.join(TAURI_DIR, from);
    if (!fs.existsSync(srcPath)) throw new Error(`bundle.resources "${from}": ${srcPath} does not exist`);
    if (fs.statSync(srcPath).isDirectory()) {
      const target = to.replace(/\\/g, '/').replace(/\/+$/, '');
      for (const rel of listFiles(srcPath)) {
        payload.push({ dest: target ? `${target}/${rel}` : rel, src: path.join(srcPath, rel) });
      }
    } else {
      payload.push({ dest: to.replace(/\\/g, '/'), src: srcPath });
    }
  }
  return payload;
}

/**
 * Why `conf` is not the thin client's configuration (empty array = fine). A sidecar
 * (bundle.externalBin) or bundled resources mean the local-server developer configuration
 * (src-tauri/tauri.local.conf.json merged in), which is never published.
 */
export function thinClientProblems(conf = readTauriConf()) {
  const problems = [];
  const bins = conf.bundle?.externalBin ?? [];
  if (bins.length > 0) {
    problems.push(`bundle.externalBin lists ${bins.join(', ')} (a sidecar): the Store app is the server-only thin client`);
  }
  const res = conf.bundle?.resources;
  const resourceCount = Array.isArray(res) ? res.length : res ? Object.keys(res).length : 0;
  if (resourceCount > 0) {
    problems.push(`bundle.resources is not empty (${JSON.stringify(res)}): the thin client ships no resources`);
  }
  return problems;
}

/**
 * What the generated NSIS script installs (src-tauri/target/release/nsis/x64/installer.nsi):
 * the main executable and every `File /a "/oname=<dest>" "<src>"` line. The uninstaller
 * (WriteUninstaller), the WebView2 bootstrapper (extracted to $TEMP) and install-locale.txt
 * (written by a hook at install time) are not `File /a` lines and are therefore not listed.
 */
export function payloadFromNsis(nsiFile = NSIS_SCRIPT) {
  let text = fs.readFileSync(nsiFile, 'utf8');
  if (text.includes('\u0000')) text = fs.readFileSync(nsiFile, 'utf16le');
  text = text.replace(/^\uFEFF/, '');
  const payload = [];
  const main = /^\s*!define\s+MAINBINARYSRCPATH\s+"([^"]+)"/m.exec(text);
  if (!main) throw new Error(`${nsiFile}: MAINBINARYSRCPATH not found`);
  payload.push({ dest: path.win32.basename(main[1]), src: main[1] });
  const fileLine = /^\s*File\s+\/a\s+"\/oname=([^"]+)"\s+"([^"]+)"\s*$/gm;
  let m;
  while ((m = fileLine.exec(text)) !== null) {
    if (m[1].includes('$')) continue; // extracted to an NSIS variable location, not the install dir
    payload.push({ dest: m[1].replace(/\\/g, '/'), src: m[2] });
  }
  return payload;
}

const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/** `YYYY-MM-DD HH:mm:ss` in local time (what Explorer shows). */
const stamp = (ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/**
 * What `npm run tauri:build` compiles INTO the thin client's shell executable (paths relative to
 * the project root; folders are walked). The UI: `npm run build` (`tsc && vite build`) turns these
 * into frontendDist (dist/), which tauri-codegen embeds in the executable. The shell: cargo
 * compiles these (src-tauri/src/opener.rs also includes src/config/server-default.json).
 */
export const UI_BUILD_INPUTS = ['index.html', 'vite.config.ts', 'tsconfig.json', 'package.json', 'package-lock.json', 'src', 'shared', 'public'];
export const SHELL_BUILD_INPUTS = [
  'src-tauri/src',
  'src-tauri/build.rs',
  'src-tauri/Cargo.toml',
  'src-tauri/Cargo.lock',
  'src-tauri/tauri.conf.json',
  'src-tauri/capabilities',
  'src-tauri/icons',
];
/** Not part of the release build: test files and folders, installed packages. */
const NOT_BUILT_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/i;
const NOT_BUILT_DIRS = new Set(['node_modules', 'test', 'tests', '__tests__', 'test-utils']);

/** The UI folder tauri.conf.json `build.frontendDist` names (absolute). */
export function frontendDistDir(conf = readTauriConf()) {
  const dist = conf.build?.frontendDist;
  // A URL (a scheme of 2+ letters; `C:` is a drive) means a dev server, nothing embedded.
  if (typeof dist !== 'string' || /^[a-z][a-z0-9+.-]+:/i.test(dist)) {
    throw new Error(`tauri.conf.json build.frontendDist must be a folder (it is ${JSON.stringify(dist)}): the Store app embeds its UI`);
  }
  return path.resolve(TAURI_DIR, dist);
}

/**
 * Is the UI in `distDir` the one embedded in `exeFile`? tauri-codegen stores every file of
 * frontendDist in the executable under its path (`/index.html`, `/assets/index-<hash>.js`, ...),
 * and Vite names the bundles after a hash of their content - so a rebuilt UI has file names the
 * executable does not contain. Returns { checked, problems } (problems empty = same UI).
 */
export function embeddedUiProblems(exeFile, distDir) {
  const exeName = path.basename(exeFile);
  const distName = path.relative(ROOT, distDir).replace(/\\/g, '/') || distDir;
  if (!fs.existsSync(distDir)) return { checked: 0, problems: [`${distName} (tauri.conf.json build.frontendDist) does not exist`] };
  const bytes = fs.readFileSync(exeFile);
  const files = listFiles(distDir);
  const problems = [];
  const notEmbedded = files.filter((rel) => !bytes.includes(Buffer.from(`/${rel}`, 'utf8')));
  if (notEmbedded.length > 0) {
    problems.push(
      `${notEmbedded.length} file(s) of ${distName} are not embedded in ${exeName}: ` +
        `${notEmbedded.slice(0, 5).join(', ')}${notEmbedded.length > 5 ? ', ...' : ''}`,
    );
  }
  const onDisk = new Set(files.map((rel) => `/${rel}`.toLowerCase()));
  const embeddedBundles = new Set(bytes.toString('latin1').match(/\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)(?![A-Za-z0-9_.-])/g) ?? []);
  const gone = [...embeddedBundles].filter((key) => !onDisk.has(key.toLowerCase())).sort();
  if (gone.length > 0) problems.push(`${exeName} embeds ${gone.join(', ')}, which ${distName} no longer has`);
  return { checked: files.length, problems };
}

/**
 * Build inputs (UI_BUILD_INPUTS + SHELL_BUILD_INPUTS, test files left out) modified after `timeMs`
 * (the shell executable's time): [{ file, mtimeMs }], newest first. `toleranceMs` absorbs file
 * system timestamp granularity; `base` is the project root (tests pass a temporary one).
 */
export function sourcesNewerThan(timeMs, { roots = [...UI_BUILD_INPUTS, ...SHELL_BUILD_INPUTS], base = ROOT, toleranceMs = 2000 } = {}) {
  const newer = [];
  const visit = (abs, rel) => {
    let st;
    try {
      st = fs.statSync(abs);
    } catch {
      return; // an optional input that does not exist
    }
    if (st.isDirectory()) {
      for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
        if (entry.isDirectory() ? NOT_BUILT_DIRS.has(entry.name) : NOT_BUILT_FILE.test(entry.name)) continue;
        visit(path.join(abs, entry.name), `${rel}/${entry.name}`);
      }
    } else if (st.mtimeMs > timeMs + toleranceMs) {
      newer.push({ file: rel, mtimeMs: st.mtimeMs });
    }
  };
  for (const root of roots) visit(path.join(base, root), root);
  return newer.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/** One message for sourcesNewerThan() results (null when there are none). */
export function describeNewerSources(newer, exeFile, timeMs) {
  if (newer.length === 0) return null;
  const shown = newer.slice(0, 5).map((n) => `${n.file} ${stamp(n.mtimeMs)}`);
  return (
    `${newer.length} UI / shell source file(s) changed after ${path.basename(exeFile)} was built (${stamp(timeMs)}); newest: ` +
    `${shown.join(', ')}${newer.length > 5 ? ', ...' : ''}`
  );
}

/**
 * Is `exeFile` the release build of the CURRENT tree? The thin client's only payload file is the
 * shell executable, with the UI and src-tauri/src compiled into it, so file lists and payload
 * times say nothing about it. Problems (empty array = current): the UI in frontendDist is not
 * the embedded one, or a UI / shell source is newer than the executable.
 */
export function releaseBuildProblems(exeFile, conf = readTauriConf(), options = {}) {
  const problems = [...embeddedUiProblems(exeFile, frontendDistDir(conf)).problems];
  const timeMs = fs.statSync(exeFile).mtimeMs;
  const newer = describeNewerSources(sourcesNewerThan(timeMs, options), exeFile, timeMs);
  if (newer) problems.push(newer);
  return problems;
}

/** Differences between two payload lists (empty array = identical destinations and sources). */
export function comparePayloads(fromConf, fromNsis) {
  const problems = [];
  const nsis = new Map(fromNsis.map((f) => [f.dest.toLowerCase(), f]));
  const conf = new Map(fromConf.map((f) => [f.dest.toLowerCase(), f]));
  for (const f of fromConf) {
    const other = nsis.get(f.dest.toLowerCase());
    if (!other) problems.push(`not installed by the NSIS installer: ${f.dest}`);
    else if (!samePath(other.src, f.src)) problems.push(`different source for ${f.dest}: ${other.src} (installer.nsi) / ${f.src} (tauri.conf.json)`);
  }
  for (const f of fromNsis) {
    if (!conf.has(f.dest.toLowerCase())) problems.push(`installed by the NSIS installer but not found now: ${f.dest}`);
  }
  return problems;
}

/** Why a payload path must not be packaged, or null. */
export function forbiddenReason(relPath) {
  const lower = relPath.replace(/\\/g, '/').toLowerCase();
  const hit = FORBIDDEN_FILE_PATTERNS.find((p) => p.re.test(lower));
  return hit ? hit.why : null;
}

/** The UI language codes in shared/i18n/locales.ts (LOCALES order; 'en' first). */
export function appLocales() {
  const text = fs.readFileSync(path.join(ROOT, 'shared', 'i18n', 'locales.ts'), 'utf8');
  const start = text.indexOf('export const LOCALES');
  if (start < 0) throw new Error('shared/i18n/locales.ts: LOCALES not found');
  const block = text.slice(start, text.indexOf('];', start));
  const codes = [...block.matchAll(/code:\s*'([a-z]{2})'/g)].map((m) => m[1]);
  if (codes.length === 0) throw new Error('shared/i18n/locales.ts: no locale codes found');
  return codes;
}

/** Manifest language tags for the app languages, en-US first. Throws for an unmapped language. */
export function manifestLanguages(codes = appLocales()) {
  const missing = codes.filter((c) => !MANIFEST_LANGUAGES[c]);
  if (missing.length > 0) {
    throw new Error(`no manifest language tag for UI language(s) ${missing.join(', ')}: add them to MANIFEST_LANGUAGES in scripts/store/msix-lib.mjs`);
  }
  const tags = codes.map((c) => MANIFEST_LANGUAGES[c]);
  return ['en-US', ...tags.filter((t) => t !== 'en-US')];
}

/**
 * Store rules for the package version: four numeric parts, each 0..65535, the last one 0
 * (reserved for the Store), the first one not 0. Returns { errors, storeErrors }: `errors` make
 * the package invalid; `storeErrors` only make it unacceptable for a Store submission.
 */
export function validateVersion(version) {
  const errors = [];
  const storeErrors = [];
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) {
    errors.push(`version "${version}" must have four numeric parts (for example 1.0.0.0)`);
    return { errors, storeErrors };
  }
  const parts = version.split('.').map(Number);
  if (parts.some((p) => p > 65535)) errors.push(`version "${version}": every part must be between 0 and 65535`);
  if (version.split('.').some((p) => p.length > 1 && p.startsWith('0'))) errors.push(`version "${version}": parts must not have leading zeros`);
  if (parts[3] !== 0) storeErrors.push(`version "${version}": the fourth part is reserved for the Store and must be 0`);
  if (parts[0] === 0) storeErrors.push(`version "${version}": the Store does not accept a first part of 0 (use 1.0.0.0 or higher)`);
  return { errors, storeErrors };
}

/** The Store package version from src-tauri/msix/package-version.json (its one place). */
export function readPackageVersion(file = VERSION_FILE) {
  const rel = path.relative(ROOT, file);
  const json = readJson(file);
  if (json === null || typeof json !== 'object' || Array.isArray(json)) throw new Error(`${rel}: must be a JSON object`);
  const unknown = Object.keys(json).filter((k) => k !== 'packageVersion' && !k.startsWith('_'));
  if (unknown.length > 0) throw new Error(`${rel}: unknown field(s) ${unknown.join(', ')} (expected "packageVersion")`);
  if (typeof json.packageVersion !== 'string') throw new Error(`${rel}: "packageVersion" is missing (for example "1.0.0.0")`);
  return json.packageVersion;
}

const IDENTITY_FIELDS = ['identityName', 'publisher', 'publisherDisplayName', 'displayName'];

/**
 * store/identity.json (copy of store/identity.example.json): the three Partner Center values and
 * an optional displayName (only when Partner Center reserved another name). Keys starting with
 * "_" are notes and ignored. A "version" field is refused: the version has one place.
 */
export function readIdentityFile(file) {
  const rel = path.relative(ROOT, file);
  const json = readJson(file);
  if (json === null || typeof json !== 'object' || Array.isArray(json)) throw new Error(`${rel}: must be a JSON object`);
  if ('version' in json) {
    throw new Error(`${rel}: remove "version" - the package version has one place: ${path.relative(ROOT, VERSION_FILE)}`);
  }
  const unknown = Object.keys(json).filter((k) => !IDENTITY_FIELDS.includes(k) && !k.startsWith('_'));
  if (unknown.length > 0) {
    throw new Error(`${rel}: unknown field(s) ${unknown.join(', ')} (expected identityName, publisher, publisherDisplayName)`);
  }
  return {
    identityName: json.identityName,
    publisher: json.publisher,
    publisherDisplayName: json.publisherDisplayName,
    displayName: json.displayName,
  };
}

/** Language tags of the Store listing folders that exist (store/listing/<tag>/), sorted. */
export function listingTags(dir = LISTING_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^[a-z]{2,3}(-[A-Za-z]{2,4})?(-[A-Z]{2})?$/.test(e.name))
    .map((e) => e.name)
    .sort();
}

const PUBLISHER_KEY = /^(CN|L|O|OU|E|C|S|STREET|T|G|I|SN|DC|SERIALNUMBER|Description|PostalCode|POBox|Phone|X21Address|dnQualifier|OID\.(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*))+)=.+/;

/** Problems of the three identity values (empty array = fine). `placeholderOk`: test build. */
export function validateIdentity(identity, { placeholderOk = false } = {}) {
  const problems = [];
  const { identityName, publisher, publisherDisplayName } = identity;
  if (typeof identityName !== 'string' || !/^[A-Za-z0-9.-]{3,50}$/.test(identityName) || identityName.endsWith('.')) {
    problems.push('Identity Name: 3-50 characters, only letters, digits, "." and "-" (copy it from Partner Center: Package/Identity/Name)');
  }
  if (typeof publisher !== 'string' || !PUBLISHER_KEY.test(publisher) || publisher.length > 8192) {
    problems.push('Publisher: must be a distinguished name such as "CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" (copy it from Partner Center: Package/Identity/Publisher)');
  }
  if (typeof publisherDisplayName !== 'string' || publisherDisplayName.trim() !== publisherDisplayName || publisherDisplayName.length < 1 || publisherDisplayName.length > 256) {
    problems.push('Publisher display name: 1-256 characters without leading or trailing spaces (Partner Center: Package/Properties/PublisherDisplayName)');
  }
  if (!placeholderOk && problems.length === 0 && isPlaceholderIdentity(identity)) {
    problems.push('the identity values are still placeholders / the example values: use the real values from Partner Center, or pass --placeholder for a test build');
  }
  return problems;
}

/** True for the --placeholder identity and for the values of store/identity.example.json. */
export function isPlaceholderIdentity({ identityName = '', publisher = '', publisherDisplayName = '' }) {
  const all = `${identityName}\n${publisher}\n${publisherDisplayName}`;
  return (
    /placeholder/i.test(all) ||
    /00000000-0000-0000-0000-000000000000/.test(publisher) ||
    /^12345PublisherName\./.test(identityName) ||
    publisherDisplayName === 'Publisher Name'
  );
}

/**
 * The 13-character publisher id Windows derives from the Publisher string (the suffix of the
 * package family name): SHA-256 of the UTF-16LE string, first 8 bytes, base32 with the
 * alphabet 0-9 a-z without i, l, o, u.
 */
export function publisherId(publisher) {
  const hash = crypto.createHash('sha256').update(Buffer.from(publisher, 'utf16le')).digest();
  let bits = '';
  for (let i = 0; i < 8; i += 1) bits += hash[i].toString(2).padStart(8, '0');
  bits += '0'; // 64 bits -> 65 bits = 13 groups of 5
  const alphabet = '0123456789abcdefghjkmnpqrstvwxyz';
  let id = '';
  for (let i = 0; i < 65; i += 5) id += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  return id;
}

export function packageFamilyName(identityName, publisher) {
  return `${identityName}_${publisherId(publisher)}`;
}

export function packageFullName(identityName, version, publisher, arch = 'x64') {
  return `${identityName}_${version}_${arch}__${publisherId(publisher)}`;
}

export function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function xmlUnescape(value) {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** AppxManifest.xml from the template (comments removed, placeholders replaced, values escaped). */
export function renderManifest(template, values) {
  let xml = template.replace(/^\uFEFF/, '').replace(/<!--[\s\S]*?-->\s*/g, '');
  const languages = values.languages.map((tag) => `    <Resource Language="${xmlEscape(tag)}" />`).join('\n');
  const map = {
    IDENTITY_NAME: xmlEscape(values.identityName),
    PUBLISHER: xmlEscape(values.publisher),
    PUBLISHER_DISPLAY_NAME: xmlEscape(values.publisherDisplayName),
    VERSION: xmlEscape(values.version),
    DISPLAY_NAME: xmlEscape(values.displayName),
    DESCRIPTION: xmlEscape(values.description),
    RESOURCE_LANGUAGES: languages,
  };
  xml = xml.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key) => {
    if (!(key in map)) throw new Error(`AppxManifest.template.xml: unknown placeholder ${whole}`);
    return map[key];
  });
  return xml.replace(/\r?\n/g, '\r\n');
}

/** Directory with makeappx.exe / makepri.exe (newest Windows SDK), or `override`. */
export function findSdkBin(override) {
  const candidates = [];
  if (override) candidates.push(override);
  if (process.env.WINDOWS_SDK_BIN) candidates.push(process.env.WINDOWS_SDK_BIN);
  const kits = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Windows Kits', '10', 'bin');
  if (fs.existsSync(kits)) {
    const versions = fs
      .readdirSync(kits)
      .filter((d) => /^\d+\.\d+\.\d+\.\d+$/.test(d))
      .sort((a, b) => {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < 4; i += 1) if (pa[i] !== pb[i]) return pb[i] - pa[i];
        return 0;
      });
    for (const v of versions) candidates.push(path.join(kits, v, 'x64'));
  }
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'makeappx.exe')) && fs.existsSync(path.join(dir, 'makepri.exe'))) return dir;
  }
  throw new Error('makeappx.exe / makepri.exe not found: install the Windows SDK or pass --sdk-bin <folder>');
}

/** Runs a tool, echoes its output (indented), throws when it fails. Returns stdout + stderr. */
export function runTool(exe, args, { quiet = false, label, hide } = {}) {
  const shown = label || `${path.basename(exe)} ${args.join(' ')}`;
  if (!quiet) console.log(`> ${shown}`);
  const res = spawnSync(exe, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  // The SDK tools sometimes emit UTF-16 fragments: drop the NUL bytes so logs stay plain text.
  const output = `${res.stdout || ''}${res.stderr || ''}`.replace(/\u0000/g, '');
  if (!quiet) {
    for (const line of output.split(/\r?\n/)) {
      if (line.trim() && !(hide && hide.test(line))) console.log(`    ${line.trimEnd()}`);
    }
  }
  if (res.error) throw new Error(`${shown}: ${res.error.message}`);
  if (res.status !== 0) {
    if (quiet) console.error(output);
    throw new Error(`${path.basename(exe)} failed with exit code ${res.status}`);
  }
  return output;
}

/** Machine type of a PE file ('x64', 'x86', 'arm64' or a hex number). */
export function peMachine(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(0x40);
    fs.readSync(fd, head, 0, 0x40, 0);
    if (head.toString('latin1', 0, 2) !== 'MZ') throw new Error(`${file}: not an executable`);
    const peOffset = head.readUInt32LE(0x3c);
    const pe = Buffer.alloc(6);
    fs.readSync(fd, pe, 0, 6, peOffset);
    if (pe.toString('latin1', 0, 2) !== 'PE') throw new Error(`${file}: not a PE executable`);
    const machine = pe.readUInt16LE(4);
    return { 0x8664: 'x64', 0x14c: 'x86', 0xaa64: 'arm64' }[machine] || `0x${machine.toString(16)}`;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Is the shell executable the CURRENT thin client? `missing`: REQUIRED_EXE_MARKERS not found
 * (built before the packaged WebView2 profile / offline mirror / Store toast logic), `forbidden`:
 * FORBIDDEN_EXE_MARKERS found (a local-server developer build). Both empty = fine.
 */
export function exeMarkerProblems(exeFile) {
  const bytes = fs.readFileSync(exeFile);
  const has = (text) => bytes.includes(Buffer.from(text, 'utf8'));
  return {
    missing: REQUIRED_EXE_MARKERS.filter((m) => !has(m.text)).map((m) => `"${m.text}" - ${m.what}`),
    forbidden: FORBIDDEN_EXE_MARKERS.filter((m) => has(m.text)).map((m) => `"${m.text}" - ${m.what}`),
  };
}

/**
 * Entry names of a ZIP / MSIX file, read from its central directory (ZIP64 aware). Names are
 * returned as stored (MSIX percent-encodes some characters, e.g. a space is %20).
 */
export function zipEntryNames(file) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`${file}: not a ZIP container`);
  let count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  if (eocd >= 20 && buf.readUInt32LE(eocd - 20) === 0x07064b50) {
    const zip64 = Number(buf.readBigUInt64LE(eocd - 20 + 8));
    if (buf.readUInt32LE(zip64) !== 0x06064b50) throw new Error(`${file}: bad ZIP64 directory`);
    count = Number(buf.readBigUInt64LE(zip64 + 32));
    offset = Number(buf.readBigUInt64LE(zip64 + 48));
  }
  const names = [];
  let pos = offset;
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error(`${file}: bad ZIP central directory`);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    names.push(buf.toString('utf8', pos + 46, pos + 46 + nameLen));
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

export function formatBytes(n) {
  return `${n.toLocaleString('en-US')} bytes (${(n / (1024 * 1024)).toFixed(1)} MB)`;
}
