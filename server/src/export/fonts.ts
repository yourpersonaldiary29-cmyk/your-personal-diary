/**
 * Font selection for the PDF export.
 *
 * Bundled (src-tauri/resources/server/fonts, copied next to the server bundle):
 *   DejaVu Sans            Latin (incl. all diacritics of the supported languages), Greek, Cyrillic, Hebrew,
 *                          box-drawing and punctuation; also the fallback for any glyph the other fonts lack
 *   Noto Sans Arabic       Arabic script (joining forms via OpenType shaping)
 *   Noto Sans Devanagari   Hindi (conjuncts and matras via the Indic shaper)
 *   Noto Sans Thai         Thai (marks positioned by the font's GPOS table)
 * System (never bundled because of their size): Chinese and Japanese come from the system font
 * collections, opened by PostScript name - on Windows Microsoft YaHei / Yu Gothic (`.ttc` in the
 * Windows fonts folder), on Android Noto Sans CJK (`/system/fonts/NotoSansCJK-Regular.ttc`, with
 * the older per-language files as fallbacks). The table is chosen by the platform
 * (`systemCjkFonts`): the Android one is used only when the platform is 'android', never on
 * Windows. When no CJK font is found the PDF falls back to DejaVu Sans (boxes for CJK) and adds a
 * note line.
 *
 * `resolvePdfFontSet` finds the files; `familyPreference` / `scriptOf` decide which family draws a
 * character. Both are pure enough to be unit-tested with an injected `exists` function.
 */
import fs from 'node:fs';
import path from 'node:path';
import { localeDef, t, type Locale } from '@shared/i18n';
import { ApiError } from '../errors';
import { bundleDir } from '../util/paths';

/** One font file; `family` is the PostScript name of the face inside a `.ttc` collection. */
export interface FontFace {
  file: string;
  family?: string;
}

export interface FontFamily {
  regular: FontFace;
  bold: FontFace;
}

export type FontFamilyKey = 'latin' | 'arabic' | 'devanagari' | 'thai' | 'cjkZh' | 'cjkJa';

/** Everything the PDF writer may draw with. `latin` (DejaVu Sans) is mandatory, the rest optional. */
export type PdfFontSet = { latin: FontFamily } & Partial<Record<Exclude<FontFamilyKey, 'latin'>, FontFamily>>;

/** Legacy pair (DejaVu regular + bold) still returned by `resolvePdfFonts`. */
export interface PdfFonts {
  regular: string;
  bold: string;
}

export const BUNDLED_FONT_FILES: Record<'latin' | 'arabic' | 'devanagari' | 'thai', { regular: string; bold: string }> = {
  latin: { regular: 'DejaVuSans.ttf', bold: 'DejaVuSans-Bold.ttf' },
  arabic: { regular: 'NotoSansArabic-Regular.ttf', bold: 'NotoSansArabic-Bold.ttf' },
  devanagari: { regular: 'NotoSansDevanagari-Regular.ttf', bold: 'NotoSansDevanagari-Bold.ttf' },
  thai: { regular: 'NotoSansThai-Regular.ttf', bold: 'NotoSansThai-Bold.ttf' },
};

/** Licence texts that must ship next to the font files. */
export const FONT_LICENCE_FILES = ['LICENSE-DejaVu.txt', 'OFL-NotoSansArabic.txt', 'OFL-NotoSansDevanagari.txt', 'OFL-NotoSansThai.txt'];

/** System font candidates of one platform for Chinese / Japanese, in order of preference. */
export type SystemCjkFontTable = Record<'cjkZh' | 'cjkJa', Array<{ regular: FontFace; bold?: FontFace }>>;

/** Windows font collections tried for Chinese / Japanese, in order of preference. */
export const SYSTEM_CJK_FONTS: SystemCjkFontTable = {
  cjkZh: [
    { regular: { file: 'msyh.ttc', family: 'MicrosoftYaHei' }, bold: { file: 'msyhbd.ttc', family: 'MicrosoftYaHei-Bold' } },
    { regular: { file: 'simsun.ttc', family: 'SimSun' } },
  ],
  cjkJa: [
    { regular: { file: 'YuGothM.ttc', family: 'YuGothic-Medium' }, bold: { file: 'YuGothB.ttc', family: 'YuGothic-Bold' } },
    { regular: { file: 'meiryo.ttc', family: 'Meiryo' }, bold: { file: 'meiryob.ttc', family: 'Meiryo-Bold' } },
    { regular: { file: 'msgothic.ttc', family: 'MS-Gothic' } },
  ],
};

/** Where Android keeps its system fonts (readable by every app). */
export const ANDROID_SYSTEM_FONTS_DIR = '/system/fonts';

/**
 * Android system fonts tried for Chinese / Japanese, in order of preference. Android ships no bold
 * CJK face, so headings use the regular one.
 *   NotoSansCJK-Regular.ttc   Android 7+: one collection with the Simplified Chinese / Japanese /
 *                             Korean / Traditional Chinese faces, picked by PostScript name
 *   NotoSansSC / NotoSansJP   Android 6 (one .otf per language)
 *   NotoSansHans              Android 5
 *   DroidSansFallback.ttf     older devices and some vendor builds (Han + kana in one face)
 */
