/**
 * The language the app starts in, per platform - with NO first-run language screen anywhere (owner
 * decisions 2026-10-23, docs/android-tasks/HOSTED-IMPL.md items 12-13, ANDROID-SYSTEM-LANGUAGE.md):
 *
 *  - Android app: the phone's system language (navigator.languages of the Capacitor WebView, the
 *    phone's language list in order) when it is one of the app's 20, otherwise English. A language
 *    chosen in Settings -> Language sticks; nothing detected is stored, so while nothing was chosen
 *    a later change of the phone's language is followed at the next start. Hebrew and Arabic phones
 *    get <html dir="rtl"> with the very first screen.
 *  - Windows app: the NSIS installer's language (install-locale); the Microsoft Store / MSIX build
 *    (no installer language) opens in English, whatever Windows (WebView2) reports.
 *  - Web UI served by the diary server: the browser's languages, English fallback (unchanged).
 *
 * In every case a signed-in account's own language wins. How a single tag is read (pt-BR, iw,
 * zh-TW, "_" separators...) is covered by shared/i18n/i18n.test.ts.
 */
import { Fragment, useLayoutEffect, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import type { Locale } from '@shared/i18n';
import type { ServerInfo } from '@shared/types';
import { __resetConnectionForTests, __setApiBaseForTests, auth as authApi, setServerInfo } from '@/api';
import { AppShell } from '@/components/layout/AppShell';
import { T } from '@/constants/texts';
import { LanguageProvider, useLocale } from '@/context/LanguageContext';
import { LanguageSection } from '@/pages/settings/LanguageSection';
import { AppRoutes } from '@/router';
import { renderWithProviders, type ProviderOptions } from '@/test/render';
import { applyInstallLocale, initInstallLocale } from './install-locale';
import { LANGUAGE_STORAGE_KEY, SESSION_LANGUAGE_KEY, __resetLocaleForTests, getCurrentLocale, getInstallLocale, subscribe, trWith } from './runtime';

// The home page belongs to another package; these tests only need to recognise it.
vi.mock('@/pages/HomePage', () => ({ default: () => <h1>home page (signed in)</h1> }));

/** localStorage key of the removed first-run language screen: nothing writes it any more. */
const OLD_FIRST_RUN_KEY = 'mpd.firstRunDone';

const en = trWith('en');
const he = trWith('he');

/** The installed Android app: the phone build (`__MOBILE__`) inside the Capacitor WebView. */
function androidApp(): void {
  vi.stubGlobal('__MOBILE__', true);
  vi.stubGlobal('Capacitor', { isNativePlatform: () => true, getPlatform: () => 'android' });
}

/** The Windows app: the Tauri shell's global is there (src/api/client.ts `isTauri`). */
function setTauri(on: boolean): void {
  const w = window as unknown as Record<string, unknown>;
  if (on) w.__TAURI_INTERNALS__ = {};
  else delete w.__TAURI_INTERNALS__;
}

/** What navigator.languages reports: the phone's system languages (Android), Windows' (WebView2) or the browser's. */
function systemLanguages(languages: string[]): void {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages);
}

/**
 * A start of the app with this language list, as main.tsx does it: src/i18n/runtime.ts decides the
 * language while it loads (`__resetLocaleForTests` re-runs that), then the installer step - which
 * finds no installer outside the Windows app - runs before the first render.
 */
async function startApp(languages: string[]): Promise<Locale> {
  systemLanguages(languages);
  __resetLocaleForTests();
  return initInstallLocale();
}

/** What App.tsx does: the page is rebuilt (re-keyed) whenever the locale changes, so every `T.*` getter is evaluated again. */
function LocaleRekey({ children }: { children: ReactNode }) {
  const locale = useLocale();
  return <Fragment key={locale}>{children}</Fragment>;
}

