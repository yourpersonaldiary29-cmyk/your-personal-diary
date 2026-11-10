/**
 * WP-H10a (docs/android-tasks/OFFLINE-DESIGN.md §3.7, finding E11): restore and the offline sync
 * bookkeeping.
 *   - `carrySyncState`: a restore keeps `sync:key` (the devices' outboxes stay readable) and writes
 *     a NEW `sync:epoch` (queued edits addressed by an integer id become `stale`, because a restore
 *     replaces `sqlite_sequence` and ids may be reused); a live diary without sync rows (local
 *     mode) changes nothing and the restored image is byte-identical to today's;
 *   - on the real hosted composition: after `POST /api/backup/restore` the key is the same on disk,
 *     the epoch is new, an old-epoch update gives `stale`, an old-epoch create gives `applied`;
 *   - hosted only: the local composition never carries, so a local restore is the backup's very
 *     bytes even after a hosted backup (with sync rows) was restored into the live diary;
 *   - the rollback rule of docs/API.md: a restore by a pre-H10 server keeps the old epoch (the
 *     hazard), and the documented remedy (a backup restored right away on WP-H10) makes the queued
 *     edit by id `stale`.
 * Fictional data only ("Dana", "Morning walk", the fixture account "fixture_noa").
 */
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { SyncKeyResponse, SyncOpResult } from '@shared/sync';
import type { AuthResponse, Entry, RestoreInfo } from '@shared/types';
import { createBackupBytes, restoreBackup } from '../src/backup/backup';
import { loadConfig, loadHostedEnv } from '../src/config';
import { DiaryDb } from '../src/db/database';
import { createEntry } from '../src/db/entries-repo';
import { getMeta, setMeta } from '../src/db/settings-repo';
import { startHosted, type RunningHosted } from '../src/hosted';
import { decryptWithPassword } from '../src/security/container';
import { exportImage } from '../src/security/vault';
import { carriesSyncState, carrySyncState, enableSyncCarry } from '../src/sync/restore';
import { applySyncOp } from '../src/sync/apply';
import { ensureSyncState, readSyncState, SYNC_EPOCH_ROW, SYNC_KEY_ROW } from '../src/sync/store';
import { validateSyncOp } from '../src/sync/validate';
import { cleanupTempDirs, fakeAuth, fakeVault, makeTestApp, sampleEntry, tempDataDir, TEST_ACCOUNT } from './helpers';

const PASSWORD = 'Passw0rd!';
const FAST = { kdf: { N: 1024, r: 8, p: 1 } };
const HOST = 'diary.example';
const FIXTURES = path.join(process.cwd(), '..', 'mobile', 'test', 'fixtures');
const running: RunningHosted[] = [];

afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function metaRows(db: DiaryDb): Array<{ key: string; value: string }> {
  return db.all<{ key: string; value: string }>('SELECT key, value FROM meta ORDER BY key').map((r) => ({ key: String(r.key), value: String(r.value) }));
}

interface FixtureManifest {
  files: { backupAccountPassword: string };
  account: { password: string };
  backups: { accountPassword: { plainSha256: string; plainLength: number } };
  content: { entries: number; habits: number };
}

function manifest(): FixtureManifest {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, 'manifest.json'), 'utf8')) as FixtureManifest;
}

