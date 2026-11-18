/**
 * The disk button's exception in scripts/check-no-network.mjs (docs/server-tasks/SERVER-CARD-V2.md B2):
 * exactly server/src/hosted/fly-volume.ts may import node:https, call https.request and name exactly
 * https://api.machines.dev - no other URL, no plain http, no look-alike host, no other network module, no
 * fetch - and no other scanned file may name that host in code. The script runs against small throw-away
 * trees (`--root=<dir>`), never against files planted in the project, and once against the project itself.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'check-no-network.mjs');
const FLY = 'server/src/hosted/fly-volume.ts';
const trees: string[] = [];

/** A minimal project tree: the two package.json files the audit reads, plus `files`. */
function tree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpd-fly-audit-'));
  trees.push(root);
  const all: Record<string, string> = { 'package.json': '{ "dependencies": {} }', 'server/package.json': '{ "dependencies": {} }', ...files };
  for (const [name, content] of Object.entries(all)) {
    const full = path.join(root, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

function audit(root?: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, root ? [SCRIPT, `--root=${root}`] : [SCRIPT], { encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

afterEach(() => {
  for (const root of trees.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

/** What the real module does, in three lines. */
const GOOD = [
  "import https from 'node:https';",
  "export const FLY_API_BASE = 'https://api.machines.dev/v1';",
  "export const send = (url: string) => https.request(new URL(url), { method: 'GET', agent: false });",
  '',
].join('\n');

describe('check-no-network.mjs: the Fly API module of the disk button', () => {
  it('the project passes and the audit names the module and its one host', () => {
    const result = audit();
    expect(result.output).toContain('Network audit passed');
    expect(result.output).toContain(`${FLY} only https://api.machines.dev`);
    expect(result.status).toBe(0);
  });

  it('the module may import node:https, call https.request and name https://api.machines.dev', () => {
    const result = audit(tree({ [FLY]: GOOD }));
    expect(result.output).toContain('Network audit passed');
    expect(result.status).toBe(0);
  });

  it('the module may name no other URL: no other host, no plain http, no look-alike, not the private endpoint', () => {
    for (const bad of [
      "export const X = 'https://example.com/v1';",
      "export const X = 'http://api.machines.dev/v1';",
      "export const X = 'https://api.machines.dev.evil.example/v1';",
      "export const X = 'https://evil.example/?u=https://api.machines.dev';",
      "export const X = 'http://_api.internal:4280/v1';",
    ]) {
      const result = audit(tree({ [FLY]: `${GOOD}${bad}\n` }));
      expect({ bad, status: result.status }).toEqual({ bad, status: 1 });
      expect(result.output).toContain(`${FLY}:4`);
    }
  }, 120_000);

  it('the module may use no other network module and make no other outbound call', () => {
    for (const bad of [
      "import http from 'node:http';",
      "import http2 from 'node:http2';",
      "import tls from 'node:tls';",
      "import net from 'node:net';",
      "import dgram from 'node:dgram';",
      "import dns from 'node:dns';",
      "const h = require('node:https');",
      'export const f = () => fetch(FLY_API_BASE);',
      'export const g = () => tls.connect(443);',
      'export const n = () => net.connect(443);',
      "export const w = () => new WebSocket('wss://x');",
    ]) {
      const result = audit(tree({ [FLY]: `${GOOD}${bad}\n` }));
      expect({ bad, status: result.status }).toEqual({ bad, status: 1 });
    }
  }, 120_000);

  it('its one https.request takes the checked URL only: no other host in options, no second call, no https.get or Agent, no URL from pieces, node:https never handed on', () => {
    const cases: Array<[string, string]> = [
      ['a host in options', "export const a = () => https.request({ hostname: 'evil.example', path: '/' });"],
      ['a host next to the URL', "export const b = (url: string) => https.request(new URL(url), { host: 'evil.example' });"],
      ['a port of its own', "export const c = (url: string) => https.request(new URL(url), { port: 8443 });"],
      ['a connection of its own', 'export const d = (url: string) => https.request(new URL(url), { createConnection: () => null });'],
      ['https.get', "export const e = () => https.get('https://api.machines.dev/v1/apps');"],
      ['an Agent', 'export const f = new https.Agent({ keepAlive: true });'],
      ['a URL from a template', 'export const g = (h: string) => `https://${h}/v1`;'],
      ['a URL from two strings', "export const h = (x: string) => 'https:' + '//' + x;"],
      ['a URL from two strings, the second one', "export const i = (x: string) => x + '//evil.example/v1';"],
      ['a re-export of node:https', "export { default as transport } from 'node:https';"],
      ['a re-export of the binding', 'export { https };'],
      ['a default export of the binding', 'export default https;'],
      ['import() of node:https', "export const j = () => import('node:https');"],
      ['import() of node:tls', "export const k = () => import('node:tls');"],
    ];
    for (const [label, bad] of cases) {
      const result = audit(tree({ [FLY]: `${GOOD}${bad}\n` }));
      expect({ label, status: result.status }).toEqual({ label, status: 1 });
      expect(result.output, label).toContain(`${FLY}:4`);
    }
    // A second call of the right form is one call site too many.
    const twice = audit(tree({ [FLY]: `${GOOD}export const again = (url: string) => https.request(new URL(url), { method: 'GET' });\n` }));
    expect(twice.status).toBe(1);
    expect(twice.output).toContain('in one place only (found 2)');
    // Another file cannot load node:https through import() either; a type of it is no import.
    const dynamic = audit(tree({ [FLY]: GOOD, 'server/src/hosted/disk.ts': "export const t = () => import('node:https');\n" }));
    expect(dynamic.status).toBe(1);
    expect(dynamic.output).toContain('server/src/hosted/disk.ts:1');
    const typeOnly = audit(tree({ [FLY]: GOOD, 'server/src/hosted/disk.ts': "export type Https = typeof import('node:https');\n" }));
    expect(typeOnly.output).toContain('Network audit passed');
    expect(typeOnly.status).toBe(0);
  }, 180_000);

  it('no other file may name the host or open the connection - not another hosted module, a route, remote/, shared/ or the frontend', () => {
    const cases: Array<[string, string]> = [
      ['server/src/hosted/disk.ts', "export const BASE = 'https://api.machines.dev/v1';"],
      ['server/src/hosted/disk.ts', "export const HOST = 'api.machines.dev';"],
      ['server/src/hosted/disk.ts', "import https from 'node:https';"],
      ['server/src/routes/server-disk.ts', "const host = 'API.MACHINES.DEV';"],
      ['server/src/remote/fly.ts', "export const BASE = 'https://api.machines.dev/v1';"],
      ['server/src/hosted/fly-volume-copy.ts', GOOD],
      ['shared/fly.ts', "export const HOST = 'api.machines.dev';"],
      ['src/api/fly.ts', "export const HOST = 'api.machines.dev';"],
      ['mobile/core/fly.ts', "export const HOST = 'api.machines.dev';"],
    ];
    for (const [file, text] of cases) {
      const result = audit(tree({ [FLY]: GOOD, [file]: `${text}\n` }));
      expect({ file, text, status: result.status }).toEqual({ file, text, status: 1 });
      expect(result.output).toContain(file);
    }
  }, 120_000);

  it('the other spellings of a load, a host or a connection are seen too: getBuiltinModule, createRequire, backticks, split lines, .mts / .cts, a code line starting with *, host pieces and escapes, named imports, new Socket', () => {
    const DISK = 'server/src/hosted/disk.ts';
    const cases: Array<[string, string, string]> = [
      ['process.getBuiltinModule', DISK, "export const a = () => process.getBuiltinModule('node:https');"],
      ['import() over three lines', DISK, "export const b = () => import(\n  'node:https'\n);"],
      ['import() with a template literal', DISK, 'export const c = () => import(`node:https`);'],
      ['require() with a template literal', DISK, 'export const d = require(`node:tls`);'],
      ['createRequire()()', DISK, "import { createRequire } from 'node:module';\nexport const e = createRequire(import.meta.url)('node:https');"],
      ['a code line that starts with *', DISK, "export const f = 2\n  * (await import('node:https')).default.length;"],
      ['a .mts file', 'server/src/hosted/disk.mts', "import https from 'node:https';\nexport default https;"],
      ['a .cts file', 'server/src/hosted/disk.cts', "import https from 'node:https';\nexport default https;"],
      ['the host from two pieces', DISK, "export const g = 'api.machines' + '.dev';"],
      ['the host with escaped dots', DISK, "export const h = 'api\\x2emachines\\x2edev';"],
      ['the host in a template line starting with *', DISK, 'export const i = `x\n* https://api.machines.dev/v1`;'],
      ['connect imported by name from node:net', DISK, "import { connect } from 'node:net';\nexport const j = () => connect(443, 'evil.example');"],
      ['new net.Socket()', DISK, "import net from 'node:net';\nexport const k = () => new net.Socket().connect(443, 'evil.example');"],
      ['request imported by name from node:http', DISK, "import { request } from 'node:http';\nexport const l = () => request({ host: 'evil.example' });"],
      ['Fly: a URL from join()', FLY, "export const m = (h: string) => ['https:', '', h].join('/');"],
      ['Fly: a protocol-relative URL with a base', FLY, "export const n = (b: string) => new URL('//evil.example/v1', b);"],
      ['Fly: https[...]', FLY, "export const o = (u: string) => https['req' + 'uest'](u);"],
      ['Fly: getBuiltinModule of node:http', FLY, "export const p = () => process.getBuiltinModule('node:http');"],
      ['Fly: import() of node:tls over two lines', FLY, "export const q = () => import(\n'node:tls');"],
    ];
    for (const [label, file, text] of cases) {
      const files = file === FLY ? { [FLY]: `${GOOD}${text}\n` } : { [FLY]: GOOD, [file]: `${text}\n` };
      const result = audit(tree(files));
      expect({ label, status: result.status }).toEqual({ label, status: 1 });
      expect(result.output, label).toContain(file);
    }
  }, 240_000);

  it('a comment may mention the host (documentation is never fetched), like every other host', () => {
    const result = audit(tree({ [FLY]: GOOD, 'server/src/hosted/disk.ts': '// the Fly Machines API at api.machines.dev\n/**\n * https://api.machines.dev/v1\n */\nexport const x = 1;\n' }));
    expect(result.output).toContain('Network audit passed');
    expect(result.status).toBe(0);
  });
});
