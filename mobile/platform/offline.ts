/**
 * The Android app's platform seams of the automatic offline mode (docs/android-tasks/OFFLINE-DESIGN.md
 * sections 5.1, 5.4, 5.7 and 7; WP-H10d). The engine itself (src/offline/**) is the same on every
 * platform; what the phone plugs in through `setOfflinePlatform` (src/offline/seams.ts) is:
 *
 *  - `OfflineKeyVault` (`kind: 'keystore'`): the account offline key (AOK) wrapped with AES-256-GCM
 *    by a non-exportable Android Keystore key, alias `com.mydiary.app.offline.v1`, without
 *    user-authentication binding - DiaryOfflinePlugin.java through mobile/plugins/diary-offline. The
 *    blob is kept by the engine (IndexedDB `meta`); nothing is stored here.
 *  - `OutboxMirror`: a copy of every outbox / notes record outside IndexedDB, in the app-private
 *    `Directory.Data` (`files/` of the app, excluded from backup by the manifest) under
 *    `offline/<userId>/<seq>-<rid>.op` / `<id>-<rid>.note`, through @capacitor/filesystem (the
 *    `StorageBackend` of mobile/host/storage/capacitor-filesystem.ts with the base folder `offline`).
 *  - `DeviceUserCheck`: the phone's own screen lock (PIN, pattern, password, or a strong biometric)
 *    for the offline unlock. The answer only lifts the local lock overlay over data already in
 *    memory; nothing derived from the password is stored anywhere (E8).
 *
 * INPUT. Every call checks its arguments against the section 7 contract before anything reaches a
 * plugin: `userId` must match `^u_[0-9a-f]{16}$`, a mirror `name` `^[0-9]+-[0-9a-f-]{36}\.(op|note)$`.
 * Anything else is an `OfflinePlatformError` with code `invalid-input`, and no path is ever built
 * from unchecked input.
 *
 * ATOMIC MIRROR WRITES. A `put` writes the whole content to `<name>.tmp` first and renames it into
 * place. @capacitor/filesystem deletes an existing target before a rename on some platforms (see
 * mobile/core/vfs/vfs.ts), which would leave a moment with no file at all - so a rename onto an
 * existing name is never asked of it:
 *
 *     put X    remove X.tmp;  write X.tmp;  [X exists: remove X.old; rename X -> X.old];  rename X.tmp -> X;  [remove X.old]
 *
 * If the app dies in the middle, the first call for that account in the next run repairs the folder
 * before anything is listed or read: every `X.tmp` is deleted (possibly half written), `X.old` next
 * to `X` is deleted (the put happened), `X.old` without `X` is renamed back to `X` (it did not). So
 * the mirror always holds, for every name, a complete previous or new version - never a torn file
 * and never nothing. A remove deletes `X.old` and `X.tmp` before `X`, so a removed file never comes
 * back through the repair. Calls for one account run one after the other (a put is never overtaken
 * by the remove that follows it).
 *
 * ERRORS. Plugin failures become an `OfflinePlatformError` (`code`: invalid-input, key-missing,
 * unwrap-failed, keystore, io). The engine treats every key or mirror failure as best effort: an
 * unwrap that fails means "fetch the AOK from the server after sign-in", a mirror that fails never
 * fails a save. The user check never throws: an unexpected failure answers `unavailable`.
 *
 * iOS (`os: 'ios'`, docs/APPLE-PLAN.md WP-A2; the native side is the draft
 * mobile/plugins/diary-offline/ios/DiaryOfflinePlugin.swift, compiled first on a Mac). The three
 * seams and every check above are the same code; what differs:
 *  - the key vault's native half: a random 256-bit key in the iOS Keychain (this device only, no
 *    user-authentication binding) wraps the AOK with AES-256-GCM, the account id as additional
 *    data and the same blob layout as the Java plugin. `kind` stays 'keystore' although the seam's
 *    type (src/offline/seams.ts) has 'keychain' since APPLE-PLAN WP-M3: that value belongs to the
 *    Mac desktop app's vault (src/offline/native/tauri.ts `tauriKeychainVault`, where the blob is
 *    only the marker of a Keychain item), and the value only tells a blob of another kind of vault
 *    apart (src/offline/keys.ts `wrappedBy`) - on an iPhone every blob comes from this plugin, so
 *    the check holds as it is;
 *  - the mirror's folder: `Directory.LibraryNoCloud` (`Library/NoCloud/offline/<userId>/`) instead
 *    of `Directory.Data`, which is the DOCUMENTS folder on iOS - the one place of an app that the
 *    Files app can show and that iCloud / computer backups copy. `mirrorDirectory(os)` decides;
 *    the error codes of the plugin's iOS side map like Android's for everything the mirror does
 *    (checked against FilesystemError.swift 8.1.3 and ion-ios-filesystem: a missing file or folder
 *    is OS-PLUG-FILE-0008, a missing parent 0011, an existing folder 0010);
 *  - the user check: Face ID / Touch ID or the device passcode (LocalAuthentication); the prompt
 *    is presented inside the app, so the lock suspension it holds has nothing to defer there.
 *
 * Opens no network connection (scripts/check-no-network.mjs).
 */
