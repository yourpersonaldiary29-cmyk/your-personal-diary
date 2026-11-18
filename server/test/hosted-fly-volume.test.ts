/**
 * The Fly Machines API client of the disk button (server/src/hosted/fly-volume.ts; docs/server-tasks/
 * SERVER-CARD-V2.md B2) against a fake transport. Nothing here talks to the internet: node:https is a spy
 * that throws and must never be called.
 *   - only these calls, each GET / POST / PUT under https://api.machines.dev/v1/apps/<app>/, never a DELETE;
 *   - the Authorization header: a "FlyV1 " token as it is, any other one with "Bearer ";
 *   - a timeout on every call - the client's own when the transport hangs;
 *   - a call that changes something is sent once, whatever happens to it;
 *   - the HTTP status becomes a kind; no error carries the token;
 *   - the server's transport refuses another host, scheme, path or method before anything leaves.
 * Fictional ids and tokens only.
 */
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  createFlyVolumeApi,
  FLY_API_BASE,
  FLY_TIMEOUTS,
  flyAuthorization,
  FlyApiError,
  nodeFlyHttp,
  type FlyHttp,
  type FlyHttpRequest,
  type FlyHttpResponse,
  type FlyVolumeApiOptions,
} from '../src/hosted/fly-volume';

const TOKEN = 'FlyV1 fm2_fictionalTokenForTests0123456789==,fm2_fictionalDischarge9876543210';
const APP = 'diary-test-app';
const MACHINE = '0123456789abcd';
const VOLUME = 'vol_fictional0123';
const BASE = `${FLY_API_BASE}/apps/${APP}`;

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

/** A transport that records every request and answers with `answer`. */
function fake(answer: (req: FlyHttpRequest) => FlyHttpResponse | Promise<FlyHttpResponse>) {
  const calls: FlyHttpRequest[] = [];
  const http: FlyHttp = async (req) => {
    calls.push(req);
    return answer(req);
  };
  return { http, calls };
}

const options = (http: FlyHttp, extra: Partial<FlyVolumeApiOptions> = {}): FlyVolumeApiOptions => ({ token: TOKEN, app: APP, machineId: MACHINE, http, ...extra });
const FAST = { read: 20, snapshot: 20, extend: 20, restart: 20 };
const volumeJson = (size: number, attached: string | null = MACHINE) => ({ id: VOLUME, name: 'diary_data', state: 'created', size_gb: size, region: 'fra', attached_machine_id: attached });