/** The phone app as main.tsx / App.tsx mount it: the language provider around the re-keyed phone shell and the routes. */
function renderPhoneApp(options: ProviderOptions = {}) {
  return renderWithProviders(
    <LanguageProvider>
      <LocaleRekey>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </LocaleRekey>
    </LanguageProvider>,
    { auth: 'anonymous', route: '/', ...options },
  );
}

/** The routes with the real language provider, without the phone UI (Windows app, web UI). */
function renderWithoutPhoneUi(options: ProviderOptions = {}) {
  return renderWithProviders(
    <LanguageProvider>
      <AppRoutes />
    </LanguageProvider>,
    { auth: 'anonymous', route: '/', ...options },
  );
}

/** No language screen, and nothing of the old one written on this device. */
function expectNoLanguageScreen(): void {
  expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  expect(localStorage.getItem(OLD_FIRST_RUN_KEY)).toBeNull();
}

/** What the hosted Your Personal Diary server says about itself (the web UI is served by it). */
const hostedInfo: ServerInfo = {
  version: '0.1.0',
  port: 8080,
  lanEnabled: false,
  lanUrls: [],
  dataDir: '',
  isLocalRequest: false,
  startedAt: '2026-10-20T08:00:00.000Z',
  mode: 'hosted',
  publicUrl: 'https://diary.example.org',
  storageOk: true,
  registration: 'open',
  guestTour: true,
};

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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setTauri(false);
  __setApiBaseForTests(null);
  __resetConnectionForTests();
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
});

