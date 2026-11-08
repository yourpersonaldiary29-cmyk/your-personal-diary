import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryInput } from '@shared/types';
import * as api from '@/api';
import { __setApiBaseForTests, ApiClientError, isConnectionError, setApiTransport, type ApiTransport } from '@/api/client';
import { __resetConnectionForTests } from '@/api/connection';
import { isPartialView, NotCachedError } from './engine';
import { offline } from './index';
import { isPendingRecord } from './optimistic';
import { getSyncStatus } from './status';
import { bootDevice, DANA, installWebCrypto, resetOfflineTestEnv, waitFor, waitForAsync } from './test-utils/env';
import { FakeSyncServer } from './test-utils/fake-sync-server';

beforeAll(() => installWebCrypto());

function entryInput(title: string, over: Partial<EntryInput> = {}): EntryInput {
  return { date: '2026-10-23', time: '08:00', title, body: `${title} body`, mood: 7, emotions: [], energy: 4, stress: null, sleepQuality: null, sleepHours: 7, exerciseMinutes: null, exerciseType: '', events: [], people: ['Noa'], location: 'Park', notes: '', tags: ['walk'], ...over };
}

function okJson(body: unknown, status = 200): Response {
  const text = JSON.stringify(body);
  return { ok: status < 400, status, headers: { get: () => null }, text: async () => text, json: async () => body } as unknown as Response;
}

describe('facade disabled: requests identical to today', () => {
  let transport: ReturnType<typeof vi.fn<ApiTransport>>;

  beforeEach(() => {
    __resetConnectionForTests();
    __setApiBaseForTests('');
    transport = vi.fn<ApiTransport>(async (url) => (url.includes('/api/entries/') ? okJson(undefined, 204) : okJson({ items: [], total: 0 })));
    setApiTransport(transport);
  });

  afterEach(() => {
    setApiTransport(null);
    __setApiBaseForTests(null);
  });

  it('every wrapped group sends the same URL, method, body and init keys as the plain functions', async () => {
    expect(offline.isActive()).toBe(false);
    const input = entryInput('Plain');
    await api.entries.create(input);
    await api.entries.list({ from: '2026-10-01', text: 'walk' });
    await api.entries.get(5).catch(() => undefined);
    await api.entries.remove(5);
    await api.habits.log({ habitId: 3, date: '2026-10-23', value: 2 });
    await api.habits.archive(3, true);
    await api.settings.update({ theme: 'dark' });
    await api.calendar.month(2026, 10);
    await api.insights.home();
    const calls = transport.mock.calls.map(([url, init]) => ({ url, method: init.method, body: init.body, keys: Object.keys(init).sort().join(',') }));
    const keys = 'body,credentials,headers,method,signal';
    expect(calls).toEqual([
      { url: '/api/entries', method: 'POST', body: JSON.stringify(input), keys },
      { url: '/api/entries?from=2026-10-01&text=walk', method: 'GET', body: undefined, keys },
      { url: '/api/entries/5', method: 'GET', body: undefined, keys },
      { url: '/api/entries/5', method: 'DELETE', body: undefined, keys },
      { url: '/api/habits/logs', method: 'PUT', body: JSON.stringify({ habitId: 3, date: '2026-10-23', value: 2 }), keys },
      { url: '/api/habits/3/archive', method: 'PATCH', body: JSON.stringify({ archived: true }), keys },
      { url: '/api/settings', method: 'PUT', body: JSON.stringify({ theme: 'dark' }), keys },
      { url: '/api/calendar/month?year=2026&month=10', method: 'GET', body: undefined, keys },
      { url: '/api/home', method: 'GET', body: undefined, keys },
    ]);
    expect(transport.mock.calls.every(([, init]) => init.signal === undefined)).toBe(true);
  });

  it('keeps the methods that are out of scope untouched', () => {
    expect(typeof api.habits.reorder).toBe('function');
    expect(typeof api.entries.day).toBe('function');
    expect(Object.keys(api.entries).sort()).toEqual(['create', 'day', 'get', 'list', 'locations', 'people', 'remove', 'tags', 'update']);
  });
});

