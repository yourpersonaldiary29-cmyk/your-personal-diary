/**
 * docs/android-tasks/PRIVACY-HARDENING.md - the two privacy weaknesses fixed in code:
 *
 *   1. NO DIARY DECRYPTION FOR A FORGOT-PASSWORD REQUEST. The e-mail language is a plain field of the
 *      account record (AccountRecord.language in accounts.json), written at registration, sign-in,
 *      reopening and with every save that changes the setting. A forgot-password request, the
 *      "password changed" notice and the "e-mail changed" notice read it from there; an account
 *      without it gets the request language, else English. The diary is opened (DiaryVault.open) only
 *      by the reset itself. Older accounts.json files load unchanged.
 *   2. DELETED TEXT REALLY GONE (hosted mode only). PRAGMA secure_delete on every diary database of a
 *      hosted vault (re-applied after sql.js re-opens its connection in export), a one-time VACUUM per
 *      diary marked in the SQLite header (PRIVACY_COMPACTED_FLAG), the `.prev` rotated after the
 *      compaction save, restored backups compacted before their first save. Local mode is unchanged.
 *
 * Everything runs on the project's sql.js and on fictional data in temp directories.
 */
import fs from 'node:fs';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { t, type Locale } from '@shared/i18n';
import type { AuthResponse, Entry } from '@shared/types';
import { createBackupBytes, restoreBackup } from '../src/backup/backup';
import { loadConfig, loadHostedEnv, type ServerConfig } from '../src/config';
import { DiaryDb, PRIVACY_COMPACTED_FLAG } from '../src/db/database';
import { createEntry, deleteEntry, updateEntry, validateEntryInput } from '../src/db/entries-repo';
import { getSettings, saveSettings } from '../src/db/settings-repo';
import { startHosted, type RunningHosted } from '../src/hosted';
import type { MailContent } from '../src/mail/mime';
import { AccountsStore } from '../src/security/accounts';
import { createAuthService, type DiaryAuthService } from '../src/security/auth-service';
import { decryptContainer, decryptWithPassword } from '../src/security/container';
import { PasswordResetService } from '../src/security/password-reset';
import type { AccountRecord } from '../src/security/session-types';
import { createVault, DiaryVault, exportImage, openVault, vaultPathOf } from '../src/security/vault';
import { cleanupTempDirs, TEST_ACCOUNT, tempDataDir } from './helpers';

const PASSWORD = 'Passw0rd!';
const NEW_PASSWORD = 'NewPassw0rd!';
const FAST = { N: 1024, r: 8, p: 1 };
const KEY = Buffer.alloc(32, 9);
const HOST = 'diary.example';

const services: DiaryAuthService[] = [];
const hostedServers: RunningHosted[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const s of services.splice(0)) await s.shutdown();
  for (const h of hostedServers.splice(0)) await h.stop();
});
afterAll(cleanupTempDirs);

function localConfig(dataDir = tempDataDir()): ServerConfig {
  return loadConfig(['--data-dir', dataDir, '--port', '0'], {});
}

function hostedConfig(dataDir = tempDataDir()): ServerConfig {
  return loadConfig(['--data-dir', dataDir, '--port', '0'], { DIARY_MODE: 'hosted' });
}

async function authService(config: ServerConfig): Promise<DiaryAuthService> {
  const auth = await createAuthService(config, { kdf: FAST });
  services.push(auth);
  return auth;
}

async function stop(auth: DiaryAuthService): Promise<void> {
  services.splice(services.indexOf(auth), 1);
  await auth.shutdown();
}

const registration = (username: string, language?: Locale) => ({
  firstName: 'Noa',
  lastName: 'Fictional',
  username,
  email: `${username}@example.test`,
  password: PASSWORD,
  rememberMe: false,
  deviceName: 'Test device',
  ...(language ? { language } : {}),
});

function accountsFile(config: ServerConfig): { version: number; accounts: Array<Record<string, unknown>> } {
  return JSON.parse(fs.readFileSync(config.accountsFile, 'utf8')) as { version: number; accounts: Array<Record<string, unknown>> };
}

/** A mailer that keeps what it would send. */
function captureMailer() {
  const sent: MailContent[] = [];
  return { sent, mailer: { ready: () => true, send: async (content: MailContent) => void sent.push(content) } };
}

function resetService(auth: DiaryAuthService, mailer: ReturnType<typeof captureMailer>['mailer']): PasswordResetService {
  return new PasswordResetService(auth, mailer, { backgroundDelayMs: () => 0, perIpPerHour: 1000, perAddressPerHour: 1000, log: () => {} });
}

const forgot = (reset: PasswordResetService, email: string, locale: Locale) => reset.request({ email, ip: '192.0.2.10', locale, linkBase: 'https://diary.example' });

const contains = (bytes: Uint8Array, text: string) => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).includes(Buffer.from(text, 'utf8'));

