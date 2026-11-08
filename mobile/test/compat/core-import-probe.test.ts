// @vitest-environment node
/**
 * The core import probe: server modules are BUNDLED with the alias plugin (the way the worker of
 * the Android core will be built) and the bundle is then RUN in a JavaScript context that has no
 * Node.js: no `require`, no `process`, no `Buffer`, no file system, no fetch - only what a Web
 * Worker has (WebCrypto's getRandomValues, timers, TextEncoder, WebAssembly).
 *
 *   probe 1   security/kdf, security/container, db/schema, export/csv
 *             - the bundle has no `node:` import and no `require` of a Node built-in;
 *             - run without Node, it derives the same key, writes a container the desktop opens
 *               and opens a container the desktop wrote.
 *   probe 2   db/database (sql.js), export/* (pdfkit), the virtual file system
 *             - SQLite starts from the WebAssembly bytes it is handed (nothing is fetched);
 *             - the PDF export draws with font bytes registered in the virtual file system;
 *             - the outputs equal what the desktop modules produce from the same diary.
 *   probe 3   everything the core can reach: app.ts, every router, the services
 *             - bundles and evaluates without Node; the Node-only server modules are not part of
 *               it; exactly the expected shims are - the other stubs are unreachable.
 *
 * The full core (express shim, boot, worker) is WP-5; `express` is a stand-in here.
 */
import nodeCrypto, { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import { builtinModules } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mobileCoreAlias } from '../../core/alias-plugin';
import { sqlWasmBytes } from './fixtures';
import { openNativeServer, type NativeServer } from './native-server';
import type { ProbeInput, ProbeResult } from './probe-entry';
import type { CoreProbeInput, CoreProbeResult } from './probe-entry-core';

const projectRoot = process.cwd();
const ROOT = projectRoot.split(path.sep).join('/');
const FONTS_DIR = path.join(projectRoot, 'src-tauri', 'resources', 'server', 'fonts');
const DESKTOP_ASSETS_DIR = path.join(projectRoot, 'src-tauri', 'resources', 'server');

interface Bundle {
  /** The one output file. */
  code: string;
  /** Project-relative ids of the bundled modules (forward slashes). */
  modules: string[];
  /** Rendered code per module id (same keys as `modules`). */
  moduleCode: Map<string, string>;
  /** What the bundler left as an import of the output file (must be nothing). */
  external: string[];
}

interface OutputChunk {
  type: string;
  code: string;
  imports: string[];
  dynamicImports: string[];
  modules: Record<string, { code: string | null }>;
}

/** Bundles `entry` like a worker: one self-contained script (IIFE), not minified so it can be read. */
async function bundle(entry: string, options: { modules?: Record<string, string>; aliasPlugin?: boolean } = {}): Promise<Bundle> {
  const result = await build({
    configFile: false,
    root: projectRoot,
    mode: 'production',
    logLevel: 'error',
    plugins: options.aliasPlugin === false ? [] : [mobileCoreAlias({ projectRoot, modules: options.modules ?? {} })],
    resolve: { alias: { '@shared': path.join(projectRoot, 'shared') } },
    build: {
      write: false,
      minify: false,
      target: 'es2021',
      lib: { entry, formats: ['iife'], name: 'MpdCoreProbe', fileName: 'probe' },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]) as unknown as Array<{ output: OutputChunk[] }>;
  const files = outputs.flatMap((o) => o.output);
  // One file: nothing is split off that a worker started from a blob: URL would have to request.
  expect(files.map((f) => f.type)).toEqual(['chunk']);
  const chunk = files[0];
  const relative = (id: string): string => {
    const clean = id.split(path.sep).join('/');
    return clean.startsWith(`${ROOT}/`) ? clean.slice(ROOT.length + 1) : clean;
  };
  const moduleCode = new Map<string, string>();
  for (const [id, module] of Object.entries(chunk.modules)) moduleCode.set(relative(id), module.code ?? '');
  return { code: chunk.code, modules: [...moduleCode.keys()], moduleCode, external: [...chunk.imports, ...chunk.dynamicImports] };
}

const BUILTIN_NAMES = builtinModules
  .filter((name) => !name.startsWith('_'))
  .map((name) => name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))
  .join('|');

