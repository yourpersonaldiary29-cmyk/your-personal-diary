/**
 * The earliest months of the calendar's year select (CALENDAR-YEARS.md) under the automatic offline
 * mode: January 1980, Tishrei 5731 and Muharram of the current Hijri year - 40 are cached like any
 * other month when they are viewed online, are served from the cache (with the overlay of writes made
 * offline) when the connection is gone, and a never-viewed Gregorian month of 1980 is put together from
 * cached entries. Nothing in the offline engine bounds the years; this pins that down for the new bounds.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { monthViewContaining, monthViewFor } from '@shared/calendars/month-view';
import type { EntryInput } from '@shared/types';
import * as api from '@/api';
import { isPartialView } from '@/offline/engine';
import { bootDevice, DANA, installWebCrypto, resetOfflineTestEnv, waitFor } from '@/offline/test-utils/env';
import { FakeSyncServer } from '@/offline/test-utils/fake-sync-server';
import { addDays, todayIso } from '@/utils/dates';
import { firstOfferedYear, GREGORIAN_FIRST_YEAR, HEBREW_FIRST_YEAR } from './calendar-years';

beforeAll(() => installWebCrypto());

function entryInput(title: string, date: string): EntryInput {
  return { date, time: '09:00', title, body: `${title}: a fictional day.`, mood: 6, emotions: [], energy: null, stress: null, sleepQuality: null, sleepHours: null, exerciseMinutes: null, exerciseType: '', events: [], people: [], location: '', notes: '', tags: [] };
}

describe('offline: the earliest months of the year select', () => {
  let server: FakeSyncServer;

  beforeEach(() => {
    server = new FakeSyncServer();
  });

  afterEach(async () => {
    await resetOfflineTestEnv();
  });

  it('are cached online, served from the cache offline (with offline writes) and synthesised from cached entries', async () => {
    const today = todayIso();
    const tishrei = monthViewFor('hebrew', HEBREW_FIRST_YEAR, 1, 'en');
    const hijriFirst = firstOfferedYear('hijri', monthViewContaining('hijri', today, 'en').year);
    const muharram = monthViewFor('hijri', hijriFirst, 1, 'en');
    const muharramDay = muharram.days[4].iso;

    server.seedEntry(DANA, { title: 'Recent', date: addDays(today, -2) });
    server.seedEntry(DANA, { title: 'January 1980', date: `${GREGORIAN_FIRST_YEAR}-01-15` });
    const february = server.seedEntry(DANA, { title: 'February 1980', date: `${GREGORIAN_FIRST_YEAR}-02-10` });
    server.seedEntry(DANA, { title: 'Rosh Hashana 5731', date: tishrei.firstDay });
    server.seedEntry(DANA, { title: 'Muharram', date: muharramDay });

    const { engine } = await bootDevice({ server, rememberMe: true, app: true });
    // Let the warm-up finish first (it ends with the recent day views).
    await waitFor(() => engine.cache.bytes > 0 && server.calls('/api/entries/day/').length > 0, 6000);

    // Online: each month is answered by the server and cached.
    const january = await api.calendar.month(GREGORIAN_FIRST_YEAR, 1);
    expect(january.days).toHaveLength(31);
    expect(january.days[14]).toMatchObject({ date: '1980-01-15', hasEntry: true, titles: ['January 1980'] });
    const hebrew = await api.calendar.range(tishrei.firstDay, tishrei.lastDay);
    expect(hebrew.map((d) => d.date)).toEqual(['1970-10-01']);
    const hijri = await api.calendar.range(muharram.firstDay, muharram.lastDay);
    expect(hijri.map((d) => d.date)).toEqual([muharramDay]);
    // An entry read online is cached too (the source of a synthesised month).
    expect((await api.entries.get(february.id)).date).toBe('1980-02-10');

    server.mode = 'down';

    // Offline: the cached months, with an entry written offline on an old date laid over January 1980.
    const offlineEntry = await api.entries.create(entryInput('Written offline', '1980-01-20'));
    expect(offlineEntry.id).toBeLessThan(0);
    const januaryOffline = await api.calendar.month(GREGORIAN_FIRST_YEAR, 1);
    expect(januaryOffline.days[14]).toMatchObject({ date: '1980-01-15', hasEntry: true });
    expect(januaryOffline.days[19]).toMatchObject({ date: '1980-01-20', hasEntry: true, entryCount: 1, titles: ['Written offline'] });
    expect((await api.calendar.range(tishrei.firstDay, tishrei.lastDay)).map((d) => d.date)).toEqual(['1970-10-01']);
    expect((await api.calendar.range(muharram.firstDay, muharram.lastDay)).map((d) => d.date)).toEqual([muharramDay]);

    // February 1980 was never viewed: it is put together from the cached entry and marked partial.
    const februaryOffline = await api.calendar.month(GREGORIAN_FIRST_YEAR, 2);
    expect(februaryOffline.days).toHaveLength(29);
    expect(februaryOffline.days[9]).toMatchObject({ date: '1980-02-10', hasEntry: true, titles: ['February 1980'] });
    expect(isPartialView(februaryOffline)).toBe(true);
  }, 20000);
});
