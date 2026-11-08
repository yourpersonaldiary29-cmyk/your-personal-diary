/**
 * Civil (Gregorian) date helpers used inside `shared/calendars`.
 *
 * All arithmetic is done in UTC on `Date.UTC(y, m-1, d, 12)` so a civil day
 * never shifts because of the device's time zone or DST. Dependency-free.
 */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface CivilDate {
  year: number;
  /** 1..12 */
  month: number;
  /** 1..31 */
  day: number;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Days in a Gregorian month (month 1..12). */
export function daysInGregorianMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

/** True when `iso` is a well-formed and valid `YYYY-MM-DD` date. */
export function isValidIsoDate(iso: unknown): iso is string {
  if (typeof iso !== 'string') return false;
  const m = ISO_DATE_RE.exec(iso);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInGregorianMonth(y, mo);
}

/** Parses `YYYY-MM-DD`; throws (Hebrew message) on invalid input. */
export function parseIsoDate(iso: string): CivilDate {
  if (!isValidIsoDate(iso)) throw new Error(`תאריך לא תקין: ${String(iso)}`);
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)) };
}

/** Builds `YYYY-MM-DD` from numeric parts (month 1..12). */
export function toIsoDate(year: number, month: number, day: number): string {
  const y = year < 1000 ? String(year).padStart(4, '0') : String(year);
  return `${y}-${pad2(month)}-${pad2(day)}`;
}

/** UTC noon of the civil day - the instant handed to `Intl.DateTimeFormat`. */
export function utcNoon(iso: string): Date {
  const { year, month, day } = parseIsoDate(iso);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function fromUtc(d: Date): string {
  return toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Adds (or subtracts) whole civil days. */
export function addDaysIso(iso: string, days: number): string {
  const d = utcNoon(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** 0 = Sunday .. 6 = Saturday. */
export function weekdayOf(iso: string): number {
  return utcNoon(iso).getUTCDay();
}

/** Gregorian year of the civil day. */
export function yearOf(iso: string): number {
  return parseIsoDate(iso).year;
}

/** Signed number of days from `a` to `b` (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((utcNoon(b).getTime() - utcNoon(a).getTime()) / 86_400_000);
}

/** Lexicographic comparison works for ISO dates; returns -1, 0 or 1. */
export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
