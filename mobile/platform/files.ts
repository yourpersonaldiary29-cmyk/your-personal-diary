/**
 * Files on the phone (WP-7): what the UI's "Save to device" and "Share" buttons do with the bytes
 * the core produced (a backup, an export), how a backup is chosen for the restore flow, and how a
 * `.mpd` the app was opened with becomes a `File` for that flow.
 *
 *  - Save: the system "save as" dialog (Storage Access Framework, no storage permission) through
 *    the local DiaryFiles plugin; the user picks the folder (Downloads, Drive, an SD card...).
 *    iOS (`os: 'ios'`, docs/APPLE-PLAN.md WP-A2) has no dialog for a file that does not exist yet:
 *    there `createDocument` answers a temporary file at once, the chunks go into it, and the export
 *    sheet is shown by `closeWrite`, which then says whether it was dismissed. The Android order of
 *    calls is untouched; the iOS order lives in `saveToDeviceIos`.
 *  - Pick: the system "open" dialog through the same plugin (ACTION_OPEN_DOCUMENT) instead of the
 *    WebView's <input type="file"> chooser - the WebView gives no sign that ITS chooser is open, so
 *    "lock when I leave the app" would lock the diary under it and the restore could never
 *    complete; the plugin's dialog holds the lock-suspension token like the others.
 *  - Share: the file is written to the app's cache directory with @capacitor/filesystem and handed
 *    to @capacitor/share (it turns the file:// URI into a FileProvider grant). The copy is NOT
 *    deleted the moment the sheet returns: the share plugin resolves when the chooser finishes,
 *    which is when the target app STARTS reading the grant (Drive uploads, Gmail attaches
 *    asynchronously). A copy that was never handed over (dismissed sheet, failure) is deleted at
 *    once; a shared one is removed at the next share and at the next app start
 *    (`cleanShareCache`), and Android may clear the cache directory itself meanwhile.
 *  - Open with: the plugin keeps the content URI of the VIEW intent; it is read back in chunks.
 *
 * Every system dialog here stops the app's activity (it is a full-screen activity of another
 * process), which @capacitor/app reports as leaving the app. `suspendLock` (the lifecycle's
 * token, mobile/platform/lifecycle.ts) is held while a dialog is open so that "lock when I leave
 * the app" does not lock the diary under the app's own dialog; flushing still happens.
 *
 * Binary data crosses the Capacitor bridge as base64 text, so everything here moves CHUNKS
 * (DEFAULT_FILE_CHUNK_BYTES, a multiple of 3 so the base64 pieces concatenate): a 10 MB backup is
 * never one 13 MB string on the main thread. The plugins are injected, so the tests run this code
 * against fakes; mobile/platform/index.ts hands it the real ones.
 */
import type { Directory, FilesystemPlugin } from '@capacitor/filesystem';
import type { SharePlugin } from '@capacitor/share';
import { readBlobBytes } from '../host/multipart';
import { base64ToBytes, bytesToBase64 } from '../host/storage/base64';
import type { DiaryFilesPlugin, OpenedFile, PickedFile } from '../plugins/diary-files';
import type { PhoneOs } from './os';

export type DiaryFilesLike = Pick<
  DiaryFilesPlugin,
  'createDocument' | 'openDocument' | 'openWrite' | 'writeChunk' | 'closeWrite' | 'takeOpenedFile' | 'openRead' | 'readChunk' | 'closeRead' | 'addListener'
>;
export type FilesystemLike = Pick<FilesystemPlugin, 'writeFile' | 'appendFile' | 'deleteFile' | 'rmdir'>;
export type ShareLike = Pick<SharePlugin, 'share'>;

/** 768 KiB of bytes = 1 MiB of base64 text per bridge call (the same size the storage bridge uses). */
export const DEFAULT_FILE_CHUNK_BYTES = 3 * 256 * 1024;
/** Folder inside the cache directory that holds the temporary copies handed to the share sheet. */
export const SHARE_CACHE_DIR = 'share';
export const DEFAULT_MIME = 'application/octet-stream';

/** MIME types of the files the app produces, by extension (the backup format has none of its own). */
const MIME_BY_EXTENSION: Record<string, string> = {
  mpd: DEFAULT_MIME,
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  pdf: 'application/pdf',
};

export type SaveOutcome = 'saved' | 'cancelled';
export type ShareOutcome = 'shared' | 'cancelled';

