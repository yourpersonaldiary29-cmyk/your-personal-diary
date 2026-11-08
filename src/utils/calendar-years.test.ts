/**
 * The year ranges of the calendar page (CALENDAR-YEARS.md): the year select starts at 1980 (Gregorian),
 * 5731 = תשל״א (Hebrew) and the current Hijri year - 40 (Hijri); the upper ends and the URL / month-button
 * limits stay as they were. Each lower bound is offered and its month resolves; the year before it is not
 * offered (and for Hebrew, where the server's civil range ends there too, a URL asking for it is clamped).
 */
import { describe, expect, it } from 'vitest';
import { adjacentMonthView, hebrewYearLabel, monthsOfYear, monthViewContaining, monthViewFor, type CalendarSystem, type MonthView } from '@shared/calendars';
import { LOCALE_CODES } from '@shared/i18n';
import { todayIso } from '@/utils/dates';
import {
  CALENDAR_HARD_YEARS,
  firstOfferedYear,
  GREGORIAN_FIRST_YEAR,
  HEBREW_FIRST_YEAR,
  HIJRI_YEARS_BACK,
  insideCalendarLimits,
  navigableView,
  offeredYearRange,
  resolveView,
  yearOptionsFor,
} from './calendar-years';

const TODAY = '2026-10-27';
const values = (system: CalendarSystem, viewYear: number, todayYear: number) => yearOptionsFor(system, viewYear, todayYear, 'en').map((o) => o.value);

/** Every month of `year` in `system` lies inside the server's civil range (so the API answers each of them). */
function everyMonthInside(system: CalendarSystem, year: number): boolean {
  return monthsOfYear(system, year, 'en').every((m) => insideCalendarLimits(monthViewFor(system, year, m.index, 'en')));
}

describe('calendar years: Gregorian from 1980', () => {
  it('offers 1980 as the first year, not 1979, and still ends at today + 10', () => {
    expect(GREGORIAN_FIRST_YEAR).toBe(1980);
    const years = values('gregorian', 2026, 2026);
    expect(years[0]).toBe('1980');
    expect(years).not.toContain('1979');
    expect(years[years.length - 1]).toBe('2036');
    expect(years).toHaveLength(2036 - 1980 + 1);
    // The lower bound is fixed; the upper end still moves with today's year.
    expect(offeredYearRange('gregorian', 2030)).toEqual([1980, 2040]);
  });

  it('January 1980 resolves from the URL and every month of 1980 is inside the server range', () => {
    const view = resolveView('gregorian', '1980', '1', TODAY, 'en');
    expect(view).toMatchObject({ year: 1980, monthIndex: 1, firstDay: '1980-01-01', lastDay: '1980-01-31', title: 'January 1980' });
    expect(everyMonthInside('gregorian', 1980)).toBe(true);
  });

  it('a month before 1980 is still reachable with the month buttons, as before (server range from 1970)', () => {
    // Unchanged limit: the request was to add years to the select, not to take months away.
    expect(CALENDAR_HARD_YEARS.gregorian).toEqual([1970, 2200]);
    expect(resolveView('gregorian', '1979', '12', TODAY, 'en')).toMatchObject({ year: 1979, monthIndex: 12 });
    // The select then lists the visible year too (it always includes it).
    expect(values('gregorian', 1979, 2026)[0]).toBe('1979');
  });
});

describe('calendar years: Hebrew from 5731 (תשל״א)', () => {
  it('offers 5731 as the first year, labelled תשל״א in Hebrew, not 5730, and still ends at 5810', () => {
    expect(HEBREW_FIRST_YEAR).toBe(5731);
    const options = yearOptionsFor('hebrew', 5787, 5787, 'he');
    expect(options[0]).toEqual({ value: '5731', label: 'תשל״א (5731)' });
    expect(options.map((o) => o.value)).not.toContain('5730');
    expect(options[options.length - 1]).toEqual({ value: '5810', label: 'תת״י (5810)' });
    expect(options).toHaveLength(5810 - 5731 + 1);
    // The Hebrew range does not depend on today's year.
    expect(offeredYearRange('hebrew', 5800)).toEqual([5731, 5810]);
  });

  it('Tishrei 5731 resolves from the URL (1 October 1970) and every month of 5731 is inside the server range', () => {
    const view = resolveView('hebrew', '5731', '1', TODAY, 'he');
    expect(view).toMatchObject({ year: 5731, monthIndex: 1, firstDay: '1970-10-01', lastDay: '1970-10-30', title: 'תשרי תשל״א' });
    expect(everyMonthInside('hebrew', 5731)).toBe(true);
  });

  it('5730 is refused: a URL asking for it is clamped to 5731', () => {
    expect(resolveView('hebrew', '5730', '1', TODAY, 'he')).toMatchObject({ year: 5731, monthIndex: 1 });
  });
});

