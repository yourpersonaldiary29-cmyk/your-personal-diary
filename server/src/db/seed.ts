/**
 * Deterministic demo data ("נתוני הדגמה" / "demo data") for an empty diary.
 *
 * The generator uses a seeded PRNG (mulberry32) so the same `days` + `seed` always
 * produce exactly the same entries and habit logs. Several relationships are planted
 * on purpose so the analysis engine has something real to find:
 *
 *   - nights with < 6 hours of sleep  -> mood about 2 points lower (energy lower too)
 *   - days with exerciseMinutes > 0    -> energy about 1.5 points higher
 *   - Sundays (weekday 0)              -> stress about 2 points higher
 *   - weeks with >= 4 days of reading at the daily target (20 min) -> mood about 1.5 points higher;
 *     reading weeks alternate with other weeks, where the occasional short read stays below the
 *     target - so the engine's day-level habit/mood check sees the pattern in any 3-month window
 *   - entries written 10:00-13:00      -> mood about 1 point higher than evening entries
 *   - one anomalous very bad day and one very good day
 *   - about 12% "rough days" (independent of sleep): mood about 2.5 points lower, energy a bit
 *     lower and stress higher - so the diary contains genuinely low-mood days, as real ones do
 *   - emotions follow the mood (high -> happy/calm/satisfied, low -> tired/sad/stressed)
 *   - the weekly "exercise" habit is logged exactly on days with exercise minutes
 *
 * Texts come from a per-language content set: one file per language in ./seed-content/
 * (`<locale>.ts`, registered in ./seed-content/index.ts; README.md there is the contract). A
 * language without its own file gets the English texts. All sets have pools of identical sizes
 * and the random draws happen in the same order, so the *structure* of the demo (dates, moods,
 * habit values) is the same in every language - only the words differ.
 */
import { habitTemplateDescription, habitTemplateName, habitTemplateUnit, type HabitTemplateUnit } from '@shared/constants';
import { DEFAULT_LOCALE, formatNumber, type Locale } from '@shared/i18n';
import type { EntryInput, Habit, HabitFrequency, SeedDemoResult } from '@shared/types';
import { ApiError } from '../errors';
import { addDays, nowHHMM, todayIso, weekStart, weekday } from '../util/dates';
import type { DiaryDb } from './database';
import { countEntries, createEntry } from './entries-repo';
import { createHabit, logHabit } from './habits-repo';
import { SEED_CONTENT, SEED_HABIT_KEYS, type SeedContent, type SeedHabitKey, type SeedSlot } from './seed-content';

export const SEED_DEFAULT_DAYS = 120;
export const SEED_DEFAULT_SEED = 42;
export const SEED_MIN_DAYS = 7;
export const SEED_MAX_DAYS = 730;
/** Daily target of the demo "reading" habit (minutes); the weekly mood bonus counts days at it. */
export const SEED_READING_TARGET = 20;

// The texts and their shape live in ./seed-content; re-exported for the callers of this module.
export { SEED_CONTENT, SEED_CONTENT_LOCALES, SEED_HABIT_KEYS } from './seed-content';
export type { SeedContent, SeedHabitKey, SeedHabitText } from './seed-content';

/** A language whose demo texts are used: the locale itself when it has a content file, else 'en'. */
export type SeedLanguage = Locale;

/** The language of the demo texts for `locale`: the locale itself when it has its own texts, English otherwise. */
export function seedLanguageOf(locale: Locale): SeedLanguage {
  return SEED_CONTENT[locale] ? locale : 'en';
}

// ---------------------------------------------------------------------------
// Content sets
// ---------------------------------------------------------------------------

type Slot = SeedSlot;

export interface SeedHabitDef {
  key: SeedHabitKey;
  name: string;
  description: string;
  target: number;
  unit: string;
  frequency: HabitFrequency;
}

/** A content set as the generator uses it: the texts of one language plus the five resolved habits. */
export type ResolvedSeedContent = Omit<SeedContent, 'habits'> & { habits: SeedHabitDef[] };

/**
 * The language-independent part of the demo habits: target and frequency (the planted patterns
 * depend on them), and the habit template (shared habitTemplates catalogue) whose name, description
 * and unit are used when the content set has no habit texts of its own.
 */
const SEED_HABITS: Record<SeedHabitKey, { slug: string; unit: HabitTemplateUnit; target: number; frequency: HabitFrequency }> = {
  walk: { slug: 'walking', unit: 'minutes', target: 30, frequency: 'daily' },
  water: { slug: 'water', unit: 'cups', target: 8, frequency: 'daily' },
  reading: { slug: 'reading', unit: 'minutes', target: SEED_READING_TARGET, frequency: 'daily' },
  exercise: { slug: 'exercise', unit: 'times', target: 3, frequency: 'weekly' },
  meditation: { slug: 'meditation', unit: 'minutes', target: 10, frequency: 'daily' },
};

