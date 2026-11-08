import { describe, expect, it } from 'vitest';
import { addDaysIso, daysBetween } from './civil';
import { toHebrewDate } from './hebrew';
import { hijriMonthSpan, toHijriDate } from './hijri';
import {
  adjacentMonthView,
  CALENDAR_SYSTEMS,
  civilSpan,
  formatCivilDate,
  formatCivilDayMonth,
  formatSystemDate,
  isCalendarSystem,
  monthsOfYear,
  monthViewContaining,
  monthViewFor,
  otherDatesLabel,
  otherMonthSpans,
  viewKey,
  type CalendarSystem,
  type MonthView,
} from './month-view';
import { DEFAULT_CALENDAR_EXTRAS, type CalendarExtras } from './types';

const ALL: CalendarExtras = { ...DEFAULT_CALENDAR_EXTRAS };
const NONE: CalendarExtras = {
  hebrewDates: false,
  hijriDates: false,
  jewishHolidays: false,
  muslimHolidays: false,
  christianHolidays: false,
  druzeHolidays: false,
};

function expectContiguous(view: MonthView) {
  expect(view.days).toHaveLength(view.length);
  expect(view.days[0].iso).toBe(view.firstDay);
  expect(view.days[view.length - 1].iso).toBe(view.lastDay);
  expect(daysBetween(view.firstDay, view.lastDay) + 1).toBe(view.length);
  view.days.forEach((d, i) => {
    expect(d.dayNumber).toBe(i + 1);
    if (i > 0) expect(d.iso).toBe(addDaysIso(view.days[i - 1].iso, 1));
  });
}

describe('calendar systems', () => {
  it('lists the three systems and guards the type', () => {
    expect(CALENDAR_SYSTEMS).toEqual(['gregorian', 'hebrew', 'hijri']);
    expect(isCalendarSystem('hebrew')).toBe(true);
    expect(isCalendarSystem('julian')).toBe(false);
    expect(isCalendarSystem(null)).toBe(false);
  });
});

