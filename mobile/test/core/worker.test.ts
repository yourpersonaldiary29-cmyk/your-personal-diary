// @vitest-environment node
/**
 * The core worker (mobile/core/worker.ts) behind the real host stack: the core client
 * (mobile/host/core-client.ts) and the storage server (mobile/host/storage-rpc.ts) on one linked
 * channel (./real-worker.ts), the way mobile/host/boot.ts wires them in the app:
 *
 *   assets -> boot on the RPC storage -> ready; coreFetch requests answered as `Response`s with
 *   bytes transferred; cancel drops an answer; flushAll / lockAll / shutdown (after which the
 *   client is dead); fatal when the assets are unusable (requests then answer 503, controls fail);
 *   log events for warnings; an answer arrives only when its change is in the host's storage;
 *   `habits-changed` right after the answer; `storage-failed` / `storage-recovered`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthResponse } from '@shared/types';
import { createCoreClient, type CoreClient } from '../../host/core-client';
import { serveStorage, type StorageServer } from '../../host/storage-rpc';
import { MemoryStorage } from '../../host/storage/memory';
import type { StorageBackend } from '../../shared/storage-protocol';
import { CORE_PROTOCOL_VERSION, type CoreEvent } from '../../shared/transport';
import { FaultyStorage } from '../vfs/helpers';
import { FAST_KDF, memoryStorageOf, storageFiles, testAssets } from './helpers';
import { realCoreWorker, type RealCoreWorker } from './real-worker';

const PASSWORD = 'Passw0rd!';

interface Stack {
  worker: RealCoreWorker;
  storage: MemoryStorage;
  server: StorageServer;
  client: CoreClient;
  events: CoreEvent[];
}

const stacks: Stack[] = [];
afterEach(async () => {
  for (const stack of stacks.splice(0)) {
    // One core at a time in a process: the server code reaches its files through one global file
    // system (the VFS installed last). A core left running would go on writing - the sessions file
    // 5 s after a request, for one - into the storage of the next test.
    await stack.worker.running.booted.then((core) => core.shutdown()).catch(() => undefined);
    stack.client.dispose();
    stack.server.dispose();
  }
});

/** The host stack of boot.ts around a real core (no splash, no React). */
function stack(options: { assets?: ReturnType<typeof testAssets>; storage?: MemoryStorage; backend?: StorageBackend; storageRetryMs?: number } = {}): Stack {
  const worker = realCoreWorker({ bootOptions: { auth: { kdf: FAST_KDF }, ...(options.storageRetryMs !== undefined ? { storageRetryMs: options.storageRetryMs } : {}) } });
  const storage = options.storage ?? new MemoryStorage();
  const events: CoreEvent[] = [];
  const client = createCoreClient(worker, { readyTimeoutMs: 0, onEvent: (event) => events.push(event) });
  // `backend`: what the host serves instead (a wrapper around `storage` that injects failures).
  const server = serveStorage(worker, options.backend ?? storage);
  client.sendAssets(options.assets ?? testAssets());
  const built = { worker, storage, server, client, events };
  stacks.push(built);
  return built;
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function registerDana(client: CoreClient): Promise<AuthResponse> {
  const registered = await client.coreFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept-language': 'en' },
    body: JSON.stringify({ firstName: 'Dana', lastName: 'Cohen', username: 'dana', email: 'dana@example.test', password: PASSWORD, confirmPassword: PASSWORD, rememberMe: true, deviceName: 'Phone' }),
  });
  expect(registered.status).toBe(201);
  return json<AuthResponse>(registered);
}

const habitBody = (name: string): string => JSON.stringify({ name, description: '', target: 1, unit: 'times', frequency: 'daily', reminderEnabled: false, reminderTime: null });
const entryBody = (title: string, body = 'Fictional entry.'): string => JSON.stringify({ date: '2026-10-03', time: '10:00', title, body, mood: 4, emotions: [], events: [], people: [], tags: [] });

