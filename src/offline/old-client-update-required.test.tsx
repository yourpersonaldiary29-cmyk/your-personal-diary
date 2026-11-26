/**
 * The versions ALREADY installed (1.0.0 = commit 2f24cde, 1.0.1 = commit a879d82) and the server's refusal of
 * their session routes while the required-update rule of their platform is 1.1.0 or later (app version 1.1.0,
 * brief section C; a rule of 1.0.x refuses nobody - the server cannot tell those versions apart):
 * status 503 with the server's ordinary JSON error body `{ code: 'UPDATE_REQUIRED', message }`.
 *
 * The client code these tests run is the code of the released versions: src/context/AuthContext.tsx,
 * src/pages/LoginPage.tsx, src/pages/RegisterPage.tsx, src/utils/errors.ts, src/api/connection.ts,
 * src/context/ConnectionContext.tsx, src/router.tsx and src/offline/ are unchanged since 2f24cde (git diff
 * 2f24cde HEAD); src/api/client.ts differs only by the installer upload of 1.0.1 (`requestRawUpload`) and the
 * mark of 1.1.0 (one more header), neither of which touches how an answer is read. The whole app runs with its
 * real providers and the REAL api client against the offline engine's in-memory diary server, which answers
 * the four session routes exactly as the hosted server does for an old app.
 *
 * What the released code does with that answer, proved here:
 *  - `GET /api/auth/me` at the start: 503 is "transient" (`isTransientSessionError`), the check is repeated after
 *    1 s, 3 s and 6 s, then the server's message is the notice (a toast) and the app goes to the welcome page WITH
 *    THE TOKEN KEPT; the answer carries the server's JSON body, so it is not a lost connection
 *    (`isConnectionError`) and no start from the cache is tried; nothing of the offline database (the outbox,
 *    the binding, the key) is deleted;
 *  - the sign-in page shows the server's message above the form (and announces it); no token is stored.
 * Fictional data only; nothing touches the network.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { EntryInput } from '@shared/types';
import * as api from '@/api';
import { SESSION_CHECK_RETRY_DELAYS_MS } from '@/context/AuthContext';
import { T } from '@/constants/texts';
import { BINDING_KEY, getSyncStatus, offline } from '@/offline';
import { bootDevice, DANA, fakeKeyVault, fakeMirror, installWebCrypto, wireDevice } from '@/offline/test-utils/env';
import { FakeSyncServer } from '@/offline/test-utils/fake-sync-server';
import { renderOfflineApp, resetOfflineApp } from '@/test/offline-app';
import { assertiveRegion, currentPath } from '@/test/render';
import { openExistingAccountStore } from './store/idb';

vi.mock('@/hooks/useReminders', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useReminders')>()),
  useReminders: () => undefined,
}));

/** The server's message for an old app (shared/i18n/messages/en/server.ts 'server.app.updateRequiredStore'). */
const MESSAGE = 'This version of Your Personal Diary can no longer be used. Update the app in Google Play.';
/** The routes the server refuses for a version before 1.1.0 while the rule of its platform is on. */
const SESSION_ROUTES = ['/api/auth/me', '/api/auth/login', '/api/auth/register', '/api/auth/guest'];

/** The answer of the hosted server: status 503, its ordinary JSON error body. */
function updateRequiredAnswer(): Response {
  const text = JSON.stringify({ code: 'UPDATE_REQUIRED', message: MESSAGE });
  return {
    ok: false,
    status: 503,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null) },
    text: async () => text,
    json: async () => JSON.parse(text),
    blob: async () => new Blob([text]),
  } as unknown as Response;
}

/** The fake server answers the session routes as the hosted server answers an old app; everything else as always. */
function refuseSessionRoutes(server: FakeSyncServer): void {
  const handle = server.handle.bind(server);
  server.handle = (method, url, body, token, bytes) => {
    const path = url.split('?')[0];
    return SESSION_ROUTES.includes(path) ? updateRequiredAnswer() : handle(method, url, body, token, bytes);
  };
}

const ENTRY: EntryInput = {
  date: '2026-11-20',
  time: '08:00',
  title: 'Written before the update',
  body: 'Kept on the device.',
  mood: null,
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
  tags: [],
};

