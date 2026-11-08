/**
 * scripts/android/create-upload-key.ps1 - the -DryRun contract (the only way an agent ever runs it):
 * it prints the plan, asks nothing, creates nothing, and refuses when a keystore already exists.
 *
 *   node --test scripts/android/create-upload-key.test.mjs
 *
 * Windows only (PowerShell + the project's JDK, resolved by scripts/android/env.ps1); skipped elsewhere.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, 'create-upload-key.ps1');
const jdk = process.env.DIARY_ANDROID_JDK || 'C:\\Users\\AVI\\Tools\\jdk-21';
const canRun = process.platform === 'win32' && existsSync(path.join(jdk, 'bin', 'keytool.exe'));

function dryRun(outputDir) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-DryRun', '-OutputDir', outputDir], { encoding: 'utf8', timeout: 120000 });
  return { status: result.status, out: `${result.stdout}\n${result.stderr}` };
}

test('-DryRun prints the plan (RSA 2048, alias upload, >= 25 years, PKCS12, password via environment) and creates nothing', { skip: !canRun && 'Windows with the project JDK only' }, () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'upload-key-dryrun-'));
  try {
    const { status, out } = dryRun(dir);
    assert.equal(status, 0, out);
    assert.match(out, /DRY RUN/);
    assert.match(out, /keytool\.exe/);
    assert.match(out, /-keyalg RSA -keysize 2048 -validity 10000/);
    assert.match(out, /-alias upload/);
    assert.match(out, /-storetype PKCS12/);
    assert.match(out, /-storepass:env DIARY_UPLOAD_KEY_PASSWORD -keypass:env DIARY_UPLOAD_KEY_PASSWORD/);
    assert.match(out, /27\.4 years/);
    assert.match(out, /storePassword=<hidden>/);
    assert.match(out, /icacls/);
    assert.match(out, /SHA-256/);
    assert.doesNotMatch(out, /Keystore password \(typed hidden\)/, 'the dry run must not prompt');
    assert.deepEqual(readdirSync(dir), [], 'the dry run must create no file');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('-DryRun writes nothing outside the output folder either: no android\\local.properties, no gradle-home (env.ps1 with $AndroidEnvNoWrites)', { skip: !canRun && 'Windows with the project JDK only' }, () => {
  // A throwaway copy of the project layout, so that what env.ps1 would write lands in the temp tree, not
  // in the real android\ folder: <tmp>\proj\scripts\android\{env.ps1,create-upload-key.ps1} and an empty
  // <tmp>\proj\android\gradlew.bat (env.ps1 only checks that it exists).
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'upload-key-nowrites-'));
  try {
    const scripts = path.join(tmp, 'proj', 'scripts', 'android');
    const android = path.join(tmp, 'proj', 'android');
    const out = path.join(tmp, 'out');
    const gradleHome = path.join(tmp, 'gradle-home');
    for (const dir of [scripts, android, out]) mkdirSync(dir, { recursive: true });
    for (const name of ['env.ps1', 'create-upload-key.ps1']) copyFileSync(path.join(here, name), path.join(scripts, name));
    writeFileSync(path.join(android, 'gradlew.bat'), '');
    const env = { ...process.env, DIARY_GRADLE_USER_HOME: gradleHome };

    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(scripts, 'create-upload-key.ps1'), '-DryRun', '-OutputDir', out], { encoding: 'utf8', timeout: 120000, env });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /dry run finished/);
    assert.deepEqual(readdirSync(out), [], 'nothing in the output folder');
    assert.deepEqual(readdirSync(android), ['gradlew.bat'], 'env.ps1 must not write android\\local.properties for create-upload-key.ps1');
    assert.equal(existsSync(gradleHome), false, 'env.ps1 must not create GRADLE_USER_HOME for create-upload-key.ps1');

    // Control: the same env.ps1 dot-sourced WITHOUT the flag (what build-aab.ps1 does) still writes both,
    // so the assertions above are not vacuous.
    const control = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `. '${path.join(scripts, 'env.ps1').replace(/'/g, "''")}'`], { encoding: 'utf8', timeout: 120000, env });
    assert.equal(control.status, 0, `${control.stdout}\n${control.stderr}`);
    assert.ok(existsSync(path.join(android, 'local.properties')), 'env.ps1 without the flag writes local.properties');
    assert.ok(existsSync(gradleHome), 'env.ps1 without the flag creates GRADLE_USER_HOME');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('an existing keystore in the output folder makes the script refuse, even in -DryRun', { skip: !canRun && 'Windows with the project JDK only' }, () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'upload-key-existing-'));
  try {
    writeFileSync(path.join(dir, 'upload-keystore.jks'), Buffer.alloc(0)); // an empty marker, not a keystore
    const { status, out } = dryRun(dir);
    assert.equal(status, 1, out);
    assert.match(out, /refusing to overwrite the existing keystore/);
    assert.deepEqual(readdirSync(dir), ['upload-keystore.jks']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
