/**
 * Tests of scripts/site/add-download.mjs (docs/site-tasks/SITE.md section 4):
 *
 *   node --test scripts/site/add-download.test.mjs
 *
 * Everything runs in scratch trees in a temp folder - never in the project: adding the three installers of a
 * version (the list is created, each file is copied under its public name, measured and hashed, the source is
 * left alone), a duplicate that is refused, --replace, the newest version first, --remove, the usage errors and
 * the sources that are refused. The last test puts the tool and the builder together on a complete fixture tree:
 * a second version appears as the first row of its table, and a copy that was changed, cut or deleted after it
 * was listed stops the build until --replace puts the file there again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addDownload, main, PUBLIC_NAMES, removeDownload, USAGE } from './add-download.mjs';
import { buildSite, DOWNLOADS_DIR, DOWNLOADS_FILE, downloadsProblems, FILES_DIR, formatDownloads, PLATFORMS, readDownloads, ROOT } from './build-site.mjs';
import { fixture, FIXTURE_FILES, fixtureDownloads, sha256 } from './fixture-tree.mjs';

/** A scratch project root (empty) and a folder next to it for the "installers the build wrote". */
function scratch(t) {
  const base = mkdtempSync(path.join(os.tmpdir(), 'add-download-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'project');
  const builds = path.join(base, 'builds');
  mkdirSync(root);
  mkdirSync(builds);
  /** Writes a source installer and returns its path. */
  const source = (name, text) => {
    const file = path.join(builds, name);
    writeFileSync(file, text);
    return file;
  };
  return { root, builds, source };
}

/** Runs the command line in a scratch root and collects what it prints. */
function run(argv, root) {
  const out = [];
  const log = { log: (m) => out.push(m), warn: (m) => out.push(m), error: (m) => out.push(m) };
  return { code: main(argv, { root, log }), out: out.join('\n') };
}

const listOf = (root) => JSON.parse(readFileSync(path.join(root, DOWNLOADS_FILE), 'utf8'));
const filesOf = (root) => (existsSync(path.join(root, DOWNLOADS_DIR)) ? readdirSync(path.join(root, DOWNLOADS_DIR)).sort() : []);
const add = (root, platform, version, from, extra = []) => run([`--platform=${platform}`, `--version=${version}`, '--date=2026-11-13', `--from=${from}`, ...extra], root);

test('add: the list is created, the file is copied under its public name, measured and hashed; the source is left alone', (t) => {
  const { root, builds, source } = scratch(t);
  const setup = source('Your Personal Diary - Windows setup - 1.0.0 - 2026-11-13.exe', 'the Windows setup file of the test\n');
  const before = statSync(setup);
  const added = add(root, 'windows', '1.0.0', setup);
  assert.equal(added.code, 0, added.out);
  const name = 'YourPersonalDiary-1.0.0-windows-x64-setup.exe';
  const row = { version: '1.0.0', date: '2026-11-13', file: name, bytes: 35, sha256: sha256('the Windows setup file of the test\n') };
  assert.deepEqual(listOf(root), { windows: [row], android: [], mac: [] }, 'the three lists; the other two wait for their files');
  assert.equal(readFileSync(path.join(root, DOWNLOADS_FILE), 'utf8'), formatDownloads({ windows: [row], android: [], mac: [] }), 'one row per line');
  assert.deepEqual(filesOf(root), [name], 'the copy under the public name, and no temporary file');
  assert.equal(readFileSync(path.join(root, DOWNLOADS_DIR, name), 'utf8'), 'the Windows setup file of the test\n');
  assert.match(added.out, new RegExp(`^add-download: windows 1\\.0\\.0 \\(2026-11-13\\) -> site/downloads/${name.replace(/\./g, '\\.')}, 35 bytes, SHA-256 ${row.sha256}\\n`));
  assert.match(added.out, /site\/downloads\.json updated; check with: node scripts\/site\/build-site\.mjs --check$/);
  // The source: still there, the same bytes, not renamed, not touched.
  assert.deepEqual(readdirSync(builds), ['Your Personal Diary - Windows setup - 1.0.0 - 2026-11-13.exe']);
  assert.equal(readFileSync(setup, 'utf8'), 'the Windows setup file of the test\n');
  assert.deepEqual([statSync(setup).size, statSync(setup).mtimeMs], [before.size, before.mtimeMs]);

  // The other two platforms: three runs for the three files of a version.
  assert.equal(add(root, 'android', '1.0.0', source('app-release.apk', 'the Android package\n')).code, 0);
  assert.equal(add(root, 'mac', '1.0.0', source('Your Personal Diary_1.0.0_universal.dmg', 'the Mac disk image\n')).code, 0);
  const list = readDownloads(root);
  assert.deepEqual(PLATFORMS.map((p) => list[p].map((r) => r.file)), [[name], ['YourPersonalDiary-1.0.0-android.apk'], ['YourPersonalDiary-1.0.0-mac-universal.dmg']]);
  assert.deepEqual(filesOf(root), ['YourPersonalDiary-1.0.0-android.apk', 'YourPersonalDiary-1.0.0-mac-universal.dmg', name]);
  for (const platform of PLATFORMS) {
    assert.match(PUBLIC_NAMES[platform]('12.3.4'), /^YourPersonalDiary-12\.3\.4-[a-z0-9-]+\.(?:exe|apk|dmg)$/, 'ASCII letters, digits, dots and hyphens: the name a browser saves');
    assert.equal(list[platform][0].sha256, sha256(readFileSync(path.join(root, DOWNLOADS_DIR, list[platform][0].file))));
  }
});

test('add: a row with the same platform and version is refused; --replace puts the new file in its place', (t) => {
  const { root, source } = scratch(t);
  const first = source('setup-a.exe', 'the first build\n');
  const second = source('setup-b.exe', 'the second build, a little longer\n');
  assert.equal(add(root, 'windows', '1.0.0', first).code, 0);
  const listed = readFileSync(path.join(root, DOWNLOADS_FILE), 'utf8');
  const name = 'YourPersonalDiary-1.0.0-windows-x64-setup.exe';

  const again = add(root, 'windows', '1.0.0', second);
  assert.equal(again.code, 1, 'refused');
  assert.equal(again.out, `add-download: site/downloads.json already lists windows 1.0.0 (${name}, 2026-11-13) - to put this file in its place, add --replace`);
  assert.equal(readFileSync(path.join(root, DOWNLOADS_FILE), 'utf8'), listed, 'the list is unchanged');
  assert.equal(readFileSync(path.join(root, DOWNLOADS_DIR, name), 'utf8'), 'the first build\n', 'and so is the file');
  assert.deepEqual(filesOf(root), [name]);
  // The same version of another platform is not a duplicate.
  assert.equal(add(root, 'android', '1.0.0', source('app.apk', 'apk\n')).code, 0);

  const replaced = run(['--platform=windows', '--version=1.0.0', '--date=2026-11-20', `--from=${second}`, '--replace'], root);
  assert.equal(replaced.code, 0, replaced.out);
  assert.deepEqual(listOf(root).windows, [{ version: '1.0.0', date: '2026-11-20', file: name, bytes: 34, sha256: sha256('the second build, a little longer\n') }], 'one row, the new file');
  assert.equal(readFileSync(path.join(root, DOWNLOADS_DIR, name), 'utf8'), 'the second build, a little longer\n');
  assert.deepEqual(filesOf(root), ['YourPersonalDiary-1.0.0-android.apk', name]);
  // --replace on a version that is not listed simply adds it.
  assert.equal(add(root, 'windows', '1.1.0', first, ['--replace']).code, 0);
  assert.deepEqual(listOf(root).windows.map((row) => row.version), ['1.1.0', '1.0.0']);
});

test('add: the newest version comes first, wherever a version is added', (t) => {
  const { root, source } = scratch(t);
  const file = source('image.dmg', 'a disk image\n');
  for (const version of ['1.0.0', '1.2.0', '0.9.0', '1.10.0', '1.1.5']) assert.equal(add(root, 'mac', version, file).code, 0, version);
  assert.deepEqual(listOf(root).mac.map((row) => row.version), ['1.10.0', '1.2.0', '1.1.5', '1.0.0', '0.9.0']);
  assert.deepEqual(filesOf(root), ['0.9.0', '1.0.0', '1.1.5', '1.10.0', '1.2.0'].map((v) => `YourPersonalDiary-${v}-mac-universal.dmg`));
  assert.deepEqual(downloadsProblems(listOf(root), { allowEmpty: true }), [], 'the order the builder asks for');
});

test('remove: the row leaves the list and its file leaves site/downloads/', (t) => {
  const { root, source } = scratch(t);
  const file = source('setup.exe', 'a setup file\n');
  for (const version of ['1.0.0', '1.1.0']) add(root, 'windows', version, file);
  add(root, 'android', '1.0.0', source('app.apk', 'apk\n'));

  const removed = run(['--platform=windows', '--version=1.0.0', '--remove'], root);
  assert.equal(removed.code, 0, removed.out);
  assert.equal(removed.out, 'add-download: removed windows 1.0.0 (YourPersonalDiary-1.0.0-windows-x64-setup.exe) from site/downloads.json and from site/downloads/');
  assert.deepEqual(listOf(root).windows.map((row) => row.version), ['1.1.0']);
  assert.deepEqual(filesOf(root), ['YourPersonalDiary-1.0.0-android.apk', 'YourPersonalDiary-1.1.0-windows-x64-setup.exe']);
  assert.equal(readFileSync(file, 'utf8'), 'a setup file\n', 'the source is never touched');
  // A row that is not listed.
  const missing = run(['--platform=windows', '--version=1.0.0', '--remove'], root);
  assert.deepEqual([missing.code, missing.out], [1, 'add-download: site/downloads.json lists no windows 1.0.0']);
  assert.equal(run(['--platform=mac', '--version=1.0.0', '--remove'], root).code, 1);
  // The last row of a platform: allowed, with a warning - the site needs a file for every platform.
  const last = run(['--platform=android', '--version=1.0.0', '--remove'], root);
  assert.equal(last.code, 0);
  assert.match(last.out, /warning - no android file is listed now; the site cannot be built until one is added$/);
  assert.deepEqual(listOf(root), { windows: listOf(root).windows, android: [], mac: [] });
  assert.throws(() => readDownloads(root), /"android" must be a list with at least one file/);
  // A file that is already gone does not stop the removal of its row.
  rmSync(path.join(root, DOWNLOADS_DIR, 'YourPersonalDiary-1.1.0-windows-x64-setup.exe'));
  assert.equal(run(['--platform=windows', '--version=1.1.0', '--remove'], root).code, 0);
  assert.deepEqual(listOf(root), { windows: [], android: [], mac: [] });
  assert.deepEqual(filesOf(root), []);
});

test('usage: what the command line needs, and exit code 2 with the usage text when it is missing', (t) => {
  const { root, source } = scratch(t);
  const file = source('setup.exe', 'a setup file\n');
  const good = ['--platform=windows', '--version=1.0.0', '--date=2026-11-13', `--from=${file}`];
  const without = (name) => good.filter((arg) => !arg.startsWith(name));
  for (const [argv, reason] of [
    [[], /--platform must be one of windows, android, mac/],
    [without('--platform'), /--platform must be one of windows, android, mac/],
    [[...without('--platform'), '--platform=iphone'], /--platform must be one of windows, android, mac/],
    [[...without('--platform'), '--platform=Windows'], /--platform must be one of/],
    [without('--version'), /--version must look like 1\.0\.0/],
    [[...without('--version'), '--version=1.0'], /--version must look like 1\.0\.0/],
    [[...without('--version'), '--version=v1.0.0'], /--version must look like 1\.0\.0/],
    [without('--date'), /--date must look like 2026-11-13/],
    [[...without('--date'), '--date=13.11.2026'], /--date must look like 2026-11-13/],
    [[...without('--date'), '--date=2026-13-01'], /--date must look like 2026-11-13/],
    [without('--from'), /--from needs the path of the installer file/],
    [[...without('--from'), '--from='], /--from needs the path of the installer file/],
    [[...good, '--force'], /unknown argument --force/],
    [[...good, 'setup.exe'], /unknown argument setup\.exe/],
    [[...good, '--version=1.0.1'], /--version is given twice/],
    [['--platform=windows', '--version=1.0.0', '--remove', '--replace'], /--remove takes only --platform and --version/],
    [['--platform=windows', '--version=1.0.0', '--remove', '--date=2026-11-13'], /--remove takes only --platform and --version/],
    [['--platform=windows', '--version=1.0.0', '--remove', `--from=${file}`], /--remove takes only --platform and --version/],
  ]) {
    const result = run(argv, root);
    assert.equal(result.code, 2, `${argv.join(' ')}: ${result.out}`);
    assert.match(result.out, reason, argv.join(' '));
    assert.ok(result.out.endsWith(USAGE), 'the usage text follows');
  }
  assert.ok(!existsSync(path.join(root, 'site')), 'a usage error writes nothing');
  // The real command line, without an argument: exit code 2, the usage on the error stream, nothing written.
  const before = readFileSync(path.join(ROOT, DOWNLOADS_FILE), 'utf8');
  const cli = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'site', 'add-download.mjs')], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(cli.status, 2);
  assert.ok(cli.stderr.includes(USAGE) && cli.stdout === '');
  assert.equal(readFileSync(path.join(ROOT, DOWNLOADS_FILE), 'utf8'), before);
});

