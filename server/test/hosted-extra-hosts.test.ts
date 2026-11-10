/**
 * docs/android-tasks/DUCKDNS-HOST.md: a hosted server may answer under a SECOND public host name -
 * the domain the owner bought - next to DIARY_PUBLIC_URL, through `DIARY_EXTRA_HOSTS`.
 *
 *   - `parseExtraHosts` yields lower-cased DNS names (empty = none) and refuses a scheme, a path, a
 *     port, credentials or anything that is not a host name - naming the entry, never its text;
 *   - the Host check accepts the primary host OR an extra host (any case, default port or none) and
 *     answers 421 to everything else exactly as before; GET /api/health stays exempt;
 *     X-Forwarded-Host is ignored as it always was; without the variable nothing changed;
 *   - nothing else changes with the host: HSTS, CSP, CORS, `ServerInfo.publicUrl` / `remoteUrl` and
 *     the link in the reset mail keep the PRIMARY public URL;
 *   - local mode is byte-identical: the variable is not read outside hosted mode.
 * Fictional names (.example) and TEST-NET addresses only.
 */
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import type { AuthResponse, ServerInfo } from '@shared/types';
import { loadConfig, loadHostedEnv, parseExtraHosts } from '../src/config';
import { startHosted, type RunningHosted } from '../src/hosted';
import type { SmtpTransport } from '../src/mail/transport';
import { HOSTED_HSTS_HEADER_VALUE } from '../src/middleware/access';
import { isAcceptedHost } from '../src/middleware/hosted-host';
import { cleanupTempDirs, makeTestApp, tempDataDir, testHostedOptions } from './helpers';

afterAll(cleanupTempDirs);

const PRIMARY = 'diary.example';
const EXTRA = 'yourpersonaldiary.example';
const WWW = `www.${EXTRA}`;
const BASE = { DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: `https://${PRIMARY}` };
const PASSWORD = 'Passw0rd!';
const FAST = { kdf: { N: 1024, r: 8, p: 1 } };

describe('parseExtraHosts', () => {
  it('yields lower-cased, trimmed, de-duplicated host names; empty means none', () => {
    expect(parseExtraHosts(undefined)).toEqual([]);
    expect(parseExtraHosts('')).toEqual([]);
    expect(parseExtraHosts('   ')).toEqual([]);
    expect(parseExtraHosts(',')).toEqual([]);
    expect(parseExtraHosts(EXTRA)).toEqual([EXTRA]);
    expect(parseExtraHosts(` ${EXTRA} , ${WWW} `)).toEqual([EXTRA, WWW]);
    expect(parseExtraHosts('YourPersonalDiary.Example,WWW.YourPersonalDiary.Example')).toEqual([EXTRA, WWW]);
    expect(parseExtraHosts(`${EXTRA},,${WWW},`)).toEqual([EXTRA, WWW]);
    // A trailing dot (an absolute DNS name) is the same name; duplicates collapse.
    expect(parseExtraHosts(`${EXTRA},${EXTRA}.,${EXTRA.toUpperCase()}`)).toEqual([EXTRA]);
    // Punycode labels are DNS names like any other; a single label is allowed too.
    expect(parseExtraHosts('xn--4dbrk0ce.example')).toEqual(['xn--4dbrk0ce.example']);
    expect(parseExtraHosts('intranet')).toEqual(['intranet']);
  });

  it('refuses a scheme, a path, a port, credentials, IP addresses and non-names - naming the entry, never its text', () => {
    const cases: Array<[string, RegExp]> = [
      [`https://${EXTRA}`, /entry 1 .*scheme/],
      [`http://${EXTRA}`, /scheme/],
      [`${EXTRA}/app`, /path/],
      [`${EXTRA}/`, /path/],
      [`${EXTRA}?x=1`, /path, query/],
      [`${EXTRA}#login`, /path, query/],
      [`${EXTRA}:443`, /port/],
      [`${EXTRA}:8443`, /port/],
      [`user@${EXTRA}`, /credentials/],
      ['[2001:db8::1]', /IP address/],
      ['203.0.113.9', /IP address/],
      ['diary example', /DNS host name/],
      ['-bad.example', /DNS host name/],
      ['bad-.example', /DNS host name/],
      ['a..example', /DNS host name/],
      ['under_score.example', /DNS host name/],
      [`${'a'.repeat(64)}.example`, /DNS host name/],
      [`${EXTRA},${WWW}:8443`, /entry 2 .*port/],
    ];
    for (const [raw, re] of cases) {
      let message = '';
      try {
        parseExtraHosts(raw);
      } catch (e) {
        message = (e as Error).message;
      }
      expect({ raw, message }).toEqual({ raw, message: expect.stringMatching(/^DIARY_EXTRA_HOSTS/) });
      expect({ raw, message }).toEqual({ raw, message: expect.stringMatching(re) });
      // The variable and the position are named; the text of the entry is not echoed.
      expect(message).not.toContain(raw.trim());
      expect(message).not.toContain(EXTRA);
    }
  });
});

