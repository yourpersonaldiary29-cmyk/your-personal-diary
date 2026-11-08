/**
 * Browser download helper (the web UI). The Windows app saves a downloaded file through the
 * shell's native "save as" dialog instead (`saveFileWithDialog` in ./platform.ts), the Android app
 * through the phone file bridge below, and only the desktop's local-mode developer build lets its
 * local server write the file at a chosen path.
 */

/**
 * Saves a Blob through a temporary `<a download>` element.
 * Returns once the click has been dispatched; the object URL is revoked shortly after.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Give the browser a moment to start the download before revoking the URL.
  window.setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}

/** Saves text content as a UTF-8 file (with BOM so Excel opens Hebrew CSV correctly). */
export function saveText(text: string, fileName: string, mime = 'text/plain', withBom = false): void {
  const parts: BlobPart[] = withBom ? ['﻿', text] : [text];
  saveBlob(new Blob(parts, { type: `${mime};charset=utf-8` }), fileName);
}

// ---------------------------------------------------------------------------------------------
// Phone (Android app): the seam the native host fills in (mobile/platform/index.ts). On the phone
// a download link is not what the user expects: a file is saved through the system "save as"
// dialog or handed to the share sheet, and a backup the app was opened with ("Open with Your
// Personal Diary") arrives here for the restore card. The desktop never sets this - nothing of it
// is imported here, so the desktop bundle keeps only the two helpers above.
// ---------------------------------------------------------------------------------------------

export type PhoneSaveOutcome = 'saved' | 'cancelled';
export type PhoneShareOutcome = 'shared' | 'cancelled';
/** What a phone button does with a produced file. */
export type PhoneFileTarget = 'save' | 'share';

export interface PhoneFiles {
  /** "Save to device": the system dialog chooses where; resolves 'cancelled' when it was dismissed. */
  save(blob: Blob, fileName: string): Promise<PhoneSaveOutcome>;
  /** "Share": the system share sheet; resolves 'cancelled' when it was dismissed. */
  share(blob: Blob, fileName: string): Promise<PhoneShareOutcome>;
  /**
   * "Choose backup file": the system "open" dialog, read into a File; null when it was dismissed.
   * Replaces the WebView's own <input type="file"> chooser on the phone, which the app cannot tell
   * apart from leaving the app ("lock when I leave the app" would lock the diary under it).
   */
  pick(): Promise<File | null>;
  /** The backup file the app was opened with and nobody took yet (once), else null. */
  takeOpenedFile(): File | null;
  /** Called when the app is opened with a file while it runs; returns the unsubscribe function. */
  onOpenedFile(listener: (file: File) => void): () => void;
}

let phoneFiles: PhoneFiles | null = null;

/** Installed by the phone host at start-up (null removes it; tests use it). */
export function setPhoneFiles(impl: PhoneFiles | null): void {
  phoneFiles = impl;
}

/** The phone's file bridge, or null (desktop, browser, or before the host installed it). */
export function getPhoneFiles(): PhoneFiles | null {
  return phoneFiles;
}
