import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { Insight, InsightsReport } from '@shared/types';
import * as api from '@/api';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { politeRegion, renderWithProviders } from '@/test/render';
import InsightsPage, { INSIGHTS_TEXTS } from './InsightsPage';
import { INSIGHT_CARD_TEXTS } from './insights/InsightCard';
import { STRENGTH_LABELS, groupInsights } from './insights/insight-groups';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

// The expectations below assert the Hebrew wording; the UI defaults to English.
pinLocaleForTests('he');

const sleepMood: Insight = {
  id: 'sleep_mood_lt6',
  category: 'sleep_mood',
  strength: 'strong',
  title: 'שינה ומצב רוח',
  text: 'נראה שבימים עם פחות מ-6 שעות שינה מצב הרוח שלך נמוך יותר.',
  explanation: 'בדקתי 43 ימים. ב-12 ימים ישנת פחות מ-6 שעות. מצב הרוח הממוצע בימים האלה היה 5.8, לעומת 7.4 בשאר הימים.',
  evidence: {
    daysExamined: 43,
    metricLabel: 'מצב רוח',
    groupALabel: 'ימים עם פחות מ-6 שעות שינה',
    groupACount: 12,
    groupAMean: 5.8,
    groupBLabel: 'שאר הימים',
    groupBCount: 31,
    groupBMean: 7.4,
    correlation: 0.52,
    effectSize: -1.6,
    dates: ['2026-09-10', '2026-09-12'],
    extra: [{ key: 'סף שינה', value: '6 שעות' }],
  },
  periodStart: '2026-08-24',
  periodEnd: '2026-09-23',
  score: 90,
  positive: false,
};

const weekday: Insight = {
  ...sleepMood,
  id: 'weekday_stress_sun',
  category: 'weekday',
  strength: 'moderate',
  title: 'יום ראשון לחוץ יותר',
  text: 'נראה שבימי ראשון רמת הלחץ שלך גבוהה מהממוצע.',
  explanation: 'בדקתי 6 ימי ראשון לעומת 37 ימים אחרים.',
  evidence: { ...sleepMood.evidence, dates: [], extra: [], correlation: null },
  score: 60,
  positive: null,
};

const streak: Insight = {
  ...sleepMood,
  id: 'streak_entries',
  category: 'streak',
  strength: 'weak',
  title: 'רצף כתיבה',
  text: 'כתבת ביומן 5 ימים ברצף.',
  explanation: 'ספרתי ימים רצופים עם רשומה.',
  evidence: { ...sleepMood.evidence, dates: [], extra: [], correlation: null, effectSize: null },
  score: 20,
  positive: true,
};

const report: InsightsReport = {
  generatedAt: '2026-09-23T10:00:00.000Z',
  period: '30d',
  periodStart: '2026-08-24',
  periodEnd: '2026-09-23',
  daysWithData: 43,
  insights: [weekday, sleepMood, streak],
  notes: ['אין מספיק נתונים כדי לבדוק קשר בין פעילות גופנית לאנרגיה (נדרשים 14 ימים)'],
  provider: 'rules-v1',
};

function renderPage() {
  return renderWithProviders(<InsightsPage />, { auth: 'authenticated', route: '/insights' });
}