describe('loadHostedEnv and DIARY_EXTRA_HOSTS', () => {
  it('defaults to no extra host, reads the list, fails fast on a malformed entry, and leaves the primary URL alone', () => {
    expect(loadHostedEnv(BASE).extraHosts).toEqual([]);
    expect(loadHostedEnv({ ...BASE, DIARY_EXTRA_HOSTS: '' }).extraHosts).toEqual([]);
    expect(loadHostedEnv({ ...BASE, DIARY_EXTRA_HOSTS: '   ' }).extraHosts).toEqual([]);
    const env = loadHostedEnv({ ...BASE, DIARY_EXTRA_HOSTS: ` ${EXTRA}, ${WWW.toUpperCase()} ` });
    expect(env.extraHosts).toEqual([EXTRA, WWW]);
    expect(env.publicUrl).toBe(`https://${PRIMARY}`);
    expect(env.publicHost).toBe(PRIMARY);
    for (const bad of [`https://${EXTRA}`, `${EXTRA}:8443`, `${EXTRA}/x`, '203.0.113.9', `${EXTRA}, bad host`]) {
      let message = '';
      try {
        loadHostedEnv({ ...BASE, DIARY_EXTRA_HOSTS: bad });
      } catch (e) {
        message = (e as Error).message;
      }
      expect({ bad, message }).toEqual({ bad, message: expect.stringMatching(/DIARY_EXTRA_HOSTS/) });
      expect(message).not.toContain(bad);
    }
  });

  it('is not read outside hosted mode: the local configuration is identical with and without it', () => {
    const dir = tempDataDir();
    const without = loadConfig(['--data-dir', dir], {});
    const withVar = loadConfig(['--data-dir', dir], { DIARY_EXTRA_HOSTS: `https://${EXTRA}/not even a valid value` });
    expect(withVar).toEqual(without);
    expect(withVar.mode).toBe('local');
  });
});

