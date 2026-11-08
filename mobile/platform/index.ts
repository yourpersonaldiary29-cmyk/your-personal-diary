/**
 * The phone-native features of the Android app (WP-7 files, WP-8 reminders, WP-9 lock /
 * lifecycle / biometrics / back button / privacy screen / system bars, WP-H10d the platform seams of
 * the automatic offline mode - mobile/platform/offline.ts), wired together.
 * `installPhonePlatform` runs before the app renders, and only inside the installed app
 * (`isNativeApp()`); in a browser nothing here runs. Who calls it depends on the build:
 *  - the published, server-only app (mobile/host/server-mode.ts): on a `PlatformHost` without a
 *    diary core - the transport is `fetch` to the Your Personal Diary server, there are no core
 *    events, "lock when I leave" locks the session on the server;
 *  - the local-core build (mobile/host/boot.ts, MOBILE_LOCAL_CORE=1): on the core client, once the
 *    core is ready.
 * Everything below is the same in both: the features never ask which host they run on.
 *
 * ANDROID AND iOS. The same code serves both phones. The few places that differ take the phone as
 * `os` (mobile/platform/os.ts, from `Capacitor.getPlatform()` - read once, here): the order of the
 * "save as" calls (files.ts), the reminders without a channel and with iOS's 64-notification cap
 * (notifications.ts), what counts as leaving the app (lifecycle.ts) and the folder of the outbox
 * mirror (offline.ts). Everything that is not iOS - Android, and the browser of `npm run
 * mobile:dev` - takes the Android paths, which are what they were before iOS existed
 * (docs/APPLE-PLAN.md WP-A2; the iOS side is first run on a Mac, scripts/ios/README.he.md).
 *
 * The React UI never imports Capacitor: it reaches these features through small seams that the
 * desktop never fills in -
 *   src/utils/download.ts          setPhoneFiles      "Save to device", "Share", "Choose backup file", "Open with"
 *   src/hooks/useReminders.ts      setPhoneReminders  permission, "show habit names", re-planning
 *   src/context/LockContext.tsx    setPhoneSecurity   lock on leave, privacy screen, biometrics
 *   src/offline/seams.ts           setOfflinePlatform Keystore key vault, outbox mirror, screen-lock check; notifyResume
 * - and the API transport is wrapped so that a request that changed the habits (a log, an edit, a
 *   restore...) re-plans the reminders, whichever host answered it.
 */
import { App } from '@capacitor/app';
import { Capacitor, SystemBars } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { habits as habitsApi, LOCKED_EVENT } from '@/api';
import { ApiClientError, request, setApiTransport, type ApiTransport } from '@/api/client';
import { PATHS } from '@/constants/routes';
import { setPhoneSecurity, type PhoneBiometric, type PhoneSecurity } from '@/context/LockContext';
import { setPhoneReminders, type PhoneReminders } from '@/hooks/useReminders';
import { tr } from '@/i18n/runtime';
import { handleBack } from '@/utils/back-handler';
import { todayIso } from '@/utils/dates';
import { setPhoneFiles, type PhoneFiles } from '@/utils/download';
import { notifyResume } from '@/offline/seams';
import { CapacitorFilesystemStorage } from '../host/storage/capacitor-filesystem';
import type { CoreEvent } from '../shared/transport';
import { DiaryBiometric } from '../plugins/diary-biometric';
import { DiaryFiles } from '../plugins/diary-files';
import { DiaryOffline } from '../plugins/diary-offline';
import { DiaryPrivacyScreen } from '../plugins/diary-privacy-screen';
import { BIOMETRIC_UNLOCK_ENABLED, createBiometricUnlock, type BiometricCore } from './biometric';
import { cleanShareCache, pickFile, readOpenedFile, saveToDevice, shareFile, watchOpenedFiles, type PhoneFilesDeps } from './files';
import { installLifecycle } from './lifecycle';
import { createReminderScheduler, observeHabitChanges } from './notifications';
import { installPhoneOffline, MIRROR_BASE, mirrorDirectory } from './offline';
import { phoneOsOf } from './os';
import { createPhonePrefsStore } from './prefs';
import { syncPrivacyScreen } from './privacy-screen';
import { followThemeWithSystemBars } from './ui';

