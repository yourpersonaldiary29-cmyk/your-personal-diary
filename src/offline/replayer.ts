/**
 * The replayer (section 4.5): sends the outbox to `POST /api/sync/op`, one operation at a time, in
 * order, and acts on every answer of the contract.
 *
 *  - Single flight: `navigator.locks` across tabs (`ypd-outbox-<userId>`, waited for), an
 *    in-process mutex where Web Locks are missing (jsdom). Other tabs are refreshed through the
 *    engine's BroadcastChannel.
 *  - Picks the operation with the lowest `seq` that is the head of its chain, whose dependencies are
 *    acknowledged and whose chain is not waiting (backoff / blocked). A stuck chain never blocks the
 *    others.
 *  - Seals the operation (base resolved, `attempts += 1`) BEFORE the send; retries send byte-identical
 *    content.
 *  - Answers: applied / unchanged / conflict-won delete the operation and journal the result (creates
 *    map their local id); conflict-lost, gone and stale delete it and leave a note; status 0 and
 *    gateway errors stop the run (the connectivity monitor probes); 401 / 423 / 409 / 404 / 403 halt;
 *    429 / 503 pause everything (`Retry-After` or 2 s doubling to 5 min); 500 / 507 make the chain wait
 *    (2 s doubling to 10 min, "still trying" after 5 attempts); 400 / 413 are definitive and turn the
 *    operation and its dependants into notes.
 *  - CORS / proxy trap: three status-0 failures of the send in a row while the probe succeeds mark the
 *    chain blocked ("could not be sent"); the operation stays.
 */
import type { AppSettings, Entry, Habit, HabitLog } from '@shared/types';
import type { SyncOp, SyncOpResult, SyncOutcome } from '@shared/sync';
import { isApiClientError, isConnectionError, request, type ApiClientError, getToken } from '@/api/client';
import type { OfflineEngine } from './engine';
import { fetchSyncKey } from './keys';
import type { NoteBody } from './notes';
import { Notes } from './notes';
import { entryOfOp } from './optimistic';
import { opBytes, type LoadedOp } from './outbox';
import { opFileName } from './mirror';
import { tokenTagOf } from './session';
import { IdMap } from './ids';
import type { NoteRow } from './store/types';
import { bumpDataVersion, patchSyncStatus, type SyncHalt } from './status';
import type { IdMapEntry, JournalEntry, NoteReason, OpLabel, PendingItem, QueuedOp } from './types';

export const OP_TIMEOUT_BASE_MS = 20_000;
export const OP_TIMEOUT_PER_100KB_MS = 1000;
export const PAUSE_MIN_MS = 2000;
export const PAUSE_MAX_MS = 5 * 60_000;
export const CHAIN_BACKOFF_MAX_MS = 10 * 60_000;
export const STILL_TRYING_AFTER_ATTEMPTS = 5;
export const BLOCKED_AFTER_STRIKES = 3;

export type AckOutcome = { kind: 'ack'; result: SyncOpResult; q: QueuedOp } | { kind: 'rejected'; error: ApiClientError } | { kind: 'timeout' };

let opTimeoutOverride: number | null = null;

/** Tests: a shorter send timeout (null restores the contract's). */
export function __setOpTimeoutForTests(ms: number | null): void {
  opTimeoutOverride = ms;
}

/** The timeout of one send: 20 s plus 1 s per 100 KB (section 4.2). */
export function opTimeoutMs(op: SyncOp): number {
  if (opTimeoutOverride !== null) return opTimeoutOverride;
  return OP_TIMEOUT_BASE_MS + OP_TIMEOUT_PER_100KB_MS * Math.ceil(opBytes(op) / (100 * 1024));
}

/** In-process single flight per account (two engines on one IndexedDB in tests; jsdom has no Web Locks). */
const inProcessLocks = new Map<string, Promise<void>>();

/**
 * Single flight per account across tabs (section 4.5). The Web Lock is WAITED for, not tried
 * (`ifAvailable`): while another tab uploads, this tab's run queues behind it once - and then finds the
 * shared outbox drained, or carries on with what is left - instead of re-requesting the lock in a loop.
 */
