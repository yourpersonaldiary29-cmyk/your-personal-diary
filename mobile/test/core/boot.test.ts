// @vitest-environment node
/**
 * The mobile core booted in-process (mobile/core/boot.ts) on a MemoryStorage: the composition
 * starts, answers like the API, writes through the VFS, and the control actions do what the
 * host expects. The desktop comparison is contract.test.ts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthResponse, Entry, ServerInfo, ServerSettings, UserProfile } from '@shared/types';
import { ApiError } from '../../../server/src/errors';
import type { SmtpTransport } from '../../../server/src/mail/transport';
import { MOBILE_RESET_LINK_BASE, mobileResetLink } from '../../core/app';
import { changesHabits, ioErrorKey, ioFailureResponse, isDownload, isSessionRequest, isStorageIndependent, toCoreResponse } from '../../core/boot';
import { MemoryStorage } from '../../host/storage/memory';
import { StorageError, type StorageBackend } from '../../shared/storage-protocol';
import type { CoreEvent } from '../../shared/transport';
import { FaultyStorage } from '../vfs/helpers';
import { bootTestCore, memoryStorageOf, type CoreRig } from './helpers';

const PASSWORD = 'Passw0rd!';
const rigs: CoreRig[] = [];
afterEach(async () => {
  for (const rig of rigs.splice(0).reverse()) await rig.shutdown().catch(() => undefined);
});

async function boot(options: Parameters<typeof bootTestCore>[0] = {}): Promise<CoreRig> {
  const rig = await bootTestCore(options);
  rigs.push(rig);
  return rig;
}

async function register(rig: CoreRig, username = 'dana', locale = 'he'): Promise<AuthResponse> {
  const res = await rig.call('/api/auth/register', {
    method: 'POST',
    locale,
    body: { firstName: 'דנה', lastName: 'כהן', username, email: `${username}@example.test`, password: PASSWORD, confirmPassword: PASSWORD, rememberMe: true, deviceName: 'Phone' },
  });
  expect(res.status, JSON.stringify(res.json)).toBe(201);
  return res.json as AuthResponse;
}

describe('mobile core boot', () => {
  it('boots on an empty storage, answers /api/health and /api/server/info like a desktop without network features', async () => {
    const rig = await boot();
    const health = await rig.call('/api/health');
    expect(health.status).toBe(200);
    expect(health.json).toMatchObject({ ok: true });
    expect(health.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(health.headers['x-content-type-options']).toBe('nosniff');

    const info = (await rig.call('/api/server/info')).json as ServerInfo;
    expect(info).toMatchObject({
      port: 0,
      lanEnabled: false,
      lanUrls: [],
      dataDir: '/data',
      isLocalRequest: true,
      remoteEnabled: false,
      remoteUrl: '',
      secure: false,
      passwordResetAvailable: false,
    });
    // The start-up left device.key and the users directory in the storage, nothing else.
    expect([...(await rig.files()).keys()].sort()).toEqual(['device.key']);
    expect((await rig.storage.stat('users'))?.type).toBe('directory');
  });

  it('register -> files in the storage; the account is the owner and sees no remote card', async () => {
    const rig = await boot();
    const auth = await register(rig);
    expect(auth.user).toMatchObject({ username: 'dana', email: 'dana@example.test' });
    expect(auth.rememberMe).toBe(true);
    const files = await rig.files();
    // The diary was saved twice before the answer: created empty, then with the account's language.
    expect([...files.keys()].sort()).toEqual(['accounts.json', 'device.key', 'sessions.json', `users/${auth.user.id}.mpd`, `users/${auth.user.id}.mpd.prev`]);

    const settings = (await rig.call('/api/server/settings', { token: auth.token })).json as ServerSettings;
    expect(settings).toEqual({ port: 0, lanEnabled: false, isRemoteOwner: false, isMailOwner: true, isLanOwner: true });
    const remote = await rig.call('/api/server/remote', { token: auth.token });
    expect(remote.status).toBe(403);
    const mail = await rig.call('/api/server/mail', { token: auth.token });
    expect(mail.status).toBe(200);
    expect(mail.json).toMatchObject({ enabled: false, ready: false, smtpPasswordSet: false });

    // The account started in the language of the sign-up screen (Accept-Language: he).
    const appSettings = await rig.call('/api/settings', { token: auth.token });
    expect(appSettings.json).toMatchObject({ language: 'he' });
  });

  it('a diary entry survives a "restart": a new core on the same storage, remember-me session included', async () => {
    const first = await boot();
    const auth = await register(first);
    const created = await first.call('/api/entries', {
      token: auth.token,
      method: 'POST',
      body: { date: '2026-10-01', time: '08:30', title: 'First', body: 'Fictional entry.', mood: 4, emotions: ['calm'], events: [], people: [], tags: ['test'] },
    });
    expect(created.status).toBe(201);
    await first.shutdown();

    const second = await boot({ storage: first.storage });
    const me = await second.call('/api/auth/me', { token: auth.token });
    expect(me.status).toBe(200);
    expect((me.json as { user: UserProfile }).user.username).toBe('dana');
    const list = await second.call('/api/entries', { token: auth.token });
    expect((list.json as { items: Entry[] }).items.map((e) => e.title)).toEqual(['First']);
  });

  it('an answer is given only when the change is in the storage: the app killed right after it loses nothing (entry, habit, setting)', async () => {
    const first = await boot();
    const auth = await register(first, 'dana', 'en');
    await first.core.flushAll();
    const diary = `users/${auth.user.id}.mpd`;
    const sizeBefore = first.storage.files().get(diary)?.byteLength ?? 0;

    // The storage exactly as it is when each answer arrives (`files()` is synchronous): what the
    // next start finds when the phone kills the app at that moment. Nothing flushes in between -
    // the vault's own save would come 250 ms after the write.
    const created = await first.call('/api/entries', {
      token: auth.token,
      method: 'POST',
      body: { date: '2026-10-02', time: '21:15', title: 'Saved for real', body: 'Fictional text. '.repeat(2500), mood: 3, emotions: [], events: [], people: [], tags: [] },
    });
    const afterEntry = first.storage.files();
    expect(created.status, JSON.stringify(created.json)).toBe(201);
    expect(afterEntry.get(diary)?.byteLength ?? 0).toBeGreaterThan(sizeBefore + 20_000);

    const habit = await first.call('/api/habits', { token: auth.token, method: 'POST', body: { name: 'Read', description: '', target: 1, unit: 'times', frequency: 'daily', reminderEnabled: false, reminderTime: null } });
    const afterHabit = first.storage.files();
    expect(habit.status, JSON.stringify(habit.json)).toBe(201);

    const settings = await first.call('/api/settings', { token: auth.token, method: 'PUT', body: { language: 'fr' } });
    const afterSettings = first.storage.files();
    expect(settings.status, JSON.stringify(settings.json)).toBe(200);
    // Nothing is left for a later save: the diary in memory is clean at every answer.
    expect(first.core.auth.vaults.get(auth.user.id)?.db.isDirty()).toBe(false);
    await first.shutdown();

    const entryCore = await boot({ storage: await memoryStorageOf(afterEntry) });
    const entries = await entryCore.call('/api/entries', { token: auth.token });
    expect(entries.status).toBe(200);
    expect((entries.json as { items: Entry[] }).items.map((e) => e.title)).toEqual(['Saved for real']);
    expect(((await entryCore.call('/api/habits', { token: auth.token })).json as unknown[]).length).toBe(0);
    await entryCore.shutdown();

    const habitCore = await boot({ storage: await memoryStorageOf(afterHabit) });
    expect(((await habitCore.call('/api/habits', { token: auth.token })).json as Array<{ name: string }>).map((h) => h.name)).toEqual(['Read']);
    expect((await habitCore.call('/api/settings', { token: auth.token })).json).toMatchObject({ language: 'en' });
    await habitCore.shutdown();

    const settingsCore = await boot({ storage: await memoryStorageOf(afterSettings) });
    expect((await settingsCore.call('/api/settings', { token: auth.token })).json).toMatchObject({ language: 'fr' });
    expect(((await settingsCore.call('/api/entries', { token: auth.token })).json as { total: number }).total).toBe(1);
  });

  it('save-to-disk requests are refused with 400 and nothing is written outside /data', async () => {
    const rig = await boot();
    const auth = await register(rig);
    const backup = await rig.call('/api/backup/create', { token: auth.token, method: 'POST', body: { destPath: '/sdcard/diary.mpd' } });
    expect(backup.status).toBe(400);
    expect(backup.json).toMatchObject({ code: 'VALIDATION', field: 'destPath' });
    const inspect = await rig.call('/api/backup/inspect', { token: auth.token, method: 'POST', body: { srcPath: '/sdcard/diary.mpd' } });
    expect(inspect.status).toBe(400);
    expect(inspect.json).toMatchObject({ code: 'VALIDATION', field: 'srcPath' });
    const exported = await rig.call('/api/export', { token: auth.token, method: 'POST', locale: 'he', body: { format: 'txt', destPath: '/sdcard/x.txt' } });
    expect(exported.status).toBe(400);
    expect(exported.json).toMatchObject({ code: 'VALIDATION', field: 'destPath' });
    expect((exported.json as { message: string }).message).not.toMatch(/[a-z]{4}/); // Hebrew message
    expect(rig.core.vfs.exists('/sdcard/x.txt')).toBe(false);
    // The download form works.
    const download = await rig.call('/api/export', { token: auth.token, method: 'POST', body: { format: 'txt' } });
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toMatch(/^text\/plain/);
    expect(download.headers['content-disposition']).toMatch(/^attachment; filename=/);
  });

  it('the mail stub: settings can be saved, the test e-mail fails cleanly with the connect error', async () => {
    const rig = await boot();
    const auth = await register(rig);
    const saved = await rig.call('/api/server/mail', {
      token: auth.token,
      method: 'PUT',
      body: { password: PASSWORD, enabled: true, host: 'smtp.example.test', port: 465, security: 'tls', username: 'diary@example.test', smtpPassword: 'app-password', fromAddress: '' },
    });
    expect(saved.status, JSON.stringify(saved.json)).toBe(200);
    expect(saved.json).toMatchObject({ enabled: true, ready: true, smtpPasswordSet: true });
    expect(((await rig.call('/api/server/info')).json as ServerInfo).passwordResetAvailable).toBe(true);
    const test = await rig.call('/api/server/mail/test', { token: auth.token, method: 'POST', locale: 'en' });
    expect(test.status).toBe(502);
    expect(test.json).toMatchObject({ code: 'OTHER', message: expect.stringContaining('smtp.example.test:465') });
  });

  it('a password-reset e-mail composed on the phone carries the deep link of the plan, yourpersonaldiary://reset?token=... (not http://127.0.0.1:0), and its link and code work', async () => {
    const sent: Array<{ host: string; to: string; data: string }> = [];
    const transport: SmtpTransport = {
      send: async (opts, envelope, data) => {
        sent.push({ host: opts.host, to: envelope.to, data });
      },
    };
    /** The text and the HTML part of a message of mail/mime.ts (both base64). */
    const partsOf = (data: string): { text: string; html: string } => {
      const boundary = /boundary="([^"]+)"/.exec(data)?.[1] ?? '';
      const [text, html] = data
        .split(`--${boundary}`)
        .slice(1, 3)
        .map((part) => Buffer.from(part.split('\r\n\r\n').slice(1).join('').replace(/\s+/g, ''), 'base64').toString('utf8'));
      return { text, html };
    };
    const rig = await boot({ mailTransport: transport, passwordReset: { backgroundDelayMs: () => 0 } });
    const auth = await register(rig, 'dana', 'en');
    const saved = await rig.call('/api/server/mail', {
      token: auth.token,
      method: 'PUT',
      body: { password: PASSWORD, enabled: true, host: 'smtp.example.test', port: 465, security: 'tls', username: 'diary@example.test', smtpPassword: 'app-password', fromAddress: '' },
    });
    expect(saved.status, JSON.stringify(saved.json)).toBe(200);

    const asked = await rig.call('/api/auth/forgot-password', { method: 'POST', body: { email: 'dana@example.test' } });
    expect(asked.status, JSON.stringify(asked.json)).toBe(200);
    await rig.core.passwordReset.idle();
    expect(sent.map((m) => [m.host, m.to])).toEqual([['smtp.example.test', 'dana@example.test']]);
    const { text, html } = partsOf(sent[0].data);

    // Nothing listens on the phone: no loopback address, no port 0, no http link at all.
    expect(MOBILE_RESET_LINK_BASE).toBe('yourpersonaldiary://reset');
    expect(mobileResetLink('abc-DEF_123')).toBe('yourpersonaldiary://reset?token=abc-DEF_123');
    for (const part of [text, html]) {
      expect(part).not.toContain('127.0.0.1');
      expect(part).not.toMatch(/https?:\/\//);
      // The deep link form of docs/ANDROID-PLAN.md 3.1: the token in the query, not the UI route of the desktop link.
      expect(part).not.toContain('#/reset-password');
    }
    const link = /yourpersonaldiary:\/\/reset\?token=([\w-]+)/.exec(text);
    expect(link, text).not.toBeNull();
    expect(html).toContain(`href="${link?.[0]}"`);
    // The desktop's "the link opens the diary on the computer where it is installed" is not said here.
    expect(text).not.toMatch(/computer/i);
    const code = /^\d{6}$/m.exec(text)?.[0];
    expect(code, text).toBeDefined();

    // The token of the link is the one the app's /#/reset-password page sends.
    const reset = await rig.call('/api/auth/reset-password', { method: 'POST', body: { token: link?.[1], newPassword: 'N3w-Passw0rd!', confirmPassword: 'N3w-Passw0rd!' } });
    expect(reset.status, JSON.stringify(reset.json)).toBe(200);
    const login = await rig.call('/api/auth/login', { method: 'POST', body: { username: 'dana', password: 'N3w-Passw0rd!', rememberMe: false, deviceName: 'Phone' } });
    expect(login.status, JSON.stringify(login.json)).toBe(200);
    await rig.core.passwordReset.idle();
  });

  it('control: flushAll persists, lockAll locks every real session (423 on data routes), shutdown closes', async () => {
    const rig = await boot();
    const auth = await register(rig);
    const guest = await rig.call('/api/auth/guest', { method: 'POST', body: {} });
    expect(guest.status).toBe(201);
    const guestToken = (guest.json as AuthResponse).token;

    await rig.core.flushAll();
    await rig.core.lockAll();
    expect((await rig.call('/api/entries', { token: auth.token })).status).toBe(423);
    expect((await rig.call('/api/auth/me', { token: auth.token })).json).toMatchObject({ session: { locked: true } });
    // The guest cannot be locked (nothing could unlock it): it goes on.
    expect((await rig.call('/api/entries', { token: guestToken })).status).toBe(200);
    const unlock = await rig.call('/api/auth/verify-password', { token: auth.token, method: 'POST', body: { password: PASSWORD } });
    expect(unlock.status).toBe(200);
    expect((await rig.call('/api/entries', { token: auth.token })).status).toBe(200);

    await rig.core.shutdown();
    await rig.core.shutdown();
  });

  it('habits-changed is raised after mutating habit requests only', async () => {
    const rig = await boot();
    const auth = await register(rig);
    rig.events.length = 0;
    expect((await rig.call('/api/habits', { token: auth.token })).status).toBe(200);
    expect(rig.events).toEqual([]);
    const created = await rig.call('/api/habits', { token: auth.token, method: 'POST', body: { name: 'Walk', description: '', target: 1, unit: 'times', frequency: 'daily', reminderEnabled: false, reminderTime: null } });
    expect(created.status, JSON.stringify(created.json)).toBe(201);
    expect(rig.events).toEqual([{ type: 'event', name: 'habits-changed', userId: '' }]);
    // The core does not raise the event itself (that would be BEFORE the answer is posted): it hands
    // it over with the answer, for the worker to post after it.
    rig.events.length = 0;
    const answer = await rig.core.handle({
      type: 'request',
      id: 900,
      method: 'POST',
      url: '/api/habits',
      headers: { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' },
      bodyText: JSON.stringify({ name: 'Swim', description: '', target: 1, unit: 'times', frequency: 'daily', reminderEnabled: false, reminderTime: null }),
    });
    expect(answer.response.status).toBe(201);
    expect(answer.events).toEqual([{ type: 'event', name: 'habits-changed', userId: '' }]);
    expect(rig.events).toEqual([]);
    const read = await rig.core.handle({ type: 'request', id: 901, method: 'GET', url: '/api/habits', headers: { authorization: `Bearer ${auth.token}` } });
    expect(read.events).toEqual([]);
    expect(changesHabits('PUT', '/api/habits/3?x=1', 200)).toBe(true);
    expect(changesHabits('POST', '/api/habits', 400)).toBe(false);
    expect(changesHabits('PUT', '/api/settings', 200)).toBe(true);
    expect(changesHabits('POST', '/api/entries', 201)).toBe(false);
  });

  const storageEvents = (rig: CoreRig): string[] => rig.events.filter((e: CoreEvent) => e.name === 'storage-failed' || e.name === 'storage-recovered').map((e) => e.name);
  const entryBody = (title: string) => ({ date: '2026-10-03', time: '10:00', title, body: 'Fictional entry.', mood: 4, emotions: [], events: [], people: [], tags: [] });
  const HEBREW = /[\u0590-\u05FF]/;

  it('a storage that refuses a write: the request answers 500 IO in the request language (after one retry); others whose own files are stored answer normally', async () => {
    let failing = false;
    const inner = new MemoryStorage();
    const flaky: StorageBackend = {
      list: (d) => inner.list(d),
      read: (p) => inner.read(p),
      write: (p, b) => (failing && p.startsWith('accounts.json') ? Promise.reject(new StorageError('EIO', 'EIO: disk full')) : inner.write(p, b)),
      rename: (f, t) => inner.rename(f, t),
      remove: (p) => inner.remove(p),
      mkdir: (p) => inner.mkdir(p),
      stat: (p) => inner.stat(p),
    };
    const rig = await boot({ storage: flaky, storageRetryMs: 10 });
    const dana = await register(rig, 'dana');
    failing = true;
    // The registry is written during the request itself: the drain barrier reports the failure.
    const second = await rig.call('/api/auth/register', {
      method: 'POST',
      locale: 'he',
      body: { firstName: 'יוסי', lastName: 'לוי', username: 'yossi', email: 'yossi@example.test', password: PASSWORD, confirmPassword: PASSWORD, rememberMe: false, deviceName: 'Phone' },
    });
    expect(second.status).toBe(500);
    expect(second.json).toMatchObject({ code: 'IO' });
    expect((second.json as { message: string }).message).toMatch(HEBREW);
    expect(rig.logs.some((line) => line.startsWith('warn: storage drain failed, retrying'))).toBe(true);
    expect(storageEvents(rig)).toEqual(['storage-failed']);
    expect(rig.core.vfs.outOfSync()).toContain('accounts.json');

    // The registry is still refused - but a diary entry does not touch it: its own file is stored,
    // so it is answered as saved (and it is: a copy of the storage at the answer has it).
    const saved = await rig.call('/api/entries', { token: dana.token, method: 'POST', body: entryBody('While the registry is refused') });
    const atAnswer = inner.files();
    expect(saved.status, JSON.stringify(saved.json)).toBe(201);
    // Nor does a request that changes nothing (a search is a POST).
    const search = await rig.call('/api/search', { token: dana.token, method: 'POST', body: { query: 'registry', limit: 5 } });
    expect(search.status, JSON.stringify(search.json)).toBe(200);
    expect(storageEvents(rig)).toEqual(['storage-failed']);

    failing = false;
    // The mirror still has the record and answers from it; the core stores it by itself.
    const list = await rig.call('/api/auth/accounts');
    expect(list.status).toBe(200);
    expect((list.json as { accounts: Array<{ username: string }> }).accounts.map((a) => a.username).sort()).toEqual(['dana', 'yossi']);
    await vi.waitFor(() => expect(storageEvents(rig)).toEqual(['storage-failed', 'storage-recovered']), { timeout: 5000, interval: 10 });
    const stored = new TextDecoder().decode((await rig.files()).get('accounts.json'));
    expect(stored).toContain('yossi');
    expect(rig.core.vfs.outOfSync()).toEqual([]);
    await rig.shutdown();

    const copy = await boot({ storage: await memoryStorageOf(atAnswer) });
    const entries = await copy.call('/api/entries', { token: dana.token });
    expect((entries.json as { items: Entry[] }).items.map((e) => e.title)).toEqual(['While the registry is refused']);
  });

  it('a storage that refuses every write: saving answers 500 IO - reading, searching, the export and the backup download go on; the host is told once; the core recovers by itself', async () => {
    const memory = new MemoryStorage();
    const faulty = new FaultyStorage(memory);
    const rig = await boot({ storage: faulty, storageRetryMs: 10 });
    const auth = await register(rig, 'dana', 'en');
    const token = auth.token;
    for (const title of ['One', 'Two', 'Three']) {
      expect((await rig.call('/api/entries', { token, method: 'POST', body: entryBody(title) })).status).toBe(201);
    }
    await rig.core.flushAll();
    rig.events.length = 0;

    faulty.failAlways('write');
    const refused = await rig.call('/api/entries', { token, method: 'POST', locale: 'he', body: entryBody('Four') });
    expect(refused.status).toBe(500);
    expect(refused.json).toMatchObject({ code: 'IO' });
    expect((refused.json as { message: string }).message).toMatch(HEBREW);
    expect(rig.events).toEqual([{ type: 'event', name: 'storage-failed' }]);

    // Everything that does not need the storage answers as usual - again and again.
    for (let round = 0; round < 2; round++) {
      expect((await rig.call('/api/health')).status).toBe(200);
      const list = await rig.call('/api/entries?limit=2', { token });
      expect(list.status).toBe(200);
      // The refused entry is in memory (the core keeps trying to store it).
      expect((list.json as { total: number }).total).toBe(4);
      expect((await rig.call('/api/entries/1', { token })).status).toBe(200);
      expect((await rig.call('/api/server/info')).status).toBe(200);
      expect((await rig.call('/api/auth/me', { token })).status).toBe(200);
      expect((await rig.call('/api/search', { token, method: 'POST', body: { query: 'Two', limit: 5 } })).status).toBe(200);
      const exported = await rig.call('/api/export', { token, method: 'POST', body: { format: 'json' } });
      expect(exported.status, JSON.stringify(exported.json)).toBe(200);
      expect(exported.headers['content-disposition']).toMatch(/^attachment; filename=/);
      expect(String(exported.body)).toContain('Four');
      const pdf = await rig.call('/api/export', { token, method: 'POST', body: { format: 'pdf' } });
      expect(pdf.status).toBe(200);
      const backup = await rig.call('/api/backup/create', { token, method: 'POST', body: {} });
      expect(backup.status, JSON.stringify(backup.json)).toBe(200);
      expect((backup.body as Uint8Array).byteLength).toBeGreaterThan(1000);
    }
    // The session can be locked, unlocked, opened and closed although sessions.json cannot be
    // written (the lock screen of a full phone must not be a dead end).
    expect((await rig.call('/api/auth/lock', { token, method: 'POST', body: {} })).status).toBe(204);
    expect((await rig.call('/api/entries', { token })).status).toBe(423);
    expect((await rig.call('/api/auth/verify-password', { token, method: 'POST', body: { password: PASSWORD } })).status).toBe(200);
    expect((await rig.call('/api/entries', { token })).status).toBe(200);
    const login = await rig.call('/api/auth/login', { method: 'POST', body: { username: 'dana', password: PASSWORD, rememberMe: true, deviceName: 'Tablet' } });
    expect(login.status, JSON.stringify(login.json)).toBe(200);
    const second = (login.json as AuthResponse).token;
    expect((await rig.call('/api/entries', { token: second })).status).toBe(200);
    // What must be stored to be true is still refused: a changed profile, a new account.
    const profile = await rig.call('/api/auth/profile', { token, method: 'PUT', body: { firstName: 'Dana', lastName: 'Levi' } });
    expect([profile.status, (profile.json as { code?: string }).code]).toEqual([500, 'IO']);
    // A second save is refused like the first; the host was told once, not once per request.
    expect((await rig.call('/api/entries', { token, method: 'POST', body: entryBody('Five') })).status).toBe(500);
    await expect(rig.core.flushAll()).rejects.toBeDefined();
    expect(storageEvents(rig)).toEqual(['storage-failed']);

    // Space was freed: without any request the core stores what it kept in memory.
    faulty.repair();
    await vi.waitFor(() => expect(storageEvents(rig)).toEqual(['storage-failed', 'storage-recovered']), { timeout: 10_000, interval: 10 });
    expect(rig.core.vfs.outOfSync()).toEqual([]);
    expect(rig.core.auth.vaults.get(auth.user.id)?.db.isDirty()).toBe(false);
    const atRecovery = memory.files();
    expect((await rig.call('/api/entries', { token, method: 'POST', body: entryBody('Six') })).status).toBe(201);
    await rig.shutdown();

    const restarted = await boot({ storage: await memoryStorageOf(atRecovery) });
    const after = await restarted.call('/api/entries?limit=50', { token });
    expect((after.json as { items: Entry[] }).items.map((e) => e.title).sort()).toEqual(['Five', 'Four', 'One', 'Three', 'Two']);
    // The bookkeeping that was refused got stored too: the second remember-me session is back.
    const me = await restarted.call('/api/auth/me', { token: second });
    expect(me.status).toBe(200);
    expect((me.json as { user: UserProfile }).user.username).toBe('dana');
  });

  it('a full phone restarts: the core starts on a storage that refuses writes, the remembered session opens the diary, export and backup work', async () => {
    const memory = new MemoryStorage();
    const first = await boot({ storage: memory });
    const auth = await register(first, 'dana', 'en');
    expect((await first.call('/api/entries', { token: auth.token, method: 'POST', body: entryBody('Before the phone filled up') })).status).toBe(201);
    await first.shutdown();

    const faulty = new FaultyStorage(memory);
    faulty.failAlways('write');
    const full = await boot({ storage: faulty, storageRetryMs: 10 });
    expect((await full.call('/api/health')).status).toBe(200);
    const list = await full.call('/api/entries', { token: auth.token });
    expect(list.status).toBe(200);
    expect((list.json as { items: Entry[] }).items.map((e) => e.title)).toEqual(['Before the phone filled up']);
    expect((await full.call('/api/export', { token: auth.token, method: 'POST', body: { format: 'txt' } })).status).toBe(200);
    expect((await full.call('/api/backup/create', { token: auth.token, method: 'POST', body: {} })).status).toBe(200);
    // Signing in again (the session was not remembered, say) works as well.
    const login = await full.call('/api/auth/login', { method: 'POST', body: { username: 'dana', password: PASSWORD, rememberMe: false, deviceName: 'Phone' } });
    expect(login.status, JSON.stringify(login.json)).toBe(200);
    await full.shutdown().catch(() => undefined);

    // A storage that refuses even the first files of a fresh install: the core starts, says so, and
    // stores them when it can.
    const empty = new FaultyStorage(new MemoryStorage());
    empty.failAlways('write');
    const fresh = await boot({ storage: empty, storageRetryMs: 10 });
    expect((await fresh.call('/api/health')).status).toBe(200);
    expect(storageEvents(fresh)).toEqual(['storage-failed']);
    expect([...(await fresh.files()).keys()]).toEqual([]);
    empty.repair();
    await vi.waitFor(() => expect(storageEvents(fresh)).toEqual(['storage-failed', 'storage-recovered']), { timeout: 10_000, interval: 10 });
    expect([...(await fresh.files()).keys()]).toEqual(['device.key']);
  });

  it('a storage that fails once: the retry stores the diary and the save answers 201', async () => {
    const faulty = new FaultyStorage(new MemoryStorage());
    const rig = await boot({ storage: faulty });
    const auth = await register(rig, 'dana', 'en');
    await rig.core.flushAll();
    rig.events.length = 0;
    faulty.failNext('write', /\.mpd/);
    const saved = await rig.call('/api/entries', { token: auth.token, method: 'POST', body: entryBody('Second attempt') });
    expect(saved.status, JSON.stringify(saved.json)).toBe(201);
    expect(rig.logs.some((line) => line.startsWith('warn: a diary could not be stored, retrying'))).toBe(true);
    expect(storageEvents(rig)).toEqual([]);
    expect(rig.core.vfs.outOfSync()).toEqual([]);
  });

  it('helpers: IO keys by file, response conversion', () => {
    expect(ioErrorKey({ path: 'accounts.json' })).toBe('server.auth.accountsFileUnwritable');
    expect(ioErrorKey({ path: 'sessions.json.tmp-3' })).toBe('server.auth.sessionsFileUnwritable');
    expect(ioErrorKey(new Error("EIO: rename 'users/u.mpd.tmp'"))).toBe('server.vault.writeFailed');
    const failure = ioFailureResponse(7, { 'accept-language': 'he' }, new Error('x'));
    expect(failure.status).toBe(500);
    expect(JSON.parse(failure.bodyText as string)).toMatchObject({ code: 'IO' });
    // The vault's own I/O error keeps its message; any other error is reported by the file it names.
    const replace = JSON.parse(ioFailureResponse(8, { 'accept-language': 'en' }, ApiError.io('server.vault.replaceFailed')).bodyText as string) as { message: string };
    const write = JSON.parse(ioFailureResponse(9, { 'accept-language': 'en' }, ApiError.io('server.vault.writeFailed')).bodyText as string) as { message: string };
    expect(replace.message).not.toBe(write.message);
    expect(JSON.parse(failure.bodyText as string)).toEqual(JSON.parse(ioFailureResponse(7, { 'accept-language': 'he' }, ApiError.io('server.vault.writeFailed')).bodyText as string));
    // Reads and downloads never depend on the storage.
    expect(isStorageIndependent('get', '/api/entries', { status: 200, headers: {} })).toBe(true);
    expect(isStorageIndependent('HEAD', '/api/entries', { status: 500, headers: {} })).toBe(true);
    expect(isStorageIndependent('POST', '/api/entries', { status: 201, headers: { 'content-type': 'application/json' } })).toBe(false);
    expect(isStorageIndependent('POST', '/api/auth/verify-password?x=1', { status: 200, headers: {} })).toBe(true);
    // The session requests - and nothing else of /api/auth.
    for (const route of ['login', 'verify-password', 'lock', 'logout']) expect(isSessionRequest('POST', `/api/auth/${route}`)).toBe(true);
    expect(isSessionRequest('post', '/api/auth/login/')).toBe(true);
    for (const route of ['register', 'change-password', 'delete-account', 'profile', 'reset-password']) expect(isSessionRequest('POST', `/api/auth/${route}`)).toBe(false);
    expect(isSessionRequest('DELETE', '/api/auth/logout')).toBe(false);
    expect(isDownload({ status: 200, headers: { 'content-disposition': 'attachment; filename="diary.pdf"' } })).toBe(true);
    expect(isDownload({ status: 400, headers: { 'content-disposition': 'attachment; filename="x"' } })).toBe(false);
    expect(isDownload({ status: 200, headers: { 'content-disposition': 'inline' } })).toBe(false);
    const text = toCoreResponse(1, { status: 200, headers: {}, body: 'abc' });
    expect(text).toEqual({ type: 'response', id: 1, status: 200, headers: {}, bodyText: 'abc' });
    const view = new Uint8Array(new ArrayBuffer(10), 2, 3);
    const bytes = toCoreResponse(2, { status: 200, headers: {}, body: view });
    expect(bytes.bodyBytes?.byteLength).toBe(3);
    expect(toCoreResponse(3, { status: 204, headers: {}, body: null })).toEqual({ type: 'response', id: 3, status: 204, headers: {} });
  });
});
