/**
 * "Delete account" (Settings -> Delete account, POST /api/auth/delete-account): after a deletion
 * NOTHING of the account is left - not in accounts.json (record incl. the recovery key), not in
 * users/ (<id>.mpd, .mpd.prev, .mpd.tmp), not in sessions.json (every device, also entries that were
 * skipped at load), not in resets.json (also expired ones still on disk), not in the sign-in lockout
 * or the reset-code counters, not in memory (the vault) - while every other account stays exactly as
 * it was. The username and the e-mail address are free again. A wrong or missing password deletes
 * nothing; the password checks are rate-limited like every /api/auth password check; and a sign-in
 * or a remember-me request that opens the diary while the deletion runs never brings it back.
 * When the disk refuses a registry write half-way, nothing is deleted (the account can sign in and
 * delete again); diary files that cannot be removed after the record is gone are removed at the next
 * deletion or start.
 * Tests that look at users/ first make sure no debounced save of an open diary is pending or in
 * flight (`savedOnce`, `runUnsaved`; the last describe pins down why).
 * All accounts and passwords are made up; everything runs in temporary directories.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { AccountsStore } from '../src/security/accounts';
import { createAuthService, type DiaryAuthService } from '../src/security/auth-service';
import { PasswordResetService } from '../src/security/password-reset';
import type { AuthContext } from '../src/security/session-types';
import { PERSIST_DEBOUNCE_MS } from '../src/security/vault';
import { cleanupTempDirs, makeTestApp, tempDataDir, testConfig, type TestApp } from './helpers';

/**
 * `openVault` can be held right after it has read and decrypted the diary (before the vault is
 * registered), so a test can run a whole deletion in between. Pass-through while no gate is set.
 */
const gate = vi.hoisted(() => ({
  hold: null as Promise<void> | null,
  entered: null as (() => void) | null,
}));
vi.mock('../src/security/vault', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/security/vault')>();
  return {
    ...actual,
    openVault: async (...args: Parameters<typeof actual.openVault>) => {
      const vault = await actual.openVault(...args);
      const hold = gate.hold;
      if (hold) {
        gate.entered?.();
        await hold;
      }
      return vault;
    },
  };
});

afterAll(cleanupTempDirs);

const FAST = { N: 2048, r: 8, p: 1 };
const PASSWORD = 'Passw0rd!';
const DANA = {
  firstName: 'Dana',
  lastName: 'Test',
  username: 'dana',
  email: 'dana@example.com',
  password: PASSWORD,
  confirmPassword: PASSWORD,
};
const RON = { ...DANA, firstName: 'Ron', username: 'ron', email: 'ron@example.com' };
const INSERT_ENTRY = `INSERT INTO entries(date, time, title, body, created_at, updated_at) VALUES ('2026-09-08', '09:00', 'x', '', 'x', 'x')`;

const services: DiaryAuthService[] = [];
afterEach(async () => {
  gate.hold = null;
  gate.entered = null;
  for (const s of services.splice(0)) await s.shutdown();
});

async function setup(dataDir = tempDataDir(), clock?: { now: Date }) {
  const config = testConfig(dataDir);
  const auth = await createAuthService(config, { kdf: FAST, ...(clock ? { now: () => clock.now } : {}) });
  services.push(auth);
  const app = await makeTestApp({ auth, config });
  return { app, auth, config, dataDir };
}

function as(app: TestApp, token: string) {
  return {
    get: (url: string) => app.anon().get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body?: object) => app.anon().post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
  };
}

async function register(app: TestApp, body: typeof DANA, extra: Record<string, unknown> = {}) {
  const res = await app.anon().post('/api/auth/register').send({ ...body, ...extra });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, id: res.body.user.id as string };
}

