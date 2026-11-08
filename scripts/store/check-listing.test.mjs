/**
 * Tests of the Microsoft Store listing checker (Node's own test runner - no vitest project covers scripts/):
 *
 *   node --test scripts/store/check-listing.test.mjs scripts/store/listing-csv.test.mjs
 *
 * 1. The real store/listing/en-US and he-IL pass; the 20 listing tags are exactly the 20 UI languages of
 *    the app and the 20 <Resource Language> tags of the MSIX package.
 * 2. Every rule catches a broken fixture (a temp copy of en-US + he-IL with one thing broken): Microsoft's
 *    limits, bullets, search-term rules, URL / HTML, emoji, ALL CAPS, the forbidden claims in Latin, Hebrew,
 *    Cyrillic, Greek and CJK text, placeholders, translation / script / structure, missing and unexpected
 *    files and folders - and the command lines (the checker and `store/render.mjs --check`) exit 1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BRAND,
  DEFAULT_LISTING_DIR,
  DEVICE_ONLY_CLAIMS,
  OBSOLETE_CLAIMS,
  FIELDS,
  FILES,
  ROOT,
  STORE_LOCALES,
  checkListing,
  storeLength,
  textProblems,
} from './check-listing.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHECKER = path.join(HERE, 'check-listing.mjs');
const VALUES = { publisherName: 'Fictional Publisher', contactEmail: 'support@example.com', source: 'test' };

function fixture() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'store-listing-'));
  for (const tag of ['en-US', 'he-IL']) cpSync(path.join(DEFAULT_LISTING_DIR, tag), path.join(dir, tag), { recursive: true });
  return dir;
}

function withFixture(mutate, only = ['en-US', 'he-IL']) {
  const dir = fixture();
  try {
    mutate(dir);
    return checkListing(dir, { only, values: VALUES });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const read = (dir, tag, file) => readFileSync(path.join(dir, tag, file), 'utf8');
const write = (dir, tag, file, text) => writeFileSync(path.join(dir, tag, file), text, 'utf8');

function problemsOf(result, tag, file) {
  return result.rows.filter((r) => r.locale === tag && r.file === file).flatMap((r) => r.problems);
}

function expectProblem(result, tag, file, re) {
  const list = problemsOf(result, tag, file);
  assert.ok(list.some((p) => re.test(p)), `${tag}/${file}: expected a problem matching ${re}, got ${JSON.stringify(list)}`);
  assert.equal(result.ok, false);
}

/** Problems of a one-off text, without the en-US comparison. */
function probe(tag, file, text) {
  return textProblems(tag, file, text, null, VALUES).problems;
}

// ---------------------------------------------------------------------------------------------
test('the real en-US and he-IL listings pass', () => {
  const result = checkListing(DEFAULT_LISTING_DIR, { only: ['en-US', 'he-IL'] });
  const bad = result.rows.filter((r) => r.problems.length);
  assert.deepEqual(bad, []);
  assert.deepEqual(result.problems, []);
  assert.equal(result.rows.length, 16);
  assert.ok(result.ok);
});

