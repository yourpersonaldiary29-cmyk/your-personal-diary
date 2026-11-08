import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import type { CalendarDay, EntrySummary } from '@shared/types';
import * as api from '@/api';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { ET } from '@/pages/entries';
import { LocationDisplay, politeRegion, renderWithProviders } from '@/test/render';
import DiaryPage, { diaryRange, groupByDay, monthSummaries, shiftAnchor } from './DiaryPage';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

// The dates and labels below are asserted in Hebrew.
pinLocaleForTests('he');

// Several user interactions per test on a page that re-renders a whole
// timeline; under the full parallel suite the 5s default is too tight.
vi.setConfig({ testTimeout: 20_000 });

function item(overrides: Partial<EntrySummary> = {}): EntrySummary {
  return {
    id: 1,
    date: '2026-09-07',
    time: '08:30',
    title: 'בוקר',
    excerpt: 'טקסט הבוקר',
    mood: 7,
    energy: 6,
    stress: 3,
    sleepHours: 7.5,
    emotions: ['happy'],
    tags: ['עבודה'],
    ...overrides,
  };
}

const items: EntrySummary[] = [
  item(),
  item({ id: 2, time: '20:00', title: 'ערב', excerpt: '', mood: null, energy: null, stress: null, sleepHours: null, emotions: [], tags: [] }),
  item({ id: 3, date: '2026-09-08', time: '09:00', title: '', excerpt: 'בלי כותרת', mood: 5 }),
];

function calendarDay(overrides: Partial<CalendarDay>): CalendarDay {
  return {
    date: '2026-09-07',
    mood: null,
    energy: null,
    stress: null,
    sleepHours: null,
    hasEntry: false,
    entryCount: 0,
    habitsCompleted: 0,
    habitsTotal: 0,
    titles: [],
    ...overrides,
  };
}

function renderPage(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/diary" element={<DiaryPage />} />
      <Route path="*" element={<LocationDisplay />} />
    </Routes>,
    { auth: 'authenticated', route },
  );
}

