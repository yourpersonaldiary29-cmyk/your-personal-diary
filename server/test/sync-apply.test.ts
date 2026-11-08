/**
 * WP-H10a (docs/android-tasks/OFFLINE-DESIGN.md §3.4-3.6): the offline sync rules on an in-memory
 * diary - every kind x outcome, the shared `decide` / `clampEditedAt` / `nextVersion` tables,
 * idempotent replays, "a replay after another device's later write never overwrites it", the
 * permanent clientId rows, `stale` after an epoch change, field-scoped archive, settings per key,
 * and the content-equality normalisation (text with a lone UTF-16 surrogate included: a replay is
 * still "unchanged"). Fictional data only ("Dana", "Morning walk").
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  clampEditedAt,
  decide,
  nextVersion,
  settingsOutcome,
  SYNC_MAX_OP_BYTES,
  type SyncOp,
} from '@shared/sync';
import type { Entry, EntryInput, Habit, HabitInput, HabitLog } from '@shared/types';
import { DiaryDb } from '../src/db/database';
import { countEntries, getEntry, updateEntry } from '../src/db/entries-repo';
import { getHabit, listHabits } from '../src/db/habits-repo';
import { getMeta, getSettings } from '../src/db/settings-repo';
import { ApiError } from '../src/errors';
import { applySyncOp, type ApplyResult } from '../src/sync/apply';
import { ensureSyncState } from '../src/sync/store';
import { validateSyncOp, wellFormedDeep } from '../src/sync/validate';
import { sampleEntry } from './helpers';

const ACCOUNT = 'u_0123456789abcdef';
const NOW = '2026-10-23T12:00:00.000Z';
/** Fixed edit times, one minute apart: T(0) < T(1) < ... < NOW. */
const T = (minute: number) => new Date(Date.UTC(2026, 9, 20, 12, minute, 0)).toISOString();

type OpBody = Record<string, unknown>;

async function freshDb(): Promise<{ db: DiaryDb; epoch: string }> {
  const db = await DiaryDb.create();
  const { epoch } = ensureSyncState(db);
  return { db, epoch };
}

/** Validates like the route, then applies inside one transaction (as routes/sync.ts does). */
function run(db: DiaryDb, body: OpBody, now = NOW): ApplyResult {
  const op = validateSyncOp(body);
  return db.transaction(() => applySyncOp(db, op, now));
}

function base(epoch: string, kind: string, editedAt: string, extra: OpBody): OpBody {
  return { v: 1, account: ACCOUNT, opId: randomUUID(), editedAt, epoch, kind, ...extra };
}

function entryPayload(overrides: Record<string, unknown> = {}) {
  return sampleEntry({ title: 'Morning walk', body: 'Walked with Dana by the sea.', people: ['Dana'], tags: ['walk'], ...overrides });
}

function habitPayload(overrides: Partial<HabitInput> = {}): HabitInput {
  return { name: 'Water', description: '', target: 8, unit: 'glasses', frequency: 'daily', reminderTime: null, reminderEnabled: false, ...overrides };
}

function apiError(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('expected an ApiError');
}

describe('shared/sync.ts helpers', () => {
  it('clampEditedAt: min(editedAt, now)', () => {
    expect(clampEditedAt(T(1), NOW)).toBe(T(1));
    expect(clampEditedAt('2027-01-01T00:00:00.000Z', NOW)).toBe(NOW);
    expect(clampEditedAt(NOW, NOW)).toBe(NOW);
  });

  it('nextVersion: max(stored + 1 ms, ts); stored "" -> ts', () => {
    expect(nextVersion('', T(1))).toBe(T(1));
    expect(nextVersion(T(1), T(2))).toBe(T(2));
    expect(nextVersion(T(2), T(1))).toBe('2026-10-20T12:02:00.001Z');
    expect(nextVersion(T(2), T(2))).toBe('2026-10-20T12:02:00.001Z');
    // Unparsable stored values count as "no time" (never throw).
    expect(nextVersion('garbage', T(1))).toBe(T(1));
  });

  it('decide: the five rules in order', () => {
    const rows: Array<[Parameters<typeof decide>[0], ReturnType<typeof decide>]> = [
      [{ exists: false, same: true, baseKnown: true, baseMatches: true, ts: T(2), storedAt: T(1) }, 'gone'],
      [{ exists: true, same: true, baseKnown: false, baseMatches: false, ts: T(0), storedAt: T(1) }, 'unchanged'],
      [{ exists: true, same: false, baseKnown: true, baseMatches: true, ts: T(0), storedAt: T(1) }, 'applied'],
      [{ exists: true, same: false, baseKnown: true, baseMatches: false, ts: T(2), storedAt: T(1) }, 'conflict-won'],
      [{ exists: true, same: false, baseKnown: false, baseMatches: false, ts: T(2), storedAt: T(1) }, 'conflict-won'],
      [{ exists: true, same: false, baseKnown: true, baseMatches: false, ts: T(1), storedAt: T(1) }, 'conflict-lost'],
      [{ exists: true, same: false, baseKnown: true, baseMatches: false, ts: T(0), storedAt: T(1) }, 'conflict-lost'],
      // storedAt '' (older app, pruned) is older than any change.
      [{ exists: true, same: false, baseKnown: true, baseMatches: false, ts: T(0), storedAt: '' }, 'conflict-won'],
      // baseKnown false: baseMatches is ignored.
      [{ exists: true, same: false, baseKnown: false, baseMatches: true, ts: T(0), storedAt: T(1) }, 'conflict-lost'],
    ];
    for (const [input, expected] of rows) expect({ input, out: decide(input) }).toEqual({ input, out: expected });
  });

  it('settingsOutcome: won > applied > lost > unchanged', () => {
    expect(settingsOutcome({})).toBe('unchanged');
    expect(settingsOutcome({ theme: 'unchanged' })).toBe('unchanged');
    expect(settingsOutcome({ theme: 'conflict-lost', language: 'unchanged' })).toBe('conflict-lost');
    expect(settingsOutcome({ theme: 'conflict-lost', language: 'applied' })).toBe('applied');
    expect(settingsOutcome({ theme: 'applied', language: 'conflict-won' })).toBe('conflict-won');
  });

  it('the largest operation stays under the data body limit', () => {
    expect(SYNC_MAX_OP_BYTES).toBeLessThan(2 * 1024 * 1024);
  });
});

