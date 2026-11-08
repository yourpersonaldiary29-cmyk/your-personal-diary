// @vitest-environment node
/**
 * The Capacitor storage backend (mobile/host/storage/capacitor-filesystem.ts) beyond the common
 * contract of storage-backends.test.ts: where the files go, how multi-megabyte files are cut into
 * bridge calls, how plugin failures become storage error codes, and what it corrects about the
 * plugin's web implementation - checked against that implementation itself (FilesystemWeb of
 * @capacitor/filesystem on an in-memory IndexedDB stand-in).
 */
import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from '../../host/storage/base64';
import {
  CapacitorFilesystemStorage,
  DEFAULT_CHUNK_BYTES,
  DEFAULT_STORAGE_BASE,
  createCapacitorFilesystemStorage,
  type FilesystemLike,
} from '../../host/storage/capacitor-filesystem';
import { StorageError } from '../../shared/storage-protocol';
import { FakeFilesystemPlugin, MiniIndexedDb, bytesOf, patternBytes, realWebPlugin, text } from './helpers';

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(StorageError);
    return (e as StorageError).code;
  }
  return 'no error';
}

const same = (a: Uint8Array, b: Uint8Array): boolean => Buffer.from(a).equals(Buffer.from(b));

/** The bridge calls that carried file content, e.g. `writeFile DATA:diary/a (16)`. */
const dataCalls = (plugin: FakeFilesystemPlugin): string[] => plugin.calls.filter((call) => /^(writeFile|appendFile|readFile) /.test(call));

describe('where the files go', () => {
  it('everything lives in Directory.Data below the folder diary/', async () => {
    const plugin = new FakeFilesystemPlugin();
    const storage = new CapacitorFilesystemStorage(plugin);
    await storage.mkdir('');
    await storage.mkdir('users');
    await storage.write('accounts.json', bytesOf('{}'));
    await storage.write('users/u_1.mpd', bytesOf('diary'));
    expect(DEFAULT_STORAGE_BASE).toBe('diary');
    expect([...plugin.files().keys()]).toEqual(['DATA:diary/accounts.json', 'DATA:diary/users/u_1.mpd']);
    expect(plugin.calls.every((call) => / DATA:diary(\/| |$)/.test(call))).toBe(true);
  });

  it('another base folder and directory can be chosen; a base that leaves the directory is refused', async () => {
    const plugin = new FakeFilesystemPlugin();
    const storage = new CapacitorFilesystemStorage(plugin, { base: 'profiles/test', directory: 'CACHE' as never });
    await storage.mkdir('');
    await storage.write('f', bytesOf('x'));
    expect([...plugin.files().keys()]).toEqual(['CACHE:profiles/test/f']);
    for (const base of ['', '../outside', '/abs', 'a//b', 'a\\b']) {
      expect(() => new CapacitorFilesystemStorage(plugin, { base }), base).toThrow(StorageError);
    }
  });

  it('never passes a path that could leave the base folder to the plugin', async () => {
    const plugin = new FakeFilesystemPlugin();
    const storage = new CapacitorFilesystemStorage(plugin);
    await storage.mkdir('');
    plugin.calls.length = 0;
    for (const path of ['../x', 'a/../../x', '/etc/x', 'a//x', './x']) {
      expect(await codeOf(storage.write(path, bytesOf('x'))), path).toBe('EINVAL');
      expect(await codeOf(storage.read(path)), path).toBe('EINVAL');
      expect(await codeOf(storage.stat(path)), path).toBe('EINVAL');
      expect(await codeOf(storage.remove(path)), path).toBe('EINVAL');
      expect(await codeOf(storage.rename(path, 'ok')), path).toBe('EINVAL');
      expect(await codeOf(storage.rename('ok', path)), path).toBe('EINVAL');
      expect(await codeOf(storage.mkdir(path)), path).toBe('EINVAL');
      expect(await codeOf(storage.list(path)), path).toBe('EINVAL');
    }
    expect(plugin.calls).toEqual([]);
    expect(await codeOf(storage.rename('', 'x'))).toBe('EINVAL');
    expect(await codeOf(storage.write('', bytesOf('x')))).toBe('EISDIR');
  });
});

