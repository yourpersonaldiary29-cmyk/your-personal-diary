/**
 * Easter computus - pure arithmetic, no Intl.
 *
 * - `westernEaster`  : Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
 * - `orthodoxEaster` : Meeus Julian algorithm, converted from the Julian to the
 *                      Gregorian calendar (+13 days for 1900-2099, +14 from 2100 ...
 *                      derived from the Julian Day Number, so any year works).
 */
import { toIsoDate } from './civil';

/** Gregorian (Western) Easter Sunday as `YYYY-MM-DD`. */
export function westernEaster(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toIsoDate(year, month, day);
}

/** Julian-calendar Easter Sunday (Meeus) as Julian year/month/day. */
export function julianEaster(year: number): { year: number; month: number; day: number } {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return { year, month, day };
}

/** Julian Day Number of a Julian-calendar date. */
function julianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
}

/** Julian Day Number -> Gregorian `YYYY-MM-DD` (Richards' algorithm). */
function jdnToGregorianIso(jdn: number): string {
  const f = jdn + 1401 + Math.floor((Math.floor((4 * jdn + 274277) / 146097) * 3) / 4) - 38;
  const e = 4 * f + 3;
  const g = Math.floor((e % 1461) / 4);
  const h = 5 * g + 2;
  const day = Math.floor((h % 153) / 5) + 1;
  const month = ((Math.floor(h / 153) + 2) % 12) + 1;
  const year = Math.floor(e / 1461) - 4716 + Math.floor((14 - month) / 12);
  return toIsoDate(year, month, day);
}

/** Converts a Julian-calendar date to the Gregorian civil day `YYYY-MM-DD`. */
export function julianToGregorian(year: number, month: number, day: number): string {
  return jdnToGregorianIso(julianToJdn(year, month, day));
}

/** Orthodox (Julian-computed) Easter Sunday on the Gregorian calendar, `YYYY-MM-DD`. */
export function orthodoxEaster(year: number): string {
  const j = julianEaster(year);
  return julianToGregorian(j.year, j.month, j.day);
}
