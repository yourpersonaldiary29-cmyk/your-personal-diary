#!/usr/bin/env node
/**
 * scripts/store-shots/check-screenshots.mjs - checks the Microsoft Store desktop screenshots in
 * store/screenshots/<tag>/ (made by `node scripts/play/render-screenshots.mjs --profile desktop`) and their
 * captions (store/screenshots/captions.json) before they are uploaded in Partner Center. Plain Node.
 *
 *   node scripts/store-shots/check-screenshots.mjs              the project's store/screenshots (exit 1 on a FAIL)
 *   node scripts/store-shots/check-screenshots.mjs --dir <dir>  another folder (the fixtures of the tests)
 *   node scripts/store-shots/check-screenshots.mjs --json       the result as JSON
 *
 * Microsoft's rules, quoted from "App screenshots, images, and trailers for MSIX app"
 * (learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images, read
 * 2026-10-27; page updated 2026-08-24):
 *   - "Only one screenshot (for any device family) is required for your submission, though you can provide
 *     several; up to 10 desktop screenshots"                              -> 1-10 images per language (FAIL);
 *   - FAQ: "Microsoft recommends including 5–8 high-quality screenshots"  -> WARN outside 5-8;
 *   - "Each screenshot must be a .png file in either landscape or portrait orientation, and the file size
 *     can't be larger than 50 MB"                                         -> PNG only, <= 50 MB;
 *   - "Desktop 1366 x 768 pixels or larger. Supports 4K images (3840 x 2160)" -> at least 1366x768
 *     (768x1366 in portrait), at most 3840x2160;
 *   - "You can also provide a short caption that describes each screenshot in 200 characters or less"
 *                                                                         -> captions <= 200 characters;
 *   - "You'll need to upload images for each language separately (even if you are using the same images),
 *     and provide captions to use for each language"                     -> one set + captions per listing language.
 * The project's own rules (docs/store-tasks/STORE-2026-10.md package S2, owner decisions):
 *   - one set per Store listing language (STORE_FOLDERS of render-screenshots.mjs, the 20 tags of
 *     store/listing); en-US, the default listing, must be there; a missing language is a FAIL;
 *   - exactly the desktop shot list (DESKTOP_SHOTS: 01-home.png ... 08-offline.png), numbered without gaps;
 *   - every image 1920x1080, a 24-bit PNG (RGB, 8 bits, no alpha) that decodes completely and is not blank;
 *   - render-log.json (written by the render): the desktop profile, an entry for every set whose files
 *     match the files on disk (size and SHA-256), "layout": "clean" (the render's layout rules: no cut,
 *     covered or broken text) and a transport log with no host but 127.0.0.1 and no refused request;
 *   - a caption for every image in every language, held to the honest-claims rules of the Play listing
 *     (scripts/play/check-listing.mjs textProblems: no "stored only on your device", no end-to-end /
 *     zero-knowledge claims, no "free" / "best" / "#1", no web address, no emoji, written in the language's
 *     script, not the English text);
 *   - nothing else in the folder but README.md, captions.json, render-log.json, logos/ and _obsolete-*.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAY_LOCALES, textProblems } from '../play/check-listing.mjs';
import { readPng } from '../play/check-screenshots.mjs';
import { DESKTOP_SHOTS, RENDER_LOG, STORE_FOLDERS } from '../play/render-screenshots.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const DEFAULT_DIR = path.join(ROOT, 'store', 'screenshots');
export const DEFAULT_LOCALE = 'en-US';
export const CAPTIONS = 'captions.json';

export const RULES = {
  minImages: 1,
  maxImages: 10,
  recommendedMin: 5,
  recommendedMax: 8,
  minLong: 1366,
  minShort: 768,
  maxLong: 3840,
  maxShort: 2160,
  width: 1920,
  height: 1080,
  minBytes: 10 * 1024,
  maxBytes: 50 * 1024 * 1024,
  captionMax: 200,
};

/** The Store listing tags, en-US (the default listing) first. */
export const STORE_TAGS = Object.keys(STORE_FOLDERS);
/** The file names of one set, in upload order. */
export const EXPECTED_FILES = DESKTOP_SHOTS.map((s) => `${s.n}-${s.slug}.png`);

const NAME = /^(\d\d)-[a-z0-9]+(?:-[a-z0-9]+)*\.png$/;
const ALLOWED_EXTRA = new Set(['README.md', CAPTIONS, RENDER_LOG, 'logos']);
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** The Play locale whose app language is that of the Store tag (for the caption rules of check-listing.mjs). */
export function playLocaleOf(tag) {
  const app = STORE_FOLDERS[tag];
  return Object.keys(PLAY_LOCALES).find((code) => PLAY_LOCALES[code].app === app) ?? null;
}

