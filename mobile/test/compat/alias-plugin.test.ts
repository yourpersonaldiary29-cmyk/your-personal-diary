// @vitest-environment node
/**
 * The resolution rules of the mobile alias plugin (mobile/core/alias-plugin.ts):
 *
 *   importer in the core scope (server/src, shared, mobile/core/shims)
 *       Node built-in            -> its shim in mobile/core/shims (or a build error: "no mobile shim")
 *       sql.js / pdfkit          -> the wrappers around the browser builds
 *       server/src/util/paths    -> shims/paths.ts
 *       express                  -> the replacement given in the options (or a build error)
 *       Node-only server modules -> a build error (remote/**, mail/node-transport, host-check, server, index)
 *   importer anywhere else (src/, mobile/host, tests, node_modules, no importer) -> untouched
 *
 * plus the two steps of the plugin itself: the specifier rewrite that makes the rules hold under
 * vitest (which hands Node built-ins to Node without asking a plugin) and the import of the Node
 * globals that server modules get.
 */
import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import mobileCoreAliasDefault, {
  GLOBALS_SPECIFIER,
  INJECTED_GLOBALS,
  NODE_ONLY_SERVER_DIRS,
  NODE_ONLY_SERVER_MODULES,
  NODE_SHIMS,
  PACKAGE_SHIMS,
  REWRITE_PREFIX,
  VENDOR_FILES,
  comparablePath,
  createMobileResolver,
  globalsImportFor,
  mobileCoreAlias,
  topLevelBindings,
} from '../../core/alias-plugin';

/** Module ids as Vite writes them: absolute, forward slashes. */
const ROOT = process.cwd().split(path.sep).join('/');
const at = (relative: string): string => `${ROOT}/${relative}`;
const shim = (file: string): string => at(`mobile/core/shims/${file}`);

const SERVER_KDF = at('server/src/security/kdf.ts');
const SERVER_APP = at('server/src/app.ts');
const SERVER_DATABASE = at('server/src/db/database.ts');
const SHARED_MODULE = at('shared/i18n/index.ts');
const SHIM_MODULE = shim('pdfkit.ts');

/** Importers whose imports must stay exactly as they are. */
const OUTSIDE: Array<[string, string | undefined]> = [
  ['the desktop / mobile UI (src/)', at('src/api/client.ts')],
  ['the mobile host (mobile/host)', at('mobile/host/boot.ts')],
  ['the VFS (mobile/core/vfs)', at('mobile/core/vfs/vfs.ts')],
  ['a test file', at('mobile/test/compat/scrypt.test.ts')],
  ['a server test (server/test is not server/src)', at('server/test/helpers.ts')],
  ['a package in node_modules', at('node_modules/@noble/hashes/scrypt.js')],
  ['a package in server/node_modules', at('server/node_modules/pdfkit/js/pdfkit.js')],
  ['a script', at('scripts/build-server.mjs')],
  ['a directory that only starts like server/src', at('server/src-extra/thing.ts')],
  ['an entry without importer', undefined],
];

const resolver = createMobileResolver({ projectRoot: process.cwd() });

function plugin(options: Parameters<typeof mobileCoreAlias>[0] = { projectRoot: process.cwd() }): {
  resolveId(source: string, importer?: string): string | null;
  transform(code: string, id: string): string | null;
} {
  const instance = mobileCoreAlias(options);
  type Hook = (this: unknown, ...args: unknown[]) => unknown;
  const resolveId = instance.resolveId as unknown as Hook;
  const transform = instance.transform as unknown as Hook;
  return {
    resolveId: (source, importer) => resolveId.call({}, source, importer, {}) as string | null,
    transform: (code, id) => {
      const result = transform.call({}, code, id) as { code: string } | null;
      return result ? result.code : null;
    },
  };
}

describe('alias plugin: Node built-ins of the server code go to the shims', () => {
  it('every shim named in the table exists', () => {
    for (const [name, file] of Object.entries(NODE_SHIMS)) {
      expect(fs.existsSync(shim(file)), `${name} -> ${file}`).toBe(true);
    }
    for (const file of Object.values(PACKAGE_SHIMS)) expect(fs.existsSync(shim(file)), file).toBe(true);
    for (const file of ['globals.ts', 'paths.ts', 'unavailable.ts']) expect(fs.existsSync(shim(file)), file).toBe(true);
  });

  it('an importer under server/src gets the shim, with and without the "node:" prefix', () => {
    for (const [name, file] of Object.entries(NODE_SHIMS)) {
      expect(resolver.resolve(`node:${name}`, SERVER_KDF), `node:${name}`).toBe(shim(file));
      // "process" and friends are built-ins without the prefix as well.
      if (builtinModules.includes(name)) expect(resolver.resolve(name, SERVER_KDF), name).toBe(shim(file));
    }
    expect(resolver.resolve('node:crypto', SERVER_KDF)).toBe(shim('crypto.ts'));
    expect(resolver.resolve('crypto', SERVER_KDF)).toBe(shim('crypto.ts'));
    expect(resolver.resolve('node:path', SERVER_APP)).toBe(shim('path.ts'));
    expect(resolver.resolve('node:path/posix', SERVER_APP)).toBe(shim('path.ts'));
  });

  it('node:fs and fs go to the virtual file system (shims/fs.ts)', () => {
    expect(resolver.resolve('node:fs', SERVER_APP)).toBe(shim('fs.ts'));
    expect(resolver.resolve('fs', SERVER_APP)).toBe(shim('fs.ts'));
  });

  it('without shims/fs.ts the placeholder is used (a tree where WP-4 has not landed)', () => {
    const emptyRoot = path.join(process.cwd(), 'mobile', 'test', 'compat', 'no-such-root');
    const bare = createMobileResolver({ projectRoot: emptyRoot });
    const importer = `${emptyRoot.split(path.sep).join('/')}/server/src/app.ts`;
    expect(bare.resolve('node:fs', importer)).toMatch(/\/mobile\/core\/shims\/fs-missing\.ts$/);
    expect(bare.resolve('node:crypto', importer)).toMatch(/\/mobile\/core\/shims\/crypto\.ts$/);
  });

  it('shared/ and the shims themselves are in the scope too', () => {
    expect(resolver.resolve('node:crypto', SHARED_MODULE)).toBe(shim('crypto.ts'));
    // shims/pdfkit.ts reads the font files through node:fs = the virtual file system.
    expect(resolver.resolve('node:fs', SHIM_MODULE)).toBe(shim('fs.ts'));
    expect(resolver.isCoreImporter(SHARED_MODULE)).toBe(true);
    expect(resolver.isCoreImporter(SHIM_MODULE)).toBe(true);
    // ... but only server modules get the Node globals injected (the shims define them).
    expect(resolver.isServerModule(SERVER_KDF)).toBe(true);
    expect(resolver.isServerModule(SHARED_MODULE)).toBe(true);
    expect(resolver.isServerModule(SHIM_MODULE)).toBe(false);
  });

  it('a built-in that has no shim fails the build with a message that names it and the importer', () => {
    for (const name of ['node:child_process', 'child_process', 'node:worker_threads', 'node:zlib', 'node:stream', 'node:events', 'node:util']) {
      expect(() => resolver.resolve(name, SERVER_KDF), name).toThrow(/no mobile shim for the Node built-in/);
    }
    expect(() => resolver.resolve('node:child_process', SERVER_KDF)).toThrow(/"node:child_process".*server\/src\/security\/kdf\.ts/);
  });

  it('module ids are compared without query, with either slash, and (on Windows) in any case', () => {
    expect(resolver.resolve('node:crypto', `${SERVER_KDF}?v=1a2b3c`)).toBe(shim('crypto.ts'));
    expect(resolver.resolve('node:crypto', `${SERVER_KDF}#hash`)).toBe(shim('crypto.ts'));
    expect(resolver.resolve('node:crypto', SERVER_KDF.split('/').join('\\'))).toBe(shim('crypto.ts'));
    expect(resolver.resolve('node:crypto', `/@fs/${SERVER_KDF}`)).toBe(shim('crypto.ts'));
    expect(resolver.resolve('node:crypto', `\0${SERVER_KDF}`)).toBe(shim('crypto.ts'));
    if (process.platform === 'win32') {
      expect(resolver.resolve('node:crypto', SERVER_KDF.toUpperCase())).toBe(shim('crypto.ts'));
      expect(resolver.resolve('node:crypto', SERVER_KDF.toLowerCase())).toBe(shim('crypto.ts'));
      expect(comparablePath('C:\\Users\\X\\File.TS?import')).toBe('c:/users/x/file.ts');
    } else {
      expect(comparablePath('/Users/X/File.TS?import')).toBe('/Users/X/File.TS');
    }
  });
});

