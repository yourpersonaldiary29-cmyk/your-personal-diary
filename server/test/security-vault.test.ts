import fs from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { DiaryDb } from '../src/db/database';
import { decryptContainer, decryptWithPassword, parseHeader } from '../src/security/container';
import { deriveSecret, splitSecret } from '../src/security/kdf';
import type { AccountRecord } from '../src/security/session-types';
import { createVault, DiaryVault, exportImage, openVault, VaultRegistry, vaultPathOf } from '../src/security/vault';
import { cleanupTempDirs, TEST_ACCOUNT, testConfig } from './helpers';

afterAll(cleanupTempDirs);

const KEY = Buffer.alloc(32, 7);
const FAST = { N: 1024, r: 8, p: 1 };

function account(id: string, overrides: Partial<AccountRecord> = {}): AccountRecord {
  return { ...TEST_ACCOUNT, id, dbFile: `${id}.mpd`, kdf: { ...TEST_ACCOUNT.kdf, ...FAST }, ...overrides };
}

async function waitFor(pred: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`condition not met within ${timeoutMs}ms`);
}

function insertEntry(db: DiaryDb, date: string, title: string): void {
  db.run(
    `INSERT INTO entries(date, time, title, body, created_at, updated_at) VALUES (?, ?, ?, '', ?, ?)`,
    [date, '10:00', title, '2026-09-08T10:00:00.000Z', '2026-09-08T10:00:00.000Z'],
  );
}

function countEntries(db: DiaryDb): number {
  return Number(db.scalar<number>('SELECT COUNT(*) FROM entries'));
}