test('the 20 listing tags are the 20 UI languages of the app and the MSIX resource languages', () => {
  const locales = readFileSync(path.join(ROOT, 'shared', 'i18n', 'locales.ts'), 'utf8');
  const appCodes = [...locales.matchAll(/\{ code: '([a-z]{2})'/g)].map((m) => m[1]).sort();
  assert.equal(appCodes.length, 20);
  assert.deepEqual(Object.values(STORE_LOCALES).map((l) => l.app).sort(), appCodes);
  const msix = readFileSync(path.join(ROOT, 'scripts', 'store', 'msix-lib.mjs'), 'utf8');
  for (const [tag, def] of Object.entries(STORE_LOCALES)) {
    assert.match(msix, new RegExp(`\\b${def.app}: '${tag}'`), `msix-lib.mjs maps ${def.app} to ${tag}`);
  }
  // On Microsoft's list of supported language codes (app-package-requirements#supported-languages).
  const supported = 'en-us he-il zh-cn es-es pl-pl ru-ru fr-fr ar-sa ja-jp tr-tr cs-cz hu-hu bg-bg el-gr pt-pt de-de ro-ro it-it th-th hi-in'.split(' ');
  assert.deepEqual(Object.keys(STORE_LOCALES).map((t) => t.toLowerCase()).sort(), [...supported].sort());
});

test('the field files and their limits follow the current Microsoft pages', () => {
  assert.deepEqual(FILES, ['title.txt', 'short-description.txt', 'description.txt', 'whats-new.txt', 'features.txt', 'keywords.txt', 'copyright.txt', 'support-contact.txt']);
  assert.equal(FIELDS['description.txt'].max, 10000);
  assert.equal(FIELDS['short-description.txt'].max, 1000);
  assert.equal(FIELDS['short-description.txt'].recommended, 270);
  assert.equal(FIELDS['whats-new.txt'].max, 1500);
  assert.deepEqual([FIELDS['features.txt'].items, FIELDS['features.txt'].perItem], [20, 200]);
  assert.deepEqual([FIELDS['keywords.txt'].items, FIELDS['keywords.txt'].perItem, FIELDS['keywords.txt'].words], [7, 40, 21]);
  assert.equal(FIELDS['copyright.txt'].max, 200);
  assert.equal(FIELDS['title.txt'].exact, BRAND);
});

test('length: CRLF counts as one break, the final break is not counted, UTF-16 units', () => {
  assert.equal(storeLength('ab\r\ncd\r\n'), 5);
  assert.equal(storeLength('ab\n'), 2);
  assert.equal(storeLength('😀'), 2);
});

// ---------------------------------------------------------------------------------------------
test('limits: description, short description, what\'s new, copyright', () => {
  expectProblem(withFixture((d) => write(d, 'en-US', 'description.txt', `${BRAND} ${'word '.repeat(2000).trim()}.\n`)), 'en-US', 'description.txt', /limit is 10000/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'short-description.txt', `${'A calm diary. '.repeat(80).trim()}\n`)), 'en-US', 'short-description.txt', /limit is 1000/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'whats-new.txt', `${'Better habits. '.repeat(110).trim()}\n`)), 'en-US', 'whats-new.txt', /limit is 1500/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'copyright.txt', `© 2026 {{PUBLISHER_NAME}}. ${'All rights reserved. '.repeat(10).trim()}\n`)), 'en-US', 'copyright.txt', /limit is 200/);
});

test('a short description over 270 characters is only a warning', () => {
  const result = withFixture((d) => write(d, 'en-US', 'short-description.txt', `${'A calm private diary. '.repeat(14).trim()}\n`));
  const row = result.rows.find((r) => r.locale === 'en-US' && r.file === 'short-description.txt');
  assert.deepEqual(row.problems, []);
  assert.ok(row.warnings.some((w) => /270/.test(w)));
  assert.ok(result.ok);
});

test('features: at most 20, 200 characters each, no own bullets, same count as en-US', () => {
  expectProblem(withFixture((d) => write(d, 'en-US', 'features.txt', `${read(d, 'en-US', 'features.txt')}One more feature\n`)), 'en-US', 'features.txt', /21 items, the limit is 20/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'features.txt', read(d, 'en-US', 'features.txt').replace('Export to TXT', `Export ${'and more '.repeat(30)}to TXT`))), 'en-US', 'features.txt', /limit is 200/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'features.txt', read(d, 'en-US', 'features.txt').replace('Export to TXT', '- Export to TXT'))), 'en-US', 'features.txt', /bullet/);
  expectProblem(withFixture((d) => write(d, 'he-IL', 'features.txt', read(d, 'he-IL', 'features.txt').split('\n').slice(1).join('\n'))), 'he-IL', 'features.txt', /19 features, en-US has 20/);
});

