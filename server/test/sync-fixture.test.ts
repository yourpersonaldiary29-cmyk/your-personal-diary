/**
 * WP-H10a (docs/android-tasks/OFFLINE-DESIGN.md §8 "sync-fixture"): the offline sync routes on a
 * REAL-SHAPED diary - the desktop data directory of mobile/test/fixtures (account "fixture_noa",
 * written by the real server modules; fictional content), copied to a temp dir and served by the
 * hosted composition with `DIARY_DEVICE_KEY` = the fixture's device key and the fixture's
 * remember-me token:
 *   - sync writes of every kind, a restart, everything persisted;
 *   - the hash of the untouched entries is unchanged;
 *   - the `.mpd` opens with the LOCAL composition afterwards: `currentVersion === 1`,
 *     `PRAGMA integrity_check` ok, `sqlite_master` identical before and after (zero DDL), and the
 *     only bookkeeping rows added are `meta` rows with the `sync:` prefix;
 *   - a backup downloaded from hosted mode restores into a local-mode server.
 * Nothing here reads a real data directory: the fixture is the only input.
 */
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SyncKeyResponse, SyncOpResult } from '@shared/sync';
import type { AppSettings, AuthResponse, Entry, EntryInput, Habit, HabitInput, HabitLog, HabitWithProgress, RestoreInfo, ServerInfo, UserProfile } from '@shared/types';
import { loadConfig, loadHostedEnv } from '../src/config';
import { DiaryDb } from '../src/db/database';
import { listEntriesFull } from '../src/db/entries-repo';
import { listHabits } from '../src/db/habits-repo';
import { currentVersion, SCHEMA_VERSION } from '../src/db/schema';
import { getSettings } from '../src/db/settings-repo';
import { startHosted, type RunningHosted } from '../src/hosted';
import { createAuthService, type DiaryAuthService } from '../src/security/auth-service';
import { decryptWithPassword } from '../src/security/container';
import { cleanupTempDirs, makeTestApp, tempDataDir } from './helpers';

const HOST = 'diary.example';
const FIXTURES = path.join(process.cwd(), '..', 'mobile', 'test', 'fixtures');
const LOG_DATE = '2026-10-20';

interface FixtureManifest {
  files: { accounts: string; sessions: string; deviceKey: string; diary: string };
  account: { id: string; username: string; password: string; dbFile: string };
  deviceKeyHex: string;
  session: { token: string };
  diary: { plainSha256: string };
  content: { entries: number; habits: number; habitLogs: number; entriesSha256: string };
}

interface MasterRow {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
}

interface Snapshot {
  entries: Entry[];
  habits: Habit[];
  settings: AppSettings;
  master: MasterRow[];
  metaKeys: string[];
  settingsKeys: string[];
  schemaRows: Array<{ version: number }>;
  logCount: number;
  /** One existing log (the newest): deleted through sync below. */
  log: { habitId: number; date: string; value: number; note: string };
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const entriesHash = (entries: Entry[], except: number[]) =>
  sha256(Buffer.from(JSON.stringify(entries.filter((e) => !except.includes(e.id))), 'utf8'));

function snapshot(db: DiaryDb): Snapshot {
  const log = db.get<{ habit_id: number; date: string; value: number; note: string }>('SELECT habit_id, date, value, note FROM habit_logs ORDER BY date DESC, habit_id DESC LIMIT 1');
  if (!log) throw new Error('the fixture has no habit log');
  return {
    entries: listEntriesFull(db, null, null),
    habits: listHabits(db, true),
    settings: getSettings(db),
    master: db.all<MasterRow>('SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name'),
    metaKeys: db.all<{ key: string }>('SELECT key FROM meta ORDER BY key').map((r) => String(r.key)),
    settingsKeys: db.all<{ key: string }>('SELECT key FROM settings ORDER BY key').map((r) => String(r.key)),
    schemaRows: db.all<{ version: number }>('SELECT version FROM schema_version ORDER BY version').map((r) => ({ version: Number(r.version) })),
    logCount: Number(db.scalar<number>('SELECT COUNT(*) FROM habit_logs')),
    log: { habitId: Number(log.habit_id), date: String(log.date), value: Number(log.value), note: String(log.note ?? '') },
  };
}

function inputOf(e: Entry): EntryInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...input } = e;
  return input;
}

