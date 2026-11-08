/**
 * The lock screen survives a reload (review finding: the lock was React state only, so F5 / pull to
 * refresh unlocked the diary). The server keeps the lock; a session that comes back locked shows
 * the lock screen at once and no page is mounted behind it until the password is entered.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import type { SessionInfo } from '@shared/types';
import * as api from '@/api';
import { LOCKED_EVENT, TOKEN_KEY } from '@/api';
import { T } from '@/constants/texts';
import { useLock } from '@/context/LockContext';
import { renderWithProviders, sampleUser } from '@/test/render';
import LockScreen from './LockScreen';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

const session: SessionInfo = {
  id: 's1',
  deviceName: 'Desktop',
  createdAt: '2026-09-30T08:00:00.000Z',
  lastSeenAt: '2026-09-30T08:00:00.000Z',
  rememberMe: false,
  current: true,
};

/** Stands in for the pages: App.tsx renders them only when the lock did not come from a reload. */
function Harness() {
  const { restoredLocked, lock } = useLock();
  return (
    <>
      <div id="app-root">
        {!restoredLocked && <p>Private entry text</p>}
        <button type="button" onClick={lock}>
          lock now
        </button>
      </div>
      <LockScreen />
    </>
  );
}

describe('LockScreen + server-side lock', () => {
  beforeEach(() => {
    window.localStorage.setItem(TOKEN_KEY, 'tok-lock');
  });
  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('a session that comes back locked after a reload shows the lock screen and no page until unlocked', async () => {
    vi.mocked(api.auth.me).mockResolvedValue({ user: sampleUser, session: { ...session, locked: true } });
    const { user } = renderWithProviders(<Harness />, { auth: 'real' });
    const dialog = await screen.findByRole('dialog');
    expect(screen.queryByText('Private entry text')).not.toBeInTheDocument();
    expect(document.getElementById('app-root')).toHaveAttribute('inert');

    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), 'Passw0rd!{Enter}');
    await waitFor(() => expect(api.auth.verifyPassword).toHaveBeenCalledWith('Passw0rd!'));
    expect(await screen.findByText('Private entry text')).toBeInTheDocument();
    await waitFor(() => expect(document.getElementById('app-root')).not.toHaveAttribute('inert'));
  });

  it('locking locks the session on the server too, and a 423 answer elsewhere shows the lock screen', async () => {
    vi.mocked(api.auth.me).mockResolvedValue({ user: sampleUser, session });
    const { user } = renderWithProviders(<Harness />, { auth: 'real' });
    await user.click(await screen.findByRole('button', { name: 'lock now' }));
    await waitFor(() => expect(api.auth.lock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(document.getElementById('app-root')).toHaveAttribute('inert'));
    // Typed text in the page stays (the page stays mounted behind a lock made on this screen).
    expect(screen.getByText('Private entry text')).toBeInTheDocument();

    await user.type(within(screen.getByRole('dialog')).getByLabelText(new RegExp(`^${T.password}`)), 'Passw0rd!{Enter}');
    await waitFor(() => expect(document.getElementById('app-root')).not.toHaveAttribute('inert'));

    act(() => {
      window.dispatchEvent(new CustomEvent(LOCKED_EVENT));
    });
    await waitFor(() => expect(document.getElementById('app-root')).toHaveAttribute('inert'));
  });

  it('after unlocking a lock that came back with a reload, focus goes to the page heading (not <body>)', async () => {
    vi.mocked(api.auth.me).mockResolvedValue({ user: sampleUser, session: { ...session, locked: true } });
    function WithHeading() {
      const { restoredLocked } = useLock();
      return (
        <>
          <div id="app-root">
            {!restoredLocked && (
              <h1 id="page-title" tabIndex={-1}>
                Diary page
              </h1>
            )}
          </div>
          <LockScreen />
        </>
      );
    }
    const { user } = renderWithProviders(<WithHeading />, { auth: 'real' });
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), 'Passw0rd!{Enter}');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Diary page' });
    await waitFor(() => expect(heading).toHaveFocus());
  });
});