describe('validateSyncOp: the envelope and the payloads (400 with a field)', () => {
  const epoch = '0123456789abcdef';
  const good = () => base(epoch, 'entry.create', T(1), { clientId: randomUUID(), payload: entryPayload() });

  it('accepts a valid operation and normalises its payload like the routes', () => {
    const op = validateSyncOp({ ...good(), payload: entryPayload({ tags: ['#walk', 'walk', ' sea '] }) });
    expect(op.kind).toBe('entry.create');
    expect((op as Extract<SyncOp, { kind: 'entry.create' }>).payload.tags).toEqual(['walk', 'sea']);
  });

  it('refuses a bad envelope with server.sync.badRequest / badEditedAt and the field', () => {
    const cases: Array<[OpBody, string, string]> = [
      [{ ...good(), v: 2 }, 'v', 'server.sync.badRequest'],
      [{ ...good(), kind: 'entry.rename' }, 'kind', 'server.sync.badRequest'],
      [{ ...good(), account: 7 }, 'account', 'server.sync.badRequest'],
      [{ ...good(), opId: 'not-a-uuid' }, 'opId', 'server.sync.badRequest'],
      [{ ...good(), editedAt: '2026-10-20T12:00:00Z' }, 'editedAt', 'server.sync.badEditedAt'],
      [{ ...good(), editedAt: '2026-13-45T99:00:00.000Z' }, 'editedAt', 'server.sync.badEditedAt'],
      [{ ...good(), epoch: 'XYZ' }, 'epoch', 'server.sync.badRequest'],
      [{ ...good(), clientId: 'nope' }, 'clientId', 'server.sync.badRequest'],
      [base(epoch, 'entry.update', T(1), { target: { id: 1, clientId: randomUUID() }, payload: entryPayload() }), 'target', 'server.sync.badRequest'],
      [base(epoch, 'entry.update', T(1), { target: { id: 0 }, payload: entryPayload() }), 'target', 'server.sync.badRequest'],
      [base(epoch, 'entry.delete', T(1), { target: { id: 1 }, base: 5 }), 'base', 'server.sync.badRequest'],
      [base(epoch, 'habit.archive', T(1), { target: { id: 1 }, base: { archived: 'yes' }, payload: { archived: true } }), 'base', 'server.sync.badRequest'],
      [base(epoch, 'log.set', T(1), { habit: { clientId: 'x' }, date: '2026-10-20', payload: { value: 1 } }), 'habit', 'server.sync.badRequest'],
      [base(epoch, 'settings.patch', T(1), { base: [1], payload: { theme: 'dark' } }), 'base', 'server.sync.badRequest'],
      [[] as unknown as OpBody, 'body', 'server.sync.badRequest'],
    ];
    for (const [body, field, key] of cases) {
      const e = apiError(() => validateSyncOp(body));
      expect({ field, got: { status: e.status, code: e.code, field: e.field, key: e.key } }).toEqual({ field, got: { status: 400, code: 'VALIDATION', field, key } });
    }
  });

  it('refuses an editedAt that has the shape but is not a real instant (a rolled-over date or hour)', () => {
    // `Date.parse` accepts these and rolls them over (30 February -> 2 March, 24:00 -> the next day),
    // so the shape alone would store a time `toISOString` never writes - compared as text in one
    // place and as milliseconds in another, two days apart.
    for (const editedAt of ['2026-02-30T10:00:00.000Z', '2026-04-31T00:00:00.000Z', '2027-02-29T12:00:00.000Z', '2026-10-20T24:00:00.000Z']) {
      const e = apiError(() => validateSyncOp({ ...good(), editedAt }));
      expect({ editedAt, got: [e.status, e.field, e.key] }).toEqual({ editedAt, got: [400, 'editedAt', 'server.sync.badEditedAt'] });
    }
    // Real instants - a leap day, the last millisecond of a year - pass and are kept exactly.
    for (const editedAt of ['2028-02-29T12:00:00.000Z', '2026-12-31T23:59:59.999Z']) {
      expect(validateSyncOp({ ...good(), editedAt }).editedAt).toBe(editedAt);
    }
  });

  it('refuses bad payloads with the ordinary validators (same keys and fields as the routes)', () => {
    const cases: Array<[OpBody, string, string]> = [
      [{ ...good(), payload: entryPayload({ title: 'x'.repeat(201) }) }, 'title', 'server.entries.fieldTooLong'],
      [{ ...good(), payload: entryPayload({ date: '2026-02-30' }) }, 'date', 'server.entries.badDate'],
      [base(epoch, 'habit.create', T(1), { clientId: randomUUID(), payload: habitPayload({ target: 0 }) }), 'target', 'server.habits.targetPositive'],
      [base(epoch, 'habit.archive', T(1), { target: { id: 1 }, payload: {} }), 'archived', 'server.habits.archivedBoolean'],
      [base(epoch, 'log.set', T(1), { habit: { id: 1 }, date: '2026-10-20', payload: { value: -1 } }), 'value', 'server.habits.valueRange'],
      [base(epoch, 'log.delete', T(1), { habit: { id: 1 }, date: '20.10.2026' }), 'date', 'server.entries.badDate'],
      [base(epoch, 'settings.patch', T(1), { payload: { theme: 'neon' } }), 'theme', 'server.settings.themeInvalid'],
    ];
    for (const [body, field, key] of cases) {
      const e = apiError(() => validateSyncOp(body));
      expect({ field, got: { status: e.status, field: e.field, key: e.key } }).toEqual({ field, got: { status: 400, field, key } });
    }
  });

  it('ignores unknown setting keys, as saveSettings does', () => {
    const op = validateSyncOp(base(epoch, 'settings.patch', T(1), { payload: { theme: 'dark', colour: 'red' } }));
    expect((op as Extract<SyncOp, { kind: 'settings.patch' }>).payload).toEqual({ theme: 'dark' });
  });
});

