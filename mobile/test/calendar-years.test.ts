// @vitest-environment node
/**
 * The earliest years of the calendar's year select (docs/android-tasks/CALENDAR-YEARS.md) in the mobile
 * build: the same year logic of the UI (src/utils/calendar-years.ts, here with __MOBILE__ = true) offers
 * 1980 (Gregorian), 5731 = תשל״א (Hebrew) and the current Hijri year - 40 (Hijri) and not the year before
 * each; the mobile core (the server code in the phone's worker) stores entries on those dates and answers
 * the calendar requests the page makes for those months.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { adjacentMonthView, monthViewContaining, monthViewFor } from '@shared/calendars';
import type { AuthResponse, CalendarDay, CalendarMonth } from '@shared/types';
import { navigableView, resolveView, yearOptionsFor } from '@/utils/calendar-years';
import { todayIso } from '@/utils/dates';
import { bootTestCore, type CoreRig } from './core/helpers';

const PASSWORD = 'Passw0rd!';
const TODAY = todayIso();
const HIJRI_NOW = monthViewContaining('hijri', TODAY, 'en').year;
const HIJRI_FIRST = HIJRI_NOW - 40;
const values = (options: { value: string }[]) => options.map((o) => o.value);

describe('mobile build: the year select of the calendar', () => {
  it('runs as the mobile build', () => {
    expect(__MOBILE__).toBe(true);
  });

  it('Gregorian: 1980 is offered, 1979 is not', () => {
    const years = values(yearOptionsFor('gregorian', 2026, 2026, 'en'));
    expect(years[0]).toBe('1980');
    expect(years).not.toContain('1979');
    expect(years[years.length - 1]).toBe('2036');
    expect(resolveView('gregorian', '1980', '1', TODAY, 'en')).toMatchObject({ year: 1980, monthIndex: 1, firstDay: '1980-01-01' });
  });

  it('Hebrew: תשל״א (5731) is offered, 5730 is not and a link to it is clamped to 5731', () => {
    const options = yearOptionsFor('hebrew', 5787, 5787, 'he');
    expect(options[0]).toEqual({ value: '5731', label: 'תשל״א (5731)' });
    expect(values(options)).not.toContain('5730');
    expect(values(options)[options.length - 1]).toBe('5810');
    expect(resolveView('hebrew', '5731', '1', TODAY, 'he')).toMatchObject({ year: 5731, title: 'תשרי תשל״א', firstDay: '1970-10-01' });
    expect(resolveView('hebrew', '5730', '1', TODAY, 'he')).toMatchObject({ year: 5731 });
  });

  it('Hijri: the current Hijri year - 40 is offered, the year before is not', () => {
    const years = values(yearOptionsFor('hijri', HIJRI_NOW, HIJRI_NOW, 'ar'));
    expect(years[0]).toBe(String(HIJRI_FIRST));
    expect(years).not.toContain(String(HIJRI_FIRST - 1));
    expect(years[years.length - 1]).toBe('1470');
    expect(resolveView('hijri', String(HIJRI_FIRST), '1', TODAY, 'ar')).toMatchObject({ year: HIJRI_FIRST, monthIndex: 1 });
  });
});

describe('mobile build: the month buttons / keys at the first and last year', () => {
  it('refuse Elul 5730 before Tishrei 5731 and Dhu al-Hijjah 1389 before Muharram 1390 instead of jumping to a month of the clamped year', () => {
    const tishrei = monthViewFor('hebrew', 5731, 1, 'he');
    const elul5730 = adjacentMonthView(tishrei, -1);
    expect(elul5730).toMatchObject({ year: 5730, monthIndex: 13, firstDay: '1970-09-02' });
    expect(navigableView(tishrei)).toBe(true);
    expect(navigableView(elul5730)).toBe(false);
    const muharram = monthViewFor('hijri', 1390, 1, 'ar');
    expect(navigableView(muharram)).toBe(true);
    expect(navigableView(adjacentMonthView(muharram, -1))).toBe(false);
    // The upper ends too: Tishrei 5961 and Muharram 1627 are refused.
    expect(navigableView(adjacentMonthView(monthViewFor('hebrew', 5960, 12, 'he'), 1))).toBe(false);
    expect(navigableView(adjacentMonthView(monthViewFor('hijri', 1626, 12, 'ar'), 1))).toBe(false);
    // Below the offered Hijri start the buttons still go back while the year stays inside the range.
    expect(navigableView(adjacentMonthView(monthViewFor('hijri', HIJRI_FIRST, 1, 'ar'), -1))).toBe(true);
  });
});

describe('mobile core: calendar months at the earliest years', () => {
  let rig: CoreRig | undefined;
  afterEach(async () => {
    await rig?.shutdown().catch(() => undefined);
    rig = undefined;
  });

  it('answers January 1980, Tishrei 5731 and Muharram of the current Hijri year - 40 with the entries written on them', async () => {
    rig = await bootTestCore();
    const registered = await rig.call('/api/auth/register', {
      method: 'POST',
      locale: 'he',
      body: { firstName: 'דנה', lastName: 'בדיונית', username: 'dana_years', email: 'dana_years@example.test', password: PASSWORD, confirmPassword: PASSWORD, rememberMe: true, deviceName: 'Phone' },
    });
    expect(registered.status, JSON.stringify(registered.json)).toBe(201);
    const token = (registered.json as AuthResponse).token;

    const tishrei = monthViewFor('hebrew', 5731, 1, 'he');
    const muharram = monthViewFor('hijri', HIJRI_FIRST, 1, 'he');
    const muharramDay = muharram.days[6].iso;
    for (const [date, title] of [
      ['1980-01-15', 'January 1980'],
      [tishrei.firstDay, 'Rosh Hashana 5731'],
      [muharramDay, `Muharram ${HIJRI_FIRST}`],
    ]) {
      const created = await rig.call('/api/entries', {
        token,
        method: 'POST',
        body: { date, time: '09:00', title, body: 'A fictional day.', mood: 6, emotions: [], energy: null, stress: null, sleepQuality: null, sleepHours: null, exerciseMinutes: null, exerciseType: '', events: [], people: [], location: '', notes: '', tags: [] },
      });
      expect(created.status, JSON.stringify(created.json)).toBe(201);
    }

    const january = await rig.call('/api/calendar/month?year=1980&month=1', { token });
    expect(january.status).toBe(200);
    expect((january.json as CalendarMonth).days[14]).toMatchObject({ date: '1980-01-15', hasEntry: true, titles: ['January 1980'] });

    const hebrew = await rig.call(`/api/calendar/range?from=${tishrei.firstDay}&to=${tishrei.lastDay}`, { token });
    expect(hebrew.status).toBe(200);
    expect((hebrew.json as CalendarDay[]).map((d) => d.date)).toEqual(['1970-10-01']);

    const hijri = await rig.call(`/api/calendar/range?from=${muharram.firstDay}&to=${muharram.lastDay}`, { token });
    expect(hijri.status).toBe(200);
    expect((hijri.json as CalendarDay[]).map((d) => d.date)).toEqual([muharramDay]);
  }, 60_000);
});
