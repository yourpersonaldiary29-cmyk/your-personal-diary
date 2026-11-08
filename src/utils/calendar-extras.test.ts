import { describe, expect, it } from 'vitest';
import { monthViewContaining, monthViewFor } from '@shared/calendars/month-view';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import {
  CALENDAR_SYSTEM_KEY,
  calendarSupport,
  civilNumericDate,
  dayHolidays,
  dayHolidaysLabel,
  hebrewDateText,
  hijriDateText,
  holidayLabel,
  isSystemSupported,
  monthHolidays,
  monthSpanSentences,
  monthSpansText,
  readStoredSystem,
  SYSTEM_TRADITIONS,
  systemDateText,
  systemTraditions,
  TRADITION_MARKS,
} from './calendar-extras';

// The dates and holiday names below are asserted in Hebrew unless a locale is passed.
pinLocaleForTests('he');

describe('calendar-extras helpers', () => {
  it('the test engine (Node ICU) provides both calendars', () => {
    expect(calendarSupport()).toEqual({ hebrew: true, hijri: true });
  });

  it('maps each calendar system to its holiday traditions, dropping those whose calendar the engine lacks', () => {
    expect(SYSTEM_TRADITIONS).toEqual({ gregorian: ['christian'], hebrew: ['jewish'], hijri: ['muslim', 'druze'] });
    expect(systemTraditions('gregorian')).toEqual(['christian']);
    expect(systemTraditions('hebrew')).toEqual(['jewish']);
    expect(systemTraditions('hijri')).toEqual(['muslim', 'druze']);
    expect(systemTraditions('hebrew', { hebrew: false, hijri: true })).toEqual([]);
    // Druze holidays do not depend on the ICU calendar (the module omits the Hijri-based ones itself).
    expect(systemTraditions('hijri', { hebrew: true, hijri: false })).toEqual(['druze']);
    expect(isSystemSupported('gregorian', { hebrew: false, hijri: false })).toBe(true);
    expect(isSystemSupported('hebrew', { hebrew: false, hijri: true })).toBe(false);
    expect(isSystemSupported('hijri', { hebrew: true, hijri: false })).toBe(false);
  });

  it('reads the remembered system from localStorage, falling back to Gregorian', () => {
    expect(readStoredSystem()).toBe('gregorian');
    window.localStorage.setItem(CALENDAR_SYSTEM_KEY, JSON.stringify('hebrew'));
    expect(readStoredSystem()).toBe('hebrew');
    expect(readStoredSystem({ hebrew: false, hijri: true })).toBe('gregorian');
    window.localStorage.setItem(CALENDAR_SYSTEM_KEY, JSON.stringify('hijri'));
    expect(readStoredSystem()).toBe('hijri');
    window.localStorage.setItem(CALENDAR_SYSTEM_KEY, 'garbage');
    expect(readStoredSystem()).toBe('gregorian');
    window.localStorage.setItem(CALENDAR_SYSTEM_KEY, JSON.stringify('julian'));
    expect(readStoredSystem()).toBe('gregorian');
  });

  it('formats the full date of a day in each system, in the UI language, and never throws', () => {
    expect(systemDateText('gregorian', '2026-09-12')).toBe('12 בספטמבר 2026');
    expect(systemDateText('hebrew', '2026-09-12')).toBe('א׳ בתשרי תשפ״ז');
    expect(systemDateText('hijri', '2026-09-12')).toBe('1 ברביע א-ת׳אני 1448');
    expect(hebrewDateText('2026-09-12')).toBe('א׳ בתשרי תשפ״ז');
    expect(hijriDateText('2026-09-12')).toBe('1 ברביע א-ת׳אני 1448');
    expect(systemDateText('gregorian', '2026-09-12', 'en')).toBe('12 September 2026');
    expect(systemDateText('hebrew', '2026-09-12', 'en')).toBe('1 Tishri 5787');
    expect(systemDateText('hijri', '2026-09-12', 'en')).toBe('1 Rabiʻ II 1448');
    expect(hebrewDateText('2026-09-07', 'en')).toBe('25 Elul 5786');
    expect(systemDateText('hebrew', '2026-13-40')).toBeNull();
    expect(hebrewDateText('2026-13-40')).toBeNull();
    expect(hijriDateText('')).toBeNull();
    expect(systemDateText('hebrew', '2026-09-12', 'he', { hebrew: false, hijri: true })).toBeNull();
    expect(civilNumericDate('2026-09-07')).toBe('07.09.2026');
    expect(civilNumericDate('2026-10-11')).toBe('11.10.2026');
    // The language's own numeric date (two-digit day and month), always in the Gregorian calendar.
    expect(civilNumericDate('2026-09-07', 'en')).toBe('07/09/2026');
    expect(civilNumericDate('2026-09-07', 'de')).toBe('07.09.2026');
    expect(civilNumericDate('2026-09-07', 'zh')).toBe('2026/09/07');
    expect(civilNumericDate('2026-09-07', 'th')).toBe('07/09/2026');
    expect(() => civilNumericDate('bad')).toThrow();
  });

  it('labels the holidays of a day for the given traditions, naming the tradition when two shown holidays share a name', () => {
    expect(dayHolidaysLabel('2026-09-12', ['jewish'])).toBe('ראש השנה (יום 1 מתוך 2)');
    expect(dayHolidaysLabel('2026-09-12', ['christian'])).toBe('');
    expect(dayHolidaysLabel('2026-09-12', [])).toBe('');
    expect(dayHolidaysLabel('garbage', ['jewish'])).toBe('');
    // Eid al-Adha is both Muslim and Druze.
    expect(dayHolidaysLabel('2026-05-27', ['muslim', 'druze'])).toBe('עיד אל-אדחא (יום 1 מתוך 4) (מוסלמי), עיד אל-אדחא (יום 1 מתוך 4) (דרוזי)');
    expect(dayHolidaysLabel('2026-05-27', ['druze'])).toBe('עיד אל-אדחא (יום 1 מתוך 4)');
    const shown = dayHolidays('2026-05-27', ['muslim', 'druze']);
    expect(holidayLabel(shown[0], shown)).toBe('עיד אל-אדחא (יום 1 מתוך 4) (מוסלמי)');
    expect(holidayLabel(shown[0], [shown[0]])).toBe('עיד אל-אדחא (יום 1 מתוך 4)');
    expect(holidayLabel(shown[0], shown, 'en')).toBe('Eid al-Adha (day 1 of 4) (Muslim)');
    expect(dayHolidaysLabel('2026-02-18', ['muslim', 'druze'], 'en')).toBe('Start of Ramadan');
    setCurrentLocale('en');
    expect(dayHolidaysLabel('2026-09-12', ['jewish'])).toBe('Rosh Hashanah (day 1 of 2)');
  });

  it('spells out the month span in the other two calendars, the first sentence carrying the month title', () => {
    const tishrei = monthViewContaining('hebrew', '2026-09-12', 'he');
    expect(monthSpanSentences(tishrei)).toEqual([
      'חודש תשרי תשפ״ז: מ-12.09.2026 עד 11.10.2026',
      'בלוח המוסלמי: מ-1 ברביע א-ת׳אני 1448 עד 30 ברביע א-ת׳אני 1448',
    ]);
    expect(monthSpansText(tishrei)).toBe('חודש תשרי תשפ״ז: מ-12.09.2026 עד 11.10.2026 · בלוח המוסלמי: מ-1 ברביע א-ת׳אני 1448 עד 30 ברביע א-ת׳אני 1448');
    expect(monthSpanSentences(monthViewContaining('hebrew', '2026-09-12', 'en'))).toEqual([
      'Tishri 5787 runs from 12/09/2026 to 11/10/2026',
      'In the Hijri calendar: from 1 Rabiʻ II 1448 to 30 Rabiʻ II 1448',
    ]);
    expect(monthSpanSentences(monthViewContaining('gregorian', '2026-09-01', 'he'))).toEqual([
      'חודש ספטמבר 2026 בלוח העברי: מ-י״ט באלול תשפ״ו עד י״ט בתשרי תשפ״ז',
      'בלוח המוסלמי: מ-19 ברביע אל-אוול 1448 עד 19 ברביע א-ת׳אני 1448',
    ]);
    expect(monthSpanSentences(monthViewContaining('gregorian', '2026-09-01', 'en'))).toEqual([
      'September 2026 in the Hebrew calendar: from 19 Elul 5786 to 19 Tishri 5787',
      'In the Hijri calendar: from 19 Rabiʻ I 1448 to 19 Rabiʻ II 1448',
    ]);
    expect(monthSpanSentences(monthViewFor('hijri', 1447, 9, 'he'))).toEqual([
      'חודש רמדאן 1447: מ-18.02.2026 עד 19.03.2026',
      'בלוח העברי: מ-א׳ באדר תשפ״ו עד א׳ בניסן תשפ״ו',
    ]);
    expect(monthSpanSentences(monthViewFor('hijri', 1447, 9, 'en'))).toEqual([
      'Ramadan 1447 runs from 18/02/2026 to 19/03/2026',
      'In the Hebrew calendar: from 1 Adar 5786 to 1 Nisan 5786',
    ]);
    // A calendar the engine lacks is left out and the next sentence takes the lead.
    const september = monthViewContaining('gregorian', '2026-09-01', 'en');
    expect(monthSpanSentences(september, { hebrew: false, hijri: true })).toEqual(['September 2026 in the Hijri calendar: from 19 Rabiʻ I 1448 to 19 Rabiʻ II 1448']);
    expect(monthSpanSentences(september, { hebrew: true, hijri: false })).toEqual(['September 2026 in the Hebrew calendar: from 19 Elul 5786 to 19 Tishri 5787']);
    expect(monthSpanSentences(september, { hebrew: false, hijri: false })).toEqual([]);
    expect(monthSpansText(september, { hebrew: false, hijri: false })).toBe('September 2026');
  });

  it('looks up the holidays of a month and of a day for the given traditions only', () => {
    const all = monthHolidays('2026-09-01', '2026-09-30', ['jewish', 'muslim', 'christian', 'druze']);
    expect(all.get('2026-09-12')?.map((h) => h.name)).toEqual(['ראש השנה']);
    expect(all.get('2026-09-10')?.map((h) => h.tradition)).toEqual(['druze']);
    expect(all.has('2026-09-07')).toBe(false);

    const jewishOnly = monthHolidays('2026-09-01', '2026-09-30', ['jewish']);
    expect(jewishOnly.has('2026-09-10')).toBe(false);
    expect(jewishOnly.get('2026-09-21')?.[0].name).toBe('יום כיפור');
    // The Gregorian calendar shows Christian holidays only: none in September 2026.
    expect(monthHolidays('2026-09-01', '2026-09-30', systemTraditions('gregorian')).size).toBe(0);
    expect(monthHolidays('2026-12-01', '2026-12-31', systemTraditions('gregorian')).get('2026-12-25')?.map((h) => h.tradition)).toEqual(['christian']);

    expect(monthHolidays('2026-09-01', '2026-09-30', []).size).toBe(0);
    expect(monthHolidays('bad', 'worse', ['jewish']).size).toBe(0);

    expect(dayHolidays('2026-09-12', ['jewish']).map((h) => h.name)).toEqual(['ראש השנה']);
    expect(dayHolidays('2026-09-12', ['druze'])).toEqual([]);
    expect(dayHolidays('2026-09-12', [])).toEqual([]);
    expect(dayHolidays('bad', ['jewish'])).toEqual([]);
  });

  it('has a distinct visible mark per tradition', () => {
    const marks = Object.values(TRADITION_MARKS);
    expect(new Set(marks).size).toBe(4);
    expect(marks.every((m) => m.length > 0)).toBe(true);
  });
});
