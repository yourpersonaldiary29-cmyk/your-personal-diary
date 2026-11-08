import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Entry, EntryInput, HabitInput } from '@shared/types';
import * as api from '@/api';
import { request } from '@/api/client';
import { OfflineEngine } from './engine';
import { offline } from './index';
import { aokBytes, armKeys, fetchSyncKey, META } from './keys';
import { isPendingRecord } from './optimistic';
import { __setOpTimeoutForTests } from './replayer';
import { BINDING_KEY, tokenTagOf } from './session';
import { getSyncStatus } from './status';
import { openAccountStore } from './store/idb';
import { bootDevice, DANA, fakeKeyVault, fakeMirror, flush, installWebCrypto, LIOR, resetOfflineTestEnv, waitFor, wireDevice } from './test-utils/env';
import { FakeSyncServer } from './test-utils/fake-sync-server';

beforeAll(() => installWebCrypto());

function entryInput(title: string, over: Partial<EntryInput> = {}): EntryInput {
  return { date: '2026-10-23', time: '08:00', title, body: `${title} - טיול בוקר 🌤️`, mood: 7, emotions: [], energy: null, stress: null, sleepQuality: null, sleepHours: null, exerciseMinutes: null, exerciseType: '', events: [], people: [], location: '', notes: '', tags: ['walk'], ...over };
}

const HABIT: HabitInput = { name: 'Water', description: '', target: 8, unit: 'glasses', frequency: 'daily', reminderTime: null, reminderEnabled: false };

/** Rows of the account's database as they are on disk (the engine is bypassed). */
async function onDisk(userId = DANA) {
  const { store } = await openAccountStore(userId);
  const out = await store.tx(['outbox', 'notes', 'cache', 'journal', 'idmap', 'meta'], 'readonly', async (t) => ({
    outbox: await t.count('outbox'),
    notes: await t.count('notes'),
    cache: await t.count('cache'),
    journal: await t.count('journal'),
    idmap: await t.count('idmap'),
    wrappedKey: !!(await t.get('meta', META.wrappedKey)),
    snapshot: !!(await t.get('meta', META.snapshot)),
  }));
  store.close();
  return out;
}

