/**
 * WP-H2 (docs/HOSTED-PLAN.md Part B 5.4, review finding 10): the derivation gate in front of
 * scrypt. Local mode installs none (`kdfGate()` is null) and derives as before; the hosted
 * composition installs `KdfGate({ concurrency, queue })`: at most `concurrency` derivations run,
 * at most `queue` wait, anyone beyond gets 503 'server.error.busy' with `Retry-After: 2`.
 */
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import { ApiError } from '../src/errors';
import { BUSY_KEY, BUSY_RETRY_AFTER_SEC, configureKdfGate, deriveSecret, KdfGate, kdfGate } from '../src/security/kdf';
import { createAuthService, type DiaryAuthService } from '../src/security/auth-service';
import { cleanupTempDirs, makeTestApp, testConfig, testHostedOptions } from './helpers';

const FAST = { N: 1024, r: 8, p: 1 };
const PASSWORD = 'Passw0rd!';
const services: DiaryAuthService[] = [];

afterEach(async () => {
  configureKdfGate(null);
  for (const s of services.splice(0)) await s.shutdown();
});
afterAll(cleanupTempDirs);

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('KdfGate', () => {
  it('runs at most `concurrency` tasks, queues `queue` more, refuses the rest with 503 busy, FIFO', async () => {
    const gate = new KdfGate({ concurrency: 2, queue: 3 });
    const order: number[] = [];
    const tasks = Array.from({ length: 6 }, (_, i) => {
      const d = deferred<number>();
      // Settled at once (never an unhandled rejection): the value, or the error itself.
      const run = gate
        .run(async () => {
          order.push(i);
          return d.promise;
        })
        .then(
          (v) => v as number | ApiError,
          (e: unknown) => e as ApiError,
        );
      return { d, run, i };
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(gate.stats).toEqual({ running: 2, waiting: 3, refused: 1 });
    expect(order).toEqual([0, 1]);
    // The sixth was refused at once.
    const refused = (await tasks[5].run) as ApiError;
    expect(refused).toBeInstanceOf(ApiError);
    expect(refused!.status).toBe(503);
    expect(refused!.key).toBe(BUSY_KEY);
    expect(refused!.retryAfterSec).toBe(BUSY_RETRY_AFTER_SEC);
    expect(refused!.toBody('en').message).toBe(t('en', BUSY_KEY));
    // Finishing one lets the first waiter in, in order.
    tasks[0].d.resolve(0);
    await tasks[0].run;
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual([0, 1, 2]);
    expect(gate.stats).toEqual({ running: 2, waiting: 2, refused: 1 });
    for (const k of [1, 2, 3, 4]) {
      tasks[k].d.resolve(k);
      await tasks[k].run;
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(order).toEqual([0, 1, 2, 3, 4]);
    expect(gate.stats).toEqual({ running: 0, waiting: 0, refused: 1 });
  });

  it('a failing task frees its slot', async () => {
    const gate = new KdfGate({ concurrency: 1, queue: 1 });
    await expect(gate.run(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(gate.stats.running).toBe(0);
    expect(await gate.run(async () => 42)).toBe(42);
  });

  it('validates its options', () => {
    expect(() => new KdfGate({ concurrency: 0, queue: 1 })).toThrow(/concurrency/);
    expect(() => new KdfGate({ concurrency: 1, queue: -1 })).toThrow(/queue/);
    expect(() => new KdfGate({ concurrency: 1.5, queue: 1 })).toThrow(/concurrency/);
  });
});

describe('deriveSecret and the process-wide gate', () => {
  it('derives without any gate by default (local mode), and in parallel', async () => {
    expect(kdfGate()).toBeNull();
    const salt = Buffer.alloc(16, 1);
    const results = await Promise.all(Array.from({ length: 6 }, () => deriveSecret(PASSWORD, salt, FAST)));
    for (const r of results) expect(r.equals(results[0])).toBe(true);
  });

  it('with a gate of 1 / 0, two parallel derivations: one derives, one is 503 busy; removing the gate restores the default', async () => {
    const gate = configureKdfGate({ concurrency: 1, queue: 0 });
    expect(kdfGate()).toBe(gate);
    const salt = Buffer.alloc(16, 2);
    const outcomes = await Promise.all(
      [1, 2].map(() =>
        deriveSecret(PASSWORD, salt, FAST).then(
          () => 'ok',
          (e: ApiError) => `${e.status}:${e.key}`,
        ),
      ),
    );
    expect(outcomes.sort()).toEqual([`503:${BUSY_KEY}`, 'ok']);
    expect(gate!.stats.refused).toBe(1);
    // Bad parameters are refused before the gate (no slot is taken, nothing is counted as refused).
    const bad = await deriveSecret(PASSWORD, Buffer.alloc(3), FAST).then(
      () => null,
      (e: ApiError) => e,
    );
    expect(bad?.status).toBe(500);
    expect(JSON.stringify(bad?.params)).toContain('server.crypto.badSaltLength');
    expect(gate!.stats).toEqual({ running: 0, waiting: 0, refused: 1 });
    configureKdfGate(null);
    expect(kdfGate()).toBeNull();
    const again = await Promise.all([1, 2, 3].map(() => deriveSecret(PASSWORD, salt, FAST)));
    expect(again[0].equals(again[2])).toBe(true);
  });

  it('through the app: the refused sign-in is a 503 with Retry-After: 2 and the localised message', async () => {
    const auth = await createAuthService(testConfig(), { kdf: FAST });
    services.push(auth);
    await auth.register({ firstName: 'Test', lastName: 'User', username: 'ownertest', email: 'ownertest@example.com', password: PASSWORD, rememberMe: false, deviceName: 'pc' });
    const app = await makeTestApp({ auth, hosted: testHostedOptions({ loginPerMinute: 100 }) });
    configureKdfGate({ concurrency: 1, queue: 0 });
    const login = (ip: string) =>
      app.anon().post('/api/auth/login').set('Host', 'diary.example').set('X-Forwarded-For', ip).set('Accept-Language', 'en').send({ username: 'ownertest', password: PASSWORD });
    const answers = await Promise.all([login('203.0.113.1'), login('203.0.113.2'), login('203.0.113.3')]);
    const busy = answers.filter((a) => a.status === 503);
    const ok = answers.filter((a) => a.status === 200);
    expect(busy.length).toBeGreaterThanOrEqual(1);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(busy.length + ok.length).toBe(3);
    for (const b of busy) {
      expect(b.headers['retry-after']).toBe('2');
      expect(b.body).toEqual({ code: 'OTHER', message: t('en', BUSY_KEY) });
    }
    // A refused attempt is not a failed password: no lockout counter was touched.
    const id = auth.listAccounts()[0].id;
    expect(auth.delays.has(`account:${id}@any`)).toBe(false);
  });
});
