// @vitest-environment node
/**
 * The smaller shims of the Android core (mobile/core/shims) - everything except crypto, which has
 * its own suites (scrypt / aes-gcm / crypto-misc / containers):
 *
 *   buffer.ts    the `buffer` polyfill + 'base64url', compared with Node's Buffer
 *   path.ts      path-browserify, compared with node:path.posix; relative paths resolve against '/'
 *   process.ts   the minimal process (platform 'android', no Node version)
 *   globals.ts   Buffer / process / setImmediate for server modules; never replaces existing globals
 *   paths.ts     the replacement of server/src/util/paths.ts
 *   sqljs.ts     initSqlJs() of the browser build, fed with the WebAssembly bytes
 *   pdfkit.ts    the standalone build of pdfkit, reading font files from the virtual file system
 *   os, net, http, https, tls, dns, dgram, url, module, string_decoder
 *                importable stubs: every call says "not available on mobile"
 *
 * and an inventory: every member of a Node built-in that the core modules of server/src use
 * exists in the shim the alias plugin gives them. Core modules: server/src without the Node-only
 * modules of the plugin's lists and without the modules that import one of those as a value
 * (hosted.ts, hosted-index.ts: the plugin refuses to bundle them just the same).
 */
import nodeFs from 'node:fs';
import nodeNet from 'node:net';
import nodePath from 'node:path';
import ts from 'typescript';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NODE_ONLY_SERVER_DIRS, NODE_ONLY_SERVER_MODULES, NODE_SHIMS } from '../../core/alias-plugin';
import * as bufferShim from '../../core/shims/buffer';
import * as cryptoShim from '../../core/shims/crypto';
import * as dgramShim from '../../core/shims/dgram';
import * as dnsShim from '../../core/shims/dns';
import * as fsShim from '../../core/shims/fs';
import * as globalsShim from '../../core/shims/globals';
import * as httpShim from '../../core/shims/http';
import * as httpsShim from '../../core/shims/https';
import * as moduleShim from '../../core/shims/module';
import * as netShim from '../../core/shims/net';
import * as osShim from '../../core/shims/os';
import pathShim, * as pathNamed from '../../core/shims/path';
import * as pathsShim from '../../core/shims/paths';
import MobilePDFDocument from '../../core/shims/pdfkit';
import mobileProcess, * as processShim from '../../core/shims/process';
import initSqlJs, { hasSqlWasm, provideSqlWasm } from '../../core/shims/sqljs';
import * as stringDecoderShim from '../../core/shims/string_decoder';
import * as tlsShim from '../../core/shims/tls';
import { MOBILE_UNAVAILABLE_CODE, MobileUnavailableError, stubClass, stubFunction, unavailable } from '../../core/shims/unavailable';
import * as urlShim from '../../core/shims/url';
import { Vfs, installVfs } from '../../core/vfs';
import { sqlWasmBytes } from './fixtures';

const PolyfillBuffer = bufferShim.Buffer;
const projectRoot = process.cwd();
const FONTS_DIR = nodePath.join(projectRoot, 'src-tauri', 'resources', 'server', 'fonts');

type Exports = Record<string, unknown>;

const SHIM_MODULES: Record<string, Exports> = {
  'buffer.ts': bufferShim,
  'crypto.ts': cryptoShim,
  'dgram.ts': dgramShim,
  'dns.ts': dnsShim,
  'fs.ts': fsShim,
  'http.ts': httpShim,
  'https.ts': httpsShim,
  'module.ts': moduleShim,
  'net.ts': netShim,
  'os.ts': osShim,
  'path.ts': pathNamed,
  'process.ts': processShim,
  'string_decoder.ts': stringDecoderShim,
  'tls.ts': tlsShim,
  'url.ts': urlShim,
};

const TEXTS = ['', 'a', 'password', 'שלום עולם', 'مرحبا بالعالم', '日本語のテキスト', 'emoji 👩‍💻🇮🇱 🔑', 'Café ｆｕｌｌ é', '\u0000\u0001 control', 'x'.repeat(1000)];

