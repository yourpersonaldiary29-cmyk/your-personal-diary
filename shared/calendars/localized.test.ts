/**
 * Locale-aware output of the calendar module in Hebrew (gematria, the legacy
 * default), English and French (ICU month names with digits). Catalogue-backed
 * sentences are asserted through `t()` for French so the test stays valid once
 * the French catalogue is translated.
 */
import { describe, expect, it } from 'vitest';
import { lookup, t } from '../i18n';
import {
  DEFAULT_CALENDAR_EXTRAS,
  KIND_LABELS,
  TRADITION_LABELS,
  TRADITION_SHORT,
  adjacentMonthView,
  civilSpan,
  describeDay,
  describeHoliday,
  describeHolidayAmong,
  formatCivilDate,
  formatCivilDayMonth,
  formatHebrewDate,
  formatHebrewDay,
  formatHijriDate,
  formatHijriDay,
  formatSystemDate,
  hebrewMonthName,
  hebrewMonthSpan,
  hebrewYearLabel,
  hijriMonthName,
  hijriMonthSpan,
  holidayName,
  holidayNameKey,
  holidayNote,
  holidaysInRange,
  holidaysOn,
  kindLabel,
  monthViewContaining,
  monthViewFor,
  monthsOfYear,
  otherDatesLabel,
  otherMonthSpans,
  toHebrewDate,
  toHijriDate,
  traditionLabel,
  traditionShort,
  viewKey,
  type Holiday,
  type HolidayKind,
  type HolidayTradition,
} from './index';
import { joinWithoutEra } from './locale';

const ALL = DEFAULT_CALENDAR_EXTRAS;

/** ICU range output separates the dash / "à" with thin (U+2009) and no-break (U+00A0) spaces; compare with plain spaces. */
const plain = (s: string) => s.replace(/[   ]/g, ' ');

describe('Hebrew dates per language', () => {
  const hd = toHebrewDate('2026-09-25'); // 14 Tishrei 5787

  it('keeps gematria in Hebrew and is the default', () => {
    expect(formatHebrewDate(hd)).toBe('י״ד בתשרי תשפ״ז');
    expect(formatHebrewDate(hd, { locale: 'he' })).toBe('י״ד בתשרי תשפ״ז');
    expect(formatHebrewDate(hd, { locale: 'he', withYear: false })).toBe('י״ד בתשרי');
    expect(formatHebrewDay(hd)).toBe('י״ד');
    expect(hebrewYearLabel(5787)).toBe('תשפ״ז');
    expect(hebrewMonthName('adar2')).toBe('אדר ב׳');
  });

  it('uses ICU month names with digits in English', () => {
    expect(formatHebrewDate(hd, { locale: 'en' })).toBe('14 Tishri 5787');
    expect(formatHebrewDate(hd, { locale: 'en', withYear: false })).toBe('14 Tishri');
    expect(formatHebrewDay(hd, 'en')).toBe('14');
    expect(hebrewYearLabel(5787, 'en')).toBe('5787');
    expect(hebrewMonthName('adar2', 'en')).toBe('Adar II');
    expect(hebrewMonthName('cheshvan', 'en')).toBe('Heshvan');
  });

  it('uses ICU month names with digits in French', () => {
    expect(formatHebrewDate(hd, { locale: 'fr' })).toBe('14 tichri 5787');
    expect(formatHebrewDate(hd, { locale: 'fr', withYear: false })).toBe('14 tichri');
    expect(formatHebrewDay(hd, 'fr')).toBe('14');
    expect(hebrewMonthName('adar2', 'fr')).toBe('adar II');
    expect(hebrewMonthName('cheshvan', 'fr')).toBe('hèchvan');
  });

  it('formats month spans per language', () => {
    expect(hebrewMonthSpan('2026-09-12', '2026-10-11')).toBe('תשרי תשפ״ז');
    expect(hebrewMonthSpan('2026-09-01', '2026-09-30')).toBe('אלול תשפ״ו – תשרי תשפ״ז');
    expect(hebrewMonthSpan('2026-09-12', '2026-10-11', 'en')).toBe('Tishri 5787');
    expect(plain(hebrewMonthSpan('2026-09-01', '2026-09-30', 'en'))).toBe('Elul 5786 – Tishri 5787');
    expect(plain(hebrewMonthSpan('2026-09-12', '2026-11-09', 'en'))).toBe('Tishri – Heshvan 5787');
    expect(hebrewMonthSpan('2026-09-12', '2026-10-11', 'fr')).toBe('tichri 5787');
    expect(plain(hebrewMonthSpan('2026-09-01', '2026-09-30', 'fr'))).toBe('éloul 5786 à tichri 5787');
  });
});

