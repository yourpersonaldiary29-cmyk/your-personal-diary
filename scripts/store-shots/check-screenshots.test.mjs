/**
 * Tests of scripts/store-shots/check-screenshots.mjs (the Microsoft Store desktop screenshots) and of the
 * pure helpers the desktop profile added to scripts/play/render-screenshots.mjs.
 *
 *   node --test scripts/store-shots/check-screenshots.test.mjs
 *
 * The fixtures are small sets written to a temporary folder: real 1920x1080 PNGs (a gradient with a block
 * of noise, so they are not blank and not tiny), a captions.json and a render-log.json that match them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  captionProblems,
  checkScreenshots,
  DEFAULT_DIR,
  EXPECTED_FILES,
  formatReport,
  imageProblems,
  playLocaleOf,
  RULES,
  STORE_TAGS,
} from './check-screenshots.mjs';
import { encodePng } from '../play/render-graphics.mjs';
import {
  DESKTOP_CHROME,
  DESKTOP_SHOTS,
  desktopOfflineEntry,
  layoutProbe,
  offlineEntry,
  PHONE_CHROME,
  PROFILES,
  STORE_FOLDERS,
  wholeSentencesWithin,
} from '../play/render-screenshots.mjs';

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const images = new Map();
/** A PNG of `width` x `height`: a gradient and a 160x160 block of noise (cached per size and alpha). */
function png(width = 1920, height = 1080, { alpha = false } = {}) {
  const key = `${width}x${height}${alpha ? 'a' : ''}`;
  if (images.has(key)) return images.get(key);
  const data = new Uint8Array(width * height * 4);
  let seed = 12345;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (x < 160 && y < 160) {
        seed = (seed * 1103515245 + 12345) >>> 0;
        data[i] = seed & 255;
        data[i + 1] = (seed >>> 8) & 255;
        data[i + 2] = (seed >>> 16) & 255;
      } else {
        data[i] = (x * 255) / width;
        data[i + 1] = (y * 255) / height;
        data[i + 2] = 200;
      }
      data[i + 3] = alpha && x > width - 20 ? 128 : 255;
    }
  }
  const buf = encodePng({ width, height, data }, { alpha });
  images.set(key, buf);
  return buf;
}

const CAPTION = {
  'en-US': (n) => `Screen ${n}: your entries, your habits and your calendar in one place.`,
  'he-IL': (n) => `מסך ${n}: הרשומות, ההרגלים ולוח השנה שלכם במקום אחד.`,
};
const TAGS = ['en-US', 'he-IL'];
const FILES = ['01-home.png', '02-diary.png'];