import type { Directory } from '@capacitor/filesystem';
import { APP_NAME } from '@shared/constants';
import { setOfflinePlatform, type DeviceUserCheck, type OfflineKeyVault, type OutboxMirror } from '@/offline/seams';
import { base64ToBytes, bytesToBase64 } from '../host/storage/base64';
import { StorageError, type StorageBackend } from '../shared/storage-protocol';
import type { DeviceCheckResult, DiaryOfflineErrorCode, DiaryOfflinePlugin } from '../plugins/diary-offline';
import type { PhoneOs } from './os';

// --- The section 7 contract --------------------------------------------------------------------

/** `userId` of every seam call (section 7). */
export const USER_ID_RE = /^u_[0-9a-f]{16}$/;
/** A mirror file name (section 7): `<seq>-<rid>.op` of an outbox row, `<id>-<rid>.note` of a note. */
export const MIRROR_NAME_RE = /^[0-9]+-[0-9a-f-]{36}\.(op|note)$/;
/** Longest name accepted (the Windows commands use the same bound). */
const MAX_NAME_LENGTH = 96;
/** The AOK is 32 bytes; a generous bound against nonsense (DiaryOfflinePlugin.java uses the same). */
export const MAX_KEY_BYTES = 4096;
/** Longest mirror file (an operation is at most about 2 MB of ciphertext, section 4.4; as offline.rs). */
export const MIRROR_MAX_FILE_BYTES = 16 * 1024 * 1024;
/** The folder of the mirror inside `Directory.Data` (section 5.4: `offline/<userId>/...`). */
export const MIRROR_BASE = 'offline';
/**
 * The Capacitor directory that holds the mirror folder, by phone - the values of the `Directory`
 * enum of @capacitor/filesystem, spelled out so that this module still loads no Capacitor code
 * (offline.test.ts checks them against the enum). Android: `Directory.Data`, the app's `files/`,
 * kept out of every backup by the manifest. iOS: `Directory.LibraryNoCloud` = `Library/NoCloud`,
 * never listed by the Files app and excluded from backups (see the header).
 */
export const MIRROR_DIRECTORY = { android: 'DATA', ios: 'LIBRARY_NO_CLOUD' } as const;

/** The mirror's Capacitor directory on this phone (Android's for everything that is not iOS). */
export function mirrorDirectory(os?: PhoneOs): Directory {
  return (os === 'ios' ? MIRROR_DIRECTORY.ios : MIRROR_DIRECTORY.android) as Directory;
}
/** Suffixes of the two helper files of an atomic put (never listed, see the header). */
export const MIRROR_TMP_SUFFIX = '.tmp';
export const MIRROR_OLD_SUFFIX = '.old';
/** Longest text handed to the user-check prompt (as offline.rs and DiaryOfflinePlugin.java). */
const MAX_PROMPT_TEXT = 200;

export type OfflinePlatformErrorCode = 'invalid-input' | 'key-missing' | 'unwrap-failed' | 'keystore' | 'io';

/** The phone named in the error texts (log text only): Android unless `installPhoneOffline` was told iOS. */
let errorLabel: PhoneOs = 'android';

/** A refused or failed seam call; `code` says which (the engine only needs "it failed"). */
export class OfflinePlatformError extends Error {
  readonly code: OfflinePlatformErrorCode;

  constructor(code: OfflinePlatformErrorCode, message: string, options?: { cause?: unknown }) {
    super(`offline (${errorLabel}): ${message}`, options);
    this.name = 'OfflinePlatformError';
    this.code = code;
  }
}

function invalid(what: string): OfflinePlatformError {
  return new OfflinePlatformError('invalid-input', what);
}

export function checkUserId(userId: unknown): string {
  if (typeof userId !== 'string' || !USER_ID_RE.test(userId)) throw invalid('invalid user id');
  return userId;
}

