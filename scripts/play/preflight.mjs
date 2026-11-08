#!/usr/bin/env node
/**
 * Pre-flight of the Google Play kit (WP-17): is everything the owner is about to upload in place and
 * within Play's limits? Run it before EVERY upload (docs/PLAY-RELEASE.he.md, step 2):
 *
 *   node scripts/play/preflight.mjs                 the project tree (exit code 1 when a check FAILs)
 *   node scripts/play/preflight.mjs --json          the same, machine-readable
 *   node scripts/play/preflight.mjs --root=<dir> [--signing=<keystore.properties>]
 *                                                   another tree (the fixtures of preflight.test.mjs)
 *
 * FAIL = do not upload; WARN = the owner judges (e.g. screenshots not rendered yet).
 *
 *  - Store listing: play/listing/<play-locale>/{title,short,full}.txt for 20 locales, folder names from
 *    Play's own locale list (Hebrew is "iw-IL" on Play - the folder may be named he-IL, it is uploaded
 *    under iw-IL), en-US present (the default language), title <= 30 / short <= 80 / full <= 4000
 *    characters (Unicode code points; title and short on one line).
 *  - Graphics: play/graphics/icon-512.png (512x512, 32-bit PNG with alpha, <= 1024 KB) and
 *    play/graphics/feature-1024x500.png|jpg (1024x500, JPEG or 24-bit PNG without alpha; per-locale
 *    variants feature-1024x500.<locale>.png are checked too).
 *  - Screenshots: play/screenshots/<play-locale>/: WARN while the folder is missing (PLAY-SCREENSHOTS
 *    delivers it); when present, 2-8 images per locale, JPEG or 24-bit PNG without alpha, every side
 *    320-3840 px, the longer side at most twice the shorter; en-US (the default language) must have them.
 *  - Legal pages built into dist/: dist/privacy/index.html and dist/delete-account/index.html plus a page
 *    per locale, and no {{PLACEHOLDER}} left in them (the owner fills the publisher name and contact).
 *  - play/policy/{data-safety,content-rating,target-audience,app-access}.md - the answers the owner
 *    copies into the Play Console declarations (WARN when missing).
 *  - applicationId app.yourpersonaldiary in android/app/build.gradle and capacitor.config.ts - never the
 *    old com.mydiary.app, which is taken on Play and would be permanent after the first upload.
 *  - versionCode (android/app/version.properties): a positive integer <= 2100000000 (Play's maximum) and
 *    higher than the last upload recorded in play/last-upload.json. The OWNER updates that file after every
 *    successful upload ({"versionCode": N, ...}); a missing file means "nothing uploaded yet".
 *  - Signing: the keystore.properties file (DIARY_ANDROID_SIGNING or the default path) exists, names
 *    storeFile, storePassword, keyAlias and keyPassword, and the keystore it points at exists. The
 *    password values are never printed and never leave this process.
 *
 * Sources (read 2026-10-26): Play Console Help "Add preview assets to showcase your app" (9866151),
 * "Supported languages" (9844778); developer.android.com/studio/publish/versioning (versionCode rules).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(here, '..', '..');

export const APP_ID = 'app.yourpersonaldiary';
export const LEGACY_APP_ID = 'com.mydiary.app';
/** "The greatest value Google Play allows for versionCode is 2100000000." */
export const MAX_VERSION_CODE = 2100000000;
export const EXPECTED_LOCALES = 20;
export const DEFAULT_LOCALE = 'en-US';
export const LISTING_LIMITS = { 'title.txt': 30, 'short.txt': 80, 'full.txt': 4000 };
export const ONE_LINE_FILES = new Set(['title.txt', 'short.txt']);
export const ICON = { file: 'icon-512.png', width: 512, height: 512, maxBytes: 1024 * 1024 };
export const FEATURE = { pattern: /^feature-1024x500(?:[.-][A-Za-z0-9-]+)?\.(?:png|jpe?g)$/i, width: 1024, height: 500 };
export const SCREENSHOTS = { min: 2, max: 8, minSide: 320, maxSide: 3840, maxRatio: 2 };
export const IMAGE_EXT = /\.(?:png|jpe?g)$/i;
export const LEGAL_PAGES = ['privacy', 'delete-account'];
export const POLICY_FILES = ['data-safety.md', 'content-rating.md', 'target-audience.md', 'app-access.md'];
export const DEFAULT_SIGNING_FILE = 'C:\\Users\\AVI\\Projects\\android-signing\\keystore.properties';
export const SIGNING_KEYS = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'];
const PLACEHOLDER = /\{\{\s*[A-Z][A-Z0-9_]*\s*\}\}/;

