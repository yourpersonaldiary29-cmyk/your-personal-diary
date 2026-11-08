/**
 * Entry point of the local diary server.
 *
 *   node server.cjs --data-dir <dir> [--port 47321] [--static <distDir>] [--assets <dir>]
 *
 * End-to-end tests may point remote access at local mocks with MPD_ACME_DIRECTORY,
 * MPD_DUCKDNS_BASE, MPD_UPNP_SSDP and MPD_REMOTE_TLS_HOST (loopback only - remote/env-overrides.ts),
 * and the mail sending at a local mock SMTP server with MPD_SMTP_CONNECT_HOST + MPD_SMTP_CA_FILE
 * (loopback only - mail/env-overrides.ts).
 *
 * See `server.ts` for the lifecycle and `app.ts` for the HTTP API.
 */
import { loadConfig } from './config';
import { mailOverridesFromEnv } from './mail/env-overrides';
import { remoteOverridesFromEnv } from './remote/env-overrides';
import { emit, startServer } from './server';
import { isMainModule } from './util/paths';

export { startServer } from './server';

// `import.meta.url` is only used in ESM (tsx/vitest); the CJS bundle relies on require.main.
if (isMainModule(typeof __filename === 'string' ? undefined : import.meta.url)) {
  const config = loadConfig();
  // Test overrides of the remote-access endpoints (loopback targets only; none in normal use).
  const overrides = remoteOverridesFromEnv(process.env);
  for (const note of overrides.notes) console.error(`[diary-server] ${note}`);
  // The same for the mail sending (a local mock SMTP server; loopback only).
  const mailOverrides = mailOverridesFromEnv(process.env);
  for (const note of mailOverrides.notes) console.error(`[diary-server] ${note}`);
  startServer(config, { remote: overrides.options, mail: mailOverrides.options })
    .then((running) => {
      let stopping = false;
      const shutdown = () => {
        if (stopping) return;
        stopping = true;
        running.stop().finally(() => process.exit(0));
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      process.on('SIGHUP', shutdown);
      // The desktop shell passes --parent-pid <pid>: we poll that process every 2 seconds and
      // stop when it is gone, so no orphaned server survives a crash or a forced close of the UI.
      // (Tauri's sidecar stdin is not a lifeline - it is closed right after spawn - so the pid
      // check is the reliable signal.)
      const parentIdx = process.argv.indexOf('--parent-pid');
      const parentPid = parentIdx >= 0 ? Number(process.argv[parentIdx + 1]) : NaN;
      if (Number.isInteger(parentPid) && parentPid > 0) {
        const watchdog = setInterval(() => {
          try {
            process.kill(parentPid, 0); // signal 0 = existence check only
          } catch (e) {
            // ESRCH: the parent is gone. EPERM would mean it exists but is not ours - keep running.
            if ((e as NodeJS.ErrnoException).code !== 'EPERM') {
              clearInterval(watchdog);
              emit('parent-gone', { parentPid });
              shutdown();
            }
          }
        }, 2000);
        watchdog.unref();
      }
      // Optional explicit stdin lifeline for manual runs (`node server.cjs ... --stdin-lifeline`).
      if (process.argv.includes('--stdin-lifeline')) {
        process.stdin.on('end', shutdown);
        process.stdin.on('close', shutdown);
        process.stdin.on('error', () => {});
        try {
          process.stdin.resume();
        } catch {
          /* no stdin */
        }
      }
    })
    .catch((e: unknown) => {
      emit('fatal', { message: (e as Error).message });
      console.error(e);
      process.exit(1);
    });
}
