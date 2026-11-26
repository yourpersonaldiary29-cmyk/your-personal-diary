/**
 * The phone shell (MobileShell, TopAppBar, MainMenu, Fab). Since the owner's decision of 2026-11-25
 * the menu is at the TOP: the "Menu" button of the app bar (icon and the visible word) opens ONE
 * panel with every destination; there is no bottom bar and no "More" sheet any more.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLayoutEffect } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import { LOCALE_CODES, hasMessage, type Locale } from '@shared/i18n';
import { trWith } from '@/i18n/runtime';
import { FocusHeading } from '@/components/a11y/FocusHeading';
import { clearLeaveGuard, useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { LocationDisplay, Providers, currentPath, renderWithProviders, sampleUser, type ProviderOptions } from '@/test/render';
import { __resetBackHandlerForTests, handleBack } from '@/utils/back-handler';
import { formatFullDate, todayIso } from '@/utils/dates';
import { MOBILE_UI_CLASS } from '@/utils/mobile-ui';
import { AppShell } from './AppShell';
import { MAIN_MENU_ID } from './MainMenu';
import { MOBILE_STYLE_ID, MobileShell } from './MobileShell';
import { MobileDocument } from './useMobileDocument';
import { MENU_PATHS, fabTargetFor, isTopLevelPath, menuNavItems, navSectionOf } from './mobile-nav';

const en = trWith('en');

/** A page with unsaved changes (the guard of the entry editor), with its "Leave / Stay" question. */
function DirtyPage() {
  const guard = useUnsavedChangesGuard(true);
  return (
    <>
      <LocationDisplay />
      {guard.dialog}
    </>
  );
}

/** Goes back one entry of the router's history - what the Android Back key does when there is one. */
function HistoryBack() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      test: history back
    </button>
  );
}

/** The router's navigate function, for a change of address that does not come from the menu. */
let navigateFromOutside: NavigateFunction | null = null;
function CaptureNavigate() {
  navigateFromOutside = useNavigate();
  return null;
}

