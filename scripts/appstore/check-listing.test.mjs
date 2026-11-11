/**
 * Tests of the App Store listing checker (Node's own test runner - no vitest project covers scripts/):
 *
 *   node --test scripts/appstore/check-listing.test.mjs
 *
 * 1. The real kit passes: all 19 localizations of appstore/listing/ (ten field files each, both record names, keywords
 *    within 100 UTF-8 bytes, the minimum age of legal/settings.json in every description), the Bulgarian note, and the
 *    Bulgarian draft _bg under the same rules; appstore/locales.json maps the app's 20 UI languages exactly as
 *    docs/apple-tasks/ENV-FINAL.md says (Bulgarian has no App Store localization).
 * 2. Every rule catches a broken fixture (a temp copy of en-US, he, bg, locales.json and a settings.json whose
 *    "minimumAge" is the age the real texts state, so these tests do not depend on the real legal/settings.json):
 *    the App Store Connect limits in code points and the keyword limit in bytes, the two names, the keyword rules, the
 *    minimum age, the forbidden platform terms in several scripts, file hygiene, the URLs, plain text, translation /
 *    script, completeness and the locales file - and the command line exits 1 on a problem and 0 (with the table)
 *    when clean.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BRAND,
  DEFAULT_LISTING_DIR,
  DEFAULT_LOCALES_FILE,
  FIELDS,
  FILES,
  KEYWORD_BYTES,
  MAC_NAME,
  NOTE_FILE,
  ROOT,
  SCRIPTS,
  checkListing,
  count,
  keywordProblems,
  lastParagraph,
  loadLocales,
  loadMinimumAge,
  minimumAgeProblems,
  numbersIn,
  textProblems,
  wordsOf,
} from './check-listing.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHECKER = path.join(HERE, 'check-listing.mjs');
/** The base writer's folders: the two written localizations and the Bulgarian note. */
const BASE = ['en-US', 'he', 'bg'];
/** The App Store Connect codes of docs/apple-tasks/ENV-FINAL.md ("APPLE LOCALE MAPPING"), Portuguese decided as pt-PT. */
const EXPECTED_FOLDERS = {
  en: 'en-US', he: 'he', ar: 'ar-SA', zh: 'zh-Hans', ja: 'ja', hi: 'hi', th: 'th', es: 'es-ES', pt: 'pt-PT', fr: 'fr-FR',
  it: 'it', de: 'de-DE', ro: 'ro', el: 'el', pl: 'pl', cs: 'cs', hu: 'hu', ru: 'ru', bg: null, tr: 'tr',
};
/** The minimum age the real descriptions state (the last paragraph of en-US) - the fixtures' settings.json holds it. */
const AGE_IN_TEXTS = numbersIn(lastParagraph(readFileSync(path.join(DEFAULT_LISTING_DIR, 'en-US', 'description.txt'), 'utf8')))[0];

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'appstore-listing-'));
  const dir = path.join(root, 'listing');
  mkdirSync(dir);
  for (const folder of BASE) cpSync(path.join(DEFAULT_LISTING_DIR, folder), path.join(dir, folder), { recursive: true });
  const localesFile = path.join(root, 'locales.json');
  copyFileSync(DEFAULT_LOCALES_FILE, localesFile);
  const settingsFile = path.join(root, 'settings.json');
  writeFileSync(settingsFile, JSON.stringify({ minimumAge: AGE_IN_TEXTS }), 'utf8');
  return { root, dir, localesFile, settingsFile };
}

