/**
 * One command that regenerates everything under store/screenshots/:
 *
 *   node scripts/store-shots/run.mjs
 *
 * Steps (each one can be skipped, see the flags):
 *   1. build the UI into the TOOL folder (vite build --outDir <tool>/dist)        --skip-build
 *   2. start the diary server from source on PORT with a temporary data directory
 *      (<tool>/data) that serves that build; if a server already answers on PORT
 *      it is reused and left running
 *   3. create the two fictional accounts with their demo data (seed.mjs)
 *   4. take the 10 listing screenshots per language (shoot.mjs)                   --only 01,04  --lang he-IL
 *   5. render the Store logos (logos.mjs)                                         --skip-logos
 *   6. stop the server it started and delete the temporary data directory and the
 *      made-up passwords (the tool folder's node_modules stay for the next run)    --keep-data
 *
 * Prerequisites (once): Microsoft Edge installed; in the TOOL folder
 * (C:\Users\AVI\Projects\mpd-store-tools, or $MPD_STORE_TOOLS): `npm init -y && npm install playwright-core`.
 * Nothing is installed in the project and the project's package.json is not touched.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ACCOUNTS_FILE, BASE_URL, DATA_DIR, DIST_DIR, LOG_DIR, PORT, REPO_ROOT, TOOL_DIR } from './config.mjs';
import { renderLogos } from './logos.mjs';
import { api, waitForHealth } from './seed.mjs';
import { edgeSummary, shootAll } from './shoot.mjs';

function parseArgs(argv) {
  const out = { skipBuild: false, skipLogos: false, keepData: false, only: null, lang: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--skip-build') out.skipBuild = true;
    else if (a === '--skip-logos') out.skipLogos = true;
    else if (a === '--keep-data') out.keepData = true;
    else if (a === '--only') out.only = new Set(String(argv[++i]).split(',').map((s) => s.trim().padStart(2, '0')));
    else if (a === '--lang') out.lang = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function buildUi() {
  const vite = path.join(REPO_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(vite)) throw new Error(`vite not found at ${vite} - run npm install in the project first`);
  console.log(`Building the UI into ${DIST_DIR} ...`);
  const r = spawnSync(process.execPath, [vite, 'build', '--outDir', DIST_DIR, '--emptyOutDir'], { cwd: REPO_ROOT, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`vite build failed with status ${r.status}`);
}

async function alreadyRunning() {
  try {
    const h = await api(BASE_URL, '/api/health');
    return !!(h && h.ok);
  } catch {
    return false;
  }
}

function startServer() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const out = fs.openSync(path.join(LOG_DIR, 'server-out.log'), 'a');
  const err = fs.openSync(path.join(LOG_DIR, 'server-err.log'), 'a');
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', '--data-dir', DATA_DIR, '--port', String(PORT), '--static', DIST_DIR],
    { cwd: path.join(REPO_ROOT, 'server'), stdio: ['ignore', out, err], windowsHide: true },
  );
  child.on('exit', (code) => {
    if (code !== null && code !== 0) console.error(`[run] server exited with code ${code} (see ${LOG_DIR})`);
  });
  return child;
}

function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill();
    setTimeout(resolve, 5000).unref();
  });
}

function cleanupData() {
  for (const target of [DATA_DIR, ACCOUNTS_FILE]) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.rmSync(target, { recursive: true, force: true });
        break;
      } catch (e) {
        if (attempt === 4) console.error(`[run] could not delete ${target}: ${e.message}`);
        else Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(path.join(TOOL_DIR, 'node_modules', 'playwright-core'))) {
    throw new Error(`playwright-core is missing: run "npm init -y && npm install playwright-core" in ${TOOL_DIR}`);
  }
  if (!args.skipBuild) buildUi();
  else if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) throw new Error(`${DIST_DIR} has no build - run without --skip-build`);

  let child = null;
  const reused = await alreadyRunning();
  if (reused) console.log(`A server already answers at ${BASE_URL} - using it (it will not be stopped and its data not deleted).`);
  else {
    console.log(`Starting the screenshot server at ${BASE_URL} (data: ${DATA_DIR}) ...`);
    child = startServer();
    await waitForHealth(BASE_URL, 60000);
  }

  try {
    const shots = await shootAll({ only: args.only, lang: args.lang, base: BASE_URL });
    console.log(`${shots.length} screenshot(s) written.`);
    console.log(edgeSummary(shots));
    if (!args.skipLogos) await renderLogos();
  } finally {
    if (child) {
      console.log('Stopping the screenshot server ...');
      await stopServer(child);
      if (!args.keepData) {
        cleanupData();
        console.log(`Temporary data deleted (${DATA_DIR}, ${path.basename(ACCOUNTS_FILE)}).`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
