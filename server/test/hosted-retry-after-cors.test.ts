/**
 * Retry-After for the cross-origin apps on the hosted server (verifier of WP-H8): the Windows app
 * (http://tauri.localhost) and the Android app (https://localhost) can read an answer header only
 * when `Access-Control-Expose-Headers` names it, and Retry-After is not CORS-safelisted. /api/sync
 * and /api/server/archive exposed it already (sync-route.test.ts, hosted-archive.test.ts); this file
 * covers the other answers that carry it:
 *   - the tour's 503 'server.auth.guestsFull' (POST /api/auth/guest, Retry-After 120);
 *   - the derivation gate's 503 'server.error.busy' (a sign-in, like every password check under
 *     /api/auth: Retry-After 2) and the same gate behind a backup password (/api/backup);
 * and that nothing else changed: same-origin answers (the web UI) get no CORS header at all, other
 * routes keep exactly the two download headers, and the local server is untouched.
 * Fictional accounts only; everything runs in temporary directories.
 */
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import { HOSTED_ORIGINS } from '../src/middleware/access';
import { createAuthService, type DiaryAuthService } from '../src/security/auth-service';
import { GUESTS_FULL_KEY, GUESTS_FULL_RETRY_AFTER_SEC } from '../src/security/guest';
import { BUSY_KEY, BUSY_RETRY_AFTER_SEC, configureKdfGate, kdfGate } from '../src/security/kdf';
import { cleanupTempDirs, makeTestApp, testConfig, testHostedOptions } from './helpers';

const HOST = 'diary.example';
const FAST = { N: 1024, r: 8, p: 1 };
const PASSWORD = 'Passw0rd!';
/** What every allowed origin may read on every route (the Windows app's downloads). */
const DOWNLOAD_HEADERS = ['content-disposition', 'x-entries-exported'];
const services: DiaryAuthService[] = [];

afterEach(async () => {
  configureKdfGate(null);
  for (const s of services.splice(0)) await s.shutdown();
});
afterAll(cleanupTempDirs);

/** The comma-separated header as a list of lower-case names. */
function exposed(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
}

/** A hosted app around a real auth service (the tour mounted), optionally with the hosted guest policy. */
async function hostedApp(guests?: { max: number; lifetimeMs: number }) {
  const auth = await createAuthService(testConfig(), { kdf: FAST, ...(guests ? { guests } : {}) });
  services.push(auth);
  const app = await makeTestApp({ auth, guestAllowed: true, hosted: testHostedOptions({ loginPerMinute: 100 }) });
  return { auth, app };
}

