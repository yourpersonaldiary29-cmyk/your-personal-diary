/**
 * Notes (section 4.9): what the user must see about a change that was not applied as written - a
 * conflict, a record deleted elsewhere, a restore, a rejection. Encrypted, mirrored, kept until the
 * user acts ([OK], [Discard], [Save as a new entry]).
 */
import { decryptValue, encryptValue, randomUuid, type DerivedKeys } from './crypto';
import { noteFileName, type MirrorSink } from './mirror';
import type { NoteRow, OfflineStore, StoreTx } from './store/types';
import type { SyncNote } from './types';

export type NoteBody = Omit<SyncNote, 'id' | 'createdAt'>;

export class Notes {
  private items = new Map<number, { rid: string; note: SyncNote }>();

  constructor(
    private readonly store: OfflineStore,
    private readonly keys: DerivedKeys,
    private readonly mirror: MirrorSink,
  ) {}

  async load(): Promise<void> {
    const rows = await this.store.tx(['notes'], 'readonly', (t) => t.getAll('notes'));
    this.items.clear();
    for (const row of rows) {
      if (row.id === undefined) continue;
      try {
        const body = await decryptValue<NoteBody>(this.keys, 'notes', row.rid, row.ct);
        this.items.set(row.id, { rid: row.rid, note: { ...body, id: row.id, createdAt: row.createdAt } });
      } catch {
        /* unreadable note: kept on disk, not shown */
      }
    }
  }

  list(): SyncNote[] {
    return [...this.items.values()].map((i) => i.note).sort((a, b) => a.id - b.id);
  }

  get(id: number): SyncNote | undefined {
    return this.items.get(id)?.note;
  }

  get count(): number {
    return this.items.size;
  }

  /** Encrypts a note body into a row without a key (encrypt BEFORE the transaction that writes it). */
  async prepare(body: NoteBody, createdAt: number = Date.now()): Promise<NoteRow> {
    const rid = randomUuid();
    return { rid, createdAt, ct: await encryptValue(this.keys, 'notes', rid, body) };
  }

  /** Writes prepared rows inside a caller's transaction; returns their ids. */
  static async putRows(t: StoreTx, rows: NoteRow[]): Promise<number[]> {
    const ids: number[] = [];
    for (const r of rows) ids.push(Number(await t.put('notes', r)));
    return ids;
  }

  /** After the transaction committed: remember and mirror the rows written with `putRows`. */
  async committed(rows: NoteRow[], ids: number[], bodies: NoteBody[]): Promise<void> {
    rows.forEach((row, i) => {
      const id = ids[i];
      this.items.set(id, { rid: row.rid, note: { ...bodies[i], id, createdAt: row.createdAt } });
    });
    for (let i = 0; i < rows.length; i++) await this.mirror.putNote({ ...rows[i], id: ids[i] });
  }

  /** Adds notes in their own transaction. */
  async add(bodies: NoteBody[]): Promise<SyncNote[]> {
    if (!bodies.length) return [];
    const rows = await Promise.all(bodies.map((b) => this.prepare(b)));
    const ids = await this.store.tx(['notes'], 'readwrite', (t) => Notes.putRows(t, rows));
    await this.committed(rows, ids, bodies);
    return ids.map((id) => this.items.get(id)!.note);
  }

  /** Removes a note (the user acted on it). */
  async remove(id: number): Promise<void> {
    const item = this.items.get(id);
    await this.store.tx(['notes'], 'readwrite', (t) => t.delete('notes', id));
    this.items.delete(id);
    if (item) await this.mirror.remove(noteFileName(id, item.rid));
  }

  /** The mirror names of the notes this store holds (orphan cleanup). */
  mirrorNames(): Set<string> {
    return new Set([...this.items.entries()].map(([id, i]) => noteFileName(id, i.rid)));
  }
}
