/**
 * UI language.
 *
 * - The effective locale is `settings.language` once the user is authenticated
 *   and the settings are loaded; otherwise the runtime default (localStorage
 *   'mpd.language' -> the installer's language on the desktop -> the phone's
 *   system languages (Android app) / the browser's languages (web UI) -> 'en';
 *   see `detectLocale` and `@/i18n/install-locale`). A detected language is
 *   never stored: 'mpd.language' is written only for a language the user
 *   chose (`setLocale`), the installer's, and - in the Windows app and the web
 *   UI - an account language that differs from the one on screen (below - so a
 *   remembered session starts in it). The Android app keeps the account's
 *   language apart instead ('mpd.language.session', `storeSessionLocale`): it
 *   serves the next start of the remembered session the same way, but goes
 *   when the device is signed out, so the phone's language is followed again
 *   unless a language was chosen in Settings (ANDROID-SYSTEM-LANGUAGE.md item 4).
 *   A language newly chosen in the installer that a remembered session covered
 *   up is applied on the first signed-out screen (once; see install-locale).
 * - Until the account settings arrive, the language the SAME account had the
 *   last time on this device (localStorage 'mpd.language.user.<id>') is used,
 *   so a page that is already on screen (and a form being typed into) is not
 *   rebuilt a moment later when the settings come in.
 * - `setLocale` switches immediately, stores the choice on this device and,
 *   when authenticated, saves it to the account (`settings.update`). A failed
 *   account save is kept here (`saveFailed`) and announced here, because the
 *   component that started the change is rebuilt by the switch.
 * - Every change updates <html lang> / <html dir> (rtl for Hebrew and Arabic)
 *   and refreshes document.title when it still shows the app name. Only a
 *   change the user made is announced ("Language updated: ..." in the *new*
 *   language); adopting the account's language when it loads is silent.
 * - App.tsx re-keys its subtree with the locale so every `T.*` getter is
 *   evaluated again; the element that had the focus before a user's change
 *   (usually the language select) gets it back after the rebuild
 *   (`peekFocusToRestore` / `clearFocusToRestore`).
 *
 * The hooks are safe outside the provider (they fall back to the runtime), so
 * shared components and tests do not need it.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { LOCALE_CODES, localeDef, resolveLocale, t, type Locale, type Params, type TextDirection } from '@shared/i18n';
import { isNativeApp } from '@/api';
import {
  clearSessionLocale,
  detectLocale,
  dir,
  getCurrentLocale,
  readSessionLocale,
  readUserLocale,
  setCurrentLocale,
  storeLocale,
  storeSessionLocale,
  storeUserLocale,
  subscribe,
} from '@/i18n/runtime';
import { clearPendingInstallLocale, takePendingInstallLocale } from '@/i18n/install-locale';
import { useAnnouncer } from './AnnouncerContext';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';

export type Translate = (key: string, params?: Params) => string;

export interface LanguageContextValue {
  locale: Locale;
  dir: TextDirection;
  /** Translator bound to the current locale. */
  t: Translate;
  /** Switches the language (device + account when signed in). Rejects when the account save fails. */
  setLocale: (locale: Locale) => Promise<void>;
  /** True while the account save of a language change is running. */
  saving: boolean;
  /** True when the last account save of a language change failed (the device switched anyway). */
  saveFailed: boolean;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

const APP_NAMES = new Set(LOCALE_CODES.map((code) => t(code, 'shell.appName')));

/** Applies the locale to the document: <html lang>, <html dir> and a generic title. Exported for tests. */
export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.lang = locale;
  root.dir = dir(locale);
  // Pages set a specific title after mounting; only a bare app name is replaced here.
  if (!document.title || APP_NAMES.has(document.title)) document.title = t(locale, 'shell.appName');
}

/** Id of the element that had the focus when the user switched the language (see `takeFocusToRestore`). */
let focusToRestore: string | null = null;

/** The id of the element to focus again after the language rebuild of the page (App.tsx), or null. */
export function peekFocusToRestore(): string | null {
  return focusToRestore;
}

/** True while a focus restore after a language rebuild is pending (FocusHeading then keeps still). */
export function hasFocusToRestore(): boolean {
  return focusToRestore !== null;
}

/** Ends the pending focus restore (App.tsx, after every effect of the rebuilt page has run). */
export function clearFocusToRestore(): void {
  focusToRestore = null;
}

/**
 * For the component that re-keys the page by the locale (App.tsx): after a language change the user
 * made, the focus goes back to the control they used, before the paint. The pending flag keeps the
 * rebuilt page's heading (FocusHeading, a passive effect) from taking the focus, and is cleared once
 * every effect of the rebuilt page has run (the parent's passive effect runs last).
 */
