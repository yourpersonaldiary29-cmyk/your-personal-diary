/**
 * Vite / vitest plugin that lets the server code (server/src, shared/) run UNCHANGED inside the
 * Android core - a Web Worker without Node.js. It is build tooling: it runs in Node and is never
 * part of a bundle.
 *
 * For importers inside the core scope (server/src/**, shared/**, mobile/core/shims/**):
 *   - Node built-ins ('node:crypto', 'fs', ...)  -> mobile/core/shims/<name>.ts
 *       node:fs -> shims/fs.ts, the virtual file system (WP-4); while that file does not exist,
 *       -> shims/fs-missing.ts (importable, every call throws)
 *       a built-in without a shim fails the build ("no mobile shim")
 *   - 'sql.js' -> shims/sqljs.ts, 'pdfkit' -> shims/pdfkit.ts
 *   - server/src/util/paths.ts -> shims/paths.ts (module-location helpers)
 *   - 'express' -> the file given in `modules.express` (the express shim of WP-5); without it the
 *     build fails rather than bundle the real Express
 *   - the Node-only server modules (remote/**, mail/node-transport.ts, middleware/host-check.ts,
 *     server.ts, index.ts) fail the build: they must never be part of the mobile core
 * For every importer:
 *   - 'mobile-vendor:sql.js' / 'mobile-vendor:pdfkit' -> the browser builds in server/node_modules
 *   - 'mobile-core:globals' -> shims/globals.ts
 * Importers anywhere else (src/**, mobile/host/**, tests, node_modules) are left untouched.
 *
 * How: a `transform` step rewrites the import specifiers of core modules ('node:crypto' ->
 * 'mobile-core-import:node:crypto') and `resolveId` maps the rewritten specifier to the shim. The
 * rewrite is needed because vitest (like every Vite SSR pipeline) hands Node built-ins straight to
 * Node without asking any plugin; a plain `resolveId` covers the same cases for bundlers that do
 * ask. Imports that TypeScript erases (`import type`) never reach `resolveId`, so a type-only
 * import of a Node-only module is harmless.
 * The specifiers are taken from the syntax tree of the module (Vite's own parser, `parseSync`):
 * import / export ... from, import(), require() and `import x = require()`. Text that merely reads
 * like an import - a message "restore from 'fs' now", a template, a comment - is never touched.
 *
 * The same step gives server modules their Node globals: a module of server/src or shared/ that
 * names `Buffer`, `process`, `setImmediate` or `clearImmediate` gets an import of them from
 * shims/globals.ts prepended (same line, so line numbers stay) - unless the module binds that name
 * itself at module level, which is read from its syntax tree (Vite's own parser, `parseSync`).
 *
 * Usage (vite / vitest config; for an inline worker also in `worker.plugins`):
 *   plugins: [mobileCoreAlias({ modules: { express: '<root>/mobile/core/express-shim.ts' } })]
 */
import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync, type Plugin } from 'vite';

export interface MobileAliasOptions {
  /** Directory that holds server/, shared/ and mobile/. Default: two levels above this file. */
  projectRoot?: string;
  /**
   * Extra or replacement targets: module specifier (a built-in without its 'node:' prefix, or a
   * package name) -> absolute file. Example: `{ express: '<root>/mobile/core/express-shim.ts' }`.
   */
  modules?: Record<string, string>;
  /** More directories (absolute) whose imports are redirected like those of server/src. */
  extraScopes?: string[];
  /** Fail when a Node-only server module is imported from the core scope. Default: true. */
  forbidNodeOnlyModules?: boolean;
  /** Prepend the import of Buffer / process / setImmediate to server modules that use them. Default: true. */
  injectGlobals?: boolean;
}

/** Node built-in (without 'node:') -> file in mobile/core/shims. */
export const NODE_SHIMS: Readonly<Record<string, string>> = {
  crypto: 'crypto.ts',
  fs: 'fs.ts',
  path: 'path.ts',
  'path/posix': 'path.ts',
  os: 'os.ts',
  net: 'net.ts',
  http: 'http.ts',
  https: 'https.ts',
  tls: 'tls.ts',
  dns: 'dns.ts',
  dgram: 'dgram.ts',
  url: 'url.ts',
  module: 'module.ts',
  string_decoder: 'string_decoder.ts',
  buffer: 'buffer.ts',
  process: 'process.ts',
};

