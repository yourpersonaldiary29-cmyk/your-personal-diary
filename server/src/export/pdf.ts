/**
 * PDF export in the export language, for every supported script.
 *
 * pdfkit cannot reorder bidirectional text and draws one font per `text()` call, so the writer
 * below does its own line layout:
 *
 *   1. Every paragraph is wrapped by `wrapLine` (rtl.ts), measured with the fonts the text will
 *      actually be drawn with (`FontRouter.measure`); Thai and CJK break at Intl.Segmenter words.
 *   2. Each line is split into directional runs in VISUAL order (`bidiRuns`, brackets mirrored).
 *   3. Each run is split into font runs (`FontRouter.segments`): DejaVu Sans for Latin, Greek,
 *      Cyrillic and Hebrew; Noto Sans Arabic / Devanagari / Thai; Yu Gothic / Microsoft YaHei
 *      from Windows for Japanese / Chinese (see fonts.ts). Punctuation and digits stay with the
 *      letters around them when that font has the glyph, otherwise they fall back to DejaVu Sans.
 *   4. Font runs are drawn left to right at explicit positions (`lineBreak: false`, no `width`,
 *      so pdfkit never re-wraps a line or inserts page breaks of its own). Right-to-left runs are
 *      passed in LOGICAL order: fontkit shapes them (Arabic joining forms) and reverses their
 *      glyphs itself. Runs without letters (spaces, punctuation) are reversed here instead.
 *
 * Passing text that was already reversed (the old `toVisual` approach) makes fontkit reverse it a
 * second time, so every Hebrew/Arabic word came out backwards; DejaVu Sans alone drew CJK text as
 * empty boxes. Both are covered by server/test/export-pdf-scripts.test.ts.
 *
 * The document is created with `font: <DejaVuSans.ttf>` so pdfkit never touches its built-in
 * Helvetica AFM metrics (they are not shipped in the bundled build). Pages are buffered
 * (`bufferPages: true`) so the footer "Page X of Y" can be stamped once the total is known.
 */
import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import type { Entry, Habit } from '@shared/types';
import { ApiError, isApiError } from '../errors';
import type { ExportData } from './data';
import { directionOf, localeDef, t, type Locale, type TextDirection } from '@shared/i18n';
import {
  appName,
  dateWithWeekday,
  emotionsText,
  exerciseText,
  field,
  habitHeading,
  habitLogLine,
  label,
  listText,
  normalizeNewlines,
  ownerLabel,
  rangeLabel,
  ratingsLine,
  tagsText,
  timeText,
  timestampText,
} from './format';
import {
  familyPreference,
  fontFallbackNotes,
  resolvePdfFontSet,
  resolvePdfFonts,
  scriptOf,
  type FontFamilyKey,
  type PdfFontSet,
  type PdfFonts,
} from './fonts';
import {
  bidiRuns,
  firstStrongDirection,
  hasRtlLetters,
  isolate,
  openIsolates,
  reverseCodePoints,
  stripBidiMarks,
  wrapLine,
  type BaseDirection,
} from './rtl';

export { resolvePdfFonts, type PdfFonts };

type FontKind = 'regular' | 'bold';
type Align = 'right' | 'center' | 'left';

interface TextStyle {
  font?: FontKind;
  size?: number;
  align?: Align;
  /** Extra space (points) from the start edge (indentation of a nested block). */
  indent?: number;
  /** Extra vertical space after the block. */
  gapAfter?: number;
  /** Extra space between lines of the block. */
  lineGap?: number;
  color?: string;
  /**
   * User-written text: each paragraph takes its bidi direction from its first letter (like
   * dir="auto"), so an English entry in a Hebrew export keeps its full stop at the end.
   */
  autoDirection?: boolean;
}

const PAGE_MARGIN = 50;
const FOOTER_OFFSET = 14;
const COLORS = { text: '#000000', muted: '#333333', faint: '#555555', rule: '#b0b0b0', strongRule: '#606060' };

/** The part of a fontkit font the router needs (pdfkit keeps it as `_font.font`). */
interface GlyphSource {
  hasGlyphForCodePoint(codePoint: number): boolean;
}

/** A run of text drawn with one font family. */
interface FontRun {
  family: FontFamilyKey;
  text: string;
}