export function checkName(name: unknown): string {
  if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH || !MIRROR_NAME_RE.test(name)) throw invalid('invalid mirror file name');
  return name;
}

/** Standard base64 with complete padding - what `Base64.NO_WRAP` produces and the plugin accepts. */
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function isBase64(text: unknown): text is string {
  return typeof text === 'string' && text.length > 0 && BASE64_RE.test(text);
}

/** A Uint8Array of any realm (`instanceof` fails for one made by another window or worker). */
function isBytes(value: unknown): value is Uint8Array {
  return Object.prototype.toString.call(value) === '[object Uint8Array]';
}

// --- OfflineKeyVault: the Android Keystore ------------------------------------------------------

/** What the vault needs from the plugin (the real one: mobile/plugins/diary-offline `DiaryOffline`). */
export type OfflineKeyPluginLike = Pick<DiaryOfflinePlugin, 'wrapKey' | 'unwrapKey' | 'deleteKey'>;

/** The plugin's rejection codes (DiaryOfflinePlugin.java `ERR_*`) as the seam's codes. */
const PLUGIN_ERROR_CODES: Record<DiaryOfflineErrorCode, OfflinePlatformErrorCode> = {
  INVALID_INPUT: 'invalid-input',
  KEY_MISSING: 'key-missing',
  UNWRAP_FAILED: 'unwrap-failed',
  KEYSTORE_ERROR: 'keystore',
};

/**
 * The seam code of a plugin rejection code. An own-property lookup only: `in` (or a plain index)
 * would also find the keys of Object.prototype, so a code like `constructor` or `toString` would
 * map to a function instead of a seam code.
 */
function pluginErrorCode(code: unknown): OfflinePlatformErrorCode {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(PLUGIN_ERROR_CODES, code)
    ? PLUGIN_ERROR_CODES[code as DiaryOfflineErrorCode]
    : 'keystore';
}

/** The seam error of a rejected plugin call: its `code` when it is one of ours, else `keystore`. */
export function toOfflinePlatformError(error: unknown, what: string): OfflinePlatformError {
  if (error instanceof OfflinePlatformError) return error;
  const mapped = pluginErrorCode((error as { code?: unknown } | null)?.code);
  const message = (error as { message?: unknown } | null)?.message;
  return new OfflinePlatformError(mapped, `${what}${typeof message === 'string' && message ? `: ${message}` : ''}`, { cause: error });
}

async function pluginCall<T>(what: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    throw toOfflinePlatformError(e, what);
  }
}

export function createKeystoreVault(plugin: OfflineKeyPluginLike): OfflineKeyVault {
  return {
    kind: 'keystore',
    async wrap(userId, key) {
      checkUserId(userId);
      if (!isBytes(key) || key.byteLength === 0 || key.byteLength > MAX_KEY_BYTES) throw invalid('invalid key');
      const { blob } = await pluginCall('the key could not be wrapped', () => plugin.wrapKey({ userId, key: bytesToBase64(key) }));
      if (!isBase64(blob)) throw new OfflinePlatformError('keystore', 'the plugin answered no blob');
      return blob;
    },
    async unwrap(userId, blob) {
      checkUserId(userId);
      if (!isBase64(blob)) throw invalid('invalid key blob');
      const { key } = await pluginCall('the key could not be unwrapped', () => plugin.unwrapKey({ userId, blob }));
      if (!isBase64(key)) throw new OfflinePlatformError('keystore', 'the plugin answered no key');
      return base64ToBytes(key);
    },
    async remove(userId) {
      checkUserId(userId);
      await pluginCall('the key could not be deleted', () => plugin.deleteKey({ userId }));
    },
  };
}

// --- OutboxMirror: @capacitor/filesystem, Directory.Data ----------------------------------------

