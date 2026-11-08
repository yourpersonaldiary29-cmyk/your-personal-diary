/**
 * What needs a connection (docs/android-tasks/OFFLINE-DESIGN.md sections 4.3 and 6.2; WP-H10c "Tests"):
 * while offline mode runs and the diary server cannot be reached, insights, stats, search and backup /
 * restore / export show "This needs a connection to the diary server. [Try again]" instead of the page
 * (no request is made), and the account-management and demo-data buttons are disabled with that text as
 * their description. "Drain first": an online-only write goes ahead only when nothing waits on the
 * device. With offline mode off nothing of this exists (the pages' own tests are the proof).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { SessionInfo } from '@shared/types';
import * as api from '@/api';
import { offline } from '@/offline';
import { __resetSyncStatusForTests, patchSyncStatus } from '@/offline/status';
import { setCurrentLocale, trWith } from '@/i18n/runtime';
import BackupPage from '@/pages/BackupPage';
import InsightsPage from '@/pages/InsightsPage';
import SearchPage from '@/pages/SearchPage';
import StatsPage from '@/pages/StatsPage';
import { DataSection } from '@/pages/settings/DataSection';
import { SessionsList } from '@/pages/settings/SessionsList';
import { politeRegion, renderWithProviders, sampleUser } from '@/test/render';
import { __resetSyncGateForTests, drainBeforeOnlineWrite } from './syncGate';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

const en = trWith('en');

function offlineNow(): void {
  patchSyncStatus({ enabled: true, userId: sampleUser.id, phase: 'offline', showOffline: true });
}

const sessions: SessionInfo[] = [
  { id: 's1', deviceName: 'Desktop', createdAt: '2026-10-20T08:00:00.000Z', lastSeenAt: '2026-10-20T08:00:00.000Z', rememberMe: true, current: true },
  { id: 's2', deviceName: 'Phone', createdAt: '2026-10-21T08:00:00.000Z', lastSeenAt: '2026-10-21T08:00:00.000Z', rememberMe: true, current: false },
];

beforeEach(() => {
  __resetSyncStatusForTests();
  __resetSyncGateForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  __resetSyncStatusForTests();
  __resetSyncGateForTests();
});

describe('online-only pages without a connection', () => {
  it.each([
    ['insights', InsightsPage, () => api.insights.report],
    ['stats', StatsPage, () => api.stats.overview],
    ['search', SearchPage, () => api.search.run],
    ['backup', BackupPage, () => api.backup.download],
  ] as const)('%s: the page title and the notice; nothing is requested', async (_name, Page, request) => {
    offlineNow();
    renderWithProviders(<Page />, { auth: 'authenticated', locale: 'en' });
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    const notice = screen.getByTestId('needs-connection');
    expect(notice).toHaveTextContent(en('shell.sync.needsConnection'));
    expect(within(notice).getByRole('button', { name: en('shell.retry') })).toBeInTheDocument();
    expect(request()).not.toHaveBeenCalled();
  });

  it('[Try again] probes; when the server answers the notice goes by itself', async () => {
    const tryNow = vi.spyOn(offline, 'tryNow').mockImplementation(async () => {
      patchSyncStatus({ phase: 'online', showOffline: false });
      return true;
    });
    vi.mocked(api.insights.report).mockReturnValue(new Promise(() => undefined));
    offlineNow();
    const { user } = renderWithProviders(<InsightsPage />, { auth: 'authenticated', locale: 'en' });
    await user.click(screen.getByRole('button', { name: en('shell.retry') }));
    expect(tryNow).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('needs-connection')).not.toBeInTheDocument());
    await waitFor(() => expect(politeRegion()).toHaveTextContent(en('shell.connection.restored')));
    expect(api.insights.report).toHaveBeenCalled();
  });

  it('a short drop (suspect, before the bar shows) does not take the page away', () => {
    patchSyncStatus({ enabled: true, userId: sampleUser.id, phase: 'suspect', showOffline: false });
    vi.mocked(api.insights.report).mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<InsightsPage />, { auth: 'authenticated', locale: 'en' });
    expect(screen.queryByTestId('needs-connection')).not.toBeInTheDocument();
  });
});

describe('controls that need a connection', () => {
  it('connected devices: "Disconnect" is disabled and described by the notice', async () => {
    vi.mocked(api.auth.sessions).mockResolvedValue(sessions);
    offlineNow();
    renderWithProviders(<SessionsList />, { auth: 'authenticated', locale: 'en' });
    const revoke = await screen.findByRole('button', { name: /Phone/ });
    expect(revoke).toBeDisabled();
    expect(revoke).toHaveAccessibleDescription(en('shell.sync.needsConnection'));
  });

  it('demo data: the button is disabled and described by the notice', async () => {
    vi.mocked(api.entries.list).mockResolvedValue({ items: [], total: 0, limit: 1, offset: 0 } as never);
    vi.mocked(api.habits.list).mockResolvedValue([]);
    offlineNow();
    renderWithProviders(<DataSection />, { auth: 'authenticated', locale: 'en' });
    const seed = await screen.findByRole('button', { name: en('settings.data.seedDemo') });
    expect(seed).toBeDisabled();
    expect(seed).toHaveAccessibleDescription(en('shell.sync.needsConnection'));
  });
});

describe('drain first (section 4.3)', () => {
  it('nothing waits, or offline mode is off: the write goes ahead at once', async () => {
    const drain = vi.spyOn(offline, 'drain');
    await expect(drainBeforeOnlineWrite()).resolves.toBe(true);
    vi.spyOn(offline, 'isActive').mockReturnValue(true);
    patchSyncStatus({ enabled: true, userId: sampleUser.id, pending: 0 });
    await expect(drainBeforeOnlineWrite()).resolves.toBe(true);
    expect(drain).not.toHaveBeenCalled();
  });

  it('changes wait: "Uploading your changes first…"; what is left stops the write', async () => {
    setCurrentLocale('en');
    vi.spyOn(offline, 'isActive').mockReturnValue(true);
    patchSyncStatus({ enabled: true, userId: sampleUser.id, pending: 2 });
    const drain = vi.spyOn(offline, 'drain').mockResolvedValueOnce({ remaining: 1, attention: 0 }).mockResolvedValueOnce({ remaining: 0, attention: 0 });
    const onDraining = vi.fn();
    const onLeft = vi.fn();
    await expect(drainBeforeOnlineWrite({ onDraining, onLeft })).resolves.toBe(false);
    expect(onDraining).toHaveBeenCalledWith(en('shell.sync.drainFirst'));
    expect(onLeft).toHaveBeenCalledWith(en('shell.sync.drainFailed'));
    await expect(drainBeforeOnlineWrite({ onDraining, onLeft })).resolves.toBe(true);
    expect(drain).toHaveBeenCalledTimes(2);
  });

  it('demo data with changes left on the device: not created, the user is told why', async () => {
    vi.mocked(api.entries.list).mockResolvedValue({ items: [], total: 0, limit: 1, offset: 0 } as never);
    vi.mocked(api.habits.list).mockResolvedValue([]);
    vi.spyOn(offline, 'isActive').mockReturnValue(true);
    vi.spyOn(offline, 'drain').mockResolvedValue({ remaining: 3, attention: 0 });
    act(() => patchSyncStatus({ enabled: true, userId: sampleUser.id, phase: 'online', pending: 3 }));
    const { user } = renderWithProviders(<DataSection />, { auth: 'authenticated', locale: 'en' });
    await user.click(await screen.findByRole('button', { name: en('settings.data.seedDemo') }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: en('settings.data.seedDemoConfirm') }));
    expect(await screen.findByText(en('shell.sync.drainFailed'))).toBeInTheDocument();
    expect(api.settings.seedDemo).not.toHaveBeenCalled();
  });
});
