/**
 * Shape check of one `POST /api/sync/op` body (docs/android-tasks/OFFLINE-DESIGN.md §3.4, handler
 * step 1). Turns an untrusted body into a `SyncOp` whose payloads went through the SAME validators
 * as the ordinary routes (`validateEntryInput`, `validateHabitInput`, `validateHabitLogInput`,
 * `validateSetting` per key - unknown setting keys are ignored, as `saveSettings` does), so a
 * replayed change is normalised exactly like an online one. Every text is made well-formed first
 * (a lone UTF-16 surrogate becomes U+FFFD - `wellFormedDeep`), so the payload equals what the diary
 * stores and a lost-response retry compares "unchanged" (§3.6). Every problem is a 400 VALIDATION with
 * a `field`: the validators' own keys for payloads, 'server.sync.badRequest' / 'badEditedAt' for
 * the envelope. Resolving a `SyncRef` against the diary (unknown clientId) happens in apply.ts.
 */
import {
  SYNC_ISO_RE,
  SYNC_OP_KINDS,
  SYNC_PROTOCOL,
  SYNC_UUID_RE,
  type HabitFields,
  type LogFields,
  type SyncOp,
  type SyncOpKind,
  type SyncRef,
} from '@shared/sync';
import type { AppSettings } from '@shared/types';
import { validateEntryInput } from '../db/entries-repo';
import { validateHabitInput, validateHabitLogInput } from '../db/habits-repo';
import { SETTING_KEYS, validateSetting } from '../db/settings-repo';
import { ApiError } from '../errors';
import { isIsoDate } from '../util/dates';

export const BAD_REQUEST_KEY = 'server.sync.badRequest';
export const BAD_EDITED_AT_KEY = 'server.sync.badEditedAt';
export const UNKNOWN_CLIENT_ID_KEY = 'server.sync.unknownClientId';

/** 400 VALIDATION 'server.sync.badRequest' naming the field at fault. */
export function badRequest(field: string): ApiError {
  return ApiError.localized(400, 'VALIDATION', BAD_REQUEST_KEY, undefined, field);
}

const EPOCH_RE = /^[0-9a-f]{16}$/;

/**
 * `editedAt`: the contract's shape AND a real instant - a round trip through `Date` gives the same
 * text. The shape alone lets '2026-02-30T10:00:00.000Z' through (`Date.parse` rolls it over to
 * 2 March; '24:00' to the next day); stored verbatim as created_at/updated_at such a value would be
 * compared as text in one place and as milliseconds in another, two days apart.
 */
function isInstant(v: string): boolean {
  if (!SYNC_ISO_RE.test(v)) return false;
  const ms = Date.parse(v);
  return Number.isFinite(ms) && new Date(ms).toISOString() === v;
}

const KINDS: ReadonlySet<string> = new Set(SYNC_OP_KINDS);

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function has(o: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, key) && o[key] !== undefined;
}

/** A lone UTF-16 surrogate: in `u` mode a proper pair is one (non-surrogate) code point, so only lone halves match. */
const LONE_SURROGATE = /\p{Cs}/u;
const LONE_SURROGATES = /\p{Cs}/gu;
/** Deeper than any payload or base nests (entry lists, calendarExtras); deeper values pass untouched (the validators judge them). */
const WELL_FORMED_MAX_DEPTH = 8;

/**
 * `value` with every string - object keys included - made well-formed: each lone surrogate becomes
 * U+FFFD, as `String.prototype.toWellFormed` does. A JSON body can carry "\uD83C" without its pair;
 * the diary stores UTF-8, which cannot hold it (it reads back as U+FFFD), so without this the
 * payload would never equal the stored row and the retry of an applied change would be a false
 * conflict instead of "unchanged" (§3.6). Returns `value` itself when nothing needs it (the usual
 * case) and copies only the objects and arrays that changed.
 */
