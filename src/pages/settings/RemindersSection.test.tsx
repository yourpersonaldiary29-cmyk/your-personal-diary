/**
 * Phone (Android app) branch of the Reminders card: the notification permission is asked from the
 * card with an explanation and when the switch is turned on; a denial is explained; "Show habit
 * names" is a phone setting; the hint under the switch is the phone's own sentence.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { setPhoneReminders } from '@/hooks/useReminders';
import { fakePhoneReminders as fakePhone } from '@/test/fake-phone-reminders';
import { tr } from '@/i18n/runtime';
import { renderWithProviders } from '@/test/render';
import { RemindersSection } from './RemindersSection';
import { ST } from './texts';

describe('phone: Reminders card', () => {
  beforeEach(() => vi.stubGlobal('__MOBILE__', true));
  afterEach(() => {
    setPhoneReminders(null);
    vi.unstubAllGlobals();
  });

  it('asks for the permission with an explanation and confirms once granted', async () => {
    const phone = fakePhone('prompt');
    setPhoneReminders(phone);
    const { user } = renderWithProviders(<RemindersSection />, { auth: 'authenticated', settings: { remindersEnabled: true } });
    expect(await screen.findByText(tr('mobile.reminders.permissionText'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: tr('mobile.reminders.allow') }));
    expect(phone.requestPermission).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(tr('mobile.reminders.granted'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: tr('mobile.reminders.allow') })).not.toBeInTheDocument();
  });

  it('explains a denial, and toggles "show habit names" through the phone setting', async () => {
    const phone = fakePhone('denied');
    setPhoneReminders(phone);
    const { user } = renderWithProviders(<RemindersSection />, { auth: 'authenticated', settings: { remindersEnabled: true } });
    expect(await screen.findByText(tr('mobile.reminders.denied'))).toBeInTheDocument();
    const names = screen.getByRole('checkbox', { name: tr('mobile.reminders.showNames') });
    expect(names).not.toBeChecked();
    await user.click(names);
    await waitFor(() => expect(phone.setShowNames).toHaveBeenCalledWith(true));
    await waitFor(() => expect(names).toBeChecked());
  });

  it('shows nothing phone-specific while reminders are off, and nothing at all without the bridge', () => {
    setPhoneReminders(fakePhone('granted'));
    const off = renderWithProviders(<RemindersSection />, { auth: 'authenticated', settings: { remindersEnabled: false } });
    expect(screen.queryByTestId('phone-reminders')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: ST.remindersEnabled })).toBeInTheDocument();
    off.unmount();

    setPhoneReminders(null);
    renderWithProviders(<RemindersSection />, { auth: 'authenticated', settings: { remindersEnabled: true } });
    expect(screen.queryByTestId('phone-reminders')).not.toBeInTheDocument();
  });

  it('asks for the permission when the switch is turned on, and shows the phone hint', async () => {
    const phone = fakePhone('prompt');
    setPhoneReminders(phone);
    const { user } = renderWithProviders(<RemindersSection />, { auth: 'authenticated', settings: { remindersEnabled: false } });
    expect(screen.getByText(tr('settings.reminders.hintPhone'))).toBeInTheDocument();
    expect(screen.queryByText(tr('settings.reminders.hint'))).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: ST.remindersEnabled }));
    await waitFor(() => expect(phone.requestPermission).toHaveBeenCalledTimes(1));
  });

  it('says nothing wrong after the first refusal of Android: the phone still answers "prompt" and the button stays', async () => {
    const phone = fakePhone('prompt', { answer: 'prompt' });
    setPhoneReminders(phone);
    const { user } = renderWithProviders(<RemindersSection />, { auth: 'authenticated', settings: { remindersEnabled: true } });
    await user.click(await screen.findByRole('button', { name: tr('mobile.reminders.allow') }));
    await waitFor(() => expect(phone.requestPermission).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 20));
    // Neither "allowed" nor the path in the phone's settings: the question can be asked once more.
    expect(screen.getByRole('button', { name: tr('mobile.reminders.allow') })).toBeInTheDocument();
    expect(screen.queryByText(tr('mobile.reminders.denied'))).not.toBeInTheDocument();
    expect(screen.queryByText(tr('mobile.reminders.granted'))).not.toBeInTheDocument();
  });

  it('asks nothing when the switch is turned off, or turned on while the phone already answered', async () => {
    const prompt = fakePhone('prompt');
    setPhoneReminders(prompt);
    const on = renderWithProviders(<RemindersSection />, { auth: 'authenticated', settings: { remindersEnabled: true } });
    await screen.findByText(tr('mobile.reminders.permissionText'));
    await on.user.click(screen.getByRole('checkbox', { name: ST.remindersEnabled }));
    await new Promise((r) => setTimeout(r, 20));
    expect(prompt.requestPermission).not.toHaveBeenCalled();
    on.unmount();

    for (const state of ['granted', 'denied'] as const) {
      const phone = fakePhone(state);
      setPhoneReminders(phone);
      const off = renderWithProviders(<RemindersSection />, { auth: 'authenticated', settings: { remindersEnabled: false } });
      await off.user.click(screen.getByRole('checkbox', { name: ST.remindersEnabled }));
      await waitFor(() => expect(phone.permission).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 20));
      expect(phone.requestPermission).not.toHaveBeenCalled();
      off.unmount();
    }
  });

  it('keeps the desktop hint without the phone bridge', () => {
    renderWithProviders(<RemindersSection />, { auth: 'authenticated', settings: { remindersEnabled: true } });
    expect(screen.getByText(tr('settings.reminders.hint'))).toBeInTheDocument();
  });
});
