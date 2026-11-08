// @vitest-environment node
/**
 * The inventory behind the `node:fs` facade (mobile/core/vfs/node-fs.ts): every way the server
 * code that runs in the mobile core touches the file system is looked up in the sources of
 * server/src and must be something the facade implements. A new `fs.somethingSync(...)` in the
 * server fails here - with the file and the name - instead of on a phone.
 *
 * Scanned: server/src without its tests and without the modules that only run under Node: the
 * lists of the alias plugin (remote/**, mail/node-transport.ts, middleware/host-check.ts,
 * server.ts, index.ts - the plugin refuses to bundle those into the core) and the modules that
 * import one of them as a value (hosted.ts, hosted-index.ts - the plugin refuses them just the same).
 *
 * The facade's one addition for the hosted server, `statfsSync` (routes/server-status.ts derives a
 * free-space percentage from it), is checked here as well: the numbers of the notional volume.
 */
import nodeFs from 'node:fs';
import nodePath from 'node:path';
import { describe, expect, it } from 'vitest';
import { diskStats } from '../../../server/src/routes/server-status';
import { NODE_ONLY_SERVER_DIRS, NODE_ONLY_SERVER_MODULES } from '../../core/alias-plugin';
import * as shim from '../../core/shims/fs';
import fs, { FileHandle, installVfs, STATFS_BLOCK_SIZE, STATFS_VOLUME_BYTES, StatFs } from '../../core/vfs/node-fs';
import { Vfs, type VfsOptions } from '../../core/vfs/vfs';

const SERVER_SRC = nodePath.join(process.cwd(), 'server', 'src');

/** Members of `fs` / `fs.promises` that are only types in the server code (erased by the compiler). */
const TYPE_ONLY = new Set(['promises.FileHandle']);

interface Usage {
  /** `readFileSync`, `promises.open`, `FileHandle.sync`, `import { x }`, `flag 'w'`. */
  what: string;
  /** Relative to server/src, forward slashes. */
  file: string;
}

/** Named in the alias plugin's lists: the plugin refuses these when a core module imports them. */
function isListedNodeOnly(module: string): boolean {
  return NODE_ONLY_SERVER_MODULES.includes(module) || NODE_ONLY_SERVER_DIRS.some((dir) => module.startsWith(`${dir}/`));
}

/** Every module of server/src (relative, without extension, forward slashes) -> its source without comments. */
function serverSources(): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const name of nodeFs.readdirSync(dir).sort()) {
      const full = nodePath.join(dir, name);
      if (nodeFs.statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith('.ts') || name.endsWith('.test.ts') || name.endsWith('.d.ts')) continue;
      const module = nodePath.relative(SERVER_SRC, full).split(nodePath.sep).join('/').replace(/\.ts$/, '');
      const code = nodeFs
        .readFileSync(full, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
      out.set(module, code);
    }
  };
  walk(SERVER_SRC);
  return out;
}