describe('chunking of large files', () => {
  it('a write is one writeFile plus appendFile calls of at most one chunk each', async () => {
    const plugin = new FakeFilesystemPlugin();
    const storage = new CapacitorFilesystemStorage(plugin, { chunkBytes: 12 });
    await storage.mkdir('');
    plugin.calls.length = 0;
    const bytes = patternBytes(40, 3);
    await storage.write('blob', bytes);
    // 12 bytes are 16 base64 characters; the last chunk has 4 bytes (8 characters with padding).
    expect(dataCalls(plugin)).toEqual([
      'writeFile DATA:diary/blob (16)',
      'appendFile DATA:diary/blob (16)',
      'appendFile DATA:diary/blob (16)',
      'appendFile DATA:diary/blob (8)',
    ]);
    expect(same(plugin.files().get('DATA:diary/blob') as Uint8Array, bytes)).toBe(true);

    // A file of exactly one chunk, and an empty one, are a single call.
    plugin.calls.length = 0;
    await storage.write('one', patternBytes(12));
    await storage.write('none', new Uint8Array(0));
    expect(dataCalls(plugin)).toEqual(['writeFile DATA:diary/one (16)', 'writeFile DATA:diary/none (0)']);
    // Replacing a longer file leaves nothing of it behind.
    await storage.write('blob', bytesOf('short'));
    expect(text(plugin.files().get('DATA:diary/blob') as Uint8Array)).toBe('short');
  });

  it('the native plugin is read in chunks with offset and length, after one stat', async () => {
    const plugin = new FakeFilesystemPlugin({ flavour: 'native' });
    const storage = new CapacitorFilesystemStorage(plugin, { chunkBytes: 12 });
    await storage.mkdir('');
    const bytes = patternBytes(30, 9);
    await storage.write('blob', bytes);
    plugin.calls.length = 0;
    expect(same(await storage.read('blob'), bytes)).toBe(true);
    expect(plugin.calls).toEqual(['stat DATA:diary/blob', 'readFile DATA:diary/blob @0+12', 'readFile DATA:diary/blob @12+12', 'readFile DATA:diary/blob @24+6']);

    // A file that fits into one chunk is read whole.
    await storage.write('small', patternBytes(12));
    plugin.calls.length = 0;
    await storage.read('small');
    expect(plugin.calls).toEqual(['stat DATA:diary/small', 'readFile DATA:diary/small']);
  });

  it('the web plugin is read whole: it ignores offset and length', async () => {
    const plugin = new FakeFilesystemPlugin({ flavour: 'web' });
    const storage = new CapacitorFilesystemStorage(plugin, { chunkBytes: 12, web: true });
    await storage.mkdir('');
    const bytes = patternBytes(100, 4);
    await storage.write('blob', bytes);
    plugin.calls.length = 0;
    expect(same(await storage.read('blob'), bytes)).toBe(true);
    expect(dataCalls(plugin)).toEqual(['readFile DATA:diary/blob']);
  });

  it('the chunk size is rounded down to whole base64 groups, so the chunks concatenate', async () => {
    for (const [asked, used] of [
      [1, 3],
      [3, 3],
      [10, 9],
      [14, 12],
    ]) {
      const plugin = new FakeFilesystemPlugin();
      const storage = new CapacitorFilesystemStorage(plugin, { chunkBytes: asked });
      await storage.mkdir('');
      const bytes = patternBytes(50, asked);
      await storage.write('blob', bytes);
      const lengths = dataCalls(plugin).map((call) => Number(/\((\d+)\)$/.exec(call)?.[1]));
      expect(Math.max(...lengths), `chunkBytes ${asked}`).toBe((used / 3) * 4);
      expect(same(await storage.read('blob'), bytes)).toBe(true);
    }
  });

  it('by default no bridge call carries more than one mebibyte of text: a 2.5 MB diary takes four', async () => {
    expect(DEFAULT_CHUNK_BYTES).toBe(786_432);
    const plugin = new FakeFilesystemPlugin();
    const storage = new CapacitorFilesystemStorage(plugin);
    await storage.mkdir('');
    await storage.mkdir('users');
    const diary = patternBytes(2_500_000, 77);
    await storage.write('users/u.mpd.tmp-1', diary);
    await storage.rename('users/u.mpd.tmp-1', 'users/u.mpd');
    const writes = dataCalls(plugin);
    expect(writes.map((call) => call.split(' ')[0])).toEqual(['writeFile', 'appendFile', 'appendFile', 'appendFile']);
    for (const call of writes) expect(Number(/\((\d+)\)$/.exec(call)?.[1])).toBeLessThanOrEqual(1024 * 1024);
    plugin.calls.length = 0;
    expect(same(await storage.read('users/u.mpd'), diary)).toBe(true);
    expect(dataCalls(plugin)).toHaveLength(4);
    expect(plugin.renamedOverExisting).toEqual([]);
  });

  it('a read that comes back shorter than the file is an error, not a truncated diary', async () => {
    const plugin = new FakeFilesystemPlugin();
    const storage = new CapacitorFilesystemStorage(plugin, { chunkBytes: 12 });
    await storage.mkdir('');
    await storage.write('blob', patternBytes(30));
    const readFile = plugin.readFile.bind(plugin);
    plugin.readFile = async (options) => {
      const result = await readFile(options);
      // The second chunk loses its last base64 group.
      return options.offset === 12 ? { data: result.data.slice(0, -4) } : result;
    };
    expect(await codeOf(storage.read('blob'))).toBe('EIO');
  });
});

