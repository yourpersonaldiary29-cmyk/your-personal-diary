/**
 * Storage model of the offline engine (OFFLINE-DESIGN.md section 5.3): one database per account,
 * `ypd-offline-v1-<userId>`, with six stores. Only counts, sizes, times and flags are plaintext;
 * every content (operations, notes, journal entries, cached responses, id-map entries, the session
 * snapshot, the key check) is an AES-GCM blob (`ct`, see ../crypto.ts) bound to its account, store and
 * record key.
 *
 * Two implementations share the `OfflineStore` interface: IndexedDB (./idb.ts) and an in-memory twin
 * (./memory.ts: the read cache of sessions without "Remember me", and tests).
 */

export const DB_PREFIX = 'ypd-offline-v1-';
export const DB_VERSION = 1;

export const STORE_NAMES = ['meta', 'outbox', 'notes', 'journal', 'cache', 'idmap'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

/** Key path and key generator of each store. */
export const STORE_SCHEMA: Readonly<Record<StoreName, { keyPath: string; autoIncrement: boolean }>> = {
  meta: { keyPath: 'name', autoIncrement: false },
  outbox: { keyPath: 'seq', autoIncrement: true },
  notes: { keyPath: 'id', autoIncrement: true },
  journal: { keyPath: 'opId', autoIncrement: false },
  cache: { keyPath: 'key', autoIncrement: false },
  idmap: { keyPath: 'localId', autoIncrement: false },
};

/** `meta`: plaintext values (wrapped key blob, counters, offset, epoch) or a ciphertext (`keyCheck`, `snapshot`). */
export interface MetaRow {
  name: string;
  value: unknown;
}

/** `outbox`: one queued operation. `ct` holds the `QueuedOp` (kind included). */
export interface OutboxRow {
  seq?: number;
  /**
   * The opId of the operation inside (a random UUID, new for every coalesced operation): the AAD record
   * key of `ct` and the name of the mirror file (`<seq>-<rid>.op`, section 5.4), so it is not secret.
   */
  rid: string;
  /** Set (with `attempts += 1`) in the transaction right before the first send; the content never changes afterwards. */
  sealed: boolean;
  /** HMAC of the chain name (hex): rows of one chain go out in `seq` order. */
  chainTag: string;
  /** `seq` values of operations that must be acknowledged first (a log of a habit created offline). */
  deps: number[];
  attempts: number;
  /** Epoch ms before which the chain waits (backoff); 0 = now. */
  nextAt: number;
  ct: Uint8Array;
}

/** `notes`: what the user must see (a conflict, a rejected change). `ct` holds the `SyncNote` body. */
export interface NoteRow {
  id?: number;
  /** A random UUID: the AAD record key of `ct` and the mirror file name (`<id>-<rid>.note`). */
  rid: string;
  createdAt: number;
  ct: Uint8Array;
}

/** `journal`: an acknowledged operation with its result, kept 7 days for the overlay of older cached views. */
export interface JournalRow {
  opId: string;
  appliedAt: number;
  ct: Uint8Array;
}

/** `cache`: one cached GET response, keyed by HMAC(path and query). */
export interface CacheRow {
  key: string;
  /** HMAC tag of the cache class (per-class LRU limits) - says which rows belong together, not what they are. */
  cls: string;
  cachedAt: number;
  lastUsed: number;
  bytes: number;
  ct: Uint8Array;
}

/** `idmap`: local (negative) id -> `{ clientId, serverId? }` (in `ct`). */
export interface IdMapRow {
  localId: number;
  ct: Uint8Array;
}

export interface RowOf {
  meta: MetaRow;
  outbox: OutboxRow;
  notes: NoteRow;
  journal: JournalRow;
  cache: CacheRow;
  idmap: IdMapRow;
}

/**
 * Operations inside one transaction. Only these promises may be awaited inside the callback of
 * `OfflineStore.tx` (an IndexedDB transaction commits as soon as no request is pending): encrypt and
 * decrypt before or after the transaction, never inside.
 */
export interface StoreTx {
  get<S extends StoreName>(store: S, key: IDBValidKey): Promise<RowOf[S] | undefined>;
  getAll<S extends StoreName>(store: S): Promise<RowOf[S][]>;
  /** Inserts or replaces; resolves to the key (the generated one for `outbox` / `notes` rows without a key). */
  put<S extends StoreName>(store: S, row: RowOf[S]): Promise<IDBValidKey>;
  delete(store: StoreName, key: IDBValidKey): Promise<void>;
  clear(store: StoreName): Promise<void>;
  count(store: StoreName): Promise<number>;
}

export interface TxOptions {
  /** IndexedDB durability hint; every write of the engine passes 'strict' (section 4.3). */
  durability?: 'strict' | 'relaxed' | 'default';
}

export interface OfflineStore {
  /** True when the data survives a restart (IndexedDB). */
  readonly persistent: boolean;
  /**
   * Runs `fn` in one transaction over `stores`. Resolves with its result once the transaction has
   * COMPLETED (committed); rejects - and nothing is written - when `fn` throws or the transaction aborts.
   */
  tx<T>(stores: readonly StoreName[], mode: 'readonly' | 'readwrite', fn: (t: StoreTx) => Promise<T>, options?: TxOptions): Promise<T>;
  close(): void;
}

/** Thrown inside a transaction callback to abort it on purpose (the caller retries with fresh state). */
export class TxConflict extends Error {
  constructor(message = 'offline store: concurrent change') {
    super(message);
    this.name = 'TxConflict';
  }
}
