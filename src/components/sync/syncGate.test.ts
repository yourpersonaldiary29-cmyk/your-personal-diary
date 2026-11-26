/**
 * The sign-out gate and "drain first" against the real offline engine (docs/android-tasks/OFFLINE-DESIGN.md
 * section 4.8 "never silently lose the user's text"; package OFFLINE-SEAL item 2). Each of them counts what
 * is on the device, waits for an upload, and counts again: the second count must be made against what is
 * true AFTER the upload - an engine that was torn down while it ran (a 401, a stop) counts nothing, while
 * the changes are still in the account's database. Fictional data only ("Dana", "Morning walk").
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryInput } from '@shared/types';
import * as api from '@/api';
import { getToken } from '@/api/client';
import { getSyncStatus, isPendingRecord, offline } from '@/offline';
import { openAccountStore, openExistingAccountStore } from '@/offline/store/idb';
import { bootDevice, DANA, installWebCrypto, resetOfflineTestEnv, waitFor } from '@/offline/test-utils/env';
import { FakeSyncServer } from '@/offline/test-utils/fake-sync-server';
import {
  __resetSyncGateForTests,
  drainBeforeOnlineWrite,
  endSessionKeepingChanges,
  finishSignOut,
  getSignedOutPending,
  setLogoutConfirmer,
  signOutDecision,
  type LogoutPrompt,
} from './syncGate';

const ENTRY: EntryInput = {
  date: '2026-10-23',
  time: '08:00',
  title: 'Morning walk',
  body: 'Along the river.',
  mood: null,
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
  tags: [],
};

let server: FakeSyncServer;

beforeAll(() => installWebCrypto());

beforeEach(() => {
  server = new FakeSyncServer();
  __resetSyncGateForTests();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await resetOfflineTestEnv();
  __resetSyncGateForTests();
});

/** Waiting operations of Dana in her database, counted without the engine. */
async function atRest(): Promise<number> {
  return (await offline.otherAccountsWithPending(null)).find((a) => a.userId === DANA)?.count ?? 0;
}

/**
 * Dana has one change waiting on the device; the connection returns on a slow network and the upload has
 * started (the bar says "uploading", the change is still waiting) - the moment the user acts.
 */
async function uploadUnderWay(opts: { revoked: boolean }) {
  const booted = await bootDevice({ server });
  server.mode = 'down';
  booted.engine.connectivity.noteFailure();
  await api.entries.create(ENTRY);
  expect(getSyncStatus().pending).toBe(1);
  if (opts.revoked) server.revoke(booted.account.token);
  server.latencyMs = 250;
  server.mode = 'online';
  void offline.tryNow();
  await waitFor(() => getSyncStatus().phase === 'syncing', 5000);
  expect(getSyncStatus().pending).toBe(1);
  return booted;
}

describe('the sign-out gate when the engine goes while it uploads (section 4.8)', () => {
  it('the upload meets a 401: "keep" - the change stays in the database and the login page will say so; no dialog, no wipe', async () => {
    const asked = vi.fn(async (_p: LogoutPrompt) => 'delete' as const);
    setLogoutConfirmer(asked);
    await uploadUnderWay({ revoked: true });

    const answer = await signOutDecision(DANA);

    expect(answer).toMatchObject({ decision: 'keep', count: 1 });
    expect(answer.covered?.operations).toHaveLength(1);
    expect(asked).not.toHaveBeenCalled();
    expect(getToken()).toBeNull();
    await waitFor(() => !offline.isActive(), 5000);
    expect(await atRest()).toBe(1);
    // What the sign-out then does: the 401's ending - the change stays, the login page has its number.
    await endSessionKeepingChanges(DANA);
    expect(await atRest()).toBe(1);
    expect(getSignedOutPending()).toEqual({ userId: DANA, count: 1 });
    expect(server.diary(DANA).entries.size).toBe(0);
  }, 30000);

  it('the engine is stopped during the upload while the session stays: the change is counted at rest and the dialog asks', async () => {
    const asked = vi.fn(async (_p: LogoutPrompt) => 'stay' as const);
    setLogoutConfirmer(asked);
    await uploadUnderWay({ revoked: false });

    const decided = signOutDecision(DANA);
    // The engine stops while the sign-out waits for the upload (another start, the server turning offline
    // mode off): before the change was sent.
    await offline.stop();
    const answer = await decided;

    expect(asked).toHaveBeenCalledTimes(1);
    expect(asked.mock.calls[0][0]).toEqual({ count: 1, allowReview: false });
    expect(answer).toMatchObject({ decision: 'stay', count: 1 });
    expect(await atRest()).toBe(1);
  }, 30000);

  it('"Delete them and sign out" after such a stop: "wipe" (the user chose it)', async () => {
    setLogoutConfirmer(async () => 'delete');
    await uploadUnderWay({ revoked: false });
    const decided = signOutDecision(DANA);
    await offline.stop();
    expect(await decided).toMatchObject({ decision: 'wipe', count: 1, covered: { operations: [expect.any(String)], notes: [] } });
  }, 30000);

  it('an upload that empties the outbox: "wipe" without a question, as before', async () => {
    const asked = vi.fn(async (_p: LogoutPrompt) => 'stay' as const);
    setLogoutConfirmer(asked);
    await uploadUnderWay({ revoked: false });
    expect(await signOutDecision(DANA)).toEqual({ decision: 'wipe', count: 0, covered: { operations: [], notes: [] } });
    expect(asked).not.toHaveBeenCalled();
    expect(server.diary(DANA).entries.size).toBe(1);
  }, 30000);
});

