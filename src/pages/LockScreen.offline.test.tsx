/**
 * Offline unlock (docs/android-tasks/OFFLINE-DESIGN.md section 5.7 and the 2026-11-08 note in section
 * 13; WP-H10c "Tests"): without a connection the server cannot check the password, so the lock screen
 * offers two ways that unlock this device's screen only. (1) The device's own user check (the phone's
 * screen lock, Windows Hello: the DeviceUserCheck seam): available + ok unlocks; three cancelled /
 * failed checks or an unavailable check take the button away. (2) The password, checked on the device
 * by the engine against the wrap it kept (`offline.unlockWithPassword`): the form stays as online with
 * the note "No connection: your password is checked on this device."; a wrong password shows the usual
 * error, from the third on with the wait text. Only when NEITHER exists the screen says "Unlocking
 * needs a connection to the diary server. What you wrote is saved on this device." A lock that follows
 * an offline unlock (the server answered 423 to an upload) asks for the password "to upload your
 * changes" - an ordinary lock afterwards does not.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import * as api from '@/api';
import { LOCKED_EVENT } from '@/api';
import { T } from '@/constants/texts';
import { LockProvider, useLock } from '@/context/LockContext';
import { trWith } from '@/i18n/runtime';
import { offline } from '@/offline';
import { __resetOfflinePlatformForTests, setOfflinePlatform, type DeviceUserCheck } from '@/offline/seams';
import { __resetSyncStatusForTests, patchSyncStatus } from '@/offline/status';
import { politeRegion, renderWithProviders, sampleUser } from '@/test/render';
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

describe('the lock screen without a connection: the password checked on this device (section 13, 2026-11-08)', () => {
  const note = () => screen.queryByTestId('lock-password-offline');
  const passwordField = () => within(screen.getByRole('dialog')).getByLabelText(new RegExp(`^${T.password}`));
  /** The field's error line (the assertive live region repeats it, so the text appears twice). */
  const fieldError = () => screen.getByRole('dialog').querySelector('.field__error')?.textContent ?? null;

  function engineWithWrap(answers: Awaited<ReturnType<typeof offline.unlockWithPassword>>[]) {
    vi.spyOn(offline, 'canUnlockWithPassword').mockResolvedValue(true);
    return vi.spyOn(offline, 'unlockWithPassword').mockImplementation(async () => answers.shift() ?? { outcome: 'wrong', waitSeconds: 0 });
  }

  it('a wrap on this device: the note is the field\'s hint, the password unlocks this device only, the device button stays', async () => {
    userCheck(['ok']);
    offlineNow();
    const unlockWithPassword = engineWithWrap([{ outcome: 'ok', waitSeconds: 0 }]);
    const verifyPassword = vi.fn();
    const unlock = vi.fn();
    const { user, unlockOffline } = renderWithProvidersLocked({ verifyPassword, unlock });
    const hint = await screen.findByTestId('lock-password-offline');
    expect(hint).toHaveTextContent(en('shell.sync.lock.passwordOffline'));
    // Inside the dialog, referenced by the password field.
    expect(screen.getByRole('dialog')).toContainElement(hint);
    const hintLine = hint.closest('p')!;
    expect(passwordField().getAttribute('aria-describedby')?.split(' ')).toContain(hintLine.id);
    expect(deviceButton()).toBeInTheDocument();
    expect(fallback()).not.toBeInTheDocument();
    // Escape does not dismiss the lock screen (unchanged).
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.type(passwordField(), 'Passw0rd!{Enter}');
    await waitFor(() => expect(unlockWithPassword).toHaveBeenCalledWith('Passw0rd!'));
    await waitFor(() => expect(unlockOffline).toHaveBeenCalledTimes(1));
    // The typed password does not stay in the form's state after the unlock.
    expect(passwordField()).toHaveValue('');
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(unlock).not.toHaveBeenCalled();
    // The existing "unlocked" announcement, as after the device check.
    await waitFor(() => expect(politeRegion()).toHaveTextContent(T.unlocked));
  });

  it('a wrong password: the usual error; from the third on the wait text with its plural; during the wait only the wait text', async () => {
    offlineNow();
    engineWithWrap([
      { outcome: 'wrong', waitSeconds: 0 },
      { outcome: 'wrong', waitSeconds: 2 },
      { outcome: 'wait', waitSeconds: 1 },
    ]);
    const { user, unlockOffline } = renderWithProvidersLocked();
    await screen.findByTestId('lock-password-offline');
    await user.type(passwordField(), 'nope{Enter}');
    await waitFor(() => expect(fieldError()).toBe(T.lockWrongPassword));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(T.lockWrongPassword);
    expect(passwordField()).toHaveValue('');
    expect(passwordField()).toHaveFocus();
    await user.type(passwordField(), 'nope{Enter}');
    await waitFor(() => expect(fieldError()).toBe(`${T.lockWrongPassword} ${en('shell.sync.lock.wait', { seconds: 2 })}`));
    expect(fieldError()).toContain('Wait 2 seconds before trying again.');
    await user.type(passwordField(), 'nope{Enter}');
    await waitFor(() => expect(fieldError()).toBe(en('shell.sync.lock.wait', { seconds: 1 })));
    expect(fieldError()).toBe('Wait 1 second before trying again.');
    // Nothing was checked during the wait: the typed password stays for the next try.
    expect(passwordField()).toHaveValue('nope');
    expect(passwordField()).toHaveFocus();
    expect(unlockOffline).not.toHaveBeenCalled();
    // The note stays: a wrap exists, the fallback never shows.
    expect(note()).toBeInTheDocument();
    expect(fallback()).not.toBeInTheDocument();
  });

  it('a wrap but no device check (the web, the same run): the password form with the note; no device button, no fallback', async () => {
    offlineNow();
    engineWithWrap([]);
    renderWithProvidersLocked();
    expect(await screen.findByTestId('lock-password-offline')).toBeInTheDocument();
    expect(deviceButton()).not.toBeInTheDocument();
    expect(fallback()).not.toBeInTheDocument();
  });

  it('no wrap and no device check: the fallback only; a submit then shows the fallback text at the field', async () => {
    offlineNow();
    vi.spyOn(offline, 'canUnlockWithPassword').mockResolvedValue(false);
    vi.spyOn(offline, 'unlockWithPassword').mockResolvedValue({ outcome: 'unavailable', waitSeconds: 0 });
    const { user, unlockOffline } = renderWithProvidersLocked();
    expect(await screen.findByTestId('lock-offline-fallback')).toHaveTextContent(en('shell.sync.lock.offline'));
    expect(note()).not.toBeInTheDocument();
    await user.type(passwordField(), 'Passw0rd!{Enter}');
    await waitFor(() => expect(fieldError()).toBe(en('shell.sync.lock.offline')));
    expect(unlockOffline).not.toHaveBeenCalled();
  });

  it('online: the password goes to the server (verifyPassword) and never to the engine', async () => {
    patchSyncStatus({ enabled: true, userId: sampleUser.id, phase: 'online' });
    const unlockWithPassword = vi.spyOn(offline, 'unlockWithPassword');
    const canUnlock = vi.spyOn(offline, 'canUnlockWithPassword');
    const verifyPassword = vi.fn().mockResolvedValue(true);
    const unlock = vi.fn();
    const { user, unlockOffline } = renderWithProvidersLocked({ verifyPassword, unlock });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(note()).not.toBeInTheDocument();
    await user.type(passwordField(), 'Passw0rd!{Enter}');
    await waitFor(() => expect(verifyPassword).toHaveBeenCalledWith('Passw0rd!'));
    await waitFor(() => expect(unlock).toHaveBeenCalledTimes(1));
    expect(unlockWithPassword).not.toHaveBeenCalled();
    expect(canUnlock).not.toHaveBeenCalled();
    expect(unlockOffline).not.toHaveBeenCalled();
  });

  it('in Hebrew (RTL) and Arabic the note and the wait text are the shipped translations with the right plural', async () => {
    offlineNow();
    engineWithWrap([{ outcome: 'wrong', waitSeconds: 2 }]);
    const he = trWith('he');
    const unlockOffline = vi.fn();
    const { user } = renderWithProviders(<LockScreen />, { auth: 'authenticated', locale: 'he', lock: { locked: true, unlockOffline } });
    expect(await screen.findByTestId('lock-password-offline')).toHaveTextContent('אין חיבור: הסיסמה שלך נבדקת במכשיר הזה.');
    await user.type(within(screen.getByRole('dialog')).getByLabelText(new RegExp(`^${he('auth.password')}`)), 'nope{Enter}');
    await waitFor(() => expect(fieldError()).toBe('הסיסמה שגויה. נסו שוב. יש להמתין שתי שניות לפני ניסיון נוסף.'));
    expect(trWith('ar')('shell.sync.lock.wait', { seconds: 2 })).toBe('انتظر ثانيتين قبل المحاولة مرة أخرى.');
    expect(trWith('ja')('shell.sync.lock.wait', { seconds: 4 })).toBe('4秒待ってから、もう一度お試しください。');
  });

  it('in Japanese (and Chinese) the error and the wait text are joined without a space', async () => {
    offlineNow();
    engineWithWrap([{ outcome: 'wrong', waitSeconds: 2 }]);
    const ja = trWith('ja');
    const unlockOffline = vi.fn();
    const { user } = renderWithProviders(<LockScreen />, { auth: 'authenticated', locale: 'ja', lock: { locked: true, unlockOffline } });
    await screen.findByTestId('lock-password-offline');
    await user.type(within(screen.getByRole('dialog')).getByLabelText(new RegExp(`^${ja('auth.password')}`)), 'nope{Enter}');
    await waitFor(() => expect(fieldError()).toBe('パスワードが正しくありません。もう一度お試しください。2秒待ってから、もう一度お試しください。'));
  });

  it('the 423 upload prompt while the connection is gone again: the plain description (offline the password uploads nothing)', async () => {
    offlineNow();
    engineWithWrap([]);
    renderWithProviders(<LockScreen />, { auth: 'authenticated', locale: 'en', lock: { locked: true, unlockOffline: vi.fn(), uploadPrompt: true } });
    await screen.findByTestId('lock-password-offline');
    expect(screen.getByRole('dialog')).toHaveTextContent(T.lockDescription);
    expect(screen.getByRole('dialog')).not.toHaveTextContent(en('shell.sync.lock.passwordToUpload'));
  });

  function renderWithProvidersLocked(overrides: { verifyPassword?: ReturnType<typeof vi.fn>; unlock?: ReturnType<typeof vi.fn> } = {}) {
    const unlockOffline = vi.fn();
    const view = renderWithProviders(<LockScreen />, {
      auth: 'authenticated',
      locale: 'en',
      authOverrides: overrides.verifyPassword ? { verifyPassword: overrides.verifyPassword as never } : undefined,
      lock: { locked: true, unlockOffline, ...(overrides.unlock ? { unlock: overrides.unlock as unknown as () => void } : {}) },
    });
    return { ...view, unlockOffline };
  }
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
