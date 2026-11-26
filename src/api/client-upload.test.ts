/**
 * The raw upload of the owner's Server card (`requestRawUpload`, PUT /api/server/downloads/upload/<token>):
 * an XMLHttpRequest - the browser API with upload progress - that carries the same headers as every
 * request (the token, Accept-Language) plus Content-Type application/octet-stream, reports the progress
 * and the end of the sending, and handles the answers exactly as `request` does: the JSON on success,
 * the server's error with its field, 401 / 423 events, a network failure as status 0 (a lost connection),
 * an abort as an AbortError. No network: XMLHttpRequest is a fake here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetLocaleForTests, setCurrentLocale, trWith } from '@/i18n/runtime';
import { __setApiBaseForTests, ApiClientError, LOCKED_EVENT, UNAUTHORIZED_EVENT, getToken, isConnectionError, requestRawUpload, setToken } from './client';
import { __resetConnectionForTests, getConnectionState } from './connection';
import { server } from './index';

/** A stand-in for XMLHttpRequest that records the request and lets the test answer it. */
class FakeXhr {
  static all: FakeXhr[] = [];
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown = undefined;
  sentBody = false;
  aborted = false;
  status = 0;
  responseText = '';
  upload: { onprogress: ((e: ProgressEvent) => void) | null; onload: (() => void) | null } = { onprogress: null, onload: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  readHeaders: string[] = [];

  constructor() {
    FakeXhr.all.push(this);
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  send(body: unknown): void {
    this.body = body;
    this.sentBody = true;
  }

  abort(): void {
    this.aborted = true;
    this.onabort?.();
  }

  getResponseHeader(name: string): string | null {
    this.readHeaders.push(name);
    return null;
  }

  // What the test does as the "network":
  progress(loaded: number, total: number, lengthComputable = true): void {
    this.upload.onprogress?.({ loaded, total, lengthComputable } as ProgressEvent);
  }

  allSent(): void {
    this.upload.onload?.();
  }

  respond(status: number, body: unknown): void {
    this.status = status;
    this.responseText = typeof body === 'string' ? body : JSON.stringify(body);
    this.onload?.();
  }

  failNetwork(): void {
    this.onerror?.();
  }
}

/** The request the code under test opened last (it opens it after resolving the API base). */
async function opened(): Promise<FakeXhr> {
  await vi.waitFor(() => expect(FakeXhr.all.length).toBeGreaterThan(0));
  return FakeXhr.all[FakeXhr.all.length - 1];
}

const en = trWith('en');
const file = () => new Blob([new Uint8Array(2048)], { type: 'application/octet-stream' });

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  FakeXhr.all = [];
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  __resetConnectionForTests();
  __resetLocaleForTests();
  setCurrentLocale('en');
  __setApiBaseForTests('');
});

afterEach(() => {
  vi.unstubAllGlobals();
  __setApiBaseForTests(null);
  __resetConnectionForTests();
  __resetLocaleForTests();
});

