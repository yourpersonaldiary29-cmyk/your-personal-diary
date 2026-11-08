import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CALENDAR_EXTRAS,
  KIND_LABELS,
  UMM_AL_QURA_NOTE,
  clearHolidayCache,
  describeDay,
  holidaysByDate,
  holidaysForYear,
  holidaysInRange,
  holidaysOn,
  toHebrewDate,
  type Holiday,
  type HolidayTradition,
} from './index';
import { weekdayOf } from './civil';

const yearOf = (year: number, traditions?: HolidayTradition[]) =>
  holidaysInRange(`${year}-01-01`, `${year}-12-31`, traditions);

/** Civil date of the holiday `id` (day `dayIndex`) inside the Gregorian `year`. */
function dateOf(year: number, id: string, dayIndex?: number): string | undefined {
  const found = yearOf(year).filter((h) => h.id === id && (dayIndex === undefined || h.dayIndex === dayIndex));
  if (found.length !== 1) return found.length === 0 ? undefined : `AMBIGUOUS:${found.map((h) => h.date).join(',')}`;
  return found[0].date;
}

/** All civil dates of `id` inside the Gregorian `year` (an id can occur twice, e.g. 10 Tevet). */
function datesOf(year: number, id: string): string[] {
  return yearOf(year).filter((h) => h.id === id).map((h) => h.date);
}

function expectDates(id: string, expected: Record<number, string>, dayIndex?: number): void {
  for (const [year, date] of Object.entries(expected)) {
    expect(dateOf(Number(year), id, dayIndex), `${id} ${year}`).toBe(date);
  }
}