async function withAccountLock(userId: string, fn: () => Promise<void>): Promise<void> {
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (locks && typeof locks.request === 'function') {
    await locks.request(`ypd-outbox-${userId}`, async () => {
      await fn();
    });
    return;
  }
  const previous = inProcessLocks.get(userId) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => {
    release = r;
  });
  const chain = previous.then(() => mine);
  inProcessLocks.set(userId, chain);
  await previous;
  try {
    await fn();
  } finally {
    release();
    if (inProcessLocks.get(userId) === chain) inProcessLocks.delete(userId);
  }
}

type StepResult = 'continue' | 'stop';

export class Replayer {
  halted: SyncHalt | null = null;
  readonly blockedChains = new Set<string>();
  /** seq -> the server's message, for operations that failed 5 times with 500 / 507. */
  readonly stillTrying = new Map<number, string>();
  private running: Promise<void> | null = null;
  private again = false;
  private stopped = false;
  private wakeTimer: ReturnType<typeof setTimeout> | null = null;
  private pauseUntil = 0;
  private pauseStep = 0;
  private keyFresh = false;
  private sendingSeq: number | null = null;
  private readonly strikes = new Map<string, number>();
  private readonly watchers = new Map<number, Set<(o: AckOutcome) => void>>();

  constructor(private readonly e: OfflineEngine) {}

  // -------------------------------------------------------------------------
  // Triggers
  // -------------------------------------------------------------------------

  /** Runs (or re-runs) the replay loop soon. Cheap to call often. */
  kick(): void {
    if (this.stopped) return;
    this.again = true;
    if (this.running) return;
    this.running = this.loop().finally(() => {
      this.running = null;
      if (this.again && !this.stopped) this.kick();
    });
  }

  /** Resolves when the loop has nothing more to do right now (drained, waiting or halted). */
  async settle(): Promise<void> {
    this.kick();
    while (this.running) await this.running;
  }

  /** The session was unlocked (423 paused the replay). */
  notifyUnlocked(): void {
    if (this.halted === 'locked') this.halt(null);
    this.kick();
  }

  /** "Try now": forget the backoffs and send again. */
  async tryNow(): Promise<void> {
    this.pauseUntil = 0;
    this.pauseStep = 0;
    this.blockedChains.clear();
    this.strikes.clear();
    this.stillTrying.clear();
    if (this.halted && this.halted !== 'unauthorized' && this.halted !== 'unreadable') this.halt(null);
    await this.e.outbox.clearBackoffs();
    this.kick();
  }

  stop(): void {
    this.stopped = true;
    this.again = false;
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    for (const set of this.watchers.values()) for (const w of set) w({ kind: 'timeout' });
    this.watchers.clear();
  }

