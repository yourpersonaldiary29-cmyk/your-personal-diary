/**
 * Line layout helpers for the PDF export: wrapping, bidirectional reordering and paragraph
 * direction. pdfkit draws glyphs strictly in the order of the string it receives and has no
 * knowledge of the Unicode Bidirectional Algorithm, so the writer:
 *
 *   1. wraps the LOGICAL text into lines itself (`wrapLine`), using the same width measurement
 *      pdfkit uses; Thai and CJK text, which has no spaces between words, is broken at the word
 *      boundaries reported by Intl.Segmenter (`tokenize`);
 *   2. splits every line into directional runs in VISUAL (left-to-right drawing) order
 *      (`bidiRuns`, bidi-js embedding levels + rule L2 applied to run order, brackets mirrored);
 *   3. hands each run to the PDF writer, which draws right-to-left runs as logical text through
 *      fontkit's OpenType layout (it shapes Arabic joining forms and reverses the glyphs of a
 *      Hebrew/Arabic run itself) and reverses purely neutral runs (punctuation, spaces) on its own.
 *
 * `toVisual` (whole-line string reversal) is the previous approach; it is kept for compatibility
 * and tests but no longer used for drawing, because fontkit reverses right-to-left runs a second
 * time and the letters of every word came out backwards.
 */
import bidiFactory from 'bidi-js';

const bidi = bidiFactory();

/** Measures the rendered width of a piece of text in the current font/size. */
export type Measure = (text: string) => number;

export type BaseDirection = 'rtl' | 'ltr';

interface SegmenterLike {
  segment(s: string): Iterable<{ segment: string; isWordLike?: boolean }>;
}
type SegmenterCtor = new (locale: string, opts: { granularity: 'grapheme' | 'word' }) => SegmenterLike;