describe('carrySyncState', () => {
  it('a live diary without sync rows (local mode) carries nothing: the restored image stays byte-identical', async () => {
    const live = await DiaryDb.create();
    createEntry(live, sampleEntry({ title: 'Morning walk' }) as Parameters<typeof createEntry>[1]);
    const restored = await DiaryDb.create();
    createEntry(restored, sampleEntry({ title: 'From the backup' }) as Parameters<typeof createEntry>[1]);
    restored.markClean();
    const before = exportImage(restored);
    const seq = restored.writeSequence;

    expect(carrySyncState(live, restored)).toBe(false);

    expect(restored.isDirty()).toBe(false);
    expect(restored.writeSequence).toBe(seq);
    expect(Buffer.from(exportImage(restored)).equals(Buffer.from(before))).toBe(true);
    expect(metaRows(restored)).toEqual([]);
    // The live diary was only read.
    expect(metaRows(live)).toEqual([]);
  });

  it('a live diary that synced: the key is copied and a new epoch written - never the live one, never the backup\'s own', async () => {
    const live = await DiaryDb.create();
    const { key, epoch: liveEpoch } = ensureSyncState(live);
    // The backup was made after the key existed: it carries the key and an (older) epoch of its own.
    const restored = await DiaryDb.create();
    setMeta(restored, SYNC_KEY_ROW, key);
    setMeta(restored, SYNC_EPOCH_ROW, 'aaaaaaaaaaaaaaaa');
    setMeta(restored, 'sync:cid:entry:6f1c1c5e-3d0e-4c8e-9a51-0d5b7b0b2f11', '5');

    expect(carrySyncState(live, restored)).toBe(true);

    const state = readSyncState(restored);
    expect(state?.key).toBe(key);
    expect(state?.epoch).toMatch(/^[0-9a-f]{16}$/);
    expect(state?.epoch).not.toBe(liveEpoch);
    expect(state?.epoch).not.toBe('aaaaaaaaaaaaaaaa');
    // Nothing else of the backup's bookkeeping is touched, and the live diary keeps its own epoch.
    expect(getMeta(restored, 'sync:cid:entry:6f1c1c5e-3d0e-4c8e-9a51-0d5b7b0b2f11')).toBe('5');
    expect(readSyncState(live)).toEqual({ key, epoch: liveEpoch });
  });

  it('a backup from before the first key fetch gets the live key and a fresh epoch', async () => {
    const live = await DiaryDb.create();
    const { key, epoch } = ensureSyncState(live);
    const restored = await DiaryDb.create();
    expect(carrySyncState(live, restored)).toBe(true);
    expect(readSyncState(restored)?.key).toBe(key);
    expect(readSyncState(restored)?.epoch).not.toBe(epoch);
  });

  it('a live diary that is already closed carries nothing and does not throw (the swap fails on its own terms)', async () => {
    const live = await DiaryDb.create();
    ensureSyncState(live);
    live.close();
    const restored = await DiaryDb.create();
    expect(carrySyncState(live, restored)).toBe(false);
    expect(metaRows(restored)).toEqual([]);
  });
});

