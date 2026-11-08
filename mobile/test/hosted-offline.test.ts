/**
 * WP-H10d: the end-to-end test of the automatic offline mode (docs/android-tasks/OFFLINE-DESIGN.md
 * section 9) - the REAL hosted composition against the REAL client code.
 *
 * Server: server/src/hosted.ts `startHosted` from source under Node, 127.0.0.1 on a free port (never
 * 47321), a temp data directory, a test DIARY_DEVICE_KEY, a fast KDF (./offline-e2e/hosted-rig.ts).
 * L6 gets its own server with a small DIARY_MAX_DIARY_BYTES.
 * Device A: the Android app - src/api (with the offline facade) and src/offline on fake-indexeddb and
 * Node's Web Crypto, fake platform seams installed only here, and a switchable transport (online /
 * down / blackhole / drop-response) that also behaves like the WebView's CORS checks
 * (./offline-e2e/device.ts, ./offline-e2e/transport.ts). "Restart" = a new engine on the same
 * IndexedDB and storage.
 * Device B: a second device of the same account, plain HTTP with its own token (./offline-e2e/peer.ts).
 *
 * Steps 1-8, conflicts C1-C7 and lifecycle L1-L9 of section 9; the shipped bundles are checked for
 * the test seam module at the end. Fictional accounts only ("Dana", "Lior", "Zohar").
 *
 * The cases run in order on one server and one account (the scenario of section 9); every case
 * after step 5 starts from a known state (`freshOnline`: online, Dana signed in, no notes), so one
 * failure does not take the rest with it. Step 3b is a regression case for a coalescing defect that was
 * found here (fixed in src/offline/coalesce.ts by the OFFLINE-COALESCE-FIX package).
 *
 * What this file checks of the lock (section 4.7 step 3, section 5.7) is the engine's part: the
 * session snapshot's lock state and last activity survive restarts and decide "locked at start". The
 * lock screen's own offline unlock - the device-check button, three failures, the fallback text - is a
 * React component and is covered by src/pages/LockScreen.offline.test.tsx; what its unlock sends the
 * engine (the snapshot patch of the LockProvider) is what step 3 and L5 send by hand.
 *
 * Runtime budget: about 25 s of scenario on an idle machine plus loading the server from source
 * (10-60 s, minutes when other agents load the machine - hence the long hook timeout) and two
 * production builds (about 10 s idle). Two servers in all (L6 has its own); the waits are the
 * design's own: the 1.5 s offline bar, the 5 s probe timeout in L9 (with a 1.5 s send timeout set
 * through the engine's test hook), the 2 s chain backoff in L6.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SyncOp } from '@shared/sync';
import type { AppSettings, Entry, EntryInput, Habit, HabitInput } from '@shared/types';
import { auth, calendar, entries, habits, insights, settings } from '@/api';
import { getToken, isApiClientError, request } from '@/api/client';
import { offline, getSyncStatus, isPendingRecord } from '@/offline';
import { getOfflinePlatform } from '@/offline/seams';
import { BINDING_KEY, loadSnapshot, lockedAtStart } from '@/offline/session';
import { warmUp } from '@/offline/facade';
import { __setOpTimeoutForTests } from '@/offline/replayer';
import { accountDbName } from '@/offline/store/idb';
import { todayIso } from '@/utils/dates';
import { Device, installWebCrypto, sleep, waitUntil } from './offline-e2e/device';
import { HostedRig } from './offline-e2e/hosted-rig';
import { FAKE_SEAMS_MARKER } from './offline-e2e/fake-seams';
import { Peer } from './offline-e2e/peer';
import { buildBundle, hits, readTree, shippedSourcesImportingTestCode } from './offline-e2e/shipped-bundles';

const PASSWORD = 'Dana-Passw0rd!';
const NEW_PASSWORD = 'Dana-Passw0rd!-2026';
const DANA = { firstName: 'Dana', lastName: 'Fictional', username: 'dana_offline', email: 'dana_offline@example.test' };
const LIOR = { firstName: 'Lior', lastName: 'Fictional', username: 'lior_offline', email: 'lior_offline@example.test' };
const LIOR_PASSWORD = 'Lior-Passw0rd!';
const ZOHAR = { firstName: 'Zohar', lastName: 'Fictional', username: 'zohar_quota', email: 'zohar_quota@example.test' };
const ZOHAR_PASSWORD = 'Zohar-Passw0rd!';

const realFetch: typeof fetch = globalThis.fetch.bind(globalThis);
/** Every URL fetched through the global fetch (nothing of the client may bypass its transport to go elsewhere). */
const globalFetches: string[] = [];
const rig = new HostedRig();
const A = new Device('Phone A', () => rig.base, realFetch);
const B = new Peer(realFetch, () => rig.base);
let danaId = '';
let danaPassword = PASSWORD;
const TODAY = todayIso();
/** Loading the server modules from source can take minutes while other agents load the machine. */
const BOOT_TIMEOUT_MS = 300_000;
/** One step of the scenario (generous: the machine may be busy; the design's own waits are a few seconds). */
const STEP_TIMEOUT_MS = 90_000;
const [YEAR, MONTH] = [Number(TODAY.slice(0, 4)), Number(TODAY.slice(5, 7))];

function entryInput(title: string, over: Partial<EntryInput> = {}): EntryInput {
  return {
    date: TODAY,
    time: '08:30',
    title,
    body: `${title}: a fictional day.`,
    mood: 4,
    emotions: [],
    energy: null,
    stress: null,
    sleepQuality: null,
    sleepHours: null,
    exerciseMinutes: null,
    exerciseType: '',
    events: [],
    people: [],
    location: '',
    notes: '',
    tags: ['e2e'],
    ...over,
  } as EntryInput;
}

function habitInput(name: string, over: Partial<HabitInput> = {}): HabitInput {
  return { name, description: '', target: 8, unit: 'glasses', frequency: 'daily', reminderTime: null, reminderEnabled: false, ...over };
}

function inputOf(e: Entry): EntryInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = e;
  return rest as EntryInput;
}

/** The device notices the lost connection by itself: a page read fails (the cached view is served) and the bar shows after 1.5 s. */
async function goDown(device: Device = A): Promise<void> {
  // Requests already on their way (a background warm-up) would still arrive: the network goes once they are done.
  await waitUntil('the device is idle', () => device.transport.inFlight === 0);
  device.transport.set('down');
  await entries.list({ limit: 50 });
  expect(offline.__engineForTests()?.connectivity.dataOffline).toBe(true);
}

/** The connection returns: "Try now" (probe + replay), then everything the replayer can send is sent. */
async function comeBack(device: Device = A): Promise<{ remaining: number; attention: number }> {
  device.transport.set('online');
  await offline.tryNow();
  return offline.drain();
}

