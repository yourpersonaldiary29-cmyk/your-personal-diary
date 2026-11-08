/**
 * Tests of scripts/play/preflight.mjs against fixture trees (Node's own test runner - no vitest project
 * covers scripts/):
 *
 *   node --test scripts/play/preflight.test.mjs
 *
 * Every fixture is a complete, valid Play kit in a temp folder (fake PNG / JPEG headers are enough: the
 * checker reads IHDR / SOF only); each case breaks one thing and expects exactly that check to fail.
 * The fixture's keystore.properties holds placeholder values that are obviously not passwords.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { APP_ID, EXPECTED_LOCALES, LISTING_LIMITS, countCharacters, readImageInfo, runPreflight } from './preflight.mjs';

const LOCALES = ['en-US', 'he-IL', 'ar', 'zh-CN', 'ja-JP', 'hi-IN', 'th', 'es-ES', 'pt-BR', 'fr-FR', 'it-IT', 'de-DE', 'ro', 'el-GR', 'pl-PL', 'cs-CZ', 'hu-HU', 'ru-RU', 'bg', 'tr-TR'];

/** A PNG header: signature + IHDR (width, height, bit depth, colour type) + IEND. */
function fakePng(width, height, colorType, bitDepth = 8) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
  };
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IEND', Buffer.alloc(0))]);
}

/** A JPEG header: SOI, an APP0 segment, SOF0 with the dimensions, EOI. */
function fakeJpeg(width, height) {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const sof = Buffer.alloc(2 + 2 + 1 + 2 + 2 + 1 + 9);
  sof[0] = 0xff;
  sof[1] = 0xc0;
  sof.writeUInt16BE(sof.length - 2, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof[9] = 3;
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.from([0xff, 0xd9])]);
}

const write = (file, content) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
};

