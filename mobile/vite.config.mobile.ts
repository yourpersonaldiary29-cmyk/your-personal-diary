/**
 * Vite configuration of the Android (Capacitor) build - `npm run mobile:build` / `npm run mobile:dev`.
 *
 * Same React UI and aliases as the desktop build (../vite.config.ts); the differences:
 *  - root is mobile/ (its own index.html with the WebView CSP and the start-up splash),
 *  - `__MOBILE__` is true, so src/main.tsx starts the mobile host (mobile/host) before it renders,
 *  - the output goes to ../mobile-dist (the `webDir` of capacitor.config.ts).
 *
 * TWO BUILD MODES from this one file (`mobileBuildMode()`):
 *
 *  'server' (the DEFAULT - the published app; docs/android-tasks/HOSTED-IMPL.md item 8): a thin
 *    client of the Your Personal Diary server. `__MOBILE_LOCAL_CORE__` is `false`, so the branch of
 *    src/main.tsx that boots the in-process diary core - and with it mobile/host/boot.ts, the inline
 *    core worker and everything of mobile/core - is dead code and leaves no chunk in the bundle; the
 *    boot-time assets of the core (the SQLite wasm, the PDF fonts) are not emitted either. The CSP of
 *    the page gets the fixed origin of the server in `connect-src` (from src/config/server-default.json,
 *    at build time: the host is spelled nowhere else) and loses what only the core needs
 *    (`'wasm-unsafe-eval'`, `blob:` workers - mobile/dev-server-csp.ts `serverBuildCsp`).
 *    Start-up: mobile/host/server-mode.ts.
 *
 *  'local-core' (`MOBILE_LOCAL_CORE=1` in the environment - the developer / test configuration,
 *    kept for a future offline mode): the app as it was before hosted mode. `__MOBILE_LOCAL_CORE__`
 *    is `true`, the diary core worker (mobile/core/worker.ts, inline in the UI bundle) is built with
 *    the alias plugin (mobile/core/alias-plugin.ts) under `worker.plugins` - the server code gets its
 *    Node shims and the express shim there, and only there - the core assets are copied into
 *    `mobile-dist/core-assets/` (served from the same place by the dev server), where
 *    mobile/host/assets.ts fetches them, and the CSP stays `connect-src 'self'`.
 *    The dev server (`npm run mobile:dev`) then runs the core as an unbundled module worker, so it
 *    needs two things the bundler does by itself in the build: the two CommonJS vendor bundles of
 *    the core (sql.js, pdfkit) wrapped as ES modules, and the core's packages pre-bundled.
 *
 * mobile/test/desktop-dist-clean.test.ts builds both modes and checks what each one contains.
 */
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparablePath, mobileCoreAlias, VENDOR_FILES } from './core/alias-plugin';
import { relaxCspForDevServer, serverBuildCsp } from './dev-server-csp';
import { CORE_ASSETS_DIR, CORE_FONT_FILES, CORE_FONTS_DIR, CORE_SQL_WASM_FILE } from './shared/transport';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');

/** The `express` of the core (mobile/core/express-shim); the same path is given to vitest (vitest.config.ts). */
export const EXPRESS_SHIM = path.resolve(here, 'core', 'express-shim', 'index.ts');

/** The environment variable that selects the local-core build (`1`); anything else is the server build. */
export const LOCAL_CORE_ENV = 'MOBILE_LOCAL_CORE';

export type MobileBuildMode = 'server' | 'local-core';

/** Which of the two builds this is (see the module comment). */
export function mobileBuildMode(env: NodeJS.ProcessEnv = process.env): MobileBuildMode {
  return env[LOCAL_CORE_ENV] === '1' ? 'local-core' : 'server';
}

/** Where the clients' default server address lives (scripts/check-no-network.mjs rule 5: the ONE place). */
export const SERVER_DEFAULT_FILE = path.join(projectRoot, 'src', 'config', 'server-default.json');

/**
 * The origin of the Your Personal Diary server for the CSP of the server build, read from
 * src/config/server-default.json (`{"url": "https://<host>"}`) - the same file src/config/server-default.ts
 * imports, validated the same way (https, a bare host, no path), so the page can only ever name the
 * host the API client is wired to.
 */
