// @vitest-environment node
/**
 * The `node:fs` facade of the mobile core (mobile/core/vfs/node-fs.ts, re-exported by
 * mobile/core/shims/fs.ts): the functions server/src calls, with Node's results and Node's errors.
 * Part of it is differential: the same calls are made on the real `node:fs` in a temporary
 * directory and on the facade, and code, syscall and message must agree.
 */
import nodeFs from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import shim, * as named from '../../core/shims/fs';
import fs, { FileHandle, Stats, getVfs, installVfs } from '../../core/vfs/node-fs';
import { Vfs } from '../../core/vfs/vfs';

interface Failure {
  code?: string;
  syscall?: string;
  message: string;
}

function failureOf(run: () => unknown): Failure {
  try {
    run();
  } catch (e) {
    const error = e as NodeJS.ErrnoException;
    return { code: error.code, syscall: error.syscall, message: error.message };
  }
  throw new Error('expected the call to throw');
}

beforeEach(() => {
  installVfs(new Vfs());
  fs.mkdirSync('/data/users', { recursive: true });
});

describe('the shim module', () => {
  it('re-exports the facade as default and as named exports', () => {
    expect(shim).toBe(fs);
    expect(named.readFileSync).toBe(fs.readFileSync);
    expect(named.promises).toBe(fs.promises);
    expect(named.default).toBe(fs);
    for (const [name, value] of Object.entries(fs)) {
      expect((named as Record<string, unknown>)[name], name).toBe(value);
    }
  });
});

describe('reading and writing files', () => {
  it('writes strings and buffers and reads them back as Buffer or text', () => {
    fs.writeFileSync('/data/a.json', '{"שלום":"עולם"}', 'utf8');
    fs.writeFileSync('/data/key', Buffer.from([0, 1, 2, 250, 255]), { mode: 0o600 });
    const raw = fs.readFileSync('/data/a.json');
    expect(Buffer.isBuffer(raw)).toBe(true);
    expect((raw as Buffer).toString('utf8')).toBe('{"שלום":"עולם"}');
    expect(fs.readFileSync('/data/a.json', 'utf8')).toBe('{"שלום":"עולם"}');
    expect(fs.readFileSync('/data/a.json', { encoding: 'utf8' })).toBe('{"שלום":"עולם"}');
    expect([...(fs.readFileSync('/data/key') as Buffer)]).toEqual([0, 1, 2, 250, 255]);
    expect(fs.readFileSync('/data/key', 'hex')).toBe('000102faff');
    expect(fs.readFileSync('/data/key', 'base64')).toBe('AAEC+v8=');
  });

  it('honours the string encoding of a write', () => {
    fs.writeFileSync('/data/hex', '00ff10', 'hex');
    fs.writeFileSync('/data/b64', 'AAEC', { encoding: 'base64' });
    expect([...(fs.readFileSync('/data/hex') as Buffer)]).toEqual([0, 255, 16]);
    expect([...(fs.readFileSync('/data/b64') as Buffer)]).toEqual([0, 1, 2]);
  });

  it('copies on the way in and on the way out (callers wipe their buffers)', () => {
    const secret = Buffer.from('0123456789abcdef');
    fs.writeFileSync('/data/device.key', secret);
    secret.fill(0);
    const first = fs.readFileSync('/data/device.key') as Buffer;
    expect(first.toString()).toBe('0123456789abcdef');
    first.fill(0);
    expect(fs.readFileSync('/data/device.key', 'utf8')).toBe('0123456789abcdef');
  });

  it('accepts typed arrays, DataViews and ArrayBuffers', () => {
    const source = new Uint8Array([9, 8, 7, 6, 5, 4]);
    fs.writeFileSync('/data/view', new DataView(source.buffer, 2, 3));
    fs.writeFileSync('/data/sub', source.subarray(1, 3));
    fs.writeFileSync('/data/ab', source.buffer);
    expect([...(fs.readFileSync('/data/view') as Buffer)]).toEqual([7, 6, 5]);
    expect([...(fs.readFileSync('/data/sub') as Buffer)]).toEqual([8, 7]);
    expect([...(fs.readFileSync('/data/ab') as Buffer)]).toEqual([9, 8, 7, 6, 5, 4]);
  });

  it('supports the flags wx and a', () => {
    fs.writeFileSync('/data/log', 'one\n', { flag: 'wx' });
    expect(failureOf(() => fs.writeFileSync('/data/log', 'x', { flag: 'wx' }))).toMatchObject({ code: 'EEXIST', syscall: 'open' });
    fs.writeFileSync('/data/log', 'two\n', { flag: 'a' });
    expect(fs.readFileSync('/data/log', 'utf8')).toBe('one\ntwo\n');
  });

  it('normalises paths: dot segments, double and trailing slashes, relative to /', () => {
    fs.writeFileSync('/data/users/../users//u.mpd', 'x');
    expect(fs.existsSync('/data/users/u.mpd')).toBe(true);
    expect(fs.existsSync('data/users/./u.mpd/')).toBe(true);
    expect(fs.readFileSync('/data/x/../users/u.mpd', 'utf8')).toBe('x');
  });

  it('rejects arguments Node rejects', () => {
    expect(() => fs.readFileSync(42 as unknown as string)).toThrow(TypeError);
    expect(() => fs.writeFileSync('/data/x', 42 as unknown as string)).toThrow(TypeError);
    expect(() => fs.readFileSync('/data/a\0b')).toThrow(TypeError);
    expect(() => fs.readFileSync('/data/users', 'nonsense' as BufferEncoding)).toThrow(TypeError);
    expect(fs.existsSync(undefined as unknown as string)).toBe(false);
    expect(fs.existsSync('/data/a\0b')).toBe(false);
  });
});

