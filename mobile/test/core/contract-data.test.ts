// @vitest-environment node
/**
 * Contract of the mobile core with the desktop server, part 2: the diary data routes. Entries and
 * habits are written and read on both sides with the same requests; a second account gets the
 * demo data (a seeded, deterministic generator - the same on both sides) for calendar, insights,
 * statistics and the smart search in three languages. See ./contract-rig.ts for the comparison.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppSettings, DaySummary, Entry, EntryPage, Habit, HabitLog, HabitWithProgress, SeedDemoResult } from '@shared/types';
import { closeNative, DANA, entryInput, habitInput, registerBoth, startContract, YOSSI, type ContractRig, type Side } from './contract-rig';

let rig: ContractRig;
/** Per-side ids of what the scenarios created (ids may differ between the sides). */
const ids: Record<Side['name'], Record<string, number>> = { core: {}, desktop: {} };
const idOf = (side: Side, name: string): number => ids[side.name][name];

beforeAll(async () => {
  rig = await startContract();
  await registerBoth(rig, DANA, 'he');
}, 120_000);

afterAll(async () => {
  await rig?.close();
  await closeNative();
});

describe('contract: entries', () => {
  it('create, list, read, update, delete - and the validation errors - agree', async () => {
    for (let n = 0; n < 4; n++) {
      const created = await rig.authed('/api/entries', { method: 'POST', body: entryInput(n) });
      expect(created.core.status, JSON.stringify(created.core.json)).toBe(201);
      ids.core[`entry${n}`] = (created.core.json as Entry).id;
      ids.desktop[`entry${n}`] = (created.desktop.json as Entry).id;
    }
    const list = await rig.authed('/api/entries');
    expect((list.core.json as EntryPage).items).toHaveLength(4);
    await rig.authed('/api/entries?limit=2&offset=1&sortDesc=true');
    await rig.authed('/api/entries?tag=%D7%91%D7%93%D7%99%D7%A7%D7%94&from=2026-09-01&to=2026-09-30');
    await rig.authed('/api/entries?text=quiet&emotion=calm');
    await rig.authed('/api/entries?limit=abc');

    const one = await rig.authed((side) => `/api/entries/${idOf(side, 'entry1')}`);
    expect((one.core.json as Entry).title).toBe('A quiet day #1');
    const updated = await rig.authed(
      (side) => `/api/entries/${idOf(side, 'entry1')}`,
      { method: 'PUT', body: entryInput(1, { title: 'Edited title', tags: ['edited'] }) },
    );
    expect((updated.core.json as Entry).title).toBe('Edited title');
    const bad = await rig.authed('/api/entries', { method: 'POST', locale: 'he', body: entryInput(5, { date: '2026-13-45' }) });
    expect(bad.core.status).toBe(400);
    expect(bad.core.json).toMatchObject({ code: 'VALIDATION' });
    const missing = await rig.authed('/api/entries/999999', { locale: 'ar' });
    expect(missing.core.status).toBe(404);
    const removed = await rig.authed((side) => `/api/entries/${idOf(side, 'entry3')}`, { method: 'DELETE' });
    expect(removed.core.status).toBe(204);
    expect(((await rig.authed('/api/entries')).core.json as EntryPage).items).toHaveLength(3);
  });

  it('day summary and the tag / people / location lists agree', async () => {
    const day = await rig.authed('/api/entries/day/2026-09-02', { locale: 'he' });
    expect((day.core.json as DaySummary).entries).toHaveLength(1);
    await rig.authed('/api/entries/meta/tags');
    await rig.authed('/api/entries/meta/people');
    await rig.authed('/api/entries/meta/locations');
  });

  it("the body parser agrees on odd bodies: a '+json' media type is not parsed, a byte order mark before the JSON is ignored", async () => {
    const before = ((await rig.authed('/api/entries')).core.json as EntryPage).items.length;
    // Not 'application/json': the body is not parsed and the route sees no entry object.
    const vendor = await rig.authed('/api/entries', { method: 'POST', headers: { 'content-type': 'application/vnd.api+json' }, body: JSON.stringify(entryInput(20)) });
    expect(vendor.core.status).toBe(400);
    expect(vendor.core.json).toMatchObject({ code: 'VALIDATION' });

    // A BOM, as text and as bytes (what a file read into the body of a request starts with).
    const text = await rig.authed('/api/entries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '\uFEFF' + JSON.stringify(entryInput(21)) });
    expect(text.core.status, JSON.stringify(text.core.json)).toBe(201);
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(JSON.stringify(entryInput(22)))]);
    const binary = await rig.authed('/api/entries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: bytes });
    expect(binary.core.status, JSON.stringify(binary.core.json)).toBe(201);
    expect((binary.core.json as Entry).title).toBe(entryInput(22).title);
    const twice = await rig.authed('/api/entries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '\uFEFF\uFEFF' + JSON.stringify(entryInput(23)) });
    expect(twice.core.status).toBe(400);

    // Leave the diary as the next scenarios expect it.
    for (const created of [text, binary]) {
      const removed = await rig.authed((side) => `/api/entries/${((side.name === 'core' ? created.core : created.desktop).json as Entry).id}`, { method: 'DELETE' });
      expect(removed.core.status).toBe(204);
    }
    expect(((await rig.authed('/api/entries')).core.json as EntryPage).items).toHaveLength(before);
  });
});

describe('contract: habits', () => {
  it('create, update, archive, reorder, log, status, progress, due reminders and delete agree', async () => {
    const walk = await rig.authed('/api/habits', { method: 'POST', body: habitInput('Walk', { target: 30, unit: 'minutes' }) });
    expect(walk.core.status, JSON.stringify(walk.core.json)).toBe(201);
    const read = await rig.authed('/api/habits', { method: 'POST', body: habitInput('קריאה', { frequency: 'weekly', target: 3, reminderEnabled: true, reminderTime: '08:00' }) });
    ids.core.walk = (walk.core.json as Habit).id;
    ids.desktop.walk = (walk.desktop.json as Habit).id;
    ids.core.read = (read.core.json as Habit).id;
    ids.desktop.read = (read.desktop.json as Habit).id;
    const invalid = await rig.authed('/api/habits', { method: 'POST', locale: 'he', body: habitInput('', { target: -1 }) });
    expect(invalid.core.status).toBe(400);

    expect(((await rig.authed('/api/habits')).core.json as Habit[]).map((h) => h.name)).toEqual(['Walk', 'קריאה']);
    await rig.authed('/api/habits/templates', { locale: 'ar' });
    await rig.authed((side) => `/api/habits/${idOf(side, 'walk')}`, { method: 'PUT', body: habitInput('Walk more', { target: 45, unit: 'minutes' }) });
    await rig.authed('/api/habits/reorder', (side) => ({ method: 'PUT', body: { ids: [idOf(side, 'read'), idOf(side, 'walk')] } }));
    expect(((await rig.authed('/api/habits')).core.json as Habit[]).map((h) => h.name)).toEqual(['קריאה', 'Walk more']);

    const logged = await rig.authed('/api/habits/logs', (side) => ({ method: 'PUT', body: { habitId: idOf(side, 'walk'), date: '2026-09-02', value: 50, note: 'park' } }));
    expect(logged.core.status).toBe(200);
    expect((logged.core.json as HabitLog).completed).toBe(true);
    await rig.authed('/api/habits/logs', (side) => ({ method: 'PUT', body: { habitId: idOf(side, 'walk'), date: '2026-09-02', value: 10 } }));
    await rig.authed('/api/habits/logs', (side) => ({ method: 'PUT', body: { habitId: idOf(side, 'read'), date: '2026-09-03', value: 1 } }));
    await rig.authed((side) => `/api/habits/${idOf(side, 'walk')}/logs?from=2026-09-01&to=2026-09-30`);
    await rig.authed('/api/habits/status?from=2026-09-01&to=2026-09-07');
    const progress = await rig.authed('/api/habits/progress?date=2026-09-02');
    expect((progress.core.json as HabitWithProgress[]).length).toBe(2);
    await rig.authed('/api/habits/reminders/due?now=08:05', { locale: 'he' });
    await rig.authed('/api/habits/reminders/due?now=12:00', { locale: 'he' });

    const archived = await rig.authed((side) => `/api/habits/${idOf(side, 'read')}/archive`, { method: 'PATCH', body: { archived: true } });
    expect((archived.core.json as Habit).isArchived).toBe(true);
    expect(((await rig.authed('/api/habits')).core.json as Habit[]).map((h) => h.name)).toEqual(['Walk more']);
    expect(((await rig.authed('/api/habits?includeArchived=true')).core.json as Habit[]).length).toBe(2);
    const unlogged = await rig.authed((side) => `/api/habits/${idOf(side, 'walk')}/logs/2026-09-02`, { method: 'DELETE' });
    expect(unlogged.core.status).toBe(204);
    const deleted = await rig.authed((side) => `/api/habits/${idOf(side, 'read')}`, { method: 'DELETE' });
    expect(deleted.core.status).toBe(204);
    expect(((await rig.authed('/api/habits?includeArchived=true')).core.json as Habit[]).length).toBe(1);
    // The core raised habits-changed for the host's reminder scheduler.
    expect(rig.coreRig.events.filter((e) => e.name === 'habits-changed').length).toBeGreaterThan(5);
  });
});

describe('contract: settings', () => {
  it('reading and changing the diary settings (language included) agree; the account language drives messages without Accept-Language', async () => {
    const before = await rig.authed('/api/settings');
    expect((before.core.json as AppSettings).language).toBe('he');
    const changed = await rig.authed('/api/settings', { method: 'PUT', body: { language: 'ar', theme: 'dark', firstDayOfWeek: 1, calendarExtras: { hebrewDates: true, hijriDates: true, jewishHolidays: false, muslimHolidays: true, christianHolidays: false, druzeHolidays: false } } });
    expect((changed.core.json as AppSettings)).toMatchObject({ language: 'ar', theme: 'dark', firstDayOfWeek: 1 });
    const invalid = await rig.authed('/api/settings', { method: 'PUT', locale: 'he', body: { fontScale: 99 } });
    expect(invalid.core.status).toBe(400);
    // No Accept-Language: the message comes in the account language (Arabic now).
    const noHeader = await rig.authed('/api/entries/999999', { locale: null });
    expect(noHeader.core.status).toBe(404);
    expect((noHeader.core.json as { message: string }).message).toMatch(/[؀-ۿ]/);
    await rig.authed('/api/settings/data-dir', { locale: 'en' });
    const restored = await rig.authed('/api/settings', { method: 'PUT', body: { language: 'he' } });
    expect((restored.core.json as AppSettings).language).toBe('he');
  });
});

describe('contract: demo data, calendar, insights, statistics, search', () => {
  beforeAll(async () => {
    await registerBoth(rig, YOSSI, 'en');
  });

  it('seeding the demo diary gives the same counts on both sides', async () => {
    const seeded = await rig.authed('/api/settings/seed-demo', { method: 'POST', locale: 'en', body: { days: 120 } });
    expect(seeded.core.status, JSON.stringify(seeded.core.json)).toBe(200);
    const result = seeded.core.json as SeedDemoResult;
    expect(result.entries).toBeGreaterThan(80);
    expect(result.habits).toBeGreaterThan(2);
    const again = await rig.authed('/api/settings/seed-demo', { method: 'POST', locale: 'he', body: {} });
    expect(again.core.status).toBe(400);
  }, 60_000);

  it('calendar months around the Gregorian, Hebrew and Hijri new years, and a range, agree', async () => {
    for (const [year, month] of [
      [2026, 1], // Gregorian new year
      [2026, 9], // Rosh Hashana 5787 (September 2026)
      [2026, 6], // 1 Muharram 1448 (June 2026)
      [2026, 10],
    ]) {
      const page = await rig.authed(`/api/calendar/month?year=${year}&month=${month}`);
      expect(page.core.status).toBe(200);
    }
    await rig.authed('/api/calendar/range?from=2026-08-01&to=2026-10-04');
    const bad = await rig.authed('/api/calendar/month?year=2026&month=x', { locale: 'he' });
    expect(bad.core.status).toBe(400);
  });

  it('home, insights and statistics on the demo data agree for every period', async () => {
    await rig.authed('/api/home', { locale: 'he' });
    for (const period of ['7d', '30d', '3m', 'all']) {
      await rig.authed(`/api/insights?period=${period}`, { locale: 'he' });
      await rig.authed(`/api/stats?period=${period}`, { locale: 'en' });
    }
    await rig.authed('/api/insights?period=30d', { locale: 'ar' });
    const bad = await rig.authed('/api/stats?period=2y', { locale: 'en' });
    expect(bad.core.status).toBe(400);
  }, 60_000);

  it('the smart search answers alike in English, Hebrew and Arabic', async () => {
    const queries: Array<[string, string]> = [
      ['en', 'how was my mood last month'],
      ['en', 'days I slept less than 6 hours'],
      ['he', 'מה היה מצב הרוח שלי בחודש האחרון'],
      ['he', 'ימים שישנתי פחות מ-6 שעות'],
      ['ar', 'كيف كان مزاجي في الشهر الماضي'],
      ['ar', 'الأيام التي نمت فيها أقل من 6 ساعات'],
    ];
    for (const [locale, query] of queries) {
      const result = await rig.authed('/api/search', { method: 'POST', locale, body: { query, limit: 20 } });
      expect(result.core.status, `${locale}: ${query}`).toBe(200);
      await rig.authed('/api/search/parse', { method: 'POST', locale, body: { query } });
    }
    const empty = await rig.authed('/api/search', { method: 'POST', locale: 'he', body: { query: '' } });
    expect(empty.core.status).toBe(400);
  }, 60_000);
});
