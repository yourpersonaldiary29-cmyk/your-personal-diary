/**
 * Jewish holidays and observances as kept in Israel, derived from the Hebrew
 * date of each civil day (`toHebrewDate`) and its weekday.
 *
 * Israeli rules that move a day are applied here:
 * - fasts that fall on Shabbat are postponed to Sunday (Tzom Gedaliah, 17 Tammuz,
 *   Tisha B'Av) or advanced to Thursday (Ta'anit Esther, and the Sigd);
 * - Yom HaShoah on Friday -> Thursday, on Sunday -> Monday;
 * - Yom HaAtzmaut on Friday/Saturday -> the preceding Thursday, on Monday -> Tuesday,
 *   and Yom HaZikaron always the day before it.
 *
 * `name` / `note` are the Hebrew texts (backward compatibility); `nameKey` /
 * `noteKey` point at the 'holidays.*' catalogue for every UI language.
 */
import type { HebrewDate, HebrewMonth, Holiday, HolidayKind } from '../types';
import { HEBREW_MONTH_NAMES, isHebrewCalendarSupported, nextHebrewMonth, toHebrewDate } from '../hebrew';
import { addDaysIso, weekdayOf } from '../civil';
import { holidayNameKey, multiDay, scanCivilYear } from './scan';

const SUNDAY = 0;
const MONDAY = 1;
const FRIDAY = 5;
const SATURDAY = 6;

export const NOTE_POSTPONED_FROM_SHABBAT = 'נדחה מיום שבת';
export const NOTE_ADVANCED_FROM_SHABBAT = 'הוקדם מיום שבת';
export const NOTE_ADVANCED_FROM_FRIDAY = 'הוקדם מיום שישי';
export const NOTE_POSTPONED_FROM_SUNDAY = 'נדחה מיום ראשון';
export const NOTE_POSTPONED_FROM_MONDAY = 'נדחה מיום שני';
export const NOTE_MOVED_WITH_YOM_HAATZMAUT = 'הוזז יחד עם יום העצמאות';
export const NOTE_ROSH_CHODESH_TWO_DAYS = 'ראש חודש של יומיים';

/** Catalogue keys of the notes above (same order). */
export const NOTE_KEY_POSTPONED_FROM_SHABBAT = 'holidays.note.postponedFromShabbat';
export const NOTE_KEY_ADVANCED_FROM_SHABBAT = 'holidays.note.advancedFromShabbat';
export const NOTE_KEY_ADVANCED_FROM_FRIDAY = 'holidays.note.advancedFromFriday';
export const NOTE_KEY_POSTPONED_FROM_SUNDAY = 'holidays.note.postponedFromSunday';
export const NOTE_KEY_POSTPONED_FROM_MONDAY = 'holidays.note.postponedFromMonday';
export const NOTE_KEY_MOVED_WITH_YOM_HAATZMAUT = 'holidays.note.movedWithYomHaatzmaut';
export const NOTE_KEY_ROSH_CHODESH_TWO_DAYS = 'holidays.note.roshChodeshTwoDays';

interface Note {
  note: string;
  noteKey: string;
}

interface Shift extends Note {
  offset: number;
}

const POSTPONED_FROM_SHABBAT: Note = { note: NOTE_POSTPONED_FROM_SHABBAT, noteKey: NOTE_KEY_POSTPONED_FROM_SHABBAT };
const ADVANCED_FROM_SHABBAT: Note = { note: NOTE_ADVANCED_FROM_SHABBAT, noteKey: NOTE_KEY_ADVANCED_FROM_SHABBAT };
const ADVANCED_FROM_FRIDAY: Note = { note: NOTE_ADVANCED_FROM_FRIDAY, noteKey: NOTE_KEY_ADVANCED_FROM_FRIDAY };
const POSTPONED_FROM_SUNDAY: Note = { note: NOTE_POSTPONED_FROM_SUNDAY, noteKey: NOTE_KEY_POSTPONED_FROM_SUNDAY };
const POSTPONED_FROM_MONDAY: Note = { note: NOTE_POSTPONED_FROM_MONDAY, noteKey: NOTE_KEY_POSTPONED_FROM_MONDAY };

/** `'adar-purim'` = Adar in a plain year, Adar II in a leap year. */
type RuleMonth = HebrewMonth | 'adar-purim';

interface Rule {
  id: string;
  month: RuleMonth;
  day: number;
  name: string;
  kind: HolidayKind;
  /** Number of civil days from the anchor (default 1). */
  dayCount?: number;
  /** Name/kind per 1-based day for multi-day holidays. */
  dayName?: (index: number) => string;
  /** Catalogue variant of the name per 1-based day (undefined = the plain name key). */
  dayVariant?: (index: number) => string | undefined;
  dayKind?: (index: number) => HolidayKind;
  /** Israeli postponement/advancement rule based on the nominal weekday. */
  shift?: (weekday: number) => Shift | null;
}

