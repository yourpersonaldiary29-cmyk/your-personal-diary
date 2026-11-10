import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useContext } from 'react';
import * as api from '@/api';
import { ApiClientError, TOKEN_KEY } from '@/api';
import { T } from '@/constants/texts';
import { setCurrentLocale, trWith } from '@/i18n/runtime';
import { __resetConnectionForTests, setServerInfo } from '@/api/connection';
import { BINDING_KEY, offline } from '@/offline';
import { fakeServerInfo } from '@/offline/test-utils/fake-sync-server';
import { sampleUser } from '@/test/render';
import {
  AuthContext,
  AuthProvider,
  SESSION_CHECK_RETRY_DELAYS_MS,
  isTransientSessionError,
  withGuestName,
  type AuthContextValue,
  type AuthNotice,
} from './AuthContext';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

/** The real timer, captured before the fake ones are installed: real-time yields while the clock is faked. */
const realSetTimeout = globalThis.setTimeout;

let latest: { status: string; notice: AuthNotice | null; ctx: AuthContextValue | null } = { status: '', notice: null, ctx: null };
function Probe() {
  const ctx = useContext(AuthContext);
  latest = { status: ctx?.status ?? '', notice: ctx?.notice ?? null, ctx };
  return null;
}

function renderAuth() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </MemoryRouter>,
  );
}

const meOk = () => ({ user: sampleUser, session: { rememberMe: true } }) as never;
const apiError = (status: number) => new ApiClientError(status, { code: 'OTHER', message: `error ${status}` });
const totalRetryTime = SESSION_CHECK_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);

describe('AuthProvider initial session check', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.setItem(TOKEN_KEY, 'tok-remembered');
    vi.mocked(api.auth.me).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem(TOKEN_KEY);
  });

  it('classifies only rate limits, server errors and an unreachable server as transient', () => {
    expect(isTransientSessionError(apiError(429))).toBe(true);
    expect(isTransientSessionError(apiError(503))).toBe(true);
    expect(isTransientSessionError(apiError(0))).toBe(true);
    expect(isTransientSessionError(new Error('boom'))).toBe(true);
    expect(isTransientSessionError(apiError(400))).toBe(false);
    expect(isTransientSessionError(apiError(403))).toBe(false);
  });

  it('retries a busy server (429) and stays signed in without losing the token', async () => {
    vi.mocked(api.auth.me).mockRejectedValueOnce(apiError(429)).mockRejectedValueOnce(apiError(429)).mockResolvedValueOnce(meOk());
    renderAuth();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(totalRetryTime);
    });
    expect(api.auth.me).toHaveBeenCalledTimes(3);
    expect(latest.status).toBe('authenticated');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok-remembered');
    expect(latest.notice).toBeNull();
  });

  it('keeps the token when the server stays unavailable, so the next start restores the session', async () => {
    vi.mocked(api.auth.me).mockRejectedValue(apiError(503));
    renderAuth();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(totalRetryTime + 1000);
    });
    expect(api.auth.me).toHaveBeenCalledTimes(SESSION_CHECK_RETRY_DELAYS_MS.length + 1);
    expect(latest.status).toBe('anonymous');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok-remembered');
    expect(latest.notice).not.toBeNull();
  });

  it('does not retry a 401: the session is gone', async () => {
    vi.mocked(api.auth.me).mockRejectedValue(apiError(401));
    renderAuth();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(totalRetryTime);
    });
    expect(api.auth.me).toHaveBeenCalledTimes(1);
    expect(latest.status).toBe('anonymous');
  });

  it('drops the token on other client errors without retrying', async () => {
    vi.mocked(api.auth.me).mockRejectedValue(apiError(400));
    renderAuth();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(totalRetryTime);
    });
    expect(api.auth.me).toHaveBeenCalledTimes(1);
    expect(latest.status).toBe('anonymous');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(latest.notice).not.toBeNull();
  });

  it('an app with a binding: cacheStartPending from the first render until the offline start has resolved (OFFLINE-DESIGN.md 4.7)', async () => {
    const w = window as unknown as Record<string, unknown>;
    w.__TAURI_INTERNALS__ = {};
    // A binding left by an earlier session; this test device has no readable copy, so the start resolves without the diary.
    localStorage.setItem(BINDING_KEY, JSON.stringify({ userId: 'u_0123456789abcdef', tokenTag: '0000000000000000' }));
    try {
      vi.mocked(api.auth.me).mockRejectedValue(apiError(0));
      renderAuth();
      // Decided before the first request, so the connection page cannot get a frame when the first failure flips the store.
      expect(latest.status).toBe('loading');
      expect(latest.ctx?.cacheStartPending).toBe(true);
      // The offline start was tried at the first connection failure and resolved (this device has no readable
      // copy): the page may show now, and the session check keeps retrying. The start hashes the token
      // (`crypto.subtle.digest`: a real asynchronous job even under fake timers, which a loaded machine answers
      // late), so it is polled with real-time yields; the fake time advanced stays far below the first retry
      // (1 s), so `me()` is still called once.
      for (let i = 0; i < 400 && latest.ctx?.cacheStartPending; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1);
          await new Promise((resolve) => realSetTimeout(resolve, 5));
        });
      }
      expect(api.auth.me).toHaveBeenCalledTimes(1);
      expect(latest.status).toBe('loading');
      expect(latest.ctx?.cacheStartPending).toBe(false);
    } finally {
      delete w.__TAURI_INTERNALS__;
      localStorage.removeItem(BINDING_KEY);
    }
  });

  it('no binding (the web, a session without "Remember me"): never cacheStartPending', () => {
    vi.mocked(api.auth.me).mockRejectedValue(apiError(0));
    renderAuth();
    expect(latest.status).toBe('loading');
    expect(latest.ctx?.cacheStartPending).toBe(false);
  });
});

