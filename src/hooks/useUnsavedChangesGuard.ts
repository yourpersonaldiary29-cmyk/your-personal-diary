/**
 * Unsaved-changes guard for forms.
 *
 * HashRouter has no data router, so react-router's `useBlocker` is not
 * available. Instead:
 *  - `beforeunload` warns before the window/tab closes while `dirty`.
 *  - `confirmLeave()` resolves true when the user may leave (not dirty, or
 *    confirmed in the ConfirmDialog returned as `dialog`). Pages call it
 *    before `navigate(...)` and render `{dialog}` somewhere in their tree.
 *  - The active guard is also registered globally so the NavBar links, the
 *    back button and the keyboard shortcuts ask the same question
 *    (`confirmNavigation()`), which keeps a half-written entry safe.
 */
import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { subscribe, tr } from '@/i18n/runtime';

/** Dialog texts in the current language (live ES-module bindings). */
export let UNSAVED_TITLE = tr('shell.unsaved.title');
export let UNSAVED_MESSAGE = tr('shell.unsaved.message');
export let UNSAVED_LEAVE = tr('shell.unsaved.leave');
export let UNSAVED_STAY = tr('shell.unsaved.stay');
subscribe(() => {
  UNSAVED_TITLE = tr('shell.unsaved.title');
  UNSAVED_MESSAGE = tr('shell.unsaved.message');
  UNSAVED_LEAVE = tr('shell.unsaved.leave');
  UNSAVED_STAY = tr('shell.unsaved.stay');
});

type Guard = () => Promise<boolean>;

let activeGuard: Guard | null = null;

/** True when a form with unsaved changes is currently mounted. */
export function hasActiveLeaveGuard(): boolean {
  return activeGuard !== null;
}

/**
 * Asks the active guard (if any) whether navigation may proceed.
 * Resolves true immediately when nothing is dirty.
 */
export function confirmNavigation(): Promise<boolean> {
  return activeGuard ? activeGuard() : Promise.resolve(true);
}

/** Test helper / emergency reset. */
export function clearLeaveGuard(): void {
  activeGuard = null;
}

export interface UnsavedChangesGuard {
  /** Resolves true when leaving is allowed (clean form or confirmed). */
  confirmLeave: () => Promise<boolean>;
  /** Render this once in the page; it is the confirmation dialog. */
  dialog: ReactNode;
  /** True while the confirmation dialog is open. */
  prompting: boolean;
}

export interface UnsavedChangesOptions {
  title?: string;
  message?: string;
  leaveLabel?: string;
  stayLabel?: string;
}

export function useUnsavedChangesGuard(dirty: boolean, options: UnsavedChangesOptions = {}): UnsavedChangesGuard {
  const [prompting, setPrompting] = useState(false);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const settle = useCallback((ok: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setPrompting(false);
    resolve?.(ok);
  }, []);

  const confirmLeave = useCallback((): Promise<boolean> => {
    if (!dirtyRef.current) return Promise.resolve(true);
    // A second caller while prompting shares the pending answer.
    if (resolverRef.current) {
      const previous = resolverRef.current;
      return new Promise<boolean>((resolve) => {
        resolverRef.current = (ok) => {
          previous(ok);
          resolve(ok);
        };
      });
    }
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPrompting(true);
    });
  }, []);

  // Native warning when the window closes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers need returnValue for the prompt to appear.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Global registration for links / shortcuts.
  useEffect(() => {
    if (!dirty) return;
    const guard: Guard = confirmLeave;
    activeGuard = guard;
    return () => {
      if (activeGuard === guard) activeGuard = null;
    };
  }, [dirty, confirmLeave]);

  // Resolve a pending prompt (as "stay") if the page unmounts.
  useEffect(() => () => settle(false), [settle]);

  const dialog = createElement(ConfirmDialog, {
    open: prompting,
    title: options.title ?? UNSAVED_TITLE,
    message: options.message ?? UNSAVED_MESSAGE,
    confirmLabel: options.leaveLabel ?? UNSAVED_LEAVE,
    cancelLabel: options.stayLabel ?? UNSAVED_STAY,
    danger: true,
    onConfirm: () => settle(true),
    onCancel: () => settle(false),
  });

  return { confirmLeave, dialog, prompting };
}
