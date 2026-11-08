/**
 * The installer's language (desktop app): the resolution order of the start-up language, the
 * one-time apply to the device language after a (re)install in another language, the shell call,
 * and - read from disk - that the NSIS installer, the hooks and the Rust shell agree on the same
 * 20 languages as shared/i18n/locales.ts.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LOCALE_CODES, type Locale } from '@shared/i18n';
import { invoke } from '@tauri-apps/api/core';
import { AnnouncerProvider } from '@/context/AnnouncerContext';
import { AuthContext } from '@/context/AuthContext';
import { LanguageProvider, useLocale, useSetLocale } from '@/context/LanguageContext';
import { SettingsContext, type SettingsContextValue } from '@/context/SettingsContext';
import { fakeAuth, fakeSettings, type FakeAuthStatus } from '@/test/render';
import {
  __resetLocaleForTests,
  detectLocale,
  getCurrentLocale,
  getInstallLocale,
  LANGUAGE_STORAGE_KEY,
  resolveStartupLocale,
  setInstallLocale,
  storeLocale,
} from './runtime';
import {
  applyInstallLocale,
  clearPendingInstallLocale,
  fetchInstallLocale,
  initInstallLocale,
  INSTALL_LOCALE_APPLIED_KEY,
  INSTALL_LOCALE_PENDING_KEY,
  readAppliedInstallLocale,
  readPendingInstallLocale,
  takePendingInstallLocale,
} from './install-locale';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const invokeMock = vi.mocked(invoke);

function setTauri(on: boolean): void {
  const w = window as unknown as Record<string, unknown>;
  if (on) w.__TAURI_INTERNALS__ = {};
  else delete w.__TAURI_INTERNALS__;
}

function mockBrowserLanguages(list: string[]): void {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(list);
}

beforeEach(() => {
  window.localStorage.clear();
  __resetLocaleForTests();
  invokeMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  setTauri(false);
  window.localStorage.clear();
  __resetLocaleForTests();
});

describe('start-up language resolution order', () => {
  it('account > device language > install language > browser languages > English', () => {
    const browser = ['fr-FR', 'en-US'];
    expect(resolveStartupLocale({ account: 'de', stored: 'he', install: 'th', browser })).toBe('de');
    expect(resolveStartupLocale({ account: null, stored: 'he', install: 'th', browser })).toBe('he');
    expect(resolveStartupLocale({ stored: null, install: 'th', browser })).toBe('th');
    expect(resolveStartupLocale({ stored: null, install: null, browser })).toBe('fr');
    expect(resolveStartupLocale({ browser: ['xx-YY'] })).toBe('en');
    expect(resolveStartupLocale({})).toBe('en');
  });

  it('the device default puts the install language between the stored choice and the browser', () => {
    mockBrowserLanguages(['ja-JP']);
    expect(detectLocale()).toBe('ja');
    setInstallLocale('hi');
    expect(getInstallLocale()).toBe('hi');
    expect(detectLocale()).toBe('hi');
    storeLocale('ro');
    expect(detectLocale()).toBe('ro');
    setInstallLocale('klingon' as Locale);
    expect(getInstallLocale()).toBeNull();
  });

  it('the Windows app never takes the browser (WebView2) languages: installer language, else English - the MSIX build opens in English', () => {
    setTauri(true);
    // A Hebrew Windows: WebView2 reports the Windows display language first.
    mockBrowserLanguages(['he-IL', 'en-US']);
    expect(detectLocale()).toBe('en');
    // Start-up of the Microsoft Store / MSIX build: no install-locale.txt, nothing stored.
    expect(applyInstallLocale(null)).toBe('en');
    expect(getCurrentLocale()).toBe('en');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
    __resetLocaleForTests();
    expect(getCurrentLocale()).toBe('en');
    // The NSIS build: the installer's language wins over Windows' language.
    expect(applyInstallLocale('fr')).toBe('fr');
    // A language chosen in Settings -> Language wins over both.
    storeLocale('de');
    expect(detectLocale()).toBe('de');
  });

  it('outside the Windows app (web UI, Android app) the browser languages still count', () => {
    mockBrowserLanguages(['he-IL', 'en-US']);
    expect(detectLocale()).toBe('he');
    expect(applyInstallLocale(null)).toBe('he');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });
});

describe('applying the installer language once', () => {
  it('a fresh device adopts it as its device language and remembers that it applied it', () => {
    mockBrowserLanguages(['en-US']);
    expect(applyInstallLocale('he')).toBe('he');
    expect(getCurrentLocale()).toBe('he');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('he');
    expect(readAppliedInstallLocale()).toBe('he');
  });

  it('is not applied again: a language chosen later in Settings stays', () => {
    applyInstallLocale('he');
    storeLocale('de'); // the user switched in Settings -> Language
    expect(applyInstallLocale('he')).toBe('de');
    expect(getCurrentLocale()).toBe('de');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('de');
  });

  it('a reinstall in another language replaces the device language once', () => {
    applyInstallLocale('he');
    storeLocale('de');
    expect(applyInstallLocale('th')).toBe('th');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('th');
    expect(window.localStorage.getItem(INSTALL_LOCALE_APPLIED_KEY)).toBe('th');
    storeLocale('pl');
    expect(applyInstallLocale('th')).toBe('pl');
  });

  it('an existing device language is replaced the first time an installer language appears (upgrade from an older installer)', () => {
    storeLocale('fr');
    expect(applyInstallLocale('ar')).toBe('ar');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ar');
  });

  it('without an installer language (browser, phone, MSI, tauri dev) nothing is stored', () => {
    mockBrowserLanguages(['es-ES']);
    expect(applyInstallLocale(null)).toBe('es');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(INSTALL_LOCALE_APPLIED_KEY)).toBeNull();
    expect(applyInstallLocale('xx' as Locale)).toBe('es');
    expect(window.localStorage.getItem(INSTALL_LOCALE_APPLIED_KEY)).toBeNull();
  });

  it('stays pending for the first signed-out screen until it is taken once', () => {
    expect(readPendingInstallLocale()).toBeNull();
    applyInstallLocale('cs');
    expect(window.localStorage.getItem(INSTALL_LOCALE_PENDING_KEY)).toBe('cs');
    applyInstallLocale('cs'); // a later start with the same installer language does not re-arm it
    expect(takePendingInstallLocale()).toBe('cs');
    expect(takePendingInstallLocale()).toBeNull();
    applyInstallLocale('cs');
    expect(readPendingInstallLocale()).toBeNull();
    applyInstallLocale('bg'); // reinstalled in another language
    expect(readPendingInstallLocale()).toBe('bg');
    clearPendingInstallLocale(); // the user chose a language
    expect(readPendingInstallLocale()).toBeNull();
    window.localStorage.setItem(INSTALL_LOCALE_PENDING_KEY, 'xx');
    expect(takePendingInstallLocale()).toBeNull();
    expect(window.localStorage.getItem(INSTALL_LOCALE_PENDING_KEY)).toBeNull();
  });

  it('with the applied marker kept but the device language gone, the install language is still the default', () => {
    mockBrowserLanguages(['es-ES']);
    applyInstallLocale('hu');
    window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    expect(applyInstallLocale('hu')).toBe('hu');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });
});

describe('asking the desktop shell', () => {
  it('does not call the shell in a browser', async () => {
    expect(await fetchInstallLocale()).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('returns a supported code from get_install_locale and nothing else', async () => {
    setTauri(true);
    invokeMock.mockResolvedValueOnce('he');
    expect(await fetchInstallLocale()).toBe('he');
    expect(invokeMock).toHaveBeenCalledWith('get_install_locale');
    invokeMock.mockResolvedValueOnce(null);
    expect(await fetchInstallLocale()).toBeNull();
    invokeMock.mockResolvedValueOnce('pt-BR');
    expect(await fetchInstallLocale()).toBeNull();
    invokeMock.mockRejectedValueOnce(new Error('command get_install_locale not found'));
    expect(await fetchInstallLocale()).toBeNull();
  });

  it('does not hold the start-up when the shell does not answer', async () => {
    setTauri(true);
    invokeMock.mockReturnValueOnce(new Promise(() => {}));
    expect(await fetchInstallLocale(20)).toBeNull();
  });

  it('initInstallLocale applies what the shell reports', async () => {
    setTauri(true);
    invokeMock.mockResolvedValueOnce('el');
    expect(await initInstallLocale()).toBe('el');
    expect(getCurrentLocale()).toBe('el');
    expect(readAppliedInstallLocale()).toBe('el');
  });
});

describe('with the LanguageProvider (after the start-up apply)', () => {
  function Probe() {
    const setLocale = useSetLocale();
    return (
      <>
        <p data-testid="locale">{useLocale()}</p>
        <button type="button" onClick={() => void setLocale('de')}>
          Deutsch
        </button>
      </>
    );
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
  /** Renders the provider; the returned function switches the auth status (sign-in / sign-out). */
  function renderApp(status: FakeAuthStatus, settings: SettingsContextValue) {
    const view = render(tree(status, settings));
    return (next: FakeAuthStatus) => view.rerender(tree(next, settings));
  }
  const shown = () => screen.getByTestId('locale').textContent;
  const deviceLanguage = () => window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

  /** A device and a remembered account in Hebrew, reinstalled in French. */
  function reinstallInFrenchWithHebrewAccount(): SettingsContextValue {
    storeLocale('he');
    window.localStorage.setItem(INSTALL_LOCALE_APPLIED_KEY, 'he');
    expect(applyInstallLocale('fr')).toBe('fr');
    return fakeSettings({ language: 'he' as Locale });
  }

  it('"Remember me": the account signs in first, and the login screen after sign-out still shows the installer language', () => {
    const settings = reinstallInFrenchWithHebrewAccount();
    const setStatus = renderApp('authenticated', settings);
    expect(shown()).toBe('he'); // the existing account keeps its own language
    expect(deviceLanguage()).toBe('he');
    setStatus('anonymous'); // sign-out -> login / registration screen
    expect(shown()).toBe('fr');
    expect(deviceLanguage()).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    // Shown once: afterwards the device follows the last language used, as before.
    setStatus('authenticated');
    expect(shown()).toBe('he');
    setStatus('anonymous');
    expect(shown()).toBe('he');
    expect(applyInstallLocale('fr')).toBe('he');
  });

  it('"Remember me" and the app closed while signed in: the installer language waits for the first signed-out screen', () => {
    const settings = reinstallInFrenchWithHebrewAccount();
    renderApp('authenticated', settings);
    expect(shown()).toBe('he');
    cleanup(); // the app is closed without signing out
    // Next start: the remembered session is restored again, still in the account's language.
    expect(applyInstallLocale('fr')).toBe('he');
    const setStatus = renderApp('loading', settings);
    expect(shown()).toBe('he');
    setStatus('authenticated');
    expect(shown()).toBe('he');
    setStatus('anonymous');
    expect(shown()).toBe('fr');
    expect(deviceLanguage()).toBe('fr');
  });

  it('"Remember me" but the session is gone at start-up: the login screen shows the installer language', () => {
    reinstallInFrenchWithHebrewAccount();
    const setStatus = renderApp('loading', fakeSettings());
    expect(shown()).toBe('fr');
    setStatus('anonymous');
    expect(shown()).toBe('fr');
    expect(deviceLanguage()).toBe('fr');
  });

  it('a language chosen in Settings while signed in replaces the pending installer language', async () => {
    const settings = reinstallInFrenchWithHebrewAccount();
    const setStatus = renderApp('authenticated', settings);
    expect(shown()).toBe('he');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Deutsch' }));
    });
    expect(shown()).toBe('de');
    setStatus('anonymous');
    expect(shown()).toBe('de');
    expect(deviceLanguage()).toBe('de');
  });

  it('the login / registration screens use the installer language', () => {
    applyInstallLocale('ja');
    renderApp('anonymous', fakeSettings());
    expect(screen.getByTestId('locale')).toHaveTextContent('ja');
    expect(document.documentElement.lang).toBe('ja');
  });

  it("a signed-in account keeps its own language over the installer's", () => {
    applyInstallLocale('ja');
    renderApp('authenticated', fakeSettings({ language: 'de' as Locale }));
    expect(screen.getByTestId('locale')).toHaveTextContent('de');
  });
});