describe('what the plugin answers', () => {
  it('accepts base64 with line breaks, a data: URL and a Blob as file content', async () => {
    const bytes = patternBytes(100, 6);
    const base64 = bytesToBase64(bytes);
    const answers: Array<string | Blob> = [
      `${base64.slice(0, 40)}\n${base64.slice(40, 80)}\r\n${base64.slice(80)}`,
      `data:application/octet-stream;base64,${base64}`,
      new Blob([bytes.slice().buffer as ArrayBuffer]),
    ];
    for (const data of answers) {
      const plugin = {
        stat: async () => ({ type: 'file', size: 100, mtime: 5, uri: '' }),
        readFile: async () => ({ data }),
      } as unknown as FilesystemLike;
      const storage = new CapacitorFilesystemStorage(plugin);
      expect(same(await storage.read('f'), bytes)).toBe(true);
    }
  });

  it('reports sizes and times as numbers whatever the plugin sends', async () => {
    const plugin = {
      stat: async () => ({ type: 'file', size: '42', mtime: '1700000000000', uri: '' }),
      readdir: async () => ({
        files: [
          { name: 'a', type: 'file', size: 7, mtime: 9, uri: '' },
          { name: 'd', type: 'directory', size: 4096, mtime: undefined, uri: '' },
        ],
      }),
    } as unknown as FilesystemLike;
    const storage = new CapacitorFilesystemStorage(plugin);
    expect(await storage.stat('f')).toEqual({ type: 'file', size: 42, mtimeMs: 1_700_000_000_000 });
    expect(await storage.list('')).toEqual([
      { name: 'a', type: 'file', size: 7, mtimeMs: 9 },
      { name: 'd', type: 'directory', size: 0, mtimeMs: 0 },
    ]);
  });

  it.each([
    ['OS-PLUG-FILE-0008', "'readdir' failed because file at 'x' does not exist.", 'ENOENT'],
    ['OS-PLUG-FILE-0011', 'Missing parent directory.', 'ENOENT'],
    ['OS-PLUG-FILE-0010', "Directory at 'x' already exists, cannot be overwritten.", 'EEXIST'],
    ['OS-PLUG-FILE-0012', 'Cannot delete directory with children.', 'ENOTEMPTY'],
    ['OS-PLUG-FILE-0007', 'Unable to access the file: permission denied.', 'EACCES'],
    ['OS-PLUG-FILE-0005', 'The path is invalid.', 'EINVAL'],
    ['OS-PLUG-FILE-0009', "'readdir' not supported for files, only directories are supported.", 'ENOTDIR'],
    ['OS-PLUG-FILE-0009', "'readFile' not supported for directories.", 'EISDIR'],
    ['OS-PLUG-FILE-0013', 'The operation failed with an error.', 'EIO'],
    [undefined, 'Folder does not exist.', 'ENOENT'],
    [undefined, 'Parent directory must exist', 'ENOENT'],
    [undefined, 'Current directory does already exist.', 'EEXIST'],
    [undefined, 'Folder is not empty', 'ENOTEMPTY'],
    [undefined, 'Requested path is not a directory', 'ENOTDIR'],
    [undefined, 'Parent directory of the to path is a file', 'ENOTDIR'],
    [undefined, 'The supplied path is a directory.', 'EISDIR'],
    [undefined, 'Cannot overwrite a directory with a file', 'EISDIR'],
    [undefined, "This browser doesn't support IndexedDB", 'EIO'],
    [undefined, 'QuotaExceededError', 'EIO'],
  ] as const)('maps the plugin failure %s "%s" to %s', async (code, message, expected) => {
    const plugin = {
      readdir: async () => {
        throw Object.assign(new Error(message), code ? { code } : {});
      },
    } as unknown as FilesystemLike;
    const storage = new CapacitorFilesystemStorage(plugin);
    const error = await storage.list('users').catch((e: unknown) => e as StorageError);
    expect(error).toBeInstanceOf(StorageError);
    expect((error as StorageError).code).toBe(expected);
    // The message names the operation and the path, and keeps the plugin's own words.
    expect((error as StorageError).message).toBe(`${expected}: list 'users': ${message}`);
  });

  it('a failure that is not an Error object still becomes a StorageError', async () => {
    const plugin = {
      readdir: async () => {
        throw 'plain text from the bridge';
      },
    } as unknown as FilesystemLike;
    const error = await new CapacitorFilesystemStorage(plugin).list('').catch((e: unknown) => e as StorageError);
    expect(error).toMatchObject({ name: 'StorageError', code: 'EIO' });
  });

  it('removing something that vanished in the meantime is not an error; other failures are', async () => {
    const plugin = new FakeFilesystemPlugin();
    const storage = new CapacitorFilesystemStorage(plugin);
    await storage.mkdir('');
    await storage.write('f', bytesOf('x'));
    const deleteFile = plugin.deleteFile.bind(plugin);
    plugin.deleteFile = async (options) => {
      await deleteFile(options);
      throw Object.assign(new Error("'deleteFile' failed because file at 'f' does not exist."), { code: 'OS-PLUG-FILE-0008' });
    };
    await storage.remove('f');
    await storage.write('g', bytesOf('x'));
    plugin.deleteFile = async () => {
      throw Object.assign(new Error('The operation failed with an error.'), { code: 'OS-PLUG-FILE-0013' });
    };
    expect(await codeOf(storage.remove('g'))).toBe('EIO');
  });
});

