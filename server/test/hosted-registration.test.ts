/**
 * WP-H2 (docs/HOSTED-PLAN.md Part B 2.6, 5.2): registration on the hosted server and the bucketed
 * sign-in lockout.
 *
 *   - the register limiter counts every attempt per address bucket: 5 per hour, 20 per day (fake clock);
 *   - open / invite (constant-time compare, 400 without a code, 403 with a wrong one) / closed;
 *   - the account cap -> 503 'server.auth.registrationFull';
 *   - the warning above 50 registrations in 24 h advises `closed` (invite only together with
 *     DIARY_INVITE_CODE): invite mode without the code stops the hosted server from starting;
 *   - local mode: no policy, no limiter, an `inviteCode` in the body is ignored;
 *   - lockout: the hard 10 -> 15 min lock applies to the attacker's bucket only; the account itself
 *     gets the progressive delay (1, 2, 4 ... 30 s) and never a lock; local keys are unchanged.
 * Fictional users and TEST-NET addresses only.
 */
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import {
  createRegistrationGate,
  inviteMatches,
  INVITE_INVALID_KEY,
  INVITE_REQUIRED_KEY,
  REGISTRATION_CLOSED_KEY,
  REGISTRATION_FULL_KEY,
  REGISTRATION_WARN_PER_DAY,
  RegisterLimiter,
  RegistrationCounter,
  TOO_MANY_REGISTRATIONS_KEY,
} from '../src/hosted/policy';
import { loadHostedEnv } from '../src/config';
import { createAuthService, loginDelayMs, type DiaryAuthService } from '../src/security/auth-service';
import { cleanupTempDirs, makeTestApp, testConfig, testHostedOptions } from './helpers';

const PASSWORD = 'Passw0rd!';
const FAST = { N: 1024, r: 8, p: 1 };
const HOST = 'diary.example';
const services: DiaryAuthService[] = [];

afterEach(async () => {
  for (const s of services.splice(0)) await s.shutdown();
});
afterAll(cleanupTempDirs);

async function realAuth(extra: Parameters<typeof createAuthService>[1] = {}) {
  const auth = await createAuthService(testConfig(), { kdf: FAST, ...extra });
  services.push(auth);
  return auth;
}

function registerBody(username: string, extra: object = {}) {
  // A hosted server creates no account without the privacy checkbox (docs/android-tasks/PRIVACY-CHECKBOX.md).
  return { firstName: 'Test', lastName: 'User', username, email: `${username}@example.com`, password: PASSWORD, confirmPassword: PASSWORD, privacyAccepted: true, ...extra };
}

