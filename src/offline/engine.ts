/**
 * The per-account engine (sections 4-5): one `OfflineEngine` holds the account's stores (outbox,
 * notes, journal, id map, read cache), its keys, the "seen" map of what the pages were shown, the
 * connectivity monitor and the replayer. ./index.ts creates and tears it down; ./facade.ts uses it
 * for every wrapped api call.
 *
 * The outbox, notes, journal, id map and `meta` ALWAYS live in IndexedDB (they must survive a
 * restart). The read cache lives in IndexedDB only on the apps with "Remember me"; everywhere else it
 * is an in-memory twin (section 4.6 "Storage").
 */
import type { AppSettings, DaySummary, Entry, EntryPage, EntrySummary, Habit, HabitLog, HabitWithProgress, HomeSummary } from '@shared/types';
import { ApiClientError } from '@/api/client';
import { tr } from '@/i18n/runtime';
import { DEFAULT_APP_SETTINGS } from '@/constants/settings';
import { todayIso } from '@/utils/dates';
import { ReadCache } from './cache';
import { DeviceClock } from './clock';
import { ConnectivityMonitor } from './connectivity';
import { deriveKeys, verifyKeyCheck, zero, type DerivedKeys } from './crypto';
import { IdMap } from './ids';
import { Journal } from './journal';
import { ensureKeyCheck, META, removeVaultKey } from './keys';
import { MirrorSink, clearMirror, decodeMirrorFile, noteFileName, opFileName } from './mirror';
import { Notes } from './notes';
import { isPendingRecord, pendingOpIdOf } from './optimistic';
import { Outbox, OpTooLargeError, opBytes, type EnqueueOutcome } from './outbox';
import { buildEffects, type Effects, type OverlayContext } from './overlay/effects';
import { knownHabits } from './overlay/habits';
import { isPasswordWrap, openPasswordWrap, passwordUnlockWaitMs, readPasswordThrottle, writePasswordThrottle, type PasswordThrottleState, type PasswordWrap } from './password-wrap';
import { Replayer } from './replayer';
import { MemoryStore } from './store/memory';
import { deleteAccountStore, openAccountStore, openExistingAccountStore } from './store/idb';
import type { OfflineStore } from './store/types';
import { bumpDataVersion, patchSyncStatus } from './status';
import type { IdMapEntry, QueuedOp } from './types';

/** The storage warning thresholds (section 4.4 "Limits"). */
export const WARN_OPERATIONS = 500;
export const WARN_BYTES = 20 * 1024 * 1024;

/** What the device last showed for a record (the `base` of the next operation on it, section 4.3 step 1). */
export type SeenVersion =
  | { kind: 'entry'; opId?: string; entry: Entry }
  | { kind: 'summary'; summary: EntrySummary }
  | { kind: 'habit'; opId?: string; habit: Habit }
  | { kind: 'log'; opId?: string; log: HabitLog | null }
  | { kind: 'settings'; opId?: string; settings: AppSettings };

/** A write the facade built: the operation plus what the enqueue transaction must write with it. */
export interface BuiltWrite {
  q: QueuedOp;
  deps: number[];
  idmap: IdMapEntry[];
}

/** A change could not be kept on the device ("too long to save" / the transaction failed). Never a connection error. */
export class DeviceStorageError extends ApiClientError {
  constructor(readonly reason: 'tooLarge' | 'notSaved') {
    super(
      reason === 'tooLarge' ? 413 : 507,
      { code: reason === 'tooLarge' ? 'VALIDATION' : 'IO', message: tr(reason === 'tooLarge' ? 'shell.sync.tooLongToSave' : 'shell.sync.notSavedOnDevice') },
      { fromServer: false },
    );
    this.name = 'DeviceStorageError';
  }
}

/** A read while offline that the cache cannot serve (the page shows `shell.sync.notCachedYet`). */
export class NotCachedError extends ApiClientError {
  constructor() {
    super(0, { code: 'OTHER', message: tr('shell.sync.notCachedYet') });
    this.name = 'NotCachedError';
  }
}

