/**
 * The "Skip - just look around" flow of the phone app, end to end in the UI: the real auth / settings
 * / lock providers and the phone shell around the real routes, with the API mocked. The button is
 * ANDROID-APP ONLY (owner decision 2026-10-23, docs/android-tasks/HOSTED-IMPL.md item 12): the Windows
 * app and the web UI never offer it, even when the hosted server says `guestTour: true`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { AuthResponse, ServerInfo, UserProfile } from '@shared/types';
import * as api from '@/api';
import { ApiClientError, TOKEN_KEY, __resetConnectionForTests, setServerInfo } from '@/api';
import { AppShell } from '@/components/layout/AppShell';
import { T } from '@/constants/texts';
import { useAuth } from '@/context/AuthContext';
import { setCurrentLocale, trWith } from '@/i18n/runtime';
import SettingsPage from '@/pages/SettingsPage';
import { ST } from '@/pages/settings/texts';
import { AppRoutes } from '@/router';
import { renderWithProviders, sampleUser, type ProviderOptions } from '@/test/render';
import App from '@/App';
import { __resetSkipTourForTests, tourOffered } from './SkipTourButton';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  const mock = createApiMock(await importOriginal());
  // auth.guest is newer than the shared mock (src/test/api-mock.ts); add it here.
  return { ...mock, auth: { ...mock.auth, guest: vi.fn() } };
});

// The home page belongs to another package (and loads data); the flow only needs to recognise it.
vi.mock('@/pages/HomePage', () => ({ default: () => <h1>home page (signed in)</h1> }));

const en = trWith('en');

const guestUser: UserProfile = {
  id: 'g_0011223344556677',
  username: '_guest_a1b2c3d4',
  firstName: '',
  lastName: '',
  email: '',
  createdAt: '2026-10-02T08:00:00.000Z',
  guest: true,
};

const guestAnswer: AuthResponse = {
  token: 'guest-token',
  user: guestUser,
  expiresAt: '2026-10-02T20:00:00.000Z',
  rememberMe: false,
  guest: true,
};

const guestMock = () => vi.mocked(api.auth.guest);
const skipButton = () => screen.queryByRole('button', { name: en('mobile.guest.skip') });

/** A server on this device (the developer configuration; the phone's own in-process core). */
const localInfo: ServerInfo = {
  version: '0.1.0',
  port: 47000,
  lanEnabled: false,
  lanUrls: [],
  dataDir: 'C:\\fictional\\data',
  isLocalRequest: true,
  startedAt: '2026-10-20T08:00:00.000Z',
};
/** The hosted Your Personal Diary server: it keeps POST /api/auth/guest (for the Android app) and says so. */
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

/** The Windows app: the Tauri shell's global is there (src/api/client.ts `isTauri`). */
function setTauri(on: boolean): void {
  const w = window as unknown as Record<string, unknown>;
  if (on) w.__TAURI_INTERNALS__ = {};
  else delete w.__TAURI_INTERNALS__;
}

/** A browser on a phone: Android user agent, 375 px wide, touch screen (the media queries of a phone match). */
function phoneSizedBrowser(): void {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  );
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(375);
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: /max-width|pointer:\s*coarse|hover:\s*none/.test(query),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

/** The app as the phone runs it: the shell around the routes, real providers. */
function renderApp(route = '/', options: ProviderOptions = {}) {
  return renderWithProviders(
    <AppShell>
      <AppRoutes />
    </AppShell>,
    { auth: 'real', route, locale: 'en', ...options },
  );
}

/** The first name of the signed-in profile as the pages see it (the home page greets with it). */
function FirstNameProbe() {
  const { user } = useAuth();
  return <p data-testid="first-name">{user?.firstName ?? '(nobody)'}</p>;
}

beforeEach(() => {
  vi.stubGlobal('__MOBILE__', true);
  __resetSkipTourForTests();
  guestMock().mockReset().mockResolvedValue(guestAnswer);
  vi.mocked(api.auth.logout).mockReset().mockResolvedValue(undefined);
  vi.mocked(api.auth.me).mockReset();
  vi.mocked(api.auth.lock).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setTauri(false);
  __resetConnectionForTests();
  __resetSkipTourForTests();
});

