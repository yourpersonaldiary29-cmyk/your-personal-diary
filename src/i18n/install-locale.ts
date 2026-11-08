/**
 * The language chosen in the Windows installer (desktop app only).
 *
 * The NSIS installer shows a language selector with the 20 UI languages and writes the chosen
 * locale code to `install-locale.txt` next to the executable (src-tauri/nsis/hooks.nsh); the Rust
 * shell returns it through the `get_install_locale` command (one of the 20 codes, or null).
 *
 * At start-up, before the first render (main.tsx), `initInstallLocale`:
 *  1. records it as the "install" layer of the resolution order
 *     (account > device language > install language > English - the Windows app does not consult
 *     the browser languages, so the Microsoft Store / MSIX build, which has no installer language,
 *     opens in English; see `detectLocale` in ./runtime.ts), and
 *  2. applies it ONCE to the device language when it differs from the value this device applied
 *     last time (localStorage 'mpd.language.installApplied'): after a reinstall in another
 *     language the welcome, login and registration screens appear in the newly chosen language,
 *     and an account registered there starts in it (the sign-up language becomes the account
 *     language on the server). Existing accounts keep their own language: the LanguageContext
 *     applies the account's language after sign-in. The language can always be changed in
 *     Settings -> Language; the installer's choice is not applied again until it changes.
 *
 * "Remember me": a remembered session signs in right after that apply, and the LanguageContext
 * mirrors the account's language into the device language, so the installer's choice would be gone
 * before any signed-out screen showed it. It therefore stays PENDING (localStorage
 * 'mpd.language.installPending') until the first signed-out screen: the LanguageContext then applies
 * it to the device language and clears it (`takePendingInstallLocale`), also on a later start when
 * the app was closed while still signed in. A language the user picks in the meantime
 * (Settings -> Language) replaces it (`clearPendingInstallLocale`).
 */
import { isLocale, type Locale } from '@shared/i18n';
import { isTauri } from '@/api/client';
import { detectLocale, setCurrentLocale, setInstallLocale, storeLocale } from './runtime';

/** localStorage key: the installer language this device has already applied to its device language. */
export const INSTALL_LOCALE_APPLIED_KEY = 'mpd.language.installApplied';

/** localStorage key: an applied installer language no signed-out screen has shown yet (see the module comment). */
export const INSTALL_LOCALE_PENDING_KEY = 'mpd.language.installPending';

/** How long the start-up waits for the shell's answer before rendering without it. */
const INSTALL_LOCALE_TIMEOUT_MS = 1500;

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The installer language this device applied last time, or null. */
export function readAppliedInstallLocale(): Locale | null {
  try {
    const raw = storage()?.getItem(INSTALL_LOCALE_APPLIED_KEY) ?? null;
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

function rememberAppliedInstallLocale(locale: Locale): void {
  try {
    storage()?.setItem(INSTALL_LOCALE_APPLIED_KEY, locale);
    storage()?.setItem(INSTALL_LOCALE_PENDING_KEY, locale);
  } catch {
    /* storage unavailable: applied again next start, which is harmless */
  }
}

/** The applied installer language no signed-out screen has shown yet, or null. Does not clear it. */
export function readPendingInstallLocale(): Locale | null {
  try {
    const raw = storage()?.getItem(INSTALL_LOCALE_PENDING_KEY) ?? null;
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Forgets the pending installer language (the user chose a language, or a signed-out screen showed it). */
export function clearPendingInstallLocale(): void {
  try {
    storage()?.removeItem(INSTALL_LOCALE_PENDING_KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * For the first signed-out screen (LanguageContext): the pending installer language, cleared as it is
 * returned so it is shown only once; null when there is none.
 */
export function takePendingInstallLocale(): Locale | null {
  const pending = readPendingInstallLocale();
  clearPendingInstallLocale();
  return pending;
}

/**
 * Asks the desktop shell for the installer's language. Null in a browser / phone, when the app was
 * not installed by the NSIS installer (tauri dev, MSI, older installers), on an invalid value, on an
 * error, or when the shell does not answer within `timeoutMs`.
 */
export async function fetchInstallLocale(timeoutMs: number = INSTALL_LOCALE_TIMEOUT_MS): Promise<Locale | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const answer = await Promise.race<unknown>([
      invoke<string | null>('get_install_locale'),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return isLocale(answer) ? answer : null;
  } catch {
    return null;
  }
}

/**
 * Applies the installer's language (see the module comment) and switches the current locale to the
 * resulting device default. Call it before the first render: the LanguageContext then applies a
 * signed-in account's own language on top, and a still pending installer language on the first
 * signed-out screen. Returns the resulting locale.
 */
export function applyInstallLocale(install: Locale | null): Locale {
  const valid = isLocale(install) ? install : null;
  setInstallLocale(valid);
  if (valid && readAppliedInstallLocale() !== valid) {
    storeLocale(valid);
    rememberAppliedInstallLocale(valid);
  }
  const next = detectLocale();
  setCurrentLocale(next);
  return next;
}

/** Start-up (main.tsx): reads the installer's language and applies it. Never rejects. */
export async function initInstallLocale(): Promise<Locale> {
  return applyInstallLocale(await fetchInstallLocale());
}
