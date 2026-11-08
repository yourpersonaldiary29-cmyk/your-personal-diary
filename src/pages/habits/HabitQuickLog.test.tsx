import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { HabitWithProgress } from '@shared/types';
import * as api from '@/api';
import { renderWithProviders } from '@/test/render';
import { HabitQuickLog, QUICK_LOG_TEXTS } from './HabitQuickLog';
import { progressText } from './habit-text';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

const DATE = '2026-09-30';

const bedtime: HabitWithProgress = {
  habit: {
    id: 7,
    name: 'Sleeping on time',
    description: '',
    target: 1,
    unit: 'times',
    frequency: 'daily',
    reminderTime: null,
    reminderEnabled: false,
    isArchived: false,
    sortOrder: 0,
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  today: null,
  currentStreak: 0,
  bestStreak: 0,
  weekTotal: 0,
  completedLast30: 0,
  completionRate30: 0,
  targetMet: false,
};

const done: HabitWithProgress = {
  ...bedtime,
  today: { id: 1, habitId: 7, date: DATE, value: 1, completed: true, note: '' },
  currentStreak: 1,
  bestStreak: 1,
  weekTotal: 1,
  completedLast30: 1,
  targetMet: true,
};

describe('HabitQuickLog', () => {
  beforeEach(() => {
    vi.mocked(api.habits.log).mockReset().mockResolvedValue(done.today!);
    vi.mocked(api.habits.removeLog).mockReset().mockResolvedValue(undefined);
  });

  it('keeps keyboard focus on the mark / unmark button when it flips', async () => {
    // The parent reloads after every change: here it simply flips between the two states.
    function Harness() {
      const [item, setItem] = useState(bedtime);
      return <HabitQuickLog item={item} date={DATE} onChanged={() => setItem((cur) => (cur.today ? bedtime : done))} idPrefix="h7" />;
    }
    const { user } = renderWithProviders(<Harness />, { locale: 'en' });

    const button = screen.getByRole('button', { name: `${QUICK_LOG_TEXTS.markDone} Sleeping on time` });
    await user.click(button);
    await waitFor(() => expect(api.habits.log).toHaveBeenCalledWith({ habitId: 7, date: DATE, value: 1, note: '' }));
    const unmark = await screen.findByRole('button', { name: `${QUICK_LOG_TEXTS.undoDone} Sleeping on time` });
    // The same element changed its label, so focus did not fall back to <body>.
    expect(unmark).toBe(button);
    expect(unmark).toHaveFocus();
    expect(screen.getByText(QUICK_LOG_TEXTS.doneToday)).toBeInTheDocument();

    await user.click(unmark);
    await waitFor(() => expect(api.habits.removeLog).toHaveBeenCalledWith(7, DATE));
    expect(await screen.findByRole('button', { name: `${QUICK_LOG_TEXTS.markDone} Sleeping on time` })).toHaveFocus();
  });

  it.each(['he', 'ar'] as const)('isolates the "+1" of the button left to right in a right-to-left page (%s)', (locale) => {
    const water: HabitWithProgress = { ...bedtime, habit: { ...bedtime.habit, name: 'מים', target: 8, unit: 'כוסות' } };
    renderWithProviders(<HabitQuickLog item={water} date={DATE} onChanged={vi.fn()} idPrefix="h7" />, { locale });
    expect(QUICK_LOG_TEXTS.plusOne).toBe('+1');
    // The accessible name is unchanged: the label, then the habit's name.
    const button = screen.getByRole('button', { name: '+1 מים' });
    // The sign and the digit sit in an element of their own with a left-to-right direction (a bidi
    // isolate), so the "+" stays in front of the "1" whatever the direction of the page.
    const label = screen.getByText('+1');
    expect(button).toContainElement(label);
    expect(label.tagName).toBe('BDI');
    expect(label).toHaveAttribute('dir', 'ltr');
    expect(label).toHaveTextContent(/^\+1$/);
  });

  it('shows the progress once as text; the bar keeps it as its value text', () => {
    renderWithProviders(<HabitQuickLog item={done} date={DATE} onChanged={vi.fn()} idPrefix="h7" />, { locale: 'en' });
    expect(screen.getAllByText(progressText(done))).toHaveLength(1);
    expect(screen.getByRole('progressbar', { name: 'Sleeping on time' })).toHaveAttribute('aria-valuetext', '1 of 1 times');
  });
});
