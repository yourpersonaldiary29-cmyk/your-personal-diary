/**
 * Tests of the MSIX build helpers (scripts/store/msix-lib.mjs) and of the refusals of
 * scripts/store/build-msix.mjs - Node's own test runner (no vitest project covers scripts/):
 *
 *   node --test scripts/store/
 *
 * Nothing here runs makeappx / makepri or touches the release build: the refusals all happen
 * before any file is staged. Identity values in the fixtures are fictional.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  EXPECTED_LANGUAGE_COUNT,
  FORBIDDEN_EXE_MARKERS,
  MANIFEST_TEMPLATE,
  PLACEHOLDER_IDENTITY,
  REQUIRED_EXE_MARKERS,
  ROOT,
  SHELL_BUILD_INPUTS,
  TAURI_DIR,
  UI_BUILD_INPUTS,
  VERSION_FILE,
  describeNewerSources,
  embeddedUiProblems,
  exeMarkerProblems,
  forbiddenReason,
  frontendDistDir,
  isPlaceholderIdentity,
  manifestLanguages,
  payloadFromTauriConf,
  publisherId,
  readIdentityFile,
  readJson,
  readPackageVersion,
  readTauriConf,
  releaseBuildProblems,
  renderManifest,
  sourcesNewerThan,
  thinClientProblems,
  validateIdentity,
  validateVersion,
} from './msix-lib.mjs';

const BUILD = path.join(ROOT, 'scripts', 'store', 'build-msix.mjs');
const FICTIONAL = {
  identityName: 'Fictional.Example.YourPersonalDiary',
  publisher: 'CN=11111111-2222-3333-4444-555555555555',
  publisherDisplayName: 'Fictional Example Publisher',
};

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mpd-msix-test-'));
}

function writeJson(dir, name, value) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return file;
}

function runBuild(args) {
  const res = spawnSync(process.execPath, [BUILD, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  return { status: res.status, out: `${res.stdout}${res.stderr}` };
}

// --- version: one place, Store rules ------------------------------------------------------------

test('the Store package version has one place and is 1.0.0.0 for the first submission', () => {
  assert.equal(readPackageVersion(), '1.0.0.0');
  const check = validateVersion(readPackageVersion());
  assert.deepEqual(check, { errors: [], storeErrors: [] });
  assert.equal(path.relative(ROOT, VERSION_FILE).replace(/\\/g, '/'), 'src-tauri/msix/package-version.json');
});

test('validateVersion: four parts, 0..65535, no leading zeros; Store: first part not 0, last part 0', () => {
  assert.equal(validateVersion('1.0.0').errors.length, 1);
  assert.equal(validateVersion('1.0.0.0.0').errors.length, 1);
  assert.equal(validateVersion('1.65536.0.0').errors.length, 1);
  assert.equal(validateVersion('1.01.0.0').errors.length, 1);
  assert.deepEqual(validateVersion('0.1.0.0').storeErrors.length, 1);
  assert.deepEqual(validateVersion('1.0.0.1').storeErrors.length, 1);
  assert.deepEqual(validateVersion('1.2.3.0'), { errors: [], storeErrors: [] });
});

test('readPackageVersion refuses a file without packageVersion or with unknown fields', () => {
  const dir = tempDir();
  try {
    assert.throws(() => readPackageVersion(writeJson(dir, 'a.json', { version: '1.0.0.0' })), /unknown field|packageVersion/);
    assert.throws(() => readPackageVersion(writeJson(dir, 'b.json', {})), /packageVersion/);
    assert.equal(readPackageVersion(writeJson(dir, 'c.json', { _note: 'x', packageVersion: '2.0.0.0' })), '2.0.0.0');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- identity -------------------------------------------------------------------------------------

test('the example identity file and the test identity are recognised as placeholders', () => {
  const example = readIdentityFile(path.join(ROOT, 'store', 'identity.example.json'));
  assert.equal(isPlaceholderIdentity(example), true);
  assert.equal(isPlaceholderIdentity(PLACEHOLDER_IDENTITY), true);
  // Each example value alone is enough to be refused (a half-edited copy).
  assert.equal(isPlaceholderIdentity({ ...FICTIONAL, identityName: example.identityName }), true);
  assert.equal(isPlaceholderIdentity({ ...FICTIONAL, publisher: example.publisher }), true);
  assert.equal(isPlaceholderIdentity({ ...FICTIONAL, publisherDisplayName: example.publisherDisplayName }), true);
  assert.equal(isPlaceholderIdentity(FICTIONAL), false);
});

test('validateIdentity: placeholders are refused unless it is a test package', () => {
  assert.deepEqual(validateIdentity(FICTIONAL), []);
  assert.equal(validateIdentity(PLACEHOLDER_IDENTITY).length, 1);
  assert.deepEqual(validateIdentity(PLACEHOLDER_IDENTITY, { placeholderOk: true }), []);
  assert.equal(validateIdentity({ ...FICTIONAL, publisher: 'Fictional' }).length, 1);
  assert.equal(validateIdentity({ ...FICTIONAL, identityName: 'a b' }).length, 1);
  assert.equal(validateIdentity({ ...FICTIONAL, publisherDisplayName: ' padded ' }).length, 1);
});

test('readIdentityFile: three values (+ optional displayName); "version" and unknown fields are refused', () => {
  const dir = tempDir();
  try {
    assert.deepEqual(readIdentityFile(writeJson(dir, 'ok.json', { _readme: 'note', ...FICTIONAL })), { ...FICTIONAL, displayName: undefined });
    assert.throws(() => readIdentityFile(writeJson(dir, 'v.json', { ...FICTIONAL, version: '1.0.0.0' })), /package-version\.json/);
    assert.throws(() => readIdentityFile(writeJson(dir, 'u.json', { ...FICTIONAL, publisherName: 'x' })), /unknown field/);
    assert.throws(() => readIdentityFile(writeJson(dir, 'a.json', [FICTIONAL])), /JSON object/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('publisherId follows the Windows algorithm', () => {
  // Microsoft's own publisher - the suffix of every inbox app's package family name.
  assert.equal(publisherId('CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US'), '8wekyb3d8bbwe');
  // The test identity (also the sample family name of the lib.rs unit tests).
  assert.equal(publisherId(PLACEHOLDER_IDENTITY.publisher), 'e9xxthmdhp5wa');
});

// --- thin client payload ----------------------------------------------------------------------------

test('tauri.conf.json is the thin client: the payload is the shell executable only', () => {
  const conf = readTauriConf();
  assert.deepEqual(thinClientProblems(conf), []);
  const payload = payloadFromTauriConf(conf);
  assert.deepEqual(payload.map((p) => p.dest), ['your-personal-diary.exe']);
});

test('the local-server overlay (tauri.local.conf.json) is refused as a Store configuration', () => {
  const conf = readTauriConf();
  const local = readJson(path.join(TAURI_DIR, 'tauri.local.conf.json'));
  const merged = { ...conf, bundle: { ...conf.bundle, ...local.bundle } };
  const problems = thinClientProblems(merged);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /externalBin/);
  assert.match(problems[1], /resources/);
});

test('server, Node.js and loose UI files are forbidden in the package; the app files are not', () => {
  for (const f of [
    'diary-server.exe',
    'diary-server-x86_64-pc-windows-msvc.exe',
    'node.exe',
    'server/server.cjs',
    'server/sql-wasm.wasm',
    'server/ui/index.html',
    'server/fonts/NotoSans-Regular.ttf',
    'resources/server/server.cjs',
    'ui/assets/index-abc123.js',
    'install-locale.txt',
    'uninstall.exe',
    'your_personal_diary.pdb',
    'accounts.json',
  ]) {
    assert.ok(forbiddenReason(f), f);
  }
  for (const f of ['your-personal-diary.exe', 'AppxManifest.xml', 'resources.pri', 'Assets/StoreLogo.scale-100.png', 'Assets/Square44x44Logo.targetsize-16_altform-unplated.png']) {
    assert.equal(forbiddenReason(f), null, f);
  }
});

test('exeMarkerProblems: the current thin client passes, an old shell and a local-server build do not', () => {
  const dir = tempDir();
  try {
    const write = (name, texts) => {
      const file = path.join(dir, name);
      fs.writeFileSync(file, Buffer.concat([Buffer.from('MZ fake executable\0'), ...texts.map((t) => Buffer.from(`${t}\0`, 'utf8'))]));
      return file;
    };
    const required = REQUIRED_EXE_MARKERS.map((m) => m.text);
    assert.deepEqual(exeMarkerProblems(write('thin.exe', required)), { missing: [], forbidden: [] });
    const old = exeMarkerProblems(write('old.exe', ['[shell] msix-package-data-dir', 'msix-webview2-profile']));
    assert.equal(old.missing.length, REQUIRED_EXE_MARKERS.length);
    const local = exeMarkerProblems(write('local.exe', [...required, 'get_server_info', 'diary-server']));
    assert.equal(local.forbidden.length, 2);
    assert.equal(FORBIDDEN_EXE_MARKERS.length, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the real release shell (when built) is the current thin client', (t) => {
  const exe = path.join(TAURI_DIR, 'target', 'release', 'your-personal-diary.exe');
  if (!fs.existsSync(exe)) {
    t.skip('no release build on this machine');
    return;
  }
  assert.deepEqual(exeMarkerProblems(exe), { missing: [], forbidden: [] });
});

// --- stale release build: the UI and src-tauri/src are compiled INTO the executable -------------------

test('embeddedUiProblems: a rebuilt UI (new content-hashed bundle names) is not the embedded one', () => {
  const dir = tempDir();
  try {
    const dist = path.join(dir, 'dist');
    fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(dist, 'privacy', 'en'), { recursive: true });
    for (const rel of ['index.html', 'assets/index-AAAA1111.js', 'assets/index-CCCC3333.css', 'privacy/en/index.html']) {
      fs.writeFileSync(path.join(dist, rel), 'x');
    }
    const exe = path.join(dir, 'shell.exe');
    const embed = (keys) => fs.writeFileSync(exe, Buffer.concat([Buffer.from('MZ fake\0'), ...keys.map((k) => Buffer.from(`${k}\0brotli\0`, 'latin1'))]));

    embed(['/index.html', '/assets/index-AAAA1111.js', '/assets/index-CCCC3333.css', '/privacy/en/index.html']);
    assert.deepEqual(embeddedUiProblems(exe, dist), { checked: 4, problems: [] });

    // The executable was linked with the previous UI build (the finding: index-D01ez34v.js inside,
    // index-CV-6e_DI.js in dist/).
    embed(['/index.html', '/assets/index-OLD00000.js', '/assets/index-CCCC3333.css', '/privacy/en/index.html']);
    const stale = embeddedUiProblems(exe, dist);
    assert.equal(stale.problems.length, 2);
    assert.match(stale.problems[0], /1 file\(s\) of .* are not embedded in shell\.exe: assets\/index-AAAA1111\.js/);
    assert.match(stale.problems[1], /shell\.exe embeds \/assets\/index-OLD00000\.js, which .* no longer has/);

    assert.match(embeddedUiProblems(exe, path.join(dir, 'missing-dist')).problems[0], /does not exist/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('sourcesNewerThan: UI and shell sources changed after the executable are reported, tests are not', () => {
  const dir = tempDir();
  try {
    const exeTime = Date.parse('2026-10-27T02:42:10Z');
    const put = (rel, msAfter) => {
      const file = path.join(dir, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'x');
      const t = new Date(exeTime + msAfter);
      fs.utimesSync(file, t, t);
    };
    put('src/pages/CalendarPage.tsx', 10 * 3600_000); // edited after the build
    put('src-tauri/src/lib.rs', 60_000); // edited after the build
    put('shared/i18n/en.ts', -60_000); // older: fine
    put('src/utils/calendar-years.ts', 1000); // within the 2 s tolerance
    put('src/pages/CalendarPage.test.tsx', 10 * 3600_000); // a test: not built
    put('src/offline/test-utils/fake.ts', 10 * 3600_000); // test helpers: not built
    put('src/node_modules/x/index.js', 10 * 3600_000);
    put('server/src/app.ts', 10 * 3600_000); // not part of the thin client's build inputs
    const newer = sourcesNewerThan(exeTime, { base: dir });
    assert.deepEqual(
      newer.map((n) => n.file),
      ['src/pages/CalendarPage.tsx', 'src-tauri/src/lib.rs'],
    );
    assert.equal(sourcesNewerThan(exeTime, { base: dir, toleranceMs: 0 }).length, 3);
    assert.deepEqual(sourcesNewerThan(exeTime + 11 * 3600_000, { base: dir }), []);
    const text = describeNewerSources(newer, path.join(dir, 'shell.exe'), exeTime);
    assert.match(text, /^2 UI \/ shell source file\(s\) changed after shell\.exe was built .*src\/pages\/CalendarPage\.tsx/);
    assert.equal(describeNewerSources([], 'shell.exe', exeTime), null);
    // Every input the thin client's release build compiles in is watched.
    for (const input of ['src', 'shared', 'public', 'index.html', 'src-tauri/src', 'src-tauri/tauri.conf.json']) {
      assert.ok([...UI_BUILD_INPUTS, ...SHELL_BUILD_INPUTS].includes(input), input);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the stale-build check reads frontendDist from tauri.conf.json (the embedded UI is dist/)', () => {
  assert.equal(frontendDistDir(readTauriConf()), path.join(ROOT, 'dist'));
  assert.throws(() => frontendDistDir({ build: { frontendDist: 'https://example.invalid' } }), /must be a folder/);
});

test('releaseBuildProblems combines both checks on a fixture tree', () => {
  const dir = tempDir();
  try {
    const dist = path.join(dir, 'ui');
    fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(dist, 'index.html'), 'x');
    fs.writeFileSync(path.join(dist, 'assets', 'index-NEW11111.js'), 'x');
    const exe = path.join(dir, 'shell.exe');
    fs.writeFileSync(exe, Buffer.from('MZ\0/index.html\0/assets/index-NEW11111.js\0', 'latin1'));
    const conf = { build: { frontendDist: dist } };
    const builtAt = new Date(Date.now() - 3600_000);
    fs.utimesSync(exe, builtAt, builtAt);
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'old.ts'), 'x');
    const before = new Date(builtAt.getTime() - 60_000);
    fs.utimesSync(path.join(dir, 'src', 'old.ts'), before, before);
    assert.deepEqual(releaseBuildProblems(exe, conf, { base: dir }), []);
    fs.writeFileSync(path.join(dir, 'src', 'edited.ts'), 'x'); // now: after the build
    const problems = releaseBuildProblems(exe, conf, { base: dir });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /src\/edited\.ts/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- languages + manifest -----------------------------------------------------------------------------

test('20 resource languages: en-US first, unique, the Store listing tags of docs/store-tasks/LANG.md', () => {
  const tags = manifestLanguages();
  assert.equal(tags.length, EXPECTED_LANGUAGE_COUNT);
  assert.equal(tags[0], 'en-US');
  assert.equal(new Set(tags).size, tags.length);
  const lang = ['en-US', 'he-IL', 'zh-CN', 'es-ES', 'pl-PL', 'ru-RU', 'fr-FR', 'ar-SA', 'ja-JP', 'tr-TR', 'cs-CZ', 'hu-HU', 'bg-BG', 'el-GR', 'pt-PT', 'de-DE', 'ro-RO', 'it-IT', 'th-TH', 'hi-IN'];
  assert.deepEqual([...tags].sort(), [...lang].sort());
  assert.throws(() => manifestLanguages(['en', 'xx']), /no manifest language tag/);
});

test('the manifest template renders with every placeholder filled and the values escaped', () => {
  const xml = renderManifest(fs.readFileSync(MANIFEST_TEMPLATE, 'utf8'), {
    ...FICTIONAL,
    publisherDisplayName: 'Fictional & "Example"',
    version: '1.0.0.0',
    displayName: 'Your Personal Diary',
    description: 'A smart, private personal diary',
    languages: manifestLanguages(),
  });
  assert.doesNotMatch(xml, /\{\{|\}\}|<!--/);
  assert.equal((xml.match(/<Resource Language="/g) || []).length, EXPECTED_LANGUAGE_COUNT);
  assert.match(xml, /<PublisherDisplayName>Fictional &amp; &quot;Example&quot;<\/PublisherDisplayName>/);
  assert.match(xml, /Executable="your-personal-diary\.exe"/);
  assert.match(xml, /<rescap:Capability Name="runFullTrust" \/>/);
  assert.doesNotMatch(xml, /diary-server|server\.cjs/);
});

// --- build-msix.mjs refusals (all happen before anything is staged) -------------------------------

test('build-msix refuses a Store package with the example (placeholder) identity', () => {
  const r = runBuild(['--identity', path.join(ROOT, 'store', 'identity.example.json')]);
  assert.equal(r.status, 1);
  assert.match(r.out, /placeholders/);
});

test('build-msix refuses a version outside its one place, and the retired identity options', () => {
  const dir = tempDir();
  try {
    const id = writeJson(dir, 'identity.json', FICTIONAL);
    let r = runBuild(['--identity', id, '--version', '1.2.0.0']);
    assert.equal(r.status, 1);
    assert.match(r.out, /--version is for --test packages only/);
    r = runBuild(['--identity', writeJson(dir, 'with-version.json', { ...FICTIONAL, version: '1.0.0.0' })]);
    assert.equal(r.status, 1);
    assert.match(r.out, /package-version\.json/);
    r = runBuild(['--publisher', 'CN=X']);
    assert.equal(r.status, 1);
    assert.match(r.out, /no longer supported/);
    r = runBuild(['--test', '--identity', id]);
    assert.equal(r.status, 1);
    assert.match(r.out, /cannot be combined/);
    r = runBuild(['--allow-stale-build', '--identity', id]);
    assert.equal(r.status, 1);
    assert.match(r.out, /--test packages only/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
