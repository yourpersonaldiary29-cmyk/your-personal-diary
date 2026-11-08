/**
 * docs/android-tasks/PRIVACY-HARDENING.md item 1, fixer finding "a forgot-password request still
 * decrypts the recovery-wrapped diary key": `canResetPassword` unwrapped the recovery key (AES-GCM with
 * the device key) on every request for a registered address, so the plain diary key of a signed-out
 * user was in server memory for a moment. Now the request only checks that a recovery key of the right
 * shape is there (device-key.ts `hasRecoveryKeyShape`); the key is unwrapped by the reset itself.
 *
 * The proof counts EVERY AES-GCM decryption of the process (node:crypto `createDecipheriv`, which the
 * recovery key, the remember-me keys, the diary container and the mail settings all go through): a
 * request - hosted or local, with or without the language field, with a usable, a foreign or a damaged
 * recovery key - creates none, opens no diary and reads no diary file. Completing the reset does
 * decrypt (the spy is wired), exactly as disclosed.
 *
 * Fictional data in temp directories only.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t, type Locale } from '@shared/i18n';
import { loadConfig, type ServerConfig } from '../src/config';
import { DiaryDb } from '../src/db/database';
import { ApiError } from '../src/errors';
import type { MailContent } from '../src/mail/mime';
import { createAuthService, type DiaryAuthService } from '../src/security/auth-service';
import { hasRecoveryKeyShape, unwrapRecoveryKey, WRAPPED_KEY_LENGTH, wrapRecoveryKey } from '../src/security/device-key';
import { PasswordResetService } from '../src/security/password-reset';
import { DiaryVault, vaultPathOf } from '../src/security/vault';
import { cleanupTempDirs, tempDataDir } from './helpers';

/** Every AES-GCM decryption in the process, counted (the real implementation still runs). */
const counter = vi.hoisted(() => ({ decipher: 0 }));
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  const createDecipheriv = ((...args: Parameters<typeof actual.createDecipheriv>) => {
    counter.decipher++;
    return actual.createDecipheriv(...args);
  }) as typeof actual.createDecipheriv;
  return { ...actual, createDecipheriv, default: { ...actual, createDecipheriv } };
});

const PASSWORD = 'Passw0rd!';
const NEW_PASSWORD = 'NewPassw0rd!';
const FAST = { N: 1024, r: 8, p: 1 };

const services: DiaryAuthService[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const s of services.splice(0)) await s.shutdown();
});
afterAll(cleanupTempDirs);
beforeEach(() => {
  counter.decipher = 0;
});

const configOf = (mode: 'hosted' | 'local', dataDir = tempDataDir()): ServerConfig =>
  loadConfig(['--data-dir', dataDir, '--port', '0'], mode === 'hosted' ? { DIARY_MODE: 'hosted' } : {});

async function authService(config: ServerConfig): Promise<DiaryAuthService> {
  const auth = await createAuthService(config, { kdf: FAST });
  services.push(auth);
  return auth;
}

function captureMailer() {
  const sent: MailContent[] = [];
  return { sent, mailer: { ready: () => true, send: async (content: MailContent) => void sent.push(content) } };
}

function resetService(auth: DiaryAuthService, mailer: ReturnType<typeof captureMailer>['mailer']): PasswordResetService {
  return new PasswordResetService(auth, mailer, { backgroundDelayMs: () => 0, perIpPerHour: 1000, perAddressPerHour: 1000, log: () => {} });
}

/** A registered, signed-out account (its diary closed) and the counters zeroed. */
async function signedOutAccount(mode: 'hosted' | 'local', language: Locale = 'he') {
  const config = configOf(mode);
  const auth = await authService(config);
  const { session, account } = await auth.register({
    firstName: 'Noa',
    lastName: 'Fictional',
    username: 'noa',
    email: 'noa@example.test',
    password: PASSWORD,
    rememberMe: false,
    deviceName: 'Test device',
    language,
  });
  await auth.logout(session.id);
  expect(auth.vaults.size).toBe(0);
  return { config, auth, account };
}

