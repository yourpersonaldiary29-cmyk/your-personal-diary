/**
 * Timeline ("/diary"): entries grouped by day for the selected range.
 *
 * - View mode (day / week / month / year) is a tab list persisted per device.
 * - <DayNavigator> moves the range; "go to date", a debounced text filter and
 *   a tag select (also fed by ?tag=) narrow the list.
 * - Day/week/month: api.entries.list (ascending, 500 per page, "load more").
 * - Year: api.calendar.range aggregated into a month table (entry counts and
 *   mean mood); a month name opens that month's view.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { CalendarDay, EntryFilter, EntrySummary } from '@shared/types';
import { calendar as calendarApi, entries as entriesApi } from '@/api';
import { DateInput } from '@/components/forms/DateInput';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageTitle } from '@/components/ui/PageTitle';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs } from '@/components/ui/Tabs';
import { TextInput } from '@/components/ui/TextInput';
import { PATHS } from '@/constants/routes';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { PartialViewHint } from '@/components/sync/PartialViewHint';
import { useApi } from '@/hooks/useApi';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { DayNavigator, EntryCard, ET } from '@/pages/entries';
import {
  addDays,
  addMonths,
  diffDays,
  formatHebrewDate,
  formatMonthYear,
  formatShortDate,
  isValidIsoDate,
  monthEnd,
  monthName,
  monthStart,
  relativeDayLabel,
  todayIso,
  weekStart,
  yearMonth,
} from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { formatDecimal } from '@/utils/format';

export type DiaryViewMode = 'day' | 'week' | 'month' | 'year';

export const DIARY_VIEW_KEY = 'mpd.diary.view';
/** Page size requested from the server (its maximum). */
export const DIARY_PAGE_SIZE = 500;
/** Delay before a typed text filter is applied. */
export const TEXT_FILTER_DEBOUNCE_MS = 300;

const VIEW_MODES: DiaryViewMode[] = ['day', 'week', 'month', 'year'];

/** Tab label of a view mode in the current UI language. */
function viewLabel(mode: DiaryViewMode): string {
  switch (mode) {
    case 'day':
      return ET.viewDay;
    case 'week':
      return ET.viewWeek;
    case 'month':
      return ET.viewMonth;
    case 'year':
      return ET.viewYear;
  }
}

export function isDiaryViewMode(v: unknown): v is DiaryViewMode {
  return typeof v === 'string' && (VIEW_MODES as string[]).includes(v);
}

export interface DiaryRange {
  from: string;
  to: string;
  /** Description of the range in the current UI language (announced by the navigator). */
  label: string;
}

/** Inclusive range and label for a view mode around an anchor date. */
export function diaryRange(mode: DiaryViewMode, anchor: string, firstDayOfWeek: 0 | 1): DiaryRange {
  switch (mode) {
    case 'day': {
      const heading = dayHeading(anchor);
      return { from: anchor, to: anchor, label: heading.relative ? ET.dayWithRelative(heading.main, heading.relative) : heading.main };
    }
    case 'week': {
      const from = weekStart(anchor, firstDayOfWeek);
      const to = addDays(from, 6);
      return { from, to, label: ET.weekRange(formatShortDate(from), formatShortDate(to)) };
    }
    case 'month': {
      const { year, month } = yearMonth(anchor);
      return { from: monthStart(anchor), to: monthEnd(anchor), label: formatMonthYear(year, month) };
    }
    case 'year': {
      const year = Number(anchor.slice(0, 4));
      return { from: `${year}-01-01`, to: `${year}-12-31`, label: ET.yearLabel(year) };
    }
  }
}

/** Anchor date after moving one step (day / week / month / year) in a direction. */
export function shiftAnchor(mode: DiaryViewMode, anchor: string, step: 1 | -1): string {
  switch (mode) {
    case 'day':
      return addDays(anchor, step);
    case 'week':
      return addDays(anchor, 7 * step);
    case 'month':
      return addMonths(anchor, step);
    case 'year':
      return addMonths(anchor, 12 * step);
  }
}

/** Heading text of a day group: the full date plus a relative label when close to today. */
export function dayHeading(date: string, today: string = todayIso()): { main: string; relative: string | null } {
  const near = Math.abs(diffDays(date, today)) <= 14;
  return { main: formatHebrewDate(date), relative: near ? relativeDayLabel(date, today) : null };
}

/** Groups summaries by date (ascending), items ordered by time then id. */
export function groupByDay(items: EntrySummary[]): { date: string; items: EntrySummary[] }[] {
  const map = new Map<string, EntrySummary[]>();
  for (const item of items) {
    const list = map.get(item.date);
    if (list) list.push(item);
    else map.set(item.date, [item]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, list]) => ({
      date,
      items: [...list].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.id - b.id)),
    }));
}