/**
 * Registers the families of a font set with pdfkit (on first use, so an English export never
 * embeds the Arabic or CJK fonts) and decides which family draws each character.
 */
class FontRouter {
  /** pdfkit name of every distinct face (file + collection member) registered so far. */
  private readonly faceNames = new Map<string, string>();
  private readonly glyphSources = new Map<string, GlyphSource | null>();
  private readonly familyCache = new Map<number, FontFamilyKey | null>();

  constructor(
    private readonly doc: PDFKit.PDFDocument,
    private readonly fonts: PdfFontSet,
    private readonly locale: Locale,
  ) {}

  /**
   * pdfkit name of a family's face, registering the font the first time it is needed.
   *
   * pdfkit caches a font under its name only when no font with the same PostScript name is loaded
   * yet; otherwise it re-reads and re-parses the file on EVERY `doc.font()` call (seconds per
   * page). So each distinct face gets exactly one name, and DejaVu Sans regular - the document's
   * default font, already cached under its file path - is used through that path.
   */
  fontName(family: FontFamilyKey, kind: FontKind): string {
    const key: FontFamilyKey = this.fonts[family] ? family : 'latin';
    const face = (this.fonts[key] ?? this.fonts.latin)[kind];
    const faceKey = `${face.file}|${face.family ?? ''}`;
    let name = this.faceNames.get(faceKey);
    if (!name) {
      if (face.file === this.fonts.latin.regular.file && !face.family) {
        name = face.file;
      } else {
        name = `${key}-${kind}`;
        if (face.family) this.doc.registerFont(name, face.file, face.family);
        else this.doc.registerFont(name, face.file);
      }
      this.faceNames.set(faceKey, name);
    }
    return name;
  }

  /** Activates a family's face on the document. */
  use(family: FontFamilyKey, kind: FontKind): void {
    this.doc.font(this.fontName(family, kind));
  }

  /** Whether the family's font has a glyph for the code point (true when it cannot be told). */
  hasGlyph(family: FontFamilyKey, codePoint: number): boolean {
    const name = this.fontName(family, 'regular');
    let source = this.glyphSources.get(name);
    if (source === undefined) {
      // Activating the font is the only public way to reach its fontkit object; callers always
      // set the font they draw or measure with afterwards.
      this.doc.font(name);
      const embedded = (this.doc as unknown as { _font?: { font?: Partial<GlyphSource> } })._font;
      source = typeof embedded?.font?.hasGlyphForCodePoint === 'function' ? (embedded.font as GlyphSource) : null;
      this.glyphSources.set(name, source);
    }
    return source ? source.hasGlyphForCodePoint(codePoint) : true;
  }

  /** Family for a letter, or null for punctuation, digits, spaces and marks (they join their neighbours). */
  private letterFamily(codePoint: number): FontFamilyKey | null {
    const cached = this.familyCache.get(codePoint);
    if (cached !== undefined) return cached;
    const script = scriptOf(codePoint);
    let family: FontFamilyKey | null = null;
    if (script !== 'common') {
      family = 'latin';
      for (const candidate of familyPreference(script, this.locale)) {
        if (!this.fonts[candidate]) continue;
        if (candidate === 'latin' || this.hasGlyph(candidate, codePoint)) {
          family = candidate;
          break;
        }
      }
    }
    this.familyCache.set(codePoint, family);
    return family;
  }

  /**
   * Family for a neutral character: the family of the letters next to it when that font has the
   * glyph (Noto Sans Arabic, for instance, has no parentheses or percent sign), else DejaVu Sans,
   * else any other font that has it ("。" alone in a run of a right-to-left line).
   */
  private neutralFamily(neighbour: FontFamilyKey | null, codePoint: number): FontFamilyKey {
    if (neighbour && neighbour !== 'latin' && this.hasGlyph(neighbour, codePoint)) return neighbour;
    if (this.hasGlyph('latin', codePoint)) return 'latin';
    for (const family of Object.keys(this.fonts) as FontFamilyKey[]) {
      if (family !== 'latin' && family !== neighbour && this.hasGlyph(family, codePoint)) return family;
    }
    return 'latin';
  }