  /** The facade: waits up to `timeoutMs` for the row `seq` to be answered (section 4.3 step 4). */
  awaitAck(seq: number, timeoutMs: number): Promise<AckOutcome> {
    return new Promise<AckOutcome>((resolve) => {
      let done = false;
      const finish = (o: AckOutcome) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.watchers.get(seq)?.delete(finish);
        resolve(o);
      };
      const timer = setTimeout(() => finish({ kind: 'timeout' }), timeoutMs);
      let set = this.watchers.get(seq);
      if (!set) {
        set = new Set();
        this.watchers.set(seq, set);
      }
      set.add(finish);
      this.kick();
    });
  }

  private deliver(seq: number, outcome: AckOutcome): void {
    const set = this.watchers.get(seq);
    if (!set) return;
    this.watchers.delete(seq);
    for (const w of [...set]) w(outcome);
  }

  hasWatcher(seq: number): boolean {
    return (this.watchers.get(seq)?.size ?? 0) > 0;
  }

  /** The waiting operations as the review list shows them. */
  pendingItems(): PendingItem[] {
    return this.e.outbox.rows.map((l) => ({
      seq: l.row.seq,
      opId: l.q.op.opId,
      label: labelOf(l.q),
      state: this.sendingSeq === l.row.seq ? 'uploading' : this.blockedChains.has(l.row.chainTag) ? 'blocked' : this.stillTrying.has(l.row.seq) ? 'stillTrying' : 'waiting',
      message: this.stillTrying.get(l.row.seq),
      attempts: l.row.attempts,
    }));
  }

  // -------------------------------------------------------------------------
  // The loop
  // -------------------------------------------------------------------------

  private async loop(): Promise<void> {
    await withAccountLock(this.e.userId, async () => {
      this.again = false;
      for (let guard = 0; guard < 100_000 && !this.stopped; guard++) {
        let action: StepResult;
        try {
          action = await this.step();
        } catch {
          // An unexpected failure must never spin: wait a little, the next trigger retries.
          this.pauseAll(undefined);
          action = 'stop';
        }
        if (action === 'stop') break;
      }
    });
  }

  private async step(): Promise<StepResult> {
    const e = this.e;
    const rows = await e.outbox.load();
    e.publishCounts();
    if (!rows.length) {
      this.onDrained();
      return 'stop';
    }
    if (this.halted || e.readOnly) {
      // Nothing will be sent until the halt ends: never "Uploading..." meanwhile.
      e.connectivity.uploadPaused();
      return 'stop';
    }
    if (e.connectivity.dataOffline) return 'stop';
    const now = e.now();
    if (this.pauseUntil > now) {
      this.wake(this.pauseUntil - now);
      return 'stop';
    }
    const item = this.pickNext(rows, now);
    if (!item) {
      const next = this.nextWake(rows, now);
      if (next !== null) this.wake(next - now);
      e.connectivity.uploadPaused();
      return 'stop';
    }
    if (!(await this.sessionMatches())) {
      this.halt('unauthorized');
      return 'stop';
    }
    if (!this.keyFresh) {
      const key = await this.refreshKey();
      if (key !== 'ok') return key;
    }
    const finalOp = this.resolveBase(item);
    let sealed: { row: LoadedOp['row']; q: QueuedOp };
    try {
      sealed = await e.outbox.seal(item, finalOp);
    } catch {
      return 'continue'; // the row changed under us (another tab): reload and pick again
    }
    this.sendingSeq = sealed.row.seq;
    patchSyncStatus({ uploading: true });
    const sentAt = e.now();
    try {
      const result = await request<SyncOpResult>('/api/sync/op', { method: 'POST', body: sealed.q.op, timeoutMs: opTimeoutMs(sealed.q.op) });
      await this.onResult(sealed, result, sentAt);
      return 'continue';
    } catch (err) {
      return this.onError(sealed, err);
    } finally {
      this.sendingSeq = null;
      patchSyncStatus({ uploading: false });
    }
  }

  /** The token in storage must be the one the engine was armed with: another account's session never sends this outbox. */
  private async sessionMatches(): Promise<boolean> {
    const token = getToken();
    if (!token) return false;
    return (await tokenTagOf(token)) === this.e.tokenTag;
  }

  private async refreshKey(): Promise<StepResult | 'ok'> {
    const sentAt = this.e.now();
    try {
      const res = await fetchSyncKey();
      this.e.clock.learn(res.serverNow, sentAt, this.e.now());
      await this.e.setEpoch(res.epoch);
      this.keyFresh = true;
      return 'ok';
    } catch (err) {
      if (isConnectionError(err)) return 'stop';
      if (isApiClientError(err)) {
        const halt = haltFor(err.status);
        if (halt) {
          this.halt(halt);
          return 'stop';
        }
      }
      this.pauseAll(isApiClientError(err) ? err.retryAfterSec : undefined);
      return 'stop';
    }
  }

  private pickNext(rows: readonly LoadedOp[], now: number): LoadedOp | null {
    const heads = new Map<string, number>();
    for (const r of rows) if (!heads.has(r.row.chainTag)) heads.set(r.row.chainTag, r.row.seq);
    const present = new Set(rows.map((r) => r.row.seq));
    for (const r of rows) {
      if (heads.get(r.row.chainTag) !== r.row.seq) continue;
      if (this.blockedChains.has(r.row.chainTag)) continue;
      if (r.row.nextAt > now) continue;
      if (r.row.deps.some((d) => present.has(d))) continue;
      if (r.q.op.account !== this.e.userId) continue;
      return r;
    }
    return null;
  }

  private nextWake(rows: readonly LoadedOp[], now: number): number | null {
    let next: number | null = null;
    for (const r of rows) if (r.row.nextAt > now && (next === null || r.row.nextAt < next)) next = r.row.nextAt;
    return next;
  }

  private wake(delayMs: number): void {
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = setTimeout(
      () => {
        this.wakeTimer = null;
        this.kick();
      },
      Math.max(0, Math.min(delayMs, CHAIN_BACKOFF_MAX_MS)),
    );
  }

  private halt(halt: SyncHalt | null): void {
    this.halted = halt;
    patchSyncStatus({ halted: halt ?? (this.e.readOnly ? 'unreadable' : null) });
    if (halt) this.e.connectivity.uploadPaused();
  }

  private pauseAll(retryAfterSec: number | undefined): void {
    const delay = retryAfterSec !== undefined && retryAfterSec >= 0 ? Math.max(1000, retryAfterSec * 1000) : Math.min(PAUSE_MIN_MS * 2 ** this.pauseStep, PAUSE_MAX_MS);
    this.pauseStep++;
    this.pauseUntil = this.e.now() + delay;
    this.e.connectivity.uploadPaused();
    this.wake(delay);
  }

  private onDrained(): void {
    this.pauseStep = 0;
    this.stillTrying.clear();
    this.e.connectivity.drained();
    this.e.publishCounts();
    this.e.onDrained();
  }

  // -------------------------------------------------------------------------
  // Base resolution (section 4.4)
  // -------------------------------------------------------------------------

  private resolveBase(item: LoadedOp): SyncOp {
    const q = item.q;
    const op = { ...q.op } as SyncOp & { base?: unknown };
    op.account = this.e.userId;
    if (!q.baseOp || item.row.sealed) return op as SyncOp;
    const prev = this.e.journal.get(q.baseOp);
    if (!prev) {
      delete op.base; // the predecessor is unknown: "not known", the server applies the time rule
      return op as SyncOp;
    }
    const outcome = prev.result.outcome;
    const produced = outcome === 'applied' || outcome === 'conflict-won' || outcome === 'unchanged';
    const base = produced ? baseFromRecord(op, prev.result.record) : (prev.sent as { base?: unknown }).base;
    if (base === undefined) delete op.base;
    else op.base = base;
    return op as SyncOp;
  }

  // -------------------------------------------------------------------------
  // Answers
  // -------------------------------------------------------------------------

  private async onResult(sealed: { row: LoadedOp['row']; q: QueuedOp }, result: SyncOpResult, sentAt: number): Promise<void> {
    const e = this.e;
    const now = e.now();
    e.clock.learn(result.serverNow, sentAt, now);
    void e.persistClockOffset();
    this.strikes.delete(sealed.row.chainTag);
    this.pauseStep = 0;
    this.stillTrying.delete(sealed.row.seq);

    const q = sealed.q;
    const op = q.op;
    const journalEntry: JournalEntry = { opId: op.opId, appliedAt: now, queued: q, sent: op, result };
    const notes = notesFor(q, result, e.idmap);
    const idmapRows: IdMapEntry[] = [];
    if ((op.kind === 'entry.create' || op.kind === 'habit.create') && q.localId !== undefined && result.record && 'id' in result.record) {
      // The local id belongs to this create - unless another record holds it (never overwrite that mapping).
      const existing = e.idmap.get(q.localId);
      if (!existing || existing.clientId === op.clientId) {
        idmapRows.push({ localId: q.localId, kind: op.kind === 'entry.create' ? 'entry' : 'habit', clientId: op.clientId, serverId: result.record.id });
      }
    }

    const journalRow = await e.journal.encryptRow(journalEntry);
    const idRows = await Promise.all(idmapRows.map((r) => e.idmap.encryptRow(r)));
    const noteRows: NoteRow[] = await Promise.all(notes.map((n) => e.notes.prepare(n, now)));
    const noteIds = await e.store.tx(['outbox', 'journal', 'idmap', 'notes'], 'readwrite', async (t) => {
      const cur = await t.get('outbox', sealed.row.seq);
      if (cur && cur.rid === sealed.row.rid) await t.delete('outbox', sealed.row.seq);
      await t.put('journal', journalRow);
      await IdMap.putRows(t, idRows);
      return Notes.putRows(t, noteRows);
    });
    await e.mirror.remove(opFileName(sealed.row.seq, sealed.row.rid));
    e.journal.remember(journalEntry);
    for (const r of idmapRows) e.idmap.remember(r);
    await e.notes.committed(noteRows, noteIds, notes);

    await this.maintainCache(q, result);
    if (result.epoch && result.epoch !== e.epoch) await e.setEpoch(result.epoch);
    await e.outbox.load();
    e.publishCounts();
    bumpDataVersion();
    e.broadcast('changed');
    this.deliver(sealed.row.seq, { kind: 'ack', result, q });
  }

  /**
   * Write-through of the answer into the read cache (entries). The stale case (a restore on the
   * server) drops the read cache, the id map's server mappings and the journal (section 4.5), so a
   * local id never resolves to a record that reused its server id after the restore (E11).
   */
  private async maintainCache(q: QueuedOp, result: SyncOpResult): Promise<void> {
    const e = this.e;
    const op = q.op;
    try {
      if (result.outcome === 'stale') {
        await e.forgetAfterRestore();
        return;
      }
      if (op.kind === 'entry.create' || op.kind === 'entry.update' || op.kind === 'entry.delete') {
        const record = result.record && 'body' in result.record ? (result.record as Entry) : null;
        if (record) {
          await e.cache.put(`/api/entries/${record.id}`, record, new Date(e.now()).toISOString().slice(0, 10));
          return;
        }
        const id = op.kind !== 'entry.create' && 'id' in op.target ? op.target.id : (q.localId !== undefined ? e.idmap.get(q.localId)?.serverId : undefined);
        if (id !== undefined) await e.cache.delete(`/api/entries/${id}`);
      }
    } catch {
      /* the cache is a convenience */
    }
  }

  private async onError(sealed: { row: LoadedOp['row']; q: QueuedOp }, err: unknown): Promise<StepResult> {
    const e = this.e;
    if (!isApiClientError(err)) {
      await this.chainBackoff(sealed, String((err as Error)?.message ?? err));
      return 'continue';
    }
    if (isConnectionError(err)) {
      // CORS / proxy trap: the probe succeeds but the send never arrives.
      const reachable = await e.connectivity.probeNow('sync-failure', true);
      if (!reachable) return 'stop';
      const tag = sealed.row.chainTag;
      const n = (this.strikes.get(tag) ?? 0) + 1;
      this.strikes.set(tag, n);
      if (n >= BLOCKED_AFTER_STRIKES) {
        this.blockedChains.add(tag);
        e.publishCounts();
      }
      return 'continue';
    }
    const halt = haltFor(err.status);
    if (halt) {
      this.halt(halt);
      return 'stop';
    }
    if (err.status === 429 || err.status === 503) {
      this.pauseAll(err.retryAfterSec);
      return 'stop';
    }
    if (err.status === 400 || err.status === 413) {
      await this.reject(sealed, err);
      return 'continue';
    }
    await this.chainBackoff(sealed, err.message);
    return 'continue';
  }

  private async chainBackoff(sealed: { row: LoadedOp['row']; q: QueuedOp }, message: string): Promise<void> {
    const attempts = Math.max(1, sealed.row.attempts);
    const delay = Math.min(PAUSE_MIN_MS * 2 ** (attempts - 1), CHAIN_BACKOFF_MAX_MS);
    await this.e.outbox.setNextAt(sealed.row.seq, sealed.row.rid, this.e.now() + delay);
    if (attempts >= STILL_TRYING_AFTER_ATTEMPTS) this.stillTrying.set(sealed.row.seq, message);
    this.e.publishCounts();
  }

  /** 400 / 413: the operation and every later operation that depends on it become notes (section 4.5). */
  private async reject(sealed: { row: LoadedOp['row']; q: QueuedOp }, err: ApiClientError): Promise<void> {
    const e = this.e;
    const rows = e.outbox.rows;
    const doomed = dependants(rows, sealed.row.seq);
    const first = rows.find((r) => r.row.seq === sealed.row.seq);
    const notes: NoteBody[] = [];
    const removed: LoadedOp[] = [];
    if (first) {
      removed.push(first);
      if (!this.hasWatcher(first.row.seq)) notes.push(noteOfRejection(first.q, err, e.idmap));
    }
    for (const r of doomed) {
      removed.push(r);
      notes.push({ reason: 'blocked', label: labelOf(r.q), op: r.q.op, mine: entryOfOp(r.q.op, displayIdOf(e.idmap, r.q), r.q.hint?.createdAt) });
    }
    const noteRows = await Promise.all(notes.map((n) => e.notes.prepare(n, e.now())));
    const noteIds = await e.store.tx(['outbox', 'notes'], 'readwrite', async (t) => {
      for (const r of removed) {
        const cur = await t.get('outbox', r.row.seq);
        if (cur && cur.rid === r.row.rid) await t.delete('outbox', r.row.seq);
      }
      return Notes.putRows(t, noteRows);
    });
    for (const r of removed) await e.mirror.remove(opFileName(r.row.seq, r.row.rid));
    await e.notes.committed(noteRows, noteIds, notes);
    await e.outbox.load();
    for (const r of removed) this.deliver(r.row.seq, { kind: 'rejected', error: err });
    e.publishCounts();
    bumpDataVersion();
    e.broadcast('changed');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function haltFor(status: number): SyncHalt | null {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 423:
      return 'locked';
    case 403:
      return 'forbidden';
    case 409:
      return 'accountMismatch';
    case 404:
      return 'routeMissing';
    default:
      return null;
  }
}

