/**
 * Offline start (section 4.7): the binding and the session snapshot.
 *
 *  - After every successful `me()` or login with "Remember me" on an APP (Windows / Android), the
 *    engine stores `localStorage['mpd.offline.current'] = { userId, tokenTag }` (`tokenTag` = the first
 *    16 hex characters of SHA-256 of the token - never the token itself) and the encrypted session
 *    snapshot in `meta.snapshot`.
 *  - At start with a token, the FIRST `me()` failure with `isConnectionError` lets the AuthProvider
 *    (WP-H10c) ask the engine for a cache start; it is granted only when the binding matches the token
 *    in hand, the platform is an app and the snapshot decrypts.
 *  - Locked at start when the snapshot was locked or `now - lastActivityAt > autoLockMinutes`.
 * The web never starts from the cache (it needs the server to load the page).
 *
 * Also here: the platform checks the engine and the UI share, `isApp()` and `isMacApp()`.
 */
import type { ServerInfo, UserProfile } from '@shared/types';
import { isNativeApp, isTauri } from '@/api/client';
import { decryptValue, encryptValue, isBytes, sha256Hex, type DerivedKeys } from './crypto';
import { META } from './keys';
import type { OfflineStore } from './store/types';

export const BINDING_KEY = 'mpd.offline.current';
export const TOKEN_TAG_LENGTH = 16;

export interface OfflineBinding {
  userId: string;
  tokenTag: string;
}

/** What a cache start restores (section 4.7): the user, the session flags and the server's self-description. */
export interface SessionSnapshot {
  user: UserProfile;
  rememberMe: boolean;
  locked: boolean;
  /** Device epoch ms of the last activity the app saw. */
  lastActivityAt: number;
  serverInfo: Pick<ServerInfo, 'mode' | 'publicUrl' | 'offlineSync' | 'guestTour' | 'passwordResetAvailable'>;
}

/** The Windows app, the Mac app or the Android app (the only places a cache start exists). */
export function isApp(): boolean {
  return isTauri() || isNativeApp();
}

/**
 * True for the user agent of WKWebView on a Mac ("Macintosh", on Apple silicon too); WebView2 on
 * Windows never says it. Safari on a Mac and an iPad in desktop-class browsing say it as well, so on
 * its own this never means "the Mac app" - that is `isMacApp()`.
 */
export function isMacUserAgent(userAgent: string): boolean {
  return /\bMacintosh\b/.test(userAgent);
}

/**
 * True only inside the Mac app (docs/APPLE-PLAN.md WP-M3): the Tauri shell's global (`isTauri()`, the
 * same test as everywhere else in the UI) AND the Mac user agent. The web UI served from the same
 * dist/ to a browser on a Mac or to an iPad is never it, whatever its user agent says. It lives here,
 * next to `isApp()`, and not in the Tauri adapter that picks the Keychain vault by it
 * (src/offline/native/tauri.ts): the adapter is the desktop branch's own chunk, which no module but
 * src/main.tsx may import (src/main.test.tsx), so a Mac-only branch elsewhere in the UI
 * (useKeyboardShortcuts.ts) takes this one.
 */
export function isMacApp(): boolean {
  return isTauri() && typeof navigator !== 'undefined' && isMacUserAgent(navigator.userAgent);
}

/** The first 16 hex characters of SHA-256 of the token. */
export async function tokenTagOf(token: string): Promise<string> {
  return (await sha256Hex(token)).slice(0, TOKEN_TAG_LENGTH);
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readBinding(): OfflineBinding | null {
  try {
    const raw = storage()?.getItem(BINDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OfflineBinding>;
    if (typeof parsed.userId !== 'string' || typeof parsed.tokenTag !== 'string') return null;
    return { userId: parsed.userId, tokenTag: parsed.tokenTag };
  } catch {
    return null;
  }
}

export async function writeBinding(userId: string, token: string): Promise<void> {
  const binding: OfflineBinding = { userId, tokenTag: await tokenTagOf(token) };
  try {
    storage()?.setItem(BINDING_KEY, JSON.stringify(binding));
  } catch {
    /* storage unavailable: no offline start on this device */
  }
}

export function clearBinding(): void {
  try {
    storage()?.removeItem(BINDING_KEY);
  } catch {
    /* ignore */
  }
}

/** The binding when it names the account of `token` (same tag), else null. */
export async function matchingBinding(token: string | null): Promise<OfflineBinding | null> {
  if (!token) return null;
  const binding = readBinding();
  if (!binding) return null;
  return binding.tokenTag === (await tokenTagOf(token)) ? binding : null;
}

/** Whether a cache start may be attempted at all (before the store is opened). */
export function canStartFromCache(args: { hasToken: boolean; app: boolean; binding: OfflineBinding | null }): boolean {
  return args.hasToken && args.app && args.binding !== null;
}

export async function saveSnapshot(store: OfflineStore, keys: DerivedKeys, snapshot: SessionSnapshot): Promise<void> {
  const ct = await encryptValue(keys, 'meta', META.snapshot, snapshot);
  await store.tx(['meta'], 'readwrite', (t) => t.put('meta', { name: META.snapshot, value: ct }));
}

export async function loadSnapshot(store: OfflineStore, keys: DerivedKeys): Promise<SessionSnapshot | null> {
  const row = await store.tx(['meta'], 'readonly', (t) => t.get('meta', META.snapshot));
  if (!row || !isBytes(row.value)) return null;
  try {
    return await decryptValue<SessionSnapshot>(keys, 'meta', META.snapshot, row.value);
  } catch {
    return null;
  }
}

export async function deleteSnapshot(store: OfflineStore): Promise<void> {
  await store.tx(['meta'], 'readwrite', (t) => t.delete('meta', META.snapshot));
}

/** Locked at start: the snapshot was locked, or the auto-lock time passed since the last activity (0 = never). */
export function lockedAtStart(snapshot: Pick<SessionSnapshot, 'locked' | 'lastActivityAt'>, now: number, autoLockMinutes: number): boolean {
  if (snapshot.locked) return true;
  if (!(autoLockMinutes > 0)) return false;
  return now - snapshot.lastActivityAt > autoLockMinutes * 60_000;
}
