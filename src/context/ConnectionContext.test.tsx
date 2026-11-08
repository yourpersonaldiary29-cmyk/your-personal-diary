/**
 * "No connection to the diary server" (docs/android-tasks/HOSTED-IMPL.md item 8): the probe at start,
 * the full page before the server ever answered, the banner afterwards, Retry, and the session check
 * that waits for Retry instead of signing the device out. The API is mocked; the connection store is
 * driven the way the api client drives it (report lost / reached).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import type { ServerInfo } from '@shared/types';
import * as api from '@/api';
import { ApiClientError, TOKEN_KEY, __resetConnectionForTests, getConnectionState, reportConnectionLost, reportServerReached } from '@/api';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { AppShell } from '@/components/layout/AppShell';
import { T } from '@/constants/texts';
import { SESSION_CHECK_RETRY_DELAYS_MS } from '@/context/AuthContext';
import { trWith } from '@/i18n/runtime';
import { AppRoutes } from '@/router';
import { renderWithProviders, sampleUser } from '@/test/render';
import { ConnectionProvider, __resetConnectionContextForTests, probeServer, retryConnection, useConnectionDisplay, useHostedServer, useServerHost } from './ConnectionContext';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});
vi.mock('@/pages/HomePage', () => ({ default: () => <h1>home page (signed in)</h1> }));

const en = trWith('en');

const localInfo: ServerInfo = {
  version: '0.1.0',
  port: 47000,
  lanEnabled: false,
  lanUrls: [],
  dataDir: 'C:\\fictional\\data',
  isLocalRequest: true,
  startedAt: '2026-10-20T08:00:00.000Z',
};
const hostedInfo: ServerInfo = {
  ...localInfo,
  port: 8080,
  dataDir: '',
  isLocalRequest: false,
  mode: 'hosted',
  publicUrl: 'https://diary.example.org',
  storageOk: true,
  registration: 'open',
  guestTour: true,
};

const unreachable = () => new ApiClientError(0, { code: 'OTHER', message: 'No connection to the diary server.' });

/** The app as the user runs it: the provider, the shell, the banner and the routes with the real auth provider. */
function renderApp(route = '/') {
  return renderWithProviders(
    <ConnectionProvider>
      <AppShell>
        <ConnectionBanner />
        <AppRoutes />
      </AppShell>
    </ConnectionProvider>,
    { auth: 'real', route, locale: 'en' },
  );
}

const page = () => screen.queryByTestId('no-connection-page');
const banner = () => screen.queryByTestId('connection-banner');

beforeEach(() => {
  __resetConnectionForTests();
  __resetConnectionContextForTests();
  vi.mocked(api.server.info).mockReset().mockResolvedValue({ ...localInfo });
  vi.mocked(api.auth.me).mockReset();
});

afterEach(() => {
  __resetConnectionForTests();
  __resetConnectionContextForTests();
});

describe('the probe and the server description', () => {
  it('ConnectionProvider asks the server to describe itself once at start and keeps the answer', async () => {
    vi.mocked(api.server.info).mockResolvedValue({ ...hostedInfo });
    renderApp('/');
    await waitFor(() => expect(getConnectionState().info).toMatchObject({ mode: 'hosted', guestTour: true }));
    expect(api.server.info).toHaveBeenCalledTimes(1);
    expect(getConnectionState().active).toBe(true);
  });

  it('probeServer: an unreachable server is "not reached" (false); a refusal still counts as reached', async () => {
    vi.mocked(api.server.info).mockRejectedValueOnce(unreachable());
    await expect(probeServer()).resolves.toBe(false);
    vi.mocked(api.server.info).mockRejectedValueOnce(new ApiClientError(429, { code: 'OTHER', message: 'slow down' }));
    await expect(probeServer()).resolves.toBe(true);
    vi.mocked(api.server.info).mockResolvedValueOnce(undefined as never);
    await expect(probeServer()).resolves.toBe(true);
    expect(getConnectionState().info).toBeNull();
  });

  it('useHostedServer / useServerHost follow the server description (null host for a local server)', async () => {
    function Probe() {
      const hosted = useHostedServer();
      const host = useServerHost();
      return <p data-testid="probe">{`${hosted}|${host ?? '-'}`}</p>;
    }
    vi.mocked(api.server.info).mockResolvedValue({ ...hostedInfo });
    renderWithProviders(
      <ConnectionProvider>
        <Probe />
      </ConnectionProvider>,
      { auth: 'anonymous', locale: 'en' },
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('false|-');
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('true|diary.example.org'));
  });
});