describe('monthViewContaining', () => {
  it('September 2026 (gregorian) has 30 days labelled 1..30', () => {
    const view = monthViewContaining('gregorian', '2026-09-15');
    expect(view).toMatchObject({
      system: 'gregorian',
      year: 2026,
      monthIndex: 9,
      monthKey: '9',
      title: 'ספטמבר 2026',
      firstDay: '2026-09-01',
      lastDay: '2026-09-30',
      length: 30,
    });
    expectContiguous(view);
    expect(view.days.map((d) => d.dayLabel)).toEqual(Array.from({ length: 30 }, (_, i) => String(i + 1)));
    expect(monthViewContaining('gregorian', '2026-02-10').length).toBe(28);
    expect(monthViewContaining('gregorian', '2028-02-10').length).toBe(29);
    expect(viewKey(view)).toBe('gregorian:2026-09-01');
  });

  it('the Hebrew month containing 2026-09-12 is Tishrei 5787: 30 days from 2026-09-12, labelled א׳..ל׳', () => {
    const view = monthViewContaining('hebrew', '2026-09-12');
    expect(view).toMatchObject({
      system: 'hebrew',
      year: 5787,
      monthIndex: 1,
      monthKey: 'tishrei',
      title: 'תשרי תשפ״ז',
      firstDay: '2026-09-12',
      lastDay: '2026-10-11',
      length: 30,
    });
    expectContiguous(view);
    expect(view.days[0].dayLabel).toBe('א׳');
    expect(view.days[14].dayLabel).toBe('ט״ו');
    expect(view.days[29].dayLabel).toBe('ל׳');
    // Any day of the month resolves to the same (memoised) view.
    expect(monthViewContaining('hebrew', '2026-10-11')).toBe(view);
    expect(monthViewContaining('hebrew', '2026-09-30')).toBe(view);
  });

  it('adjacent -1 of Tishrei 5787 is Elul 5786 (29 days), adjacent +1 is Cheshvan 5787', () => {
    const tishrei = monthViewContaining('hebrew', '2026-09-12');
    const elul = adjacentMonthView(tishrei, -1);
    expect(elul).toMatchObject({ year: 5786, monthIndex: 12, monthKey: 'elul', title: 'אלול תשפ״ו', firstDay: '2026-08-14', lastDay: '2026-09-11', length: 29 });
    expectContiguous(elul);
    expect(elul.days[28].dayLabel).toBe('כ״ט');
    const cheshvan = adjacentMonthView(tishrei, 1);
    expect(cheshvan).toMatchObject({ year: 5787, monthIndex: 2, monthKey: 'cheshvan', firstDay: '2026-10-12' });
    expect(adjacentMonthView(elul, 1)).toBe(tishrei);
    expect(adjacentMonthView(cheshvan, -1)).toBe(tishrei);
  });

  it('the Hijri month containing 2026-02-18 is Ramadan 1447 starting that day (length per the ICU Umm al-Qura tables)', () => {
    const view = monthViewContaining('hijri', '2026-02-18');
    expect(view).toMatchObject({ system: 'hijri', year: 1447, monthIndex: 9, monthKey: '9', title: 'רמדאן 1447', firstDay: '2026-02-18' });
    expect([29, 30]).toContain(view.length);
    expectContiguous(view);
    expect(view.days[0].dayLabel).toBe('1');
    expect(view.days[view.length - 1].dayLabel).toBe(String(view.length));
    // First / last checked against Intl directly.
    expect(toHijriDate(view.firstDay)).toMatchObject({ year: 1447, month: 9, day: 1 });
    expect(toHijriDate(view.lastDay)).toMatchObject({ year: 1447, month: 9, day: view.length });
    expect(toHijriDate(addDaysIso(view.lastDay, 1))).toMatchObject({ year: 1447, month: 10, day: 1 });
    expect(toHijriDate(addDaysIso(view.firstDay, -1)).month).toBe(8);
    expect(adjacentMonthView(view, 1).title).toBe('שוואל 1447');
    expect(adjacentMonthView(view, -1).title).toBe('שעבאן 1447');
  });

  it('throws on bad input', () => {
    expect(() => monthViewContaining('gregorian', '2026-13-01')).toThrow(/תאריך לא תקין/);
    expect(() => monthViewContaining('hebrew', 'nope')).toThrow(/תאריך לא תקין/);
    expect(() => monthViewContaining('hijri', '')).toThrow(/תאריך לא תקין/);
  });
});

describe('monthsOfYear', () => {
  it('Hebrew 5787 (leap) has 13 months with Adar I / Adar II, 5786 has 12 with Adar', () => {
    const leap = monthsOfYear('hebrew', 5787);
    expect(leap).toHaveLength(13);
    expect(leap[0]).toEqual({ index: 1, key: 'tishrei', label: 'תשרי' });
    expect(leap[5]).toEqual({ index: 6, key: 'adar1', label: 'אדר א׳' });
    expect(leap[6]).toEqual({ index: 7, key: 'adar2', label: 'אדר ב׳' });
    expect(leap[7]).toEqual({ index: 8, key: 'nisan', label: 'ניסן' });
    expect(leap[12]).toEqual({ index: 13, key: 'elul', label: 'אלול' });
    const plain = monthsOfYear('hebrew', 5786);
    expect(plain).toHaveLength(12);
    expect(plain[5]).toEqual({ index: 6, key: 'adar', label: 'אדר' });
    expect(plain[6]).toEqual({ index: 7, key: 'nisan', label: 'ניסן' });
  });

  it('Gregorian and Hijri years have 12 numbered months', () => {
    const g = monthsOfYear('gregorian', 2026);
    expect(g).toHaveLength(12);
    expect(g[0]).toEqual({ index: 1, key: '1', label: 'ינואר' });
    expect(g[8].label).toBe('ספטמבר');
    const h = monthsOfYear('hijri', 1447);
    expect(h).toHaveLength(12);
    expect(h[0]).toEqual({ index: 1, key: '1', label: 'מוחרם' });
    expect(h[8]).toEqual({ index: 9, key: '9', label: 'רמדאן' });
  });

  it('labels the Gregorian months of a month <select> in the nominative (Greek)', () => {
    const el = monthsOfYear('gregorian', 2026, 'el');
    expect(el[9]).toEqual({ index: 10, key: '10', label: 'Οκτώβριος' });
    expect(el[0].label).toBe('Ιανουάριος');
    expect(monthsOfYear('gregorian', 2026, 'en')[9].label).toBe('October');
  });
});

