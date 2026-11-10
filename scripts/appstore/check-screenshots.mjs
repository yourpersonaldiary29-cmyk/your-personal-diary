#!/usr/bin/env node
/**
 * scripts/appstore/check-screenshots.mjs - checks the App Store screenshot sets in appstore/screenshots/
 * (made by `node scripts/play/render-screenshots.mjs --profile iphone-medium | iphone-large | mac`) and the
 * App Store icon appstore/icon/AppIcon-1024.png before they go into App Store Connect / the Xcode project.
 * Plain Node, no dependencies.
 *
 *   node scripts/appstore/check-screenshots.mjs                 the project's appstore/screenshots (exit 1 on a FAIL)
 *   node scripts/appstore/check-screenshots.mjs --set mac       only these set folders (iphone-6.3, iphone-6.9, mac)
 *   node scripts/appstore/check-screenshots.mjs --dir <dir>     another root folder (the fixtures of the tests);
 *                                                               with --locales <file> another locales.json and
 *                                                               with --icon <file> another icon (default: none)
 *   node scripts/appstore/check-screenshots.mjs --json          the result as JSON
 *
 * Apple's rules, quoted in docs/apple-tasks/APPSTORE-FACTS.md section 6 (screenshot specifications, read
 * 2026-11-08) and section 7 (app icon):
 *   - "You must include at least one screenshot and can upload up to 10 screenshots per device size in .jpeg,
 *     .jpg, or .png formats"                                                -> 1-10 images per set and language;
 *   - "Images can't include alpha channels or transparencies"              -> PNG colour type 2 (24-bit RGB, no
 *     tRNS chunk); colour type 6 (RGBA) only when every pixel is opaque, with a WARN (the render writes RGB);
 *   - iPhone with Dynamic Island (medium display), the one iPhone class Apple requires: portrait 1179 x 2556
 *     or 1206 x 2622; iPhone with Dynamic Island (large display): 1260 x 2736, 1290 x 2796 or 1320 x 2868;
 *     Mac: 1280 x 800, 1440 x 900, 2560 x 1600 or 2880 x 1800 (16:10)     -> each set's exact size (SETS,
 *     from the render profiles) must be one of Apple's sizes for its class;
 *   - the icon: "1024x1024 px", square (the system masks the corners), PNG preferred, opaque (reading of
 *     section 7)                                                            -> 1024 x 1024, colour type 2, no tRNS.
 * The project's own rules (docs/apple-tasks/SHOTS.md):
 *   - three sets: appstore/screenshots/iphone-6.3 (profile iphone-medium), iphone-6.9 (iphone-large) and mac
 *     (mac) - their folder names, sizes and shot lists come from PROFILES / SHOTS / DESKTOP_SHOTS of
 *     scripts/play/render-screenshots.mjs, so the checker cannot drift from the renderer;
 *   - in every set one folder per App Store localization of appstore/locales.json (19 Apple locale shortcodes;
 *     Bulgarian has none), en-US (the primary language) included; a listed localization without a folder and a
 *     folder that is not listed are both FAILs;
 *   - exactly the shot list's files (01-home.png ... 07-offline.png on the iPhone, 01-home.png ... 08-offline.png
 *     on the Mac), nothing else in a folder; every image decodes completely and is not blank; 10 KB - 8 MB;
 *   - the same file in two localizations must not be identical (SHA-256): identical images mean the language
 *     did not apply;
 *   - render-log.json of the set (written by the render): the set's profile and size, an entry per localization
 *     whose files match the files on disk (size and SHA-256), "layout": "clean" (the render's layout rules: no
 *     cut, covered or broken text), the right app language, and a transport log naming no host but 127.0.0.1
 *     with no refused request;
 *   - nothing else in appstore/screenshots but the three sets, README.md and README.he.md.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPng } from '../play/check-screenshots.mjs';
import { decodePng } from '../play/render-graphics.mjs';
import { APPSTORE_LOCALES_FILE, APPSTORE_OUT_DIR, appStoreFolders, PROFILES, RENDER_LOG, SHOTS } from '../play/render-screenshots.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const DEFAULT_DIR = APPSTORE_OUT_DIR;
export const DEFAULT_LOCALES_FILE = APPSTORE_LOCALES_FILE;
export const DEFAULT_ICON = path.join(ROOT, 'appstore', 'icon', 'AppIcon-1024.png');
export const PRIMARY_LOCALE = 'en-US';

export const RULES = {
  minImages: 1,
  maxImages: 10,
  minBytes: 10 * 1024,
  maxBytes: 8 * 1024 * 1024,
};

/** The icon Apple takes from the build's asset catalog (APPSTORE-FACTS 7.1-7.2). */
export const ICON_RULES = { width: 1024, height: 1024 };