test('search terms: 7 terms, 40 characters, 21 words, unique, no price terms, not the product name', () => {
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', `${read(d, 'en-US', 'keywords.txt')}gratitude\n`)), 'en-US', 'keywords.txt', /8 items, the limit is 7/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'diary\na very long search term about journaling every day\n')), 'en-US', 'keywords.txt', /limit is 40/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'one two three four five six\nseven eight nine ten eleven\ntwelve thirteen fourteen fifteen\nsixteen seventeen eighteen\nnineteen twenty twenty-one twenty-two\n')), 'en-US', 'keywords.txt', /22 words over all terms, the limit is 21/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'diary\nDiary\n')), 'en-US', 'keywords.txt', /unique/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'diary\nfree journal\n')), 'en-US', 'keywords.txt', /price/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'diary\nYour Personal Diary\n')), 'en-US', 'keywords.txt', /product name/);
});

test('title must be the brand in every language', () => {
  expectProblem(withFixture((d) => write(d, 'he-IL', 'title.txt', 'היומן האישי שלך\n')), 'he-IL', 'title.txt', /exactly "Your Personal Diary"/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'title.txt', 'Your Personal Diary - Best Mood Journal\n')), 'en-US', 'title.txt', /exactly/);
});

test('plain text only: no web address, no HTML, no emoji, no ALL CAPS, no repeated punctuation', () => {
  const add = (extra) => (d) => write(d, 'en-US', 'description.txt', read(d, 'en-US', 'description.txt').replace('No ads, no analytics, no tracking.', `No ads, no analytics, no tracking. ${extra}`));
  expectProblem(withFixture(add('See https://yourpersonaldiary.fly.dev for more.')), 'en-US', 'description.txt', /web address/);
  expectProblem(withFixture(add('Visit yourpersonaldiary.fly.dev today.')), 'en-US', 'description.txt', /web address/);
  expectProblem(withFixture(add('<b>Private.</b>')), 'en-US', 'description.txt', /HTML/);
  expectProblem(withFixture(add('Write daily 📔')), 'en-US', 'description.txt', /emoji/);
  expectProblem(withFixture(add('Totally PRIVATE.')), 'en-US', 'description.txt', /ALL CAPS \(PRIVATE\)/);
  expectProblem(withFixture(add('Wow!!')), 'en-US', 'description.txt', /repeats punctuation/);
  // HTTPS, JSON and the © sign are fine.
  assert.deepEqual(probe('en-US', 'copyright.txt', '© 2026 {{PUBLISHER_NAME}}. All rights reserved.\n'), []);
});

test('forbidden claims: store performance, price, calls to action - in several scripts', () => {
  assert.ok(probe('en-US', 'short-description.txt', 'The best diary app.\n').some((p) => /price or call-to-action/.test(p)));
  assert.ok(probe('en-US', 'short-description.txt', 'Download now and write.\n').some((p) => /call-to-action/.test(p)));
  assert.ok(probe('he-IL', 'short-description.txt', 'יומן אישי בחינם לגמרי.\n').some((p) => /price/.test(p)));
  assert.ok(probe('ru-RU', 'short-description.txt', 'Личный дневник, бесплатно для всех.\n').some((p) => /price/.test(p)));
  assert.ok(probe('bg-BG', 'short-description.txt', 'Най-добрият личен дневник.\n').some((p) => /price/.test(p)));
  assert.ok(probe('el-GR', 'short-description.txt', 'Προσωπικό ημερολόγιο δωρεάν.\n').some((p) => /price/.test(p)));
  assert.ok(probe('zh-CN', 'short-description.txt', '免费的私人日记。\n').some((p) => /price/.test(p)));
  assert.ok(probe('ja-JP', 'short-description.txt', '無料のプライベート日記です。\n').some((p) => /price/.test(p)));
  assert.ok(probe('de-DE', 'short-description.txt', 'Das beste private Tagebuch.\n').some((p) => /price/.test(p)));
});