export function defaultServerOrigin(file: string = SERVER_DEFAULT_FILE): string {
  let url: unknown;
  try {
    url = (JSON.parse(fs.readFileSync(file, 'utf8')) as { url?: unknown }).url;
  } catch (e) {
    throw new Error(`${file}: cannot read the default server address: ${(e as Error).message}`);
  }
  if (typeof url !== 'string' || url.trim() === '') throw new Error(`${file}: "url" must be a non-empty string`);
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error(`${file}: "url" is not a valid URL`);
  }
  if (parsed.protocol !== 'https:' || (parsed.pathname !== '/' && parsed.pathname !== '') || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error(`${file}: "url" must be https://<host> with no path, query, fragment or credentials`);
  }
  return parsed.origin;
}

/**
 * Build of the server mode: the fixed server origin goes into `connect-src` of the page, and the
 * sources only the in-process core needs leave it (`serverBuildCsp`). Not applied
 * by the dev server (its page is a browser tab, never the installed app; it talks to a loopback test
 * server through `VITE_API_BASE`, see `devServerCsp`).
 */
function serverOriginCsp(origin: string): Plugin {
  return {
    name: 'mobile-server-origin-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return serverBuildCsp(html, origin);
      },
    },
  };
}

/**
 * Dev server only: Vite's React plugin injects an inline preamble script and HMR uses a WebSocket,
 * both of which the strict CSP of index.html forbids. The built app keeps the strict CSP.
 * The rewrite (./dev-server-csp.ts) edits the CSP <meta> tag itself, not other text of the page.
 */
function devServerCsp(): Plugin {
  return {
    name: 'mobile-dev-server-csp',
    apply: 'serve',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return relaxCspForDevServer(html, process.env.VITE_API_BASE);
      },
    },
  };
}

/** Source file of each core asset, keyed by its path below `core-assets/`. */
export function coreAssetSources(root: string = projectRoot): Record<string, string> {
  const sources: Record<string, string> = {
    [CORE_SQL_WASM_FILE]: path.join(root, 'server', 'node_modules', 'sql.js', 'dist', 'sql-wasm-browser.wasm'),
  };
  for (const name of CORE_FONT_FILES) sources[`${CORE_FONTS_DIR}/${name}`] = path.join(root, 'src-tauri', 'resources', 'server', 'fonts', name);
  return sources;
}

const ASSET_TYPES: Record<string, string> = { '.wasm': 'application/wasm', '.ttf': 'font/ttf' };

/**
 * Local-core build only: ships the boot-time assets of the core as web assets - in the build they
 * are emitted under `core-assets/` next to the UI; the dev server serves the source files at the
 * same URLs.
 */
