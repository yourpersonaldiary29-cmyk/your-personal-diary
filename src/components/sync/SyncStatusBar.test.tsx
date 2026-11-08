/**
 * The status bar of the automatic offline mode (docs/android-tasks/OFFLINE-DESIGN.md section 6.1,
 * WP-H10c "Tests"): every state of the bar, no flicker on a 300 ms drop (the engine's own
 * connectivity monitor drives it with fake timers), one announcement per state change (only "needs
 * your attention" is assertive), the slot it shares with the connection banner, and the line about
 * another account's changes with its confirmed [Delete].
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { __resetConnectionForTests, reportConnectionLost, reportServerReached, setConnectionUiActive } from '@/api';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { SyncContext } from '@/context/SyncContext';
import { offline } from '@/offline';
import { ConnectivityMonitor } from '@/offline/connectivity';
import { __resetSyncStatusForTests, patchSyncStatus, type SyncStatus } from '@/offline/status';
import { trWith } from '@/i18n/runtime';
import { assertiveRegion, politeRegion, renderWithProviders, sampleUser } from '@/test/render';
import { SyncStatusBar, syncBarState } from './SyncStatusBar';

const en = trWith('en');

const bar = () => screen.queryByTestId('sync-status-bar');

/** Offline mode armed for the signed-in test user (sampleUser), plus the given fields. */
function armed(patch: Partial<SyncStatus> = {}): void {
  patchSyncStatus({ enabled: true, userId: sampleUser.id, ...patch });
}

function renderBar(openReview = vi.fn()) {
  const view = renderWithProviders(
    <SyncContext.Provider value={{ openReview }}>
      <ConnectionBanner />
      <SyncStatusBar />
    </SyncContext.Provider>,
    { auth: 'authenticated', locale: 'en' },
  );
  return { ...view, openReview };
}

beforeEach(() => {
  __resetSyncStatusForTests();
  vi.spyOn(offline, 'otherAccountsWithPending').mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  __resetSyncStatusForTests();
  __resetConnectionForTests();
});

describe('the states of the bar', () => {
  it('nothing while offline mode is off, or armed for another account, or all is well', () => {
    renderBar();
    expect(bar()).not.toBeInTheDocument();
    act(() => patchSyncStatus({ enabled: true, userId: 'u_someone_else', phase: 'offline', showOffline: true }));
    expect(bar()).not.toBeInTheDocument();
    act(() => armed({ phase: 'online', showOffline: false }));
    expect(bar()).not.toBeInTheDocument();
  });

  it('offline, nothing waiting: the text and [Try now], no [Review]; a status region', () => {
    renderBar();
    act(() => armed({ phase: 'offline', showOffline: true }));
    const b = bar() as HTMLElement;
    expect(b).toHaveAttribute('role', 'status');
    expect(b).toHaveTextContent(en('shell.sync.offline'));
    expect(within(b).getByRole('button', { name: en('shell.sync.tryNow') })).toBeInTheDocument();
    expect(within(b).queryByRole('button', { name: en('shell.sync.review') })).not.toBeInTheDocument();
  });

  it('offline, 3 waiting: the chip "3 changes waiting", [Try now] and [Review] (which opens the review)', () => {
    const { openReview } = renderBar();
    act(() => armed({ phase: 'offline', showOffline: true, pending: 3 }));
    const b = bar() as HTMLElement;
    expect(within(b).getByText(en('shell.sync.waiting', { count: 3 }))).toBeInTheDocument();
    expect(en('shell.sync.waiting', { count: 3 })).toBe('3 changes waiting');
    fireEvent.click(within(b).getByRole('button', { name: en('shell.sync.review') }));
    expect(openReview).toHaveBeenCalledTimes(1);
  });

  it('uploading, then drained, then gone', () => {
    renderBar();
    act(() => armed({ phase: 'syncing', pending: 2 }));
    expect(bar()).toHaveTextContent('Uploading 2 changes…');
    act(() => patchSyncStatus({ phase: 'online', pending: 0, showDrained: true }));
    expect(bar()).toHaveTextContent(en('shell.sync.allSaved'));
    act(() => patchSyncStatus({ showDrained: false }));
    expect(bar()).not.toBeInTheDocument();
  });

  it('attention stays while online: "1 change needs your attention" [Review]', () => {
    const { openReview } = renderBar();
    act(() => armed({ phase: 'online', attention: 1 }));
    const b = bar() as HTMLElement;
    expect(b).toHaveTextContent('1 change needs your attention');
    expect(within(b).queryByRole('button', { name: en('shell.sync.tryNow') })).not.toBeInTheDocument();
    fireEvent.click(within(b).getByRole('button', { name: en('shell.sync.review') }));
    expect(openReview).toHaveBeenCalled();
  });

  it('syncBarState: offline wins over attention; suspect (the first 1.5 s) shows nothing', () => {
    const base = { enabled: true, phase: 'online', showOffline: false, showDrained: false, pending: 0, attention: 0, halted: null } as unknown as SyncStatus;
    expect(syncBarState({ ...base, phase: 'suspect' })).toBeNull();
    expect(syncBarState({ ...base, phase: 'offline', showOffline: true, attention: 2 })).toBe('offline');
    expect(syncBarState({ ...base, attention: 2 })).toBe('attention');
    expect(syncBarState({ ...base, halted: 'unreadable' })).toBe('unreadable');
    expect(syncBarState({ ...base, enabled: false, phase: 'offline', showOffline: true })).toBeNull();
  });
});