/** `title` occurs in the image as a whole value: not followed by another digit ("day 10" is not "day 101"). */
function hasTitle(image: Buffer, title: string): boolean {
  const needle = Buffer.from(title, 'utf8');
  for (let at = image.indexOf(needle); at >= 0; at = image.indexOf(needle, at + 1)) {
    const next = image[at + needle.length];
    if (next === undefined || next < 0x30 || next > 0x39) return true;
  }
  return false;
}

/** The decrypted SQLite image of a diary file (the vault key). */
function imageOf(file: string, key: Buffer = KEY): Buffer {
  return decryptContainer(fs.readFileSync(file), key).plain;
}

function entryInput(title: string, body: string) {
  return validateEntryInput({ date: '2026-10-20', time: '21:00', title, body, emotions: [], events: [], people: [], tags: [] });
}

function vaultAccount(id: string): AccountRecord {
  return { ...TEST_ACCOUNT, id, dbFile: `${id}.mpd`, kdf: { ...TEST_ACCOUNT.kdf, ...FAST } };
}

/**
 * A diary written the way every diary was written before this change (local rules: no
 * secure_delete, no VACUUM): an entry with `secret` in a long body (overflow pages) is deleted and an
 * entry whose `edited` text is replaced; both texts stay in free space of the saved image.
 */
async function diaryWithOldFreePages(config: ServerConfig, account: AccountRecord, secret: string, edited: string): Promise<void> {
  const vault = await createVault(config, account, KEY);
  const doomed = createEntry(vault.db, entryInput('Fictional entry to delete', `${secret} ${'lorem ipsum '.repeat(800)}`));
  const changed = createEntry(vault.db, entryInput('Fictional entry to edit', `${edited} - the first wording of a fictional day.`));
  for (let i = 0; i < 20; i++) createEntry(vault.db, entryInput(`Kept entry ${i}`, `An ordinary fictional day number ${i}.`));
  await vault.persist();
  deleteEntry(vault.db, doomed.id);
  updateEntry(vault.db, changed.id, entryInput('Fictional entry to edit', 'A different wording.'));
  await vault.close();
}

// ---------------------------------------------------------------------------------------------
// 1. The e-mail language without decrypting anything
// ---------------------------------------------------------------------------------------------