describe("the plugin's real web implementation", () => {
  function web(): { db: MiniIndexedDb; plugin: FilesystemLike; storage: CapacitorFilesystemStorage } {
    const db = new MiniIndexedDb();
    const plugin = realWebPlugin(db);
    return { db, plugin, storage: new CapacitorFilesystemStorage(plugin, { chunkBytes: 12, web: true }) };
  }

  it('stores a file as base64 text below /DATA/diary; chunked writes concatenate exactly', async () => {
    const { db, storage } = web();
    await storage.mkdir('');
    await storage.mkdir('users');
    const bytes = patternBytes(1000, 8);
    await storage.write('users/u.mpd', bytes);
    expect([...db.records.keys()].sort()).toEqual(['/DATA/diary', '/DATA/diary/users', '/DATA/diary/users/u.mpd']);
    const row = db.records.get('/DATA/diary/users/u.mpd');
    expect(row?.type).toBe('file');
    expect(row?.content).toBe(bytesToBase64(bytes));
    expect(same(await storage.read('users/u.mpd'), bytes)).toBe(true);
    // The web implementation counts base64 characters; the content read back is what matters.
    expect((await storage.stat('users/u.mpd'))?.size).toBe(bytesToBase64(bytes).length);
  });

  it('on its own it creates a missing folder on a write and lists a file as empty; the backend corrects both', async () => {
    const { db, plugin, storage } = web();
    await storage.mkdir('');
    await storage.write('file', bytesOf('x'));

    // The plugin alone...
    await plugin.writeFile({ path: 'diary/made-up/f', directory: 'DATA' as never, data: bytesToBase64(bytesOf('x')), recursive: false });
    expect(db.records.get('/DATA/diary/made-up')?.type).toBe('directory');
    expect((await plugin.readdir({ path: 'diary/file', directory: 'DATA' as never })).files).toEqual([]);

    // ...and through the backend, which keeps the contract of a file system.
    expect(await codeOf(storage.write('missing/f', bytesOf('x')))).toBe('ENOENT');
    expect(db.records.has('/DATA/diary/missing')).toBe(false);
    expect(await codeOf(storage.write('file/f', bytesOf('x')))).toBe('ENOTDIR');
    expect(await codeOf(storage.list('file'))).toBe('ENOTDIR');
    await storage.mkdir('empty');
    expect(await storage.list('empty')).toEqual([]);
  });

  it('its error texts are the ones the backend recognises', async () => {
    const { storage } = web();
    await storage.mkdir('');
    await storage.mkdir('dir');
    await storage.write('dir/f', bytesOf('x'));
    expect(await codeOf(storage.read('nope'))).toBe('ENOENT');
    expect(await codeOf(storage.list('nope'))).toBe('ENOENT');
    expect(await codeOf(storage.rename('nope', 'other'))).toBe('ENOENT');
    expect(await codeOf(storage.rename('dir/f', 'nope/f'))).toBe('ENOENT');
    expect(await codeOf(storage.read('dir'))).toBe('EISDIR');
    expect(await codeOf(storage.write('dir', bytesOf('x')))).toBe('EISDIR');
    expect(await codeOf(storage.mkdir('dir/f'))).toBe('EEXIST');
    await storage.mkdir('dir');
    expect(await storage.stat('nope')).toBeNull();
  });
});