describe('entries', () => {
  it('entry.create: applied once with the edit time as createdAt/updatedAt; the same operation again is unchanged (one row)', async () => {
    const { db, epoch } = await freshDb();
    const body = base(epoch, 'entry.create', T(1), { clientId: randomUUID(), payload: entryPayload() });
    const first = run(db, body);
    expect(first.outcome).toBe('applied');
    const entry = first.record as Entry;
    expect(entry).toMatchObject({ title: 'Morning walk', createdAt: T(1), updatedAt: T(1) });
    const again = run(db, body);
    expect(again).toEqual({ outcome: 'unchanged', record: entry });
    // Even under a new opId (a coalesced resend keeps the clientId).
    expect(run(db, { ...body, opId: randomUUID() }).outcome).toBe('unchanged');
    expect(countEntries(db)).toBe(1);
  });

  it('a device clock in the future is clamped to the server time', async () => {
    const { db, epoch } = await freshDb();
    const r = run(db, base(epoch, 'entry.create', '2030-01-01T00:00:00.000Z', { clientId: randomUUID(), payload: entryPayload() }));
    expect((r.record as Entry).createdAt).toBe(NOW);
  });

  it('the clientId row survives deletion: create, delete, replayed create -> unchanged and no row', async () => {
    const { db, epoch } = await freshDb();
    const clientId = randomUUID();
    const create = base(epoch, 'entry.create', T(1), { clientId, payload: entryPayload() });
    const created = run(db, create).record as Entry;
    expect(getMeta(db, `sync:cid:entry:${clientId}`)).toBe(String(created.id));
    const del = run(db, base(epoch, 'entry.delete', T(2), { target: { clientId }, base: created.updatedAt }));
    expect(del).toEqual({ outcome: 'applied', record: null });
    expect(run(db, create)).toEqual({ outcome: 'unchanged', record: null });
    expect(countEntries(db)).toBe(0);
    expect(getMeta(db, `sync:cid:entry:${clientId}`)).toBe(String(created.id));
  });

  it('entry.update: applied with a matching base (by id or by clientId); the version moves forward', async () => {
    const { db, epoch } = await freshDb();
    const clientId = randomUUID();
    const created = run(db, base(epoch, 'entry.create', T(1), { clientId, payload: entryPayload() })).record as Entry;
    const byClient = run(db, base(epoch, 'entry.update', T(2), { target: { clientId }, base: created.updatedAt, payload: entryPayload({ title: 'Evening walk' }) }));
    expect(byClient.outcome).toBe('applied');
    expect(byClient.record).toMatchObject({ id: created.id, title: 'Evening walk', updatedAt: T(2), createdAt: T(1) });
    // A base matching but an edit time older than the stored version: still applied, version stored + 1 ms.
    const byId = run(db, base(epoch, 'entry.update', T(0), { target: { id: created.id }, base: T(2), payload: entryPayload({ title: 'Night walk' }) }));
    expect(byId.outcome).toBe('applied');
    expect((byId.record as Entry).updatedAt).toBe('2026-10-20T12:02:00.001Z');
  });

  it('entry.update: unchanged for equal content - tags and arrays normalised like the route', async () => {
    const { db, epoch } = await freshDb();
    const created = run(db, base(epoch, 'entry.create', T(1), { clientId: randomUUID(), payload: entryPayload({ tags: ['#walk', 'sea'], people: [' Dana ', 'Dana'] }) })).record as Entry;
    expect(created.tags).toEqual(['walk', 'sea']);
    expect(created.people).toEqual(['Dana']);
    const same = run(db, base(epoch, 'entry.update', T(3), { target: { id: created.id }, base: 'stale-base', payload: entryPayload({ tags: ['walk', '#sea', 'walk'], people: ['Dana'] }) }));
    expect(same).toEqual({ outcome: 'unchanged', record: created });
    // Order of a list is content: a different order is a change.
    const reordered = run(db, base(epoch, 'entry.update', T(3), { target: { id: created.id }, base: created.updatedAt, payload: entryPayload({ tags: ['sea', 'walk'], people: ['Dana'] }) }));
    expect(reordered.outcome).toBe('applied');
  });

  it('entry.update conflicts: the newer edit wins (replaced = the overwritten version); the older loses (record = the kept one)', async () => {
    const { db, epoch } = await freshDb();
    const created = run(db, base(epoch, 'entry.create', T(1), { clientId: randomUUID(), payload: entryPayload() })).record as Entry;
    // Device B edits at T(3).
    const b = run(db, base(epoch, 'entry.update', T(3), { target: { id: created.id }, base: created.updatedAt, payload: entryPayload({ title: 'From B' }) })).record as Entry;
    // Device A edited offline at T(2) from the old base: loses.
    const lost = run(db, base(epoch, 'entry.update', T(2), { target: { id: created.id }, base: created.updatedAt, payload: entryPayload({ title: 'From A' }) }));
    expect(lost).toEqual({ outcome: 'conflict-lost', record: b });
    expect(getEntry(db, created.id).title).toBe('From B');
    // Device A edited offline at T(4): wins, and the server returns B's version once.
    const won = run(db, base(epoch, 'entry.update', T(4), { target: { id: created.id }, base: created.updatedAt, payload: entryPayload({ title: 'From A, later' }) }));
    expect(won.outcome).toBe('conflict-won');
    expect(won.replaced).toEqual(b);
    expect(won.record).toMatchObject({ title: 'From A, later', updatedAt: T(4) });
  });

  it('a replay after another device\'s later write never overwrites it (lost 200, then a retry)', async () => {
    const { db, epoch } = await freshDb();
    const created = run(db, base(epoch, 'entry.create', T(1), { clientId: randomUUID(), payload: entryPayload() })).record as Entry;
    const op = base(epoch, 'entry.update', T(2), { target: { id: created.id }, base: created.updatedAt, payload: entryPayload({ title: 'From A' }) });
    expect(run(db, op).outcome).toBe('applied');
    // The 200 was lost; meanwhile device B wrote through the ordinary route (server time later).
    updateEntry(db, created.id, { ...(entryPayload({ title: 'From B' }) as EntryInput) }, { at: T(5) });
    const retry = run(db, op);
    expect(retry.outcome).toBe('conflict-lost');
    expect(getEntry(db, created.id).title).toBe('From B');
    // Without B's write the retry is simply unchanged.
    const { db: db2, epoch: e2 } = await freshDb();
    const c2 = run(db2, base(e2, 'entry.create', T(1), { clientId: randomUUID(), payload: entryPayload() })).record as Entry;
    const op2 = base(e2, 'entry.update', T(2), { target: { id: c2.id }, base: c2.updatedAt, payload: entryPayload({ title: 'From A' }) });
    expect(run(db2, op2).outcome).toBe('applied');
    expect(run(db2, op2).outcome).toBe('unchanged');
  });

  it('entry.update of a record deleted on the server is gone, and nothing comes back', async () => {
    const { db, epoch } = await freshDb();
    const created = run(db, base(epoch, 'entry.create', T(1), { clientId: randomUUID(), payload: entryPayload() })).record as Entry;
    run(db, base(epoch, 'entry.delete', T(2), { target: { id: created.id }, base: created.updatedAt }));
    const gone = run(db, base(epoch, 'entry.update', T(9), { target: { id: created.id }, base: created.updatedAt, payload: entryPayload({ title: 'Edited offline' }) }));
    expect(gone).toEqual({ outcome: 'gone', record: null });
    expect(countEntries(db)).toBe(0);
  });

  it('entry.delete: unchanged when already gone; loses to a later change elsewhere; wins over an earlier one (replaced)', async () => {
    const { db, epoch } = await freshDb();
    expect(run(db, base(epoch, 'entry.delete', T(1), { target: { id: 77 } }))).toEqual({ outcome: 'unchanged', record: null });
    const created = run(db, base(epoch, 'entry.create', T(1), { clientId: randomUUID(), payload: entryPayload() })).record as Entry;
    const b = run(db, base(epoch, 'entry.update', T(3), { target: { id: created.id }, base: created.updatedAt, payload: entryPayload({ title: 'From B' }) })).record as Entry;
    // A deleted at T(2) from the old base: B changed it later -> not deleted.
    const lost = run(db, base(epoch, 'entry.delete', T(2), { target: { id: created.id }, base: created.updatedAt }));
    expect(lost).toEqual({ outcome: 'conflict-lost', record: b });
    expect(countEntries(db)).toBe(1);
    // A deleted at T(4): the delete wins and B's version travels back.
    const won = run(db, base(epoch, 'entry.delete', T(4), { target: { id: created.id }, base: created.updatedAt }));
    expect(won).toEqual({ outcome: 'conflict-won', record: null, replaced: b });
    expect(countEntries(db)).toBe(0);
  });

  it('stale after an epoch change: updates and deletes by id are refused, creates still apply', async () => {
    const { db, epoch } = await freshDb();
    const created = run(db, base(epoch, 'entry.create', T(1), { clientId: randomUUID(), payload: entryPayload() })).record as Entry;
    const old = 'ffffffffffffffff';
    expect(run(db, base(old, 'entry.update', T(2), { target: { id: created.id }, base: created.updatedAt, payload: entryPayload({ title: 'x' }) }))).toEqual({ outcome: 'stale', record: null });
    expect(run(db, base(old, 'entry.delete', T(2), { target: { id: created.id } })).outcome).toBe('stale');
    expect(run(db, base(old, 'entry.create', T(2), { clientId: randomUUID(), payload: entryPayload() })).outcome).toBe('applied');
    expect(getEntry(db, created.id).title).toBe('Morning walk');
  });

  it('a reference to a clientId the server never saw: 400 server.sync.unknownClientId, nothing written', async () => {
    const { db, epoch } = await freshDb();
    const e = apiError(() => run(db, base(epoch, 'entry.update', T(1), { target: { clientId: randomUUID() }, payload: entryPayload() })));
    expect({ status: e.status, key: e.key, field: e.field }).toEqual({ status: 400, key: 'server.sync.unknownClientId', field: 'target' });
    const h = apiError(() => run(db, base(epoch, 'log.set', T(1), { habit: { clientId: randomUUID() }, date: '2026-10-20', payload: { value: 1 } })));
    expect({ status: h.status, key: h.key, field: h.field }).toEqual({ status: 400, key: 'server.sync.unknownClientId', field: 'habit' });
    expect(countEntries(db)).toBe(0);
  });
});

