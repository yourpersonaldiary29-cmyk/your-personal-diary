import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { HabitWithProgress, HomeSummary, Insight } from '@shared/types';
import { ApiClientError } from '@/api';
import * as api from '@/api';
import { T } from '@/constants/texts';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { politeRegion, renderWithProviders } from '@/test/render';
import HomePage, { HOME_TEXTS } from './HomePage';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

// The expectations below assert the Hebrew wording; the UI defaults to English.
pinLocaleForTests('he');

const water: HabitWithProgress = {
  habit: {
    id: 1,
    name: 'שתיית מים',
    description: 'כוסות מים במהלך היום',
    target: 8,
    unit: 'כוסות',
    frequency: 'daily',
    reminderTime: null,
    reminderEnabled: false,
    isArchived: false,
    sortOrder: 0,
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  today: { id: 10, habitId: 1, date: '2026-09-23', value: 5, completed: false, note: '' },
  currentStreak: 3,
  bestStreak: 7,
  weekTotal: 20,
  completedLast30: 21,
  completionRate30: 0.7,
  targetMet: false,
};

const sleepOnTime: HabitWithProgress = {
  habit: { ...water.habit, id: 2, name: 'שינה בזמן', description: '', target: 1, unit: 'פעמים', sortOrder: 1 },
  today: null,
  currentStreak: 0,
  bestStreak: 4,
  weekTotal: 2,
  completedLast30: 12,
  completionRate30: 0.4,
  targetMet: false,
};

const insight: Insight = {
  id: 'exercise_mood',
  category: 'exercise_mood',
  strength: 'strong',
  title: 'פעילות גופנית ומצב רוח',
  text: 'נראה שבימים עם פעילות גופנית מצב הרוח שלך גבוה יותר.',
  explanation: 'בדקתי 43 ימים.',
  evidence: {
    daysExamined: 43,
    metricLabel: 'מצב רוח',
    groupALabel: 'ימים עם פעילות',
    groupACount: 17,
    groupAMean: 8.1,
    groupBLabel: 'ימים בלי פעילות',
    groupBCount: 26,
    groupBMean: 6.9,
    correlation: null,
    effectSize: 1.2,
    dates: [],
    extra: [],
  },
  periodStart: '2026-08-24',
  periodEnd: '2026-09-23',
  score: 80,
  positive: true,
};

const summary: HomeSummary = {
  today: '2026-09-23',
  todayWeekday: 'רביעי',
  todayEntryCount: 1,
  entryStreak: 5,
  lastEntry: {
    id: 7,
    date: '2026-09-23',
    time: '08:30',
    title: 'בוקר טוב',
    excerpt: 'קמתי מוקדם והלכתי להליכה קצרה.',
    mood: 8,
    energy: 7,
    stress: 3,
    sleepHours: 7.5,
    emotions: ['happy'],
    tags: ['עבודה'],
  },
  weekMoodAvg: 7.2,
  weekEnergyAvg: null,
  weekStressAvg: 4,
  weekSleepAvg: 6.8,
  habitsToday: [water, sleepOnTime],
  topInsight: insight,
  totalEntries: 12,
};

function renderHome() {
  return renderWithProviders(<HomePage />, { auth: 'authenticated', route: '/' });
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.mocked(api.insights.home).mockReset().mockResolvedValue(summary);
    vi.mocked(api.habits.log).mockReset().mockResolvedValue({ id: 11, habitId: 1, date: '2026-09-23', value: 6, completed: false, note: '' });
    vi.mocked(api.habits.removeLog).mockReset().mockResolvedValue(undefined);
  });

  it('shows the greeting, today summary, week averages, top insight and last entry', async () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: HOME_TEXTS.title })).toBeInTheDocument();
    expect(screen.getByText(T.greetingShort('דנה'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: HOME_TEXTS.newEntry })).toHaveAttribute('href', '/new');

    expect(await screen.findByText('רצף כתיבה: 5 ימים')).toBeInTheDocument();
    expect(screen.getByText('רשומה אחת היום')).toBeInTheDocument();

    const tiles = screen.getByRole('list', { name: HOME_TEXTS.weekAverages });
    const items = within(tiles).getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toContain('מצב רוח');
    expect(items[0]).toContain('7.2 מתוך 10');
    expect(items[1]).toContain(HOME_TEXTS.noData);
    expect(items[3]).toContain('6.8 שעות');

    expect(screen.getByRole('heading', { level: 3, name: insight.title })).toBeInTheDocument();
    expect(screen.getByText('דפוס חזק')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: HOME_TEXTS.allInsights })).toHaveAttribute('href', '/insights');
    expect(screen.getByRole('link', { name: 'בוקר טוב' })).toHaveAttribute('href', '/entry/7');
    // The user's own text keeps its own direction whatever the UI direction is.
    expect(screen.getByText('בוקר טוב').tagName).toBe('BDI');
    expect(screen.getByText('קמתי מוקדם והלכתי להליכה קצרה.')).toHaveAttribute('dir', 'auto');

    // Habit progress text (paragraph + the progress bar's visible text) and the bar itself.
    expect(screen.getAllByText('5 מתוך 8 כוסות').length).toBeGreaterThan(0);
    expect(screen.getByRole('progressbar', { name: 'שתיית מים' })).toHaveAttribute('aria-valuetext', '5 מתוך 8 כוסות');
  });

  it('"+1" logs today\'s value plus one and reloads the summary', async () => {
    const { user } = renderHome();
    await screen.findByText('רצף כתיבה: 5 ימים');
    const plus = screen.getByRole('button', { name: '+1 שתיית מים' });
    await user.click(plus);

    await waitFor(() => expect(api.habits.log).toHaveBeenCalledTimes(1));
    expect(api.habits.log).toHaveBeenCalledWith(expect.objectContaining({ habitId: 1, date: '2026-09-23', value: 6 }));
    await waitFor(() => expect(api.insights.home).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(politeRegion()).toHaveTextContent('שתיית מים: 6 כוסות'));
  });

  it('a habit with target 1 offers "סמן כהושלם" which logs the value 1', async () => {
    const { user } = renderHome();
    await screen.findByText('רצף כתיבה: 5 ימים');
    const done = screen.getByRole('button', { name: 'סמן כהושלם שינה בזמן' });
    await user.click(done);
    await waitFor(() => expect(api.habits.log).toHaveBeenCalledWith(expect.objectContaining({ habitId: 2, date: '2026-09-23', value: 1 })));
  });

  it('setting a value through the number box saves it', async () => {
    // Rendered and loaded inside one act() scope: the summary arrives (the mock resolves at once) and
    // every effect of the loaded page has run before the box is touched. Outside act the effect of
    // HabitQuickLog that copies the server value into the draft is deferred by React's scheduler, and
    // on a busy machine it ran after user.clear and put the 5 back - the typed 7 became 57.
    let rendered!: ReturnType<typeof renderHome>;
    await act(async () => {
      rendered = renderHome();
    });
    const { user } = rendered;
    const box = screen.getByLabelText(/כמות לשתיית מים/);
    await user.clear(box);
    await user.type(box, '7');
    await user.click(screen.getByRole('button', { name: 'עדכן שתיית מים' }));
    await waitFor(() => expect(api.habits.log).toHaveBeenCalledWith(expect.objectContaining({ habitId: 1, value: 7 })));
  });

  it('renders the same page in English when the UI language is English', async () => {
    setCurrentLocale('en');
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New entry' })).toHaveAttribute('href', '/new');
    expect(await screen.findByText('Writing streak: 5 days')).toBeInTheDocument();
    expect(screen.getByText('1 entry today')).toBeInTheDocument();
    expect(screen.getByText('12 entries in the diary in total')).toBeInTheDocument();
    const tiles = screen.getByRole('list', { name: 'Averages of the last 7 days' });
    const items = within(tiles).getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toContain('Mood');
    expect(items[0]).toContain('7.2 of 10');
    expect(items[1]).toContain('No data');
    expect(items[3]).toContain('6.8 hours');
    expect(screen.getByText('Strong pattern')).toBeInTheDocument();
    // User data (habit names and units) stays as entered.
    expect(screen.getByRole('progressbar', { name: 'שתיית מים' })).toHaveAttribute('aria-valuetext', '5 of 8 כוסות');
    expect(screen.getByRole('button', { name: 'Mark as done שינה בזמן' })).toBeInTheDocument();
  });

  it('shows an error with a retry button when the summary cannot be loaded', async () => {
    vi.mocked(api.insights.home).mockRejectedValueOnce(new ApiClientError(0, { code: 'OTHER', message: T.noServer }));
    const { user } = renderHome();
    await waitFor(() => expect(document.querySelector('.alert--error')).toHaveTextContent(T.noServer));
    await user.click(screen.getByRole('button', { name: T.retry }));
    expect(await screen.findByText('רצף כתיבה: 5 ימים')).toBeInTheDocument();
  });
});
