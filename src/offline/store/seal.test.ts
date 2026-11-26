/**
 * The 401 purge's seal (./seal.ts), the same in both stores: from the moment the purge transaction is
 * created, a write into `cache`, `journal`, `idmap` or a sealed `meta` row is a silent no-op and a read
 * of them answers as for an empty store, while the outbox, the notes and the other `meta` rows go on -
 * in one transaction that touches both kinds too - until `close()`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { freshIndexedDb } from '../test-utils/env';
import { openAccountStore, openExistingAccountStore, setIdbFactory } from './idb';
import { MemoryStore } from './memory';
import type { SealSpec } from './seal';
import type { CacheRow, OfflineStore, OutboxRow } from './types';

const SEAL: SealSpec = { stores: ['cache', 'journal', 'idmap'], metaRows: ['snapshot', 'wrappedKey'] };
const USER = 'u_5ea15ea15ea15ea1';

const bytes = () => new Uint8Array([1, 2, 3]);
const cacheRow = (key: string): CacheRow => ({ key, cls: 'c', cachedAt: 1, lastUsed: 1, bytes: 3, ct: bytes() });
const outboxRow = (rid: string): OutboxRow => ({ rid, sealed: false, chainTag: 't', deps: [], attempts: 0, nextAt: 0, ct: bytes() });

type Counts = { outbox: number; cache: number; journal: number; idmap: number; meta: string[] };

async function counts(store: OfflineStore): Promise<Counts> {
  return store.tx(['outbox', 'notes', 'cache', 'journal', 'idmap', 'meta'], 'readonly', async (t) => ({
    outbox: await t.count('outbox'),
    cache: await t.count('cache'),
    journal: await t.count('journal'),
    idmap: await t.count('idmap'),
    meta: (await t.getAll('meta')).map((r) => r.name).sort(),
  }));
}

/** The memory store's tables as they really are: read past the seal, never through the sealed connection. */
function rawCounts(store: MemoryStore): Counts {
  return {
    outbox: store.__rowsForTests('outbox').length,
    cache: store.__rowsForTests('cache').length,
    journal: store.__rowsForTests('journal').length,
    idmap: store.__rowsForTests('idmap').length,
    meta: store.__rowsForTests('meta').map((r) => r.name).sort(),
  };
}

/** The purge as the engine runs it: clear what it seals, in the transaction that carries the seal. */
function purge(store: OfflineStore): Promise<void> {
  return store.tx(['cache', 'journal', 'idmap', 'meta'], 'readwrite', async (t) => {
    for (const s of SEAL.stores) await t.clear(s);
    for (const name of SEAL.metaRows) await t.delete('meta', name);
  }, { seal: SEAL });
}

/** `atRest` reads what is really stored, never through the connection that carries the seal. */
const KINDS: [string, () => Promise<{ store: OfflineStore; atRest: () => Promise<Counts> }>][] = [
  [
    'IndexedDB',
    async () => {
      setIdbFactory(freshIndexedDb());
      const { store } = await openAccountStore(USER);
      return {
        store,
        atRest: async () => {
          const other = await openExistingAccountStore(USER);
          try {
            return await counts(other!);
          } finally {
            other!.close();
          }
        },
      };
    },
  ],
  [
    'memory',
    async () => {
      const store = new MemoryStore();
      return { store, atRest: async () => rawCounts(store) };
    },
  ],
];