describe('habits', () => {
  it('habit.create: applied once, createdAt = edit time, a time row; replay unchanged', async () => {
    const { db, epoch } = await freshDb();
    const body = base(epoch, 'habit.create', T(1), { clientId: randomUUID(), payload: habitPayload() });
    const r = run(db, body);
    expect(r.outcome).toBe('applied');
    const habit = r.record as Habit;
    expect(habit).toMatchObject({ name: 'Water', createdAt: T(1), isArchived: false });
    expect(getMeta(db, `sync:t:habit:${habit.id}`)).toBe(T(1));
    expect(run(db, body)).toEqual({ outcome: 'unchanged', record: habit });
    expect(listHabits(db, true)).toHaveLength(1);
  });

  it('habit.update: applied / unchanged / conflict-won (replaced) / conflict-lost / gone / stale', async () => {
    const { db, epoch } = await freshDb();
    const clientId = randomUUID();
    const h = run(db, base(epoch, 'habit.create', T(1), { clientId, payload: habitPayload() })).record as Habit;
    const fields = { name: h.name, description: h.description, target: h.target, unit: h.unit, frequency: h.frequency, reminderTime: h.reminderTime, reminderEnabled: h.reminderEnabled };
    const applied = run(db, base(epoch, 'habit.update', T(2), { target: { clientId }, base: fields, payload: habitPayload({ target: 6 }) }));
    expect(applied.outcome).toBe('applied');
    expect(getMeta(db, `sync:t:habit:${h.id}`)).toBe(T(2));
    expect(run(db, base(epoch, 'habit.update', T(9), { target: { id: h.id }, payload: habitPayload({ target: 6 }) })).outcome).toBe('unchanged');
    // Old base, older edit: loses to the stored T(2).
    const lost = run(db, base(epoch, 'habit.update', T(1), { target: { id: h.id }, base: fields, payload: habitPayload({ name: 'Tea' }) }));
    expect(lost.outcome).toBe('conflict-lost');
    expect((lost.record as Habit).target).toBe(6);
    // Old base, newer edit: wins, the overwritten version is returned.
    const won = run(db, base(epoch, 'habit.update', T(3), { target: { id: h.id }, base: fields, payload: habitPayload({ name: 'Tea' }) }));
    expect(won.outcome).toBe('conflict-won');
    expect((won.replaced as Habit).target).toBe(6);
    expect(getHabit(db, h.id)).toMatchObject({ name: 'Tea', target: 8 });
    expect(run(db, base(epoch, 'habit.update', T(4), { target: { id: 999 }, payload: habitPayload() }))).toEqual({ outcome: 'gone', record: null });
    expect(run(db, base('0000000000000000', 'habit.update', T(4), { target: { id: h.id }, payload: habitPayload() })).outcome).toBe('stale');
  });

  it('a habit written by an older app (no time row) loses to any queued change, which gets it back as replaced', async () => {
    const { db, epoch } = await freshDb();
    db.run(
      "INSERT INTO habits (name, description, target, unit, frequency, reminder_time, reminder_enabled, is_archived, sort_order, created_at) VALUES ('Read', '', 1, 'pages', 'daily', NULL, 0, 0, 0, '2026-01-01T00:00:00.000Z')",
    );
    const won = run(db, base(epoch, 'habit.update', T(0), { target: { id: 1 }, base: { name: 'Old' }, payload: habitPayload({ name: 'Read more' }) }));
    expect(won.outcome).toBe('conflict-won');
    expect((won.replaced as Habit).name).toBe('Read');
  });

  it('habit.archive is field-scoped: a rename elsewhere and an archive here both survive', async () => {
    const { db, epoch } = await freshDb();
    const h = run(db, base(epoch, 'habit.create', T(1), { clientId: randomUUID(), payload: habitPayload() })).record as Habit;
    const fields = { name: h.name, description: h.description, target: h.target, unit: h.unit, frequency: h.frequency, reminderTime: h.reminderTime, reminderEnabled: h.reminderEnabled };
    // Device B renames at T(5).
    expect(run(db, base(epoch, 'habit.update', T(5), { target: { id: h.id }, base: fields, payload: habitPayload({ name: 'Water (big)' }) })).outcome).toBe('applied');
    // Device A archived offline at T(2), from what it saw (not archived).
    const archived = run(db, base(epoch, 'habit.archive', T(2), { target: { id: h.id }, base: { archived: false }, payload: { archived: true } }));
    expect(archived.outcome).toBe('applied');
    expect(getHabit(db, h.id)).toMatchObject({ name: 'Water (big)', isArchived: true });
    // Same again: unchanged. Unarchive from a stale base and an older time: lost.
    expect(run(db, base(epoch, 'habit.archive', T(2), { target: { id: h.id }, payload: { archived: true } })).outcome).toBe('unchanged');
    expect(run(db, base(epoch, 'habit.archive', T(1), { target: { id: h.id }, base: { archived: false }, payload: { archived: false } })).outcome).toBe('conflict-lost');
    expect(run(db, base(epoch, 'habit.archive', T(9), { target: { id: 404 }, payload: { archived: true } }))).toEqual({ outcome: 'gone', record: null });
  });
});

