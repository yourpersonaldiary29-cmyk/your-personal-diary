#!/usr/bin/env node
/**
 * scripts/play/check-screenshots.mjs - checks the Google Play phone screenshots in play/screenshots/
 * (made by scripts/play/render-screenshots.mjs) before they are uploaded. Plain Node, no dependencies.
 *
 *   node scripts/play/check-screenshots.mjs                 the project's play/screenshots (exit code 1 on a FAIL)
 *   node scripts/play/check-screenshots.mjs --dir <dir>     another folder (the fixtures of check-screenshots.test.mjs)
 *   node scripts/play/check-screenshots.mjs --json          the result as JSON
 *
 * Rules, with their source:
 *   Play Console Help "Add preview assets to showcase your app"
 *   (support.google.com/googleplay/android-developer/answer/9866151), phone screenshots:
 *     - "You must provide a minimum of 2 screenshots ... You can upload up to 8 screenshots" per device
 *       type and language                                                   -> 2-8 images per folder;
 *     - "JPEG or 24-bit PNG (no alpha)"                                     -> PNG colour type 2 (RGB),
 *       8 bits per channel, no tRNS chunk; or a baseline / progressive JPEG;
 *     - "Minimum dimension: 320 px", "Maximum dimension: 3840 px"           -> each side 320-3840 px;
 *     - "The maximum dimension of your screenshot can't be more than twice as long as the minimum
 *       dimension"                                                          -> long side <= 2 x short side;
 *     - the task asks for 16:9 or 9:16 (the shape Play recommends for promotion-eligible screenshots,
 *       at least 1080 px)                                                   -> exactly 9:16 or 16:9,
 *       WARN when the short side is under 1080 px.
 *   File size: at most 8 MB per image (the Play Console's upload limit for a screenshot) and at least
 *   10 KB (a 1080x1920 capture of a real screen is never smaller; an empty or broken file is).
 *   The project's own rules (docs/play-tasks/PLAY-SCREENSHOTS.md and its amendment):
 *     - one set per listing language, each folder named exactly like its play/listing/<code> folder
 *       (the Play Console codes - Hebrew is "iw-IL"); en-US, the default set, must be there; a listing
 *       language without a set is a FAIL (all 20 are part of the package);
 *     - file names NN-name.png, numbered 01, 02, ... without gaps (the upload order);
 *     - every image decodes completely (CRC of every chunk, the whole pixel stream) and is not blank;
 *     - render-log.json (written by the render) has an entry for every set whose files match the files
 *       on disk (size and SHA-256 - a file that did not come from the render fails) and whose transport
 *       log names no host but 127.0.0.1 and no refused request: the render never contacted anything else;
 *       and the entry says "layout": "clean" - every shot of the set passed the render's layout rules (no
 *       cut, covered or broken text; render-screenshots.mjs layoutProbe), which an older render did not check.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const DEFAULT_DIR = path.join(ROOT, 'play', 'screenshots');
export const DEFAULT_LISTING_DIR = path.join(ROOT, 'play', 'listing');
export const DEFAULT_LOCALE = 'en-US';
export const RENDER_LOG = 'render-log.json';

export const RULES = {
  minImages: 2,
  maxImages: 8,
  minSide: 320,
  maxSide: 3840,
  maxRatio: 2,
  promotionMinSide: 1080,
  minBytes: 10 * 1024,
  maxBytes: 8 * 1024 * 1024,
};

const NAME = /^(\d\d)-[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|jpe?g)$/;
const IMAGE = /\.(?:png|jpe?g)$/i;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// ---------------------------------------------------------------------------------------------
// Image reading
// ---------------------------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Reads a PNG completely: every chunk and its CRC, IHDR, tRNS / PLTE, and the pixel stream (inflated
 * and unfiltered for 8-bit RGB). Returns { format, width, height, bitDepth, colorType, alpha, problems,
 * distinctColours } - `problems` lists what is broken.
 */
