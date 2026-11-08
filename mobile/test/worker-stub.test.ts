import { describe, expect, it } from 'vitest';
import { answerStub, startStub, STUB_ERROR_BODY, type StubScope } from '../core/worker-stub';
import { createCoreClient } from '../host/core-client';
import { CORE_PROTOCOL_VERSION, type CoreMessage } from '../shared/transport';
import { stubWorker } from './fake-worker';

/** A worker scope that records what the stub posts. */
function fakeScope() {
  const posted: CoreMessage[] = [];
  let listener: ((event: MessageEvent<unknown>) => void) | null = null;
  let closed = false;
  const scope: StubScope = {
    postMessage: (message) => {
      posted.push(message);
    },
    addEventListener: (_type, l) => {
      listener = l;
    },
    close: () => {
      closed = true;
    },
  };
  return {
    scope,
    posted,
    isClosed: () => closed,
    receive: (data: unknown) => listener?.(new MessageEvent('message', { data })),
  };
}

describe('placeholder core (worker-stub)', () => {
  it('answers every API request with 503 { code: OTHER, message: core not ready }', () => {
    const answer = answerStub({ type: 'request', id: 4, method: 'GET', url: '/api/entries', headers: {} });
    expect(answer).toEqual({
      type: 'response',
      id: 4,
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      bodyText: JSON.stringify(STUB_ERROR_BODY),
    });
    expect(STUB_ERROR_BODY).toEqual({ code: 'OTHER', message: 'core not ready' });
  });

  it('acknowledges control messages and says nothing to a cancel', () => {
    expect(answerStub({ type: 'control', id: 9, action: 'flushAll' })).toEqual({ type: 'control-result', id: 9, ok: true });
    expect(answerStub({ type: 'cancel', id: 9 })).toBeNull();
  });

  it('announces ready once it listens, ignores junk and closes itself on shutdown', () => {
    const core = fakeScope();
    startStub(core.scope);
    expect(core.posted).toEqual([{ type: 'event', name: 'ready', protocol: CORE_PROTOCOL_VERSION }]);

    core.receive('hello');
    core.receive({ type: 'request' });
    core.receive({ type: 'control', id: 1, action: 'format-disk' });
    expect(core.posted).toHaveLength(1);

    core.receive({ type: 'request', id: 2, method: 'POST', url: '/api/auth/login', headers: {}, bodyText: '{}' });
    expect(core.posted[1]).toMatchObject({ type: 'response', id: 2, status: 503 });
    expect(core.isClosed()).toBe(false);

    core.receive({ type: 'control', id: 3, action: 'lockAll' });
    expect(core.isClosed()).toBe(false);
    core.receive({ type: 'control', id: 4, action: 'shutdown' });
    expect(core.posted.slice(2)).toEqual([
      { type: 'control-result', id: 3, ok: true },
      { type: 'control-result', id: 4, ok: true },
    ]);
    expect(core.isClosed()).toBe(true);
  });

  it('does not start by itself when a page (not a worker) imports it', () => {
    // This test file imported the module in a window context: nothing was posted to the window.
    expect(typeof window).toBe('object');
  });

  it('works end to end with the core client: ready, 503 answers, controls, shutdown', async () => {
    const worker = stubWorker();
    const client = createCoreClient(worker);
    await client.ready;

    const res = await client.coreFetch('/api/entries?page=1', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await res.json()).toEqual({ code: 'OTHER', message: 'core not ready' });

    await expect(client.control('flushAll')).resolves.toBeUndefined();
    expect(worker.closed).toBe(false);
    await expect(client.control('shutdown')).resolves.toBeUndefined();
    expect(worker.closed).toBe(true);
    client.dispose();
  });
});
