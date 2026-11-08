import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { ServerInfo } from '@shared/types';
import { __resetLocaleForTests, setCurrentLocale } from '@/i18n/runtime';
import { DEFAULT_SERVER_URL } from '@/config/server-default';
import {
  __setApiBaseForTests,
  ApiClientError,
  LOCKED_EVENT,
  UNAUTHORIZED_EVENT,
  apiBaseKind,
  getApiBase,
  getToken,
  installNetworkGuard,
  isApiClientError,
  isConnectionError,
  isNativeApp,
  isServerMode,
  isTauri,
  request,
  requestBlob,
  requestUpload,
  setApiTransport,
  setOfflinePrivacyMode,
  setToken,
  type ApiTransport,
} from './client';
import { __resetConnectionForTests, getConnectionState, setServerInfo } from './connection';

// The Tauri shell's command bridge: only the local-mode desktop build (`VITE_LOCAL_SERVER=1`) may call it.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

type FetchMock = ReturnType<typeof vi.fn>;

/** What the hosted Your Personal Diary server answers to GET /api/server/info (fictional address). */
const hostedInfo: ServerInfo = {
  version: '0.1.0',
  port: 8080,
  lanEnabled: false,
  lanUrls: [],
  dataDir: '',
  isLocalRequest: false,
  startedAt: '2026-10-20T08:00:00.000Z',
  mode: 'hosted',
  publicUrl: 'https://diary.example.org',
  storageOk: true,
  registration: 'open',
  guestTour: true,
};

function okJson(body: unknown = { ok: true }) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
    json: async () => body,
    blob: async () => new Blob([]),
  };
}

function headersOf(fetchMock: FetchMock, call = 0): Record<string, string> {
  const init = fetchMock.mock.calls[call][1] as { headers: Record<string, string> };
  return init.headers;
}

describe('api client - Accept-Language and localised failure text', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    __resetLocaleForTests();
    __setApiBaseForTests('');
    fetchMock = vi.fn().mockResolvedValue(okJson());
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    __setApiBaseForTests(null);
    __resetLocaleForTests();
  });

  it('sends the current UI locale as Accept-Language on every request kind', async () => {
    setToken('tok', false);
    await request('/api/settings');
    expect(headersOf(fetchMock)).toMatchObject({ 'Accept-Language': 'en', Accept: 'application/json', Authorization: 'Bearer tok' });

    setCurrentLocale('he');
    await request('/api/settings', { method: 'PUT', body: { language: 'he' } });
    expect(headersOf(fetchMock, 1)).toMatchObject({ 'Accept-Language': 'he', 'Content-Type': 'application/json' });

    await requestBlob('/api/export', { body: { format: 'txt' } });
    expect(headersOf(fetchMock, 2)).toMatchObject({ 'Accept-Language': 'he', Authorization: 'Bearer tok' });
    expect(headersOf(fetchMock, 2).Accept).toBeUndefined();

    setCurrentLocale('de');
    await requestUpload('/api/backup/restore', new FormData());
    expect(headersOf(fetchMock, 3)).toMatchObject({ 'Accept-Language': 'de', Accept: 'application/json' });
  });

  it('omits the Authorization header for anonymous requests but still sends the language', async () => {
    setToken('tok', true);
    await request('/api/auth/login', { method: 'POST', body: {}, anonymous: true });
    const headers = headersOf(fetchMock);
    expect(headers['Accept-Language']).toBe('en');
    expect(headers.Authorization).toBeUndefined();
  });

  it('reports a network failure in the current language', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(request('/api/health')).rejects.toMatchObject({ status: 0, code: 'OTHER', message: 'No connection to the local diary server.' });
    setCurrentLocale('he');
    await expect(request('/api/health')).rejects.toMatchObject({ message: 'אין חיבור לשרת המקומי של היומן.' });
  });

  it('uses a localised generic message when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({ ...okJson(), ok: false, status: 502, json: async () => {
      throw new Error('not json');
    } });
    try {
      await request('/api/health');
      throw new Error('expected a rejection');
    } catch (e) {
      expect(isApiClientError(e)).toBe(true);
      expect((e as Error).message).toBe('Error (502)');
    }
    setCurrentLocale('he');
    await expect(request('/api/health')).rejects.toMatchObject({ message: 'שגיאה (502)' });
  });
});

