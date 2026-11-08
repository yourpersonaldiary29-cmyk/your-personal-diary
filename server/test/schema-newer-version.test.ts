/**
 * A database written by a NEWER version of the app (schema_version > SCHEMA_VERSION) used to be
 * accepted silently. Now it is refused before anything is written, with a localised message that
 * says what to do: 'server.vault.newerVersion' when a diary is opened (sign-in, remember-me),
 * 'server.backup.newerVersion' when a backup is restored. The file on disk / the current diary is
 * left exactly as it was. The brand "Your Personal Diary" stays in English in all 20 languages.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { LOCALE_CODES, t } from '@shared/i18n';
import { NEWER_BACKUP_VERSION_KEY, restoreBackup } from '../src/backup/backup';
import { DiaryDb } from '../src/db/database';
import { applySchema, currentVersion, NewerSchemaError, SCHEMA_VERSION } from '../src/db/schema';
import { ApiError } from '../src/errors';
import { createAuthService, type DiaryAuthService } from '../src/security/auth-service';
import { NEWER_DIARY_VERSION_KEY, vaultPathOf } from '../src/security/vault';
import { cleanupTempDirs, makeTestApp, sampleEntry, tempDataDir, testConfig } from './helpers';

afterAll(cleanupTempDirs);

const FAST = { N: 1024, r: 8, p: 1 };
const PASSWORD = 'Passw0rd!';
const services: DiaryAuthService[] = [];

afterEach(async () => {
  for (const s of services.splice(0)) await s.shutdown();
});

/** Marks `db` as written by a newer app version (as that version's migration would). */
function bumpSchema(db: DiaryDb, version = SCHEMA_VERSION + 1): void {
  db.run('INSERT INTO schema_version(version) VALUES (?)', [version]);
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
  const register = async (username: string) => {
    const res = await app.anon().post('/api/auth/register').send({
      firstName: 'Dana',
      lastName: 'Cohen',
      username,
      email: `${username}@example.com`,
      password: PASSWORD,
      confirmPassword: PASSWORD,
    });
    expect(res.status).toBe(201);
    return res.body.token as string;
  };
  return { config, auth, app, as, register, dataDir };
}

describe('applySchema / DiaryDb.fromImage', () => {
  it('opens a database of the current version and migrates an empty one', async () => {
    const db = await DiaryDb.create();
    expect(currentVersion(db)).toBe(SCHEMA_VERSION);
    expect(() => applySchema(db)).not.toThrow();
    const again = await DiaryDb.fromImage(db.export());
    expect(currentVersion(again)).toBe(SCHEMA_VERSION);
  });

  it('refuses a newer schema version instead of accepting it silently', async () => {
    const db = await DiaryDb.create();
    bumpSchema(db);
    expect(() => applySchema(db)).toThrow(NewerSchemaError);
    try {
      applySchema(db);
    } catch (e) {
      expect(e).toMatchObject({ found: SCHEMA_VERSION + 1, supported: SCHEMA_VERSION });
    }
    await expect(DiaryDb.fromImage(db.export())).rejects.toBeInstanceOf(NewerSchemaError);
    const farFuture = await DiaryDb.create();
    bumpSchema(farFuture, 99);
    await expect(DiaryDb.fromImage(farFuture.export())).rejects.toMatchObject({ found: 99 });
  });

  it('writes nothing to a newer database (no migration row, no table touched)', async () => {
    const db = await DiaryDb.create();
    bumpSchema(db);
    const rowsBefore = db.all('SELECT version FROM schema_version ORDER BY version');
    const seqBefore = db.writeSequence;
    expect(() => applySchema(db)).toThrow(NewerSchemaError);
    expect(db.all('SELECT version FROM schema_version ORDER BY version')).toEqual(rowsBefore);
    expect(db.writeSequence).toBe(seqBefore);
  });
});

describe('opening a diary written by a newer version', () => {
  it('sign-in answers 409 with the "update the app" message in the request language and leaves the file untouched', async () => {
    const first = await boot();
    const token = await first.register('dana');
    expect((await first.as(token).post('/api/entries', sampleEntry({ title: 'before the update' }))).status).toBe(201);
    // The "newer app" wrote this diary: its schema version is ahead of this build.
    const ctx = (await first.auth.authenticate(token))!;
    bumpSchema(ctx.db);
    const account = ctx.account;
    await first.auth.shutdown();
    services.splice(services.indexOf(first.auth), 1);

    const file = vaultPathOf(first.config, account);
    const bytesBefore = fs.readFileSync(file);
    const listingBefore = fs.readdirSync(path.dirname(file)).sort();

    // "Restart" with this (older) build.
    const second = await boot(first.dataDir);
    for (const lang of ['en', 'he', 'de'] as const) {
      const res = await second.app.anon().post('/api/auth/login').set('Accept-Language', lang).send({ username: 'dana', password: PASSWORD });
      expect({ lang, status: res.status, code: res.body.code }).toEqual({ lang, status: 409, code: 'DB' });
      expect(res.body.message).toBe(t(lang, NEWER_DIARY_VERSION_KEY));
      expect(res.body.message).toContain('Your Personal Diary');
    }
    // Not reported as a wrong password or a corrupt file, no session was created, nothing was rewritten.
    expect(t('en', NEWER_DIARY_VERSION_KEY)).toBe('This diary was written by a newer version of Your Personal Diary. Please update the app.');
    expect(second.auth.listSessions(account.id)).toEqual([]);
    expect(second.auth.vaults.size).toBe(0);
    expect(fs.readFileSync(file).equals(bytesBefore)).toBe(true);
    expect(fs.readdirSync(path.dirname(file)).sort()).toEqual(listingBefore);
    // The wrong password is still answered as a wrong password.
    const wrong = await second.app.anon().post('/api/auth/login').send({ username: 'dana', password: 'Wrong12345' });
    expect(wrong.status).toBe(401);
  });

  it('a remember-me session cannot open it either (409, the session and the file stay)', async () => {
    const first = await boot();
    const reg = await first.app.anon().post('/api/auth/register').send({
      firstName: 'Ron',
      lastName: 'Levi',
      username: 'ron',
      email: 'ron@example.com',
      password: PASSWORD,
      confirmPassword: PASSWORD,
      rememberMe: true,
    });
    expect(reg.status).toBe(201);
    const token: string = reg.body.token;
    const ctx = (await first.auth.authenticate(token))!;
    bumpSchema(ctx.db);
    const file = vaultPathOf(first.config, ctx.account);
    await first.auth.shutdown();
    services.splice(services.indexOf(first.auth), 1);
    const bytesBefore = fs.readFileSync(file);

    const second = await boot(first.dataDir);
    const res = await second.as(token).get('/api/entries').set('Accept-Language', 'en');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ code: 'DB', message: t('en', NEWER_DIARY_VERSION_KEY) });
    expect(fs.readFileSync(file).equals(bytesBefore)).toBe(true);
  });
});

