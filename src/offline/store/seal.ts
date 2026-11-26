/**
 * The seal of the sensitive part of an account's database (sections 4.8, 5.5): what a 401 deletes - the
 * stores `cache`, `journal`, `idmap` and the sensitive rows of `meta` - must stay deleted while the engine
 * that ran the purge still holds its connection (until `stop()` closes it). Whoever still holds that
 * engine - the warm-up filling the cache, a page read whose answer arrives late, the replayer
 * acknowledging an upload, a snapshot update, a password wrap - could otherwise write a row back after
 * the purge (seen once in the end-to-end case L4).
 *
 * The purge transaction carries the seal (`TxOptions.seal`); the store arms it in the same step that
 * creates that transaction. IndexedDB runs transactions with overlapping scopes in the order they were
 * created, so whatever an EARLIER transaction wrote is deleted by the purge; from then on every request
 * of that connection (of any transaction, also one created earlier whose request comes later) goes
 * through `guard`:
 *  - a write into a sealed store or sealed `meta` row is a silent no-op that resolves with the row's key:
 *    the transaction goes on and commits the rest. An enqueue that writes the outbox and the id map in one
 *    transaction keeps its outbox row (the user's text) and drops only the id-map row, and its caller is
 *    told the truth: the change is saved on this device.
 *  - a read of a sealed store or row answers as for an empty one (the purge emptied it).
 *  - `delete` and `clear` go through (they only remove).
 * The outbox, the notes and every other `meta` row are untouched by the seal. A seal lasts as long as the
 * store object (one connection): a new engine opens a new connection, unsealed. A second connection to
 * the same database (another tab) is outside this seal.
 */
import { STORE_SCHEMA, type RowOf, type StoreName, type StoreTx } from './types';

/** What a seal covers: whole stores, plus rows of `meta` by name. */
export interface SealSpec {
  stores: readonly Exclude<StoreName, 'meta' | 'outbox' | 'notes'>[];
  metaRows: readonly string[];
}

export class StoreSeal {
  private readonly stores = new Set<StoreName>();
  private readonly metaRows = new Set<string>();

  /** Arms the seal (synchronously, in the step that creates the purge transaction). */
  add(spec: SealSpec): void {
    for (const s of spec.stores) this.stores.add(s);
    for (const name of spec.metaRows) this.metaRows.add(name);
  }

  get active(): boolean {
    return this.stores.size > 0 || this.metaRows.size > 0;
  }

  /** True when the row `key` of `store` is sealed. */
  covers(store: StoreName, key: IDBValidKey | undefined): boolean {
    if (this.stores.has(store)) return true;
    return store === 'meta' && typeof key === 'string' && this.metaRows.has(key);
  }

  /** The transaction API with the seal applied to every request (checked when the request is made). */
  guard(api: StoreTx): StoreTx {
    const isMetaRowSealed = (row: unknown) => this.metaRows.has((row as { name?: unknown }).name as string);
    return {
      get: <S extends StoreName>(store: S, key: IDBValidKey) =>
        this.covers(store, key) ? Promise.resolve(undefined) : api.get(store, key),
      getAll: <S extends StoreName>(store: S) => {
        if (this.stores.has(store)) return Promise.resolve([] as RowOf[S][]);
        if (store === 'meta' && this.metaRows.size) return api.getAll(store).then((rows) => rows.filter((r) => !isMetaRowSealed(r)));
        return api.getAll(store);
      },
      put: <S extends StoreName>(store: S, row: RowOf[S]) => {
        const key = (row as unknown as Record<string, unknown>)[STORE_SCHEMA[store].keyPath] as IDBValidKey | undefined;
        return this.covers(store, key) ? Promise.resolve(key as IDBValidKey) : api.put(store, row);
      },
      delete: (store, key) => api.delete(store, key),
      clear: (store) => api.clear(store),
      count: (store) => {
        if (this.stores.has(store)) return Promise.resolve(0);
        if (store === 'meta' && this.metaRows.size) return api.getAll('meta').then((rows) => rows.filter((r) => !isMetaRowSealed(r)).length);
        return api.count(store);
      },
    };
  }
}