test('forbidden claims: stored only on the PC / no server / fully offline', () => {
  assert.ok(probe('en-US', 'short-description.txt', 'Your diary is stored only on your PC.\n').some((p) => /only on the PC/.test(p)));
  assert.ok(probe('en-US', 'short-description.txt', 'A diary with no cloud.\n').some((p) => /only on the PC/.test(p)));
  assert.ok(probe('en-US', 'short-description.txt', 'Works fully offline.\n').some((p) => /only on the PC/.test(p)));
  assert.ok(probe('he-IL', 'short-description.txt', 'היומן נשמר רק במחשב שלכם.\n').some((p) => /only on the PC/.test(p)));
  assert.ok(probe('ru-RU', 'short-description.txt', 'Дневник хранится только на вашем компьютере.\n').some((p) => /only on the PC/.test(p)));
  assert.ok(probe('zh-CN', 'short-description.txt', '日记仅保存在您的电脑上，没有服务器。\n').some((p) => /only on the PC/.test(p)));
  assert.ok(probe('el-GR', 'short-description.txt', 'Ημερολόγιο χωρίς διακομιστή.\n').some((p) => /only on the PC/.test(p)));
});

test('forbidden claims: end-to-end / zero-knowledge, biometric unlock, retired local features', () => {
  assert.ok(probe('en-US', 'short-description.txt', 'End-to-end encrypted diary.\n').some((p) => /end-to-end/.test(p)));
  assert.ok(probe('en-US', 'short-description.txt', 'Zero knowledge: only you can read it.\n').some((p) => /end-to-end/.test(p)));
  assert.ok(probe('he-IL', 'short-description.txt', 'יומן מוצפן מקצה לקצה.\n').some((p) => /end-to-end/.test(p)));
  assert.ok(probe('ru-RU', 'short-description.txt', 'Дневник со сквозным шифрованием.\n').some((p) => /end-to-end/.test(p)));
  assert.ok(probe('ja-JP', 'short-description.txt', 'エンドツーエンドで暗号化された日記。\n').some((p) => /end-to-end/.test(p)));
  assert.ok(probe('el-GR', 'short-description.txt', 'Κρυπτογράφηση από άκρο σε άκρο.\n').some((p) => /end-to-end/.test(p)));
  assert.ok(probe('en-US', 'short-description.txt', 'Unlock with Windows Hello.\n').some((p) => /biometric/.test(p)));
  assert.ok(probe('he-IL', 'short-description.txt', 'פתיחה עם טביעת אצבע.\n').some((p) => /biometric/.test(p)));
  assert.ok(probe('ru-RU', 'short-description.txt', 'Вход по отпечатку пальца.\n').some((p) => /biometric/.test(p)));
  assert.ok(probe('en-US', 'short-description.txt', 'Remote access through DuckDNS.\n').some((p) => /retired local-only app/.test(p)));
  assert.ok(probe('en-US', 'short-description.txt', 'Open it on your phone on your home network.\n').some((p) => /retired local-only app/.test(p)));
});

