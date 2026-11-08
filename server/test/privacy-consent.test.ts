/**
 * The privacy checkbox at registration (docs/android-tasks/PRIVACY-CHECKBOX.md), server half.
 *
 *   - hosted server: POST /api/auth/register without `privacyAccepted: true` (missing, false, "true", 1,
 *     null) -> 400 VALIDATION with field 'privacyAccepted' and the message 'server.auth.privacyRequired' in
 *     the request language (all 20); no account, no diary file. The fields of the form are checked first
 *     (the box is the last thing on the form);
 *   - with it -> 201, and accounts.json records when (`privacyAcceptedAt` = `createdAt`, ISO) and which
 *     policy (`privacyVersion` = PRIVACY_POLICY_VERSION); no answer to a client carries them;
 *   - accounts from before the checkbox are not asked again: they sign in, and their record stays without
 *     the fields; older accounts.json files load unchanged, a half or broken record loads without both;
 *   - local developer mode is unchanged: no field needed, and a tick sent anyway is not recorded;
 *   - the tour (POST /api/auth/guest) creates no account and needs no tick;
 *   - ONE version: PRIVACY_POLICY_VERSION (shared/legal.ts) is the effective date that the legal page
 *     generator (scripts/legal/build-pages.mjs) reads from legal/settings.json and prints on every policy page.
 * Fictional users and TEST-NET addresses only.
 */
import fs from 'node:fs';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { LOCALE_CODES, t } from '@shared/i18n';
import { isPolicyVersion, PRIVACY_POLICY_VERSION } from '@shared/legal';
import type { AuthResponse } from '@shared/types';
import { dateInWords, LOCALES, readSettings, ROOT } from '../../scripts/legal/build-pages.mjs';
import { loadConfig, loadHostedEnv, type ServerConfig } from '../src/config';
import { startHosted, type RunningHosted } from '../src/hosted';
import { PRIVACY_FIELD, PRIVACY_REQUIRED_KEY } from '../src/routes/auth';
import { AccountsStore } from '../src/security/accounts';
import { createAuthService, type DiaryAuthService } from '../src/security/auth-service';
import type { AccountRecord } from '../src/security/session-types';
import { cleanupTempDirs, makeTestApp, tempDataDir, testConfig, testHostedOptions } from './helpers';

const PASSWORD = 'Passw0rd!';
const FAST = { N: 1024, r: 8, p: 1 };
const HOST = 'diary.example';
const running: RunningHosted[] = [];
const services: DiaryAuthService[] = [];

afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
  for (const s of services.splice(0)) await s.shutdown();
});
afterAll(cleanupTempDirs);

/** A registration body WITHOUT the checkbox unless `extra` adds it. */
function body(username: string, extra: object = {}) {
  return { firstName: 'Noa', lastName: 'Fictional', username, email: `${username}@example.test`, password: PASSWORD, confirmPassword: PASSWORD, ...extra };
}

/** The real hosted composition (as hosted-composition.test.ts boots it). */
async function boot() {
  const dataDir = tempDataDir();
  // The client address comes from X-Forwarded-For (as behind the proxy), so each request below has its own.
  const env = loadHostedEnv({ DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: `https://${HOST}`, DIARY_BIND: '127.0.0.1', DIARY_CLIENT_IP_HEADER: 'x-forwarded-for' });
  const config = loadConfig(['--data-dir', dataDir], { DIARY_MODE: 'hosted' });
  const srv = await startHosted(config, env, { port: 0, quiet: true, auth: { kdf: FAST } });
  running.push(srv);
  const agent = supertest(srv.localUrl);
  // Every request from its own TEST-NET address, so the register limit (5 an hour per address) never answers.
  let host = 10;
  const anon = (language = 'en') => {
    const ip = `203.0.113.${host++}`;
    return {
      post: (url: string, payload: object = {}) =>
        agent.post(url).set('Host', HOST).set('X-Forwarded-Proto', 'https').set('X-Forwarded-For', ip).set('Accept-Language', language).send(payload),
    };
  };
  const as = (token: string) => ({
    get: (url: string) => agent.get(url).set('Host', HOST).set('X-Forwarded-Proto', 'https').set('Authorization', `Bearer ${token}`),
  });
  return { srv, config, anon, as };
}

async function realAuth(config: ServerConfig = testConfig()) {
  const auth = await createAuthService(config, { kdf: FAST });
  services.push(auth);
  return { auth, config };
}

function accountsJson(config: ServerConfig): Array<Record<string, unknown>> {
  if (!fs.existsSync(config.accountsFile)) return [];
  return (JSON.parse(fs.readFileSync(config.accountsFile, 'utf8')) as { accounts: Array<Record<string, unknown>> }).accounts;
}

function diaryFiles(config: ServerConfig): string[] {
  return fs.existsSync(config.usersDir) ? fs.readdirSync(config.usersDir).filter((f) => f.includes('.mpd')) : [];
}

const privacyKeys = (record: Record<string, unknown>) => Object.keys(record).filter((k) => k.startsWith('privacy'));

