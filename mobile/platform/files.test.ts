/**
 * Files on the phone (WP-7): chunked "Save to device", "Choose backup file" through the plugin's
 * open dialog, "Share" with the cache copy removed at the right moment, the lock-suspension token
 * held while a system dialog is open, reading an opened file in chunks, and the de-duplicated
 * delivery of opened files.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Directory } from '@capacitor/filesystem';
import { readBlobBytes } from '../host/multipart';
import { base64ToBytes } from '../host/storage/base64';
import type { OpenedFile } from '../plugins/diary-files';
import {
  base64Chunks,
  cleanShareCache,
  DEFAULT_FILE_CHUNK_BYTES,
  isShareCancelled,
  mimeOf,
  normalizeChunkBytes,
  pickFile,
  readOpenedFile,
  saveToDevice,
  SHARE_CACHE_DIR,
  shareFile,
  watchOpenedFiles,
  type DiaryFilesLike,
  type FilesystemLike,
  type PhoneFilesDeps,
  type ShareLike,
} from './files';

const CACHE = 'CACHE' as Directory;

function bytesOf(size: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) out[i] = (i * 31 + 7) & 0xff;
  return out;
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await readBlobBytes(blob));
}

/**
 * A fake DiaryFiles plugin: documents are byte arrays, streams are handles. `closeWriteResult` is
 * what `closeWrite` answers - nothing (Android) or the iOS export sheet's outcome.
 */
function fakeDiaryFiles(options: { cancel?: boolean; opened?: OpenedFile | null; failWriteAt?: number; picked?: string | null; closeWriteResult?: { cancelled?: boolean } } = {}) {
  const documents = new Map<string, number[]>();
  const writeChunks: number[] = [];
  let listener: ((file: OpenedFile) => void) | null = null;
  let handles = 0;
  const writers = new Map<number, string>();
  const readers = new Map<number, { data: Uint8Array; offset: number }>();
  const sources = new Map<string, Uint8Array>();
  const plugin: DiaryFilesLike & {
    documents: typeof documents;
    writeChunks: number[];
    sources: typeof sources;
    emitOpen(file: OpenedFile): void;
    closeCalls: Array<{ handle: number; abort?: boolean }>;
  } = {
    documents,
    writeChunks,
    sources,
    closeCalls: [],
    emitOpen: (file) => listener?.(file),
    createDocument: vi.fn(async ({ name }) => ({ uri: options.cancel ? null : `content://docs/${name}` })),
    openDocument: vi.fn(async () => {
      const uri = options.picked ?? null;
      if (!uri) return { file: null };
      return { file: { uri, name: uri.split('/').pop() ?? '', size: sources.get(uri)?.length ?? null } };
    }),
    openWrite: vi.fn(async ({ uri }) => {
      const handle = ++handles;
      writers.set(handle, uri);
      documents.set(uri, []);
      return { handle };
    }),
    writeChunk: vi.fn(async ({ handle, data }) => {
      if (options.failWriteAt !== undefined && writeChunks.length === options.failWriteAt) throw new Error('disk full');
      const uri = writers.get(handle);
      if (!uri) throw new Error('unknown handle');
      const bytes = base64ToBytes(data);
      writeChunks.push(bytes.length);
      documents.get(uri)!.push(...bytes);
    }),
    closeWrite: vi.fn(async ({ handle, abort }) => {
      plugin.closeCalls.push({ handle, abort });
      const uri = writers.get(handle);
      writers.delete(handle);
      if (abort && uri) documents.delete(uri);
      return options.closeWriteResult;
    }),
    takeOpenedFile: vi.fn(async () => ({ file: options.opened ?? null })),
    openRead: vi.fn(async ({ uri }) => {
      const data = sources.get(uri);
      if (!data) throw new Error('no such file');
      const handle = ++handles;
      readers.set(handle, { data, offset: 0 });
      return { handle, name: uri.split('/').pop() ?? '', size: data.length };
    }),
    readChunk: vi.fn(async ({ handle, length }) => {
      const reader = readers.get(handle)!;
      const slice = reader.data.slice(reader.offset, reader.offset + length);
      reader.offset += slice.length;
      const done = reader.offset >= reader.data.length;
      return { data: slice.length ? Buffer.from(slice).toString('base64') : '', done };
    }),
    closeRead: vi.fn(async ({ handle }) => {
      readers.delete(handle);
    }),
    addListener: vi.fn(async (_name: 'openFile', fn: (file: OpenedFile) => void) => {
      listener = fn;
      return { remove: async () => undefined };
    }),
  };
  return plugin;
}

