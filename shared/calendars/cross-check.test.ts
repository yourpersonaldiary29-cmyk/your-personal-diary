/**
 * Regression tests distilled from an independent cross-check of the calendar
 * module (September 2026):
 *
 * - Hebrew dates and the Jewish rules were recomputed with a pure-arithmetic
 *   Hebrew calendar (Dershowitz & Reingold, no Intl) for every day of
 *   2023-12-01..2031-01-31 and for the holiday tables of 2024-2030;
 * - Easter with Gauss's algorithm (1583-2299) and an independent Julian ->
 *   Gregorian conversion;
 * - Hijri dates with a separate `islamic-umalqura` reader, against the
 *   published Umm al-Qura dates.
 *
 * The constants below come from those independent computations, not from the
 * module, so a regression in either Intl or the rules shows up here.
 */
import { describe, expect, it } from 'vitest';
import {
  CIVIL_HIJRI_NOTE,
  DEFAULT_CALENDAR_EXTRAS,
  HIJRI_MONTH_NAMES,
  UMM_AL_QURA_NOTE,
  clearHolidayCache,
  describeDay,
  describeHolidayAmong,
  hebrewNumeral,
  hebrewYearNumeral,
  holidaysForYear,
  holidaysInRange,
  holidaysOn,
  isHebrewLeapYear,
  orthodoxEaster,
  toHebrewDate,
  toHijriDate,
  westernEaster,
  type HebrewDate,
  type HijriDate,
} from './index';
import { addDaysIso, weekdayOf } from './civil';

const SUN = 0;
const MON = 1;
const TUE = 2;
const WED = 3;
const THU = 4;
const SAT = 6;

const jewish = (year: number) => holidaysForYear(year, 'jewish');
const one = (year: number, id: string, dayIndex?: number) => {
  const found = holidaysForYear(year, id.split('.')[0] as 'jewish' | 'muslim' | 'christian' | 'druze').filter(
    (h) => h.id === id && (dayIndex === undefined || h.dayIndex === dayIndex),
  );
  expect(found, `${id} ${year}`).toHaveLength(1);
  return found[0];
};
const dates = (year: number, id: string) =>
  holidaysForYear(year, id.split('.')[0] as 'jewish' | 'muslim' | 'christian' | 'druze')
    .filter((h) => h.id === id)
    .map((h) => h.date);