describe('buffer shim: the polyfill behaves like the Buffer of Node', () => {
  it('is the npm polyfill, not Node\'s Buffer, and its instances are Uint8Arrays', () => {
    expect(PolyfillBuffer).not.toBe(Buffer);
    const buf = PolyfillBuffer.from('abc');
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(PolyfillBuffer.isBuffer(buf)).toBe(true);
    expect(Buffer.isBuffer(buf)).toBe(false);
    expect(bufferShim.default.Buffer).toBe(PolyfillBuffer);
    expect(bufferShim.kMaxLength).toBe(0x7fffffff);
  });

  it('encodes and decodes text like Node in every encoding the server uses', () => {
    for (const text of TEXTS) {
      const mine = PolyfillBuffer.from(text, 'utf8');
      const nodes = Buffer.from(text, 'utf8');
      expect([...mine], JSON.stringify(text.slice(0, 20))).toEqual([...nodes]);
      expect(PolyfillBuffer.byteLength(text, 'utf8')).toBe(Buffer.byteLength(text, 'utf8'));
      for (const encoding of ['utf8', 'hex', 'base64', 'base64url', 'latin1'] as const) {
        const encoded = mine.toString(encoding);
        expect(encoded, encoding).toBe(nodes.toString(encoding));
        expect([...PolyfillBuffer.from(encoded, encoding)], encoding).toEqual([...Buffer.from(encoded, encoding)]);
      }
      expect(mine.toString()).toBe(text);
    }
  });

  it("'base64url' - which the polyfill lacks - matches Node for every length and padding", () => {
    for (let length = 0; length <= 67; length++) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 73 + length * 31 + 251) & 0xff);
      const mine = PolyfillBuffer.from(bytes);
      const nodes = Buffer.from(bytes);
      const text = mine.toString('base64url');
      expect(text, String(length)).toBe(nodes.toString('base64url'));
      expect(text).not.toMatch(/[+/=]/);
      expect([...PolyfillBuffer.from(text, 'base64url')]).toEqual([...bytes]);
      // Node also decodes the standard alphabet and padding when asked for base64url, and vice versa.
      expect([...PolyfillBuffer.from(nodes.toString('base64'), 'base64url')]).toEqual([...bytes]);
      expect([...PolyfillBuffer.from(text, 'base64')]).toEqual([...bytes]);
      expect(PolyfillBuffer.byteLength(text, 'base64url')).toBe(Buffer.byteLength(text, 'base64url'));
      // Partial ranges.
      expect(mine.toString('base64url', 1, Math.max(1, length - 1))).toBe(nodes.toString('base64url', 1, Math.max(1, length - 1)));
    }
    // The bytes that make '+' and '/' in standard Base64.
    expect(PolyfillBuffer.from([0xfb, 0xff, 0xfe]).toString('base64url')).toBe('-__-');
    expect(PolyfillBuffer.isEncoding('base64url')).toBe(true);
    expect(PolyfillBuffer.isEncoding('BASE64URL')).toBe(true);
    expect(PolyfillBuffer.isEncoding('base64')).toBe(true);
    expect(PolyfillBuffer.isEncoding('nope')).toBe(false);
    const target = PolyfillBuffer.alloc(6);
    expect(target.write('-__-', 'base64url')).toBe(3);
    expect([...target]).toEqual([0xfb, 0xff, 0xfe, 0, 0, 0]);
    expect(target.write('-__-', 3, 'base64url')).toBe(3);
    expect([...target]).toEqual([0xfb, 0xff, 0xfe, 0xfb, 0xff, 0xfe]);
  });

  it('the binary helpers of the container format agree with Node', () => {
    const mine = PolyfillBuffer.alloc(49);
    const nodes = Buffer.alloc(49);
    for (const target of [mine, nodes]) {
      target.write('MPDIARY\x01', 0, 'latin1');
      target.writeUInt8(1, 8);
      target.writeUInt32LE(32768, 9);
      target.writeUInt32LE(8, 13);
      target.writeUInt32LE(0xfffffffe, 17);
    }
    expect(mine.toString('hex')).toBe(nodes.toString('hex'));
    expect(mine.readUInt32LE(9)).toBe(32768);
    expect(mine.readUInt32LE(17)).toBe(0xfffffffe);
    expect(mine.subarray(0, 8).toString('latin1')).toBe('MPDIARY\x01');
    expect(PolyfillBuffer.isBuffer(mine.subarray(0, 8))).toBe(true);

    const joined = PolyfillBuffer.concat([mine, Buffer.from([1, 2, 3]), new Uint8Array([4, 5])]);
    expect(joined).toHaveLength(54);
    expect([...joined.subarray(49)]).toEqual([1, 2, 3, 4, 5]);
    expect(mine.equals(PolyfillBuffer.from(nodes))).toBe(true);
    expect(PolyfillBuffer.compare(mine, PolyfillBuffer.from(nodes))).toBe(0);
    const filled = PolyfillBuffer.alloc(4, 7);
    filled.fill(0);
    expect([...filled]).toEqual([0, 0, 0, 0]);
  });

  it('bufferOver() wraps the same memory without copying', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6]).subarray(2, 5);
    const view = bufferShim.bufferOver(bytes);
    expect(PolyfillBuffer.isBuffer(view)).toBe(true);
    expect([...view]).toEqual([3, 4, 5]);
    view[0] = 99;
    expect(bytes[0]).toBe(99);
  });
});

