/**
 * App lifecycle and the system Back button on the phone (WP-9), through @capacitor/app.
 *
 *  - Leaving the app (another app, the home screen, the screen turning off - `appStateChange`
 *    with isActive=false): the core is told to `flushAll` so nothing is lost if Android kills the
 *    process in the background; with "Lock when I leave the app" on, the UI is locked at once
 *    (`onLocked`, which dispatches the same event a 423 answer does) and the core locks every
 *    session (`lockAll`: the data routes then answer 423 until the password is entered again).
 *    The lock comes first: it is what the user sees when they return.
 *  - The app's OWN system dialogs are not "leaving": the "save as" / "open" dialogs of the Storage
 *    Access Framework and the share sheet are full-screen activities of another process, so
 *    Android stops MainActivity for them and Capacitor reports isActive=false - but the user is
 *    still inside a flow of this app (saving a backup, choosing a file to restore). Whoever opens
 *    such a dialog holds a `suspendLock()` token meanwhile: the flush still happens, the lock does
 *    not. Should the app still be in the background when the last token is released (the user
 *    picked another app from the share sheet and is now in it), the lock is done then - after a
 *    short grace period, because the activity result of a dialog arrives a few milliseconds
 *    BEFORE Android resumes the activity (onActivityResult precedes onResume), and a lock in that
 *    gap would hit the user who just closed the dialog. A long absence through a dialog (Home
 *    pressed inside the picker) is covered by the inactivity auto-lock as on the desktop.
 *  - Coming back (isActive=true): `onResume` (the host re-plans the reminders; the auto-lock
 *    timer re-checks its elapsed time itself when the page becomes visible again).
 *  - Back: `handleBack()` of src/utils/back-handler.ts decides - a dialog closes, a page goes
 *    back, and on the home page with nothing behind it the app is minimised (never finished: the
 *    core keeps running and the next tap on the icon is instant). The @capacitor/app plugin routes
 *    the gesture through the AndroidX OnBackPressedDispatcher, so predictive back on Android 14+
 *    shows no "leaving" animation while a dialog is open: the callback is enabled and handles it.
 *
 * Everything is best effort and logged: a core that cannot flush must not stop the lock, and a
 * failed lock must not stop the flush.
 *
 * iOS (`os: 'ios'`, docs/APPLE-PLAN.md WP-A2; the events are the ones of the plugin's own iOS
 * source, node_modules/@capacitor/app/ios/Sources/AppPlugin/AppPlugin.swift, 8.1.1). There
 * `appStateChange` with isActive=false is UIKit's willResignActive, which also fires while the app
 * stays on the screen - Control Center or Notification Center pulled over it, the system's
 * "allow notifications" alert, a Face ID / passcode prompt, an incoming call - and a lock then
 * would hit a user who never left. What Android means by "left" is `pause` there
 * (didEnterBackground: the home screen, another app, the screen locked). So on iOS:
 *  - `pause` does the work of leaving (the lock first, then the flush);
 *  - `appStateChange` only reports the return (isActive=true -> `onResume`);
 *  - a dialog of the app (the document picker, the share sheet, the user check) is presented
 *    inside the app and never sends it to the background, so a `pause` is always a real leave:
 *    it locks even while a `suspendLock()` token is held, and nothing is deferred. The tokens
 *    stay harmless no-ops, so the callers need no branch;
 *  - `backButton` never fires and `minimizeApp` is unimplemented: the listener is installed
 *    all the same and simply stays silent.
 * The Android behaviour is untouched by the switch: without `os: 'ios'` this module does exactly
 * what it did.
 */
import type { AppPlugin } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import type { BackResult } from '@/utils/back-handler';
import type { PhoneOs } from './os';

export type AppLike = Pick<AppPlugin, 'addListener' | 'minimizeApp'>;

/**
 * How long a released lock suspension waits for the app to come back to the foreground before
 * it locks (the dialog's result precedes the resume event by milliseconds; a user who went on to
 * another app from the share sheet does not come back within this time).
 */
export const DEFERRED_LOCK_GRACE_MS = 1500;