function withFixture(mutate, only = BASE) {
  const fx = fixture();
  try {
    mutate(fx.dir, fx);
    return checkListing(fx.dir, { only, localesFile: fx.localesFile, settingsFile: fx.settingsFile });
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
}

const read = (dir, folder, file) => readFileSync(path.join(dir, folder, file), 'utf8');
const write = (dir, folder, file, text) => writeFileSync(path.join(dir, folder, file), text, 'utf8');

function problemsOf(result, folder, file) {
  return result.rows.filter((r) => r.folder === folder && r.file === file).flatMap((r) => r.problems);
}

/** Every failing file of a result, one line each (readable assertion messages). */
function failures(result) {
  return result.rows.filter((r) => r.problems.length).map((r) => `${r.folder}/${r.file}: ${r.problems.join('; ')}`);
}

function expectProblem(result, folder, file, re) {
  const list = problemsOf(result, folder, file);
  assert.ok(list.some((p) => re.test(p)), `${folder}/${file}: expected a problem matching ${re}, got ${JSON.stringify(list)}`);
  assert.equal(result.ok, false);
}

function expectFolderProblem(result, re) {
  assert.ok(result.problems.some((p) => re.test(p)), `expected a folder-level problem matching ${re}, got ${JSON.stringify(result.problems)}`);
  assert.equal(result.ok, false);
}

/** The problems of a one-off text, without the en-US comparison and without reserved words. */
function probe(appLocale, file, text) {
  return textProblems(appLocale, file, text, null, new Set()).problems;
}

/** A locales.json edit on the fixture copy. */
function withLocales(mutate) {
  return withFixture((dir, fx) => {
    const json = JSON.parse(readFileSync(fx.localesFile, 'utf8'));
    mutate(json);
    writeFileSync(fx.localesFile, JSON.stringify(json, null, 2), 'utf8');
  });
}

// ---------------------------------------------------------------------------------------------
test('the real en-US and he listings and the Bulgarian note pass', () => {
  const result = checkListing(DEFAULT_LISTING_DIR, { only: BASE });
  assert.deepEqual(failures(result), []);
  assert.deepEqual(result.problems, []);
  assert.equal(result.rows.length, 2 * FILES.length);
  assert.deepEqual(result.notes, ['bg: no App Store localization (bg/NOTE.txt present)']);
  assert.ok(result.ok);
  const run = spawnSync(process.execPath, [CHECKER, '--only', 'en-US,he,bg'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('the whole real kit passes: 19 localizations, ten files each, both names, keywords within 100 bytes, the minimum age', () => {
  const result = checkListing();
  assert.deepEqual(failures(result), []);
  assert.deepEqual(result.problems, []);
  const folders = [...new Set(result.rows.map((r) => r.folder))];
  assert.equal(folders.length, 19);
  assert.deepEqual(folders.sort(), Object.values(EXPECTED_FOLDERS).filter(Boolean).sort());
  assert.equal(result.rows.length, 19 * FILES.length);
  for (const folder of folders) {
    const row = (file) => result.rows.find((r) => r.folder === folder && r.file === file);
    assert.equal(row('name-mac.txt').chars, Array.from(MAC_NAME).length, `${folder}/name-mac.txt`);
    assert.ok(row('keywords.txt').bytes <= KEYWORD_BYTES, `${folder}/keywords.txt: ${row('keywords.txt').bytes} bytes`);
  }
  const { age, problems } = loadMinimumAge();
  assert.deepEqual(problems, []);
  assert.equal(result.minimumAge, age);
  assert.ok(result.ok);
});

test('the Bulgarian draft _bg (kept for reuse, skipped by the command) follows the same rules', () => {
  const draft = path.join(DEFAULT_LISTING_DIR, '_bg');
  assert.deepEqual(readdirSync(draft).sort(), [...FILES, NOTE_FILE].sort(), '_bg holds the field files and its NOTE.txt');
  const root = mkdtempSync(path.join(os.tmpdir(), 'appstore-bg-draft-'));
  try {
    const dir = path.join(root, 'listing');
    mkdirSync(dir);
    cpSync(path.join(DEFAULT_LISTING_DIR, 'en-US'), path.join(dir, 'en-US'), { recursive: true });
    cpSync(draft, path.join(dir, 'bg-BG'), { recursive: true });
    rmSync(path.join(dir, 'bg-BG', NOTE_FILE));
    const json = JSON.parse(readFileSync(DEFAULT_LOCALES_FILE, 'utf8'));
    json.bg = { folder: 'bg-BG', appleName: 'Bulgarian', note: 'test only: the _bg draft under a temporary code' };
    const localesFile = path.join(root, 'locales.json');
    writeFileSync(localesFile, JSON.stringify(json, null, 2), 'utf8');
    // The real legal/settings.json: the draft states the same minimum age as the 19 folders.
    const result = checkListing(dir, { only: ['en-US', 'bg-BG'], localesFile });
    assert.deepEqual(failures(result), []);
    assert.deepEqual(result.problems, []);
    assert.equal(result.rows.filter((r) => r.folder === 'bg-BG').length, FILES.length);
    assert.ok(result.ok);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appstore/locales.json maps the 20 UI languages of the app to the App Store Connect codes of ENV-FINAL', () => {
  const { entries, problems } = loadLocales();
  assert.deepEqual(problems, []);
  const locales = readFileSync(path.join(ROOT, 'shared', 'i18n', 'locales.ts'), 'utf8');
  const appCodes = [...locales.matchAll(/\{ code: '([a-z]{2})'/g)].map((m) => m[1]);
  assert.equal(appCodes.length, 20);
  assert.deepEqual(Object.keys(entries), appCodes, 'same languages in the same order as shared/i18n/locales.ts');
  assert.deepEqual(Object.fromEntries(Object.entries(entries).map(([app, def]) => [app, def.folder])), EXPECTED_FOLDERS);
  for (const [app, def] of Object.entries(entries)) {
    if (def.folder) assert.ok(def.appleName, `${app}: Apple's display name`);
    else assert.equal(def.appleName, null);
  }
  const folders = Object.values(entries).map((d) => d.folder).filter(Boolean);
  assert.equal(new Set(folders).size, folders.length, 'folders are unique');
  assert.match(entries.pt.note, /Portugal/);
  assert.match(entries.pt.note, /palavra-passe/);
  assert.match(entries.bg.note, /NOTE\.txt/);
  assert.deepEqual(Object.keys(SCRIPTS).sort(), [...appCodes].sort(), 'the checker knows the script of every language');
});

test('the field files and their App Store Connect limits', () => {
  assert.deepEqual(FILES, ['name.txt', 'name-mac.txt', 'subtitle.txt', 'promotional-text.txt', 'description.txt', 'keywords.txt', 'whats-new.txt', 'support-url.txt', 'privacy-url.txt', 'marketing-url.txt']);
  assert.equal(FIELDS['name.txt'].max, 30);
  assert.equal(FIELDS['name.txt'].exact, BRAND);
  assert.equal(FIELDS['name-mac.txt'].max, 30);
  assert.equal(FIELDS['name-mac.txt'].exact, 'Your Personal Diary for Mac');
  assert.equal(Array.from(MAC_NAME).length, 27);
  assert.equal(FIELDS['subtitle.txt'].max, 30);
  assert.equal(FIELDS['promotional-text.txt'].max, 170);
  assert.equal(FIELDS['description.txt'].max, 4000);
  assert.equal(FIELDS['description.txt'].min, 600);
  assert.equal(FIELDS['keywords.txt'].maxBytes, 100);
  assert.equal(FIELDS['keywords.txt'].max, undefined, 'the keyword limit is in bytes, not characters (APPSTORE-FACTS 2.8)');
  assert.equal(FIELDS['whats-new.txt'].max, 4000);
  assert.equal(FIELDS['marketing-url.txt'].empty, true);
});

test('length: code points, CRLF counts as one break, the final break is not counted', () => {
  assert.equal(count('ab\r\ncd\r\n'), 5);
  assert.equal(count('ab\n'), 2);
  assert.equal(count('😀'), 1);
  assert.equal(count('กำ'), 2);
  assert.equal(count('日本語'), 3);
  assert.deepEqual(probe('en', 'subtitle.txt', `${'x'.repeat(30)}\n`), []);
  assert.deepEqual(probe('th', 'subtitle.txt', `${'ก'.repeat(30)}\n`), []);
});

// ---------------------------------------------------------------------------------------------
test("limits: subtitle, promotional text, description (and its minimum), keywords, what's new", () => {
  expectProblem(withFixture((d) => write(d, 'he', 'subtitle.txt', `${'א'.repeat(31)}\n`)), 'he', 'subtitle.txt', /limit is 30/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'promotional-text.txt', `${'Calm. '.repeat(29).trim()}\n`)), 'en-US', 'promotional-text.txt', /limit is 170/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'description.txt', `${BRAND} is a diary. ${'word '.repeat(810).trim()}\n`)), 'en-US', 'description.txt', /limit is 4000/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'description.txt', `${BRAND} is a diary for your words.\n`)), 'en-US', 'description.txt', /at least 600/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', `${Array.from({ length: 12 }, (_, i) => `keyword${i}`).join(',')}\n`)), 'en-US', 'keywords.txt', /limit is 100 bytes/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'whats-new.txt', `${'Better habits. '.repeat(270).trim()}\n`)), 'en-US', 'whats-new.txt', /limit is 4000/);
});

test('the names: "Your Personal Diary" (iPhone record) and "Your Personal Diary for Mac" (Mac record) in every language', () => {
  expectProblem(withFixture((d) => write(d, 'he', 'name.txt', 'היומן האישי שלך\n')), 'he', 'name.txt', /exactly "Your Personal Diary"/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'name.txt', 'Your Personal Diary - Mood Journal\n')), 'en-US', 'name.txt', /exactly/);
  expectProblem(withFixture((d) => write(d, 'he', 'name-mac.txt', `${BRAND}\n`)), 'he', 'name-mac.txt', /exactly "Your Personal Diary for Mac"/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'name-mac.txt', 'Your Personal Diary for macOS\n')), 'en-US', 'name-mac.txt', /exactly/);
  expectProblem(withFixture((d) => rmSync(path.join(d, 'he', 'name-mac.txt'))), 'he', 'name-mac.txt', /missing/);
});

