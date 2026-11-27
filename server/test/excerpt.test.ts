/**
 * `EntrySummary.excerpt`: the three copies of `makeExcerpt` give the exact expected string for every
 * case of the shared table (`shared/excerpt-cases.ts`) and the same answer for every input.
 *
 * The client copy (`src/offline/overlay/effects.ts`) is imported here by its path: it imports only
 * types and `../optimistic` (no browser API), so the server's test runner can load it, and this file
 * is the one place where the three copies meet. `src/offline/overlay/excerpt.test.ts` runs the same
 * table against the client copy in the client's own runner.
 */
import { describe, expect, it } from 'vitest';
import { EXCERPT_CASES } from '@shared/excerpt-cases';
import { ENTRY_LIMITS, makeExcerpt as repoExcerpt } from '../src/db/entries-repo';
import { EXCERPT_LENGTH, makeExcerpt as summaryExcerpt } from '../src/stats/entry-summary';
import { EXCERPT_LENGTH as CLIENT_EXCERPT_LENGTH, makeExcerpt as clientExcerpt } from '../../src/offline/overlay/effects';

const COPIES = [
  ['server/src/db/entries-repo.ts', repoExcerpt],
  ['server/src/stats/entry-summary.ts', summaryExcerpt],
  ['src/offline/overlay/effects.ts', clientExcerpt],
] as const;

const ELLIPSIS = '…';
const codePoints = (s: string): number => Array.from(s).length;

/** A small deterministic generator (mulberry32), so a failure names an input that can be run again. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pieces the generated texts are made of: letters of several scripts, every kind of whitespace and punctuation the rule names, emoji. */
const WORDS = ['a', 'b', 'word', 'Ich', 'habe', 'mit', 'Mama', 'שלום', 'עולם', 'مرحبا', 'كيف', 'привет', 'नमस्ते', 'ภาษาไทย', '我', '今天', '日本'];
const PIECES = [
  ...WORDS,
  ' ', ' ', ' ', '  ', '\n', '\t', '\u00a0', '\u3000',
  // Weak: removed before the ellipsis.
  '.', ',', ';', ':', '-', '\u2010', '\u2011', '\u2012', '\u2013', '\u2014', '\u2015', '\u05be', '\u2026', '...',
  '\u060c', '\u061b', '\u3001', '\u3002', '\uff0c', '\uff1a', '\uff1b', '\u0964', '\u0965', '\u0387', '\u200d',
  // Only ever opening: removed.
  '(', '[', '{', '\uff08', '\uff3b', '\uff5b', '\u3008', '\u300a', '\u300c', '\u300e', '\u3010', '\u3014', '\u3016', '\u201a', '\u201e',
  '\u00a1', '\u00bf',
  // Opening or closing by what stands before them.
  '"', "'", '\u2018', '\u2019', '\u201c', '\u201d', '\u00ab', '\u00bb', '\u2039', '\u203a', ' "', ' \u00ab',
  // Strong: kept.
  '!', '?', '\u061f', '\uff01', '\uff1f', ')', ']', '}', '\uff09', '\u300d', '\u00b7',
  '😀', '👨‍👩‍👧', '🇮🇱', '❤️',
];

function generated(count: number, seed: number): string[] {
  const next = random(seed);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    // Around the cut: 120 to 220 code points. Mostly words and spaces, as a diary is; any piece now and then.
    const target = 120 + Math.floor(next() * 100);
    let text = '';
    while (codePoints(text) < target) {
      const roll = next();
      const pool = roll < 0.45 ? WORDS : roll < 0.7 ? [' '] : PIECES;
      text += pool[Math.floor(next() * pool.length)];
    }
    out.push(text);
  }
  return out;
}

describe('makeExcerpt: the length', () => {
  it('is 160 code points in the three copies', () => {
    expect(ENTRY_LIMITS.excerptLength).toBe(160);
    expect(EXCERPT_LENGTH).toBe(160);
    expect(CLIENT_EXCERPT_LENGTH).toBe(160);
  });
});

describe.each(COPIES)('makeExcerpt of %s: a length argument other than 160', (_file, makeExcerpt) => {
  // No caller passes one (every call uses the default), but the promise "never longer than the
  // length" holds for any length: 0 or less counts as 1.
  it.each([
    ['abcdef', 0, '…'],
    ['ab cd ef', -1, '…'],
    ['abcdef', 1, '…'],
    ['abcdef', 2, 'a…'],
    ['ab cd ef', 6, 'ab cd…'],
  ] as const)('%j with length %d gives %j', (body, length, expected) => {
    expect(makeExcerpt(body, length)).toBe(expected);
  });
});

describe.each(COPIES)('makeExcerpt of %s: the shared table of cases', (_file, makeExcerpt) => {
  it.each(EXCERPT_CASES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(makeExcerpt(c.body)).toBe(c.expected);
  });
});

describe('makeExcerpt: the three copies agree', () => {
  const inputs = [...EXCERPT_CASES.map((c) => c.body), ...generated(3000, 20261127)];

  it('gives the same answer in the three copies for every case of the table and every generated text', () => {
    const differences: string[] = [];
    for (const body of inputs) {
      const answers = COPIES.map(([, f]) => f(body));
      if (answers[1] !== answers[0] || answers[2] !== answers[0]) differences.push(JSON.stringify({ body, answers }));
    }
    expect(differences.slice(0, 3)).toEqual([]);
  });

  it('keeps the four promises of the rule for every generated text', () => {
    for (const body of inputs) {
      const normalised = body.replace(/\s+/g, ' ').trim();
      const out = repoExcerpt(body);
      const where = JSON.stringify(body);
      if (codePoints(normalised) <= 160) {
        expect(out, where).toBe(normalised);
        continue;
      }
      expect(codePoints(out), where).toBeLessThanOrEqual(160);
      expect(out.endsWith(ELLIPSIS), where).toBe(true);
      const kept = out.slice(0, -1);
      expect(kept.length, where).toBeGreaterThan(0);
      expect(normalised.startsWith(kept), where).toBe(true);
      expect(/\s$/.test(kept), where).toBe(false);
      // Never half of a surrogate pair.
      expect(/[\ud800-\udbff]$/.test(kept), where).toBe(false);
    }
  });
});