/** What the core posted of the host <-> core protocol, in order (the storage calls aside): 'response#7=201', 'event:ready'. */
function protocolOf(worker: RealCoreWorker): string[] {
  const out: string[] = [];
  for (const message of worker.fromCore as Array<{ type?: string; id?: number; status?: number; name?: string }>) {
    if (message.type === 'response') out.push(`response#${message.id}=${message.status}`);
    else if (message.type === 'event') out.push(`event:${message.name}`);
  }
  return out;
}

describe('core worker', () => {
  it('boots on the storage the host serves, posts ready, answers requests as Responses and persists through the RPC', async () => {
    const { client, storage, events, worker } = stack();
    await client.ready;
    expect(events.find((e) => e.name === 'ready')).toEqual({ type: 'event', name: 'ready', protocol: CORE_PROTOCOL_VERSION });
    // The boot wrote through the storage RPC: device.key is in the host's storage already.
    expect([...(await storageFiles(storage)).keys()]).toEqual(['device.key']);

    const health = await client.coreFetch('/api/health', { method: 'GET', headers: { 'accept-language': 'he' } });
    expect(health.status).toBe(200);
    expect(health.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await json<{ ok: boolean }>(health)).toMatchObject({ ok: true });

    const registered = await client.coreFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'he' },
      body: JSON.stringify({ firstName: 'דנה', lastName: 'כהן', username: 'dana', email: 'dana@example.test', password: PASSWORD, confirmPassword: PASSWORD, rememberMe: true, deviceName: 'Phone' }),
    });
    expect(registered.status).toBe(201);
    const auth = await json<AuthResponse>(registered);
    expect(auth.user.username).toBe('dana');
    // The answer was posted only after the storage had the files (over the RPC). The diary was
    // saved twice by then - created empty, then with the account's language - hence the .prev.
    expect([...(await storageFiles(storage)).keys()].sort()).toEqual(['accounts.json', 'device.key', 'sessions.json', `users/${auth.user.id}.mpd`, `users/${auth.user.id}.mpd.prev`]);

    // Bytes travel as a transferred ArrayBuffer and arrive as a binary Response.
    const pdf = await client.coreFetch('/api/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'he', authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ format: 'pdf' }),
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe('%PDF-');
    const posted = worker.fromCore.find((m) => (m as { type?: string; bodyBytes?: unknown }).type === 'response' && (m as { bodyBytes?: unknown }).bodyBytes !== undefined);
    expect(posted).toBeDefined();
  }, 60_000);

  it('requests sent before ready wait for the boot; a cancelled request gets no answer; controls run in order', async () => {
    const { client, storage, worker } = stack();
    // Not awaited: the client queues it until the core is ready.
    const early = client.coreFetch('/api/health', { method: 'GET', headers: {} });
    await client.ready;
    expect((await early).status).toBe(200);

    // Abort once the request was posted (an earlier abort rejects before anything is sent).
    const controller = new AbortController();
    const posted = worker.requests.length;
    const cancelled = client.coreFetch('/api/health', { method: 'GET', headers: {}, signal: controller.signal });
    while (worker.requests.length === posted) await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.cancels.map((c) => c.id)).toEqual([worker.requests[posted].id]);

    const guest = await client.coreFetch('/api/auth/guest', { method: 'POST', headers: { 'content-type': 'application/json', 'accept-language': 'en' }, body: '{}' });
    expect(guest.status).toBe(201);
    const token = (await json<AuthResponse>(guest)).token;
    await client.control('flushAll');
    // A guest leaves nothing in the storage, even after a flush.
    expect([...(await storageFiles(storage)).keys()]).toEqual(['device.key']);
    await client.control('lockAll');
    // Locking cannot touch a guest (nothing could unlock it): it goes on.
    const entries = await client.coreFetch('/api/entries', { method: 'GET', headers: { authorization: `Bearer ${token}` } });
    expect(entries.status).toBe(200);

    await client.control('shutdown');
    expect(worker.closed).toBe(true);
    // The worker is closed: the client answers for it at once instead of posting into the void.
    const sentSoFar = worker.posted.length;
    await expect(client.coreFetch('/api/health', { method: 'GET', headers: {} })).rejects.toMatchObject({ status: 0 });
    await expect(client.control('flushAll')).rejects.toThrow('The diary core was shut down.');
    expect(worker.posted.length).toBe(sentSoFar);
  }, 60_000);

  it('the answer of a save arrives only when the diary is in the storage the host serves: a copy taken at that moment has the entry', async () => {
    const first = stack();
    await first.client.ready;
    const auth = await registerDana(first.client);
    const headers = { 'content-type': 'application/json', authorization: `Bearer ${auth.token}` };
    const diary = `users/${auth.user.id}.mpd`;
    const sizeBefore = first.storage.files().get(diary)?.byteLength ?? 0;

    const created = await first.client.coreFetch('/api/entries', { method: 'POST', headers, body: entryBody('Through the worker', 'Fictional text. '.repeat(2500)) });
    // `files()` is synchronous: the storage at the moment the answer reached the UI.
    const atAnswer = first.storage.files();
    expect(created.status).toBe(201);
    expect(atAnswer.get(diary)?.byteLength ?? 0).toBeGreaterThan(sizeBefore + 20_000);
    // (The copy was taken before this: the shutdown flushes into the first storage only.)
    await first.client.control('shutdown');
    first.client.dispose();
    first.server.dispose();

    const second = stack({ storage: await memoryStorageOf(atAnswer) });
    await second.client.ready;
    const list = await second.client.coreFetch('/api/entries', { method: 'GET', headers });
    expect(list.status).toBe(200);
    expect((await json<{ items: Array<{ title: string }> }>(list)).items.map((e) => e.title)).toEqual(['Through the worker']);
  }, 60_000);

  it('habits-changed is posted right after the answer of its request - also when the host cancelled that request', async () => {
    const { client, worker, events } = stack();
    await client.ready;
    const auth = await registerDana(client);
    const headers = { 'content-type': 'application/json', authorization: `Bearer ${auth.token}` };

    const created = await client.coreFetch('/api/habits', { method: 'POST', headers, body: habitBody('Walk') });
    expect(created.status).toBe(201);
    const id = worker.requests[worker.requests.length - 1].id;
    const order = protocolOf(worker);
    expect(order.slice(order.indexOf(`response#${id}=201`))).toEqual([`response#${id}=201`, 'event:habits-changed']);
    await vi.waitFor(() => expect(events.filter((e) => e.name === 'habits-changed')).toHaveLength(1));

    // Cancelled while the core works on it: no answer is posted, the habit exists, the event comes.
    const controller = new AbortController();
    const posted = worker.requests.length;
    const cancelled = client.coreFetch('/api/habits', { method: 'POST', headers, body: habitBody('Swim'), signal: controller.signal });
    while (worker.requests.length === posted) await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    const cancelledId = worker.requests[posted].id;
    await vi.waitFor(() => expect(events.filter((e) => e.name === 'habits-changed')).toHaveLength(2), { timeout: 10_000 });
    expect(protocolOf(worker).some((line) => line.startsWith(`response#${cancelledId}=`))).toBe(false);
    const list = await client.coreFetch('/api/habits', { method: 'GET', headers });
    expect((await json<Array<{ name: string }>>(list)).map((h) => h.name).sort()).toEqual(['Swim', 'Walk']);
    // A read raises nothing.
    expect(events.filter((e) => e.name === 'habits-changed')).toHaveLength(2);
  }, 60_000);

  it('a storage that refuses writes: the host gets storage-failed once, reads and downloads still arrive, storage-recovered when it works again', async () => {
    const memory = new MemoryStorage();
    const faulty = new FaultyStorage(memory);
    const { client, events } = stack({ storage: memory, backend: faulty, storageRetryMs: 10 });
    await client.ready;
    const auth = await registerDana(client);
    const headers = { 'content-type': 'application/json', 'accept-language': 'en', authorization: `Bearer ${auth.token}` };
    expect((await client.coreFetch('/api/entries', { method: 'POST', headers, body: entryBody('Stored') })).status).toBe(201);
    const storageEvents = (): string[] => events.filter((e) => e.name === 'storage-failed' || e.name === 'storage-recovered').map((e) => e.name);

    faulty.failAlways('write');
    const refused = await client.coreFetch('/api/entries', { method: 'POST', headers, body: entryBody('Kept in memory') });
    expect(refused.status).toBe(500);
    expect(await json<{ code: string }>(refused)).toMatchObject({ code: 'IO' });
    await vi.waitFor(() => expect(storageEvents()).toEqual(['storage-failed']));

    const list = await client.coreFetch('/api/entries?limit=5', { method: 'GET', headers });
    expect(list.status).toBe(200);
    expect((await json<{ total: number }>(list)).total).toBe(2);
    const exported = await client.coreFetch('/api/export', { method: 'POST', headers, body: JSON.stringify({ format: 'txt' }) });
    expect(exported.status).toBe(200);
    expect(await exported.text()).toContain('Kept in memory');
    const backup = await client.coreFetch('/api/backup/create', { method: 'POST', headers, body: '{}' });
    expect(backup.status).toBe(200);
    expect((await backup.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    expect(storageEvents()).toEqual(['storage-failed']);

    faulty.repair();
    await vi.waitFor(() => expect(storageEvents()).toEqual(['storage-failed', 'storage-recovered']), { timeout: 10_000, interval: 10 });
    const atRecovery = memory.files();
    await client.control('shutdown');
    client.dispose();

    const second = stack({ storage: await memoryStorageOf(atRecovery) });
    await second.client.ready;
    const after = await second.client.coreFetch('/api/entries', { method: 'GET', headers });
    expect((await json<{ items: Array<{ title: string }> }>(after)).items.map((e) => e.title).sort()).toEqual(['Kept in memory', 'Stored']);
  }, 60_000);

  it('a second worker on the same storage finds the diary (the app restarted)', async () => {
    const first = stack();
    await first.client.ready;
    const registered = await first.client.coreFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'en' },
      body: JSON.stringify({ firstName: 'Dana', lastName: 'Cohen', username: 'dana', email: 'dana@example.test', password: PASSWORD, confirmPassword: PASSWORD, rememberMe: true }),
    });
    const auth = await json<AuthResponse>(registered);
    await first.client.control('shutdown');
    first.client.dispose();
    first.server.dispose();

    const second = stack({ storage: first.storage });
    await second.client.ready;
    const me = await second.client.coreFetch('/api/auth/me', { method: 'GET', headers: { authorization: `Bearer ${auth.token}` } });
    expect(me.status).toBe(200);
    expect((await json<{ user: { username: string } }>(me)).user.username).toBe('dana');
  }, 60_000);

  it('unusable assets: fatal instead of ready, requests answer 503 "core not ready", controls fail', async () => {
    const broken = testAssets();
    broken.sqlWasm = new ArrayBuffer(0);
    const { client, events } = stack({ assets: broken });
    await expect(client.ready).rejects.toThrow(/sql-wasm\.wasm is missing or empty/);
    expect(events.some((e) => e.name === 'fatal')).toBe(true);
    await expect(client.coreFetch('/api/health', { method: 'GET', headers: {} })).rejects.toMatchObject({ status: 0 });
    await expect(client.control('flushAll')).rejects.toThrow();
  });

  it('warnings of the VFS reach the host as log events (an unfinished temporary file cleaned up at boot)', async () => {
    const storage = new MemoryStorage();
    await storage.write('accounts.json.tmp-7', new TextEncoder().encode('{'));
    const { client, events } = stack({ storage });
    await client.ready;
    const logs = events.filter((e): e is Extract<CoreEvent, { name: 'log' }> => e.name === 'log');
    expect(logs.map((l) => [l.level, l.message])).toEqual([['warn', "removed 1 unfinished temporary file(s) in '.'"]]);
    expect([...(await storageFiles(storage)).keys()]).toEqual(['device.key']);
  });
});
