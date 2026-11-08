import { describe, expect, it } from 'vitest';
import { julianToGregorian, orthodoxEaster, westernEaster } from './easter';

describe('Easter computus', () => {
  it('western (Gregorian) Easter 2024-2030', () => {
    const table: Record<number, string> = {
      2024: '2024-03-31',
      2025: '2025-04-20',
      2026: '2026-04-05',
      2027: '2027-03-28',
      2028: '2028-04-16',
      2029: '2029-04-01',
      2030: '2030-04-21',
    };
    for (const [year, date] of Object.entries(table)) expect(westernEaster(Number(year)), year).toBe(date);
  });

  it('orthodox (Julian) Easter 2024-2030 on the Gregorian calendar', () => {
    const table: Record<number, string> = {
      2024: '2024-05-05',
      2025: '2025-04-20',
      2026: '2026-04-12',
      2027: '2027-05-02',
      2028: '2028-04-16',
      2029: '2029-04-08',
      2030: '2030-04-28',
    };
    for (const [year, date] of Object.entries(table)) expect(orthodoxEaster(Number(year)), year).toBe(date);
  });

  it('always falls on a Sunday', () => {
    for (let y = 1900; y <= 2199; y++) {
      const w = new Date(`${westernEaster(y)}T12:00:00Z`).getUTCDay();
      const o = new Date(`${orthodoxEaster(y)}T12:00:00Z`).getUTCDay();
      expect(w, `western ${y}`).toBe(0);
      expect(o, `orthodox ${y}`).toBe(0);
    }
  });

  it('converts Julian dates with the right century offset (13 days until 2100, 14 after)', () => {
    expect(julianToGregorian(2025, 12, 25)).toBe('2026-01-07');
    expect(julianToGregorian(2026, 3, 30)).toBe('2026-04-12');
    expect(julianToGregorian(2100, 12, 25)).toBe('2101-01-08');
    expect(julianToGregorian(1899, 12, 25)).toBe('1900-01-06');
  });
});