function fakeFilesystem() {
  const files = new Map<string, number[]>();
  const fs: FilesystemLike & { files: typeof files } = {
    files,
    writeFile: vi.fn(async ({ path, data }) => {
      files.set(path, [...base64ToBytes(data as string)]);
      return { uri: `file:///cache/${path}` };
    }),
    appendFile: vi.fn(async ({ path, data }) => {
      files.get(path)!.push(...base64ToBytes(data as string));
    }),
    deleteFile: vi.fn(async ({ path }) => {
      files.delete(path);
    }),
    rmdir: vi.fn(async ({ path }) => {
      for (const key of [...files.keys()]) if (key === path || key.startsWith(`${path}/`)) files.delete(key);
    }),
  };
  return fs;
}

/** A fake lifecycle token: counts the suspensions and records when they were held. */
function fakeSuspend() {
  let active = 0;
  const log: string[] = [];
  return {
    log,
    get active() {
      return active;
    },
    suspendLock: vi.fn(() => {
      active++;
      log.push('suspend');
      return () => {
        active--;
        log.push('release');
      };
    }),
  };
}

function deps(overrides: Partial<PhoneFilesDeps> = {}): PhoneFilesDeps & { files: ReturnType<typeof fakeDiaryFiles>; filesystem: ReturnType<typeof fakeFilesystem>; share: ShareLike } {
  return {
    files: fakeDiaryFiles(),
    filesystem: fakeFilesystem(),
    share: { share: vi.fn(async () => ({ activityType: 'x' })) },
    cacheDirectory: CACHE,
    chunkBytes: 300,
    uniqueName: () => 'u',
    ...overrides,
  } as never;
}

describe('chunking', () => {
  it('splits a blob into base64 pieces of a multiple of 3 bytes that concatenate to the original', async () => {
    const data = bytesOf(1000);
    const chunks: string[] = [];
    for await (const chunk of base64Chunks(new Blob([data]), 301)) chunks.push(chunk);
    expect(chunks).toHaveLength(Math.ceil(1000 / 300));
    expect(base64ToBytes(chunks.join(''))).toEqual(data);
    expect(normalizeChunkBytes(301)).toBe(300);
    expect(normalizeChunkBytes(1)).toBe(3);
    expect(normalizeChunkBytes(undefined)).toBe(DEFAULT_FILE_CHUNK_BYTES);
    expect(DEFAULT_FILE_CHUNK_BYTES % 3).toBe(0);
  });

  it('a 10 MB backup crosses the bridge in ~1 MiB base64 pieces, never as one string', async () => {
    const size = 10 * 1024 * 1024;
    const blob = new Blob([new Uint8Array(size)]);
    const started = performance.now();
    let count = 0;
    let largest = 0;
    for await (const chunk of base64Chunks(blob)) {
      count++;
      largest = Math.max(largest, chunk.length);
    }
    const ms = performance.now() - started;
    expect(count).toBe(Math.ceil(size / DEFAULT_FILE_CHUNK_BYTES));
    expect(largest).toBe((DEFAULT_FILE_CHUNK_BYTES / 3) * 4);
    // Informational: the encoding cost on this machine (the WebView does the same work per chunk).
    console.info(`[files] 10 MB -> ${count} chunks of <= ${largest} base64 chars in ${ms.toFixed(0)} ms`);
  });

  it('mimeOf: the blob type, else the extension, else octet-stream', () => {
    expect(mimeOf(new Blob([], { type: 'application/pdf' }), 'x.bin')).toBe('application/pdf');
    expect(mimeOf(new Blob([], { type: 'text/csv;charset=utf-8' }), 'x.csv')).toBe('text/csv');
    expect(mimeOf(new Blob([]), 'diary.mpd')).toBe('application/octet-stream');
    expect(mimeOf(new Blob([]), 'export.JSON')).toBe('application/json');
    expect(mimeOf(new Blob([]), 'noext')).toBe('application/octet-stream');
  });
});

