import fs from 'node:fs';
import path from 'node:path';
import { REMEMBER_ME_TTL_DAYS, SESSION_TTL_HOURS } from '@shared/constants';
import { afterAll, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import { AccountsStore, EMAIL_TAKEN_KEY, emailTaken, newAccountId, normalizeEmail } from '../src/security/accounts';

const EMAIL_TAKEN_MESSAGE = t('en', EMAIL_TAKEN_KEY);
import { loadOrCreateDeviceKey } from '../src/security/device-key';
import { hashToken, SessionStore } from '../src/security/sessions';
import type { AccountRecord, Session } from '../src/security/session-types';
import { cleanupTempDirs, TEST_ACCOUNT, tempDataDir } from './helpers';

afterAll(cleanupTempDirs);

function account(overrides: Partial<AccountRecord> = {}): AccountRecord {
  const id = newAccountId();
  return { ...TEST_ACCOUNT, id, dbFile: `${id}.mpd`, ...overrides };
}

describe('AccountsStore', () => {
  it('starts empty, persists atomically and reloads', () => {
    const file = path.join(tempDataDir(), 'accounts.json');
    const store = new AccountsStore(file);
    expect(store.list()).toEqual([]);
    const a = account({ username: 'Dana', usernameLower: 'dana' });
    store.add(a);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
    const text = fs.readFileSync(file, 'utf8');
    expect(text).toContain('"Dana"');
    expect(text).not.toContain('password');

    const again = new AccountsStore(file);
    expect(again.list()).toHaveLength(1);
    expect(again.findById(a.id)).toEqual(a);
  });

  it('finds usernames case-insensitively and enforces uniqueness', () => {
    const store = new AccountsStore(path.join(tempDataDir(), 'accounts.json'));
    store.add(account({ username: 'Dana', usernameLower: 'dana' }));
    expect(store.findByUsername('DANA')?.username).toBe('Dana');
    expect(store.findByUsername('  dana ')?.username).toBe('Dana');
    expect(store.findByUsername('nobody')).toBeNull();
    expect(() => store.add(account({ username: 'dAnA', usernameLower: 'dana' }))).toThrow(
      expect.objectContaining({ code: 'USERNAME_TAKEN', status: 409 }),
    );
  });

  it('updates and removes records; returned records are copies', () => {
    const store = new AccountsStore(path.join(tempDataDir(), 'accounts.json'));
    const a = account({ username: 'x1', usernameLower: 'x1' });
    store.add(a);
    const copy = store.findById(a.id)!;
    copy.firstName = 'changed';
    copy.kdf.saltHex = 'ff'.repeat(16);
    expect(store.findById(a.id)!.firstName).toBe(TEST_ACCOUNT.firstName);
    expect(store.findById(a.id)!.kdf.saltHex).toBe(TEST_ACCOUNT.kdf.saltHex);

    store.update({ ...a, firstName: 'רון', verifierHex: 'ab'.repeat(32) });
    expect(store.findById(a.id)!.firstName).toBe('רון');
    expect(store.findById(a.id)!.verifierHex).toBe('ab'.repeat(32));
    expect(() => store.update({ ...a, id: 'u_missing' })).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));

    store.remove(a.id);
    expect(store.findById(a.id)).toBeNull();
    store.remove(a.id); // idempotent
    expect(store.list()).toEqual([]);
  });

  it('ignores malformed entries but fails loudly on a corrupt file', () => {
    const file = path.join(tempDataDir(), 'accounts.json');
    fs.writeFileSync(file, JSON.stringify({ version: 1, accounts: [{ id: 'bad' }, account()] }));
    expect(new AccountsStore(file).list()).toHaveLength(1);
    fs.writeFileSync(file, '{not json');
    expect(() => new AccountsStore(file)).toThrow(expect.objectContaining({ code: 'IO' }));
  });

  it('records the last sign-in time (touchLogin) and persists it; older records simply lack it', () => {
    const file = path.join(tempDataDir(), 'accounts.json');
    const store = new AccountsStore(file);
    const a = account({ username: 'dana', usernameLower: 'dana' });
    store.add(a);
    expect(store.findById(a.id)!.lastLoginAt).toBeUndefined();
    expect(store.touchLogin('u_missing', '2026-09-20T07:00:00.000Z')).toBeNull();

    const touched = store.touchLogin(a.id, '2026-09-20T07:00:00.000Z');
    expect(touched).toMatchObject({ id: a.id, lastLoginAt: '2026-09-20T07:00:00.000Z' });
    // Returned record is a copy.
    touched!.lastLoginAt = 'changed';
    expect(store.findById(a.id)!.lastLoginAt).toBe('2026-09-20T07:00:00.000Z');
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).accounts[0].lastLoginAt).toBe('2026-09-20T07:00:00.000Z');

    // Reload keeps it; a later login replaces it.
    expect(new AccountsStore(file).findById(a.id)!.lastLoginAt).toBe('2026-09-20T07:00:00.000Z');
    store.touchLogin(a.id, '2026-09-21T07:00:00.000Z');
    expect(new AccountsStore(file).findById(a.id)!.lastLoginAt).toBe('2026-09-21T07:00:00.000Z');

    // A file from an older version (no field) or a hand-edited null loads without the field;
    // a non-string value makes the record malformed.
    const older = account({ username: 'ron', usernameLower: 'ron' });
    const nulled = { ...account({ username: 'noa', usernameLower: 'noa' }), lastLoginAt: null };
    const broken = { ...account({ username: 'bad', usernameLower: 'bad' }), lastLoginAt: 12345 };
    fs.writeFileSync(file, JSON.stringify({ version: 1, accounts: [older, nulled, broken] }));
    const reloaded = new AccountsStore(file);
    expect(reloaded.list().map((r) => r.username)).toEqual(['ron', 'noa']);
    expect('lastLoginAt' in reloaded.findById(older.id)!).toBe(false);
    expect('lastLoginAt' in reloaded.findById(nulled.id)!).toBe(false);
  });

  it('finds e-mails case-insensitively, enforces their uniqueness and resolves a login by username or e-mail', () => {
    const file = path.join(tempDataDir(), 'accounts.json');
    const store = new AccountsStore(file);
    const dana = account({ username: 'Dana', usernameLower: 'dana', email: 'Dana@Example.com', emailLower: 'dana@example.com' });
    store.add(dana);
    expect(store.findByEmail('DANA@EXAMPLE.COM')?.id).toBe(dana.id);
    expect(store.findByEmail('  dana@example.com ')?.username).toBe('Dana');
    expect(store.findByEmail('nobody@example.com')).toBeNull();
    expect(store.findByEmail('')).toBeNull();
    expect(store.findByEmail('   ')).toBeNull();
    // Login lookup: either identifier, neither case-sensitive; a username never looks like an e-mail.
    expect(store.findByLogin('dana')?.id).toBe(dana.id);
    expect(store.findByLogin('DANA')?.id).toBe(dana.id);
    expect(store.findByLogin('dana@example.com')?.id).toBe(dana.id);
    expect(store.findByLogin('ron')).toBeNull();
    expect(store.findByLogin('ron@example.com')).toBeNull();
    // The lower-cased key is derived from the e-mail on add, whatever the caller passed.
    const stored = store.findById(dana.id)!;
    expect(stored.email).toBe('Dana@Example.com');
    expect(stored.emailLower).toBe('dana@example.com');
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).accounts[0]).toMatchObject({ email: 'Dana@Example.com', emailLower: 'dana@example.com' });

    // A second account with the same address (any case, padded) is refused: 409 VALIDATION on the e-mail field.
    const dup = account({ username: 'ron', usernameLower: 'ron', email: ' DANA@example.COM ', emailLower: 'whatever' });
    expect(() => store.add(dup)).toThrow(expect.objectContaining({ code: 'VALIDATION', status: 409, field: 'email', message: EMAIL_TAKEN_MESSAGE }));
    expect(store.list()).toHaveLength(1);
    expect(emailTaken().toBody()).toEqual({ code: 'VALIDATION', message: EMAIL_TAKEN_MESSAGE, field: 'email' });
    expect(normalizeEmail('  Dana@Example.COM ')).toBe('dana@example.com');

    // Updating an account onto another one's e-mail is refused too; onto its own is fine.
    const ron = account({ username: 'ron', usernameLower: 'ron', email: 'ron@example.com', emailLower: 'ron@example.com' });
    store.add(ron);
    expect(() => store.update({ ...ron, email: 'dana@example.com' })).toThrow(expect.objectContaining({ status: 409, field: 'email' }));
    store.update({ ...ron, email: 'Ron@Example.com' });
    expect(store.findById(ron.id)).toMatchObject({ email: 'Ron@Example.com', emailLower: 'ron@example.com' });

    // Records from before the field existed (or with a blank / null e-mail) load without it and never match an e-mail.
    const older = account({ username: 'noa', usernameLower: 'noa' });
    const blank = { ...account({ username: 'gal', usernameLower: 'gal' }), email: '  ', emailLower: '' };
    const nulled = { ...account({ username: 'tal', usernameLower: 'tal' }), email: null, emailLower: null };
    const broken = { ...account({ username: 'bad', usernameLower: 'bad' }), email: 42 };
    fs.writeFileSync(file, JSON.stringify({ version: 1, accounts: [dana, older, blank, nulled, broken] }));
    const reloaded = new AccountsStore(file);
    expect(reloaded.list().map((r) => r.username)).toEqual(['Dana', 'noa', 'gal', 'tal']);
    for (const legacy of [older, blank, nulled]) {
      const rec = reloaded.findById(legacy.id)!;
      expect('email' in rec).toBe(false);
      expect('emailLower' in rec).toBe(false);
    }
    expect(reloaded.findByEmail('')).toBeNull();
    expect(reloaded.findByLogin('noa')?.id).toBe(older.id);
    expect(reloaded.findByEmail('dana@example.com')?.id).toBe(dana.id);
    // Two legacy records without an e-mail never clash with each other.
    reloaded.add(account({ username: 'yam', usernameLower: 'yam' }));
    expect(reloaded.list()).toHaveLength(5);
  });
});