describe('restoring a backup made by a newer version', () => {
  it('answers 400 BACKUP with the "update the app" message and keeps the current diary', async () => {
    const { auth, as, register } = await boot();
    const newer = await register('newer');
    const current = await register('current');
    // "newer" holds a diary of a newer schema; its backup is what an updated phone would produce.
    expect((await as(newer).post('/api/entries', sampleEntry({ title: 'from the future' }))).status).toBe(201);
    const newerCtx = (await auth.authenticate(newer))!;
    bumpSchema(newerCtx.db);
    const backup = await as(newer)
      .post('/api/backup/create', {})
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(backup.status).toBe(200);
    const fileBase64 = (backup.body as Buffer).toString('base64');

    expect((await as(current).post('/api/entries', sampleEntry({ title: 'mine' }))).status).toBe(201);
    for (const lang of ['en', 'he', 'ja'] as const) {
      const res = await as(current).post('/api/backup/restore', { fileBase64, password: PASSWORD }).set('Accept-Language', lang);
      expect({ lang, status: res.status, code: res.body.code }).toEqual({ lang, status: 400, code: 'BACKUP' });
      expect(res.body.message).toBe(t(lang, 'server.error.backup', { message: t(lang, NEWER_BACKUP_VERSION_KEY) }));
      expect(res.body.message).toContain('Your Personal Diary');
    }
    expect(t('en', NEWER_BACKUP_VERSION_KEY)).toBe('This backup was made by a newer version of Your Personal Diary. Please update the app.');
    // The diary of the account that tried to restore is unchanged.
    const entries = await as(current).get('/api/entries');
    expect(entries.body.items.map((e: { title: string }) => e.title)).toEqual(['mine']);
    const currentCtx = (await auth.authenticate(current))!;
    expect(currentVersion(currentCtx.db)).toBe(SCHEMA_VERSION);
    // A wrong backup password is still reported as such, a damaged file as corrupt.
    const wrongPw = await as(current).post('/api/backup/restore', { fileBase64, password: 'Nope12345' });
    expect(wrongPw.body.code).toBe('WRONG_PASSWORD');
  });

  it('restoreBackup throws the keyed error before the vault is touched', async () => {
    const { auth, as, register } = await boot();
    const token = await register('solo');
    const ctx = (await auth.authenticate(token))!;
    expect((await as(token).post('/api/entries', sampleEntry({ title: 'kept' }))).status).toBe(201);
    const good = (await as(token)
      .post('/api/backup/create', {})
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })).body as Buffer;
    bumpSchema(ctx.db);
    const newer = (await as(token)
      .post('/api/backup/create', {})
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })).body as Buffer;
    ctx.db.run('DELETE FROM schema_version WHERE version > ?', [SCHEMA_VERSION]);

    const dbBefore = ctx.vault.db;
    const error = await restoreBackup(ctx.vault, newer, PASSWORD).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'BACKUP' });
    expect((error as ApiError).messageFor('en')).toContain(t('en', NEWER_BACKUP_VERSION_KEY));
    expect(ctx.vault.db).toBe(dbBefore);
    // A backup of the current version still restores.
    await expect(restoreBackup(ctx.vault, good, PASSWORD)).resolves.toMatchObject({ entries: 1 });
  });
});

describe('the messages', () => {
  it('exist in all 20 languages, translated, with the brand in English', () => {
    expect(LOCALE_CODES).toHaveLength(20);
    for (const key of [NEWER_DIARY_VERSION_KEY, NEWER_BACKUP_VERSION_KEY]) {
      const english = t('en', key);
      for (const locale of LOCALE_CODES) {
        const message = t(locale, key);
        expect({ locale, key, hasBrand: message.includes('Your Personal Diary') }).toEqual({ locale, key, hasBrand: true });
        expect(message).not.toBe(key);
        if (locale !== 'en') expect({ locale, key, translated: message !== english }).toEqual({ locale, key, translated: true });
      }
    }
  });
});
