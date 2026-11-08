/**
 * The journal (section 4.6 "Overlay"): every acknowledged operation with its answer, kept 7 days.
 *
 * A view that was cached BEFORE an operation was acknowledged (`appliedAt > view.cachedAt`, both on
 * the device clock) gets that operation's result applied on read, so an offline view never goes back
 * to the state before an upload. A journal entry also resolves the base of a successor that was
 * queued while it was in flight (section 4.4 "Base resolution at seal time").
 */
import { decryptValue, encryptValue, type DerivedKeys } from './crypto';
import type { JournalRow, OfflineStore } from './store/types';
import type { JournalEntry } from './types';

export const JOURNAL_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

export class Journal {
  private entries = new Map<string, JournalEntry>();

  constructor(
    private readonly store: OfflineStore,
    private readonly keys: DerivedKeys,
  ) {}

  async load(): Promise<void> {
    const rows = await this.store.tx(['journal'], 'readonly', (t) => t.getAll('journal'));
    this.entries.clear();
    for (const row of rows) {
      try {
        this.entries.set(row.opId, await decryptValue<JournalEntry>(this.keys, 'journal', row.opId, row.ct));
      } catch {
        /* unreadable row: ignored */
      }
    }
  }

  get(opId: string): JournalEntry | undefined {
    return this.entries.get(opId);
  }

  /** Entries acknowledged after `cachedAt` (device ms), oldest first. */
  after(cachedAt: number): JournalEntry[] {
    return [...this.entries.values()].filter((e) => e.appliedAt > cachedAt).sort((a, b) => a.appliedAt - b.appliedAt);
  }

  all(): JournalEntry[] {
    return [...this.entries.values()].sort((a, b) => a.appliedAt - b.appliedAt);
  }

  /** The encrypted row (encrypt BEFORE the acknowledging transaction). */
  async encryptRow(e: JournalEntry): Promise<JournalRow> {
    return { opId: e.opId, appliedAt: e.appliedAt, ct: await encryptValue(this.keys, 'journal', e.opId, e) };
  }

  /** In memory, after the acknowledging transaction committed. */
  remember(e: JournalEntry): void {
    this.entries.set(e.opId, e);
  }

  forgetAll(): void {
    this.entries.clear();
  }

  /**
   * Deletes every entry (a restore on the server, the `stale` answer): their results name records by
   * integer ids from before the restore, which the overlay of a synthesised view must not apply.
   */
  async clear(): Promise<void> {
    await this.store.tx(['journal'], 'readwrite', (t) => t.clear('journal'));
    this.entries.clear();
  }

  /** Deletes entries older than 7 days. */
  async prune(now: number = Date.now()): Promise<void> {
    const limit = now - JOURNAL_KEEP_MS;
    const old = [...this.entries.values()].filter((e) => e.appliedAt < limit).map((e) => e.opId);
    if (!old.length) return;
    await this.store.tx(['journal'], 'readwrite', async (t) => {
      for (const opId of old) await t.delete('journal', opId);
    });
    for (const opId of old) this.entries.delete(opId);
  }
}