/** Used for node:fs while shims/fs.ts (WP-4) is not in the tree. */
export const FS_PLACEHOLDER = 'fs-missing.ts';

/** Package -> file in mobile/core/shims. */
export const PACKAGE_SHIMS: Readonly<Record<string, string>> = {
  'sql.js': 'sqljs.ts',
  pdfkit: 'pdfkit.ts',
};

/** Specifier used by the shims -> file below the project root. */
export const VENDOR_FILES: Readonly<Record<string, string>> = {
  'mobile-vendor:sql.js': 'server/node_modules/sql.js/dist/sql-wasm-browser.js',
  'mobile-vendor:pdfkit': 'server/node_modules/pdfkit/js/pdfkit.standalone.js',
};

/** Specifier of the injected globals import. */
export const GLOBALS_SPECIFIER = 'mobile-core:globals';

/** Prefix the transform step puts in front of a specifier that `resolveId` must redirect. */
export const REWRITE_PREFIX = 'mobile-core-import:';

/** Packages that need an explicit mobile replacement (`modules`): the real ones need Node. */
export const NODE_ONLY_PACKAGES: readonly string[] = ['express'];

/** Server modules (relative to server/src, without extension) that only run under Node. */
export const NODE_ONLY_SERVER_MODULES: readonly string[] = ['mail/node-transport', 'middleware/host-check', 'server', 'index'];
/** Server directories (relative to server/src) that only run under Node. */
export const NODE_ONLY_SERVER_DIRS: readonly string[] = ['remote'];

/** Globals a server module may name; each is imported from shims/globals.ts when it does. */
export const INJECTED_GLOBALS: readonly string[] = ['Buffer', 'process', 'setImmediate', 'clearImmediate'];

const PLUGIN_NAME = 'mobile-core-alias';
const BUILTINS = new Set(builtinModules);
const CASE_INSENSITIVE = process.platform === 'win32';

