/**
 * Current-locale runtime for the UI.
 *
 * The React tree reads the locale through `LanguageContext`; everything else
 * (the api client, the text objects `T` / `ST` / `ET`, the date and number
 * helpers) reads it from here so plain modules need no React:
 *
 *   import { tr, getCurrentLocale } from '@/i18n/runtime';
 *   export const T = { get save() { return tr('shell.save'); } };
 *
 * Initial value, decided synchronously while this module loads - before the first render, so the
 * first screen is already in its language and direction (no left-to-right flash for Hebrew or
 * Arabic) - per platform (see `detectLocale`):
 *  - Android app:  localStorage 'mpd.language.session' (the signed-in account's language, kept only
 *                  while its session is on this device - so a remembered session starts in it) ->
 *                  'mpd.language' (a language chosen in Settings -> Language) -> the phone's system
 *                  languages (navigator.languages of the Capacitor WebView) -> 'en';
 *  - Windows app:  'mpd.language' -> the installer's language (inserted before the first render by
 *                  `src/i18n/install-locale.ts`) -> 'en' (the Microsoft Store / MSIX build has no
 *                  installer language and opens in English; WebView2's languages are not consulted);
 *  - web UI:       'mpd.language' -> the browser's languages -> 'en'.
 * A signed-in account's own language wins over all of these (LanguageContext). There is no
 * first-run language screen anywhere (docs/android-tasks/HOSTED-IMPL.md item 13).
 * `setCurrentLocale` notifies subscribers (the LanguageProvider re-keys the
 * app subtree so every getter is evaluated again).
 */
import {
  directionOf,
  isLocale,
  localeDef,
  makeT,
  negotiateLocale,
  resolveLocale,
  t,
  type Locale,
  type Params,
  type TextDirection,
} from '@shared/i18n';

/** localStorage key holding the language chosen on this device (used before login too). */
export const LANGUAGE_STORAGE_KEY = 'mpd.language';

export type LocaleListener = (locale: Locale) => void;

const listeners = new Set<LocaleListener>();

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The language stored on this device, or null when none / invalid. */
export function readStoredLocale(): Locale | null {
  const raw = storage()?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
  return isLocale(raw) ? raw : null;
}

/** Remembers the language on this device (ignored when storage is unavailable). */
export function storeLocale(locale: Locale): void {
  try {
    storage()?.setItem(LANGUAGE_STORAGE_KEY, locale);
  } catch {
    /* storage unavailable */
  }
}

/** localStorage key prefix of the language each account had last time on this device ('mpd.language.user.<id>'). */
export const USER_LANGUAGE_KEY_PREFIX = 'mpd.language.user.';

