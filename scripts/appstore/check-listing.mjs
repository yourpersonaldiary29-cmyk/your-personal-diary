#!/usr/bin/env node
/**
 * scripts/appstore/check-listing.mjs - validates the App Store listing texts in appstore/listing/.
 *
 *   node scripts/appstore/check-listing.mjs                    every localization of appstore/locales.json (exit 1 on any problem)
 *   node scripts/appstore/check-listing.mjs --only en-US,he    only these folders (the other folders are not reported as missing)
 *   node scripts/appstore/check-listing.mjs --dir <dir>        another folder with the same layout (the tests)
 *   node scripts/appstore/check-listing.mjs --locales <file>   another locales.json (the tests)
 *   node scripts/appstore/check-listing.mjs --settings <file>  another legal/settings.json (the tests)
 *   node scripts/appstore/check-listing.mjs --json             the result as JSON
 *
 * Package LISTING of the FINAL sprint (docs/apple-tasks/LISTING.md, docs/apple-tasks/ENV-FINAL.md). Modelled on
 * scripts/store/check-listing.mjs (Microsoft Store) and scripts/play/check-listing.mjs (Google Play). ESM, no dependencies.
 *
 * Layout: appstore/listing/<folder>/ with one UTF-8 file per App Store Connect field (FIELDS below). <folder> is the
 * App Store Connect localization code of appstore/locales.json, which maps every UI language of the app
 * (shared/i18n/locales.ts) to Apple's code, or to null when Apple has no such localization (Bulgarian) - then
 * appstore/listing/<app locale>/NOTE.txt must exist and say so. en-US and he also carry platform-notes.md (the
 * sentences a record - iPhone or Mac - may word more precisely); no other folder may. Folders starting with "_"
 * (the Bulgarian draft _bg) are skipped here; scripts/appstore/check-listing.test.mjs checks _bg with the same rules.
 *
 * Two app records share the files (ENV-FINAL decision 1) except the name: name.txt is the iPhone record's name and
 * name-mac.txt the Mac record's, because "You can use an app name for one app per localization"
 * (docs/apple-tasks/APPSTORE-FACTS.md 2.3; LISTING.md amendment 2026-11-08).
 *
 * Limits (App Store Connect, per localization - APPSTORE-FACTS.md section 2, verified): name 30 (both records), subtitle
 * 30, promotional text 170, description 4000, what's new 4000 - counted in Unicode code points (Array.from(text).length)
 * after CRLF -> LF and without the final line break; UTF-16 units would differ only for characters outside the BMP
 * (emoji), which the texts may not contain anyway. Keywords: 100 BYTES of UTF-8 including the commas (KEYWORD_BYTES).
 *
 * Rules (LISTING.md "CHECK SCRIPT", "CONTENT RULES" and amendments): every file present and nothing else; the two names
 * are exactly "Your Personal Diary" and "Your Personal Diary for Mac"; the keywords are one line of comma-separated
 * terms with no space after a comma, unique, not the brand, not a word of the names or the subtitle (Apple indexes those
 * already; in Thai, Chinese and Japanese, written without spaces, not a part of them), no plural next to its singular;
 * the URLs are https on yourpersonaldiary.fly.dev with the locale path and the marketing URL is empty; the description
 * has at least 600 characters, names the app in its first paragraph and states in its last paragraph the minimum age
 * of legal/settings.json ("minimumAge") and no other number; description and what's new carry no Markdown, HTML, emoji
 * or bullet other than "- "; no other platform or store is named (App Review Guideline 2.3.10), in any script; no "{{",
 * tabs or trailing spaces; a translation is written in its language's script and is not the English text.
 * Patterns catch wordings, not meaning: a human still reads every folder (appstore/README.md, the verifier role).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const DEFAULT_LISTING_DIR = path.join(ROOT, 'appstore', 'listing');
export const DEFAULT_LOCALES_FILE = path.join(ROOT, 'appstore', 'locales.json');
/** The legal settings shared with the privacy policy, the Terms of Use and the support pages (scripts/legal/). */
export const DEFAULT_SETTINGS_FILE = path.join(ROOT, 'legal', 'settings.json');

export const BRAND = 'Your Personal Diary';
/**
 * The Mac record's name: an account may use an app name "for one app per localization" (APPSTORE-FACTS 2.3), and the
 * iPhone record carries the brand itself (LISTING.md amendment 2026-11-08; appstore/policy/app-information.md).
 */
