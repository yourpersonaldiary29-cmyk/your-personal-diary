/**
 * The disk button of the Server card (docs/server-tasks/SERVER-CARD-V2.md Part B2): the owner enlarges the
 * hosted server's volume from the app. Built only by the hosted composition (hosted.ts); the routes are
 * routes/server-disk.ts, the calls to Fly hosted/fly-volume.ts.
 *
 * Without FLY_APP_NAME / FLY_MACHINE_ID (Fly sets both in every machine) or without the secret
 * DIARY_FLY_API_TOKEN the button is off, `info()` says why (`ServerDiskInfo.reason`) and Fly is never
 * called. The volume is the one attached to this machine (found in the app's volume list), or the one
 * DIARY_FLY_VOLUME_ID names.
 *
 * A change: one at a time; at most SERVER_DISK_CHANGES_PER_DAY started in any 24 hours (failed ones count
 * too); the new size a whole number of GB, larger than the size Fly reports and at most DIARY_DISK_MAX_GB.
 *   snapshot       the snapshots are listed, one is created and waited for until a new one is 'created'
 *                  (at most an hour - Fly took about 14 minutes for the 50 GB production disk, with the
 *                  statuses 'waiting' and 'running' before 'created'; a snapshot that failed or is late ends
 *                  the change - nothing changed);
 *   extending      the volume is extended to the new size - asked once, never again;
 *   waiting        until the file system shows the new size (at most 2 minutes) -> done;
 *   needs-restart  Fly answered that a restart is needed, or the file system did not grow in time: the owner
 *                  presses "Restart the server now" -> restarting: Fly restarts this machine right after the
 *                  answer, and this process ends;
 *   done / failed.
 * Every step is written to <dataDir>/disk-changes.json - the last SERVER_DISK_HISTORY_KEEP changes: sizes,
 * times, states, catalogue keys, whether the e-mail went out, the language of the e-mails and the size of the
 * file system before the change; no account, no address, no token - so that a restart (the planned one
 * included) finds its change again. At start an open change is decided by the file system: grown by at least
 * half the difference -> done; otherwise a change that waited for a restart waits on, one that was in the
 * middle of a step when the server stopped ends as failed ('interrupted').
 *
 * E-mail: after every change, done or failed - and when it waits for a restart, because the volume (and the
 * bill) is larger from then on - one e-mail to the owner's account address through the Mail card's service,
 * in the account's language (else the language of the request that started the change; mail/templates.ts
 * diskChangeEmail: from, to, the new monthly cost, when). Without mail set up the change still happens and
 * `ServerDiskChange.email` says that no e-mail was sent.
 *
 * Log lines: sizes, states, HTTP statuses and catalogue keys - never an account, an address, a request value
 * or the token.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@shared/i18n';
import {
  SERVER_DISK_CHANGES_PER_DAY,
  SERVER_DISK_HISTORY_KEEP,
  SERVER_DISK_PRICE_PER_GB_MONTH,
  type ServerDiskChange,
  type ServerDiskEmail,
  type ServerDiskInfo,
  type ServerDiskReason,
  type ServerDiskState,
} from '@shared/types';
import { isSmtpError, mailFailureTag } from '../mail/errors';
import type { MailContent } from '../mail/mime';
import { diskChangeEmail, type DiskEmailKind } from '../mail/templates';
import { DEFAULT_FLY_APP } from './archive';
import {
  DISK_ERROR_KEYS,
  diskBusy,
  diskDailyLimit,
  diskNoRestartNeeded,
  diskReasonError,
  diskRestartFirst,
  diskSizeNotLarger,
  diskSizeTooLarge,
  diskSizeWhole,
} from './disk-errors';
import {
  createFlyVolumeApi,
  FLY_APP_RE,
  FlyApiError,
  isFlyApiError,
  type FlyExtendAnswer,
  type FlyHttp,
  type FlySnapshot,
  type FlyTimeouts,
  type FlyVolume,
  type FlyVolumeApi,
} from './fly-volume';
import type { DiskController, DiskPlan } from './types';

/** The history of the changes, in the data directory. */
export const DISK_HISTORY_FILE = 'disk-changes.json';

