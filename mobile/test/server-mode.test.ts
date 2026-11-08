/**
 * The start-up of the published, server-only Android app (mobile/host/server-mode.ts, WP-H6) and
 * the build flags it rests on, under the mobile vitest config (`__MOBILE__` true, `__MOBILE_LOCAL_CORE__`
 * undefined - the published build defines it false):
 *  - the API client of a native app selects the fixed diary server and never the in-process core;
 *  - `startServerMode` installs the phone features (inside the installed app only) on a host without a
 *    core, starts the app and removes the splash - also when something fails;
 *  - the server host: `lockAll` is `POST /api/auth/lock` of the signed-in session (a guest's 403 is not
 *    an error, a lost connection is), `flushAll` does nothing, there are no events;
 *  - the transport observer that re-plans the reminders when a request changed the habits.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setApiBaseForTests, apiBaseKind, clearToken, getApiBase, setToken, TOKEN_KEY, type ApiTransport } from '@/api/client';
import { DEFAULT_SERVER_URL, shouldBootLocalCore } from '@/config/server-default';
import { __resetLocaleForTests } from '@/i18n/runtime';
import { SPLASH_ID } from '../host/splash';
import { serverHost, startServerMode } from '../host/server-mode';
import { changesHabits, observeHabitChanges } from '../platform/notifications';
import type { PlatformHost } from '../platform';

// The phone features import every Capacitor plugin: a fake stands in, and proves when it is reached.
const installPhonePlatform = vi.hoisted(() => vi.fn(async (_options: { host: unknown }) => () => undefined));
vi.mock('../platform', () => ({ installPhonePlatform }));

type Globals = { Capacitor?: unknown; __MOBILE_LOCAL_CORE__?: unknown };

/** The <body> of the real mobile/index.html (without its script), so markup and code cannot drift apart. */
function mobileBody(): string {
  const html = readFileSync(path.resolve(process.cwd(), 'mobile/index.html'), 'utf8');
  const body = /<body>([\s\S]*)<\/body>/.exec(html);
  if (!body) throw new Error('mobile/index.html has no <body>');
  return body[1].replace(/<script[\s\S]*?<\/script>/g, '');
}

function splash(): HTMLElement | null {
  return document.getElementById(SPLASH_ID);
}

function nativeApp(): void {
  (globalThis as Globals).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
}

describe('build flags of the published Android app', () => {
  afterEach(() => {
    delete (globalThis as Globals).Capacitor;
    vi.unstubAllGlobals();
    __setApiBaseForTests(null);
  });

  it('__MOBILE__ is true and the local core is off unless the build defines __MOBILE_LOCAL_CORE__ true', () => {
    expect(__MOBILE__).toBe(true);
    expect(typeof __MOBILE_LOCAL_CORE__).toBe('undefined');
    expect(shouldBootLocalCore()).toBe(false);
    vi.stubGlobal('__MOBILE_LOCAL_CORE__', true);
    expect(shouldBootLocalCore()).toBe(true);
    vi.stubGlobal('__MOBILE_LOCAL_CORE__', false);
    expect(shouldBootLocalCore()).toBe(false);
  });

  it('inside the installed app the API base is the fixed diary server; the local-core build answers at the core', async () => {
    nativeApp();
    expect(apiBaseKind()).toBe('server');
    await expect(getApiBase()).resolves.toBe(DEFAULT_SERVER_URL);
    expect(DEFAULT_SERVER_URL).toMatch(/^https:\/\/[\w.-]+$/);

    __setApiBaseForTests(null);
    vi.stubGlobal('__MOBILE_LOCAL_CORE__', true);
    expect(apiBaseKind()).toBe('local-core');
    await expect(getApiBase()).resolves.toBe('');
  });

  it('the mobile build opened in a plain browser (mobile:dev) is same-origin, as before', () => {
    expect(apiBaseKind()).toBe('same-origin');
  });
});

describe('startServerMode', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = mobileBody();
    window.localStorage.clear();
    window.sessionStorage.clear();
    __resetLocaleForTests();
    __setApiBaseForTests('');
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    installPhonePlatform.mockClear();
  });

  afterEach(() => {
    delete (globalThis as Globals).Capacitor;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    __setApiBaseForTests(null);
    __resetLocaleForTests();
    document.body.innerHTML = '';
  });

  it('the page starts with a busy splash above the empty app root', () => {
    expect(splash()?.getAttribute('aria-busy')).toBe('true');
    expect(document.getElementById('root')).not.toBeNull();
  });

  it('installs the phone features, starts the app under the splash and removes the splash after a frame', async () => {
    const order: string[] = [];
    const installPlatform = vi.fn(async (host: PlatformHost) => {
      order.push(`platform:${splash() ? 'splash' : 'no splash'}`);
      expect(typeof host.control).toBe('function');
    });
    const start = vi.fn(async () => {
      order.push(`start:${splash() ? 'splash' : 'no splash'}`);
    });
    await startServerMode(start, { installPlatform });
    expect(order).toEqual(['platform:splash', 'start:splash']);
    expect(splash()).toBeNull();
    // Nothing was fetched: the start-up never waits for the server (the app's connection page does that).
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a failing phone platform does not stop the app; a failing start still removes the splash', async () => {
    const start = vi.fn(async () => undefined);
    await startServerMode(start, {
      installPlatform: async () => {
        throw new Error('no plugin');
      },
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(splash()).toBeNull();

    document.body.innerHTML = mobileBody();
    await startServerMode(
      () => {
        throw new Error('render failed');
      },
      { installPlatform: async () => undefined },
    );
    expect(splash()).toBeNull();
    expect(console.error).toHaveBeenCalledWith('[mobile] the app did not start', expect.any(Error));
  });

  it('by default the phone features are installed inside the installed app only, on the server host', async () => {
    await startServerMode(() => undefined);
    expect(installPhonePlatform).not.toHaveBeenCalled();

    document.body.innerHTML = mobileBody();
    nativeApp();
    await startServerMode(() => undefined);
    expect(installPhonePlatform).toHaveBeenCalledTimes(1);
    const options = installPhonePlatform.mock.calls[0][0] as { host: PlatformHost };
    expect(options.host).toMatchObject({ transport: expect.any(Function), onEvent: expect.any(Function), control: expect.any(Function) });
    expect(splash()).toBeNull();
  });
});