export const MAC_NAME = `${BRAND} for Mac`;
/** The app locale of the primary localization (its URLs have no locale segment). */
export const PRIMARY_APP_LOCALE = 'en';
export const PRIMARY_FOLDER = 'en-US';
/** The fixed server of src/config/server-default.json (ENV-FINAL decision 12). */
export const SERVER = 'https://yourpersonaldiary.fly.dev';
export const NOTE_FILE = 'NOTE.txt';
export const PLATFORM_NOTES = 'platform-notes.md';
/** The folders that carry platform-notes.md (the base writer's two) - required there, not allowed elsewhere. */
export const PLATFORM_NOTES_FOLDERS = ['en-US', 'he'];

/**
 * Keywords: "One or more keywords (each greater than two characters) describing your app. You can provide up to 100
 * bytes of content." (Apple's reference page, APPSTORE-FACTS.md 2.8; 14.6: "the LISTING checker must count UTF-8
 * bytes"; LISTING.md amendment 2026-11-08). So the limit is 100 bytes of UTF-8 including the commas - a Latin letter
 * takes 1 byte, a Hebrew, Arabic, Cyrillic or Greek letter 2, a Chinese, Japanese, Thai or Devanagari character 3 - and
 * a longer list is a problem like any other limit. "Greater than two characters": a Chinese or Japanese word is often
 * two characters (日记, 睡眠), so that floor is not applied to Han and kana (appstore/README.md section 2 says what to do
 * if App Store Connect ever refuses one).
 */
export const KEYWORD_BYTES = 100;
export const KEYWORD_MIN_CHARS = 3;

/**
 * One file per App Store Connect field.
 *   label       the field as App Store Connect labels it
 *   max / min   limits in code points
 *   maxBytes    limit in UTF-8 bytes
 *   exact       the only allowed content
 *   oneLine     no line break inside
 *   keywords    the keyword rules apply
 *   url         'support' | 'privacy': the URL rule applies
 *   empty       the file must be empty
 *   translated  the content is in the folder's language (translation checks apply)
 *   plain       the plain-text rules apply (Markdown, HTML, emoji, bullets)
 */
export const FIELDS = {
  'name.txt': { label: 'Name (iPhone record)', max: 30, exact: BRAND, oneLine: true, translated: false },
  'name-mac.txt': { label: 'Name (Mac record)', max: 30, exact: MAC_NAME, oneLine: true, translated: false },
  'subtitle.txt': { label: 'Subtitle', max: 30, oneLine: true, translated: true },
  'promotional-text.txt': { label: 'Promotional Text', max: 170, translated: true },
  'description.txt': { label: 'Description', max: 4000, min: 600, translated: true, plain: true },
  'keywords.txt': { label: 'Keywords', maxBytes: KEYWORD_BYTES, oneLine: true, keywords: true, translated: true },
  'whats-new.txt': { label: "What's New in This Version", max: 4000, translated: true, plain: true },
  'support-url.txt': { label: 'Support URL', url: 'support', oneLine: true, translated: false },
  'privacy-url.txt': { label: 'Privacy Policy URL', url: 'privacy', oneLine: true, translated: false },
  'marketing-url.txt': { label: 'Marketing URL', empty: true, translated: false },
};
export const FILES = Object.keys(FIELDS);
/** The files whose words Apple indexes already (the keyword rules): both names and the subtitle. */
export const NAME_FILES = ['name.txt', 'name-mac.txt', 'subtitle.txt'];
/** The columns of the table printed when everything passes: [title, file, value, limit]. */
export const TABLE_COLUMNS = [
  ['subtitle', 'subtitle.txt', 'chars', FIELDS['subtitle.txt'].max],
  ['promo', 'promotional-text.txt', 'chars', FIELDS['promotional-text.txt'].max],
  ['description', 'description.txt', 'chars', FIELDS['description.txt'].max],
  ['kw chars', 'keywords.txt', 'chars', '-'],
  ['kw bytes', 'keywords.txt', 'bytes', KEYWORD_BYTES],
];

