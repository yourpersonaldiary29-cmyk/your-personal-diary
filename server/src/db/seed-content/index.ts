/**
 * Registry of the demo texts: one file per language (`<locale>.ts`, see README.md). A language that
 * is not registered here gets the English texts.
 *
 * The imports are static on purpose: the server is bundled into one file (scripts/build-server.mjs)
 * and the phone build bundles it too, so nothing can be discovered in the folder at run time.
 *
 * TO REGISTER A NEW LANGUAGE FILE: remove the "// " in front of its import line and in front of its
 * line in SEED_CONTENT - nothing else. server/test/data-seed-content.test.ts fails while a file in
 * this folder is not registered (or a registered file is missing) and then checks the file.
 */
import type { Locale } from '@shared/i18n';
import type { SeedContent } from './types';
import en from './en';
import he from './he';
import ar from './ar';
import zh from './zh';
import ja from './ja';
import hi from './hi';
import th from './th';
import es from './es';
import pt from './pt';
import fr from './fr';
import it from './it';
import de from './de';
import ro from './ro';
import el from './el';
import pl from './pl';
import cs from './cs';
import hu from './hu';
import ru from './ru';
import bg from './bg';
import tr from './tr';

export type { SeedContent, SeedHabitKey, SeedHabitText, SeedSlot } from './types';
export { SEED_HABIT_KEYS } from './types';

/** Every UI language has its own texts (all 20 files are in): the compiler itself refuses a missing language. */
export type SeedContentRegistry = Record<Locale, SeedContent>;

export const SEED_CONTENT: SeedContentRegistry = {
  en,
  he,
  ar,
  zh,
  ja,
  hi,
  th,
  es,
  pt,
  fr,
  it,
  de,
  ro,
  el,
  pl,
  cs,
  hu,
  ru,
  bg,
  tr,
};

/** The languages that have their own demo texts, in registry order. */
export const SEED_CONTENT_LOCALES = Object.keys(SEED_CONTENT) as Locale[];