function consecutive(start: string, count: number): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00Z`);
  for (let i = 0; i < count; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

describe('Jewish holidays (Israeli observance)', () => {
  it('ראש השנה day 1', () => {
    expectDates('jewish.rosh-hashana', { 2025: '2025-09-23', 2026: '2026-09-12', 2027: '2027-10-02' }, 1);
    expect(dateOf(2026, 'jewish.rosh-hashana', 2)).toBe('2026-09-13');
    const rh = holidaysOn('2026-09-12', ['jewish']).find((h) => h.id === 'jewish.rosh-hashana');
    expect(rh).toMatchObject({ name: 'ראש השנה', kind: 'major', dayIndex: 1, dayCount: 2 });
  });

  it('יום כיפור', () => {
    expectDates('jewish.yom-kippur', { 2025: '2025-10-02', 2026: '2026-09-21', 2027: '2027-10-11' });
  });

  it('סוכות, הושענא רבה and שמיני עצרת', () => {
    expectDates('jewish.sukkot', { 2025: '2025-10-07', 2026: '2026-09-26' }, 1);
    const sukkot = yearOf(2026).filter((h) => h.id === 'jewish.sukkot');
    expect(sukkot.map((h) => h.date)).toEqual(consecutive('2026-09-26', 7));
    expect(sukkot.map((h) => h.dayIndex)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(sukkot[0]).toMatchObject({ name: 'סוכות', kind: 'major', dayCount: 7 });
    expect(sukkot[3]).toMatchObject({ name: 'חול המועד סוכות', kind: 'minor' });
    expect(sukkot[6]).toMatchObject({ name: 'חול המועד סוכות', dayIndex: 7 });
    expect(dateOf(2026, 'jewish.hoshana-rabba')).toBe('2026-10-02');
    expect(holidaysOn('2026-10-02', ['jewish']).map((h) => h.id)).toEqual(['jewish.sukkot', 'jewish.hoshana-rabba']);
    expectDates('jewish.shemini-atzeret', { 2025: '2025-10-14', 2026: '2026-10-03' });
  });

  it('חנוכה: 8 consecutive civil days from 25 Kislev', () => {
    expectDates('jewish.hanukkah', { 2024: '2024-12-26', 2025: '2025-12-15', 2026: '2026-12-05' }, 1);
    for (const start of ['2024-12-26', '2025-12-15', '2026-12-05']) {
      const days = holidaysInRange(start, '2030-01-01', ['jewish']).filter((h) => h.id === 'jewish.hanukkah').slice(0, 8);
      expect(days.map((h) => h.date)).toEqual(consecutive(start, 8));
      expect(days.map((h) => h.dayIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(days.every((h) => h.dayCount === 8 && h.name === 'חנוכה')).toBe(true);
    }
    // Hanukkah 5785 straddles the year boundary: days 7-8 are 2025-01-01/02 and are found in 2025, once.
    const jan = holidaysInRange('2025-01-01', '2025-01-05', ['jewish']).filter((h) => h.id === 'jewish.hanukkah');
    expect(jan.map((h) => [h.date, h.dayIndex])).toEqual([
      ['2025-01-01', 7],
      ['2025-01-02', 8],
    ]);
  });

  it('עשרה בטבת, ט״ו בשבט', () => {
    // 10 Tevet falls in late December / early January, so 2025 has it twice (5785 and 5786).
    expect(datesOf(2025, 'jewish.asara-btevet')).toEqual(['2025-01-10', '2025-12-30']);
    expect(datesOf(2026, 'jewish.asara-btevet')).toEqual(['2026-12-20']);
    expect(dateOf(2026, 'jewish.tu-bishvat')).toBe('2026-02-02');
    expect(holidaysOn('2026-02-02').find((h) => h.id === 'jewish.tu-bishvat')).toMatchObject({ kind: 'minor', name: 'ט״ו בשבט' });
  });

  it('פורים (Adar II in leap years), שושן פורים, תענית אסתר', () => {
    expectDates('jewish.purim', { 2025: '2025-03-14', 2026: '2026-03-03', 2027: '2027-03-23' });
    expect(toHebrewDate('2027-03-23')).toMatchObject({ month: 'adar2', day: 14 });
    expect(dateOf(2026, 'jewish.shushan-purim')).toBe('2026-03-04');
    expect(dateOf(2026, 'jewish.taanit-esther')).toBe('2026-03-02');
    // 5784: 13 Adar II was Saturday 2024-03-23 -> Thursday 2024-03-21.
    expect(weekdayOf('2024-03-23')).toBe(6);
    expect(toHebrewDate('2024-03-23')).toMatchObject({ month: 'adar2', day: 13 });
    const te = yearOf(2024).find((h) => h.id === 'jewish.taanit-esther');
    expect(te).toMatchObject({ date: '2024-03-21', note: 'הוקדם מיום שבת', kind: 'fast' });
  });

  it('פסח: 7 days with chol hamoed and שביעי של פסח', () => {
    expectDates('jewish.pesach', { 2025: '2025-04-13', 2026: '2026-04-02', 2027: '2027-04-22' }, 1);
    const pesach = yearOf(2026).filter((h) => h.id === 'jewish.pesach');
    expect(pesach.map((h) => h.date)).toEqual(consecutive('2026-04-02', 7));
    expect(pesach[0]).toMatchObject({ name: 'פסח', kind: 'major' });
    expect(pesach[2]).toMatchObject({ name: 'חול המועד פסח', kind: 'minor' });
    expect(pesach[6]).toMatchObject({ name: 'שביעי של פסח', kind: 'major', dayIndex: 7, dayCount: 7 });
  });

  it('יום השואה: moved off Friday/Sunday', () => {
    // 27 Nisan 5785 = Friday 2025-04-25 -> Thursday 2025-04-24.
    expect(toHebrewDate('2025-04-25')).toMatchObject({ month: 'nisan', day: 27 });
    expect(weekdayOf('2025-04-25')).toBe(5);
    expectDates('jewish.yom-hashoah', { 2025: '2025-04-24', 2026: '2026-04-14' });
    expect(yearOf(2025).find((h) => h.id === 'jewish.yom-hashoah')).toMatchObject({ kind: 'memorial', note: 'הוקדם מיום שישי' });
    expect(yearOf(2026).find((h) => h.id === 'jewish.yom-hashoah')?.note).toBeUndefined();
  });

  it('יום הזיכרון / יום העצמאות with the Israeli shifting rules', () => {
    // 5 Iyar 5785 = Saturday 2025-05-03 -> Thursday 2025-05-01.
    expect(toHebrewDate('2025-05-03')).toMatchObject({ month: 'iyar', day: 5 });
    expect(weekdayOf('2025-05-03')).toBe(6);
    expectDates('jewish.yom-hazikaron', { 2025: '2025-04-30', 2026: '2026-04-21', 2027: '2027-05-11' });
    expectDates('jewish.yom-haatzmaut', { 2025: '2025-05-01', 2026: '2026-04-22', 2027: '2027-05-12' });
    expect(yearOf(2025).find((h) => h.id === 'jewish.yom-haatzmaut')).toMatchObject({ kind: 'national', note: 'הוקדם מיום שבת' });
    expect(yearOf(2025).find((h) => h.id === 'jewish.yom-hazikaron')).toMatchObject({ kind: 'memorial', note: 'הוזז יחד עם יום העצמאות' });
    // 5 Iyar 5784 = Monday 2024-05-13 -> Tuesday 2024-05-14.
    expect(weekdayOf('2024-05-13')).toBe(1);
    expect(toHebrewDate('2024-05-13')).toMatchObject({ month: 'iyar', day: 5 });
    expect(dateOf(2024, 'jewish.yom-haatzmaut')).toBe('2024-05-14');
    expect(dateOf(2024, 'jewish.yom-hazikaron')).toBe('2024-05-13');
  });

  it('ל״ג בעומר, יום ירושלים, שבועות', () => {
    expect(dateOf(2026, 'jewish.lag-baomer')).toBe('2026-05-05');
    expect(dateOf(2026, 'jewish.yom-yerushalayim')).toBe('2026-05-15');
    expectDates('jewish.shavuot', { 2025: '2025-06-02', 2026: '2026-05-22' });
  });

  it('fasts postponed from Shabbat: י״ז בתמוז, תשעה באב, צום גדליה', () => {
    // 5785: 17 Tammuz and 9 Av fell on Sunday by themselves (2025-07-13, 2025-08-03) - no postponement.
    expect(toHebrewDate('2025-07-13')).toMatchObject({ month: 'tammuz', day: 17 });
    expect(weekdayOf('2025-07-13')).toBe(0);
    expectDates('jewish.tzom-tammuz', { 2025: '2025-07-13', 2026: '2026-07-02' });
    expect(yearOf(2025).find((h) => h.id === 'jewish.tzom-tammuz')).toMatchObject({ kind: 'fast' });
    expect(yearOf(2025).find((h) => h.id === 'jewish.tzom-tammuz')?.note).toBeUndefined();
    expectDates('jewish.tisha-bav', { 2025: '2025-08-03', 2026: '2026-07-23' });
    expect(yearOf(2025).find((h) => h.id === 'jewish.tisha-bav')?.note).toBeUndefined();
    expect(yearOf(2026).find((h) => h.id === 'jewish.tisha-bav')?.note).toBeUndefined();
    // 5782: 17 Tammuz = Saturday 2022-07-16 -> Sunday 2022-07-17; 9 Av = Saturday 2022-08-06 -> Sunday 2022-08-07.
    expect(toHebrewDate('2022-07-16')).toMatchObject({ month: 'tammuz', day: 17 });
    expect(weekdayOf('2022-07-16')).toBe(6);
    expect(yearOf(2022).find((h) => h.id === 'jewish.tzom-tammuz')).toMatchObject({
      date: '2022-07-17',
      kind: 'fast',
      note: 'נדחה מיום שבת',
    });
    expect(toHebrewDate('2022-08-06')).toMatchObject({ month: 'av', day: 9 });
    expect(yearOf(2022).find((h) => h.id === 'jewish.tisha-bav')).toMatchObject({ date: '2022-08-07', note: 'נדחה מיום שבת' });
    expectDates('jewish.tzom-gedaliah', { 2025: '2025-09-25', 2026: '2026-09-14' });
    // Find (with Intl) a year in which 3 Tishrei is Shabbat and check it moves to Sunday 4 Tishrei.
    let shabbatCase: { year: number; nominal: string } | null = null;
    for (let year = 2020; year <= 2040 && !shabbatCase; year++) {
      const rh = dateOf(year, 'jewish.rosh-hashana', 1);
      const nominal = consecutive(rh!, 3)[2];
      if (weekdayOf(nominal) === 6) shabbatCase = { year, nominal };
    }
    expect(shabbatCase).not.toBeNull();
    expect(toHebrewDate(shabbatCase!.nominal)).toMatchObject({ month: 'tishrei', day: 3 });
    const observed = yearOf(shabbatCase!.year).find((h) => h.id === 'jewish.tzom-gedaliah');
    expect(observed).toMatchObject({ date: consecutive(shabbatCase!.nominal, 2)[1], note: 'נדחה מיום שבת' });
    expect(toHebrewDate(observed!.date)).toMatchObject({ month: 'tishrei', day: 4 });
  });

  it('ט״ו באב and סיגד', () => {
    expect(dateOf(2026, 'jewish.tu-bav')).toBe('2026-07-29');
    expect(dateOf(2025, 'jewish.sigd')).toBe('2025-11-20');
    expect(yearOf(2025).find((h) => h.id === 'jewish.sigd')?.note).toBeUndefined();
    // 29 Cheshvan 5785 = Shabbat 2024-11-30 -> the Sigd is held on Thursday 2024-11-28 (27 Cheshvan).
    expect(toHebrewDate('2024-11-30')).toMatchObject({ month: 'cheshvan', day: 29 });
    expect(weekdayOf('2024-11-30')).toBe(6);
    expect(yearOf(2024).find((h) => h.id === 'jewish.sigd')).toMatchObject({ date: '2024-11-28', note: 'הוקדם מיום שבת', kind: 'minor' });
    // Never on Shabbat.
    for (let year = 2020; year <= 2045; year++) {
      const sigd = yearOf(year).find((h) => h.id === 'jewish.sigd');
      expect(sigd, `sigd ${year}`).toBeDefined();
      expect(weekdayOf(sigd!.date), `sigd ${year} ${sigd!.date}`).not.toBe(6);
    }
  });

  it('ראש חודש on day 1 of every month except Tishrei, and on day 30 of a 30-day month', () => {
    const rc = yearOf(2026).filter((h) => h.id === 'jewish.rosh-chodesh');
    // 1 Cheshvan 5787 = 2026-10-12 after a 30-day Tishrei -> day 2 of 2; 30 Tishrei = 2026-10-11 -> day 1 of 2.
    expect(rc.find((h) => h.date === '2026-10-11')).toMatchObject({ name: 'ראש חודש חשוון', dayIndex: 1, dayCount: 2, kind: 'minor' });
    expect(rc.find((h) => h.date === '2026-10-12')).toMatchObject({ name: 'ראש חודש חשוון', dayIndex: 2, dayCount: 2 });
    // 1 Tishrei is Rosh Hashana, never Rosh Chodesh.
    expect(rc.some((h) => h.date === '2026-09-12')).toBe(false);
    // 1 Nisan 5786 = 2026-03-19 follows a 29-day Adar -> a single day.
    const nisan = rc.find((h) => h.date === '2026-03-19');
    expect(nisan).toMatchObject({ name: 'ראש חודש ניסן' });
    expect(nisan?.dayIndex).toBeUndefined();
    // 30 Shevat 5787 = 2027-02-07 is day 1 of Rosh Chodesh Adar I.
    expect(yearOf(2027).find((h) => h.id === 'jewish.rosh-chodesh' && h.date === '2027-02-07')?.name).toBe('ראש חודש אדר א׳');
    // 12 months in a plain year minus Tishrei = 11 "day 1" entries.
    const firsts = holidaysInRange('2025-09-23', '2026-09-11', ['jewish']).filter(
      (h) => h.id === 'jewish.rosh-chodesh' && h.dayIndex !== 1,
    );
    expect(firsts).toHaveLength(11);
  });
});

describe('Jewish holidays - additional real-world dates (5783-5784)', () => {
  it('matches the published Israeli calendar for 2023-2024', () => {
    expect(dateOf(2023, 'jewish.yom-haatzmaut')).toBe('2023-04-26');
    expect(dateOf(2023, 'jewish.yom-hashoah')).toBe('2023-04-18');
    expect(dateOf(2023, 'jewish.hanukkah', 1)).toBe('2023-12-08');
    expect(dateOf(2023, 'jewish.rosh-hashana', 1)).toBe('2023-09-16');
    expect(dateOf(2023, 'jewish.yom-kippur')).toBe('2023-09-25');
    expect(dateOf(2024, 'jewish.purim')).toBe('2024-03-24');
    expect(dateOf(2024, 'jewish.pesach', 1)).toBe('2024-04-23');
    // 27 Nisan 5784 = Sunday 2024-05-05 -> Monday 2024-05-06.
    expect(toHebrewDate('2024-05-05')).toMatchObject({ month: 'nisan', day: 27 });
    expect(weekdayOf('2024-05-05')).toBe(0);
    expect(yearOf(2024).find((h) => h.id === 'jewish.yom-hashoah')).toMatchObject({ date: '2024-05-06', note: 'נדחה מיום ראשון' });
    expect(dateOf(2024, 'jewish.yom-kippur')).toBe('2024-10-12');
    expect(dateOf(2024, 'jewish.shavuot')).toBe('2024-06-12');
  });
});

describe('Muslim holidays (Umm al-Qura)', () => {
  it('reference dates', () => {
    expectDates('muslim.hijri-new-year', { 2025: '2025-06-26', 2026: '2026-06-16' });
    expectDates('muslim.ashura', { 2025: '2025-07-05', 2026: '2026-06-25' });
    expectDates('muslim.mawlid', { 2025: '2025-09-04', 2026: '2026-08-25' });
    expectDates('muslim.ramadan-start', { 2025: '2025-03-01', 2026: '2026-02-18', 2027: '2027-02-08' });
    expectDates('muslim.eid-al-fitr', { 2025: '2025-03-30', 2026: '2026-03-20', 2027: '2027-03-09' }, 1);
    expect(dateOf(2025, 'muslim.arafah')).toBe('2025-06-05');
    expectDates('muslim.eid-al-adha', { 2025: '2025-06-06', 2026: '2026-05-27', 2027: '2027-05-16' }, 1);
    expect(dateOf(2026, 'muslim.laylat-al-qadr')).toBe('2026-03-16');
    expect(dateOf(2026, 'muslim.isra-miraj')).toBe('2026-01-16');
    // 2024 (Umm al-Qura): Ramadan 11 March, Eid al-Fitr 10 April, Eid al-Adha 16 June.
    expect(dateOf(2024, 'muslim.ramadan-start')).toBe('2024-03-11');
    expect(dateOf(2024, 'muslim.eid-al-fitr', 1)).toBe('2024-04-10');
    expect(dateOf(2024, 'muslim.eid-al-adha', 1)).toBe('2024-06-16');
  });

  it('multi-day eids and the moon-sighting note', () => {
    const fitr = yearOf(2026).filter((h) => h.id === 'muslim.eid-al-fitr');
    expect(fitr.map((h) => h.date)).toEqual(consecutive('2026-03-20', 3));
    const adha = yearOf(2026).filter((h) => h.id === 'muslim.eid-al-adha');
    expect(adha.map((h) => h.date)).toEqual(consecutive('2026-05-27', 4));
    expect(adha.map((h) => h.dayIndex)).toEqual([1, 2, 3, 4]);
    for (const h of yearOf(2026, ['muslim'])) {
      expect(h.note, h.id).toBe(UMM_AL_QURA_NOTE);
      expect(h.note).toMatch(/אום אל-קורא/);
    }
    expect(yearOf(2026, ['muslim']).find((h) => h.id === 'muslim.ramadan-start')?.kind).toBe('minor');
  });
});

describe('Christian holidays', () => {
  it('western reference dates 2026', () => {
    expect(dateOf(2026, 'christian.ash-wednesday')).toBe('2026-02-18');
    expect(dateOf(2026, 'christian.palm-sunday.western')).toBe('2026-03-29');
    expect(dateOf(2026, 'christian.maundy-thursday')).toBe('2026-04-02');
    expect(dateOf(2026, 'christian.good-friday.western')).toBe('2026-04-03');
    expect(dateOf(2026, 'christian.easter.western')).toBe('2026-04-05');
    expect(dateOf(2026, 'christian.easter-monday')).toBe('2026-04-06');
    expect(dateOf(2026, 'christian.ascension.western')).toBe('2026-05-14');
    expect(dateOf(2026, 'christian.pentecost.western')).toBe('2026-05-24');
    expect(dateOf(2026, 'christian.christmas.western')).toBe('2026-12-25');
    expect(dateOf(2026, 'christian.epiphany.western')).toBe('2026-01-06');
    expect(dateOf(2026, 'christian.annunciation')).toBe('2026-03-25');
    expect(dateOf(2026, 'christian.assumption')).toBe('2026-08-15');
    expect(dateOf(2026, 'christian.all-saints')).toBe('2026-11-01');
  });

  it('orthodox reference dates', () => {
    expect(dateOf(2026, 'christian.good-friday.orthodox')).toBe('2026-04-10');
    expect(dateOf(2026, 'christian.easter.orthodox')).toBe('2026-04-12');
    expect(dateOf(2026, 'christian.lazarus-saturday')).toBe('2026-04-04');
    expect(dateOf(2026, 'christian.palm-sunday.orthodox')).toBe('2026-04-05');
    expect(dateOf(2026, 'christian.ascension.orthodox')).toBe('2026-05-21');
    expect(dateOf(2026, 'christian.pentecost.orthodox')).toBe('2026-05-31');
    expect(dateOf(2027, 'christian.christmas.orthodox')).toBe('2027-01-07');
    expect(dateOf(2026, 'christian.christmas.orthodox')).toBe('2026-01-07');
    expect(dateOf(2026, 'christian.epiphany.orthodox')).toBe('2026-01-19');
  });

  it('names carry the rite and the rite field is set', () => {
    const easter = yearOf(2026, ['christian']).filter((h) => h.id.startsWith('christian.easter.'));
    expect(easter.map((h) => [h.name, h.rite])).toEqual([
      ['חג הפסחא (מערבי)', 'western'],
      ['הפסחא האורתודוקסי', 'orthodox'],
    ]);
    expect(yearOf(2026, ['christian']).every((h) => h.rite === 'western' || h.rite === 'orthodox')).toBe(true);
    // 2025: both Easters coincide but keep separate ids.
    const both = holidaysOn('2025-04-20', ['christian']).map((h) => h.id);
    expect(both).toEqual(['christian.easter.western', 'christian.easter.orthodox']);
  });
});

describe('Druze holidays', () => {
  it('reference dates 2026', () => {
    const shuayb = yearOf(2026).filter((h) => h.id === 'druze.nabi-shuayb');
    expect(shuayb.map((h) => h.date)).toEqual(['2026-04-25', '2026-04-26', '2026-04-27', '2026-04-28']);
    expect(shuayb[0]).toMatchObject({ name: 'זיארת נבי שועייב', kind: 'major', dayIndex: 1, dayCount: 4 });
    expect(shuayb[1].kind).toBe('minor');
    expect(dateOf(2026, 'druze.al-khadr')).toBe('2026-01-25');
    expect(dateOf(2026, 'druze.nabi-sablan')).toBe('2026-09-10');
    const adha = yearOf(2026).filter((h) => h.id === 'druze.eid-al-adha');
    expect(adha.map((h) => h.date)).toEqual(consecutive('2026-05-27', 4));
    expect(adha[0]).toMatchObject({ tradition: 'druze', name: 'עיד אל-אדחא', kind: 'major', note: UMM_AL_QURA_NOTE });
  });
});

describe('holidays index', () => {
  const VALID_KINDS = Object.keys(KIND_LABELS);

  it('a whole year has no duplicate (id, date) pairs, and every entry is well formed', () => {
    for (const year of [2024, 2025, 2026, 2027]) {
      const all = yearOf(year);
      const keys = new Set<string>();
      for (const h of all) {
        const key = `${h.id}|${h.date}`;
        expect(keys.has(key), `duplicate ${key}`).toBe(false);
        keys.add(key);
        expect(h.name, h.id).toMatch(/[א-ת]/);
        expect(VALID_KINDS, `${h.id} kind`).toContain(h.kind);
        expect(h.id.startsWith(`${h.tradition}.`), h.id).toBe(true);
        expect(h.date >= `${year}-01-01` && h.date <= `${year}-12-31`, `${h.id} ${h.date}`).toBe(true);
        if (h.dayCount !== undefined) {
          expect(h.dayIndex).toBeGreaterThanOrEqual(1);
          expect(h.dayIndex).toBeLessThanOrEqual(h.dayCount);
        } else {
          expect(h.dayIndex).toBeUndefined();
        }
      }
      expect(all.length).toBeGreaterThan(100);
    }
  });

  it('is sorted by date then tradition order', () => {
    const order: Record<HolidayTradition, number> = { jewish: 0, muslim: 1, christian: 2, druze: 3 };
    const all = yearOf(2026);
    for (let i = 1; i < all.length; i++) {
      const a = all[i - 1];
      const b = all[i];
      const ok = a.date < b.date || (a.date === b.date && order[a.tradition] <= order[b.tradition]);
      expect(ok, `${a.id}@${a.date} before ${b.id}@${b.date}`).toBe(true);
    }
    // 2026-05-27: Muslim Eid al-Adha before the Druze one.
    expect(holidaysOn('2026-05-27').map((h) => h.tradition)).toEqual(['muslim', 'druze']);
  });

  it('tradition filter works and the default is all four', () => {
    const jewishOnly = yearOf(2026, ['jewish']);
    expect(jewishOnly.length).toBeGreaterThan(0);
    expect(jewishOnly.every((h) => h.tradition === 'jewish')).toBe(true);
    expect(yearOf(2026, []).length).toBe(0);
    const two = yearOf(2026, ['druze', 'christian']);
    expect(new Set(two.map((h) => h.tradition))).toEqual(new Set(['christian', 'druze']));
    expect(new Set(yearOf(2026).map((h) => h.tradition)).size).toBe(4);
    expect(holidaysOn('2026-09-12', ['muslim', 'christian'])).toEqual([]);
  });

  it('range queries are inclusive and empty when reversed', () => {
    expect(holidaysInRange('2026-09-12', '2026-09-12').map((h) => h.id)).toEqual(['jewish.rosh-hashana']);
    expect(holidaysInRange('2026-09-13', '2026-09-12')).toEqual([]);
    const byDate = holidaysByDate('2026-09-01', '2026-09-30');
    expect(byDate.get('2026-09-12')?.map((h) => h.id)).toEqual(['jewish.rosh-hashana']);
    expect(byDate.get('2026-09-10')?.map((h) => h.id)).toEqual(['druze.nabi-sablan']);
    expect(byDate.has('2026-09-15')).toBe(false);
    expect(() => holidaysInRange('bad', '2026-01-01')).toThrow(/תאריך לא תקין/);
    expect(() => holidaysOn('2026-1-1')).toThrow(/תאריך לא תקין/);
  });

  it('returned holiday objects are shared and frozen', () => {
    const a = holidaysOn('2026-09-12')[0];
    const b = holidaysForYear(2026, 'jewish').find((h) => h.date === '2026-09-12');
    expect(a).toBe(b);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('describeDay builds the screen-reader sentence and honours the extras', () => {
    const full = describeDay('2026-09-12', DEFAULT_CALENDAR_EXTRAS);
    expect(full.hebrew).toBe('א׳ בתשרי תשפ״ז');
    expect(full.hijri).toBe('1 ברביע א-ת׳אני 1448');
    expect(full.holidays.map((h) => h.id)).toEqual(['jewish.rosh-hashana']);
    expect(full.text).toBe('א׳ בתשרי תשפ״ז, 1 ברביע א-ת׳אני 1448, ראש השנה (יום 1 מתוך 2)');
    expect(full.text).toContain('ראש השנה');

    const none = describeDay('2026-09-12', {
      hebrewDates: false,
      hijriDates: false,
      jewishHolidays: false,
      muslimHolidays: false,
      christianHolidays: false,
      druzeHolidays: false,
    });
    expect(none).toEqual({ hebrew: null, hijri: null, holidays: [], text: '' });

    const onlyHijri = describeDay('2026-09-12', { ...DEFAULT_CALENDAR_EXTRAS, hebrewDates: false, jewishHolidays: false });
    expect(onlyHijri.hebrew).toBeNull();
    expect(onlyHijri.holidays).toEqual([]);
    expect(onlyHijri.text).toBe('1 ברביע א-ת׳אני 1448');

    const plain = describeDay('2026-09-15', { ...DEFAULT_CALENDAR_EXTRAS, hijriDates: false });
    expect(plain.text).toBe('ד׳ בתשרי תשפ״ז');
  });

  it('computes a full year in under 300 ms after warm-up', () => {
    yearOf(2026); // warm-up: formatters, JIT
    clearHolidayCache();
    const t0 = performance.now();
    const all = yearOf(2029);
    const cold = performance.now() - t0;
    expect(all.length).toBeGreaterThan(100);
    expect(cold).toBeLessThan(300);
    const t1 = performance.now();
    for (let i = 0; i < 50; i++) yearOf(2029);
    expect(performance.now() - t1).toBeLessThan(300);
  });
});

describe('Holiday type sanity', () => {
  it('every holiday satisfies the contract shape', () => {
    const sample: Holiday = yearOf(2026)[0];
    expect(typeof sample.id).toBe('string');
    expect(typeof sample.date).toBe('string');
  });
});