function ioError(error: unknown, what: string): OfflinePlatformError {
  if (error instanceof OfflinePlatformError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new OfflinePlatformError('io', `${what}: ${message}`, { cause: error });
}

function isNotFound(error: unknown): boolean {
  return error instanceof StorageError && error.code === 'ENOENT';
}

/**
 * The mirror on a `StorageBackend` whose root is the mirror folder - in the app
 * `new CapacitorFilesystemStorage(Filesystem, { base: MIRROR_BASE, directory: Directory.Data })`.
 * Paths below it are `<userId>/<name>`, both checked first.
 */
export function createFilesystemMirror(storage: StorageBackend): OutboxMirror {
  /** The tail of each account's call queue. */
  const queues = new Map<string, Promise<unknown>>();
  /** Accounts whose folder was repaired in this run (the first call of each repairs it). */
  const repaired = new Set<string>();
  /** Accounts whose folder this run created or found (a `clear` forgets it). */
  const folders = new Set<string>();

  /** Runs `task` after every earlier call of the account, whatever their outcome. */
  function serial<T>(userId: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(userId) ?? Promise.resolve();
    const run = previous.then(task, task);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    queues.set(userId, tail);
    void tail.then(() => {
      if (queues.get(userId) === tail) queues.delete(userId);
    });
    return run;
  }

  /** The account's files (a folder that does not exist has none). */
  async function filesOf(dir: string): Promise<string[]> {
    try {
      return (await storage.list(dir)).filter((entry) => entry.type === 'file').map((entry) => entry.name);
    } catch (e) {
      if (isNotFound(e)) return [];
      throw e;
    }
  }

  /** The crash repair of the header, once per account and run, before its first real call. */
  async function repair(userId: string): Promise<void> {
    if (repaired.has(userId)) return;
    const names = await filesOf(userId);
    const present = new Set(names);
    for (const name of names) {
      if (name.endsWith(MIRROR_TMP_SUFFIX) && MIRROR_NAME_RE.test(name.slice(0, -MIRROR_TMP_SUFFIX.length))) {
        await storage.remove(`${userId}/${name}`);
      } else if (name.endsWith(MIRROR_OLD_SUFFIX) && MIRROR_NAME_RE.test(name.slice(0, -MIRROR_OLD_SUFFIX.length))) {
        const base = name.slice(0, -MIRROR_OLD_SUFFIX.length);
        if (present.has(base)) {
          await storage.remove(`${userId}/${name}`);
        } else {
          await storage.rename(`${userId}/${name}`, `${userId}/${base}`);
          present.add(base);
        }
      }
    }
    repaired.add(userId);
  }

  /** Validates, queues, repairs first, maps failures. */
  function call<T>(userId: unknown, what: string, task: (id: string) => Promise<T>): Promise<T> {
    let id: string;
    try {
      id = checkUserId(userId);
    } catch (e) {
      return Promise.reject(e);
    }
    return serial(id, async () => {
      try {
        await repair(id);
        return await task(id);
      } catch (e) {
        // The folder may be gone (app data cleared under the running app): the next put creates it.
        folders.delete(id);
        throw ioError(e, what);
      }
    });
  }

  return {
    put(userId, name, bytes) {
      try {
        checkName(name);
        if (!isBytes(bytes)) throw invalid('the mirror file content is not bytes');
        if (bytes.byteLength > MIRROR_MAX_FILE_BYTES) throw invalid('mirror file too large');
      } catch (e) {
        return Promise.reject(e);
      }
      return call(userId, `cannot write ${name}`, async (id) => {
        const final = `${id}/${name}`;
        const tmp = `${final}${MIRROR_TMP_SUFFIX}`;
        const old = `${final}${MIRROR_OLD_SUFFIX}`;
        if (!folders.has(id)) {
          await storage.mkdir(id);
          folders.add(id);
        }
        await storage.remove(tmp);
        await storage.write(tmp, bytes);
        const replacing = (await storage.stat(final)) !== null;
        if (replacing) {
          await storage.remove(old);
          await storage.rename(final, old);
        }
        try {
          await storage.rename(tmp, final);
        } catch (e) {
          // Put the previous version back; should that fail too, the next run's repair does it.
          if (replacing) await storage.rename(old, final).catch(() => undefined);
          await storage.remove(tmp).catch(() => undefined);
          throw e;
        }
        // The new version is in place; a leftover .old is removed by the next run's repair.
        if (replacing) await storage.remove(old).catch(() => undefined);
      });
    },

    list(userId) {
      return call(userId, 'cannot list', async (id) => (await filesOf(id)).filter((name) => MIRROR_NAME_RE.test(name)).sort());
    },

    read(userId, name) {
      try {
        checkName(name);
      } catch (e) {
        return Promise.reject(e);
      }
      return call(userId, `cannot read ${name}`, async (id) => {
        const path = `${id}/${name}`;
        const info = await storage.stat(path);
        if (!info || info.type !== 'file' || info.size > MIRROR_MAX_FILE_BYTES) throw new StorageError('ENOENT', `ENOENT: no mirror file ${name}`);
        return storage.read(path);
      });
    },

    remove(userId, name) {
      try {
        checkName(name);
      } catch (e) {
        return Promise.reject(e);
      }
      // A file that is already gone is not an error (the engine retries deletes). The helper files
      // go first: a `.old` left behind could otherwise bring the removed file back at the next repair.
      return call(userId, `cannot delete ${name}`, async (id) => {
        const final = `${id}/${name}`;
        await storage.remove(`${final}${MIRROR_OLD_SUFFIX}`);
        await storage.remove(`${final}${MIRROR_TMP_SUFFIX}`);
        await storage.remove(final);
      });
    },

    clear(userId) {
      // The whole account folder, helper files included (a full wipe, section 5.5).
      return call(userId, 'cannot clear', async (id) => {
        folders.delete(id);
        await storage.remove(id);
        repaired.delete(id);
      });
    },
  };
}

// --- DeviceUserCheck: the phone's screen lock ----------------------------------------------------

/** What the user check needs from the plugin. */
export type DeviceCheckPluginLike = Pick<DiaryOfflinePlugin, 'canVerifyUser' | 'verifyUser'>;

export interface DeviceUserCheckDeps {
  plugin: DeviceCheckPluginLike;
  /**
   * The lifecycle's lock suspension (mobile/platform/lifecycle.ts `suspendLock`): the PIN screen of
   * Android 7-10 is another activity, which @capacitor/app reports as leaving the app - "Lock when I
   * leave" must not fire under the prompt that is about to unlock. Optional for the tests.
   */
  suspendLock?: () => () => void;
  /** The prompt's title (default: the product name, English in every language). */
  title?: () => string;
}

const CHECK_RESULTS: ReadonlySet<DeviceCheckResult> = new Set<DeviceCheckResult>(['ok', 'cancelled', 'failed', 'unavailable']);

/** One line of prompt text: control characters dropped, trimmed, at most MAX_PROMPT_TEXT characters. */
function promptText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let out = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || (code >= 0x7f && code < 0xa0)) continue;
    out += ch;
  }
  return [...out.trim()].slice(0, MAX_PROMPT_TEXT).join('');
}

