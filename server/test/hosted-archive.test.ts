/**
 * WP-H8 (docs/android-tasks/SERVER-CARD.md items 2-3; docs/HOSTED-PLAN.md 3.3-3.4): the encrypted
 * server archive and its restore tool.
 *
 *   - POST /api/server/archive: the configured owner only, over HTTPS, with the account password
 *     (confirmation lockout) and a passphrase of 12..1024 characters; one per 10 minutes (429 +
 *     Retry-After, exposed by CORS to the Windows / Android app origins); 507 'server.archive.noSpace' below 1.2 x the data size (the attempt does not
 *     count); keeps the 2 newest; answers size, SHA-256 and the owner's download command;
 *   - the archive is never served by the API; it leaves out archive/, incoming/, logs, temporary
 *     files and every device.key;
 *   - GET /api/server/status lists the archives, the reminder, the disk warning, the data size;
 *     GET /api/server/settings carries `isServerOwner` for the owner only;
 *   - ROUND TRIP: the fictional desktop data dir of mobile/test/fixtures is archived through the
 *     real route of a hosted server, restored with scripts/hosted/restore-archive.mjs (passphrase on
 *     stdin, never an argument), and a hosted server booted on the restored dir with the fixture's
 *     device key (DIARY_DEVICE_KEY) signs the fixture account in and shows its 50 entries;
 *   - the restore tool refuses a non-empty target, a wrong passphrase, a changed / cut-off file
 *     and a passphrase given as an argument - and writes nothing then.
 * Fictional data only.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import type { AuthResponse, EntryPage, ServerArchiveResult, ServerSettings, ServerStatus } from '@shared/types';
import { loadConfig, loadHostedEnv } from '../src/config';
import { startHosted, type HostedStartOptions, type RunningHosted } from '../src/hosted';
import {
  ARCHIVE_NAME_RE,
  archiveFileName,
  createArchiveController,
  downloadCommand,
  flyAppName,
  hashCommand,
  isArchivedPath,
  tarHeaderBlocks,
} from '../src/hosted/archive';
import {
  ARCHIVE_NO_SPACE_KEY,
  ARCHIVE_PASSPHRASE_LONG_KEY,
  ARCHIVE_PASSPHRASE_SHORT_KEY,
  ARCHIVE_PASSWORD_REQUIRED_KEY,
  ARCHIVE_TOO_SOON_KEY,
  ARCHIVE_WRONG_PASSWORD_KEY,
} from '../src/hosted/archive-errors';
import { OWNER_UNSET_KEY } from '../src/hosted/owner';
import { HOSTED_ORIGINS } from '../src/middleware/access';
import { isArchiveDue } from '../src/routes/server-status';
import { cleanupTempDirs, tempDataDir } from './helpers';

const ROOT = path.resolve(__dirname, '..', '..');
const RESTORE = path.join(ROOT, 'scripts', 'hosted', 'restore-archive.mjs');
const FIXTURES = path.join(ROOT, 'mobile', 'test', 'fixtures');
const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'manifest.json'), 'utf8')) as {
  account: { id: string; username: string; password: string };
  content: { entries: number };
};

const PASSWORD = 'Passw0rd!';
const PASSPHRASE = 'correct horse battery staple – יומן';
const FAST = { kdf: { N: 1024, r: 8, p: 1 } };
const HOST = 'diary.example';
const running: RunningHosted[] = [];

afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

async function boot(o: { dataDir?: string; env?: Record<string, string>; start?: HostedStartOptions } = {}) {
  const dataDir = o.dataDir ?? tempDataDir();
  const env = loadHostedEnv({ DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: `https://${HOST}`, DIARY_BIND: '127.0.0.1', ...o.env });
  const config = loadConfig(['--data-dir', dataDir], { DIARY_MODE: 'hosted' });
  const srv = await startHosted(config, env, { port: 0, quiet: true, auth: FAST, ...o.start });
  running.push(srv);
  const agent = supertest(srv.localUrl);
  type Req = ReturnType<typeof agent.get>;
  const common = (r: Req, secure: boolean) => {
    r.set('Host', HOST).set('Accept-Language', 'en');
    return secure ? r.set('X-Forwarded-Proto', 'https') : r;
  };
  const anon = () => ({
    post: (url: string, body: object = {}) => common(agent.post(url), true).set('X-Forwarded-For', '203.0.113.7').send(body),
  });
  const as = (token: string, secure = true) => ({
    get: (url: string) => common(agent.get(url), secure).set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object = {}) => common(agent.post(url), secure).set('Authorization', `Bearer ${token}`).send(body),
  });
  return { srv, anon, as, dataDir };
}

function registerBody(username: string) {
  // A hosted server creates no account without the privacy checkbox (docs/android-tasks/PRIVACY-CHECKBOX.md).
  return { firstName: 'Test', lastName: 'User', username, email: `${username}@example.com`, password: PASSWORD, confirmPassword: PASSWORD, privacyAccepted: true, termsAccepted: true };
}

function sha256File(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Runs the restore tool with `input` on stdin (the passphrase line). */
function restore(args: string[], input: string) {
  const r = spawnSync(process.execPath, [RESTORE, ...args], { cwd: ROOT, input, encoding: 'utf8', timeout: 120_000 });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

/** Every file below `dir`, as POSIX paths relative to it. */
function listFiles(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listFiles(dir, r));
    else out.push(r);
  }
  return out.sort();
}

