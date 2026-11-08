/**
 * IndexedDB implementation of `OfflineStore` (one database per account, section 5.3).
 *
 * Every readwrite transaction of the engine is opened with `{ durability: 'strict' }`, and `tx()`
 * resolves only on the transaction's `complete` event: "Saved on this device" is never said before
 * the data is committed. A callback that throws aborts the transaction, so nothing is half-written.
 *
 * The factory is injectable (`setIdbFactory`) so that tests can give every simulated device its own
 * IndexedDB (fake-indexeddb); the app uses the global `indexedDB`.
 */
import {
  DB_PREFIX,
  DB_VERSION,
  STORE_NAMES,
  STORE_SCHEMA,
  type OfflineStore,
  type RowOf,
  type StoreName,
  type StoreTx,
  type TxOptions,
} from './types';

let factoryOverride: IDBFactory | null = null;

/** Tests: the IndexedDB factory to use (null: the global `indexedDB`). */
export function setIdbFactory(factory: IDBFactory | null): void {
  factoryOverride = factory;
}

/** The IndexedDB factory in use, or null where there is none. */
export function idbFactory(): IDBFactory | null {
  if (factoryOverride) return factoryOverride;
  try {
    return typeof indexedDB !== 'undefined' ? indexedDB : null;
  } catch {
    return null;
  }
}

export function accountDbName(userId: string): string {
  return DB_PREFIX + userId;
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

class IdbStore implements OfflineStore {
  readonly persistent = true;
  private closed = false;

  constructor(private readonly db: IDBDatabase) {
    // Another tab deleting the database (a wipe) must not be blocked by this connection.
    db.onversionchange = () => this.close();
  }

  tx<T>(
    stores: readonly StoreName[],
    mode: 'readonly' | 'readwrite',
    fn: (t: StoreTx) => Promise<T>,
    options: TxOptions = {},
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        if (this.closed) throw new Error('offline store closed');
        const durability = options.durability ?? (mode === 'readwrite' ? 'strict' : undefined);
        transaction = durability
          ? this.db.transaction([...stores], mode, { durability })
          : this.db.transaction([...stores], mode);
      } catch (e) {
        reject(e);
        return;
      }
      let result: T;
      let failure: unknown = null;
      let settled = false;
      const settle = (ok: boolean, value?: unknown) => {
        if (settled) return;
        settled = true;
        if (ok) resolve(value as T);
        else reject(value);
      };
      transaction.oncomplete = () => (failure ? settle(false, failure) : settle(true, result));
      transaction.onabort = () =>
        settle(false, failure ?? transaction.error ?? new DOMException('Transaction aborted', 'AbortError'));
      transaction.onerror = (ev) => {
        // The abort event follows; keep the first error as the reason.
        if (!failure) failure = transaction.error ?? (ev.target as IDBRequest | null)?.error ?? new Error('IndexedDB error');
      };
      const api: StoreTx = {
        get: <S extends StoreName>(store: S, key: IDBValidKey) =>
          promisify(transaction.objectStore(store).get(key)) as Promise<RowOf[S] | undefined>,
        getAll: <S extends StoreName>(store: S) =>
          promisify(transaction.objectStore(store).getAll()) as Promise<RowOf[S][]>,
        put: <S extends StoreName>(store: S, row: RowOf[S]) => promisify(transaction.objectStore(store).put(row)),
        delete: (store, key) => promisify(transaction.objectStore(store).delete(key)).then(() => undefined),
        clear: (store) => promisify(transaction.objectStore(store).clear()).then(() => undefined),
        count: (store) => promisify(transaction.objectStore(store).count()),
      };
      Promise.resolve()
        .then(() => fn(api))
        .then(
          (value) => {
            result = value;
          },
          (e: unknown) => {
            failure = e;
            try {
              transaction.abort();
            } catch {
              /* already finished: the complete / abort handler reports */
            }
          },
        );
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.db.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Opens (creating when missing) the database of one account. `fresh` is true when it did not exist
 * before this call - an evicted or new database, where the native mirror may hold operations to recover.
 */
export function openAccountStore(userId: string): Promise<{ store: OfflineStore; fresh: boolean }> {
  const factory = idbFactory();
  if (!factory) return Promise.reject(new Error('IndexedDB is not available'));
  return new Promise((resolve, reject) => {
    let fresh = false;
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(accountDbName(userId), DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = (ev) => {
      fresh = ev.oldVersion === 0;
      const db = req.result;
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, STORE_SCHEMA[name]);
      }
    };
    req.onsuccess = () => resolve({ store: new IdbStore(req.result), fresh });
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

/**
 * Opens the database of one account only when it EXISTS; resolves null otherwise and creates nothing.
 * A cache start or a 401 purge must not create an empty database for an evicted one: the next real
 * start must still see it as missing and recover the native mirror (section 5.4). The upgrade of a
 * database that does not exist is aborted, which removes it again (IndexedDB: an aborted upgrade of a
 * new database leaves no database behind).
 */
export function openExistingAccountStore(userId: string): Promise<OfflineStore | null> {
  const factory = idbFactory();
  if (!factory) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    let missing = false;
    try {
      req = factory.open(accountDbName(userId), DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = (ev) => {
      if (ev.oldVersion === 0) {
        missing = true;
        try {
          req.transaction?.abort();
        } catch {
          /* already finishing: the error handler reports */
        }
        return;
      }
      const db = req.result;
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, STORE_SCHEMA[name]);
      }
    };
    req.onsuccess = () => {
      if (missing) {
        try {
          req.result.close();
        } catch {
          /* ignore */
        }
        resolve(null);
        return;
      }
      resolve(new IdbStore(req.result));
    };
    req.onerror = (ev) => {
      if (missing) {
        ev.preventDefault?.();
        resolve(null);
        return;
      }
      reject(req.error ?? new Error('IndexedDB open failed'));
    };
  });
}

/** Deletes the whole database of one account (a wipe). Resolves when it is gone (or never existed). */
export function deleteAccountStore(userId: string): Promise<void> {
  const factory = idbFactory();
  if (!factory) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = factory.deleteDatabase(accountDbName(userId));
    } catch (e) {
      reject(e);
      return;
    }
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('IndexedDB delete failed'));
    // `blocked`: a connection of another tab has not closed yet; its onversionchange closes it, then success follows.
  });
}
