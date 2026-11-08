/**
 * The Android platform seams of the automatic offline mode (WP-H10d; docs/android-tasks/OFFLINE-DESIGN.md
 * sections 5 and 7): the plugin contract of DiaryOffline (Keystore key vault and user check), the
 * outbox mirror on @capacitor/filesystem with atomic writes and crash repair, the error mapping, and
 * the installation of the seams by mobile/platform/index.ts (resume -> notifyResume()).
 *
 * The fake Keystore below does what DiaryOfflinePlugin.java does - one AES-256-GCM key, the account
 * id as additional data, blob = version byte, IV, ciphertext and tag - on Node's WebCrypto. Only
 * fictional ids and bytes are used.
 */
import { webcrypto } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { Directory } from '@capacitor/filesystem';
import { APP_NAME } from '@shared/constants';
import { __resetOfflinePlatformForTests, getOfflinePlatform, onResume } from '@/offline/seams';
import { CapacitorFilesystemStorage } from '../host/storage/capacitor-filesystem';
import { base64ToBytes, bytesToBase64 } from '../host/storage/base64';
import { FakeFilesystemPlugin, FaultyStorage } from '../test/vfs/helpers';
import type { DeviceCheckResult, DiaryOfflinePlugin } from '../plugins/diary-offline';
import {
  checkName,
  checkUserId,
  createDeviceUserCheck,
  createFilesystemMirror,
  createKeystoreVault,
  installPhoneOffline,
  MAX_KEY_BYTES,
  MIRROR_BASE,
  MIRROR_DIRECTORY,
  MIRROR_MAX_FILE_BYTES,
  mirrorDirectory,
  OfflinePlatformError,
  toOfflinePlatformError,
} from './offline';

// --- The native side of installPhonePlatform (only the last describe uses it) -------------------

const native = vi.hoisted(() => {
  const handle = () => Promise.resolve({ remove: async () => undefined });
  const appListeners = new Map<string, (data: unknown) => void>();
  /** The Filesystem plugin the installed mirror talks to (a FakeFilesystemPlugin, set per test). */
  const fs: { current: Record<string, (...args: unknown[]) => unknown> | null } = { current: null };
  return {
    handle,
    appListeners,
    fs,
    App: {
      addListener: (event: string, listener: (data: unknown) => void) => {
        appListeners.set(event, listener);
        return handle();
      },
      minimizeApp: async () => undefined,
    },
    Filesystem: new Proxy(
      {},
      {
        get: (_target, method: string) =>
          (...args: unknown[]) => {
            const plugin = fs.current;
            if (!plugin) return Promise.reject(new Error(`no fake Filesystem for ${method}`));
            return plugin[method](...args);
          },
      },
    ),
    SystemBars: { setStyle: async () => undefined },
    LocalNotifications: {
      addListener: () => handle(),
      getPending: async () => ({ notifications: [] }),
      cancel: async () => undefined,
      createChannel: async () => undefined,
      checkPermissions: async () => ({ display: 'granted' }),
      requestPermissions: async () => ({ display: 'granted' }),
      schedule: async () => undefined,
    },
    Preferences: { get: async () => ({ value: null }), set: async () => undefined },
    Share: { share: async () => ({}) },
    DiaryFiles: {
      addListener: () => handle(),
      takeOpenedFile: async () => ({ file: null }),
      // A whole "save as" (only the iOS wiring test saves): the sheet at the end is dismissed.
      createDocument: async ({ name }: { name: string }) => ({ uri: `file:///tmp/${name}` }),
      openWrite: async () => ({ handle: 1 }),
      writeChunk: async () => undefined,
      closeWrite: async () => ({ cancelled: true }),
    },
    DiaryPrivacyScreen: { setEnabled: async () => undefined },
    DiaryOffline: {
      wrapKey: async () => ({ blob: 'AQ==' }),
      unwrapKey: async () => ({ key: 'AQ==' }),
      deleteKey: async () => undefined,
      canVerifyUser: async () => ({ available: true }),
      verifyUser: async () => ({ result: 'ok' }),
    },
    setApiTransport: (() => undefined) as (transport: unknown) => void,
  };
});

vi.mock('@capacitor/app', () => ({ App: native.App }));
vi.mock('@capacitor/core', async (importOriginal) => ({ ...(await importOriginal<typeof import('@capacitor/core')>()), SystemBars: native.SystemBars }));
vi.mock('@capacitor/filesystem', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/filesystem')>()),
  Filesystem: native.Filesystem,
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: native.LocalNotifications }));
vi.mock('@capacitor/preferences', () => ({ Preferences: native.Preferences }));
vi.mock('@capacitor/share', () => ({ Share: native.Share }));
vi.mock('../plugins/diary-files', () => ({ DiaryFiles: native.DiaryFiles }));
vi.mock('../plugins/diary-privacy-screen', () => ({ DiaryPrivacyScreen: native.DiaryPrivacyScreen }));
vi.mock('../plugins/diary-biometric', () => ({ DiaryBiometric: {} }));
vi.mock('../plugins/diary-offline', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../plugins/diary-offline')>()),
  DiaryOffline: native.DiaryOffline,
}));
// The API layer is WP-H10b's (being edited). Both mocks are PARTIAL on purpose: installPhonePlatform
// imports LockContext -> @/offline, whose modules read names of these two at import time (for
// example the UNAUTHORIZED_EVENT listener of src/offline/index.ts), so every real export must stay
// there. Only what would reach a server or replace the app's transport is stubbed.
vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  habits: { list: async () => [], progress: async () => [] },
}));
vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  request: async () => undefined,
  setApiTransport: (transport: unknown) => native.setApiTransport(transport),
}));