describe('timing (the engine connectivity monitor, fake timers)', () => {
  it('a 300 ms drop never shows the bar; 1.5 s of failure does', () => {
    vi.useFakeTimers();
    renderBar();
    act(() => armed());
    const monitor = new ConnectivityMonitor({ probe: async () => false, pendingCount: () => 0 });
    act(() => monitor.noteFailure());
    expect(bar()).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(300));
    expect(bar()).not.toBeInTheDocument();
    act(() => monitor.noteSuccess());
    act(() => vi.advanceTimersByTime(2000));
    expect(bar()).not.toBeInTheDocument();

    act(() => monitor.noteFailure());
    act(() => vi.advanceTimersByTime(1499));
    expect(bar()).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(bar()).toHaveTextContent(en('shell.sync.offline'));
    monitor.stop();
  });
});

describe('announcements', () => {
  it('one polite announcement per state change; "needs your attention" is assertive', async () => {
    renderBar();
    act(() => armed({ phase: 'offline', showOffline: true, pending: 1 }));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(en('shell.sync.offline')));
    // A new count inside the same state is not a new announcement.
    act(() => patchSyncStatus({ pending: 2 }));
    act(() => armed({ phase: 'syncing', showOffline: false, pending: 2 }));
    await waitFor(() => expect(politeRegion()).toHaveTextContent('Uploading 2 changes…'));
    act(() => patchSyncStatus({ phase: 'online', pending: 0, attention: 1 }));
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent('1 change needs your attention'));
  });
});

describe('the slot shared with the connection banner', () => {
  it('the banner shows while offline mode is off; the bar takes its place when it runs', async () => {
    setConnectionUiActive(true);
    reportServerReached();
    reportConnectionLost();
    renderBar();
    expect(screen.getByTestId('connection-banner')).toBeInTheDocument();
    act(() => armed({ phase: 'offline', showOffline: true }));
    expect(screen.queryByTestId('connection-banner')).not.toBeInTheDocument();
    expect(bar()).toBeInTheDocument();
  });

  it('[Try now] probes; a failed probe is announced', async () => {
    const tryNow = vi.spyOn(offline, 'tryNow').mockResolvedValue(false);
    renderBar();
    act(() => armed({ phase: 'offline', showOffline: true }));
    fireEvent.click(screen.getByRole('button', { name: en('shell.sync.tryNow') }));
    expect(tryNow).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(en('shell.connection.failed')));
  });
});

describe('changes of another account on this device (section 4.8)', () => {
  it('a neutral line (no name, no content) with [Delete] behind a confirmation', async () => {
    vi.mocked(offline.otherAccountsWithPending).mockResolvedValue([{ userId: 'u_fedcba9876543210', count: 2 }]);
    const wipe = vi.spyOn(offline, 'wipeAccount').mockResolvedValue(undefined);
    const { user } = renderBar();
    act(() => armed());
    const line = await screen.findByTestId('sync-other-account');
    expect(line).toHaveTextContent(en('shell.sync.otherAccount.text'));
    expect(line).not.toHaveTextContent('u_fedcba9876543210');
    expect(offline.otherAccountsWithPending).toHaveBeenCalledWith(sampleUser.id);

    await user.click(within(line).getByRole('button', { name: en('shell.sync.otherAccount.delete') }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(en('shell.sync.otherAccount.confirm'));
    // Cancel keeps everything.
    await user.click(within(dialog).getByRole('button', { name: en('shell.cancel') }));
    expect(wipe).not.toHaveBeenCalled();

    await user.click(within(screen.getByTestId('sync-other-account')).getByRole('button', { name: en('shell.sync.otherAccount.delete') }));
    const again = await screen.findByRole('dialog');
    await user.click(within(again).getByRole('button', { name: en('shell.sync.otherAccount.delete') }));
    await waitFor(() => expect(wipe).toHaveBeenCalledWith('u_fedcba9876543210'));
    await waitFor(() => expect(screen.queryByTestId('sync-other-account')).not.toBeInTheDocument());
  });
});
