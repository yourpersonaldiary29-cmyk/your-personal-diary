/**
 * Local ids and the id map (section 4.3 (c), 4.6 "Local ids after upload").
 *
 * A record created offline is shown with a negative id (-1, -2, ...) from a counter persisted in
 * `meta.nextLocalId`. The id map (`idmap` store, encrypted) remembers `localId -> { clientId,
 * serverId? }`; the server id is added in the same transaction that acknowledges the create, so
 * `entries.get(-3)` and `/entry/-3` keep working after the upload.
 *
 * A record key (chains, coalescing, overlay) is `c:<clientId>` for a record created on this device
 * and `i:<server id>` otherwise.
 */
import type { SyncRef } from '@shared/sync';
import { decryptValue, encryptValue, type DerivedKeys } from './crypto';
import type { OfflineStore, StoreTx } from './store/types';
import type { IdMapEntry } from './types';

export const NEXT_LOCAL_ID = 'nextLocalId';

export class IdMap {
  private byLocal = new Map<number, IdMapEntry>();
  private byClient = new Map<string, IdMapEntry>();
  private byServer = new Map<string, IdMapEntry>();

  constructor(
    private readonly store: OfflineStore,
    private readonly keys: DerivedKeys,
  ) {}

  async load(): Promise<void> {
    const rows = await this.store.tx(['idmap'], 'readonly', (t) => t.getAll('idmap'));
    const entries: IdMapEntry[] = [];
    for (const row of rows) {
      try {
        entries.push(await decryptValue<IdMapEntry>(this.keys, 'idmap', row.localId, row.ct));
      } catch {
        /* unreadable row: ignored (never written by this key) */
      }
    }
    this.replaceAll(entries);
  }

  private replaceAll(entries: IdMapEntry[]): void {
    this.byLocal.clear();
    this.byClient.clear();
    this.byServer.clear();
    for (const e of entries) this.index(e);
  }

  private index(e: IdMapEntry): void {
    this.byLocal.set(e.localId, e);
    this.byClient.set(e.clientId, e);
    if (e.serverId !== undefined) this.byServer.set(`${e.kind}:${e.serverId}`, e);
  }

  /** Adds or updates an entry in memory (after its transaction committed). */
  remember(e: IdMapEntry): void {
    const old = this.byLocal.get(e.localId);
    if (old && old.serverId !== undefined) this.byServer.delete(`${old.kind}:${old.serverId}`);
    this.index(e);
  }

  /** Forgets everything in memory (the store was cleared). */
  forgetAll(): void {
    this.replaceAll([]);
  }

  get(localId: number): IdMapEntry | undefined {
    return this.byLocal.get(localId);
  }

  byClientId(clientId: string): IdMapEntry | undefined {
    return this.byClient.get(clientId);
  }

  byServerId(kind: 'entry' | 'habit', serverId: number): IdMapEntry | undefined {
    return this.byServer.get(`${kind}:${serverId}`);
  }

  all(): IdMapEntry[] {
    return [...this.byLocal.values()];
  }

  /** The record key of an id as the pages see it (negative: created on this device). */
  recordKey(kind: 'entry' | 'habit', id: number): string | null {
    if (id < 0) {
      const e = this.byLocal.get(id);
      return e ? `c:${e.clientId}` : null;
    }
    const e = this.byServerId(kind, id);
    return e ? `c:${e.clientId}` : `i:${id}`;
  }

  /** The `SyncRef` for an id as the pages see it; null for an unknown local id. */
  ref(kind: 'entry' | 'habit', id: number): SyncRef | null {
    if (id < 0) {
      const e = this.byLocal.get(id);
      if (!e) return null;
      return e.serverId !== undefined ? { id: e.serverId } : { clientId: e.clientId };
    }
    return { id };
  }

  /** The id to show for a record key: the server id when known, else the local id. */
  displayId(kind: 'entry' | 'habit', recordKey: string): number | null {
    if (recordKey.startsWith('i:')) return Number(recordKey.slice(2));
    const e = this.byClient.get(recordKey.slice(2));
    if (!e || e.kind !== kind) return null;
    return e.serverId ?? e.localId;
  }

  /** The server id behind a page id (itself when positive), or null while not uploaded. */
  serverIdOf(id: number): number | null {
    if (id > 0) return id;
    return this.byLocal.get(id)?.serverId ?? null;
  }

  /**
   * Allocates the next local id (-1, -2, ...) in its own committed transaction. An id the map already
   * holds is never handed out again (a counter that came back lower than the ids in use - a recovery
   * from the native mirror, see `OfflineEngine.reconcileLocalIds` - must not alias two records).
   */
  async allocate(): Promise<number> {
    return this.store.tx(['meta'], 'readwrite', async (t) => {
      const row = await t.get('meta', NEXT_LOCAL_ID);
      let next = typeof row?.value === 'number' && row.value < 0 ? row.value : -1;
      while (this.byLocal.has(next)) next--;
      await t.put('meta', { name: NEXT_LOCAL_ID, value: next - 1 });
      return next;
    });
  }

  /**
   * Re-adds entries that are missing on disk (`entries`: the creates still in the outbox) and keeps
   * the counter below `lowest` (the lowest local id still in use). One transaction; nothing is written
   * when nothing is missing. Entries already on disk - even with another client id - are left alone.
   */
  async restore(entries: readonly IdMapEntry[], lowest: number): Promise<void> {
    const missing = entries.filter((e) => !this.byLocal.has(e.localId));
    const rows = await Promise.all(missing.map((e) => this.encryptRow(e)));
    const written = await this.store.tx(['idmap', 'meta'], 'readwrite', async (t) => {
      const put: IdMapEntry[] = [];
      for (let i = 0; i < rows.length; i++) {
        if (await t.get('idmap', rows[i].localId)) continue;
        await t.put('idmap', rows[i]);
        put.push(missing[i]);
      }
      const row = await t.get('meta', NEXT_LOCAL_ID);
      const next = typeof row?.value === 'number' && row.value < 0 ? row.value : -1;
      if (lowest < 0 && next >= lowest) await t.put('meta', { name: NEXT_LOCAL_ID, value: lowest - 1 });
      return put;
    });
    for (const e of written) this.remember(e);
  }

  /**
   * A restore on the server (the `stale` answer, section 4.5): every mapping to a SERVER id goes, since
   * integer ids may name other records after a restore (E11). Entries without a server id - creates
   * still in the outbox, addressed by their client id - stay. Re-reads the store first, so mappings
   * written by another tab go too.
   */
  async dropServerMappings(): Promise<void> {
    await this.load();
    const gone = [...this.byLocal.values()].filter((e) => e.serverId !== undefined).map((e) => e.localId);
    if (!gone.length) return;
    await this.store.tx(['idmap'], 'readwrite', async (t) => {
      for (const localId of gone) await t.delete('idmap', localId);
    });
    this.replaceAll([...this.byLocal.values()].filter((e) => e.serverId === undefined));
  }

  /** The encrypted row of an entry (encrypt BEFORE the transaction that writes it). */
  encryptRow(e: IdMapEntry): Promise<{ localId: number; ct: Uint8Array }> {
    return encryptValue(this.keys, 'idmap', e.localId, e).then((ct) => ({ localId: e.localId, ct }));
  }

  /** Writes prepared rows inside a caller's transaction (the store must include 'idmap'). */
  static async putRows(t: StoreTx, rows: { localId: number; ct: Uint8Array }[]): Promise<void> {
    for (const r of rows) await t.put('idmap', r);
  }
}
