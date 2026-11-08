/**
 * System CJK fonts per platform (export/fonts.ts): Windows keeps its font collections
 * (Microsoft YaHei / Yu Gothic in %WINDIR%\Fonts), Android gets its own table
 * (/system/fonts/NotoSansCJK-Regular.ttc with older fallbacks) - selected only when the platform is
 * 'android', so nothing changes on the desktop. Everything runs with a fake platform and a fake
 * file-existence probe; no real font is opened.
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ANDROID_CJK_FONTS,
  ANDROID_SYSTEM_FONTS_DIR,
  BUNDLED_FONT_FILES,
  familyPreference,
  fontFallbackNotes,
  resolvePdfFontSet,
  SYSTEM_CJK_FONTS,
  systemCjkFonts,
  systemFontsDir,
} from '../src/export/fonts';

const ASSETS = path.join('X:', 'assets');
const BUNDLED = new Set(
  Object.values(BUNDLED_FONT_FILES).flatMap((f) => [path.join(ASSETS, 'fonts', f.regular), path.join(ASSETS, 'fonts', f.bold)]),
);

/** A probe that knows the bundled fonts plus `systemFiles`, and records what was asked. */
function probe(systemFiles: string[]) {
  const asked: string[] = [];
  const present = new Set([...BUNDLED, ...systemFiles]);
  return {
    asked,
    exists: (file: string) => {
      asked.push(file);
      return present.has(file);
    },
  };
}

describe('system font directory and table per platform', () => {
  it('Windows: %WINDIR%\\Fonts and the Windows collections (unchanged)', () => {
    expect(systemFontsDir({ WINDIR: 'D:\\Win' }, 'win32')).toBe(path.join('D:\\Win', 'Fonts'));
    expect(systemFontsDir({ SystemRoot: 'E:\\W' }, 'win32')).toBe(path.join('E:\\W', 'Fonts'));
    expect(systemFontsDir({}, 'win32')).toBe(path.join('C:\\Windows', 'Fonts'));
    expect(systemCjkFonts('win32')).toBe(SYSTEM_CJK_FONTS);
    expect(SYSTEM_CJK_FONTS.cjkZh[0].regular).toEqual({ file: 'msyh.ttc', family: 'MicrosoftYaHei' });
    expect(SYSTEM_CJK_FONTS.cjkJa[0].regular).toEqual({ file: 'YuGothM.ttc', family: 'YuGothic-Medium' });
  });

  it('Android: /system/fonts and the Android table', () => {
    expect(ANDROID_SYSTEM_FONTS_DIR).toBe('/system/fonts');
    expect(systemFontsDir({}, 'android')).toBe('/system/fonts');
    // The Windows variables mean nothing there.
    expect(systemFontsDir({ WINDIR: 'C:\\Windows' }, 'android')).toBe('/system/fonts');
    expect(systemCjkFonts('android')).toBe(ANDROID_CJK_FONTS);
    expect(ANDROID_CJK_FONTS.cjkZh[0].regular).toEqual({ file: 'NotoSansCJK-Regular.ttc', family: 'NotoSansCJKsc-Regular' });
    expect(ANDROID_CJK_FONTS.cjkJa[0].regular).toEqual({ file: 'NotoSansCJK-Regular.ttc', family: 'NotoSansCJKjp-Regular' });
  });

  it('every other platform: no system directory, and never the Android table', () => {
    for (const platform of ['linux', 'darwin', 'freebsd'] as const) {
      expect(systemFontsDir({ WINDIR: 'C:\\Windows' }, platform)).toBeNull();
      expect(systemCjkFonts(platform)).toBe(SYSTEM_CJK_FONTS);
    }
  });

  it('the Android table shares no file name with the Windows one', () => {
    const files = (table: typeof SYSTEM_CJK_FONTS) =>
      [...table.cjkZh, ...table.cjkJa].flatMap((c) => [c.regular.file, ...(c.bold ? [c.bold.file] : [])]).map((f) => f.toLowerCase());
    const windows = new Set(files(SYSTEM_CJK_FONTS));
    expect(files(ANDROID_CJK_FONTS).filter((f) => windows.has(f))).toEqual([]);
  });
});

