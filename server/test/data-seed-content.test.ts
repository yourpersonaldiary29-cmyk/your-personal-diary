/**
 * The demo texts of every language: server/src/db/seed-content/<locale>.ts (contract: README.md there).
 *
 * The suite reads the folder listing, so a language file that is added later is checked without
 * touching this test. For every file found:
 *   - it is registered in seed-content/index.ts (the server is bundled, nothing is discovered at run time)
 *   - same fields and pool sizes as en.ts (the reference), well-formed texts, sentences built from
 *     their arguments
 *   - no English leftovers (not checked for en itself)
 *   - the demo it produces has exactly the structure of the English demo - dates, ratings, habit
 *     logs and which pool item is used where - so the planted patterns do not depend on the language
 *   - the six example questions of that language's search page find something in the demo
 * Languages without a file are listed as "todo"; they keep getting the English texts.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { habitTemplateName, habitTemplateUnit } from '@shared/constants';
import { formatNumber, isLocale, LOCALE_CODES, localeDef, t, type Locale } from '@shared/i18n';
import type { Entry, Habit } from '@shared/types';
import { generateInsights } from '../src/analysis/engine';
import { DiaryDb } from '../src/db/database';
import { ENTRY_LIMITS, listEntriesFull, normaliseTag, validateEntryInput } from '../src/db/entries-repo';
import { listAllLogs, listHabits, validateHabitInput } from '../src/db/habits-repo';
import {
  SEED_CONTENT,
  SEED_CONTENT_LOCALES,
  SEED_HABIT_KEYS,
  seedContent,
  seedDemoData,
  seedHabitNames,
  seedLanguageOf,
  type ResolvedSeedContent,
  type SeedContent,
} from '../src/db/seed';
import { parseQuery, smartSearch } from '../src/search';
import { addDays, weekday } from '../src/util/dates';

const CONTENT_DIR = fileURLToPath(new URL('../src/db/seed-content/', import.meta.url));
/** The .ts files of the folder that are not a language. */
const NOT_A_LANGUAGE = new Set(['index.ts', 'types.ts']);
const FILE_NAMES = fs
  .readdirSync(CONTENT_DIR)
  .filter((name) => name.endsWith('.ts') && !NOT_A_LANGUAGE.has(name))
  .map((name) => name.slice(0, -'.ts'.length));
/** The languages that have a file, in the order of the language list. */
const FILE_LOCALES = LOCALE_CODES.filter((code) => FILE_NAMES.includes(code));

const EN = SEED_CONTENT.en;
const SLOTS = ['midday', 'evening'] as const;
/** The values the generator draws: 4 to 5.5 hours on a short night, 6 to 9 otherwise; 20 to 60 minutes of exercise. */
const SLEEP_HOURS = Array.from({ length: 11 }, (_, i) => 4 + i * 0.5);
const EXERCISE_MINUTES = Array.from({ length: 41 }, (_, i) => 20 + i);
const LEVELS = ['high', 'mid', 'low'] as const;

// ---------------------------------------------------------------------------
// The checks (pure functions that return a list of problems, so a failure names every one)
// ---------------------------------------------------------------------------

/** The string pools of a content set by name; the random draws index into them. */
function poolsOf(c: SeedContent): Record<string, string[]> {
  return {
    'titles.high': c.titles.high,
    'titles.mid': c.titles.mid,
    'titles.low': c.titles.low,
    'openers.high': c.openers.high,
    'openers.mid': c.openers.mid,
    'openers.low': c.openers.low,
    events: c.events,
    sundayEvents: c.sundayEvents,
    people: c.people,
    locations: c.locations,
    tags: c.tags,
    exerciseTypes: c.exerciseTypes,
  };
}

/** The single texts of a content set by name. */
function textsOf(c: SeedContent): Record<string, string> {
  return {
    sportTag: c.sportTag,
    'badDay.title': c.badDay.title,
    'badDay.body': c.badDay.body,
    'goodDay.title': c.goodDay.title,
    'goodDay.body': c.goodDay.body,
    sundayNote: c.sundayNote,
    note: c.note,
  };
}