export const ANDROID_CJK_FONTS: SystemCjkFontTable = {
  cjkZh: [
    { regular: { file: 'NotoSansCJK-Regular.ttc', family: 'NotoSansCJKsc-Regular' } },
    { regular: { file: 'NotoSansSC-Regular.otf' } },
    { regular: { file: 'NotoSansHans-Regular.otf' } },
    { regular: { file: 'DroidSansFallback.ttf' } },
  ],
  cjkJa: [
    { regular: { file: 'NotoSansCJK-Regular.ttc', family: 'NotoSansCJKjp-Regular' } },
    { regular: { file: 'NotoSansJP-Regular.otf' } },
    { regular: { file: 'DroidSansFallback.ttf' } },
  ],
};

/**
 * The system CJK font table of `platform`: the Android table on Android only - never on Windows,
 * where (as on every other platform) the Windows collections are the ones looked up.
 */
export function systemCjkFonts(platform: NodeJS.Platform = process.platform): SystemCjkFontTable {
  return platform === 'android' ? ANDROID_CJK_FONTS : SYSTEM_CJK_FONTS;
}

/** Project checkout location used as a last resort in development. */
const DEV_FONTS_DIR = 'C:/Users/AVI/Projects/my-personal-diary/src-tauri/resources/server/fonts';

/** Directories searched for the bundled fonts, most specific first. */
export function fontDirCandidates(assetsDir: string): string[] {
  return [
    path.join(assetsDir, 'fonts'),
    assetsDir,
    path.resolve(bundleDir(), '..', '..', 'src-tauri', 'resources', 'server', 'fonts'),
    DEV_FONTS_DIR,
  ];
}

/**
 * `%WINDIR%\Fonts` on Windows, `/system/fonts` on Android, null elsewhere (no system CJK lookup on
 * other platforms).
 */
export function systemFontsDir(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): string | null {
  if (platform === 'android') return ANDROID_SYSTEM_FONTS_DIR;
  if (platform !== 'win32') return null;
  const windir = env.WINDIR || env.SystemRoot || 'C:\\Windows';
  return path.join(windir, 'Fonts');
}

export interface ResolveFontOptions {
  /** File-existence probe (tests inject a fake). Default: fs.existsSync. */
  exists?: (file: string) => boolean;
  /** Directory of the system fonts; null disables the CJK lookup. Default: `systemFontsDir()` of the platform. */
  systemFontsDir?: string | null;
  /** Platform whose system font directory and CJK table are used (tests inject one). Default: process.platform. */
  platform?: NodeJS.Platform;
}

