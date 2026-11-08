/**
 * The mobile diary core: the server's services composed for the phone, the way
 * server/src/server.ts composes them for the desktop - minus everything that needs Node.js (HTTP
 * listeners, the LAN listener, remote access, the host check, the node:net SMTP client).
 *
 * Boot order (`bootCore`), as the VFS notes prescribe:
 *   1. the virtual file system on the storage of the host (a `StorageBackend`, over the storage
 *      RPC in the worker; a memory-only VFS in tests), installed behind the server's `node:fs`;
 *   2. the assets the host transferred: the SQLite WebAssembly module and the PDF fonts
 *      (./assets.ts) - the VFS is told about them before it boots;
 *   3. `vfs.boot()`: crash recovery + preload of /data; until then nothing below /data is readable;
 *   4. the server configuration with virtual paths (`loadConfig(['--data-dir', '/data', ...])`);
 *   5. `createAuthService`, the mail service (with the injected transport: a stub that fails cleanly
 *      until WP-12 brings the native SMTP plugin) and the password-reset service, exactly as
 *      server.ts builds them; the owner bookkeeping of start-up (release a vanished owner, pin);
 *   6. the app (./app.ts).
 *
 * Per request (`handle`): dispatch through the app, then make what the request changed durable
 * before the answer is given:
 *   - the diaries it wrote to are encrypted and written at once (`persistIfDirty`) - the vault's
 *     own save runs 250 ms after a write (a debounce), far too late for an answer that says "saved"
 *     on a phone, where the process may be killed right after it;
 *   - `vfs.drain()` for the files written synchronously (accounts.json, sessions.json, ...).
 * Each step is retried once. When a change of THIS request is still not in the storage, the answer
 * is a 500 IO error in the request language (like the server's own I/O errors).
 *
 * What does not depend on the storage keeps working while it refuses changes (it is full, ...):
 * GET / HEAD / OPTIONS requests, the download answers (export, backup) and the session requests
 * (sign in, lock, unlock, sign out - what they write is bookkeeping) always get their real answer,
 * and so does a request that changed nothing itself (a search). So a diary on a full phone can
 * still be opened, read, exported and backed up. The failure is reported to the host as a
 * `storage-failed` event (once), the core tries again by itself (every few seconds, backing off)
 * and posts `storage-recovered` when everything is stored. The start-up is as tolerant: a storage
 * that can be read but refuses what the boot wrote does not keep the core from starting.
 *
 * After a mutating request that may have changed habits or reminder settings the answer carries a
 * `habits-changed` event, to be posted after the answer (`CoreAnswer.events`).
 *
 * Control: `flushAll` (persist every open diary and the sessions, then drain), `lockAll` (lock
 * every session of every real account - a guest session cannot be locked; they are locked in
 * memory even when sessions.json cannot be written, in which case the control fails), `shutdown`
 * (close the diaries, persist, drain).
 */
import { loadConfig, type ServerConfig } from '../../server/src/config';
import { ApiError } from '../../server/src/errors';
import { SmtpError } from '../../server/src/mail/errors';
import { MailService } from '../../server/src/mail/service';
import type { SmtpTransport } from '../../server/src/mail/transport';
import { localeFromHeader } from '../../server/src/middleware/locale';
import { createAuthService, type AuthServiceOptions, type DiaryAuthService } from '../../server/src/security/auth-service';
import { loadOrCreateDeviceKey } from '../../server/src/security/device-key';
import { firstAccountId } from '../../server/src/security/owner';
import { PasswordResetService, type PasswordResetOptions } from '../../server/src/security/password-reset';
import type { DiaryVault } from '../../server/src/security/vault';
import type { StorageBackend } from '../shared/storage-protocol';
import type { CoreAssetBytes, CoreEvent, CoreHeaders, CoreRequest, CoreResponse } from '../shared/transport';
import { createMobileApp, MOBILE_SERVER_SETTINGS } from './app';
import { registerCoreAssets } from './assets';
import { dispatch, type Application, type DispatchResult } from './express-shim';
import { Buffer as PolyfillBuffer } from './shims/buffer';
import { installBufferClass, installVfs, Vfs, type VfsLogLevel } from './vfs';

