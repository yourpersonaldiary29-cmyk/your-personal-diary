import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setApiBaseForTests, ApiClientError, isConnectionError, request, setApiTransport, type ApiTransport } from './client';
import { __resetConnectionForTests, getConnectionState } from './connection';

/** A transport that never answers until its signal aborts (a black hole). */
const blackhole: ApiTransport = (_url, init) =>
  new Promise((_, reject) => {
    const abort = () => reject(new DOMException('aborted', 'AbortError'));
    if (init.signal?.aborted) abort();
    else init.signal?.addEventListener('abort', abort, { once: true });
  });

function okJson(body: unknown, headers: Record<string, string> = {}, status = 200): Response {
  const text = JSON.stringify(body);
  return { ok: status < 400, status, headers: { get: (n: string) => headers[n] ?? null }, text: async () => text, json: async () => body } as unknown as Response;
}

describe('request timeoutMs (OFFLINE-DESIGN section 4.2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetConnectionForTests();
    __setApiBaseForTests('');
  });
  afterEach(() => {
    setApiTransport(null);
    __setApiBaseForTests(null);
    vi.useRealTimers();
  });

  it('a timeout fails like a lost connection: status 0, the connection store told', async () => {
    setApiTransport(blackhole);
    const p = request('/api/health', { anonymous: true, timeoutMs: 5000 });
    const settled = p.then(
      () => 'resolved',
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(5001);
    const err = await settled;
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(0);
    expect(isConnectionError(err)).toBe(true);
    expect(getConnectionState().offline).toBe(true);
  });

  it("the caller's own abort is still an AbortError, not a lost connection", async () => {
    setApiTransport(blackhole);
    const controller = new AbortController();
    const p = request('/api/health', { anonymous: true, timeoutMs: 5000, signal: controller.signal });
    const settled = p.then(
      () => 'resolved',
      (e: unknown) => e,
    );
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    const err = await settled;
    expect((err as Error).name).toBe('AbortError');
    expect(getConnectionState().offline).toBe(false);
  });

  it('without timeoutMs the init is exactly as before (no timeout, no cache key)', async () => {
    const transport = vi.fn<ApiTransport>(async () => okJson({ ok: true }));
    setApiTransport(transport);
    await request('/api/health', { anonymous: true });
    const init = transport.mock.calls[0][1];
    expect(Object.keys(init).sort()).toEqual(['body', 'credentials', 'headers', 'method', 'signal']);
    expect(init.signal).toBeUndefined();
  });

  it('passes cache: "no-store" only when asked and composes the timeout signal', async () => {
    const transport = vi.fn<ApiTransport>(async () => okJson({ ok: true }));
    setApiTransport(transport);
    await request('/api/health', { anonymous: true, timeoutMs: 1000, cache: 'no-store' });
    const init = transport.mock.calls[0][1];
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('exposes Retry-After of a 429 / 503 as retryAfterSec', async () => {
    setApiTransport(async () => okJson({ code: 'OTHER', message: 'slow down' }, { 'Retry-After': '7' }, 429));
    const err = (await request('/api/sync/op', { method: 'POST', body: {} }).catch((e: unknown) => e)) as ApiClientError;
    expect(err.status).toBe(429);
    expect(err.retryAfterSec).toBe(7);
    setApiTransport(async () => okJson({ code: 'OTHER', message: 'x' }, {}, 500));
    const plain = (await request('/api/x').catch((e: unknown) => e)) as ApiClientError;
    expect(plain.retryAfterSec).toBeUndefined();
  });
});
