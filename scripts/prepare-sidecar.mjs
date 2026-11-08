/**
 * LOCAL MODE (developer / test configuration) only. Copies the Node.js runtime that runs this script to
 *   src-tauri/binaries/diary-server-<target-triple>.exe
 * so Tauri can bundle it as the "diary-server" sidecar - which only the local-mode overlay
 * src-tauri/tauri.local.conf.json declares (bundle.externalBin). The shipped tauri.conf.json declares
 * no sidecar: the published Windows app is a server-only thin client (docs/android-tasks/HOSTED-IMPL.md
 * items 8 and 10) and its installer contains no Node.js.
 *
 * The local-mode shell (cargo feature `local-server`) starts it as:
 *   diary-server <resources>/server/server.cjs --data-dir <appdata>
 *
 * Node.js is MIT licensed; its LICENSE file is copied next to the binary.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const binDir = path.join(root, 'src-tauri', 'binaries');
mkdirSync(binDir, { recursive: true });

let triple = process.env.TAURI_TARGET_TRIPLE || '';
if (!triple) {
  try {
    const out = execSync('rustc -vV', { encoding: 'utf8' });
    const m = /host:\s*(\S+)/.exec(out);
    if (m) triple = m[1];
  } catch {
    /* rustc not on PATH */
  }
}
if (!triple) {
  triple = process.platform === 'win32' ? 'x86_64-pc-windows-msvc' : `${process.arch === 'arm64' ? 'aarch64' : 'x86_64'}-unknown-linux-gnu`;
}

const ext = process.platform === 'win32' ? '.exe' : '';
const dest = path.join(binDir, `diary-server-${triple}${ext}`);
const src = process.execPath;

const same = existsSync(dest) && statSync(dest).size === statSync(src).size;
if (!same) {
  copyFileSync(src, dest);
  console.log(`[sidecar] copied ${src} -> ${dest}`);
} else {
  console.log(`[sidecar] up to date: ${dest}`);
}

// License notice for the bundled runtime.
try {
  const nodeDir = path.dirname(src);
  const lic = path.join(nodeDir, 'LICENSE');
  if (existsSync(lic)) {
    copyFileSync(lic, path.join(binDir, 'LICENSE-nodejs.txt'));
  } else {
    writeFileSync(
      path.join(binDir, 'LICENSE-nodejs.txt'),
      `Node.js ${process.version} is distributed under the MIT license. See https://github.com/nodejs/node/blob/main/LICENSE\n`,
    );
  }
} catch {
  /* ignore */
}

// Record the runtime version for the README / diagnostics.
writeFileSync(path.join(binDir, 'RUNTIME_VERSION.txt'), `${process.version}\n`);
console.log(`[sidecar] Node ${process.version} for ${triple}`);
void readFileSync;
