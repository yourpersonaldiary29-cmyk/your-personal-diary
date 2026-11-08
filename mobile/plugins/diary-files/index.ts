/**
 * `DiaryFiles` - the local Capacitor plugin that moves files between the WebView and the phone's
 * file dialogs (WP-7). One JavaScript contract, two native sides:
 *  - Android: android/app/src/main/java/com/mydiary/app/plugins/DiaryFilesPlugin.java (registered in
 *    MainActivity) - the Storage Access Framework. No storage permission is needed: the user picks
 *    the destination (ACTION_CREATE_DOCUMENT) and the files the app is opened with arrive as content
 *    URIs the system granted to the app.
 *  - iOS: mobile/plugins/diary-files/ios/DiaryFilesPlugin.swift (a skeleton written on Windows,
 *    compiled first on a Mac - docs/APPLE-PLAN.md WP-A2 / WP-I2; the Mac steps: scripts/ios/README.he.md)
 *    - UIDocumentPickerViewController. iOS has no "save as" dialog for a file that does not exist
 *    yet: `createDocument` answers at once with a temporary `file://` URI inside the app's sandbox,
 *    the chunks are written there, and `closeWrite` presents the export sheet ("Save to Files") -
 *    so on iOS a cancelled save surfaces at `closeWrite` (`cancelled: true`), never at
 *    `createDocument`. mobile/platform/files.ts handles both orders.
 *
 * Data crosses the bridge in base64 chunks (mobile/platform/files.ts decides the chunk size), never
 * as one string holding a whole backup: a stream is opened once (`openWrite` / `openRead`) and
 * addressed by its handle until it is closed.
 */
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/** A file the user chose in the system "open" dialog (`openDocument`). */
export interface PickedFile {
  /** The content URI (Android) or `file://` URL (iOS) the system handed over; readable through `openRead`. */
  uri: string;
  /** Display name, e.g. "your-personal-diary-backup-dana-2026-10-17.mpd". */
  name: string;
  /** Size in bytes when the provider reports it. */
  size: number | null;
}

/** A file the app was opened with ("Open with Your Personal Diary" on a .mpd file). */
export interface OpenedFile extends PickedFile {
  /** Counter of the plugin: two deliveries of the same intent (iOS: of the same open-URL event) carry the same number. */
  seq: number;
}

/**
 * What `closeWrite` answers. Android resolves with nothing (the document was chosen before the
 * write, so a close is a close); iOS shows the export sheet here and says whether it was dismissed.
 */
export interface CloseWriteResult {
  /** iOS: the user dismissed the export sheet - nothing was saved and the temporary file is gone. */
  cancelled?: boolean;
}

export interface DiaryFilesPlugin {
  /**
   * Android: opens the system "save as" dialog; `uri` is null when the user cancelled.
   * iOS: creates a temporary file of that name and answers its `file://` URI at once (the sheet comes
   * at `closeWrite`); null only when the file could not be created.
   */
  createDocument(options: { name: string; mime: string }): Promise<{ uri: string | null }>;
  /**
   * Opens the system "open" dialog (Android: ACTION_OPEN_DOCUMENT, every file type - the backup
   * format has no registered MIME type; iOS: the document picker over every data file, as a copy).
   * `file` is null when the user cancelled. Used instead of the WebView's own <input type="file">
   * chooser, which the app cannot tell apart from leaving the app (see mobile/platform/lifecycle.ts).
   */
  openDocument(): Promise<{ file: PickedFile | null }>;
  /** Opens the document for writing (truncated). */
  openWrite(options: { uri: string }): Promise<{ handle: number }>;
  /** Appends one base64 chunk to an open write stream. */
  writeChunk(options: { handle: number; data: string }): Promise<void>;
  /**
   * Closes the stream; `abort` also deletes the half-written document (Android: when the provider
   * allows it; iOS: always - it is the app's own temporary file). iOS without `abort` presents the
   * export sheet and resolves once it is gone, with `cancelled` when the user dismissed it.
   */
  closeWrite(options: { handle: number; abort?: boolean }): Promise<CloseWriteResult | void>;
  /** The file the app was started with, once; null when there is none (or it was taken already). */
  takeOpenedFile(): Promise<{ file: OpenedFile | null }>;
  /** Opens a URI of `openDocument` / `takeOpenedFile` / `openFile` for reading (nothing else is readable). */
  openRead(options: { uri: string }): Promise<{ handle: number; name: string; size: number | null }>;
  /** Reads up to `length` bytes as base64; `done` once the end was reached (the last chunk may be empty). */
  readChunk(options: { handle: number; length: number }): Promise<{ data: string; done: boolean }>;
  closeRead(options: { handle: number }): Promise<void>;
  /** A file was opened with the app while it was running (Android: a new intent of the singleTask activity; iOS: an open-URL event). */
  addListener(eventName: 'openFile', listener: (file: OpenedFile) => void): Promise<PluginListenerHandle>;
}

export const DiaryFiles = registerPlugin<DiaryFilesPlugin>('DiaryFiles');