describe('path shim: POSIX paths, like node:path.posix', () => {
  const posix = nodePath.posix;

  it('join, dirname, basename, extname, normalize, isAbsolute, parse and format agree with Node', () => {
    const joins: string[][] = [
      ['/data', 'users', 'u_1.mpd'],
      ['/data/users/', '/u_1.mpd'],
      ['/data', '..', 'assets', 'fonts'],
      ['/assets', 'fonts', 'DejaVuSans.ttf'],
      ['a', 'b', '..', 'c'],
      ['', ''],
      ['/data', ''],
      ['C:/Users/AVI/fonts', 'DejaVuSans.ttf'],
      ['/data/users', 'u_1.mpd.tmp'],
    ];
    for (const parts of joins) expect(pathShim.join(...parts), parts.join(' + ')).toBe(posix.join(...parts));
    const paths = ['/data/users/u_1.mpd', '/data/accounts.json', '/data', '/', 'relative/file.txt', 'file', '/a/b/../c/./d.tar.gz', '/data/users/', '.hidden', '/x/.hidden.txt', ''];
    for (const p of paths) {
      expect(pathShim.dirname(p), p).toBe(posix.dirname(p));
      expect(pathShim.basename(p), p).toBe(posix.basename(p));
      expect(pathShim.basename(p, '.mpd'), p).toBe(posix.basename(p, '.mpd'));
      expect(pathShim.extname(p), p).toBe(posix.extname(p));
      expect(pathShim.normalize(p), p).toBe(posix.normalize(p));
      expect(pathShim.isAbsolute(p), p).toBe(posix.isAbsolute(p));
      expect(pathShim.parse(p), p).toEqual(posix.parse(p));
      expect(pathShim.format(pathShim.parse(p)), p).toBe(posix.format(posix.parse(p)));
    }
    expect(pathShim.sep).toBe('/');
    expect(pathShim.delimiter).toBe(':');
  });

  it('absolute paths resolve and relate like Node', () => {
    expect(pathShim.resolve('/data', 'users', '../accounts.json')).toBe(posix.resolve('/data', 'users', '../accounts.json'));
    expect(pathShim.resolve('/assets', '..', '..', 'src-tauri', 'fonts')).toBe('/src-tauri/fonts');
    expect(pathShim.resolve('/a', '/b', 'c')).toBe('/b/c');
    expect(pathShim.relative('/data/users', '/data/accounts.json')).toBe(posix.relative('/data/users', '/data/accounts.json'));
    expect(pathShim.relative('/data', '/data/users/u.mpd')).toBe('users/u.mpd');
  });

  it("relative paths resolve against the virtual root '/', never against the directory of the process", () => {
    expect(pathShim.resolve('data', 'x.json')).toBe('/data/x.json');
    expect(pathShim.resolve('.')).toBe('/');
    expect(pathShim.resolve()).toBe('/');
    expect(pathShim.resolve('../..', 'a')).toBe('/a');
    expect(pathShim.relative('data/users', 'data')).toBe('..');
    expect(pathShim.resolve('data')).not.toContain(process.cwd().split(nodePath.sep).join('/'));
    // A Windows path is just a relative name here: it never matches a file of the virtual file system.
    expect(pathShim.isAbsolute('C:/Users/AVI')).toBe(false);
    expect(pathShim.isAbsolute('C:\\Users\\AVI')).toBe(false);
  });

  it('the named exports, the default export and path.posix are one API', () => {
    expect(pathNamed.join).toBe(pathShim.join);
    expect(pathNamed.resolve).toBe(pathShim.resolve);
    expect(pathNamed.relative).toBe(pathShim.relative);
    expect(pathNamed.posix).toBe(pathShim);
    expect(pathShim.posix).toBe(pathShim);
    for (const name of ['basename', 'dirname', 'extname', 'format', 'isAbsolute', 'join', 'normalize', 'parse', 'relative', 'resolve', 'sep', 'delimiter']) {
      expect((pathNamed as Exports)[name], name).toBe((pathShim as unknown as Exports)[name]);
    }
  });
});

describe('process shim', () => {
  it('describes an Android worker, not a Node process', () => {
    expect(mobileProcess.platform).toBe('android');
    expect(mobileProcess.versions.node).toBeUndefined();
    expect(mobileProcess.env).toEqual({});
    expect(mobileProcess.argv.slice(2)).toEqual([]);
    expect(mobileProcess.cwd()).toBe('/');
    expect(processShim.MOBILE_CWD).toBe('/');
    expect(processShim.process).toBe(mobileProcess);
    expect((mobileProcess as unknown as { browser: boolean }).browser).toBe(true);
  });

  it('nextTick runs the callback with its arguments after the current code and before timers', async () => {
    const order: string[] = [];
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        order.push('timer');
        resolve();
      }, 0);
      mobileProcess.nextTick((a: string, b: string) => order.push(`tick ${a}${b}`), 'x', 'y');
      order.push('sync');
    });
    expect(order).toEqual(['sync', 'tick xy', 'timer']);
  });

  it('hrtime and uptime move forward; process events are accepted and ignored', () => {
    const start = mobileProcess.hrtime();
    expect(start).toHaveLength(2);
    const diff = mobileProcess.hrtime(start);
    expect(diff[0]).toBeGreaterThanOrEqual(0);
    expect(diff[1]).toBeGreaterThanOrEqual(0);
    expect(diff[1]).toBeLessThan(1e9);
    expect(mobileProcess.uptime()).toBeGreaterThan(0);
    expect(mobileProcess.on('exit', () => undefined)).toBe(mobileProcess);
    expect(mobileProcess.once('SIGINT', () => undefined)).toBe(mobileProcess);
    expect(mobileProcess.off('exit', () => undefined)).toBe(mobileProcess);
  });

  it('exit and chdir do not exist in a worker', () => {
    expect(() => mobileProcess.exit(1)).toThrow(/node:process exit\(\) is not available on mobile/);
    expect(() => mobileProcess.chdir('/x')).toThrow(MobileUnavailableError);
  });
});

