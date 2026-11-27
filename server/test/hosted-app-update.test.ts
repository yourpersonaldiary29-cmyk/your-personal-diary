/**
 * The required update (app version 1.1.0): server/src/hosted/app-update.ts (the rule store, the store links, the
 * refusal of the versions before 1.1.0), server/src/routes/server-app-update.ts (the owner's API),
 * `ServerInfo.appUpdate`, the CORS header of the mark, and the owner's e-mail of server/src/mail/templates.ts.
 * Against a real hosted server (startHosted) with the real site in a temporary UI folder and a capturing mail
 * transport - nothing leaves the machine:
 *
 *   - the origin table, the session routes (and that they are exactly the routes of routes/auth.ts that hand out a
 *     token, plus GET /me), the store links (https on the store's own host only), the Downloads page address;
 *   - the rule store: the a.b.c guard, never below FIRST_UPDATE_AWARE_VERSION (1.1.0), never above the server's own
 *     version, turning off always allowed; a rule of 1.0.x that is already in the file is read as it is and refuses
 *     nobody; atomic and kept across a restart; a missing, unreadable or damaged file = no rule (one log line), repaired by a save;
 *     nothing read from the disk per request; the refusal never becomes a 500;
 *   - the routes: owner only, HTTPS only, the cheap checks before the password, the password, the rate limit, the
 *     e-mail; the local server has no such route;
 *   - `appUpdate` in the server info: absent while no rule is on, only the platforms that are on, the store link;
 *   - the refusal, table-driven: origin x mark x rule x route - an old app is refused on the session routes of its
 *     own platform only, with 503 and the server's ordinary JSON error body in the request's language; every other
 *     route, every other platform, the web version, the developer origins, a request with the mark: as without rule.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { APP_VERSION, CLIENT_MARK_HEADER, CLIENT_MARK_VALUE, FIRST_UPDATE_AWARE_VERSION } from '@shared/constants';
import { t } from '@shared/i18n';
import type { AppPlatform, AuthResponse, ServerAppUpdate, ServerInfo } from '@shared/types';
import { buildSite, readSiteSettings, writeSite } from '../../scripts/site/build-site.mjs';
import { compareVersions, formatStoreLinks, STORE_LINKS_FILE } from '../../scripts/site/downloads-shared.mjs';
import { loadConfig, loadHostedEnv } from '../src/config';
import { startHosted, type RunningHosted } from '../src/hosted';
import {
  APP_ORIGIN_PLATFORMS,
  APP_UPDATE_FILE,
  createAppUpdateController,
  downloadsPageUrl,
  formatRules,
  hasClientMark,
  isSessionRoute,
  LAST_UNMARKED_VERSION,
  MAX_SMALL_FILE_BYTES,
  platformOfOrigin,
  ruleRefusesUnmarked,
  rulesOf,
  SESSION_ROUTES,
  storeLinkOf,
} from '../src/hosted/app-update';
import {
  APP_UPDATE_PASSWORD_REQUIRED_KEY,
  APP_UPDATE_PLATFORM_KEY,
  APP_UPDATE_TOO_NEW_KEY,
  APP_UPDATE_TOO_OLD_KEY,
  APP_UPDATE_UNAVAILABLE_KEY,
  APP_UPDATE_VERSION_KEY,
  APP_UPDATE_WRONG_PASSWORD_KEY,
  UPDATE_REQUIRED_SITE_KEY,
  UPDATE_REQUIRED_STORE_KEY,
} from '../src/hosted/app-update-errors';
import { OWNER_UNSET_KEY } from '../src/hosted/owner';
import type { SmtpTransport } from '../src/mail/transport';
import { DEV_ORIGINS, HOSTED_ORIGINS } from '../src/middleware/access';
import { SECURE_ONLY_KEY } from '../src/routes/server-status';
import { cleanupTempDirs, makeTestApp, TEST_ACCOUNT, tempDataDir, testHostedOptions } from './helpers';
import { decodeWords, headersOf, partsOf } from './mail-fixtures';

const PASSWORD = 'Passw0rd!';
const FAST = { kdf: { N: 1024, r: 8, p: 1 } };
const HOST = 'diary.example';
const PUBLIC_URL = `https://${HOST}`;
const SENDER = 'sender@example.test';
const PLAY = 'https://play.google.com/store/apps/details?id=app.example';
const APPLE = 'https://apps.apple.com/app/id1234567890';
/** Fictional values: the owner's are never written into a test. */
const SETTINGS = { publisherName: 'Example Publisher', contactEmail: 'help@example.test', effectiveDate: '2026-11-08', termsEffectiveDate: '2026-11-12', minimumAge: 16 };
const built = buildSite({ settings: SETTINGS, siteSettings: { ...readSiteSettings(), links: { googlePlay: PLAY, appStoreIphone: null, appStoreMac: null, microsoftStore: null } } });
const running: RunningHosted[] = [];

afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

/** A UI folder like the image's ui/: index.html plus the real site; its store links as given (undefined = no file). */
function ui(links?: Record<string, string | null> | 'broken'): string {
  const dir = tempDataDir();
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Your Personal Diary</title><div id="root"></div>');
  writeSite(built, dir);
  const file = path.join(dir, 'about', ...STORE_LINKS_FILE.split('/'));
  if (links === undefined) fs.rmSync(file);
  else fs.writeFileSync(file, links === 'broken' ? '{ not json' : formatStoreLinks(links));
  return dir;
}

interface Sent {
  envelope: { from: string; to: string };
  data: string;
}

let ipSerial = 0;
/** Another client address for every request: the per-address limiters of /api/auth decide nothing in the matrix. */
const nextIp = (): string => {
  ipSerial += 1;
  return `10.${(ipSerial >> 16) & 255}.${(ipSerial >> 8) & 255}.${ipSerial & 255}`;
};

