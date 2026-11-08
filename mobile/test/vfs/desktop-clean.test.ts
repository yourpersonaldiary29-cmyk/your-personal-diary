// @vitest-environment node
/**
 * The storage layer of the phone must never become part of the desktop app:
 *  - no module of the desktop UI (src/, shared/) or of the server (server/src) imports the VFS,
 *    the storage backends, the storage RPC or its protocol;
 *  - a dist/ on disk (what the desktop installer packages; built by `npx vite build`) contains
 *    none of the strings only that code has.
 * (mobile/test/desktop-dist-clean.test.ts builds the desktop bundle itself and checks it for the
 * Capacitor and host code.)
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();

/** Import specifiers that lead into the storage layer. */
const STORAGE_IMPORT = /['"][^'"\n]*(?:mobile\/core\/vfs|core\/vfs\/|shims\/fs['"]|host\/storage(?:\/|-rpc)|shared\/storage-protocol|storage-protocol['"])[^'"\n]*['"]?/;

/** Strings that exist only in the storage layer (messages, protocol tags, reserved names). */
const STORAGE_ONLY = [
  'storage-request',
  'storage-response',
  'boot() has not completed',
  'did not reach the storage',
  'OS-PLUG-FILE',
  'are reserved for the storage',
  'the storage did not answer in time',
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(full);
  }
  return out;
}

function everyFile(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) everyFile(full, out);
    else out.push(full);
  }
  return out;
}

const relative = (file: string): string => path.relative(projectRoot, file).split(path.sep).join('/');

describe('the desktop app and the phone storage layer', () => {
  it('the markers are real: the storage sources contain them', () => {
    const sources = [
      'mobile/core/vfs/vfs.ts',
      'mobile/core/vfs/rpc-backend.ts',
      'mobile/host/storage/capacitor-filesystem.ts',
      'mobile/shared/storage-protocol.ts',
    ]
      .map((file) => readFileSync(path.join(projectRoot, file), 'utf8'))
      .join('\n');
    for (const marker of STORAGE_ONLY) expect(sources.includes(marker), marker).toBe(true);
    expect(STORAGE_IMPORT.test("import { Vfs } from '../../mobile/core/vfs/vfs';")).toBe(true);
    expect(STORAGE_IMPORT.test("import { serveStorage } from './host/storage-rpc';")).toBe(true);
    expect(STORAGE_IMPORT.test("import x from '../shared/storage-protocol';")).toBe(true);
  });

  it('no desktop UI, shared or server module imports the storage layer', () => {
    const offenders: string[] = [];
    for (const dir of ['src', 'shared', 'server/src', 'scripts']) {
      for (const file of sourceFiles(path.join(projectRoot, dir))) {
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, index) => {
          if (/\b(import|from|require)\b/.test(line) && STORAGE_IMPORT.test(line)) offenders.push(`${relative(file)}:${index + 1}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });

  it.skipIf(!existsSync(path.join(projectRoot, 'dist', 'index.html')))('the dist/ on disk contains nothing of the storage layer', () => {
    const hits: string[] = [];
    for (const file of everyFile(path.join(projectRoot, 'dist'))) {
      if (!/\.(js|mjs|css|html|json|map)$/.test(file)) continue;
      const content = readFileSync(file, 'utf8');
      for (const marker of STORAGE_ONLY) if (content.includes(marker)) hits.push(`${relative(file)}: ${marker}`);
    }
    expect(hits).toEqual([]);
  });

  it.skipIf(!existsSync(path.join(projectRoot, 'src-tauri', 'resources', 'server', 'server.cjs')))(
    'the bundled desktop server (server.cjs) contains nothing of the storage layer',
    () => {
      const content = readFileSync(path.join(projectRoot, 'src-tauri', 'resources', 'server', 'server.cjs'), 'utf8');
      expect(STORAGE_ONLY.filter((marker) => content.includes(marker))).toEqual([]);
    },
  );
});
