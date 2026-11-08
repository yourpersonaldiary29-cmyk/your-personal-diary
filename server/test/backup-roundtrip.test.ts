import fs from 'node:fs';
import path from 'node:path';
import type { Response } from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { backupFileName } from '@shared/constants';
import { createBackupBytes, inspectBackup, MAX_BACKUP_BYTES, readBackupSource, restoreBackup } from '../src/backup/backup';
import { DiaryDb } from '../src/db/database';
import { createAuthService, DiaryAuthService } from '../src/security/auth-service';
import { decryptWithPassword, isContainer, parseHeader } from '../src/security/container';
import type { AuthContext, AuthService } from '../src/security/session-types';
import { todayIso } from '../src/util/dates';
import { cleanupTempDirs, makeTestApp, tempDataDir, testConfig, type TestApp } from './helpers';

afterAll(cleanupTempDirs);

const FAST = { N: 2048, r: 8, p: 1 };
const PASSWORD = 'Passw0rd!';
const services: AuthService[] = [];

afterEach(async () => {
  for (const s of services.splice(0)) await s.shutdown();
});

async function setup() {
  const dataDir = tempDataDir();
  const config = testConfig(dataDir);
  const auth = (await createAuthService(config, { kdf: FAST })) as DiaryAuthService;
  services.push(auth);
  const app = await makeTestApp({ auth, config });
  const reg = await app.anon().post('/api/auth/register').send({
    firstName: 'דנה',
    lastName: 'כהן',
    username: 'dana',
    email: 'dana@example.com',
    password: PASSWORD,
    confirmPassword: PASSWORD,
  });
  expect(reg.status).toBe(201);
  const token: string = reg.body.token;
  const ctx = (await auth.authenticate(token))!;
  const api = {
    post: (url: string, body?: object) => app.anon().post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
  };
  return { app, auth, config, dataDir, token, ctx, api };
}

function insertEntry(db: DiaryDb, date: string, title: string): void {
  db.run(`INSERT INTO entries(date, time, title, body, created_at, updated_at) VALUES (?, '10:00', ?, '', 'x', 'x')`, [date, title]);
}

function seed(ctx: AuthContext, n: number): void {
  for (let i = 0; i < n; i++) insertEntry(ctx.db, `2026-09-0${(i % 9) + 1}`, `רשומה ${i + 1}`);
  ctx.db.run(`INSERT INTO habits(name, created_at) VALUES ('מים', 'x')`);
  ctx.db.run(`INSERT INTO habits(name, created_at) VALUES ('הליכה', 'x')`);
}

function count(db: DiaryDb, table: string): number {
  return Number(db.scalar<number>(`SELECT COUNT(*) FROM ${table}`));
}

