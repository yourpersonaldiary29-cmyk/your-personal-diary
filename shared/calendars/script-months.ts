/**
 * Month names that ICU writes in the Latin script inside a UI language that is not
 * written in Latin letters: the Hebrew months in Hindi (`Intl.DateTimeFormat('hi-IN-u-ca-hebrew')`
 * answers "Tishri", "Heshvan") and the Hijri months in Greek ('el-GR-u-ca-islamic-umalqura'
 * answers "Rabiʻ II"). These tables give the names in the language's own script.
 *
 * Unlike Chinese / Japanese (cjk-months.ts, where ICU has no names at all and the dates are
 * assembled by hand), ICU's word order and digits are kept here: only the month part of the
 * formatted date is replaced (`formatIntlDate` / `formatIntlRange` in locale.ts take the name).
 */
import type { Locale } from '../i18n/locales';
import type { HebrewMonth } from './types';

const HEBREW: Partial<Record<Locale, Record<HebrewMonth, string>>> = {
  hi: {
    tishrei: 'तिशरी',
    cheshvan: 'हेशवान',
    kislev: 'किसलेव',
    tevet: 'तेवेत',
    shevat: 'शेवात',
    adar: 'अदार',
    adar1: 'अदार प्रथम',
    adar2: 'अदार द्वितीय',
    nisan: 'निसान',
    iyar: 'इयार',
    sivan: 'सिवान',
    tammuz: 'तमुज़',
    av: 'आव',
    elul: 'एलुल',
  },
};

/**
 * Muharram .. Dhu al-Hijjah.
 * Bulgarian keeps ICU's names; the table only evens out the capitals: ICU writes nine of the twelve
 * in lower case (as Bulgarian month names are) and three with a capital ("Шавал", "Дхул-Каада",
 * "Дхул-хиджа"), which shows in the month <select> of the Hijri calendar.
 */
const HIJRI: Partial<Record<Locale, readonly string[]>> = {
  el: ['Μουχαρράμ', 'Σαφάρ', 'Ραμπί Α΄', 'Ραμπί Β΄', 'Τζουμάντα Α΄', 'Τζουμάντα Β΄', 'Ρατζάμπ', 'Σααμπάν', 'Ραμαζάνι', 'Σαουάλ', 'Ντου αλ-Κάαντα', 'Ντου αλ-Χίτζα'],
  bg: ['мухарам', 'сафар', 'раби-1', 'раби-2', 'джумада-1', 'джумада-2', 'раджаб', 'шабан', 'рамазан', 'шавал', 'дхул-каада', 'дхул-хиджа'],
};

/** Hebrew month name in the language's own script where ICU has only a Latin one (hi), else null. */
export function scriptHebrewMonthName(locale: Locale, month: HebrewMonth): string | null {
  return HEBREW[locale]?.[month] ?? null;
}

/** Hijri month name (1-12) where ICU's own is replaced: Greek script (el), even lower case (bg); else null. */
export function scriptHijriMonthName(locale: Locale, month: number): string | null {
  return HIJRI[locale]?.[month - 1] ?? null;
}