describe('alias plugin: everything outside the core scope is untouched', () => {
  for (const [label, importer] of OUTSIDE) {
    it(`${label}: built-ins, sql.js, pdfkit, express and relative imports resolve as usual`, () => {
      for (const name of Object.keys(NODE_SHIMS)) {
        expect(resolver.resolve(`node:${name}`, importer), `node:${name}`).toBeNull();
        expect(resolver.resolve(name, importer), name).toBeNull();
      }
      for (const source of ['sql.js', 'pdfkit', 'express', 'node:child_process', 'react', './util/paths', '../remote/manager', './server', './index']) {
        expect(resolver.resolve(source, importer), source).toBeNull();
      }
      // Also a specifier the transform step rewrote resolves like the original: not at all.
      expect(resolver.resolve(`${REWRITE_PREFIX}node:crypto`, importer)).toBeNull();
      expect(resolver.isCoreImporter(importer)).toBe(false);
    });
  }

  it('the plugin does not transform modules outside the scope', () => {
    const p = plugin();
    const code = "import { randomBytes } from 'node:crypto';\nexport const x = Buffer.from(randomBytes(4));\n";
    for (const [, importer] of OUTSIDE) {
      if (importer) expect(p.transform(code, importer), importer).toBeNull();
    }
  });

  it('third-party packages imported by server code are not redirected', () => {
    for (const source of ['bidi-js', '@noble/hashes/scrypt.js', 'buffer/index.js', 'path-browserify', '@shared/i18n', '@shared/types']) {
      expect(resolver.resolve(source, SERVER_KDF), source).toBeNull();
      expect(resolver.isRedirected(source), source).toBe(false);
    }
  });
});

describe('alias plugin: packages and server modules with a mobile replacement', () => {
  it('sql.js and pdfkit go to the wrappers, which load the browser builds of server/node_modules', () => {
    expect(resolver.resolve('sql.js', SERVER_DATABASE)).toBe(shim('sqljs.ts'));
    expect(resolver.resolve('pdfkit', at('server/src/export/pdf.ts'))).toBe(shim('pdfkit.ts'));
    for (const [specifier, file] of Object.entries(VENDOR_FILES)) {
      expect(fs.existsSync(at(file)), file).toBe(true);
      // Vendor specifiers resolve for every importer (the shims use them; nothing else does).
      expect(resolver.resolve(specifier, SHIM_MODULE)).toBe(at(file));
      expect(resolver.resolve(specifier, undefined)).toBe(at(file));
    }
    expect(VENDOR_FILES['mobile-vendor:sql.js']).toMatch(/sql-wasm-browser\.js$/);
    expect(VENDOR_FILES['mobile-vendor:pdfkit']).toMatch(/pdfkit\.standalone\.js$/);
  });

  it('a missing vendor build is a clear error', () => {
    const emptyRoot = path.join(process.cwd(), 'mobile', 'test', 'compat', 'no-such-root');
    const bare = createMobileResolver({ projectRoot: emptyRoot });
    expect(() => bare.resolve('mobile-vendor:sql.js', undefined)).toThrow(/sql-wasm-browser\.js is missing: install the server dependencies/);
  });

  it('the globals specifier resolves to shims/globals.ts for every importer', () => {
    expect(resolver.resolve(GLOBALS_SPECIFIER, SERVER_KDF)).toBe(shim('globals.ts'));
    expect(resolver.resolve(GLOBALS_SPECIFIER, at('mobile/core/worker.ts'))).toBe(shim('globals.ts'));
    expect(resolver.resolve(GLOBALS_SPECIFIER, undefined)).toBe(shim('globals.ts'));
  });

  it('server/src/util/paths is replaced by shims/paths.ts, however it is imported', () => {
    expect(resolver.resolve('./util/paths', at('server/src/config.ts'))).toBe(shim('paths.ts'));
    expect(resolver.resolve('../util/paths', SERVER_DATABASE)).toBe(shim('paths.ts'));
    expect(resolver.resolve('../util/paths.ts', SERVER_DATABASE)).toBe(shim('paths.ts'));
    expect(resolver.resolve('../util/paths.js', SERVER_DATABASE)).toBe(shim('paths.ts'));
    expect(resolver.resolve('./paths', at('server/src/util/other.ts'))).toBe(shim('paths.ts'));
    // Other relative imports - also ones that merely end the same way - are left alone.
    expect(resolver.resolve('./kdf', at('server/src/security/container.ts'))).toBeNull();
    expect(resolver.resolve('../util/paths-extra', SERVER_DATABASE)).toBeNull();
    expect(resolver.resolve('./util/paths', at('src/api/client.ts'))).toBeNull();
  });

  it('express needs an explicit replacement: without one the build fails instead of bundling the real one', () => {
    expect(() => resolver.resolve('express', SERVER_APP)).toThrow(/"express".*has no mobile replacement.*modules: \{ express: '<file>' \}/);
    const expressShim = at('mobile/core/express-shim.ts');
    const withExpress = createMobileResolver({ projectRoot: process.cwd(), modules: { express: expressShim } });
    expect(withExpress.resolve('express', SERVER_APP)).toBe(expressShim);
    expect(withExpress.resolve('express', at('server/src/routes/auth.ts'))).toBe(expressShim);
    expect(withExpress.resolve('express', at('src/api/client.ts'))).toBeNull();
  });

  it('`modules` overrides a built-in, a package or util/paths; `extraScopes` widens the scope', () => {
    const custom = createMobileResolver({
      projectRoot: process.cwd(),
      modules: {
        crypto: at('mobile/core/fast-crypto.ts'),
        'node:os': path.join(process.cwd(), 'mobile', 'core', 'my-os.ts'),
        'sql.js': at('mobile/core/my-sql.ts'),
        'util/paths': at('mobile/core/my-paths.ts'),
        'some-package': at('mobile/core/some-package.ts'),
      },
      extraScopes: [path.join(process.cwd(), 'mobile', 'core', 'app')],
    });
    expect(custom.resolve('node:crypto', SERVER_KDF)).toBe(at('mobile/core/fast-crypto.ts'));
    expect(custom.resolve('crypto', SERVER_KDF)).toBe(at('mobile/core/fast-crypto.ts'));
    // A back-slashed override becomes a forward-slashed module id (one file, one id).
    expect(custom.resolve('node:os', SERVER_KDF)).toBe(at('mobile/core/my-os.ts'));
    expect(custom.resolve('sql.js', SERVER_DATABASE)).toBe(at('mobile/core/my-sql.ts'));
    expect(custom.resolve('../util/paths', SERVER_DATABASE)).toBe(at('mobile/core/my-paths.ts'));
    expect(custom.resolve('some-package', SERVER_KDF)).toBe(at('mobile/core/some-package.ts'));
    expect(custom.isRedirected('some-package')).toBe(true);
    // Untouched built-ins keep their shim.
    expect(custom.resolve('node:path', SERVER_KDF)).toBe(shim('path.ts'));

    const inExtraScope = at('mobile/core/app/boot.ts');
    expect(custom.isCoreImporter(inExtraScope)).toBe(true);
    expect(custom.isServerModule(inExtraScope)).toBe(true);
    expect(custom.resolve('node:crypto', inExtraScope)).toBe(at('mobile/core/fast-crypto.ts'));
    expect(resolver.isCoreImporter(inExtraScope)).toBe(false);
    expect(resolver.resolve('node:crypto', inExtraScope)).toBeNull();
  });
});