describe('Hijri dates per language', () => {
  const hd = toHijriDate('2026-10-25'); // 14 Jumada I 1448

  it('keeps the Hebrew transliterations by default', () => {
    expect(formatHijriDate(hd)).toBe('14 בג׳ומאדא אל-אולא 1448');
    expect(formatHijriDate(hd, { withYear: false })).toBe('14 בג׳ומאדא אל-אולא');
    expect(formatHijriDay(hd)).toBe('14');
    expect(hijriMonthName(9)).toBe('רמדאן');
  });

  it('uses ICU month names in English and French', () => {
    expect(formatHijriDate(hd, { locale: 'en' })).toBe('14 Jumada I 1448');
    expect(formatHijriDate(hd, { locale: 'en', withYear: false })).toBe('14 Jumada I');
    expect(formatHijriDay(hd, 'en')).toBe('14');
    expect(hijriMonthName(9, 'en')).toBe('Ramadan');
    expect(formatHijriDate(hd, { locale: 'fr' })).toBe('14 joumada al oula 1448');
    expect(hijriMonthName(9, 'fr')).toBe('ramadan');
  });

  it('formats month spans per language', () => {
    expect(hijriMonthSpan('2026-09-01', '2026-09-30')).toBe('רביע אל-אוול–רביע א-ת׳אני 1448');
    expect(plain(hijriMonthSpan('2026-09-01', '2026-09-30', 'en'))).toBe('Rabiʻ I – Rabiʻ II 1448');
    expect(hijriMonthSpan('2026-09-12', '2026-10-10', 'en')).toBe('Rabiʻ II 1448');
    expect(plain(hijriMonthSpan('2026-09-01', '2026-09-30', 'fr'))).toBe('rabia al awal à rabia ath-thani 1448');
  });
});

describe('month names ICU has only in Latin letters', () => {
  const LATIN = /[A-Za-z]/;

  it('writes the Hebrew months in Devanagari in Hindi, keeping ICU word order and digits', () => {
    const hd = toHebrewDate('2026-09-25'); // 14 Tishrei 5787
    expect(hebrewMonthName('tishrei', 'hi')).toBe('तिशरी');
    expect(hebrewMonthName('adar2', 'hi')).toBe('अदार द्वितीय');
    expect(formatHebrewDate(hd, { locale: 'hi' })).toBe('14 तिशरी 5787');
    expect(formatHebrewDate(hd, { locale: 'hi', withYear: false })).toMatch(/^(14 तिशरी|तिशरी 14)$/);
    // ICU's word order for Hindi (year first in some ICU versions) is kept.
    expect(hebrewMonthSpan('2026-09-12', '2026-10-11', 'hi')).toMatch(/^(तिशरी 5787|5787 तिशरी)$/);
    const span = hebrewMonthSpan('2026-09-01', '2026-09-30', 'hi');
    expect(span).toContain('एलुल');
    expect(span).toContain('तिशरी');
    expect(span).not.toMatch(LATIN);
    const view = monthViewContaining('hebrew', '2026-09-25', 'hi');
    expect(view.title).toMatch(/^(तिशरी 5787|5787 तिशरी)$/);
    for (const m of monthsOfYear('hebrew', 5787, 'hi')) expect(m.label).not.toMatch(LATIN);
  });

  it('writes the Hijri months in Greek letters in Greek', () => {
    const hd = toHijriDate('2026-10-25'); // 14 Jumada I 1448
    expect(hijriMonthName(9, 'el')).toBe('Ραμαζάνι');
    expect(formatHijriDate(hd, { locale: 'el' })).toBe('14 Τζουμάντα Α΄ 1448');
    expect(hijriMonthSpan('2026-09-12', '2026-10-10', 'el')).toBe('Ραμπί Β΄ 1448');
    const span = plain(hijriMonthSpan('2026-09-01', '2026-09-30', 'el'));
    expect(span).toContain('Ραμπί Α΄');
    expect(span).toContain('Ραμπί Β΄');
    expect(span).not.toMatch(LATIN);
    expect(monthViewContaining('hijri', '2026-10-25', 'el').title).toBe('Τζουμάντα Α΄ 1448');
  });

  it('writes every Hijri month in lower case in Bulgarian (ICU capitalises three of the twelve)', () => {
    const names = monthsOfYear('hijri', 1448, 'bg').map((m) => m.label);
    expect(names).toEqual(['мухарам', 'сафар', 'раби-1', 'раби-2', 'джумада-1', 'джумада-2', 'раджаб', 'шабан', 'рамазан', 'шавал', 'дхул-каада', 'дхул-хиджа']);
    for (const name of names) expect(name).toBe(name.toLowerCase());
    expect(hijriMonthName(10, 'bg')).toBe('шавал');
    // The same name inside a full date and in the month title of the calendar page.
    const shawwal = monthViewFor('hijri', 1448, 10, 'bg');
    expect(shawwal.title).toContain('шавал');
    expect(shawwal.title).not.toContain('Шавал');
    expect(formatHijriDate(toHijriDate(shawwal.firstDay), { locale: 'bg' })).toContain('шавал');
  });

  it('leaves the other languages to ICU', () => {
    expect(hebrewMonthName('tishrei', 'el')).toBe('Τισρί');
    expect(hijriMonthName(4, 'hi')).toBe('राबी द्वितीय');
  });
});