async function login(app: TestApp, username: string, extra: Record<string, unknown> = {}) {
  const res = await app.anon().post('/api/auth/login').send({ username, password: PASSWORD, ...extra });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

/** A complete sign-in input (DiaryAuthService.login). */
const signIn = (username: string, password = PASSWORD) => ({ username, password, rememberMe: false, deviceName: 'Test' });

/**
 * The session's context after its diary was saved once by hand - nothing is pending afterwards.
 *
 * Why every test that looks at users/ (a diary file, a listing, a stray ".tmp") saves by hand
 * first: a registration leaves the new diary dirty (its language setting), so its debounced save
 * follows PERSIST_DEBOUNCE_MS later - at a moment that depends on the machine's load - and a save
 * is not atomic from the directory's point of view: `<id>.mpd.tmp` appears, then `<id>.mpd` is
 * ABSENT between the two renames (vault.ts writeContainerAtomic: current -> ".prev", then ".tmp" ->
 * current). A check that meets such a save in flight sees the diary "deleted", or a ".tmp" too
 * many, by chance (the flakes of 2026-10-27/28; "a save in flight" below shows the window).
 * `persist()` cancels the pending save and waits for one in progress, so after it the files stay
 * as they are until the next write - and a write that must stay unsaved goes through `runUnsaved`.
 */
async function savedOnce(auth: DiaryAuthService, token: string): Promise<AuthContext> {
  const ctx = (await auth.authenticate(token))!;
  await ctx.vault.persist();
  return ctx;
}

/**
 * A write to the open diary that stays unsaved: the vault learns of writes through `db.onWrite`
 * (which schedules the debounced save), and that hook is held off for this one statement. The
 * diary is dirty - in memory only - until the test, or the deletion under test, saves or discards
 * it; no save runs behind the test's back meanwhile.
 */
function runUnsaved(ctx: AuthContext, sql: string): void {
  const scheduleSave = ctx.db.onWrite;
  ctx.db.onWrite = null;
  try {
    ctx.db.run(sql);
  } finally {
    ctx.db.onWrite = scheduleSave;
  }
}

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
const usersDir = (dataDir: string) => path.join(dataDir, 'users');
const dbFileOf = (dataDir: string, id: string) => path.join(usersDir(dataDir), `${id}.mpd`);

describe('delete account: nothing of the account remains', () => {
  it('wipes the diary (.mpd, .prev, .tmp), every session, the resets, the lockout counters and the record - and only those', async () => {
    const clock = { now: new Date() };
    const { app, auth, dataDir } = await setup(tempDataDir(), clock);
    const dana = await register(app, DANA, { rememberMe: true, deviceName: 'Desktop' });
    const ron = await register(app, RON, { rememberMe: true, deviceName: 'Laptop' });
    // Dana is also signed in on a phone (remembered) and in a browser tab (not remembered).
    const phone = await login(app, 'dana', { rememberMe: true, deviceName: 'Phone' });
    const tab = await login(app, 'dana@example.com', { rememberMe: false, deviceName: 'Browser' });

    // Two saves -> users/<id>.mpd and users/<id>.mpd.prev; a leftover .tmp as after a crash mid-write.
    const ctx = (await auth.authenticate(dana.token))!;
    ctx.db.run(INSERT_ENTRY);
    await ctx.vault.persist();
    ctx.db.run(INSERT_ENTRY);
    await ctx.vault.persist();
    const danaDb = dbFileOf(dataDir, dana.id);
    fs.writeFileSync(`${danaDb}.tmp`, 'half-written');
    for (const f of [danaDb, `${danaDb}.prev`, `${danaDb}.tmp`]) expect(fs.existsSync(f), f).toBe(true);
    const ronCtx = (await auth.authenticate(ron.token))!;
    ronCtx.db.run(INSERT_ENTRY);
    await ronCtx.vault.persist();

    // Pending resets: one that has expired since (pruned from memory, still in resets.json) and a live one.
    auth.resets.create(dana.id);
    clock.now = new Date(clock.now.getTime() + auth.resets.ttlMs + 60_000);
    expect(auth.resets.liveCount(dana.id)).toBe(0);
    expect(read(path.join(dataDir, 'resets.json'))).toContain(dana.id);
    auth.resets.create(dana.id);
    auth.resets.create(ron.id);

    // Failed sign-ins on the computer and over the network; wrong reset codes.
    for (const fromNetwork of [false, true]) {
      await expect(auth.login(signIn('dana', 'Wrong1pass'), { fromNetwork })).rejects.toMatchObject({ status: 401 });
    }
    await expect(auth.login(signIn('ron', 'Wrong1pass'))).rejects.toMatchObject({ status: 401 });
    const mailer = { ready: () => true, send: async () => {} };
    const reset = new PasswordResetService(auth, mailer, { log: () => {}, backgroundDelayMs: () => 0 });
    await expect(reset.resetWithCode('dana@example.com', '000000', 'Another1pass', 'en')).rejects.toMatchObject({ status: 400 });
    await expect(reset.resetWithCode('ron@example.com', '000000', 'Another1pass', 'en')).rejects.toMatchObject({ status: 400 });
    expect(reset.codeFailuresOf(dana.id)).toBe(1);

    const accountsFile = path.join(dataDir, 'accounts.json');
    const ronRecordBefore = JSON.parse(read(accountsFile)).accounts.find((a: { id: string }) => a.id === ron.id);
    expect(ronRecordBefore.recoveryWrappedKey).toBeTruthy();
    expect(JSON.parse(read(accountsFile)).accounts.find((a: { id: string }) => a.id === dana.id).recoveryWrappedKey).toBeTruthy();

    // No password / a wrong password: nothing is deleted, the session stays.
    const missing = await as(app, dana.token).post('/api/auth/delete-account', {});
    expect(missing.status).toBe(400);
    expect(missing.body).toMatchObject({ code: 'VALIDATION', field: 'password' });
    const wrong = await as(app, dana.token).post('/api/auth/delete-account', { password: 'Nope12345' });
    expect(wrong.status).toBe(400);
    expect(wrong.body).toMatchObject({ code: 'WRONG_PASSWORD', field: 'password' });
    for (const f of [danaDb, `${danaDb}.prev`]) expect(fs.existsSync(f), f).toBe(true);
    expect(auth.accounts.findById(dana.id)).not.toBeNull();
    expect(auth.listSessions(dana.id)).toHaveLength(3);
    expect(auth.resets.liveCount(dana.id)).toBe(1);
    expect((await as(app, dana.token).get('/api/auth/me')).status).toBe(200);

    // The deletion itself.
    const gone = await as(app, dana.token).post('/api/auth/delete-account', { password: PASSWORD });
    expect(gone.status).toBe(204);

    // Diary files: only Ron's are left.
    const left = fs.readdirSync(usersDir(dataDir));
    expect(left.filter((f) => f.includes(dana.id))).toEqual([]);
    expect(left).toContain(`${ron.id}.mpd`);
    // Registry: no record, name or address of Dana; Ron's record (recovery key included) unchanged.
    const accounts = read(accountsFile);
    for (const trace of [dana.id, '"dana"', 'dana@example.com']) expect(accounts).not.toContain(trace);
    expect(JSON.parse(accounts).accounts).toEqual([ronRecordBefore]);
    // Sessions: none of Dana's devices, on disk or in memory; Ron stays signed in.
    const sessionsFile = read(path.join(dataDir, 'sessions.json'));
    expect(sessionsFile).not.toContain(dana.id);
    expect(sessionsFile).toContain(ron.id);
    expect(auth.listSessions(dana.id)).toEqual([]);
    for (const token of [dana.token, phone, tab]) expect((await as(app, token).get('/api/auth/me')).status).toBe(401);
    // Resets: none of Dana's (the expired one included); Ron's is still live.
    const resetsFile = read(path.join(dataDir, 'resets.json'));
    expect(resetsFile).not.toContain(dana.id);
    expect(resetsFile).toContain(ron.id);
    expect(auth.resets.liveCount(ron.id)).toBe(1);
    // Lockout and reset-code counters: Dana's are gone, Ron's remain.
    expect(auth.lockout.has(`account:${dana.id}`)).toBe(false);
    expect(auth.lockout.has(`account:${dana.id}@network`)).toBe(false);
    expect(auth.lockout.has(`account:${ron.id}`)).toBe(true);
    expect(reset.codeFailuresOf(dana.id)).toBe(0);
    expect(reset.codeFailuresOf(ron.id)).toBe(1);
    // Memory: Dana's diary is closed; Ron's is open and intact.
    expect(auth.vaults.get(dana.id)).toBeNull();
    expect(auth.vaults.get(ron.id)).not.toBeNull();
    const ronMe = await as(app, ron.token).get('/api/entries?limit=5');
    expect(ronMe.status).toBe(200);
    expect(ronMe.body.total).toBe(1);

    // The username and the e-mail address are free: a new account gets them, with an empty diary.
    const again = await register(app, DANA);
    expect(again.id).not.toBe(dana.id);
    const fresh = await as(app, again.token).get('/api/entries?limit=5');
    expect(fresh.body.total).toBe(0);
    // Nothing of the old account came back meanwhile (no late write of the old diary).
    await new Promise((r) => setTimeout(r, PERSIST_DEBOUNCE_MS + 100));
    expect(fs.readdirSync(usersDir(dataDir)).filter((f) => f.includes(dana.id))).toEqual([]);
  });

  it('also rewrites sessions.json and resets.json when only stale entries of the account are left on disk', async () => {
    const dataDir = tempDataDir();
    const first = await setup(dataDir);
    const dana = await register(first.app, DANA);
    const ron = await register(first.app, RON, { rememberMe: true });
    await first.auth.shutdown();
    services.splice(services.indexOf(first.auth), 1);

    // Written by an earlier run: an expired remembered session of Dana (skipped at load) and an
    // expired reset of hers, next to Ron's live remembered session.
    const sessionsPath = path.join(dataDir, 'sessions.json');
    const sessions = JSON.parse(read(sessionsPath));
    expect(sessions.sessions).toHaveLength(1);
    sessions.sessions.push({
      id: 's_0000000000000001',
      tokenHash: 'f'.repeat(64),
      userId: dana.id,
      deviceName: 'Old phone',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastSeenAt: '2026-01-02T00:00:00.000Z',
      expiresAt: '2026-01-03T00:00:00.000Z',
      rememberMe: true,
      wrappedKeyBase64: Buffer.alloc(60, 1).toString('base64'),
    });
    fs.writeFileSync(sessionsPath, JSON.stringify(sessions));
    const resetsPath = path.join(dataDir, 'resets.json');
    const staleReset = {
      id: 'r_0000000000000001',
      userId: dana.id,
      tokenHash: 'a'.repeat(64),
      codeSalt: 'b'.repeat(32),
      codeHash: 'c'.repeat(64),
      createdAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-01T00:30:00.000Z',
      codeFailures: 0,
    };
    const second = await setup(dataDir);
    // Loading prunes expired resets from the file; write one back as if that write had failed.
    fs.writeFileSync(resetsPath, JSON.stringify({ version: 1, resets: [staleReset] }));
    expect(read(sessionsPath)).toContain(dana.id);
    expect(read(resetsPath)).toContain(dana.id);

    // Dana signs in without "Remember me" (nothing of hers would otherwise make the store write) and deletes.
    const token = await login(second.app, 'dana');
    expect((await as(second.app, token).post('/api/auth/delete-account', { password: PASSWORD })).status).toBe(204);
    expect(read(sessionsPath)).not.toContain(dana.id);
    expect(read(sessionsPath)).toContain(ron.id);
    expect(read(resetsPath)).not.toContain(dana.id);
    expect(fs.readdirSync(usersDir(dataDir)).filter((f) => f.includes(dana.id))).toEqual([]);
  });

  it('locks the password check after 10 wrong passwords (like every password confirmation); nothing is deleted meanwhile', async () => {
    const { app, auth, dataDir } = await setup();
    const dana = await register(app, DANA);
    await savedOnce(auth, dana.token); // the diary file is checked below: no save in flight then
    // 9 wrong passwords are answered as wrong...
    for (let i = 0; i < 9; i++) {
      const res = await as(app, dana.token).post('/api/auth/delete-account', { password: `Wrong${i}pass` });
      expect(res.status, `attempt ${i}`).toBe(400);
    }
    // ...the 10th locks the confirmations of the account for 15 minutes...
    expect((await as(app, dana.token).post('/api/auth/delete-account', { password: 'Wrong9pass' })).status).toBe(429);
    // ...and the next one is refused before the password is even looked at - also the right one.
    const limited = await as(app, dana.token).post('/api/auth/delete-account', { password: PASSWORD });
    expect(limited.status).toBe(429);
    expect(auth.accounts.findById(dana.id)).not.toBeNull();
    expect(fs.existsSync(dbFileOf(dataDir, dana.id))).toBe(true);
  });
});

/**
 * Makes every atomic write of `file` fail (a directory where its ".tmp" goes, as when the disk
 * refuses the write) until the returned function is called.
 */
function blockWrites(file: string): () => void {
  const tmp = `${file}.tmp`;
  fs.mkdirSync(tmp);
  fs.writeFileSync(path.join(tmp, 'in-the-way'), 'x');
  return () => fs.rmSync(tmp, { recursive: true, force: true });
}

/** Nothing of the account `id` (or its name / address) is left in the data folder. */
function expectNothingLeft(dataDir: string, id: string) {
  expect(fs.readdirSync(usersDir(dataDir)).filter((f) => f.includes(id))).toEqual([]);
  for (const file of ['accounts.json', 'sessions.json', 'resets.json']) {
    const text = read(path.join(dataDir, file));
    for (const trace of [id, '"dana"', 'dana@example.com']) expect(text, `${file}: ${trace}`).not.toContain(trace);
  }
}

describe('delete account when the disk fails half-way', () => {
  it('a failed resets.json write deletes nothing: still signed in, the diary intact, and the next try removes everything', async () => {
    const { app, auth, dataDir } = await setup();
    const dana = await register(app, DANA, { rememberMe: true });
    const ron = await register(app, RON, { rememberMe: true });
    auth.resets.create(dana.id);
    // No save behind the test's back (see `savedOnce`): both diaries are saved by hand first, and
    // Dana's new entry stays unsaved - really unsaved, through the whole failed deletion - instead
    // of scheduling a save that could be mid-write while her diary file is checked below.
    const ctx = await savedOnce(auth, dana.token);
    await savedOnce(auth, ron.token);
    runUnsaved(ctx, INSERT_ENTRY);
    const accountsFile = path.join(dataDir, 'accounts.json');
    const accountsBefore = read(accountsFile);

    const unblock = blockWrites(path.join(dataDir, 'resets.json'));
    const failed = await as(app, dana.token).post('/api/auth/delete-account', { password: PASSWORD });
    expect(failed.status).toBe(500);
    // Nothing changed - not the record (recovery key included), the diary, the sessions or the resets.
    expect(read(accountsFile)).toBe(accountsBefore);
    expect(fs.existsSync(dbFileOf(dataDir, dana.id))).toBe(true);
    expect(read(path.join(dataDir, 'sessions.json'))).toContain(dana.id);
    expect(auth.resets.liveCount(dana.id)).toBe(1);
    expect(read(path.join(dataDir, 'resets.json'))).toContain(dana.id);
    const me = await as(app, dana.token).get('/api/entries?limit=5');
    expect(me.status).toBe(200);
    expect(me.body.total).toBe(1);
    // Signing in on another device still works and opens the same diary.
    const other = await login(app, 'dana');
    expect((await as(app, other).get('/api/entries?limit=5')).body.total).toBe(1);

    // Once the disk accepts writes again, deleting removes everything - and only Dana's.
    unblock();
    expect((await as(app, other).post('/api/auth/delete-account', { password: PASSWORD })).status).toBe(204);
    expectNothingLeft(dataDir, dana.id);
    expect(fs.existsSync(dbFileOf(dataDir, ron.id))).toBe(true);
    expect(read(path.join(dataDir, 'sessions.json'))).toContain(ron.id);
    for (const token of [dana.token, other]) expect((await as(app, token).get('/api/auth/me')).status).toBe(401);
    expect((await as(app, ron.token).get('/api/auth/me')).status).toBe(200);
    await register(app, DANA);
  });

  it('a failed sessions.json write keeps every session signed in, attached to the open diary', async () => {
    const { app, auth, dataDir } = await setup();
    const dana = await register(app, DANA, { rememberMe: true });
    const unblock = blockWrites(path.join(dataDir, 'sessions.json'));
    const failed = await as(app, dana.token).post('/api/auth/delete-account', { password: PASSWORD });
    expect(failed.status).toBe(500);
    expect(auth.accounts.findById(dana.id)).not.toBeNull();
    expect(auth.listSessions(dana.id)).toHaveLength(1);
    expect(read(path.join(dataDir, 'sessions.json'))).toContain(dana.id);
    expect((await as(app, dana.token).get('/api/auth/me')).status).toBe(200);
    // Still counted exactly once in its diary (not re-attached on top): signing out closes the diary.
    expect(auth.vaults.get(dana.id)!.refCount).toBe(1);
    unblock();
    expect((await as(app, dana.token).post('/api/auth/delete-account', { password: PASSWORD })).status).toBe(204);
    expectNothingLeft(dataDir, dana.id);
    expect(auth.vaults.size).toBe(0);
  });

  it('a failed accounts.json write keeps the account and its diary (unsaved changes saved); memory and disk agree', async () => {
    const { app, auth, dataDir } = await setup();
    const dana = await register(app, DANA);
    const ron = await register(app, RON);
    // Both diaries saved by hand (users/ is listed below: no ".tmp" of a save in flight), then an
    // entry that is really still unsaved when the deletion fails - closing the diary must save it.
    const ctx = await savedOnce(auth, dana.token);
    await savedOnce(auth, ron.token);
    runUnsaved(ctx, INSERT_ENTRY);
    const accountsFile = path.join(dataDir, 'accounts.json');

    const unblock = blockWrites(accountsFile);
    const failed = await as(app, dana.token).post('/api/auth/delete-account', { password: PASSWORD });
    expect(failed.status).toBe(500);
    // The record is still there - in memory, on disk and for a server started now.
    expect(auth.accounts.findById(dana.id)?.recoveryWrappedKey).toBeTruthy();
    expect(new AccountsStore(accountsFile).findById(dana.id)?.recoveryWrappedKey).toBeTruthy();
    for (const f of fs.readdirSync(usersDir(dataDir))) expect(f.endsWith('.tmp'), f).toBe(false);
    expect(fs.existsSync(dbFileOf(dataDir, dana.id))).toBe(true);
    // Signed out everywhere; the diary was closed and saved, and opens again at the next sign-in.
    expect((await as(app, dana.token).get('/api/auth/me')).status).toBe(401);
    expect(auth.vaults.get(dana.id)).toBeNull();
    const again = await login(app, 'dana');
    expect((await as(app, again).get('/api/entries?limit=5')).body.total).toBe(1);
    // The name is still taken - by the account that still exists.
    expect((await app.anon().post('/api/auth/register').send(DANA)).status).toBe(409);

    unblock();
    expect((await as(app, again).post('/api/auth/delete-account', { password: PASSWORD })).status).toBe(204);
    expectNothingLeft(dataDir, dana.id);
    expect(auth.accounts.findById(ron.id)).not.toBeNull();
    expect(fs.existsSync(dbFileOf(dataDir, ron.id))).toBe(true);
  });

  it('diary files that cannot be removed yet do not keep the account: they go at the next deletion', async () => {
    const { app, auth, dataDir } = await setup();
    const dana = await register(app, DANA);
    const ron = await register(app, RON);
    const danaDb = dbFileOf(dataDir, dana.id);
    // Dana's diary saved once first: the debounced save after her registration would otherwise create
    // the ".prev" by itself - under the mkdir below on a busy machine (EEXIST). Now nothing is pending,
    // and the ".prev" that save wrote makes way.
    await savedOnce(auth, dana.token);
    fs.rmSync(`${danaDb}.prev`, { force: true });
    // Something holds the name of the diary's ".prev" (a directory here - like a file an antivirus keeps open).
    fs.mkdirSync(`${danaDb}.prev`);
    fs.writeFileSync(path.join(`${danaDb}.prev`, 'in-the-way'), 'x');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await as(app, dana.token).post('/api/auth/delete-account', { password: PASSWORD })).status).toBe(204);
    } finally {
      errors.mockRestore();
    }
    // The account is gone: no record, no sign-in, the name and address are free.
    expect(auth.accounts.findById(dana.id)).toBeNull();
    await expect(auth.login(signIn('dana'))).rejects.toMatchObject({ status: 401 });
    const saved = JSON.parse(read(path.join(dataDir, 'accounts.json')));
    expect(saved.accounts.map((a: { id: string }) => a.id)).toEqual([ron.id]);
    // ...and its diary file is written down for removal.
    expect(saved.pendingDeletes).toEqual([`${dana.id}.mpd`]);
    expect(fs.existsSync(danaDb)).toBe(false);

    // The obstacle goes; leftovers of the old diary are removed by the next deletion (Ron's).
    fs.rmSync(`${danaDb}.prev`, { recursive: true });
    for (const f of [danaDb, `${danaDb}.prev`, `${danaDb}.tmp`]) fs.writeFileSync(f, 'old diary');
    const newDana = await register(app, DANA);
    await savedOnce(auth, newDana.token); // users/ is listed below: no save of the new diary in flight then
    expect((await as(app, ron.token).post('/api/auth/delete-account', { password: PASSWORD })).status).toBe(204);
    const left = fs.readdirSync(usersDir(dataDir));
    expect(left.filter((f) => f.includes(dana.id) || f.includes(ron.id))).toEqual([]);
    expect(left).toContain(`${newDana.id}.mpd`);
    const after = read(path.join(dataDir, 'accounts.json'));
    expect(JSON.parse(after).pendingDeletes).toBeUndefined();
    for (const id of [dana.id, ron.id]) expect(after).not.toContain(id);
  });

  it('the next start removes pending diary files - never an existing account’s diary or anything outside users/', async () => {
    const dataDir = tempDataDir();
    const first = await setup(dataDir);
    const ron = await register(first.app, RON);
    await first.auth.shutdown();
    services.splice(services.indexOf(first.auth), 1);

    // Left by an earlier run: the diary of a deleted account, still listed; plus hand-edited entries.
    const deletedDb = path.join(usersDir(dataDir), 'u_00000000000000aa.mpd');
    for (const f of [deletedDb, `${deletedDb}.prev`, `${deletedDb}.tmp`]) fs.writeFileSync(f, 'old diary');
    const accountsFile = path.join(dataDir, 'accounts.json');
    const saved = JSON.parse(read(accountsFile));
    saved.pendingDeletes = ['u_00000000000000aa.mpd', `${ron.id}.mpd`, '../accounts.json', '..\\device.key', 42];
    fs.writeFileSync(accountsFile, JSON.stringify(saved));

    const second = await setup(dataDir);
    const left = fs.readdirSync(usersDir(dataDir));
    expect(left.filter((f) => f.startsWith('u_00000000000000aa'))).toEqual([]);
    expect(left).toContain(`${ron.id}.mpd`);
    expect(fs.existsSync(path.join(dataDir, 'device.key'))).toBe(true);
    const after = JSON.parse(read(accountsFile));
    expect(after.pendingDeletes).toBeUndefined();
    expect(after.accounts.map((a: { id: string }) => a.id)).toEqual([ron.id]);
    const token = await login(second.app, 'ron');
    expect((await as(second.app, token).get('/api/entries?limit=5')).status).toBe(200);
  });
});