describe('item 1: a forgot-password request never opens the diary', () => {
  for (const mode of ['hosted', 'local'] as const) {
    it(`${mode} mode: the reset e-mail is in the account language from accounts.json, and no diary is opened`, async () => {
      const config = mode === 'hosted' ? hostedConfig() : localConfig();
      const auth = await authService(config);
      const { session, account } = await auth.register(registration('noa', 'he'));
      // The registry holds the language of the new diary.
      expect(accountsFile(config).accounts[0].language).toBe('he');
      await auth.logout(session.id);
      expect(auth.vaults.size).toBe(0);

      const opens = vi.spyOn(DiaryVault, 'open');
      const { sent, mailer } = captureMailer();
      const reset = resetService(auth, mailer);
      const diary = vaultPathOf(config, account);
      const before = fs.readFileSync(diary);
      forgot(reset, 'NOA@example.test', 'en');
      await reset.idle();

      expect(sent).toHaveLength(1);
      expect(sent[0].subject).toBe(t('he', 'server.email.reset.subject'));
      expect(sent[0].html).toContain('dir="rtl"');
      expect(opens).not.toHaveBeenCalled();
      expect(auth.vaults.size).toBe(0);
      expect(fs.readFileSync(diary).equals(before)).toBe(true);
    });
  }

  it('a language changed in the diary reaches accounts.json with the save; sign-in and remember-me reopening write it too', async () => {
    const config = hostedConfig();
    const auth = await authService(config);
    const { token, account } = await auth.register({ ...registration('noa', 'en'), rememberMe: true });
    const ctx = (await auth.authenticate(token))!;
    saveSettings(ctx.db, { language: 'fr' });
    // Not saved yet: the registry still says what is on disk.
    expect(accountsFile(config).accounts[0].language).toBe('en');
    await ctx.vault.persist();
    expect(accountsFile(config).accounts[0].language).toBe('fr');
    await stop(auth);

    // An older record (the field removed): the remember-me reopening after a restart writes it again.
    const file = accountsFile(config);
    delete file.accounts[0].language;
    fs.writeFileSync(config.accountsFile, JSON.stringify(file, null, 2));
    const second = await authService(config);
    expect(second.accounts.findById(account.id)?.language).toBeUndefined();
    expect(await second.authenticate(token)).not.toBeNull();
    expect(accountsFile(config).accounts[0].language).toBe('fr');
    await stop(second);

    // ...and so does a sign-in with the password.
    delete file.accounts[0].language;
    fs.writeFileSync(config.accountsFile, JSON.stringify(file, null, 2));
    const third = await authService(config);
    await third.login({ username: 'noa', password: PASSWORD, rememberMe: false, deviceName: 'pc' });
    expect(accountsFile(config).accounts[0].language).toBe('fr');
  });

  it('an account without the field yet: the request language (negotiated Accept-Language), else English - still nothing opened', async () => {
    const config = hostedConfig();
    const auth = await authService(config);
    const { session } = await auth.register(registration('noa', 'he'));
    await auth.logout(session.id);
    await stop(auth);
    const file = accountsFile(config);
    delete file.accounts[0].language;
    fs.writeFileSync(config.accountsFile, JSON.stringify(file, null, 2));

    const again = await authService(config);
    const opens = vi.spyOn(DiaryVault, 'open');
    const { sent, mailer } = captureMailer();
    const reset = resetService(again, mailer);
    forgot(reset, 'noa@example.test', 'de');
    await reset.idle();
    forgot(reset, 'noa@example.test', 'en');
    await reset.idle();
    expect(sent.map((m) => m.subject)).toEqual([t('de', 'server.email.reset.subject'), t('en', 'server.email.reset.subject')]);
    expect(opens).not.toHaveBeenCalled();
    // The diary's own language (Hebrew) was never read: the field stays absent until the next sign-in.
    expect(accountsFile(config).accounts[0].language).toBeUndefined();
  });

  it('the route passes the negotiated Accept-Language, English without one', async () => {
    const dataDir = tempDataDir();
    const config = loadConfig(['--data-dir', dataDir], { DIARY_MODE: 'hosted' });
    const seed = await authService(config);
    const { account } = await seed.register(registration('noa', 'he'));
    await stop(seed);
    const file = accountsFile(config);
    delete file.accounts[0].language;
    fs.writeFileSync(config.accountsFile, JSON.stringify(file, null, 2));
    const srv = await bootHosted(dataDir, account.id);
    // The owner's e-mail card is not set up in this test: the mail service is replaced by a capture.
    const { sent, mailer } = captureMailer();
    const reset = resetService(srv.auth, mailer);
    const opens = vi.spyOn(DiaryVault, 'open');
    (srv.passwordReset as unknown as { request: PasswordResetService['request'] }).request = (input) => reset.request(input);
    const agent = supertest(srv.localUrl);
    const post = (lang?: string) => {
      const req = agent.post('/api/auth/forgot-password').set('Host', HOST).set('X-Forwarded-Proto', 'https');
      return (lang ? req.set('Accept-Language', lang) : req).send({ email: 'noa@example.test' });
    };
    expect((await post('de-DE,de;q=0.9')).status).toBe(200);
    await reset.idle();
    expect((await post()).status).toBe(200);
    await reset.idle();
    expect(sent.map((m) => m.subject)).toEqual([t('de', 'server.email.reset.subject'), t('en', 'server.email.reset.subject')]);
    expect(opens).not.toHaveBeenCalled();
  });

  it('the "password changed" and "e-mail changed" notices read the registry too; only the reset itself opens the diary', async () => {
    const config = hostedConfig();
    const auth = await authService(config);
    const { session, account } = await auth.register(registration('noa', 'ja'));
    await auth.logout(session.id);
    const opens = vi.spyOn(DiaryVault, 'open');
    const { sent, mailer } = captureMailer();
    const reset = resetService(auth, mailer);
    forgot(reset, 'noa@example.test', 'en');
    await reset.idle();
    expect(opens).not.toHaveBeenCalled();
    const token = /token=([A-Za-z0-9_-]+)/.exec(sent[0].text)?.[1] ?? '';
    expect(token).not.toBe('');

    await reset.resetWithToken(token, NEW_PASSWORD, 'en');
    // The reset re-encrypts the diary under the new password: the one opening this flow needs.
    expect(opens).toHaveBeenCalledTimes(1);
    await reset.idle();
    expect(sent[1].subject).toBe(t('ja', 'server.email.changed.subject'));
    expect(auth.vaults.size).toBe(0);

    reset.notifyEmailChanged(auth.accounts.findById(account.id)!, 'old.address@example.test', 'en');
    await reset.idle();
    expect(sent[2]).toMatchObject({ to: 'old.address@example.test', subject: t('ja', 'server.email.emailChanged.subject') });
    expect(opens).toHaveBeenCalledTimes(1);
  });

  it('accounts.json files from before the field load unchanged; a value that is not a locale is left out, nothing else', () => {
    const dir = tempDataDir();
    const file = path.join(dir, 'accounts.json');
    const base = (id: string, extra: Record<string, unknown> = {}) => ({
      id,
      username: id,
      usernameLower: id,
      firstName: 'Fictional',
      lastName: 'Person',
      email: `${id}@example.test`,
      emailLower: `${id}@example.test`,
      createdAt: '2026-01-01T00:00:00.000Z',
      lastLoginAt: '2026-02-01T00:00:00.000Z',
      kdf: { algorithm: 'scrypt', N: 1024, r: 8, p: 1, saltHex: '11'.repeat(16) },
      verifierHex: '22'.repeat(32),
      dbFile: `${id}.mpd`,
      recoveryWrappedKey: 'AAAA',
      ...extra,
    });
    const older = base('u_older');
    fs.writeFileSync(
      file,
      JSON.stringify({ version: 1, accounts: [older, base('u_german', { language: 'de' }), base('u_junk', { language: 'xx' }), base('u_number', { language: 42 })] }, null, 2),
    );
    const store = new AccountsStore(file);
    const list = store.list();
    expect(list.map((a) => a.id)).toEqual(['u_older', 'u_german', 'u_junk', 'u_number']);
    expect(list[0]).toEqual(older);
    expect(list[1].language).toBe('de');
    expect('language' in list[2]).toBe(false);
    expect('language' in list[3]).toBe(false);
    expect({ ...list[2], id: 'u_older', username: 'u_older', usernameLower: 'u_older', email: older.email, emailLower: older.emailLower, dbFile: older.dbFile }).toEqual(older);
    // Unknown ids and unchanged values write nothing.
    const mtime = fs.statSync(file).mtimeMs;
    const text = fs.readFileSync(file, 'utf8');
    expect(store.setLanguage('u_nobody', 'fr')).toBeNull();
    expect(store.setLanguage('u_german', 'de')?.language).toBe('de');
    expect(fs.readFileSync(file, 'utf8')).toBe(text);
    expect(fs.statSync(file).mtimeMs).toBe(mtime);
    expect(store.setLanguage('u_older', 'he')?.language).toBe('he');
    expect((JSON.parse(fs.readFileSync(file, 'utf8')) as { accounts: AccountRecord[] }).accounts.map((a) => a.language ?? null)).toEqual(['he', 'de', null, null]);
  });
});