// ---------------------------------------------------------------------------------------------
// The installer side, read from disk (the root tsconfig has no Node types: computed specifiers).
// ---------------------------------------------------------------------------------------------

/** NSIS language name of every UI locale (tauri.conf.json bundle.windows.nsis.languages). */
const NSIS_LANGUAGE: Record<Locale, string> = {
  en: 'English',
  he: 'Hebrew',
  zh: 'SimpChinese',
  es: 'Spanish',
  pl: 'Polish',
  ru: 'Russian',
  fr: 'French',
  ar: 'Arabic',
  ja: 'Japanese',
  tr: 'Turkish',
  cs: 'Czech',
  hu: 'Hungarian',
  bg: 'Bulgarian',
  el: 'Greek',
  pt: 'Portuguese',
  de: 'German',
  ro: 'Romanian',
  it: 'Italian',
  th: 'Thai',
  hi: 'Hindi',
};

/** Languages whose installer messages Tauri ships complete and correct (all others need our file). */
const TAURI_BUILT_IN = new Set(['English', 'SimpChinese', 'Spanish', 'Russian', 'French', 'Arabic', 'Japanese', 'Turkish', 'Bulgarian', 'Portuguese']);

interface NsisConfig {
  languages: string[];
  displayLanguageSelector: boolean;
  installerHooks: string;
  customLanguageFiles: Record<string, string>;
}