describe('SessionStore', () => {
  function makeStore(dir = tempDataDir(), opts: { now?: () => Date; onRemoved?: (s: Session) => void } = {}) {
    const deviceKey = loadOrCreateDeviceKey(path.join(dir, 'device.key'));
    return { store: new SessionStore(path.join(dir, 'sessions.json'), deviceKey, opts), dir, deviceKey };
  }

  it('creates sessions with base64url tokens and only stores their hash', () => {
    const { store, dir } = makeStore();
    const key = Buffer.alloc(32, 5);
    const { token, session } = store.create('u1', false, 'מחשב', key);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.tokenHash).toBe(hashToken(token));
    expect(session.rememberMe).toBe(false);
    expect(session.deviceName).toBe('מחשב');
    expect(session.notified).toBeInstanceOf(Set);
    const ttlMs = Date.parse(session.expiresAt) - Date.parse(session.createdAt);
    expect(ttlMs).toBe(SESSION_TTL_HOURS * 3_600_000);
    expect(store.resolve(token)).toBe(session);
    expect(store.resolve('nope')).toBeNull();
    expect(store.findById(session.id)).toBe(session);
    // Regular sessions never touch the disk.
    expect(fs.existsSync(path.join(dir, 'sessions.json'))).toBe(false);
    expect(store.wrappedKeyOf(session)).toBeNull();
  });

  it('persists remember-me sessions with a wrapped key that survives a reload', () => {
    const { store, dir } = makeStore();
    const key = Buffer.alloc(32, 7);
    const { token, session } = store.create('u1', true, 'טלפון', key);
    const ttlMs = Date.parse(session.expiresAt) - Date.parse(session.createdAt);
    expect(ttlMs).toBe(REMEMBER_ME_TTL_DAYS * 86_400_000);
    const file = path.join(dir, 'sessions.json');
    const text = fs.readFileSync(file, 'utf8');
    expect(text).toContain(session.tokenHash);
    expect(text).not.toContain(token);
    expect(text).not.toContain(key.toString('base64'));
    expect(text).not.toContain(key.toString('hex'));

    const reloaded = makeStore(dir).store;
    const again = reloaded.resolve(token);
    expect(again?.id).toBe(session.id);
    expect(again?.rememberMe).toBe(true);
    expect(reloaded.wrappedKeyOf(again!)?.equals(key)).toBe(true);
    // A different device key cannot unwrap it: the session is dropped.
    const otherDir = tempDataDir();
    fs.copyFileSync(file, path.join(otherDir, 'sessions.json'));
    const foreign = makeStore(otherDir).store;
    const s = foreign.resolve(token);
    expect(s).not.toBeNull();
    expect(foreign.wrappedKeyOf(s!)).toBeNull();
    expect(foreign.resolve(token)).toBeNull();
  });

  it('purges expired sessions and reports removals', () => {
    let now = new Date('2026-09-08T10:00:00Z');
    const removed: string[] = [];
    const { store } = makeStore(tempDataDir(), { now: () => now, onRemoved: (s) => removed.push(s.id) });
    const { token: t1, session: s1 } = store.create('u1', false, 'a', Buffer.alloc(32, 1));
    const { token: t2, session: s2 } = store.create('u1', true, 'b', Buffer.alloc(32, 1));
    now = new Date(now.getTime() + (SESSION_TTL_HOURS + 1) * 3_600_000);
    expect(store.resolve(t1)).toBeNull();
    expect(removed).toEqual([s1.id]);
    expect(store.resolve(t2)?.id).toBe(s2.id);
    now = new Date(now.getTime() + (REMEMBER_ME_TTL_DAYS + 1) * 86_400_000);
    expect(store.list('u1')).toEqual([]);
    expect(removed).toEqual([s1.id, s2.id]);
  });

  it('lists, removes, removes-all and rewraps per user', () => {
    const { store, dir } = makeStore();
    const key = Buffer.alloc(32, 1);
    const a = store.create('u1', true, 'a', key);
    const b = store.create('u1', false, 'b', key);
    const c = store.create('u2', true, 'c', key);
    expect(store.list('u1').map((s) => s.id)).toEqual([a.session.id, b.session.id]);
    expect(store.list('u2').map((s) => s.id)).toEqual([c.session.id]);

    const newKey = Buffer.alloc(32, 2);
    store.rewrapAllForUser('u1', newKey);
    expect(store.wrappedKeyOf(a.session)?.equals(newKey)).toBe(true);
    expect(store.wrappedKeyOf(c.session)?.equals(key)).toBe(true);
    expect(makeStore(dir).store.wrappedKeyOf(store.resolve(a.token)!)?.equals(newKey)).toBe(true);

    expect(store.remove(b.session.id)).toBe(true);
    expect(store.remove(b.session.id)).toBe(false);
    expect(store.resolve(b.token)).toBeNull();
    expect(store.removeAllForUser('u1')).toBe(1);
    expect(store.resolve(a.token)).toBeNull();
    expect(store.resolve(c.token)).not.toBeNull();
    expect(makeStore(dir).store.resolve(c.token)).not.toBeNull();
    expect(makeStore(dir).store.resolve(a.token)).toBeNull();
  });

  it('touches lastSeenAt and flushes it on close', () => {
    let now = new Date('2026-09-08T10:00:00Z');
    const { store, dir } = makeStore(tempDataDir(), { now: () => now });
    const { token, session } = store.create('u1', true, 'a', Buffer.alloc(32, 1));
    now = new Date(now.getTime() + 60_000);
    store.touch(session);
    expect(session.lastSeenAt).toBe(now.toISOString());
    store.close();
    expect(makeStore(dir).store.resolve(token)?.lastSeenAt).toBe(now.toISOString());
  });

  it('survives a corrupt sessions file (users just log in again)', () => {
    const dir = tempDataDir();
    fs.writeFileSync(path.join(dir, 'sessions.json'), '{{{');
    const { store } = makeStore(dir);
    expect(store.size).toBe(0);
  });
});