export function useRestoreFocusAfterLanguageChange(locale: Locale): void {
  useLayoutEffect(() => {
    const id = peekFocusToRestore();
    if (id) document.getElementById(id)?.focus();
  }, [locale]);
  useEffect(() => {
    clearFocusToRestore();
  }, [locale]);
}

/** Subscribes to the runtime locale (works with and without the provider). */
function useRuntimeLocale(): Locale {
  return useSyncExternalStore(subscribe, getCurrentLocale, getCurrentLocale);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const { settings, loaded, update } = useSettings();
  const { announce, clear } = useAnnouncer();
  const locale = useRuntimeLocale();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const userId = status === 'authenticated' ? (user?.id ?? null) : null;

  // The account's language wins once the settings arrived; until then the language this account
  // had last time on this device; before login and after logout the runtime keeps the device choice.
  const serverLocale = userId && loaded ? resolveLocale(settings.language) : null;
  const accountLocale = serverLocale ?? (userId ? readUserLocale(userId) : null);
  // Where the account's language is kept for the next start of a remembered session: the Windows app
  // and the web UI mirror it into the device language (as they always did); the Android app keeps it
  // apart, so that it goes with the session and 'mpd.language' stays what the user chose.
  const android = isNativeApp();
  useLayoutEffect(() => {
    if (accountLocale && accountLocale !== getCurrentLocale()) {
      setCurrentLocale(accountLocale);
      if (!android) storeLocale(accountLocale);
    }
    if (userId && serverLocale) {
      storeUserLocale(userId, serverLocale);
      if (android) storeSessionLocale(serverLocale);
    }
  }, [accountLocale, serverLocale, userId, android]);

  // Signed out (a logout, an ended session, or a start without one): in the Android app the session's
  // language goes with the session and the device language applies again - the one chosen in
  // Settings, else the phone's (`detectLocale`) - before the paint. Then, a language newly chosen in
  // the desktop installer is shown on the first signed-out screen, also when a remembered session
  // signed in first and mirrored its account language to the device (src/i18n/install-locale.ts).
  // Once only: afterwards the device keeps the last language used.
  const signedOut = status === 'anonymous';
  useLayoutEffect(() => {
    if (!signedOut) return;
    if (android) {
      const sessionLocale = readSessionLocale();
      clearSessionLocale();
      if (sessionLocale) setCurrentLocale(detectLocale());
    }
    const pending = takePendingInstallLocale();
    if (pending) {
      setCurrentLocale(pending);
      storeLocale(pending);
    }
  }, [signedOut, android]);

  // Document attributes on every change; only a change the user made is announced.
  const announceFor = useRef<Locale | null>(null);
  useLayoutEffect(() => {
    applyDocumentLocale(locale);
    if (announceFor.current === locale) {
      announce(t(locale, 'settings.language.changed', { language: localeDef(locale).nativeName }), 'polite');
    }
    announceFor.current = null;
  }, [locale, announce]);

  const setLocale = useCallback(
    async (next: Locale) => {
      const resolved = resolveLocale(next);
      setSaveFailed(false);
      if (resolved !== getCurrentLocale()) {
        // A message still in a live region (a form error...) is in the old language: drop it.
        clear();
        announceFor.current = resolved;
        const active = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
        focusToRestore = active && active !== document.body && active.id ? active.id : null;
      }
      setCurrentLocale(resolved);
      storeLocale(resolved);
      // The user's own choice replaces an installer language still waiting for a signed-out screen.
      clearPendingInstallLocale();
      if (userId) storeUserLocale(userId, resolved);
      if (status !== 'authenticated') return;
      setSaving(true);
      try {
        await update({ language: resolved });
      } catch (e) {
        setSaveFailed(true);
        announce(t(resolved, 'settings.language.saveFailed'), 'assertive');
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [status, update, userId, announce, clear],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, dir: dir(locale), t: (key, params) => t(locale, key, params), setLocale, saving, saveFailed }),
    [locale, setLocale, saving, saveFailed],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** The full language context (falls back to the runtime outside the provider). */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  const runtime = useRuntimeLocale();
  return useMemo<LanguageContextValue>(() => {
    if (ctx) return ctx;
    return {
      locale: runtime,
      dir: dir(runtime),
      t: (key, params) => t(runtime, key, params),
      setLocale: async (next) => {
        const resolved = resolveLocale(next);
        setCurrentLocale(resolved);
        storeLocale(resolved);
        clearPendingInstallLocale();
      },
      saving: false,
      saveFailed: false,
    };
  }, [ctx, runtime]);
}

/** The current locale code ('en', 'he', ...). */
export function useLocale(): Locale {
  return useLanguage().locale;
}

/** Translator bound to the current locale. */
export function useT(): Translate {
  return useLanguage().t;
}

/** Switches the language. */
export function useSetLocale(): (locale: Locale) => Promise<void> {
  return useLanguage().setLocale;
}
