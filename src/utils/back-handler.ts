/**
 * What the phone's hardware / gesture "Back" does, in one function for the native host to call
 * (the host listens to the system back button and calls `handleBack()`):
 *
 *   1. an open dialog or sheet is closed                          -> 'closed-dialog'
 *   2. otherwise the app goes back one page; a page with nothing
 *      behind it goes to the home page                            -> 'navigated'
 *   3. on the home page with nothing behind it                    -> 'exit' (the host minimises the app)
 *
 * Details:
 *  - Dialogs are the native <dialog> elements of src/components/a11y/Dialog.tsx. Closing sends the
 *    same `cancel` event the Escape key sends, so each dialog decides for itself (a confirmation
 *    counts as "Cancel"). The lock screen cannot be dismissed: while it is open Back answers 'exit'
 *    and nothing behind the lock moves.
 *  - Overlays that are not a <dialog> (none today) register a close function with `registerBackLayer`.
 *  - Going back honours the unsaved-changes guard exactly like the back arrow of the app bar: with a
 *    dirty form the "Unsaved changes" question opens and the page changes only after "Leave".
 *  - Navigation goes through the router while the phone shell is mounted (`setBackNavigator`);
 *    without it the browser history and the location hash are used.
 *
 * This module has no React or native dependency, so the host (and tests) can call it directly.
 */
import { confirmNavigation, hasActiveLeaveGuard } from '@/hooks/useUnsavedChangesGuard';
import { canGoBack } from './navigation';

export type BackResult = 'closed-dialog' | 'navigated' | 'exit';

/** How `handleBack` moves between pages. */
export interface BackNavigator {
  /** True when there is a page of the app to go back to. */
  canGoBack: () => boolean;
  /** Goes back one page. */
  back: () => void;
  /** True on the home page ("/"). */
  isHome: () => boolean;
  /** Replaces the current page with the home page. */
  goHome: () => void;
}

/** Class of the lock-screen dialog (src/pages/LockScreen.tsx): it is never closed by Back. */
const LOCK_DIALOG_CLASS = 'dialog--lock';

const layers: Array<() => void> = [];
let navigator: BackNavigator | null = null;

/**
 * Registers an open overlay that is not a <dialog>; `close` is called when Back should close it.
 * Returns the function that unregisters it (call it when the overlay closes).
 */
export function registerBackLayer(close: () => void): () => void {
  layers.push(close);
  return () => {
    const index = layers.lastIndexOf(close);
    if (index >= 0) layers.splice(index, 1);
  };
}

/** Routes Back through the app's router (the phone shell sets it while mounted; null restores the default). */
export function setBackNavigator(next: BackNavigator | null): void {
  navigator = next;
}

function currentHashPath(): string {
  const hash = window.location.hash.replace(/^#/, '');
  const path = hash.split('?')[0];
  return path === '' ? '/' : path;
}

/** History + location hash (the app uses a HashRouter). */
const historyNavigator: BackNavigator = {
  canGoBack,
  back: () => window.history.back(),
  isHome: () => currentHashPath() === '/',
  goHome: () => window.location.replace(`${window.location.pathname}${window.location.search}#/`),
};

/** The dialog on top: the open one that holds the focus (modal dialogs trap it), else the last in the document. */
function topmostOpenDialog(): HTMLDialogElement | null {
  const open = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'));
  if (open.length === 0) return null;
  const active = document.activeElement;
  const focused = active ? open.filter((dialog) => dialog.contains(active)) : [];
  return focused[focused.length - 1] ?? open[open.length - 1];
}

/** Handles one press of the system Back button. See the module comment. */
export function handleBack(): BackResult {
  if (typeof document === 'undefined' || typeof window === 'undefined') return 'exit';

  const dialog = topmostOpenDialog();
  if (dialog) {
    // The lock screen stays: Back leaves the app, the diary stays locked.
    if (dialog.classList.contains(LOCK_DIALOG_CLASS)) return 'exit';
    // The same event Escape sends; the Dialog component turns it into its onClose.
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    return 'closed-dialog';
  }

  const closeLayer = layers[layers.length - 1];
  if (closeLayer) {
    closeLayer();
    return 'closed-dialog';
  }

  const nav = navigator ?? historyNavigator;
  const goingBack = nav.canGoBack();
  if (!goingBack && nav.isHome()) return 'exit';
  const go = goingBack ? nav.back : nav.goHome;

  if (!hasActiveLeaveGuard()) {
    go();
    return 'navigated';
  }
  // A dirty form: ask first (the question is a dialog, so the next Back answers "Stay").
  void confirmNavigation().then((ok) => {
    if (ok) go();
  });
  return 'navigated';
}

/** Tests only: forgets the registered layers and the navigator. */
export function __resetBackHandlerForTests(): void {
  layers.length = 0;
  navigator = null;
}
