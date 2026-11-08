/**
 * Month calendar ("/calendar"). A real <table> whose day cells are buttons
 * (one tab stop, roving with the arrow keys) that open the day summary.
 *
 * The "Calendar" select (Gregorian / Hebrew / Hijri, remembered per device in
 * localStorage) decides everything the grid shows: the month is laid out by
 * that system, each cell carries only that system's day number, and only the
 * holidays that belong to it (Gregorian -> Christian, Hebrew -> Jewish,
 * Hijri -> Muslim and Druze), then the mean mood and energy, the habits
 * completed and whether an entry exists. No other calendar's dates appear in
 * the cells; instead a line right under the page title spells out the month's
 * span in the other two calendars as full sentences. Each button's aria-label
 * reads the whole cell in that order: the date in the selected system, the
 * holidays, the metrics. Mood may tint the cell but the numbers are always printed.
 *
 * The view lives in the query string so it can be linked and survives a
 * reload: ?year=2026&month=9 for a Gregorian month (as before), or
 * ?system=hebrew&year=5787&month=1 / ?system=hijri&year=1447&month=9.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  adjacentMonthView,
  CALENDAR_SYSTEMS,
  isCalendarSystem,
  monthsOfYear,
  monthViewContaining,
  monthViewFor,
  viewKey,
  type CalendarSystem,
  type MonthView,
} from '@shared/calendars/month-view';
import { civilDate, weekdayNames, type Locale } from '@shared/i18n';
import type { CalendarDay } from '@shared/types';
import { calendar as calendarApi } from '@/api';
import { PartialViewHint } from '@/components/sync/PartialViewHint';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageTitle } from '@/components/ui/PageTitle';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { PATHS } from '@/constants/routes';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useLocale } from '@/context/LanguageContext';
import { useSettings } from '@/context/SettingsContext';
import { useApi } from '@/hooks/useApi';
import { dir, getCurrentLocale, intlTag } from '@/i18n/runtime';
import { CalendarHolidayLegend, CX, ET, HolidayBadges } from '@/pages/entries';
import {
  CALENDAR_SYSTEM_KEY,
  calendarSupport,
  holidayLabel,
  isSystemSupported,
  monthHolidays,
  monthSpanSentences,
  systemDateText,
  systemTraditions,
  useStoredCalendarSystem,
} from '@/utils/calendar-extras';
import { CALENDAR_MAX_ISO, CALENDAR_MIN_ISO, navigableView, resolveView, yearOptionsFor } from '@/utils/calendar-years';
import { addDays, localizedWeekdayNames, todayIso, weekStart, weekdayIndex } from '@/utils/dates';
import { formatNumber } from '@/utils/format';

export { CALENDAR_SYSTEM_KEY };
// The year ranges (offered by the year select / accepted in the URL) live in one place: utils/calendar-years.ts.
export { CALENDAR_MAX_ISO, CALENDAR_MAX_YEAR, CALENDAR_MIN_ISO, CALENDAR_MIN_YEAR, resolveView, yearOptionsFor } from '@/utils/calendar-years';

export type MoodLevel = 'low' | 'mid' | 'high';

/** One grid cell: the civil day, its label in the selected system and the server's data for that day. */
export interface CalendarCell {
  date: string;
  /** '7' / 'י״ד' / '14'. */
  label: string;
  /** 1-based day of the month in the selected system. */
  number: number;
  data: CalendarDay;
}

/** DOM id of a day cell's button. */
export function dayButtonId(date: string): string {
  return `calendar-day-${date}`;
}

/** Coarse mood band used only to tint the cell (numbers stay visible). */
export function moodLevel(mood: number | null): MoodLevel | null {
  if (mood === null || !Number.isFinite(mood)) return null;
  if (mood <= 3.5) return 'low';
  if (mood < 7) return 'mid';
  return 'high';
}

const dayMonthFormatters = new Map<string, Intl.DateTimeFormat>();
const fullWeekdayNames = new Map<Locale, string[]>();

/** "7 בספטמבר" / "7 September": day and month of a civil day (no year) in the current UI language. */
export function civilDayMonthLabel(iso: string): string {
  const tag = intlTag();
  let df = dayMonthFormatters.get(tag);
  if (!df) {
    df = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', timeZone: 'UTC' });
    dayMonthFormatters.set(tag, df);
  }
  return df.format(civilDate(iso));
}

