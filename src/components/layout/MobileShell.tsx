/**
 * Page frame of the phone app (the Android build; AppShell.tsx switches to it):
 *
 *   skip link
 *   top app bar            back arrow, page title, today's date on Home          (TopAppBar)
 *   tour banner            only for the guest of the tour mode                   (GuestBanner)
 *   <main id="main">       the routes
 *   floating "New entry"   on Home, My diary and a day page                      (Fab)
 *   bottom navigation      Home, My diary, Calendar, Habits, More                (BottomNav)
 *   "More" sheet           Insights, Statistics, Search, Backup, Settings, Log out (MoreSheet)
 *
 * The navigation, the floating button and the sheet exist only with a session; the welcome, login
 * and registration screens get the app bar alone.
 *
 * While mounted the shell
 *   - adds the phone stylesheet (src/styles/mobile.css) to the document, before the first paint;
 *   - puts the class 'platform-mobile' (plus 'platform-android' / 'platform-ios' inside the native
 *     app) on <html>: every rule of src/styles/mobile.css hangs on it;
 *   - routes the system Back button through the router (src/utils/back-handler.ts).
 * The wrapper keeps the id "app-root" (the lock screen marks it inert) and <main> keeps the id
 * "main" (skip link, focus after unlocking), exactly like the desktop frame.
 */
import { useEffect, useInsertionEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SkipLink } from '@/components/a11y/SkipLink';
import { GuestBanner } from '@/components/GuestBanner';
import { PATHS } from '@/constants/routes';
import { isGuestUser, useAuth } from '@/context/AuthContext';
import { useLock } from '@/context/LockContext';
import { setBackNavigator } from '@/utils/back-handler';
import { MOBILE_UI_CLASS } from '@/utils/mobile-ui';
import { canGoBack } from '@/utils/navigation';
import { platformName } from '@/utils/platform';
// As a string, not as a stylesheet of the bundle: the desktop build must not carry the phone styles,
// and a tree-shaken module cannot take a CSS side effect with it. The shell adds them itself.
import mobileCss from '@/styles/mobile.css?inline';
import type { AppShellProps } from './AppShell';
import { BottomNav } from './BottomNav';
import { Fab } from './Fab';
import { MoreSheet } from './MoreSheet';
import { APP_ROOT_ID, MAIN_ID } from './shell-ids';
import { fabTargetFor } from './mobile-nav';
import { TopAppBar } from './TopAppBar';

/** Id of the <style> element holding src/styles/mobile.css. */
export const MOBILE_STYLE_ID = 'mobile-ui-styles';

/** Adds the phone stylesheet once, before the browser paints the shell (allowed by the app's CSP: style-src 'unsafe-inline'). */
function useMobileStyles(): void {
  useInsertionEffect(() => {
    if (document.getElementById(MOBILE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = MOBILE_STYLE_ID;
    style.textContent = mobileCss;
    document.head.appendChild(style);
  }, []);
}

/** Marks <html> for mobile.css while the phone shell is mounted. */
function usePlatformClass(): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const platform = platformName();
    const classes = [MOBILE_UI_CLASS, ...(platform === 'android' || platform === 'ios' ? [`platform-${platform}`] : [])];
    root.classList.add(...classes);
    return () => root.classList.remove(...classes);
  }, []);
}

export function MobileShell({ children, onShowShortcuts }: AppShellProps) {
  const { status, user } = useAuth();
  const { locked } = useLock();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const authenticated = status === 'authenticated' && !!user;
  const guest = authenticated && isGuestUser(user);
  const showFab = authenticated && fabTargetFor(location.pathname) !== null;

  useMobileStyles();
  usePlatformClass();

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

  // The sheet never outlives the page it was opened on, the session or an unlocked diary.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname, authenticated, locked]);

  return (
    <>
      <div
        id={APP_ROOT_ID}
        className="app-root mobile-shell"
        data-bottom-nav={authenticated ? 'true' : undefined}
        data-fab={showFab ? 'true' : undefined}
      >
        <SkipLink targetId={MAIN_ID} />
        <div className="mobile-shell__top">
          <TopAppBar />
          {guest && <GuestBanner />}
        </div>
        <main id={MAIN_ID} tabIndex={-1} className="main">
          {children}
        </main>
        {authenticated && (
          // One block fixed to the bottom edge: the floating button always rides on top of the
          // navigation, however tall the navigation is (long labels wrap).
          <div className="mobile-shell__bottom">
            {showFab && <Fab />}
            <BottomNav moreOpen={moreOpen} onMore={() => setMoreOpen(true)} moreButtonRef={moreButtonRef} />
          </div>
        )}
      </div>
      {authenticated && <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} onShowShortcuts={onShowShortcuts} />}
    </>
  );
}

export default MobileShell;