describe('calendar years: Hijri from the current Hijri year - 40', () => {
  it('counts the first year from the current Hijri year (never a fixed year) and still ends at 1470', () => {
    expect(HIJRI_YEARS_BACK).toBe(40);
    expect(offeredYearRange('hijri', 1448)).toEqual([1408, 1470]);
    expect(offeredYearRange('hijri', 1460)).toEqual([1420, 1470]);
    const years = values('hijri', 1448, 1448);
    expect(years[0]).toBe('1408');
    expect(years).not.toContain('1407');
    expect(years[years.length - 1]).toBe('1470');
  });

  it("today's Hijri year - 40 is offered and its first month resolves inside the server range; the year before is not offered", () => {
    const today = todayIso();
    const current = monthViewContaining('hijri', today, 'en').year;
    const first = firstOfferedYear('hijri', current);
    expect(first).toBe(current - 40);
    const years = values('hijri', current, current);
    expect(years[0]).toBe(String(first));
    expect(years).not.toContain(String(first - 1));
    const view = resolveView('hijri', String(first), '1', today, 'en');
    expect(view).toMatchObject({ year: first, monthIndex: 1 });
    expect(everyMonthInside('hijri', first)).toBe(true);
  });
});

/** The month a URL for `view` (its year and month index) opens. */
const reopened = (view: MonthView, today = TODAY): MonthView => resolveView(view.system, String(view.year), String(view.monthIndex), today, view.locale);

