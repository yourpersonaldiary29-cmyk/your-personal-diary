/**
 * Holiday subcomponents of the calendar and day pages: the holiday badges of
 * a month cell (at most two + "+N"), the legend under the grid (one sample
 * badge per tradition of the selected calendar system and the Umm al-Qura
 * note) and the holiday list of the day page. Each tradition is told apart by
 * a textual mark (✡ ☪ ✝ ✦) and a border style, never by colour alone. Names,
 * notes, traditions and kinds come from the 'holidays.*' catalogue through the
 * shared calendars module, in the current UI language.
 */
import { describeHoliday, holidayName, holidayNote, kindLabel, traditionLabel, traditionShort, type Holiday, type HolidayTradition } from '@shared/calendars';
import type { CalendarSystem } from '@shared/calendars/month-view';
import { cx } from '@/components/ui/cx';
import { useLocale } from '@/context/LanguageContext';
import { tr } from '@/i18n/runtime';
import { TRADITION_MARKS } from '@/utils/calendar-extras';

/**
 * Strings of the holiday parts (cells, legend, day page), resolved through
 * the 'calendar.extras.*' catalogue keys in the current UI language.
 */
export const CX = {
  /** "Hebrew date: {value}" / "Hijri (Islamic) date: {value}" for the day page subtitle. */
  hebrewDateValue: (value: string) => tr('calendar.extras.hebrewDateValue', { value }),
  hijriDateValue: (value: string) => tr('calendar.extras.hijriDateValue', { value }),
  get holidaysHeading() { return tr('calendar.extras.holidaysHeading'); },
  /** "+N" badge for the holidays a cell cannot show, and its tooltip naming them. */
  more: (count: number) => tr('calendar.extras.more', { count }),
  moreTitle: (count: number, names: string) => tr('calendar.extras.moreTitle', { count, names }),
  get legendTitle() { return tr('calendar.extras.legendTitle'); },
  get hijriNote() { return tr('calendar.extras.hijriNote'); },
  get hebrewUnsupported() { return tr('calendar.extras.hebrewUnsupported'); },
  get hijriUnsupported() { return tr('calendar.extras.hijriUnsupported'); },
  /** "Day {index} of {count}" of a multi-day holiday (day page meta). */
  dayOf: (index: number, count: number) => tr('calendar.extras.dayOf', { index, count }),
  /** Tooltip of a compact badge: "{label} ({tradition})" - the 'holidays.withTradition' template of the holidays area. */
  holidayWithTradition: (label: string, tradition: string) => tr('holidays.withTradition', { label, tradition }),
} as const;

/** Visible tradition mark (aria-hidden: the surrounding text carries the meaning). */
export function TraditionMark({ tradition }: { tradition: HolidayTradition }) {
  return (
    <span className="holiday-badge__mark" aria-hidden="true">
      {TRADITION_MARKS[tradition]}
    </span>
  );
}

export interface HolidayBadgeProps {
  holiday: Holiday;
  /** Single-line, truncated with the full text in `title` (calendar cells). */
  compact?: boolean;
  className?: string;
}

/** Mark + name of one holiday, styled per tradition. */
export function HolidayBadge({ holiday, compact = false, className }: HolidayBadgeProps) {
  const locale = useLocale();
  const full = CX.holidayWithTradition(describeHoliday(holiday, locale), traditionShort(holiday.tradition, locale));
  return (
    <span
      className={cx('holiday-badge', `holiday-badge--${holiday.tradition}`, compact && 'holiday-badge--compact', className)}
      title={compact ? full : undefined}
      data-tradition={holiday.tradition}
    >
      <TraditionMark tradition={holiday.tradition} />
      <span className="holiday-badge__name">{holidayName(holiday, locale)}</span>
    </span>
  );
}

export interface HolidayBadgesProps {
  holidays: readonly Holiday[];
  /** Badges shown before "+N" (default 2). */
  max?: number;
}

/** The badges of one calendar cell: at most `max` names plus "+N" for the rest. */
export function HolidayBadges({ holidays, max = 2 }: HolidayBadgesProps) {
  const locale = useLocale();
  if (holidays.length === 0) return null;
  const shown = holidays.slice(0, max);
  const rest = holidays.slice(max);
  return (
    <span className="calendar__holidays">
      {shown.map((h) => (
        <HolidayBadge key={`${h.id}|${h.date}`} holiday={h} compact />
      ))}
      {rest.length > 0 && (
        <span className="holiday-badge holiday-badge--more" title={CX.moreTitle(rest.length, rest.map((h) => describeHoliday(h, locale)).join(', '))}>
          {CX.more(rest.length)}
        </span>
      )}
    </span>
  );
}

export interface CalendarHolidayLegendProps {
  /** The calendar the grid is laid out by. */
  system: CalendarSystem;
  /** The traditions whose holidays are shown (see `systemTraditions`). */
  traditions: readonly HolidayTradition[];
  /** Extra notices (role="note"), e.g. when the remembered calendar is unavailable in this browser. */
  notices?: readonly string[];
  id?: string;
}

/**
 * Legend under the month grid: one badge sample per shown tradition, the
 * Umm al-Qura note for the Hijri calendar and any notices. Renders nothing
 * when there is nothing to explain.
 */
export function CalendarHolidayLegend({ system, traditions, notices = [], id = 'calendar-holiday-legend' }: CalendarHolidayLegendProps) {
  const locale = useLocale();
  const showHijriNote = system === 'hijri';
  if (traditions.length === 0 && notices.length === 0 && !showHijriNote) return null;

  return (
    <section className="calendar__extras-legend" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="calendar__extras-legend-title">
        {CX.legendTitle}
      </h2>
      {traditions.length > 0 && (
        <ul className="calendar__extras-list">
          {traditions.map((t) => (
            <li key={t}>
              <span className={`holiday-badge holiday-badge--${t}`} data-tradition={t}>
                <TraditionMark tradition={t} />
                <span className="holiday-badge__name">{traditionLabel(t, locale)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {showHijriNote && <p className="calendar__hint">{CX.hijriNote}</p>}
      {notices.map((text) => (
        <p key={text} className="calendar__notice" role="note">
          {text}
        </p>
      ))}
    </section>
  );
}

export interface DayHolidayListProps {
  holidays: readonly Holiday[];
}

/** The holidays of one day: name, tradition, kind, day-of-N and the note. */
export function DayHolidayList({ holidays }: DayHolidayListProps) {
  const locale = useLocale();
  return (
    <ul className="holiday-list">
      {holidays.map((h) => {
        const meta = [traditionLabel(h.tradition, locale), kindLabel(h.kind, locale)];
        if (h.dayIndex && h.dayCount && h.dayCount > 1) meta.push(CX.dayOf(h.dayIndex, h.dayCount));
        const note = holidayNote(h, locale);
        return (
          <li key={`${h.id}|${h.date}`} className="holiday-list__item">
            <HolidayBadge holiday={h} className="holiday-list__name" />
            <span className="holiday-list__meta">{meta.join(' · ')}</span>
            {note && <span className="holiday-list__note">{note}</span>}
          </li>
        );
      })}
    </ul>
  );
}
