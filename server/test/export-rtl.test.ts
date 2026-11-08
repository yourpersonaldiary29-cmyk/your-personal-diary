import { describe, expect, it } from 'vitest';
import { tagsText } from '../src/export/format';
import { bidiRuns, graphemes, isolate, layoutParagraphs, openIsolates, stripBidiMarks, toVisual, wrapLine } from '../src/export/rtl';

/** Fake measure: 10 units per UTF-16 code unit. */
const measure = (s: string) => s.length * 10;

describe('wrapLine', () => {
  it('keeps short text on a single line', () => {
    expect(wrapLine('שלום עולם', 200, measure)).toEqual(['שלום עולם']);
  });

  it('wraps by words and never exceeds the maximum width', () => {
    const words = Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? 'מילה' : i % 3 === 1 ? 'ארוכה' : 'כן'));
    const text = words.join(' ');
    const lines = wrapLine(text, 100, measure);
    expect(lines.length).toBeGreaterThan(3);
    for (const line of lines) {
      expect(measure(line)).toBeLessThanOrEqual(100);
      expect(line).not.toMatch(/^\s|\s$/);
    }
    // Word order and content are preserved.
    expect(lines.join(' ')).toBe(text);
  });

  it('breaks a single word that is wider than the whole line', () => {
    const word = 'א'.repeat(25);
    const lines = wrapLine(word, 100, measure);
    expect(lines).toEqual(['א'.repeat(10), 'א'.repeat(10), 'א'.repeat(5)]);
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(100);
  });

  it('flushes the current line before breaking a long word and continues after it', () => {
    const lines = wrapLine('קצר ' + 'ב'.repeat(15) + ' סוף', 100, measure);
    expect(lines).toEqual(['קצר', 'ב'.repeat(10), 'ב'.repeat(5) + ' סוף']);
  });

  it('collapses whitespace runs and returns one empty line for blank input', () => {
    expect(wrapLine('  שלום   עולם  ', 200, measure)).toEqual(['שלום עולם']);
    expect(wrapLine('', 200, measure)).toEqual(['']);
    expect(wrapLine('   ', 200, measure)).toEqual(['']);
  });

  it('never splits a base letter from its combining mark when breaking long words', () => {
    // Hebrew letters with nikud (combining marks) - each grapheme is 2 code units.
    const word = 'בָּ'.repeat(6); // 3 code units per repeat
    const lines = wrapLine(word, 70, measure);
    for (const line of lines) {
      // Every line must start with a base letter (not a combining mark).
      expect(line.charCodeAt(0)).toBe('ב'.charCodeAt(0));
      expect(measure(line)).toBeLessThanOrEqual(70);
    }
    expect(lines.join('')).toBe(word);
  });
});

describe('graphemes', () => {
  it('keeps surrogate pairs and combining marks together', () => {
    expect(graphemes('אב')).toEqual(['א', 'ב']);
    const withMark = 'בָ';
    expect(graphemes(withMark)).toEqual([withMark]);
  });
});

describe('toVisual', () => {
  it('reverses a pure Hebrew line', () => {
    expect(toVisual('שלום עולם')).toBe('םלוע םולש');
  });

  it('keeps decimal numbers left-to-right inside Hebrew', () => {
    const visual = toVisual('ישנתי 7.5 שעות');
    expect(visual).toContain('7.5');
    expect(visual).not.toContain('5.7');
    expect(visual).toBe('תועש 7.5 יתנשי');
  });

  it('keeps ratios like 7/10 and clock times in order', () => {
    expect(toVisual('מצב רוח: 7/10')).toContain('7/10');
    expect(toVisual('שעה: 21:30')).toContain('21:30');
    const ratings = toVisual('מצב רוח: 7/10 | אנרגיה: 6/10 | שעות שינה: 7.5');
    expect(ratings).toContain('7/10');
    expect(ratings).toContain('6/10');
    expect(ratings).toContain('7.5');
  });

  it('keeps Latin words left-to-right', () => {
    const visual = toVisual('פגשתי את John היום');
    expect(visual).toContain('John');
    expect(visual.startsWith('םויה')).toBe(true);
  });

  it('mirrors parentheses inside right-to-left runs', () => {
    // Logical "פעילות (הליכה)" -> drawn left-to-right the glyphs must be "(הכילה) תוליעפ".
    expect(toVisual('פעילות (הליכה)')).toBe('(הכילה) תוליעפ');
  });

  it('leaves a Latin-only line untouched apart from the direction of neutrals', () => {
    expect(toVisual('hello world', 'ltr')).toBe('hello world');
    expect(toVisual('2026-09-07')).toBe('2026-09-07');
  });

  it('returns an empty string for empty input', () => {
    expect(toVisual('')).toBe('');
  });

  it('keeps surrogate pairs valid after reordering', () => {
    const visual = toVisual('שלום 😀 עולם');
    expect(visual).toContain('😀');
    expect(visual).not.toMatch(/[\uDC00-\uDFFF][\uD800-\uDBFF]/);
  });
});

describe('layoutParagraphs', () => {
  it('splits on newlines, wraps each paragraph and keeps blank lines', () => {
    const lines = layoutParagraphs('שורה ראשונה\r\n\nשורה שלישית ארוכה מאוד', 120, measure);
    expect(lines[0]).toBe('שורה ראשונה');
    expect(lines[1]).toBe('');
    expect(lines.slice(2).join(' ')).toBe('שורה שלישית ארוכה מאוד');
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(120);
  });
});