describe('Android app: the phone system language, English fallback', () => {
  it('opens straight on the welcome page in the phone language: no language screen, nothing stored, the Skip tour still offered', async () => {
    androidApp();
    expect(await startApp(['he-IL', 'en-US'])).toBe('he');
    // The phone's AuthProvider offers the tour (`startGuest`).
    renderPhoneApp({ authOverrides: { startGuest: vi.fn() } });

    expect(screen.getByRole('heading', { level: 1, name: he('shell.welcome.title') })).toBeInTheDocument();
    expectNoLanguageScreen();
    expect(document.documentElement).toHaveAttribute('lang', 'he');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    // The tour stays an Android-app feature (HOSTED-IMPL.md item 12).
    expect(screen.getByRole('button', { name: he('mobile.guest.skip') })).toBeInTheDocument();
    // Detected, not chosen: the device language stays unset.
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  it('the login and registration screens are in the phone language too', async () => {
    androidApp();
    await startApp(['fr-CA', 'en-US']);
    const login = renderPhoneApp({ route: '/login' });
    expect(screen.getByRole('heading', { level: 1, name: trWith('fr')('auth.loginTitle') })).toBeInTheDocument();
    expectNoLanguageScreen();
    login.unmount();

    renderPhoneApp({ route: '/register' });
    expect(screen.getByRole('heading', { level: 1, name: trWith('fr')('auth.registerTitle') })).toBeInTheDocument();
    expectNoLanguageScreen();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  it('a phone language the app does not have: English (also when the WebView appended its en-US)', async () => {
    androidApp();
    expect(await startApp(['sw-KE'])).toBe('en');
    expect(await startApp(['sw-KE', 'en-US'])).toBe('en');
    renderPhoneApp();
    expect(screen.getByRole('heading', { level: 1, name: en('shell.welcome.title') })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expectNoLanguageScreen();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  it('reads the tags an Android phone reports: the first language of the list the app has wins', async () => {
    androidApp();
    const cases: Array<[string[], Locale]> = [
      [['pt-BR', 'en-US'], 'pt'],
      [['pt-PT'], 'pt'],
      [['es-419', 'en-US'], 'es'],
      [['es-MX'], 'es'],
      [['de-AT', 'en-US'], 'de'],
      [['en-GB', 'he-IL'], 'en'],
      [['ar-EG', 'en-US'], 'ar'],
      [['zh-CN', 'en-US'], 'zh'],
      // Traditional Chinese gets the app's (Simplified) Chinese, not English.
      [['zh-TW', 'en-US'], 'zh'],
      [['zh-Hant-TW'], 'zh'],
      // Legacy codes: Hebrew as "iw"; Indonesian ("in") is not an app language - the next one counts.
      [['iw-IL', 'en-US'], 'he'],
      [['in-ID', 'it-IT', 'en-US'], 'it'],
      [['in_ID'], 'en'],
      [['sw-KE', 'ru-RU', 'en-US'], 'ru'],
      [['PT_br'], 'pt'],
    ];
    for (const [languages, locale] of cases) {
      expect(await startApp(languages), languages.join(',')).toBe(locale);
      expect(getCurrentLocale()).toBe(locale);
    }
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  it.each([
    ['Hebrew', ['he-IL', 'en-US'], 'he'],
    ['Arabic', ['ar-EG', 'en-US'], 'ar'],
  ] as const)('%s phone: right-to-left with the very first screen - no left-to-right frame', async (_name, languages, code) => {
    androidApp();
    // Decided before anything renders (synchronously, while the runtime loads): no later switch.
    expect(await startApp([...languages])).toBe(code);
    // The page as mobile/index.html ships it.
    document.documentElement.setAttribute('lang', 'en');
    document.documentElement.setAttribute('dir', 'ltr');
    const dirMutations = new MutationObserver(() => {});
    dirMutations.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'], attributeOldValue: true });
    const switches: Locale[] = [];
    const unsubscribe = subscribe((locale) => switches.push(locale));

    // What the first frame shows = the DOM when the first commit has run all its layout effects
    // (the browser cannot paint in between). A layout effect of a LATER sibling of the
    // LanguageProvider runs after the provider's own, still before that paint.
    const firstCommit: Array<{ dir: string | null; lang: string | null; heading: string | null }> = [];
    function FirstFrameProbe() {
      useLayoutEffect(() => {
        firstCommit.push({
          dir: document.documentElement.getAttribute('dir'),
          lang: document.documentElement.getAttribute('lang'),
          heading: document.querySelector('h1')?.textContent ?? null,
        });
      }, []);
      return null;
    }
    renderWithProviders(
      <>
        <LanguageProvider>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </LanguageProvider>
        <FirstFrameProbe />
      </>,
      { auth: 'anonymous', route: '/' },
    );

    expect(firstCommit).toEqual([{ dir: 'rtl', lang: code, heading: trWith(code)('shell.welcome.title') }]);
    // <html dir> went from the shipped "ltr" straight to "rtl" and was never set back.
    const records = dirMutations.takeRecords();
    dirMutations.disconnect();
    expect(records.length).toBeGreaterThan(0);
    expect(records[0].oldValue).toBe('ltr');
    const valuesSet = records.map((_r, i) => records[i + 1]?.oldValue ?? document.documentElement.getAttribute('dir'));
    expect(valuesSet.every((value) => value === 'rtl')).toBe(true);
    // The language never changed during start-up (a change would rebuild the screen).
    expect(switches).toEqual([]);
    unsubscribe();
  });

  it('nothing chosen: a later change of the phone language is followed at the next start', async () => {
    androidApp();
    await startApp(['he-IL', 'en-US']);
    const first = renderPhoneApp();
    expect(screen.getByRole('heading', { level: 1, name: he('shell.welcome.title') })).toBeInTheDocument();
    first.unmount();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();

    // The owner switches the phone to German and starts the app again.
    expect(await startApp(['de-DE', 'en-US'])).toBe('de');
    renderPhoneApp();
    expect(screen.getByRole('heading', { level: 1, name: trWith('de')('shell.welcome.title') })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });

  it('a language chosen in Settings -> Language sticks: the phone language no longer matters', async () => {
    androidApp();
    await startApp(['he-IL', 'en-US']);
    const { user, unmount } = renderWithProviders(
      <LanguageProvider>
        <LanguageSection />
      </LanguageProvider>,
      { auth: 'anonymous' },
    );
    await user.selectOptions(screen.getByRole('combobox', { name: he('settings.language.label') }), 'it');
    await waitFor(() => expect(getCurrentLocale()).toBe('it'));
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('it');
    unmount();

    // Next start, the phone now in French: the choice stays.
    expect(await startApp(['fr-FR', 'en-US'])).toBe('it');
    renderPhoneApp();
    expect(screen.getByRole('heading', { level: 1, name: trWith('it')('shell.welcome.title') })).toBeInTheDocument();
  });

  it('a device that already stored a language (e.g. with the old first-run screen) keeps it', async () => {
    androidApp();
    // What the removed screen left behind: the language and its "passed" flag (harmless, unread).
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');
    localStorage.setItem(OLD_FIRST_RUN_KEY, '1');
    expect(await startApp(['he-IL', 'en-US'])).toBe('es');
    renderPhoneApp();
    expect(screen.getByRole('heading', { level: 1, name: trWith('es')('shell.welcome.title') })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('es');
    expect(localStorage.getItem(OLD_FIRST_RUN_KEY)).toBe('1');
  });

  it("signed in: the account's language wins over the device choice and the phone language, and is kept for the session - apart from the device choice", async () => {
    androidApp();
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    await startApp(['he-IL', 'en-US']);
    renderPhoneApp({ auth: 'authenticated', settings: { language: 'ja' } });
    expect(await screen.findByRole('heading', { level: 1, name: 'home page (signed in)' })).toBeInTheDocument();
    await waitFor(() => expect(getCurrentLocale()).toBe('ja'));
    expect(document.documentElement).toHaveAttribute('lang', 'ja');
    // The language chosen on this device is not overwritten by the account's; that one is kept for
    // the session, so a remembered session starts in it next time without switching languages on
    // screen - and it goes with the session (next tests).
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('de');
    expect(localStorage.getItem(SESSION_LANGUAGE_KEY)).toBe('ja');

    // The next start with the remembered session, the account not known yet: Japanese at once.
    expect(await startApp(['he-IL', 'en-US'])).toBe('ja');
    expect(getCurrentLocale()).toBe('ja');
  });

  it("an account in another language than the phone's: nothing chosen on this device, so after signing out the phone language is followed again", async () => {
    androidApp();
    await startApp(['he-IL', 'en-US']);
    // The account was registered elsewhere, in German.
    const signedIn = renderPhoneApp({ auth: 'authenticated', settings: { language: 'de' } });
    expect(await screen.findByRole('heading', { level: 1, name: 'home page (signed in)' })).toBeInTheDocument();
    await waitFor(() => expect(getCurrentLocale()).toBe('de'));
    // Not a choice of the user: the device language stays unset; the session's language is kept apart.
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_LANGUAGE_KEY)).toBe('de');
    signedIn.unmount();

    // Signed out: the session's language goes with the session - the welcome page is in the phone
    // language again, right-to-left, and nothing of the account's language is left on the device.
    renderPhoneApp({ auth: 'anonymous' });
    expect(screen.getByRole('heading', { level: 1, name: he('shell.welcome.title') })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'he');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(getCurrentLocale()).toBe('he');
    expect(localStorage.getItem(SESSION_LANGUAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();

    // The owner switches the phone to Arabic and starts the app again: followed.
    expect(await startApp(['ar-EG', 'en-US'])).toBe('ar');
  });

  it('an account in the phone language: the device language stays unset, and after signing out the phone language is still followed', async () => {
    androidApp();
    await startApp(['he-IL', 'en-US']);
    // Registered on this phone: the account started in the language on screen (see the registration test).
    const signedIn = renderPhoneApp({ auth: 'authenticated', settings: { language: 'he' } });
    expect(await screen.findByRole('heading', { level: 1, name: 'home page (signed in)' })).toBeInTheDocument();
    expect(getCurrentLocale()).toBe('he');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_LANGUAGE_KEY)).toBe('he');
    signedIn.unmount();

    renderPhoneApp({ auth: 'anonymous' });
    expect(screen.getByRole('heading', { level: 1, name: he('shell.welcome.title') })).toBeInTheDocument();
    expect(localStorage.getItem(SESSION_LANGUAGE_KEY)).toBeNull();
    expect(await startApp(['ar-EG', 'en-US'])).toBe('ar');
  });

  it('a session that was not remembered (the app was closed during it): its language is forgotten at the next start, with the first screen', async () => {
    androidApp();
    // What the last run left behind: the session's language, but no token (sessionStorage went with the app).
    localStorage.setItem(SESSION_LANGUAGE_KEY, 'de');
    // While the runtime loads, the device still goes by the session it knew.
    expect(await startApp(['he-IL', 'en-US'])).toBe('de');
    renderPhoneApp({ auth: 'anonymous' });
    // No session: the first signed-out screen is in the phone language (switched in a layout effect, before any paint).
    expect(screen.getByRole('heading', { level: 1, name: he('shell.welcome.title') })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'he');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(getCurrentLocale()).toBe('he');
    expect(localStorage.getItem(SESSION_LANGUAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  it('registration on the phone: the new account starts in the language on screen - the phone language, sent with the request', async () => {
    androidApp();
    await startApp(['pt-BR', 'en-US']);
    __setApiBaseForTests('');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: { get: () => null },
      text: async () => '{}',
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await authApi.register({
      firstName: 'Dana',
      lastName: 'Levi',
      username: 'dana',
      email: 'dana@example.com',
      password: 'fictional-password-1',
      confirmPassword: 'fictional-password-1',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toContain('/api/auth/register');
    // The server gives a new account the language of this header (server/src/routes/auth.ts).
    expect(init.headers['Accept-Language']).toBe('pt');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });
});

describe('Windows app: the installer language, else English (never the Windows display language)', () => {
  it('Microsoft Store (MSIX: no installer language, nothing stored): the welcome page in English, even on a Hebrew Windows', () => {
    setTauri(true);
    // A Hebrew Windows: WebView2 reports Hebrew first, but the Windows app does not consult it.
    systemLanguages(['he-IL', 'en-US']);
    __resetLocaleForTests();
    // What main.tsx does at start-up: the MSIX build has no install-locale.txt.
    applyInstallLocale(null);
    expect(getInstallLocale()).toBeNull();

    renderWithoutPhoneUi();
    expect(screen.getByRole('heading', { level: 1, name: en('shell.welcome.title') })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: he('shell.welcome.title') })).not.toBeInTheDocument();
    expectNoLanguageScreen();
    expect(getCurrentLocale()).toBe('en');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    // Nothing was chosen for the user: the device language stays unset until Settings -> Language.
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  it('Microsoft Store, an unsupported Windows language: English as well', () => {
    setTauri(true);
    systemLanguages(['sw-KE']);
    __resetLocaleForTests();
    applyInstallLocale(null);
    renderWithoutPhoneUi({ route: '/login' });
    expect(screen.getByRole('heading', { level: 1, name: en('auth.loginTitle') })).toBeInTheDocument();
    expectNoLanguageScreen();
    expect(getCurrentLocale()).toBe('en');
  });

  it("NSIS installer: the installer's language (install-locale) wins over Windows' language", () => {
    setTauri(true);
    // Windows itself speaks German; the installer's choice wins.
    systemLanguages(['de-DE', 'en-US']);
    __resetLocaleForTests();
    // What main.tsx does with install-locale.txt before the first render.
    applyInstallLocale('fr');
    expect(getInstallLocale()).toBe('fr');

    renderWithoutPhoneUi();
    expect(screen.getByRole('heading', { level: 1, name: trWith('fr')('shell.welcome.title') })).toBeInTheDocument();
    expectNoLanguageScreen();
    // The installer's language is kept.
    expect(getCurrentLocale()).toBe('fr');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('fr');
  });

  it('a Windows app that already has a language (an earlier run or Settings -> Language) keeps it', () => {
    setTauri(true);
    systemLanguages(['he-IL', 'en-US']);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    __resetLocaleForTests();
    applyInstallLocale(null);
    renderWithoutPhoneUi();
    expect(screen.getByRole('heading', { level: 1, name: trWith('de')('shell.welcome.title') })).toBeInTheDocument();
    expectNoLanguageScreen();
  });

  it("a signed-in account's language is mirrored into the device language, as before (the Android session key is not used here)", async () => {
    setTauri(true);
    systemLanguages(['he-IL', 'en-US']);
    __resetLocaleForTests();
    applyInstallLocale(null);
    renderWithoutPhoneUi({ auth: 'authenticated', settings: { language: 'de' } });
    expect(await screen.findByRole('heading', { name: 'home page (signed in)' })).toBeInTheDocument();
    await waitFor(() => expect(getCurrentLocale()).toBe('de'));
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('de');
    expect(localStorage.getItem(SESSION_LANGUAGE_KEY)).toBeNull();
  });

  it('a Windows app with a session (being checked, or signed in): the app as always', async () => {
    setTauri(true);
    systemLanguages(['en-US']);
    __resetLocaleForTests();
    const loading = renderWithoutPhoneUi({ auth: 'loading' });
    expect(screen.getByText(T.loadingSession)).toBeInTheDocument();
    expectNoLanguageScreen();
    loading.unmount();

    renderWithoutPhoneUi({ auth: 'authenticated' });
    expect(await screen.findByRole('heading', { name: 'home page (signed in)' })).toBeInTheDocument();
    expectNoLanguageScreen();
  });
});

describe('web UI served by the diary server: the browser languages, English fallback (unchanged)', () => {
  it('a phone-sized browser speaking Hebrew: Hebrew pages, no language screen', () => {
    phoneSizedBrowser();
    systemLanguages(['he-IL', 'en-US']);
    __resetLocaleForTests();
    act(() => setServerInfo({ ...hostedInfo }));
    expect(window.innerWidth).toBe(375);
    expect(window.matchMedia('(max-width: 600px)').matches).toBe(true);

    const welcome = renderWithoutPhoneUi();
    expect(screen.getByRole('heading', { level: 1, name: he('shell.welcome.title') })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expectNoLanguageScreen();
    welcome.unmount();

    renderWithoutPhoneUi({ route: '/register' });
    expect(screen.getByRole('heading', { level: 1, name: he('auth.registerTitle') })).toBeInTheDocument();
    expectNoLanguageScreen();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  it("a signed-in account's language is mirrored into the device language, as before (the Android session key is not used here)", async () => {
    act(() => setServerInfo({ ...hostedInfo }));
    systemLanguages(['he-IL', 'en-US']);
    __resetLocaleForTests();
    renderWithoutPhoneUi({ auth: 'authenticated', settings: { language: 'de' } });
    expect(await screen.findByRole('heading', { name: 'home page (signed in)' })).toBeInTheDocument();
    await waitFor(() => expect(getCurrentLocale()).toBe('de'));
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('de');
    expect(localStorage.getItem(SESSION_LANGUAGE_KEY)).toBeNull();
  });

  it('a desktop browser: its languages in order, English when it speaks none of the 20, nothing stored', () => {
    act(() => setServerInfo({ ...hostedInfo }));
    systemLanguages(['pt-BR', 'en-US']);
    __resetLocaleForTests();
    expect(getCurrentLocale()).toBe('pt');
    systemLanguages(['zh-TW', 'en-US']);
    __resetLocaleForTests();
    expect(getCurrentLocale()).toBe('zh');
    systemLanguages(['sw-KE']);
    __resetLocaleForTests();
    expect(getCurrentLocale()).toBe('en');

    systemLanguages(['en-US']);
    __resetLocaleForTests();
    renderWithoutPhoneUi();
    expect(screen.getByRole('heading', { level: 1, name: T.welcomeTitle })).toBeInTheDocument();
    expect(T.welcomeTitle).toBe(en('shell.welcome.title'));
    expectNoLanguageScreen();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });
});
