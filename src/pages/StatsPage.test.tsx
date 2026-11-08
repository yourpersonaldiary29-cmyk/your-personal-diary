import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { HabitStats, StatsOverview, StatsSeries } from '@shared/types';
import * as api from '@/api';
import { T } from '@/constants/texts';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { politeRegion, renderWithProviders } from '@/test/render';
import StatsPage, { STATS_TEXTS, chartSeries, dateFormatters, habitSummary, seriesSummary } from './StatsPage';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

// The expectations below assert the Hebrew wording; the UI defaults to English.
pinLocaleForTests('he');

// Nine SVG charts with legends, summaries and tables are heavy under the full
// parallel suite; the default 5s budget is too tight on a loaded machine.
vi.setConfig({ testTimeout: 20_000 });

const DATES = ['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23'];

function makeSeries(metric: string, label: string, unit: string, values: (number | null)[], previousMean: number | null = null): StatsSeries {
  const nums = values.filter((v): v is number => v !== null);
  const mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  return {
    metric,
    label,
    unit,
    points: DATES.map((date, i) => ({ date, value: values[i] ?? null })),
    movingAvg: DATES.map((date) => ({ date, value: mean })),
    mean,
    min: nums.length ? Math.min(...nums) : null,
    max: nums.length ? Math.max(...nums) : null,
    count: nums.length,
    previousMean,
  };
}

const water: HabitStats = {
  habitId: 1,
  name: 'שתיית מים',
  unit: 'כוסות',
  target: 8,
  frequency: 'daily',
  points: DATES.map((date, i) => ({ date, value: i === 2 ? null : 4 + i })),
  completionRate: 0.7,
  completedDays: 21,
  totalDays: 30,
  currentStreak: 5,
  bestStreak: 12,
};

const overview: StatsOverview = {
  period: '30d',
  from: '2026-08-25',
  to: '2026-09-23',
  mood: makeSeries('mood', 'מצב רוח', '', [6, 7, null, 8, 7], 6.5),
  energy: makeSeries('energy', 'רמת אנרגיה', '', [5, 6, 6, 7, 5], null),
  stress: makeSeries('stress', 'רמת לחץ', '', [4, 3, null, 5, 4], 4.5),
  sleepHours: makeSeries('sleepHours', 'שעות שינה', 'שעות', [7, 6.5, 8, null, 7], 7.2),
  sleepQuality: makeSeries('sleepQuality', 'איכות שינה', '', [null, null, null, null, null], null),
  exerciseMinutes: makeSeries('exerciseMinutes', 'דקות פעילות גופנית', 'דקות', [30, 0, null, 45, 20], 25),
  entriesPerDay: makeSeries('entries', 'רשומות יומן', 'רשומות', [1, 1, 0, 2, 1], 0.8),
  habits: [water],
  totalEntries: 5,
  daysWithEntries: 4,
  weekdayMood: [6.5, 7, 7.2, null, 6.8, 8, 7.5],
  weekdayEnergy: [5, 6, 6, 6.5, 5.5, 7, 6],
  weekdayStress: [5, 4, 4, 3.5, 4, 2, 3],
};

function renderPage() {
  return renderWithProviders(<StatsPage />, { auth: 'authenticated', route: '/stats' });
}