/**
 * The demo texts used for `locale`: its own content set when it has one, English otherwise. The
 * habits are always named in `locale` itself: a set's own habit texts are used only for its own
 * language, everything else comes from the habit templates of `locale` (so a German diary never
 * shows "Ziel: 30 minutes pro Tag", with or without German demo texts). In a language without its
 * own set the Settings confirmation says the sample entries are in English.
 */
export function seedContent(locale: Locale = DEFAULT_LOCALE): ResolvedSeedContent {
  const language = seedLanguageOf(locale);
  const base: SeedContent = SEED_CONTENT[language] ?? SEED_CONTENT.en;
  const ownHabits = language === locale ? base.habits : undefined;
  return {
    ...base,
    habits: SEED_HABIT_KEYS.map((key) => {
      const { slug, unit, target, frequency } = SEED_HABITS[key];
      const text = ownHabits?.[key] ?? {
        name: habitTemplateName(slug, locale),
        description: habitTemplateDescription(slug, locale),
        unit: habitTemplateUnit(unit, locale),
      };
      return { key, name: text.name, description: text.description, target, unit: text.unit, frequency };
    }),
  };
}

/** Names of the demo habits in display order, in the language of `locale`. */
export function seedHabitNames(locale: Locale = DEFAULT_LOCALE): string[] {
  return seedContent(locale).habits.map((h) => h.name);
}

// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------

/** mulberry32 - small, fast, deterministic 32-bit generator. Returns [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  private readonly next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  /** [0, 1) */
  float(): number {
    return this.next();
  }
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
  /** `count` distinct items (or fewer when the pool is smaller). */
  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    while (pool.length && out.length < count) {
      out.push(pool.splice(Math.floor(this.next() * pool.length), 1)[0]);
    }
    return out;
  }
  /** Roughly bell-shaped noise in (-scale, scale). */
  noise(scale: number): number {
    return (this.next() + this.next() - 1) * scale;
  }
}

const EMOTIONS_HIGH = ['happy', 'calm', 'satisfied', 'energetic', 'grateful', 'proud', 'excited', 'hopeful'];
const EMOTIONS_MID = ['calm', 'focused', 'satisfied', 'hopeful', 'bored', 'grateful'];
const EMOTIONS_LOW = ['tired', 'sad', 'stressed', 'frustrated', 'anxious', 'lonely', 'overwhelmed'];

// ---------------------------------------------------------------------------
// Plan (all random draws happen here, before anything is written)
// ---------------------------------------------------------------------------

interface DayPlan {
  date: string;
  weekday: number;
  weekStart: string;
  lowSleep: boolean;
  sleepHours: number;
  /** A day that simply went badly (independent of sleep and exercise). */
  roughDay: boolean;
  /** null = not reported, 0 = explicitly none. */
  exerciseMinutes: number | null;
  exerciseType: string;
  /** Number of entries: 0 (skipped), 1 or 2. */
  entryCount: number;
  /** Time-of-day of each entry ("midday" 10:00-12:59, "evening" 18:00-22:59). */
  slots: Slot[];
  anomaly: 'bad' | 'good' | null;
  /** habit key -> value logged that day */
  habitLogs: Map<SeedHabitKey, number>;
}

function clampRating(x: number): number {
  return Math.min(10, Math.max(1, Math.round(x)));
}

function timeInSlot(rng: Rng, slot: Slot): string {
  const hour = slot === 'midday' ? rng.int(10, 12) : rng.int(18, 22);
  return `${String(hour).padStart(2, '0')}:${String(rng.int(0, 59)).padStart(2, '0')}`;
}

