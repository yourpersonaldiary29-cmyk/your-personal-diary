// @vitest-environment node
/**
 * The core worker with the transfer semantics of a real Worker: every message is structured-cloned
 * with its transfer list, so a transferred buffer is DETACHED on the side that posted it (the
 * double of ./real-worker.ts hands the same objects over and cannot notice a buffer that is used
 * after it was transferred). On that channel:
 *
 *  - requests, a cancel and a control that reach the worker before the assets (or while the core
 *    boots) wait for the boot and are then answered; a second assets message does not boot twice;
 *  - binary answers (PDF, backup) and uploads (Blob and typed-array bodies) travel while other
 *    requests run concurrently, and the core keeps working afterwards.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { AuthResponse } from '@shared/types';
import { runCoreWorker, type CoreWorkerScope } from '../../core/worker';
import { createCoreClient } from '../../host/core-client';
import { serveStorage } from '../../host/storage-rpc';
import { MemoryStorage } from '../../host/storage/memory';
import { FakeWorker } from '../fake-worker';
import { entryInput } from './contract-rig';
import { FAST_KDF, testAssets } from './helpers';

const PASSWORD = 'Passw0rd!';

type Posted = Record<string, unknown>;

interface TransferringWorker {
  worker: FakeWorker;
  /** What the core posted, as it arrived on the host (clones). */
  fromCore: Posted[];
}

/** A worker double whose two directions clone and transfer like `postMessage` of a real Worker. */
function transferringWorker(): TransferringWorker {
  const worker = new FakeWorker();
  const fromCore: Posted[] = [];
  const toCore: Array<(event: MessageEvent<unknown>) => void> = [];
  const scope: CoreWorkerScope = {
    postMessage: (message, transfer = []) => {
      const data = structuredClone(message, { transfer }) as unknown as Posted;
      fromCore.push(data);
      setTimeout(() => worker.emit(data), 0);
    },
    addEventListener: (_type, listener) => {
      toCore.push(listener);
    },
    removeEventListener: (_type, listener) => {
      const index = toCore.indexOf(listener);
      if (index >= 0) toCore.splice(index, 1);
    },
    close: () => undefined,
  };
  worker.onPost = (message) => {
    const transfer = worker.transfers[worker.transfers.length - 1] ?? [];
    const data = structuredClone(message, { transfer });
    setTimeout(() => {
      for (const listener of [...toCore]) listener(new MessageEvent('message', { data }));
    }, 0);
  };
  runCoreWorker(scope, { bootOptions: { auth: { kdf: FAST_KDF } } });
  return { worker, fromCore };
}

const disposers: Array<() => void> = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});

async function until(check: () => boolean, ms = 20_000): Promise<void> {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 5));
  expect(check()).toBe(true);
}

function sendAssets(worker: FakeWorker): void {
  const assets = testAssets();
  worker.postMessage({ type: 'assets', sqlWasm: assets.sqlWasm, fonts: assets.fonts }, [assets.sqlWasm, ...Object.values(assets.fonts)]);
}