export interface LifecycleDeps {
  app: AppLike;
  /** The core's control channel (mobile/host/core-client.ts). */
  control: (action: 'flushAll' | 'lockAll') => Promise<void>;
  /** The phone setting "Lock when I leave the app", read at the moment of leaving. */
  shouldLockOnLeave: () => boolean;
  /** Locks the UI (dispatches the LOCKED event of src/api/client.ts). */
  onLocked: () => void;
  handleBack: () => BackResult;
  onResume?: () => void;
  log?: (message: string, error?: unknown) => void;
  /** The grace period of a deferred lock (tests shorten it). */
  deferredLockGraceMs?: number;
  /** The phone (mobile/platform/os.ts); default Android. iOS: `pause` is "leaving" (see the module comment). */
  os?: PhoneOs;
}

export interface LifecycleHandle {
  /** Resolves when the listeners are installed (tests wait for it). */
  ready: Promise<void>;
  /** The work of one "leave" (flush + lock), exposed so tests can await it. */
  leave(): Promise<void>;
  /**
   * Suspends "lock when I leave" while an app-initiated system dialog (save as, open, share sheet)
   * covers the activity; returns the function that releases the suspension (idempotent). Several
   * suspensions may overlap; the lock is deferred until the last one is released, and happens then
   * only if the app is still in the background after the grace period.
   */
  suspendLock(): () => void;
  /** Removes the listeners. */
  dispose(): void;
}

export function installLifecycle(deps: LifecycleDeps): LifecycleHandle {
  const log = deps.log ?? ((message: string, error?: unknown) => console.warn(`[mobile] lifecycle: ${message}`, error ?? ''));
  const graceMs = deps.deferredLockGraceMs ?? DEFERRED_LOCK_GRACE_MS;
  /** iOS: leaving is `pause`, and the app's own dialogs never send it to the background. */
  const ios = deps.os === 'ios';
  const handles: Promise<PluginListenerHandle>[] = [];
  let suspensions = 0;
  /** True from isActive=false (iOS: from `pause`) until the next isActive=true. */
  let inBackground = false;
  let deferredLockTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelDeferredLock(): void {
    if (deferredLockTimer !== null) clearTimeout(deferredLockTimer);
    deferredLockTimer = null;
  }

  function lockNow(): Promise<void> {
    try {
      deps.onLocked();
    } catch (e) {
      log('the UI could not be locked', e);
    }
    return deps.control('lockAll').catch((e) => log('the core could not lock the sessions', e));
  }

  async function leave(): Promise<void> {
    const work: Promise<unknown>[] = [];
    if (deps.shouldLockOnLeave()) {
      // iOS: a held token does not stand for "the app's own dialog covers it" - the app really left.
      if (suspensions > 0 && !ios) log('leaving for a system dialog of the app - the lock waits for its result');
      else work.push(lockNow());
    }
    work.push(deps.control('flushAll').catch((e) => log('the core could not flush', e)));
    await Promise.all(work);
  }

  function suspendLock(): () => void {
    suspensions++;
    cancelDeferredLock();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      suspensions--;
      // iOS never defers: a leave under a token locked at once (see `leave`).
      if (ios || suspensions > 0 || !inBackground) return;
      // Still in the background once the dialog is over: either Android is about to resume the
      // activity (the result came first), or the user went on to another app. The grace decides.
      cancelDeferredLock();
      deferredLockTimer = setTimeout(() => {
        deferredLockTimer = null;
        if (inBackground && suspensions === 0 && deps.shouldLockOnLeave()) void lockNow();
      }, graceMs);
    };
  }

  handles.push(
    deps.app.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        inBackground = false;
        cancelDeferredLock();
        try {
          deps.onResume?.();
        } catch (e) {
          log('resume handler failed', e);
        }
        return;
      }
      // iOS: willResignActive - the app may well stay on the screen; `pause` below is the leave.
      if (ios) return;
      inBackground = true;
      void leave();
    }),
  );
  if (ios) {
    handles.push(
      deps.app.addListener('pause', () => {
        inBackground = true;
        void leave();
      }),
    );
  }
  handles.push(
    deps.app.addListener('backButton', () => {
      let result: BackResult;
      try {
        result = deps.handleBack();
      } catch (e) {
        log('back handler failed', e);
        return;
      }
      if (result === 'exit') void deps.app.minimizeApp().catch((e) => log('minimizeApp failed', e));
    }),
  );

  const ready = Promise.all(handles).then(
    () => undefined,
    (e) => log('a lifecycle listener could not be installed', e),
  );

  return {
    ready,
    leave,
    suspendLock,
    dispose() {
      cancelDeferredLock();
      for (const handle of handles) void handle.then((h) => h.remove()).catch(() => undefined);
    },
  };
}
