/**
 * End-to-end flow through the real HTTP app with the real auth service (scrypt, encrypted
 * vaults on a temporary data directory): accounts, entries, habits, demo data, insights,
 * statistics, calendar, search, exports, backup/restore, password change, logout and a
 * "restart" that resolves a remember-me token without the password.
 * Also unit-tests the LAN guard middleware with fake request/response objects.
 */
import type { NextFunction, Request, Response } from 'express';
import type { Response as SupertestResponse } from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { CalendarMonth, Entry, EntryPage, ExportFormat, Habit, HabitWithProgress, InsightsReport, SearchResult, StatsOverview } from '@shared/types';
import { ApiError } from '../src/errors';
import { isLoopbackAddress, lanGuard, markLocal } from '../src/middleware/access';
import { createAuthService } from '../src/security/auth-service';
import type { AuthService } from '../src/security/session-types';
import { addDays, daysInMonth, todayIso } from '../src/util/dates';
import { cleanupTempDirs, makeTestApp, sampleEntry, tempDataDir, testConfig, type TestApp } from './helpers';

const HEBREW = /[א-ת]/;
const PASSWORD = 'Passw0rd!';
const NEW_PASSWORD = 'NewPass123';
const services: AuthService[] = [];

afterAll(cleanupTempDirs);
afterEach(async () => {
  for (const s of services.splice(0)) await s.shutdown();
});