describe('monthViewFor', () => {
  it('finds Hijri and Hebrew months by number', () => {
    expect(monthViewFor('hijri', 1447, 9).firstDay).toBe('2026-02-18');
    expect(monthViewFor('hijri', 1447, 9)).toBe(monthViewContaining('hijri', '2026-02-18'));
    expect(monthViewFor('hijri', 1447, 12).firstDay).toBe('2026-05-18'); // 10 Dhu al-Hijjah = 2026-05-27
    expect(monthViewFor('hijri', 1448, 4).firstDay).toBe('2026-09-12'); // 1 Rabi II 1448
    expect(monthViewFor('hebrew', 5787, 1).firstDay).toBe('2026-09-12');
    expect(monthViewFor('hebrew', 5787, 1)).toBe(monthViewContaining('hebrew', '2026-09-12'));
    expect(monthViewFor('hebrew', 5786, 12)).toMatchObject({ monthKey: 'elul', firstDay: '2026-08-14' });
    expect(monthViewFor('hebrew', 5787, 6)).toMatchObject({ monthKey: 'adar1', firstDay: '2027-02-08', length: 30 });
    expect(monthViewFor('hebrew', 5787, 7)).toMatchObject({ monthKey: 'adar2', firstDay: '2027-03-10', length: 29 });
    expect(monthViewFor('hebrew', 5787, 13)).toMatchObject({ monthKey: 'elul', year: 5787 });
    expect(monthViewFor('hebrew', 5786, 6)).toMatchObject({ monthKey: 'adar', firstDay: '2026-02-18', length: 29 });
    expect(monthViewFor('hebrew', 5786, 7)).toMatchObject({ monthKey: 'nisan', firstDay: '2026-03-19' });
    expect(monthViewFor('gregorian', 2026, 2)).toMatchObject({ firstDay: '2026-02-01', length: 28 });
  });

  it('works far from today (year selects reach 5731..5810 / current Hijri year - 40 (1408 in 2026)..1470)', () => {
    expect(monthViewFor('hebrew', 5731, 1)).toMatchObject({ year: 5731, monthIndex: 1, firstDay: '1970-10-01' });
    expect(monthViewFor('hebrew', 5770, 1)).toMatchObject({ year: 5770, monthIndex: 1 });
    expect(toHijriDate(monthViewFor('hijri', 1408, 1).firstDay)).toMatchObject({ year: 1408, month: 1, day: 1 });
    expect(monthViewFor('hebrew', 5810, 12)).toMatchObject({ year: 5810, monthIndex: 12 });
    expect(monthViewFor('hijri', 1430, 1)).toMatchObject({ year: 1430, monthIndex: 1 });
    expect(monthViewFor('hijri', 1470, 12)).toMatchObject({ year: 1470, monthIndex: 12 });
    expect(toHebrewDate(monthViewFor('hebrew', 5800, 5).firstDay)).toMatchObject({ year: 5800, month: 'shevat', day: 1 });
    expect(toHijriDate(monthViewFor('hijri', 1460, 7).firstDay)).toMatchObject({ year: 1460, month: 7, day: 1 });
  });

  it('rejects months outside the year', () => {
    expect(() => monthViewFor('gregorian', 2026, 0)).toThrow(RangeError);
    expect(() => monthViewFor('gregorian', 2026, 13)).toThrow(RangeError);
    expect(() => monthViewFor('hebrew', 5786, 13)).toThrow(RangeError);
    expect(() => monthViewFor('hebrew', 5787, 14)).toThrow(RangeError);
    expect(() => monthViewFor('hijri', 1447, 13)).toThrow(RangeError);
    expect(() => monthViewFor('hijri', 1447.5, 1)).toThrow(RangeError);
  });

  it('round-trips with monthViewContaining and adjacentMonthView in every system', () => {
    const samples = ['2026-01-01', '2026-02-18', '2026-09-12', '2026-10-11', '2026-12-31', '2027-03-10', '2030-06-15'];
    for (const system of CALENDAR_SYSTEMS) {
      for (const iso of samples) {
        const view = monthViewContaining(system, iso);
        expect(iso >= view.firstDay && iso <= view.lastDay, `${system} ${iso}`).toBe(true);
        expect(monthViewFor(system, view.year, view.monthIndex), `${system} ${iso}`).toBe(view);
        expect(adjacentMonthView(adjacentMonthView(view, 1), -1)).toBe(view);
        expect(adjacentMonthView(adjacentMonthView(view, -1), 1)).toBe(view);
      }
    }
  });

  it('walks a Hebrew year month by month in Tishrei order with the year changing at Tishrei', () => {
    let view = monthViewFor('hebrew', 5786, 12); // Elul 5786
    const seen: string[] = [];
    for (let i = 0; i < 14; i++) {
      view = adjacentMonthView(view, 1);
      seen.push(`${view.year}:${view.monthIndex}:${view.monthKey}`);
    }
    expect(seen).toEqual([
      '5787:1:tishrei',
      '5787:2:cheshvan',
      '5787:3:kislev',
      '5787:4:tevet',
      '5787:5:shevat',
      '5787:6:adar1',
      '5787:7:adar2',
      '5787:8:nisan',
      '5787:9:iyar',
      '5787:10:sivan',
      '5787:11:tammuz',
      '5787:12:av',
      '5787:13:elul',
      '5788:1:tishrei',
    ]);
  });

  it('walks a Hijri year: 12 months of 29 or 30 days, contiguous', () => {
    let view = monthViewFor('hijri', 1447, 1);
    let total = 0;
    for (let i = 1; i <= 12; i++) {
      expect(view.monthIndex).toBe(i);
      expect(view.year).toBe(1447);
      expect([29, 30]).toContain(view.length);
      expectContiguous(view);
      total += view.length;
      const next = adjacentMonthView(view, 1);
      expect(next.firstDay).toBe(addDaysIso(view.lastDay, 1));
      view = next;
    }
    expect(view).toMatchObject({ year: 1448, monthIndex: 1 });
    expect([354, 355]).toContain(total);
  });

  it('is fast: 36 consecutive months per system well under a second', () => {
    const t = performance.now();
    for (const system of CALENDAR_SYSTEMS) {
      let view = monthViewContaining(system, '2031-01-01');
      for (let i = 0; i < 36; i++) view = adjacentMonthView(view, 1);
      for (let i = 0; i < 36; i++) view = adjacentMonthView(view, -1);
    }
    expect(performance.now() - t).toBeLessThan(800);
  });
});

