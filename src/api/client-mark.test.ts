/**
 * The client mark (app version 1.1.0, shared/constants.ts CLIENT_MARK_HEADER / CLIENT_MARK_VALUE): every request
 * an app sends to the diary server carries `X-Diary-Client: 2` - on every path of src/api/client.ts (`request`,
 * `requestBlob`, `requestUpload`, `requestRawUpload`), with and without a session, through the default transport
 * (fetch) and through an installed one (the Android local-core build, the offline engine's tests), and in every
 * build (the header does not depend on the platform). One constant: nothing about the user, the device, the
 * version or the platform. No network: fetch and XMLHttpRequest are stand-ins.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLIENT_MARK_HEADER, CLIENT_MARK_VALUE } from '@shared/constants';
import { __resetLocaleForTests } from '@/i18n/runtime';
import { __setApiBaseForTests, request, requestBlob, requestRawUpload, requestUpload, setApiTransport, setToken } from './client';
import { auth, server } from './index';

function okResponse(body: unknown = { ok: true }) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
    json: async () => body,
    blob: async () => new Blob([]),
  };
}

type Init = { headers: Record<string, string> };

describe('X-Diary-Client: 2 on every request', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    __resetLocaleForTests();
    __setApiBaseForTests('');
    fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setApiTransport(null);
    __setApiBaseForTests(null);
    __resetLocaleForTests();
  });

  const headersOf = (call: number) => (fetchMock.mock.calls[call][1] as Init).headers;

  it('is the constant of shared/constants.ts: one header, one value', () => {
    expect(CLIENT_MARK_HEADER).toBe('X-Diary-Client');
    expect(CLIENT_MARK_VALUE).toBe('2');
  });

  it('JSON requests, file downloads and multipart uploads carry it - signed in or not', async () => {
    await request('/api/server/info', { anonymous: true });
    await auth.login({ username: 'dana', password: 'x' }).catch(() => undefined);
    setToken('tok', true);
    await request('/api/auth/me');
    await request('/api/settings', { method: 'PUT', body: { theme: 'dark' } });
    await requestBlob('/api/export', { body: { format: 'txt' } });
    await requestUpload('/api/backup/restore', new FormData());
    await request('/api/health', { timeoutMs: 5000, cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledTimes(7);
    for (let i = 0; i < 7; i++) expect(headersOf(i)[CLIENT_MARK_HEADER], `request ${i}`).toBe(CLIENT_MARK_VALUE);
    // The session routes of an older version are recognised by its ABSENCE: the new app's sign-in has it.
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/login');
    expect(headersOf(1).Authorization).toBeUndefined();
  });

  it('nothing else about the app rides along: the mark carries no version, platform or device', async () => {
    setToken('tok', false);
    await request('/api/settings');
    expect(Object.keys(headersOf(0)).sort()).toEqual(['Accept', 'Accept-Language', 'Authorization', CLIENT_MARK_HEADER].sort());
  });

  it('an installed transport gets the same header (the local-core build, the offline engine)', async () => {
    const transport = vi.fn().mockResolvedValue(okResponse());
    setApiTransport(transport as never);
    await server.info();
    await request('/api/sync/op', { method: 'POST', body: { v: 1 } });
    expect(fetchMock).not.toHaveBeenCalled();
    for (const call of transport.mock.calls) expect((call[1] as Init).headers[CLIENT_MARK_HEADER]).toBe(CLIENT_MARK_VALUE);
  });

  it('the installer upload of the Server card (XMLHttpRequest) carries it too', async () => {
    const sent: Record<string, string> = {};
    class FakeXhr {
      upload = { onprogress: null, onload: null };
      status = 201;
      responseText = '{}';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open() {}
      setRequestHeader(name: string, value: string) {
        sent[name] = value;
      }
      send() {
        queueMicrotask(() => this.onload?.());
      }
      abort() {}
    }
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    setToken('tok', true);
    await requestRawUpload('/api/server/downloads/upload/t', new Blob(['x']));
    expect(sent[CLIENT_MARK_HEADER]).toBe(CLIENT_MARK_VALUE);
    expect(sent['Content-Type']).toBe('application/octet-stream');
  });
});
