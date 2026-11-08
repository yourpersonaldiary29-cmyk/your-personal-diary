// @vitest-environment node
/**
 * The dev-server side of the core (`npm run mobile:dev`, mobile/vite.config.mobile.ts). There the
 * worker is an unbundled module worker, so two things the bundler does by itself in the build are
 * done by the config:
 *  - the two CommonJS vendor bundles of the core (the browser builds of sql.js and pdfkit) are
 *    wrapped as ES modules - without that the worker cannot import them, fails to load, and the
 *    splash reports that the core did not start;
 *  - the packages the core imports by name are pre-bundled when the server starts.
 * The wrapper is run here the way a browser runs an ES module: in strict mode.
 */
import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { comparablePath, VENDOR_FILES } from '../../core/alias-plugin';
import { commonJsAsEsModule, CORE_DEV_DEPENDENCIES, vendorBundlePaths } from '../../vite.config.mobile';

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const EXPORT_LINE = 'export default module.exports;';

/** Runs the wrapped module as an ES module would run (strict mode) and returns its default export. */
function evaluate(wrapped: string, globals: Record<string, unknown> = {}): unknown {
  expect(wrapped.trimEnd().endsWith(EXPORT_LINE)).toBe(true);
  const body = wrapped.trimEnd().slice(0, -EXPORT_LINE.length);
  const names = Object.keys(globals);
  const run = new Function(...names, `"use strict";\n${body}\nreturn module.exports;`);
  return run(...names.map((name) => globals[name]));
}

describe('dev server: CommonJS vendor bundles as ES modules', () => {
  it('the default export is module.exports of a UMD bundle; an AMD loader on the page is not used', () => {
    const umd = `(function (root, factory) {
      if (typeof define === 'function' && define.amd) define([], factory);
      else if (typeof module === 'object' && module.exports) module.exports = factory();
      else root.Thing = factory();
    })(this, function () { return { name: 'thing' }; });`;
    const amd: unknown[] = [];
    const define = Object.assign((...args: unknown[]) => amd.push(args), { amd: true });
    expect(evaluate(commonJsAsEsModule(umd), { define })).toEqual({ name: 'thing' });
    expect(amd).toEqual([]);
  });

  it('`exports.x = ...` bundles work too, `this` is the exports object, and a trailing line comment does not swallow the wrapper', () => {
    const cjs = "exports.answer = 42;\nexports.self = this === exports;\n//# sourceMappingURL=x.js.map";
    expect(evaluate(commonJsAsEsModule(cjs))).toEqual({ answer: 42, self: true });
  });

  it('wraps exactly the vendor files of the alias plugin, and they exist', () => {
    const bundles = vendorBundlePaths();
    expect(bundles.size).toBe(Object.keys(VENDOR_FILES).length);
    for (const relative of Object.values(VENDOR_FILES)) {
      const file = path.resolve(projectRoot, relative);
      expect(fs.existsSync(file), relative).toBe(true);
      expect(bundles.has(comparablePath(file)), relative).toBe(true);
      // The dev server names files outside its root with /@fs/: the same file must be recognised.
      expect(bundles.has(comparablePath(`/@fs/${file.split(path.sep).join('/')}?v=1`)), relative).toBe(true);
    }
    expect(bundles.has(comparablePath(path.resolve(projectRoot, 'server/node_modules/sql.js/dist/sql-wasm.js')))).toBe(false);
  });

  it('the real sql.js and pdfkit bundles load through the wrapper in strict mode', () => {
    const load = (specifier: keyof typeof VENDOR_FILES): unknown =>
      evaluate(commonJsAsEsModule(fs.readFileSync(path.resolve(projectRoot, VENDOR_FILES[specifier]), 'utf8')));
    const initSqlJs = load('mobile-vendor:sql.js');
    expect(typeof initSqlJs).toBe('function');
    const PDFDocument = load('mobile-vendor:pdfkit') as { prototype?: Record<string, unknown> };
    expect(typeof PDFDocument).toBe('function');
    expect(typeof PDFDocument.prototype?.registerFont).toBe('function');
    expect(typeof PDFDocument.prototype?.font).toBe('function');
  });
});

describe('dev server: pre-bundled packages of the core', () => {
  it('every listed package is installed', () => {
    for (const dependency of CORE_DEV_DEPENDENCIES) {
      expect(fs.existsSync(path.join(projectRoot, 'node_modules', dependency)), dependency).toBe(true);
    }
  });

  it('every package the shims import by name is listed (a new one would restart the optimizer under the loading worker)', () => {
    const shimsDir = path.resolve(projectRoot, 'mobile', 'core', 'shims');
    const builtins = new Set(builtinModules);
    const imported = new Set<string>();
    for (const name of fs.readdirSync(shimsDir)) {
      if (!name.endsWith('.ts') || name.endsWith('.d.ts')) continue;
      const source = fs.readFileSync(path.join(shimsDir, name), 'utf8');
      for (const match of source.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+'([^']+)'/gm)) {
        const specifier = match[1];
        if (specifier.startsWith('.') || specifier.includes(':') || builtins.has(specifier)) continue;
        imported.add(specifier);
      }
    }
    expect(imported.size).toBeGreaterThan(0);
    for (const specifier of imported) expect(CORE_DEV_DEPENDENCIES, specifier).toContain(specifier);
  });
});
