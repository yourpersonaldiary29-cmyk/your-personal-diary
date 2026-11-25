/**
 * A fake phone bridge of the reminders (`PhoneReminders`, set by mobile/platform/index.ts in the
 * phone app) for the tests of the phone branches. `state` is what the phone reports; `answer` is
 * what the system dialog answers when `requestPermission` is called. Like the real bridge,
 * `requestPermission` notifies the subscribers afterwards.
 */
import { vi } from 'vitest';
import type { PhoneNotificationPermission, PhoneReminders } from '@/hooks/useReminders';

export type FakePhoneReminders = PhoneReminders & {
  state: PhoneNotificationPermission;
  answer: PhoneNotificationPermission;
  names: boolean;
  notify(): void;
};

export function fakePhoneReminders(state: PhoneNotificationPermission, options: { answer?: PhoneNotificationPermission; showNames?: boolean } = {}): FakePhoneReminders {
  const listeners = new Set<() => void>();
  const phone: FakePhoneReminders = {
    state,
    answer: options.answer ?? 'granted',
    names: options.showNames ?? false,
    notify: () => {
      for (const l of listeners) l();
    },
    permission: vi.fn(async () => phone.state),
    requestPermission: vi.fn(async () => {
      phone.state = phone.answer;
      phone.notify();
      return phone.state;
    }),
    sync: vi.fn(async () => undefined),
    getShowNames: () => phone.names,
    setShowNames: vi.fn(async (value: boolean) => {
      phone.names = value;
      phone.notify();
    }),
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return phone;
}