describe('resolvePdfFontSet with a fake platform', () => {
  it('Android 7+: both CJK families come from NotoSansCJK-Regular.ttc, each with its own face', () => {
    const { exists, asked } = probe(['/system/fonts/NotoSansCJK-Regular.ttc']);
    const set = resolvePdfFontSet(ASSETS, { exists, platform: 'android' });
    const zh = { file: '/system/fonts/NotoSansCJK-Regular.ttc', family: 'NotoSansCJKsc-Regular' };
    const ja = { file: '/system/fonts/NotoSansCJK-Regular.ttc', family: 'NotoSansCJKjp-Regular' };
    // No bold CJK face on Android: the regular one is used for both weights.
    expect(set.cjkZh).toEqual({ regular: zh, bold: zh });
    expect(set.cjkJa).toEqual({ regular: ja, bold: ja });
    expect(set.latin.regular.file).toBe(path.join(ASSETS, 'fonts', 'DejaVuSans.ttf'));
    expect(set.arabic && set.devanagari && set.thai).toBeTruthy();
    // Nothing of Windows was looked for.
    expect(asked.filter((f) => /msyh|simsun|YuGoth|meiryo|msgothic/i.test(f))).toEqual([]);
    expect(asked.filter((f) => f.startsWith('/system/fonts/')).length).toBeGreaterThan(0);
  });

  it('older Android: falls back through the table in order', () => {
    const android6 = resolvePdfFontSet(ASSETS, {
      ...probe(['/system/fonts/NotoSansSC-Regular.otf', '/system/fonts/NotoSansJP-Regular.otf', '/system/fonts/DroidSansFallback.ttf']),
      platform: 'android',
    });
    expect(android6.cjkZh?.regular).toEqual({ file: '/system/fonts/NotoSansSC-Regular.otf', family: undefined });
    expect(android6.cjkJa?.regular).toEqual({ file: '/system/fonts/NotoSansJP-Regular.otf', family: undefined });

    const android5 = resolvePdfFontSet(ASSETS, { ...probe(['/system/fonts/NotoSansHans-Regular.otf']), platform: 'android' });
    expect(android5.cjkZh?.regular.file).toBe('/system/fonts/NotoSansHans-Regular.otf');
    expect(android5.cjkJa).toBeUndefined();

    const droid = resolvePdfFontSet(ASSETS, { ...probe(['/system/fonts/DroidSansFallback.ttf']), platform: 'android' });
    expect(droid.cjkZh?.regular.file).toBe('/system/fonts/DroidSansFallback.ttf');
    expect(droid.cjkJa?.regular.file).toBe('/system/fonts/DroidSansFallback.ttf');
    expect(droid.cjkJa?.bold).toEqual(droid.cjkJa?.regular);
  });

  it('Android without any CJK font: DejaVu only, with the note for Chinese / Japanese documents', () => {
    const set = resolvePdfFontSet(ASSETS, { ...probe([]), platform: 'android' });
    expect(set.cjkZh).toBeUndefined();
    expect(set.cjkJa).toBeUndefined();
    expect(fontFallbackNotes(set, 'zh')).toHaveLength(1);
    expect(fontFallbackNotes(set, 'ja')).toHaveLength(1);
    expect(fontFallbackNotes(set, 'he')).toEqual([]);
    // The family order of a script does not depend on the platform.
    expect(familyPreference('han', 'ja')).toEqual(['cjkJa', 'cjkZh', 'latin']);
    expect(familyPreference('han', 'zh')).toEqual(['cjkZh', 'cjkJa', 'latin']);
  });

  it('an explicit systemFontsDir is honoured on Android too (with "/" separators)', () => {
    const set = resolvePdfFontSet(ASSETS, { ...probe(['/vendor/fonts/NotoSansCJK-Regular.ttc']), platform: 'android', systemFontsDir: '/vendor/fonts/' });
    expect(set.cjkZh?.regular.file).toBe('/vendor/fonts/NotoSansCJK-Regular.ttc');
    expect(resolvePdfFontSet(ASSETS, { ...probe(['/system/fonts/NotoSansCJK-Regular.ttc']), platform: 'android', systemFontsDir: null }).cjkZh).toBeUndefined();
  });

  it('Windows never uses the Android table - even when files with those names exist in its fonts folder', () => {
    const winFonts = path.join('C:\\Windows', 'Fonts');
    const { exists, asked } = probe([
      path.join(winFonts, 'NotoSansCJK-Regular.ttc'),
      path.join(winFonts, 'DroidSansFallback.ttf'),
      '/system/fonts/NotoSansCJK-Regular.ttc',
    ]);
    const set = resolvePdfFontSet(ASSETS, { exists, platform: 'win32', systemFontsDir: winFonts });
    expect(set.cjkZh).toBeUndefined();
    expect(set.cjkJa).toBeUndefined();
    expect(asked.filter((f) => /NotoSansCJK|NotoSansSC|NotoSansJP|NotoSansHans|DroidSans|system[\\/]fonts/i.test(f))).toEqual([]);
    expect(asked).toContain(path.join(winFonts, 'msyh.ttc'));
  });

  it('Windows resolves its own collections exactly as before', () => {
    const winFonts = path.join('C:\\Windows', 'Fonts');
    const set = resolvePdfFontSet(ASSETS, {
      ...probe(['msyh.ttc', 'msyhbd.ttc', 'YuGothM.ttc'].map((f) => path.join(winFonts, f))),
      platform: 'win32',
      systemFontsDir: winFonts,
    });
    expect(set.cjkZh).toEqual({
      regular: { file: path.join(winFonts, 'msyh.ttc'), family: 'MicrosoftYaHei' },
      bold: { file: path.join(winFonts, 'msyhbd.ttc'), family: 'MicrosoftYaHei-Bold' },
    });
    const yu = { file: path.join(winFonts, 'YuGothM.ttc'), family: 'YuGothic-Medium' };
    expect(set.cjkJa).toEqual({ regular: yu, bold: yu });
  });

  it('the default platform is the real one: on this (non-Android) host the Android table is unreachable', () => {
    expect(process.platform).not.toBe('android');
    const { exists, asked } = probe(['/system/fonts/NotoSansCJK-Regular.ttc']);
    resolvePdfFontSet(ASSETS, { exists });
    expect(asked.filter((f) => /NotoSansCJK|DroidSans|NotoSansSC|NotoSansJP|NotoSansHans/.test(f))).toEqual([]);
  });
});