// --- Fixtures -------------------------------------------------------------------------------------

const DANA = 'u_0123456789abcdef';
const LIOR = 'u_fedcba9876543210';
const OP = '7-11111111-1111-4111-8111-111111111111.op';
const OP2 = '12-33333333-3333-4333-8333-333333333333.op';
const NOTE = '3-22222222-2222-4222-8222-222222222222.note';
const DATA = 'DATA' as never;

const subtle = webcrypto.subtle;
const bytes = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text);
const text = (data: Uint8Array): string => new TextDecoder().decode(data);
/** A copy on its own ArrayBuffer (what WebCrypto's `BufferSource` type asks for). */
const own = (data: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(data);

/** The fake DiaryOffline plugin: the Java plugin's logic, on Node's WebCrypto. */
function fakeOfflinePlugin(options: { secure?: boolean; result?: DeviceCheckResult } = {}) {
  let deviceKey: CryptoKey | null = null;
  const users = new Set<string>();
  const calls: string[] = [];
  const reject = (code: string, message: string) => Promise.reject(Object.assign(new Error(message), { code }));
  const aad = (userId: string) => bytes(`ypd-offline-v1:${userId}`);
  const valid = (userId: unknown): userId is string => typeof userId === 'string' && /^u_[0-9a-f]{16}$/.test(userId);
  const plugin = {
    calls,
    users,
    loseDeviceKey() {
      deviceKey = null;
    },
    wrapKey: vi.fn(async ({ userId, key }: { userId: string; key: string }) => {
      calls.push(`wrapKey ${userId}`);
      if (!valid(userId)) return reject('INVALID_INPUT', 'invalid user id');
      deviceKey ??= (await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])) as CryptoKey;
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      const sealed = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(userId) }, deviceKey, own(base64ToBytes(key))));
      const blob = new Uint8Array(1 + iv.byteLength + sealed.byteLength);
      blob[0] = 1;
      blob.set(iv, 1);
      blob.set(sealed, 1 + iv.byteLength);
      users.add(userId);
      return { blob: bytesToBase64(blob) };
    }),
    unwrapKey: vi.fn(async ({ userId, blob }: { userId: string; blob: string }) => {
      calls.push(`unwrapKey ${userId}`);
      if (!valid(userId)) return reject('INVALID_INPUT', 'invalid user id');
      const raw = base64ToBytes(blob);
      if (raw.byteLength < 30 || raw[0] !== 1) return reject('INVALID_INPUT', 'invalid key blob');
      if (!deviceKey) return reject('KEY_MISSING', 'the device key is gone');
      try {
        const plain = await subtle.decrypt({ name: 'AES-GCM', iv: own(raw.subarray(1, 13)), additionalData: aad(userId) }, deviceKey, own(raw.subarray(13)));
        return { key: bytesToBase64(new Uint8Array(plain)) };
      } catch {
        return reject('UNWRAP_FAILED', 'the key blob does not unwrap');
      }
    }),
    deleteKey: vi.fn(async ({ userId }: { userId: string }) => {
      calls.push(`deleteKey ${userId}`);
      if (!valid(userId)) return reject('INVALID_INPUT', 'invalid user id');
      users.delete(userId);
      if (users.size === 0) deviceKey = null;
    }),
    canVerifyUser: vi.fn(async () => ({ available: options.secure !== false })),
    verifyUser: vi.fn(async (_options: { title: string; subtitle?: string }) => ({ result: options.result ?? ('ok' as DeviceCheckResult) })),
  } satisfies DiaryOfflinePlugin & Record<string, unknown>;
  return plugin;
}

function aok(seed = 7): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_, i) => (i * 31 + seed) & 0xff);
}

function storageOn(plugin: FakeFilesystemPlugin): CapacitorFilesystemStorage {
  return new CapacitorFilesystemStorage(plugin, { base: MIRROR_BASE, directory: DATA });
}

function mirrorOn(plugin = new FakeFilesystemPlugin()) {
  return { plugin, mirror: createFilesystemMirror(storageOn(plugin)) };
}

/** Every stored file of the mirror folder, as text, keyed `<userId>/<name>`. */
function stored(plugin: FakeFilesystemPlugin): Record<string, string> {
  return Object.fromEntries([...plugin.files('DATA:offline/')].map(([path, data]) => [path, text(data)]));
}

afterEach(() => {
  __resetOfflinePlatformForTests();
});

// --- The contract ----------------------------------------------------------------------------------