describe('delete account racing another device', () => {
  /** Two remembered devices of Dana, then a restart: the diary is closed and each device reopens it with its key. */
  async function restartedWithTwoDevices() {
    const dataDir = tempDataDir();
    const first = await setup(dataDir);
    const dana = await register(first.app, DANA, { rememberMe: true, deviceName: 'Desktop' });
    const phone = await login(first.app, 'dana', { rememberMe: true, deviceName: 'Phone' });
    const ron = await register(first.app, RON, { rememberMe: true });
    await first.auth.shutdown();
    services.splice(services.indexOf(first.auth), 1);
    const second = await setup(dataDir);
    const session = second.auth.sessions.resolve(dana.token)!;
    const account = second.auth.accounts.findById(dana.id)!;
    // The deleting request's context (its diary need not be open for the deletion).
    const ctx = { session, account } as AuthContext;
    return { ...second, dana, phone, ron, ctx };
  }

  function holdOpenVault(): Promise<void> {
    let release!: () => void;
    gate.hold = new Promise<void>((r) => (release = r));
    return new Promise<void>((entered) => {
      gate.entered = () => {
        gate.entered = null;
        entered();
      };
    }).then(() => {
      // Returned promise resolves once the diary was read; the caller releases through `releaseOpen`.
      releaseOpen = () => {
        gate.hold = null;
        release();
      };
    });
  }
  let releaseOpen: () => void = () => {};

  it('a remember-me request that was reopening the diary does not keep it (in memory or on disk)', async () => {
    const h = await restartedWithTwoDevices();
    const opened = holdOpenVault();
    // The phone's request reads and decrypts the diary...
    const phoneRequest = h.auth.authenticate(h.phone);
    await opened;
    // ...while the desktop deletes the account.
    await h.auth.deleteAccount(h.ctx, PASSWORD);
    releaseOpen();
    await expect(phoneRequest).rejects.toMatchObject({ status: 401 });
    expect(h.auth.vaults.get(h.dana.id)).toBeNull();
    expect(h.auth.vaults.size).toBe(0);
    expect(await h.auth.authenticate(h.phone)).toBeNull();
    await new Promise((r) => setTimeout(r, PERSIST_DEBOUNCE_MS + 100));
    expect(fs.readdirSync(usersDir(h.dataDir)).filter((f) => f.includes(h.dana.id))).toEqual([]);
    expect(read(path.join(h.dataDir, 'sessions.json'))).not.toContain(h.dana.id);
    expect(await h.auth.authenticate(h.ron.token)).not.toBeNull();
  });

  it('a sign-in that was opening the diary fails like an unknown account and leaves no session', async () => {
    const h = await restartedWithTwoDevices();
    const opened = holdOpenVault();
    const signingIn = h.auth.login({ ...signIn('dana'), rememberMe: true, deviceName: 'Tablet' });
    await opened;
    await h.auth.deleteAccount(h.ctx, PASSWORD);
    releaseOpen();
    await expect(signingIn).rejects.toMatchObject({ status: 401, code: 'WRONG_PASSWORD' });
    expect(h.auth.vaults.size).toBe(0);
    expect(h.auth.listSessions(h.dana.id)).toEqual([]);
    expect(read(path.join(h.dataDir, 'sessions.json'))).not.toContain(h.dana.id);
    expect(fs.readdirSync(usersDir(h.dataDir)).filter((f) => f.includes(h.dana.id))).toEqual([]);
    // A sign-in after the deletion is refused the same way.
    await expect(h.auth.login(signIn('dana'))).rejects.toMatchObject({ status: 401 });
  });
});

