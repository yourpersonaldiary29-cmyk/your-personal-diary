import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { monthViewContaining, monthViewFor } from '@shared/calendars/month-view';
import type { CalendarDay, DaySummary, EntryInput, EntryPage } from '@shared/types';
import * as api from '@/api';
import { __setApiBaseForTests, ApiClientError, isConnectionError, setApiTransport, withQuery, type ApiTransport } from '@/api/client';
import { __resetConnectionForTests } from '@/api/connection';
import { CALENDAR_SYSTEM_KEY } from '@/utils/calendar-extras';
import { resolveView } from '@/utils/calendar-years';
import { addDays, todayIso } from '@/utils/dates';
import { isPartialView, NotCachedError, type OfflineEngine } from './engine';
import { offline } from './index';
import { isPendingRecord } from './optimistic';
import { entryToSummary } from './overlay/effects';
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

  it('the calendar range of a Hebrew or Hijri month goes out as the plain request too', async () => {
    await api.calendar.range('2026-09-12', '2026-10-11');
    expect(transport.mock.calls.map(([url, init]) => `${init.method} ${url}`)).toEqual(['GET /api/calendar/range?from=2026-09-12&to=2026-10-11']);
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
    // The day before today, not a fixed date: the warm-up lists the entries of the last 30 days only, so with the
    // fixed 22 October 2026 this test began to fail on 22 November 2026.
    const today = new Date().toISOString().slice(0, 10);
    server.seedEntry(DANA, { title: 'Earlier', date: addDays(today, -1), tags: ['walk'] });
    server.seedHabit(DANA, { name: 'Water', target: 2 });
    const { engine } = await bootDevice({ server, rememberMe: true, app: true });
    await waitFor(() => engine.cache.bytes > 0 && server.calls('/api/entries/day/').length > 0, 6000);
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
    // Yesterday, not a fixed date: the warm-up caches the days of the entries of the last 30 days only (a fixed
    // 22 October 2026 fell out of that window on 22 November 2026).
    const known = addDays(todayIso(), -1);
    server.seedEntry(DANA, { title: 'Known', date: known, mood: 4 });
    const { engine } = await bootDevice({ server, rememberMe: true, app: true });
    await waitForAsync(async () => (await engine.cache.get(`/api/entries/day/${known}`)) !== null, 6000);
    await engine.cache.delete(`/api/entries/day/${known}`);
    server.mode = 'down';
    const day = await api.entries.day(known);
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

/** One line per day of a calendar answer: "date count title+title". */
function lines(days: readonly CalendarDay[]): string[] {
  return days.map((d) => `${d.date} ${d.entryCount} ${d.titles.join('+')}`);
}

/** A few milliseconds, so two cached answers never share their `cachedAt`. */
const tick = () => new Promise((r) => setTimeout(r, 5));

/** Makes the cached row of `url` look `days` days older (the cache keeps when each answer arrived). */
async function ageCached(engine: OfflineEngine, url: string, days: number): Promise<void> {
  const key = await engine.cache.keyOf(url);
  await engine.cache.store.tx(['cache'], 'readwrite', async (t) => {
    const row = await t.get('cache', key);
    if (!row) throw new Error(`not cached: ${url}`);
    await t.put('cache', { ...row, cachedAt: row.cachedAt - days * 86_400_000 });
  });
}

describe('offline: a month of any calendar system the cache never held (OFFLINE-CALENDARS, section 4.6 "Missing views")', () => {
  // Tishrei 5787 runs from 12 September to 11 October 2026 (the same civil days as Rabiʻ II 1448).
  const TISHREI = monthViewFor('hebrew', 5787, 1, 'en');
  let server: FakeSyncServer;

  beforeEach(() => {
    server = new FakeSyncServer();
  });

  afterEach(async () => {
    await resetOfflineTestEnv();
  });

  /** A device with "Remember me" whose start-up warm-up has run (its last request when no entry is recent: the locations). */
  async function device() {
    const booted = await bootDevice({ server, rememberMe: true, app: true });
    await waitForAsync(async () => (await booted.engine.cache.get('/api/entries/meta/locations')) !== null, 6000);
    return booted;
  }

  it('an uncached Hebrew month is put together from a cached Gregorian month and cached entries, marked partial', async () => {
    expect([TISHREI.firstDay, TISHREI.lastDay]).toEqual(['2026-09-12', '2026-10-11']);
    server.seedHabit(DANA, { name: 'Water', target: 2 });
    server.seedEntry(DANA, { title: 'Before Tishrei', date: '2026-09-11' });
    server.seedEntry(DANA, { title: 'Rosh Hashana', date: '2026-09-12', mood: 8, energy: 6 });
    const trip = server.seedEntry(DANA, { title: 'Sukkot trip', date: '2026-10-03', mood: 5 });
    server.seedEntry(DANA, { title: 'Never on this device', date: '2026-10-05' });
    await device();
    // Online the device showed September (a Gregorian month) and opened one October entry - nothing of Tishrei.
    await api.calendar.month(2026, 9);
    await api.entries.get(trip.id);
    server.mode = 'down';

    const days = await api.calendar.range(TISHREI.firstDay, TISHREI.lastDay);
    expect(isPartialView(days)).toBe(true);
    // Only the days with data, as the server's range answer lists them.
    expect(lines(days)).toEqual(['2026-09-12 1 Rosh Hashana', '2026-10-03 1 Sukkot trip']);
    // A day of the cached month keeps the month's numbers; a day known from an entry has its count and title (no averages)
    // and the habit total of the reported past days.
    expect(days[0]).toMatchObject({ mood: 8, energy: 6, hasEntry: true, habitsCompleted: 0, habitsTotal: 1 });
    expect(days[1]).toMatchObject({ mood: null, energy: null, stress: null, sleepHours: null, hasEntry: true, habitsCompleted: 0, habitsTotal: 1 });
  });

  it('the same for a Hijri month: Ramadan 1447 from a cached March and a cached February entry', async () => {
    const ramadan = monthViewFor('hijri', 1447, 9, 'en');
    expect([ramadan.firstDay, ramadan.lastDay]).toEqual(['2026-02-18', '2026-03-19']);
    const first = server.seedEntry(DANA, { title: 'First night', date: '2026-02-18', time: '20:00' });
    server.seedEntry(DANA, { title: 'Iftar', date: '2026-03-10', time: '19:00', mood: 9 });
    server.seedEntry(DANA, { title: 'Late', date: '2026-03-10', time: '23:00', mood: 7 });
    server.seedEntry(DANA, { title: 'After Ramadan', date: '2026-03-20' });
    await device();
    await api.calendar.month(2026, 3);
    await api.entries.get(first.id);
    server.mode = 'down';

    const days = await api.calendar.range(ramadan.firstDay, ramadan.lastDay);
    expect(isPartialView(days)).toBe(true);
    expect(lines(days)).toEqual(['2026-02-18 1 First night', '2026-03-10 2 Iftar+Late']);
    expect(days.map((d) => d.mood)).toEqual([null, 8]);
  });

  it('a month across a Gregorian month and a year boundary takes each day from what covers it (Tevet 5786, Rajab 1447)', async () => {
    const tevet = monthViewContaining('hebrew', '2026-01-01', 'en');
    const rajab = monthViewContaining('hijri', '2026-01-01', 'en');
    expect([tevet.firstDay, tevet.lastDay]).toEqual(['2025-12-21', '2026-01-18']);
    expect([rajab.firstDay, rajab.lastDay]).toEqual(['2025-12-21', '2026-01-19']);
    server.seedEntry(DANA, { title: 'Last of 2025', date: '2025-12-31', mood: 5 });
    const jan = server.seedEntry(DANA, { title: 'First of 2026', date: '2026-01-01' });
    server.seedEntry(DANA, { title: 'Not on this device', date: '2026-01-19' });
    await device();
    await api.calendar.month(2025, 12);
    await api.entries.get(jan.id);
    server.mode = 'down';

    const days = await api.calendar.range(tevet.firstDay, tevet.lastDay);
    expect(isPartialView(days)).toBe(true);
    expect(lines(days)).toEqual(['2025-12-31 1 Last of 2025', '2026-01-01 1 First of 2026']);
    expect(days.map((d) => d.mood)).toEqual([5, null]);
    expect(lines(await api.calendar.range(rajab.firstDay, rajab.lastDay))).toEqual(['2025-12-31 1 Last of 2025', '2026-01-01 1 First of 2026']);
    // January 2026 was never viewed either: a whole month, the entry on the 1st.
    const january = await api.calendar.month(2026, 1);
    expect(isPartialView(january)).toBe(true);
    expect(january.days).toHaveLength(31);
    expect(january.days[0]).toMatchObject({ date: '2026-01-01', hasEntry: true, entryCount: 1, titles: ['First of 2026'] });
    expect(january.days.slice(1).every((d) => !d.hasEntry && d.entryCount === 0)).toBe(true);
  });

  it('the two Adars of a Hebrew leap year (5784) are told apart by their civil days', async () => {
    const adar1 = monthViewFor('hebrew', 5784, 6, 'en');
    const adar2 = monthViewFor('hebrew', 5784, 7, 'en');
    expect([adar1.monthKey, adar1.firstDay, adar1.lastDay]).toEqual(['adar1', '2024-02-10', '2024-03-10']);
    expect([adar2.monthKey, adar2.firstDay, adar2.lastDay]).toEqual(['adar2', '2024-03-11', '2024-04-08']);
    const katan = server.seedEntry(DANA, { title: 'Purim Katan', date: '2024-02-23' }); // 14 Adar I
    server.seedEntry(DANA, { title: 'Last of Adar I', date: '2024-03-10' });
    server.seedEntry(DANA, { title: 'Purim', date: '2024-03-24' }); // 14 Adar II
    const last = server.seedEntry(DANA, { title: 'Last of Adar II', date: '2024-04-08' });
    await device();
    // March 2024 holds the end of Adar I and the start of Adar II; February and April come from entries.
    await api.calendar.month(2024, 3);
    await api.entries.get(katan.id);
    await api.entries.get(last.id);
    server.mode = 'down';

    const first = await api.calendar.range(adar1.firstDay, adar1.lastDay);
    const second = await api.calendar.range(adar2.firstDay, adar2.lastDay);
    expect(lines(first)).toEqual(['2024-02-23 1 Purim Katan', '2024-03-10 1 Last of Adar I']);
    expect(lines(second)).toEqual(['2024-03-24 1 Purim', '2024-04-08 1 Last of Adar II']);
    expect(isPartialView(first) && isPartialView(second)).toBe(true);
  });

  it('changes made offline show, change and disappear in a month put together from the device', async () => {
    const known = server.seedEntry(DANA, { title: 'Known', date: '2026-09-15' });
    await device();
    await api.calendar.month(2026, 9); // covers 12-30 September of Tishrei
    await api.entries.get(known.id); // the version shown: the base of the edits below
    server.mode = 'down';
    const tishrei = async () => {
      const days = await api.calendar.range(TISHREI.firstDay, TISHREI.lastDay);
      expect(isPartialView(days)).toBe(true);
      return lines(days);
    };
    expect(await tishrei()).toEqual(['2026-09-15 1 Known']);

    // Created on a day nothing cached covers (3 October) and on one the cached September covers.
    const a = await api.entries.create(entryInput('Offline A', { date: '2026-10-03' }));
    const b = await api.entries.create(entryInput('Offline B', { date: '2026-09-20' }));
    expect(a.id).toBeLessThan(0);
    expect(await tishrei()).toEqual(['2026-09-15 1 Known', '2026-09-20 1 Offline B', '2026-10-03 1 Offline A']);

    // Edited: new titles, and the known entry moved from a covered day to an uncovered one.
    await api.entries.update(a.id, entryInput('Offline A2', { date: '2026-10-03' }));
    await api.entries.update(b.id, entryInput('Offline B2', { date: '2026-09-20' }));
    await api.entries.update(known.id, entryInput('Known moved', { date: '2026-10-04' }));
    expect(await tishrei()).toEqual(['2026-09-20 1 Offline B2', '2026-10-03 1 Offline A2', '2026-10-04 1 Known moved']);

    // Deleted: gone.
    await api.entries.remove(a.id);
    await api.entries.remove(known.id);
    expect(await tishrei()).toEqual(['2026-09-20 1 Offline B2']);
    await api.entries.remove(b.id);
    expect(await tishrei()).toEqual([]);
    // What is left to upload: the delete of the known entry (the creates and their deletes cancelled out).
    expect(offline.pending()).toHaveLength(1);
  });

  it('a habit logged offline counts on its day, whether a cached answer covers the day or not', async () => {
    const water = server.seedHabit(DANA, { name: 'Water', target: 1 });
    await device();
    await api.calendar.month(2026, 9); // covers 12-30 September and reports one active habit
    server.mode = 'down';
    await api.habits.log({ habitId: water.id, date: '2026-09-20', value: 1 });
    await api.habits.log({ habitId: water.id, date: '2026-10-03', value: 1 });
    const days = await api.calendar.range(TISHREI.firstDay, TISHREI.lastDay);
    expect(days.map((d) => [d.date, d.entryCount, d.habitsCompleted, d.habitsTotal])).toEqual([
      ['2026-09-20', 0, 1, 1],
      ['2026-10-03', 0, 1, 1],
    ]);
  });

  it('an entry uploaded from this device is counted once, whether a cached answer or the cached entries show it', async () => {
    await device();
    server.mode = 'down';
    await api.entries.create(entryInput('Covered', { date: '2026-09-20' }));
    await api.entries.create(entryInput('Open', { date: '2026-10-03' }));
    server.mode = 'online';
    await offline.drain();
    expect(offline.pending()).toHaveLength(0);
    // Read after the upload: September already holds "Covered", so its acknowledged create must not be added again.
    await tick();
    await api.calendar.month(2026, 9);
    server.mode = 'down';
    expect(lines(await api.calendar.range(TISHREI.firstDay, TISHREI.lastDay))).toEqual(['2026-09-20 1 Covered', '2026-10-03 1 Open']);
  });

  it('a Gregorian month never viewed counts an entry uploaded from this device once (its cached record and its journal entry are one entry)', async () => {
    await device();
    server.mode = 'down';
    await api.entries.create(entryInput('Uploaded', { date: '2026-10-03' }));
    server.mode = 'online';
    await offline.drain();
    expect(offline.pending()).toHaveLength(0);
    server.mode = 'down';
    const october = await api.calendar.month(2026, 10);
    expect(isPartialView(october)).toBe(true);
    expect(october.days[2]).toMatchObject({ date: '2026-10-03', hasEntry: true, entryCount: 1, titles: ['Uploaded'] });
  });

  it('days no cached calendar answer covers also come from the cached entry lists (the diary\'s list view), each entry once', async () => {
    const a = server.seedEntry(DANA, { title: 'List A', date: '2026-10-05', time: '08:00' });
    server.seedEntry(DANA, { title: 'List B', date: '2026-10-05', time: '09:00' });
    server.seedEntry(DANA, { title: 'List C', date: '2026-10-06' });
    await device();
    // Online the diary showed October as a list, and one of its entries was opened too.
    await api.entries.list({ from: '2026-10-01', to: '2026-10-31', limit: 500, sortDesc: false });
    await api.entries.get(a.id);
    server.mode = 'down';
    expect(lines(await api.calendar.range(TISHREI.firstDay, TISHREI.lastDay))).toEqual(['2026-10-05 2 List A+List B', '2026-10-06 1 List C']);
  });

  it('an entry list or a day view cached more than the journal\'s 7 days ago is not used (it may hold an entry deleted since)', async () => {
    const listed = server.seedEntry(DANA, { title: 'In a list', date: '2026-10-05' });
    const inDay = server.seedEntry(DANA, { title: 'In a day', date: '2026-10-06' });
    const { engine } = await device();
    const listUrl = withQuery('/api/entries', { from: '2026-10-01', to: '2026-10-31' });
    const dayUrl = `/api/entries/day/${inDay.date}`;
    const page: EntryPage = { items: [entryToSummary(listed)], total: 1 };
    const day: DaySummary = { date: inDay.date, entries: [inDay], habitLogs: [], moodAvg: null, energyAvg: null, stressAvg: null, sleepHours: null };
    /** Makes the cached row of `url` look `days` days older. */
    const age = async (url: string, days: number) => {
      const key = await engine.cache.keyOf(url);
      await engine.cache.store.tx(['cache'], 'readwrite', async (t) => {
        const row = await t.get('cache', key);
        if (row) await t.put('cache', { ...row, cachedAt: row.cachedAt - days * 86_400_000 });
      });
    };
    await engine.cache.put(listUrl, page);
    await engine.cache.put(dayUrl, day);
    server.mode = 'down';
    expect(lines(await api.calendar.range(TISHREI.firstDay, TISHREI.lastDay))).toEqual(['2026-10-05 1 In a list', '2026-10-06 1 In a day']);
    await age(listUrl, 8);
    await age(dayUrl, 8);
    expect(lines(await api.calendar.range(TISHREI.firstDay, TISHREI.lastDay))).toEqual([]);
  });

  it('an entry deleted from this device does not come back from an older cached day view', async () => {
    const gone = server.seedEntry(DANA, { title: 'Deleted later', date: '2026-10-03', time: '08:00' });
    server.seedEntry(DANA, { title: 'Stays', date: '2026-10-03', time: '09:00' });
    await device();
    await api.entries.day('2026-10-03'); // the cached day view holds both
    await api.entries.remove(gone.id); // online: acknowledged at once; the day view is not read again
    expect(offline.pending()).toHaveLength(0);
    server.mode = 'down';
    expect(lines(await api.calendar.range(TISHREI.firstDay, TISHREI.lastDay))).toEqual(['2026-10-03 1 Stays']);
  });

  it('of two cached answers that cover a day, the more recent one wins', async () => {
    const first = server.seedEntry(DANA, { title: 'First', date: '2026-09-15' });
    await device();
    await api.calendar.month(2026, 9); // knows "First"
    server.seedEntry(DANA, { title: 'Second', date: '2026-09-15' }); // written on another device
    await tick();
    await api.calendar.range('2026-01-01', '2026-12-31'); // the diary's year view, read later: knows both
    server.mode = 'down';
    expect(lines(await api.calendar.range(TISHREI.firstDay, TISHREI.lastDay))).toEqual(['2026-09-15 2 First+Second']);

    // Back online the month is read again after another device deleted "First": now the month is the newer answer.
    server.mode = 'online';
    await offline.drain();
    server.deleteEntry(DANA, first.id);
    await tick();
    await api.calendar.month(2026, 9);
    server.mode = 'down';
    expect(lines(await api.calendar.range(TISHREI.firstDay, TISHREI.lastDay))).toEqual(['2026-09-15 1 Second']);
  });

  it('the habit total of the reported past days goes to the past days known from entries and to the empty past days of a month; future days get 0', async () => {
    const today = todayIso();
    const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
    const { engine } = await device();
    // This test decides what is cached: the warm-up's current month goes, a range answer for today alone comes in
    // (as the server reports it: two active habits, one of them completed, one entry).
    await engine.cache.delete(withQuery('/api/calendar/month', { year: y, month: m }));
    const reported: CalendarDay = { date: today, mood: 6, energy: null, stress: null, sleepHours: null, hasEntry: true, entryCount: 1, habitsCompleted: 1, habitsTotal: 2, titles: ['Today'] };
    await engine.cache.put(withQuery('/api/calendar/range', { from: today, to: today }), [reported], today);
    const yesterday = server.seedEntry(DANA, { title: 'Yesterday', date: addDays(today, -1) });
    const tomorrow = server.seedEntry(DANA, { title: 'Tomorrow', date: addDays(today, 1) });
    await api.entries.get(yesterday.id);
    await api.entries.get(tomorrow.id);
    server.mode = 'down';

    const range = await api.calendar.range(addDays(today, -1), addDays(today, 1));
    expect(lines(range)).toEqual([`${addDays(today, -1)} 1 Yesterday`, `${today} 1 Today`, `${addDays(today, 1)} 1 Tomorrow`]);
    expect(range.map((d) => d.habitsTotal)).toEqual([2, 2, 0]);

    const month = await api.calendar.month(y, m);
    expect(isPartialView(month)).toBe(true);
    for (const d of month.days) expect([d.date, d.habitsTotal]).toEqual([d.date, d.date <= today ? 2 : 0]);
    expect(month.days.find((d) => d.date === today)).toMatchObject({ mood: 6, habitsCompleted: 1, habitsTotal: 2, titles: ['Today'] });
  });

  it('a month nothing is known of is an empty view marked partial; a window the server refuses stays "not saved yet"', async () => {
    await device();
    server.mode = 'down';
    const tishrei5745 = monthViewFor('hebrew', 5745, 1, 'en');
    const days = await api.calendar.range(tishrei5745.firstDay, tishrei5745.lastDay);
    expect(days).toEqual([]);
    expect(isPartialView(days)).toBe(true);
    const october1984 = await api.calendar.month(1984, 10);
    expect(isPartialView(october1984)).toBe(true);
    expect(october1984.days).toHaveLength(31);
    expect(october1984.days.every((d) => !d.hasEntry && d.entryCount === 0 && d.habitsTotal === 0 && d.titles.length === 0)).toBe(true);
    // Longer than the server answers (400 days): never put together.
    expect(await api.calendar.range('2025-01-01', '2026-12-31').catch((e: unknown) => e)).toBeInstanceOf(NotCachedError);
  });

  it('a range cached online is served as it was, not put together (and not marked partial)', async () => {
    server.seedEntry(DANA, { title: 'Server only', date: '2026-10-05', mood: 6 });
    await device();
    const online = await api.calendar.range(TISHREI.firstDay, TISHREI.lastDay);
    expect(lines(online)).toEqual(['2026-10-05 1 Server only']);
    server.mode = 'down';
    const cached = await api.calendar.range(TISHREI.firstDay, TISHREI.lastDay);
    expect(isPartialView(cached)).toBe(false);
    // The entry itself was never on the device: only the cached answer knows this day.
    expect(cached).toEqual(online);
  });

  it('online a range is the server\'s answer, cached as before (never put together)', async () => {
    server.seedEntry(DANA, { title: 'Online', date: '2026-09-20' });
    const { engine } = await device();
    const url = withQuery('/api/calendar/range', { from: TISHREI.firstDay, to: TISHREI.lastDay });
    const days = await api.calendar.range(TISHREI.firstDay, TISHREI.lastDay);
    expect(server.calls(url)).toHaveLength(1);
    expect(lines(days)).toEqual(['2026-09-20 1 Online']);
    expect(isPartialView(days)).toBe(false);
    expect((await engine.cache.get<CalendarDay[]>(url))?.value).toEqual(days);
    const september = await api.calendar.month(2026, 9);
    expect(server.calls('/api/calendar/month?year=2026&month=9')).toHaveLength(1);
    expect(isPartialView(september)).toBe(false);
    expect(september.days).toHaveLength(30);
  });

  it('the warm-up also caches today\'s month of the calendar this device shows, with the page\'s own request', async () => {
    window.localStorage.setItem(CALENDAR_SYSTEM_KEY, JSON.stringify('hebrew'));
    // What the calendar page asks for at a bare /calendar (calendar-years.ts resolveView with no year or month).
    const view = resolveView('hebrew', null, null, todayIso());
    const url = withQuery('/api/calendar/range', { from: view.firstDay, to: view.lastDay });
    const { engine } = await device();
    expect(server.calls('/api/calendar/range').map((r) => r.path)).toEqual([url]);
    // Right after the Gregorian month, before the entries.
    const paths = server.requests.map((r) => r.path);
    const at = (prefix: string) => paths.findIndex((p) => p.startsWith(prefix));
    expect(at('/api/calendar/month')).toBeGreaterThanOrEqual(0);
    expect(at('/api/calendar/month')).toBeLessThan(at(url));
    expect(at(url)).toBeLessThan(at('/api/entries?'));
    expect(await engine.cache.get(url)).not.toBeNull();
    server.mode = 'down';
    expect(isPartialView(await api.calendar.range(view.firstDay, view.lastDay))).toBe(false);
  });

  it('a failing range request of the warm-up does not stop the rest of it', async () => {
    window.localStorage.setItem(CALENDAR_SYSTEM_KEY, JSON.stringify('hijri'));
    server.failNext({ status: 500, pathPrefix: '/api/calendar/range' });
    await device(); // waits for the locations, which come after the range
    expect(server.calls('/api/calendar/range')).toHaveLength(1);
    for (const path of ['/api/entries?', '/api/entries/meta/tags', '/api/entries/meta/people', '/api/entries/meta/locations']) expect(server.calls(path)).toHaveLength(1);
  });

  it('a device on the Gregorian calendar warms only the Gregorian month, as before', async () => {
    await device();
    expect(server.calls('/api/calendar/range')).toHaveLength(0);
    expect(server.calls('/api/calendar/month')).toHaveLength(1);
  });

  it('a calendar answer cached more than the journal\'s 7 days ago no longer decides its days: an entry created since shows, one deleted since stays away', async () => {
    const trip = server.seedEntry(DANA, { title: 'Trip', date: '2026-03-04' });
    const { engine } = await device();
    // The diary's year view, read first: it knows "Trip" and nothing in August.
    await api.calendar.range('2026-01-01', '2026-12-31');
    await tick();
    // Then, online, this device writes an entry in August and deletes "Trip" (both acknowledged at once).
    await api.entries.create(entryInput('Created later', { date: '2026-08-20' }));
    await api.entries.get(trip.id);
    await api.entries.remove(trip.id);
    expect(offline.pending()).toHaveLength(0);
    server.mode = 'down';
    // Elul 5786: 14 August - 11 September 2026.
    const elul = monthViewContaining('hebrew', '2026-08-20', 'en');
    const shown = async () => ({
      august: (await api.calendar.month(2026, 8)).days[19],
      march: (await api.calendar.month(2026, 3)).days[3],
      hebrew: lines(await api.calendar.range(elul.firstDay, elul.lastDay)),
    });
    const expected = {
      august: expect.objectContaining({ date: '2026-08-20', hasEntry: true, entryCount: 1, titles: ['Created later'] }),
      march: expect.objectContaining({ date: '2026-03-04', hasEntry: false, entryCount: 0, titles: [] }),
      hebrew: ['2026-08-20 1 Created later'],
    };
    // Within the 7 days the journal lays both changes over the year answer.
    expect(await shown()).toEqual(expected);
    // Eight days on: the journal has forgotten both changes (`prune` at the next start) and the year answer is older
    // than that, so it no longer decides those days - the entries this device holds do.
    await ageCached(engine, withQuery('/api/calendar/range', { from: '2026-01-01', to: '2026-12-31' }), 8);
    engine.journal.forgetAll();
    expect(await shown()).toEqual(expected);
  });

  it('when no cached answer reports a past day, the past days take the habits this device knows as their total, as the server reports it', async () => {
    const today = todayIso();
    const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
    server.seedHabit(DANA, { name: 'Water', target: 1 });
    const old = server.seedHabit(DANA, { name: 'Old', target: 1 });
    server.diary(DANA).habits.set(old.id, { ...old, isArchived: true });
    const { engine } = await device();
    await engine.cache.delete(withQuery('/api/calendar/month', { year: y, month: m })); // this test decides what is cached
    server.mode = 'down';
    // October 2025: nothing cached covers it. Every day counts Water, never the archived habit (the server's habitsTotal).
    const october = await api.calendar.month(2025, 10);
    expect(isPartialView(october)).toBe(true);
    expect(october.days.map((d) => `${d.habitsCompleted}/${d.habitsTotal}`)).toEqual(Array.from({ length: 31 }, () => '0/1'));
    // A habit created offline and logged on a past day counts too, so that log shows.
    const read = await api.habits.create({ name: 'Read', description: '', target: 1, unit: '', frequency: 'daily', reminderTime: null, reminderEnabled: false });
    await api.habits.log({ habitId: read.id, date: '2025-10-05', value: 1 });
    const again = await api.calendar.month(2025, 10);
    expect(again.days[4]).toMatchObject({ date: '2025-10-05', habitsCompleted: 1, habitsTotal: 2 });
    expect(again.days[5]).toMatchObject({ date: '2025-10-06', habitsCompleted: 0, habitsTotal: 2 });
    // The Hebrew month around it (Tishrei 5786) lists the logged day with the same total.
    const tishrei5786 = monthViewFor('hebrew', 5786, 1, 'en');
    expect((await api.calendar.range(tishrei5786.firstDay, tishrei5786.lastDay)).map((d) => [d.date, d.habitsCompleted, d.habitsTotal])).toEqual([['2025-10-05', 1, 2]]);
    // The current month, not cached either: the past days and today count both habits, the future days 0.
    const current = await api.calendar.month(y, m);
    expect(current.days.map((d) => [d.date, d.habitsTotal])).toEqual(current.days.map((d) => [d.date, d.date <= today ? 2 : 0]));
  });

  it('a day the changes add to a cached range answer that listed no past day gets that habit total too', async () => {
    const water = server.seedHabit(DANA, { name: 'Water', target: 1 });
    await device();
    // The diary's year view: nothing written or logged yet, so the server lists no day (and no habit total).
    expect(await api.calendar.range('2026-01-01', '2026-12-31')).toEqual([]);
    server.mode = 'down';
    await api.habits.log({ habitId: water.id, date: '2026-09-20', value: 1 });
    const days = await api.calendar.range(TISHREI.firstDay, TISHREI.lastDay);
    expect(isPartialView(days)).toBe(true);
    expect(days.map((d) => [d.date, d.habitsCompleted, d.habitsTotal])).toEqual([['2026-09-20', 1, 1]]);
  });

  it('an acknowledged change does not move an entry back over an entry list read after it (another device moved it since)', async () => {
    const walk = server.seedEntry(DANA, { title: 'Walk', date: '2026-10-05' });
    await device();
    await api.entries.get(walk.id);
    await api.entries.update(walk.id, entryInput('Walk', { date: '2026-10-06' })); // online: acknowledged at once
    expect(offline.pending()).toHaveLength(0);
    await tick();
    server.editEntry(DANA, walk.id, { date: '2026-10-08' }); // another device moves it again
    await api.entries.list({ from: '2026-10-01', to: '2026-10-31' }); // read after both: on 8 October
    server.mode = 'down';
    expect(lines(await api.calendar.range(TISHREI.firstDay, TISHREI.lastDay))).toEqual(['2026-10-08 1 Walk']);
  });

  it('a window the server refuses is never put together: days that do not exist, a month outside 1970-2200', async () => {
    await device();
    server.mode = 'down';
    for (const [from, to] of [['2026-02-30', '2026-03-05'], ['2026-13-01', '2026-13-05'], ['2026-02-27', '2026-02-31']]) {
      expect(await api.calendar.range(from, to).catch((e: unknown) => e)).toBeInstanceOf(NotCachedError);
    }
    for (const [year, month] of [[1969, 12], [2201, 1], [2026, 13], [2026, 0]]) {
      expect(await api.calendar.month(year, month).catch((e: unknown) => e)).toBeInstanceOf(NotCachedError);
    }
    // The first and the last month the server answers are put together (empty here).
    for (const [year, month] of [[1970, 1], [2200, 12]]) {
      const view = await api.calendar.month(year, month);
      expect(isPartialView(view)).toBe(true);
      expect(view.days).toHaveLength(31);
    }
  });
});