test('keywords: one line, commas without spaces, unique, not the brand, not a word of the names or subtitle, no plural next to its singular', () => {
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'habits,sleep\nstress\n')), 'en-US', 'keywords.txt', /one line/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'habits, sleep,stress\n')), 'en-US', 'keywords.txt', /space after a comma/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'habits,,sleep\n')), 'en-US', 'keywords.txt', /empty keyword/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'habits,sleep,\n')), 'en-US', 'keywords.txt', /starts or ends with a comma/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'habits,sleep,Habits\n')), 'en-US', 'keywords.txt', /repeats the keyword/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'habits,your personal diary\n')), 'en-US', 'keywords.txt', /app's name/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'habits,journal\n')), 'en-US', 'keywords.txt', /repeats the word "journal" of the name or subtitle/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'habits,Diary\n')), 'en-US', 'keywords.txt', /repeats the word "diary"/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'habits,mac\n')), 'en-US', 'keywords.txt', /repeats the word "mac"/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'habit,habits\n')), 'en-US', 'keywords.txt', /plural/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'habits,ab,sleep\n')), 'en-US', 'keywords.txt', /shorter than three characters/);
  expectProblem(withFixture((d) => write(d, 'he', 'keywords.txt', 'רגשות,יומן\n')), 'he', 'keywords.txt', /repeats the word "יומן"/);
  assert.deepEqual(keywordProblems('habits,sleep,hebrew calendar', 'en', new Set(['journal'])), []);
  // A two-character Chinese or Japanese word is a whole word (appstore/README.md section 2).
  assert.deepEqual(keywordProblems('睡眠,日历', 'zh'), []);
});

