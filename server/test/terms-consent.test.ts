/**
 * The Terms of Use at registration (docs/apple-tasks/TERMS.md), server half - the sibling of privacy-consent.test.ts.
 * The registration form has ONE checkbox ("I have read the Privacy Policy and the Terms of Use, and I agree to
 * them") that sends `privacyAccepted: true` AND `termsAccepted: true`.
 *
 *   - hosted server: POST /api/auth/register with the policy but without `termsAccepted: true` (missing, false,
 *     "true", 1, null) -> 400 VALIDATION with field 'termsAccepted' and the message 'server.auth.termsRequired' in
 *     the request language (all 20); no account, no diary file. The policy is checked first (an app built before
 *     the Terms of Use existed sends only the policy flag and gets the terms answer: "update the app");
 *   - with both -> 201, and accounts.json records both pairs: `privacyAcceptedAt` / `privacyVersion` and
 *     `termsAcceptedAt` (= createdAt) / `termsVersion` (= TERMS_VERSION); no answer to a client carries them;
 *   - accounts from before the Terms of Use are not asked again: they sign in and their record stays without the
 *     terms pair; older accounts.json files load unchanged, a half or broken terms pair loads without both;
 *   - local developer mode is unchanged: no field needed, a tick sent anyway is not recorded;
 *   - ONE version: TERMS_VERSION (shared/legal.ts) is the termsEffectiveDate that scripts/legal/build-pages.mjs
 *     reads from legal/settings.json and prints on every terms page (public/terms/**).
 * Fictional users and TEST-NET addresses only.
 */
import fs from 'node:fs';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { LOCALE_CODES, t } from '@shared/i18n';
import { isPolicyVersion, PRIVACY_POLICY_VERSION, TERMS_VERSION } from '@shared/legal';
import type { AuthResponse } from '@shared/types';
import { dateInWords, LOCALES, readSettings, ROOT } from '../../scripts/legal/build-pages.mjs';
import { loadConfig, loadHostedEnv, type ServerConfig } from '../src/config';
import { startHosted, type RunningHosted } from '../src/hosted';
import { TERMS_FIELD, TERMS_REQUIRED_KEY } from '../src/routes/auth';
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

/** A registration body with the policy flag only, unless `extra` changes it. */
function body(username: string, extra: object = {}) {
  return { firstName: 'Noa', lastName: 'Fictional', username, email: `${username}@example.test`, password: PASSWORD, confirmPassword: PASSWORD, privacyAccepted: true, ...extra };
}

