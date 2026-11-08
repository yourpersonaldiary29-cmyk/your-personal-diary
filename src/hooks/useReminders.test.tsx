/**
 * Habit reminders: which way a reminder takes to the screen.
 *  - Microsoft Store (MSIX) version: the shell command `show_store_notification` sends the toast;
 *    when Windows did not take it the reminder is shown inside the app.
 *  - Downloaded desktop version (NSIS / MSI): the notification plugin, exactly as before.
 *  - Browser: the Notification API through `showSystemNotification`, exactly as before.
 */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, screen, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import type { DueReminder } from '@shared/types';
import * as api from '@/api';
import { T } from '@/constants/texts';
import { Providers, type ProviderOptions } from '@/test/render';
import * as platform from '@/utils/platform';
import {
  STORE_NOTIFICATION_COMMAND,
  __resetStorePackageForTests,
  showReminderNotification,
  useReminders,
  type StoreNotificationResult,
} from './useReminders';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

vi.mock('@/utils/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/platform')>();
  return { ...actual, isTauri: vi.fn(() => false), showSystemNotification: vi.fn(async () => false) };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);
const pluginMock = vi.mocked(platform.showSystemNotification);

/** The desktop shell: `answer` is what `show_store_notification` returns (an Error: the call fails). */
function desktopShell(answer: StoreNotificationResult | Error) {
  vi.mocked(platform.isTauri).mockReturnValue(true);
  invokeMock.mockImplementation(async (command) => {
    if (command !== STORE_NOTIFICATION_COMMAND) throw new Error(`unexpected command ${command}`);
    if (answer instanceof Error) throw answer;
    return answer;
  });
}

const water: DueReminder = { habitId: 3, habitName: 'מים', reminderTime: '10:00', message: 'הגיע הזמן: מים' };

function wrapperFor(options: ProviderOptions) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Providers options={options}>{children}</Providers>;
  };
}

beforeEach(() => {
  __resetStorePackageForTests();
  invokeMock.mockReset();
  pluginMock.mockReset().mockResolvedValue(false);
  vi.mocked(platform.isTauri).mockReset().mockReturnValue(false);
  vi.mocked(api.habits.dueReminders).mockReset().mockResolvedValue([]);
});

afterEach(() => {
  __resetStorePackageForTests();
});

describe('showReminderNotification', () => {
  describe('Microsoft Store (MSIX) version', () => {
    it('sends the toast through the shell and never through the plugin', async () => {
      desktopShell('shown');
      await expect(showReminderNotification('Reminder', 'Drink water')).resolves.toBe(true);
      expect(invokeMock).toHaveBeenCalledWith(STORE_NOTIFICATION_COMMAND, { title: 'Reminder', body: 'Drink water' });
      expect(pluginMock).not.toHaveBeenCalled();

      // Every further reminder takes the same way.
      await expect(showReminderNotification('Reminder', 'Stretch')).resolves.toBe(true);
      expect(invokeMock).toHaveBeenCalledTimes(2);
      expect(pluginMock).not.toHaveBeenCalled();
    });

    it.each(['disabled', 'failed'] as const)('asks for the in-app toast when the shell answers "%s"', async (answer) => {
      desktopShell(answer);
      await expect(showReminderNotification('Reminder', 'Drink water')).resolves.toBe(false);
      // The plugin would report success for a toast Windows never shows.
      expect(pluginMock).not.toHaveBeenCalled();
    });

    it('asks for the in-app toast when the command itself fails or answers something unknown', async () => {
      desktopShell(new Error('ipc closed'));
      await expect(showReminderNotification('Reminder', 'Drink water')).resolves.toBe(false);
      expect(pluginMock).not.toHaveBeenCalled();

      desktopShell('maybe' as StoreNotificationResult);
      await expect(showReminderNotification('Reminder', 'Drink water')).resolves.toBe(false);
      expect(pluginMock).not.toHaveBeenCalled();

      // Nothing was learnt from the failures: the shell is asked again and can still answer.
      desktopShell('shown');
      await expect(showReminderNotification('Reminder', 'Drink water')).resolves.toBe(true);
    });
  });

  describe('downloaded desktop version (not packaged)', () => {
    it('uses the notification plugin as before and asks the shell only once', async () => {
      desktopShell('not-packaged');
      pluginMock.mockResolvedValue(true);

      await expect(showReminderNotification('Reminder', 'Drink water')).resolves.toBe(true);
      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(pluginMock).toHaveBeenCalledWith('Reminder', 'Drink water');

      await expect(showReminderNotification('Reminder', 'Stretch')).resolves.toBe(true);
      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(pluginMock).toHaveBeenLastCalledWith('Reminder', 'Stretch');
      expect(pluginMock).toHaveBeenCalledTimes(2);
    });

    it("passes the plugin's own answer on (no permission: the in-app toast)", async () => {
      desktopShell('not-packaged');
      pluginMock.mockResolvedValue(false);
      await expect(showReminderNotification('Reminder', 'Drink water')).resolves.toBe(false);
      expect(pluginMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('browser', () => {
    it('never talks to a shell', async () => {
      pluginMock.mockResolvedValue(true);
      await expect(showReminderNotification('Reminder', 'Drink water')).resolves.toBe(true);
      expect(invokeMock).not.toHaveBeenCalled();
      expect(pluginMock).toHaveBeenCalledWith('Reminder', 'Drink water');
    });
  });
});

describe('useReminders', () => {
  it('Store version: a reminder Windows does not show appears as an in-app toast', async () => {
    desktopShell('disabled');
    vi.mocked(api.habits.dueReminders).mockResolvedValueOnce([water]);
    renderHook(() => useReminders(), { wrapper: wrapperFor({ auth: 'authenticated' }) });

    expect(await screen.findByText(water.message)).toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith(STORE_NOTIFICATION_COMMAND, { title: T.reminderTitle, body: water.message });
    expect(pluginMock).not.toHaveBeenCalled();
  });

  it('Store version: a reminder Windows shows is not repeated inside the app', async () => {
    desktopShell('shown');
    vi.mocked(api.habits.dueReminders).mockResolvedValueOnce([water]);
    renderHook(() => useReminders(), { wrapper: wrapperFor({ auth: 'authenticated' }) });

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.habits.dueReminders).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(water.message)).not.toBeInTheDocument();
    expect(pluginMock).not.toHaveBeenCalled();
  });

  it('downloaded version: the plugin shows the reminder, as before', async () => {
    desktopShell('not-packaged');
    pluginMock.mockResolvedValue(true);
    vi.mocked(api.habits.dueReminders).mockResolvedValueOnce([water]);
    renderHook(() => useReminders(), { wrapper: wrapperFor({ auth: 'authenticated' }) });

    await waitFor(() => expect(pluginMock).toHaveBeenCalledWith(T.reminderTitle, water.message));
    expect(screen.queryByText(water.message)).not.toBeInTheDocument();
  });

  it('does not poll when signed out or when reminders are turned off', async () => {
    renderHook(() => useReminders(), { wrapper: wrapperFor({ auth: 'anonymous' }) });
    renderHook(() => useReminders(), { wrapper: wrapperFor({ auth: 'authenticated', settings: { remindersEnabled: false } }) });
    await Promise.resolve();
    expect(api.habits.dueReminders).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