/** Every case after step 5 starts online and known to be online, without notes left by the previous one. */
async function freshOnline(device: Device = A): Promise<void> {
  device.transport.set('online');
  // Dana signed in on A with "Remember me" (a case that stopped half-way must not take the next ones with it).
  if (device === A && danaId && (offline.activeUserId() !== danaId || !offline.isActive())) await A.signIn(DANA.username, danaPassword, true);
  if (offline.__engineForTests()?.connectivity.dataOffline) await offline.tryNow();
  await dismissAllNotes();
}

/**
 * "Later" without trusting a sleep: the device stamps an edit with its clock plus the offset it learned
 * from the server (section 4.4), and that offset is only as good as half a round trip. These waits make
 * the order of two edits a fact of the scenario, whatever the load of the machine.
 */
async function deviceClockPast(iso: string): Promise<void> {
  await waitUntil('the device clock passes the other edit', () => A.engine.clock.serverNowMs() > Date.parse(iso) + 20, 5000, 5);
}

/** The server clock (the same machine) passes the device's last queued edit: device B's next write is the newer one. */
async function serverClockPastLastEdit(): Promise<void> {
  const last = A.engine.outbox.rows.at(-1);
  if (!last) throw new Error('nothing queued');
  const at = Date.parse(last.q.op.editedAt);
  await waitUntil('the server clock passes the queued edit', () => Date.now() > at + 20, 5000, 5);
}

/** The 401 reached the engine: it is disarmed AND its purge (cache, journal, id map, snapshot, wrapped key) has finished. */
async function tornDownBy401(): Promise<void> {
  await waitUntil('the 401 tears the engine down', () => !offline.isActive() && !getSyncStatus().enabled);
}

async function dismissAllNotes(): Promise<void> {
  for (const n of offline.notes.list()) await offline.notes.dismiss(n.id);
}

beforeAll(async () => {
  await installWebCrypto();
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    globalFetches.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return realFetch(input, init);
  }) as typeof fetch;
  await rig.open();
  A.wire();
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  globalThis.fetch = realFetch;
  await offline.__resetForTests().catch(() => undefined);
  await rig.close();
}, 60_000);