/** Every fixed string of a content set with its place ("events[3]"), own habit texts included. */
function fixedStrings(c: SeedContent): Array<[where: string, value: string]> {
  const out: Array<[string, string]> = [];
  for (const [name, pool] of Object.entries(poolsOf(c))) pool.forEach((value, i) => out.push([`${name}[${i}]`, value]));
  out.push(...Object.entries(textsOf(c)));
  for (const [key, habit] of Object.entries(c.habits ?? {})) {
    out.push([`habits.${key}.name`, habit.name], [`habits.${key}.description`, habit.description], [`habits.${key}.unit`, habit.unit]);
  }
  return out;
}

/** The sentences the functions of a content set build, for arguments as the generator passes them. */
function sentencesOf(code: Locale, c: SeedContent): Array<[where: string, value: string]> {
  const out: Array<[string, string]> = [
    ['secondEntry(midday)', c.secondEntry('midday')],
    ['secondEntry(evening)', c.secondEntry('evening')],
  ];
  for (const hours of SLEEP_HOURS) out.push([`sleep(${hours})`, c.sleep(formatNumber(code, hours), hours < 6, hours)]);
  for (const type of c.exerciseTypes) {
    for (const slot of SLOTS) out.push([`exercise(${type}, 45, ${slot})`, c.exercise(type, formatNumber(code, 45), slot, 45)]);
  }
  for (const minutes of EXERCISE_MINUTES) {
    out.push([`exercise(${c.exerciseTypes[0]}, ${minutes}, evening)`, c.exercise(c.exerciseTypes[0], formatNumber(code, minutes), 'evening', minutes)]);
  }
  for (const met of [true, false]) {
    for (const name of c.people) out.push([`peopleSentence([${name}], ${met})`, c.peopleSentence([name], met)]);
    out.push([`peopleSentence([${c.people[0]}, ${c.people[1]}], ${met})`, c.peopleSentence([c.people[0], c.people[1]], met)]);
  }
  return out;
}

