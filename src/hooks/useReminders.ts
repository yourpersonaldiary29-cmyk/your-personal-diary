/**
 * Habit reminders: while a session exists and reminders are enabled, asks the
 * server once a minute for reminders due at the current time and shows each
 * one as a system notification (Tauri plugin / browser Notification API; in the
 * Microsoft Store version a toast sent by the shell itself).
 * When no system notification can be shown (no permission, plain browser)
 * the reminder falls back to an in-app toast, so nothing is lost.
 */
import { useEffect, useRef, useState } from 'react';
import { habits as habitsApi } from '@/api';
import { T } from '@/constants/texts';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LanguageContext';
import { useLock } from '@/context/LockContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { nowHHMM } from '@/utils/dates';
import { isTauri, showSystemNotification } from '@/utils/platform';

export const REMINDER_POLL_MS = 60_000;

// ---------------------------------------------------------------------------------------------
// Phone (Android app): reminders are notifications the SYSTEM fires, planned by the native host
// (mobile/platform/notifications.ts) so they arrive while the app is closed. This hook tells the
// planner when the session, the reminders setting or the language changed, and keeps the in-app
// polling below only as the fallback while the phone does not allow notifications. The desktop
// never sets this seam.
// ---------------------------------------------------------------------------------------------

export type PhoneNotificationPermission = 'granted' | 'denied' | 'prompt';

export interface PhoneReminders {
  permission(): Promise<PhoneNotificationPermission>;
  /** Asks Android 13+ for POST_NOTIFICATIONS (from a button in the Reminders card). */
  requestPermission(): Promise<PhoneNotificationPermission>;
  /** Re-plans the system notifications; `enabled` = a session exists and reminders are on. */
  sync(options: { enabled: boolean }): Promise<unknown>;
  /** The phone setting "Show habit names in notifications". */
  getShowNames(): boolean;
  setShowNames(value: boolean): Promise<void>;
  /** Notifies when the permission or a phone setting changed; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

let phoneReminders: PhoneReminders | null = null;

export function setPhoneReminders(impl: PhoneReminders | null): void {
  phoneReminders = impl;
}

export function getPhoneReminders(): PhoneReminders | null {
  return phoneReminders;
}

/**
 * Answer of the shell command `show_store_notification` (`StoreNotification` in src-tauri/src/lib.rs):
 *  - 'not-packaged': the app is not the Microsoft Store (MSIX) package - nothing was sent;
 *  - 'shown': Windows took the toast;
 *  - 'disabled': notifications are turned off for the app in Windows - nothing was sent;
 *  - 'failed': the toast could not be sent.
 */
export type StoreNotificationResult = 'not-packaged' | 'shown' | 'disabled' | 'failed';

/** The shell command that sends a reminder toast as the Store package. */
export const STORE_NOTIFICATION_COMMAND = 'show_store_notification';

/**
 * Whether the shell said that this desktop app is not the Store package. It cannot change while the
 * app runs, so the downloaded (NSIS / MSI) version asks the shell once and never again.
 */
let knownNotPackaged = false;

/** Forgets the shell's answer (tests only). */
export function __resetStorePackageForTests(): void {
  knownNotPackaged = false;
}

async function askShell(title: string, body: string): Promise<StoreNotificationResult> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<StoreNotificationResult>(STORE_NOTIFICATION_COMMAND, { title, body });
    return result === 'not-packaged' || result === 'shown' || result === 'disabled' ? result : 'failed';
  } catch {
    return 'failed';
  }
}

/**
 * Shows one reminder as a system notification. Resolves true when the system took it, false when
 * the caller has to show it inside the app.
 *
 * Microsoft Store (MSIX) version: the notification plugin cannot be used there. It sends every
 * toast with the AppUserModelID `com.mydiary.app`, which Windows does not accept from a packaged
 * app, and still reports success - the reminder used to be lost. So the shell is asked first: in
 * the Store package it sends the toast with the package's own identity and says what happened;
 * anything but 'shown' (notifications turned off for the app, an error) means "show it in the app".
 *
 * Everywhere else nothing changes: the downloaded desktop version gets 'not-packaged' from the
 * shell (once) and keeps using the plugin through `showSystemNotification`, as does a browser.
 */
export async function showReminderNotification(title: string, body: string): Promise<boolean> {
  if (isTauri() && !knownNotPackaged) {
    const result = await askShell(title, body);
    if (result === 'shown') return true;
    // Only the shell's explicit answer sends a reminder to the plugin: after an error nobody knows
    // whether this is the Store package, where the plugin would swallow the reminder.
    if (result !== 'not-packaged') return false;
    knownNotPackaged = true;
  }
  return showSystemNotification(title, body);
}

export function useReminders(): void {
  const { status } = useAuth();
  const { settings } = useSettings();
  const { locked } = useLock();
  const locale = useLocale();
  const toast = useToast();
  // The toast context value changes whenever a toast is shown; keep it in a
  // ref so the polling interval is not restarted every time.
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const enabled = status === 'authenticated' && settings.remindersEnabled;

  // Phone: the host plans system notifications. `__MOBILE__` is a build-time constant: false on the
  // desktop (this folds to `null`), not defined under the root vitest config.
  const phone = typeof __MOBILE__ !== 'undefined' && __MOBILE__ ? getPhoneReminders() : null;
  // Null until the phone answered; true while the system delivers the reminders (no polling then).
  const [systemDelivers, setSystemDelivers] = useState<boolean | null>(null);

  useEffect(() => {
    if (!phone) return;
    // Locked (the app was left with "lock when I leave the app" on, the auto-lock fired, a
    // remembered session came back locked): the core answers 423 to everything, so nothing can be
    // planned now - the plan made while unlocked stays on the phone (the host keeps it) and this
    // effect re-plans as soon as the diary is unlocked.
    if (locked) return;
    let cancelled = false;
    const plan = async () => {
      const permission = await phone.permission().catch((): PhoneNotificationPermission => 'denied');
      if (cancelled) return;
      setSystemDelivers(enabled && permission === 'granted');
      await phone.sync({ enabled }).catch(() => undefined);
    };
    void plan();
    const unsubscribe = phone.subscribe(() => void plan());
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // `locale` re-plans after a language change (the notification texts follow the language),
    // `locked` after an unlock.
  }, [phone, enabled, locale, locked]);

  // Desktop / browser: poll. Phone: only while the system does not deliver the reminders.
  const poll = enabled && (!phone || systemDelivers === false);

  useEffect(() => {
    if (!poll) return;
    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const due = await habitsApi.dueReminders(nowHHMM());
        if (cancelled) return;
        for (const reminder of due) {
          const shown = await showReminderNotification(T.reminderTitle, reminder.message);
          if (cancelled) return;
          if (!shown) toastRef.current.info(reminder.message);
        }
      } catch {
        /* the server may be busy or the session gone - try again next minute */
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), REMINDER_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [poll]);
}
