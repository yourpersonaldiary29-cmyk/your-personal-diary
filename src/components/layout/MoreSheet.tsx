/**
 * "More" bottom sheet of the phone shell: Insights, Statistics, Search, Backup, Settings and
 * "Log out". It is a real modal dialog (the shared Dialog on the native <dialog>): the focus is
 * trapped inside, Escape and the system Back button close it (src/utils/back-handler.ts) and the
 * focus returns to the "More" button. mobile.css lays every dialog out as a sheet at the bottom
 * edge.
 *
 * "Keyboard shortcuts" is listed only where a hardware keyboard and a pointer are in use (a tablet
 * with a keyboard): on a touch screen nothing hints at shortcuts.
 *
 * Logging out asks first, like the Account card of the settings page. A guest (tour mode) has no
 * Backup entry, and "Log out" is "End the tour" - it ends at once, there is nothing to lose; the
 * toast that follows says "The tour has ended" (AuthContext.logout knows the guest).
 */
import { useState, type MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Dialog } from '@/components/a11y/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { navItemLabel } from '@/constants/routes';
import { T } from '@/constants/texts';
import { isGuestUser, useAuth } from '@/context/AuthContext';
import { shortcutHintsAvailable } from '@/hooks/useKeyboardShortcuts';
import { confirmNavigation, hasActiveLeaveGuard } from '@/hooks/useUnsavedChangesGuard';
import { tr } from '@/i18n/runtime';
import { MORE_SHEET_ID } from './BottomNav';
import { ShellIcon, iconForPath, moreNavItems } from './mobile-nav';

export interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  /** Opens the keyboard-shortcuts dialog (offered only with a hardware keyboard). */
  onShowShortcuts?: () => void;
}

export function MoreSheet({ open, onClose, onShowShortcuts }: MoreSheetProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const guest = isGuestUser(user);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const onItemClick = (e: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    onClose();
    if (!hasActiveLeaveGuard()) return; // the link navigates
    e.preventDefault();
    void confirmNavigation().then((ok) => {
      if (ok) navigate(to);
    });
  };

  const doLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  const onLogoutClick = () => {
    onClose();
    if (guest) void doLogout();
    else setConfirmLogout(true);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} title={tr('mobile.nav.more')} id={MORE_SHEET_ID} className="dialog--sheet more-sheet">
        <ul className="more-sheet__list">
          {moreNavItems(guest).map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className="more-sheet__item"
                aria-current={location.pathname === item.path ? 'page' : undefined}
                onClick={(e) => onItemClick(e, item.path)}
              >
                <ShellIcon name={iconForPath(item.path)} />
                <span>{navItemLabel(item)}</span>
              </Link>
            </li>
          ))}
          {onShowShortcuts && shortcutHintsAvailable() && (
            <li>
              <button
                type="button"
                className="more-sheet__item"
                onClick={() => {
                  onClose();
                  onShowShortcuts();
                }}
              >
                <ShellIcon name="keyboard" />
                <span>{T.shortcuts}</span>
              </button>
            </li>
          )}
          <li>
            <button type="button" className="more-sheet__item more-sheet__item--logout" onClick={onLogoutClick}>
              <ShellIcon name="logout" />
              <span>{guest ? tr('mobile.guest.endTour') : T.logout}</span>
            </button>
          </li>
        </ul>
      </Dialog>
      <ConfirmDialog
        open={confirmLogout}
        title={T.logout}
        message={tr('settings.account.logoutQuestion')}
        confirmLabel={T.logout}
        loading={loggingOut}
        onConfirm={doLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </>
  );
}