/** A data dir with the fixture's account + diary + device key, plus everything an archive must leave out. */
function fixtureDataDir(): string {
  const dir = tempDataDir();
  const src = path.join(FIXTURES, 'desktop-data');
  for (const f of ['accounts.json', 'sessions.json', 'device.key']) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  fs.mkdirSync(path.join(dir, 'users'));
  fs.copyFileSync(path.join(src, 'users', `${manifest.account.id}.mpd.fixture`), path.join(dir, 'users', `${manifest.account.id}.mpd`));
  // Left out of every archive:
  fs.mkdirSync(path.join(dir, 'incoming', 'replaced-20261001T000000Z'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'incoming', 'pc-data.tar'), 'fictional upload');
  fs.writeFileSync(path.join(dir, 'incoming', 'replaced-20261001T000000Z', 'accounts.json'), '{}');
  fs.mkdirSync(path.join(dir, 'logs'));
  fs.writeFileSync(path.join(dir, 'logs', 'server.log'), 'log line');
  fs.writeFileSync(path.join(dir, 'server.log'), 'log line');
  fs.writeFileSync(path.join(dir, 'users', `${manifest.account.id}.mpd.tmp`), 'half-written');
  fs.writeFileSync(path.join(dir, 'server-settings.json.tmp'), '{}');
  fs.writeFileSync(path.join(dir, 'users', 'device.key'), 'not a key');
  fs.mkdirSync(path.join(dir, 'lost+found'));
  fs.mkdirSync(path.join(dir, 'archive'));
  fs.writeFileSync(path.join(dir, 'archive', 'note.txt'), 'old');
  return dir;
}