/**
 * Apple's screenshot classes per set folder (APPSTORE-FACTS 6.2 and 6.5, verbatim sizes): the App Store Connect
 * upload slot the folder goes to, the class name of Apple's specification page, and the accepted pixel sizes
 * (portrait for the iPhone).
 */
export const APPLE_CLASSES = {
  'iphone-6.3': {
    slot: 'iPhone 6.3" Display',
    className: 'iPhone with Dynamic Island (medium display)',
    required: true,
    accepted: [[1179, 2556], [1206, 2622]],
  },
  'iphone-6.9': {
    slot: 'iPhone 6.9" Display',
    className: 'iPhone with Dynamic Island (large display)',
    required: false,
    accepted: [[1260, 2736], [1290, 2796], [1320, 2868]],
  },
  mac: {
    slot: 'Mac',
    className: 'Mac',
    required: true,
    accepted: [[1280, 800], [1440, 900], [2560, 1600], [2880, 1800]],
  },
};

/** The render profiles that make the App Store sets, in upload order. */
export const SET_PROFILES = ['iphone-medium', 'iphone-large', 'mac'];

/**
 * The three sets, from the render profiles: { profile, folder, width, height, files, slot, className, required,
 * accepted }. `folder` is the last part of the profile's output folder; `files` the shot list's file names in
 * upload order (the phone's SHOTS unless the profile has its own).
 */
export const SETS = SET_PROFILES.map((profile) => {
  const p = PROFILES[profile];
  if (!p) throw new Error(`render-screenshots.mjs has no profile "${profile}"`);
  const folder = path.basename(p.outDir);
  const apple = APPLE_CLASSES[folder];
  if (!apple) throw new Error(`no Apple screenshot class for the set folder "${folder}" (profile ${profile})`);
  return {
    profile,
    folder,
    width: p.viewport.width * p.deviceScaleFactor,
    height: p.viewport.height * p.deviceScaleFactor,
    files: (p.shots ?? SHOTS).map((s) => `${s.n}-${s.slug}.png`),
    ...apple,
  };
});

const NAME = /^(\d\d)-[a-z0-9]+(?:-[a-z0-9]+)*\.png$/;
const ALLOWED_ROOT_EXTRA = new Set(['README.md', 'README.he.md']);
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

