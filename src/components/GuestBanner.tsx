/**
 * Banner of the tour mode (phone app): "Tour mode - nothing you write is saved. [Create an account]".
 * Shown by the phone shell above every page while the signed-in account is the temporary guest
 * (`user.guest`); renders nothing otherwise.
 *
 * The sentence is a status region that lives in the shell, outside the pages: it is announced when
 * the tour starts and not again on every navigation. "Create an account" ends the guest (a normal
 * logout: its session and its in-memory diary are dropped) and opens the registration page - without
 * the "logged out" toast: the visitor never signed in, and the registration form says where they are.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PATHS } from '@/constants/routes';
import { isGuestUser, useAuth } from '@/context/AuthContext';
import { tr } from '@/i18n/runtime';

export function GuestBanner() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!isGuestUser(user)) return null;

  const createAccount = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // logout() leaves the app on the welcome page; registration takes its place (no toast).
      await logout({ notice: 'none' });
      navigate(PATHS.register, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="guest-banner">
      <p className="guest-banner__text" role="status">
        {tr('mobile.guest.banner')}
      </p>
      <button type="button" className="btn btn--secondary guest-banner__action" aria-busy={busy || undefined} onClick={() => void createAccount()}>
        {tr('mobile.guest.createAccount')}
      </button>
    </div>
  );
}
