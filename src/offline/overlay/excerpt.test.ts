/**
 * The offline overlay's `makeExcerpt` gives the exact expected string for every case of the shared
 * table (`shared/excerpt-cases.ts`), as the server's two copies do. That the three copies agree for
 * every input is proven by `server/test/excerpt.test.ts`, which imports this copy by its path.
 */
import { describe, expect, it } from 'vitest';
import { EXCERPT_CASES } from '@shared/excerpt-cases';
import type { Entry } from '@shared/types';
import { entryToSummary, EXCERPT_LENGTH, makeExcerpt } from './effects';

describe('overlay makeExcerpt: the shared table of cases', () => {
  it('cuts at 160 code points', () => {
    expect(EXCERPT_LENGTH).toBe(160);
  });

  it.each(EXCERPT_CASES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(makeExcerpt(c.body)).toBe(c.expected);
  });

  it('is what the summary of an entry waiting on the device shows', () => {
    const long = EXCERPT_CASES.find((c) => c.name === 'Hebrew: the cut goes back to the end of a word');
    expect(long).toBeDefined();
    const summary = entryToSummary({ id: -1, date: '2026-11-27', time: '08:00', title: '', body: long!.body } as Entry);
    expect(summary.excerpt).toBe(long!.expected);
  });
});
