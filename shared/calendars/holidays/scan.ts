/**
 * Helpers shared by the holiday modules.
 *
 * Religious holidays are found by scanning civil days: for each day we convert
 * to the religious calendar and ask "is a holiday anchored here?". An anchor
 * emits every day of the holiday (Hanukkah day 1..8) at its observed civil
 * date, so the scan for a Gregorian year starts a little before 1 January and
 * ends a little after 31 December and keeps only the dates inside the year.
 */
import type { Holiday } from '../types';
import { addDaysIso, compareIso, toIsoDate } from '../civil';

/** Longest distance between an anchor day and the last emitted day (Hanukkah: +7) plus slack. */
const LOOKBACK_DAYS = 14;
/** Holidays advanced before their nominal day (Yom HaAtzmaut -2, Ta'anit Esther -2) plus slack. */
const LOOKAHEAD_DAYS = 3;

/** Scans every civil day around `year` and collects the holidays that fall inside the year, sorted by date. */
export function scanCivilYear(year: number, anchoredOn: (iso: string) => Holiday[]): Holiday[] {
  const first = toIsoDate(year, 1, 1);
  const last = toIsoDate(year, 12, 31);
  const stop = addDaysIso(last, LOOKAHEAD_DAYS);
  const out: Holiday[] = [];
  for (let iso = addDaysIso(first, -LOOKBACK_DAYS); iso <= stop; iso = addDaysIso(iso, 1)) {
    for (const h of anchoredOn(iso)) {
      if (h.date >= first && h.date <= last) out.push(h);
    }
  }
  out.sort((a, b) => compareIso(a.date, b.date));
  return out;
}

/** Builds the `dayIndex`/`dayCount` pair, omitting both for single-day holidays. */
export function multiDay(dayIndex: number, dayCount: number): Pick<Holiday, 'dayIndex' | 'dayCount'> {
  return dayCount > 1 ? { dayIndex, dayCount } : {};
}

/**
 * Catalogue key of a holiday name: 'holidays.' + the id with dots replaced by
 * dashes, plus an optional variant for day-specific names.
 *   holidayNameKey('christian.easter.western')      -> 'holidays.christian-easter-western'
 *   holidayNameKey('jewish.sukkot', 'cholHamoed')    -> 'holidays.jewish-sukkot.cholHamoed'
 */
export function holidayNameKey(id: string, variant?: string): string {
  const base = `holidays.${id.replace(/\./g, '-')}`;
  return variant ? `${base}.${variant}` : base;
}
