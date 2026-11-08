/**
 * The PDF export draws every script correctly: right-to-left lines come out in visual order
 * (not reversed twice), Arabic is joined, and no language falls back to empty boxes (.notdef).
 *
 * Every `doc.text()` call is captured and laid out again with the same fontkit font pdfkit uses,
 * so the test sees the glyphs exactly as they end up on the page.
 */
import PDFDocument from 'pdfkit';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { LOCALE_CODES, type Locale } from '@shared/i18n';
import type { UserProfile } from '@shared/types';
import { DiaryDb } from '../src/db/database';
import { collectExportData } from '../src/export/index';
import { resolvePdfFontSet } from '../src/export/fonts';
import { exportPdf } from '../src/export/pdf';
import { toVisual } from '../src/export/rtl';
import { toUserProfile } from '../src/security/session-types';
import { insertEntry } from './export-fixtures.test';
import { TEST_ACCOUNT, cleanupTempDirs, testConfig } from './helpers';

interface Glyph {
  id: number;
  name: string;
  codePoints: number[];
}
interface FontkitFont {
  postscriptName: string;
  layout(text: string): { glyphs: Glyph[]; direction: 'ltr' | 'rtl' };
}
/** pdfkit's EmbeddedFont: `layout` is the exact path `doc.text()` takes (word by word without features). */
interface EmbeddedFont {
  font: FontkitFont;
  layout(text: string, features?: unknown): { glyphs: Glyph[] };
}
interface Drawn {
  str: string;
  x: number;
  y: number;
  page: unknown;
  font: FontkitFont;
  embedded: EmbeddedFont;
  features: unknown;
}

const user: UserProfile = toUserProfile(TEST_ACCOUNT);
const assetsDir = testConfig().assetsDir;

const ARABIC_LETTER = /\p{Script=Arabic}/u;
const HE_BODY ='בדיקה של 123 (טקסט)';
const AR_BODY = 'مرحبا بك 42 (نص)';
const JA_BODY = '今日はとても疲れた。';
const ZH_BODY = '今天很累。';
const HI_BODY = 'आज मैं थका हुआ था';
const TH_BODY = 'วันนี้เหนื่อยมาก';
const EN_BODY = 'An ordinary day, no surprises.';

type TextFn = (this: PDFKit.PDFDocument, ...args: unknown[]) => PDFKit.PDFDocument;
const proto = PDFDocument.prototype as unknown as { text: TextFn };
const originalText = proto.text;
let drawn: Drawn[] = [];

function startCapture(): void {
  drawn = [];
  proto.text = function (this: PDFKit.PDFDocument, ...args: unknown[]) {
    const self = this as unknown as { _font: EmbeddedFont; page: unknown };
    const options = (args[3] ?? {}) as { features?: unknown };
    drawn.push({
      str: String(args[0]),
      x: Number(args[1]),
      y: Number(args[2]),
      page: self.page,
      font: self._font.font,
      embedded: self._font,
      features: options.features,
    });
    return originalText.apply(this, args);
  };
}

afterEach(() => {
  proto.text = originalText;
});

/** pdfkit's word chunks: split after every space or tab (the separator stays with the chunk before it). */
function pdfkitChunks(text: string): string[] {
  return text.match(/[^ \t]*[ \t]|[^ \t]+$/g) ?? [];
}

/**
 * Visual lines as drawn: pieces grouped by page and baseline, ordered left to right. With
 * `glyphs` the characters come from the glyphs pdfkit itself laid out (exact for unshaped
 * scripts such as Hebrew); otherwise every unit pdfkit lays out (the whole piece when features
 * are given, else each word chunk) is reversed when fontkit lays it out right-to-left (needed for
 * Arabic, whose substituted glyphs report the code points of their base shapes).
 */
function visualLines(calls: Drawn[], mode: 'glyphs' | 'direction' = 'direction'): string[] {
  const pages = new Map<unknown, number>();
  const lines = new Map<string, Drawn[]>();
  for (const call of calls) {
    if (!pages.has(call.page)) pages.set(call.page, pages.size);
    const key = `${pages.get(call.page)}:${call.y.toFixed(2)}`;
    lines.set(key, [...(lines.get(key) ?? []), call]);
  }
  return [...lines.values()].map((pieces) =>
    pieces
      .sort((a, b) => a.x - b.x)
      .map((p) => {
        if (mode === 'glyphs') {
          const glyphs = p.embedded.layout(p.str, p.features).glyphs;
          return glyphs.flatMap((g) => g.codePoints).map((cp) => String.fromCodePoint(cp)).join('');
        }
        const units = p.features ? [p.str] : pdfkitChunks(p.str);
        return units
          .map((u) => (p.font.layout(u).direction === 'rtl' ? Array.from(u).reverse().join('') : u))
          .join('');
      })
      .join(''),
  );
}

