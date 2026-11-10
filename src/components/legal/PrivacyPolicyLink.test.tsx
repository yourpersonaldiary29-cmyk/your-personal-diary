/**
 * The in-app links to the privacy policy (docs/play-tasks/PLAY-LEGAL.md item 4): the address is the page of
 * the fixed diary server in the UI language (English at /privacy/), the link opens outside the app - the
 * browser and the Android WebView follow the anchor itself, the Windows shell gets the address through its
 * `open_external_url` command (src-tauri/src/opener.rs) and, when that fails, the address is shown to open
 * by hand - and only the legal pages of the diary server are ever opened. The registration checkbox - ONE box,
 * ONE sentence with TWO links: "I have read the Privacy Policy and the Terms of Use, and I agree to them"
 * (docs/android-tasks/PRIVACY-CHECKBOX.md, docs/apple-tasks/TERMS.md) - and the Settings -> Privacy card carry
 * the links.
 */
import { useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_CODES, t } from '@shared/i18n';
import { DEFAULT_SERVER_URL } from '@/config/server-default';
import { setCurrentLocale } from '@/i18n/runtime';
import { renderWithProviders } from '@/test/render';
import {
  consentParts,
  isDiaryServerUrl,
  isLegalPageUrl,
  legalPageUrl,
  openInSystemBrowser,
  privacyPolicyUrl,
  PrivacyPolicyLink,
  RegisterPrivacyConsent,
  termsUrl,
} from './PrivacyPolicyLink';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const invokeMock = vi.mocked(invoke);

/** The registration checkbox with its own state, as the registration page holds it. */
function Consent({ error = null, initial = false }: { error?: string | null; initial?: boolean }) {
  const [checked, setChecked] = useState(initial);
  return <RegisterPrivacyConsent id="consent" checked={checked} onChange={setChecked} error={error} />;
}

function setTauri(on: boolean): void {
  const w = window as unknown as Record<string, unknown>;
  if (on) w.__TAURI_INTERNALS__ = {};
  else delete w.__TAURI_INTERNALS__;
}

afterEach(() => {
  setTauri(false);
  invokeMock.mockReset();
});

describe('addresses', () => {
  it('English is the page itself, every other language its own folder, all on the fixed diary server', () => {
    expect(privacyPolicyUrl('en')).toBe(`${DEFAULT_SERVER_URL}/privacy/`);
    expect(privacyPolicyUrl('he')).toBe(`${DEFAULT_SERVER_URL}/privacy/he/`);
    expect(legalPageUrl('delete-account', 'ar')).toBe(`${DEFAULT_SERVER_URL}/delete-account/ar/`);
    expect(termsUrl('en')).toBe(`${DEFAULT_SERVER_URL}/terms/`);
    expect(termsUrl('he')).toBe(`${DEFAULT_SERVER_URL}/terms/he/`);
    expect(legalPageUrl('support', 'ja')).toBe(`${DEFAULT_SERVER_URL}/support/ja/`);
    for (const code of LOCALE_CODES) expect(isDiaryServerUrl(privacyPolicyUrl(code)), code).toBe(true);
  });

  it('follows the UI language', () => {
    setCurrentLocale('de');
    expect(privacyPolicyUrl()).toBe(`${DEFAULT_SERVER_URL}/privacy/de/`);
  });

  it('only the diary server is ever opened: other origins, plain http, credentials and junk are refused', () => {
    const host = new URL(DEFAULT_SERVER_URL).host;
    expect(isDiaryServerUrl(`${DEFAULT_SERVER_URL}/privacy/`)).toBe(true);
    expect(isDiaryServerUrl('https://example.org/privacy/')).toBe(false);
    expect(isDiaryServerUrl(`http://${host}/privacy/`)).toBe(false);
    expect(isDiaryServerUrl(`https://user:pw@${host}/privacy/`)).toBe(false);
    expect(isDiaryServerUrl(`https://${host}.example.org/privacy/`)).toBe(false);
    expect(isDiaryServerUrl('not a url')).toBe(false);
  });

  it('the Windows shell is asked only for the legal pages, written the way legalPageUrl writes them', () => {
    for (const code of LOCALE_CODES) {
      expect(isLegalPageUrl(privacyPolicyUrl(code)), code).toBe(true);
      expect(isLegalPageUrl(legalPageUrl('delete-account', code)), code).toBe(true);
      expect(isLegalPageUrl(termsUrl(code)), code).toBe(true);
      expect(isLegalPageUrl(legalPageUrl('support', code)), code).toBe(true);
    }
    const host = new URL(DEFAULT_SERVER_URL).host;
    for (const url of [
      DEFAULT_SERVER_URL,
      `${DEFAULT_SERVER_URL}/`,
      `${DEFAULT_SERVER_URL}/privacy`,
      `${DEFAULT_SERVER_URL}/api/auth/delete-account`,
      `${DEFAULT_SERVER_URL}/privacy-policy/`,
      `${DEFAULT_SERVER_URL}/privacy/?next=x`,
      `${DEFAULT_SERVER_URL}/privacy/#top`,
      `${DEFAULT_SERVER_URL}/privacy/../api/`,
      `${DEFAULT_SERVER_URL}/privacy/%2e%2e/api/`,
      `${DEFAULT_SERVER_URL}/terms`,
      `${DEFAULT_SERVER_URL}/terms-of-use/`,
      `${DEFAULT_SERVER_URL}/terms/?x=1`,
      `${DEFAULT_SERVER_URL}/support/#faq`,
      `${DEFAULT_SERVER_URL}/api/terms/`,
      'https://example.org/terms/',
      `${DEFAULT_SERVER_URL}/privacy\\..\\api`,
      `https://${host.toUpperCase()}/privacy/`,
      `https://user@${host}/privacy/`,
      `http://${host}/privacy/`,
      'https://example.org/privacy/',
      'javascript:alert(1)',
      'file:///C:/Windows/System32/calc.exe',
    ]) {
      expect(isLegalPageUrl(url), url).toBe(false);
    }
  });
});