function buildPlans(rng: Rng, content: ResolvedSeedContent, days: number, today: string): DayPlan[] {
  const readingWeek = new Map<string, boolean>();
  const badIndex = Math.floor(days * 0.42);
  const goodIndex = Math.floor(days * 0.73);
  const plans: DayPlan[] = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(today, -(days - 1 - i));
    const ws = weekStart(date, 0);
    // Every other week is a reading week, so any 30-day window holds both kinds of weeks.
    if (!readingWeek.has(ws)) readingWeek.set(ws, readingWeek.size % 2 === 1);
    const isReadingWeek = readingWeek.get(ws)!;

    const lowSleep = rng.chance(0.22);
    // Low nights: 4.0..5.5 in halves; normal nights: 6.0..9.0 in halves.
    const sleepHours = lowSleep ? 4 + rng.int(0, 3) * 0.5 : 6 + rng.int(0, 6) * 0.5;
    const roughDay = rng.chance(0.12);

    const exerciseRoll = rng.float();
    const exerciseMinutes = exerciseRoll < 0.45 ? rng.int(20, 60) : exerciseRoll < 0.88 ? 0 : null;
    const exerciseType = exerciseMinutes ? rng.pick(content.exerciseTypes) : '';

    const anomaly: DayPlan['anomaly'] = i === badIndex ? 'bad' : i === goodIndex ? 'good' : null;
    let entryCount = rng.chance(0.15) ? 0 : 1;
    if (entryCount === 1 && rng.chance(0.15)) entryCount = 2;
    if (anomaly) entryCount = 1;
    const firstSlot: Slot = rng.chance(0.35) ? 'midday' : 'evening';
    const slots: Slot[] = entryCount === 0 ? [] : entryCount === 1 ? [firstSlot] : ['midday', 'evening'];

    const habitLogs = new Map<SeedHabitKey, number>();
    if (rng.chance(0.65)) habitLogs.set('walk', rng.int(10, 60));
    if (rng.chance(0.85)) habitLogs.set('water', rng.int(3, 12));
    // Reading weeks: most days at or above the daily target; other weeks: an occasional short read.
    if (isReadingWeek) {
      if (rng.chance(0.85)) habitLogs.set('reading', rng.int(SEED_READING_TARGET, 45));
    } else if (rng.chance(0.3)) {
      habitLogs.set('reading', rng.int(5, SEED_READING_TARGET - 5));
    }
    if (exerciseMinutes && exerciseMinutes > 0) habitLogs.set('exercise', 1);
    if (rng.chance(0.5)) habitLogs.set('meditation', rng.int(5, 20));

    plans.push({
      date,
      weekday: weekday(date),
      weekStart: ws,
      lowSleep,
      sleepHours,
      roughDay,
      exerciseMinutes,
      exerciseType,
      entryCount,
      slots,
      anomaly,
      habitLogs,
    });
  }
  return plans;
}

/** Weeks (by week start) with at least four days of reading at the daily target. */
function readingBonusWeeks(plans: DayPlan[]): Set<string> {
  const counts = new Map<string, number>();
  for (const p of plans) {
    if ((p.habitLogs.get('reading') ?? 0) >= SEED_READING_TARGET) counts.set(p.weekStart, (counts.get(p.weekStart) ?? 0) + 1);
  }
  const weeks = new Set<string>();
  for (const [ws, n] of counts) if (n >= 4) weeks.add(ws);
  return weeks;
}

// ---------------------------------------------------------------------------
// Entry composition
// ---------------------------------------------------------------------------

