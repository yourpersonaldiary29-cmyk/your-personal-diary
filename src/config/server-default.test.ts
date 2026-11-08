/**
 * The clients' default server address (docs/android-tasks/HOSTED-IMPL.md items 8 and 10): one JSON file,
 * validated at load, reachable only through this module; the developer switches default to off.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import serverDefault from './server-default.json';
import {
  DEFAULT_SERVER_URL,
  defaultServerHost,
  developerApiBase,
  isLocalServerBuild,
  normalizeServerUrl,
  shouldBootLocalCore,
} from './server-default';

describe('server-default.json -> DEFAULT_SERVER_URL', () => {
  it('is the https origin of the JSON file, with no trailing slash', () => {
    expect(DEFAULT_SERVER_URL).toBe(new URL(serverDefault.url).origin);
    expect(DEFAULT_SERVER_URL.startsWith('https://')).toBe(true);
    expect(DEFAULT_SERVER_URL.endsWith('/')).toBe(false);
    expect(defaultServerHost()).toBe(new URL(serverDefault.url).host);
  });

  it('normalises a bare https origin and refuses everything else', () => {
    expect(normalizeServerUrl('https://diary.example.org')).toBe('https://diary.example.org');
    expect(normalizeServerUrl('https://diary.example.org/')).toBe('https://diary.example.org');
    expect(normalizeServerUrl(' https://diary.example.org:8443 ')).toBe('https://diary.example.org:8443');
    expect(() => normalizeServerUrl('http://diary.example.org')).toThrow(/https/);
    expect(() => normalizeServerUrl('https://diary.example.org/api')).toThrow(/no path/);
    expect(() => normalizeServerUrl('https://diary.example.org/?x=1')).toThrow(/no path/);
    expect(() => normalizeServerUrl('https://diary.example.org/#/login')).toThrow(/no path/);
    expect(() => normalizeServerUrl('https://user:pw@diary.example.org')).toThrow(/credentials/);
    expect(() => normalizeServerUrl('not a url')).toThrow(/valid URL/);
    expect(() => normalizeServerUrl('')).toThrow(/non-empty/);
    expect(() => normalizeServerUrl(undefined)).toThrow(/non-empty/);
  });
});

describe('developer / test switches', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('are off by default: no API base override, not the local-server build, no local core', () => {
    expect(developerApiBase()).toBeNull();
    expect(isLocalServerBuild()).toBe(false);
    expect(shouldBootLocalCore()).toBe(false);
  });

  it('VITE_API_BASE overrides the base (trailing slashes dropped); VITE_LOCAL_SERVER=1 marks the local-mode desktop build', () => {
    vi.stubEnv('VITE_API_BASE', 'http://127.0.0.1:5055/');
    expect(developerApiBase()).toBe('http://127.0.0.1:5055');
    vi.stubEnv('VITE_API_BASE', '   ');
    expect(developerApiBase()).toBeNull();
    vi.stubEnv('VITE_LOCAL_SERVER', '1');
    expect(isLocalServerBuild()).toBe(true);
    vi.stubEnv('VITE_LOCAL_SERVER', 'yes');
    expect(isLocalServerBuild()).toBe(false);
  });

  it('shouldBootLocalCore needs BOTH the mobile build and the local-core flag', () => {
    vi.stubGlobal('__MOBILE__', true);
    try {
      expect(shouldBootLocalCore()).toBe(false);
      vi.stubGlobal('__MOBILE_LOCAL_CORE__', true);
      expect(shouldBootLocalCore()).toBe(true);
      vi.stubGlobal('__MOBILE__', false);
      expect(shouldBootLocalCore()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