describe('replayer (section 4.5) against the fake hosted server', () => {
  let server: FakeSyncServer;

  beforeEach(() => {
    server = new FakeSyncServer();
    __setOpTimeoutForTests(null);
  });

  afterEach(async () => {
    __setOpTimeoutForTests(null);
    await resetOfflineTestEnv();
  });

  it('uploads in order, coalesced, exactly once; local ids map to server ids', async () => {
    await bootDevice({ server, rememberMe: true, app: true, mirror: fakeMirror(), keyVault: fakeKeyVault() });
    server.mode = 'down';
    const e1 = await api.entries.create(entryInput('E1'));
    expect(e1.id).toBe(-1);
    expect(isPendingRecord(e1)).toBe(true);
    const edited = await api.entries.update(-1, entryInput('E1 edited'));
    expect(edited.id).toBe(-1);
    const h = await api.habits.create(HABIT);
    expect(h.id).toBeLessThan(0);
    await api.habits.log({ habitId: h.id, date: '2026-10-23', value: 3 });
    await api.settings.update({ theme: 'dark' });
    expect(offline.pending().map((p) => p.label.kind)).toEqual(['entry.create', 'habit.create', 'log.set', 'settings.patch']);
    expect(getSyncStatus().pending).toBe(4);
    expect(server.calls('/api/sync/op')).toHaveLength(0);

    server.mode = 'online';
    const drained = await offline.drain();
    expect(drained).toEqual({ remaining: 0, attention: 0 });
    const diary = server.diary(DANA);
    expect([...diary.entries.values()].map((e) => e.title)).toEqual(['E1 edited']);
    expect([...diary.habits.values()].map((x) => x.name)).toEqual(['Water']);
    expect([...diary.logs.values()].map((l) => l.value)).toEqual([3]);
    expect(diary.settings.theme).toBe('dark');
    expect(offline.serverIdOf(-1)).toBe(1);
    expect(offline.serverIdOf(h.id)).toBe(1);
    expect(offline.notes.list()).toEqual([]);
    expect(getSyncStatus()).toMatchObject({ pending: 0, attention: 0, halted: null });
    // Every operation was applied once, in the order they were queued.
    const kinds = server.calls('/api/sync/op').map((r) => (r.body as { kind: string }).kind);
    expect(kinds).toEqual(['entry.create', 'habit.create', 'log.set', 'settings.patch']);
    expect([...server.applied.values()].every((n) => n === 1)).toBe(true);
    expect((await onDisk()).outbox).toBe(0);
  });

  it('a lost response followed by a retry gives exactly one record', async () => {
    await bootDevice({ server, rememberMe: true, app: true });
    server.mode = 'down';
    await api.entries.create(entryInput('Once'));
    server.mode = 'online';
    server.dropOpResponses = 1;
    // The send is applied, its answer is lost; the probe says the server is there, so the retry follows at once.
    await offline.drain();
    expect(offline.pending()).toHaveLength(0);
    expect(server.diary(DANA).entries.size).toBe(1);
    const ops = server.calls('/api/sync/op');
    expect(ops).toHaveLength(2);
    expect(ops[0].body).toEqual(ops[1].body); // byte-identical retry
    expect(server.applied.get((ops[0].body as { opId: string }).opId)).toBe(1);
    expect(offline.serverIdOf(-1)).toBe(1);
    expect(offline.notes.list()).toEqual([]);
  });

  it('a timeout during a write gives one record', async () => {
    __setOpTimeoutForTests(150);
    await bootDevice({ server, rememberMe: true, app: true });
    server.mode = 'down';
    await api.entries.create(entryInput('Slow'));
    server.mode = 'online';
    server.hangOpResponses = 1;
    await offline.drain();
    expect(server.diary(DANA).entries.size).toBe(1);
    await offline.drain();
    expect(offline.pending()).toHaveLength(0);
    expect(server.diary(DANA).entries.size).toBe(1);
    expect(server.calls('/api/sync/op')).toHaveLength(2);
  });

  it('401 keeps the outbox and notes, wipes the cache, wrapped key, snapshot and binding', async () => {
    const { account } = await bootDevice({ server, rememberMe: true, app: true, keyVault: fakeKeyVault(), mirror: fakeMirror() });
    await waitFor(() => (offline.__engineForTests()?.cache.bytes ?? 0) > 0);
    expect(window.localStorage.getItem(BINDING_KEY)).toContain(DANA);
    server.mode = 'down';
    await api.entries.create(entryInput('Kept'));
    const before = await onDisk();
    expect(before).toMatchObject({ outbox: 1, wrappedKey: true, snapshot: true });
    expect(before.cache).toBeGreaterThan(0);
    server.revoke(account.token);
    server.mode = 'online';
    await offline.drain();
    await waitFor(() => !offline.isActive());
    const after = await onDisk();
    expect(after).toEqual({ outbox: 1, notes: 0, cache: 0, journal: 0, idmap: 0, wrappedKey: false, snapshot: false });
    expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();
    expect(getSyncStatus().enabled).toBe(false);
  });

  it('423 pauses the replay until the session is unlocked', async () => {
    const { account } = await bootDevice({ server, rememberMe: true, app: true });
    server.mode = 'down';
    await api.entries.create(entryInput('Locked'));
    server.mode = 'online';
    server.lockedTokens.add(account.token);
    await offline.drain();
    expect(getSyncStatus()).toMatchObject({ halted: 'locked', pending: 1 });
    expect(server.diary(DANA).entries.size).toBe(0);
    server.lockedTokens.delete(account.token);
    offline.notifyUnlocked();
    await offline.drain();
    expect(getSyncStatus()).toMatchObject({ halted: null, pending: 0 });
    expect(server.diary(DANA).entries.size).toBe(1);
  });

  it('429 honours Retry-After and then continues by itself', async () => {
    await bootDevice({ server, rememberMe: true, app: true });
    server.mode = 'down';
    await api.entries.create(entryInput('Later'));
    server.mode = 'online';
    server.failNext({ status: 429, pathPrefix: '/api/sync/op', headers: { 'Retry-After': '1' } });
    await offline.drain();
    expect(offline.pending()).toHaveLength(1);
    await waitFor(() => server.diary(DANA).entries.size === 1, 4000);
    const ops = server.calls('/api/sync/op');
    expect(ops).toHaveLength(2);
    expect(ops[1].at - ops[0].at).toBeGreaterThanOrEqual(900);
  });

  it('507 makes the growing chain wait while a delete in another chain passes', async () => {
    const e0 = server.seedEntry(DANA, { title: 'Old' });
    await bootDevice({ server, rememberMe: true, app: true });
    await api.entries.get(e0.id); // shown: its version is the base of the delete
    server.mode = 'down';
    await api.entries.create(entryInput('Big'));
    await api.entries.remove(e0.id);
    server.mode = 'online';
    server.quotaFull = true;
    await offline.drain();
    expect(server.diary(DANA).entries.has(e0.id)).toBe(false);
    expect(offline.pending().map((p) => p.label.kind)).toEqual(['entry.create']);
    server.quotaFull = false;
    await offline.tryNow();
    await offline.drain();
    expect(offline.pending()).toHaveLength(0);
    expect([...server.diary(DANA).entries.values()].map((e) => e.title)).toEqual(['Big']);
  });

  it('400 turns the operation into a note and its dependants into blocked notes', async () => {
    await bootDevice({ server, rememberMe: true, app: true });
    server.mode = 'down';
    const h = await api.habits.create({ ...HABIT, name: 'x'.repeat(150) });
    await api.habits.log({ habitId: h.id, date: '2026-10-23', value: 1 });
    await api.entries.create(entryInput('Fine'));
    server.mode = 'online';
    await offline.drain();
    expect(offline.pending()).toHaveLength(0);
    const notes = offline.notes.list();
    expect(notes.map((n) => n.reason)).toEqual(['rejected', 'blocked']);
    expect(notes[0].message).toMatch(/name/);
    expect(notes[0].label.kind).toBe('habit.create');
    expect(notes[1].label.kind).toBe('log.set');
    expect(getSyncStatus().attention).toBe(2);
    expect(server.diary(DANA).entries.size).toBe(1);
    await offline.notes.dismiss(notes[0].id);
    expect(getSyncStatus().attention).toBe(1);
  });

  it('conflicts: lost, won (with the other version), gone and stale leave the right notes', async () => {
    const e7 = server.seedEntry(DANA, { title: 'Morning walk' }, '2026-10-20T08:00:00.000Z');
    const e8 = server.seedEntry(DANA, { title: 'Second' }, '2026-10-20T08:00:00.000Z');
    const e9 = server.seedEntry(DANA, { title: 'Third' }, '2026-10-20T08:00:00.000Z');
    await bootDevice({ server, rememberMe: true, app: true });
    for (const e of [e7, e8, e9]) await api.entries.get(e.id);
    server.mode = 'down';
    await api.entries.update(e7.id, entryInput('Mine 7'));
    await api.entries.update(e8.id, entryInput('Mine 8'));
    await api.entries.update(e9.id, entryInput('Mine 9'));
    // Another device: E7 changed AFTER ours (we lose), E8 changed BEFORE ours but after what we saw (we win), E9 deleted.
    const soon = new Date(Date.now() + 60_000).toISOString();
    server.editEntry(DANA, e7.id, { title: 'Other 7' }, soon);
    server.editEntry(DANA, e8.id, { title: 'Other 8' }, '2026-10-21T08:00:00.000Z');
    server.deleteEntry(DANA, e9.id);
    server.mode = 'online';
    await offline.drain();
    const notes = offline.notes.list();
    expect(notes.map((n) => n.reason).sort()).toEqual(['gone', 'lost', 'won']);
    const lost = notes.find((n) => n.reason === 'lost')!;
    expect(lost.mine?.title).toBe('Mine 7');
    expect((lost.other as { title: string }).title).toBe('Other 7');
    const won = notes.find((n) => n.reason === 'won')!;
    expect((won.other as { title: string }).title).toBe('Other 8');
    expect(server.diary(DANA).entries.get(e7.id)?.title).toBe('Other 7');
    expect(server.diary(DANA).entries.get(e8.id)?.title).toBe('Mine 8');
    expect(server.diary(DANA).entries.has(e9.id)).toBe(false);
    expect(notes.find((n) => n.reason === 'gone')?.mine?.title).toBe('Mine 9');

    // Stale: a restore on the server after the change was queued.
    server.mode = 'down';
    await api.entries.update(e7.id, entryInput('After restore'));
    server.restore(DANA);
    server.mode = 'online';
    await offline.drain();
    expect(offline.notes.list().map((n) => n.reason)).toContain('stale');
    expect(server.diary(DANA).entries.get(e7.id)?.title).toBe('Other 7');
    expect(offline.__engineForTests()?.epoch).toBe(server.epochOf(DANA));
  });

  it('base resolution at seal time: a successor of an acknowledged operation uses the version it produced', async () => {
    const e5 = server.seedEntry(DANA, { title: 'Five' }, '2026-10-20T08:00:00.000Z');
    const { engine } = await bootDevice({ server, rememberMe: true, app: true });
    await api.entries.get(e5.id);
    const first = await api.entries.update(e5.id, entryInput('Five v2'));
    expect(first.id).toBe(e5.id);
    const journal = engine.journal.all();
    expect(journal).toHaveLength(1);
    const producedAt = (journal[0].result.record as { updatedAt: string }).updatedAt;
    // A successor queued while the first was in flight: base `{ op: P }`, resolved when it is sealed.
    const q = {
      op: { v: 1 as const, account: DANA, opId: '22222222-2222-4222-8222-222222222222', editedAt: new Date().toISOString(), epoch: engine.epoch, kind: 'entry.update' as const, target: { id: e5.id }, payload: entryInput('Five v3') },
      baseOp: journal[0].opId,
      record: `i:${e5.id}`,
      chain: `entry:i:${e5.id}`,
      hint: { displayId: e5.id },
      queuedAt: Date.now(),
    };
    await engine.enqueue({ q, deps: [], idmap: [] });
    await offline.drain();
    const sent = server.calls('/api/sync/op').at(-1)!.body as { base?: string; opId: string };
    expect(sent.base).toBe(producedAt);
    const result = server.requests.length && engine.journal.get(sent.opId)?.result;
    expect(result && result.outcome).toBe('applied');
  });

  it('CORS / proxy trap: three failed sends while the probe succeeds mark the chain blocked; "Try now" clears it', async () => {
    await bootDevice({ server, rememberMe: true, app: true });
    server.mode = 'down';
    await api.entries.create(entryInput('Trapped'));
    server.mode = 'online';
    server.opNetworkErrors = 3;
    await offline.drain();
    expect(offline.pending()[0]?.state).toBe('blocked');
    expect(getSyncStatus().attention).toBe(1);
    await offline.tryNow();
    await offline.drain();
    expect(offline.pending()).toHaveLength(0);
    expect(server.diary(DANA).entries.size).toBe(1);
  });

  it("account switch: Dana's operations are never sent with Lior's token; her outbox stays in her database", async () => {
    const { idb } = await bootDevice({ server, rememberMe: true, app: true });
    server.mode = 'down';
    await api.entries.create(entryInput("Dana's"));
    server.mode = 'online';
    // Lior signs in on the same device.
    const lior = wireDevice({ server, userId: LIOR, token: 'tok-lior', rememberMe: false, app: true, idb });
    const started = await offline.start({ user: lior.account.user, rememberMe: false, token: 'tok-lior' });
    expect(started.enabled).toBe(true);
    expect(offline.activeUserId()).toBe(LIOR);
    await offline.drain();
    await flush();
    const sent = server.calls('/api/sync/op');
    expect(sent.filter((r) => r.token === 'tok-lior')).toHaveLength(0);
    expect((await onDisk(DANA)).outbox).toBe(1);
    expect(await offline.otherAccountsWithPending(LIOR)).toEqual([{ userId: DANA, count: 1 }]);
    // A hand-made operation of Dana's account with Lior's token is refused by the server.
    const err = await request('/api/sync/op', { method: 'POST', body: { v: 1, account: DANA, opId: '33333333-3333-4333-8333-333333333333', editedAt: new Date().toISOString(), epoch: server.epochOf(LIOR), kind: 'settings.patch', payload: { theme: 'dark' } } }).catch((e: unknown) => e);
    expect((err as { status: number }).status).toBe(409);
    expect(server.diary(DANA).entries.size).toBe(0);
  });

  it('single flight: two engines on one database send each operation once (in-process lock)', async () => {
    const { account } = wireDevice({ server, rememberMe: true, app: true });
    const tokenTag = await tokenTagOf(account.token);
    const a = await OfflineEngine.open({ userId: DANA, keys: await armKeys(aokBytes(await fetchSyncKey()), DANA), persistentCache: false, tokenTag, probe: async () => true });
    const b = await OfflineEngine.open({ userId: DANA, keys: await armKeys(aokBytes(await fetchSyncKey()), DANA), persistentCache: false, tokenTag, probe: async () => true });
    a.start();
    b.start();
    const clientId = '44444444-4444-4444-8444-444444444444';
    await a.enqueue({
      q: { op: { v: 1, account: DANA, opId: '55555555-5555-4555-8555-555555555555', editedAt: new Date().toISOString(), epoch: a.epoch, kind: 'entry.create', clientId, payload: entryInput('Once') }, record: `c:${clientId}`, chain: `entry:c:${clientId}`, localId: -1, queuedAt: Date.now() },
      deps: [],
      idmap: [{ localId: -1, kind: 'entry', clientId }],
    });
    a.replayer.kick();
    b.replayer.kick();
    await Promise.all([a.replayer.settle(), b.replayer.settle()]);
    expect(server.diary(DANA).entries.size).toBe(1);
    expect(server.applied.size).toBe(1);
    expect(await a.outbox.load()).toHaveLength(0);
    a.stop();
    b.stop();
  });
});