describe('globals shim', () => {
  it('exports the polyfills that server modules get as imports', () => {
    expect(globalsShim.Buffer).toBe(PolyfillBuffer);
    expect(globalsShim.process).toBe(mobileProcess);
    expect(typeof globalsShim.setImmediate).toBe('function');
    expect(typeof globalsShim.clearImmediate).toBe('function');
  });

  it('never replaces a global that exists: under Node everything stays Node', () => {
    expect(globalThis.Buffer).not.toBe(PolyfillBuffer);
    expect(globalThis.process.versions.node).toBeTypeOf('string');
    expect(globalThis.setImmediate).not.toBe(globalsShim.setImmediate);
    // (In a context that has none of them, they are installed: core-import-probe.test.ts.)
  });

  it('setImmediate runs later, with its arguments; clearImmediate cancels', async () => {
    const calls: unknown[][] = [];
    const cancelled = globalsShim.setImmediate(() => calls.push(['cancelled']));
    globalsShim.setImmediate((...args: unknown[]) => calls.push(args), 1, 'two');
    globalsShim.clearImmediate(cancelled);
    expect(calls).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toEqual([[1, 'two']]);
    // Unknown handles are ignored, like Node.
    globalsShim.clearImmediate(undefined);
    globalsShim.clearImmediate({} as unknown as NodeJS.Immediate);
  });
});

describe('paths shim (the mobile util/paths)', () => {
  afterEach(() => pathsShim.setBundleDir(pathsShim.MOBILE_ASSETS_DIR));

  it('reports the virtual assets directory and has no Node module system', () => {
    expect(pathsShim.MOBILE_ASSETS_DIR).toBe('/assets');
    expect(pathsShim.bundleDir()).toBe('/assets');
    pathsShim.setBundleDir('/elsewhere');
    expect(pathsShim.bundleDir()).toBe('/elsewhere');
    expect(pathsShim.isMainModule('file:///whatever.js')).toBe(false);
    expect(() => pathsShim.nodeRequire('pdfkit')).toThrow(/node:module require\('pdfkit'\) is not available on mobile/);
    expect(() => pathsShim.nodeResolve('sql.js/dist/sql-wasm.wasm')).toThrow(MobileUnavailableError);
  });

  it('has the exports of server/src/util/paths.ts', async () => {
    const real = (await import('../../../server/src/util/paths')) as Exports;
    for (const name of Object.keys(real)) expect(typeof (pathsShim as Exports)[name], name).toBe(typeof real[name]);
  });
});

