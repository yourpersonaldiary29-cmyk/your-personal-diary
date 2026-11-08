/**
 * Tests of the Play screenshot package (Node's own test runner - no vitest project covers scripts/):
 *
 *   node --test scripts/play/check-screenshots.test.mjs
 *
 * 1. scripts/play/check-screenshots.mjs against fixture trees: every fixture is a complete, valid set
 *    folder in a temp directory (real PNGs written with the PNG encoder of render-graphics.mjs, small
 *    9:16 images with noise so they are not blank and not tiny) plus its render-log.json; each case
 *    breaks one thing and expects exactly that to fail.
 * 2. The pure parts of scripts/play/render-screenshots.mjs: the network guard (only http://127.0.0.1:<port>
 *    of the render's own server may be contacted - the transport log check), the profile (the 20 Play
 *    folders of play/listing, 1080x1920 within Play's rules), the fictional accounts, the entry choice,
 *    the clock, the PNG conversion, the arguments. Nothing here starts a server or a browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkScreenshots, formatReport, imageProblems, readPng, RULES } from './check-screenshots.mjs';
import { decodePng, encodePng } from './render-graphics.mjs';
import {
  assertLoopbackOnly,
  browserLocaleOf,
  DEFAULT_LOCALE,
  entryScore,
  FICTIONAL_PEOPLE,
  fictionalAccount,
  FIXED_TIME,
  FORBIDDEN_PORT,
  installServerClock,
  isAllowedUrl,
  isMidWordBreak,
  layoutProbe,
  NEVER_VISIBLE,
  NO_WORD_SPACES,
  offlineEntry,
  parseArgs,
  pickEntry,
  PROFILES,
  scrollCandidates,
  SHOTS,
  toOpaqueRgbPng,
} from './render-screenshots.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

/** A deterministic noisy RGBA image (not blank, compresses badly enough to be a few hundred KB). */
function noise(width, height, seed = 1, alpha = 255) {
  const data = new Uint8Array(width * height * 4);
  let s = seed >>> 0;
  for (let i = 0; i < data.length; i += 4) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    data[i] = s >>> 24;
    data[i + 1] = (s >>> 16) & 0xff;
    data[i + 2] = (s >>> 8) & 0xff;
    data[i + 3] = alpha;
  }
  return { width, height, data };
}

const png = (w, h, seed, { alpha = false } = {}) => encodePng(noise(w, h, seed), { alpha });
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/** A valid fixture tree: <dir>/listing/{en-US,iw-IL} and <dir>/shots/{en-US,iw-IL}/01..02 + render-log.json. */
function fixture() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mpd-check-shots-'));
  const listing = path.join(dir, 'listing');
  const shots = path.join(dir, 'shots');
  const log = { generator: 'test', sets: {} };
  let seed = 1;
  for (const locale of ['en-US', 'iw-IL']) {
    mkdirSync(path.join(listing, locale), { recursive: true });
    mkdirSync(path.join(shots, locale), { recursive: true });
    log.sets[locale] = { files: {}, layout: 'clean', transport: { requests: 12, hosts: ['127.0.0.1'], refused: 0 } };
    for (const name of ['01-home.png', '02-diary.png']) {
      const buf = png(360, 640, seed++);
      writeFileSync(path.join(shots, locale, name), buf);
      log.sets[locale].files[name] = { bytes: buf.length, sha256: sha(buf) };
    }
  }
  writeFileSync(path.join(shots, 'render-log.json'), JSON.stringify(log, null, 2));
  return { dir, listing, shots, log };
}

/** Writes an image into the fixture and records it in its render log (so only the image itself is wrong). */
function putImage(fx, locale, name, buf) {
  writeFileSync(path.join(fx.shots, locale, name), buf);
  fx.log.sets[locale] ??= { files: {}, layout: 'clean', transport: { requests: 1, hosts: ['127.0.0.1'], refused: 0 } };
  fx.log.sets[locale].files[name] = { bytes: buf.length, sha256: sha(buf) };
  writeFileSync(path.join(fx.shots, 'render-log.json'), JSON.stringify(fx.log, null, 2));
}

