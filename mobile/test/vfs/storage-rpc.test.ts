// @vitest-environment node
/**
 * The worker <-> main-thread storage RPC: mobile/core/vfs/rpc-backend.ts (worker side) and
 * mobile/host/storage-rpc.ts (main-thread side) with the messages of
 * mobile/shared/storage-protocol.ts - request ids, transferred buffers, errors with their codes,
 * the timeout, strict ordering, and living on a channel that also carries the host <-> core
 * protocol. (That a VFS works through it is covered by the other suites: the RPC is one of the
 * storage kinds they all run against.)
 */
import { describe, expect, it } from 'vitest';
import { createRpcStorage, DEFAULT_STORAGE_TIMEOUT_MS } from '../../core/vfs/rpc-backend';
import fs, { installVfs } from '../../core/vfs/node-fs';
import { Vfs } from '../../core/vfs/vfs';
import { serveStorage } from '../../host/storage-rpc';
import { MemoryStorage } from '../../host/storage/memory';
import {
  STORAGE_ERROR_CODES,
  STORAGE_OPS,
  StorageError,
  isStorageRpcRequest,
  isStorageRpcResponse,
  storageTransferList,
  toStorageError,
  type StorageBackend,
  type StorageEntry,
  type StoragePort,
  type StorageRpcRequest,
  type StorageRpcResponse,
  type StorageStat,
} from '../../shared/storage-protocol';
import { isCoreMessage, isHostMessage } from '../../shared/transport';
import { bytesOf, patternBytes, portPair, text } from './helpers';

/** A memory backend whose calls can be held back and released by the test. */
class GatedStorage implements StorageBackend {
  readonly started: string[] = [];
  readonly finished: string[] = [];
  private readonly gates = new Map<string, () => void>();

  constructor(readonly inner: MemoryStorage = new MemoryStorage()) {}

  /** The next call for `path` waits until `release(path)`. */
  hold(path: string): void {
    this.gates.set(path, () => undefined);
  }

  release(path: string): void {
    const open = this.gates.get(path);
    this.gates.delete(path);
    open?.();
  }

  private async run<T>(label: string, path: string, action: () => Promise<T>): Promise<T> {
    this.started.push(label);
    if (this.gates.has(path)) {
      await new Promise<void>((resolve) => this.gates.set(path, resolve));
    }
    const result = await action();
    this.finished.push(label);
    return result;
  }

  list(dir: string): Promise<StorageEntry[]> {
    return this.run(`list ${dir}`, dir, () => this.inner.list(dir));
  }
  read(path: string): Promise<Uint8Array> {
    return this.run(`read ${path}`, path, () => this.inner.read(path));
  }
  write(path: string, bytes: Uint8Array): Promise<void> {
    return this.run(`write ${path}`, path, () => this.inner.write(path, bytes));
  }
  rename(from: string, to: string): Promise<void> {
    return this.run(`rename ${from}`, from, () => this.inner.rename(from, to));
  }
  remove(path: string): Promise<void> {
    return this.run(`remove ${path}`, path, () => this.inner.remove(path));
  }
  mkdir(path: string): Promise<void> {
    return this.run(`mkdir ${path}`, path, () => this.inner.mkdir(path));
  }
  stat(path: string): Promise<StorageStat | null> {
    return this.run(`stat ${path}`, path, () => this.inner.stat(path));
  }
}

function connect(backend: StorageBackend = new MemoryStorage(), timeoutMs = 0) {
  const { worker, host } = portPair();
  const server = serveStorage(host, backend);
  const client = createRpcStorage(worker, { timeoutMs });
  return { worker, host, server, client };
}

const tick = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function failure(promise: Promise<unknown>): Promise<StorageError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(StorageError);
    return e as StorageError;
  }
  throw new Error('expected the call to fail');
}