describe('cross-check: Hebrew calendar arithmetic', () => {
  it('Cheshvan/Kislev lengths and day 30 for 5785-5791 (arithmetic reference)', () => {
    // year -> [30 Cheshvan, 30 Kislev] civil dates ('' = the month has 29 days)
    const table: Record<number, [string, string]> = {
      5785: ['2024-12-01', '2024-12-31'],
      5786: ['', '2025-12-20'],
      5787: ['2026-11-10', '2026-12-10'],
      5788: ['2027-11-30', '2027-12-30'],
      5789: ['', '2028-12-18'],
      5790: ['', ''],
      5791: ['2030-11-26', '2030-12-26'],
    };
    for (const [year, [cheshvan30, kislev30]] of Object.entries(table)) {
      if (cheshvan30) {
        expect(toHebrewDate(cheshvan30), `30 Cheshvan ${year}`).toMatchObject({ year: Number(year), month: 'cheshvan', day: 30, monthLength: 30 });
        expect(toHebrewDate(addDaysIso(cheshvan30, 1))).toMatchObject({ month: 'kislev', day: 1 });
      }
      if (kislev30) {
        expect(toHebrewDate(kislev30), `30 Kislev ${year}`).toMatchObject({ year: Number(year), month: 'kislev', day: 30, monthLength: 30 });
        expect(toHebrewDate(addDaysIso(kislev30, 1))).toMatchObject({ month: 'tevet', day: 1 });
      }
    }
    // 5786 and 5789: Cheshvan has 29 days; 5790: both have 29 (a "deficient" leap year of 383 days).
    expect(toHebrewDate('2025-11-21')).toMatchObject({ month: 'kislev', day: 1, monthLength: 30 });
    expect(toHebrewDate('2025-11-20')).toMatchObject({ month: 'cheshvan', day: 29, monthLength: 29 });
    expect(toHebrewDate('2028-11-19')).toMatchObject({ month: 'kislev', day: 1 });
    expect(toHebrewDate('2028-11-18')).toMatchObject({ month: 'cheshvan', day: 29, monthLength: 29 });
    expect(toHebrewDate('2029-11-08')).toMatchObject({ month: 'kislev', day: 1, monthLength: 29 });
    expect(toHebrewDate('2029-12-07')).toMatchObject({ month: 'tevet', day: 1 });
    expect(toHebrewDate('2029-12-06')).toMatchObject({ month: 'kislev', day: 29, monthLength: 29 });
  });

  it('5790 is a leap year: Adar I / Adar II, never a plain "adar"; 5789 never has Adar I/II', () => {
    expect(isHebrewLeapYear(5790)).toBe(true);
    expect(isHebrewLeapYear(5789)).toBe(false);
    expect(toHebrewDate('2030-02-04')).toMatchObject({ year: 5790, month: 'adar1', monthName: 'אדר א׳', day: 1, isLeapYear: true, monthLength: 30 });
    expect(toHebrewDate('2030-03-06')).toMatchObject({ year: 5790, month: 'adar2', monthName: 'אדר ב׳', day: 1, isLeapYear: true, monthLength: 29 });
    for (let iso = '2029-09-10'; iso <= '2030-09-27'; iso = addDaysIso(iso, 1)) {
      const hd = toHebrewDate(iso);
      expect(hd.year, iso).toBe(5790);
      expect(hd.isLeapYear, iso).toBe(true);
      expect(hd.month, iso).not.toBe('adar');
    }
    for (let iso = '2028-09-21'; iso <= '2029-09-09'; iso = addDaysIso(iso, 1)) {
      const hd = toHebrewDate(iso);
      expect(hd.year, iso).toBe(5789);
      expect(hd.isLeapYear, iso).toBe(false);
      expect(['adar1', 'adar2'], iso).not.toContain(hd.month);
    }
  });

  it('returns frozen, shared objects (a caller cannot corrupt the memo cache)', () => {
    const hd = toHebrewDate('2028-04-11');
    expect(Object.isFrozen(hd)).toBe(true);
    expect(() => {
      (hd as { day: number }).day = 99;
    }).toThrow(TypeError);
    expect(toHebrewDate('2028-04-11').day).toBe(15);
    const hj = toHijriDate('2028-04-11');
    expect(Object.isFrozen(hj)).toBe(true);
    expect(() => {
      (hj as { month: number }).month = 1;
    }).toThrow(TypeError);
    expect(toHijriDate('2028-04-11')).toBe(hj);
    // Spreading still gives a mutable copy.
    const copy: HebrewDate = { ...hd, day: 1 };
    expect(copy.day).toBe(1);
    const copy2: HijriDate = { ...hj, day: 1 };
    expect(copy2.day).toBe(1);
  });
});