describe('api client - transport seam (setApiTransport)', () => {
  let fetchMock: FetchMock;
  let transport: ReturnType<typeof vi.fn<ApiTransport>>;

  function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
  }

  function initOf(call = 0): RequestInit & { headers: Record<string, string> } {
    return transport.mock.calls[call][1] as RequestInit & { headers: Record<string, string> };
  }

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    __resetLocaleForTests();
    __setApiBaseForTests('');
    fetchMock = vi.fn().mockResolvedValue(okJson({ via: 'fetch' }));
    vi.stubGlobal('fetch', fetchMock);
    transport = vi.fn<ApiTransport>(async () => json(200, { via: 'transport' }));
    setApiTransport(transport);
  });

  afterEach(() => {
    setApiTransport(null);
    vi.unstubAllGlobals();
    __setApiBaseForTests(null);
    __resetLocaleForTests();
  });

  it('sends a GET through the transport (not fetch) and returns the parsed JSON body', async () => {
    setToken('tok', false);
    const body = await request<{ via: string }>('/api/entries', { query: { page: 2, q: 'sea side', empty: '' } });
    expect(body).toEqual({ via: 'transport' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toBe('/api/entries?page=2&q=sea+side');
    const init = initOf();
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.credentials).toBe('omit');
    expect(init.headers).toMatchObject({ Accept: 'application/json', Authorization: 'Bearer tok' });
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('prefixes the API base and serialises a POST body as JSON', async () => {
    __setApiBaseForTests('http://127.0.0.1:5000');
    await request('/api/entries', { method: 'POST', body: { title: 'יום טוב', mood: 4 } });
    expect(transport.mock.calls[0][0]).toBe('http://127.0.0.1:5000/api/entries');
    const init = initOf();
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ title: 'יום טוב', mood: 4 }));
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('passes the abort signal on and resolves 204 to undefined', async () => {
    transport.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const controller = new AbortController();
    await expect(request('/api/entries/7', { method: 'DELETE', signal: controller.signal })).resolves.toBeUndefined();
    expect(initOf().signal).toBe(controller.signal);
  });

  it('carries the current UI locale as Accept-Language on every request kind', async () => {
    setToken('tok', false);
    await request('/api/settings');
    expect(initOf(0).headers['Accept-Language']).toBe('en');

    setCurrentLocale('he');
    await request('/api/auth/login', { method: 'POST', body: {}, anonymous: true });
    expect(initOf(1).headers['Accept-Language']).toBe('he');
    expect(initOf(1).headers.Authorization).toBeUndefined();

    setCurrentLocale('ar');
    await requestBlob('/api/export', { body: { format: 'csv' } });
    expect(initOf(2).headers).toMatchObject({ 'Accept-Language': 'ar', Authorization: 'Bearer tok' });
    expect(initOf(2).headers.Accept).toBeUndefined();

    setCurrentLocale('ja');
    const form = new FormData();
    await requestUpload('/api/backup/restore', form);
    expect(transport.mock.calls[3][0]).toBe('/api/backup/restore');
    expect(initOf(3).method).toBe('POST');
    expect(initOf(3).body).toBe(form);
    expect(initOf(3).headers).toMatchObject({ 'Accept-Language': 'ja', Accept: 'application/json' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('on 401 clears the token, fires the unauthorized event and rejects with the server error', async () => {
    setToken('tok', true);
    const onUnauthorized = vi.fn();
    const onLocked = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    window.addEventListener(LOCKED_EVENT, onLocked);
    try {
      transport.mockResolvedValueOnce(json(401, { code: 'UNAUTHORIZED', message: 'Please sign in again.' }));
      await expect(request('/api/entries')).rejects.toMatchObject({
        name: 'ApiClientError',
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Please sign in again.',
      });
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
      expect(onLocked).not.toHaveBeenCalled();
      expect(getToken()).toBeNull();

      // Downloads and uploads behave the same.
      setToken('tok2', false);
      transport.mockResolvedValueOnce(json(401, { code: 'UNAUTHORIZED', message: 'x' }));
      await expect(requestBlob('/api/backup')).rejects.toMatchObject({ status: 401 });
      expect(onUnauthorized).toHaveBeenCalledTimes(2);
      expect(getToken()).toBeNull();

      setToken('tok3', false);
      transport.mockResolvedValueOnce(json(401, { code: 'UNAUTHORIZED', message: 'x' }));
      await expect(requestUpload('/api/backup/restore', new FormData())).rejects.toMatchObject({ status: 401 });
      expect(onUnauthorized).toHaveBeenCalledTimes(3);
      expect(getToken()).toBeNull();
    } finally {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
      window.removeEventListener(LOCKED_EVENT, onLocked);
    }
  });

  it('keeps the token and stays quiet when an anonymous request (login) answers 401', async () => {
    setToken('tok', true);
    const onUnauthorized = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    try {
      transport.mockResolvedValueOnce(json(401, { code: 'INVALID_CREDENTIALS', message: 'Wrong password.', field: 'password' }));
      await expect(request('/api/auth/login', { method: 'POST', body: {}, anonymous: true })).rejects.toMatchObject({
        status: 401,
        code: 'INVALID_CREDENTIALS',
        field: 'password',
      });
      expect(onUnauthorized).not.toHaveBeenCalled();
      expect(getToken()).toBe('tok');
    } finally {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    }
  });

  it('on 423 fires the locked event, keeps the token and rejects', async () => {
    setToken('tok', false);
    const onUnauthorized = vi.fn();
    const onLocked = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    window.addEventListener(LOCKED_EVENT, onLocked);
    try {
      transport.mockResolvedValueOnce(json(423, { code: 'LOCKED', message: 'The diary is locked.' }));
      await expect(request('/api/entries')).rejects.toMatchObject({ status: 423, code: 'LOCKED', message: 'The diary is locked.' });
      transport.mockResolvedValueOnce(json(423, { code: 'LOCKED', message: 'The diary is locked.' }));
      await expect(requestBlob('/api/export', { body: { format: 'pdf' } })).rejects.toMatchObject({ status: 423 });
      expect(onLocked).toHaveBeenCalledTimes(2);
      expect(onUnauthorized).not.toHaveBeenCalled();
      expect(getToken()).toBe('tok');
    } finally {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
      window.removeEventListener(LOCKED_EVENT, onLocked);
    }
  });

  it('downloads a blob and reads the file name from Content-Disposition', async () => {
    const bytes = new Uint8Array([0x4d, 0x50, 0x44, 0x00, 0xff]);
    transport.mockResolvedValueOnce(
      new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          // The server's format: an ASCII fallback plus the RFC 5987 name.
          'Content-Disposition': `attachment; filename="diary-dana-2026.mpd"; filename*=UTF-8''diary-dana-2026.mpd`,
          'X-Entries-Exported': '12',
        },
      }),
    );
    const first = await requestBlob('/api/backup', { body: { password: 'fictional' } });
    expect(first.fileName).toBe('diary-dana-2026.mpd');
    expect(first.headers.get('X-Entries-Exported')).toBe('12');
    expect(first.blob.size).toBe(5);
    expect(Array.from(new Uint8Array(await first.blob.arrayBuffer()))).toEqual(Array.from(bytes));
    expect(initOf().method).toBe('POST');
    expect(initOf().body).toBe(JSON.stringify({ password: 'fictional' }));

    transport.mockResolvedValueOnce(
      new Response('a,b\n1,2\n', { status: 200, headers: { 'Content-Disposition': 'attachment; filename="export.csv"' } }),
    );
    const second = await requestBlob('/api/export', { body: { format: 'csv' } });
    expect(second.fileName).toBe('export.csv');
    expect(await second.blob.text()).toBe('a,b\n1,2\n');

    transport.mockResolvedValueOnce(
      new Response('x', { status: 200, headers: { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('יומן 2026.txt')}` } }),
    );
    expect((await requestBlob('/api/export')).fileName).toBe('יומן 2026.txt');

    transport.mockResolvedValueOnce(new Response('x', { status: 200 }));
    expect((await requestBlob('/api/export')).fileName).toBe('download');
  });

  it('reports a transport failure as status 0 in the UI language and rethrows an abort', async () => {
    transport.mockRejectedValueOnce(new Error('worker crashed'));
    await expect(request('/api/health')).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 0,
      code: 'OTHER',
      message: 'No connection to the local diary server.',
    });
    const abort = new DOMException('The operation was aborted.', 'AbortError');
    transport.mockRejectedValueOnce(abort);
    await expect(request('/api/health')).rejects.toBe(abort);
  });

  it('goes back to fetch when the transport is reset with null', async () => {
    await request('/api/settings');
    expect(transport).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    setApiTransport(null);
    await expect(request<{ via: string }>('/api/settings')).resolves.toEqual({ via: 'fetch' });
    await requestBlob('/api/export', { body: { format: 'txt' } });
    await requestUpload('/api/backup/restore', new FormData());
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/settings');
    expect(transport).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// API base: the fixed server in the apps, the page origin on the web (HOSTED-IMPL items 8 and 10)
// ---------------------------------------------------------------------------

describe('api client - API base (apiBaseKind / getApiBase / isServerMode)', () => {
  beforeEach(() => {
    __setApiBaseForTests(null);
    __resetConnectionForTests();
    vi.mocked(invoke).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    __setApiBaseForTests(null);
    __resetConnectionForTests();
  });

  it('the web UI served by the server talks to its own origin: API base "" (same-origin)', async () => {
    expect(isTauri()).toBe(false);
    expect(isNativeApp()).toBe(false);
    expect(apiBaseKind()).toBe('same-origin');
    await expect(getApiBase()).resolves.toBe('');
    expect(isServerMode()).toBe(false);
  });

  it('the Windows app (Tauri) uses the fixed Your Personal Diary server and never asks the shell for a port', async () => {
    vi.stubGlobal('__TAURI_INTERNALS__', {});
    expect(isTauri()).toBe(true);
    expect(apiBaseKind()).toBe('server');
    await expect(getApiBase()).resolves.toBe(DEFAULT_SERVER_URL);
    expect(DEFAULT_SERVER_URL.startsWith('https://')).toBe(true);
    expect(invoke).not.toHaveBeenCalled();
    expect(isServerMode()).toBe(true);
  });

  it('the Android app (Capacitor, native platform) uses the fixed server; the mobile build in a plain browser is same-origin', async () => {
    vi.stubGlobal('__MOBILE__', true);
    // `npm run mobile:dev` opened in a desktop browser: the Capacitor bridge says "not native".
    vi.stubGlobal('Capacitor', { isNativePlatform: () => false });
    expect(isNativeApp()).toBe(false);
    expect(apiBaseKind()).toBe('same-origin');

    vi.stubGlobal('Capacitor', { isNativePlatform: () => true });
    expect(isNativeApp()).toBe(true);
    expect(apiBaseKind()).toBe('server');
    await expect(getApiBase()).resolves.toBe(DEFAULT_SERVER_URL);
    expect(isServerMode()).toBe(true);
  });

  it('the Android local-core build (__MOBILE_LOCAL_CORE__) talks to its in-process core at ""', async () => {
    vi.stubGlobal('__MOBILE__', true);
    vi.stubGlobal('__MOBILE_LOCAL_CORE__', true);
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true });
    expect(apiBaseKind()).toBe('local-core');
    await expect(getApiBase()).resolves.toBe('');
    expect(isServerMode()).toBe(false);
  });

  it('the developer override VITE_API_BASE wins everywhere (trailing slash dropped) and is not server mode', async () => {
    vi.stubEnv('VITE_API_BASE', 'http://127.0.0.1:5055/');
    vi.stubGlobal('__TAURI_INTERNALS__', {});
    expect(apiBaseKind()).toBe('override');
    await expect(getApiBase()).resolves.toBe('http://127.0.0.1:5055');
    expect(invoke).not.toHaveBeenCalled();
    expect(isServerMode()).toBe(false);
  });

  it('the local-mode desktop build (VITE_LOCAL_SERVER=1) discovers the sidecar port through get_server_info and caches it', async () => {
    vi.stubEnv('VITE_LOCAL_SERVER', '1');
    vi.stubGlobal('__TAURI_INTERNALS__', {});
    vi.mocked(invoke).mockResolvedValueOnce({ port: 0, ready: false }).mockResolvedValueOnce({ port: 47000, ready: true });
    expect(apiBaseKind()).toBe('local-server');
    await expect(getApiBase()).resolves.toBe('http://127.0.0.1:47000');
    expect(invoke).toHaveBeenCalledWith('get_server_info');
    expect(invoke).toHaveBeenCalledTimes(2);
    await expect(getApiBase()).resolves.toBe('http://127.0.0.1:47000');
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(isServerMode()).toBe(false);
  });

  it('VITE_LOCAL_SERVER=1 means nothing outside the Tauri shell (a browser stays same-origin)', async () => {
    vi.stubEnv('VITE_LOCAL_SERVER', '1');
    expect(apiBaseKind()).toBe('same-origin');
    await expect(getApiBase()).resolves.toBe('');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('isServerMode follows the server description on the web: true once GET /api/server/info said mode "hosted"', () => {
    expect(isServerMode()).toBe(false);
    setServerInfo({ ...hostedInfo });
    expect(isServerMode()).toBe(true);
    setServerInfo({ ...hostedInfo, mode: undefined, publicUrl: undefined, isLocalRequest: true });
    expect(isServerMode()).toBe(false);
    setServerInfo(null);
    expect(isServerMode()).toBe(false);
  });

  it('__setApiBaseForTests fixes the base; null forgets it', async () => {
    __setApiBaseForTests('https://dev.example.org');
    await expect(getApiBase()).resolves.toBe('https://dev.example.org');
    __setApiBaseForTests(null);
    await expect(getApiBase()).resolves.toBe('');
  });
});

// ---------------------------------------------------------------------------
// Connection errors and the connection store (the "No connection to the diary server" screen)
// ---------------------------------------------------------------------------

describe('api client - connection errors feed the connection store', () => {
  let fetchMock: FetchMock;

  const serverError = (status: number, message: string) =>
    new Response(JSON.stringify({ code: 'OTHER', message }), { status, headers: { 'Content-Type': 'application/json' } });

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    __resetLocaleForTests();
    __resetConnectionForTests();
    __setApiBaseForTests('');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    __setApiBaseForTests(null);
    __resetConnectionForTests();
    __resetLocaleForTests();
  });

  it('a network failure is status 0, "not from the server", a connection error, and marks the server offline', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const error: unknown = await request('/api/health').catch((e: unknown) => e);
    expect(isApiClientError(error)).toBe(true);
    expect(error).toMatchObject({ status: 0, code: 'OTHER', fromServer: false });
    expect(isConnectionError(error)).toBe(true);
    expect(getConnectionState()).toMatchObject({ offline: true, reached: false });
  });

  it('names "the diary server" (never the local one) once the server described itself as hosted', async () => {
    setServerInfo({ ...hostedInfo });
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(request('/api/health')).rejects.toMatchObject({ status: 0, message: 'No connection to the diary server.' });
    // The server is named plainly: no address, nothing to copy.
    const error: unknown = await request('/api/health').catch((e: unknown) => e);
    expect((error as Error).message).not.toMatch(/https?:\/\//);
    setCurrentLocale('he');
    await expect(request('/api/health')).rejects.toMatchObject({ message: 'אין חיבור לשרת היומן.' });
  });

  it("a proxy's 502 / 503 / 504 without the server's JSON body is a connection error; the server's own 503 is not", async () => {
    for (const status of [502, 503, 504]) {
      fetchMock.mockResolvedValueOnce(new Response('<html>gateway</html>', { status, headers: { 'Content-Type': 'text/html' } }));
      const error: unknown = await request('/api/health').catch((e: unknown) => e);
      expect(error).toMatchObject({ status, fromServer: false });
      expect(isConnectionError(error)).toBe(true);
      expect(getConnectionState().offline).toBe(true);
    }
    // The diary server itself answering 503 (the tour is full): it is there and said so.
    fetchMock.mockResolvedValueOnce(serverError(503, 'The tour is full right now.'));
    const refused: unknown = await request('/api/auth/guest', { method: 'POST', body: {}, anonymous: true }).catch((e: unknown) => e);
    expect(refused).toMatchObject({ status: 503, fromServer: true, message: 'The tour is full right now.' });
    expect(isConnectionError(refused)).toBe(false);
    expect(getConnectionState()).toMatchObject({ offline: false, reached: true });
  });

  it('any answer from the server clears the offline state (an error answer included)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(request('/api/health')).rejects.toMatchObject({ status: 0 });
    expect(getConnectionState().offline).toBe(true);

    fetchMock.mockResolvedValueOnce(serverError(404, 'Not here.'));
    await expect(request('/api/nothing')).rejects.toMatchObject({ status: 404, fromServer: true });
    expect(getConnectionState()).toMatchObject({ offline: false, reached: true });

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(request('/api/health')).rejects.toMatchObject({ status: 0 });
    expect(getConnectionState()).toMatchObject({ offline: true, reached: true });

    fetchMock.mockResolvedValueOnce(okJson());
    await expect(request('/api/health')).resolves.toEqual({ ok: true });
    expect(getConnectionState()).toMatchObject({ offline: false, reached: true });
  });

  it('requestBlob and requestUpload report the connection the same way', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(requestBlob('/api/export', { body: { format: 'txt' } })).rejects.toMatchObject({ status: 0 });
    expect(getConnectionState().offline).toBe(true);
    fetchMock.mockResolvedValueOnce(new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await expect(requestUpload('/api/backup/restore', new FormData())).resolves.toEqual({ ok: true });
    expect(getConnectionState()).toMatchObject({ offline: false, reached: true });
  });

  it('isConnectionError is false for anything that is not an unreachable server', () => {
    expect(isConnectionError(new Error('boom'))).toBe(false);
    expect(isConnectionError(new ApiClientError(401, { code: 'UNAUTHORIZED', message: 'x' }))).toBe(false);
    expect(isConnectionError(new ApiClientError(503, { code: 'OTHER', message: 'full' }))).toBe(false);
    expect(isConnectionError(new ApiClientError(503, { code: 'OTHER', message: 'proxy' }, { fromServer: false }))).toBe(true);
    expect(isConnectionError(new ApiClientError(0, { code: 'OTHER', message: 'down' }, { fromServer: true }))).toBe(true);
    expect(new ApiClientError(0, { code: 'OTHER', message: 'down' }, { fromServer: true }).fromServer).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Network guard: the fixed server is the ONE outbound host of the apps
// ---------------------------------------------------------------------------

// Last in this file on purpose: installNetworkGuard() wraps window.fetch once per module and
// cannot be undone, and the guarded XMLHttpRequest.prototype.open stays for the rest of the file.
describe('network guard - the fixed server is the one outbound host of the apps', () => {
  const blocked = 'Offline privacy mode: external network connections are blocked';
  const origFetch: FetchMock = vi.fn();
  let guardedFetch: typeof window.fetch;

  beforeAll(() => {
    vi.stubGlobal('fetch', origFetch);
    installNetworkGuard();
    guardedFetch = window.fetch;
  });

  beforeEach(() => {
    __setApiBaseForTests(null);
    __resetLocaleForTests();
    origFetch.mockReset().mockResolvedValue(okJson());
    setOfflinePrivacyMode(true);
  });

  afterEach(() => {
    // Stubs of this test only (the fetch stub of beforeAll is re-applied below).
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', origFetch);
    __setApiBaseForTests(null);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    setOfflinePrivacyMode(true);
  });

  it('in the Windows app: the fixed server, the page origin and loopback pass; any other host is refused', async () => {
    vi.stubGlobal('__TAURI_INTERNALS__', {});
    expect(apiBaseKind()).toBe('server');
    await guardedFetch(`${DEFAULT_SERVER_URL}/api/health`);
    await guardedFetch('/api/health');
    await guardedFetch('http://127.0.0.1:47000/api/health');
    expect(origFetch).toHaveBeenCalledTimes(3);

    await expect(guardedFetch('https://telemetry.example.net/collect')).rejects.toThrow(blocked);
    await expect(guardedFetch(new URL('https://telemetry.example.net/collect'))).rejects.toThrow(blocked);
    expect(() => new XMLHttpRequest().open('GET', 'https://telemetry.example.net/collect')).toThrow(blocked);
    expect(() => new WebSocket('wss://telemetry.example.net/ws')).toThrow(blocked);
    expect(origFetch).toHaveBeenCalledTimes(3);
  });

  it('in the Android app the same: the fixed server passes, nothing else on the internet', async () => {
    vi.stubGlobal('__MOBILE__', true);
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true });
    expect(apiBaseKind()).toBe('server');
    await guardedFetch(`${DEFAULT_SERVER_URL}/api/entries`);
    expect(origFetch).toHaveBeenCalledTimes(1);
    await expect(guardedFetch('https://telemetry.example.net/collect')).rejects.toThrow(blocked);
    expect(origFetch).toHaveBeenCalledTimes(1);
  });

  it('on the web (same-origin) the fixed server is not special: only the page origin passes', async () => {
    expect(apiBaseKind()).toBe('same-origin');
    await guardedFetch('/api/health');
    await guardedFetch(`${window.location.origin}/api/health`);
    expect(origFetch).toHaveBeenCalledTimes(2);
    await expect(guardedFetch(`${DEFAULT_SERVER_URL}/api/health`)).rejects.toThrow(blocked);
    expect(origFetch).toHaveBeenCalledTimes(2);
  });

  it('a resolved developer base (VITE_API_BASE / tests) passes while it is the base', async () => {
    __setApiBaseForTests('https://dev.example.org');
    await guardedFetch('https://dev.example.org/api/health');
    expect(origFetch).toHaveBeenCalledTimes(1);
    __setApiBaseForTests(null);
    await expect(guardedFetch('https://dev.example.org/api/health')).rejects.toThrow(blocked);
    expect(origFetch).toHaveBeenCalledTimes(1);
  });

  it('the guard is the "offline privacy mode" switch: off, every call goes through', async () => {
    setOfflinePrivacyMode(false);
    await guardedFetch('https://telemetry.example.net/collect');
    expect(origFetch).toHaveBeenCalledTimes(1);
    setOfflinePrivacyMode(true);
    await expect(guardedFetch('https://telemetry.example.net/collect')).rejects.toThrow(blocked);
  });
});