  /** Splits LOGICAL text into runs of one font family; neutral characters join their neighbours. */
  segments(text: string): FontRun[] {
    const chars = Array.from(text);
    const families: Array<FontFamilyKey | null> = chars.map((ch) => this.letterFamily(ch.codePointAt(0) ?? 0));
    const runs: FontRun[] = [];
    let previous: FontFamilyKey | null = families.find((f): f is FontFamilyKey => f !== null) ?? null;
    chars.forEach((ch, i) => {
      let family = families[i];
      if (family === null) {
        family = this.neutralFamily(previous, ch.codePointAt(0) ?? 0);
      } else {
        previous = family;
      }
      const last = runs[runs.length - 1];
      if (last && last.family === family) last.text += ch;
      else runs.push({ family, text: ch });
    });
    return runs;
  }

  /** Width of LOGICAL text in points, measured with the fonts it will be drawn with. */
  measure(text: string, kind: FontKind): number {
    let width = 0;
    for (const run of this.segments(text)) {
      this.use(run.family, kind);
      width += this.doc.widthOfString(run.text);
    }
    return width;
  }
}

/**
 * pdfkit lays text out word by word (split at spaces) unless OpenType features are given; fontkit
 * then reverses each right-to-left WORD, which leaves the words of a Hebrew/Arabic run in logical
 * order ("הייצוא: תאריך"). An explicit (empty = default) feature list makes pdfkit lay out the
 * whole run at once, so fontkit reverses the run as a unit. Only drawing needs it: widths are the
 * same either way (nothing joins or kerns across a space), and measuring word by word keeps
 * pdfkit's per-word layout cache.
 */
function textOptions(text: string): { features?: PDFKit.Mixins.OpenTypeFeatures[] } {
  return hasRtlLetters(text) ? { features: [] } : {};
}

/** One piece of a line, ready to draw at the next x position. */
interface Piece {
  family: FontFamilyKey;
  text: string;
  width: number;
}

/** Cursor-based layout on top of a pdfkit document, right-to-left or left-to-right per locale. */
class PdfWriter {
  readonly doc: PDFKit.PDFDocument;
  readonly locale: Locale;
  private readonly router: FontRouter;
  private readonly dir: TextDirection;
  private kind: FontKind = 'regular';
  private size = 11;
  private y: number;
  private readonly top: number;
  private readonly left: number;
  private readonly right: number;
  private readonly bottom: number;
  private readonly contentWidth: number;

  constructor(doc: PDFKit.PDFDocument, locale: Locale, fonts: PdfFontSet) {
    this.doc = doc;
    this.locale = locale;
    this.router = new FontRouter(doc, fonts, locale);
    this.dir = directionOf(locale);
    const m = doc.page.margins;
    this.top = m.top;
    this.left = m.left;
    this.right = doc.page.width - m.right;
    this.bottom = doc.page.height - m.bottom;
    this.contentWidth = this.right - this.left;
    this.y = this.top;
  }

  /** True when nothing has been drawn on the current page yet. */
  atPageTop(): boolean {
    return this.y <= this.top;
  }

  /** Sets weight, size and colour; line heights are those of DejaVu Sans at that size. */
  setStyle(font: FontKind, size: number, color = COLORS.text): void {
    this.kind = font;
    this.size = size;
    this.router.use('latin', font);
    this.doc.fontSize(size).fillColor(color);
  }

  lineHeight(lineGap = 0): number {
    this.router.use('latin', this.kind);
    return this.doc.currentLineHeight(true) + lineGap;
  }

  /** Starts a new page when `height` points do not fit above the bottom margin. */
  ensureSpace(height: number): void {
    if (this.y + height > this.bottom) this.newPage();
  }

  newPage(): void {
    this.doc.addPage();
    this.y = this.top;
  }

  space(points: number): void {
    this.y += points;
  }

