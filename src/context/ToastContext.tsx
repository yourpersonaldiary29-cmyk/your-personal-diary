/**
 * Accessible toast notifications.
 *
 * - Each toast is `role="status"` (errors: `role="alert"`), so it is announced - unless the
 *   caller already announced the same text through the announcer (`{ announced: true }`): then
 *   the toast is only visual, so screen readers do not hear the message twice.
 * - Toasts stay visible for at least 8 seconds and pause while hovered/focused.
 * - Every toast has a "Close message" button for keyboard/touch dismissal.
 * - A toast belongs to the language it was written in: when the UI language changes, the toasts
 *   still on screen in the old language are dropped (they were already announced).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { T } from '@/constants/texts';
import type { Locale } from '@shared/i18n';
import { getCurrentLocale, subscribe } from '@/i18n/runtime';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastOptions {
  kind?: ToastKind;
  /** Minimum 8000ms; errors default to 12000ms. */
  durationMs?: number;
  /** The caller announced the same text itself: render without a live role (one announcement). */
  announced?: boolean;
}

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
  durationMs: number;
  announced?: boolean;
  /** UI language when the toast was shown. */
  locale: Locale;
}

export interface ToastContextValue {
  /** Shows a toast and returns its id. */
  show: (message: string, options?: ToastOptions) => number;
  info: (message: string, options?: Pick<ToastOptions, 'announced'>) => number;
  success: (message: string, options?: Pick<ToastOptions, 'announced'>) => number;
  error: (message: string, options?: Pick<ToastOptions, 'announced'>) => number;
  dismiss: (id: number) => void;
  /** Currently visible toasts (mainly for tests). */
  toasts: ToastItem[];
}

const MIN_DURATION = 8000;

const noop: ToastContextValue = {
  show: () => 0,
  info: () => 0,
  success: () => 0,
  error: () => 0,
  dismiss: () => undefined,
  toasts: [],
};

export const ToastContext = createContext<ToastContextValue>(noop);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // The provider sits outside the subtree that remounts on a language change:
  // re-render on locale changes so the region's name follows the UI language.
  const locale = useSyncExternalStore(subscribe, getCurrentLocale, getCurrentLocale);
  // Toasts written in the previous language leave with it.
  useEffect(() => {
    setToasts((list) => (list.some((t) => t.locale !== locale) ? list.filter((t) => t.locale === locale) : list));
  }, [locale]);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, options: ToastOptions = {}) => {
    const kind = options.kind ?? 'info';
    const requested = options.durationMs ?? (kind === 'error' ? 12000 : MIN_DURATION);
    const durationMs = Math.max(MIN_DURATION, requested);
    const id = nextId++;
    setToasts((list) => [...list, { id, message, kind, durationMs, locale: getCurrentLocale(), ...(options.announced ? { announced: true } : {}) }]);
    return id;
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      info: (m, o) => show(m, { ...o, kind: 'info' }),
      success: (m, o) => show(m, { ...o, kind: 'success' }),
      error: (m, o) => show(m, { ...o, kind: 'error' }),
      dismiss,
      toasts,
    }),
    [show, dismiss, toasts],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="toast-region" aria-label={T.toastRegion} role="region">
            {toasts.filter((t) => t.locale === locale).map((t) => (
              <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.durationMs);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(onDismiss, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(1000, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, onDismiss]);

  const role = toast.announced ? undefined : toast.kind === 'error' ? 'alert' : 'status';
  return (
    <div
      className={`toast toast--${toast.kind}`}
      role={role}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      data-testid="toast"
    >
      <div className="toast__text">{toast.message}</div>
      <button type="button" className="btn btn--ghost btn--sm" onClick={onDismiss} aria-label={T.closeMessage}>
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}

/** Returns the toast API. Safe outside a provider (no-op). */
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
