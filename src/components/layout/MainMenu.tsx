/**
 * The menu of the phone shell (owner's decision of 2026-11-25: the bottom bar and its "More" sheet
 * are gone; ONE menu holds every option). It is opened by the "Menu" button of the top app bar
 * (TopAppBar.tsx) and drops down from the top edge of the screen, under the status bar.
 *
 * It is a real modal dialog (the shared Dialog on the native <dialog>), titled "Menu": the focus is
 * trapped inside, Escape, its Close button and the system Back button close it
 * (src/utils/back-handler.ts), and the focus returns to the "Menu" button. Inside it:
 *   - one navigation landmark ("Main navigation") with every destination, in NAV_ITEMS order: Home,
 *     My diary, Calendar, Habits, Insights, Statistics, Search, Backup (not for a guest), Settings.
 *     The row of the current section carries aria-current="page" - the section, not only the exact
 *     address: an entry page marks My diary;
 *   - "Keyboard shortcuts", listed only where a hardware keyboard and a pointer are in use (a tablet
 *     with a keyboard): on a touch screen nothing hints at shortcuts;
 *   - "Log out", which asks first, like the Account card of the settings page. For a guest (tour
 *     mode) it is "End the tour" and ends at once - there is nothing to lose; the toast that follows
 *     says "The tour has ended" (AuthContext.logout knows the guest).
 *
 * History: every destination is a top-level page, and choosing one REPLACES the current history
 * entry, exactly as the bottom bar did - so Back from any destination leads to Home and from Home out
 * of the app. Choosing a row closes the menu first; the unsaved-changes guard is honoured.
 * mobile.css (the `dialog--menu` variant) turns the phone's usual bottom sheet into a top panel.
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
import { ShellIcon, iconForPath, menuNavItems, navSectionOf } from './mobile-nav';

/** Id of the menu dialog (aria-controls of the "Menu" button). */
export const MAIN_MENU_ID = 'main-menu';

export interface MainMenuProps {
  open: boolean;
  onClose: () => void;
  /** Opens the keyboard-shortcuts dialog (offered only with a hardware keyboard). */
  onShowShortcuts?: () => void;
}

export function MainMenu({ open, onClose, onShowShortcuts }: MainMenuProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const guest = isGuestUser(user);
  const section = navSectionOf(location.pathname);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const onItemClick = (e: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    onClose();
    if (!hasActiveLeaveGuard()) return; // the link navigates (replace)
    e.preventDefault();
    // Ask only once the menu has closed and given the focus back to "Menu": the question then
    // returns the focus to that button, not to a row of the closed menu (which would drop it to <body>).
    window.setTimeout(() => {
      void confirmNavigation().then((ok) => {
        if (ok) navigate(to, { replace: true });
      });
    }, 0);
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
      <Dialog open={open} onClose={onClose} title={T.menu} id={MAIN_MENU_ID} className="dialog--menu main-menu">
        <nav className="main-menu__nav" aria-label={T.mainNavLabel}>
          <ul className="main-menu__list">
            {menuNavItems(guest).map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  replace
                  className="main-menu__item"
                  aria-current={section === item.path ? 'page' : undefined}
                  onClick={(e) => onItemClick(e, item.path)}
                >
                  <ShellIcon name={iconForPath(item.path)} />
                  <span>{navItemLabel(item)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <ul className="main-menu__list main-menu__actions">
          {onShowShortcuts && shortcutHintsAvailable() && (
            <li>
              <button
                type="button"
                className="main-menu__item"
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
            <button type="button" className="main-menu__item main-menu__item--logout" onClick={onLogoutClick}>
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
