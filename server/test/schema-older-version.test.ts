/**
 * The other side of the newer-schema guard (schema-newer-version.test.ts): `applySchema` now
 * distinguishes "newer" (refused) from "current" (nothing to do) and "older" (migrate). A database
 * of an OLDER schema version - a diary or a backup written before a migration existed - must still
 * open and be migrated, a current one must open without a single write, and a diary on disk must
 * survive a restart untouched. Fictional data only.
 */
import fs from 'node:fs';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { restoreBackup } from '../src/backup/backup';
import { DiaryDb, getSqlJs } from '../src/db/database';
import { applySchema, currentVersion, SCHEMA_VERSION } from '../src/db/schema';
import { encryptContainer } from '../src/security/container';
import { createAuthService, type DiaryAuthService } from '../src/security/auth-service';
import { deriveSecret, newSalt, splitSecret } from '../src/security/kdf';
import { vaultPathOf } from '../src/security/vault';
import { cleanupTempDirs, makeTestApp, sampleEntry, tempDataDir, testConfig } from './helpers';

afterAll(cleanupTempDirs);

const FAST = { N: 1024, r: 8, p: 1 };
const PASSWORD = 'Passw0rd!';
const services: DiaryAuthService[] = [];

afterEach(async () => {
  for (const s of services.splice(0)) await s.shutdown();
});

/** SQLite image of schema version 0: what a database looks like before migration 1 ran. */
async function olderImage(withEmptyVersionTable: boolean): Promise<Uint8Array> {
  const SQL = await getSqlJs();
  const raw = new SQL.Database();
  // Something must be in the file, or the image is empty; a table no migration knows is kept as it is.
  raw.run('CREATE TABLE legacy_note (id INTEGER PRIMARY KEY, text TEXT NOT NULL)');
  raw.run("INSERT INTO legacy_note(text) VALUES ('kept')");
  if (withEmptyVersionTable) raw.run('CREATE TABLE schema_version (version INTEGER NOT NULL)');
  const image = raw.export();
  raw.close();
  return image;
}

async function boot(dataDir = tempDataDir()) {
  const config = testConfig(dataDir);
  const auth = await createAuthService(config, { kdf: FAST });
  services.push(auth);
  const app = await makeTestApp({ auth, config });
  const as = (token: string) => ({
    get: (url: string) => app.anon().get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body?: object) => app.anon().post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
  });
  const register = async (username: string, rememberMe = false) => {
    const res = await app.anon().post('/api/auth/register').send({
      firstName: 'Dana',
      lastName: 'Cohen',
      username,
      email: `${username}@example.com`,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      rememberMe,
    });
    expect(res.status).toBe(201);
    return res.body.token as string;
  };
  return { config, auth, app, as, register, dataDir };
}

describe('a database of an older schema version', () => {
  it.each([
    ['without a schema_version table', false],
    ['with an empty schema_version table', true],
  ])('is migrated when it is opened (%s)', async (_label, withTable) => {
    const image = await olderImage(withTable);
    const db = await DiaryDb.fromImage(image);
    expect(currentVersion(db)).toBe(SCHEMA_VERSION);
    expect(db.all('SELECT version FROM schema_version ORDER BY version').map((r) => Number(r.version))).toEqual(
      Array.from({ length: SCHEMA_VERSION }, (_v, i) => i + 1),
    );
    // The tables of the current schema exist and work; what was in the file is still there.
    expect(Number(db.scalar<number>('SELECT COUNT(*) FROM entries'))).toBe(0);
    expect(Number(db.scalar<number>('SELECT COUNT(*) FROM habits'))).toBe(0);
    expect(db.all('SELECT text FROM legacy_note')).toEqual([{ text: 'kept' }]);
    // A second run changes nothing.
    const seq = db.writeSequence;
    expect(() => applySchema(db)).not.toThrow();
    expect(db.writeSequence).toBe(seq);
    db.close();
  });

  it('a backup of an older schema version is restored and migrated', async () => {
    const { auth, as, register } = await boot();
    const token = await register('dana');
    expect((await as(token).post('/api/entries', sampleEntry({ title: 'replaced by the restore' }))).status).toBe(201);
    const ctx = (await auth.authenticate(token))!;

    // The backup file: the older image in a container with its own password.
    const salt = newSalt();
    const secret = await deriveSecret('Backup1pass', salt, FAST);
    const { key } = splitSecret(secret);
    const backup = encryptContainer(await olderImage(false), key, salt, FAST);

    await expect(restoreBackup(ctx.vault, backup, 'Backup1pass')).resolves.toMatchObject({ entries: 0, habits: 0 });
    expect(currentVersion(ctx.vault.db)).toBe(SCHEMA_VERSION);
    // The restored diary is usable right away, through the API.
    expect((await as(token).get('/api/entries')).body.total).toBe(0);
    expect((await as(token).post('/api/entries', sampleEntry({ title: 'first after the restore' }))).status).toBe(201);
    expect((await as(token).get('/api/entries')).body.items.map((e: { title: string }) => e.title)).toEqual(['first after the restore']);
  });
});

describe('a diary of the current schema version', () => {
  it('opens after a restart without being rewritten, by password and by a remember-me session', async () => {
    const first = await boot();
    const token = await first.register('ron', true);
    expect((await first.as(token).post('/api/entries', sampleEntry({ title: 'before the restart' }))).status).toBe(201);
    const account = (await first.auth.authenticate(token))!.account;
    await first.auth.shutdown();
    services.splice(services.indexOf(first.auth), 1);
    const file = vaultPathOf(first.config, account);
    const bytesBefore = fs.readFileSync(file);

    const second = await boot(first.dataDir);
    // The remember-me session reopens the diary...
    const viaSession = await second.as(token).get('/api/entries');
    expect(viaSession.status).toBe(200);
    expect(viaSession.body.items.map((e: { title: string }) => e.title)).toEqual(['before the restart']);
    // ...and so does the password; opening alone wrote nothing to the diary file.
    const login = await second.app.anon().post('/api/auth/login').send({ username: 'ron', password: PASSWORD });
    expect(login.status).toBe(200);
    expect(fs.readFileSync(file).equals(bytesBefore)).toBe(true);
    expect(currentVersion((await second.auth.authenticate(login.body.token))!.db)).toBe(SCHEMA_VERSION);
  });
});