/**
 * What the phone features need from whoever answers the API - the diary core of the local-core
 * build (mobile/host/core-client.ts `CoreClient` has exactly this shape) or the server of the
 * published app (mobile/host/server-mode.ts `serverHost()`).
 */
export interface PlatformHost {
  /** The transport the API client uses with this host (wrapped here to watch the habit changes). */
  readonly transport: ApiTransport;
  /** Subscribes to the host's events (`habits-changed`); a host without events returns a no-op unsubscribe. */
  onEvent(listener: (event: CoreEvent) => void): () => void;
  /** "Lock when I leave the app" / "write everything down before the app may be killed". */
  control(action: 'flushAll' | 'lockAll'): Promise<void>;
}

export interface PhonePlatformOptions {
  host: PlatformHost;
  /** Navigation for "open with" and notification taps (default: the hash of the HashRouter). */
  navigate?: (path: string) => void;
}

function hashNavigate(path: string): void {
  window.location.hash = `#${path}`;
}

/**
 * The core side of the biometric contract (see mobile/platform/biometric.ts for the endpoints).
 * Only reached while BIOMETRIC_UNLOCK_ENABLED is true.
 */
const biometricCore: BiometricCore = {
  async createToken(password) {
    const { token } = await request<{ token: string }>('/api/auth/biometric/enroll', { method: 'POST', body: { password } });
    return token;
  },
  async unlockWithToken(token) {
    try {
      await request<void>('/api/auth/biometric/unlock', { method: 'POST', body: { token } });
      return true;
    } catch {
      return false;
    }
  },
  async revokeToken() {
    await request<void>('/api/auth/biometric', { method: 'DELETE' });
  },
};

