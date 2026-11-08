/**
 * The shape of one language's demo texts ("Load sample data"). One file per language lives next to
 * this one (`<locale>.ts`, default export of type `SeedContent`); `en.ts` is the reference - every
 * other file has pools of exactly the same sizes, in the same order of meaning. README.md in this
 * folder is the full contract (sizes, rules, how the tests check a file).
 *
 * Only texts live here. Everything that shapes the demo - dates, ratings, habit targets and values,
 * which pool item is drawn when - is decided in ../seed.ts and is the same in every language.
 */

/** The habits the demo creates, in display order (language independent ids). */
export const SEED_HABIT_KEYS = ['walk', 'water', 'reading', 'exercise', 'meditation'] as const;
export type SeedHabitKey = (typeof SEED_HABIT_KEYS)[number];

/** Time of day of a demo entry: "midday" is 10:00-12:59, "evening" is 18:00-22:59. */
export type SeedSlot = 'midday' | 'evening';

/** The words of one demo habit (its target and frequency are fixed in ../seed.ts). */
export interface SeedHabitText {
  name: string;
  description: string;
  unit: string;
}

export interface SeedContent {
  /**
   * Own names, descriptions and units of the five demo habits. LEAVE THIS OUT in every new language:
   * the habits then use the app's habit templates in that language (shared/i18n/messages/<locale>/habits.ts),
   * so the demo habits are named exactly like the templates the user sees. Only `he` and `en` carry it
   * (the texts they always had).
   */
  habits?: Record<SeedHabitKey, SeedHabitText>;

  /** Entry titles by the day's mood: high (8-10), mid (5-7), low (1-4). 6 each. */
  titles: { high: string[]; mid: string[]; low: string[] };
  /** First sentence of the entry body, by the day's mood. 4 each. */
  openers: { high: string[]; mid: string[]; low: string[] };
  /** Things that happened that day (short noun phrases, shown as chips). 14. */
  events: string[];
  /** Extra events that are possible only on Sundays (the planted "stressful Sunday"). 3. */
  sundayEvents: string[];
  /** First names (fictional) and, in slots 3 and 4, the words for mother and father. 10. */
  people: string[];
  /** Places (shown as the entry's location). 7. */
  locations: string[];
  /** Tags: single lowercase-style words without spaces or '#'. 10. */
  tags: string[];
  /** The tag added on exercise days: the same string as the "sport" slot of `tags` (slot 5). */
  sportTag: string;
  /** Kinds of exercise: stored as the entry's exercise type AND put into `exercise()`. 6. */
  exerciseTypes: string[];
  /** The one very bad day of the demo. */
  badDay: { title: string; body: string };
  /** The one very good day of the demo. */
  goodDay: { title: string; body: string };
  /**
   * Sentence about last night's sleep. `hours` is already formatted for the language ("7.5" / "7,5")
   * and is what the sentence shows; `value` is the same number (4 to 9 in halves; below 6 exactly
   * when `low`) for languages whose word for "hours" changes with it.
   */
  sleep(hours: string, low: boolean, value: number): string;
  /**
   * Sentence about the day's exercise. `type` is one of `exerciseTypes`; `minutes` is already
   * formatted and is what the sentence shows; `value` is the same number (a whole number, 20 to 60).
   */
  exercise(type: string, minutes: string, slot: SeedSlot, value: number): string;
  /** Opening of the day's second entry (a short check-in). */
  secondEntry(slot: SeedSlot): string;
  /** Sentence added to every Sunday entry. */
  sundayNote: string;
  /** "I met X and Y." (`met`) / "I talked with X." (`!met`); `names` has one or two items of `people`. */
  peopleSentence(names: string[], met: boolean): string;
  /** The text of the entry's "notes" field (about one entry in five has it). */
  note: string;

  /**
   * What stands between two sentences of an entry body. Leave it out for one space (the default);
   * Chinese and Japanese set '' (no space after "。").
   */
  sentenceSeparator?: '' | ' ';

  /**
   * Languages written in Latin letters only: the one-word items of this file (`people`, `locations`,
   * `tags`, `exerciseTypes`) that are intentionally spelled exactly like an English item - cognates
   * such as 'sport' or 'yoga', a first name such as 'Dana'. Every other string that equals an English
   * string is reported by the tests as an untranslated leftover.
   */
  sameAsEnglish?: string[];
}