export function wellFormedDeep(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return LONE_SURROGATE.test(value) ? value.replace(LONE_SURROGATES, '\uFFFD') : value;
  if (depth >= WELL_FORMED_MAX_DEPTH || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const next = wellFormedDeep(item, depth + 1);
      if (next !== item) changed = true;
      return next;
    });
    return changed ? out : value;
  }
  const o = value as Record<string, unknown>;
  let changed = false;
  const entries = Object.keys(o).map((key) => {
    const k = wellFormedDeep(key) as string;
    const v = wellFormedDeep(o[key], depth + 1);
    if (k !== key || v !== o[key]) changed = true;
    return [k, v] as const;
  });
  if (!changed) return value;
  const out: Record<string, unknown> = {};
  // defineProperty: an own key named "__proto__" (JSON.parse makes one) stays a plain property.
  for (const [k, v] of entries) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  return out;
}

function uuid(v: unknown, field: string): string {
  if (typeof v !== 'string' || !SYNC_UUID_RE.test(v)) throw badRequest(field);
  return v.toLowerCase();
}

function syncRef(v: unknown, field: string): SyncRef {
  if (!isObject(v)) throw badRequest(field);
  const hasId = has(v, 'id');
  const hasClientId = has(v, 'clientId');
  if (hasId === hasClientId) throw badRequest(field);
  if (hasId) {
    const id = v.id;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) throw badRequest(field);
    return { id };
  }
  return { clientId: uuid(v.clientId, field) };
}

/** `base` of an entry: the `updatedAt` the device showed (any string; compared as is). */
function entryBase(o: Record<string, unknown>): { base?: string } {
  if (!has(o, 'base')) return {};
  if (typeof o.base !== 'string') throw badRequest('base');
  return { base: o.base };
}

function habitFieldsBase(o: Record<string, unknown>): { base?: HabitFields } {
  if (!has(o, 'base')) return {};
  const b = o.base;
  if (!isObject(b)) throw badRequest('base');
  // Compared field by field with the stored habit (apply.ts); not re-validated - a base may describe
  // a habit written by an older app that today's rules would refuse.
  return {
    base: {
      name: b.name as string,
      description: b.description as string,
      target: b.target as number,
      unit: b.unit as string,
      frequency: b.frequency as HabitFields['frequency'],
      reminderTime: (b.reminderTime ?? null) as string | null,
      reminderEnabled: b.reminderEnabled as boolean,
    },
  };
}

function logFields(v: unknown, field: string): LogFields {
  if (!isObject(v) || typeof v.value !== 'number' || !Number.isFinite(v.value)) throw badRequest(field);
  if (v.note !== undefined && v.note !== null && typeof v.note !== 'string') throw badRequest(field);
  return { value: v.value, note: typeof v.note === 'string' ? v.note : '' };
}

/** `base` of a log: undefined = not known, null = "no log was there". */
function logBase(o: Record<string, unknown>): { base?: LogFields | null } {
  if (!Object.prototype.hasOwnProperty.call(o, 'base') || o.base === undefined) return {};
  if (o.base === null) return { base: null };
  return { base: logFields(o.base, 'base') };
}

function logDate(v: unknown): string {
  if (!isIsoDate(v)) throw ApiError.validation('server.entries.badDate', 'date');
  return v;
}

/** The validated `{ value, note }` of a log, through the route's own validator. */
function logPayload(v: unknown): LogFields {
  if (!isObject(v)) throw ApiError.validation('server.habits.logBodyObject');
  // habitId and date are checked elsewhere; a placeholder habit id lets the route validator run unchanged.
  const checked = validateHabitLogInput({ habitId: 1, date: '2000-01-01', value: v.value, note: v.note });
  return { value: checked.value, note: checked.note ?? '' };
}

/** The validated keys of a settings patch (unknown keys ignored, like `saveSettings`). */
function settingsPayload(v: unknown): Partial<AppSettings> {
  if (!isObject(v)) throw ApiError.validation('server.settings.bodyObject');
  const out: Partial<AppSettings> = {};
  for (const key of SETTING_KEYS) {
    if (!has(v, key)) continue;
    (out as Record<string, unknown>)[key] = validateSetting(key, v[key]);
  }
  return out;
}

