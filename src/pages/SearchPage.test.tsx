import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { CalendarDay, SearchResult } from '@shared/types';
import { ApiClientError } from '@/api';
import * as api from '@/api';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { assertiveRegion, politeRegion, renderWithProviders, sampleUser } from '@/test/render';

/** The signed-in test account's recent questions (kept per account). */
const RECENT_QUESTIONS_KEY = recentQuestionsKey(sampleUser.id);
import { recentQuestionsKey } from '@/utils/deviceData';
import SearchPage, { MORE_ENTRIES_STEP, SEARCH_EXAMPLE_KEYS, SEARCH_TEXTS, dayMetricsText, highlightTerms, searchExamples } from './SearchPage';
import { ET } from './entries/texts';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

// The expectations below assert the Hebrew wording; the UI defaults to English.
pinLocaleForTests('he');

const day: CalendarDay = {
  date: '2026-09-20',
  mood: 5,
  energy: 3,
  stress: 6,
  sleepHours: 5,
  hasEntry: true,
  entryCount: 1,
  habitsCompleted: 1,
  habitsTotal: 2,
  titles: ['יום ארוך'],
};

const result: SearchResult = {
  parsed: {
    intent: 'text_mention',
    metric: null,
    comparator: null,
    threshold: null,
    from: null,
    to: null,
    textTerms: ['עייף'],
    emotions: ['tired'],
    periodLabel: 'כל התקופה',
    explanation: 'חיפשתי רשומות שבהן כתבת "עייף".',
  },
  answer: 'מצאתי רשומה אחת שבה כתבת שאתה עייף.',
  entries: [
    {
      id: 3,
      date: '2026-09-20',
      time: '22:00',
      title: 'יום ארוך',
      excerpt: 'הייתי עייף מאוד אחרי העבודה.',
      mood: 5,
      energy: 3,
      stress: 6,
      sleepHours: 5,
      emotions: ['tired'],
      tags: [],
    },
  ],
  days: [day],
  series: null,
  totalMatches: 1,
};

const question = 'מתי כתבתי שאני עייף?';

function renderPage(route = '/search') {
  return renderWithProviders(<SearchPage />, { auth: 'authenticated', route });
}

