import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addCspSources,
  allowConnectOrigin,
  loopbackOrigin,
  readCsp,
  relaxCsp,
  relaxCspForDevServer,
  removeCspSources,
  rewriteCsp,
  SERVER_BUILD_REMOVALS,
  serverBuildCsp,
} from '../dev-server-csp';

/** The policy the page declares (docs/android-tasks/WP-1-6.md, step 2); the build adds the server origin to connect-src. */
const STRICT_CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:";

/** A server origin for these tests (the real one comes from src/config/server-default.json at build time). */
const ORIGIN = 'https://diary.example';

const html = readFileSync(path.resolve(process.cwd(), 'mobile/index.html'), 'utf8');

function directive(policy: string, name: string): string | undefined {
  return policy
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `));
}

describe('Content-Security-Policy of the mobile page', () => {
  it('the page source declares the strict policy with connect-src self only (the host is never spelled in it)', () => {
    expect(readCsp(html)).toBe(STRICT_CSP);
    expect(html).not.toMatch(/https:\/\/[\w.-]+\.[a-z]{2,}/i);
  });

  it('the page mentions a directive in text BEFORE the meta tag (what a plain string replace would hit)', () => {
    // Guards the regression itself: the rewrites must not depend on where a directive is first mentioned.
    expect(html.indexOf("connect-src 'self'")).toBeLessThan(html.indexOf('http-equiv="Content-Security-Policy"'));
  });

  it('the dev server relaxes script-src and connect-src inside the meta tag', () => {
    const served = relaxCspForDevServer(html);
    const policy = readCsp(served) as string;
    expect(directive(policy, 'script-src')).toBe("script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'");
    expect(directive(policy, 'connect-src')).toBe("connect-src 'self' ws://127.0.0.1:* ws://localhost:*");
    // Nothing else is relaxed.
    expect(policy).toBe(
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; worker-src 'self' blob:",
    );
  });

  it('changes nothing but the policy: the comment and the rest of the page are untouched', () => {
    const served = relaxCspForDevServer(html);
    const strict = readCsp(html) as string;
    const relaxed = readCsp(served) as string;
    expect(served).toBe(html.replace(strict, relaxed));
    expect(served).toContain("no connection but one (connect-src 'self' here;");
    expect(served.split('ws://127.0.0.1:*')).toHaveLength(2);
  });

  it('the dev server never allows a remote host, only the local dev server and a loopback API base', () => {
    const policy = readCsp(relaxCspForDevServer(html)) as string;
    expect(policy).not.toMatch(/https?:/);
    expect(policy.split(/[\s;]+/)).not.toContain('*');
    expect(policy.match(/wss?:\/\/[^\s;]+/g)).toEqual(['ws://127.0.0.1:*', 'ws://localhost:*']);

    // A developer's local test server (VITE_API_BASE) is let through connect-src...
    const withBase = readCsp(relaxCspForDevServer(html, 'http://127.0.0.1:48611/')) as string;
    expect(directive(withBase, 'connect-src')).toBe("connect-src 'self' ws://127.0.0.1:* ws://localhost:* http://127.0.0.1:48611");
    // ...a remote one is not (the dev page must never reach the real server).
    for (const remote of [ORIGIN, 'http://192.168.1.20:8080', 'ftp://127.0.0.1:21', 'not a url', '']) {
      expect(readCsp(relaxCspForDevServer(html, remote)), remote).toBe(policy);
    }
  });

  it('loopbackOrigin accepts loopback http(s) origins only and normalises them to the origin', () => {
    expect(loopbackOrigin('http://127.0.0.1:1234/api/')).toBe('http://127.0.0.1:1234');
    expect(loopbackOrigin('https://localhost:8443')).toBe('https://localhost:8443');
    expect(loopbackOrigin(undefined)).toBeNull();
    expect(loopbackOrigin('  ')).toBeNull();
    expect(loopbackOrigin('http://10.0.0.5:80')).toBeNull();
    expect(loopbackOrigin(ORIGIN)).toBeNull();
  });

  it('the build adds the fixed server origin to connect-src and to nothing else', () => {
    const built = allowConnectOrigin(html, ORIGIN);
    const policy = readCsp(built) as string;
    expect(directive(policy, 'connect-src')).toBe(`connect-src 'self' ${ORIGIN}`);
    expect(policy).toBe(STRICT_CSP.replace("connect-src 'self'", `connect-src 'self' ${ORIGIN}`));
    expect(built).toBe(html.replace(STRICT_CSP, policy));
    // Exactly one host in the whole page, and it is the server.
    expect(built.match(/https:\/\/[\w.-]+/g)).toEqual([ORIGIN]);
    // Idempotent: a second pass adds nothing.
    expect(readCsp(allowConnectOrigin(built, ORIGIN))).toBe(policy);
  });

  it('the build refuses anything that is not a bare https origin', () => {
    for (const bad of ['http://diary.example', 'https://diary.example/api', 'https://user:pw@diary.example', 'https://diary.example/?x=1', 'diary.example', '']) {
      expect(() => allowConnectOrigin(html, bad), bad).toThrow(/server origin/);
    }
  });

  it('the published build: the server origin in connect-src, no wasm-unsafe-eval, no blob: workers - nothing else changes', () => {
    const built = serverBuildCsp(html, ORIGIN);
    const policy = readCsp(built) as string;
    expect(policy).toBe(
      `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ${ORIGIN}; worker-src 'self'`,
    );
    expect(built).toBe(html.replace(STRICT_CSP, policy));
    expect(built.match(/https:\/\/[\w.-]+/g)).toEqual([ORIGIN]);
    // Exactly what the in-process core needed is gone; img-src keeps blob: (downloads, previews).
    expect(SERVER_BUILD_REMOVALS).toEqual({ 'script-src': ["'wasm-unsafe-eval'"], 'worker-src': ['blob:'] });
    expect(directive(policy, 'img-src')).toBe("img-src 'self' data: blob:");
    // Idempotent, and it validates the origin like allowConnectOrigin.
    expect(readCsp(serverBuildCsp(built, ORIGIN))).toBe(policy);
    expect(() => serverBuildCsp(html, 'http://diary.example')).toThrow(/server origin/);
  });

  it('removeCspSources takes sources out of their directives, never a whole directive, and refuses a missing one', () => {
    expect(removeCspSources("script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:", { 'script-src': ["'wasm-unsafe-eval'"], 'worker-src': ['blob:'] })).toBe(
      "script-src 'self'; worker-src 'self'",
    );
    expect(removeCspSources("script-src 'self'", { 'script-src': ["'wasm-unsafe-eval'"] })).toBe("script-src 'self'");
    expect(removeCspSources("default-src 'self'", {})).toBe("default-src 'self'");
    expect(() => removeCspSources("worker-src blob:", { 'worker-src': ['blob:'] })).toThrow('would leave worker-src empty');
    expect(() => removeCspSources("default-src 'self'", { 'worker-src': ['blob:'] })).toThrow('no worker-src directive');
  });

  it('addCspSources appends to the named directives, skips sources already there and refuses a missing directive', () => {
    expect(addCspSources("default-src 'self'; connect-src 'self'", { 'connect-src': ["'self'", 'blob:'] })).toBe("default-src 'self'; connect-src 'self' blob:");
    expect(addCspSources("default-src 'self'", {})).toBe("default-src 'self'");
    expect(addCspSources("default-src 'self'", { 'img-src': [] })).toBe("default-src 'self'");
    expect(() => addCspSources("default-src 'self'", { 'connect-src': [ORIGIN] })).toThrow('no connect-src directive');
  });

  it('copes with another attribute order and spacing of the meta tag', () => {
    const other = `<meta   http-equiv="Content-Security-Policy"\n  data-x="1"\n  content="connect-src 'self' ; script-src 'self'" />`;
    expect(readCsp(relaxCspForDevServer(other))).toBe(
      "connect-src 'self' ws://127.0.0.1:* ws://localhost:*; script-src 'self' 'unsafe-inline'",
    );
    expect(readCsp(allowConnectOrigin(other, ORIGIN))).toBe(`connect-src 'self' ${ORIGIN}; script-src 'self'`);
  });

  it('fails loudly instead of serving an unchanged page', () => {
    expect(() => relaxCspForDevServer('<html><head></head></html>')).toThrow('<meta> tag was not found');
    expect(() => rewriteCsp('<html></html>', (p) => p)).toThrow('<meta> tag was not found');
    expect(() => allowConnectOrigin('<html></html>', ORIGIN)).toThrow('<meta> tag was not found');
    expect(() => relaxCsp("default-src 'self'; script-src 'self'")).toThrow('no connect-src directive');
    expect(() => relaxCsp("default-src 'self'; connect-src 'self'")).toThrow('no script-src directive');
  });
});
