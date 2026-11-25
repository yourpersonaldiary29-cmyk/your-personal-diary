/**
 * Phone (Android app) branch of useReminders: the host plans system notifications; the in-app
 * polling runs only while the phone does not allow them. (The desktop / browser behaviour is in
 * useReminders.test.tsx and is unchanged.)
 */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as api from '@/api';
import { Providers, type ProviderOptions } from '@/test/render';
import { askPhoneNotificationPermission, setPhoneReminders, useReminders, type PhoneNotificationPermission, type PhoneReminders } from './useReminders';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

function fakePhone(permission: PhoneNotificationPermission) {
  const listeners = new Set<() => void>();
  const phone: PhoneReminders & { state: PhoneNotificationPermission; notify(): void } = {
    state: permission,
    notify: () => {
      for (const l of listeners) l();
    },
    permission: vi.fn(async () => phone.state),
    requestPermission: vi.fn(async () => phone.state),
    sync: vi.fn(async () => undefined),
    getShowNames: () => false,
    setShowNames: vi.fn(async () => undefined),
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return phone;
}

function wrapperFor(options: ProviderOptions) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Providers options={options}>{children}</Providers>;
  };
}

describe('useReminders on the phone', () => {
  beforeEach(() => {
    vi.stubGlobal('__MOBILE__', true);
    vi.mocked(api.habits.dueReminders).mockReset().mockResolvedValue([]);
  });
  afterEach(() => {
    setPhoneReminders(null);
    vi.unstubAllGlobals();
  });

  it('tells the host to plan and does not poll while the system delivers the reminders', async () => {
    const phone = fakePhone('granted');
    setPhoneReminders(phone);
    renderHook(() => useReminders(), { wrapper: wrapperFor({ auth: 'authenticated', settings: { remindersEnabled: true } }) });
    await waitFor(() => expect(phone.sync).toHaveBeenCalledWith({ enabled: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(api.habits.dueReminders).not.toHaveBeenCalled();
  });

  it('polls as a fallback while notifications are not allowed, and stops once they are', async () => {
    const phone = fakePhone('denied');
    setPhoneReminders(phone);
    renderHook(() => useReminders(), { wrapper: wrapperFor({ auth: 'authenticated', settings: { remindersEnabled: true } }) });
    await waitFor(() => expect(api.habits.dueReminders).toHaveBeenCalled());

    phone.state = 'granted';
    vi.mocked(api.habits.dueReminders).mockClear();
    phone.notify();
    await waitFor(() => expect(phone.sync).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 20));
    expect(api.habits.dueReminders).not.toHaveBeenCalled();
  });

  it('does not plan while the diary is locked (the core would answer 423) and re-plans once - after the unlock', async () => {
    const phone = fakePhone('granted');
    setPhoneReminders(phone);
    const options: ProviderOptions = { auth: 'authenticated', settings: { remindersEnabled: true }, lock: { locked: true } };
    const { rerender } = renderHook(() => useReminders(), { wrapper: wrapperFor(options) });
    await new Promise((r) => setTimeout(r, 20));
    expect(phone.sync).not.toHaveBeenCalled();
    expect(api.habits.dueReminders).not.toHaveBeenCalled();

    options.lock = { locked: false };
    rerender();
    await waitFor(() => expect(phone.sync).toHaveBeenCalledTimes(1));
    expect(phone.sync).toHaveBeenCalledWith({ enabled: true });

    // Locking again plans nothing; the next unlock re-plans again (one sync per unlock).
    options.lock = { locked: true };
    rerender();
    await new Promise((r) => setTimeout(r, 20));
    expect(phone.sync).toHaveBeenCalledTimes(1);
    options.lock = { locked: false };
    rerender();
    await waitFor(() => expect(phone.sync).toHaveBeenCalledTimes(2));
  });

  it('plans "disabled" without a session or with reminders off', async () => {
    const phone = fakePhone('granted');
    setPhoneReminders(phone);
    renderHook(() => useReminders(), { wrapper: wrapperFor({ auth: 'anonymous' }) });
    await waitFor(() => expect(phone.sync).toHaveBeenCalledWith({ enabled: false }));

    const off = fakePhone('granted');
    setPhoneReminders(off);
    renderHook(() => useReminders(), { wrapper: wrapperFor({ auth: 'authenticated', settings: { remindersEnabled: false } }) });
    await waitFor(() => expect(off.sync).toHaveBeenCalledWith({ enabled: false }));
    expect(api.habits.dueReminders).not.toHaveBeenCalled();
  });
});

describe('askPhoneNotificationPermission', () => {
  it('shows the system dialog only while the phone was never asked, and returns the answer', async () => {
    const phone = fakePhone('prompt');
    vi.mocked(phone.requestPermission).mockImplementation(async () => 'denied');
    await expect(askPhoneNotificationPermission(phone)).resolves.toBe('denied');
    expect(phone.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('asks nothing when the phone already answered', async () => {
    for (const state of ['granted', 'denied'] as const) {
      const phone = fakePhone(state);
      await expect(askPhoneNotificationPermission(phone)).resolves.toBe(state);
      expect(phone.requestPermission).not.toHaveBeenCalled();
    }
  });

  it('never throws: null when the phone could not answer', async () => {
    const checkFails = fakePhone('prompt');
    vi.mocked(checkFails.permission).mockRejectedValue(new Error('bridge gone'));
    await expect(askPhoneNotificationPermission(checkFails)).resolves.toBeNull();
    expect(checkFails.requestPermission).not.toHaveBeenCalled();

    const requestFails = fakePhone('prompt');
    vi.mocked(requestFails.requestPermission).mockRejectedValue(new Error('dialog failed'));
    await expect(askPhoneNotificationPermission(requestFails)).resolves.toBeNull();
  });

  it('quick taps while the dialog is still open share one ask', async () => {
    const phone = fakePhone('prompt');
    let answer: (state: PhoneNotificationPermission) => void = () => undefined;
    vi.mocked(phone.requestPermission).mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const first = askPhoneNotificationPermission(phone);
    const second = askPhoneNotificationPermission(phone);
    await waitFor(() => expect(phone.requestPermission).toHaveBeenCalledTimes(1));
    phone.state = 'granted';
    answer('granted');
    await expect(first).resolves.toBe('granted');
    await expect(second).resolves.toBe('granted');
    expect(phone.permission).toHaveBeenCalledTimes(1);
    // Once answered, a later tap asks the phone again.
    await askPhoneNotificationPermission(phone);
    expect(phone.permission).toHaveBeenCalledTimes(2);
  });
});
