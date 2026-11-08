/**
 * Assembles the tree that deploy/hosted/Dockerfile copies into the hosted image (`COPY dist/ /app/`)
 * and verifies the Dockerfile against it - the "dry Node build" of the image (no Docker on this PC;
 * Fly builds the image remotely from exactly this tree).
 *
 *   deploy/hosted/dist/
 *     server-hosted.cjs        the hosted server bundle (server agent, scripts/build-hosted.mjs)
 *     sql-wasm.wasm            sql.js WebAssembly (located next to the bundle by server/src/db/database.ts)
 *     fonts/*.ttf + licences   PDF export (server/src/export/fonts.ts: <assetsDir>/fonts)
 *     pdfkit-data/*.afm        pdfkit standard-font metrics
 *     ui/                      the built web UI (dist/) - served by the server for every non-API path
 *     admin.cjs                the operator tool (plan 3.10; scripts/build-hosted.mjs writes it next to the
 *                              bundle) - required unless --fallback-local-bundle; audited: 127.0.0.1 only
 *     smoke-smtp.sh            the SMTP connectivity probe run through `fly ssh console -C` (HOSTED-IMPL item 2)
 *     .staged.json             what was staged, sizes and the sha256 of the bundle
 *
 * Usage: node scripts/hosted/stage-image.mjs [--out=<dir>] [--bundle=<file>] [--no-ui] [--fallback-local-bundle] [--verify-only]
 *   --out=<dir>               stage elsewhere (default deploy/hosted/dist); the directory must be new,
 *                             empty, or an earlier output of this script (it holds .staged.json)
 *   --bundle=<file>           stage this hosted bundle instead of the first existing HOSTED_BUNDLE_SOURCES
 *                             entry (tests: a bundle built with `build-hosted.mjs --out <tmp>`)
 *   --no-ui                   skip ui/ (a bundle-only check)
 *   --fallback-local-bundle   no hosted bundle yet: stage the desktop bundle (server.cjs) under the
 *                             hosted entry name to validate the FILE LIST and the boot. Writes the
 *                             marker STAGED-WITH-LOCAL-FALLBACK; deploy.ps1 refuses such a tree.
 *   --verify-only             only run the Dockerfile/entrypoint checks against an existing tree
 * Exit code 0 = staged and verified; 1 = a check failed; 2 = usage / refused directory.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adminBundleProblems, forbiddenStringsIn } from './bundle-audit.mjs';
import { staleUiFiles, staleUiMessage } from './ui-freshness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEPLOY_DIR = path.join(root, 'deploy', 'hosted');

// ============================ SERVER-AGENT CONTRACT (WP-H3) - the ONE place to update ==============
// The server agent's report names the hosted bundle (scripts/build-hosted.mjs output). Until then the
// values come from docs/HOSTED-PLAN.md 3.6 ("/app/server-hosted.cjs") and the WP-H3 row of section 7.
/** File name of the hosted server entry inside the image (/app/<name>). Dockerfile CMD must match. */
export const HOSTED_ENTRY_FILE = 'server-hosted.cjs';
/** Where scripts/build-hosted.mjs may have written the bundle (first existing path wins). */
export const HOSTED_BUNDLE_SOURCES = [
  'src-tauri/resources/server/server-hosted.cjs',
  'server/dist/server-hosted.cjs',
  'deploy/hosted/build/server-hosted.cjs',
];
/** The build script of the server agent (run by deploy.ps1 before staging). */
export const HOSTED_BUILD_SCRIPT = 'scripts/build-hosted.mjs';
/**
 * The operator tool (docs/HOSTED-PLAN.md 3.10; scripts/build-hosted.mjs writes it next to the bundle):
 * /app/admin.cjs - required in every real (non-fallback) image, audited to address 127.0.0.1 only.
 */
export const ADMIN_TOOL_FILE = 'admin.cjs';
// ====================================================================================================

/** The desktop bundle - used ONLY with --fallback-local-bundle (same server, local composition). */
const LOCAL_BUNDLE = 'src-tauri/resources/server/server.cjs';
const FONTS_DIR = path.join(root, 'src-tauri', 'resources', 'server', 'fonts');
const UI_DIR = path.join(root, 'dist');
const STAGED_MANIFEST = '.staged.json';
const FALLBACK_MARKER = 'STAGED-WITH-LOCAL-FALLBACK';
// The forbidden-string audit of the bundle (plan 5.8 rule 2) is the shared list in ./bundle-audit.mjs -
// the same code-only markers scripts/build-hosted.mjs refuses to write. (Bare `duckdns.org` /
// `letsencrypt.org` would fail every real bundle: the i18n help texts name those hosts.)

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueArg = (name) => {
  const a = args.find((x) => x.startsWith(`${name}=`));
  return a ? a.slice(name.length + 1) : null;
};
const outArg = valueArg('--out');
const outDir = outArg ? path.resolve(outArg) : path.join(DEPLOY_DIR, 'dist');
const bundleArg = valueArg('--bundle');
for (const a of args) {
  if (!['--no-ui', '--fallback-local-bundle', '--verify-only'].includes(a) && !a.startsWith('--out=') && !a.startsWith('--bundle=')) {
    console.error(`[stage-image] unknown argument ${a}`);
    process.exit(2);
  }
}
if (bundleArg !== null && (bundleArg === '' || !fs.existsSync(path.resolve(bundleArg)))) {
  console.error(`[stage-image] --bundle: ${bundleArg || '(empty)'} does not exist`);
  process.exit(2);
}

