/**
 * The disk button of the Server card (docs/server-tasks/SERVER-CARD-V2.md Part B2): GET /api/server/disk,
 * POST /api/server/disk/extend and POST /api/server/disk/restart on a real hosted server (startHosted) whose
 * Fly Machines API is a FAKE - the injected transport of hosted/fly-volume.ts, keeping one volume, its
 * snapshots and the machine in memory - with a fake file system and a clock the test moves. Nothing here
 * talks to the internet: node:https is a spy that throws and must never be called.
 *
 *   - every state: snapshot -> extending -> waiting -> done; needs-restart (Fly asks for it, or the file
 *     system does not grow within 2 minutes) -> restarting -> done at the next start;
 *   - a failed snapshot, a late one, a refused snapshot, a refused extend, an extend without an answer
 *     (never asked twice), a refused restart, a change interrupted by a stop;
 *   - not set up (no token, a bad token, not on Fly) and a token Fly refuses - no call to Fly without a token;
 *   - the size: a whole number of GB, larger than now, at most DIARY_DISK_MAX_GB - checked before the password;
 *   - one change at a time (two requests at once too), at most 3 started in 24 hours (429 + Retry-After);
 *   - the password: required; wrong -> 400 WRONG_PASSWORD; the confirmation lockout of the archive and the Mail card;
 *   - owner only over HTTPS: another account, plain HTTP, no owner configured, no session;
 *   - the restart only in the state 'needs-restart';
 *   - the e-mails (done / restart / failed), and a change without e-mail set up;
 *   - disk-changes.json and the log lines carry no personal data and no token.
 * Fictional people, TEST-NET addresses and fictional ids only.
 */
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest';
import { t } from '@shared/i18n';
import type { AuthResponse, ServerDiskChange, ServerDiskInfo } from '@shared/types';
import { loadConfig, loadHostedEnv } from '../src/config';
import { startHosted, type RunningHosted } from '../src/hosted';
import { DISK_HISTORY_FILE, diskSetupCommand, type DiskTiming } from '../src/hosted/disk';
import { DISK_ERROR_KEYS, DISK_REASON_KEYS } from '../src/hosted/disk-errors';
import { FLY_TIMEOUTS, type FlyHttp, type FlyHttpRequest, type FlyHttpResponse, type FlyTimeouts } from '../src/hosted/fly-volume';
import { OWNER_UNSET_KEY } from '../src/hosted/owner';
import { cleanupTempDirs, tempDataDir } from './helpers';
import { decodeWords, headersOf, partsOf } from './mail-fixtures';

const HOST = 'diary.example';
const PASSWORD = 'Passw0rd!';
const FAST = { kdf: { N: 1024, r: 8, p: 1 } };
const GIB = 1024 ** 3;
const T0 = Date.parse('2026-11-18T10:00:00.000Z');
const APP = 'diary-test-app';
const MACHINE = '0123456789abcd';
const VOLUME = 'vol_fictional0123';
const TOKEN = 'FlyV1 fm2_fictionalDiskButtonToken0123456789ABCDEF==,fm2_fictionalDischarge0123456789';
const FLY_ENV = { DIARY_FLY_API_TOKEN: TOKEN, FLY_APP_NAME: APP, FLY_MACHINE_ID: MACHINE };
const CLIENT_IP = '203.0.113.7';
const OWNER = { firstName: 'Zivanit', lastName: 'Fictionova', username: 'diskowner7', email: 'zivanit.owner@example.com' };
const OTHER = { firstName: 'Yarden', lastName: 'Fictionov', username: 'diskother7', email: 'yarden.other@example.com' };

let requestSpy: MockInstance;
beforeAll(() => {
  requestSpy = vi.spyOn(https, 'request').mockImplementation(() => {
    throw new Error('a test tried to reach the internet');
  });
});
afterAll(() => {
  expect(requestSpy).not.toHaveBeenCalled();
  requestSpy.mockRestore();
});