describe('"not available on mobile" stubs', () => {
  it('the error names the feature and carries a code', () => {
    let error: MobileUnavailableError | null = null;
    try {
      unavailable('net', 'connect()');
    } catch (e) {
      error = e as MobileUnavailableError;
    }
    expect(error).toBeInstanceOf(MobileUnavailableError);
    expect(error).toBeInstanceOf(Error);
    expect(error?.name).toBe('MobileUnavailableError');
    expect(error?.code).toBe(MOBILE_UNAVAILABLE_CODE);
    expect(error?.feature).toBe('node:net connect()');
    expect(error?.message).toBe('node:net connect() is not available on mobile (the Android core runs in a Web Worker, without Node.js)');
    expect(() => stubFunction('tls', 'connect')('host', 465)).toThrow(/node:tls connect\(\) is not available on mobile/);
    const Stub = stubClass('net', 'Socket');
    expect(() => new Stub()).toThrow(/node:net new Socket\(\) is not available on mobile/);
  });

  /** Members that really work, per shim; everything else must throw the stub error. */
  const WORKING: Record<string, string[]> = {
    'os.ts': ['EOL', 'platform'],
    'net.ts': ['isIP', 'isIPv4', 'isIPv6'],
    'url.ts': ['URL', 'URLSearchParams'],
    'module.ts': ['builtinModules', 'isBuiltin'],
    'dns.ts': ['promises'],
    'http.ts': [],
    'https.ts': [],
    'tls.ts': [],
    'dgram.ts': [],
    'string_decoder.ts': [],
  };

  for (const [file, working] of Object.entries(WORKING)) {
    it(`${file}: imports fine; every other member throws when called or constructed`, () => {
      const module = SHIM_MODULES[file];
      const names = Object.keys(module).filter((name) => name !== 'default' && !working.includes(name));
      expect(names.length + working.length).toBeGreaterThan(0);
      for (const name of names) {
        const member = module[name] as new (...args: unknown[]) => unknown;
        expect(typeof member, name).toBe('function');
        let thrown: unknown = null;
        try {
          // Works for both kinds of stub: a class throws from its constructor, a function when called.
          new member('argument');
        } catch (e) {
          thrown = e;
        }
        expect(thrown, name).toBeInstanceOf(MobileUnavailableError);
        expect((thrown as MobileUnavailableError).message, name).toContain(`node:${file.replace('.ts', '')} `);
      }
      // `import x from 'node:...'` sees the same members.
      const defaults = module.default as Exports;
      for (const name of Object.keys(module)) {
        if (name !== 'default') expect(defaults[name], name).toBe(module[name]);
      }
    });
  }

  it('the members that work: os.platform / EOL, the IP classifiers of node:net, URL, module.isBuiltin', () => {
    expect(osShim.platform()).toBe('android');
    expect(osShim.EOL).toBe('\n');
    expect(urlShim.URL).toBe(URL);
    expect(urlShim.URLSearchParams).toBe(URLSearchParams);
    expect(moduleShim.builtinModules).toEqual([]);
    expect(moduleShim.isBuiltin('fs')).toBe(false);
    expect(() => dnsShim.promises.lookup('example.test')).toThrow(MobileUnavailableError);

    const addresses = [
      '127.0.0.1', '0.0.0.0', '255.255.255.255', '192.168.1.10', '256.1.1.1', '1.2.3', '1.2.3.4.5', '01.2.3.4', '1.2.3.4 ', ' 1.2.3.4', '',
      '::', '::1', '1::', '2001:db8::1', 'fe80::1%eth0', '::ffff:192.168.1.1', '2001:db8:0:0:0:0:2:1', '1:2:3:4:5:6:7:8', '1:2:3:4:5:6:7:8:9', '2001:db8::g', ':::1',
      '1:2:3:4:5:6:1.2.3.4', '::1.2.3.4', 'localhost', 'example.test', '[::1]', '12345::', 'fe80::1%', '::ffff:999.1.1.1',
    ];
    for (const address of addresses) {
      expect(netShim.isIP(address), JSON.stringify(address)).toBe(nodeNet.isIP(address));
      expect(netShim.isIPv4(address), JSON.stringify(address)).toBe(nodeNet.isIPv4(address));
      expect(netShim.isIPv6(address), JSON.stringify(address)).toBe(nodeNet.isIPv6(address));
    }
  });
});