describe('the section 7 input contract', () => {
  it('accepts exactly ^u_[0-9a-f]{16}$ and ^[0-9]+-[0-9a-f-]{36}\\.(op|note)$', () => {
    expect(checkUserId(DANA)).toBe(DANA);
    expect(checkName(OP)).toBe(OP);
    expect(checkName(NOTE)).toBe(NOTE);
    for (const bad of ['', 'u_', 'u_0123456789ABCDEF', 'u_0123456789abcde', 'u_0123456789abcdef0', '../0123456789abcdef', 'u_0123456789abcdef/..', null, 7]) {
      expect(() => checkUserId(bad), String(bad)).toThrow(OfflinePlatformError);
    }
    for (const bad of [
      '',
      '7-11111111-1111-4111-8111-111111111111.txt',
      `${OP}.tmp`,
      `${OP}.old`,
      '-11111111-1111-4111-8111-111111111111.op',
      'a-11111111-1111-4111-8111-111111111111.op',
      '7-11111111-1111-4111-8111-11111111111G.op',
      '7-11111111-1111-4111-8111-111111111111.OP',
      '../7-11111111-1111-4111-8111-111111111111.op',
      '7-11111111-1111-4111-8111-111111111111/.op',
      `${'9'.repeat(80)}-11111111-1111-4111-8111-111111111111.op`,
      undefined,
    ]) {
      expect(() => checkName(bad), String(bad)).toThrow(OfflinePlatformError);
    }
    try {
      checkName('x.op');
    } catch (e) {
      expect((e as OfflinePlatformError).code).toBe('invalid-input');
    }
  });
});

// --- OfflineKeyVault ---------------------------------------------------------------------------------

describe('createKeystoreVault (DiaryOffline wrapKey / unwrapKey / deleteKey)', () => {
  it('is the keystore vault: the AOK crosses the bridge as base64 and comes back byte-identical', async () => {
    const plugin = fakeOfflinePlugin();
    const vault = createKeystoreVault(plugin);
    expect(vault.kind).toBe('keystore');
    const key = aok();
    const blob = await vault.wrap(DANA, key);
    expect(plugin.wrapKey).toHaveBeenCalledWith({ userId: DANA, key: bytesToBase64(key) });
    expect(blob).not.toContain(bytesToBase64(key));
    expect(base64ToBytes(blob)[0]).toBe(1);
    const back = await vault.unwrap(DANA, blob);
    expect(back).toBeInstanceOf(Uint8Array);
    expect([...back]).toEqual([...key]);
    // Two wraps differ (a fresh IV each), both unwrap.
    const again = await vault.wrap(DANA, key);
    expect(again).not.toBe(blob);
    expect([...(await vault.unwrap(DANA, again))]).toEqual([...key]);
  });

  it("another account's blob never unwraps (the account id is the additional data): unwrap-failed", async () => {
    const plugin = fakeOfflinePlugin();
    const vault = createKeystoreVault(plugin);
    const blob = await vault.wrap(DANA, aok());
    await vault.wrap(LIOR, aok(9));
    await expect(vault.unwrap(LIOR, blob)).rejects.toMatchObject({ name: 'OfflinePlatformError', code: 'unwrap-failed' });
    const damaged = base64ToBytes(blob);
    damaged[damaged.length - 1] ^= 0x55;
    await expect(vault.unwrap(DANA, bytesToBase64(damaged))).rejects.toMatchObject({ code: 'unwrap-failed' });
  });

  it('remove deletes the account; the device key goes with the last account (key-missing afterwards)', async () => {
    const plugin = fakeOfflinePlugin();
    const vault = createKeystoreVault(plugin);
    const dana = await vault.wrap(DANA, aok());
    const lior = await vault.wrap(LIOR, aok(9));
    await vault.remove(LIOR);
    expect(plugin.deleteKey).toHaveBeenCalledWith({ userId: LIOR });
    expect([...(await vault.unwrap(DANA, dana))]).toEqual([...aok()]);
    await vault.remove(DANA);
    await expect(vault.unwrap(DANA, dana)).rejects.toMatchObject({ code: 'key-missing' });
    await expect(vault.unwrap(LIOR, lior)).rejects.toMatchObject({ code: 'key-missing' });
  });

  it('refuses bad input before the plugin is called', async () => {
    const plugin = fakeOfflinePlugin();
    const vault = createKeystoreVault(plugin);
    await expect(vault.wrap('dana', aok())).rejects.toMatchObject({ code: 'invalid-input' });
    await expect(vault.wrap(DANA, new Uint8Array(0))).rejects.toMatchObject({ code: 'invalid-input' });
    await expect(vault.wrap(DANA, new Uint8Array(MAX_KEY_BYTES + 1))).rejects.toMatchObject({ code: 'invalid-input' });
    await expect(vault.wrap(DANA, 'not bytes' as never)).rejects.toMatchObject({ code: 'invalid-input' });
    await expect(vault.unwrap('../x', 'AAAA')).rejects.toMatchObject({ code: 'invalid-input' });
    for (const blob of ['', 'AAA', 'AB=C', 'not base64!', 'QQ=', 'data:,AAAA']) {
      await expect(vault.unwrap(DANA, blob), blob).rejects.toMatchObject({ code: 'invalid-input' });
    }
    await expect(vault.remove('u_XYZ')).rejects.toMatchObject({ code: 'invalid-input' });
    expect(plugin.calls).toEqual([]);
  });

  it('maps every plugin rejection code, and unknown failures or nonsense answers to keystore', async () => {
    const cases: Array<[unknown, string]> = [
      [Object.assign(new Error('invalid key'), { code: 'INVALID_INPUT' }), 'invalid-input'],
      [Object.assign(new Error('gone'), { code: 'KEY_MISSING' }), 'key-missing'],
      [Object.assign(new Error('no'), { code: 'UNWRAP_FAILED' }), 'unwrap-failed'],
      [Object.assign(new Error('hw'), { code: 'KEYSTORE_ERROR' }), 'keystore'],
      [Object.assign(new Error('"DiaryOffline" plugin is not implemented on web'), { code: 'UNIMPLEMENTED' }), 'keystore'],
      ['a string', 'keystore'],
      [null, 'keystore'],
    ];
    for (const [error, code] of cases) {
      const mapped = toOfflinePlatformError(error, 'the key could not be unwrapped');
      expect(mapped, String(code)).toBeInstanceOf(OfflinePlatformError);
      expect(mapped.code).toBe(code);
      expect(mapped.cause).toBe(error);
    }
    const own = new OfflinePlatformError('io', 'x');
    expect(toOfflinePlatformError(own, 'y')).toBe(own);

    // Keys of Object.prototype are not plugin codes: they map to keystore, never to a function.
    for (const code of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__', 'isPrototypeOf', 'toLocaleString']) {
      const mapped = toOfflinePlatformError(Object.assign(new Error('x'), { code }), 'w');
      expect(typeof mapped.code, code).toBe('string');
      expect(mapped.code, code).toBe('keystore');
    }

    const plugin = fakeOfflinePlugin();
    plugin.wrapKey.mockRejectedValueOnce(Object.assign(new Error('hw'), { code: 'KEYSTORE_ERROR' }));
    plugin.wrapKey.mockResolvedValueOnce({ blob: '' });
    plugin.unwrapKey.mockResolvedValueOnce({ key: 42 as never });
    const vault = createKeystoreVault(plugin);
    await expect(vault.wrap(DANA, aok())).rejects.toMatchObject({ code: 'keystore', message: expect.stringContaining('hw') });
    await expect(vault.wrap(DANA, aok())).rejects.toMatchObject({ code: 'keystore' });
    await expect(vault.unwrap(DANA, 'AAAA')).rejects.toMatchObject({ code: 'keystore' });
  });
});

