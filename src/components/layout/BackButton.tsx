/**
 * "Back" button shown first in the header (right edge in RTL) on every page.
 * Goes back in history when the previous entry is inside the app, otherwise to
 * the home page. On "/" with nothing to go back to it stays visible (so the
 * layout and the tab order never change) but is marked aria-disabled and does
 * nothing. Respects the unsaved-changes guard.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { T } from '@/constants/texts';
import { PATHS } from '@/constants/routes';
import { dir } from '@/i18n/runtime';
import { confirmNavigation, hasActiveLeaveGuard } from '@/hooks/useUnsavedChangesGuard';
import { canGoBack } from '@/utils/navigation';
import { cx } from '@/components/ui/cx';

export interface BackButtonProps {
  className?: string;
  /**
   * Hide the button on the home page when there is nothing to go back to
   * (default false: the button is always rendered, disabled when it would do nothing).
   */
  hideWhenIdle?: boolean;
}

export function BackButton({ className, hideWhenIdle = false }: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasHistory = canGoBack();
  /** Nothing to go back to and already home: the button is inert. */
  const idle = location.pathname === PATHS.home && !hasHistory;
  if (hideWhenIdle && idle) return null;

  const go = () => {
    if (hasHistory) navigate(-1);
    else navigate(PATHS.home);
  };

  const onClick = () => {
    if (idle) return;
    // Synchronous when no form is dirty; otherwise ask first.
    if (!hasActiveLeaveGuard()) {
      go();
      return;
    }
    void confirmNavigation().then((ok) => {
      if (ok) go();
    });
  };

  return (
    <button
      type="button"
      className={cx('btn', 'btn--ghost', 'back-button', idle && 'back-button--idle', className)}
      onClick={onClick}
      aria-disabled={idle || undefined}
      title={idle ? T.noPreviousPage : undefined}
    >
      {/* "Back" points toward the reading start: right in RTL, left in LTR. */}
      <span aria-hidden="true">{dir() === 'rtl' ? '→' : '←'}</span>
      {T.back}
      {idle && <span className="visually-hidden"> ({T.noPreviousPage})</span>}
    </button>
  );
}