describe('SearchPage', () => {
  beforeEach(() => {
    vi.mocked(api.search.run).mockReset().mockResolvedValue(result);
  });

  it('submits the question with Enter and renders the interpretation, answer, days and entries', async () => {
    const { user } = renderPage();
    expect(screen.getByRole('heading', { level: 1, name: SEARCH_TEXTS.title })).toBeInTheDocument();
    const input = screen.getByLabelText(new RegExp(SEARCH_TEXTS.label));
    await user.type(input, `${question}{Enter}`);

    await waitFor(() => expect(api.search.run).toHaveBeenCalledWith({ query: question }));
    const results = await screen.findByRole('region', { name: SEARCH_TEXTS.resultsTitle });
    expect(within(results).getByText(result.answer)).toBeInTheDocument();
    expect(within(results).getByRole('heading', { level: 3, name: SEARCH_TEXTS.understood })).toBeInTheDocument();
    expect(within(results).getByText(result.parsed.explanation)).toBeInTheDocument();
    expect(within(results).getByText(SEARCH_TEXTS.period('כל התקופה'))).toBeInTheDocument();
    await waitFor(() => expect(politeRegion()).toHaveTextContent(result.answer));

    const dayLink = within(results).getByRole('link', { name: /20 בספטמבר 2026/ });
    expect(dayLink).toHaveAttribute('href', '/day/2026-09-20');
    expect(dayLink.parentElement).toHaveTextContent('מצב רוח 5, אנרגיה 3, לחץ 6, שינה 5 שעות, רשומה אחת');

    const entryLink = within(results).getByRole('link', { name: 'יום ארוך' });
    expect(entryLink).toHaveAttribute('href', '/entry/3');
    const marks = Array.from(document.querySelectorAll('mark')).map((m) => m.textContent);
    expect(marks).toEqual(['עייף']);

    // Recent questions are remembered.
    const recent = screen.getByRole('region', { name: SEARCH_TEXTS.recentTitle });
    expect(within(recent).getByRole('button', { name: question })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(RECENT_QUESTIONS_KEY) ?? '[]')).toEqual([question]);
  });

  it('refuses an empty question with a field error', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: SEARCH_TEXTS.submit }));
    const input = screen.getByLabelText(new RegExp(SEARCH_TEXTS.label));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(new RegExp(SEARCH_TEXTS.emptyQuestion));
    expect(input).toHaveFocus();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(SEARCH_TEXTS.emptyQuestion));
    expect(api.search.run).not.toHaveBeenCalled();
  });

  it('an example button fills the input without searching', async () => {
    const { user } = renderPage();
    const examples = searchExamples();
    expect(examples).toHaveLength(SEARCH_EXAMPLE_KEYS.length);
    await user.click(screen.getByRole('button', { name: examples[2] }));
    const input = screen.getByLabelText(new RegExp(SEARCH_TEXTS.label));
    expect(input).toHaveValue(examples[2]);
    expect(input).toHaveFocus();
    expect(api.search.run).not.toHaveBeenCalled();
  });

  it('runs the question from the ?q= query parameter on arrival', async () => {
    renderPage(`/search?q=${encodeURIComponent('באילו ימים הייתי לחוץ?')}`);
    await waitFor(() => expect(api.search.run).toHaveBeenCalledWith({ query: 'באילו ימים הייתי לחוץ?' }));
    expect(screen.getByLabelText(new RegExp(SEARCH_TEXTS.label))).toHaveValue('באילו ימים הייתי לחוץ?');
    const results = await screen.findByRole('region', { name: SEARCH_TEXTS.resultsTitle });
    expect(within(results).getByText(result.answer)).toBeInTheDocument();
    expect(api.search.run).toHaveBeenCalledTimes(1);
  });

  it('"נקה" clears the recent questions and a recent question re-runs the search', async () => {
    window.localStorage.setItem(RECENT_QUESTIONS_KEY, JSON.stringify(['באילו ימים הייתי לחוץ?', question]));
    const { user } = renderPage();
    const recent = screen.getByRole('region', { name: SEARCH_TEXTS.recentTitle });
    await user.click(within(recent).getByRole('button', { name: question }));
    await waitFor(() => expect(api.search.run).toHaveBeenCalledWith({ query: question }));
    const results = await screen.findByRole('region', { name: SEARCH_TEXTS.resultsTitle });
    expect(within(results).getByText(result.answer)).toBeInTheDocument();
    // The re-run question moves to the front.
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(RECENT_QUESTIONS_KEY) ?? '[]')).toEqual([question, 'באילו ימים הייתי לחוץ?']));

    await user.click(screen.getByRole('button', { name: SEARCH_TEXTS.clearRecent }));
    expect(screen.queryByRole('region', { name: SEARCH_TEXTS.recentTitle })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(RECENT_QUESTIONS_KEY) ?? 'null')).toEqual([]);
    // The focused "Clear" button is gone with its section: focus goes to the question field, not <body>.
    expect(screen.getByLabelText(new RegExp(SEARCH_TEXTS.label))).toHaveFocus();
  });

  it("never shows another account's recent questions (kept per account, the old device-wide list is ignored)", () => {
    window.localStorage.setItem(recentQuestionsKey('u_someone_else'), JSON.stringify(['when did I feel anxious?']));
    window.localStorage.setItem('mpd.search.recent', JSON.stringify(['an old shared question']));
    renderPage();
    expect(screen.queryByRole('region', { name: SEARCH_TEXTS.recentTitle })).not.toBeInTheDocument();
    expect(screen.queryByText('when did I feel anxious?')).not.toBeInTheDocument();
    expect(screen.queryByText('an old shared question')).not.toBeInTheDocument();
  });

  it('a text search shows the tags, says how many matches are shown and loads more on request', async () => {
    const entry = (id: number) => ({ ...result.entries[0], id, title: `רשומה ${id}`, excerpt: 'יום רגיל', emotions: [], tags: id === 1 ? ['עבודה', 'משפחה'] : [] });
    const tagSearch: SearchResult = {
      ...result,
      parsed: { ...result.parsed, intent: 'list_entries', textTerms: ['עבודה'], emotions: [] },
      days: [],
      entries: [1, 2, 3].map(entry),
      totalMatches: 5,
    };
    vi.mocked(api.search.run).mockResolvedValueOnce(tagSearch);
    const { user } = renderPage();
    await user.type(screen.getByLabelText(new RegExp(SEARCH_TEXTS.label)), 'רשומות עם התגית עבודה{Enter}');
    const results = await screen.findByRole('region', { name: SEARCH_TEXTS.resultsTitle });

    // The tag that matched is visible (and highlighted) although the text does not contain the word.
    const tags = within(results).getByRole('list', { name: ET.tags });
    expect(within(tags).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['#עבודה', '#משפחה']);
    expect(Array.from(document.querySelectorAll('mark')).map((m) => m.textContent)).toEqual(['עבודה']);

    expect(within(results).getByText(ET.resultsCount(3, 5))).toBeInTheDocument();
    vi.mocked(api.search.run).mockResolvedValueOnce({ ...tagSearch, entries: [1, 2, 3, 4, 5].map(entry) });
    await user.click(within(results).getByRole('button', { name: ET.loadMore }));
    await waitFor(() => expect(api.search.run).toHaveBeenLastCalledWith({ query: 'רשומות עם התגית עבודה', limit: 3 + MORE_ENTRIES_STEP }));

    // Everything is shown now: no count line, no button; focus continues at the first new entry.
    const fourth = await within(results).findByRole('link', { name: 'רשומה 4' });
    await waitFor(() => expect(fourth).toHaveFocus());
    expect(within(results).getByRole('link', { name: 'רשומה 5' })).toBeInTheDocument();
    expect(within(results).queryByRole('button', { name: ET.loadMore })).not.toBeInTheDocument();
    expect(within(results).queryByText(ET.resultsCount(3, 5))).not.toBeInTheDocument();
    await waitFor(() => expect(politeRegion()).toHaveTextContent(ET.loadedMore(2)));
  });

  it('day answers (ranking, filters, emotions) offer no "Load more": their lists are complete', async () => {
    vi.mocked(api.search.run).mockResolvedValueOnce({ ...result, parsed: { ...result.parsed, intent: 'metric_filter' }, totalMatches: 7 });
    const { user } = renderPage();
    await user.type(screen.getByLabelText(new RegExp(SEARCH_TEXTS.label)), 'ימים עם שינה פחות מ-6{Enter}');
    const results = await screen.findByRole('region', { name: SEARCH_TEXTS.resultsTitle });
    expect(within(results).getByRole('link', { name: 'יום ארוך' })).toBeInTheDocument();
    expect(within(results).queryByRole('button', { name: ET.loadMore })).not.toBeInTheDocument();
  });

  it('renders a line chart when the server returns a series and shows API errors', async () => {
    vi.mocked(api.search.run).mockResolvedValueOnce({
      ...result,
      entries: [],
      days: [],
      series: {
        metric: 'mood',
        label: 'מצב רוח',
        unit: '',
        points: [
          { date: '2026-09-01', value: 6 },
          { date: '2026-09-02', value: 8 },
        ],
        movingAvg: [
          { date: '2026-09-01', value: null },
          { date: '2026-09-02', value: null },
        ],
        mean: 7,
        min: 6,
        max: 8,
        count: 2,
        previousMean: null,
      },
    });
    const { user } = renderPage();
    const input = screen.getByLabelText(new RegExp(SEARCH_TEXTS.label));
    await user.type(input, 'איך השתנה מצב הרוח שלי?{Enter}');
    expect(await screen.findByRole('img', { name: 'מצב רוח' })).toBeInTheDocument();

    vi.mocked(api.search.run).mockRejectedValueOnce(new ApiClientError(500, { code: 'OTHER', message: 'השרת לא הצליח לענות' }));
    await user.clear(input);
    await user.type(input, 'מתי הייתי שמח?{Enter}');
    await waitFor(() => expect(document.querySelector('.alert--error')).toHaveTextContent('השרת לא הצליח לענות'));
  });
});

