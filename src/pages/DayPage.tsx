/**
 * Day summary ("/day/:date"): the date in the calendar system selected on the
 * calendar page (Hebrew / Hijri, under the civil heading) and the holidays of
 * that calendar, the day's averages as text tiles, every entry in full
 * (shared <EntryDetails>), the habit logs of that day and links to the
 * previous / next day and to a new entry pre-dated to this day.
 */
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { entries as entriesApi } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageTitle } from '@/components/ui/PageTitle';
import { Spinner } from '@/components/ui/Spinner';
import { PATHS } from '@/constants/routes';
import { T } from '@/constants/texts';
import { useLocale } from '@/context/LanguageContext';
import { PartialViewHint } from '@/components/sync/PartialViewHint';
import { useApi } from '@/hooks/useApi';
import { CX, DayHolidayList, EntryDetails, entryTitle, ET } from '@/pages/entries';
import { dayHolidays, systemDateText, systemTraditions, useCalendarSystem } from '@/utils/calendar-extras';
import { addDays, formatClock, formatHebrewDate, isValidIsoDate, relativeDayLabel, todayIso } from '@/utils/dates';
import { formatDecimal, formatHours, formatNumber } from '@/utils/format';

/** Link to the new-entry form pre-filled with a date. */
export function newEntryForDate(date: string): string {
  return `${PATHS.newEntry}?date=${date}`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <li className="tile">
      <span className="tile__label">{label}</span>
      <span className="tile__value">{value}</span>
    </li>
  );
}

export default function DayPage() {
  const { date = '' } = useParams<{ date: string }>();
  const valid = isValidIsoDate(date);
  const { data, loading, error, reload } = useApi(() => entriesApi.day(date), [date], { enabled: valid, offline: true });
  const locale = useLocale();
  const system = useCalendarSystem();
  const traditions = useMemo(() => systemTraditions(system), [system]);
  const holidays = useMemo(() => (valid ? dayHolidays(date, traditions) : []), [valid, date, traditions]);

  if (!valid) {
    return (
      <>
        <PageTitle title={ET.invalidDateTitle} />
        <EmptyState title={ET.invalidDateTitle} text={ET.invalidDateText} action={<LinkButton to={PATHS.calendar}>{ET.calendarTitle}</LinkButton>} />
      </>
    );
  }

  const today = todayIso();
  // The date in the selected calendar system; the civil date is the heading itself, so Gregorian adds nothing.
  const systemDate = system === 'gregorian' ? null : systemDateText(system, date, locale);
  const systemDateLine = systemDate === null ? null : system === 'hebrew' ? CX.hebrewDateValue(systemDate) : CX.hijriDateValue(systemDate);

  return (
    <>
      <PageTitle
        title={formatHebrewDate(date)}
        subtitle={
          <>
            {relativeDayLabel(date, today)}
            {systemDateLine && (
              <span className="day-alt-date">
                {' · '}
                {systemDateLine}
              </span>
            )}
          </>
        }
        actions={<LinkButton to={newEntryForDate(date)}>{ET.newEntryForDay}</LinkButton>}
      />
      <nav className="day-navigator" aria-label={ET.navLabel}>
        <LinkButton variant="secondary" size="sm" to={PATHS.day(addDays(date, -1))}>
          {ET.previousDay}
        </LinkButton>
        <LinkButton variant="secondary" size="sm" to={PATHS.day(today)}>
          {ET.today}
        </LinkButton>
        <LinkButton variant="secondary" size="sm" to={PATHS.day(addDays(date, 1))}>
          {ET.nextDay}
        </LinkButton>
      </nav>

      {holidays.length > 0 && (
        <section className="day-holidays" aria-labelledby="day-holidays-heading">
          <h2 id="day-holidays-heading">{CX.holidaysHeading}</h2>
          <DayHolidayList holidays={holidays} />
        </section>
      )}

      {loading && !data && <Spinner block />}
      {error && (
        <Alert kind="error">
          <p>{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void reload()}>
            {T.retry}
          </Button>
        </Alert>
      )}

      <PartialViewHint value={data} />
      {data && (
        <div className="stack">
          <section aria-labelledby="day-averages-heading">
            <h2 id="day-averages-heading">{ET.dayAverages}</h2>
            <ul className="tiles" aria-label={ET.dayAverages}>
              <Tile label={ET.moodAvg} value={formatDecimal(data.moodAvg)} />
              <Tile label={ET.energyAvg} value={formatDecimal(data.energyAvg)} />
              <Tile label={ET.stressAvg} value={formatDecimal(data.stressAvg)} />
              <Tile label={ET.sleepHoursTile} value={formatHours(data.sleepHours)} />
              <Tile label={ET.entriesTile} value={formatNumber(data.entries.length)} />
            </ul>
          </section>

          <section aria-labelledby="day-entries-heading">
            <h2 id="day-entries-heading">{ET.dayEntriesCount(data.entries.length)}</h2>
            {data.entries.length === 0 ? (
              <EmptyState
                headingLevel="h3"
                title={ET.noDayEntries}
                text={ET.noEntriesText}
                action={<LinkButton to={newEntryForDate(date)}>{ET.newEntryForDay}</LinkButton>}
              />
            ) : (
              <ul className="entry-list">
                {data.entries.map((entry) => {
                  const title = entryTitle(entry.title);
                  const headingId = `day-entry-${entry.id}-title`;
                  return (
                    <li key={entry.id}>
                      <article className="card day-entry" aria-labelledby={headingId}>
                        <h3 id={headingId} className="day-entry__title">
                          <time dateTime={`${entry.date}T${entry.time}`}>{formatClock(entry.time)}</time> · <bdi>{title}</bdi>
                        </h3>
                        <EntryDetails entry={entry} headingLevel="h4" />
                        <div className="cluster day-entry__actions">
                          <LinkButton to={PATHS.entry(entry.id)} variant="secondary" size="sm" aria-label={ET.openNamed(title)}>
                            {ET.open}
                          </LinkButton>
                          <LinkButton to={PATHS.editEntry(entry.id)} variant="ghost" size="sm" aria-label={ET.editNamed(title)}>
                            {ET.edit}
                          </LinkButton>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="day-habits-heading">
            <h2 id="day-habits-heading">{ET.dayHabits}</h2>
            {data.habitLogs.length === 0 ? (
              <p className="text-muted">{ET.noHabitLogs}</p>
            ) : (
              <table className="habit-table">
                <caption className="visually-hidden">{ET.dayHabits}</caption>
                <thead>
                  <tr>
                    <th scope="col">{ET.habitColumn}</th>
                    <th scope="col">{ET.valueColumn}</th>
                    <th scope="col">{ET.targetColumn}</th>
                    <th scope="col">{ET.statusColumn}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.habitLogs.map((item) => (
                    <tr key={item.log.id}>
                      <th scope="row">{item.habitName}</th>
                      <td>{ET.valueWithUnit(formatNumber(item.log.value), item.unit)}</td>
                      <td>{ET.valueWithUnit(formatNumber(item.target), item.unit)}</td>
                      <td>{item.log.completed ? ET.completed : ET.notCompleted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </>
  );
}
