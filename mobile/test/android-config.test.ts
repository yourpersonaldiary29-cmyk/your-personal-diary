// @vitest-environment node
/**
 * The server-only Android build (WP-H6, docs/android-tasks/HOSTED-IMPL.md item 8) as configuration:
 * the one server address of src/config/server-default.json reaches the native network security
 * config and the build (CSP) without a second copy that could drift; the manifest keeps its hardened
 * shape; the Capacitor project never points the WebView at a server URL (the UI is bundled, the API
 * is called from it); the vite config's build-mode switch reads the environment as documented.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULT_SERVER_URL, defaultServerHost } from '@/config/server-default';
import capacitorConfig from '../../capacitor.config';
import { readCsp, serverBuildCsp } from '../dev-server-csp';
import { defaultServerOrigin, LOCAL_CORE_ENV, mobileBuildMode, SERVER_DEFAULT_FILE } from '../vite.config.mobile';

const projectRoot = process.cwd();
const read = (relative: string): string => readFileSync(path.join(projectRoot, relative), 'utf8');

const temps: string[] = [];
afterAll(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('network_security_config.xml (android/app/src/main/res/xml)', () => {
  const xml = read('android/app/src/main/res/xml/network_security_config.xml');

  it('forbids cleartext for every host, with the system trust anchors only', () => {
    expect(xml).toMatch(/<base-config cleartextTrafficPermitted="false">/);
    expect(xml).not.toMatch(/cleartextTrafficPermitted="true"/);
    expect(xml).not.toMatch(/<certificates src="user"/);
    expect(xml).not.toMatch(/<pin-set/);
  });

  it('names the diary server host of server-default.json - and no other host - TLS only', () => {
    const domains = [...xml.matchAll(/<domain[^>]*>([^<]+)<\/domain>/g)].map((m) => m[1].trim());
    expect(domains).toEqual([defaultServerHost()]);
    expect(xml).toMatch(/<domain-config cleartextTrafficPermitted="false">/);
    expect(xml).toMatch(/<domain includeSubdomains="false">/);
    // The default server is a bare host (no port): the XML <domain> element cannot carry one.
    expect(new URL(DEFAULT_SERVER_URL).port).toBe('');
  });
});

describe('AndroidManifest.xml', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');

  it('keeps the hardened application attributes (no cleartext, the network security config, no backup)', () => {
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
    expect(manifest).toContain('android:networkSecurityConfig="@xml/network_security_config"');
    expect(manifest).toContain('android:allowBackup="false"');
  });

  it('asks for exactly the permissions of WP-14 + WP-7/8/9 (INTERNET is the server connection now)', () => {
    const asked = [...manifest.matchAll(/<uses-permission android:name="([^"]+)" \/>/g)].map((m) => m[1]).sort();
    expect(asked).toEqual(['android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS', 'android.permission.RECEIVE_BOOT_COMPLETED', 'android.permission.USE_BIOMETRIC']);
  });
});

describe('capacitor.config.ts', () => {
  it('still bundles the UI (webDir) and never points the WebView at a server (server.url unset, no cleartext)', () => {
    expect(capacitorConfig.webDir).toBe('mobile-dist');
    expect(capacitorConfig.server?.url).toBeUndefined();
    expect(capacitorConfig.server?.cleartext).toBeUndefined();
    expect(capacitorConfig.server?.androidScheme).toBe('https');
    expect(capacitorConfig.android?.allowMixedContent).toBe(false);
  });
});

describe('mobile/vite.config.mobile.ts: the build modes and the server origin', () => {
  it('the server build is the default; MOBILE_LOCAL_CORE=1 selects the local-core build', () => {
    expect(LOCAL_CORE_ENV).toBe('MOBILE_LOCAL_CORE');
    expect(mobileBuildMode({})).toBe('server');
    expect(mobileBuildMode({ MOBILE_LOCAL_CORE: '1' })).toBe('local-core');
    expect(mobileBuildMode({ MOBILE_LOCAL_CORE: 'true' })).toBe('server');
    expect(mobileBuildMode({ MOBILE_LOCAL_CORE: '0' })).toBe('server');
  });

  it('reads the origin from src/config/server-default.json - the same value src/config/server-default.ts exports', () => {
    expect(SERVER_DEFAULT_FILE).toBe(path.join(projectRoot, 'src', 'config', 'server-default.json'));
    expect(existsSync(SERVER_DEFAULT_FILE)).toBe(true);
    expect(defaultServerOrigin()).toBe(DEFAULT_SERVER_URL);
    expect(new URL(defaultServerOrigin()).host).toBe(defaultServerHost());
  });

  it('refuses a server-default.json that is not a bare https origin (the build fails instead of widening the CSP)', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'mpd-server-default-'));
    temps.push(dir);
    const file = path.join(dir, 'server-default.json');
    const bad = [
      ['{"url": "http://diary.example"}', /https:\/\/<host>/],
      ['{"url": "https://diary.example/app"}', /https:\/\/<host>/],
      ['{"url": "https://diary.example/?a=1"}', /https:\/\/<host>/],
      ['{"url": ""}', /non-empty string/],
      ['{}', /non-empty string/],
      ['{"url": "not a url"}', /not a valid URL/],
      ['nonsense', /cannot read/],
    ] as const;
    for (const [content, reason] of bad) {
      writeFileSync(file, content);
      expect(() => defaultServerOrigin(file), content).toThrow(reason);
    }
    expect(() => defaultServerOrigin(path.join(dir, 'missing.json'))).toThrow(/cannot read/);
    writeFileSync(file, '{"url": "https://diary.example:8443/"}');
    expect(defaultServerOrigin(file)).toBe('https://diary.example:8443');
  });

  it('the built page allows exactly the default server in connect-src and no wasm / blob: worker (what mobile:build writes)', () => {
    const page = serverBuildCsp(read('mobile/index.html'), defaultServerOrigin());
    const directives = (readCsp(page) as string).split(';').map((d) => d.trim());
    expect(directives.find((d) => d.startsWith('connect-src '))).toBe(`connect-src 'self' ${DEFAULT_SERVER_URL}`);
    expect(directives.find((d) => d.startsWith('script-src '))).toBe("script-src 'self'");
    expect(directives.find((d) => d.startsWith('worker-src '))).toBe("worker-src 'self'");
    const hosts = new Set([...page.matchAll(/https?:\/\/([\w.-]+(?::\d+)?)/g)].map((m) => m[1]));
    expect([...hosts]).toEqual([defaultServerHost()]);
  });
});