describe('archive helpers', () => {
  it('names, commands and the include rule', () => {
    const name = archiveFileName(Date.UTC(2026, 9, 27, 9, 5, 7));
    expect(name).toBe('your-personal-diary-server-2026-10-27T09-05-07Z.mpda');
    expect(ARCHIVE_NAME_RE.test(name)).toBe(true);
    expect(downloadCommand(`/data/archive/${name}`, name, 'yourpersonaldiary')).toBe(
      `C:\\Users\\AVI\\.fly\\bin\\flyctl.exe ssh sftp get /data/archive/${name} .\\${name} -a yourpersonaldiary`,
    );
    expect(hashCommand(name, 'ab'.repeat(32))).toBe(`(Get-FileHash .\\${name} -Algorithm SHA256).Hash -eq '${'ab'.repeat(32)}'`);
    expect(hashCommand(name, null)).toBe('');
    expect(flyAppName({})).toBe('yourpersonaldiary');
    expect(flyAppName({ FLY_APP_NAME: 'yourpersonaldiary-staging' })).toBe('yourpersonaldiary-staging');
    expect(flyAppName({ FLY_APP_NAME: 'Bad Name; rm' })).toBe('yourpersonaldiary');

    for (const [rel, dir, kept] of [
      ['accounts.json', false, true],
      ['users', true, true],
      ['users/u_1.mpd', false, true],
      ['users/u_1.mpd.prev', false, true],
      ['users/u_1.mpd.tmp', false, false],
      ['device.key', false, false],
      ['users/device.key', false, false],
      ['device.key.bak', false, false],
      ['archive', true, false],
      ['archive/x.mpda', false, false],
      ['incoming', true, false],
      ['logs', true, false],
      ['server.log', false, false],
      ['lost+found', true, false],
      ['sessions.json.partial', false, false],
    ] as const) {
      expect([rel, isArchivedPath(rel, dir)]).toEqual([rel, kept]);
    }
  });

  it('long names get a PAX path record; ustar headers carry a valid checksum', () => {
    const long = `users/${'a'.repeat(120)}/${'b'.repeat(120)}.mpd`;
    const blocks = tarHeaderBlocks(long, { dir: false, size: 5, mtimeSec: 1 });
    expect(blocks.length).toBe(4); // PAX header, PAX data, padding, ustar header
    expect(blocks[1].toString('utf8')).toContain(`path=${long}\n`);
    const h = blocks[3];
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i];
    expect(parseInt(h.subarray(148, 154).toString('ascii'), 8)).toBe(sum);
    expect(tarHeaderBlocks('accounts.json', { dir: false, size: 1, mtimeSec: 1 })).toHaveLength(1);
  });
});

