/**
 * Bottom navigation of the phone shell: <nav aria-label="Main navigation"> with five destinations -
 * Home, My diary, Calendar, Habits (links, labels from the shared navigation definitions) and "More"
 * (a button that opens the MoreSheet dialog). The current page carries aria-current="page"; the
 * section a deeper page belongs to (an entry -> My diary, Settings -> More) is highlighted too.
 *
 * Switching between the destinations replaces the current history entry, as on Android: Back from a
 * destination leads to the home page and from there out of the app, instead of walking through every
 * tab that was visited. Link taps honour the unsaved-changes guard.
 */
import type { MouseEvent, RefObject } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { PATHS, navItemLabel } from '@/constants/routes';
import { T } from '@/constants/texts';
import { cx } from '@/components/ui/cx';
import { confirmNavigation, hasActiveLeaveGuard } from '@/hooks/useUnsavedChangesGuard';
import { tr } from '@/i18n/runtime';
import { ShellIcon, bottomNavItems, iconForPath, navSectionOf } from './mobile-nav';

/** Id of the "More" sheet dialog (aria-controls of the button). */
export const MORE_SHEET_ID = 'more-sheet';

export interface BottomNavProps {
  /** True while the "More" sheet is open. */
  moreOpen: boolean;
  /** Opens the "More" sheet. */
  onMore: () => void;
  moreButtonRef?: RefObject<HTMLButtonElement | null>;
}

export function BottomNav({ moreOpen, onMore, moreButtonRef }: BottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const section = navSectionOf(location.pathname);

  const onLinkClick = (e: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (!hasActiveLeaveGuard()) return; // the NavLink navigates (replace)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    void confirmNavigation().then((ok) => {
      if (ok) navigate(to, { replace: true });
    });
  };

  return (
    <nav className="bottom-nav" aria-label={T.mainNavLabel}>
      <ul className="bottom-nav__list">
        {bottomNavItems().map((item) => (
          <li className="bottom-nav__item" key={item.path}>
            <NavLink
              to={item.path}
              end={item.path === PATHS.home}
              replace
              className={({ isActive }) => cx('bottom-nav__link', (isActive || section === item.path) && 'bottom-nav__link--active')}
              onClick={(e) => onLinkClick(e, item.path)}
            >
              <ShellIcon name={iconForPath(item.path)} />
              <span className="bottom-nav__label">{navItemLabel(item)}</span>
            </NavLink>
          </li>
        ))}
        <li className="bottom-nav__item">
          <button
            ref={moreButtonRef}
            type="button"
            className={cx('bottom-nav__link', (moreOpen || section === 'more') && 'bottom-nav__link--active')}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-controls={MORE_SHEET_ID}
            onClick={onMore}
          >
            <ShellIcon name="more" />
            <span className="bottom-nav__label">{tr('mobile.nav.more')}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