function segmenterCtor(): SegmenterCtor | undefined {
  return (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
}

const segmenterCache = new Map<string, SegmenterLike | null>();

function segmenter(locale: string, granularity: 'grapheme' | 'word'): SegmenterLike | null {
  const key = `${locale}|${granularity}`;
  let seg = segmenterCache.get(key);
  if (seg === undefined) {
    const Ctor = segmenterCtor();
    try {
      seg = Ctor ? new Ctor(locale, { granularity }) : null;
    } catch {
      seg = null;
    }
    segmenterCache.set(key, seg);
  }
  return seg;
}

/**
 * Splits a string into user-perceived characters (grapheme clusters) so that a
 * surrogate pair or a base letter with combining marks (e.g. Hebrew nikud) is never
 * split when a very long word has to be broken by characters.
 */
export function graphemes(text: string): string[] {
  const seg = segmenter('he', 'grapheme');
  if (seg) return Array.from(seg.segment(text), (s) => s.segment);
  return Array.from(text);
}

// ---------------------------------------------------------------------------
// Tokenisation (break opportunities)
// ---------------------------------------------------------------------------

/** A wrappable unit: `spaceBefore` tells whether a space separates it from the previous token. */
export interface Token {
  text: string;
  spaceBefore: boolean;
}

/** Scripts written without spaces between words: line breaks come from the segmenter. */
const NO_SPACE_SCRIPTS = /[\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
/** CJK / fullwidth punctuation: a line may break after it but never before it. */
const CJK_PUNCTUATION = /^[　-〿＀-￯]+$/u;
/** Opening brackets and quotes glue to the word that follows them. */
const OPENING = /^[([{「『（［｛【〈《“‘]+$/u;

/** Picks the segmenter language from the scripts present in the text. */
function segmenterTagFor(text: string): string {
  if (/\p{Script=Thai}/u.test(text)) return 'th';
  if (/\p{Script=Lao}/u.test(text)) return 'lo';
  if (/\p{Script=Khmer}/u.test(text)) return 'km';
  if (/\p{Script=Myanmar}/u.test(text)) return 'my';
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return 'ja';
  return 'zh';
}

/**
 * Break opportunities inside one whitespace-free chunk of Thai / CJK text. Word segments become
 * tokens; punctuation attaches to the previous token (no break before it), an opening bracket to
 * the next one, and Latin punctuation such as "/" or "-" binds both sides ("7/10" stays whole).
 */
function segmentChunk(chunk: string): string[] {
  const seg = segmenter(segmenterTagFor(chunk), 'word');
  if (!seg) return [chunk];
  const pieces: string[] = [];
  let bindNext = false;
  for (const s of seg.segment(chunk)) {
    const text = s.segment;
    if (!text) continue;
    if (s.isWordLike) {
      if (bindNext && pieces.length) pieces[pieces.length - 1] += text;
      else pieces.push(text);
      bindNext = false;
      continue;
    }
    if (OPENING.test(text)) {
      pieces.push(text);
      bindNext = true;
      continue;
    }
    if (pieces.length) pieces[pieces.length - 1] += text;
    else pieces.push(text);
    bindNext = !CJK_PUNCTUATION.test(text);
  }
  return pieces.length ? pieces : [chunk];
}

/**
 * Splits a paragraph into tokens at whitespace and, inside Thai / CJK chunks, at the word
 * boundaries reported by Intl.Segmenter. Whitespace runs collapse to a single space.
 */
export function tokenize(text: string): Token[] {
  const chunks = text.split(/\s+/).filter((c) => c.length > 0);
  const out: Token[] = [];
  for (const chunk of chunks) {
    const spaceBefore = out.length > 0;
    if (!NO_SPACE_SCRIPTS.test(chunk)) {
      out.push({ text: chunk, spaceBefore });
      continue;
    }
    const pieces = segmentChunk(chunk);
    pieces.forEach((piece, i) => out.push({ text: piece, spaceBefore: i === 0 ? spaceBefore : false }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Wrapping
// ---------------------------------------------------------------------------

/** Breaks a single word that is wider than `maxWidth` into chunks that fit (at least one grapheme per chunk). */
function breakLongWord(word: string, maxWidth: number, measure: Measure): string[] {
  const parts = graphemes(word);
  const chunks: string[] = [];
  let current = '';
  for (const g of parts) {
    const candidate = current + g;
    if (current && measure(candidate) > maxWidth) {
      chunks.push(current);
      current = g;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Wraps one LOGICAL paragraph (no newlines) into lines whose measured width never
 * exceeds `maxWidth`. Wrapping happens at token boundaries (`tokenize`: whitespace, plus
 * segmenter word boundaries for Thai / CJK); a token wider than the whole line is broken by
 * graphemes. Whitespace runs collapse to a single space and the returned lines carry no
 * leading/trailing whitespace.
 *
 * An empty / whitespace-only paragraph yields a single empty line so callers can
 * keep blank lines between paragraphs.
 */
export function wrapLine(text: string, maxWidth: number, measure: Measure): string[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  const pushWordPieces = (word: string) => {
    // Token alone is wider than a line: flush the current line and break the token.
    if (current) {
      lines.push(current);
      current = '';
    }
    const pieces = breakLongWord(word, maxWidth, measure);
    for (let i = 0; i < pieces.length; i++) {
      if (i < pieces.length - 1) lines.push(pieces[i]);
      else current = pieces[i];
    }
  };
  for (const token of tokens) {
    if (measure(token.text) > maxWidth) {
      pushWordPieces(token.text);
      continue;
    }
    if (!current) {
      current = token.text;
      continue;
    }
    const candidate = token.spaceBefore ? `${current} ${token.text}` : current + token.text;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = token.text;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Lays out a whole text block: splits it into paragraphs at newlines, wraps every
 * paragraph with `wrapLine` and returns the LOGICAL lines. Blank paragraphs produce empty lines.
 */
export function layoutParagraphs(text: string, maxWidth: number, measure: Measure): string[] {
  const paragraphs = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  for (const p of paragraphs) out.push(...wrapLine(p, maxWidth, measure));
  return out;
}

// ---------------------------------------------------------------------------
// Direction
// ---------------------------------------------------------------------------

const RTL_SCRIPT = /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;
const LETTER = /\p{L}/u;

/** True when the text contains a letter of a right-to-left script. */
export function hasRtlLetters(text: string): boolean {
  for (const ch of text) if (LETTER.test(ch) && RTL_SCRIPT.test(ch)) return true;
  return false;
}

/** Paragraph direction from its first letter (UAX #9 P2/P3), or null when it has no letters. */
export function firstStrongDirection(text: string): BaseDirection | null {
  for (const ch of text) {
    if (!LETTER.test(ch)) continue;
    return RTL_SCRIPT.test(ch) ? 'rtl' : 'ltr';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Bidirectional runs
// ---------------------------------------------------------------------------

/** One directional run of a line, in visual order. `rtl` runs are still in LOGICAL character order. */
export interface BidiRun {
  text: string;
  rtl: boolean;
}

/**
 * Resolves the embedding levels of one logical line (bidi-js, `base` paragraph direction),
 * mirrors brackets that sit in right-to-left runs and returns the runs in visual order
 * (rule L2 applied to the sequence of runs). The characters INSIDE a right-to-left run are left
 * in logical order: the PDF writer draws them through fontkit, which reverses them, or reverses
 * them itself when the run holds no letters. Invisible bidi marks (LRM/RLM, embeddings,
 * isolates) take part in the level resolution but are removed from the returned text, so no font
 * ever has to draw them.
 */
export function bidiRuns(line: string, base: BaseDirection): BidiRun[] {
  if (!line) return [];
  const embedding = bidi.getEmbeddingLevels(line, base);
  // bidi-js works on UTF-16 code units, so we do too (both halves of a pair share a level).
  const chars = line.split('');
  const mirrored = bidi.getMirroredCharactersMap(line, embedding.levels);
  for (const [index, replacement] of mirrored) chars[index] = replacement;
  const levels = embedding.levels;

  const runs: Array<{ level: number; text: string }> = [];
  for (let i = 0; i < chars.length; i++) {
    const level = levels[i];
    const last = runs[runs.length - 1];
    if (last && last.level === level) last.text += chars[i];
    else runs.push({ level, text: chars[i] });
  }

  let highest = 0;
  let lowestOdd = Number.POSITIVE_INFINITY;
  for (const r of runs) {
    highest = Math.max(highest, r.level);
    if (r.level % 2 === 1) lowestOdd = Math.min(lowestOdd, r.level);
  }
  // L2: from the highest level down to the lowest odd level, reverse every contiguous
  // sequence of runs at that level or higher.
  for (let level = highest; level >= lowestOdd && level > 0; level--) {
    let i = 0;
    while (i < runs.length) {
      if (runs[i].level < level) {
        i++;
        continue;
      }
      let j = i;
      while (j < runs.length && runs[j].level >= level) j++;
      runs.splice(i, j - i, ...runs.slice(i, j).reverse());
      i = j;
    }
  }
  return runs
    .map((r) => ({ text: r.text.replace(BIDI_MARKS, ''), rtl: r.level % 2 === 1 }))
    .filter((r) => r.text.length > 0);
}

/** Invisible bidi formatting characters: LRM, RLM, ALM, LRE..RLO, LRI..PDI. */
const BIDI_MARKS = /[‎‏؜‪-‮⁦-⁩]/g;

/** Removes the invisible bidi formatting characters (they have no width and are never drawn). */
export function stripBidiMarks(text: string): string {
  return text.replace(BIDI_MARKS, '');
}

// ---------------------------------------------------------------------------
// Isolates (user text inside a line of the export language)
// ---------------------------------------------------------------------------

const LRI = '\u2066';
const RLI = '\u2067';
const FSI = '\u2068';
const PDI = '\u2069';
/** Embeddings, overrides and isolates a user may have pasted: they would end our isolate early. */
const NESTING_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;

/**
 * Wraps user-written text that sits inside a line of the export language ("Notes: <text>",
 * "<date> | <time> | <title>") in a directional isolate of its own first-letter direction, like
 * <bdi dir="auto">. Without it the bidi algorithm gives the full stop that ends an English note on
 * a Hebrew page the direction of the page, and it is drawn before the first word
 * (".Remember to call"); a Hebrew note on an English page has the same problem. Text without
 * letters is returned unchanged. `bidiRuns` drops the isolate characters after resolving the
 * levels, so they are never drawn.
 */
export function isolate(text: string): string {
  const clean = text.replace(NESTING_CONTROLS, '');
  const dir = firstStrongDirection(clean);
  if (!dir) return clean;
  return `${dir === 'rtl' ? RLI : LRI}${clean}${PDI}`;
}

/**
 * The isolate initiators a line leaves open (no matching PDI). When a paragraph wraps inside an
 * isolate, the next line has to start with them so it resolves its levels the same way.
 */
export function openIsolates(line: string): string {
  const stack: string[] = [];
  for (const ch of line) {
    if (ch === LRI || ch === RLI || ch === FSI) stack.push(ch);
    else if (ch === PDI) stack.pop();
  }
  return stack.join('');
}

/** Reverses a string by code points (keeps surrogate pairs intact). */
export function reverseCodePoints(text: string): string {
  return Array.from(text).reverse().join('');
}

// ---------------------------------------------------------------------------
// Legacy whole-line reversal (not used for drawing any more)
// ---------------------------------------------------------------------------

function isHighSurrogate(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c >= 0xd800 && c <= 0xdbff;
}

function isLowSurrogate(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c >= 0xdc00 && c <= 0xdfff;
}

/**
 * Converts one logical line to visual (left-to-right) character order: mirrors brackets in
 * right-to-left runs and reverses the runs the bidi algorithm marks. Numbers and Latin
 * fragments keep their order. Suitable for plain glyph-by-glyph renderers; the PDF writer uses
 * `bidiRuns` instead (see the file header).
 */
export function toVisual(line: string, base: BaseDirection = 'rtl'): string {
  if (!line) return '';
  const embedding = bidi.getEmbeddingLevels(line, base);
  const chars = line.split('');

  // 1. Mirror characters (brackets) that ended up in RTL runs. Indices are logical.
  const mirrored = bidi.getMirroredCharactersMap(line, embedding.levels);
  for (const [index, replacement] of mirrored) chars[index] = replacement;

  // 2. Reverse the runs the algorithm marks, in order (each [start, end] is inclusive).
  const flips = bidi.getReorderSegments(line, embedding);
  for (const [start, end] of flips) {
    let i = start;
    let j = end;
    while (i < j) {
      const tmp = chars[i];
      chars[i] = chars[j];
      chars[j] = tmp;
      i++;
      j--;
    }
  }

  // 3. A reversed run may have flipped surrogate pairs (low before high) - restore them.
  for (let i = 0; i + 1 < chars.length; i++) {
    if (isLowSurrogate(chars[i]) && isHighSurrogate(chars[i + 1])) {
      const tmp = chars[i];
      chars[i] = chars[i + 1];
      chars[i + 1] = tmp;
      i++;
    }
  }
  return chars.join('');
}