/** Every row after `seq` in its chain, plus the rows (and their chains' successors) that depend on it. */
export function dependants(rows: readonly LoadedOp[], seq: number): LoadedOp[] {
  const out = new Map<number, LoadedOp>();
  const queue = [seq];
  const byTag = new Map<string, LoadedOp[]>();
  for (const r of rows) {
    const list = byTag.get(r.row.chainTag) ?? [];
    list.push(r);
    byTag.set(r.row.chainTag, list);
  }
  while (queue.length) {
    const s = queue.shift()!;
    const self = rows.find((r) => r.row.seq === s);
    if (self) {
      for (const r of byTag.get(self.row.chainTag) ?? []) {
        if (r.row.seq > s && !out.has(r.row.seq)) {
          out.set(r.row.seq, r);
          queue.push(r.row.seq);
        }
      }
    }
    for (const r of rows) {
      if (r.row.deps.includes(s) && !out.has(r.row.seq) && r.row.seq !== seq) {
        out.set(r.row.seq, r);
        queue.push(r.row.seq);
      }
    }
  }
  return [...out.values()].sort((a, b) => a.row.seq - b.row.seq);
}

/** The base a predecessor's answer gives to its successor (section 4.4 "Base resolution"). */
function baseFromRecord(op: SyncOp, record: SyncOpResult['record']): unknown {
  switch (op.kind) {
    case 'entry.update':
    case 'entry.delete':
      return record && 'updatedAt' in record ? (record as Entry).updatedAt : undefined;
    case 'habit.update': {
      if (!record || !('sortOrder' in record)) return undefined;
      const h = record as Habit;
      return { name: h.name, description: h.description, target: h.target, unit: h.unit, frequency: h.frequency, reminderTime: h.reminderTime ?? null, reminderEnabled: h.reminderEnabled };
    }
    case 'habit.archive':
      return record && 'sortOrder' in record ? { archived: (record as Habit).isArchived } : undefined;
    case 'log.set':
    case 'log.delete':
      return record && 'habitId' in record ? { value: (record as HabitLog).value, note: (record as HabitLog).note } : null;
    case 'settings.patch': {
      if (!record || !('theme' in record)) return undefined;
      const out: Partial<AppSettings> = {};
      for (const k of Object.keys(op.payload) as (keyof AppSettings)[]) (out as Record<string, unknown>)[k] = (record as AppSettings)[k];
      return out;
    }
    default:
      return undefined;
  }
}