describe('Skip - just look around', () => {
  it('the button is on the welcome, login and registration screens of the phone app', async () => {
    const welcome = renderApp('/');
    expect(skipButton()).toBeInTheDocument();
    expect(skipButton()).toHaveAccessibleDescription(en('mobile.guest.skipHint'));
    welcome.unmount();

    const login = renderApp('/login');
    expect(await screen.findByRole('heading', { level: 1, name: T.loginTitle })).toBeInTheDocument();
    expect(skipButton()).toBeInTheDocument();
    login.unmount();

    renderApp('/register');
    expect(await screen.findByRole('heading', { level: 1, name: T.registerTitle })).toBeInTheDocument();
    expect(skipButton()).toBeInTheDocument();
  });

  it('Android app with the hosted server (guestTour: true), installed (Capacitor, native platform): offered on all three screens', async () => {
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, getPlatform: () => 'android' });
    act(() => setServerInfo({ ...hostedInfo }));
    // The titles are read after the render: it switches the UI to English.
    for (const [route, title] of [
      ['/', () => T.welcomeTitle],
      ['/login', () => T.loginTitle],
      ['/register', () => T.registerTitle],
    ] as const) {
      const view = renderApp(route);
      expect(await screen.findByRole('heading', { level: 1, name: title() })).toBeInTheDocument();
      expect(skipButton()).toBeInTheDocument();
      view.unmount();
    }
  });

  it('Android app: a hosted server that turned the tour off (guestTour: false) hides it', async () => {
    act(() => setServerInfo({ ...hostedInfo, guestTour: false }));
    renderApp('/');
    expect(screen.getByRole('heading', { level: 1, name: T.welcomeTitle })).toBeInTheDocument();
    expect(skipButton()).not.toBeInTheDocument();
  });

  it('starts a guest session (never remembered), enters the app and shows the tour banner', async () => {
    const { user } = renderApp('/');
    await user.click(skipButton() as HTMLElement);

    expect(await screen.findByRole('heading', { name: 'home page (signed in)' })).toBeInTheDocument();
    expect(guestMock()).toHaveBeenCalledTimes(1);
    expect(guestMock()).toHaveBeenCalledWith({ deviceName: expect.any(String), language: 'en' });
    // Stored like a login WITHOUT "Remember me": this app session only.
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('guest-token');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();

    const banner = screen.getByText(en('mobile.guest.banner'));
    expect(banner).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: en('mobile.guest.createAccount') })).toBeInTheDocument();
    expect(await screen.findByText(en('mobile.guest.started'))).toBeInTheDocument();
    // The app itself is there: bottom navigation and the floating button.
    expect(screen.getByRole('navigation', { name: en('shell.mainNavLabel') })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en('shell.nav.newEntry') })).toBeInTheDocument();
  });

  it('sends the UI language of the screen with the request', async () => {
    const { user } = renderApp('/login', { locale: 'he' });
    await user.click(await screen.findByRole('button', { name: trWith('he')('mobile.guest.skip') }));
    await waitFor(() => expect(guestMock()).toHaveBeenCalledWith({ deviceName: expect.any(String), language: 'he' }));
    expect(await screen.findByText(trWith('he')('mobile.guest.banner'))).toBeInTheDocument();
  });

  it('the guest has a name in the UI language ("Hello Guest", never "Hello "), and it follows a language change', async () => {
    const { user } = renderWithProviders(
      <AppShell>
        <AppRoutes />
        <FirstNameProbe />
      </AppShell>,
      { auth: 'real', route: '/', locale: 'en' },
    );
    expect(screen.getByTestId('first-name')).toHaveTextContent('(nobody)');
    await user.click(skipButton() as HTMLElement);
    await screen.findByRole('heading', { name: 'home page (signed in)' });
    // The server gives the guest an empty first name; the profile the pages see says "Guest".
    expect(guestAnswer.user.firstName).toBe('');
    expect(screen.getByTestId('first-name')).toHaveTextContent(en('mobile.guest.name'));
    expect(T.greetingShort(screen.getByTestId('first-name').textContent ?? '')).toBe(en('shell.greetingShort', { firstName: 'Guest' }));

    act(() => setCurrentLocale('he'));
    expect(screen.getByTestId('first-name')).toHaveTextContent(trWith('he')('mobile.guest.name'));
    act(() => setCurrentLocale('ja'));
    expect(screen.getByTestId('first-name')).toHaveTextContent(trWith('ja')('mobile.guest.name'));
  });

  it('a guest session restored after a reload gets the name too; a real account keeps its own', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'guest-token');
    vi.mocked(api.auth.me).mockResolvedValue({
      user: guestUser,
      session: { id: 's1', deviceName: 'Phone', createdAt: '', lastSeenAt: '', rememberMe: false, current: true, guest: true },
    });
    const first = renderWithProviders(
      <AppShell>
        <AppRoutes />
        <FirstNameProbe />
      </AppShell>,
      { auth: 'real', route: '/', locale: 'en' },
    );
    await screen.findByRole('heading', { name: 'home page (signed in)' });
    expect(screen.getByTestId('first-name')).toHaveTextContent(en('mobile.guest.name'));
    first.unmount();

    sessionStorage.setItem(TOKEN_KEY, 'real-token');
    vi.mocked(api.auth.me).mockResolvedValue({
      user: sampleUser,
      session: { id: 's2', deviceName: 'Phone', createdAt: '', lastSeenAt: '', rememberMe: false, current: true },
    });
    renderWithProviders(
      <AppShell>
        <AppRoutes />
        <FirstNameProbe />
      </AppShell>,
      { auth: 'real', route: '/', locale: 'en' },
    );
    await screen.findByRole('heading', { name: 'home page (signed in)' });
    expect(screen.getByTestId('first-name')).toHaveTextContent(sampleUser.firstName);
  });

  it('"Create an account" ends the guest (logout) and opens the registration page', async () => {
    vi.mocked(api.auth.register).mockClear();
    const { user } = renderApp('/');
    await user.click(skipButton() as HTMLElement);
    await user.click(await screen.findByRole('button', { name: en('mobile.guest.createAccount') }));

    expect(await screen.findByRole('heading', { level: 1, name: T.registerTitle })).toBeInTheDocument();
    expect(api.auth.logout).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.queryByText(en('mobile.guest.banner'))).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: en('shell.mainNavLabel') })).not.toBeInTheDocument();
    // The one registration form, with its privacy checkbox - unticked, the tour ticks nothing for the visitor
    // (docs/android-tasks/PRIVACY-CHECKBOX.md).
    expect(screen.getByRole('checkbox', { name: en('auth.privacyConsent', { policy: en('auth.privacyConsentLink') }) })).not.toBeChecked();
    expect(api.auth.register).not.toHaveBeenCalled();
  });

  it('"Create an account" shows no "logged out" toast (the visitor never signed in); "End the tour" says the tour has ended', async () => {
    // The whole App: it is App that turns the auth notice into a toast.
    const { user } = renderWithProviders(<App />, { auth: 'real', route: '/', locale: 'en' });
    await user.click(skipButton() as HTMLElement);
    await user.click(await screen.findByRole('button', { name: en('mobile.guest.createAccount') }));
    expect(await screen.findByRole('heading', { level: 1, name: T.registerTitle })).toBeInTheDocument();
    // A toast is rendered on the next tick; give it the chance to appear before asserting its absence.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(screen.queryByText(T.loggedOut)).not.toBeInTheDocument();
    expect(screen.queryByText(en('mobile.guest.ended'))).not.toBeInTheDocument();

    // A second tour, ended from the "More" sheet.
    await user.click(screen.getByRole('button', { name: en('mobile.guest.skip') }));
    await screen.findByRole('heading', { name: 'home page (signed in)' });
    await user.click(within(screen.getByRole('navigation', { name: en('shell.mainNavLabel') })).getByRole('button', { name: en('mobile.nav.more') }));
    await user.click(within(screen.getByRole('dialog', { name: en('mobile.nav.more') })).getByRole('button', { name: en('mobile.guest.endTour') }));
    expect(await screen.findByRole('heading', { level: 1, name: T.welcomeTitle })).toBeInTheDocument();
    expect(await screen.findByText(en('mobile.guest.ended'))).toBeInTheDocument();
    expect(screen.queryByText(T.loggedOut)).not.toBeInTheDocument();
  });

  it('a reload ends the tour when the core forgot the guest (401): back to the welcome screen, no banner', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'guest-token');
    vi.mocked(api.auth.me).mockRejectedValue(new ApiClientError(401, { code: 'UNAUTHORIZED', message: 'gone' }));
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: T.welcomeTitle })).toBeInTheDocument();
    expect(screen.queryByText(en('mobile.guest.banner'))).not.toBeInTheDocument();
  });

  it('a guest session that is still alive after a reload keeps the banner', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'guest-token');
    vi.mocked(api.auth.me).mockResolvedValue({
      user: guestUser,
      session: { id: 's1', deviceName: 'Phone', createdAt: '', lastSeenAt: '', rememberMe: false, current: true, guest: true },
    });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'home page (signed in)' })).toBeInTheDocument();
    expect(screen.getByText(en('mobile.guest.banner'))).toBeInTheDocument();
  });

  it('hides the button when the server has no guest mode (404), on every screen, with a notice', async () => {
    guestMock().mockRejectedValue(new ApiClientError(404, { code: 'NOT_FOUND', message: 'Not found' }));
    const welcome = renderApp('/');
    await welcome.user.click(skipButton() as HTMLElement);

    await waitFor(() => expect(skipButton()).not.toBeInTheDocument());
    expect(await screen.findByText(en('mobile.guest.unavailable'))).toBeInTheDocument();
    // Still the welcome screen, signed out, with its two regular buttons.
    expect(screen.getByRole('heading', { level: 1, name: T.welcomeTitle })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: T.register })).toBeInTheDocument();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    welcome.unmount();

    renderApp('/login');
    expect(await screen.findByRole('heading', { level: 1, name: T.loginTitle })).toBeInTheDocument();
    expect(skipButton()).not.toBeInTheDocument();
  });

  it('another failure (the core is not ready) is shown under the button, which stays', async () => {
    guestMock().mockRejectedValue(new ApiClientError(503, { code: 'OTHER', message: 'The diary is still starting.' }));
    const { user } = renderApp('/');
    await user.click(skipButton() as HTMLElement);
    expect(await screen.findByText('The diary is still starting.')).toBeInTheDocument();
    expect(skipButton()).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: T.welcomeTitle })).toBeInTheDocument();
  });
});