/** `import ... from './x'` and `export ... from './x'`; group 2 is set for `import type` / `export type` (erased). */
const RELATIVE_IMPORT = /\b(import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?['"](\.[^'"]*)['"]/g;

/** The server modules `module` imports as values, relative, without extension. */
function valueImports(module: string, code: string): string[] {
  const out: string[] = [];
  for (const match of code.matchAll(RELATIVE_IMPORT)) {
    if (match[2]) continue;
    out.push(nodePath.posix.join(nodePath.posix.dirname(module), match[3]).replace(/\.(?:ts|js)$/, ''));
  }
  return out;
}

/**
 * The modules the plugin's lists do not name but that import a Node-only module as a value: the
 * plugin refuses them just the same, so they are no core modules either. Computed to a fixpoint.
 */
function derivedNodeOnly(sources: Map<string, string>): Set<string> {
  const nodeOnly = new Set<string>();
  for (let grown = true; grown; ) {
    grown = false;
    for (const [module, code] of sources) {
      if (isListedNodeOnly(module) || nodeOnly.has(module)) continue;
      if (valueImports(module, code).some((target) => isListedNodeOnly(target) || nodeOnly.has(target))) {
        nodeOnly.add(module);
        grown = true;
      }
    }
  }
  return nodeOnly;
}

/** Every module of the mobile core's part of server/src: relative path -> source without comments; and the derived Node-only ones. */
function coreSources(): { sources: Map<string, string>; nodeOnly: string[] } {
  const all = serverSources();
  const derived = derivedNodeOnly(all);
  const sources = new Map<string, string>();
  for (const [module, code] of all) {
    if (!isListedNodeOnly(module) && !derived.has(module)) sources.set(`${module}.ts`, code);
  }
  return { sources, nodeOnly: [...derived].sort() };
}

const FS_IMPORT = /\bimport\s+(type\s+)?([^;'"]+?)\s+from\s+['"](?:node:)?fs(\/promises)?['"]/g;
const FS_REQUIRE = /\brequire\(\s*['"](?:node:)?fs(?:\/promises)?['"]\s*\)/;

/** Everything the scanned sources ask of the file system. */
function inventory(): { usages: Usage[]; problems: string[]; importers: string[]; derivedNodeOnly: string[] } {
  const usages: Usage[] = [];
  const problems: string[] = [];
  const importers: string[] = [];
  const { sources, nodeOnly } = coreSources();
  for (const [file, code] of sources) {
    if (FS_REQUIRE.test(code)) problems.push(`${file}: require('fs') - the alias plugin only redirects imports the facade can serve as a module`);
    const locals: string[] = [];
    for (const match of code.matchAll(FS_IMPORT)) {
      if (match[1]) continue; // `import type`: erased
      if (match[3]) {
        problems.push(`${file}: imports 'node:fs/promises' - there is no mobile shim for it; use fs.promises of 'node:fs'`);
        continue;
      }
      const clause = match[2].trim();
      const named = /\{([^}]*)\}/.exec(clause);
      if (named) {
        for (const part of named[1].split(',')) {
          const name = part.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '');
          if (name && !/^type\s/.test(part.trim())) usages.push({ what: `import { ${name} }`, file });
        }
      }
      const whole = /^(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)/.exec(clause.replace(/\{[^}]*\}/, '').replace(/^,|,$/g, '').trim());
      if (whole) locals.push(whole[1]);
    }
    if (locals.length || /\bimport\s+[^;'"]*from\s+['"](?:node:)?fs['"]/.test(code)) importers.push(file);
    for (const local of locals) {
      const member = new RegExp(`\\b${local.replace(/\$/g, '\\$')}\\.(promises\\.)?([A-Za-z_$][\\w$]*)`, 'g');
      for (const match of code.matchAll(member)) {
        if (!match[1] && match[2] === 'promises') continue;
        usages.push({ what: `${match[1] ?? ''}${match[2]}`, file });
      }
      // The flags of open calls given as literals.
      const open = new RegExp(`\\b${local}\\.(?:promises\\.open|openSync)\\(\\s*[^,()]+,\\s*['"]([^'"]+)['"]`, 'g');
      for (const match of code.matchAll(open)) usages.push({ what: `flag '${match[1]}'`, file });
      // What is called on the FileHandle of fs.promises.open.
      const handles = new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s*=\\s*await\\s+${local}\\.promises\\.open\\b`, 'g');
      for (const handle of code.matchAll(handles)) {
        const calls = new RegExp(`\\b${handle[1]}\\??\\.([A-Za-z_$][\\w$]*)\\s*\\(`, 'g');
        for (const call of code.matchAll(calls)) usages.push({ what: `FileHandle.${call[1]}`, file });
      }
    }
  }
  return { usages, problems, importers, derivedNodeOnly: nodeOnly };
}

function supported(what: string): boolean {
  if (TYPE_ONLY.has(what)) return true;
  const facade = fs as unknown as Record<string, unknown>;
  const named = shim as unknown as Record<string, unknown>;
  if (what.startsWith('import { ')) {
    const name = what.slice('import { '.length, -' }'.length);
    return name in named && named[name] !== undefined;
  }
  if (what.startsWith('promises.')) return typeof (fs.promises as unknown as Record<string, unknown>)[what.slice('promises.'.length)] === 'function';
  if (what.startsWith('FileHandle.')) return typeof (FileHandle.prototype as unknown as Record<string, unknown>)[what.slice('FileHandle.'.length)] === 'function';
  if (what.startsWith("flag '")) {
    installVfs(new Vfs());
    try {
      fs.closeSync(fs.openSync('/scratch-flag-probe', what.slice("flag '".length, -1).replace(/^r\+?$/, 'w')));
      return true;
    } catch {
      return false;
    }
  }
  return typeof facade[what] === 'function';
}

describe('what server/src asks of node:fs', () => {
  const found = inventory();
  const names = [...new Set(found.usages.map((u) => u.what))].sort();

  it('the scan sees the file system code of the core', () => {
    // The modules the package description names - if these are not found, the scan itself is broken.
    expect(found.importers).toEqual(expect.arrayContaining(['security/accounts.ts', 'security/sessions.ts', 'security/resets.ts', 'security/vault.ts', 'security/device-key.ts', 'config.ts']));
    expect(found.importers.some((file) => file.startsWith('remote/'))).toBe(false);
    // The listeners (node:http, the Node SMTP transport) are out like the plugin's own lists; the hosted routes are in.
    expect(found.derivedNodeOnly).toEqual(['hosted', 'hosted-index']);
    expect(found.importers).not.toContain('hosted-index.ts');
    expect(found.importers).toContain('routes/server-status.ts');
    expect(names).toEqual(
      expect.arrayContaining([
        'existsSync',
        'readFileSync',
        'writeFileSync',
        'mkdirSync',
        'renameSync',
        'statSync',
        'rmSync',
        'openSync',
        'writeSync',
        'fsyncSync',
        'closeSync',
        'promises.readFile',
        'promises.open',
        'promises.rename',
        'promises.rm',
        'promises.mkdir',
        'promises.access',
        'FileHandle.writeFile',
        'FileHandle.sync',
        'FileHandle.close',
        "flag 'w'",
      ]),
    );
  });

  it('imports node:fs only in a way the alias plugin redirects', () => {
    expect(found.problems).toEqual([]);
  });

  it('every function, FileHandle method and open flag it uses exists in the facade', () => {
    const missing = found.usages.filter((usage) => !supported(usage.what)).map((usage) => `${usage.file}: ${usage.what}`);
    expect(missing).toEqual([]);
    // The check itself can fail: things the facade does not have are reported.
    for (const absent of ['watch', 'createReadStream', 'copyFileSync', 'promises.copyFile', 'FileHandle.truncate', 'import { cpSync }', "flag 'q'"]) {
      expect(supported(absent), absent).toBe(false);
    }
  });

  it('the facade offers what the package description lists, as default and as named exports', () => {
    const sync = ['existsSync', 'readFileSync', 'writeFileSync', 'mkdirSync', 'renameSync', 'statSync', 'rmSync', 'openSync', 'writeSync', 'fsyncSync', 'closeSync', 'readdirSync'];
    const promises = ['readFile', 'open', 'rename', 'rm', 'mkdir', 'access'];
    for (const name of sync) {
      expect(typeof (fs as unknown as Record<string, unknown>)[name], name).toBe('function');
      expect((shim as unknown as Record<string, unknown>)[name], name).toBe((fs as unknown as Record<string, unknown>)[name]);
    }
    for (const name of promises) expect(typeof (fs.promises as unknown as Record<string, unknown>)[name], name).toBe('function');
    for (const name of ['writeFile', 'sync', 'close']) expect(typeof (FileHandle.prototype as unknown as Record<string, unknown>)[name], name).toBe('function');
    expect(shim.default).toBe(fs);
  });
});

type Thrown = Error & { code?: string; syscall?: string };

function thrownBy(fn: () => unknown): Thrown | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e as Thrown;
  }
}

describe('statfsSync: the volume behind the hosted health (diskStats of routes/server-status.ts)', () => {
  const BLOCK = STATFS_BLOCK_SIZE;

  it('describes one notional volume: a constant capacity, the files of the mirror as the used blocks', () => {
    const vfs = new Vfs();
    installVfs(vfs);
    const empty = fs.statfsSync('/data');
    expect(empty).toBeInstanceOf(StatFs);
    expect(shim.statfsSync).toBe(fs.statfsSync);
    expect(empty.bsize).toBe(BLOCK);
    expect(empty.frsize).toBe(BLOCK);
    expect(empty.blocks * BLOCK).toBe(STATFS_VOLUME_BYTES);
    expect(empty.bfree).toBe(empty.blocks);
    expect(empty.bavail).toBe(empty.bfree);
    expect([empty.type, empty.files, empty.ffree]).toEqual([0, 0, 0]);
    // Node's own property set, so `Number(s.blocks) * Number(s.bsize)` and friends work.
    expect(Object.keys(empty).sort()).toEqual(['bavail', 'bfree', 'blocks', 'bsize', 'ffree', 'files', 'frsize', 'type']);

    // A file of one byte over a block holds two blocks; an asset counts as well; a removed file frees its blocks.
    fs.mkdirSync('/data/users');
    fs.writeFileSync('/data/users/u_1.mpd', new Uint8Array(BLOCK + 1));
    vfs.registerAsset('/assets/fonts/x.ttf', new Uint8Array(10));
    const used = fs.statfsSync('/data/users/u_1.mpd');
    expect(empty.bfree - used.bfree).toBe(3);
    expect(used.bavail).toBe(used.bfree);
    expect(used.blocks).toBe(empty.blocks);
    // One volume, whatever path is asked about.
    expect(fs.statfsSync('/').bfree).toBe(used.bfree);
    expect(fs.statfsSync('/assets', { bigint: true }).bfree).toBe(used.bfree);
    fs.rmSync('/data/users/u_1.mpd');
    expect(fs.statfsSync('/data').bfree).toBe(empty.bfree - 1);
  });

  it('fails like Node for a missing path or a wrong argument, and with EIO before the storage is loaded', () => {
    installVfs(new Vfs());
    expect(thrownBy(() => fs.statfsSync('/data/nope'))).toMatchObject({ code: 'ENOENT', syscall: 'statfs', message: "ENOENT: no such file or directory, statfs '/data/nope'" });
    expect(thrownBy(() => fs.statfsSync(42 as unknown as string))).toMatchObject({ code: 'ERR_INVALID_ARG_TYPE' });
    // With a backend the VFS waits for boot(); until then the data directory is not readable.
    installVfs(new Vfs({ backend: {} as NonNullable<VfsOptions['backend']> }));
    expect(thrownBy(() => fs.statfsSync('/data'))).toMatchObject({ code: 'EIO', syscall: 'statfs' });
    installVfs(new Vfs());
  });

  it('diskStats() of the hosted server status, run on the facade, reads "plenty of room"', () => {
    installVfs(new Vfs());
    fs.mkdirSync('/data/users');
    fs.writeFileSync('/data/users/u_1.mpd', new Uint8Array(3 * BLOCK));
    expect(diskStats('/data')).toEqual({ totalBytes: STATFS_VOLUME_BYTES, freeBytes: STATFS_VOLUME_BYTES - 3 * BLOCK, freePct: 99 });
    // A directory that does not exist: "the platform cannot say", as on a server.
    expect(diskStats('/nowhere')).toBeNull();
  });
});
