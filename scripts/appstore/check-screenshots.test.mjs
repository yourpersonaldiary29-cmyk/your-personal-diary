/**
 * Tests of scripts/appstore/check-screenshots.mjs (the App Store screenshot sets and the App Store icon), of
 * the App Store profiles of scripts/play/render-screenshots.mjs (their sizes, shot lists and hooks - and that the
 * Play and Store profiles are exactly what they were before the App Store profiles existed) and of the icon tool
 * appstore/icon/render-icon.mjs (its pure parts; the Edge render itself runs only when the icon is made).
 *
 *   node --test scripts/appstore/check-screenshots.test.mjs
 *
 * The fixtures are small sets in a temporary folder: real PNGs (a gradient with a block of noise that differs per
 * localization, so no two localizations are identical and nothing is blank), a locales.json and a render-log.json
 * that match them. Most tests use sets one sixth of the real size (201x437, 220x478, 480x300) so the files stay
 * small; one test writes the real sizes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  APPLE_CLASSES,
  checkScreenshots,
  DEFAULT_DIR,
  DEFAULT_ICON,
  formatReport,
  fullyOpaque,
  iconProblems,
  imageProblems,
  ROOT,
  RULES,
  SET_PROFILES,
  SETS,
} from './check-screenshots.mjs';
import { encodePng } from '../play/render-graphics.mjs';
import { flattenSvg, iconFileProblems, pngHeader, withSrgbChunks } from '../../appstore/icon/render-icon.mjs';
import {
  appStoreFolders,
  browserLocaleOf,
  DESKTOP_CHROME,
  DESKTOP_SHOTS,
  desktopOfflineEntry,
  deviceLocaleOf,
  IPHONE_USER_AGENT,
  MAC_USER_AGENT,
  PHONE_CHROME,
  PROFILES,
  RENDER_LOG,
  SHOTS,
  STORE_FOLDERS,
} from '../play/render-screenshots.mjs';

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

const images = new Map();
/**
 * A PNG of `width` x `height`: a gradient and an 80x80 block of noise seeded by `seed` (cached). The noise does not
 * compress, so even the smallest fixture (201x437) is over the 10 KB minimum of a real screenshot.
 */
function png(width, height, { alpha = false, seed = 12345, transparent = false } = {}) {
  const key = `${width}x${height}/${seed}/${alpha}/${transparent}`;
  if (images.has(key)) return images.get(key);
  const data = new Uint8Array(width * height * 4);
  let s = seed;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (x < 80 && y < 80) {
        s = (s * 1103515245 + 12345) >>> 0;
        data[i] = s & 255;
        data[i + 1] = (s >>> 8) & 255;
        data[i + 2] = (s >>> 16) & 255;
      } else {
        data[i] = (x * 255) / width;
        data[i + 1] = (y * 255) / height;
        data[i + 2] = 200;
      }
      data[i + 3] = transparent && x > width - 10 ? 128 : 255;
    }
  }
  const buf = encodePng({ width, height, data }, { alpha });
  images.set(key, buf);
  return buf;
}

/** The real sets at one sixth of their size (every real size is divisible by 6), with matching accepted lists. */
const SMALL_SETS = SETS.map((s) => ({ ...s, width: s.width / 6, height: s.height / 6, accepted: s.accepted.map(([w, h]) => [w / 6, h / 6]) }));
const LOCALES = { en: { folder: 'en-US', appleName: 'English (U.S.)', note: '' }, he: { folder: 'he', appleName: 'Hebrew', note: '' }, bg: { folder: null, appleName: null, note: 'none' } };
const SEEDS = { 'en-US': 1, he: 2 };