describe('civil dates per language', () => {
  it('formats a day, a compact day/month and spans', () => {
    expect(formatCivilDate('2026-09-12')).toBe('12 בספטמבר 2026');
    expect(formatCivilDate('2026-09-12', { locale: 'en' })).toBe('12 September 2026');
    expect(formatCivilDate('2026-09-12', { locale: 'en', withYear: false })).toBe('12 September');
    expect(formatCivilDate('2026-09-12', { locale: 'fr' })).toBe('12 septembre 2026');
    expect(formatCivilDayMonth('2026-09-12')).toBe('12.9');
    expect(formatCivilDayMonth('2026-09-12', 'en')).toBe('12/09');
    expect(formatCivilDayMonth('2026-09-12', 'fr')).toBe('12/09');
    expect(plain(civilSpan('2026-09-01', '2026-09-30', 'en'))).toBe('1 – 30 September 2026');
    expect(plain(civilSpan('2026-09-12', '2026-10-11', 'en'))).toBe('12 September – 11 October 2026');
    expect(plain(civilSpan('2026-12-20', '2027-01-18', 'en'))).toBe('20 December 2026 – 18 January 2027');
    expect(plain(civilSpan('2026-09-01', '2026-09-30', 'fr'))).toBe('1–30 septembre 2026');
    expect(plain(civilSpan('2026-12-20', '2027-01-18', 'fr'))).toBe('20 décembre 2026 – 18 janvier 2027');
    expect(civilSpan('2026-09-01', '2026-09-30')).toBe('1–30 בספטמבר 2026');
  });

  it('formats the full date of a day in each system and language', () => {
    expect(formatSystemDate('gregorian', '2026-09-12', { locale: 'en' })).toBe('12 September 2026');
    expect(formatSystemDate('hebrew', '2026-09-12', { locale: 'en' })).toBe('1 Tishri 5787');
    expect(formatSystemDate('hijri', '2026-09-12', { locale: 'en' })).toBe('1 Rabiʻ II 1448');
    expect(formatSystemDate('hebrew', '2026-09-12', { locale: 'fr' })).toBe('1 tichri 5787');
    expect(formatSystemDate('hebrew', '2026-09-12')).toBe('א׳ בתשרי תשפ״ז');
  });
});

