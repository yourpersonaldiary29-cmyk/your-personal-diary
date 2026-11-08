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
import { setPhoneReminders, useReminders, type PhoneNotificationPermission, type PhoneReminders } from './useReminders';

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
