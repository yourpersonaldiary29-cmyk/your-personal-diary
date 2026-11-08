/**
 * "The shipped dist does not contain the test seam module" (OFFLINE-DESIGN.md section 9): builds the
 * two bundles that ship - the desktop/web UI (`vite.config.ts`, what the Windows installer and the
 * hosted server serve) and the published Android app (`mobile/vite.config.mobile.ts`, server mode) -
 * from the current sources into throw-away directories (the project's own dist/ and mobile-dist/ are
 * not touched; other agents rebuild them), and also reads dist/ and mobile-dist/ when they exist.
 *
 * Plus a source-level check: no file that can reach a bundle (src/**, mobile/** outside mobile/test,
 * shared/**) imports the e2e helpers, the engine's unit fakes or fake-indexeddb.
 */
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');

/** A production build (not the test mode this process runs in), asynchronously. */
export function buildBundle(config: string, outDir: string): Promise<void> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name === 'NODE_ENV' || name === 'MODE' || name === 'MOBILE_LOCAL_CORE' || name.startsWith('VITEST') || name.startsWith('VITE_')) delete env[name];
  }
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [viteBin, 'build', '--config', config, '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], { cwd: projectRoot, env, maxBuffer: 64 * 1024 * 1024 }, (error, _stdout, stderr) => {
      if (error) reject(new Error(`vite build ${config} failed: ${String(stderr).slice(0, 2000)}`));
      else resolve();
    });
  });
}

/** Every text file of a directory tree (relative path -> latin1 text). */
export function readTree(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  const walk = (current: string): void => {
    let names: string[];
    try {
      names = readdirSync(current);
    } catch {
      return; // the project's own dist/ may be rebuilt by another process while we read it
    }
    for (const name of names) {
      const full = path.join(current, name);
      try {
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(js|mjs|cjs|html|css|json|webmanifest|map)$/.test(name)) out.set(path.relative(dir, full).split(path.sep).join('/'), readFileSync(full, 'latin1'));
      } catch {
        /* vanished during a rebuild: the next file */
      }
    }
  };
  walk(dir);
  return out;
}

/** `file: needle` for each needle found in a tree. */
export function hits(tree: Map<string, string>, needles: readonly string[]): string[] {
  const out: string[] = [];
  for (const [name, text] of tree) for (const needle of needles) if (text.includes(needle)) out.push(`${name}: ${needle}`);
  return out;
}

/** Source files that can reach a shipped bundle and import a test-only module. */
export function shippedSourcesImportingTestCode(): string[] {
  const roots = ['src', 'mobile', 'shared'].map((d) => path.join(projectRoot, d));
  const testOnly = /from\s+['"][^'"]*(offline-e2e|test-utils\/|fake-indexeddb|\/mobile\/test\/)[^'"]*['"]|import\(\s*['"][^'"]*(offline-e2e|test-utils\/|fake-indexeddb)[^'"]*['"]\s*\)/;
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const full = path.join(current, name);
      const rel = path.relative(projectRoot, full).split(path.sep).join('/');
      if (statSync(full).isDirectory()) {
        if (name === 'node_modules' || rel === 'mobile/test' || rel.endsWith('/test-utils') || rel === 'src/test') continue;
        walk(full);
      } else if (/\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
        if (testOnly.test(readFileSync(full, 'utf8'))) out.push(rel);
      }
    }
  };
  for (const root of roots) if (existsSync(root)) walk(root);
  return out;
}