/** The real hosted composition (as privacy-consent.test.ts boots it). */
async function boot() {
  const dataDir = tempDataDir();
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

const termsKeys = (record: Record<string, unknown>) => Object.keys(record).filter((k) => k.startsWith('terms'));

/** True while a locale's server catalogue still carries the translator's TODO-TRANSLATE marker (English placeholder). */
function serverCatalogueUntranslated(code: string): boolean {
  return fs.readFileSync(path.join(ROOT, 'shared', 'i18n', 'messages', code, 'server.ts'), 'utf8').includes('TODO-TRANSLATE');
}

describe('hosted server: no account without the Terms of Use', () => {
  it('the policy alone (an app from before the terms), or a terms flag that is not exactly true -> 400 on termsAccepted; nothing is created', async () => {
    const { srv, config, anon } = await boot();
    const cases: Array<[string, object]> = [
      ['missing', {}],
      ['false', { termsAccepted: false }],
      ['the string "true"', { termsAccepted: 'true' }],
      ['1', { termsAccepted: 1 }],
      ['null', { termsAccepted: null }],
    ];
    for (const [what, extra] of cases) {
      const res = await anon().post('/api/auth/register', body('dana', extra));
      expect({ what, status: res.status, code: res.body.code, field: res.body.field, message: res.body.message }).toEqual({
        what,
        status: 400,
        code: 'VALIDATION',
        field: 'termsAccepted',
        message: t('en', 'server.auth.termsRequired'),
      });
    }
    expect(TERMS_FIELD).toBe('termsAccepted');
    expect(TERMS_REQUIRED_KEY).toBe('server.auth.termsRequired');
    expect(srv.auth.listAccounts()).toEqual([]);
    expect(accountsJson(config)).toEqual([]);
    expect(diaryFiles(config)).toEqual([]);
    // The name and the address are still free: the same registration with both flags goes through.
    expect((await anon().post('/api/auth/register', body('dana', { termsAccepted: true }))).status).toBe(201);
  });

  it('the policy is checked first: the terms flag alone is refused on privacyAccepted', async () => {
    const { anon } = await boot();
    const res = await anon().post('/api/auth/register', body('dana', { privacyAccepted: undefined, termsAccepted: true }));
    expect({ status: res.status, field: res.body.field }).toEqual({ status: 400, field: 'privacyAccepted' });
  });

  it('with both -> 201; the account records both pairs (when = createdAt, which versions) - and no answer carries them', async () => {
    const { config, anon, as } = await boot();
    const res = await anon('he').post('/api/auth/register', body('dana', { termsAccepted: true }));
    expect(res.status).toBe(201);
    const reg = res.body as AuthResponse;
    const [record] = accountsJson(config);
    expect(record.id).toBe(reg.user.id);
    expect(record).toMatchObject({ privacyAcceptedAt: record.createdAt, privacyVersion: PRIVACY_POLICY_VERSION, termsAcceptedAt: record.createdAt, termsVersion: TERMS_VERSION });
    expect(JSON.stringify(res.body)).not.toMatch(/terms/i);
    const me = await as(reg.token).get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(JSON.stringify(me.body)).not.toMatch(/terms/i);
    // The registry reads it back as written (a restart keeps it).
    expect(new AccountsStore(config.accountsFile).findById(reg.user.id)).toMatchObject({ termsAcceptedAt: record.createdAt, termsVersion: TERMS_VERSION });
  });

  it('the 400 is written in the language of the request - all 20 languages', async () => {
    const { auth } = await realAuth();
    const app = await makeTestApp({ auth, hosted: testHostedOptions({ loginPerMinute: 1000 }) });
    const english = t('en', TERMS_REQUIRED_KEY);
    for (const code of LOCALE_CODES) {
      const res = await app.anon().post('/api/auth/register').set('Host', HOST).set('X-Forwarded-For', '203.0.113.9').set('Accept-Language', code).send(body(`user_${code}`));
      expect({ code, status: res.status, field: res.body.field }).toEqual({ code, status: 400, field: 'termsAccepted' });
      expect(res.body.message, code).toBe(t(code, TERMS_REQUIRED_KEY));
      expect(res.body.message.trim(), code).not.toBe('');
      // Each its own text once translated (a catalogue still marked TODO-TRANSLATE holds the English placeholder).
      if (code !== 'en' && !serverCatalogueUntranslated(code)) expect(res.body.message, code).not.toBe(english);
    }
    expect(auth.listAccounts()).toEqual([]);
  });
});

describe('existing accounts are not asked again', () => {
  it('an account from before the Terms of Use signs in on the hosted server, and its record stays without the terms pair', async () => {
    const { auth, config } = await realAuth();
    const { account } = await auth.register({ firstName: 'Old', lastName: 'Account', username: 'olduser', email: 'olduser@example.test', password: PASSWORD, rememberMe: false, deviceName: 'Phone', privacyAccepted: true });
    expect(termsKeys(accountsJson(config)[0])).toEqual([]);
    const app = await makeTestApp({ auth, hosted: testHostedOptions() });
    const login = await app.anon().post('/api/auth/login').set('Host', HOST).set('X-Forwarded-For', '203.0.113.9').send({ username: 'olduser', password: PASSWORD });
    expect(login.status).toBe(200);
    expect((login.body as AuthResponse).user.id).toBe(account.id);
    const record = accountsJson(config).find((a) => a.id === account.id) as Record<string, unknown>;
    expect(record.privacyVersion).toBe(PRIVACY_POLICY_VERSION);
    expect(termsKeys(record)).toEqual([]);
  });

  it('accounts.json files from before the terms load unchanged; half or broken terms pairs load without both; a full one survives changes', () => {
    const file = path.join(tempDataDir(), 'accounts.json');
    const base = (id: string, extra: Record<string, unknown> = {}) => ({
      id,
      username: id,
      usernameLower: id,
      firstName: 'Fictional',
      lastName: 'Person',
      email: `${id}@example.test`,
      emailLower: `${id}@example.test`,
      createdAt: '2026-11-12T09:00:00.000Z',
      lastLoginAt: '2026-11-12T09:00:00.000Z',
      kdf: { algorithm: 'scrypt', N: 1024, r: 8, p: 1, saltHex: '11'.repeat(16) },
      verifierHex: '22'.repeat(32),
      dbFile: `${id}.mpd`,
      privacyAcceptedAt: '2026-11-12T09:00:00.000Z',
      privacyVersion: '2026-11-08',
      ...extra,
    });
    const older = base('u_older');
    const full = base('u_full', { termsAcceptedAt: '2026-11-12T09:00:00.000Z', termsVersion: '2026-11-12' });
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          version: 1,
          accounts: [
            older,
            full,
            base('u_half', { termsAcceptedAt: '2026-11-12T09:00:00.000Z' }),
            base('u_other_half', { termsVersion: '2026-11-12' }),
            base('u_number', { termsAcceptedAt: '2026-11-12T09:00:00.000Z', termsVersion: 42 }),
            base('u_blank', { termsAcceptedAt: ' ', termsVersion: '2026-11-12' }),
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
    for (const a of list.slice(2)) {
      const rec = a as unknown as Record<string, unknown>;
      // The terms pair goes; the privacy pair of the same record stays.
      expect({ id: a.id, keys: termsKeys(rec), privacy: rec.privacyVersion }).toEqual({ id: a.id, keys: [], privacy: '2026-11-08' });
    }
    store.update({ ...(store.findById('u_full') as AccountRecord), firstName: 'Changed' });
    expect(new AccountsStore(file).findById('u_full')).toMatchObject({ firstName: 'Changed', termsAcceptedAt: '2026-11-12T09:00:00.000Z', termsVersion: '2026-11-12' });
  });
});

describe('local developer mode is unchanged', () => {
  it('registers without either field, and ticks sent anyway are not recorded', async () => {
    const { auth, config } = await realAuth();
    const app = await makeTestApp({ auth });
    expect((await app.anon().post('/api/auth/register').send(body('localone', { privacyAccepted: undefined }))).status).toBe(201);
    expect((await app.anon().post('/api/auth/register').send(body('localtwo', { termsAccepted: true }))).status).toBe(201);
    expect((await app.anon().post('/api/auth/register').send(body('localthree', { termsAccepted: false }))).status).toBe(201);
    const records = accountsJson(config);
    expect(records.map((r) => r.username)).toEqual(['localone', 'localtwo', 'localthree']);
    for (const r of records) expect(Object.keys(r).filter((k) => k.startsWith('terms') || k.startsWith('privacy'))).toEqual([]);
  });
});

describe('ONE terms version: the server and the legal page generator agree', () => {
  it('TERMS_VERSION is the termsEffectiveDate of legal/settings.json as scripts/legal/build-pages.mjs reads it', () => {
    expect(isPolicyVersion(TERMS_VERSION)).toBe(true);
    expect(TERMS_VERSION).toBe(readSettings().termsEffectiveDate);
  });

  it('every published terms page (public/terms/**) prints that date - run build-pages after changing it', () => {
    const page = (rel: string) => fs.readFileSync(path.join(ROOT, 'public', 'terms', rel, 'index.html'), 'utf8');
    expect(page('')).toContain(dateInWords(TERMS_VERSION, 'en-GB'));
    for (const l of LOCALES) expect(page(l.code), l.code).toContain(dateInWords(TERMS_VERSION, l.intl));
  });
});