describe('saveToDevice', () => {
  it('writes the document in chunks and closes it', async () => {
    const d = deps();
    const data = bytesOf(1234);
    const outcome = await saveToDevice(d, new Blob([data]), 'backup.mpd');
    expect(outcome).toBe('saved');
    expect(d.files.createDocument).toHaveBeenCalledWith({ name: 'backup.mpd', mime: 'application/octet-stream' });
    expect(d.files.writeChunks).toEqual([300, 300, 300, 300, 34]);
    expect(new Uint8Array(d.files.documents.get('content://docs/backup.mpd')!)).toEqual(data);
    expect(d.files.closeCalls).toEqual([{ handle: 1, abort: undefined }]);
  });

  it('reports a cancelled dialog without opening anything', async () => {
    const d = deps({ files: fakeDiaryFiles({ cancel: true }) });
    expect(await saveToDevice(d, new Blob([bytesOf(10)]), 'backup.mpd')).toBe('cancelled');
    expect(d.files.openWrite).not.toHaveBeenCalled();
  });

  it('aborts the document when a chunk cannot be written and rethrows', async () => {
    const d = deps({ files: fakeDiaryFiles({ failWriteAt: 2 }) });
    await expect(saveToDevice(d, new Blob([bytesOf(1000)]), 'backup.mpd')).rejects.toThrow('disk full');
    expect(d.files.closeCalls).toEqual([{ handle: 1, abort: true }]);
    expect(d.files.documents.has('content://docs/backup.mpd')).toBe(false);
  });

  it('on Android the answer of closeWrite is not read: the dialog came first, a close is a close', async () => {
    const d = deps({ files: fakeDiaryFiles({ closeWriteResult: { cancelled: true } }) });
    expect(await saveToDevice(d, new Blob([bytesOf(10)]), 'backup.mpd')).toBe('saved');
  });
});