describe('directories, stat, rename, rm', () => {
  it('mkdirSync: recursive returns the first created directory, like Node', () => {
    expect(fs.mkdirSync('/data/a/b/c', { recursive: true })).toBe('/data/a');
    expect(fs.mkdirSync('/data/a/b/c', { recursive: true })).toBeUndefined();
    expect(fs.mkdirSync('/data/a/b/d')).toBeUndefined();
    expect(fs.readdirSync('/data/a/b')).toEqual(['c', 'd']);
  });

  it('statSync reports size, times and the kind', () => {
    const before = Date.now();
    fs.writeFileSync('/data/users/u.mpd', Buffer.alloc(1234));
    const file = fs.statSync('/data/users/u.mpd') as Stats;
    expect(file).toBeInstanceOf(Stats);
    expect(file.isFile()).toBe(true);
    expect(file.isDirectory()).toBe(false);
    expect(file.isSymbolicLink()).toBe(false);
    expect(file.size).toBe(1234);
    expect(file.mtime).toBeInstanceOf(Date);
    expect(file.mtimeMs).toBeGreaterThanOrEqual(before);
    expect(file.mtime.getTime()).toBe(file.mtimeMs);
    const dir = fs.statSync('/data/users') as Stats;
    expect(dir.isDirectory()).toBe(true);
    expect(dir.isFile()).toBe(false);
    expect(fs.statSync('/data/nope', { throwIfNoEntry: false })).toBeUndefined();
    expect((fs.lstatSync('/data/users/u.mpd') as Stats).size).toBe(1234);
  });

  it('a write updates the modification time', () => {
    let now = 1_000;
    installVfs(new Vfs({ now: () => now }));
    fs.writeFileSync('/data/f', 'a');
    expect((fs.statSync('/data/f') as Stats).mtimeMs).toBe(1_000);
    now = 5_000;
    fs.writeFileSync('/data/f', 'b');
    expect((fs.statSync('/data/f') as Stats).mtimeMs).toBe(5_000);
    expect((fs.statSync('/data/f') as Stats).birthtimeMs).toBe(1_000);
  });

  it('renameSync replaces a file atomically and moves directories with their content', () => {
    fs.writeFileSync('/data/a.json', 'old');
    fs.writeFileSync('/data/a.json.tmp', 'new');
    fs.renameSync('/data/a.json.tmp', '/data/a.json');
    expect(fs.readFileSync('/data/a.json', 'utf8')).toBe('new');
    expect(fs.existsSync('/data/a.json.tmp')).toBe(false);

    fs.writeFileSync('/data/users/u.mpd', 'diary');
    fs.renameSync('/data/users', '/data/people');
    expect(fs.readFileSync('/data/people/u.mpd', 'utf8')).toBe('diary');
    expect(fs.existsSync('/data/users')).toBe(false);
    fs.renameSync('/data/a.json', '/data/a.json');
    expect(fs.readFileSync('/data/a.json', 'utf8')).toBe('new');
  });

  it('renameSync refuses what a posix file system refuses', () => {
    fs.writeFileSync('/data/f', 'x');
    fs.mkdirSync('/data/empty');
    expect(failureOf(() => fs.renameSync('/data/f', '/data/users'))).toMatchObject({ code: 'EISDIR' });
    expect(failureOf(() => fs.renameSync('/data/users', '/data/f'))).toMatchObject({ code: 'ENOTDIR' });
    fs.writeFileSync('/data/users/u', 'x');
    expect(failureOf(() => fs.renameSync('/data/empty', '/data/users'))).toMatchObject({ code: 'ENOTEMPTY' });
    expect(failureOf(() => fs.renameSync('/data/users', '/data/users/inside'))).toMatchObject({ code: 'EINVAL' });
    fs.renameSync('/data/users', '/data/empty');
    expect(fs.readdirSync('/data/empty')).toEqual(['u']);
  });

  it('rmSync: force ignores a missing path, recursive removes a tree', () => {
    fs.rmSync('/data/nope', { force: true });
    fs.writeFileSync('/data/users/a', '1');
    fs.mkdirSync('/data/users/sub');
    fs.writeFileSync('/data/users/sub/b', '2');
    fs.rmSync('/data/users/a');
    expect(failureOf(() => fs.rmSync('/data/users'))).toMatchObject({ code: 'ERR_FS_EISDIR' });
    fs.rmSync('/data/users', { recursive: true });
    expect(fs.existsSync('/data/users')).toBe(false);
    expect(fs.existsSync('/data/users/sub/b')).toBe(false);
    expect(failureOf(() => fs.rmSync('/data', { recursive: true }))).toMatchObject({ code: 'EPERM' });
    expect(failureOf(() => fs.rmSync('/', { recursive: true, force: true }))).toMatchObject({ code: 'EPERM' });
  });

  it('readdirSync lists names, sorted, or Dirents', () => {
    fs.writeFileSync('/data/b.json', '1');
    fs.writeFileSync('/data/a.json', '1');
    expect(fs.readdirSync('/data')).toEqual(['a.json', 'b.json', 'users']);
    const entries = fs.readdirSync('/data', { withFileTypes: true }) as named.Dirent[];
    expect(entries.map((e) => [e.name, e.isDirectory(), e.isFile(), e.parentPath])).toEqual([
      ['a.json', false, true, '/data'],
      ['b.json', false, true, '/data'],
      ['users', true, false, '/data'],
    ]);
  });

  it('unlinkSync, rmdirSync, accessSync and chmodSync behave', () => {
    fs.writeFileSync('/data/f', 'x');
    fs.accessSync('/data/f');
    fs.chmodSync('/data/f', 0o600);
    fs.unlinkSync('/data/f');
    expect(fs.existsSync('/data/f')).toBe(false);
    fs.rmdirSync('/data/users');
    expect(fs.existsSync('/data/users')).toBe(false);
    expect(failureOf(() => fs.chmodSync('/data/f', 0o600))).toMatchObject({ code: 'ENOENT' });
  });
});

