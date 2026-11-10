/**
 * The published, server-only Android app against a HOSTED server (WP-H6; docs/HOSTED-PLAN.md 4c:
 * "the Android app <-> hosted server contract is identical to the web; re-run against a hosted test
 * server"). The hosted composition (server/src/hosted.ts `startHosted`, DIARY_MODE=hosted) runs from
 * source under Node (../compat/native-server.ts) on a temporary data directory and a free loopback
 * port - never the public server, never port 47321 - and the app's own client code talks to it:
 * the API client of src/api with the server's address as its base (inside the installed app that
 * base is the fixed DEFAULT_SERVER_URL; here it is the loopback test server), the server host of
 * mobile/host/server-mode.ts (lock on leave) and the transport observer that re-plans the reminders.
 *
 * What the owner will try on the phone (docs/ANDROID-PHONE-TEST.he.md part 3): the tour, register,
 * sign in again, write an entry, the habits the reminders are planned from, lock on leave, a backup
 * downloaded and read back - plus what only a test can show: the CORS answer for the WebView's
 * origin (https://localhost), every request going to the one server, and a lost connection being
 * reported as such. Fictional accounts only.
 */
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { EntryInput, HabitInput } from '@shared/types';
import { auth, backup, entries, habits, server as serverApi } from '@/api';
import { __setApiBaseForTests, clearToken, getToken, isApiClientError, isConnectionError, setApiTransport, setToken } from '@/api/client';
import { __resetLocaleForTests } from '@/i18n/runtime';
import { serverHost } from '../host/server-mode';
import { observeHabitChanges } from '../platform/notifications';
import { openNativeServer, type NativeServer } from './compat/native-server';

/** Cheap scrypt parameters for the test accounts (as ./core/helpers.ts FAST_KDF; the formats do not depend on them). */
const FAST_KDF = { N: 1024, r: 8, p: 1 };

type HostedModule = typeof import('../../server/src/hosted');
type ConfigModule = typeof import('../../server/src/config');
type RunningHosted = Awaited<ReturnType<HostedModule['startHosted']>>;

const PASSWORD = 'Passw0rd!';
/** The origin of the Android WebView (capacitor.config.ts androidScheme 'https'). */
const WEBVIEW_ORIGIN = 'https://localhost';

let native: NativeServer;
let running: RunningHosted | null = null;
let dataDir = '';
let base = '';
/** Every URL the client fetched (the network guard of the app allows only the server; here we look). */
const fetched: string[] = [];

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

function entryInput(title: string, date = '2026-10-20'): EntryInput {
  return {
    date,
    time: '08:30',
    title,
    body: 'A fictional morning on the hosted server.',
    mood: 4,
    emotions: [],
    energy: null,
    stress: null,
    sleepQuality: null,
    sleepHours: null,
    exerciseMinutes: null,
    exerciseType: '',
    events: [],
    people: [],
    location: '',
    notes: '',
    tags: ['phone'],
  } as EntryInput;
}

/** The bytes of a downloaded Blob (the test DOM's Blob has no arrayBuffer(); FileReader reads it as the app's download code does). */
function blobBytes(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

const WATER: HabitInput ={ name: 'Water', description: '', target: 8, unit: 'glasses', frequency: 'daily', reminderTime: '09:00', reminderEnabled: true };

beforeAll(async () => {
  native = await openNativeServer();
  const hosted = await native.load<HostedModule>('hosted');
  const config = await native.load<ConfigModule>('config');
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpd-hosted-app-'));
  // http is accepted for a loopback public address only (tests); the real server is https.
  const env = config.loadHostedEnv({ DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: base, DIARY_BIND: '127.0.0.1', PORT: String(port) });
  const serverConfig = config.loadConfig(['--data-dir', dataDir], { DIARY_MODE: 'hosted' });
  running = await hosted.startHosted(serverConfig, env, { port, bind: '127.0.0.1', quiet: true, auth: { kdf: FAST_KDF } });

  const realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    fetched.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return realFetch(input, init);
  });
  __resetLocaleForTests();
  __setApiBaseForTests(base);
}, 120_000);