function displayIdOf(idmap: IdMap, q: QueuedOp): number {
  const kind = q.op.kind.startsWith('habit') ? 'habit' : 'entry';
  return idmap.displayId(kind, q.record) ?? q.hint?.displayId ?? q.localId ?? 0;
}

/** The short label of a change ("Entry 'Morning walk', 23 Oct"; "Habit Water, 3 glasses"; "Setting: theme"). */
export function labelOf(q: QueuedOp): OpLabel {
  const op = q.op;
  switch (op.kind) {
    case 'entry.create':
    case 'entry.update':
      return { kind: op.kind, title: op.payload.title, date: op.payload.date };
    case 'entry.delete':
      return { kind: op.kind, title: q.hint?.title ?? q.hint?.prev?.title, date: q.hint?.date ?? q.hint?.prev?.date };
    case 'habit.create':
    case 'habit.update':
      return { kind: op.kind, habitName: op.payload.name };
    case 'habit.archive':
      return { kind: op.kind, habitName: q.hint?.habit?.name };
    case 'log.set':
      return { kind: op.kind, habitName: q.hint?.habit?.name, date: op.date, value: op.payload.value, unit: q.hint?.habit?.unit };
    case 'log.delete':
      return { kind: op.kind, habitName: q.hint?.habit?.name, date: op.date };
    case 'settings.patch':
      return { kind: op.kind, settingKeys: Object.keys(op.payload) };
  }
}

