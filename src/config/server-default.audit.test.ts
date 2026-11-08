/**
 * The audit rules of scripts/check-no-network.mjs for the clients' default server address
 * (docs/HOSTED-PLAN.md 5.8 rule 5, docs/android-tasks/HOSTED-IMPL.md item 8): the address lives ONLY in
 * src/config/server-default.json, must be a bare https origin, may not be spelt as a literal anywhere in
 * src/, mobile/ or shared/, and the built client bundle (dist/assets/*.js) may name no other host on the
 * internet - the fixed server is the ONE outbound host of the Windows and Android apps.
 *
 * The script is run against small throw-away trees (`--root=<dir>`), never against files planted in
 * the project, and once against the project itself (which must pass with the real address). The Node
 * modules are loaded through a computed specifier because the root tsconfig deliberately has no Node
 * types (it checks browser code) - the convention of the other root tests that read the disk.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import serverDefault from './server-default.json';

interface NodeFs {
  mkdirSync(p: string, options: { recursive: boolean }): void;
  mkdtempSync(prefix: string): string;
  readdirSync(p: string): string[];
  readFileSync(p: string, encoding: 'utf8'): string;
  rmSync(p: string, options: { recursive: boolean; force: boolean }): void;
  writeFileSync(p: string, content: string): void;
}
interface NodePath {
  dirname(p: string): string;
  join(...parts: string[]): string;
}
interface NodeChildProcess {
  spawnSync(command: string, args: string[], options: { encoding: 'utf8' }): { status: number | null; stdout: string; stderr: string };
}

const load = (specifier: string) => import(/* @vite-ignore */ specifier);
let fs: NodeFs;
let pathMod: NodePath;
let spawnSync: NodeChildProcess['spawnSync'];
let tmpdir: () => string;
let projectRoot = '';
let script = '';
/** The Node binary running this test (the audit is a Node script). */
const nodeExecPath = (globalThis as unknown as { process: { execPath: string } }).process.execPath;

beforeAll(async () => {
  fs = (await load('node:fs')) as NodeFs;
  pathMod = (await load('node:path')) as NodePath;
  ({ spawnSync } = (await load('node:child_process')) as NodeChildProcess);
  ({ tmpdir } = (await load('node:os')) as { tmpdir(): string });
  const { fileURLToPath } = (await load('node:url')) as { fileURLToPath(url: string): string };
  // This file lives in src/config/: the project root is three levels up.
  projectRoot = pathMod.dirname(pathMod.dirname(pathMod.dirname(fileURLToPath(import.meta.url))));
  script = pathMod.join(projectRoot, 'scripts', 'check-no-network.mjs');
});

const SERVER_DEFAULT_FILE = 'src/config/server-default.json';
/** A fictional default server for the throw-away trees. */
const HOST = 'diary.example.org';
const DEFAULT_JSON = JSON.stringify({ url: `https://${HOST}` });
/** The one way the address reaches the code: the import in src/config/server-default.ts. */
const SERVER_DEFAULT_TS = "import serverDefault from './server-default.json';\nexport const DEFAULT_SERVER_URL: string = new URL(serverDefault.url).origin;\n";
/** The hosts a client bundle may name besides the default server (scripts/check-no-network.mjs DIST_ALLOWED_HOSTS). */
const DIST_ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'www.w3.org', 'react.dev', 'reactrouter.com', 'github.com'];
/** The JavaScript of the built client bundle, when a build exists (keys only - nothing is imported). */
const BUNDLE_FILES = Object.keys(import.meta.glob('/dist/assets/*.js', { eager: false }));

const trees: string[] = [];

/**
 * Every test below spawns the audit (a Node process that walks a tree) - one test up to eight times in a
 * row. Alone that takes a few seconds; inside the full root run, next to 90 other files, it once took over
 * the 20 s default. The spawning tests get a minute.
 */
const SPAWN_TIMEOUT = { timeout: 60_000 };