const partialViews = new WeakSet<object>();

/** Marks a view synthesised from cached records (the page shows `shell.sync.partialView`). */
export function markPartial<T extends object>(view: T): T {
  partialViews.add(view);
  return view;
}

export function isPartialView(x: unknown): boolean {
  return !!x && typeof x === 'object' && partialViews.has(x);
}

/**
 * The answer of the offline unlock by password: 'ok' (this device's screen may open), 'wrong' (with the
 * wait the next attempt must respect, 0 for the first three), 'wait' (refused without a check: the
 * wait after an earlier wrong password is still running), 'unavailable' (no wrap on this device).
 */
export interface PasswordUnlockResult {
  outcome: 'ok' | 'wrong' | 'wait' | 'unavailable';
  waitSeconds: number;
}

export interface EngineOpenOptions {
  userId: string;
  keys: DerivedKeys;
  /** The read cache goes to IndexedDB only on an app with "Remember me". */
  persistentCache: boolean;
  /** The first 16 hex characters of SHA-256 of the session token the engine was armed with. */
  tokenTag: string;
  now?: () => number;
  /** Replaces the default `GET /api/health` probe (tests). */
  probe?: () => Promise<boolean>;
  onError?: (e: unknown) => void;
}

export class OfflineEngine {
  readonly userId: string;
  readonly keys: DerivedKeys;
  readonly store: OfflineStore;
  readonly cache: ReadCache;
  readonly outbox: Outbox;
  readonly notes: Notes;
  readonly journal: Journal;
  readonly idmap: IdMap;
  readonly clock: DeviceClock;
  readonly mirror: MirrorSink;
  readonly connectivity: ConnectivityMonitor;
  readonly replayer: Replayer;
  readonly now: () => number;
  readonly seen = new Map<string, SeenVersion>();
  /** The restore epoch the device knows ('' until the first key answer). */
  epoch = '';
  /** True when `meta.keyCheck` did not decrypt: the data was written with another key, the engine never writes. */
  readonly readOnly: boolean;
  /** Operations recovered from the mirror at open (null: none). */
  readonly recovered: number | null;
  tokenTag: string;
  /** The engine's warm-up hook (the facade installs it). */
  onDrained: () => void = () => {};
  private stopped = false;
  private channel: BroadcastChannel | null = null;
  private offsetPersistedAt = 0;
  private readonly onError: (e: unknown) => void;
  /**
   * The AOK wrapped under the account password (password-wrap.ts), for this run. Every session keeps
   * it here once a password was in hand; only a persistent engine also writes it to `meta.passwordWrap`.
   * Dropped by `purgeSensitive` and with the engine itself (a teardown).
   */
  private passwordWrap: PasswordWrap | null = null;
  /** Wrong-password counter of the offline unlock (per account; mirrored in sessionStorage for the run). */
  private passwordThrottle: PasswordThrottleState;

  private constructor(opts: EngineOpenOptions, store: OfflineStore, cacheStore: OfflineStore, readOnly: boolean, recovered: number | null, epoch: string, offset: number) {
    this.userId = opts.userId;
    this.keys = opts.keys;
    this.store = store;
    this.readOnly = readOnly;
    this.recovered = recovered;
    this.epoch = epoch;
    this.tokenTag = opts.tokenTag;
    this.now = opts.now ?? (() => Date.now());
    this.onError = opts.onError ?? (() => {});
    this.mirror = new MirrorSink(opts.userId, this.onError);
    this.clock = new DeviceClock(offset, this.now);
    this.cache = new ReadCache(cacheStore, opts.keys, this.now);
    this.outbox = new Outbox(store, opts.keys, this.mirror);
    this.notes = new Notes(store, opts.keys, this.mirror);
    this.journal = new Journal(store, opts.keys);
    this.idmap = new IdMap(store, opts.keys);
    this.replayer = new Replayer(this);
    this.passwordThrottle = readPasswordThrottle(opts.userId);
    this.connectivity = new ConnectivityMonitor({
      now: this.now,
      probe: opts.probe,
      pendingCount: () => this.outbox.size,
      onReconnected: () => {
        // Back online: the server checks passwords again, so the offline counter starts over.
        this.resetPasswordThrottle();
        this.replayer.kick();
      },
    });
  }