/** Existing-file probe that never throws. */
function defaultExists(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * Locates DejaVuSans.ttf / DejaVuSans-Bold.ttf (legacy API, kept for callers that only need
 * Latin/Hebrew). Throws an EXPORT error when the regular font cannot be found; a missing bold
 * face falls back to the regular one.
 */
export function resolvePdfFonts(assetsDir: string, options: ResolveFontOptions = {}): PdfFonts {
  const latin = resolveBundledFamily('latin', assetsDir, options.exists ?? defaultExists);
  if (!latin) throw ApiError.exportErr('server.export.error.fontMissing');
  return { regular: latin.regular.file, bold: latin.bold.file };
}

function resolveBundledFamily(
  key: keyof typeof BUNDLED_FONT_FILES,
  assetsDir: string,
  exists: (file: string) => boolean,
): FontFamily | null {
  const names = BUNDLED_FONT_FILES[key];
  for (const dir of fontDirCandidates(assetsDir)) {
    const regular = path.join(dir, names.regular);
    if (exists(regular)) {
      const bold = path.join(dir, names.bold);
      return { regular: { file: regular }, bold: { file: exists(bold) ? bold : regular } };
    }
  }
  return null;
}

/** `dir` + `file` in the path style of `platform` (Android paths use '/' also when resolved on a Windows host). */
function systemFontPath(dir: string, file: string, platform: NodeJS.Platform): string {
  return platform === 'android' ? `${dir.replace(/\/+$/, '')}/${file}` : path.join(dir, file);
}

function resolveSystemFamily(
  key: 'cjkZh' | 'cjkJa',
  dir: string,
  exists: (file: string) => boolean,
  platform: NodeJS.Platform,
): FontFamily | null {
  for (const candidate of systemCjkFonts(platform)[key]) {
    const regularFile = systemFontPath(dir, candidate.regular.file, platform);
    if (!exists(regularFile)) continue;
    const regular: FontFace = { file: regularFile, family: candidate.regular.family };
    let bold: FontFace = regular;
    if (candidate.bold) {
      const boldFile = systemFontPath(dir, candidate.bold.file, platform);
      if (exists(boldFile)) bold = { file: boldFile, family: candidate.bold.family };
    }
    return { regular, bold };
  }
  return null;
}

/**
 * Resolves every font family the PDF writer can use. DejaVu Sans is mandatory (EXPORT error when
 * missing); the Noto families are looked up in the same candidate directories and the CJK
 * families in the system fonts folder of the platform (Windows / Android). Absent families are simply left out and the writer falls
 * back to DejaVu Sans for their scripts.
 */
export function resolvePdfFontSet(assetsDir: string, options: ResolveFontOptions = {}): PdfFontSet {
  const exists = options.exists ?? defaultExists;
  const latin = resolveBundledFamily('latin', assetsDir, exists);
  if (!latin) throw ApiError.exportErr('server.export.error.fontMissing');
  const set: PdfFontSet = { latin };
  for (const key of ['arabic', 'devanagari', 'thai'] as const) {
    const family = resolveBundledFamily(key, assetsDir, exists);
    if (family) set[key] = family;
  }
  const platform = options.platform ?? process.platform;
  const sysDir = options.systemFontsDir === undefined ? systemFontsDir(process.env, platform) : options.systemFontsDir;
  if (sysDir) {
    for (const key of ['cjkZh', 'cjkJa'] as const) {
      const family = resolveSystemFamily(key, sysDir, exists, platform);
      if (family) set[key] = family;
    }
  }
  return set;
}

// ---------------------------------------------------------------------------
// Script classification and family preference
// ---------------------------------------------------------------------------

export type CharScript = 'latin' | 'hebrew' | 'arabic' | 'devanagari' | 'thai' | 'han' | 'kana' | 'hangul' | 'common';

const SCRIPT_TESTS: Array<[CharScript, RegExp]> = [
  ['hebrew', /\p{Script=Hebrew}/u],
  ['arabic', /\p{Script=Arabic}/u],
  ['devanagari', /\p{Script=Devanagari}/u],
  ['thai', /\p{Script=Thai}/u],
  ['han', /\p{Script=Han}/u],
  ['kana', /[\p{Script=Hiragana}\p{Script=Katakana}]/u],
  ['hangul', /\p{Script=Hangul}/u],
  // Punctuation, digits, spaces, symbols and combining marks (Arabic harakat are Inherited):
  // they take the font of the letters around them.
  ['common', /[\p{Script=Common}\p{Script=Inherited}\s]/u],
];

const scriptCache = new Map<number, CharScript>();

/** Script family of one code point (see `CharScript`); everything unlisted counts as Latin. */
export function scriptOf(codePoint: number): CharScript {
  let script = scriptCache.get(codePoint);
  if (script) return script;
  const ch = String.fromCodePoint(codePoint);
  script = 'latin';
  for (const [name, re] of SCRIPT_TESTS) {
    if (re.test(ch)) {
      script = name;
      break;
    }
  }
  scriptCache.set(codePoint, script);
  return script;
}

/** True for scripts written right-to-left (they need shaping-aware, whole-run layout). */
export function isRtlScript(script: CharScript): boolean {
  return script === 'hebrew' || script === 'arabic';
}

/**
 * Font families to try for a script, best first. The PDF writer walks the list, skips families
 * that are not installed and families whose font lacks the glyph, and ends at DejaVu Sans.
 * Japanese text prefers the Japanese font (kana only exist there in a Japanese design); Han
 * characters follow the document language (Japanese UI -> Yu Gothic, otherwise Microsoft YaHei).
 */
export function familyPreference(script: CharScript, locale: Locale): FontFamilyKey[] {
  switch (script) {
    case 'arabic':
      return ['arabic', 'latin'];
    case 'devanagari':
      return ['devanagari', 'latin'];
    case 'thai':
      return ['thai', 'latin'];
    case 'kana':
      return ['cjkJa', 'cjkZh', 'latin'];
    case 'han':
    case 'hangul':
      return locale === 'ja' ? ['cjkJa', 'cjkZh', 'latin'] : ['cjkZh', 'cjkJa', 'latin'];
    default:
      return ['latin'];
  }
}

/**
 * Note lines appended to the PDF when the document language needs a system font that is not
 * installed (Chinese / Japanese), rendered in the document language.
 */
export function fontFallbackNotes(fonts: PdfFontSet, locale: Locale): string[] {
  const notes: string[] = [];
  const cjkMissing = !fonts.cjkZh && !fonts.cjkJa;
  if ((locale === 'zh' || locale === 'ja') && cjkMissing) {
    notes.push(t(locale, 'server.export.fontFallbackNote', { language: localeDef(locale).englishName }));
  }
  return notes;
}

/** All faces of a font set (for existence checks / logging). */
export function fontFaces(fonts: PdfFontSet): Array<{ family: FontFamilyKey; weight: 'regular' | 'bold'; face: FontFace }> {
  const out: Array<{ family: FontFamilyKey; weight: 'regular' | 'bold'; face: FontFace }> = [];
  for (const family of Object.keys(fonts) as FontFamilyKey[]) {
    const fam = fonts[family];
    if (!fam) continue;
    out.push({ family, weight: 'regular', face: fam.regular });
    out.push({ family, weight: 'bold', face: fam.bold });
  }
  return out;
}