async function boot(o: { dataDir?: string; ui?: string; serverVersion?: string; failMail?: boolean } = {}) {
  const dataDir = o.dataDir ?? tempDataDir();
  const logs: string[] = [];
  const sent: Sent[] = [];
  const transport: SmtpTransport = {
    send: async (_opts, envelope, data) => {
      // The mail card's own save sends nothing; only the notices reach this.
      if (o.failMail) throw new Error('smtp said something secret');
      sent.push({ envelope: { ...envelope }, data });
    },
  };
  let ownerId = '';
  const env = loadHostedEnv({
    DIARY_MODE: 'hosted',
    DIARY_PUBLIC_URL: PUBLIC_URL,
    DIARY_BIND: '127.0.0.1',
    DIARY_CLIENT_IP_HEADER: 'x-forwarded-for',
    DIARY_TRUST_PROXY: '1',
    DIARY_AUTH_GLOBAL_PER_MINUTE: '100000',
    DIARY_MAX_GUESTS: '1000',
  });
  const config = loadConfig(['--data-dir', dataDir, '--static', o.ui ?? ui({ googlePlay: null, appStoreIphone: null, appStoreMac: null, microsoftStore: null })], { DIARY_MODE: 'hosted' });
  const srv = await startHosted(config, env, {
    port: 0,
    quiet: true,
    auth: FAST,
    mailTransport: transport,
    ownerId: () => ownerId,
    log: (line) => logs.push(line),
    ...(o.serverVersion ? { appUpdate: { serverVersion: o.serverVersion } } : {}),
  });
  running.push(srv);
  const agent = supertest(srv.localUrl);
  const common = (r: supertest.Test, secure = true, ip = '203.0.113.7') => {
    r.set('Host', HOST).set('Accept-Language', 'en').set('X-Forwarded-For', ip);
    return secure ? r.set('X-Forwarded-Proto', 'https') : r;
  };
  const as = (token: string, secure = true) => ({
    get: (url: string) => common(agent.get(url), secure).set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object = {}) => common(agent.post(url), secure).set('Authorization', `Bearer ${token}`).send(body),
  });
  const register = async (username: string, extra: object = {}): Promise<AuthResponse> => {
    const res = await common(agent.post('/api/auth/register'), true, nextIp()).send({ firstName: 'Test', lastName: 'Owner', username, email: `${username}@example.test`, password: PASSWORD, confirmPassword: PASSWORD, privacyAccepted: true, termsAccepted: true, ...extra });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body as AuthResponse;
  };
  /** The owner registers, becomes DIARY_OWNER_ID and - unless `mail` is false - fills in the E-mail card. */
  const owner = async (username = 'ownerau', { mail = true, language = 'en' }: { mail?: boolean; language?: string } = {}) => {
    const auth = await register(username, { language });
    ownerId = auth.user.id;
    if (mail) {
      const saved = await common(agent.put('/api/server/mail'))
        .set('Authorization', `Bearer ${auth.token}`)
        .send({ enabled: true, host: 'smtp.mail.test', port: 465, security: 'tls', username: SENDER, smtpPassword: 'abcdefghijklmnop', password: PASSWORD });
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    }
    return { auth, o: as(auth.token) };
  };
  /** Sets or clears a rule through the owner's route. */
  const setRule = async (o: ReturnType<typeof as>, platform: AppPlatform, minVersion: string | null): Promise<ServerAppUpdate> => {
    const res = await o.post('/api/server/app-update', { platform, minVersion, password: PASSWORD });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return res.body as ServerAppUpdate;
  };
  const info = async (): Promise<ServerInfo> => (await common(agent.get('/api/server/info'))).body as ServerInfo;
  return { srv, dataDir, logs, sent, agent, common, as, register, owner, setRule, info, setOwner: (id: string) => void (ownerId = id) };
}

const rulesFile = (dataDir: string): string => path.join(dataDir, 'site', APP_UPDATE_FILE);

// The pure parts ------------------------------------------------------------------------------------

describe('the origin table, the session routes, the mark, the store links', () => {
  it('every app origin the server answers belongs to exactly one platform; nothing else is attributed', () => {
    expect([...APP_ORIGIN_PLATFORMS.keys()].sort()).toEqual([...HOSTED_ORIGINS].sort());
    expect(Object.fromEntries(APP_ORIGIN_PLATFORMS)).toEqual({
      'https://localhost': 'android',
      'capacitor://localhost': 'ios',
      'http://tauri.localhost': 'windows',
      'https://tauri.localhost': 'windows',
      'tauri://localhost': 'mac',
    });
    for (const origin of [...DEV_ORIGINS, PUBLIC_URL, 'https://evil.example', 'http://localhost', 'HTTPS://LOCALHOST', 'https://localhost:8443', 'null', '']) expect(platformOfOrigin(origin), origin).toBeNull();
    expect(platformOfOrigin(undefined)).toBeNull();
    expect(platformOfOrigin(['https://localhost'])).toBeNull();
  });

  it('the session routes are GET /me and exactly the routes of routes/auth.ts that hand out a session token', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'auth.ts'), 'utf8');
    // Every route of the router: its method, its path and the code up to the next route.
    const routes = [...source.matchAll(/\br\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)].map((m, i, all) => ({
      method: m[1].toUpperCase(),
      path: m[2],
      code: source.slice(m.index, all[i + 1]?.index ?? source.length),
    }));
    expect(routes.length).toBeGreaterThan(10);
    const handingOutTokens = routes.filter((r) => /authResponse\(\s*token/.test(r.code)).map((r) => `${r.method} ${r.path}`);
    expect(handingOutTokens.sort()).toEqual(['POST /guest', 'POST /login', 'POST /register']);
    expect(SESSION_ROUTES.map((r) => `${r.method} ${r.path}`).sort()).toEqual(['GET /me', 'HEAD /me', 'POST /guest', 'POST /login', 'POST /register']);
    // Spelled as Express' router matches it.
    for (const [method, p] of [['GET', '/me'], ['get', '/ME/'], ['HEAD', '/me'], ['POST', '/login'], ['POST', '/Login//'], ['POST', '/register'], ['POST', '/guest']]) expect(isSessionRoute(method, p), `${method} ${p}`).toBe(true);
    for (const [method, p] of [['POST', '/me'], ['GET', '/login'], ['POST', '/logout'], ['GET', '/sessions'], ['POST', '/forgot-password'], ['POST', '/reset-password'], ['POST', '/verify-password'], ['GET', '/me/x'], ['GET', '/']]) expect(isSessionRoute(method, p), `${method} ${p}`).toBe(false);
  });

  it('the mark: the header of shared/constants.ts with any value that is not empty', () => {
    expect(CLIENT_MARK_HEADER).toBe('X-Diary-Client');
    const req = (headers: Record<string, string | string[]>) => ({ headers }) as unknown as Request;
    expect(hasClientMark(req({ 'x-diary-client': CLIENT_MARK_VALUE }))).toBe(true);
    expect(hasClientMark(req({ 'x-diary-client': '3' }))).toBe(true);
    expect(hasClientMark(req({}))).toBe(false);
    expect(hasClientMark(req({ 'x-diary-client': '  ' }))).toBe(false);
  });

  it('a store link is used only when it is https on the store\'s own host; the Downloads page in the request\'s language', () => {
    expect(storeLinkOf(PLAY, 'play.google.com')).toBe(PLAY);
    expect(storeLinkOf(APPLE, 'apps.apple.com')).toBe(APPLE);
    for (const bad of [null, '', ' ', 7, 'http://play.google.com/x', 'https://play.google.com.evil.example/x', 'https://evil.example/play.google.com', 'https://user@play.google.com/x', 'https://play.google.com:8443/x', 'not a link', APPLE]) {
      expect(storeLinkOf(bad, 'play.google.com'), String(bad)).toBeNull();
    }
    expect(downloadsPageUrl(PUBLIC_URL, 'en')).toBe('https://diary.example/about/downloads/');
    expect(downloadsPageUrl(`${PUBLIC_URL}/`, 'he')).toBe('https://diary.example/about/he/downloads/');
  });

  it('the rules file: every platform, a.b.c or null; anything else is damaged', () => {
    const all = { android: '1.1.0', ios: null, windows: '0.9.12', mac: null };
    expect(rulesOf(JSON.parse(formatRules(all)))).toEqual(all);
    expect(rulesOf({ rules: {} })).toEqual({ android: null, ios: null, windows: null, mac: null });
    expect(rulesOf({ rules: { android: '1.1.0', linux: 'x' } })).toEqual({ android: '1.1.0', ios: null, windows: null, mac: null });
    for (const bad of [null, [], {}, { rules: [] }, { rules: { android: '1.1' } }, { rules: { android: '01.1.0' } }, { rules: { ios: 110 } }, { rules: { mac: '' } }]) expect(rulesOf(bad), JSON.stringify(bad)).toBeNull();
  });
});