// --- OutboxMirror ------------------------------------------------------------------------------------

describe('createFilesystemMirror (Directory.Data, offline/<userId>/<name>)', () => {
  it('put / list / read / delete / clear, under offline/<userId>/ of Directory.Data', async () => {
    const { plugin, mirror } = mirrorOn();
    expect(await mirror.list(DANA)).toEqual([]);
    await expect(mirror.read(DANA, OP)).rejects.toMatchObject({ code: 'io' });
    await mirror.remove(DANA, OP); // nothing there: fine
    await mirror.clear(DANA); // nothing there: fine

    await mirror.put(DANA, OP, bytes('ciphertext of an operation'));
    await mirror.put(DANA, NOTE, bytes('ciphertext of a note'));
    await mirror.put(DANA, OP2, bytes('a later operation'));
    expect(await mirror.list(DANA)).toEqual([OP2, NOTE, OP].sort());
    expect(stored(plugin)).toEqual({
      [`${DANA}/${OP}`]: 'ciphertext of an operation',
      [`${DANA}/${NOTE}`]: 'ciphertext of a note',
      [`${DANA}/${OP2}`]: 'a later operation',
    });
    expect(text(await mirror.read(DANA, OP))).toBe('ciphertext of an operation');
    expect(text(await mirror.read(DANA, NOTE))).toBe('ciphertext of a note');

    await mirror.remove(DANA, OP);
    expect(await mirror.list(DANA)).toEqual([OP2, NOTE].sort());
    await mirror.remove(DANA, OP); // already gone
    await mirror.clear(DANA);
    expect(await mirror.list(DANA)).toEqual([]);
    expect(stored(plugin)).toEqual({});
    // After a clear the folder is created again by the next put.
    await mirror.put(DANA, OP, bytes('again'));
    expect(text(await mirror.read(DANA, OP))).toBe('again');
  });

  it('a put replaces atomically: through <name>.tmp, never renaming onto an existing file, no helper file left', async () => {
    const { plugin, mirror } = mirrorOn();
    await mirror.put(DANA, OP, bytes('unsealed row'));
    await mirror.put(DANA, OP, bytes('sealed row, attempts 1'));
    await mirror.put(DANA, OP, bytes('sealed row, attempts 2'));
    expect(text(await mirror.read(DANA, OP))).toBe('sealed row, attempts 2');
    expect(plugin.renamedOverExisting).toEqual([]);
    expect(Object.keys(stored(plugin))).toEqual([`${DANA}/${OP}`]);
    const writes = plugin.calls.filter((c) => c.startsWith('writeFile') || c.startsWith('appendFile'));
    expect(writes.length).toBeGreaterThan(0);
    for (const call of writes) expect(call).toContain(`${OP}.tmp`);
    expect(plugin.calls).toContain(`rename DATA:offline/${DANA}/${OP}.tmp -> DATA:offline/${DANA}/${OP}`);
  });

  it('lists only contract names: helper, foreign and directory entries are never reported', async () => {
    const { plugin, mirror } = mirrorOn();
    await mirror.put(DANA, OP, bytes('row'));
    await plugin.writeFile({ path: `offline/${DANA}/notes.txt`, directory: DATA, data: bytesToBase64(bytes('x')) });
    await plugin.mkdir({ path: `offline/${DANA}/9-44444444-4444-4444-8444-444444444444.op`, directory: DATA });
    expect(await mirror.list(DANA)).toEqual([OP]);
    await expect(mirror.read(DANA, '9-44444444-4444-4444-8444-444444444444.op')).rejects.toMatchObject({ code: 'io' });
  });

  it('a removed file stays removed, even when a helper of an earlier put was left behind', async () => {
    const { plugin, mirror } = mirrorOn();
    await mirror.put(DANA, OP, bytes('version 2'));
    // The state after a put whose best-effort cleanup of the previous version failed.
    await plugin.writeFile({ path: `offline/${DANA}/${OP}.old`, directory: DATA, data: bytesToBase64(bytes('version 1')) });
    await mirror.remove(DANA, OP);
    expect(stored(plugin)).toEqual({});
    expect(await createFilesystemMirror(storageOn(plugin)).list(DANA)).toEqual([]);
  });

  it('keeps accounts apart: a clear of one leaves the other untouched', async () => {
    const { mirror } = mirrorOn();
    await mirror.put(DANA, OP, bytes('dana'));
    await mirror.put(LIOR, OP, bytes('lior'));
    await mirror.clear(DANA);
    expect(await mirror.list(DANA)).toEqual([]);
    expect(text(await mirror.read(LIOR, OP))).toBe('lior');
  });

  it('refuses unchecked input before any file call, and oversized content', async () => {
    const { plugin, mirror } = mirrorOn();
    const attempts: Array<Promise<unknown>> = [
      mirror.put('../escape', OP, bytes('x')),
      mirror.put(DANA, '../x.op', bytes('x')),
      mirror.put(DANA, `${OP}.tmp`, bytes('x')),
      mirror.put(DANA, OP, 'text' as never),
      mirror.put(DANA, OP, new Uint8Array(MIRROR_MAX_FILE_BYTES + 1)),
      mirror.list('u_0123456789abcdef/../x'),
      mirror.read(DANA, 'C:\\x.op'),
      mirror.remove(DANA, 'x.op'),
      mirror.clear(''),
    ];
    for (const attempt of attempts) await expect(attempt).rejects.toMatchObject({ name: 'OfflinePlatformError', code: 'invalid-input' });
    expect(plugin.calls).toEqual([]);
  });

  it('runs the calls of one account in order: a put is never overtaken by the remove after it', async () => {
    const { mirror } = mirrorOn();
    const order = [mirror.put(DANA, OP, bytes('first')), mirror.put(DANA, OP, bytes('second')), mirror.remove(DANA, OP), mirror.put(DANA, NOTE, bytes('note'))];
    await Promise.all(order);
    expect(await mirror.list(DANA)).toEqual([NOTE]);
    const again = [mirror.put(DANA, OP, bytes('a')), mirror.put(DANA, OP, bytes('b')), mirror.put(DANA, OP, bytes('c'))];
    await Promise.all(again);
    expect(text(await mirror.read(DANA, OP))).toBe('c');
  });

  it('a failure is an io error and the next call works; a failed final rename puts the previous version back', async () => {
    const plugin = new FakeFilesystemPlugin();
    const faulty = new FaultyStorage(storageOn(plugin));
    const mirror = createFilesystemMirror(faulty);
    await mirror.put(DANA, OP, bytes('version 1'));
    faulty.failNext('write', /\.tmp$/);
    await expect(mirror.put(DANA, OP, bytes('version 2'))).rejects.toMatchObject({ code: 'io' });
    expect(text(await mirror.read(DANA, OP))).toBe('version 1');
    faulty.failNextRename(/\.tmp$/, /\.op$/);
    await expect(mirror.put(DANA, OP, bytes('version 3'))).rejects.toMatchObject({ code: 'io' });
    expect(text(await mirror.read(DANA, OP))).toBe('version 1');
    expect(Object.keys(stored(plugin))).toEqual([`${DANA}/${OP}`]);
    await mirror.put(DANA, OP, bytes('version 4'));
    expect(text(await mirror.read(DANA, OP))).toBe('version 4');
  });

  describe('crash repair: the app dies at every step of a put, the next run finds a complete version', () => {
    /** Mutating storage calls of a replacing put: mkdir, remove tmp, write tmp, remove old, 2 renames, remove old. */
    const STEPS = 8;

    for (const replacing of [true, false]) {
      for (let step = 1; step <= STEPS; step++) {
        for (const torn of [false, true]) {
          it(`${replacing ? 'replacing' : 'first'} put, dies at mutation ${step}${torn ? ' (torn write)' : ''}`, async () => {
            const plugin = new FakeFilesystemPlugin();
            if (replacing) await mirrorOn(plugin).mirror.put(DANA, OP, bytes('the previous version'));
            await mirrorOn(plugin).mirror.put(DANA, NOTE, bytes('an unrelated note'));

            // The run that dies.
            const faulty = new FaultyStorage(storageOn(plugin));
            const dying = createFilesystemMirror(faulty);
            await dying.list(DANA); // its start-up repair is done before the crash is armed
            faulty.crashAt(step, { torn });
            const finished = await Promise.race([
              dying.put(DANA, OP, bytes('the new version, complete')).then(() => true),
              faulty.crashed.then(() => false),
            ]);
            // A replacing put has 7 mutating calls, a first put 4: every step before that really died.
            expect(finished).toBe(step > (replacing ? 7 : 4));

            // The next run.
            const mirror = createFilesystemMirror(storageOn(plugin));
            const names = await mirror.list(DANA);
            const files = Object.keys(stored(plugin));
            expect(files.every((f) => !f.endsWith('.tmp') && !f.endsWith('.old')), files.join(', ')).toBe(true);
            expect(text(await mirror.read(DANA, NOTE))).toBe('an unrelated note');
            if (finished) {
              expect(text(await mirror.read(DANA, OP))).toBe('the new version, complete');
            } else if (replacing) {
              expect(names).toContain(OP);
              expect(['the previous version', 'the new version, complete']).toContain(text(await mirror.read(DANA, OP)));
            } else if (names.includes(OP)) {
              expect(text(await mirror.read(DANA, OP))).toBe('the new version, complete');
            }
            expect(plugin.renamedOverExisting).toEqual([]);
          });
        }
      }
    }
  });
});