describe('the Windows app and the web UI never offer it (owner decision 2026-10-23)', () => {
  beforeEach(() => {
    // No phone UI: the desktop / browser build (`__MOBILE__` is false there).
    vi.unstubAllGlobals();
  });

  /** Welcome, login and registration: each screen is there, the button on none, the guest route never called. */
  async function expectNoButtonOnTheThreeScreens(): Promise<void> {
    // The titles are read after the render: it switches the UI to English.
    for (const [route, title] of [
      ['/', () => T.welcomeTitle],
      ['/login', () => T.loginTitle],
      ['/register', () => T.registerTitle],
    ] as const) {
      const view = renderApp(route);
      expect(await screen.findByRole('heading', { level: 1, name: title() })).toBeInTheDocument();
      expect(skipButton()).not.toBeInTheDocument();
      expect(screen.queryByText(en('mobile.guest.skipHint'))).not.toBeInTheDocument();
      view.unmount();
    }
    expect(guestMock()).not.toHaveBeenCalled();
  }

  it('Windows app, the hosted server says guestTour: true: no button on the welcome, login and registration screens', async () => {
    setTauri(true);
    act(() => setServerInfo({ ...hostedInfo }));
    await expectNoButtonOnTheThreeScreens();
  });

  it('Windows app before the server described itself, or with a local server: no button either', async () => {
    setTauri(true);
    await expectNoButtonOnTheThreeScreens();
    act(() => setServerInfo({ ...localInfo }));
    await expectNoButtonOnTheThreeScreens();
  });

  it('web UI served by the hosted server (guestTour: true) in a phone-sized browser window: no button', async () => {
    phoneSizedBrowser();
    expect(window.innerWidth).toBe(375);
    expect(window.matchMedia('(max-width: 600px)').matches).toBe(true);
    act(() => setServerInfo({ ...hostedInfo }));
    await expectNoButtonOnTheThreeScreens();
  });

  it('web UI served by the hosted server (guestTour: true) in a desktop browser: no button', async () => {
    act(() => setServerInfo({ ...hostedInfo }));
    await expectNoButtonOnTheThreeScreens();
  });
});