describe('hosted mode: Retry-After is readable by the Windows and Android apps', () => {
  it('the tour: a 503 guestsFull exposes Retry-After to every app origin; same-origin and foreign answers are unchanged', async () => {
    const { app } = await hostedApp({ max: 1, lifetimeMs: 60_000 });
    const first = await app.anon().post('/api/auth/guest').set('Host', HOST).send({});
    expect(first.status).toBe(201);
    for (const origin of HOSTED_ORIGINS) {
      const full = await app.anon().post('/api/auth/guest').set('Host', HOST).set('Origin', origin).set('Accept-Language', 'en').send({});
      expect([origin, full.status]).toEqual([origin, 503]);
      expect(full.body).toEqual({ code: 'OTHER', message: t('en', GUESTS_FULL_KEY) });
      expect(full.headers['retry-after']).toBe(String(GUESTS_FULL_RETRY_AFTER_SEC));
      expect(full.headers['access-control-allow-origin']).toBe(origin);
      expect([origin, exposed(full.headers['access-control-expose-headers'])]).toEqual([origin, [...DOWNLOAD_HEADERS, 'retry-after']]);
    }
    // Same-origin (the web UI): no CORS header at all, as before; Retry-After is readable anyway.
    const same = await app.anon().post('/api/auth/guest').set('Host', HOST).send({});
    expect(same.status).toBe(503);
    expect(same.headers['retry-after']).toBe(String(GUESTS_FULL_RETRY_AFTER_SEC));
    expect(same.headers['access-control-allow-origin']).toBeUndefined();
    expect(same.headers['access-control-expose-headers']).toBeUndefined();
    // An origin outside the list: still nothing.
    const other = await app.anon().post('/api/auth/guest').set('Host', HOST).set('Origin', 'https://evil.example').send({});
    expect(other.status).toBe(503);
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
    expect(other.headers['access-control-expose-headers']).toBeUndefined();
  });

  it('the derivation gate: a 503 busy under /api/auth exposes Retry-After; /api/backup carries it in front of the session check; other routes are unchanged', async () => {
    const { auth, app } = await hostedApp();
    await auth.register({ firstName: 'Dana', lastName: 'Test', username: 'dana', email: 'dana@example.com', password: PASSWORD, rememberMe: false, deviceName: 'pc' });
    // One slot and no queue, and the slot is taken: the next password check is refused at once.
    configureKdfGate({ concurrency: 1, queue: 0 });
    let release!: () => void;
    const held = kdfGate()!.run(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    try {
      for (const origin of HOSTED_ORIGINS) {
        const busy = await app.anon().post('/api/auth/login').set('Host', HOST).set('Origin', origin).set('Accept-Language', 'en').send({ username: 'dana', password: PASSWORD });
        expect([origin, busy.status]).toEqual([origin, 503]);
        expect(busy.body).toEqual({ code: 'OTHER', message: t('en', BUSY_KEY) });
        expect(busy.headers['retry-after']).toBe(String(BUSY_RETRY_AFTER_SEC));
        expect(busy.headers['access-control-allow-origin']).toBe(origin);
        expect([origin, exposed(busy.headers['access-control-expose-headers'])]).toEqual([origin, [...DOWNLOAD_HEADERS, 'retry-after']]);
      }
      const same = await app.anon().post('/api/auth/login').set('Host', HOST).send({ username: 'dana', password: PASSWORD });
      expect(same.status).toBe(503);
      expect(same.headers['retry-after']).toBe(String(BUSY_RETRY_AFTER_SEC));
      expect(same.headers['access-control-expose-headers']).toBeUndefined();
    } finally {
      release();
      await held;
    }
    // With the slot free the sign-in works, and the answer still names Retry-After (the apps may read it on any answer here).
    const ok = await app.anon().post('/api/auth/login').set('Host', HOST).set('Origin', 'https://localhost').send({ username: 'dana', password: PASSWORD });
    expect(ok.status).toBe(200);
    expect(exposed(ok.headers['access-control-expose-headers'])).toEqual([...DOWNLOAD_HEADERS, 'retry-after']);
    // /api/backup: a backup password goes through the same gate; mounted in front of the session check, so every answer there names it.
    const backup = await app.anon().post('/api/backup/inspect').set('Host', HOST).set('Origin', 'http://tauri.localhost').send({});
    expect(backup.status).toBe(401);
    expect(exposed(backup.headers['access-control-expose-headers'])).toEqual([...DOWNLOAD_HEADERS, 'retry-after']);
    // Every other route keeps exactly the two download headers.
    const entries = await app.anon().get('/api/entries').set('Host', HOST).set('Origin', 'http://tauri.localhost');
    expect(entries.status).toBe(401);
    expect(exposed(entries.headers['access-control-expose-headers'])).toEqual(DOWNLOAD_HEADERS);
    const info = await app.anon().get('/api/server/info').set('Host', HOST).set('Origin', 'https://localhost');
    expect(info.status).toBe(200);
    expect(exposed(info.headers['access-control-expose-headers'])).toEqual(DOWNLOAD_HEADERS);
  });
});

describe('local mode: unchanged', () => {
  it('the guest route and a sign-in expose only the two download headers to the desktop shell, and send no Retry-After', async () => {
    const auth = await createAuthService(testConfig(), { kdf: FAST });
    services.push(auth);
    const app = await makeTestApp({ auth, guestAllowed: true });
    const guest = await app.anon().post('/api/auth/guest').set('Origin', 'http://tauri.localhost').send({});
    expect(guest.status).toBe(201);
    expect(guest.headers['retry-after']).toBeUndefined();
    expect(exposed(guest.headers['access-control-expose-headers'])).toEqual(DOWNLOAD_HEADERS);
    const login = await app.anon().post('/api/auth/login').set('Origin', 'http://tauri.localhost').send({ username: 'nobody', password: PASSWORD });
    expect(login.status).toBe(401);
    expect(login.headers['retry-after']).toBeUndefined();
    expect(exposed(login.headers['access-control-expose-headers'])).toEqual(DOWNLOAD_HEADERS);
  });
});
