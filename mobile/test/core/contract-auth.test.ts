// @vitest-environment node
/**
 * Contract of the mobile core with the desktop server, part 1: accounts and sessions. The same
 * requests go to the core (in-process, MemoryStorage) and to the desktop server (from source, a
 * temporary directory); statuses, headers and JSON bodies must agree (ids, timestamps and tokens
 * masked - see ./contract-rig.ts).
 *
 * /api/auth allows 30 requests per minute per address on both sides, so each contract file keeps
 * its own core and server and stays well below that.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppSettings, AuthResponse, ServerInfo, ServerSettings, SessionInfo, UserProfile } from '@shared/types';
import { closeNative, DANA, loginBoth, NEW_PASSWORD, PASSWORD, registerBoth, registration, startContract, YOSSI, type ContractRig } from './contract-rig';

let rig: ContractRig;

beforeAll(async () => {
  rig = await startContract();
}, 120_000);

afterAll(async () => {
  await rig?.close();
  await closeNative();
});

describe('contract: accounts and sessions', () => {
  it('health and server info answer alike (the phone reports no port, no LAN, no remote access)', async () => {
    await rig.both('/api/health');
    const { core } = await rig.both('/api/server/info', {}, { volatile: ['port'] });
    expect(core.json as ServerInfo).toMatchObject({ port: 0, lanEnabled: false, lanUrls: [], remoteEnabled: false, remoteUrl: '', secure: false, isLocalRequest: true });
  });

  it('register with a Hebrew sign-up screen: 201, the account language is he, the first account is the owner', async () => {
    const { core, desktop } = await registerBoth(rig, DANA, 'he');
    expect(core.user).toMatchObject({ username: 'dana', firstName: 'דנה', email: 'dana@example.test' });
    expect(core.rememberMe).toBe(true);
    expect(core.guest).toBeUndefined();
    expect(desktop.user.username).toBe('dana');

    const settings = await rig.authed('/api/settings');
    expect((settings.core.json as AppSettings).language).toBe('he');

    // The owner's server settings: the desktop owner also owns remote access (the card the phone has no
    // reason to show), everything else agrees.
    const server = await rig.authed('/api/server/settings', {}, { body: 'skip' });
    expect(server.core.json as ServerSettings).toEqual({ port: 0, lanEnabled: false, isRemoteOwner: false, isMailOwner: true, isLanOwner: true });
    expect(server.desktop.json as ServerSettings).toMatchObject({ lanEnabled: false, isMailOwner: true, isLanOwner: true });
    const me = await rig.authed('/api/auth/me');
    expect((me.core.json as { user: UserProfile }).user.username).toBe('dana');
  });

  it('duplicate username and duplicate e-mail answer the same 409s, with the same Hebrew messages', async () => {
    const sameUser = await rig.both('/api/auth/register', { method: 'POST', locale: 'he', body: registration({ ...YOSSI, username: 'DANA' }) });
    expect(sameUser.core.status).toBe(409);
    expect(sameUser.core.json).toMatchObject({ code: 'USERNAME_TAKEN', field: 'username' });
    const sameMail = await rig.both('/api/auth/register', { method: 'POST', locale: 'he', body: registration({ ...YOSSI, email: 'Dana@Example.test' }) });
    expect(sameMail.core.status).toBe(409);
    expect(sameMail.core.json).toMatchObject({ code: 'VALIDATION', field: 'email' });
    expect((sameMail.core.json as { message: string }).message).toMatch(/[֐-׿]/);
    const weak = await rig.both('/api/auth/register', { method: 'POST', locale: 'en', body: registration(YOSSI, { password: 'abc', confirmPassword: 'abc' }) });
    expect(weak.core.status).toBe(400);
    expect(weak.core.json).toMatchObject({ code: 'WEAK_PASSWORD' });
  });

  it('wrong password and unknown user answer the same 401 (nothing is revealed)', async () => {
    const wrong = await rig.both('/api/auth/login', { method: 'POST', locale: 'he', body: { username: 'dana', password: 'nope-Nope-1' } });
    expect(wrong.core.status).toBe(401);
    expect(wrong.core.json).toMatchObject({ code: 'WRONG_PASSWORD' });
    const unknown = await rig.both('/api/auth/login', { method: 'POST', locale: 'he', body: { username: 'nobody', password: PASSWORD } });
    expect(unknown.core.status).toBe(401);
    expect(unknown.core.json).toEqual(wrong.core.json);
  });

  it('a remember-me session survives a restart of the app on both sides', async () => {
    const created = await rig.authed('/api/entries', { method: 'POST', body: { date: '2026-10-01', time: '09:00', title: 'Before the restart', body: 'Fictional.', mood: 3, emotions: [], energy: null, stress: null, sleepQuality: null, sleepHours: null, exerciseMinutes: null, exerciseType: '', events: [], people: [], location: '', notes: '', tags: [] } });
    expect(created.core.status).toBe(201);

    await Promise.all([rig.restartCore(), rig.desktopRig.restart()]);

    const me = await rig.authed('/api/auth/me');
    expect(me.core.status).toBe(200);
    expect((me.core.json as { user: UserProfile; session: SessionInfo }).session).toMatchObject({ rememberMe: true, current: true });
    const list = await rig.authed('/api/entries');
    expect((list.core.json as { items: Array<{ title: string }> }).items.map((e) => e.title)).toEqual(['Before the restart']);
  }, 60_000);

  it('lock -> 423 on data routes, me shows the lock, a wrong password keeps it, the right one lifts it', async () => {
    const locked = await rig.authed('/api/auth/lock', { method: 'POST' });
    expect(locked.core.status).toBe(204);
    const data = await rig.authed('/api/entries', { locale: 'ar' });
    expect(data.core.status).toBe(423);
    expect(data.core.json).toMatchObject({ code: 'LOCKED' });
    const me = await rig.authed('/api/auth/me');
    expect((me.core.json as { session: SessionInfo }).session.locked).toBe(true);
    const wrong = await rig.authed('/api/auth/verify-password', { method: 'POST', body: { password: 'wrong-Passw0rd!' } });
    expect(wrong.core.status).toBe(401);
    expect((await rig.authed('/api/entries')).core.status).toBe(423);
    const right = await rig.authed('/api/auth/verify-password', { method: 'POST', body: { password: PASSWORD } });
    expect(right.core.status).toBe(200);
    expect(right.core.json).toEqual({ ok: true });
    expect((await rig.authed('/api/entries')).core.status).toBe(200);
  });

  it('a second account is not the owner; the accounts list of the sign-in screen agrees', async () => {
    const dana = { core: rig.core.token, desktop: rig.desktop.token };
    await registerBoth(rig, YOSSI, 'en');
    const server = await rig.authed('/api/server/settings', {}, { body: 'skip' });
    expect(server.core.json).toEqual({ port: 0, lanEnabled: false, isRemoteOwner: false, isMailOwner: false, isLanOwner: false });
    expect(server.desktop.json).toMatchObject({ isMailOwner: false, isLanOwner: false });
    const mail = await rig.authed('/api/server/mail', { locale: 'en' });
    expect(mail.core.status).toBe(403);
    const accounts = await rig.both('/api/auth/accounts');
    expect((accounts.core.json as { accounts: Array<{ username: string }> }).accounts.map((a) => a.username)).toEqual(['yossi', 'dana']);
    const sessions = await rig.authed('/api/auth/sessions');
    expect((sessions.core.json as SessionInfo[]).map((s) => s.current)).toEqual([true]);
    // Back to Dana for the rest.
    rig.core.token = dana.core;
    rig.desktop.token = dana.desktop;
  });

  it('change password: the old one stops working, the new one signs in, other sessions are gone', async () => {
    // The remember-me session of the restart test becomes "the other device"; a fresh sign-in changes the password.
    const otherTokens = { core: rig.core.token, desktop: rig.desktop.token };
    await loginBoth(rig, 'dana', PASSWORD);
    const mismatch = await rig.authed('/api/auth/change-password', { method: 'POST', body: { oldPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: 'different-1A!' } });
    expect(mismatch.core.status).toBe(400);
    const changed = await rig.authed('/api/auth/change-password', { method: 'POST', body: { oldPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD } });
    expect(changed.core.status).toBe(200);
    expect(changed.core.json).toEqual({ ok: true });
    // The session that changed the password stays; the data is still readable (re-encrypted diary).
    expect((await rig.authed('/api/entries')).core.status).toBe(200);
    const old = await rig.both('/api/auth/login', { method: 'POST', body: { username: 'dana@example.test', password: PASSWORD } });
    expect(old.core.status).toBe(401);
    // The other session of the account was signed out on both sides.
    const otherGone = await rig.both('/api/auth/me', (side) => ({ token: side.name === 'core' ? otherTokens.core : otherTokens.desktop }));
    expect(otherGone.core.status).toBe(401);
    const fresh = await loginBoth(rig, 'dana', NEW_PASSWORD, { rememberMe: false });
    expect(fresh.core.rememberMe).toBe(false);
  });

  it('delete account: a wrong password deletes nothing; the right one removes the diary file and the record on both sides', async () => {
    const userId = { core: rig.core.user!.id, desktop: rig.desktop.user!.id };
    const wrong = await rig.authed('/api/auth/delete-account', { method: 'POST', body: { password: 'wrong-Passw0rd!' } });
    expect(wrong.core.status).toBe(400);
    expect(wrong.core.json).toMatchObject({ code: 'WRONG_PASSWORD', field: 'password' });
    expect((await rig.coreRig.files()).has(`users/${userId.core}.mpd`)).toBe(true);
    expect(rig.desktopRig.files().has(`users/${userId.desktop}.mpd`)).toBe(true);

    const deleted = await rig.authed('/api/auth/delete-account', { method: 'POST', body: { password: NEW_PASSWORD } });
    expect(deleted.core.status).toBe(204);
    const coreFiles = await rig.coreRig.files();
    const desktopFiles = rig.desktopRig.files();
    for (const [files, id] of [
      [coreFiles, userId.core],
      [desktopFiles, userId.desktop],
    ] as const) {
      expect([...files.keys()].filter((p) => p.includes(id))).toEqual([]);
      expect(new TextDecoder().decode(files.get('accounts.json'))).not.toContain('dana');
      expect(new TextDecoder().decode(files.get('accounts.json'))).toContain('yossi');
    }
    const gone = await rig.authed('/api/auth/me');
    expect(gone.core.status).toBe(401);
    const login = await rig.both('/api/auth/login', { method: 'POST', body: { username: 'dana', password: NEW_PASSWORD } });
    expect(login.core.status).toBe(401);
    // The username and the e-mail are free again.
    const again = await rig.both('/api/auth/register', { method: 'POST', locale: 'he', body: registration(DANA, { rememberMe: false }) });
    expect(again.core.status).toBe(201);
    expect((again.core.json as AuthResponse).user.id).not.toBe(userId.core);
  });
});