describe('saveToDevice on iOS (the export sheet is shown by closeWrite)', () => {
  const ios = (files = fakeDiaryFiles(), suspendLock?: () => () => void) => deps({ files, os: 'ios', suspendLock });

  it('writes the temporary file in chunks and closes it; the sheet confirmed means "saved"', async () => {
    const d = ios(fakeDiaryFiles({ closeWriteResult: { cancelled: false } }));
    const data = bytesOf(1234);
    expect(await saveToDevice(d, new Blob([data]), 'backup.mpd')).toBe('saved');
    expect(d.files.createDocument).toHaveBeenCalledWith({ name: 'backup.mpd', mime: 'application/octet-stream' });
    expect(d.files.writeChunks).toEqual([300, 300, 300, 300, 34]);
    expect(new Uint8Array(d.files.documents.get('content://docs/backup.mpd')!)).toEqual(data);
    expect(d.files.closeCalls).toEqual([{ handle: 1, abort: undefined }]);
  });

  it('a dismissed sheet is "cancelled" - after the chunks were written, since the sheet comes last', async () => {
    const d = ios(fakeDiaryFiles({ closeWriteResult: { cancelled: true } }));
    expect(await saveToDevice(d, new Blob([bytesOf(10)]), 'backup.mpd')).toBe('cancelled');
    expect(d.files.writeChunks).toEqual([10]);
    expect(d.files.closeCalls).toEqual([{ handle: 1, abort: undefined }]);
  });

  it('a plugin that answers nothing (an older native build) counts as saved; no temporary file counts as cancelled', async () => {
    expect(await saveToDevice(ios(), new Blob([bytesOf(10)]), 'backup.mpd')).toBe('saved');
    const noFile = ios(fakeDiaryFiles({ cancel: true }));
    expect(await saveToDevice(noFile, new Blob([bytesOf(10)]), 'backup.mpd')).toBe('cancelled');
    expect(noFile.files.openWrite).not.toHaveBeenCalled();
  });

  it('aborts the temporary file when a chunk cannot be written and rethrows, without showing the sheet', async () => {
    const d = ios(fakeDiaryFiles({ failWriteAt: 2 }));
    await expect(saveToDevice(d, new Blob([bytesOf(1000)]), 'backup.mpd')).rejects.toThrow('disk full');
    expect(d.files.closeCalls).toEqual([{ handle: 1, abort: true }]);
    expect(d.files.documents.has('content://docs/backup.mpd')).toBe(false);
  });

  it('holds the lock suspension for the whole save - the sheet is at its end - and releases it after', async () => {
    const suspend = fakeSuspend();
    const files = fakeDiaryFiles({ closeWriteResult: { cancelled: false } });
    const activeAt: Record<string, number> = {};
    const createDocument = vi.mocked(files.createDocument).getMockImplementation()!;
    vi.mocked(files.createDocument).mockImplementation(async (options) => {
      activeAt.createDocument = suspend.active;
      return createDocument(options);
    });
    const openWrite = vi.mocked(files.openWrite).getMockImplementation()!;
    vi.mocked(files.openWrite).mockImplementation(async (options) => {
      activeAt.openWrite = suspend.active;
      return openWrite(options);
    });
    const closeWrite = vi.mocked(files.closeWrite).getMockImplementation()!;
    vi.mocked(files.closeWrite).mockImplementation(async (options) => {
      activeAt.closeWrite = suspend.active;
      return closeWrite(options);
    });
    expect(await saveToDevice(ios(files, suspend.suspendLock), new Blob([bytesOf(10)]), 'b.mpd')).toBe('saved');
    expect(activeAt).toEqual({ createDocument: 1, openWrite: 1, closeWrite: 1 });
    expect(suspend.log).toEqual(['suspend', 'release']);
    expect(suspend.active).toBe(0);

    // Released when the write fails too.
    const failing = fakeDiaryFiles({ failWriteAt: 0 });
    await expect(saveToDevice(ios(failing, suspend.suspendLock), new Blob([bytesOf(10)]), 'b.mpd')).rejects.toThrow('disk full');
    expect(suspend.active).toBe(0);
  });
});