/** Spies on every way a diary could be opened or read, and the decryption counter reset. */
function watchDiary(config: ServerConfig, file: string) {
  const opens = vi.spyOn(DiaryVault, 'open');
  const fromImage = vi.spyOn(DiaryDb, 'fromImage');
  const creates = vi.spyOn(DiaryDb, 'create');
  const realRead = fs.promises.readFile;
  let diaryReads = 0;
  vi.spyOn(fs.promises, 'readFile').mockImplementation(((...args: Parameters<typeof fs.promises.readFile>) => {
    if (String(args[0]).startsWith(config.usersDir)) diaryReads++;
    return realRead(...args);
  }) as typeof fs.promises.readFile);
  const before = { bytes: fs.readFileSync(file), mtime: fs.statSync(file).mtimeMs };
  counter.decipher = 0;
  return {
    counts: () => ({ decipher: counter.decipher, open: opens.mock.calls.length, fromImage: fromImage.mock.calls.length, create: creates.mock.calls.length, diaryReads }),
    unchanged: () => fs.readFileSync(file).equals(before.bytes) && fs.statSync(file).mtimeMs === before.mtime,
  };
}

const NOTHING = { decipher: 0, open: 0, fromImage: 0, create: 0, diaryReads: 0 };
const linkIn = (mail: MailContent) => /token=([A-Za-z0-9_-]+)/.exec(mail.text)?.[1] ?? '';

describe('a forgot-password request decrypts nothing - not even the recovery key', () => {
  for (const mode of ['hosted', 'local'] as const) {
    for (const withField of [true, false]) {
      it(`${mode} mode, language field ${withField ? 'present' : 'absent'}: no AES-GCM decryption, no diary opened or read; the reset mail is sent`, async () => {
        const { config, auth, account } = await signedOutAccount(mode, 'he');
        if (!withField) {
          // An older record (not signed in since the field exists).
          const file = JSON.parse(fs.readFileSync(config.accountsFile, 'utf8')) as { accounts: Array<Record<string, unknown>> };
          delete file.accounts[0].language;
          fs.writeFileSync(config.accountsFile, JSON.stringify(file, null, 2));
          auth.accounts.reload();
          expect(auth.accounts.findById(account.id)?.language).toBeUndefined();
        }
        const { sent, mailer } = captureMailer();
        const reset = resetService(auth, mailer);
        const watch = watchDiary(config, vaultPathOf(config, account));

        reset.request({ email: 'NOA@example.test', ip: '192.0.2.10', locale: 'de', linkBase: 'https://diary.example' });
        await reset.idle();

        expect(watch.counts()).toEqual(NOTHING);
        expect(watch.unchanged()).toBe(true);
        expect(auth.vaults.size).toBe(0);
        expect(sent).toHaveLength(1);
        expect(sent[0].subject).toBe(t(withField ? 'he' : 'de', 'server.email.reset.subject'));
        expect(linkIn(sent[0])).not.toBe('');
      });
    }
  }

  it('completing the reset is what unwraps the key and opens the diary (the counter is wired)', async () => {
    const { config, auth, account } = await signedOutAccount('hosted');
    const { sent, mailer } = captureMailer();
    const reset = resetService(auth, mailer);
    const watch = watchDiary(config, vaultPathOf(config, account));
    reset.request({ email: 'noa@example.test', ip: '192.0.2.10', locale: 'en', linkBase: 'https://diary.example' });
    await reset.idle();
    expect(watch.counts()).toEqual(NOTHING);

    await reset.resetWithToken(linkIn(sent[0]), NEW_PASSWORD, 'en');
    const after = watch.counts();
    // The recovery key + the diary container (at least these two decryptions), one opening.
    expect(after.decipher).toBeGreaterThanOrEqual(2);
    expect(after.open).toBe(1);
    await reset.idle();
    expect(sent[1].subject).toBe(t('he', 'server.email.changed.subject'));
    // The new password opens the diary.
    expect((await auth.login({ username: 'noa', password: NEW_PASSWORD, rememberMe: false, deviceName: 'pc' })).account.id).toBe(account.id);
  });

  it('a recovery key from another device key: still nothing decrypted by the request; the reset itself then refuses (409 unavailable) and changes nothing', async () => {
    const { config, auth, account } = await signedOutAccount('hosted');
    // As if the device key had been replaced since the account last signed in.
    const foreign = wrapRecoveryKey(randomBytes(32), randomBytes(32), account.id);
    auth.accounts.setRecoveryKey(account.id, foreign);
    const { sent, mailer } = captureMailer();
    const reset = resetService(auth, mailer);
    const diary = vaultPathOf(config, account);
    const watch = watchDiary(config, diary);
    reset.request({ email: 'noa@example.test', ip: '192.0.2.10', locale: 'en', linkBase: 'https://diary.example' });
    await reset.idle();
    expect(watch.counts()).toEqual(NOTHING);
    expect(sent).toHaveLength(1);

    const verifier = auth.accounts.findById(account.id)?.verifierHex;
    const error = await reset.resetWithToken(linkIn(sent[0]), NEW_PASSWORD, 'en').then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).key).toBe('server.reset.unavailable');
    expect(watch.counts().open).toBe(0);
    expect(watch.unchanged()).toBe(true);
    expect(auth.accounts.findById(account.id)?.verifierHex).toBe(verifier);
    // The old password still works, and that sign-in renews the recovery key for this device key.
    await auth.login({ username: 'noa', password: PASSWORD, rememberMe: false, deviceName: 'pc' });
    expect(auth.accounts.findById(account.id)?.recoveryWrappedKey).not.toBe(foreign);
  });

  for (const [label, blob] of [
    ['missing', undefined],
    ['empty', ''],
    ['too short', 'AAAA'],
    ['not base64', '!'.repeat(80)],
  ] as const) {
    it(`a recovery key that is ${label}: the "cannot reset" mail in the request language, nothing decrypted`, async () => {
      const { config, auth, account } = await signedOutAccount('local');
      const file = JSON.parse(fs.readFileSync(config.accountsFile, 'utf8')) as { accounts: Array<Record<string, unknown>> };
      if (blob === undefined) delete file.accounts[0].recoveryWrappedKey;
      else file.accounts[0].recoveryWrappedKey = blob;
      fs.writeFileSync(config.accountsFile, JSON.stringify(file, null, 2));
      auth.accounts.reload();
      expect(auth.accounts.findById(account.id)?.recoveryWrappedKey).toBe(blob || undefined);
      const { sent, mailer } = captureMailer();
      const reset = resetService(auth, mailer);
      const watch = watchDiary(config, vaultPathOf(config, account));
      reset.request({ email: 'noa@example.test', ip: '192.0.2.10', locale: 'fr', linkBase: 'http://127.0.0.1:47000' });
      await reset.idle();
      expect(watch.counts()).toEqual(NOTHING);
      expect(sent).toHaveLength(1);
      expect(sent[0].text).toContain(t('fr', 'server.reset.unavailable'));
      expect(linkIn(sent[0])).toBe('');
    });
  }
});