describe('RegisterLimiter / RegistrationCounter (fake clock)', () => {
  it('allows 5 attempts per hour and 20 per day per bucket, counting refused attempts too', () => {
    let now = Date.parse('2026-10-18T10:00:00Z');
    const limiter = new RegisterLimiter({ now: () => now });
    for (let i = 0; i < 5; i++) expect(limiter.hit('203.0.113.9')).toBe(true);
    expect(limiter.hit('203.0.113.9')).toBe(false);
    expect(limiter.count('203.0.113.9')).toEqual({ hour: 6, day: 6 });
    // Another bucket is independent.
    expect(limiter.hit('203.0.113.10')).toBe(true);
    // 59 minutes later the hour window is still full...
    now += 59 * 60_000;
    expect(limiter.hit('203.0.113.9')).toBe(false);
    // ...an hour after the first attempts it opens again (the day window allows 20 in all).
    now += 2 * 60_000;
    expect(limiter.hit('203.0.113.9')).toBe(true);
    // Fill the day: 8 counted so far; 12 more, 15 minutes apart (never 5 within one hour), reach 20.
    for (let i = 0; i < 12; i++) {
      now += 15 * 60_000;
      expect({ i, ok: limiter.hit('203.0.113.9') }).toEqual({ i, ok: true });
    }
    expect(limiter.count('203.0.113.9').day).toBe(20);
    // Over the day's cap from here on, whatever the hour says.
    now += 2 * 60 * 60_000;
    expect(limiter.hit('203.0.113.9')).toBe(false);
    // A day after the first attempt the oldest ones expire.
    now = Date.parse('2026-10-19T10:00:01Z');
    expect(limiter.count('203.0.113.9').day).toBeLessThan(20);
    expect(limiter.hit('203.0.113.9')).toBe(true);
  });

  it('counts successful registrations over a sliding 24 h window', () => {
    let now = 1_000_000;
    const counter = new RegistrationCounter(() => now);
    expect(counter.count()).toBe(0);
    expect(counter.add()).toBe(1);
    now += 12 * 60 * 60_000;
    expect(counter.add()).toBe(2);
    now += 12 * 60 * 60_000 + 1;
    expect(counter.count()).toBe(1);
  });

  it('compares invite codes in constant time, NFKC-normalised, and never matches an empty expectation', () => {
    expect(inviteMatches('open-sesame', 'open-sesame')).toBe(true);
    expect(inviteMatches('open-sesame ', 'open-sesame')).toBe(false);
    expect(inviteMatches('Open-sesame', 'open-sesame')).toBe(false);
    expect(inviteMatches('', '')).toBe(false);
    expect(inviteMatches('anything', '')).toBe(false);
    expect(inviteMatches('ﬁ', 'fi')).toBe(true);
  });

  it('the gate refuses to run in invite mode without a code', () => {
    expect(() => createRegistrationGate({ mode: 'invite', maxAccounts: 10, countAccounts: () => 0 })).toThrow(/invite code/);
  });

  it('warns from the 51st registration in 24 h with advice the hosted server survives: closed, invite only together with the code', () => {
    // Regression (PRIVACY-CHECKBOX fixer, docs/android-tasks/ENV.md 2026-10-28): the line said "consider
    // DIARY_REGISTRATION=invite", and invite mode without DIARY_INVITE_CODE never starts (a crash loop on Fly).
    const now = Date.parse('2026-10-28T08:00:00Z');
    const logs: string[] = [];
    const gate = createRegistrationGate({ mode: 'open', maxAccounts: 5000, countAccounts: () => 0, now: () => now, log: (l) => logs.push(l) });
    for (let i = 0; i < REGISTRATION_WARN_PER_DAY; i++) gate.registered();
    expect(logs).toEqual([]);
    gate.registered();
    const hint = 'registrations in the last 24 h: 51 - consider DIARY_REGISTRATION=closed (invite only together with DIARY_INVITE_CODE)';
    expect(logs).toEqual([hint]);
    // The advised mode starts on a server that has no invite code (production after HOSTED-DEPLOY step ט)...
    const production = { DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: 'https://diary.example', DIARY_REGISTRATION: 'open' };
    const advised = /consider DIARY_REGISTRATION=(\w+)/.exec(logs[0])?.[1];
    expect(advised).toBe('closed');
    expect(() => loadHostedEnv({ ...production, DIARY_REGISTRATION: advised })).not.toThrow();
    // ...the old advice alone does not, so invite is offered only next to the code.
    expect(() => loadHostedEnv({ ...production, DIARY_REGISTRATION: 'invite' })).toThrow(/DIARY_INVITE_CODE/);
    // Same advice on every further 50 (100, 150 ...).
    for (let n = REGISTRATION_WARN_PER_DAY + 2; n <= 100; n++) gate.registered();
    expect(logs).toEqual([hint, hint.replace(': 51 - ', ': 100 - ')]);
  });

  it('the warning names the invite code variable, never its value', () => {
    const logs: string[] = [];
    const gate = createRegistrationGate({ mode: 'invite', inviteCode: 'fictional-invite-2026', maxAccounts: 5000, countAccounts: () => 0, log: (l) => logs.push(l) });
    for (let i = 0; i <= REGISTRATION_WARN_PER_DAY; i++) gate.registered();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('DIARY_INVITE_CODE');
    expect(logs[0]).not.toContain('fictional-invite-2026');
  });
});

