#!/usr/bin/env node
/**
 * Builds the Microsoft Store package (.msix) of "Your Personal Diary" - the server-only thin
 * client - from the existing release build (run `npm run tauri:build` first). Plain Node, no
 * dependencies; needs the Windows SDK tools makeappx.exe and makepri.exe. The package is NOT
 * signed: the Store signs it.
 *
 *   node scripts/store/build-msix.mjs                Store package; identity from store/identity.json
 *   node scripts/store/build-msix.mjs --test         local TEST package (clearly marked test identity)
 *
 * Options
 *   --identity <file>      identity file instead of store/identity.json (same format, see
 *                          store/identity.example.json)
 *   --test                 local test package: identity "Placeholder.YourPersonalDiary" /
 *                          "CN=PLACEHOLDER", display name "Your Personal Diary (TEST)", file name
 *                          ending in _TEST.msix. Partner Center rejects it; never upload it.
 *                          (--placeholder is the old name of --test.)
 *   --version <a.b.c.0>    test packages only: another version. A Store package always takes the
 *                          version from its one place, src-tauri/msix/package-version.json
 *   --out <file.msix>      output file; default
 *                          src-tauri/target/release/bundle/msix/YourPersonalDiary_<version>_x64[_TEST].msix
 *   --layout <dir>         also keep the unpacked package layout (AppxManifest.xml, resources.pri,
 *                          Assets, the executable) in <dir> - an empty or new folder - e.g. for a
 *                          developer-mode registration test (store/MSIX-BUILD.md, section 3)
 *   --sdk-bin <dir>        folder with makeappx.exe and makepri.exe (default: newest Windows SDK)
 *   --keep-staging         keep the temporary staging folder (printed at the end)
 *   --allow-stale-build    test packages only: package although the executable on disk is not the
 *                          release build of the current tree (its embedded UI differs from dist/,
 *                          or a UI / shell source is newer than it)
 *
 * What it does: refuses a Store package with placeholder identity values or a version the Store
 * rejects; checks that the release build is the thin client (no sidecar, no server resources, no
 * Node.js; the shell contains the packaged WebView2-profile / offline-mirror / Store-toast logic
 * and none of the local-server code) and that the shell is the build of the CURRENT tree (the UI
 * embedded in it is the one in dist/, no UI / shell source is newer than it - otherwise a Store
 * package is refused); stages exactly what the NSIS installer installs (the shell
 * executable - the UI is embedded in it); generates the logo assets; writes AppxManifest.xml
 * from src-tauri/msix/AppxManifest.template.xml with the 20 resource languages; builds
 * resources.pri (makepri) and packs (makeappx). Details: store/MSIX-BUILD.md. Re-check a
 * package with scripts/store/check-msix.mjs.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateAssets } from './msix-assets.mjs';
import {
  ASSET_OVERRIDE_DIR,
  DEFAULT_IDENTITY_FILE,
  DEFAULT_OUT_DIR,
  EXPECTED_LANGUAGE_COUNT,
  ICON_SOURCE,
  MANIFEST_TEMPLATE,
  NSIS_SCRIPT,
  PLACEHOLDER_IDENTITY,
  ROOT,
  TEST_DISPLAY_NAME_SUFFIX,
  VERSION_FILE,
  comparePayloads,
  exeMarkerProblems,
  findSdkBin,
  forbiddenReason,
  formatBytes,
  isPlaceholderIdentity,
  listFiles,
  manifestLanguages,
  packageFamilyName,
  packageFullName,
  parseArgs,
  payloadFromNsis,
  payloadFromTauriConf,
  peMachine,
  publisherId,
  readIdentityFile,
  readPackageVersion,
  readTauriConf,
  releaseBuildProblems,
  renderManifest,
  runTool,
  sha256File,
  thinClientProblems,
  validateIdentity,
  validateVersion,
} from './msix-lib.mjs';

function fail(message) {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

/** Options of the first kit that are gone, with what to do instead. */
const RETIRED_OPTIONS = {
  'identity-name': 'the identity comes from store/identity.json only (or --identity <file>)',
  publisher: 'the identity comes from store/identity.json only (or --identity <file>)',
  'publisher-display-name': 'the identity comes from store/identity.json only (or --identity <file>)',
  'display-name': 'put "displayName" into store/identity.json (only if Partner Center reserved another name)',
  'allow-legacy-exe': 'an old shell executable is never packaged for the Store; rebuild (npm run tauri:build)',
};