/** The notes an answer leaves (section 4.9). */
export function notesFor(q: QueuedOp, result: SyncOpResult, idmap: IdMap): NoteBody[] {
  const op = q.op;
  const outcome: SyncOutcome = result.outcome;
  // Settings are per key (section 3.4): an 'applied' or 'conflict-won' patch can still have keys that
  // lost, and a 'conflict-won' one keys that were plain applied. Each key that lost or won a conflict
  // gets its line; the losing version is never silently lost (sections 0.3, 4.9).
  if (op.kind === 'settings.patch' && result.keys) return settingsNotes(q, result);
  if (outcome === 'applied' || outcome === 'unchanged') return [];
  const label = labelOf(q);
  const id = displayIdOf(idmap, q);
  const mine = entryOfOp(op, id, q.hint?.createdAt);
  const isEntry = op.kind === 'entry.create' || op.kind === 'entry.update';
  const note = (reason: NoteReason, other: NoteBody['other']): NoteBody => ({ reason, label, op, mine, other });

  if (op.kind === 'entry.delete') {
    if (outcome === 'conflict-lost') return [note('deleteLost', result.record)];
    if (outcome === 'conflict-won') return result.replaced ? [note('deleteWon', result.replaced)] : [];
    if (outcome === 'stale') return [note('stale', null)];
    return [];
  }
  if (isEntry) {
    if (outcome === 'conflict-lost') return [note('lost', result.record)];
    if (outcome === 'conflict-won') return result.replaced ? [note('won', result.replaced)] : [];
    if (outcome === 'gone') return [note('gone', null)];
    if (outcome === 'stale') return [note('stale', null)];
    return [];
  }
  // Habits, logs (and settings from a server that sent no per-key outcomes): one line.
  if (outcome === 'conflict-won') return result.replaced ? [note('otherWon', result.replaced)] : [];
  return [note(outcome === 'stale' ? 'stale' : 'otherLost', result.record)];
}