// --- DeviceUserCheck ---------------------------------------------------------------------------------

describe('createDeviceUserCheck (DiaryOffline canVerifyUser / verifyUser)', () => {
  it('available() asks the plugin without any prompt; a failure or nonsense is "not available"', async () => {
    const plugin = fakeOfflinePlugin();
    expect(await createDeviceUserCheck({ plugin }).available()).toBe(true);
    expect(plugin.verifyUser).not.toHaveBeenCalled();
    expect(await createDeviceUserCheck({ plugin: fakeOfflinePlugin({ secure: false }) }).available()).toBe(false);
    plugin.canVerifyUser.mockRejectedValueOnce(new Error('not implemented'));
    expect(await createDeviceUserCheck({ plugin }).available()).toBe(false);
    plugin.canVerifyUser.mockResolvedValueOnce({ available: 'yes' as never });
    expect(await createDeviceUserCheck({ plugin }).available()).toBe(false);
  });

  it('verify(reason) shows the product name as title and the reason as one clean line; answers pass through', async () => {
    for (const result of ['ok', 'cancelled', 'failed', 'unavailable'] as const) {
      const plugin = fakeOfflinePlugin({ result });
      expect(await createDeviceUserCheck({ plugin }).verify('Unlock with this device\u2019s screen lock')).toBe(result);
      expect(plugin.verifyUser).toHaveBeenCalledWith({ title: APP_NAME, subtitle: 'Unlock with this device\u2019s screen lock' });
    }
    const plugin = fakeOfflinePlugin();
    const check = createDeviceUserCheck({ plugin });
    await check.verify('  line one\nline\u0007 two  ');
    expect(plugin.verifyUser).toHaveBeenLastCalledWith({ title: APP_NAME, subtitle: 'line oneline two' });
    await check.verify('x'.repeat(500));
    expect(plugin.verifyUser.mock.lastCall?.[0].subtitle).toHaveLength(200);
    await check.verify('');
    expect(plugin.verifyUser).toHaveBeenLastCalledWith({ title: APP_NAME });
  });

  it('a rejected call or an unknown answer is "unavailable", never a throw', async () => {
    const plugin = fakeOfflinePlugin();
    const check = createDeviceUserCheck({ plugin });
    plugin.verifyUser.mockRejectedValueOnce(new Error('no activity'));
    expect(await check.verify('x')).toBe('unavailable');
    plugin.verifyUser.mockResolvedValueOnce({ result: 'maybe' as never });
    expect(await check.verify('x')).toBe('unavailable');
    plugin.verifyUser.mockResolvedValueOnce(undefined as never);
    expect(await check.verify('x')).toBe('unavailable');
  });

  it('one prompt at a time: a second request shares the answer; the lock on leave is suspended meanwhile', async () => {
    const plugin = fakeOfflinePlugin();
    let answer: (value: { result: DeviceCheckResult }) => void = () => undefined;
    plugin.verifyUser.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const release = vi.fn();
    const suspendLock = vi.fn(() => release);
    const check = createDeviceUserCheck({ plugin, suspendLock });
    const first = check.verify('Unlock');
    const second = check.verify('Unlock');
    expect(second).toBe(first);
    await Promise.resolve();
    expect(plugin.verifyUser).toHaveBeenCalledTimes(1);
    expect(suspendLock).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
    answer({ result: 'ok' });
    expect(await first).toBe('ok');
    expect(release).toHaveBeenCalledTimes(1);
    // The next request is a new prompt.
    expect(await check.verify('Unlock')).toBe('ok');
    expect(plugin.verifyUser).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledTimes(2);
    // The suspension is released on a failure too.
    plugin.verifyUser.mockRejectedValueOnce(new Error('x'));
    expect(await check.verify('Unlock')).toBe('unavailable');
    expect(release).toHaveBeenCalledTimes(3);
  });
});