const postponeFromShabbat = (wd: number): Shift | null => (wd === SATURDAY ? { offset: 1, ...POSTPONED_FROM_SHABBAT } : null);

const RULES: Rule[] = [
  { id: 'jewish.rosh-hashana', month: 'tishrei', day: 1, name: 'ראש השנה', kind: 'major', dayCount: 2 },
  { id: 'jewish.tzom-gedaliah', month: 'tishrei', day: 3, name: 'צום גדליה', kind: 'fast', shift: postponeFromShabbat },
  { id: 'jewish.yom-kippur', month: 'tishrei', day: 10, name: 'יום כיפור', kind: 'major' },
  {
    id: 'jewish.sukkot',
    month: 'tishrei',
    day: 15,
    name: 'סוכות',
    kind: 'major',
    dayCount: 7,
    dayName: (i) => (i === 1 ? 'סוכות' : 'חול המועד סוכות'),
    dayVariant: (i) => (i === 1 ? undefined : 'cholHamoed'),
    dayKind: (i) => (i === 1 ? 'major' : 'minor'),
  },
  { id: 'jewish.hoshana-rabba', month: 'tishrei', day: 21, name: 'הושענא רבה', kind: 'minor' },
  { id: 'jewish.shemini-atzeret', month: 'tishrei', day: 22, name: 'שמיני עצרת ושמחת תורה', kind: 'major' },
  {
    // חוק חג הסיגד: when 29 Cheshvan is Shabbat the Sigd is held on the preceding Thursday (e.g. 2024-11-28).
    id: 'jewish.sigd',
    month: 'cheshvan',
    day: 29,
    name: 'סיגד',
    kind: 'minor',
    shift: (wd) => (wd === SATURDAY ? { offset: -2, ...ADVANCED_FROM_SHABBAT } : null),
  },
  { id: 'jewish.hanukkah', month: 'kislev', day: 25, name: 'חנוכה', kind: 'major', dayCount: 8 },
  { id: 'jewish.asara-btevet', month: 'tevet', day: 10, name: 'עשרה בטבת', kind: 'fast' },
  { id: 'jewish.tu-bishvat', month: 'shevat', day: 15, name: 'ט״ו בשבט', kind: 'minor' },
  {
    id: 'jewish.taanit-esther',
    month: 'adar-purim',
    day: 13,
    name: 'תענית אסתר',
    kind: 'fast',
    shift: (wd) => (wd === SATURDAY ? { offset: -2, ...ADVANCED_FROM_SHABBAT } : null),
  },
  { id: 'jewish.purim', month: 'adar-purim', day: 14, name: 'פורים', kind: 'major' },
  { id: 'jewish.shushan-purim', month: 'adar-purim', day: 15, name: 'שושן פורים', kind: 'minor' },
  {
    id: 'jewish.pesach',
    month: 'nisan',
    day: 15,
    name: 'פסח',
    kind: 'major',
    dayCount: 7,
    dayName: (i) => (i === 1 ? 'פסח' : i === 7 ? 'שביעי של פסח' : 'חול המועד פסח'),
    dayVariant: (i) => (i === 1 ? undefined : i === 7 ? 'seventh' : 'cholHamoed'),
    dayKind: (i) => (i === 1 || i === 7 ? 'major' : 'minor'),
  },
  {
    id: 'jewish.yom-hashoah',
    month: 'nisan',
    day: 27,
    name: 'יום השואה',
    kind: 'memorial',
    shift: (wd) =>
      wd === FRIDAY ? { offset: -1, ...ADVANCED_FROM_FRIDAY } : wd === SUNDAY ? { offset: 1, ...POSTPONED_FROM_SUNDAY } : null,
  },
  {
    id: 'jewish.yom-haatzmaut',
    month: 'iyar',
    day: 5,
    name: 'יום העצמאות',
    kind: 'national',
    shift: (wd) =>
      wd === FRIDAY
        ? { offset: -1, ...ADVANCED_FROM_FRIDAY }
        : wd === SATURDAY
          ? { offset: -2, ...ADVANCED_FROM_SHABBAT }
          : wd === MONDAY
            ? { offset: 1, ...POSTPONED_FROM_MONDAY }
            : null,
  },
  { id: 'jewish.lag-baomer', month: 'iyar', day: 18, name: 'ל״ג בעומר', kind: 'minor' },
  { id: 'jewish.yom-yerushalayim', month: 'iyar', day: 28, name: 'יום ירושלים', kind: 'national' },
  { id: 'jewish.shavuot', month: 'sivan', day: 6, name: 'שבועות', kind: 'major' },
  { id: 'jewish.tzom-tammuz', month: 'tammuz', day: 17, name: 'י״ז בתמוז', kind: 'fast', shift: postponeFromShabbat },
  { id: 'jewish.tisha-bav', month: 'av', day: 9, name: 'תשעה באב', kind: 'fast', shift: postponeFromShabbat },
  { id: 'jewish.tu-bav', month: 'av', day: 15, name: 'ט״ו באב', kind: 'minor' },
];

