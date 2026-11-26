/**
 * Top app bar of the phone shell (the page's banner landmark):
 *   - a back arrow on the inline-start side (the right edge in Hebrew and Arabic, where the arrow
 *     itself points right) on every page that is not a top-level destination; it goes back in
 *     history, or home when there is nothing behind the page, and honours the unsaved-changes guard;
 *   - the page title from the route table (the brand name on the welcome page);
 *   - on the home page of a signed-in user, today's date as the subtitle;
 *   - with a session (a signed-in user, or a guest in the tour), the "Menu" button on the inline-end
 *     side (the left edge in Hebrew and Arabic, opposite the back arrow): an icon AND the visible word
 *     "Menu", so it is seen at once when the app opens (owner's decision of 2026-11-25). It opens the
 *     menu with every destination (MainMenu.tsx). The word is never cut: the title beside it is the
 *     part that shortens with an ellipsis (mobile.css).
 * The title here is not a heading: every page keeps its own <h1>.
 */
import type { RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PATHS, findRoute, notFoundTitle } from '@/constants/routes';
import { T } from '@/constants/texts';
import { useAuth } from '@/context/AuthContext';
import { confirmNavigation, hasActiveLeaveGuard } from '@/hooks/useUnsavedChangesGuard';
import { dir } from '@/i18n/runtime';
import { canGoBack } from '@/utils/navigation';
import { MAIN_MENU_ID } from './MainMenu';
import { ShellIcon, isTopLevelPath } from './mobile-nav';
import { TodayDate } from './TodayDate';

export interface TopAppBarProps {
  /** Opens the menu. Without it (no session: welcome, sign in, register) the bar has no "Menu" button. */
  onMenu?: () => void;
  /** True while the menu is open (aria-expanded of the button). */
  menuOpen?: boolean;
  menuButtonRef?: RefObject<HTMLButtonElement | null>;
}

export function TopAppBar({ onMenu, menuOpen = false, menuButtonRef }: TopAppBarProps = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { status, user } = useAuth();
  const authenticated = status === 'authenticated' && !!user;
  const atHome = location.pathname === PATHS.home;
  const brand = atHome && !authenticated;
  const title = brand ? T.appName : (findRoute(location.pathname)?.title ?? notFoundTitle());
  const showBack = !isTopLevelPath(location.pathname, authenticated);

  const goBack = () => {
    const go = () => {
      if (canGoBack()) navigate(-1);
      else navigate(PATHS.home, { replace: true });
    };
    if (!hasActiveLeaveGuard()) {
      go();
      return;
    }
    void confirmNavigation().then((ok) => {
      if (ok) go();
    });
  };

  return (
    <header className="top-bar">
      <div className="top-bar__inner">
        {showBack && (
          <button type="button" className="top-bar__back" onClick={goBack} aria-label={T.back}>
            {/* "Back" points toward the reading start: right in RTL, left in LTR. */}
            <ShellIcon name={dir() === 'rtl' ? 'forward' : 'back'} />
          </button>
        )}
        <div className="top-bar__titles">
          <p className="top-bar__title">{brand ? <bdi lang="en">{title}</bdi> : title}</p>
          {atHome && authenticated && <TodayDate className="top-bar__subtitle" />}
        </div>
        {onMenu && (
          <button
            ref={menuButtonRef}
            type="button"
            className="top-bar__menu"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls={MAIN_MENU_ID}
            onClick={onMenu}
          >
            <ShellIcon name="menu" />
            <span className="top-bar__menu-label">{T.menu}</span>
          </button>
        )}
      </div>
    </header>
  );
}