describe('civil formatting', () => {
  it('formats a civil day and a civil span', () => {
    expect(formatCivilDate('2026-09-12')).toBe('12 בספטמבר 2026');
    expect(formatCivilDate('2026-09-12', { withYear: false })).toBe('12 בספטמבר');
    expect(formatCivilDayMonth('2026-09-12')).toBe('12.9');
    expect(formatCivilDayMonth('2026-10-01')).toBe('1.10');
    expect(civilSpan('2026-09-12', '2026-10-11')).toBe('12 בספטמבר – 11 באוקטובר 2026');
    expect(civilSpan('2026-09-01', '2026-09-30')).toBe('1–30 בספטמבר 2026');
    expect(civilSpan('2026-12-20', '2027-01-18')).toBe('20 בדצמבר 2026 – 18 בינואר 2027');
  });

  it('formats the full date of a day in each system', () => {
    expect(formatSystemDate('gregorian', '2026-09-12')).toBe('12 בספטמבר 2026');
    expect(formatSystemDate('hebrew', '2026-09-12')).toBe('א׳ בתשרי תשפ״ז');
    expect(formatSystemDate('hijri', '2026-09-12')).toBe('1 ברביע א-ת׳אני 1448');
    expect(formatSystemDate('hebrew', '2026-09-12', { withYear: false })).toBe('א׳ בתשרי');
  });
});

