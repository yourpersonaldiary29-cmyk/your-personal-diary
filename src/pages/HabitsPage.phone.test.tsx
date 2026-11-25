/**
 * Phone (Android app) branch of the Habits page: while a habit has a reminder, reminders are on and
 * the phone does not allow notifications, ONE notice above the list asks for them ('prompt') or
 * explains the phone settings ('denied'). The system dialog opens only from the user's tap.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { Habit, HabitWithProgress } from '@shared/types';
import * as api from '@/api';
import { setPhoneReminders } from '@/hooks/useReminders';
import { tr } from '@/i18n/runtime';
import { fakePhoneReminders } from '@/test/fake-phone-reminders';
import { politeRegion, renderWithProviders, type ProviderOptions } from '@/test/render';
import { todayIso } from '@/utils/dates';
import HabitsPage from './HabitsPage';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

const today = todayIso();

const waterHabit: Habit = {
  id: 1,
  name: 'Water',
  description: '',
  target: 8,
  unit: 'glasses',
  frequency: 'daily',
  reminderTime: '09:00',
  reminderEnabled: true,
  isArchived: false,
  sortOrder: 0,
  createdAt: '2026-09-01T08:00:00.000Z',
};

function progressOf(habit: Habit): HabitWithProgress {
  return {
    habit,
    today: { id: 10, habitId: habit.id, date: today, value: 0, completed: false, note: '' },
    currentStreak: 0,
    bestStreak: 0,
    weekTotal: 0,
    completedLast30: 0,
    completionRate30: 0,
    targetMet: false,
  };
}

function renderPage(settings: ProviderOptions['settings'] = { remindersEnabled: true }) {
  return renderWithProviders(<HabitsPage />, { auth: 'authenticated', route: '/habits', settings });
}

const settle = () => new Promise((r) => setTimeout(r, 20));

// The whole Habits page is rendered: generous time for a loaded machine (as its neighbour HabitsPage.test.tsx does).
describe('phone: Habits page notice about notifications', { timeout: 20000 }, () => {
  beforeEach(() => {
    vi.stubGlobal('__MOBILE__', true);
    vi.mocked(api.habits.progress).mockReset().mockResolvedValue([progressOf(waterHabit)]);
    vi.mocked(api.habits.list).mockReset().mockResolvedValue([waterHabit]);
    vi.mocked(api.habits.status).mockReset().mockResolvedValue([]);
  });
  afterEach(() => {
    setPhoneReminders(null);
    vi.unstubAllGlobals();
  });

  it('"prompt": explains, asks only on the tap, and goes away once allowed', async () => {
    const phone = fakePhoneReminders('prompt');
    setPhoneReminders(phone);
    const { user } = renderPage();
    expect(await screen.findByText(tr('mobile.reminders.permissionText'))).toBeInTheDocument();
    expect(screen.getAllByTestId('phone-reminders-notice')).toHaveLength(1);
    expect(phone.requestPermission).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: tr('mobile.reminders.allow') }));
    expect(phone.requestPermission).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('phone-reminders-notice')).not.toBeInTheDocument());
    await waitFor(() => expect(politeRegion()).toHaveTextContent(tr('mobile.reminders.granted')));
  });

  it('"denied": the sentence with the path in the phone settings, no button', async () => {
    setPhoneReminders(fakePhoneReminders('denied'));
    renderPage();
    expect(await screen.findByText(tr('mobile.reminders.denied'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: tr('mobile.reminders.allow') })).not.toBeInTheDocument();
  });

  it('a refusal from the notice shows the sentence instead of the button', async () => {
    const phone = fakePhoneReminders('prompt', { answer: 'denied' });
    setPhoneReminders(phone);
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: tr('mobile.reminders.allow') }));
    // The sentence is looked for inside the notice: the same words are also announced through the live region of
    // the page, so a search of the whole page would find them twice.
    await waitFor(() => expect(screen.getByTestId('phone-reminders-notice')).toHaveTextContent(tr('mobile.reminders.denied')));
    expect(screen.queryByRole('button', { name: tr('mobile.reminders.allow') })).not.toBeInTheDocument();
  });

  it('no notice while granted, without a habit with a reminder, with reminders off, or outside the phone app', async () => {
    setPhoneReminders(fakePhoneReminders('granted'));
    const granted = renderPage();
    await screen.findByRole('article', { name: 'Water' });
    await settle();
    expect(screen.queryByTestId('phone-reminders-notice')).not.toBeInTheDocument();
    granted.unmount();

    setPhoneReminders(fakePhoneReminders('prompt'));
    vi.mocked(api.habits.progress).mockResolvedValue([progressOf({ ...waterHabit, reminderEnabled: false, reminderTime: null })]);
    const noReminder = renderPage();
    await screen.findByRole('article', { name: 'Water' });
    await settle();
    expect(screen.queryByTestId('phone-reminders-notice')).not.toBeInTheDocument();
    noReminder.unmount();

    vi.mocked(api.habits.progress).mockResolvedValue([progressOf(waterHabit)]);
    const off = renderPage({ remindersEnabled: false });
    await screen.findByRole('article', { name: 'Water' });
    await settle();
    expect(screen.queryByTestId('phone-reminders-notice')).not.toBeInTheDocument();
    off.unmount();

    vi.stubGlobal('__MOBILE__', false);
    renderPage();
    await screen.findByRole('article', { name: 'Water' });
    await settle();
    expect(screen.queryByTestId('phone-reminders-notice')).not.toBeInTheDocument();
  });
});
