// @vitest-environment node
/**
 * Containers across the two platforms, byte for byte.
 *
 *   desktop -> phone   the fixtures (mobile/test/fixtures) were written by the REAL server modules
 *                      under Node.js (scripts/mobile/make-fixtures.mjs): a data directory with an
 *                      encrypted diary, a backup with the account password, a backup with its own
 *                      password, the wrapped keys of "remember me" and of password recovery, an
 *                      encrypted SMTP password. Here the same server modules run on the mobile
 *                      shims (@noble scrypt / AES-GCM, the Buffer polyfill, the sql.js browser
 *                      build) and must read exactly the bytes the desktop wrote.
 *   phone -> desktop   containers produced through the shims are opened by the server modules
 *                      running on Node (node:crypto, the Node build of sql.js).
 *
 * The modules imported at the top are the shimmed ones (the mobile vitest config applies the alias
 * plugin); `native` loads the same sources under Node.
 */
import nodeCrypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as backup from '../../../server/src/backup/backup';
import { DiaryDb } from '../../../server/src/db/database';
import { createEntry, listEntriesFull, validateEntryInput } from '../../../server/src/db/entries-repo';
import * as mailSettings from '../../../server/src/mail/settings';
import * as container from '../../../server/src/security/container';
import * as deviceKeyModule from '../../../server/src/security/device-key';
import * as kdf from '../../../server/src/security/kdf';
import type { AccountRecord, UserVault } from '../../../server/src/security/session-types';
import { hashToken } from '../../../server/src/security/sessions';
import { exportImage } from '../../../server/src/security/vault';
import { Buffer as PolyfillBuffer } from '../../core/shims/buffer';
import * as shimCrypto from '../../core/shims/crypto';
import { provideSqlWasm } from '../../core/shims/sqljs';
import { fixtureBytes, loadManifest, sqlWasmBytes, type FixtureManifest } from './fixtures';
import { openNativeServer, type NativeServer } from './native-server';

type ShimBuffer = InstanceType<typeof PolyfillBuffer>;

interface NativeModules {
  backup: typeof backup;
  container: typeof container;
  deviceKey: typeof deviceKeyModule;
  kdf: typeof kdf;
  mailSettings: typeof mailSettings;
  database: { DiaryDb: typeof DiaryDb };
  entries: { listEntriesFull: typeof listEntriesFull };
}

const manifest: FixtureManifest = loadManifest();
let native: NativeServer;
let node: NativeModules;

/** A fixture as the core would hold it: a Buffer of the polyfill. */
function shimBytes(relative: string): ShimBuffer {
  return PolyfillBuffer.from(fixtureBytes(relative));
}

function nodeSha256(bytes: Uint8Array): string {
  return nodeCrypto.createHash('sha256').update(bytes).digest('hex');
}

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('hex');
}

/** The part of a vault backup / restore uses. */
function fakeVault<TDb>(db: TDb, key: Uint8Array, makeBuffer: (bytes: Uint8Array) => Buffer): UserVault & { replaced: TDb | null } {
  const vault = {
    userId: manifest.account.id,
    dbPath: '',
    db,
    refCount: 1,
    replaced: null as TDb | null,
    persist: async () => undefined,
    rekey: async () => undefined,
    getKey: () => makeBuffer(key),
    replaceDatabase: async (next: TDb) => {
      vault.replaced = next;
    },
    close: async () => undefined,
  };
  return vault as unknown as UserVault & { replaced: TDb | null };
}

function accountRecord(): AccountRecord {
  const accounts = JSON.parse(fixtureBytes(manifest.files.accounts).toString('utf8')) as { accounts: AccountRecord[] };
  const record = accounts.accounts.find((a) => a.id === manifest.account.id);
  if (!record) throw new Error('the fixture account is missing from accounts.json');
  return record;
}