/**
 * What the bundler could not put into the file: imports it left in the output, and Vite's empty
 * stand-in for a Node built-in (a browser build that meets `node:crypto` without a plugin gets a
 * module that throws on first use - silently, at build time).
 */
function unresolvedBuiltins(bundled: Bundle): string[] {
  return [...bundled.external, ...bundled.modules.filter((id) => id.includes('__vite-browser-external'))];
}

/** Every way a script can still ask for a Node module, found in `code`. */
function nodeReferences(code: string): string[] {
  const patterns = [
    /\bfrom\s*["'`]node:[^"'`\n]+["'`]/g,
    /\bimport\s*\(\s*["'`]node:[^"'`\n]+["'`]\s*\)/g,
    /\bimport\s*["'`]node:[^"'`\n]+["'`]/g,
    /\brequire\s*\(\s*["'`]node:[^"'`\n]+["'`]\s*\)/g,
    new RegExp(`\\brequire\\s*\\(\\s*["'\`](?:${BUILTIN_NAMES})["'\`]\\s*\\)`, 'g'),
    new RegExp(`\\b(?:from|import)\\s*\\(?\\s*["'\`](?:${BUILTIN_NAMES})["'\`]`, 'g'),
    // What Vite puts in place of a Node built-in in a browser build when no plugin resolved it.
    /__vite-browser-external/g,
    // A specifier the alias plugin rewrote and nothing resolved.
    /mobile-core-import:/g,
  ];
  // Comments are kept in an unminified bundle; a comment may well mention `from 'node:fs'`.
  const withoutCommentLines = code
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');
  return patterns.flatMap((pattern) => withoutCommentLines.match(pattern) ?? []);
}

/**
 * pdfkit.standalone.js is a browserify bundle: its modules call a LOCAL `require` (a parameter of
 * each module wrapper) with names like "buffer" or "events", resolved inside the file. Those are
 * not Node requires; the text check therefore looks at every module but that one, and the run in
 * the Node-less context covers it.
 */
const SELF_CONTAINED_VENDOR = /node_modules\/pdfkit\/js\/pdfkit\.standalone\.js$/;

function nodeReferencesOutsideVendor(bundled: Bundle): string[] {
  const hits: string[] = [];
  for (const [id, code] of bundled.moduleCode) {
    if (SELF_CONTAINED_VENDOR.test(id)) continue;
    for (const hit of nodeReferences(code)) hits.push(`${id}: ${hit}`);
  }
  return hits;
}

/** The globals a Web Worker shares with Node - and nothing of Node itself. */
function workerLikeContext(): vm.Context {
  const context = vm.createContext({
    crypto: webcrypto,
    TextEncoder,
    TextDecoder,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    performance,
    URL,
    URLSearchParams,
    console,
  });
  vm.runInContext('globalThis.self = globalThis;', context);
  return context;
}

function globalTypes(context: vm.Context): Record<string, string> {
  return JSON.parse(
    vm.runInContext(
      'JSON.stringify(Object.fromEntries(["require","process","Buffer","module","exports","__dirname","setImmediate","fetch","XMLHttpRequest","importScripts","document","window","WebAssembly"].map((n) => [n, typeof globalThis[n]])))',
      context,
    ) as string,
  ) as Record<string, string>;
}

/** Evaluates the bundle in a fresh Node-less context and returns what it exports. */
function load<T>(bundled: Bundle): { exports: T; context: vm.Context } {
  const context = workerLikeContext();
  vm.runInContext(bundled.code, context, { filename: 'probe.iife.js' });
  return { exports: vm.runInContext('MpdCoreProbe', context) as T, context };
}

// PDF reading (enough to compare two files) ------------------------------------------------------

interface PdfSummary {
  pages: number;
  /** PostScript names of the embedded fonts without the random subset tag ("ABCDEF+"). */
  fonts: string[];
  /** The inflated content stream of every page, in page order. */
  pageContents: string[];
}

function summarizePdf(pdf: Buffer): PdfSummary {
  const text = pdf.toString('latin1');
  expect(text.startsWith('%PDF-1')).toBe(true);
  expect(text.trimEnd().endsWith('%%EOF')).toBe(true);

  const objects = new Map<number, { dict: string; stream: Buffer | null }>();
  const objectPattern = /(\d+) 0 obj\n([\s\S]*?)\nendobj/g;
  for (let match = objectPattern.exec(text); match; match = objectPattern.exec(text)) {
    const body = match[2];
    const streamAt = body.indexOf('stream\n');
    if (streamAt < 0) {
      objects.set(Number(match[1]), { dict: body, stream: null });
      continue;
    }
    const dict = body.slice(0, streamAt);
    const start = match.index + match[0].indexOf(body) + streamAt + 'stream\n'.length;
    const end = match.index + match[0].lastIndexOf('\nendstream');
    const raw = pdf.subarray(start, end);
    objects.set(Number(match[1]), { dict, stream: /\/FlateDecode/.test(dict) ? zlib.inflateSync(raw) : Buffer.from(raw) });
  }

  const pages = [...objects.values()].filter((o) => /\/Type \/Page(?!s)/.test(o.dict));
  const pageContents = pages.map((page) => {
    const ref = /\/Contents (\d+) 0 R/.exec(page.dict);
    return ref ? (objects.get(Number(ref[1]))?.stream?.toString('latin1') ?? '') : '';
  });
  const fonts = [...text.matchAll(/\/FontName \/(?:[A-Z]{6}\+)?([\w-]+)/g)].map((m) => m[1]);
  return { pages: pages.length, fonts: [...new Set(fonts)].sort(), pageContents };
}

// -------------------------------------------------------------------------------------------------

let native: NativeServer;

beforeAll(async () => {
  native = await openNativeServer();
}, 120_000);

afterAll(async () => {
  await native?.close();
});

describe('core import probe 1: kdf, container, schema and csv bundled for a worker', () => {
  let bundled: Bundle;
  let probe: { run(input: ProbeInput): Promise<ProbeResult> };
  let context: vm.Context;

  beforeAll(async () => {
    bundled = await bundle(path.join(projectRoot, 'mobile', 'test', 'compat', 'probe-entry.ts'));
    ({ exports: probe, context } = load<typeof probe>(bundled));
  }, 120_000);

  it('the bundle contains the four server modules, on the shims', () => {
    expect(bundled.modules).toEqual(
      expect.arrayContaining([
        'server/src/security/kdf.ts',
        'server/src/security/container.ts',
        'server/src/db/schema.ts',
        'server/src/export/csv.ts',
        'mobile/core/shims/crypto.ts',
        'mobile/core/shims/buffer.ts',
        'mobile/core/shims/globals.ts',
        'node_modules/@noble/hashes/scrypt.js',
        'node_modules/@noble/ciphers/aes.js',
        'node_modules/buffer/index.js',
      ]),
    );
    // One copy of every shim: a file that got two module ids would exist twice (two Buffer classes).
    expect(new Set(bundled.modules).size).toBe(bundled.modules.length);
    expect(bundled.modules.filter((id) => /shims\/buffer\.ts$/.test(id))).toHaveLength(1);
  });

  it('has no unresolved "node:" import and no require of a Node built-in', () => {
    expect(unresolvedBuiltins(bundled)).toEqual([]);
    expect(nodeReferences(bundled.code)).toEqual([]);
    // The check itself finds what it looks for.
    expect(nodeReferences('import a from "node:fs"; const b = require("crypto"); await import(\'node:os\'); import "path";')).toHaveLength(4);
    expect(nodeReferences('const x = 1;\n  // like import fs from "node:fs"\n   * or require("crypto") in a comment\nconst y = 2;')).toEqual([]);
  });

  it('the check is sharp: the same module bundled WITHOUT the alias plugin is flagged', async () => {
    const plain = await bundle(path.join(projectRoot, 'server', 'src', 'security', 'kdf.ts'), { aliasPlugin: false });
    expect(unresolvedBuiltins(plain)).not.toEqual([]);
    expect(plain.modules.some((id) => id.startsWith('mobile/core/shims/'))).toBe(false);
  }, 120_000);

  it('pulls in nothing the four modules do not need: no SQLite, no PDF writer, no file system', () => {
    const unexpected = bundled.modules.filter((id) => /sql\.js|pdfkit|shims\/(sqljs|pdfkit|fs|net|tls|http|https|dns|dgram|os)\.ts|core\/vfs\//.test(id));
    expect(unexpected).toEqual([]);
    expect(bundled.modules.some((id) => /server\/src\/(remote\/|server\.ts|index\.ts|mail\/node-transport|middleware\/host-check)/.test(id))).toBe(false);
  });

  it('loads in a context without Node.js', () => {
    const types = globalTypes(context);
    // Installed by shims/globals.ts for third-party code; none of them is Node's.
    expect(types).toMatchObject({ require: 'undefined', module: 'undefined', exports: 'undefined', __dirname: 'undefined', fetch: 'undefined', document: 'undefined' });
    expect(types).toMatchObject({ process: 'object', Buffer: 'function', setImmediate: 'function' });
    expect(vm.runInContext('typeof process.versions.node + "/" + process.platform + "/" + typeof process.binding', context)).toBe('undefined/android/undefined');
    expect(typeof probe.run).toBe('function');
  });

  it('run there, it derives the key of the desktop, writes a container the desktop opens and opens one the desktop wrote', async () => {
    const nodeKdf = await native.load<typeof import('../../../server/src/security/kdf')>('security/kdf');
    const nodeContainer = await native.load<typeof import('../../../server/src/security/container')>('security/container');
    const nodeCsv = await native.load<typeof import('../../../server/src/export/csv')>('export/csv');

    const password = 'Probe-Passw0rd סיסמה ｆｕｌｌ كلمة 密码 🔑';
    const salt = nodeCrypto.randomBytes(16);
    const plain = nodeCrypto.randomBytes(70_000);
    const desktopSecret = await nodeKdf.deriveSecret(password, salt);
    const desktopKey = nodeKdf.splitSecret(desktopSecret);
    const desktopPlain = Buffer.from('written on the desktop: שלום, مرحبا, こんにちは', 'utf8');
    const desktopContainer = nodeContainer.encryptContainer(desktopPlain, desktopKey.key, salt);

    const exportData: ProbeInput['exportData'] = {
      user: { id: 'u_probe', username: 'probe', firstName: 'נועה', lastName: 'לדוגמה', email: '', createdAt: '2026-01-01T00:00:00.000Z' },
      locale: 'he',
      from: null,
      to: null,
      exportedAt: '2026-10-02T09:30:00.000Z',
      entries: [
        {
          id: 1,
          date: '2026-09-28',
          time: '08:30',
          title: 'בוקר, "טוב"',
          body: 'שורה ראשונה\nשורה שנייה; =SUM(A1)',
          mood: 4,
          emotions: [],
          energy: 3,
          stress: null,
          sleepQuality: null,
          sleepHours: 7.5,
          exerciseMinutes: 0,
          exerciseType: 'הליכה',
          events: ['ארוחה'],
          people: ['דמות בדויה', 'another, one'],
          location: '',
          notes: '',
          tags: ['probe'],
          createdAt: '2026-09-28T08:30:00.000Z',
          updatedAt: '2026-09-28T08:30:00.000Z',
        },
      ],
      includeHabits: false,
      habits: [],
      habitLogs: [],
    };

    const result = await probe.run({
      password,
      saltHex: salt.toString('hex'),
      plainHex: plain.toString('hex'),
      desktopContainerHex: desktopContainer.toString('hex'),
      exportData,
    });

    expect(result.environment).toEqual({ hasRequire: false, hasNodeProcess: false, platform: 'android', bufferIsPolyfill: true });
    // Same password, same salt -> the same 64 bytes as node:crypto, and the same verifier.
    expect(result.secretHex).toBe(desktopSecret.toString('hex'));
    expect(result.verifierHex).toBe(nodeKdf.verifierHex(desktopKey.verifierSource));
    // The container written without Node opens under Node, with the key and with the password.
    const sealed = Buffer.from(result.containerHex, 'hex');
    expect(nodeContainer.isContainer(sealed)).toBe(true);
    expect(nodeContainer.decryptContainer(sealed, desktopKey.key).plain.equals(plain)).toBe(true);
    expect((await nodeContainer.decryptWithPassword(sealed, password)).plain.equals(plain)).toBe(true);
    expect(result.reopenedHex).toBe(plain.toString('hex'));
    // The container written under Node opened there.
    expect(result.desktopPlainHex).toBe(desktopPlain.toString('hex'));
    expect(result.wrongPasswordCode).toBe('WRONG_PASSWORD');
    // The other two modules.
    const nodeSchema = await native.load<typeof import('../../../server/src/db/schema')>('db/schema');
    expect(result.schemaVersion).toBe(nodeSchema.SCHEMA_VERSION);
    const statements: string[] = [];
    nodeSchema.applySchema({
      get: () => ({ n: 0 }),
      exec: (sql: string) => void statements.push(sql),
      run: (sql: string, params?: unknown[]) => void statements.push(`${sql} ${JSON.stringify(params ?? [])}`),
      transaction: (work: () => void) => work(),
    } as unknown as Parameters<typeof nodeSchema.applySchema>[0]);
    expect(statements.length).toBeGreaterThanOrEqual(2);
    expect(result.schemaStatements).toBe(statements.length);
    expect(result.schemaSha256).toBe(nodeCrypto.createHash('sha256').update(statements.join('\n'), 'utf8').digest('hex'));
    expect(result.newerSchemaMessage).toBe(new nodeSchema.NewerSchemaError(nodeSchema.SCHEMA_VERSION + 1).message);
    expect(result.csvHeader).toEqual(nodeCsv.csvHeader('he'));
    expect(result.csvHex).toBe(nodeCsv.exportCsv(exportData).toString('hex'));
  }, 120_000);
});

describe('core import probe 2: SQLite and the PDF writer without Node.js', () => {
  const password = 'Phone-Passw0rd טלפון 📱';
  const user = { id: 'u_probe', username: 'probe_user', firstName: 'נועה', lastName: 'לדוגמה', email: '', createdAt: '2026-01-01T00:00:00.000Z' };
  // Hebrew, Arabic, Thai, Devanagari, Latin with diacritics: every bundled font family is used.
  // (No Chinese / Japanese: those glyphs come from system fonts, which differ per platform.)
  const entries = [
    { date: '2026-09-28', time: '08:30', title: 'בוקר טוב', body: 'רשומה שנכתבה בטלפון.\nשורה שנייה עם English ומספרים 123.', mood: 4, emotions: [], events: ['ארוחת בוקר'], people: ['דמות בדויה'], tags: ['phone'] },
    { date: '2026-09-29', time: '22:10', title: 'يوم هادئ', body: 'كتبت اليوم في اليوميات (100%).', mood: 3, emotions: [], events: [], people: [], tags: [] },
    { date: '2026-09-30', time: '07:00', title: 'Zażółć gęślą jaźń', body: 'สวัสดีครับ วันนี้อากาศดี\nनमस्ते, आज का दिन अच्छा था।\nΚαλημέρα — Привет', mood: 5, emotions: [], events: [], people: [], tags: ['scripts'] },
    { date: '2026-10-01', time: '06:15', title: '', body: 'א'.repeat(6000), emotions: [], events: [], people: [], tags: [] },
  ];
  let bundled: Bundle;
  let context: vm.Context;
  let result: CoreProbeResult;

  beforeAll(async () => {
    bundled = await bundle(path.join(projectRoot, 'mobile', 'test', 'compat', 'probe-entry-core.ts'));
    const loaded = load<{ run(input: CoreProbeInput): Promise<CoreProbeResult> }>(bundled);
    context = loaded.context;
    const fontsBase64: Record<string, string> = {};
    for (const name of fs.readdirSync(FONTS_DIR)) {
      if (name.endsWith('.ttf')) fontsBase64[name] = fs.readFileSync(path.join(FONTS_DIR, name)).toString('base64');
    }
    result = await loaded.exports.run({ sqlWasmBase64: sqlWasmBytes().toString('base64'), fontsBase64, password, entries, user, locale: 'he' });
  }, 180_000);

  it('the bundle is self-contained: the browser builds of sql.js and pdfkit, the virtual file system, no Node module', () => {
    expect(unresolvedBuiltins(bundled)).toEqual([]);
    expect(nodeReferencesOutsideVendor(bundled)).toEqual([]);
    expect(bundled.modules).toEqual(
      expect.arrayContaining([
        'server/node_modules/sql.js/dist/sql-wasm-browser.js',
        'server/node_modules/pdfkit/js/pdfkit.standalone.js',
        'mobile/core/shims/sqljs.ts',
        'mobile/core/shims/pdfkit.ts',
        'mobile/core/shims/fs.ts',
        'mobile/core/vfs/node-fs.ts',
        'server/src/db/database.ts',
        'server/src/export/pdf.ts',
        'server/src/export/fonts.ts',
      ]),
    );
    // The Node builds of the two packages are not in it.
    expect(bundled.modules.filter((id) => /sql\.js\/dist\/sql-wasm\.js$|pdfkit\/js\/pdfkit(\.es)?\.js$/.test(id))).toEqual([]);
    // util/paths.ts (import.meta.url, createRequire) was replaced by shims/paths.ts.
    expect(bundled.modules).toContain('mobile/core/shims/paths.ts');
    expect(bundled.modules).not.toContain('server/src/util/paths.ts');
  });

  it('nothing in it needs eval (the WebView CSP allows wasm-unsafe-eval only)', () => {
    expect(bundled.code.match(/\bnew Function\s*\(|\beval\s*\(|\bFunction\s*\(\s*["'`]return this["'`]\s*\)/g) ?? []).toEqual([]);
  });

  it('ran in a context without Node.js, fetch, XMLHttpRequest or importScripts', () => {
    expect(globalTypes(context)).toMatchObject({
      require: 'undefined',
      module: 'undefined',
      fetch: 'undefined',
      XMLHttpRequest: 'undefined',
      importScripts: 'undefined',
      document: 'undefined',
      window: 'undefined',
      WebAssembly: 'object',
    });
  });

  it('before the host hands over sql-wasm.wasm and the fonts, the errors are clear ones', () => {
    expect(result.sqlInitBeforeWasm).toMatch(/the WebAssembly binary was not provided - call provideSqlWasm/);
    expect(result.pdfBeforeFonts).toMatch(/^EXPORT: /);
  });

  it('the diary created there opens on the desktop with the same rows', async () => {
    const nodeContainer = await native.load<typeof import('../../../server/src/security/container')>('security/container');
    const nodeDatabase = await native.load<typeof import('../../../server/src/db/database')>('db/database');
    const nodeEntries = await native.load<typeof import('../../../server/src/db/entries-repo')>('db/entries-repo');
    const opened = await nodeContainer.decryptWithPassword(Buffer.from(result.containerBase64, 'base64'), password);
    const db = await nodeDatabase.DiaryDb.fromImage(opened.plain);
    try {
      const rows = nodeEntries.listEntriesFull(db, null, null);
      expect(rows).toHaveLength(entries.length);
      expect(JSON.stringify(rows)).toBe(result.entriesJson);
    } finally {
      db.close();
    }
  }, 60_000);

  it('TXT, CSV and JSON exports are byte for byte the desktop ones; the PDF has the same pages, fonts and drawing commands', async () => {
    const nodeContainer = await native.load<typeof import('../../../server/src/security/container')>('security/container');
    const nodeDatabase = await native.load<typeof import('../../../server/src/db/database')>('db/database');
    const nodeExport = await native.load<typeof import('../../../server/src/export/index')>('export/index');
    const nodeFonts = await native.load<typeof import('../../../server/src/export/fonts')>('export/fonts');
    const nodePdf = await native.load<typeof import('../../../server/src/export/pdf')>('export/pdf');

    const opened = await nodeContainer.decryptWithPassword(Buffer.from(result.containerBase64, 'base64'), password);
    const db = await nodeDatabase.DiaryDb.fromImage(opened.plain);
    try {
      const data = nodeExport.collectExportData(db, { format: 'pdf', includeHabits: true }, user, 'he', new Date('2026-10-02T09:30:00.000Z'));
      for (const format of ['txt', 'csv', 'json'] as const) {
        const desktop = await nodeExport.renderExport(data, format, DESKTOP_ASSETS_DIR);
        expect(result[`${format}Base64`], format).toBe(desktop.toString('base64'));
      }

      // The four bundled families were found in the virtual file system, as on the desktop.
      expect(result.fontFamilies).toEqual(['arabic', 'devanagari', 'latin', 'thai']);
      // The desktop reference uses the bundled fonts only (no system CJK fonts, as on the phone).
      const fontSet = nodeFonts.resolvePdfFontSet(DESKTOP_ASSETS_DIR, { systemFontsDir: null });
      expect(Object.keys(fontSet).sort()).toEqual(result.fontFamilies);
      const desktopPdf = summarizePdf(await nodePdf.exportPdf(data, DESKTOP_ASSETS_DIR, { fontSet }));
      const phonePdf = summarizePdf(Buffer.from(result.pdfBase64, 'base64'));

      expect(phonePdf.pages).toBeGreaterThanOrEqual(2);
      expect(phonePdf.pages).toBe(desktopPdf.pages);
      expect(phonePdf.fonts).toEqual(desktopPdf.fonts);
      expect(phonePdf.fonts).toEqual(expect.arrayContaining(['DejaVuSans', 'DejaVuSans-Bold', 'NotoSansArabic-Regular', 'NotoSansThai-Regular', 'NotoSansDevanagari-Regular']));
      // Same text runs at the same positions with the same glyphs, page by page.
      expect(phonePdf.pageContents).toEqual(desktopPdf.pageContents);
      expect(phonePdf.pageContents.every((content) => content.length > 0)).toBe(true);
    } finally {
      db.close();
    }
  }, 120_000);
});

describe('core import probe 3: everything the core can reach from app.ts, the routers and the services', () => {
  /** The composition of server.ts minus what only runs under Node (the mobile core has its own, WP-5). */
  const COMPOSITION = ['app.ts', 'config.ts', 'mail/service.ts', 'mail/transport.ts', 'security/auth-service.ts', 'security/device-key.ts', 'security/owner.ts', 'security/password-reset.ts'];
  let tmp: string;
  let bundled: Bundle;
  let entryModules: string[];

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mpd-core-probe-'));
    // A stand-in so that the graph can be bundled and evaluated; the real express shim is WP-5.
    const expressStub = path.join(tmp, 'express-stub.js');
    fs.writeFileSync(
      expressStub,
      [
        "const chain = () => new Proxy(function () {}, { get: (_t, p) => (p === 'then' ? undefined : chain()), apply: () => chain() });",
        'export function Router() { return chain(); }',
        'const express = Object.assign(function express() { return chain(); }, { Router, json: chain, static: chain, raw: chain, text: chain, urlencoded: chain });',
        'export default express;',
        '',
      ].join('\n'),
    );
    const routes = fs
      .readdirSync(path.join(projectRoot, 'server', 'src', 'routes'))
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts'))
      .map((name) => `routes/${name}`);
    entryModules = [...COMPOSITION, ...routes];
    const entry = path.join(tmp, 'entry.js');
    fs.writeFileSync(
      entry,
      [
        `import ${JSON.stringify(`${ROOT}/mobile/core/shims/globals.ts`)};`,
        ...entryModules.map((module, i) => `import * as m${i} from ${JSON.stringify(`${ROOT}/server/src/${module}`)};`),
        `export const modules = { ${entryModules.map((module, i) => `${JSON.stringify(module)}: m${i}`).join(', ')} };`,
        '',
      ].join('\n'),
    );
    bundled = await bundle(entry, { modules: { express: expressStub } });
  }, 180_000);

  afterAll(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('bundles: every Node built-in and Node-only package the graph imports has a mobile replacement', () => {
    expect(unresolvedBuiltins(bundled)).toEqual([]);
    expect(nodeReferencesOutsideVendor(bundled)).toEqual([]);
    const server = bundled.modules.filter((id) => id.startsWith('server/src/'));
    expect(server.length).toBeGreaterThan(70);
    for (const router of entryModules) expect(server, router).toContain(`server/src/${router}`);
    console.info(
      `[core probe] ${server.length} server modules + shims bundle to ${(bundled.code.length / 1024 / 1024).toFixed(1)} MB unminified ` +
        `(pdfkit standalone ${((bundled.moduleCode.get('server/node_modules/pdfkit/js/pdfkit.standalone.js')?.length ?? 0) / 1024 / 1024).toFixed(1)} MB, ` +
        `shared/i18n ${(bundled.modules.filter((id) => id.startsWith('shared/i18n/')).reduce((sum, id) => sum + (bundled.moduleCode.get(id)?.length ?? 0), 0) / 1024 / 1024).toFixed(1)} MB)`,
    );
  });

  it('the Node-only server modules are not reachable from it', () => {
    const nodeOnly = bundled.modules.filter((id) => /^server\/src\/(remote\/|server\.ts$|index\.ts$|mail\/node-transport\.ts$|middleware\/host-check\.ts$|util\/paths\.ts$)/.test(id));
    expect(nodeOnly).toEqual([]);
    // Nothing of the real Express, and the Node builds of sql.js / pdfkit are not in it either.
    expect(bundled.modules.filter((id) => /node_modules\/(express|body-parser|router|qs|send|serve-static)\//.test(id))).toEqual([]);
    expect(bundled.modules.filter((id) => /sql\.js\/dist\/sql-wasm\.js$|pdfkit\/js\/pdfkit(\.es)?\.js$/.test(id))).toEqual([]);
  });

  it('exactly these shims are reachable; the socket / HTTP / DNS stubs are never imported by the core', () => {
    const shims = bundled.modules.filter((id) => id.startsWith('mobile/core/shims/')).map((id) => id.slice('mobile/core/shims/'.length)).sort();
    expect(shims).toEqual(['buffer.ts', 'crypto.ts', 'fs.ts', 'globals.ts', 'os.ts', 'path.ts', 'paths.ts', 'pdfkit.ts', 'process.ts', 'sqljs.ts', 'unavailable.ts']);
    // node:net, node:tls, node:http(s), node:dns, node:dgram, node:url, node:module and
    // node:string_decoder are imported only by the Node-only modules (or as types).
    const packageOf = (id: string): string => {
      const parts = id.slice(id.lastIndexOf('node_modules/') + 'node_modules/'.length).split('/');
      return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
    };
    const thirdParty = bundled.modules.filter((id) => id.includes('node_modules/')).map(packageOf);
    expect([...new Set(thirdParty)].sort()).toEqual(['@noble/ciphers', '@noble/hashes', 'base64-js', 'bidi-js', 'buffer', 'ieee754', 'path-browserify', 'pdfkit', 'sql.js']);
  });

  it('evaluates in a context without Node.js: no module needs Node while it is being imported', () => {
    const { exports, context } = load<{ modules: Record<string, Record<string, unknown>> }>(bundled);
    expect(globalTypes(context)).toMatchObject({ require: 'undefined', module: 'undefined', fetch: 'undefined' });
    expect(Object.keys(exports.modules).sort()).toEqual([...entryModules].sort());
    expect(typeof exports.modules['app.ts'].createApp).toBe('function');
    expect(typeof exports.modules['security/auth-service.ts'].createAuthService).toBe('function');
    expect(typeof exports.modules['routes/auth.ts'].authRouter).toBe('function');
  });
});
