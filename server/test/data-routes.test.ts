import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HABIT_TEMPLATES } from '@shared/constants';
import type { DaySummary, DueReminder, Entry, EntryPage, Habit, HabitLog, HabitWithProgress } from '@shared/types';
import { DEFAULT_SETTINGS } from '../src/db/settings-repo';
import { encryptionSummary } from '../src/routes/settings';
import { REMINDER_GRACE_MINUTES, reminderDueAt } from '../src/routes/habits';
import { todayIso } from '../src/util/dates';
import { cleanupTempDirs, makeTestApp, sampleEntry, type TestApp } from './helpers';

const HEBREW = /[א-ת]/;

afterAll(() => cleanupTempDirs());

describe('/api/entries', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await makeTestApp();
  });

  it('requires authentication', async () => {
    const res = await t.anon().get('/api/entries');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('creates (201), reads, updates and deletes (204) an entry', async () => {
    const created = await t.post('/api/entries', sampleEntry({ tags: ['#עבודה', 'ספורט'] }));
    expect(created.status).toBe(201);
    const entry = created.body as Entry;
    expect(entry.id).toBeGreaterThan(0);
    expect(entry.tags).toEqual(['עבודה', 'ספורט']);

    const got = await t.get(`/api/entries/${entry.id}`);
    expect(got.status).toBe(200);
    expect(got.body).toEqual(entry);

    const put = await t.put(`/api/entries/${entry.id}`, sampleEntry({ title: 'עודכן', mood: 9 }));
    expect(put.status).toBe(200);
    expect(put.body.title).toBe('עודכן');
    expect(put.body.mood).toBe(9);

    const del = await t.del(`/api/entries/${entry.id}`);
    expect(del.status).toBe(204);
    expect(del.text).toBe('');
    expect((await t.get(`/api/entries/${entry.id}`)).status).toBe(404);
    expect((await t.del(`/api/entries/${entry.id}`)).status).toBe(404);
  });

  it('returns 404 NOT_FOUND for unknown ids and 400 for malformed ids', async () => {
    const missing = await t.get('/api/entries/12345').set('Accept-Language', 'he');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('NOT_FOUND');
    expect(missing.body.message).toMatch(HEBREW);

    const bad = await t.get('/api/entries/abc');
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({ code: 'VALIDATION', field: 'id' });
    expect((await t.put('/api/entries/-1', sampleEntry())).status).toBe(400);
  });

  it('returns 400 VALIDATION with the field name for bad input', async () => {
    const res = await t.post('/api/entries', sampleEntry({ mood: 42 })).set('Accept-Language', 'he');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION', field: 'mood' });
    expect(res.body.message).toMatch(HEBREW);
    const time = await t.post('/api/entries', sampleEntry({ time: '9:5' }));
    expect(time.body.field).toBe('time');
  });

  it('returns 400 for a malformed JSON body', async () => {
    const res = await t.post('/api/entries').set('Content-Type', 'application/json').send('{"date": ');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
  });

  it('lists with query filters, pagination and sorting', async () => {
    await t.post('/api/entries', sampleEntry({ date: '2026-09-01', time: '08:00', title: 'א', tags: ['עבודה'], emotions: ['happy'] }));
    await t.post('/api/entries', sampleEntry({ date: '2026-09-02', time: '08:00', title: 'ב', tags: ['משפחה'], emotions: ['calm'], body: 'טיול 50% הנחה' }));
    await t.post('/api/entries', sampleEntry({ date: '2026-09-03', time: '08:00', title: 'ג', tags: ['עבודה'], emotions: ['happy'] }));

    const all = await t.get('/api/entries');
    expect(all.status).toBe(200);
    const page = all.body as EntryPage;
    expect(page.total).toBe(3);
    expect(page.items.map((e) => e.title)).toEqual(['ג', 'ב', 'א']);

    const asc = (await t.get('/api/entries?sortDesc=false&limit=2&offset=1')).body as EntryPage;
    expect(asc.total).toBe(3);
    expect(asc.items.map((e) => e.title)).toEqual(['ב', 'ג']);

    expect(((await t.get('/api/entries?tag=%23עבודה')).body as EntryPage).total).toBe(2);
    expect(((await t.get('/api/entries?emotion=calm')).body as EntryPage).items[0].title).toBe('ב');
    expect(((await t.get('/api/entries?text=50%25')).body as EntryPage).total).toBe(1);
    expect(((await t.get('/api/entries?from=2026-09-02&to=2026-09-02')).body as EntryPage).total).toBe(1);
  });

  it('rejects malformed query parameters', async () => {
    expect((await t.get('/api/entries?sortDesc=maybe')).body).toMatchObject({ code: 'VALIDATION', field: 'sortDesc' });
    expect((await t.get('/api/entries?limit=ten')).body).toMatchObject({ code: 'VALIDATION', field: 'limit' });
    expect((await t.get('/api/entries?from=yesterday')).body).toMatchObject({ code: 'VALIDATION', field: 'from' });
    expect((await t.get('/api/entries?emotion=joyful')).body).toMatchObject({ code: 'VALIDATION', field: 'emotion' });
  });

  it('serves day summaries and meta lists before the /:id route', async () => {
    await t.post('/api/entries', sampleEntry({ date: '2026-09-07', time: '21:00', mood: 8, people: ['דנה'], location: 'בית' }));
    await t.post('/api/entries', sampleEntry({ date: '2026-09-07', time: '09:00', mood: 4, people: ['יוסי', 'דנה'], location: 'משרד' }));

    const day = await t.get('/api/entries/day/2026-09-07');
    expect(day.status).toBe(200);
    const summary = day.body as DaySummary;
    expect(summary.entries.map((e) => e.time)).toEqual(['09:00', '21:00']);
    expect(summary.moodAvg).toBe(6);
    expect(summary.habitLogs).toEqual([]);
    expect((await t.get('/api/entries/day/2026-13-01')).body).toMatchObject({ code: 'VALIDATION', field: 'date' });

    expect((await t.get('/api/entries/meta/tags')).body).toEqual([{ name: 'עבודה', count: 2 }]);
    expect((await t.get('/api/entries/meta/people')).body).toEqual([
      { name: 'דנה', count: 2 },
      { name: 'יוסי', count: 1 },
    ]);
    expect((await t.get('/api/entries/meta/locations')).body).toEqual([
      { name: 'בית', count: 1 },
      { name: 'משרד', count: 1 },
    ]);
  });
});