/** supertest: collect a binary body. */
function binary(res: Response, cb: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

describe('backup module', () => {
  it('creates a container with the account key that decrypts with the account password', async () => {
    const { ctx } = await setup();
    seed(ctx, 3);
    const bytes = await createBackupBytes(ctx.vault, ctx.account);
    expect(isContainer(bytes)).toBe(true);
    expect(parseHeader(bytes).salt.toString('hex')).toBe(ctx.account.kdf.saltHex);
    const opened = await decryptWithPassword(bytes, PASSWORD);
    expect(opened.key.equals(ctx.vault.getKey())).toBe(true);
    const db = await DiaryDb.fromImage(opened.plain);
    expect(count(db, 'entries')).toBe(3);
    expect(count(db, 'habits')).toBe(2);
    // Foreign keys still enforced on the live DB after the export.
    expect(ctx.db.scalar<number>('PRAGMA foreign_keys')).toBe(1);
  });

  it('creates a container with a different password (fresh salt and key)', async () => {
    const { ctx } = await setup();
    seed(ctx, 2);
    const bytes = await createBackupBytes(ctx.vault, ctx.account, 'Backup2026');
    expect(parseHeader(bytes).salt.toString('hex')).not.toBe(ctx.account.kdf.saltHex);
    const opened = await decryptWithPassword(bytes, 'Backup2026');
    expect(opened.key.equals(ctx.vault.getKey())).toBe(false);
    expect(count(await DiaryDb.fromImage(opened.plain), 'entries')).toBe(2);
    await expect(decryptWithPassword(bytes, PASSWORD)).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
    await expect(createBackupBytes(ctx.vault, ctx.account, 'weak')).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
  });

  it('inspects files without decrypting them', async () => {
    const { ctx } = await setup();
    const good = inspectBackup(await createBackupBytes(ctx.vault, ctx.account), 'he');
    expect(good.valid).toBe(true);
    expect(good.version).toBe(1);
    expect(good.sizeBytes).toBeGreaterThan(49);
    expect(good.description).toMatch(/[֐-׿]/);
    const bad = inspectBackup(Buffer.from('this is not a backup file at all, sorry'.repeat(3)), 'he');
    expect(bad.valid).toBe(false);
    expect(bad.version).toBeNull();
    expect(bad.description).toMatch(/[֐-׿]/);
    const huge = inspectBackup(Buffer.alloc(MAX_BACKUP_BYTES + 1));
    expect(huge.valid).toBe(false);
    const badParams = await createBackupBytes(ctx.vault, ctx.account);
    badParams.writeUInt32LE(1 << 30, 9);
    expect(inspectBackup(badParams).valid).toBe(false);
  });

  it('restores: the diary is replaced and re-encrypted with the ACCOUNT key', async () => {
    const { ctx, config, auth, token } = await setup();
    seed(ctx, 5);
    const backup = await createBackupBytes(ctx.vault, ctx.account, 'Backup2026');
    ctx.db.run('DELETE FROM entries');
    ctx.db.run('DELETE FROM habits');
    insertEntry(ctx.db, '2026-12-31', 'יימחק בשחזור');
    await ctx.vault.persist();

    await expect(restoreBackup(ctx.vault, backup, 'WrongPass1')).rejects.toMatchObject({ code: 'WRONG_PASSWORD', status: 400 });
    await expect(restoreBackup(ctx.vault, Buffer.from('nope nope nope nope nope nope nope nope nope nope'), 'x1234567')).rejects.toMatchObject({
      code: 'BACKUP',
    });
    await expect(restoreBackup(ctx.vault, Buffer.alloc(MAX_BACKUP_BYTES + 1), 'x1234567')).rejects.toMatchObject({ code: 'BACKUP' });
    await expect(restoreBackup(ctx.vault, backup, '')).rejects.toMatchObject({ code: 'VALIDATION' });

    const info = await restoreBackup(ctx.vault, backup, 'Backup2026');
    expect(info).toMatchObject({ entries: 5, habits: 2 });
    expect(Date.parse(info.restoredAt)).not.toBeNaN();
    // The context's db is the old handle; fresh requests see the new one.
    const fresh = (await auth.authenticate(token))!;
    expect(count(fresh.db, 'entries')).toBe(5);
    expect(fresh.db.scalar<number>('SELECT COUNT(*) FROM entries WHERE title = ?', ['יימחק בשחזור'])).toBe(0);
    // On disk: encrypted with the account password, not the backup password.
    const onDisk = fs.readFileSync(path.join(config.usersDir, ctx.account.dbFile));
    const opened = await decryptWithPassword(onDisk, PASSWORD);
    expect(count(await DiaryDb.fromImage(opened.plain), 'entries')).toBe(5);
    await expect(decryptWithPassword(onDisk, 'Backup2026')).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
  });

  it('rejects a container whose plaintext is not a SQLite database', async () => {
    const { ctx } = await setup();
    const { encryptContainer } = await import('../src/security/container');
    const { deriveSecret, splitSecret, newSalt } = await import('../src/security/kdf');
    const salt = newSalt();
    const key = splitSecret(await deriveSecret('Backup2026', salt, FAST)).key;
    const bogus = encryptContainer(Buffer.from('not sqlite'.repeat(50)), key, salt, FAST);
    await expect(restoreBackup(ctx.vault, bogus, 'Backup2026')).rejects.toMatchObject({ code: 'BACKUP' });
    expect(count(ctx.db, 'entries')).toBe(0); // untouched
  });

  it('reads sources from a path (local only) or Base64', () => {
    const dir = tempDataDir();
    const file = path.join(dir, 'b.mpd');
    fs.writeFileSync(file, Buffer.from('abc'));
    expect(readBackupSource({ srcPath: file }, true).toString()).toBe('abc');
    expect(() => readBackupSource({ srcPath: file }, false)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(() => readBackupSource({ srcPath: 'relative.mpd' }, true)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(() => readBackupSource({ srcPath: path.join(dir, 'missing.mpd') }, true)).toThrow(expect.objectContaining({ code: 'BACKUP' }));
    expect(() => readBackupSource({ srcPath: dir }, true)).toThrow(expect.objectContaining({ code: 'BACKUP' }));
    expect(readBackupSource({ fileBase64: Buffer.from('xyz').toString('base64') }, false).toString()).toBe('xyz');
    expect(readBackupSource({ fileBase64: 'data:application/octet-stream;base64,' + Buffer.from('xyz').toString('base64') }, false).toString()).toBe('xyz');
    expect(() => readBackupSource({ fileBase64: '!!!' }, false)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(() => readBackupSource({}, true)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });
});

describe('backup routes', () => {
  it('create (destPath) -> inspect -> restore round trip through HTTP', async () => {
    const { ctx, api, auth, token } = await setup();
    seed(ctx, 4);
    const dest = path.join(tempDataDir(), 'out', 'my.mpd');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const created = await api.post('/api/backup/create', { destPath: dest });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ path: dest, fileName: 'my.mpd' });
    expect(created.body.sizeBytes).toBe(fs.statSync(dest).size);
    expect(Date.parse(created.body.createdAt)).not.toBeNaN();
    expect(fs.existsSync(`${dest}.tmp`)).toBe(false);

    const inspected = await api.post('/api/backup/inspect', { srcPath: dest });
    expect(inspected.status).toBe(200);
    expect(inspected.body.valid).toBe(true);
    expect(inspected.body.version).toBe(1);

    ctx.db.run('DELETE FROM entries');
    const wrong = await api.post('/api/backup/restore', { srcPath: dest, password: 'Nope12345' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('WRONG_PASSWORD');
    const noPw = await api.post('/api/backup/restore', { srcPath: dest });
    expect(noPw.status).toBe(400);
    expect(noPw.body.field).toBe('password');

    const restored = await api.post('/api/backup/restore', { srcPath: dest, password: PASSWORD });
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ entries: 4, habits: 2 });
    const fresh = (await auth.authenticate(token))!;
    expect(count(fresh.db, 'entries')).toBe(4);

    const missingDir = await api.post('/api/backup/create', { destPath: path.join(tempDataDir(), 'nope', 'x.mpd') });
    expect(missingDir.status).toBe(500);
    expect(missingDir.body.code).toBe('IO');
    const relative = await api.post('/api/backup/create', { destPath: 'relative.mpd' });
    expect(relative.status).toBe(400);
  });

  it('create without destPath streams the file; restore accepts it as Base64 with a different password', async () => {
    const { ctx, api, auth, token } = await setup();
    seed(ctx, 2);
    const res = await api
      .post('/api/backup/create', { password: 'Backup2026' })
      .buffer(true)
      .parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/octet-stream');
    const expectedName = backupFileName('dana', todayIso());
    expect(res.headers['content-disposition']).toContain(`filename="${expectedName}"`);
    expect(res.headers['content-disposition']).toContain(`filename*=UTF-8''${encodeURIComponent(expectedName)}`);
    const bytes = res.body as Buffer;
    expect(isContainer(bytes)).toBe(true);
    expect(Number(res.headers['content-length'])).toBe(bytes.length);

    const inspected = await api.post('/api/backup/inspect', { fileBase64: bytes.toString('base64'), fileName: expectedName });
    expect(inspected.body.valid).toBe(true);

    ctx.db.run('DELETE FROM entries');
    const withAccountPw = await api.post('/api/backup/restore', { fileBase64: bytes.toString('base64'), password: PASSWORD });
    expect(withAccountPw.status).toBe(400);
    expect(withAccountPw.body.code).toBe('WRONG_PASSWORD');
    const restored = await api.post('/api/backup/restore', { fileBase64: bytes.toString('base64'), password: 'Backup2026' });
    expect(restored.status).toBe(200);
    expect(restored.body.entries).toBe(2);
    expect(count((await auth.authenticate(token))!.db, 'entries')).toBe(2);
    // The account password is unchanged after restoring a backup made with another password.
    expect((await api.post('/api/auth/verify-password', { password: PASSWORD })).body).toEqual({ ok: true });

    const garbage = await api.post('/api/backup/inspect', { fileBase64: Buffer.from('garbage garbage garbage garbage garbage garbage garbage').toString('base64') });
    expect(garbage.status).toBe(200);
    expect(garbage.body.valid).toBe(false);
    const nothing = await api.post('/api/backup/inspect', {});
    expect(nothing.status).toBe(400);
    expect(nothing.body.code).toBe('VALIDATION');
  });

  it('requires authentication', async () => {
    const { app } = await setup();
    const res = await (app as TestApp).anon().post('/api/backup/create').send({});
    expect(res.status).toBe(401);
  });
});