test('keywords in Thai, Chinese and Japanese (no spaces between words) must not be a part of the name or subtitle', () => {
  const zhSubtitle = '私密日记，记录心情与习惯';
  const zh = keywordProblems('心情,睡眠,日记本', 'zh', new Set(wordsOf(zhSubtitle, 'zh')), zhSubtitle);
  assert.deepEqual(zh, ['"心情" is already part of the name or subtitle - Apple indexes those already']);
  const thSubtitle = 'ไดอารี่ส่วนตัวและติดตามอารมณ์';
  assert.deepEqual(keywordProblems('อารมณ์,นอน', 'th', new Set(wordsOf(thSubtitle, 'th')), thSubtitle), ['"อารมณ์" is already part of the name or subtitle - Apple indexes those already']);
  const jaSubtitle = '気分と習慣も記録する、私だけの日記';
  assert.ok(keywordProblems('日記,睡眠', 'ja', new Set(wordsOf(jaSubtitle, 'ja')), jaSubtitle).some((p) => /"日記" is already part/.test(p)));
  // Scripts with spaces keep the word rule only: "journaling" is not the word "journal".
  assert.deepEqual(keywordProblems('journaling,sleep', 'en', new Set(['journal']), 'Private journal & mood tracker'), []);
});

test('keywords: the limit is 100 bytes of UTF-8 including the commas (APPSTORE-FACTS 2.8), whatever the character count', () => {
  const letters = 'אבגדהוזחטיכלמנסעפצקרשת';
  const text = `${Array.from({ length: 12 }, (_, i) => letters.slice(i, i + 5)).join(',')}\n`;
  const he = textProblems('he', 'keywords.txt', text, null, new Set());
  assert.equal(he.chars, 71);
  assert.equal(he.bytes, 131);
  assert.ok(he.problems.some((p) => /is 131 bytes of UTF-8 \(71 characters\), the limit is 100 bytes/.test(p)), JSON.stringify(he.problems));
  // Exactly 100 bytes pass, 101 fail (Latin letters take one byte each).
  const latin = (extra) => `${[...'abcdefghi'].map((c) => c.repeat(9)).join(',')},${'j'.repeat(9 + extra)}\n`;
  const at = textProblems('en', 'keywords.txt', latin(1));
  assert.equal(at.bytes, 100);
  assert.deepEqual(at.problems, []);
  const over = textProblems('en', 'keywords.txt', latin(2));
  assert.equal(over.bytes, 101);
  assert.ok(over.problems.some((p) => /101 bytes/.test(p)), JSON.stringify(over.problems));
  // The folder check and the command line fail on it - there is no lenient mode.
  const fx = fixture();
  try {
    write(fx.dir, 'he', 'keywords.txt', text);
    const result = checkListing(fx.dir, { only: BASE, localesFile: fx.localesFile, settingsFile: fx.settingsFile });
    expectProblem(result, 'he', 'keywords.txt', /131 bytes/);
    const run = spawnSync(process.execPath, [CHECKER, '--dir', fx.dir, '--locales', fx.localesFile, '--settings', fx.settingsFile, '--only', 'en-US,he,bg'], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stdout, /^FAIL he\/keywords\.txt \(71 characters\)/m);
    assert.match(run.stdout, /the limit is 100 bytes/);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('minimum age: the last paragraph of every description states legal/settings.json "minimumAge" and no other number', () => {
  assert.equal(Number.isInteger(AGE_IN_TEXTS), true, 'the en-US description states an age in its last paragraph');
  assert.deepEqual(numbersIn('16 歳以上'), [16]);
  assert.deepEqual(numbersIn('لمن هم في سن ١٦ عامًا'), [16]);
  assert.deepEqual(numbersIn('१६ वर्ष'), [16]);
  assert.deepEqual(numbersIn('อายุ ๑๓ ปี'), [13]);
  assert.deepEqual(numbersIn('from 13 to 16'), [13, 16]);
  assert.deepEqual(minimumAgeProblems('Intro.\n\nPlease note\nFor people aged 13 and over.\n', 13), []);
  assert.match(minimumAgeProblems('Intro.\n\nFor people aged 16 and over.\n', 13)[0], /"minimumAge": 13\) and no other number - it gives 16; write 13/);
  assert.match(minimumAgeProblems('Intro.\n\nFor adults.\n', 13)[0], /it gives no number/);
  assert.match(minimumAgeProblems('Intro.\n\nAged 13 and over; 2 tips.\n', 13)[0], /it gives 13, 2/);
  assert.deepEqual(minimumAgeProblems('Aged 16 here.\n\nPlease note\nAged 13 and over.\n', 13), [], 'only the last paragraph counts');

  // Another value in the settings fails every description and says which number to write.
  const other = AGE_IN_TEXTS === 13 ? 14 : 13;
  const changed = withFixture((d, fx) => writeFileSync(fx.settingsFile, JSON.stringify({ minimumAge: other }), 'utf8'));
  for (const folder of ['en-US', 'he']) {
    expectProblem(changed, folder, 'description.txt', new RegExp(`"minimumAge": ${other}\\) and no other number - it gives ${AGE_IN_TEXTS}; write ${other} `));
  }
  // A description edited to another age fails against the same settings.
  expectProblem(
    withFixture((d) => write(d, 'he', 'description.txt', read(d, 'he', 'description.txt').replace(`לבני ${AGE_IN_TEXTS} ומעלה`, `לבני ${other} ומעלה`))),
    'he',
    'description.txt',
    new RegExp(`it gives ${other}; write ${AGE_IN_TEXTS} `),
  );
  // A missing or broken settings file is a problem of its own.
  expectFolderProblem(withFixture((d, fx) => rmSync(fx.settingsFile)), /settings\.json: cannot be read/);
  expectFolderProblem(withFixture((d, fx) => writeFileSync(fx.settingsFile, '{"minimumAge": "16"}', 'utf8')), /"minimumAge" must be a whole number of years/);
});

test('forbidden platform terms (Guideline 2.3.10) in Latin and in the other scripts; "exercise" is fine', () => {
  const forbidden = [
    'Also available on Android.',
    'Get it on Google Play.',
    'In the Play Store too.',
    'Works on Windows.',
    'A Microsoft Store app.',
    'An MSIX package.',
    'Run setup.exe first.',
    'גם לאנדרואיד.',
    'متاح على أندرويد.',
    'Есть версия для Андроид.',
    '也有安卓版。',
    'Androidでも使えます。',
    'वही ऐप एंड्रॉइड पर भी।',
    'มีบนแอนดรอยด์ด้วย',
  ];
  for (const text of forbidden) {
    assert.ok(probe('en', 'promotional-text.txt', `${text}\n`).some((p) => /another platform or store/.test(p)), text);
  }
  assert.deepEqual(probe('en', 'promotional-text.txt', 'Daily exercise and executive notes, with Face ID.\n'), []);
});

test('file hygiene: byte-order mark, final line break, tabs, trailing spaces, double spaces, "{{"', () => {
  expectProblem(withFixture((d) => write(d, 'en-US', 'subtitle.txt', `﻿${read(d, 'en-US', 'subtitle.txt')}`)), 'en-US', 'subtitle.txt', /byte-order mark/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'subtitle.txt', read(d, 'en-US', 'subtitle.txt').trimEnd())), 'en-US', 'subtitle.txt', /line break/);
  const promo = (d) => read(d, 'en-US', 'promotional-text.txt');
  expectProblem(withFixture((d) => write(d, 'en-US', 'promotional-text.txt', promo(d).replace('Write about', 'Write\tabout'))), 'en-US', 'promotional-text.txt', /tab/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'promotional-text.txt', promo(d).replace('tracking.\n', 'tracking. \n'))), 'en-US', 'promotional-text.txt', /space at the end of a line/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'promotional-text.txt', promo(d).replace('your day', 'your  day'))), 'en-US', 'promotional-text.txt', /two spaces/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'whats-new.txt', 'Made by {{PUBLISHER_NAME}}.\n')), 'en-US', 'whats-new.txt', /"\{\{"/);
});

