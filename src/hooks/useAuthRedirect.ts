/**
 * Where to go after login / registration: the page the visitor originally
 * asked for (RequireAuth stores it in `location.state.from`) or the home page.
 */
import { useCallback } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import { PATHS } from '@/constants/routes';

export interface AuthRedirect {
  /** Destination path (pathname + search + hash) or "/". */
  from: string;
  /** Navigates to `from`, replacing the login/register entry in history. */
  redirectAfterAuth: () => void;
}

/** Reads `state.from` (a Location or a path string) safely. */
export function fromLocationState(state: unknown): string {
  if (!state || typeof state !== 'object') return PATHS.home;
  const from = (state as { from?: unknown }).from;
  if (typeof from === 'string' && from.startsWith('/')) return from;
  if (from && typeof from === 'object') {
    const loc = from as Partial<Location>;
    if (typeof loc.pathname === 'string' && loc.pathname.startsWith('/')) {
      return `${loc.pathname}${loc.search ?? ''}${loc.hash ?? ''}`;
    }
  }
  return PATHS.home;
}

/** Pages that only make sense without a session - never a target after logging in. */
const AUTH_PAGES: string[] = [PATHS.login, PATHS.register, PATHS.forgotPassword, PATHS.resetPassword];

export function useAuthRedirect(): AuthRedirect {
  const location = useLocation();
  const navigate = useNavigate();
  const from = fromLocationState(location.state);
  // Never bounce back to the auth pages themselves.
  const target = AUTH_PAGES.some((page) => from === page || from.startsWith(`${page}?`)) ? PATHS.home : from;
  const redirectAfterAuth = useCallback(() => navigate(target, { replace: true }), [navigate, target]);
  return { from: target, redirectAfterAuth };
}