describe('file descriptors: the fsync-after-write pattern of the JSON registries', () => {
  it('open w / writeSync / fsyncSync / closeSync produces the file', () => {
    const fd = fs.openSync('/data/accounts.json.tmp', 'w', 0o600);
    expect(typeof fd).toBe('number');
    expect(fs.readFileSync('/data/accounts.json.tmp', 'utf8')).toBe('');
    expect(fs.writeSync(fd, '{"version":1,', null, 'utf8')).toBe(13);
    expect(fs.writeSync(fd, '"accounts":[]}')).toBe(14);
    fs.fsyncSync(fd);
    expect(fs.fstatSync(fd).size).toBe(27);
    fs.closeSync(fd);
    expect(fs.readFileSync('/data/accounts.json.tmp', 'utf8')).toBe('{"version":1,"accounts":[]}');
    expect(failureOf(() => fs.closeSync(fd))).toMatchObject({ code: 'EBADF', syscall: 'close' });
    expect(failureOf(() => fs.writeSync(fd, 'x'))).toMatchObject({ code: 'EBADF', syscall: 'write' });
    expect(failureOf(() => fs.fsyncSync(fd))).toMatchObject({ code: 'EBADF', syscall: 'fsync' });
  });

  it('open w truncates; wx must create; r+ updates in place; a appends', () => {
    fs.writeFileSync('/data/f', 'previous content');
    let fd = fs.openSync('/data/f', 'w');
    fs.closeSync(fd);
    expect(fs.readFileSync('/data/f', 'utf8')).toBe('');
    expect(failureOf(() => fs.openSync('/data/f', 'wx'))).toMatchObject({ code: 'EEXIST', syscall: 'open' });

    fs.writeFileSync('/data/f', '0123456789');
    fd = fs.openSync('/data/f', 'r+');
    fs.writeSync(fd, 'AB', 3);
    fs.writeSync(fd, Buffer.from('xxCDxx'), 2, 2, 8);
    fs.writeSync(fd, 'Z');
    fs.closeSync(fd);
    expect(fs.readFileSync('/data/f', 'utf8')).toBe('Z12AB567CD');

    fd = fs.openSync('/data/f', 'a');
    fs.writeSync(fd, '!');
    fs.writeSync(fd, new Uint8Array([63]));
    fs.closeSync(fd);
    expect(fs.readFileSync('/data/f', 'utf8')).toBe('Z12AB567CD!?');
  });

  it('a read-only descriptor cannot write; writing past the end pads with zeros', () => {
    fs.writeFileSync('/data/f', 'ab');
    const reader = fs.openSync('/data/f', 'r');
    expect(failureOf(() => fs.writeSync(reader, 'x'))).toMatchObject({ code: 'EBADF' });
    fs.closeSync(reader);
    const fd = fs.openSync('/data/f', 'r+');
    fs.writeSync(fd, 'z', 4);
    fs.closeSync(fd);
    expect([...(fs.readFileSync('/data/f') as Buffer)]).toEqual([97, 98, 0, 0, 122]);
    expect(() => fs.writeSync(fs.openSync('/data/f', 'r+'), Buffer.from('abc'), 2, 5)).toThrow(RangeError);
    expect(() => fs.openSync('/data/f', 'q')).toThrow(TypeError);
  });
});