test('URLs: https on yourpersonaldiary.fly.dev with the locale path; the marketing URL stays empty', () => {
  expectProblem(withFixture((d) => write(d, 'en-US', 'support-url.txt', 'http://yourpersonaldiary.fly.dev/support/\n')), 'en-US', 'support-url.txt', /must be exactly https:\/\/yourpersonaldiary\.fly\.dev\/support\//);
  expectProblem(withFixture((d) => write(d, 'en-US', 'support-url.txt', 'https://yourpersonaldiary.fly.dev/support/en/\n')), 'en-US', 'support-url.txt', /must be exactly/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'privacy-url.txt', 'https://yourpersonaldiary.org/privacy/\n')), 'en-US', 'privacy-url.txt', /must be exactly/);
  expectProblem(withFixture((d) => write(d, 'he', 'support-url.txt', 'https://yourpersonaldiary.fly.dev/support/\n')), 'he', 'support-url.txt', /support\/he\//);
  expectProblem(withFixture((d) => write(d, 'he', 'privacy-url.txt', 'https://yourpersonaldiary.fly.dev/privacy/iw/\n')), 'he', 'privacy-url.txt', /privacy\/he\//);
  expectProblem(withFixture((d) => write(d, 'en-US', 'marketing-url.txt', 'https://yourpersonaldiary.org/\n')), 'en-US', 'marketing-url.txt', /must be empty/);
  assert.deepEqual(probe('en', 'marketing-url.txt', ''), []);
  assert.deepEqual(probe('en', 'marketing-url.txt', '\n'), []);
  assert.deepEqual(probe('de', 'support-url.txt', 'https://yourpersonaldiary.fly.dev/support/de/\n'), []);
});

test("description and what's new are plain text: no Markdown, HTML, emoji or other bullets; the first paragraph names the app", () => {
  const add = (extra) => (d) => write(d, 'en-US', 'description.txt', read(d, 'en-US', 'description.txt').replace('No ads, no analytics, no tracking.', `No ads, no analytics, no tracking. ${extra}`));
  expectProblem(withFixture(add('**Private.**')), 'en-US', 'description.txt', /Markdown marker/);
  expectProblem(withFixture(add('## Private')), 'en-US', 'description.txt', /Markdown marker/);
  expectProblem(withFixture(add('Open `Settings`.')), 'en-US', 'description.txt', /Markdown marker/);
  expectProblem(withFixture(add('<b>Private.</b>')), 'en-US', 'description.txt', /HTML/);
  expectProblem(withFixture(add('Write daily 📔')), 'en-US', 'description.txt', /emoji/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'description.txt', read(d, 'en-US', 'description.txt').replace('\n- Daily and weekly habits', '\n• Daily and weekly habits'))), 'en-US', 'description.txt', /bullet/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'description.txt', `A diary for you.\n\n${read(d, 'en-US', 'description.txt')}`)), 'en-US', 'description.txt', /first paragraph must name the app/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'whats-new.txt', 'Version 1.0 🎉\n')), 'en-US', 'whats-new.txt', /emoji/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'subtitle.txt', 'Private journal ✨\n')), 'en-US', 'subtitle.txt', /emoji/);
});