describe('tourOffered (where the button is offered)', () => {
  it('never without the phone UI - the Windows app and the web UI - whatever the server says', () => {
    for (const info of [null, localInfo, hostedInfo, { ...hostedInfo, guestTour: false }]) {
      expect(tourOffered(info, false)).toBe(false);
    }
  });

  it('in the Android app: before the server answered, with a local core, and when the hosted server offers it', () => {
    expect(tourOffered(null, true)).toBe(true);
    expect(tourOffered(localInfo, true)).toBe(true);
    expect(tourOffered(hostedInfo, true)).toBe(true);
    // A hosted server that turned it off (or does not say it has it).
    expect(tourOffered({ ...hostedInfo, guestTour: false }, true)).toBe(false);
    expect(tourOffered({ ...hostedInfo, guestTour: undefined }, true)).toBe(false);
  });

  it('by default it follows the build: the mobile build (__MOBILE__) offers it, the desktop / browser build does not', () => {
    expect(tourOffered(hostedInfo)).toBe(true);
    vi.unstubAllGlobals();
    expect(tourOffered(hostedInfo)).toBe(false);
    expect(tourOffered(null)).toBe(false);
  });
});

describe('a guest in the app', () => {
  it('the settings page hides what a guest cannot use and offers to create an account', async () => {
    vi.mocked(api.server.info).mockResolvedValue({
      version: '0.1.0',
      port: 0,
      lanEnabled: false,
      lanUrls: [],
      dataDir: '/data',
      isLocalRequest: true,
      startedAt: '2026-10-02T08:00:00.000Z',
    });
    vi.mocked(api.server.getSettings).mockResolvedValue({ port: 0, lanEnabled: false, isRemoteOwner: false, isMailOwner: false, isLanOwner: false });
    vi.mocked(api.entries.list).mockResolvedValue({ items: [], total: 3, limit: 1, offset: 0 } as never);
    const logout = vi.fn().mockResolvedValue(undefined);
    const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated', user: guestUser, locale: 'en', authOverrides: { logout } });

    expect(screen.getByRole('heading', { level: 2, name: en('mobile.guest.settingsTitle') })).toBeInTheDocument();
    expect(screen.getByText(en('mobile.guest.settingsText'))).toBeInTheDocument();
    // What stays: language, display, privacy, reminders.
    expect(screen.getByRole('heading', { level: 2, name: en('settings.language.title') })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: ST.display })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: ST.reminders })).toBeInTheDocument();
    // What a guest cannot do is not offered.
    for (const title of [ST.account, ST.security, en('settings.deleteAccount.title'), en('settings.mail.title'), en('settings.remote.title')]) {
      expect(screen.queryByRole('heading', { level: 2, name: title })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: ST.changePassword })).not.toBeInTheDocument();
    // The owner cards are not even asked for.
    expect(api.server.mail.get).not.toHaveBeenCalled();
    expect(api.server.remote.get).not.toHaveBeenCalled();
    expect(api.auth.sessions).not.toHaveBeenCalled();

    // "Create an account" ends the guest without a toast (the registration page follows);
    // "End the tour" leaves the usual notice ("The tour has ended").
    await user.click(screen.getByRole('button', { name: en('mobile.guest.createAccount') }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(logout).toHaveBeenLastCalledWith({ notice: 'none' });
    await user.click(screen.getByRole('button', { name: en('mobile.guest.endTour') }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(2));
    expect(logout).toHaveBeenLastCalledWith({ notice: 'auto' });
  });

  it('phone app, real account: the remote-access card is not rendered; the account cards are', async () => {
    vi.mocked(api.server.info).mockResolvedValue({
      version: '0.1.0',
      port: 0,
      lanEnabled: false,
      lanUrls: [],
      dataDir: '/data',
      isLocalRequest: true,
      startedAt: '2026-10-02T08:00:00.000Z',
    });
    vi.mocked(api.server.getSettings).mockResolvedValue({ port: 0, lanEnabled: false, isRemoteOwner: true, isMailOwner: true, isLanOwner: true });
    vi.mocked(api.auth.sessions).mockResolvedValue([]);
    vi.mocked(api.entries.list).mockResolvedValue({ items: [], total: 3, limit: 1, offset: 0 } as never);
    renderWithProviders(<SettingsPage />, { auth: 'authenticated', user: sampleUser, locale: 'en' });

    expect(screen.getByRole('heading', { level: 2, name: ST.account })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: ST.security })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: en('settings.mail.title') })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: en('settings.deleteAccount.title') })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: en('mobile.guest.settingsTitle') })).not.toBeInTheDocument();
    // No remote access on a phone - not even a request for it.
    expect(screen.queryByRole('heading', { level: 2, name: en('settings.remote.title') })).not.toBeInTheDocument();
    expect(api.server.remote.get).not.toHaveBeenCalled();
  });

  it('control: a real account with a 1-minute auto-lock is locked by the same harness', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      sessionStorage.setItem(TOKEN_KEY, 'real-token');
      vi.mocked(api.auth.me).mockResolvedValue({
        user: sampleUser,
        session: { id: 's1', deviceName: 'Phone', createdAt: '', lastSeenAt: '', rememberMe: false, current: true },
      });
      vi.mocked(api.settings.get).mockResolvedValue({ ...(await api.settings.get()), autoLockMinutes: 1 });
      renderWithProviders(<App />, { auth: 'real', route: '/', locale: 'en' });
      expect(await screen.findByRole('heading', { name: 'home page (signed in)' })).toBeInTheDocument();
      expect(screen.queryByText(en('mobile.guest.banner'))).not.toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(3 * 60_000);
      await waitFor(() => expect(api.auth.lock).toHaveBeenCalled());
      expect(await screen.findByRole('dialog', { name: T.lockTitle })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('is never locked: no auto-lock timer and no Ctrl+L for a guest', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      sessionStorage.setItem(TOKEN_KEY, 'guest-token');
      vi.mocked(api.auth.me).mockResolvedValue({
        user: guestUser,
        session: { id: 's1', deviceName: 'Phone', createdAt: '', lastSeenAt: '', rememberMe: false, current: true, guest: true },
      });
      vi.mocked(api.settings.get).mockResolvedValue({ ...(await api.settings.get()), autoLockMinutes: 1 });
      renderWithProviders(<App />, { auth: 'real', route: '/', locale: 'en' });
      expect(await screen.findByRole('heading', { name: 'home page (signed in)' })).toBeInTheDocument();
      expect(screen.getByText(en('mobile.guest.banner'))).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'l', code: 'KeyL', ctrlKey: true });
      await vi.advanceTimersByTimeAsync(3 * 60_000);
      expect(api.auth.lock).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog', { name: T.lockTitle })).not.toBeInTheDocument();
      expect(within(screen.getByRole('main')).getByRole('heading', { name: 'home page (signed in)' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
