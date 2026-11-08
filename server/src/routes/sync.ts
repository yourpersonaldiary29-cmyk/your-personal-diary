/**
 * /api/sync - offline sync of the hosted server (docs/android-tasks/OFFLINE-DESIGN.md §3; contract:
 * shared/sync.ts; docs/API.md "Offline sync"). Mounted by app.ts in HOSTED mode only, after the
 * session check (`requireAuth`: 401, 423 for a locked session) and `refuseGuest` (403):
 *
 *   GET  /api/sync/key  -> SyncKeyResponse   the account offline key + restore epoch (created once)
 *   POST /api/sync/op   SyncOp -> SyncOpResult
 *
 * The routes stay mounted while the kill switch (`DIARY_OFFLINE_SYNC=0`) hides `ServerInfo.offlineSync`,
 * so outboxes that already exist can drain. No `quotaGuard` here: the quota is checked per kind
 * (deletes and archive always pass). Every answer is `Cache-Control: no-store`.
 *
 * Durability: a 200 is sent only after the change is on disk (`await vault.persist()`). Three things
 * answer 503 'server.sync.notSaved' with `Retry-After: 5` instead - never 401, which would sign the
 * device out, and never 500:
 *   - the persist failed (the change stays in memory; the retry finds it, "unchanged", and waits for
 *     the persist again);
 *   - the vault was closed between the session check and the handler, or during the persist (idle
 *     eviction, the last session's logout, a shutdown in progress; a closed vault's persist writes
 *     nothing) - a remember-me retry reopens it, a regular session gets 401 as everywhere else;
 *   - a restore replaced the diary while the request ran (§3.7, e2e scenario L7): the change landed
 *     in the discarded database and is NOT on disk; the retry is decided against the restored diary
 *     (`stale` for an edit by id, `applied` for a create).
 *
 * The handlers therefore work on `vault.db`, the LIVE database, taken right before their synchronous
 * section - `ctx.db` is the snapshot the session check took when the headers arrived, and the body
 * may have taken a while to arrive - and they check after the persist that it is still the vault's.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import type { SyncKeyResponse, SyncOpResult } from '@shared/sync';
import type { AppDeps } from '../app';
import type { DiaryDb } from '../db/database';
import { ApiError } from '../errors';
import { ctxOf } from '../middleware/auth';
import { diaryImageBytes, quotaExceeded } from '../middleware/quota';
import type { UserVault } from '../security/session-types';
import { applySyncOp, type ApplyResult } from '../sync/apply';
import { enableSyncCarry } from '../sync/restore';
import { ensureSyncState, pruneSyncTimes, readSyncState } from '../sync/store';
import { isGrowingKind, validateSyncOp } from '../sync/validate';
import { wrap } from './entries';

export const NOT_SAVED_KEY = 'server.sync.notSaved';
export const ACCOUNT_MISMATCH_KEY = 'server.sync.accountMismatch';
/** Seconds a client waits before retrying after 503 'server.sync.notSaved'. */
export const NOT_SAVED_RETRY_AFTER_SEC = 5;

/** 503 IO 'server.sync.notSaved' + `Retry-After: 5`: retryable, the operation stays on the device. */
export function notSaved(): ApiError {
  const e = ApiError.localized(503, 'IO', NOT_SAVED_KEY);
  e.retryAfterSec = NOT_SAVED_RETRY_AFTER_SEC;
  return e;
}

/** 409 FORBIDDEN 'server.sync.accountMismatch': the operation belongs to another account than the session. */
export function accountMismatch(): ApiError {
  return ApiError.localized(409, 'FORBIDDEN', ACCOUNT_MISMATCH_KEY, undefined, 'account');
}

/**
 * The live database of the vault, for the synchronous section of a handler. A vault closed since the
 * session check (the body took a while to arrive) is "not saved" before anything touches its closed
 * database - a statement on it would throw and become a 500.
 */
function liveDb(vault: UserVault): DiaryDb {
  if (vault.isClosed) throw notSaved();
  return vault.db;
}

/**
 * Puts every unsaved change of `db` on disk before the answer. Throws 503 when the write fails, when
 * the vault was closed meanwhile (a closed vault's persist writes nothing), or when the vault's
 * database is no longer `db` - a restore swapped it while this request ran, so the change written to
 * `db` was never persisted and the client must retry against the restored diary.
 */