describe('alias plugin: server modules that need Node.js never enter the core', () => {
  const forbidden: Array<[string, string]> = [
    ['./server', at('server/src/index.ts')],
    ['./index', at('server/src/app.ts')],
    ['../index', at('server/src/routes/auth.ts')],
    ['./index.ts', at('server/src/app.ts')],
    ['./remote/manager', at('server/src/app.ts')],
    ['../remote/tls', at('server/src/routes/server.ts')],
    ['./remote', at('server/src/app.ts')],
    ['./mail/node-transport', at('server/src/app.ts')],
    ['./node-transport', at('server/src/mail/service.ts')],
    ['./middleware/host-check', at('server/src/app.ts')],
    ['./host-check.js', at('server/src/middleware/access.ts')],
  ];

  it('the lists name the modules of the inventory, and they exist in server/src', () => {
    expect([...NODE_ONLY_SERVER_MODULES].sort()).toEqual(['index', 'mail/node-transport', 'middleware/host-check', 'server']);
    expect([...NODE_ONLY_SERVER_DIRS]).toEqual(['remote']);
    for (const module of NODE_ONLY_SERVER_MODULES) expect(fs.existsSync(at(`server/src/${module}.ts`)), module).toBe(true);
    for (const dir of NODE_ONLY_SERVER_DIRS) expect(fs.statSync(at(`server/src/${dir}`)).isDirectory(), dir).toBe(true);
  });

  for (const [source, importer] of forbidden) {
    it(`${source} imported by ${importer.slice(ROOT.length + 1)} fails the build`, () => {
      expect(() => resolver.resolve(source, importer)).toThrow(/needs Node\.js and must not be part of the mobile core/);
    });
  }

  it('modules that only share a name are fine: export/index, mail/service, mail/errors, routes/server', () => {
    expect(resolver.resolve('./index', at('server/src/export/pdf.ts'))).toBeNull();
    expect(resolver.resolve('./export/index', at('server/src/app.ts'))).toBeNull();
    expect(resolver.resolve('./mail/service', at('server/src/app.ts'))).toBeNull();
    expect(resolver.resolve('./mail/errors', at('server/src/app.ts'))).toBeNull();
    expect(resolver.resolve('./routes/server', at('server/src/app.ts'))).toBeNull();
    // routes/auth.ts imports its sibling routes/server.ts as './server' - not the Node entry server.ts.
    expect(resolver.resolve('./server', at('server/src/routes/auth.ts'))).toBeNull();
    expect(resolver.resolve('./middleware/access', at('server/src/app.ts'))).toBeNull();
    expect(resolver.resolve('./remote-notes', at('server/src/app.ts'))).toBeNull();
  });

  it('the check can be switched off (a tool that only inspects the graph)', () => {
    const lenient = createMobileResolver({ projectRoot: process.cwd(), forbidNodeOnlyModules: false });
    for (const [source, importer] of forbidden) expect(lenient.resolve(source, importer), source).toBeNull();
    // The replacement of util/paths stays.
    expect(lenient.resolve('./util/paths', at('server/src/config.ts'))).toBe(shim('paths.ts'));
  });

  it('the mail service of the core does not import the Node SMTP client at run time', () => {
    // The mobile core passes its own transport (WP-5 / WP-12); a value import of node-transport
    // from a module the core loads would fail the build. Type-only imports are erased. (The whole
    // graph is bundled in core-import-probe.test.ts; this names the modules next to the SMTP client.)
    for (const file of ['mail/service.ts', 'mail/settings.ts', 'mail/mime.ts', 'mail/transport.ts', 'security/password-reset.ts', 'app.ts']) {
      const source = fs.readFileSync(at(`server/src/${file}`), 'utf8');
      const valueImports = source.split('\n').filter((line) => /^\s*import\s+(?!type\b)/.test(line) && /node-transport|host-check|\/remote\//.test(line));
      expect(valueImports, file).toEqual([]);
    }
  });
});

describe('alias plugin: the specifier rewrite (what makes the rules hold under vitest)', () => {
  it('rewrites the specifiers of built-ins and shimmed packages in every import form', () => {
    const code = [
      "import { createHash, randomBytes } from 'node:crypto';",
      'import fs from "node:fs";',
      "import path from 'path';",
      "import initSqlJs, { type Database } from 'sql.js';",
      "import PDFDocument from 'pdfkit';",
      "import express, { Router } from 'express';",
      "import 'node:os';",
      "export { isIP } from 'node:net';",
      "const lazy = await import('node:url');",
      "const old = require('fs');",
      "import { t } from '@shared/i18n';",
      "import { ApiError } from '../errors';",
      "import bidiFactory from 'bidi-js';",
    ].join('\n');
    const out = resolver.rewriteImports(code);
    expect(out).not.toBeNull();
    expect((out as string).split('\n')).toEqual([
      `import { createHash, randomBytes } from '${REWRITE_PREFIX}node:crypto';`,
      `import fs from "${REWRITE_PREFIX}node:fs";`,
      `import path from '${REWRITE_PREFIX}path';`,
      `import initSqlJs, { type Database } from '${REWRITE_PREFIX}sql.js';`,
      `import PDFDocument from '${REWRITE_PREFIX}pdfkit';`,
      `import express, { Router } from '${REWRITE_PREFIX}express';`,
      `import '${REWRITE_PREFIX}node:os';`,
      `export { isIP } from '${REWRITE_PREFIX}node:net';`,
      `const lazy = await import('${REWRITE_PREFIX}node:url');`,
      `const old = require('${REWRITE_PREFIX}fs');`,
      "import { t } from '@shared/i18n';",
      "import { ApiError } from '../errors';",
      "import bidiFactory from 'bidi-js';",
    ]);
  });

  it('returns null when a module imports nothing that is redirected', () => {
    expect(resolver.rewriteImports("import { t } from '@shared/i18n';\nimport { x } from './x';\nexport const y = x + t;\n")).toBeNull();
    expect(resolver.rewriteImports('export const text = "crypto is a word, not an import";\n')).toBeNull();
  });

  it('never rewrites text: a string, a template or a comment that reads like an import stays as written', () => {
    // Each of these is a module of the server or of shared/ (a message, an e-mail template, a hint)
    // whose TEXT names a built-in or a shimmed package after from / import / require.
    const untouched = [
      `export const s = "restore from 'fs' now";`,
      `export const s = 'to restore, import "path" first';`,
      "export const t = `import('crypto')`;",
      "export const t = `run require('events') or import 'stream' from 'url'`;",
      "export const t = `${1 + 1} from 'node:fs' import('node:fs') require('node:fs')`;",
      "// import x from 'node:fs'\nexport const v = 1;",
      "/* require('os') and\n   export * from 'url' */\nexport const v = 1;",
      "/** it's from 'buffer' */ export const v = 1;",
      "export const html = '<code>import \"process\"</code>';",
      "export const messages = { hint: \"copy the line: import express from 'express'\" };",
      "export const messages = { hint: 'the database engine is from \"sql.js\"' };",
      "export const pdf = `made with require(\"pdfkit\")`;",
      // Not the require of CommonJS: a method of that name.
      "declare const x: { require(name: string): unknown };\nexport const w = x.require('fs');",
      // Two statements (a line break ends the first): an identifier called `from`, then a string.
      "declare const from: number;\nexport let v = from\n'path'.length;",
      // Types are erased before anything is resolved.
      "export type Tls = typeof import('node:tls');",
      "declare module 'node:dns' {\n  export const x: number;\n}\nexport {};",
    ];
    for (const code of untouched) expect(resolver.rewriteImports(code), code).toBeNull();

    // Next to a real import only the import changes.
    const code = [
      "import x from 'node:fs';",
      `export const s = "from 'node:fs'";`,
      "// from 'node:fs'",
      "export const t = `${String(x)} from 'node:fs' import('node:fs')`;",
      "",
    ].join('\n');
    expect(resolver.rewriteImports(code)).toBe(code.replace("import x from 'node:fs'", `import x from '${REWRITE_PREFIX}node:fs'`));

    // The plugin, for a server module and for a message file of shared/.
    const p = plugin({ projectRoot: process.cwd(), injectGlobals: false });
    expect(p.transform(code, at('server/src/zz/sample.ts'))).toBe(code.replace("import x from 'node:fs'", `import x from '${REWRITE_PREFIX}node:fs'`));
    const messages = "export const backup = {\n  restoreHint: \"restore from 'fs' now\",\n  importHint: 'import \"url\"',\n};\n";
    expect(p.transform(messages, at('shared/i18n/messages/en/backup.ts'))).toBeNull();
    expect(plugin().transform(messages, at('shared/i18n/messages/en/backup.ts'))).toBeNull();
  });

  it('finds every real specifier, also where a text pattern does not: comments inside the import, templates, import = require, many lines', () => {
    const cases: Array<[string, string]> = [
      ["const a = await import(/* webpackIgnore */ 'node:crypto');", `const a = await import(/* webpackIgnore */ '${REWRITE_PREFIX}node:crypto');`],
      ["const a = await import(\n  // the hash\n  'node:crypto'\n);", `const a = await import(\n  // the hash\n  '${REWRITE_PREFIX}node:crypto'\n);`],
      ['const a = await import(`node:crypto`);', `const a = await import("${REWRITE_PREFIX}node:crypto");`],
      ["const a = require(/* cjs */ 'fs');", `const a = require(/* cjs */ '${REWRITE_PREFIX}fs');`],
      ["import fs = require('fs');\nexport { fs };", `import fs = require('${REWRITE_PREFIX}fs');\nexport { fs };`],
      ["export * from 'node:os';", `export * from '${REWRITE_PREFIX}node:os';`],
      ["export * as os from 'os';", `export * as os from '${REWRITE_PREFIX}os';`],
      ["import {\n  randomBytes,\n  scrypt,\n} from /* built-in */\n  'node:crypto';", `import {\n  randomBytes,\n  scrypt,\n} from /* built-in */\n  '${REWRITE_PREFIX}node:crypto';`],
      ["import x from'fs';export{x}from\"path\";", `import x from'${REWRITE_PREFIX}fs';export{x}from"${REWRITE_PREFIX}path";`],
      // A type-only import is rewritten as well; TypeScript erases it either way.
      ["import type { Stats } from 'node:fs';\nexport type S = Stats;", `import type { Stats } from '${REWRITE_PREFIX}node:fs';\nexport type S = Stats;`],
      // The positions are those of the text, also behind characters outside ASCII and the BMP.
      ["/* יומן 😀 𠮷 */ import fs from 'fs'; // from 'os' 😀\nexport const שלום = '😀 from \"os\"' + fs;", `/* יומן 😀 𠮷 */ import fs from '${REWRITE_PREFIX}fs'; // from 'os' 😀\nexport const שלום = '😀 from "os"' + fs;`],
      // Inside functions, classes and blocks.
      [
        "export async function load() {\n  if (Math.random() > 2) {\n    const { createHash } = await import('node:crypto');\n    return createHash;\n  }\n  return null;\n}",
        `export async function load() {\n  if (Math.random() > 2) {\n    const { createHash } = await import('${REWRITE_PREFIX}node:crypto');\n    return createHash;\n  }\n  return null;\n}`,
      ],
    ];
    for (const [code, expected] of cases) {
      const out = resolver.rewriteImports(code);
      expect(out, code).toBe(expected);
      expect((out as string).split('\n'), code).toHaveLength(code.split('\n').length);
    }
  });

  it('reads the language from the file name, and falls back to the text pattern for code that does not parse', () => {
    // JSX is not TypeScript: `<div>` in a .ts file is a type assertion, i.e. a syntax error there.
    const jsx = "import fs from 'fs';\nexport const view = <div title=\"from 'os'\">{String(fs)}</div>;\n";
    const expectedJsx = jsx.replace("from 'fs'", `from '${REWRITE_PREFIX}fs'`);
    expect(resolver.rewriteImports(jsx, at('server/src/zz/view.tsx'))).toBe(expectedJsx);
    expect(resolver.rewriteImports(jsx, at('server/src/zz/view.jsx'))).toBe(expectedJsx);
    const generic = "import fs from 'fs';\nexport const same = <T,>(value: T): T => value;\nexport const s = \"from 'os'\" + String(fs);\n";
    expect(resolver.rewriteImports(generic, at('server/src/zz/generic.ts'))).toBe(generic.replace("from 'fs'", `from '${REWRITE_PREFIX}fs'`));
    expect(resolver.rewriteImports(generic)).toBe(generic.replace("from 'fs'", `from '${REWRITE_PREFIX}fs'`));

    // Broken code (the build fails on it anyway): the pattern still redirects its imports, so the
    // error that is reported is the syntax error and not a module that ran on Node's own built-in.
    const broken = "import fs from 'node:fs';\nexport const = ;\n";
    expect(resolver.rewriteImports(broken)).toBe(`import fs from '${REWRITE_PREFIX}node:fs';\nexport const = ;\n`);
  });

  it('every rewrite in server/src and shared/ of this tree is the specifier of an import or export statement', () => {
    const roots = [path.join(process.cwd(), 'server', 'src'), path.join(process.cwd(), 'shared')];
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(full);
      }
    };
    roots.forEach(walk);
    expect(files.length).toBeGreaterThan(300);
    let rewrittenFiles = 0;
    const bad: string[] = [];
    for (const file of files) {
      const code = fs.readFileSync(file, 'utf8');
      const out = resolver.rewriteImports(code, file);
      if (out === null) continue;
      rewrittenFiles += 1;
      const before = code.split('\n');
      const after = out.split('\n');
      if (before.length !== after.length) bad.push(`${file}: line count`);
      before.forEach((line, i) => {
        if (line === after[i]) return;
        const restored = after[i].split(REWRITE_PREFIX).join('');
        const isImportLine = /^\s*(?:import\b|export\b|\}\s*from\b|.*\bawait import\()/.test(line);
        if (restored !== line || !isImportLine) bad.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(bad).toEqual([]);
    expect(rewrittenFiles).toBeGreaterThan(30);
  });

  it('a package called like a member of Object.prototype is an ordinary package, for every importer', () => {
    // The rule tables are plain objects: 'constructor' or 'toString' must not be found in them.
    for (const name of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']) {
      expect(resolver.isRedirected(name), name).toBe(false);
      expect(resolver.resolve(name, SERVER_KDF), name).toBeNull();
      expect(resolver.resolve(name, at('src/main.tsx')), name).toBeNull();
      expect(resolver.resolve(name, undefined), name).toBeNull();
      expect(resolver.rewriteImports(`import x from '${name}';\nexport const y = x;\n`), name).toBeNull();
      expect(() => resolver.resolve(`node:${name}`, SERVER_KDF), name).toThrow(/no mobile shim/);
    }
  });

  it('a rewritten specifier resolves exactly like the original one', () => {
    expect(resolver.resolve(`${REWRITE_PREFIX}node:crypto`, SERVER_KDF)).toBe(shim('crypto.ts'));
    expect(resolver.resolve(`${REWRITE_PREFIX}fs`, SERVER_KDF)).toBe(shim('fs.ts'));
    expect(resolver.resolve(`${REWRITE_PREFIX}sql.js`, SERVER_DATABASE)).toBe(shim('sqljs.ts'));
    expect(() => resolver.resolve(`${REWRITE_PREFIX}express`, SERVER_APP)).toThrow(/has no mobile replacement/);
    expect(() => resolver.resolve(`${REWRITE_PREFIX}node:child_process`, SERVER_APP)).toThrow(/no mobile shim/);
  });

  it('the plugin rewrites server modules and the shims, keeps the line count, and skips declarations and non-scripts', () => {
    const p = plugin();
    const code = "import { randomBytes } from 'node:crypto';\nexport const token = (): string => randomBytes(4).toString('hex');\n";
    const out = p.transform(code, SERVER_KDF) as string;
    expect(out).toContain(`from '${REWRITE_PREFIX}node:crypto'`);
    expect(out.split('\n')).toHaveLength(code.split('\n').length);
    expect(p.transform(code, `${SERVER_KDF}?v=123`)).toBe(out);

    // A shim that imports a built-in is rewritten, but gets no globals import.
    const shimCode = "import fs from 'node:fs';\nexport const read = (f: string) => Buffer.from(fs.readFileSync(f));\n";
    const shimOut = p.transform(shimCode, SHIM_MODULE) as string;
    expect(shimOut).toContain(`from '${REWRITE_PREFIX}node:fs'`);
    expect(shimOut).not.toContain(GLOBALS_SPECIFIER);

    expect(p.transform(code, at('server/src/types.d.ts'))).toBeNull();
    expect(p.transform('{"node:crypto": true}', at('server/src/data.json'))).toBeNull();
    expect(p.transform("export const nothing = 'to do';\n", SERVER_KDF)).toBeNull();
  });

  it('the plugin resolves through its resolveId hook, before other plugins (enforce: pre)', () => {
    const instance = mobileCoreAlias({ projectRoot: process.cwd() });
    expect(instance.name).toBe('mobile-core-alias');
    expect(instance.enforce).toBe('pre');
    expect(mobileCoreAliasDefault).toBe(mobileCoreAlias);
    const p = plugin();
    expect(p.resolveId('node:crypto', SERVER_KDF)).toBe(shim('crypto.ts'));
    expect(p.resolveId(`${REWRITE_PREFIX}node:crypto`, SERVER_KDF)).toBe(shim('crypto.ts'));
    expect(p.resolveId('node:crypto', at('src/main.tsx'))).toBeNull();
    expect(p.resolveId('./kdf', SERVER_KDF)).toBeNull();
  });
});

describe('alias plugin: Node globals of server modules', () => {
  it('a module that names Buffer / process / setImmediate imports them from the globals shim', () => {
    expect(globalsImportFor('export const b = Buffer.alloc(4);')).toBe(`import { Buffer } from "${GLOBALS_SPECIFIER}";`);
    expect(globalsImportFor('const p = process.platform; setImmediate(() => Buffer.from(p));')).toBe(
      `import { Buffer, process, setImmediate } from "${GLOBALS_SPECIFIER}";`,
    );
    expect(globalsImportFor('clearImmediate(handle);')).toBe(`import { clearImmediate } from "${GLOBALS_SPECIFIER}";`);
    expect(INJECTED_GLOBALS).toEqual(['Buffer', 'process', 'setImmediate', 'clearImmediate']);
  });

  it('nothing is imported for names the module does not use, or declares or imports itself', () => {
    expect(globalsImportFor('export const sum = (a: number, b: number) => a + b;')).toBeNull();
    expect(globalsImportFor('const myBuffer = 1; const processing = 2; const BufferLike = 3;')).toBeNull();
    expect(globalsImportFor("import { Buffer } from 'node:buffer';\nexport const b = Buffer.alloc(1);")).toBeNull();
    expect(globalsImportFor("import process from 'node:process';\nexport const p = process.platform;")).toBeNull();
    expect(globalsImportFor("import * as process from 'node:process';\nexport const p = process.platform;")).toBeNull();
    expect(globalsImportFor('const process = { platform: "test" }; export const p = process.platform;')).toBeNull();
    expect(globalsImportFor('function setImmediate(fn: () => void) { fn(); }\nsetImmediate(() => {});')).toBeNull();
    // Only the declared name is skipped; the others are still imported.
    expect(globalsImportFor('const process = { platform: "x" }; export const b = Buffer.from(process.platform);')).toBe(
      `import { Buffer } from "${GLOBALS_SPECIFIER}";`,
    );
  });

  it('module-level bindings are read from the syntax tree: destructuring, declaration lists, enums, aliases, hoisted var', () => {
    // Each of these binds the global's name itself: a second import of it would be a duplicate binding.
    const declared: string[] = [
      'const { Buffer } = someModule;\nexport const b = Buffer.from("x");',
      'const { a, nested: { Buffer = fallback }, ...rest } = someModule;\nexport const b = Buffer.from(a + rest);',
      'const { other: process } = someModule;\nexport const p = process.platform;',
      'const [first, process] = list;\nexport const p = process.platform + first;',
      'const [, ...process] = list;\nexport const n = process.length;',
      'const { ...Buffer } = someModule;\nexport const b = Buffer;',
      'let a = 1, process = 2;\nexport const p = a + process;',
      'var x, y = 1, setImmediate;\nsetImmediate = x + y;',
      'enum Buffer { A, B }\nexport const b = Buffer.A;',
      'export enum process { A }',
      'export const enum Buffer { A }',
      'namespace Buffer { export const x = 1; }\nexport const b = Buffer.x;',
      'import fs, { x as process } from "./y";\nexport const p = process + fs;',
      'import { type Buffer } from "./y";\nexport type B = Buffer;',
      'import type { Buffer } from "node:buffer";\nexport type B = Buffer;',
      'import Buffer = require("./buffer");\nexport const b = Buffer;',
      'export default function setImmediate(fn: () => void): void { fn(); }',
      'export default class Buffer {}',
      'export function process(): void {}',
      'export class Buffer {}',
      'export const { setImmediate, clearImmediate } = timers;\nsetImmediate(() => clearImmediate(1));',
      'if (legacy) { var process = { platform: "x" }; }\nexport const p = process?.platform;',
      'for (var setImmediate of list) { setImmediate(); }',
      'try { run(); } catch { var Buffer = null; }\nexport const b = Buffer;',
      'declare const Buffer: { from(text: string): Uint8Array };\nexport const b = Buffer.from("x");',
      'declare function setImmediate(fn: () => void): void;\nsetImmediate(() => {});',
      'interface process { platform: string }\nexport type P = process;',
      'type Buffer = Uint8Array;\nexport const size = (b: Buffer): number => b.length;',
    ];
    for (const code of declared) expect(globalsImportFor(code), code).toBeNull();

    // These do not: the name is free at module level and must come from the globals shim.
    const free: Array<[string, string]> = [
      // Only the local alias of an import is a binding, not the imported name.
      ['import { Buffer as B, x as process } from "./y";\nexport const b = Buffer.from(process.platform + B.name);', 'Buffer'],
      ['export { x as Buffer } from "./y";\nexport const b = Buffer.alloc(1);', 'Buffer'],
      ['export * as process from "./y";\nexport const p = process.platform;', 'process'],
      // A declaration inside a function, a block or a class shadows the import there; it is not module-level.
      ['function f() { const process = { platform: "x" }; return process.platform; }\nexport const p = process.platform + f();', 'process'],
      ['function f() { var setImmediate = 1; return setImmediate; }\nsetImmediate(f);', 'setImmediate'],
      ['export const f = (Buffer: unknown) => Buffer;\nexport const b = Buffer.alloc(1);', 'Buffer'],
      ['{ let process = 1; void process; }\nexport const p = process.platform;', 'process'],
      ['class A { static { var process = 1; void process; } }\nexport const p = process.platform + A.name;', 'process'],
      ['export default (class Buffer {});\nexport const b = Buffer.alloc(1);', 'Buffer'],
      ['namespace N { export const process = 1; }\nexport const p = process.platform + N.process;', 'process'],
      // Property names and object keys are not declarations.
      ['const o = { Buffer: 1, process: 2 };\nexport const b = Buffer.from(String(o.process)) + process.platform;', 'Buffer, process'],
      ['const { Buffer: Renamed } = someModule;\nexport const b = Buffer.from(Renamed.name);', 'Buffer'],
      ['const text = "const Buffer = 1; let process = 2";\nexport const b = Buffer.from(text);', 'Buffer, process'],
    ];
    for (const [code, names] of free) expect(globalsImportFor(code), code).toBe(`import { ${names} } from "${GLOBALS_SPECIFIER}";`);
  });

  it('topLevelBindings lists every module-level name; the language comes from the file name', () => {
    const code = [
      "import type { Foo } from './foo';",
      "import { Buffer as B, x as process, type T } from './y';",
      "import D, * as NS from 'z';",
      'const { one, two: Renamed, deep: { three = 3 }, ...rest } = someModule;',
      'let a = 1, [b = 2, , ...others] = list;',
      'enum E { A }',
      'declare const declared: number;',
      'namespace Space { export const inner = 1; }',
      "declare module 'ambient' { export const hidden: number; }",
      'export function fn(arg: number): void { const local = arg; var hoistedInFn = local; }',
      'export class Klass { static { var inStaticBlock = 1; } }',
      'export default class Dflt {}',
      "import req = require('x');",
      'type Alias = string;',
      'interface Shape {}',
      'export const { p1, p2: { p3 } } = obj;',
      'if (cond) { var hoisted = 1; let blockScoped = 2; }',
      'for (var i = 0, j = 1; i < j; i++) { var inLoop; }',
      "export { x as reExported } from './y';",
    ].join('\n');
    expect([...(topLevelBindings(code) as Set<string>)].sort()).toEqual(
      ['Alias', 'B', 'D', 'Dflt', 'E', 'Foo', 'Klass', 'NS', 'Renamed', 'Shape', 'Space', 'T', 'a', 'b', 'declared', 'fn', 'hoisted', 'i', 'inLoop', 'j', 'one', 'others', 'p1', 'p3', 'process', 'req', 'rest', 'three'].sort(),
    );
    expect(topLevelBindings('')).toEqual(new Set());
    // JSX only parses as .tsx / .jsx; plain JavaScript has no type syntax.
    expect(topLevelBindings('const process = <div>{1}</div>;', at('server/src/view.tsx'))).toEqual(new Set(['process']));
    expect(topLevelBindings('const process = <div>{1}</div>;', 'view.jsx?v=1')).toEqual(new Set(['process']));
    expect(topLevelBindings('const process = <div>{1}</div>;', at('server/src/view.ts'))).toBeNull();
    expect(topLevelBindings('const { Buffer } = require("buffer");', 'legacy.cjs')).toEqual(new Set(['Buffer']));
    expect(topLevelBindings('enum E { A }', 'plain.mjs')).toBeNull();
    expect(topLevelBindings('enum E { A }', 'typed.mts')).toEqual(new Set(['E']));
  });

  it('code that does not parse falls back to the text heuristic instead of throwing', () => {
    expect(topLevelBindings('const = ;')).toBeNull();
    expect(globalsImportFor('const Buffer = ;\nexport const b = Buffer.from(1);')).toBeNull();
    expect(globalsImportFor('const x = ;\nexport const b = Buffer.from(x);')).toBe(`import { Buffer } from "${GLOBALS_SPECIFIER}";`);
    const p = plugin();
    expect(p.transform('const process = <a/>;\nexport const b = Buffer.alloc(1);\n', at('server/src/view.tsx'))).toBe(
      `import { Buffer } from "${GLOBALS_SPECIFIER}"; const process = <a/>;\nexport const b = Buffer.alloc(1);\n`,
    );
  });

  it('cross-check against the TypeScript compiler: the same module-level names in every file of the core, no collision, nothing missed', () => {
    /** The module-level names of a file by the TypeScript syntax tree (an independent implementation). */
    const byTypeScript = (file: string, code: string): Set<string> => {
      const source = ts.createSourceFile(file, code, ts.ScriptTarget.ES2022, false, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const names = new Set<string>();
      const bind = (name: ts.Node | undefined): void => {
        if (!name) return;
        if (ts.isIdentifier(name)) names.add(name.text);
        else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
          for (const element of name.elements) if (ts.isBindingElement(element)) bind(element.name);
        }
      };
      for (const statement of source.statements) {
        if (ts.isImportDeclaration(statement)) {
          const clause = statement.importClause;
          bind(clause?.name);
          const bindings = clause?.namedBindings;
          if (bindings && ts.isNamespaceImport(bindings)) bind(bindings.name);
          if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) bind(element.name);
        } else if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) bind(declaration.name);
        } else if (
          ts.isFunctionDeclaration(statement) ||
          ts.isClassDeclaration(statement) ||
          ts.isEnumDeclaration(statement) ||
          ts.isModuleDeclaration(statement) ||
          ts.isInterfaceDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement) ||
          ts.isImportEqualsDeclaration(statement)
        ) {
          bind(statement.name);
        }
      }
      return names;
    };

    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) files.push(full);
      }
    };
    for (const dir of ['server/src', 'shared', 'mobile/core/shims']) walk(path.join(process.cwd(), ...dir.split('/')));
    expect(files.length).toBeGreaterThan(300);

    const differences: string[] = [];
    let injected = 0;
    for (const file of files) {
      const relative = path.relative(process.cwd(), file).split(path.sep).join('/');
      const code = fs.readFileSync(file, 'utf8');
      const expected = byTypeScript(file, code);
      const actual = topLevelBindings(code, file);
      if (!actual) {
        differences.push(`${relative}: does not parse`);
        continue;
      }
      if ([...actual].sort().join(',') !== [...expected].sort().join(',')) {
        differences.push(`${relative}: parser [${[...actual].sort().join(', ')}] vs TypeScript [${[...expected].sort().join(', ')}]`);
      }
      // The import the plugin adds: exactly the globals the file names and does not bind itself.
      const wanted = INJECTED_GLOBALS.filter((name) => new RegExp(`\\b${name}\\b`).test(code) && !expected.has(name));
      const line = globalsImportFor(code, file);
      if ((line ?? '') !== (wanted.length ? `import { ${wanted.join(', ')} } from "${GLOBALS_SPECIFIER}";` : '')) {
        differences.push(`${relative}: injects ${line ?? 'nothing'}, expected ${wanted.join(', ') || 'nothing'}`);
      }
      if (line) injected += 1;
    }
    expect(differences).toEqual([]);
    expect(injected).toBeGreaterThanOrEqual(30);
  }, 60_000);

  it('the import is prepended on the first line, so line numbers of the module stay', () => {
    const p = plugin();
    const code = "import { randomBytes } from 'node:crypto';\n\nexport function salt(): Buffer {\n  return randomBytes(16);\n}\n";
    const out = p.transform(code, SERVER_KDF) as string;
    const lines = out.split('\n');
    expect(lines).toHaveLength(code.split('\n').length);
    expect(lines[0]).toBe(`import { Buffer } from "${GLOBALS_SPECIFIER}"; import { randomBytes } from '${REWRITE_PREFIX}node:crypto';`);
    expect(lines.slice(1)).toEqual(code.split('\n').slice(1));
    // shared/ modules get them as well; the option switches the injection off.
    expect(p.transform('export const now = process.hrtime();\n', SHARED_MODULE)).toBe(
      `import { process } from "${GLOBALS_SPECIFIER}"; export const now = process.hrtime();\n`,
    );
    const noGlobals = plugin({ projectRoot: process.cwd(), injectGlobals: false });
    expect(noGlobals.transform('export const b = Buffer.alloc(1);\n', SERVER_KDF)).toBeNull();
  });

  it('every server module of the core that uses a Node global gets it: none relies on a real global', () => {
    // The inventory: which core modules name which global (kept here so a new use is noticed).
    const users: Record<string, string[]> = {};
    const walk = (dir: string): void => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (name.endsWith('.ts') && !name.endsWith('.d.ts') && !name.endsWith('.test.ts')) {
          const line = globalsImportFor(fs.readFileSync(full, 'utf8'));
          if (!line) continue;
          const names = /\{ (.*) \}/.exec(line)?.[1].split(', ') ?? [];
          for (const global of names) (users[global] ??= []).push(path.relative(path.join(process.cwd(), 'server', 'src'), full).split(path.sep).join('/'));
        }
      }
    };
    walk(path.join(process.cwd(), 'server', 'src'));
    expect(Object.keys(users).sort()).toEqual(expect.arrayContaining(['Buffer', 'process', 'setImmediate']));
    expect(users.Buffer).toEqual(expect.arrayContaining(['security/container.ts', 'security/kdf.ts', 'backup/backup.ts']));
    expect(users.process).toEqual(expect.arrayContaining(['config.ts', 'export/fonts.ts']));
    expect(users.setImmediate).toEqual(expect.arrayContaining(['security/resets.ts', 'security/password-reset.ts']));
  });
});

