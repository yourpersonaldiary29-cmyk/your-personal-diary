/**
 * Top app bar of the phone shell (the page's banner landmark):
 *   - a back arrow on the inline-start side (the right edge in Hebrew and Arabic, where the arrow
 *     itself points right) on every page that is not a top-level destination; it goes back in
 *     history, or home when there is nothing behind the page, and honours the unsaved-changes guard;
 *   - the page title from the route table (the brand name on the welcome page);
 *   - on the home page of a signed-in user, today's date as the subtitle.
 * The title here is not a heading: every page keeps its own <h1>.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { PATHS, findRoute, notFoundTitle } from '@/constants/routes';
import { T } from '@/constants/texts';
import { useAuth } from '@/context/AuthContext';
import { confirmNavigation, hasActiveLeaveGuard } from '@/hooks/useUnsavedChangesGuard';
import { dir } from '@/i18n/runtime';
import { canGoBack } from '@/utils/navigation';
import { ShellIcon, isTopLevelPath } from './mobile-nav';
import { TodayDate } from './TodayDate';

export function TopAppBar() {
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
      </div>
    </header>
  );
}
