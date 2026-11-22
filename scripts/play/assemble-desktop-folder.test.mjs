/**
 * Tests of scripts/play/assemble-desktop-folder.mjs on an EXISTING folder (Node's own test runner - no vitest
 * project covers scripts/):
 *
 *   node --test scripts/play/assemble-desktop-folder.test.mjs
 *
 * Every run works on a folder of its own in the temp directory - never on the owner's folder next to the project.
 *
 * Part 6 of the owner's Google Play folder holds three things: the short readme the script writes, and - copied
 * there by hand after a build - the signed bundle of the latest version with the note of that version. The readme
 * used to say the bundle "is built after you create the upload key"; the key exists since 2026-11-22 and the
 * bundle is in the folder, so the readme says that now (docs/PLAY-RELEASE.he.md, parts A and B). A refresh must
 * bring the new readme and the current guide pages into the folder and touch nothing else in part 6.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = path.join(root, 'scripts', 'play', 'assemble-desktop-folder.mjs');
const PART_6 = '6 - קובץ האפליקציה לחנות';
const README = 'קרא אותי.txt';
const GUIDE = '1 - מדריך - פתח אותי קודם.html';
const BOM = String.fromCharCode(0xfeff);

const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });

function withFolder(body) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mpd-play-folder-'));
  try {
    return body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('--refresh-guides rewrites the guide pages and the readme of part 6, and leaves the bundle and its note alone', () => {
  withFolder((dir) => {
    const part6 = path.join(dir, PART_6);
    mkdirSync(part6);
    const bundle = 'Your Personal Diary - 9.9.9 (versionCode 99).aab';
    const note = 'קובץ ה-AAB - גרסה 9.9.9.txt';
    writeFileSync(path.join(part6, bundle), Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00, 0x0d, 0x0a]));
    writeFileSync(path.join(part6, note), `${BOM}the note of this bundle\r\n`);
    // The readme as the script wrote it until 2026-11-22.
    writeFileSync(path.join(part6, README), `${BOM}הקובץ נבנה אחרי שתיצור את מפתח ההעלאה שלך (המדריך, חלק א).\r\n`);

    const result = run('--refresh-guides', dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /refreshed 3 guide pages and the readme of part 6/);

    // Part 6: the same three files; the bundle and its note byte for byte as they were.
    assert.deepEqual(readdirSync(part6).sort(), [bundle, note, README].sort());
    assert.deepEqual([...readFileSync(path.join(part6, bundle))], [0x50, 0x4b, 0x03, 0x04, 0xff, 0x00, 0x0d, 0x0a]);
    assert.equal(readFileSync(path.join(part6, note), 'utf8'), `${BOM}the note of this bundle\r\n`);

    // The readme: Notepad-friendly (one BOM, CRLF lines), and it no longer waits for a key that exists.
    const readme = readFileSync(path.join(part6, README), 'utf8');
    assert.ok(readme.startsWith(BOM), 'the readme starts with a byte order mark');
    assert.equal(readme.split(BOM).length - 1, 1, 'exactly one byte order mark');
    assert.ok(readme.endsWith('\r\n'), 'the readme ends with a line break');
    assert.equal(/[^\r]\n/.test(readme), false, 'every line break is CRLF');
    const lines = readme.slice(BOM.length).split('\r\n').filter((line) => line !== '');
    assert.equal(lines.length, 3);
    assert.match(lines[0], /AAB/);
    assert.match(lines[1], /נמצא בתיקייה הזו, עם קובץ הסבר לידו/);
    assert.match(lines[1], /לכל גרסה חדשה בונים קובץ חדש \(המדריך, חלק ב\)/);
    assert.match(lines[2], /Your Personal Diary - installers/);
    assert.equal(readme.includes('אחרי שתיצור'), false, 'the readme does not tell the owner to create the key he has');
    assert.equal(readme.includes('חלק א'), false, 'the readme does not send the owner to part A of the guide');

    // The guide pages: rendered from the current sources, and the part the readme points to is in the guide.
    const guide = readFileSync(path.join(dir, GUIDE), 'utf8');
    assert.ok(guide.startsWith('<!DOCTYPE html>\n<html lang="he" dir="rtl">'));
    const heading = /^# (.+)$/m.exec(readFileSync(path.join(root, 'docs', 'PLAY-RELEASE.he.md'), 'utf8'));
    assert.ok(heading, 'docs/PLAY-RELEASE.he.md has a title');
    assert.ok(guide.includes(`<h1>${heading[1].trim()}</h1>`), 'the guide page carries the title of docs/PLAY-RELEASE.he.md');
    assert.match(guide, /<h2>חלק ב [^<]*<\/h2>/, 'the guide has the part B the readme names');
    // The guide itself writes "{{...}}" when it explains the placeholder check; a filled-in name would be a leftover.
    assert.equal(guide.replace(/\{\{\.\.\.\}\}/g, '').includes('{{'), false, 'no placeholder is left in the guide page');
    for (const page of ['1b - מה יש בתיקייה.html', path.join('3 - צילומי מסך לפי שפה', 'הסבר על הצילומים.html')]) {
      assert.ok(readFileSync(path.join(dir, page), 'utf8').startsWith('<!DOCTYPE html>'), page);
    }
    // Nothing else appeared in the folder: a refresh is not an assembly.
    assert.deepEqual(readdirSync(dir).sort(), [GUIDE, '1b - מה יש בתיקייה.html', '3 - צילומי מסך לפי שפה', PART_6].sort());
  });
});

test('--refresh-guides creates the readme of part 6 in a folder that has no part 6 yet', () => {
  withFolder((dir) => {
    const result = run('--refresh-guides', dir);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readdirSync(path.join(dir, PART_6)), [README]);
  });
});

test('a refresh refuses a folder that does not exist, and an assembly refuses one that does', () => {
  withFolder((dir) => {
    const missing = run('--refresh-guides', path.join(dir, 'no-such-folder'));
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /no such folder to refresh/);
    assert.deepEqual(readdirSync(dir), [], 'nothing was created');

    // The owner's folder is never overwritten by an assembly: an existing destination is refused untouched.
    writeFileSync(path.join(dir, 'kept.txt'), 'kept');
    const existing = run(dir);
    assert.equal(existing.status, 1);
    assert.match(existing.stderr, /exists already - not overwriting/);
    assert.deepEqual(readdirSync(dir), ['kept.txt']);
  });
});