describe('habit logs', () => {
  it('log.set / log.delete: applied, unchanged, conflicts per (habit, date), gone for a deleted habit', async () => {
    const { db, epoch } = await freshDb();
    const clientId = randomUUID();
    const h = run(db, base(epoch, 'habit.create', T(1), { clientId, payload: habitPayload({ target: 3 }) })).record as Habit;
    const date = '2026-10-20';
    // A log on a habit created offline (by clientId), from "no log was there".
    const set = run(db, base(epoch, 'log.set', T(2), { habit: { clientId }, date, base: null, payload: { value: 2, note: ' tea ' } }));
    expect(set.outcome).toBe('applied');
    expect(set.record).toMatchObject({ habitId: h.id, date, value: 2, note: 'tea', completed: false });
    expect(getMeta(db, `sync:t:log:${h.id}:${date}`)).toBe(T(2));
    expect(run(db, base(epoch, 'log.set', T(3), { habit: { id: h.id }, date, payload: { value: 2, note: 'tea' } })).outcome).toBe('unchanged');
    // Device B logs 3 at T(4); device A's later 2 (T(5)) from the old base wins (C7), B's log returns.
    const b = run(db, base(epoch, 'log.set', T(4), { habit: { id: h.id }, date, base: { value: 2, note: 'tea' }, payload: { value: 3, note: '' } })).record as HabitLog;
    expect(b.completed).toBe(true);
    const won = run(db, base(epoch, 'log.set', T(5), { habit: { id: h.id }, date, base: null, payload: { value: 2, note: '' } }));
    expect(won.outcome).toBe('conflict-won');
    expect(won.replaced).toEqual(b);
    expect((won.record as HabitLog).value).toBe(2);
    // An older one loses.
    const lost = run(db, base(epoch, 'log.set', T(3), { habit: { id: h.id }, date, base: null, payload: { value: 9, note: '' } }));
    expect(lost.outcome).toBe('conflict-lost');
    expect((lost.record as HabitLog).value).toBe(2);
    // Deletes.
    expect(run(db, base(epoch, 'log.delete', T(6), { habit: { id: h.id }, date: '2026-10-01' }))).toEqual({ outcome: 'unchanged', record: null });
    expect(run(db, base(epoch, 'log.delete', T(4), { habit: { id: h.id }, date, base: { value: 3, note: '' } })).outcome).toBe('conflict-lost');
    expect(run(db, base(epoch, 'log.delete', T(7), { habit: { id: h.id }, date, base: { value: 2, note: '' } }))).toEqual({ outcome: 'applied', record: null });
    expect(run(db, base(epoch, 'log.set', T(8), { habit: { id: 404 }, date, payload: { value: 1, note: '' } }))).toEqual({ outcome: 'gone', record: null });
    expect(run(db, base('1111111111111111', 'log.set', T(8), { habit: { id: h.id }, date, payload: { value: 1, note: '' } })).outcome).toBe('stale');
  });
});

