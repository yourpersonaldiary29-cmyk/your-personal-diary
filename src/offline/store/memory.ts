/**
 * In-memory implementation of `OfflineStore`: the read cache of sessions without "Remember me" (and
 * of the web), which must never reach the disk (section 4.6), and a stand-in in tests. Same
 * semantics as IndexedDB: key paths, key generators, one transaction at a time, all-or-nothing, and
 * the 401 purge's seal (./seal.ts), armed when the purge transaction is created (queued).
 */
import { StoreSeal } from './seal';
import { STORE_NAMES, STORE_SCHEMA, type OfflineStore, type RowOf, type StoreName, type StoreTx, type TxOptions } from './types';

type Table = Map<string, unknown>;

function keyString(key: IDBValidKey): string {
  return typeof key === 'number' ? `n:${key}` : `s:${String(key)}`;
}

function compareKeys(a: string, b: string): number {
  if (a.startsWith('n:') && b.startsWith('n:')) return Number(a.slice(2)) - Number(b.slice(2));
  return a < b ? -1 : a > b ? 1 : 0;
}

export class MemoryStore implements OfflineStore {
  readonly persistent = false;
  private tables = new Map<StoreName, Table>(STORE_NAMES.map((n) => [n, new Map()]));
  private counters = new Map<StoreName, number>(STORE_NAMES.map((n) => [n, 0]));
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;
  private readonly seal = new StoreSeal();

  tx<T>(stores: readonly StoreName[], _mode: 'readonly' | 'readwrite', fn: (t: StoreTx) => Promise<T>, options: TxOptions = {}): Promise<T> {
    // As in IndexedDB: the seal exists from the moment the purge transaction does (not when it runs).
    if (options.seal && !this.closed) this.seal.add(options.seal);
    const run = async (): Promise<T> => {
      if (this.closed) throw new Error('offline store closed');
      // Copy-on-write: work on copies of the touched tables, swap them in only on success.
      const work = new Map<StoreName, Table>(stores.map((s) => [s, new Map(this.tables.get(s))]));
      const counters = new Map(this.counters);
      const table = (s: StoreName): Table => {
        const t = work.get(s);
        if (!t) throw new Error(`store ${s} is not part of this transaction`);
        return t;
      };
      const raw: StoreTx = {
        get: async <S extends StoreName>(s: S, key: IDBValidKey) => {
          const v = table(s).get(keyString(key));
          return (v === undefined ? undefined : structuredClone(v)) as RowOf[S] | undefined;
        },
        getAll: async <S extends StoreName>(s: S) =>
          [...table(s).entries()].sort(([a], [b]) => compareKeys(a, b)).map(([, v]) => structuredClone(v)) as RowOf[S][],
        put: async <S extends StoreName>(s: S, row: RowOf[S]) => {
          const schema = STORE_SCHEMA[s];
          const copy = structuredClone(row) as unknown as Record<string, unknown>;
          let key = copy[schema.keyPath] as IDBValidKey | undefined;
          if (key === undefined) {
            if (!schema.autoIncrement) throw new DOMException('missing key', 'DataError');
            key = (counters.get(s) ?? 0) + 1;
            copy[schema.keyPath] = key;
          }
          if (schema.autoIncrement && typeof key === 'number' && key > (counters.get(s) ?? 0)) counters.set(s, Math.floor(key));
          table(s).set(keyString(key), copy);
          return key;
        },
        delete: async (s, key) => {
          table(s).delete(keyString(key));
        },
        clear: async (s) => {
          table(s).clear();
        },
        count: async (s) => table(s).size,
      };
      const api = this.seal.guard(raw);
      const result = await fn(api);
      for (const [s, t] of work) this.tables.set(s, t);
      this.counters = counters;
      return result;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  close(): void {
    this.closed = true;
  }

  /** Tests only: the committed rows of a table as they really are - past the seal, also after close(). */
  __rowsForTests<S extends StoreName>(s: S): RowOf[S][] {
    return [...(this.tables.get(s) ?? new Map()).values()].map((v) => structuredClone(v)) as RowOf[S][];
  }
}
