/**
 * Bundles the HOSTED server (docs/HOSTED-PLAN.md Part B, WP-H3) into one CommonJS file the
 * container image runs with plain Node, and copies the runtime assets next to it:
 *
 *   deploy/hosted/build/server-hosted.cjs   (esbuild bundle of server/src/hosted-index.ts)
 *   deploy/hosted/build/admin.cjs           (the operator tool, esbuild bundle of scripts/hosted/admin.ts -
 *                                            /app/admin.cjs in the image; audited: 127.0.0.1 only)
 *   deploy/hosted/build/sql-wasm.wasm       (sql.js WebAssembly)
 *   deploy/hosted/build/fonts/*.ttf         (PDF export; copied from src-tauri/resources/server/fonts)
 *   deploy/hosted/build/pdfkit-data/        (AFM files pdfkit may read for standard fonts)
 *   deploy/hosted/build/ui/                 (copy of dist/ - the web client served at "/")
 *   deploy/hosted/build/BUILD.json          ({ version, builtAt, entry, node })
 *
 * `deploy/hosted/build/` is the hand-over directory to the deploy package (WP-H4): its
 * scripts/hosted/stage-image.mjs reads `deploy/hosted/build/server-hosted.cjs` (one of its
 * HOSTED_BUNDLE_SOURCES) and assembles the image tree in deploy/hosted/dist/, which the Dockerfile
 * copies to /app and runs with `node /app/server-hosted.cjs`. This script never writes to
 * deploy/hosted/dist/. The complete tree in deploy/hosted/build/ also runs on its own
 * (`node deploy/hosted/build/server-hosted.cjs` with the hosted environment - the local smoke test).
 * The desktop bundle (scripts/build-server.mjs -> server.cjs) is untouched by this script.
 *
 * Post-build audit (plan 5.8): the bundle must not contain remote-access code or the Android shim.
 * The markers are the hosts and constants only server/src/remote/** uses - the DuckDNS update API
 * `www.duckdns.org`, the ACME directories, the SSDP multicast address - plus `express-shim`. (The
 * bare `duckdns.org` of the plan is not usable as a marker: the i18n catalogues of every bundle
 * mention `yourpersonaldiary.duckdns.org` in the remote-access help texts.) The list lives in
 * scripts/hosted/bundle-audit.mjs, shared with scripts/hosted/stage-image.mjs so both audits agree.
 *
 * Usage: node scripts/build-hosted.mjs [--no-ui] [--out <dir>]
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ADMIN_TOOL_FILE, adminBundleProblems, FORBIDDEN_BUNDLE_STRINGS, forbiddenStringsIn } from './hosted/bundle-audit.mjs';
import { staleUiFiles, staleUiMessage } from './hosted/ui-freshness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const serverDir = path.join(root, 'server');
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : path.join(root, 'deploy', 'hosted', 'build');
// esbuild and sql.js are dependencies of server/, not of the root package.
const require = createRequire(path.join(serverDir, 'package.json'));
const { build } = await import(pathToFileURL(require.resolve('esbuild')).href);

export const HOSTED_ENTRY = 'server-hosted.cjs';
/** Strings that must never appear in the hosted bundle (remote access, the Android shim) - the shared list. */
export const FORBIDDEN_STRINGS = FORBIDDEN_BUNDLE_STRINGS;

// A dist/ built before the last change of public/ (e.g. the privacy policy pages) is refused BEFORE
// anything is written, so the hand-over directory never mixes a new bundle with an old web client
// (scripts/hosted/ui-freshness.mjs).
const distDir = path.join(root, 'dist');
if (!args.includes('--no-ui') && existsSync(path.join(distDir, 'index.html'))) {
  const stale = staleUiFiles(path.join(root, 'public'), distDir);
  if (stale.length) {
    console.error(staleUiMessage('build-hosted', stale));
    process.exit(1);
  }
}

mkdirSync(outDir, { recursive: true });
const outfile = path.join(outDir, HOSTED_ENTRY);

