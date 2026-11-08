/**
 * Platform helpers: Tauri / native-app detection, native file dialogs and device naming.
 * The Tauri plugins are imported lazily so the browser bundle never touches them, and the
 * Capacitor runtime is only read through its global, so this module never imports it.
 */
import { apiBaseKind, isNativeApp, isTauri } from '@/api';
import { dir, getCurrentLocale, tr } from '@/i18n/runtime';

// Both detections live in src/api/client.ts (the API base depends on them); re-exported here for the UI.
export { isNativeApp, isTauri };

/**
 * True only in the desktop's LOCAL-MODE developer / test build (`VITE_LOCAL_SERVER=1`, src/config/server-default.ts):
 * the diary server runs on this computer, so the backup / export / restore cards send it a path chosen in the
 * native dialog and the server reads or writes the file itself (`destPath` / `srcPath`).
 *
 * False in the published Windows app: it is a thin client of the Your Personal Diary server
 * (docs/android-tasks/HOSTED-IMPL.md item 8), which is not on this computer and refuses a path. There the cards
 * download the file and save it with `saveFileWithDialog`, and restore uploads the file chosen in the file input,
 * as the web UI does.
 */
export function usesLocalFilePaths(): boolean {
  return apiBaseKind() === 'local-server';
}

/** Header names of the `save_file` shell command (src-tauri/src/lib.rs, `SAVE_FILE_HEADER_*`); values are URI-encoded. */
export const SAVE_FILE_HEADERS = {
  fileName: 'x-mpd-file-name',
  filterName: 'x-mpd-filter-name',
  filterExtensions: 'x-mpd-filter-extensions',
  title: 'x-mpd-dialog-title',
} as const;

/**
 * Windows app (server mode): saves a file the server produced (a backup, an export) through the native
 * "save as" dialog. The SHELL shows the dialog and writes the file (`save_file`, src-tauri/src/lib.rs): the
 * page hands over the bytes and a suggested name, never a path, so nothing running in the WebView can choose
 * where a file is written. Resolves with the name of the saved file, or null when the dialog was cancelled;
 * rejects when the file could not be written.
 */
export async function saveFileWithDialog(blob: Blob, suggestedName: string, filter: FileFilter): Promise<string | null> {
  const { invoke } = await import('@tauri-apps/api/core');
  const bytes = new Uint8Array(typeof blob.arrayBuffer === 'function' ? await blob.arrayBuffer() : await new Response(blob).arrayBuffer());
  const saved = await invoke<string | null>('save_file', bytes, {
    headers: {
      [SAVE_FILE_HEADERS.fileName]: encodeURIComponent(suggestedName),
      [SAVE_FILE_HEADERS.filterName]: encodeURIComponent(filter.name),
      [SAVE_FILE_HEADERS.filterExtensions]: encodeURIComponent(filter.extensions.join(',')),
      [SAVE_FILE_HEADERS.title]: encodeURIComponent(tr('shell.dialog.saveFile')),
    },
  });
  return saved ?? null;
}

export interface FileFilter {
  /** Filter name shown in the dialog (localised), e.g. "Backup file". */
  name: string;
  /** Extensions without a dot, e.g. ["mpd"]. */
  extensions: string[];
}

/** The part of the global `Capacitor` object (set by the native bridge / @capacitor/core) used here. */
interface CapacitorGlobal {
  getPlatform?: () => string;
}

function capacitorGlobal(): CapacitorGlobal | undefined {
  return (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export type PlatformName = 'desktop' | 'android' | 'ios' | 'browser';

/** Where the UI runs: the desktop app (Tauri), the Android / iOS app (Capacitor) or a browser. */
export function platformName(): PlatformName {
  if (isTauri()) return 'desktop';
  if (isNativeApp()) {
    const platform = capacitorGlobal()?.getPlatform?.();
    if (platform === 'android' || platform === 'ios') return platform;
  }
  return 'browser';
}

/** True when the UI runs in a phone/tablet browser (by user agent). */
export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** Device label sent with login/register ("Computer" / "Phone" / "Browser", in the current language). */
export function deviceName(): string {
  if (isTauri()) return tr('shell.device.computer');
  if (isMobileBrowser()) return tr('shell.device.phone');
  return tr('shell.device.browser');
}

/**
 * Opens the native "save as" dialog (desktop only).
 * Resolves with the chosen absolute path, or null when cancelled / not on desktop.
 */
export async function pickSavePath(defaultName: string, filters: FileFilter[] = []): Promise<string | null> {
  if (!isTauri()) return null;
  const { save } = await import('@tauri-apps/plugin-dialog');
  const chosen = await save({ defaultPath: defaultName, filters, title: tr('shell.dialog.saveFile') });
  return chosen ?? null;
}

/**
 * Opens the native "open file" dialog (desktop only).
 * Resolves with the chosen absolute path, or null when cancelled / not on desktop.
 */
export async function pickOpenPath(filters: FileFilter[] = []): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const chosen = await open({ multiple: false, directory: false, filters, title: tr('shell.dialog.openFile') });
  if (!chosen) return null;
  return Array.isArray(chosen) ? (chosen[0] ?? null) : chosen;
}

/**
 * Shows a local notification. Desktop: Tauri notification plugin (permission is
 * requested once). Browser: the Notification API when already granted.
 * Resolves true when a system notification was shown, false otherwise.
 */
let tauriPermissionChecked: Promise<boolean> | null = null;

export async function showSystemNotification(title: string, body: string): Promise<boolean> {
  if (isTauri()) {
    try {
      const mod = await import('@tauri-apps/plugin-notification');
      if (!tauriPermissionChecked) {
        tauriPermissionChecked = (async () => {
          let granted = await mod.isPermissionGranted();
          if (!granted) granted = (await mod.requestPermission()) === 'granted';
          return granted;
        })();
      }
      const granted = await tauriPermissionChecked;
      if (!granted) return false;
      mod.sendNotification({ title, body });
      return true;
    } catch {
      return false;
    }
  }
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;
  try {
    const n = new Notification(title, { body, lang: getCurrentLocale(), dir: dir() });
    window.setTimeout(() => n.close(), 15_000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Asks the browser for notification permission (must be called from a user
 * gesture, e.g. an "Enable notifications" button). No-op on the desktop (Tauri asks itself).
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (isTauri() || typeof Notification === 'undefined') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}