describe('DiaryPage helpers', () => {
  it('computes ranges for every view mode', () => {
    expect(diaryRange('day', '2026-09-07', 0)).toMatchObject({ from: '2026-09-07', to: '2026-09-07' });
    expect(diaryRange('week', '2026-09-07', 0)).toMatchObject({ from: '2026-09-06', to: '2026-09-12', label: 'שבוע 6.9.2026 - 12.9.2026' });
    expect(diaryRange('week', '2026-09-07', 1)).toMatchObject({ from: '2026-09-07', to: '2026-09-13' });
    expect(diaryRange('month', '2026-09-07', 0)).toMatchObject({ from: '2026-09-01', to: '2026-09-30', label: 'ספטמבר 2026' });
    expect(diaryRange('year', '2026-09-07', 0)).toMatchObject({ from: '2026-01-01', to: '2026-12-31', label: 'שנת 2026' });
    expect(shiftAnchor('week', '2026-09-07', 1)).toBe('2026-09-14');
    expect(shiftAnchor('month', '2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftAnchor('year', '2026-09-07', -1)).toBe('2025-09-07');
  });

  it('labels the ranges in English when the UI language is English', () => {
    setCurrentLocale('en');
    expect(diaryRange('week', '2026-09-07', 0).label).toBe('Week 06/09/2026 - 12/09/2026');
    expect(diaryRange('month', '2026-09-07', 0).label).toBe('September 2026');
    expect(diaryRange('year', '2026-09-07', 0).label).toBe('2026');
    expect(diaryRange('day', '2026-09-07', 0).label).toMatch(/^Monday, 7 September 2026( \(.+\))?$/);
    expect(ET.entriesCount(1)).toBe('1 entry');
    expect(ET.resultsCount(2, 5)).toBe('Showing 2 of 5 entries');
  });

  it('groups summaries by day in ascending order', () => {
    const groups = groupByDay([items[2], items[1], items[0]]);
    expect(groups.map((g) => g.date)).toEqual(['2026-09-07', '2026-09-08']);
    expect(groups[0].items.map((e) => e.id)).toEqual([1, 2]);
  });

  it('aggregates calendar days into monthly counts and mean mood', () => {
    const summaries = monthSummaries(
      [calendarDay({ date: '2026-09-07', mood: 7, entryCount: 2 }), calendarDay({ date: '2026-09-08', mood: 5, entryCount: 1 }), calendarDay({ date: '2026-10-01', entryCount: 1 })],
      2026,
    );
    expect(summaries).toHaveLength(12);
    expect(summaries[8]).toEqual({ month: 9, entries: 3, mood: 6 });
    expect(summaries[9]).toEqual({ month: 10, entries: 1, mood: null });
    expect(summaries[0]).toEqual({ month: 1, entries: 0, mood: null });
  });
});

describe('DiaryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.entries.list).mockResolvedValue({ items, total: 3 });
    vi.mocked(api.entries.tags).mockResolvedValue([
      { name: 'עבודה', count: 2 },
      { name: 'משפחה', count: 1 },
    ]);
    vi.mocked(api.calendar.range).mockResolvedValue([]);
  });

  it('groups entries by day and applies the ?tag= filter', async () => {
    const { user } = renderPage('/diary?tag=עבודה&date=2026-09-07');

    expect(screen.getByRole('heading', { level: 1, name: ET.diaryTitle })).toBeInTheDocument();
    const day7 = await screen.findByRole('heading', { level: 2, name: /7 בספטמבר 2026/ });
    const day8 = screen.getByRole('heading', { level: 2, name: /8 בספטמבר 2026/ });
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);

    // The week view around 2026-09-07 (Sunday first) with the tag from the query string.
    expect(api.entries.list).toHaveBeenCalledWith({
      from: '2026-09-06',
      to: '2026-09-12',
      text: undefined,
      tag: 'עבודה',
      limit: 500,
      sortDesc: false,
    });
    expect(screen.getByRole('combobox', { name: ET.tagFilter })).toHaveValue('עבודה');
    expect(screen.getByRole('tab', { name: ET.viewWeek })).toHaveAttribute('aria-selected', 'true');

    // Two entries under the 7th, one (untitled) under the 8th.
    const section7 = day7.closest('section')!;
    expect(within(section7).getAllByRole('article')).toHaveLength(2);
    expect(within(section7).getByText('מצב רוח 7')).toBeInTheDocument();
    expect(within(section7).getByText('שמח')).toBeInTheDocument();
    expect(within(section7).getByRole('link', { name: ET.openNamed('בוקר') })).toHaveAttribute('href', '/entry/1');
    expect(within(section7).getByRole('link', { name: 'פתח: בוקר' })).toHaveTextContent(/^פתח$/);
    const section8 = day8.closest('section')!;
    expect(within(section8).getByRole('heading', { level: 3, name: ET.untitled })).toBeInTheDocument();
    expect(within(day7).getByRole('link')).toHaveAttribute('href', '/day/2026-09-07');
    expect(screen.getByText(ET.resultsCount(3, 3))).toBeInTheDocument();

    // Clearing the tag drops the filter.
    await user.selectOptions(screen.getByRole('combobox', { name: ET.tagFilter }), '');
    await waitFor(() => expect(vi.mocked(api.entries.list).mock.calls.at(-1)?.[0]?.tag).toBeUndefined());
  });

  it('writes the card times as the language does: 24-hour in Hebrew, 12-hour in Hindi', async () => {
    const times = () => Array.from(document.querySelectorAll('.entry-card__time'), (el) => el.textContent);
    const first = renderPage('/diary?date=2026-09-07');
    await screen.findByRole('heading', { level: 2, name: /7 בספטמבר 2026/ });
    expect(times()).toEqual(['08:30', '20:00', '09:00']);
    first.unmount();

    setCurrentLocale('hi');
    renderPage('/diary?date=2026-09-07');
    await waitFor(() => expect(times()).toHaveLength(3));
    expect(times().map((t) => t?.toLowerCase().replace(/\s/g, ' '))).toEqual(['08:30 am', '08:00 pm', '09:00 am']);
    // The machine-readable value stays the stored 24-hour time.
    expect(document.querySelector('.entry-card__time')).toHaveAttribute('datetime', '2026-09-07T08:30');
  });

  it('switches to the month view through the tabs, announces the range and offers "טען עוד"', async () => {
    vi.mocked(api.entries.list).mockResolvedValue({ items: [items[0]], total: 2 });
    const { user } = renderPage('/diary?date=2026-09-07');
    await screen.findByRole('heading', { level: 2, name: /7 בספטמבר 2026/ });

    await user.click(screen.getByRole('tab', { name: ET.viewMonth }));
    await waitFor(() =>
      expect(api.entries.list).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-09-01', to: '2026-09-30' })),
    );
    await waitFor(() => expect(politeRegion()).toHaveTextContent('ספטמבר 2026'));

    vi.mocked(api.entries.list).mockResolvedValueOnce({ items: [items[2]], total: 2 });
    await user.click(screen.getByRole('button', { name: ET.loadMore }));
    await waitFor(() => expect(api.entries.list).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1 })));
    expect(await screen.findByRole('heading', { level: 2, name: /8 בספטמבר 2026/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ET.loadMore })).not.toBeInTheDocument();
  });

  it('shows an empty state with a link to /new when nothing matches', async () => {
    vi.mocked(api.entries.list).mockResolvedValue({ items: [], total: 0 });
    renderPage('/diary');
    const heading = await screen.findByRole('heading', { level: 2, name: ET.noEntriesTitle });
    const emptyState = heading.closest('.empty-state') as HTMLElement;
    expect(within(emptyState).getByRole('link', { name: ET.newEntry })).toHaveAttribute('href', '/new');
    expect(screen.getByText(ET.noEntriesText)).toBeInTheDocument();
  });

  it('year view lists months with entry counts and mean mood from api.calendar.range', async () => {
    vi.mocked(api.calendar.range).mockResolvedValue([
      calendarDay({ date: '2026-09-07', mood: 7, entryCount: 2, hasEntry: true }),
      calendarDay({ date: '2026-09-08', mood: 5, entryCount: 1, hasEntry: true }),
    ]);
    const { user } = renderPage('/diary?date=2026-09-07');
    await user.click(screen.getByRole('tab', { name: ET.viewYear }));

    await waitFor(() => expect(api.calendar.range).toHaveBeenCalledWith('2026-01-01', '2026-12-31'));
    const september = await screen.findByRole('row', { name: /ספטמבר/ });
    expect(within(september).getByText('3 רשומות')).toBeInTheDocument();
    expect(within(september).getByText('6.0')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(13);

    // A month name opens that month.
    await user.click(within(september).getByRole('button', { name: ET.openMonth('ספטמבר') }));
    expect(screen.getByRole('tab', { name: ET.viewMonth })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() =>
      expect(api.entries.list).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-09-01', to: '2026-09-30' })),
    );
    // The pressed month button is gone with the table: focus lands on the selected tab, not on <body>.
    expect(screen.getByRole('tab', { name: ET.viewMonth })).toHaveFocus();
  });

  it('"load more" moves focus to the first newly loaded entry', async () => {
    vi.mocked(api.entries.list).mockResolvedValue({ items: [items[0]], total: 2 });
    const { user } = renderPage('/diary?date=2026-09-07');
    await screen.findByRole('heading', { level: 2, name: /7 בספטמבר 2026/ });

    vi.mocked(api.entries.list).mockResolvedValueOnce({ items: [items[2]], total: 2 });
    await user.click(screen.getByRole('button', { name: ET.loadMore }));
    const opened = await screen.findByRole('link', { name: ET.openNamed(ET.untitled) });
    await waitFor(() => expect(opened).toHaveFocus());
    expect(screen.queryByRole('button', { name: ET.loadMore })).not.toBeInTheDocument();
    await waitFor(() => expect(politeRegion()).toHaveTextContent(ET.loadedMore(1)));
  });

  it('announces how many entries match after the text filter changes', async () => {
    const { user } = renderPage('/diary?date=2026-09-07');
    await screen.findByRole('heading', { level: 2, name: /7 בספטמבר 2026/ });

    vi.mocked(api.entries.list).mockResolvedValue({ items: [items[0]], total: 1 });
    await user.type(screen.getByRole('searchbox', { name: ET.textFilter }), 'בוקר');
    await waitFor(() => expect(api.entries.list).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'בוקר' })));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(ET.resultsCount(1, 1)));

    vi.mocked(api.entries.list).mockResolvedValue({ items: [], total: 0 });
    await user.type(screen.getByRole('searchbox', { name: ET.textFilter }), 'x');
    await waitFor(() => expect(politeRegion()).toHaveTextContent(ET.noEntriesFiltered));
  });
});