describe('logout notices', () => {
  const guestUser = { ...sampleUser, id: 'g_1', username: '_guest_1', firstName: '', lastName: '', email: '', guest: true };

  beforeEach(() => {
    setCurrentLocale('en');
    vi.mocked(api.auth.me).mockReset();
    vi.mocked(api.auth.logout).mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  });

  async function signedInAs(user: typeof sampleUser) {
    sessionStorage.setItem(TOKEN_KEY, 'tok');
    vi.mocked(api.auth.me).mockResolvedValue({ user, session: { rememberMe: false } } as never);
    renderAuth();
    await act(async () => {});
    expect(latest.status).toBe('authenticated');
  }

  it('a real account: "You have logged out", marked as a logout (unchanged desktop behaviour)', async () => {
    await signedInAs(sampleUser);
    await act(async () => {
      await latest.ctx!.logout();
    });
    expect(latest.status).toBe('anonymous');
    expect(latest.notice).toMatchObject({ message: T.loggedOut, kind: 'info', reason: 'logout' });
    expect(api.auth.logout).toHaveBeenCalledTimes(1);
  });

  it('the guest of the tour mode: "The tour has ended" in the UI language, not "You have logged out"', async () => {
    await signedInAs(guestUser);
    act(() => setCurrentLocale('he'));
    await act(async () => {
      await latest.ctx!.logout();
    });
    expect(latest.status).toBe('anonymous');
    expect(latest.notice).toMatchObject({ message: trWith('he')('mobile.guest.ended'), kind: 'info', reason: 'logout' });
    expect(latest.notice?.message).not.toBe(trWith('he')('auth.loggedOut'));
  });

  it('{ notice: "none" } ends the session silently (the caller says what happens next)', async () => {
    await signedInAs(guestUser);
    await act(async () => {
      await latest.ctx!.logout({ notice: 'none' });
    });
    expect(latest.status).toBe('anonymous');
    expect(latest.notice).toBeNull();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('the guest is called "Guest" in the UI language; a named profile is left alone', async () => {
    await signedInAs(guestUser);
    expect(latest.ctx!.user?.firstName).toBe('Guest');
    act(() => setCurrentLocale('de'));
    expect(latest.ctx!.user?.firstName).toBe('Gast');
    expect(latest.ctx!.user?.guest).toBe(true);

    expect(withGuestName(sampleUser, 'en')).toBe(sampleUser);
    expect(withGuestName({ ...guestUser, firstName: 'Noa' }, 'en').firstName).toBe('Noa');
    expect(withGuestName(guestUser, 'ja').firstName).toBe(trWith('ja')('mobile.guest.name'));
  });
});

// Offline unlock by password (OFFLINE-DESIGN section 13, 2026-11-08): the password the server has just
// accepted reaches the engine once and is kept nowhere else.
describe('the password in hand reaches the offline engine once', () => {
  beforeEach(() => {
    setCurrentLocale('en');
    vi.mocked(api.auth.me).mockReset();
    vi.mocked(api.auth.login).mockReset();
    vi.mocked(api.auth.verifyPassword).mockReset();
    // A server that offers offline mode: the AuthProvider starts the engine after every session event.
    setServerInfo(fakeServerInfo());
  });
  afterEach(() => {
    vi.restoreAllMocks();
    __resetConnectionForTests();
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  });

  it('login hands the password to offline.start once; the next start of the same session carries none', async () => {
    const start = vi.spyOn(offline, 'start').mockResolvedValue({ enabled: true, recovered: null, readOnly: false });
    vi.mocked(api.auth.login).mockResolvedValue({ token: 'tok-login', user: sampleUser, rememberMe: true } as never);
    renderAuth();
    await act(async () => {});
    expect(latest.status).toBe('anonymous');
    expect(start).not.toHaveBeenCalled();

    await act(async () => {
      await latest.ctx!.login({ username: 'dana', password: 'Passw0rd!', rememberMe: true });
    });
    expect(latest.status).toBe('authenticated');
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][0]).toMatchObject({ user: sampleUser, rememberMe: true, password: 'Passw0rd!' });
    // The same session again (me() after a profile refresh): no password is in hand any more.
    vi.mocked(api.auth.me).mockResolvedValue(meOk());
    await act(async () => {
      await latest.ctx!.refreshUser();
    });
    expect(start).toHaveBeenCalledTimes(2);
    expect(start.mock.calls[1][0].password).toBeUndefined();
    // Nothing of the provider's state holds it, and no storage does.
    expect(JSON.stringify(latest.ctx)).not.toContain('Passw0rd!');
    expect([...Array(localStorage.length).keys()].map((i) => localStorage.getItem(localStorage.key(i)!)).join()).not.toContain('Passw0rd!');
    expect([...Array(sessionStorage.length).keys()].map((i) => sessionStorage.getItem(sessionStorage.key(i)!)).join()).not.toContain('Passw0rd!');
  });

  it('a run that cannot start the engine (a session from me() without offline mode) drops the login password', async () => {
    const start = vi.spyOn(offline, 'start').mockResolvedValue({ enabled: false, reason: 'unsupported' });
    __resetConnectionForTests(); // no server info yet: the start effect does not run for the login
    vi.mocked(api.auth.login).mockResolvedValue({ token: 'tok-login', user: sampleUser, rememberMe: false } as never);
    renderAuth();
    await act(async () => {});
    await act(async () => {
      await latest.ctx!.login({ username: 'dana', password: 'Passw0rd!' });
    });
    expect(start).not.toHaveBeenCalled();
    // The server's self-description arrives afterwards: the engine starts, but the password is gone.
    await act(async () => {
      setServerInfo(fakeServerInfo());
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][0].password).toBeUndefined();
  });

  it('verifyPassword refreshes the wrap only when the server accepted the password', async () => {
    vi.spyOn(offline, 'start').mockResolvedValue({ enabled: true, recovered: null, readOnly: false });
    const refresh = vi.spyOn(offline, 'refreshPasswordWrap').mockResolvedValue(true);
    sessionStorage.setItem(TOKEN_KEY, 'tok');
    vi.mocked(api.auth.me).mockResolvedValue(meOk());
    renderAuth();
    await act(async () => {});
    expect(latest.status).toBe('authenticated');

    vi.mocked(api.auth.verifyPassword).mockResolvedValue({ ok: true });
    await act(async () => {
      expect(await latest.ctx!.verifyPassword('Passw0rd!')).toBe(true);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith('Passw0rd!');

    vi.mocked(api.auth.verifyPassword).mockRejectedValue(new ApiClientError(401, { code: 'WRONG_PASSWORD', message: 'wrong' }));
    await act(async () => {
      expect(await latest.ctx!.verifyPassword('not-it')).toBe(false);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(latest.status).toBe('authenticated');
  });
});
