/**
 * Mobile replacement of server/src/util/paths.ts (the alias plugin redirects every import of that
 * module here). The original locates the running bundle with `__dirname` / `import.meta.url` and
 * builds a Node `require` - none of which exists in a Web Worker.
 *
 *   bundleDir()     the virtual directory of the bundled assets ('/assets': fonts/, sql-wasm.wasm)
 *   nodeRequire()   throws "not available on mobile"
 *   nodeResolve()   throws "not available on mobile" (db/database.ts catches it; the sql.js shim
 *                   never asks for a file location anyway)
 *   isMainModule()  false: the core is started by the worker entry, never as a process entry point
 */
import { unavailable } from './unavailable';

/** Where the read-only assets live in the virtual file system. */
export const MOBILE_ASSETS_DIR = '/assets';

let currentBundleDir = MOBILE_ASSETS_DIR;

/** Overrides the directory `bundleDir()` reports (the default is MOBILE_ASSETS_DIR). */
export function setBundleDir(dir: string): void {
  currentBundleDir = dir;
}

export function bundleDir(): string {
  return currentBundleDir;
}

export function nodeRequire(id: string): unknown {
  return unavailable('module', `require('${id}')`);
}

export function nodeResolve(id: string): string {
  return unavailable('module', `require.resolve('${id}')`);
}

export function isMainModule(_callerMetaUrl?: string): boolean {
  return false;
}