describe('the server host of the phone features', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    __resetLocaleForTests();
    __setApiBaseForTests('');
    fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearToken();
    __setApiBaseForTests(null);
    __resetLocaleForTests();
  });

  it('its transport is fetch (looked up per call, so the network guard applies) and it has no events', async () => {
    const host = serverHost();
    const response = await host.transport('/api/health', { method: 'GET' });
    expect(response.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledWith('/api/health', { method: 'GET' });
    const listener = vi.fn();
    const unsubscribe = host.onEvent(listener);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
  });

  it('flushAll does nothing (the device holds no diary data); lockAll without a session does nothing', async () => {
    const host = serverHost();
    await host.control('flushAll');
    await host.control('lockAll');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lockAll locks the signed-in session on the server: POST /api/auth/lock with the token', async () => {
    setToken('t-123', false);
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe('t-123');
    await serverHost().control('lockAll');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/lock');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t-123');
    expect(init.credentials).toBe('omit');
  });

  it("a guest's tour cannot be locked (403) - not an error; a lost connection is reported to the lifecycle", async () => {
    setToken('t-guest', false);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'FORBIDDEN', message: 'guest' }), { status: 403, headers: { 'content-type': 'application/json' } }));
    await expect(serverHost().control('lockAll')).resolves.toBeUndefined();

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(serverHost().control('lockAll')).rejects.toMatchObject({ name: 'ApiClientError', status: 0 });
  });
});

describe('observeHabitChanges', () => {
  function transport(status = 200): ApiTransport & { calls: Array<[string, RequestInit]> } {
    const calls: Array<[string, RequestInit]> = [];
    const t = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response(status === 204 ? null : '{}', { status });
    }) as ApiTransport & { calls: Array<[string, RequestInit]> };
    t.calls = calls;
    return t;
  }

  it('changesHabits: successful non-read requests on the habits, a restore, the demo seed and saved settings', () => {
    expect(changesHabits('POST', '/api/habits', 201)).toBe(true);
    expect(changesHabits('PUT', '/api/habits/7', 200)).toBe(true);
    expect(changesHabits('DELETE', '/api/habits/7/logs/2026-10-01', 204)).toBe(true);
    expect(changesHabits('put', '/api/habits/logs?x=1', 200)).toBe(true);
    expect(changesHabits('POST', '/api/backup/restore', 200)).toBe(true);
    expect(changesHabits('POST', '/api/settings/seed-demo', 200)).toBe(true);
    expect(changesHabits('PUT', '/api/settings/', 200)).toBe(true);
    expect(changesHabits('GET', '/api/habits', 200)).toBe(false);
    expect(changesHabits('HEAD', '/api/habits', 200)).toBe(false);
    expect(changesHabits('POST', '/api/habits', 400)).toBe(false);
    expect(changesHabits('POST', '/api/habits', 423)).toBe(false);
    expect(changesHabits('POST', '/api/entries', 201)).toBe(false);
    expect(changesHabits('POST', '/api/auth/lock', 204)).toBe(false);
    expect(changesHabits('POST', '/api/settings/export', 200)).toBe(false);
  });

  it('calls onChanged after the answer of a changing request - absolute server URLs included - and passes the answer through', async () => {
    const onChanged = vi.fn();
    const inner = transport(201);
    const wrapped = observeHabitChanges(inner, onChanged);
    const response = await wrapped('https://diary.example/api/habits', { method: 'POST', body: '{}' });
    expect(response.status).toBe(201);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(inner.calls).toHaveLength(1);

    await wrapped('https://diary.example/api/habits?archived=1', { method: 'GET' });
    await wrapped('/api/entries', { method: 'POST' });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('a refused change (423, 400) and a transport failure trigger nothing', async () => {
    const onChanged = vi.fn();
    await observeHabitChanges(transport(423), onChanged)('/api/habits/logs', { method: 'PUT' });
    await observeHabitChanges(transport(400), onChanged)('/api/habits', { method: 'POST' });
    const failing = observeHabitChanges(async () => {
      throw new TypeError('Failed to fetch');
    }, onChanged);
    await expect(failing('/api/habits', { method: 'POST' })).rejects.toBeInstanceOf(TypeError);
    expect(onChanged).not.toHaveBeenCalled();
  });
});