describe('month views per language', () => {
  it('titles and day labels follow the language; the cache is per language', () => {
    const he = monthViewContaining('hebrew', '2026-09-15');
    const en = monthViewContaining('hebrew', '2026-09-15', 'en');
    const fr = monthViewContaining('hebrew', '2026-09-15', 'fr');
    expect(he.title).toBe('תשרי תשפ״ז');
    expect(en.title).toBe('Tishri 5787');
    expect(fr.title).toBe('tichri 5787');
    expect(he.days[13].dayLabel).toBe('י״ד');
    expect(en.days[13].dayLabel).toBe('14');
    expect(en.locale).toBe('en');
    expect(he.locale).toBe('he');
    expect(en).not.toBe(he);
    expect(viewKey(en)).toBe(viewKey(he));
    expect(monthViewContaining('hebrew', '2026-09-15', 'en')).toBe(en);
    expect(en.firstDay).toBe(he.firstDay);
    expect(en.lastDay).toBe(he.lastDay);

    expect(monthViewContaining('gregorian', '2026-09-15').title).toBe('ספטמבר 2026');
    expect(monthViewContaining('gregorian', '2026-09-15', 'en').title).toBe('September 2026');
    expect(monthViewContaining('gregorian', '2026-09-15', 'fr').title).toBe('septembre 2026');
    expect(monthViewContaining('hijri', '2026-09-15').title).toBe('רביע א-ת׳אני 1448');
    expect(monthViewContaining('hijri', '2026-09-15', 'en').title).toBe('Rabiʻ II 1448');
    expect(monthViewContaining('hijri', '2026-09-15', 'fr').title).toBe('rabia ath-thani 1448');
  });

  it('keeps the language when stepping and when looking a month up by number', () => {
    const en = monthViewContaining('hebrew', '2026-09-15', 'en');
    expect(adjacentMonthView(en, -1).title).toBe('Elul 5786');
    expect(adjacentMonthView(en, -1).locale).toBe('en');
    expect(adjacentMonthView(en, 1).title).toBe('Heshvan 5787');
    expect(monthViewFor('hebrew', 5787, 1, 'en').title).toBe('Tishri 5787');
    expect(monthViewFor('hebrew', 5787, 7, 'en').title).toBe('Adar II 5787');
    expect(monthViewFor('hijri', 1447, 9, 'en').title).toBe('Ramadan 1447');
    expect(monthViewFor('hijri', 1447, 9, 'fr').title).toBe('ramadan 1447');
    expect(monthViewFor('gregorian', 2026, 9, 'fr').title).toBe('septembre 2026');
    expect(monthViewFor('hebrew', 5787, 1).title).toBe('תשרי תשפ״ז');
  });

  it('labels the month options of a year per language', () => {
    expect(monthsOfYear('hebrew', 5787, 'en').map((m) => m.label)).toEqual([
      'Tishri', 'Heshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar I', 'Adar II', 'Nisan', 'Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul',
    ]);
    expect(monthsOfYear('hebrew', 5786, 'en').map((m) => m.label)).toContain('Adar');
    expect(monthsOfYear('hebrew', 5787).map((m) => m.label)[0]).toBe('תשרי');
    expect(monthsOfYear('hebrew', 5787, 'fr').map((m) => m.label)[0]).toBe('tichri');
    expect(monthsOfYear('gregorian', 2026, 'en').map((m) => m.label)[0]).toBe('January');
    expect(monthsOfYear('gregorian', 2026, 'fr').map((m) => m.label)[0]).toBe('janvier');
    expect(monthsOfYear('gregorian', 2026).map((m) => m.label)[0]).toBe('ינואר');
    expect(monthsOfYear('hijri', 1447, 'en').map((m) => m.label)[8]).toBe('Ramadan');
    expect(monthsOfYear('hijri', 1447, 'en').map((m) => m.key)).toEqual(monthsOfYear('hijri', 1447).map((m) => m.key));
  });

  it('names the other calendars of a day and of a view per language', () => {
    expect(otherDatesLabel('2026-09-12', ALL, 'hebrew', 'en')).toBe('12 September 2026, 1 Rabiʻ II 1448');
    expect(otherDatesLabel('2026-09-12', ALL, 'gregorian', 'en')).toBe('1 Tishri 5787, 1 Rabiʻ II 1448');
    expect(otherDatesLabel('2026-09-12', ALL, 'hijri', 'fr')).toBe('12 septembre 2026, 1 tichri 5787');
    expect(otherDatesLabel('2026-09-12', ALL, 'hebrew')).toBe('12 בספטמבר 2026, 1 ברביע א-ת׳אני 1448');
    const tishreiEn = monthViewContaining('hebrew', '2026-09-15', 'en');
    const spans = otherMonthSpans(tishreiEn, ALL);
    expect(plain(spans[0])).toBe('12 September – 11 October 2026');
    expect(plain(spans[1])).toMatch(/^Rabiʻ II( – Jumada I)? 1448$/);
    // An explicit locale overrides the view's language.
    expect(otherMonthSpans(tishreiEn, ALL, 'he')[0]).toBe('12 בספטמבר – 11 באוקטובר 2026');
    expect(plain(otherMonthSpans(monthViewContaining('gregorian', '2026-09-01', 'fr'), ALL)[0])).toBe('éloul 5786 à tichri 5787');
  });
});