describe('cross-check: Jewish holidays 2028-2030 (arithmetic reference dates)', () => {
  it('fixed-date holidays 5788-5791', () => {
    expect(one(2027, 'jewish.rosh-hashana', 1).date).toBe('2027-10-02');
    expect(one(2028, 'jewish.rosh-hashana', 1).date).toBe('2028-09-21');
    expect(one(2029, 'jewish.rosh-hashana', 1).date).toBe('2029-09-10');
    expect(one(2030, 'jewish.rosh-hashana', 1).date).toBe('2030-09-28');
    expect(one(2027, 'jewish.yom-kippur').date).toBe('2027-10-11');
    expect(one(2028, 'jewish.yom-kippur').date).toBe('2028-09-30');
    expect(one(2029, 'jewish.yom-kippur').date).toBe('2029-09-19');
    expect(one(2030, 'jewish.yom-kippur').date).toBe('2030-10-07');
    expect(one(2028, 'jewish.sukkot', 1).date).toBe('2028-10-05');
    expect(one(2029, 'jewish.sukkot', 1).date).toBe('2029-09-24');
    expect(one(2030, 'jewish.sukkot', 1).date).toBe('2030-10-12');
    expect(one(2028, 'jewish.shemini-atzeret').date).toBe('2028-10-12');
    expect(one(2029, 'jewish.shemini-atzeret').date).toBe('2029-10-01');
    expect(one(2030, 'jewish.shemini-atzeret').date).toBe('2030-10-19');
    expect(one(2028, 'jewish.tu-bishvat').date).toBe('2028-02-12');
    expect(one(2029, 'jewish.tu-bishvat').date).toBe('2029-01-31');
    expect(one(2030, 'jewish.tu-bishvat').date).toBe('2030-01-19');
    expect(one(2028, 'jewish.pesach', 1).date).toBe('2028-04-11');
    expect(one(2029, 'jewish.pesach', 1).date).toBe('2029-03-31');
    expect(one(2030, 'jewish.pesach', 1).date).toBe('2030-04-18');
    expect(one(2028, 'jewish.lag-baomer').date).toBe('2028-05-14');
    expect(one(2029, 'jewish.lag-baomer').date).toBe('2029-05-03');
    expect(one(2030, 'jewish.lag-baomer').date).toBe('2030-05-21');
    expect(one(2028, 'jewish.yom-yerushalayim').date).toBe('2028-05-24');
    expect(one(2029, 'jewish.yom-yerushalayim').date).toBe('2029-05-13');
    expect(one(2030, 'jewish.yom-yerushalayim').date).toBe('2030-05-31');
    expect(one(2028, 'jewish.shavuot').date).toBe('2028-05-31');
    expect(one(2029, 'jewish.shavuot').date).toBe('2029-05-20');
    expect(one(2030, 'jewish.shavuot').date).toBe('2030-06-07');
    expect(one(2028, 'jewish.tu-bav').date).toBe('2028-08-07');
    expect(one(2029, 'jewish.tu-bav').date).toBe('2029-07-27');
    expect(one(2030, 'jewish.tu-bav').date).toBe('2030-08-14');
    // 10 Tevet twice in 2028 (5788 and 5789), once in 2029 and 2030 (10 Tevet 5791 = 2031-01-05).
    expect(dates(2028, 'jewish.asara-btevet')).toEqual(['2028-01-09', '2028-12-28']);
    expect(dates(2029, 'jewish.asara-btevet')).toEqual(['2029-12-16']);
    expect(dates(2030, 'jewish.asara-btevet')).toEqual([]);
    expect(dates(2031, 'jewish.asara-btevet')).toContain('2031-01-05');
  });

  it('Purim: Adar in 5788/5789, Adar II in the leap year 5790', () => {
    expect(toHebrewDate('2028-03-12')).toMatchObject({ month: 'adar', day: 14, isLeapYear: false });
    expect(one(2028, 'jewish.purim').date).toBe('2028-03-12');
    expect(one(2028, 'jewish.shushan-purim').date).toBe('2028-03-13');
    expect(one(2029, 'jewish.purim').date).toBe('2029-03-01');
    expect(toHebrewDate('2030-03-19')).toMatchObject({ month: 'adar2', day: 14, isLeapYear: true });
    expect(one(2030, 'jewish.purim').date).toBe('2030-03-19');
    expect(one(2030, 'jewish.shushan-purim').date).toBe('2030-03-20');
    // 14 Adar I 5790 (2030-02-17) is not Purim.
    expect(toHebrewDate('2030-02-17')).toMatchObject({ month: 'adar1', day: 14 });
    expect(holidaysOn('2030-02-17', ['jewish']).map((h) => h.id)).toEqual([]);
  });

  it('תענית אסתר: Shabbat 13 Adar 5788 -> Thursday; plain in 5789/5790', () => {
    expect(weekdayOf('2028-03-11')).toBe(SAT);
    expect(one(2028, 'jewish.taanit-esther')).toMatchObject({ date: '2028-03-09', note: 'הוקדם מיום שבת' });
    expect(weekdayOf('2028-03-09')).toBe(THU);
    expect(one(2029, 'jewish.taanit-esther')).toMatchObject({ date: '2029-02-28' });
    expect(one(2029, 'jewish.taanit-esther').note).toBeUndefined();
    expect(one(2030, 'jewish.taanit-esther')).toMatchObject({ date: '2030-03-18' });
  });

  it('יום השואה: Sunday 27 Nisan 5788 -> Monday; unmoved on Thursday (5789) and Tuesday (5790)', () => {
    expect(weekdayOf('2028-04-23')).toBe(SUN);
    expect(one(2028, 'jewish.yom-hashoah')).toMatchObject({ date: '2028-04-24', note: 'נדחה מיום ראשון' });
    expect(weekdayOf('2029-04-12')).toBe(THU);
    expect(one(2029, 'jewish.yom-hashoah')).toMatchObject({ date: '2029-04-12' });
    expect(one(2029, 'jewish.yom-hashoah').note).toBeUndefined();
    expect(weekdayOf('2030-04-30')).toBe(TUE);
    expect(one(2030, 'jewish.yom-hashoah')).toMatchObject({ date: '2030-04-30' });
  });

  it('יום העצמאות / יום הזיכרון: Monday -> Tuesday (5788), Friday -> Thursday (5789), Wednesday unmoved (5790)', () => {
    expect(weekdayOf('2028-05-01')).toBe(MON);
    expect(one(2028, 'jewish.yom-haatzmaut')).toMatchObject({ date: '2028-05-02', note: 'נדחה מיום שני' });
    expect(one(2028, 'jewish.yom-hazikaron')).toMatchObject({ date: '2028-05-01', note: 'הוזז יחד עם יום העצמאות' });
    expect(weekdayOf('2029-04-20')).toBe(5);
    expect(one(2029, 'jewish.yom-haatzmaut')).toMatchObject({ date: '2029-04-19', note: 'הוקדם מיום שישי' });
    expect(one(2029, 'jewish.yom-hazikaron')).toMatchObject({ date: '2029-04-18', note: 'הוזז יחד עם יום העצמאות' });
    expect(weekdayOf('2030-05-08')).toBe(WED);
    expect(one(2030, 'jewish.yom-haatzmaut')).toMatchObject({ date: '2030-05-08' });
    expect(one(2030, 'jewish.yom-haatzmaut').note).toBeUndefined();
    expect(one(2030, 'jewish.yom-hazikaron')).toMatchObject({ date: '2030-05-07' });
    expect(one(2030, 'jewish.yom-hazikaron').note).toBeUndefined();
    // Never on Friday/Saturday/Monday, and Yom HaZikaron is always the day before, 2020-2045.
    for (let year = 2020; year <= 2045; year++) {
      const ha = one(year, 'jewish.yom-haatzmaut');
      const zk = one(year, 'jewish.yom-hazikaron');
      expect([TUE, WED, THU], `yom haatzmaut ${year} ${ha.date}`).toContain(weekdayOf(ha.date));
      expect(zk.date, `yom hazikaron ${year}`).toBe(addDaysIso(ha.date, -1));
    }
  });

  it('fasts on Shabbat -> Sunday: 17 Tammuz and 9 Av 5789 (2029), 3 Tishrei 5789 (2028); unmoved otherwise', () => {
    expect(weekdayOf('2029-06-30')).toBe(SAT);
    expect(one(2029, 'jewish.tzom-tammuz')).toMatchObject({ date: '2029-07-01', note: 'נדחה מיום שבת' });
    expect(weekdayOf('2029-07-21')).toBe(SAT);
    expect(one(2029, 'jewish.tisha-bav')).toMatchObject({ date: '2029-07-22', note: 'נדחה מיום שבת' });
    expect(weekdayOf('2028-09-23')).toBe(SAT);
    expect(one(2028, 'jewish.tzom-gedaliah')).toMatchObject({ date: '2028-09-24', note: 'נדחה מיום שבת' });
    expect(one(2028, 'jewish.tzom-tammuz')).toMatchObject({ date: '2028-07-11' });
    expect(one(2028, 'jewish.tisha-bav')).toMatchObject({ date: '2028-08-01' });
    expect(one(2030, 'jewish.tzom-tammuz')).toMatchObject({ date: '2030-07-18' });
    expect(one(2030, 'jewish.tisha-bav')).toMatchObject({ date: '2030-08-08' });
    expect(one(2029, 'jewish.tzom-gedaliah')).toMatchObject({ date: '2029-09-12' });
    expect(one(2030, 'jewish.tzom-gedaliah')).toMatchObject({ date: '2030-09-30' });
    // A fast is never shown on Shabbat, 2020-2045.
    for (let year = 2020; year <= 2045; year++) {
      for (const h of jewish(year)) if (h.kind === 'fast') expect(weekdayOf(h.date), `${h.id} ${h.date}`).not.toBe(SAT);
    }
  });

  it('סיגד: Shabbat 29 Cheshvan 5789 -> Thursday 2028-11-16; Monday 5788/5791 and Wednesday 5790 unmoved', () => {
    expect(weekdayOf('2028-11-18')).toBe(SAT);
    expect(one(2028, 'jewish.sigd')).toMatchObject({ date: '2028-11-16', note: 'הוקדם מיום שבת' });
    expect(one(2027, 'jewish.sigd')).toMatchObject({ date: '2027-11-29' });
    expect(one(2029, 'jewish.sigd')).toMatchObject({ date: '2029-11-07' });
    expect(one(2030, 'jewish.sigd')).toMatchObject({ date: '2030-11-25' });
  });

  it('חנוכה 5790 spans a 29-day Kislev: 8 consecutive days 2029-12-02..09, day 6 is 1 Tevet', () => {
    const days = jewish(2029).filter((h) => h.id === 'jewish.hanukkah');
    expect(days.map((h) => [h.date, h.dayIndex])).toEqual([
      ['2029-12-02', 1],
      ['2029-12-03', 2],
      ['2029-12-04', 3],
      ['2029-12-05', 4],
      ['2029-12-06', 5],
      ['2029-12-07', 6],
      ['2029-12-08', 7],
      ['2029-12-09', 8],
    ]);
    expect(toHebrewDate('2029-12-07')).toMatchObject({ month: 'tevet', day: 1 });
    const onFirstOfTevet = holidaysOn('2029-12-07', ['jewish']);
    expect(onFirstOfTevet.map((h) => h.id)).toEqual(['jewish.hanukkah', 'jewish.rosh-chodesh']);
    expect(onFirstOfTevet[1].dayIndex).toBeUndefined(); // one-day Rosh Chodesh after a 29-day Kislev
    // Other years: first day of Hanukkah.
    expect(one(2027, 'jewish.hanukkah', 1).date).toBe('2027-12-25');
    expect(one(2028, 'jewish.hanukkah', 1).date).toBe('2028-12-13');
    expect(one(2030, 'jewish.hanukkah', 1).date).toBe('2030-12-21');
    // Hanukkah 5788 straddles 2027/2028: day 8 = 2028-01-01, reported once.
    expect(holidaysInRange('2027-12-30', '2028-01-03', ['jewish']).filter((h) => h.id === 'jewish.hanukkah').map((h) => [h.date, h.dayIndex])).toEqual([
      ['2027-12-30', 6],
      ['2027-12-31', 7],
      ['2028-01-01', 8],
    ]);
  });

  it('ראש חודש: two days around a 30-day month (Tevet 5788, Adar II 5790), one day otherwise', () => {
    expect(holidaysOn('2027-12-30', ['jewish']).find((h) => h.id === 'jewish.rosh-chodesh')).toMatchObject({ name: 'ראש חודש טבת', dayIndex: 1, dayCount: 2 });
    expect(holidaysOn('2027-12-31', ['jewish']).find((h) => h.id === 'jewish.rosh-chodesh')).toMatchObject({ name: 'ראש חודש טבת', dayIndex: 2, dayCount: 2 });
    expect(holidaysOn('2030-03-05', ['jewish']).find((h) => h.id === 'jewish.rosh-chodesh')).toMatchObject({ name: 'ראש חודש אדר ב׳', dayIndex: 1, dayCount: 2 });
    expect(holidaysOn('2030-03-06', ['jewish']).find((h) => h.id === 'jewish.rosh-chodesh')).toMatchObject({ name: 'ראש חודש אדר ב׳', dayIndex: 2, dayCount: 2 });
    // 1 Nisan 5790 follows a 29-day Adar II: single day.
    const nisan = holidaysOn('2030-04-04', ['jewish']).find((h) => h.id === 'jewish.rosh-chodesh');
    expect(nisan).toMatchObject({ name: 'ראש חודש ניסן' });
    expect(nisan?.dayIndex).toBeUndefined();
    // Never on 1 Tishrei; every day-30 entry is followed by a day-2 entry the next day.
    for (let year = 2024; year <= 2030; year++) {
      const rc = jewish(year).filter((h) => h.id === 'jewish.rosh-chodesh');
      for (const h of rc) {
        const hd = toHebrewDate(h.date);
        expect(hd.month === 'tishrei' && hd.day === 1, `${h.date}`).toBe(false);
        expect([1, 30], `${h.date}`).toContain(hd.day);
        if (hd.day === 30) {
          expect(h.dayIndex).toBe(1);
          const next = holidaysOn(addDaysIso(h.date, 1), ['jewish']).find((x) => x.id === 'jewish.rosh-chodesh');
          expect(next, `${h.date}+1`).toMatchObject({ dayIndex: 2, dayCount: 2, name: h.name });
        }
      }
    }
  });

  it('a range scan starting mid-Hanukkah reports days 4-8 with the right dayIndex', () => {
    const r = holidaysInRange('2026-12-08', '2026-12-20', ['jewish']);
    expect(r.filter((h) => h.id === 'jewish.hanukkah').map((h) => [h.date, h.dayIndex, h.dayCount])).toEqual([
      ['2026-12-08', 4, 8],
      ['2026-12-09', 5, 8],
      ['2026-12-10', 6, 8],
      ['2026-12-11', 7, 8],
      ['2026-12-12', 8, 8],
    ]);
    expect(r.map((h) => h.id)).toEqual([
      'jewish.hanukkah',
      'jewish.hanukkah',
      'jewish.hanukkah',
      'jewish.rosh-chodesh',
      'jewish.hanukkah',
      'jewish.rosh-chodesh',
      'jewish.hanukkah',
      'jewish.asara-btevet',
    ]);
  });
});

