/**
 * Glue between the local calendars module (`shared/calendars`) and the UI.
 *
 * The calendar system chosen in the calendar page's "Calendar" select
 * (Gregorian / Hebrew / Hijri, remembered per device under
 * CALENDAR_SYSTEM_KEY) decides what the calendar, day and entry pages show:
 * the day numbers of that system and only the holidays that belong to it
 * (Gregorian -> Christian, Hebrew -> Jewish, Hijri -> Muslim and Druze). The
 * month's span in the other two calendars is spelled out above the grid.
 * Which systems the browser's ICU data provides is probed once; everything is
 * guarded, so a missing calendar hides parts instead of throwing.
 */
import {
  describeHolidayAmong,
  formatHebrewDate as formatHebrewCalendarDate,
  formatHijriDate,
  holidaysByDate,
  holidaysOn,
  isHebrewCalendarSupported,
  isHijriCalendarSupported,
  toHebrewDate,
  toHijriDate,
  type Holiday,
  type HolidayTradition,
} from '@shared/calendars';
import { formatSystemDate, isCalendarSystem, type CalendarSystem, type MonthView } from '@shared/calendars/month-view';
import { formatDate, type Locale } from '@shared/i18n';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { getCurrentLocale } from '@/i18n/runtime';
import { ET } from '@/pages/entries/texts';

export interface CalendarSupport {
  /** Intl provides the 'hebrew' calendar. */
  hebrew: boolean;
  /** Intl provides 'islamic-umalqura' (or the 'islamic-civil' fallback). */
  hijri: boolean;
}

/** Visible marker of each tradition (always next to text, never colour alone). */
export const TRADITION_MARKS: Record<HolidayTradition, string> = {
  jewish: '✡',
  muslim: '☪',
  christian: '✝',
  druze: '✦',
};

/** localStorage key of the selected calendar system (JSON string: "gregorian" / "hebrew" / "hijri"). */
export const CALENDAR_SYSTEM_KEY = 'mpd.calendarSystem';

/** The holiday traditions that belong to each calendar system. */
export const SYSTEM_TRADITIONS: Record<CalendarSystem, readonly HolidayTradition[]> = {
  gregorian: ['christian'],
  hebrew: ['jewish'],
  hijri: ['muslim', 'druze'],
};

let cachedSupport: CalendarSupport | null = null;

function probe(fn: () => boolean): boolean {
  try {
    return fn();
  } catch {
    return false;
  }
}

/** Which ICU calendars this engine provides. Probed once; never throws. */
export function calendarSupport(): CalendarSupport {
  if (!cachedSupport) {
    cachedSupport = { hebrew: probe(isHebrewCalendarSupported), hijri: probe(isHijriCalendarSupported) };
  }
  return cachedSupport;
}

/** Forgets the probed support (tests that stub the probes). */
export function resetCalendarSupportCache(): void {
  cachedSupport = null;
}

/** True when the engine can lay a month out by `system` (gregorian always). */
export function isSystemSupported(system: CalendarSystem, support: CalendarSupport = calendarSupport()): boolean {
  if (system === 'hebrew') return support.hebrew;
  if (system === 'hijri') return support.hijri;
  return true;
}

/**
 * The traditions whose holidays a system shows, without those whose calendar
 * the engine lacks (Druze holidays stay: most of them are fixed civil dates and
 * the module simply omits the Hijri-based ones when that calendar is missing).
 */
export function systemTraditions(system: CalendarSystem, support: CalendarSupport = calendarSupport()): HolidayTradition[] {
  return SYSTEM_TRADITIONS[system].filter((t) => (t === 'jewish' ? support.hebrew : t === 'muslim' ? support.hijri : true));
}

/** The system remembered on this device, or 'gregorian' when nothing valid is stored or the engine lacks that calendar. */
export function readStoredSystem(support: CalendarSupport = calendarSupport()): CalendarSystem {
  try {
    const raw = window.localStorage.getItem(CALENDAR_SYSTEM_KEY);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    return isCalendarSystem(parsed) && isSystemSupported(parsed, support) ? parsed : 'gregorian';
  } catch {
    return 'gregorian';
  }
}

/** The stored system as React state: the calendar page writes it, the day and entry pages read it. */
export function useStoredCalendarSystem() {
  return useLocalStorageState<CalendarSystem>(CALENDAR_SYSTEM_KEY, 'gregorian', isCalendarSystem);
}