test('refused: a source that is not a usable installer, and a list that is broken', (t) => {
  const { root, builds, source } = scratch(t);
  const file = source('setup.exe', 'a setup file\n');
  const refused = (platform, from, reason) => {
    const result = add(root, platform, '1.0.0', from);
    assert.equal(result.code, 1, `${from}: ${result.out}`);
    assert.match(result.out, reason);
    assert.ok(!result.out.includes('usage:'), 'not a usage error');
  };
  refused('windows', path.join(builds, 'missing.exe'), /--from: .*missing\.exe does not exist$/);
  refused('windows', builds, /--from: .* is not a file$/);
  refused('windows', source('empty.exe', ''), /--from: .*empty\.exe is empty$/);
  refused('windows', source('app.apk', 'apk\n'), /--from: a windows installer ends with \.exe; app\.apk does not$/);
  refused('android', file, /--from: a android installer ends with \.apk; setup\.exe does not$/);
  refused('mac', file, /--from: a mac installer ends with \.dmg; setup\.exe does not$/);
  assert.ok(!existsSync(path.join(root, DOWNLOADS_FILE)) && filesOf(root).length === 0, 'a refused file is neither copied nor listed');
  // The extension may be written in capitals; the published name is always the fixed one.
  assert.equal(add(root, 'windows', '1.0.0', source('SETUP-2.EXE', 'a setup file\n')).code, 0);
  assert.deepEqual(filesOf(root), ['YourPersonalDiary-1.0.0-windows-x64-setup.exe']);
  // The published copy itself is not a source.
  const copy = path.join(root, DOWNLOADS_DIR, 'YourPersonalDiary-1.0.0-windows-x64-setup.exe');
  const self = run(['--platform=windows', '--version=1.0.0', '--date=2026-11-13', `--from=${copy}`, '--replace'], root);
  assert.equal(self.code, 1);
  assert.match(self.out, /is the published copy itself; give the installer as the build wrote it$/);
  assert.equal(readFileSync(copy, 'utf8'), 'a setup file\n');

  // A list that somebody broke by hand is repaired by hand first: nothing is added to it.
  const listed = path.join(root, DOWNLOADS_FILE);
  for (const [text, reason] of [
    ['{ not json', /site\/downloads\.json: cannot read it/],
    [JSON.stringify({ windows: [], android: [] }), /site\/downloads\.json: "mac" is missing - repair the file first/],
    [JSON.stringify({ windows: [{ version: '1.0.0' }], android: [], mac: [] }), /site\/downloads\.json: windows\[0\]\.date is missing; .* - repair the file first/],
  ]) {
    writeFileSync(listed, text);
    const result = add(root, 'android', '1.0.0', source('app2.apk', 'apk\n'));
    assert.equal(result.code, 1);
    assert.match(result.out, reason);
    assert.equal(readFileSync(listed, 'utf8'), text, 'the broken list is left as it is');
    assert.equal(run(['--platform=windows', '--version=1.0.0', '--remove'], root).code, 1);
  }
  // The functions behind the command line throw the same refusals.
  assert.throws(() => addDownload({ root, platform: 'android', version: '1.0.0', date: '2026-11-13', from: path.join(builds, 'nowhere.apk') }), /does not exist/);
  writeFileSync(listed, formatDownloads({ windows: [], android: [], mac: [] }));
  assert.throws(() => removeDownload({ root, platform: 'mac', version: '9.9.9' }), /lists no mac 9\.9\.9/);
});