/** The setup script on the owner's PC (B1) - the card shows the one PowerShell line that runs it. */
export const DISK_SETUP_SCRIPT = 'C:\\Users\\AVI\\Projects\\my-personal-diary\\scripts\\hosted\\set-disk-key.ps1';

/** `powershell ... -File "<script>"`, with `-App <name>` when the server is not the production app. */
export function diskSetupCommand(app?: string): string {
  const line = `powershell -NoProfile -ExecutionPolicy Bypass -File "${DISK_SETUP_SCRIPT}"`;
  return app && app !== DEFAULT_FLY_APP && FLY_APP_RE.test(app) ? `${line} -App ${app}` : line;
}

const GIB = 1024 ** 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DiskTiming {
  /** Between two looks at the snapshots, and how long a snapshot may take (10 s / an hour). */
  snapshotPollMs: number;
  snapshotTimeoutMs: number;
  /** Between two looks at the file system, and how long it may take to show the new size (5 s / 2 minutes). */
  fsPollMs: number;
  fsTimeoutMs: number;
  /** How long `info()` reuses what Fly said about the volume (1 minute). */
  volumeCacheMs: number;
  /** From the answer to a restart request to the call to Fly (1 s: the answer leaves first). */
  restartDelayMs: number;
  /** A restart Fly accepted that has not ended this process after this long had no effect (3 minutes). */
  restartWatchMs: number;
}

export const DISK_TIMING: Readonly<DiskTiming> = Object.freeze({
  snapshotPollMs: 10_000,
  snapshotTimeoutMs: 60 * 60_000,
  fsPollMs: 5_000,
  fsTimeoutMs: 2 * 60_000,
  volumeCacheMs: 60_000,
  restartDelayMs: 1_000,
  restartWatchMs: 3 * 60_000,
});

/** The file system holding the data: its size and the bytes in use. */
export interface FileSystemSize {
  totalBytes: number;
  usedBytes: number;
}

/** Size and use of the file system holding `dir` (one statfs call); null when the platform cannot say. */
export function fileSystemSize(dir: string): FileSystemSize | null {
  try {
    const s = fs.statfsSync(dir);
    const bsize = Number(s.bsize);
    const totalBytes = Number(s.blocks) * bsize;
    const usedBytes = (Number(s.blocks) - Number(s.bfree)) * bsize;
    if (!Number.isFinite(totalBytes) || totalBytes <= 0 || !Number.isFinite(usedBytes) || usedBytes < 0) return null;
    return { totalBytes, usedBytes };
  } catch {
    return null;
  }
}

export interface DiskOptions {
  dataDir: string;
  /** DIARY_FLY_API_TOKEN (secret); absent = the button is not set up. */
  token?: string;
  /** DIARY_FLY_API_TOKEN is set but is not a usable token. */
  tokenInvalid?: boolean;
  /** FLY_APP_NAME and FLY_MACHINE_ID (absent: not on Fly). */
  app?: string;
  machineId?: string;
  /** DIARY_FLY_VOLUME_ID: the volume, instead of the one attached to this machine. */
  volumeId?: string;
  /** DIARY_DISK_MAX_GB. */
  maxGb: number;
  /** The transport to Fly (tests: a fake); default: node:https (fly-volume.ts `nodeFlyHttp`). */
  http?: FlyHttp;
  flyTimeouts?: Partial<FlyTimeouts>;
  timing?: Partial<DiskTiming>;
  /** The file system holding `dataDir` (tests: a fake); default: `fileSystemSize`. */
  fileSystem?: (dir: string) => FileSystemSize | null;
  now?: () => number;
  /** Waits between two looks at the snapshots or the file system (tests: a clock that jumps). */
  sleep?: (ms: number) => Promise<void>;
  /** The Mail card's service; absent = no e-mail is ever sent. */
  mail?: { ready(): boolean; send(content: MailContent): Promise<void> };
  /**
   * The owner account's address, first name and language (`AccountRecord.language`), read when an e-mail is
   * due; null without an owner or an address. The e-mail is written in that language, else in the language
   * of the request that started the change.
   */
  ownerContact?: () => { to: string; firstName: string; language?: Locale } | null;
  log?: (line: string) => void;
}

