// @vitest-environment node
/**
 * The `StorageBackend` contract (mobile/shared/storage-protocol.ts), run against every storage
 * the VFS can sit on: the memory backend, the Capacitor backend on a fake plugin (native and web
 * behaviour, with a chunk size of 12 bytes so that chunking is exercised by small files) and the
 * worker RPC in front of a memory backend.
 */
import { describe, expect, it } from 'vitest';
import { StorageError, storagePathSegments, type StorageBackend } from '../../shared/storage-protocol';
import { STORAGE_KINDS, bytesOf, patternBytes, text } from './helpers';

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(StorageError);
    return (e as StorageError).code;
  }
  return 'no error';
}

describe.each(STORAGE_KINDS)('storage contract: $name', ({ create }) => {
  async function ready(): Promise<{ backend: StorageBackend; fixture: ReturnType<typeof create> }> {
    const fixture = create();
    const backend = fixture.open();
    await backend.mkdir('');
    return { backend, fixture };
  }

  it('starts empty; mkdir of the root is repeatable', async () => {
    const { backend } = await ready();
    await backend.mkdir('');
    expect(await backend.list('')).toEqual([]);
    expect(await backend.stat('')).toMatchObject({ type: 'directory' });
    expect(await backend.stat('nothing')).toBeNull();
  });

  it('writes, reads, lists and stats files; a write replaces the whole file', async () => {
    const { backend } = await ready();
    await backend.write('a.json', bytesOf('{"first":true}'));
    await backend.write('a.json', bytesOf('{}'));
    await backend.write('empty', new Uint8Array(0));
    expect(text(await backend.read('a.json'))).toBe('{}');
    expect((await backend.read('empty')).byteLength).toBe(0);
    const entries = await backend.list('');
    expect(entries.map((e) => [e.name, e.type])).toEqual([
      ['a.json', 'file'],
      ['empty', 'file'],
    ]);
    expect(await backend.stat('a.json')).toMatchObject({ type: 'file' });
    expect((await backend.stat('a.json'))?.mtimeMs).toBeGreaterThan(0);
  });

  it.each([0, 1, 11, 12, 13, 24, 25, 1000, 70_000])('round-trips %i binary bytes exactly', async (length) => {
    const { backend } = await ready();
    const bytes = patternBytes(length, length + 7);
    await backend.write('blob.bin', bytes);
    const back = await backend.read('blob.bin');
    expect(back.byteLength).toBe(length);
    expect(Buffer.from(back).equals(Buffer.from(bytes))).toBe(true);
  });

  it('does not keep the caller\'s array: changing it afterwards does not change the file', async () => {
    const { backend } = await ready();
    const bytes = bytesOf('stable content');
    await backend.write('f', bytes);
    bytes.fill(0);
    const first = await backend.read('f');
    expect(text(first)).toBe('stable content');
    first.fill(0);
    expect(text(await backend.read('f'))).toBe('stable content');
  });

  it('creates directories with their parents; an existing directory is fine, a file in the way is EEXIST', async () => {
    const { backend } = await ready();
    await backend.mkdir('users/deep/er');
    await backend.mkdir('users');
    await backend.mkdir('users/deep/er');
    expect((await backend.list('users')).map((e) => [e.name, e.type])).toEqual([['deep', 'directory']]);
    await backend.write('users/file', bytesOf('x'));
    expect(await codeOf(backend.mkdir('users/file'))).toBe('EEXIST');
  });

  it('reports missing things with ENOENT', async () => {
    const { backend } = await ready();
    expect(await codeOf(backend.read('nope'))).toBe('ENOENT');
    expect(await codeOf(backend.list('nope'))).toBe('ENOENT');
    expect(await codeOf(backend.write('nope/file', bytesOf('x')))).toBe('ENOENT');
    expect(await codeOf(backend.rename('nope', 'other'))).toBe('ENOENT');
    expect(await backend.stat('nope/file')).toBeNull();
  });

  it('distinguishes files and directories', async () => {
    const { backend } = await ready();
    await backend.mkdir('dir');
    await backend.write('file', bytesOf('x'));
    expect(await codeOf(backend.read('dir'))).toBe('EISDIR');
    expect(await codeOf(backend.list('file'))).toBe('ENOTDIR');
  });

  it('renames files and whole directories onto free names', async () => {
    const { backend, fixture } = await ready();
    await backend.mkdir('users');
    await backend.write('users/a.mpd.tmp-1', bytesOf('new diary'));
    await backend.rename('users/a.mpd.tmp-1', 'users/a.mpd');
    expect(text(await backend.read('users/a.mpd'))).toBe('new diary');
    expect(await backend.stat('users/a.mpd.tmp-1')).toBeNull();
    await backend.rename('users', 'people');
    expect(text(await backend.read('people/a.mpd'))).toBe('new diary');
    expect(await backend.stat('users')).toBeNull();
    expect([...fixture.files().keys()]).toEqual(['people/a.mpd']);
  });

  it('removes files and directory trees; removing nothing is not an error', async () => {
    const { backend, fixture } = await ready();
    await backend.mkdir('users/x');
    await backend.write('users/x/1', bytesOf('1'));
    await backend.write('users/2', bytesOf('2'));
    await backend.write('top', bytesOf('t'));
    await backend.remove('top');
    await backend.remove('top');
    await backend.remove('users');
    await backend.remove('never/was');
    expect(await backend.list('')).toEqual([]);
    expect(fixture.files().size).toBe(0);
  });

  it('refuses paths that could leave the storage root', async () => {
    const { backend } = await ready();
    for (const path of ['../x', '/abs', 'a//b', 'a/./b', 'a/../../b', 'a\\b']) {
      expect(await codeOf(backend.write(path, bytesOf('x'))), path).toBe('EINVAL');
      expect(await codeOf(backend.read(path)), path).toBe('EINVAL');
    }
    expect(await codeOf(backend.remove(''))).toBe('EINVAL');
  });

  it('a second connection sees what the first one stored', async () => {
    const { backend, fixture } = await ready();
    await backend.mkdir('users');
    await backend.write('users/u.mpd', patternBytes(100));
    const again = fixture.open();
    expect(Buffer.from(await again.read('users/u.mpd')).equals(Buffer.from(patternBytes(100)))).toBe(true);
    fixture.verify();
  });
});

describe('storage paths', () => {
  it('splits plain relative paths and rejects everything else', () => {
    expect(storagePathSegments('')).toEqual([]);
    expect(storagePathSegments('users/u_1.mpd')).toEqual(['users', 'u_1.mpd']);
    for (const bad of ['/', '/a', 'a/', '..', 'a/../b', './a', 'a\\b', 'a\0b']) {
      expect(() => storagePathSegments(bad), bad).toThrow(StorageError);
    }
  });
});