test("translations: written in the language's script and not the English text; brand and product terms do not count", () => {
  expectProblem(withFixture((d) => write(d, 'he', 'description.txt', read(d, 'en-US', 'description.txt'))), 'he', 'description.txt', /English text, not a translation|not written in Hebrew/);
  expectProblem(withFixture((d) => write(d, 'he', 'promotional-text.txt', read(d, 'en-US', 'promotional-text.txt'))), 'he', 'promotional-text.txt', /English text|not written in Hebrew/);
  expectProblem(withFixture((d) => write(d, 'he', 'subtitle.txt', 'Private journal, mood, habits\n')), 'he', 'subtitle.txt', /not written in Hebrew/);
  assert.deepEqual(probe('he', 'subtitle.txt', 'יומן עם Face ID ו-PDF\n'), []);
  assert.ok(probe('ru', 'subtitle.txt', 'Private journal\n').some((p) => /not written in Cyrillic/.test(p)));
  assert.deepEqual(probe('ja', 'subtitle.txt', '日記と気分の記録\n'), []);
  assert.deepEqual(probe('th', 'subtitle.txt', 'ไดอารี่ส่วนตัว\n'), []);
  assert.deepEqual(probe('el', 'subtitle.txt', 'Προσωπικό ημερολόγιο\n'), []);
  // The English text is allowed in en-US only; the keywords of a translation may use Latin terms where natural.
  assert.deepEqual(probe('ja', 'keywords.txt', '日記,気分,習慣,PDF\n'), []);
});