function coreAssets(): Plugin {
  const sources = coreAssetSources();
  const missing = Object.values(sources).filter((file) => !fs.existsSync(file));
  return {
    name: 'mobile-core-assets',
    buildStart() {
      if (missing.length) this.error(`core assets missing (run npm install in server/ and check src-tauri/resources/server/fonts): ${missing.join(', ')}`);
    },
    generateBundle() {
      for (const [relative, file] of Object.entries(sources)) {
        this.emitFile({ type: 'asset', fileName: `${CORE_ASSETS_DIR}/${relative}`, source: fs.readFileSync(file) });
      }
    },
    configureServer(server) {
      const prefix = `/${CORE_ASSETS_DIR}/`;
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (!url.startsWith(prefix)) return next();
        const file = sources[decodeURIComponent(url.slice(prefix.length))];
        if (!file || !fs.existsSync(file)) {
          res.statusCode = 404;
          res.end('not a core asset');
          return;
        }
        res.setHeader('Content-Type', ASSET_TYPES[path.extname(file)] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

/** The alias plugin for the worker, applied by the dev server to the whole pipeline (see below). */
function coreAliasForDevServer(): Plugin {
  // In development the inline worker is served as a module worker through the main pipeline, not
  // through `worker.plugins`; the alias plugin must therefore see the worker's modules there too.
  // It only touches importers under server/src, shared/ and the shims, never the UI.
  return { ...mobileCoreAlias({ projectRoot, modules: { express: EXPRESS_SHIM } }), apply: 'serve' };
}

/**
 * A CommonJS / UMD bundle as an ES module whose default export is its `module.exports`: the code
 * runs inside a function that gives it `module` and `exports` (and no AMD `define`), the way a
 * bundler wraps a CommonJS module.
 */
export function commonJsAsEsModule(code: string): string {
  return [
    'const module = { exports: {} };',
    '(function (module, exports, define) {',
    code,
    '}).call(module.exports, module, module.exports, undefined);',
    'export default module.exports;',
    '',
  ].join('\n');
}

/** The vendor bundles of the core (alias-plugin.ts, VENDOR_FILES) as comparable absolute paths. */
export function vendorBundlePaths(root: string = projectRoot): Set<string> {
  return new Set(Object.values(VENDOR_FILES).map((relative) => comparablePath(path.resolve(root, relative))));
}

/**
 * Dev server only: the core's two vendor bundles (the browser builds of sql.js and pdfkit in
 * server/node_modules) are CommonJS / UMD files. The build converts them while it bundles the
 * worker; the dev server would hand them to the module worker as they are, and a module without
 * exports cannot be imported - the worker would fail to load and the splash would report that
 * the core did not start. They are reached by absolute path (the alias plugin), so Vite's
 * dependency optimizer never sees them; this wraps exactly those two files instead.
 */
function vendorBundlesForDevServer(): Plugin {
  const bundles = vendorBundlePaths();
  return {
    name: 'mobile-vendor-esm',
    apply: 'serve',
    transform(code, id) {
      if (!bundles.has(comparablePath(id))) return null;
      return { code: commonJsAsEsModule(code), map: null };
    },
  };
}

/**
 * The packages the core imports by name (mobile/core/shims, server/src/export/rtl.ts). Listed so
 * that the dev server pre-bundles them when it starts: found one by one while the worker loads,
 * each would restart the optimizer and fail the modules the worker is loading at that moment.
 * Dev server only - the build bundles them into the worker as before.
 */
export const CORE_DEV_DEPENDENCIES: readonly string[] = [
  'buffer/index.js',
  'path-browserify',
  '@noble/ciphers/aes.js',
  '@noble/hashes/scrypt.js',
  '@noble/hashes/sha2.js',
  'bidi-js',
];

const mode = mobileBuildMode();
const localCore = mode === 'local-core';

export default defineConfig({
  root: here,
  publicDir: path.resolve(projectRoot, 'public'),
  plugins: [
    react(),
    devServerCsp(),
    ...(localCore ? [coreAssets(), coreAliasForDevServer(), vendorBundlesForDevServer()] : [serverOriginCsp(defaultServerOrigin())]),
  ],
  optimizeDeps: {
    include: localCore ? [...CORE_DEV_DEPENDENCIES] : [],
  },
  define: {
    __MOBILE__: 'true',
    // 'false' makes the local-core branch of src/main.tsx (and the dynamic import of the whole core
    // behind it) dead code: no boot chunk, no worker, no core in the published bundle.
    __MOBILE_LOCAL_CORE__: localCore ? 'true' : 'false',
  },
  resolve: {
    alias: {
      '@shared': path.resolve(projectRoot, 'shared'),
      '@': path.resolve(projectRoot, 'src'),
    },
  },
  worker: {
    // The core is one self-contained script (it starts from a blob: URL and can request nothing).
    // Only the local-core build has a worker; the configuration is inert otherwise.
    format: 'iife',
    plugins: () => [mobileCoreAlias({ projectRoot, modules: { express: EXPRESS_SHIM } })],
  },
  clearScreen: false,
  server: {
    // Local only; the port comes from the npm script (1430, strict).
    host: '127.0.0.1',
    fs: {
      // The UI sources live outside this root (../src, ../shared).
      allow: [projectRoot],
    },
    watch: {
      ignored: ['**/src-tauri/**', '**/server/**', '**/mobile-dist/**', '**/android/**'],
    },
  },
  build: {
    outDir: path.resolve(projectRoot, 'mobile-dist'),
    emptyOutDir: true,
    target: 'es2021',
    sourcemap: false,
    // The local-core build's core alone is several MB (pdfkit, sql.js, 20 locales); the warning would only repeat that.
    chunkSizeWarningLimit: 6000,
  },
});