await build({
  entryPoints: [path.join(serverDir, 'src', 'hosted-index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile,
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  alias: { '@shared': path.join(root, 'shared') },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});

// Audit: no remote-access code, no Android shim in the public server --------------------------
const found = forbiddenStringsIn(readFileSync(outfile, 'utf8'));
if (found.length) {
  rmSync(outfile, { force: true });
  console.error(`[build-hosted] FAILED: the hosted bundle contains ${found.join(', ')} - it must not import server/src/remote/** or the Android shim`);
  process.exit(1);
}

// The operator tool (docs/HOSTED-PLAN.md 3.10, 5.8 rule 4b): scripts/hosted/admin.ts -> admin.cjs next to
// the bundle; stage-image.mjs puts it at /app/admin.cjs. `__ADMIN_CLI__` makes the file run its command
// line when started with node (importing the source - the tests - runs nothing). Audited: it may address
// 127.0.0.1 only and load no other network module.
const adminOut = path.join(outDir, ADMIN_TOOL_FILE);
await build({
  entryPoints: [path.join(root, 'scripts', 'hosted', 'admin.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: adminOut,
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  define: { __ADMIN_CLI__: 'true' },
  logLevel: 'info',
});
const adminProblems = adminBundleProblems(readFileSync(adminOut, 'utf8'));
if (adminProblems.length) {
  rmSync(adminOut, { force: true });
  console.error(`[build-hosted] FAILED: ${ADMIN_TOOL_FILE} ${adminProblems.join('; ')}`);
  process.exit(1);
}

// sql.js wasm ------------------------------------------------------------------
cpSync(require.resolve('sql.js/dist/sql-wasm.wasm'), path.join(outDir, 'sql-wasm.wasm'));

// Fonts for PDF export (kept in the repo next to the desktop bundle) ---------------------------
const fontsDir = path.join(root, 'src-tauri', 'resources', 'server', 'fonts');
if (existsSync(fontsDir)) {
  rmSync(path.join(outDir, 'fonts'), { recursive: true, force: true });
  cpSync(fontsDir, path.join(outDir, 'fonts'), { recursive: true });
} else {
  console.warn('[build-hosted] fonts not found at src-tauri/resources/server/fonts - PDF export will fail');
}

// pdfkit standard-font metrics (only needed if a standard font is ever referenced) ----
try {
  const pdfkitPkg = path.dirname(require.resolve('pdfkit/package.json'));
  const dataDir = path.join(pdfkitPkg, 'js', 'data');
  if (existsSync(dataDir)) cpSync(dataDir, path.join(outDir, 'pdfkit-data'), { recursive: true });
} catch {
  /* optional */
}

// The web client ------------------------------------------------------------------------------
if (!args.includes('--no-ui')) {
  const dist = distDir;
  const uiDir = path.join(outDir, 'ui');
  if (existsSync(path.join(dist, 'index.html'))) {
    rmSync(uiDir, { recursive: true, force: true });
    cpSync(dist, uiDir, { recursive: true });
    console.log(`[build-hosted] copied UI from ${dist}`);
  } else {
    console.warn('[build-hosted] dist/index.html not found - run "npx vite build" first; the web client will be missing');
  }
}

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
writeFileSync(
  path.join(outDir, 'BUILD.json'),
  JSON.stringify({ version: pkg.version ?? '0.0.0', builtAt: new Date().toISOString(), entry: HOSTED_ENTRY, node: process.version, mode: 'hosted' }, null, 2) + '\n',
);

const size = statSync(outfile).size;
console.log(`[build-hosted] ${HOSTED_ENTRY} ${(size / 1024).toFixed(0)} KB -> ${outDir} (audit: none of ${FORBIDDEN_STRINGS.join(', ')})`);
console.log(`[build-hosted] ${ADMIN_TOOL_FILE} ${(statSync(adminOut).size / 1024).toFixed(0)} KB (audit: addresses 127.0.0.1 only)`);