describe('drain first when the engine goes while it uploads (section 4.3)', () => {
  it('the upload meets a 401: the online-only write does not go ahead', async () => {
    await uploadUnderWay({ revoked: true });
    const onLeft = vi.fn();
    expect(await drainBeforeOnlineWrite({ onLeft })).toBe(false);
    expect(onLeft).toHaveBeenCalledTimes(1);
    expect(await atRest()).toBe(1);
  }, 30000);

  it('the engine is stopped during the upload: the online-only write does not go ahead', async () => {
    await uploadUnderWay({ revoked: false });
    const onLeft = vi.fn();
    const drained = drainBeforeOnlineWrite({ onLeft });
    await offline.stop();
    expect(await drained).toBe(false);
    expect(onLeft).toHaveBeenCalledTimes(1);
    expect(await atRest()).toBe(1);
  }, 30000);

  it('the upload empties what this engine knew, another tab saves a change and the engine stops: the change at rest stops the write', async () => {
    const { engine } = await uploadUnderWay({ revoked: false });
    const realSettle = engine.replayer.settle.bind(engine.replayer);
    engine.replayer.settle = async () => {
      await realSettle(); // this engine's change is uploaded: what it knows is 0
      await rowOfAnotherTab();
      await offline.stop();
    };
    const onLeft = vi.fn();
    expect(await drainBeforeOnlineWrite({ onLeft })).toBe(false);
    expect(onLeft).toHaveBeenCalledTimes(1);
    expect(server.diary(DANA).entries.size).toBe(1);
    expect(await atRest()).toBe(1);
  }, 30000);

  it('an engine that stopped during the upload and a database that cannot be read: the write does not go ahead on a guess', async () => {
    const { engine } = await uploadUnderWay({ revoked: false });
    const realSettle = engine.replayer.settle.bind(engine.replayer);
    engine.replayer.settle = async () => {
      await realSettle(); // what this engine knew is uploaded; whether another tab saved something cannot be read
      await offline.stop();
    };
    vi.spyOn(offline, 'changesAtRest').mockResolvedValue(null);
    expect(await drainBeforeOnlineWrite()).toBe(false);
  }, 30000);
});

/** A row another tab of Dana's put into her outbox (ciphertext this tab never decrypts; only its id is read). */
async function rowOfAnotherTab(rid = 'another-tab-row'): Promise<void> {
  const { store } = await openAccountStore(DANA);
  try {
    await store.tx(['outbox'], 'readwrite', (t) => t.put('outbox', { rid, sealed: false, chainTag: 'other', deps: [], attempts: 0, nextAt: 0, ct: new Uint8Array([1, 2, 3]) }));
  } finally {
    store.close();
  }
}

