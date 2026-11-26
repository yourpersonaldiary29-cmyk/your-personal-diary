/**
 * Page frame of the phone app (the Android and iPhone build; AppShell.tsx switches to it):
 *
 *   skip link
 *   top app bar            back arrow, page title, today's date on Home, "Menu"   (TopAppBar)
 *   tour banner            only for the guest of the tour mode                   (GuestBanner)
 *   <main id="main">       the routes
 *   floating "New entry"   on Home, My diary and a day page                      (Fab)
 *   the menu               a panel from the top: Home, My diary, Calendar, Habits, Insights,
 *                          Statistics, Search, Backup, Settings, Log out          (MainMenu)
 *
 * Owner's decision of 2026-11-25: the menu is at the TOP - the bottom bar and its folded "More" sheet
 * are gone, every option stands in the one menu, and the "Menu" button is in the app bar from the
 * first screen on.
 *
 * The "Menu" button, the floating button and the menu exist only with a session; the welcome, login
 * and registration screens get the app bar alone.
 *
 * While mounted the shell
 *   - holds the phone setup of the document (useMobileDocument.ts): the phone stylesheet
 *     (src/styles/mobile.css), added before the first paint, and the class 'platform-mobile' (plus
 *     'platform-android' / 'platform-ios' inside the native app) on <html> - every rule of
 *     src/styles/mobile.css hangs on it. src/App.tsx holds the same setup for the whole app, so the
 *     "Update needed" screen, rendered instead of this shell, keeps it too;
 *   - routes the system Back button through the router (src/utils/back-handler.ts).
 * The wrapper keeps the id "app-root" (the lock screen marks it inert) and <main> keeps the id
 * "main" (skip link, focus after unlocking), exactly like the desktop frame.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SkipLink } from '@/components/a11y/SkipLink';
import { GuestBanner } from '@/components/GuestBanner';
import { PATHS } from '@/constants/routes';
import { isGuestUser, useAuth } from '@/context/AuthContext';
import { useLock } from '@/context/LockContext';
import { setBackNavigator } from '@/utils/back-handler';
import { canGoBack } from '@/utils/navigation';
import type { AppShellProps } from './AppShell';
import { Fab } from './Fab';
import { MainMenu } from './MainMenu';
import { APP_ROOT_ID, MAIN_ID } from './shell-ids';
import { fabTargetFor } from './mobile-nav';
import { TopAppBar } from './TopAppBar';
import { useMobileDocument } from './useMobileDocument';

export { MOBILE_STYLE_ID } from './useMobileDocument';

export function MobileShell({ children, onShowShortcuts }: AppShellProps) {
  const { status, user } = useAuth();
  const { locked } = useLock();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const authenticated = status === 'authenticated' && !!user;
  const guest = authenticated && isGuestUser(user);
  const showFab = authenticated && fabTargetFor(location.pathname) !== null;

  useMobileDocument();

  // The system Back button navigates through the router while the shell is mounted.
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  useEffect(() => {
    setBackNavigator({
      canGoBack,
      back: () => navigate(-1),
      isHome: () => pathRef.current === PATHS.home,
      goHome: () => navigate(PATHS.home, { replace: true }),
    });
    return () => setBackNavigator(null);
  }, [navigate]);

  // The menu never outlives the page it was opened on, the session or an unlocked diary.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, authenticated, locked]);

  return (
    <>
      <div id={APP_ROOT_ID} className="app-root mobile-shell" data-fab={showFab ? 'true' : undefined}>
        <SkipLink targetId={MAIN_ID} />
        <div className="mobile-shell__top">
          <TopAppBar
            onMenu={authenticated ? () => setMenuOpen(true) : undefined}
            menuOpen={menuOpen}
            menuButtonRef={menuButtonRef}
          />
          {guest && <GuestBanner />}
        </div>
        <main id={MAIN_ID} tabIndex={-1} className="main">
          {children}
        </main>
        {authenticated && (
          // Fixed to the bottom edge, above the gesture bar: the floating "New entry" button.
          <div className="mobile-shell__bottom">{showFab && <Fab />}</div>
        )}
      </div>
      {authenticated && <MainMenu open={menuOpen} onClose={() => setMenuOpen(false)} onShowShortcuts={onShowShortcuts} />}
    </>
  );
}

export default MobileShell;