test('completeness: missing file, missing folders, the Bulgarian note, unexpected folders and files, platform notes', () => {
  expectProblem(withFixture((d) => rmSync(path.join(d, 'he', 'keywords.txt'))), 'he', 'keywords.txt', /missing/);

  // 19 App Store localizations (20 languages minus Bulgarian), 2 of them in the fixture: 17 are missing.
  const all = withFixture(() => {}, null);
  assert.equal(all.ok, false);
  assert.equal(all.problems.filter((p) => /localization folder missing/.test(p)).length, 17);
  assert.ok(all.problems.some((p) => /zh-Hans \(Chinese \(Simplified\)\)/.test(p)));

  expectFolderProblem(withFixture((d) => rmSync(path.join(d, 'bg', 'NOTE.txt'))), /bg\/NOTE\.txt must exist/);
  expectFolderProblem(withFixture((d) => write(d, 'bg', 'subtitle.txt', 'x\n')), /bg: has no App Store localization - only NOTE\.txt/);
  expectFolderProblem(withFixture((d) => mkdirSync(path.join(d, 'pt-BR'))), /unexpected folder: pt-BR/);
  expectFolderProblem(withFixture((d) => write(d, 'he', 'notes.txt', 'x\n')), /he: unexpected file\(s\): notes\.txt/);
  expectFolderProblem(withFixture((d) => rmSync(path.join(d, 'he', 'platform-notes.md'))), /he: platform-notes\.md is missing/);
  expectFolderProblem(withFixture((d) => write(d, 'he', 'platform-notes.md', 'Notes about the Windows build.\n')), /he\/platform-notes\.md: names another platform/);
  const copied = withFixture((d) => cpSync(path.join(d, 'he'), path.join(d, 'de-DE'), { recursive: true }), [...BASE, 'de-DE']);
  assert.ok(copied.problems.some((p) => /de-DE: unexpected file platform-notes\.md/.test(p)), JSON.stringify(copied.problems));
  assert.ok(problemsOf(copied, 'de-DE', 'subtitle.txt').some((p) => /not written in Latin/.test(p)));
  // Folders starting with "_" (archives, drafts) are ignored.
  assert.ok(withFixture((d) => mkdirSync(path.join(d, '_drafts'))).ok);
});