/** "יום שני" / "Monday": the full weekday name of a civil day in the current UI language. */
function fullWeekdayName(iso: string): string {
  const locale = getCurrentLocale();
  let names = fullWeekdayNames.get(locale);
  if (!names) {
    names = weekdayNames(locale, 'long');
    fullWeekdayNames.set(locale, names);
  }
  return names[weekdayIndex(iso)];
}

/**
 * "יום שני 7 בספטמבר: מצב רוח 7, אנרגיה 6, 3 מתוך 5 הרגלים הושלמו, יש רשומה"
 * ("Monday 7 September: Mood 7, Energy 6, 3 of 5 habits completed, has an entry").
 * `holidaysText` (the holidays of the selected calendar, see dayHolidaysLabel)
 * is read right after the date:
 * "יום שבת 12 בספטמבר: ראש השנה (יום 1 מתוך 2), מצב רוח 7, יש רשומה".
 * `primaryDate` replaces the civil date when the grid is laid out by another
 * calendar: "יום שבת א׳ בתשרי תשפ״ז: ראש השנה (יום 1 מתוך 2), מצב רוח 7, יש רשומה".
 */
export function dayAriaLabel(day: CalendarDay, today: string, holidaysText = '', primaryDate?: string | null): string {
  const date = ET.cellDate(fullWeekdayName(day.date), primaryDate || civilDayMonthLabel(day.date));
  const parts: string[] = [];
  if (day.mood !== null) parts.push(ET.moodBadge(formatNumber(day.mood)));
  if (day.energy !== null) parts.push(ET.energyBadge(formatNumber(day.energy)));
  if (day.habitsTotal > 0) parts.push(ET.habitsDone(day.habitsCompleted, day.habitsTotal));
  if (day.hasEntry) parts.push(ET.hasEntry(day.entryCount));
  const data = parts.length > 0 ? parts.join(', ') : ET.noData;
  return ET.cellAria(date, holidaysText ? `${holidaysText}, ${data}` : data, day.date === today);
}

/** Weekday indices (0 = Sunday) in column order for the given first day. */
export function weekdayOrder(firstDayOfWeek: 0 | 1): number[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => (i + firstDayOfWeek) % 7);
}