describe('fs.promises (as security/vault.ts uses it)', () => {
  it('open / writeFile / sync / close, access, rename, readFile, rm, mkdir', async () => {
    await fs.promises.mkdir('/data/users/deep', { recursive: true });
    const tmp = '/data/users/u_1.mpd.tmp';
    const handle = await fs.promises.open(tmp, 'w', 0o600);
    expect(handle).toBeInstanceOf(FileHandle);
    await handle.writeFile(Buffer.from('container bytes'));
    await handle.sync();
    await handle.close();
    await handle.close();
    await expect(fs.promises.access('/data/users/u_1.mpd')).rejects.toMatchObject({ code: 'ENOENT', syscall: 'access' });
    await fs.promises.rename(tmp, '/data/users/u_1.mpd');
    await fs.promises.access('/data/users/u_1.mpd');
    expect(((await fs.promises.readFile('/data/users/u_1.mpd')) as Buffer).toString()).toBe('container bytes');
    expect(await fs.promises.readFile('/data/users/u_1.mpd', 'utf8')).toBe('container bytes');
    await fs.promises.rm('/data/users/u_1.mpd', { force: true });
    await fs.promises.rm('/data/users/u_1.mpd', { force: true });
    await expect(fs.promises.readFile('/data/users/u_1.mpd')).rejects.toMatchObject({ code: 'ENOENT', syscall: 'open' });
    await expect(fs.promises.rm('/data/users/u_1.mpd')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.promises.rename('/data/nope', '/data/x')).rejects.toMatchObject({ code: 'ENOENT', syscall: 'rename' });
  });

  it('a FileHandle writes, reads back and stats', async () => {
    const handle = await fs.promises.open('/data/f', 'w');
    expect((await handle.write('hello ')).bytesWritten).toBe(6);
    const second = Buffer.from('world');
    expect(await handle.write(second)).toEqual({ bytesWritten: 5, buffer: second });
    await handle.appendFile('!');
    expect(await handle.readFile('utf8')).toBe('hello world!');
    expect((await handle.stat()).size).toBe(12);
    await handle.datasync();
    await handle.close();
    await fs.promises.writeFile('/data/g', 'text');
    expect((await fs.promises.stat('/data/g')).size).toBe(4);
    expect(await fs.promises.readdir('/data')).toEqual(['f', 'g', 'users']);
    await fs.promises.unlink('/data/g');
    expect(fs.existsSync('/data/g')).toBe(false);
  });
});