describe('shareFile', () => {
  it('writes the cache copy in chunks, shares its file URI and leaves the copy for the receiving app', async () => {
    const d = deps();
    const data = bytesOf(700);
    expect(await shareFile(d, new Blob([data], { type: 'text/plain' }), 'export 2026.txt')).toBe('shared');
    expect(d.filesystem.writeFile).toHaveBeenCalledTimes(1);
    expect(d.filesystem.appendFile).toHaveBeenCalledTimes(2);
    expect(d.share.share).toHaveBeenCalledWith({ title: 'export 2026.txt', dialogTitle: 'export 2026.txt', files: ['file:///cache/share/u-export_2026.txt'] });
    // The share plugin resolves when the chooser finishes - the target app reads the grant after
    // that - so the copy must still exist now; the next share (or app start) sweeps it.
    expect(d.filesystem.deleteFile).not.toHaveBeenCalled();
    expect(new Uint8Array(d.filesystem.files.get('share/u-export_2026.txt')!)).toEqual(data);
  });

  it('the next share removes the copies of earlier shares first; cleanShareCache does the same at app start', async () => {
    let n = 0;
    const d = deps({ uniqueName: () => `u${++n}` });
    await shareFile(d, new Blob([bytesOf(5)]), 'first.mpd');
    expect([...d.filesystem.files.keys()]).toEqual(['share/u1-first.mpd']);
    await shareFile(d, new Blob([bytesOf(5)]), 'second.mpd');
    expect(d.filesystem.rmdir).toHaveBeenCalledWith({ path: SHARE_CACHE_DIR, directory: CACHE, recursive: true });
    expect([...d.filesystem.files.keys()]).toEqual(['share/u2-second.mpd']);

    await cleanShareCache(d);
    expect(d.filesystem.files.size).toBe(0);
    // Nothing to sweep (a fresh install): no error.
    vi.mocked(d.filesystem.rmdir).mockRejectedValueOnce(new Error('Folder does not exist.'));
    await expect(cleanShareCache(d)).resolves.toBeUndefined();
  });

  it('a dismissed sheet is "cancelled" and removes the copy at once; other failures propagate and remove it too', async () => {
    const cancelled = deps({ share: { share: vi.fn(async () => Promise.reject(new Error('Share canceled'))) } });
    expect(await shareFile(cancelled, new Blob([bytesOf(5)]), 'a.mpd')).toBe('cancelled');
    expect(cancelled.filesystem.deleteFile).toHaveBeenCalledWith({ path: 'share/u-a.mpd', directory: CACHE });
    expect(cancelled.filesystem.files.size).toBe(0);

    const failing = deps({ share: { share: vi.fn(async () => Promise.reject(new Error("Can't share while sharing is in progress"))) } });
    await expect(shareFile(failing, new Blob([bytesOf(5)]), 'a.mpd')).rejects.toThrow(/in progress/);
    expect(failing.filesystem.deleteFile).toHaveBeenCalled();
    expect(failing.filesystem.files.size).toBe(0);
    expect(isShareCancelled(new Error('Share canceled'))).toBe(true);
    expect(isShareCancelled(new Error('boom'))).toBe(false);
  });

  it('an empty file is still created for the sheet', async () => {
    const d = deps();
    expect(await shareFile(d, new Blob([]), 'empty.txt')).toBe('shared');
    expect(d.filesystem.writeFile).toHaveBeenCalledWith({ path: 'share/u-empty.txt', data: '', directory: CACHE, recursive: true });
  });
});

describe('pickFile', () => {
  it('reads the chosen file through the plugin into a File; a dismissed dialog gives null', async () => {
    const plugin = fakeDiaryFiles({ picked: 'content://docs/chosen.mpd' });
    const data = bytesOf(901);
    plugin.sources.set('content://docs/chosen.mpd', data);
    const file = await pickFile(deps({ files: plugin }));
    expect(file).not.toBeNull();
    expect(file!.name).toBe('chosen.mpd');
    expect(await blobBytes(file!)).toEqual(data);
    expect(plugin.readChunk).toHaveBeenCalledTimes(4);

    expect(await pickFile(deps({ files: fakeDiaryFiles({ picked: null }) }))).toBeNull();
  });
});