describe('search helpers', () => {
  it('highlightTerms wraps every match in <mark>, case-insensitively, and leaves text without terms alone', () => {
    const { container } = render(<p>{highlightTerms('Work בעבודה work ועוד עבודה', ['עבודה', 'work'])}</p>);
    expect(Array.from(container.querySelectorAll('mark')).map((m) => m.textContent)).toEqual(['Work', 'עבודה', 'work', 'עבודה']);
    expect(highlightTerms('טקסט', [])).toBe('טקסט');
    expect(highlightTerms('טקסט', ['  '])).toBe('טקסט');
  });

  it('highlightTerms also marks the inflected forms of a Hebrew word ending in a final letter', () => {
    const { container } = render(<p>{highlightTerms('עייפות גדולה, הייתי עייפה וגם עייף', ['עייף'])}</p>);
    expect(Array.from(container.querySelectorAll('mark')).map((m) => m.textContent)).toEqual(['עייפ', 'עייפ', 'עייף']);
    // A short word is marked only in its own form.
    const short = render(<p>{highlightTerms('הימים ליד הים', ['הים'])}</p>);
    expect(Array.from(short.container.querySelectorAll('mark')).map((m) => m.textContent)).toEqual(['הים']);
  });

  it('highlightTerms marks a one- or two-letter Hebrew word only as a whole word, after prefix letters', () => {
    const { container } = render(<p>{highlightTerms('ימים טובים: ים, בים ובים. (ים)', ['ים'])}</p>);
    expect(Array.from(container.querySelectorAll('mark')).map((m) => m.textContent)).toEqual(['ים', 'ים', 'ים', 'ים']);
    expect(container.textContent).toBe('ימים טובים: ים, בים ובים. (ים)');
  });

  it('dayMetricsText puts the asked metric first and skips nulls', () => {
    expect(dayMetricsText(day, 'sleepHours')).toBe('שינה 5 שעות, מצב רוח 5, אנרגיה 3, לחץ 6, רשומה אחת');
    expect(dayMetricsText({ ...day, mood: null, energy: null, stress: null, sleepHours: null, entryCount: 0 }, null)).toBe(SEARCH_TEXTS.noRatings);
  });

  it('the metrics line and the example questions follow the UI language (English)', () => {
    setCurrentLocale('en');
    expect(dayMetricsText(day, 'sleepHours')).toBe('sleep 5 hours, mood 5, energy 3, stress 6, 1 entry');
    expect(dayMetricsText({ ...day, entryCount: 2 }, null)).toBe('mood 5, energy 3, stress 6, sleep 5 hours, 2 entries');
    expect(searchExamples()[1]).toBe('When did I write that I was tired?');
    expect(SEARCH_TEXTS.matches(1)).toBe('1 match found');
    expect(SEARCH_TEXTS.period('All time')).toBe('Period: All time');
  });
});
