import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetLocaleForTests,
  clearSessionLocale,
  detectLocale,
  dir,
  getCurrentLocale,
  intlTag,
  LANGUAGE_STORAGE_KEY,
  readSessionLocale,
  readStoredLocale,
  resolveStartupLocale,
  SESSION_LANGUAGE_KEY,
  setCurrentLocale,
  storeLocale,
  storeSessionLocale,
  subscribe,
  tr,
  trWith,
} from './runtime';

describe('i18n runtime', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetLocaleForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    __resetLocaleForTests();
  });

  it('resolves the start-up language in order: account (session) > device choice > installer > system / browser > English', () => {
    expect(resolveStartupLocale({ account: 'ja', stored: 'de', install: 'fr', browser: ['he-IL'] })).toBe('ja');
    expect(resolveStartupLocale({ stored: 'de', install: 'fr', browser: ['he-IL'] })).toBe('de');
    expect(resolveStartupLocale({ install: 'fr', browser: ['he-IL'] })).toBe('fr');
    expect(resolveStartupLocale({ browser: ['he-IL'] })).toBe('he');
    expect(resolveStartupLocale({})).toBe('en');
  });

  it("the Android app starts in the language of the session kept on the device ('mpd.language.session'), ahead of the device choice; other builds never read it", () => {
    window.localStorage.setItem(SESSION_LANGUAGE_KEY, 'ja');
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['he-IL', 'en-US']);
    // A browser (the web UI): the key is not consulted.
    expect(detectLocale()).toBe('de');
    // The mobile build opened in a plain browser (development) is not the installed app either.
    vi.stubGlobal('__MOBILE__', true);
    expect(detectLocale()).toBe('de');
    // The installed Android app.
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, getPlatform: () => 'android' });
    expect(readSessionLocale()).toBe('ja');
    expect(detectLocale()).toBe('ja');
    // The session is gone: the device choice, else the phone's language.
    clearSessionLocale();
    expect(window.localStorage.getItem(SESSION_LANGUAGE_KEY)).toBeNull();
    expect(detectLocale()).toBe('de');
    window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    expect(detectLocale()).toBe('he');
    storeSessionLocale('fr');
    expect(window.localStorage.getItem(SESSION_LANGUAGE_KEY)).toBe('fr');
    expect(detectLocale()).toBe('fr');
    // An invalid value counts as none.
    window.localStorage.setItem(SESSION_LANGUAGE_KEY, 'xx');
    expect(readSessionLocale()).toBeNull();
    expect(detectLocale()).toBe('he');
  });

  it('defaults to English (jsdom reports English browser languages, nothing stored)', () => {
    expect(getCurrentLocale()).toBe('en');
    expect(dir()).toBe('ltr');
    expect(intlTag()).toBe('en-GB');
    expect(tr('shell.appName')).toBe('Your Personal Diary');
  });

  it('prefers the stored device choice over the browser languages', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'he');
    expect(readStoredLocale()).toBe('he');
    expect(detectLocale()).toBe('he');
    __resetLocaleForTests();
    expect(getCurrentLocale()).toBe('he');
    expect(dir()).toBe('rtl');
  });

  it('ignores an unsupported stored value and negotiates the browser languages', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'xx');
    expect(readStoredLocale()).toBeNull();
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['pt-BR', 'en-US']);
    expect(detectLocale()).toBe('pt');
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['xx-YY']);
    expect(detectLocale()).toBe('en');
  });

  it('switches the locale, notifies subscribers once per change and resolves unknown codes to English', () => {
    const seen: string[] = [];
    const unsubscribe = subscribe((locale) => seen.push(locale));
    setCurrentLocale('he');
    setCurrentLocale('he');
    expect(getCurrentLocale()).toBe('he');
    expect(tr('shell.appName')).toBe('Your Personal Diary');
    expect(tr('shell.errorStatus', { status: 500 })).toBe('שגיאה (500)');
    setCurrentLocale('zz' as never);
    expect(getCurrentLocale()).toBe('en');
    unsubscribe();
    setCurrentLocale('de');
    expect(seen).toEqual(['he', 'en']);
    expect(dir('ar')).toBe('rtl');
    expect(intlTag('de')).toBe('de-DE');
  });

  it('binds a translator to another locale without touching the current one', () => {
    setCurrentLocale('en');
    const he = trWith('he');
    expect(he('settings.language.title')).toBe('שפה');
    expect(tr('settings.language.title')).toBe('Language');
    // Every locale has its own catalogue; unknown keys fall back to the key.
    expect(trWith('de')('settings.language.title')).toBe('Sprache');
    expect(tr('shell.no.such.key')).toBe('shell.no.such.key');
  });

  it('stores the choice on the device without switching', () => {
    storeLocale('fr');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('fr');
    expect(getCurrentLocale()).toBe('en');
  });
});