describe('InsightsPage', () => {
  beforeEach(() => {
    vi.mocked(api.insights.report).mockReset().mockResolvedValue(report);
  });

  it('groups the insights under category headings with strength badges and lists the notes', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: INSIGHTS_TEXTS.title })).toBeInTheDocument();
    expect(api.insights.report).toHaveBeenCalledWith('30d');

    await screen.findByRole('article', { name: sleepMood.title });
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['הרגלים', 'שינה ופעילות', 'ימים ושעות', INSIGHTS_TEXTS.notesTitle]);
    expect(screen.queryByText('מגמות')).not.toBeInTheDocument();

    expect(screen.getByText(/43 ימים עם נתונים ב-30 ימים/)).toBeInTheDocument();
    expect(screen.getByText(STRENGTH_LABELS.strong)).toBeInTheDocument();
    expect(screen.getByText(STRENGTH_LABELS.moderate)).toBeInTheDocument();
    expect(screen.getByText(STRENGTH_LABELS.weak)).toBeInTheDocument();
    expect(screen.getByText(report.notes[0])).toBeInTheDocument();
    await waitFor(() => expect(politeRegion()).toHaveTextContent(INSIGHTS_TEXTS.found(3)));

    // The border differs per strength (style, not colour only).
    const strong = screen.getByRole('article', { name: sleepMood.title });
    const weak = screen.getByRole('article', { name: streak.title });
    expect(strong.style.borderStyle).toBe('solid');
    expect(weak.style.borderStyle).toBe('dotted');
  });

  it('"למה קיבלתי את התובנה הזאת?" toggles the explanation, evidence table and day links', async () => {
    const { user } = renderPage();
    const article = await screen.findByRole('article', { name: sleepMood.title });
    const why = within(article).getByRole('button', { name: INSIGHT_CARD_TEXTS.why });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    // Every card has the same button text; the description tells a screen reader which insight it opens.
    expect(why).toHaveAccessibleDescription(sleepMood.title);
    expect(within(article).queryByText(sleepMood.explanation)).not.toBeInTheDocument();

    await user.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(why.getAttribute('aria-controls') ?? '');
    expect(panel).not.toBeNull();
    expect(panel).toHaveTextContent(sleepMood.explanation);

    const table = within(article).getByRole('table', { name: INSIGHT_CARD_TEXTS.evidenceCaption });
    expect(within(table).getByRole('rowheader', { name: 'ימים שנבדקו' })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /ימים שנבדקו/ })).toHaveTextContent('43');
    expect(within(table).getByRole('row', { name: /ימים עם פחות מ-6 שעות שינה/ })).toHaveTextContent('12 ימים, ממוצע 5.8');
    expect(within(table).getByRole('row', { name: /שאר הימים/ })).toHaveTextContent('31 ימים, ממוצע 7.4');
    expect(within(table).getByRole('row', { name: /מתאם/ })).toHaveTextContent('0.52');
    expect(within(table).getByRole('row', { name: /גודל ההבדל/ })).toHaveTextContent('-1.6');
    expect(within(table).getByRole('row', { name: /סף שינה/ })).toHaveTextContent('6 שעות');
    expect(within(article).getByRole('link', { name: '10.9.2026' })).toHaveAttribute('href', '/day/2026-09-10');

    await user.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'false');
    expect(within(article).queryByRole('table')).not.toBeInTheDocument();
  });

  it('changing the period reloads the report and "רענן" re-runs it', async () => {
    const { user } = renderPage();
    await screen.findByRole('article', { name: sleepMood.title });
    await user.selectOptions(screen.getByLabelText(new RegExp(INSIGHTS_TEXTS.period)), '7d');
    await waitFor(() => expect(api.insights.report).toHaveBeenLastCalledWith('7d'));
    await user.click(screen.getByRole('button', { name: INSIGHTS_TEXTS.refresh }));
    await waitFor(() => expect(api.insights.report).toHaveBeenCalledTimes(3));
  });

  it('renders headings, badges, summary and the evidence table in English when the UI language is English', async () => {
    setCurrentLocale('en');
    const { user } = renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Insights' })).toBeInTheDocument();
    const article = await screen.findByRole('article', { name: sleepMood.title });
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Habits', 'Sleep and activity', 'Days and times', 'Not checked / not enough data']);
    expect(screen.getByText(/43 days with data in the last 30 days/)).toBeInTheDocument();
    expect(screen.getByText('Strong pattern')).toBeInTheDocument();
    expect(screen.getByText('Worth attention')).toBeInTheDocument();
    await waitFor(() => expect(politeRegion()).toHaveTextContent('3 insights found'));

    await user.click(within(article).getByRole('button', { name: 'Why did I get this insight?' }));
    const table = within(article).getByRole('table', { name: 'The data behind the insight' });
    expect(within(table).getByRole('row', { name: /Days examined/ })).toHaveTextContent('43');
    expect(within(table).getByRole('row', { name: /ימים עם פחות מ-6 שעות שינה/ })).toHaveTextContent('12 days, mean 5.8');
    expect(within(table).getByRole('row', { name: /Correlation/ })).toHaveTextContent('0.52');
  });

  it('shows an empty state explaining the minimum data when there are no insights', async () => {
    vi.mocked(api.insights.report).mockResolvedValue({ ...report, insights: [], daysWithData: 3 });
    renderPage();
    expect(await screen.findByRole('heading', { level: 2, name: INSIGHTS_TEXTS.emptyTitle })).toBeInTheDocument();
    expect(screen.getByText(/לפחות 14 ימים עם נתונים/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: INSIGHTS_TEXTS.newEntry })).toHaveAttribute('href', '/new');
  });
});

describe('groupInsights', () => {
  it('keeps the group order, drops empty groups and sorts by score inside a group', () => {
    const groups = groupInsights([streak, weekday, sleepMood, { ...streak, id: 'habit_up', category: 'habit_improved', score: 70 }]);
    expect(groups.map((g) => g.group.title)).toEqual(['הרגלים', 'שינה ופעילות', 'ימים ושעות']);
    expect(groups[0].insights.map((i) => i.id)).toEqual(['habit_up', 'streak_entries']);
  });

  it('lists habit links to energy and stress (category "correlation") with the habits, not under anomalies', () => {
    const habitEnergy = { ...streak, id: 'habit_energy_4', category: 'correlation' as const, score: 5 };
    const unusualDay = { ...streak, id: 'anomaly_mood_low', category: 'anomaly' as const, score: 9 };
    const groups = groupInsights([habitEnergy, unusualDay]);
    expect(groups.map((g) => [g.group.id, g.insights.map((i) => i.id)])).toEqual([
      ['habits', ['habit_energy_4']],
      ['anomalies', ['anomaly_mood_low']],
    ]);
  });

  it('puts unknown categories into the fallback group', () => {
    const odd = { ...streak, id: 'x', category: 'brand_new' as Insight['category'] };
    const groups = groupInsights([odd]);
    expect(groups).toHaveLength(1);
    expect(groups[0].group.id).toBe('other');
  });
});