describe('assets and areas', () => {
  it('registered assets are visible and read-only', () => {
    const vfs = getVfs();
    const wasm = new Uint8Array([0, 97, 115, 109]);
    vfs.registerAsset('/assets/sql-wasm.wasm', wasm);
    vfs.registerAsset('/assets/fonts/DejaVuSans.ttf', new Uint8Array(10));
    expect(fs.existsSync('/assets/sql-wasm.wasm')).toBe(true);
    expect(fs.existsSync('/assets/fonts')).toBe(true);
    expect((fs.statSync('/assets/fonts/DejaVuSans.ttf') as Stats).isFile()).toBe(true);
    expect((fs.statSync('/assets/fonts/DejaVuSans.ttf') as Stats).size).toBe(10);
    expect((fs.statSync('/assets/fonts') as Stats).isDirectory()).toBe(true);
    expect([...(fs.readFileSync('/assets/sql-wasm.wasm') as Buffer)]).toEqual([0, 97, 115, 109]);
    expect(fs.readdirSync('/assets')).toEqual(['fonts', 'sql-wasm.wasm']);
    expect(fs.existsSync('/assets/fonts/Missing.ttf')).toBe(false);

    for (const run of [
      () => fs.writeFileSync('/assets/sql-wasm.wasm', 'x'),
      () => fs.writeFileSync('/assets/new-file', 'x'),
      () => fs.rmSync('/assets/sql-wasm.wasm'),
      () => fs.rmSync('/assets', { recursive: true }),
      () => fs.renameSync('/assets/sql-wasm.wasm', '/data/x'),
      () => fs.renameSync('/data/users', '/assets/users'),
      () => fs.mkdirSync('/assets/more'),
      () => fs.openSync('/assets/sql-wasm.wasm', 'w'),
      () => fs.openSync('/assets/sql-wasm.wasm', 'r+'),
    ]) {
      expect(failureOf(run)).toMatchObject({ code: 'EACCES' });
    }
    const fd = fs.openSync('/assets/sql-wasm.wasm', 'r');
    expect(fs.fstatSync(fd).size).toBe(4);
    fs.closeSync(fd);
    expect([...(fs.readFileSync('/assets/sql-wasm.wasm') as Buffer)]).toEqual([0, 97, 115, 109]);
  });

  it('an asset can be registered at any path outside the data directory', () => {
    const vfs = getVfs();
    vfs.registerAsset('/somewhere/else/file.bin', new Uint8Array(3));
    expect(fs.existsSync('/somewhere/else/file.bin')).toBe(true);
    expect(failureOf(() => fs.writeFileSync('/somewhere/else/file.bin', 'x'))).toMatchObject({ code: 'EACCES' });
    expect(() => vfs.registerAsset('/data/users/x', new Uint8Array(1))).toThrow(/EINVAL/);
  });

  it('paths outside /data are a scratch area in memory', () => {
    fs.mkdirSync('/tmp/export', { recursive: true });
    fs.writeFileSync('/tmp/export/diary.pdf', 'pdf');
    expect(fs.readFileSync('/tmp/export/diary.pdf', 'utf8')).toBe('pdf');
    fs.rmSync('/tmp', { recursive: true });
    expect(fs.existsSync('/tmp')).toBe(false);
  });
});