let readText: (relative: string) => string = () => '';
let readBytes: (relative: string) => Uint8Array = () => new Uint8Array();
let nsis: NsisConfig;

beforeAll(async () => {
  const load = (specifier: string) => import(/* @vite-ignore */ specifier);
  const fs = (await load('node:fs')) as { readFileSync(file: string, encoding?: 'utf8'): unknown };
  const { fileURLToPath } = (await load('node:url')) as { fileURLToPath(url: string): string };
  const { dirname, join } = (await load('node:path')) as { dirname(p: string): string; join(...parts: string[]): string };
  const srcTauri = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src-tauri');
  readText = (relative) => fs.readFileSync(join(srcTauri, relative), 'utf8') as string;
  readBytes = (relative) => fs.readFileSync(join(srcTauri, relative)) as Uint8Array;
  nsis = JSON.parse(readText('tauri.conf.json')).bundle.windows.nsis as NsisConfig;
});

describe('the NSIS installer offers the 20 UI languages', () => {
  it('lists every UI language once, English first (the default when Windows speaks none of them)', () => {
    expect(nsis.displayLanguageSelector).toBe(true);
    expect(nsis.languages[0]).toBe('English');
    expect([...nsis.languages].sort()).toEqual(LOCALE_CODES.map((code) => NSIS_LANGUAGE[code]).sort());
  });

  it('every language Tauri does not translate (or translates badly) has our own message file', () => {
    const reference = readText('nsis/Hebrew.nsh');
    const keysOf = (text: string) =>
      [...text.matchAll(/^LangString (\w+) \$\{LANG_(\w+)\} "/gm)].map((m) => ({ key: m[1], lang: m[2] }));
    const referenceKeys = keysOf(reference).map((k) => k.key).sort();
    expect(referenceKeys).toHaveLength(27);
    for (const language of nsis.languages) {
      const file = nsis.customLanguageFiles[language];
      if (!file) {
        expect(TAURI_BUILT_IN.has(language), `${language} needs src-tauri/nsis/${language}.nsh`).toBe(true);
        continue;
      }
      const relative = file.replace(/^\.\//, '');
      const bytes = readBytes(relative);
      // makensis rejects the file when Tauri adds its own BOM in front of ours.
      expect([bytes[0], bytes[1], bytes[2]], `${relative} must not start with a BOM`).not.toEqual([0xef, 0xbb, 0xbf]);
      const entries = keysOf(readText(relative));
      expect(entries.map((e) => e.key).sort(), relative).toEqual(referenceKeys);
      expect(new Set(entries.map((e) => e.lang)), relative).toEqual(new Set([language.toUpperCase()]));
      // The brand is never translated: the messages use ${PRODUCTNAME} or the {{product_name}}
      // placeholder Tauri replaces at run time (its Italian file had a broken "{product_name}").
      const messages = readText(relative).replace(/^;.*$/gm, '');
      expect(messages).not.toMatch(/\{product_name\}(?!\})|(?<!\{)\{product_name\}/);
      expect(messages).toMatch(/LangString uninstallApp \$\{LANG_\w+\} "[^"]*\$\{PRODUCTNAME\}/);
    }
  });

  it('the hook maps every installer language to its UI locale code and writes install-locale.txt', () => {
    const hooks = readText(nsis.installerHooks.replace(/^\.\//, ''));
    expect(hooks).toMatch(/^!define MUI_LANGDLL_ALWAYSSHOW$/m);
    expect(hooks).toMatch(/^!define MUI_LANGDLL_ALLLANGUAGES$/m);
    expect(hooks).toContain('!macro NSIS_HOOK_POSTINSTALL');
    expect(hooks).toContain('!macro NSIS_HOOK_POSTUNINSTALL');
    expect(hooks).toContain('"$INSTDIR\\install-locale.txt"');
    const mapped = new Map(
      [...hooks.matchAll(/\$LANGUAGE = \$\{LANG_(\w+)\}\s+StrCpy \$0 "(\w+)"/g)].map((m) => [m[1], m[2]]),
    );
    for (const code of LOCALE_CODES) {
      expect(mapped.get(NSIS_LANGUAGE[code].toUpperCase()), code).toBe(code);
    }
    expect(mapped.size).toBe(LOCALE_CODES.length);
    // Plain ASCII: makensis reads it without a BOM.
    expect([...hooks].every((ch) => ch.charCodeAt(0) < 128)).toBe(true);
  });

  it('the Rust shell accepts exactly the same 20 codes', () => {
    const lib = readText('src/lib.rs');
    const list = /const UI_LOCALES: \[&str; 20\] = \[([^\]]+)\]/.exec(lib)?.[1] ?? '';
    const codes = [...list.matchAll(/"(\w+)"/g)].map((m) => m[1]);
    expect([...codes].sort()).toEqual([...LOCALE_CODES].sort());
    expect(lib).toContain('get_install_locale');
  });
});