/** The problems of one image against `rules` (empty when it is fine). */
export function imageProblems(buf, rules = RULES) {
  const problems = [];
  const info = readPng(buf);
  if (!info.format) return { info: null, problems: ['not a PNG file - Microsoft: "Each screenshot must be a .png file"'] };
  problems.push(...(info.problems ?? []));
  if (info.width === undefined) return { info, problems };
  if (info.colorType !== 2 || info.bitDepth !== 8) problems.push(`PNG colour type ${info.colorType}, ${info.bitDepth} bit - the set is 24-bit RGB PNG`);
  if (info.alpha) problems.push('has an alpha channel / transparency (a capture of the app window is opaque)');
  const long = Math.max(info.width, info.height);
  const short = Math.min(info.width, info.height);
  if (long < rules.minLong || short < rules.minShort) problems.push(`${info.width}x${info.height}: smaller than Microsoft's ${rules.minLong} x ${rules.minShort} for desktop screenshots`);
  if (long > rules.maxLong || short > rules.maxShort) problems.push(`${info.width}x${info.height}: larger than the ${rules.maxLong} x ${rules.maxShort} (4K) Microsoft supports`);
  if (info.width !== rules.width || info.height !== rules.height) problems.push(`${info.width}x${info.height}: the set is ${rules.width}x${rules.height} (landscape)`);
  if (info.distinctColours !== null && info.distinctColours < 4) problems.push('looks blank (fewer than 4 colours)');
  if (buf.length < rules.minBytes) problems.push(`${buf.length} bytes - too small for a real screenshot`);
  if (buf.length > rules.maxBytes) problems.push(`${(buf.length / 1048576).toFixed(1)} MB - over Microsoft's 50 MB per screenshot`);
  return { info, problems };
}

/** The problems of one caption (empty when it is fine). `english`: the en-US caption of the same file. */
export function captionProblems(tag, caption, english = null, rules = RULES) {
  if (typeof caption !== 'string' || !caption.trim()) return ['no caption'];
  const problems = [];
  const length = Array.from(caption).length;
  if (length > rules.captionMax) problems.push(`is ${length} characters long - Microsoft: "200 characters or less"`);
  if (/[\r\n]/.test(caption)) problems.push('contains a line break');
  const play = playLocaleOf(tag);
  if (!play) return [...problems, `${tag}: no app language for this tag`];
  problems.push(...textProblems(play, 'caption.txt', `${caption}\n`, tag === DEFAULT_LOCALE ? null : english === null ? null : `${english}\n`));
  return problems;
}

function readJson(file, problems, what) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    problems.push(`${what}: ${existsSync(file) ? `not valid JSON (${e.message})` : 'missing'}`);
    return null;
  }
}

/**
 * Checks `dir`. Options (for the fixtures of the tests): `tags` (the listing tags every set must match),
 * `expected` (the file names of a set; null: any NN-name.png numbered without gaps), `rules`.
 * Returns { sets: [{ tag, files: [{ name, bytes, width, height, problems }] }], problems, warnings, ok }.
 */