describe('hosted server: no account without the privacy checkbox', () => {
  it('missing, false or anything but true -> 400 VALIDATION on the field privacyAccepted; nothing is created', async () => {
    const { srv, config, anon } = await boot();
    const cases: Array<[string, object]> = [
      ['missing', {}],
      ['false', { privacyAccepted: false }],
      ['the string "true"', { privacyAccepted: 'true' }],
      ['1', { privacyAccepted: 1 }],
      ['null', { privacyAccepted: null }],
    ];
    for (const [what, extra] of cases) {
      const res = await anon().post('/api/auth/register', body('dana', extra));
      expect({ what, status: res.status, code: res.body.code, field: res.body.field, message: res.body.message }).toEqual({
        what,
        status: 400,
        code: 'VALIDATION',
        field: 'privacyAccepted',
        message: t('en', 'server.auth.privacyRequired'),
      });
    }
    expect(PRIVACY_FIELD).toBe('privacyAccepted');
    expect(PRIVACY_REQUIRED_KEY).toBe('server.auth.privacyRequired');
    expect(srv.auth.listAccounts()).toEqual([]);
    expect(accountsJson(config)).toEqual([]);
    expect(diaryFiles(config)).toEqual([]);
    // The name and the address are still free: the same registration with the tick goes through.
    expect((await anon().post('/api/auth/register', body('dana', { privacyAccepted: true }))).status).toBe(201);
  });

  it('the fields of the form are checked first - the box is the last thing on the form', async () => {
    const { anon } = await boot();
    const res = await anon().post('/api/auth/register', body('dana', { email: 'not-an-address' }));
    expect({ status: res.status, field: res.body.field }).toEqual({ status: 400, field: 'email' });
    const weak = await anon().post('/api/auth/register', body('dana', { password: 'short', confirmPassword: 'short' }));
    expect(weak.status).toBe(400);
    expect(weak.body.field).toBe('password');
  });

  it('with the tick -> 201; the account records when (= createdAt) and which policy - and no answer carries it', async () => {
    const { config, anon, as } = await boot();
    const res = await anon('he').post('/api/auth/register', body('dana', { privacyAccepted: true }));
    expect(res.status).toBe(201);
    const reg = res.body as AuthResponse;
    const [record] = accountsJson(config);
    expect(record.id).toBe(reg.user.id);
    expect(record.privacyVersion).toBe(PRIVACY_POLICY_VERSION);
    expect(record.privacyAcceptedAt).toBe(record.createdAt);
    expect(new Date(record.privacyAcceptedAt as string).toISOString()).toBe(record.privacyAcceptedAt);
    expect(JSON.stringify(res.body)).not.toMatch(/privacy/i);
    const me = await as(reg.token).get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(JSON.stringify(me.body)).not.toMatch(/privacy/i);
    // The registry reads it back as written (a restart keeps it).
    expect(new AccountsStore(config.accountsFile).findById(reg.user.id)).toMatchObject({ privacyAcceptedAt: record.createdAt, privacyVersion: PRIVACY_POLICY_VERSION });
  });

  it('the 400 is written in the language of the request - all 20 languages, each its own text', async () => {
    const { auth } = await realAuth();
    const app = await makeTestApp({ auth, hosted: testHostedOptions({ loginPerMinute: 1000 }) });
    const english = t('en', PRIVACY_REQUIRED_KEY);
    for (const code of LOCALE_CODES) {
      const res = await app.anon().post('/api/auth/register').set('Host', HOST).set('X-Forwarded-For', '203.0.113.9').set('Accept-Language', code).send(body(`user_${code}`));
      expect({ code, status: res.status, field: res.body.field }).toEqual({ code, status: 400, field: 'privacyAccepted' });
      expect(res.body.message, code).toBe(t(code, PRIVACY_REQUIRED_KEY));
      if (code !== 'en') expect(res.body.message, code).not.toBe(english);
    }
    expect(auth.listAccounts()).toEqual([]);
  });
});