// --- Installation ------------------------------------------------------------------------------------

describe('installPhoneOffline', () => {
  it('installs the three seams through setOfflinePlatform and removes them again', async () => {
    const plugin = fakeOfflinePlugin();
    const fs = new FakeFilesystemPlugin();
    const dispose = installPhoneOffline({ plugin, mirrorStorage: storageOn(fs) });
    const p = getOfflinePlatform();
    expect(p.keyVault?.kind).toBe('keystore');
    expect(p.mirror).toBeDefined();
    expect(p.userCheck).toBeDefined();
    const blob = await p.keyVault!.wrap(DANA, aok());
    expect([...(await p.keyVault!.unwrap(DANA, blob))]).toEqual([...aok()]);
    await p.mirror!.put(DANA, OP, bytes('row'));
    expect(stored(fs)).toEqual({ [`${DANA}/${OP}`]: 'row' });
    expect(await p.userCheck!.available()).toBe(true);
    dispose();
    expect(getOfflinePlatform()).toEqual({ keyVault: undefined, mirror: undefined, userCheck: undefined });
  });

  it('names the phone in the error texts: Android by default, iOS when told, Android again after dispose', async () => {
    /** The text of the error a refused call carries (a user id that is not one). */
    const message = async (): Promise<string> => {
      try {
        await getOfflinePlatform().keyVault!.wrap('nobody', aok());
        return 'no error';
      } catch (e) {
        return (e as Error).message;
      }
    };
    const disposeAndroid = installPhoneOffline({ plugin: fakeOfflinePlugin(), mirrorStorage: storageOn(new FakeFilesystemPlugin()) });
    expect(await message()).toBe('offline (android): invalid user id');
    disposeAndroid();

    const disposeIos = installPhoneOffline({ plugin: fakeOfflinePlugin(), mirrorStorage: storageOn(new FakeFilesystemPlugin()), os: 'ios' });
    expect(await message()).toBe('offline (ios): invalid user id');
    expect(getOfflinePlatform().keyVault?.kind).toBe('keystore');
    disposeIos();
    expect(new OfflinePlatformError('io', 'x').message).toBe('offline (android): x');
  });
});

