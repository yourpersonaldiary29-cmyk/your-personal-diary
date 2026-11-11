/**
 * Global keyboard shortcuts (documented in constants/shortcuts.ts):
 *   Alt+1..9, Alt+0  navigate in NAV_ITEMS order (auth-only items need a session)
 *   Ctrl+N           new entry           Ctrl+K   smart search
 *   Ctrl+L           lock the diary      Alt+←    back
 *   Shift+?          shortcuts dialog
 * Plain keys ("?") are ignored while typing in a field; Ctrl/Alt combos always
 * work. AltGr (Ctrl+Alt) is left alone so Hebrew/European layouts can type.
 * On a Mac (the Mac app, and since 2026-11-11 the web UI in a Mac browser too:
 * any Macintosh user agent), while the focus is in a text field
 * (`isTextEntryTarget`: not a checkbox, a slider, a date field or a list): the
 * keys macOS's text system owns there stay with macOS. Option is the Mac's
 * AltGr, so Option+digit types the layout's character ("¡", "™"; "[" and "{"
 * on a German keyboard) and Option+← moves the caret one word back; the
 * physical Control key is the text system's (Control+N the next line,
 * Control+K delete to the end of the line). ⌘N / ⌘K / ⌘L work there too,
 * ⌥1..⌥0 / ⌥← everywhere else (Command counts as Ctrl everywhere).
 * Windows Alt codes: Alt + numpad digits typed inside a field (Alt+0150 for
 * "–") are Windows' way to type a character, so numpad digits with Alt are
 * ignored there on every platform; Alt+digit on the top row still navigates.
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
import { isMacUserAgent } from '@/offline/session';
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

/** The <input> types that take typed text and have a caret (a missing or unknown type reads as "text"). */
const TEXT_INPUT_TYPES: ReadonlySet<string> = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

/**
 * True when the key event comes from a field you type text into: a <textarea>, an editable region or
 * a text-like <input> (`TEXT_INPUT_TYPES`). A checkbox, a radio button, a slider, a date or time field,
 * a file or a button input and a <select> are editable targets but not text fields.
 */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!isEditableTarget(target)) return false;
  const el = target as HTMLElement;
  if (el.tagName === 'SELECT') return false;
  if (el.tagName !== 'INPUT') return true;
  return TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
}

/** A Mac (app or browser), focus in a text field: the keys macOS's text system owns there stay with it (module comment). */
function macTextField(target: EventTarget | null): boolean {
  return isTextEntryTarget(target) && typeof navigator !== 'undefined' && isMacUserAgent(navigator.userAgent);
}

/** Alt + a numpad digit inside a field: a Windows Alt code (Alt+0150 types "–"), not a shortcut. */
function altCodeInField(e: KeyboardEvent): boolean {
  return /^Numpad[0-9]$/.test(e.code) && isEditableTarget(e.target);
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
        // A Mac, typing in a text field: Option+digit / Option+← are macOS's (a character, a word back).
        if (macTextField(e.target)) return;
        // Windows, typing in a field: Alt + numpad digits is an Alt code that types a character.
        if (altCodeInField(e)) return;
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
        // A Mac, typing in a text field: the physical Control key is macOS's (Control+N the next line,
        // Control+K delete to the end of the line); the Command key (⌘N, ⌘K, ⌘L) still works there.
        if (!e.metaKey && macTextField(e.target)) return;
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