/** The notes of a settings patch from its per-key outcomes: one line for the keys that lost, one for the keys that won a conflict. */
function settingsNotes(q: QueuedOp, result: SyncOpResult): NoteBody[] {
  const keys = result.keys ?? {};
  const keysWith = (o: string) => Object.entries(keys).filter(([, v]) => v === o).map(([k]) => k);
  const label = labelOf(q);
  const out: NoteBody[] = [];
  const lost = keysWith('conflict-lost');
  if (lost.length) out.push({ reason: 'otherLost', label: { ...label, settingKeys: lost }, op: q.op, mine: null, other: result.record });
  const won = keysWith('conflict-won');
  if (won.length && result.replaced) {
    const replaced = result.replaced as Record<string, unknown>;
    const other: Record<string, unknown> = {};
    for (const k of won) if (Object.prototype.hasOwnProperty.call(replaced, k)) other[k] = replaced[k];
    out.push({ reason: 'otherWon', label: { ...label, settingKeys: won }, op: q.op, mine: null, other: other as Partial<AppSettings> });
  }
  return out;
}

function noteOfRejection(q: QueuedOp, err: ApiClientError, idmap: IdMap): NoteBody {
  return {
    reason: err.status === 413 ? 'tooLarge' : 'rejected',
    label: labelOf(q),
    op: q.op,
    mine: entryOfOp(q.op, displayIdOf(idmap, q), q.hint?.createdAt),
    message: err.message,
  };
}
