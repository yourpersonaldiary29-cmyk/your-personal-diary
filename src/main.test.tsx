/**
 * The desktop branch of the entry point (src/main.tsx; docs/android-tasks/OFFLINE-DESIGN.md section 7,
 * docs/APPLE-PLAN.md WP-M3): under the Tauri shell the offline seams of src/offline/native/tauri.ts
 * (the key vault, the outbox mirror, the device unlock) are installed BEFORE the first render, with the
 * one production call `installTauriOfflinePlatform()`; in a browser - the same dist/ is the web UI the
 * diary server serves - the adapter is never even requested. The second half proves, from the sources
 * and from a built dist/, that the adapter reaches the bundle only as the desktop branch's own chunk.
 *
 * The entry runs at import, so each start imports a fresh copy of it (`vi.resetModules`) with React's
 * root, the installer step, the app and the adapter replaced by mocks; nothing renders for real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  initInstallLocale: vi.fn(() => Promise.resolve()),
  installTauriOfflinePlatform: vi.fn(),
  /** How many times the current test requested the adapter module (`mockAdapter`). */
  adapterLoads: 0,
}));

vi.mock('react-dom/client', () => {
  const createRoot = () => ({ render: mocks.render, unmount: () => {} });
  return { default: { createRoot }, createRoot };
});
vi.mock('./i18n/install-locale', () => ({ initInstallLocale: mocks.initInstallLocale }));
vi.mock('./App', () => ({ default: () => null }));

/**
 * The adapter's mock, registered afresh before every test. `vi.resetModules()` keeps a mocked module's
 * instance (checked on Vitest 5: a re-import after it does not run the factory again), so only a new
 * registration (`vi.doMock`) makes the factory - and with it the count - run again on the next request.
 * Each test therefore counts its own requests, whatever ran before it: 0 for a browser start, 1 under
 * the shell.
 */
function mockAdapter(): void {
  mocks.adapterLoads = 0;
  vi.doMock('./offline/native/tauri', () => {
    mocks.adapterLoads++;
    return { installTauriOfflinePlatform: mocks.installTauriOfflinePlatform };
  });
}

/** The Tauri shell's global (src/api/client.ts `isTauri`): the Windows and the Mac app have it, a browser never. */
function tauriShell(on: boolean): void {
  const w = window as unknown as Record<string, unknown>;
  if (on) w.__TAURI_INTERNALS__ = {};
  else delete w.__TAURI_INTERNALS__;
}

/** A start of the app as the page does it: a fresh import of the entry, then the first render. */
async function startApp(): Promise<void> {
  await import('./main');
  await waitFor(() => expect(mocks.render).toHaveBeenCalledTimes(1));
}

describe('src/main.tsx: the desktop shell installs the Tauri offline seams, a browser never loads them', () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdapter();
    mocks.render.mockClear();
    mocks.initInstallLocale.mockClear();
    mocks.installTauriOfflinePlatform.mockReset();
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    tauriShell(false);
  });

  it('in a browser (the web UI the diary server serves from the same dist/) the app starts without requesting the adapter', async () => {
    tauriShell(false);
    await startApp();
    expect(mocks.installTauriOfflinePlatform).not.toHaveBeenCalled();
    expect(mocks.adapterLoads).toBe(0);
    expect(mocks.initInstallLocale).toHaveBeenCalledTimes(1);
  });

  it('under the Tauri shell the seams are installed - installTauriOfflinePlatform() with no argument - before the installer step and the first render', async () => {
    tauriShell(true);
    await startApp();
    expect(mocks.adapterLoads).toBe(1);
    expect(mocks.installTauriOfflinePlatform).toHaveBeenCalledTimes(1);
    expect(mocks.installTauriOfflinePlatform).toHaveBeenCalledWith();
    const installedAt = mocks.installTauriOfflinePlatform.mock.invocationCallOrder[0];
    expect(installedAt).toBeLessThan(mocks.initInstallLocale.mock.invocationCallOrder[0]);
    expect(installedAt).toBeLessThan(mocks.render.mock.invocationCallOrder[0]);
  });

  it('an adapter that fails never stops the app: it starts as the web does', async () => {
    tauriShell(true);
    mocks.installTauriOfflinePlatform.mockImplementation(() => {
      throw new Error('no such command');
    });
    await startApp();
    expect(mocks.adapterLoads).toBe(1);
    expect(mocks.installTauriOfflinePlatform).toHaveBeenCalledTimes(1);
    expect(mocks.initInstallLocale).toHaveBeenCalledTimes(1);
  });
});

// --- The adapter is the desktop branch's own chunk -------------------------------------------------
//
// The Node modules are loaded through a computed specifier because the root tsconfig deliberately has
// no Node types (it checks browser code) - the convention of the other root tests that read the disk.

interface NodeFs {
  existsSync(p: string): boolean;
  readdirSync(p: string): string[];
  readFileSync(p: string, encoding: 'utf8'): string;
  statSync(p: string): { isDirectory(): boolean; mtimeMs: number };
}
interface NodePath {
  dirname(p: string): string;
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
  sep: string;
}

