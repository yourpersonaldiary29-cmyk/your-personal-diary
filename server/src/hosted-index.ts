/**
 * Entry point of the HOSTED server bundle (deploy/hosted/dist/server-hosted.cjs, built by
 * scripts/build-hosted.mjs). Everything comes from the environment (docs/HOSTED-PLAN.md 2.1):
 *
 *   DIARY_MODE=hosted            required - the only switch
 *   DIARY_PUBLIC_URL             required - https://<host> (the accepted Host; reset-link base)
 *   DIARY_EXTRA_HOSTS            optional - further accepted Host names, comma-separated (the owner's
 *                                own domain and its www; docs/android-tasks/DUCKDNS-HOST.md); the
 *                                reset links and ServerInfo.publicUrl keep DIARY_PUBLIC_URL
 *   DIARY_DATA_DIR               required - the mounted volume (/data); never a default location
 *   PORT (or DIARY_PORT)         listener port, default 8080; DIARY_BIND default 0.0.0.0
 *   DIARY_TRUST_PROXY            proxy hops, default 1; DIARY_CLIENT_IP_HEADER (fly-client-ip | x-forwarded-for)
 *   DIARY_OWNER_ID               the owner account (u_...); unset = owner cards off
 *   DIARY_REGISTRATION           open | invite | closed; DIARY_INVITE_CODE (secret) with invite
 *   DIARY_MAX_ACCOUNTS, DIARY_MAX_DIARY_BYTES, DIARY_VAULT_IDLE_MINUTES, DIARY_KDF_CONCURRENCY,
 *   DIARY_LOGIN_PER_MINUTE, DIARY_AUTH_GLOBAL_PER_MINUTE, DIARY_MIN_FREE_PCT, DIARY_LOG_LEVEL
 *   DIARY_MAX_GUESTS (20; 0 = no tour), DIARY_GUEST_MINUTES (30), DIARY_GUESTS_PER_HOUR (3)
 *                                the tour, POST /api/auth/guest (HOSTED-IMPL item 9)
 *   DIARY_DEVICE_KEY             secret - base64 of 32 bytes; replaces <dataDir>/device.key
 *   DIARY_DEBUG_ROUTES=1         staging only: /api/debug/proxy, /api/debug/crash
 *   DIARY_STATIC_DIR             the built UI; default: the `ui/` folder next to this bundle
 *   UV_THREADPOOL_SIZE=8         set by the container image before Node starts (5.4)
 *
 * The loopback-only mail override of the desktop (MPD_SMTP_CONNECT_HOST + MPD_SMTP_CA_FILE, a mock
 * SMTP server for tests) is honoured here too. This file never imports server/src/remote/**.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, loadHostedEnv, type HostedEnv } from './config';
import { emitHosted, startHosted } from './hosted';
import { mailOverridesFromEnv } from './mail/env-overrides';
import { bundleDir, isMainModule } from './util/paths';

export { startHosted } from './hosted';

function fatal(message: string): never {
  emitHosted('fatal', { message });
  console.error(`[diary-server] ${message}`);
  process.exit(1);
}

// `import.meta.url` is only used in ESM (tsx/vitest); the CJS bundle relies on require.main.
if (isMainModule(typeof __filename === 'string' ? undefined : import.meta.url)) {
  const argv = process.argv.slice(2);
  let env: HostedEnv;
  try {
    env = loadHostedEnv(process.env);
  } catch (e) {
    fatal((e as Error).message);
  }
  // A public server never falls back to a default data directory: the volume must be named.
  if (!process.env.DIARY_DATA_DIR && !argv.includes('--data-dir') && !argv.some((a) => a.startsWith('--data-dir='))) {
    fatal('DIARY_DATA_DIR is required in hosted mode (the mounted data volume, e.g. /data)');
  }
  const config = loadConfig(argv, process.env);
  if (!config.staticDir) {
    const ui = path.join(bundleDir(), 'ui');
    if (fs.existsSync(path.join(ui, 'index.html'))) config.staticDir = ui;
  }
  if (!process.env.UV_THREADPOOL_SIZE) {
    console.error('[diary-server] UV_THREADPOOL_SIZE is not set: Node uses 4 pool threads (the container image sets 8 - see docs/HOSTED-PLAN.md 5.4)');
  }
  const mailOverrides = mailOverridesFromEnv(process.env);
  for (const note of mailOverrides.notes) console.error(`[diary-server] ${note}`);
  startHosted(config, env, { mail: mailOverrides.options })
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
      // Optional explicit stdin lifeline (`--stdin-lifeline`, as the desktop entry has it): a
      // graceful stop on platforms without POSIX signals (the Windows smoke test of the bundle).
      if (argv.includes('--stdin-lifeline')) {
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
      emitHosted('fatal', { message: (e as Error).message });
      console.error(e);
      process.exit(1);
    });
}