// ---------------------------------------------------------------------------------------------
// 2. Deleted text really gone (hosted mode)
// ---------------------------------------------------------------------------------------------

describe('item 2: secure_delete in hosted mode', () => {
  it('a deleted or replaced entry text is absent from db.export() and from the saved file; local mode keeps today\'s behaviour', async () => {
    const results: Record<string, { exported: [boolean, boolean]; saved: [boolean, boolean] }> = {};
    for (const mode of ['hosted', 'local'] as const) {
      const config = mode === 'hosted' ? hostedConfig() : localConfig();
      const account = vaultAccount(`u_sd_${mode}`);
      const vault = await createVault(config, account, KEY);
      const gone = createEntry(vault.db, entryInput('To delete', `SECRET-DELETED-ALPHA ${'x'.repeat(6000)}`));
      const edited = createEntry(vault.db, entryInput('To edit', 'SECRET-EDITED-BETA, the first wording.'));
      for (let i = 0; i < 10; i++) createEntry(vault.db, entryInput(`Kept ${i}`, `Fictional day ${i}.`));
      await vault.persist();
      deleteEntry(vault.db, gone.id);
      updateEntry(vault.db, edited.id, entryInput('To edit', 'Another wording.'));
      const exported = exportImage(vault.db);
      await vault.persist();
      const saved = imageOf(vaultPathOf(config, account));
      results[mode] = {
        exported: [contains(exported, 'SECRET-DELETED-ALPHA'), contains(exported, 'SECRET-EDITED-BETA')],
        saved: [contains(saved, 'SECRET-DELETED-ALPHA'), contains(saved, 'SECRET-EDITED-BETA')],
      };
      await vault.close();
    }
    expect(results.hosted).toEqual({ exported: [false, false], saved: [false, false] });
    // The control: without secure_delete the same steps leave both texts in free space (local mode, unchanged).
    expect(results.local).toEqual({ exported: [true, true], saved: [true, true] });
  });

  it('the pragma survives sql.js re-opening its connection inside export (exportImage switches it on again)', async () => {
    const hosted = await createVault(hostedConfig(), vaultAccount('u_pragma_h'), KEY);
    const local = await createVault(localConfig(), vaultAccount('u_pragma_l'), KEY);
    const pragma = (db: DiaryDb) => Number(db.scalar<number>('PRAGMA secure_delete'));
    expect([pragma(hosted.db), pragma(local.db)]).toEqual([1, 0]);
    // The raw export alone drops it: that is why every export goes through exportImage.
    hosted.db.export();
    expect(pragma(hosted.db)).toBe(0);
    hosted.db.enableSecureDelete();
    exportImage(hosted.db);
    exportImage(local.db);
    expect([pragma(hosted.db), pragma(local.db)]).toEqual([1, 0]);
    await hosted.persist();
    expect(pragma(hosted.db)).toBe(1);
    // Foreign keys are back on as before.
    expect(Number(hosted.db.scalar<number>('PRAGMA foreign_keys'))).toBe(1);
    await hosted.close();
    await local.close();
  });

  it('a new hosted diary is marked compacted from the start; a new local diary is not', async () => {
    const hostedConfigValue = hostedConfig();
    const localConfigValue = localConfig();
    const h = await createVault(hostedConfigValue, vaultAccount('u_new_h'), KEY);
    const l = await createVault(localConfigValue, vaultAccount('u_new_l'), KEY);
    expect([h.db.privacyCompacted, l.db.privacyCompacted]).toEqual([true, false]);
    await h.close();
    await l.close();
    const userVersion = async (file: string) => {
      const db = await DiaryDb.fromImage(imageOf(file));
      try {
        return Number(db.scalar<number>('PRAGMA user_version'));
      } finally {
        db.close();
      }
    };
    expect(await userVersion(vaultPathOf(hostedConfigValue, vaultAccount('u_new_h')))).toBe(PRIVACY_COMPACTED_FLAG);
    expect(await userVersion(vaultPathOf(localConfigValue, vaultAccount('u_new_l')))).toBe(0);
  });
});