function resolveIdentity(args, test) {
  if (test) {
    if (args.identity) fail('--test cannot be combined with --identity');
    return { ...PLACEHOLDER_IDENTITY, displayName: undefined, source: '--test (local test identity)' };
  }
  const identityFile = args.identity ? path.resolve(args.identity) : DEFAULT_IDENTITY_FILE;
  if (!fs.existsSync(identityFile)) {
    fail(
      `no package identity: ${path.relative(ROOT, identityFile)} does not exist.\n` +
        '  - After reserving the name in Partner Center: copy store/identity.example.json to store/identity.json\n' +
        '    and replace the three values with the ones on Product management -> Product identity\n' +
        '    (store/MSIX-BUILD.md, section 1), or\n' +
        '  - pass --test for a local test package (never uploaded).',
    );
  }
  try {
    return { ...readIdentityFile(identityFile), source: path.relative(ROOT, identityFile) };
  } catch (e) {
    return fail(e.message);
  }
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2), {
      booleans: ['test', 'placeholder', 'keep-staging', 'allow-stale-build', 'allow-legacy-exe', 'help'],
      values: ['identity', 'version', 'out', 'layout', 'sdk-bin', 'identity-name', 'publisher', 'publisher-display-name', 'display-name'],
    });
  } catch (e) {
    fail(`${e.message} (see the header of scripts/store/build-msix.mjs for the options)`);
  }
  if (args.help || args._.length > 0) {
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\r?\n/, ''));
    process.exit(args.help ? 0 : 1);
  }
  for (const [name, instead] of Object.entries(RETIRED_OPTIONS)) {
    if (args[name] !== undefined) fail(`--${name} is no longer supported: ${instead}`);
  }
  if (process.platform !== 'win32') fail('this script runs on Windows only (makeappx.exe / makepri.exe)');

  const test = Boolean(args.test || args.placeholder);
  const conf = readTauriConf();
  const identity = resolveIdentity(args, test);
  const warnings = [];
  if (args['allow-stale-build'] && !test) fail('--allow-stale-build is for --test packages only');

  // --- identity: never a placeholder in a Store package --------------------------------------
  const identityProblems = validateIdentity(identity, { placeholderOk: test });
  if (identityProblems.length > 0) fail(`package identity (${identity.source}):\n  - ${identityProblems.join('\n  - ')}`);

  // --- version: one place (src-tauri/msix/package-version.json) -------------------------------
  let version;
  try {
    version = readPackageVersion();
  } catch (e) {
    fail(e.message);
  }
  if (args.version) {
    if (!test) fail(`--version is for --test packages only: a Store package takes its version from ${path.relative(ROOT, VERSION_FILE)}`);
    version = args.version;
  }
  const versionCheck = validateVersion(version);
  if (versionCheck.errors.length > 0) fail(versionCheck.errors.join('\n'));
  if (versionCheck.storeErrors.length > 0) {
    if (!test) fail(`${versionCheck.storeErrors.join('\n')}\nFix "packageVersion" in ${path.relative(ROOT, VERSION_FILE)}.`);
    warnings.push(...versionCheck.storeErrors.map((w) => `${w} - acceptable for this test package only`));
  }

  const displayName = test ? `${conf.productName}${TEST_DISPLAY_NAME_SUFFIX}` : identity.displayName || conf.productName;
  const description = conf.bundle?.shortDescription || conf.productName;
  const languages = manifestLanguages();
  if (languages.length !== EXPECTED_LANGUAGE_COUNT) {
    fail(`the app has ${languages.length} UI languages (shared/i18n/locales.ts), expected ${EXPECTED_LANGUAGE_COUNT}: update EXPECTED_LANGUAGE_COUNT and the listings together`);
  }

  // --- payload: the thin client = exactly what the NSIS installer installs ---------------------
  const thin = thinClientProblems(conf);
  if (thin.length > 0) fail(`src-tauri/tauri.conf.json is not the thin client's configuration:\n  - ${thin.join('\n  - ')}`);
  const payload = payloadFromTauriConf(conf);
  for (const item of payload) {
    if (!fs.existsSync(item.src)) fail(`missing file: ${item.src}\nRun the release build (npm run tauri:build) first.`);
  }
  // Stale tree? The UI and src-tauri/src are compiled INTO the executable (the only payload file),
  // so: (1) the installed file list of the generated NSIS script differs from the payload, (2) the
  // UI in frontendDist (dist/) is not the one embedded in the executable (Vite's content-hashed
  // file names), (3) a UI or shell source is newer than the executable.
  const stale = [];
  if (fs.existsSync(NSIS_SCRIPT)) stale.push(...comparePayloads(payload, payloadFromNsis(NSIS_SCRIPT)));
  else warnings.push(`${path.relative(ROOT, NSIS_SCRIPT)} not found: the file list comes from tauri.conf.json only (not cross-checked with the NSIS installer)`);
  try {
    stale.push(...releaseBuildProblems(payload[0].src, conf));
  } catch (e) {
    fail(e.message);
  }
  if (stale.length > 0) {
    const text =
      `the release build is out of date: ${path.relative(ROOT, payload[0].src)} is not the build of the current tree.\n  - ` +
      `${stale.slice(0, 20).join('\n  - ')}${stale.length > 20 ? `\n  ... and ${stale.length - 20} more` : ''}\n` +
      'Run the release build (npm run tauri:build) again, then this script.';
    if (!args['allow-stale-build']) fail(text);
    warnings.push(`${text}\n    Packaged anyway (--allow-stale-build). Do not upload this package.`);
  }
  for (const item of payload) {
    const why = forbiddenReason(item.dest);
    if (why) fail(`${item.dest} must not be in the package (${why})`);
    if (/[^\x20-\x7e]/.test(item.dest)) fail(`${item.dest}: file names in the package must be plain ASCII`);
  }
  const mainExe = payload[0];
  if (payload.length !== 1) fail(`the thin client package holds the shell executable only, found ${payload.length} files: ${payload.map((p) => p.dest).join(', ')}`);
  const machine = peMachine(mainExe.src);
  if (machine !== 'x64') fail(`${mainExe.dest} is a ${machine} executable; the package is declared x64`);
  const markers = exeMarkerProblems(mainExe.src);
  if (markers.forbidden.length > 0) {
    fail(`${mainExe.dest} is a local-server (developer) build, never published:\n  - ${markers.forbidden.join('\n  - ')}\nBuild the release without --features local-server and without tauri.local.conf.json.`);
  }
  if (markers.missing.length > 0) {
    const text = `${mainExe.dest} was built before the current thin-client release (store/MSIX-BUILD.md, section 2, "Shell executable checks"):\n  - ${markers.missing.join('\n  - ')}`;
    if (!test) fail(`${text}\nRun the release build (npm run tauri:build) again.`);
    warnings.push(`${text}\n    Packaged anyway (test package): do not upload it.`);
  }

  const sdkBin = findSdkBin(args['sdk-bin']);
  const makeappx = path.join(sdkBin, 'makeappx.exe');
  const makepri = path.join(sdkBin, 'makepri.exe');

  const defaultName = `YourPersonalDiary_${version}_x64${test ? '_TEST' : ''}.msix`;
  const outFile = path.resolve(args.out || path.join(DEFAULT_OUT_DIR, defaultName));
  if (!/\.msix$/i.test(outFile)) fail('--out must end with .msix');
  if (!test && /_test\.msix$/i.test(outFile)) fail('--out: a Store package must not be named *_TEST.msix');
  const layoutDir = args.layout ? path.resolve(args.layout) : null;
  if (layoutDir && fs.existsSync(layoutDir) && fs.readdirSync(layoutDir).length > 0) fail(`--layout ${layoutDir}: the folder is not empty`);

  console.log(`Building the MSIX package${test ? ' - LOCAL TEST PACKAGE' : ' for the Microsoft Store'}`);
  console.log(`  identity source        : ${identity.source}`);
  console.log(`  Identity Name          : ${identity.identityName}`);
  console.log(`  Publisher              : ${identity.publisher}`);
  console.log(`  Publisher display name : ${identity.publisherDisplayName}`);
  console.log(`  Display name           : ${displayName}`);
  console.log(`  Version                : ${version}${args.version ? ' (--version)' : ` (${path.relative(ROOT, VERSION_FILE)})`}`);
  console.log(`  Languages (${languages.length})        : ${languages.join(' ')}`);
  console.log(`  Windows SDK tools      : ${sdkBin}`);

  // --- staging ------------------------------------------------------------------------------
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'mpd-msix-'));
  const staging = path.join(work, 'package');
  const priRoot = path.join(work, 'pri-root');
  fs.mkdirSync(staging, { recursive: true });
  let totalBytes = 0;
  for (const item of payload) {
    const target = path.join(staging, item.dest);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(item.src, target);
    totalBytes += fs.statSync(target).size;
  }
  console.log(`\nStaged ${payload.length} application file (${payload.map((p) => p.dest).join(', ')}), ${formatBytes(totalBytes)}: ${staging}`);

  const assets = generateAssets({ iconPath: ICON_SOURCE, outDir: path.join(staging, 'Assets'), overrideDir: ASSET_OVERRIDE_DIR });
  const overrides = assets.filter((a) => a.source === 'override').length;
  console.log(`Generated ${assets.length} logo assets from ${path.relative(ROOT, ICON_SOURCE)}${overrides ? ` (${overrides} taken from src-tauri/msix/assets)` : ''}`);

  const manifest = renderManifest(fs.readFileSync(MANIFEST_TEMPLATE, 'utf8'), {
    identityName: identity.identityName,
    publisher: identity.publisher,
    publisherDisplayName: identity.publisherDisplayName,
    version,
    displayName,
    description,
    languages,
  });
  const manifestFile = path.join(staging, 'AppxManifest.xml');
  fs.writeFileSync(manifestFile, manifest, 'utf8');
  console.log('Wrote AppxManifest.xml');

  // --- resources.pri: maps Assets\<Logo>.png to the scale-* / targetsize-* files ------------
  fs.cpSync(path.join(staging, 'Assets'), path.join(priRoot, 'Assets'), { recursive: true });
  const priConfig = path.join(work, 'priconfig.xml');
  console.log('');
  runTool(makepri, ['createconfig', '/cf', priConfig, '/dq', 'en-US', '/pv', '10.0.0', '/o']);
  // One package, no resource packs: drop the <packaging> section, otherwise makepri would split
  // the scale / language candidates into separate .pri files.
  const priXml = fs.readFileSync(priConfig, 'utf8').replace(/<packaging>[\s\S]*?<\/packaging>\s*/g, '');
  fs.writeFileSync(priConfig, priXml, 'utf8');
  runTool(makepri, ['new', '/pr', priRoot, '/cf', priConfig, '/mn', manifestFile, '/of', path.join(staging, 'resources.pri'), '/o']);
  const strayPri = listFiles(staging).filter((f) => /\.pri$/i.test(f) && f !== 'resources.pri');
  if (strayPri.length > 0) fail(`makepri wrote unexpected resource files: ${strayPri.join(', ')}`);

  // --- pack ---------------------------------------------------------------------------------
  const stagedFiles = listFiles(staging);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  // makeappx validates AppxManifest.xml against the schema while packing (no /nv).
  runTool(makeappx, ['pack', '/d', staging, '/p', outFile, '/o'], { hide: /^\s*Processing "/ });

  const filesReport = outFile.replace(/\.msix$/i, '.files.json');
  fs.writeFileSync(
    filesReport,
    `${JSON.stringify(
      {
        package: path.basename(outFile),
        builtAt: new Date().toISOString(),
        test,
        identityName: identity.identityName,
        publisher: identity.publisher,
        publisherDisplayName: identity.publisherDisplayName,
        displayName,
        version,
        languages,
        files: stagedFiles.map((rel) => {
          const full = path.join(staging, rel);
          return { path: rel, size: fs.statSync(full).size, sha256: sha256File(full) };
        }),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  if (layoutDir) {
    fs.mkdirSync(layoutDir, { recursive: true });
    fs.cpSync(staging, layoutDir, { recursive: true });
    console.log(`\nPackage layout kept: ${layoutDir}`);
  }
  if (args['keep-staging']) console.log(`\nStaging folder kept: ${work}`);
  else fs.rmSync(work, { recursive: true, force: true });

  const family = packageFamilyName(identity.identityName, identity.publisher);
  console.log(`\n${test ? 'TEST package' : 'Store package'} built (unsigned - the Microsoft Store signs it).`);
  console.log(`  Output               : ${outFile}`);
  console.log(`  Size                 : ${formatBytes(fs.statSync(outFile).size)}`);
  console.log(`  SHA-256              : ${sha256File(outFile)}`);
  console.log(`  File list            : ${filesReport}`);
  console.log(`  Package family name  : ${family}`);
  console.log(`  Package full name    : ${packageFullName(identity.identityName, version, identity.publisher)}`);
  console.log(`  Publisher id         : ${publisherId(identity.publisher)}`);
  console.log(`  App user model id    : ${family}!YourPersonalDiary`);
  console.log(`  Per-user folder      : %LOCALAPPDATA%\\Packages\\${family}\\LocalCache\\Local\\${conf.identifier}`);
  console.log(`                         (EBWebView\\ = WebView2 profile incl. IndexedDB; offline\\<userId>\\ = offline mirror)`);

  if (test || isPlaceholderIdentity(identity)) {
    warnings.push('TEST identity: this package is for local validation only. Partner Center rejects it; build the Store package from store/identity.json.');
  }
  if (warnings.length > 0) {
    console.log('\nWarnings:');
    for (const w of warnings) console.log(`  - ${w}`);
  }
  console.log(`\nNext: node scripts/store/check-msix.mjs "${path.relative(ROOT, outFile)}"${test ? '' : ' --release'}`);
}

try {
  main();
} catch (e) {
  fail(e && e.message ? e.message : String(e));
}
