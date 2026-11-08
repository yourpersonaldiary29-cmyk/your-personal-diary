/**
 * Keyboard focus after a search: the "תוצאות" heading must receive focus once
 * the results are rendered - including on the very first search of the page,
 * when the heading did not exist before the result arrived - and the page
 * title must not steal it back when the question is written to "?q=".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { SearchResult } from '@shared/types';
import * as api from '@/api';
import { renderWithProviders } from '@/test/render';
import SearchPage, { SEARCH_TEXTS } from './SearchPage';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

vi.setConfig({ testTimeout: 20_000 });

function makeResult(answer: string): SearchResult {
  return {
    parsed: {
      intent: 'text_mention',
      metric: null,
      comparator: null,
      threshold: null,
      from: null,
      to: null,
      textTerms: ['עייף'],
      emotions: [],
      periodLabel: 'כל התקופה',
      explanation: 'חיפשתי רשומות שבהן כתבת "עייף".',
    },
    answer,
    entries: [],
    days: [],
    series: null,
    totalMatches: 0,
  };
}

describe('SearchPage focus management', () => {
  beforeEach(() => {
    vi.mocked(api.search.run).mockReset();
  });

  it('moves focus to the results heading after the first search', async () => {
    vi.mocked(api.search.run).mockResolvedValue(makeResult('לא כתבת "עייף" באף רשומה.'));
    const { user } = renderWithProviders(<SearchPage />, { auth: 'authenticated', route: '/search' });
    const input = screen.getByLabelText(new RegExp(SEARCH_TEXTS.label));
    await user.type(input, 'מתי כתבתי שאני עייף?{Enter}');

    const heading = await screen.findByRole('heading', { level: 2, name: SEARCH_TEXTS.resultsTitle });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(heading).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus to the results heading again for a second search', async () => {
    vi.mocked(api.search.run)
      .mockResolvedValueOnce(makeResult('תשובה ראשונה.'))
      .mockResolvedValueOnce(makeResult('תשובה שנייה.'));
    const { user } = renderWithProviders(<SearchPage />, { auth: 'authenticated', route: '/search' });
    const input = screen.getByLabelText(new RegExp(SEARCH_TEXTS.label));
    await user.type(input, 'שאלה ראשונה{Enter}');
    const heading = await screen.findByRole('heading', { level: 2, name: SEARCH_TEXTS.resultsTitle });
    await waitFor(() => expect(document.activeElement).toBe(heading));

    // Typing a new question moves focus back to the box; the second answer must refocus the heading.
    await user.clear(input);
    await user.type(input, 'שאלה שנייה{Enter}');
    await screen.findByText('תשובה שנייה.', { selector: 'p, div' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });
});