  /** Opens the account's database, recovers the mirror when the database is new, checks the key, loads everything. */
  static async open(opts: EngineOpenOptions): Promise<OfflineEngine> {
    const { store, fresh: created } = await openAccountStore(opts.userId);
    // "No meta" (section 5.4) is the test, not "IndexedDB just created it": a database the engine never
    // opened (an empty one left by an earlier build's cache-start attempt after an eviction) has no
    // key check yet, and its mirror files must be recovered rather than deleted as orphans.
    const fresh = created || !(await store.tx(['meta'], 'readonly', (t) => t.get('meta', META.keyCheck)));
    const mirror = new MirrorSink(opts.userId, opts.onError);
    let recovered: number | null = null;
    if (fresh) recovered = await importMirror(store, mirror);
    const check = await ensureKeyCheck(store, opts.keys);
    const readOnly = check === 'mismatch';
    const meta = await store.tx(['meta'], 'readonly', async (t) => ({ epoch: await t.get('meta', META.epoch), offset: await t.get('meta', META.clockOffset) }));
    const epoch = typeof meta.epoch?.value === 'string' ? meta.epoch.value : '';
    const offset = typeof meta.offset?.value === 'number' ? meta.offset.value : 0;
    const cacheStore = opts.persistentCache ? store : new MemoryStore();
    const engine = new OfflineEngine(opts, store, cacheStore, readOnly, recovered, epoch, offset);
    await Promise.all([engine.outbox.load(), engine.notes.load(), engine.journal.load(), engine.idmap.load()]);
    await engine.journal.prune(engine.now()).catch(() => undefined);
    if (!readOnly) await engine.reconcileLocalIds().catch(engine.onError);
    // A read-only engine (key check mismatch) keeps everything, its mirror copies included (section 5.2).
    if (!fresh && !readOnly) await engine.cleanOrphanMirrorFiles();
    engine.openChannel();
    engine.publishCounts();
    patchSyncStatus({ enabled: true, userId: opts.userId, recovered, halted: readOnly ? 'unreadable' : null });
    return engine;
  }