describe('facade enabled (sections 4.3 and 4.6)', () => {
  let server: FakeSyncServer;

  beforeEach(() => {
    server = new FakeSyncServer();
  });

  afterEach(async () => {
    await resetOfflineTestEnv();
  });

  it('a write confirmed within 2 s resolves with the server record (the real id)', async () => {
    await bootDevice({ server, rememberMe: false, app: false });
    expect(offline.isActive()).toBe(true);
    const saved = await api.entries.create(entryInput('Online'));
    expect(saved.id).toBe(1);
    expect(isPendingRecord(saved)).toBe(false);
    expect(server.diary(DANA).entries.get(1)?.title).toBe('Online');
    expect(offline.pending()).toHaveLength(0);
    const updated = await api.entries.update(1, entryInput('Online v2'));
    expect(updated.updatedAt > saved.updatedAt).toBe(true);
    await api.entries.remove(1);
    expect(server.diary(DANA).entries.size).toBe(0);
  });

  it('after 2 s without an answer the write resolves with an optimistic record; the upload finishes by itself', async () => {
    await bootDevice({ server, rememberMe: false, app: false });
    server.latencyMs = 2600;
    const started = Date.now();
    const saved = await api.entries.create(entryInput('Slow'));
    expect(Date.now() - started).toBeGreaterThanOrEqual(1900);
    expect(Date.now() - started).toBeLessThan(2500);
    expect(saved.id).toBe(-1);
    expect(isPendingRecord(saved)).toBe(true);
    server.latencyMs = 0;
    await waitFor(() => offline.serverIdOf(-1) === 1, 6000);
    expect(server.diary(DANA).entries.size).toBe(1);
  }, 15000);

  it('a 400 within the window rejects with the ApiClientError and removes the operation (no note)', async () => {
    await bootDevice({ server, rememberMe: false, app: false });
    const err = await api.entries.create(entryInput('x'.repeat(300))).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION', field: 'title' });
    expect(offline.pending()).toHaveLength(0);
    expect(offline.notes.list()).toEqual([]);
    expect(getSyncStatus().attention).toBe(0);
  });

  it('offline: the form keeps working and reads come from the cache with the overlay', async () => {
    server.seedEntry(DANA, { title: 'Earlier', date: '2026-10-22', tags: ['walk'] });
    server.seedHabit(DANA, { name: 'Water', target: 2 });
    const { engine } = await bootDevice({ server, rememberMe: true, app: true });
    await waitFor(() => engine.cache.bytes > 0 && server.calls('/api/entries/day/').length > 0, 6000);
    const today = new Date().toISOString().slice(0, 10);
    server.mode = 'down';

    const created = await api.entries.create(entryInput('Offline', { date: today }));
    expect(created.id).toBe(-1);
    expect(getSyncStatus().pending).toBe(1);

    const page = await api.entries.list({ from: '2026-10-01', to: today, limit: 500 });
    expect(page.items.map((i) => i.title)).toEqual(['Offline', 'Earlier']);
    expect(page.total).toBe(2);

    const byId = await api.entries.get(-1);
    expect(byId.title).toBe('Offline');
    expect(isPendingRecord(byId)).toBe(true);

    const home = await api.insights.home();
    expect(home.totalEntries).toBe(2);
    expect(home.lastEntry?.id).toBe(-1);

    const progress = await api.habits.progress(today);
    expect(progress.map((p) => p.habit.name)).toEqual(['Water']);
    const logged = await api.habits.log({ habitId: progress[0].habit.id, date: today, value: 2 });
    expect(logged.completed).toBe(true);
    const again = await api.habits.progress(today);
    expect(again[0]).toMatchObject({ weekTotal: 2, targetMet: true, today: { value: 2 } });

    const settings = await api.settings.update({ theme: 'dark' });
    expect(settings.theme).toBe('dark');
    expect((await api.settings.get()).theme).toBe('dark');

    const tags = await api.entries.tags();
    expect(tags).toEqual([{ name: 'walk', count: 2 }]);

    // Online-only reads stay what they are: a connection error.
    const insights = await api.insights.report('30d').catch((e: unknown) => e);
    expect(isConnectionError(insights)).toBe(true);
    // A view that was never cached and cannot be synthesised: "not cached yet".
    const status = await api.habits.status('2026-01-01', '2026-01-31').catch((e: unknown) => e);
    expect(status).toBeInstanceOf(NotCachedError);

    // Back online: everything uploads, the list shows the server ids.
    server.mode = 'online';
    await offline.drain();
    expect(getSyncStatus().pending).toBe(0);
    expect(server.diary(DANA).entries.size).toBe(2);
    expect(server.diary(DANA).settings.theme).toBe('dark');
    const fresh = await api.entries.list({ from: '2026-10-01', to: today, limit: 500 });
    expect(fresh.items.every((i) => i.id > 0)).toBe(true);
    expect(offline.serverIdOf(-1)).toBe(2);
  }, 20000);

  it('a cached GET /api/entries/:id that now answers 404 deletes its row', async () => {
    const e1 = server.seedEntry(DANA, { title: 'Soon gone' });
    const { engine } = await bootDevice({ server, rememberMe: true, app: true });
    await api.entries.get(e1.id);
    expect(await engine.cache.get(`/api/entries/${e1.id}`)).not.toBeNull();
    server.deleteEntry(DANA, e1.id);
    const err = await api.entries.get(e1.id).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 404 });
    expect(await engine.cache.get(`/api/entries/${e1.id}`)).toBeNull();
  });

  it('a day never cached is synthesised from cached entries and marked partial', async () => {
    server.seedEntry(DANA, { title: 'Known', date: '2026-10-22', mood: 4 });
    const { engine } = await bootDevice({ server, rememberMe: true, app: true });
    await waitForAsync(async () => (await engine.cache.get('/api/entries/day/2026-10-22')) !== null, 6000);
    await engine.cache.delete('/api/entries/day/2026-10-22');
    server.mode = 'down';
    const day = await api.entries.day('2026-10-22');
    expect(day.entries.map((e) => e.title)).toEqual(['Known']);
    expect(day.moodAvg).toBe(4);
    expect(isPartialView(day)).toBe(true);
  }, 15000);

  it('a guest or a server without the flag leaves the facade disabled', async () => {
    server.offlineSyncFlag = false;
    const { account } = (await import('./test-utils/env')).wireDevice({ server, rememberMe: true, app: true });
    const outcome = await offline.start({ user: account.user, rememberMe: true, token: account.token });
    expect(outcome).toEqual({ enabled: false, reason: 'unsupported' });
    expect(offline.isActive()).toBe(false);
    server.offlineSyncFlag = true;
    const guest = await offline.start({ user: { ...account.user, guest: true }, rememberMe: false, token: account.token });
    expect(guest).toEqual({ enabled: false, reason: 'guest' });
  });
});
