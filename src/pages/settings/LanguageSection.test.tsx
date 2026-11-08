import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Fragment } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { FocusHeading } from '@/components/a11y/FocusHeading';
import userEvent from '@testing-library/user-event';
import { LOCALES } from '@shared/i18n';
import { AnnouncerProvider } from '@/context/AnnouncerContext';
import { AuthContext } from '@/context/AuthContext';
import { LanguageProvider, useLocale, useRestoreFocusAfterLanguageChange } from '@/context/LanguageContext';
import { SettingsContext, type SettingsContextValue } from '@/context/SettingsContext';
import { __resetLocaleForTests, getCurrentLocale, LANGUAGE_STORAGE_KEY } from '@/i18n/runtime';
import { assertiveRegion, fakeAuth, fakeSettings, politeRegion, type FakeAuthStatus } from '@/test/render';
import { LANGUAGE_SELECT_ID, LanguageSection } from './LanguageSection';

/** Like App.tsx: the page is re-keyed by the locale, and its heading takes the focus when mounted. */
function RekeyedPage() {
  const locale = useLocale();
  useRestoreFocusAfterLanguageChange(locale);
  return (
    <Fragment key={locale}>
      <FocusHeading focus="always">Settings</FocusHeading>
      <LanguageSection />
    </Fragment>
  );
}

function renderRekeyed(settings: SettingsContextValue = fakeSettings()) {
  const user = userEvent.setup();
  render(
    <AuthContext.Provider value={fakeAuth('authenticated')}>
      <SettingsContext.Provider value={settings}>
        <AnnouncerProvider>
          <LanguageProvider>
            <RekeyedPage />
          </LanguageProvider>
        </AnnouncerProvider>
      </SettingsContext.Provider>
    </AuthContext.Provider>,
  );
  return { user, settings };
}

function renderSection(status: FakeAuthStatus, settings: SettingsContextValue = fakeSettings()) {
  const user = userEvent.setup();
  const result = render(
    <AuthContext.Provider value={fakeAuth(status)}>
      <SettingsContext.Provider value={settings}>
        <AnnouncerProvider>
          <LanguageProvider>
            <LanguageSection />
          </LanguageProvider>
        </AnnouncerProvider>
      </SettingsContext.Provider>
    </AuthContext.Provider>,
  );
  return { ...result, user, settings };
}

/**
 * The notice inside the Language card. The announcer repeats the same sentence in its live region a
 * moment later, so a page-wide `findByText` is a race (one match on a fast run, two - an error - on a
 * loaded machine). The card is looked up on every attempt: a language switch rebuilds the page.
 */
function findCardNotice(message: string): Promise<HTMLElement> {
  return waitFor(() => {
    const card = document.querySelector<HTMLElement>('.settings-language');
    if (!card) throw new Error('the Language card is not rendered');
    return within(card).getByText(message);
  });
}

describe('LanguageSection', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetLocaleForTests();
  });

  afterEach(() => {
    window.localStorage.clear();
    __resetLocaleForTests();
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  it('renders the 20 languages in their own script with a lang attribute, labelled in the current language', () => {
    renderSection('anonymous');
    expect(screen.getByRole('heading', { name: 'Language' })).toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: 'Interface language' });
    expect(select).toHaveValue('en');
    const options = within(select).getAllByRole('option');
    expect(options).toHaveLength(20);
    expect(options.map((o) => o.textContent)).toEqual(LOCALES.map((l) => l.nativeName));
    expect(options.map((o) => o.textContent)).toEqual([
      'English',
      'עברית',
      'العربية',
      '中文',
      '日本語',
      'हिन्दी',
      'ไทย',
      'Español',
      'Português',
      'Français',
      'Italiano',
      'Deutsch',
      'Română',
      'Ελληνικά',
      'Polski',
      'Čeština',
      'Magyar',
      'Русский',
      'Български',
      'Türkçe',
    ]);
    for (const [i, option] of options.entries()) {
      expect(option).toHaveAttribute('value', LOCALES[i].code);
      expect(option).toHaveAttribute('lang', LOCALES[i].code);
      expect(option).toHaveAttribute('dir', LOCALES[i].dir);
    }
    expect((within(select).getByRole('option', { name: 'English' }) as HTMLOptionElement).selected).toBe(true);
    expect(select).toHaveAccessibleDescription(/kept on this device/);
  });

  it('switches the language before login: relabels itself, stores the choice, announces, saves nothing', async () => {
    const { user, settings } = renderSection('anonymous');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Interface language' }), 'he');
    const select = screen.getByRole('combobox', { name: 'שפת הממשק' });
    expect(select).toHaveValue('he');
    expect((within(select).getByRole('option', { name: 'עברית' }) as HTMLOptionElement).selected).toBe(true);
    expect(screen.getByRole('heading', { name: 'שפה' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('he');
    expect(document.documentElement.dir).toBe('rtl');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('he');
    expect(getCurrentLocale()).toBe('he');
    await waitFor(() => expect(politeRegion()).toHaveTextContent('השפה עודכנה: עברית'));
    expect(settings.update).not.toHaveBeenCalled();
  });

  it('saves the language to the account when signed in', async () => {
    const { user, settings } = renderSection('authenticated');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Interface language' }), 'ar');
    expect(settings.update).toHaveBeenCalledWith({ language: 'ar' });
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('keeps the keyboard focus on the select when the page is rebuilt in the new language, and never disables it', async () => {
    let finish: (v: unknown) => void = () => undefined;
    const settings = fakeSettings();
    settings.update = vi.fn(() => new Promise((resolve) => (finish = resolve))) as SettingsContextValue['update'];
    const { user } = renderRekeyed(settings);
    const before = document.getElementById(LANGUAGE_SELECT_ID) as HTMLSelectElement;
    before.focus();
    await user.selectOptions(before, 'he');
    const after = document.getElementById(LANGUAGE_SELECT_ID) as HTMLSelectElement;
    // A new element (the page was rebuilt), yet the focus is on it - not on <body> or the heading.
    expect(after).not.toBe(before);
    expect(after).toHaveValue('he');
    await waitFor(() => expect(document.activeElement).toBe(after));
    // While the account save runs the select stays usable (aria-busy, not disabled).
    expect(after).not.toBeDisabled();
    expect(after).toHaveAttribute('aria-busy', 'true');
    finish({});
    await waitFor(() => expect(after).not.toHaveAttribute('aria-busy'));
    expect(document.activeElement).toBe(after);
  });

  it('shows and announces a failed account save even though the page was rebuilt', async () => {
    const settings = fakeSettings();
    settings.update = vi.fn().mockRejectedValue(new Error('boom'));
    const { user } = renderRekeyed(settings);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Interface language' }), 'he');
    const message = 'השפה שונתה במכשיר זה, אך שמירתה בחשבון נכשלה.';
    expect(await findCardNotice(message)).toBeInTheDocument();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(message));
  });

  it('keeps the device switch and reports an error when the account save fails', async () => {
    const settings = fakeSettings();
    settings.update = vi.fn().mockRejectedValue(new Error('boom'));
    const { user } = renderSection('authenticated', settings);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Interface language' }), 'he');
    expect(getCurrentLocale()).toBe('he');
    const message = 'השפה שונתה במכשיר זה, אך שמירתה בחשבון נכשלה.';
    const alert = await findCardNotice(message);
    // Shown in the card, spoken once: through the announcer, not a second role=alert box.
    expect(alert.closest('.alert--error')).not.toHaveAttribute('role');
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(message));
    // The select itself already shows the new language.
    expect(screen.getByRole('combobox', { name: 'שפת הממשק' })).toHaveValue('he');
  });
});