const failures = [];
const fail = (msg) => failures.push(msg);
const rel = (p) => path.relative(root, p).split(path.sep).join('/');

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Refuses a directory that is not ours (same rule as scripts/mobile/make-fixtures.mjs). */
function outputDirProblem(dir) {
  let stat;
  try {
    stat = fs.lstatSync(dir);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
  if (!stat.isDirectory()) return `${dir} exists and is not a directory`;
  const names = fs.readdirSync(dir);
  if (names.length === 0 || names.includes(STAGED_MANIFEST)) return null;
  return `${dir} is not empty and holds no ${STAGED_MANIFEST} - refusing to clean it; choose a new or empty directory`;
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

/** Copies a text file with LF line endings (shell scripts edited on Windows). */
function copyTextLf(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, fs.readFileSync(from, 'utf8').replace(/\r\n?/g, '\n'));
}

function dirSize(dir) {
  let total = 0;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    total += st.isDirectory() ? dirSize(full) : st.size;
  }
  return total;
}

// Stage ---------------------------------------------------------------------------------------------

function stage() {
  const problem = outputDirProblem(outDir);
  if (problem) {
    console.error(`[stage-image] ${problem}`);
    process.exit(2);
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const staged = { entry: null, files: [], fallback: false, ui: !flag('--no-ui') };

  // 1. The server bundle.
  const bundleSource = bundleArg !== null ? path.resolve(bundleArg) : HOSTED_BUNDLE_SOURCES.map((p) => path.join(root, p)).find((p) => fs.existsSync(p));
  if (bundleSource) {
    copyFile(bundleSource, path.join(outDir, HOSTED_ENTRY_FILE));
    staged.entry = { from: rel(bundleSource), sha256: sha256(bundleSource) };
    for (const s of forbiddenStringsIn(fs.readFileSync(bundleSource, 'latin1'))) {
      fail(`hosted bundle ${rel(bundleSource)} contains the forbidden string "${s}" (plan 5.8 rule 2 - remote-access code or the Android shim)`);
    }
    // The operator tool: deletion on request is promised by the privacy policy, so no image goes without it.
    const adminSource = path.join(path.dirname(bundleSource), ADMIN_TOOL_FILE);
    if (fs.existsSync(adminSource)) {
      for (const problem of adminBundleProblems(fs.readFileSync(adminSource, 'latin1'))) {
        fail(`${rel(adminSource)} ${problem} (plan 5.8 rule 4b - the operator tool may address 127.0.0.1 only)`);
      }
      copyFile(adminSource, path.join(outDir, ADMIN_TOOL_FILE));
      staged.files.push(ADMIN_TOOL_FILE);
    } else {
      fail(`${ADMIN_TOOL_FILE} missing next to ${rel(bundleSource)} - run node ${HOSTED_BUILD_SCRIPT} (it writes both)`);
    }
  } else if (flag('--fallback-local-bundle')) {
    const local = path.join(root, LOCAL_BUNDLE);
    if (!fs.existsSync(local)) {
      console.error(`[stage-image] neither a hosted bundle (${HOSTED_BUNDLE_SOURCES.join(', ')}) nor ${LOCAL_BUNDLE} exists - run node scripts/build-server.mjs first`);
      process.exit(2);
    }
    copyFile(local, path.join(outDir, HOSTED_ENTRY_FILE));
    fs.writeFileSync(path.join(outDir, FALLBACK_MARKER), `Staged ${new Date().toISOString()} with the DESKTOP bundle ${LOCAL_BUNDLE} for a file-list check. Not deployable.\n`);
    staged.entry = { from: LOCAL_BUNDLE, sha256: sha256(local) };
    staged.fallback = true;
    console.warn(`[stage-image] WARNING: no hosted bundle found - staged ${LOCAL_BUNDLE} as ${HOSTED_ENTRY_FILE} (file-list check only; marker ${FALLBACK_MARKER} written)`);
  } else {
    console.error(`[stage-image] hosted bundle not found at any of: ${HOSTED_BUNDLE_SOURCES.join(', ')}\n  run: node ${HOSTED_BUILD_SCRIPT}   (server agent, WP-H3) - or --fallback-local-bundle for a file-list check`);
    process.exit(2);
  }
  staged.files.push(HOSTED_ENTRY_FILE);

  // 2. sql.js wasm + pdfkit metrics (dependencies of server/, like scripts/build-server.mjs).
  const require = createRequire(path.join(root, 'server', 'package.json'));
  copyFile(require.resolve('sql.js/dist/sql-wasm.wasm'), path.join(outDir, 'sql-wasm.wasm'));
  staged.files.push('sql-wasm.wasm');
  try {
    const dataDir = path.join(path.dirname(require.resolve('pdfkit/package.json')), 'js', 'data');
    if (fs.existsSync(dataDir)) {
      fs.cpSync(dataDir, path.join(outDir, 'pdfkit-data'), { recursive: true });
      staged.files.push('pdfkit-data/');
    }
  } catch {
    /* optional */
  }

  // 3. Fonts (TTF + licences only).
  if (!fs.existsSync(FONTS_DIR)) fail(`fonts directory missing: ${rel(FONTS_DIR)}`);
  else {
    for (const name of fs.readdirSync(FONTS_DIR)) {
      if (/\.(ttf|txt)$/i.test(name)) copyFile(path.join(FONTS_DIR, name), path.join(outDir, 'fonts', name));
    }
    staged.files.push('fonts/');
  }

  // 4. The web UI.
  if (staged.ui) {
    const stale = fs.existsSync(path.join(UI_DIR, 'index.html')) ? staleUiFiles(path.join(root, 'public'), UI_DIR) : [];
    if (!fs.existsSync(path.join(UI_DIR, 'index.html'))) fail(`dist/index.html missing - run "npm run build" first (or pass --no-ui for a bundle-only check)`);
    // dist/ built before the last change of public/ (e.g. the privacy policy pages): never into the image.
    else if (stale.length) fail(staleUiMessage('stage-image', stale).replace(/^\[stage-image\] FAILED: /, ''));
    else {
      fs.cpSync(UI_DIR, path.join(outDir, 'ui'), { recursive: true, filter: (src) => !src.endsWith('.map') });
      staged.files.push('ui/');
    }
  }

  // 5. The SMTP smoke test (run inside the container by the main session; HOSTED-IMPL item 2).
  const smoke = path.join(root, 'scripts', 'hosted', 'smoke-smtp.sh');
  if (fs.existsSync(smoke)) {
    copyTextLf(smoke, path.join(outDir, 'smoke-smtp.sh'));
    staged.files.push('smoke-smtp.sh');
  }

  staged.stagedAt = new Date().toISOString();
  staged.bytes = dirSize(outDir);
  fs.writeFileSync(path.join(outDir, STAGED_MANIFEST), JSON.stringify(staged, null, 2));
  return staged;
}

// Verify --------------------------------------------------------------------------------------------

function verify() {
  const dockerfile = path.join(DEPLOY_DIR, 'Dockerfile');
  if (!fs.existsSync(dockerfile)) return fail('deploy/hosted/Dockerfile missing');
  const text = fs.readFileSync(dockerfile, 'utf8');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

  // Every COPY source exists in the build context (relative to deploy/hosted, or to --out for dist/).
  for (const line of lines) {
    const m = /^COPY\s+(?:--\S+\s+)*(.+)$/.exec(line);
    if (!m) continue;
    const parts = m[1].trim().split(/\s+/);
    for (const src of parts.slice(0, -1)) {
      const srcPath = src.startsWith('dist/') || src === 'dist/' ? path.join(outDir, src.slice('dist/'.length)) : path.join(DEPLOY_DIR, src);
      if (!fs.existsSync(srcPath)) fail(`Dockerfile COPY source "${src}" does not exist (${rel(srcPath)})`);
    }
    if (/^ADD\s/.test(line)) fail(`Dockerfile uses ADD (${line}) - only COPY is allowed`);
  }
  // No arbitrary downloads (plan 5.8 rule 4).
  for (const line of lines) {
    if (/\b(curl|wget)\b/.test(line) || /https?:\/\//.test(line)) fail(`Dockerfile line fetches from the network: ${line}`);
  }
  // CMD names the hosted entry file.
  const cmd = lines.find((l) => l.startsWith('CMD'));
  if (!cmd) fail('Dockerfile has no CMD');
  else {
    const named = /\[\s*"node"\s*,\s*"\/app\/([^"]+)"\s*\]/.exec(cmd);
    if (!named) fail(`Dockerfile CMD is not ["node", "/app/<entry>"]: ${cmd}`);
    else if (named[1] !== HOSTED_ENTRY_FILE) fail(`Dockerfile CMD names ${named[1]} but HOSTED_ENTRY_FILE is ${HOSTED_ENTRY_FILE} - update the constant block in scripts/hosted/stage-image.mjs and the Dockerfile together`);
  }
  if (!/^ENTRYPOINT\s+\["\/usr\/local\/bin\/entrypoint\.sh"\]/m.test(text)) fail('Dockerfile ENTRYPOINT must be ["/usr/local/bin/entrypoint.sh"]');
  if (!/su-exec/.test(text)) fail('Dockerfile does not install su-exec');
  if (/^USER\s+root/m.test(text)) fail('Dockerfile sets USER root explicitly');

  // Shell scripts: POSIX sh, LF endings, drop privileges with exec.
  for (const name of ['entrypoint.sh', 'data-tools.sh']) {
    const file = path.join(DEPLOY_DIR, name);
    if (!fs.existsSync(file)) {
      fail(`${name} missing`);
      continue;
    }
    const sh = fs.readFileSync(file, 'utf8');
    if (!sh.startsWith('#!/bin/sh')) fail(`${name} must start with #!/bin/sh`);
    if (sh.includes('\r')) fail(`${name} has CRLF line endings (the Dockerfile strips them, but keep the source LF)`);
    if (/\b(curl|wget)\b/.test(sh) || /https?:\/\//.test(sh)) fail(`${name} fetches from the network`);
  }
  const entry = fs.readFileSync(path.join(DEPLOY_DIR, 'entrypoint.sh'), 'utf8');
  if (!/exec su-exec/.test(entry)) fail('entrypoint.sh must `exec su-exec <user>` so node is PID 1');
  if (!/id -u/.test(entry)) fail('entrypoint.sh must guard the chown with `id -u`');

  // .dockerignore keeps the context minimal and never ships env files.
  const ignoreFile = path.join(DEPLOY_DIR, '.dockerignore');
  if (!fs.existsSync(ignoreFile)) fail('.dockerignore missing');
  else {
    const ig = fs.readFileSync(ignoreFile, 'utf8');
    for (const needed of ['!dist/', '!Dockerfile', '!entrypoint.sh', '!data-tools.sh', '.env']) {
      if (!ig.includes(needed)) fail(`.dockerignore lacks "${needed}"`);
    }
  }

  // The staged tree itself.
  const entryFile = path.join(outDir, HOSTED_ENTRY_FILE);
  if (!fs.existsSync(entryFile)) fail(`${rel(entryFile)} missing`);
  if (!fs.existsSync(path.join(outDir, 'sql-wasm.wasm'))) fail('sql-wasm.wasm missing from the staged tree');
  if (!fs.existsSync(path.join(outDir, 'fonts', 'DejaVuSans.ttf'))) fail('fonts/DejaVuSans.ttf missing from the staged tree');
  if (!flag('--no-ui') && !fs.existsSync(path.join(outDir, 'ui', 'index.html'))) fail('ui/index.html missing from the staged tree');
  // /app/admin.cjs (the operator tool) in every image staged from a real hosted bundle, and clean.
  const adminFile = path.join(outDir, ADMIN_TOOL_FILE);
  if (fs.existsSync(adminFile)) {
    for (const problem of adminBundleProblems(fs.readFileSync(adminFile, 'latin1'))) fail(`${rel(adminFile)} ${problem}`);
  } else if (!fs.existsSync(path.join(outDir, FALLBACK_MARKER))) {
    fail(`${ADMIN_TOOL_FILE} missing from the staged tree - run node ${HOSTED_BUILD_SCRIPT}, then stage again`);
  }
  const manifest = path.join(outDir, STAGED_MANIFEST);
  if (!fs.existsSync(manifest)) fail(`${STAGED_MANIFEST} missing`);
  // Nothing secret-looking or data-looking inside the tree.
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/^\.env|\.mpd(\.prev|\.tmp)?$|\.key$|\.pem$/.test(name)) fail(`staged tree contains ${rel(full)} - secrets/data never go into the image`);
    }
  };
  walk(outDir);
}

// Main ----------------------------------------------------------------------------------------------

let staged = null;
if (!flag('--verify-only')) staged = stage();
else if (!fs.existsSync(outDir)) {
  console.error(`[stage-image] ${rel(outDir)} does not exist; run without --verify-only first`);
  process.exit(2);
}
verify();

if (failures.length) {
  console.error('[stage-image] FAILED:\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
const info = staged ?? JSON.parse(fs.readFileSync(path.join(outDir, STAGED_MANIFEST), 'utf8'));
console.log(
  `[stage-image] OK -> ${rel(outDir)} (${(info.bytes / 1024 / 1024).toFixed(1)} MB): ${info.files.join(', ')}; entry ${HOSTED_ENTRY_FILE} from ${info.entry.from}${info.fallback ? ' [LOCAL FALLBACK - not deployable]' : ''}; Dockerfile, entrypoint.sh, data-tools.sh and .dockerignore verified`,
);