export interface PhoneFilesDeps {
  files: DiaryFilesLike;
  filesystem: FilesystemLike;
  share: ShareLike;
  /** The Capacitor cache directory (Directory.Cache); a parameter so the tests need no enum. */
  cacheDirectory: Directory;
  chunkBytes?: number;
  /** Unique part of the cache file name (default: the time). */
  uniqueName?: () => string;
  /**
   * Suspends "lock when I leave the app" while a system dialog of the app is open; returns the
   * release function (mobile/platform/lifecycle.ts `suspendLock`). Optional for the tests.
   */
  suspendLock?: () => () => void;
  /** The phone (mobile/platform/os.ts); default Android - the order of the save calls differs on iOS. */
  os?: PhoneOs;
}

/** The MIME type to announce for a file: the blob's own, else by extension, else octet-stream. */
export function mimeOf(blob: Blob, fileName: string): string {
  const own = blob.type.split(';')[0].trim();
  if (own) return own;
  const extension = fileName.toLowerCase().split('.').pop() ?? '';
  return MIME_BY_EXTENSION[extension] ?? DEFAULT_MIME;
}

/** A chunk size that keeps base64 pieces concatenable (a multiple of 3, at least 3). */
export function normalizeChunkBytes(chunkBytes: number | undefined): number {
  const wanted = Math.floor(chunkBytes ?? DEFAULT_FILE_CHUNK_BYTES);
  return Math.max(3, wanted - (wanted % 3));
}

/** The blob as consecutive base64 chunks of `chunkBytes` bytes each (the last one shorter). */
export async function* base64Chunks(blob: Blob, chunkBytes?: number): AsyncGenerator<string, void, undefined> {
  const size = normalizeChunkBytes(chunkBytes);
  for (let offset = 0; offset < blob.size; offset += size) {
    const bytes = await readBlobBytes(blob.slice(offset, Math.min(blob.size, offset + size)));
    yield bytesToBase64(new Uint8Array(bytes));
  }
}

/** Runs one system dialog of the app with the lock suspended for exactly its duration. */
async function withLockSuspended<T>(deps: Pick<PhoneFilesDeps, 'suspendLock'>, dialog: () => Promise<T>): Promise<T> {
  const release = deps.suspendLock?.() ?? (() => undefined);
  try {
    return await dialog();
  } finally {
    release();
  }
}

/** Writes every chunk of the blob to an open write stream; a failed chunk aborts the stream and rethrows. */
async function writeChunks(deps: PhoneFilesDeps, handle: number, blob: Blob): Promise<void> {
  try {
    for await (const data of base64Chunks(blob, deps.chunkBytes)) {
      await deps.files.writeChunk({ handle, data });
    }
  } catch (e) {
    await deps.files.closeWrite({ handle, abort: true }).catch(() => undefined);
    throw e;
  }
}

/** "Save to device": the system dialog, then the bytes in chunks (Android); iOS: `saveToDeviceIos`. */
export async function saveToDevice(deps: PhoneFilesDeps, blob: Blob, fileName: string): Promise<SaveOutcome> {
  if (deps.os === 'ios') return saveToDeviceIos(deps, blob, fileName);
  const { uri } = await withLockSuspended(deps, () => deps.files.createDocument({ name: fileName, mime: mimeOf(blob, fileName) }));
  if (!uri) return 'cancelled';
  const { handle } = await deps.files.openWrite({ uri });
  await writeChunks(deps, handle, blob);
  await deps.files.closeWrite({ handle });
  return 'saved';
}

/**
 * "Save to device" on iOS: the temporary file first, the bytes in chunks, and the export sheet at
 * `closeWrite` - the one call that can be cancelled. The lock suspension is held for the whole
 * sequence (the sheet is at its end), so "lock when I leave the app" never fires under it.
 */
export async function saveToDeviceIos(deps: PhoneFilesDeps, blob: Blob, fileName: string): Promise<SaveOutcome> {
  return withLockSuspended(deps, async () => {
    const { uri } = await deps.files.createDocument({ name: fileName, mime: mimeOf(blob, fileName) });
    if (!uri) return 'cancelled';
    const { handle } = await deps.files.openWrite({ uri });
    await writeChunks(deps, handle, blob);
    const result = await deps.files.closeWrite({ handle });
    return result?.cancelled ? 'cancelled' : 'saved';
  });
}