describe('item 2: the one-time compaction', () => {
  it('an image with old free pages: after the first hosted opening the text is gone from the file AND its .prev; the mark prevents a repeat', async () => {
    const dataDir = tempDataDir();
    const account = vaultAccount('u_compact');
    await diaryWithOldFreePages(localConfig(dataDir), account, 'SECRET-BEFORE-DEPLOY', 'SECRET-OLD-WORDING');
    const file = vaultPathOf(localConfig(dataDir), account);
    // Before: both texts are in the saved image, in free space.
    expect([contains(imageOf(file), 'SECRET-BEFORE-DEPLOY'), contains(imageOf(file), 'SECRET-OLD-WORDING')]).toEqual([true, true]);

    // Local mode opens it as it always did: nothing written, nothing marked.
    const untouched = fs.readFileSync(file);
    const local = await openVault(localConfig(dataDir), account, KEY);
    expect(local.db.privacyCompacted).toBe(false);
    await local.close();
    expect(fs.readFileSync(file).equals(untouched)).toBe(true);

    // Hosted mode: compacted and saved during the opening.
    const compactions = vi.spyOn(DiaryDb.prototype, 'compactForPrivacy');
    const hosted = await openVault(hostedConfig(dataDir), account, KEY);
    expect(compactions).toHaveBeenCalledTimes(1);
    expect(hosted.db.privacyCompacted).toBe(true);
    expect(hosted.db.isDirty()).toBe(false);
    for (const candidate of [file, `${file}.prev`]) {
      const image = imageOf(candidate);
      expect([contains(image, 'SECRET-BEFORE-DEPLOY'), contains(image, 'SECRET-OLD-WORDING')], candidate).toEqual([false, false]);
    }
    // The safety copy is the compacted image too (the rotation write), and no .tmp is left.
    expect(imageOf(`${file}.prev`).equals(imageOf(file))).toBe(true);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
    // The content is all there.
    expect(Number(hosted.db.scalar<number>('SELECT COUNT(*) FROM entries'))).toBe(21);
    expect(hosted.db.scalar<string>('PRAGMA integrity_check')).toBe('ok');
    await hosted.close();

    // The mark prevents a repeat: the next hosted opening neither compacts nor writes.
    const marked = fs.readFileSync(file);
    const markedPrev = fs.readFileSync(`${file}.prev`);
    const again = await openVault(hostedConfig(dataDir), account, KEY);
    expect(compactions).toHaveBeenCalledTimes(1);
    await again.close();
    expect(fs.readFileSync(file).equals(marked)).toBe(true);
    expect(fs.readFileSync(`${file}.prev`).equals(markedPrev)).toBe(true);
  });

  it('after the compaction, a later deletion is wiped at its save and leaves the .prev at the save after that', async () => {
    const dataDir = tempDataDir();
    const account = vaultAccount('u_after');
    await diaryWithOldFreePages(localConfig(dataDir), account, 'SECRET-OLD-1', 'SECRET-OLD-2');
    const file = vaultPathOf(localConfig(dataDir), account);
    const vault = await openVault(hostedConfig(dataDir), account, KEY);
    const entry = createEntry(vault.db, entryInput('Written after the deploy', 'SECRET-NEW-GAMMA, a fictional thought.'));
    await vault.persist();
    deleteEntry(vault.db, entry.id);
    await vault.persist();
    expect(contains(imageOf(file), 'SECRET-NEW-GAMMA')).toBe(false);
    // The safety copy is the previous save, in which the entry still existed...
    expect(contains(imageOf(`${file}.prev`), 'SECRET-NEW-GAMMA')).toBe(true);
    // ...until the next save of the diary.
    saveSettings(vault.db, { theme: 'dark' });
    await vault.persist();
    expect(contains(imageOf(`${file}.prev`), 'SECRET-NEW-GAMMA')).toBe(false);
    await vault.close();
  });

  it('a failed compaction save is retried with its rotation by the next save', async () => {
    const dataDir = tempDataDir();
    const account = vaultAccount('u_retry');
    await diaryWithOldFreePages(localConfig(dataDir), account, 'SECRET-RETRY-1', 'SECRET-RETRY-2');
    const file = vaultPathOf(localConfig(dataDir), account);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const realOpen = fs.promises.open;
    let refuse = true;
    vi.spyOn(fs.promises, 'open').mockImplementation(((...args: Parameters<typeof fs.promises.open>) => {
      if (refuse && String(args[0]).endsWith('.tmp')) return Promise.reject(Object.assign(new Error('disk full (simulated)'), { code: 'ENOSPC' }));
      return realOpen(...args);
    }) as typeof fs.promises.open);
    const vault = await openVault(hostedConfig(dataDir), account, KEY);
    expect(vault.db.privacyCompacted).toBe(true);
    expect(vault.db.isDirty()).toBe(true);
    expect(errors).toHaveBeenCalled();
    // Nothing reached the disk yet: the old image is still there.
    expect(contains(imageOf(file), 'SECRET-RETRY-1')).toBe(true);
    refuse = false;
    await vault.persist();
    for (const candidate of [file, `${file}.prev`]) expect(contains(imageOf(candidate), 'SECRET-RETRY-1'), candidate).toBe(false);
    await vault.close();
  });

  it('a restored backup with old free pages is compacted before its first save (hosted), restored as it is (local)', async () => {
    // A backup made from a diary with old free pages (the backup file itself is the user's own copy).
    const source = await createVault(localConfig(), vaultAccount('u_backup_src'), KEY);
    const doomed = createEntry(source.db, entryInput('Deleted before the backup', `SECRET-IN-BACKUP ${'y'.repeat(6000)}`));
    createEntry(source.db, entryInput('Kept', 'A fictional kept entry.'));
    deleteEntry(source.db, doomed.id);
    const account = { ...vaultAccount('u_backup_src') };
    const backup = await createBackupBytes(source, account, PASSWORD);
    await source.close();
    expect(contains((await decryptWithPassword(backup, PASSWORD)).plain, 'SECRET-IN-BACKUP')).toBe(true);

    for (const mode of ['hosted', 'local'] as const) {
      const config = mode === 'hosted' ? hostedConfig() : localConfig();
      const target = vaultAccount(`u_restore_${mode}`);
      const vault = await createVault(config, target, KEY);
      await restoreBackup(vault, backup, PASSWORD);
      const saved = imageOf(vaultPathOf(config, target));
      expect(contains(saved, 'SECRET-IN-BACKUP'), mode).toBe(mode === 'local');
      expect(vault.db.privacyCompacted, mode).toBe(mode === 'hosted');
      expect(vault.db.secureDelete, mode).toBe(mode === 'hosted');
      expect(Number(vault.db.scalar<number>('SELECT COUNT(*) FROM entries'))).toBe(1);
      await vault.close();
    }
  });

  it('a large fictional diary (5,000 entries) compacts in reasonable time', async () => {
    const dataDir = tempDataDir();
    const account = vaultAccount('u_large');
    const vault = await createVault(localConfig(dataDir), account, KEY);
    const words = ['morning', 'walk', 'coffee', 'rain', 'friend', 'garden', 'book', 'music', 'quiet', 'work', 'evening', 'tired', 'happy', 'river'];
    const ids: number[] = [];
    vault.db.transaction(() => {
      for (let i = 0; i < 5000; i++) {
        const body = Array.from({ length: 90 }, (_, w) => words[(i * 7 + w * 3) % words.length]).join(' ');
        const day = String(1 + (i % 28)).padStart(2, '0');
        const month = String(1 + (Math.floor(i / 28) % 12)).padStart(2, '0');
        ids.push(createEntry(vault.db, validateEntryInput({ date: `20${20 + (i % 6)}-${month}-${day}`, time: '20:00', title: `Fictional day ${i}`, body: `${body} #${i}`, emotions: [], events: [], people: [], tags: ['fiction'] })).id);
      }
    });
    await vault.persist();
    // Deleted before the deploy: every tenth entry.
    vault.db.transaction(() => {
      for (let i = 0; i < ids.length; i += 10) deleteEntry(vault.db, ids[i]);
    });
    await vault.close();
    const file = vaultPathOf(localConfig(dataDir), account);
    const sizeBefore = fs.statSync(file).size;
    const deletedTitles = ids.map((_, i) => i).filter((i) => i % 10 === 0).map((i) => `Fictional day ${i}`);
    // A spread sample of the kept entries (every 37th).
    const keptTitles = ids.map((_, i) => i).filter((i) => i % 10 !== 0 && i % 37 === 1).map((i) => `Fictional day ${i}`);
    // Before: deleted titles are still readable in free space (how many depends on SQLite's page reuse).
    const imageBefore = imageOf(file);
    const leftBefore = deletedTitles.filter((title) => hasTitle(imageBefore, title)).length;
    expect(leftBefore).toBeGreaterThan(0);

    const vacuumTimes: number[] = [];
    const realCompact = DiaryDb.prototype.compactForPrivacy;
    vi.spyOn(DiaryDb.prototype, 'compactForPrivacy').mockImplementation(function (this: DiaryDb) {
      const t0 = performance.now();
      realCompact.call(this);
      vacuumTimes.push(performance.now() - t0);
    });
    const t0 = performance.now();
    const hosted = await openVault(hostedConfig(dataDir), account, KEY);
    const openMs = performance.now() - t0;
    expect(Number(hosted.db.scalar<number>('SELECT COUNT(*) FROM entries'))).toBe(4500);
    await hosted.close();
    const sizeAfter = fs.statSync(file).size;
    const after = imageOf(file);
    expect(deletedTitles.filter((title) => hasTitle(after, title))).toEqual([]);
    expect(keptTitles.every((title) => hasTitle(after, title))).toBe(true);
    expect(vacuumTimes).toHaveLength(1);
    // Measured, for the report (docs/android-tasks/PRIVACY-HARDENING.md asks for the numbers).
    console.log(
      `[privacy-compaction] 5000 entries (500 deleted, ${leftBefore} of their titles readable in free space before): file ${sizeBefore} -> ${sizeAfter} bytes; ` +
        `VACUUM ${vacuumTimes[0].toFixed(0)} ms; whole first opening (decrypt + VACUUM + 2 encrypted writes) ${openMs.toFixed(0)} ms`,
    );
    // "Reasonable": far below the time a sign-in may take, even on a loaded test machine.
    expect(openMs).toBeLessThan(15_000);
  }, 120_000);
});