describe('alias plugin: the desktop build never sees it or the shims', () => {
  /** Text that only shim code contains (each is a string literal that survives minification). */
  const SHIM_MARKERS = ['ERR_MOBILE_UNAVAILABLE', 'is not available on mobile', 'Invalid scrypt params', 'mobile-core-import:', 'provideSqlWasm', '__mpdBase64Url'];

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
      for (const name of fs.readdirSync(current)) {
        const full = path.join(current, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(full);
      }
    };
    walk(dir);
    return out;
  }

  /** `file: specifier` of every import in `files` whose specifier matches. */
  function importsMatching(files: string[], pattern: RegExp): string[] {
    const hits: string[] = [];
    for (const file of files) {
      const code = fs.readFileSync(file, 'utf8');
      for (const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(["'])([^"'\n]+)\1/g)) {
        if (pattern.test(match[2])) hits.push(`${path.relative(process.cwd(), file).split(path.sep).join('/')}: ${match[2]}`);
      }
    }
    return hits;
  }

  it('the desktop configs do not load the plugin', () => {
    for (const config of ['vite.config.ts', 'vitest.config.ts', 'server/vitest.config.ts', 'scripts/build-server.mjs']) {
      if (!fs.existsSync(at(config))) continue;
      expect(fs.readFileSync(at(config), 'utf8'), config).not.toMatch(/alias-plugin|mobileCoreAlias|mobile\/core/);
    }
  });

  it('the UI (src/) imports nothing of the core, the shims or their packages - only the two mobile start-ups, behind __MOBILE__', () => {
    const ui = sourceFiles(path.join(process.cwd(), 'src'));
    expect(ui.length).toBeGreaterThan(50);
    // The one @noble import the UI may have: the offline engine derives the password wrap with scrypt
    // (src/offline/password-wrap.ts, OFFLINE-DESIGN section 13, 2026-11-08) straight from the installed
    // package, not through the mobile shims. Anything else from @noble/ or the shims is still forbidden.
    expect(importsMatching(ui, /mobile\/core|@noble\/|^buffer(\/|$)|^path-browserify$|mobile-vendor:|mobile-core:/)).toEqual([
      'src/offline/password-wrap.ts: @noble/hashes/scrypt.js',
    ]);
    // The local-core start-up (behind __MOBILE_LOCAL_CORE__) and the published server-only one (WP-H6).
    expect(importsMatching(ui, /(^|\/)mobile\//)).toEqual(['src/main.tsx: ../mobile/host/boot', 'src/main.tsx: ../mobile/host/server-mode']);
  });

  it('the server-mode start-up of the published app imports nothing of the in-process core (WP-H6)', () => {
    const serverMode = [at('mobile/host/server-mode.ts'), at('mobile/host/splash.ts')];
    expect(importsMatching(serverMode, /core|boot|storage|assets|multipart|@noble\/|^buffer(\/|$)|mobile-vendor:|mobile-core:/)).toEqual([]);
    // What it does import: the UI's API client and platform helpers, the phone features (by type and on demand), the splash.
    expect(importsMatching(serverMode, /./).map((hit) => hit.split(': ')[1]).sort()).toEqual(['../platform', '../platform', './splash', '@/api', '@/api/client', '@/utils/platform']);
  });

  it('the mobile host (main thread) does not import the shims either: they live in the worker', () => {
    const host = [...sourceFiles(path.join(process.cwd(), 'mobile', 'host')), ...sourceFiles(path.join(process.cwd(), 'mobile', 'shared'))];
    expect(host.length).toBeGreaterThan(5);
    expect(importsMatching(host, /core\/shims|@noble\/|^buffer(\/|$)|^path-browserify$|mobile-vendor:|mobile-core:/)).toEqual([]);
  });

  it.skipIf(!fs.existsSync(path.join(process.cwd(), 'dist', 'assets')))('the dist/ on disk (what the desktop installer packages) contains no shim code', () => {
    const assets = path.join(process.cwd(), 'dist', 'assets');
    const hits: string[] = [];
    for (const name of fs.readdirSync(assets)) {
      if (!name.endsWith('.js')) continue;
      const text = fs.readFileSync(path.join(assets, name), 'utf8');
      for (const marker of SHIM_MARKERS) if (text.includes(marker)) hits.push(`${name}: ${marker}`);
    }
    expect(hits).toEqual([]);
  });

  it('the markers are real: each one is in the shim sources', () => {
    const shims = sourceFiles(path.join(process.cwd(), 'mobile', 'core', 'shims'));
    const text = [...shims.map((file) => fs.readFileSync(file, 'utf8')), fs.readFileSync(at('mobile/core/alias-plugin.ts'), 'utf8')].join('\n');
    for (const marker of SHIM_MARKERS) expect(text.includes(marker), marker).toBe(true);
  });
});

describe('alias plugin: it is active in this very test run', () => {
  it('a server module imported here runs on the shims; this file itself keeps Node', async () => {
    const kdf = await import('../../../server/src/security/kdf');
    const { Buffer: PolyfillBuffer } = await import('../../core/shims/buffer');
    const salt = kdf.newSalt();
    expect(salt).toBeInstanceOf(PolyfillBuffer);
    expect(Buffer.isBuffer(salt)).toBe(false);
    // In a test file `node:fs` is Node's (the file was read above) and Buffer is Node's.
    expect(Buffer.isBuffer(fs.readFileSync(at('package.json')))).toBe(true);
  });

  it('the replacement of util/paths is what server modules see', async () => {
    const config = await import('../../../server/src/util/paths');
    const paths = await import('../../core/shims/paths');
    // A test file is outside the scope: it gets the real module ...
    expect(config.bundleDir).not.toBe(paths.bundleDir);
    // ... while the shim reports the virtual assets directory.
    expect(paths.bundleDir()).toBe('/assets');
    expect(paths.isMainModule()).toBe(false);
    expect(() => paths.nodeRequire('sql.js')).toThrow(/not available on mobile/);
    expect(() => paths.nodeResolve('sql.js/dist/sql-wasm.wasm')).toThrow(/not available on mobile/);
  });
});