describe('DiaryVault', () => {
  it('creates an encrypted empty diary that opens again with the key', async () => {
    const config = testConfig();
    const acc = account('u_v1');
    const vault = await createVault(config, acc, KEY);
    const file = vaultPathOf(config, acc);
    expect(vault.dbPath).toBe(file);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
    const header = parseHeader(fs.readFileSync(file));
    expect(header.kdf).toEqual(FAST);
    expect(header.salt.toString('hex')).toBe(acc.kdf.saltHex);
    expect(countEntries(vault.db)).toBe(0);
    await vault.close();

    const again = await openVault(config, acc, KEY);
    expect(countEntries(again.db)).toBe(0);
    await again.close();
    await expect(createVault(config, acc, KEY)).rejects.toMatchObject({ code: 'IO' });
    await expect(openVault(config, acc, Buffer.alloc(32, 1))).rejects.toMatchObject({ code: 'CRYPTO' });
    await expect(openVault(config, account('u_missing'), KEY)).rejects.toMatchObject({ code: 'IO' });
  });

  it('persists after a write within ~1s, and the row is visible when reopened with the key', async () => {
    const config = testConfig();
    const acc = account('u_v2');
    const vault = await createVault(config, acc, KEY);
    const file = vaultPathOf(config, acc);
    const before = fs.readFileSync(file);
    const t0 = Date.now();
    insertEntry(vault.db, '2026-09-08', 'ראשון');
    expect(vault.db.isDirty()).toBe(true);
    // During the atomic swap (main -> .prev, tmp -> main) the main file is briefly absent on
    // Windows; a poll that lands in that window simply tries again.
    const changedOnDisk = () => {
      try {
        return !fs.readFileSync(file).equals(before);
      } catch {
        return false;
      }
    };
    await waitFor(changedOnDisk, 1500);
    expect(Date.now() - t0).toBeLessThan(1500);
    await waitFor(() => !vault.db.isDirty());
    expect(fs.existsSync(`${file}.prev`)).toBe(true);
    expect(decryptContainer(fs.readFileSync(`${file}.prev`), KEY).plain.equals(decryptContainer(before, KEY).plain)).toBe(true);

    const reopened = await openVault(config, acc, KEY);
    expect(countEntries(reopened.db)).toBe(1);
    expect(reopened.db.scalar<string>('SELECT title FROM entries')).toBe('ראשון');
    await reopened.close();
    await vault.close();
  });

  it('coalesces a burst of writes into one persist and flushes on close', async () => {
    const config = testConfig();
    const acc = account('u_v3');
    const vault = await createVault(config, acc, KEY);
    const file = vaultPathOf(config, acc);
    const sizeBefore = fs.statSync(file).size;
    for (let i = 0; i < 20; i++) insertEntry(vault.db, '2026-09-01', `רשומה ${i}`);
    // Nothing written synchronously.
    expect(fs.statSync(file).size).toBe(sizeBefore);
    await waitFor(() => !vault.db.isDirty());
    // Exactly one write happened: .prev is the original empty DB.
    expect(countEntries(await DiaryDb.fromImage(decryptContainer(fs.readFileSync(`${file}.prev`), KEY).plain))).toBe(0);
    insertEntry(vault.db, '2026-09-02', 'אחרון');
    await vault.close();
    expect(vault.isClosed).toBe(true);
    const reopened = await openVault(config, acc, KEY);
    expect(countEntries(reopened.db)).toBe(21);
    await reopened.close();
    // Closed vaults refuse to hand out the key.
    expect(() => vault.getKey()).toThrow();
  });

  it('keeps foreign keys enforced after persisting (sql.js export resets PRAGMAs)', async () => {
    const config = testConfig();
    const vault = await createVault(config, account('u_v4'), KEY);
    const db = vault.db;
    const { lastId } = db.run(`INSERT INTO habits(name, created_at) VALUES ('מים', '2026-09-08T00:00:00.000Z')`);
    db.run(`INSERT INTO habit_logs(habit_id, date, value, completed) VALUES (?, '2026-09-08', 3, 0)`, [lastId]);
    await vault.persist();
    exportImage(db);
    db.run('DELETE FROM habits WHERE id = ?', [lastId]);
    expect(Number(db.scalar<number>('SELECT COUNT(*) FROM habit_logs'))).toBe(0);
    await vault.close();
  });

  it('rekeys immediately with new header parameters so the file opens with the new password only', async () => {
    const config = testConfig();
    const acc = account('u_v5');
    const oldSalt = Buffer.from(acc.kdf.saltHex, 'hex');
    const oldKey = splitSecret(await deriveSecret('OldPass123', oldSalt, FAST)).key;
    const vault = await createVault(config, acc, oldKey);
    insertEntry(vault.db, '2026-09-08', 'לפני');
    const file = vaultPathOf(config, acc);
    const newSalt = Buffer.alloc(16, 0x33);
    const newKey = splitSecret(await deriveSecret('NewPass456', newSalt, FAST)).key;
    await vault.rekey(newKey, { salt: newSalt, kdf: FAST });
    expect(vault.getKey().equals(newKey)).toBe(true);
    const bytes = fs.readFileSync(file);
    expect(parseHeader(bytes).salt.equals(newSalt)).toBe(true);
    const opened = await decryptWithPassword(bytes, 'NewPass456');
    expect(countEntries(await DiaryDb.fromImage(opened.plain))).toBe(1);
    await expect(decryptWithPassword(bytes, 'OldPass123')).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
    expect(() => decryptContainer(bytes, oldKey)).toThrow(expect.objectContaining({ code: 'CRYPTO' }));
    // Later writes keep using the new key.
    insertEntry(vault.db, '2026-09-09', 'אחרי');
    await vault.close();
    const reopened = await openVault(config, { ...acc, kdf: { ...acc.kdf, saltHex: newSalt.toString('hex') } }, newKey);
    expect(countEntries(reopened.db)).toBe(2);
    await reopened.close();
  });

  it('replaces the database (restore) and persists the new one under the same key', async () => {
    const config = testConfig();
    const acc = account('u_v6');
    const vault = await createVault(config, acc, KEY);
    insertEntry(vault.db, '2026-09-08', 'ישן');
    await vault.persist();
    const fresh = await DiaryDb.create();
    insertEntry(fresh, '2026-01-01', 'משוחזר 1');
    insertEntry(fresh, '2026-01-02', 'משוחזר 2');
    const oldDb = vault.db;
    await vault.replaceDatabase(fresh);
    expect(vault.db).toBe(fresh);
    expect(vault.db).not.toBe(oldDb);
    expect(countEntries(vault.db)).toBe(2);
    const onDisk = await DiaryDb.fromImage(decryptContainer(fs.readFileSync(vault.dbPath), KEY).plain);
    expect(countEntries(onDisk)).toBe(2);
    // Writes to the new DB keep persisting.
    insertEntry(vault.db, '2026-01-03', 'משוחזר 3');
    await waitFor(() => !vault.db.isDirty());
    const reopened = await openVault(config, acc, KEY);
    expect(countEntries(reopened.db)).toBe(3);
    await reopened.close();
    await vault.close();
  });

  it('recovers from .prev when the main file is missing or unreadable', async () => {
    const config = testConfig();
    const acc = account('u_v7');
    const vault = await createVault(config, acc, KEY);
    insertEntry(vault.db, '2026-09-08', 'שמור');
    await vault.persist();
    insertEntry(vault.db, '2026-09-09', 'שמור 2');
    await vault.persist();
    await vault.close();
    const file = vaultPathOf(config, acc);
    // Simulate a crash between the two renames: main gone, .prev intact.
    fs.rmSync(file);
    const fromPrev = await openVault(config, acc, KEY);
    expect(countEntries(fromPrev.db)).toBe(1);
    await fromPrev.close();
    // Garbage main file, good .prev.
    fs.writeFileSync(file, Buffer.from('garbage'));
    const fromPrev2 = await openVault(config, acc, KEY);
    expect(countEntries(fromPrev2.db)).toBe(1);
    await fromPrev2.close();
  });
});

