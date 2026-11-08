/**
 * Lock state: after inactivity (or Ctrl+L) the UI shows the lock screen and
 * requires the password. The session token is kept so "Remember me" still works.
 * Logging out (or losing the session) always unlocks.
 *
 * The lock lives on the SERVER too (POST /api/auth/lock): while the session is
 * locked every data route answers 423 LOCKED until the password is entered
 * again, so reloading the page (F5, pull to refresh) or using the token
 * directly reveals nothing. A session that comes back locked after a reload
 * (`restoredLocked`) shows the lock screen at once, and the pages are not
 * mounted behind it until the diary is unlocked. A 423 answer to any request
 * (e.g. the diary was locked in another tab) shows the lock screen as well.
 *
 * Automatic offline mode (docs/android-tasks/OFFLINE-DESIGN.md section 5.7): without a connection the
 * password cannot be checked, so the lock screen offers the device's own user check (the phone's screen
 * lock, Windows Hello) - and, since 2026-11-08 (section 13), the diary password checked on the device
 * by the engine (`offline.unlockWithPassword`). Either unlocks this device's screen only
 * (`unlockOffline`); when the server still holds the session locked, the next upload answers 423, the
 * lock screen comes back once and asks for the password "to upload your changes" (`uploadPrompt`). The
 * lock state and the last activity are kept in the session snapshot of an app with "Remember me", so
 * an offline start obeys the auto-lock.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { auth as authApi, LOCKED_EVENT } from '@/api';
import { offline } from '@/offline';
import { isGuestUser, useAuth } from './AuthContext';

/** The session snapshot's last activity is written at most this often (an app with "Remember me"). */
export const ACTIVITY_SNAPSHOT_GAP_MS = 60_000;

export interface LockContextValue {
  locked: boolean;
  /**
   * True while the lock came from the server when the session was restored (a reload of a locked
   * diary): nothing was on screen before, so the pages are not mounted until the diary is unlocked.
   */
  restoredLocked: boolean;
  /** Locks immediately (no-op when not authenticated). */
  lock: () => void;
  /** Unlocks after a successful password check. */
  unlock: () => void;
  /** Unlocks this device's screen after the operating system's own user check (offline only). */
  unlockOffline?: () => void;
  /** True when the last unlock was the offline one: a lock that follows asks for the password to upload. */
  uploadPrompt?: boolean;
}

export const LockContext = createContext<LockContextValue>({
  locked: false,
  restoredLocked: false,
  lock: () => undefined,
  unlock: () => undefined,
});