let server: FakeSyncServer;

beforeAll(() => installWebCrypto());

beforeEach(() => {
  server = new FakeSyncServer();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await resetOfflineApp();
});

describe('a version before 1.1.0 meets the refusal of its session routes (503, the server\'s JSON body)', () => {
  it('the session check at the start: the token is kept, the message is shown, no start from the cache, nothing of the offline database deleted', async () => {
    // Dana uses the Windows app with "Remember me": a change waits on the device, then the app is closed.
    const keyVault = fakeKeyVault('dpapi');
    const mirror = fakeMirror();
    const first = await bootDevice({ server, rememberMe: true, app: true, keyVault, mirror });
    server.mode = 'down';
    offline.__engineForTests()?.connectivity.noteFailure();
    await api.entries.create(ENTRY);
    expect(getSyncStatus().pending).toBe(1);
    await offline.__resetForTests();
    const binding = localStorage.getItem(BINDING_KEY);
    expect(binding).toContain(DANA);
    mirror.calls.length = 0;

    // The owner turned the rule on; the app is started again, with a connection.
    wireDevice({ server, rememberMe: true, app: true, keyVault, mirror, idb: first.idb, token: first.account.token });
    server.mode = 'online';
    refuseSessionRoutes(server);
    const cacheStart = vi.spyOn(offline, 'startFromCache');
    const wipe = vi.spyOn(offline, 'wipeAccount');
    const onUnauthorized = vi.spyOn(offline, 'onUnauthorized');
    renderOfflineApp('/');

    // The check is repeated after 1 s, 3 s and 6 s, then the server's message is shown.
    const waitMs = SESSION_CHECK_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
    expect(await screen.findByText(MESSAGE, {}, { timeout: waitMs + 15000 })).toBeInTheDocument();
    expect(server.calls('/api/auth/me')).toHaveLength(SESSION_CHECK_RETRY_DELAYS_MS.length + 1);
    // The welcome page, not the "no connection" page: the server answered (its JSON body).
    expect(currentPath()).toBe('/');
    expect(screen.queryByTestId('no-connection-page')).not.toBeInTheDocument();
    expect(api.getConnectionState().offline).toBe(false);

    // The token is STILL in its storage ("Remember me": localStorage) - the updated app is in again without a sign-in.
    expect(localStorage.getItem(api.TOKEN_KEY)).toBe(first.account.token);
    expect(api.getToken()).toBe(first.account.token);
    // No start from the cache was tried, and nothing of the offline database went away.
    expect(cacheStart).not.toHaveBeenCalled();
    expect(wipe).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(localStorage.getItem(BINDING_KEY)).toBe(binding);
    expect(keyVault.removed).toEqual([]);
    expect(keyVault.blobs.has(DANA)).toBe(true);
    expect(mirror.calls.filter((c) => c === 'clear' || c.startsWith('remove'))).toEqual([]);
    expect(await offline.otherAccountsWithPending(null)).toEqual([{ userId: DANA, count: 1 }]);
    const store = await openExistingAccountStore(DANA);
    expect(store).not.toBeNull();
    store?.close();
    // Nothing of the waiting change reached the server either: it uploads after the update.
    expect(server.diary(DANA).entries.size).toBe(0);
  }, 60000);

  it('the sign-in page shows the server\'s message (and announces it); no token is stored', async () => {
    wireDevice({ server });
    api.clearToken();
    refuseSessionRoutes(server);
    const { user } = renderOfflineApp('/login');
    await user.type(await screen.findByLabelText(new RegExp(T.usernameOrEmail)), 'dana');
    await user.type(screen.getByLabelText(new RegExp(`^${T.password}`)), 'a fictional password');
    await user.click(screen.getByRole('button', { name: T.login }));

    expect(await screen.findByText(MESSAGE, {}, { timeout: 10000 })).toBeInTheDocument();
    expect(document.getElementById('login-server-error')).toHaveTextContent(MESSAGE);
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(MESSAGE));
    expect(server.calls('/api/auth/login', 'POST')).toHaveLength(1);
    expect(api.getToken()).toBeNull();
    expect(currentPath()).toBe('/login');
  }, 30000);
});