/** One "the diary stays only on the PC" sentence and one retired-feature sentence per listing language. */
const DEVICE_ONLY_SAMPLES = {
  'en-US': 'Your diary stays on your PC only.',
  'he-IL': 'היומן נשמר על המחשב שלכם בלבד.',
  'zh-CN': '日记只存在您的电脑上。',
  'es-ES': 'Tu diario se queda solo en tu ordenador.',
  'pl-PL': 'Twój dziennik zostaje tylko na twoim komputerze.',
  'ru-RU': 'Дневник остаётся только на вашем компьютере.',
  'fr-FR': "Votre journal n'est stocké que sur votre PC.",
  'ar-SA': 'تُحفظ يومياتك على جهازك فقط.',
  'ja-JP': '日記はPCにのみ保存されます。',
  'tr-TR': 'Günlüğünüz yalnızca bilgisayarınızda saklanır.',
  'cs-CZ': 'Tvůj deník zůstává jen ve tvém počítači.',
  'hu-HU': 'A naplód csak a gépeden marad.',
  'bg-BG': 'Дневникът остава само на вашия компютър.',
  'el-GR': 'Το ημερολόγιό σου μένει μόνο στον υπολογιστή σου.',
  'pt-PT': 'O seu diário fica apenas no seu computador.',
  'de-DE': 'Dein Tagebuch bleibt auf deinem PC.',
  'ro-RO': 'Jurnalul tău rămâne doar pe calculatorul tău.',
  'it-IT': 'Il tuo diario resta solo sul tuo PC.',
  'th-TH': 'ไดอารี่ของคุณอยู่บนคอมพิวเตอร์ของคุณเท่านั้น',
  'hi-IN': 'आपकी डायरी केवल आपके कंप्यूटर पर रहती है।',
};
const OBSOLETE_SAMPLES = {
  'en-US': 'Remote access to the diary from your home network.',
  'he-IL': 'גישה מרחוק ליומן מהרשת הביתית.',
  'zh-CN': '通过家庭网络远程访问日记。',
  'es-ES': 'Acceso remoto al diario desde la red de casa.',
  'pl-PL': 'Zdalny dostęp do dziennika z sieci domowej.',
  'ru-RU': 'Удалённый доступ к дневнику из домашней сети.',
  'fr-FR': 'Accès à distance au journal depuis le réseau domestique.',
  'ar-SA': 'الوصول عن بُعد إلى اليوميات من الشبكة المنزلية.',
  'ja-JP': '自宅のネットワークから日記にリモートアクセス。',
  'tr-TR': 'Ev ağından günlüğe uzaktan erişim.',
  'cs-CZ': 'Vzdálený přístup k deníku z domácí sítě.',
  'hu-HU': 'Távoli hozzáférés a naplóhoz az otthoni hálózatról.',
  'bg-BG': 'Отдалечен достъп до дневника от домашната мрежа.',
  'el-GR': 'Απομακρυσμένη πρόσβαση στο ημερολόγιο από το οικιακό δίκτυο.',
  'pt-PT': 'Acesso remoto ao diário a partir da rede doméstica.',
  'de-DE': 'Fernzugriff auf das Tagebuch im Heimnetz.',
  'ro-RO': 'Acces de la distanță la jurnal din rețeaua de acasă.',
  'it-IT': 'Accesso remoto al diario dalla rete di casa.',
  'th-TH': 'เข้าถึงไดอารี่ผ่านเครือข่ายในบ้าน',
  'hi-IN': 'होम नेटवर्क से डायरी तक रिमोट एक्सेस।',
};

test('forbidden claims: every language has rules for "only on the PC" and for the retired features', () => {
  for (const tag of Object.keys(STORE_LOCALES)) {
    const app = STORE_LOCALES[tag].app;
    assert.ok(DEVICE_ONLY_CLAIMS[app]?.length, `${tag}: no "only on the PC" patterns`);
    assert.ok(OBSOLETE_CLAIMS[app]?.length, `${tag}: no retired-feature patterns`);
    const device = probe(tag, 'short-description.txt', `${DEVICE_ONLY_SAMPLES[tag]}\n`);
    assert.ok(device.some((p) => /only on the PC/.test(p)), `${tag}: ${DEVICE_ONLY_SAMPLES[tag]} -> ${JSON.stringify(device)}`);
    const obsolete = probe(tag, 'short-description.txt', `${OBSOLETE_SAMPLES[tag]}\n`);
    assert.ok(obsolete.some((p) => /retired local-only app/.test(p)), `${tag}: ${OBSOLETE_SAMPLES[tag]} -> ${JSON.stringify(obsolete)}`);
  }
});

test('forbidden claims: "not only on your PC" (the sync claim) is not mistaken for "only on your PC"', () => {
  const allowed = {
    'en-US': 'Your diary is not only on your PC: it is the same on all your devices.',
    'de-DE': 'Dein Tagebuch ist nicht nur auf deinem PC, sondern auf allen deinen Geräten.',
    'es-ES': 'Tu diario no solo en tu ordenador: también en tu móvil.',
    'ru-RU': 'Дневник не только на вашем компьютере, но и на телефоне.',
    'zh-CN': '日记不仅在您的电脑上，也在您的手机上。',
    'ja-JP': '日記はPCだけでなくスマホでも読めます。',
    'tr-TR': 'Günlüğünüz sadece bilgisayarınızda değil, telefonunuzda da.',
  };
  for (const [tag, text] of Object.entries(allowed)) {
    const problems = probe(tag, 'short-description.txt', `${text}\n`);
    assert.ok(!problems.some((p) => /only on the PC/.test(p)), `${tag}: ${text} -> ${JSON.stringify(problems)}`);
  }
});