export function readPng(buf) {
  const problems = [];
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return { format: null, problems: ['not a PNG file'] };
  let p = 8;
  let ihdr = null;
  let trns = false;
  let iend = false;
  const idat = [];
  while (p + 12 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    if (!/^[A-Za-z]{4}$/.test(type)) {
      problems.push(`no valid chunk at byte ${p} (the file is damaged)`);
      break;
    }
    if (p + 12 + len > buf.length) {
      problems.push(`chunk ${type} runs past the end of the file`);
      break;
    }
    const data = buf.subarray(p + 8, p + 8 + len);
    if (crc32(buf.subarray(p + 4, p + 8 + len)) !== buf.readUInt32BE(p + 8 + len)) problems.push(`chunk ${type}: CRC mismatch`);
    if (type === 'IHDR') ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9], interlace: data[12] };
    else if (type === 'tRNS') trns = true;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') {
      iend = true;
      break;
    }
    p += 12 + len;
  }
  if (!ihdr) return { format: 'png', problems: [...problems, 'no IHDR chunk'] };
  if (!iend) problems.push('no IEND chunk (the file is cut off)');
  const info = { format: 'png', width: ihdr.width, height: ihdr.height, bitDepth: ihdr.bitDepth, colorType: ihdr.colorType, alpha: ihdr.colorType === 4 || ihdr.colorType === 6 || trns, problems, distinctColours: null };
  if (ihdr.colorType === 2 && ihdr.bitDepth === 8 && ihdr.interlace === 0 && idat.length) {
    let raw;
    try {
      raw = zlib.inflateSync(Buffer.concat(idat));
    } catch (e) {
      problems.push(`the pixel data does not inflate: ${e.message}`);
      return info;
    }
    const stride = ihdr.width * 3;
    if (raw.length !== ihdr.height * (stride + 1)) {
      problems.push(`the pixel data has ${raw.length} bytes, ${ihdr.height * (stride + 1)} expected`);
      return info;
    }
    info.distinctColours = countColours(raw, ihdr.width, ihdr.height);
    if (info.distinctColours === -1) problems.push('unknown PNG filter type in the pixel data');
  }
  return info;
}

/** Unfilters 8-bit RGB scanlines and counts distinct colours (stops counting at 64). -1 for a bad filter byte. */
function countColours(raw, width, height) {
  const stride = width * 3;
  const prev = Buffer.alloc(stride);
  const line = Buffer.alloc(stride);
  const seen = new Set();
  for (let y = 0; y < height; y += 1) {
    const o = y * (stride + 1);
    const filter = raw[o];
    for (let x = 0; x < stride; x += 1) {
      const v = raw[o + 1 + x];
      const a = x >= 3 ? line[x - 3] : 0;
      const b = prev[x];
      const c = x >= 3 ? prev[x - 3] : 0;
      let out;
      if (filter === 0) out = v;
      else if (filter === 1) out = v + a;
      else if (filter === 2) out = v + b;
      else if (filter === 3) out = v + ((a + b) >> 1);
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        out = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else return -1;
      line[x] = out & 0xff;
    }
    if (seen.size < 64 && y % 8 === 0) for (let x = 0; x < stride; x += 3 * 8) seen.add((line[x] << 16) | (line[x + 1] << 8) | line[x + 2]);
    line.copy(prev);
  }
  return seen.size;
}

/** Width, height and precision of a JPEG (the first SOF marker), or null. */
export function readJpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { format: 'jpeg', width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), bitDepth: buf[i + 4], colorType: null, alpha: false, problems: [], distinctColours: null };
    }
    i += 2 + length;
  }
  return null;
}