/** Rows of 7 cells (null = padding outside the month), laid out by the weekday of each civil day. */
export function buildWeeks<D extends { date: string }>(days: D[], firstDayOfWeek: 0 | 1): (D | null)[][] {
  if (days.length === 0) return [];
  const lead = (weekdayIndex(days[0].date) - firstDayOfWeek + 7) % 7;
  const cells: (D | null)[] = [...Array.from({ length: lead }, () => null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (D | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** A day the server did not report on (nothing written that day). */
export function emptyCalendarDay(date: string, habitsTotal = 0): CalendarDay {
  return { date, mood: null, energy: null, stress: null, sleepHours: null, hasEntry: false, entryCount: 0, habitsCompleted: 0, habitsTotal, titles: [] };
}

/**
 * Joins the view's days with the server's data. `/api/calendar/range` only
 * returns days that have data, so the gaps are filled with empty days; their
 * habit total (the number of active habits) is taken from the reported past
 * days, the way `/api/calendar/month` reports it, and 0 for future days.
 */
export function mergeViewDays(view: MonthView, days: readonly CalendarDay[], today: string): CalendarCell[] {
  const byDate = new Map(days.map((d) => [d.date, d] as const));
  let habitsTotal = 0;
  for (const d of days) if (d.date <= today && d.habitsTotal > habitsTotal) habitsTotal = d.habitsTotal;
  return view.days.map((d) => ({
    date: d.iso,
    label: d.dayLabel,
    number: d.dayNumber,
    data: byDate.get(d.iso) ?? emptyCalendarDay(d.iso, d.iso <= today ? habitsTotal : 0),
  }));
}

/** Query-string parameters that identify a view (Gregorian keeps the plain ?year&month form). */
export function viewSearchParams(view: MonthView): Record<string, string> {
  const base = { year: String(view.year), month: String(view.monthIndex) };
  return view.system === 'gregorian' ? base : { system: view.system, ...base };
}

/** What is announced after the month changes: the span sentences (they open with the month title), or the bare title. */
export function viewAnnouncement(view: MonthView, sentences: readonly string[]): string {
  return sentences.length > 0 ? sentences.join(' · ') : view.title;
}

/** The civil day of the same day number in the previous / next month of the view (clamped to that month's length). */
export function sameDayInAdjacentMonth(view: MonthView, date: string, delta: -1 | 1): string {
  const number = view.days.find((d) => d.iso === date)?.dayNumber ?? 1;
  const adjacent = adjacentMonthView(view, delta);
  return adjacent.days[Math.min(number, adjacent.length) - 1].iso;
}

export default function CalendarPage() {
  const { settings } = useSettings();
  const locale = useLocale();
  const navigate = useNavigate();
  const { announce } = useAnnouncer();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = todayIso();
  const firstDayOfWeek = settings.firstDayOfWeek;
  const support = calendarSupport();

  // Calendar system: the URL wins (a plain ?year&month link is Gregorian), otherwise the device preference.
  const [storedSystem, setStoredSystem] = useStoredCalendarSystem();
  const systemParam = searchParams.get('system');
  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month');
  const requestedSystem: CalendarSystem = isCalendarSystem(systemParam) ? systemParam : yearParam !== null || monthParam !== null ? 'gregorian' : storedSystem;
  const system: CalendarSystem = isSystemSupported(requestedSystem, support) ? requestedSystem : 'gregorian';
  // A year/month written for a calendar this engine lacks means nothing in the fallback system: show today's month instead.
  const paramsApply = system === requestedSystem;

  const view = useMemo(
    () => resolveView(system, paramsApply ? yearParam : null, paramsApply ? monthParam : null, today, locale),
    [system, paramsApply, yearParam, monthParam, today, locale],
  );
  const key = viewKey(view);
  const inView = (date: string) => date >= view.firstDay && date <= view.lastDay;

  // A plain Gregorian month comes from /calendar/month (every day reported); any other month from /calendar/range.
  // `source` is the answer as the api gave it: offline mode marks a month it put together from cached
  // records (OFFLINE-DESIGN.md section 4.6 "Missing views"), and the page then says so under the controls.
  const { data, loading, error, reload } = useApi(async () => {
    if (view.system === 'gregorian') {
      const month = await calendarApi.month(view.year, view.monthIndex);
      return { key, days: month.days, source: month as unknown };
    }
    const days = await calendarApi.range(view.firstDay, view.lastDay);
    return { key, days, source: days as unknown };
  }, [key], { offline: true });
  // Only render a grid that matches the selected month (useApi keeps the previous data while loading).
  const current = data && data.key === key ? data : null;

  // The holidays of the selected calendar in the visible month (one lookup per month) and the other calendars' spans.
  const traditions = useMemo(() => systemTraditions(system, support), [system, support]);
  const holidayMap = useMemo(() => monthHolidays(view.firstDay, view.lastDay, traditions), [view, traditions]);
  const spanSentences = useMemo(() => monthSpanSentences(view, support), [view, support]);

  const [focusDate, setFocusDate] = useState<string>(() => (inView(today) ? today : view.firstDay));
  // Cell to focus once its month is rendered (keyboard moves across months).
  const pendingFocus = useRef<string | null>(null);

  // Only months whose URL resolves back to themselves (navigableView): at the first / last year of a
  // calendar the month before / after is refused, never replaced by a month of the clamped year.
  const changeView = (next: MonthView, focus: string | null = null) => {
    if (!navigableView(next)) return;
    pendingFocus.current = focus;
    if (focus) setFocusDate(focus);
    if (viewKey(next) !== key) setSearchParams(viewSearchParams(next), { replace: true });
  };

  // Announce the month (with the other calendars' spans) after it changes through user interaction.
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (announced.current === null) {
      announced.current = key;
      return;
    }
    if (announced.current !== key) {
      announced.current = key;
      announce(viewAnnouncement(view, spanSentences), 'polite');
    }
  }, [key, view, spanSentences, announce]);

  // Focus the pending cell as soon as it exists in the DOM.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target || !current) return;
    const el = document.getElementById(dayButtonId(target));
    if (el) {
      pendingFocus.current = null;
      el.focus();
    }
  }, [current, focusDate]);

  const moveFocus = (date: string) => {
    if (date < CALENDAR_MIN_ISO || date > CALENDAR_MAX_ISO) return;
    if (inView(date)) {
      pendingFocus.current = null;
      setFocusDate(date);
      document.getElementById(dayButtonId(date))?.focus();
      return;
    }
    changeView(monthViewContaining(system, date, locale), date);
  };

  const onCellKeyDown = (e: KeyboardEvent<HTMLButtonElement>, date: string) => {
    let target: string | null = null;
    // The week runs right-to-left in RTL languages and left-to-right otherwise:
    // the arrow keys follow what the user sees.
    const rtl = dir(locale) === 'rtl';
    switch (e.key) {
      case 'ArrowRight': // RTL: the previous day; LTR: the next day
        target = addDays(date, rtl ? -1 : 1);
        break;
      case 'ArrowLeft': // RTL: the next day; LTR: the previous day
        target = addDays(date, rtl ? 1 : -1);
        break;
      case 'ArrowUp':
        target = addDays(date, -7);
        break;
      case 'ArrowDown':
        target = addDays(date, 7);
        break;
      case 'Home': {
        const start = weekStart(date, firstDayOfWeek);
        target = start < view.firstDay ? view.firstDay : start;
        break;
      }
      case 'End': {
        const end = addDays(weekStart(date, firstDayOfWeek), 6);
        target = end > view.lastDay ? view.lastDay : end;
        break;
      }
      case 'PageUp':
        target = sameDayInAdjacentMonth(view, date, -1);
        break;
      case 'PageDown':
        target = sameDayInAdjacentMonth(view, date, 1);
        break;
      default:
        return;
    }
    e.preventDefault();
    moveFocus(target);
  };

  const shiftMonth = (step: 1 | -1) => changeView(adjacentMonthView(view, step));
  const goToday = () => {
    setFocusDate(today);
    if (inView(today)) {
      document.getElementById(dayButtonId(today))?.focus();
      return;
    }
    changeView(monthViewContaining(system, today, locale), today);
  };

  const cells = useMemo(() => (current ? mergeViewDays(view, current.days, today) : []), [view, current, today]);
  const tabStop = cells.some((c) => c.date === focusDate) ? focusDate : inView(today) ? today : view.firstDay;

  const changeSystem = (next: CalendarSystem) => {
    if (!isSystemSupported(next, support)) return;
    setStoredSystem(next);
    if (next === system) return;
    // Stay on the month (of the new system) that contains the day the user is on.
    const nextView = monthViewContaining(next, tabStop, locale);
    if (!navigableView(nextView)) return;
    pendingFocus.current = null;
    setFocusDate(tabStop);
    setSearchParams(viewSearchParams(nextView), { replace: true });
  };

  const changeMonth = (monthIndex: number) => {
    try {
      changeView(monthViewFor(system, view.year, monthIndex, locale));
    } catch {
      /* month outside the year - the select only offers valid ones */
    }
  };
  const changeYear = (year: number) => {
    try {
      const count = monthsOfYear(system, year, locale).length;
      changeView(monthViewFor(system, year, Math.min(view.monthIndex, count), locale));
    } catch {
      /* year outside the calendars' range */
    }
  };

  const systemOptions: SelectOption<CalendarSystem>[] = useMemo(
    () =>
      CALENDAR_SYSTEMS.map((s) => {
        const supported = isSystemSupported(s, support);
        return { value: s, label: supported ? ET.systemLabel(s) : ET.systemUnsupportedOption(ET.systemLabel(s)), disabled: !supported };
      }),
    [support],
  );
  const monthOptions: SelectOption[] = useMemo(
    () => monthsOfYear(system, view.year, locale).map((m) => ({ value: String(m.index), label: m.label })),
    [system, view.year, locale],
  );
  const todayYear = useMemo(() => monthViewContaining(system, today, locale).year, [system, today, locale]);
  const yearOptions: SelectOption[] = useMemo(() => yearOptionsFor(system, view.year, todayYear, locale), [system, view.year, todayYear, locale]);

  const weeks = buildWeeks(cells, firstDayOfWeek);
  const columns = weekdayOrder(firstDayOfWeek);
  const weekdayHeaders = localizedWeekdayNames();
  // A remembered / linked calendar this browser lacks: the Gregorian grid is shown and the legend says why.
  const fallbackNotices = system === requestedSystem ? [] : [requestedSystem === 'hebrew' ? CX.hebrewUnsupported : CX.hijriUnsupported];

  return (
    <>
      <PageTitle title={ET.calendarTitle} actions={<LinkButton to={PATHS.newEntry}>{ET.newEntry}</LinkButton>} />
      {spanSentences.length > 0 && (
        <p className="calendar__spans" data-testid="calendar-spans">
          {spanSentences.join(' · ')}
        </p>
      )}

      <nav className="calendar__controls" aria-label={ET.calendarNav}>
        <Button variant="secondary" size="sm" onClick={() => shiftMonth(-1)}>
          {ET.previousMonth}
        </Button>
        <Button variant="secondary" size="sm" onClick={goToday}>
          {ET.today}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => shiftMonth(1)}>
          {ET.nextMonth}
        </Button>
        <Select<CalendarSystem> id="calendar-system" className="calendar__system" label={ET.calendarSystem} options={systemOptions} value={system} onChange={changeSystem} />
        <Select id="calendar-month" label={ET.monthSelect} options={monthOptions} value={String(view.monthIndex)} onChange={(v) => changeMonth(Number(v))} />
        <Select id="calendar-year" label={ET.yearSelect} options={yearOptions} value={String(view.year)} onChange={(v) => changeYear(Number(v))} />
      </nav>

      {loading && !current && <Spinner block />}
      {error && (
        <Alert kind="error">
          <p>{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void reload()}>
            {T.retry}
          </Button>
        </Alert>
      )}

      <PartialViewHint value={current?.source} />
      {current && (
        <div className="calendar">
          <table className="calendar__table" data-system={system}>
            <caption>{view.title}</caption>
            <thead>
              <tr>
                {columns.map((i) => (
                  <th key={i} scope="col">
                    {weekdayHeaders[i]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => (
                <tr key={wi}>
                  {week.map((cell, di) => {
                    if (cell === null) return <td key={`pad-${wi}-${di}`} className="calendar__empty" />;
                    const day = cell.data;
                    const level = moodLevel(day.mood);
                    const metrics = [
                      day.mood !== null ? ET.moodCell(formatNumber(day.mood)) : null,
                      day.energy !== null ? ET.energyCell(formatNumber(day.energy)) : null,
                    ].filter(Boolean);
                    const holidays = holidayMap.get(cell.date) ?? [];
                    const holidaysText = holidays.map((h) => holidayLabel(h, holidays, locale)).join(', ');
                    const primaryDate = system === 'gregorian' ? null : systemDateText(system, cell.date, locale, support);
                    return (
                      <td key={cell.date}>
                        <button
                          type="button"
                          id={dayButtonId(cell.date)}
                          className="calendar__day"
                          tabIndex={cell.date === tabStop ? 0 : -1}
                          aria-label={dayAriaLabel(day, today, holidaysText, primaryDate)}
                          aria-current={cell.date === today ? 'date' : undefined}
                          data-date={cell.date}
                          data-system={system}
                          data-mood-level={level ?? undefined}
                          onClick={() => navigate(PATHS.day(cell.date))}
                          onKeyDown={(e) => onCellKeyDown(e, cell.date)}
                          onFocus={() => setFocusDate(cell.date)}
                        >
                          <span className="calendar__num">{cell.label}</span>
                          <HolidayBadges holidays={holidays} />
                          {metrics.length > 0 && <span className="calendar__metrics">{metrics.join(' · ')}</span>}
                          {day.habitsTotal > 0 && <span className="calendar__habits">{ET.habitsCell(day.habitsCompleted, day.habitsTotal)}</span>}
                          {day.hasEntry && <span className="calendar__entry">{ET.entryMarker(day.entryCount)}</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="calendar__legend">{ET.legend}</p>
      <p className="calendar__legend">{ET.systemLegend(ET.systemLabel(system))}</p>
      <p className="calendar__hint">{ET.keyboardHint}</p>
      <CalendarHolidayLegend system={system} traditions={traditions} notices={fallbackNotices} />
    </>
  );
}
