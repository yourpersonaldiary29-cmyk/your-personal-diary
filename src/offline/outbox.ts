/**
 * The outbox (section 4.4): queued operations in IndexedDB, one row per operation, sent in order.
 *
 *  - Enqueue: coalesce with the record's last UNSEALED operation (./coalesce.ts) and write in ONE
 *    readwrite transaction with strict durability; resolve only after `complete`. A failed
 *    transaction rejects and leaves nothing half-written.
 *  - Sealing (fixes E5): the replayer sets `sealed = true` and `attempts += 1` in a readwrite
 *    transaction BEFORE the first `fetch`; from then on the operation's content never changes, and it
 *    leaves the outbox only on a definitive answer. Coalescing never touches a sealed row: inside the
 *    transaction the row is re-read and must still be unsealed with the same `rid`, otherwise the
 *    transaction aborts (`TxConflict`) and the enqueue starts over with fresh state. Transactions on
 *    one store are serialised, so a coalesce in one tab and a seal in another cannot interleave.
 *  - Encryption happens BEFORE each transaction (an IndexedDB transaction cannot await Web Crypto).
 */
import { SYNC_MAX_OP_BYTES, type SyncOp } from '@shared/sync';
import { coalesce } from './coalesce';
import { decryptValue, encryptValue, hmacHex, type DerivedKeys } from './crypto';
import { IdMap } from './ids';
import { opFileName, type MirrorSink } from './mirror';
import { TxConflict, type OfflineStore, type OutboxRow, type TxOptions } from './store/types';
import type { IdMapEntry, QueuedOp } from './types';

export interface LoadedOp {
  row: OutboxRow & { seq: number };
  q: QueuedOp;
}

export type EnqueueOutcome =
  | { action: 'append' | 'replace'; seq: number; q: QueuedOp }
  /** create + delete of a record that never left the device: nothing remains to send. */
  | { action: 'drop-both'; seq: number; q: QueuedOp };

/** Thrown by `enqueue` when the operation would exceed `SYNC_MAX_OP_BYTES` ("too long to save"). */
export class OpTooLargeError extends Error {
  constructor() {
    super('operation too large');
    this.name = 'OpTooLargeError';
  }
}

/** UTF-8 size of an operation as it travels. */
export function opBytes(op: SyncOp): number {
  return new TextEncoder().encode(JSON.stringify(op)).byteLength;
}

const MAX_ENQUEUE_ATTEMPTS = 8;
/** Every write of the outbox asks IndexedDB for strict durability (section 4.3 step 2). */
const STRICT: TxOptions = { durability: 'strict' };

export class Outbox {
  private loaded: LoadedOp[] = [];
  private decrypted = new Map<string, QueuedOp>();
  private chainTags = new Map<string, string>();

  constructor(
    private readonly store: OfflineStore,
    private readonly keys: DerivedKeys,
    private readonly mirror: MirrorSink,
  ) {}

  /** The chain tag: HMAC of the chain name (the only chain information stored in plaintext). */
  async chainTag(chain: string): Promise<string> {
    let tag = this.chainTags.get(chain);
    if (!tag) {
      tag = (await hmacHex(this.keys, `chain|${chain}`)).slice(0, 32);
      this.chainTags.set(chain, tag);
    }
    return tag;
  }

  /** Re-reads every row (other tabs may have changed the outbox) and decrypts what is new. */
  async load(): Promise<LoadedOp[]> {
    const rows = await this.store.tx(['outbox'], 'readonly', (t) => t.getAll('outbox'));
    const out: LoadedOp[] = [];
    const live = new Set<string>();
    for (const row of rows) {
      if (row.seq === undefined) continue;
      const cacheKey = `${row.rid}|${row.sealed ? 1 : 0}`;
      live.add(cacheKey);
      let q = this.decrypted.get(cacheKey);
      if (!q) {
        try {
          q = await decryptValue<QueuedOp>(this.keys, 'outbox', row.rid, row.ct);
        } catch {
          continue; // unreadable row (another key): never sent, kept on disk
        }
        this.decrypted.set(cacheKey, q);
      }
      out.push({ row: row as OutboxRow & { seq: number }, q });
    }
    for (const k of [...this.decrypted.keys()]) if (!live.has(k)) this.decrypted.delete(k);
    out.sort((a, b) => a.row.seq - b.row.seq);
    this.loaded = out;
    return out;
  }

  /** The rows as of the last `load` (oldest first). */
  get rows(): readonly LoadedOp[] {
    return this.loaded;
  }

  get size(): number {
    return this.loaded.length;
  }

  /** The last queued operation of a record (highest seq), as of the last `load`. */
  lastOf(record: string): LoadedOp | undefined {
    for (let i = this.loaded.length - 1; i >= 0; i--) if (this.loaded[i].q.record === record) return this.loaded[i];
    return undefined;
  }