  /** Starts the connectivity monitor and the first replay. */
  start(): void {
    this.connectivity.start();
    if (!this.readOnly) this.replayer.kick();
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.replayer.stop();
    this.connectivity.stop();
    this.channel?.close();
    this.channel = null;
    this.cache.close();
    this.store.close();
    patchSyncStatus({ enabled: false, userId: null, pending: 0, attention: 0, uploading: false, halted: null, recovered: null, storageWarning: false });
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  /** Queues a built write in one strict transaction (section 4.3 step 2); the facade resolves the result. */
  async enqueue(built: BuiltWrite): Promise<EnqueueOutcome> {
    if (this.readOnly) throw new DeviceStorageError('notSaved');
    let outcome: EnqueueOutcome;
    try {
      outcome = await this.outbox.enqueue(built.q, built.deps, built.idmap);
    } catch (e) {
      if (e instanceof OpTooLargeError) throw new DeviceStorageError('tooLarge');
      this.onError(e);
      throw new DeviceStorageError('notSaved');
    }
    for (const entry of built.idmap) this.idmap.remember(entry);
    if (outcome.action !== 'drop-both') this.seenFromOp(outcome.q);
    else this.seen.delete(seenKeyOfRecord(outcome.q));
    this.publishCounts();
    bumpDataVersion();
    this.broadcast('enqueued');
    void this.requestPersistence();
    return outcome;
  }

  /** After an enqueue: the record now shows the pending version (the next base is `{ op }`). */
  private seenFromOp(q: QueuedOp): void {
    const op = q.op;
    const key = seenKeyOfRecord(q);
    const prev = this.seen.get(key);
    switch (op.kind) {
      case 'entry.create':
      case 'entry.update': {
        const id = q.hint?.displayId ?? q.localId ?? (op.kind === 'entry.update' && 'id' in op.target ? op.target.id : 0);
        const entry: Entry = { ...op.payload, id, createdAt: q.hint?.createdAt ?? op.editedAt, updatedAt: op.editedAt };
        this.seen.set(key, { kind: 'entry', opId: op.opId, entry });
        break;
      }
      case 'entry.delete':
        this.seen.delete(key);
        break;
      case 'habit.create':
      case 'habit.update':
      case 'habit.archive': {
        const base = prev?.kind === 'habit' ? prev.habit : null;
        const id = q.hint?.displayId ?? q.localId ?? (op.kind !== 'habit.create' && 'id' in op.target ? op.target.id : 0);
        let habit: Habit;
        if (op.kind === 'habit.create') habit = { ...op.payload, id, isArchived: false, sortOrder: q.hint?.nextSortOrder ?? 0, createdAt: q.hint?.createdAt ?? op.editedAt };
        else if (op.kind === 'habit.update') habit = { ...(base ?? { id, isArchived: false, sortOrder: 0, createdAt: op.editedAt }), ...op.payload, id };
        else habit = { ...(base ?? { ...emptyHabit(id), createdAt: op.editedAt }), isArchived: op.payload.archived };
        this.seen.set(key, { kind: 'habit', opId: op.opId, habit });
        break;
      }
      case 'log.set': {
        const habitId = q.hint?.displayId ?? ('id' in op.habit ? op.habit.id : 0);
        const log: HabitLog = { id: q.localId ?? -1, habitId, date: op.date, value: op.payload.value, completed: false, note: op.payload.note };
        this.seen.set(key, { kind: 'log', opId: op.opId, log });
        break;
      }
      case 'log.delete':
        this.seen.set(key, { kind: 'log', opId: op.opId, log: null });
        break;
      case 'settings.patch': {
        const base = prev?.kind === 'settings' ? prev.settings : DEFAULT_APP_SETTINGS;
        this.seen.set(key, { kind: 'settings', opId: op.opId, settings: { ...base, ...op.payload } });
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Reads: the seen map and the overlay
  // -------------------------------------------------------------------------

  /** Records what a page was shown, by view kind (full records win over summaries). */
  rememberView(view: ViewKind, value: unknown, args: { date?: string } = {}): void {
    if (value === null || value === undefined) return;
    switch (view) {
      case 'entry':
        this.rememberEntry(value as Entry);
        break;
      case 'entries':
        for (const s of (value as EntryPage).items ?? []) this.rememberSummary(s);
        break;
      case 'day': {
        const day = value as DaySummary;
        for (const e of day.entries ?? []) this.rememberEntry(e);
        for (const l of day.habitLogs ?? []) this.rememberLog(l.log.habitId, l.log.date, l.log);
        break;
      }
      case 'habits':
        for (const h of value as Habit[]) this.rememberHabit(h);
        break;
      case 'progress':
      case 'home': {
        const list = view === 'home' ? (value as HomeSummary).habitsToday : (value as HabitWithProgress[]);
        const date = view === 'home' ? (value as HomeSummary).today : (args.date ?? todayIso());
        for (const p of list ?? []) {
          this.rememberHabit(p.habit);
          this.rememberLog(p.habit.id, date, p.today);
        }
        if (view === 'home' && (value as HomeSummary).lastEntry) this.rememberSummary((value as HomeSummary).lastEntry as EntrySummary);
        break;
      }
      case 'settings':
        this.rememberSettings(value as AppSettings);
        break;
      default:
        break;
    }
  }

  rememberEntry(entry: Entry): void {
    const opId = pendingOpIdOf(entry) ?? undefined;
    this.seen.set(`entry:${entry.id}`, { kind: 'entry', opId, entry });
  }

  rememberSummary(summary: EntrySummary): void {
    const key = `entry:${summary.id}`;
    const cur = this.seen.get(key);
    if (cur && cur.kind === 'entry') return;
    this.seen.set(key, { kind: 'summary', summary });
  }

  rememberHabit(habit: Habit): void {
    this.seen.set(`habit:${habit.id}`, { kind: 'habit', opId: pendingOpIdOf(habit) ?? undefined, habit });
  }

  rememberLog(habitId: number, date: string, log: HabitLog | null): void {
    this.seen.set(`log:${habitId}:${date}`, { kind: 'log', opId: (log && pendingOpIdOf(log)) ?? undefined, log });
  }

  rememberSettings(settings: AppSettings): void {
    this.seen.set('settings', { kind: 'settings', opId: isPendingRecord(settings) ? (pendingOpIdOf(settings) ?? undefined) : undefined, settings });
  }

  seenEntry(id: number): Extract<SeenVersion, { kind: 'entry' | 'summary' }> | undefined {
    const v = this.seen.get(`entry:${id}`);
    return v && (v.kind === 'entry' || v.kind === 'summary') ? v : undefined;
  }

  seenHabit(id: number): Extract<SeenVersion, { kind: 'habit' }> | undefined {
    const v = this.seen.get(`habit:${id}`);
    return v && v.kind === 'habit' ? v : undefined;
  }

  seenLog(habitId: number, date: string): Extract<SeenVersion, { kind: 'log' }> | undefined {
    const v = this.seen.get(`log:${habitId}:${date}`);
    return v && v.kind === 'log' ? v : undefined;
  }

  seenSettings(): Extract<SeenVersion, { kind: 'settings' }> | undefined {
    const v = this.seen.get('settings');
    return v && v.kind === 'settings' ? v : undefined;
  }

  /** The first day of the week as last shown (the progress overlay). */
  firstDayOfWeek(): 0 | 1 {
    return this.seenSettings()?.settings.firstDayOfWeek ?? DEFAULT_APP_SETTINGS.firstDayOfWeek;
  }

  /** The effects to apply to a view cached at `cachedAt` (journal entries after it, then every pending operation). */
  async effects(cachedAt: number): Promise<Effects> {
    const pending = (await this.outbox.load()).map((l) => l.q);
    return buildEffects({
      pending,
      journal: this.journal.after(cachedAt),
      idOf: (kind, key) => this.idmap.displayId(kind, key),
    });
  }

  /** The overlay context: today, the first day of the week and every habit known (cached lists plus effects). */
  async context(fx: Effects): Promise<OverlayContext> {
    const lists = (await this.cache.allOf<Habit[]>('habits')).map((c) => c.value);
    const fromSeen: Habit[] = [];
    for (const v of this.seen.values()) if (v.kind === 'habit') fromSeen.push(v.habit);
    return { today: todayIso(), firstDayOfWeek: this.firstDayOfWeek(), habits: knownHabits([...lists, fromSeen], fx) };
  }

  /** The cached full entries of a date (a cached day view), or null. */
  async cachedDayEntries(date: string): Promise<Entry[] | null> {
    const hit = await this.cache.get<DaySummary>(`/api/entries/day/${date}`);
    return hit ? hit.value.entries : null;
  }

  // -------------------------------------------------------------------------
  // Offline unlock by password (password-wrap.ts; OFFLINE-DESIGN section 13, 2026-11-08)
  // -------------------------------------------------------------------------

  /**
   * Keeps the wrap the caller just made from a password in hand: in memory for this run, and at rest
   * (`meta.passwordWrap`) only when the engine is persistent - an app with "Remember me", the same rule
   * as the wrapped key and the snapshot (section 5.1).
   */
  async rememberPasswordWrap(wrap: PasswordWrap): Promise<void> {
    this.passwordWrap = wrap;
    if (!this.cache.persistent) return;
    await this.store.tx(['meta'], 'readwrite', (t) => t.put('meta', { name: META.passwordWrap, value: wrap })).catch(this.onError);
  }

  /** The wrap in hand: this run's (memory), else the one at rest (an app reopened without a connection); null when neither exists. */
  async loadPasswordWrap(): Promise<PasswordWrap | null> {
    if (this.passwordWrap) return this.passwordWrap;
    const row = await this.store.tx(['meta'], 'readonly', (t) => t.get('meta', META.passwordWrap)).catch(() => undefined);
    return row && isPasswordWrap(row.value) ? row.value : null;
  }

  /** Seconds the next password attempt must still wait (0: none). */
  passwordUnlockWaitSeconds(): number {
    return Math.max(0, Math.ceil((this.passwordThrottle.notBefore - this.now()) / 1000));
  }

  private resetPasswordThrottle(): void {
    if (this.passwordThrottle.failures === 0 && this.passwordThrottle.notBefore === 0) return;
    this.passwordThrottle = { failures: 0, notBefore: 0 };
    writePasswordThrottle(this.userId, this.passwordThrottle);
  }

  /**
   * Checks the password on this device: opens the wrap, derives the keys from the AOK that comes out
   * and verifies `meta.keyCheck` with them (the AOK must be the one this device's data was written
   * with). Never touches the server. Wrong passwords are counted; from the third on the next attempt
   * must wait (2 s, 4 s, 8 s ... capped at 60 s), and an attempt made before that is refused unchecked
   * ('wait'). A right password or a reconnection resets the counter.
   */
  async unlockWithPassword(password: string): Promise<PasswordUnlockResult> {
    const waiting = this.passwordUnlockWaitSeconds();
    if (waiting > 0) return { outcome: 'wait', waitSeconds: waiting };
    const wrap = await this.loadPasswordWrap();
    if (!wrap) return { outcome: 'unavailable', waitSeconds: 0 };
    let ok = false;
    const aok = await openPasswordWrap(password, wrap, this.userId);
    if (aok) {
      try {
        const keys = await deriveKeys(aok, this.userId);
        const row = await this.store.tx(['meta'], 'readonly', (t) => t.get('meta', META.keyCheck)).catch(() => undefined);
        ok = !!row && (await verifyKeyCheck(keys, row.value));
      } catch {
        ok = false;
      } finally {
        zero(aok);
      }
    }
    if (ok) {
      this.resetPasswordThrottle();
      return { outcome: 'ok', waitSeconds: 0 };
    }
    const failures = this.passwordThrottle.failures + 1;
    const wait = passwordUnlockWaitMs(failures);
    this.passwordThrottle = { failures, notBefore: wait > 0 ? this.now() + wait : 0 };
    writePasswordThrottle(this.userId, this.passwordThrottle);
    return { outcome: 'wrong', waitSeconds: wait / 1000 };
  }

  // -------------------------------------------------------------------------
  // Bookkeeping
  // -------------------------------------------------------------------------

  async setEpoch(epoch: string): Promise<void> {
    if (!epoch || epoch === this.epoch) return;
    this.epoch = epoch;
    await this.store.tx(['meta'], 'readwrite', (t) => t.put('meta', { name: META.epoch, value: epoch })).catch(this.onError);
  }

  /** Persists the learned clock offset (at most once a minute). */
  async persistClockOffset(): Promise<void> {
    const now = this.now();
    if (now - this.offsetPersistedAt < 60_000) return;
    this.offsetPersistedAt = now;
    await this.store.tx(['meta'], 'readwrite', (t) => t.put('meta', { name: META.clockOffset, value: this.clock.offsetMs })).catch(this.onError);
  }

  /** `navigator.storage.persist()` on the first enqueue; the answer is recorded (section 5.4). */
  private async requestPersistence(): Promise<void> {
    try {
      const row = await this.store.tx(['meta'], 'readonly', (t) => t.get('meta', META.persistGranted));
      if (row) return;
      const persist = typeof navigator !== 'undefined' ? navigator.storage?.persist : undefined;
      const granted = persist ? await persist.call(navigator.storage) : false;
      await this.store.tx(['meta'], 'readwrite', (t) => t.put('meta', { name: META.persistGranted, value: granted }));
    } catch {
      /* best effort */
    }
  }

  /** "N changes waiting", attention and the storage warning. */
  publishCounts(): void {
    const pending = this.outbox.size;
    const bytes = this.outbox.rows.reduce((s, l) => s + opBytes(l.q.op), 0) + this.cache.bytes;
    patchSyncStatus({
      pending,
      attention: this.notes.count + this.replayer.blockedChains.size + this.replayer.stillTrying.size,
      storageWarning: pending > WARN_OPERATIONS || bytes > WARN_BYTES,
    });
  }

  private openChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.channel = new BroadcastChannel(`ypd-offline-${this.userId}`);
      this.channel.onmessage = (ev: MessageEvent<{ type?: string }>) => {
        if (this.stopped) return;
        void this.outbox.load().then(() => this.publishCounts());
        bumpDataVersion();
        if (ev.data?.type === 'enqueued') this.replayer.kick();
      };
    } catch {
      this.channel = null;
    }
  }

  broadcast(type: 'enqueued' | 'changed'): void {
    try {
      this.channel?.postMessage({ type });
    } catch {
      /* ignore */
    }
  }

  /**
   * Mirror files whose row is not in the database are orphans of acknowledged operations (section
   * 5.4). The live names come from the RAW rows, so a row this key cannot read keeps its copy too.
   */
  private async cleanOrphanMirrorFiles(): Promise<void> {
    if (!this.mirror.available) return;
    const raw = await this.store.tx(['outbox', 'notes'], 'readonly', async (t) => ({ outbox: await t.getAll('outbox'), notes: await t.getAll('notes') }));
    const live = new Set<string>();
    for (const r of raw.outbox) if (r.seq !== undefined) live.add(opFileName(r.seq, r.rid));
    for (const r of raw.notes) if (r.id !== undefined) live.add(noteFileName(r.id, r.rid));
    for (const name of await this.mirror.list()) if (!live.has(name)) await this.mirror.remove(name);
  }

  /**
   * Local ids stay unique (section 4.3 (c), 4.6). The id map and `meta.nextLocalId` are not mirrored,
   * and a 401 deletes the id map: after a recovery from the mirror (or a sign-in after a 401) every
   * create still in the outbox gets its `localId -> clientId` entry back - so `/entry/-1` resolves and
   * can be edited - and the counter moves below every local id still in use, so a new create never
   * reuses the id of a recovered one.
   */
  private async reconcileLocalIds(): Promise<void> {
    let lowest = 0;
    const consider = (n: unknown) => {
      if (typeof n === 'number' && Number.isInteger(n) && n < lowest) lowest = n;
    };
    const creates: IdMapEntry[] = [];
    for (const { q } of this.outbox.rows) {
      consider(q.localId);
      consider(q.hint?.displayId);
      const op = q.op;
      if ((op.kind === 'entry.create' || op.kind === 'habit.create') && typeof q.localId === 'number' && q.localId < 0) {
        creates.push({ localId: q.localId, kind: op.kind === 'entry.create' ? 'entry' : 'habit', clientId: op.clientId });
      }
    }
    for (const n of this.notes.list()) consider(n.mine?.id);
    for (const m of this.idmap.all()) consider(m.localId);
    await this.idmap.restore(creates, lowest);
  }

  /**
   * The server restored a backup (a `stale` answer, section 4.5): the read cache and the id map's
   * server mappings go, since integer ids may now name other records (E11); the journal goes too (its
   * results carry those ids into synthesised views). Creates still in the outbox keep their local ids.
   */
  async forgetAfterRestore(): Promise<void> {
    await this.cache.clear().catch(this.onError);
    await this.journal.clear().catch(this.onError);
    await this.idmap.dropServerMappings().catch(this.onError);
  }

  /**
   * 401 / account switch (section 4.8, 5.5): the cache, journal, id map, snapshot, wrapped key and
   * password wrap go - and the vault's own entry with them (on the Mac the Keychain item IS the key at
   * rest; keys.ts); the outbox, notes and mirror stay. The engine is unusable afterwards (stop it).
   */
  async purgeSensitive(): Promise<void> {
    this.passwordWrap = null;
    try {
      await purgeSensitiveRows(this.store);
    } catch (e) {
      this.onError(e);
    }
    await removeVaultKey(this.userId, this.onError);
    this.journal.forgetAll();
    this.idmap.forgetAll();
    this.seen.clear();
  }
}

/** The 401 purge of one database (section 5.5): cache, journal, id map, snapshot, wrapped key and password wrap; outbox, notes and mirror stay. */
async function purgeSensitiveRows(store: OfflineStore): Promise<void> {
  await store.tx(['cache', 'journal', 'idmap', 'meta'], 'readwrite', async (t) => {
    await t.clear('cache');
    await t.clear('journal');
    await t.clear('idmap');
    await t.delete('meta', META.snapshot);
    await t.delete('meta', META.wrappedKey);
    await t.delete('meta', META.wrappedBy);
    await t.delete('meta', META.passwordWrap);
  });
}

/**
 * The 401 purge for an account whose engine is not running (a session revoked while the app was
 * closed: the first `me()` answers 401, section 4.8 / 5.1 "loses the wrapped key at its first
 * contact"). Opens the database only when it exists; the vault's entry goes either way - for an
 * evicted database (the Keychain item that still decrypts the account's mirror files must not outlive
 * the marker that opens it) and for one that cannot be opened at all (a corrupt or over-quota WebView
 * profile: `openExistingAccountStore` then rejects instead of answering "missing", so the open sits
 * inside the `try`; the rejection still reaches the caller). False when there was no database to purge.
 */
export async function purgeAccountAtRest(userId: string): Promise<boolean> {
  let store: OfflineStore | null = null;
  try {
    store = await openExistingAccountStore(userId);
    if (store) await purgeSensitiveRows(store);
  } finally {
    store?.close();
    await removeVaultKey(userId);
  }
  return store !== null;
}

export type ViewKind = 'entry' | 'entries' | 'day' | 'counts' | 'habits' | 'templates' | 'progress' | 'status' | 'month' | 'range' | 'home' | 'settings';

function emptyHabit(id: number): Habit {
  return { id, name: '', description: '', target: 1, unit: '', frequency: 'daily', reminderTime: null, reminderEnabled: false, isArchived: false, sortOrder: 0, createdAt: '' };
}

/** The seen-map key of the record a queued operation changes. */
export function seenKeyOfRecord(q: QueuedOp): string {
  const op = q.op;
  switch (op.kind) {
    case 'entry.create':
    case 'entry.update':
    case 'entry.delete':
      return `entry:${q.hint?.displayId ?? q.localId ?? (op.kind !== 'entry.create' && 'id' in op.target ? op.target.id : 0)}`;
    case 'habit.create':
    case 'habit.update':
    case 'habit.archive':
      return `habit:${q.hint?.displayId ?? q.localId ?? (op.kind !== 'habit.create' && 'id' in op.target ? op.target.id : 0)}`;
    case 'log.set':
    case 'log.delete':
      return `log:${q.hint?.displayId ?? ('id' in op.habit ? op.habit.id : 0)}:${op.date}`;
    case 'settings.patch':
      return 'settings';
  }
}

/** Imports the mirror files of an account into a NEW database (section 5.4). Returns how many operations came back. */
async function importMirror(store: OfflineStore, mirror: MirrorSink): Promise<number | null> {
  if (!mirror.available) return null;
  const names = await mirror.list();
  if (!names.length) return null;
  let ops = 0;
  for (const name of names) {
    const bytes = await mirror.read(name);
    const decoded = bytes ? decodeMirrorFile(bytes) : null;
    if (!decoded) continue;
    try {
      if (decoded.store === 'outbox') {
        await store.tx(['outbox'], 'readwrite', (t) => t.put('outbox', { ...decoded.row, attempts: 0, nextAt: 0 }));
        ops++;
      } else {
        await store.tx(['notes'], 'readwrite', (t) => t.put('notes', decoded.row));
      }
    } catch {
      /* a file that does not fit (a duplicate key): skipped */
    }
  }
  return ops;
}

/** A full wipe of an account's data on this device (section 5.5): the database, the mirror files. */
export async function wipeAccountData(userId: string): Promise<void> {
  await deleteAccountStore(userId).catch(() => undefined);
  await clearMirror(userId);
}