function habitInputOf(h: Habit): HabitInput {
  return { name: h.name, description: h.description, target: h.target, unit: h.unit, frequency: h.frequency, reminderTime: h.reminderTime, reminderEnabled: h.reminderEnabled };
}

const manifest: FixtureManifest = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'manifest.json'), 'utf8')) as FixtureManifest;
const PASSWORD = manifest.account.password;
const ACCOUNT = manifest.account.id;
const DEVICE_KEY_B64 = Buffer.from(manifest.deviceKeyHex, 'hex').toString('base64');

/** The fixture data directory, copied: `.mpd.fixture` becomes `users/<id>.mpd`. */
function copyFixtureDataDir(): string {
  const dir = tempDataDir();
  fs.mkdirSync(path.join(dir, 'users'), { recursive: true });
  for (const name of ['accounts', 'sessions', 'deviceKey'] as const) {
    const rel = manifest.files[name];
    fs.copyFileSync(path.join(FIXTURES, rel), path.join(dir, path.basename(rel)));
  }
  fs.copyFileSync(path.join(FIXTURES, manifest.files.diary), path.join(dir, 'users', manifest.account.dbFile));
  return dir;
}

async function decryptedDiary(file: string): Promise<DiaryDb> {
  const { plain } = await decryptWithPassword(fs.readFileSync(file), PASSWORD);
  return DiaryDb.fromImage(plain);
}

// ---------------------------------------------------------------------------
// Hosted composition on the fixture
// ---------------------------------------------------------------------------

const running: RunningHosted[] = [];