  /**
   * Draws a logical text block (may contain newlines). Each paragraph is wrapped to the content
   * width and every line is drawn in visual order, aligned to the locale's start edge by default.
   */
  text(logical: string, style: TextStyle = {}): void {
    const kind = style.font ?? 'regular';
    const size = style.size ?? 11;
    const align = style.align ?? (this.dir === 'rtl' ? 'right' : 'left');
    const indent = style.indent ?? 0;
    this.setStyle(kind, size, style.color ?? COLORS.text);
    const maxWidth = Math.max(20, this.contentWidth - indent);
    // Direction marks and isolates take part in the bidi resolution only: they are never drawn.
    const measure = (s: string) => this.router.measure(stripBidiMarks(s), kind);
    const lh = this.lineHeight(style.lineGap ?? 0);
    for (const paragraph of normalizeNewlines(logical).split('\n')) {
      const base: BaseDirection = (style.autoDirection && firstStrongDirection(paragraph)) || this.dir;
      // An isolate (user text inside a labelled line, see `isolate`) that is still open where the
      // paragraph wraps continues on the next line.
      let open = '';
      for (const wrapped of wrapLine(paragraph, maxWidth, measure)) {
        const line = open + wrapped;
        this.ensureSpace(lh);
        // addPage() keeps the current size and colour; fonts are set per piece.
        if (wrapped) this.drawLine(line, align, indent, this.y, base);
        this.y += lh;
        open = openIsolates(line);
      }
    }
    if (style.gapAfter) this.y += style.gapAfter;
  }

  /** Visual-order pieces of one logical line (see the file header). */
  private pieces(line: string, base: BaseDirection): Piece[] {
    const out: Piece[] = [];
    for (const run of bidiRuns(line, base)) {
      const segments = this.router.segments(run.text);
      if (run.rtl) segments.reverse();
      for (const seg of segments) {
        // fontkit reverses runs of right-to-left letters itself; a run of neutrals it would draw as is.
        const text = run.rtl && !hasRtlLetters(seg.text) ? reverseCodePoints(seg.text) : seg.text;
        this.router.use(seg.family, this.kind);
        out.push({ family: seg.family, text, width: this.doc.widthOfString(text) });
      }
    }
    return out;
  }

  private drawLine(line: string, align: Align, indent: number, y: number, base: BaseDirection = this.dir): void {
    const pieces = this.pieces(line, base);
    const total = pieces.reduce((sum, p) => sum + p.width, 0);
    let x: number;
    if (align === 'right') x = this.right - indent - total;
    else if (align === 'center') x = this.left + (this.contentWidth - total) / 2;
    else x = this.left + indent;
    // pdfkit puts the baseline at y + the CURRENT font's ascender; fonts differ (Noto Sans Arabic
    // is taller than DejaVu Sans), so every piece is drawn on DejaVu Sans' baseline instead.
    const baseline = -this.latinAscent();
    for (const piece of pieces) {
      this.router.use(piece.family, this.kind);
      this.doc.text(piece.text, x, y, { lineBreak: false, baseline, ...textOptions(piece.text) });
      x += piece.width;
    }
  }

  /** Ascent of DejaVu Sans at the current size, in points. */
  private latinAscent(): number {
    this.router.use('latin', this.kind);
    const font = (this.doc as unknown as { _font?: { ascender?: number } })._font;
    const ascender = typeof font?.ascender === 'number' ? font.ascender : 928; // DejaVu Sans, per 1000 em
    return (ascender / 1000) * this.size;
  }

  /** Thin horizontal rule. Skipped (page break instead) when it would not fit. */
  rule(color = COLORS.rule, width = 0.5): void {
    const height = 8;
    if (this.y + height > this.bottom) {
      this.newPage();
      return;
    }
    const yy = this.y + height / 2;
    this.doc.save();
    this.doc.moveTo(this.left, yy).lineTo(this.right, yy).lineWidth(width).strokeColor(color).stroke();
    this.doc.restore();
    this.y += height;
  }

  /** Stamps "Page X of Y" (in the export language) centred in the bottom margin of every buffered page. */
  stampFooters(): void {
    const range = this.doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      this.doc.switchToPage(range.start + i);
      this.setStyle('regular', 9, COLORS.faint);
      const y = this.doc.page.height - this.doc.page.margins.bottom + FOOTER_OFFSET;
      this.drawLine(t(this.locale, 'server.export.pageOfTotal', { page: i + 1, total: range.count }), 'center', 0, y);
    }
  }
}

function fullName(data: ExportData): string {
  return `${data.user.firstName} ${data.user.lastName}`.trim();
}