describe('the controller', () => {
  const mail = { ready: () => false, send: async () => {} };
  const reqOf = (method: string, routePath: string, headers: Record<string, string>): Request => ({ method, path: routePath, headers, locale: 'en' }) as unknown as Request;

  it('reads nothing from the disk per request, and the refusal never becomes a 500', async () => {
    const dataDir = tempDataDir();
    fs.mkdirSync(path.join(dataDir, 'site'), { recursive: true });
    fs.writeFileSync(rulesFile(dataDir), formatRules({ android: '1.1.0', ios: null, windows: null, mac: null }));
    const c = createAppUpdateController({ dataDir, publicUrl: PUBLIC_URL, mail, log: () => {} });
    const read = vi.spyOn(fs, 'readFileSync');
    const exists = vi.spyOn(fs, 'existsSync');
    const stat = vi.spyOn(fs, 'statSync');
    try {
      for (let i = 0; i < 50; i += 1) {
        const next = vi.fn();
        c.refuseOld(reqOf('GET', '/me', { origin: 'https://localhost' }), {} as Response, next);
        expect(next.mock.calls[0][0]).toMatchObject({ status: 503, code: 'UPDATE_REQUIRED' });
        expect(c.info()).toEqual({ android: { minVersion: '1.1.0' } });
      }
      expect(read).not.toHaveBeenCalled();
      expect(exists).not.toHaveBeenCalled();
      expect(stat).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
      exists.mockRestore();
      stat.mockRestore();
    }
    // Headers that cannot even be read: the request goes on as if there were no rule.
    const broken = { method: 'GET', path: '/me', locale: 'en' } as unknown as Request;
    Object.defineProperty(broken, 'headers', {
      get() {
        throw new Error('boom');
      },
    });
    const next = vi.fn();
    c.refuseOld(broken, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toEqual([]);
  });

  it('a missing, unreadable or damaged rules file is no rule - one log line without secrets; a save repairs it, atomically', async () => {
    const dataDir = tempDataDir();
    const logs: string[] = [];
    const missing = createAppUpdateController({ dataDir, publicUrl: PUBLIC_URL, mail, log: (l) => logs.push(l) });
    expect(missing.info()).toBeUndefined();
    expect(missing.view('').rules).toEqual({ android: null, ios: null, windows: null, mac: null });
    expect(logs).toEqual([]);
    fs.mkdirSync(path.join(dataDir, 'site'), { recursive: true });
    for (const damaged of ['{ not json', '[]', JSON.stringify({ rules: { android: 'one' } }), '']) {
      fs.writeFileSync(rulesFile(dataDir), damaged);
      logs.length = 0;
      const c = createAppUpdateController({ dataDir, publicUrl: PUBLIC_URL, mail, log: (l) => logs.push(l) });
      expect(c.info(), damaged).toBeUndefined();
      const next = vi.fn();
      c.refuseOld(reqOf('POST', '/login', { origin: 'https://localhost' }), {} as Response, next);
      expect(next.mock.calls[0]).toEqual([]);
      expect(logs).toEqual(['app-update: the rules cannot be read (site/app-update.json) - no update is required until the owner saves a rule again']);
    }
    // A folder where the file should be: unreadable.
    fs.rmSync(rulesFile(dataDir));
    fs.mkdirSync(rulesFile(dataDir));
    logs.length = 0;
    expect(createAppUpdateController({ dataDir, publicUrl: PUBLIC_URL, mail, log: (l) => logs.push(l) }).info()).toBeUndefined();
    expect(logs).toHaveLength(1);
    fs.rmSync(rulesFile(dataDir), { recursive: true });
    // The owner's next save writes a whole new file.
    fs.writeFileSync(rulesFile(dataDir), '{ not json');
    const c = createAppUpdateController({ dataDir, publicUrl: PUBLIC_URL, mail, serverVersion: '1.1.0', log: () => {} });
    const view = await c.change(c.checkChange({ platform: 'ios', minVersion: '1.1.0' }), { to: '', firstName: 'X', locale: 'en' });
    expect(view.rules).toEqual({ android: null, ios: '1.1.0', windows: null, mac: null });
    expect(JSON.parse(fs.readFileSync(rulesFile(dataDir), 'utf8'))).toEqual({ rules: { android: null, ios: '1.1.0', windows: null, mac: null } });
    expect(fs.readdirSync(path.join(dataDir, 'site'))).toEqual([APP_UPDATE_FILE]);
    // A write that fails: 500, and nothing changed - in memory and on the disk.
    const write = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw Object.assign(new Error('disk'), { code: 'EIO' });
    });
    try {
      await expect(c.change(c.checkChange({ platform: 'android', minVersion: '1.1.0' }), { to: '', firstName: 'X', locale: 'en' })).rejects.toMatchObject({ status: 500, key: 'server.appUpdate.failed' });
    } finally {
      write.mockRestore();
    }
    expect(c.view('').rules.android).toBeNull();
    expect(c.info()).toEqual({ ios: { minVersion: '1.1.0' } });
    expect(JSON.parse(fs.readFileSync(rulesFile(dataDir), 'utf8')).rules.android).toBeNull();
    expect(fs.readdirSync(path.join(dataDir, 'site')), 'no temporary file is left').toEqual([APP_UPDATE_FILE]);
  });

  it('only a rule of 1.1.0 or later refuses the unmarked versions (1.0.0 and 1.0.1): a rule of 1.0.x refuses nobody', () => {
    expect(LAST_UNMARKED_VERSION).toBe('1.0.1');
    for (const v of ['1.1.0', '1.0.2', '1.2.3', '2.0.0']) expect(ruleRefusesUnmarked(v), v).toBe(true);
    for (const v of ['1.0.1', '1.0.0', '0.9.12', null, undefined, '']) expect(ruleRefusesUnmarked(v), String(v)).toBe(false);
    for (const [rule, refused] of [['1.0.0', false], ['1.0.1', false], ['1.1.0', true]] as const) {
      const dataDir = tempDataDir();
      fs.mkdirSync(path.join(dataDir, 'site'), { recursive: true });
      fs.writeFileSync(rulesFile(dataDir), formatRules({ android: rule, ios: null, windows: null, mac: null }));
      const c = createAppUpdateController({ dataDir, publicUrl: PUBLIC_URL, mail, log: () => {} });
      // The apps from 1.1.0 on still learn the rule; only the refusal of the unmarked requests depends on it.
      expect(c.info()).toEqual({ android: { minVersion: rule } });
      const next = vi.fn();
      c.refuseOld(reqOf('GET', '/me', { origin: 'https://localhost' }), {} as Response, next);
      if (refused) expect(next.mock.calls[0][0], rule).toMatchObject({ status: 503, code: 'UPDATE_REQUIRED' });
      else expect(next.mock.calls[0], rule).toEqual([]);
    }
  });

  it('a rules file or a store-links file bigger than 64 KB counts as damaged, with the same log line', () => {
    const logs: string[] = [];
    const dataDir = tempDataDir();
    fs.mkdirSync(path.join(dataDir, 'site'), { recursive: true });
    const big = formatRules({ android: '1.1.0', ios: null, windows: null, mac: null }).replace('{', `{${' '.repeat(MAX_SMALL_FILE_BYTES)}`);
    expect(JSON.parse(big).rules.android).toBe('1.1.0');
    fs.writeFileSync(rulesFile(dataDir), big);
    const dir = ui();
    fs.writeFileSync(path.join(dir, 'about', ...STORE_LINKS_FILE.split('/')), formatStoreLinks({ googlePlay: PLAY, appStoreIphone: null, appStoreMac: null, microsoftStore: null }).replace('{', `{${' '.repeat(MAX_SMALL_FILE_BYTES)}`));
    const c = createAppUpdateController({ dataDir, staticDir: dir, publicUrl: PUBLIC_URL, mail, log: (l) => logs.push(l) });
    expect(c.info()).toBeUndefined();
    expect(logs).toEqual([
      'app-update: the store links of the site cannot be read (about/files/store-links.json) - the apps are sent to the Downloads page',
      'app-update: the rules cannot be read (site/app-update.json) - no update is required until the owner saves a rule again',
    ]);
  });

  it('the guards: a.b.c only, never below 1.1.0, never above the server\'s own version, turning off always allowed, a known platform', () => {
    const c = createAppUpdateController({ dataDir: tempDataDir(), publicUrl: PUBLIC_URL, mail, serverVersion: '1.1.0', log: () => {} });
    expect(FIRST_UPDATE_AWARE_VERSION).toBe('1.1.0');
    expect(c.checkChange({ platform: 'android', minVersion: '1.1.0' })).toEqual({ platform: 'android', minVersion: '1.1.0' });
    expect(c.checkChange({ platform: 'windows', minVersion: null })).toEqual({ platform: 'windows', minVersion: null });
    // Below the first version that knows the screen: such a rule would refuse nobody, so it cannot be saved.
    for (const v of ['1.0.0', '1.0.1', '1.0.9', '0.9.12', '0.0.0']) {
      expect(() => c.checkChange({ platform: 'mac', minVersion: v }), v).toThrow(expect.objectContaining({ status: 400, code: 'VALIDATION', key: APP_UPDATE_TOO_OLD_KEY, field: 'minVersion', params: { version: '1.1.0' } }));
    }
    for (const v of ['1.1', '1.1.0.0', 'v1.1.0', '01.1.0', '1.10000.0', ' 1.1.0', '', 110, undefined, true]) {
      expect(() => c.checkChange({ platform: 'android', minVersion: v }), String(v)).toThrow(expect.objectContaining({ status: 400, key: APP_UPDATE_VERSION_KEY, field: 'minVersion' }));
    }
    for (const v of ['1.1.1', '1.2.0', '2.0.0', '1.10.0']) {
      expect(() => c.checkChange({ platform: 'ios', minVersion: v }), v).toThrow(expect.objectContaining({ status: 400, key: APP_UPDATE_TOO_NEW_KEY, field: 'minVersion', params: { version: '1.1.0' } }));
    }
    for (const p of ['linux', 'iphone', 'Android', '', null, undefined]) {
      expect(() => c.checkChange({ platform: p, minVersion: '1.0.0' }), String(p)).toThrow(expect.objectContaining({ status: 400, key: APP_UPDATE_PLATFORM_KEY, field: 'platform' }));
    }
    // By default the guard is the server's own APP_VERSION.
    const own = createAppUpdateController({ dataDir: tempDataDir(), publicUrl: PUBLIC_URL, mail, log: () => {} });
    expect(own.view('').serverVersion).toBe(APP_VERSION);
    expect(() => own.checkChange({ platform: 'android', minVersion: '99.0.0' })).toThrow(expect.objectContaining({ key: APP_UPDATE_TOO_NEW_KEY }));
  });

  it('the order of the two refusals: below 1.1.0 first, then above the server\'s own version; turning off always', () => {
    // A server of 1.0.1 (today's APP_VERSION): no rule can be saved at all - below 1.1.0 is too old, 1.1.0 too new.
    const today = createAppUpdateController({ dataDir: tempDataDir(), publicUrl: PUBLIC_URL, mail, serverVersion: '1.0.1', log: () => {} });
    for (const v of ['1.0.0', '1.0.1', '1.0.9']) {
      expect(() => today.checkChange({ platform: 'android', minVersion: v }), v).toThrow(expect.objectContaining({ status: 400, key: APP_UPDATE_TOO_OLD_KEY, field: 'minVersion', params: { version: FIRST_UPDATE_AWARE_VERSION } }));
    }
    for (const v of ['1.1.0', '1.2.0']) {
      expect(() => today.checkChange({ platform: 'android', minVersion: v }), v).toThrow(expect.objectContaining({ status: 400, key: APP_UPDATE_TOO_NEW_KEY, field: 'minVersion', params: { version: '1.0.1' } }));
    }
    const release = createAppUpdateController({ dataDir: tempDataDir(), publicUrl: PUBLIC_URL, mail, serverVersion: '1.1.0', log: () => {} });
    for (const c of [today, release]) {
      for (const platform of ['android', 'ios', 'windows', 'mac'] as const) expect(c.checkChange({ platform, minVersion: null })).toEqual({ platform, minVersion: null });
    }
    // A later server accepts every version from 1.1.0 up to its own.
    const later = createAppUpdateController({ dataDir: tempDataDir(), publicUrl: PUBLIC_URL, mail, serverVersion: '1.3.2', log: () => {} });
    for (const v of ['1.1.0', '1.2.7', '1.3.2']) expect(later.checkChange({ platform: 'ios', minVersion: v })).toEqual({ platform: 'ios', minVersion: v });
    expect(() => later.checkChange({ platform: 'ios', minVersion: '1.0.9' })).toThrow(expect.objectContaining({ key: APP_UPDATE_TOO_OLD_KEY }));
  });

  it('the store links of the deployed site: missing, broken or another host = no link (one log line); a good link is given to its platform only', () => {
    const logs: string[] = [];
    const make = (dir: string) => {
      logs.length = 0;
      const dataDir = tempDataDir();
      fs.mkdirSync(path.join(dataDir, 'site'), { recursive: true });
      fs.writeFileSync(rulesFile(dataDir), formatRules({ android: '1.0.0', ios: '1.0.0', windows: '1.0.0', mac: '1.0.0' }));
      return createAppUpdateController({ dataDir, staticDir: dir, publicUrl: PUBLIC_URL, mail, log: (l) => logs.push(l) });
    };
    const plain = { android: { minVersion: '1.0.0' }, ios: { minVersion: '1.0.0' }, windows: { minVersion: '1.0.0' }, mac: { minVersion: '1.0.0' } };
    expect(make(ui()).info()).toEqual(plain);
    expect(logs).toContain('app-update: the image holds no store links (about/files/store-links.json) - the apps are sent to the Downloads page');
    expect(make(ui('broken')).info()).toEqual(plain);
    expect(logs).toContain('app-update: the store links of the site cannot be read (about/files/store-links.json) - the apps are sent to the Downloads page');
    expect(make(ui({ googlePlay: 'https://evil.example/x', appStoreIphone: 'http://apps.apple.com/x', appStoreMac: null, microsoftStore: null })).info()).toEqual(plain);
    expect(logs.filter((l) => l.includes('is not an https address'))).toEqual([
      'app-update: the Google Play link of the site is not an https address on play.google.com - it is not used',
      'app-update: the App Store link of the site is not an https address on apps.apple.com - it is not used',
    ]);
    // The Mac App Store and the Microsoft Store are not given: Windows and Mac open the Downloads page.
    expect(make(ui({ googlePlay: PLAY, appStoreIphone: APPLE, appStoreMac: APPLE, microsoftStore: 'https://apps.microsoft.com/detail/x' })).info()).toEqual({
      android: { minVersion: '1.0.0', storeUrl: PLAY },
      ios: { minVersion: '1.0.0', storeUrl: APPLE },
      windows: { minVersion: '1.0.0' },
      mac: { minVersion: '1.0.0' },
    });
    // No UI folder at all (a bundle-only server): no link and no log line.
    logs.length = 0;
    const dataDir = tempDataDir();
    expect(createAppUpdateController({ dataDir, publicUrl: PUBLIC_URL, mail, log: (l) => logs.push(l) }).info()).toBeUndefined();
    expect(logs).toEqual([]);
  });
});

