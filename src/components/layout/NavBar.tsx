/**
 * Main navigation: <nav aria-label="Main navigation"> with the list of NavLinks in NAV_ITEMS order
 * (labels in the current language). Anonymous visitors also get "Sign up" and "Log in" - a second,
 * two-item list at the end of the row, so the page links wrap on their own and the two account links
 * always stay together. Signed in, the row holds the page links only: the greeting sentence lives in
 * the header (Greeting.tsx), where it cannot push a page link onto a second line.
 * On narrow screens a "Menu" button (aria-expanded / aria-controls) shows and hides the lists; Escape
 * closes them and returns focus to the button. Link clicks honour the unsaved-changes guard.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '@shared/constants';
import { T } from '@/constants/texts';
import { PATHS, navItemLabel } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { NARROW_SCREEN_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { confirmNavigation, hasActiveLeaveGuard } from '@/hooks/useUnsavedChangesGuard';
import { cx } from '@/components/ui/cx';

export const NAV_LIST_ID = 'main-nav-list';
/** The "Sign up" / "Log in" list of an anonymous visitor (shown and hidden with the main list). */
export const NAV_AUTH_LIST_ID = 'main-nav-auth';

export function NavBar() {
  const { status, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const narrow = useMediaQuery(NARROW_SCREEN_QUERY);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const authenticated = status === 'authenticated' && !!user;

  // Close the menu after navigating.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const onLinkClick = (e: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (!hasActiveLeaveGuard()) return; // normal <a> navigation
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    void confirmNavigation().then((ok) => {
      if (ok) navigate(to);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && narrow && open) {
      e.preventDefault();
      setOpen(false);
      toggleRef.current?.focus();
    }
  };

  const renderLink = (to: string, label: string, accent = false) => (
    <NavLink
      to={to}
      end={to === PATHS.home}
      className={({ isActive }) => cx('nav__link', accent && 'nav__link--accent', isActive && 'nav__link--active')}
      onClick={(e) => onLinkClick(e, to)}
    >
      {label}
    </NavLink>
  );

  const collapsed = narrow && !open;

  return (
    <nav className="nav" aria-label={T.mainNavLabel} onKeyDown={onKeyDown}>
      <div className="nav__inner">
        <button
          ref={toggleRef}
          type="button"
          className="btn btn--secondary nav__toggle"
          aria-expanded={open}
          aria-controls={authenticated ? NAV_LIST_ID : `${NAV_LIST_ID} ${NAV_AUTH_LIST_ID}`}
          onClick={() => setOpen((v) => !v)}
        >
          {T.menu}
        </button>
        <ul className="nav__list" id={NAV_LIST_ID} hidden={collapsed}>
          {NAV_ITEMS.map((item) => (
            <li className="nav__item" key={item.path}>
              {renderLink(item.path, navItemLabel(item))}
            </li>
          ))}
        </ul>
        {!authenticated && (
          <ul className="nav__list nav__list--auth" id={NAV_AUTH_LIST_ID} hidden={collapsed}>
            <li className="nav__item">{renderLink(PATHS.register, T.register, true)}</li>
            <li className="nav__item">{renderLink(PATHS.login, T.login, true)}</li>
          </ul>
        )}
      </div>
    </nav>
  );
}
