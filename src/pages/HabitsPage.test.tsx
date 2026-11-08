import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { Habit, HabitDayStatus, HabitWithProgress } from '@shared/types';
import * as api from '@/api';
import { T } from '@/constants/texts';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { assertiveRegion, renderWithProviders } from '@/test/render';
import { todayIso } from '@/utils/dates';
import HabitsPage, { HABITS_TEXTS, historyCellText } from './HabitsPage';
import { HABIT_FORM_ERRORS, HABIT_FORM_LABELS, HABIT_FORM_TEXTS } from './habits/HabitFormDialog';
import { completionText, progressText, streakText, targetText } from './habits/habit-text';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

// The expectations below assert the Hebrew wording; the UI defaults to English.
pinLocaleForTests('he');

const today = todayIso();

const waterHabit: Habit = {
  id: 1,
  name: 'שתיית מים',
  description: 'כוסות מים במהלך היום',
  target: 8,
  unit: 'כוסות',
  frequency: 'daily',
  reminderTime: '09:00',
  reminderEnabled: true,
  isArchived: false,
  sortOrder: 0,
  createdAt: '2026-09-01T08:00:00.000Z',
};

const readingHabit: Habit = { ...waterHabit, id: 2, name: 'קריאה', target: 20, unit: 'דקות', reminderEnabled: false, reminderTime: null, isArchived: true, sortOrder: 1 };

const water: HabitWithProgress = {
  habit: waterHabit,
  today: { id: 10, habitId: 1, date: today, value: 5, completed: false, note: '' },
  currentStreak: 3,
  bestStreak: 7,
  weekTotal: 20,
  completedLast30: 21,
  completionRate30: 0.7,
  targetMet: false,
};

const statuses: HabitDayStatus[] = [{ habitId: 1, habitName: 'שתיית מים', date: today, value: 8, completed: true }];

function renderPage() {
  return renderWithProviders(<HabitsPage />, { auth: 'authenticated', route: '/habits' });
}

