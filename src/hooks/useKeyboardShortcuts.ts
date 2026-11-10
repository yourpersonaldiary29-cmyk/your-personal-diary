/**
 * Global keyboard shortcuts (documented in constants/shortcuts.ts):
 *   Alt+1..9, Alt+0  navigate in NAV_ITEMS order (auth-only items need a session)
 *   Ctrl+N           new entry           Ctrl+K   smart search
 *   Ctrl+L           lock the diary      Alt+←    back
 *   Shift+?          shortcuts dialog
 * Plain keys ("?") are ignored while typing in a field; Ctrl/Alt combos always
 * work. AltGr (Ctrl+Alt) is left alone so Hebrew/European layouts can type.
 * Mac app only: Option is the Mac's AltGr, so inside a field Option+digit types
 * the layout's character ("¡", "™"; "[" and "{" on a German keyboard) and
 * Option+← moves the caret one word back - macOS keeps those keys there, and
 * ⌥1..⌥0 / ⌥← navigate everywhere else (Command counts as Ctrl everywhere).
 * Navigation honours the unsaved-changes guard.
 *
 * Phone app: the shortcuts keep working for a Bluetooth keyboard (Shift+? still opens the list),
 * but nothing on a touch screen hints at them: the phone shell offers "Keyboard shortcuts" in its
 * "More" sheet only where `shortcutHintsAvailable()` says a keyboard and a pointer are in use.
 * The guest of the tour mode cannot lock the diary (there is no password to unlock it): Ctrl+L does
 * nothing for a guest.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '@shared/constants';
import { PATHS } from '@/constants/routes';
import { isGuestUser, useAuth } from '@/context/AuthContext';
import { useLock } from '@/context/LockContext';
import { isMacApp } from '@/offline/session';
import { isMobileUi } from '@/utils/mobile-ui';
import { canGoBack } from '@/utils/navigation';
import { confirmNavigation, hasActiveLeaveGuard } from './useUnsavedChangesGuard';

export interface KeyboardShortcutOptions {
  /** Opens the "Keyboard shortcuts" dialog (Shift+?). */
  onShowShortcuts?: () => void;
  /** Default true. */
  enabled?: boolean;
}

/** True when the key event originates from a text-editing element. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable === true || el.closest('[contenteditable=""], [contenteditable="true"]') !== null;
}

/**
 * Whether the UI may point at keyboard shortcuts (the "Keyboard shortcuts" button, hints): always on
 * the desktop and in a browser; in the phone app only on a device whose primary input is not the
 * touch screen (a tablet with a keyboard and a mouse / trackpad).
 */
export function shortcutHintsAvailable(): boolean {
  if (!isMobileUi()) return true;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/** Digit pressed with Alt, from `key` or `code` (layout independent). */
function altDigit(e: KeyboardEvent): string | null {
  if (/^[0-9]$/.test(e.key)) return e.key;
  const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
  return m ? m[1] : null;
}

export function useKeyboardShortcuts({ onShowShortcuts, enabled = true }: KeyboardShortcutOptions = {}): void {
  const navigate = useNavigate();
  const { status, user } = useAuth();
  const { lock, locked } = useLock();
  const guest = isGuestUser(user);
  const latest = useRef({ navigate, status, lock, locked, onShowShortcuts, guest });
  latest.current = { navigate, status, lock, locked, onShowShortcuts, guest };

  useEffect(() => {
    if (!enabled) return;

    const go = (target: string | -1) => {
      const run = () => {
        if (target === -1) latest.current.navigate(-1);
        else latest.current.navigate(target);
      };
      // Synchronous when no form is dirty; otherwise ask first.
      if (!hasActiveLeaveGuard()) {
        run();
        return;
      }
      void confirmNavigation().then((ok) => {
        if (ok) run();
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const { status: authStatus, lock: doLock, locked: isLocked, onShowShortcuts: showShortcuts, guest: isGuest } = latest.current;
      if (isLocked) return;
      const authenticated = authStatus === 'authenticated';
      const ctrl = e.ctrlKey || e.metaKey;
      const altGr = e.ctrlKey && e.altKey;
      if (altGr) return;

      // Alt + digit -> navigation
      if (e.altKey && !ctrl && !e.shiftKey) {
        // Mac app, typing in a field: Option+digit / Option+← are macOS's (a character, a word back).
        if (isEditableTarget(e.target) && isMacApp()) return;
        const digit = altDigit(e);
        if (digit !== null) {
          const item = NAV_ITEMS.find((n) => n.key === digit);
          if (!item) return;
          if (item.requiresAuth && !authenticated) return;
          e.preventDefault();
          go(item.path);
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          go(canGoBack() ? -1 : PATHS.home);
          return;
        }
        return;
      }

      // Ctrl combos
      if (ctrl && !e.altKey && !e.shiftKey) {
        const key = e.key.toLowerCase();
        if (key === 'n' && authenticated) {
          e.preventDefault();
          go(PATHS.newEntry);
        } else if (key === 'k' && authenticated) {
          e.preventDefault();
          go(PATHS.search);
        } else if (key === 'l' && authenticated && !isGuest) {
          e.preventDefault();
          doLock();
        }
        return;
      }

      // Plain keys: never while typing.
      if (isEditableTarget(e.target)) return;
      if (e.key === '?' && !ctrl && !e.altKey) {
        e.preventDefault();
        showShortcuts?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