function writeHeader(w: PdfWriter, data: ExportData, notes: string[]): void {
  const locale = data.locale;
  w.text(appName(locale), { font: 'bold', size: 20, gapAfter: 6 });
  w.text(field(locale, 'name', ownerLabel(locale, data.user)), { size: 11 });
  w.text(field(locale, 'range', rangeLabel(locale, data.from, data.to)), { size: 11 });
  w.text(field(locale, 'exportedAt', timestampText(locale, data.exportedAt)), { size: 11 });
  w.text(field(locale, 'entryCount', data.entries.length), { size: 11, gapAfter: 6 });
  for (const note of notes) w.text(note, { size: 9.5, color: COLORS.faint, gapAfter: 4 });
  w.rule(COLORS.strongRule, 1);
  w.space(8);
}

/** Every line of a user-written text isolated on its own (a line break ends a bidi paragraph). */
function isolateLines(text: string): string {
  return text.split('\n').map(isolate).join('\n');
}

/**
 * Text the user wrote is isolated wherever it sits inside a line of the export language (title,
 * exercise type, events, people, location, notes, habit names and log notes): an English note in
 * a Hebrew export - or a Hebrew one in an English export - keeps its punctuation at its own end.
 * The entry body and habit descriptions are whole paragraphs and use `autoDirection` instead.
 */
function writeEntry(w: PdfWriter, entry: Entry): void {
  const locale = w.locale;
  // Keep the heading together with the ratings line and a couple of body lines.
  w.setStyle('bold', 12.5);
  const headingHeight = w.lineHeight();
  w.setStyle('regular', 10.5);
  w.ensureSpace(headingHeight + w.lineHeight() * 3 + 8);

  const title = entry.title.trim();
  const headingParams = { date: dateWithWeekday(locale, entry.date), time: timeText(locale, entry.time), title: isolate(title) };
  w.text(t(locale, title ? 'server.export.entryHeading.titled' : 'server.export.entryHeading', headingParams), {
    font: 'bold',
    size: 12.5,
    gapAfter: 2,
  });
  w.text(ratingsLine(locale, entry), { size: 10, color: COLORS.muted, gapAfter: 2 });
  if (entry.emotions.length) w.text(field(locale, 'emotions', emotionsText(locale, entry.emotions)), { size: 10.5 });
  if (entry.exerciseMinutes !== null || entry.exerciseType.trim()) {
    w.text(field(locale, 'exercise', exerciseText(locale, { ...entry, exerciseType: isolate(entry.exerciseType.trim()) })), { size: 10.5 });
  }

  const body = normalizeNewlines(entry.body).trim();
  if (body) {
    w.space(4);
    w.text(body, { size: 11, lineGap: 1.5, autoDirection: true });
    w.space(2);
  }

  // A list is isolated as a whole: its items read in the direction of the first one ("Mom, Dad").
  if (entry.events.length) w.text(field(locale, 'events', isolate(listText(locale, entry.events))), { size: 10.5 });
  if (entry.people.length) w.text(field(locale, 'people', isolate(listText(locale, entry.people))), { size: 10.5 });
  if (entry.location.trim()) w.text(field(locale, 'location', isolate(entry.location.trim())), { size: 10.5 });
  if (entry.notes.trim()) w.text(field(locale, 'notes', isolateLines(normalizeNewlines(entry.notes).trim())), { size: 10.5 });
  if (entry.tags.length) {
    // Direction marks on every page: a tag in the other script keeps its "#" (see tagsText).
    const tags = tagsText(entry.tags, true);
    w.text(field(locale, 'tags', tags), { size: 10.5, color: COLORS.muted });
  }

  w.space(5);
  w.rule();
  w.space(5);
}

function writeHabit(w: PdfWriter, habit: Habit, data: ExportData): void {
  w.setStyle('bold', 12);
  const headingHeight = w.lineHeight();
  w.setStyle('regular', 10);
  w.ensureSpace(headingHeight + w.lineHeight() * 2 + 6);

  w.text(habitHeading(w.locale, { ...habit, name: isolate(habit.name.trim()) }), { font: 'bold', size: 12, gapAfter: 1 });
  if (habit.description.trim()) w.text(habit.description.trim(), { size: 10, color: COLORS.faint, indent: 12, autoDirection: true });
  const logs = data.habitLogs.filter((l) => l.habitId === habit.id);
  if (logs.length === 0) {
    w.text(t(w.locale, 'server.export.noLogs'), { size: 10, color: COLORS.faint, indent: 12 });
  } else {
    for (const log of logs) w.text(habitLogLine(w.locale, { ...log, note: isolate(log.note.trim()) }, habit), { size: 10, indent: 12 });
  }
  w.space(8);
}