describe('requestRawUpload', () => {
  it('PUTs the file as the raw body with the token, the language and application/octet-stream, reports the progress and resolves the answer', async () => {
    setToken('tok', false);
    setCurrentLocale('he');
    const body = file();
    const progress: Array<[number, number]> = [];
    const onSent = vi.fn();
    const answer = requestRawUpload<{ action: string }>('/api/server/downloads/upload/abc', body, { onProgress: (sent, total) => progress.push([sent, total]), onSent });
    const xhr = await opened();
    expect(xhr.method).toBe('PUT');
    expect(xhr.url).toBe('/api/server/downloads/upload/abc');
    // The mark of an app from 1.1.0 on (shared/constants.ts CLIENT_MARK_HEADER) rides along, as on every request.
    expect(xhr.headers).toEqual({ 'Accept-Language': 'he', 'X-Diary-Client': '2', Accept: 'application/json', Authorization: 'Bearer tok', 'Content-Type': 'application/octet-stream' });
    // The Blob itself: the browser streams it and sets Content-Length from it.
    expect(xhr.body).toBe(body);
    xhr.progress(512, 2048);
    // Without a computable length the file's own size is the total.
    xhr.progress(1024, 0, false);
    xhr.allSent();
    expect(progress).toEqual([
      [512, 2048],
      [1024, 2048],
    ]);
    expect(onSent).toHaveBeenCalledTimes(1);
    xhr.respond(201, { action: 'published' });
    await expect(answer).resolves.toEqual({ action: 'published' });
    expect(getConnectionState().reached).toBe(true);
    // Retry-After is never read: the cross-origin apps cannot see it, and the browser would complain.
    expect(xhr.readHeaders).toEqual([]);
  });

  it('a refusal is the server\'s error with its code, field and localised message', async () => {
    const answer = requestRawUpload('/api/server/downloads/upload/abc', file());
    const xhr = await opened();
    xhr.respond(400, { code: 'VALIDATION', field: 'file', message: en('server.downloads.notWindows') });
    const error = await answer.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION', field: 'file', message: en('server.downloads.notWindows'), fromServer: true });
    expect(isConnectionError(error)).toBe(false);
    expect(getConnectionState()).toMatchObject({ offline: false, reached: true });
  });

  it('401 forgets the token and fires the unauthorized event; 423 fires the locked event', async () => {
    setToken('tok', true);
    const onUnauthorized = vi.fn();
    const onLocked = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    window.addEventListener(LOCKED_EVENT, onLocked);
    try {
      const first = requestRawUpload('/api/server/downloads/upload/abc', file());
      (await opened()).respond(401, { code: 'UNAUTHORIZED', message: 'Please sign in again.' });
      await expect(first).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
      expect(getToken()).toBeNull();
      expect(onUnauthorized).toHaveBeenCalledTimes(1);

      FakeXhr.all = [];
      const second = requestRawUpload('/api/server/downloads/upload/abc', file());
      (await opened()).respond(423, { code: 'LOCKED', message: 'The diary is locked.' });
      await expect(second).rejects.toMatchObject({ status: 423 });
      expect(onLocked).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
      window.removeEventListener(LOCKED_EVENT, onLocked);
    }
  });

  it('a network failure is status 0 in the UI language and marks the server unreachable; so is a proxy page without the JSON body', async () => {
    const first = requestRawUpload('/api/server/downloads/upload/abc', file());
    (await opened()).failNetwork();
    const error = await first.catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, code: 'OTHER', fromServer: false });
    expect((error as Error).message).toBe(en('shell.noServer'));
    expect(isConnectionError(error)).toBe(true);
    expect(getConnectionState().offline).toBe(true);

    FakeXhr.all = [];
    const second = requestRawUpload('/api/server/downloads/upload/abc', file());
    (await opened()).respond(502, '<html>Bad gateway</html>');
    const proxy = await second.catch((e: unknown) => e);
    expect(proxy).toMatchObject({ status: 502, fromServer: false, message: en('shell.errorStatus', { status: 502 }) });
    expect(isConnectionError(proxy)).toBe(true);
  });

  it('an abort through the signal stops the request and rejects with an AbortError; an aborted signal opens nothing', async () => {
    const controller = new AbortController();
    const answer = requestRawUpload('/api/server/downloads/upload/abc', file(), { signal: controller.signal });
    const xhr = await opened();
    controller.abort();
    const error = await answer.catch((e: unknown) => e);
    expect(xhr.aborted).toBe(true);
    expect(error).toMatchObject({ name: 'AbortError' });
    // An abort is not a lost connection.
    expect(getConnectionState().offline).toBe(false);

    FakeXhr.all = [];
    await expect(requestRawUpload('/api/server/downloads/upload/abc', file(), { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeXhr.all).toHaveLength(0);
  });

  it('server.downloads.upload builds the path from the token and goes to the API base', async () => {
    __setApiBaseForTests('https://diary.example.org');
    const answer = server.downloads.upload('A-b_c'.padEnd(43, 'x'), file());
    const xhr = await opened();
    expect(xhr.url).toBe(`https://diary.example.org/api/server/downloads/upload/${'A-b_c'.padEnd(43, 'x')}`);
    xhr.respond(201, { action: 'published' });
    await expect(answer).resolves.toEqual({ action: 'published' });
  });
});