/** The controller as the composition holds it: the routes' interface plus shutdown and tests. */
export interface RunningDiskController extends DiskController {
  /** Resolves when no step, restart request or e-mail is in progress. */
  idle(): Promise<void>;
  /** Stops waiting (a change in progress ends at its next step) and every timer (shutdown). */
  stop(): void;
}

/** A change as the history file keeps it. */
interface StoredChange extends ServerDiskChange {
  /** The size of the file system when the change started (bytes); null when it could not be measured. */
  fsBytesBefore: number | null;
  /** The language of its e-mails. */
  locale: Locale;
}

const STATES: ReadonlySet<string> = new Set<ServerDiskState>(['snapshot', 'extending', 'waiting', 'needs-restart', 'restarting', 'done', 'failed']);
const OPEN_STATES: ReadonlySet<ServerDiskState> = new Set<ServerDiskState>(['snapshot', 'extending', 'waiting', 'needs-restart', 'restarting']);
const EMAILS: ReadonlySet<string> = new Set<ServerDiskEmail>(['sent', 'not-configured', 'no-address', 'failed']);
const ERROR_KEYS: ReadonlySet<string> = new Set<string>(Object.values(DISK_ERROR_KEYS));
/** Fly's words for a snapshot that is complete / that will never be. */
const SNAPSHOT_DONE: ReadonlySet<string> = new Set(['created', 'complete', 'completed', 'succeeded', 'success', 'ready']);
const SNAPSHOT_FAILED: ReadonlySet<string> = new Set(['failed', 'error', 'errored', 'cancelled', 'canceled']);
const CHANGE_ID_RE = /^d_[0-9a-f]{12}$/;

function isWholeGb(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 100_000;
}

function isTime(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v));
}

/** One entry of the history file, or null when it is not one this module wrote. */
function parseStored(raw: unknown): StoredChange | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !CHANGE_ID_RE.test(o.id)) return null;
  if (typeof o.state !== 'string' || !STATES.has(o.state)) return null;
  if (!isWholeGb(o.fromGb) || !isWholeGb(o.toGb) || !isTime(o.startedAt) || !isTime(o.updatedAt)) return null;
  return {
    id: o.id,
    state: o.state as ServerDiskState,
    fromGb: o.fromGb,
    toGb: o.toGb,
    startedAt: o.startedAt,
    updatedAt: o.updatedAt,
    finishedAt: isTime(o.finishedAt) ? o.finishedAt : null,
    errorKey: typeof o.errorKey === 'string' && ERROR_KEYS.has(o.errorKey) ? o.errorKey : null,
    email: typeof o.email === 'string' && EMAILS.has(o.email) ? (o.email as ServerDiskEmail) : null,
    fsBytesBefore: typeof o.fsBytesBefore === 'number' && Number.isSafeInteger(o.fsBytesBefore) && o.fsBytesBefore > 0 ? o.fsBytesBefore : null,
    locale: isLocale(o.locale) ? o.locale : DEFAULT_LOCALE,
  };
}

/** The history file's entry (fixed key order). */
function storedView(c: StoredChange): StoredChange {
  return { ...publicView(c), fsBytesBefore: c.fsBytesBefore, locale: c.locale };
}

/** What the API shows of a change. */
function publicView(c: StoredChange): ServerDiskChange {
  return { id: c.id, state: c.state, fromGb: c.fromGb, toGb: c.toGb, startedAt: c.startedAt, updatedAt: c.updatedAt, finishedAt: c.finishedAt, errorKey: c.errorKey, email: c.email };
}

/** The file system shows the new size: it grew by at least half of what was added. */
function isGrown(c: StoredChange, now: FileSystemSize | null): boolean {
  return c.fsBytesBefore !== null && now !== null && now.totalBytes - c.fsBytesBefore >= ((c.toGb - c.fromGb) * GIB) / 2;
}

