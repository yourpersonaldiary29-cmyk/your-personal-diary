import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Locale } from '@shared/i18n';
import { __resetLocaleForTests, getCurrentLocale, LANGUAGE_STORAGE_KEY, readUserLocale, SESSION_LANGUAGE_KEY, storeUserLocale } from '@/i18n/runtime';
import { fakeAuth, fakeSettings, politeRegion, sampleUser, type FakeAuthStatus } from '@/test/render';
import { AnnouncerProvider, useAnnouncer } from './AnnouncerContext';
import { AuthContext } from './AuthContext';
import { LanguageProvider, useLanguage, useLocale, useSetLocale, useT } from './LanguageContext';
import { SettingsContext, type SettingsContextValue } from './SettingsContext';

/** Shows the context and offers buttons that switch the language. */
function Probe() {
  const locale = useLocale();
  const t = useT();
  const setLocale = useSetLocale();
  const { dir } = useLanguage();
  const { announce } = useAnnouncer();
  return (
    <div>
      <p data-testid="locale">{locale}</p>
      <p data-testid="dir">{dir}</p>
      <p data-testid="title">{t('settings.language.title')}</p>
      <button type="button" onClick={() => void setLocale('he')}>
        he
      </button>
      <button type="button" onClick={() => void setLocale('de')}>
        de
      </button>
      <button type="button" onClick={() => announce('There are 3 errors in the form.', 'assertive')}>
        error
      </button>
    </div>
  );
}

function renderProbe(status: FakeAuthStatus, settings: SettingsContextValue = fakeSettings()) {
  const user = userEvent.setup();
  const result = render(
    <AuthContext.Provider value={fakeAuth(status)}>
      <SettingsContext.Provider value={settings}>
        <AnnouncerProvider>
          <LanguageProvider>
            <Probe />
          </LanguageProvider>
        </AnnouncerProvider>
      </SettingsContext.Provider>
    </AuthContext.Provider>,
  );
  return { ...result, user, settings };
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetLocaleForTests();
  });

  afterEach(() => {
    window.localStorage.clear();
    __resetLocaleForTests();
    document.documentElement.lang = '';
    document.documentElement.dir = '';
    document.title = '';
  });

  it('defaults to English and applies lang / dir / title to the document', () => {
    renderProbe('anonymous');
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
    expect(screen.getByTestId('dir')).toHaveTextContent('ltr');
    expect(screen.getByTestId('title')).toHaveTextContent('Language');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.title).toBe('Your Personal Diary');
  });

  it('switches to Hebrew: rtl, lang=he, stored on the device, announced in Hebrew, no account save when anonymous', async () => {
    const { user, settings } = renderProbe('anonymous');
    await user.click(screen.getByRole('button', { name: 'he' }));
    expect(screen.getByTestId('locale')).toHaveTextContent('he');
    expect(screen.getByTestId('dir')).toHaveTextContent('rtl');
    expect(screen.getByTestId('title')).toHaveTextContent('שפה');
    expect(document.documentElement.lang).toBe('he');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.title).toBe('Your Personal Diary');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('he');
    expect(getCurrentLocale()).toBe('he');
    await waitFor(() => expect(politeRegion()).toHaveTextContent('השפה עודכנה: עברית'));
    expect(settings.update).not.toHaveBeenCalled();
  });

  it('a language change drops a message left in a live region in the old language', async () => {
    const { user } = renderProbe('anonymous');
    await user.click(screen.getByRole('button', { name: 'error' }));
    await waitFor(() => expect(screen.getByTestId('live-region-assertive')).toHaveTextContent('There are 3 errors in the form.'));
    await user.click(screen.getByRole('button', { name: 'he' }));
    expect(screen.getByTestId('live-region-assertive')).toBeEmptyDOMElement();
    await waitFor(() => expect(politeRegion()).toHaveTextContent('השפה עודכנה: עברית'));
  });

  it('saves the language to the account when authenticated', async () => {
    const { user, settings } = renderProbe('authenticated');
    await user.click(screen.getByRole('button', { name: 'de' }));
    expect(settings.update).toHaveBeenCalledTimes(1);
    expect(settings.update).toHaveBeenCalledWith({ language: 'de' });
    expect(document.documentElement.lang).toBe('de');
    expect(document.documentElement.dir).toBe('ltr');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('de');
    // Announced in the new language.
    await waitFor(() => expect(politeRegion()).toHaveTextContent('Sprache geändert: Deutsch'));
  });

  it("adopts the account's language once the settings are loaded", () => {
    const settings = fakeSettings({ language: 'he' as Locale });
    renderProbe('authenticated', settings);
    expect(screen.getByTestId('locale')).toHaveTextContent('he');
    expect(document.documentElement.dir).toBe('rtl');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('he');
    expect(settings.update).not.toHaveBeenCalled();
  });

  it('adopts the account language silently (only a change the user made is announced) and remembers it for the account', async () => {
    const settings = fakeSettings({ language: 'he' as Locale });
    renderProbe('authenticated', settings);
    expect(screen.getByTestId('locale')).toHaveTextContent('he');
    expect(readUserLocale(sampleUser.id)).toBe('he');
    await new Promise((r) => setTimeout(r, 120));
    expect(politeRegion()).toHaveTextContent('');
  });

  it("uses the account's remembered language before its settings arrive, so the page is not rebuilt later", () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    __resetLocaleForTests();
    storeUserLocale(sampleUser.id, 'he');
    const settings = { ...fakeSettings({ language: 'he' as Locale }), loaded: false };
    renderProbe('authenticated', settings);
    expect(screen.getByTestId('locale')).toHaveTextContent('he');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('keeps the device choice while the account settings are not loaded yet', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    __resetLocaleForTests();
    const settings = { ...fakeSettings({ language: 'he' as Locale }), loaded: false };
    renderProbe('authenticated', settings);
    expect(screen.getByTestId('locale')).toHaveTextContent('fr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('does not clobber a page title that is not the bare app name', async () => {
    const { user } = renderProbe('anonymous');
    act(() => {
      document.title = 'הגדרות - Your Personal Diary';
    });
    await user.click(screen.getByRole('button', { name: 'he' }));
    expect(document.title).toBe('הגדרות - Your Personal Diary');
  });

  it('hooks work without the provider by falling back to the runtime', async () => {
    const user = userEvent.setup();
    render(<Probe />);
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
    await user.click(screen.getByRole('button', { name: 'he' }));
    expect(screen.getByTestId('locale')).toHaveTextContent('he');
    expect(getCurrentLocale()).toBe('he');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('he');
  });
});