describe('hash tags on right-to-left pages', () => {
  it('keeps every "#" with its Latin tag and never draws the marks', () => {
    // Without the marks the first "#" takes the paragraph direction and lands in the Arabic run,
    // i.e. it is drawn to the right of the whole Latin run: "rest #work#".
    expect(bidiRuns(`الوسوم: ${tagsText(['rest', 'work'])}`, 'rtl')).toEqual([
      { text: 'rest #work', rtl: false },
      { text: 'الوسوم: #', rtl: true },
    ]);
    const runs = bidiRuns(`الوسوم: ${tagsText(['rest', 'work'], true)}`, 'rtl');
    expect(runs[0]).toEqual({ text: '#rest #work', rtl: false });
    expect(runs.slice(1).map((r) => r.text).join('')).toBe('الوسوم: ');
    expect(runs.some((r) => /[‎‏]/.test(r.text))).toBe(false);
  });

  it('keeps every "#" with its Hebrew/Arabic tag on a left-to-right page', () => {
    // Without the marks the first "#" stays in the Latin run and the second one joins the
    // Arabic run, so the line reads "#طبيعة# عائلة".
    expect(bidiRuns(`Tags: ${tagsText(['عائلة', 'طبيعة'])}`, 'ltr')).toEqual([
      { text: 'Tags: #', rtl: false },
      { text: 'عائلة #طبيعة', rtl: true },
    ]);
    const runs = bidiRuns(`Tags: ${tagsText(['عائلة', 'طبيعة', 'work'], true)}`, 'ltr');
    expect(runs).toEqual([
      { text: 'Tags: ', rtl: false },
      { text: '#عائلة #طبيعة', rtl: true },
      { text: ' #work', rtl: false },
    ]);
    expect(tagsText(['עבודה', 'rest'], true)).toBe('‏#עבודה ‎#rest');
  });

  it('leaves Hebrew tags and the TXT export unchanged', () => {
    expect(tagsText(['עבודה', 'ספורט'])).toBe('#עבודה #ספורט');
    const runs = bidiRuns(`תגיות: ${tagsText(['עבודה'], true)}`, 'rtl');
    expect(runs.every((r) => r.rtl)).toBe(true);
    expect(runs.map((r) => r.text).reverse().join('')).toBe('תגיות: #עבודה');
  });
});

describe('user text inside a labelled line (isolates)', () => {
  const LRI = '\u2066';
  const RLI = '\u2067';
  const PDI = '\u2069';

  it('wraps text in an isolate of its first-letter direction and leaves letterless text alone', () => {
    expect(isolate('Remember to call.')).toBe(`${LRI}Remember to call.${PDI}`);
    expect(isolate('לזכור להתקשר.')).toBe(`${RLI}לזכור להתקשר.${PDI}`);
    expect(isolate('(2026) שנה טובה')).toBe(`${RLI}(2026) שנה טובה${PDI}`);
    expect(isolate('12:30')).toBe('12:30');
    expect(isolate('')).toBe('');
    // Controls pasted with the text cannot close the isolate early.
    expect(isolate(`abc${PDI}.`)).toBe(`${LRI}abc.${PDI}`);
    expect(stripBidiMarks(isolate('abc'))).toBe('abc');
  });

  it('keeps the full stop of an English note at its end on a right-to-left page', () => {
    // Without the isolate the full stop takes the page direction and is drawn before "Remember".
    expect(bidiRuns('הערות: Remember to call.', 'rtl')[0]).toEqual({ text: '.', rtl: true });
    const runs = bidiRuns(`הערות: ${isolate('Remember to call.')}`, 'rtl');
    expect(runs).toEqual([
      { text: 'Remember to call.', rtl: false },
      { text: 'הערות: ', rtl: true },
    ]);
  });

  it('keeps the full stop of a Hebrew note at its end on a left-to-right page', () => {
    expect(bidiRuns('Notes: לזכור להתקשר.', 'ltr').pop()).toEqual({ text: '.', rtl: false });
    expect(bidiRuns(`Notes: ${isolate('לזכור להתקשר.')}`, 'ltr')).toEqual([
      { text: 'Notes: ', rtl: false },
      { text: 'לזכור להתקשר.', rtl: true },
    ]);
    // The title of an entry heading: the "!" stays with the Hebrew title.
    const heading = bidiRuns(`01/09/2026 | 20:00 | ${isolate('איזה יום!')}`, 'ltr');
    expect(heading[heading.length - 1]).toEqual({ text: 'איזה יום!', rtl: true });
  });

  it('reports the isolates a wrapped line leaves open', () => {
    const line = `Notes: ${isolate('לזכור להתקשר לדנה מחר בבוקר.')}`;
    const first = line.slice(0, line.indexOf('לדנה'));
    const rest = line.slice(first.length);
    expect(openIsolates(line)).toBe('');
    expect(openIsolates(first)).toBe(RLI);
    expect(openIsolates(openIsolates(first) + rest)).toBe('');
    // The continuation line resolves right-to-left only when it starts with the open isolate.
    expect(bidiRuns(rest, 'ltr').pop()).toEqual({ text: '.', rtl: false });
    expect(bidiRuns(openIsolates(first) + rest, 'ltr')).toEqual([{ text: 'לדנה מחר בבוקר.', rtl: true }]);
    expect(openIsolates(`${LRI}a${RLI}b${PDI}`)).toBe(LRI);
    expect(openIsolates(`a${PDI}`)).toBe('');
  });
});