/** Forward slashes, no query / hash, and (on Windows) lower case: comparable path of a module id. */
export function comparablePath(id: string): string {
  let clean = id;
  const cut = clean.search(/[?#]/);
  if (cut >= 0) clean = clean.slice(0, cut);
  clean = clean.replace(/^\0+/, '').split('\\').join('/');
  if (clean.startsWith('/@fs/')) clean = clean.slice('/@fs/'.length);
  return CASE_INSENSITIVE ? clean.toLowerCase() : clean;
}

/** `map[key]` when the map itself has that key (never something inherited, like 'constructor' or 'toString'). */
function own<T>(map: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
}

function fail(message: string): never {
  throw new Error(`[${PLUGIN_NAME}] ${message}`);
}

export interface MobileResolver {
  /** Absolute project root. */
  readonly root: string;
  /** True when imports of this module are redirected (server/src, shared, mobile/core/shims, extra scopes). */
  isCoreImporter(importer: string | undefined): boolean;
  /** True when this module gets the Node globals injected (server/src, shared, extra scopes - not the shims). */
  isServerModule(id: string): boolean;
  /**
   * The replacement file of `source` imported by `importer` (forward slashes), or null: resolve as
   * usual. Throws for what must not be bundled. A specifier the transform step rewrote
   * (REWRITE_PREFIX + specifier) resolves like the original one.
   */
  resolve(source: string, importer: string | undefined): string | null;
  /** True for a bare specifier that core modules must not resolve the Node way (built-ins, shimmed packages). */
  isRedirected(specifier: string): boolean;
  /**
   * `code` of a core module with its redirected import specifiers rewritten, or null when nothing
   * changes. Only real specifiers change (see moduleSpecifiers); the line count stays. `id` is the
   * module's file name (for its language; TypeScript when it is missing).
   */
  rewriteImports(code: string, id?: string): string | null;
}

/** Text between two quote characters on one line: every place a literal specifier can stand (and many others). */
const QUOTED_TEXT = /(?<=["'`])[^"'`\n]+(?=["'`])/g;

/**
 * `from '...'`, `import '...'`, `import('...')`, `require('...')` with a literal specifier, as a
 * text pattern: only for code that does not parse (rewriteImports); it cannot tell code from text.
 */
const IMPORT_SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\brequire\s*\(\s*)(["'])([^"'\n]+)\2/g;

/** The resolution rules as plain functions (the plugin and its unit tests use them). */
export function createMobileResolver(options: MobileAliasOptions = {}): MobileResolver {
  const root = path.resolve(options.projectRoot ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
  const shimsDir = path.join(root, 'mobile', 'core', 'shims');
  const serverSrc = path.join(root, 'server', 'src');
  const overrides = options.modules ?? {};
  const forbidNodeOnly = options.forbidNodeOnlyModules !== false;

  const dirPrefix = (dir: string): string => `${comparablePath(path.resolve(dir))}/`;
  const serverPrefix = dirPrefix(serverSrc);
  const shimsPrefix = dirPrefix(shimsDir);
  const serverScopes = [serverPrefix, dirPrefix(path.join(root, 'shared')), ...(options.extraScopes ?? []).map(dirPrefix)];
  const coreScopes = [...serverScopes, shimsPrefix];

  /** Module ids use forward slashes (as Vite writes them): one file must never get two ids. */
  const moduleId = (file: string): string => path.resolve(file).split(path.sep).join('/');
  const shim = (file: string): string => moduleId(path.join(shimsDir, file));
  const within = (id: string | undefined, scopes: string[]): boolean => {
    if (!id) return false;
    const comparable = comparablePath(id);
    return scopes.some((scope) => comparable.startsWith(scope));
  };
  const builtinName = (source: string): string | null => {
    if (source.startsWith('node:')) return source.slice('node:'.length);
    return BUILTINS.has(source) ? source : null;
  };

  function resolveBuiltin(name: string, source: string, importer: string): string {
    const override = own(overrides, name) ?? own(overrides, `node:${name}`);
    if (override) return moduleId(override);
    if (name === 'fs') {
      const vfs = shim(NODE_SHIMS.fs);
      return fs.existsSync(vfs) ? vfs : shim(FS_PLACEHOLDER);
    }
    const file = own(NODE_SHIMS, name);
    if (!file) fail(`no mobile shim for the Node built-in "${source}" (imported by ${importer}): add one to mobile/core/shims or keep that module out of the mobile core`);
    return shim(file);
  }

  /** `source` relative to server/src without extension ('util/paths'), or null when it is elsewhere. */
  function serverModule(source: string, importer: string): string | null {
    const target = comparablePath(path.resolve(path.dirname(importer.replace(/[?#].*$/, '')), source));
    if (!target.startsWith(serverPrefix)) return null;
    return target.slice(serverPrefix.length).replace(/\.(ts|js|mjs)$/, '');
  }

  function isRedirected(specifier: string): boolean {
    return builtinName(specifier) !== null || own(PACKAGE_SHIMS, specifier) !== undefined || own(overrides, specifier) !== undefined || NODE_ONLY_PACKAGES.includes(specifier);
  }

  function resolve(rawSource: string, importer: string | undefined): string | null {
    const source = rawSource.startsWith(REWRITE_PREFIX) ? rawSource.slice(REWRITE_PREFIX.length) : rawSource;
    const vendor = own(VENDOR_FILES, source);
    if (vendor) {
      const file = path.join(root, vendor);
      if (!fs.existsSync(file)) fail(`${vendor} is missing: install the server dependencies (npm install in server/)`);
      return moduleId(file);
    }
    if (source === GLOBALS_SPECIFIER) return shim('globals.ts');
    if (!importer || !within(importer, coreScopes)) return null;

    const builtin = builtinName(source);
    if (builtin !== null) return resolveBuiltin(builtin, source, importer);

    if (source.startsWith('.')) {
      const module = serverModule(source, importer);
      if (module === null) return null;
      if (module === 'util/paths') return moduleId(own(overrides, 'util/paths') || shim('paths.ts'));
      if (forbidNodeOnly) {
        const nodeOnly = NODE_ONLY_SERVER_MODULES.includes(module) || NODE_ONLY_SERVER_DIRS.some((dir) => module === dir || module.startsWith(`${dir}/`));
        if (nodeOnly) fail(`server/src/${module} needs Node.js and must not be part of the mobile core (imported by ${importer})`);
      }
      return null;
    }

    const override = own(overrides, source);
    if (override) return moduleId(override);
    const packageShim = own(PACKAGE_SHIMS, source);
    if (packageShim) return shim(packageShim);
    if (NODE_ONLY_PACKAGES.includes(source)) {
      fail(`"${source}" (imported by ${importer}) has no mobile replacement: pass one in the plugin options, e.g. modules: { ${source}: '<file>' }`);
    }
    return null;
  }

  /** The fallback of rewriteImports for code that does not parse (the build fails on it anyway). */
  function rewriteImportsByText(code: string): string | null {
    let changed = false;
    const out = code.replace(IMPORT_SPECIFIER, (match: string, lead: string, quote: string, specifier: string) => {
      if (!isRedirected(specifier)) return match;
      changed = true;
      return `${lead}${quote}${REWRITE_PREFIX}${specifier}${quote}`;
    });
    return changed ? out : null;
  }

  function rewriteImports(code: string, id?: string): string | null {
    // Most modules import nothing that is redirected: they are not even parsed.
    const candidates = code.match(QUOTED_TEXT);
    if (!candidates || !candidates.some(isRedirected)) return null;
    const specifiers = moduleSpecifiers(code, id);
    if (specifiers === null) return rewriteImportsByText(code);

    let out = '';
    let copied = 0;
    for (const specifier of specifiers) {
      if (!isRedirected(specifier.value)) continue;
      const raw = code.slice(specifier.start, specifier.end);
      const quote = raw[0];
      // The specifier as it was written, in its own quotes; a template or an escaped literal becomes a plain string.
      const plain = (quote === "'" || quote === '"') && raw === `${quote}${specifier.value}${quote}`;
      out += code.slice(copied, specifier.start);
      out += plain ? `${quote}${REWRITE_PREFIX}${specifier.value}${quote}` : JSON.stringify(REWRITE_PREFIX + specifier.value);
      copied = specifier.end;
    }
    return copied === 0 ? null : out + code.slice(copied);
  }

  return {
    root,
    isCoreImporter: (importer) => within(importer, coreScopes),
    isServerModule: (id) => within(id, serverScopes),
    resolve,
    isRedirected,
    rewriteImports,
  };
}

/** A node of the syntax tree `parseSync` returns (ESTree with the TypeScript extensions). */
interface AstNode {
  type: string;
  [key: string]: unknown;
}

function languageOf(id: string): 'js' | 'jsx' | 'ts' | 'tsx' {
  const extension = /\.([cm]?[jt]sx?)(?:[?#].*)?$/.exec(id)?.[1] ?? 'ts';
  if (extension.endsWith('x')) return extension.startsWith('j') ? 'jsx' : 'tsx';
  return extension.endsWith('js') ? 'js' : 'ts';
}

/**
 * The statements of `code`, parsed with the parser Vite ships (oxc); positions in the tree are
 * indices into `code`. `id` gives the language (its extension; TypeScript when there is none).
 * Null when the code does not parse.
 */
function parseModule(code: string, id: string = 'module.ts'): AstNode[] | null {
  try {
    const lang = languageOf(id);
    const result = parseSync(`module.${lang}`, code, { lang, sourceType: 'module' });
    if (result.errors.length > 0) return null;
    return result.program.body as unknown as AstNode[];
  } catch {
    return null;
  }
}

/** A module specifier in the source text: `code.slice(start, end)` is the literal with its quotes. */
export interface SpecifierRange {
  start: number;
  end: number;
  /** The specifier itself ('node:fs'). */
  value: string;
}

/** `node` as a specifier when it is a string literal or a template without placeholders. */
function specifierRange(node: unknown): SpecifierRange | null {
  const literal = node as AstNode | null | undefined;
  if (!literal || typeof literal !== 'object' || typeof literal.start !== 'number' || typeof literal.end !== 'number') return null;
  let value: unknown;
  if (literal.type === 'Literal') value = literal.value;
  else if (literal.type === 'TemplateLiteral' && (literal.expressions as unknown[]).length === 0 && (literal.quasis as AstNode[]).length === 1) {
    value = ((literal.quasis as AstNode[])[0].value as { cooked?: unknown }).cooked;
  }
  return typeof value === 'string' ? { start: literal.start, end: literal.end, value } : null;
}

function collectSpecifiers(node: unknown, out: SpecifierRange[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectSpecifiers(item, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const current = node as AstNode;
  if (typeof current.type !== 'string') return;
  let found: SpecifierRange | null = null;
  switch (current.type) {
    case 'ImportDeclaration':
    case 'ExportNamedDeclaration':
    case 'ExportAllDeclaration':
    case 'ImportExpression':
      found = specifierRange(current.source);
      break;
    case 'CallExpression': {
      // `require('x')` - the CommonJS function, not a method of that name (`loader.require('x')`).
      const callee = current.callee as AstNode | null;
      if (callee?.type === 'Identifier' && callee.name === 'require') found = specifierRange((current.arguments as unknown[])[0]);
      break;
    }
    case 'TSImportEqualsDeclaration': {
      const reference = current.moduleReference as AstNode | null;
      if (reference?.type === 'TSExternalModuleReference') found = specifierRange(reference.expression);
      break;
    }
    default:
      break;
  }
  if (found) out.push(found);
  for (const key of Object.keys(current)) {
    const child = current[key];
    if (child && typeof child === 'object') collectSpecifiers(child, out);
  }
}

/**
 * Where `code` names the modules it loads, in source order: the specifiers of import / export ...
 * from statements (type-only ones included), of `import()`, of `require()` and of
 * `import x = require()` - read from the syntax tree, so the text of strings, templates and
 * comments is never mistaken for one. Type positions (`typeof import('x')`, `declare module 'x'`)
 * are not listed: they are erased. Null when the code does not parse, or when a position does not
 * point at a quoted literal (then nothing may be rewritten by position).
 */
export function moduleSpecifiers(code: string, id?: string): SpecifierRange[] | null {
  const body = parseModule(code, id);
  if (!body) return null;
  const found: SpecifierRange[] = [];
  collectSpecifiers(body, found);
  found.sort((a, b) => a.start - b.start);
  let previousEnd = 0;
  for (const specifier of found) {
    const quote = code[specifier.start];
    const closes = code[specifier.end - 1] === quote && specifier.end - specifier.start >= 2;
    if ((quote !== "'" && quote !== '"' && quote !== '`') || !closes || specifier.start < previousEnd) return null;
    previousEnd = specifier.end;
  }
  return found;
}

/** Adds the names a declaration pattern binds: an identifier, object / array destructuring, defaults, rest. */
function patternNames(pattern: unknown, out: Set<string>): void {
  const node = pattern as AstNode | null;
  if (!node) return;
  if (node.type === 'Identifier') out.add(node.name as string);
  else if (node.type === 'ObjectPattern') {
    for (const property of node.properties as AstNode[]) patternNames(property.type === 'RestElement' ? property.argument : property.value, out);
  } else if (node.type === 'ArrayPattern') {
    for (const element of node.elements as unknown[]) patternNames(element, out);
  } else if (node.type === 'AssignmentPattern') patternNames(node.left, out);
  else if (node.type === 'RestElement') patternNames(node.argument, out);
}

/** Declarations that bind their `id` in the scope they stand in (types included: see topLevelBindings). */
const NAMED_DECLARATIONS = new Set([
  'FunctionDeclaration',
  'TSDeclareFunction',
  'ClassDeclaration',
  'TSEnumDeclaration',
  'TSModuleDeclaration',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSImportEqualsDeclaration',
]);

/** Adds the names a module-level statement declares. */
function statementNames(statement: AstNode, out: Set<string>): void {
  if (statement.type === 'ImportDeclaration') {
    // The LOCAL name: `import { Buffer as B }` binds B, `import { x as process }` binds process.
    for (const specifier of statement.specifiers as AstNode[]) patternNames(specifier.local, out);
  } else if (statement.type === 'VariableDeclaration') {
    for (const declarator of statement.declarations as AstNode[]) patternNames(declarator.id, out);
  } else if (NAMED_DECLARATIONS.has(statement.type)) {
    // (`declare module 'x'` has a string literal as id, an anonymous default export none.)
    patternNames(statement.id, out);
  } else if ((statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration') && statement.declaration) {
    statementNames(statement.declaration as AstNode, out);
  }
}

/** Nodes with a variable scope of their own: a `var` inside them is not a module-level binding. */
const VAR_SCOPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ClassDeclaration', 'ClassExpression', 'TSModuleDeclaration', 'StaticBlock']);

/** Adds the names of `var` declarations nested in blocks, loops, ... of `node`: they are hoisted to the module scope. */
function hoistedVarNames(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) hoistedVarNames(item, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const current = node as AstNode;
  if (typeof current.type !== 'string' || VAR_SCOPES.has(current.type)) return;
  if (current.type === 'VariableDeclaration' && current.kind === 'var') {
    for (const declarator of current.declarations as AstNode[]) patternNames(declarator.id, out);
  }
  for (const key of Object.keys(current)) hoistedVarNames(current[key], out);
}

/**
 * The names `code` binds at module level - imports (their local names), const / let / var with
 * destructuring and declaration lists, functions, classes, enums, namespaces, `import x = require`,
 * hoisted `var`s - found with the parser Vite ships (oxc), not by pattern matching. Type-only
 * declarations (`import type`, interfaces, type aliases, `declare const`) count as well: a second
 * declaration of the name in the same module would be a "duplicate identifier" for the compiler.
 * Names declared inside a function or block are NOT module-level: they shadow an import there.
 * `id` gives the language (its extension; TypeScript when there is none).
 * Returns null when the code does not parse.
 */
export function topLevelBindings(code: string, id: string = 'module.ts'): Set<string> | null {
  const body = parseModule(code, id);
  if (!body) return null;
  const names = new Set<string>();
  for (const statement of body) {
    statementNames(statement, names);
    hoistedVarNames(statement, names);
  }
  return names;
}

/**
 * The fallback of topLevelBindings for code that does not parse (the build fails on it anyway):
 * true when the text looks like it declares or imports `name`.
 */
function declaresNameByText(code: string, name: string): boolean {
  const declaration = new RegExp(`\\b(?:const|let|var|function|class|enum|namespace)\\s+${name}\\b`);
  const imported = new RegExp(`\\bimport\\s+(?:type\\s+)?(?:[\\w$*\\s,]*\\{[^}]*\\b${name}\\b[^}]*\\}|${name}\\b|\\*\\s+as\\s+${name}\\b)[^;'"]*from`);
  return declaration.test(code) || imported.test(code);
}

/**
 * The import line to prepend to a server module, or null when it names none of the Node globals or
 * binds each one it names itself at module level (see topLevelBindings). `id` is the module's file
 * name (for its language). A name that only appears in a comment or inside a function that
 * declares it still gets its import; that is harmless.
 */
export function globalsImportFor(code: string, id?: string): string | null {
  const named = INJECTED_GLOBALS.filter((name) => new RegExp(`\\b${name}\\b`).test(code));
  if (named.length === 0) return null;
  const bindings = topLevelBindings(code, id);
  const names = named.filter((name) => (bindings ? !bindings.has(name) : !declaresNameByText(code, name)));
  if (names.length === 0) return null;
  return `import { ${names.join(', ')} } from ${JSON.stringify(GLOBALS_SPECIFIER)};`;
}

const SCRIPT_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;

/** The plugin: see the file comment. */
export function mobileCoreAlias(options: MobileAliasOptions = {}): Plugin {
  const resolver = createMobileResolver(options);
  const injectGlobals = options.injectGlobals !== false;
  return {
    name: PLUGIN_NAME,
    enforce: 'pre',
    resolveId(source, importer) {
      return resolver.resolve(source, importer);
    },
    transform(code, id) {
      if (!resolver.isCoreImporter(id)) return null;
      const file = id.replace(/[?#].*$/, '');
      if (!SCRIPT_FILE.test(file) || file.endsWith('.d.ts')) return null;
      let out = resolver.rewriteImports(code, file) ?? code;
      if (injectGlobals && resolver.isServerModule(id)) {
        const line = globalsImportFor(out, file);
        if (line) out = `${line} ${out}`;
      }
      // Line numbers are unchanged (only columns of the touched lines move): no new source map.
      return out === code ? null : { code: out, map: null };
    },
  };
}

export default mobileCoreAlias;