export function createDeviceUserCheck(deps: DeviceUserCheckDeps): DeviceUserCheck {
  let inFlight: Promise<'ok' | 'cancelled' | 'failed' | 'unavailable'> | null = null;
  return {
    async available() {
      try {
        const answer = await deps.plugin.canVerifyUser();
        return answer?.available === true;
      } catch {
        return false;
      }
    },
    verify(reason) {
      // One prompt at a time: a second request while one is showing shares its answer.
      if (inFlight) return inFlight;
      const release = deps.suspendLock?.() ?? (() => undefined);
      const subtitle = promptText(reason);
      const title = promptText(deps.title?.() ?? APP_NAME) || APP_NAME;
      const running = (async () => {
        try {
          const answer = await deps.plugin.verifyUser(subtitle ? { title, subtitle } : { title });
          const result = answer?.result;
          return result && CHECK_RESULTS.has(result) ? result : 'unavailable';
        } catch {
          return 'unavailable' as const;
        } finally {
          release();
        }
      })();
      inFlight = running;
      void running.finally(() => {
        if (inFlight === running) inFlight = null;
      });
      return running;
    },
  };
}

// --- Installation --------------------------------------------------------------------------------

export interface PhoneOfflineDeps {
  plugin: OfflineKeyPluginLike & DeviceCheckPluginLike;
  /** The mirror's storage: its root is the mirror folder (`offline/` in `mirrorDirectory(os)`). */
  mirrorStorage: StorageBackend;
  suspendLock?: () => () => void;
  /** The phone (mobile/platform/os.ts); default Android. Here it only names the phone in the error texts. */
  os?: PhoneOs;
}

/**
 * Installs the three seams (mobile/platform/index.ts, inside the installed app only); returns the
 * function that removes them again (the platform's dispose, tests).
 */
export function installPhoneOffline(deps: PhoneOfflineDeps): () => void {
  errorLabel = deps.os === 'ios' ? 'ios' : 'android';
  const keyVault = createKeystoreVault(deps.plugin);
  const mirror = createFilesystemMirror(deps.mirrorStorage);
  const userCheck = createDeviceUserCheck({ plugin: deps.plugin, suspendLock: deps.suspendLock });
  setOfflinePlatform({ keyVault, mirror, userCheck });
  return () => {
    errorLabel = 'android';
    setOfflinePlatform({ keyVault: undefined, mirror: undefined, userCheck: undefined });
  };
}