/** The problems of one image against RULES (empty when it is fine) and the warnings. */
export function imageProblems(buf) {
  const problems = [];
  const warnings = [];
  const info = buf[0] === 0x89 ? readPng(buf) : readJpeg(buf);
  if (!info || !info.format) return { info: null, problems: ['not a PNG or JPEG file'], warnings };
  for (const p of info.problems ?? []) problems.push(p);
  if (info.width === undefined) return { info, problems, warnings };
  if (info.format === 'png') {
    if (info.colorType !== 2 || info.bitDepth !== 8) problems.push(`PNG colour type ${info.colorType}, ${info.bitDepth} bit - Play wants a 24-bit PNG (RGB, 8 bits per channel)`);
    if (info.alpha) problems.push('has an alpha channel / transparency - Play wants "no alpha"');
  }
  const short = Math.min(info.width, info.height);
  const long = Math.max(info.width, info.height);
  if (short < RULES.minSide || long > RULES.maxSide) problems.push(`${info.width}x${info.height}: each side must be ${RULES.minSide}-${RULES.maxSide} px`);
  if (long > RULES.maxRatio * short) problems.push(`${info.width}x${info.height}: the long side is more than twice the short side`);
  if (long * 9 !== short * 16) problems.push(`${info.width}x${info.height} is not 9:16 / 16:9`);
  if (short < RULES.promotionMinSide) warnings.push(`${info.width}x${info.height}: under ${RULES.promotionMinSide} px on the short side (not eligible for Play promotion)`);
  if (info.distinctColours !== null && info.distinctColours < 4) problems.push('looks blank (fewer than 4 colours)');
  if (buf.length < RULES.minBytes) problems.push(`${buf.length} bytes - too small for a real screenshot`);
  if (buf.length > RULES.maxBytes) problems.push(`${(buf.length / 1048576).toFixed(1)} MB - over the 8 MB upload limit`);
  return { info, problems, warnings };
}

// ---------------------------------------------------------------------------------------------
// The folder
// ---------------------------------------------------------------------------------------------

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

/** The listing languages: the folders of play/listing (null when there is none - fixtures). */
function listingLocales(listingDir) {
  if (!listingDir || !isDir(listingDir)) return null;
  return readdirSync(listingDir).filter((n) => isDir(path.join(listingDir, n))).sort();
}

/**
 * Checks `dir`. `listingDir`: the play/listing folder whose language folders every set must match (by
 * default the project's; pass null to skip). Returns { sets: [{ locale, files: [{ name, bytes, width,
 * height, problems }] }], problems, warnings, ok }.
 */