/** Writes a valid fixture: the three (small) sets for en-US and he, their render logs, the locales file and an icon. */
function fixture({ sets = SMALL_SETS, locales = LOCALES, extra = null } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'mpd-appstore-shots-test-'));
  const dir = path.join(root, 'screenshots');
  mkdirSync(dir);
  const localesFile = path.join(root, 'locales.json');
  writeFileSync(localesFile, JSON.stringify(locales, null, 2));
  const folders = Object.values(locales).map((l) => l.folder).filter(Boolean);
  for (const set of sets) {
    const setDir = path.join(dir, set.folder);
    mkdirSync(setDir);
    const log = { generator: 'test', profile: set.profile, size: `${set.width}x${set.height}`, sets: {} };
    for (const folder of folders) {
      mkdirSync(path.join(setDir, folder));
      const appLocale = Object.keys(locales).find((k) => locales[k].folder === folder);
      log.sets[folder] = { appLocale, files: {}, layout: 'clean', transport: { requests: 20, hosts: ['127.0.0.1'], refused: 0 } };
      for (const name of set.files) {
        const buf = png(set.width, set.height, { seed: SEEDS[folder] ?? 7 });
        writeFileSync(path.join(setDir, folder, name), buf);
        log.sets[folder].files[name] = { bytes: buf.length, sha256: sha256(buf) };
      }
    }
    writeFileSync(path.join(setDir, RENDER_LOG), JSON.stringify(log, null, 2));
  }
  writeFileSync(path.join(dir, 'README.md'), '# test\n');
  writeFileSync(path.join(dir, 'README.he.md'), '# test\n');
  const icon = path.join(root, 'AppIcon-1024.png');
  writeFileSync(icon, png(1024, 1024, { seed: 3 }));
  if (extra) extra({ root, dir, localesFile, icon });
  return { root, dir, localesFile, icon };
}
const rewrite = (file, fn) => {
  const json = JSON.parse(readFileSync(file, 'utf8'));
  fn(json);
  writeFileSync(file, JSON.stringify(json, null, 2));
};
function withFixture(options, fn) {
  const f = fixture(options);
  try {
    return fn(f, (more = {}) => checkScreenshots(f.dir, { localesFile: f.localesFile, sets: SMALL_SETS, icon: f.icon, ...more }));
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
}
const has = (result, re) => result.problems.some((p) => re.test(p));

// ---------------------------------------------------------------------------------------------
// The sets and the profiles
// ---------------------------------------------------------------------------------------------

test('three App Store sets from the render profiles: folders, Apple classes, exact sizes, shot lists', () => {
  assert.deepEqual(SET_PROFILES, ['iphone-medium', 'iphone-large', 'mac']);
  assert.deepEqual(
    SETS.map((s) => [s.profile, s.folder, `${s.width}x${s.height}`, s.slot]),
    [
      ['iphone-medium', 'iphone-6.3', '1206x2622', 'iPhone 6.3" Display'],
      ['iphone-large', 'iphone-6.9', '1320x2868', 'iPhone 6.9" Display'],
      ['mac', 'mac', '2880x1800', 'Mac'],
    ],
  );
  for (const s of SETS) {
    // Every set's size is one of Apple's accepted sizes for its class (APPSTORE-FACTS 6.2 / 6.5), and the
    // profile's viewport times its device scale gives it exactly.
    assert.ok(s.accepted.some(([w, h]) => w === s.width && h === s.height), `${s.folder}: ${s.width}x${s.height} is in Apple's list`);
    const p = PROFILES[s.profile];
    assert.equal(p.viewport.width * p.deviceScaleFactor, s.width);
    assert.equal(p.viewport.height * p.deviceScaleFactor, s.height);
    assert.equal(path.join(p.outDir), path.join(DEFAULT_DIR, s.folder));
  }
  assert.deepEqual(SETS[0].files, ['01-home.png', '02-diary.png', '03-entry.png', '04-habits.png', '05-insights.png', '06-settings.png', '07-offline.png']);
  assert.deepEqual(SETS[1].files, SETS[0].files);
  assert.deepEqual(SETS[2].files, ['01-home.png', '02-diary.png', '03-entry.png', '04-calendar.png', '05-habits.png', '06-insights.png', '07-settings.png', '08-offline.png']);
  assert.equal(APPLE_CLASSES['iphone-6.3'].required, true, 'the medium Dynamic Island class is the one Apple requires');
  assert.equal(APPLE_CLASSES.mac.required, true);
  assert.equal(APPLE_CLASSES['iphone-6.9'].required, false, 'the large class is our addition');
});

test('the iPhone profiles reuse the phone shots and chrome; the mac profile the desktop ones (no duplicated logic)', () => {
  for (const name of ['iphone-medium', 'iphone-large']) {
    const p = PROFILES[name];
    assert.equal(p.shots, undefined, `${name} takes SHOTS by default`);
    assert.equal(p.chrome, undefined, `${name} takes PHONE_CHROME by default`);
    assert.equal(p.build, 'mobile');
    assert.equal(p.isMobile, true);
    assert.equal(p.hasTouch, true);
    assert.equal(p.deviceScaleFactor, 3);
    assert.equal(p.userAgent, IPHONE_USER_AGENT);
    assert.match(p.userAgent, /iPhone/);
    assert.equal(p.deviceName((k) => k), 'shell.device.phone');
    assert.equal(p.browserLocale('he', 'he'), 'he-IL');
  }
  assert.deepEqual(PROFILES['iphone-medium'].viewport, { width: 402, height: 874 });
  assert.deepEqual(PROFILES['iphone-large'].viewport, { width: 440, height: 956 });
  const mac = PROFILES.mac;
  assert.equal(mac.shots, DESKTOP_SHOTS);
  assert.equal(mac.chrome, DESKTOP_CHROME);
  assert.equal(mac.build, 'web');
  assert.equal(mac.isMobile, false);
  assert.equal(mac.hasTouch, false);
  assert.deepEqual(mac.viewport, { width: 1440, height: 900 });
  assert.equal(mac.deviceScaleFactor, 2);
  assert.equal(mac.wholeExcerpts, PROFILES.desktop.wholeExcerpts);
  assert.equal(mac.offlineEntry, desktopOfflineEntry);
  assert.equal(mac.userAgent, MAC_USER_AGENT);
  assert.match(mac.userAgent, /Macintosh/);
  assert.equal(mac.deviceName((k) => k), 'shell.device.computer');
  assert.equal(mac.browserLocale('zh-Hans', 'zh'), 'zh-CN');
});

test('the Play and Store profiles are exactly as documented before the App Store profiles existed', () => {
  // play/screenshots/render-log.json: "432x768 CSS px at device scale 2.5", 1080x1920; store/screenshots/render-log.json:
  // "1536x864 CSS px at device scale 1.25", 1920x1080. Neither has the hooks the App Store profiles use.
  const phone = PROFILES.phone;
  assert.deepEqual(phone.viewport, { width: 432, height: 768 });
  assert.equal(phone.deviceScaleFactor, 2.5);
  assert.equal(phone.isMobile, true);
  assert.equal(phone.hasTouch, true);
  assert.equal(phone.build, 'mobile');
  assert.equal(path.basename(path.dirname(phone.outDir)), 'play');
  assert.equal(Object.keys(phone.folders).length, 20);
  for (const key of ['shots', 'chrome', 'deviceName', 'userAgent', 'browserLocale', 'wholeExcerpts', 'offlineEntry']) assert.equal(key in phone, false, `phone has no ${key}`);
  const desktop = PROFILES.desktop;
  assert.deepEqual(desktop.viewport, { width: 1536, height: 864 });
  assert.equal(desktop.deviceScaleFactor, 1.25);
  assert.equal(desktop.isMobile, false);
  assert.equal(desktop.hasTouch, false);
  assert.equal(desktop.build, 'web');
  assert.equal(path.basename(path.dirname(desktop.outDir)), 'store');
  assert.equal(desktop.folders, STORE_FOLDERS);
  assert.equal(desktop.chrome, DESKTOP_CHROME);
  assert.equal(desktop.wholeExcerpts, 160);
  assert.equal(desktop.offlineEntry, desktopOfflineEntry);
  assert.equal(desktop.shots, DESKTOP_SHOTS);
  assert.equal(desktop.deviceName((k) => k), 'shell.device.computer');
  for (const key of ['userAgent', 'browserLocale']) assert.equal(key in desktop, false, `desktop has no ${key}`);
  assert.equal(browserLocaleOf('iw-IL'), 'he-IL');
  assert.equal(browserLocaleOf('en-US'), 'en-US');
  assert.deepEqual(Object.keys(PROFILES), ['phone', 'desktop', 'iphone-medium', 'iphone-large', 'mac']);
  assert.equal(PHONE_CHROME.top, '.mobile-shell__top');
});

test('appStoreFolders: the 19 Apple shortcodes of appstore/locales.json, en-US first, Bulgarian none; a bad file is refused', () => {
  const folders = appStoreFolders();
  assert.equal(Object.keys(folders).length, 19);
  assert.equal(Object.keys(folders)[0], 'en-US');
  assert.equal(folders['en-US'], 'en');
  assert.equal(folders.he, 'he');
  assert.equal(folders['zh-Hans'], 'zh');
  assert.equal(folders['pt-PT'], 'pt');
  assert.equal(Object.values(folders).includes('bg'), false);
  for (const appLocale of Object.values(folders)) assert.equal(typeof deviceLocaleOf(appLocale), 'string');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mpd-appstore-locales-'));
  try {
    const file = path.join(dir, 'locales.json');
    writeFileSync(file, JSON.stringify({ en: { folder: 'en-US' }, he: { folder: 'en-US' } }));
    assert.throws(() => appStoreFolders(file), /listed twice/);
    writeFileSync(file, JSON.stringify({ en: { folder: 'en US' } }));
    assert.throws(() => appStoreFolders(file), /no valid folder/);
    writeFileSync(file, JSON.stringify({ bg: { folder: null } }));
    assert.throws(() => appStoreFolders(file), /no App Store localization has a folder/);
    assert.throws(() => appStoreFolders(path.join(dir, 'missing.json')), /missing or unreadable/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------------------------

test('imageProblems: the set\'s exact size as a 24-bit RGB PNG passes; alpha, wrong size, blank, tiny and huge fail', () => {
  const set = SMALL_SETS[0];
  assert.deepEqual(imageProblems(png(set.width, set.height), set).problems, []);
  const alpha = imageProblems(png(set.width, set.height, { alpha: true, transparent: true }), set);
  assert.ok(alpha.problems.some((p) => /transparent pixels/.test(p)), alpha.problems.join('; '));
  const opaque = imageProblems(png(set.width, set.height, { alpha: true }), set);
  assert.deepEqual(opaque.problems, []);
  assert.ok(opaque.warnings.some((w) => /colour type 6 .* every pixel opaque/.test(w)));
  assert.ok(imageProblems(png(set.width + 1, set.height), set).problems.some((p) => /is \d+x\d+ \(iPhone with Dynamic Island \(medium display\)\)/.test(p)));
  assert.ok(imageProblems(png(set.width + 1, set.height), set).problems.some((p) => /not one of Apple's sizes/.test(p)));
  // A real Apple size of another class is still the wrong size for this set.
  const large = imageProblems(png(SMALL_SETS[1].width, SMALL_SETS[1].height), set);
  assert.ok(large.problems.some((p) => /the set iphone-6\.3 is/.test(p)));
  assert.ok(imageProblems(Buffer.from('not a png'), set).problems.some((p) => /not a PNG/.test(p)));
  const blank = encodePng({ width: set.width, height: set.height, data: new Uint8Array(set.width * set.height * 4).fill(255) }, { alpha: false });
  assert.ok(imageProblems(blank, set).problems.some((p) => /blank/.test(p)));
  assert.ok(imageProblems(png(set.width, set.height), set, { ...RULES, minBytes: 10 * 1024 * 1024 }).problems.some((p) => /too small/.test(p)));
  assert.ok(imageProblems(png(set.width, set.height), set, { ...RULES, maxBytes: 1024 }).problems.some((p) => /over the .* MB limit/.test(p)));
  assert.equal(RULES.maxBytes, 8 * 1024 * 1024);
  assert.equal(fullyOpaque(png(8, 8, { alpha: true })), true);
  assert.equal(fullyOpaque(png(12, 8, { alpha: true, transparent: true })), false);
  assert.equal(fullyOpaque(Buffer.from('x')), false);
});

test('the real sizes pass their sets: 1206x2622, 1320x2868 and 2880x1800 RGB PNGs', () => {
  for (const set of SETS) {
    const r = imageProblems(png(set.width, set.height), set);
    assert.deepEqual(r.problems, [], `${set.folder}: ${r.problems.join('; ')}`);
    assert.deepEqual(r.warnings, []);
  }
});

test('iconProblems: 1024x1024 RGB passes; alpha, another size and a blank image fail', () => {
  assert.deepEqual(iconProblems(png(1024, 1024, { seed: 3 })).problems, []);
  assert.ok(iconProblems(png(1024, 1024, { alpha: true })).problems.some((p) => /colour type 6/.test(p)));
  assert.ok(iconProblems(png(1024, 1024, { alpha: true })).problems.some((p) => /transparency/.test(p)));
  assert.ok(iconProblems(png(512, 512)).problems.some((p) => /512x512: the App Store icon is 1024x1024/.test(p)));
  const blank = encodePng({ width: 1024, height: 1024, data: new Uint8Array(1024 * 1024 * 4).fill(40) }, { alpha: false });
  assert.ok(iconProblems(blank).problems.some((p) => /blank/.test(p)));
  assert.ok(iconProblems(Buffer.from('nope')).problems.some((p) => /not a PNG/.test(p)));
});

test('the icon tool (appstore/icon/render-icon.mjs): squares the artwork\'s background, declares sRGB, refuses alpha and other sizes', () => {
  // Apple masks the corners itself (APPSTORE-FACTS 7.1): only the rounded background rectangle becomes square.
  const svg = '<svg><rect x="0" y="0" width="1024" height="1024" rx="220" fill="url(#bg)"/><rect x="212" y="176" width="600" height="672" rx="56" fill="#c9a86a"/></svg>';
  assert.equal(flattenSvg(svg), '<svg><rect x="0" y="0" width="1024" height="1024" rx="0" fill="url(#bg)"/><rect x="212" y="176" width="600" height="672" rx="56" fill="#c9a86a"/></svg>');
  assert.throws(() => flattenSvg('<svg><rect width="10" height="10"/></svg>'), /background rect filled with url\(#bg\) was not found/);
  const plain = png(1024, 1024, { seed: 3 });
  assert.deepEqual(pngHeader(plain).chunks, ['IHDR', 'IDAT', 'IEND']);
  assert.deepEqual(iconFileProblems(plain), ['no sRGB chunk']);
  const srgb = withSrgbChunks(plain);
  assert.deepEqual(pngHeader(srgb), { width: 1024, height: 1024, bitDepth: 8, colorType: 2, chunks: ['IHDR', 'sRGB', 'gAMA', 'IDAT', 'IEND'] });
  assert.deepEqual(iconFileProblems(srgb), []);
  assert.deepEqual(iconProblems(srgb).problems, [], 'the checker reads a PNG with the sRGB and gAMA chunks');
  assert.ok(iconFileProblems(withSrgbChunks(png(1024, 1024, { alpha: true }))).some((p) => /colour type 6/.test(p)));
  assert.ok(iconFileProblems(withSrgbChunks(png(512, 512))).some((p) => /512x512, expected 1024x1024/.test(p)));
  assert.deepEqual(iconFileProblems(Buffer.from('nope')), ['not a PNG file']);
});

test('the project\'s App Store icon is the flattened app artwork: 1024x1024, 24-bit RGB, sRGB declared', { skip: !existsSync(DEFAULT_ICON) ? 'appstore/icon/AppIcon-1024.png not made yet (node appstore/icon/render-icon.mjs)' : false }, () => {
  const source = readFileSync(path.join(ROOT, 'design', 'app-icon.svg'), 'utf8');
  const kitSvg = readFileSync(path.join(ROOT, 'appstore', 'icon', 'AppIcon-1024.svg'), 'utf8');
  assert.equal(flattenSvg(source), kitSvg, 'design/app-icon.svg changed after the App Store icon was made - make it again: node appstore/icon/render-icon.mjs');
  const buf = readFileSync(DEFAULT_ICON);
  assert.deepEqual(iconFileProblems(buf), []);
  assert.deepEqual(pngHeader(buf).chunks, ['IHDR', 'sRGB', 'gAMA', 'IDAT', 'IEND'], 'no tRNS, no text or time chunks');
  assert.deepEqual(iconProblems(buf).problems, []);
});

// ---------------------------------------------------------------------------------------------
// The folder
// ---------------------------------------------------------------------------------------------

test('a complete fixture passes, and the report has one line per set and localization, the icon and the summary', () => {
  withFixture({}, (f, check) => {
    const result = check();
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.ok, true);
    assert.equal(result.sets.length, 3);
    assert.deepEqual(result.sets.map((s) => s.locales.map((l) => l.locale)), [['en-US', 'he'], ['en-US', 'he'], ['en-US', 'he']]);
    assert.equal(result.sets[2].locales[0].files.length, 8);
    assert.equal(result.icon.width, 1024);
    const report = formatReport(result);
    assert.match(report, /^iphone-6\.3\/ {2}profile iphone-medium, 201x437, App Store Connect slot "iPhone 6\.3" Display": 2 localizations, 14 images/m);
    assert.match(report, /^ {2}ok {3}he {7} 7 images 201x437/m);
    assert.match(report, /^mac\/ {2}profile mac, 480x300, App Store Connect slot "Mac": 2 localizations, 16 images/m);
    assert.match(report, /^icon {2}ok {3}.*AppIcon-1024\.png: 1024x1024, PNG colour type 2/m);
    assert.match(report, /check-screenshots \(App Store\): 3 sets, 44 images - every set complete/);
    assert.doesNotMatch(report, /FAIL/);
  });
});

test('--set: only the named sets are checked; an unknown name is a problem', () => {
  withFixture({}, (f, check) => {
    const one = check({ only: ['mac'] });
    assert.equal(one.ok, true);
    assert.deepEqual(one.sets.map((s) => s.folder), ['mac']);
    assert.ok(has(check({ only: ['ipad'] }), /"ipad" is not a set folder/));
  });
});

test('a missing set, a missing localization, an extra folder and a stray file are problems', () => {
  withFixture({}, (f, check) => {
    rmSync(path.join(f.dir, 'mac'), { recursive: true });
    assert.ok(has(check(), /^mac\/: no set - render it \(node scripts\/play\/render-screenshots\.mjs --profile mac\)/));
  });
  withFixture({}, (f, check) => {
    rmSync(path.join(f.dir, 'iphone-6.9', 'he'), { recursive: true });
    assert.ok(has(check(), /iphone-6\.9\/he: no screenshot set - render it .*--profile iphone-large --locale he/));
    rmSync(path.join(f.dir, 'iphone-6.9', 'en-US'), { recursive: true });
    assert.ok(has(check(), /iphone-6\.9\/en-US: no screenshot set \(the primary language - required\)/));
  });
  withFixture({}, (f, check) => {
    mkdirSync(path.join(f.dir, 'iphone-6.3', 'bg'));
    assert.ok(has(check(), /iphone-6\.3\/bg: not an App Store localization of locales\.json \(en-US he\)/));
    mkdirSync(path.join(f.dir, 'ipad-13'));
    assert.ok(has(check(), /^ipad-13: not a set folder/));
    writeFileSync(path.join(f.dir, 'mac', 'he', 'notes.txt'), 'x');
    assert.ok(has(check(), /mac\/he\/notes\.txt: not an NN-name\.png screenshot/));
    writeFileSync(path.join(f.dir, 'mac', 'he', 'Thumbs.db'), 'x');
    assert.ok(has(check(), /mac\/he\/Thumbs\.db: not an NN-name\.png screenshot/));
  });
});

test('the shot list: a missing file, an extra numbered file and a wrong-size file are problems', () => {
  withFixture({}, (f, check) => {
    rmSync(path.join(f.dir, 'mac', 'en-US', '04-calendar.png'));
    assert.ok(has(check(), /mac\/en-US: missing 04-calendar\.png/));
    writeFileSync(path.join(f.dir, 'iphone-6.3', 'he', '08-extra.png'), png(201, 437));
    assert.ok(has(check(), /iphone-6\.3\/he: not in the shot list \(01-home\.png.*\): 08-extra\.png/));
    assert.ok(has(check(), /iphone-6\.3\/he\/08-extra\.png: not in render-log\.json/));
    writeFileSync(path.join(f.dir, 'iphone-6.9', 'he', '01-home.png'), png(201, 437, { seed: 2 }));
    const result = check();
    assert.ok(has(result, /iphone-6\.9\/he\/01-home\.png: 201x437: the set iphone-6\.9 is 220x478/));
    assert.ok(has(result, /iphone-6\.9\/he\/01-home\.png: differs from the file the render wrote/));
  });
});

test('transparency: an RGBA file with transparent pixels fails, a fully opaque RGBA file passes with a warning', () => {
  withFixture({}, (f, check) => {
    const set = SMALL_SETS[2];
    const write = (buf) => {
      writeFileSync(path.join(f.dir, 'mac', 'he', '08-offline.png'), buf);
      rewrite(path.join(f.dir, 'mac', RENDER_LOG), (log) => {
        log.sets.he.files['08-offline.png'] = { bytes: buf.length, sha256: sha256(buf) };
      });
    };
    write(png(set.width, set.height, { alpha: true, transparent: true, seed: 2 }));
    assert.ok(has(check(), /mac\/he\/08-offline\.png: has an alpha channel with transparent pixels/));
    write(png(set.width, set.height, { alpha: true, seed: 2 }));
    const result = check();
    assert.equal(result.ok, true, result.problems.join('; '));
    assert.ok(result.warnings.some((w) => /mac\/he\/08-offline\.png: PNG colour type 6 \(RGBA\) with every pixel opaque/.test(w)));
  });
});

test('identical images in two localizations of a set are a problem (the language did not apply)', () => {
  withFixture({}, (f, check) => {
    const buf = readFileSync(path.join(f.dir, 'iphone-6.3', 'en-US', '03-entry.png'));
    writeFileSync(path.join(f.dir, 'iphone-6.3', 'he', '03-entry.png'), buf);
    rewrite(path.join(f.dir, 'iphone-6.3', RENDER_LOG), (log) => {
      log.sets.he.files['03-entry.png'] = { bytes: buf.length, sha256: sha256(buf) };
    });
    const result = check();
    assert.ok(has(result, /iphone-6\.3\/he\/03-entry\.png: identical to en-US\/03-entry\.png \(same SHA-256\) - the language did not apply/), result.problems.join('; '));
    // The same image under another file name of the same localization is not that problem.
    assert.equal(result.problems.filter((p) => /identical/.test(p)).length, 1);
  });
});

test('render-log.json: missing, wrong profile or size, no clean layout, a foreign host, a refused request, a wrong app language', () => {
  withFixture({}, (f, check) => {
    const file = path.join(f.dir, 'iphone-6.3', RENDER_LOG);
    rewrite(file, (log) => {
      log.profile = 'phone';
      log.size = '1080x1920';
    });
    let r = check();
    assert.ok(has(r, /iphone-6\.3\/render-log\.json: profile "phone", expected "iphone-medium"/));
    assert.ok(has(r, /iphone-6\.3\/render-log\.json: size 1080x1920, expected 201x437/));
    rewrite(file, (log) => {
      log.profile = 'iphone-medium';
      log.size = '201x437';
      log.sets.he.layout = undefined;
      log.sets['en-US'].transport.hosts = ['127.0.0.1', 'example.com'];
    });
    r = check();
    assert.ok(has(r, /iphone-6\.3\/he: render-log\.json has no "layout": "clean"/));
    assert.ok(has(r, /iphone-6\.3\/en-US: render-log\.json transport log is not 127\.0\.0\.1 only/));
    rewrite(file, (log) => {
      log.sets.he.layout = 'clean';
      log.sets['en-US'].transport = { requests: 20, hosts: ['127.0.0.1'], refused: 1 };
      log.sets.he.appLocale = 'en';
      log.sets.xx = { files: {} };
      delete log.sets['en-US'].files['01-home.png'];
      log.sets.he.files['09-ghost.png'] = { bytes: 1, sha256: '0' };
    });
    r = check();
    assert.ok(has(r, /iphone-6\.3\/en-US: render-log\.json transport log is not 127\.0\.0\.1 only/));
    assert.ok(has(r, /iphone-6\.3\/he: render-log\.json says app language "en", expected "he"/));
    assert.ok(has(r, /iphone-6\.3\/en-US\/01-home\.png: not in render-log\.json \(not written by the render\)/));
    assert.ok(has(r, /iphone-6\.3\/he\/09-ghost\.png: in render-log\.json but not on disk/));
    assert.ok(r.warnings.some((w) => /iphone-6\.3\/render-log\.json lists xx/.test(w)));
    rmSync(file);
    assert.ok(has(check(), /iphone-6\.3\/render-log\.json: missing/));
    writeFileSync(file, '{not json');
    assert.ok(has(check(), /iphone-6\.3\/render-log\.json: not valid JSON/));
  });
});

test('the icon: missing, wrong, or skipped with icon: null', () => {
  withFixture({}, (f, check) => {
    assert.equal(check({ icon: null }).icon, null);
    rmSync(f.icon);
    const r = check();
    assert.ok(has(r, /AppIcon-1024\.png: missing - the App Store icon/));
    assert.deepEqual(r.icon.problems, ['missing']);
    writeFileSync(f.icon, png(1024, 1024, { alpha: true, transparent: true }));
    assert.ok(has(check(), /AppIcon-1024\.png: has transparency/));
    writeFileSync(f.icon, png(512, 512));
    assert.ok(has(check(), /AppIcon-1024\.png: 512x512: the App Store icon is 1024x1024/));
  });
});

test('the locales file: a missing en-US is a problem; an unreadable file stops the check', () => {
  withFixture({ locales: { he: { folder: 'he' } } }, (f, check) => {
    const r = check();
    assert.ok(has(r, /locales\.json has no en-US folder \(the primary language\)/));
    // The fixture only has he/ folders, which is complete for this locales file otherwise.
    assert.equal(r.problems.length, 1, r.problems.join('; '));
  });
  withFixture({}, (f, check) => {
    const r = check({ localesFile: path.join(f.root, 'nope.json') });
    assert.equal(r.ok, false);
    assert.ok(has(r, /missing or unreadable/));
  });
  const r = checkScreenshots(path.join(os.tmpdir(), 'mpd-appstore-does-not-exist'), { icon: null });
  assert.equal(r.ok, false);
  assert.ok(has(r, /does not exist - render the sets first/));
});

test('the project\'s own App Store sets and icon pass (when they have been rendered)', { skip: !existsSync(DEFAULT_DIR) || !existsSync(DEFAULT_ICON) ? 'appstore/screenshots or appstore/icon/AppIcon-1024.png not rendered yet' : false }, () => {
  const result = checkScreenshots();
  assert.deepEqual(result.problems, []);
  assert.equal(result.sets.length, 3);
  for (const set of result.sets) assert.equal(set.locales.length, 19, `${set.folder}: 19 localizations`);
  assert.equal(result.sets.reduce((s, set) => s + set.locales.reduce((t, l) => t + l.files.length, 0), 0), 19 * (7 + 7 + 8));
});