describe('otherDatesLabel / otherMonthSpans', () => {
  it('names the two calendars that are not selected, honouring the extras', () => {
    expect(otherDatesLabel('2026-09-12', ALL)).toBe('א׳ בתשרי תשפ״ז, 1 ברביע א-ת׳אני 1448');
    expect(otherDatesLabel('2026-09-12', ALL, 'gregorian')).toBe('א׳ בתשרי תשפ״ז, 1 ברביע א-ת׳אני 1448');
    expect(otherDatesLabel('2026-09-12', ALL, 'hebrew')).toBe('12 בספטמבר 2026, 1 ברביע א-ת׳אני 1448');
    expect(otherDatesLabel('2026-09-12', ALL, 'hijri')).toBe('12 בספטמבר 2026, א׳ בתשרי תשפ״ז');
    expect(otherDatesLabel('2026-09-12', NONE, 'hebrew')).toBe('12 בספטמבר 2026');
    expect(otherDatesLabel('2026-09-12', { ...NONE, hijriDates: true }, 'hebrew')).toBe('12 בספטמבר 2026, 1 ברביע א-ת׳אני 1448');
    expect(otherDatesLabel('2026-09-12', NONE)).toBe('');
    expect(() => otherDatesLabel('bad', ALL)).toThrow(/תאריך לא תקין/);
  });

  it('builds the caption spans of a view', () => {
    const sept = monthViewContaining('gregorian', '2026-09-01');
    expect(otherMonthSpans(sept, ALL)).toEqual(['אלול תשפ״ו – תשרי תשפ״ז', 'רביע אל-אוול–רביע א-ת׳אני 1448']);
    expect(otherMonthSpans(sept, NONE)).toEqual([]);
    const tishrei = monthViewContaining('hebrew', '2026-09-12');
    // Rabi II 1448 starts on 12 September; whether Jumada I starts on 11 October depends on the ICU Umm al-Qura table.
    expect(otherMonthSpans(tishrei, ALL)).toEqual(['12 בספטמבר – 11 באוקטובר 2026', hijriMonthSpan('2026-09-12', '2026-10-11')]);
    expect(otherMonthSpans(tishrei, ALL)[1]).toMatch(/^רביע א-ת׳אני(–ג׳ומאדא אל-אולא)? 1448$/);
    expect(otherMonthSpans(tishrei, NONE)).toEqual(['12 בספטמבר – 11 באוקטובר 2026']);
    const ramadan = monthViewContaining('hijri', '2026-02-18');
    const spans = otherMonthSpans(ramadan, ALL);
    expect(spans).toHaveLength(2);
    expect(spans[0]).toMatch(/^18 בפברואר – \d+ במרץ 2026$/);
    expect(spans[1]).toMatch(/^אדר(–ניסן)? תשפ״ו$/);
  });
});

describe('type of MonthView', () => {
  it('is frozen and shared between calls', () => {
    const view = monthViewContaining('hebrew', '2026-09-12');
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.days)).toBe(true);
    const systems: CalendarSystem[] = ['gregorian', 'hebrew', 'hijri'];
    for (const s of systems) expect(monthViewContaining(s, '2026-05-05')).toBe(monthViewContaining(s, '2026-05-05'));
  });
});
