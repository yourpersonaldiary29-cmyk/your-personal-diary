/**
 * Overlay of `GET /api/entries/day/:date` (section 4.6, row "DaySummary"): the day's entries with the
 * effects applied, its habit logs with names from the known habits, and the averages recomputed as
 * the server's `getDay` does (mean rounded to 2 decimals; the largest sleep value).
 */
import type { DaySummary, Entry, Habit, HabitLogWithName } from '@shared/types';
import { compareDateTimeId, isLogCompleted, max2, mean2, type Effects, type OverlayContext } from './effects';

/** The entries of `date` after the effects (sorted by time, then id). */
export function dayEntries(base: readonly Entry[], date: string, fx: Effects): Entry[] {
  const byId = new Map<number, Entry>(base.filter((e) => e.date === date).map((e) => [e.id, e]));
  for (const e of fx.entries) {
    if (e.type === 'delete') byId.delete(e.id);
    else if (e.entry.date === date) byId.set(e.entry.id, e.entry);
    else byId.delete(e.entry.id);
  }
  return [...byId.values()].sort(compareDateTimeId);
}

/** The averages of a day's entries, as `getDay` computes them. */
export function dayAverages(entries: readonly Entry[]): Pick<DaySummary, 'moodAvg' | 'energyAvg' | 'stressAvg' | 'sleepHours'> {
  return {
    moodAvg: mean2(entries.map((e) => e.mood)),
    energyAvg: mean2(entries.map((e) => e.energy)),
    stressAvg: mean2(entries.map((e) => e.stress)),
    sleepHours: max2(entries.map((e) => e.sleepHours)),
  };
}

function withName(habit: Habit | undefined, log: HabitLogWithName['log'], fallback?: HabitLogWithName): HabitLogWithName {
  return {
    log,
    habitName: habit?.name ?? fallback?.habitName ?? '',
    unit: habit?.unit ?? fallback?.unit ?? '',
    target: habit?.target ?? fallback?.target ?? 1,
    frequency: habit?.frequency ?? fallback?.frequency ?? 'daily',
  };
}

/** The habit logs of `date` after the effects; names follow the known habits. */
export function dayLogs(base: readonly HabitLogWithName[], date: string, fx: Effects, ctx: Pick<OverlayContext, 'habits'>): HabitLogWithName[] {
  const byHabit = new Map<number, HabitLogWithName>(base.map((l) => [l.log.habitId, l]));
  for (const e of fx.logs) {
    if (e.date !== date) continue;
    if (e.type === 'delete') {
      byHabit.delete(e.habitId);
      continue;
    }
    const habit = ctx.habits.get(e.habitId);
    const cur = byHabit.get(e.habitId);
    const spec = habit ?? (cur ? { frequency: cur.frequency, target: cur.target } : { frequency: 'daily' as const, target: 1 });
    byHabit.set(
      e.habitId,
      withName(habit, { id: e.logId ?? cur?.log.id ?? -1, habitId: e.habitId, date, value: e.value, completed: isLogCompleted(spec, e.value), note: e.note }, cur),
    );
  }
  for (const e of fx.habits) {
    if (e.type === 'remove') byHabit.delete(e.id);
  }
  // Names from the known habits (a rename applied offline shows at once).
  const out = [...byHabit.values()].map((l) => {
    const h = ctx.habits.get(l.log.habitId);
    return h ? { ...l, habitName: h.name, unit: h.unit, target: h.target, frequency: h.frequency } : l;
  });
  return out.sort((a, b) => {
    const ha = ctx.habits.get(a.log.habitId);
    const hb = ctx.habits.get(b.log.habitId);
    const sa = ha?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const sb = hb?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    return sa !== sb ? sa - sb : a.log.habitId - b.log.habitId;
  });
}

/** The day view with the effects applied (`view` null: synthesised from the effects alone). */
export function overlayDay(view: DaySummary | null, date: string, fx: Effects, ctx: Pick<OverlayContext, 'habits'>): DaySummary {
  const entries = dayEntries(view?.entries ?? [], date, fx);
  const habitLogs = dayLogs(view?.habitLogs ?? [], date, fx, ctx);
  return { date, entries, habitLogs, ...dayAverages(entries) };
}
