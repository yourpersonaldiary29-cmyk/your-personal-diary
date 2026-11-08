// @vitest-environment node
/**
 * The VFS of the mobile core (mobile/core/vfs/vfs.ts): the in-memory mirror, the write-behind
 * queue with its atomic write pattern, `boot()` / `drain()`, failures of the storage, the
 * memory-only areas. Every test runs against every storage kind (memory backend, Capacitor
 * backend on a fake plugin in both flavours, worker RPC).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import fs, { installVfs } from '../../core/vfs/node-fs';
import { Vfs } from '../../core/vfs/vfs';
import type { StorageBackend } from '../../shared/storage-protocol';
import { FaultyStorage, STORAGE_KINDS, bytesOf, patternBytes, text, textFiles, type StorageFixture } from './helpers';

interface Rig {
  fixture: StorageFixture;
  faulty: FaultyStorage;
  vfs: Vfs;
  logs: string[];
}

/** The mutating storage calls so far (what a crash could interrupt), in order. */
const changes = (faulty: FaultyStorage): string[] => faulty.calls.filter((call) => /^(write|rename|remove|mkdir) /.test(call));

/** The first half of a diary save in security/vault.ts: `<file>.tmp`, written and fsynced. */
async function writeDiaryTmp(file: string, content: string): Promise<void> {
  const handle = await fs.promises.open(`${file}.tmp`, 'w', 0o600);
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** The second half: the current file becomes `.prev`, `.tmp` becomes the file. */
async function replaceDiary(file: string): Promise<void> {
  if (fs.existsSync(file)) await fs.promises.rename(file, `${file}.prev`);
  await fs.promises.rename(`${file}.tmp`, file);
}

async function saveDiary(file: string, content: string): Promise<void> {
  await writeDiaryTmp(file, content);
  await replaceDiary(file);
}

/** deleteVaultFiles() of security/vault.ts (account deletion). */
async function deleteDiary(file: string): Promise<void> {
  for (const path of [file, `${file}.prev`, `${file}.tmp`]) await fs.promises.rm(path, { force: true });
}

/** What security/vault.ts opens: the first of `.mpd`, `.mpd.tmp`, `.mpd.prev` that exists. */
function openDiary(file: string): string | null {
  for (const path of [file, `${file}.tmp`, `${file}.prev`]) if (fs.existsSync(path)) return fs.readFileSync(path, 'utf8') as string;
  return null;
}

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (e) {
    return (e as NodeJS.ErrnoException).code;
  }
  return 'no error';
}