/**
 * The Android app keeps the account's language apart from the device choice ('mpd.language.session',
 * docs/android-tasks/ANDROID-SYSTEM-LANGUAGE.md item 4): the tests above, without the phone globals,
 * are the Windows app / web UI, where the account's language is mirrored into 'mpd.language'.
 */
describe('LanguageProvider in the Android app', () => {
  function androidApp(): void {
    vi.stubGlobal('__MOBILE__', true);
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, getPlatform: () => 'android' });
  }

  function tree(status: FakeAuthStatus, settings: SettingsContextValue) {
    return (
      <AuthContext.Provider value={fakeAuth(status)}>
        <SettingsContext.Provider value={settings}>
          <AnnouncerProvider>
            <LanguageProvider>
              <Probe />
            </LanguageProvider>
          </AnnouncerProvider>
        </SettingsContext.Provider>
      </AuthContext.Provider>
    );
  }

  beforeEach(() => {
    window.localStorage.clear();
    androidApp();
    // A Hebrew phone.
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['he-IL', 'en-US']);
    __resetLocaleForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    __resetLocaleForTests();
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  it("keeps the account's language for the session, not as the device choice, and lets it go when the device signs out", () => {
    expect(getCurrentLocale()).toBe('he');
    const settings = fakeSettings({ language: 'de' as Locale });
    const { rerender } = render(tree('authenticated', settings));
    expect(screen.getByTestId('locale')).toHaveTextContent('de');
    expect(document.documentElement.dir).toBe('ltr');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(SESSION_LANGUAGE_KEY)).toBe('de');
    expect(readUserLocale(sampleUser.id)).toBe('de');

    // The user signs out (the same tree, the auth status flips): the phone language is back with its
    // direction, in the same commit, and nothing of the session's language stays on the device.
    rerender(tree('anonymous', settings));
    expect(screen.getByTestId('locale')).toHaveTextContent('he');
    expect(getCurrentLocale()).toBe('he');
    expect(document.documentElement.lang).toBe('he');
    expect(document.documentElement.dir).toBe('rtl');
    expect(window.localStorage.getItem(SESSION_LANGUAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
    // The account's own memory on this device stays: it serves the next sign-in of that account.
    expect(readUserLocale(sampleUser.id)).toBe('de');
    expect(settings.update).not.toHaveBeenCalled();
  });

  it('a language the user chose while signed in is the device choice and stays after the sign-out', async () => {
    const settings = fakeSettings({ language: 'de' as Locale });
    const { rerender } = render(tree('authenticated', settings));
    expect(screen.getByTestId('locale')).toHaveTextContent('de');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'he' }));
    expect(screen.getByTestId('locale')).toHaveTextContent('he');
    expect(settings.update).toHaveBeenCalledWith({ language: 'he' });
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('he');

    rerender(tree('anonymous', settings));
    expect(screen.getByTestId('locale')).toHaveTextContent('he');
    expect(window.localStorage.getItem(SESSION_LANGUAGE_KEY)).toBeNull();
    // Next start, the phone switched to Arabic: the choice sticks.
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['ar-EG', 'en-US']);
    __resetLocaleForTests();
    expect(getCurrentLocale()).toBe('he');
  });
});
