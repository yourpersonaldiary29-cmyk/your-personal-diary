/**
 * WP-H3 (docs/HOSTED-PLAN.md 2.4, 5.8): the hosted composition must never carry remote access
 * (DuckDNS, ACME, UPnP - the only outbound code besides SMTP) or the Android shim. This test walks
 * the import graph from `src/hosted-index.ts` / `src/hosted.ts` - every `import` / `export ... from` /
 * `import()` / `require()` the TypeScript parser finds, type-only ones included - and fails when it
 * reaches `src/remote/**`, `mobile/**` or the desktop-only host check. It also asserts the other
 * direction: the portable graph of app.ts (what the Android core bundles) does not pull the hosted
 * composition or the hosted policy in.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SERVER_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(SERVER_ROOT, 'src');
const SHARED = path.resolve(SERVER_ROOT, '..', 'shared');

interface ImportRef {
  spec: string;
  typeOnly: boolean;
}

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

function rel(file: string): string {
  return path.relative(SERVER_ROOT, file).split(path.sep).join('/');
}

/** Every project file reachable from `roots` -> who imported it first; value (non-type) edges only when `valuesOnly`. */
function walk(roots: string[], valuesOnly = false): Map<string, string | null> {
  const files = new Map<string, string | null>();
  const queue: Array<[string, string | null]> = roots.map((r) => [r, null]);
  while (queue.length) {
    const [file, parent] = queue.shift()!;
    if (files.has(file)) continue;
    files.set(file, parent);
    for (const { spec, typeOnly } of importsOfSource(file, fs.readFileSync(file, 'utf8'))) {
      if (valuesOnly && typeOnly) continue;
      const target = resolveLocal(file, spec);
      if (target) queue.push([target, file]);
    }
  }
  return files;
}

function chainTo(graph: Map<string, string | null>, file: string): string {
  const chain: string[] = [];
  let current: string | null | undefined = file;
  while (current) {
    chain.push(rel(current));
    current = graph.get(current);
  }
  return chain.join(' <- ');
}

describe('import graph of the hosted composition', () => {
  const graph = walk([path.join(SRC, 'hosted-index.ts'), path.join(SRC, 'hosted.ts')]);
  const reached = [...graph.keys()].map(rel);

  it('covers what it is meant to cover (the walk is not vacuous)', () => {
    for (const expected of ['src/hosted.ts', 'src/app.ts', 'src/routes/auth.ts', 'src/routes/server.ts', 'src/routes/server-status.ts', 'src/hosted/policy.ts', 'src/hosted/owner.ts', 'src/middleware/hosted-host.ts', 'src/middleware/quota.ts', 'src/middleware/disk-paths.ts', 'src/mail/service.ts', 'src/mail/node-transport.ts', 'src/security/auth-service.ts']) {
      expect(reached).toContain(expected);
    }
  });

  it('never reaches src/remote/** - not even through a type import', () => {
    const remote = [...graph.keys()].filter((f) => rel(f).startsWith('src/remote/'));
    expect(remote.map((f) => chainTo(graph, f))).toEqual([]);
  });

  it('never reaches the Android tree, the express shim or the desktop-only host check', () => {
    expect(reached.filter((f) => f.startsWith('../mobile/') || f.includes('express-shim'))).toEqual([]);
    const hostCheck = path.join(SRC, 'middleware', 'host-check.ts');
    expect(graph.has(hostCheck) ? chainTo(graph, hostCheck) : 'not reached').toBe('not reached');
    expect(reached).not.toContain('src/server.ts');
    expect(reached).not.toContain('src/index.ts');
  });

  it('the hosted modules name no remote host and open no outbound connection', () => {
    for (const file of ['src/hosted.ts', 'src/hosted-index.ts', 'src/hosted/policy.ts', 'src/hosted/owner.ts', 'src/hosted/types.ts', 'src/routes/server-status.ts', 'src/routes/debug.ts', 'src/middleware/hosted-host.ts', 'src/middleware/quota.ts']) {
      const text = fs.readFileSync(path.join(SERVER_ROOT, file), 'utf8');
      expect({ file, clean: !/duckdns\.org|letsencrypt\.org|\bfetch\(|https\.request\(|net\.connect\(|tls\.connect\(|from ['"]node:(?:https|dns|dgram|tls)['"]/.test(text) }).toEqual({ file, clean: true });
    }
  });
});

describe('the other direction: the portable app graph stays free of the hosted composition', () => {
  const routeFiles = fs
    .readdirSync(path.join(SRC, 'routes'))
    .filter((name) => name.endsWith('.ts'))
    .map((name) => path.join(SRC, 'routes', name));
  // Value imports only: the Android core bundles what app.ts and the routers actually load.
  const portable = walk([...routeFiles, path.join(SRC, 'app.ts')], true);
  const reached = [...portable.keys()].map(rel);

  it('app.ts and the routers do not load hosted.ts, hosted-index.ts or the registration policy', () => {
    for (const forbidden of ['src/hosted.ts', 'src/hosted-index.ts', 'src/hosted/policy.ts', 'src/mail/node-transport.ts', 'src/middleware/host-check.ts']) {
      const abs = path.join(SERVER_ROOT, forbidden);
      expect({ forbidden, chain: portable.has(abs) ? chainTo(portable, abs) : 'not reached' }).toEqual({ forbidden, chain: 'not reached' });
    }
    // The pure hosted pieces the shared app needs are fine (they have no node:net / node:os).
    expect(reached).toContain('src/middleware/hosted-host.ts');
    expect(reached).toContain('src/hosted/owner.ts');
  });
});

describe('scripts/build-hosted.mjs', () => {
  it('bundles hosted-index.ts into server-hosted.cjs and audits the forbidden strings', () => {
    const script = fs.readFileSync(path.resolve(SERVER_ROOT, '..', 'scripts', 'build-hosted.mjs'), 'utf8');
    expect(script).toContain("'src', 'hosted-index.ts'");
    expect(script).toContain("'server-hosted.cjs'");
    // Code-only markers of remote access (the i18n texts mention yourpersonaldiary.duckdns.org in every bundle):
    // the one shared list of scripts/hosted/bundle-audit.mjs (asserted in detail by hosted-bundle-audit.test.ts).
    expect(script).toContain("from './hosted/bundle-audit.mjs'");
    const audit = fs.readFileSync(path.resolve(SERVER_ROOT, '..', 'scripts', 'hosted', 'bundle-audit.mjs'), 'utf8');
    for (const s of ['www.duckdns.org', 'acme-v02.api.letsencrypt.org', '239.255.255.250', 'express-shim']) expect(audit).toContain(`'${s}'`);
    // The desktop build script is untouched by hosted mode.
    const desktop = fs.readFileSync(path.resolve(SERVER_ROOT, '..', 'scripts', 'build-server.mjs'), 'utf8');
    expect(desktop).not.toContain('hosted');
  });
});