describe('what the user sees', () => {
  it('server unreachable before it ever answered: the full page with Retry, nothing else; Retry that works brings the app', async () => {
    vi.mocked(api.server.info).mockRejectedValueOnce(unreachable());
    const { user } = renderApp('/');
    // The api client would report it; the mock does not, so the store is told as the client tells it.
    act(() => reportConnectionLost());
    expect(await screen.findByRole('heading', { level: 1, name: en('shell.connection.title') })).toBeInTheDocument();
    expect(screen.getByText(en('shell.connection.text'))).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: T.welcomeTitle })).not.toBeInTheDocument();
    expect(banner()).not.toBeInTheDocument();
    // The server is named plainly, never as an address.
    expect(page()?.textContent).not.toMatch(/https?:\/\//);

    // Retry fails: said under the button, the page stays.
    vi.mocked(api.server.info).mockImplementationOnce(async () => {
      reportConnectionLost();
      throw unreachable();
    });
    await user.click(screen.getByRole('button', { name: T.retry }));
    expect(await screen.findByText(en('shell.connection.failed'))).toBeInTheDocument();
    expect(page()).toBeInTheDocument();

    // Retry works: the welcome page takes the place of the connection page.
    vi.mocked(api.server.info).mockImplementationOnce(async () => {
      reportServerReached();
      return { ...hostedInfo };
    });
    await user.click(screen.getByRole('button', { name: T.retry }));
    expect(await screen.findByRole('heading', { level: 1, name: T.welcomeTitle })).toBeInTheDocument();
    expect(page()).not.toBeInTheDocument();
    expect(getConnectionState()).toMatchObject({ offline: false, reached: true, attempt: 1 });
  });

  it('a connection lost after the server had answered: the banner over the app, the page stays; Retry clears it', async () => {
    const { user } = renderApp('/');
    await waitFor(() => expect(api.server.info).toHaveBeenCalled());
    act(() => reportServerReached());
    expect(screen.getByRole('heading', { level: 1, name: T.welcomeTitle })).toBeInTheDocument();
    expect(banner()).not.toBeInTheDocument();

    act(() => reportConnectionLost());
    expect(await screen.findByTestId('connection-banner')).toBeInTheDocument();
    expect(screen.getByText(en('shell.connection.noServer'))).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: T.welcomeTitle })).toBeInTheDocument();
    expect(page()).not.toBeInTheDocument();

    vi.mocked(api.server.info).mockImplementationOnce(async () => {
      reportServerReached();
      return { ...localInfo };
    });
    await user.click(screen.getByRole('button', { name: T.retry }));
    await waitFor(() => expect(banner()).not.toBeInTheDocument());
  });

  it('an offline start of the apps still pending (OFFLINE-DESIGN.md 4.7): neither page nor banner, so the routes keep the session spinner', () => {
    function Probe() {
      const display = useConnectionDisplay();
      return <p data-testid="display">{display ?? 'none'}</p>;
    }
    const pending = renderWithProviders(
      <ConnectionProvider>
        <Probe />
      </ConnectionProvider>,
      { auth: 'loading', authOverrides: { cacheStartPending: true }, locale: 'en' },
    );
    act(() => reportConnectionLost());
    expect(screen.getByTestId('display')).toHaveTextContent('none');
    pending.unmount();

    // Resolved without the cached diary - or never possible (the web, no binding): the page, as before.
    __resetConnectionForTests();
    renderWithProviders(
      <ConnectionProvider>
        <Probe />
      </ConnectionProvider>,
      { auth: 'loading', authOverrides: { cacheStartPending: false }, locale: 'en' },
    );
    act(() => reportConnectionLost());
    expect(screen.getByTestId('display')).toHaveTextContent('page');
  });

  it('without the ConnectionProvider (a page rendered alone) a lost connection shows neither page nor banner', () => {
    renderWithProviders(
      <>
        <ConnectionBanner />
        <AppRoutes />
      </>,
      { auth: 'anonymous', route: '/', locale: 'en' },
    );
    act(() => reportConnectionLost());
    expect(screen.getByRole('heading', { level: 1, name: T.welcomeTitle })).toBeInTheDocument();
    expect(page()).not.toBeInTheDocument();
    expect(banner()).not.toBeInTheDocument();
  });

  it('the browser coming back online retries by itself', async () => {
    renderApp('/');
    await waitFor(() => expect(api.server.info).toHaveBeenCalledTimes(1));
    act(() => reportConnectionLost());
    vi.mocked(api.server.info).mockImplementationOnce(async () => {
      reportServerReached();
      return { ...localInfo };
    });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(api.server.info).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(getConnectionState()).toMatchObject({ offline: false, attempt: 1 }));
  });

  it('concurrent retries share one probe', async () => {
    let resolveInfo: (info: ServerInfo) => void = () => {};
    vi.mocked(api.server.info).mockReset().mockImplementation(() => new Promise<ServerInfo>((resolve) => (resolveInfo = resolve)));
    const first = retryConnection();
    const second = retryConnection();
    expect(getConnectionState().retrying).toBe(true);
    expect(api.server.info).toHaveBeenCalledTimes(1);
    resolveInfo({ ...localInfo });
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(getConnectionState().retrying).toBe(false);
  });
});

describe('the session check and the connection screen', () => {
  const totalRetryTime = SESSION_CHECK_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.setItem(TOKEN_KEY, 'tok-remembered');
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem(TOKEN_KEY);
  });

  it('an unreachable server keeps the token and the session "loading" behind the connection page; Retry signs in', async () => {
    vi.mocked(api.server.info).mockRejectedValue(unreachable());
    vi.mocked(api.auth.me).mockImplementation(async () => {
      reportConnectionLost();
      throw unreachable();
    });
    const { user } = renderApp('/');
    expect(await screen.findByTestId('no-connection-page')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(totalRetryTime + 1000);
    });
    // The retries are used up; no toast, no welcome page, the token stays.
    expect(api.auth.me).toHaveBeenCalledTimes(SESSION_CHECK_RETRY_DELAYS_MS.length + 1);
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok-remembered');
    expect(page()).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: T.welcomeTitle })).not.toBeInTheDocument();

    // The server is back: Retry reaches it, the session check runs again and signs the device in.
    vi.mocked(api.server.info).mockImplementation(async () => {
      reportServerReached();
      return { ...hostedInfo };
    });
    vi.mocked(api.auth.me).mockImplementation(async () => {
      reportServerReached();
      return { user: sampleUser, session: { id: 's1', deviceName: 'Computer', createdAt: '', lastSeenAt: '', rememberMe: true, current: true } };
    });
    await user.click(screen.getByRole('button', { name: T.retry }));
    expect(await screen.findByRole('heading', { name: 'home page (signed in)' })).toBeInTheDocument();
    expect(api.auth.me).toHaveBeenCalledTimes(SESSION_CHECK_RETRY_DELAYS_MS.length + 2);
    expect(page()).not.toBeInTheDocument();
  });
});