test('locales.json itself is validated', () => {
  expectFolderProblem(withLocales((j) => { j.de.folder = 'he'; }), /folder he is used by both he and de/);
  expectFolderProblem(withLocales((j) => { j.en.folder = 'en'; }), /en must map to the primary localization en-US/);
  expectFolderProblem(withLocales((j) => { j.tr.folder = 'Turkish'; }), /tr\.folder must be an App Store Connect localization code/);
  expectFolderProblem(withLocales((j) => { j.tr.appleName = ''; }), /tr\.appleName/);
  expectFolderProblem(withLocales((j) => { j.bg.appleName = 'Bulgarian'; }), /bg\.appleName must be null/);
  expectFolderProblem(withLocales((j) => { delete j.tr.note; }), /tr\.note must be a string/);
  expectFolderProblem(withFixture((d, fx) => writeFileSync(fx.localesFile, '{ not json', 'utf8')), /cannot be read as JSON/);
  expectFolderProblem(withFixture(() => {}, ['en-US', 'xx']), /--only: xx is not a localization folder/);
});

test('command line: exit 0 with the table when clean, exit 1 with the problems otherwise, --json', () => {
  const fx = fixture();
  try {
    const args = ['--dir', fx.dir, '--locales', fx.localesFile, '--settings', fx.settingsFile];
    let run = spawnSync(process.execPath, [CHECKER, ...args, '--only', 'en-US,he,bg'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /^localization\s+subtitle\s+promo\s+description\s+kw chars\s+kw bytes$/m);
    assert.match(run.stdout, /^limit\s+30\s+170\s+4000\s+-\s+100$/m);
    assert.match(run.stdout, /^en-US\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+$/m);
    assert.match(run.stdout, /^he\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+$/m);
    assert.match(run.stdout, /bg: no App Store localization/);
    assert.match(run.stdout, new RegExp(`every description states the minimum age ${AGE_IN_TEXTS} of legal/settings\\.json`));
    assert.match(run.stdout, /2 localizations, 20 files, all within the App Store limits and rules/);

    run = spawnSync(process.execPath, [CHECKER, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stdout, /FAIL localization folder missing: ru \(Russian\)/);

    write(fx.dir, 'en-US', 'subtitle.txt', 'A diary that also runs on Android\n');
    run = spawnSync(process.execPath, [CHECKER, ...args, '--only', 'en-US'], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stdout, /^FAIL en-US\/subtitle\.txt \(33 characters\)/m);
    assert.match(run.stdout, /limit is 30/);
    assert.match(run.stdout, /Android/);
    assert.match(run.stdout, /problems - fix them and run again/);

    run = spawnSync(process.execPath, [CHECKER, ...args, '--only', 'en-US', '--json'], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    const json = JSON.parse(run.stdout);
    assert.equal(json.ok, false);
    assert.equal(json.minimumAge, AGE_IN_TEXTS);
    const subtitle = json.rows.find((r) => r.folder === 'en-US' && r.file === 'subtitle.txt');
    assert.equal(subtitle.chars, 33);
    assert.ok(subtitle.problems.some((p) => /limit is 30/.test(p)));
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});