describe('POST /api/server/archive and the Server card', () => {
  it('owner only, over HTTPS, with the account password and a passphrase of 12+ characters', async () => {
    let ownerId = '';
    const { anon, as, dataDir } = await boot({ start: { ownerId: () => ownerId, archive: { kdf: FAST.kdf } } });
    const first = (await anon().post('/api/auth/register', registerBody('ownerarch'))).body as AuthResponse;
    const second = (await anon().post('/api/auth/register', registerBody('otherarch'))).body as AuthResponse;
    const o = as(first.token);
    const x = as(second.token);
    const body = { password: PASSWORD, passphrase: PASSPHRASE };

    // No owner configured yet: 403 'server.owner.unset' for everyone; isServerOwner false.
    const unset = await o.post('/api/server/archive', body);
    expect(unset.status).toBe(403);
    expect(unset.body.message).toBe(t('en', OWNER_UNSET_KEY));
    expect(((await o.get('/api/server/settings')).body as ServerSettings).isServerOwner).toBe(false);

    ownerId = first.user.id;
    expect(((await o.get('/api/server/settings')).body as ServerSettings).isServerOwner).toBe(true);
    expect(((await x.get('/api/server/settings')).body as ServerSettings).isServerOwner).toBe(false);

    // Another account, plain HTTP: 403, nothing written.
    expect((await x.post('/api/server/archive', body)).status).toBe(403);
    expect((await as(first.token, false).post('/api/server/archive', body)).status).toBe(403);

    // Validation: password first, then the passphrase (before any scrypt), then the password check.
    const noPw = await o.post('/api/server/archive', { passphrase: PASSPHRASE });
    expect([noPw.status, noPw.body.code, noPw.body.field, noPw.body.message]).toEqual([400, 'VALIDATION', 'password', t('en', ARCHIVE_PASSWORD_REQUIRED_KEY)]);
    const short = await o.post('/api/server/archive', { password: PASSWORD, passphrase: 'elevenchars' });
    expect([short.status, short.body.field, short.body.message]).toEqual([400, 'passphrase', t('en', ARCHIVE_PASSPHRASE_SHORT_KEY, { min: 12 })]);
    const missing = await o.post('/api/server/archive', { password: PASSWORD });
    expect([missing.status, missing.body.field]).toEqual([400, 'passphrase']);
    const long = await o.post('/api/server/archive', { password: PASSWORD, passphrase: 'x'.repeat(1025) });
    expect([long.status, long.body.field, long.body.message]).toEqual([400, 'passphrase', t('en', ARCHIVE_PASSPHRASE_LONG_KEY, { max: 1024 })]);
    const wrong = await o.post('/api/server/archive', { password: 'Wrong-Passw0rd', passphrase: PASSPHRASE });
    expect([wrong.status, wrong.body.code, wrong.body.field, wrong.body.message]).toEqual([400, 'WRONG_PASSWORD', 'password', t('en', ARCHIVE_WRONG_PASSWORD_KEY)]);
    expect(fs.existsSync(path.join(dataDir, 'archive'))).toBe(false);

    // Before the first archive: the reminder is due.
    const before = (await o.get('/api/server/status')).body as ServerStatus;
    expect(before).toMatchObject({ lastArchiveAt: null, archiveDue: true, archives: [], archiveBusy: false, archiveRetryAfterSec: 0 });
    expect(typeof before.dataBytes).toBe('number');
    expect(typeof before.diskLow).toBe('boolean');

    const made = await o.post('/api/server/archive', body);
    expect(made.status).toBe(201);
    const res = made.body as ServerArchiveResult;
    expect(res.fileName).toMatch(ARCHIVE_NAME_RE);
    const file = path.join(dataDir, 'archive', res.fileName);
    expect(res.path).toBe(file);
    expect(fs.statSync(file).size).toBe(res.sizeBytes);
    expect(sha256File(file)).toBe(res.sha256);
    expect(res.downloadCommand).toBe(`C:\\Users\\AVI\\.fly\\bin\\flyctl.exe ssh sftp get ${file} .\\${res.fileName} -a yourpersonaldiary`);
    expect(res.hashCommand).toBe(`(Get-FileHash .\\${res.fileName} -Algorithm SHA256).Hash -eq '${res.sha256}'`);
    expect(res.files).toBeGreaterThanOrEqual(2);
    expect(res.removed).toEqual([]);
    expect(fs.readFileSync(`${file}.sha256`, 'utf8')).toBe(`${res.sha256}  ${res.fileName}\n`);
    // Everything inside is encrypted: not even a user name of accounts.json is readable.
    expect(fs.readFileSync(file).includes(Buffer.from('ownerarch'))).toBe(false);
    expect(fs.readFileSync(file).includes(Buffer.from('accounts.json'))).toBe(false);

    // One per 10 minutes: 429 + Retry-After, before any password check.
    const soon = await o.post('/api/server/archive', body);
    expect(soon.status).toBe(429);
    expect(soon.body.message).toBe(t('en', ARCHIVE_TOO_SOON_KEY, { minutes: 10 }));
    expect(Number(soon.headers['retry-after'])).toBeGreaterThan(500);

    // The card: the archive, no reminder, the cooldown.
    const after = (await o.get('/api/server/status')).body as ServerStatus;
    expect(after.lastArchiveAt).toBe(res.createdAt);
    expect(after.archiveDue).toBe(false);
    expect(after.archives).toEqual([
      { fileName: res.fileName, path: res.path, sizeBytes: res.sizeBytes, sha256: res.sha256, createdAt: res.createdAt, downloadCommand: res.downloadCommand, hashCommand: res.hashCommand },
    ]);
    expect(after.archiveRetryAfterSec).toBeGreaterThan(500);
    expect((await x.get('/api/server/status')).status).toBe(403);

    // Never served by the API (there is no GET; nothing else serves the archive directory).
    expect((await o.get('/api/server/archive')).status).toBe(404);
    expect((await o.get(`/api/server/archive/${res.fileName}`)).status).toBe(404);
    for (const url of [`/archive/${res.fileName}`, `/${res.fileName}`, `/data/archive/${res.fileName}`]) {
      expect([url, (await o.get(url)).status === 200]).toEqual([url, false]);
    }
  });

  it('keeps the 2 newest archives; 507 below 1.2 x the data size does not count against the limit', async () => {
    let clock = Date.UTC(2026, 9, 1, 12, 0, 0);
    let free: number | null = 1;
    let ownerId = '';
    const { anon, as, dataDir } = await boot({ start: { ownerId: () => ownerId, archive: { kdf: FAST.kdf, now: () => clock, freeBytes: () => free } } });
    const reg = (await anon().post('/api/auth/register', registerBody('keeper'))).body as AuthResponse;
    ownerId = reg.user.id;
    const me = as(reg.token);
    const body = { password: PASSWORD, passphrase: PASSPHRASE };

    const full = await me.post('/api/server/archive', body);
    expect(full.status).toBe(507);
    expect(full.body.code).toBe('IO');
    expect(full.body.message).toBe(t('en', ARCHIVE_NO_SPACE_KEY, { needMb: 1, freeMb: 0 }));
    expect(fs.readdirSync(path.join(dataDir, 'archive'))).toEqual([]);

    free = null; // unknown free space: the write is attempted
    const names: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await me.post('/api/server/archive', body);
      expect(r.status).toBe(201);
      names.push((r.body as ServerArchiveResult).fileName);
      if (i === 2) expect((r.body as ServerArchiveResult).removed).toEqual([names[0]]);
      clock += 11 * 60_000;
    }
    const left = fs.readdirSync(path.join(dataDir, 'archive')).sort();
    expect(left).toEqual([names[1], `${names[1]}.sha256`, names[2], `${names[2]}.sha256`].sort());
    const status = (await me.get('/api/server/status')).body as ServerStatus;
    expect(status.archives.map((a) => a.fileName)).toEqual([names[2], names[1]]);
    expect(status.lastArchiveAt).toBe(status.archives[0].createdAt);
    // The reminder: more than 30 days after the newest archive.
    const newest = status.archives[0];
    const at = Date.parse(newest.createdAt);
    expect(isArchiveDue(newest, at + 30 * 24 * 3600_000)).toBe(false);
    expect(isArchiveDue(newest, at + 30 * 24 * 3600_000 + 1000)).toBe(true);
    expect(isArchiveDue(undefined, at)).toBe(true);
  });

  it('two requests at once: one archive, the other 429', async () => {
    const dataDir = tempDataDir();
    const ctl = createArchiveController({ dataDir, kdf: FAST.kdf, log: () => {} });
    fs.writeFileSync(path.join(dataDir, 'accounts.json'), '{"version":1,"accounts":[]}');
    const results = await Promise.allSettled([ctl.create(PASSPHRASE), ctl.create(PASSPHRASE)]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason.status).toBe(429);
    expect(ctl.list()).toHaveLength(1);
    expect(ctl.busy()).toBe(false);
  });

  // Regression (fixer, finding "Retry-After of the archive route's 429 is not exposed"): the Windows
  // and Android apps are cross-origin, and fetch() hides Retry-After (not a CORS-safelisted header)
  // unless Access-Control-Expose-Headers names it - the card's "next archive from HH:MM" line would
  // never be refreshed after a 429 there.
  it('the 429 Retry-After is exposed (CORS) to every app origin; same-origin answers and the status route are unchanged', async () => {
    const exposed = (value: string | undefined) =>
      (value ?? '')
        .split(',')
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean);
    let ownerId = '';
    const { anon, as } = await boot({ start: { ownerId: () => ownerId, archive: { kdf: FAST.kdf } } });
    const reg = (await anon().post('/api/auth/register', registerBody('corsarch'))).body as AuthResponse;
    ownerId = reg.user.id;
    const me = as(reg.token);
    const body = { password: PASSWORD, passphrase: PASSPHRASE };
    const made = await me.post('/api/server/archive', body).set('Origin', 'https://localhost');
    expect(made.status).toBe(201);
    expect(exposed(made.headers['access-control-expose-headers'])).toContain('retry-after');
    for (const origin of HOSTED_ORIGINS) {
      const soon = await me.post('/api/server/archive', body).set('Origin', origin);
      expect([origin, soon.status]).toEqual([origin, 429]);
      expect(soon.headers['access-control-allow-origin']).toBe(origin);
      expect(Number(soon.headers['retry-after'])).toBeGreaterThan(500);
      expect([origin, exposed(soon.headers['access-control-expose-headers'])]).toEqual([origin, ['content-disposition', 'x-entries-exported', 'retry-after']]);
    }
    // Same-origin (the web UI): no CORS header at all, as before; Retry-After is readable anyway.
    const same = await me.post('/api/server/archive', body);
    expect(same.status).toBe(429);
    expect(Number(same.headers['retry-after'])).toBeGreaterThan(500);
    expect(same.headers['access-control-expose-headers']).toBeUndefined();
    // An origin outside the list: still nothing.
    const other = await me.post('/api/server/archive', body).set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
    expect(other.headers['access-control-expose-headers']).toBeUndefined();
    // The card's status route keeps exactly the two download headers.
    const status = await me.get('/api/server/status').set('Origin', 'https://localhost');
    expect(status.status).toBe(200);
    expect(exposed(status.headers['access-control-expose-headers'])).toEqual(['content-disposition', 'x-entries-exported']);
  });
});