describe('device-key.ts hasRecoveryKeyShape', () => {
  it('accepts what wrapRecoveryKey writes and nothing else - without the device key', () => {
    for (let i = 0; i < 20; i++) {
      const deviceKey = randomBytes(32);
      const id = `u_${randomBytes(6).toString('hex')}`;
      const blob = wrapRecoveryKey(randomBytes(32), deviceKey, id);
      expect(hasRecoveryKeyShape(blob)).toBe(true);
      // The real check stays with the reset: the same blob opens only with its device key and account.
      expect(unwrapRecoveryKey(blob, deviceKey, id)).toHaveLength(32);
      expect(() => unwrapRecoveryKey(blob, randomBytes(32), id)).toThrow();
    }
    const ok = Buffer.alloc(WRAPPED_KEY_LENGTH, 7).toString('base64');
    expect(hasRecoveryKeyShape(ok)).toBe(true);
    for (const bad of [undefined, null, 42, '', 'AAAA', Buffer.alloc(WRAPPED_KEY_LENGTH - 1).toString('base64'), Buffer.alloc(WRAPPED_KEY_LENGTH + 1).toString('base64'), `${ok}\n`, ok.replace(/=*$/, '') + '==', ok.slice(0, -1) + '!']) {
      expect(hasRecoveryKeyShape(bad), String(bad)).toBe(false);
    }
    expect(counter.decipher).toBe(20 * 2);
  });
});