describe('calendar years: the month buttons / keyboard at the first and last year (navigableView)', () => {
  it('Hebrew: the month before Tishrei 5731 (Elul 5730, 2..30 September 1970) is refused, not turned into a month of 5731', () => {
    const tishrei = monthViewFor('hebrew', HEBREW_FIRST_YEAR, 1, 'he');
    expect(navigableView(tishrei)).toBe(true);
    const elul5730 = adjacentMonthView(tishrei, -1);
    expect(elul5730).toMatchObject({ year: 5730, monthIndex: 13, firstDay: '1970-09-02', lastDay: '1970-09-30' });
    // Inside the server's civil range, but the URL clamps 5730 to 5731 and, 5731 having 12 months,
    // month 13 fell back to today's month: Cheshvan 5731 today, Iyar 5731 on 10 April 2027.
    expect(insideCalendarLimits(elul5730)).toBe(true);
    expect(navigableView(elul5730)).toBe(false);
    expect(reopened(elul5730, '2026-10-27')).toMatchObject({ year: 5731, monthIndex: 2 });
    expect(reopened(elul5730, '2027-04-10')).toMatchObject({ year: 5731, monthIndex: 8 });
    // Every month the page may show opens itself again from its URL.
    expect(reopened(tishrei)).toMatchObject({ year: 5731, monthIndex: 1, firstDay: '1970-10-01' });
  });

  it('Hijri: the month before Muharram 1390 (the hard floor, below the offered start) is refused', () => {
    const muharram = monthViewFor('hijri', CALENDAR_HARD_YEARS.hijri[0], 1, 'en');
    expect(navigableView(muharram)).toBe(true);
    const before = adjacentMonthView(muharram, -1);
    expect(before).toMatchObject({ year: 1389, monthIndex: 12 });
    expect(insideCalendarLimits(before)).toBe(true);
    expect(navigableView(before)).toBe(false);
    // The bug it prevents: the URL turned it into Dhu al-Hijjah 1390, 11 months forward.
    expect(reopened(before)).toMatchObject({ year: 1390, monthIndex: 12 });
  });

  it('below the offered start but inside the hard years the month buttons still go back (Muharram of the first offered Hijri year -> the year before)', () => {
    const first = monthViewFor('hijri', firstOfferedYear('hijri', 1448), 1, 'en');
    const before = adjacentMonthView(first, -1);
    expect(before).toMatchObject({ year: 1407, monthIndex: 12 });
    expect(navigableView(before)).toBe(true);
    expect(reopened(before)).toMatchObject({ year: 1407, monthIndex: 12, firstDay: before.firstDay });
  });

  it('the upper ends: the month after Elul 5960 and after Dhu al-Hijjah 1626 is refused; Gregorian stops at December 2200', () => {
    for (const system of ['gregorian', 'hebrew', 'hijri'] as const) {
      const [, max] = CALENDAR_HARD_YEARS[system];
      const last = monthViewFor(system, max, monthsOfYear(system, max, 'en').length, 'en');
      expect(navigableView(last), system).toBe(true);
      const after = adjacentMonthView(last, 1);
      expect(after.year, system).toBe(max + 1);
      expect(navigableView(after), system).toBe(false);
    }
    // Gregorian: January 2201 lies outside the civil range anyway, as December 1969 does.
    expect(navigableView(monthViewFor('gregorian', 2201, 1, 'en'))).toBe(false);
    expect(navigableView(monthViewFor('gregorian', 1969, 12, 'en'))).toBe(false);
    expect(navigableView(monthViewFor('gregorian', 1970, 1, 'en'))).toBe(true);
  });

  it('near every bound a month is allowed exactly when its own URL opens it again', () => {
    for (const system of ['gregorian', 'hebrew', 'hijri'] as const) {
      const [min, max] = CALENDAR_HARD_YEARS[system];
      for (const [start, step] of [
        [monthViewFor(system, min, 1, 'en'), -1],
        [monthViewFor(system, max, monthsOfYear(system, max, 'en').length, 'en'), 1],
      ] as const) {
        // From 14 months inside the range to 14 months beyond it.
        let view: MonthView = start;
        for (let i = 0; i < 14; i++) view = adjacentMonthView(view, step === 1 ? -1 : 1);
        for (let i = 0; i < 28; i++) {
          const back = reopened(view);
          const same = back.year === view.year && back.monthIndex === view.monthIndex && back.firstDay === view.firstDay;
          expect(navigableView(view), `${system} ${view.year}/${view.monthIndex}`).toBe(same);
          view = adjacentMonthView(view, step);
        }
      }
    }
  });
});

describe('calendar years: all 20 languages', () => {
  it('every language gets the year options and the month titles at each lower bound', () => {
    expect(LOCALE_CODES).toHaveLength(20);
    const hijriFirst = firstOfferedYear('hijri', 1448);
    for (const locale of LOCALE_CODES) {
      const gregorian = yearOptionsFor('gregorian', 2026, 2026, locale);
      expect(gregorian[0], locale).toEqual({ value: '1980', label: '1980' });
      const hebrew = yearOptionsFor('hebrew', 5787, 5787, locale);
      expect(hebrew[0], locale).toEqual({ value: '5731', label: locale === 'he' ? 'תשל״א (5731)' : hebrewYearLabel(5731, locale) });
      expect(hebrew[0].label, locale).not.toBe('');
      const hijri = yearOptionsFor('hijri', 1448, 1448, locale);
      expect(hijri[0], locale).toEqual({ value: String(hijriFirst), label: String(hijriFirst) });
      for (const [system, year] of [
        ['gregorian', 1980],
        ['hebrew', 5731],
        ['hijri', hijriFirst],
      ] as const) {
        const view = resolveView(system, String(year), '1', TODAY, locale);
        expect(view.year, `${locale} ${system}`).toBe(year);
        expect(view.title.trim(), `${locale} ${system}`).not.toBe('');
        expect(view.days.every((d) => d.dayLabel !== ''), `${locale} ${system}`).toBe(true);
      }
    }
  });
});