export function checkScreenshots(dir = DEFAULT_DIR, { listingDir = DEFAULT_LISTING_DIR } = {}) {
  const problems = [];
  const warnings = [];
  const sets = [];
  if (!isDir(dir)) return { sets, problems: [`${dir} does not exist - run node scripts/play/render-screenshots.mjs`], warnings, ok: false };
  const listing = listingLocales(listingDir);
  const folders = readdirSync(dir).filter((n) => isDir(path.join(dir, n))).sort();
  let log = null;
  try {
    log = JSON.parse(readFileSync(path.join(dir, RENDER_LOG), 'utf8'));
  } catch (e) {
    problems.push(`${RENDER_LOG}: missing or unreadable (${e.code ?? e.message}) - the transport log of the render is part of the package`);
  }
  if (!folders.includes(DEFAULT_LOCALE)) problems.push(`${DEFAULT_LOCALE}/ is missing - the default set (Play shows it for every language without a set)`);
  if (listing) {
    for (const locale of listing) if (!folders.includes(locale)) problems.push(`${locale}/ is missing - play/listing/${locale} has no screenshot set`);
    for (const locale of folders) if (!listing.includes(locale)) problems.push(`${locale}/ is not a listing language (play/listing has no ${locale} folder - Play locale codes, Hebrew is iw-IL)`);
  }
  for (const locale of folders) {
    const folder = path.join(dir, locale);
    const names = readdirSync(folder).sort();
    const images = names.filter((n) => IMAGE.test(n));
    for (const n of names) if (!IMAGE.test(n)) warnings.push(`${locale}/${n}: not an image - it is not uploaded, remove it`);
    const set = { locale, files: [] };
    sets.push(set);
    if (images.length < RULES.minImages || images.length > RULES.maxImages) {
      problems.push(`${locale}: ${images.length} images - Play takes ${RULES.minImages}-${RULES.maxImages} phone screenshots per language`);
    }
    images.forEach((name, index) => {
      const file = path.join(folder, name);
      const buf = readFileSync(file);
      const { info, problems: own, warnings: warn } = imageProblems(buf);
      const m = NAME.exec(name);
      if (!m) own.push('name is not NN-name.png');
      else if (Number(m[1]) !== index + 1) own.push(`numbered ${m[1]}, ${String(index + 1).padStart(2, '0')} expected (01, 02, ... without gaps)`);
      const logged = log?.sets?.[locale]?.files?.[name];
      if (log && !logged) own.push(`not in ${RENDER_LOG} - not made by the render`);
      else if (logged && (logged.bytes !== buf.length || logged.sha256 !== createHash('sha256').update(buf).digest('hex'))) own.push(`differs from the file the render wrote (${RENDER_LOG})`);
      set.files.push({ name, bytes: buf.length, width: info?.width ?? null, height: info?.height ?? null, problems: own });
      for (const p of own) problems.push(`${locale}/${name}: ${p}`);
      for (const w of warn) warnings.push(`${locale}/${name}: ${w}`);
    });
    if (log) {
      const entry = log.sets?.[locale];
      if (!entry) problems.push(`${locale}: no entry in ${RENDER_LOG}`);
      else {
        const hosts = entry.transport?.hosts;
        if (!Array.isArray(hosts) || hosts.some((h) => h !== '127.0.0.1')) problems.push(`${locale}: the transport log names ${JSON.stringify(hosts)} - the render may contact 127.0.0.1 only`);
        if (entry.transport?.refused !== 0) problems.push(`${locale}: the transport log has refused requests (${entry.transport?.refused})`);
        if (!(entry.transport?.requests > 0)) problems.push(`${locale}: the transport log is empty`);
        if (entry.layout !== 'clean') problems.push(`${locale}: ${RENDER_LOG} does not record the layout check ("layout": "clean") - render the set again with the current render script`);
      }
    }
  }
  if (log?.sets) for (const locale of Object.keys(log.sets)) if (!folders.includes(locale)) warnings.push(`${RENDER_LOG} lists ${locale}, which has no folder`);
  return { sets, problems, warnings, ok: problems.length === 0 };
}

export function formatReport(result) {
  const lines = [];
  for (const set of result.sets) {
    const total = set.files.reduce((s, f) => s + f.bytes, 0);
    lines.push(`${set.files.every((f) => !f.problems.length) ? 'ok  ' : 'FAIL'} ${set.locale.padEnd(6)} ${set.files.length} images, ${(total / 1024).toFixed(0)} KB: ${set.files.map((f) => `${f.name} ${f.width}x${f.height} ${(f.bytes / 1024).toFixed(0)} KB`).join(', ')}`);
  }
  for (const w of result.warnings) lines.push(`WARN ${w}`);
  for (const p of result.problems) lines.push(`FAIL ${p}`);
  const images = result.sets.reduce((s, set) => s + set.files.length, 0);
  lines.push(
    result.ok
      ? `check-screenshots: ${result.sets.length} locales, ${images} images, all within Play's rules (2-8 per language, 24-bit PNG / JPEG without alpha, 9:16, 320-3840 px, <= 8 MB), transport log 127.0.0.1 only`
      : `check-screenshots: ${result.problems.length} problem(s)`,
  );
  return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--dir');
  const dir = i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : DEFAULT_DIR;
  const j = args.indexOf('--listing');
  const listingDir = j >= 0 && args[j + 1] ? path.resolve(args[j + 1]) : i >= 0 ? null : DEFAULT_LISTING_DIR;
  const result = checkScreenshots(dir, { listingDir });
  console.log(args.includes('--json') ? JSON.stringify(result, null, 2) : formatReport(result));
  process.exit(result.ok ? 0 : 1);
}