describe('VaultRegistry', () => {
  it('shares one vault per user, counts references and closes at zero', async () => {
    const config = testConfig();
    const acc = account('u_r1');
    const registry = new VaultRegistry();
    let opens = 0;
    const opener = async () => {
      opens++;
      return DiaryVault.create(config, acc, KEY);
    };
    const [a, b] = await Promise.all([registry.acquire(acc, opener), registry.acquire(acc, opener)]);
    expect(opens).toBe(1);
    expect(a).toBe(b);
    expect(a.refCount).toBe(2);
    expect(registry.get(acc.id)).toBe(a);
    expect(registry.size).toBe(1);

    insertEntry(a.db, '2026-09-08', 'x');
    await registry.release(acc.id);
    expect(a.refCount).toBe(1);
    expect(a.isClosed).toBe(false);
    await registry.release(acc.id);
    expect(a.isClosed).toBe(true);
    expect(registry.get(acc.id)).toBeNull();
    // Flushed before closing.
    const reopened = await openVault(config, acc, KEY);
    expect(countEntries(reopened.db)).toBe(1);
    await reopened.close();
    await registry.release(acc.id); // no-op
  });

  it('closeAll flushes every open vault', async () => {
    const config = testConfig();
    const registry = new VaultRegistry();
    const a1 = account('u_r2');
    const a2 = account('u_r3');
    const v1 = await registry.acquire(a1, () => DiaryVault.create(config, a1, KEY));
    const v2 = await registry.acquire(a2, () => DiaryVault.create(config, a2, KEY));
    insertEntry(v1.db, '2026-09-08', 'a');
    insertEntry(v2.db, '2026-09-08', 'b');
    await registry.closeAll();
    expect(registry.size).toBe(0);
    for (const acc of [a1, a2]) {
      const v = await openVault(config, acc, KEY);
      expect(countEntries(v.db)).toBe(1);
      await v.close();
    }
  });
});