describe('HabitsPage', () => {
  beforeEach(() => {
    vi.mocked(api.habits.progress).mockReset().mockResolvedValue([water]);
    vi.mocked(api.habits.list).mockReset().mockResolvedValue([waterHabit, readingHabit]);
    vi.mocked(api.habits.status).mockReset().mockResolvedValue(statuses);
    vi.mocked(api.habits.create).mockReset().mockImplementation(async (input) => ({ ...waterHabit, ...input, id: 3, isArchived: false, sortOrder: 2 }));
    vi.mocked(api.habits.update).mockReset().mockImplementation(async (id, input) => ({ ...waterHabit, ...input, id }));
    vi.mocked(api.habits.remove).mockReset().mockResolvedValue(undefined);
    vi.mocked(api.habits.archive).mockReset().mockImplementation(async (id, archived) => ({ ...waterHabit, id, isArchived: archived }));
    vi.mocked(api.habits.reorder).mockReset().mockResolvedValue([]);
  });

  it('renders the active habit card with target, streak, completion and quick log; archived habits in a details section', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: HABITS_TEXTS.title })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: HABITS_TEXTS.tabToday })).toHaveAttribute('aria-selected', 'true');

    await screen.findByText(streakText(water));
    const card = screen.getByRole('article', { name: 'שתיית מים' });
    expect(within(card).getByText(new RegExp(targetText(waterHabit)))).toBeInTheDocument();
    expect(within(card).getByText(/תזכורת: 09:00/)).toBeInTheDocument();
    expect(within(card).getByText(streakText(water))).toBeInTheDocument();
    expect(within(card).getByText(completionText(water))).toHaveTextContent('70%');
    expect(within(card).getAllByText(progressText(water)).length).toBeGreaterThan(0);
    expect(within(card).getByRole('button', { name: /\+1 שתיית מים/ })).toBeInTheDocument();
    expect(within(card).getByLabelText(/הערה/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /ערוך שתיית מים/ })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /ארכב שתיית מים/ })).toBeInTheDocument();

    expect(screen.getByText(HABITS_TEXTS.archivedSection(1))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /שחזר קריאה/ })).toBeInTheDocument();
  });

  // Several user-event interactions inside the dialog: allow more than the 5s default.
  it('creates a habit through the dialog: validation first, then a template fills the form', { timeout: 20000 }, async () => {
    const { user } = renderPage();
    await screen.findByText(streakText(water));
    await user.click(screen.getByRole('button', { name: HABIT_FORM_TEXTS.newTitle }));

    const dialog = screen.getByRole('dialog', { name: HABIT_FORM_TEXTS.newTitle });
    await user.click(within(dialog).getByRole('button', { name: T.save }));

    const name = within(dialog).getByLabelText(new RegExp(HABIT_FORM_LABELS.name));
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription(HABIT_FORM_ERRORS.name);
    expect(name).toHaveFocus();
    expect(within(dialog).getByLabelText(new RegExp(HABIT_FORM_LABELS.unit))).toHaveAttribute('aria-invalid', 'true');
    // Announced INSIDE the modal dialog (the global announcer is inert behind it), not in the global region.
    expect(dialog.querySelector('[data-testid="live-region-assertive"]')).toHaveTextContent(T.fixErrors(3));
    expect(assertiveRegion()).not.toHaveTextContent(T.fixErrors(3));
    expect(api.habits.create).not.toHaveBeenCalled();

    await user.selectOptions(within(dialog).getByLabelText(new RegExp(HABIT_FORM_LABELS.template)), 'שתיית מים');
    expect(name).toHaveValue('שתיית מים');
    expect(name).not.toHaveAttribute('aria-invalid');
    expect(within(dialog).getByLabelText(new RegExp(HABIT_FORM_LABELS.target))).toHaveValue(8);
    expect(within(dialog).getByLabelText(new RegExp(HABIT_FORM_LABELS.unit))).toHaveValue('כוסות');
    expect(within(dialog).getByRole('radio', { name: HABIT_FORM_LABELS.daily })).toBeChecked();

    await user.click(within(dialog).getByRole('checkbox', { name: new RegExp(HABIT_FORM_LABELS.reminder) }));
    const time = within(dialog).getByLabelText(new RegExp(HABIT_FORM_LABELS.reminderTime));
    await user.type(time, '08:30');

    await user.click(within(dialog).getByRole('button', { name: T.save }));
    await waitFor(() => expect(api.habits.create).toHaveBeenCalledTimes(1));
    expect(api.habits.create).toHaveBeenCalledWith({
      name: 'שתיית מים',
      description: 'כוסות מים במהלך היום',
      target: 8,
      unit: 'כוסות',
      frequency: 'daily',
      reminderTime: '08:30',
      reminderEnabled: true,
    });
    expect(await screen.findByText(HABITS_TEXTS.created('שתיית מים'))).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('#habit-form-dialog')).not.toHaveAttribute('open'));
    expect(api.habits.progress).toHaveBeenCalledTimes(2);
  });

  it('edits a habit with the same dialog', async () => {
    const { user } = renderPage();
    await screen.findByText(streakText(water));
    const card = screen.getByRole('article', { name: 'שתיית מים' });
    await user.click(within(card).getByRole('button', { name: 'ערוך שתיית מים' }));

    const dialog = screen.getByRole('dialog', { name: /עריכת הרגל: שתיית מים/ });
    expect(within(dialog).queryByLabelText(new RegExp(HABIT_FORM_LABELS.template))).not.toBeInTheDocument();
    const name = within(dialog).getByLabelText(new RegExp(HABIT_FORM_LABELS.name));
    expect(name).toHaveValue('שתיית מים');
    await user.clear(name);
    await user.type(name, 'מים{Enter}');

    await waitFor(() => expect(api.habits.update).toHaveBeenCalledTimes(1));
    expect(api.habits.update).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'מים', target: 8, unit: 'כוסות', reminderTime: '09:00', reminderEnabled: true }));
    expect(await screen.findByText(HABITS_TEXTS.updated('מים'))).toBeInTheDocument();
  });

  it('shows the last 14 days as a table in the history tab', async () => {
    const { user } = renderPage();
    await screen.findByText(streakText(water));
    await user.click(screen.getByRole('tab', { name: HABITS_TEXTS.tabHistory }));

    const table = await screen.findByRole('table', { name: HABITS_TEXTS.historyCaption });
    // The sideways-scrolling box is a named region that keyboard users can focus and scroll.
    const region = screen.getByRole('region', { name: HABITS_TEXTS.historyCaption });
    expect(region).toContainElement(table);
    expect(region).toHaveAttribute('tabindex', '0');
    expect(api.habits.status).toHaveBeenCalledTimes(1);
    const [from, to] = vi.mocked(api.habits.status).mock.calls[0];
    expect(to).toBe(today);
    expect(from < to).toBe(true);
    const headers = within(table).getAllByRole('columnheader');
    expect(headers).toHaveLength(15);
    expect(headers[0]).toHaveAttribute('scope', 'col');
    expect(headers[0]).toHaveTextContent(HABITS_TEXTS.habitColumn);
    const row = within(table).getByRole('row', { name: /שתיית מים/ });
    expect(within(row).getByRole('rowheader')).toHaveAttribute('scope', 'row');
    const cells = within(row).getAllByRole('cell').map((td) => td.textContent);
    expect(cells).toHaveLength(14);
    expect(cells[13]).toBe('✓ 8');
    expect(cells[0]).toBe('–');
  });

  it('deletes an archived habit after confirming the danger dialog', async () => {
    const { user } = renderPage();
    await screen.findByText(streakText(water));
    await user.click(screen.getByText(HABITS_TEXTS.archivedSection(1)));
    await user.click(screen.getByRole('button', { name: 'מחק קריאה' }));

    const dialog = screen.getByRole('dialog', { name: HABITS_TEXTS.deleteTitle('קריאה') });
    expect(dialog).toHaveTextContent(/הדיווחים/);
    await user.click(within(dialog).getByRole('button', { name: T.delete }));
    await waitFor(() => expect(api.habits.remove).toHaveBeenCalledWith(2));
    expect(await screen.findByText(HABITS_TEXTS.deleted('קריאה'))).toBeInTheDocument();
    // The last archived habit is gone with its button: focus moves to the page heading, not <body>.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: HABITS_TEXTS.title })).toHaveFocus());
  });

  it('renders the card texts and the template picker in English when the UI language is English', async () => {
    setCurrentLocale('en');
    const { user } = renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Habits' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Today' })).toHaveAttribute('aria-selected', 'true');
    await screen.findByText('Current streak: 3 days (best: 7 days)');
    const card = screen.getByRole('article', { name: 'שתיית מים' });
    expect(within(card).getByText('Target: 8 כוסות per day (Daily) · Reminder: 09:00')).toBeInTheDocument();
    expect(within(card).getByText('Completion in the last 30 days: 70%')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Edit שתיית מים' })).toBeInTheDocument();
    expect(screen.getByText('Archived habits (1)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New habit' }));
    const dialog = screen.getByRole('dialog', { name: 'New habit' });
    const picker = within(dialog).getByLabelText(/Template/);
    expect(within(picker).getAllByRole('option').map((o) => o.textContent)).toContain('Drinking water');
    await user.selectOptions(picker, 'Drinking water');
    expect(within(dialog).getByLabelText(/Habit name/)).toHaveValue('Drinking water');
    expect(within(dialog).getByLabelText(/Unit/)).toHaveValue('glasses');
    expect(within(dialog).getByRole('radio', { name: 'Daily' })).toBeChecked();
  });

  it('archives and reorders through the API', async () => {
    vi.mocked(api.habits.progress).mockResolvedValue([water, { ...water, habit: { ...waterHabit, id: 5, name: 'הליכה', sortOrder: 1 }, today: null }]);
    const { user } = renderPage();
    await screen.findAllByText(streakText(water));
    const walk = screen.getByRole('article', { name: 'הליכה' });
    await user.click(within(walk).getByRole('button', { name: 'העלה הליכה' }));
    await waitFor(() => expect(api.habits.reorder).toHaveBeenCalledWith([5, 1]));

    const card = screen.getByRole('article', { name: 'שתיית מים' });
    await user.click(within(card).getByRole('button', { name: 'ארכב שתיית מים' }));
    await waitFor(() => expect(api.habits.archive).toHaveBeenCalledWith(1, true));
    expect(await screen.findByText(HABITS_TEXTS.archived('שתיית מים'))).toBeInTheDocument();
    // The archive button left with its card: focus goes to the archived section's summary.
    await waitFor(() => expect(screen.getByText(HABITS_TEXTS.archivedSection(1))).toHaveFocus());
  });

  it('moves focus to the restored habit after "Restore"', async () => {
    // After the restore the reading habit is active again.
    const reading: HabitWithProgress = { ...water, habit: { ...readingHabit, isArchived: false }, today: null };
    const { user } = renderPage();
    await screen.findByText(streakText(water));
    vi.mocked(api.habits.progress).mockResolvedValue([water, reading]);
    vi.mocked(api.habits.list).mockResolvedValue([waterHabit, { ...readingHabit, isArchived: false }]);
    await user.click(screen.getByText(HABITS_TEXTS.archivedSection(1)));
    await user.click(screen.getByRole('button', { name: 'שחזר קריאה' }));
    await waitFor(() => expect(api.habits.archive).toHaveBeenCalledWith(2, false));
    const restored = await screen.findByRole('article', { name: 'קריאה' });
    // The card's heading text (it names the article) receives the focus.
    await waitFor(() => expect(restored.querySelector('#habit-2-title')).toHaveFocus());
  });
});

describe('historyCellText', () => {
  it('formats completed, partial and missing days', () => {
    expect(historyCellText(undefined)).toBe('–');
    expect(historyCellText({ habitId: 1, habitName: 'x', date: today, value: 0, completed: false })).toBe('–');
    expect(historyCellText({ habitId: 1, habitName: 'x', date: today, value: 3, completed: false })).toBe('3');
    expect(historyCellText({ habitId: 1, habitName: 'x', date: today, value: 8, completed: true })).toBe('✓ 8');
    // A weekly habit is completed per week: a logged day shows its amount, never a day tick.
    expect(historyCellText({ habitId: 1, habitName: 'x', date: today, value: 1, completed: true }, true)).toBe('1');
  });
});