test('forbidden claims: the five false features of the verifier\'s run make the command line fail', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'store-listing-claims-'));
  const claims = {
    'ja-JP': '日記はPCにのみ保存されます',
    'de-DE': 'Dein Tagebuch bleibt auf deinem PC',
    'he-IL': 'היומן נשמר על המחשב שלכם בלבד',
    'zh-CN': '日记只存在您的电脑上',
    'ru-RU': 'Удалённый доступ к дневнику из домашней сети',
  };
  try {
    for (const tag of ['en-US', ...Object.keys(claims)]) cpSync(path.join(DEFAULT_LISTING_DIR, tag), path.join(dir, tag), { recursive: true });
    for (const [tag, claim] of Object.entries(claims)) {
      const lines = read(dir, tag, 'features.txt').split('\n');
      lines[0] = claim;
      write(dir, tag, 'features.txt', lines.join('\n'));
    }
    const run = spawnSync(process.execPath, [CHECKER, '--dir', dir, '--only', 'en-US,ru-RU,ja-JP,de-DE,he-IL,zh-CN', '--json'], { encoding: 'utf8' });
    assert.equal(run.status, 1, run.stdout + run.stderr);
    const result = JSON.parse(run.stdout);
    for (const tag of Object.keys(claims)) {
      const problems = result.rows.filter((r) => r.locale === tag && r.file === 'features.txt').flatMap((r) => r.problems);
      assert.ok(problems.some((p) => /only on the PC|retired local-only app/.test(p)), `${tag}: ${JSON.stringify(problems)}`);
    }
    assert.ok(!result.rows.some((r) => r.locale === 'en-US' && r.problems.length), 'en-US is unchanged and clean');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('translations give the English labels Settings and Language (the Store build opens in English)', () => {
  const he = read(DEFAULT_LISTING_DIR, 'he-IL', 'description.txt');
  assert.match(he, /\(Settings\)/);
  assert.match(he, /\(Language\)/);
  const without = withFixture((d) => write(d, 'he-IL', 'description.txt', read(d, 'he-IL', 'description.txt').replace(' (Settings)', '').replace(' (Language)', '')));
  expectProblem(without, 'he-IL', 'description.txt', /English labels "\(Settings\)" and "\(Language\)"/);
  // Every real translation passes the rule (it is part of the full run).
  const all = checkListing(DEFAULT_LISTING_DIR);
  assert.ok(!all.rows.some((r) => r.problems.some((p) => /English label/.test(p))), JSON.stringify(all.rows.filter((r) => r.problems.length)));
});

test('the real Hebrew listing mentions none of the claims (sanity: the brand never triggers a claim)', () => {
  const result = checkListing(DEFAULT_LISTING_DIR, { only: ['he-IL'] });
  assert.ok(result.ok, JSON.stringify(result.rows.filter((r) => r.problems.length)));
});

test('placeholders: only the two known ones, each in its own file; filled before measuring', () => {
  expectProblem(withFixture((d) => write(d, 'en-US', 'copyright.txt', '© 2026 {{PUBLISHER}}. All rights reserved.\n')), 'en-US', 'copyright.txt', /unknown placeholder/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'whats-new.txt', 'Made by {{PUBLISHER_NAME}}.\n- One\n- Two\n- Three\n- Four\n')), 'en-US', 'whats-new.txt', /belongs only in copyright\.txt/);
  expectProblem(withFixture((d) => write(d, 'he-IL', 'support-contact.txt', 'someone.else@example.org\n')), 'he-IL', 'support-contact.txt', /exactly \{\{CONTACT_EMAIL\}\}/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'copyright.txt', '© 2026 Somebody. All rights reserved.\n')), 'en-US', 'copyright.txt', /PUBLISHER_NAME/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'copyright.txt', '© 2026 {{PUBLISHER_NAME}. All rights reserved.\n')), 'en-US', 'copyright.txt', /broken placeholder/);
  // The rendered copies (values filled in) pass.
  assert.deepEqual(probe('en-US', 'support-contact.txt', 'support@example.com\n'), []);
  assert.deepEqual(probe('en-US', 'copyright.txt', '© 2026 Fictional Publisher. All rights reserved.\n'), []);
  const long = textProblems('en-US', 'copyright.txt', `© 2026 {{PUBLISHER_NAME}}. ${'x'.repeat(170)}\n`, null, { ...VALUES, publisherName: 'P'.repeat(30) });
  assert.ok(long.problems.some((p) => /limit is 200/.test(p)), 'the length is measured after filling');
});