export interface MonthSummary {
  month: number;
  entries: number;
  /** Mean of the daily mean moods (null when no day reported a mood). */
  mood: number | null;
}

/** Per-month entry counts and mean mood for a year, from calendar range days. */
export function monthSummaries(days: CalendarDay[], year: number): MonthSummary[] {
  const out: MonthSummary[] = [];
  for (let month = 1; month <= 12; month++) {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    const inMonth = days.filter((d) => d.date.startsWith(prefix));
    const entries = inMonth.reduce((sum, d) => sum + d.entryCount, 0);
    const moods = inMonth.map((d) => d.mood).filter((m): m is number => m !== null && Number.isFinite(m));
    const mood = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
    out.push({ month, entries, mood });
  }
  return out;
}

export default function DiaryPage() {
  const { settings } = useSettings();
  const { announce } = useAnnouncer();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tag = searchParams.get('tag') ?? '';

  const [mode, setMode] = useLocalStorageState<DiaryViewMode>(DIARY_VIEW_KEY, 'week', isDiaryViewMode);
  const [anchor, setAnchor] = useState<string>(() => {
    const fromQuery = searchParams.get('date');
    return fromQuery && isValidIsoDate(fromQuery) ? fromQuery : todayIso();
  });
  const [textInput, setTextInput] = useState('');
  const [text, setText] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  /** Entry whose "Open" link takes focus after "Load more" rendered it. */
  const focusEntryAfterLoad = useRef<number | null>(null);
  /** Set when a month of the year table was opened: the selected tab takes focus. */
  const focusTabAfterOpen = useRef(false);

  // Debounce the text filter so every keystroke does not hit the server.
  useEffect(() => {
    const timer = window.setTimeout(() => setText(textInput.trim()), TEXT_FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [textInput]);

  const range = useMemo(() => diaryRange(mode, anchor, settings.firstDayOfWeek), [mode, anchor, settings.firstDayOfWeek]);
  const listMode = mode !== 'year';
  const filter: EntryFilter = {
    from: range.from,
    to: range.to,
    text: text || undefined,
    tag: tag || undefined,
    limit: DIARY_PAGE_SIZE,
    sortDesc: false,
  };

  // A text / tag filter changes the list silently: say how many entries match once the new list arrived.
  const filterKey = `${text}\n${tag}`;
  const announcedFilter = useRef(filterKey);
  const list = useApi(() => entriesApi.list(filter), [range.from, range.to, text, tag, listMode], {
    enabled: listMode,
    offline: true,
    onSuccess: (page) => {
      if (announcedFilter.current === filterKey) return;
      announcedFilter.current = filterKey;
      const empty = text || tag ? ET.noEntriesFiltered : ET.noEntriesTitle;
      announce(page.items.length === 0 ? empty : ET.resultsCount(page.items.length, page.total), 'polite');
    },
  });
  const yearDays = useApi(() => calendarApi.range(range.from, range.to), [range.from, range.to, listMode], { enabled: !listMode, offline: true });
  const tagsLoad = useApi(() => entriesApi.tags(), [], { offline: true });

  const setTag = (value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set('tag', value);
        else next.delete('tag');
        return next;
      },
      { replace: true },
    );
  };

  const tagOptions: SelectOption[] = useMemo(() => {
    const known = tagsLoad.data ?? [];
    const options: SelectOption[] = [{ value: '', label: ET.allTags }, ...known.map((t) => ({ value: t.name, label: ET.tagOption(t.name, t.count) }))];
    if (tag && !known.some((t) => t.name === tag)) options.push({ value: tag, label: tag });
    return options;
  }, [tagsLoad.data, tag]);

  const loadMore = async () => {
    const current = list.data;
    if (!current || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await entriesApi.list({ ...filter, offset: current.items.length });
      // Continue where the new entries start (the button itself disappears after the last page).
      focusEntryAfterLoad.current = page.items[0]?.id ?? null;
      list.setData((prev) => (prev ? { items: [...prev.items, ...page.items], total: page.total } : page));
      announce(ET.loadedMore(page.items.length), 'polite');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const openMonth = (month: number) => {
    const year = Number(anchor.slice(0, 4));
    setAnchor(`${year}-${String(month).padStart(2, '0')}-01`);
    setMode('month');
    // The year table (and the button just pressed) goes away: land on the "Month" tab instead of <body>.
    focusTabAfterOpen.current = true;
  };

  // Focus moves once the new content is rendered.
  useEffect(() => {
    const id = focusEntryAfterLoad.current;
    if (id === null) return;
    focusEntryAfterLoad.current = null;
    document.querySelector<HTMLElement>(`[aria-labelledby="entry-card-${id}-title"] a`)?.focus();
  }, [list.data]);
  useEffect(() => {
    if (!focusTabAfterOpen.current) return;
    focusTabAfterOpen.current = false;
    document.querySelector<HTMLElement>('.tabs [role="tab"][aria-selected="true"]')?.focus();
  }, [mode]);

  const filtered = Boolean(text || tag);
  const groups = list.data ? groupByDay(list.data.items) : [];
  const summaries = yearDays.data ? monthSummaries(yearDays.data, Number(anchor.slice(0, 4))) : [];

  const toolbar = (
    <>
      <DayNavigator
        label={range.label}
        onPrevious={() => setAnchor((a) => shiftAnchor(mode, a, -1))}
        onNext={() => setAnchor((a) => shiftAnchor(mode, a, 1))}
        onToday={() => setAnchor(todayIso())}
      />
      <div className="diary-toolbar">
        <DateInput
          id="diary-date"
          label={ET.goToDate}
          value={anchor}
          onChange={(v) => {
            if (isValidIsoDate(v)) setAnchor(v);
          }}
        />
        <Field id="diary-text" label={ET.textFilter} hint={ET.textFilterHint}>
          {(a11y) => <TextInput {...a11y} type="search" value={textInput} onChange={(e) => setTextInput(e.currentTarget.value)} autoComplete="off" />}
        </Field>
        <Select id="diary-tag" label={ET.tagFilter} options={tagOptions} value={tag} onChange={setTag} />
      </div>
      {!listMode && filtered && <p className="text-muted timeline__status">{ET.yearFilterNote}</p>}
    </>
  );

  const listView = (
    <>
      {list.loading && <Spinner block={!list.data} />}
      {list.error && (
        <Alert kind="error">
          <p>{list.error}</p>
          <Button variant="secondary" size="sm" onClick={() => void list.reload()}>
            {T.retry}
          </Button>
        </Alert>
      )}
      {list.data && list.data.items.length === 0 && !list.loading && (
        <EmptyState
          title={ET.noEntriesTitle}
          text={filtered ? ET.noEntriesFiltered : ET.noEntriesText}
          action={<LinkButton to={PATHS.newEntry}>{ET.newEntry}</LinkButton>}
        />
      )}
      {listMode && <PartialViewHint value={list.data} />}
      {list.data && list.data.items.length > 0 && (
        <>
          <p className="timeline__status">{ET.resultsCount(list.data.items.length, list.data.total)}</p>
          <div className="timeline">
            {groups.map((group) => {
              const heading = dayHeading(group.date);
              const headingId = `diary-day-${group.date}`;
              return (
                <section key={group.date} aria-labelledby={headingId}>
                  {/* h2 per day, h3 per entry: no level is skipped under the page's h1. */}
                  <h2 id={headingId} className="timeline__heading">
                    <Link to={PATHS.day(group.date)}>{heading.main}</Link>
                    {heading.relative && <span className="timeline__relative"> · {heading.relative}</span>}
                  </h2>
                  <ul className="entry-list">
                    {group.items.map((entry) => (
                      <li key={entry.id}>
                        <EntryCard entry={entry} headingLevel="h3" />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
          {list.data.total > list.data.items.length && (
            <div className="cluster timeline__more">
              <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
                {ET.loadMore}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );

  const yearView = (
    <>
      {yearDays.loading && <Spinner block={!yearDays.data} />}
      {yearDays.error && (
        <Alert kind="error">
          <p>{yearDays.error}</p>
          <Button variant="secondary" size="sm" onClick={() => void yearDays.reload()}>
            {T.retry}
          </Button>
        </Alert>
      )}
      {yearDays.data && (
        <table className="month-table">
          <caption className="visually-hidden">{range.label}</caption>
          <thead>
            <tr>
              <th scope="col">{ET.monthColumn}</th>
              <th scope="col">{ET.entriesColumn}</th>
              <th scope="col">{ET.moodColumn}</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.month}>
                <th scope="row">
                  <button type="button" className="btn-link" onClick={() => openMonth(s.month)} aria-label={ET.openMonth(monthName(s.month))}>
                    {monthName(s.month)}
                  </button>
                </th>
                <td>{ET.entriesCount(s.entries)}</td>
                <td>{formatDecimal(s.mood)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );

  const panel = (
    <>
      {toolbar}
      {listMode ? listView : yearView}
    </>
  );

  return (
    <>
      <PageTitle title={ET.diaryTitle} actions={<LinkButton to={PATHS.newEntry}>{ET.newEntry}</LinkButton>} />
      <Tabs
        label={ET.viewLabel}
        value={mode}
        onChange={(id) => {
          if (isDiaryViewMode(id)) setMode(id);
        }}
        tabs={VIEW_MODES.map((m) => ({ id: m, label: viewLabel(m), panel }))}
      />
    </>
  );
}
