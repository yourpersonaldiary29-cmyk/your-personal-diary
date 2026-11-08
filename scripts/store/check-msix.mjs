#!/usr/bin/env node
/**
 * Re-validates a package built by scripts/store/build-msix.mjs WITHOUT installing it:
 * unpacks it with makeappx into a temporary folder and checks the manifest fields (identity,
 * version, the 20 resource languages, runFullTrust only), the logo assets and resources.pri, the
 * application files (the thin client: the shell executable only - no sidecar, no server files,
 * no Node.js - compared with the current release build and the build's own file list) and that
 * nothing forbidden is inside.
 *
 *   node scripts/store/check-msix.mjs [<file.msix>] [--release] [--identity <file>] [--sdk-bin <dir>] [--keep]
 *
 *   <file.msix>   default: the newest .msix in src-tauri/target/release/bundle/msix
 *   --release     the package is meant for upload: a test / placeholder identity, a version other
 *                 than src-tauri/msix/package-version.json or one the Store rejects, a shell that is
 *                 not the current thin-client release, files that differ from the current release
 *                 build, an embedded UI that is not the one in dist/ and UI / shell sources that
 *                 are newer than the release executable are errors (otherwise warnings); the
 *                 identity must equal store/identity.json
 *   --identity    identity file to compare with (default store/identity.json)
 *   --keep        keep the unpacked folder (printed at the end)
 *
 * Exit code 0 = no errors (warnings are listed), 1 = at least one error.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LOGOS, REQUIRED_TARGET_SIZES, assetPlan, pngSize } from './msix-assets.mjs';
import {
  APPLICATION_ID,
  DEFAULT_IDENTITY_FILE,
  DEFAULT_OUT_DIR,
  EXPECTED_LANGUAGE_COUNT,
  MAX_WINDOWS_VERSION_TESTED,
  MIN_WINDOWS_VERSION,
  NSIS_SCRIPT,
  PACKAGE_METADATA_FILES,
  ROOT,
  SERVER_FILE_HINTS,
  TEST_DISPLAY_NAME_SUFFIX,
  VERSION_FILE,
  SHELL_BUILD_INPUTS,
  UI_BUILD_INPUTS,
  comparePayloads,
  describeNewerSources,
  embeddedUiProblems,
  exeMarkerProblems,
  findSdkBin,
  forbiddenReason,
  formatBytes,
  frontendDistDir,
  isPlaceholderIdentity,
  listFiles,
  listingTags,
  manifestLanguages,
  packageFamilyName,
  parseArgs,
  payloadFromNsis,
  payloadFromTauriConf,
  peMachine,
  readIdentityFile,
  readJson,
  readPackageVersion,
  readTauriConf,
  runTool,
  sha256File,
  sourcesNewerThan,
  thinClientProblems,
  validateIdentity,
  validateVersion,
  xmlUnescape,
  zipEntryNames,
} from './msix-lib.mjs';

const results = { pass: 0, warn: [], fail: [] };
const pass = (text) => {
  results.pass += 1;
  console.log(`  ok    ${text}`);
};
const warn = (text) => {
  results.warn.push(text);
  console.log(`  WARN  ${text}`);
};
const fail = (text) => {
  results.fail.push(text);
  console.log(`  FAIL  ${text}`);
};
/** pass when `condition`, otherwise fail (or warn when `soft`). */
const check = (condition, text, detail = '', soft = false) => {
  if (condition) pass(text);
  else (soft ? warn : fail)(detail ? `expected "${text}" - ${detail}` : `expected "${text}"`);
  return Boolean(condition);
};