function writeHabitsAppendix(w: PdfWriter, data: ExportData): void {
  // The appendix gets a page of its own after the entries; an empty diary keeps
  // everything (header, "no entries", habits) on one page instead of a nearly blank second one.
  if (data.entries.length > 0 && !w.atPageTop()) w.newPage();
  w.text(label(w.locale, 'habits'), { font: 'bold', size: 16, gapAfter: 4 });
  w.rule(COLORS.strongRule, 1);
  w.space(8);
  if (data.habits.length === 0) {
    w.text(t(w.locale, 'server.export.noHabits'), { size: 11, color: COLORS.faint });
    return;
  }
  for (const habit of data.habits) writeHabit(w, habit, data);
}

function render(doc: PDFKit.PDFDocument, data: ExportData, fonts: PdfFontSet): void {
  const w = new PdfWriter(doc, data.locale, fonts);
  writeHeader(w, data, fontFallbackNotes(fonts, data.locale));
  if (data.entries.length === 0) {
    w.text(t(data.locale, 'server.export.noEntries'), { size: 12, color: COLORS.faint });
  } else {
    for (const entry of data.entries) writeEntry(w, entry);
  }
  if (data.includeHabits) writeHabitsAppendix(w, data);
  w.stampFooters();
}

export interface PdfOptions {
  /** Override the DejaVu Sans files only (tests); the other scripts then fall back to DejaVu Sans. */
  fonts?: PdfFonts;
  /** Override the whole font set (tests). Default: `resolvePdfFontSet(assetsDir)`. */
  fontSet?: PdfFontSet;
}

/** Throws an EXPORT error when a font file is missing or unreadable (pdfkit would throw a raw ENOENT). */
function assertFontFile(file: string): void {
  let ok = false;
  try {
    ok = fs.statSync(file).isFile();
  } catch {
    ok = false;
  }
  if (!ok) throw ApiError.exportErr('server.export.error.fontUnreadable');
}

function fontSetFor(assetsDir: string, options: PdfOptions): PdfFontSet {
  if (options.fontSet) return options.fontSet;
  if (options.fonts) {
    return { latin: { regular: { file: options.fonts.regular }, bold: { file: options.fonts.bold } } };
  }
  return resolvePdfFontSet(assetsDir);
}

/**
 * Renders the export as an A4 PDF and resolves with the file bytes.
 * Every failure (missing/corrupt font, pdfkit error) surfaces as a rejected promise
 * carrying an `ApiError` with code EXPORT and a localised message - never a raw Node error.
 */
export async function exportPdf(data: ExportData, assetsDir: string, options: PdfOptions = {}): Promise<Buffer> {
  const fonts = fontSetFor(assetsDir, options);
  assertFontFile(fonts.latin.regular.file);
  assertFontFile(fonts.latin.bold.file);
  const author = fullName(data) || data.user.username;
  let doc: PDFKit.PDFDocument;
  try {
    doc = new PDFDocument({
      size: 'A4',
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
      bufferPages: true,
      // Setting the default font here means pdfkit never loads Helvetica's AFM metrics.
      font: fonts.latin.regular.file,
      info: {
        Title: appName(data.locale),
        Author: author,
        Subject: t(data.locale, 'server.export.pdfSubject'),
        Creator: appName(data.locale),
        Producer: appName(data.locale),
      },
      lang: localeDef(data.locale).intl,
    });
  } catch (e) {
    // The constructor parses the font file synchronously; a corrupt TTF fails here.
    throw toExportError(e);
  }

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (e: unknown) => reject(toExportError(e)));
    try {
      render(doc, data, fonts);
      doc.end();
    } catch (e) {
      reject(toExportError(e));
    }
  });
}

function toExportError(e: unknown): ApiError {
  if (isApiError(e)) return e;
  console.error('[diary-server] PDF export failed:', e);
  return ApiError.exportErr('server.export.error.pdfFailed');
}
