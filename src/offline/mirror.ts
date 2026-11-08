/**
 * The outbox mirror (section 5.4, fixes E7): every outbox and notes row written to IndexedDB is also
 * written, as the same ciphertext, through the platform's `OutboxMirror` seam (an app-private folder
 * on Android and Windows; none on the web). It is removed after the IndexedDB delete commits.
 *
 * At engine open:
 *  - the account's database is new (evicted) but mirror files exist: they are imported (the key check
 *    has passed with the AOK fetched after sign-in) and replayed - the server's idempotency (section
 *    3.6) makes an already acknowledged leftover harmless;
 *  - the database exists: mirror files whose row is not in it are orphans of acknowledged operations
 *    and are deleted.
 *
 * File names: `<seq>-<rid>.op` and `<id>-<rid>.note` (the Tauri command contract checks
 * `^[0-9]+-[0-9a-f-]{36}\.(op|note)$`). A file holds the row as JSON with `ct` in base64: only the
 * plaintext fields IndexedDB shows anyway, plus the ciphertext.
 */
import { fromBase64, toBase64, utf8 } from './crypto';
import { getOfflinePlatform, type OutboxMirror } from './seams';
import type { NoteRow, OutboxRow } from './store/types';

export const MIRROR_NAME_RE = /^([0-9]+)-([0-9a-f-]{36})\.(op|note)$/;

export function opFileName(seq: number, rid: string): string {
  return `${seq}-${rid}.op`;
}

export function noteFileName(id: number, rid: string): string {
  return `${id}-${rid}.note`;
}

type Envelope = { v: 1; store: 'outbox'; row: Omit<OutboxRow, 'ct'> & { ct: string } } | { v: 1; store: 'notes'; row: Omit<NoteRow, 'ct'> & { ct: string } };

export function encodeOutboxRow(row: OutboxRow): Uint8Array {
  const env: Envelope = { v: 1, store: 'outbox', row: { ...row, ct: toBase64(row.ct) } };
  return utf8(JSON.stringify(env));
}

export function encodeNoteRow(row: NoteRow): Uint8Array {
  const env: Envelope = { v: 1, store: 'notes', row: { ...row, ct: toBase64(row.ct) } };
  return utf8(JSON.stringify(env));
}

export function decodeMirrorFile(bytes: Uint8Array): { store: 'outbox'; row: OutboxRow } | { store: 'notes'; row: NoteRow } | null {
  try {
    const env = JSON.parse(new TextDecoder().decode(bytes)) as Envelope;
    if (env?.v !== 1 || !env.row || typeof env.row.ct !== 'string' || typeof env.row.rid !== 'string') return null;
    if (env.store === 'outbox') {
      const r = env.row;
      if (typeof r.seq !== 'number') return null;
      return {
        store: 'outbox',
        row: {
          seq: r.seq,
          rid: r.rid,
          sealed: !!r.sealed,
          chainTag: String(r.chainTag),
          deps: Array.isArray(r.deps) ? r.deps.filter((d): d is number => typeof d === 'number') : [],
          attempts: Number(r.attempts) || 0,
          nextAt: 0,
          ct: fromBase64(r.ct),
        },
      };
    }
    if (env.store === 'notes') {
      const r = env.row;
      if (typeof r.id !== 'number') return null;
      return { store: 'notes', row: { id: r.id, rid: r.rid, createdAt: Number(r.createdAt) || 0, ct: fromBase64(r.ct) } };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * The engine's handle on the platform mirror of one account. Every call is best effort: a failing
 * mirror never fails a save (IndexedDB is the primary store) - it is reported to `onError`.
 */
export class MirrorSink {
  constructor(
    private readonly userId: string,
    private readonly onError: (e: unknown) => void = () => {},
  ) {}

  private get mirror(): OutboxMirror | undefined {
    return getOfflinePlatform().mirror;
  }

  get available(): boolean {
    return !!this.mirror;
  }

  async putOutbox(row: OutboxRow & { seq: number }): Promise<void> {
    await this.safe((m) => m.put(this.userId, opFileName(row.seq, row.rid), encodeOutboxRow(row)));
  }

  async putNote(row: NoteRow & { id: number }): Promise<void> {
    await this.safe((m) => m.put(this.userId, noteFileName(row.id, row.rid), encodeNoteRow(row)));
  }

  async remove(name: string): Promise<void> {
    await this.safe((m) => m.remove(this.userId, name));
  }

  async list(): Promise<string[]> {
    const m = this.mirror;
    if (!m) return [];
    try {
      return (await m.list(this.userId)).filter((n) => MIRROR_NAME_RE.test(n));
    } catch (e) {
      this.onError(e);
      return [];
    }
  }

  async read(name: string): Promise<Uint8Array | null> {
    const m = this.mirror;
    if (!m) return null;
    try {
      return await m.read(this.userId, name);
    } catch (e) {
      this.onError(e);
      return null;
    }
  }

  private async safe(fn: (m: OutboxMirror) => Promise<void>): Promise<void> {
    const m = this.mirror;
    if (!m) return;
    try {
      await fn(m);
    } catch (e) {
      this.onError(e);
    }
  }
}

/** Removes every mirror file of an account (a full wipe). */
export async function clearMirror(userId: string): Promise<void> {
  const m = getOfflinePlatform().mirror;
  if (!m) return;
  try {
    await m.clear(userId);
  } catch {
    /* best effort: the files are ciphertext */
  }
}
