/**
 * Text helpers shared by the habit widgets (home page, habits page), in the
 * current UI language ('habits.text.*' keys). Every function is pure so it can
 * be unit-tested without the DOM.
 */
import type { Habit, HabitFrequency, HabitWithProgress } from '@shared/types';
import { tr } from '@/i18n/runtime';
import { formatDays, formatNumber, formatPercent } from '@/utils/format';

/** "Daily" / "Weekly" ("יומי" / "שבועי"). */
export function frequencyLabel(frequency: HabitFrequency): string {
  return tr(frequency === 'weekly' ? 'habits.frequency.weekly' : 'habits.frequency.daily');
}

/** "3 weeks" / "1 week" ("3 שבועות" / "שבוע אחד" / "שבועיים"). */
export function formatWeeks(weeks: number): string {
  return tr('habits.text.weeks', { count: weeks });
}

/** "Target: 8 glasses per day" / "Target: 3 times per week". */
export function targetText(habit: Pick<Habit, 'target' | 'unit' | 'frequency'>): string {
  return tr('habits.text.target', { target: formatNumber(habit.target), unit: habit.unit, frequency: habit.frequency });
}

/** Amount logged today (0 when nothing was reported yet). */
export function todayValue(item: HabitWithProgress): number {
  return item.today?.value ?? 0;
}

/**
 * Amount measured against the target: today's log for daily habits, the
 * week total for weekly habits.
 */
export function progressValue(item: HabitWithProgress): number {
  return item.habit.frequency === 'weekly' ? item.weekTotal : todayValue(item);
}

/** "5 of 8 glasses" (daily) / "This week: 2 of 3 times (today: 1)" (weekly). */
export function progressText(item: HabitWithProgress): string {
  const { habit } = item;
  const progress = tr('habits.text.progress', { value: formatNumber(progressValue(item)), target: formatNumber(habit.target), unit: habit.unit });
  if (habit.frequency !== 'weekly') return progress;
  const today = todayValue(item);
  return today > 0 ? tr('habits.text.progressWeekToday', { progress, today: formatNumber(today) }) : tr('habits.text.progressWeek', { progress });
}

/** "Current streak: 5 days (best: 12 days)" - weeks for weekly habits. */
export function streakText(item: HabitWithProgress): string {
  const fmt = item.habit.frequency === 'weekly' ? formatWeeks : formatDays;
  const current = item.currentStreak > 0 ? fmt(item.currentStreak) : tr('habits.text.noStreak');
  return item.bestStreak > 0 ? tr('habits.text.streakWithBest', { current, best: fmt(item.bestStreak) }) : tr('habits.text.streak', { current });
}

/** "Completion in the last 30 days: 70%" (daily) / "Completion in the last 4 weeks: 75%" (weekly). */
export function completionText(item: HabitWithProgress): string {
  return tr('habits.text.completion', { frequency: item.habit.frequency, percent: formatPercent(item.completionRate30) });
}