/** "Choose backup file": the system "open" dialog, then the chosen file read in chunks; null when dismissed. */
export async function pickFile(deps: PhoneFilesDeps): Promise<File | null> {
  const { file } = await withLockSuspended(deps, () => deps.files.openDocument());
  if (!file) return null;
  return readOpenedFile(deps.files, file, deps.chunkBytes);
}

/** The share plugin rejects with "Share canceled" when the user dismisses the sheet. */
export function isShareCancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /cancel/i.test(message);
}

/** Characters a cache file name may carry (the share sheet shows the title, not this name). */
function safeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^\w.-]+/g, '_').replace(/^\.+/, '');
  return cleaned || 'file';
}

/**
 * Removes the copies of earlier shares from the cache directory (best effort: nothing there is
 * fine). Called before every share and once at app start.
 */
export async function cleanShareCache(deps: Pick<PhoneFilesDeps, 'filesystem' | 'cacheDirectory'>): Promise<void> {
  await deps.filesystem.rmdir({ path: SHARE_CACHE_DIR, directory: deps.cacheDirectory, recursive: true }).catch(() => undefined);
}

/**
 * "Share": the copies of earlier shares are removed, a temporary copy of this file is written to
 * the cache directory and handed to the share sheet. A copy nobody took (dismissed sheet, failure)
 * is deleted at once; a shared one stays until the next share / app start (see the module comment).
 */
export async function shareFile(deps: PhoneFilesDeps, blob: Blob, fileName: string): Promise<ShareOutcome> {
  await cleanShareCache(deps);
  const unique = (deps.uniqueName ?? (() => String(Date.now())))();
  const path = `${SHARE_CACHE_DIR}/${unique}-${safeFileName(fileName)}`;
  const directory = deps.cacheDirectory;
  let handedOver = false;
  try {
    let uri: string | null = null;
    for await (const data of base64Chunks(blob, deps.chunkBytes)) {
      if (uri === null) uri = (await deps.filesystem.writeFile({ path, data, directory, recursive: true })).uri;
      else await deps.filesystem.appendFile({ path, data, directory });
    }
    // An empty file still has to exist for the sheet.
    const shareUri = uri ?? (await deps.filesystem.writeFile({ path, data: '', directory, recursive: true })).uri;
    try {
      await withLockSuspended(deps, () => deps.share.share({ title: fileName, dialogTitle: fileName, files: [shareUri] }));
    } catch (e) {
      if (isShareCancelled(e)) return 'cancelled';
      throw e;
    }
    handedOver = true;
    return 'shared';
  } finally {
    // The receiving app reads the grant after the sheet returned: only a copy nobody received goes now.
    if (!handedOver) await deps.filesystem.deleteFile({ path, directory }).catch(() => undefined);
  }
}

/** Reads a file the app was opened with (or the user picked), in chunks, into a `File` the restore flow understands. */
export async function readOpenedFile(files: DiaryFilesLike, opened: Pick<PickedFile, 'uri' | 'name'>, chunkBytes?: number): Promise<File> {
  const length = normalizeChunkBytes(chunkBytes);
  const { handle, name } = await files.openRead({ uri: opened.uri });
  const parts: Uint8Array[] = [];
  try {
    for (;;) {
      const { data, done } = await files.readChunk({ handle, length });
      // A copy with its own buffer: a Blob part must not be a view into a shared / pooled buffer.
      if (data) parts.push(new Uint8Array(base64ToBytes(data)));
      if (done) break;
    }
  } finally {
    await files.closeRead({ handle }).catch(() => undefined);
  }
  const fileName = name || opened.name || 'backup.mpd';
  return new File(parts as BlobPart[], fileName, { type: mimeOf(new Blob(), fileName) });
}

/**
 * Delivers every file the app is opened with: the one it was started with (taken once from the
 * plugin) and later ones (the `openFile` event). The plugin numbers the deliveries (`seq`), so a
 * file that arrives through both paths is reported once. Returns the function that stops watching.
 */
export function watchOpenedFiles(files: DiaryFilesLike, onFile: (file: OpenedFile) => void): () => void {
  let stopped = false;
  let lastSeq = -1;
  const deliver = (file: OpenedFile | null) => {
    if (stopped || !file || file.seq === lastSeq) return;
    lastSeq = file.seq;
    onFile(file);
  };
  const handle = files.addListener('openFile', deliver);
  void handle.then(() => files.takeOpenedFile()).then(({ file }) => deliver(file), () => undefined);
  return () => {
    stopped = true;
    void handle.then((h) => h.remove()).catch(() => undefined);
  };
}