/** Play's locale codes for store-listing translations (Play Console Help 9844778, read 2026-10-26). */
export const PLAY_LOCALES = new Set([
  'af', 'sq', 'am', 'ar', 'hy-AM', 'az-AZ', 'bn-BD', 'eu-ES', 'be', 'bg', 'my-MM', 'ca', 'zh-HK', 'zh-CN', 'zh-TW',
  'hr', 'cs-CZ', 'da-DK', 'nl-NL', 'en-AU', 'en-CA', 'en-US', 'en-GB', 'en-IN', 'en-SG', 'en-ZA', 'et', 'fil',
  'fi-FI', 'fr-CA', 'fr-FR', 'gl-ES', 'ka-GE', 'de-DE', 'el-GR', 'gu', 'iw-IL', 'hi-IN', 'hu-HU', 'is-IS', 'id',
  'it-IT', 'ja-JP', 'kn-IN', 'kk', 'km-KH', 'ko-KR', 'ky-KG', 'lo-LA', 'lv', 'lt', 'mk-MK', 'ms-MY', 'ms', 'ml-IN',
  'mr-IN', 'mn-MN', 'ne-NP', 'no-NO', 'fa', 'fa-AE', 'fa-AF', 'fa-IR', 'pl-PL', 'pt-BR', 'pt-PT', 'pa', 'ro', 'rm',
  'ru-RU', 'sr', 'si-LK', 'sk', 'sl', 'es-419', 'es-ES', 'es-US', 'sw', 'sv-SE', 'ta-IN', 'te-IN', 'th', 'tr-TR',
  'uk', 'ur', 'vi',
]);
/** Folder names accepted besides Play's own: the app's he-IL is Play's legacy iw-IL. */
export const LOCALE_ALIASES = { 'he-IL': 'iw-IL' };

const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const isFile = (p) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};
const subdirs = (p) => readdirSync(p).filter((n) => isDir(path.join(p, n))).sort();
const readText = (p) => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');

/**
 * Width / height / alpha of a PNG or JPEG from its header bytes (no decoder needed). PNG: the IHDR
 * chunk (colour type 6 = RGBA, 2 = RGB, 4 = grey+alpha, 0 = grey, 3 = indexed). JPEG: the first SOF
 * marker. Returns null for anything else.
 */
export function readImageInfo(buf) {
  if (buf.length >= 33 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a && buf.toString('latin1', 12, 16) === 'IHDR') {
    const bitDepth = buf[24];
    const colorType = buf[25];
    return {
      format: 'png',
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
      bitDepth,
      colorType,
      hasAlpha: colorType === 4 || colorType === 6,
      indexed: colorType === 3,
    };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xff) {
        i++;
        continue;
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
        i += 2;
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) return null;
      const length = buf.readUInt16BE(i + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        return { format: 'jpeg', width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), bitDepth: buf[i + 4], colorType: null, hasAlpha: false, indexed: false };
      }
      i += 2 + length;
    }
  }
  return null;
}

const describe = (info) => (info ? `${info.format.toUpperCase()} ${info.width}x${info.height}${info.format === 'png' ? `, colour type ${info.colorType}, ${info.bitDepth} bit${info.hasAlpha ? ', alpha' : ''}` : ''}` : 'not a PNG or JPEG');

/** Code points, the way a person counts letters; a lone trailing newline is not part of the text. */
export const countCharacters = (text) => [...text.replace(/\r?\n$/, '')].length;

/**
 * The versionCode recorded in play/last-upload.json. Only a JSON integer (or a string of digits) from 0 to
 * MAX_VERSION_CODE counts; null, a missing field, "", true, 1.5, -1 ... throw - never a silent 0 (Number(null)
 * and Number("") are 0). scripts/android/release-checks.ps1 (build-aab.ps1) reads the file by the same rules.
 */