describe('errors agree with the real node:fs', () => {
  const realRoot = nodeFs.mkdtempSync(nodePath.join(os.tmpdir(), 'mpd-vfs-parity-'));
  afterAll(() => nodeFs.rmSync(realRoot, { recursive: true, force: true }));

  /** Both file systems get the same little tree: f (file), dir/ with dir/c, and nothing else. */
  function prepare(): void {
    nodeFs.rmSync(realRoot, { recursive: true, force: true });
    nodeFs.mkdirSync(nodePath.join(realRoot, 'dir'), { recursive: true });
    nodeFs.writeFileSync(nodePath.join(realRoot, 'f'), 'x');
    nodeFs.writeFileSync(nodePath.join(realRoot, 'dir', 'c'), 'x');
    fs.mkdirSync('/data/p/dir', { recursive: true });
    fs.writeFileSync('/data/p/f', 'x');
    fs.writeFileSync('/data/p/dir/c', 'x');
  }

  /** The real path of a relative posix path, and the message with the real root written as /data/p. */
  const real = (relative: string): string => nodePath.join(realRoot, ...relative.split('/'));
  const virtual = (relative: string): string => `/data/p/${relative}`;
  const neutral = (message: string): string => message.split(realRoot).join('/data/p').replace(/\\/g, '/');

  type Api = Pick<
    typeof nodeFs,
    | 'readFileSync'
    | 'statSync'
    | 'mkdirSync'
    | 'renameSync'
    | 'rmSync'
    | 'unlinkSync'
    | 'rmdirSync'
    | 'readdirSync'
    | 'openSync'
    | 'writeFileSync'
    | 'accessSync'
    | 'closeSync'
    | 'writeSync'
    | 'fsyncSync'
  >;

  const CASES: Array<[string, (api: Api, at: (relative: string) => string) => unknown]> = [
    ['read a missing file', (api, at) => api.readFileSync(at('nope'))],
    ['read a directory', (api, at) => api.readFileSync(at('dir'))],
    ['stat a missing file', (api, at) => api.statSync(at('nope'))],
    ['mkdir an existing directory', (api, at) => api.mkdirSync(at('dir'))],
    ['mkdir without the parent', (api, at) => api.mkdirSync(at('a/b'))],
    ['mkdir -p over a file', (api, at) => api.mkdirSync(at('f'), { recursive: true })],
    ['mkdir -p below a file', (api, at) => api.mkdirSync(at('f/x'), { recursive: true })],
    ['rename a missing file', (api, at) => api.renameSync(at('nope'), at('z'))],
    ['rename into a missing directory', (api, at) => api.renameSync(at('f'), at('q/z'))],
    ['rm a missing file', (api, at) => api.rmSync(at('nope'))],
    ['rm a directory without recursive', (api, at) => api.rmSync(at('dir'))],
    ['unlink a missing file', (api, at) => api.unlinkSync(at('nope'))],
    ['rmdir a directory with content', (api, at) => api.rmdirSync(at('dir'))],
    ['readdir a missing directory', (api, at) => api.readdirSync(at('nope'))],
    ['readdir a file', (api, at) => api.readdirSync(at('f'))],
    ['open wx an existing file', (api, at) => api.openSync(at('f'), 'wx')],
    ['open r a missing file', (api, at) => api.openSync(at('nope'), 'r')],
    ['open w without the parent', (api, at) => api.openSync(at('q/z'), 'w')],
    ['write without the parent', (api, at) => api.writeFileSync(at('q/z'), 'x')],
    ['write onto a directory', (api, at) => api.writeFileSync(at('dir'), 'x')],
    ['access a missing file', (api, at) => api.accessSync(at('nope'))],
    ['close a bad descriptor', (api) => api.closeSync(987_654)],
    ['write to a bad descriptor', (api) => api.writeSync(987_654, 'x')],
    ['fsync a bad descriptor', (api) => api.fsyncSync(987_654)],
  ];

  it.each(CASES)('%s', (_name, run) => {
    prepare();
    const expected = failureOf(() => run(nodeFs, real));
    const actual = failureOf(() => run(fs as unknown as Api, virtual));
    expect(actual.code).toBe(expected.code);
    expect(actual.syscall).toBe(expected.syscall);
    expect(actual.message).toBe(neutral(expected.message));
  });

  it('the cases Windows answers differently follow Linux (the phone)', () => {
    prepare();
    expect(failureOf(() => fs.statSync('/data/p/f/x'))).toEqual({
      code: 'ENOTDIR',
      syscall: 'stat',
      message: "ENOTDIR: not a directory, stat '/data/p/f/x'",
    });
    expect(failureOf(() => fs.renameSync('/data/p/f', '/data/p/dir'))).toEqual({
      code: 'EISDIR',
      syscall: 'rename',
      message: "EISDIR: illegal operation on a directory, rename '/data/p/f' -> '/data/p/dir'",
    });
    expect(failureOf(() => fs.rmdirSync('/data/p/f'))).toMatchObject({ code: 'ENOTDIR', syscall: 'rmdir' });
    expect(failureOf(() => fs.readFileSync('/data/p/f/x'))).toMatchObject({ code: 'ENOTDIR', syscall: 'open' });
    const error = (() => {
      try {
        fs.readFileSync('/data/p/nope');
      } catch (e) {
        return e as NodeJS.ErrnoException;
      }
      return null;
    })();
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ errno: -2, code: 'ENOENT', syscall: 'open', path: '/data/p/nope' });
  });
});