describe('registration through the hosted app', () => {
  it('open: the 6th registration from one address within an hour is 429; failed attempts count; another address is fine', async () => {
    const auth = await realAuth();
    const logs: string[] = [];
    const gate = createRegistrationGate({ mode: 'open', maxAccounts: 300, countAccounts: () => auth.listAccounts().length, log: (l) => logs.push(l) });
    const app = await makeTestApp({ auth, hosted: testHostedOptions({ registration: gate, loginPerMinute: 100 }) });
    const register = (ip: string, body: object) => app.anon().post('/api/auth/register').set('Host', HOST).set('X-Forwarded-For', ip).send(body);
    for (let i = 0; i < 4; i++) expect((await register('203.0.113.9', registerBody(`user${i}`))).status).toBe(201);
    // A refused body (weak password) is an attempt too: it uses up the fifth slot.
    expect((await register('203.0.113.9', registerBody('user4', { password: 'short', confirmPassword: 'short' }))).status).toBe(400);
    const sixth = await register('203.0.113.9', registerBody('user5'));
    expect(sixth.status).toBe(429);
    expect(sixth.body).toEqual({ code: 'FORBIDDEN', message: t('he', TOO_MANY_REGISTRATIONS_KEY) });
    expect(logs.some((l) => l.includes('register refused (rate)'))).toBe(true);
    expect(logs.join('\n')).not.toContain('203.0.113');
    expect((await register('203.0.113.10', registerBody('user5'))).status).toBe(201);
    expect(gate.recentCount()).toBe(5);
    expect(auth.listAccounts().length).toBe(5);
  });

  it('invite: no code -> 400 on inviteCode, wrong code -> 403, right code -> 201 (and the attempt counts)', async () => {
    const auth = await realAuth();
    const gate = createRegistrationGate({ mode: 'invite', inviteCode: 'open-sesame-2026', maxAccounts: 300, countAccounts: () => auth.listAccounts().length });
    const app = await makeTestApp({ auth, hosted: testHostedOptions({ registration: gate }) });
    const register = (body: object) => app.anon().post('/api/auth/register').set('Host', HOST).set('X-Forwarded-For', '203.0.113.9').send(body);
    const missing = await register(registerBody('ownertest'));
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ code: 'VALIDATION', message: t('he', INVITE_REQUIRED_KEY), field: 'inviteCode' });
    const wrong = await register(registerBody('ownertest', { inviteCode: 'open-sesame-2025' }));
    expect(wrong.status).toBe(403);
    expect(wrong.body).toEqual({ code: 'FORBIDDEN', message: t('he', INVITE_INVALID_KEY) });
    const right = await register(registerBody('ownertest', { inviteCode: ' open-sesame-2026 ' }));
    expect(right.status).toBe(201);
    expect(gate.recentCount()).toBe(1);
    expect(gate.limiter.count('203.0.113.9').hour).toBe(3);
    // The code never reaches the account record or the answer.
    expect(JSON.stringify(right.body)).not.toContain('sesame');
    expect(JSON.stringify(auth.listAccounts())).not.toContain('sesame');
  });

  it('closed: 403 for everyone, code or not; full: 503 once the cap is reached', async () => {
    const auth = await realAuth();
    const closed = createRegistrationGate({ mode: 'closed', maxAccounts: 300, countAccounts: () => auth.listAccounts().length });
    const closedApp = await makeTestApp({ auth, hosted: testHostedOptions({ registration: closed }) });
    const res = await closedApp.anon().post('/api/auth/register').set('Host', HOST).send(registerBody('nobody', { inviteCode: 'x' }));
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(t('he', REGISTRATION_CLOSED_KEY));

    const full = createRegistrationGate({ mode: 'open', maxAccounts: 1, countAccounts: () => auth.listAccounts().length });
    const fullApp = await makeTestApp({ auth, hosted: testHostedOptions({ registration: full }) });
    expect((await fullApp.anon().post('/api/auth/register').set('Host', HOST).send(registerBody('first'))).status).toBe(201);
    const second = await fullApp.anon().post('/api/auth/register').set('Host', HOST).send(registerBody('second'));
    expect(second.status).toBe(503);
    expect(second.body).toEqual({ code: 'OTHER', message: t('he', REGISTRATION_FULL_KEY) });
    expect(auth.listAccounts().map((a) => a.username)).toEqual(['first']);
  });

  it('local mode has no policy: six registrations from loopback, inviteCode ignored, no bucket in the lockout', async () => {
    const auth = await realAuth();
    const app = await makeTestApp({ auth });
    for (let i = 0; i < 6; i++) {
      expect((await app.anon().post('/api/auth/register').send(registerBody(`local${i}`, { inviteCode: 'ignored' }))).status).toBe(201);
    }
    const bad = await app.anon().post('/api/auth/login').send({ username: 'local0', password: 'wrong-pass1' });
    expect(bad.status).toBe(401);
    const id = auth.listAccounts().find((a) => a.username === 'local0')!.id;
    expect(auth.lockout.has(`account:${id}`)).toBe(true);
    expect(auth.delays.has(`account:${id}@any`)).toBe(false);
  });
});

