/**
 * Application root (rendered inside the providers set up in main.tsx):
 * route announcer, page frame with the routes, lock screen, shortcuts dialog,
 * and the global behaviours - keyboard shortcuts, habit reminders, auto-lock
 * and auth notices shown as toasts. Toasts themselves are rendered by the
 * ToastProvider.
 *
 * The whole subtree is keyed by the UI language: a language change remounts
 * it, so every text getter (T.*, ST.*, ...) is evaluated in the new language.
 * After a change the user made, the element that had the focus (the language
 * select) gets it back - the remount would otherwise drop it to <body>.
 *
 * It is keyed by the account too (docs/android-tasks/OFFLINE-DESIGN.md section
 * 4.8 "Another account signs in"): when a different account signs in on this
 * device, nothing the previous account's pages held in memory survives. The
 * first sign-in of a run does not remount (nothing of another account is there).
 *
 * The slot over the routes shows the connection banner, or - while the
 * automatic offline mode runs for the signed-in account - its status bar.
 *
 * Required update (app version 1.1.0): while the owner's rule says this app's version may no longer be used
 * (src/hooks/useUpdateGate.ts decides when - never over a page with unsaved changes), the "Update needed"
 * screen (src/pages/UpdateRequiredPage.tsx) is rendered INSTEAD of the frame, the routes, the lock screen and
 * the shortcuts dialog. Everything above this component keeps running: the session, the offline engine (its
 * uploads), the toasts. The keyboard shortcuts are off meanwhile (nothing they act on is on screen), and a lock
 * the idle timer calls for waits until the screen goes. When it goes, the focus moves to the restored page.
 */
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { RouteAnnouncer } from '@/components/a11y/RouteAnnouncer';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { SyncStatusBar } from '@/components/sync/SyncStatusBar';
import { AppShell, MAIN_ID } from '@/components/layout/AppShell';
import { PAGE_TITLE_ID } from '@/components/ui/PageTitle';
import { isGuestUser, useAuth } from '@/context/AuthContext';
import { useLocale, useRestoreFocusAfterLanguageChange } from '@/context/LanguageContext';
import { useSettings } from '@/context/SettingsContext';
import { useLock } from '@/context/LockContext';
import { useToast } from '@/context/ToastContext';
import { useAutoLock } from '@/hooks/useAutoLock';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useReminders } from '@/hooks/useReminders';
import { useUpdateGate } from '@/hooks/useUpdateGate';
import LockScreen from '@/pages/LockScreen';
import ShortcutsDialog from '@/pages/ShortcutsDialog';
import UpdateRequiredPage from '@/pages/UpdateRequiredPage';
import { AppRoutes } from '@/router';

/**
 * When the "Update needed" screen goes away ("Check again" found the rule gone), its focused button goes with
 * it: the focus moves to the restored page's heading, or to the main region while the page is still loading,
 * so a screen-reader user lands in the diary again instead of on the document body.
 */
function useFocusAfterUpdateScreen(showing: boolean): void {
  const wasShowing = useRef(showing);
  useEffect(() => {
    const was = wasShowing.current;
    wasShowing.current = showing;
    if (showing || !was) return;
    const frame = window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      (document.getElementById(PAGE_TITLE_ID) ?? document.getElementById(MAIN_ID))?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showing]);
}

/** Turns the one-shot auth notice (session expired, logged out...) into a toast. */
function useAuthNoticeToast(): void {
  const { notice, dismissNotice } = useAuth();
  const toast = useToast();
  useEffect(() => {
    if (!notice) return;
    toast.show(notice.message, { kind: notice.kind });
    dismissNotice();
  }, [notice, toast, dismissNotice]);
}

/**
 * A number that changes whenever a DIFFERENT account than the last signed-in one signs in (Dana signs
 * out, Lior signs in): the app tree is keyed by it. Signing in after a sign-out of the same account, or
 * the first sign-in of the run, keeps it.
 */
export function useAccountGeneration(userId: string | null): number {
  const lastAccount = useRef<string | null>(null);
  const generation = useRef(0);
  if (userId !== null) {
    if (lastAccount.current !== null && lastAccount.current !== userId) generation.current += 1;
    lastAccount.current = userId;
  }
  return generation.current;
}

export default function App() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { settings } = useSettings();
  const { user } = useAuth();
  const locale = useLocale();
  const accountGeneration = useAccountGeneration(user?.id ?? null);
  // A diary that was locked before this page was (re)loaded: nothing of it is rendered until unlocked.
  const { restoredLocked } = useLock();
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const hideShortcuts = useCallback(() => setShortcutsOpen(false), []);
  const updateRequired = useUpdateGate();

  useKeyboardShortcuts({ onShowShortcuts: showShortcuts, enabled: !updateRequired });
  useReminders();
  // The guest of the tour mode (phone app) has no password that could unlock the diary again: never locked.
  // Under the "Update needed" screen nothing of the diary is on screen, and a lock would hold the uploads of
  // the changes waiting on the device (the server answers 423 until the password is typed on the lock
  // screen, which is not shown): the idle time keeps counting, and a lock that falls due meanwhile is done the
  // moment the screen goes - a device left idle on it never shows the diary unlocked afterwards.
  useAutoLock(isGuestUser(user) ? 0 : settings.autoLockMinutes, { hold: updateRequired !== null });
  useFocusAfterUpdateScreen(updateRequired !== null);
  useAuthNoticeToast();

  useRestoreFocusAfterLanguageChange(locale);

  if (updateRequired) {
    return (
      <Fragment key={`${locale}#${accountGeneration}`}>
        <UpdateRequiredPage requirement={updateRequired} />
      </Fragment>
    );
  }

  return (
    <Fragment key={`${locale}#${accountGeneration}`}>
      <RouteAnnouncer />
      <AppShell onShowShortcuts={showShortcuts}>
        {!restoredLocked && (
          <>
            {/* "No connection to the diary server" over a running app (the full page lives in the routes);
                the offline mode's status bar instead while it runs for the signed-in account. */}
            <ConnectionBanner />
            <SyncStatusBar />
            <AppRoutes />
          </>
        )}
      </AppShell>
      <LockScreen />
      <ShortcutsDialog open={shortcutsOpen} onClose={hideShortcuts} />
    </Fragment>
  );
}
