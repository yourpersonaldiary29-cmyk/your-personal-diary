/**
 * Start-up of the LOCAL-CORE Android build - the developer / test configuration made with
 * `MOBILE_LOCAL_CORE=1` (mobile/vite.config.mobile.ts), kept for a future offline mode. The
 * published app is server-only and starts through mobile/host/server-mode.ts instead; src/main.tsx
 * reaches this module only when the build-time flag `__MOBILE_LOCAL_CORE__` is true, so nothing of
 * it - nor of the inline core worker it imports - is in the published bundle.
 *
 *  1. creates the diary core worker (mobile/host/core-worker.ts) - the splash of
 *     mobile/index.html is on screen meanwhile - and serves the storage to it at once
 *     (mobile/host/storage-rpc.ts), before anything else: the core's first act is to load its
 *     files through that channel. The storage is the app-private directory through
 *     @capacitor/filesystem inside the installed app; in a plain browser (`npm run mobile:dev`,
 *     a served `mobile-dist/`) it is memory only and the diary is lost when the page is closed -
 *     the console says so;
 *  2. fetches the boot-time assets (the SQLite wasm, the PDF fonts: mobile/host/assets.ts) and
 *     transfers them to the worker;
 *  3. waits until the core posts `ready`;
 *  4. installs the core transport, so every request of src/api/client.ts goes to the worker
 *     instead of `fetch`,
 *  5. starts the app (`start`: the same locale set-up + render as on the desktop) and removes
 *     the splash once the first screen had a frame to paint.
 *
 * If the core cannot start (no assets, a storage that cannot be opened, a boot failure reported
 * as `fatal`), the app is not rendered - nothing would work without the core: the splash stays
 * and shows a localised message.
 */
import { setApiTransport } from '@/api/client';
import { tr } from '@/i18n/runtime';
import { isNativeApp } from '@/utils/platform';
import type { StorageBackend } from '../shared/storage-protocol';
import type { CoreAssetBytes } from '../shared/transport';
import { loadCoreAssets } from './assets';
import { createCoreClient, type CoreClient, type CoreClientOptions, type CoreWorkerLike } from './core-client';
import { createCoreWorker } from './core-worker';
import { FRAME_FALLBACK_MS, hideSplash, nextFrame, showSplashError } from './splash';
import { serveStorage, type StorageServer } from './storage-rpc';
import { createCapacitorFilesystemStorage } from './storage/capacitor-filesystem';
import { MemoryStorage } from './storage/memory';

export interface BootOptions extends CoreClientOptions {
  /** Creates the core worker (tests pass a fake). */
  createWorker?: () => CoreWorkerLike;
  /** The storage of the core (tests pass a MemoryStorage). Default: see `chooseStorage`. */
  createStorage?: () => Promise<StorageBackend> | StorageBackend;
  /** Loads the boot-time assets (tests pass a fake). Default: fetch them from `core-assets/`. */
  loadAssets?: () => Promise<CoreAssetBytes>;
  /**
   * Installs the phone-native features (files, reminders, lock / lifecycle / back button -
   * mobile/platform) once the core is ready and before the app renders. Default: inside the
   * installed app only (`isNativeApp()`); nothing in a browser. Tests pass a fake.
   */
  installPlatform?: (client: CoreClient) => Promise<unknown>;
}

/** The default `installPlatform`: the native features, loaded on demand, inside the installed app only. */
async function installNativePlatform(client: CoreClient): Promise<void> {
  if (!isNativeApp()) return;
  const { installPhonePlatform } = await import('../platform');
  // The core client is the host of the phone features here (mobile/platform PlatformHost).
  await installPhonePlatform({ host: { transport: client.coreFetch, onEvent: (listener) => client.onEvent(listener), control: (action) => client.control(action) } });
}

export { FRAME_FALLBACK_MS };

let activeClient: CoreClient | null = null;
let activeStorage: StorageServer | null = null;

/** The core client of the running app (null before the core is ready). */
export function getCoreClient(): CoreClient | null {
  return activeClient;
}

/** What the console says in a browser, where nothing is persisted. */
export const MEMORY_STORAGE_NOTICE = '[mobile] browser mode: the diary core keeps its files in memory only - nothing is persisted; close the page and it is gone.';

/**
 * The storage of the running app: the app-private directory inside the installed app; memory
 * only in a plain browser (development), where the console says so.
 */
export async function chooseStorage(): Promise<StorageBackend> {
  if (isNativeApp()) return createCapacitorFilesystemStorage();
  console.info(MEMORY_STORAGE_NOTICE);
  return new MemoryStorage();
}

/**
 * Boots the mobile host and then calls `start`. Never rejects: resolves true when the app was
 * started, false when the core could not start (the splash then shows the failure).
 */
export async function bootMobile(start: () => unknown, options: BootOptions = {}): Promise<boolean> {
  let client: CoreClient | null = null;
  let storageServer: StorageServer | null = null;
  try {
    const worker = (options.createWorker ?? createCoreWorker)();
    client = createCoreClient(worker, options);
    // The storage is served before the core is awaited: its boot reads the files through it.
    const backend = await (options.createStorage ?? chooseStorage)();
    storageServer = serveStorage(worker, backend);
    const assets = await (options.loadAssets ?? loadCoreAssets)();
    client.sendAssets(assets);
    await client.ready;
  } catch (e) {
    storageServer?.dispose();
    client?.dispose();
    console.error('[mobile] the diary core did not start', e);
    showSplashError(tr('shell.serverNotStarted'));
    return false;
  }
  activeClient = client;
  activeStorage = storageServer;
  setApiTransport(client.coreFetch);
  // The phone features before the first render: the settings cards and the restore card read their
  // seams when they mount. A failure here must not stop the app - the diary works without them.
  try {
    await (options.installPlatform ?? installNativePlatform)(client);
  } catch (e) {
    console.error('[mobile] the phone features did not install', e);
  }
  try {
    await start();
    await nextFrame();
  } catch (e) {
    console.error('[mobile] the app did not start', e);
  } finally {
    hideSplash();
  }
  return true;
}

/** For tests: forgets the booted core and restores the default transport. */
export function __resetMobileBootForTests(): void {
  activeStorage?.dispose();
  activeStorage = null;
  activeClient?.dispose();
  activeClient = null;
  setApiTransport(null);
}