/** The shell around a page that shows the current path; "/new" is a page with unsaved changes. */
function Page() {
  const location = useLocation();
  return (
    <>
      <Routes>
        <Route path="*" element={location.pathname === '/new' ? <DirtyPage /> : <LocationDisplay />} />
      </Routes>
      <HistoryBack />
      <CaptureNavigate />
    </>
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

const appBar = () => screen.getByRole('banner');
const menuButton = (label = en('shell.menu')) => within(appBar()).getByRole('button', { name: label });
const menu = (label = en('shell.menu')) => screen.getByRole('dialog', { name: label });
const menuNav = (label = en('shell.mainNavLabel')) => within(menu()).getByRole('navigation', { name: label });
const historyBack = () => screen.getByRole('button', { name: 'test: history back' });

/** The names of the destinations, in order. */
const DESTINATIONS = [
  'shell.nav.home',
  'shell.nav.diary',
  'shell.nav.calendar',
  'shell.nav.habits',
  'shell.nav.insights',
  'shell.nav.stats',
  'shell.nav.search',
  'shell.nav.backup',
  'shell.nav.settings',
];

afterEach(() => {
  __resetBackHandlerForTests();
  clearLeaveGuard();
  vi.unstubAllGlobals();
  navigateFromOutside = null;
});

describe('mobile navigation definitions', () => {
  it('one menu with every destination of the shared navigation items, in their order ("New entry" is the floating button)', () => {
    expect(MENU_PATHS).toEqual(['/', '/diary', '/calendar', '/habits', '/insights', '/stats', '/search', '/backup', '/settings']);
    expect(menuNavItems().map((i) => i.path)).toEqual([...MENU_PATHS]);
    // A guest has nothing to back up.
    expect(menuNavItems(true).map((i) => i.path)).toEqual(['/', '/diary', '/calendar', '/habits', '/insights', '/stats', '/search', '/settings']);
  });

  it('knows the top-level pages, the section of a page and where the floating button leads', () => {
    expect(isTopLevelPath('/', false)).toBe(true);
    expect(isTopLevelPath('/login', false)).toBe(false);
    expect(isTopLevelPath('/diary', false)).toBe(false);
    // Every destination of the menu is a top-level page when signed in.
    for (const path of MENU_PATHS) expect(isTopLevelPath(path, true), path).toBe(true);
    expect(isTopLevelPath('/entry/12', true)).toBe(false);
    expect(isTopLevelPath('/new', true)).toBe(false);
    expect(isTopLevelPath('/day/2026-09-30', true)).toBe(false);

    expect(navSectionOf('/')).toBe('/');
    expect(navSectionOf('/entry/12')).toBe('/diary');
    expect(navSectionOf('/entry/12/edit')).toBe('/diary');
    expect(navSectionOf('/day/2026-09-30')).toBe('/diary');
    expect(navSectionOf('/new')).toBe('/diary');
    expect(navSectionOf('/calendar')).toBe('/calendar');
    expect(navSectionOf('/settings')).toBe('/settings');
    expect(navSectionOf('/stats')).toBe('/stats');
    expect(navSectionOf('/nowhere')).toBeNull();

    expect(fabTargetFor('/')).toBe('/new');
    expect(fabTargetFor('/diary')).toBe('/new');
    expect(fabTargetFor('/day/2026-09-30')).toBe('/new?date=2026-09-30');
    expect(fabTargetFor('/day/not-a-date')).toBeNull();
    expect(fabTargetFor('/calendar')).toBeNull();
    expect(fabTargetFor('/new')).toBeNull();
  });

  it('the key of the old "More" tab is gone from all 20 catalogues', () => {
    expect(LOCALE_CODES).toHaveLength(20);
    for (const locale of LOCALE_CODES) {
      expect(hasMessage(locale, 'mobile.nav.more'), locale).toBe(false);
      // The texts the menu reuses exist in every language.
      expect(hasMessage(locale, 'shell.menu'), locale).toBe(true);
      expect(hasMessage(locale, 'shell.mainNavLabel'), locale).toBe(true);
    }
  });
});

describe('MobileShell', () => {
  it('signed in on Home: app bar with the title, today\'s date and the "Menu" button; the floating button; no bottom bar', () => {
    renderShell();

    const bar = appBar();
    expect(within(bar).getByText(en('shell.route.home'))).toBeInTheDocument();
    const time = within(bar).getByText(formatFullDate(todayIso()));
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', todayIso());
    // Home is a top-level destination: no back arrow.
    expect(within(bar).queryByRole('button', { name: en('shell.back') })).not.toBeInTheDocument();

    // "Menu": the visible word next to an icon, a button that opens a dialog.
    const button = menuButton();
    expect(button).toHaveTextContent(en('shell.menu'));
    expect(button.querySelector('.top-bar__menu-label')).toHaveTextContent(en('shell.menu'));
    const icon = button.querySelector('svg');
    expect(icon).toHaveAttribute('data-icon', 'menu');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', MAIN_MENU_ID);
    // aria-controls names an element of the page: the menu dialog (closed).
    const controlled = document.getElementById(MAIN_MENU_ID);
    expect(controlled?.tagName).toBe('DIALOG');
    expect(controlled).not.toHaveAttribute('open');
    // It is the last element of the bar: the inline-end side, opposite the back arrow.
    expect(bar.querySelector('.top-bar__inner')?.lastElementChild).toBe(button);
    // The only control of the bar on Home, so it is seen at once.
    expect(within(bar).getAllByRole('button')).toEqual([button]);

    expect(screen.getByRole('link', { name: en('shell.nav.newEntry') })).toHaveAttribute('href', '/new');
    // One main landmark with the id the skip link and the lock screen rely on.
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(document.getElementById('app-root')).toHaveAttribute('data-fab', 'true');
    // No bottom bar any more, and no navigation outside the closed menu.
    expect(document.querySelector('.bottom-nav')).toBeNull();
    expect(document.getElementById('app-root')).not.toHaveAttribute('data-bottom-nav');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByText(/^More$/)).not.toBeInTheDocument();
    // The bottom block holds only the floating button.
    const bottom = document.querySelector('.mobile-shell__bottom');
    expect(bottom?.children).toHaveLength(1);
    expect(bottom?.firstElementChild).toHaveClass('fab');
  });

  it('the "Menu" button is on every screen of a signed-in user, also on a deeper page beside the back arrow', () => {
    renderShell({ route: '/entry/12' });
    const bar = appBar();
    const back = within(bar).getByRole('button', { name: en('shell.back') });
    const button = menuButton();
    const inner = bar.querySelector('.top-bar__inner');
    expect(inner?.firstElementChild).toBe(back);
    expect(inner?.lastElementChild).toBe(button);
  });

  it('on a day page the floating button opens an entry for that day', () => {
    renderShell({ route: '/day/2026-09-30' });
    expect(screen.getByRole('link', { name: en('shell.nav.newEntry') })).toHaveAttribute('href', '/new?date=2026-09-30');
    expect(document.getElementById('app-root')).toHaveAttribute('data-fab', 'true');
  });

  it('labels follow the UI language (shared navigation definitions)', async () => {
    const { user } = renderShell({ locale: 'de' });
    const de = trWith('de');
    const button = menuButton(de('shell.menu'));
    expect(button).toHaveTextContent(de('shell.menu'));
    expect(screen.getByRole('link', { name: de('shell.nav.newEntry') })).toBeInTheDocument();
    await user.click(button);
    const nav = within(menu(de('shell.menu'))).getByRole('navigation', { name: de('shell.mainNavLabel') });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(DESTINATIONS.map((k) => de(k)));
  });

  it('"Menu" opens one modal panel with every destination in order, then Log out; the focus moves in and the Back key brings it back', async () => {
    const { user } = renderShell();
    const button = menuButton();
    await user.click(button);

    const dialog = menu();
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveClass('dialog--menu');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', dialog.id);
    // Its title is "Menu" (a heading of the dialog).
    expect(within(dialog).getByRole('heading', { level: 2, name: en('shell.menu') })).toBeInTheDocument();

    // ONE navigation landmark with all destinations.
    expect(within(dialog).getAllByRole('navigation')).toHaveLength(1);
    const links = within(menuNav()).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(DESTINATIONS.map((k) => en(k)));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([...MENU_PATHS]);
    // Every row has its icon (decorative) and its visible name.
    for (const link of links) expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // "New entry" stays the floating button, not a row.
    expect(within(dialog).queryByRole('link', { name: en('shell.nav.newEntry') })).not.toBeInTheDocument();
    // After the destinations: Log out (outside the navigation landmark).
    const logout = within(dialog).getByRole('button', { name: en('shell.logout') });
    expect(menuNav()).not.toContainElement(logout);
    expect(links[links.length - 1].compareDocumentPosition(logout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // No shortcut hints on a touch screen (matchMedia reports no fine pointer in the tests).
    expect(within(dialog).queryByRole('button', { name: en('shell.shortcuts') })).not.toBeInTheDocument();
    // The focus is inside the panel: on its first row.
    expect(within(dialog).getByRole('link', { name: en('shell.nav.home') })).toHaveFocus();

    // The system Back button closes the panel (the same `cancel` the Escape key sends).
    let result = '';
    act(() => {
      result = handleBack();
    });
    expect(result).toBe('closed-dialog');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
    expect(currentPath()).toBe('/');
  });

  it('Escape and the Close button of the panel close it, and the focus returns to "Menu"', async () => {
    const { user } = renderShell({ route: '/calendar' });
    const button = menuButton();

    await user.click(button);
    // Escape: the native <dialog> sends `cancel` (jsdom does not send it for the key itself).
    fireEvent(menu(), new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);
    await user.click(within(menu()).getByRole('button', { name: en('shell.close') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveFocus();
    expect(currentPath()).toBe('/calendar');
  });

  it('choosing a row opens the page and closes the panel; the page is top-level (no back arrow) and the Back key leads Home, then out', async () => {
    const { user } = renderShell();
    await user.click(menuButton());
    await user.click(within(menuNav()).getByRole('link', { name: en('shell.nav.settings') }));
    await waitFor(() => expect(currentPath()).toBe('/settings'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // This test page has no main heading, so the focus is back on "Menu" (the same element across the
    // change of page) - never lost to <body>. A real page's heading takes it: see the test after this one.
    expect(menuButton()).toHaveFocus();

    const bar = appBar();
    expect(within(bar).getByText(en('shell.route.settings'))).toBeInTheDocument();
    expect(within(bar).queryByRole('button', { name: en('shell.back') })).not.toBeInTheDocument();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    // Not Home: no date subtitle, no floating button.
    expect(within(bar).queryByText(formatFullDate(todayIso()))).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: en('shell.nav.newEntry') })).not.toBeInTheDocument();

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
  });

  it('after a row is chosen the focus lands on the main heading of the new page, as after every navigation of the app', async () => {
    // The real pages have a main heading that takes the focus after a navigation (FocusHeading, through
    // PageTitle); the test page of the other tests has none, which is why they find the focus on "Menu".
    function HeadingPage() {
      const location = useLocation();
      return <FocusHeading>{`page ${location.pathname}`}</FocusHeading>;
    }
    const { user } = renderWithProviders(
      <MobileShell>
        <Routes>
          <Route path="*" element={<HeadingPage />} />
        </Routes>
      </MobileShell>,
      { auth: 'authenticated', locale: 'en' },
    );
    await user.click(menuButton());
    await user.click(within(menuNav()).getByRole('link', { name: en('shell.nav.settings') }));
    const heading = await screen.findByRole('heading', { level: 1, name: 'page /settings' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The same page chosen again: there is no navigation, and the focus returns to "Menu".
    await user.click(menuButton());
    await user.click(within(menuNav()).getByRole('link', { name: en('shell.nav.settings') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(menuButton()).toHaveFocus();
  });

  it('history: from a top-level page a row replaces the current entry, so Back skips it and lands on Home', async () => {
    const { user } = renderShell({ initialEntries: ['/', '/diary'] });
    await user.click(menuButton());
    await user.click(within(menuNav()).getByRole('link', { name: en('shell.nav.calendar') }));
    await waitFor(() => expect(currentPath()).toBe('/calendar'));
    // The calendar has no floating button, and #app-root says so to the stylesheet.
    expect(screen.queryByRole('link', { name: en('shell.nav.newEntry') })).not.toBeInTheDocument();
    expect(document.getElementById('app-root')).not.toHaveAttribute('data-fab');
    await user.click(historyBack());
    // Not "/diary": the diary entry was replaced by the calendar.
    await waitFor(() => expect(currentPath()).toBe('/'));
  });

  it('history: from a deeper page a row behaves as the bottom bar did (it replaces the deeper page)', async () => {
    const { user } = renderShell({ initialEntries: ['/', '/diary', '/entry/12'] });
    await user.click(menuButton());
    await user.click(within(menuNav()).getByRole('link', { name: en('shell.nav.habits') }));
    await waitFor(() => expect(currentPath()).toBe('/habits'));
    await user.click(historyBack());
    await waitFor(() => expect(currentPath()).toBe('/diary'));
  });

  it('the unsaved-changes guard asks before a row leaves the page: Stay keeps it, Leave goes on (and replaces it)', async () => {
    const { user } = renderShell({ initialEntries: ['/', '/diary', '/new'] });
    expect(currentPath()).toBe('/new');

    await user.click(menuButton());
    await user.click(within(menuNav()).getByRole('link', { name: en('shell.nav.calendar') }));
    let question = await screen.findByRole('dialog', { name: en('shell.unsaved.title') });
    await user.click(within(question).getByRole('button', { name: en('shell.unsaved.stay') }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: en('shell.unsaved.title') })).not.toBeInTheDocument());
    expect(currentPath()).toBe('/new');
    expect(screen.queryByRole('dialog', { name: en('shell.menu') })).not.toBeInTheDocument();
    // The question gives the focus back to "Menu", not to a row of the closed menu.
    expect(menuButton()).toHaveFocus();

    await user.click(menuButton());
    await user.click(within(menuNav()).getByRole('link', { name: en('shell.nav.calendar') }));
    question = await screen.findByRole('dialog', { name: en('shell.unsaved.title') });
    await user.click(within(question).getByRole('button', { name: en('shell.unsaved.leave') }));
    await waitFor(() => expect(currentPath()).toBe('/calendar'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).not.toBe(document.body);
    expect(menuButton()).toHaveFocus();
    await user.click(historyBack());
    await waitFor(() => expect(currentPath()).toBe('/diary'));
  });

  it.each<[string, string]>([
    ['/', 'shell.nav.home'],
    ['/stats', 'shell.nav.stats'],
    ['/settings', 'shell.nav.settings'],
    // The section, not only the exact address: an entry, a day and the editor mark My diary.
    ['/entry/12', 'shell.nav.diary'],
    ['/day/2026-09-30', 'shell.nav.diary'],
    ['/new', 'shell.nav.diary'],
  ])('on %s the menu marks the row of the current section (%s)', async (route, key) => {
    const { user } = renderShell({ route });
    await user.click(menuButton());
    const current = within(menuNav())
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent)).toEqual([en(key)]);
  });

  it('Log out asks first and then signs out', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const { user } = renderShell({ authOverrides: { logout } });
    await user.click(menuButton());
    await user.click(within(menu()).getByRole('button', { name: en('shell.logout') }));
    expect(logout).not.toHaveBeenCalled();

    const question = await screen.findByRole('dialog', { name: en('shell.logout') });
    expect(within(question).getByText(en('settings.account.logoutQuestion'))).toBeInTheDocument();
    await user.click(within(question).getByRole('button', { name: en('shell.logout') }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  it('offers "Keyboard shortcuts" in the menu only with a hardware keyboard and pointer, before Log out', async () => {
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
    await user.click(menuButton());
    const buttons = within(menu()).getAllByRole('button').filter((b) => b.classList.contains('main-menu__item'));
    expect(buttons.map((b) => b.textContent)).toEqual([en('shell.shortcuts'), en('shell.logout')]);
    await user.click(within(menu()).getByRole('button', { name: en('shell.shortcuts') }));
    expect(onShowShortcuts).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    matchMedia.mockRestore();
  });

  it('closes when the address changes from outside the menu', async () => {
    const { user } = renderShell();
    await user.click(menuButton());
    expect(menu()).toHaveAttribute('open');
    act(() => {
      void navigateFromOutside?.('/calendar');
    });
    await waitFor(() => expect(currentPath()).toBe('/calendar'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: en('shell.menu') })).not.toBeInTheDocument());
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes when the session ends, and does not open again with the next session', async () => {
    const { user, rerender } = renderShell();
    await user.click(menuButton());
    expect(menu()).toHaveAttribute('open');
    const withAuth = (auth: 'authenticated' | 'anonymous') => (
      <Providers options={{ auth, locale: 'en' }}>
        <MobileShell>
          <Page />
        </MobileShell>
      </Providers>
    );
    rerender(withAuth('anonymous'));
    await waitFor(() => expect(screen.queryByRole('button', { name: en('shell.menu') })).not.toBeInTheDocument());
    rerender(withAuth('authenticated'));
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog', { name: en('shell.menu') })).not.toBeInTheDocument();
  });

  it('closes when the diary is locked', async () => {
    const { user, rerender } = renderShell();
    await user.click(menuButton());
    expect(menu()).toHaveAttribute('open');
    // The diary is locked (the lock screen covers the app): the menu does not stay open behind it.
    rerender(
      <Providers options={{ auth: 'authenticated', locale: 'en', lock: { locked: true } }}>
        <MobileShell>
          <Page />
        </MobileShell>
      </Providers>,
    );
    await waitFor(() => expect(screen.queryByRole('dialog', { name: en('shell.menu') })).not.toBeInTheDocument());
  });

  it('anonymous: only the app bar - brand on the welcome page, back arrow on the login page, never "Menu"', async () => {
    const first = renderShell({ auth: 'anonymous' });
    const bar = appBar();
    const brand = within(bar).getByText('Your Personal Diary');
    expect(brand).toHaveAttribute('lang', 'en');
    expect(within(bar).queryByRole('button', { name: en('shell.back') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en('shell.menu') })).not.toBeInTheDocument();
    expect(document.getElementById(MAIN_MENU_ID)).toBeNull();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: en('shell.nav.newEntry') })).not.toBeInTheDocument();
    first.unmount();

    for (const route of ['/login', '/register']) {
      const view = renderShell({ auth: 'anonymous', route });
      expect(screen.queryByRole('button', { name: en('shell.menu') })).not.toBeInTheDocument();
      view.unmount();
    }

    const { user } = renderShell({ auth: 'anonymous', route: '/login' });
    expect(within(appBar()).getByText(en('shell.route.login'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: en('shell.back') }));
    await waitFor(() => expect(currentPath()).toBe('/'));
  });

  it.each<[Locale, 'back' | 'forward']>([
    ['en', 'back'],
    ['he', 'forward'],
    ['ar', 'forward'],
  ])('%s: the back arrow points toward the reading start (%s arrow), "Menu" stands at the other end', async (locale, icon) => {
    const { user } = renderShell({ locale, route: '/entry/12' });
    const tr = trWith(locale);
    const back = screen.getByRole('button', { name: tr('shell.back') });
    expect(back.querySelector('svg')).toHaveAttribute('data-icon', icon);
    expect(back.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // The arrow is the first element of the bar (the inline-start side: the right edge in RTL), the
    // "Menu" button the last (the inline end: the left edge in RTL). mobile.css uses logical
    // properties only, so the order in the markup is what mirrors.
    const inner = appBar().querySelector('.top-bar__inner');
    expect(inner?.firstElementChild).toBe(back);
    const button = menuButton(tr('shell.menu'));
    expect(inner?.lastElementChild).toBe(button);
    expect(button).toHaveTextContent(tr('shell.menu'));
    // The whole shell is in the language: menu title, navigation name, destinations.
    await user.click(button);
    const nav = within(menu(tr('shell.menu'))).getByRole('navigation', { name: tr('shell.mainNavLabel') });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(DESTINATIONS.map((k) => tr(k)));
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

  it('two holders of the phone setup: the classes go only when the last one lets go', () => {
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, getPlatform: () => 'android' });
    vi.stubGlobal('__MOBILE__', true);
    const shell = renderShell();
    const other = render(<MobileDocument />);
    expect(document.documentElement).toHaveClass(MOBILE_UI_CLASS, 'platform-android');
    shell.unmount();
    expect(document.documentElement).toHaveClass(MOBILE_UI_CLASS, 'platform-android');
    expect(document.querySelectorAll(`style#${MOBILE_STYLE_ID}`)).toHaveLength(1);
    // The last holder lets go: now the classes go.
    other.unmount();
    expect(document.documentElement).not.toHaveClass(MOBILE_UI_CLASS);
    expect(document.documentElement).not.toHaveClass('platform-android');
  });

  it('the phone setup is on <html> before the first paint: a layout effect of a later sibling already sees it', () => {
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, getPlatform: () => 'android' });
    vi.stubGlobal('__MOBILE__', true);
    // A layout effect runs before the browser paints; a passive effect (useEffect) would only run after it.
    const seen: Array<{ mobile: boolean; android: boolean; styles: number }> = [];
    function LayoutProbe() {
      useLayoutEffect(() => {
        const root = document.documentElement;
        seen.push({
          mobile: root.classList.contains(MOBILE_UI_CLASS),
          android: root.classList.contains('platform-android'),
          styles: document.querySelectorAll(`style#${MOBILE_STYLE_ID}`).length,
        });
      }, []);
      return null;
    }
    const view = render(
      <>
        <MobileDocument />
        <LayoutProbe />
      </>,
    );
    expect(seen).toEqual([{ mobile: true, android: true, styles: 1 }]);
    view.unmount();
    expect(document.documentElement).not.toHaveClass(MOBILE_UI_CLASS);
  });

  it('the system Back button goes through the router: back to Home, then out of the app', async () => {
    renderShell({ route: '/entry/12' });
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

    it('shows the banner once, as a status outside the pages, on every page; the guest has the "Menu" button', async () => {
      const { user } = renderShell({ user: guest });
      const banner = screen.getByText(en('mobile.guest.banner'));
      expect(banner).toHaveAttribute('role', 'status');
      expect(screen.getByRole('main')).not.toContainElement(banner);
      expect(screen.getByRole('button', { name: en('mobile.guest.createAccount') })).toBeInTheDocument();

      await user.click(menuButton());
      await user.click(within(menuNav()).getByRole('link', { name: en('shell.nav.diary') }));
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

    it('the menu has every destination but Backup, and "End the tour" ends it at once', async () => {
      const logout = vi.fn().mockResolvedValue(undefined);
      const { user } = renderShell({ user: guest, authOverrides: { logout } });
      await user.click(menuButton());
      const dialog = menu();
      expect(within(menuNav()).getAllByRole('link').map((a) => a.textContent)).toEqual(
        DESTINATIONS.filter((k) => k !== 'shell.nav.backup').map((k) => en(k)),
      );
      expect(within(dialog).queryByRole('link', { name: en('shell.nav.backup') })).not.toBeInTheDocument();
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
    // The desktop navigation bar's own narrow-screen "Menu" disclosure (NavBar.tsx), unchanged.
    const navMenu = screen.getByRole('button', { name: en('shell.menu') });
    expect(navMenu).not.toHaveClass('top-bar__menu');
    expect(screen.getByRole('navigation', { name: en('shell.mainNavLabel') })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(document.querySelector('.bottom-nav')).toBeNull();
    expect(document.querySelector('.top-bar')).toBeNull();
    expect(document.getElementById(MAIN_MENU_ID)).toBeNull();
    expect(document.documentElement).not.toHaveClass(MOBILE_UI_CLASS);
  });

  it('phone build: the phone shell replaces header, navigation bar and footer', () => {
    vi.stubGlobal('__MOBILE__', true);
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
      { auth: 'authenticated', locale: 'en' },
    );
    expect(document.querySelector('.top-bar')).not.toBeNull();
    expect(document.querySelector('.bottom-nav')).toBeNull();
    // The one "Menu" is the phone's, in the app bar.
    expect(screen.getByRole('button', { name: en('shell.menu') })).toHaveClass('top-bar__menu');
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(document.documentElement).toHaveClass(MOBILE_UI_CLASS);
  });
});