describe('hosted mode: the Host check with extra hosts', () => {
  it('accepts the primary host or an extra host (any case, default port or none) and keeps 421 for everything else', async () => {
    const app = await makeTestApp({ hosted: testHostedOptions({ extraHosts: [EXTRA, WWW] }) });
    for (const host of [PRIMARY, `${PRIMARY}:443`, EXTRA, `${EXTRA}:443`, EXTRA.toUpperCase(), `${EXTRA}.`, WWW, `WWW.${EXTRA}:443`]) {
      const res = await app.anon().get('/api/server/info').set('Host', host);
      expect({ host, status: res.status }).toEqual({ host, status: 200 });
    }
    for (const host of [`evil.${EXTRA}`, `${EXTRA}.evil.example`, `${EXTRA}:8443`, `www.${PRIMARY}`, 'other.example', 'localhost', '203.0.113.9']) {
      const api = await app.anon().get('/api/server/info').set('Host', host);
      expect({ host, status: api.status }).toEqual({ host, status: 421 });
      expect(api.body).toEqual({ code: 'FORBIDDEN', message: t('he', 'server.remote.misdirected.body') });
      const post = await app.anon().post('/api/auth/login').set('Host', host).send({ username: 'x', password: 'y' });
      expect(post.status).toBe(421);
      const page = await app.anon().get('/').set('Host', host);
      expect(page.status).toBe(421);
      expect(page.headers['content-type']).toMatch(/text\/html/);
      // The platform's health check is still exempt; the monitor's strict path is not.
      expect((await app.anon().get('/api/health').set('Host', host)).status).toBe(200);
      expect((await app.anon().get('/api/health/strict').set('Host', host)).status).toBe(421);
    }
  });

  it('without extra hosts nothing changed: the extra host is 421 like any other', async () => {
    const app = await makeTestApp({ hosted: testHostedOptions() });
    expect((await app.anon().get('/api/server/info').set('Host', EXTRA)).status).toBe(421);
    expect((await app.anon().get('/api/server/info').set('Host', PRIMARY)).status).toBe(200);
    const empty = await makeTestApp({ hosted: testHostedOptions({ extraHosts: [] }) });
    expect((await empty.anon().get('/api/server/info').set('Host', EXTRA)).status).toBe(421);
    expect((await empty.anon().get('/api/server/info').set('Host', PRIMARY)).status).toBe(200);
  });

  it('ignores X-Forwarded-Host exactly as before', async () => {
    const app = await makeTestApp({ hosted: testHostedOptions({ extraHosts: [EXTRA] }) });
    const info = (host: string, forwarded: string) => app.anon().get('/api/server/info').set('Host', host).set('X-Forwarded-Host', forwarded);
    expect((await info(PRIMARY, 'evil.example')).status).toBe(200);
    expect((await info(EXTRA, 'evil.example')).status).toBe(200);
    expect((await info('evil.example', PRIMARY)).status).toBe(421);
    expect((await info('evil.example', EXTRA)).status).toBe(421);
  });

  it('isAcceptedHost (pure): default ports dropped, nothing else matched', () => {
    const accepted = new Set([PRIMARY, EXTRA]);
    expect(isAcceptedHost(EXTRA, accepted)).toBe(true);
    expect(isAcceptedHost(`${EXTRA}:443`, accepted)).toBe(true);
    expect(isAcceptedHost(`${EXTRA}:80`, accepted)).toBe(true);
    expect(isAcceptedHost(`${EXTRA.toUpperCase()}.`, accepted)).toBe(true);
    expect(isAcceptedHost(`${EXTRA}:8443`, accepted)).toBe(false);
    expect(isAcceptedHost(`sub.${EXTRA}`, accepted)).toBe(false);
    expect(isAcceptedHost(undefined, accepted)).toBe(false);
    expect(isAcceptedHost('', accepted)).toBe(false);
    expect(isAcceptedHost(':443', accepted)).toBe(false);
    // A set entry that carries a port matches that port only (the primary host may have one).
    expect(isAcceptedHost('diary.example:8443', new Set(['diary.example:8443']))).toBe(true);
    expect(isAcceptedHost('diary.example', new Set(['diary.example:8443']))).toBe(false);
  });

  it('the host changes nothing else: publicUrl, remoteUrl, HSTS, CSP, CORS and caching are those of the primary URL', async () => {
    const app = await makeTestApp({ hosted: testHostedOptions({ extraHosts: [EXTRA] }) });
    const secure = (host: string) => app.anon().get('/api/server/info').set('Host', host).set('X-Forwarded-Proto', 'https');
    const viaPrimary = await secure(PRIMARY);
    const viaExtra = await secure(EXTRA);
    expect(viaExtra.status).toBe(200);
    const body = viaExtra.body as ServerInfo;
    expect(body.publicUrl).toBe(`https://${PRIMARY}`);
    expect(body.remoteUrl).toBe(`https://${PRIMARY}`);
    expect(body.secure).toBe(true);
    expect(body.mode).toBe('hosted');
    const pick = (b: ServerInfo) => ({ publicUrl: b.publicUrl, remoteUrl: b.remoteUrl, secure: b.secure, mode: b.mode, isLocalRequest: b.isLocalRequest, registration: b.registration, dataDir: b.dataDir, lanUrls: b.lanUrls });
    expect(pick(body)).toEqual(pick(viaPrimary.body as ServerInfo));
    for (const header of ['strict-transport-security', 'content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-frame-options', 'permissions-policy', 'cache-control']) {
      expect({ header, value: viaExtra.headers[header] }).toEqual({ header, value: viaPrimary.headers[header] });
    }
    expect(viaExtra.headers['strict-transport-security']).toBe(HOSTED_HSTS_HEADER_VALUE);
    // Plain HTTP through the extra host: no HSTS, the same rule as for the primary host.
    const plain = await app.anon().get('/api/server/info').set('Host', EXTRA);
    expect((plain.body as ServerInfo).secure).toBe(false);
    expect(plain.headers['strict-transport-security']).toBeUndefined();
    // CORS: the same allow-list whatever the Host; the domain itself is same-origin for its own UI and gets no CORS header.
    for (const origin of ['http://tauri.localhost', 'https://localhost', 'capacitor://localhost']) {
      const res = await app.anon().options('/api/auth/login').set('Host', EXTRA).set('Origin', origin);
      expect({ origin, status: res.status, allow: res.headers['access-control-allow-origin'] }).toEqual({ origin, status: 204, allow: origin });
    }
    for (const origin of [`https://${EXTRA}`, `https://${PRIMARY}`, 'https://evil.example']) {
      const res = await app.anon().options('/api/auth/login').set('Host', EXTRA).set('Origin', origin);
      expect({ origin, status: res.status, allow: res.headers['access-control-allow-origin'] }).toEqual({ origin, status: 204, allow: undefined });
    }
  });
});

