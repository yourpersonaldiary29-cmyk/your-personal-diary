import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { T } from '@/constants/texts';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { formatHebrewDate, todayIso } from '@/utils/dates';
import { renderWithProviders } from '@/test/render';
import { Header } from './Header';

describe('Header', () => {
  // The shell strings are still Hebrew; the date follows the UI language.
  pinLocaleForTests('he');

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows today's Hebrew weekday and date in a <time> element", () => {
    renderWithProviders(<Header />, { auth: 'anonymous' });
    const iso = todayIso();
    const time = screen.getByText(formatHebrewDate(iso));
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', iso);
    expect(time).toHaveTextContent(/^יום /);
  });

  it('links the app title to the home page and hides the greeting when anonymous', () => {
    renderWithProviders(<Header />, { auth: 'anonymous', route: '/diary' });
    // MemoryRouter renders plain paths (the HashRouter in the app adds "#").
    expect(screen.getByRole('link', { name: T.appName })).toHaveAttribute('href', '/');
    expect(screen.queryByText(T.greeting('דנה'))).not.toBeInTheDocument();
    expect(screen.queryByText(T.greetingShort('דנה'))).not.toBeInTheDocument();
    expect(screen.getByRole('banner').querySelector('.header__greeting')).toBeNull();
  });

  it('shows the greeting sentence once, as plain text at the end of the row, when authenticated', () => {
    renderWithProviders(<Header />, { auth: 'authenticated' });
    const banner = screen.getByRole('banner');
    // The whole sentence the owner asked for, exactly once - there is no second, shorter greeting
    // next to it that a screen reader would read as well.
    const greetings = within(banner).getAllByText(T.greeting('דנה'));
    expect(greetings).toHaveLength(1);
    const [greeting] = greetings;
    expect(within(banner).queryByText(T.greetingShort('דנה'))).not.toBeInTheDocument();
    expect(greeting.tagName).toBe('P');
    expect(greeting).toHaveClass('header__greeting');
    // Read by assistive technology (it is the only greeting), and not a list item of anything.
    expect(greeting).not.toHaveAttribute('aria-hidden');
    expect(greeting.closest('li')).toBeNull();
    expect(greeting.closest('nav')).toBeNull();
    // Last in the row (the end side in both directions).
    expect(banner.querySelector('.header__inner')?.lastElementChild).toBe(greeting);
    // It fits (jsdom has no layout: nothing is cut), so there is no tooltip repeating the text.
    expect(greeting).not.toHaveAttribute('title');
  });

  it('gives the greeting its whole sentence as a tooltip only when it is cut with an ellipsis', () => {
    // A row too narrow for the sentence: the text is wider than the box.
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(505);
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(320);
    renderWithProviders(<Header />, { auth: 'authenticated' });
    const greeting = screen.getByText(T.greeting('דנה'));
    expect(greeting).toHaveAttribute('title', T.greeting('דנה'));
    // The text itself stays complete (the ellipsis is CSS only).
    expect(greeting).toHaveTextContent(T.greeting('דנה'));
  });

  it('renders the back button first in DOM order (right edge in RTL) on inner pages', () => {
    renderWithProviders(<Header />, { auth: 'authenticated', route: '/diary' });
    const inner = screen.getByRole('banner').querySelector('.header__inner');
    expect(inner?.firstElementChild).toHaveTextContent(T.back);
  });
});
