/**
 * The desktop frame (AppShell.tsx) of the Windows app and the web UI: the full frame - header,
 * navigation, footer - from the very first start. No platform has a first-run language screen
 * (docs/android-tasks/HOSTED-IMPL.md item 13), so a desktop with nothing chosen yet goes straight to
 * the welcome page. (The phone shell and the desktop / phone
 * switch are covered by MobileShell.test.tsx.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { NAV_ITEMS } from '@shared/constants';
import { T } from '@/constants/texts';
import { LANGUAGE_STORAGE_KEY, __resetLocaleForTests, trWith } from '@/i18n/runtime';
import { AppRoutes } from '@/router';
import { renderWithProviders, sampleUser } from '@/test/render';
import { AppShell } from './AppShell';

vi.mock('@/pages/HomePage', () => ({ default: () => <h1>home page (signed in)</h1> }));

const en = trWith('en');

function renderDesktopApp() {
  return renderWithProviders(
    <AppShell>
      <AppRoutes />
    </AppShell>,
    { auth: 'anonymous', route: '/', locale: 'en' },
  );
}

beforeEach(() => {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
  __resetLocaleForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppShell on the desktop at the first start', () => {
  it('nothing chosen yet (no installer language, no device language): the full frame and the welcome page - no language screen', () => {
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
    renderDesktopApp();

    expect(screen.getByRole('heading', { level: 1, name: T.welcomeTitle })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    // The whole frame: the brand as the home link, the navigation and the menu, the landmarks.
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('link', { name: T.appName })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: T.mainNavLabel })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en('shell.menu') })).toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1, name: T.welcomeTitle }));
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en('shell.skipToContent') })).toBeInTheDocument();
    // Nothing was chosen for the user: the device language stays unset until Settings -> Language.
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  it('a desktop that already has a language gets the same full frame', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    renderDesktopApp();
    expect(screen.getByRole('heading', { level: 1, name: T.welcomeTitle })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: T.mainNavLabel })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });
});

describe('AppShell on the desktop after sign-in', () => {
  it('greets once - the sentence in the header - and keeps the navigation to its ten links', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    renderWithProviders(
      <AppShell>
        <AppRoutes />
      </AppShell>,
      { auth: 'authenticated', route: '/', locale: 'en' },
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'home page (signed in)' })).toBeInTheDocument();

    const sentence = T.greeting(sampleUser.firstName);
    expect(sentence).toBe(en('shell.greeting', { firstName: sampleUser.firstName }));
    // Exactly one greeting in the whole frame (the home page is replaced by a stub here), so a
    // screen reader hears it once per page.
    const greetings = screen.getAllByText(sentence);
    expect(greetings).toHaveLength(1);
    expect(screen.getByRole('banner')).toContainElement(greetings[0]);
    expect(greetings[0]).not.toHaveAttribute('aria-hidden');
    expect(screen.queryByText(T.greetingShort(sampleUser.firstName))).not.toBeInTheDocument();

    // The navigation: one list, one item per page link, the greeting is not among them.
    const nav = screen.getByRole('navigation', { name: T.mainNavLabel });
    expect(nav).not.toContainElement(greetings[0]);
    expect(within(nav).getAllByRole('list')).toHaveLength(1);
    expect(within(nav).getAllByRole('listitem')).toHaveLength(NAV_ITEMS.length);
    expect(within(nav).getAllByRole('link')).toHaveLength(NAV_ITEMS.length);
  });
});
