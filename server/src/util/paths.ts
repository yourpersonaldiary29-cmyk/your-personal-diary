/**
 * Module-location helpers that work both when running the TypeScript sources as ESM
 * (tsx / vitest) and when running the esbuild CommonJS bundle (`server.cjs`).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

declare const __dirname: string | undefined;
declare const require: NodeRequire | undefined;

/** Directory of the running bundle (CJS) or of this source file's package `src/` root (ESM). */
export function bundleDir(): string {
  if (typeof __dirname === 'string') return __dirname;
  // ESM: this file is server/src/util/paths.ts -> return server/src
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

/** `require` that works in both module systems (lazy so CJS bundles never evaluate import.meta). */
export function nodeRequire(id: string): unknown {
  if (typeof require === 'function') return require(id);
  return createRequire(import.meta.url)(id);
}

export function nodeResolve(id: string): string {
  if (typeof require === 'function') return require.resolve(id);
  return createRequire(import.meta.url).resolve(id);
}

function normalizeFsPath(p: string): string {
  const r = path.resolve(p);
  return process.platform === 'win32' ? r.toLowerCase() : r;
}

/**
 * True when the calling module is the process entry point.
 * Pass `import.meta.url` from the caller (ignored in the CJS bundle, where `require.main` is used).
 */
export function isMainModule(callerMetaUrl?: string): boolean {
  const entry = process.argv[1] ? normalizeFsPath(process.argv[1]) : '';
  if (typeof require === 'function') {
    const req = require as NodeRequire & { main?: { filename?: string } };
    if (req.main && req.main.filename) {
      return normalizeFsPath(req.main.filename) === entry;
    }
    return false;
  }
  if (!callerMetaUrl) return false;
  try {
    const self = normalizeFsPath(fileURLToPath(callerMetaUrl.split('?')[0]));
    return entry === self || entry === self.replace(/\.ts$/, '.js');
  } catch {
    return false;
  }
}
