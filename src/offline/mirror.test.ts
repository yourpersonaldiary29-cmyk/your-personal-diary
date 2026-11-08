import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { EntryInput } from '@shared/types';
import { randomUuid } from './crypto';
import { OfflineEngine } from './engine';
import { decodeMirrorFile, encodeOutboxRow, MIRROR_NAME_RE, opFileName } from './mirror';
import { setOfflinePlatform, __resetOfflinePlatformForTests } from './seams';
import { openAccountStore } from './store/idb';
import { DANA, fakeMirror, freshIndexedDb, installWebCrypto, testKeys } from './test-utils/env';
import type { QueuedOp } from './types';
import { __resetSyncStatusForTests } from './status';

beforeAll(() => installWebCrypto());

const ENTRY: EntryInput = { date: '2026-10-23', time: '08:00', title: 'Morning walk', body: 'x', mood: null, emotions: [], energy: null, stress: null, sleepQuality: null, sleepHours: null, exerciseMinutes: null, exerciseType: '', events: [], people: [], location: '', notes: '', tags: [] };

function createOp(): QueuedOp {
  const clientId = randomUuid();
  return {
    op: { v: 1, account: DANA, opId: randomUuid(), editedAt: '2026-10-23T08:00:00.000Z', epoch: '0123456789abcdef', kind: 'entry.create', clientId, payload: ENTRY },
    record: `c:${clientId}`,
    chain: `entry:c:${clientId}`,
    localId: -1,
    queuedAt: 1,
  };
}

async function openEngine(tokenTag = 'tag') {
  const keys = await testKeys();
  return OfflineEngine.open({ userId: DANA, keys, persistentCache: true, tokenTag, probe: async () => true });
}

describe('outbox mirror (section 5.4)', () => {
  beforeEach(() => {
    freshIndexedDb();
    __resetOfflinePlatformForTests();
  });
  afterEach(() => {
    __resetOfflinePlatformForTests();
    __resetSyncStatusForTests();
  });

  it('file names follow the Tauri contract and a file round-trips', () => {
    const name = opFileName(7, '11111111-1111-4111-8111-111111111111');
    expect(name).toBe('7-11111111-1111-4111-8111-111111111111.op');
    expect(MIRROR_NAME_RE.test(name)).toBe(true);
    expect(MIRROR_NAME_RE.test('../etc/passwd')).toBe(false);
    const row = { seq: 7, rid: '11111111-1111-4111-8111-111111111111', sealed: true, chainTag: 'abcd', deps: [3], attempts: 2, nextAt: 99, ct: new Uint8Array([1, 2, 3]) };
    const decoded = decodeMirrorFile(encodeOutboxRow(row));
    expect(decoded?.store).toBe('outbox');
    if (decoded?.store === 'outbox') {
      expect(decoded.row).toMatchObject({ seq: 7, sealed: true, chainTag: 'abcd', deps: [3], attempts: 2, nextAt: 0 });
      expect([...decoded.row.ct]).toEqual([1, 2, 3]);
    }
    expect(decodeMirrorFile(new TextEncoder().encode('garbage'))).toBeNull();
  });

  it('every enqueued operation is mirrored as the same ciphertext, and removed with it', async () => {
    const mirror = fakeMirror();
    setOfflinePlatform({ mirror });
    const engine = await openEngine();
    const q = createOp();
    const r = await engine.enqueue({ q, deps: [], idmap: [{ localId: -1, kind: 'entry', clientId: (q.op as { clientId: string }).clientId }] });
    const files = mirror.files.get(DANA)!;
    expect([...files.keys()]).toEqual([opFileName(r.seq, q.op.opId)]);
    const row = (await engine.outbox.load())[0].row;
    const decoded = decodeMirrorFile(files.get(opFileName(r.seq, q.op.opId))!);
    expect(decoded?.store === 'outbox' && [...decoded.row.ct].join()).toBe([...row.ct].join());
    engine.stop();
  });

  it('recovers the operations from the mirror when the database is gone (evicted)', async () => {
    const mirror = fakeMirror();
    setOfflinePlatform({ mirror });
    const first = await openEngine();
    const q1 = createOp();
    const q2 = createOp();
    await first.enqueue({ q: q1, deps: [], idmap: [] });
    await first.enqueue({ q: q2, deps: [], idmap: [] });
    first.stop();
    expect(mirror.files.get(DANA)!.size).toBe(2);

    // Eviction: a brand-new IndexedDB, the mirror files still there.
    freshIndexedDb();
    const second = await openEngine();
    expect(second.recovered).toBe(2);
    const rows = await second.outbox.load();
    expect(rows.map((r) => r.q.op.opId).sort()).toEqual([q1.op.opId, q2.op.opId].sort());
    expect(rows.every((r) => r.row.attempts === 0 && r.row.nextAt === 0)).toBe(true);
    second.stop();
  });

  it('deletes orphan mirror files when the database exists', async () => {
    const mirror = fakeMirror();
    setOfflinePlatform({ mirror });
    const engine = await openEngine();
    const q = createOp();
    const r = await engine.enqueue({ q, deps: [], idmap: [] });
    engine.stop();
    // An acknowledged operation whose mirror file was left behind (a crash between the two deletes).
    await mirror.put(DANA, opFileName(r.seq + 50, randomUuid()), new TextEncoder().encode('{}'));
    expect(mirror.files.get(DANA)!.size).toBe(2);
    const again = await openEngine();
    expect(again.recovered).toBeNull();
    expect([...mirror.files.get(DANA)!.keys()]).toEqual([opFileName(r.seq, q.op.opId)]);
    again.stop();
  });

  it('a mirror that fails never fails the save', async () => {
    const broken = { ...fakeMirror(), put: async () => Promise.reject(new Error('disk full')) };
    setOfflinePlatform({ mirror: broken });
    const errors: unknown[] = [];
    const keys = await testKeys();
    const engine = await OfflineEngine.open({ userId: DANA, keys, persistentCache: true, tokenTag: 't', probe: async () => true, onError: (e) => errors.push(e) });
    await expect(engine.enqueue({ q: createOp(), deps: [], idmap: [] })).resolves.toMatchObject({ action: 'append' });
    expect(errors).toHaveLength(1);
    engine.stop();
    const { store } = await openAccountStore(DANA);
    expect(await store.tx(['outbox'], 'readonly', (t) => t.count('outbox'))).toBe(1);
    store.close();
  });
});