/** Installs everything; resolves with the function that removes it again (tests). */
export async function installPhonePlatform(options: PhonePlatformOptions): Promise<() => void> {
  const { host } = options;
  const navigate = options.navigate ?? hashNavigate;
  const disposers: Array<() => void> = [];
  // Which phone this is; anything but iOS takes the Android paths (see the module comment).
  const os = phoneOsOf(Capacitor.getPlatform());

  const prefs = createPhonePrefsStore(Preferences);
  await prefs.load();

  // WP-9 privacy screen: the native side applied the stored value at start; follow changes.
  disposers.push(syncPrivacyScreen(prefs, DiaryPrivacyScreen));

  // WP-8 reminders.
  const scheduler = createReminderScheduler({
    plugin: LocalNotifications,
    loadHabits: () => habitsApi.list(false),
    loadProgress: () => habitsApi.progress(todayIso()),
    // Only a lost session (401) cancels the plan; a LOCKED session (423) keeps it - see notifications.ts.
    isSessionGone: (e) => e instanceof ApiClientError && e.status === 401,
    texts: () => ({
      title: tr('shell.reminderTitle'),
      genericBody: tr('mobile.reminders.genericBody'),
      namedBody: (habitName) => tr('server.habits.reminder', { habitName }),
      channelName: tr('mobile.reminders.channel'),
      channelDescription: tr('mobile.reminders.channelDescription'),
    }),
    onTap: () => navigate(PATHS.habits),
    os,
  });
  disposers.push(scheduler.start());
  const reminderListeners = new Set<() => void>();
  const notifyReminderListeners = () => {
    for (const listener of reminderListeners) listener();
  };
  const phoneReminders: PhoneReminders = {
    permission: () => scheduler.permission(),
    async requestPermission() {
      const state = await scheduler.requestPermission();
      notifyReminderListeners();
      return state;
    },
    sync: ({ enabled }) => scheduler.sync({ enabled, showNames: prefs.get().showHabitNames }),
    getShowNames: () => prefs.get().showHabitNames,
    async setShowNames(value) {
      await prefs.update({ showHabitNames: value });
    },
    subscribe(listener) {
      reminderListeners.add(listener);
      return () => {
        reminderListeners.delete(listener);
      };
    },
  };
  setPhoneReminders(phoneReminders);
  disposers.push(() => setPhoneReminders(null));
  // A changed phone setting ("show habit names") makes the hook re-plan with the new texts.
  disposers.push(prefs.subscribe(notifyReminderListeners));
  disposers.push(
    host.onEvent((event) => {
      if (event.name === 'habits-changed') scheduler.resync();
    }),
  );
  // The transport sees every change of the habits whichever host answers (the server posts no
  // events; the core's event and this arrive together and the debounce makes one sync of them).
  setApiTransport(observeHabitChanges(host.transport, () => scheduler.resync()));
  disposers.push(() => setApiTransport(host.transport));

  // WP-9 lifecycle and Back (before the files: their system dialogs hold its lock-suspension token).
  const lifecycle = installLifecycle({
    app: App,
    control: (action) => host.control(action),
    shouldLockOnLeave: () => prefs.get().lockOnLeave,
    onLocked: () => window.dispatchEvent(new Event(LOCKED_EVENT)),
    handleBack,
    onResume: () => {
      scheduler.resync();
      // WP-H10d: the offline engine's connectivity monitor probes at once (OFFLINE-DESIGN 4.2).
      notifyResume();
    },
    os,
  });
  disposers.push(() => lifecycle.dispose());

  // WP-H10d automatic offline mode: the Keystore key vault, the outbox mirror in Directory.Data
  // (iOS: the Keychain-held key and Directory.LibraryNoCloud) and the screen-lock check (the engine
  // in src/offline uses them only while offline mode is enabled).
  disposers.push(
    installPhoneOffline({
      plugin: DiaryOffline,
      mirrorStorage: new CapacitorFilesystemStorage(Filesystem, { base: MIRROR_BASE, directory: mirrorDirectory(os) }),
      suspendLock: () => lifecycle.suspendLock(),
      os,
    }),
  );

  // WP-7 files.
  const fileDeps: PhoneFilesDeps = {
    files: DiaryFiles,
    filesystem: Filesystem,
    share: Share,
    cacheDirectory: Directory.Cache,
    suspendLock: () => lifecycle.suspendLock(),
    os,
  };
  // The copy handed to the last share sheet of the previous run is not needed any more.
  void cleanShareCache(fileDeps);
  const openedListeners = new Set<(file: File) => void>();
  let pendingOpened: File | null = null;
  disposers.push(
    watchOpenedFiles(DiaryFiles, (opened) => {
      void readOpenedFile(DiaryFiles, opened).then(
        (file) => {
          if (openedListeners.size > 0) for (const listener of openedListeners) listener(file);
          else pendingOpened = file;
          navigate(PATHS.backup);
        },
        (e) => console.warn('[mobile] the opened file could not be read', e),
      );
    }),
  );
  const phoneFiles: PhoneFiles = {
    save: (blob, fileName) => saveToDevice(fileDeps, blob, fileName),
    share: (blob, fileName) => shareFile(fileDeps, blob, fileName),
    pick: () => pickFile(fileDeps),
    takeOpenedFile() {
      const file = pendingOpened;
      pendingOpened = null;
      return file;
    },
    onOpenedFile(listener) {
      openedListeners.add(listener);
      return () => {
        openedListeners.delete(listener);
      };
    },
  };
  setPhoneFiles(phoneFiles);
  disposers.push(() => setPhoneFiles(null));

  // WP-9 security settings (+ biometrics behind its feature flag).
  const biometric: PhoneBiometric | null = BIOMETRIC_UNLOCK_ENABLED
    ? createBiometricUnlock({
        plugin: DiaryBiometric,
        core: biometricCore,
        texts: () => ({ title: tr('mobile.lock.biometricTitle'), negative: tr('mobile.lock.usePassword') }),
        onEnabledChange: async (enabled) => {
          await prefs.update({ biometricUnlock: enabled });
        },
      })
    : null;
  const security: PhoneSecurity = {
    get() {
      const { lockOnLeave, privacyScreen, biometricUnlock } = prefs.get();
      return { lockOnLeave, privacyScreen, biometricUnlock };
    },
    async setLockOnLeave(value) {
      await prefs.update({ lockOnLeave: value });
    },
    async setPrivacyScreen(value) {
      await prefs.update({ privacyScreen: value });
    },
    subscribe(listener) {
      return prefs.subscribe(() => listener(security.get()));
    },
    biometric,
  };
  setPhoneSecurity(security);
  disposers.push(() => setPhoneSecurity(null));

  // WP-9 system bars follow the theme.
  disposers.push(
    followThemeWithSystemBars(SystemBars, {
      root: document.documentElement,
      darkQuery: typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null,
    }),
  );

  return () => {
    for (const dispose of disposers.splice(0).reverse()) {
      try {
        dispose();
      } catch {
        /* best effort */
      }
    }
  };
}