afterAll(async () => {
  vi.unstubAllGlobals();
  setApiTransport(null);
  clearToken();
  __setApiBaseForTests(null);
  await running?.stop();
  running = null;
  await native?.close();
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('the published Android app against a hosted server', () => {
  it('the server says it is hosted, open for registration and offers the tour', async () => {
    const info = await serverApi.info();
    expect(info).toMatchObject({ mode: 'hosted', publicUrl: base, registration: 'open', guestTour: true, lanEnabled: false, isLocalRequest: false });
    // No disk paths leave a hosted server.
    expect(info.dataDir).toBe('');
  });

  it("CORS: the WebView's origin (https://localhost) may call the API, a foreign origin may not", async () => {
    const preflight = await fetch(`${base}/api/auth/login`, {
      method: 'OPTIONS',
      headers: { Origin: WEBVIEW_ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type,accept-language' },
    });
    expect(preflight.status).toBeLessThan(300);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(WEBVIEW_ORIGIN);
    expect((preflight.headers.get('access-control-allow-headers') ?? '').toLowerCase()).toContain('authorization');

    const health = await fetch(`${base}/api/health`, { headers: { Origin: WEBVIEW_ORIGIN } });
    expect(health.status).toBe(200);
    expect(health.headers.get('access-control-allow-origin')).toBe(WEBVIEW_ORIGIN);
    // The WebView may read the file name of a backup / export download.
    expect((health.headers.get('access-control-expose-headers') ?? '').toLowerCase()).toContain('content-disposition');

    const foreign = await fetch(`${base}/api/health`, { headers: { Origin: 'https://evil.example' } });
    expect(foreign.headers.get('access-control-allow-origin')).not.toBe('https://evil.example');
    expect(foreign.headers.get('access-control-allow-origin')).not.toBe('*');
  });

  it('the tour ("Skip - just look around"): a guest with sample data; lock on leave ignores its 403', async () => {
    const tour = await auth.guest({ language: 'en', deviceName: 'Phone' });
    expect(tour.guest).toBe(true);
    expect(tour.rememberMe).toBe(false);
    setToken(tour.token, false);
    const page = await entries.list({ limit: 5 });
    expect(page.total).toBeGreaterThan(0);
    // The server refuses to lock a guest (no password could unlock it): not an error for the app.
    await expect(serverHost().control('lockAll')).resolves.toBeUndefined();
    await auth.logout();
    clearToken();
  });

  it('register on the server, sign in again ("remember me"), write an entry and read it back', async () => {
    const registered = await auth.register({
      firstName: 'Noa',
      lastName: 'Fictional',
      username: 'noa_phone',
      email: 'noa_phone@example.test',
      password: PASSWORD,
      confirmPassword: PASSWORD,
      rememberMe: true,
      deviceName: 'Phone',
      // The consent checkbox of the registration form (Privacy Policy and Terms of Use): a hosted server creates no account without both flags.
      privacyAccepted: true,
      termsAccepted: true,
    });
    expect(registered.user.username).toBe('noa_phone');
    expect(registered.guest).toBeUndefined();
    await auth.logout().catch(() => undefined);

    const signedIn = await auth.login({ username: 'noa_phone', password: PASSWORD, rememberMe: true, deviceName: 'Phone' });
    expect(signedIn.rememberMe).toBe(true);
    setToken(signedIn.token, true);
    expect(getToken()).toBe(signedIn.token);

    const created = await entries.create(entryInput('Written on the phone'));
    expect(created.title).toBe('Written on the phone');
    const page = await entries.list({ limit: 10 });
    expect(page.items.map((item) => item.title)).toContain('Written on the phone');
  });

  it("habits: what the reminder scheduler reads answers, and a change through the app's transport re-plans the reminders", async () => {
    const onChanged = vi.fn();
    setApiTransport(observeHabitChanges(serverHost().transport, onChanged));
    try {
      const habit = await habits.create(WATER);
      expect(onChanged).toHaveBeenCalledTimes(1);
      await habits.log({ habitId: habit.id, date: '2026-10-20', value: 3 });
      expect(onChanged).toHaveBeenCalledTimes(2);

      const list = await habits.list(false);
      expect(list.map((h) => [h.name, h.reminderEnabled, h.reminderTime])).toEqual([['Water', true, '09:00']]);
      const progress = await habits.progress('2026-10-20');
      expect(progress).toHaveLength(1);
      // Reads re-plan nothing.
      expect(onChanged).toHaveBeenCalledTimes(2);
    } finally {
      setApiTransport(null);
    }
  });

  it('lock on leave: the server host locks the session (423 everywhere) until the password is verified; flushAll sends nothing', async () => {
    const before = fetched.length;
    await serverHost().control('flushAll');
    expect(fetched.length).toBe(before);

    await serverHost().control('lockAll');
    const locked = await entries.list({ limit: 1 }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(isApiClientError(locked) && locked.status).toBe(423);

    await auth.verifyPassword(PASSWORD);
    await expect(entries.list({ limit: 1 })).resolves.toMatchObject({ total: 1 });
  });

  it('backup: the encrypted file downloads to the phone, is recognised and restores into the account', async () => {
    const { blob, fileName } = await backup.download({});
    expect(fileName).toMatch(/\.mpd$/);
    const bytes = await blobBytes(blob);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    // What "Save to device" / "Share" hand to Android, and what "Choose backup file" reads back.
    const file = new File([bytes], 'my-diary.mpd', { type: 'application/octet-stream' });

    const inspected = await backup.inspectFile(file);
    expect(inspected.valid).toBe(true);

    await entries.create(entryInput('Written after the backup', '2026-10-21'));
    const restored = await backup.restoreFromFile(file, PASSWORD);
    expect(restored).toMatchObject({ entries: 1, habits: 1 });
    const page = await entries.list({ limit: 10 });
    expect(page.items.map((item) => item.title)).toEqual(['Written on the phone']);
  });

  it('every request of the app went to the one server', () => {
    expect(fetched.length).toBeGreaterThan(10);
    expect(fetched.filter((url) => !url.startsWith(`${base}/api/`))).toEqual([]);
  });

  it('a lost connection is reported as a connection error (the "no connection to the diary server" page), not as a server answer', async () => {
    await running?.stop();
    running = null;
    const lost = await entries.list({ limit: 1 }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(isApiClientError(lost)).toBe(true);
    expect(isConnectionError(lost)).toBe(true);
    // Lock on leave without a connection rejects: the lifecycle shows the lock screen all the same.
    await expect(serverHost().control('lockAll')).rejects.toMatchObject({ status: 0 });
  });
});