/** supertest parser that keeps the raw bytes (PDF / backup downloads). */
function binary(res: SupertestResponse, cb: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

function withToken(app: TestApp, token: string) {
  const authz = (t: ReturnType<TestApp['anon']>['get'] extends (u: string) => infer R ? R : never) => t.set('Authorization', `Bearer ${token}`);
  return {
    get: (url: string) => authz(app.anon().get(url)),
    post: (url: string, body?: object) => authz(app.anon().post(url)).send(body ?? {}),
    put: (url: string, body?: object) => authz(app.anon().put(url)).send(body ?? {}),
    postBinary: (url: string, body?: object) => authz(app.anon().post(url)).send(body ?? {}).buffer(true).parse(binary),
  };
}

const EXPORT_TYPES: Record<ExportFormat, string> = {
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  pdf: 'application/pdf',
};

describe('end-to-end flow', () => {
  it(
    'runs the whole product flow against the real auth service and encrypted vaults',
    async () => {
      const dataDir = tempDataDir();
      const config = testConfig(dataDir);
      const auth = await createAuthService(config);
      services.push(auth);
      const app = await makeTestApp({ auth, config });
      const today = todayIso();

      // 1. Register the first user with "remember me".
      const reg = await app.anon().post('/api/auth/register').send({
        firstName: 'דנה',
        lastName: 'כהן',
        username: 'dana',
        email: 'dana@example.com',
        password: PASSWORD,
        confirmPassword: PASSWORD,
        rememberMe: true,
        deviceName: 'מחשב',
      });
      expect(reg.status).toBe(201);
      expect(reg.body.rememberMe).toBe(true);
      expect(reg.body.user).toMatchObject({ username: 'dana', firstName: 'דנה' });
      const tokenA: string = reg.body.token;
      const dana = withToken(app, tokenA);

      // 2. Three entries.
      const dates = [today, addDays(today, -1), addDays(today, -2)];
      for (const [i, date] of dates.entries()) {
        const res = await dana.post('/api/entries', sampleEntry({ date, title: `רשומה ${i + 1}`, mood: 6 + i }));
        expect(res.status).toBe(201);
        expect((res.body as Entry).date).toBe(date);
      }
      expect(((await dana.get('/api/entries')).body as EntryPage).total).toBe(3);

      // 3. A habit with a log for today.
      const habitRes = await dana.post('/api/habits', {
        name: 'שתיית מים',
        description: '',
        target: 8,
        unit: 'כוסות',
        frequency: 'daily',
        reminderTime: null,
        reminderEnabled: false,
      });
      expect(habitRes.status).toBe(201);
      const habit = habitRes.body as Habit;
      const log = await dana.put('/api/habits/logs', { habitId: habit.id, date: today, value: 8 });
      expect(log.status).toBe(200);
      expect(log.body.completed).toBe(true);
      const progress = (await dana.get('/api/habits/progress')).body as HabitWithProgress[];
      expect(progress).toHaveLength(1);
      expect(progress[0].targetMet).toBe(true);

      // 4. Demo data is refused once the diary has content.
      const seedRefused = await dana.post('/api/settings/seed-demo', {}).set('Accept-Language', 'he');
      expect([400, 409]).toContain(seedRefused.status);
      expect(seedRefused.body.code).toBe('VALIDATION');
      expect(seedRefused.body.message).toMatch(HEBREW);
      expect(((await dana.get('/api/entries')).body as EntryPage).total).toBe(3);

      // 5. A second user gets the demo diary.
      const reg2 = await app.anon().post('/api/auth/register').send({
        firstName: 'רון',
        lastName: 'לוי',
        username: 'ron',
        email: 'ron@example.com',
        password: PASSWORD,
        confirmPassword: PASSWORD,
      });
      expect(reg2.status).toBe(201);
      const ron = withToken(app, reg2.body.token as string);
      const seeded = await ron.post('/api/settings/seed-demo', { days: 120 });
      expect(seeded.status).toBe(200);
      expect(seeded.body.habits).toBe(5);
      expect(seeded.body.entries).toBeGreaterThan(80);
      const seededEntries: number = seeded.body.entries;
      expect(((await ron.get('/api/entries')).body as EntryPage).total).toBe(seededEntries);
      // The demo never leaks into the other account.
      expect(((await dana.get('/api/entries')).body as EntryPage).total).toBe(3);

      // 6. Insights over the last 30 days.
      const insightsRes = await ron.get('/api/insights?period=30d');
      expect(insightsRes.status).toBe(200);
      const report = insightsRes.body as InsightsReport;
      expect(report.provider).toBe('rules-v1');
      expect(report.period).toBe('30d');
      expect(report.periodEnd).toBe(today);
      expect(report.daysWithData).toBeGreaterThanOrEqual(20);
      expect(report.insights.length).toBeGreaterThanOrEqual(3);
      for (const insight of report.insights) {
        expect(['weak', 'moderate', 'strong']).toContain(insight.strength);
        expect(insight.text).toMatch(HEBREW);
        expect(insight.explanation).toMatch(HEBREW);
        expect(insight.text).not.toMatch(/גורם|בגלל|מוביל ל/);
      }
      expect((await ron.get('/api/insights?period=2w')).status).toBe(400);

      // 7. Statistics: one point per day.
      const stats = (await ron.get('/api/stats?period=30d')).body as StatsOverview;
      expect(stats.mood.points).toHaveLength(30);
      expect(stats.entriesPerDay.points.every((p) => p.value !== null)).toBe(true);
      expect(stats.habits).toHaveLength(5);
      expect(stats.totalEntries).toBeGreaterThan(15);
      expect(((await ron.get('/api/stats?period=7d')).body as StatsOverview).mood.points).toHaveLength(7);

      // 8. Calendar of the current month.
      const [year, month] = today.split('-').map(Number);
      const calendar = (await ron.get(`/api/calendar/month?year=${year}&month=${month}`)).body as CalendarMonth;
      expect(calendar.days).toHaveLength(daysInMonth(year, month));
      expect(calendar.days.every((d) => d.habitsTotal === (d.date > today ? 0 : 5))).toBe(true);
      // Entries are looked up in the month of a seeded entry, not in "the current month": on the 1st
      // of a month the only day so far is today, and the seeder creates no entry later than now (none
      // from the future) - so the current month may rightly be empty then. See 'calendar on the 1st of
      // a month' below.
      const newest = ((await ron.get('/api/entries')).body as EntryPage).items[0];
      expect(newest.date <= today).toBe(true);
      const [entryYear, entryMonth] = newest.date.split('-').map(Number);
      const entryCalendar = (await ron.get(`/api/calendar/month?year=${entryYear}&month=${entryMonth}`)).body as CalendarMonth;
      expect(entryCalendar.days).toHaveLength(daysInMonth(entryYear, entryMonth));
      expect(entryCalendar.days.find((d) => d.date === newest.date)).toMatchObject({ hasEntry: true });
      expect(entryCalendar.days.filter((d) => d.date > today).every((d) => !d.hasEntry)).toBe(true);

      // 9. Three smart-search questions.
      const best = (await ron.post('/api/search', { query: 'אילו ימים בחודש האחרון הרגשתי הכי טוב?' })).body as SearchResult;
      expect(best.parsed.intent).toBe('best_days');
      expect(best.days.length).toBeGreaterThan(0);
      expect(best.answer).toMatch(HEBREW);
      const tired = (await ron.post('/api/search', { query: 'מתי כתבתי שאני עייף?' })).body as SearchResult;
      expect(tired.parsed).toMatchObject({ intent: 'text_mention', textTerms: ['עייף'] });
      expect(tired.answer).toMatch(HEBREW);
      const sleep = (await ron.post('/api/search', { query: 'באילו ימים ישנתי פחות מחמש שעות?' })).body as SearchResult;
      expect(sleep.parsed).toMatchObject({ intent: 'metric_filter', metric: 'sleepHours', comparator: 'lt', threshold: 5 });
      expect(sleep.totalMatches).toBeGreaterThan(0);
      expect(sleep.days.every((d) => d.sleepHours !== null && d.sleepHours < 5)).toBe(true);

      // 10. Export in all four formats as downloads.
      for (const format of Object.keys(EXPORT_TYPES) as ExportFormat[]) {
        const res = await ron.postBinary('/api/export', { format, includeHabits: true });
        expect(res.status, format).toBe(200);
        expect(String(res.headers['content-type'])).toContain(EXPORT_TYPES[format]);
        expect(String(res.headers['content-disposition'])).toMatch(new RegExp(`^attachment; filename="your-personal-diary-ron-.*\\.${format}"`));
        expect(res.headers['x-entries-exported']).toBe(String(seededEntries));
        const bytes = res.body as Buffer;
        expect(bytes.length).toBe(Number(res.headers['content-length']));
        if (format === 'pdf') expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
        if (format === 'csv') expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
        if (format === 'json') expect(JSON.parse(bytes.toString('utf8')).entries).toHaveLength(seededEntries);
        if (format === 'txt') expect(bytes.toString('utf8')).toContain('מספר רשומות');
      }

      // 11. Backup download for the first user, then restore it with the account password.
      const backup = await dana.postBinary('/api/backup/create', {});
      expect(backup.status).toBe(200);
      expect(backup.headers['content-type']).toBe('application/octet-stream');
      expect(String(backup.headers['content-disposition'])).toContain('your-personal-diary-backup-dana-');
      const backupBytes = backup.body as Buffer;
      expect(backupBytes.subarray(0, 8).toString('latin1')).toBe('MPDIARY\x01');
      const inspected = await dana.post('/api/backup/inspect', { fileBase64: backupBytes.toString('base64'), fileName: 'b.mpd' });
      expect(inspected.body.valid).toBe(true);
      const wrongPw = await dana.post('/api/backup/restore', { fileBase64: backupBytes.toString('base64'), password: 'Nope12345' });
      expect(wrongPw.status).toBe(400);
      expect(wrongPw.body.code).toBe('WRONG_PASSWORD');
      const restored = await dana.post('/api/backup/restore', { fileBase64: backupBytes.toString('base64'), password: PASSWORD });
      expect(restored.status).toBe(200);
      expect(restored.body).toMatchObject({ entries: 3, habits: 1 });
      expect(((await dana.get('/api/entries')).body as EntryPage).total).toBe(3);
      expect(((await dana.get('/api/habits')).body as Habit[]).map((h) => h.name)).toEqual(['שתיית מים']);

      // 12. Change the password: the new one logs in, the old one does not.
      const changed = await dana.post('/api/auth/change-password', { oldPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
      expect(changed.status).toBe(200);
      expect(changed.body).toEqual({ ok: true });
      const oldLogin = await app.anon().post('/api/auth/login').send({ username: 'dana', password: PASSWORD });
      expect(oldLogin.status).toBe(401);
      expect(oldLogin.body.code).toBe('WRONG_PASSWORD');
      const newLogin = await app.anon().post('/api/auth/login').send({ username: 'dana', password: NEW_PASSWORD, rememberMe: true, deviceName: 'טלפון' });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.rememberMe).toBe(true);
      const rememberedToken: string = newLogin.body.token;
      expect(((await withToken(app, rememberedToken).get('/api/entries')).body as EntryPage).total).toBe(3);

      // 13. Logout of the original session; its token is dead, the remembered one lives on.
      expect((await dana.post('/api/auth/logout')).status).toBe(204);
      const afterLogout = await dana.get('/api/auth/me');
      expect(afterLogout.status).toBe(401);
      expect(afterLogout.body.code).toBe('SESSION_EXPIRED');
      expect((await dana.get('/api/entries')).status).toBe(401);
      expect((await withToken(app, rememberedToken).get('/api/auth/me')).status).toBe(200);

      // 14. "Restart": a fresh auth service on the same data directory opens the diary with the
      //     remembered token only - no password involved.
      await auth.shutdown();
      services.splice(services.indexOf(auth), 1);
      const restarted = await createAuthService(testConfig(dataDir));
      services.push(restarted);
      expect(await restarted.authenticate(tokenA)).toBeNull();
      const ctx = await restarted.authenticate(rememberedToken);
      expect(ctx).not.toBeNull();
      expect(ctx!.user.username).toBe('dana');
      expect(ctx!.session.rememberMe).toBe(true);
      expect(Number(ctx!.db.scalar('SELECT COUNT(*) FROM entries'))).toBe(3);
      const app2 = await makeTestApp({ auth: restarted, config: testConfig(dataDir) });
      const me = await withToken(app2, rememberedToken).get('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.session).toMatchObject({ deviceName: 'טלפון', rememberMe: true, current: true });
      expect(((await withToken(app2, rememberedToken).get('/api/entries')).body as EntryPage).items.map((e) => e.title).sort()).toEqual(['רשומה 1', 'רשומה 2', 'רשומה 3']);
    },
    120_000,
  );
});

/**
 * Step 8 of the flow above used to assume that the calendar of the CURRENT month already shows a
 * demo entry. On the 1st of a month that is not true: the only day so far is today, and the seeder
 * creates no entry later than now (no demo entry from the future) - the whole suite went red on
 * every 1st. The clock is pinned here (only `Date` is faked, timers stay real) so the case is
 * covered on every day of the year.
 */
describe('calendar on the 1st of a month', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function seededApp(now: Date) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    const app = await makeTestApp();
    const seeded = await app.post('/api/settings/seed-demo', { days: 120 });
    expect(seeded.status).toBe(200);
    expect(seeded.body.entries).toBeGreaterThan(80);
    return app;
  }

  it('just after midnight the current month has no demo entry yet - the month of the newest entry has', async () => {
    const app = await seededApp(new Date(2026, 10, 1, 0, 5, 0));
    const today = todayIso();
    expect(today).toBe('2026-11-01');

    // Nothing from the future: no entry of today (they would all be later than 00:05), none after it.
    expect(Number(app.db.scalar('SELECT COUNT(*) FROM entries WHERE date >= ?', [today]))).toBe(0);
    const current = (await app.get('/api/calendar/month?year=2026&month=11')).body as CalendarMonth;
    expect(current.days).toHaveLength(daysInMonth(2026, 11));
    // The old assumption of step 8 - false on this date, and rightly so.
    expect(current.days.some((d) => d.hasEntry)).toBe(false);

    // What step 8 checks now holds here too: the month of a seeded entry shows that entry.
    const newest = ((await app.get('/api/entries')).body as EntryPage).items[0];
    expect(newest.date < today).toBe(true);
    const [year, month] = newest.date.split('-').map(Number);
    expect([year, month]).toEqual([2026, 10]);
    const previous = (await app.get(`/api/calendar/month?year=${year}&month=${month}`)).body as CalendarMonth;
    expect(previous.days).toHaveLength(daysInMonth(year, month));
    expect(previous.days.find((d) => d.date === newest.date)).toMatchObject({ hasEntry: true });
    expect(previous.days.filter((d) => d.hasEntry).length).toBeGreaterThan(15);
  });

  it('in the middle of a month the current month shows the demo entries, and never a future one', async () => {
    const app = await seededApp(new Date(2026, 10, 15, 23, 59, 0));
    const today = todayIso();
    expect(today).toBe('2026-11-15');
    const current = (await app.get('/api/calendar/month?year=2026&month=11')).body as CalendarMonth;
    expect(current.days.filter((d) => d.hasEntry).length).toBeGreaterThan(5);
    expect(current.days.filter((d) => d.date > today).every((d) => !d.hasEntry)).toBe(true);
    expect(Number(app.db.scalar('SELECT COUNT(*) FROM entries WHERE date > ?', [today]))).toBe(0);
  });
});

describe('lanGuard middleware', () => {
  interface FakeRes {
    statusCode: number;
    contentType: string;
    body: string;
    status(code: number): FakeRes;
    type(t: string): FakeRes;
    send(body: string): FakeRes;
  }

  function fakeRes(): FakeRes {
    const res: FakeRes = {
      statusCode: 0,
      contentType: '',
      body: '',
      status(code) {
        res.statusCode = code;
        return res;
      },
      type(t) {
        res.contentType = t;
        return res;
      },
      send(body) {
        res.body = body;
        return res;
      },
    };
    return res;
  }

  /** Records every `next(...)` call (Express' overloaded NextFunction type does not accept vi.fn). */
  function nextSpy(): { calls: unknown[][]; fn: NextFunction } {
    const calls: unknown[][] = [];
    const fn = ((...args: unknown[]) => {
      calls.push(args);
    }) as unknown as NextFunction;
    return { calls, fn };
  }

  function run(isLocal: boolean, lanEnabled: boolean, path: string) {
    const req = { isLocal, path } as unknown as Request;
    const res = fakeRes();
    const next = nextSpy();
    lanGuard(() => lanEnabled)(req, res as unknown as Response, next.fn);
    return { res, calls: next.calls };
  }

  it('rejects API requests from the network with 403 LAN_DISABLED while LAN access is off', () => {
    const { res, calls } = run(false, false, '/api/entries');
    expect(calls).toHaveLength(1);
    const err = calls[0][0] as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe('LAN_DISABLED');
    expect(err.messageFor('he')).toMatch(HEBREW);
    expect(res.statusCode).toBe(0); // nothing was sent directly
  });

  it('answers non-API requests from the network with an HTML page in the request language (English by default)', () => {
    const { res, calls } = run(false, false, '/');
    expect(calls).toHaveLength(0);
    expect(res.statusCode).toBe(403);
    expect(res.contentType).toBe('text/html; charset=utf-8');
    expect(res.body).toContain('<html lang="en" dir="ltr">');
    expect(res.body).toContain('Network access is off');
    expect(run(false, false, '/settings').res.statusCode).toBe(403);
  });

  it('always lets loopback requests through', () => {
    for (const path of ['/api/entries', '/', '/settings']) {
      const { res, calls } = run(true, false, path);
      expect(calls).toEqual([[]]);
      expect(res.statusCode).toBe(0);
    }
  });

  it('lets network requests through once LAN access is enabled, reading the flag per request', () => {
    let enabled = false;
    const guard = lanGuard(() => enabled);
    const blocked = nextSpy();
    guard({ isLocal: false, path: '/api/home' } as unknown as Request, fakeRes() as unknown as Response, blocked.fn);
    expect((blocked.calls[0][0] as ApiError).code).toBe('LAN_DISABLED');
    enabled = true;
    const allowed = nextSpy();
    guard({ isLocal: false, path: '/api/home' } as unknown as Request, fakeRes() as unknown as Response, allowed.fn);
    expect(allowed.calls).toEqual([[]]);
    const page = fakeRes();
    const allowedPage = nextSpy();
    guard({ isLocal: false, path: '/' } as unknown as Request, page as unknown as Response, allowedPage.fn);
    expect(allowedPage.calls).toEqual([[]]);
    expect(page.statusCode).toBe(0);
  });

  it('recognises loopback addresses and marks requests by their socket address', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('::1')).toBe(true);
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('127.8.9.10')).toBe(true);
    expect(isLoopbackAddress('192.168.1.10')).toBe(false);
    expect(isLoopbackAddress('10.0.0.1')).toBe(false);
    expect(isLoopbackAddress('')).toBe(false);
    expect(isLoopbackAddress(undefined)).toBe(false);

    const local = { socket: { remoteAddress: '::1' } } as unknown as Request;
    const next = nextSpy();
    markLocal(local, {} as Response, next.fn);
    expect(local.isLocal).toBe(true);
    expect(next.calls).toEqual([[]]);
    const remote = { socket: { remoteAddress: '192.168.1.10' } } as unknown as Request;
    markLocal(remote, {} as Response, nextSpy().fn);
    expect(remote.isLocal).toBe(false);
  });
});