  /**
   * Queues `next` (coalescing it with the record's last unsealed operation) in one strict transaction.
   * `idmap` entries (a create's local id) are written in the same transaction.
   */
  async enqueue(next: QueuedOp, deps: number[] = [], idmapEntries: IdMapEntry[] = []): Promise<EnqueueOutcome> {
    if (opBytes(next.op) > SYNC_MAX_OP_BYTES) throw new OpTooLargeError();
    const chainTag = await this.chainTag(next.chain);
    const idRows = await Promise.all(idmapEntries.map((e) => encryptValue(this.keys, 'idmap', e.localId, e).then((ct) => ({ localId: e.localId, ct }))));
    for (let attempt = 0; attempt < MAX_ENQUEUE_ATTEMPTS; attempt++) {
      await this.load();
      const prev = this.lastOf(next.record);
      const decision = coalesce(prev?.q, prev?.row.sealed ?? false, next);
      try {
        if (decision.action === 'append') {
          const rid = next.op.opId;
          const ct = await encryptValue(this.keys, 'outbox', rid, next);
          const row: OutboxRow = { rid, sealed: false, chainTag, deps: [...deps], attempts: 0, nextAt: 0, ct };
          const seq = await this.store.tx(['outbox', 'idmap'], 'readwrite', async (t) => {
            const key = Number(await t.put('outbox', row));
            await IdMap.putRows(t, idRows);
            return key;
          }, STRICT);
          await this.mirror.putOutbox({ ...row, seq });
          await this.load();
          return { action: 'append', seq, q: next };
        }
        const p = prev as LoadedOp;
        if (decision.action === 'replace') {
          const merged = decision.merged;
          if (opBytes(merged.op) > SYNC_MAX_OP_BYTES) throw new OpTooLargeError();
          const rid = merged.op.opId;
          const ct = await encryptValue(this.keys, 'outbox', rid, merged);
          const row: OutboxRow & { seq: number } = { ...p.row, rid, ct, deps: [...new Set([...p.row.deps, ...deps])] };
          await this.store.tx(['outbox', 'idmap'], 'readwrite', async (t) => {
            const cur = await t.get('outbox', p.row.seq);
            if (!cur || cur.sealed || cur.rid !== p.row.rid) throw new TxConflict();
            await t.put('outbox', { ...row, attempts: cur.attempts, nextAt: cur.nextAt });
            await IdMap.putRows(t, idRows);
          }, STRICT);
          await this.mirror.remove(opFileName(p.row.seq, p.row.rid));
          await this.mirror.putOutbox(row);
          await this.load();
          return { action: 'replace', seq: p.row.seq, q: merged };
        }
        // drop-both
        await this.store.tx(['outbox', 'idmap'], 'readwrite', async (t) => {
          const cur = await t.get('outbox', p.row.seq);
          if (!cur || cur.sealed || cur.rid !== p.row.rid) throw new TxConflict();
          await t.delete('outbox', p.row.seq);
          await IdMap.putRows(t, idRows);
        }, STRICT);
        await this.mirror.remove(opFileName(p.row.seq, p.row.rid));
        await this.load();
        return { action: 'drop-both', seq: p.row.seq, q: p.q };
      } catch (e) {
        if (e instanceof TxConflict) continue;
        throw e;
      }
    }
    throw new Error('offline outbox: could not queue the change (busy)');
  }

  /**
   * Seals a row before its send: `sealed = true`, `attempts += 1` and - the first time - the operation
   * with its base resolved (`finalOp`). Returns the operation exactly as stored (decrypted from the
   * sealed ciphertext), so every retry sends byte-identical content.
   */
  async seal(item: LoadedOp, finalOp: SyncOp): Promise<{ row: OutboxRow & { seq: number }; q: QueuedOp }> {
    const seq = item.row.seq;
    if (!item.row.sealed) {
      const q: QueuedOp = { ...item.q, op: finalOp };
      delete q.baseOp;
      const ct = await encryptValue(this.keys, 'outbox', item.row.rid, q);
      const stored = await this.store.tx(['outbox'], 'readwrite', async (t) => {
        const cur = await t.get('outbox', seq);
        if (!cur || cur.rid !== item.row.rid) throw new TxConflict('offline outbox: the row changed before sealing');
        const next: OutboxRow = cur.sealed ? { ...cur, attempts: cur.attempts + 1 } : { ...cur, sealed: true, attempts: cur.attempts + 1, ct };
        await t.put('outbox', next);
        return next as OutboxRow & { seq: number };
      }, STRICT);
      const sealedQ = await decryptValue<QueuedOp>(this.keys, 'outbox', stored.rid, stored.ct);
      this.decrypted.set(`${stored.rid}|1`, sealedQ);
      await this.mirror.putOutbox(stored);
      return { row: stored, q: sealedQ };
    }
    const stored = await this.store.tx(['outbox'], 'readwrite', async (t) => {
      const cur = await t.get('outbox', seq);
      if (!cur || cur.rid !== item.row.rid) throw new TxConflict('offline outbox: the row is gone');
      const next: OutboxRow = { ...cur, attempts: cur.attempts + 1 };
      await t.put('outbox', next);
      return next as OutboxRow & { seq: number };
    }, STRICT);
    const q = await decryptValue<QueuedOp>(this.keys, 'outbox', stored.rid, stored.ct);
    return { row: stored, q };
  }

  /** Sets the backoff time of a row (its chain waits until then). */
  async setNextAt(seq: number, rid: string, nextAt: number): Promise<void> {
    await this.store.tx(['outbox'], 'readwrite', async (t) => {
      const cur = await t.get('outbox', seq);
      if (!cur || cur.rid !== rid) return;
      await t.put('outbox', { ...cur, nextAt });
    }, STRICT);
  }

  /** "Try now": every chain may send at once. */
  async clearBackoffs(): Promise<void> {
    await this.store.tx(['outbox'], 'readwrite', async (t) => {
      for (const row of await t.getAll('outbox')) if (row.nextAt) await t.put('outbox', { ...row, nextAt: 0 });
    }, STRICT);
  }

  /** The mirror names of the rows (orphan cleanup). */
  mirrorNames(): Set<string> {
    return new Set(this.loaded.map((l) => opFileName(l.row.seq, l.row.rid)));
  }
}