/**
 * Why the tests above save by hand before they look at users/ (`savedOnce`) and keep a change
 * unsaved without a timer (`runUnsaved`): pinned down here, so that a change of the vault's save
 * or of the helpers fails this block instead of returning as a flake under load.
 */
describe('no save behind a test’s back', () => {
  it('a save in flight: between its two renames the diary file is absent and its ".tmp" is there', async () => {
    const { app, auth, dataDir } = await setup();
    const dana = await register(app, DANA);
    const ctx = await savedOnce(auth, dana.token);
    const danaDb = dbFileOf(dataDir, dana.id);
    // Hold the save right before its second rename (".tmp" -> ".mpd") and look at users/ meanwhile.
    const rename = fs.promises.rename;
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    let reached!: () => void;
    const atSecondRename = new Promise<void>((r) => (reached = r));
    const spy = vi.spyOn(fs.promises, 'rename').mockImplementation(async (from, to) => {
      if (String(from) === `${danaDb}.tmp`) {
        reached();
        await held;
      }
      return rename.call(fs.promises, from, to);
    });
    ctx.db.run(INSERT_ENTRY);
    const saving = ctx.vault.persist();
    try {
      await atSecondRename;
      // What a test met by chance when the debounced save of a registration landed under its checks.
      expect(fs.existsSync(danaDb)).toBe(false);
      expect(fs.existsSync(`${danaDb}.tmp`)).toBe(true);
      expect(fs.existsSync(`${danaDb}.prev`)).toBe(true);
    } finally {
      release();
      await saving.catch(() => undefined);
      spy.mockRestore();
    }
    await saving;
    expect(fs.existsSync(danaDb)).toBe(true);
    expect(fs.existsSync(`${danaDb}.tmp`)).toBe(false);
    expect(ctx.db.isDirty()).toBe(false);
  });

  it('after savedOnce nothing is pending; a runUnsaved write stays unsaved - whatever the load - until the next save', async () => {
    const { app, auth, dataDir } = await setup();
    const dana = await register(app, DANA);
    const danaDb = dbFileOf(dataDir, dana.id);
    const listing = () => fs.readdirSync(usersDir(dataDir)).sort();
    const writtenAt = () => fs.statSync(danaDb).mtimeMs;
    // The registration left the language setting unsaved; savedOnce wrote it (hence the ".prev").
    const ctx = await savedOnce(auth, dana.token);
    expect(ctx.db.isDirty()).toBe(false);
    expect(listing()).toEqual([`${dana.id}.mpd`, `${dana.id}.mpd.prev`]);
    const before = writtenAt();

    runUnsaved(ctx, INSERT_ENTRY);
    expect(ctx.db.isDirty()).toBe(true);
    expect(ctx.db.onWrite).not.toBeNull();
    await new Promise((r) => setTimeout(r, PERSIST_DEBOUNCE_MS + 100));
    // No timer was set, so nothing could have been written meanwhile.
    expect(listing()).toEqual([`${dana.id}.mpd`, `${dana.id}.mpd.prev`]);
    expect(writtenAt()).toBe(before);
    expect(ctx.db.isDirty()).toBe(true);

    // The hook is back in place: a plain write schedules the debounced save as always.
    ctx.db.run(INSERT_ENTRY);
    const start = Date.now();
    while (ctx.db.isDirty()) {
      if (Date.now() - start > 10_000) throw new Error('the debounced save did not run');
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(writtenAt()).not.toBe(before);
    expect((await as(app, dana.token).get('/api/entries?limit=5')).body.total).toBe(2);
  });
});
