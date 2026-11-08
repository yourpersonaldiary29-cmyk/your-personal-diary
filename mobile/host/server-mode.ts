/**
 * Start-up of the PUBLISHED Android build - the server-only app (docs/android-tasks/HOSTED-IMPL.md
 * item 8). Called by src/main.tsx when `__MOBILE__` is true and `__MOBILE_LOCAL_CORE__` is not:
 *
 *  1. installs the phone-native features (files, reminders, lock / lifecycle / back button, privacy
 *     screen, system bars - mobile/platform) inside the installed app only (`isNativeApp()`), on a
 *     `PlatformHost` that has no diary core: the API transport stays `fetch` (the requests go to the
 *     Your Personal Diary server, src/api/client.ts - its API base is the fixed server address of
 *     src/config/server-default.ts), there are no core events, and the two control actions become
 *     what they mean on a server: "lock everything when I leave the app" is `POST /api/auth/lock`
 *     of the signed-in session, "flush everything" is nothing - the device holds no diary data;
 *  2. starts the app (`start`: the same locale set-up + render as on the desktop) and removes the
 *     splash of mobile/index.html once the first screen had a frame to paint. Whether the server can
 *     be reached is the app's business from here on: the ConnectionProvider shows the "no connection
 *     to the diary server" page with Retry; the splash never waits for the network.
 *
 * Nothing here imports mobile/host/boot.ts, mobile/host/core-worker.ts or mobile/core: this module is
 * what keeps the core out of the published bundle (mobile/test/desktop-dist-clean.test.ts).
 */
import { auth as authApi } from '@/api';
import { getToken, isApiClientError, type ApiTransport } from '@/api/client';
import { isNativeApp } from '@/utils/platform';
import type { PlatformHost } from '../platform';
import { hideSplash, nextFrame } from './splash';

export interface ServerModeOptions {
  /**
   * Installs the phone-native features before the app renders. Default: inside the installed app
   * only (`isNativeApp()`), on `serverHost()`; nothing in a browser. Tests pass a fake.
   */
  installPlatform?: (host: PlatformHost) => Promise<unknown>;
}

/** The default transport of src/api/client.ts, spelled out: `fetch` looked up per call (the network guard applies). */
const fetchTransport: ApiTransport = (url, init) => fetch(url, init);

/** No core, no events: the reminders re-plan from what the transport sees (mobile/platform/index.ts). */
function noEvents(): () => void {
  return () => undefined;
}

/**
 * The host of the phone features in server mode. `lockAll` locks the signed-in session on the
 * server (the lock screen was shown by the lifecycle already); nobody signed in means nothing to
 * lock, and a guest - whose tour the server refuses to lock (403: no password could unlock it) -
 * is not an error. `flushAll` resolves at once: nothing is held on the device.
 */
export function serverHost(): PlatformHost {
  return {
    transport: fetchTransport,
    onEvent: noEvents,
    async control(action) {
      if (action === 'flushAll') return;
      if (!getToken()) return;
      try {
        await authApi.lock();
      } catch (e) {
        if (isApiClientError(e) && e.status === 403) return;
        throw e;
      }
    },
  };
}

/** The default `installPlatform`: the native features, loaded on demand, inside the installed app only. */
async function installNativePlatform(host: PlatformHost): Promise<void> {
  if (!isNativeApp()) return;
  const { installPhonePlatform } = await import('../platform');
  await installPhonePlatform({ host });
}

/**
 * Starts the server-mode app: the phone features first, then `start`, then the splash goes. Never
 * rejects - a failure of the phone features or of `start` is logged and the splash is removed all
 * the same, so a failure is never a blank screen that says nothing.
 */
export async function startServerMode(start: () => unknown, options: ServerModeOptions = {}): Promise<void> {
  // The phone features before the first render: the settings cards and the restore card read their
  // seams when they mount. A failure here must not stop the app - the diary works without them.
  try {
    await (options.installPlatform ?? installNativePlatform)(serverHost());
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
}