describe('settings', () => {
  it('settings.patch: per key - unchanged, applied, lost; the epoch is ignored', async () => {
    const { db, epoch } = await freshDb();
    // Device B: theme dark at T(3) (from the default 'system').
    const b = run(db, base(epoch, 'settings.patch', T(3), { base: { theme: 'system' }, payload: { theme: 'dark' } }));
    expect(b).toMatchObject({ outcome: 'applied', keys: { theme: 'applied' } });
    expect(getMeta(db, 'sync:t:set:theme')).toBe(T(3));
    // Device A offline at T(2): language and theme (C5): language applies, theme loses.
    const a = run(db, base('2222222222222222', 'settings.patch', T(2), { base: { language: 'en', theme: 'system' }, payload: { language: 'he', theme: 'light' } }));
    expect(a.outcome).toBe('applied');
    expect(a.keys).toEqual({ language: 'applied', theme: 'conflict-lost' });
    expect(a.record).toMatchObject({ language: 'he', theme: 'dark' });
    // A newer conflicting value wins and returns the overwritten one.
    const won = run(db, base(epoch, 'settings.patch', T(4), { base: { theme: 'system' }, payload: { theme: 'high-contrast', fontScale: 1 } }));
    expect(won).toMatchObject({ outcome: 'conflict-won', keys: { theme: 'conflict-won', fontScale: 'unchanged' }, replaced: { theme: 'dark' } });
    expect(getSettings(db).theme).toBe('high-contrast');
    // Objects compare by content, whatever the key order.
    const extras = getSettings(db).calendarExtras;
    const reversed = Object.fromEntries(Object.entries(extras).reverse());
    expect(run(db, base(epoch, 'settings.patch', T(5), { payload: { calendarExtras: reversed } })).outcome).toBe('unchanged');
    expect(run(db, base(epoch, 'settings.patch', T(5), { payload: {} }))).toMatchObject({ outcome: 'unchanged', keys: {} });
  });
});