describe('/api/habits', () => {
  let t: TestApp;
  const habitBody = (over: Record<string, unknown> = {}) => ({
    name: 'שתיית מים',
    description: '',
    target: 8,
    unit: 'כוסות',
    frequency: 'daily',
    reminderTime: null,
    reminderEnabled: false,
    ...over,
  });

  beforeEach(async () => {
    t = await makeTestApp();
  });

  it('serves the templates', async () => {
    const res = await t.get('/api/habits/templates');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(HABIT_TEMPLATES);
  });

  it('creates, updates, archives, reorders and deletes habits', async () => {
    const a = (await t.post('/api/habits', habitBody({ name: 'א' }))).body as Habit;
    const created = await t.post('/api/habits', habitBody({ name: 'ב' }));
    expect(created.status).toBe(201);
    const b = created.body as Habit;

    expect(((await t.get('/api/habits')).body as Habit[]).map((h) => h.name)).toEqual(['א', 'ב']);

    const put = await t.put(`/api/habits/${a.id}`, habitBody({ name: 'א2', target: 5 }));
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ id: a.id, name: 'א2', target: 5 });

    const archived = await t.patch(`/api/habits/${b.id}/archive`, { archived: true });
    expect(archived.status).toBe(200);
    expect(archived.body.isArchived).toBe(true);
    expect(((await t.get('/api/habits')).body as Habit[]).map((h) => h.id)).toEqual([a.id]);
    expect(((await t.get('/api/habits?includeArchived=true')).body as Habit[]).map((h) => h.id)).toEqual([a.id, b.id]);
    expect((await t.patch(`/api/habits/${b.id}/archive`, { archived: 'yes' })).body).toMatchObject({ code: 'VALIDATION', field: 'archived' });

    const reordered = await t.put('/api/habits/reorder', { ids: [b.id, a.id] });
    expect(reordered.status).toBe(200);
    expect((reordered.body as Habit[]).map((h) => h.id)).toEqual([b.id, a.id]);
    expect((await t.put('/api/habits/reorder', { ids: 'x' })).body).toMatchObject({ code: 'VALIDATION', field: 'ids' });

    expect((await t.del(`/api/habits/${a.id}`)).status).toBe(204);
    expect((await t.del(`/api/habits/${a.id}`)).status).toBe(404);
    expect((await t.get(`/api/habits/${a.id}/logs`)).status).toBe(404);
    expect((await t.put('/api/habits/abc', habitBody())).body).toMatchObject({ code: 'VALIDATION', field: 'id' });
  });

  it('validates habit input with field names', async () => {
    const res = await t.post('/api/habits', habitBody({ name: '' })).set('Accept-Language', 'he');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION', field: 'name' });
    expect(res.body.message).toMatch(HEBREW);
    expect((await t.post('/api/habits', habitBody({ frequency: 'yearly' }))).body.field).toBe('frequency');
  });

  it('upserts logs, lists them, reports status/progress and deletes a log', async () => {
    const h = (await t.post('/api/habits', habitBody())).body as Habit;
    const today = todayIso();

    const first = await t.put('/api/habits/logs', { habitId: h.id, date: today, value: 3 });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ habitId: h.id, date: today, value: 3, completed: false });
    const second = await t.put('/api/habits/logs', { habitId: h.id, date: today, value: 8, note: 'הצלחתי' });
    expect(second.body).toMatchObject({ id: (first.body as HabitLog).id, value: 8, completed: true, note: 'הצלחתי' });
    expect((await t.put('/api/habits/logs', { habitId: h.id, date: today, value: -1 })).body).toMatchObject({ code: 'VALIDATION', field: 'value' });
    expect((await t.put('/api/habits/logs', { habitId: 999, date: today, value: 1 })).status).toBe(404);

    const logs = await t.get(`/api/habits/${h.id}/logs?from=${today}&to=${today}`);
    expect(logs.status).toBe(200);
    expect(logs.body).toHaveLength(1);
    expect((await t.get(`/api/habits/${h.id}/logs?from=bad`)).body).toMatchObject({ code: 'VALIDATION', field: 'from' });

    const status = await t.get(`/api/habits/status?from=${today}&to=${today}`);
    expect(status.body).toEqual([{ habitId: h.id, habitName: 'שתיית מים', date: today, value: 8, completed: true }]);
    expect((await t.get('/api/habits/status')).body).toHaveLength(1);
    expect((await t.get('/api/habits/status?from=2026-09-10&to=2026-09-01')).body).toMatchObject({ code: 'VALIDATION', field: 'from' });

    const progress = await t.get(`/api/habits/progress?date=${today}`);
    expect(progress.status).toBe(200);
    const [p] = progress.body as HabitWithProgress[];
    expect(p.habit.id).toBe(h.id);
    expect(p.today?.value).toBe(8);
    expect(p.targetMet).toBe(true);
    expect(p.currentStreak).toBe(1);
    expect(((await t.get('/api/habits/progress')).body as HabitWithProgress[])[0].targetMet).toBe(true);
    expect((await t.get('/api/habits/progress?date=today')).body).toMatchObject({ code: 'VALIDATION', field: 'date' });

    expect((await t.del(`/api/habits/${h.id}/logs/${today}`)).status).toBe(204);
    expect((await t.del(`/api/habits/${h.id}/logs/${today}`)).status).toBe(404);
    expect((await t.del(`/api/habits/${h.id}/logs/not-a-date`)).body).toMatchObject({ code: 'VALIDATION', field: 'date' });
  });

  it('returns each due reminder once per day per session', async () => {
    const water = (await t.post('/api/habits', habitBody({ reminderTime: '09:00', reminderEnabled: true }))).body as Habit;
    await t.post('/api/habits', habitBody({ name: 'קריאה', reminderTime: '21:00', reminderEnabled: true }));
    await t.post('/api/habits', habitBody({ name: 'ללא תזכורת', reminderTime: '09:00', reminderEnabled: false }));

    const first = await t.get('/api/habits/reminders/due?now=09:00').set('Accept-Language', 'he');
    expect(first.status).toBe(200);
    const due = first.body as DueReminder[];
    expect(due).toHaveLength(1);
    expect(due[0]).toEqual({
      habitId: water.id,
      habitName: 'שתיית מים',
      reminderTime: '09:00',
      message: 'תזכורת: הגיע הזמן ל"שתיית מים"',
    });

    // Same session, same day -> already notified.
    expect((await t.get('/api/habits/reminders/due?now=09:00')).body).toEqual([]);
    // Other times are not due.
    expect((await t.get('/api/habits/reminders/due?now=09:01')).body).toEqual([]);
    expect((await t.get('/api/habits/reminders/due?now=9am')).body).toMatchObject({ code: 'VALIDATION', field: 'now' });

    // A habit already logged today is never reminded.
    const reading = ((await t.get('/api/habits')).body as Habit[]).find((h) => h.name === 'קריאה')!;
    await t.put('/api/habits/logs', { habitId: reading.id, date: todayIso(), value: 20 });
    expect((await t.get('/api/habits/reminders/due?now=21:00')).body).toEqual([]);

    // Reminders can be switched off globally.
    const other = (await t.post('/api/habits', habitBody({ name: 'מדיטציה', reminderTime: '12:00', reminderEnabled: true }))).body as Habit;
    await t.put('/api/settings', { remindersEnabled: false });
    expect((await t.get('/api/habits/reminders/due?now=12:00')).body).toEqual([]);
    await t.put('/api/settings', { remindersEnabled: true });
    expect(((await t.get('/api/habits/reminders/due?now=12:00')).body as DueReminder[]).map((d) => d.habitId)).toEqual([other.id]);

    // Archived habits are skipped.
    const late = (await t.post('/api/habits', habitBody({ name: 'ארכיון', reminderTime: '13:00', reminderEnabled: true }))).body as Habit;
    await t.patch(`/api/habits/${late.id}/archive`, { archived: true });
    expect((await t.get('/api/habits/reminders/due?now=13:00')).body).toEqual([]);
  });

  it('still delivers a reminder whose exact minute the poll missed, within the grace window', async () => {
    // e.g. saved at 09:00:50 for 09:00 after the page had already polled at 09:00:20.
    const walk = (await t.post('/api/habits', habitBody({ name: 'הליכה', reminderTime: '09:00', reminderEnabled: true }))).body as Habit;
    const early = (await t.post('/api/habits', habitBody({ name: 'מוקדם', reminderTime: '08:40', reminderEnabled: true }))).body as Habit;

    // Never before its time.
    expect((await t.get('/api/habits/reminders/due?now=08:59')).body.map((d: DueReminder) => d.habitId)).toEqual([]);
    // One minute late: delivered, once.
    expect((await t.get('/api/habits/reminders/due?now=09:01')).body.map((d: DueReminder) => d.habitId)).toEqual([walk.id]);
    expect((await t.get('/api/habits/reminders/due?now=09:02')).body).toEqual([]);
    // Past the grace window a missed reminder is dropped (08:40 at 09:02 is 22 minutes late).
    expect(REMINDER_GRACE_MINUTES).toBeLessThan(22);
    expect((await t.get('/api/habits/reminders/due?now=09:02')).body.some((d: DueReminder) => d.habitId === early.id)).toBe(false);

    expect(reminderDueAt('09:00', '09:00')).toBe(true);
    expect(reminderDueAt('09:00', `09:0${REMINDER_GRACE_MINUTES - 1}`)).toBe(true);
    expect(reminderDueAt('09:00', `09:${String(REMINDER_GRACE_MINUTES).padStart(2, '0')}`)).toBe(false);
    expect(reminderDueAt('23:58', '00:03')).toBe(false);
  });

  it('accepts a request without ?now (uses the current time)', async () => {
    const res = await t.get('/api/habits/reminders/due');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('/api/settings', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await makeTestApp();
  });

  it('returns defaults and merges partial updates', async () => {
    expect((await t.get('/api/settings')).body).toEqual(DEFAULT_SETTINGS);
    const put = await t.put('/api/settings', { theme: 'dark', fontScale: 1.5 });
    expect(put.status).toBe(200);
    expect(put.body).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark', fontScale: 1.5 });
    expect((await t.get('/api/settings')).body).toEqual(put.body);
  });

  it('rejects invalid settings with the field name', async () => {
    const res = await t.put('/api/settings', { autoLockMinutes: 5000 }).set('Accept-Language', 'he');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION', field: 'autoLockMinutes' });
    expect(res.body.message).toMatch(HEBREW);
    expect((await t.put('/api/settings', { theme: 'neon' })).body.field).toBe('theme');
  });

  it('describes the data directory for the local client', async () => {
    const res = await t.get('/api/settings/data-dir');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      dataDir: t.config.dataDir,
      dbPath: expect.stringMatching(/u_test\.mpd$/),
      dbExists: false,
      dbSizeBytes: 0,
      encryptionSummary: encryptionSummary('he'),
    });
    expect(res.body.encryptionSummary).toContain('scrypt');
    expect(res.body.encryptionSummary).toContain('AES-256-GCM');
    // No Accept-Language header: the summary is in the default language (English).
  });

  it('seeds demo data only into an empty diary', async () => {
    const res = await t.post('/api/settings/seed-demo', { days: 30 });
    expect(res.status).toBe(200);
    expect(res.body.habits).toBe(5);
    expect(res.body.entries).toBeGreaterThan(15);
    expect(res.body.habitLogs).toBeGreaterThan(30);
    expect(((await t.get('/api/entries')).body as EntryPage).total).toBe(res.body.entries);

    const again = await t.post('/api/settings/seed-demo', {}).set('Accept-Language', 'he');
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('VALIDATION');
    expect(again.body.message).toMatch(HEBREW);
  });

  it('validates the requested number of days', async () => {
    const res = await t.post('/api/settings/seed-demo', { days: 3 });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION', field: 'days' });
    expect((await t.post('/api/settings/seed-demo', { days: '30' })).body.field).toBe('days');
    expect(((await t.get('/api/entries')).body as EntryPage).total).toBe(0);
  });
});