function notdefs(calls: Drawn[]): string[] {
  return calls.filter((c) => c.font.layout(c.str).glyphs.some((g) => g.id === 0)).map((c) => c.str);
}

function fontsFor(calls: Drawn[], pattern: RegExp): string[] {
  return [...new Set(calls.filter((c) => pattern.test(c.str)).map((c) => c.font.postscriptName))];
}

async function exportIn(db: DiaryDb, locale: Locale): Promise<Drawn[]> {
  startCapture();
  const pdf = await exportPdf(collectExportData(db, { format: 'pdf', includeHabits: true }, user, locale), assetsDir);
  proto.text = originalText;
  expect(pdf.toString('latin1').startsWith('%PDF-1')).toBe(true);
  return drawn;
}

describe('PDF export scripts', () => {
  let db: DiaryDb;
  const cjk = resolvePdfFontSet(assetsDir);

  beforeAll(async () => {
    db = await DiaryDb.create();
    insertEntry(db, { date: '2026-09-01', title: 'שלום', body: HE_BODY, mood: 7, tags: ['עבודה'] });
    insertEntry(db, { date: '2026-09-02', title: 'مرحبا', body: AR_BODY, mood: 6, emotions: ['happy'] });
    insertEntry(db, { date: '2026-09-03', title: '日記', body: JA_BODY, energy: 5 });
    insertEntry(db, { date: '2026-09-04', title: '日记', body: ZH_BODY });
    insertEntry(db, { date: '2026-09-05', title: 'डायरी', body: HI_BODY });
    insertEntry(db, { date: '2026-09-06', title: 'บันทึก', body: TH_BODY, sleepHours: 7.5 });
    insertEntry(db, { date: '2026-09-07', title: 'Plain', body: EN_BODY });
  });
  afterAll(() => {
    db.close();
    cleanupTempDirs();
  });

  it('draws Hebrew lines in visual order in a Hebrew export', async () => {
    const lines = visualLines(await exportIn(db, 'he'), 'glyphs');
    expect(lines).toContain(toVisual(HE_BODY, 'rtl'));
    // The logical order would mean fontkit reversed an already reversed line.
    expect(lines).not.toContain(HE_BODY);
  });

  it('draws Arabic joined, in visual order and with the Arabic font', async () => {
    const calls = await exportIn(db, 'ar');
    expect(visualLines(calls)).toContain(toVisual(AR_BODY, 'rtl'));
    const notNoto = calls
      .filter((c) => ARABIC_LETTER.test(c.str) && !/^NotoSansArabic-(Regular|Bold)$/.test(c.font.postscriptName))
      .map((c) => `${c.font.postscriptName}: ${c.str}`);
    expect(notNoto).toEqual([]);
    const arabicGlyphs = calls
      .filter((c) => ARABIC_LETTER.test(c.str))
      .flatMap((c) => c.font.layout(c.str).glyphs.map((g) => g.name));
    expect(arabicGlyphs.some((n) => /\.(init|medi|fina)$/.test(n))).toBe(true);
  });

  it('gives user paragraphs the direction of their first letter, whatever the export language', async () => {
    const lines = visualLines(await exportIn(db, 'en'));
    expect(lines).toContain(toVisual(HE_BODY, 'rtl'));
    expect(lines).toContain(toVisual(AR_BODY, 'rtl'));
    // An English entry in a Hebrew export keeps its full stop at the end of the sentence.
    expect(visualLines(await exportIn(db, 'he'))).toContain(EN_BODY);
  });

  it.runIf(Boolean(cjk.cjkJa))('draws Japanese with a Japanese system font', async () => {
    const calls = await exportIn(db, 'ja');
    expect(visualLines(calls)).toContain(JA_BODY);
    expect(fontsFor(calls, /[぀-ヿ]/u).every((name) => /YuGothic|Meiryo|MS-Gothic/.test(name))).toBe(true);
  });

  it.runIf(Boolean(cjk.cjkZh))('draws Chinese with a Chinese system font', async () => {
    const calls = await exportIn(db, 'zh');
    expect(visualLines(calls)).toContain(ZH_BODY);
    expect(fontsFor(calls, /今天很累/u).every((name) => /MicrosoftYaHei|SimSun/.test(name))).toBe(true);
  });

  it('uses the bundled Devanagari and Thai fonts', async () => {
    const hi = fontsFor(await exportIn(db, 'hi'), /[ऀ-ॿ]/u);
    expect(hi.length > 0 && hi.every((name) => /^NotoSansDevanagari-(Regular|Bold)$/.test(name))).toBe(true);
    const th = fontsFor(await exportIn(db, 'th'), /[฀-๿]/u);
    expect(th.length > 0 && th.every((name) => /^NotoSansThai-(Regular|Bold)$/.test(name))).toBe(true);
  });

  it('never draws an empty box (.notdef) in any language', async () => {
    const missing: string[] = [];
    for (const locale of LOCALE_CODES) {
      // Without the Windows CJK fonts, Chinese and Japanese fall back to boxes plus a note line.
      if (!cjk.cjkJa && !cjk.cjkZh) break;
      for (const str of notdefs(await exportIn(db, locale))) missing.push(`${locale}: ${str}`);
    }
    expect(missing).toEqual([]);
  }, 120_000);

  it('keeps the punctuation of user text at its own end inside labelled lines', async () => {
    const mixed = await DiaryDb.create();
    const heNote = 'לזכור להתקשר לדנה.';
    // Long enough to wrap: every line of the note, not only the first, is laid out right-to-left.
    const longHeNote = Array.from({ length: 14 }, () => 'מילה ועוד מילה').join(' ') + ' סוף.';
    insertEntry(mixed, { date: '2026-09-01', title: 'What a day!', body: 'x', location: 'Home (upstairs).', notes: 'Remember to call Dana.' });
    insertEntry(mixed, { date: '2026-09-02', title: 'איזה יום!', body: 'x', notes: heNote });
    insertEntry(mixed, { date: '2026-09-03', title: 'Long', body: 'x', notes: longHeNote });
    const reversed = (s: string) => Array.from(s).reverse().join('');
    const linesIn = async (locale: Locale) => {
      startCapture();
      await exportPdf(collectExportData(mixed, { format: 'pdf' }, user, locale), assetsDir);
      proto.text = originalText;
      return visualLines(drawn, 'glyphs');
    };

    // Hebrew export: the English note, location and title keep "." / "!" at the end of the Latin run.
    const he = await linesIn('he');
    expect(he.some((l) => l.startsWith('Remember to call Dana.'))).toBe(true);
    expect(he.some((l) => l.startsWith('Home (upstairs).'))).toBe(true);
    expect(he.some((l) => l.startsWith('What a day!'))).toBe(true);
    // (Without the isolate the line would read ".Remember to call Dana".)
    expect(he.filter((l) => /^[.!] ?[A-Za-z]/.test(l))).toEqual([]);

    // English export: the Hebrew note ends with its full stop at the left end of the Hebrew run.
    const en = await linesIn('en');
    expect(en).toContain(`Notes: ${reversed(heNote)}`);
    expect(en.some((l) => l.endsWith(reversed('איזה יום!')))).toBe(true);
    // The wrapped note: its last line holds only Hebrew and starts (at the left) with the full stop;
    // laid out left-to-right it would end with it ("...ףוס.").
    expect(en.some((l) => l.startsWith(reversed('סוף.')))).toBe(true);
    expect(en.some((l) => l.endsWith(`${reversed('סוף')}.`))).toBe(false);
    mixed.close();
  });

  it('embeds only the fonts the document needs', async () => {
    const plain = await DiaryDb.create();
    insertEntry(plain, { date: '2026-09-01', title: 'Plain', body: 'Only Latin text here.' });
    const pdf = await exportPdf(collectExportData(plain, { format: 'pdf' }, user, 'en'), assetsDir);
    const text = pdf.toString('latin1');
    expect(text).toContain('DejaVuSans');
    expect(text).not.toMatch(/NotoSans|YuGothic|MicrosoftYaHei/);
    plain.close();
  });
});