describe('offline mode end to end: the Android app against the hosted server', { timeout: STEP_TIMEOUT_MS }, () => {
  const ids = { e0: 0, e5: 0, h: 0, h3: 0, e1Local: 0, e1Server: 0 };
  let opsAtDown = 0;
  let e1ClientId = '';
  let h2EditedAt = '';

  it('step 1: Dana registers on device A with "Remember me", the cache warms up; device B signs in as Dana', async () => {
    const { auth: res, outcome } = await A.register(DANA, PASSWORD, true);
    danaId = res.user.id;
    expect(res.rememberMe).toBe(true);
    expect(outcome).toEqual({ enabled: true, recovered: null, readOnly: false });
    expect(offline.isActive()).toBe(true);
    // The account offline key is kept wrapped by the "Keystore"; the binding names the account, never the token.
    expect(A.keyVault.blobs.has(danaId)).toBe(true);
    const binding = JSON.parse(window.localStorage.getItem(BINDING_KEY) ?? '{}') as { userId?: string; tokenTag?: string };
    expect(binding.userId).toBe(danaId);
    expect(binding.tokenTag).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(binding)).not.toContain(res.token);

    await B.signIn(DANA.username, PASSWORD);
    expect(B.userId).toBe(danaId);

    // The diary as Dana left it: entries written by B (another device) and by A online, two habits.
    const e0 = await B.createEntry(entryInput('E0 Harbour walk', { time: '07:00' }));
    const e5 = await B.createEntry(entryInput('E5 Old note', { time: '09:00' }));
    ids.e0 = e0.id;
    ids.e5 = e5.id;
    // Online, A's writes go through the outbox and resolve with the server's record within 2 s (as today).
    const h = await habits.create(habitInput('Water'));
    expect(isPendingRecord(h)).toBe(false);
    expect(h.id).toBeGreaterThan(0);
    const h3 = await habits.create(habitInput('Stretching', { target: 1, unit: 'times' }));
    expect(h3.id).toBeGreaterThan(0);
    ids.h = h.id;
    ids.h3 = h3.id;
    const logged = await habits.log({ habitId: h.id, date: TODAY, value: 2 });
    expect(logged.value).toBe(2);
    expect(getSyncStatus().pending).toBe(0);

    // The warm-up (section 4.6) and the pages Dana opened: what the cache holds for the offline start.
    await warmUp(A.engine);
    expect(await A.engine.cache.get('/api/home')).not.toBeNull();
    const list = await entries.list({ limit: 50 });
    expect(list.items.map((s) => s.title).sort()).toEqual(['E0 Harbour walk', 'E5 Old note']);
    await entries.day(TODAY);
    await habits.progress(TODAY);
    await insights.home();
    await calendar.month(YEAR, MONTH);
    await settings.get();
    // EntryPage reads the full entry (the base of an edit is the version shown).
    await entries.get(ids.e0);
    await entries.get(ids.e5);
  });

  it('step 2: offline on A - entries, habits and a setting are kept on the device, the views show them, nothing is sent', async () => {
    opsAtDown = A.transport.ops.length;
    await goDown();
    await waitUntil('the offline bar (1.5 s)', () => getSyncStatus().showOffline, 4000);
    expect(getSyncStatus().phase).toBe('offline');

    const e1 = await entries.create(entryInput('E1 בוקר בים 🌊', { body: 'טיול בוקר עם הכלב 🐕 - fictional', time: '06:15' }));
    // A negative id from the persisted counter (the online creates of step 1 used the first ones).
    expect(e1.id).toBeLessThan(0);
    ids.e1Local = e1.id;
    expect(isPendingRecord(e1)).toBe(true);
    const e1edited = await entries.update(ids.e1Local, entryInput('E1 בוקר בים 🌊 (edited)', { body: 'טיול בוקר עם הכלב 🐕 - edited offline', time: '06:15' }));
    expect(e1edited.id).toBe(ids.e1Local);

    const e0 = await entries.get(ids.e0);
    await entries.update(ids.e0, { ...inputOf(e0), title: 'E0 Harbour walk (edited offline)' });
    await entries.get(ids.e5);
    await entries.remove(ids.e5);

    const progress = await habits.progress(TODAY);
    const water = progress.find((p) => p.habit.id === ids.h);
    expect(water?.today?.value).toBe(2);
    // Quick log "+1" (HabitQuickLog): the value shown plus one.
    await habits.log({ habitId: ids.h, date: TODAY, value: (water?.today?.value ?? 0) + 1 });
    const h2 = await habits.create(habitInput('H2 Walk', { target: 1, unit: 'walks' }));
    expect(h2.id).toBeLessThan(0);
    // The habits page shows H2 with zero progress (the overlay), then its quick log.
    const withH2 = await habits.progress(TODAY);
    expect(withH2.find((p) => p.habit.id === h2.id)?.today ?? null).toBeNull();
    await habits.log({ habitId: h2.id, date: TODAY, value: 1 });
    await habits.archive(ids.h3, true);
    const s = await settings.update({ theme: 'dark' });
    expect(s.theme).toBe('dark');

    // The waiting count: the create and its edit were coalesced into one operation.
    expect(getSyncStatus().pending).toBe(8);
    expect(offline.pending().map((p) => p.label.kind)).toEqual(['entry.create', 'entry.update', 'entry.delete', 'log.set', 'habit.create', 'log.set', 'habit.archive', 'settings.patch']);

    // The overlay of every cached view.
    const list = await entries.list({ limit: 50 });
    expect(list.items.map((x) => x.title).sort()).toEqual(['E0 Harbour walk (edited offline)', 'E1 בוקר בים 🌊 (edited)']);
    expect(list.total).toBe(2);
    const day = await entries.day(TODAY);
    expect(day.entries.map((x) => x.title).sort()).toEqual(['E0 Harbour walk (edited offline)', 'E1 בוקר בים 🌊 (edited)']);
    expect(day.habitLogs.map((l) => [l.habitName, l.log.value]).sort()).toEqual([['H2 Walk', 1], ['Water', 3]]);
    const month = await calendar.month(YEAR, MONTH);
    const cell = month.days.find((d) => d.date === TODAY);
    expect([...(cell?.titles ?? [])].sort()).toEqual(['E0 Harbour walk (edited offline)', 'E1 בוקר בים 🌊 (edited)']);
    const shown = await habits.progress(TODAY);
    expect(shown.map((p) => [p.habit.name, p.today?.value ?? null]).sort()).toEqual([['H2 Walk', 1], ['Water', 3]]);
    const home = await insights.home();
    expect(home.totalEntries).toBe(2);
    expect(home.habitsToday.map((p) => p.habit.name).sort()).toEqual(['H2 Walk', 'Water']);
    expect((await settings.get()).theme).toBe('dark');
    // `/entry/<local id>` resolves (EntryPage of the offline create).
    const byLocalId = await entries.get(ids.e1Local);
    expect(byLocalId.title).toBe('E1 בוקר בים 🌊 (edited)');
    expect(byLocalId.body).toBe('טיול בוקר עם הכלב 🐕 - edited offline');

    // Nothing was sent: no operation left the device, and the server still has the old diary.
    expect(A.transport.opsSince(opsAtDown).filter((o) => o.mode !== 'down')).toEqual([]);
    expect((await B.entries()).items.map((x) => x.title).sort()).toEqual(['E0 Harbour walk', 'E5 Old note']);
    // Everything waiting is mirrored outside IndexedDB (section 5.4).
    expect(A.mirror.names(danaId).filter((n) => n.endsWith('.op'))).toHaveLength(8);
  });

  it('step 3: A restarts while down - cache start, the overlay is intact, the auto-lock rule follows the stored snapshot', async () => {
    A.transport.set('down');
    const { autoLockMinutes } = await settings.get();
    expect(autoLockMinutes).toBeGreaterThan(0);
    // The app recorded its last activity one minute past the auto-lock time (the LockProvider keeps
    // the snapshot's `lastActivityAt`), then it was closed.
    const lastActivityAt = Date.now() - (autoLockMinutes + 1) * 60_000;
    await offline.updateSession({ lastActivityAt });
    const started = await A.reopenFromCache();
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.userId).toBe(danaId);
    expect(started.snapshot.user.username).toBe(DANA.username);
    expect(started.snapshot.rememberMe).toBe(true);
    expect(started.snapshot.serverInfo.offlineSync).toBe(1);
    expect(offline.isActive()).toBe(true);
    expect(getSyncStatus().pending).toBe(8);
    expect(A.keyVault.calls.filter((c) => c.startsWith('unwrap'))).toHaveLength(1);
    expect((await settings.get()).theme).toBe('dark');

    // Locked at start (section 4.7 step 3): the snapshot came back out of the encrypted store with the
    // last activity the app recorded before it closed, and the auto-lock time has passed since.
    expect(started.snapshot.locked).toBe(false);
    expect(started.snapshot.lastActivityAt).toBe(lastActivityAt);
    expect(lockedAtStart(started.snapshot, Date.now(), autoLockMinutes)).toBe(true);
    // The lock screen reads the phone's own screen lock through the seam this device installed
    // (src/pages/LockScreen.tsx; its offline-unlock path is the component test
    // src/pages/LockScreen.offline.test.tsx). Its unlock reaches the engine as the LockProvider's
    // snapshot patch - sent here by hand, and checked below through real restarts.
    expect(getOfflinePlatform().userCheck).toBe(A.userCheck);
    const unlockedAt = Date.now();
    await offline.updateSession({ locked: false, lastActivityAt: unlockedAt });

    const list = await entries.list({ limit: 50 });
    expect(list.items.map((x) => x.title).sort()).toEqual(['E0 Harbour walk (edited offline)', 'E1 בוקר בים 🌊 (edited)']);
    expect((await entries.get(ids.e1Local)).title).toBe('E1 בוקר בים 🌊 (edited)');
    const shown = await habits.progress(TODAY);
    expect(shown.map((p) => [p.habit.name, p.today?.value ?? null]).sort()).toEqual([['H2 Walk', 1], ['Water', 3]]);
    expect((await insights.home()).totalEntries).toBe(2);
    expect(A.transport.opsSince(opsAtDown).filter((o) => o.mode !== 'down')).toEqual([]);

    // The two other branches of the rule, each through a restart on the same storage: recent activity
    // opens unlocked; a lock on leave (the snapshot says locked) locks at start whatever the activity time.
    const afterUnlock = await A.reopenFromCache();
    expect(afterUnlock.ok).toBe(true);
    if (!afterUnlock.ok) return;
    expect([afterUnlock.snapshot.locked, afterUnlock.snapshot.lastActivityAt]).toEqual([false, unlockedAt]);
    expect(lockedAtStart(afterUnlock.snapshot, Date.now(), autoLockMinutes)).toBe(false);
    await offline.updateSession({ locked: true, lastActivityAt: Date.now() });
    const afterLeave = await A.reopenFromCache();
    expect(afterLeave.ok).toBe(true);
    if (!afterLeave.ok) return;
    expect(afterLeave.snapshot.locked).toBe(true);
    expect(lockedAtStart(afterLeave.snapshot, Date.now(), autoLockMinutes)).toBe(true);
    await offline.updateSession({ locked: false, lastActivityAt: Date.now() });
    // The restarts changed nothing of what waits, and still nothing was sent.
    expect(getSyncStatus().pending).toBe(8);
    expect(A.transport.opsSince(opsAtDown).filter((o) => o.mode !== 'down')).toEqual([]);
  });

  // Regression (fixed in src/offline/coalesce.ts): a create coalesced with its edit must not keep the edit's
  // `hint.prev` (the create's own first version), or the calendar and home overlays subtract an entry the
  // cached views never had - today is E0 edited, E1 created, E5 deleted: 2 entries, not 1.
  it('step 3b: the month and home overlays count the coalesced offline create (today has 2 entries)', async () => {
    const month = await calendar.month(YEAR, MONTH);
    expect(month.days.find((d) => d.date === TODAY)?.entryCount).toBe(2);
    expect((await insights.home()).todayEntryCount).toBe(2);
  });

  it('step 4: A comes back with the answer of its first operation lost - exactly one E1, every change in order, no notes, the local id maps', async () => {
    const from = A.transport.ops.length;
    A.transport.once('/api/sync/op', 'drop-response', { method: 'POST' });
    A.transport.set('online');
    // The phone says the network is back (navigator.onLine): the monitor probes and the replay starts.
    window.dispatchEvent(new Event('online'));
    await waitUntil('the outbox drains', () => getSyncStatus().pending === 0 && !getSyncStatus().uploading, 20_000);
    // A cache session whose me() now succeeds switches to the server (the AuthProvider re-runs start).
    expect((await A.meAgain()).enabled).toBe(true);

    const sent = A.transport.opsSince(from);
    // The dropped answer: the server applied the create, the device retried the SAME sealed bytes.
    expect(sent[0].mode).toBe('drop-response');
    expect(sent[0].op.kind).toBe('entry.create');
    expect(sent[0].result?.outcome).toBe('applied');
    expect(sent[1].body).toBe(sent[0].body);
    expect(sent[1].result?.outcome).toBe('unchanged');
    expect(sent.slice(1).map((o) => `${o.op.kind}:${o.result?.outcome}`)).toEqual([
      'entry.create:unchanged',
      'entry.update:applied',
      'entry.delete:applied',
      'log.set:applied',
      'habit.create:applied',
      'log.set:applied',
      'habit.archive:applied',
      'settings.patch:applied',
    ]);
    // The log of H2 waited for H2's create and refers to it by clientId.
    const h2Log = sent.find((o) => o.op.kind === 'log.set' && 'clientId' in (o.op as Extract<SyncOp, { kind: 'log.set' }>).habit);
    expect(h2Log).toBeDefined();
    e1ClientId = (sent[0].op as Extract<SyncOp, { kind: 'entry.create' }>).clientId;
    ids.e1Server = (sent[0].result?.record as Entry).id;
    h2EditedAt = (sent.find((o) => o.op.kind === 'habit.create') as (typeof sent)[number]).op.editedAt;

    expect(offline.notes.list()).toEqual([]);
    expect(getSyncStatus()).toMatchObject({ pending: 0, attention: 0, halted: null });
    expect(offline.serverIdOf(ids.e1Local)).toBe(ids.e1Server);
    expect((await entries.get(ids.e1Local)).id).toBe(ids.e1Server);
    // Mirror files go once their operation is acknowledged.
    expect(A.mirror.names(danaId).filter((n) => n.endsWith('.op'))).toEqual([]);

    // On the server's disk: exactly one E1, recognised by its clientId.
    const disk = await rig.onDisk(danaId, danaPassword, (db) => ({
      e1: db.all<{ id: number }>("SELECT id FROM entries WHERE title LIKE 'E1 %'"),
      cid: db.scalar<string>('SELECT value FROM meta WHERE key = ?', [`sync:cid:entry:${e1ClientId}`]),
    }));
    expect(disk.e1.map((r) => r.id)).toEqual([ids.e1Server]);
    expect(Number(disk.cid)).toBe(ids.e1Server);
  });

  it('step 5: device B reads everything back through the API', async () => {
    const list = await B.entries();
    expect(list.items.map((x) => x.title).sort()).toEqual(['E0 Harbour walk (edited offline)', 'E1 בוקר בים 🌊 (edited)']);
    const e1 = await B.entry(ids.e1Server);
    expect(e1?.body).toBe('טיול בוקר עם הכלב 🐕 - edited offline');
    expect(await B.entry(ids.e5)).toBeNull();
    const all = await B.habits(true);
    expect(all.map((h) => [h.name, h.isArchived]).sort()).toEqual([['H2 Walk', false], ['Stretching', true], ['Water', false]]);
    const progress = await B.progress(TODAY);
    expect(progress.map((p) => [p.habit.name, p.today?.value ?? null]).sort()).toEqual([['H2 Walk', 1], ['Water', 3]]);
    // A habit created offline keeps the device's creation time (its logs count from then), not the upload's.
    const h2 = all.find((h) => h.name === 'H2 Walk') as Habit;
    expect(h2.createdAt).toBe(h2EditedAt);
    expect(((await B.settings()) as AppSettings).theme).toBe('dark');
  });

  // -------------------------------------------------------------------------------------------
  // Step 6: conflicts (each on records of its own, from a synced state)
  // -------------------------------------------------------------------------------------------

  it("C1: B edits E7 after A's offline edit - A loses, its text is kept in a note, the server has B's version", async () => {
    await freshOnline();
    const e7 = await B.createEntry(entryInput('E7 Morning walk', { time: '10:00' }));
    const shown = await entries.get(e7.id);
    await goDown();
    await entries.update(e7.id, { ...inputOf(shown), body: 'A wrote this offline.' });
    await serverClockPastLastEdit();
    const later = await B.op({ kind: 'entry.update', target: { id: e7.id }, base: e7.updatedAt, payload: { ...inputOf(e7), body: 'B wrote this later.' } });
    expect(later.outcome).toBe('applied');
    const from = A.transport.ops.length;
    expect(await comeBack()).toEqual({ remaining: 0, attention: 1 });
    expect(A.transport.outcomesSince(from)).toEqual(['entry.update:conflict-lost']);
    const [note] = offline.notes.list();
    expect(note.reason).toBe('lost');
    expect(note.label).toMatchObject({ kind: 'entry.update', title: 'E7 Morning walk' });
    expect((note.mine as Entry).body).toBe('A wrote this offline.');
    expect((note.other as Entry).body).toBe('B wrote this later.');
    expect((await B.entry(e7.id))?.body).toBe('B wrote this later.');
    expect((await entries.get(e7.id)).body).toBe('B wrote this later.');
  });

  it("C2: A's offline edit is newer than B's - A wins, the server has A's version, the note offers B's (replaced)", async () => {
    await freshOnline();
    const e = await B.createEntry(entryInput('E10 Garden', { time: '11:00' }));
    const shown = await entries.get(e.id);
    await goDown();
    // B is an older app here (the REST route): its edit time is the entry's updatedAt all the same.
    const first = await B.updateEntry(e.id, { ...inputOf(e), body: 'B edited it first.' });
    await deviceClockPast(first.updatedAt);
    await entries.update(e.id, { ...inputOf(shown), body: 'A edited it later, offline.' });
    const from = A.transport.ops.length;
    expect(await comeBack()).toEqual({ remaining: 0, attention: 1 });
    expect(A.transport.outcomesSince(from)).toEqual(['entry.update:conflict-won']);
    const [note] = offline.notes.list();
    expect(note.reason).toBe('won');
    expect((note.other as Entry).body).toBe('B edited it first.');
    expect((note.mine as Entry).body).toBe('A edited it later, offline.');
    expect((await B.entry(e.id))?.body).toBe('A edited it later, offline.');
  });

  it("C3: B deletes E8, A edits it offline - gone: nothing comes back on the server, A's text is in a note", async () => {
    await freshOnline();
    const e8 = await B.createEntry(entryInput('E8 Picnic', { time: '12:00' }));
    const shown = await entries.get(e8.id);
    await goDown();
    await B.deleteEntry(e8.id);
    await entries.update(e8.id, { ...inputOf(shown), body: 'A edited a deleted entry.' });
    const from = A.transport.ops.length;
    expect(await comeBack()).toEqual({ remaining: 0, attention: 1 });
    expect(A.transport.outcomesSince(from)).toEqual(['entry.update:gone']);
    const [note] = offline.notes.list();
    expect(note.reason).toBe('gone');
    expect((note.mine as Entry).body).toBe('A edited a deleted entry.');
    expect(await B.entry(e8.id)).toBeNull();
    expect((await B.entries()).items.some((x) => x.title === 'E8 Picnic')).toBe(false);
    const read = await entries.get(e8.id).then(
      () => null,
      (e: unknown) => e,
    );
    expect(isApiClientError(read) && read.status).toBe(404);
  });

  it('C4: A deletes E9 offline, B edits it later - E9 is not deleted', async () => {
    await freshOnline();
    const e9 = await B.createEntry(entryInput('E9 Concert', { time: '13:00' }));
    await entries.get(e9.id);
    await goDown();
    await entries.remove(e9.id);
    await serverClockPastLastEdit();
    await B.op({ kind: 'entry.update', target: { id: e9.id }, base: e9.updatedAt, payload: { ...inputOf(e9), body: 'B edited it after the delete.' } });
    const from = A.transport.ops.length;
    expect(await comeBack()).toEqual({ remaining: 0, attention: 1 });
    expect(A.transport.outcomesSince(from)).toEqual(['entry.delete:conflict-lost']);
    expect(offline.notes.list()[0].reason).toBe('deleteLost');
    expect((await B.entry(e9.id))?.body).toBe('B edited it after the delete.');
    expect((await entries.get(e9.id)).body).toBe('B edited it after the delete.');
  });

  it('C5: settings - A changed language and theme offline, B the theme later: language applied, theme lost (per key)', async () => {
    await freshOnline();
    const before = await settings.get();
    expect(before.theme).toBe('dark');
    await goDown();
    await settings.update({ language: 'he', theme: 'light' });
    await serverClockPastLastEdit();
    const bResult = await B.op({ kind: 'settings.patch', base: { theme: before.theme }, payload: { theme: 'system' } });
    expect(bResult.keys).toEqual({ theme: 'applied' });
    const from = A.transport.ops.length;
    await comeBack();
    const sent = A.transport.opsSince(from).filter((o) => o.result);
    expect(sent.map((o) => o.op.kind)).toEqual(['settings.patch']);
    expect(sent[0].result?.keys).toEqual({ language: 'applied', theme: 'conflict-lost' });
    const server = await B.settings();
    expect([server.language, server.theme]).toEqual(['he', 'system']);
    expect((await settings.get()).theme).toBe('system');
    // Section 4.9: the key that lost gets one line, although the patch as a whole was applied (section
    // 0.3: the losing version is never silently lost).
    const notes = offline.notes.list();
    expect(notes.map((n) => [n.reason, n.label.settingKeys])).toEqual([['otherLost', ['theme']]]);
  });

  it('C6: B renames a habit while A archives it offline - both changes stay (field-scoped)', async () => {
    await freshOnline();
    const h = await B.createHabit(habitInput('Reading', { target: 20, unit: 'pages' }));
    await habits.list(true);
    await goDown();
    await habits.archive(h.id, true);
    await serverClockPastLastEdit();
    const fields = { name: h.name, description: h.description, target: h.target, unit: h.unit, frequency: h.frequency, reminderTime: h.reminderTime ?? null, reminderEnabled: h.reminderEnabled };
    await B.op({ kind: 'habit.update', target: { id: h.id }, base: fields, payload: { ...habitInput('Reading', { target: 20, unit: 'pages' }), name: 'Reading (renamed on B)' } });
    const from = A.transport.ops.length;
    expect(await comeBack()).toEqual({ remaining: 0, attention: 0 });
    expect(A.transport.outcomesSince(from)).toEqual(['habit.archive:applied']);
    const onServer = (await B.habits(true)).find((x) => x.id === h.id);
    expect([onServer?.name, onServer?.isArchived]).toEqual(['Reading (renamed on B)', true]);
  });

  it("C7: B logs 3 on a habit for today, A logs 2 later - A's value wins, the note keeps B's", async () => {
    await freshOnline();
    const h = await B.createHabit(habitInput('Steps', { target: 5, unit: 'k steps' }));
    const shown = await habits.progress(TODAY);
    expect(shown.find((p) => p.habit.id === h.id)?.today ?? null).toBeNull();
    await goDown();
    await B.op({ kind: 'log.set', habit: { id: h.id }, date: TODAY, base: null, payload: { value: 3, note: '' } });
    await deviceClockPast(B.lastEditedAt);
    await habits.log({ habitId: h.id, date: TODAY, value: 2 });
    const from = A.transport.ops.length;
    expect(await comeBack()).toEqual({ remaining: 0, attention: 1 });
    expect(A.transport.outcomesSince(from)).toEqual(['log.set:conflict-won']);
    expect((await B.logs(h.id, TODAY)).map((l) => l.value)).toEqual([2]);
    const [note] = offline.notes.list();
    expect(note.reason).toBe('otherWon');
    expect((note.other as { value?: number }).value).toBe(3);
    await dismissAllNotes();
  });

  // -------------------------------------------------------------------------------------------
  // Step 7: lifecycle (L6 has its own server, below)
  // -------------------------------------------------------------------------------------------

  it('L1: the server restarts between the offline writes and the replay - the remember-me session reopens the vault', async () => {
    await freshOnline();
    await goDown();
    const created = await entries.create(entryInput('L1 Written before the server restart'));
    expect(created.id).toBeLessThan(0);
    await rig.restart();
    const from = A.transport.ops.length;
    expect(await comeBack()).toEqual({ remaining: 0, attention: 0 });
    expect(A.transport.outcomesSince(from)).toEqual(['entry.create:applied']);
    expect((await B.entries()).items.filter((x) => x.title === 'L1 Written before the server restart')).toHaveLength(1);
    const onDisk = await rig.onDisk(danaId, danaPassword, (db) => db.scalar<number>("SELECT COUNT(*) FROM entries WHERE title = 'L1 Written before the server restart'"));
    expect(Number(onDisk)).toBe(1);
  });

  it('L2: a regular session and a server restart - 401; the outbox stays, nothing else was ever at rest; sign in, key, replay', async () => {
    await freshOnline();
    await A.signOut();
    expect(await A.databases()).not.toContain(accountDbName(danaId));
    expect(A.keyVault.blobs.has(danaId)).toBe(false);
    const { outcome } = await A.signIn(DANA.username, danaPassword, false);
    expect(outcome.enabled).toBe(true);
    // A session without "Remember me" (section 5.1): no key and no binding on the device, the read
    // cache in memory only - so the outbox and its mirror are all that a 401 can leave behind. (The 401
    // purge of a remember-me device - cache, journal, id map, wrapped key, snapshot, binding - is L3 and L4.)
    expect(A.engine.cache.persistent).toBe(false);
    expect(A.keyVault.blobs.has(danaId)).toBe(false);
    expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();
    await entries.list({ limit: 50 });

    await goDown();
    await entries.create(entryInput('L2 Written in a regular session'));
    expect(getSyncStatus().pending).toBe(1);
    await rig.restart();
    const requestsBefore = A.transport.requests.length;
    A.transport.set('online');
    await offline.tryNow();
    await tornDownBy401();
    expect(A.transport.requests.slice(requestsBefore).some((r) => r.status === 401)).toBe(true);
    const kept = await A.storedRows(danaId);
    expect(kept.outbox).toHaveLength(1);
    expect([kept.cache, kept.journal, kept.idmap, kept.wrappedKey, kept.snapshot]).toEqual([0, 0, 0, false, false]);
    expect(A.mirror.names(danaId).filter((n) => n.endsWith('.op'))).toHaveLength(1);

    const from = A.transport.ops.length;
    const again = await A.signIn(DANA.username, danaPassword, true);
    expect(again.outcome.enabled).toBe(true);
    expect(await offline.drain()).toEqual({ remaining: 0, attention: 0 });
    expect(A.transport.outcomesSince(from)).toEqual(['entry.create:applied']);
    expect((await B.entries()).items.filter((x) => x.title === 'L2 Written in a regular session')).toHaveLength(1);
  });

  it('L3: the password changes on B - the remember-me device gets 401: the outbox and mirror stay, everything else at rest goes and it no longer opens offline; it signs in with the new password and replays', async () => {
    await freshOnline();
    // What a remember-me device holds at rest before the 401 (section 4.8, the "401" row): the read
    // cache, the journal and id map of an acknowledged write, the wrapped key, the snapshot, the binding.
    const online = await entries.create(entryInput('L3 Written online, before the password change'));
    expect(online.id).toBeGreaterThan(0);
    await offline.drain();
    await entries.list({ limit: 50 });
    const atRest = await A.storedRows(danaId);
    expect(atRest.cache).toBeGreaterThan(0);
    expect(atRest.journal).toBeGreaterThan(0);
    expect(atRest.idmap).toBeGreaterThan(0);
    expect([atRest.wrappedKey, atRest.snapshot]).toEqual([true, true]);
    expect((JSON.parse(window.localStorage.getItem(BINDING_KEY) ?? '{}') as { userId?: string }).userId).toBe(danaId);
    const tokenBefore = getToken();
    expect(tokenBefore).toBeTruthy();

    await goDown();
    await entries.create(entryInput('L3 Written before the password change'));
    await B.changePassword(danaPassword, NEW_PASSWORD);
    danaPassword = NEW_PASSWORD;
    A.transport.set('online');
    await offline.tryNow();
    await tornDownBy401();
    const kept = await A.storedRows(danaId);
    expect(kept.outbox).toHaveLength(1);
    expect([kept.cache, kept.journal, kept.idmap, kept.wrappedKey, kept.snapshot]).toEqual([0, 0, 0, false, false]);
    expect(window.localStorage.getItem(BINDING_KEY)).toBeNull();
    expect(A.mirror.names(danaId).filter((n) => n.endsWith('.op'))).toHaveLength(1);
    // A device the server signed out opens nothing offline any more, even with its old token in hand.
    expect(await A.reopenFromCache(tokenBefore)).toMatchObject({ ok: false });

    const from = A.transport.ops.length;
    await A.signIn(DANA.username, NEW_PASSWORD, true);
    expect(await offline.drain()).toEqual({ remaining: 0, attention: 0 });
    expect(A.transport.outcomesSince(from)).toEqual(['entry.create:applied']);
    expect((await B.entries()).items.filter((x) => x.title === 'L3 Written before the password change')).toHaveLength(1);
  });

  it("L4: Lior signs in on A - nothing of Dana's is sent with his token, her database is untouched; a forged operation gets 409", async () => {
    await freshOnline();
    await entries.list({ limit: 50 });
    expect((await A.storedRows(danaId)).wrappedKey).toBe(true);
    const tokenBefore = getToken();
    await goDown();
    await entries.create(entryInput('L4 Dana wrote this before Lior signed in'));
    // Dana's session on A is signed out from device B (Settings - connected devices).
    const aSession = (await B.sessions()).find((x) => x.deviceName === 'Phone A' && !x.current);
    expect(aSession).toBeDefined();
    await B.revokeSession((aSession as { id: string }).id);
    A.transport.set('online');
    await offline.tryNow();
    await tornDownBy401();
    const danaBefore = await A.storedRows(danaId);
    expect(danaBefore.outbox).toHaveLength(1);
    // The revoked device keeps the outbox only, and does not open offline any more (section 4.8).
    expect([danaBefore.cache, danaBefore.journal, danaBefore.idmap, danaBefore.wrappedKey, danaBefore.snapshot]).toEqual([0, 0, 0, false, false]);
    expect(await A.reopenFromCache(tokenBefore)).toMatchObject({ ok: false });

    const from = A.transport.ops.length;
    const lior = await A.register(LIOR, LIOR_PASSWORD, true);
    const liorId = lior.auth.user.id;
    expect(lior.outcome.enabled).toBe(true);
    expect(offline.activeUserId()).toBe(liorId);
    // The login page's neutral line: another account has changes waiting on this device (never their contents).
    expect(await offline.otherAccountsWithPending(liorId)).toEqual([{ userId: danaId, count: 1 }]);
    const mine = await entries.create(entryInput("L4 Lior's own entry"));
    expect(mine.id).toBeGreaterThan(0);
    await offline.drain();
    const sent = A.transport.opsSince(from);
    expect(sent.length).toBeGreaterThan(0);
    for (const o of sent) {
      expect(o.op.account).toBe(liorId);
      expect(o.token).toBe(lior.auth.token);
    }
    // Dana's database: byte for byte what it was.
    expect(await A.storedRows(danaId)).toEqual(danaBefore);
    // A hand-made operation for Dana's account with Lior's token: 409 account mismatch.
    const forged = await request('/api/sync/op', {
      method: 'POST',
      body: { v: 1, account: danaId, opId: crypto.randomUUID(), editedAt: new Date().toISOString(), epoch: '0000000000000000', kind: 'settings.patch', payload: { theme: 'dark' } },
    }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(isApiClientError(forged) && [forged.status, forged.code]).toEqual([409, 'FORBIDDEN']);
    expect((await B.entries()).items.some((x) => x.title === 'L4 Dana wrote this before Lior signed in')).toBe(false);

    // Lior signs out (nothing of his stays); Dana signs in again and her change goes up.
    await A.signOut();
    expect(await A.databases()).not.toContain(accountDbName(liorId));
    const back = A.transport.ops.length;
    await A.signIn(DANA.username, danaPassword, true);
    expect(await offline.drain()).toEqual({ remaining: 0, attention: 0 });
    expect(A.transport.outcomesSince(back)).toEqual(['entry.create:applied']);
    expect((await B.entries()).items.filter((x) => x.title === 'L4 Dana wrote this before Lior signed in')).toHaveLength(1);
  });

  it('L5: the session is locked on the server (423) - the replay pauses; the password unlock resumes it', async () => {
    await freshOnline();
    await entries.list({ limit: 50 });
    // Lock on leave: the server session is locked and the snapshot follows (what the LockProvider
    // does); then the connection goes.
    await auth.lock();
    await offline.updateSession({ locked: true, lastActivityAt: Date.now() });
    await goDown();
    expect((await loadSnapshot(A.engine.store, A.engine.keys))?.locked).toBe(true);
    // The phone's own screen lock unlocks this device only (the lock screen's path is
    // src/pages/LockScreen.offline.test.tsx): the snapshot says unlocked, the server session stays locked.
    await offline.updateSession({ locked: false, lastActivityAt: Date.now() });
    expect((await loadSnapshot(A.engine.store, A.engine.keys))?.locked).toBe(false);
    await entries.create(entryInput('L5 Written while the server session was locked'));
    A.transport.set('online');
    await offline.tryNow();
    await offline.drain();
    expect(getSyncStatus()).toMatchObject({ halted: 'locked', pending: 1 });
    expect(A.transport.requests.some((r) => r.status === 423)).toBe(true);
    expect((await B.entries()).items.some((x) => x.title === 'L5 Written while the server session was locked')).toBe(false);
    // "Enter your password to upload your changes."
    await auth.verifyPassword(danaPassword);
    offline.notifyUnlocked();
    expect(await offline.drain()).toEqual({ remaining: 0, attention: 0 });
    expect(getSyncStatus().halted).toBeNull();
    expect((await B.entries()).items.filter((x) => x.title === 'L5 Written while the server session was locked')).toHaveLength(1);
  });

  it("L7: B restores an older backup - A's queued edit by id is stale (a note), its queued create is applied", async () => {
    await freshOnline();
    const old = await B.createEntry(entryInput('L7 Before the backup', { time: '14:00' }));
    const backupFile = await B.downloadBackup();
    const shown = await entries.get(old.id);
    await goDown();
    await entries.update(old.id, { ...inputOf(shown), body: 'A edited it offline, before the restore.' });
    await entries.create(entryInput('L7 Created offline before the restore'));
    const restored = await B.restoreBackup(backupFile, danaPassword);
    expect(restored.entries).toBeGreaterThan(0);
    const from = A.transport.ops.length;
    expect(await comeBack()).toEqual({ remaining: 0, attention: 1 });
    expect(A.transport.outcomesSince(from)).toEqual(['entry.update:stale', 'entry.create:applied']);
    const [note] = offline.notes.list();
    expect(note.reason).toBe('stale');
    expect((note.mine as Entry).body).toBe('A edited it offline, before the restore.');
    expect((await B.entry(old.id))?.body).toBe('L7 Before the backup: a fictional day.');
    expect((await B.entries()).items.filter((x) => x.title === 'L7 Created offline before the restore')).toHaveLength(1);
    await dismissAllNotes();
  });

  it("L8: A's IndexedDB is evicted while the mirror files remain - after sign-in the changes are recovered and applied exactly once", async () => {
    await freshOnline();
    const e = await B.createEntry(entryInput('L8 Existing entry', { time: '15:00' }));
    const shown = await entries.get(e.id);
    await goDown();
    await entries.create(entryInput('L8 Created offline, its answer lost'));
    await entries.update(e.id, { ...inputOf(shown), body: 'L8 edited offline.' });
    // The connection is back for a moment: the create reaches the server, its answer is lost, the network goes again.
    const from = A.transport.ops.length;
    A.transport.once('/api/sync/op', 'drop-response', { method: 'POST', then: 'down' });
    A.transport.set('online');
    await offline.tryNow();
    expect((await offline.drain()).remaining).toBe(2);
    expect(A.transport.opsSince(from).map((o) => `${o.mode}:${o.op.kind}:${o.result?.outcome}`)).toEqual(['drop-response:entry.create:applied']);
    expect(A.mirror.names(danaId).filter((n) => n.endsWith('.op'))).toHaveLength(2);

    // The app is closed and the system evicts the WebView's storage (the token goes with it).
    await A.evict(danaId);
    expect(await A.databases()).not.toContain(accountDbName(danaId));
    A.wire();
    A.transport.set('online');
    const back = A.transport.ops.length;
    const { outcome } = await A.signIn(DANA.username, danaPassword, true);
    expect(outcome).toMatchObject({ enabled: true, recovered: 2 });
    expect(await offline.drain()).toEqual({ remaining: 0, attention: 0 });
    expect(A.transport.outcomesSince(back)).toEqual(['entry.create:unchanged', 'entry.update:applied']);
    expect((await B.entries()).items.filter((x) => x.title === 'L8 Created offline, its answer lost')).toHaveLength(1);
    expect((await B.entry(e.id))?.body).toBe('L8 edited offline.');
    expect(A.mirror.names(danaId).filter((n) => n.endsWith('.op'))).toEqual([]);
  });

  it('L9: a black hole - the timeout leads to OFFLINE; the recovery leads to exactly one record', async () => {
    await freshOnline();
    await entries.list({ limit: 50 });
    expect(offline.__engineForTests()?.connectivity.dataOffline).toBe(false);
    __setOpTimeoutForTests(1500);
    try {
      const from = A.transport.ops.length;
      A.transport.set('blackhole');
      // The device still believes it is online: the write waits for its 2 s confirmation, then is kept on the device.
      const created = await entries.create(entryInput('L9 Written into a black hole'));
      expect(isPendingRecord(created)).toBe(true);
      // The send times out (status 0), the probe times out too (5 s): OFFLINE, the bar shows.
      await waitUntil('OFFLINE after the timeouts', () => getSyncStatus().phase === 'offline' && getSyncStatus().showOffline, 20_000);
      // The server did get the request (only the answer was lost).
      await waitUntil('the server has the blackholed create', async () => (await B.entries()).items.some((x) => x.title === 'L9 Written into a black hole'), 10_000);
      expect(getSyncStatus().pending).toBe(1);
      expect(await comeBack()).toEqual({ remaining: 0, attention: 0 });
      const answered = A.transport.opsSince(from).filter((o) => o.mode === 'online').map((o) => `${o.op.kind}:${o.result?.outcome}`);
      expect(answered).toEqual(['entry.create:unchanged']);
      expect((await B.entries()).items.filter((x) => x.title === 'L9 Written into a black hole')).toHaveLength(1);
    } finally {
      __setOpTimeoutForTests(null);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// L6: the quota - its own server with a small DIARY_MAX_DIARY_BYTES, its own device
// ---------------------------------------------------------------------------------------------

/** Small enough to fill with one big entry, larger than a new diary. */
const QUOTA_BYTES = 512 * 1024;
const quotaRig = new HostedRig({ maxDiaryBytes: QUOTA_BYTES });
const C = new Device('Phone C', () => quotaRig.base, realFetch);

describe('L6: the diary is full - creates wait (507), a delete in another chain goes through', { timeout: STEP_TIMEOUT_MS }, () => {
  beforeAll(async () => {
    await offline.__resetForTests();
    await rig.stop();
    await quotaRig.open();
    C.wire();
  }, BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await offline.__resetForTests().catch(() => undefined);
    await quotaRig.close();
  }, 60_000);

  it('L6', async () => {
    const zohar = await C.register(ZOHAR, ZOHAR_PASSWORD, true);
    expect(zohar.outcome.enabled).toBe(true);
    const doomed = await entries.create(entryInput('L6 To be deleted'));
    expect(doomed.id).toBeGreaterThan(0);
    await entries.get(doomed.id);
    await entries.list({ limit: 50 });
    // Another device of Zohar's fills the diary up to the quota with one long entry.
    const peer = new Peer(realFetch, () => quotaRig.base, 'Laptop of Zohar');
    await peer.signIn(ZOHAR.username, ZOHAR_PASSWORD);
    await peer.createEntry(entryInput('L6 A very long entry', { body: 'fictional words fill the diary '.repeat(Math.ceil((QUOTA_BYTES * 1.2) / 31)) }));
    expect((await peer.raw('POST', '/api/entries', entryInput('L6 One more'))).status).toBe(507);

    await goDown(C);
    await entries.create(entryInput('L6 Created while the diary is full'));
    await entries.remove(doomed.id);
    expect(getSyncStatus().pending).toBe(2);
    const from = C.transport.ops.length;
    const left = await comeBack(C);
    expect(left.remaining).toBe(1);
    const answers = C.transport.opsSince(from).map((o) => `${o.op.kind}:${o.status}`);
    // The create goes first (lower seq), is refused with 507 and its chain waits; the delete is not blocked by it.
    expect(answers.slice(0, 2)).toEqual(['entry.create:507', 'entry.delete:200']);
    expect(C.transport.opsSince(from).find((o) => o.op.kind === 'entry.delete')?.result?.outcome).toBe('applied');
    expect(await peer.entry(doomed.id)).toBeNull();
    expect((await peer.entries()).items.some((x) => x.title === 'L6 Created while the diary is full')).toBe(false);
    // The create waits (backoff), it is not lost and not turned into a note.
    expect(offline.pending().map((p) => p.label.kind)).toEqual(['entry.create']);
    expect(offline.notes.list()).toEqual([]);
    // After the backoff (2 s) the chain tries again - and waits again while the diary stays full.
    await sleep(2500);
    await offline.drain();
    const createAnswers = C.transport.opsSince(from).filter((o) => o.op.kind === 'entry.create').map((o) => o.status);
    expect(createAnswers.length).toBeGreaterThanOrEqual(2);
    expect([...new Set(createAnswers)]).toEqual([507]);
    expect(getSyncStatus().pending).toBe(1);
    expect(offline.notes.list()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Step 8 and the shipped bundles
// ---------------------------------------------------------------------------------------------

describe('what the devices fetched, and what ships', () => {
  it('step 8: every fetched URL is the test server', () => {
    const servers = [rig.base, quotaRig.base];
    const all = [...A.transport.requests.map((r) => r.url), ...C.transport.requests.map((r) => r.url), ...B.urls, ...globalFetches];
    expect(A.transport.requests.length).toBeGreaterThan(100);
    expect(all.filter((url) => !servers.some((s) => url.startsWith(`${s}/api/`)))).toEqual([]);
    // Nothing of the client bypassed its transport, and the WebView's CORS checks never refused a request.
    expect(globalFetches).toEqual([]);
    expect([...A.transport.corsFailures, ...C.transport.corsFailures]).toEqual([]);
  });

  it('the shipped bundles do not contain the test seam module', async () => {
    // Source level: nothing that can reach a bundle imports the e2e helpers, the engine's unit fakes or fake-indexeddb.
    expect(shippedSourcesImportingTestCode()).toEqual([]);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mpd-offline-dist-'));
    try {
      await Promise.all([buildBundle('vite.config.ts', path.join(tmp, 'desktop')), buildBundle('mobile/vite.config.mobile.ts', path.join(tmp, 'mobile'))]);
      const needles = [FAKE_SEAMS_MARKER, 'the test network is down', 'offlineSyncFlag'];
      for (const dir of [path.join(tmp, 'desktop'), path.join(tmp, 'mobile'), path.join(process.cwd(), 'dist'), path.join(process.cwd(), 'mobile-dist')]) {
        const tree = readTree(dir);
        if (dir.startsWith(tmp)) expect(tree.size, dir).toBeGreaterThan(0);
        expect(hits(tree, needles), dir).toEqual([]);
      }
      // The engine itself ships (the facade is in the bundle), so the check above is not vacuous.
      expect(hits(readTree(path.join(tmp, 'mobile')), ['/api/sync/op']).length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 600_000);
});