function settingsBase(o: Record<string, unknown>): { base?: Partial<AppSettings> } {
  if (!has(o, 'base')) return {};
  if (!isObject(o.base)) throw badRequest('base');
  const out: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) if (Object.prototype.hasOwnProperty.call(o.base, key)) out[key] = o.base[key];
  return { base: out as Partial<AppSettings> };
}

/**
 * Validates one operation. Throws `ApiError` 400 (VALIDATION, with `field`) on the first problem.
 * The returned operation carries normalised payloads and lower-case UUIDs.
 */
export function validateSyncOp(raw: unknown): SyncOp {
  // Well-formed text first, so the validators (trim, de-duplication) and the content comparison of
  // apply.ts see exactly what the diary will store.
  const body = wellFormedDeep(raw);
  if (!isObject(body)) throw badRequest('body');
  if (body.v !== SYNC_PROTOCOL) throw badRequest('v');
  if (typeof body.kind !== 'string' || !KINDS.has(body.kind)) throw badRequest('kind');
  const kind = body.kind as SyncOpKind;
  if (typeof body.account !== 'string' || !body.account || body.account.length > 64) throw badRequest('account');
  const opId = uuid(body.opId, 'opId');
  if (typeof body.editedAt !== 'string' || !isInstant(body.editedAt)) {
    throw ApiError.localized(400, 'VALIDATION', BAD_EDITED_AT_KEY, undefined, 'editedAt');
  }
  if (typeof body.epoch !== 'string' || !EPOCH_RE.test(body.epoch)) throw badRequest('epoch');
  const common = { v: 1 as const, account: body.account, opId, editedAt: body.editedAt, epoch: body.epoch };

  switch (kind) {
    case 'entry.create':
      return { ...common, kind, clientId: uuid(body.clientId, 'clientId'), payload: validateEntryInput(body.payload) };
    case 'entry.update':
      return { ...common, kind, target: syncRef(body.target, 'target'), ...entryBase(body), payload: validateEntryInput(body.payload) };
    case 'entry.delete':
      return { ...common, kind, target: syncRef(body.target, 'target'), ...entryBase(body) };
    case 'habit.create':
      return { ...common, kind, clientId: uuid(body.clientId, 'clientId'), payload: validateHabitInput(body.payload) };
    case 'habit.update':
      return { ...common, kind, target: syncRef(body.target, 'target'), ...habitFieldsBase(body), payload: validateHabitInput(body.payload) };
    case 'habit.archive': {
      const target = syncRef(body.target, 'target');
      let base: { base?: { archived: boolean } } = {};
      if (has(body, 'base')) {
        if (!isObject(body.base) || typeof body.base.archived !== 'boolean') throw badRequest('base');
        base = { base: { archived: body.base.archived } };
      }
      const payload = isObject(body.payload) ? body.payload : {};
      if (typeof payload.archived !== 'boolean') throw ApiError.validation('server.habits.archivedBoolean', 'archived');
      return { ...common, kind, target, ...base, payload: { archived: payload.archived } };
    }
    case 'log.set':
      return { ...common, kind, habit: syncRef(body.habit, 'habit'), date: logDate(body.date), ...logBase(body), payload: logPayload(body.payload) };
    case 'log.delete':
      return { ...common, kind, habit: syncRef(body.habit, 'habit'), date: logDate(body.date), ...logBase(body) };
    case 'settings.patch':
      return { ...common, kind, ...settingsBase(body), payload: settingsPayload(body.payload) };
  }
}

/** True for the kinds that can grow the diary (the quota check, §3.4 step 3); deletes and archive always pass. */
export function isGrowingKind(kind: SyncOpKind): boolean {
  return kind === 'entry.create' || kind === 'entry.update' || kind === 'habit.create' || kind === 'habit.update' || kind === 'log.set' || kind === 'settings.patch';
}