/** The virtual directories of the core (the VFS defaults). */
export const CORE_DATA_DIR = '/data';
export const CORE_ASSETS_VIRTUAL_DIR = '/assets';

export type CoreLog = (level: VfsLogLevel, message: string) => void;

export interface CoreBootOptions {
  /** Where /data is stored. Null: memory only (tests, and the storage-less dev mode). */
  storage: StorageBackend | null;
  /** The SQLite wasm and the fonts (transferred by the host). */
  assets: CoreAssetBytes;
  /** Diagnostics (never diary content). Default: console. */
  log?: CoreLog;
  /**
   * Receives the events the core raises on its own (`storage-failed`, `storage-recovered`). The
   * events that belong to an answer (`habits-changed`) are returned with it (`CoreAnswer`).
   */
  onEvent?: (event: CoreEvent) => void;
  /** Account service options (tests: cheap scrypt parameters, a clock). */
  auth?: AuthServiceOptions;
  /** Password-reset options (tests). */
  passwordReset?: PasswordResetOptions;
  /**
   * Carries out the SMTP conversation. Default: a transport that fails every delivery with
   * 'server.mail.error.connect' - mail settings can be saved and tested, sending fails cleanly -
   * until WP-12 injects the native plugin.
   */
  mailTransport?: SmtpTransport;
  /** Clock of the services (tests). */
  now?: () => Date;
  /**
   * How long after a storage failure the core tries again to store what is only in memory; the
   * pause doubles after every failed attempt, up to STORAGE_RETRY_MAX_MS. Default: STORAGE_RETRY_MS.
   */
  storageRetryMs?: number;
}

/** The first pause before a failed storage is tried again, and the longest one. */
export const STORAGE_RETRY_MS = 5_000;
export const STORAGE_RETRY_MAX_MS = 60_000;

/** What `handle` gives back: the answer, and the events to post right AFTER it. */
export interface CoreAnswer {
  response: CoreResponse;
  events: CoreEvent[];
}

export interface DiaryCore {
  readonly app: Application;
  readonly vfs: Vfs;
  readonly config: ServerConfig;
  readonly auth: DiaryAuthService;
  readonly mail: MailService;
  readonly passwordReset: PasswordResetService;
  /** When the core finished booting (ISO). */
  readonly startedAt: string;
  /**
   * Answers one request of the host (never rejects). `events` are to be posted after the
   * response (the worker does; they are raised whether or not the host still wants the answer).
   */
  handle(request: CoreRequest): Promise<CoreAnswer>;
  /** Writes everything that is still in memory to the storage (the app goes to the background). */
  flushAll(): Promise<void>;
  /** Locks every session of every real account (the "lock when I leave the app" setting). */
  lockAll(): Promise<void>;
  /** Closes the diaries, persists the sessions and drains the storage. Idempotent. */
  shutdown(): Promise<void>;
}

/** The transport of the core until the native SMTP plugin exists: every delivery fails to connect. */
export const stubMailTransport: SmtpTransport = {
  send(opts) {
    return Promise.reject(new SmtpError('server.mail.error.connect', { host: opts.host, port: opts.port }));
  },
};