describe('inventory: what the core modules of server/src use of each Node built-in exists in its shim', () => {
  const serverSrc = nodePath.join(projectRoot, 'server', 'src');

  /** Named in the alias plugin's lists: the plugin refuses these when a core module imports them. */
  function isListedNodeOnly(module: string): boolean {
    return NODE_ONLY_SERVER_MODULES.includes(module) || NODE_ONLY_SERVER_DIRS.some((dir) => module.startsWith(`${dir}/`));
  }

  /** Every module of server/src (relative, without extension, forward slashes); tests and typings left out. */
  function serverModules(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
      for (const name of nodeFs.readdirSync(dir)) {
        const full = nodePath.join(dir, name);
        if (nodeFs.statSync(full).isDirectory()) walk(full);
        else if (name.endsWith('.ts') && !name.endsWith('.d.ts') && !name.endsWith('.test.ts')) {
          out.push(nodePath.relative(serverSrc, full).split(nodePath.sep).join('/').replace(/\.ts$/, ''));
        }
      }
    };
    walk(serverSrc);
    return out.sort();
  }

  /** The server modules `module` imports as values (`import type` / `export type` are erased), relative, without extension. */
  function valueImports(module: string): string[] {
    const source = ts.createSourceFile(module, nodeFs.readFileSync(nodePath.join(serverSrc, `${module}.ts`), 'utf8'), ts.ScriptTarget.ES2022, true);
    const out: string[] = [];
    for (const statement of source.statements) {
      let specifier: ts.Expression | undefined;
      if (ts.isImportDeclaration(statement)) {
        if (statement.importClause?.isTypeOnly) continue;
        specifier = statement.moduleSpecifier;
      } else if (ts.isExportDeclaration(statement)) {
        if (statement.isTypeOnly) continue;
        specifier = statement.moduleSpecifier;
      } else continue;
      if (!specifier || !ts.isStringLiteral(specifier) || !specifier.text.startsWith('.')) continue;
      out.push(nodePath.posix.join(nodePath.posix.dirname(module), specifier.text).replace(/\.(?:ts|js)$/, ''));
    }
    return out;
  }

  /**
   * The modules the plugin's lists do not name but that import a Node-only module as a value: the
   * plugin refuses them just the same (hosted.ts imports mail/node-transport.ts, hosted-index.ts
   * imports hosted.ts), so they are no core modules either. Computed to a fixpoint.
   */
  function derivedNodeOnly(modules: string[]): Set<string> {
    const nodeOnly = new Set<string>();
    const imports = new Map(modules.filter((module) => !isListedNodeOnly(module)).map((module) => [module, valueImports(module)] as const));
    for (let grown = true; grown; ) {
      grown = false;
      for (const [module, imported] of imports) {
        if (nodeOnly.has(module)) continue;
        if (imported.some((target) => isListedNodeOnly(target) || nodeOnly.has(target))) {
          nodeOnly.add(module);
          grown = true;
        }
      }
    }
    return nodeOnly;
  }

  const modules = serverModules();
  const derived = derivedNodeOnly(modules);

  /** The core modules (as files relative to server/src): what the plugin bundles; util/paths.ts is replaced by shims/paths.ts. */
  function coreFiles(): string[] {
    return modules.filter((module) => !isListedNodeOnly(module) && !derived.has(module) && module !== 'util/paths').map((module) => `${module}.ts`);
  }

  /** built-in -> members used as values: 'name' (named import or member of the default import), 'promises.name'. */
  function builtinUsage(): Map<string, Map<string, string[]>> {
    const usage = new Map<string, Map<string, string[]>>();
    const record = (builtin: string, member: string, file: string): void => {
      const members = usage.get(builtin) ?? new Map<string, string[]>();
      usage.set(builtin, members);
      members.set(member, [...(members.get(member) ?? []), file]);
    };
    for (const file of coreFiles()) {
      const source = ts.createSourceFile(file, nodeFs.readFileSync(nodePath.join(serverSrc, file), 'utf8'), ts.ScriptTarget.ES2022, true);
      const locals = new Map<string, string>();
      for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
        const specifier = statement.moduleSpecifier.text;
        const builtin = specifier.startsWith('node:') ? specifier.slice(5) : specifier;
        if (!(builtin in NODE_SHIMS) && !specifier.startsWith('node:')) continue;
        const clause = statement.importClause;
        if (!clause || clause.isTypeOnly) continue;
        if (clause.name) locals.set(clause.name.text, builtin);
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) locals.set(bindings.name.text, builtin);
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            if (!element.isTypeOnly) record(builtin, (element.propertyName ?? element.name).text, file);
          }
        }
      }
      const visit = (node: ts.Node): void => {
        if (ts.isPropertyAccessExpression(node)) {
          const target = node.expression;
          if (ts.isIdentifier(target) && locals.has(target.text)) {
            record(locals.get(target.text) as string, node.name.text, file);
          } else if (ts.isPropertyAccessExpression(target) && ts.isIdentifier(target.expression) && locals.has(target.expression.text) && target.name.text === 'promises') {
            record(locals.get(target.expression.text) as string, `promises.${node.name.text}`, file);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    return usage;
  }

  let usage: Map<string, Map<string, string[]>>;
  beforeAll(() => {
    usage = builtinUsage();
  });

  it('the core modules import exactly these built-ins at run time', () => {
    expect([...usage.keys()].sort()).toEqual(['crypto', 'fs', 'os', 'path']);
    // node:http is imported as a type only (middleware/access.ts) and as a value only by the
    // listeners (server.ts, hosted.ts); net, tls, dns, dgram, url, module and string_decoder only
    // by the Node-only modules and by util/paths.ts (replaced).
  });

  it('knows which modules are Node-only by what they import (the plugin refuses those too)', () => {
    expect([...derived].sort()).toEqual(['hosted', 'hosted-index']);
    for (const module of derived) {
      expect(valueImports(module).some((target) => isListedNodeOnly(target) || derived.has(target)), module).toBe(true);
    }
    expect([...derived].some(isListedNodeOnly)).toBe(false);
    // The hosted routes and policies themselves are core modules: nothing Node-only below them.
    expect(coreFiles()).toEqual(expect.arrayContaining(['app.ts', 'config.ts', 'routes/server-status.ts', 'hosted/policy.ts']));
    expect(coreFiles()).not.toContain('hosted.ts');
    expect(coreFiles()).not.toContain('util/paths.ts');
  });

  it('every member they use is exported by the shim (named, and on the default export)', () => {
    const missing: string[] = [];
    for (const [builtin, members] of usage) {
      const shim = SHIM_MODULES[NODE_SHIMS[builtin]];
      expect(shim, builtin).toBeDefined();
      const defaults = (shim.default ?? {}) as Exports;
      for (const [member, files] of members) {
        const [first, second] = member.split('.');
        const named = second ? (shim[first] as Exports | undefined)?.[second] : shim[first];
        const viaDefault = second ? (defaults[first] as Exports | undefined)?.[second] : defaults[first];
        if (named === undefined || viaDefault === undefined) missing.push(`node:${builtin} ${member} (used by ${[...new Set(files)].join(', ')})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('lists what is used (so a new use of a Node API shows up in review)', () => {
    const members = (builtin: string): string[] => [...(usage.get(builtin)?.keys() ?? [])].sort();
    expect(members('crypto')).toEqual(['createCipheriv', 'createDecipheriv', 'createHash', 'randomBytes', 'randomInt', 'scrypt', 'timingSafeEqual']);
    expect(members('os')).toEqual(['homedir']);
    expect(members('path')).toEqual(expect.arrayContaining(['basename', 'dirname', 'join', 'resolve']));
    expect(members('fs')).toEqual(expect.arrayContaining(['existsSync', 'mkdirSync', 'readFileSync', 'renameSync', 'statSync', 'statfsSync', 'writeFileSync']));
  });
});

describe('server/src/config.ts on the shims (the one core module that imports node:os)', () => {
  it('builds a ServerConfig of virtual POSIX paths when the directories are given - node:os is never called', async () => {
    const config = await import('../../../server/src/config');
    installVfs(new Vfs());
    const cfg = config.loadConfig(['--data-dir', '/data', '--assets', '/assets', '--port', '0'], {});
    expect(cfg).toMatchObject({
      dataDir: '/data',
      usersDir: '/data/users',
      accountsFile: '/data/accounts.json',
      settingsFile: '/data/server-settings.json',
      deviceKeyFile: '/data/device.key',
      sessionsFile: '/data/sessions.json',
      assetsDir: '/assets',
      staticDir: null,
      dev: false,
    });
    // loadConfig created the users directory - in the virtual file system.
    expect(fsShim.statSync('/data/users')?.isDirectory()).toBe(true);
    expect(nodeFs.existsSync('/data/users')).toBe(false);
    // Settings round-trip through the same file system (tmp + rename).
    config.writeServerSettings(cfg, { port: 47999, lanEnabled: false });
    expect(config.readServerSettings(cfg)).toMatchObject({ port: 47999, lanEnabled: false });
    expect(fsShim.existsSync('/data/server-settings.json.tmp')).toBe(false);
  });

  it('without --assets the assets directory is the virtual one once the fonts are there', async () => {
    const config = await import('../../../server/src/config');
    const vfs = new Vfs();
    installVfs(vfs);
    // Before the host delivered the fonts, the desktop fallback path is computed - a directory that does not exist here.
    expect(config.loadConfig(['--data-dir', '/data'], {}).assetsDir).toBe('/src-tauri/resources/server');
    vfs.registerAsset('/assets/fonts/DejaVuSans.ttf', new Uint8Array([0, 1, 0, 0]));
    expect(config.loadConfig(['--data-dir', '/data'], {}).assetsDir).toBe('/assets');
  });

  it('without a data directory it asks for the Windows default and fails with the mobile error, not a crash elsewhere', async () => {
    const config = await import('../../../server/src/config');
    installVfs(new Vfs());
    expect(() => config.loadConfig([], {})).toThrow(/node:os homedir\(\) is not available on mobile/);
    expect(() => config.defaultDataDir()).toThrow(MobileUnavailableError);
  });
});

describe('sql.js shim: the browser build, started with the bytes of sql-wasm.wasm', () => {
  it('refuses to start before the host supplied the WebAssembly binary - synchronously, so a retry works', async () => {
    vi.resetModules();
    const fresh = await import('../../core/shims/sqljs');
    expect(fresh.hasSqlWasm()).toBe(false);
    expect(() => fresh.default({ locateFile: () => 'nowhere' })).toThrow(/the WebAssembly binary was not provided - call provideSqlWasm\(bytes\) at boot/);
    expect(() => fresh.provideSqlWasm('sql-wasm.wasm' as unknown as Uint8Array)).toThrow(TypeError);
    expect(() => fresh.provideSqlWasm(new Uint8Array(0))).toThrow(RangeError);
    expect(fresh.hasSqlWasm()).toBe(false);
    fresh.provideSqlWasm(sqlWasmBytes());
    expect(fresh.hasSqlWasm()).toBe(true);
  });

  it('keeps the call shape of the package: initSqlJs({ locateFile }) resolves to a working SQLite, locateFile is never asked', async () => {
    provideSqlWasm(sqlWasmBytes());
    expect(hasSqlWasm()).toBe(true);
    const locateFile = vi.fn(() => 'https-would-be-fetched');
    const SQL = (await initSqlJs({ locateFile })) as { Database: new (image?: Uint8Array) => { exec(sql: string): Array<{ values: unknown[][] }>; export(): Uint8Array; close(): void } };
    expect(locateFile).not.toHaveBeenCalled();
    const db = new SQL.Database();
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, text TEXT); INSERT INTO t (text) VALUES ('שלום'), ('مرحبا');");
    expect(db.exec('SELECT COUNT(*), sqlite_version() FROM t')[0].values[0][0]).toBe(2);
    const image = db.export();
    db.close();
    expect(Buffer.from(image.subarray(0, 15)).toString('latin1')).toBe('SQLite format 3');
    const reopened = new SQL.Database(image);
    expect(reopened.exec('SELECT text FROM t ORDER BY id')[0].values).toEqual([['שלום'], ['مرحبا']]);
    reopened.close();
  });

  it('an ArrayBuffer and an explicit wasmBinary are accepted as well', async () => {
    const bytes = sqlWasmBytes();
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    provideSqlWasm(copy);
    const SQL = (await initSqlJs({ wasmBinary: new Uint8Array(copy) })) as { Database: new () => { close(): void } };
    new SQL.Database().close();
  });
});

describe('pdfkit shim: the standalone build, with fonts read from the virtual file system', () => {
  const REGULAR = '/assets/fonts/DejaVuSans.ttf';
  const BOLD = '/assets/fonts/DejaVuSans-Bold.ttf';
  let vfs: Vfs;
  let reads: string[];

  type Doc = InstanceType<typeof MobilePDFDocument> & {
    on(event: string, listener: (chunk: Uint8Array) => void): Doc;
    text(text: string, x?: number, y?: number): Doc;
    end(): void;
    _font: { name: string };
    _fontFamilies: Record<string, unknown>;
  };

  function finish(doc: Doc): Promise<Buffer> {
    return new Promise((resolve) => {
      const chunks: Uint8Array[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.end();
    });
  }

  beforeAll(() => {
    vfs = new Vfs();
    installVfs(vfs);
    for (const name of ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf']) {
      vfs.registerAsset(`/assets/fonts/${name}`, new Uint8Array(nodeFs.readFileSync(nodePath.join(FONTS_DIR, name))));
    }
    const readFile = vfs.readFile.bind(vfs);
    reads = [];
    vfs.readFile = (file: string) => {
      reads.push(file);
      return readFile(file);
    };
  });

  afterEach(() => {
    reads.length = 0;
  });

  it('a font named by path is read from the virtual file system - also as the default font of the constructor', async () => {
    const doc = new MobilePDFDocument({ size: 'A4', font: REGULAR }) as Doc;
    expect(reads).toEqual([REGULAR]);
    expect(doc._font.name).toBe('DejaVuSans');
    doc.text('Hello שלום', 50, 50);
    doc.font(BOLD).text('Bold', 50, 80);
    // Going back to a font that was used before does not read the file again.
    doc.font(REGULAR).text('again', 50, 110);
    doc.font(BOLD);
    expect(reads).toEqual([REGULAR, BOLD]);
    const pdf = (await finish(doc)).toString('latin1');
    expect(pdf.startsWith('%PDF-1')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf).toMatch(/\/FontName \/[A-Z]{6}\+DejaVuSans\b/);
    expect(pdf).toMatch(/\/FontName \/[A-Z]{6}\+DejaVuSans-Bold\b/);
    // Helvetica (the default of pdfkit) was never loaded.
    expect(pdf).not.toContain('Helvetica');
  });

  it('registerFont(name, file) is lazy: the file is read when the font is first used, once', async () => {
    const doc = new MobilePDFDocument({ font: REGULAR }) as Doc;
    reads.length = 0;
    doc.registerFont('latin-bold', BOLD);
    doc.registerFont('never-used', '/assets/fonts/NotThere.ttf');
    expect(reads).toEqual([]);
    doc.font('latin-bold').text('x', 50, 50);
    doc.font(REGULAR);
    doc.font('latin-bold');
    expect(reads).toEqual([BOLD]);
    expect(doc._font.name).toBe('DejaVuSans-Bold');
    await finish(doc);
  });

  it('a missing font file fails with the ENOENT of the file system, as under Node', () => {
    const doc = new MobilePDFDocument({ font: REGULAR }) as Doc;
    let error: (Error & { code?: string }) | null = null;
    try {
      doc.font('/assets/fonts/NotThere.ttf');
    } catch (e) {
      error = e as Error & { code?: string };
    }
    expect(error?.code).toBe('ENOENT');
    expect(error?.message).toContain('/assets/fonts/NotThere.ttf');
    expect(() => new MobilePDFDocument({ font: '/assets/fonts/NotThere.ttf' })).toThrow(/ENOENT/);
  });

  it('the 14 standard fonts need no file (their metrics are inside the standalone build)', async () => {
    const doc = new MobilePDFDocument() as Doc;
    doc.font('Helvetica-Bold').text('standard', 50, 50);
    doc.font('Courier').text('fonts', 50, 80);
    expect(reads).toEqual([]);
    const pdf = (await finish(doc)).toString('latin1');
    expect(pdf).toContain('/BaseFont /Helvetica-Bold');
    expect(pdf).toContain('/BaseFont /Courier');
  });

  it('font bytes can still be passed directly', async () => {
    const doc = new MobilePDFDocument({ font: REGULAR }) as Doc;
    reads.length = 0;
    doc.font(new Uint8Array(nodeFs.readFileSync(nodePath.join(FONTS_DIR, 'DejaVuSans-Bold.ttf')))).text('bytes', 50, 50);
    expect(reads).toEqual([]);
    expect(doc._font.name).toBe('DejaVuSans-Bold');
    await finish(doc);
  });
});