async function persistOrFail(vault: UserVault, db: DiaryDb): Promise<void> {
  if (db.isDirty()) {
    try {
      await vault.persist();
    } catch {
      // Keep the data safe in memory and let the vault's own background retry try again soon.
      try {
        db.onWrite?.();
      } catch {
        /* nothing else to do: the client retries */
      }
      throw notSaved();
    }
  }
  if (vault.isClosed || vault.db !== db) throw notSaved();
}

/**
 * `Retry-After` for the cross-origin apps (§3.8, §4.5): the Windows app (`http://tauri.localhost`)
 * and the Android app (`https://localhost`) can read an answer header only when
 * `Access-Control-Expose-Headers` names it, and Retry-After is not a CORS-safelisted header - the
 * replayer would never see the 5 s of a 503 'server.sync.notSaved'. Appended to the list the CORS
 * middleware already set for an allowed origin: same-origin requests (the web UI) and other origins
 * stay exactly as before. app.ts (hosted mode only) mounts it in front of the session check of
 * /api/sync, so every answer here carries it, and in front of the other routes whose answers carry
 * Retry-After: /api/server/archive (429 'server.archive.tooSoon'), /api/auth (503
 * 'server.auth.guestsFull', the derivation gate's 503 'server.error.busy') and /api/backup (that 503
 * for a backup password). Every other route keeps the two download headers.
 */
export function exposeRetryAfter(_req: Request, res: Response, next: NextFunction): void {
  const current = res.getHeader('Access-Control-Expose-Headers');
  if (typeof current === 'string' && current && !/(^|,)\s*retry-after\s*(,|$)/i.test(current)) {
    res.setHeader('Access-Control-Expose-Headers', `${current}, Retry-After`);
  }
  next();
}

/**
 * Hosted /api/backup (app.ts, right after the session check): restores of the session's vault carry
 * the sync state - the same key, a new epoch (§3.7, `carrySyncState`). The local composition never
 * mounts it, so a local restore stays exactly the restored image.
 */
export function syncRestoreCarry(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth) enableSyncCarry(req.auth.vault);
  next();
}

function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

export function syncRouter(deps: AppDeps): Router {
  const r = Router();
  r.use(noStore);

  // GET /api/sync/key -> SyncKeyResponse. Creates `sync:key` and `sync:epoch` on the first call.
  r.get(
    '/key',
    wrap(async (req, res) => {
      const { vault } = ctxOf(req);
      const now = new Date();
      const db = liveDb(vault);
      pruneSyncTimes(db, now);
      const state = ensureSyncState(db);
      await persistOrFail(vault, db);
      const body: SyncKeyResponse = { key: state.key, epoch: state.epoch, serverNow: now.toISOString() };
      res.json(body);
    }),
  );

  // POST /api/sync/op SyncOp -> SyncOpResult
  r.post(
    '/op',
    wrap(async (req, res) => {
      const ctx = ctxOf(req);
      const { vault } = ctx;
      if (vault.isClosed) throw notSaved();
      const raw = req.body as { account?: unknown } | undefined;
      // Another account's operation is refused before anything else: a device must never turn it
      // into a "not saved" note, nor resolve its references in this diary.
      if (raw && typeof raw === 'object' && typeof raw.account === 'string' && raw.account !== ctx.user.id) throw accountMismatch();
      const op = validateSyncOp(req.body);
      if (op.account !== ctx.user.id) throw accountMismatch();
      const max = deps.hosted?.maxDiaryBytes ?? 0;
      const nowDate = new Date();
      const now = nowDate.toISOString();

      // From here to the persist nothing awaits: quota, prune and apply all see one database state,
      // and no other request (nor a restore's swap) interleaves with the decision and the write.
      const db = liveDb(vault);
      let result: ApplyResult;
      try {
        if (max > 0 && isGrowingKind(op.kind) && !vault.memoryOnly && diaryImageBytes(db) >= max) throw quotaExceeded(max);
        pruneSyncTimes(db, nowDate);
        result = db.transaction(() => applySyncOp(db, op, now));
      } catch (e) {
        // Safety net (nothing above awaits, so `liveDb` already covers it): a statement thrown on a
        // database whose vault is closed is "not saved", never a 500.
        if (vault.isClosed) throw notSaved();
        throw e;
      }
      await persistOrFail(vault, db);
      const answer: SyncOpResult = {
        opId: op.opId,
        outcome: result.outcome,
        record: result.record,
        ...(result.replaced !== undefined ? { replaced: result.replaced } : {}),
        ...(result.keys !== undefined ? { keys: result.keys } : {}),
        serverNow: now,
        epoch: readSyncState(db)?.epoch ?? '',
      };
      res.json(answer);
    }),
  );

  return r;
}
