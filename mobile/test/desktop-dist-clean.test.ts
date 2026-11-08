// @vitest-environment node
/**
 * The three bundles of the one UI:
 *  - the DESKTOP build must contain no Capacitor code and nothing of the mobile host: every
 *    `if (__MOBILE__)` branch (and the dynamic imports behind it) is dead code there;
 *  - the published MOBILE build (`mobile:build`, the server-only app of WP-H6) must contain the
 *    server-mode start-up and the phone features, but NOTHING of the in-process diary core: no boot
 *    chunk, no worker, no core assets (the SQLite wasm, the PDF fonts) - and its page allows exactly
 *    the fixed diary server in connect-src and neither wasm nor blob: workers;
 *  - the LOCAL-CORE mobile build (`MOBILE_LOCAL_CORE=1`, the developer / test configuration) is the
 *    app as it was: the boot chunk with the inline core worker, the core assets, connect-src 'self'.
 *
 * All three are built here from the current sources into throw-away directories (the project's own
 * dist/ and mobile-dist/ are not touched). When a dist/ exists - it is what the desktop installer
 * packages - it is checked as well.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CORE_ASSETS_DIR, CORE_FONT_FILES, CORE_FONTS_DIR, CORE_SQL_WASM_FILE } from '../shared/transport';
import { defaultServerOrigin, LOCAL_CORE_ENV } from '../vite.config.mobile';

const projectRoot = process.cwd();
const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');

/** Strings that only the Android builds may contain. */
const MOBILE_ONLY = ['@capacitor', 'Capacitor', 'mobile-splash', 'core not ready', 'diary-core', 'mpdFormBoundary'];
/** Strings that only the local-core build may contain (the in-process diary core and its worker). */
const CORE_ONLY = ['core not ready', 'diary-core', 'new Worker(', CORE_SQL_WASM_FILE, 'express-shim', 'storage-rpc'];

const STRICT_CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:";

const SERVER_ORIGIN = defaultServerOrigin();
/** The policy of the published page (mobile/dev-server-csp.ts serverBuildCsp). */
const SERVER_CSP = STRICT_CSP.replace("connect-src 'self'", `connect-src 'self' ${SERVER_ORIGIN}`)
  .replace("script-src 'self' 'wasm-unsafe-eval'", "script-src 'self'")
  .replace("worker-src 'self' blob:", "worker-src 'self'");

function build(config: string, outDir: string, extraEnv: Record<string, string> = {}): void {
  // A plain production build: not the test mode this process runs in, and the server mobile build
  // unless the test asks for the local-core one.
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name === 'NODE_ENV' || name === 'MODE' || name === LOCAL_CORE_ENV || name.startsWith('VITEST') || name.startsWith('VITE_')) delete env[name];
  }
  Object.assign(env, extraEnv);
  execFileSync(process.execPath, [viteBin, 'build', '--config', config, '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], {
    cwd: projectRoot,
    env,
    stdio: 'pipe',
  });
}

interface Tree {
  /** Relative path (forward slashes) -> text. */
  files: Map<string, string>;
  /** Relative path -> bytes on disk. */
  sizes: Map<string, number>;
  total: number;
}

/** Every file under `dir`. */
function readTree(dir: string): Tree {
  const files = new Map<string, string>();
  const sizes = new Map<string, number>();
  let total = 0;
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const full = path.join(current, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else {
        const relative = path.relative(dir, full).split(path.sep).join('/');
        files.set(relative, readFileSync(full, 'latin1'));
        sizes.set(relative, stat.size);
        total += stat.size;
      }
    }
  };
  walk(dir);
  return { files, sizes, total };
}

/** `file: needle` for every needle found in the tree. */
function hits(tree: Tree, needles: readonly string[]): string[] {
  const out: string[] = [];
  for (const [name, text] of tree.files) {
    for (const needle of needles) if (text.includes(needle)) out.push(`${name}: ${needle}`);
  }
  return out;
}

function chunk(tree: Tree, prefix: string): [string, string] {
  const names = [...tree.files.keys()].filter((name) => new RegExp(`^assets/${prefix}-[\\w-]+\\.js$`).test(name));
  expect(names, `one ${prefix} chunk`).toHaveLength(1);
  return [names[0], tree.files.get(names[0]) as string];
}

function mainChunk(tree: Tree): string {
  return chunk(tree, 'index')[1];
}