describe('holiday texts per language', () => {
  const roshHashana = holidaysOn('2026-09-12')[0];
  const roshChodesh = holidaysOn('2026-10-12').find((h) => h.id === 'jewish.rosh-chodesh') as Holiday;
  const eidDays = holidaysOn('2026-05-27');

  it('carries a catalogue key for every holiday name and note of a year', () => {
    for (const h of holidaysInRange('2026-01-01', '2026-12-31')) {
      expect(h.nameKey, h.id).toBeDefined();
      expect(lookup('en', h.nameKey as string), `${h.id} en`).not.toBeNull();
      expect(lookup('he', h.nameKey as string), `${h.id} he`).not.toBeNull();
      // The Hebrew catalogue text equals the legacy `name` (Rosh Chodesh carries the month as a placeholder).
      expect(holidayName(h, 'he'), h.id).toBe(h.name);
      if (h.note) {
        expect(h.noteKey, `${h.id} note`).toBeDefined();
        expect(holidayNote(h, 'he'), h.id).toBe(h.note);
        expect(holidayNote(h, 'en'), h.id).not.toMatch(/[א-ת]/);
      } else {
        expect(holidayNote(h, 'en')).toBeUndefined();
      }
    }
    expect(holidayNameKey('christian.easter.western')).toBe('holidays.christian-easter-western');
    expect(holidayNameKey('jewish.sukkot', 'cholHamoed')).toBe('holidays.jewish-sukkot.cholHamoed');
  });

  it('resolves names, notes and sentences in Hebrew, English and French', () => {
    expect(holidayName(roshHashana, 'he')).toBe('ראש השנה');
    expect(holidayName(roshHashana, 'en')).toBe('Rosh Hashanah');
    expect(holidayName(roshHashana, 'fr')).toBe(t('fr', 'holidays.jewish-rosh-hashana'));
    expect(describeHoliday(roshHashana)).toBe('ראש השנה (יום 1 מתוך 2)');
    expect(describeHoliday(roshHashana, 'en')).toBe('Rosh Hashanah (day 1 of 2)');
    expect(describeHoliday(roshHashana, 'fr')).toBe(t('fr', 'holidays.dayOf', { name: holidayName(roshHashana, 'fr'), index: 1, count: 2 }));

    expect(holidayName(roshChodesh, 'he')).toBe('ראש חודש חשוון');
    expect(holidayName(roshChodesh, 'en')).toBe('Rosh Chodesh Heshvan');
    expect(holidayName(roshChodesh, 'fr')).toBe(t('fr', 'holidays.jewish-rosh-chodesh', { month: 'hèchvan' }));
    expect(holidayNote(roshChodesh, 'he')).toBe('ראש חודש של יומיים');
    expect(holidayNote(roshChodesh, 'en')).toBe('Two-day Rosh Chodesh');

    const sukkotDay3 = holidaysOn('2026-09-28').find((h) => h.id === 'jewish.sukkot') as Holiday;
    expect(holidayName(sukkotDay3, 'en')).toBe('Chol HaMoed Sukkot');
    expect(holidayName(sukkotDay3, 'he')).toBe('חול המועד סוכות');

    // A hand-built holiday without keys falls back to its Hebrew name.
    const custom: Holiday = { id: 'x.y', tradition: 'jewish', name: 'חג פרטי', kind: 'minor', date: '2026-01-01' };
    expect(holidayName(custom, 'en')).toBe('חג פרטי');
    expect(holidayNote(custom, 'en')).toBeUndefined();
  });

  it('adds the tradition when two listed holidays share a name (Eid al-Adha)', () => {
    const muslim = eidDays.find((h) => h.tradition === 'muslim') as Holiday;
    const druze = eidDays.find((h) => h.tradition === 'druze') as Holiday;
    expect(describeHolidayAmong(muslim, eidDays, 'en')).toBe('Eid al-Adha (day 1 of 4) (Muslim)');
    expect(describeHolidayAmong(druze, eidDays, 'en')).toBe('Eid al-Adha (day 1 of 4) (Druze)');
    expect(describeHolidayAmong(muslim, eidDays)).toBe('עיד אל-אדחא (יום 1 מתוך 4) (מוסלמי)');
    expect(describeHolidayAmong(muslim, [muslim], 'en')).toBe('Eid al-Adha (day 1 of 4)');
    expect(holidayNote(muslim, 'en')).toMatch(/Umm al-Qura|arithmetic Hijri/);
  });

  it('describes a day per language', () => {
    expect(describeDay('2026-09-12', ALL, 'en')).toMatchObject({
      hebrew: '1 Tishri 5787',
      hijri: '1 Rabiʻ II 1448',
      text: '1 Tishri 5787, 1 Rabiʻ II 1448, Rosh Hashanah (day 1 of 2)',
    });
    expect(describeDay('2026-09-12', ALL).text).toBe('א׳ בתשרי תשפ״ז, 1 ברביע א-ת׳אני 1448, ראש השנה (יום 1 מתוך 2)');
    const fr = describeDay('2026-09-12', ALL, 'fr');
    expect(fr.hebrew).toBe('1 tichri 5787');
    expect(fr.hijri).toBe('1 rabia ath-thani 1448');
    expect(fr.text).toBe(`1 tichri 5787, 1 rabia ath-thani 1448, ${describeHoliday(roshHashana, 'fr')}`);
    expect(describeDay('2026-09-15', { ...ALL, hijriDates: false }, 'en').text).toBe('4 Tishri 5787');
  });

  it('labels traditions and kinds per language, matching the legacy Hebrew tables', () => {
    const traditions: HolidayTradition[] = ['jewish', 'muslim', 'christian', 'druze'];
    for (const tr of traditions) {
      expect(traditionLabel(tr, 'he')).toBe(TRADITION_LABELS[tr]);
      expect(traditionShort(tr, 'he')).toBe(TRADITION_SHORT[tr]);
      expect(traditionLabel(tr, 'en')).not.toMatch(/[א-ת]/);
      expect(traditionLabel(tr, 'fr')).toBe(t('fr', `holidays.tradition.${tr}`));
    }
    expect(traditionLabel('jewish', 'en')).toBe('Jewish holidays and observances');
    expect(traditionShort('druze', 'en')).toBe('Druze');
    const kinds: HolidayKind[] = ['major', 'minor', 'fast', 'memorial', 'national'];
    for (const k of kinds) {
      expect(kindLabel(k, 'he')).toBe(KIND_LABELS[k]);
      expect(kindLabel(k, 'en')).not.toMatch(/[א-ת]/);
    }
    expect(kindLabel('fast', 'en')).toBe('Fast');
    expect(kindLabel('memorial', 'fr')).toBe(t('fr', 'holidays.kind.memorial'));
  });
});

describe('joinWithoutEra', () => {
  it('drops the era part and the separator glued to it', () => {
    expect(
      joinWithoutEra([
        { type: 'month', value: 'Rabiʻ II' },
        { type: 'literal', value: ' ' },
        { type: 'year', value: '1448' },
        { type: 'literal', value: ' ' },
        { type: 'era', value: 'AH' },
      ]),
    ).toBe('Rabiʻ II 1448');
    expect(
      joinWithoutEra([
        { type: 'era', value: 'AM' },
        { type: 'literal', value: ' ' },
        { type: 'day', value: '14' },
        { type: 'literal', value: ' ' },
        { type: 'month', value: 'Tishri' },
      ]),
    ).toBe('14 Tishri');
    expect(joinWithoutEra([{ type: 'month', value: 'Tishri' }])).toBe('Tishri');
  });
});
