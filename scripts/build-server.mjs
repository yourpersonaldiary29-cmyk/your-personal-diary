/**
 * Bundles the LOCAL-MODE server into a single CommonJS file that the desktop shell runs with the
 * Node.js sidecar in the developer / test configuration, and copies runtime assets next to it:
 *
 *   src-tauri/resources/server/server.cjs      (esbuild bundle of server/src/index.ts)
 *   src-tauri/resources/server/sql-wasm.wasm   (sql.js WebAssembly)
 *   src-tauri/resources/server/fonts/*.ttf     (already in repo; used for PDF export)
 *   src-tauri/resources/server/pdfkit-data/    (AFM files pdfkit may read for standard fonts)
 *   src-tauri/resources/server/ui/             (copy of dist/ so phones get the same UI)
 *
 * Since WP-H5 the PUBLISHED Windows app is a server-only thin client (docs/android-tasks/HOSTED-IMPL.md
 * items 8 and 10): src-tauri/tauri.conf.json bundles none of these files, so the installer built with
 * `npx tauri build` ships no server. The output here is used by the bundle smoke tests and by the
 * local-mode developer build only (`npx tauri dev|build --config src-tauri/tauri.local.conf.json
 * --features local-server`, README section 5.3). The internet server (the public Your Personal Diary
 * server) has its own bundle script and output folder, described in docs/API.md (it reads the fonts
 * from resources/server/fonts).
 *
 * Usage: node scripts/build-server.mjs [--no-ui]
 */
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const serverDir = path.join(root, 'server');
const outDir = path.join(root, 'src-tauri', 'resources', 'server');
// esbuild and sql.js are dependencies of server/, not of the root package.
const require = createRequire(path.join(serverDir, 'package.json'));
const { build } = await import(pathToFileURL(require.resolve('esbuild')).href);

mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(serverDir, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: path.join(outDir, 'server.cjs'),
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  alias: { '@shared': path.join(root, 'shared') },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});

// sql.js wasm ------------------------------------------------------------------
const wasm = require.resolve('sql.js/dist/sql-wasm.wasm');
cpSync(wasm, path.join(outDir, 'sql-wasm.wasm'));

// pdfkit standard-font metrics (only needed if a standard font is ever referenced) ----
try {
  const pdfkitPkg = path.dirname(require.resolve('pdfkit/package.json'));
  const dataDir = path.join(pdfkitPkg, 'js', 'data');
  if (existsSync(dataDir)) {
    cpSync(dataDir, path.join(outDir, 'pdfkit-data'), { recursive: true });
  }
} catch {
  /* optional */
}

// Frontend copy for phones -------------------------------------------------------
if (!process.argv.includes('--no-ui')) {
  const dist = path.join(root, 'dist');
  const uiDir = path.join(outDir, 'ui');
  if (existsSync(path.join(dist, 'index.html'))) {
    rmSync(uiDir, { recursive: true, force: true });
    cpSync(dist, uiDir, { recursive: true });
    console.log(`[build-server] copied UI from ${dist}`);
  } else {
    console.warn('[build-server] dist/index.html not found - run "npm run build" first; phone UI will be missing');
  }
}

const size = statSync(path.join(outDir, 'server.cjs')).size;
console.log(`[build-server] server.cjs ${(size / 1024).toFixed(0)} KB -> ${outDir}`);
