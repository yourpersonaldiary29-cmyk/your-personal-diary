/**
 * Phone (Android app) branch of the habit form: ticking "Daily reminder" asks for the notification
 * permission while the phone was never asked; after a refusal the form explains how to allow
 * notifications in the phone settings. Outside the phone app nothing is asked. (The form itself is
 * covered by src/pages/HabitsPage.test.tsx.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { Habit } from '@shared/types';
import { setPhoneReminders } from '@/hooks/useReminders';
import { tr } from '@/i18n/runtime';
import { fakePhoneReminders } from '@/test/fake-phone-reminders';
import { renderWithProviders } from '@/test/render';
import { HABIT_FORM_LABELS, HabitFormDialog } from './HabitFormDialog';

const remindedHabit: Habit = {
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

function renderForm(habit: Habit | null = null) {
  const result = renderWithProviders(<HabitFormDialog open habit={habit} onClose={vi.fn()} onSaved={vi.fn()} />, { auth: 'authenticated' });
  const dialog = screen.getByRole('dialog');
  const reminder = () => within(dialog).getByRole('checkbox', { name: new RegExp(HABIT_FORM_LABELS.reminder) });
  const politeRegion = () => dialog.querySelector('[data-testid="live-region-polite"]');
  return { ...result, dialog, reminder, politeRegion };
}

const settle = () => new Promise((r) => setTimeout(r, 20));

describe('phone: habit form "Daily reminder"', () => {
  beforeEach(() => vi.stubGlobal('__MOBILE__', true));
  afterEach(() => {
    setPhoneReminders(null);
    vi.unstubAllGlobals();
  });

  it('asks nothing while reminders are off in the account - the switch in Settings asks when it is turned on', async () => {
    const phone = fakePhoneReminders('prompt');
    setPhoneReminders(phone);
    const { user } = renderWithProviders(<HabitFormDialog open habit={null} remindersEnabled={false} onClose={vi.fn()} onSaved={vi.fn()} />, { auth: 'authenticated' });
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('checkbox', { name: new RegExp(HABIT_FORM_LABELS.reminder) }));
    await settle();
    expect(phone.permission).not.toHaveBeenCalled();
    expect(phone.requestPermission).not.toHaveBeenCalled();
    // The form itself works as always: the time field is there.
    expect(within(dialog).getByLabelText(new RegExp(HABIT_FORM_LABELS.reminderTime))).toBeInTheDocument();
  });

  it('asks once when the box is ticked while the phone was never asked', async () => {
    const phone = fakePhoneReminders('prompt');
    setPhoneReminders(phone);
    const { user, reminder, dialog } = renderForm();
    await user.click(reminder());
    await waitFor(() => expect(phone.requestPermission).toHaveBeenCalledTimes(1));
    // The form goes on at once: the time field is there, no notice after an Allow.
    expect(within(dialog).getByLabelText(new RegExp(HABIT_FORM_LABELS.reminderTime))).toBeInTheDocument();
    await settle();
    expect(within(dialog).queryByText(tr('mobile.reminders.denied'), { ignore: '.visually-hidden' })).not.toBeInTheDocument();

    // Unticking asks nothing (the phone is put back to "never asked", so an ask would show here).
    phone.state = 'prompt';
    await user.click(reminder());
    await settle();
    expect(phone.permission).toHaveBeenCalledTimes(1);
    expect(phone.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('after a refusal explains the phone settings politely, and the sentence goes with the box', async () => {
    const phone = fakePhoneReminders('prompt', { answer: 'denied' });
    setPhoneReminders(phone);
    const { user, reminder, dialog, politeRegion } = renderForm();
    await user.click(reminder());
    expect(await within(dialog).findByText(tr('mobile.reminders.denied'), { ignore: '.visually-hidden' })).toBeInTheDocument();
    expect(politeRegion()).toHaveTextContent(tr('mobile.reminders.denied'));

    await user.click(reminder());
    expect(within(dialog).queryByText(tr('mobile.reminders.denied'), { ignore: '.visually-hidden' })).not.toBeInTheDocument();
    expect(politeRegion()).toHaveTextContent('');
  });

  it('asks nothing when the phone already answered; "denied" shows the sentence', async () => {
    const granted = fakePhoneReminders('granted');
    setPhoneReminders(granted);
    const first = renderForm();
    await first.user.click(first.reminder());
    await settle();
    expect(granted.requestPermission).not.toHaveBeenCalled();
    expect(within(first.dialog).queryByText(tr('mobile.reminders.denied'), { ignore: '.visually-hidden' })).not.toBeInTheDocument();
    first.unmount();

    const denied = fakePhoneReminders('denied');
    setPhoneReminders(denied);
    const second = renderForm();
    await second.user.click(second.reminder());
    expect(await within(second.dialog).findByText(tr('mobile.reminders.denied'), { ignore: '.visually-hidden' })).toBeInTheDocument();
    expect(denied.requestPermission).not.toHaveBeenCalled();
  });

  it('editing a habit whose box is already ticked asks nothing by itself', async () => {
    const phone = fakePhoneReminders('prompt');
    setPhoneReminders(phone);
    const { reminder } = renderForm(remindedHabit);
    expect(reminder()).toBeChecked();
    await settle();
    expect(phone.permission).not.toHaveBeenCalled();
    expect(phone.requestPermission).not.toHaveBeenCalled();
  });

  it('never asks outside the phone app', async () => {
    const phone = fakePhoneReminders('prompt');
    setPhoneReminders(phone);
    vi.stubGlobal('__MOBILE__', false);
    const { user, reminder } = renderForm();
    await user.click(reminder());
    await settle();
    expect(phone.permission).not.toHaveBeenCalled();
    expect(phone.requestPermission).not.toHaveBeenCalled();
  });
});