describe('text with a lone UTF-16 surrogate: a lost-response retry is still "unchanged" (§3.6)', () => {
  // A JSON body can carry "\uD83C" without its pair (a device that cut an emoji in half). The diary
  // stores UTF-8, which cannot hold it: it would read back as U+FFFD, so comparing the payload with
  // the stored row would call the retry of an applied change a conflict ("changed on another device
  // after your change"). The validator makes every text well-formed first (lone surrogate -> U+FFFD,
  // what `String.prototype.toWellFormed` does), so the payload equals what is stored.
  const LONE_HIGH = 'Walked by the sea \uD83C';
  const LONE_LOW = 'Water \uDE00';
  const epoch = '0123456789abcdef';

  it('validateSyncOp replaces lone surrogates with U+FFFD, in payloads and bases; pairs, Hebrew and plain text stay as they are', () => {
    const entry = validateSyncOp(
      base(epoch, 'entry.create', T(1), {
        clientId: randomUUID(),
        payload: entryPayload({ title: 'בוקר 🌊', body: LONE_HIGH, tags: ['sea\uDC00'], people: ['\uD800Dana'] }),
      }),
    ) as Extract<SyncOp, { kind: 'entry.create' }>;
    expect(entry.payload.title).toBe('בוקר 🌊');
    expect(entry.payload.body).toBe('Walked by the sea \uFFFD');
    expect(entry.payload.tags).toEqual(['sea\uFFFD']);
    expect(entry.payload.people).toEqual(['\uFFFDDana']);
    const habit = validateSyncOp(
      base(epoch, 'habit.update', T(1), { target: { id: 1 }, base: habitPayload({ name: LONE_LOW }), payload: habitPayload({ name: LONE_LOW, unit: '\uDBFF\uDBFF' }) }),
    ) as Extract<SyncOp, { kind: 'habit.update' }>;
    expect(habit.payload).toMatchObject({ name: 'Water \uFFFD', unit: '\uFFFD\uFFFD' });
    expect(habit.base?.name).toBe('Water \uFFFD');
    const log = validateSyncOp(
      base(epoch, 'log.set', T(1), { habit: { id: 1 }, date: '2026-10-20', base: { value: 1, note: 'a\uD83C' }, payload: { value: 2, note: '\uDE00b' } }),
    ) as Extract<SyncOp, { kind: 'log.set' }>;
    expect(log.payload.note).toBe('\uFFFDb');
    expect(log.base).toEqual({ value: 1, note: 'a\uFFFD' });
    // Well-formed text is untouched.
    const plain = entryPayload();
    expect((validateSyncOp(base(epoch, 'entry.create', T(1), { clientId: randomUUID(), payload: plain })) as Extract<SyncOp, { kind: 'entry.create' }>).payload.body).toBe(plain.body);
  });

  it('entry.update: applied once; the same operation again (a lost 200, then the retry) is unchanged, not conflict-lost', async () => {
    const { db, epoch: e } = await freshDb();
    const created = run(db, base(e, 'entry.create', T(1), { clientId: randomUUID(), payload: entryPayload() })).record as Entry;
    const update = base(e, 'entry.update', T(2), { target: { id: created.id }, base: created.updatedAt, payload: entryPayload({ body: LONE_HIGH }) });
    const first = run(db, update);
    expect(first.outcome).toBe('applied');
    expect(getEntry(db, created.id).body).toBe('Walked by the sea \uFFFD');
    expect(run(db, update)).toEqual({ outcome: 'unchanged', record: first.record });
    // A create with such text, then an update with the very same payload: equal content.
    const clientId = randomUUID();
    const withLone = entryPayload({ title: 'Sea \uD83C', tags: ['sea\uDC00'] });
    const made = run(db, base(e, 'entry.create', T(3), { clientId, payload: withLone })).record as Entry;
    expect(run(db, base(e, 'entry.update', T(4), { target: { clientId }, base: made.updatedAt, payload: withLone }))).toEqual({ outcome: 'unchanged', record: made });
  });

  it('habit.update and log.set: applied once, the replay is unchanged', async () => {
    const { db, epoch: e } = await freshDb();
    const h = run(db, base(e, 'habit.create', T(1), { clientId: randomUUID(), payload: habitPayload() })).record as Habit;
    const rename = base(e, 'habit.update', T(2), { target: { id: h.id }, base: habitPayload(), payload: habitPayload({ name: LONE_LOW }) });
    const renamed = run(db, rename);
    expect(renamed.outcome).toBe('applied');
    expect(getHabit(db, h.id).name).toBe('Water \uFFFD');
    expect(run(db, rename)).toEqual({ outcome: 'unchanged', record: renamed.record });
    const logOp = base(e, 'log.set', T(3), { habit: { id: h.id }, date: '2026-10-20', base: null, payload: { value: 2, note: 'tea \uD83C' } });
    const logged = run(db, logOp);
    expect(logged.outcome).toBe('applied');
    expect((logged.record as HabitLog).note).toBe('tea \uFFFD');
    expect(run(db, logOp)).toEqual({ outcome: 'unchanged', record: logged.record });
  });
});