/** A minimal project tree: the two package.json files the audit reads, plus `files`. */
function tree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(pathMod.join(tmpdir(), 'mpd-server-default-audit-'));
  trees.push(root);
  const all: Record<string, string> = {
    'package.json': '{ "dependencies": {} }',
    'server/package.json': '{ "dependencies": {} }',
    ...files,
  };
  for (const [name, content] of Object.entries(all)) {
    const full = pathMod.join(root, name);
    fs.mkdirSync(pathMod.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

/** The tree every rule test starts from: a valid address file and the module that imports it. */
function wiredTree(files: Record<string, string> = {}): string {
  return tree({ [SERVER_DEFAULT_FILE]: DEFAULT_JSON, 'src/config/server-default.ts': SERVER_DEFAULT_TS, ...files });
}

function audit(root?: string): { status: number | null; output: string } {
  const result = spawnSync(nodeExecPath, root ? [script, `--root=${root}`] : [script], { encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

afterEach(() => {
  for (const root of trees.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('the default server address file (rule b: a bare https origin)', SPAWN_TIMEOUT, () => {
  it('passes a tree whose address is https://<host> reached only through src/config/server-default.ts', () => {
    const result = audit(wiredTree());
    expect(result.output).toContain('Network audit passed');
    expect(result.status).toBe(0);
  });

  it('accepts a port but refuses http, a path, a query, a fragment and credentials', () => {
    expect(audit(tree({ [SERVER_DEFAULT_FILE]: JSON.stringify({ url: `https://${HOST}:8443` }) })).status).toBe(0);
    for (const url of [`http://${HOST}`, `https://${HOST}/api`, `https://${HOST}/?x=1`, `https://${HOST}/#/login`, `https://user:pw@${HOST}`, 'not a url', '']) {
      const result = audit(tree({ [SERVER_DEFAULT_FILE]: JSON.stringify({ url }) }));
      expect(result.status, url).toBe(1);
      expect(result.output, url).toContain(`${SERVER_DEFAULT_FILE}: the default server address must be https://<host> with no path, query, fragment or credentials`);
    }
  });

  it('refuses a file that is not JSON or has no "url"', () => {
    const broken = audit(tree({ [SERVER_DEFAULT_FILE]: '{ "url": ' }));
    expect(broken.status).toBe(1);
    expect(broken.output).toContain(`${SERVER_DEFAULT_FILE}: not valid JSON`);
    const missingUrl = audit(tree({ [SERVER_DEFAULT_FILE]: '{ "host": "x" }' }));
    expect(missingUrl.status).toBe(1);
    expect(missingUrl.output).toContain('the default server address must be https://<host>');
  });

  it('a --root tree without the file is not held to the rule (the project itself is: rule a)', () => {
    const result = audit(tree({ 'src/api/client.ts': "export const base = '';\n" }));
    expect(result.output).toContain('Network audit passed');
    expect(result.status).toBe(0);
  });
});

describe('no second copy of the host (rule c)', SPAWN_TIMEOUT, () => {
  const literal = `export const HOST = '${HOST}';\n`;
  const message = `the default server host comes from ${SERVER_DEFAULT_FILE}, never a literal`;

  it('fails on the host spelt as a literal in src/, mobile/ or shared/ - bare or inside a URL', () => {
    const result = audit(
      wiredTree({
        'src/api/base.ts': literal,
        'mobile/host/server.ts': `export const URL_ = 'wss://${HOST}/ws';\n`,
        'shared/constants.ts': `export const WHERE = \`on ${HOST} today\`;\n`,
      }),
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain(`src/api/base.ts:1: ${message}`);
    expect(result.output).toContain(`mobile/host/server.ts:1: ${message}`);
    expect(result.output).toContain(`shared/constants.ts:1: ${message}`);
  });

  it('a different host, a longer name that contains the host and a comment are not the host', () => {
    const result = audit(
      wiredTree({
        'src/api/other.ts': `export const OTHER = 'my-${HOST}';\nexport const SUB = 'x.${HOST}.example';\n// the apps talk to ${HOST}\n`,
      }),
    );
    expect(result.output).toContain('Network audit passed');
    expect(result.status).toBe(0);
  });

  it('does not scan tests, server/src or the Tauri shell for the literal (their CSP lines are allowed anyway)', () => {
    const result = audit(
      wiredTree({
        'src/api/client.test.ts': literal,
        'src-tauri/src/lib.rs': `const CSP: &str = "Content-Security-Policy: connect-src https://${HOST}";\n`,
      }),
    );
    expect(result.output).toContain('Network audit passed');
    expect(result.status).toBe(0);
  });

  it('the general rule still refuses an https URL of ANY host in src/ (the address is never written as a URL)', () => {
    const result = audit(wiredTree({ 'src/api/base.ts': `export const BASE = 'https://${HOST}';\n` }));
    expect(result.status).toBe(1);
    expect(result.output).toContain('src/api/base.ts:1: external URL');
    expect(result.output).toContain(`src/api/base.ts:1: ${message}`);
  });
});

describe('the built client bundle names no other host (rule d)', SPAWN_TIMEOUT, () => {
  const bundle = (code: string) => ({ 'dist/assets/index-abc123.js': code });

  it("passes a bundle that names the default server, loopback and the libraries' documentation links", () => {
    const result = audit(
      wiredTree(
        bundle(
          `const s="https://${HOST.toUpperCase()}/api/health";const l="http://127.0.0.1/api/health";` +
            'const r="https://react.dev/errors/418";const w="http://www.w3.org/2000/svg";const g="https://github.com/x";',
        ),
      ),
    );
    expect(result.output).toContain('Network audit passed');
    expect(result.status).toBe(0);
  });

  it('fails on any other host - also one that arrived through a dependency, not the sources - and on a host with a port', () => {
    const result = audit(
      wiredTree(bundle(`const s="https://${HOST}/api";const t="https://telemetry.example.net/collect";const u="http://cdn.example.com:8080/x";const d="http://127.0.0.1:1420/";`)),
    );
    expect(result.status).toBe(1);
    expect(result.output).toContain('dist/assets/index-abc123.js: the client bundle names a host that is neither the default server nor on DIST_ALLOWED_HOSTS: telemetry.example.net');
    expect(result.output).toContain('nor on DIST_ALLOWED_HOSTS: cdn.example.com:8080');
    // A dev-server address with its port is not loopback as the allow-list spells it: reported too.
    expect(result.output).toContain('nor on DIST_ALLOWED_HOSTS: 127.0.0.1:1420');
    expect(result.output).not.toContain(`DIST_ALLOWED_HOSTS: ${HOST}`);
  });

  it('only JavaScript under dist/assets is a bundle (css and other build outputs are not audited for hosts)', () => {
    const result = audit(
      wiredTree({ 'dist/assets/index-abc123.css': 'a{background:url(https://fonts.example.net/x.woff2)}', 'dist/index.html': '<a href="https://example.com">x</a>' }),
    );
    expect(result.output).toContain('Network audit passed');
    expect(result.status).toBe(0);
  });
});

describe('the project itself', SPAWN_TIMEOUT, () => {
  it('ships a bare https origin in src/config/server-default.json and passes the audit', () => {
    const parsed = new URL(serverDefault.url);
    expect(parsed.protocol).toBe('https:');
    expect(parsed.pathname).toBe('/');
    expect(parsed.search + parsed.hash + parsed.username + parsed.password).toBe('');
    const result = audit();
    expect(result.output).toContain('Network audit passed');
    expect(result.status).toBe(0);
  });

  it.skipIf(BUNDLE_FILES.length === 0)('the built client bundle (dist/assets) is wired to the default server and to no other host on the internet', () => {
    const defaultHost = new URL(serverDefault.url).host.toLowerCase();
    const hosts = new Set<string>();
    for (const file of BUNDLE_FILES) {
      const code = fs.readFileSync(pathMod.join(projectRoot, ...file.split('/').filter(Boolean)), 'utf8');
      for (const m of code.matchAll(/https?:\/\/([\w.-]+(?::\d+)?)/g)) hosts.add(m[1].toLowerCase());
    }
    expect(hosts.has(defaultHost)).toBe(true);
    const allowed = new Set([...DIST_ALLOWED_HOSTS, defaultHost]);
    expect([...hosts].filter((host) => !allowed.has(host))).toEqual([]);
  });
});