describe('cross-check: Muslim and Druze holidays 2024-2030 (Umm al-Qura)', () => {
  it('reference dates 2028-2030', () => {
    expect(one(2028, 'muslim.ramadan-start').date).toBe('2028-01-28');
    expect(one(2028, 'muslim.laylat-al-qadr').date).toBe('2028-02-23');
    expect(one(2028, 'muslim.eid-al-fitr', 1).date).toBe('2028-02-26');
    expect(one(2028, 'muslim.arafah').date).toBe('2028-05-04');
    expect(one(2028, 'muslim.eid-al-adha', 1).date).toBe('2028-05-05');
    expect(one(2028, 'muslim.hijri-new-year').date).toBe('2028-05-25');
    expect(one(2028, 'muslim.ashura').date).toBe('2028-06-03');
    expect(one(2028, 'muslim.mawlid').date).toBe('2028-08-03');
    expect(one(2028, 'muslim.isra-miraj').date).toBe('2028-12-14');
    expect(one(2029, 'muslim.ramadan-start').date).toBe('2029-01-16');
    expect(one(2029, 'muslim.eid-al-fitr', 1).date).toBe('2029-02-14');
    expect(one(2029, 'muslim.eid-al-adha', 1).date).toBe('2029-04-24');
    expect(one(2029, 'muslim.hijri-new-year').date).toBe('2029-05-14');
    expect(one(2029, 'muslim.mawlid').date).toBe('2029-07-24');
    expect(one(2030, 'muslim.eid-al-fitr', 1).date).toBe('2030-02-04');
    expect(one(2030, 'muslim.arafah').date).toBe('2030-04-12');
    expect(one(2030, 'muslim.eid-al-adha', 1).date).toBe('2030-04-13');
    expect(one(2030, 'muslim.hijri-new-year').date).toBe('2030-05-04');
    expect(toHijriDate('2030-05-04')).toEqual({ year: 1452, month: 1, monthName: 'מוחרם', day: 1 });
    expect(one(2024, 'muslim.isra-miraj').date).toBe('2024-02-08');
    expect(one(2024, 'muslim.ashura').date).toBe('2024-07-16');
    expect(one(2024, 'muslim.mawlid').date).toBe('2024-09-15');
  });

  it('a Hijri holiday can occur twice in one civil year: Ramadan 2030, Isra Mi\'raj 2027', () => {
    expect(dates(2030, 'muslim.ramadan-start')).toEqual(['2030-01-05', '2030-12-26']);
    expect(dates(2027, 'muslim.isra-miraj')).toEqual(['2027-01-05', '2027-12-25']);
    expect(dates(2028, 'muslim.hijri-new-year')).toEqual(['2028-05-25']);
  });

  it('Druze Eid al-Adha follows the Muslim one, 4 days, with the moon-sighting note', () => {
    for (let year = 2024; year <= 2030; year++) {
      const muslim = dates(year, 'muslim.eid-al-adha');
      const druze = dates(year, 'druze.eid-al-adha');
      expect(druze, `${year}`).toEqual(muslim);
      expect(druze).toHaveLength(4);
      expect(one(year, 'druze.eid-al-adha', 1).note).toBe(UMM_AL_QURA_NOTE);
    }
    expect(dates(2030, 'druze.nabi-shuayb')).toEqual(['2030-04-25', '2030-04-26', '2030-04-27', '2030-04-28']);
  });

  it('Hijri month names: 12 distinct Hebrew transliterations', () => {
    expect([...HIJRI_MONTH_NAMES]).toEqual([
      'מוחרם',
      'צפר',
      'רביע אל-אוול',
      'רביע א-ת׳אני',
      'ג׳ומאדא אל-אולא',
      'ג׳ומאדא א-ת׳אניה',
      'רג׳ב',
      'שעבאן',
      'רמדאן',
      'שוואל',
      'ד׳ו אל-קעדה',
      'ד׳ו אל-חיג׳ה',
    ]);
    expect(new Set(HIJRI_MONTH_NAMES).size).toBe(12);
    for (let m = 1; m <= 12; m++) expect(HIJRI_MONTH_NAMES[m - 1]).toMatch(/^[א-ת׳ '-]+$/);
  });

  it('the tabular-calendar fallback note admits a two-day difference', () => {
    // 1 Muharram 1447 and 1 Ramadan 1451 are two days apart in islamic-civil vs Umm al-Qura.
    expect(CIVIL_HIJRI_NOTE).toMatch(/יומיים/);
    expect(UMM_AL_QURA_NOTE).toMatch(/ביום אחד/);
  });
});

describe('cross-check: Christian holidays 2024-2030 (Gauss)', () => {
  it('Easter dates and Lazarus Saturday = Orthodox Easter - 8', () => {
    const western: Record<number, string> = { 2024: '2024-03-31', 2025: '2025-04-20', 2026: '2026-04-05', 2027: '2027-03-28', 2028: '2028-04-16', 2029: '2029-04-01', 2030: '2030-04-21' };
    const orthodox: Record<number, string> = { 2024: '2024-05-05', 2025: '2025-04-20', 2026: '2026-04-12', 2027: '2027-05-02', 2028: '2028-04-16', 2029: '2029-04-08', 2030: '2030-04-28' };
    for (let year = 2024; year <= 2030; year++) {
      expect(westernEaster(year)).toBe(western[year]);
      expect(orthodoxEaster(year)).toBe(orthodox[year]);
      expect(one(year, 'christian.easter.western').date).toBe(western[year]);
      expect(one(year, 'christian.easter.orthodox').date).toBe(orthodox[year]);
      expect(one(year, 'christian.lazarus-saturday').date).toBe(addDaysIso(orthodox[year], -8));
      expect(weekdayOf(one(year, 'christian.lazarus-saturday').date)).toBe(SAT);
      expect(one(year, 'christian.ash-wednesday').date).toBe(addDaysIso(western[year], -46));
      expect(weekdayOf(one(year, 'christian.ash-wednesday').date)).toBe(WED);
      expect(one(year, 'christian.pentecost.orthodox').date).toBe(addDaysIso(orthodox[year], 49));
      expect(one(year, 'christian.christmas.orthodox').date).toBe(`${year}-01-07`);
      expect(one(year, 'christian.epiphany.orthodox').date).toBe(`${year}-01-19`);
    }
    // 2028: both Easters coincide (16 April) but keep separate ids.
    expect(holidaysOn('2028-04-16', ['christian']).map((h) => h.id)).toEqual(['christian.easter.western', 'christian.easter.orthodox']);
  });
});

describe('cross-check: numerals, errors, screen-reader text, performance', () => {
  it('Hebrew numerals 1..30 use geresh (U+05F3) for one letter and gershayim (U+05F4) before the last letter', () => {
    const expected = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳', 'י׳', 'י״א', 'י״ב', 'י״ג', 'י״ד', 'ט״ו', 'ט״ז', 'י״ז', 'י״ח', 'י״ט', 'כ׳', 'כ״א', 'כ״ב', 'כ״ג', 'כ״ד', 'כ״ה', 'כ״ו', 'כ״ז', 'כ״ח', 'כ״ט', 'ל׳'];
    for (let n = 1; n <= 30; n++) {
      const s = hebrewNumeral(n);
      expect(s, `${n}`).toBe(expected[n - 1]);
      if (s.length === 2) expect(s.charCodeAt(1), `${n} geresh`).toBe(0x05f3);
      else expect(s.charCodeAt(s.length - 2), `${n} gershayim`).toBe(0x05f4);
    }
  });

  it('Hebrew years 5780..5800', () => {
    const expected: Record<number, string> = {
      5780: 'תש״פ', 5781: 'תשפ״א', 5782: 'תשפ״ב', 5783: 'תשפ״ג', 5784: 'תשפ״ד', 5785: 'תשפ״ה', 5786: 'תשפ״ו', 5787: 'תשפ״ז', 5788: 'תשפ״ח', 5789: 'תשפ״ט',
      5790: 'תש״צ', 5791: 'תשצ״א', 5792: 'תשצ״ב', 5793: 'תשצ״ג', 5794: 'תשצ״ד', 5795: 'תשצ״ה', 5796: 'תשצ״ו', 5797: 'תשצ״ז', 5798: 'תשצ״ח', 5799: 'תשצ״ט', 5800: 'ת״ת',
    };
    for (const [year, s] of Object.entries(expected)) expect(hebrewYearNumeral(Number(year)), year).toBe(s);
  });

  it('an unknown tradition is a clear Hebrew error, not a TypeError', () => {
    expect(() => holidaysForYear(2026, 'klingon' as never)).toThrow(/מסורת לא מוכרת: klingon/);
    expect(() => holidaysForYear(2026, undefined as never)).toThrow(/מסורת לא מוכרת/);
    // Unknown entries in a traditions filter are ignored (lenient), valid ones still work.
    expect(holidaysOn('2026-09-12', ['klingon' as never, 'jewish']).map((h) => h.id)).toEqual(['jewish.rosh-hashana']);
  });

  it('describeDay names the tradition when two holidays of the day share a name (Muslim and Druze Eid al-Adha)', () => {
    const both = describeDay('2026-05-27', DEFAULT_CALENDAR_EXTRAS);
    expect(both.text).toBe('י״א בסיוון תשפ״ו, 10 בד׳ו אל-חיג׳ה 1447, עיד אל-אדחא (יום 1 מתוך 4) (מוסלמי), עיד אל-אדחא (יום 1 מתוך 4) (דרוזי)');
    const druzeOnly = describeDay('2026-05-27', { ...DEFAULT_CALENDAR_EXTRAS, hebrewDates: false, hijriDates: false, muslimHolidays: false });
    expect(druzeOnly.text).toBe('עיד אל-אדחא (יום 1 מתוך 4)');
    expect(describeHolidayAmong(both.holidays[0], both.holidays)).toBe('עיד אל-אדחא (יום 1 מתוך 4) (מוסלמי)');
    expect(describeHolidayAmong(both.holidays[0], [both.holidays[0]])).toBe('עיד אל-אדחא (יום 1 מתוך 4)');
    // Distinct names on one day stay plain (Western + Orthodox Easter 2025).
    expect(describeDay('2025-04-20', { ...DEFAULT_CALENDAR_EXTRAS, hebrewDates: false, hijriDates: false }).text).toBe('חג הפסחא (מערבי), הפסחא האורתודוקסי');
  });

  it('computes 2030 (all traditions) cold in under 300 ms and gives identical results after a cache clear', () => {
    holidaysInRange('2030-01-01', '2030-12-31');
    const before = JSON.stringify(holidaysInRange('2030-01-01', '2030-12-31'));
    clearHolidayCache();
    const t0 = performance.now();
    const after = holidaysInRange('2030-01-01', '2030-12-31');
    expect(performance.now() - t0).toBeLessThan(300);
    expect(JSON.stringify(after)).toBe(before);
    expect(after.length).toBeGreaterThan(100);
  });
});
