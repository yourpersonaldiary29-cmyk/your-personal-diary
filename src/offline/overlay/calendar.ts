/**
 * Overlay of the calendar views (section 4.6, row "CalendarMonth / CalendarDay[]"): `entryCount`,
 * `hasEntry` and `titles` follow the entry effects (a moved entry leaves its old day: `prev`); the
 * averages are recomputed when the day's full entries are known (`ctx.dayEntries`), otherwise kept;
 * `habitsCompleted` / `habitsTotal` follow the log and habit effects.
 */
import type { CalendarDay, CalendarMonth, Entry } from '@shared/types';
import { dayAverages, dayEntries } from './days';
import { isLogCompleted, type Effects, type OverlayContext } from './effects';

export interface CalendarOverlayContext extends Pick<OverlayContext, 'today' | 'habits'> {
  /** The full entries of a date when the device has them (a cached day view), else null. */
  dayEntries?: (date: string) => Entry[] | null;
}

function emptyDay(date: string, habitsTotal: number, today: string): CalendarDay {
  return { date, mood: null, energy: null, stress: null, sleepHours: null, hasEntry: false, entryCount: 0, habitsCompleted: 0, habitsTotal: date > today ? 0 : habitsTotal, titles: [] };
}

function removeTitle(titles: string[], title: string): string[] {
  const i = titles.indexOf(title);
  if (i < 0) return titles;
  const copy = [...titles];
  copy.splice(i, 1);
  return copy;
}

/**
 * Applies the effects to the days of [from, to]. `days` may miss dates (the range view lists only
 * days with data): a date that gains an entry or a log is added.
 */
export function overlayDays(days: readonly CalendarDay[], from: string, to: string, fx: Effects, ctx: CalendarOverlayContext): CalendarDay[] {
  const byDate = new Map<string, CalendarDay>(days.map((d) => [d.date, { ...d, titles: [...d.titles] }]));
  const inRange = (date: string) => date >= from && date <= to;
  const defaultTotal = days.reduce((m, d) => Math.max(m, d.habitsTotal), 0);
  const day = (date: string): CalendarDay => {
    let d = byDate.get(date);
    if (!d) {
      d = emptyDay(date, defaultTotal, ctx.today);
      byDate.set(date, d);
    }
    return d;
  };
  const touched = new Set<string>();

  for (const e of fx.entries) {
    const prev = e.prev;
    if (prev && inRange(prev.date)) {
      const d = day(prev.date);
      d.entryCount = Math.max(0, d.entryCount - 1);
      d.titles = removeTitle(d.titles, prev.title);
      touched.add(prev.date);
    }
    if (e.type === 'upsert' && inRange(e.entry.date)) {
      const d = day(e.entry.date);
      d.entryCount++;
      if (e.entry.title) d.titles = [...d.titles, e.entry.title];
      touched.add(e.entry.date);
    }
  }

  // Habit totals: a habit created offline counts from now; an archive removes it.
  let totalDelta = 0;
  for (const h of fx.habits) {
    if (h.type === 'upsert' && h.created && !h.habit.isArchived) totalDelta++;
    else if (h.type === 'archive') totalDelta += h.archived ? -1 : 1;
    else if (h.type === 'remove') totalDelta--;
  }

  for (const l of fx.logs) {
    if (!inRange(l.date)) continue;
    const d = day(l.date);
    const habit = ctx.habits.get(l.habitId);
    const spec = habit ?? { frequency: 'daily' as const, target: 1 };
    const before = l.prevValue !== undefined && l.prevValue !== null ? (isLogCompleted(spec, l.prevValue) ? 1 : 0) : 0;
    const after = l.type === 'set' ? (isLogCompleted(spec, l.value) ? 1 : 0) : 0;
    d.habitsCompleted = Math.max(0, d.habitsCompleted + after - before);
    touched.add(l.date);
  }

  for (const d of byDate.values()) {
    d.hasEntry = d.entryCount > 0;
    if (totalDelta !== 0 && d.date <= ctx.today) d.habitsTotal = Math.max(0, d.habitsTotal + totalDelta);
    if (touched.has(d.date) && ctx.dayEntries) {
      const known = ctx.dayEntries(d.date);
      if (known) {
        const entries = dayEntries(known, d.date, fx);
        const avg = dayAverages(entries);
        d.mood = avg.moodAvg;
        d.energy = avg.energyAvg;
        d.stress = avg.stressAvg;
        d.sleepHours = avg.sleepHours;
      }
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** The month view with the effects applied (every day of the month stays present). */
export function overlayMonth(month: CalendarMonth, fx: Effects, ctx: CalendarOverlayContext): CalendarMonth {
  if (!month.days.length) return month;
  const from = month.days[0].date;
  const to = month.days[month.days.length - 1].date;
  return { ...month, days: overlayDays(month.days, from, to, fx, ctx) };
}

/** The range view (only days with data) with the effects applied; days left without data are dropped. */
export function overlayRange(days: readonly CalendarDay[], from: string, to: string, fx: Effects, ctx: CalendarOverlayContext): CalendarDay[] {
  return overlayDays(days, from, to, fx, ctx).filter((d) => d.entryCount > 0 || d.habitsCompleted > 0 || days.some((o) => o.date === d.date));
}