describe('createCapacitorFilesystemStorage()', () => {
  it('loads the real plugin; outside a phone that is the web implementation, which needs IndexedDB', async () => {
    const storage = await createCapacitorFilesystemStorage();
    expect(storage).toBeInstanceOf(CapacitorFilesystemStorage);
    // No IndexedDB here (as in jsdom): the storage says so with EIO instead of pretending to store.
    expect(await codeOf(storage.mkdir(''))).toBe('EIO');
    expect(await codeOf(storage.write('f', bytesOf('x')))).toBe('EIO');
    expect(await codeOf(storage.list(''))).toBe('EIO');
  });
});

describe('base64 for the bridge', () => {
  it('agrees with Node for every length around the slice boundaries and for every byte value', () => {
    const every = new Uint8Array(256).map((_, i) => i);
    expect(bytesToBase64(every)).toBe(Buffer.from(every).toString('base64'));
    for (const length of [0, 1, 2, 3, 4, 5, 24_575, 24_576, 24_577, 49_152, 49_153, 100_000]) {
      const bytes = patternBytes(length, length + 1);
      const encoded = bytesToBase64(bytes);
      expect(encoded, String(length)).toBe(Buffer.from(bytes).toString('base64'));
      expect(same(base64ToBytes(encoded), bytes), String(length)).toBe(true);
    }
  });

  it('decoding tolerates white space and a data: URL prefix, and rejects what is not base64', () => {
    expect(text(base64ToBytes('aGVs\nbG8=\r\n'))).toBe('hello');
    expect(text(base64ToBytes('data:text/plain;base64,aGVsbG8='))).toBe('hello');
    expect(base64ToBytes('').byteLength).toBe(0);
    expect(() => base64ToBytes('not base64 !!')).toThrow();
  });
});