/** True when every pixel of an 8-bit RGBA PNG is opaque (decodes the whole image). */
export function fullyOpaque(buf) {
  try {
    const img = decodePng(buf);
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 255) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * The problems and warnings of one screenshot against its set: a complete, opaque PNG of exactly the set's size
 * (one of Apple's sizes for the class), not blank, 10 KB - 8 MB.
 */
export function imageProblems(buf, set, rules = RULES) {
  const problems = [];
  const warnings = [];
  const info = readPng(buf);
  if (!info.format) return { info: null, problems: ['not a PNG file (the sets are PNG; Apple takes .png, .jpg and .jpeg)'], warnings };
  problems.push(...(info.problems ?? []));
  if (info.width === undefined) return { info, problems, warnings };
  if (info.bitDepth !== 8) problems.push(`PNG bit depth ${info.bitDepth} - the sets are 8 bits per channel`);
  if (info.colorType === 2) {
    if (info.alpha) problems.push('has a tRNS (transparency) chunk - Apple: "Images can\'t include alpha channels or transparencies"');
  } else if (info.colorType === 6) {
    if (fullyOpaque(buf)) warnings.push('PNG colour type 6 (RGBA) with every pixel opaque - accepted, but the sets are written as 24-bit RGB (colour type 2); render it again');
    else problems.push('has an alpha channel with transparent pixels - Apple: "Images can\'t include alpha channels or transparencies"');
  } else {
    problems.push(`PNG colour type ${info.colorType} - the sets are 24-bit RGB (colour type 2) without alpha`);
  }
  if (info.width !== set.width || info.height !== set.height) problems.push(`${info.width}x${info.height}: the set ${set.folder} is ${set.width}x${set.height} (${set.className})`);
  if (!set.accepted.some(([w, h]) => w === info.width && h === info.height)) problems.push(`${info.width}x${info.height} is not one of Apple's sizes for "${set.className}": ${set.accepted.map(([w, h]) => `${w}x${h}`).join(', ')}`);
  if (info.distinctColours !== null && info.distinctColours < 4) problems.push('looks blank (fewer than 4 colours)');
  if (buf.length < rules.minBytes) problems.push(`${buf.length} bytes - too small for a real screenshot`);
  if (buf.length > rules.maxBytes) problems.push(`${(buf.length / 1048576).toFixed(1)} MB - over the ${rules.maxBytes / 1048576} MB limit`);
  return { info, problems, warnings };
}

/** The problems of the App Store icon file: a complete 1024x1024 PNG, colour type 2, 8 bits, no tRNS, not blank. */
export function iconProblems(buf, rules = ICON_RULES) {
  const info = readPng(buf);
  if (!info.format) return { info: null, problems: ['not a PNG file'] };
  const problems = [...(info.problems ?? [])];
  if (info.width === undefined) return { info, problems };
  if (info.width !== rules.width || info.height !== rules.height) problems.push(`${info.width}x${info.height}: the App Store icon is ${rules.width}x${rules.height}`);
  if (info.colorType !== 2 || info.bitDepth !== 8) problems.push(`PNG colour type ${info.colorType}, ${info.bitDepth} bit - the icon is 24-bit RGB (colour type 2) without alpha`);
  if (info.alpha) problems.push('has transparency - the App Store icon is opaque with square corners (Apple masks them)');
  if (info.distinctColours !== null && info.distinctColours < 4) problems.push('looks blank (fewer than 4 colours)');
  return { info, problems };
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
 * Checks `dir` (appstore/screenshots). Options: `localesFile` (the appstore/locales.json whose folders every set
 * must have), `sets` (SETS by default; the tests pass smaller ones), `only` (set folders to check; the others are
 * not reported), `rules`, `icon` (the icon file to check; null skips it).
 * Returns { sets: [{ profile, folder, slot, size, locales: [{ locale, appLocale, files: [{ name, bytes, width,
 * height, problems }] }] }], icon, problems, warnings, ok }.
 */
export function checkScreenshots(dir = DEFAULT_DIR, { localesFile = DEFAULT_LOCALES_FILE, sets = SETS, only = null, rules = RULES, icon = dir === DEFAULT_DIR ? DEFAULT_ICON : null } = {}) {
  const problems = [];
  const warnings = [];
  const out = { sets: [], icon: null, problems, warnings, ok: false };
  if (!isDir(dir)) {
    problems.push(`${dir} does not exist - render the sets first (node scripts/play/render-screenshots.mjs --profile ${sets.map((s) => s.profile).join(' / ')})`);
    return out;
  }
  let folders;
  try {
    folders = appStoreFolders(localesFile);
  } catch (e) {
    problems.push(e.message);
    return out;
  }
  const locales = Object.keys(folders);
  if (!locales.includes(PRIMARY_LOCALE)) problems.push(`${path.basename(localesFile)} has no ${PRIMARY_LOCALE} folder (the primary language)`);

  const wanted = only ? sets.filter((s) => only.includes(s.folder)) : sets;
  if (only) for (const name of only) if (!sets.some((s) => s.folder === name)) problems.push(`"${name}" is not a set folder (${sets.map((s) => s.folder).join(', ')})`);

  // The root: the set folders and the two READMEs, nothing else.
  for (const name of readdirSync(dir).sort()) {
    if (sets.some((s) => s.folder === name) || ALLOWED_ROOT_EXTRA.has(name)) continue;
    problems.push(`${name}: not a set folder (${sets.map((s) => s.folder).join(', ')}) nor a README - remove it (nothing else is uploaded)`);
  }

  for (const set of wanted) {
    const setDir = path.join(dir, set.folder);
    const size = `${set.width}x${set.height}`;
    const report = { profile: set.profile, folder: set.folder, slot: set.slot, size, locales: [] };
    out.sets.push(report);
    if (!isDir(setDir)) {
      problems.push(`${set.folder}/: no set - render it (node scripts/play/render-screenshots.mjs --profile ${set.profile})`);
      continue;
    }
    for (const name of readdirSync(setDir).sort()) {
      if (locales.includes(name) || name === RENDER_LOG) continue;
      problems.push(`${set.folder}/${name}: not an App Store localization of ${path.basename(localesFile)} (${locales.join(' ')}) nor ${RENDER_LOG}`);
    }
    const log = readJson(path.join(setDir, RENDER_LOG), problems, `${set.folder}/${RENDER_LOG}`);
    if (log) {
      if (log.profile !== set.profile) problems.push(`${set.folder}/${RENDER_LOG}: profile "${log.profile}", expected "${set.profile}"`);
      if (log.size !== size) problems.push(`${set.folder}/${RENDER_LOG}: size ${log.size}, expected ${size}`);
      for (const locale of Object.keys(log.sets ?? {})) if (!locales.includes(locale)) warnings.push(`${set.folder}/${RENDER_LOG} lists ${locale}, which is not a localization of ${path.basename(localesFile)}`);
    }
    // The same file in two localizations must differ (an identical image means the language did not apply).
    const seen = new Map();
    for (const locale of locales) {
      const localeDir = path.join(setDir, locale);
      const appLocale = folders[locale];
      if (!isDir(localeDir)) {
        problems.push(`${set.folder}/${locale}: no screenshot set${locale === PRIMARY_LOCALE ? ' (the primary language - required)' : ''} - render it (node scripts/play/render-screenshots.mjs --profile ${set.profile} --locale ${locale})`);
        continue;
      }
      const names = readdirSync(localeDir).sort();
      const entry = { locale, appLocale, files: [] };
      report.locales.push(entry);
      const images = names.filter((n) => NAME.test(n));
      for (const n of names) if (!NAME.test(n)) problems.push(`${set.folder}/${locale}/${n}: not an NN-name.png screenshot - remove it (nothing else is uploaded)`);
      if (images.length < rules.minImages || images.length > rules.maxImages) problems.push(`${set.folder}/${locale}: ${images.length} screenshots - Apple: "at least one screenshot and ... up to ${rules.maxImages} screenshots per device size"`);
      const missing = set.files.filter((n) => !images.includes(n));
      const extra = images.filter((n) => !set.files.includes(n));
      if (missing.length) problems.push(`${set.folder}/${locale}: missing ${missing.join(', ')}`);
      if (extra.length) problems.push(`${set.folder}/${locale}: not in the shot list (${set.files.join(', ')}): ${extra.join(', ')}`);
      const logSet = log?.sets?.[locale];
      if (log && !logSet) problems.push(`${set.folder}/${locale}: not in ${RENDER_LOG} - render it (node scripts/play/render-screenshots.mjs --profile ${set.profile} --locale ${locale})`);
      if (logSet) {
        if (logSet.layout !== 'clean') problems.push(`${set.folder}/${locale}: ${RENDER_LOG} has no "layout": "clean" (rendered without the layout rules)`);
        const hosts = logSet.transport?.hosts;
        if (!Array.isArray(hosts) || hosts.some((h) => h !== '127.0.0.1') || logSet.transport?.refused !== 0 || !(logSet.transport?.requests > 0)) problems.push(`${set.folder}/${locale}: ${RENDER_LOG} transport log is not 127.0.0.1 only (${JSON.stringify(logSet.transport ?? null)})`);
        if (logSet.appLocale !== appLocale) problems.push(`${set.folder}/${locale}: ${RENDER_LOG} says app language "${logSet.appLocale}", expected "${appLocale}" (${path.basename(localesFile)})`);
        for (const name of Object.keys(logSet.files ?? {})) if (!images.includes(name)) problems.push(`${set.folder}/${locale}/${name}: in ${RENDER_LOG} but not on disk`);
      }
      for (const name of images) {
        const buf = readFileSync(path.join(localeDir, name));
        const { info, problems: own, warnings: warn } = imageProblems(buf, set, rules);
        const digest = sha256(buf);
        const logged = logSet?.files?.[name];
        if (logSet && !logged) own.push(`not in ${RENDER_LOG} (not written by the render)`);
        if (logged && (logged.bytes !== buf.length || logged.sha256 !== digest)) own.push(`differs from the file the render wrote (${RENDER_LOG}: ${logged.bytes} bytes, sha256 ${String(logged.sha256).slice(0, 12)}...)`);
        const key = `${name}\n${digest}`;
        if (seen.has(key)) own.push(`identical to ${seen.get(key)} (same SHA-256) - the language did not apply`);
        else seen.set(key, `${locale}/${name}`);
        for (const p of own) problems.push(`${set.folder}/${locale}/${name}: ${p}`);
        for (const w of warn) warnings.push(`${set.folder}/${locale}/${name}: ${w}`);
        entry.files.push({ name, bytes: buf.length, width: info?.width ?? null, height: info?.height ?? null, problems: own });
      }
    }
  }

  if (icon) {
    const rel = path.relative(ROOT, icon) || icon;
    if (!existsSync(icon)) {
      problems.push(`${rel}: missing - the App Store icon (node appstore/icon/render-icon.mjs makes it)`);
      out.icon = { file: rel, bytes: null, width: null, height: null, problems: ['missing'] };
    } else {
      const buf = readFileSync(icon);
      const { info, problems: own } = iconProblems(buf);
      for (const p of own) problems.push(`${rel}: ${p}`);
      out.icon = { file: rel, bytes: buf.length, width: info?.width ?? null, height: info?.height ?? null, colorType: info?.colorType ?? null, problems: own };
    }
  }
  out.ok = problems.length === 0;
  return out;
}

export function formatReport(result) {
  const lines = [];
  let images = 0;
  for (const set of result.sets) {
    const n = set.locales.length;
    const total = set.locales.reduce((s, l) => s + l.files.reduce((t, f) => t + f.bytes, 0), 0);
    lines.push(`${set.folder}/  profile ${set.profile}, ${set.size}, App Store Connect slot "${set.slot}": ${n} localization${n === 1 ? '' : 's'}, ${set.locales.reduce((s, l) => s + l.files.length, 0)} images, ${(total / 1048576).toFixed(1)} MB`);
    for (const l of set.locales) {
      images += l.files.length;
      const sizes = [...new Set(l.files.map((f) => `${f.width}x${f.height}`))].join(' / ') || '-';
      const bytes = l.files.reduce((s, f) => s + f.bytes, 0);
      lines.push(`  ${l.files.every((f) => !f.problems.length) ? 'ok  ' : 'FAIL'} ${l.locale.padEnd(8)} ${String(l.files.length).padStart(2)} images ${sizes.padEnd(10)} ${kb(bytes).padStart(8)}  (${l.files.map((f) => (f.bytes / 1024).toFixed(0)).join(' / ')} KB)`);
    }
  }
  if (result.icon) {
    const i = result.icon;
    lines.push(`icon  ${i.problems.length ? 'FAIL' : 'ok  '} ${i.file}: ${i.width ?? '?'}x${i.height ?? '?'}${i.colorType !== undefined && i.colorType !== null ? `, PNG colour type ${i.colorType}` : ''}${i.bytes !== null ? `, ${kb(i.bytes)}` : ''}`);
  }
  for (const w of result.warnings) lines.push(`WARN ${w}`);
  for (const p of result.problems) lines.push(`FAIL ${p}`);
  const sets = result.sets.length;
  lines.push(
    result.ok
      ? `check-screenshots (App Store): ${sets} set${sets === 1 ? '' : 's'}, ${images} images - every set complete for every localization of locales.json, 24-bit RGB PNG without alpha at its class's exact size (Apple: 1-10 per device size, no transparency), no image repeated between localizations, render logs clean and 127.0.0.1 only${result.icon ? `, icon ${result.icon.width}x${result.icon.height} RGB` : ''}`
      : `check-screenshots (App Store): ${result.problems.length} problem(s)`,
  );
  return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const value = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : null;
  };
  const dir = value('--dir') ? path.resolve(value('--dir')) : DEFAULT_DIR;
  const localesFile = value('--locales') ? path.resolve(value('--locales')) : DEFAULT_LOCALES_FILE;
  const only = value('--set') ? value('--set').split(',').map((s) => s.trim()).filter(Boolean) : null;
  const icon = args.includes('--no-icon') ? null : value('--icon') ? path.resolve(value('--icon')) : dir === DEFAULT_DIR ? DEFAULT_ICON : null;
  const result = checkScreenshots(dir, { localesFile, only, icon });
  console.log(args.includes('--json') ? JSON.stringify(result, null, 2) : formatReport(result));
  process.exit(result.ok ? 0 : 1);
}