describe('sign-in lockout on the hosted server (finding 12)', () => {
  it('loginDelayMs: nothing below 10 failures, then 1, 2, 4 ... capped at 30 s', () => {
    expect([0, 1, 9].map(loginDelayMs)).toEqual([0, 0, 0]);
    expect([10, 11, 12, 13, 14].map(loginDelayMs)).toEqual([1000, 2000, 4000, 8000, 16000]);
    expect([15, 16, 40].map(loginDelayMs)).toEqual([30000, 30000, 30000]);
  });

  it('locks the attacker bucket only; the owner from another network is delayed, never locked', async () => {
    let now = Date.parse('2026-10-18T10:00:00Z');
    const sleeps: number[] = [];
    const auth = await realAuth({ now: () => new Date(now), sleep: async (ms) => void sleeps.push(ms) });
    await auth.register({ firstName: 'Test', lastName: 'User', username: 'ownertest', email: 'ownertest@example.com', password: PASSWORD, rememberMe: false, deviceName: 'pc' });
    const id = auth.listAccounts()[0].id;
    const attempt = (password: string, bucket: string) =>
      auth.login({ username: 'ownertest', password, rememberMe: false, deviceName: 'x' }, { fromNetwork: true, bucket }).then(
        () => 200,
        (e: { status: number }) => e.status,
      );
    // Ten wrong passwords from the attacker's /32: the tenth locks THAT bucket.
    for (let i = 0; i < 9; i++) expect(await attempt('wrong-pass1', '198.51.100.7')).toBe(401);
    expect(await attempt('wrong-pass1', '198.51.100.7')).toBe(429);
    expect(await attempt(PASSWORD, '198.51.100.7')).toBe(429);
    expect(auth.lockout.has(`account:${id}@network@198.51.100.7`)).toBe(true);
    expect(auth.lockout.has(`account:${id}@network`)).toBe(false);
    expect(auth.lockout.has(`account:${id}`)).toBe(false);
    expect(sleeps).toEqual([]);
    // The owner from home: not locked - but the account has 10 failures, so the attempt waits 1 s.
    expect(await attempt(PASSWORD, '203.0.113.9')).toBe(200);
    expect(sleeps).toEqual([1000]);
    // Success cleared the account counter: no delay any more for anybody.
    expect(await attempt(PASSWORD, '203.0.113.9')).toBe(200);
    expect(sleeps).toEqual([1000]);
    // The attacker's bucket stays locked for 15 minutes, then forgets.
    expect(await attempt(PASSWORD, '198.51.100.7')).toBe(429);
    now += 15 * 60_000 + 1;
    expect(await attempt(PASSWORD, '198.51.100.7')).toBe(200);
  });

  it('a distributed attack (many buckets) only slows the account down: 1, 2, 4 ... 30 s, no lock', async () => {
    const sleeps: number[] = [];
    const auth = await realAuth({ sleep: async (ms) => void sleeps.push(ms) });
    await auth.register({ firstName: 'Test', lastName: 'User', username: 'ownertest', email: 'ownertest@example.com', password: PASSWORD, rememberMe: false, deviceName: 'pc' });
    const attempt = (password: string, bucket: string) =>
      auth.login({ username: 'ownertest', password, rememberMe: false, deviceName: 'x' }, { fromNetwork: true, bucket }).then(
        () => 200,
        (e: { status: number }) => e.status,
      );
    // 16 failures from 16 different /64s: never a 429 (no bucket reaches 10)...
    for (let i = 0; i < 16; i++) expect(await attempt('wrong-pass1', `2001:db8:0:${i.toString(16)}::/64`)).toBe(401);
    // ...and from the 11th attempt on each one waited: 1, 2, 4, 8, 16, 30 s (cap).
    expect(sleeps).toEqual([1000, 2000, 4000, 8000, 16000, 30000]);
    // The owner still gets in (after the 30 s wait), and that resets the delay.
    expect(await attempt(PASSWORD, '203.0.113.9')).toBe(200);
    expect(sleeps[sleeps.length - 1]).toBe(30000);
    expect(await attempt(PASSWORD, '203.0.113.9')).toBe(200);
    expect(sleeps.length).toBe(7);
  });

  it('unknown names are bucketed the same way, and a password reset clears every bucket of the account', async () => {
    const sleeps: number[] = [];
    const auth = await realAuth({ sleep: async (ms) => void sleeps.push(ms) });
    const attempt = (username: string, password: string, bucket: string) =>
      auth.login({ username, password, rememberMe: false, deviceName: 'x' }, { fromNetwork: true, bucket }).then(
        () => 200,
        (e: { status: number }) => e.status,
      );
    for (let i = 0; i < 10; i++) expect(await attempt('ghost', 'wrong-pass1', '198.51.100.7')).toBe(i < 9 ? 401 : 429);
    expect(auth.lockout.has('name:ghost@network@198.51.100.7')).toBe(true);
    expect(auth.delays.has('name:ghost@any')).toBe(true);

    await auth.register({ firstName: 'Test', lastName: 'User', username: 'ownertest', email: 'ownertest@example.com', password: PASSWORD, rememberMe: false, deviceName: 'pc' });
    const id = auth.listAccounts()[0].id;
    for (let i = 0; i < 10; i++) await attempt('ownertest', 'wrong-pass1', '198.51.100.8');
    expect(auth.lockout.has(`account:${id}@network@198.51.100.8`)).toBe(true);
    expect(auth.delays.has(`account:${id}@any`)).toBe(true);
    await auth.resetPassword(id, 'N3wPassw0rd!');
    expect(auth.lockout.has(`account:${id}@network@198.51.100.8`)).toBe(false);
    expect(auth.delays.has(`account:${id}@any`)).toBe(false);
    expect(await attempt('ownertest', 'N3wPassw0rd!', '198.51.100.8')).toBe(200);
  });
});
