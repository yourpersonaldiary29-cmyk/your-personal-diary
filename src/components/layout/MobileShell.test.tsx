import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import type { Locale } from '@shared/i18n';
import { trWith } from '@/i18n/runtime';
import { LocationDisplay, currentPath, renderWithProviders, sampleUser, type ProviderOptions } from '@/test/render';
import { __resetBackHandlerForTests, handleBack } from '@/utils/back-handler';
import { formatFullDate, todayIso } from '@/utils/dates';
import { MOBILE_UI_CLASS } from '@/utils/mobile-ui';
import { AppShell } from './AppShell';
import { MOBILE_STYLE_ID, MobileShell } from './MobileShell';
import { bottomNavItems, fabTargetFor, isTopLevelPath, moreNavItems, navSectionOf } from './mobile-nav';

const en = trWith('en');

/** The shell around a page that shows the current path and its search string. */
function Page() {
  return (
    <Routes>
      <Route path="*" element={<LocationDisplay />} />
    </Routes>
  );
}

function renderShell(options: ProviderOptions = {}, onShowShortcuts?: () => void) {
  return renderWithProviders(
    <MobileShell onShowShortcuts={onShowShortcuts}>
      <Page />
    </MobileShell>,
    { auth: 'authenticated', locale: 'en', ...options },
  );
}

const bottomNav = () => screen.getByRole('navigation', { name: en('shell.mainNavLabel') });
const moreButton = () => within(bottomNav()).getByRole('button', { name: en('mobile.nav.more') });
const sheet = () => screen.getByRole('dialog', { name: en('mobile.nav.more') });

afterEach(() => {
  __resetBackHandlerForTests();
  vi.unstubAllGlobals();
});

describe('mobile navigation definitions', () => {
  it('splits the shared navigation items between the bottom bar and the "More" sheet', () => {
    expect(bottomNavItems().map((i) => i.path)).toEqual(['/', '/diary', '/calendar', '/habits']);
    expect(moreNavItems().map((i) => i.path)).toEqual(['/insights', '/stats', '/search', '/backup', '/settings']);
    // A guest has nothing to back up.
    expect(moreNavItems(true).map((i) => i.path)).toEqual(['/insights', '/stats', '/search', '/settings']);
  });

  it('knows the top-level pages, the section of a page and where the floating button leads', () => {
    expect(isTopLevelPath('/', false)).toBe(true);
    expect(isTopLevelPath('/login', false)).toBe(false);
    expect(isTopLevelPath('/diary', true)).toBe(true);
    expect(isTopLevelPath('/diary', false)).toBe(false);
    expect(isTopLevelPath('/settings', true)).toBe(false);

    expect(navSectionOf('/')).toBe('/');
    expect(navSectionOf('/entry/12')).toBe('/diary');
    expect(navSectionOf('/day/2026-09-30')).toBe('/diary');
    expect(navSectionOf('/new')).toBe('/diary');
    expect(navSectionOf('/calendar')).toBe('/calendar');
    expect(navSectionOf('/settings')).toBe('more');
    expect(navSectionOf('/nowhere')).toBeNull();

    expect(fabTargetFor('/')).toBe('/new');
    expect(fabTargetFor('/diary')).toBe('/new');
    expect(fabTargetFor('/day/2026-09-30')).toBe('/new?date=2026-09-30');
    expect(fabTargetFor('/day/not-a-date')).toBeNull();
    expect(fabTargetFor('/calendar')).toBeNull();
    expect(fabTargetFor('/new')).toBeNull();
  });
});

