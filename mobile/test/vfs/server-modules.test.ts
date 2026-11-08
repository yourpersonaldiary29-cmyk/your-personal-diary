// @vitest-environment node
/**
 * The REAL server modules on the VFS (docs/ANDROID-PLAN.md, WP-4): security/accounts.ts,
 * sessions.ts, resets.ts, device-key.ts, vault.ts and config.ts are imported unchanged - the
 * alias plugin of the mobile vitest config gives them `node:fs` = the facade
 * (mobile/core/shims/fs.ts), `node:crypto` = the shim, the Buffer polyfill and the browser build
 * of sql.js, exactly as in the phone's worker.
 *
 *  - their files reach the storage with the names and the content the desktop writes;
 *  - a new VFS on the same storage (the app was restarted) gives the same modules their state back;
 *  - a storage failure reaches the module as the I/O error it already handles;
 *  - the "process" is killed at every storage call of a registry change and of a diary save, once
 *    cleanly and once in the middle of a write: after the restart the registry is a version the
 *    module wrote, and the diary opens (from .mpd, .mpd.tmp or .mpd.prev) with the entries of
 *    before or after the save - never an unreadable file.
 *
 * Fictional data only; the diary key is a fixed fake key, not derived from a password.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readRawServerSettings, writeRawServerSettings, type ServerConfig } from '../../../server/src/config';
import { createEntry, listEntriesFull, validateEntryInput } from '../../../server/src/db/entries-repo';
import { AccountsStore } from '../../../server/src/security/accounts';
import { loadOrCreateDeviceKey } from '../../../server/src/security/device-key';
import { ResetStore } from '../../../server/src/security/resets';
import type { AccountRecord } from '../../../server/src/security/session-types';
import { SessionStore } from '../../../server/src/security/sessions';
import { createMemoryVault, createVault, deleteVaultFiles, openVault, vaultPathOf, type DiaryVault } from '../../../server/src/security/vault';
import { Buffer as PolyfillBuffer } from '../../core/shims/buffer';
import { provideSqlWasm } from '../../core/shims/sqljs';
import fs, { installBufferClass, installVfs } from '../../core/vfs/node-fs';
import { Vfs } from '../../core/vfs/vfs';
import { sqlWasmBytes } from '../compat/fixtures';
import { FaultyStorage, SERVER_STORAGE_KINDS, patternBytes, text, type StorageFixture } from './helpers';

/** The paths the mobile core gives the server (virtual, posix). */
const CONFIG: ServerConfig = {
  dataDir: '/data',
  usersDir: '/data/users',
  accountsFile: '/data/accounts.json',
  settingsFile: '/data/server-settings.json',
  deviceKeyFile: '/data/device.key',
  sessionsFile: '/data/sessions.json',
  staticDir: null,
  assetsDir: '/assets',
  preferredPort: 0,
  dev: false,
};
const RESETS_FILE = '/data/resets.json';

const hex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

/** A fictional account (the verifier and the salt are arbitrary: no password is involved here). */
function account(n: number): AccountRecord {
  const id = `u_${String(n).padStart(16, '0')}`;
  return {
    id,
    username: `Tester${n}`,
    usernameLower: `tester${n}`,
    firstName: 'Test',
    lastName: `Person ${n}`,
    createdAt: '2026-10-01T08:00:00.000Z',
    kdf: { algorithm: 'scrypt', N: 32768, r: 8, p: 1, saltHex: hex(patternBytes(16, n)) },
    verifierHex: hex(patternBytes(32, 100 + n)),
    dbFile: `${id}.mpd`,
  };
}

/** A fake 32-byte diary key, as the core holds it: a Buffer of the polyfill. */
function diaryKey(n: number): Buffer {
  return PolyfillBuffer.from(patternBytes(32, 500 + n)) as unknown as Buffer;
}

function entry(n: number): Record<string, unknown> {
  return {
    date: `2026-09-${String(10 + n).padStart(2, '0')}`,
    time: '08:30',
    title: `Entry ${n}`,
    body: `Fictional entry number ${n}. רשומה בדויה. `.repeat(20),
    mood: 3,
    emotions: [],
    events: [],
    people: [],
    tags: ['vfs'],
  };
}

function addEntry(vault: DiaryVault, n: number): void {
  createEntry(vault.db, validateEntryInput(entry(n)));
}