const defaultLog: CoreLog = (level, message) => {
  const line = `[diary-core] ${message}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
};

/** Requests after which the host's reminder scheduler should look again (habits, restore, seed, diary settings). */
export function changesHabits(method: string, path: string, status: number): boolean {
  if (status < 200 || status >= 300 || method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
  const clean = path.split('?')[0].replace(/\/+$/, '');
  if (clean.startsWith('/api/habits')) return true;
  return clean === '/api/backup/restore' || clean === '/api/settings/seed-demo' || clean === '/api/settings';
}

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * A download answer (export, backup): the file travels to the host in the answer, nothing was
 * meant to be stored - so the answer is worth the same whatever the storage does.
 */
export function isDownload(result: Pick<DispatchResult, 'status' | 'headers'>): boolean {
  return result.status >= 200 && result.status < 300 && /^attachment\b/i.test(result.headers['content-disposition'] ?? '');
}

/**
 * The session requests. Their answer is about the session in memory - signed in, locked, unlocked,
 * signed out. What they write is bookkeeping (sessions.json for "remember me", the sign-in time in
 * accounts.json): when it cannot be stored the cost is a sign-in or an unlock more after the next
 * start, never diary data. Failing them instead would lock the user out of a diary on a full phone
 * (the lock screen could not be left) - exactly when the export and the backup are needed. The
 * desktop treats the sign-in time the same way (auth-service `rememberLogin`: best effort).
 */
const SESSION_ROUTES: ReadonlySet<string> = new Set(['/api/auth/login', '/api/auth/verify-password', '/api/auth/lock', '/api/auth/logout']);

export function isSessionRequest(method: string, url: string): boolean {
  return method.toUpperCase() === 'POST' && SESSION_ROUTES.has(url.split('?')[0].replace(/\/+$/, '').toLowerCase());
}

/**
 * Requests whose answer does not depend on the storage: reads, downloads and the session requests.
 * They get their real answer even while the storage refuses changes.
 */
export function isStorageIndependent(method: string, url: string, result: Pick<DispatchResult, 'status' | 'headers'>): boolean {
  return SAFE_METHODS.has(method.toUpperCase()) || isDownload(result) || isSessionRequest(method, url);
}

/** The catalogue key of a storage failure, by the file it concerns (the server's own I/O messages). */
export function ioErrorKey(error: unknown): string {
  const path = String((error as { path?: unknown } | null)?.path ?? (error as Error | null)?.message ?? '');
  if (path.includes('accounts.json')) return 'server.auth.accountsFileUnwritable';
  if (path.includes('sessions.json')) return 'server.auth.sessionsFileUnwritable';
  return 'server.vault.writeFailed';
}

/** A `DispatchResult` as the host protocol carries it (bytes in a buffer of their own: it is transferred). */
export function toCoreResponse(id: number, result: DispatchResult): CoreResponse {
  const response: CoreResponse = { type: 'response', id, status: result.status, headers: result.headers };
  if (typeof result.body === 'string') response.bodyText = result.body;
  else if (result.body) {
    const exact =
      result.body.byteOffset === 0 && result.body.byteLength === result.body.buffer.byteLength && result.body.buffer instanceof ArrayBuffer
        ? result.body.buffer
        : result.body.slice().buffer;
    response.bodyBytes = exact as ArrayBuffer;
  }
  return response;
}

/** The body the host gave us as the shim's request body. */
function requestBody(request: CoreRequest): string | Uint8Array | undefined {
  if (request.bodyBytes !== undefined) return new Uint8Array(request.bodyBytes);
  return request.bodyText;
}

/** 500 IO `{ code, message }` in the language of the request (Accept-Language, else English). */
export function ioFailureResponse(id: number, headers: CoreHeaders, error: unknown): CoreResponse {
  const locale = localeFromHeader(headers['accept-language']);
  // The vault reports its own I/O error ('server.vault.writeFailed', ...); the VFS a Node-style one.
  const failure = error instanceof ApiError && error.code === 'IO' ? error : ApiError.io(ioErrorKey(error));
  const body = failure.toBody(locale);
  return { type: 'response', id, status: 500, headers: { 'content-type': 'application/json; charset=utf-8' }, bodyText: JSON.stringify(body) };
}

export async function bootCore(options: CoreBootOptions): Promise<DiaryCore> {
  const log = options.log ?? defaultLog;
  const emit = options.onEvent ?? (() => undefined);

  // 1. The file system of the server code.
  const vfs = new Vfs({ backend: options.storage, dataRoot: CORE_DATA_DIR, assetsRoot: CORE_ASSETS_VIRTUAL_DIR, log });
  installVfs(vfs);
  // The server modules run on the Buffer polyfill (also under vitest): the facade must answer with it.
  installBufferClass(PolyfillBuffer);

  // 2. The assets the host fetched.
  registerCoreAssets(vfs, options.assets, CORE_ASSETS_VIRTUAL_DIR);

  // 3. Recovery + preload of what is stored.
  await vfs.boot();

  // 4. The configuration with virtual paths (creates /data/users).
  const config = loadConfig(['--data-dir', CORE_DATA_DIR, '--assets', CORE_ASSETS_VIRTUAL_DIR], {});

  // 5. The services, as server.ts composes them.
  const authOptions: AuthServiceOptions = { ...(options.now ? { now: options.now } : {}), ...options.auth };
  const auth = await createAuthService(config, authOptions);
  const deviceKey = loadOrCreateDeviceKey(config.deviceKeyFile);
  const firstAccount = () => firstAccountId(auth.listAccounts());
  const mail = new MailService({
    config,
    deviceKey,
    firstAccountId: firstAccount,
    transport: options.mailTransport ?? stubMailTransport,
    options: { log: (line) => log('info', line), ...(options.now ? { now: options.now } : {}) },
  });
  const passwordReset = new PasswordResetService(auth, mail, {
    log: (line) => log('info', line),
    ...(options.now ? { now: options.now } : {}),
    ...options.passwordReset,
  });
  const startedAt = (options.now ? options.now() : new Date()).toISOString();

  // Mail settings whose owner account is gone are forgotten; unowned ones become the first account's.
  const mailOwner = mail.ownerId();
  if (mailOwner && !auth.listAccounts().some((a) => a.id === mailOwner)) mail.releaseOwner(mailOwner);
  mail.checkOwner();

  // 6. The app.
  const app = createMobileApp({
    config,
    auth,
    getServerSettings: () => ({ ...MOBILE_SERVER_SETTINGS }),
    setServerSettings: async () => ({ ...MOBILE_SERVER_SETTINGS }),
    getListenInfo: () => ({ port: 0, lanUrls: [], startedAt }),
    guestAllowed: true,
    mail,
    passwordReset,
  });

  const describe = (error: unknown): string => (error as Error | null)?.message ?? String(error);

  /** `drain()` with one retry; the error of the second failure. */
  async function drainTwice(): Promise<unknown> {
    try {
      await vfs.drain();
      return null;
    } catch (first) {
      log('warn', `storage drain failed, retrying: ${describe(first)}`);
      try {
        await vfs.drain();
        return null;
      } catch (second) {
        return second ?? first;
      }
    }
  }

  /** Encrypts and writes `vaults` now, with one retry; the error of the second failure. */
  async function persistTwice(vaults: DiaryVault[]): Promise<unknown> {
    const run = (): Promise<unknown> => Promise.all(vaults.map((vault) => vault.persistIfDirty()));
    try {
      await run();
      return null;
    } catch (first) {
      log('warn', `a diary could not be stored, retrying: ${describe(first)}`);
      try {
        await run();
        return null;
      } catch (second) {
        return second ?? first;
      }
    }
  }

  let stopped = false;

  // What a request changed ------------------------------------------------------
  // Requests run concurrently, so "changed while the request ran" may include the change of
  // another request: that errs on the safe side (an answer too many waits for the storage).

  /** Every stored file by its path, with the mirror's own array: a write replaces the array. */
  function storedFiles(): Map<string, Uint8Array> {
    const files = new Map<string, Uint8Array>();
    const walk = (dir: string): void => {
      for (const entry of vfs.readdir(dir)) {
        const path = `${dir}/${entry.name}`;
        if (entry.kind === 'dir') walk(path);
        else files.set(path, vfs.readFile(path));
      }
    };
    walk(CORE_DATA_DIR);
    return files;
  }

  /** Storage paths of the files that were written, created or deleted since `before` was taken. */
  function changedFiles(before: Map<string, Uint8Array>): string[] {
    const now = storedFiles();
    const changed: string[] = [];
    for (const [path, bytes] of now) if (before.get(path) !== bytes) changed.push(path);
    for (const path of before.keys()) if (!now.has(path)) changed.push(path);
    return changed.map((path) => path.slice(CORE_DATA_DIR.length + 1));
  }

  /** The open diaries that are stored in a file (a guest's lives in memory only), by account id. */
  function openDiaries(): Map<string, DiaryVault> {
    const open = new Map<string, DiaryVault>();
    for (const account of auth.accounts.list()) {
      const vault = auth.vaults.get(account.id);
      if (vault && !vault.memoryOnly) open.set(account.id, vault);
    }
    return open;
  }

  function diarySequences(): Map<string, number> {
    return new Map([...openDiaries()].map(([id, vault]) => [id, vault.db.writeSequence]));
  }

  /** The diaries written to since `before` was taken that still wait for their save. */
  function unsavedDiaries(before: Map<string, number>): DiaryVault[] {
    return [...openDiaries()].filter(([id, vault]) => vault.db.isDirty() && before.get(id) !== vault.db.writeSequence).map(([, vault]) => vault);
  }

  // The state of the storage ------------------------------------------------------

  const retryMs = Math.max(1, options.storageRetryMs ?? STORAGE_RETRY_MS);
  /** True from a change the storage refused until everything is stored again. */
  let storageFailing = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retries = 0;

  /** Stores what is only in memory: the unsaved diaries, the files out of sync. True when nothing is left. */
  async function storeEverything(): Promise<boolean> {
    try {
      await auth.vaults.persistAll();
      await vfs.drain();
      return vfs.outOfSync().length === 0;
    } catch {
      return false;
    }
  }

  function scheduleRetry(delay = Math.min(retryMs * 2 ** retries, Math.max(retryMs, STORAGE_RETRY_MAX_MS))): void {
    if (stopped) return;
    if (retryTimer !== null) clearTimeout(retryTimer);
    const timer = setTimeout(() => {
      if (retryTimer !== timer) return;
      retryTimer = null;
      retries++;
      void storeEverything().then((stored) => {
        if (stopped || !storageFailing) return;
        if (stored) storageRecovered();
        else if (retryTimer === null) scheduleRetry();
      });
    }, delay);
    retryTimer = timer;
    // Node (tests): a pending retry must not keep the process alive.
    (timer as { unref?: () => void }).unref?.();
  }

  /** Something could not be stored: tell the host (once) and keep trying in the background. */
  function storageFailed(): void {
    if (!storageFailing) {
      storageFailing = true;
      retries = 0;
      log('error', 'the storage refused a change: what was changed is in memory only; reading and exporting go on, the core keeps trying');
      emit({ type: 'event', name: 'storage-failed' });
    }
    if (retryTimer === null) scheduleRetry();
  }

  function storageRecovered(): void {
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
    if (!storageFailing) return;
    storageFailing = false;
    log('warn', 'the storage accepts changes again: everything is stored');
    emit({ type: 'event', name: 'storage-recovered' });
  }

  /**
   * Writes sessions.json only when there is something to write: the file already exists (a
   * removed or locked remember-me session must reach it) or a remember-me session of a real
   * account is in memory. A guest - whose session is never persisted - must not leave even an
   * empty sessions file behind (docs/ANDROID-PLAN.md 3.3: a guest writes nothing to the disk).
   */
  function persistSessionsIfMeaningful(): void {
    const remembered = auth.listAccounts().some((account) => auth.listSessions(account.id).some((s) => s.rememberMe && !s.guest));
    if (remembered || vfs.exists(auth.sessions.file)) auth.sessions.persist();
  }

  /**
   * The VFS reports the failure of a write nobody waited for once more: as an EIO of the NEXT write
   * of that file (that is how the synchronous writers of the server learn of it, as on a desktop
   * with a full disk). For the bookkeeping files of a session request that report must not fail
   * the unlock or the sign-in of a full phone - the host was told already (`storage-failed`) - so
   * it is taken here: an exclusive create of a file that exists changes nothing and always throws,
   * the pending failure first.
   */
  function takeReportedFailures(): void {
    for (const file of [config.sessionsFile, config.accountsFile]) {
      if (!vfs.exists(file)) continue;
      try {
        vfs.writeFile(file, new Uint8Array(0), 'wx');
      } catch {
        /* EEXIST, or the failure that was pending - either way nothing changed */
      }
    }
  }

  async function handle(request: CoreRequest): Promise<CoreAnswer> {
    if (storageFailing && isSessionRequest(request.method, request.url)) takeReportedFailures();
    const filesBefore = storedFiles();
    const diariesBefore = diarySequences();
    const result = await dispatch(app, {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: requestBody(request),
    });
    const independent = isStorageIndependent(request.method, request.url, result);

    /** Why a change of this request is not in the storage (null: all of it is, or it made none). */
    let failure: unknown = null;
    /** Anything at all - this request's or not - is known not to be stored. */
    let unsettled = false;

    // 1. The diaries this request wrote to: saved now, not 250 ms after the answer.
    if (!independent) {
      const unsaved = unsavedDiaries(diariesBefore);
      if (unsaved.length) failure = await persistTwice(unsaved);
      unsettled = failure !== null;
    }

    // 2. The files. While the storage is known to refuse changes, a request that changed nothing
    //    does not wait for it again (the retry in the background looks after it).
    const changed = changedFiles(filesBefore);
    if (changed.length || !storageFailing) {
      const drainFailure = await drainTwice();
      if (drainFailure) {
        unsettled = true;
        const outOfSync = new Set(vfs.outOfSync());
        if (changed.some((path) => outOfSync.has(path))) failure ??= drainFailure;
      } else if (storageFailing && !unsettled && changed.length) {
        // A change went through: the storage may be back - look now instead of at the next retry.
        retries = 0;
        scheduleRetry(0);
      }
    }
    if (unsettled) storageFailed();

    const path = request.url.split('?')[0];
    const events: CoreEvent[] = [];
    // The change is in memory whatever the storage said: the reminders follow what the app shows.
    if (changesHabits(request.method, request.url, result.status)) events.push({ type: 'event', name: 'habits-changed', userId: '' });
    if (failure && !independent && result.status < 400) {
      log('error', `request ${request.method} ${path} answered 500 IO: the storage refused its change`);
      return { response: ioFailureResponse(request.id, request.headers, failure), events };
    }
    if (unsettled) log('warn', `request ${request.method} ${path} answered ${result.status} while the storage refuses changes`);
    return { response: toCoreResponse(request.id, result), events };
  }

  async function flushAll(): Promise<void> {
    let failure: unknown = null;
    try {
      await auth.vaults.persistAll();
    } catch (e) {
      failure = e;
    }
    try {
      persistSessionsIfMeaningful();
    } catch (e) {
      failure ??= e;
    }
    try {
      await vfs.drain();
    } catch (e) {
      failure ??= e;
    }
    if (failure) {
      storageFailed();
      throw failure;
    }
    storageRecovered();
  }

  /**
   * Locks every session of every real account. Each one is locked in memory whatever the storage
   * does (the flag is set before sessions.json is written); the promise rejects when the lock could
   * not be STORED - after a restart those sessions would come back unlocked - and the core keeps
   * trying to store it.
   */
  async function lockAll(): Promise<void> {
    let failure: unknown = null;
    if (storageFailing) takeReportedFailures();
    for (const account of auth.listAccounts()) {
      for (const session of auth.listSessions(account.id)) {
        if (session.guest || session.locked) continue;
        try {
          auth.setSessionLocked(session.id, true);
        } catch (e) {
          // Only the file is behind: the next session must be locked all the same.
          failure ??= e;
        }
      }
    }
    try {
      persistSessionsIfMeaningful();
    } catch (e) {
      failure ??= e;
    }
    try {
      await vfs.drain();
    } catch (e) {
      failure ??= e;
    }
    if (failure) {
      storageFailed();
      throw failure;
    }
  }

  async function shutdown(): Promise<void> {
    if (stopped) return;
    stopped = true;
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
    await auth.shutdown();
    await vfs.drain();
  }

  // Everything the start-up wrote (device.key, users/, a sessions file without its expired
  // sessions) is in the storage before the core is ready. A storage that could be read but refuses
  // those writes (it is full) does not stop the start: the diary can still be opened, read, exported
  // and backed up - the failure is reported like any later one, and retried.
  const bootFailure = await drainTwice();
  if (bootFailure) {
    log('error', `the storage refused what the start-up wrote: ${describe(bootFailure)}`);
    storageFailed();
  }

  return { app, vfs, config, auth, mail, passwordReset, startedAt, handle, flushAll, lockAll, shutdown };
}