describe('storage RPC: messages', () => {
  it('every call is one request with its own id, answered by the response with that id', async () => {
    const { worker, host, client } = connect();
    await client.mkdir('users');
    await client.write('users/u.mpd', bytesOf('diary'));
    await client.rename('users/u.mpd', 'users/v.mpd');
    expect(await client.stat('users/v.mpd')).toMatchObject({ type: 'file', size: 5 });
    expect((await client.list('users')).map((e) => e.name)).toEqual(['v.mpd']);
    expect(text(await client.read('users/v.mpd'))).toBe('diary');
    await client.remove('users/v.mpd');
    expect(await client.stat('users/v.mpd')).toBeNull();

    const requests = worker.posted as StorageRpcRequest[];
    expect(requests.map((r) => r.op)).toEqual(['mkdir', 'write', 'rename', 'stat', 'list', 'read', 'remove', 'stat']);
    expect(requests.every((r) => r.type === 'storage-request')).toBe(true);
    expect(requests.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(requests[2]).toMatchObject({ path: 'users/u.mpd', to: 'users/v.mpd' });
    const responses = host.posted as StorageRpcResponse[];
    expect(responses.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(responses.every((r) => r.type === 'storage-response' && r.ok)).toBe(true);
    // Every message on the wire passes the shape checks of the protocol.
    expect(requests.every(isStorageRpcRequest)).toBe(true);
    expect(responses.every(isStorageRpcResponse)).toBe(true);
  });

  it('bytes travel as transferred buffers; a write gives away a copy, never the caller\'s array', async () => {
    const { worker, host, client } = connect();
    const mine = patternBytes(4096, 5);
    // A view into a larger buffer: only its own bytes may travel.
    const view = new Uint8Array(new ArrayBuffer(100), 10, 20).fill(7);
    await client.write('a.bin', mine);
    await client.write('b.bin', view);
    expect(mine.byteLength).toBe(4096);
    expect(Buffer.from(mine).equals(Buffer.from(patternBytes(4096, 5)))).toBe(true);
    expect(view.buffer.byteLength).toBe(100);

    const [first, second] = worker.posted as StorageRpcRequest[];
    expect(worker.transfers[0]).toEqual([first.bytes]);
    // Transferred: the worker's end of the buffer is detached, the main thread got it without a copy.
    expect((first.bytes as ArrayBuffer).byteLength).toBe(0);
    expect(worker.transfers[1]).toHaveLength(1);
    expect((second.bytes as ArrayBuffer).byteLength).toBe(0);

    const back = await client.read('a.bin');
    expect(Buffer.from(back).equals(Buffer.from(mine))).toBe(true);
    expect((await client.read('b.bin')).byteLength).toBe(20);
    const readAnswer = (host.posted as StorageRpcResponse[]).find((r) => r.ok && r.bytes !== undefined);
    expect(readAnswer).toBeDefined();
    expect(host.transfers.filter((list) => list.length === 1)).toHaveLength(2);
    // Messages without bytes transfer nothing.
    expect(worker.transfers.slice(2).every((list) => list.length === 0)).toBe(true);
  });

  it('an empty file and an empty directory listing make the round trip', async () => {
    const { client } = connect();
    await client.mkdir('empty-dir');
    await client.write('empty', new Uint8Array(0));
    expect((await client.read('empty')).byteLength).toBe(0);
    expect(await client.list('empty-dir')).toEqual([]);
  });
});

describe('storage RPC: errors', () => {
  it('a backend error arrives as a StorageError with the same code and message', async () => {
    const { client } = connect();
    await client.mkdir('dir');
    await client.write('file', bytesOf('x'));
    expect((await failure(client.read('missing'))).code).toBe('ENOENT');
    expect((await failure(client.read('dir'))).code).toBe('EISDIR');
    expect((await failure(client.list('file'))).code).toBe('ENOTDIR');
    expect((await failure(client.mkdir('file'))).code).toBe('EEXIST');
    expect((await failure(client.write('../escape', bytesOf('x')))).code).toBe('EINVAL');
    const error = await failure(client.rename('missing', 'other'));
    expect(error.code).toBe('ENOENT');
    expect(error.message).toMatch(/^ENOENT: /);
    expect(error.name).toBe('StorageError');
  });

  it('every protocol error code crosses the channel; anything else becomes EIO', async () => {
    for (const code of STORAGE_ERROR_CODES) {
      const backend = new MemoryStorage();
      backend.stat = async () => {
        throw new StorageError(code, `${code}: made up`);
      };
      const { client } = connect(backend);
      expect((await failure(client.stat('x'))).code).toBe(code);
    }
    const odd = new MemoryStorage();
    odd.stat = async () => {
      throw Object.assign(new Error('the plugin exploded'), { code: 'OS-PLUG-FILE-0099' });
    };
    odd.read = async () => {
      throw 'a string, not an Error';
    };
    const { client } = connect(odd);
    const unknown = await failure(client.stat('x'));
    expect(unknown.code).toBe('EIO');
    expect(unknown.message).toBe('the plugin exploded');
    expect((await failure(client.read('x'))).code).toBe('EIO');
    expect(toStorageError(new StorageError('EACCES', 'kept'))).toMatchObject({ code: 'EACCES', message: 'kept' });
  });

  it('a failed call does not disturb the calls after it', async () => {
    const { client } = connect();
    const results = await Promise.allSettled([client.read('nope'), client.write('ok', bytesOf('fine')), client.read('ok')]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'fulfilled', 'fulfilled']);
    expect(text((results[2] as PromiseFulfilledResult<Uint8Array>).value)).toBe('fine');
  });

  it('a channel that cannot be posted to fails the call with EIO', async () => {
    const dead: StoragePort = {
      postMessage: () => {
        throw new Error('the worker was terminated');
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    const error = await failure(createRpcStorage(dead).stat('x'));
    expect(error.code).toBe('EIO');
    expect(error.message).toMatch(/cannot be reached \(stat 'x'\)/);
  });
});

describe('storage RPC: timeout', () => {
  it('has a default of 30 seconds', () => {
    expect(DEFAULT_STORAGE_TIMEOUT_MS).toBe(30_000);
  });

  it('a call that is not answered in time rejects with ETIMEDOUT; the late answer is ignored', async () => {
    const backend = new GatedStorage();
    const { client } = connect(backend, 40);
    backend.hold('slow.bin');
    const error = await failure(client.write('slow.bin', bytesOf('late')));
    expect(error.code).toBe('ETIMEDOUT');
    expect(error.message).toMatch(/did not answer in time \(write 'slow\.bin'\)/);
    // The main thread finishes the call eventually; nothing waits for it and nothing breaks.
    backend.release('slow.bin');
    await tick(5);
    expect(text(await client.read('slow.bin'))).toBe('late');
  });

  it('a call sent after a timed-out one cannot overtake it on the main thread', async () => {
    const backend = new GatedStorage();
    const { client } = connect(backend, 40);
    await client.write('a', bytesOf('first'));
    backend.hold('a.tmp-1');
    const slow = client.write('a.tmp-1', bytesOf('second'));
    // Sent while the write is still running there.
    const cleanup = client.remove('a.tmp-1');
    expect((await failure(slow)).code).toBe('ETIMEDOUT');
    expect(backend.started).toEqual(['write a', 'write a.tmp-1']);
    backend.release('a.tmp-1');
    await cleanup.catch(() => undefined);
    await tick(5);
    // The removal ran AFTER the late write: no stray temporary file is left.
    expect(backend.finished).toEqual(['write a', 'write a.tmp-1', 'remove a.tmp-1']);
    expect(backend.inner.paths()).toEqual(['a']);
  });

  it('an answer that never comes times out as well; with timeoutMs 0 a call waits', async () => {
    const { worker, host } = portPair();
    serveStorage(host, new MemoryStorage());
    host.silent = true;
    const impatient = createRpcStorage(worker, { timeoutMs: 30 });
    expect((await failure(impatient.stat('x'))).code).toBe('ETIMEDOUT');
    const patient = createRpcStorage(worker, { timeoutMs: 0 });
    const outcome = await Promise.race([patient.stat('x').then(() => 'answered'), tick(80).then(() => 'still waiting')]);
    expect(outcome).toBe('still waiting');
  });

  it('the VFS reports a timed-out write like any failed write and stores the file on the next drain', async () => {
    const backend = new GatedStorage();
    const { client } = connect(backend, 40);
    const logs: string[] = [];
    const vfs = new Vfs({ backend: client, log: (level, message) => logs.push(`${level}: ${message}`) });
    installVfs(vfs);
    await vfs.boot();
    backend.hold('sessions.json.tmp-1');
    fs.writeFileSync('/data/sessions.json', '{"v":1}');
    const drained = vfs.drain();
    // Let the call time out, then let the main thread go on.
    await tick(60);
    backend.release('sessions.json.tmp-1');
    await expect(drained).rejects.toMatchObject({ code: 'EIO' });
    expect(logs.join('\n')).toMatch(/ETIMEDOUT/);
    await vfs.drain();
    expect(text(backend.inner.files().get('sessions.json') as Uint8Array)).toBe('{"v":1}');
    expect(backend.inner.paths()).toEqual(['sessions.json']);
    installVfs(new Vfs());
  });

  it('a rename that timed out in the worker but still ran on the main thread cannot bring a deleted diary back', async () => {
    const backend = new GatedStorage();
    const { client } = connect(backend, 40);
    const logs: string[] = [];
    const vfs = new Vfs({ backend: client, log: (level, message) => logs.push(`${level}: ${message}`) });
    installVfs(vfs);
    await vfs.boot();
    const file = '/data/users/u_1.mpd';
    // The diary save of security/vault.ts: .mpd.tmp, .mpd -> .mpd.prev, .mpd.tmp -> .mpd.
    const save = async (content: string): Promise<void> => {
      const handle = await fs.promises.open(`${file}.tmp`, 'w', 0o600);
      await handle.writeFile(content);
      await handle.sync();
      await handle.close();
      if (fs.existsSync(file)) await fs.promises.rename(file, `${file}.prev`);
      await fs.promises.rename(`${file}.tmp`, file);
    };
    try {
      fs.mkdirSync('/data/users');
      await save('v1');
      await save('v2');
      expect(backend.inner.paths()).toEqual(['users', 'users/u_1.mpd', 'users/u_1.mpd.prev']);

      // Save 3 has to move the old .prev aside first. The main thread is busy for longer than the
      // worker waits: the call times out there - and is carried out afterwards all the same.
      backend.hold('users/u_1.mpd.prev');
      await expect(save('v3')).rejects.toMatchObject({ code: 'EIO', syscall: 'rename' });
      expect(logs.join('\n')).toMatch(/ETIMEDOUT/);
      backend.release('users/u_1.mpd.prev');
      await tick(5);
      expect(backend.inner.paths()).toEqual(['users', 'users/u_1.mpd', expect.stringMatching(/^users\/u_1\.mpd\.prev\.old-\d+$/), 'users/u_1.mpd.tmp']);

      // The vault's retry and the drain before the answer: everything is stored, the stray copy is gone.
      await save('v3');
      await vfs.drain();
      expect(vfs.outOfSync()).toEqual([]);
      expect(backend.inner.paths()).toEqual(['users', 'users/u_1.mpd', 'users/u_1.mpd.prev']);
      expect(text(backend.inner.files().get('users/u_1.mpd') as Uint8Array)).toBe('v3');
      expect(text(backend.inner.files().get('users/u_1.mpd.prev') as Uint8Array)).toBe('v2');

      // The account is deleted; the app is started again.
      for (const path of [file, `${file}.prev`, `${file}.tmp`]) await fs.promises.rm(path, { force: true });
      await vfs.drain();
      expect(backend.inner.paths()).toEqual(['users']);
      const again = new Vfs({ backend: client, log: () => undefined });
      installVfs(again);
      await again.boot();
      expect(fs.readdirSync('/data/users')).toEqual([]);
    } finally {
      installVfs(new Vfs());
    }
  });
});

describe('storage RPC: order and lifetime', () => {
  it('the main thread runs the calls strictly one after the other, in the order they arrived', async () => {
    const backend = new GatedStorage();
    const { client } = connect(backend);
    backend.hold('one');
    const calls = [client.write('one', bytesOf('1')), client.write('two', bytesOf('2')), client.rename('two', 'three'), client.list('')];
    await tick(5);
    // Nothing started behind the call that is still running.
    expect(backend.started).toEqual(['write one']);
    backend.release('one');
    const results = await Promise.all(calls);
    expect(backend.finished).toEqual(['write one', 'write two', 'rename two', 'list ']);
    expect((results[3] as StorageEntry[]).map((e) => e.name)).toEqual(['one', 'three']);
  });

  it('dispose() on the worker side rejects pending and later calls and stops listening', async () => {
    const backend = new GatedStorage();
    const { worker, client } = connect(backend);
    backend.hold('x');
    const pending = client.write('x', bytesOf('x'));
    await tick(1);
    client.dispose();
    client.dispose();
    expect((await failure(pending)).code).toBe('EIO');
    const later = await failure(client.stat('x'));
    expect(later.code).toBe('EIO');
    expect(later.message).toMatch(/connection is closed/);
    expect(worker.listenerCount).toBe(0);
    backend.release('x');
  });

  it('dispose() on the main-thread side stops answering and stops listening', async () => {
    const { host, server, client } = connect(new MemoryStorage(), 30);
    await client.mkdir('a');
    server.dispose();
    expect(host.listenerCount).toBe(0);
    expect((await failure(client.mkdir('b'))).code).toBe('ETIMEDOUT');
  });

  it('two connections on separate channels to one backend see the same files', async () => {
    const backend = new MemoryStorage();
    const one = connect(backend).client;
    const two = connect(backend).client;
    await one.write('shared', bytesOf('same'));
    expect(text(await two.read('shared'))).toBe('same');
  });
});

describe('storage RPC: on a channel shared with the host <-> core protocol', () => {
  it('each side ignores what is not a storage message', async () => {
    const backend = new GatedStorage();
    const { worker, host, client } = connect(backend);
    // What src/api/client.ts sends to the core, and what the core answers.
    host.deliver({ type: 'request', id: 1, method: 'GET', url: '/api/health', headers: {} });
    host.deliver({ type: 'control', id: 2, action: 'flushAll' });
    host.deliver(null);
    host.deliver('storage-request');
    worker.deliver({ type: 'response', id: 1, status: 200, headers: {}, bodyText: '{}' });
    worker.deliver({ type: 'event', name: 'ready', protocol: 1 });
    worker.deliver(undefined);
    await tick(1);
    expect(backend.started).toEqual([]);
    expect(host.posted).toEqual([]);
    // An answer with an id nobody waits for, and a malformed one, change nothing.
    worker.deliver({ type: 'storage-response', id: 999, ok: true });
    worker.deliver({ type: 'storage-response', id: 1, ok: 'yes' });
    await client.write('still-works', bytesOf('ok'));
    expect(text(await client.read('still-works'))).toBe('ok');
  });

  it('the core protocol ignores storage messages in turn', () => {
    const request: StorageRpcRequest = { type: 'storage-request', id: 1, op: 'stat', path: 'x' };
    const response: StorageRpcResponse = { type: 'storage-response', id: 1, ok: true, stat: null };
    expect(isHostMessage(request)).toBe(false);
    expect(isHostMessage(response)).toBe(false);
    expect(isCoreMessage(request)).toBe(false);
    expect(isCoreMessage(response)).toBe(false);
  });

  it('a malformed storage request is not executed', async () => {
    const backend = new GatedStorage();
    const { host } = connect(backend);
    for (const bad of [
      { type: 'storage-request', id: 1, op: 'format', path: '' },
      { type: 'storage-request', id: 1.5, op: 'stat', path: 'x' },
      { type: 'storage-request', id: 2, op: 'stat' },
      { type: 'storage-request', id: 3, op: 'rename', path: 'a' },
      { type: 'storage-request', id: 4, op: 'write', path: 'a', bytes: [1, 2, 3] },
      { type: 'storage-request', op: 'stat', path: 'x' },
    ]) {
      host.deliver(bad);
    }
    await tick(1);
    expect(backend.started).toEqual([]);
    expect(host.posted).toEqual([]);
  });
});

describe('storage protocol: shape checks', () => {
  it('accepts every operation and rejects incomplete requests', () => {
    for (const op of STORAGE_OPS) {
      const request = { type: 'storage-request', id: 7, op, path: 'p', to: 'q', bytes: new ArrayBuffer(1) };
      expect(isStorageRpcRequest(request), op).toBe(true);
    }
    expect(isStorageRpcRequest({ type: 'storage-request', id: 7, op: 'write', path: 'p' })).toBe(false);
    expect(isStorageRpcRequest({ type: 'storage-request', id: 7, op: 'rename', path: 'p' })).toBe(false);
    expect(isStorageRpcRequest({ type: 'request', id: 7, op: 'stat', path: 'p' })).toBe(false);
    expect(isStorageRpcRequest(null)).toBe(false);
  });

  it('accepts well-formed responses and rejects the rest', () => {
    const stat: StorageStat = { type: 'file', size: 3, mtimeMs: 1 };
    expect(isStorageRpcResponse({ type: 'storage-response', id: 1, ok: true })).toBe(true);
    expect(isStorageRpcResponse({ type: 'storage-response', id: 1, ok: true, stat })).toBe(true);
    expect(isStorageRpcResponse({ type: 'storage-response', id: 1, ok: true, stat: null })).toBe(true);
    expect(isStorageRpcResponse({ type: 'storage-response', id: 1, ok: true, entries: [{ ...stat, name: 'a' }] })).toBe(true);
    expect(isStorageRpcResponse({ type: 'storage-response', id: 1, ok: true, bytes: new ArrayBuffer(0) })).toBe(true);
    expect(isStorageRpcResponse({ type: 'storage-response', id: 1, ok: false, code: 'ENOENT', message: 'gone' })).toBe(true);
    expect(isStorageRpcResponse({ type: 'storage-response', id: 1, ok: false, code: 'EWHATEVER', message: 'x' })).toBe(false);
    expect(isStorageRpcResponse({ type: 'storage-response', id: 1, ok: false, code: 'ENOENT' })).toBe(false);
    expect(isStorageRpcResponse({ type: 'storage-response', id: 1, ok: true, entries: [{ name: 'a' }] })).toBe(false);
    expect(isStorageRpcResponse({ type: 'storage-response', id: 1, ok: true, bytes: new Uint8Array(1) })).toBe(false);
    expect(isStorageRpcResponse({ type: 'storage-response', id: 1, ok: true, stat: { type: 'link', size: 1, mtimeMs: 1 } })).toBe(false);
    expect(isStorageRpcResponse({ type: 'storage-response', id: '1', ok: true })).toBe(false);
  });

  it('a Worker and a MessagePort can be used as the channel as they are (checked by the compiler)', () => {
    const asPort = (port: StoragePort): StoragePort => port;
    // The host serves on the core worker itself; a dedicated MessageChannel works too.
    const ends = (worker: Worker, port: MessagePort): StoragePort[] => [asPort(worker), asPort(port)];
    expect(ends).toBeTypeOf('function');
  });

  it('the transfer list is the buffer of the message, if it has one', () => {
    const bytes = new ArrayBuffer(4);
    expect(storageTransferList({ type: 'storage-request', id: 1, op: 'write', path: 'p', bytes })).toEqual([bytes]);
    expect(storageTransferList({ type: 'storage-request', id: 1, op: 'stat', path: 'p' })).toEqual([]);
    expect(storageTransferList({ type: 'storage-response', id: 1, ok: true, bytes })).toEqual([bytes]);
    expect(storageTransferList({ type: 'storage-response', id: 1, ok: false, code: 'EIO', message: 'm' })).toEqual([]);
  });
});

describe('storage RPC over a real MessageChannel', () => {
  it('a VFS in "the worker" stores and reloads a diary through real ports', async () => {
    const backend = new MemoryStorage();
    const channel = new MessageChannel();
    // A port used with addEventListener must be started by whoever created it.
    channel.port1.start();
    channel.port2.start();
    const server = serveStorage(channel.port2, backend);
    const client = createRpcStorage(channel.port1, { timeoutMs: 10_000 });
    try {
      const vfs = new Vfs({ backend: client, log: () => undefined });
      installVfs(vfs);
      await vfs.boot();
      const diary = patternBytes(1024 * 1024 + 3, 42);
      fs.mkdirSync('/data/users', { recursive: true });
      fs.writeFileSync('/data/users/u.mpd', diary);
      fs.writeFileSync('/data/accounts.json', '{"accounts":[]}');
      await vfs.drain();
      expect(backend.paths()).toEqual(['accounts.json', 'users', 'users/u.mpd']);
      expect(Buffer.from(backend.files().get('users/u.mpd') as Uint8Array).equals(Buffer.from(diary))).toBe(true);
      // The mirror kept its own bytes although the copy was transferred away.
      expect((fs.readFileSync('/data/users/u.mpd') as Buffer).byteLength).toBe(diary.byteLength);

      const again = new Vfs({ backend: client, log: () => undefined });
      installVfs(again);
      await again.boot();
      expect(Buffer.from(fs.readFileSync('/data/users/u.mpd') as Buffer).equals(Buffer.from(diary))).toBe(true);
      expect(fs.readFileSync('/data/accounts.json', 'utf8')).toBe('{"accounts":[]}');
      await expect(fs.promises.readFile('/data/missing')).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      client.dispose();
      server.dispose();
      channel.port1.close();
      channel.port2.close();
      installVfs(new Vfs());
    }
  });
});
