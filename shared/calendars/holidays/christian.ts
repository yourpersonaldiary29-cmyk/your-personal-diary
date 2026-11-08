/**
 * Christian holidays for the Western (Catholic/Protestant, Gregorian) and
 * Orthodox (Julian-based) rites. Fixed feasts use civil dates; movable feasts
 * are offsets from the rite's Easter Sunday.
 *
 * When the same feast exists in both rites the Hebrew name carries the rite,
 * e.g. "חג הפסחא (מערבי)" / "הפסחא האורתודוקסי". `nameKey` points at the
 * 'holidays.*' catalogue for every UI language.
 */
import type { ChristianRite, Holiday, HolidayKind } from '../types';
import { orthodoxEaster, westernEaster, julianToGregorian } from '../easter';
import { addDaysIso, compareIso, toIsoDate } from '../civil';
import { holidayNameKey } from './scan';

interface FixedRule {
  id: string;
  month: number;
  day: number;
  name: string;
  kind: HolidayKind;
}

interface MovableRule {
  id: string;
  /** Days relative to Easter Sunday of the rite. */
  offset: number;
  name: string;
  kind: HolidayKind;
}

const WESTERN_FIXED: FixedRule[] = [
  { id: 'christian.epiphany.western', month: 1, day: 6, name: 'ההתגלות (מערבית)', kind: 'major' },
  { id: 'christian.annunciation', month: 3, day: 25, name: 'הבשורה', kind: 'major' },
  { id: 'christian.assumption', month: 8, day: 15, name: 'עליית מרים', kind: 'major' },
  { id: 'christian.all-saints', month: 11, day: 1, name: 'כל הקדושים', kind: 'minor' },
  { id: 'christian.christmas.western', month: 12, day: 25, name: 'חג המולד (מערבי)', kind: 'major' },
];

const WESTERN_MOVABLE: MovableRule[] = [
  { id: 'christian.ash-wednesday', offset: -46, name: 'יום רביעי של האפר', kind: 'major' },
  { id: 'christian.palm-sunday.western', offset: -7, name: 'יום ראשון של הדקלים (מערבי)', kind: 'major' },
  { id: 'christian.maundy-thursday', offset: -3, name: 'יום חמישי הקדוש', kind: 'minor' },
  { id: 'christian.good-friday.western', offset: -2, name: 'יום שישי הטוב (מערבי)', kind: 'major' },
  { id: 'christian.easter.western', offset: 0, name: 'חג הפסחא (מערבי)', kind: 'major' },
  { id: 'christian.easter-monday', offset: 1, name: 'שני של פסחא', kind: 'minor' },
  { id: 'christian.ascension.western', offset: 39, name: 'עליית ישו (מערבית)', kind: 'major' },
  { id: 'christian.pentecost.western', offset: 49, name: 'חג השבועות הנוצרי (מערבי)', kind: 'major' },
];

/** Orthodox fixed feasts are Julian-calendar dates (25 December Julian = 7 January Gregorian until 2100). */
const ORTHODOX_FIXED_JULIAN: FixedRule[] = [
  { id: 'christian.christmas.orthodox', month: 12, day: 25, name: 'חג המולד האורתודוקסי', kind: 'major' },
  { id: 'christian.epiphany.orthodox', month: 1, day: 6, name: 'ההתגלות האורתודוקסית', kind: 'major' },
];

const ORTHODOX_MOVABLE: MovableRule[] = [
  { id: 'christian.lazarus-saturday', offset: -1 - 7, name: 'שבת לזרוס', kind: 'minor' },
  { id: 'christian.palm-sunday.orthodox', offset: -7, name: 'יום ראשון של הדקלים (אורתודוקסי)', kind: 'major' },
  { id: 'christian.good-friday.orthodox', offset: -2, name: 'יום שישי הגדול (אורתודוקסי)', kind: 'major' },
  { id: 'christian.easter.orthodox', offset: 0, name: 'הפסחא האורתודוקסי', kind: 'major' },
  { id: 'christian.ascension.orthodox', offset: 39, name: 'עליית ישו (אורתודוקסית)', kind: 'major' },
  { id: 'christian.pentecost.orthodox', offset: 49, name: 'חג השבועות (אורתודוקסי)', kind: 'major' },
];

export const CHRISTIAN_HOLIDAY_IDS: readonly string[] = [
  ...WESTERN_FIXED.map((r) => r.id),
  ...WESTERN_MOVABLE.map((r) => r.id),
  ...ORTHODOX_FIXED_JULIAN.map((r) => r.id),
  ...ORTHODOX_MOVABLE.map((r) => r.id),
];

function make(rule: { id: string; name: string; kind: HolidayKind }, date: string, rite: ChristianRite): Holiday {
  return { id: rule.id, tradition: 'christian', name: rule.name, nameKey: holidayNameKey(rule.id), kind: rule.kind, date, rite };
}

/** Western-rite holidays of the Gregorian `year`. */
export function westernHolidaysForYear(year: number): Holiday[] {
  const easter = westernEaster(year);
  const out: Holiday[] = [];
  for (const r of WESTERN_FIXED) out.push(make(r, toIsoDate(year, r.month, r.day), 'western'));
  for (const r of WESTERN_MOVABLE) out.push(make(r, addDaysIso(easter, r.offset), 'western'));
  return out;
}

/** Orthodox-rite holidays whose Gregorian civil date falls inside `year`. */
export function orthodoxHolidaysForYear(year: number): Holiday[] {
  const easter = orthodoxEaster(year);
  const out: Holiday[] = [];
  const first = toIsoDate(year, 1, 1);
  const last = toIsoDate(year, 12, 31);
  // A Julian date of December (year-1) or January (year) may land in this Gregorian year.
  for (const r of ORTHODOX_FIXED_JULIAN) {
    for (const jy of [year - 1, year]) {
      const date = julianToGregorian(jy, r.month, r.day);
      if (date >= first && date <= last) out.push(make(r, date, 'orthodox'));
    }
  }
  for (const r of ORTHODOX_MOVABLE) out.push(make(r, addDaysIso(easter, r.offset), 'orthodox'));
  return out;
}

/** Every Christian holiday (both rites) inside the Gregorian `year`, sorted by date (western first on ties). */
export function christianHolidaysForYear(year: number): Holiday[] {
  const out = [...westernHolidaysForYear(year), ...orthodoxHolidaysForYear(year)];
  out.sort((a, b) => compareIso(a.date, b.date));
  return out;
}