describe('the lock-suspension token of the system dialogs', () => {
  it('is held for exactly the "save as" dialog, not for the write that follows', async () => {
    const suspend = fakeSuspend();
    const files = fakeDiaryFiles();
    const activeAt: Record<string, number> = {};
    const createDocument = vi.mocked(files.createDocument).getMockImplementation()!;
    vi.mocked(files.createDocument).mockImplementation(async (options) => {
      activeAt.createDocument = suspend.active;
      return createDocument(options);
    });
    const openWrite = vi.mocked(files.openWrite).getMockImplementation()!;
    vi.mocked(files.openWrite).mockImplementation(async (options) => {
      activeAt.openWrite = suspend.active;
      return openWrite(options);
    });
    expect(await saveToDevice(deps({ files, suspendLock: suspend.suspendLock }), new Blob([bytesOf(10)]), 'b.mpd')).toBe('saved');
    expect(activeAt).toEqual({ createDocument: 1, openWrite: 0 });
    expect(suspend.log).toEqual(['suspend', 'release']);
    expect(suspend.active).toBe(0);
  });

  it('is held for the "open" dialog and for the share sheet, and released when they fail', async () => {
    const suspend = fakeSuspend();
    const files = fakeDiaryFiles({ picked: null });
    vi.mocked(files.openDocument).mockImplementationOnce(async () => {
      expect(suspend.active).toBe(1);
      return { file: null };
    });
    expect(await pickFile(deps({ files, suspendLock: suspend.suspendLock }))).toBeNull();
    expect(suspend.active).toBe(0);

    const share = {
      share: vi.fn(async () => {
        expect(suspend.active).toBe(1);
        return { activityType: 'x' };
      }),
    };
    expect(await shareFile(deps({ share, suspendLock: suspend.suspendLock }), new Blob([bytesOf(3)]), 'c.txt')).toBe('shared');
    expect(suspend.active).toBe(0);

    const failing = deps({ share: { share: vi.fn(async () => Promise.reject(new Error('boom'))) }, suspendLock: suspend.suspendLock });
    await expect(shareFile(failing, new Blob([bytesOf(3)]), 'c.txt')).rejects.toThrow('boom');
    expect(suspend.active).toBe(0);
    expect(suspend.log.filter((x) => x === 'suspend')).toHaveLength(3);
  });

  it('works without a token (tests, a host that has none)', async () => {
    expect(await saveToDevice(deps(), new Blob([bytesOf(3)]), 'b.mpd')).toBe('saved');
  });
});

describe('opened files', () => {
  it('readOpenedFile assembles the chunks into a File with the provider name', async () => {
    const plugin = fakeDiaryFiles();
    const data = bytesOf(1001);
    plugin.sources.set('content://x/dana.mpd', data);
    const file = await readOpenedFile(plugin, { uri: 'content://x/dana.mpd', name: 'fallback.mpd' }, 300);
    expect(file.name).toBe('dana.mpd');
    expect(file.size).toBe(1001);
    expect(await blobBytes(file)).toEqual(data);
    expect(plugin.readChunk).toHaveBeenCalledTimes(4);
    expect(plugin.closeRead).toHaveBeenCalledTimes(1);
  });

  it('readOpenedFile closes the stream when reading fails', async () => {
    const plugin = fakeDiaryFiles();
    plugin.sources.set('content://x/a.mpd', bytesOf(10));
    vi.mocked(plugin.readChunk).mockRejectedValueOnce(new Error('gone'));
    await expect(readOpenedFile(plugin, { uri: 'content://x/a.mpd', name: 'a.mpd' })).rejects.toThrow('gone');
    expect(plugin.closeRead).toHaveBeenCalledTimes(1);
  });

  it('watchOpenedFiles delivers the start-up file once and later ones live, de-duplicated by seq', async () => {
    const opened: OpenedFile = { uri: 'content://x/1.mpd', name: '1.mpd', size: 3, seq: 1 };
    const plugin = fakeDiaryFiles({ opened });
    const onFile = vi.fn();
    const stop = watchOpenedFiles(plugin, onFile);
    await new Promise((r) => setTimeout(r, 0));
    expect(onFile).toHaveBeenCalledTimes(1);
    // The same delivery through the event: ignored. A new one: delivered.
    plugin.emitOpen(opened);
    plugin.emitOpen({ ...opened, uri: 'content://x/2.mpd', seq: 2 });
    expect(onFile).toHaveBeenCalledTimes(2);
    stop();
    plugin.emitOpen({ ...opened, seq: 3 });
    expect(onFile).toHaveBeenCalledTimes(2);
  });
});