describe('the end of a sign-out: only what the answer covered is deleted (section 4.8)', () => {
  it('nothing new at rest: the copy is deleted', async () => {
    await bootDevice({ server });
    server.mode = 'down';
    offline.__engineForTests()!.connectivity.noteFailure();
    await api.entries.create(ENTRY);
    setLogoutConfirmer(async () => 'delete');
    const answer = await signOutDecision(DANA);
    expect(answer).toMatchObject({ decision: 'wipe', count: 1 });
    expect(await finishSignOut(DANA, answer)).toBe('wiped');
    expect(await offline.changesAtRest(DANA)).toEqual({ operations: [], notes: [] });
  }, 30000);

  it('a save that starts after the last count and before the delete is refused (its page is told), never saved into a database that is then deleted', async () => {
    await bootDevice({ server });
    server.mode = 'down';
    offline.__engineForTests()!.connectivity.noteFailure();
    const answer = await signOutDecision(DANA);
    expect(answer).toMatchObject({ decision: 'wipe', count: 0 });
    const realRead = offline.changesAtRest.bind(offline);
    let saving: Promise<string> | null = null;
    vi.spyOn(offline, 'changesAtRest').mockImplementation(async (userId: string) => {
      const now = await realRead(userId);
      // An autosave fires right after the last count, before the database is deleted.
      saving = api.entries.create(ENTRY).then(
        (r) => (isPendingRecord(r) ? 'saved on this device' : 'saved'),
        () => 'not saved',
      );
      await saving;
      return now;
    });
    const end = await finishSignOut(DANA, answer);
    const told = await saving!;
    const left = await atRest();
    // Never "saved on this device" for a change that is not on the device.
    if (told === 'saved on this device') expect(left).toBe(1);
    else expect(told).toBe('not saved');
    expect(end).toBe(left ? 'kept' : 'wiped');
  }, 30000);

  it('the same count, another change (the covered one was replaced): kept, never deleted unasked', async () => {
    await bootDevice({ server });
    server.mode = 'down';
    offline.__engineForTests()!.connectivity.noteFailure();
    const first = await api.entries.create(ENTRY);
    setLogoutConfirmer(async () => 'delete');
    const answer = await signOutDecision(DANA);
    expect(answer.count).toBe(1);
    // While the sign-out waits for the server, the page edits the entry: the waiting operation is a new one.
    await api.entries.update(first.id, { ...ENTRY, title: 'Morning walk, longer' });
    expect(getSyncStatus().pending).toBe(1);
    expect(await finishSignOut(DANA, answer)).toBe('kept');
    expect(await atRest()).toBe(1);
    expect(getSignedOutPending()).toEqual({ userId: DANA, count: 1 });
  }, 30000);

  it.each(['when the sign-out asks', 'at the end of the sign-out'] as const)('a database that cannot be read %s is never taken for an empty one: nothing is deleted', async (when) => {
    await bootDevice({ server });
    server.mode = 'down';
    offline.__engineForTests()!.connectivity.noteFailure();
    await api.entries.create(ENTRY);
    await offline.stop(); // no engine armed: only the database knows
    setLogoutConfirmer(async () => 'delete');
    const read = vi.spyOn(offline, 'changesAtRest');
    if (when === 'when the sign-out asks') read.mockResolvedValueOnce(null);
    const answer = await signOutDecision(DANA);
    if (when === 'when the sign-out asks') {
      // Unknown is not "nothing": whatever is decided, the answer covers nothing it could not read.
      expect(answer.covered).toBeNull();
    } else {
      expect(answer).toMatchObject({ decision: 'wipe', count: 1 });
      read.mockResolvedValueOnce(null);
    }
    expect(await finishSignOut(DANA, { ...answer, decision: 'wipe' })).toBe('kept');
    read.mockRestore();
    expect(await atRest()).toBe(1);
  }, 30000);

  it('a note left on the device counts as a change at rest, also when no engine is armed', async () => {
    const { engine } = await bootDevice({ server });
    await engine.notes.add([{ reason: 'rejected', label: { kind: 'entry', title: 'Morning walk' }, op: { kind: 'entry.delete' }, message: 'x' } as never]);
    await offline.stop();
    const asked = vi.fn(async (_p: LogoutPrompt) => 'stay' as const);
    setLogoutConfirmer(asked);
    expect(await signOutDecision(DANA)).toMatchObject({ decision: 'stay', count: 1 });
    expect(asked).toHaveBeenCalledWith({ count: 1, allowReview: false });
  }, 30000);

  it('a "keep" ending with no engine armed and no binding still purges what is sensitive at rest; the outbox stays', async () => {
    await bootDevice({ server }); // the web, no "Remember me": no binding
    await api.entries.create({ ...ENTRY, title: 'Uploaded and acknowledged' });
    await offline.drain();
    server.mode = 'down';
    offline.__engineForTests()!.connectivity.noteFailure();
    await api.entries.create(ENTRY);
    await offline.stop(); // the engine went earlier (the kill switch, a failed start)
    const before = await sensitiveRows();
    expect(before).toMatchObject({ outbox: 1, journal: 1 });
    expect(before.idmap).toBeGreaterThan(0);
    await endSessionKeepingChanges(DANA);
    expect(await sensitiveRows()).toEqual({ outbox: 1, journal: 0, idmap: 0, cache: 0 });
    expect(getSignedOutPending()).toEqual({ userId: DANA, count: 1 });
  }, 30000);
});

/** The rows of Dana's database that a 401 deletes, and her outbox. */
async function sensitiveRows() {
  const store = await openExistingAccountStore(DANA);
  if (!store) throw new Error('no database');
  try {
    return await store.tx(['outbox', 'journal', 'idmap', 'cache'], 'readonly', async (t) => ({
      outbox: await t.count('outbox'),
      journal: await t.count('journal'),
      idmap: await t.count('idmap'),
      cache: await t.count('cache'),
    }));
  } finally {
    store.close();
  }
}