describe.each(KINDS)('the seal of the sensitive stores (%s)', (_kind, make) => {
  afterEach(() => setIdbFactory(null));

  it('a write that starts after the purge transaction was created: the outbox part commits, the sensitive part never lands', async () => {
    const { store, atRest } = await make();
    await store.tx(['cache', 'meta', 'outbox'], 'readwrite', async (t) => {
      await t.put('cache', cacheRow('old'));
      await t.put('meta', { name: 'snapshot', value: bytes() });
      await t.put('meta', { name: 'keyCheck', value: bytes() });
      await t.put('outbox', outboxRow('before'));
    });
    const purged = purge(store); // created now: the seal holds from here, before the purge has run
    const mixed = store.tx(['outbox', 'idmap', 'meta'], 'readwrite', async (t) => {
      const seq = await t.put('outbox', outboxRow('after'));
      const local = await t.put('idmap', { localId: -1, ct: bytes() });
      await t.put('meta', { name: 'wrappedKey', value: 'blob' });
      await t.put('meta', { name: 'nextLocalId', value: -2 });
      return { seq, local };
    });
    const late = [
      store.tx(['cache'], 'readwrite', (t) => t.put('cache', cacheRow('late'))),
      store.tx(['journal'], 'readwrite', (t) => t.put('journal', { opId: 'op', appliedAt: 1, ct: bytes() })),
      store.tx(['meta'], 'readwrite', (t) => t.put('meta', { name: 'snapshot', value: bytes() })),
    ];
    await purged;
    // A sealed write resolves (with the row's key): its caller is not told "not saved".
    expect(await mixed).toEqual({ seq: 2, local: -1 });
    await expect(Promise.all(late)).resolves.toEqual(['late', 'op', 'snapshot']);
    // What this connection reads of a sealed store is what is at rest: nothing.
    expect(await store.tx(['cache', 'meta'], 'readonly', async (t) => ({ row: await t.get('cache', 'late'), all: await t.getAll('cache'), snap: await t.get('meta', 'snapshot') }))).toEqual({ row: undefined, all: [], snap: undefined });
    expect(await atRest()).toEqual({ outbox: 2, cache: 0, journal: 0, idmap: 0, meta: ['keyCheck', 'nextLocalId'] });
    // The connection stays open for the outbox and the notes until close().
    await store.tx(['notes'], 'readwrite', (t) => t.put('notes', { rid: 'n', createdAt: 1, ct: bytes() }));
    expect(await store.tx(['notes', 'outbox'], 'readonly', async (t) => [await t.count('notes'), await t.count('outbox')])).toEqual([1, 2]);
    store.close();
    await expect(store.tx(['outbox'], 'readonly', (t) => t.count('outbox'))).rejects.toThrow(/closed/);
  });

  it('a write whose transaction was created BEFORE the purge is deleted by it', async () => {
    const { store, atRest } = await make();
    const before = store.tx(['cache', 'outbox'], 'readwrite', async (t) => {
      await t.put('cache', cacheRow('before'));
      await t.put('outbox', outboxRow('kept'));
    });
    await purge(store);
    await before;
    expect(await atRest()).toMatchObject({ outbox: 1, cache: 0 });
    store.close();
  });

  it('a transaction created BEFORE the purge that reads a sealed row after the seal was armed reads nothing', async () => {
    const { store } = await make();
    await store.tx(['cache', 'meta'], 'readwrite', async (t) => {
      await t.put('cache', cacheRow('old'));
      await t.put('meta', { name: 'snapshot', value: bytes() });
    });
    // Created first, so it runs before the purge - while the rows are still stored - but its reads are made after the seal.
    const read = store.tx(['cache', 'meta'], 'readonly', async (t) => ({ row: await t.get('cache', 'old'), snap: await t.get('meta', 'snapshot'), n: await t.count('cache') }));
    const purged = purge(store);
    expect(await read).toEqual({ row: undefined, snap: undefined, n: 0 });
    await purged;
    store.close();
  });

  it('the seal holds the tables themselves: after the purge they stay empty whatever is still written', async () => {
    const { store, atRest } = await make();
    await store.tx(['cache', 'journal'], 'readwrite', async (t) => {
      await t.put('cache', cacheRow('old'));
      await t.put('journal', { opId: 'old', appliedAt: 1, ct: bytes() });
    });
    await purge(store);
    await store.tx(['cache', 'journal', 'idmap', 'meta', 'outbox'], 'readwrite', async (t) => {
      await t.put('cache', cacheRow('late'));
      await t.put('journal', { opId: 'late', appliedAt: 1, ct: bytes() });
      await t.put('idmap', { localId: -3, ct: bytes() });
      await t.put('meta', { name: 'wrappedKey', value: 'blob' });
      await t.put('outbox', outboxRow('kept'));
    });
    expect(await atRest()).toEqual({ outbox: 1, cache: 0, journal: 0, idmap: 0, meta: [] });
    store.close();
  });

  it('a store without a seal writes every store as before', async () => {
    const { store } = await make();
    await store.tx(['cache', 'journal', 'idmap', 'meta'], 'readwrite', async (t) => {
      await t.put('cache', cacheRow('a'));
      await t.put('journal', { opId: 'op', appliedAt: 1, ct: bytes() });
      await t.put('idmap', { localId: -1, ct: bytes() });
      await t.put('meta', { name: 'snapshot', value: bytes() });
    });
    expect(await counts(store)).toEqual({ outbox: 0, cache: 1, journal: 1, idmap: 1, meta: ['snapshot'] });
    store.close();
  });
});