describe('core worker with real transfer semantics', () => {
  it('requests, a cancel and a control that arrive before the assets wait for the boot; the core boots once', async () => {
    const { worker, fromCore } = transferringWorker();
    const server = serveStorage(worker, new MemoryStorage());
    disposers.push(() => server.dispose());

    // Straight to the worker: the client would hold these back until `ready`.
    worker.postMessage({ type: 'request', id: 101, method: 'GET', url: '/api/health', headers: {} }, []);
    worker.postMessage({ type: 'request', id: 102, method: 'GET', url: '/api/server/info', headers: {} }, []);
    worker.postMessage({ type: 'cancel', id: 102 }, []);
    worker.postMessage({ type: 'control', id: 103, action: 'flushAll' }, []);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(fromCore).toEqual([]);

    sendAssets(worker);
    worker.postMessage({ type: 'request', id: 104, method: 'GET', url: '/api/auth/accounts', headers: {} }, []);
    sendAssets(worker); // ignored: the core boots once

    await until(() => fromCore.some((m) => m.type === 'control-result') && fromCore.some((m) => m.type === 'response' && m.id === 104));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fromCore.filter((m) => m.type === 'event' && m.name === 'ready')).toHaveLength(1);
    expect(fromCore.filter((m) => m.type === 'event' && m.name === 'fatal')).toEqual([]);
    const answered = fromCore.filter((m) => m.type === 'response').map((m) => [m.id, m.status]);
    expect(answered.sort()).toEqual([
      [101, 200],
      [104, 200],
    ]);
    expect(fromCore.find((m) => m.type === 'control-result')).toMatchObject({ id: 103, ok: true });
  }, 60_000);

  it('binary answers and uploads cross the channel with detached buffers while other requests run', async () => {
    const { worker } = transferringWorker();
    const storage = new MemoryStorage();
    const client = createCoreClient(worker, { readyTimeoutMs: 0 });
    const server = serveStorage(worker, storage);
    disposers.push(() => {
      client.dispose();
      server.dispose();
    });
    client.sendAssets(testAssets());
    await client.ready;

    const registered = await client.coreFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'he' },
      body: JSON.stringify({ firstName: 'דנה', lastName: 'כהן', username: 'dana', email: 'dana@example.test', password: PASSWORD, confirmPassword: PASSWORD, rememberMe: true, deviceName: 'Phone' }),
    });
    expect(registered.status).toBe(201);
    const auth = (await registered.json()) as AuthResponse;
    const headers = { 'content-type': 'application/json', 'accept-language': 'he', authorization: `Bearer ${auth.token}` };

    const writes = Array.from({ length: 12 }, (_, i) => client.coreFetch('/api/entries', { method: 'POST', headers, body: JSON.stringify(entryInput(i)) }));
    const exports = ['pdf', 'txt', 'csv', 'json', 'pdf'].map((format) => client.coreFetch('/api/export', { method: 'POST', headers, body: JSON.stringify({ format }) }));
    const backups = [0, 1].map(() => client.coreFetch('/api/backup/create', { method: 'POST', headers, body: '{}' }));
    const answers = await Promise.all([...writes, ...exports, ...backups]);
    expect(answers.slice(0, 12).map((a) => a.status)).toEqual(Array(12).fill(201));
    expect(answers.slice(12).map((a) => a.status)).toEqual(Array(7).fill(200));

    for (const index of [12, 16]) {
      const pdf = new Uint8Array(await answers[index].arrayBuffer());
      expect(answers[index].headers.get('content-type')).toBe('application/pdf');
      expect(pdf.byteLength).toBe(Number(answers[index].headers.get('content-length')));
      expect(new TextDecoder('latin1').decode(pdf.subarray(0, 5))).toBe('%PDF-');
    }
    const backup = new Uint8Array(await answers[18].arrayBuffer());
    expect(backup.byteLength).toBe(Number(answers[18].headers.get('content-length')));
    expect(backup.byteLength).toBeGreaterThan(1000);

    // Uploads: a Blob body and a typed-array body (the caller's bytes stay usable: a copy travels).
    const body = JSON.stringify({ fileBase64: Buffer.from(backup).toString('base64'), fileName: 'b.mpd', password: PASSWORD });
    const inspected = await client.coreFetch('/api/backup/inspect', { method: 'POST', headers, body: new Blob([body], { type: 'application/json' }) });
    expect(inspected.status).toBe(200);
    expect(await inspected.json()).toMatchObject({ valid: true, sizeBytes: backup.byteLength });
    const typed = new TextEncoder().encode(body);
    const restored = await client.coreFetch('/api/backup/restore', { method: 'POST', headers, body: typed });
    expect(restored.status).toBe(200);
    expect(typed.byteLength).toBe(new TextEncoder().encode(body).byteLength);

    // The core is intact after all those transfers: the diary answers and a second export works.
    const list = await client.coreFetch('/api/entries?limit=1', { method: 'GET', headers });
    expect(((await list.json()) as { total: number }).total).toBeGreaterThan(0);
    const again = await client.coreFetch('/api/export', { method: 'POST', headers, body: JSON.stringify({ format: 'pdf' }) });
    expect(again.status).toBe(200);
    expect(new TextDecoder('latin1').decode(new Uint8Array(await again.arrayBuffer()).subarray(0, 5))).toBe('%PDF-');
    await client.control('flushAll');
    expect([...storage.files().keys()].filter((name) => !name.endsWith('.prev')).sort()).toEqual(['accounts.json', 'device.key', 'sessions.json', `users/${auth.user.id}.mpd`]);
  }, 120_000);
});