/** A Fly failure for a log line: the call, the kind and the HTTP status. */
function describe(e: unknown): string {
  return isFlyApiError(e) ? `${e.call}: ${e.kind}${e.status ? `, HTTP ${e.status}` : ''}` : 'unexpected error';
}

/** Why the button cannot work, from what Fly answered. */
function reasonOf(e: unknown): ServerDiskReason {
  if (isFlyApiError(e) && e.kind === 'unauthorized') return 'unauthorized';
  if (isFlyApiError(e) && e.kind === 'not-found') return 'no-volume';
  return 'fly-error';
}

export function createDiskController(opts: DiskOptions): RunningDiskController {
  const dataDir = path.resolve(opts.dataDir);
  const historyFile = path.join(dataDir, DISK_HISTORY_FILE);
  const now = opts.now ?? Date.now;
  const timing: DiskTiming = { ...DISK_TIMING, ...opts.timing };
  const fileSystem = opts.fileSystem ?? fileSystemSize;
  const maxGb = opts.maxGb;
  const setupCommand = diskSetupCommand(opts.app);
  const sink = opts.log ?? ((line: string) => console.error(`[diary-server] ${line}`));
  const log = (line: string): void => {
    try {
      sink(line);
    } catch {
      /* a log that cannot be written changes nothing */
    }
  };
  const iso = (): string => new Date(now()).toISOString();

  // What is missing for the button, decided once: the environment does not change while the server runs.
  let api: FlyVolumeApi | null = null;
  let missing: ServerDiskReason | null = !opts.app || !opts.machineId ? 'not-fly' : opts.tokenInvalid ? 'bad-token' : !opts.token ? 'no-token' : null;
  if (!missing) {
    try {
      api = createFlyVolumeApi({
        token: opts.token as string,
        app: opts.app as string,
        machineId: opts.machineId as string,
        ...(opts.http ? { http: opts.http } : {}),
        ...(opts.flyTimeouts ? { timeouts: opts.flyTimeouts } : {}),
      });
    } catch {
      missing = 'not-fly';
    }
  }
  if (missing === 'bad-token') log('disk: DIARY_FLY_API_TOKEN is not a usable token - the disk button is off until the owner runs set-disk-key.ps1 again.');
  const reason0: ServerDiskReason | null = missing;

  // Waiting: the injected clock in tests, otherwise timers that stop() ends at once.
  let stopped = false;
  const timers = new Set<{ timer: NodeJS.Timeout; resolve: () => void }>();
  const watchTimers = new Set<NodeJS.Timeout>();
  const realSleep = (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
      const entry = {
        timer: setTimeout(() => {
          timers.delete(entry);
          resolve();
        }, ms),
        resolve,
      };
      entry.timer.unref?.();
      timers.add(entry);
    });
  const sleep = opts.sleep ?? realSleep;

  const working = new Set<Promise<void>>();
  const track = (work: Promise<void>): void => {
    const w = work.catch((e: unknown) => log(`disk: unexpected error (${(e as Error)?.name ?? 'error'}).`));
    working.add(w);
    void w.finally(() => working.delete(w));
  };

  // The history ------------------------------------------------------------------------------------
  const readHistory = (): StoredChange[] => {
    let text: string;
    try {
      text = fs.readFileSync(historyFile, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') log(`disk: the history file could not be read (${(e as NodeJS.ErrnoException)?.code ?? 'error'}).`);
      return [];
    }
    try {
      const raw = JSON.parse(text) as unknown;
      const list = raw && typeof raw === 'object' && Array.isArray((raw as { changes?: unknown }).changes) ? (raw as { changes: unknown[] }).changes : [];
      return list
        .map(parseStored)
        .filter((c): c is StoredChange => c !== null)
        .slice(0, SERVER_DISK_HISTORY_KEEP);
    } catch {
      log('disk: the history file is not valid - it starts again.');
      return [];
    }
  };

  let history: StoredChange[] = readHistory();
  let job: StoredChange | null = null;
  let persistFailed = false;

  const persist = (): void => {
    const tmp = `${historyFile}.tmp`;
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(tmp, `${JSON.stringify({ version: 1, changes: history.slice(0, SERVER_DISK_HISTORY_KEEP).map(storedView) }, null, 2)}\n`, { mode: 0o600 });
      fs.renameSync(tmp, historyFile);
      persistFailed = false;
    } catch (e) {
      try {
        fs.rmSync(tmp, { force: true });
      } catch {
        /* best effort */
      }
      // A full volume is the usual cause - exactly when the owner enlarges it: the change goes on.
      if (!persistFailed) log(`disk: the history file could not be written (${(e as NodeJS.ErrnoException)?.code ?? 'error'}) - the change goes on.`);
      persistFailed = true;
    }
  };

  const step = (c: StoredChange, state: ServerDiskState, errorKey: string | null = null): void => {
    c.state = state;
    c.errorKey = errorKey;
    c.updatedAt = iso();
    if (state === 'done' || state === 'failed') c.finishedAt = c.updatedAt;
    persist();
  };

  /** Changes started in the last 24 hours: how many may still start, and when the next one may. */
  const budget = (): { left: number; retryMs: number; nextAt: string | null } => {
    const t = now();
    const recent = history
      .map((c) => Date.parse(c.startedAt))
      .filter((at) => Number.isFinite(at) && t - at < DAY_MS)
      .sort((a, b) => a - b);
    const left = Math.max(0, SERVER_DISK_CHANGES_PER_DAY - recent.length);
    if (left > 0) return { left, retryMs: 0, nextAt: null };
    const retryMs = Math.max(1000, recent[recent.length - SERVER_DISK_CHANGES_PER_DAY] + DAY_MS - t);
    return { left, retryMs, nextAt: new Date(t + retryMs).toISOString() };
  };

  // E-mail -----------------------------------------------------------------------------------------
  const ownerContact = (): { to: string; firstName: string; language?: Locale } | null => {
    try {
      const who = opts.ownerContact?.() ?? null;
      return who && who.to ? who : null;
    } catch {
      return null;
    }
  };

  const notify = async (c: StoredChange, kind: DiskEmailKind): Promise<void> => {
    const mail = opts.mail;
    let outcome: ServerDiskEmail;
    const owner = mail && mail.ready() ? ownerContact() : null;
    if (!mail || !mail.ready()) outcome = 'not-configured';
    else if (!owner) outcome = 'no-address';
    else {
      // The cost line only when the size after this outcome is known.
      const unknown = c.errorKey === DISK_ERROR_KEYS.extendUnknown || c.errorKey === DISK_ERROR_KEYS.interrupted;
      const sizeGb = kind === 'failed' ? (unknown ? null : c.fromGb) : c.toGb;
      try {
        await mail.send(
          diskChangeEmail(isLocale(owner.language) ? owner.language : c.locale, {
            to: owner.to,
            firstName: owner.firstName,
            kind,
            fromGb: c.fromGb,
            toGb: c.toGb,
            at: c.updatedAt,
            errorKey: c.errorKey,
            sizeGb,
            pricePerGbMonth: SERVER_DISK_PRICE_PER_GB_MONTH,
          }),
        );
        outcome = 'sent';
      } catch (e) {
        // The catalogue key and the SMTP code only - never the address.
        log(`disk: the e-mail to the owner was not sent (${isSmtpError(e) ? mailFailureTag(e) : 'unexpected error'}).`);
        outcome = 'failed';
      }
    }
    if (outcome === 'sent') log('disk: e-mail to the owner sent.');
    else if (outcome !== 'failed') log(`disk: no e-mail to the owner (${outcome === 'not-configured' ? 'e-mail sending is not set up' : 'the owner account has no e-mail address'}).`);
    c.email = outcome;
    persist();
  };

  // The state is published first, then its e-mail is sent: until then `email` is null (never the outcome of the
  // e-mail about an earlier state), so the card knows that an outcome is still to come.
  const finish = async (c: StoredChange, state: 'done' | 'failed', errorKey: string | null): Promise<void> => {
    c.email = null;
    step(c, state, errorKey);
    log(state === 'done' ? `disk: the change from ${c.fromGb} GB to ${c.toGb} GB is done.` : `disk: the change from ${c.fromGb} GB to ${c.toGb} GB failed (${errorKey}).`);
    await notify(c, state === 'done' ? 'done' : 'failed');
  };

  const waitForRestart = async (c: StoredChange, why: string): Promise<void> => {
    c.email = null;
    step(c, 'needs-restart');
    log(`disk: the volume has ${c.toGb} GB (${why}) - the server uses it after a restart.`);
    await notify(c, 'restart');
  };

  // Fly --------------------------------------------------------------------------------------------
  let volumeId: string | null = opts.volumeId ?? null;
  let cached: { at: number; volume: FlyVolume } | null = null;

  /** The volume as Fly reports it (from the cache unless `fresh`). */
  const readVolume = async (fresh: boolean): Promise<FlyVolume> => {
    const flyApi = api as FlyVolumeApi;
    const t = now();
    if (!fresh && cached && t >= cached.at && t - cached.at < timing.volumeCacheMs) return cached.volume;
    let volume: FlyVolume;
    try {
      if (volumeId) {
        volume = await flyApi.getVolume(volumeId);
      } else {
        const mine = (await flyApi.listVolumes()).find((v) => v.attachedMachineId === opts.machineId);
        if (!mine) throw new FlyApiError('not-found', 0, 'list volumes');
        volume = mine.sizeGb === null ? await flyApi.getVolume(mine.id) : mine;
        volumeId = mine.id;
      }
    } catch (e) {
      // A volume that is gone is looked for again next time (unless DIARY_FLY_VOLUME_ID names it).
      if (isFlyApiError(e) && e.kind === 'not-found' && !opts.volumeId) volumeId = null;
      cached = null;
      throw e;
    }
    cached = { at: now(), volume };
    return volume;
  };

  /** 'created', 'stopped' or the catalogue key of why there is no snapshot. */
  const waitForSnapshot = async (flyApi: FlyVolumeApi, volId: string, before: ReadonlySet<string>): Promise<string> => {
    const deadline = now() + timing.snapshotTimeoutMs;
    for (;;) {
      await sleep(timing.snapshotPollMs);
      if (stopped) return 'stopped';
      let list: FlySnapshot[] | null = null;
      try {
        list = await flyApi.listSnapshots(volId);
      } catch (e) {
        if (isFlyApiError(e) && e.kind === 'unauthorized') return DISK_ERROR_KEYS.unauthorized;
        // Another failed look: the next one may work - until the deadline.
      }
      if (list) {
        const fresh = list.filter((s) => !before.has(s.id));
        if (fresh.some((s) => SNAPSHOT_DONE.has(s.status))) return 'created';
        if (fresh.length > 0 && fresh.every((s) => SNAPSHOT_FAILED.has(s.status))) return DISK_ERROR_KEYS.snapshotFailed;
      }
      if (now() >= deadline) return DISK_ERROR_KEYS.snapshotTimeout;
    }
  };

  /** True once the file system shows the new size; false after `fsTimeoutMs`; 'stopped' on shutdown. */
  const waitForFileSystem = async (c: StoredChange): Promise<boolean | 'stopped'> => {
    const deadline = now() + timing.fsTimeoutMs;
    for (;;) {
      if (isGrown(c, fileSystem(dataDir))) return true;
      if (now() >= deadline) return false;
      await sleep(timing.fsPollMs);
      if (stopped) return 'stopped';
    }
  };

  const run = async (c: StoredChange, volId: string): Promise<void> => {
    const flyApi = api as FlyVolumeApi;
    // 1. The backup copy: a new snapshot, waited for. Nothing is changed before it exists.
    let before: Set<string>;
    try {
      before = new Set((await flyApi.listSnapshots(volId)).map((s) => s.id));
      await flyApi.createSnapshot(volId);
    } catch (e) {
      log(`disk: no snapshot (${describe(e)}).`);
      return finish(c, 'failed', isFlyApiError(e) && e.kind === 'unauthorized' ? DISK_ERROR_KEYS.unauthorized : DISK_ERROR_KEYS.snapshotFailed);
    }
    log('disk: snapshot requested.');
    const snapshot = await waitForSnapshot(flyApi, volId, before);
    if (snapshot === 'stopped') return;
    if (snapshot !== 'created') return finish(c, 'failed', snapshot);
    log('disk: snapshot created.');
    if (stopped) return;
    // 2. The change itself - asked once, never again.
    step(c, 'extending');
    let answer: FlyExtendAnswer;
    try {
      answer = await flyApi.extendVolume(volId, c.toGb);
    } catch (e) {
      cached = null;
      log(`disk: Fly did not enlarge the volume (${describe(e)}).`);
      const refused = isFlyApiError(e) && (e.kind === 'refused' || e.kind === 'not-found');
      const unauthorized = isFlyApiError(e) && e.kind === 'unauthorized';
      return finish(c, 'failed', unauthorized ? DISK_ERROR_KEYS.unauthorized : refused ? DISK_ERROR_KEYS.extendRefused : DISK_ERROR_KEYS.extendUnknown);
    }
    cached = null;
    log(`disk: Fly enlarged the volume to ${c.toGb} GB${answer.needsRestart ? ' and asks for a restart' : ''}.`);
    if (answer.needsRestart) return waitForRestart(c, 'Fly asks for a restart');
    // 3. Until the file system shows it.
    step(c, 'waiting');
    const seen = await waitForFileSystem(c);
    if (seen === 'stopped') return;
    if (seen) return finish(c, 'done', null);
    return waitForRestart(c, 'the file system did not show it within 2 minutes');
  };

  const askRestart = async (c: StoredChange): Promise<void> => {
    if (stopped) return;
    try {
      await (api as FlyVolumeApi).restartMachine();
    } catch (e) {
      if (job !== c || c.state !== 'restarting') return;
      const refused = isFlyApiError(e) && (e.kind === 'unauthorized' || e.kind === 'refused' || e.kind === 'not-found');
      step(c, 'needs-restart', refused ? DISK_ERROR_KEYS.restartRefused : DISK_ERROR_KEYS.restartFailed);
      log(`disk: the restart did not happen (${describe(e)}).`);
      return;
    }
    log('disk: Fly accepted the restart - this server stops now.');
    // Still running long after Fly accepted it: the restart had no effect.
    const watch = setTimeout(() => {
      watchTimers.delete(watch);
      if (job === c && c.state === 'restarting') {
        step(c, 'needs-restart', DISK_ERROR_KEYS.restartFailed);
        log('disk: the server was not restarted - the change still waits for a restart.');
      }
    }, timing.restartWatchMs);
    watch.unref?.();
    watchTimers.add(watch);
  };

  // The routes' interface ----------------------------------------------------------------------------
  const assertCanStart = (): void => {
    if (reason0) throw diskReasonError(reason0);
    if (job && OPEN_STATES.has(job.state)) throw job.state === 'needs-restart' || job.state === 'restarting' ? diskRestartFirst() : diskBusy();
    const b = budget();
    if (b.left <= 0) throw diskDailyLimit(b.retryMs, SERVER_DISK_CHANGES_PER_DAY);
  };

  const assertCanRestart = (): void => {
    if (reason0) throw diskReasonError(reason0);
    if (!job || job.state !== 'needs-restart') throw diskNoRestartNeeded();
  };

  // At start: an open change of an earlier run is decided by the file system (see the file comment).
  for (const older of history.slice(1)) {
    if (OPEN_STATES.has(older.state)) {
      older.state = 'failed';
      older.errorKey = DISK_ERROR_KEYS.interrupted;
      older.finishedAt = older.finishedAt ?? older.updatedAt;
    }
  }
  const open = history[0] && OPEN_STATES.has(history[0].state) ? history[0] : null;
  if (open) {
    job = open;
    if (isGrown(open, fileSystem(dataDir))) {
      log(`disk: the server uses the new size of ${open.toGb} GB.`);
      track(finish(open, 'done', null));
    } else if (open.state === 'needs-restart') {
      log('disk: a change of the disk still waits for a restart of the server.');
    } else if (open.state === 'restarting') {
      step(open, 'needs-restart', DISK_ERROR_KEYS.notGrown);
      log('disk: the server restarted, but the file system does not show the new size yet - the change waits for another restart.');
    } else if (open.state === 'waiting') {
      track(waitForRestart(open, 'the server stopped before the file system showed it'));
    } else {
      track(finish(open, 'failed', DISK_ERROR_KEYS.interrupted));
    }
  }

  return {
    async info(): Promise<ServerDiskInfo> {
      const fsNow = fileSystem(dataDir);
      let reason: ServerDiskReason | null = reason0;
      let sizeGb: number | null = null;
      if (!reason) {
        try {
          sizeGb = (await readVolume(false)).sizeGb;
        } catch (e) {
          reason = reasonOf(e);
        }
      }
      const b = budget();
      return {
        available: reason === null,
        ...(reason ? { reason } : {}),
        sizeGb,
        usedBytes: fsNow?.usedBytes ?? null,
        totalBytes: fsNow?.totalBytes ?? null,
        maxGb,
        pricePerGbMonth: SERVER_DISK_PRICE_PER_GB_MONTH,
        changesPerDay: SERVER_DISK_CHANGES_PER_DAY,
        changesLeftToday: b.left,
        nextChangeAt: b.nextAt,
        job: job ? publicView(job) : null,
        history: history.map(publicView),
        setupCommand,
      };
    },

    assertCanStart,

    async plan(sizeGb: unknown): Promise<DiskPlan> {
      if (reason0) throw diskReasonError(reason0);
      if (typeof sizeGb !== 'number' || !Number.isInteger(sizeGb)) throw diskSizeWhole();
      if (sizeGb > maxGb) throw diskSizeTooLarge(maxGb);
      let volume: FlyVolume;
      try {
        volume = await readVolume(true);
      } catch (e) {
        log(`disk: the volume could not be read (${describe(e)}).`);
        throw diskReasonError(reasonOf(e));
      }
      const current = volume.sizeGb as number;
      if (sizeGb <= current) throw diskSizeNotLarger(current);
      return { volumeId: volume.id, fromGb: current, toGb: sizeGb };
    },

    start(plan: DiskPlan, locale: Locale): ServerDiskChange {
      // Checked and claimed in one synchronous step: of two requests only one gets here first.
      assertCanStart();
      const t = iso();
      const change: StoredChange = {
        id: `d_${randomBytes(6).toString('hex')}`,
        state: 'snapshot',
        fromGb: plan.fromGb,
        toGb: plan.toGb,
        startedAt: t,
        updatedAt: t,
        finishedAt: null,
        errorKey: null,
        email: null,
        fsBytesBefore: fileSystem(dataDir)?.totalBytes ?? null,
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
      };
      job = change;
      history = [change, ...history].slice(0, SERVER_DISK_HISTORY_KEEP);
      persist();
      log(`disk: change from ${plan.fromGb} GB to ${plan.toGb} GB started - a snapshot first.`);
      track(run(change, plan.volumeId));
      return publicView(change);
    },

    assertCanRestart,

    restart(): ServerDiskChange {
      assertCanRestart();
      const c = job as StoredChange;
      step(c, 'restarting');
      log('disk: the owner asked for a restart of the server.');
      // The answer leaves first; then Fly is asked to restart this machine.
      track(realSleep(timing.restartDelayMs).then(() => askRestart(c)));
      return publicView(c);
    },

    async idle(): Promise<void> {
      while (working.size) await Promise.all([...working]);
    },

    stop(): void {
      stopped = true;
      for (const entry of timers) {
        clearTimeout(entry.timer);
        entry.resolve();
      }
      timers.clear();
      for (const watch of watchTimers) clearTimeout(watch);
      watchTimers.clear();
    },
  };
}