/** The text of chunk `name` and of the chunks it imports statically, the main chunk excepted (shared modules such as the splash get their own chunk). */
function withStaticImports(tree: Tree, name: string): string {
  const text = tree.files.get(name) as string;
  const imported = [...text.matchAll(/from\s*"\.\/([\w.-]+\.js)"/g)].map((m) => `assets/${m[1]}`).filter((dep) => !/^assets\/index-/.test(dep));
  return [text, ...imported.map((dep) => tree.files.get(dep) ?? '')].join('\n');
}

function connectSrc(page: string): string | undefined {
  const content = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(page)?.[1] ?? '';
  return content
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('connect-src '));
}

const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

describe('desktop and mobile bundles', () => {
  let tmp: string;
  let desktop: Tree;
  let mobile: Tree;
  let localCore: Tree;

  beforeAll(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'mpd-bundles-'));
    build('vite.config.ts', path.join(tmp, 'desktop'));
    build('mobile/vite.config.mobile.ts', path.join(tmp, 'mobile'));
    build('mobile/vite.config.mobile.ts', path.join(tmp, 'local-core'), { [LOCAL_CORE_ENV]: '1' });
    desktop = readTree(path.join(tmp, 'desktop'));
    mobile = readTree(path.join(tmp, 'mobile'));
    localCore = readTree(path.join(tmp, 'local-core'));
    // The proof of the package in numbers (visible with --reporter=verbose).
    console.info(`[bundles] desktop ${mb(desktop.total)} in ${desktop.files.size} files; mobile (server-only) ${mb(mobile.total)} in ${mobile.files.size} files; mobile local-core ${mb(localCore.total)} in ${localCore.files.size} files`);
    console.info(`[bundles] mobile (server-only) files: ${[...mobile.sizes.entries()].map(([name, size]) => `${name} (${size} B)`).join(', ')}`);
  }, 600_000);

  afterAll(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it('the desktop build contains no Capacitor code and nothing of the mobile host', () => {
    expect(mainChunk(desktop).length).toBeGreaterThan(100_000);
    expect(hits(desktop, MOBILE_ONLY)).toEqual([]);
    expect([...desktop.files.keys()].filter((name) => /boot|worker|server-mode|platform/i.test(name))).toEqual([]);
    expect(mainChunk(desktop)).not.toMatch(/new Worker\(/);
    expect(mainChunk(desktop)).not.toContain('/api/auth/lock","');
  });

  it('the desktop page has no splash and loads the desktop entry', () => {
    const page = desktop.files.get('index.html') as string;
    expect(page).toContain('<div id="root"></div>');
    expect(page).not.toContain('splash');
  });

  describe('the published mobile build (server-only)', () => {
    it('differs from the desktop build and starts through the server-mode host, not the core boot', () => {
      expect(mainChunk(mobile)).not.toBe(mainChunk(desktop));
      const [serverModeName, serverMode] = chunk(mobile, 'server-mode');
      // The entry imports the server-mode chunk dynamically...
      expect(mainChunk(mobile)).toContain(serverModeName.replace('assets/', ''));
      // ...which removes the splash and locks the session on the server when the app is left (the
      // API module with POST /api/auth/lock is part of the main chunk).
      expect(withStaticImports(mobile, serverModeName)).toContain('mobile-splash');
      expect(serverMode).toContain('flushAll');
      expect(serverMode).toMatch(/\.lock\(\)/);
      expect(mainChunk(mobile)).toContain('/api/auth/lock');
      // The phone features (files, reminders, lock, back button) are there - behind their own chunk.
      // (The Capacitor runtime - its bridge to the Android WebView - is in that chunk; package names are minified away.)
      expect(chunk(mobile, 'platform')[1]).toContain('androidBridge');
      expect(hits(mobile, ['Capacitor']).length).toBeGreaterThan(0);
    });

    it('contains nothing of the in-process diary core: no boot chunk, no worker, no core assets', () => {
      expect([...mobile.files.keys()].filter((name) => /^assets\/boot-|worker/i.test(name))).toEqual([]);
      // A `core-*` chunk, if any, is the Tauri API (@tauri-apps/api/core, reached only inside the
      // desktop shell - as in the desktop build), never the diary core.
      for (const name of [...mobile.files.keys()].filter((n) => /^assets\/core-/.test(n))) {
        expect(mobile.files.get(name), name).toContain('__TAURI_INTERNALS__');
        expect(mobile.sizes.get(name), name).toBeLessThan(10_000);
      }
      expect([...mobile.files.keys()].filter((name) => name.startsWith(`${CORE_ASSETS_DIR}/`))).toEqual([]);
      expect(hits(mobile, CORE_ONLY)).toEqual([]);
      for (const [name, text] of mobile.files) expect(text, name).not.toMatch(/new Worker\(/);
    });

    it('is wired to the fixed diary server and names no other host on the internet', () => {
      expect(mainChunk(mobile)).toContain(SERVER_ORIGIN);
      const hosts = new Set<string>();
      for (const [name, text] of mobile.files) {
        if (!name.endsWith('.js') && !name.endsWith('.html')) continue;
        for (const m of text.matchAll(/https?:\/\/([\w.-]+(?::\d+)?)/g)) hosts.add(m[1].toLowerCase());
      }
      const allowed = new Set([new URL(SERVER_ORIGIN).host, '127.0.0.1', 'localhost', 'www.w3.org', 'react.dev', 'reactrouter.com', 'github.com']);
      expect([...hosts].filter((host) => !allowed.has(host))).toEqual([]);
    });

    it('its page ships the splash and the strict CSP with exactly the fixed server added to connect-src', () => {
      const page = mobile.files.get('index.html') as string;
      expect(page).toContain('<div id="mobile-splash" role="status" aria-busy="true">');
      expect(page).toContain(`content="${SERVER_CSP}"`);
      expect(connectSrc(page)).toBe(`connect-src 'self' ${SERVER_ORIGIN}`);
      expect(page).not.toContain('ws://');
      expect(page).not.toContain("'unsafe-inline'; style-src");
      expect(page.match(/https:\/\/[\w.-]+/g)).toEqual([SERVER_ORIGIN]);
    });

    it('is several megabytes smaller than the local-core build - the core and its assets are what is missing', () => {
      const coreAssetBytes = [...localCore.sizes.entries()].filter(([name]) => name.startsWith(`${CORE_ASSETS_DIR}/`)).reduce((sum, [, size]) => sum + size, 0);
      const bootBytes = localCore.sizes.get(chunk(localCore, 'boot')[0]) as number;
      expect(coreAssetBytes).toBeGreaterThan(1_000_000);
      expect(bootBytes).toBeGreaterThan(2_000_000);
      expect(mobile.total).toBeLessThan(localCore.total - coreAssetBytes - bootBytes + 200_000);
      // The main chunk is the desktop UI plus the small mobile seams (the core alone is megabytes);
      // every other file is small: the server-mode start-up, the phone features, the plugin web shims.
      const [mobileMain] = chunk(mobile, 'index');
      const [desktopMain] = chunk(desktop, 'index');
      expect(mobile.sizes.get(mobileMain) as number).toBeLessThan((desktop.sizes.get(desktopMain) as number) + 150_000);
      for (const [name, size] of mobile.sizes) if (name !== mobileMain) expect(size, name).toBeLessThan(100_000);
    });
  });

  describe('the local-core mobile build (MOBILE_LOCAL_CORE=1)', () => {
    it('boots the mobile host: the boot chunk with the inline core worker, behind the splash', () => {
      expect(mainChunk(localCore)).not.toBe(mainChunk(mobile));
      const [bootName, boot] = chunk(localCore, 'boot');
      expect(mainChunk(localCore)).toContain(bootName.replace('assets/', ''));
      expect(withStaticImports(localCore, bootName)).toContain('mobile-splash');
      expect(boot).toMatch(/new Worker\(/);
      expect(boot).toContain('core not ready');
      expect(boot).toContain('diary-core');
      // The inline worker starts from a blob: URL, which the CSP allows; no separate worker file is emitted.
      expect(boot).toMatch(/createObjectURL/);
      expect([...localCore.files.keys()].filter((name) => /worker/i.test(name))).toEqual([]);
    });

    it('ships the core assets (the SQLite wasm, the 8 PDF fonts) and keeps connect-src self', () => {
      expect(localCore.files.has(`${CORE_ASSETS_DIR}/${CORE_SQL_WASM_FILE}`)).toBe(true);
      for (const font of CORE_FONT_FILES) expect(localCore.files.has(`${CORE_ASSETS_DIR}/${CORE_FONTS_DIR}/${font}`), font).toBe(true);
      const page = localCore.files.get('index.html') as string;
      expect(page).toContain(`content="${STRICT_CSP}"`);
      expect(connectSrc(page)).toBe("connect-src 'self'");
    });
  });

  it.skipIf(!existsSync(path.join(projectRoot, 'dist', 'index.html')))(
    'the dist/ on disk (what the desktop installer packages) is clean too',
    () => {
      expect(hits(readTree(path.join(projectRoot, 'dist')), MOBILE_ONLY)).toEqual([]);
    },
  );
});