const load = (specifier: string) => import(/* @vite-ignore */ specifier);
const ADAPTER = 'offline/native/tauri';
/** An import of the adapter in any form: `from '…'`, a side-effect `import '…'`, `export … from '…'`, `import('…')`. */
const ADAPTER_IMPORT = /(?:from|import)\s*\(?\s*['"][^'"\n]*offline\/native\/tauri['"]/;
/** Strings only the adapter has: the Tauri command names of the key vault (OFFLINE-DESIGN section 7). */
const ADAPTER_ONLY = ['offline_key_protect', 'offline_key_unprotect', 'offline_key_remove', 'offline_mirror_put', 'offline_user_check'];
/** The JavaScript of the built client bundle, when a build exists (keys only - nothing is imported). */
const BUNDLE_FILES = Object.keys(import.meta.glob('/dist/assets/*.js', { eager: false }));

describe('the adapter reaches the bundle only through the desktop branch', () => {
  let fs: NodeFs;
  let pathMod: NodePath;
  let projectRoot = '';
  let mainSource = '';

  beforeEach(async () => {
    fs = (await load('node:fs')) as NodeFs;
    pathMod = (await load('node:path')) as NodePath;
    const { fileURLToPath } = (await load('node:url')) as { fileURLToPath(url: string): string };
    // This file lives in src/: the project root is two levels up.
    projectRoot = pathMod.dirname(pathMod.dirname(fileURLToPath(import.meta.url)));
    mainSource = fs.readFileSync(pathMod.join(projectRoot, 'src', 'main.tsx'), 'utf8');
  });

  /** Every .ts / .tsx source under `dir` (tests and type declarations left out), as project-relative paths with forward slashes. */
  function sources(dir: string, out: string[] = []): string[] {
    for (const name of fs.readdirSync(dir)) {
      const full = pathMod.join(dir, name);
      if (fs.statSync(full).isDirectory()) sources(full, out);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(pathMod.relative(projectRoot, full).split(pathMod.sep).join('/'));
    }
    return out;
  }

  it('src/main.tsx imports the adapter dynamically, inside the Tauri check, and never statically', () => {
    expect(mainSource).toMatch(/import\(\s*['"]\.\/offline\/native\/tauri['"]\s*\)/);
    expect(mainSource).not.toMatch(/from\s+['"](?:\.\/|@\/)offline\/native\/tauri['"]/);
    expect(mainSource.match(new RegExp(ADAPTER_IMPORT.source, 'g'))).toHaveLength(1);
    // The import sits behind `isTauri()`: a browser resolves at once, without the chunk.
    const body = /function installDesktopSeams\(\)[\s\S]*?\n\}/.exec(mainSource)?.[0] ?? '';
    expect(body).toContain('if (!isTauri()) return Promise.resolve();');
    expect(body).toContain("import('./offline/native/tauri')");
  });

  it('no other module of the UI or of the mobile app imports the adapter, so no bundle but the desktop chunk carries it', () => {
    const offenders: string[] = [];
    for (const dir of ['src', 'shared', 'mobile']) {
      const full = pathMod.join(projectRoot, dir);
      if (!fs.existsSync(full)) continue;
      for (const file of sources(full)) {
        if (file === 'src/main.tsx' || file === `src/${ADAPTER}.ts`) continue;
        if (ADAPTER_IMPORT.test(fs.readFileSync(pathMod.join(projectRoot, file), 'utf8'))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it.skipIf(BUNDLE_FILES.length === 0)('a built dist/ keeps the adapter in its own chunk, named by the entry chunk and nowhere else', (ctx) => {
    const distPage = pathMod.join(projectRoot, 'dist', 'index.html');
    const entrySource = pathMod.join(projectRoot, 'src', 'main.tsx');
    // A dist/ older than the entry was built from the previous main.tsx: nothing to prove about it.
    if (!fs.existsSync(distPage) || fs.statSync(distPage).mtimeMs < fs.statSync(entrySource).mtimeMs) ctx.skip();
    const chunks = new Map<string, string>();
    for (const file of BUNDLE_FILES) {
      const name = file.split('/').pop() as string;
      chunks.set(name, fs.readFileSync(pathMod.join(projectRoot, ...file.split('/').filter(Boolean)), 'utf8'));
    }
    const entries = [...chunks.keys()].filter((name) => /^index-[\w-]+\.js$/.test(name));
    expect(entries, 'one entry chunk').toHaveLength(1);
    const entry = chunks.get(entries[0]) as string;
    const adapterChunks = [...chunks.keys()].filter((name) => ADAPTER_ONLY.every((s) => (chunks.get(name) as string).includes(s)));
    expect(adapterChunks, 'one adapter chunk').toHaveLength(1);
    expect(adapterChunks[0]).not.toBe(entries[0]);
    for (const needle of ADAPTER_ONLY) expect(entry, needle).not.toContain(needle);
    // The entry names the adapter chunk (its dynamic import); no other chunk does.
    expect(entry).toContain(adapterChunks[0]);
    for (const [name, text] of chunks) if (name !== entries[0] && name !== adapterChunks[0]) expect(text, name).not.toContain(adapterChunks[0]);
  });
});