export function checkScreenshots(dir = DEFAULT_DIR, { tags = STORE_TAGS, expected = EXPECTED_FILES, rules = RULES } = {}) {
  const problems = [];
  const warnings = [];
  const sets = [];
  if (!isDir(dir)) return { sets, problems: [`${dir} does not exist - render the set first (node scripts/play/render-screenshots.mjs --profile desktop)`], warnings, ok: false };

  // The folder itself: one folder per tag, nothing unexpected.
  for (const name of readdirSync(dir).sort()) {
    if (tags.includes(name) || ALLOWED_EXTRA.has(name) || name.startsWith('_obsolete-')) continue;
    problems.push(`${name}: not a Store listing tag (${tags.join(' ')}) nor a known file`);
  }
  if (!tags.includes(DEFAULT_LOCALE)) problems.push(`the tag list has no ${DEFAULT_LOCALE} (the default listing)`);

  const log = readJson(path.join(dir, RENDER_LOG), problems, RENDER_LOG);
  if (log) {
    if (log.profile !== 'desktop') problems.push(`${RENDER_LOG}: profile "${log.profile}", expected "desktop"`);
    if (log.size !== `${rules.width}x${rules.height}`) problems.push(`${RENDER_LOG}: size ${log.size}, expected ${rules.width}x${rules.height}`);
  }
  const captions = readJson(path.join(dir, CAPTIONS), problems, CAPTIONS);
  if (captions) {
    for (const key of Object.keys(captions)) if (!key.startsWith('_') && !tags.includes(key)) problems.push(`${CAPTIONS}: "${key}" is not a Store listing tag`);
  }

  for (const tag of tags) {
    const setDir = path.join(dir, tag);
    if (!isDir(setDir)) {
      problems.push(`${tag}: no screenshot set${tag === DEFAULT_LOCALE ? ' (the default listing - required)' : ' (every listing language gets its own set)'}`);
      continue;
    }
    const names = readdirSync(setDir).sort();
    const set = { tag, files: [] };
    sets.push(set);
    for (const name of names.filter((n) => !NAME.test(n))) problems.push(`${tag}/${name}: not an NN-name.png screenshot (Microsoft takes .png only)`);
    const images = names.filter((n) => NAME.test(n));
    if (images.length < rules.minImages || images.length > rules.maxImages) problems.push(`${tag}: ${images.length} screenshots - Microsoft: at least ${rules.minImages}, "up to ${rules.maxImages} desktop screenshots"`);
    else if (images.length < rules.recommendedMin || images.length > rules.recommendedMax) warnings.push(`${tag}: ${images.length} screenshots - Microsoft recommends ${rules.recommendedMin}-${rules.recommendedMax}`);
    images.forEach((name, i) => {
      const want = String(i + 1).padStart(2, '0');
      if (name.slice(0, 2) !== want) problems.push(`${tag}/${name}: numbered ${name.slice(0, 2)}, expected ${want} (01, 02, ... without gaps - the upload order)`);
    });
    if (expected) {
      const missing = expected.filter((n) => !images.includes(n));
      const extra = images.filter((n) => !expected.includes(n));
      if (missing.length) problems.push(`${tag}: missing ${missing.join(', ')}`);
      if (extra.length) problems.push(`${tag}: not in the desktop shot list: ${extra.join(', ')}`);
    }
    const logSet = log?.sets?.[tag];
    if (log && !logSet) problems.push(`${tag}: not in ${RENDER_LOG} - render it (node scripts/play/render-screenshots.mjs --profile desktop --locale ${tag})`);
    if (logSet) {
      if (logSet.layout !== 'clean') problems.push(`${tag}: ${RENDER_LOG} has no "layout": "clean" (rendered without the layout rules)`);
      const hosts = logSet.transport?.hosts ?? [];
      if (!logSet.transport || hosts.some((h) => h !== '127.0.0.1') || logSet.transport.refused !== 0) problems.push(`${tag}: ${RENDER_LOG} transport log is not 127.0.0.1 only (${JSON.stringify(logSet.transport ?? null)})`);
      for (const name of Object.keys(logSet.files ?? {})) if (!images.includes(name)) problems.push(`${tag}/${name}: in ${RENDER_LOG} but not on disk`);
      if (STORE_FOLDERS[tag] && logSet.appLocale !== STORE_FOLDERS[tag]) problems.push(`${tag}: ${RENDER_LOG} says app language "${logSet.appLocale}", expected "${STORE_FOLDERS[tag]}"`);
    }
    for (const name of images) {
      const buf = readFileSync(path.join(setDir, name));
      const { info, problems: own } = imageProblems(buf, rules);
      const entry = logSet?.files?.[name];
      if (logSet && !entry) own.push(`not in ${RENDER_LOG} (not written by the render)`);
      if (entry && (entry.bytes !== buf.length || entry.sha256 !== sha256(buf))) own.push(`differs from the file the render wrote (${RENDER_LOG}: ${entry.bytes} bytes, sha256 ${String(entry.sha256).slice(0, 12)}...)`);
      const caption = captions?.[tag]?.[name];
      if (captions) for (const p of captionProblems(tag, caption, captions?.[DEFAULT_LOCALE]?.[name] ?? null, rules)) own.push(`caption ${p}`);
      for (const p of own) problems.push(`${tag}/${name}: ${p}`);
      set.files.push({ name, bytes: buf.length, width: info?.width ?? null, height: info?.height ?? null, caption: typeof caption === 'string' ? Array.from(caption).length : null, problems: own });
    }
    if (captions?.[tag]) for (const name of Object.keys(captions[tag])) if (!images.includes(name)) problems.push(`${CAPTIONS}: ${tag}/${name} has a caption but no screenshot`);
  }
  return { sets, problems, warnings, ok: problems.length === 0 };
}

export function formatReport(result) {
  const lines = [];
  for (const set of result.sets) {
    const total = set.files.reduce((s, f) => s + f.bytes, 0);
    lines.push(
      `${set.files.every((f) => !f.problems.length) ? 'ok  ' : 'FAIL'} ${set.tag.padEnd(6)} ${set.files.length} images, ${(total / 1024).toFixed(0)} KB: ${set.files.map((f) => `${f.name} ${f.width}x${f.height} ${(f.bytes / 1024).toFixed(0)} KB, caption ${f.caption ?? '-'} ch`).join('; ')}`,
    );
  }
  for (const w of result.warnings) lines.push(`WARN ${w}`);
  for (const p of result.problems) lines.push(`FAIL ${p}`);
  const images = result.sets.reduce((s, set) => s + set.files.length, 0);
  lines.push(
    result.ok
      ? `check-screenshots (Microsoft Store): ${result.sets.length} listing languages, ${images} images - PNG ${RULES.width}x${RULES.height}, 1-10 per language (Microsoft: up to 10, at least 1366 x 768, <= 50 MB), captions <= ${RULES.captionMax} characters, render log 127.0.0.1 only`
      : `check-screenshots (Microsoft Store): ${result.problems.length} problem(s)`,
  );
  return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--dir');
  const dir = i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : DEFAULT_DIR;
  const result = checkScreenshots(dir);
  console.log(args.includes('--json') ? JSON.stringify(result, null, 2) : formatReport(result));
  process.exit(result.ok ? 0 : 1);
}
