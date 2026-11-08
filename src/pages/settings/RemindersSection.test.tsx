/**
 * Phone (Android app) branch of the Reminders card: the notification permission is asked from the
 * card with an explanation; a denial is explained; "Show habit names" is a phone setting.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { setPhoneReminders, type PhoneNotificationPermission, type PhoneReminders } from '@/hooks/useReminders';
import { tr } from '@/i18n/runtime';
import { renderWithProviders } from '@/test/render';
import { RemindersSection } from './RemindersSection';
import { ST } from './texts';

function fakePhone(permission: PhoneNotificationPermission, showNames = false) {
  const listeners = new Set<() => void>();
  const phone: PhoneReminders & { state: PhoneNotificationPermission; names: boolean } = {
    state: permission,
    names: showNames,
    permission: vi.fn(async () => phone.state),
    requestPermission: vi.fn(async () => {
      phone.state = 'granted';
      return phone.state;
    }),
    sync: vi.fn(async () => undefined),
    getShowNames: () => phone.names,
    setShowNames: vi.fn(async (value: boolean) => {
      phone.names = value;
      for (const l of listeners) l();
    }),
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return phone;
}

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
});