describe('mirrorDirectory: where the mirror folder lives on each phone', () => {
  it('is Directory.Data on Android (and for anything that is not iOS) and Directory.LibraryNoCloud on iOS', () => {
    expect(mirrorDirectory()).toBe(Directory.Data);
    expect(mirrorDirectory('android')).toBe(Directory.Data);
    expect(mirrorDirectory('ios')).toBe(Directory.LibraryNoCloud);
    // The spelled-out values are the plugin's own enum values (a renamed member would show here).
    expect(MIRROR_DIRECTORY).toEqual({ android: Directory.Data, ios: Directory.LibraryNoCloud });
    // Never the Documents folder: `Directory.Data` IS Documents on iOS, `Directory.Documents` everywhere.
    expect(mirrorDirectory('ios')).not.toBe(Directory.Documents);
  });

  it('the mirror works the same in the iOS directory (the storage only carries the name through)', async () => {
    const fs = new FakeFilesystemPlugin();
    const mirror = createFilesystemMirror(new CapacitorFilesystemStorage(fs, { base: MIRROR_BASE, directory: mirrorDirectory('ios') }));
    await mirror.put(DANA, OP, bytes('one'));
    await mirror.put(DANA, OP, bytes('two'));
    expect(await mirror.list(DANA)).toEqual([OP]);
    expect(text(await mirror.read(DANA, OP))).toBe('two');
    expect([...fs.files('LIBRARY_NO_CLOUD:offline/').keys()]).toEqual([`${DANA}/${OP}`]);
    expect(fs.files('DATA:').size).toBe(0);
    expect(fs.renamedOverExisting).toEqual([]);
    await mirror.clear(DANA);
    expect(fs.files().size).toBe(0);
  });
});