describe.each(STORAGE_KINDS)('VFS on the $name', ({ create, largeFileBytes }) => {
  /** A VFS on a fresh storage, installed behind the fs facade, not booted yet. */
  function rig(fixture: StorageFixture = create()): Rig {
    const faulty = new FaultyStorage(fixture.open());
    const logs: string[] = [];
    const vfs = new Vfs({ backend: faulty, log: (level, message) => logs.push(`${level}: ${message}`) });
    installVfs(vfs);
    return { fixture, faulty, vfs, logs };
  }

  /** Booted, with the call log starting empty. */
  async function booted(fixture?: StorageFixture): Promise<Rig> {
    const r = rig(fixture);
    await r.vfs.boot();
    r.faulty.calls.length = 0;
    return r;
  }

  /** What a restarted app sees: a new VFS on a new connection to the same storage. */
  async function restart(fixture: StorageFixture): Promise<Rig> {
    return booted(fixture);
  }

  beforeEach(() => {
    installVfs(new Vfs());
  });

  // -------------------------------------------------------------------------
  describe('boot', () => {
    it('refuses every access to /data until the storage is loaded', async () => {
      const { vfs } = rig();
      expect(vfs.isBooted).toBe(false);
      for (const run of [
        () => fs.existsSync('/data/accounts.json'),
        () => fs.readFileSync('/data/accounts.json'),
        () => fs.statSync('/data'),
        () => fs.writeFileSync('/data/accounts.json', '{}'),
        () => fs.mkdirSync('/data/users', { recursive: true }),
        () => fs.renameSync('/data/a', '/data/b'),
        () => fs.rmSync('/data/a', { force: true }),
        () => fs.openSync('/data/a', 'w'),
        () => fs.readdirSync('/data'),
      ]) {
        expect(run).toThrow(/EIO: .*boot\(\) has not completed/);
      }
      // Assets and the scratch area do not need the storage.
      vfs.registerAsset('/assets/sql-wasm.wasm', new Uint8Array(4));
      expect(fs.existsSync('/assets/sql-wasm.wasm')).toBe(true);
      fs.writeFileSync('/tmp-file', 'x');
      await vfs.boot();
      expect(vfs.isBooted).toBe(true);
      expect(fs.existsSync('/data/accounts.json')).toBe(false);
      expect(fs.readdirSync('/data')).toEqual([]);
    });

    it('loads every stored file - nested, binary, empty - into the mirror', async () => {
      const first = await booted();
      fs.mkdirSync('/data/users', { recursive: true });
      fs.writeFileSync('/data/accounts.json', '{"version":1}');
      fs.writeFileSync('/data/device.key', patternBytes(32));
      fs.writeFileSync('/data/users/u_1.mpd', patternBytes(5000, 3));
      fs.writeFileSync('/data/users/u_1.mpd.prev', patternBytes(4000, 4));
      fs.writeFileSync('/data/empty', '');
      fs.mkdirSync('/data/tls');
      await first.vfs.drain();

      const second = await restart(first.fixture);
      expect(fs.readdirSync('/data')).toEqual(['accounts.json', 'device.key', 'empty', 'tls', 'users']);
      expect(fs.readdirSync('/data/users')).toEqual(['u_1.mpd', 'u_1.mpd.prev']);
      expect(fs.readFileSync('/data/accounts.json', 'utf8')).toBe('{"version":1}');
      expect((fs.readFileSync('/data/device.key') as Buffer).equals(Buffer.from(patternBytes(32)))).toBe(true);
      expect((fs.readFileSync('/data/users/u_1.mpd') as Buffer).equals(Buffer.from(patternBytes(5000, 3)))).toBe(true);
      expect((fs.readFileSync('/data/users/u_1.mpd.prev') as Buffer).equals(Buffer.from(patternBytes(4000, 4)))).toBe(true);
      expect(fs.statSync('/data/users/u_1.mpd')?.size).toBe(5000);
      expect(fs.statSync('/data/empty')?.size).toBe(0);
      expect(fs.statSync('/data/tls')?.isDirectory()).toBe(true);
      expect(fs.statSync('/data/accounts.json')?.mtimeMs).toBeGreaterThan(0);
      // Loading changed nothing in the storage.
      expect(changes(second.faulty)).toEqual([]);
      second.fixture.verify();
    });

    it('is idempotent and shared between concurrent callers', async () => {
      const { vfs, faulty } = rig();
      await Promise.all([vfs.boot(), vfs.boot(), vfs.boot()]);
      await vfs.boot();
      expect(faulty.calls.filter((call) => call === 'mkdir ')).toHaveLength(1);
    });

    it('a failed boot leaves the mirror unloaded and can be retried', async () => {
      const first = await booted();
      fs.writeFileSync('/data/accounts.json', '{"accounts":["kept"]}');
      await first.vfs.drain();

      const { vfs, faulty } = rig(first.fixture);
      faulty.failNext('read', /accounts\.json/);
      await expect(vfs.boot()).rejects.toMatchObject({ code: 'EIO' });
      expect(vfs.isBooted).toBe(false);
      expect(() => fs.existsSync('/data/accounts.json')).toThrow(/EIO/);
      await vfs.boot();
      expect(fs.readFileSync('/data/accounts.json', 'utf8')).toBe('{"accounts":["kept"]}');
    });

    it('without a backend everything stays in memory and boot() has nothing to do', async () => {
      const vfs = new Vfs();
      installVfs(vfs);
      expect(vfs.isBooted).toBe(true);
      await vfs.boot();
      fs.writeFileSync('/data/x', '1');
      await vfs.drain();
      expect(fs.readFileSync('/data/x', 'utf8')).toBe('1');
    });
  });

  // -------------------------------------------------------------------------
  describe('write-behind', () => {
    it('a synchronous write is in the mirror at once and in the storage after drain()', async () => {
      const { vfs, fixture } = await booted();
      fs.writeFileSync('/data/accounts.json', '{"n":1}');
      expect(fs.readFileSync('/data/accounts.json', 'utf8')).toBe('{"n":1}');
      expect(fixture.files().size).toBe(0);
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'accounts.json': '{"n":1}' });
    });

    it('writes atomically: temporary name, previous file moved aside, rename into place, clean-up', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.writeFileSync('/data/a', 'one');
      await vfs.drain();
      expect(changes(faulty)).toEqual(['write a.tmp-1', 'rename a.tmp-1 -> a']);

      faulty.calls.length = 0;
      fs.writeFileSync('/data/a', 'two');
      await vfs.drain();
      expect(changes(faulty)).toEqual(['write a.tmp-2', 'rename a -> a.old-2', 'rename a.tmp-2 -> a', 'remove a.old-2']);
      expect(textFiles(fixture.files())).toEqual({ a: 'two' });
      fixture.verify();
    });

    it('replays renames, deletes and directories in the order they were made', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.mkdirSync('/data/users', { recursive: true });
      fs.writeFileSync('/data/users/u.mpd.tmp', 'v1');
      fs.renameSync('/data/users/u.mpd.tmp', '/data/users/u.mpd');
      fs.writeFileSync('/data/users/u.mpd.tmp', 'v2');
      fs.renameSync('/data/users/u.mpd', '/data/users/u.mpd.prev');
      fs.renameSync('/data/users/u.mpd.tmp', '/data/users/u.mpd');
      fs.writeFileSync('/data/gone', 'x');
      fs.rmSync('/data/gone');
      await vfs.drain();
      expect(changes(faulty)).toEqual([
        'mkdir users',
        'write users/u.mpd.tmp.tmp-1',
        'rename users/u.mpd.tmp.tmp-1 -> users/u.mpd.tmp',
        'rename users/u.mpd.tmp -> users/u.mpd',
        'write users/u.mpd.tmp.tmp-3',
        'rename users/u.mpd.tmp.tmp-3 -> users/u.mpd.tmp',
        'rename users/u.mpd -> users/u.mpd.prev',
        'rename users/u.mpd.tmp -> users/u.mpd',
        'write gone.tmp-6',
        'rename gone.tmp-6 -> gone',
        'remove gone',
      ]);
      expect(textFiles(fixture.files())).toEqual({ 'users/u.mpd': 'v2', 'users/u.mpd.prev': 'v1' });
      fixture.verify();
    });

    it('a rename over an existing file never asks the storage to overwrite', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.writeFileSync('/data/a', 'old');
      fs.writeFileSync('/data/a.tmp', 'new');
      await vfs.drain();
      faulty.calls.length = 0;
      fs.renameSync('/data/a.tmp', '/data/a');
      await vfs.drain();
      const [aside, move, cleanup] = changes(faulty);
      expect(aside).toMatch(/^rename a -> a\.old-\d+$/);
      expect(move).toBe('rename a.tmp -> a');
      expect(cleanup).toMatch(/^remove a\.old-\d+$/);
      expect(textFiles(fixture.files())).toEqual({ a: 'new' });
      fixture.verify();
    });

    it('several writes of one file in a row reach the storage as one write of the last content', async () => {
      const { vfs, faulty, fixture } = await booted();
      const fd = fs.openSync('/data/accounts.json.tmp', 'w', 0o600);
      fs.writeSync(fd, '{"accounts":', null, 'utf8');
      fs.writeSync(fd, '[]}');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fs.renameSync('/data/accounts.json.tmp', '/data/accounts.json');
      for (let i = 0; i < 20; i++) fs.writeFileSync('/data/counter', String(i));
      await vfs.drain();
      expect(changes(faulty)).toEqual([
        'write accounts.json.tmp.tmp-1',
        'rename accounts.json.tmp.tmp-1 -> accounts.json.tmp',
        'rename accounts.json.tmp -> accounts.json',
        'write counter.tmp-3',
        'rename counter.tmp-3 -> counter',
      ]);
      expect(textFiles(fixture.files())).toEqual({ 'accounts.json': '{"accounts":[]}', counter: '19' });
    });

    it('what is written through a descriptor is stored on fsync or close, not before', async () => {
      const { vfs, faulty, fixture } = await booted();
      const fd = fs.openSync('/data/f', 'w');
      fs.writeSync(fd, 'half');
      await vfs.drain();
      expect(changes(faulty)).toEqual([]);
      fs.writeSync(fd, ' full');
      fs.fsyncSync(fd);
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ f: 'half full' });
      fs.writeSync(fd, ' and more');
      fs.closeSync(fd);
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ f: 'half full and more' });
      // A descriptor still holding data when its file is renamed: the data goes first.
      const held = fs.openSync('/data/g.tmp', 'w');
      fs.writeSync(held, 'held back');
      fs.renameSync('/data/g.tmp', '/data/g');
      await vfs.drain();
      expect(textFiles(fixture.files())).toMatchObject({ g: 'held back' });
      fs.closeSync(held);
    });

    it('concurrent writes to one file keep their order', async () => {
      const { vfs, faulty, fixture } = await booted();
      const seen: number[] = [];
      for (let i = 1; i <= 40; i++) {
        fs.writeFileSync('/data/sessions.json', JSON.stringify({ version: i }));
        // Let the queue run now and then, so writes pile up behind a write that is under way.
        if (i % 3 === 0) await Promise.resolve();
        if (i % 7 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
        const stored = fixture.files().get('sessions.json');
        if (stored) seen.push((JSON.parse(text(stored)) as { version: number }).version);
      }
      await vfs.drain();
      expect(JSON.parse(text(fixture.files().get('sessions.json') as Uint8Array))).toEqual({ version: 40 });
      // The storage only ever moved forward: never a complete older version after a newer one.
      expect(seen).toEqual([...seen].sort((a, b) => a - b));
      expect(changes(faulty).filter((call) => call.startsWith('write ')).length).toBeLessThan(40);
      expect([...fixture.files().keys()]).toEqual(['sessions.json']);
    });

    it('drain() waits for everything queued so far, also when called twice', async () => {
      const { vfs, fixture } = await booted();
      fs.mkdirSync('/data/users');
      for (let i = 0; i < 5; i++) fs.writeFileSync(`/data/users/u_${i}.mpd`, patternBytes(200, i));
      await Promise.all([vfs.drain(), vfs.drain()]);
      expect([...fixture.files().keys()]).toEqual(['users/u_0.mpd', 'users/u_1.mpd', 'users/u_2.mpd', 'users/u_3.mpd', 'users/u_4.mpd']);
      await vfs.drain();
      expect(vfs.outOfSync()).toEqual([]);
    });

    it('a change queued in direct reaction to the last durable ticket is not left behind', async () => {
      const { vfs, fixture } = await booted();
      // The reaction runs in the very microtask turn in which the queue ran empty.
      const chained = vfs.whenDurable(vfs.writeFile('/data/a', bytesOf('1'))).then(() => fs.writeFileSync('/data/b', '2'));
      await chained;
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ a: '1', b: '2' });
      // The same through a chain of reactions, each queuing the next change.
      let last: Promise<void> = Promise.resolve();
      for (let i = 0; i < 5; i++) last = last.then(() => vfs.whenDurable(vfs.writeFile(`/data/c${i}`, bytesOf(String(i)))));
      await last;
      await vfs.drain();
      expect(Object.keys(textFiles(fixture.files()))).toEqual(['a', 'b', 'c0', 'c1', 'c2', 'c3', 'c4']);
    });

    it('fs.promises resolves an operation only when it is in the storage', async () => {
      const { faulty, fixture } = await booted();
      await fs.promises.mkdir('/data/users', { recursive: true });
      expect(changes(faulty)).toEqual(['mkdir users']);
      await fs.promises.writeFile('/data/users/a', 'one');
      expect(textFiles(fixture.files())).toEqual({ 'users/a': 'one' });

      const handle = await fs.promises.open('/data/users/u.mpd.tmp', 'w', 0o600);
      await handle.writeFile(bytesOf('diary v1'));
      expect(fixture.files().has('users/u.mpd.tmp')).toBe(false);
      await handle.sync();
      expect(text(fixture.files().get('users/u.mpd.tmp') as Uint8Array)).toBe('diary v1');
      await handle.close();
      await fs.promises.rename('/data/users/u.mpd.tmp', '/data/users/u.mpd');
      expect(textFiles(fixture.files())).toEqual({ 'users/a': 'one', 'users/u.mpd': 'diary v1' });
      await fs.promises.rm('/data/users/a', { force: true });
      expect(textFiles(fixture.files())).toEqual({ 'users/u.mpd': 'diary v1' });
      fixture.verify();
    });

    it('stores directory operations: mkdir -p, rename of a directory, rm -r', async () => {
      const { vfs, fixture } = await booted();
      fs.mkdirSync('/data/a/b/c', { recursive: true });
      fs.writeFileSync('/data/a/b/c/f', '1');
      fs.writeFileSync('/data/a/g', '2');
      fs.renameSync('/data/a/b', '/data/moved');
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'a/g': '2', 'moved/c/f': '1' });
      fs.rmSync('/data/moved', { recursive: true });
      fs.writeFileSync('/data/a/g', '3');
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'a/g': '3' });
      await restart(fixture);
      expect(fs.readdirSync('/data')).toEqual(['a']);
      expect(fs.readFileSync('/data/a/g', 'utf8')).toBe('3');
      fixture.verify();
    });

    it('refuses names it uses itself for temporary files', async () => {
      await booted();
      expect(codeOf(() => fs.writeFileSync('/data/x.tmp-1', 'x'))).toBe('EINVAL');
      expect(codeOf(() => fs.mkdirSync('/data/x.old-22'))).toBe('EINVAL');
      fs.writeFileSync('/data/x', 'x');
      expect(codeOf(() => fs.renameSync('/data/x', '/data/x.old-3'))).toBe('EINVAL');
      expect(codeOf(() => fs.openSync('/data/y.tmp-9', 'w'))).toBe('EINVAL');
      // The server's own temporary names and the scratch area are fine.
      fs.writeFileSync('/data/accounts.json.tmp', 'x');
      fs.writeFileSync('/scratch.tmp-1', 'x');
    });
  });

  // -------------------------------------------------------------------------
  describe('recovery at boot', () => {
    it('cleans up what an interrupted write left behind, before anything is read', async () => {
      const fixture = create();
      const raw = fixture.open();
      await raw.mkdir('users');
      // a: written completely, its replacement half written.
      await raw.write('a', bytesOf('a-previous'));
      await raw.write('a.tmp-3', bytesOf('a-ne'));
      // b: moved aside, the replacement not yet in place (and its temporary file still there).
      await raw.write('b.old-2', bytesOf('b-previous'));
      await raw.write('b.tmp-2', bytesOf('b-new'));
      // c: replaced, the previous file not yet deleted.
      await raw.write('c', bytesOf('c-new'));
      await raw.write('c.old-5', bytesOf('c-previous'));
      // d: never existed, its first write never finished.
      await raw.write('d.tmp-1', bytesOf('d-'));
      // e: two files moved aside (a double fault); the newest one is the previous version.
      await raw.write('users/e.mpd.old-1', bytesOf('e-older'));
      await raw.write('users/e.mpd.old-4', bytesOf('e-previous'));

      const { logs } = await booted(fixture);
      expect(textFiles(fixture.files())).toEqual({
        a: 'a-previous',
        b: 'b-previous',
        c: 'c-new',
        'users/e.mpd': 'e-previous',
      });
      expect(fs.readdirSync('/data')).toEqual(['a', 'b', 'c', 'users']);
      expect(fs.readFileSync('/data/b', 'utf8')).toBe('b-previous');
      expect(fs.readFileSync('/data/users/e.mpd', 'utf8')).toBe('e-previous');
      expect(logs.some((line) => /^warn: recovered 'b'/.test(line))).toBe(true);
      fixture.verify();
    });
  });

  // -------------------------------------------------------------------------
  describe('a directory renamed onto an empty directory', () => {
    /** The names in a directory of the storage itself (directories included), sorted. */
    const stored = async (fixture: StorageFixture, dir = ''): Promise<string[]> =>
      (await fixture.open().list(dir)).map((entry) => entry.name).sort();

    /** The mirror below /data: every directory with its names. */
    const tree = (): Record<string, string[]> =>
      Object.fromEntries((fs.readdirSync('/data') as string[]).map((name) => [name, fs.readdirSync(`/data/${name}`) as string[]]));

    /** /data/d1 with a file and the empty /data/d2, both stored; the call log starts empty. */
    async function twoDirs(): Promise<Rig> {
      const r = await booted();
      fs.mkdirSync('/data/d1');
      fs.writeFileSync('/data/d1/a', 'A');
      fs.mkdirSync('/data/d2');
      await r.vfs.drain();
      r.faulty.calls.length = 0;
      return r;
    }

    it('moves the empty directory aside and deletes it afterwards - never first', async () => {
      const { vfs, faulty, fixture } = await twoDirs();
      fs.renameSync('/data/d1', '/data/d2');
      await vfs.drain();
      expect(changes(faulty)).toEqual([
        expect.stringMatching(/^rename d2 -> d2\.old-\d+$/),
        'rename d1 -> d2',
        expect.stringMatching(/^remove d2\.old-\d+$/),
      ]);
      expect(await stored(fixture)).toEqual(['d2']);
      expect(textFiles(fixture.files())).toEqual({ 'd2/a': 'A' });
      await restart(fixture);
      expect(tree()).toEqual({ d2: ['a'] });
      expect(fs.readFileSync('/data/d2/a', 'utf8')).toBe('A');
      fixture.verify();
    });

    it.each([
      ['before the move-aside', 1, { d1: ['a'], d2: [] }],
      ['between the two renames', 2, { d1: ['a'], d2: [] }],
      ['before the clean-up', 3, { d2: ['a'] }],
    ])('a kill %s finds the directories of before or of after the rename', async (_when, call, expected) => {
      const { vfs, faulty, fixture } = await twoDirs();
      faulty.crashAt(call);
      fs.renameSync('/data/d1', '/data/d2');
      const outcome = await Promise.race([faulty.crashed.then(() => 'killed'), vfs.drain().then(() => 'completed')]);
      expect(outcome).toBe('killed');
      await restart(fixture);
      expect(tree()).toEqual(expected);
      expect(await stored(fixture)).toEqual(Object.keys(expected));
      fixture.verify();
    });

    it.each([
      ['the move-aside is refused', (faulty: FaultyStorage) => faulty.failNext('rename', /^d2$/), ['d1', 'd2']],
      ['the move-aside times out but ran', (faulty: FaultyStorage) => faulty.timeoutNext('rename', /^d2$/), ['d1', 'd2']],
      ['the rename is refused', (faulty: FaultyStorage) => faulty.failNext('rename', /^d1$/), ['d1', 'd2']],
      ['the rename times out but ran', (faulty: FaultyStorage) => faulty.timeoutNext('rename', /^d1$/), ['d2']],
    ])('when %s the storage keeps a state the core had, and the next drain() completes the rename', async (_what, arm, afterFailure) => {
      const { vfs, faulty, fixture } = await twoDirs();
      arm(faulty);
      fs.renameSync('/data/d1', '/data/d2');
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO', syscall: 'rename' });
      // What a restart would load now: both directories as before, or the renamed one.
      expect(await stored(fixture)).toEqual(afterFailure);
      expect(textFiles(fixture.files())).toEqual(afterFailure.includes('d1') ? { 'd1/a': 'A' } : { 'd2/a': 'A' });

      await vfs.drain();
      expect(vfs.outOfSync()).toEqual([]);
      expect(await stored(fixture)).toEqual(['d2']);
      expect(textFiles(fixture.files())).toEqual({ 'd2/a': 'A' });
      await restart(fixture);
      expect(tree()).toEqual({ d2: ['a'] });
      fixture.verify();
    });

    it('a moved-aside directory that cannot be deleted is deleted by a later drain()', async () => {
      const { vfs, faulty, fixture } = await twoDirs();
      faulty.failAlways('remove', /^d2\.old-\d+$/);
      fs.renameSync('/data/d1', '/data/d2');
      // The rename itself is stored: nothing to report.
      await vfs.drain();
      expect(await stored(fixture)).toEqual(['d2', expect.stringMatching(/^d2\.old-\d+$/)]);
      faulty.repair();
      await vfs.drain();
      expect(await stored(fixture)).toEqual(['d2']);
      expect(textFiles(fixture.files())).toEqual({ 'd2/a': 'A' });
      fixture.verify();
    });

    it('temporary files left in the replaced directory go with it and are not looked for afterwards', async () => {
      const { vfs, faulty, fixture } = await twoDirs();
      // A first write of d2/f fails at the rename into place, and its temporary file cannot be deleted.
      faulty.failNext('rename', /^d2\/f\.tmp-\d+$/);
      faulty.failAlways('remove', /\.tmp-\d+$/);
      await expect(fs.promises.writeFile('/data/d2/f', 'x')).rejects.toMatchObject({ code: 'EIO' });
      await fs.promises.rm('/data/d2/f');
      expect(Object.keys(textFiles(fixture.files()))).toEqual(['d1/a', expect.stringMatching(/^d2\/f\.tmp-\d+$/)]);

      faulty.calls.length = 0;
      fs.renameSync('/data/d1', '/data/d2');
      await vfs.drain();
      expect(changes(faulty)).toEqual([
        expect.stringMatching(/^rename d2 -> d2\.old-\d+$/),
        'rename d1 -> d2',
        expect.stringMatching(/^remove d2\.old-\d+$/),
      ]);
      expect(await stored(fixture)).toEqual(['d2']);
      expect(textFiles(fixture.files())).toEqual({ 'd2/a': 'A' });
      fixture.verify();
    });

    it('recovery at boot takes a moved-aside directory by its name, like a file', async () => {
      const fixture = create();
      const raw = fixture.open();
      // p: moved aside, what replaces it never arrived (an unfinished temporary file is still in it).
      await raw.mkdir('p.old-4');
      await raw.write('p.old-4/keep', bytesOf('kept'));
      await raw.write('p.old-4/x.tmp-2', bytesOf('ha'));
      // q: replaced, the empty directory that was moved aside not yet deleted.
      await raw.mkdir('q');
      await raw.write('q/new', bytesOf('new'));
      await raw.mkdir('q.old-7');

      const { logs } = await booted(fixture);
      expect(await stored(fixture)).toEqual(['p', 'q']);
      expect(textFiles(fixture.files())).toEqual({ 'p/keep': 'kept', 'q/new': 'new' });
      expect(tree()).toEqual({ p: ['keep'], q: ['new'] });
      expect(logs.some((line) => /^warn: recovered 'p'/.test(line))).toBe(true);
      fixture.verify();
    });
  });

  // -------------------------------------------------------------------------
  describe('failures of the storage', () => {
    it('a failed write surfaces on drain() and on the next change of that file, and is logged', async () => {
      const { vfs, faulty, fixture, logs } = await booted();
      fs.writeFileSync('/data/sessions.json', 'v1');
      await vfs.drain();

      faulty.failNext('write', /sessions\.json/);
      fs.writeFileSync('/data/sessions.json', 'v2');
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO', syscall: 'write', path: '/data/sessions.json' });
      expect(logs.filter((line) => line.startsWith('error:'))).toHaveLength(1);
      expect(logs.join('\n')).toMatch(/error: write 'sessions\.json' did not reach the storage: EIO: injected failure/);
      // The storage still holds the complete previous version; the mirror has the new one.
      expect(textFiles(fixture.files())).toEqual({ 'sessions.json': 'v1' });
      expect(fs.readFileSync('/data/sessions.json', 'utf8')).toBe('v2');
      expect(vfs.outOfSync()).toEqual(['sessions.json']);

      // The next change of that file reports the failure - once.
      expect(() => fs.writeFileSync('/data/sessions.json', 'v3')).toThrow(/^EIO: i\/o error, open '\/data\/sessions\.json' \(EIO: injected failure/);
      expect(fs.readFileSync('/data/sessions.json', 'utf8')).toBe('v2');
      fs.writeFileSync('/data/sessions.json', 'v3');
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'sessions.json': 'v3' });
      expect(vfs.outOfSync()).toEqual([]);
      fixture.verify();
    });

    it('the drain() after the one that reported a failure stores the file again from the mirror', async () => {
      const { vfs, faulty, fixture } = await booted();
      faulty.failNext('write');
      fs.writeFileSync('/data/accounts.json', '{"accounts":[1]}');
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
      expect(fixture.files().size).toBe(0);
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'accounts.json': '{"accounts":[1]}' });
      expect(vfs.outOfSync()).toEqual([]);
      // Healed: the next change of the file is not bothered with the old failure.
      fs.writeFileSync('/data/accounts.json', '{"accounts":[1,2]}');
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'accounts.json': '{"accounts":[1,2]}' });
    });

    it('keeps reporting while the storage stays broken, and catches up when it works again', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.mkdirSync('/data/users');
      fs.writeFileSync('/data/users/u.mpd', 'v1');
      await vfs.drain();
      faulty.failAlways('write');
      fs.writeFileSync('/data/users/u.mpd', 'v2');
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
      expect(textFiles(fixture.files())).toEqual({ 'users/u.mpd': 'v1' });
      faulty.repair();
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'users/u.mpd': 'v2' });
      fixture.verify();
    });

    it('holds back a rename whose source was never stored (no stale file is renamed into place)', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.writeFileSync('/data/accounts.json', 'old registry');
      // A stale temporary file of the server from an earlier run.
      fs.writeFileSync('/data/accounts.json.tmp', 'stale');
      await vfs.drain();
      faulty.calls.length = 0;

      faulty.failNext('write', /accounts\.json\.tmp/);
      fs.writeFileSync('/data/accounts.json.tmp', 'new registry');
      fs.renameSync('/data/accounts.json.tmp', '/data/accounts.json');
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
      // The rename did not run: the stale file was not promoted, the old registry is intact.
      expect(changes(faulty).filter((call) => call.startsWith('rename accounts.json.tmp ->'))).toEqual([]);
      expect(textFiles(fixture.files())).toMatchObject({ 'accounts.json': 'old registry' });
      expect(vfs.outOfSync()).toEqual(['accounts.json', 'accounts.json.tmp']);

      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'accounts.json': 'new registry' });
      expect(fs.readFileSync('/data/accounts.json', 'utf8')).toBe('new registry');
      fixture.verify();
    });

    it('the next save of the registry repairs both files without waiting for a drain', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.writeFileSync('/data/accounts.json', 'v1');
      await vfs.drain();
      faulty.failNext('write');
      fs.writeFileSync('/data/accounts.json.tmp', 'v2');
      fs.renameSync('/data/accounts.json.tmp', '/data/accounts.json');
      await vfs.idle();
      expect(vfs.outOfSync()).toEqual(['accounts.json', 'accounts.json.tmp']);
      // The failure is reported once on that file...
      expect(codeOf(() => fs.writeFileSync('/data/accounts.json.tmp', 'v3'))).toBe('EIO');
      // ...and the retry goes through and leaves nothing out of sync.
      fs.writeFileSync('/data/accounts.json.tmp', 'v3');
      fs.renameSync('/data/accounts.json.tmp', '/data/accounts.json');
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'accounts.json': 'v3' });
      expect(vfs.outOfSync()).toEqual([]);
      fixture.verify();
    });

    it('a failure of one file does not stop the others', async () => {
      const { vfs, faulty, fixture } = await booted();
      faulty.failNext('write', /^a\.tmp/);
      fs.writeFileSync('/data/a', 'a');
      fs.writeFileSync('/data/b', 'b');
      fs.writeFileSync('/data/c', 'c');
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO', path: '/data/a' });
      expect(textFiles(fixture.files())).toEqual({ b: 'b', c: 'c' });
      // b and c are not affected by a's failure.
      fs.writeFileSync('/data/b', 'b2');
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ a: 'a', b: 'b2', c: 'c' });
    });

    it('fs.promises rejects with EIO; the caller was told, so nothing else reports it', async () => {
      const { vfs, faulty, fixture, logs } = await booted();
      await fs.promises.mkdir('/data/users');
      await fs.promises.writeFile('/data/users/u.mpd', 'v1');

      faulty.failNext('write');
      const handle = await fs.promises.open('/data/users/u.mpd.tmp', 'w');
      await handle.writeFile('v2');
      await expect(handle.sync()).rejects.toMatchObject({ code: 'EIO', syscall: 'write', path: '/data/users/u.mpd.tmp' });
      await handle.close();
      expect(logs.filter((line) => line.startsWith('error:'))).toHaveLength(1);
      expect(textFiles(fixture.files())).toEqual({ 'users/u.mpd': 'v1' });

      // The vault's retry: the same sequence again, now successful.
      const retry = await fs.promises.open('/data/users/u.mpd.tmp', 'w');
      await retry.writeFile('v2');
      await retry.sync();
      await retry.close();
      await fs.promises.rename('/data/users/u.mpd', '/data/users/u.mpd.prev');
      await fs.promises.rename('/data/users/u.mpd.tmp', '/data/users/u.mpd');
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'users/u.mpd': 'v2', 'users/u.mpd.prev': 'v1' });

      faulty.failNext('rename');
      await expect(fs.promises.rename('/data/users/u.mpd.prev', '/data/users/old')).rejects.toMatchObject({ code: 'EIO', syscall: 'rename' });
      // Not awaited by anyone else: the next drain quietly stores the mirror's state.
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'users/u.mpd': 'v2', 'users/old': 'v1' });
      fixture.verify();
    });

    it('when a step of the atomic write fails, the previous file stays complete and in place', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.writeFileSync('/data/a', 'previous');
      await vfs.drain();

      // Moving the previous file aside fails.
      faulty.failNext('rename', /^a$/);
      fs.writeFileSync('/data/a', 'next-1');
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
      expect(textFiles(fixture.files())).toEqual({ a: 'previous' });

      // Renaming the new file into place fails: the previous one is put back.
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ a: 'next-1' });
      faulty.failNext('rename', /^a\.tmp-/);
      fs.writeFileSync('/data/a', 'next-2');
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
      expect(textFiles(fixture.files())).toEqual({ a: 'next-1' });
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ a: 'next-2' });
      fixture.verify();
    });

    it('a temporary file that cannot be deleted is deleted later; the write itself succeeded', async () => {
      const { vfs, faulty, fixture, logs } = await booted();
      fs.writeFileSync('/data/a', 'v1');
      await vfs.drain();
      faulty.failAlways('remove', /\.old-/);
      fs.writeFileSync('/data/a', 'v2');
      await vfs.drain();
      expect(logs.some((line) => /^warn: could not delete the temporary file 'a\.old-\d+'/.test(line))).toBe(true);
      expect(Object.keys(textFiles(fixture.files())).sort()).toEqual(['a', expect.stringMatching(/^a\.old-\d+$/)]);
      expect(text(fixture.files().get('a') as Uint8Array)).toBe('v2');
      faulty.repair();
      fs.writeFileSync('/data/a', 'v3');
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ a: 'v3' });
    });

    it('deleting a file also deletes its leftovers, so a later boot cannot bring it back', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.mkdirSync('/data/users');
      fs.writeFileSync('/data/users/u.mpd', 'diary');
      await vfs.drain();
      faulty.failAlways('remove', /\.old-/);
      fs.writeFileSync('/data/users/u.mpd', 'diary 2');
      await vfs.drain();
      expect(fixture.files().size).toBe(2);
      // While the leftover cannot be deleted the file itself is not deleted either - and that is reported.
      fs.rmSync('/data/users/u.mpd', { force: true });
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO', syscall: 'rm' });
      expect(fixture.files().has('users/u.mpd')).toBe(true);
      faulty.repair();
      await vfs.drain();
      expect(fixture.files().size).toBe(0);
      await restart(fixture);
      expect(fs.readdirSync('/data/users')).toEqual([]);
    });

    it('a directory that could not be created holds back the files in it, then everything is stored', async () => {
      const { vfs, faulty, fixture } = await booted();
      faulty.failNext('mkdir', /^users$/);
      fs.mkdirSync('/data/users');
      fs.writeFileSync('/data/users/u.mpd', 'diary');
      fs.writeFileSync('/data/top', 't');
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO', syscall: 'mkdir' });
      expect(textFiles(fixture.files())).toEqual({ top: 't' });
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ top: 't', 'users/u.mpd': 'diary' });
      expect(vfs.outOfSync()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe('a storage call that failed may have run all the same (a timeout in the worker)', () => {
    const FILE = '/data/users/u_1.mpd';

    /** Two saves: `.mpd` = v2, `.mpd.prev` = v1. */
    async function twoSaves(): Promise<Rig> {
      const r = await booted();
      fs.mkdirSync('/data/users');
      await saveDiary(FILE, 'v1');
      await saveDiary(FILE, 'v2');
      expect(textFiles(r.fixture.files())).toEqual({ 'users/u_1.mpd': 'v2', 'users/u_1.mpd.prev': 'v1' });
      return r;
    }

    it.each([
      ['the moved-aside file is put back at once', false],
      ['the storage cannot even be asked what happened', true],
    ])('a move-aside that timed out but ran leaves no stray copy, and a deleted diary stays deleted (%s)', async (_what, blind) => {
      const { vfs, faulty, fixture } = await twoSaves();
      // Save 3 moves .mpd to .mpd.prev; for that the old .prev is moved aside - that call times out, and runs.
      faulty.timeoutNext('rename', /\.mpd\.prev$/);
      if (blind) faulty.failNext('stat', /\.mpd\.prev$/);
      await expect(saveDiary(FILE, 'v3')).rejects.toMatchObject({ code: 'EIO', syscall: 'rename' });
      const stored = Object.keys(textFiles(fixture.files()));
      if (blind) expect(stored).toEqual(['users/u_1.mpd', expect.stringMatching(/^users\/u_1\.mpd\.prev\.old-\d+$/), 'users/u_1.mpd.tmp']);
      else expect(stored).toEqual(['users/u_1.mpd', 'users/u_1.mpd.prev', 'users/u_1.mpd.tmp']);

      // The vault's retry, and the drain before the answer.
      await saveDiary(FILE, 'v3');
      await vfs.drain();
      expect(vfs.outOfSync()).toEqual([]);
      expect(textFiles(fixture.files())).toEqual({ 'users/u_1.mpd': 'v3', 'users/u_1.mpd.prev': 'v2' });

      // The account is deleted; the app is started again.
      await deleteDiary(FILE);
      await vfs.drain();
      expect(fixture.files().size).toBe(0);
      await restart(fixture);
      expect(fs.readdirSync('/data/users')).toEqual([]);
      fixture.verify();
    });

    it('a kill right after such a call finds the previous diary complete', async () => {
      const { faulty, fixture } = await twoSaves();
      faulty.timeoutNext('rename', /\.mpd\.prev$/);
      faulty.failNext('stat', /\.mpd\.prev$/);
      await expect(saveDiary(FILE, 'v3')).rejects.toMatchObject({ code: 'EIO' });
      const { logs } = await restart(fixture);
      // The moved-aside .prev is back under its name; .mpd is the last version that was saved.
      expect(textFiles(fixture.files())).toEqual({ 'users/u_1.mpd': 'v2', 'users/u_1.mpd.prev': 'v1', 'users/u_1.mpd.tmp': 'v3' });
      expect(openDiary(FILE)).toBe('v2');
      expect(logs.some((line) => /^warn: recovered 'users\/u_1\.mpd\.prev'/.test(line))).toBe(true);
    });

    it('a write whose steps time out one after the other, but run, ends up stored once with no temporary file left', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.writeFileSync('/data/a', 'v1');
      await vfs.drain();
      // The temporary file is written, the old file moved aside, the new one renamed into place - each reported as failed.
      for (const [op, path] of [
        ['write', /^a\.tmp-\d+$/],
        ['rename', /^a$/],
        ['rename', /^a\.tmp-\d+$/],
      ] as const) {
        faulty.timeoutNext(op, path);
        fs.writeFileSync('/data/a', `v2 after ${op}`);
        await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
        // Whatever happened: the storage holds a complete version under the name, or one the next boot puts back.
        const stored = textFiles(fixture.files());
        expect(Object.keys(stored).filter((name) => !/^a(\.old-\d+)?$/.test(name))).toEqual([]);
        await vfs.drain();
        expect(textFiles(fixture.files())).toEqual({ a: `v2 after ${op}` });
        expect(vfs.outOfSync()).toEqual([]);
      }
      fs.rmSync('/data/a');
      await vfs.drain();
      await restart(fixture);
      expect(fs.readdirSync('/data')).toEqual([]);
      fixture.verify();
    });
  });

  // -------------------------------------------------------------------------
  describe('the re-sync after a failure', () => {
    const FILE = '/data/users/u_1.mpd';

    it.each([
      ['the storage works again', false],
      ['the app is killed', true],
    ])('never deletes the old name of a failed rename while the new name is not stored (then %s)', async (_what, killed) => {
      const { vfs, faulty, fixture } = await booted();
      fs.mkdirSync('/data/users');
      await saveDiary(FILE, 'v1');
      await saveDiary(FILE, 'v2');

      // Save 3: the storage refuses to move .mpd to .mpd.prev.
      faulty.failNextRename(/\.mpd$/, /\.mpd\.prev$/);
      await expect(saveDiary(FILE, 'v3')).rejects.toMatchObject({ code: 'EIO', syscall: 'rename' });
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'users/u_1.mpd.prev': 'v2', 'users/u_1.mpd.tmp': 'v3' });

      // The vault's retry: the storage refuses to move .mpd.tmp into place.
      faulty.failNextRename(/\.mpd\.tmp$/, /\.mpd$/);
      await expect(saveDiary(FILE, 'v3')).rejects.toMatchObject({ code: 'EIO', syscall: 'rename' });
      expect(vfs.outOfSync()).toEqual(['users/u_1.mpd', 'users/u_1.mpd.tmp']);

      // The drain before the next answer re-syncs; storing .mpd fails once more.
      faulty.failNext('write', /\.mpd\.tmp-\d+$/);
      faulty.calls.length = 0;
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
      // .mpd.tmp - the only stored copy of v3 - was not touched.
      expect(changes(faulty).filter((call) => call.startsWith('remove ') && !/\.tmp-\d+$/.test(call))).toEqual([]);
      expect(textFiles(fixture.files())).toEqual({ 'users/u_1.mpd.prev': 'v2', 'users/u_1.mpd.tmp': 'v3' });
      expect(vfs.outOfSync()).toEqual(['users/u_1.mpd', 'users/u_1.mpd.tmp']);

      if (killed) {
        await restart(fixture);
        expect(openDiary(FILE)).toBe('v3');
      } else {
        await vfs.drain();
        expect(textFiles(fixture.files())).toEqual({ 'users/u_1.mpd': 'v3', 'users/u_1.mpd.prev': 'v2' });
        expect(vfs.outOfSync()).toEqual([]);
      }
      fixture.verify();
    });

    it('keeps the old directory of a failed directory rename until the new one is stored completely', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.mkdirSync('/data/a');
      fs.writeFileSync('/data/a/f', 'F');
      fs.writeFileSync('/data/a/g', 'G');
      await vfs.drain();
      faulty.failNext('rename', /^a$/);
      fs.renameSync('/data/a', '/data/b');
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO', syscall: 'rename' });

      faulty.failNext('write', /^b\/g\.tmp-/);
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
      expect(textFiles(fixture.files())).toMatchObject({ 'a/f': 'F', 'a/g': 'G' });
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'b/f': 'F', 'b/g': 'G' });
      expect(vfs.outOfSync()).toEqual([]);
      await restart(fixture);
      expect(fs.readdirSync('/data')).toEqual(['b']);
      fixture.verify();
    });

    it('leaves a file alone that the core is writing through a descriptor: its stored version is not replaced by a half-written one', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.mkdirSync('/data/users');
      await saveDiary(FILE, 'v1');
      await saveDiary(FILE, 'v2');
      // Save 3 fails while moving .mpd.tmp into place: v3 is stored as .mpd.tmp only.
      await writeDiaryTmp(FILE, 'v3');
      await fs.promises.rename(FILE, `${FILE}.prev`);
      faulty.failNextRename(/\.mpd\.tmp$/, /\.mpd$/);
      await expect(fs.promises.rename(`${FILE}.tmp`, FILE)).rejects.toMatchObject({ code: 'EIO' });
      expect(textFiles(fixture.files())).toEqual({ 'users/u_1.mpd.prev': 'v2', 'users/u_1.mpd.tmp': 'v3' });

      // The retry has just opened .mpd.tmp (empty in the mirror) when another request drains - and storing .mpd fails.
      const fd = fs.openSync(`${FILE}.tmp`, 'w', 0o600);
      expect(fs.readFileSync(`${FILE}.tmp`, 'utf8')).toBe('');
      faulty.failNext('write', /\.mpd\.tmp-\d+$/);
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
      expect(textFiles(fixture.files())).toEqual({ 'users/u_1.mpd.prev': 'v2', 'users/u_1.mpd.tmp': 'v3' });
      faulty.failNext('write', /\.mpd\.tmp-\d+$/);
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
      // Now .mpd gets stored. The open file stays out of sync until it is flushed - nothing to report.
      await vfs.drain();
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'users/u_1.mpd': 'v3', 'users/u_1.mpd.prev': 'v2', 'users/u_1.mpd.tmp': 'v3' });
      expect(vfs.outOfSync()).toEqual(['users/u_1.mpd.tmp']);

      // The retry goes on: the flush of the descriptor stores the file.
      fs.writeSync(fd, 'v3 again');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'users/u_1.mpd': 'v3', 'users/u_1.mpd.prev': 'v2', 'users/u_1.mpd.tmp': 'v3 again' });
      expect(vfs.outOfSync()).toEqual([]);
      fixture.verify();
    });

    it('works from the mirror as it was when it began: what the core changes meanwhile is replayed on top', async () => {
      const fixture = create();
      const inner = fixture.open();
      let meanwhile: (() => void) | null = null;
      // A storage that lets the core run in the middle of the re-sync (as any await does).
      const hooked: StorageBackend = {
        list: (dir) => inner.list(dir),
        read: (path) => inner.read(path),
        write: (path, bytes) => inner.write(path, bytes),
        rename: (from, to) => inner.rename(from, to),
        remove: (path) => inner.remove(path),
        mkdir: (path) => inner.mkdir(path),
        stat: (path) => {
          const run = meanwhile;
          meanwhile = null;
          run?.();
          return inner.stat(path);
        },
      };
      const faulty = new FaultyStorage(hooked);
      const vfs = new Vfs({ backend: faulty, log: () => undefined });
      installVfs(vfs);
      await vfs.boot();
      fs.writeFileSync('/data/a', 'a1');
      fs.writeFileSync('/data/b', 'b1');
      await vfs.drain();
      faulty.failNext('write', /^a\.tmp-/);
      faulty.failNext('write', /^b\.tmp-/);
      // Both writes are queued before the first one fails: nothing re-syncs before the drain below.
      const writes = await Promise.allSettled([fs.promises.writeFile('/data/a', 'a2'), fs.promises.writeFile('/data/b', 'b2')]);
      expect(writes.map((result) => result.status)).toEqual(['rejected', 'rejected']);
      await vfs.idle();
      expect(vfs.outOfSync()).toEqual(['a', 'b']);
      expect(textFiles(fixture.files())).toEqual({ a: 'a1', b: 'b1' });

      // While `a` is being stored again the core renames `b` - in the mirror at once, in the storage later.
      faulty.calls.length = 0;
      meanwhile = () => fs.renameSync('/data/b', '/data/c');
      await vfs.drain();
      expect(meanwhile).toBeNull();
      // `b` was stored (not deleted because the mirror has no `b` any more), then renamed.
      expect(changes(faulty)).not.toContain('remove b');
      expect(changes(faulty).at(-1)).toBe('rename b -> c');
      expect(textFiles(fixture.files())).toEqual({ a: 'a2', c: 'b2' });
      expect(vfs.outOfSync()).toEqual([]);
      fixture.verify();
    });
  });

  // -------------------------------------------------------------------------
  describe('temporary files that could not be deleted', () => {
    const FILE = '/data/users/u_1.mpd';

    it('a moved-aside copy never outlives its file: the file is not renamed away while the copy cannot be deleted', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.mkdirSync('/data/users');
      // What a kill in the middle of a save leaves behind: the diary and the server's own .mpd.tmp.
      fs.writeFileSync(FILE, 'v1');
      fs.writeFileSync(`${FILE}.tmp`, 'v2 (interrupted save)');
      await vfs.drain();

      // The next save. Only the clean-up of the VFS fails: the moved-aside old .mpd.tmp stays.
      faulty.failAlways('remove', /\.mpd\.tmp\.old-\d+$/);
      await writeDiaryTmp(FILE, 'v3');
      const copy = [...fixture.files().keys()].find((path) => /\.mpd\.tmp\.old-\d+$/.test(path)) as string;
      expect(text(fixture.files().get(copy) as Uint8Array)).toBe('v2 (interrupted save)');
      // Renamed away now, .mpd.tmp would leave the copy alone - and the next boot would take it for .mpd.tmp.
      await expect(replaceDiary(FILE)).rejects.toMatchObject({ code: 'EIO', syscall: 'rename', path: `${FILE}.tmp` });
      expect(text(fixture.files().get('users/u_1.mpd.tmp') as Uint8Array)).toBe('v3');

      // The re-sync stores .mpd from the mirror; .mpd.tmp cannot go while its copy cannot - and that is reported.
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
      expect(vfs.outOfSync()).toEqual(['users/u_1.mpd.tmp']);
      expect(textFiles(fixture.files())).toMatchObject({ 'users/u_1.mpd': 'v3', 'users/u_1.mpd.prev': 'v1', 'users/u_1.mpd.tmp': 'v3' });

      // The account is deleted while the storage still refuses: "deleted" is not confirmed for .mpd.tmp.
      await fs.promises.rm(FILE, { force: true });
      await fs.promises.rm(`${FILE}.prev`, { force: true });
      await expect(fs.promises.rm(`${FILE}.tmp`, { force: true })).rejects.toMatchObject({ code: 'EIO', syscall: 'rm' });
      expect(fs.readdirSync('/data/users')).toEqual([]);

      faulty.repair();
      // (The re-sync that ran in between failed for the same reason: reported once more.)
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
      await vfs.drain();
      expect(fixture.files().size).toBe(0);
      expect(vfs.outOfSync()).toEqual([]);
      await restart(fixture);
      expect(fs.readdirSync('/data/users')).toEqual([]);
      fixture.verify();
    });

    it('are deleted by the next drain() once the storage lets them go', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.writeFileSync('/data/a', 'v1');
      await vfs.drain();
      faulty.failAlways('remove', /\.old-/);
      fs.writeFileSync('/data/a', 'v2');
      await vfs.drain();
      expect(fixture.files().size).toBe(2);
      // Still refused: drain() tries, and resolves - the file itself is stored.
      await vfs.drain();
      expect(fixture.files().size).toBe(2);
      faulty.repair();
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ a: 'v2' });
    });

    it('are followed when their directory is renamed', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.mkdirSync('/data/a');
      fs.writeFileSync('/data/a/f', 'v1');
      await vfs.drain();
      faulty.failAlways('remove', /\.old-\d+$/);
      fs.writeFileSync('/data/a/f', 'v2');
      fs.renameSync('/data/a', '/data/b');
      await vfs.drain();
      expect(Object.keys(textFiles(fixture.files()))).toEqual(['b/f', expect.stringMatching(/^b\/f\.old-\d+$/)]);

      // Deleting the file is refused while its moved-aside copy would stay behind.
      fs.rmSync('/data/b/f');
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO', syscall: 'rm' });
      expect(fixture.files().has('b/f')).toBe(true);
      faulty.repair();
      await vfs.drain();
      expect(fixture.files().size).toBe(0);
      await restart(fixture);
      expect(fs.readdirSync('/data/b')).toEqual([]);
      fixture.verify();
    });

    it('rm -f of a file the mirror no longer has resolves only when the storage does not have it either', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.writeFileSync('/data/a.tmp', 'new');
      fs.writeFileSync('/data/b.tmp', 'new');
      await vfs.drain();

      // A rename that failed: the mirror has `a`, the storage still `a.tmp`.
      faulty.failNext('rename', /^a\.tmp$/);
      await expect(fs.promises.rename('/data/a.tmp', '/data/a')).rejects.toMatchObject({ code: 'EIO' });
      await fs.promises.rm('/data/a', { force: true });
      await fs.promises.rm('/data/a.tmp', { force: true });
      expect(Object.keys(textFiles(fixture.files()))).toEqual(['b.tmp']);

      // A rename that is still queued: its outcome is the answer.
      faulty.failNext('rename', /^b\.tmp$/);
      fs.renameSync('/data/b.tmp', '/data/b');
      await expect(fs.promises.rm('/data/b.tmp', { force: true })).rejects.toMatchObject({ code: 'EIO' });
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ b: 'new' });
      // Nothing to wait for: the path is gone on both sides.
      await fs.promises.rm('/data/b.tmp', { force: true });
      await fs.promises.rm('/data/never-there', { force: true });
      expect(textFiles(fixture.files())).toEqual({ b: 'new' });
      fixture.verify();
    });
  });

  // -------------------------------------------------------------------------
  describe('memory-only areas', () => {
    it('nothing below a volatile prefix is ever sent to the backend', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.mkdirSync('/data/users');
      await vfs.drain();
      faulty.calls.length = 0;

      vfs.markVolatile('/data/users/_guest');
      vfs.markVolatile('/data/guest-sessions.json');
      fs.mkdirSync('/data/users/_guest/deep', { recursive: true });
      fs.writeFileSync('/data/users/_guest/guest.mpd', patternBytes(300));
      fs.writeFileSync('/data/users/_guest/guest.mpd.tmp', 'tmp');
      fs.renameSync('/data/users/_guest/guest.mpd.tmp', '/data/users/_guest/guest.mpd');
      fs.writeFileSync('/data/guest-sessions.json', '{}');
      const fd = fs.openSync('/data/users/_guest/deep/f', 'w');
      fs.writeSync(fd, 'x');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      await fs.promises.writeFile('/data/users/_guest/p', 'x');
      await fs.promises.rm('/data/users/_guest/p');
      fs.rmSync('/data/users/_guest/deep', { recursive: true });
      await vfs.drain();

      expect(faulty.calls).toEqual([]);
      expect(fixture.files().size).toBe(0);
      // It all works in memory...
      expect(fs.readFileSync('/data/users/_guest/guest.mpd', 'utf8')).toBe('tmp');
      expect(fs.readdirSync('/data/users')).toEqual(['_guest']);
      // ...and is gone after a restart.
      await restart(fixture);
      expect(fs.readdirSync('/data/users')).toEqual([]);
      expect(fs.existsSync('/data/guest-sessions.json')).toBe(false);
    });

    it('moving a file out of a volatile area stores it; moving it in removes it from the storage', async () => {
      const { vfs, fixture } = await booted();
      vfs.markVolatile('/data/volatile');
      fs.mkdirSync('/data/volatile');
      fs.writeFileSync('/data/volatile/a', 'A');
      fs.writeFileSync('/data/b', 'B');
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ b: 'B' });
      fs.renameSync('/data/volatile/a', '/data/a');
      fs.renameSync('/data/b', '/data/volatile/b');
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ a: 'A' });
      expect(fs.readFileSync('/data/volatile/b', 'utf8')).toBe('B');
      // The scratch area outside /data behaves the same way.
      fs.mkdirSync('/tmp/out', { recursive: true });
      fs.writeFileSync('/tmp/out/x', 'X');
      fs.writeFileSync('/tmp/out/y', 'Y');
      fs.renameSync('/tmp/out', '/data/out');
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ a: 'A', 'out/x': 'X', 'out/y': 'Y' });
      fixture.verify();
    });

    it.each(['/scratch/new', '/data/volatile/new'])(
      'a file moved from %s over a stored file replaces it atomically: a kill at any storage call leaves the old or the new file',
      async (from) => {
        const seen = new Set<string>();
        for (let k = 1; ; k++) {
          const { vfs, faulty, fixture } = await booted();
          vfs.markVolatile('/data/volatile');
          fs.mkdirSync('/scratch', { recursive: true });
          fs.mkdirSync('/data/volatile');
          fs.writeFileSync('/data/target', 'OLD');
          await vfs.drain();
          fs.writeFileSync(from, 'NEW');
          faulty.calls.length = 0;

          faulty.crashAt(k);
          fs.renameSync(from, '/data/target');
          expect(fs.readFileSync('/data/target', 'utf8')).toBe('NEW');
          const outcome = await Promise.race([faulty.crashed.then(() => 'killed'), vfs.drain().then(() => 'completed')]);
          // The stored file is never deleted to make room: it is replaced like by any write.
          expect(changes(faulty)).not.toContain('remove target');
          if (outcome === 'completed') {
            expect(textFiles(fixture.files())).toEqual({ target: 'NEW' });
            expect(k).toBeGreaterThan(3);
            break;
          }
          await restart(fixture);
          expect(fs.readdirSync('/data'), `kill at storage call ${k}`).toEqual(['target']);
          const found = fs.readFileSync('/data/target', 'utf8') as string;
          expect(['OLD', 'NEW'], `kill at storage call ${k}`).toContain(found);
          seen.add(found);
          expect(Object.keys(textFiles(fixture.files()))).toEqual(['target']);
          fixture.verify();
        }
        expect([...seen].sort()).toEqual(['NEW', 'OLD']);
      },
    );

    it('a directory moved from a memory-only area over an empty stored directory fills it without deleting it first', async () => {
      const { vfs, faulty, fixture } = await booted();
      fs.mkdirSync('/data/out');
      await vfs.drain();
      fs.mkdirSync('/scratch/out/deep', { recursive: true });
      fs.writeFileSync('/scratch/out/x', 'X');
      fs.writeFileSync('/scratch/out/deep/y', 'Y');
      faulty.calls.length = 0;
      fs.renameSync('/scratch/out', '/data/out');
      await vfs.drain();
      expect(changes(faulty).filter((call) => call.startsWith('remove '))).toEqual([]);
      expect(textFiles(fixture.files())).toEqual({ 'out/deep/y': 'Y', 'out/x': 'X' });
      await restart(fixture);
      expect(fs.readFileSync('/data/out/deep/y', 'utf8')).toBe('Y');
      fixture.verify();
    });

    it('a stored directory created on the way to a volatile one is stored', async () => {
      const { vfs, fixture } = await booted();
      vfs.markVolatile('/data/users/_guest');
      fs.mkdirSync('/data/users/_guest', { recursive: true });
      fs.writeFileSync('/data/users/u.mpd', 'real diary');
      await vfs.drain();
      expect(textFiles(fixture.files())).toEqual({ 'users/u.mpd': 'real diary' });
    });

    it('assets never reach the backend either', async () => {
      const { vfs, faulty } = await booted();
      vfs.registerAsset('/assets/fonts/DejaVuSans.ttf', patternBytes(50));
      expect(fs.statSync('/assets/fonts/DejaVuSans.ttf')?.size).toBe(50);
      await vfs.drain();
      expect(faulty.calls).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  it('keeps a multi-megabyte diary file intact through write, restart and replace', async () => {
    const size = largeFileBytes;
    const { vfs, fixture } = await booted();
    const diary = patternBytes(size, 99);
    fs.mkdirSync('/data/users');
    fs.writeFileSync('/data/users/u.mpd', diary);
    await vfs.drain();
    await restart(fixture);
    const loaded = fs.readFileSync('/data/users/u.mpd') as Buffer;
    expect(loaded.byteLength).toBe(size);
    expect(loaded.equals(Buffer.from(diary))).toBe(true);
  });
});