/** All rule ids, for consumers that want to know what may appear. */
export const JEWISH_HOLIDAY_IDS: readonly string[] = [...RULES.map((r) => r.id), 'jewish.yom-hazikaron', 'jewish.rosh-chodesh'];

function ruleMonthMatches(rule: Rule, hd: HebrewDate): boolean {
  if (rule.month === 'adar-purim') return hd.isLeapYear ? hd.month === 'adar2' : hd.month === 'adar';
  return rule.month === hd.month;
}

function emitRule(out: Holiday[], rule: Rule, iso: string, weekday: number): void {
  const count = rule.dayCount ?? 1;
  const shift = rule.shift ? rule.shift(weekday) : null;
  const start = shift ? addDaysIso(iso, shift.offset) : iso;
  for (let i = 1; i <= count; i++) {
    const h: Holiday = {
      id: rule.id,
      tradition: 'jewish',
      name: rule.dayName ? rule.dayName(i) : rule.name,
      nameKey: holidayNameKey(rule.id, rule.dayVariant ? rule.dayVariant(i) : undefined),
      kind: rule.dayKind ? rule.dayKind(i) : rule.kind,
      date: i === 1 ? start : addDaysIso(start, i - 1),
      ...multiDay(i, count),
    };
    if (shift) {
      h.note = shift.note;
      h.noteKey = shift.noteKey;
    }
    out.push(h);
  }
  if (rule.id === 'jewish.yom-haatzmaut') {
    const memorial: Holiday = {
      id: 'jewish.yom-hazikaron',
      tradition: 'jewish',
      name: 'יום הזיכרון',
      nameKey: holidayNameKey('jewish.yom-hazikaron'),
      kind: 'memorial',
      date: addDaysIso(start, -1),
    };
    if (shift) {
      memorial.note = NOTE_MOVED_WITH_YOM_HAATZMAUT;
      memorial.noteKey = NOTE_KEY_MOVED_WITH_YOM_HAATZMAUT;
    }
    out.push(memorial);
  }
}

const ROSH_CHODESH_KEY = holidayNameKey('jewish.rosh-chodesh');

function emitRoshChodesh(out: Holiday[], iso: string, hd: HebrewDate): void {
  if (hd.day === 30) {
    // Day 30 is the first of a two-day Rosh Chodesh of the following month.
    const next = nextHebrewMonth(hd.month, hd.isLeapYear);
    out.push({
      id: 'jewish.rosh-chodesh',
      tradition: 'jewish',
      name: `ראש חודש ${HEBREW_MONTH_NAMES[next]}`,
      nameKey: ROSH_CHODESH_KEY,
      month: next,
      kind: 'minor',
      date: iso,
      dayIndex: 1,
      dayCount: 2,
      note: NOTE_ROSH_CHODESH_TWO_DAYS,
      noteKey: NOTE_KEY_ROSH_CHODESH_TWO_DAYS,
    });
    return;
  }
  if (hd.day === 1 && hd.month !== 'tishrei') {
    const previous = toHebrewDate(addDaysIso(iso, -1));
    const twoDays = previous.monthLength === 30;
    const h: Holiday = {
      id: 'jewish.rosh-chodesh',
      tradition: 'jewish',
      name: `ראש חודש ${hd.monthName}`,
      nameKey: ROSH_CHODESH_KEY,
      month: hd.month,
      kind: 'minor',
      date: iso,
      ...(twoDays ? { dayIndex: 2, dayCount: 2, note: NOTE_ROSH_CHODESH_TWO_DAYS, noteKey: NOTE_KEY_ROSH_CHODESH_TWO_DAYS } : {}),
    };
    out.push(h);
  }
}

/**
 * Holidays whose *nominal* Hebrew date is the civil day `iso`, each returned
 * with all of its days at their observed civil dates (may differ from `iso`
 * when an Israeli rule moves the day). Used by the year scanner.
 */
export function jewishHolidaysAnchoredOn(iso: string): Holiday[] {
  if (!isHebrewCalendarSupported()) return [];
  const hd = toHebrewDate(iso);
  const weekday = weekdayOf(iso);
  const out: Holiday[] = [];
  for (const rule of RULES) {
    if (rule.day === hd.day && ruleMonthMatches(rule, hd)) emitRule(out, rule, iso, weekday);
  }
  emitRoshChodesh(out, iso, hd);
  return out;
}

/** Every Jewish holiday day that falls inside the Gregorian `year`, sorted by date. */
export function jewishHolidaysForYear(year: number): Holiday[] {
  if (!isHebrewCalendarSupported()) return [];
  return scanCivilYear(year, jewishHolidaysAnchoredOn);
}