/** Writes a valid fixture set; returns its folder. */
function fixture({ tags = TAGS, files = FILES, extra = null } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mpd-store-shots-test-'));
  const log = { generator: 'test', profile: 'desktop', size: '1920x1080', sets: {} };
  const captions = { _comment: 'test' };
  for (const tag of tags) {
    mkdirSync(path.join(dir, tag));
    log.sets[tag] = { appLocale: STORE_FOLDERS[tag], files: {}, layout: 'clean', transport: { requests: 10, hosts: ['127.0.0.1'], refused: 0 } };
    captions[tag] = {};
    for (const name of files) {
      const buf = png();
      writeFileSync(path.join(dir, tag, name), buf);
      log.sets[tag].files[name] = { bytes: buf.length, sha256: sha256(buf) };
      captions[tag][name] = CAPTION[tag](name.slice(0, 2));
    }
  }
  writeFileSync(path.join(dir, 'render-log.json'), JSON.stringify(log, null, 2));
  writeFileSync(path.join(dir, 'captions.json'), JSON.stringify(captions, null, 2));
  writeFileSync(path.join(dir, 'README.md'), '# test\n');
  if (extra) extra(dir, log, captions);
  return dir;
}
const rewrite = (dir, name, fn) => {
  const file = path.join(dir, name);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  fn(json);
  writeFileSync(file, JSON.stringify(json, null, 2));
};
const check = (dir, options = {}) => checkScreenshots(dir, { tags: TAGS, expected: FILES, ...options });
function withFixture(options, fn) {
  const dir = fixture(options);
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const has = (result, re) => result.problems.some((p) => re.test(p));

// ---------------------------------------------------------------------------------------------

test('the Store tags: 20 listing languages, en-US (the default listing) first, each a known app language', () => {
  assert.equal(STORE_TAGS.length, 20);
  assert.equal(STORE_TAGS[0], 'en-US');
  assert.deepEqual(
    [...STORE_TAGS].sort(),
    ['ar-SA', 'bg-BG', 'cs-CZ', 'de-DE', 'el-GR', 'en-US', 'es-ES', 'fr-FR', 'he-IL', 'hi-IN', 'hu-HU', 'it-IT', 'ja-JP', 'pl-PL', 'pt-PT', 'ro-RO', 'ru-RU', 'th-TH', 'tr-TR', 'zh-CN'],
  );
  for (const tag of STORE_TAGS) assert.ok(playLocaleOf(tag), `${tag} has an app language`);
  assert.equal(playLocaleOf('he-IL'), 'iw-IL');
  assert.equal(playLocaleOf('pt-PT'), 'pt-BR');
  assert.equal(playLocaleOf('ar-SA'), 'ar');
});

test('the desktop shot list: 8 shots (Microsoft recommends 5-8, allows up to 10), numbered 01-08', () => {
  assert.equal(EXPECTED_FILES.length, 8);
  assert.ok(EXPECTED_FILES.length >= RULES.recommendedMin && EXPECTED_FILES.length <= RULES.recommendedMax);
  EXPECTED_FILES.forEach((name, i) => assert.match(name, new RegExp(`^0${i + 1}-[a-z]+\\.png$`)));
  assert.deepEqual(DESKTOP_SHOTS.map((s) => s.slug), ['home', 'diary', 'entry', 'calendar', 'habits', 'insights', 'settings', 'offline']);
});

test('the desktop profile renders 1920x1080 from the root UI build, without touching the phone profile', () => {
  const d = PROFILES.desktop;
  assert.equal(d.viewport.width * d.deviceScaleFactor, 1920);
  assert.equal(d.viewport.height * d.deviceScaleFactor, 1080);
  assert.equal(d.build, 'web');
  assert.equal(d.isMobile, false);
  assert.equal(d.hasTouch, false);
  assert.deepEqual(Object.keys(d.folders), STORE_TAGS);
  // The phone profile (Google Play) is as it was: no desktop-only options.
  const p = PROFILES.phone;
  assert.equal(p.viewport.width * p.deviceScaleFactor, 1080);
  assert.equal(p.viewport.height * p.deviceScaleFactor, 1920);
  assert.equal(p.build, 'mobile');
  for (const key of ['shots', 'chrome', 'deviceName', 'wholeExcerpts', 'offlineEntry']) assert.equal(p[key], undefined, `phone.${key}`);
});

test('layout rules by the glyphs\' ink (desktop only): air above the bottom edge of the image, nothing peeking under the header', () => {
  // The window's bottom edge is the image's edge on the desktop: the last line keeps air under its ink.
  assert.ok(DESKTOP_CHROME.ink && DESKTOP_CHROME.ink.air >= 2, 'DESKTOP_CHROME.ink.air (CSS px)');
  assert.equal(PROFILES.desktop.chrome, DESKTOP_CHROME);
  // The phone (Play) frame has no ink rule: its screenshots stay byte-identical.
  assert.equal(PHONE_CHROME.ink, undefined);
  const probe = layoutProbe.toString();
  // Measured from the font (canvas measureText: the real ink above / below the baseline) ...
  assert.ok(probe.includes('measureText') && probe.includes('actualBoundingBoxDescent') && probe.includes('fontBoundingBoxAscent'));
  // ... checked before the line-box leeway (EPS / HIDE) can call a line "hidden" ...
  assert.ok(probe.indexOf('frame.ink.air') < probe.indexOf('if (bottom <= topEdge + HIDE || top >= navEdge - HIDE) continue;'));
  // ... and only when the frame asks for it.
  assert.ok(probe.includes('frame.ink ? document.createElement'));
});

test('the desktop offline entry (shot 08): the phone\'s entry with three more demo sentences, joined the language\'s way', () => {
  const content = {
    titles: { high: ['a', 'b', 'c', 'd', 'A day of small wins', 'f'] },
    openers: { high: ['I felt really good today.'] },
    sleep: (hours, low) => (low ? 'low' : `I slept ${hours} hours, quite well.`),
    exercise: (type, minutes, slot) => `I did ${minutes} minutes of ${type} ${slot === 'midday' ? 'in the morning' : 'in the afternoon'}.`,
    exerciseTypes: ['walking', 'running'],
    people: ['Dana', 'Yossi'],
    peopleSentence: (names, met) => `${met ? 'I met' : 'I talked with'} ${names.join(' and ')}.`,
    secondEntry: (slot) => (slot === 'evening' ? 'A short summary of the evening before sleep.' : 'midday'),
    note: 'Remember to write tomorrow about what went well.',
  };
  const phone = offlineEntry(content);
  const desk = desktopOfflineEntry(content);
  assert.equal(PROFILES.desktop.offlineEntry, desktopOfflineEntry);
  assert.equal(desk.title, phone.title);
  assert.deepEqual(desk.ratings, phone.ratings);
  assert.equal(
    desk.body,
    'I felt really good today. I slept 8 hours, quite well. I did 30 minutes of walking in the afternoon. I met Yossi. A short summary of the evening before sleep. Remember to write tomorrow about what went well.',
  );
  // The phone's sentences are all there; the body is longer (the entry page grows by at least a line).
  for (const s of phone.body.split('. ')) assert.ok(desk.body.includes(s.replace(/\.$/, '')), s);
  assert.ok(desk.body.length > phone.body.length + 60);
  // Chinese / Japanese: no space after "。" (sentenceSeparator '').
  const zh = desktopOfflineEntry({ ...content, sentenceSeparator: '', openers: { high: ['今天很好。'] }, sleep: () => '睡了8小时。', exercise: () => '散步30分钟。', peopleSentence: () => '见了小明。', secondEntry: () => '晚上的小结。', note: '明天记得写。' });
  assert.equal(zh.body, '今天很好。睡了8小时。散步30分钟。见了小明。晚上的小结。明天记得写。');
  assert.throws(() => desktopOfflineEntry({ ...content, note: '' }), /seed content/);
  assert.throws(() => desktopOfflineEntry({ ...content, titles: { high: [] } }), /seed content/);
});

test('a valid fixture passes, with a warning for fewer than the 5-8 screenshots Microsoft recommends', () =>
  withFixture({}, (dir) => {
    const result = check(dir);
    assert.deepEqual(result.problems, []);
    assert.equal(result.ok, true);
    assert.ok(result.warnings.some((w) => /recommends 5-8/.test(w)));
    assert.match(formatReport(result), /2 listing languages, 4 images/);
    assert.deepEqual(result.sets.map((s) => s.tag), TAGS);
    assert.equal(result.sets[0].files[0].width, 1920);
  }));

test('the default listing en-US must have a set, and every listing language must have one', () => {
  withFixture({ tags: ['he-IL'] }, (dir) => {
    const result = check(dir);
    assert.ok(has(result, /^en-US: no screenshot set \(the default listing - required\)/));
  });
  withFixture({ tags: ['en-US'] }, (dir) => {
    assert.ok(has(check(dir), /^he-IL: no screenshot set/));
  });
});

test('more than 10 screenshots in a language fail (Microsoft: "up to 10 desktop screenshots")', () => {
  const many = Array.from({ length: 11 }, (_, i) => `${String(i + 1).padStart(2, '0')}-shot.png`);
  withFixture({ files: many }, (dir) => {
    const result = check(dir, { expected: null });
    assert.ok(has(result, /^en-US: 11 screenshots - Microsoft: at least 1, "up to 10 desktop screenshots"/));
  });
});

test('numbering must be 01, 02, ... without gaps, and the set must be the desktop shot list', () => {
  withFixture({ files: ['01-home.png', '03-diary.png'] }, (dir) => {
    const result = check(dir);
    assert.ok(has(result, /03-diary\.png: numbered 03, expected 02/));
    assert.ok(has(result, /missing 02-diary\.png/));
    assert.ok(has(result, /not in the desktop shot list: 03-diary\.png/));
  });
});

test('only PNG files: a JPEG or another file in a set fails', () =>
  withFixture(
    {
      extra: (dir) => {
        writeFileSync(path.join(dir, 'en-US', '03-extra.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
      },
    },
    (dir) => assert.ok(has(check(dir), /en-US\/03-extra\.jpg: not an NN-name\.png screenshot/)),
  ));

test('a file that is not a PNG inside, or a cut-off PNG, fails', () => {
  assert.match(imageProblems(Buffer.from('GIF89a........'), RULES).problems[0], /not a PNG file/);
  const cut = png().subarray(0, 5000);
  assert.ok(imageProblems(cut, RULES).problems.length > 0);
});

test("sizes: under Microsoft's 1366 x 768 fails, 1366 x 768 is Microsoft's minimum, the set itself is 1920x1080", () => {
  const small = imageProblems(png(1280, 720), RULES).problems;
  assert.ok(small.some((p) => /smaller than Microsoft's 1366 x 768/.test(p)));
  const min = imageProblems(png(1366, 768), RULES).problems;
  assert.ok(!min.some((p) => /Microsoft's 1366/.test(p)));
  assert.ok(min.some((p) => /the set is 1920x1080/.test(p)));
  assert.deepEqual(imageProblems(png(), RULES).problems, []);
  // Over 4K (rules lowered so the test needs no 4K image)
  const big = imageProblems(png(), { ...RULES, maxLong: 1900, maxShort: 1000 }).problems;
  assert.ok(big.some((p) => /larger than the 1900 x 1000 \(4K\)/.test(p)));
});

test('an alpha channel fails (a capture of the window is opaque)', () => {
  assert.ok(imageProblems(png(1920, 1080, { alpha: true }), RULES).problems.some((p) => /alpha channel/.test(p)));
});

test('over 50 MB fails (rule lowered for the test)', () => {
  assert.ok(imageProblems(png(), { ...RULES, maxBytes: 1000 }).problems.some((p) => /over Microsoft's 50 MB/.test(p)));
  assert.equal(RULES.maxBytes, 50 * 1024 * 1024);
});

test('captions: one per screenshot, at most 200 characters (Microsoft), honest and in the language', () => {
  assert.deepEqual(captionProblems('en-US', 'Calendar: mood, energy and habits on every day of the month.'), []);
  assert.deepEqual(captionProblems('en-US', undefined), ['no caption']);
  assert.ok(captionProblems('en-US', `Home: ${'a'.repeat(200)}`).some((p) => /characters long - Microsoft: "200 characters or less"/.test(p)));
  assert.equal(RULES.captionMax, 200);
  assert.ok(captionProblems('en-US', 'Your diary is stored only on your computer.').some((p) => /stored only on the device/.test(p)));
  assert.ok(captionProblems('en-US', 'Protected with end-to-end encryption.').some((p) => /end-to-end/.test(p)));
  assert.ok(captionProblems('en-US', 'The best diary, and it is free.').some((p) => /metadata policy forbids/.test(p)));
  assert.ok(captionProblems('he-IL', 'Home: your entries at a glance.').some((p) => /is not written in Hebrew/.test(p)));
  const english = 'Ajustes: idiomas, cuenta y dispositivos.';
  assert.ok(captionProblems('es-ES', english, english).some((p) => /is the English text/.test(p)));
  assert.ok(captionProblems('en-US', 'Two\nlines').some((p) => /line break/.test(p)));
});

test('captions.json: a missing caption, a caption without a screenshot and an unknown tag fail', () =>
  withFixture({}, (dir) => {
    rewrite(dir, 'captions.json', (c) => {
      delete c['he-IL']['02-diary.png'];
      c['en-US']['09-extra.png'] = 'Extra: something else entirely.';
      c['xx-XX'] = {};
    });
    const result = check(dir);
    assert.ok(has(result, /he-IL\/02-diary\.png: caption no caption/));
    assert.ok(has(result, /en-US\/09-extra\.png has a caption but no screenshot/));
    assert.ok(has(result, /"xx-XX" is not a Store listing tag/));
  }));

test('the render log: missing, wrong profile, a file the render did not write, a set rendered without the layout rules', () => {
  withFixture({}, (dir) => {
    rmSync(path.join(dir, 'render-log.json'));
    assert.ok(has(check(dir), /render-log\.json: missing/));
  });
  withFixture({}, (dir) => {
    rewrite(dir, 'render-log.json', (l) => {
      l.profile = 'phone';
      l.sets['he-IL'].layout = undefined;
    });
    const result = check(dir);
    assert.ok(has(result, /profile "phone", expected "desktop"/));
    assert.ok(has(result, /he-IL: render-log\.json has no "layout": "clean"/));
  });
  withFixture({}, (dir) => {
    writeFileSync(path.join(dir, 'en-US', '02-diary.png'), png(1920, 1080, { alpha: true }));
    assert.ok(has(check(dir), /en-US\/02-diary\.png: differs from the file the render wrote/));
  });
});

test('the render log: any host but 127.0.0.1, or a refused request, fails', () =>
  withFixture({}, (dir) => {
    rewrite(dir, 'render-log.json', (l) => {
      l.sets['en-US'].transport.hosts = ['127.0.0.1', 'yourpersonaldiary.fly.dev'];
      l.sets['he-IL'].transport.refused = 1;
    });
    const result = check(dir);
    assert.ok(has(result, /en-US: render-log\.json transport log is not 127\.0\.0\.1 only/));
    assert.ok(has(result, /he-IL: render-log\.json transport log is not 127\.0\.0\.1 only/));
  }));

test('the folder: an unknown folder fails; logos/ and _obsolete-* are allowed', () =>
  withFixture(
    {
      extra: (dir) => {
        mkdirSync(path.join(dir, 'logos'));
        mkdirSync(path.join(dir, '_obsolete-2026-10-02'));
        mkdirSync(path.join(dir, 'he'));
      },
    },
    (dir) => {
      const result = check(dir);
      assert.deepEqual(result.problems, ['he: not a Store listing tag (en-US he-IL) nor a known file']);
    },
  ));

test('wholeSentencesWithin (desktop data fix): whole sentences within the limit, never a cut word', () => {
  const de = 'Ich bin mit einem Lächeln aufgewacht, und so ging der Tag auch weiter. Letzte Nacht habe ich nur 4 Stunden geschlafen, und das habe ich gemerkt. Ich habe mit Mama gesprochen.';
  assert.ok(Array.from(de).length > 160);
  assert.equal(wholeSentencesWithin(de, 160), 'Ich bin mit einem Lächeln aufgewacht, und so ging der Tag auch weiter. Letzte Nacht habe ich nur 4 Stunden geschlafen, und das habe ich gemerkt.');
  assert.equal(wholeSentencesWithin('Short.  Text  here.', 160), 'Short. Text here.');
  assert.equal(wholeSentencesWithin(`${'a'.repeat(200)}. B.`, 160), null);
  assert.equal(wholeSentencesWithin('今天很好。我睡了八个小时。晚上和妈妈聊了天。', 13), '今天很好。我睡了八个小时。');
  assert.equal(wholeSentencesWithin('v1.5 is out. Next one.', 14), 'v1.5 is out.');
});

test('the committed store/screenshots pass (when rendered)', (t) => {
  if (!existsSync(path.join(DEFAULT_DIR, 'render-log.json'))) return t.skip('not rendered yet');
  const result = checkScreenshots(DEFAULT_DIR);
  assert.deepEqual(result.problems, []);
  assert.equal(result.sets.length, 20);
});
