/**
 * Overlay of the habit views (section 4.6, rows "HabitWithProgress[]" and "Habit[]"): creation (zero
 * progress), edits, archive, today's log value and note; `completed` follows `isLogCompleted`;
 * `weekTotal` moves by the delta of the logged value; streaks are kept (they update when online).
 */
import type { Habit, HabitLog, HabitWithProgress } from '@shared/types';
import { addDaysIso, isLogCompleted, weekStartIso, type Effects, type HabitEffect, type OverlayContext } from './effects';

function sortHabits(list: Habit[]): Habit[] {
  return list.sort((a, b) => (a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.id - b.id));
}

/** `GET /api/habits?includeArchived=...` with the habit effects applied. */
export function overlayHabits(list: readonly Habit[], includeArchived: boolean, fx: Effects): Habit[] {
  const byId = new Map<number, Habit>(list.map((h) => [h.id, h]));
  for (const e of fx.habits) applyHabitEffect(byId, e);
  const out = [...byId.values()].filter((h) => includeArchived || !h.isArchived);
  return sortHabits(out);
}

function applyHabitEffect(byId: Map<number, Habit>, e: HabitEffect): void {
  switch (e.type) {
    case 'upsert':
      byId.set(e.habit.id, e.habit);
      break;
    case 'patch': {
      const cur = byId.get(e.id);
      if (cur) byId.set(e.id, { ...cur, ...e.fields });
      break;
    }
    case 'archive': {
      const cur = byId.get(e.id);
      if (cur) byId.set(e.id, { ...cur, isArchived: e.archived });
      break;
    }
    case 'remove':
      byId.delete(e.id);
      break;
  }
}

/** Every habit known to the overlay: the cached lists plus the effects (the names of logs, the targets). */
export function knownHabits(lists: readonly (readonly Habit[])[], fx: Effects): Map<number, Habit> {
  const byId = new Map<number, Habit>();
  for (const list of lists) for (const h of list) byId.set(h.id, h);
  for (const e of fx.habits) applyHabitEffect(byId, e);
  return byId;
}

function freshProgress(habit: Habit): HabitWithProgress {
  return { habit, today: null, currentStreak: 0, bestStreak: 0, weekTotal: 0, completedLast30: 0, completionRate30: 0, targetMet: false };
}

/** `GET /api/habits/progress?date=D` with the effects applied. */
export function overlayProgress(list: readonly HabitWithProgress[], date: string, fx: Effects, ctx: Pick<OverlayContext, 'firstDayOfWeek'>): HabitWithProgress[] {
  const byId = new Map<number, HabitWithProgress>(list.map((p) => [p.habit.id, { ...p, habit: { ...p.habit } }]));
  for (const e of fx.habits) {
    switch (e.type) {
      case 'upsert': {
        const cur = byId.get(e.habit.id);
        if (e.habit.isArchived) byId.delete(e.habit.id);
        else byId.set(e.habit.id, cur ? { ...cur, habit: e.habit } : freshProgress(e.habit));
        break;
      }
      case 'patch': {
        const cur = byId.get(e.id);
        if (cur) byId.set(e.id, { ...cur, habit: { ...cur.habit, ...e.fields } });
        break;
      }
      case 'archive': {
        if (e.archived) byId.delete(e.id);
        else {
          const cur = byId.get(e.id);
          if (cur) byId.set(e.id, { ...cur, habit: { ...cur.habit, isArchived: false } });
        }
        break;
      }
      case 'remove':
        byId.delete(e.id);
        break;
    }
  }

  const ws = weekStartIso(date, ctx.firstDayOfWeek);
  const we = addDaysIso(ws, 6);
  const thirtyStart = addDaysIso(date, -29);
  for (const l of fx.logs) {
    const p = byId.get(l.habitId);
    if (!p) continue;
    const habit = p.habit;
    const inWeek = l.date >= ws && l.date <= we;
    const prevValue = l.prevValue ?? (l.date === date ? (p.today?.value ?? 0) : 0);
    const value = l.type === 'set' ? l.value : 0;
    if (inWeek) p.weekTotal = Math.max(0, p.weekTotal + value - prevValue);
    const wasCompleted = isLogCompleted(habit, prevValue) && (l.prevValue !== undefined && l.prevValue !== null ? true : l.date === date && !!p.today);
    const nowCompleted = l.type === 'set' && isLogCompleted(habit, value);
    if (habit.frequency === 'daily' && l.date >= thirtyStart && l.date <= date) {
      p.completedLast30 = Math.max(0, p.completedLast30 + (nowCompleted ? 1 : 0) - (wasCompleted ? 1 : 0));
    }
    if (l.date === date) {
      if (l.type === 'set') {
        const today: HabitLog = { id: l.logId ?? p.today?.id ?? -1, habitId: habit.id, date, value, completed: nowCompleted, note: l.note };
        p.today = today;
      } else {
        p.today = null;
      }
    }
  }
  for (const p of byId.values()) {
    // The target may have changed offline: completion follows the habit as shown.
    if (p.today) p.today = { ...p.today, completed: isLogCompleted(p.habit, p.today.value) };
    p.targetMet = p.habit.frequency === 'daily' ? (p.today?.completed ?? false) : p.weekTotal >= p.habit.target;
  }
  return [...byId.values()].sort((a, b) => (a.habit.sortOrder !== b.habit.sortOrder ? a.habit.sortOrder - b.habit.sortOrder : a.habit.id - b.habit.id));
}
