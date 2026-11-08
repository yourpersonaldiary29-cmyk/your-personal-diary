/**
 * scripts/android/release-checks.ps1 - what build-aab.ps1 checks before a release build:
 *  - the release BUILD TYPE of android/app/build.gradle (R8, resource shrinking, proguard rules, signing),
 *    tested on mutated copies of the real file: signingConfigs.release comes first in the file and the
 *    debug build type sits next to release, so neither may be mistaken for it;
 *  - play/last-upload.json: a null / missing / non-integer versionCode is an error, never a silent 0.
 *
 *   node --test scripts/android/release-checks.test.mjs
 *
 * Windows PowerShell only (the script is dot-sourced; it writes nothing); skipped elsewhere.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const checksScript = path.join(here, 'release-checks.ps1');
const realGradle = readFileSync(path.join(here, '..', '..', 'android', 'app', 'build.gradle'), 'utf8').replace(/\r\n/g, '\n');
const APP_ID = 'app.yourpersonaldiary';
const canRun = process.platform === 'win32';
const skip = !canRun && 'Windows PowerShell only';

const psQuote = (s) => `'${s.replace(/'/g, "''")}'`;

function powershell(command) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], { encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

/** Runs Get-GradleReleaseChecks on each text; returns, per text, { <check name>: true|false }. */
function gradleChecks(texts) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'release-checks-'));
  try {
    const files = texts.map((text, i) => {
      const file = path.join(dir, `build-${i}.gradle`);
      writeFileSync(file, text);
      return file;
    });
    const command = [
      `. ${psQuote(checksScript)}`,
      `$all = @(foreach ($f in @(${files.map(psQuote).join(', ')})) { $h = [ordered]@{}; foreach ($c in (Get-GradleReleaseChecks -Gradle ([System.IO.File]::ReadAllText($f)) -AppId '${APP_ID}')) { $h[$c.Name] = [bool]$c.Ok }; New-Object psobject -Property $h })`,
      'ConvertTo-Json -InputObject $all -Depth 3 -Compress',
    ].join('; ');
    return JSON.parse(powershell(command));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Replaces exactly one occurrence of `from` (fails the test when it is not there exactly once). */
function mutate(text, from, to) {
  const at = text.indexOf(from);
  assert.ok(at >= 0 && text.indexOf(from, at + 1) < 0, `expected exactly one ${JSON.stringify(from)} in build.gradle`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

const R8 = 'release: minifyEnabled true (R8)';
const SHRINK = 'release: shrinkResources true';
const PROGUARD = 'release: proguard-rules.pro';
const SIGNING = 'release: signingConfig signingConfigs.release when keystore.properties exists';
const releaseChecks = [R8, SHRINK, PROGUARD, SIGNING];

test('build.gradle: the current file passes all 8 checks; each release mutation fails exactly its check', { skip }, () => {
  const releaseMinify = '            minifyEnabled true\n';
  const debugMinify = '            minifyEnabled false\n';
  const bundleBlock = /\n    bundle \{[\s\S]*?\n    \}\n/.exec(realGradle)?.[0];
  assert.ok(bundleBlock, 'build.gradle has a bundle { } block');
  const cases = {
    current: realGradle,
    releaseMinifyOff: mutate(realGradle, releaseMinify, '            minifyEnabled false\n'),
    noShrink: mutate(realGradle, '            shrinkResources true\n', ''),
    noSigning: mutate(realGradle, '                signingConfig signingConfigs.release\n', ''),
    // The case the old regex got wrong: debug minified, release not -> must NOT pass the R8 check.
    swapped: mutate(mutate(mutate(realGradle, releaseMinify, '            minifyEnabled SWAP\n'), debugMinify, '            minifyEnabled true\n'), 'minifyEnabled SWAP', 'minifyEnabled false'),
    // The old regex depended on the bundle { } block following buildTypes.
    noBundleBlock: mutate(realGradle, bundleBlock, '\n'),
    // A commented-out line does not count.
    commentedMinify: mutate(realGradle, releaseMinify, '            // minifyEnabled true\n'),
  };
  const names = Object.keys(cases);
  const results = Object.fromEntries(gradleChecks(Object.values(cases)).map((r, i) => [names[i], r]));
  const failed = (name) => Object.entries(results[name]).filter(([, ok]) => !ok).map(([check]) => check);

  assert.equal(Object.keys(results.current).length, 8);
  assert.deepEqual(failed('current'), [], JSON.stringify(results.current, null, 2));
  assert.deepEqual(failed('releaseMinifyOff'), [R8]);
  assert.deepEqual(failed('noShrink'), [SHRINK]);
  assert.deepEqual(failed('noSigning'), [SIGNING]);
  assert.deepEqual(failed('swapped'), [R8]);
  assert.deepEqual(failed('noBundleBlock'), []);
  assert.deepEqual(failed('commentedMinify'), [R8]);
  for (const check of releaseChecks) assert.ok(check in results.current, `check ${check} exists`);
});

test('play/last-upload.json: integers (or digit strings) are read; null, missing, "", true, 1.5, bad JSON are errors, never 0', { skip }, () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'last-upload-'));
  try {
    const cases = {
      zero: '{"versionCode": 0, "versionName": null}',
      four: '{"versionCode": 4, "versionName": "0.1.0"}',
      digitString: '{"versionCode": "7"}',
      bom: '﻿{"versionCode": 3}',
      nullCode: '{"versionCode": null, "versionName": null}',
      missing: '{"versionName": "0.1.0"}',
      empty: '{"versionCode": ""}',
      bool: '{"versionCode": true}',
      fraction: '{"versionCode": 1.5}',
      negative: '{"versionCode": -1}',
      tooBig: '{"versionCode": 2100000001}',
      notJson: '{versionCode: 4',
    };
    const files = Object.entries(cases).map(([name, body]) => {
      const file = path.join(dir, `${name}.json`);
      writeFileSync(file, body);
      return file;
    });
    const command = [
      `. ${psQuote(checksScript)}`,
      `$all = @(foreach ($f in @(${files.map(psQuote).join(', ')})) { $r = Read-LastUploadVersionCode $f; New-Object psobject -Property ([ordered]@{ code = $r.Code; error = $r.Error }) })`,
      'ConvertTo-Json -InputObject $all -Depth 3 -Compress',
    ].join('; ');
    const out = JSON.parse(powershell(command));
    const byName = Object.fromEntries(Object.keys(cases).map((name, i) => [name, out[i]]));
    assert.deepEqual(byName.zero, { code: 0, error: null });
    assert.deepEqual(byName.four, { code: 4, error: null });
    assert.deepEqual(byName.digitString, { code: 7, error: null });
    assert.deepEqual(byName.bom, { code: 3, error: null });
    for (const name of ['nullCode', 'missing', 'empty', 'bool', 'fraction', 'negative', 'tooBig', 'notJson']) {
      assert.equal(byName[name].code, null, `${name} must not yield a versionCode: ${JSON.stringify(byName[name])}`);
      assert.ok(byName[name].error, `${name} must explain why`);
    }
    assert.match(byName.nullCode.error, /versionCode is null/);
    assert.match(byName.missing.error, /versionCode is missing/);
    assert.match(byName.notJson.error, /not valid JSON/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