async function bootHosted(dataDir: string) {
  const env = loadHostedEnv({
    DIARY_MODE: 'hosted',
    DIARY_PUBLIC_URL: `https://${HOST}`,
    DIARY_BIND: '127.0.0.1',
    DIARY_DEVICE_KEY: DEVICE_KEY_B64,
    DIARY_LOGIN_PER_MINUTE: '1000',
    DIARY_AUTH_GLOBAL_PER_MINUTE: '5000',
  });
  const config = loadConfig(['--data-dir', dataDir], { DIARY_MODE: 'hosted' });
  const srv = await startHosted(config, env, { port: 0, quiet: true });
  running.push(srv);
  const agent = supertest(srv.localUrl);
  type Req = ReturnType<typeof agent.get>;
  const common = (r: Req) => r.set('Host', HOST).set('Accept-Language', 'en').set('X-Forwarded-Proto', 'https');
  const as = (token: string) => ({
    get: (url: string) => common(agent.get(url)).set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object = {}) => common(agent.post(url)).set('Authorization', `Bearer ${token}`).send(body),
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
  const anon = () => ({
    get: (url: string) => common(agent.get(url)),
    post: (url: string, body: object = {}) => common(agent.post(url)).send(body),
  });
  return { srv, as, anon };
}

type Hosted = Awaited<ReturnType<typeof bootHosted>>;
type Api = ReturnType<Hosted['as']>;

async function stopHosted(h: Hosted): Promise<void> {
  running.splice(running.indexOf(h.srv), 1);
  await h.srv.stop();
}

/**
 * The fixture's remember-me session (its token unwraps the diary key with the device key). The
 * fixture file carries an expiry date; should the fixture ever be older than its session, the
 * password opens the account instead - the sync behaviour under test is the same.
 */
async function authenticate(h: Hosted): Promise<{ token: string; api: Api }> {
  let token = manifest.session.token;
  let me = await h.as(token).get('/api/auth/me');
  if (me.status === 401) {
    const login = await h.anon().post('/api/auth/login', { username: manifest.account.username, password: PASSWORD, rememberMe: true, deviceName: 'Fixture test' });
    expect(login.status).toBe(200);
    token = (login.body as AuthResponse).token;
    me = await h.as(token).get('/api/auth/me');
  }
  expect(me.status).toBe(200);
  expect((me.body as { user: UserProfile }).user.id).toBe(ACCOUNT);
  return { token, api: h.as(token) };
}

function op(epoch: string, kind: string, extra: Record<string, unknown>) {
  return { v: 1, account: ACCOUNT, opId: randomUUID(), editedAt: new Date().toISOString(), epoch, kind, ...extra };
}

async function send(api: Api, body: Record<string, unknown>): Promise<SyncOpResult> {
  const res = await api.post('/api/sync/op', body);
  expect({ kind: body.kind, status: res.status, body: res.status === 200 ? undefined : res.body }).toEqual({ kind: body.kind, status: 200, body: undefined });
  return res.body as SyncOpResult;
}

// ---------------------------------------------------------------------------
// The scenario (the tests run in order and share this state)
// ---------------------------------------------------------------------------

let dataDir: string;
let before: Snapshot;
let hosted: Hosted;
let api: Api;
let token: string;
let key: SyncKeyResponse;
const C1 = randomUUID();
const C2 = randomUUID();
const written = {
  createdEntryAt: '',
  newEntryId: 0,
  updatedEntryId: 0,
  deletedEntryId: 0,
  newHabitId: 0,
  updatedHabitId: 0,
  archivedHabitId: 0,
  archivedTo: false,
  theme: '' as AppSettings['theme'],
};
let hostedBackup: Buffer;

beforeAll(async () => {
  dataDir = copyFixtureDataDir();
  const diary = await decryptedDiary(path.join(dataDir, 'users', manifest.account.dbFile));
  try {
    before = snapshot(diary);
  } finally {
    diary.close();
  }
  expect(before.entries).toHaveLength(manifest.content.entries);
  expect(before.habits).toHaveLength(manifest.content.habits);
  expect(before.logCount).toBe(manifest.content.habitLogs);
  expect(entriesHash(before.entries, [])).toBe(manifest.content.entriesSha256);
}, 60_000);

afterAll(async () => {
  for (const r of running.splice(0)) await r.stop();
  cleanupTempDirs();
});

describe('the hosted composition on the desktop fixture', () => {
  it('boots with the fixture device key, accepts the remember-me token and hands out a key', async () => {
    hosted = await bootHosted(dataDir);
    ({ api, token } = await authenticate(hosted));
    // The ordinary routes see the fixture content.
    expect((await api.get('/api/entries')).body.total).toBe(manifest.content.entries);
    const info = (await hosted.anon().get('/api/server/info')).body as ServerInfo;
    expect(info).toMatchObject({ mode: 'hosted', offlineSync: 1 });
    const res = await api.get('/api/sync/key');
    expect(res.status).toBe(200);
    key = res.body as SyncKeyResponse;
    expect(Buffer.from(key.key, 'base64')).toHaveLength(32);
    expect(key.epoch).toMatch(/^[0-9a-f]{16}$/);
  }, 60_000);

  it('applies one sync write of every kind', async () => {
    const { epoch } = key;
    const last = before.entries.reduce((a, b) => (a.id > b.id ? a : b));
    const first = before.entries.reduce((a, b) => (a.id < b.id ? a : b));
    const [h0, h1] = before.habits;

    // entry.create
    const create = op(epoch, 'entry.create', { clientId: C1, payload: { ...inputOf(last), title: 'בוקר טוב 🌅', body: 'רשומה שנכתבה בלי חיבור. 100% fictional.', date: LOG_DATE, time: '07:45' } });
    const created = await send(api, create);
    expect(created.outcome).toBe('applied');
    written.newEntryId = (created.record as Entry).id;
    written.createdEntryAt = create.editedAt as string;
    expect((created.record as Entry).createdAt).toBe(written.createdEntryAt);
    expect(written.newEntryId).toBeGreaterThan(last.id);

    // entry.update (the newest fixture entry, from the version the device saw)
    const updated = await send(api, op(epoch, 'entry.update', { target: { id: last.id }, base: last.updatedAt, payload: { ...inputOf(last), title: 'יום שקט (נערך במכשיר)' } }));
    expect(updated.outcome).toBe('applied');
    expect((updated.record as Entry).title).toBe('יום שקט (נערך במכשיר)');
    written.updatedEntryId = last.id;

    // entry.delete (the oldest fixture entry)
    const deleted = await send(api, op(epoch, 'entry.delete', { target: { id: first.id }, base: first.updatedAt }));
    expect(deleted).toMatchObject({ outcome: 'applied', record: null });
    written.deletedEntryId = first.id;

    // habit.create
    const habitCreated = await send(api, op(epoch, 'habit.create', { clientId: C2, payload: { name: 'מים', description: '', target: 8, unit: 'כוסות', frequency: 'daily', reminderTime: null, reminderEnabled: false } }));
    expect(habitCreated.outcome).toBe('applied');
    written.newHabitId = (habitCreated.record as Habit).id;

    // habit.update (field-scoped base = the 7 fields the device saw)
    const habitUpdated = await send(api, op(epoch, 'habit.update', { target: { id: h0.id }, base: habitInputOf(h0), payload: { ...habitInputOf(h0), name: `${h0.name} (עודכן)` } }));
    expect(habitUpdated.outcome).toBe('applied');
    written.updatedHabitId = h0.id;

    // habit.archive (flip whatever the fixture has)
    written.archivedTo = !h1.isArchived;
    const archived = await send(api, op(epoch, 'habit.archive', { target: { id: h1.id }, base: { archived: h1.isArchived }, payload: { archived: written.archivedTo } }));
    expect(archived.outcome).toBe('applied');
    expect((archived.record as Habit).isArchived).toBe(written.archivedTo);
    written.archivedHabitId = h1.id;

    // log.set on the habit created offline (by clientId), from "no log was there"
    const logSet = await send(api, op(epoch, 'log.set', { habit: { clientId: C2 }, date: LOG_DATE, base: null, payload: { value: 2, note: 'תה' } }));
    expect(logSet.outcome).toBe('applied');
    expect(logSet.record).toMatchObject({ habitId: written.newHabitId, date: LOG_DATE, value: 2, note: 'תה' });

    // log.delete of an existing fixture log, from the version the device saw
    const logDeleted = await send(api, op(epoch, 'log.delete', { habit: { id: before.log.habitId }, date: before.log.date, base: { value: before.log.value, note: before.log.note } }));
    expect(logDeleted).toMatchObject({ outcome: 'applied', record: null });

    // settings.patch
    written.theme = before.settings.theme === 'dark' ? 'light' : 'dark';
    const settings = await send(api, op(epoch, 'settings.patch', { base: { theme: before.settings.theme }, payload: { theme: written.theme } }));
    expect(settings).toMatchObject({ outcome: 'applied', keys: { theme: 'applied' } });
    expect((settings.record as AppSettings).theme).toBe(written.theme);
  }, 60_000);

  it('after a restart everything is there, through the ordinary routes and with the same key', async () => {
    await stopHosted(hosted);
    hosted = await bootHosted(dataDir);
    ({ api, token } = await authenticate(hosted));

    expect((await api.get('/api/entries')).body.total).toBe(manifest.content.entries); // +1 created, -1 deleted
    const created = await api.get(`/api/entries/${written.newEntryId}`);
    expect(created.status).toBe(200);
    expect(created.body as Entry).toMatchObject({ title: 'בוקר טוב 🌅', date: LOG_DATE, createdAt: written.createdEntryAt });
    expect((await api.get(`/api/entries/${written.updatedEntryId}`)).body.title).toBe('יום שקט (נערך במכשיר)');
    expect((await api.get(`/api/entries/${written.deletedEntryId}`)).status).toBe(404);

    const habits = (await api.get('/api/habits?includeArchived=true')).body as Habit[];
    expect(habits).toHaveLength(manifest.content.habits + 1);
    expect(habits.find((h) => h.id === written.newHabitId)).toMatchObject({ name: 'מים', target: 8 });
    expect(habits.find((h) => h.id === written.updatedHabitId)?.name).toMatch(/\(עודכן\)$/);
    expect(habits.find((h) => h.id === written.archivedHabitId)?.isArchived).toBe(written.archivedTo);

    const progress = (await api.get(`/api/habits/progress?date=${LOG_DATE}`)).body as HabitWithProgress[];
    const newHabit = progress.find((p) => p.habit.id === written.newHabitId);
    expect(newHabit?.today as HabitLog).toMatchObject({ value: 2, note: 'תה' });
    const deletedLogDay = (await api.get(`/api/habits/progress?date=${before.log.date}`)).body as HabitWithProgress[];
    const deletedLogHabit = deletedLogDay.find((p) => p.habit.id === before.log.habitId);
    if (deletedLogHabit) expect(deletedLogHabit.today).toBeNull();

    expect(((await api.get('/api/settings')).body as AppSettings).theme).toBe(written.theme);

    const again = (await api.get('/api/sync/key')).body as SyncKeyResponse;
    expect(again).toMatchObject({ key: key.key, epoch: key.epoch });

    // A replay of the create after the restart is still "unchanged": the clientId row persisted.
    const replay = await send(api, op(key.epoch, 'entry.create', { clientId: C1, payload: { ...inputOf(before.entries[0]), title: 'בוקר טוב 🌅' } }));
    expect(replay.outcome).toBe('unchanged');
    expect((replay.record as Entry).id).toBe(written.newEntryId);
    expect((await api.get('/api/entries')).body.total).toBe(manifest.content.entries);
  }, 60_000);

  it('a backup downloaded from hosted mode restores into a local-mode server', async () => {
    const download = await api.download('/api/backup/create', {});
    expect(download.status).toBe(200);
    hostedBackup = download.body as Buffer;
    expect(hostedBackup.subarray(0, 7).toString('latin1')).toBe('MPDIARY');

    const local = await makeTestApp();
    const restore = await local.post('/api/backup/restore', { fileBase64: hostedBackup.toString('base64'), fileName: 'noa.mpd', password: PASSWORD });
    expect(restore.status).toBe(200);
    expect(restore.body as RestoreInfo).toMatchObject({ entries: manifest.content.entries, habits: manifest.content.habits + 1 });
    expect((await local.get('/api/entries')).body.total).toBe(manifest.content.entries);
    expect((await local.get(`/api/entries/${written.newEntryId}`)).body.title).toBe('בוקר טוב 🌅');
    expect(((await local.get('/api/settings')).body as AppSettings).theme).toBe(written.theme);
    // The sync rows travel inside the backup and are inert on a local server: /api/sync does not exist there.
    expect((await local.get('/api/sync/key')).status).toBe(404);
    expect('offlineSync' in ((await local.anon().get('/api/server/info')).body as ServerInfo)).toBe(false);
    expect(token).toBeTruthy();
  }, 60_000);

  it('the .mpd on disk: schema version 1, integrity ok, sqlite_master unchanged, new bookkeeping rows only under meta sync:*', async () => {
    await stopHosted(hosted);
    const diary = await decryptedDiary(path.join(dataDir, 'users', manifest.account.dbFile));
    try {
      expect(SCHEMA_VERSION).toBe(1);
      expect(currentVersion(diary)).toBe(1);
      expect(diary.scalar<string>('PRAGMA integrity_check')).toBe('ok');
      const after = snapshot(diary);
      expect(after.master).toEqual(before.master);
      expect(after.schemaRows).toEqual(before.schemaRows);

      const newMeta = after.metaKeys.filter((k) => !before.metaKeys.includes(k));
      expect(newMeta.every((k) => k.startsWith('sync:'))).toBe(true);
      expect(newMeta).toEqual(
        expect.arrayContaining([
          'sync:key',
          'sync:epoch',
          `sync:cid:entry:${C1}`,
          `sync:cid:habit:${C2}`,
          `sync:t:habit:${written.newHabitId}`,
          `sync:t:habit:${written.updatedHabitId}`,
          `sync:t:habit:${written.archivedHabitId}`,
          `sync:t:log:${written.newHabitId}:${LOG_DATE}`,
          `sync:t:log:${before.log.habitId}:${before.log.date}`,
          'sync:t:set:theme',
        ]),
      );
      expect(before.metaKeys.every((k) => after.metaKeys.includes(k))).toBe(true);
      // The settings table gained at most the patched key; nothing else of the fixture's bookkeeping moved.
      expect(after.settingsKeys.filter((k) => !before.settingsKeys.includes(k)).every((k) => k === 'theme')).toBe(true);

      // Content: the untouched entries hash to the same bytes as before; the changes are exactly the ones made.
      expect(after.entries).toHaveLength(manifest.content.entries);
      const touched = [written.newEntryId, written.updatedEntryId, written.deletedEntryId];
      expect(entriesHash(after.entries, touched)).toBe(entriesHash(before.entries, touched));
      expect(after.entries.find((e) => e.id === written.deletedEntryId)).toBeUndefined();
      expect(after.entries.find((e) => e.id === written.updatedEntryId)?.title).toBe('יום שקט (נערך במכשיר)');
      expect(after.entries.find((e) => e.id === written.newEntryId)).toMatchObject({ title: 'בוקר טוב 🌅', createdAt: written.createdEntryAt, updatedAt: written.createdEntryAt });
      expect(after.habits).toHaveLength(manifest.content.habits + 1);
      expect(after.logCount).toBe(manifest.content.habitLogs); // +1 set, -1 deleted
      expect(diary.get('SELECT 1 AS x FROM habit_logs WHERE habit_id = ? AND date = ?', [before.log.habitId, before.log.date])).toBeUndefined();
      expect(after.settings.theme).toBe(written.theme);
    } finally {
      diary.close();
    }
  }, 60_000);

  it('the same data directory opens with the LOCAL composition: the password signs in, the diary reads, /api/sync is 404', async () => {
    const config = loadConfig(['--data-dir', dataDir], {});
    expect(config.mode).toBe('local');
    const auth = (await createAuthService(config)) as DiaryAuthService;
    try {
      const login = await auth.login({ username: manifest.account.username, password: PASSWORD, rememberMe: false, deviceName: 'Fixture test' });
      const ctx = await auth.authenticate(login.token);
      expect(ctx?.account.id).toBe(ACCOUNT);
      expect(currentVersion(ctx!.db)).toBe(1);
      expect(Number(ctx!.db.scalar('SELECT COUNT(*) FROM entries'))).toBe(manifest.content.entries);
      expect(Number(ctx!.db.scalar('SELECT COUNT(*) FROM habits'))).toBe(manifest.content.habits + 1);

      const app = await makeTestApp({ auth, config });
      const bearer = (url: string) => app.anon().get(url).set('Authorization', `Bearer ${login.token}`);
      expect((await bearer('/api/entries')).body.total).toBe(manifest.content.entries);
      expect((await bearer(`/api/entries/${written.newEntryId}`)).body.title).toBe('בוקר טוב 🌅');
      expect((await bearer('/api/sync/key')).status).toBe(404);
      const info = (await app.anon().get('/api/server/info')).body as ServerInfo;
      expect('offlineSync' in info).toBe(false);
      expect('mode' in info).toBe(false);
    } finally {
      await auth.shutdown();
    }
  }, 60_000);
});