beforeAll(async () => {
  provideSqlWasm(sqlWasmBytes());
  native = await openNativeServer();
  const [nodeBackup, nodeContainer, nodeDeviceKey, nodeKdf, nodeMail, nodeDatabase, nodeEntries] = await Promise.all([
    native.load<typeof backup>('backup/backup'),
    native.load<typeof container>('security/container'),
    native.load<typeof deviceKeyModule>('security/device-key'),
    native.load<typeof kdf>('security/kdf'),
    native.load<typeof mailSettings>('mail/settings'),
    native.load<{ DiaryDb: typeof DiaryDb }>('db/database'),
    native.load<{ listEntriesFull: typeof listEntriesFull }>('db/entries-repo'),
  ]);
  node = { backup: nodeBackup, container: nodeContainer, deviceKey: nodeDeviceKey, kdf: nodeKdf, mailSettings: nodeMail, database: nodeDatabase, entries: nodeEntries };
}, 120_000);

afterAll(async () => {
  await native?.close();
});

describe('the fixtures are what the generator wrote', () => {
  it('every file has the digest recorded in the manifest', () => {
    expect(nodeSha256(fixtureBytes(manifest.files.diary))).toBe(manifest.diary.fileSha256);
    expect(nodeSha256(fixtureBytes(manifest.files.backupAccountPassword))).toBe(manifest.backups.accountPassword.fileSha256);
    expect(nodeSha256(fixtureBytes(manifest.files.backupOwnPassword))).toBe(manifest.backups.ownPassword.fileSha256);
    expect(fixtureBytes(manifest.files.deviceKey).toString('hex')).toBe(manifest.deviceKeyHex);
    expect(accountRecord().verifierHex).toBe(manifest.account.verifierHex);
  });

  it('the modules imported here run on the shims, the native ones on Node', () => {
    expect(container.CONTAINER_MAGIC).toBeInstanceOf(PolyfillBuffer);
    expect(Buffer.isBuffer(container.CONTAINER_MAGIC)).toBe(false);
    expect(Buffer.isBuffer(node.container.CONTAINER_MAGIC)).toBe(true);
    expect(kdf.newSalt()).toBeInstanceOf(PolyfillBuffer);
  });

  it('the phone runs the same SQLite: the WebAssembly binary of the browser build is identical to the desktop one', () => {
    const dist = path.join(process.cwd(), 'server', 'node_modules', 'sql.js', 'dist');
    expect(nodeSha256(fs.readFileSync(path.join(dist, 'sql-wasm-browser.wasm')))).toBe(nodeSha256(fs.readFileSync(path.join(dist, 'sql-wasm.wasm'))));
  });
});