function run(fx) {
  return checkScreenshots(fx.shots, { listingDir: fx.listing });
}

function withFixture(fn) {
  const fx = fixture();
  try {
    return fn(fx);
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
}

const expectOnly = (result, pattern) => {
  assert.equal(result.ok, false, 'expected a failure');
  assert.ok(result.problems.length > 0);
  for (const p of result.problems) assert.match(p, pattern);
};

// ---------------------------------------------------------------------------------------------
// check-screenshots.mjs
// ---------------------------------------------------------------------------------------------

test('a valid fixture passes, with the per-locale file list in the report', () =>
  withFixture((fx) => {
    const result = run(fx);
    assert.deepEqual(result.problems, []);
    assert.equal(result.ok, true);
    assert.deepEqual(result.sets.map((s) => s.locale), ['en-US', 'iw-IL']);
    const report = formatReport(result);
    assert.match(report, /ok {3}en-US {2}2 images/);
    assert.match(report, /01-home\.png 360x640/);
    assert.match(report, /check-screenshots: 2 locales, 4 images, all within Play's rules/);
    // 360x640 is valid for Play but too small for promotion: a warning, not a failure.
    assert.ok(result.warnings.some((w) => /under 1080 px/.test(w)));
  }));

test('1080x1920 and 1920x1080 are accepted without a warning', () => {
  for (const [w, h] of [[1080, 1920], [1920, 1080]]) {
    const { problems, warnings } = imageProblems(encodePng(noise(w, h, 7), { alpha: false }));
    assert.deepEqual(problems, []);
    assert.deepEqual(warnings, []);
  }
});

test("Play's twice-as-long rule: 1080x2400 (the 9:20 of a modern phone) fails", () => {
  // Same proportion, smaller (fast): 324x720 = 9:20.
  const { problems } = imageProblems(encodePng(noise(324, 720, 3), { alpha: false }));
  assert.ok(problems.some((p) => /more than twice/.test(p)));
  assert.ok(problems.some((p) => /not 9:16/.test(p)));
});

test('sides outside 320-3840 px fail', () => {
  assert.ok(imageProblems(encodePng(noise(180, 320, 4), { alpha: false })).problems.some((p) => /320-3840/.test(p)));
  // A header is enough for the size rule (the pixel stream is not needed to see 2160x3840 vs 2250x4000).
  const big = Buffer.from(encodePng(noise(9, 16, 4), { alpha: false }));
  big.writeUInt32BE(2250, 16);
  big.writeUInt32BE(4000, 20);
  assert.ok(imageProblems(big).problems.some((p) => /320-3840/.test(p)));
});

test('an alpha channel fails', () =>
  withFixture((fx) => {
    putImage(fx, 'en-US', '02-diary.png', png(360, 640, 99, { alpha: true }));
    expectOnly(run(fx), /en-US\/02-diary\.png: .*(colour type 6|alpha)/);
  }));

test('a PNG with a tRNS chunk (transparency without an alpha channel) fails', () => {
  const rgb = encodePng(noise(360, 640, 5), { alpha: false });
  const trns = Buffer.from([0, 0, 0, 6, 0x74, 0x52, 0x4e, 0x53, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  // CRC over "tRNS" + data
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  let c = 0xffffffff;
  for (const b of trns.subarray(4, 14)) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  trns.writeUInt32BE((c ^ 0xffffffff) >>> 0, 14);
  const withTrns = Buffer.concat([rgb.subarray(0, 33), trns, rgb.subarray(33)]);
  assert.equal(readPng(withTrns).alpha, true);
  assert.ok(imageProblems(withTrns).problems.some((p) => /alpha|transparency/.test(p)));
});

test('a cut-off or corrupted PNG fails', () => {
  const good = encodePng(noise(360, 640, 6), { alpha: false });
  assert.ok(imageProblems(good.subarray(0, good.length - 200)).problems.length > 0);
  const flipped = Buffer.from(good);
  flipped[good.length - 300] ^= 0xff;
  assert.ok(imageProblems(flipped).problems.some((p) => /CRC/.test(p)));
});

test('a blank image fails', () => {
  const flat = { width: 360, height: 640, data: new Uint8Array(360 * 640 * 4).fill(255) };
  const { problems } = imageProblems(encodePng(flat, { alpha: false }));
  assert.ok(problems.some((p) => /blank/.test(p)));
});

test('fewer than 2 or more than 8 images in a language fail', () => {
  withFixture((fx) => {
    rmSync(path.join(fx.shots, 'iw-IL', '02-diary.png'));
    delete fx.log.sets['iw-IL'].files['02-diary.png'];
    writeFileSync(path.join(fx.shots, 'render-log.json'), JSON.stringify(fx.log));
    expectOnly(run(fx), /iw-IL: 1 images - Play takes 2-8/);
  });
  withFixture((fx) => {
    for (let n = 3; n <= 9; n++) putImage(fx, 'en-US', `${String(n).padStart(2, '0')}-more.png`, png(360, 640, 100 + n));
    expectOnly(run(fx), /en-US: 9 images - Play takes 2-8/);
  });
});

test('the default set en-US must exist', () =>
  withFixture((fx) => {
    rmSync(path.join(fx.shots, 'en-US'), { recursive: true });
    rmSync(path.join(fx.listing, 'en-US'), { recursive: true });
    delete fx.log.sets['en-US'];
    writeFileSync(path.join(fx.shots, 'render-log.json'), JSON.stringify(fx.log));
    expectOnly(run(fx), /en-US\/ is missing - the default set/);
  }));

test('folder names must be the Play codes of play/listing (Hebrew is iw-IL, not he-IL)', () =>
  withFixture((fx) => {
    renameSync(path.join(fx.shots, 'iw-IL'), path.join(fx.shots, 'he-IL'));
    fx.log.sets['he-IL'] = fx.log.sets['iw-IL'];
    delete fx.log.sets['iw-IL'];
    writeFileSync(path.join(fx.shots, 'render-log.json'), JSON.stringify(fx.log));
    const result = run(fx);
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => /iw-IL\/ is missing/.test(p)));
    assert.ok(result.problems.some((p) => /he-IL\/ is not a listing language/.test(p)));
  }));

test('a listing language without a set fails', () =>
  withFixture((fx) => {
    mkdirSync(path.join(fx.listing, 'ar'));
    expectOnly(run(fx), /ar\/ is missing - play\/listing\/ar has no screenshot set/);
  }));

test('numbering must be 01, 02, ... without gaps and names NN-name.png', () => {
  withFixture((fx) => {
    const buf = readFileSync(path.join(fx.shots, 'en-US', '02-diary.png'));
    rmSync(path.join(fx.shots, 'en-US', '02-diary.png'));
    delete fx.log.sets['en-US'].files['02-diary.png'];
    putImage(fx, 'en-US', '03-diary.png', buf);
    expectOnly(run(fx), /en-US\/03-diary\.png: numbered 03, 02 expected/);
  });
  withFixture((fx) => {
    const buf = readFileSync(path.join(fx.shots, 'en-US', '02-diary.png'));
    rmSync(path.join(fx.shots, 'en-US', '02-diary.png'));
    delete fx.log.sets['en-US'].files['02-diary.png'];
    putImage(fx, 'en-US', '02 Diary.png', buf);
    expectOnly(run(fx), /en-US\/02 Diary\.png: name is not NN-name\.png/);
  });
});

test('a JPEG is accepted when its size is right', () =>
  withFixture((fx) => {
    // SOI, SOF0 (precision 8, 1920 x 1080 written as height/width), padding, EOI.
    const sof = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x07, 0x80, 0x04, 0x38, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
    const jpeg = Buffer.concat([sof, Buffer.alloc(20 * 1024, 0x55), Buffer.from([0xff, 0xd9])]);
    putImage(fx, 'en-US', '03-entry.jpg', jpeg);
    const result = run(fx);
    assert.deepEqual(result.problems, []);
  }));

test('over 8 MB fails', () => {
  const rgb = encodePng(noise(360, 640, 8), { alpha: false });
  const filler = Buffer.alloc(RULES.maxBytes + 1);
  // An ancillary chunk with a wrong CRC is reported too; only the size matters here.
  const big = Buffer.concat([rgb.subarray(0, rgb.length - 12), filler, rgb.subarray(rgb.length - 12)]);
  assert.ok(imageProblems(big).problems.some((p) => /8 MB/.test(p)));
});

test('the render log: a file the render did not write fails', () =>
  withFixture((fx) => {
    writeFileSync(path.join(fx.shots, 'en-US', '02-diary.png'), png(360, 640, 4242));
    expectOnly(run(fx), /en-US\/02-diary\.png: differs from the file the render wrote/);
  }));

test('the render log: a missing log fails', () =>
  withFixture((fx) => {
    rmSync(path.join(fx.shots, 'render-log.json'));
    const result = run(fx);
    assert.equal(result.ok, false);
    assert.ok(result.problems.some((p) => /render-log\.json: missing/.test(p)));
  }));

test('the render log: any host but 127.0.0.1, or a refused request, fails', () => {
  withFixture((fx) => {
    fx.log.sets['iw-IL'].transport.hosts = ['127.0.0.1', 'fonts.example.org'];
    writeFileSync(path.join(fx.shots, 'render-log.json'), JSON.stringify(fx.log));
    expectOnly(run(fx), /iw-IL: the transport log names .*fonts\.example\.org/);
  });
  withFixture((fx) => {
    fx.log.sets['en-US'].transport.refused = 2;
    writeFileSync(path.join(fx.shots, 'render-log.json'), JSON.stringify(fx.log));
    expectOnly(run(fx), /en-US: the transport log has refused requests/);
  });
  withFixture((fx) => {
    fx.log.sets['en-US'].transport.hosts = ['localhost'];
    writeFileSync(path.join(fx.shots, 'render-log.json'), JSON.stringify(fx.log));
    expectOnly(run(fx), /en-US: the transport log names \["localhost"\]/);
  });
});

test('the render log: a set without the layout check of the render fails', () =>
  withFixture((fx) => {
    delete fx.log.sets['iw-IL'].layout;
    writeFileSync(path.join(fx.shots, 'render-log.json'), JSON.stringify(fx.log));
    expectOnly(run(fx), /iw-IL: render-log\.json does not record the layout check/);
  }));

test('the committed play/screenshots pass (when rendered)', () => {
  let folders = [];
  try {
    folders = readdirSync(path.join(ROOT, 'play', 'screenshots'));
  } catch {
    return; // not rendered yet in this tree
  }
  if (!folders.length) return;
  const result = checkScreenshots();
  assert.deepEqual(result.problems, []);
  assert.equal(result.sets.length, 20);
});

// ---------------------------------------------------------------------------------------------
// render-screenshots.mjs (pure parts)
// ---------------------------------------------------------------------------------------------

test('network guard: only the render server itself (http://127.0.0.1:<its port>) is allowed', () => {
  const base = 'http://127.0.0.1:50123';
  for (const ok of [`${base}/`, `${base}/api/auth/me`, `${base}/assets/index-abc.js?x=1#y`, 'data:image/png;base64,AAAA', 'blob:http://127.0.0.1:50123/1234', 'about:blank']) {
    assert.equal(isAllowedUrl(ok, base), true, ok);
  }
  for (const bad of [
    'http://127.0.0.1:50124/',
    `http://127.0.0.1:${FORBIDDEN_PORT}/api/health`,
    'http://localhost:50123/',
    'https://127.0.0.1:50123/',
    'http://[::1]:50123/',
    'http://10.0.0.5:50123/',
    'https://fonts.googleapis.com/css',
    'https://diary.example.org/api/auth/me',
    'ws://127.0.0.1:50123/',
    'not a url',
  ]) {
    assert.equal(isAllowedUrl(bad, base), false, bad);
  }
  // A base that is not loopback allows nothing at all.
  assert.equal(isAllowedUrl('http://192.168.1.2:80/', 'http://192.168.1.2:80'), false);
});

test('transport log: assertLoopbackOnly passes a loopback-only log and names every outside URL', () => {
  const base = 'http://127.0.0.1:50123';
  const good = [
    { from: 'script', url: `${base}/api/auth/register` },
    { from: 'browser en-US', url: `${base}/assets/a.js` },
  ];
  assert.deepEqual(assertLoopbackOnly(good, base), { requests: 2, hosts: ['127.0.0.1:50123'] });
  const bad = [...good, { from: 'browser ar (blocked)', url: 'https://cdn.example.net/font.woff2' }, { from: 'script', url: 'http://127.0.0.1:47321/api/health' }];
  assert.throws(() => assertLoopbackOnly(bad, base), (e) => /cdn\.example\.net/.test(e.message) && /47321/.test(e.message));
});

test('the render script names no remote URL in its code', () => {
  const source = readFileSync(path.join(HERE, 'render-screenshots.mjs'), 'utf8');
  const urls = source.match(/\b(?:https?|wss?):\/\/[^\s'"`)]+/g) ?? [];
  assert.ok(urls.length > 0);
  for (const url of urls) assert.match(url, /^http:\/\/127\.0\.0\.1:/, url);
});

test('the phone profile: the 20 folders of play/listing, 1080x1920 within Play rules', () => {
  const phone = PROFILES.phone;
  const listing = readdirSync(path.join(ROOT, 'play', 'listing')).sort();
  assert.deepEqual(Object.keys(phone.folders).sort(), listing);
  assert.equal(listing.length, 20);
  assert.ok(listing.includes(DEFAULT_LOCALE));
  assert.ok(listing.includes('iw-IL') && !listing.includes('he-IL'));
  const w = phone.viewport.width * phone.deviceScaleFactor;
  const h = phone.viewport.height * phone.deviceScaleFactor;
  assert.deepEqual([w, h], [1080, 1920]);
  assert.ok(h <= 2 * w && w >= 320 && h <= 3840);
  assert.equal(w * 16, h * 9);
  assert.equal(browserLocaleOf('iw-IL'), 'he-IL');
  assert.equal(browserLocaleOf('pt-BR'), 'pt-BR');
});

test('the shots: 2-8 per set, named NN-name, numbered without gaps', () => {
  assert.ok(SHOTS.length >= 2 && SHOTS.length <= 8);
  SHOTS.forEach((s, i) => {
    assert.equal(s.n, String(i + 1).padStart(2, '0'));
    assert.match(`${s.n}-${s.slug}.png`, /^\d\d-[a-z0-9]+(?:-[a-z0-9]+)*\.png$/);
  });
  assert.ok(NEVER_VISIBLE.includes('[data-testid="server-address"]'));
});

test('fictional accounts: every app language, ASCII user names the app accepts, example.com addresses', () => {
  const appLocales = Object.values(PROFILES.phone.folders);
  assert.deepEqual(Object.keys(FICTIONAL_PEOPLE).sort(), [...appLocales].sort());
  const names = new Set();
  for (const locale of appLocales) {
    const a = fictionalAccount(locale, 'Firstname');
    assert.match(a.username, /^[A-Za-z0-9_.-]{3,32}$/);
    assert.match(a.email, /^[a-z0-9.]+@example\.com$/);
    assert.ok(a.lastName.length > 0);
    assert.ok(!names.has(a.username), `user name ${a.username} twice`);
    names.add(a.username);
  }
  assert.throws(() => fictionalAccount('xx', 'A'));
});

test('the entry of shot 03: a good-mood entry with exercise wins; the latest on a tie', () => {
  const base = { mood: 6, exerciseMinutes: null, exerciseType: '', sleepHours: 6, sleepQuality: 5, people: [], events: [], location: '', notes: '', emotions: [], tags: [] };
  const plain = { ...base, id: 1, mood: 9 };
  const rich = { ...base, id: 2, mood: 8, exerciseMinutes: 30, exerciseType: 'running', sleepHours: 8, people: ['Noa'] };
  const lowRich = { ...base, id: 3, mood: 4, exerciseMinutes: 30, exerciseType: 'yoga', sleepHours: 9, sleepQuality: 9, people: ['A'], events: ['B'], location: 'C', notes: 'D', emotions: ['calm'], tags: ['t'] };
  assert.ok(entryScore(rich) > entryScore(plain));
  assert.equal(pickEntry([plain, lowRich, rich]).id, 2);
  assert.equal(pickEntry([{ ...rich, id: 7 }, { ...rich, id: 8 }]).id, 7);
  assert.equal(pickEntry([]), null);
});

test('the server clock: anchored to the fixed time, running on, restored', () => {
  const RealDate = Date;
  const clock = installServerClock();
  try {
    clock.anchor(Date.parse(FIXED_TIME));
    const now = Date.now();
    assert.ok(Math.abs(now - RealDate.parse(FIXED_TIME)) < 1000);
    assert.equal(new Date().toISOString().slice(0, 10), FIXED_TIME.slice(0, 10));
    assert.equal(new Date('2020-01-02T03:04:05Z').toISOString(), '2020-01-02T03:04:05.000Z');
    assert.ok(new Date() instanceof RealDate);
  } finally {
    clock.restore();
  }
  assert.equal(Date, RealDate);
});

test('PNG conversion: an opaque capture becomes a 24-bit RGB PNG with the same pixels; a transparent pixel fails', () => {
  const img = noise(40, 60, 11);
  const out = toOpaqueRgbPng(encodePng(img, { alpha: true }));
  assert.equal(out[25], 2, 'colour type 2 (RGB)');
  assert.equal(out[24], 8, '8 bits per channel');
  assert.deepEqual(decodePng(out).data, img.data);
  const holed = noise(40, 60, 12);
  holed.data[4 * 100 + 3] = 0;
  assert.throws(() => toOpaqueRgbPng(encodePng(holed, { alpha: true })), /transparent pixel/);
});

test('layout rules: the scroll positions tried, nearest first, inside the page and the allowed range', () => {
  assert.deepEqual(scrollCandidates(100, { up: 8, down: 12, step: 4 }), [100, 104, 96, 108, 92, 112]);
  // At the top of the page nothing above 0 is tried; at the end nothing past maxY.
  assert.deepEqual(scrollCandidates(0, { up: 48, down: 8, step: 4 }), [0, 4, 8]);
  assert.deepEqual(scrollCandidates(50, { up: 4, down: 40, step: 4, maxY: 54 }), [50, 54, 46]);
  assert.deepEqual(scrollCandidates(10, {}), [10]);
});

test('layout rules: a line break inside a word is caught, an ordinary one is not', () => {
  // The e-mail of the first render: "zhang.xiaowen@example.c" / "om".
  assert.equal(isMidWordBreak('c', 'o'), true);
  assert.equal(isMidWordBreak('c', 'o', false), true, 'Latin letters in a Chinese line too');
  // German, Greek, Russian, Hindi (a letter and its vowel sign), Hebrew, Arabic.
  for (const [a, b] of [['h', 'b'], ['ο', 'λ'], ['б', 'р'], ['क', 'ि'], ['ש', 'ל'], ['ك', 'ت'], ['1', '9']]) assert.equal(isMidWordBreak(a, b), true, `${a}|${b}`);
  // After a space, a hyphen, a dash or a slash: an ordinary break.
  for (const [a, b] of [[' ', 'w'], ['-', 'w'], ['–', 'w'], ['/', 'w'], ['.', ' '], ['a', ' ']]) assert.equal(isMidWordBreak(a, b), false, `${a}|${b}`);
  // Chinese, Japanese and Thai break between their own characters.
  for (const [a, b] of [['记', '会'], ['ゆ', 'っ'], ['ก', 'า']]) assert.equal(isMidWordBreak(a, b, false), false, `${a}|${b}`);
  assert.deepEqual([...NO_WORD_SPACES].sort(), ['ja', 'th', 'zh']);
  // layoutProbe runs in the browser and cannot import isMidWordBreak: it carries the same two patterns.
  const probe = layoutProbe.toString();
  assert.ok(probe.includes('/[-\\u2010-\\u2015/\\u00ad]/u') && probe.includes('/[\\p{L}\\p{N}\\p{M}]/u'));
});

test('shot 07: an entry written offline from the set\'s own demo texts; the last shot, with the badge and the toast on the screen', () => {
  const content = {
    titles: { high: ['a', 'b', 'c', 'd', 'A day of small wins', 'f'] },
    openers: { high: ['I felt really good today.'] },
    sleep: (hours, low) => (low ? 'low' : `I slept ${hours} hours, quite well.`),
    secondEntry: (slot) => (slot === 'evening' ? 'A short summary of the evening before sleep.' : 'midday'),
  };
  const e = offlineEntry(content);
  assert.equal(e.title, 'A day of small wins');
  assert.equal(e.body, 'I felt really good today. I slept 8 hours, quite well. A short summary of the evening before sleep.');
  assert.deepEqual(e.ratings, { mood: 8, energy: 7, stress: 3 });
  assert.throws(() => offlineEntry({ titles: { high: [] }, openers: { high: [] } }), /seed content/);
  const last = SHOTS[SHOTS.length - 1];
  assert.equal(last.offline, 'write', 'the network stays cut after it, so it must be the last shot');
  assert.equal(SHOTS.filter((s) => s.offline === 'write').length, 1);
  assert.ok(last.show.some((s) => /pending-badge/.test(s)) && last.show.some((s) => /toast/.test(s)));
  // 07 is the end of the list (today's entries and the new one), where the toast covers only free space.
  assert.equal(last.scrollTo, 'end');
  // Settings shows the account card with all its fields.
  assert.ok(SHOTS.find((s) => s.slug === 'settings').show.includes('main dl'));
});

test('arguments: locales are Play folder names, dark needs its own folder, unknown options fail', () => {
  assert.deepEqual(parseArgs(['--locale', 'en-US,iw-IL']).locales, ['en-US', 'iw-IL']);
  assert.deepEqual([...parseArgs(['--only', '1,07']).only], ['01', '07']);
  assert.equal(parseArgs(['--keep-going']).keepGoing, true);
  assert.equal(parseArgs([]).keepGoing, false);
  assert.throws(() => parseArgs(['--locale', 'he-IL']), /unknown locale folder/);
  assert.throws(() => parseArgs(['--theme', 'dark']), /needs --out/);
  assert.equal(parseArgs(['--theme', 'dark', '--out', 'x']).theme, 'dark');
  assert.throws(() => parseArgs(['--profile', 'tablet']), /unknown profile/);
  assert.equal(parseArgs(['--profile', 'desktop']).profile, 'desktop');
  assert.throws(() => parseArgs(['--bogus']), /unknown argument/);
});