describe('restoreBackup (the module, a memory vault)', () => {
  it('local mode: the fixture backup restores to exactly the image the desktop encrypted (no sync rows appear)', async () => {
    const m = manifest();
    const bytes = fs.readFileSync(path.join(FIXTURES, m.files.backupAccountPassword));
    const vault = fakeVault(await DiaryDb.create()) as ReturnType<typeof fakeVault> & { db: DiaryDb };
    const info = await restoreBackup(vault, bytes, m.account.password);
    expect(info).toMatchObject({ entries: m.content.entries, habits: m.content.habits });
    const image = exportImage(vault.db);
    expect(image.length).toBe(m.backups.accountPassword.plainLength);
    expect(sha256(image)).toBe(m.backups.accountPassword.plainSha256);
    expect(metaRows(vault.db).filter((r) => r.key.startsWith('sync:'))).toEqual([]);
  }, 60_000);

  it('local mode: a backup made today restores to the very bytes inside it', async () => {
    const source = await DiaryDb.create();
    createEntry(source, sampleEntry({ title: 'Morning walk' }) as Parameters<typeof createEntry>[1]);
    const account = { ...TEST_ACCOUNT, kdf: { ...TEST_ACCOUNT.kdf, N: 1024 } };
    const bytes = await createBackupBytes(fakeVault(source), account, PASSWORD);
    const { plain } = await decryptWithPassword(bytes, PASSWORD);
    const vault = fakeVault(await DiaryDb.create()) as ReturnType<typeof fakeVault> & { db: DiaryDb };
    await restoreBackup(vault, bytes, PASSWORD);
    expect(Buffer.from(exportImage(vault.db)).equals(plain)).toBe(true);
  });

  it('local mode: a live diary holding sync rows (a hosted backup restored earlier) passes nothing on - the next restore is the backup\'s very bytes', async () => {
    const live = await DiaryDb.create();
    ensureSyncState(live);
    const source = await DiaryDb.create();
    createEntry(source, sampleEntry({ title: 'From the PC' }) as Parameters<typeof createEntry>[1]);
    const account = { ...TEST_ACCOUNT, kdf: { ...TEST_ACCOUNT.kdf, N: 1024 } };
    const bytes = await createBackupBytes(fakeVault(source), account, PASSWORD);
    const { plain } = await decryptWithPassword(bytes, PASSWORD);
    const vault = fakeVault(live) as ReturnType<typeof fakeVault> & { db: DiaryDb };
    expect(carriesSyncState(vault)).toBe(false);
    await restoreBackup(vault, bytes, PASSWORD);
    expect(Buffer.from(exportImage(vault.db)).equals(plain)).toBe(true);
    expect(metaRows(vault.db)).toEqual([]);
  });

  it('hosted (a live diary that synced): the restored diary gets the key and a new epoch', async () => {
    const live = await DiaryDb.create();
    const { key, epoch } = ensureSyncState(live);
    const source = await DiaryDb.create();
    createEntry(source, sampleEntry({ title: 'Morning walk' }) as Parameters<typeof createEntry>[1]);
    const account = { ...TEST_ACCOUNT, kdf: { ...TEST_ACCOUNT.kdf, N: 1024 } };
    const bytes = await createBackupBytes(fakeVault(source), account, PASSWORD);
    const vault = fakeVault(live) as ReturnType<typeof fakeVault> & { db: DiaryDb };
    // What the hosted /api/backup mount does for every session's vault (app.ts, syncRestoreCarry).
    enableSyncCarry(vault);
    await restoreBackup(vault, bytes, PASSWORD);
    expect(vault.db).not.toBe(live);
    const state = readSyncState(vault.db);
    expect(state?.key).toBe(key);
    expect(state?.epoch).not.toBe(epoch);
    expect(Number(vault.db.scalar('SELECT COUNT(*) FROM entries'))).toBe(1);
  });
});