function fieldTypes(c: SeedContent): Record<string, string> {
  const optional = new Set(['habits', 'sameAsEnglish', 'sentenceSeparator']);
  return Object.fromEntries(
    Object.entries(c)
      .filter(([key]) => !optional.has(key))
      .map(([key, value]) => [key, Array.isArray(value) ? 'array' : typeof value])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function poolSizes(c: SeedContent): Record<string, number> {
  return Object.fromEntries(Object.entries(poolsOf(c)).map(([name, pool]) => [name, pool.length]));
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];
}

/** A text is one line without stray whitespace and without a broken template. */
function malformed(value: unknown): string | null {
  if (typeof value !== 'string') return 'is not a string';
  if (!value) return 'is empty';
  if (value !== value.trim()) return 'has whitespace at an end';
  if (/[\n\r\t]/.test(value)) return 'has a line break or a tab';
  if (/\s\s/.test(value)) return 'has two spaces in a row';
  if (/\$\{|\bundefined\b|\bNaN\b|\[object /.test(value)) return 'has a broken placeholder';
  return null;
}

/** The fixed strings: well-formed, no duplicates inside a pool, tags usable as tags, within the entry limits. */
function textProblems(c: SeedContent): string[] {
  const problems: string[] = [];
  for (const [where, value] of fixedStrings(c)) {
    const bad = malformed(value);
    if (bad) problems.push(`${where} ${bad}: ${JSON.stringify(value)}`);
  }
  const pools = poolsOf(c);
  for (const [name, pool] of Object.entries(pools)) {
    for (const dup of duplicates(pool)) problems.push(`${name} has "${dup}" twice`);
  }
  // A title / an opener identifies its slot: the same one may not serve two moods.
  const titles = [...LEVELS.flatMap((level) => c.titles[level]), c.badDay.title, c.goodDay.title];
  for (const dup of duplicates(titles)) problems.push(`the title "${dup}" is used twice (titles.*, badDay.title, goodDay.title)`);
  const openers = [...LEVELS.flatMap((level) => c.openers[level]), c.badDay.body, c.goodDay.body];
  openers.forEach((a, i) => {
    if (openers.some((b, j) => i !== j && b.startsWith(a))) problems.push(`the opener "${a}" is the start of another opener`);
  });
  for (const tag of c.tags) {
    if (normaliseTag(tag) !== tag || /[\s#,;،、，]/u.test(tag)) problems.push(`the tag "${tag}" is not a single word usable as a tag`);
  }
  const sportSlot = EN.tags.indexOf(EN.sportTag);
  if (c.sportTag !== c.tags[sportSlot]) problems.push(`sportTag "${c.sportTag}" is not tags[${sportSlot}] ("${c.tags[sportSlot]}")`);
  const limits: Array<[string, number]> = [
    ['titles.high', ENTRY_LIMITS.titleMax],
    ['titles.mid', ENTRY_LIMITS.titleMax],
    ['titles.low', ENTRY_LIMITS.titleMax],
    ['events', ENTRY_LIMITS.itemMax],
    ['sundayEvents', ENTRY_LIMITS.itemMax],
    ['people', ENTRY_LIMITS.itemMax],
    ['tags', ENTRY_LIMITS.itemMax],
    ['locations', ENTRY_LIMITS.locationMax],
    ['exerciseTypes', ENTRY_LIMITS.exerciseTypeMax],
  ];
  for (const [name, max] of limits) {
    for (const value of pools[name]) if (value.length > max) problems.push(`${name}: "${value}" is longer than ${max} characters`);
  }
  if (c.habits && Object.keys(c.habits).sort().join() !== [...SEED_HABIT_KEYS].sort().join()) {
    problems.push(`habits must have exactly the keys ${SEED_HABIT_KEYS.join(', ')}`);
  }
  if (c.sentenceSeparator !== undefined && c.sentenceSeparator !== '' && c.sentenceSeparator !== ' ') {
    problems.push(`sentenceSeparator must be '' or ' ' (or left out), not ${JSON.stringify(c.sentenceSeparator)}`);
  }
  return problems;
}

/** The sentence functions: well-formed, built from their arguments, different for different arguments. */
function sentenceProblems(code: Locale, c: SeedContent): string[] {
  const problems: string[] = [];
  const all = sentencesOf(code, c);
  for (const [where, value] of all) {
    const bad = malformed(value);
    if (bad) problems.push(`${where} ${bad}: ${JSON.stringify(value)}`);
  }
  if (all.some(([, value]) => typeof value !== 'string')) return problems;

  // Called as the generator calls them: the formatted number to show, and the number itself.
  const sleep = (hours: number, low = hours < 6) => c.sleep(formatNumber(code, hours), low, hours);
  const exercise = (type: string, minutes: number, slot: (typeof SLOTS)[number]) => c.exercise(type, formatNumber(code, minutes), slot, minutes);
  const [a, b] = c.people;
  const type = c.exerciseTypes[0];

  const hoursMissing = SLEEP_HOURS.filter((hours) => !sleep(hours).includes(formatNumber(code, hours)));
  if (hoursMissing.length) problems.push(`sleep() does not show the hours for ${hoursMissing.join(', ')}`);
  if (sleep(5, true) === sleep(5, false)) problems.push('sleep() says the same for a short and a normal night');

  const minutesMissing = EXERCISE_MINUTES.filter((minutes) => !exercise(type, minutes, 'evening').includes(formatNumber(code, minutes)));
  if (minutesMissing.length) problems.push(`exercise() does not show the minutes for ${minutesMissing.join(', ')}`);
  for (const slot of SLOTS) {
    const perType = c.exerciseTypes.map((x) => exercise(x, 45, slot));
    if (new Set(perType).size !== perType.length) problems.push(`exercise(…, ${slot}) says the same for different exercise types`);
  }
  if (exercise(type, 45, 'midday') === exercise(type, 45, 'evening')) problems.push('exercise() says the same at midday and in the evening');

  if (c.secondEntry('midday') === c.secondEntry('evening')) problems.push('secondEntry() says the same at midday and in the evening');

  for (const met of [true, false]) {
    const perPerson = c.people.map((name) => c.peopleSentence([name], met));
    if (new Set(perPerson).size !== perPerson.length) problems.push(`peopleSentence(…, ${met}) says the same for different people`);
    const both = c.peopleSentence([a, b], met);
    if ([c.peopleSentence([a], met), c.peopleSentence([b], met), c.peopleSentence([b, a], met)].includes(both)) {
      problems.push(`peopleSentence([${a}, ${b}], ${met}) does not name both people in their order`);
    }
  }
  if (c.peopleSentence([a], true) === c.peopleSentence([a], false)) problems.push('peopleSentence() says the same for "met" and "talked with"');

  if (sleep(7.5) !== sleep(7.5) || exercise(type, 45, 'midday') !== exercise(type, 45, 'midday') || c.peopleSentence([a, b], true) !== c.peopleSentence([a, b], true)) {
    problems.push('the sentence functions must be pure (same arguments, same sentence)');
  }
  return problems;
}

/** Is the language written in Latin letters? (Its own name in the language picker tells.) */
function usesLatinLetters(code: Locale): boolean {
  return /\p{Script=Latin}/u.test(localeDef(code).nativeName);
}

/** The pools of one-word items, where a word may legitimately be spelled as in English. */
const WORD_POOLS = ['people', 'locations', 'tags', 'exerciseTypes'];
/** people[2] and people[3] are the words for mother and father: always translated. */
const FAMILY_SLOTS = [2, 3];
/** Words no other UI language written in Latin letters uses: a sure sign of an English sentence. */
const ENGLISH_WORDS = /\b(the|and|with|today|felt|slept)\b/i;

/**
 * English leftovers in the content of another language (heuristic):
 *  - a string equal to a string of the same English pool / text, unless listed in `sameAsEnglish`
 *    (cognates and names in the one-word pools only, never "Mom" / "Dad")
 *  - a sentence function that still returns the English sentence
 *  - other scripts: any word in Latin letters; Latin-script languages: common English words
 */
function leftoverProblems(code: Locale, c: SeedContent): string[] {
  const problems: string[] = [];
  const allowed = new Set(c.sameAsEnglish ?? []);
  const pools = poolsOf(c);
  const enPools = poolsOf(EN);
  for (const [name, pool] of Object.entries(pools)) {
    pool.forEach((value, i) => {
      if (enPools[name].includes(value) && !allowed.has(value)) problems.push(`${name}[${i}] "${value}" is the English text`);
    });
  }
  const enTexts = textsOf(EN);
  for (const [name, value] of Object.entries(textsOf(c))) {
    if (value === enTexts[name] && !allowed.has(value)) problems.push(`${name} "${value}" is the English text`);
  }

  for (const word of allowed) {
    const justified = WORD_POOLS.some((name) => pools[name].includes(word) && enPools[name].includes(word));
    if (!justified) problems.push(`sameAsEnglish: "${word}" is not a one-word item of this file that equals the English one`);
    if (FAMILY_SLOTS.some((slot) => EN.people[slot] === word)) problems.push(`sameAsEnglish: "${word}" (mother / father) must be translated`);
  }
  if (!usesLatinLetters(code) && allowed.size) problems.push('sameAsEnglish is only for languages written in Latin letters');

  const [a, b] = c.people;
  const type = c.exerciseTypes[0];
  const same: Array<[string, boolean]> = [
    ['sleep(low)', c.sleep('5', true, 5) === EN.sleep('5', true, 5)],
    ['sleep(normal)', c.sleep('7', false, 7) === EN.sleep('7', false, 7)],
    ['exercise(midday)', c.exercise(type, '30', 'midday', 30) === EN.exercise(type, '30', 'midday', 30)],
    ['exercise(evening)', c.exercise(type, '30', 'evening', 30) === EN.exercise(type, '30', 'evening', 30)],
    ['secondEntry(midday)', c.secondEntry('midday') === EN.secondEntry('midday')],
    ['secondEntry(evening)', c.secondEntry('evening') === EN.secondEntry('evening')],
    ['peopleSentence(met)', c.peopleSentence([a, b], true) === EN.peopleSentence([a, b], true)],
    ['peopleSentence(talked)', c.peopleSentence([a, b], false) === EN.peopleSentence([a, b], false)],
  ];
  for (const [where, isSame] of same) if (isSame) problems.push(`${where} returns the English sentence`);

  const everything = [...fixedStrings(c), ...sentencesOf(code, c)];
  for (const [where, value] of everything) {
    if (typeof value !== 'string') continue;
    if (usesLatinLetters(code)) {
      const word = allowed.has(value) ? null : ENGLISH_WORDS.exec(value);
      if (word) problems.push(`${where} has the English word "${word[0]}": ${JSON.stringify(value)}`);
    } else {
      const word = /\p{Script=Latin}{2,}/u.exec(value);
      if (word) problems.push(`${where} has a word in Latin letters ("${word[0]}"): ${JSON.stringify(value)}`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// The demo a language produces
// ---------------------------------------------------------------------------

const TODAY = '2026-09-08';
/** The seeded data repeats with the weekday of "today", so seven consecutive days cover every case. */
const WEEK = Array.from({ length: 7 }, (_, i) => addDays('2026-09-27', i));

interface Demo {
  db: DiaryDb;
  content: ResolvedSeedContent;
  entries: Entry[];
  habits: Habit[];
}

const demos = new Map<string, Promise<Demo>>();

/** The default demo (120 days, seed 42) of a language ending at `today`; built once per suite run. */
function demo(code: Locale, today: string): Promise<Demo> {
  const key = `${code} ${today}`;
  let made = demos.get(key);
  if (!made) {
    made = (async () => {
      const db = await DiaryDb.create();
      seedDemoData(db, 120, 42, today, code, null);
      return { db, content: seedContent(code), entries: listEntriesFull(db, null, null), habits: listHabits(db, true) };
    })();
    demos.set(key, made);
  }
  return made;
}

/** Index of `value` in `pool` (null for "not set"): which slot of the content a stored text came from. */
function slotOf(pool: readonly string[], value: string): number | null {
  return value === '' ? null : pool.indexOf(value);
}

/**
 * The demo without its words: every number, date and emotion as stored, and every text replaced by
 * the slot of the content set it came from. Two languages with the same skeleton tell the same
 * story - same days, same ratings, same habit logs, the same title / event / person slot everywhere.
 */
function skeleton({ db, content, entries, habits }: Demo) {
  const titles = [...LEVELS.flatMap((level) => content.titles[level]), content.badDay.title, content.goodDay.title];
  const openers = [...LEVELS.flatMap((level) => content.openers[level]), content.badDay.body, content.goodDay.body];
  const events = [...content.events, ...content.sundayEvents];
  return {
    entries: entries.map((e) => ({
      date: e.date,
      time: e.time,
      mood: e.mood,
      energy: e.energy,
      stress: e.stress,
      sleepQuality: e.sleepQuality,
      sleepHours: e.sleepHours,
      exerciseMinutes: e.exerciseMinutes,
      emotions: e.emotions,
      title: slotOf(titles, e.title),
      opener: openers.findIndex((opener) => e.body.startsWith(opener)),
      exerciseType: slotOf(content.exerciseTypes, e.exerciseType),
      events: e.events.map((x) => slotOf(events, x)),
      people: e.people.map((x) => slotOf(content.people, x)),
      location: slotOf(content.locations, e.location),
      tags: e.tags.map((x) => slotOf(content.tags, x)),
      notes: slotOf([content.note], e.notes),
    })),
    habits: habits.map((h) => ({ target: h.target, frequency: h.frequency, isArchived: h.isArchived })),
    logs: listAllLogs(db, null, null).map((l) => ({
      habit: habits.findIndex((h) => h.id === l.habitId),
      date: l.date,
      value: l.value,
      completed: l.completed,
    })),
  };
}

/**
 * How the language of `code` calls English, cut to a stem that survives inflection ("angielski" ->
 * "po angielsku", "английский" -> "на английском"): the sign that a text talks about English.
 */
function englishStem(code: Locale): string {
  const name = new Intl.DisplayNames([localeDef(code).intl], { type: 'language' }).of('en') ?? 'English';
  const chars = [...name.toLowerCase()];
  if (chars.length <= 2) return chars[0];
  return chars.slice(0, chars.length > 6 ? chars.length - 2 : chars.length).join('');
}

/** Does the "Load sample data?" confirmation of the language say that the sample entries are in English? */
function saysSamplesAreEnglish(code: Locale): boolean {
  return t(code, 'settings.data.seedDemoMessage', { days: 120 }).toLowerCase().includes(englishStem(code));
}

// ---------------------------------------------------------------------------
// The folder and the registry
// ---------------------------------------------------------------------------

describe('demo texts: the seed-content folder', () => {
  it('holds only language files named after a UI language, and always en.ts', () => {
    expect(FILE_NAMES.filter((name) => !isLocale(name))).toEqual([]);
    expect(FILE_NAMES).toContain('en');
  });

  it('registers every language file in seed-content/index.ts, and nothing else', () => {
    // A file that is not registered is never used: remove the "// " in front of its two lines in index.ts.
    const hint = 'registered languages (received) differ from the language files of the folder (expected): fix seed-content/index.ts';
    expect([...SEED_CONTENT_LOCALES].sort(), hint).toEqual([...FILE_LOCALES].sort());
    for (const code of SEED_CONTENT_LOCALES) expect(SEED_CONTENT[code], code).toBeTypeOf('object');
  });

  it('uses the texts of the language itself when it has a file, English otherwise', () => {
    for (const code of LOCALE_CODES) {
      const own = FILE_LOCALES.includes(code);
      expect({ code, language: seedLanguageOf(code) }).toEqual({ code, language: own ? code : 'en' });
      expect(seedContent(code).titles, code).toBe((own ? SEED_CONTENT[code]! : EN).titles);
    }
  });

  it('names the demo habits like the habit templates of the language, with the same targets everywhere', () => {
    const slugs = { walk: 'walking', water: 'water', reading: 'reading', exercise: 'exercise', meditation: 'meditation' } as const;
    const units = { walk: 'minutes', water: 'cups', reading: 'minutes', exercise: 'times', meditation: 'minutes' } as const;
    const structure = (code: Locale) => seedContent(code).habits.map(({ key, target, frequency }) => ({ key, target, frequency }));
    for (const code of LOCALE_CODES) {
      const habits = seedContent(code).habits;
      expect(habits.map((h) => h.key), code).toEqual([...SEED_HABIT_KEYS]);
      expect(structure(code), code).toEqual(structure('en'));
      for (const h of habits) {
        expect({ code, key: h.key, name: h.name, unit: h.unit }).toEqual({
          code,
          key: h.key,
          name: habitTemplateName(slugs[h.key], code),
          unit: habitTemplateUnit(units[h.key], code),
        });
        expect(malformed(h.description), `${code} ${h.key}`).toBeNull();
        const input = { name: h.name, description: h.description, target: h.target, unit: h.unit, frequency: h.frequency };
        expect(validateHabitInput(input), `${code} ${h.key}`).toMatchObject(input);
      }
      expect(seedHabitNames(code), code).toEqual(habits.map((h) => h.name));
    }
  });

  it('says "the sample entries are in English" in the confirmation of exactly the languages without their own texts', () => {
    // shared/i18n/messages/<locale>/settings.ts, key 'settings.data.seedDemoMessage': the last sentence
    // goes away when the language gets its file (and must be there as long as it has none).
    const wrong = LOCALE_CODES.filter((code) => saysSamplesAreEnglish(code) !== (seedLanguageOf(code) !== code));
    const hint =
      "these languages have their own demo texts but 'settings.data.seedDemoMessage' still says the sample entries are in English " +
      '(or the other way round): edit shared/i18n/messages/<locale>/settings.ts';
    expect(wrong, hint).toEqual([]);
  });

  const missing = LOCALE_CODES.filter((code) => !FILE_LOCALES.includes(code));
  for (const code of missing) it.todo(`${code}: no demo texts yet (English is used) - write seed-content/${code}.ts, see README.md there`);
});

// ---------------------------------------------------------------------------
// Every language file
// ---------------------------------------------------------------------------

describe.each(FILE_LOCALES)('demo texts: %s', (code) => {
  const content = SEED_CONTENT[code] as SeedContent;

  it('has the fields and the pool sizes of en.ts', () => {
    expect(content, `seed-content/${code}.ts is not registered in seed-content/index.ts`).toBeTypeOf('object');
    expect(fieldTypes(content)).toEqual(fieldTypes(EN));
    expect(poolSizes(content)).toEqual(poolSizes(EN));
  });

  it('has well-formed texts: no duplicates in a pool, one-word tags, within the entry limits', () => {
    expect(textProblems(content)).toEqual([]);
  });

  it('builds its sentences from the arguments', () => {
    expect(sentenceProblems(code, content)).toEqual([]);
  });

  it.skipIf(code === 'en')('has no English leftovers', () => {
    expect(leftoverProblems(code, content)).toEqual([]);
  });

  it('gives a demo with exactly the structure of the English one (the planted patterns do not depend on the language)', async () => {
    for (const today of WEEK) {
      const own = skeleton(await demo(code, today));
      // Every stored text comes from the content set: no slot is -1.
      const slots = own.entries.flatMap((e) => [e.title, e.opener, e.exerciseType, e.location, e.notes, ...e.events, ...e.people, ...e.tags]);
      expect(slots.includes(-1), `${today}: a text of the demo is not from the content set`).toBe(false);
      expect(own, today).toEqual(skeleton(await demo('en', today)));
    }
  });

  it('stores entries that pass the entry validation unchanged', async () => {
    const { entries } = await demo(code, TODAY);
    expect(entries.length).toBeGreaterThan(90);
    for (const entry of entries) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...input } = entry;
      expect(validateEntryInput(input)).toEqual(input);
      expect(malformed(entry.body), entry.body).toBeNull();
    }
  });

  it('lets the analysis engine find every planted pattern', async () => {
    const today = WEEK[0];
    const { db, habits } = await demo(code, today);
    const reading = habits.find((h) => h.name === seedHabitNames(code)[SEED_HABIT_KEYS.indexOf('reading')])!;
    const byId = new Map(generateInsights(db, '3m', today, {}, code).insights.map((i) => [i.id, i]));
    expect(byId.get('sleep_mood_lt6')?.evidence.effectSize).toBeLessThan(0);
    expect(byId.get('exercise_energy_days')?.evidence.effectSize).toBeGreaterThan(0);
    expect(byId.get('weekday_stress_0')?.evidence.effectSize).toBeGreaterThan(0);
    expect(byId.get(`habit_mood_${reading.id}`)?.evidence.effectSize).toBeGreaterThan(0);
  });

  it('answers the six example questions of its search page from the demo', async () => {
    // 'search.example.2' looks for a word in the texts ("tired"), 'search.example.6' for a tag ("work"):
    // the demo of the language must contain the words its own examples ask for.
    const nothing: string[] = [];
    for (const today of WEEK) {
      const { db } = await demo(code, today);
      for (let i = 1; i <= 6; i++) {
        const query = t(code, `search.example.${i}`);
        const result = smartSearch(db, { query }, today, code);
        if (result.totalMatches === 0) {
          nothing.push(`today ${today} (weekday ${weekday(today)}), example ${i} "${query}" finds nothing (words: ${JSON.stringify(result.parsed.textTerms)})`);
        }
      }
    }
    expect(nothing).toEqual([]);

    const tagWords = parseQuery(t(code, 'search.example.6'), TODAY, code).textTerms;
    expect(tagWords.length).toBeGreaterThan(0);
    const tags = content.tags.map((tag) => tag.toLowerCase());
    expect(tags, `'search.example.6' asks for the tag ${JSON.stringify(tagWords)}`).toEqual(expect.arrayContaining(tagWords.map((w) => w.toLowerCase())));
  });
});

// ---------------------------------------------------------------------------
// The checks themselves catch a broken file (synthetic content; no file is touched)
// ---------------------------------------------------------------------------

describe('demo texts: the checks catch a broken language file', () => {
  const HE = SEED_CONTENT.he as SeedContent;
  /** The Hebrew texts with some fields replaced: stands in for "a translated file" of any language. */
  const translated = (changes: Partial<SeedContent> = {}): SeedContent => ({ ...HE, habits: undefined, ...changes });
  const withTag = (tag: string): Partial<SeedContent> => ({ tags: HE.tags.map((x, i) => (i === 4 ? tag : x)), sportTag: tag });

  it('accepts a complete translation', () => {
    expect(textProblems(translated())).toEqual([]);
    expect(sentenceProblems('ru', translated())).toEqual([]);
    expect(leftoverProblems('ru', translated())).toEqual([]);
  });

  it('reports a pool of another size', () => {
    expect(poolSizes(translated({ events: HE.events.slice(1) }))).not.toEqual(poolSizes(EN));
    expect(poolSizes(translated({ people: [...HE.people, 'x'] }))).not.toEqual(poolSizes(EN));
  });

  it('reports malformed texts, duplicates, tags that are not one word and a wrong sportTag', () => {
    expect(textProblems(translated({ note: ' x' }))).toHaveLength(1);
    expect(textProblems(translated({ sundayNote: 'a  b' }))).toHaveLength(1);
    expect(textProblems(translated({ locations: [...HE.locations.slice(0, 6), HE.locations[0]] }))).toHaveLength(1);
    expect(textProblems(translated({ tags: HE.tags.map((x, i) => (i === 0 ? 'two words' : x)) }))).toHaveLength(1);
    expect(textProblems(translated({ sportTag: HE.tags[0] }))).toHaveLength(1);
    expect(textProblems(translated({ badDay: { title: HE.titles.low[0], body: HE.badDay.body } }))).toHaveLength(1);
  });

  it('reports sentences that ignore their arguments', () => {
    expect(sentenceProblems('ru', translated({ sleep: () => 'x' })).length).toBeGreaterThan(0);
    expect(sentenceProblems('ru', translated({ exercise: (_type, minutes) => `x ${minutes}` })).length).toBeGreaterThan(0);
    expect(sentenceProblems('ru', translated({ secondEntry: () => 'x' }))).toHaveLength(1);
    expect(sentenceProblems('ru', translated({ peopleSentence: (names) => names[0] })).length).toBeGreaterThan(0);
  });

  it('reports English leftovers', () => {
    // The whole English file under another name.
    expect(leftoverProblems('de', EN).length).toBeGreaterThan(80);
    // One untranslated item, one untranslated text, one untranslated sentence function.
    expect(leftoverProblems('ru', translated({ events: HE.events.map((x, i) => (i === 3 ? EN.events[3] : x)) })).length).toBeGreaterThan(0);
    expect(leftoverProblems('de', translated({ note: EN.note }))).toHaveLength(1);
    expect(leftoverProblems('de', translated({ secondEntry: EN.secondEntry })).length).toBeGreaterThanOrEqual(2);
    // A reworded English sentence in a Latin-script language; any Latin word in another script.
    expect(leftoverProblems('de', translated({ note: 'Remember the good things' }))).toHaveLength(1);
    expect(leftoverProblems('ru', translated({ note: 'йога yoga' }))).toHaveLength(1);
  });

  it('accepts a cognate only when it is listed in sameAsEnglish, and only a real one', () => {
    expect(leftoverProblems('de', translated(withTag('sport')))).toHaveLength(2); // tags[4] and sportTag
    expect(leftoverProblems('de', translated({ ...withTag('sport'), sameAsEnglish: ['sport'] }))).toEqual([]);
    expect(leftoverProblems('de', translated({ ...withTag('sport'), sameAsEnglish: ['sport', 'yoga'] }))).toHaveLength(1);
    expect(leftoverProblems('de', translated({ note: EN.note, sameAsEnglish: [EN.note] })).length).toBeGreaterThan(0);
    const mom = { people: HE.people.map((x, i) => (i === 2 ? 'Mom' : x)), sameAsEnglish: ['Mom'] };
    expect(leftoverProblems('de', translated(mom))).toHaveLength(1);
  });

  it('joins the sentences of a body with the separator of the language (a space, or nothing as in Chinese and Japanese)', async () => {
    // Independent of the real files: a stand-in is registered as 'zh' for the length of each run.
    const bodies = async (sentenceSeparator?: '' | ' ') => {
      const real = SEED_CONTENT.zh;
      const db = await DiaryDb.create();
      SEED_CONTENT.zh = translated({ sentenceSeparator });
      try {
        seedDemoData(db, 30, 42, TODAY, 'zh', null);
        return listEntriesFull(db, null, null).map((e) => e.body);
      } finally {
        SEED_CONTENT.zh = real;
      }
    };
    const spaced = await bodies();
    const tight = await bodies('');
    expect(await bodies(' ')).toEqual(spaced);
    expect(tight).toHaveLength(spaced.length);
    // The same words, and one space less wherever two sentences meet.
    expect(tight.map((b) => b.replace(/ /g, ''))).toEqual(spaced.map((b) => b.replace(/ /g, '')));
    expect(tight.every((b, i) => b.length <= spaced[i].length)).toBe(true);
    expect(tight.filter((b, i) => b.length < spaced[i].length).length).toBeGreaterThan(spaced.length - 3);
    expect(seedLanguageOf('zh')).toBe(FILE_LOCALES.includes('zh') ? 'zh' : 'en');
  });

  it('recognises the sentence about English sample entries in every language that has it today', () => {
    expect(LOCALE_CODES.map(englishStem).filter((stem) => !stem)).toEqual([]);
    expect(saysSamplesAreEnglish('en')).toBe(false);
  });
});
