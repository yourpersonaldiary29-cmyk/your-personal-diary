/**
 * Accessible modal dialog built on the native <dialog> element:
 * - `showModal()` gives a real focus trap and makes the rest of the page inert.
 * - Escape (native `cancel`) and backdrop clicks call `onClose` (both optional).
 * - Focus moves to the first form field (or `initialFocusRef`) on open and
 *   returns to the element that opened the dialog on close.
 * - `aria-labelledby` points at the title; `aria-modal="true"`.
 */
import { useEffect, useId, useRef, type MouseEvent, type ReactNode, type RefObject, type SyntheticEvent } from 'react';
import { T } from '@/constants/texts';

export interface DialogProps {
  open: boolean;
  /** Called when the user asks to close (Escape, backdrop, close button). */
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Buttons rendered in the footer. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Default true. Set false for the lock screen. */
  closeOnEscape?: boolean;
  /** Default true. */
  closeOnBackdrop?: boolean;
  /** Default true - shows a "Close" button in the header. */
  showCloseButton?: boolean;
  /** Element to focus when the dialog opens (default: first field). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Default true - restore focus to the opener when closed. */
  returnFocus?: boolean;
  /** Id of an element describing the dialog (aria-describedby). */
  describedBy?: string;
  className?: string;
  id?: string;
}

const FIELD_SELECTOR =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [data-autofocus]';
const BUTTON_SELECTOR = '.dialog__body button:not([disabled]), .dialog__footer button:not([disabled]), .dialog__body a[href]';

function findInitialFocus(dialog: HTMLDialogElement): HTMLElement | null {
  return (
    dialog.querySelector<HTMLElement>(FIELD_SELECTOR) ??
    dialog.querySelector<HTMLElement>(BUTTON_SELECTOR) ??
    dialog.querySelector<HTMLElement>('.dialog__title')
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnEscape = true,
  closeOnBackdrop = true,
  showCloseButton = true,
  initialFocusRef,
  returnFocus = true,
  describedBy,
  className,
  id,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const generatedId = useId();
  const titleId = `${id ?? generatedId}-title`;

  // Open / close the native dialog in step with the `open` prop.
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open) {
      if (!dlg.open) {
        openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
        try {
          dlg.showModal();
        } catch {
          dlg.setAttribute('open', '');
        }
      }
      const target = initialFocusRef?.current ?? findInitialFocus(dlg);
      target?.focus();
      return;
    }
    if (dlg.open) dlg.close();
    restoreFocus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Restore focus when unmounted while open.
  useEffect(() => {
    return () => {
      if (openRef.current) restoreFocus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function restoreFocus() {
    if (!returnFocus) return;
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener && opener.isConnected && typeof opener.focus === 'function') {
      opener.focus();
    }
  }

  // Escape key -> native "cancel". We take control so React state stays the source of truth.
  const onCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    if (closeOnEscape) onCloseRef.current();
  };

  // Native "close" (e.g. Chrome forcing close after repeated Escape presses).
  const onNativeClose = () => {
    const dlg = ref.current;
    if (!openRef.current || !dlg) return;
    if (closeOnEscape) {
      onCloseRef.current();
    } else {
      // Not dismissable: reopen on the next frame.
      window.requestAnimationFrame(() => {
        if (openRef.current && dlg.isConnected && !dlg.open) {
          try {
            dlg.showModal();
          } catch {
            dlg.setAttribute('open', '');
          }
        }
      });
    }
  };

  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    // Clicks on the backdrop hit the <dialog> element itself; inner clicks hit the content div.
    if (closeOnBackdrop && e.target === ref.current) onCloseRef.current();
  };

  return (
    <dialog
      ref={ref}
      id={id}
      className={`dialog dialog--${size}${className ? ` ${className}` : ''}`}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      aria-modal="true"
      onCancel={onCancel}
      onClose={onNativeClose}
      onClick={onClick}
    >
      {open && (
        <div className="dialog__content">
          <div className="dialog__header">
            <h2 id={titleId} className="dialog__title" tabIndex={-1}>
              {title}
            </h2>
            {showCloseButton && (
              <button type="button" className="btn btn--ghost" onClick={() => onCloseRef.current()} aria-label={T.close}>
                <span aria-hidden="true">✕</span>
              </button>
            )}
          </div>
          <div className="dialog__body">{children}</div>
          {footer && <div className="dialog__footer">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