function newestPackage() {
  if (!fs.existsSync(DEFAULT_OUT_DIR)) return null;
  const files = fs
    .readdirSync(DEFAULT_OUT_DIR)
    .filter((f) => /\.msix$/i.test(f))
    .map((f) => path.join(DEFAULT_OUT_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] || null;
}

/** Attributes of the first `<tag ...>` element. */
function attrs(xml, tag) {
  const m = new RegExp(`<${tag}(\\s[^>]*?)?/?>`).exec(xml);
  if (!m) return null;
  const out = {};
  for (const a of (m[1] || '').matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) out[a[1]] = xmlUnescape(a[2]);
  return out;
}

function elementText(xml, tag) {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m ? xmlUnescape(m[1].trim()) : null;
}

function main() {
  const args = parseArgs(process.argv.slice(2), { booleans: ['release', 'keep', 'help'], values: ['identity', 'sdk-bin'] });
  if (args.help || args._.length > 1) {
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\r?\n/, ''));
    process.exit(args.help ? 0 : 1);
  }
  const release = Boolean(args.release);
  const msix = args._[0] ? path.resolve(args._[0]) : newestPackage();
  if (!msix || !fs.existsSync(msix)) {
    console.error(`ERROR: package not found${msix ? `: ${msix}` : ` in ${DEFAULT_OUT_DIR}`}. Build it with scripts/store/build-msix.mjs first.`);
    process.exit(1);
  }
  const conf = readTauriConf();
  const sdkBin = findSdkBin(args['sdk-bin']);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'mpd-msix-check-'));
  const unpacked = path.join(work, 'unpacked');

  console.log(`Checking ${msix}`);
  console.log(`  size ${formatBytes(fs.statSync(msix).size)}, sha256 ${sha256File(msix)}`);
  console.log(`  mode: ${release ? 'release (upload candidate)' : 'test build (placeholder / stale items are warnings)'}\n`);

  // --- unpack ---------------------------------------------------------------------------------
  console.log('Package container');
  try {
    runTool(path.join(sdkBin, 'makeappx.exe'), ['unpack', '/p', msix, '/d', unpacked, '/o'], { quiet: true });
    pass('makeappx unpack succeeded (block map and manifest are consistent)');
  } catch (e) {
    fail(`makeappx unpack failed: ${e.message}`);
    return finish(work, args.keep);
  }
  const files = listFiles(unpacked);
  const lowerFiles = new Map(files.map((f) => [f.toLowerCase(), f]));
  // makeappx unpack does not write [Content_Types].xml to disk: look at the container itself.
  const entries = zipEntryNames(msix).map((n) => n.toLowerCase());
  for (const meta of PACKAGE_METADATA_FILES) check(entries.includes(meta.toLowerCase()), `${meta} is present`);
  check(!entries.includes('appxsignature.p7x'), 'the package is not signed (the Store signs it)');
  check(new Set(entries).size === entries.length, `the container has ${entries.length} entries, no duplicates`);

  // --- manifest -------------------------------------------------------------------------------
  console.log('\nAppxManifest.xml');
  const manifestPath = path.join(unpacked, 'AppxManifest.xml');
  const xml = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : '';
  const identity = attrs(xml, 'Identity') || {};
  const found = {
    identityName: identity.Name,
    publisher: identity.Publisher,
    publisherDisplayName: elementText(xml, 'PublisherDisplayName'),
  };
  console.log(`        Identity: Name="${identity.Name}" Publisher="${identity.Publisher}" Version="${identity.Version}" ProcessorArchitecture="${identity.ProcessorArchitecture}"`);
  const identityProblems = validateIdentity(found, { placeholderOk: true });
  check(identityProblems.length === 0, 'Identity Name, Publisher and PublisherDisplayName are well-formed', identityProblems.join('; '));
  const placeholder = isPlaceholderIdentity(found);
  check(!placeholder, 'the identity values are not placeholders', 'PLACEHOLDER BUILD - not for upload', !release);
  check(identity.ProcessorArchitecture === 'x64', 'ProcessorArchitecture is x64', String(identity.ProcessorArchitecture));

  const version = identity.Version || '';
  const versionCheck = validateVersion(version);
  check(versionCheck.errors.length === 0, `Version "${version}" has four numeric parts within range`, versionCheck.errors.join('; '));
  check(versionCheck.storeErrors.length === 0, `Version "${version}" follows the Store rules (first part not 0, last part 0)`, versionCheck.storeErrors.join('; '), !release);
  let plannedVersion = null;
  try {
    plannedVersion = readPackageVersion();
  } catch (e) {
    fail(e.message);
  }
  if (plannedVersion) {
    check(version === plannedVersion, `Version equals ${path.relative(ROOT, VERSION_FILE)} (${plannedVersion})`, `the package has ${version}`, !release);
  }

  const identityFile = args.identity ? path.resolve(args.identity) : DEFAULT_IDENTITY_FILE;
  if (fs.existsSync(identityFile)) {
    let expected = null;
    try {
      expected = readIdentityFile(identityFile);
    } catch (e) {
      fail(e.message);
    }
    if (expected) {
      const same =
        expected.identityName === found.identityName &&
        expected.publisher === found.publisher &&
        expected.publisherDisplayName === found.publisherDisplayName;
      check(same, `identity equals ${path.relative(ROOT, identityFile)}`, 'the package was built with other values', !release);
    }
  } else if (release) {
    fail(`${path.relative(ROOT, identityFile)} not found: a Store package is built from it (store/MSIX-BUILD.md, section 1)`);
  }

  const displayName = elementText(xml, 'DisplayName');
  check(Boolean(displayName), `Properties/DisplayName is "${displayName}"`);
  if (placeholder) {
    check(displayName === `${conf.productName}${TEST_DISPLAY_NAME_SUFFIX}`, `test package: DisplayName is marked "${conf.productName}${TEST_DISPLAY_NAME_SUFFIX}"`, String(displayName));
  } else {
    check(!displayName?.endsWith(TEST_DISPLAY_NAME_SUFFIX), 'DisplayName carries no test marker', String(displayName));
    check(displayName === conf.productName, `DisplayName equals the product name "${conf.productName}"`, 'fine only if another name was reserved in Partner Center', true);
  }
  check(elementText(xml, 'Logo') === 'Assets\\StoreLogo.png', 'Properties/Logo is Assets\\StoreLogo.png', String(elementText(xml, 'Logo')));

  const languages = [...xml.matchAll(/<Resource\s+Language="([^"]+)"\s*\/>/g)].map((m) => m[1]);
  const expectedLanguages = manifestLanguages();
  console.log(`        Resource languages (${languages.length}): ${languages.join(' ')}`);
  check(languages[0] === 'en-US', 'the first (default) resource language is en-US', String(languages[0]));
  check(expectedLanguages.length === EXPECTED_LANGUAGE_COUNT, `the app has ${EXPECTED_LANGUAGE_COUNT} UI languages (shared/i18n/locales.ts)`, `found ${expectedLanguages.length}`);
  check(
    languages.length === EXPECTED_LANGUAGE_COUNT && languages.join(' ') === expectedLanguages.join(' '),
    `exactly ${EXPECTED_LANGUAGE_COUNT} Resource languages, one per UI language, in the app's order`,
    `found ${languages.length}: ${languages.join(' ')}`,
  );
  check(new Set(languages.map((l) => l.toLowerCase())).size === languages.length, 'no duplicate resource languages');
  // Partner Center offers a Store listing for each language the package declares; the listing
  // folders of store/listing (package S1) should be exactly these.
  const listings = listingTags();
  if (listings.length > 0) {
    const notDeclared = listings.filter((t) => !languages.some((l) => l.toLowerCase() === t.toLowerCase()));
    const noListing = languages.filter((l) => !listings.some((t) => t.toLowerCase() === l.toLowerCase()));
    check(notDeclared.length === 0, `every store/listing/<tag> folder (${listings.length}) is a declared package language`, `not declared: ${notDeclared.join(', ')}`, true);
    check(noListing.length === 0, 'every declared package language has a store/listing/<tag> folder', `no listing folder yet: ${noListing.join(', ')}`, true);
  }

  const family = attrs(xml, 'TargetDeviceFamily') || {};
  check(
    family.Name === 'Windows.Desktop' && family.MinVersion === MIN_WINDOWS_VERSION && family.MaxVersionTested === MAX_WINDOWS_VERSION_TESTED,
    `TargetDeviceFamily Windows.Desktop ${MIN_WINDOWS_VERSION} .. ${MAX_WINDOWS_VERSION_TESTED}`,
    JSON.stringify(family),
  );
  check((xml.match(/<TargetDeviceFamily\b/g) || []).length === 1, 'exactly one TargetDeviceFamily');

  const mainExe = `${conf.mainBinaryName || conf.productName}.exe`;
  const app = attrs(xml, 'Application') || {};
  check((xml.match(/<Application\b/g) || []).length === 1, 'exactly one Application');
  check(app.Id === APPLICATION_ID, `Application Id is ${APPLICATION_ID}`, String(app.Id));
  check(app.Executable === mainExe, `Application Executable is ${mainExe}`, String(app.Executable));
  check(app.EntryPoint === 'Windows.FullTrustApplication', 'Application EntryPoint is Windows.FullTrustApplication', String(app.EntryPoint));

  const visual = attrs(xml, 'uap:VisualElements') || {};
  check(visual.DisplayName === displayName, 'VisualElements DisplayName equals Properties/DisplayName', String(visual.DisplayName));
  check(Boolean(visual.Description) && visual.Description.length <= 2048, 'VisualElements Description is set', String(visual.Description));
  check(/^(transparent|#[0-9a-fA-F]{6})$/.test(visual.BackgroundColor || ''), `VisualElements BackgroundColor is "${visual.BackgroundColor}"`);
  check(visual.Square150x150Logo === 'Assets\\Square150x150Logo.png', 'VisualElements Square150x150Logo', String(visual.Square150x150Logo));
  check(visual.Square44x44Logo === 'Assets\\Square44x44Logo.png', 'VisualElements Square44x44Logo', String(visual.Square44x44Logo));
  const tile = attrs(xml, 'uap:DefaultTile') || {};
  check(tile.Wide310x150Logo === 'Assets\\Wide310x150Logo.png', 'DefaultTile Wide310x150Logo', String(tile.Wide310x150Logo));
  check(tile.Square310x310Logo === 'Assets\\Square310x310Logo.png', 'DefaultTile Square310x310Logo', String(tile.Square310x310Logo));

  const capabilityBlock = /<Capabilities>([\s\S]*?)<\/Capabilities>/.exec(xml);
  const capabilities = capabilityBlock ? [...capabilityBlock[1].matchAll(/<([\w:]*Capability)\s+Name="([^"]+)"/g)].map((m) => `${m[1]}:${m[2]}`) : [];
  check(
    capabilities.length === 1 && capabilities[0] === 'rescap:Capability:runFullTrust',
    'the only capability is rescap runFullTrust',
    capabilities.join(', ') || 'none',
  );
  check(!/<(\w+:)?Extension\b/.test(xml), 'no extensions are declared');

  // --- application files ----------------------------------------------------------------------
  console.log('\nApplication files');
  const payloadFiles = files.filter((f) => !PACKAGE_METADATA_FILES.some((m) => m.toLowerCase() === f.toLowerCase()) && !/^assets\//i.test(f));
  console.log(`        application files in the package: ${payloadFiles.join(', ') || 'none'}`);
  const thin = thinClientProblems(conf);
  check(thin.length === 0, 'src-tauri/tauri.conf.json is the thin client (no externalBin sidecar, no bundle.resources)', thin.join('; '));
  const expected = payloadFromTauriConf(conf);
  const expectedByName = new Map(expected.map((e) => [e.dest.toLowerCase(), e]));
  const missing = expected.filter((e) => !lowerFiles.has(e.dest.toLowerCase())).map((e) => e.dest);
  const extra = payloadFiles.filter((f) => !expectedByName.has(f.toLowerCase()));
  check(missing.length === 0, `all ${expected.length} file(s) of the release build (tauri.conf.json) are in the package`, `missing: ${missing.join(', ')}`, !release);
  check(extra.length === 0, 'no files beyond the release build payload, the assets and the package metadata', `unexpected: ${extra.join(', ')}`, !release);
  check(lowerFiles.has(mainExe.toLowerCase()), `${mainExe} is in the package`);
  check(
    payloadFiles.length === 1 && payloadFiles[0].toLowerCase() === mainExe.toLowerCase(),
    `the only application file is ${mainExe} (the UI is embedded in it)`,
    payloadFiles.join(', '),
  );
  const serverFiles = files.filter((f) => /^(resources\/)?server\//i.test(f) || /(^|\/)(diary-server[^/]*|node)(\.exe)?$/i.test(f) || /\.(cjs|mjs|js|node|wasm)$/i.test(f));
  check(serverFiles.length === 0, `no server files (${SERVER_FILE_HINTS.join(', ')})`, serverFiles.join(', '));

  let different = 0;
  let compared = 0;
  for (const e of expected) {
    const inPackage = lowerFiles.get(e.dest.toLowerCase());
    if (!inPackage || !fs.existsSync(e.src)) continue;
    compared += 1;
    if (sha256File(path.join(unpacked, inPackage)) !== sha256File(e.src)) {
      different += 1;
      console.log(`        differs from the current build: ${e.dest}`);
    }
  }
  check(different === 0, `${compared} packaged files are byte-identical to the current release build`, `${different} file(s) differ - the package is older than the build`, !release);
  // Byte-identical to the executable on disk is not enough: that executable must itself be the
  // build of the CURRENT tree. The UI and src-tauri/src are compiled into it, so (1) the UI it
  // embeds must be the one in frontendDist (dist/) and (2) no UI / shell source may be newer than
  // the release executable. Same rule as build-msix.mjs.
  const packagedExe = lowerFiles.get(mainExe.toLowerCase());
  const releaseExe = expected[0].src;
  let distDir = null;
  try {
    distDir = frontendDistDir(conf);
  } catch (e) {
    fail(e.message);
  }
  if (packagedExe && distDir) {
    const ui = embeddedUiProblems(path.join(unpacked, packagedExe), distDir);
    for (const p of ui.problems) console.log(`        ${p}`);
    check(
      ui.problems.length === 0,
      `the UI embedded in ${mainExe} is the one in ${path.relative(ROOT, distDir)}/ (${ui.checked} files, content-hashed bundle names)`,
      'the package carries an older UI - run npm run tauri:build, then build-msix.mjs again',
      !release,
    );
  }
  if (fs.existsSync(releaseExe)) {
    const builtAt = fs.statSync(releaseExe).mtimeMs;
    const newer = describeNewerSources(sourcesNewerThan(builtAt), releaseExe, builtAt);
    if (newer) console.log(`        ${newer}`);
    check(
      !newer,
      `no UI / shell source (${[...UI_BUILD_INPUTS, ...SHELL_BUILD_INPUTS].length} inputs: src, shared, public, src-tauri/src, ...) is newer than the release build of ${mainExe}`,
      'run npm run tauri:build, then build-msix.mjs again',
      !release,
    );
  } else {
    check(false, `the release build of ${mainExe} exists`, `${path.relative(ROOT, releaseExe)} not found`, !release);
  }
  if (fs.existsSync(NSIS_SCRIPT)) {
    const nameDiff = comparePayloads(expected, payloadFromNsis(NSIS_SCRIPT));
    for (const d of nameDiff) console.log(`        ${d}`);
    check(nameDiff.length === 0, 'the file list equals the one the NSIS installer of the release build installs', `${nameDiff.length} difference(s)`, !release);
  } else {
    warn(`${path.relative(ROOT, NSIS_SCRIPT)} not found: the file list was not cross-checked with the NSIS installer`);
  }

  const report = msix.replace(/\.msix$/i, '.files.json');
  if (fs.existsSync(report)) {
    const staged = readJson(report).files;
    const stagedNames = staged.map((f) => f.path.toLowerCase()).sort();
    const unpackedNames = files.filter((f) => !['appxblockmap.xml', '[content_types].xml'].includes(f.toLowerCase())).map((f) => f.toLowerCase()).sort();
    const sameList = stagedNames.length === unpackedNames.length && stagedNames.every((n, i) => n === unpackedNames[i]);
    check(sameList, `the unpacked file list equals the staged file list (${staged.length} files, ${path.basename(report)})`, 'lists differ');
    const changed = staged.filter((f) => {
      const real = lowerFiles.get(f.path.toLowerCase());
      if (!real) return true;
      const full = path.join(unpacked, real);
      return fs.statSync(full).size !== f.size || sha256File(full) !== f.sha256;
    });
    check(changed.length === 0, 'every unpacked file has the size and SHA-256 recorded at staging time', changed.map((f) => f.path).join(', '));
  } else {
    warn(`${path.basename(report)} not found next to the package: the staged file list could not be compared`);
  }

  const forbidden = files.map((f) => ({ f, why: forbiddenReason(f) })).filter((x) => x.why);
  check(forbidden.length === 0, 'no forbidden files (uninstaller, install-locale.txt, NSIS / MSI files, symbols, certificates, diary data, server / Node.js / loose UI files)', forbidden.map((x) => `${x.f} (${x.why})`).join(', '));
  const nonAscii = files.filter((f) => /[^\x20-\x7e]/.test(f));
  check(nonAscii.length === 0, 'all file names are plain ASCII', nonAscii.join(', '));
  const packagedMain = lowerFiles.get(mainExe.toLowerCase());
  if (packagedMain) {
    for (const exe of files.filter((f) => /\.exe$/i.test(f))) {
      const machine = peMachine(path.join(unpacked, exe));
      check(machine === 'x64', `${exe} is an x64 executable`, machine);
    }
    const markers = exeMarkerProblems(path.join(unpacked, packagedMain));
    check(
      markers.missing.length === 0,
      `${mainExe} is the current thin-client release (packaged WebView2 profile, offline mirror, Store toasts)`,
      `missing: ${markers.missing.join('; ')} - rebuild before upload (store/MSIX-BUILD.md, section 2, "Shell executable checks")`,
      !release,
    );
    check(markers.forbidden.length === 0, `${mainExe} contains no local-server (developer) code`, markers.forbidden.join('; '));
  }
  check(files.filter((f) => /\.exe$/i.test(f)).length === 1, 'exactly one executable (the shell; no sidecar)', files.filter((f) => /\.exe$/i.test(f)).join(', '));

  // --- assets + resources.pri -----------------------------------------------------------------
  console.log('\nLogo assets and resources.pri');
  const assetFiles = files.filter((f) => /^assets\//i.test(f)).map((f) => f.slice('assets/'.length));
  const assetSet = new Set(assetFiles.map((f) => f.toLowerCase()));
  const planned = new Map(assetPlan().map((a) => [a.file.toLowerCase(), a]));
  for (const logo of LOGOS) {
    const missingScales = [100, 200].filter((s) => !assetSet.has(`${logo.name}.scale-${s}.png`.toLowerCase()));
    check(missingScales.length === 0, `${logo.name}: scale-100 and scale-200 are present`, `missing scale-${missingScales.join(', scale-')}`);
    check(!assetSet.has(`${logo.name}.png`.toLowerCase()), `${logo.name}: no unqualified duplicate file`);
  }
  const missingTargets = [];
  for (const size of REQUIRED_TARGET_SIZES) {
    for (const alt of ['', '_altform-unplated']) {
      const name = `Square44x44Logo.targetsize-${size}${alt}.png`;
      if (!assetSet.has(name.toLowerCase())) missingTargets.push(name);
    }
  }
  check(missingTargets.length === 0, `Square44x44Logo: targetsize-${REQUIRED_TARGET_SIZES.join('/')} with and without altform-unplated`, missingTargets.join(', '));
  const wrongSize = [];
  const unknownAssets = [];
  for (const file of assetFiles) {
    const plan = planned.get(file.toLowerCase());
    if (!plan) {
      unknownAssets.push(file);
      continue;
    }
    try {
      const size = pngSize(fs.readFileSync(path.join(unpacked, 'Assets', file)));
      if (size.width !== plan.width || size.height !== plan.height) wrongSize.push(`${file} is ${size.width}x${size.height}, expected ${plan.width}x${plan.height}`);
    } catch (e) {
      wrongSize.push(`${file}: ${e.message}`);
    }
  }
  check(wrongSize.length === 0, `all ${assetFiles.length} asset files are PNG images of the size their qualifier promises`, wrongSize.join('; '));
  check(unknownAssets.length === 0, 'no unknown files under Assets', unknownAssets.join(', '));

  if (lowerFiles.has('resources.pri')) {
    const dump = path.join(work, 'pri-dump.xml');
    try {
      runTool(path.join(sdkBin, 'makepri.exe'), ['dump', '/if', path.join(unpacked, 'resources.pri'), '/of', dump, '/o'], { quiet: true });
      const pri = fs.readFileSync(dump, 'utf8');
      const mapName = /<ResourceMap\s+name="([^"]+)"/.exec(pri)?.[1];
      check(mapName === identity.Name, 'resources.pri: the resource map is named after the package identity', String(mapName));
      for (const logo of LOGOS) {
        const block = new RegExp(`<NamedResource name="${logo.name}\\.png" uri="ms-resource://[^"]*/Files/Assets/${logo.name}\\.png">([\\s\\S]*?)</NamedResource>`).exec(pri);
        const values = block ? [...block[1].matchAll(/<Value>([^<]+)<\/Value>/g)].map((m) => m[1]) : [];
        const dangling = values.filter((v) => !lowerFiles.has(v.replace(/\\/g, '/').toLowerCase()));
        const hasScales = [100, 200].every((s) => values.some((v) => v.toLowerCase() === `assets\\${logo.name}.scale-${s}.png`.toLowerCase()));
        check(
          Boolean(block) && hasScales && dangling.length === 0,
          `resources.pri: Assets\\${logo.name}.png resolves to ${values.length} qualified files`,
          !block ? 'resource not found' : dangling.length ? `candidates without a file: ${dangling.join(', ')}` : 'scale-100 / scale-200 candidate missing',
        );
      }
      const candidates = (pri.match(/<Candidate\b/g) || []).length;
      check(candidates === assetFiles.length, `resources.pri: ${candidates} candidates for ${assetFiles.length} asset files`);
    } catch (e) {
      fail(`makepri dump failed: ${e.message}`);
    }
  }

  if (found.identityName && found.publisher) {
    console.log(`\nPackage family name: ${packageFamilyName(found.identityName, found.publisher)}`);
  }
  return finish(work, args.keep);
}

function finish(work, keep) {
  if (keep) console.log(`Unpacked folder kept: ${work}`);
  else fs.rmSync(work, { recursive: true, force: true });
  console.log(`\nResult: ${results.pass} passed, ${results.warn.length} warning(s), ${results.fail.length} error(s)`);
  if (results.warn.length > 0) {
    console.log('Warnings:');
    for (const w of results.warn) console.log(`  - ${w}`);
  }
  if (results.fail.length > 0) {
    console.log('Errors:');
    for (const f of results.fail) console.log(`  - ${f}`);
    console.log('\nFAILED');
    process.exit(1);
  }
  console.log(results.warn.length > 0 ? '\nPASSED WITH WARNINGS' : '\nPASSED');
}

try {
  main();
} catch (e) {
  console.error(`ERROR: ${e && e.message ? e.message : e}`);
  process.exit(1);
}