describe('round trip: fixture data dir -> real route -> restore-archive.mjs -> hosted server signs in', () => {
  it('restores everything but the left-out files, and the restored server opens the diary with the device key', async () => {
    const dataDir = fixtureDataDir();
    // The real route, the app's own KDF (no test shortcut).
    const a = await boot({ dataDir, env: { DIARY_OWNER_ID: manifest.account.id } });
    const login = await a.anon().post('/api/auth/login', { username: manifest.account.username, password: manifest.account.password });
    expect(login.status).toBe(200);
    const made = await a.as((login.body as AuthResponse).token).post('/api/server/archive', { password: manifest.account.password, passphrase: PASSPHRASE });
    expect(made.status).toBe(201);
    const res = made.body as ServerArchiveResult;
    // What the volume held when the archive was written (the sign-in above rewrote accounts.json).
    const accountsAtArchive = sha256File(path.join(dataDir, 'accounts.json'));
    await a.srv.stop();
    running.splice(running.indexOf(a.srv), 1);
    const archive = path.join(tempDataDir(), res.fileName);
    fs.copyFileSync(res.path, archive); // "downloaded"
    expect(sha256File(archive)).toBe(res.sha256);

    // Restore: the passphrase on stdin.
    const target = path.join(tempDataDir(), 'restored');
    const r = restore([archive, target], `${PASSPHRASE}\n`);
    expect(r.err).not.toMatch(/failed|wrong/i);
    expect(r.code).toBe(0);
    expect(r.out).toContain(`SHA-256: ${res.sha256}`);
    expect(r.out).toContain('Accounts in the archive: 1');
    expect(r.out).not.toContain(manifest.account.username);
    const restored = listFiles(target);
    expect(restored).toEqual(expect.arrayContaining(['accounts.json', 'sessions.json', `users/${manifest.account.id}.mpd`]));
    // Only what the include rule allows, and only files that exist on the volume.
    for (const f of restored) {
      expect([f, isArchivedPath(f, false), fs.existsSync(path.join(dataDir, f))]).toEqual([f, true, true]);
    }
    expect(restored.length).toBe(res.files);
    expect(sha256File(path.join(target, 'accounts.json'))).toBe(accountsAtArchive);
    for (const gone of ['device.key', 'incoming', 'logs', 'server.log', 'archive', 'lost+found', 'server-settings.json.tmp', `users/${manifest.account.id}.mpd.tmp`, 'users/device.key']) {
      expect([gone, fs.existsSync(path.join(target, gone))]).toEqual([gone, false]);
    }

    // Boot on the restored dir with the fixture's device key as the sealed secret, and sign in.
    const deviceKey = fs.readFileSync(path.join(FIXTURES, 'desktop-data', 'device.key')).toString('base64');
    const b = await boot({ dataDir: target, env: { DIARY_OWNER_ID: manifest.account.id, DIARY_DEVICE_KEY: deviceKey } });
    const again = await b.anon().post('/api/auth/login', { username: manifest.account.username, password: manifest.account.password });
    expect(again.status).toBe(200);
    const entries = (await b.as((again.body as AuthResponse).token).get('/api/entries?limit=1000')).body as EntryPage;
    expect(entries.total).toBe(manifest.content.entries);
    // The key came from the secret: nothing was written as device.key.
    expect(fs.existsSync(path.join(target, 'device.key'))).toBe(false);
  });
});