describe('POST /api/backup/restore on the local composition', () => {
  it('a hosted backup restores as it is; a later plain backup restores to its very bytes - no sync row is injected', async () => {
    const db = await DiaryDb.create();
    const auth = fakeAuth(db);
    const app = await makeTestApp({ db, auth });
    const liveDb = async () => (await auth.authenticate('test-token'))!.vault.db;
    const account = { ...TEST_ACCOUNT, kdf: { ...TEST_ACCOUNT.kdf, N: 1024 } };

    // A backup downloaded from hosted mode: it carries the key, an epoch and a clientId row.
    const hostedSource = await DiaryDb.create();
    createEntry(hostedSource, sampleEntry({ title: 'Morning walk' }) as Parameters<typeof createEntry>[1]);
    ensureSyncState(hostedSource);
    setMeta(hostedSource, 'sync:cid:entry:6f1c1c5e-3d0e-4c8e-9a51-0d5b7b0b2f11', '1');
    const hostedBytes = await createBackupBytes(fakeVault(hostedSource), account, PASSWORD);
    const hostedPlain = (await decryptWithPassword(hostedBytes, PASSWORD)).plain;
    const first = await app.post('/api/backup/restore', { fileBase64: hostedBytes.toString('base64'), fileName: 'dana.mpd', password: PASSWORD });
    expect(first.status).toBe(200);
    expect(Buffer.from(exportImage(await liveDb())).equals(hostedPlain)).toBe(true);

    // A plain local backup restored next: exactly its bytes, as before WP-H10 (no sync:key, no new sync:epoch).
    const localSource = await DiaryDb.create();
    createEntry(localSource, sampleEntry({ title: 'From the PC' }) as Parameters<typeof createEntry>[1]);
    const localBytes = await createBackupBytes(fakeVault(localSource), account, PASSWORD);
    const localPlain = (await decryptWithPassword(localBytes, PASSWORD)).plain;
    const second = await app.post('/api/backup/restore', { fileBase64: localBytes.toString('base64'), fileName: 'pc.mpd', password: PASSWORD });
    expect(second.status).toBe(200);
    const restored = await liveDb();
    expect(metaRows(restored).filter((r) => r.key.startsWith('sync:'))).toEqual([]);
    expect(Buffer.from(exportImage(restored)).equals(localPlain)).toBe(true);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// The hosted composition
// ---------------------------------------------------------------------------

async function boot(o: { dataDir?: string } = {}) {
  const dataDir = o.dataDir ?? tempDataDir();
  const env = loadHostedEnv({
    DIARY_MODE: 'hosted',
    DIARY_PUBLIC_URL: `https://${HOST}`,
    DIARY_BIND: '127.0.0.1',
    DIARY_LOGIN_PER_MINUTE: '1000',
    DIARY_AUTH_GLOBAL_PER_MINUTE: '5000',
  });
  const config = loadConfig(['--data-dir', dataDir], { DIARY_MODE: 'hosted' });
  const srv = await startHosted(config, env, { port: 0, quiet: true, auth: FAST });
  running.push(srv);
  const agent = supertest(srv.localUrl);
  type Req = ReturnType<typeof agent.get>;
  const common = (r: Req) => r.set('Host', HOST).set('Accept-Language', 'en').set('X-Forwarded-Proto', 'https');
  const anon = () => ({
    get: (url: string) => common(agent.get(url)),
    post: (url: string, body: object = {}) => common(agent.post(url)).send(body),
  });
  const as = (token: string) => ({
    get: (url: string) => common(agent.get(url)).set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object = {}) => common(agent.post(url)).set('Authorization', `Bearer ${token}`).send(body),
    /** A binary download (POST /api/backup/create without a path). */
    download: (url: string, body: object = {}) =>
      common(agent.post(url))
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .send(body),
  });
  return { srv, anon, as, dataDir };
}

type Booted = Awaited<ReturnType<typeof boot>>;

async function register(b: Booted, username: string) {
  const res = await b.anon().post('/api/auth/register', {
    firstName: 'Dana',
    lastName: 'Test',
    username,
    email: `${username}@example.com`,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    rememberMe: true,
    privacyAccepted: true,
    termsAccepted: true,
  });
  expect(res.status).toBe(201);
  const auth = res.body as AuthResponse;
  return { token: auth.token, userId: auth.user.id, api: b.as(auth.token) };
}

function op(account: string, epoch: string, kind: string, extra: Record<string, unknown>) {
  return { v: 1, account, opId: randomUUID(), editedAt: new Date().toISOString(), epoch, kind, ...extra };
}

const entryPayload = (overrides: Record<string, unknown> = {}) => sampleEntry({ title: 'Morning walk', body: 'Walked with Dana by the sea.', people: ['Dana'], ...overrides });

/** The diary as it is on disk right now: the encrypted file, decrypted with the account password. */
async function diskDiary(dataDir: string, userId: string): Promise<DiaryDb> {
  const accounts = JSON.parse(fs.readFileSync(path.join(dataDir, 'accounts.json'), 'utf8')) as { accounts: Array<{ id: string; dbFile: string }> };
  const record = accounts.accounts.find((a) => a.id === userId);
  if (!record) throw new Error('account not on disk');
  const { plain } = await decryptWithPassword(fs.readFileSync(path.join(dataDir, 'users', record.dbFile)), PASSWORD);
  return DiaryDb.fromImage(plain);
}

describe('POST /api/backup/restore on the hosted composition', () => {
  it('keeps the key, writes a new epoch (on disk too); old-epoch edits by id are stale, old-epoch creates apply', async () => {
    const b = await boot();
    const dana = await register(b, 'dana');
    const first = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    const E1 = first.epoch;

    // One entry through sync, then a backup that contains the key, E1 and that entry.
    const created = (await dana.api.post('/api/sync/op', op(dana.userId, E1, 'entry.create', { clientId: randomUUID(), payload: entryPayload() }))).body as SyncOpResult;
    expect(created.outcome).toBe('applied');
    const entry = created.record as Entry;
    const backup = await dana.api.download('/api/backup/create', {});
    expect(backup.status).toBe(200);
    expect(backup.headers['content-type']).toMatch(/octet-stream/);
    const backupBytes = backup.body as Buffer;
    expect(backupBytes.length).toBeGreaterThan(1000);

    // Life goes on: a second entry (it will disappear with the restore).
    const later = (await dana.api.post('/api/sync/op', op(dana.userId, E1, 'entry.create', { clientId: randomUUID(), payload: entryPayload({ title: 'Evening tea' }) }))).body as SyncOpResult;
    expect(later.outcome).toBe('applied');
    expect((await dana.api.get('/api/entries')).body.total).toBe(2);

    // Restore the older backup.
    const restore = await dana.api.post('/api/backup/restore', { fileBase64: backupBytes.toString('base64'), fileName: 'dana.mpd', password: PASSWORD });
    expect(restore.status).toBe(200);
    expect(restore.body as RestoreInfo).toMatchObject({ entries: 1, habits: 0 });
    expect((await dana.api.get('/api/entries')).body.total).toBe(1);

    // Same key, new epoch - in memory and on disk.
    const after = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    expect(after.key).toBe(first.key);
    expect(after.epoch).toMatch(/^[0-9a-f]{16}$/);
    expect(after.epoch).not.toBe(E1);
    const E2 = after.epoch;
    const disk = await diskDiary(b.dataDir, dana.userId);
    expect(getMeta(disk, 'sync:key')).toBe(first.key);
    expect(getMeta(disk, 'sync:epoch')).toBe(E2);
    // The clientId row travelled with the backup: a replay of the first create is still "unchanged".
    disk.close();

    // A queued edit by id from before the restore: stale (nothing written), and the answer carries E2.
    const stale = (await dana.api.post('/api/sync/op', op(dana.userId, E1, 'entry.update', { target: { id: entry.id }, base: entry.updatedAt, payload: entryPayload({ title: 'Edited offline before the restore' }) }))).body as SyncOpResult;
    expect(stale).toMatchObject({ outcome: 'stale', record: null, epoch: E2 });
    expect((await dana.api.get(`/api/entries/${entry.id}`)).body.title).toBe('Morning walk');
    const staleDelete = (await dana.api.post('/api/sync/op', op(dana.userId, E1, 'entry.delete', { target: { id: entry.id } }))).body as SyncOpResult;
    expect(staleDelete.outcome).toBe('stale');
    expect((await dana.api.get('/api/entries')).body.total).toBe(1);

    // A queued create from before the restore still applies (it names no id).
    const oldCreate = (await dana.api.post('/api/sync/op', op(dana.userId, E1, 'entry.create', { clientId: randomUUID(), payload: entryPayload({ title: 'Written offline before the restore' }) }))).body as SyncOpResult;
    expect(oldCreate).toMatchObject({ outcome: 'applied', epoch: E2 });
    expect((await dana.api.get('/api/entries')).body.total).toBe(2);

    // With the new epoch the same edit by id applies.
    const fresh = (await dana.api.post('/api/sync/op', op(dana.userId, E2, 'entry.update', { target: { id: entry.id }, base: entry.updatedAt, payload: entryPayload({ title: 'Edited after the restore' }) }))).body as SyncOpResult;
    expect(fresh.outcome).toBe('applied');
    expect((await dana.api.get(`/api/entries/${entry.id}`)).body.title).toBe('Edited after the restore');

    // Settings ignore the epoch (keys are stable across a restore).
    const settings = (await dana.api.post('/api/sync/op', op(dana.userId, E1, 'settings.patch', { base: { theme: 'system' }, payload: { theme: 'dark' } }))).body as SyncOpResult;
    expect(settings).toMatchObject({ outcome: 'applied', keys: { theme: 'applied' }, epoch: E2 });
  }, 60_000);

  it('restoring a backup made before the first key fetch: the live key is kept and the epoch is new', async () => {
    const b = await boot();
    const dana = await register(b, 'dana');
    // A backup of the diary before any sync row existed.
    const backup = await dana.api.download('/api/backup/create', {});
    expect(backup.status).toBe(200);
    const first = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    const restore = await dana.api.post('/api/backup/restore', { fileBase64: (backup.body as Buffer).toString('base64'), fileName: 'dana.mpd', password: PASSWORD });
    expect(restore.status).toBe(200);
    const after = (await dana.api.get('/api/sync/key')).body as SyncKeyResponse;
    expect(after.key).toBe(first.key);
    expect(after.epoch).not.toBe(first.epoch);
    const disk = await diskDiary(b.dataDir, dana.userId);
    expect(getMeta(disk, 'sync:key')).toBe(first.key);
    expect(getMeta(disk, 'sync:epoch')).toBe(after.epoch);
    disk.close();
  }, 60_000);
});

describe('a restore while the server is rolled back to before WP-H10 (docs/API.md, the rollback rule)', () => {
  // A pre-H10 server swaps the image without `carrySyncState`, so the backup's epoch - the one the
  // devices hold - survives, and a queued edit by id can meet a record that reused the id. API.md
  // therefore forbids restores while rolled back and gives the remedy if one happened anyway: right
  // after the redeploy the account makes a backup and restores it, which writes a new epoch without
  // changing the content.
  const T = (minute: number) => new Date(Date.UTC(2026, 9, 20, 12, minute, 0)).toISOString();
  const NOW = '2026-10-23T12:00:00.000Z';
  const account = { ...TEST_ACCOUNT, kdf: { ...TEST_ACCOUNT.kdf, N: 1024 } };

  it('the hazard: the queued edit hits the record that reused the id; the remedy makes it stale and leaves that record alone', async () => {
    const live = await DiaryDb.create();
    const { epoch: E1 } = ensureSyncState(live);
    const vault = fakeVault(live) as ReturnType<typeof fakeVault> & { db: DiaryDb };
    enableSyncCarry(vault);
    createEntry(live, entryPayload({ title: 'Morning walk' }) as Parameters<typeof createEntry>[1], { at: T(1) });
    const backupImage = exportImage(live); // carries E1
    const evening = createEntry(live, entryPayload({ title: 'Evening note' }) as Parameters<typeof createEntry>[1], { at: T(2) });

    // The rolled-back server restores the backup: no carry, the epoch stays E1, and id 2 is reused.
    await vault.replaceDatabase(await DiaryDb.fromImage(backupImage));
    expect(readSyncState(vault.db)?.epoch).toBe(E1);
    const shopping = createEntry(vault.db, entryPayload({ title: 'Shopping list' }) as Parameters<typeof createEntry>[1], { at: T(3) });
    expect(shopping.id).toBe(evening.id);

    // Device A edited "Evening note" offline after that write and queued it with the old epoch.
    const queued = validateSyncOp({
      v: 1,
      account: TEST_ACCOUNT.id,
      opId: randomUUID(),
      editedAt: T(4),
      epoch: E1,
      kind: 'entry.update',
      target: { id: evening.id },
      base: evening.updatedAt,
      payload: entryPayload({ title: 'Evening note (edited)' }),
    });
    // Without the remedy (on a copy): the unrelated record would be overwritten.
    const probe = await DiaryDb.fromImage(exportImage(vault.db));
    expect(probe.transaction(() => applySyncOp(probe, queued, NOW)).outcome).toBe('conflict-won');
    probe.close();

    // The remedy, on the WP-H10 server: a backup of the diary as it is, restored right away.
    const bytes = await createBackupBytes(vault, account, PASSWORD);
    await restoreBackup(vault, bytes, PASSWORD);
    const E2 = readSyncState(vault.db)?.epoch;
    expect(E2).toMatch(/^[0-9a-f]{16}$/);
    expect(E2).not.toBe(E1);
    expect(vault.db.all<{ id: number; title: string }>('SELECT id, title FROM entries ORDER BY id').map((r) => [Number(r.id), String(r.title)])).toEqual([
      [1, 'Morning walk'],
      [shopping.id, 'Shopping list'],
    ]);
    const db = vault.db;
    expect(db.transaction(() => applySyncOp(db, queued, NOW))).toEqual({ outcome: 'stale', record: null });
    expect(String(db.scalar('SELECT title FROM entries WHERE id = ?', [shopping.id]))).toBe('Shopping list');
  });
});