describe('StatsPage', () => {
  beforeEach(() => {
    vi.mocked(api.stats.overview).mockReset().mockResolvedValue(overview);
  });

  it('renders a chart per metric with a comparison summary, the weekday chart and habit charts', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: STATS_TEXTS.title })).toBeInTheDocument();
    expect(api.stats.overview).toHaveBeenCalledWith('30d');

    expect(await screen.findByRole('img', { name: STATS_TEXTS.overTime('מצב רוח') })).toBeInTheDocument();
    expect(screen.getByText(/5 רשומות ב-4 ימים/)).toBeInTheDocument();

    const mood = screen.getByRole('region', { name: 'מצב רוח' });
    expect(within(mood).getByText(/ממוצע 7\.0 \(4 ערכים, מינימום 6, מקסימום 8\)\. לעומת 6\.5 בתקופה הקודמת \(‎\+0\.5\)\./)).toBeInTheDocument();
    // The moving average is a second, dashed series.
    const legend = within(mood).getAllByRole('listitem').map((li) => li.textContent);
    expect(legend).toContain(STATS_TEXTS.movingAvg);
    const dashed = mood.querySelector('svg.chart__svg [data-series="1"] path[fill="none"]');
    expect(dashed).toHaveAttribute('stroke-dasharray', '7 4');

    // No previous mean -> no comparison sentence.
    const energy = screen.getByRole('region', { name: 'רמת אנרגיה' });
    expect(within(energy).getByText(/^ממוצע 5\.8/)).not.toHaveTextContent('לעומת');
    // All-null series -> "אין נתונים" text instead of a chart.
    const quality = screen.getByRole('region', { name: 'איכות שינה' });
    expect(within(quality).getByText(STATS_TEXTS.noValues)).toBeInTheDocument();
    expect(within(quality).queryByRole('img')).not.toBeInTheDocument();

    expect(screen.getByRole('img', { name: STATS_TEXTS.overTime('פעילות גופנית') })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: STATS_TEXTS.overTime('רשומות ביומן') })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: STATS_TEXTS.weekdayChart })).toHaveAccessibleDescription(/7 נקודות זמן, מ-ראשון עד שבת/);
    expect(screen.getByRole('img', { name: STATS_TEXTS.habitChart('שתיית מים') })).toBeInTheDocument();
    expect(screen.getByText('השלמה: 70% (21 מתוך 30 ימים), רצף נוכחי: 5 ימים, שיא: 12 ימים')).toBeInTheDocument();
  });

  it('"הצג כטבלה" reveals the chart data as a table with the moving average column', async () => {
    const { user } = renderPage();
    await screen.findByRole('img', { name: STATS_TEXTS.overTime('מצב רוח') });
    const mood = screen.getByRole('region', { name: 'מצב רוח' });
    const toggle = within(mood).getByRole('button', { name: T.showAsTable });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const table = within(mood).getByRole('table', { name: STATS_TEXTS.overTime('מצב רוח') });
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['תאריך', 'מצב רוח', STATS_TEXTS.movingAvg]);
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(6);
    expect(within(rows[3]).getAllByRole('cell')[0]).toHaveTextContent(T.notReported);
  });

  it('changing the period reloads the overview and announces the new totals', async () => {
    const { user } = renderPage();
    await screen.findByRole('img', { name: STATS_TEXTS.overTime('מצב רוח') });
    // The first load is not announced (the page title is).
    expect(politeRegion()).not.toHaveTextContent(STATS_TEXTS.overview(overview));
    const year = { ...overview, period: '1y' as const, from: '2025-09-24', totalEntries: 7, daysWithEntries: 6 };
    vi.mocked(api.stats.overview).mockResolvedValue(year);
    await user.selectOptions(screen.getByLabelText(new RegExp(STATS_TEXTS.period)), '1y');
    await waitFor(() => expect(api.stats.overview).toHaveBeenLastCalledWith('1y'));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(STATS_TEXTS.overview(year)));
  });

  it('shows an empty state when there are no entries and no habits', async () => {
    vi.mocked(api.stats.overview).mockResolvedValue({ ...overview, totalEntries: 0, daysWithEntries: 0, habits: [] });
    renderPage();
    expect(await screen.findByRole('heading', { level: 2, name: STATS_TEXTS.emptyTitle })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('stats helpers', () => {
  it('seriesSummary includes the previous-period comparison only when available', () => {
    expect(seriesSummary(overview.mood)).toBe('ממוצע 7.0 (4 ערכים, מינימום 6, מקסימום 8). לעומת 6.5 בתקופה הקודמת (‎+0.5).');
    expect(seriesSummary(overview.sleepHours)).toContain('7.1 שעות');
    expect(seriesSummary(overview.energy)).not.toContain('לעומת');
    expect(seriesSummary(overview.sleepQuality)).toBe(STATS_TEXTS.noValues);
  });

  it('chartSeries adds the dashed moving average only when it has values', () => {
    expect(chartSeries(overview.mood).map((s) => s.label)).toEqual(['מצב רוח', STATS_TEXTS.movingAvg]);
    expect(chartSeries(overview.mood)[1].dash).toBe('7 4');
    expect(chartSeries(overview.sleepQuality)).toHaveLength(1);
  });

  it('adds the year to table and tooltip dates only when the period crosses a new year', () => {
    setCurrentLocale('en');
    expect(dateFormatters({ from: '2026-09-01', to: '2026-09-30' })).toEqual({});
    const long = dateFormatters({ from: '2025-10-01', to: '2026-09-30' });
    expect(long.xLabelFormatter?.('2025-10-01')).toBe('01/10/2025');
    expect(long.xTickFormatter?.('2025-10-01')).toBe('01/10');
    expect(long.xLabelFormatter?.('Sunday')).toBe('Sunday');
  });

  it('habitSummary uses weeks for weekly habits', () => {
    expect(habitSummary({ ...water, frequency: 'weekly', completedDays: 3, totalDays: 4, currentStreak: 2, bestStreak: 3 })).toBe(
      'השלמה: 70% (3 מתוך 4 שבועות), רצף נוכחי: שבועיים, שיא: 3 שבועות',
    );
  });

  it('the summaries follow the UI language (English)', () => {
    setCurrentLocale('en');
    expect(seriesSummary(overview.mood)).toBe('Mean 7.0 (4 values, minimum 6, maximum 8). Compared with 6.5 in the previous period (‎+0.5).');
    expect(seriesSummary(overview.energy)).toBe('Mean 5.8 (5 values, minimum 5, maximum 7).');
    expect(seriesSummary(overview.entriesPerDay)).toContain('entries per day');
    // Entries per day: whole numbers on the chart (decimals 0), but the mean keeps one decimal.
    expect(seriesSummary(overview.entriesPerDay, 0)).toBe(
      'Mean 1.0 entries per day (5 days, minimum 0, maximum 2). Compared with 0.8 entries per day in the previous period (‎+0.2).',
    );
    // A difference that rounds to zero at the shown precision reads "no change", never "+0".
    expect(seriesSummary({ ...overview.exerciseMinutes, unit: 'minutes', mean: 24, previousMean: 23.8 }, 0)).toBe(
      'Mean 24 minutes (4 values, minimum 0 minutes, maximum 45 minutes). No change from the previous period (24 minutes).',
    );
    expect(seriesSummary(overview.sleepQuality)).toBe('No data in this period.');
    expect(habitSummary(water)).toBe('Completion: 70% (21 of 30 days), current streak: 5 days, best: 12 days');
    expect(habitSummary({ ...water, frequency: 'weekly', completedDays: 3, totalDays: 4, currentStreak: 1, bestStreak: 3 })).toBe(
      'Completion: 70% (3 of 4 weeks), current streak: 1 week, best: 3 weeks',
    );
    expect(STATS_TEXTS.overview(overview)).toMatch(/^5 entries on 4 days \(/);
    expect(STATS_TEXTS.metric('sleepHours')).toBe('Sleep hours');
  });
});