export function LockProvider({ children }: { children: ReactNode }) {
  const { status, sessionLocked, user, unlockOffline: unlockSessionOffline } = useAuth();
  const [localLocked, setLocalLocked] = useState(false);
  const [uploadPrompt, setUploadPrompt] = useState(false);
  const statusRef = useRef(status);
  statusRef.current = status;
  // The guest of the phone's tour mode has no password that could unlock the diary again: the
  // server never locks a guest session, and the "lock when I leave the app" event must not either.
  const guestRef = useRef(isGuestUser(user));
  guestRef.current = isGuestUser(user);

  useEffect(() => {
    if (status !== 'authenticated') {
      setLocalLocked(false);
      setUploadPrompt(false);
    }
  }, [status]);

  // The server says this session is locked (another tab locked it, or it was locked before a
  // reload) - or, on the phone, the app was left with "lock when I leave the app" on.
  useEffect(() => {
    const onLocked = () => {
      if (statusRef.current === 'authenticated' && !guestRef.current) setLocalLocked(true);
    };
    window.addEventListener(LOCKED_EVENT, onLocked);
    return () => window.removeEventListener(LOCKED_EVENT, onLocked);
  }, []);

  const lock = useCallback(() => {
    if (status !== 'authenticated') return;
    setLocalLocked(true);
    // A lock of this device (auto-lock, Ctrl+L, leaving the app) is an ordinary lock: the "enter your
    // password to upload" wording belongs only to the server's 423 that follows an offline unlock.
    setUploadPrompt(false);
    // Best effort: when the server cannot be reached the screen is locked anyway.
    authApi.lock().catch(() => undefined);
  }, [status]);

  const unlock = useCallback(() => {
    setLocalLocked(false);
    setUploadPrompt(false);
    // The password unlocked the server session too: uploads paused by a 423 go on.
    offline.notifyUnlocked();
  }, []);

  const unlockOffline = useCallback(() => {
    setLocalLocked(false);
    setUploadPrompt(true);
    unlockSessionOffline?.();
  }, [unlockSessionOffline]);

  const restoredLocked = status === 'authenticated' && sessionLocked;
  const locked = status === 'authenticated' && (localLocked || sessionLocked);

  // The session snapshot of an app with "Remember me" follows the lock state (an offline start obeys it).
  useEffect(() => {
    if (status !== 'authenticated') return;
    void offline.updateSession({ locked, lastActivityAt: Date.now() }).catch(() => undefined);
  }, [locked, status]);

  // ... and the last activity (at most once a minute), for the auto-lock rule at an offline start.
  useEffect(() => {
    if (status !== 'authenticated' || typeof window === 'undefined') return;
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last < ACTIVITY_SNAPSHOT_GAP_MS || !offline.isActive()) return;
      last = now;
      void offline.updateSession({ lastActivityAt: now }).catch(() => undefined);
    };
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [status]);

  const value = useMemo(
    () => ({ locked, restoredLocked, lock, unlock, unlockOffline, uploadPrompt }),
    [locked, restoredLocked, lock, unlock, unlockOffline, uploadPrompt],
  );
  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

/** Access the lock state. Safe outside a provider (never locked). */
export function useLock(): LockContextValue {
  return useContext(LockContext);
}

// ---------------------------------------------------------------------------------------------
// Phone (Android app): the security settings that live on the device, filled in by the native
// host (mobile/platform/index.ts) and shown by the Security card and the lock screen. The desktop
// never sets this seam, and the lock itself stays what it is above: a server-side session lock.
// ---------------------------------------------------------------------------------------------

export interface PhoneSecurityPrefs {
  /** "Lock when I leave the app" (default on). */
  lockOnLeave: boolean;
  /** "Hide content in recent apps and block screenshots" (default on). */
  privacyScreen: boolean;
  /** "Unlock with fingerprint or face" (default off; shown only when `PhoneSecurity.biometric` exists). */
  biometricUnlock: boolean;
}

/**
 * Biometric unlock of the LOCK SCREEN only. It never stands in for the password at login or in a
 * password confirmation: it hands the core an unlock token that only a biometric prompt can
 * release (see mobile/platform/biometric.ts for the design and the core contract).
 */
export interface PhoneBiometric {
  /** A fingerprint / face is set up on the phone and the prompt can be shown. */
  isAvailable(): Promise<boolean>;
  /** Turns the setting on with the account password; false when the prompt was cancelled. */
  enable(password: string): Promise<boolean>;
  disable(): Promise<void>;
  /** Shows the prompt; 'unlocked' means the session is unlocked on the core. */
  unlock(): Promise<'unlocked' | 'cancelled' | 'failed' | 'not-enrolled'>;
}

export interface PhoneSecurity {
  get(): PhoneSecurityPrefs;
  setLockOnLeave(value: boolean): Promise<void>;
  setPrivacyScreen(value: boolean): Promise<void>;
  /** Notifies after every change; returns the unsubscribe function. */
  subscribe(listener: (prefs: PhoneSecurityPrefs) => void): () => void;
  /** Null while biometric unlock is not available in this build (feature flag) or on this phone. */
  biometric: PhoneBiometric | null;
}

let phoneSecurity: PhoneSecurity | null = null;

export function setPhoneSecurity(impl: PhoneSecurity | null): void {
  phoneSecurity = impl;
}

export function getPhoneSecurity(): PhoneSecurity | null {
  return phoneSecurity;
}