function titlesOf(vault: DiaryVault): string[] {
  return listEntriesFull(vault.db, null, null)
    .map((e) => e.title)
    .sort();
}

/** The mutating storage calls so far, in order. */
const changes = (faulty: FaultyStorage): string[] => faulty.calls.filter((call) => /^(write|rename|remove|mkdir) /.test(call));

/** Names the VFS uses for its own temporary files: none may survive in the storage. */
const leftoversIn = (fixture: StorageFixture): string[] => [...fixture.files().keys()].filter((path) => /\.(tmp|old)-\d+$/.test(path));

interface Rig {
  fixture: StorageFixture;
  faulty: FaultyStorage;
  vfs: Vfs;
  logs: string[];
}

/** A VFS on `fixture`, booted and installed behind `node:fs` of the server modules. */
async function boot(fixture: StorageFixture): Promise<Rig> {
  const faulty = new FaultyStorage(fixture.open());
  const logs: string[] = [];
  const vfs = new Vfs({ backend: faulty, log: (level, message) => logs.push(`${level}: ${message}`) });
  installVfs(vfs);
  await vfs.boot();
  faulty.calls.length = 0;
  return { fixture, faulty, vfs, logs };
}

beforeAll(() => {
  // What the worker has: one Buffer class (the polyfill) and the WebAssembly binary from the host.
  installBufferClass(PolyfillBuffer as unknown as BufferConstructor);
  provideSqlWasm(sqlWasmBytes());
});

afterAll(() => {
  installBufferClass(null);
});

beforeEach(() => {
  installVfs(new Vfs());
});

describe('the server modules get the phone\'s Buffer from the facade', () => {
  it('readFileSync answers with the polyfill, like the modules themselves use', () => {
    fs.writeFileSync('/data/x', 'abc');
    const read = fs.readFileSync('/data/x');
    expect(read).toBeInstanceOf(PolyfillBuffer);
    expect(Buffer.isBuffer(read)).toBe(false);
    expect((PolyfillBuffer as unknown as BufferConstructor).isBuffer(read)).toBe(true);
    expect(fs.readFileSync('/data/x', 'utf8')).toBe('abc');
  });
});