/** The language `userId` had the last time it was signed in on this device, or null. */
export function readUserLocale(userId: string): Locale | null {
  try {
    const raw = storage()?.getItem(`${USER_LANGUAGE_KEY_PREFIX}${userId}`) ?? null;
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Remembers the account's language on this device (applied before its settings arrive next time). */
export function storeUserLocale(userId: string, locale: Locale): void {
  try {
    storage()?.setItem(`${USER_LANGUAGE_KEY_PREFIX}${userId}`, locale);
  } catch {
    /* storage unavailable */
  }
}

/** Forgets the remembered language of `userId` (account deletion). */
export function forgetUserLocale(userId: string): void {
  try {
    storage()?.removeItem(`${USER_LANGUAGE_KEY_PREFIX}${userId}`);
  } catch {
    /* storage unavailable */
  }
}

/**
 * localStorage key (Android app only) holding the signed-in account's language while its session is
 * kept on this device: the next start of a remembered session begins in it, before the account is
 * known. Written by the LanguageContext whenever the account's settings are in, removed by it when
 * the device is signed out - so it never outlives the session, unlike 'mpd.language', which holds
 * only a language the user chose. (The Windows app and the web UI keep mirroring the account's
 * language into 'mpd.language' instead, as they always did.)
 */
export const SESSION_LANGUAGE_KEY = 'mpd.language.session';

/** The language of the session kept on this device (Android app), or null when none / invalid. */
export function readSessionLocale(): Locale | null {
  try {
    const raw = storage()?.getItem(SESSION_LANGUAGE_KEY) ?? null;
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Keeps the signed-in account's language for the next start of its session (Android app). */
export function storeSessionLocale(locale: Locale): void {
  try {
    storage()?.setItem(SESSION_LANGUAGE_KEY, locale);
  } catch {
    /* storage unavailable */
  }
}

/** Forgets the session's language (the device was signed out). */
export function clearSessionLocale(): void {
  try {
    storage()?.removeItem(SESSION_LANGUAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * True in the Windows app: the Tauri shell defines `__TAURI_INTERNALS__` before any page script runs.
 * The same check as `isTauri()` in src/api/client.ts, repeated here because client.ts imports this
 * module (and the start-up language is detected while this module loads).
 */
function inDesktopApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * True in the installed Android app: the mobile build (`__MOBILE__`) inside the Capacitor WebView.
 * The same check as `isNativeApp()` in src/api/client.ts, repeated here for the same reason as
 * `inDesktopApp` (client.ts imports this module). False on the desktop, in a browser and when the
 * mobile build is opened in a plain browser during development.
 */
function inAndroidApp(): boolean {
  if (typeof __MOBILE__ === 'undefined' || !__MOBILE__) return false;
  const capacitor = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return capacitor?.isNativePlatform?.() === true;
}

/**
 * Browser / OS language list, most preferred first (empty outside a browser).
 *
 * In the Android app this is the PHONE'S SYSTEM LANGUAGE LIST: the WebView (Chromium) fills
 * navigator.languages from `LocaleList.getDefault()` - the user's languages of Settings -> System
 * -> Languages, in that order - when it is created and again on a configuration change, and
 * appends "en-US" when it is missing. The app supports Android 7.0+ (minSdk 24, the first version
 * with a locale list) and Capacitor refuses WebViews older than version 60, which already work this
 * way, so no native call is needed. Tags arrive like "he-IL", "pt-BR", "zh-TW" (the WebView drops
 * the script subtag and updates the legacy codes iw / in / ji); `negotiateLocale` reads them.
 */
function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  const list = navigator.languages;
  if (Array.isArray(list) && list.length) return list;
  return navigator.language ? [navigator.language] : [];
}

/** What the start-up language is chosen from (every source is optional). */
export interface StartupLocaleSources {
  /**
   * The signed-in account's language: applied by the LanguageContext once the account is known; at
   * start-up in the Android app, the language of the session kept on this device
   * ('mpd.language.session' - that account's, see `SESSION_LANGUAGE_KEY`).
   */
  account?: Locale | null;
  /** The language remembered on this device (localStorage 'mpd.language'). */
  stored?: Locale | null;
  /** The language chosen in the desktop installer (null in a browser / phone). */
  install?: Locale | null;
  /**
   * Browser / OS language list, most preferred first: the phone's system languages in the Android
   * app, the browser's in the web UI; not given in the Windows app (see `detectLocale`).
   */
  browser?: readonly string[] | null;
}

/**
 * The UI language resolution order: signed-in account > device language (chosen in Settings ->
 * Language) > installer language (Windows app only) > system / browser languages (Android app and
 * web UI, not the Windows app) > English.
 */
export function resolveStartupLocale(sources: StartupLocaleSources): Locale {
  return sources.account ?? sources.stored ?? sources.install ?? negotiateLocale(sources.browser ?? []);
}

/** Language chosen in the desktop installer, once `src/i18n/install-locale.ts` has read it (null otherwise). */
let installLocale: Locale | null = null;

/** Records the installer's language (desktop start-up). Does not switch the current locale. */
export function setInstallLocale(locale: Locale | null): void {
  installLocale = isLocale(locale) ? locale : null;
}

/** The installer's language recorded by `setInstallLocale`, or null. */
export function getInstallLocale(): Locale | null {
  return installLocale;
}

/**
 * Default locale for this device (before sign-in): stored choice -> installer language -> browser
 * languages -> English. The browser languages count only outside the Windows app: in the Android
 * app they are the phone's system languages (see `browserLanguages`), in the web UI the browser's.
 * In the Windows app the language is the one chosen in Settings -> Language or the installer's,
 * otherwise English - the Microsoft Store / MSIX build has no installer language and opens in
 * English, whatever language Windows (WebView2) reports (owner decisions 2026-10-23,
 * docs/android-tasks/HOSTED-IMPL.md items 12-13).
 *
 * Nothing detected here is stored: 'mpd.language' holds only a language the user chose (Settings ->
 * Language), the installer's (Windows) or - outside the Android app - the signed-in account's
 * (LanguageContext). In the Android app the account's language is kept apart, in
 * 'mpd.language.session', which goes with the session: it comes first here (a remembered session
 * starts in its account's language), and once the device is signed out the chain is the chosen
 * language -> the phone's languages again. So as long as no language was chosen, a later change of
 * the phone's language is followed at the next start, also after signing out of an account in
 * another language (docs/android-tasks/ANDROID-SYSTEM-LANGUAGE.md item 4).
 */
export function detectLocale(): Locale {
  return resolveStartupLocale({
    account: inAndroidApp() ? readSessionLocale() : null,
    stored: readStoredLocale(),
    install: installLocale,
    browser: inDesktopApp() ? null : browserLanguages(),
  });
}

let current: Locale = detectLocale();

export function getCurrentLocale(): Locale {
  return current;
}

/**
 * Switches the current locale and notifies subscribers. Does not persist
 * anything: the LanguageContext stores the choice (localStorage + account).
 */
export function setCurrentLocale(locale: Locale): void {
  const next = resolveLocale(locale);
  if (next === current) return;
  current = next;
  for (const listener of [...listeners]) listener(next);
}

/** Translates `key` in the current locale. */
export function tr(key: string, params?: Params): string {
  return t(current, key, params);
}

/** Translator bound to a specific locale (announcements in the *new* language, tests). */
export function trWith(locale: Locale): (key: string, params?: Params) => string {
  return makeT(locale);
}

/** Text direction of the current (or given) locale. */
export function dir(locale: Locale = current): TextDirection {
  return directionOf(locale);
}

/** BCP 47 tag for Intl.* of the current (or given) locale, e.g. 'he-IL'. */
export function intlTag(locale: Locale = current): string {
  return localeDef(locale).intl;
}

/**
 * Registers a listener called after every locale change. Returns the
 * unsubscribe function. Compatible with React's `useSyncExternalStore`.
 */
export function subscribe(listener: LocaleListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tests only: forgets the installer language and re-detects the locale from storage / navigator (subscribers are notified when it changes). */
export function __resetLocaleForTests(): void {
  installLocale = null;
  setCurrentLocale(detectLocale());
}
