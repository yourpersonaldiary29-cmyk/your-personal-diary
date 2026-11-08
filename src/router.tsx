/**
 * Route table and auth guards.
 *
 * - RequireAuth: while the session is being checked shows a spinner; when
 *   anonymous on a protected route redirects to /login with a toast and
 *   remembers the requested location (`state.from`) for after login.
 * - RedirectIfAuthenticated: /login and /register send signed-in users home.
 * - /forgot-password and /reset-password are public for everyone (a signed-in
 *   device may still need them: the reset signs the account out everywhere).
 * - "/" shows the WelcomePage without a session and the HomePage with one.
 * - There is no first-run language screen on any platform (docs/android-tasks/HOSTED-IMPL.md item
 *   13): the app starts in the language src/i18n/runtime.ts resolves (on Android the phone's system
 *   language, English when the app does not have it) and Settings -> Language changes it.
 * - While the diary server has not answered yet in this run and cannot be reached (start-up,
 *   the session check), the "No connection to the diary server" page with Retry takes the place of
 *   the routes (src/context/ConnectionContext.tsx decides; once the server had answered, a lost
 *   connection shows the banner over the app instead - src/components/ConnectionBanner.tsx).
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Spinner } from '@/components/ui/Spinner';
import { PATHS, findRoute } from '@/constants/routes';
import { T } from '@/constants/texts';
import { useAuth } from '@/context/AuthContext';
import { useConnectionDisplay } from '@/context/ConnectionContext';
import { useToast } from '@/context/ToastContext';
import BackupPage from '@/pages/BackupPage';
import CalendarPage from '@/pages/CalendarPage';
import DayPage from '@/pages/DayPage';
import DiaryPage from '@/pages/DiaryPage';
import EntryPage from '@/pages/EntryPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import HabitsPage from '@/pages/HabitsPage';
import HomePage from '@/pages/HomePage';
import InsightsPage from '@/pages/InsightsPage';
import LoginPage from '@/pages/LoginPage';
import NewEntryPage from '@/pages/NewEntryPage';
import NoConnectionPage from '@/pages/NoConnectionPage';
import NotFoundPage from '@/pages/NotFoundPage';
import RegisterPage from '@/pages/RegisterPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import SearchPage from '@/pages/SearchPage';
import SettingsPage from '@/pages/SettingsPage';
import StatsPage from '@/pages/StatsPage';
import WelcomePage from '@/pages/WelcomePage';

/** Shown while `GET /api/auth/me` decides whether a stored token is valid. */
export function SessionSpinner() {
  return <Spinner label={T.loadingSession} block size="lg" />;
}

/** Redirects to /login (with the "login required" toast) remembering where the visitor wanted to go. */
function RedirectToLogin() {
  const location = useLocation();
  const toast = useToast();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast.info(T.loginRequired);
  }, [toast]);
  return <Navigate to={PATHS.login} replace state={{ from: location }} />;
}

export interface RequireAuthProps {
  children: ReactNode;
  /**
   * Force the guard regardless of ROUTE_DEFS (default: decided by
   * findRoute(pathname).requiresAuth).
   */
  required?: boolean;
}

export function RequireAuth({ children, required }: RequireAuthProps) {
  const { status, notice } = useAuth();
  const location = useLocation();
  const needsAuth = required ?? (findRoute(location.pathname)?.requiresAuth ?? false);

  // When the session ends while this page is open (logout, expiry, revoked
  // token) the auth notice already explains what happened, so redirect
  // silently instead of adding the "login required" toast: home after a
  // logout, the login page (remembering this location) otherwise.
  const lastStatus = useRef(status);
  const endedHere = useRef<null | 'logout' | 'lost'>(null);
  if (lastStatus.current === 'authenticated' && status === 'anonymous') {
    // A logout the user asked for carries `reason: 'logout'` (the message differs for the guest of
    // the tour mode); the plain "logged out" message is accepted too.
    endedHere.current = notice?.reason === 'logout' || notice?.message === T.loggedOut ? 'logout' : 'lost';
  }
  if (status === 'authenticated') endedHere.current = null;
  lastStatus.current = status;

  if (!needsAuth) return <>{children}</>;
  if (status === 'loading') return <SessionSpinner />;
  if (status !== 'authenticated') {
    if (endedHere.current === 'logout') return <Navigate to={PATHS.home} replace />;
    if (endedHere.current === 'lost') return <Navigate to={PATHS.login} replace state={{ from: location }} />;
    return <RedirectToLogin />;
  }
  return <>{children}</>;
}

/** Login/register are pointless with a session: go home (or to `state.from`). */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <SessionSpinner />;
  if (status === 'authenticated') return <Navigate to={PATHS.home} replace />;
  return <>{children}</>;
}

/** "/" = welcome page for visitors, home page for users. */
function HomeOrWelcome() {
  const { status } = useAuth();
  if (status === 'loading') return <SessionSpinner />;
  if (status === 'authenticated') return <HomePage />;
  return <WelcomePage />;
}

const guarded = (page: ReactNode) => <RequireAuth required>{page}</RequireAuth>;

/**
 * Every build (Windows app, web UI, Android app): while the server has never answered in this run
 * and cannot be reached, the connection page; then the routes.
 */
export function AppRoutes() {
  const connection = useConnectionDisplay();
  if (connection === 'page') return <NoConnectionPage />;
  return <RouteTable />;
}

function RouteTable() {
  return (
    <Routes>
      <Route path={PATHS.home} element={<HomeOrWelcome />} />
      <Route
        path={PATHS.login}
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path={PATHS.register}
        element={
          <RedirectIfAuthenticated>
            <RegisterPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route path={PATHS.forgotPassword} element={<ForgotPasswordPage />} />
      <Route path={PATHS.resetPassword} element={<ResetPasswordPage />} />
      <Route path={PATHS.newEntry} element={guarded(<NewEntryPage />)} />
      <Route path="/entry/:id" element={guarded(<EntryPage />)} />
      <Route path="/entry/:id/edit" element={guarded(<NewEntryPage />)} />
      <Route path={PATHS.diary} element={guarded(<DiaryPage />)} />
      <Route path="/day/:date" element={guarded(<DayPage />)} />
      <Route path={PATHS.calendar} element={guarded(<CalendarPage />)} />
      <Route path={PATHS.habits} element={guarded(<HabitsPage />)} />
      <Route path={PATHS.insights} element={guarded(<InsightsPage />)} />
      <Route path={PATHS.stats} element={guarded(<StatsPage />)} />
      <Route path={PATHS.search} element={guarded(<SearchPage />)} />
      <Route path={PATHS.backup} element={guarded(<BackupPage />)} />
      <Route path={PATHS.settings} element={<SettingsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
