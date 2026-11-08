import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setApiBaseForTests,
  isApiClientError,
  request,
  requestBlob,
  requestUpload,
  setApiTransport,
  setToken,
} from '@/api/client';
import { __resetLocaleForTests, setCurrentLocale } from '@/i18n/runtime';
import type { CoreResponse } from '../shared/transport';
import { FakeWorker, flush } from '../test/fake-worker';
import { CORE_SHUT_DOWN_MESSAGE, corePath, createCoreClient, toResponse, type CoreClient } from './core-client';

const NO_SERVER = 'No connection to the local diary server.';

function jsonAnswer(id: number, status: number, body: unknown, headers: Record<string, string> = {}): CoreResponse {
  return {
    type: 'response',
    id,
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
    bodyText: JSON.stringify(body),
  };
}

function bytesOf(buffer: ArrayBuffer | undefined): number[] {
  return Array.from(new Uint8Array(buffer as ArrayBuffer));
}

describe('core client - coreFetch over a fake worker', () => {
  let worker: FakeWorker;
  let client: CoreClient;

  /** Sends a request the test never answers (it only looks at what was posted). */
  function send(url: string, init: RequestInit): void {
    client.coreFetch(url, init).catch(() => undefined);
  }

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    __resetLocaleForTests();
    __setApiBaseForTests('');
    worker = new FakeWorker();
    client = createCoreClient(worker);
  });

  afterEach(() => {
    client.dispose();
    setApiTransport(null);
    __setApiBaseForTests(null);
    __resetLocaleForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sends nothing before the core is ready, then posts the request as a CoreRequest', async () => {
    const pending = client.coreFetch('/api/entries?page=2&q=sea+side', {
      method: 'post',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'he', Authorization: 'Bearer tok' },
      body: JSON.stringify({ title: 'יום טוב' }),
    });
    await flush();
    expect(worker.posted).toEqual([]);

    worker.ready();
    await flush();
    expect(worker.posted).toEqual([
      {
        type: 'request',
        id: 1,
        method: 'POST',
        url: '/api/entries?page=2&q=sea+side',
        headers: { 'content-type': 'application/json', 'accept-language': 'he', authorization: 'Bearer tok' },
        bodyText: '{"title":"יום טוב"}',
      },
    ]);
    expect(worker.transfers[0]).toEqual([]);

    worker.emit(jsonAnswer(1, 201, { id: 7 }, { 'x-entry-id': '7' }));
    const res = await pending;
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(201);
    expect(res.ok).toBe(true);
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('X-Entry-Id')).toBe('7');
    expect(await res.json()).toEqual({ id: 7 });
  });

  it('defaults to GET without a body and keeps only the path and query of an absolute URL', async () => {
    worker.ready();
    send('http://127.0.0.1:5000/api/calendar?month=2026-10', {});
    await flush();
    expect(worker.requests[0]).toEqual({ type: 'request', id: 1, method: 'GET', url: '/api/calendar?month=2026-10', headers: {} });
    expect(corePath('/api/health')).toBe('/api/health');
    expect(corePath('https://localhost/api/entries/3?x=1#top')).toBe('/api/entries/3?x=1');
  });

  it('answers each request by its id, whatever the order of the answers', async () => {
    worker.ready();
    const first = client.coreFetch('/api/a', {});
    const second = client.coreFetch('/api/b', {});
    await flush();
    expect(worker.requests.map((r) => [r.id, r.url])).toEqual([
      [1, '/api/a'],
      [2, '/api/b'],
    ]);
    worker.emit(jsonAnswer(2, 200, { which: 'b' }));
    worker.emit(jsonAnswer(1, 200, { which: 'a' }));
    expect(await (await first).json()).toEqual({ which: 'a' });
    expect(await (await second).json()).toEqual({ which: 'b' });
  });

  it('carries a bytes body as a transferred copy and leaves the caller buffer intact', async () => {
    worker.ready();
    const source = new Uint8Array([9, 1, 2, 3, 9]).subarray(1, 4);
    send('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: source,
    });
    await flush();
    const sent = worker.requests[0];
    expect(sent.bodyText).toBeUndefined();
    expect(bytesOf(sent.bodyBytes)).toEqual([1, 2, 3]);
    expect(sent.bodyBytes).not.toBe(source.buffer);
    expect(worker.transfers[0]).toEqual([sent.bodyBytes]);
    expect(Array.from(source)).toEqual([1, 2, 3]);

    const buffer = new Uint8Array([4, 5]).buffer;
    send('/api/backup/restore', { method: 'POST', body: buffer });
    await flush();
    expect(bytesOf(worker.requests[1].bodyBytes)).toEqual([4, 5]);
    expect(worker.requests[1].bodyBytes).not.toBe(buffer);
  });

  it('encodes a FormData body as multipart bytes with the matching Content-Type', async () => {
    worker.ready();
    const form = new FormData();
    form.append('mode', 'replace');
    form.append('file', new File([new Uint8Array([0, 255, 13, 10, 45, 45])], 'יומן "גיבוי".mpd', { type: 'application/octet-stream' }));
    // A Content-Type given by the caller cannot name the boundary: the body's own one replaces it.
    send('/api/backup/restore', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'text/plain' }, body: form });
    await vi.waitFor(() => expect(worker.requests).toHaveLength(1));

    const sent = worker.requests[0];
    expect(sent.headers.accept).toBe('application/json');
    const contentType = /^multipart\/form-data; boundary=(----mpdFormBoundary[0-9a-f]{32})$/.exec(sent.headers['content-type']);
    expect(contentType).not.toBeNull();
    const boundary = (contentType as RegExpExecArray)[1];
    expect(sent.bodyText).toBeUndefined();
    expect(worker.transfers[0]).toEqual([sent.bodyBytes]);

    // Byte for byte (multipart.test.ts reads such a body back with an independent parser).
    const utf8 = (text: string): number[] => Array.from(new TextEncoder().encode(text));
    expect(bytesOf(sent.bodyBytes)).toEqual([
      ...utf8(`--${boundary}\r\nContent-Disposition: form-data; name="mode"\r\n\r\nreplace\r\n`),
      ...utf8(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="יומן %22גיבוי%22.mpd"\r\n`),
      ...utf8('Content-Type: application/octet-stream\r\n\r\n'),
      ...[0, 255, 13, 10, 45, 45],
      ...utf8(`\r\n--${boundary}--\r\n`),
    ]);
  });

  it('wraps a bytes answer in a Response whose body is those bytes', async () => {
    worker.ready();
    const pending = client.coreFetch('/api/backup/download', { method: 'POST' });
    await flush();
    worker.emit({
      type: 'response',
      id: 1,
      status: 200,
      headers: { 'content-type': 'application/octet-stream' },
      bodyBytes: new Uint8Array([77, 80, 68, 0, 255]).buffer,
    } satisfies CoreResponse);
    const res = await pending;
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(bytesOf(await res.arrayBuffer())).toEqual([77, 80, 68, 0, 255]);
  });

  it('builds body-less responses for 204/304 and for an answer without a body', async () => {
    expect(toResponse({ type: 'response', id: 1, status: 204, headers: {} }).body).toBeNull();
    // A core that (wrongly) attaches a body to 304 must not break the Response.
    expect(toResponse({ type: 'response', id: 1, status: 304, headers: {}, bodyText: 'x' }).status).toBe(304);
    expect(await toResponse({ type: 'response', id: 1, status: 200, headers: {} }).text()).toBe('');
  });

  it('ignores messages that are not core messages and answers for unknown ids', async () => {
    worker.ready();
    const pending = client.coreFetch('/api/health', {});
    await flush();
    worker.emit(null);
    worker.emit('ready');
    worker.emit({ type: 'response', id: 'x', status: 200, headers: {} });
    worker.emit(jsonAnswer(99, 200, { stray: true }));
    worker.emit(jsonAnswer(1, 200, { ok: true }));
    expect(await (await pending).json()).toEqual({ ok: true });
  });

  it('forwards core log events to the console', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    worker.emit({ type: 'event', name: 'log', level: 'warn', message: 'storage is slow' });
    expect(warn).toHaveBeenCalledWith('[diary-core] storage is slow');
  });

  describe('through src/api/client.ts (setApiTransport)', () => {
    beforeEach(() => {
      setApiTransport(client.coreFetch);
      worker.ready();
    });

    it('request(): JSON round trip with the token and the UI language', async () => {
      setToken('tok', false);
      setCurrentLocale('he');
      worker.onPost = (message) => {
        if (message.type === 'request') queueMicrotask(() => worker.emit(jsonAnswer(message.id, 200, { items: [1, 2] })));
      };
      await expect(request('/api/entries', { query: { page: 2 } })).resolves.toEqual({ items: [1, 2] });
      expect(worker.requests[0]).toMatchObject({
        method: 'GET',
        url: '/api/entries?page=2',
        headers: { accept: 'application/json', 'accept-language': 'he', authorization: 'Bearer tok' },
      });
    });

    it('request(): a 204 answer resolves to undefined', async () => {
      worker.onPost = (message) => {
        if (message.type === 'request') queueMicrotask(() => worker.emit({ type: 'response', id: message.id, status: 204, headers: {} }));
      };
      await expect(request('/api/entries/7', { method: 'DELETE' })).resolves.toBeUndefined();
    });

    it('request(): an error status becomes the ApiClientError of the body', async () => {
      worker.onPost = (message) => {
        if (message.type === 'request') {
          queueMicrotask(() => worker.emit(jsonAnswer(message.id, 409, { code: 'CONFLICT', message: 'Already exists.', field: 'title' })));
        }
      };
      await expect(request('/api/habits', { method: 'POST', body: { title: 'Walk' } })).rejects.toMatchObject({
        name: 'ApiClientError',
        status: 409,
        code: 'CONFLICT',
        message: 'Already exists.',
        field: 'title',
      });
    });

    it('requestBlob(): bytes and the file name of Content-Disposition', async () => {
      worker.onPost = (message) => {
        if (message.type !== 'request') return;
        queueMicrotask(() =>
          worker.emit({
            type: 'response',
            id: message.id,
            status: 200,
            headers: {
              'content-type': 'application/octet-stream',
              'content-disposition': "attachment; filename*=UTF-8''%D7%99%D7%95%D7%9E%D7%9F.mpd",
              'x-entries-exported': '12',
            },
            bodyBytes: new Uint8Array([1, 2, 3, 4]).buffer,
          } satisfies CoreResponse),
        );
      };
      const { blob, fileName, headers } = await requestBlob('/api/backup', { body: { password: 'fictional' } });
      expect(fileName).toBe('יומן.mpd');
      expect(headers.get('X-Entries-Exported')).toBe('12');
      expect(blob.size).toBe(4);
      expect(worker.requests[0]).toMatchObject({ method: 'POST', bodyText: '{"password":"fictional"}' });
    });

    it('requestUpload(): the form reaches the core as multipart bytes', async () => {
      worker.onPost = (message) => {
        if (message.type === 'request') queueMicrotask(() => worker.emit(jsonAnswer(message.id, 200, { restored: 3 })));
      };
      const form = new FormData();
      form.append('file', new File([new Uint8Array([5, 6, 7])], 'backup.mpd'));
      await expect(requestUpload('/api/backup/restore', form)).resolves.toEqual({ restored: 3 });
      const sent = worker.requests[0];
      expect(sent.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
      expect(new TextDecoder().decode(sent.bodyBytes)).toContain('name="file"; filename="backup.mpd"');
    });

    it('a worker error fails the waiting requests with status 0, in the UI language', async () => {
      const first = request('/api/entries');
      const upload = requestBlob('/api/export', { body: { format: 'txt' } });
      await flush();
      expect(worker.requests).toHaveLength(2);
      worker.fail('error');
      await expect(first).rejects.toMatchObject({ name: 'ApiClientError', status: 0, code: 'OTHER', message: NO_SERVER });
      await expect(upload).rejects.toMatchObject({ name: 'ApiClientError', status: 0, code: 'OTHER', message: NO_SERVER });

      // The worker itself is still there: later requests are sent and answered.
      worker.onPost = (message) => {
        if (message.type === 'request') queueMicrotask(() => worker.emit(jsonAnswer(message.id, 200, { ok: true })));
      };
      await expect(request('/api/health')).resolves.toEqual({ ok: true });

      setCurrentLocale('he');
      worker.onPost = null;
      const hebrew = request('/api/health');
      await flush();
      worker.fail('messageerror');
      await expect(hebrew).rejects.toMatchObject({ status: 0, message: 'אין חיבור לשרת המקומי של היומן.' });
    });

    it('an aborted request rejects with the AbortError, not with status 0, and cancels in the core', async () => {
      const controller = new AbortController();
      const pending = request('/api/search', { query: { q: 'sea' }, signal: controller.signal });
      await flush();
      expect(worker.requests).toHaveLength(1);
      controller.abort();
      const error = await pending.catch((e: unknown) => e);
      expect((error as Error).name).toBe('AbortError');
      expect(isApiClientError(error)).toBe(false);
      expect(worker.cancels).toEqual([{ type: 'cancel', id: 1 }]);
    });
  });

  it('rejects at once, and posts nothing, when the signal is already aborted', async () => {
    worker.ready();
    const controller = new AbortController();
    controller.abort();
    await expect(client.coreFetch('/api/entries', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.posted).toEqual([]);
  });

  it('drops the answer of a cancelled request and stops listening to its signal', async () => {
    worker.ready();
    const controller = new AbortController();
    const cancelled = client.coreFetch('/api/a', { signal: controller.signal });
    const kept = client.coreFetch('/api/b', { signal: controller.signal });
    await flush();
    worker.emit(jsonAnswer(2, 200, { which: 'b' }));
    expect(await (await kept).json()).toEqual({ which: 'b' });

    controller.abort();
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    // Only the request that was still waiting is cancelled; its late answer changes nothing.
    expect(worker.cancels).toEqual([{ type: 'cancel', id: 1 }]);
    worker.emit(jsonAnswer(1, 200, { late: true }));
    await flush();
  });

  it('rejects with status 0 when the answer cannot be a Response (bad status)', async () => {
    worker.ready();
    const tooLow = client.coreFetch('/api/a', {});
    const tooHigh = client.coreFetch('/api/b', {});
    await flush();
    worker.emit({ type: 'response', id: 1, status: 99, headers: {} });
    worker.emit({ type: 'response', id: 2, status: 700, headers: {}, bodyText: '{}' });
    await expect(tooLow).rejects.toMatchObject({ name: 'ApiClientError', status: 0, message: NO_SERVER });
    await expect(tooHigh).rejects.toMatchObject({ name: 'ApiClientError', status: 0 });
  });

  it('rejects with status 0 when posting to the worker throws', async () => {
    worker.ready();
    worker.postError = new Error('worker is gone');
    await expect(client.coreFetch('/api/a', {})).rejects.toMatchObject({ name: 'ApiClientError', status: 0 });
  });

  it('rejects an unsupported body type like fetch does (TypeError)', async () => {
    worker.ready();
    const stream = {} as unknown as BodyInit;
    await expect(client.coreFetch('/api/a', { method: 'POST', body: stream })).rejects.toBeInstanceOf(TypeError);
    expect(worker.posted).toEqual([]);
  });

  describe('a core that cannot start', () => {
    it('fatal: ready rejects, waiting and later requests fail with status 0, nothing is posted', async () => {
      const early = client.coreFetch('/api/health', {});
      worker.emit({ type: 'event', name: 'fatal', message: 'no storage' });
      await expect(client.ready).rejects.toThrow('no storage');
      await expect(early).rejects.toMatchObject({ name: 'ApiClientError', status: 0, message: NO_SERVER });
      await expect(client.coreFetch('/api/health', {})).rejects.toMatchObject({ status: 0 });
      // A late `ready` does not revive it.
      worker.ready();
      await expect(client.coreFetch('/api/health', {})).rejects.toMatchObject({ status: 0 });
      expect(worker.posted).toEqual([]);
    });

    it('a worker error before ready is fatal', async () => {
      worker.fail('error');
      await expect(client.ready).rejects.toThrow('worker failed');
      await expect(client.coreFetch('/api/health', {})).rejects.toMatchObject({ status: 0 });
    });

    it('fatal after ready fails the waiting requests and every later one', async () => {
      worker.ready();
      await client.ready;
      const waiting = client.coreFetch('/api/health', {});
      await flush();
      worker.emit({ type: 'event', name: 'fatal', message: 'database closed' });
      await expect(waiting).rejects.toMatchObject({ status: 0 });
      await expect(client.coreFetch('/api/health', {})).rejects.toMatchObject({ status: 0 });
      expect(worker.requests).toHaveLength(1);
    });

    it('gives up when ready does not arrive in time', async () => {
      vi.useFakeTimers();
      const slowWorker = new FakeWorker();
      const slow = createCoreClient(slowWorker, { readyTimeoutMs: 5000 });
      const outcome = slow.ready.then(
        () => 'ready',
        (e: Error) => e.message,
      );
      await vi.advanceTimersByTimeAsync(4999);
      slowWorker.emit({ type: 'event', name: 'log', level: 'info', message: 'still loading' });
      await vi.advanceTimersByTimeAsync(1);
      expect(await outcome).toBe('The diary core did not start in time.');
      await expect(slow.coreFetch('/api/health', {})).rejects.toMatchObject({ status: 0 });
    });

    it('does not time out once the core is ready', async () => {
      vi.useFakeTimers();
      const fastWorker = new FakeWorker();
      const fast = createCoreClient(fastWorker, { readyTimeoutMs: 5000 });
      fastWorker.ready();
      await vi.advanceTimersByTimeAsync(60_000);
      await expect(fast.ready).resolves.toBeUndefined();
      const pending = fast.coreFetch('/api/health', {});
      await vi.advanceTimersByTimeAsync(0);
      fastWorker.emit(jsonAnswer(1, 200, { ok: true }));
      expect((await pending).status).toBe(200);
    });
  });

  describe('control messages', () => {
    it('posts the action after ready and resolves on an ok result; ids are shared with requests', async () => {
      const flushed = client.control('flushAll');
      await flush();
      expect(worker.posted).toEqual([]);
      worker.ready();
      await flush();
      send('/api/health', {});
      await flush();
      expect(worker.posted.map((m) => [m.type, (m as { id?: number }).id])).toEqual([
        ['control', 1],
        ['request', 2],
      ]);
      expect(worker.controls[0]).toEqual({ type: 'control', id: 1, action: 'flushAll' });
      worker.emit({ type: 'control-result', id: 1, ok: true });
      await expect(flushed).resolves.toBeUndefined();
    });

    it('rejects with the reason of a failed action, or when the core dies first', async () => {
      worker.ready();
      const failing = client.control('lockAll');
      const dying = client.control('shutdown');
      await flush();
      worker.emit({ type: 'control-result', id: 1, ok: false, message: 'a session is busy' });
      await expect(failing).rejects.toThrow('a session is busy');
      worker.emit({ type: 'event', name: 'fatal', message: 'out of memory' });
      await expect(dying).rejects.toThrow('out of memory');
      await expect(client.control('flushAll')).rejects.toThrow('out of memory');
    });

    it('shutdown is final: when its result arrives, waiting and later requests fail with status 0 and later controls reject', async () => {
      // The worker closes itself after it posted the result of a shutdown and drops whatever arrives
      // afterwards: nothing may wait for an answer that will never come.
      let closed = false;
      worker.onPost = (message) => {
        if (closed || message.type !== 'control') return;
        if (message.action === 'shutdown') closed = true;
        queueMicrotask(() => worker.emit({ type: 'control-result', id: message.id, ok: true }));
      };
      worker.ready();
      const waiting = client.coreFetch('/api/entries', {});
      waiting.catch(() => undefined);
      await expect(client.control('flushAll')).resolves.toBeUndefined();

      await expect(client.control('shutdown')).resolves.toBeUndefined();
      // The request that was still waiting when the core closed.
      await expect(waiting).rejects.toMatchObject({ status: 0, message: NO_SERVER });
      // Later ones: rejected at once, and nothing is posted to the closed worker.
      const posted = worker.posted.length;
      const late = await client.coreFetch('/api/health', {}).catch((e: unknown) => e);
      expect(isApiClientError(late)).toBe(true);
      expect(late).toMatchObject({ status: 0, message: NO_SERVER });
      await expect(client.control('flushAll')).rejects.toThrow(CORE_SHUT_DOWN_MESSAGE);
      await expect(client.control('shutdown')).rejects.toThrow(CORE_SHUT_DOWN_MESSAGE);
      expect(worker.posted.length).toBe(posted);
    });

    it('a shutdown that reports a failure closed the worker all the same: the client is dead', async () => {
      worker.ready();
      const stopping = client.control('shutdown');
      const waiting = client.coreFetch('/api/health', {});
      await flush();
      worker.emit({ type: 'control-result', id: 1, ok: false, message: 'the storage refused the last write' });
      await expect(stopping).rejects.toThrow('the storage refused the last write');
      await expect(waiting).rejects.toMatchObject({ status: 0 });
      await expect(client.coreFetch('/api/health', {})).rejects.toMatchObject({ status: 0 });
      await expect(client.control('lockAll')).rejects.toThrow(CORE_SHUT_DOWN_MESSAGE);
    });
  });

  it('dispose terminates the worker and fails what was waiting', async () => {
    worker.ready();
    const waiting = client.coreFetch('/api/health', {});
    await flush();
    client.dispose();
    expect(worker.terminated).toBe(true);
    await expect(waiting).rejects.toMatchObject({ status: 0 });
    await expect(client.coreFetch('/api/health', {})).rejects.toMatchObject({ status: 0 });
  });
});