describe('the calls', () => {
  it('only these six, with their method, URL, body, Authorization and timeout', async () => {
    const { http, calls } = fake((req) => {
      const p = new URL(req.url).pathname;
      if (req.method === 'GET' && p.endsWith('/volumes')) return { status: 200, body: JSON.stringify([volumeJson(50), { id: 'vol_other', size_gb: 3, attached_machine_id: null }]) };
      if (req.method === 'GET' && p.endsWith('/snapshots')) return { status: 200, body: JSON.stringify([{ id: 'vs_1', status: 'Created', size: 9, created_at: '2026-11-18T09:00:00Z' }]) };
      if (req.method === 'GET') return { status: 200, body: JSON.stringify(volumeJson(50, null)) };
      if (req.method === 'PUT') return { status: 200, body: JSON.stringify({ needs_restart: true, volume: volumeJson(60) }) };
      return { status: 200, body: '' };
    });
    const api = createFlyVolumeApi(options(http));
    expect(await api.listVolumes()).toEqual([
      { id: VOLUME, sizeGb: 50, state: 'created', attachedMachineId: MACHINE },
      { id: 'vol_other', sizeGb: 3, state: '', attachedMachineId: null },
    ]);
    expect(await api.getVolume(VOLUME)).toEqual({ id: VOLUME, sizeGb: 50, state: 'created', attachedMachineId: null });
    expect(await api.listSnapshots(VOLUME)).toEqual([{ id: 'vs_1', status: 'created', createdAt: '2026-11-18T09:00:00Z' }]);
    await api.createSnapshot(VOLUME);
    expect(await api.extendVolume(VOLUME, 60)).toEqual({ needsRestart: true, sizeGb: 60 });
    await api.restartMachine();
    expect(calls.map((c) => [c.method, c.url, c.body ?? null, c.timeoutMs])).toEqual([
      ['GET', `${BASE}/volumes`, null, FLY_TIMEOUTS.read],
      ['GET', `${BASE}/volumes/${VOLUME}`, null, FLY_TIMEOUTS.read],
      ['GET', `${BASE}/volumes/${VOLUME}/snapshots`, null, FLY_TIMEOUTS.read],
      ['POST', `${BASE}/volumes/${VOLUME}/snapshots`, null, FLY_TIMEOUTS.snapshot],
      ['PUT', `${BASE}/volumes/${VOLUME}/extend`, '{"size_gb":60}', FLY_TIMEOUTS.extend],
      ['POST', `${BASE}/machines/${MACHINE}/restart`, null, FLY_TIMEOUTS.restart],
    ]);
    for (const c of calls) {
      expect(c.headers).toEqual({ Authorization: TOKEN });
      expect(c.url.startsWith('https://api.machines.dev/v1/apps/')).toBe(true);
    }
    // The client offers nothing else - and nothing in its code sends a DELETE.
    expect(Object.keys(api).sort()).toEqual(['createSnapshot', 'extendVolume', 'getVolume', 'listSnapshots', 'listVolumes', 'restartMachine']);
    const code = fs
      .readFileSync(path.resolve(__dirname, '..', 'src', 'hosted', 'fly-volume.ts'), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join('\n');
    expect(code).not.toMatch(/DELETE|PATCH/);
  });

  it('a "FlyV1 " token is sent as it is, any other token as "Bearer <token>"', async () => {
    expect(flyAuthorization('FlyV1 fm2_abc,fm2_def')).toBe('FlyV1 fm2_abc,fm2_def');
    expect(flyAuthorization('  FlyV1 fm2_abc \n')).toBe('FlyV1 fm2_abc');
    expect(flyAuthorization('fo1_plainToken')).toBe('Bearer fo1_plainToken');
    expect(flyAuthorization('flyv1 notTheScheme')).toBe('Bearer flyv1 notTheScheme');
    expect(flyAuthorization('FlyV1fm2_noSpace')).toBe('Bearer FlyV1fm2_noSpace');
    const plain = fake(() => ({ status: 200, body: '[]' }));
    await createFlyVolumeApi(options(plain.http, { token: 'fo1_plainToken0123456789' })).listVolumes();
    expect(plain.calls[0].headers.Authorization).toBe('Bearer fo1_plainToken0123456789');
  });

  it('ids that do not belong in a path are refused before anything is sent', async () => {
    const { http, calls } = fake(() => ({ status: 200, body: '{}' }));
    expect(() => createFlyVolumeApi(options(http, { app: 'Bad App' }))).toThrow(/app name/);
    expect(() => createFlyVolumeApi(options(http, { machineId: '../machines' }))).toThrow(/machine id/);
    expect(() => createFlyVolumeApi(options(http, { token: '   ' }))).toThrow(/token/);
    const api = createFlyVolumeApi(options(http));
    for (const id of ['../../machines/x', 'vol_1/extend', 'vol 1', '']) {
      await expect(api.getVolume(id)).rejects.toMatchObject({ name: 'FlyApiError', kind: 'not-found' });
      await expect(api.extendVolume(id, 60)).rejects.toBeInstanceOf(FlyApiError);
    }
    for (const size of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(api.extendVolume(VOLUME, size)).rejects.toMatchObject({ kind: 'refused', call: 'extend' });
    }
    expect(calls).toEqual([]);
  });
});

describe('timeouts, no repeats, errors', () => {
  it('every call has a timeout: a transport that never answers is cut off by the client', async () => {
    const hang: FlyHttp = () => new Promise<FlyHttpResponse>(() => {});
    const api = createFlyVolumeApi(options(hang, { timeouts: FAST }));
    const outcomes = await Promise.allSettled([
      api.listVolumes(),
      api.getVolume(VOLUME),
      api.listSnapshots(VOLUME),
      api.createSnapshot(VOLUME),
      api.extendVolume(VOLUME, 60),
      api.restartMachine(),
    ]);
    expect(outcomes.map((o) => (o.status === 'rejected' ? `${(o.reason as FlyApiError).call}: ${(o.reason as FlyApiError).kind}` : 'answered'))).toEqual([
      'list volumes: timeout',
      'read volume: timeout',
      'list snapshots: timeout',
      'create snapshot: timeout',
      'extend: timeout',
      'restart: timeout',
    ]);
  });

  it('a call that changes something is sent once - after a 5xx, a refusal, a lost connection or a timeout', async () => {
    for (const failure of ['503', '422', 'network', 'timeout'] as const) {
      for (const op of ['snapshot', 'extend', 'restart'] as const) {
        const calls: FlyHttpRequest[] = [];
        const http: FlyHttp = (req) => {
          calls.push(req);
          if (failure === '503') return Promise.resolve({ status: 503, body: '' });
          if (failure === '422') return Promise.resolve({ status: 422, body: '{"error":"invalid size"}' });
          if (failure === 'network') return Promise.reject(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }));
          return new Promise<FlyHttpResponse>(() => {});
        };
        const api = createFlyVolumeApi(options(http, { timeouts: FAST }));
        const work = op === 'snapshot' ? api.createSnapshot(VOLUME) : op === 'extend' ? api.extendVolume(VOLUME, 60) : api.restartMachine();
        await expect(work).rejects.toBeInstanceOf(FlyApiError);
        // Time for a second attempt, if there were one.
        await new Promise((resolve) => setTimeout(resolve, 60));
        expect({ failure, op, calls: calls.length }).toEqual({ failure, op, calls: 1 });
      }
    }
  });

  it('the HTTP status becomes a kind; no error message carries the token', async () => {
    const cases: Array<[FlyHttpResponse | 'network', string]> = [
      [{ status: 401, body: '{"error":"unauthorized"}' }, 'unauthorized'],
      [{ status: 403, body: '' }, 'unauthorized'],
      [{ status: 400, body: '{"error":"unauthorized for resource vol_x"}' }, 'unauthorized'],
      [{ status: 404, body: '{"error":"not found"}' }, 'not-found'],
      [{ status: 422, body: '{"error":"size must be larger"}' }, 'refused'],
      [{ status: 409, body: '' }, 'refused'],
      [{ status: 500, body: '' }, 'unavailable'],
      [{ status: 503, body: 'try later' }, 'unavailable'],
      [{ status: 200, body: 'not json' }, 'bad-answer'],
      [{ status: 200, body: '{"id":"vol_fictional0123"}' }, 'bad-answer'],
      ['network', 'network'],
    ];
    for (const [answer, kind] of cases) {
      const http: FlyHttp = () => (answer === 'network' ? Promise.reject(new Error(`connect ECONNREFUSED ${TOKEN}`)) : Promise.resolve(answer));
      const error = await createFlyVolumeApi(options(http))
        .getVolume(VOLUME)
        .then(
          () => null,
          (e: unknown) => e as FlyApiError,
        );
      expect({ answer, kind: error?.kind }).toEqual({ answer, kind });
      expect(error?.message).not.toContain('fm2_');
      expect(JSON.stringify(error)).not.toContain('fm2_');
    }
    // A 2xx extend with an answer that cannot be read is done all the same: no restart said.
    const empty = fake(() => ({ status: 200, body: '' }));
    expect(await createFlyVolumeApi(options(empty.http)).extendVolume(VOLUME, 60)).toEqual({ needsRestart: false, sizeGb: null });
  });
});

describe('the transport of a running server (node:https)', () => {
  it('refuses every other host, scheme, path and method - before anything leaves the machine', async () => {
    const refused: Array<[string, string]> = [
      ['GET', 'https://example.com/v1/apps/x/volumes'],
      ['GET', 'http://api.machines.dev/v1/apps/x/volumes'],
      ['GET', 'https://api.machines.dev.evil.example/v1/apps/x/volumes'],
      ['GET', 'https://user:secret@api.machines.dev/v1/apps/x/volumes'],
      ['GET', 'https://api.machines.dev/v2/apps/x/volumes'],
      ['GET', 'https://api.machines.dev/v1/organizations'],
      ['GET', 'not a url'],
      ['DELETE', `${BASE}/volumes/${VOLUME}`],
      ['PATCH', `${BASE}/volumes/${VOLUME}`],
    ];
    for (const [method, url] of refused) {
      await expect(nodeFlyHttp({ method: method as 'GET', url, headers: { Authorization: TOKEN }, timeoutMs: 50 })).rejects.toThrow(/refused/);
    }
    expect(requestSpy).not.toHaveBeenCalled();
  });
});
