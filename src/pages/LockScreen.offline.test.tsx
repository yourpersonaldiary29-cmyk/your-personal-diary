/**
 * Offline unlock (docs/android-tasks/OFFLINE-DESIGN.md section 5.7; WP-H10c "Tests"): without a
 * connection the password cannot be checked, so the lock screen offers the device's own user check
 * (the phone's screen lock, Windows Hello: the DeviceUserCheck seam). Available + ok unlocks this
 * device's screen; three cancelled / failed checks, an unavailable check or no check at all (the web)
 * show "Unlocking needs a connection to the diary server. What you wrote is saved on this device." A
 * lock that follows an offline unlock (the server answered 423 to an upload) asks for the password "to
 * upload your changes" - an ordinary lock afterwards does not.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import * as api from '@/api';
import { LOCKED_EVENT } from '@/api';
import { T } from '@/constants/texts';
import { LockProvider, useLock } from '@/context/LockContext';
import { trWith } from '@/i18n/runtime';
import { __resetOfflinePlatformForTests, setOfflinePlatform, type DeviceUserCheck } from '@/offline/seams';
import { __resetSyncStatusForTests, patchSyncStatus } from '@/offline/status';
import { renderWithProviders, sampleUser } from '@/test/render';
import LockScreen from './LockScreen';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

const en = trWith('en');
const deviceButton = () => screen.queryByRole('button', { name: en('shell.sync.lock.deviceUnlock') });
const fallback = () => screen.queryByTestId('lock-offline-fallback');

function userCheck(answers: Awaited<ReturnType<DeviceUserCheck['verify']>>[], available = true) {
  const verify = vi.fn(async () => answers.shift() ?? 'cancelled');
  const check: DeviceUserCheck = { available: vi.fn(async () => available), verify };
  setOfflinePlatform({ userCheck: check });
  return check;
}

function offlineNow(): void {
  patchSyncStatus({ enabled: true, userId: sampleUser.id, phase: 'offline', showOffline: true });
}

function renderLocked(lock: Record<string, unknown> = {}) {
  const unlockOffline = vi.fn();
  const view = renderWithProviders(<LockScreen />, { auth: 'authenticated', locale: 'en', lock: { locked: true, unlockOffline, ...lock } });
  return { ...view, unlockOffline };
}

beforeEach(() => {
  __resetSyncStatusForTests();
  __resetOfflinePlatformForTests();
});

afterEach(() => {
  __resetSyncStatusForTests();
  __resetOfflinePlatformForTests();
  vi.restoreAllMocks();
});

describe('the lock screen without a connection', () => {
  it('the check is available and says ok: this device is unlocked, no fallback text', async () => {
    const check = userCheck(['ok']);
    offlineNow();
    const { user, unlockOffline } = renderLocked();
    const button = await screen.findByRole('button', { name: en('shell.sync.lock.deviceUnlock') });
    expect(fallback()).not.toBeInTheDocument();
    await user.click(button);
    expect(check.verify).toHaveBeenCalledWith(en('shell.sync.lock.deviceReason'));
    await waitFor(() => expect(unlockOffline).toHaveBeenCalledTimes(1));
  });

  it('three cancelled or failed checks: the button goes and the fallback text says why', async () => {
    const check = userCheck(['cancelled', 'failed', 'cancelled']);
    offlineNow();
    const { user, unlockOffline } = renderLocked();
    for (let i = 0; i < 3; i++) {
      await user.click(await screen.findByRole('button', { name: en('shell.sync.lock.deviceUnlock') }));
      await waitFor(() => expect(check.verify).toHaveBeenCalledTimes(i + 1));
    }
    await waitFor(() => expect(deviceButton()).not.toBeInTheDocument());
    expect(fallback()).toHaveTextContent(en('shell.sync.lock.offline'));
    expect(unlockOffline).not.toHaveBeenCalled();
  });

  it('no screen lock on the device (unavailable): only the fallback text', async () => {
    userCheck([], false);
    offlineNow();
    renderLocked();
    expect(await screen.findByTestId('lock-offline-fallback')).toHaveTextContent(en('shell.sync.lock.offline'));
    expect(deviceButton()).not.toBeInTheDocument();
  });

  it('the check answers "unavailable": the fallback text', async () => {
    userCheck(['unavailable']);
    offlineNow();
    const { user, unlockOffline } = renderLocked();
    await user.click(await screen.findByRole('button', { name: en('shell.sync.lock.deviceUnlock') }));
    expect(await screen.findByTestId('lock-offline-fallback')).toBeInTheDocument();
    expect(deviceButton()).not.toBeInTheDocument();
    expect(unlockOffline).not.toHaveBeenCalled();
  });

  it('the web (no user check at all): the fallback text', async () => {
    offlineNow();
    renderLocked();
    expect(await screen.findByTestId('lock-offline-fallback')).toBeInTheDocument();
    expect(deviceButton()).not.toBeInTheDocument();
  });

  it('online: neither the device button nor the fallback (the password unlocks as today)', async () => {
    userCheck(['ok']);
    patchSyncStatus({ enabled: true, userId: sampleUser.id, phase: 'online' });
    renderLocked();
    expect(await screen.findByRole('dialog')).toHaveTextContent(T.lockDescription);
    expect(deviceButton()).not.toBeInTheDocument();
    expect(fallback()).not.toBeInTheDocument();
  });

  it('after an offline unlock the server asked again (423): "Enter your password to upload your changes."', async () => {
    renderLocked({ uploadPrompt: true });
    expect(await screen.findByRole('dialog')).toHaveTextContent(en('shell.sync.lock.passwordToUpload'));
  });
});

describe('LockProvider: the upload prompt', () => {
  function Harness() {
    const { locked, uploadPrompt, lock, unlock, unlockOffline } = useLock();
    return (
      <>
        <p data-testid="state">{`${locked ? 'locked' : 'open'}|${uploadPrompt ? 'upload' : 'plain'}`}</p>
        <button type="button" onClick={lock}>
          lock
        </button>
        <button type="button" onClick={unlock}>
          unlock
        </button>
        <button type="button" onClick={() => unlockOffline?.()}>
          unlock offline
        </button>
      </>
    );
  }

  it('only the 423 after an offline unlock asks for the password to upload; a later ordinary lock does not', async () => {
    vi.mocked(api.auth.lock).mockResolvedValue(undefined as never);
    const { user } = renderWithProviders(
      <LockProvider>
        <Harness />
      </LockProvider>,
      { auth: 'authenticated', locale: 'en' },
    );
    const state = () => screen.getByTestId('state').textContent;
    act(() => {
      window.dispatchEvent(new CustomEvent(LOCKED_EVENT));
    });
    expect(state()).toBe('locked|plain');
    await user.click(screen.getByRole('button', { name: 'unlock offline' }));
    expect(state()).toBe('open|upload');
    // The server still holds the session locked: the next upload answers 423.
    act(() => {
      window.dispatchEvent(new CustomEvent(LOCKED_EVENT));
    });
    expect(state()).toBe('locked|upload');
    await user.click(screen.getByRole('button', { name: 'unlock' }));
    expect(state()).toBe('open|plain');
    // Offline unlock again, then an ordinary lock (auto-lock, Ctrl+L): the plain wording.
    act(() => {
      window.dispatchEvent(new CustomEvent(LOCKED_EVENT));
    });
    await user.click(screen.getByRole('button', { name: 'unlock offline' }));
    expect(state()).toBe('open|upload');
    await user.click(screen.getByRole('button', { name: 'lock' }));
    expect(state()).toBe('locked|plain');
  });
});
