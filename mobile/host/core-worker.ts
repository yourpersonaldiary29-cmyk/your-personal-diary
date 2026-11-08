/**
 * Creates the Web Worker that runs the diary core (mobile/core/worker.ts: the server logic on the
 * express shim, the Node shims and the virtual file system).
 *
 * The worker is INLINE (`?worker&inline`): its code is part of the UI bundle and starts from a
 * blob: URL (CSP `worker-src 'self' blob:`), so no request for a worker script ever leaves the
 * page - the Android WebView does not route worker script requests through the app's asset
 * loader (docs/ANDROID-PLAN.md, section 2). The worker bundle is built with the alias plugin
 * (`worker.plugins` in mobile/vite.config.mobile.ts), which gives the server code its shims.
 */
import CoreWorker from '../core/worker?worker&inline';

export function createCoreWorker(): Worker {
  return new CoreWorker({ name: 'diary-core' });
}
