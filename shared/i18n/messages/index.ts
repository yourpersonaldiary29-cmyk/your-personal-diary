/**
 * Message catalogue registry.
 *
 * Every locale has one file per AREA under shared/i18n/messages/<locale>/<area>.ts that
 * default-exports a flat `Record<string, string>` whose keys are prefixed with the area
 * name ('shell.save', 'insights.strength.strong', ...). `getCatalog(locale)` merges the
 * areas of a locale (memoised). Catalogues are imported statically so the bundle works
 * offline; each locale is ~40-60 KB of text.
 *
 * Adding a locale: create the folder with all areas and register it in LOCALE_CATALOGS below.
 * The parity test (shared/i18n/messages.test.ts) fails when any locale misses or adds keys
 * relative to English.
 */
import type { Locale } from '../locales';
import * as en from './en';
import * as he from './he';
import * as ar from './ar';
import * as zh from './zh';
import * as ja from './ja';
import * as hi from './hi';
import * as th from './th';
import * as es from './es';
import * as pt from './pt';
import * as fr from './fr';
import * as it from './it';
import * as de from './de';
import * as ro from './ro';
import * as el from './el';
import * as pl from './pl';
import * as cs from './cs';
import * as hu from './hu';
import * as ru from './ru';
import * as bg from './bg';
import * as tr from './tr';

export type Catalog = Record<string, string>;

/** Catalogue areas; each locale folder exports one object per area from its index.ts. */
export const AREA_NAMES = [
  'shell', // navigation, header, generic buttons, welcome, lock screen, shortcuts
  'auth', // register / login / accounts / password
  'entries', // entry form, diary timeline, day page, entry page
  'calendar', // calendar page, calendar systems, legend
  'holidays', // holiday names and tradition labels
  'habits', // habits page, templates, reminders
  'insights', // insights page, strength labels, groups
  'stats', // statistics page, chart labels
  'search', // search page, examples
  'settings', // settings, privacy, backup, export
  'emotions', // emotion labels
  'server', // server: errors, validation, reminders, backup descriptions, export labels
  'analysis', // server: insight templates, notes, phrasing
  'searchAnswers', // server: search answers/explanations
  'mobile', // Android app: shell (bottom navigation, "More"), tour mode
] as const;

export type AreaName = (typeof AREA_NAMES)[number];

type LocaleModule = Partial<Record<AreaName, Catalog>>;

const LOCALE_CATALOGS: Record<Locale, LocaleModule> = {
  en: en as LocaleModule,
  he: he as LocaleModule,
  ar: ar as LocaleModule,
  zh: zh as LocaleModule,
  ja: ja as LocaleModule,
  hi: hi as LocaleModule,
  th: th as LocaleModule,
  es: es as LocaleModule,
  pt: pt as LocaleModule,
  fr: fr as LocaleModule,
  it: it as LocaleModule,
  de: de as LocaleModule,
  ro: ro as LocaleModule,
  el: el as LocaleModule,
  pl: pl as LocaleModule,
  cs: cs as LocaleModule,
  hu: hu as LocaleModule,
  ru: ru as LocaleModule,
  bg: bg as LocaleModule,
  tr: tr as LocaleModule,
};

const merged = new Map<Locale, Catalog>();

export function getCatalog(locale: Locale): Catalog {
  let cat = merged.get(locale);
  if (!cat) {
    cat = {};
    const mod = LOCALE_CATALOGS[locale] ?? {};
    for (const area of AREA_NAMES) {
      const part = mod[area];
      if (part) Object.assign(cat, part);
    }
    merged.set(locale, cat);
  }
  return cat;
}

/** Catalogue of one area only (tests, tooling). */
export function getArea(locale: Locale, area: AreaName): Catalog {
  return (LOCALE_CATALOGS[locale] ?? {})[area] ?? {};
}