export function readLastUploadVersionCode(jsonText) {
  const json = JSON.parse(jsonText);
  const has = json !== null && typeof json === 'object' && !Array.isArray(json) && Object.hasOwn(json, 'versionCode');
  const raw = has ? json.versionCode : undefined;
  const text = typeof raw === 'number' && Number.isInteger(raw) ? String(raw) : typeof raw === 'string' ? raw.trim() : null;
  if (text === null || !/^\d{1,10}$/.test(text) || Number(text) > MAX_VERSION_CODE) {
    throw new Error(`versionCode is ${has ? JSON.stringify(raw) : 'missing'}`);
  }
  return Number(text);
}

/**
 * Runs every check. Returns { results: [{ level: 'pass'|'warn'|'fail', check, detail }], failures, warnings, ok }.
 * `signingFile` defaults to DIARY_ANDROID_SIGNING or the owner's path; it is read for key NAMES only.
 */
export function runPreflight({ root = PROJECT_ROOT, signingFile = process.env.DIARY_ANDROID_SIGNING || DEFAULT_SIGNING_FILE } = {}) {
  const results = [];
  const add = (level, check, detail) => results.push({ level, check, detail });
  const at = (...parts) => path.join(root, ...parts);

  // --- Store listing ------------------------------------------------------------------------------
  const listingDir = at('play', 'listing');
  let listingLocales = [];
  if (!isDir(listingDir)) {
    add('fail', 'listing', 'play/listing/ is missing (the PLAY-LISTING package delivers play/listing/<locale>/{title,short,full}.txt)');
  } else {
    listingLocales = subdirs(listingDir);
    const unknown = listingLocales.filter((l) => !PLAY_LOCALES.has(l) && !LOCALE_ALIASES[l]);
    if (unknown.length) add('fail', 'listing locales', `not Play locale codes (Play Console Help "Supported languages"): ${unknown.join(', ')}`);
    if (listingLocales.length < EXPECTED_LOCALES) add('fail', 'listing locales', `${listingLocales.length} locale folders, the app has ${EXPECTED_LOCALES} languages: ${listingLocales.join(' ') || '(none)'}`);
    else if (listingLocales.length > EXPECTED_LOCALES) add('warn', 'listing locales', `${listingLocales.length} locale folders, expected ${EXPECTED_LOCALES}: ${listingLocales.join(' ')}`);
    else add('pass', 'listing locales', `${listingLocales.length} locales: ${listingLocales.join(' ')}`);
    if (!listingLocales.includes(DEFAULT_LOCALE)) add('fail', 'listing locales', `${DEFAULT_LOCALE} (the default language of the Play listing) is missing`);
    const aliased = listingLocales.filter((l) => LOCALE_ALIASES[l]);
    if (aliased.length) add('warn', 'listing locales', aliased.map((l) => `${l}: Play Console lists this language as "${LOCALE_ALIASES[l]}" - upload the folder there`).join('; '));
    let problems = 0;
    let files = 0;
    for (const locale of listingLocales) {
      for (const [file, limit] of Object.entries(LISTING_LIMITS)) {
        const p = path.join(listingDir, locale, file);
        if (!isFile(p)) {
          add('fail', `listing ${locale}/${file}`, 'missing');
          problems++;
          continue;
        }
        const body = readText(p).replace(/\r?\n$/, '');
        const count = [...body].length;
        if (count === 0) {
          add('fail', `listing ${locale}/${file}`, 'empty');
          problems++;
        } else if (count > limit) {
          add('fail', `listing ${locale}/${file}`, `${count} characters, Play allows ${limit}`);
          problems++;
        } else if (ONE_LINE_FILES.has(file) && /\r|\n/.test(body)) {
          add('fail', `listing ${locale}/${file}`, 'must be a single line');
          problems++;
        } else if (body !== body.trim()) {
          add('warn', `listing ${locale}/${file}`, 'leading or trailing whitespace (Play keeps it)');
        }
        files++;
      }
    }
    if (listingLocales.length && !problems) add('pass', 'listing texts', `${files} files within Play's limits (title <= ${LISTING_LIMITS['title.txt']}, short <= ${LISTING_LIMITS['short.txt']}, full <= ${LISTING_LIMITS['full.txt']} characters)`);
  }

  // --- Graphics -----------------------------------------------------------------------------------
  const graphicsDir = at('play', 'graphics');
  if (!isDir(graphicsDir)) {
    add('fail', 'graphics', 'play/graphics/ is missing (PLAY-LISTING renders icon-512.png and feature-1024x500.png with scripts/play/render-graphics.mjs)');
  } else {
    const iconPath = path.join(graphicsDir, ICON.file);
    if (!isFile(iconPath)) {
      add('fail', `graphics ${ICON.file}`, 'missing (Play: hi-res icon, 512x512, 32-bit PNG with alpha)');
    } else {
      const buf = readFileSync(iconPath);
      const info = readImageInfo(buf);
      const ok = info && info.format === 'png' && info.width === ICON.width && info.height === ICON.height && info.colorType === 6 && info.bitDepth === 8 && buf.length <= ICON.maxBytes;
      add(ok ? 'pass' : 'fail', `graphics ${ICON.file}`, `${describe(info)}, ${buf.length} bytes${ok ? '' : ` - Play wants PNG ${ICON.width}x${ICON.height}, 32-bit RGBA (colour type 6, 8 bit), <= ${ICON.maxBytes} bytes`}`);
    }
    const features = readdirSync(graphicsDir).filter((n) => FEATURE.pattern.test(n)).sort();
    if (!features.length) {
      add('fail', 'graphics feature-1024x500', 'missing (Play: feature graphic 1024x500, JPEG or 24-bit PNG without alpha)');
    } else {
      let bad = 0;
      for (const name of features) {
        const info = readImageInfo(readFileSync(path.join(graphicsDir, name)));
        const ok = info && info.width === FEATURE.width && info.height === FEATURE.height && !info.hasAlpha && !info.indexed && (info.format === 'jpeg' || info.bitDepth === 8);
        if (!ok) {
          bad++;
          add('fail', `graphics ${name}`, `${describe(info)} - Play wants ${FEATURE.width}x${FEATURE.height}, JPEG or 24-bit PNG (colour type 2, 8 bit) without alpha`);
        }
      }
      if (!bad) add('pass', 'graphics feature-1024x500', `${features.length} file(s) are ${FEATURE.width}x${FEATURE.height} without alpha: ${features.join(', ')}`);
    }
  }

  // --- Screenshots --------------------------------------------------------------------------------
  const shotsDir = at('play', 'screenshots');
  if (!isDir(shotsDir)) {
    add('warn', 'screenshots', 'play/screenshots/ is missing - the PLAY-SCREENSHOTS package renders it; Play needs 2-8 phone screenshots for the default language before the first release');
  } else {
    const shotLocales = subdirs(shotsDir);
    let bad = 0;
    let total = 0;
    for (const locale of shotLocales) {
      const dir = path.join(shotsDir, locale);
      const images = readdirSync(dir).filter((n) => IMAGE_EXT.test(n) && isFile(path.join(dir, n))).sort();
      if (images.length < SCREENSHOTS.min || images.length > SCREENSHOTS.max) {
        add('fail', `screenshots ${locale}`, `${images.length} images, Play takes ${SCREENSHOTS.min}-${SCREENSHOTS.max} per device type`);
        bad++;
      }
      for (const name of images) {
        const info = readImageInfo(readFileSync(path.join(dir, name)));
        const short = info ? Math.min(info.width, info.height) : 0;
        const long = info ? Math.max(info.width, info.height) : 0;
        const ok = info && short >= SCREENSHOTS.minSide && long <= SCREENSHOTS.maxSide && long <= SCREENSHOTS.maxRatio * short && !info.hasAlpha && !info.indexed && (info.format === 'jpeg' || info.bitDepth === 8);
        if (!ok) {
          add('fail', `screenshots ${locale}/${name}`, `${describe(info)} - Play wants JPEG or 24-bit PNG without alpha, each side ${SCREENSHOTS.minSide}-${SCREENSHOTS.maxSide} px, the longer side at most ${SCREENSHOTS.maxRatio}x the shorter`);
          bad++;
        }
        total++;
      }
    }
    if (!shotLocales.includes(DEFAULT_LOCALE)) {
      add('fail', 'screenshots', `play/screenshots/${DEFAULT_LOCALE}/ is missing - the default language must have phone screenshots`);
      bad++;
    }
    const without = listingLocales.filter((l) => !shotLocales.includes(l));
    if (without.length) add('warn', 'screenshots', `no screenshots for ${without.length} listing locale(s) (Play shows the ${DEFAULT_LOCALE} ones there): ${without.join(' ')}`);
    if (!bad) add('pass', 'screenshots', `${total} images in ${shotLocales.length} locale folder(s), all within Play's rules`);
  }

  // --- Legal pages built into dist/ -----------------------------------------------------------------
  for (const page of LEGAL_PAGES) {
    const dir = at('dist', page);
    const index = path.join(dir, 'index.html');
    if (!isFile(index)) {
      add('fail', `legal dist/${page}`, `dist/${page}/index.html is missing - PLAY-LEGAL ships public/${page}/ and "npx vite build" copies it into dist/ (the hosted server serves it)`);
      continue;
    }
    const localePages = subdirs(dir).filter((d) => isFile(path.join(dir, d, 'index.html')));
    if (localePages.length < EXPECTED_LOCALES) add('warn', `legal dist/${page}`, `${localePages.length} locale pages, the app has ${EXPECTED_LOCALES} languages`);
    else add('pass', `legal dist/${page}`, `index.html and ${localePages.length} locale pages`);
    const unfilled = [index, ...localePages.map((d) => path.join(dir, d, 'index.html'))].filter((p) => PLACEHOLDER.test(readText(p))).map((p) => path.relative(root, p).split(path.sep).join('/'));
    if (unfilled.length) add('fail', `legal dist/${page}`, `{{PLACEHOLDER}} still in ${unfilled.length} page(s) - the owner fills the publisher name and contact in the one settings place, then rebuilds: ${unfilled.slice(0, 5).join(', ')}${unfilled.length > 5 ? ', ...' : ''}`);
  }

  // --- Policy answer files ------------------------------------------------------------------------
  const missingPolicy = POLICY_FILES.filter((f) => !isFile(at('play', 'policy', f)));
  if (missingPolicy.length) add('warn', 'policy answers', `play/policy/ lacks ${missingPolicy.join(', ')} - the Play Console declarations are copied from these files (PLAY-LEGAL)`);
  else add('pass', 'policy answers', `play/policy/${POLICY_FILES.join(', ')} present`);

  // --- applicationId ------------------------------------------------------------------------------
  const gradlePath = at('android', 'app', 'build.gradle');
  if (!isFile(gradlePath)) {
    add('fail', 'applicationId', 'android/app/build.gradle is missing');
  } else {
    const gradle = readText(gradlePath);
    const declared = /def\s+appId\s*=\s*'([^']+)'/.exec(gradle)?.[1];
    const applied = /\bapplicationId\s+appId\b/.test(gradle);
    if (!declared) add('fail', 'applicationId', "android/app/build.gradle has no `def appId = '...'` line");
    else if (declared !== APP_ID) add('fail', 'applicationId', `android/app/build.gradle declares '${declared}', the Play identity is ${APP_ID}${declared === LEGACY_APP_ID ? ` (${LEGACY_APP_ID} is taken on Play by another developer and stays only the Java namespace)` : ''}`);
    else if (!applied) add('fail', 'applicationId', 'android/app/build.gradle does not apply `applicationId appId` in defaultConfig');
    else add('pass', 'applicationId', `${APP_ID} in android/app/build.gradle (permanent after the first upload)`);
  }
  const capPath = at('capacitor.config.ts');
  if (isFile(capPath)) {
    const capId = /\bappId:\s*'([^']+)'/.exec(readText(capPath))?.[1];
    if (capId !== APP_ID) add('fail', 'applicationId', `capacitor.config.ts appId is '${capId ?? '(none)'}', expected ${APP_ID}`);
    else add('pass', 'applicationId', `${APP_ID} in capacitor.config.ts`);
  } else {
    add('warn', 'applicationId', 'capacitor.config.ts not found - cannot cross-check appId');
  }

  // --- versionCode --------------------------------------------------------------------------------
  const versionPath = at('android', 'app', 'version.properties');
  const versionMatch = isFile(versionPath) ? /^versionCode=(\d+)\s*$/m.exec(readText(versionPath)) : null;
  const versionCode = versionMatch ? Number.parseInt(versionMatch[1], 10) : null;
  if (versionCode === null) {
    add('fail', 'versionCode', 'android/app/version.properties has no "versionCode=<n>" line');
  } else if (versionCode <= 0 || versionCode > MAX_VERSION_CODE) {
    add('fail', 'versionCode', `${versionCode} is outside 1..${MAX_VERSION_CODE} (Play's limits)`);
  } else {
    const lastPath = at('play', 'last-upload.json');
    let lastCode = 0;
    let lastOk = true;
    if (!isFile(lastPath)) {
      add('warn', 'versionCode', 'play/last-upload.json is missing - treated as "nothing uploaded yet". After every successful upload the owner records {"versionCode": <the code Play accepted>, "versionName": "...", "uploadedAt": "YYYY-MM-DD", "track": "closed-testing" | "production"} there');
    } else {
      try {
        lastCode = readLastUploadVersionCode(readText(lastPath));
      } catch (error) {
        lastOk = false;
        add('fail', 'versionCode', `play/last-upload.json is unreadable (${error.message}) - it must be {"versionCode": <integer>, ...}`);
      }
    }
    if (lastOk) {
      if (versionCode > lastCode) add('pass', 'versionCode', `${versionCode} (android/app/version.properties) is higher than the last upload recorded in play/last-upload.json (${lastCode})`);
      else add('fail', 'versionCode', `${versionCode} is not higher than the last upload recorded in play/last-upload.json (${lastCode}) - Play rejects a reused or lower versionCode; run "node scripts/android/bump-version.mjs" (or build with "npm run android:aab -- -Bump")`);
    }
  }

  // --- Signing (key names only) -------------------------------------------------------------------
  if (!isFile(signingFile)) {
    add('fail', 'signing', `${signingFile} is missing - the OWNER creates the upload key once with scripts/android/create-upload-key.ps1 (or points DIARY_ANDROID_SIGNING at the file); without it the bundle is unsigned and Play rejects it`);
  } else {
    const present = new Set();
    let storeFile = null;
    for (const raw of readText(signingFile).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith('!')) continue;
      const idx = line.search(/[=:]/);
      if (idx < 1) continue;
      const name = line.slice(0, idx).trim();
      const hasValue = line.slice(idx + 1).trim().length > 0;
      if (hasValue) present.add(name);
      if (name === 'storeFile' && hasValue) storeFile = line.slice(idx + 1).trim();
    }
    const missing = SIGNING_KEYS.filter((k) => !present.has(k));
    if (missing.length) {
      add('fail', 'signing', `${signingFile} lacks a value for ${missing.join(', ')} (android/app/build.gradle needs all of ${SIGNING_KEYS.join(', ')})`);
    } else {
      const keystore = path.isAbsolute(storeFile) ? storeFile : path.join(path.dirname(signingFile), storeFile);
      if (!existsSync(keystore)) add('fail', 'signing', `${signingFile} names the keystore ${keystore}, which does not exist`);
      else add('pass', 'signing', `${signingFile}: ${SIGNING_KEYS.join(', ')} present; keystore ${path.basename(keystore)} exists (passwords never printed)`);
    }
  }

  const failures = results.filter((r) => r.level === 'fail').length;
  const warnings = results.filter((r) => r.level === 'warn').length;
  return { results, failures, warnings, ok: failures === 0 };
}

function main() {
  const args = process.argv.slice(2);
  const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const root = option('root') ? path.resolve(option('root')) : PROJECT_ROOT;
  const signing = option('signing');
  const report = runPreflight({ root, ...(signing ? { signingFile: path.resolve(signing) } : {}) });
  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Google Play pre-flight of ${root}`);
    const tag = { pass: '[PASS]', warn: '[WARN]', fail: '[FAIL]' };
    for (const r of report.results) console.log(`${tag[r.level]} ${r.check}: ${r.detail}`);
    console.log('');
    console.log(report.ok ? `Pre-flight passed: ${report.results.length - report.warnings} checks OK, ${report.warnings} warning(s) for the owner to judge.` : `Pre-flight FAILED: ${report.failures} check(s) must be fixed before uploading (${report.warnings} warning(s)).`);
  }
  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
