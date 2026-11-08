import { describe, expect, it } from 'vitest';
import type { HabitWithProgress } from '@shared/types';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { completionText, formatWeeks, frequencyLabel, progressText, progressValue, streakText, targetText, todayValue } from './habit-text';

// Hebrew is the reference wording of the original app; English is the product default.
pinLocaleForTests('he');

const water: HabitWithProgress = {
  habit: {
    id: 1,
    name: 'שתיית מים',
    description: '',
    target: 8,
    unit: 'כוסות',
    frequency: 'daily',
    reminderTime: null,
    reminderEnabled: false,
    isArchived: false,
    sortOrder: 0,
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  today: { id: 10, habitId: 1, date: '2026-09-23', value: 5, completed: false, note: '' },
  currentStreak: 3,
  bestStreak: 7,
  weekTotal: 20,
  completedLast30: 21,
  completionRate30: 0.7,
  targetMet: false,
};

const exercise: HabitWithProgress = {
  ...water,
  habit: { ...water.habit, id: 2, name: 'פעילות גופנית', target: 3, unit: 'פעמים', frequency: 'weekly' },
  today: { id: 11, habitId: 2, date: '2026-09-23', value: 1, completed: false, note: '' },
  weekTotal: 2,
  currentStreak: 2,
  bestStreak: 3,
  completionRate30: 0.75,
};

describe('habit-text (Hebrew)', () => {
  it('formats target, progress, streak and completion', () => {
    expect(frequencyLabel('daily')).toBe('יומי');
    expect(frequencyLabel('weekly')).toBe('שבועי');
    expect(targetText(water.habit)).toBe('יעד: 8 כוסות ביום');
    expect(targetText(exercise.habit)).toBe('יעד: 3 פעמים בשבוע');
    expect(progressText(water)).toBe('5 מתוך 8 כוסות');
    expect(progressText(exercise)).toBe('השבוע: 2 מתוך 3 פעמים (היום: 1)');
    expect(progressText({ ...exercise, today: null, weekTotal: 1 })).toBe('השבוע: 1 מתוך 3 פעמים');
    expect(streakText(water)).toBe('רצף נוכחי: 3 ימים (השיא: 7 ימים)');
    expect(streakText(exercise)).toBe('רצף נוכחי: שבועיים (השיא: 3 שבועות)');
    expect(streakText({ ...water, currentStreak: 0, bestStreak: 0 })).toBe('רצף נוכחי: אין רצף כרגע');
    expect(completionText(water)).toBe('השלמה ב-30 הימים האחרונים: 70%');
    expect(completionText(exercise)).toBe('השלמה ב-4 השבועות האחרונים: 75%');
    expect(formatWeeks(1)).toBe('שבוע אחד');
    expect(formatWeeks(2)).toBe('שבועיים');
    expect(formatWeeks(5)).toBe('5 שבועות');
  });

  it('progress helpers use the week total for weekly habits', () => {
    expect(todayValue(water)).toBe(5);
    expect(todayValue({ ...water, today: null })).toBe(0);
    expect(progressValue(water)).toBe(5);
    expect(progressValue(exercise)).toBe(2);
  });
});

describe('habit-text (English)', () => {
  const glasses: HabitWithProgress = { ...water, habit: { ...water.habit, unit: 'glasses' } };
  const sessions: HabitWithProgress = { ...exercise, habit: { ...exercise.habit, unit: 'times' } };

  it('formats the same phrases in English with English plurals', () => {
    setCurrentLocale('en');
    expect(frequencyLabel('weekly')).toBe('Weekly');
    expect(targetText(glasses.habit)).toBe('Target: 8 glasses per day');
    expect(targetText(sessions.habit)).toBe('Target: 3 times per week');
    expect(progressText(glasses)).toBe('5 of 8 glasses');
    expect(progressText(sessions)).toBe('This week: 2 of 3 times (today: 1)');
    expect(streakText(glasses)).toBe('Current streak: 3 days (best: 7 days)');
    expect(streakText({ ...sessions, currentStreak: 1, bestStreak: 1 })).toBe('Current streak: 1 week (best: 1 week)');
    expect(streakText({ ...glasses, currentStreak: 0, bestStreak: 0 })).toBe('Current streak: none at the moment');
    expect(completionText(glasses)).toBe('Completion in the last 30 days: 70%');
    expect(completionText(sessions)).toBe('Completion in the last 4 weeks: 75%');
    expect(formatWeeks(1)).toBe('1 week');
    expect(formatWeeks(2)).toBe('2 weeks');
  });
});