describe('opening the page outside the app', () => {
  it('browser and Android: the anchor itself opens it (new tab / system browser) - no shell call', () => {
    renderWithProviders(<PrivacyPolicyLink>Privacy policy</PrivacyPolicyLink>, { locale: 'en' });
    const link = screen.getByRole('link', { name: 'Privacy policy' });
    expect(link).toHaveAttribute('href', `${DEFAULT_SERVER_URL}/privacy/`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('Windows: the click goes to the shell command open_external_url with the address', async () => {
    setTauri(true);
    invokeMock.mockResolvedValue(undefined);
    renderWithProviders(<PrivacyPolicyLink>Privacy policy</PrivacyPolicyLink>, { locale: 'en' });
    const link = screen.getByRole('link', { name: 'Privacy policy' });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('open_external_url', { url: `${DEFAULT_SERVER_URL}/privacy/` }));
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('privacy-policy-address')).toBeNull();
  });

  it('Windows, another language: the page of that language goes to the shell (from the registration checkbox, which stays unticked)', async () => {
    setTauri(true);
    invokeMock.mockResolvedValue(undefined);
    renderWithProviders(<Consent />, { locale: 'he' });
    fireEvent.click(screen.getByRole('link', { name: 'מדיניות הפרטיות' }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('open_external_url', { url: `${DEFAULT_SERVER_URL}/privacy/he/` }));
    expect(screen.queryByTestId('privacy-policy-address')).toBeNull();
    // Opening the policy is not the confirmation: the link inside the label does not tick the box.
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('Windows, the shell refuses or cannot open it: the address is shown to open by hand', async () => {
    for (const error of ['open_external_url opens only the legal pages (privacy, terms, delete-account, support) of the diary server', 'command open_external_url not found']) {
      setTauri(true);
      invokeMock.mockReset();
      invokeMock.mockRejectedValue(error);
      const { unmount } = renderWithProviders(<PrivacyPolicyLink>Privacy policy</PrivacyPolicyLink>, { locale: 'en' });
      expect(screen.queryByTestId('privacy-policy-address')).toBeNull();
      fireEvent.click(screen.getByRole('link', { name: 'Privacy policy' }));
      const address = await screen.findByTestId('privacy-policy-address');
      expect(address).toHaveTextContent(`Open this address in your web browser: ${DEFAULT_SERVER_URL}/privacy/`);
      expect(invokeMock).toHaveBeenCalledWith('open_external_url', { url: `${DEFAULT_SERVER_URL}/privacy/` });
      unmount();
    }
  });

  it('openInSystemBrowser hands the delete-account page to the shell as well', async () => {
    setTauri(true);
    invokeMock.mockResolvedValue(undefined);
    const url = legalPageUrl('delete-account', 'fr');
    expect(await openInSystemBrowser(url)).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('open_external_url', { url });
    invokeMock.mockRejectedValue(new Error('Windows could not open the address'));
    expect(await openInSystemBrowser(url)).toBe(false);
  });

  it('openInSystemBrowser refuses any other address and does nothing outside the Windows shell', async () => {
    setTauri(true);
    invokeMock.mockResolvedValue(undefined);
    expect(await openInSystemBrowser('https://example.org/')).toBe(false);
    expect(await openInSystemBrowser(`${DEFAULT_SERVER_URL}/api/auth/delete-account`)).toBe(false);
    expect(await openInSystemBrowser(`${DEFAULT_SERVER_URL}/privacy/?next=x`)).toBe(false);
    expect(await openInSystemBrowser('javascript:alert(1)')).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
    setTauri(false);
    expect(await openInSystemBrowser(`${DEFAULT_SERVER_URL}/privacy/`)).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe('the registration checkbox (docs/android-tasks/PRIVACY-CHECKBOX.md, docs/apple-tasks/TERMS.md)', () => {
  const EN_NAME = 'I have read the Privacy Policy and the Terms of Use, and I agree to them';

  it('English: ONE native, required, unticked checkbox named by ONE sentence; "Privacy Policy" and "Terms of Use" in it are the links', () => {
    renderWithProviders(<Consent />, { locale: 'en' });
    const box = screen.getByRole('checkbox', { name: EN_NAME }) as HTMLInputElement;
    expect(box).toHaveAttribute('type', 'checkbox');
    expect(box).toHaveAttribute('aria-required', 'true');
    expect(box).not.toBeChecked();
    expect(box).not.toHaveAttribute('aria-invalid');
    expect(box).not.toHaveAttribute('aria-describedby');
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    const link = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(link).toHaveAttribute('href', `${DEFAULT_SERVER_URL}/privacy/`);
    expect(link).toHaveAttribute('target', '_blank');
    const terms = screen.getByRole('link', { name: 'Terms of Use' });
    expect(terms).toHaveAttribute('href', `${DEFAULT_SERVER_URL}/terms/`);
    expect(terms).toHaveAttribute('target', '_blank');
    // The sentence is the box's label, with both links inside it and the "(required)" marker of the other fields.
    const label = box.labels?.[0] as HTMLLabelElement;
    expect(label).toContainElement(link);
    expect(label).toContainElement(terms);
    expect(label).toHaveTextContent(`${EN_NAME}(required)`);
    // Real links: reachable with the keyboard, in reading order (the box, then the policy, then the terms).
    const order = [...document.querySelectorAll('input, a')];
    expect(order).toEqual([box, link, terms]);
  });

  it('clicking the sentence ticks and unticks the box; Space on the focused box does too', async () => {
    const { user } = renderWithProviders(<Consent />, { locale: 'en' });
    const box = screen.getByRole('checkbox', { name: EN_NAME }) as HTMLInputElement;
    await user.click(box.labels?.[0] as HTMLLabelElement);
    expect(box).toBeChecked();
    await user.click(box.labels?.[0] as HTMLLabelElement);
    expect(box).not.toBeChecked();
    box.focus();
    await user.keyboard(' ');
    expect(box).toBeChecked();
  });

  it('Hebrew: the Hebrew sentence names the box and the links open the Hebrew pages', () => {
    renderWithProviders(<Consent />, { locale: 'he' });
    expect(screen.getByRole('checkbox', { name: 'קראתי את מדיניות הפרטיות ואת תנאי השימוש והסכמתי להם' })).not.toBeChecked();
    expect(screen.getByRole('link', { name: 'מדיניות הפרטיות' })).toHaveAttribute('href', `${DEFAULT_SERVER_URL}/privacy/he/`);
    expect(screen.getByRole('link', { name: 'תנאי השימוש' })).toHaveAttribute('href', `${DEFAULT_SERVER_URL}/terms/he/`);
  });

  it('Windows: the terms link goes to the shell with the terms page, and the box stays unticked', async () => {
    setTauri(true);
    invokeMock.mockResolvedValue(undefined);
    renderWithProviders(<Consent />, { locale: 'de' });
    fireEvent.click(screen.getByTestId('terms-link'));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('open_external_url', { url: `${DEFAULT_SERVER_URL}/terms/de/` }));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('the sentence is cut around both links in the order of the language', () => {
    setCurrentLocale('en');
    expect(consentParts()).toEqual(['I have read the ', { page: 'privacy' }, ' and the ', { page: 'terms' }, ', and I agree to them']);
  });

  it('an error: under the box and outside its label, tied to the box, which is marked invalid', () => {
    renderWithProviders(<Consent error="Tick the box first." />, { locale: 'en' });
    const box = screen.getByRole('checkbox', { name: EN_NAME }) as HTMLInputElement;
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription('Tick the box first.');
    const error = document.getElementById('consent-error') as HTMLElement;
    expect(error).toHaveTextContent('Tick the box first.');
    expect(box.labels?.[0]).not.toContainElement(error);
    expect(box.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Windows, the shell cannot open the page: the address appears under the box, which keeps its name and stays unticked', async () => {
    setTauri(true);
    invokeMock.mockRejectedValue('command open_external_url not found');
    renderWithProviders(<Consent />, { locale: 'en' });
    fireEvent.click(screen.getByRole('link', { name: 'Privacy Policy' }));
    const address = await screen.findByTestId('privacy-policy-address');
    expect(address).toHaveTextContent(`Open this address in your web browser: ${DEFAULT_SERVER_URL}/privacy/`);
    fireEvent.click(screen.getByRole('link', { name: 'Terms of Use' }));
    const termsAddress = await screen.findByTestId('terms-address');
    expect(termsAddress).toHaveTextContent(`Open this address in your web browser: ${DEFAULT_SERVER_URL}/terms/`);
    const box = screen.getByRole('checkbox', { name: EN_NAME }) as HTMLInputElement;
    expect(box.labels?.[0]).not.toContainElement(address);
    expect(box.labels?.[0]).not.toContainElement(termsAddress);
    expect(box).not.toBeChecked();
  });

  it('every language: one slot for each link, two link texts, an error text - translated, not English copies', async () => {
    const load = (specifier: string) => import(/* @vite-ignore */ specifier);
    const { readFileSync } = (await load('node:fs')) as { readFileSync(file: string, encoding: 'utf8'): string };
    const { fileURLToPath } = (await load('node:url')) as { fileURLToPath(url: string): string };
    const { dirname, join } = (await load('node:path')) as { dirname(p: string): string; join(...parts: string[]): string };
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    // A catalogue still marked TODO-TRANSLATE holds the English placeholders of the terms keys (docs/apple-tasks/TERMS-DIFF.md).
    const untranslated = (code: string, area: string) => readFileSync(join(root, 'shared', 'i18n', 'messages', code, `${area}.ts`), 'utf8').includes('TODO-TRANSLATE');
    const english = { sentence: t('en', 'auth.legalConsent', { policy: 'X', terms: 'Y' }), required: t('en', 'auth.legalConsentRequired'), terms: t('en', 'auth.termsConsentLink') };
    const P = String.fromCharCode(0);
    const T = String.fromCharCode(1);
    for (const code of LOCALE_CODES) {
      const sentence = t(code, 'auth.legalConsent', { policy: P, terms: T });
      expect(sentence.split(P), code).toHaveLength(2);
      expect(sentence.split(T), code).toHaveLength(2);
      expect(t(code, 'auth.privacyConsentLink').trim(), code).not.toBe('');
      expect(t(code, 'auth.termsConsentLink').trim(), code).not.toBe('');
      expect(t(code, 'auth.legalConsentRequired').trim(), code).not.toBe('');
      expect(t(code, 'settings.privacy.policyLink').trim(), code).not.toBe('');
      expect(t(code, 'settings.privacy.termsLink').trim(), code).not.toBe('');
      expect(t(code, 'shell.legal.openInBrowser', { url: 'U' }), code).toContain('U');
      if (code !== 'en' && !untranslated(code, 'auth')) {
        expect(t(code, 'auth.legalConsent', { policy: 'X', terms: 'Y' }), code).not.toBe(english.sentence);
        expect(t(code, 'auth.legalConsentRequired'), code).not.toBe(english.required);
        expect(t(code, 'auth.termsConsentLink'), code).not.toBe(english.terms);
      }
    }
    // The base writer's two languages are finished.
    for (const area of ['auth', 'settings', 'server']) {
      expect(untranslated('en', area), `en/${area}`).toBe(false);
      expect(untranslated('he', area), `he/${area}`).toBe(false);
    }
  });

  it('every language renders: the box is named by its sentence, the link text in its place and the page in that language', () => {
    for (const code of LOCALE_CODES) {
      const { unmount } = renderWithProviders(<Consent />, { locale: code });
      const linkText = t(code, 'auth.privacyConsentLink');
      const termsText = t(code, 'auth.termsConsentLink');
      expect(screen.getByRole('checkbox', { name: t(code, 'auth.legalConsent', { policy: linkText, terms: termsText }) }), code).not.toBeChecked();
      expect(screen.getByTestId('privacy-policy-link'), code).toHaveAttribute('href', privacyPolicyUrl(code));
      expect(screen.getByTestId('privacy-policy-link'), code).toHaveTextContent(linkText);
      expect(screen.getByTestId('terms-link'), code).toHaveAttribute('href', termsUrl(code));
      expect(screen.getByTestId('terms-link'), code).toHaveTextContent(termsText);
      unmount();
    }
  });

  it('the error and the address line up with the sentence on either side (logical margin: right-to-left too) and wrap on a phone', async () => {
    const load = (specifier: string) => import(/* @vite-ignore */ specifier);
    const { readFileSync } = (await load('node:fs')) as { readFileSync(file: string, encoding: 'utf8'): string };
    const { fileURLToPath } = (await load('node:url')) as { fileURLToPath(url: string): string };
    const { dirname, join } = (await load('node:path')) as { dirname(p: string): string; join(...parts: string[]): string };
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'styles', 'forms.css'), 'utf8');
    const rule = /\.consent__below\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('margin-inline-start');
    expect(rule).not.toMatch(/margin-(?:left|right)/);
    expect(rule).toContain('overflow-wrap: anywhere');
  });
});