describe('installPhonePlatform wires the offline seams (mobile/platform/index.ts)', () => {
  /**
   * The platform module, imported once. Its graph is large (React, LockContext -> AuthContext,
   * @/offline, @/api, the i18n runtime) and a cold import waits on vitest's shared transform queue:
   * alone it takes about a second, under the full mobile suite plus other agents' runs it took
   * more than the default 20 s test timeout. The import therefore runs here, with its own limit,
   * and not inside a test.
   */
  let platform: typeof import('./index');
  beforeAll(async () => {
    platform = await import('./index');
  }, 180_000);

  beforeEach(() => {
    native.appListeners.clear();
    native.fs.current = new FakeFilesystemPlugin() as never;
  });

  it('the API mocks of this file keep every real export (modules on the import path read them at load time)', async () => {
    const client = await import('@/api/client');
    const realClient = await vi.importActual<typeof import('@/api/client')>('@/api/client');
    const api = await import('@/api');
    const realApi = await vi.importActual<typeof import('@/api')>('@/api');
    const missing = (mocked: object, actual: object) => Object.keys(actual).filter((name) => !(name in mocked));
    expect(Object.keys(realClient).length).toBeGreaterThan(10);
    expect(missing(client, realClient), '@/api/client').toEqual([]);
    expect(missing(api, realApi), '@/api').toEqual([]);
    // The event names the offline engine listens to at import are the real ones, not stand-ins.
    expect(client.UNAUTHORIZED_EVENT).toBe(realClient.UNAUTHORIZED_EVENT);
    expect(client.LOCKED_EVENT).toBe(realClient.LOCKED_EVENT);
    // What would reach a server or replace the app's transport stays stubbed.
    expect(client.request).not.toBe(realClient.request);
    expect(client.setApiTransport).not.toBe(realClient.setApiTransport);
    // And the engine module that broke on a non-partial mock loads under these mocks.
    await expect(import('@/offline')).resolves.toBeDefined();
  });

  it('installs the Keystore vault, the Directory.Data mirror and the user check; resume calls notifyResume()', async () => {
    const { installPhonePlatform } = platform;
    const host = { transport: (async () => new Response('{}')) as never, onEvent: () => () => undefined, control: async () => undefined };
    const dispose = await installPhonePlatform({ host, navigate: () => undefined });
    const p = getOfflinePlatform();
    expect(p.keyVault?.kind).toBe('keystore');
    expect(await p.userCheck?.available()).toBe(true);

    // The installed mirror writes below offline/<userId>/ of Directory.Data.
    await p.mirror!.put(DANA, OP, bytes('row'));
    expect(stored(native.fs.current as never)).toEqual({ [`${DANA}/${OP}`]: 'row' });

    const resumed = vi.fn();
    const unsubscribe = onResume(resumed);
    const appStateChange = native.appListeners.get('appStateChange');
    expect(appStateChange).toBeDefined();
    appStateChange!({ isActive: false });
    expect(resumed).not.toHaveBeenCalled();
    appStateChange!({ isActive: true });
    expect(resumed).toHaveBeenCalledTimes(1);
    unsubscribe();

    dispose();
    expect(getOfflinePlatform()).toEqual({ keyVault: undefined, mirror: undefined, userCheck: undefined });
  });

  /**
   * The one place that reads the phone is `Capacitor.getPlatform()` in installPhonePlatform; each
   * feature must receive it. Android (and the 'web' of a browser, which is what jsdom reports) is
   * the test above; this is the iOS wiring next to the Android answers of the same calls.
   */
  describe('the phone (Capacitor.getPlatform) reaches every feature that differs on iOS', () => {
    const host = { transport: (async () => new Response('{}')) as never, onEvent: () => () => undefined, control: async () => undefined };

    async function install(platformName: string) {
      const getPlatform = vi.spyOn(Capacitor, 'getPlatform').mockReturnValue(platformName);
      const createChannel = vi.spyOn(native.LocalNotifications, 'createChannel');
      const dispose = await platform.installPhonePlatform({ host, navigate: () => undefined });
      const { getPhoneReminders } = await import('@/hooks/useReminders');
      const { getPhoneFiles } = await import('@/utils/download');
      return {
        createChannel,
        reminders: getPhoneReminders()!,
        files: getPhoneFiles()!,
        dispose() {
          dispose();
          getPlatform.mockRestore();
          createChannel.mockRestore();
        },
      };
    }

    it('iOS: the mirror in Library/NoCloud, `pause` as the leave, no notification channel, the save sheet at closeWrite', async () => {
      const ios = await install('ios');
      try {
        // offline.ts: the mirror's directory.
        await getOfflinePlatform().mirror!.put(DANA, OP, bytes('row'));
        const fs = native.fs.current as unknown as FakeFilesystemPlugin;
        expect([...fs.files('LIBRARY_NO_CLOUD:offline/').keys()]).toEqual([`${DANA}/${OP}`]);
        expect(fs.files('DATA:').size).toBe(0);
        expect(getOfflinePlatform().keyVault?.kind).toBe('keystore');

        // lifecycle.ts: the leave listens to `pause`.
        expect(native.appListeners.has('pause')).toBe(true);
        expect(native.appListeners.has('appStateChange')).toBe(true);

        // notifications.ts: a sync never asks for a channel.
        expect(await ios.reminders.sync({ enabled: true })).toEqual({ scheduled: 0, reason: 'scheduled' });
        expect(ios.createChannel).not.toHaveBeenCalled();

        // files.ts: the answer of closeWrite (the dismissed export sheet) decides.
        expect(await ios.files.save(new Blob(['x']), 'backup.mpd')).toBe('cancelled');
      } finally {
        ios.dispose();
      }
    });

    it('Android - and every platform name that is not "ios" - keeps the Android paths', async () => {
      for (const name of ['android', 'web']) {
        native.appListeners.clear();
        native.fs.current = new FakeFilesystemPlugin() as never;
        const android = await install(name);
        try {
          await getOfflinePlatform().mirror!.put(DANA, OP, bytes('row'));
          expect(stored(native.fs.current as never), name).toEqual({ [`${DANA}/${OP}`]: 'row' });
          expect((native.fs.current as unknown as FakeFilesystemPlugin).files('LIBRARY_NO_CLOUD:').size, name).toBe(0);
          expect(native.appListeners.has('pause'), name).toBe(false);
          expect(await android.reminders.sync({ enabled: true }), name).toEqual({ scheduled: 0, reason: 'scheduled' });
          expect(android.createChannel, name).toHaveBeenCalledTimes(1);
          // The dialog came first there: the answer of closeWrite is not read.
          expect(await android.files.save(new Blob(['x']), 'backup.mpd'), name).toBe('saved');
        } finally {
          android.dispose();
        }
      }
    });
  });
});