describe('startHosted with DIARY_EXTRA_HOSTS', () => {
  const running: RunningHosted[] = [];
  afterEach(async () => {
    for (const r of running.splice(0)) await r.stop();
  });

  it('answers under every configured name; the reset link mailed for a request under the extra host points at the PRIMARY URL', async () => {
    const sent: Array<{ to: string; data: string }> = [];
    const transport: SmtpTransport = { send: async (_opts, envelope, data) => void sent.push({ to: envelope.to, data }) };
    let ownerId = '';
    const dataDir = tempDataDir();
    const env = loadHostedEnv({ ...BASE, DIARY_BIND: '127.0.0.1', DIARY_EXTRA_HOSTS: `${EXTRA},${WWW}` });
    expect(env.extraHosts).toEqual([EXTRA, WWW]);
    const config = loadConfig(['--data-dir', dataDir], { DIARY_MODE: 'hosted' });
    const srv = await startHosted(config, env, { port: 0, quiet: true, auth: FAST, ownerId: () => ownerId, mailTransport: transport });
    running.push(srv);
    const agent = supertest(srv.localUrl);
    const under = (host: string, token = '') => {
      const common = (r: supertest.Test) => {
        r.set('Host', host).set('Accept-Language', 'en').set('X-Forwarded-Proto', 'https').set('X-Forwarded-For', '203.0.113.9');
        return token ? r.set('Authorization', `Bearer ${token}`) : r;
      };
      return {
        get: (url: string) => common(agent.get(url)),
        post: (url: string, body: object = {}) => common(agent.post(url)).send(body),
        put: (url: string, body: object = {}) => common(agent.put(url)).send(body),
      };
    };
    for (const host of [PRIMARY, EXTRA, WWW]) {
      expect({ host, status: (await under(host).get('/api/health')).status }).toEqual({ host, status: 200 });
      const info = await under(host).get('/api/server/info');
      expect({ host, status: info.status }).toEqual({ host, status: 200 });
      expect(info.body).toMatchObject({ mode: 'hosted', publicUrl: `https://${PRIMARY}`, remoteUrl: `https://${PRIMARY}`, secure: true, isLocalRequest: false });
    }
    expect((await under('other.example').get('/api/server/info')).status).toBe(421);

    // The owner registers under his own domain and configures mail there (a capturing transport).
    const reg = await under(EXTRA).post('/api/auth/register', { firstName: 'Test', lastName: 'Owner', username: 'ownertest', email: 'ownertest@example.com', password: PASSWORD, confirmPassword: PASSWORD, privacyAccepted: true, termsAccepted: true });
    expect(reg.status).toBe(201);
    const owner = reg.body as AuthResponse;
    ownerId = owner.user.id;
    const saved = await under(EXTRA, owner.token).put('/api/server/mail', {
      enabled: true,
      host: 'smtp.example.net',
      port: 465,
      security: 'tls',
      username: 'diary@example.net',
      smtpPassword: 'fictional-app-password',
      fromAddress: 'diary@example.net',
      password: PASSWORD,
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ ready: true, smtpPasswordSet: true, hasOwner: true });

    // Forgot-password asked under the www name: the mail carries the PRIMARY public URL, never the extra host.
    const forgot = await under(WWW).post('/api/auth/forgot-password', { email: 'ownertest@example.com' });
    expect(forgot.status).toBe(200);
    await srv.passwordReset.idle();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe('ownertest@example.com');
    const decoded = sent[0].data
      .split(/\r?\n/)
      .filter((line) => /^[A-Za-z0-9+/]+=*$/.test(line) && line.length >= 40)
      .map((line) => Buffer.from(line, 'base64').toString('utf8'))
      .join('');
    expect(decoded).toContain(`https://${PRIMARY}/#/reset-password?token=`);
    expect(decoded).not.toContain(EXTRA);
    expect(sent[0].data).not.toContain(EXTRA);
    expect(sent[0].data).not.toContain('127.0.0.1');
  });
});