// ---------------------------------------------------------------------------------------------
// The hosted composition end to end
// ---------------------------------------------------------------------------------------------

async function bootHosted(dataDir: string, ownerId = ''): Promise<RunningHosted> {
  const deviceKey = fs.readFileSync(path.join(dataDir, 'device.key'));
  const env = loadHostedEnv({
    DIARY_MODE: 'hosted',
    DIARY_PUBLIC_URL: `https://${HOST}`,
    DIARY_BIND: '127.0.0.1',
    DIARY_DEVICE_KEY: deviceKey.toString('base64'),
    DIARY_LOGIN_PER_MINUTE: '1000',
    DIARY_AUTH_GLOBAL_PER_MINUTE: '5000',
    ...(ownerId ? { DIARY_OWNER_ID: ownerId } : {}),
  });
  const config = loadConfig(['--data-dir', dataDir], { DIARY_MODE: 'hosted' });
  const srv = await startHosted(config, env, { port: 0, quiet: true, log: () => {}, auth: { kdf: FAST } });
  hostedServers.push(srv);
  return srv;
}

describe('the hosted composition: a data directory from before the change', () => {
  it('the first sign-in compacts the diary; an entry deleted through the API is gone from the file; the language follows Settings', async () => {
    const dataDir = tempDataDir();
    // The "PC era": a local server wrote the diary, with a deleted entry in free space.
    const local = await authService(localConfig(dataDir));
    const { token: localToken, account } = await local.register(registration('noa', 'en'));
    const ctx = (await local.authenticate(localToken))!;
    const doomed = createEntry(ctx.db, entryInput('Deleted on the PC', `SECRET-PC-ERA ${'z'.repeat(6000)}`));
    createEntry(ctx.db, entryInput('Kept', 'A fictional entry that stays.'));
    await ctx.vault.persist();
    deleteEntry(ctx.db, doomed.id);
    await stop(local);
    const file = path.join(dataDir, 'users', account.dbFile);
    const image = async (f: string) => (await decryptWithPassword(fs.readFileSync(f), PASSWORD)).plain;
    expect(contains(await image(file), 'SECRET-PC-ERA')).toBe(true);

    const srv = await bootHosted(dataDir);
    const agent = supertest(srv.localUrl);
    const common = (r: supertest.Test) => r.set('Host', HOST).set('X-Forwarded-Proto', 'https').set('Accept-Language', 'en');
    const login = await common(agent.post('/api/auth/login')).send({ username: 'noa', password: PASSWORD, rememberMe: false, deviceName: 'Browser' });
    expect(login.status).toBe(200);
    const token = (login.body as AuthResponse).token;
    const as = (r: supertest.Test) => common(r).set('Authorization', `Bearer ${token}`);
    for (const f of [file, `${file}.prev`]) expect(contains(await image(f), 'SECRET-PC-ERA'), f).toBe(false);

    const created = await as(agent.post('/api/entries')).send({ date: '2026-10-21', time: '08:00', title: 'Hosted', body: 'SECRET-HOSTED-DELTA, fictional.', emotions: [], events: [], people: [], tags: [] });
    expect(created.status).toBe(201);
    expect((await as(agent.delete(`/api/entries/${(created.body as Entry).id}`))).status).toBe(204);
    expect((await as(agent.put('/api/settings')).send({ language: 'it' })).status).toBe(200);
    await srv.auth.vaults.persistAll();
    expect(contains(await image(file), 'SECRET-HOSTED-DELTA')).toBe(false);
    expect(accountsFile(srv.config).accounts[0].language).toBe('it');
    const opened = (await as(agent.get('/api/settings'))).body as ReturnType<typeof getSettings>;
    expect(opened.language).toBe('it');
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------
// Fixer: the one-time mark does not survive local mode (a diary that returns to hosted mode as a
// plain file - the PC->hosted migration - must not skip the compaction with text deleted on the PC)
// ---------------------------------------------------------------------------------------------

/** `PRAGMA user_version` of a SQLite image (the mark is its PRIVACY_COMPACTED_FLAG bit). */
async function userVersionOfImage(image: Uint8Array): Promise<number> {
  const db = await DiaryDb.fromImage(image);
  try {
    return Number(db.scalar<number>('PRAGMA user_version'));
  } finally {
    db.close();
  }
}

describe('item 2: the compaction mark does not survive local mode', () => {
  it('marked in hosted mode, changed in local mode: saved unmarked there, and compacted again at the next hosted opening', async () => {
    const dataDir = tempDataDir();
    const account = vaultAccount('u_local_era');
    const file = vaultPathOf(hostedConfig(dataDir), account);
    const created = await createVault(hostedConfig(dataDir), account, KEY);
    createEntry(created.db, entryInput('Kept', 'A fictional entry that stays.'));
    await created.close();
    expect(await userVersionOfImage(imageOf(file))).toBe(PRIVACY_COMPACTED_FLAG);

    // Local mode, nothing changed: the mark is gone in memory, but the file is not rewritten (its mark is still true).
    const untouched = fs.readFileSync(file);
    const look = await openVault(localConfig(dataDir), account, KEY);
    expect(look.db.privacyCompacted).toBe(false);
    expect(look.db.isDirty()).toBe(false);
    await look.close();
    expect(fs.readFileSync(file).equals(untouched)).toBe(true);

    // Local mode with a change (the verifier's steps): saved unmarked; local rules leave the deleted text in free space.
    const local = await openVault(localConfig(dataDir), account, KEY);
    const doomed = createEntry(local.db, entryInput('MK-LOCAL-ERA-2', `SECRET-LOCAL-ERA ${'w'.repeat(6000)}`));
    await local.persist();
    deleteEntry(local.db, doomed.id);
    await local.persist();
    await local.close();
    expect(await userVersionOfImage(imageOf(file))).toBe(0);
    expect(contains(imageOf(file), 'SECRET-LOCAL-ERA')).toBe(true);

    // Back in hosted mode (as a plain file copy brings it): compacted once more - gone from the file and its .prev.
    const compactions = vi.spyOn(DiaryDb.prototype, 'compactForPrivacy');
    const hosted = await openVault(hostedConfig(dataDir), account, KEY);
    expect(compactions).toHaveBeenCalledTimes(1);
    expect(hosted.db.privacyCompacted).toBe(true);
    expect(Number(hosted.db.scalar<number>('SELECT COUNT(*) FROM entries'))).toBe(1);
    await hosted.close();
    for (const candidate of [file, `${file}.prev`]) expect(contains(imageOf(candidate), 'SECRET-LOCAL-ERA'), candidate).toBe(false);
    expect(await userVersionOfImage(imageOf(file))).toBe(PRIVACY_COMPACTED_FLAG);
  });

  it('a backup made on the hosted server (marked) and restored in local mode is saved unmarked', async () => {
    const sourceAccount = vaultAccount('u_hosted_backup');
    const source = await createVault(hostedConfig(), sourceAccount, KEY);
    createEntry(source.db, entryInput('Kept', 'A fictional entry from the hosted server.'));
    const backup = await createBackupBytes(source, sourceAccount, PASSWORD);
    await source.close();
    expect(await userVersionOfImage((await decryptWithPassword(backup, PASSWORD)).plain)).toBe(PRIVACY_COMPACTED_FLAG);

    const config = localConfig();
    const target = vaultAccount('u_local_restore');
    const vault = await createVault(config, target, KEY);
    await restoreBackup(vault, backup, PASSWORD);
    expect(vault.db.privacyCompacted).toBe(false);
    expect(vault.db.secureDelete).toBe(false);
    await vault.close();
    expect(await userVersionOfImage(imageOf(vaultPathOf(config, target)))).toBe(0);
  });

  it('a local diary without the mark: opening it in local mode changes nothing in the image (no statement at all)', async () => {
    const dataDir = tempDataDir();
    const account = vaultAccount('u_plain_local');
    await diaryWithOldFreePages(localConfig(dataDir), account, 'SECRET-PLAIN-1', 'SECRET-PLAIN-2');
    const file = vaultPathOf(localConfig(dataDir), account);
    const before = imageOf(file);
    const forget = vi.spyOn(DiaryDb.prototype, 'forgetPrivacyCompaction');
    const vault = await openVault(localConfig(dataDir), account, KEY);
    expect(forget).toHaveBeenCalledTimes(1);
    expect(Buffer.from(exportImage(vault.db)).equals(before)).toBe(true);
    expect(vault.db.isDirty()).toBe(false);
    await vault.close();
    expect(imageOf(file).equals(before)).toBe(true);
  });
});
