/**
 * Where the published apps keep the diary: the Your Personal Diary server (docs/HOSTED-PLAN.md Part B,
 * docs/android-tasks/HOSTED-IMPL.md items 8-10). The Windows app and the Android app are SERVER-ONLY
 * thin clients: their API base is the ONE address below, baked in at build time, and nothing in the UI
 * can change it (no settings entry, no first-run question). The web UI served by that server keeps
 * talking to its own origin (API base ''), and local mode - a server on this computer or the in-process
 * core of the phone - stays reachable as the developer / test configuration only.
 *
 * The address lives in exactly one place, `./server-default.json` (`{"url": "https://<host>"}`), and
 * reaches the bundle through this import; scripts/check-no-network.mjs validates that file
 * (https, a bare host, no path) and refuses the host as a literal anywhere else in src/, shared/ or
 * mobile/. Never spell it out in code or comments.
 *
 * Developer / test switches (none of them reachable from the UI):
 *  - `VITE_API_BASE=<origin>`     - the API base override (the Vite dev server, a test server);
 *  - `VITE_LOCAL_SERVER=1`        - the desktop's LOCAL-MODE build: the Tauri shell discovers the port
 *                                   of its local sidecar (`get_server_info`) instead of using the fixed
 *                                   server. Off in every published build (this is `__LOCAL_SERVER__` of
 *                                   HOSTED-IMPL item 8 spelt as a Vite env flag, so no define is needed);
 *  - `__MOBILE_LOCAL_CORE__`      - the Android build's LOCAL-CORE flag (a Vite `define` in
 *                                   mobile/vite.config.mobile.ts, default `false`): `true` boots the
 *                                   in-process diary core worker (mobile/host/boot.ts) and routes the API
 *                                   client to it, as the app did before hosted mode. Off in the published
 *                                   build, so the core and its assets stay out of the APK; the code stays
 *                                   in the repository for a future offline mode (WP-H10).
 * Tests do not build: they call `__setApiBaseForTests()` (src/api/client.ts) or stub these.
 */
import serverDefault from './server-default.json';

/** What `./server-default.json` must contain. */
export interface ServerDefault {
  /** `https://<host>` - the origin of the server, no path. */
  url: string;
}

/**
 * Validates and normalises a server address: `https://<host>[:port]` with no path, query, fragment or
 * credentials (the only shape the audit accepts for the shipped default). Returns the origin, without a
 * trailing slash. Throws with a plain reason otherwise - at module load for the shipped file, so a bad
 * edit of server-default.json fails the build and every test, never a user.
 */
export function normalizeServerUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') throw new Error('server-default.json: "url" must be a non-empty string');
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error('server-default.json: "url" is not a valid URL');
  }
  if (parsed.protocol !== 'https:') throw new Error('server-default.json: "url" must start with https://');
  if ((parsed.pathname !== '/' && parsed.pathname !== '') || parsed.search || parsed.hash) {
    throw new Error('server-default.json: "url" must be https://<host> with no path, query or fragment');
  }
  if (parsed.username || parsed.password) throw new Error('server-default.json: "url" must carry no credentials');
  return parsed.origin;
}

/** The origin of the Your Personal Diary server the Windows and Android apps talk to (no trailing slash). */
export const DEFAULT_SERVER_URL: string = normalizeServerUrl((serverDefault as ServerDefault).url);

/** The host (with the port when not the default) of DEFAULT_SERVER_URL, for read-only display in Settings. */
export function defaultServerHost(): string {
  return new URL(DEFAULT_SERVER_URL).host;
}

/**
 * The Vite env of this build - `import.meta.env`, read as that exact expression so that Vite's static
 * replacement sees it (a build bakes the values in) and `vi.stubEnv()` reaches it under vitest; an empty
 * object outside Vite (the typed keys are declared in src/vite-env.d.ts).
 */
function viteEnv(): ImportMetaEnv | Record<string, string | undefined> {
  return import.meta.env ?? {};
}

/** The developer-only API base override (`VITE_API_BASE`), or null. Never reachable from the UI. */
export function developerApiBase(): string | null {
  const value = viteEnv().VITE_API_BASE;
  return typeof value === 'string' && value.trim() !== '' ? value.trim().replace(/\/+$/, '') : null;
}

/** True in a desktop build made with `VITE_LOCAL_SERVER=1`: the local-mode (sidecar) configuration for development and tests. */
export function isLocalServerBuild(): boolean {
  return viteEnv().VITE_LOCAL_SERVER === '1';
}

/**
 * True when this Android build carries the in-process diary core (`__MOBILE_LOCAL_CORE__` = true): then
 * src/main.tsx boots the core worker before the app (mobile/host/boot.ts) and the API base is '' (the core
 * transport answers). False in the published app, on the desktop and under the root vitest config, where
 * neither flag is defined. The Android agent defines the flag in mobile/vite.config.mobile.ts.
 */
export function shouldBootLocalCore(): boolean {
  return (
    typeof __MOBILE__ !== 'undefined' && __MOBILE__ === true && typeof __MOBILE_LOCAL_CORE__ !== 'undefined' && __MOBILE_LOCAL_CORE__ === true
  );
}
