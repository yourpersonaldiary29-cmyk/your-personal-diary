/**
 * The Android build runs the routes, the mail service and the password-reset service inside a Web
 * Worker, where node:net / node:tls do not exist: the SMTP conversation is injected there
 * (mail/transport.ts). This test walks the import graph of those modules - every `import` /
 * `export ... from` / `import()` / `require()` found by the TypeScript parser, type-only ones
 * included - and fails when it reaches socket code:
 *
 *   - no module in the graph imports node:net / node:tls (an `import type` is erased by the
 *     compiler and cannot pull the module into a bundle, so only that form is tolerated);
 *   - mail/node-transport.ts, the one mail module that opens sockets, is not in the graph at all:
 *     only server.ts (the desktop composition) imports it.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SERVER_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(SERVER_ROOT, 'src');
const SHARED = path.resolve(SERVER_ROOT, '..', 'shared');
const NODE_TRANSPORT = path.join(SRC, 'mail', 'node-transport.ts');

interface ImportRef {
  spec: string;
  typeOnly: boolean;
}

/** Every module specifier of a source text (static, re-export, dynamic import, require, import type). */
function importsOfSource(fileName: string, text: string): ImportRef[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true);
  const out: ImportRef[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      out.push({ spec: node.moduleSpecifier.text, typeOnly: node.importClause?.isTypeOnly === true });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      out.push({ spec: node.moduleSpecifier.text, typeOnly: node.isTypeOnly });
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      const callee = node.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require')) {
        out.push({ spec: node.arguments[0].text, typeOnly: false });
      }
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      out.push({ spec: node.argument.literal.text, typeOnly: true });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

function importsOf(file: string): ImportRef[] {
  return importsOfSource(file, fs.readFileSync(file, 'utf8'));
}

/** The project file a relative / '@shared/...' specifier names; null for packages and node builtins. */
function resolveLocal(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@shared/')) base = path.join(SHARED, spec.slice('@shared/'.length));
  else if (spec === '@shared') base = SHARED;
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`unresolved import '${spec}' in ${rel(from)}`);
}

interface Graph {
  /** Every project file reached -> the file that imported it first (null for the roots). */
  files: Map<string, string | null>;
  /** Socket-module imports found: 'src/x.ts imports node:net'. */
  socketImports: string[];
}

const SOCKET_MODULE = /^(?:node:)?(?:net|tls)$/;

function walk(roots: string[]): Graph {
  const files = new Map<string, string | null>();
  const socketImports: string[] = [];
  const queue: Array<[string, string | null]> = roots.map((r) => [r, null]);
  while (queue.length) {
    const [file, parent] = queue.shift()!;
    if (files.has(file)) continue;
    files.set(file, parent);
    for (const { spec, typeOnly } of importsOf(file)) {
      if (SOCKET_MODULE.test(spec)) {
        if (!typeOnly) socketImports.push(`${rel(file)} imports ${spec}`);
        continue;
      }
      // Type-only imports of project files are followed too: stricter than needed, never wrong.
      const target = resolveLocal(file, spec);
      if (target) queue.push([target, file]);
    }
  }
  return { files, socketImports };
}

function rel(file: string): string {
  return path.relative(SERVER_ROOT, file).split(path.sep).join('/');
}

/** 'a.ts <- b.ts <- c.ts': how the walk reached `file` (for a readable failure). */
function chainTo(graph: Graph, file: string): string {
  const chain: string[] = [];
  let current: string | null | undefined = file;
  while (current) {
    chain.push(rel(current));
    current = graph.files.get(current);
  }
  return chain.join(' <- ');
}

const routeFiles = fs
  .readdirSync(path.join(SRC, 'routes'))
  .filter((name) => name.endsWith('.ts'))
  .map((name) => path.join(SRC, 'routes', name));

/** What the Android core composes: the routers (as app.ts mounts them), the mail and reset services. */
const PORTABLE_ROOTS = [
  ...routeFiles,
  path.join(SRC, 'app.ts'),
  path.join(SRC, 'mail', 'service.ts'),
  path.join(SRC, 'security', 'password-reset.ts'),
];

describe('import graph of the routes and the mail service', () => {
  const graph = walk(PORTABLE_ROOTS);
  const reached = [...graph.files.keys()].map(rel);

  it('covers the modules it is meant to guard (the walk is not vacuous)', () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(10);
    for (const expected of [
      'src/routes/auth.ts',
      'src/routes/server.ts',
      'src/mail/service.ts',
      'src/mail/errors.ts',
      'src/mail/transport.ts',
      'src/mail/settings.ts',
      'src/security/auth-service.ts',
      'src/security/vault.ts',
      'src/middleware/access.ts',
    ]) {
      expect(reached).toContain(expected);
    }
  });

  it('never reaches node:net / node:tls', () => {
    expect(graph.socketImports).toEqual([]);
  });

  it('does not contain the node SMTP transport: it is injected, never imported', () => {
    expect(graph.files.has(NODE_TRANSPORT) ? chainTo(graph, NODE_TRANSPORT) : 'not reached').toBe('not reached');
    expect(reached).not.toContain('src/mail/smtp.ts');
    expect(reached).not.toContain('src/middleware/host-check.ts');
  });

  it('the mail failure helpers come from the pure mail/errors.ts', () => {
    for (const file of ['routes/auth.ts', 'routes/server.ts', 'security/password-reset.ts']) {
      const specs = importsOf(path.join(SRC, file)).map((i) => i.spec);
      expect({ file, fromErrors: specs.includes('../mail/errors') }).toEqual({ file, fromErrors: true });
      expect({ file, fromService: specs.includes('../mail/service') }).toEqual({ file, fromService: false });
    }
    const errors = walk([path.join(SRC, 'mail', 'errors.ts')]);
    expect(errors.socketImports).toEqual([]);
    expect([...errors.files.keys()].map(rel).filter((f) => f.startsWith('src/mail/'))).toEqual(['src/mail/errors.ts']);
  });
});

describe('the detector itself', () => {
  it('sees the socket imports of the node transport', () => {
    const transport = walk([NODE_TRANSPORT]);
    expect([...transport.socketImports].sort()).toEqual([
      'src/mail/node-transport.ts imports node:net',
      'src/mail/node-transport.ts imports node:tls',
    ]);
  });

  it('the desktop server reaches the node transport (the default of startServer) and the host check', () => {
    const desktop = walk([path.join(SRC, 'server.ts')]);
    expect(desktop.files.get(NODE_TRANSPORT)).toBe(path.join(SRC, 'server.ts'));
    expect(desktop.files.has(path.join(SRC, 'middleware', 'host-check.ts'))).toBe(true);
  });

  it('finds every import form, and ignores imports that are only mentioned in comments or strings', () => {
    const sample = [
      "/* import net from 'node:net'; */",
      "// import tls from 'node:tls';",
      'const text = "import x from \'node:dgram\'";',
      "import a from 'node:net';",
      "import type { Socket } from 'node:tls';",
      "export { b } from './b';",
      "export type { C } from './c';",
      "const d = await import('./d');",
      "const e = require('./e');",
      "type F = import('./f').F;",
    ].join('\n');
    expect(importsOfSource('sample.ts', sample)).toEqual([
      { spec: 'node:net', typeOnly: false },
      { spec: 'node:tls', typeOnly: true },
      { spec: './b', typeOnly: false },
      { spec: './c', typeOnly: true },
      { spec: './d', typeOnly: false },
      { spec: './e', typeOnly: false },
      { spec: './f', typeOnly: true },
    ]);
  });
});