test('translations: real translation in the right script with the en-US structure', () => {
  expectProblem(withFixture((d) => write(d, 'he-IL', 'description.txt', read(d, 'en-US', 'description.txt'))), 'he-IL', 'description.txt', /English text, not a translation|not written in Hebrew/);
  expectProblem(withFixture((d) => write(d, 'he-IL', 'short-description.txt', 'A private diary with mood and habits.\n')), 'he-IL', 'short-description.txt', /not written in Hebrew/);
  expectProblem(withFixture((d) => write(d, 'he-IL', 'description.txt', read(d, 'he-IL', 'description.txt').replace('\n\nנגישות\n', '\nנגישות\n'))), 'he-IL', 'description.txt', /structure differs from en-US/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'description.txt', `A diary for you.\n\n${read(d, 'en-US', 'description.txt')}`)), 'en-US', 'description.txt', /first paragraph must name the app/);
});

test('file hygiene: byte-order mark, final line break, double spaces, tabs', () => {
  expectProblem(withFixture((d) => write(d, 'en-US', 'short-description.txt', `﻿${read(d, 'en-US', 'short-description.txt')}`)), 'en-US', 'short-description.txt', /byte-order mark/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'short-description.txt', read(d, 'en-US', 'short-description.txt').trimEnd())), 'en-US', 'short-description.txt', /line break/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'short-description.txt', read(d, 'en-US', 'short-description.txt').replace(' ', '  '))), 'en-US', 'short-description.txt', /two spaces/);
  expectProblem(withFixture((d) => write(d, 'en-US', 'keywords.txt', 'diary\tjournal\n')), 'en-US', 'keywords.txt', /tab/);
});

test('completeness: missing file, missing folder, unexpected folder and file', () => {
  const missingFile = withFixture((d) => rmSync(path.join(d, 'he-IL', 'keywords.txt')));
  expectProblem(missingFile, 'he-IL', 'keywords.txt', /missing/);

  const all = withFixture(() => {}, null);
  assert.equal(all.ok, false);
  assert.equal(all.problems.filter((p) => /language folder missing/.test(p)).length, 18);
  assert.ok(all.problems.some((p) => /zh-CN \(Chinese \(Simplified\)\)/.test(p)));

  const extraFolder = withFixture((d) => mkdirSync(path.join(d, 'pt-BR')));
  assert.ok(extraFolder.problems.some((p) => /unexpected folder: pt-BR/.test(p)));
  const extraFile = withFixture((d) => write(d, 'he-IL', 'notes.txt', 'x\n'));
  assert.ok(extraFile.problems.some((p) => /he-IL: unexpected file\(s\): notes\.txt/.test(p)));
  // Folders starting with "_" (archives) are ignored.
  assert.ok(withFixture((d) => mkdirSync(path.join(d, '_obsolete-2026-10-02'))).ok);
});

test('command lines exit 1 on a problem and 0 when clean', () => {
  const dir = fixture();
  try {
    let run = spawnSync(process.execPath, [CHECKER, '--dir', dir, '--only', 'en-US,he-IL'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /2 languages, 16 files, all within the Store limits and rules/);
    run = spawnSync(process.execPath, [CHECKER, '--dir', dir], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stdout, /language folder missing: hi-IN/);
    write(dir, 'en-US', 'short-description.txt', 'The best diary.\n');
    run = spawnSync(process.execPath, [CHECKER, '--dir', dir, '--only', 'en-US'], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stdout, /FAIL en-US short-description\.txt/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const render = spawnSync(process.execPath, [path.join(ROOT, 'store', 'render.mjs'), '--check', '--only', 'en-US,he-IL'], { encoding: 'utf8' });
  assert.equal(render.status, 0, render.stdout + render.stderr);
});