describe('MobileShell', () => {
  it('signed in on Home: app bar with the page title and today\'s date, five destinations, the floating button', () => {
    renderShell();

    const bar = screen.getByRole('banner');
    expect(within(bar).getByText(en('shell.route.home'))).toBeInTheDocument();
    const time = within(bar).getByText(formatFullDate(todayIso()));
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', todayIso());
    // Home is a top-level destination: no back arrow.
    expect(within(bar).queryByRole('button', { name: en('shell.back') })).not.toBeInTheDocument();

    const nav = bottomNav();
    const items = within(nav).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      en('shell.nav.home'),
      en('shell.nav.diary'),
      en('shell.nav.calendar'),
      en('shell.nav.habits'),
      en('mobile.nav.more'),
    ]);
    expect(within(nav).getByRole('link', { name: en('shell.nav.home') })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: en('shell.nav.diary') })).not.toHaveAttribute('aria-current');
    const more = moreButton();
    expect(more).toHaveAttribute('aria-haspopup', 'dialog');
    expect(more).toHaveAttribute('aria-expanded', 'false');

    expect(screen.getByRole('link', { name: en('shell.nav.newEntry') })).toHaveAttribute('href', '/new');
    // One main landmark with the id the skip link and the lock screen rely on.
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(document.getElementById('app-root')).toHaveAttribute('data-bottom-nav', 'true');
    expect(document.getElementById('app-root')).toHaveAttribute('data-fab', 'true');
  });

  it('labels follow the UI language (shared navigation definitions)', () => {
    renderShell({ locale: 'de' });
    const de = trWith('de');
    const nav = screen.getByRole('navigation', { name: de('shell.mainNavLabel') });
    expect(within(nav).getByRole('link', { name: de('shell.nav.diary') })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: de('mobile.nav.more') })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: de('shell.nav.newEntry') })).toBeInTheDocument();
  });

  it('navigates between the destinations and moves aria-current', async () => {
    const { user } = renderShell();
    await user.click(within(bottomNav()).getByRole('link', { name: en('shell.nav.diary') }));
    await waitFor(() => expect(currentPath()).toBe('/diary'));
    expect(within(bottomNav()).getByRole('link', { name: en('shell.nav.diary') })).toHaveAttribute('aria-current', 'page');
    expect(within(bottomNav()).getByRole('link', { name: en('shell.nav.home') })).not.toHaveAttribute('aria-current');
    expect(within(screen.getByRole('banner')).getByText(en('shell.route.diary'))).toBeInTheDocument();
    // The diary keeps the floating button; the calendar has none.
    expect(screen.getByRole('link', { name: en('shell.nav.newEntry') })).toBeInTheDocument();
    await user.click(within(bottomNav()).getByRole('link', { name: en('shell.nav.calendar') }));
    await waitFor(() => expect(currentPath()).toBe('/calendar'));
    expect(screen.queryByRole('link', { name: en('shell.nav.newEntry') })).not.toBeInTheDocument();
    expect(document.getElementById('app-root')).not.toHaveAttribute('data-fab');
  });

  it('on a day page the floating button opens an entry for that day', () => {
    renderShell({ route: '/day/2026-09-30' });
    expect(screen.getByRole('link', { name: en('shell.nav.newEntry') })).toHaveAttribute('href', '/new?date=2026-09-30');
    // A day belongs to the diary section, but it is not the diary page itself.
    const diary = within(bottomNav()).getByRole('link', { name: en('shell.nav.diary') });
    expect(diary).toHaveClass('bottom-nav__link--active');
    expect(diary).not.toHaveAttribute('aria-current');
  });

  it('"More" opens a modal sheet with the remaining pages and Log out; the focus moves in and comes back', async () => {
    const { user } = renderShell();
    const more = moreButton();
    await user.click(more);

    const dialog = sheet();
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(more).toHaveAttribute('aria-controls', dialog.id);
    expect(within(dialog).getAllByRole('link').map((a) => a.textContent)).toEqual([
      en('shell.nav.insights'),
      en('shell.nav.stats'),
      en('shell.nav.search'),
      en('shell.nav.backup'),
      en('shell.nav.settings'),
    ]);
    expect(within(dialog).getByRole('button', { name: en('shell.logout') })).toBeInTheDocument();
    // No shortcut hints on a touch screen (matchMedia reports no fine pointer in the tests).
    expect(within(dialog).queryByRole('button', { name: en('shell.shortcuts') })).not.toBeInTheDocument();
    // The focus is inside the sheet: on its first entry.
    expect(within(dialog).getByRole('link', { name: en('shell.nav.insights') })).toHaveFocus();

    // The system Back button closes the sheet (the same `cancel` the Escape key sends).
    let result = '';
    act(() => {
      result = handleBack();
    });
    expect(result).toBe('closed-dialog');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).toHaveFocus();
    expect(currentPath()).toBe('/');
  });

  it('a page of the sheet opens, the sheet closes, and the app bar gets a back arrow that returns', async () => {
    const { user } = renderShell();
    await user.click(moreButton());
    await user.click(within(sheet()).getByRole('link', { name: en('shell.nav.settings') }));
    await waitFor(() => expect(currentPath()).toBe('/settings'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const bar = screen.getByRole('banner');
    expect(within(bar).getByText(en('shell.route.settings'))).toBeInTheDocument();
    expect(moreButton()).toHaveClass('bottom-nav__link--active');
    // Not Home: no date subtitle, no floating button.
    expect(within(bar).queryByText(formatFullDate(todayIso()))).not.toBeInTheDocument();

    await user.click(within(bar).getByRole('button', { name: en('shell.back') }));
    await waitFor(() => expect(currentPath()).toBe('/'));
  });

  it('marks the current page inside the sheet', async () => {
    const { user } = renderShell({ route: '/stats' });
    await user.click(moreButton());
    expect(within(sheet()).getByRole('link', { name: en('shell.nav.stats') })).toHaveAttribute('aria-current', 'page');
    expect(within(sheet()).getByRole('link', { name: en('shell.nav.search') })).not.toHaveAttribute('aria-current');
  });

  it('Log out asks first and then signs out', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const { user } = renderShell({ authOverrides: { logout } });
    await user.click(moreButton());
    await user.click(within(sheet()).getByRole('button', { name: en('shell.logout') }));
    expect(logout).not.toHaveBeenCalled();

    const question = await screen.findByRole('dialog', { name: en('shell.logout') });
    expect(within(question).getByText(en('settings.account.logoutQuestion'))).toBeInTheDocument();
    await user.click(within(question).getByRole('button', { name: en('shell.logout') }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  it('offers "Keyboard shortcuts" in the sheet only with a hardware keyboard and pointer', async () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('pointer: fine'),
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );
    vi.stubGlobal('__MOBILE__', true);
    const onShowShortcuts = vi.fn();
    const { user } = renderShell({}, onShowShortcuts);
    await user.click(moreButton());
    await user.click(within(sheet()).getByRole('button', { name: en('shell.shortcuts') }));
    expect(onShowShortcuts).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    matchMedia.mockRestore();
  });

  it('anonymous: only the app bar - brand on the welcome page, back arrow on the login page', async () => {
    const first = renderShell({ auth: 'anonymous' });
    const bar = screen.getByRole('banner');
    const brand = within(bar).getByText('Your Personal Diary');
    expect(brand).toHaveAttribute('lang', 'en');
    expect(within(bar).queryByRole('button', { name: en('shell.back') })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: en('shell.nav.newEntry') })).not.toBeInTheDocument();
    expect(document.getElementById('app-root')).not.toHaveAttribute('data-bottom-nav');
    first.unmount();

    const { user } = renderShell({ auth: 'anonymous', route: '/login' });
    expect(within(screen.getByRole('banner')).getByText(en('shell.route.login'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: en('shell.back') }));
    await waitFor(() => expect(currentPath()).toBe('/'));
  });

  it.each<[Locale, 'back' | 'forward', 'ltr' | 'rtl']>([
    ['en', 'back', 'ltr'],
    ['he', 'forward', 'rtl'],
    ['ar', 'forward', 'rtl'],
  ])('%s: the back arrow points toward the reading start (%s arrow)', (locale, icon) => {
    renderShell({ locale, route: '/settings' });
    const tr = trWith(locale);
    const back = screen.getByRole('button', { name: tr('shell.back') });
    expect(back.querySelector('svg')).toHaveAttribute('data-icon', icon);
    expect(back.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // The arrow is the first element of the bar: the inline-start side (the right edge in RTL).
    expect(screen.getByRole('banner').querySelector('.top-bar__inner')?.firstElementChild).toBe(back);
    // The whole shell is in the language: navigation name, destinations, "More".
    const nav = screen.getByRole('navigation', { name: tr('shell.mainNavLabel') });
    expect(within(nav).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      tr('shell.nav.home'),
      tr('shell.nav.diary'),
      tr('shell.nav.calendar'),
      tr('shell.nav.habits'),
      tr('mobile.nav.more'),
    ]);
    expect(within(screen.getByRole('banner')).getByText(tr('shell.route.settings'))).toBeInTheDocument();
  });

  it('marks <html> for the phone stylesheet while mounted and adds the stylesheet once', () => {
    expect(document.documentElement).not.toHaveClass(MOBILE_UI_CLASS);
    const first = renderShell();
    expect(document.documentElement).toHaveClass(MOBILE_UI_CLASS);
    expect(document.querySelectorAll(`style#${MOBILE_STYLE_ID}`)).toHaveLength(1);
    first.unmount();
    expect(document.documentElement).not.toHaveClass(MOBILE_UI_CLASS);
    renderShell();
    expect(document.querySelectorAll(`style#${MOBILE_STYLE_ID}`)).toHaveLength(1);
  });

  it('the system Back button goes through the router: back to Home, then out of the app', async () => {
    renderShell({ route: '/settings' });
    let result = '';
    act(() => {
      result = handleBack();
    });
    expect(result).toBe('navigated');
    await waitFor(() => expect(currentPath()).toBe('/'));
    act(() => {
      result = handleBack();
    });
    expect(result).toBe('exit');
    expect(currentPath()).toBe('/');
  });

  describe('tour mode (guest)', () => {
    const guest = { ...sampleUser, id: 'g_1', username: '_guest_1', firstName: '', lastName: '', email: '', guest: true };

    it('shows the banner once, as a status outside the pages, on every page', async () => {
      const { user } = renderShell({ user: guest });
      const banner = screen.getByText(en('mobile.guest.banner'));
      expect(banner).toHaveAttribute('role', 'status');
      expect(screen.getByRole('main')).not.toContainElement(banner);
      expect(screen.getByRole('button', { name: en('mobile.guest.createAccount') })).toBeInTheDocument();

      await user.click(within(bottomNav()).getByRole('link', { name: en('shell.nav.diary') }));
      await waitFor(() => expect(currentPath()).toBe('/diary'));
      // The very same element: it was not rebuilt (and so not announced again) by the navigation.
      expect(screen.getByText(en('mobile.guest.banner'))).toBe(banner);
    });

    it('a real account has no banner', () => {
      renderShell();
      expect(screen.queryByText(en('mobile.guest.banner'))).not.toBeInTheDocument();
    });

    it('"Create an account" ends the guest and opens the registration page', async () => {
      const logout = vi.fn().mockResolvedValue(undefined);
      const { user } = renderShell({ user: guest, route: '/diary', authOverrides: { logout } });
      await user.click(screen.getByRole('button', { name: en('mobile.guest.createAccount') }));
      await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(currentPath()).toBe('/register'));
    });

    it('the sheet has no Backup, and "End the tour" ends it at once', async () => {
      const logout = vi.fn().mockResolvedValue(undefined);
      const { user } = renderShell({ user: guest, authOverrides: { logout } });
      await user.click(moreButton());
      const dialog = sheet();
      expect(within(dialog).queryByRole('link', { name: en('shell.nav.backup') })).not.toBeInTheDocument();
      expect(within(dialog).getByRole('link', { name: en('shell.nav.settings') })).toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: en('shell.logout') })).not.toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: en('mobile.guest.endTour') }));
      await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    });
  });
});

describe('AppShell switch', () => {
  it('desktop / browser build: the desktop frame, nothing of the phone shell', () => {
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
      { auth: 'authenticated', locale: 'en' },
    );
    expect(screen.getByRole('link', { name: 'Your Personal Diary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en('shell.menu') })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(document.querySelector('.bottom-nav')).toBeNull();
    expect(document.querySelector('.top-bar')).toBeNull();
    expect(document.documentElement).not.toHaveClass(MOBILE_UI_CLASS);
  });

  it('Android build: the phone shell replaces header, navigation bar and footer', () => {
    vi.stubGlobal('__MOBILE__', true);
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
      { auth: 'authenticated', locale: 'en' },
    );
    expect(document.querySelector('.bottom-nav')).not.toBeNull();
    expect(document.querySelector('.top-bar')).not.toBeNull();
    expect(screen.queryByRole('button', { name: en('shell.menu') })).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(document.documentElement).toHaveClass(MOBILE_UI_CLASS);
  });
});