function composeEntry(
  rng: Rng,
  content: ResolvedSeedContent,
  locale: Locale,
  plan: DayPlan,
  slot: Slot,
  first: boolean,
  readingBonus: boolean,
): EntryInput {
  const time = timeInSlot(rng, slot);
  const exercised = (plan.exerciseMinutes ?? 0) > 0;
  /** Between the sentences of the body: a space, or nothing in languages that write none (zh, ja). */
  const separator = content.sentenceSeparator ?? ' ';

  let mood: number;
  let energy: number;
  let stress: number;
  let sleepQuality: number;
  let emotions: string[];
  let title: string;
  let body: string;

  if (plan.anomaly === 'bad') {
    mood = 1;
    energy = 2;
    stress = 10;
    sleepQuality = 2;
    emotions = ['sad', 'overwhelmed', 'stressed', 'tired'];
    title = content.badDay.title;
    body = content.badDay.body;
  } else if (plan.anomaly === 'good') {
    mood = 10;
    energy = 10;
    stress = 1;
    sleepQuality = 9;
    emotions = ['happy', 'excited', 'grateful', 'proud', 'energetic'];
    title = content.goodDay.title;
    body = content.goodDay.body;
  } else {
    // Mood spans the whole 1..10 scale: wider noise plus the occasional rough day.
    let m = 6.0 + rng.noise(2.0);
    if (plan.lowSleep) m -= 2;
    if (plan.roughDay) m -= 2.5;
    if (readingBonus) m += 1.5;
    if (slot === 'midday') m += 1;
    if (exercised) m += 0.3;
    mood = clampRating(m);

    let e = 5.8 + rng.noise(1.6);
    if (exercised) e += 1.5;
    if (plan.lowSleep) e -= 0.8;
    if (plan.roughDay) e -= 0.8;
    energy = clampRating(e);

    let s = 4.3 + rng.noise(1.6);
    if (plan.weekday === 0) s += 2;
    if (plan.lowSleep) s += 0.5;
    if (plan.roughDay) s += 1;
    if (exercised) s -= 0.3;
    stress = clampRating(s);

    sleepQuality = clampRating(plan.lowSleep ? 3 + rng.noise(1.5) : 6.5 + rng.noise(1.8));

    if (mood >= 8) emotions = rng.sample(EMOTIONS_HIGH, rng.int(2, 3));
    else if (mood >= 5) emotions = rng.sample(EMOTIONS_MID, rng.int(1, 2));
    else emotions = rng.sample(EMOTIONS_LOW, rng.int(2, 3));
    if (plan.lowSleep && !emotions.includes('tired') && rng.chance(0.7)) emotions.push('tired');
    if (stress >= 7 && !emotions.includes('stressed') && rng.chance(0.6)) emotions.push('stressed');

    const level = mood >= 8 ? 'high' : mood >= 5 ? 'mid' : 'low';
    title = rng.pick(content.titles[level]);
    const parts: string[] = [rng.pick(content.openers[level])];
    if (first) {
      parts.push(content.sleep(formatNumber(locale, plan.sleepHours), plan.lowSleep, plan.sleepHours));
      if (exercised) {
        const minutes = plan.exerciseMinutes ?? 0;
        parts.push(content.exercise(plan.exerciseType, formatNumber(locale, minutes), slot, minutes));
      }
    } else {
      // The day's second entry: a short check-in rather than a repeat of the morning report.
      parts.push(content.secondEntry(slot));
    }
    if (plan.weekday === 0) parts.push(content.sundayNote);
    body = parts.join(separator);
  }

  const people = rng.chance(0.6) ? rng.sample(content.people, rng.int(1, 2)) : [];
  if (people.length) body += `${separator}${content.peopleSentence(people, rng.chance(0.5))}`;
  const events = rng.chance(0.7)
    ? rng.sample(plan.weekday === 0 ? [...content.events, ...content.sundayEvents] : content.events, rng.int(1, 2))
    : [];
  const location = rng.chance(0.8) ? rng.pick(content.locations) : '';
  const tags = rng.sample(content.tags, rng.int(1, 3));
  if (exercised && !tags.includes(content.sportTag) && rng.chance(0.5)) tags.push(content.sportTag);

  return {
    date: plan.date,
    time,
    title,
    body,
    mood,
    emotions,
    energy,
    stress,
    sleepQuality: first ? sleepQuality : null,
    sleepHours: first ? plan.sleepHours : null,
    exerciseMinutes: first ? plan.exerciseMinutes : null,
    exerciseType: first ? plan.exerciseType : '',
    events,
    people,
    location,
    notes: rng.chance(0.2) ? content.note : '',
    tags,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Fills an empty diary with `days` days of demo data ending at `today`, with texts in the
 * language of `locale` (English when it has no demo texts of its own). Throws
 * `ApiError.validation` when the diary already has entries or habits.
 */
export function seedDemoData(
  db: DiaryDb,
  days: number = SEED_DEFAULT_DAYS,
  seed: number = SEED_DEFAULT_SEED,
  today: string = todayIso(),
  locale: Locale = DEFAULT_LOCALE,
  /** Entries of `today` later than this time (HH:MM) are not created - no demo entry from the future. */
  nowTime: string | null = today === todayIso() ? nowHHMM() : null,
): SeedDemoResult {
  if (!Number.isInteger(days) || days < SEED_MIN_DAYS || days > SEED_MAX_DAYS) {
    throw ApiError.validation('server.settings.daysRange', 'days', { min: SEED_MIN_DAYS, max: SEED_MAX_DAYS });
  }
  if (!Number.isInteger(seed)) throw ApiError.validation('server.seed.seedInteger', 'seed');
  const habitCount = Number(db.scalar<number>('SELECT COUNT(*) FROM habits') ?? 0);
  if (countEntries(db) > 0 || habitCount > 0) {
    throw ApiError.validation('server.seed.diaryNotEmpty');
  }

  const content = seedContent(locale);
  const rng = new Rng(seed);
  const plans = buildPlans(rng, content, days, today);
  const bonusWeeks = readingBonusWeeks(plans);

  return db.transaction(() => {
    const habits = new Map<SeedHabitKey, Habit>();
    for (const def of content.habits) {
      habits.set(
        def.key,
        createHabit(db, {
          name: def.name,
          description: def.description,
          target: def.target,
          unit: def.unit,
          frequency: def.frequency,
          reminderTime: null,
          reminderEnabled: false,
        }),
      );
    }

    let entries = 0;
    let habitLogs = 0;
    for (const plan of plans) {
      for (const [key, value] of plan.habitLogs) {
        logHabit(db, { habitId: habits.get(key)!.id, date: plan.date, value, note: '' });
        habitLogs++;
      }
      // Sleep and exercise are reported once per day (in the earliest entry).
      const slots = [...plan.slots].sort((a, b) => (a === b ? 0 : a === 'midday' ? -1 : 1));
      slots.forEach((slot, index) => {
        const entry = composeEntry(rng, content, locale, plan, slot, index === 0, bonusWeeks.has(plan.weekStart));
        if (nowTime !== null && plan.date === today && entry.time > nowTime) return;
        createEntry(db, entry);
        entries++;
      });
    }
    return { entries, habits: habits.size, habitLogs };
  });
}