describe('desktop -> phone: files written under Node open through the mobile shims', () => {
  const account = manifest.account;
  let diaryKey: ShimBuffer;

  it('the account password derives the diary key and the verifier stored in accounts.json', async () => {
    const record = accountRecord();
    const secret = await kdf.deriveSecret(account.password, PolyfillBuffer.from(record.kdf.saltHex, 'hex'), { N: record.kdf.N, r: record.kdf.r, p: record.kdf.p });
    const { key, verifierSource } = kdf.splitSecret(secret);
    expect(kdf.verifierHex(verifierSource)).toBe(record.verifierHex);
    expect(kdf.safeEqualHex(kdf.verifierHex(verifierSource), record.verifierHex)).toBe(true);
    expect(hex(key)).toBe(manifest.diaryKeyHex);
    diaryKey = key;
  });

  it('a wrong password does not', async () => {
    const record = accountRecord();
    const secret = await kdf.deriveSecret(`${account.password} `, PolyfillBuffer.from(record.kdf.saltHex, 'hex'));
    expect(kdf.safeEqualHex(kdf.verifierHex(kdf.splitSecret(secret).verifierSource), record.verifierHex)).toBe(false);
  });

  it('the diary file (.mpd) decrypts with that key to exactly the SQLite image the desktop encrypted', () => {
    const file = shimBytes(manifest.files.diary);
    expect(container.isContainer(file)).toBe(true);
    const header = container.parseHeader(file);
    expect(header.version).toBe(1);
    expect(header.kdf).toEqual({ N: 32768, r: 8, p: 1 });
    expect(hex(header.salt)).toBe(account.kdf.saltHex);

    const { plain } = container.decryptContainer(file, diaryKey);
    expect(plain).toBeInstanceOf(PolyfillBuffer);
    expect(plain.length).toBe(manifest.diary.plainLength);
    expect(nodeSha256(plain)).toBe(manifest.diary.plainSha256);
    // The digest computed by the shim itself agrees.
    expect(kdf.sha256Hex(plain)).toBe(manifest.diary.plainSha256);
    expect(plain.subarray(0, 15).toString('latin1')).toBe('SQLite format 3');
  });

  it('and with the password alone (the header carries the salt and the scrypt parameters)', async () => {
    const opened = await container.decryptWithPassword(shimBytes(manifest.files.diary), account.password);
    expect(hex(opened.key)).toBe(manifest.diaryKeyHex);
    expect(nodeSha256(opened.plain)).toBe(manifest.diary.plainSha256);
    await expect(container.decryptWithPassword(shimBytes(manifest.files.diary), 'Wrong-Passw0rd')).rejects.toMatchObject({ status: 400, code: 'WRONG_PASSWORD' });
  });

  it('re-encrypting that image through the shims with the same key and nonce reproduces the file byte for byte', () => {
    const file = fixtureBytes(manifest.files.diary);
    const plain = container.decryptContainer(shimBytes(manifest.files.diary), diaryKey).plain;
    const headerBytes = file.subarray(0, container.HEADER_LENGTH);
    const nonce = file.subarray(37, 49);
    const cipher = shimCrypto.createCipheriv('aes-256-gcm', diaryKey, nonce, { authTagLength: 16 });
    cipher.setAAD(headerBytes);
    const rebuilt = PolyfillBuffer.concat([headerBytes, cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
    expect(rebuilt.length).toBe(file.length);
    expect(Buffer.from(rebuilt).equals(file)).toBe(true);
  });

  it('any changed byte of the file is detected', () => {
    const file = shimBytes(manifest.files.diary);
    for (const index of [9, 21, 37, 49, file.length - 17, file.length - 1]) {
      const damaged = PolyfillBuffer.from(file);
      damaged[index] ^= 0x01;
      expect(() => container.decryptContainer(damaged, diaryKey), `byte ${index}`).toThrow();
    }
  });

  it('the decrypted image opens in the sql.js browser build with the same rows the desktop wrote', async () => {
    const { plain } = container.decryptContainer(shimBytes(manifest.files.diary), diaryKey);
    const db = await DiaryDb.fromImage(plain);
    try {
      const entries = listEntriesFull(db, null, null);
      expect(entries).toHaveLength(manifest.content.entries);
      expect(Number(db.scalar<number>('SELECT COUNT(*) FROM habits'))).toBe(manifest.content.habits);
      expect(Number(db.scalar<number>('SELECT COUNT(*) FROM habit_logs'))).toBe(manifest.content.habitLogs);
      // Every field of every entry, as JSON: Hebrew, Arabic, Japanese, emoji, decomposed accents.
      expect(nodeSha256(Buffer.from(JSON.stringify(entries), 'utf8'))).toBe(manifest.content.entriesSha256);
      const last = entries.find((entry) => entry.title === manifest.content.lastEntry?.title);
      expect(last?.body).toBe(manifest.content.lastEntry?.body);
      expect(last?.notes).toBe(manifest.content.lastEntry?.notes);
      // Re-exported by the phone, the image is the one the desktop encrypted.
      expect(nodeSha256(exportImage(db))).toBe(manifest.diary.plainSha256);
    } finally {
      db.close();
    }
  });

  for (const [label, fixture, file] of [
    ['with the account password', manifest.backups.accountPassword, manifest.files.backupAccountPassword],
    ['with its own password', manifest.backups.ownPassword, manifest.files.backupOwnPassword],
  ] as const) {
    it(`the backup ${label} is recognised, decrypts and restores`, async () => {
      const bytes = shimBytes(file);
      const info = backup.inspectBackup(bytes, 'en');
      expect(info).toMatchObject({ valid: true, version: 1, sizeBytes: bytes.length });

      const opened = await container.decryptWithPassword(bytes, fixture.password);
      expect(opened.plain.length).toBe(fixture.plainLength);
      expect(nodeSha256(opened.plain)).toBe(fixture.plainSha256);

      const vault = fakeVault<DiaryDb>(await DiaryDb.create(), diaryKey, (b) => PolyfillBuffer.from(b));
      const restored = await backup.restoreBackup(vault, bytes, fixture.password);
      expect(restored).toMatchObject({ entries: manifest.content.entries, habits: manifest.content.habits });
      expect(vault.replaced).not.toBeNull();
      expect(nodeSha256(Buffer.from(JSON.stringify(listEntriesFull(vault.replaced as DiaryDb, null, null)), 'utf8'))).toBe(manifest.content.entriesSha256);

      await expect(backup.restoreBackup(vault, bytes, 'Not-the-Passw0rd')).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
    });
  }

  it('the two backups differ where they should: the account salt versus a fresh one', () => {
    const accountHeader = container.parseHeader(shimBytes(manifest.files.backupAccountPassword));
    const ownHeader = container.parseHeader(shimBytes(manifest.files.backupOwnPassword));
    expect(hex(accountHeader.salt)).toBe(account.kdf.saltHex);
    expect(hex(ownHeader.salt)).not.toBe(account.kdf.saltHex);
  });

  it('the base64 upload path of restore (what the phone sends) yields the same bytes', () => {
    const file = fixtureBytes(manifest.files.backupOwnPassword);
    const viaBase64 = backup.readBackupSource({ fileBase64: file.toString('base64') }, true);
    expect(viaBase64).toBeInstanceOf(PolyfillBuffer);
    expect(Buffer.from(viaBase64).equals(file)).toBe(true);
    const viaDataUrl = backup.readBackupSource({ fileBase64: `data:application/octet-stream;base64,${file.toString('base64')}` }, false);
    expect(Buffer.from(viaDataUrl).equals(file)).toBe(true);
  });

  it('device.key unwraps the recovery copy of the diary key (accounts.json), bound to the account id', () => {
    const deviceKey = shimBytes(manifest.files.deviceKey);
    expect(hex(deviceKeyModule.unwrapRecoveryKey(account.recoveryWrappedKey, deviceKey, account.id))).toBe(manifest.diaryKeyHex);
    expect(() => deviceKeyModule.unwrapRecoveryKey(account.recoveryWrappedKey, deviceKey, 'u_someone_else')).toThrow();
    const otherDevice = PolyfillBuffer.alloc(32, 1);
    expect(() => deviceKeyModule.unwrapRecoveryKey(account.recoveryWrappedKey, otherDevice, account.id)).toThrow();
  });

  it('device.key unwraps the "remember me" key of sessions.json, and the session token hashes to the stored hash', () => {
    const sessions = JSON.parse(fixtureBytes(manifest.files.sessions).toString('utf8')) as { sessions: Array<{ tokenHash: string; wrappedKeyBase64: string }> };
    expect(sessions.sessions).toHaveLength(1);
    const deviceKey = shimBytes(manifest.files.deviceKey);
    const wrapped = PolyfillBuffer.from(sessions.sessions[0].wrappedKeyBase64, 'base64');
    expect(wrapped.length).toBe(deviceKeyModule.WRAPPED_KEY_LENGTH);
    expect(hex(deviceKeyModule.unwrapKey(wrapped, deviceKey))).toBe(manifest.diaryKeyHex);
    expect(hashToken(manifest.session.token)).toBe(sessions.sessions[0].tokenHash);
    // A recovery blob is not a remember-me blob (different AAD).
    expect(() => deviceKeyModule.unwrapKey(PolyfillBuffer.from(account.recoveryWrappedKey, 'base64'), deviceKey)).toThrow();
  });

  it('device.key decrypts the SMTP password the desktop stored', () => {
    const deviceKey = shimBytes(manifest.files.deviceKey);
    expect(mailSettings.decryptSmtpPassword(manifest.mail.passwordEnc, deviceKey)).toBe(manifest.mail.password);
    expect(mailSettings.decryptSmtpPassword(manifest.mail.passwordEnc, PolyfillBuffer.alloc(32, 2))).toBeNull();
  });
});

describe('phone -> desktop: containers written through the mobile shims open under Node', () => {
  const password = 'Phone-Passw0rd טלפון ｍｏｂｉｌｅ 📱';
  const ENTRIES = [
    { date: '2026-09-28', time: '08:30', title: 'בוקר טוב', body: 'רשומה שנכתבה בטלפון. كتبت في الهاتف. 電話で書いた。', mood: 4, emotions: [], events: [], people: [], tags: ['phone'] },
    { date: '2026-09-29', time: '22:10', title: 'Café ☕', body: 'emoji 👩‍💻🇮🇱, full-width ｆｕｌｌ, NUL-free binary-ish text  ‏', mood: 2, emotions: [], events: [], people: [], tags: [] },
    { date: '2026-09-30', time: '00:00', title: '', body: 'ב'.repeat(20_000), emotions: [], events: [], people: [], tags: [] },
  ];
  let db: DiaryDb;
  let image: Uint8Array;
  let salt: ShimBuffer;
  let key: ShimBuffer;
  let file: ShimBuffer;

  beforeAll(async () => {
    db = await DiaryDb.create();
    for (const entry of ENTRIES) createEntry(db, validateEntryInput(entry));
    image = exportImage(db);
    salt = kdf.newSalt();
    const secret = await kdf.deriveSecret(password, salt);
    key = kdf.splitSecret(secret).key;
    file = container.encryptContainer(image, key, salt);
  }, 60_000);

  afterAll(() => {
    db?.close();
  });

  it('a diary encrypted on the phone opens on the desktop with the password, to the same image and rows', async () => {
    expect(file).toBeInstanceOf(PolyfillBuffer);
    const opened = await node.container.decryptWithPassword(Buffer.from(file), password);
    expect(opened.key.toString('hex')).toBe(hex(key));
    expect(opened.plain.equals(Buffer.from(image))).toBe(true);

    const desktopDb = await node.database.DiaryDb.fromImage(opened.plain);
    try {
      expect(node.entries.listEntriesFull(desktopDb, null, null)).toEqual(listEntriesFull(db, null, null));
    } finally {
      desktopDb.close();
    }
    await expect(node.container.decryptWithPassword(Buffer.from(file), 'Wrong-Passw0rd')).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
  });

  it('the file is byte for byte what node:crypto writes for the same key, salt, nonce and image', () => {
    const bytes = Buffer.from(file);
    const header = bytes.subarray(0, 49);
    expect(header.subarray(0, 8).toString('latin1')).toBe('MPDIARY\x01');
    expect(header[8]).toBe(1);
    expect([header.readUInt32LE(9), header.readUInt32LE(13), header.readUInt32LE(17)]).toEqual([32768, 8, 1]);
    expect(header.subarray(21, 37).toString('hex')).toBe(hex(salt));

    const cipher = nodeCrypto.createCipheriv('aes-256-gcm', Buffer.from(key), header.subarray(37, 49), { authTagLength: 16 });
    cipher.setAAD(header);
    const expected = Buffer.concat([header, cipher.update(image), cipher.final(), cipher.getAuthTag()]);
    expect(bytes.equals(expected)).toBe(true);
  });

  it('a backup made on the phone (account key, and its own password) restores on the desktop', async () => {
    const account: AccountRecord = { ...accountRecord(), kdf: { algorithm: 'scrypt', N: 32768, r: 8, p: 1, saltHex: hex(salt) } };
    const phoneVault = fakeVault<DiaryDb>(db, key, (b) => PolyfillBuffer.from(b));
    const ownPassword = 'Backup-0wn 备份 🗝';
    const withAccountKey = await backup.createBackupBytes(phoneVault, account);
    const withOwnPassword = await backup.createBackupBytes(phoneVault, account, ownPassword);
    await expect(backup.createBackupBytes(phoneVault, account, 'weak')).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });

    for (const [bytes, pw] of [
      [withAccountKey, password],
      [withOwnPassword, ownPassword],
    ] as const) {
      const onDesktop = Buffer.from(bytes);
      expect(node.backup.inspectBackup(onDesktop, 'en')).toMatchObject({ valid: true, version: 1 });
      const desktopVault = fakeVault(await node.database.DiaryDb.create(), key, (b) => Buffer.from(b));
      const restored = await node.backup.restoreBackup(desktopVault, onDesktop, pw);
      expect(restored).toMatchObject({ entries: ENTRIES.length, habits: 0 });
      expect(node.entries.listEntriesFull(desktopVault.replaced as never, null, null)).toEqual(listEntriesFull(db, null, null));
    }
  }, 60_000);

  it('keys wrapped on the phone (remember me, recovery) unwrap on the desktop, and the other way round', () => {
    const deviceKey = shimCrypto.randomBytes(32);
    const nodeDeviceKey = Buffer.from(deviceKey);
    const wrapped = deviceKeyModule.wrapKey(key, deviceKey);
    expect(wrapped.length).toBe(60);
    expect(node.deviceKey.unwrapKey(Buffer.from(wrapped), nodeDeviceKey).toString('hex')).toBe(hex(key));

    const recovery = deviceKeyModule.wrapRecoveryKey(key, deviceKey, 'u_phone');
    expect(node.deviceKey.unwrapRecoveryKey(recovery, nodeDeviceKey, 'u_phone').toString('hex')).toBe(hex(key));
    expect(() => node.deviceKey.unwrapRecoveryKey(recovery, nodeDeviceKey, 'u_other')).toThrow();

    const fromDesktop = node.deviceKey.wrapRecoveryKey(Buffer.from(key), nodeDeviceKey, 'u_phone');
    expect(hex(deviceKeyModule.unwrapRecoveryKey(fromDesktop, deviceKey, 'u_phone'))).toBe(hex(key));
  });

  it('an SMTP password encrypted on the phone decrypts on the desktop, and the other way round', () => {
    const deviceKey = shimCrypto.randomBytes(32);
    const secret = 'app-password ✉ סיסמה';
    expect(node.mailSettings.decryptSmtpPassword(mailSettings.encryptSmtpPassword(secret, deviceKey), Buffer.from(deviceKey))).toBe(secret);
    expect(mailSettings.decryptSmtpPassword(node.mailSettings.encryptSmtpPassword(secret, Buffer.from(deviceKey)), deviceKey)).toBe(secret);
  });

  it('the verifier computed on the phone is the one the desktop computes for the same password', async () => {
    const onPhone = kdf.splitSecret(await kdf.deriveSecret(password, salt));
    const onDesktop = node.kdf.splitSecret(await node.kdf.deriveSecret(password, Buffer.from(salt)));
    expect(kdf.verifierHex(onPhone.verifierSource)).toBe(node.kdf.verifierHex(onDesktop.verifierSource));
    expect(hex(onPhone.key)).toBe(onDesktop.key.toString('hex'));
  });
});
