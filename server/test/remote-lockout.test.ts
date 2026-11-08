/**
 * Per-account sign-in lockout (security/auth-service.ts): 10 wrong passwords in a row lock the
 * account for 15 minutes - hardening for remote access over the internet.
 */
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import { ApiError } from '../src/errors';
import {
  accountLockedError,
  createAuthService,
  LOGIN_LOCKED_KEY,
  LOGIN_LOCKOUT_MAX_FAILURES,
  LOGIN_LOCKOUT_MS,
  LoginLockout,
  type DiaryAuthService,
} from '../src/security/auth-service';
import type { AuthService } from '../src/security/session-types';
import { cleanupTempDirs, makeTestApp, testConfig } from './helpers';

const FAST = { N: 2048, r: 8, p: 1 };
const PASSWORD = 'Passw0rd!';
const MINUTE = 60_000;

const services: AuthService[] = [];
afterEach(async () => {
  for (const s of services.splice(0)) await s.shutdown();
});
afterAll(cleanupTempDirs);

function clock(start = Date.parse('2026-09-28T10:00:00Z')) {
  let now = start;
  return { now: () => new Date(now), advance: (ms: number) => (now += ms) };
}

async function service(c = clock()) {
  const svc = (await createAuthService(testConfig(), { kdf: FAST, now: c.now })) as DiaryAuthService;
  services.push(svc);
  await svc.register({
    firstName: 'Dana',
    lastName: 'Cohen',
    username: 'dana',
    email: 'dana@example.com',
    password: PASSWORD,
    rememberMe: false,
    deviceName: 'PC',
  } as Parameters<DiaryAuthService['register']>[0]);
  return { svc, c };
}

async function attempt(svc: DiaryAuthService, username: string, password: string): Promise<ApiError | null> {
  try {
    await svc.login({ username, password, rememberMe: false, deviceName: 'PC' });
    return null;
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
}

describe('LoginLockout', () => {
  it('locks after 10 failures for 15 minutes, then forgets', () => {
    expect(LOGIN_LOCKOUT_MAX_FAILURES).toBe(10);
    expect(LOGIN_LOCKOUT_MS).toBe(15 * MINUTE);
    const c = clock();
    const l = new LoginLockout(c.now);
    for (let i = 1; i < 10; i++) expect(l.fail('k')).toBe(0);
    expect(l.remaining('k')).toBe(0);
    expect(l.fail('k')).toBe(15 * MINUTE);
    expect(l.remaining('k')).toBe(15 * MINUTE);
    c.advance(14 * MINUTE);
    expect(l.remaining('k')).toBe(MINUTE);
    c.advance(MINUTE);
    expect(l.remaining('k')).toBe(0);
    // A fresh window: one failure does not lock again.
    expect(l.fail('k')).toBe(0);
  });

  it('forgets old failures and resets on success', () => {
    const c = clock();
    const l = new LoginLockout(c.now, { maxFailures: 3, lockMs: 10 * MINUTE });
    l.fail('a');
    l.fail('a');
    c.advance(11 * MINUTE);
    expect(l.fail('a')).toBe(0); // the two old failures expired
    l.fail('a');
    l.reset('a');
    expect(l.fail('a')).toBe(0);
    expect(l.fail('b')).toBe(0);
  });

  it('the error is a localised 429 with the minutes left', () => {
    const e = accountLockedError(14 * MINUTE + 1);
    expect(e.status).toBe(429);
    expect(e.code).toBe('FORBIDDEN');
    expect(e.key).toBe(LOGIN_LOCKED_KEY);
    expect(e.messageFor('en')).toBe('Too many failed sign-in attempts for this account. Try again in 15 minutes.');
    expect(accountLockedError(30_000).messageFor('en')).toContain('in 1 minute.');
    expect(e.messageFor('he')).toContain('15 דקות');
  });
});

describe('sign-in lockout in the auth service', () => {
  it('10 wrong passwords lock the account; even the right password waits 15 minutes', async () => {
    const { svc, c } = await service();
    for (let i = 1; i < 10; i++) expect((await attempt(svc, 'dana', 'wrong-pass1'))?.code).toBe('WRONG_PASSWORD');
    const tenth = await attempt(svc, 'dana', 'wrong-pass1');
    expect(tenth?.status).toBe(429);
    expect(tenth?.key).toBe(LOGIN_LOCKED_KEY);
    const right = await attempt(svc, 'dana', PASSWORD);
    expect(right?.status).toBe(429);
    // The e-mail address names the same account: same lock.
    expect((await attempt(svc, 'DANA@example.com', PASSWORD))?.status).toBe(429);
    c.advance(15 * MINUTE);
    expect(await attempt(svc, 'dana', PASSWORD)).toBeNull();
  });

  it('a successful sign-in clears the counter', async () => {
    const { svc } = await service();
    for (let i = 0; i < 9; i++) await attempt(svc, 'dana', 'wrong-pass1');
    expect(await attempt(svc, 'dana@example.com', PASSWORD)).toBeNull();
    for (let i = 0; i < 9; i++) expect((await attempt(svc, 'dana', 'wrong-pass1'))?.code).toBe('WRONG_PASSWORD');
  });

  it('unknown names lock the same way (answers do not reveal which names exist)', async () => {
    const { svc } = await service();
    for (let i = 1; i < 10; i++) expect((await attempt(svc, 'nobody', 'wrong-pass1'))?.code).toBe('WRONG_PASSWORD');
    expect((await attempt(svc, 'nobody', 'wrong-pass1'))?.key).toBe(LOGIN_LOCKED_KEY);
    // Other accounts are not affected.
    expect(await attempt(svc, 'dana', PASSWORD)).toBeNull();
  });

  it('POST /api/auth/login answers 429 in the request language while locked', async () => {
    const { svc } = await service();
    const app = await makeTestApp({ auth: svc });
    for (let i = 0; i < 10; i++) {
      await app.anon().post('/api/auth/login').send({ username: 'dana', password: 'wrong-pass1', rememberMe: false });
    }
    const res = await app.anon().post('/api/auth/login').send({ username: 'dana', password: PASSWORD, rememberMe: false });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.message).toBe(t('he', LOGIN_LOCKED_KEY, { minutes: 15 }));
  });
});