describe('wellFormedDeep (the validator\'s first step)', () => {
  const R = String.fromCharCode(0xfffd);
  const HIGH = String.fromCharCode(0xd83c);
  const LOW = String.fromCharCode(0xdc00);

  it('returns the very value when nothing needs it, and copies only what changed', () => {
    const clean = { a: ['x', { b: 'y' }], n: 1, t: true, z: null, pair: 'sea ' + HIGH + String.fromCharCode(0xdf0a) };
    expect(wellFormedDeep(clean)).toBe(clean);
    const mixed = { keep: { b: 'y' }, fix: ['ok', 'a' + LOW] };
    const out = wellFormedDeep(mixed) as typeof mixed;
    expect(out).toEqual({ keep: { b: 'y' }, fix: ['ok', 'a' + R] });
    expect(out.keep).toBe(mixed.keep);
    expect(mixed.fix[1]).toBe('a' + LOW);
  });

  it('object keys too; an own "__proto__" key (JSON.parse makes one) stays a plain property - nothing is polluted', () => {
    const parsed = JSON.parse('{"__proto__":' + JSON.stringify({ note: 'x' + HIGH }) + ',' + JSON.stringify({ ['k' + LOW]: 1 }).slice(1)) as Record<string, unknown>;
    const out = wellFormedDeep(parsed) as Record<string, unknown>;
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.keys(out)).toEqual(['__proto__', 'k' + R]);
    expect(Object.getOwnPropertyDescriptor(out, '__proto__')?.value).toEqual({ note: 'x' + R });
    expect(({} as Record<string, unknown>).note).toBeUndefined();
  });

  it('values nested deeper than any payload are left to the validators (bounded walk)', () => {
    let deep: unknown = 'x' + HIGH;
    for (let i = 0; i < 12; i++) deep = [deep];
    expect(wellFormedDeep(deep)).toBe(deep);
  });
});