/** The effective system of the day / entry pages: the stored choice, or Gregorian when the engine lacks that calendar. */
export function useCalendarSystem(): CalendarSystem {
  const [stored] = useStoredCalendarSystem();
  return isSystemSupported(stored) ? stored : 'gregorian';
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * The full date of a civil day in `system`, in the UI language ("א׳ בתשרי תשפ״ז" /
 * "1 Tishri 5787", "12 בספטמבר 2026" / "12 September 2026"); null when the calendar is unavailable.
 */
export function systemDateText(system: CalendarSystem, iso: string, locale: Locale = getCurrentLocale(), support: CalendarSupport = calendarSupport()): string | null {
  if (!isSystemSupported(system, support)) return null;
  try {
    return formatSystemDate(system, iso, { locale });
  } catch {
    return null;
  }
}

/** Full Hebrew date of a civil day ("כ״ה באלול תשפ״ו" / "25 Elul 5786"), null when unavailable. */
export function hebrewDateText(iso: string, locale: Locale = getCurrentLocale()): string | null {
  if (!calendarSupport().hebrew) return null;
  try {
    return formatHebrewCalendarDate(toHebrewDate(iso), { locale });
  } catch {
    return null;
  }
}

/** Full Hijri date of a civil day ("25 ברביע אל-אוול 1448" / "25 Rabiʻ I 1448"), null when unavailable. */
export function hijriDateText(iso: string, locale: Locale = getCurrentLocale()): string | null {
  if (!calendarSupport().hijri) return null;
  try {
    return formatHijriDate(toHijriDate(iso), { locale });
  } catch {
    return null;
  }
}

/**
 * A civil day as the compact numeric date of the language, with a two-digit day and month:
 * '12.09.2026' (he, de, ru...), '12/09/2026' (en, fr...), '2026/09/12' (zh, ja), '2026. 09. 12.' (hu).
 * Used by the span sentences above the calendar table.
 */
export function civilNumericDate(iso: string, locale: Locale = getCurrentLocale()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new RangeError(`invalid date: ${iso}`);
  return formatDate(locale, iso, 'numeric');
}

/**
 * The month's span in the two calendars that are NOT the view's own, one full
 * sentence each, in the view's language; the first sentence carries the month title:
 *   Tishrei 5787 (he): ['חודש תשרי תשפ״ז: מ-12.09.2026 עד 11.10.2026', 'בלוח המוסלמי: מ-1 ברביע א-ת׳אני 1448 עד 30 ברביע א-ת׳אני 1448']
 *   September 2026 (en): ['September 2026 in the Hebrew calendar: from 19 Elul 5786 to 19 Tishri 5787',
 *                         'In the Hijri calendar: from 19 Rabiʻ I 1448 to 19 Rabiʻ II 1448']
 * A calendar the engine lacks is left out; never throws.
 */
export function monthSpanSentences(view: MonthView, support: CalendarSupport = calendarSupport()): string[] {
  const locale = view.locale;
  const out: string[] = [];
  try {
    if (view.system !== 'gregorian') {
      out.push(ET.spanGregorian(view.title, civilNumericDate(view.firstDay, locale), civilNumericDate(view.lastDay, locale), locale));
    }
    if (view.system !== 'hebrew' && support.hebrew) {
      const from = systemDateText('hebrew', view.firstDay, locale, support);
      const to = systemDateText('hebrew', view.lastDay, locale, support);
      if (from && to) out.push(out.length === 0 ? ET.spanHebrewLead(view.title, from, to, locale) : ET.spanHebrew(from, to, locale));
    }
    if (view.system !== 'hijri' && support.hijri) {
      const from = systemDateText('hijri', view.firstDay, locale, support);
      const to = systemDateText('hijri', view.lastDay, locale, support);
      if (from && to) out.push(out.length === 0 ? ET.spanHijriLead(view.title, from, to, locale) : ET.spanHijri(from, to, locale));
    }
  } catch {
    /* a calendar the engine cannot compute for this month: keep the sentences built so far */
  }
  return out;
}

/** The sentences of `monthSpanSentences` on one line (announcements), or the bare month title when none applies. */
export function monthSpansText(view: MonthView, support: CalendarSupport = calendarSupport()): string {
  const sentences = monthSpanSentences(view, support);
  return sentences.length > 0 ? sentences.join(' · ') : view.title;
}

// ---------------------------------------------------------------------------
// Holidays
// ---------------------------------------------------------------------------

const NO_HOLIDAYS: readonly Holiday[] = Object.freeze([]);

/**
 * "ראש השנה (יום 1 מתוך 2)" / "Rosh Hashanah (day 1 of 2)", plus the tradition
 * when another holiday shown that day has the same name (Eid al-Adha is both
 * Muslim and Druze: "עיד אל-אדחא (יום 1 מתוך 4) (מוסלמי)"), so a spoken list
 * never repeats itself without saying why.
 */
export function holidayLabel(holiday: Holiday, shown: readonly Holiday[], locale: Locale = getCurrentLocale()): string {
  return describeHolidayAmong(holiday, shown, locale);
}

/**
 * Holidays of the visible month keyed by ISO day (only days that have any).
 * One call per month, meant to be memoised by the caller; an empty map when
 * no tradition is given or the engine cannot compute the range.
 */
export function monthHolidays(from: string, to: string, traditions: readonly HolidayTradition[]): Map<string, Holiday[]> {
  if (traditions.length === 0) return new Map();
  try {
    return holidaysByDate(from, to, traditions);
  } catch {
    return new Map();
  }
}

/** Holidays of one day for the given traditions (frozen shared list, never throws). */
export function dayHolidays(iso: string, traditions: readonly HolidayTradition[]): readonly Holiday[] {
  if (traditions.length === 0) return NO_HOLIDAYS;
  try {
    return holidaysOn(iso, traditions);
  } catch {
    return NO_HOLIDAYS;
  }
}

/**
 * The holiday part of a cell's / day's screen-reader sentence, comma-separated
 * ("ראש השנה (יום 1 מתוך 2)"); '' when the day has none. Never throws.
 */
export function dayHolidaysLabel(iso: string, traditions: readonly HolidayTradition[], locale: Locale = getCurrentLocale()): string {
  const holidays = dayHolidays(iso, traditions);
  return holidays.map((h) => holidayLabel(h, holidays, locale)).join(', ');
}