describe.each(SERVER_STORAGE_KINDS)('real server modules on the $name', ({ create }) => {
  // -------------------------------------------------------------------------
  describe('the registries', () => {
    it('device.key, accounts.json, sessions.json, resets.json and the settings are stored and survive a restart', async () => {
      const first = await boot(create());
      const a1 = account(1);
      const a2 = account(2);

      const deviceKey = loadOrCreateDeviceKey(CONFIG.deviceKeyFile);
      const accounts = new AccountsStore(CONFIG.accountsFile);
      accounts.add(a1);
      accounts.add(a2);
      accounts.touchLogin(a1.id, '2026-10-01T09:00:00.000Z');
      const sessions = new SessionStore(CONFIG.sessionsFile, deviceKey);
      const remembered = sessions.create(a1.id, true, 'Fictional phone', diaryKey(1));
      const plain = sessions.create(a2.id, false, 'Fictional phone', diaryKey(2));
      const resets = new ResetStore(RESETS_FILE);
      const reset = resets.create(a1.id);
      writeRawServerSettings(CONFIG, { marker: 'kept', nested: { n: 1 } });

      // All of it was synchronous: the mirror has it, the storage gets it behind the calls.
      expect(fs.existsSync(CONFIG.accountsFile)).toBe(true);
      expect(first.fixture.files().size).toBe(0);
      await first.vfs.drain();
      const stored = first.fixture.files();
      expect([...stored.keys()]).toEqual(['accounts.json', 'device.key', 'resets.json', 'server-settings.json', 'sessions.json']);
      for (const [name, bytes] of stored) expect(hex(bytes), name).toBe(hex(fs.readFileSync(`/data/${name}`) as Uint8Array));
      // The same text the desktop writes: JSON with two-space indentation.
      expect(text(stored.get('accounts.json') as Uint8Array)).toBe(JSON.stringify(JSON.parse(text(stored.get('accounts.json') as Uint8Array)), null, 2));
      expect(stored.get('device.key')?.byteLength).toBe(32);
      first.fixture.verify();
      sessions.close();

      // The app is started again.
      const second = await boot(first.fixture);
      const deviceKeyAgain = loadOrCreateDeviceKey(CONFIG.deviceKeyFile);
      expect(hex(deviceKeyAgain)).toBe(hex(deviceKey));
      const accountsAgain = new AccountsStore(CONFIG.accountsFile);
      expect(accountsAgain.list()).toEqual(accounts.list());
      expect(accountsAgain.findById(a1.id)?.lastLoginAt).toBe('2026-10-01T09:00:00.000Z');
      const sessionsAgain = new SessionStore(CONFIG.sessionsFile, deviceKeyAgain);
      const session = sessionsAgain.resolve(remembered.token);
      expect(session?.userId).toBe(a1.id);
      expect(hex(sessionsAgain.wrappedKeyOf(session as NonNullable<typeof session>) as Buffer)).toBe(hex(diaryKey(1)));
      // A session without "remember me" was never written.
      expect(sessionsAgain.resolve(plain.token)).toBeNull();
      expect(new ResetStore(RESETS_FILE).takeByToken(reset.token)?.userId).toBe(a1.id);
      expect(readRawServerSettings(CONFIG)).toEqual({ marker: 'kept', nested: { n: 1 } });
      // Reading changed nothing - except the reset that was taken.
      await second.vfs.drain();
      expect(changes(second.faulty).every((call) => call.includes('resets.json'))).toBe(true);
      sessionsAgain.close();
      second.fixture.verify();
    });

    it('a registry that cannot be stored is reported on the next save, which then repairs it', async () => {
      const { vfs, faulty, fixture } = await boot(create());
      const accounts = new AccountsStore(CONFIG.accountsFile);
      accounts.add(account(1));
      await vfs.drain();

      faulty.failNext('write', /accounts\.json/);
      accounts.add(account(2));
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
      // The storage still has the complete previous registry.
      expect((JSON.parse(text(fixture.files().get('accounts.json') as Uint8Array)) as { accounts: unknown[] }).accounts).toHaveLength(1);
      // The module's next save gets the I/O error it already knows how to report...
      expect(() => accounts.add(account(3))).toThrow(expect.objectContaining({ code: 'IO' }));
      expect(accounts.list().map((a) => a.id)).toEqual([account(1).id, account(2).id]);
      // ...and the one after that goes through with everything.
      accounts.add(account(3));
      await vfs.drain();
      await boot(fixture);
      expect(new AccountsStore(CONFIG.accountsFile).list().map((a) => a.id)).toEqual([account(1).id, account(2).id, account(3).id]);
      expect(leftoversIn(fixture)).toEqual([]);
      fixture.verify();
    });
  });

  // -------------------------------------------------------------------------
  describe('the diary vault', () => {
    it('create / save / open: .mpd and .mpd.prev as on the desktop; a save resolves only when it is stored', async () => {
      const { vfs, fixture } = await boot(create());
      const a1 = account(1);
      const file = `users/${a1.dbFile}`;
      const vault = await createVault(CONFIG, a1, diaryKey(1));
      expect(vault.dbPath).toBe(vaultPathOf(CONFIG, a1));
      expect(vault.dbPath).toBe(`/data/${file}`);
      // No drain needed: createVault resolved, so the file is in the storage.
      expect([...fixture.files().keys()]).toEqual([file]);
      const firstVersion = hex(fixture.files().get(file) as Uint8Array);

      addEntry(vault, 1);
      expect(vault.db.isDirty()).toBe(true);
      await vault.persist();
      expect(vault.db.isDirty()).toBe(false);
      const stored = fixture.files();
      expect([...stored.keys()]).toEqual([file, `${file}.prev`]);
      expect(hex(stored.get(`${file}.prev`) as Uint8Array)).toBe(firstVersion);
      expect(hex(stored.get(file) as Uint8Array)).toBe(hex(fs.readFileSync(vault.dbPath) as Uint8Array));
      // What routes/settings.ts reports as the size of the diary.
      expect(fs.statSync(vault.dbPath)?.size).toBe(stored.get(file)?.byteLength);
      await vfs.drain();
      await vault.close();

      await boot(fixture);
      const reopened = await openVault(CONFIG, a1, diaryKey(1));
      expect(titlesOf(reopened)).toEqual(['Entry 1']);
      await reopened.close();
      await expect(openVault(CONFIG, a1, diaryKey(2))).rejects.toBeTruthy();
      await expect(createVault(CONFIG, a1, diaryKey(1))).rejects.toMatchObject({ code: 'IO' });

      // Account deletion removes every file of the diary.
      await deleteVaultFiles(vaultPathOf(CONFIG, a1));
      expect(fixture.files().size).toBe(0);
      expect(fs.readdirSync(CONFIG.usersDir)).toEqual([]);
      fixture.verify();
    });

    it.each([
      ['writing the temporary file', 'write', /\.mpd\.tmp/],
      ['moving the current diary to .prev', 'rename', /\.mpd$/],
      ['moving the new diary into place', 'rename', /\.mpd\.tmp$/],
    ] as const)('a storage failure while %s fails the save, keeps the diary dirty and the retry stores it', async (_what, op, path) => {
      const { vfs, faulty, fixture } = await boot(create());
      const a1 = account(1);
      const vault = await createVault(CONFIG, a1, diaryKey(1));
      addEntry(vault, 1);
      await vault.persist();

      addEntry(vault, 2);
      faulty.failNext(op, path);
      await expect(vault.persist()).rejects.toMatchObject({ code: 'IO' });
      expect(vault.db.isDirty()).toBe(true);
      // The vault's own retry (it runs it with a back-off).
      await vault.persist();
      expect(vault.db.isDirty()).toBe(false);
      await vfs.drain();
      expect(vfs.outOfSync()).toEqual([]);
      await vault.close();

      expect([...fixture.files().keys()]).toEqual([`users/${a1.dbFile}`, `users/${a1.dbFile}.prev`]);
      await boot(fixture);
      const reopened = await openVault(CONFIG, a1, diaryKey(1));
      expect(titlesOf(reopened)).toEqual(['Entry 1', 'Entry 2']);
      await reopened.close();
      fixture.verify();
    });

    it('failures on top of each other never cost the newest stored diary: the re-sync deletes nothing while a store fails', async () => {
      const { vfs, faulty, fixture } = await boot(create());
      const a1 = account(1);
      const file = `users/${a1.dbFile}`;
      const vault = await createVault(CONFIG, a1, diaryKey(1));
      addEntry(vault, 1);
      await vault.persist();
      expect([...fixture.files().keys()]).toEqual([file, `${file}.prev`]);

      // Save 2: the storage refuses to move .mpd to .mpd.prev. The drain before the answer re-syncs.
      addEntry(vault, 2);
      faulty.failNextRename(/\.mpd$/, /\.mpd\.prev$/);
      await expect(vault.persist()).rejects.toMatchObject({ code: 'IO' });
      await vfs.drain();
      expect([...fixture.files().keys()]).toEqual([`${file}.prev`, `${file}.tmp`]);

      // The vault's retry: the storage refuses to move .mpd.tmp into place.
      faulty.failNextRename(/\.mpd\.tmp$/, /\.mpd$/);
      await expect(vault.persist()).rejects.toMatchObject({ code: 'IO' });

      // The next drain stores .mpd from the mirror - and fails as well.
      faulty.failNext('write', /\.mpd\.tmp-\d+$/);
      await expect(vfs.drain()).rejects.toMatchObject({ code: 'EIO' });
      // .mpd.tmp, the only stored copy of the diary with both entries, was not deleted...
      expect([...fixture.files().keys()]).toEqual([`${file}.prev`, `${file}.tmp`]);
      expect(leftoversIn(fixture)).toEqual([]);
      await vault.close(false);

      // ...so the app, killed at this point, opens both entries (from .mpd.tmp, as the desktop would).
      await boot(fixture);
      const reopened = await openVault(CONFIG, a1, diaryKey(1));
      expect(titlesOf(reopened)).toEqual(['Entry 1', 'Entry 2']);
      await reopened.close(false);
      fixture.verify();
    });

    it('a storage call of a save that timed out but ran leaves nothing that brings a deleted diary back', async () => {
      const { vfs, faulty, fixture } = await boot(create());
      const a1 = account(1);
      const file = `users/${a1.dbFile}`;
      const vault = await createVault(CONFIG, a1, diaryKey(1));
      addEntry(vault, 1);
      await vault.persist();

      // Save 2 moves the old .prev aside: the call is reported as timed out, and was carried out -
      // and the storage cannot be asked either.
      addEntry(vault, 2);
      faulty.timeoutNext('rename', /\.mpd\.prev$/);
      faulty.failNext('stat', /\.mpd\.prev$/);
      await expect(vault.persist()).rejects.toMatchObject({ code: 'IO' });
      expect(leftoversIn(fixture)).toEqual([expect.stringMatching(/\.mpd\.prev\.old-\d+$/)]);

      await vault.persist();
      await vfs.drain();
      expect(vfs.outOfSync()).toEqual([]);
      expect([...fixture.files().keys()]).toEqual([file, `${file}.prev`]);
      await vault.close();

      // The account is deleted; after a restart nothing of the diary is there.
      await deleteVaultFiles(vaultPathOf(CONFIG, a1));
      await vfs.drain();
      expect(fixture.files().size).toBe(0);
      await boot(fixture);
      expect(fs.readdirSync(CONFIG.usersDir)).toEqual([]);
      await expect(openVault(CONFIG, a1, diaryKey(1))).rejects.toMatchObject({ code: 'IO' });
      fixture.verify();
    });

    it('the guest diary never reaches the storage - neither as a memory vault nor below a volatile prefix', async () => {
      const { vfs, faulty, fixture } = await boot(create());
      fs.mkdirSync(CONFIG.usersDir, { recursive: true });
      await vfs.drain();
      faulty.calls.length = 0;

      // The tour mode of the server: a vault without a file.
      const guest = await createMemoryVault({ ...account(9), guest: true }, diaryKey(9));
      addEntry(guest, 1);
      await guest.persist();
      await guest.close();

      // The safety net of the VFS: even a vault WITH a file writes nothing below a volatile prefix.
      vfs.markVolatile('/data/guest');
      const volatileConfig: ServerConfig = { ...CONFIG, usersDir: '/data/guest/users' };
      const a8 = account(8);
      const vault = await createVault(volatileConfig, a8, diaryKey(8));
      addEntry(vault, 1);
      await vault.persist();
      await vault.close();
      const reopened = await openVault(volatileConfig, a8, diaryKey(8));
      expect(titlesOf(reopened)).toEqual(['Entry 1']);
      await reopened.close();

      await vfs.drain();
      expect(faulty.calls).toEqual([]);
      expect(fixture.files().size).toBe(0);
      await boot(fixture);
      expect(fs.existsSync('/data/guest')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('a kill at every storage call', () => {
    it.each([false, true])('accounts.json is always a registry the module wrote (torn write: %s)', async (torn) => {
      const a1 = account(1);
      const a2 = account(2);
      /** `ids|pendingDeletes` after: the start, add(a2), remove(a1), clearPendingDeletes. */
      const states = [`${a1.id}|`, `${a1.id},${a2.id}|`, `${a2.id}|${a1.dbFile}`, `${a2.id}|`];
      const seen = new Set<string>();
      let kills = 0;
      for (let k = 1; ; k++) {
        const fixture = create();
        const { vfs, faulty } = await boot(fixture);
        const store = new AccountsStore(CONFIG.accountsFile);
        store.add(a1);
        await vfs.drain();

        faulty.crashAt(k, { torn });
        store.add(a2);
        store.remove(a1.id);
        store.clearPendingDeletes([a1.dbFile]);
        const outcome = await Promise.race([faulty.crashed.then(() => 'killed'), vfs.drain().then(() => 'completed')]);
        if (outcome === 'completed') {
          expect(k).toBeGreaterThan(1);
          break;
        }
        kills++;

        const again = await boot(fixture);
        const reloaded = new AccountsStore(CONFIG.accountsFile);
        const state = `${reloaded.list().map((a) => a.id).join(',')}|${reloaded.pendingDeletes().join(',')}`;
        expect(states, `kill at storage call ${k}`).toContain(state);
        seen.add(state);
        expect(leftoversIn(fixture)).toEqual([]);
        // The registry is usable: the next change is stored.
        reloaded.add(account(3));
        await again.vfs.drain();
        await boot(fixture);
        expect(new AccountsStore(CONFIG.accountsFile).findById(account(3).id)?.username).toBe('Tester3');
        fixture.verify();
      }
      expect(kills).toBeGreaterThanOrEqual(3);
      expect(seen.has(states[0])).toBe(true);
      expect(seen.size).toBeGreaterThan(1);
    });

    it.each([false, true])('sessions.json keeps the remembered sessions of before or after the change (torn write: %s)', async (torn) => {
      const seen = new Set<string>();
      let kills = 0;
      for (let k = 1; ; k++) {
        const fixture = create();
        const { vfs, faulty } = await boot(fixture);
        const deviceKey = loadOrCreateDeviceKey(CONFIG.deviceKeyFile);
        const store = new SessionStore(CONFIG.sessionsFile, deviceKey);
        const one = store.create(account(1).id, true, 'Fictional phone', diaryKey(1));
        await vfs.drain();

        faulty.crashAt(k, { torn });
        const two = store.create(account(2).id, true, 'Fictional tablet', diaryKey(2));
        store.remove(one.session.id);
        const outcome = await Promise.race([faulty.crashed.then(() => 'killed'), vfs.drain().then(() => 'completed')]);
        if (outcome === 'completed') {
          expect(k).toBeGreaterThan(1);
          break;
        }
        kills++;

        await boot(fixture);
        // The file is whole JSON (a damaged one would make the store start empty and say so).
        expect(() => JSON.parse(fs.readFileSync(CONFIG.sessionsFile, 'utf8') as string)).not.toThrow();
        const reloaded = new SessionStore(CONFIG.sessionsFile, loadOrCreateDeviceKey(CONFIG.deviceKeyFile));
        const first = reloaded.resolve(one.token);
        const second = reloaded.resolve(two.token);
        const state = `${first ? '1' : ''}${second ? '2' : ''}`;
        expect(['1', '12', '2'], `kill at storage call ${k}`).toContain(state);
        seen.add(state);
        // The diary keys come back out of the wrapped form.
        if (first) expect(hex(reloaded.wrappedKeyOf(first) as Buffer)).toBe(hex(diaryKey(1)));
        if (second) expect(hex(reloaded.wrappedKeyOf(second) as Buffer)).toBe(hex(diaryKey(2)));
        expect(leftoversIn(fixture)).toEqual([]);
        reloaded.close();
        fixture.verify();
      }
      expect(kills).toBeGreaterThanOrEqual(2);
      expect(seen.has('1')).toBe(true);
      expect(seen.size).toBeGreaterThan(1);
    });

    it.each([false, true])('the diary always opens with the entries of before or after the save (torn write: %s)', async (torn) => {
      const a1 = account(1);
      const seen = new Set<number>();
      let kills = 0;
      for (let k = 1; ; k++) {
        const fixture = create();
        const { faulty } = await boot(fixture);
        const vault = await createVault(CONFIG, a1, diaryKey(1));
        addEntry(vault, 1);
        await vault.persist();
        addEntry(vault, 2);
        await vault.persist();

        // The save that is interrupted: .mpd.tmp, .mpd -> .mpd.prev (replacing a .prev), .mpd.tmp -> .mpd.
        faulty.crashAt(k, { torn });
        addEntry(vault, 3);
        const outcome = await Promise.race([faulty.crashed.then(() => 'killed'), vault.persist().then(() => 'completed')]);
        if (outcome === 'completed') {
          expect(k).toBeGreaterThan(1);
          await vault.close();
          break;
        }
        kills++;

        const again = await boot(fixture);
        expect(leftoversIn(fixture)).toEqual([]);
        // Never a half-written file under one of the diary's names: each one decrypts or is absent.
        const reopened = await openVault(CONFIG, a1, diaryKey(1));
        const titles = titlesOf(reopened);
        expect([2, 3], `kill at storage call ${k}: ${titles.join(', ')}`).toContain(titles.length);
        expect(titles.slice(0, 2)).toEqual(['Entry 1', 'Entry 2']);
        seen.add(titles.length);
        // The diary is usable: the next save is stored and opens after another restart.
        addEntry(reopened, 4);
        await reopened.persist();
        await reopened.close();
        await again.vfs.drain();
        await boot(fixture);
        const final = await openVault(CONFIG, a1, diaryKey(1));
        expect(titlesOf(final)).toEqual([...titles, 'Entry 4']);
        await final.close();
        expect([...fixture.files().keys()]).toEqual(expect.arrayContaining([`users/${a1.dbFile}`, `users/${a1.dbFile}.prev`]));
        fixture.verify();
      }
      expect(kills).toBeGreaterThanOrEqual(4);
      expect(seen).toEqual(new Set([2, 3]));
    });
  });
});