/** A `navigator.locks` stand-in: exclusive named locks, granted in order, one task after the request. */
function stubWebLocks() {
  const holders = new Map<string, Promise<void>>();
  let requests = 0;
  const locks = {
    async request(name: string, a: unknown, b?: unknown) {
      requests++;
      const cb = (typeof a === 'function' ? a : b) as (lock: { name: string } | null) => Promise<unknown>;
      const opts = (typeof a === 'object' && a !== null ? a : {}) as { ifAvailable?: boolean };
      await new Promise((r) => setTimeout(r, 0));
      if (opts.ifAvailable && holders.has(name)) return cb(null);
      while (holders.has(name)) await holders.get(name);
      let release!: () => void;
      holders.set(name, new Promise<void>((r) => (release = r)));
      try {
        return await cb({ name });
      } finally {
        holders.delete(name);
        release();
      }
    },
    async query() {
      return { held: [], pending: [] };
    },
  };
  return {
    install() {
      Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });
    },
    uninstall() {
      delete (navigator as unknown as Record<string, unknown>).locks;
    },
    get requests() {
      return requests;
    },
    /** Another tab takes the lock; resolves with its release once it holds it. */
    async holdElsewhere(name: string): Promise<() => void> {
      let release!: () => void;
      const done = new Promise<void>((r) => (release = r));
      let granted!: () => void;
      const held = new Promise<void>((r) => (granted = r));
      void locks.request(name, async () => {
        granted();
        await done;
      });
      await held;
      return release;
    },
  };
}

