/**
 * The earliest months of the calendar page's year select (docs/android-tasks/CALENDAR-YEARS.md) through
 * the real routes: January 1980 (/api/calendar/month), Tishrei 5731 = תשל״א and Muharram of the current
 * Hijri year - 40 (/api/calendar/range, the way the page asks for Hebrew and Hijri months). Entries can
 * be written on those dates and the calendar answers with them. The server's own limits are unchanged:
 * /api/calendar/month takes the years 1970..2200 and the range endpoint any valid dates (400 days at most).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { monthViewContaining, monthViewFor } from '@shared/calendars';
import type { CalendarDay, CalendarMonth, Entry } from '@shared/types';
import { MAX_YEAR, MIN_YEAR } from '../src/stats/calendar';
import { todayIso } from '../src/util/dates';
import { cleanupTempDirs, makeTestApp, sampleEntry } from './helpers';

afterAll(() => cleanupTempDirs());

describe('calendar routes at the earliest years of the year select', () => {
  it('January 1980, Tishrei 5731 and the current Hijri year - 40 are answered with the entries written on them', async () => {
    const t = await makeTestApp();
    const tishrei = monthViewFor('hebrew', 5731, 1, 'en');
    expect(tishrei).toMatchObject({ firstDay: '1970-10-01', lastDay: '1970-10-30' });
    const hijriFirst = monthViewContaining('hijri', todayIso(), 'en').year - 40;
    const muharram = monthViewFor('hijri', hijriFirst, 1, 'en');
    const muharramDay = muharram.days[2].iso;

    for (const [date, title] of [
      ['1980-01-15', 'January 1980'],
      [tishrei.firstDay, 'Rosh Hashana 5731'],
      [muharramDay, `Muharram ${hijriFirst}`],
    ]) {
      const created = await t.post('/api/entries', sampleEntry({ date, title }));
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      expect((created.body as Entry).date).toBe(date);
    }

    const january = await t.get('/api/calendar/month?year=1980&month=1');
    expect(january.status).toBe(200);
    const month = january.body as CalendarMonth;
    expect(month.days).toHaveLength(31);
    expect(month.days[14]).toMatchObject({ date: '1980-01-15', hasEntry: true, titles: ['January 1980'] });

    const hebrew = await t.get(`/api/calendar/range?from=${tishrei.firstDay}&to=${tishrei.lastDay}`);
    expect(hebrew.status).toBe(200);
    expect((hebrew.body as CalendarDay[]).map((d) => [d.date, d.titles])).toEqual([['1970-10-01', ['Rosh Hashana 5731']]]);

    const hijri = await t.get(`/api/calendar/range?from=${muharram.firstDay}&to=${muharram.lastDay}`);
    expect(hijri.status).toBe(200);
    expect((hijri.body as CalendarDay[]).map((d) => d.date)).toEqual([muharramDay]);
  });

  it("keeps the server's own year limits (1970..2200), which lie below every new lower bound", async () => {
    expect([MIN_YEAR, MAX_YEAR]).toEqual([1970, 2200]);
    const t = await makeTestApp();
    expect((await t.get('/api/calendar/month?year=1979&month=12')).status).toBe(200);
    expect((await t.get('/api/calendar/month?year=1970&month=1')).status).toBe(200);
    const below = await t.get('/api/calendar/month?year=1969&month=12');
    expect(below.status).toBe(400);
    expect(below.body).toMatchObject({ code: 'VALIDATION', field: 'year' });
  });
});