const running: RunningHosted[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

// The fake Fly Machines API -------------------------------------------------------------------------

interface FakeFlyOptions {
  sizeGb?: number;
  /** What a new snapshot becomes after `snapshotLooks` looks at the list. */
  snapshot?: 'created' | 'failed' | 'never';
  snapshotLooks?: number;
  /** The answer to creating a snapshot. */
  createSnapshot?: 'ok' | 'unauthorized';
  extend?: 'ok' | 'needs-restart' | 'refused' | 'unauthorized' | 'hang';
  /** An extend Fly accepted grows the file system at once (an online resize) - unless false. */
  growOnExtend?: boolean;
  restart?: 'ok' | 'unauthorized';
  /** Every call answers 401 (a revoked token). */
  revoked?: boolean;
  /** The extend answers only once this promise has resolved (the test watches the state 'extending'). */
  extendGate?: Promise<void>;
}

interface FlyCall {
  method: string;
  path: string;
  body: unknown;
  authorization: string;
  timeoutMs: number;
}

interface FileSystemState {
  total: number;
  used: number;
}

function fakeFly(fsState: FileSystemState, o: FakeFlyOptions = {}) {
  const volume = { id: VOLUME, name: 'diary_data', state: 'created', size_gb: o.sizeGb ?? 50, region: 'fra', attached_machine_id: MACHINE };
  const other = { id: 'vol_otherdisk99', name: 'old_data', state: 'created', size_gb: 3, region: 'fra', attached_machine_id: null };
  const snapshots: Array<{ id: string; status: string; size: number; created_at: string }> = [{ id: 'vs_daily1', status: 'created', size: 1, created_at: '2026-11-17T03:00:00Z' }];
  const pending: Array<{ snap: { status: string }; looks: number }> = [];
  const calls: FlyCall[] = [];
  const answer = (status: number, value: unknown): Promise<FlyHttpResponse> => Promise.resolve({ status, body: value === '' ? '' : JSON.stringify(value) });
  const http: FlyHttp = (req: FlyHttpRequest) => {
    const url = new URL(req.url);
    const p = url.pathname;
    calls.push({ method: req.method, path: p, body: req.body === undefined ? null : JSON.parse(req.body), authorization: req.headers.Authorization, timeoutMs: req.timeoutMs });
    if (url.origin !== 'https://api.machines.dev') return answer(400, { error: 'not the Machines API' });
    if (o.revoked) return answer(401, { error: 'unauthorized' });
    const vol = `/v1/apps/${APP}/volumes/${VOLUME}`;
    if (req.method === 'GET' && p === `/v1/apps/${APP}/volumes`) return answer(200, [other, volume]);
    if (req.method === 'GET' && p === vol) return answer(200, volume);
    if (req.method === 'GET' && p === `${vol}/snapshots`) {
      for (const entry of pending) {
        entry.looks -= 1;
        if (entry.looks <= 0 && entry.snap.status === 'running' && o.snapshot !== 'never') entry.snap.status = o.snapshot === 'failed' ? 'failed' : 'created';
      }
      return answer(200, snapshots);
    }
    if (req.method === 'POST' && p === `${vol}/snapshots`) {
      if (o.createSnapshot === 'unauthorized') return answer(403, { error: 'unauthorized' });
      const snap = { id: `vs_new${snapshots.length}`, status: 'running', size: 0, created_at: '2026-11-18T10:00:01Z' };
      snapshots.push(snap);
      pending.push({ snap, looks: o.snapshotLooks ?? 2 });
      return answer(200, '');
    }
    if (req.method === 'PUT' && p === `${vol}/extend`) {
      const size = (JSON.parse(req.body ?? '{}') as { size_gb: number }).size_gb;
      if (o.extend === 'refused') return answer(422, { error: `size_gb must be greater than ${volume.size_gb}` });
      if (o.extend === 'unauthorized') return answer(403, { error: 'unauthorized for action' });
      if (o.extend === 'hang') return new Promise<FlyHttpResponse>(() => {});
      const extendNow = () => {
        const before = volume.size_gb;
        volume.size_gb = size;
        const restart = o.extend === 'needs-restart';
        if (!restart && o.growOnExtend !== false) fsState.total += (size - before) * GIB;
        return answer(200, { needs_restart: restart, volume });
      };
      return o.extendGate ? o.extendGate.then(extendNow) : extendNow();
    }
    if (req.method === 'POST' && p === `/v1/apps/${APP}/machines/${MACHINE}/restart`) {
      if (o.restart === 'unauthorized') return answer(401, { error: 'unauthorized' });
      return answer(200, { ok: true });
    }
    return answer(404, { error: 'not found' });
  };
  return { http, calls, volume, changes: () => calls.filter((c) => c.method !== 'GET') };
}

type FakeFly = ReturnType<typeof fakeFly>;

// The server ------------------------------------------------------------------------------------------

interface BootOptions {
  env?: Record<string, string>;
  fly?: FakeFlyOptions;
  /** The fake Fly of an earlier boot (a restart of the same server). */
  flyApi?: FakeFly;
  fs?: FileSystemState;
  dataDir?: string;
  timing?: Partial<DiskTiming>;
  flyTimeouts?: Partial<FlyTimeouts>;
  sleep?: (ms: number) => Promise<void>;
  /** false: the owner never filled in the Mail card. */
  mail?: boolean;
  /** The owner account of an earlier boot on the same data directory: sign in instead of registering. */
  ownerId?: string;
  /** The language the owner account is registered with (the e-mails follow it). */
  ownerLanguage?: string;
  /** Every e-mail is handed over only once this promise has resolved (a slow mail server). */
  mailGate?: Promise<void>;
}

async function boot(o: BootOptions = {}) {
  const dataDir = o.dataDir ?? tempDataDir();
  const fsState = o.fs ?? { total: 49 * GIB, used: 3 * GIB };
  const fly = o.flyApi ?? fakeFly(fsState, o.fly);
  const clock = { t: T0 };
  const sent: Array<{ to: string; data: string }> = [];
  const logs: string[] = [];
  let ownerId = o.ownerId ?? '';
  const env = loadHostedEnv({ DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: `https://${HOST}`, DIARY_BIND: '127.0.0.1', ...FLY_ENV, ...o.env });
  const config = loadConfig(['--data-dir', dataDir], { DIARY_MODE: 'hosted' });
  const srv = await startHosted(config, env, {
    port: 0,
    quiet: true,
    auth: FAST,
    ownerId: () => ownerId,
    log: (line) => logs.push(line),
    mailTransport: {
      send: async (_opts, envelope, data) => {
        await o.mailGate;
        sent.push({ to: envelope.to, data });
      },
    },
    disk: {
      http: fly.http,
      fileSystem: () => ({ totalBytes: fsState.total, usedBytes: fsState.used }),
      now: () => clock.t,
      sleep:
        o.sleep ??
        (async (ms: number) => {
          clock.t += ms;
          await new Promise((resolve) => setImmediate(resolve));
        }),
      timing: { restartDelayMs: 0, ...o.timing },
      ...(o.flyTimeouts ? { flyTimeouts: o.flyTimeouts } : {}),
    },
  });
  running.push(srv);
  const agent = supertest(srv.localUrl);
  const request = (method: 'get' | 'post', url: string, token?: string, secure = true) => {
    let r = agent[method](url).set('Host', HOST).set('Accept-Language', 'en').set('X-Forwarded-For', CLIENT_IP);
    if (secure) r = r.set('X-Forwarded-Proto', 'https');
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };
  const as = (token: string, secure = true) => ({
    get: (url: string) => request('get', url, token, secure),
    post: (url: string, body: object = {}) => request('post', url, token, secure).send(body),
  });
  const enter = async (who: typeof OWNER & { language?: string }, register: boolean): Promise<AuthResponse> => {
    const body = register
      ? { ...who, password: PASSWORD, confirmPassword: PASSWORD, privacyAccepted: true, termsAccepted: true }
      : { username: who.username, password: PASSWORD };
    const res = await request('post', register ? '/api/auth/register' : '/api/auth/login').send(body);
    expect(res.status).toBe(register ? 201 : 200);
    return res.body as AuthResponse;
  };
  const owner = await enter(o.ownerLanguage ? { ...OWNER, language: o.ownerLanguage } : OWNER, !o.ownerId);
  const other = await enter(OTHER, !o.ownerId);
  if (!o.ownerId) {
    ownerId = owner.user.id;
    if (o.mail !== false) srv.mail.update({ host: 'smtp.mail.test', port: 465, security: 'tls', username: 'diary@mail.test', smtpPassword: 'mock-app-secret-0042', enabled: true }, ownerId);
  }
  return {
    srv,
    fly,
    fsState,
    clock,
    sent,
    logs,
    dataDir,
    ownerId: () => ownerId,
    setOwner: (id: string) => {
      ownerId = id;
    },
    owner: as(owner.token),
    ownerPlainHttp: as(owner.token, false),
    other: as(other.token),
    anon: { get: (url: string) => request('get', url), post: (url: string, body: object = {}) => request('post', url).send(body) },
  };
}

type Booted = Awaited<ReturnType<typeof boot>>;

const info = async (b: Booted): Promise<ServerDiskInfo> => {
  const res = await b.owner.get('/api/server/disk');
  expect(res.status).toBe(200);
  return res.body as ServerDiskInfo;
};

/** The decoded e-mail number `i`. */
function mailOf(b: Booted, i = 0) {
  const m = b.sent[i];
  return { to: m.to, subject: decodeWords(headersOf(m.data).subject ?? ''), text: partsOf(m.data).text };
}

/** Nothing of a person, of the request or of the token. */
function expectNoPersonalData(text: string, ownerId: string): void {
  for (const value of [OWNER.email, OWNER.username, OWNER.firstName, OWNER.lastName, OTHER.email, OTHER.username, ownerId, TOKEN, 'fm2_', 'Bearer', CLIENT_IP, PASSWORD]) {
    expect({ value, found: text.includes(value) }).toEqual({ value, found: false });
  }
}

const diskLogs = (b: Booted): string[] => b.logs.filter((line) => line.startsWith('disk:'));

const readHistoryFile = (dataDir: string): { version: number; changes: Array<Record<string, unknown>> } =>
  JSON.parse(fs.readFileSync(path.join(dataDir, DISK_HISTORY_FILE), 'utf8')) as { version: number; changes: Array<Record<string, unknown>> };

// The tests ---------------------------------------------------------------------------------------------

describe('GET /api/server/disk', () => {
  it('the owner sees the size at Fly, the use of the file system, the limits, the setup line and an empty history', async () => {
    const b = await boot();
    const disk = await info(b);
    expect(disk).toEqual({
      available: true,
      sizeGb: 50,
      usedBytes: 3 * GIB,
      totalBytes: 49 * GIB,
      maxGb: 100,
      pricePerGbMonth: 0.15,
      changesPerDay: 3,
      changesLeftToday: 3,
      nextChangeAt: null,
      job: null,
      history: [],
      setupCommand: diskSetupCommand(APP),
    });
    expect(disk.setupCommand).toBe('powershell -NoProfile -ExecutionPolicy Bypass -File "C:\\Users\\AVI\\Projects\\my-personal-diary\\scripts\\hosted\\set-disk-key.ps1" -App diary-test-app');
    expect(diskSetupCommand('yourpersonaldiary')).not.toContain('-App');
    // The volume attached to this machine, from the app's list - read once and kept for a minute.
    await info(b);
    expect(b.fly.calls.map((c) => [c.method, c.path, c.authorization, c.timeoutMs])).toEqual([['GET', `/v1/apps/${APP}/volumes`, TOKEN, FLY_TIMEOUTS.read]]);
    b.clock.t += 61_000;
    await info(b);
    expect(b.fly.calls).toHaveLength(2);
  });

  it('not set up - no token, a token that cannot be one, not on Fly: the card says why, nothing is changed, Fly is never called', async () => {
    const cases: Array<[Record<string, string>, 'no-token' | 'bad-token' | 'not-fly']> = [
      [{ DIARY_FLY_API_TOKEN: '' }, 'no-token'],
      [{ DIARY_FLY_API_TOKEN: 'FlyV1 a token with spaces inside it' }, 'bad-token'],
      [{ FLY_APP_NAME: '' }, 'not-fly'],
      [{ FLY_MACHINE_ID: '' }, 'not-fly'],
    ];
    for (const [env, reason] of cases) {
      const b = await boot({ env });
      const disk = await info(b);
      expect({ reason, available: disk.available, got: disk.reason, sizeGb: disk.sizeGb }).toEqual({ reason, available: false, got: reason, sizeGb: null });
      expect(disk.setupCommand).toContain('set-disk-key.ps1');
      expect(disk.totalBytes).toBe(49 * GIB);
      const extend = await b.owner.post('/api/server/disk/extend', { sizeGb: 60, password: PASSWORD });
      expect({ status: extend.status, message: extend.body.message }).toEqual({ status: 409, message: t('en', DISK_REASON_KEYS[reason]) });
      const restart = await b.owner.post('/api/server/disk/restart', { password: PASSWORD });
      expect(restart.status).toBe(409);
      expect(b.fly.calls).toEqual([]);
      if (reason === 'bad-token') expect(diskLogs(b).some((line) => line.includes('DIARY_FLY_API_TOKEN is not a usable token'))).toBe(true);
      expect(b.logs.join('\n')).not.toContain('a token with spaces');
      await b.srv.stop();
    }
  });

  it('a token Fly refuses: the card says so, and a change is refused before the password is looked at', async () => {
    const b = await boot({ fly: { revoked: true } });
    const disk = await info(b);
    expect({ available: disk.available, reason: disk.reason, sizeGb: disk.sizeGb }).toEqual({ available: false, reason: 'unauthorized', sizeGb: null });
    const extend = await b.owner.post('/api/server/disk/extend', { sizeGb: 60, password: 'not-the-password' });
    expect({ status: extend.status, message: extend.body.message }).toEqual({ status: 502, message: t('en', DISK_REASON_KEYS.unauthorized) });
    expect(b.fly.changes()).toEqual([]);
  });

  it('owner only, over HTTPS: another account, plain HTTP, no session, no owner configured', async () => {
    const b = await boot();
    for (const res of [
      await b.other.get('/api/server/disk'),
      await b.other.post('/api/server/disk/extend', { sizeGb: 60, password: PASSWORD }),
      await b.other.post('/api/server/disk/restart', { password: PASSWORD }),
      await b.ownerPlainHttp.get('/api/server/disk'),
      await b.ownerPlainHttp.post('/api/server/disk/extend', { sizeGb: 60, password: PASSWORD }),
    ]) {
      expect({ status: res.status, message: res.body.message }).toEqual({ status: 403, message: t('en', 'server.error.forbidden') });
    }
    expect((await b.anon.get('/api/server/disk')).status).toBe(401);
    expect((await b.anon.post('/api/server/disk/extend', { sizeGb: 60, password: PASSWORD })).status).toBe(401);
    b.setOwner('');
    const unset = await b.owner.get('/api/server/disk');
    expect({ status: unset.status, message: unset.body.message }).toEqual({ status: 403, message: t('en', OWNER_UNSET_KEY) });
    expect(b.fly.calls).toEqual([]);
  });
});

describe('POST /api/server/disk/extend', () => {
  it('a change: a snapshot first, then the extend, then the file system - done; the e-mail, the history, the log', async () => {
    const b = await boot();
    const res = await b.owner.post('/api/server/disk/extend', { sizeGb: 60, password: PASSWORD });
    expect(res.status).toBe(202);
    const job = res.body as ServerDiskChange;
    expect(job).toMatchObject({ state: 'snapshot', fromGb: 50, toGb: 60, finishedAt: null, errorKey: null, email: null });
    expect(job.id).toMatch(/^d_[0-9a-f]{12}$/);
    await b.srv.disk.idle();

    const disk = await info(b);
    expect(disk.job).toMatchObject({ id: job.id, state: 'done', fromGb: 50, toGb: 60, errorKey: null, email: 'sent' });
    expect(disk.job?.finishedAt).toBeTruthy();
    expect(disk.history).toEqual([disk.job]);
    expect({ sizeGb: disk.sizeGb, totalBytes: disk.totalBytes, changesLeftToday: disk.changesLeftToday }).toEqual({ sizeGb: 60, totalBytes: 59 * GIB, changesLeftToday: 2 });

    // The order at Fly: the snapshot exists before the extend; each change asked once, every call with the token and its timeout.
    const flow = b.fly.calls.map((c) => `${c.method} ${c.path.replace(`/v1/apps/${APP}`, '')}`);
    expect(flow.slice(0, 3)).toEqual(['GET /volumes', `GET /volumes/${VOLUME}/snapshots`, `POST /volumes/${VOLUME}/snapshots`]);
    // The snapshot was looked at again (and found 'created') after it was asked for, and only then the extend.
    expect(flow.lastIndexOf(`GET /volumes/${VOLUME}/snapshots`)).toBeGreaterThan(flow.indexOf(`POST /volumes/${VOLUME}/snapshots`));
    expect(flow.indexOf(`PUT /volumes/${VOLUME}/extend`)).toBeGreaterThan(flow.lastIndexOf(`GET /volumes/${VOLUME}/snapshots`));
    expect(b.fly.changes().map((c) => [c.method, c.path, c.body])).toEqual([
      ['POST', `/v1/apps/${APP}/volumes/${VOLUME}/snapshots`, null],
      ['PUT', `/v1/apps/${APP}/volumes/${VOLUME}/extend`, { size_gb: 60 }],
    ]);
    for (const c of b.fly.calls) {
      expect(c.authorization).toBe(TOKEN);
      expect(c.timeoutMs).toBe(c.method === 'GET' ? FLY_TIMEOUTS.read : c.method === 'PUT' ? FLY_TIMEOUTS.extend : FLY_TIMEOUTS.snapshot);
    }

    // One e-mail to the owner's own address: from, to, the new monthly cost, when.
    expect(b.sent).toHaveLength(1);
    const mail = mailOf(b);
    expect(mail.to).toBe(OWNER.email);
    expect(mail.subject).toBe(t('en', 'server.email.disk.done.subject'));
    expect(mail.text).toContain(`Hello ${OWNER.firstName},`);
    expect(mail.text).toContain('from 50 GB to 60 GB');
    expect(mail.text).toContain(t('en', 'server.email.disk.cost', { sizeGb: 60, cost: '9.00' }));
    expect(mail.text).toContain(t('en', 'server.email.disk.notYou'));

    // The history file: sizes, times, states - nothing of a person, nothing of the token.
    const file = readHistoryFile(b.dataDir);
    expect(file.version).toBe(1);
    expect(file.changes).toHaveLength(1);
    expect(Object.keys(file.changes[0]).sort()).toEqual(['email', 'errorKey', 'finishedAt', 'fromGb', 'fsBytesBefore', 'id', 'locale', 'startedAt', 'state', 'toGb', 'updatedAt']);
    expect(file.changes[0]).toMatchObject({ id: job.id, state: 'done', fromGb: 50, toGb: 60, fsBytesBefore: 49 * GIB, locale: 'en', email: 'sent' });
    expectNoPersonalData(JSON.stringify(file), b.ownerId());

    // The log: the steps with sizes only.
    const lines = diskLogs(b);
    expect(lines).toEqual(
      expect.arrayContaining([
        'disk: change from 50 GB to 60 GB started - a snapshot first.',
        'disk: snapshot requested.',
        'disk: snapshot created.',
        'disk: Fly enlarged the volume to 60 GB.',
        'disk: the change from 50 GB to 60 GB is done.',
        'disk: e-mail to the owner sent.',
      ]),
    );
    expectNoPersonalData(lines.join('\n'), b.ownerId());

    // Done: there is nothing to restart.
    const restart = await b.owner.post('/api/server/disk/restart', { password: PASSWORD });
    expect({ status: restart.status, message: restart.body.message }).toEqual({ status: 409, message: t('en', 'server.disk.noRestartNeeded') });
  });

  it('Fly asks for a restart: needs-restart and its e-mail; no new change; the restart with the password; done at the next start', async () => {
    const fsState = { total: 49 * GIB, used: 3 * GIB };
    const b = await boot({ fs: fsState, fly: { extend: 'needs-restart' } });
    // No restart before a change waits for one.
    const early = await b.owner.post('/api/server/disk/restart', { password: PASSWORD });
    expect({ status: early.status, message: early.body.message }).toEqual({ status: 409, message: t('en', 'server.disk.noRestartNeeded') });

    expect((await b.owner.post('/api/server/disk/extend', { sizeGb: 70, password: PASSWORD })).status).toBe(202);
    await b.srv.disk.idle();
    let disk = await info(b);
    expect(disk.job).toMatchObject({ state: 'needs-restart', fromGb: 50, toGb: 70, finishedAt: null, errorKey: null, email: 'sent' });
    expect(mailOf(b).subject).toBe(t('en', 'server.email.disk.restart.subject'));
    expect(mailOf(b).text).toContain(t('en', 'server.email.disk.cost', { sizeGb: 70, cost: '10.50' }));

    // No other change until the restart - refused before the password.
    const again = await b.owner.post('/api/server/disk/extend', { sizeGb: 80, password: 'not-the-password' });
    expect({ status: again.status, message: again.body.message }).toEqual({ status: 409, message: t('en', 'server.disk.restartFirst') });
    // The restart: the owner only, with the password.
    expect((await b.other.post('/api/server/disk/restart', { password: PASSWORD })).status).toBe(403);
    const missing = await b.owner.post('/api/server/disk/restart', {});
    expect({ status: missing.status, field: missing.body.field, message: missing.body.message }).toEqual({ status: 400, field: 'password', message: t('en', 'server.disk.passwordRequired') });
    const wrong = await b.owner.post('/api/server/disk/restart', { password: 'not-the-password' });
    expect({ status: wrong.status, code: wrong.body.code, field: wrong.body.field }).toEqual({ status: 400, code: 'WRONG_PASSWORD', field: 'password' });
    expect(b.fly.changes().filter((c) => c.path.endsWith('/restart'))).toEqual([]);

    const restart = await b.owner.post('/api/server/disk/restart', { password: PASSWORD });
    expect(restart.status).toBe(202);
    expect((restart.body as ServerDiskChange).state).toBe('restarting');
    await b.srv.disk.idle();
    expect(b.fly.changes().filter((c) => c.path.endsWith('/restart')).map((c) => [c.method, c.path, c.timeoutMs])).toEqual([
      ['POST', `/v1/apps/${APP}/machines/${MACHINE}/restart`, FLY_TIMEOUTS.restart],
    ]);
    disk = await info(b);
    expect(disk.job?.state).toBe('restarting');
    const twice = await b.owner.post('/api/server/disk/restart', { password: PASSWORD });
    expect(twice.status).toBe(409);

    // Fly stops this server and starts it again; the file system now shows the new size. The mail server is slow:
    // while the e-mail about the end is on its way, the change shows no outcome - never that of the restart e-mail.
    await b.srv.stop();
    fsState.total += 20 * GIB;
    let releaseMail: () => void = () => {};
    const mailGate = new Promise<void>((resolve) => {
      releaseMail = resolve;
    });
    const next = await boot({ dataDir: b.dataDir, fs: fsState, flyApi: b.fly, ownerId: b.ownerId(), mailGate });
    disk = await info(next);
    expect(disk.job).toMatchObject({ state: 'done', fromGb: 50, toGb: 70, errorKey: null, email: null });
    releaseMail();
    await next.srv.disk.idle();
    disk = await info(next);
    expect(disk.job).toMatchObject({ state: 'done', fromGb: 50, toGb: 70, errorKey: null, email: 'sent' });
    expect(disk.history[0].state).toBe('done');
    expect(next.sent).toHaveLength(1);
    expect(mailOf(next).subject).toBe(t('en', 'server.email.disk.done.subject'));
    expect(diskLogs(next)).toContain('disk: the server uses the new size of 70 GB.');
    expectNoPersonalData(fs.readFileSync(path.join(b.dataDir, DISK_HISTORY_FILE), 'utf8'), b.ownerId());
  });

  it('the card sees every step as it happens: snapshot, extending, waiting - then needs-restart', async () => {
    let releaseExtend: () => void = () => {};
    const extendGate = new Promise<void>((resolve) => {
      releaseExtend = resolve;
    });
    let releaseFs: () => void = () => {};
    let fsHold: Promise<void> | null = new Promise<void>((resolve) => {
      releaseFs = resolve;
    });
    let clock: { t: number } | null = null;
    let snapshotHold: Promise<void> | null = null;
    let releaseSnapshot: () => void = () => {};
    snapshotHold = new Promise<void>((resolve) => {
      releaseSnapshot = resolve;
    });
    const b = await boot({
      fly: { extendGate, growOnExtend: false },
      // The first look at the snapshots and the first look at the file system wait for the test.
      sleep: async (ms: number) => {
        const hold = ms === 10_000 ? snapshotHold : ms === 5_000 ? fsHold : null;
        if (ms === 10_000) snapshotHold = null;
        if (ms === 5_000) fsHold = null;
        if (hold) await hold;
        if (clock) clock.t += ms;
        await new Promise((resolve) => setImmediate(resolve));
      },
    });
    clock = b.clock;
    const stateNow = async () => (await info(b)).job?.state;
    const until = async (state: string) => {
      const deadline = Date.now() + 10_000;
      while ((await stateNow()) !== state) {
        if (Date.now() > deadline) throw new Error(`the change never reached '${state}'`);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    };
    expect((await b.owner.post('/api/server/disk/extend', { sizeGb: 64, password: PASSWORD })).status).toBe(202);
    expect(await stateNow()).toBe('snapshot');
    releaseSnapshot();
    await until('extending');
    releaseExtend();
    await until('waiting');
    releaseFs();
    await b.srv.disk.idle();
    expect((await info(b)).job).toMatchObject({ state: 'needs-restart', fromGb: 50, toGb: 64 });
  });

  it('the file system does not show the new size within 2 minutes: needs-restart', async () => {
    const b = await boot({ fly: { growOnExtend: false } });
    expect((await b.owner.post('/api/server/disk/extend', { sizeGb: 55, password: PASSWORD })).status).toBe(202);
    await b.srv.disk.idle();
    expect((await info(b)).job).toMatchObject({ state: 'needs-restart', toGb: 55, email: 'sent' });
    expect(b.clock.t - T0).toBeGreaterThanOrEqual(2 * 60_000);
    expect(mailOf(b).subject).toBe(t('en', 'server.email.disk.restart.subject'));
  });

  it('a restart Fly refuses: back to needs-restart, with the reason', async () => {
    const b = await boot({ fly: { extend: 'needs-restart', restart: 'unauthorized' } });
    expect((await b.owner.post('/api/server/disk/extend', { sizeGb: 51, password: PASSWORD })).status).toBe(202);
    await b.srv.disk.idle();
    expect((await b.owner.post('/api/server/disk/restart', { password: PASSWORD })).status).toBe(202);
    await b.srv.disk.idle();
    expect((await info(b)).job).toMatchObject({ state: 'needs-restart', errorKey: DISK_ERROR_KEYS.restartRefused });
    expect(diskLogs(b)).toContain('disk: the restart did not happen (restart: unauthorized, HTTP 401).');
  });

  it('a snapshot that fails, is refused or is not ready in an hour ends the change before anything is changed', async () => {
    const cases: Array<[FakeFlyOptions, string]> = [
      [{ snapshot: 'failed' }, DISK_ERROR_KEYS.snapshotFailed],
      [{ snapshot: 'never' }, DISK_ERROR_KEYS.snapshotTimeout],
      [{ createSnapshot: 'unauthorized' }, DISK_ERROR_KEYS.unauthorized],
    ];
    for (const [fly, errorKey] of cases) {
      const b = await boot({ fly });
      expect((await b.owner.post('/api/server/disk/extend', { sizeGb: 60, password: PASSWORD })).status).toBe(202);
      await b.srv.disk.idle();
      const disk = await info(b);
      expect({ errorKey, job: disk.job }).toMatchObject({ errorKey, job: { state: 'failed', errorKey, email: 'sent' } });
      expect({ errorKey, extends: b.fly.changes().filter((c) => c.method === 'PUT').length, size: b.fly.volume.size_gb }).toEqual({ errorKey, extends: 0, size: 50 });
      // Fly took about 14 minutes for the 50 GB production disk: the wait is an hour, and not less.
      if (errorKey === DISK_ERROR_KEYS.snapshotTimeout) expect(b.clock.t - T0).toBeGreaterThanOrEqual(60 * 60_000);
      const mail = mailOf(b);
      expect(mail.subject).toBe(t('en', 'server.email.disk.failed.subject'));
      expect(mail.text).toContain(t('en', errorKey));
      // Nothing changed: the cost line says the size the disk still has.
      expect(mail.text).toContain(t('en', 'server.email.disk.cost', { sizeGb: 50, cost: '7.50' }));
      await b.srv.stop();
    }
  });

  it('a refused extend changes nothing; an extend without an answer is never asked again', async () => {
    const refused = await boot({ fly: { extend: 'refused' } });
    expect((await refused.owner.post('/api/server/disk/extend', { sizeGb: 60, password: PASSWORD })).status).toBe(202);
    await refused.srv.disk.idle();
    expect((await info(refused)).job).toMatchObject({ state: 'failed', errorKey: DISK_ERROR_KEYS.extendRefused, email: 'sent' });
    expect(refused.fly.changes().filter((c) => c.method === 'PUT')).toHaveLength(1);
    expect(refused.fly.volume.size_gb).toBe(50);
    await refused.srv.stop();

    const lost = await boot({ fly: { extend: 'hang' }, flyTimeouts: { extend: 40 } });
    expect((await lost.owner.post('/api/server/disk/extend', { sizeGb: 60, password: PASSWORD })).status).toBe(202);
    await lost.srv.disk.idle();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect((await info(lost)).job).toMatchObject({ state: 'failed', errorKey: DISK_ERROR_KEYS.extendUnknown });
    expect(lost.fly.changes().filter((c) => c.method === 'PUT').map((c) => c.timeoutMs)).toEqual([40]);
    // The size is unknown: the e-mail says so and names no cost.
    const mail = mailOf(lost);
    expect(mail.text).toContain(t('en', DISK_ERROR_KEYS.extendUnknown));
    expect(mail.text).not.toContain('US dollars');
  });

  it('the size: a whole number of GB, larger than now, at most the maximum - checked before the password, no attempt counted', async () => {
    const b = await boot({ env: { DIARY_DISK_MAX_GB: '80' } });
    expect((await info(b)).maxGb).toBe(80);
    const cases: Array<[unknown, string, Record<string, number>]> = [
      [50, 'server.disk.sizeNotLarger', { current: 50 }],
      [49, 'server.disk.sizeNotLarger', { current: 50 }],
      [0, 'server.disk.sizeNotLarger', { current: 50 }],
      [-5, 'server.disk.sizeNotLarger', { current: 50 }],
      [60.5, 'server.disk.sizeWhole', {}],
      ['60', 'server.disk.sizeWhole', {}],
      [null, 'server.disk.sizeWhole', {}],
      [undefined, 'server.disk.sizeWhole', {}],
      [81, 'server.disk.sizeTooLarge', { max: 80 }],
      [1e9, 'server.disk.sizeTooLarge', { max: 80 }],
    ];
    // Twelve refusals with a wrong password: none of them is a password attempt (10 would lock the account).
    for (const [sizeGb, key, params] of [...cases, cases[0], cases[4]]) {
      const res = await b.owner.post('/api/server/disk/extend', { sizeGb, password: 'not-the-password' });
      expect({ sizeGb, status: res.status, code: res.body.code, field: res.body.field, message: res.body.message }).toEqual({
        sizeGb,
        status: 400,
        code: 'VALIDATION',
        field: 'sizeGb',
        message: t('en', key, params),
      });
    }
    expect(b.fly.changes()).toEqual([]);
    expect((await b.owner.post('/api/server/disk/extend', { sizeGb: 80, password: PASSWORD })).status).toBe(202);
    await b.srv.disk.idle();
    expect((await info(b)).job).toMatchObject({ state: 'done', toGb: 80 });
  });

  it('one change at a time - also when two requests arrive together', async () => {
    let open: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const b = await boot({ sleep: () => gate });
    const [first, second] = await Promise.all([
      b.owner.post('/api/server/disk/extend', { sizeGb: 60, password: PASSWORD }),
      b.owner.post('/api/server/disk/extend', { sizeGb: 61, password: PASSWORD }),
    ]);
    expect([first.status, second.status].sort()).toEqual([202, 409]);
    const refusedOne = first.status === 409 ? first : second;
    expect(refusedOne.body.message).toBe(t('en', 'server.disk.busy'));
    const later = await b.owner.post('/api/server/disk/extend', { sizeGb: 62, password: PASSWORD });
    expect({ status: later.status, message: later.body.message }).toEqual({ status: 409, message: t('en', 'server.disk.busy') });
    expect((await info(b)).job?.state).toBe('snapshot');
    expect(b.fly.changes().filter((c) => c.method === 'POST')).toHaveLength(1);
    open();
    await b.srv.disk.idle();
    expect((await info(b)).job?.state).toBe('done');
    expect(b.fly.changes().filter((c) => c.method === 'PUT')).toHaveLength(1);
  });

  it('at most 3 changes in 24 hours, failed ones too: 429 with Retry-After - and again a day later', async () => {
    const b = await boot({ fly: { extend: 'refused' } });
    for (let i = 0; i < 3; i += 1) {
      expect((await b.owner.post('/api/server/disk/extend', { sizeGb: 60, password: PASSWORD })).status).toBe(202);
      await b.srv.disk.idle();
    }
    const disk = await info(b);
    expect({ left: disk.changesLeftToday, history: disk.history.map((c) => c.state) }).toEqual({ left: 0, history: ['failed', 'failed', 'failed'] });
    expect(Date.parse(disk.nextChangeAt ?? '')).toBe(Date.parse(disk.history[2].startedAt) + 24 * 3600_000);
    const fourth = await b.owner.post('/api/server/disk/extend', { sizeGb: 60, password: 'not-the-password' });
    expect(fourth.status).toBe(429);
    const retryAfter = Number(fourth.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(23 * 3600);
    expect(retryAfter).toBeLessThanOrEqual(24 * 3600);
    expect(fourth.body.message).toBe(t('en', 'server.disk.dailyLimit', { max: 3, hours: Math.ceil(retryAfter / 3600) }));
    expect(b.fly.changes().filter((c) => c.method === 'POST')).toHaveLength(3);
    // A day after the first one, one more may start.
    b.clock.t = Date.parse(disk.history[2].startedAt) + 24 * 3600_000 + 1000;
    expect((await info(b)).changesLeftToday).toBe(1);
    expect((await b.owner.post('/api/server/disk/extend', { sizeGb: 60, password: PASSWORD })).status).toBe(202);
    await b.srv.disk.idle();
  });

  it('the password: required, a wrong one is 400 WRONG_PASSWORD - and it is the confirmation lockout of the archive and the Mail card', async () => {
    const b = await boot();
    const missing = await b.owner.post('/api/server/disk/extend', { sizeGb: 60 });
    expect({ status: missing.status, field: missing.body.field, message: missing.body.message }).toEqual({ status: 400, field: 'password', message: t('en', 'server.disk.passwordRequired') });
    const notObject = await b.owner.post('/api/server/disk/extend', [60, PASSWORD]);
    expect({ status: notObject.status, message: notObject.body.message }).toEqual({ status: 400, message: t('en', 'server.disk.badBody') });
    for (let i = 0; i < 9; i += 1) {
      const wrong = await b.owner.post('/api/server/disk/extend', { sizeGb: 60, password: `wrong-${i}` });
      expect({ status: wrong.status, code: wrong.body.code, field: wrong.body.field, message: wrong.body.message }).toEqual({
        status: 400,
        code: 'WRONG_PASSWORD',
        field: 'password',
        message: t('en', 'server.disk.wrongPassword'),
      });
    }
    // The tenth wrong confirmation - here through the archive - locks every confirmation of the account.
    const archive = await b.owner.post('/api/server/archive', { password: 'wrong-again', passphrase: 'a fictional archive passphrase' });
    expect(archive.status).toBe(429);
    const locked = await b.owner.post('/api/server/disk/extend', { sizeGb: 60, password: PASSWORD });
    expect({ status: locked.status, message: locked.body.message }).toEqual({ status: 429, message: t('en', 'server.remote.loginLocked', { minutes: 15 }) });
    expect(b.fly.changes()).toEqual([]);
    expect((await info(b)).history).toEqual([]);
  });

  it("the e-mail is written in the owner account's language, not in the language of the request", async () => {
    const b = await boot({ ownerLanguage: 'he' });
    expect((await b.owner.post('/api/server/disk/extend', { sizeGb: 60, password: PASSWORD })).status).toBe(202);
    await b.srv.disk.idle();
    expect(b.sent).toHaveLength(1);
    const { html } = partsOf(b.sent[0].data);
    expect(html).toContain('<html lang="he" dir="rtl">');
    expect(mailOf(b).subject).toBe(t('he', 'server.email.disk.done.subject'));
  });

  it('without e-mail set up the change still happens, and says that no e-mail was sent', async () => {
    const b = await boot({ mail: false });
    expect((await b.owner.post('/api/server/disk/extend', { sizeGb: 60, password: PASSWORD })).status).toBe(202);
    await b.srv.disk.idle();
    expect((await info(b)).job).toMatchObject({ state: 'done', email: 'not-configured' });
    expect(b.sent).toEqual([]);
    expect(diskLogs(b)).toContain('disk: no e-mail to the owner (e-mail sending is not set up).');
  });
});

describe('a change found at start (disk-changes.json)', () => {
  it('interrupted in a step: failed; interrupted while waiting for the file system: needs-restart; restarted without growing: needs-restart again', async () => {
    const first = await boot();
    const ownerId = first.ownerId();
    const dataDir = first.dataDir;
    await first.srv.stop();
    const entry = (state: string) => ({
      id: 'd_0123456789ab',
      state,
      fromGb: 50,
      toGb: 60,
      startedAt: '2026-11-18T09:00:00.000Z',
      updatedAt: '2026-11-18T09:01:00.000Z',
      finishedAt: null,
      errorKey: null,
      email: null,
      fsBytesBefore: 49 * GIB,
      locale: 'en',
    });
    const cases: Array<[string, Partial<ServerDiskChange>, string | null]> = [
      ['extending', { state: 'failed', errorKey: DISK_ERROR_KEYS.interrupted, email: 'sent' }, 'server.email.disk.failed.subject'],
      ['waiting', { state: 'needs-restart', errorKey: null, email: 'sent' }, 'server.email.disk.restart.subject'],
      ['restarting', { state: 'needs-restart', errorKey: DISK_ERROR_KEYS.notGrown }, null],
    ];
    for (const [state, expected, subject] of cases) {
      fs.writeFileSync(path.join(dataDir, DISK_HISTORY_FILE), JSON.stringify({ version: 1, changes: [entry(state)] }));
      const b = await boot({ dataDir, ownerId });
      await b.srv.disk.idle();
      const disk = await info(b);
      expect({ state, job: disk.job }).toMatchObject({ state, job: { id: 'd_0123456789ab', ...expected } });
      expect({ state, subjects: b.sent.map((_m, i) => mailOf(b, i).subject) }).toEqual({ state, subjects: subject ? [t('en', subject)] : [] });
      // A change waiting for a restart blocks a new one; a failed one does not.
      const next = await b.owner.post('/api/server/disk/extend', { sizeGb: 70, password: 'not-the-password' });
      expect({ state, status: next.status }).toEqual({ state, status: expected.state === 'failed' ? 400 : 409 });
      await b.srv.stop();
    }
  });
});