describe('restore-archive.mjs refuses and writes nothing', () => {
  async function anArchive(): Promise<string> {
    const dataDir = tempDataDir();
    fs.writeFileSync(path.join(dataDir, 'accounts.json'), '{"version":1,"accounts":[]}');
    fs.mkdirSync(path.join(dataDir, 'users'));
    fs.writeFileSync(path.join(dataDir, 'users', 'u_test.mpd'), Buffer.alloc(3000, 7));
    // A small chunk size so that the file has many records (reordering / truncation are visible).
    const ctl = createArchiveController({ dataDir, kdf: FAST.kdf, chunkSize: 1024, log: () => {} });
    return (await ctl.create(PASSPHRASE)).path;
  }

  it('a non-empty target, a wrong passphrase, a passphrase as an argument, no arguments', async () => {
    const archive = await anArchive();
    const busy = tempDataDir();
    fs.writeFileSync(path.join(busy, 'keep.txt'), 'mine');
    const r1 = restore([archive, busy], `${PASSPHRASE}\n`);
    expect(r1.code).toBe(2);
    expect(r1.err).toMatch(/not empty/);
    expect(fs.readdirSync(busy)).toEqual(['keep.txt']);

    const target = path.join(tempDataDir(), 'out');
    const r2 = restore([archive, target], 'not the passphrase\n');
    expect(r2.code).toBe(3);
    expect(r2.err).toMatch(/Wrong passphrase/);
    expect(fs.existsSync(target)).toBe(false);

    const r3 = restore([archive, target, PASSPHRASE], '');
    expect(r3.code).toBe(2);
    expect(r3.err).toMatch(/never given on the command line/);
    expect(restore([], '').code).toBe(2);

    const ok = restore([archive, target], `${PASSPHRASE}\n`);
    expect(ok.code).toBe(0);
    expect(fs.readFileSync(path.join(target, 'users', 'u_test.mpd'))).toEqual(Buffer.alloc(3000, 7));
  });

  it('a changed byte, a cut-off file, swapped records and appended bytes are refused before anything is written', async () => {
    const archive = await anArchive();
    const bytes = fs.readFileSync(archive);
    const record = 1024 + 16;
    const variants: Array<[string, Buffer]> = [
      ['changed byte', Buffer.from(bytes.map((b, i) => (i === 48 + record + 5 ? b ^ 1 : b)))],
      ['changed header', Buffer.from(bytes.map((b, i) => (i === 40 ? b ^ 1 : b)))],
      ['cut after a full record', bytes.subarray(0, 48 + 2 * record)],
      ['cut in the middle', bytes.subarray(0, bytes.length - 100)],
      ['appended bytes', Buffer.concat([bytes, Buffer.alloc(16, 1)])],
      ['swapped records', Buffer.concat([bytes.subarray(0, 48), bytes.subarray(48 + record, 48 + 2 * record), bytes.subarray(48, 48 + record), bytes.subarray(48 + 2 * record)])],
    ];
    for (const [what, data] of variants) {
      const file = path.join(tempDataDir(), 'x.mpda');
      fs.writeFileSync(file, data);
      const target = path.join(tempDataDir(), 'out');
      const r = restore([file, target], `${PASSPHRASE}\n`);
      expect([what, r.code]).toEqual([what, 3]);
      expect([what, fs.existsSync(target)]).toEqual([what, false]);
    }
  });
});
