import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { NAV_ITEMS } from '@shared/constants';
import { T } from '@/constants/texts';
import { renderWithProviders, sampleUser } from '@/test/render';
import { NAV_AUTH_LIST_ID, NAV_LIST_ID, NavBar } from './NavBar';

describe('NavBar', () => {
  it('anonymous: shows every nav item in order plus הרשמה and התחבר', () => {
    renderWithProviders(<NavBar />, { auth: 'anonymous' });
    const nav = screen.getByRole('navigation', { name: T.mainNavLabel });
    const links = within(nav).getAllByRole('link');
    const labels = links.map((l) => l.textContent);
    expect(labels).toEqual([...NAV_ITEMS.map((i) => i.label), T.register, T.login]);
    // MemoryRouter renders plain paths (the HashRouter in the app adds "#").
    expect(within(nav).getByRole('link', { name: T.register })).toHaveAttribute('href', '/register');
    expect(within(nav).getByRole('link', { name: T.login })).toHaveAttribute('href', '/login');
    expect(within(nav).queryByText(T.greeting(sampleUser.firstName))).not.toBeInTheDocument();
  });

  it('anonymous: the two account links are a list of their own after the page links', () => {
    renderWithProviders(<NavBar />, { auth: 'anonymous' });
    const nav = screen.getByRole('navigation', { name: T.mainNavLabel });
    const [pages, account, ...rest] = within(nav).getAllByRole('list');
    expect(rest).toHaveLength(0);
    expect(pages).toHaveAttribute('id', NAV_LIST_ID);
    expect(within(pages).getAllByRole('listitem')).toHaveLength(NAV_ITEMS.length);
    expect(account).toHaveAttribute('id', NAV_AUTH_LIST_ID);
    // Together in one list, so they wrap (and are pushed to the end of the row) as a pair.
    expect(within(account).getAllByRole('link').map((l) => l.textContent)).toEqual([T.register, T.login]);
    expect(account).toHaveClass('nav__list', 'nav__list--auth');
  });

  it('authenticated: page links only - no account links and no greeting in the navigation', () => {
    renderWithProviders(<NavBar />, { auth: 'authenticated' });
    const nav = screen.getByRole('navigation', { name: T.mainNavLabel });
    expect(within(nav).queryByRole('link', { name: T.register })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: T.login })).not.toBeInTheDocument();
    expect(within(nav).getAllByRole('link')).toHaveLength(NAV_ITEMS.length);
    // One list whose items are exactly the page links: nothing else can take room in the row.
    expect(within(nav).getAllByRole('list')).toHaveLength(1);
    expect(within(nav).getAllByRole('listitem')).toHaveLength(NAV_ITEMS.length);
    for (const item of within(nav).getAllByRole('listitem')) {
      expect(within(item).getByRole('link')).toBeInTheDocument();
    }
    // The greeting sentence lives in the header (Greeting.tsx), neither in the navigation landmark
    // nor - as an earlier review found - as an item of its list.
    expect(within(nav).queryByText(T.greeting('דנה'))).not.toBeInTheDocument();
    expect(within(nav).queryByText(T.greetingShort('דנה'))).not.toBeInTheDocument();
    expect(nav.querySelector('p')).toBeNull();
  });

  it('marks the current page with aria-current', () => {
    renderWithProviders(<NavBar />, { auth: 'authenticated', route: '/diary' });
    const current = screen.getByRole('link', { name: 'היומן שלי' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'דף הבית' })).not.toHaveAttribute('aria-current');
  });

  it('has a menu toggle wired with aria-expanded / aria-controls', async () => {
    const { user } = renderWithProviders(<NavBar />, { auth: 'anonymous' });
    const toggle = screen.getByRole('button', { name: T.menu });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Anonymous: the button shows and hides both lists.
    expect(toggle).toHaveAttribute('aria-controls', `${NAV_LIST_ID} ${NAV_AUTH_LIST_ID}`);
    for (const id of [NAV_LIST_ID, NAV_AUTH_LIST_ID]) expect(document.getElementById(id)).not.toBeNull();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('signed in, the menu toggle controls the one list there is', () => {
    renderWithProviders(<NavBar />, { auth: 'authenticated' });
    expect(screen.getByRole('button', { name: T.menu })).toHaveAttribute('aria-controls', NAV_LIST_ID);
    expect(document.getElementById(NAV_AUTH_LIST_ID)).toBeNull();
  });
});