describe('existing accounts are not asked again', () => {
  it('an account from before the checkbox signs in on the hosted server, and its record stays without the fields', async () => {
    const { auth, config } = await realAuth();
    // Created the way every account was before the checkbox existed (no privacyAccepted).
    const { account } = await auth.register({ firstName: 'Old', lastName: 'Account', username: 'olduser', email: 'olduser@example.test', password: PASSWORD, rememberMe: false, deviceName: 'Phone' });
    expect(privacyKeys(accountsJson(config)[0])).toEqual([]);
    const app = await makeTestApp({ auth, hosted: testHostedOptions() });
    const login = await app.anon().post('/api/auth/login').set('Host', HOST).set('X-Forwarded-For', '203.0.113.9').send({ username: 'olduser', password: PASSWORD });
    expect(login.status).toBe(200);
    expect((login.body as AuthResponse).user.id).toBe(account.id);
    const record = accountsJson(config).find((a) => a.id === account.id) as Record<string, unknown>;
    expect(record.lastLoginAt).toBeTruthy();
    expect(privacyKeys(record)).toEqual([]);
  });

  it('accounts.json files from before the fields load unchanged; half or broken records load without both; a full one survives changes', () => {
    const file = path.join(tempDataDir(), 'accounts.json');
    const base = (id: string, extra: Record<string, unknown> = {}) => ({
      id,
      username: id,
      usernameLower: id,
      firstName: 'Fictional',
      lastName: 'Person',
      email: `${id}@example.test`,
      emailLower: `${id}@example.test`,
      createdAt: '2026-10-01T09:00:00.000Z',
      lastLoginAt: '2026-10-02T09:00:00.000Z',
      kdf: { algorithm: 'scrypt', N: 1024, r: 8, p: 1, saltHex: '11'.repeat(16) },
      verifierHex: '22'.repeat(32),
      dbFile: `${id}.mpd`,
      ...extra,
    });
    const older = base('u_older');
    const full = base('u_full', { privacyAcceptedAt: '2026-10-28T10:00:00.000Z', privacyVersion: '2026-10-28' });
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          version: 1,
          accounts: [
            older,
            full,
            base('u_half', { privacyAcceptedAt: '2026-10-28T10:00:00.000Z' }),
            base('u_other_half', { privacyVersion: '2026-10-28' }),
            base('u_number', { privacyAcceptedAt: '2026-10-28T10:00:00.000Z', privacyVersion: 42 }),
            base('u_blank', { privacyAcceptedAt: ' ', privacyVersion: '2026-10-28' }),
          ],
        },
        null,
        2,
      ),
    );
    const store = new AccountsStore(file);
    const list = store.list();
    expect(list.map((a) => a.id)).toEqual(['u_older', 'u_full', 'u_half', 'u_other_half', 'u_number', 'u_blank']);
    expect(list[0]).toEqual(older);
    expect(list[1]).toEqual(full);
    for (const a of list.slice(2)) expect({ id: a.id, keys: privacyKeys(a as unknown as Record<string, unknown>) }).toEqual({ id: a.id, keys: [] });
    // A later change of the account (profile, password) keeps the record.
    store.update({ ...(store.findById('u_full') as AccountRecord), firstName: 'Changed' });
    expect(new AccountsStore(file).findById('u_full')).toMatchObject({ firstName: 'Changed', privacyAcceptedAt: '2026-10-28T10:00:00.000Z', privacyVersion: '2026-10-28' });
  });
});

describe('local developer mode is unchanged', () => {
  it('registers without the field, and a tick sent anyway is not recorded', async () => {
    const { auth, config } = await realAuth();
    const app = await makeTestApp({ auth });
    expect((await app.anon().post('/api/auth/register').send(body('localone'))).status).toBe(201);
    expect((await app.anon().post('/api/auth/register').send(body('localtwo', { privacyAccepted: true }))).status).toBe(201);
    expect((await app.anon().post('/api/auth/register').send(body('localthree', { privacyAccepted: false }))).status).toBe(201);
    const records = accountsJson(config);
    expect(records.map((r) => r.username)).toEqual(['localone', 'localtwo', 'localthree']);
    for (const r of records) expect(privacyKeys(r)).toEqual([]);
  });
});

describe('the tour is not an account', () => {
  it('hosted: POST /api/auth/guest needs no tick and stores nothing', async () => {
    const { config, anon } = await boot();
    const tour = await anon().post('/api/auth/guest', { language: 'en' });
    expect(tour.status).toBe(201);
    expect((tour.body as AuthResponse).guest).toBe(true);
    expect(accountsJson(config)).toEqual([]);
  });
});

describe('ONE policy version: the server and the legal page generator agree', () => {
  it('PRIVACY_POLICY_VERSION is the effectiveDate of legal/settings.json as scripts/legal/build-pages.mjs reads it', () => {
    expect(isPolicyVersion(PRIVACY_POLICY_VERSION)).toBe(true);
    expect(PRIVACY_POLICY_VERSION).toBe(readSettings().effectiveDate);
  });

  it('every published policy page (public/privacy/**) prints that date - run build-pages after changing it', () => {
    const page = (rel: string) => fs.readFileSync(path.join(ROOT, 'public', 'privacy', rel, 'index.html'), 'utf8');
    expect(page('')).toContain(dateInWords(PRIVACY_POLICY_VERSION, 'en-GB'));
    for (const l of LOCALES) expect(page(l.code), l.code).toContain(dateInWords(PRIVACY_POLICY_VERSION, l.intl));
  });

  it('the date is not written in the code a second time: shared/legal.ts imports it from the settings file', () => {
    const source = fs.readFileSync(path.join(ROOT, 'shared', 'legal.ts'), 'utf8');
    expect(source).toContain("import { effectiveDate } from '../legal/settings.json';");
    expect(source.replace(/^\s*(?:\/\/|\*|\/\*\*).*$/gm, '')).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(isPolicyVersion('28.10.2026')).toBe(false);
    expect(isPolicyVersion('2026-13-45')).toBe(false);
  });
});