test('with the builder: a new version is the first row of its table; a copy that changed after it was listed stops the build', (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const builds = mkdtempSync(path.join(os.tmpdir(), 'add-download-builds-'));
  t.after(() => rmSync(builds, { recursive: true, force: true }));
  const setup = path.join(builds, 'setup-1.1.0.exe');
  writeFileSync(setup, 'the Windows setup file of version 1.1.0\n');

  assert.equal(buildSite({ root }).assets.size, 102 + 3);
  const added = add(root, 'windows', '1.1.0', setup);
  assert.equal(added.code, 0, added.out);
  const name = PUBLIC_NAMES.windows('1.1.0');
  const site = buildSite({ root });
  assert.equal(site.assets.size, 102 + 4, 'the new installer is copied into the tree');
  assert.equal(site.assets.get(`${FILES_DIR}/${name}`), path.join(root, DOWNLOADS_DIR, name));
  assert.deepEqual(site.downloads.windows.map((row) => [row.version, row.file]), [['1.1.0', name], ['1.0.0', FIXTURE_FILES.windows.file]]);
  assert.deepEqual(site.downloads.android, fixtureDownloads().android, 'the other platforms are as they were');
  // The Downloads page: two rows in the Windows table, the newest first, each with its size and its checksum.
  const html = site.pages.get('downloads/index.html');
  const rows = [...html.matchAll(/<tr data-file="([^"]+)" data-bytes="(\d+)" data-sha256="([0-9a-f]{64})">/g)].map((m) => [m[1], Number(m[2]), m[3]]);
  assert.deepEqual(rows.slice(0, 2), [
    [name, 40, sha256('the Windows setup file of version 1.1.0\n')],
    [FIXTURE_FILES.windows.file, Buffer.byteLength(FIXTURE_FILES.windows.text), sha256(FIXTURE_FILES.windows.text)],
  ]);
  assert.equal(rows.length, 4);
  assert.ok(html.includes(`<a class="get" href="../files/${name}" download><bdi dir="ltr">${name}</bdi></a></th><td>1.1.0</td>`));
  assert.ok(html.includes(`<dt><bdi dir="ltr">${name}</bdi></dt><dd><code dir="ltr">${sha256('the Windows setup file of version 1.1.0\n')}</code></dd>`));

  // The copy is changed after it was listed: the same size, another content - the SHA-256 catches it.
  const copy = path.join(root, DOWNLOADS_DIR, name);
  const problemOf = () => {
    try {
      buildSite({ root });
    } catch (e) {
      return e.problems;
    }
    return [];
  };
  const fix = ' - put the file there again with scripts/site/add-download.mjs (--replace)';
  writeFileSync(copy, 'the Windows setup file of version 1.1.9\n');
  assert.deepEqual(problemOf(), [`site/downloads/${name} does not have the SHA-256 that site/downloads.json states${fix}`]);
  // Cut short (a copy that was interrupted), and deleted.
  writeFileSync(copy, 'the Windows setup');
  assert.deepEqual(problemOf(), [`site/downloads/${name} is 17 bytes, site/downloads.json says 40${fix}`]);
  rmSync(copy);
  assert.deepEqual(problemOf(), [`site/downloads/${name} is missing (site/downloads.json lists it)${fix}`]);
  // The source was never touched, so --replace puts the file there again and the site builds.
  assert.equal(readFileSync(setup, 'utf8'), 'the Windows setup file of version 1.1.0\n');
  assert.equal(add(root, 'windows', '1.1.0', setup, ['--replace']).code, 0);
  assert.deepEqual(problemOf(), []);
  // Taking the version off again gives the tree of before.
  assert.equal(run(['--platform=windows', '--version=1.1.0', '--remove'], root).code, 0);
  assert.equal(buildSite({ root }).assets.size, 102 + 3);
  assert.deepEqual(readDownloads(root), fixtureDownloads());
});