/** A complete, valid kit. `options` tweak single pieces for the failure cases. */
function makeFixture(options = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'play-preflight-'));
  const locales = options.locales ?? LOCALES;
  for (const locale of locales) {
    write(path.join(root, 'play', 'listing', locale, 'title.txt'), options.title ?? 'Your Personal Diary\n');
    write(path.join(root, 'play', 'listing', locale, 'short.txt'), 'A private, encrypted diary that works offline and syncs between your devices.\n');
    write(path.join(root, 'play', 'listing', locale, 'full.txt'), `${'Write your day, track habits, see insights. '.repeat(20)}\n`);
  }
  write(path.join(root, 'play', 'graphics', 'icon-512.png'), options.icon ?? fakePng(512, 512, 6));
  write(path.join(root, 'play', 'graphics', options.featureName ?? 'feature-1024x500.png'), options.feature ?? fakePng(1024, 500, 2));
  if (options.screenshots !== false) {
    const shotLocales = options.screenshotLocales ?? ['en-US', 'he-IL'];
    for (const locale of shotLocales) {
      const count = options.screenshotCount ?? 6;
      // 1080x1920 is 9:16; Play rejects a longer side over twice the shorter (1080x2400 would fail).
      for (let i = 1; i <= count; i++) write(path.join(root, 'play', 'screenshots', locale, `0${i}-screen.png`), options.screenshot ?? fakePng(1080, 1920, 2));
    }
  }
  for (const page of ['privacy', 'delete-account']) {
    write(path.join(root, 'dist', page, 'index.html'), options.legalHtml ?? '<!doctype html><html><body><h1>Your Personal Diary</h1><p>Operated by Example Publisher.</p></body></html>');
    for (const locale of ['en', 'he', 'zh-Hans', 'es', 'pl', 'ru', 'fr', 'ar', 'ja', 'tr', 'cs', 'hu', 'bg', 'el', 'pt', 'de', 'ro', 'it', 'th', 'hi']) {
      write(path.join(root, 'dist', page, locale, 'index.html'), '<!doctype html><html><body><p>ok</p></body></html>');
    }
  }
  for (const f of ['data-safety.md', 'content-rating.md', 'target-audience.md', 'app-access.md']) write(path.join(root, 'play', 'policy', f), '# answers\n');
  write(
    path.join(root, 'android', 'app', 'build.gradle'),
    options.gradle ?? `def appId = '${APP_ID}'\ndef appNamespace = 'com.mydiary.app'\nandroid {\n  defaultConfig {\n    applicationId appId\n    versionCode appVersionCode\n  }\n}\n`,
  );
  write(path.join(root, 'android', 'app', 'version.properties'), `# fixture\nversionCode=${options.versionCode ?? 5}\n`);
  write(path.join(root, 'capacitor.config.ts'), `const config = {\n  appId: '${options.capacitorAppId ?? APP_ID}',\n  appName: 'Your Personal Diary',\n};\nexport default config;\n`);
  if (options.lastUpload !== false) write(path.join(root, 'play', 'last-upload.json'), options.lastUpload ?? JSON.stringify({ versionCode: 4, versionName: '0.1.0', uploadedAt: '2026-10-20', track: 'closed-testing' }));
  const signingFile = path.join(root, 'signing', 'keystore.properties');
  if (options.signing !== false) {
    write(signingFile, options.signingContent ?? '# fixture - the values below are placeholders, not passwords\nstoreFile=fixture-store.jks\nstorePassword=FIXTURE-PLACEHOLDER\nkeyAlias=upload\nkeyPassword=FIXTURE-PLACEHOLDER\n');
    if (options.keystore !== false) write(path.join(root, 'signing', 'fixture-store.jks'), Buffer.alloc(0));
  }
  return { root, signingFile, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const failing = (report) => report.results.filter((r) => r.level === 'fail');
const warning = (report) => report.results.filter((r) => r.level === 'warn');
const checksOf = (list) => [...new Set(list.map((r) => r.check))];

test('readImageInfo reads PNG and JPEG headers', () => {
  assert.deepEqual(readImageInfo(fakePng(512, 512, 6)), { format: 'png', width: 512, height: 512, bitDepth: 8, colorType: 6, hasAlpha: true, indexed: false });
  assert.deepEqual(readImageInfo(fakePng(1024, 500, 2)), { format: 'png', width: 1024, height: 500, bitDepth: 8, colorType: 2, hasAlpha: false, indexed: false });
  assert.equal(readImageInfo(fakePng(10, 10, 3)).indexed, true);
  const jpeg = readImageInfo(fakeJpeg(1024, 500));
  assert.equal(jpeg.format, 'jpeg');
  assert.equal(jpeg.width, 1024);
  assert.equal(jpeg.height, 500);
  assert.equal(jpeg.hasAlpha, false);
  assert.equal(readImageInfo(Buffer.from('not an image')), null);
});

test('countCharacters counts code points and ignores one trailing newline', () => {
  assert.equal(countCharacters('Your Personal Diary\n'), 19);
  assert.equal(countCharacters('יומן אישי'), 9);
  assert.equal(countCharacters('a\u{1F600}'), 2);
  assert.equal(LISTING_LIMITS['title.txt'], 30);
});

test('a complete kit passes; the he-IL folder only warns about Play\'s iw-IL name', () => {
  const f = makeFixture();
  try {
    const report = runPreflight({ root: f.root, signingFile: f.signingFile });
    assert.deepEqual(failing(report), [], JSON.stringify(failing(report), null, 2));
    assert.equal(report.ok, true);
    const passed = checksOf(report.results.filter((r) => r.level === 'pass'));
    for (const check of ['listing locales', 'listing texts', 'graphics icon-512.png', 'graphics feature-1024x500', 'screenshots', 'legal dist/privacy', 'legal dist/delete-account', 'policy answers', 'applicationId', 'versionCode', 'signing']) {
      assert.ok(passed.includes(check), `expected a PASS for ${check}; got ${passed.join(', ')}`);
    }
    const warns = warning(report);
    assert.ok(warns.some((w) => w.check === 'listing locales' && w.detail.includes('iw-IL')), 'he-IL should map to iw-IL');
    assert.ok(warns.some((w) => w.check === 'screenshots' && w.detail.includes('no screenshots for 18')), 'locales without screenshots are a warning');
    assert.ok(!report.results.some((r) => /FIXTURE-PLACEHOLDER/.test(r.detail)), 'property values never appear in the output');
  } finally {
    f.cleanup();
  }
});

test('the iw-IL folder name is accepted as is', () => {
  const f = makeFixture({ locales: LOCALES.map((l) => (l === 'he-IL' ? 'iw-IL' : l)), screenshotLocales: ['en-US'] });
  try {
    const report = runPreflight({ root: f.root, signingFile: f.signingFile });
    assert.deepEqual(failing(report), []);
    assert.ok(!warning(report).some((w) => w.check === 'listing locales'), 'no alias warning for Play\'s own code');
  } finally {
    f.cleanup();
  }
});

test('19 locales, an unknown locale code, or a missing en-US fail', () => {
  const nineteen = makeFixture({ locales: LOCALES.slice(1) });
  const unknown = makeFixture({ locales: [...LOCALES.slice(0, 19), 'xx-YY'] });
  try {
    const a = runPreflight({ root: nineteen.root, signingFile: nineteen.signingFile });
    assert.ok(failing(a).some((r) => r.check === 'listing locales' && r.detail.includes(`19 locale folders, the app has ${EXPECTED_LOCALES}`)));
    assert.ok(failing(a).some((r) => r.check === 'listing locales' && r.detail.includes('en-US')));
    const b = runPreflight({ root: unknown.root, signingFile: unknown.signingFile });
    assert.ok(failing(b).some((r) => r.check === 'listing locales' && r.detail.includes('xx-YY')));
  } finally {
    nineteen.cleanup();
    unknown.cleanup();
  }
});

test('a title over 30 characters fails for every locale that has it', () => {
  const f = makeFixture({ title: 'Your Personal Diary - Private Journal\n' });
  try {
    const report = runPreflight({ root: f.root, signingFile: f.signingFile });
    const titleFails = failing(report).filter((r) => r.check.endsWith('/title.txt'));
    assert.equal(titleFails.length, LOCALES.length);
    assert.match(titleFails[0].detail, /37 characters, Play allows 30/);
    assert.deepEqual(checksOf(failing(report)).filter((c) => !c.endsWith('/title.txt')), []);
  } finally {
    f.cleanup();
  }
});

test('graphics: an icon without alpha and a feature graphic with alpha or the wrong size fail; a JPEG feature graphic passes', () => {
  const noAlphaIcon = makeFixture({ icon: fakePng(512, 512, 2) });
  const alphaFeature = makeFixture({ feature: fakePng(1024, 500, 6) });
  const wrongSize = makeFixture({ feature: fakePng(1024, 512, 2) });
  const jpegFeature = makeFixture({ featureName: 'feature-1024x500.jpg', feature: fakeJpeg(1024, 500) });
  try {
    assert.deepEqual(checksOf(failing(runPreflight({ root: noAlphaIcon.root, signingFile: noAlphaIcon.signingFile }))), ['graphics icon-512.png']);
    assert.deepEqual(checksOf(failing(runPreflight({ root: alphaFeature.root, signingFile: alphaFeature.signingFile }))), ['graphics feature-1024x500.png']);
    assert.deepEqual(checksOf(failing(runPreflight({ root: wrongSize.root, signingFile: wrongSize.signingFile }))), ['graphics feature-1024x500.png']);
    assert.deepEqual(failing(runPreflight({ root: jpegFeature.root, signingFile: jpegFeature.signingFile })), []);
  } finally {
    for (const f of [noAlphaIcon, alphaFeature, wrongSize, jpegFeature]) f.cleanup();
  }
});

test('screenshots: a missing folder only warns; wrong counts, alpha, or an extreme aspect ratio fail; en-US is required', () => {
  const none = makeFixture({ screenshots: false });
  const one = makeFixture({ screenshotCount: 1 });
  const alpha = makeFixture({ screenshot: fakePng(1080, 1920, 6) });
  const tall = makeFixture({ screenshot: fakePng(1080, 2400, 2) });
  const noDefault = makeFixture({ screenshotLocales: ['he-IL'] });
  try {
    const a = runPreflight({ root: none.root, signingFile: none.signingFile });
    assert.deepEqual(failing(a), []);
    assert.ok(warning(a).some((w) => w.check === 'screenshots' && w.detail.includes('missing')));
    assert.ok(checksOf(failing(runPreflight({ root: one.root, signingFile: one.signingFile }))).every((c) => c.startsWith('screenshots ')));
    assert.ok(failing(runPreflight({ root: one.root, signingFile: one.signingFile })).some((r) => r.detail.includes('1 images, Play takes 2-8')));
    assert.ok(failing(runPreflight({ root: alpha.root, signingFile: alpha.signingFile })).some((r) => r.check.startsWith('screenshots en-US/') && r.detail.includes('alpha')));
    assert.ok(failing(runPreflight({ root: tall.root, signingFile: tall.signingFile })).some((r) => r.check.startsWith('screenshots en-US/')));
    assert.ok(failing(runPreflight({ root: noDefault.root, signingFile: noDefault.signingFile })).some((r) => r.check === 'screenshots' && r.detail.includes('en-US')));
  } finally {
    for (const f of [none, one, alpha, tall, noDefault]) f.cleanup();
  }
});

test('legal pages: a placeholder left in a built page fails; a missing dist page fails', () => {
  const placeholder = makeFixture({ legalHtml: '<html><body>Operated by {{PUBLISHER_NAME}} ({{CONTACT_EMAIL}})</body></html>' });
  const noDist = makeFixture();
  rmSync(path.join(noDist.root, 'dist', 'delete-account'), { recursive: true, force: true });
  try {
    const a = failing(runPreflight({ root: placeholder.root, signingFile: placeholder.signingFile }));
    assert.deepEqual(checksOf(a).sort(), ['legal dist/delete-account', 'legal dist/privacy']);
    assert.match(a[0].detail, /\{\{PLACEHOLDER\}\} still in 1 page/);
    const b = failing(runPreflight({ root: noDist.root, signingFile: noDist.signingFile }));
    assert.deepEqual(checksOf(b), ['legal dist/delete-account']);
    assert.match(b[0].detail, /npx vite build/);
  } finally {
    placeholder.cleanup();
    noDist.cleanup();
  }
});

test('applicationId: the old com.mydiary.app, a missing applicationId line, or a capacitor mismatch fail', () => {
  const legacy = makeFixture({ gradle: "def appId = 'com.mydiary.app'\nandroid { defaultConfig { applicationId appId } }\n" });
  const notApplied = makeFixture({ gradle: `def appId = '${APP_ID}'\nandroid { defaultConfig { applicationId 'com.mydiary.app' } }\n` });
  const capacitor = makeFixture({ capacitorAppId: 'com.mydiary.app' });
  try {
    const a = failing(runPreflight({ root: legacy.root, signingFile: legacy.signingFile }));
    assert.deepEqual(checksOf(a), ['applicationId']);
    assert.match(a[0].detail, /taken on Play/);
    assert.deepEqual(checksOf(failing(runPreflight({ root: notApplied.root, signingFile: notApplied.signingFile }))), ['applicationId']);
    const c = failing(runPreflight({ root: capacitor.root, signingFile: capacitor.signingFile }));
    assert.deepEqual(checksOf(c), ['applicationId']);
    assert.match(c[0].detail, /capacitor\.config\.ts/);
  } finally {
    for (const f of [legacy, notApplied, capacitor]) f.cleanup();
  }
});

test('versionCode: not above the last upload fails, a missing last-upload.json only warns, out-of-range fails', () => {
  const same = makeFixture({ versionCode: 4 });
  const lower = makeFixture({ versionCode: 3 });
  const noRecord = makeFixture({ lastUpload: false, versionCode: 1 });
  const tooBig = makeFixture({ versionCode: 2100000001 });
  const badJson = makeFixture({ lastUpload: '{"versionCode": "many"}' });
  try {
    const a = failing(runPreflight({ root: same.root, signingFile: same.signingFile }));
    assert.deepEqual(checksOf(a), ['versionCode']);
    assert.match(a[0].detail, /4 is not higher than the last upload .*\(4\).*bump-version\.mjs/);
    assert.deepEqual(checksOf(failing(runPreflight({ root: lower.root, signingFile: lower.signingFile }))), ['versionCode']);
    const c = runPreflight({ root: noRecord.root, signingFile: noRecord.signingFile });
    assert.deepEqual(failing(c), []);
    assert.ok(warning(c).some((w) => w.check === 'versionCode' && w.detail.includes('nothing uploaded yet')));
    assert.ok(c.results.some((r) => r.level === 'pass' && r.check === 'versionCode' && r.detail.includes('(0)')));
    assert.match(failing(runPreflight({ root: tooBig.root, signingFile: tooBig.signingFile }))[0].detail, /2100000000/);
    assert.match(failing(runPreflight({ root: badJson.root, signingFile: badJson.signingFile }))[0].detail, /unreadable/);
  } finally {
    for (const f of [same, lower, noRecord, tooBig, badJson]) f.cleanup();
  }
});

test('versionCode: a null, missing, empty, boolean or fractional versionCode in last-upload.json is unreadable, never read as 0', () => {
  const bad = {
    null: '{"versionCode": null, "versionName": null, "uploadedAt": null, "track": null}',
    missing: '{"versionName": "0.1.0"}',
    empty: '{"versionCode": ""}',
    bool: '{"versionCode": true}',
    fraction: '{"versionCode": 1.5}',
    negative: '{"versionCode": -1}',
    array: '[4]',
  };
  const fixtures = Object.entries(bad).map(([name, body]) => [name, makeFixture({ lastUpload: body })]);
  const digitString = makeFixture({ lastUpload: '{"versionCode": "4"}' });
  try {
    for (const [name, f] of fixtures) {
      const report = runPreflight({ root: f.root, signingFile: f.signingFile });
      const fails = failing(report);
      assert.deepEqual(checksOf(fails), ['versionCode'], `${name}: ${JSON.stringify(report.results.filter((r) => r.check === 'versionCode'))}`);
      assert.match(fails[0].detail, /unreadable/, name);
      assert.ok(!report.results.some((r) => r.check === 'versionCode' && r.level === 'pass'), `${name} must not pass as "higher than ... (0)"`);
    }
    assert.match(failing(runPreflight({ root: fixtures[0][1].root, signingFile: fixtures[0][1].signingFile }))[0].detail, /versionCode is null/);
    assert.match(failing(runPreflight({ root: fixtures[1][1].root, signingFile: fixtures[1][1].signingFile }))[0].detail, /versionCode is missing/);
    // A digit string is read like the number: 5 (the fixture's version.properties) > "4".
    assert.deepEqual(failing(runPreflight({ root: digitString.root, signingFile: digitString.signingFile })), []);
  } finally {
    for (const [, f] of fixtures) f.cleanup();
    digitString.cleanup();
  }
});

test('signing: a missing properties file, a missing key, or a missing keystore fail; values are never echoed', () => {
  const missing = makeFixture({ signing: false });
  const noKey = makeFixture({ signingContent: 'storeFile=fixture-store.jks\nkeyAlias=upload\nkeyPassword=FIXTURE-PLACEHOLDER\n' });
  const noStore = makeFixture({ keystore: false });
  try {
    const a = failing(runPreflight({ root: missing.root, signingFile: missing.signingFile }));
    assert.deepEqual(checksOf(a), ['signing']);
    assert.match(a[0].detail, /create-upload-key\.ps1/);
    const b = failing(runPreflight({ root: noKey.root, signingFile: noKey.signingFile }));
    assert.deepEqual(checksOf(b), ['signing']);
    assert.match(b[0].detail, /lacks a value for storePassword/);
    assert.doesNotMatch(JSON.stringify(b), /FIXTURE-PLACEHOLDER/);
    const c = failing(runPreflight({ root: noStore.root, signingFile: noStore.signingFile }));
    assert.deepEqual(checksOf(c), ['signing']);
    assert.match(c[0].detail, /does not exist/);
  } finally {
    for (const f of [missing, noKey, noStore]) f.cleanup();
  }
});