/** The Unicode script(s) a real translation is written in, per app locale (shared/i18n/locales.ts order). */
export const SCRIPTS = {
  en: ['Latin'], he: ['Hebrew'], ar: ['Arabic'], zh: ['Han'], ja: ['Hiragana', 'Katakana', 'Han'], hi: ['Devanagari'],
  th: ['Thai'], es: ['Latin'], pt: ['Latin'], fr: ['Latin'], it: ['Latin'], de: ['Latin'], ro: ['Latin'], el: ['Greek'],
  pl: ['Latin'], cs: ['Latin'], hu: ['Latin'], ru: ['Cyrillic'], bg: ['Cyrillic'], tr: ['Latin'],
};
/** The share of letters that must be in the language's own script (brand and product terms removed first). */
const MIN_SCRIPT_SHARE = 0.6;
/** Scripts written without spaces between words: a "word" of the subtitle is a whole phrase there. */
const NO_SPACE_SCRIPT_RE = /[\p{Script=Thai}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** Product terms that stay in Latin letters in every language (LISTING.md content rules). */
export const PRODUCT_TERMS = ['Face ID', 'Touch ID', 'HTTPS', 'TXT', 'CSV', 'JSON', 'PDF', 'AES-256'];

/**
 * A word boundary for a Latin term: no Latin letter or digit on either side (JavaScript's \b knows ASCII only).
 * Only Latin letters count, because in Chinese or Japanese text "Android" is glued to the next character
 * ("Androidでも") and must still be found, while "exercise" must not match "exe".
 */
const NOT_BEFORE = '(?<![\\p{Script=Latin}\\p{N}])';
const NOT_AFTER = '(?![\\p{Script=Latin}\\p{N}])';
const word = (w) => new RegExp(`${NOT_BEFORE}${w}${NOT_AFTER}`, 'iu');

/**
 * Other platforms and stores may not be named in App Store metadata (App Review Guideline 2.3.10) - the brief's
 * Latin terms as whole words (so "exercise" is fine and ".exe" is caught), plus the same names as the app's other
 * scripts write them.
 */
export const FORBIDDEN_TERMS = [
  { re: word('android'), show: 'Android' },
  { re: /google\s*play/iu, show: 'Google Play' },
  { re: /play\s*store/iu, show: 'Play Store' },
  { re: word('windows'), show: 'Windows' },
  { re: /microsoft/iu, show: 'Microsoft' },
  { re: word('msix'), show: 'MSIX' },
  { re: word('exe'), show: 'exe' },
  { re: /אנדרואיד|ווינדוס|מיקרוסופט|גוגל פליי/u, show: 'Android / Windows / Microsoft / Google Play (Hebrew)' },
  { re: /أندرويد|ويندوز|مايكروسوفت|جوجل بلاي/u, show: 'Android / Windows / Microsoft / Google Play (Arabic)' },
  { re: /андроид|виндовс|майкрософт|гугл плей/iu, show: 'Android / Windows / Microsoft / Google Play (Cyrillic)' },
  { re: /安卓|微软|谷歌/u, show: 'Android / Microsoft / Google (Chinese)' },
  { re: /アンドロイド|ウィンドウズ|マイクロソフト/u, show: 'Android / Windows / Microsoft (Japanese)' },
  { re: /एंड्रॉइड|एंड्रॉयड|एंड्राइड|विंडोज|माइक्रोसॉफ्ट/u, show: 'Android / Windows / Microsoft (Hindi)' },
  { re: /แอนดรอยด์|วินโดวส์|ไมโครซอฟท์|ไมโครซอฟต์/u, show: 'Android / Windows / Microsoft (Thai)' },
];

const MARKDOWN_RE = /\*\*|##|`/;
const HTML_RE = /<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?\/?>|&[a-z]+;|&#\d+;/i;
const EMOJI_RE = /\p{Extended_Pictographic}|\u{FE0F}|[\u{1F000}-\u{1FAFF}]|[☀-➿]/u;
/** A bullet other than "-" at the start of a line (App Store Connect shows plain text; "- " is the only bullet used). */
const OTHER_BULLET_RE = /^[•*·●▪◦‣◆■○]/mu;
/** The first code point ("0") of the digit sets the texts may use: ASCII, Arabic-Indic, Persian, Devanagari, Thai, fullwidth. */
const DIGIT_ZEROS = [0x30, 0x660, 0x6f0, 0x966, 0xe50, 0xff10];

// ---------------------------------------------------------------------------------------------
/** CRLF -> LF, without the final line break. */
export function normalise(raw) {
  return raw.replace(/\r\n/g, '\n').replace(/\n$/, '');
}

/** The length counted against a limit: Unicode code points of the normalised text. */
export function count(text) {
  return Array.from(normalise(text)).length;
}

/** The UTF-8 bytes of the normalised text (the keyword limit). */
export function bytesOf(text) {
  return Buffer.byteLength(normalise(text), 'utf8');
}

/** The words of a text (letters, marks, digits, apostrophes and hyphens), lower-cased for the locale. */
export function wordsOf(text, locale = 'en') {
  return [...text.toLocaleLowerCase(locale).matchAll(/[\p{L}\p{M}\p{N}'’-]+/gu)].map((m) => m[0]);
}

/** The whole numbers written in a text, in any digit set of DIGIT_ZEROS (NaN for a number in another digit set). */
export function numbersIn(text) {
  return [...text.matchAll(/\p{Nd}+/gu)].map((m) =>
    Number(
      [...m[0]]
        .map((ch) => {
          const cp = ch.codePointAt(0);
          const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9);
          return zero === undefined ? 'x' : String(cp - zero);
        })
        .join(''),
    ),
  );
}

/** The last paragraph of a text whose paragraphs are separated by blank lines. */
export function lastParagraph(text) {
  return normalise(text).split(/\n[ \t]*\n/).at(-1);
}

export function expectedUrl(kind, appLocale) {
  return appLocale === PRIMARY_APP_LOCALE ? `${SERVER}/${kind}/` : `${SERVER}/${kind}/${appLocale}/`;
}

/**
 * The minimum age of the account: legal/settings.json "minimumAge", the single source of the legal pages and the
 * Terms of Use. ENV-FINAL / LISTING amendment 2026-11-10: the main session sets it and nobody hard-codes it, so the
 * descriptions are checked against the file - when the value changes, the check names every description to edit.
 */
export function loadMinimumAge(file = DEFAULT_SETTINGS_FILE) {
  const name = path.relative(ROOT, file).replaceAll('\\', '/') || file;
  let age;
  try {
    age = JSON.parse(readFileSync(file, 'utf8')).minimumAge;
  } catch (error) {
    return { age: null, problems: [`${name}: cannot be read (${error.message}) - the descriptions state its "minimumAge"`] };
  }
  if (!Number.isInteger(age) || age < 1 || age > 99) {
    return { age: null, problems: [`${name}: "minimumAge" must be a whole number of years (it is ${JSON.stringify(age)})`] };
  }
  return { age, problems: [] };
}

/** File hygiene shared by every text file (not the empty marketing URL). */
export function hygieneProblems(raw) {
  const problems = [];
  if (raw.charCodeAt(0) === 0xfeff) problems.push('starts with a byte-order mark');
  const lf = raw.replace(/\r\n/g, '\n');
  if (!lf.endsWith('\n')) problems.push('does not end with a line break');
  if (/\n\n$/.test(lf)) problems.push('ends with an empty line');
  const text = normalise(raw);
  if (/\r/.test(text)) problems.push('contains a lone carriage return');
  if (/\t/.test(text)) problems.push('contains a tab');
  if (/[  ]$/mu.test(text)) problems.push('has a space at the end of a line');
  if (/^[  ]/mu.test(text)) problems.push('has a space at the start of a line');
  if (/ {2}/.test(text)) problems.push('has two spaces in a row');
  if (/\{\{|\}\}/.test(text)) problems.push('contains "{{" or "}}" - the App Store texts have no placeholders');
  if (/\n\n\n/.test(text)) problems.push('has two empty lines in a row');
  if (/^\n/.test(text)) problems.push('starts with an empty line');
  return problems;
}

export function forbiddenHits(text) {
  const hits = [];
  for (const { re, show } of FORBIDDEN_TERMS) {
    const m = re.exec(text);
    if (m) hits.push(`${JSON.stringify(m[0])} - ${show}`);
  }
  return hits;
}

/** Plain-text rules (description, what's new; the short fields get the same checks). */
export function plainTextProblems(text) {
  const problems = [];
  const md = MARKDOWN_RE.exec(text);
  if (md) problems.push(`contains a Markdown marker (${JSON.stringify(md[0])}) - App Store Connect shows plain text`);
  const html = HTML_RE.exec(text);
  if (html) problems.push(`contains HTML (${html[0]}) - App Store Connect shows plain text`);
  // ©, ® and ™ are Extended_Pictographic in Unicode but are ordinary signs.
  const emoji = EMOJI_RE.exec(text.replace(/[©®™]/g, ''));
  if (emoji) problems.push(`contains an emoji or pictograph (${JSON.stringify(emoji[0])})`);
  const bullet = OTHER_BULLET_RE.exec(text);
  if (bullet) problems.push(`starts a line with the bullet ${JSON.stringify(bullet[0])} - only "- " is used`);
  return problems;
}

/**
 * The keyword rules. `reserved` = the words of the two names and the subtitle of the same folder, `reservedText` the
 * same texts as written (Apple indexes them already, so repeating them wastes the 100 bytes). In Thai, Chinese and
 * Japanese the words are not separated by spaces, so a keyword in those scripts must not be a part of those texts.
 */
export function keywordProblems(text, appLocale, reserved = new Set(), reservedText = '') {
  const problems = [];
  if (/,[  \t]/u.test(text)) problems.push('has a space after a comma (write "a,b", not "a, b")');
  if (/[  \t],/u.test(text)) problems.push('has a space before a comma');
  if (/^,|,$/.test(text)) problems.push('starts or ends with a comma');
  if (/,,/.test(text)) problems.push('has an empty keyword (two commas in a row)');
  const items = text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  if (items.length < 2) problems.push('lists fewer than two comma-separated keywords');
  const indexed = reservedText.toLocaleLowerCase(appLocale);
  const seen = new Map();
  for (const item of items) {
    const key = item.toLocaleLowerCase(appLocale);
    if (seen.has(key)) problems.push(`repeats the keyword "${item}"`);
    seen.set(key, item);
    // Apple's "greater than two characters" floor; a Chinese or Japanese word of two characters is a whole word.
    if (Array.from(item).length < KEYWORD_MIN_CHARS && !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(item)) {
      problems.push(`"${item}" is shorter than three characters - Apple requires more than two`);
    }
    if (/your personal diary/iu.test(item)) problems.push(`"${item}" is the app's name - Apple indexes the name already`);
    let repeated = false;
    for (const w of wordsOf(item, appLocale)) {
      if (reserved.has(w)) {
        problems.push(`"${item}" repeats the word "${w}" of the name or subtitle - Apple indexes those already`);
        repeated = true;
      }
    }
    if (!repeated && NO_SPACE_SCRIPT_RE.test(item) && indexed.includes(key)) {
      problems.push(`"${item}" is already part of the name or subtitle - Apple indexes those already`);
    }
  }
  const keys = [...seen.keys()];
  for (const a of keys) {
    if (!/^[a-z]+$/.test(a)) continue;
    for (const b of keys) {
      if (b === `${a}s` || b === `${a}es` || (a.endsWith('y') && b === `${a.slice(0, -1)}ies`)) {
        problems.push(`"${seen.get(b)}" is the plural of "${seen.get(a)}" - one of them is enough`);
      }
    }
  }
  return problems;
}

/**
 * The minimum-age rule of a description: its last paragraph ("Please note") states the minimum age of
 * legal/settings.json and no other number.
 */
export function minimumAgeProblems(text, minimumAge) {
  const numbers = numbersIn(lastParagraph(text));
  if (numbers.length && numbers.every((n) => n === minimumAge)) return [];
  const shown = numbers.map((n) => (Number.isNaN(n) ? 'a number in digits the checker cannot read' : String(n)));
  const found = shown.length ? `it gives ${shown.join(', ')}` : 'it gives no number';
  return [`the last paragraph must state the minimum age of legal/settings.json ("minimumAge": ${minimumAge}) and no other number - ${found}; write ${minimumAge} in its age sentence (appstore/README.md section 3)`];
}

function scriptShare(text, scripts) {
  let stripped = text.replaceAll(BRAND, '');
  for (const term of PRODUCT_TERMS) stripped = stripped.replaceAll(term, '');
  const letters = [...stripped].filter((ch) => /\p{L}/u.test(ch));
  if (!letters.length) return 1;
  const inScript = letters.filter((ch) => scripts.some((s) => new RegExp(`\\p{Script=${s}}`, 'u').test(ch))).length;
  return inScript / letters.length;
}

/**
 * The problems of one field file. `english` is the en-US text of the same file (null for en-US or when unknown);
 * `reserved` the words of the folder's names and subtitle and `reservedText` those texts (keywords only);
 * `minimumAge` the value of legal/settings.json (description only; null skips the rule).
 */
export function textProblems(appLocale, file, raw, english = null, reserved = new Set(), { reservedText = '', minimumAge = null } = {}) {
  const field = FIELDS[file];
  if (!field) return { problems: [`${file}: not a listing field`], chars: null, bytes: null };
  const scripts = SCRIPTS[appLocale];
  if (!scripts) return { problems: [`${appLocale}: not a UI language of the app`], chars: null, bytes: null };

  if (field.empty) {
    const problems = raw.trim() === '' ? [] : ['must be empty - there is no marketing site (ENV-FINAL decision 12)'];
    return { problems, chars: count(raw), bytes: bytesOf(raw) };
  }
  const problems = hygieneProblems(raw);
  const text = normalise(raw);
  const chars = count(text);
  const bytes = bytesOf(text);
  if (!text.trim()) {
    problems.push('is empty');
    return { problems, chars, bytes };
  }
  if (field.exact !== undefined && text !== field.exact) problems.push(`must be exactly "${field.exact}" (it is ${JSON.stringify(text)})`);
  if (field.max !== undefined && chars > field.max) problems.push(`is ${chars} characters long, the limit is ${field.max}`);
  if (field.min !== undefined && chars < field.min) problems.push(`is ${chars} characters long, at least ${field.min} are expected`);
  if (field.maxBytes !== undefined && bytes > field.maxBytes) {
    problems.push(`is ${bytes} bytes of UTF-8 (${chars} characters), the limit is ${field.maxBytes} bytes (APPSTORE-FACTS 2.8; a Hebrew, Arabic, Cyrillic or Greek letter takes 2 bytes, a Chinese, Japanese, Thai or Devanagari character 3) - delete keywords from the end`);
  }
  if (field.oneLine && text.includes('\n')) problems.push('must be one line');
  if (field.keywords) problems.push(...keywordProblems(text, appLocale, reserved, reservedText));
  if (field.url) {
    const expected = expectedUrl(field.url, appLocale);
    if (text !== expected) problems.push(`must be exactly ${expected} (it is ${JSON.stringify(text)})`);
  }
  for (const hit of forbiddenHits(text)) problems.push(`names another platform or store (${hit}) - App Review Guideline 2.3.10`);
  if (field.translated) problems.push(...plainTextProblems(text));
  if (file === 'description.txt') {
    const first = text.split(/\n[ \t]*\n/)[0];
    if (!first.includes(BRAND)) problems.push(`the first paragraph must name the app ("${BRAND}") and say what it is`);
    if (minimumAge !== null) problems.push(...minimumAgeProblems(text, minimumAge));
  }
  if (field.translated && appLocale !== PRIMARY_APP_LOCALE) {
    if (english !== null && normalise(english) === text) problems.push('is the English text, not a translation');
    if (!field.keywords) {
      const share = scriptShare(text, scripts);
      if (share < MIN_SCRIPT_SHARE) problems.push(`is not written in ${scripts.join(' / ')} (${Math.round(share * 100)}% of its letters are)`);
    }
  }
  return { problems, chars, bytes };
}

// ---------------------------------------------------------------------------------------------
/**
 * Reads appstore/locales.json: { "<app locale>": { folder: "<App Store Connect code>" | null, appleName, note } }.
 * Returns the entries and the problems of the file itself.
 */
export function loadLocales(file = DEFAULT_LOCALES_FILE) {
  const problems = [];
  const entries = {};
  const name = path.basename(file);
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { entries, problems: [`${name}: cannot be read as JSON (${error.message})`] };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { entries, problems: [`${name}: must be an object keyed by app locale`] };
  const folders = new Map();
  for (const [app, def] of Object.entries(raw)) {
    if (!/^[a-z]{2}$/.test(app)) problems.push(`${name}: "${app}" is not a two-letter app locale`);
    if (!def || typeof def !== 'object' || Array.isArray(def)) {
      problems.push(`${name}: ${app} must be an object with folder, appleName and note`);
      continue;
    }
    const { folder = undefined, appleName = undefined, note = undefined } = def;
    if (folder !== null && (typeof folder !== 'string' || !/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(folder))) {
      problems.push(`${name}: ${app}.folder must be an App Store Connect localization code such as "de-DE" or null (it is ${JSON.stringify(folder)})`);
    }
    if (folder !== null && (typeof appleName !== 'string' || !appleName.trim())) problems.push(`${name}: ${app}.appleName must be Apple's display name of the localization`);
    if (folder === null && appleName !== null) problems.push(`${name}: ${app}.appleName must be null when there is no localization`);
    if (typeof note !== 'string') problems.push(`${name}: ${app}.note must be a string (empty is fine)`);
    if (typeof folder === 'string') {
      if (folders.has(folder)) problems.push(`${name}: the folder ${folder} is used by both ${folders.get(folder)} and ${app}`);
      folders.set(folder, app);
    }
    entries[app] = { folder: typeof folder === 'string' ? folder : null, appleName: typeof appleName === 'string' ? appleName : null, note: typeof note === 'string' ? note : '' };
  }
  if (Object.keys(entries).length && entries[PRIMARY_APP_LOCALE]?.folder !== PRIMARY_FOLDER) {
    problems.push(`${name}: ${PRIMARY_APP_LOCALE} must map to the primary localization ${PRIMARY_FOLDER}`);
  }
  return { entries, problems };
}

function readIf(p) {
  return existsSync(p) && statSync(p).isFile() ? readFileSync(p, 'utf8') : null;
}

/**
 * Checks a listing folder. `only` limits the check to those folders (and app locales without a folder, e.g. "bg");
 * other folders are then not reported as missing. `settingsFile` is the legal/settings.json whose "minimumAge" the
 * descriptions state. Returns rows (one per folder and field file, with chars, bytes and problems), folder-level
 * problems, notes (the locales without a localization), the minimum age checked and `ok`.
 */
export function checkListing(dir = DEFAULT_LISTING_DIR, { only = null, localesFile = DEFAULT_LOCALES_FILE, settingsFile = DEFAULT_SETTINGS_FILE } = {}) {
  const rows = [];
  const notes = [];
  const loaded = loadLocales(localesFile);
  const minimum = loadMinimumAge(settingsFile);
  const problems = [...loaded.problems, ...minimum.problems];
  const minimumAge = minimum.age;
  if (!existsSync(dir)) return { rows, problems: [...problems, `${dir} does not exist`], notes, minimumAge, ok: false };
  const entries = loaded.entries;
  const byFolder = new Map();
  const noFolder = [];
  for (const [app, def] of Object.entries(entries)) {
    if (def.folder) byFolder.set(def.folder, app);
    else noFolder.push(app);
  }
  const present = readdirSync(dir).filter((name) => statSync(path.join(dir, name)).isDirectory() && !name.startsWith('_'));
  if (only) for (const f of only) if (!byFolder.has(f) && !noFolder.includes(f)) problems.push(`--only: ${f} is not a localization folder of ${path.basename(localesFile)}`);
  const wanted = (name) => !only || only.includes(name);
  const expected = [...byFolder.keys()].filter(wanted);
  for (const f of expected) if (!present.includes(f)) problems.push(`localization folder missing: ${f} (${entries[byFolder.get(f)].appleName})`);
  for (const name of present) if (!byFolder.has(name) && !noFolder.includes(name)) problems.push(`unexpected folder: ${name} (not a folder of ${path.basename(localesFile)})`);

  for (const app of noFolder.filter(wanted)) {
    const note = readIf(path.join(dir, app, NOTE_FILE));
    if (note === null || !note.trim()) {
      problems.push(`${app}: has no App Store localization, so ${app}/${NOTE_FILE} must exist and say so`);
      continue;
    }
    notes.push(`${app}: no App Store localization (${app}/${NOTE_FILE} present)`);
    const extra = readdirSync(path.join(dir, app)).filter((n) => n !== NOTE_FILE);
    if (extra.length) problems.push(`${app}: has no App Store localization - only ${NOTE_FILE} belongs there, not: ${extra.join(', ')}`);
  }

  const english = {};
  for (const file of FILES) english[file] = readIf(path.join(dir, PRIMARY_FOLDER, file));

  for (const folder of expected) {
    if (!present.includes(folder)) continue;
    const app = byFolder.get(folder);
    const files = readdirSync(path.join(dir, folder));
    const reserved = new Set();
    const indexed = [];
    for (const file of NAME_FILES) {
      const t = readIf(path.join(dir, folder, file));
      if (t === null) continue;
      for (const w of wordsOf(normalise(t), app)) reserved.add(w);
      indexed.push(normalise(t));
    }
    for (const file of FILES) {
      const raw = readIf(path.join(dir, folder, file));
      if (raw === null) {
        rows.push({ folder, app, file, chars: null, bytes: null, problems: ['missing'] });
        continue;
      }
      const ref = folder === PRIMARY_FOLDER ? null : english[file];
      const { problems: fileProblems, chars, bytes } = textProblems(app, file, raw, ref, reserved, { reservedText: indexed.join('\n'), minimumAge });
      rows.push({ folder, app, file, chars, bytes, problems: fileProblems });
    }
    const wantsNotes = PLATFORM_NOTES_FOLDERS.includes(folder);
    const notesText = readIf(path.join(dir, folder, PLATFORM_NOTES));
    if (wantsNotes && notesText === null) problems.push(`${folder}: ${PLATFORM_NOTES} is missing (required in ${PLATFORM_NOTES_FOLDERS.join(' and ')})`);
    if (notesText !== null) {
      if (!wantsNotes) problems.push(`${folder}: unexpected file ${PLATFORM_NOTES} (only ${PLATFORM_NOTES_FOLDERS.join(' and ')} carry it)`);
      else {
        for (const p of hygieneProblems(notesText)) problems.push(`${folder}/${PLATFORM_NOTES}: ${p}`);
        for (const hit of forbiddenHits(normalise(notesText))) problems.push(`${folder}/${PLATFORM_NOTES}: names another platform or store (${hit})`);
      }
    }
    const extra = files.filter((n) => !FILES.includes(n) && n !== PLATFORM_NOTES);
    if (extra.length) problems.push(`${folder}: unexpected file(s): ${extra.join(', ')}`);
  }
  const ok = problems.length === 0 && rows.every((r) => r.problems.length === 0);
  return { rows, problems, notes, minimumAge, ok };
}

export function formatReport({ rows, problems, notes, minimumAge = null, ok }) {
  const lines = [];
  const folders = [...new Set(rows.map((r) => r.folder))];
  if (ok) {
    lines.push(['localization'.padEnd(13), ...TABLE_COLUMNS.map(([title]) => title.padStart(12))].join(''));
    lines.push(['limit'.padEnd(13), ...TABLE_COLUMNS.map(([, , , limit]) => String(limit).padStart(12))].join(''));
    for (const folder of folders) {
      const cell = (file, key) => String(rows.find((r) => r.folder === folder && r.file === file)?.[key] ?? '-').padStart(12);
      lines.push([folder.padEnd(13), ...TABLE_COLUMNS.map(([, file, key]) => cell(file, key))].join(''));
    }
    for (const n of notes) lines.push(n);
    if (minimumAge !== null && folders.length) lines.push(`every description states the minimum age ${minimumAge} of legal/settings.json`);
    lines.push(`check-listing: ${folders.length} localizations, ${rows.length} files, all within the App Store limits and rules`);
    return lines.join('\n');
  }
  let n = 0;
  for (const r of rows) {
    if (!r.problems.length) continue;
    lines.push(`FAIL ${r.folder}/${r.file}${r.chars === null ? '' : ` (${r.chars} characters)`}`);
    for (const p of r.problems) {
      lines.push(`  - ${p}`);
      n += 1;
    }
  }
  for (const p of problems) {
    lines.push(`FAIL ${p}`);
    n += 1;
  }
  for (const note of notes) lines.push(note);
  lines.push(`check-listing: ${n} problem${n === 1 ? '' : 's'} - fix them and run again`);
  return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : null;
  };
  const dir = opt('--dir') ? path.resolve(opt('--dir')) : DEFAULT_LISTING_DIR;
  const localesFile = opt('--locales') ? path.resolve(opt('--locales')) : DEFAULT_LOCALES_FILE;
  const settingsFile = opt('--settings') ? path.resolve(opt('--settings')) : DEFAULT_SETTINGS_FILE;
  const only = opt('--only') ? opt('--only').split(',').map((s) => s.trim()).filter(Boolean) : null;
  const result = checkListing(dir, { only, localesFile, settingsFile });
  if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else console.log(formatReport(result));
  process.exit(result.ok ? 0 : 1);
}