// The owner's API -------------------------------------------------------------------------------------------

describe('the owner\'s routes', () => {
  it('owner only, over HTTPS only; the cheap checks before the password; the password; a guest is never the owner', async () => {
    // The server of the release that brings the rule: a rule may be as high as 1.1.0.
    const b = await boot({ serverVersion: '1.1.0' });
    const stranger = await b.register('strangerau');
    const so = b.as(stranger.token);
    // No owner configured: nobody, the would-be owner included.
    expect((await so.get('/api/server/app-update')).body).toMatchObject({ code: 'FORBIDDEN', message: t('en', OWNER_UNSET_KEY) });
    const { auth, o } = await b.owner('ownerroutes', { mail: false });
    // Another account, a guest, plain HTTP, no session.
    for (const res of [await so.get('/api/server/app-update'), await so.post('/api/server/app-update', { platform: 'android', minVersion: '1.0.0', password: PASSWORD })]) {
      expect({ status: res.status, code: res.body.code, message: res.body.message }).toEqual({ status: 403, code: 'FORBIDDEN', message: t('en', 'server.error.forbidden') });
    }
    const guest = await b.common(b.agent.post('/api/auth/guest'), true, '198.51.100.9').send({});
    expect(guest.status, JSON.stringify(guest.body)).toBe(201);
    const guestAuth = guest.body as AuthResponse;
    expect((await b.as(guestAuth.token).get('/api/server/app-update')).status).toBe(403);
    // The guest check on its own: even while DIARY_OWNER_ID names the guest's own account, a guest is never the owner.
    b.setOwner(guestAuth.user.id);
    for (const res of [await b.as(guestAuth.token).get('/api/server/app-update'), await b.as(guestAuth.token).post('/api/server/app-update', { platform: 'android', minVersion: '1.0.0', password: '' })]) {
      expect({ status: res.status, code: res.body.code, message: res.body.message }).toEqual({ status: 403, code: 'FORBIDDEN', message: t('en', 'server.error.forbidden') });
    }
    b.setOwner(auth.user.id);
    const plain = b.as(auth.token, false);
    expect((await plain.get('/api/server/app-update')).body).toMatchObject({ code: 'FORBIDDEN', message: t('en', SECURE_ONLY_KEY) });
    expect((await plain.post('/api/server/app-update', { platform: 'android', minVersion: '1.0.0', password: PASSWORD })).status).toBe(403);
    expect((await b.common(b.agent.get('/api/server/app-update'))).status).toBe(401);
    // The owner.
    const view = (await o.get('/api/server/app-update')).body as ServerAppUpdate;
    expect(view).toEqual({ rules: { android: null, ios: null, windows: null, mac: null }, serverVersion: '1.1.0', newestDownload: expect.any(Object), email: 'notConfigured' });
    // The site of the test lists installers: the hint is their newest version, never one for the iPhone.
    for (const platform of ['android', 'windows', 'mac'] as const) expect(view.newestDownload[platform]).toBe(built.downloads[platform][0].version);
    expect(view.newestDownload.ios).toBeUndefined();
    // The body first: a wrong password with a bad body costs no password attempt and says what is wrong with the body.
    const verify = vi.spyOn(b.srv.auth, 'verifyPassword');
    for (const [body, key, field, version] of [
      [{ platform: 'linux', minVersion: '1.1.0', password: 'wrong' }, APP_UPDATE_PLATFORM_KEY, 'platform', ''],
      [{ platform: 'android', minVersion: '1.0', password: 'wrong' }, APP_UPDATE_VERSION_KEY, 'minVersion', ''],
      [{ platform: 'android', minVersion: '1.0.0', password: 'wrong' }, APP_UPDATE_TOO_OLD_KEY, 'minVersion', FIRST_UPDATE_AWARE_VERSION],
      [{ platform: 'ios', minVersion: '1.0.1', password: 'wrong' }, APP_UPDATE_TOO_OLD_KEY, 'minVersion', FIRST_UPDATE_AWARE_VERSION],
      [{ platform: 'mac', minVersion: '1.0.9', password: 'wrong' }, APP_UPDATE_TOO_OLD_KEY, 'minVersion', FIRST_UPDATE_AWARE_VERSION],
      [{ platform: 'android', minVersion: '99.0.0', password: 'wrong' }, APP_UPDATE_TOO_NEW_KEY, 'minVersion', '1.1.0'],
    ] as const) {
      const res = await o.post('/api/server/app-update', body);
      expect({ status: res.status, code: res.body.code, field: res.body.field, message: res.body.message }).toEqual({ status: 400, code: 'VALIDATION', field, message: t('en', key, { version }) });
    }
    expect(t('en', APP_UPDATE_TOO_OLD_KEY, { version: FIRST_UPDATE_AWARE_VERSION })).toBe('The oldest version that can be set here is 1.1.0.');
    expect(t('he', APP_UPDATE_TOO_OLD_KEY, { version: FIRST_UPDATE_AWARE_VERSION })).toBe('הגרסה הישנה ביותר שאפשר לקבוע כאן היא 1.1.0.');
    expect(verify).not.toHaveBeenCalled();
    const bad = await b.common(b.agent.post('/api/server/app-update')).set('Authorization', `Bearer ${auth.token}`).set('Content-Type', 'application/json').send('[1]');
    expect(bad.status).toBe(400);
    // The password: missing, wrong (400, the session stays), right.
    const missing = await o.post('/api/server/app-update', { platform: 'android', minVersion: '1.1.0' });
    expect({ status: missing.status, field: missing.body.field, message: missing.body.message }).toEqual({ status: 400, field: 'password', message: t('en', APP_UPDATE_PASSWORD_REQUIRED_KEY) });
    const wrong = await o.post('/api/server/app-update', { platform: 'android', minVersion: '1.1.0', password: 'wrong' });
    expect({ status: wrong.status, code: wrong.body.code, field: wrong.body.field, message: wrong.body.message }).toEqual({ status: 400, code: 'WRONG_PASSWORD', field: 'password', message: t('en', APP_UPDATE_WRONG_PASSWORD_KEY) });
    expect(verify).toHaveBeenCalledTimes(1);
    verify.mockRestore();
    expect((await o.get('/api/server/app-update')).status).toBe(200);
    expect(fs.existsSync(rulesFile(b.dataDir))).toBe(false);
    const saved = await b.setRule(o, 'android', '1.1.0');
    expect(saved.rules).toEqual({ android: '1.1.0', ios: null, windows: null, mac: null });
    expect(b.logs).toContain('app-update: android: versions older than 1.1.0 must update');
    const off = await b.setRule(o, 'android', null);
    expect(off.rules.android).toBeNull();
    expect(b.logs).toContain('app-update: android: turned off - no update is required');
    // No log line names an account, an address or the password.
    for (const line of b.logs.filter((l) => l.startsWith('app-update:'))) expect(line).not.toMatch(/ownerroutes|example\.test|Passw0rd/);
  });

  it('a rate limit of 30 changes a minute per address', async () => {
    const b = await boot();
    const { o } = await b.owner('ownerrate', { mail: false });
    const statuses: number[] = [];
    for (let i = 0; i < 31; i += 1) statuses.push((await o.post('/api/server/app-update', { platform: 'windows', minVersion: null, password: PASSWORD })).status);
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  it('every change: one e-mail to the owner\'s own address in his language - which platform, the version or "turned off", when', async () => {
    const b = await boot({ serverVersion: '1.1.0' });
    const { auth, o } = await b.owner('ownermail', { language: 'he' });
    expect(((await o.get('/api/server/app-update')).body as ServerAppUpdate).email).toBe('ready');
    await b.setRule(o, 'ios', '1.1.0');
    await b.setRule(o, 'ios', null);
    expect(b.sent).toHaveLength(2);
    for (const s of b.sent) expect(s.envelope.to).toBe(auth.user.email);
    expect(decodeWords(headersOf(b.sent[0].data).subject)).toBe(t('he', 'server.email.appUpdate.on.subject'));
    const on = partsOf(b.sent[0].data).text;
    for (const part of ['iPhone', '1.1.0', t('he', 'server.email.appUpdate.notYou')]) expect(on).toContain(part);
    expect(decodeWords(headersOf(b.sent[1].data).subject)).toBe(t('he', 'server.email.appUpdate.off.subject'));
    expect(partsOf(b.sent[1].data).text).toContain('iPhone');
    // The mail server refuses: the change is made all the same, and one log line says so without the failure's text.
    const failing = await boot({ failMail: true, serverVersion: '1.1.0' });
    const f = await failing.owner('ownerfail');
    const res = await f.o.post('/api/server/app-update', { platform: 'mac', minVersion: '1.1.0', password: PASSWORD });
    expect(res.status).toBe(200);
    expect((res.body as ServerAppUpdate).rules.mac).toBe('1.1.0');
    expect(failing.logs.join('\n')).not.toContain('secret');
    expect(failing.logs.some((l) => l.startsWith('app-update: the e-mail about it was not sent ('))).toBe(true);
  });

  it('the rules are kept across a restart; the local server and a hosted app without the controller have no such route', async () => {
    const dataDir = tempDataDir();
    const first = await boot({ dataDir, serverVersion: '1.2.0' });
    const { o } = await first.owner('ownerkeep', { mail: false });
    await first.setRule(o, 'android', '1.1.0');
    await first.setRule(o, 'windows', '1.2.0');
    await first.srv.stop();
    running.splice(running.indexOf(first.srv), 1);
    const again = await boot({ dataDir });
    expect((await again.info()).appUpdate).toEqual({ android: { minVersion: '1.1.0' }, windows: { minVersion: '1.2.0' } });
    expect(again.logs).toContain('app-update: on for android (older than 1.1.0), windows (older than 1.2.0)');

    const local = await makeTestApp();
    expect((await local.get('/api/server/app-update')).status).toBe(404);
    expect(((await local.get('/api/server/info')).body as ServerInfo).appUpdate).toBeUndefined();
    const bare = await makeTestApp({ hosted: testHostedOptions({ ownerId: () => TEST_ACCOUNT.id }) });
    const res = await bare.get('/api/server/app-update').set('Host', HOST).set('X-Forwarded-Proto', 'https');
    expect({ status: res.status, message: res.body.message }).toEqual({ status: 403, message: t('he', APP_UPDATE_UNAVAILABLE_KEY) });
  });
});

// The server info ------------------------------------------------------------------------------------

describe('ServerInfo.appUpdate', () => {
  it('absent while no rule is on; only the platforms that are on; the store link of the deployed site for android and ios', async () => {
    const b = await boot({ serverVersion: '1.2.0', ui: ui({ googlePlay: PLAY, appStoreIphone: APPLE, appStoreMac: null, microsoftStore: null }) });
    expect('appUpdate' in (await b.info())).toBe(false);
    const { o } = await b.owner('ownerinfo', { mail: false });
    await b.setRule(o, 'android', '1.2.0');
    expect((await b.info()).appUpdate).toEqual({ android: { minVersion: '1.2.0', storeUrl: PLAY } });
    await b.setRule(o, 'ios', '1.1.0');
    await b.setRule(o, 'mac', '1.1.0');
    expect((await b.info()).appUpdate).toEqual({ android: { minVersion: '1.2.0', storeUrl: PLAY }, ios: { minVersion: '1.1.0', storeUrl: APPLE }, mac: { minVersion: '1.1.0' } });
    // Public: no session needed; plain HTTP too.
    expect(((await b.common(b.agent.get('/api/server/info'), false)).body as ServerInfo).appUpdate?.mac).toEqual({ minVersion: '1.1.0' });
    for (const platform of ['android', 'ios', 'mac'] as const) await b.setRule(o, platform, null);
    expect('appUpdate' in (await b.info())).toBe(false);
  });

  it('today\'s site has no store link: nothing about a store is exposed', async () => {
    expect(readSiteSettings().links).toEqual({ googlePlay: null, appStoreIphone: null, appStoreMac: null, microsoftStore: null });
    const b = await boot({ serverVersion: '1.1.0', ui: ui(readSiteSettings().links) });
    const { o } = await b.owner('ownertoday', { mail: false });
    for (const platform of ['android', 'ios'] as const) await b.setRule(o, platform, '1.1.0');
    expect((await b.info()).appUpdate).toEqual({ android: { minVersion: '1.1.0' }, ios: { minVersion: '1.1.0' } });
  });
});

// The refusal of the versions before 1.1.0 -------------------------------------------------------------------

describe('the versions before 1.1.0: refused on the session routes of their own platform only', () => {
  const ORIGINS: { name: string; origin: string | null; platform: AppPlatform | null }[] = [
    { name: 'android', origin: 'https://localhost', platform: 'android' },
    { name: 'iphone', origin: 'capacitor://localhost', platform: 'ios' },
    { name: 'windows', origin: 'http://tauri.localhost', platform: 'windows' },
    { name: 'windows https', origin: 'https://tauri.localhost', platform: 'windows' },
    { name: 'mac', origin: 'tauri://localhost', platform: 'mac' },
    { name: 'web (the server\'s own origin)', origin: PUBLIC_URL, platform: null },
    { name: 'no origin', origin: null, platform: null },
    { name: 'developer (Vite 1420)', origin: 'http://localhost:1420', platform: null },
    { name: 'developer (Vite 1430)', origin: 'http://127.0.0.1:1430', platform: null },
    { name: 'foreign', origin: 'https://evil.example', platform: null },
  ];
  /** No mark (1.0.x), an empty or blank value (no mark either), the mark of 1.1.0, and another value (a later client). */
  const MARKS = [null, '', ' ', CLIENT_MARK_VALUE, '3'] as const;
  const unmarked = (mark: string | null): boolean => mark === null || mark.trim() === '';
  /** The rule states: which platforms are on, and the version of their rule. */
  const RULES: { name: string; on: AppPlatform[]; version: string }[] = [
    { name: 'no rule', on: [], version: '' },
    { name: 'android only', on: ['android'], version: '1.1.0' },
    { name: 'every platform', on: ['android', 'ios', 'windows', 'mac'], version: '1.1.0' },
    // A rule of 1.0.x cannot tell 1.0.0 from 1.0.1 (neither sends the mark): it refuses nobody. The owner's route
    // cannot save it any more (tooOld), so it is put into the file and the server is started again - the state of a
    // rule written by hand or by an earlier build. These come last.
    { name: 'android at 1.0.1', on: ['android'], version: '1.0.1' },
    { name: 'every platform at 1.0.0', on: ['android', 'ios', 'windows', 'mac'], version: '1.0.0' },
  ];
  type Ctx = { token: string; username: string };
  type Send = { get: (u: string) => supertest.Test; head: (u: string) => supertest.Test; post: (u: string) => supertest.Test };
  /** The routes: whether it is a session route, and the request. */
  const ROUTES: { name: string; session: boolean; send: (r: Send, ctx: Ctx) => supertest.Test }[] = [
    { name: 'GET /api/auth/me', session: true, send: (r, c) => r.get('/api/auth/me').set('Authorization', `Bearer ${c.token}`) },
    { name: 'HEAD /api/auth/me', session: true, send: (r, c) => r.head('/api/auth/me').set('Authorization', `Bearer ${c.token}`) },
    { name: 'GET /api/auth/me/', session: true, send: (r, c) => r.get('/api/auth/me/').set('Authorization', `Bearer ${c.token}`) },
    { name: 'POST /api/auth/login', session: true, send: (r, c) => r.post('/api/auth/login').send({ username: c.username, password: PASSWORD }) },
    { name: 'POST /api/auth/register', session: true, send: (r) => r.post('/api/auth/register').send({}) },
    { name: 'POST /api/auth/guest', session: true, send: (r) => r.post('/api/auth/guest').send({}) },
    { name: 'GET /api/auth/sessions', session: false, send: (r, c) => r.get('/api/auth/sessions').set('Authorization', `Bearer ${c.token}`) },
    { name: 'POST /api/auth/forgot-password', session: false, send: (r) => r.post('/api/auth/forgot-password').send({ email: 'nobody@example.test' }) },
    { name: 'GET /api/health', session: false, send: (r) => r.get('/api/health') },
    { name: 'GET /api/server/info', session: false, send: (r) => r.get('/api/server/info') },
    { name: 'GET /api/entries', session: false, send: (r, c) => r.get('/api/entries').set('Authorization', `Bearer ${c.token}`) },
    { name: 'GET /api/settings', session: false, send: (r, c) => r.get('/api/settings').set('Authorization', `Bearer ${c.token}`) },
    { name: 'GET /api/sync/key', session: false, send: (r, c) => r.get('/api/sync/key').set('Authorization', `Bearer ${c.token}`) },
    { name: 'POST /api/sync/op (a bad body)', session: false, send: (r, c) => r.post('/api/sync/op').set('Authorization', `Bearer ${c.token}`).send({ v: 99 }) },
    { name: 'GET / (the web UI)', session: false, send: (r) => r.get('/') },
    { name: 'GET /about/downloads/ (the site)', session: false, send: (r) => r.get('/about/downloads/') },
    { name: 'GET /about/privacy/ (a legal page)', session: false, send: (r) => r.get('/about/privacy/') },
    { name: 'GET /about/site.css (a static file)', session: false, send: (r) => r.get('/about/site.css') },
  ];

  it('the matrix origin x mark x rule x route', async () => {
    // The server of the release that brings the rule: a rule may be as high as 1.1.0.
    const first = await boot({ serverVersion: '1.1.0' });
    let b = first;
    const { auth: ownerAuth, o } = await b.owner('ownermatrix', { mail: false });
    let ownerToken = ownerAuth.token;
    const user = await b.register('usermatrix');
    const ctx: Ctx = { token: user.token, username: 'usermatrix' };
    /** A new session (a regular session dies with the process); without an Origin, so never refused. */
    const signIn = async (username: string): Promise<string> => {
      const res = await b.common(b.agent.post('/api/auth/login'), true, nextIp()).send({ username, password: PASSWORD });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      return (res.body as AuthResponse).token;
    };
    /** A rule below 1.1.0: refused by the owner's route, then written into the file and read at the next start. */
    const restartWith = async (rule: (typeof RULES)[number]) => {
      const res = await b.as(ownerToken).post('/api/server/app-update', { platform: rule.on[0], minVersion: rule.version, password: PASSWORD });
      expect({ status: res.status, message: res.body.message, field: res.body.field }).toEqual({ status: 400, message: t('en', APP_UPDATE_TOO_OLD_KEY, { version: FIRST_UPDATE_AWARE_VERSION }), field: 'minVersion' });
      await b.srv.stop();
      running.splice(running.indexOf(b.srv), 1);
      const all = ['android', 'ios', 'windows', 'mac'] as const;
      fs.writeFileSync(rulesFile(first.dataDir), formatRules(Object.fromEntries(all.map((p) => [p, rule.on.includes(p) ? rule.version : null])) as Record<AppPlatform, string | null>));
      b = await boot({ dataDir: first.dataDir, serverVersion: '1.1.0' });
      b.setOwner(ownerAuth.user.id);
      ownerToken = await signIn('ownermatrix');
      ctx.token = await signIn('usermatrix');
      // Read as it is: the apps from 1.1.0 on still learn it.
      expect((await b.info()).appUpdate, rule.name).toEqual(Object.fromEntries(rule.on.map((p) => [p, { minVersion: rule.version }])));
    };
    const request = (origin: string | null, mark: string | null) => {
      const prepare = (r: supertest.Test) => {
        b.common(r, true, nextIp());
        if (origin) r.set('Origin', origin);
        if (mark !== null) r.set(CLIENT_MARK_HEADER, mark);
        return r;
      };
      return { get: (u: string) => prepare(b.agent.get(u)), head: (u: string) => prepare(b.agent.head(u)), post: (u: string) => prepare(b.agent.post(u)) };
    };
    /** The answer of every cell with no rule on: what every cell that is not refused must answer again. */
    const baseline = new Map<string, number>();
    const cell = (o2: (typeof ORIGINS)[number], mark: string | null, route: (typeof ROUTES)[number]) => `${o2.name} | mark ${mark ?? 'none'} | ${route.name}`;
    const failures: string[] = [];
    for (const rule of RULES) {
      if (rule.version && compareVersions(rule.version, FIRST_UPDATE_AWARE_VERSION) < 0) await restartWith(rule);
      else for (const platform of ['android', 'ios', 'windows', 'mac'] as const) await b.setRule(o, platform, rule.on.includes(platform) ? rule.version : null);
      for (const origin of ORIGINS) {
        for (const mark of MARKS) {
          for (const route of ROUTES) {
            const res = await route.send(request(origin.origin, mark), ctx);
            const name = `${rule.name} | ${cell(origin, mark, route)}`;
            const refused = route.session && unmarked(mark) && origin.platform !== null && rule.on.includes(origin.platform) && rule.version === '1.1.0';
            if (refused) {
              // HEAD carries no body: its status and its type say it.
              const isHead = route.name.startsWith('HEAD ');
              const bodyOk = isHead || (res.body.code === 'UPDATE_REQUIRED' && typeof res.body.message === 'string');
              const ok = res.status === 503 && bodyOk && res.headers['content-type']?.startsWith('application/json');
              if (!ok) failures.push(`${name}: expected the refusal, got ${res.status} ${JSON.stringify(res.body).slice(0, 120)}`);
              // The app can read it: CORS is answered for its origin.
              if (res.headers['access-control-allow-origin'] !== origin.origin) failures.push(`${name}: no CORS header on the refusal`);
            } else {
              // (HEAD has no body to read: the baseline comparison below catches its 503.)
              if (res.body?.code === 'UPDATE_REQUIRED') failures.push(`${name}: refused, but must not be`);
              const key = cell(origin, mark, route);
              if (rule.on.length === 0) baseline.set(key, res.status);
              else if (baseline.get(key) !== res.status) failures.push(`${name}: ${res.status}, without a rule ${baseline.get(key)}`);
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
    // The cells answer what they always answer (the baseline itself is meaningful).
    const base = (route: string) => baseline.get(cell(ORIGINS[0], null, ROUTES.find((r) => r.name === route)!));
    expect(base('GET /api/auth/me')).toBe(200);
    expect(base('HEAD /api/auth/me')).toBe(200);
    expect(base('GET /api/auth/me/')).toBe(200);
    expect(base('POST /api/auth/login')).toBe(200);
    expect(base('POST /api/auth/register')).toBe(400);
    expect(base('POST /api/auth/guest')).toBe(201);
    expect(base('GET /api/sync/key')).toBe(200);
    expect(base('GET / (the web UI)')).toBe(200);
    expect(base('GET /about/site.css (a static file)')).toBe(200);
    // The refusals are logged, at most once in 10 minutes per platform, without anything about the request.
    expect(b).not.toBe(first);
    expect(b.logs.filter((l) => l.includes('was asked to update')), 'a rule of 1.0.x refuses nobody').toEqual([]);
    expect(first.logs.filter((l) => l.includes('was asked to update')).sort()).toEqual([
      'app-update: a version before 1.1.0 of the android app was asked to update (the first in 10 minutes)',
      'app-update: a version before 1.1.0 of the ios app was asked to update (the first in 10 minutes)',
      'app-update: a version before 1.1.0 of the mac app was asked to update (the first in 10 minutes)',
      'app-update: a version before 1.1.0 of the windows app was asked to update (the first in 10 minutes)',
    ]);
    // The whole matrix in one test: 37-39 s inside a full run (4 workers) on the morning of 2026-11-27. Later
    // that day the same machine ran about three times slower: 104-106 s alone, and more than the 120 s the test
    // had then in two full runs. The time says nothing about the server, so the budget is 300 s.
  }, 300_000);

  it('the answer: 503, the server\'s ordinary JSON error body, the localized message - the App Store for the iPhone, the Downloads page in the request\'s language for every other platform, with or without store links on the site; the token stays valid', async () => {
    // Android: every install of 1.0.0 and 1.0.1 came from the site's file, and an install from the site can be
    // updated only with the site's file (Google Play signs with its own key) - so the Downloads page also while the
    // site has a Google Play link. `ServerInfo.appUpdate` still carries that link for the apps from 1.1.0 on.
    const NO_LINKS = { googlePlay: null, appStoreIphone: null, appStoreMac: null, microsoftStore: null };
    const LINKS = { googlePlay: PLAY, appStoreIphone: APPLE, appStoreMac: APPLE, microsoftStore: 'https://apps.microsoft.com/detail/x' };
    for (const [n, links] of [[1, NO_LINKS], [2, LINKS]] as const) {
      const b = await boot({ serverVersion: '1.1.0', ui: ui(links) });
      const { o } = await b.owner(`owneranswer${n}`, { mail: false });
      const user = await b.register(`useranswer${n}`);
      for (const platform of ['android', 'ios', 'windows', 'mac'] as const) await b.setRule(o, platform, '1.1.0');
      expect((await b.info()).appUpdate?.android, `site ${n}`).toEqual(links === LINKS ? { minVersion: '1.1.0', storeUrl: PLAY } : { minVersion: '1.1.0' });
      const me = (origin: string, language: string) => b.common(b.agent.get('/api/auth/me'), true, nextIp()).set('Origin', origin).set('Accept-Language', language).set('Authorization', `Bearer ${user.token}`);
      const android = await me('https://localhost', 'he');
      expect(android.status, `site ${n}`).toBe(503);
      expect(android.body, `site ${n}`).toEqual({ code: 'UPDATE_REQUIRED', message: t('he', UPDATE_REQUIRED_SITE_KEY, { url: 'https://diary.example/about/he/downloads/' }) });
      expect(android.body.message).toBe('אי אפשר להשתמש יותר בגרסה הזאת של Your Personal Diary. הורידו את הגרסה החדשה בכתובת https://diary.example/about/he/downloads/');
      expect(android.body.message).not.toContain('Google Play');
      expect(android.headers['retry-after']).toBeUndefined();
      expect((await me('https://localhost', 'en')).body.message, `site ${n}`).toBe('This version of Your Personal Diary can no longer be used. Download the new version at https://diary.example/about/downloads/');
      for (const origin of ['http://tauri.localhost', 'https://tauri.localhost']) {
        expect((await me(origin, 'en')).body.message, `site ${n} ${origin}`).toBe('This version of Your Personal Diary can no longer be used. Download the new version at https://diary.example/about/downloads/');
      }
      expect((await me('tauri://localhost', 'de')).body.message, `site ${n}`).toBe(t('de', UPDATE_REQUIRED_SITE_KEY, { url: 'https://diary.example/about/de/downloads/' }));
      // The iPhone app comes only from the App Store: its message names the store, with or without a link.
      const iphone = await me('capacitor://localhost', 'en');
      expect(iphone.body, `site ${n}`).toEqual({ code: 'UPDATE_REQUIRED', message: t('en', UPDATE_REQUIRED_STORE_KEY, { store: 'App Store' }) });
      expect(iphone.body.message).toBe('This version of Your Personal Diary can no longer be used. Update the app in App Store.');
      // The sign-in route answers the same as the session check.
      const login = await b.common(b.agent.post('/api/auth/login'), true, nextIp()).set('Origin', 'https://localhost').set('Accept-Language', 'he').send({ username: `useranswer${n}`, password: PASSWORD });
      expect({ status: login.status, body: login.body }, `site ${n}`).toEqual({ status: 503, body: android.body });
      // The session itself is untouched: the same token, with the mark (the updated app), is in at once.
      const updated = await b.common(b.agent.get('/api/auth/me'), true, nextIp()).set('Origin', 'https://localhost').set(CLIENT_MARK_HEADER, CLIENT_MARK_VALUE).set('Authorization', `Bearer ${user.token}`);
      expect(updated.status).toBe(200);
      expect(updated.body.user.username).toBe(`useranswer${n}`);
    }
  });

  it('the preflight of the apps allows the mark; a refused request spends nothing of the sign-in limits', async () => {
    const b = await boot({ serverVersion: '1.1.0' });
    for (const origin of HOSTED_ORIGINS) {
      const res = await b.common(b.agent.options('/api/auth/me')).set('Origin', origin).set('Access-Control-Request-Headers', 'authorization, x-diary-client');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-headers']).toBe('Authorization, Content-Type, Accept-Language, X-Diary-Client');
    }
    const { o } = await b.owner('ownerlimits', { mail: false });
    await b.setRule(o, 'android', '1.1.0');
    // From ONE address: far more refused sign-ins than the per-address limit (10 a minute) - then a sign-in of the new version still works.
    for (let i = 0; i < 15; i += 1) {
      expect((await b.common(b.agent.post('/api/auth/login'), true, '192.0.2.44').set('Origin', 'https://localhost').send({ username: 'ownerlimits', password: PASSWORD })).status).toBe(503);
    }
    const fresh = await b.common(b.agent.post('/api/auth/login'), true, '192.0.2.44').set('Origin', 'https://localhost').set(CLIENT_MARK_HEADER, CLIENT_MARK_VALUE).send({ username: 'ownerlimits', password: PASSWORD });
    expect(fresh.status).toBe(200);
  });
});