describe('replayer fixes (verified findings)', () => {
  let server: FakeSyncServer;

  beforeEach(() => {
    server = new FakeSyncServer();
    __setOpTimeoutForTests(null);
  });

  afterEach(async () => {
    __setOpTimeoutForTests(null);
    await resetOfflineTestEnv();
  });

  it('stale drops the id map: after a restore a local id no longer resolves to the record that reused its server id', async () => {
    await bootDevice({ server, rememberMe: true, app: true });
    server.mode = 'down';
    await api.entries.create(entryInput('A created offline'));
    server.mode = 'online';
    await offline.drain();
    expect(offline.serverIdOf(-1)).toBe(1);

    server.mode = 'down';
    await api.entries.update(-1, entryInput('A v2'));
    const d = await api.entries.create(entryInput('D still waiting'));
    expect(d.id).toBe(-2);
    // Another device restores a backup in which id 1 is a different entry, C.
    const a = server.diary(DANA).entries.get(1)!;
    const c: Entry = { ...a, title: 'C written by another device after the restore', updatedAt: '2026-10-22T08:00:00.000Z' };
    server.restore(DANA, { entries: [c] });
    server.mode = 'online';
    await offline.drain();

    expect(offline.notes.list().map((n) => n.reason)).toContain('stale');
    expect(offline.serverIdOf(-1)).toBeNull();
    await expect(api.entries.get(-1)).rejects.toMatchObject({ status: 404 });
    await expect(api.entries.update(-1, entryInput('A v3'))).rejects.toMatchObject({ status: 404 });
    await offline.drain();
    expect(server.diary(DANA).entries.get(1)?.title).toBe('C written by another device after the restore');
    // The create that was still waiting kept its local id and was applied after the restore.
    const dId = offline.serverIdOf(-2);
    expect(dId).not.toBeNull();
    expect(server.diary(DANA).entries.get(dId!)?.title).toBe('D still waiting');
    // The journal of results from before the restore is gone too (a synthesised view must not apply them).
    expect(offline.__engineForTests()!.journal.all().map((j) => j.queued.op.kind)).toEqual(['entry.create']);
    expect((offline.__engineForTests()!.journal.all()[0].result.record as Entry).title).toBe('D still waiting');
  });

  it('settings: a key that lost inside an "applied" patch leaves a note for that key', async () => {
    await bootDevice({ server, rememberMe: true, app: true });
    await api.settings.get(); // shown: the base is known
    server.mode = 'down';
    await api.settings.update({ theme: 'dark', fontScale: 1.25 });
    // Another device changed the theme LATER; fontScale is untouched there.
    server.setSetting(DANA, 'theme', 'light', new Date(Date.now() + 60_000).toISOString());
    server.mode = 'online';
    await offline.drain();
    const op = server.calls('/api/sync/op').at(-1)!.body as { opId: string };
    const result = offline.__engineForTests()!.journal.get(op.opId)?.result;
    expect(result).toMatchObject({ outcome: 'applied', keys: { theme: 'conflict-lost', fontScale: 'applied' } });
    const notes = offline.notes.list();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ reason: 'otherLost', label: { kind: 'settings.patch', settingKeys: ['theme'] } });
    expect(getSyncStatus().attention).toBe(1);
    expect(server.diary(DANA).settings).toMatchObject({ theme: 'light', fontScale: 1.25 });
  });

  it('settings: a "conflict-won" patch reports the key that lost separately from the key that won', async () => {
    await bootDevice({ server, rememberMe: true, app: true });
    await api.settings.get();
    server.mode = 'down';
    await api.settings.update({ theme: 'dark', fontScale: 1.25 });
    server.setSetting(DANA, 'fontScale', 1.5, '2026-10-21T08:00:00.000Z'); // earlier than our edit: ours wins
    server.setSetting(DANA, 'theme', 'light', new Date(Date.now() + 60_000).toISOString()); // later: ours loses
    server.mode = 'online';
    await offline.drain();
    const op = server.calls('/api/sync/op').at(-1)!.body as { opId: string };
    expect(offline.__engineForTests()!.journal.get(op.opId)?.result).toMatchObject({ outcome: 'conflict-won', keys: { theme: 'conflict-lost', fontScale: 'conflict-won' } });
    const notes = offline.notes.list();
    expect(notes.map((n) => [n.reason, n.label.settingKeys])).toEqual([
      ['otherLost', ['theme']],
      ['otherWon', ['fontScale']],
    ]);
    expect(notes[1].other).toEqual({ fontScale: 1.5 });
    expect(server.diary(DANA).settings).toMatchObject({ theme: 'light', fontScale: 1.25 });
  });

  it('Web Locks: while another tab holds the outbox lock this tab waits once instead of re-requesting, then drains', async () => {
    const stub = stubWebLocks();
    stub.install();
    try {
      await bootDevice({ server, rememberMe: true, app: true, probe: async () => server.mode === 'online' });
      const engine = offline.__engineForTests()!;
      await engine.replayer.settle();
      server.mode = 'down';
      await api.entries.list().catch(() => undefined);
      await api.entries.create(entryInput('Behind the other tab'));
      await engine.replayer.settle();
      const release = await stub.holdElsewhere(`ypd-outbox-${DANA}`);
      const before = stub.requests;
      server.mode = 'online';
      await engine.connectivity.probeNow('test', true); // the reconnect kicks the replayer: it queues behind the other tab
      for (let i = 0; i < 5; i++) engine.replayer.kick();
      await new Promise((r) => setTimeout(r, 300));
      expect(stub.requests - before).toBeLessThanOrEqual(1);
      expect(server.diary(DANA).entries.size).toBe(0);
      release();
      await engine.replayer.settle();
      expect(server.diary(DANA).entries.size).toBe(1);
      expect(stub.requests - before).toBeLessThanOrEqual(3);
    } finally {
      stub.uninstall();
    }
  });

  it('a reconnect noticed by an ordinary request (no probe) starts the upload; the bar does not stay on "Uploading"', async () => {
    // The probe never succeeds: only the ordinary request can notice the server is back.
    await bootDevice({ server, rememberMe: true, app: true, probe: async () => false });
    server.mode = 'down';
    await api.entries.list().catch(() => undefined);
    await api.entries.create(entryInput('Uploaded after me()'));
    await waitFor(() => getSyncStatus().showOffline);
    server.mode = 'online';
    await api.auth.me();
    await waitFor(() => server.diary(DANA).entries.size === 1, 3000);
    await waitFor(() => getSyncStatus().phase === 'online' && getSyncStatus().pending === 0, 3000);
    expect(server.calls('/api/sync/op').length).toBe(1);
  });

  it('a halted replayer never leaves the bar on "Uploading" after a reconnect', async () => {
    const { account } = await bootDevice({ server, rememberMe: true, app: true, probe: async () => false });
    server.mode = 'down';
    await api.entries.list().catch(() => undefined);
    await api.entries.create(entryInput('Locked session'));
    server.mode = 'online';
    server.lockedTokens.add(account.token);
    await api.auth.me(); // the reconnect kicks the replayer: 423, halted 'locked'
    await waitFor(() => getSyncStatus().halted === 'locked', 3000);
    // The connection drops and returns again while the replay is halted.
    server.mode = 'down';
    await api.entries.list().catch(() => undefined);
    server.mode = 'online';
    await api.auth.me();
    await waitFor(() => getSyncStatus().phase === 'online', 3000);
    expect(getSyncStatus()).toMatchObject({ halted: 'locked', pending: 1 });
  });
});
