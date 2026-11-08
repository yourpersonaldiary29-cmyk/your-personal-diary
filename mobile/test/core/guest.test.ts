// @vitest-environment node
/**
 * Guest mode ("tour") in the mobile core - the one route the desktop server does not mount
 * (docs/API.md, "מצב אורח"): POST /api/auth/guest works because every request of the phone is
 * local; the guest gets the demo diary in memory and nothing of it ever reaches the storage,
 * not even after flushAll; what needs a real account answers 403; a real registration after the
 * tour starts clean and is the owner, and ends the guest session.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import type { AppSettings, AuthResponse, EntryPage, ServerSettings, SessionInfo, UserProfile } from '@shared/types';
import { bootTestCore, type CoreRig } from './helpers';

const PASSWORD = 'Passw0rd!';
const GUEST_MESSAGE_HE = t('he', 'server.auth.guestNotAllowed');

let rig: CoreRig;
afterEach(async () => {
  await rig?.shutdown().catch(() => undefined);
});

async function startGuest(locale = 'he'): Promise<AuthResponse> {
  const res = await rig.call('/api/auth/guest', { method: 'POST', locale, body: { deviceName: 'Phone' } });
  expect(res.status, JSON.stringify(res.json)).toBe(201);
  return res.json as AuthResponse;
}

describe('mobile core: guest mode', () => {
  it('starts a tour in the language of the screen, with the demo diary, and the account is flagged as a guest', async () => {
    rig = await bootTestCore();
    const guest = await startGuest('he');
    expect(guest.guest).toBe(true);
    expect(guest.user.guest).toBe(true);
    expect(guest.rememberMe).toBe(false);
    expect(guest.user.username).toMatch(/^_guest/);
    const me = await rig.call('/api/auth/me', { token: guest.token });
    expect((me.json as { user: UserProfile; session: SessionInfo }).session.guest).toBe(true);
    expect(((await rig.call('/api/settings', { token: guest.token })).json as AppSettings).language).toBe('he');
    const entries = (await rig.call('/api/entries?limit=5', { token: guest.token })).json as EntryPage;
    expect(entries.total).toBeGreaterThan(50);
    // Everything of the diary works on the demo data, including writing (in memory).
    const created = await rig.call('/api/entries', { token: guest.token, method: 'POST', body: { date: '2026-10-01', time: '08:00', title: 'Tour note', body: 'Fictional.', mood: 4, emotions: [], energy: null, stress: null, sleepQuality: null, sleepHours: null, exerciseMinutes: null, exerciseType: '', events: [], people: [], location: '', notes: '', tags: [] } });
    expect(created.status).toBe(201);
    for (const url of ['/api/home', '/api/insights?period=30d', '/api/stats?period=30d', '/api/calendar/month?year=2026&month=9', '/api/habits', '/api/habits/progress?date=2026-09-20']) {
      expect((await rig.call(url, { token: guest.token })).status, url).toBe(200);
    }
    const search = await rig.call('/api/search', { token: guest.token, method: 'POST', locale: 'he', body: { query: 'מצב רוח בשבוע האחרון' } });
    expect(search.status).toBe(200);
    const exported = await rig.call('/api/export', { token: guest.token, method: 'POST', body: { format: 'txt' } });
    expect(exported.status).toBe(200);
    expect(exported.headers['content-disposition']).toMatch(/^attachment/);
    const dataDir = await rig.call('/api/settings/data-dir', { token: guest.token });
    expect(dataDir.json).toMatchObject({ dbPath: '', dbExists: false });
  });

  it('nothing of the guest reaches the storage - not during the tour and not after flushAll', async () => {
    rig = await bootTestCore();
    const before = await rig.files();
    const guest = await startGuest('en');
    await rig.call('/api/habits', { token: guest.token, method: 'POST', body: { name: 'Tour habit', description: '', target: 1, unit: 'times', frequency: 'daily', reminderTime: null, reminderEnabled: false } });
    await rig.core.flushAll();
    const after = await rig.files();
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
    expect([...after.keys()]).toEqual(['device.key']);
    for (const [name, bytes] of after) expect([...bytes], name).toEqual([...(before.get(name) as Uint8Array)]);
    expect(rig.core.vfs.exists('/data/accounts.json')).toBe(false);
    expect(rig.core.vfs.exists('/data/sessions.json')).toBe(false);
  });

  it('what needs a real account answers 403 with the tour message; saving to disk is refused like for everyone', async () => {
    rig = await bootTestCore();
    const guest = await startGuest('he');
    const forbidden: Array<[string, string, unknown]> = [
      ['POST', '/api/backup/create', {}],
      ['POST', '/api/backup/inspect', { fileBase64: 'AAAA', fileName: 'x.mpd' }],
      ['POST', '/api/backup/restore', { fileBase64: 'AAAA', fileName: 'x.mpd', password: PASSWORD }],
      ['PUT', '/api/auth/profile', { firstName: 'X' }],
      ['POST', '/api/auth/verify-password', { password: PASSWORD }],
      ['POST', '/api/auth/lock', undefined],
      ['POST', '/api/auth/change-password', { oldPassword: PASSWORD, newPassword: 'N3w-Passw0rd!', confirmPassword: 'N3w-Passw0rd!' }],
      ['POST', '/api/auth/delete-account', { password: PASSWORD }],
    ];
    for (const [method, url, body] of forbidden) {
      const res = await rig.call(url, { token: guest.token, method, locale: 'he', ...(body === undefined ? {} : { body }) });
      expect(res.status, `${method} ${url}: ${JSON.stringify(res.json)}`).toBe(403);
      expect(res.json).toMatchObject({ code: 'FORBIDDEN', message: GUEST_MESSAGE_HE });
    }
    // On the phone `destPath` is refused before any router runs (400 for every account, guests included).
    const disk = await rig.call('/api/export', { token: guest.token, method: 'POST', body: { format: 'txt', destPath: '/sdcard/x.txt' } });
    expect(disk.status).toBe(400);
    expect(disk.json).toMatchObject({ code: 'VALIDATION', field: 'destPath' });
    // The guest is not the owner and sees no owner cards; it is not in the accounts list.
    const settings = (await rig.call('/api/server/settings', { token: guest.token })).json as ServerSettings;
    expect(settings).toEqual({ port: 0, lanEnabled: false, isRemoteOwner: false, isMailOwner: false, isLanOwner: false });
    expect((await rig.call('/api/server/mail', { token: guest.token })).status).toBe(403);
    expect(((await rig.call('/api/auth/accounts')).json as { accounts: unknown[] }).accounts).toEqual([]);
    // Locking every session (the host's "lock when I leave") leaves the guest alone.
    await rig.core.lockAll();
    expect((await rig.call('/api/entries', { token: guest.token })).status).toBe(200);
  });

  it('a real registration after the tour starts clean, is the owner, and ends the guest session', async () => {
    rig = await bootTestCore();
    const guest = await startGuest('he');
    const registered = await rig.call('/api/auth/register', {
      method: 'POST',
      locale: 'he',
      body: { firstName: 'דנה', lastName: 'כהן', username: 'dana', email: 'dana@example.test', password: PASSWORD, confirmPassword: PASSWORD, rememberMe: true, deviceName: 'Phone' },
    });
    expect(registered.status, JSON.stringify(registered.json)).toBe(201);
    const auth = registered.json as AuthResponse;
    expect(auth.guest).toBeUndefined();
    expect(((await rig.call('/api/entries', { token: auth.token })).json as EntryPage).total).toBe(0);
    expect(((await rig.call('/api/habits', { token: auth.token })).json as unknown[]).length).toBe(0);
    const settings = (await rig.call('/api/server/settings', { token: auth.token })).json as ServerSettings;
    expect(settings).toMatchObject({ isMailOwner: true, isLanOwner: true });
    const ended = await rig.call('/api/auth/me', { token: guest.token });
    expect(ended.status).toBe(401);
    expect(ended.json).toMatchObject({ code: 'SESSION_EXPIRED' });
    // The storage has the real account only.
    const files = await rig.files();
    expect([...files.keys()].filter((name) => !name.endsWith('.prev')).sort()).toEqual(['accounts.json', 'device.key', 'sessions.json', `users/${auth.user.id}.mpd`]);
    expect(new TextDecoder().decode(files.get('accounts.json'))).not.toContain('_guest');
    expect(new TextDecoder().decode(files.get('sessions.json'))).not.toContain('g_');
    // A second tour later is possible again, and the sign-in of the real account ends it too.
    const second = await startGuest('en');
    const login = await rig.call('/api/auth/login', { method: 'POST', body: { username: 'dana', password: PASSWORD } });
    expect(login.status).toBe(200);
    expect((await rig.call('/api/auth/me', { token: second.token })).status).toBe(401);
  });
});
