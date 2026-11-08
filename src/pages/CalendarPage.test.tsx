import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { traditionLabel } from '@shared/calendars';
import { monthViewContaining, monthViewFor } from '@shared/calendars/month-view';
import type { AppSettings, CalendarDay, CalendarMonth } from '@shared/types';
import * as api from '@/api';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { CX, ET } from '@/pages/entries';
import { LocationDisplay, currentPath, politeRegion, renderWithProviders } from '@/test/render';
import { daysInMonth, todayIso } from '@/utils/dates';
import CalendarPage, {
  buildWeeks,
  CALENDAR_SYSTEM_KEY,
  civilDayMonthLabel,
  dayAriaLabel,
  mergeViewDays,
  moodLevel,
  resolveView,
  sameDayInAdjacentMonth,
  viewAnnouncement,
  viewSearchParams,
  yearOptionsFor,
} from './CalendarPage';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

// Month switches re-render a 30-button grid several times per test; under the
// full parallel suite the 5s default is too tight.
vi.setConfig({ testTimeout: 20_000 });

// The captions, accessible names and cell texts below are asserted in Hebrew.
pinLocaleForTests('he');

const pad = (n: number) => String(n).padStart(2, '0');

function monthData(year: number, month: number, overrides: Record<string, Partial<CalendarDay>> = {}): CalendarMonth {
  const days: CalendarDay[] = Array.from({ length: daysInMonth(year, month) }, (_, i) => {
    const date = `${year}-${pad(month)}-${pad(i + 1)}`;
    return {
      date,
      mood: null,
      energy: null,
      stress: null,
      sleepHours: null,
      hasEntry: false,
      entryCount: 0,
      habitsCompleted: 0,
      habitsTotal: 0,
      titles: [],
      ...overrides[date],
    };
  });
  return { year, month, days };
}

/** Days with data in the test diary (the month endpoint reports every day, the range endpoint only these). */
const DATA: Record<string, Partial<CalendarDay>> = {
  '2026-09-07': { mood: 7, energy: 6, hasEntry: true, entryCount: 1, habitsCompleted: 3, habitsTotal: 5, titles: ['בוקר'] },
  '2026-09-08': { mood: 2, hasEntry: true, entryCount: 2 },
  '2026-09-12': { mood: 7, hasEntry: true, entryCount: 1 },
};

/** What /api/calendar/range returns: only the days with data inside [from, to]. */
function rangeData(from: string, to: string): CalendarDay[] {
  return Object.keys(DATA)
    .filter((date) => date >= from && date <= to)
    .sort()
    .map((date) => ({ ...monthData(Number(date.slice(0, 4)), Number(date.slice(5, 7)), DATA).days.find((d) => d.date === date)! }));
}

function renderPage(route: string, settings?: Partial<AppSettings>) {
  return renderWithProviders(
    <Routes>
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="*" element={<LocationDisplay />} />
    </Routes>,
    { auth: 'authenticated', route, settings },
  );
}

function grid(): HTMLElement {
  return screen.getByText('ספטמבר 2026', { selector: 'caption' }).closest('table') as HTMLElement;
}

/** The line under the page title with the month's span in the other two calendars. */
function spans(): HTMLElement {
  return screen.getByTestId('calendar-spans');
}

describe('CalendarPage helpers', () => {
  it('builds the accessible label of a day', () => {
    const day: CalendarDay = {
      date: '2026-09-07',
      mood: 7,
      energy: 6,
      stress: 2,
      sleepHours: 7,
      hasEntry: true,
      entryCount: 1,
      habitsCompleted: 3,
      habitsTotal: 5,
      titles: ['בוקר'],
    };
    expect(dayAriaLabel(day, '2026-09-23')).toBe('יום שני 7 בספטמבר: מצב רוח 7, אנרגיה 6, 3 מתוך 5 הרגלים הושלמו, יש רשומה');
    expect(dayAriaLabel({ ...day, mood: null, energy: null, hasEntry: false, entryCount: 0, habitsTotal: 0 }, '2026-09-23')).toBe('יום שני 7 בספטמבר: אין נתונים');
    expect(dayAriaLabel({ ...day, entryCount: 3 }, '2026-09-07')).toBe('היום, יום שני 7 בספטמבר: מצב רוח 7, אנרגיה 6, 3 מתוך 5 הרגלים הושלמו, 3 רשומות');
    // The holidays of the selected calendar are read right after the date.
    expect(dayAriaLabel({ ...day, date: '2026-09-12', energy: null, habitsTotal: 0 }, '2026-09-23', 'ראש השנה (יום 1 מתוך 2)')).toBe(
      'יום שבת 12 בספטמבר: ראש השנה (יום 1 מתוך 2), מצב רוח 7, יש רשומה',
    );
    expect(dayAriaLabel({ ...day, mood: null, energy: null, hasEntry: false, entryCount: 0, habitsTotal: 0 }, '2026-09-23', 'זיארת נבי סבלאן')).toBe(
      'יום שני 7 בספטמבר: זיארת נבי סבלאן, אין נתונים',
    );
    const tishrei = monthViewContaining('hebrew', '2026-09-12', 'he');
    expect(viewAnnouncement(tishrei, ['משפט ראשון', 'משפט שני'])).toBe('משפט ראשון · משפט שני');
    expect(viewAnnouncement(tishrei, [])).toBe('תשרי תשפ״ז');
  });

  it('builds the accessible label of a day in English when the UI language is English', () => {
    setCurrentLocale('en');
    const day: CalendarDay = { ...monthData(2026, 9, DATA).days[6] };
    expect(civilDayMonthLabel('2026-09-07')).toBe('7 September');
    expect(dayAriaLabel(day, '2026-09-23')).toBe('Monday 7 September: Mood 7, Energy 6, 3 of 5 habits completed, has an entry');
    expect(dayAriaLabel({ ...day, entryCount: 3 }, '2026-09-07', 'Ziyarat Nabi Sablan')).toBe(
      'Today, Monday 7 September: Ziyarat Nabi Sablan, Mood 7, Energy 6, 3 of 5 habits completed, 3 entries',
    );
    expect(dayAriaLabel({ ...day, mood: null, energy: null, hasEntry: false, entryCount: 0, habitsTotal: 0 }, '2026-09-23')).toBe('Monday 7 September: no data');
    expect(dayAriaLabel({ ...day, date: '2026-09-12' }, '2026-09-23', 'Rosh Hashanah (day 1 of 2)', '1 Tishri 5787')).toBe(
      'Saturday 1 Tishri 5787: Rosh Hashanah (day 1 of 2), Mood 7, Energy 6, 3 of 5 habits completed, has an entry',
    );
    expect(ET.entryMarker(1)).toBe('● 1 entry');
    expect(ET.entryMarker(3)).toBe('● 3 entries');
    expect(ET.habitsCell(3, 5)).toBe('Habits 3/5');
    expect(ET.systemUnsupportedOption(ET.systemLabel('hijri'))).toBe('Hijri (Islamic) (not supported in this browser)');
  });

  it('lays out weeks with padding according to the first day of the week', () => {
    const days = monthData(2026, 9).days;
    const sunday = buildWeeks(days, 0);
    expect(sunday[0].slice(0, 3).map((d) => d?.date ?? null)).toEqual([null, null, '2026-09-01']);
    expect(sunday.every((w) => w.length === 7)).toBe(true);
    const monday = buildWeeks(days, 1);
    expect(monday[0][0]).toBeNull();
    expect(monday[0][1]?.date).toBe('2026-09-01');
    expect(moodLevel(2)).toBe('low');
    expect(moodLevel(5)).toBe('mid');
    expect(moodLevel(8)).toBe('high');
    expect(moodLevel(null)).toBeNull();
  });

  it('reads the selected system first in the accessible label of a day', () => {
    const day: CalendarDay = { ...monthData(2026, 9, DATA).days[11] };
    expect(dayAriaLabel(day, '2026-09-23', 'ראש השנה (יום 1 מתוך 2)', 'א׳ בתשרי תשפ״ז')).toBe(
      'יום שבת א׳ בתשרי תשפ״ז: ראש השנה (יום 1 מתוך 2), מצב רוח 7, יש רשומה',
    );
    expect(dayAriaLabel(day, '2026-09-12', '', '1 ברביע א-ת׳אני 1448')).toBe('היום, יום שבת 1 ברביע א-ת׳אני 1448: מצב רוח 7, יש רשומה');
  });

  it('maps a view to query-string parameters and back', () => {
    expect(viewSearchParams(monthViewContaining('gregorian', '2026-09-15', 'he'))).toEqual({ year: '2026', month: '9' });
    expect(viewSearchParams(monthViewContaining('hebrew', '2026-09-12', 'he'))).toEqual({ system: 'hebrew', year: '5787', month: '1' });
    expect(viewSearchParams(monthViewContaining('hijri', '2026-02-18', 'he'))).toEqual({ system: 'hijri', year: '1447', month: '9' });

    const today = '2026-09-26';
    expect(resolveView('hebrew', '5787', '1', today).firstDay).toBe('2026-09-12');
    expect(resolveView('hijri', '1447', '9', today).firstDay).toBe('2026-02-18');
    expect(resolveView('gregorian', '2026', '9', today)).toBe(monthViewContaining('gregorian', '2026-09-01', 'he'));
    // The view is built in the requested language (memoised per language).
    expect(resolveView('gregorian', '2026', '9', today, 'en')).toBe(monthViewContaining('gregorian', '2026-09-01', 'en'));
    expect(resolveView('hebrew', '5787', '1', today, 'en').title).toBe('Tishri 5787');
    // No / bad parameters: the month containing today in that system.
    expect(resolveView('hebrew', null, null, today)).toBe(monthViewContaining('hebrew', today, 'he'));
    expect(resolveView('hijri', 'abc', '9', today).year).toBe(monthViewContaining('hijri', today, 'he').year);
    expect(resolveView('hijri', '1447', '13', today)).toBe(monthViewFor('hijri', 1447, monthViewContaining('hijri', today, 'he').monthIndex, 'he'));
    // A 13th Hebrew month only exists in leap years; 5786 is not one.
    expect(resolveView('hebrew', '5786', '13', today).year).toBe(5786);
    expect(resolveView('hebrew', '5786', '13', today).monthIndex).toBeLessThanOrEqual(12);
    // Years are clamped into the server's range.
    expect(resolveView('gregorian', '1900', '2', today)).toMatchObject({ year: 1970, monthIndex: 2 });
    expect(resolveView('hebrew', '5000', '1', today).year).toBe(5731);
  });

  it('offers the year ranges of each system, always including the visible year', () => {
    const gregorian = yearOptionsFor('gregorian', 2026, 2026);
    expect(gregorian[0].value).toBe('1980');
    expect(gregorian[gregorian.length - 1].value).toBe('2036');
    expect(yearOptionsFor('gregorian', 1975, 2026)[0].value).toBe('1975');
    const hebrew = yearOptionsFor('hebrew', 5787, 5787);
    expect(hebrew).toHaveLength(80);
    expect(hebrew[0]).toEqual({ value: '5731', label: 'תשל״א (5731)' });
    expect(hebrew.find((o) => o.value === '5787')?.label).toBe('תשפ״ז (5787)');
    // Other languages read Hebrew years as digits.
    expect(yearOptionsFor('hebrew', 5787, 5787, 'en').find((o) => o.value === '5787')).toEqual({ value: '5787', label: '5787' });
    const hijri = yearOptionsFor('hijri', 1480, 1448);
    expect(hijri[0].value).toBe('1408');
    expect(hijri[hijri.length - 1]).toEqual({ value: '1480', label: '1480' });
  });

  it('fills the days the range endpoint left out, carrying the habit total to past days only', () => {
    const tishrei = monthViewContaining('hebrew', '2026-09-12', 'he');
    const cells = mergeViewDays(tishrei, rangeData(tishrei.firstDay, tishrei.lastDay), '2026-09-26');
    expect(cells).toHaveLength(30);
    expect(cells[0]).toMatchObject({ date: '2026-09-12', label: 'א׳', number: 1, data: { mood: 7, hasEntry: true } });
    expect(cells[1].data).toMatchObject({ date: '2026-09-13', mood: null, hasEntry: false, habitsTotal: 0 });
    // With a reported habit total, the empty past days get it and the future days do not.
    const withHabits = mergeViewDays(tishrei, [{ ...cells[0].data, habitsTotal: 5, habitsCompleted: 2 }], '2026-09-26');
    expect(withHabits[1].data.habitsTotal).toBe(5);
    expect(withHabits[14].data).toMatchObject({ date: '2026-09-26', habitsTotal: 5 });
    expect(withHabits[15].data).toMatchObject({ date: '2026-09-27', habitsTotal: 0 });
    expect(sameDayInAdjacentMonth(tishrei, '2026-10-11', -1)).toBe('2026-09-11'); // 30 Tishrei -> 29 Elul (29 days)
    expect(sameDayInAdjacentMonth(tishrei, '2026-09-14', 1)).toBe('2026-10-14'); // 3 Tishrei -> 3 Cheshvan
  });
});

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.calendar.month).mockImplementation(async (year: number, month: number) => monthData(year, month, DATA));
    vi.mocked(api.calendar.range).mockImplementation(async (from: string, to: string) => rangeData(from, to));
  });

  it('renders 30 day buttons for September 2026 with descriptive aria-labels and the other calendars above the table', async () => {
    renderPage('/calendar?year=2026&month=9');
    expect(screen.getByRole('heading', { level: 1, name: ET.calendarTitle })).toBeInTheDocument();
    await screen.findByText('ספטמבר 2026', { selector: 'caption' });
    expect(api.calendar.month).toHaveBeenCalledWith(2026, 9);

    const table = grid();
    expect(within(table).getAllByRole('button')).toHaveLength(30);
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']);

    const day7 = screen.getByRole('button', { name: 'יום שני 7 בספטמבר: מצב רוח 7, אנרגיה 6, 3 מתוך 5 הרגלים הושלמו, יש רשומה' });
    expect(day7).toHaveTextContent('7');
    expect(day7).toHaveTextContent('מ"ר 7 · אנ 6');
    expect(day7).toHaveTextContent('הרגלים 3/5');
    expect(day7).toHaveTextContent('● רשומה');
    expect(day7).toHaveAttribute('data-mood-level', 'high');

    const day8 = screen.getByRole('button', { name: 'יום שלישי 8 בספטמבר: מצב רוח 2, 2 רשומות' });
    expect(day8).toHaveAttribute('data-mood-level', 'low');
    expect(screen.getByRole('button', { name: 'יום שלישי 1 בספטמבר: אין נתונים' })).toBeInTheDocument();
    // Rosh Hashana is a Jewish holiday: the Gregorian calendar does not show it, in the cell or in the name.
    expect(screen.getByRole('button', { name: 'יום שבת 12 בספטמבר: מצב רוח 7, יש רשומה' })).toBeInTheDocument();
    expect(within(table).queryByText('ראש השנה')).toBeNull();
    expect(table.querySelector('.holiday-badge')).toBeNull();

    // Exactly one tab stop in the grid (roving tabindex).
    const stops = within(table)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
    expect(screen.getByRole('combobox', { name: ET.monthSelect })).toHaveValue('9');
    expect(screen.getByRole('combobox', { name: ET.yearSelect })).toHaveValue('2026');
    expect(screen.getByText(ET.legend)).toBeInTheDocument();
    expect(screen.getByText(ET.systemLegend(ET.systemLabels.gregorian))).toBeInTheDocument();

    // The caption is the month alone; the other two calendars are spelled out above the table, not inside the cells.
    expect(table.querySelector('caption')).toHaveTextContent(/^ספטמבר 2026$/);
    expect(spans()).toHaveTextContent(
      'חודש ספטמבר 2026 בלוח העברי: מ-י״ט באלול תשפ״ו עד י״ט בתשרי תשפ״ז · בלוח המוסלמי: מ-19 ברביע אל-אוול 1448 עד 19 ברביע א-ת׳אני 1448',
    );
    expect(spans().compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(table.textContent).not.toContain('תשפ״ו');
    expect(table.textContent).not.toContain('1448');

    // Legend: only the Christian tradition belongs to the Gregorian calendar; no Umm al-Qura note.
    const legend = screen.getByRole('region', { name: CX.legendTitle });
    expect(within(legend).getByText(traditionLabel('christian', 'he'))).toBeInTheDocument();
    expect(within(legend).queryByText(traditionLabel('jewish', 'he'))).toBeNull();
    expect(screen.queryByText(CX.hijriNote)).not.toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('a Gregorian month shows only the Christian holidays (Ash Wednesday, not Rosh Chodesh Adar or the start of Ramadan)', async () => {
    renderPage('/calendar?year=2026&month=2');
    const caption = await screen.findByText('פברואר 2026', { selector: 'caption' });
    const table = caption.closest('table') as HTMLElement;
    expect(within(table).getAllByRole('button')).toHaveLength(28);
    const day18 = screen.getByRole('button', { name: 'יום רביעי 18 בפברואר: יום רביעי של האפר, אין נתונים' });
    const badge = within(day18).getByText('יום רביעי של האפר').closest('.holiday-badge') as HTMLElement;
    expect(badge).toHaveAttribute('data-tradition', 'christian');
    expect(badge).toHaveAttribute('title', 'יום רביעי של האפר (נוצרי)');
    expect(badge).toHaveTextContent('✝');
    expect(within(day18).queryByText('תחילת רמדאן')).toBeNull();
    expect(within(day18).queryByText(/ראש חודש/)).toBeNull();
    expect(table.querySelector('.holiday-badge[data-tradition]:not([data-tradition="christian"])')).toBeNull();
    expect(spans()).toHaveTextContent('חודש פברואר 2026 בלוח העברי: מ-י״ד בשבט תשפ״ו עד י״א באדר תשפ״ו · בלוח המוסלמי: מ-13 בשעבאן 1447 עד 11 ברמדאן 1447');
  });

  it('ArrowLeft moves focus to the next day, ArrowRight back, Home/End to the week edges, Enter opens the day', async () => {
    const { user } = renderPage('/calendar?year=2026&month=9');
    await screen.findByText('ספטמבר 2026', { selector: 'caption' });

    const day7 = screen.getByRole('button', { name: /^יום שני 7 בספטמבר/ });
    act(() => day7.focus());
    expect(day7).toHaveFocus();
    expect(day7).toHaveAttribute('tabindex', '0');

    await user.keyboard('{ArrowLeft}');
    const day8 = screen.getByRole('button', { name: /^יום שלישי 8 בספטמבר/ });
    expect(day8).toHaveFocus();
    expect(day8).toHaveAttribute('tabindex', '0');
    expect(day7).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{ArrowRight}');
    expect(day7).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /^יום שני 14 בספטמבר/ })).toHaveFocus();

    await user.keyboard('{Home}');
    expect(screen.getByRole('button', { name: /^יום ראשון 13 בספטמבר/ })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: /^יום שבת 19 בספטמבר/ })).toHaveFocus();

    await user.keyboard('{Enter}');
    await waitFor(() => expect(currentPath()).toBe('/day/2026-09-19'));
  });

  it('PageDown moves to the same day of the next month, keeps focus in the grid and announces the month with its spans', async () => {
    const { user } = renderPage('/calendar?year=2026&month=9');
    await screen.findByText('ספטמבר 2026', { selector: 'caption' });
    const day7 = screen.getByRole('button', { name: /^יום שני 7 בספטמבר/ });
    act(() => day7.focus());

    await user.keyboard('{PageDown}');
    await screen.findByText('אוקטובר 2026', { selector: 'caption' });
    await waitFor(() => expect(api.calendar.month).toHaveBeenCalledWith(2026, 10));
    // Same day number in the next month: 7 October 2026 is a Wednesday.
    const oct7 = await screen.findByRole('button', { name: /^יום רביעי 7 באוקטובר/ });
    await waitFor(() => expect(oct7).toHaveFocus());
    expect(oct7).toHaveAttribute('tabindex', '0');
    await waitFor(() => expect(politeRegion()).toHaveTextContent(/^חודש אוקטובר 2026 בלוח העברי: מ-כ׳ בתשרי תשפ״ז עד /));
    expect(politeRegion()).toHaveTextContent('בלוח המוסלמי:');

    // PageUp returns to September and focuses the 7th again.
    await user.keyboard('{PageUp}');
    await screen.findByText('ספטמבר 2026', { selector: 'caption' });
    await waitFor(() => expect(screen.getByRole('button', { name: /^יום שני 7 בספטמבר/ })).toHaveFocus());
  });

  it('the month buttons and selects change the month', async () => {
    const { user } = renderPage('/calendar?year=2026&month=9');
    await screen.findByText('ספטמבר 2026', { selector: 'caption' });

    await user.click(screen.getByRole('button', { name: ET.nextMonth }));
    await screen.findByText('אוקטובר 2026', { selector: 'caption' });
    await user.click(screen.getByRole('button', { name: ET.previousMonth }));
    await screen.findByText('ספטמבר 2026', { selector: 'caption' });

    await user.selectOptions(screen.getByRole('combobox', { name: ET.monthSelect }), '2');
    await screen.findByText('פברואר 2026', { selector: 'caption' });
    expect(within(screen.getByText('פברואר 2026', { selector: 'caption' }).closest('table')!).getAllByRole('button')).toHaveLength(28);
  });

  it('renders the English column headers, cell texts, spans and legend when the UI language is English', async () => {
    setCurrentLocale('en');
    renderPage('/calendar?year=2026&month=9');
    expect(screen.getByRole('heading', { level: 1, name: 'Calendar' })).toBeInTheDocument();
    const caption = await screen.findByText('September 2026', { selector: 'caption' });
    const table = caption.closest('table') as HTMLElement;
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    const day7 = screen.getByRole('button', { name: 'Monday 7 September: Mood 7, Energy 6, 3 of 5 habits completed, has an entry' });
    expect(day7).toHaveTextContent('Md 7 · En 6');
    expect(day7).toHaveTextContent('Habits 3/5');
    expect(day7).toHaveTextContent('● 1 entry');
    expect(screen.getByRole('button', { name: 'Tuesday 8 September: Mood 2, 2 entries' })).toHaveTextContent('● 2 entries');
    expect(spans()).toHaveTextContent(
      'September 2026 in the Hebrew calendar: from 19 Elul 5786 to 19 Tishri 5787 · In the Hijri calendar: from 19 Rabiʻ I 1448 to 19 Rabiʻ II 1448',
    );
    const monthSelect = screen.getByRole('combobox', { name: 'Month' });
    expect(monthSelect).toHaveValue('9');
    expect(within(monthSelect).getAllByRole('option')[8]).toHaveTextContent('September');
    expect(screen.getByRole('combobox', { name: 'Calendar' })).toHaveValue('gregorian');
    expect(within(screen.getByRole('combobox', { name: 'Calendar' })).getAllByRole('option').map((o) => o.textContent)).toEqual(['Gregorian', 'Hebrew', 'Hijri (Islamic)']);
    expect(screen.getByText(ET.legend)).toHaveTextContent(/^Legend: Md = mean mood/);
    expect(screen.getByText(/^Calendar shown: Gregorian\./)).toBeInTheDocument();
    const legend = screen.getByRole('region', { name: 'Holiday legend' });
    expect(within(legend).getByText('Christian holidays and observances')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeInTheDocument();
  });

  it('in a left-to-right language ArrowRight moves to the next day and ArrowLeft to the previous one', async () => {
    setCurrentLocale('en');
    const { user } = renderPage('/calendar?year=2026&month=9');
    await screen.findByText('September 2026', { selector: 'caption' });
    const day7 = screen.getByRole('button', { name: /^Monday 7 September/ });
    act(() => day7.focus());

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: /^Tuesday 8 September/ })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: /^Sunday 6 September/ })).toHaveFocus();
  });

  it('honours firstDayOfWeek = Monday from the settings', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/calendar" element={<CalendarPage />} />
      </Routes>,
      { auth: 'authenticated', route: '/calendar?year=2026&month=9', settings: { firstDayOfWeek: 1 } },
    );
    await screen.findByText('ספטמבר 2026', { selector: 'caption' });
    expect(within(grid()).getAllByRole('columnheader')[0]).toHaveTextContent('שני');
  });
});

describe('CalendarPage calendar systems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.calendar.month).mockImplementation(async (year: number, month: number) => monthData(year, month, DATA));
    vi.mocked(api.calendar.range).mockImplementation(async (from: string, to: string) => rangeData(from, to));
  });

  function tableOf(caption: HTMLElement): HTMLElement {
    return caption.closest('table') as HTMLElement;
  }

  it('switching to עברי lays the month out as Tishrei 5787: 30 days from 12 September, א׳ first, Jewish holidays only, the other calendars above', async () => {
    const { user } = renderPage('/calendar?year=2026&month=9');
    await screen.findByText('ספטמבר 2026', { selector: 'caption' });
    // Stand on 12 September so the Hebrew month containing it is chosen whatever today's date is.
    act(() => screen.getByRole('button', { name: /^יום שבת 12 בספטמבר/ }).focus());
    const systemSelect = screen.getByRole('combobox', { name: ET.calendarSystem });
    expect(systemSelect).toHaveValue('gregorian');
    expect(within(systemSelect).getAllByRole('option').map((o) => o.textContent)).toEqual([ET.systemLabels.gregorian, ET.systemLabels.hebrew, ET.systemLabels.hijri]);

    await user.selectOptions(systemSelect, 'hebrew');
    const caption = await screen.findByText('תשרי תשפ״ז', { selector: 'caption' });
    expect(caption).toHaveTextContent(/^תשרי תשפ״ז$/);
    expect(spans()).toHaveTextContent('חודש תשרי תשפ״ז: מ-12.09.2026 עד 11.10.2026 · בלוח המוסלמי: מ-1 ברביע א-ת׳אני 1448 עד 30 ברביע א-ת׳אני 1448');
    expect(api.calendar.range).toHaveBeenCalledWith('2026-09-12', '2026-10-11');
    await waitFor(() => expect(politeRegion()).toHaveTextContent('חודש תשרי תשפ״ז: מ-12.09.2026 עד 11.10.2026 · בלוח המוסלמי: מ-1 ברביע א-ת׳אני 1448'));

    const table = tableOf(caption);
    const buttons = within(table).getAllByRole('button');
    expect(buttons).toHaveLength(30);
    expect(buttons[0]).toHaveAttribute('data-date', '2026-09-12');
    expect(buttons[0].querySelector('.calendar__num')).toHaveTextContent(/^א׳$/);
    expect(buttons[14].querySelector('.calendar__num')).toHaveTextContent(/^ט״ו$/);
    expect(buttons[29].querySelector('.calendar__num')).toHaveTextContent(/^ל׳$/);
    expect(buttons[29]).toHaveAttribute('data-date', '2026-10-11');
    // Accessible name: the Hebrew date first, then the holiday and the data; no other calendar's date anywhere in the cell.
    expect(buttons[0]).toHaveAccessibleName('יום שבת א׳ בתשרי תשפ״ז: ראש השנה (יום 1 מתוך 2), מצב רוח 7, יש רשומה');
    expect(buttons[0]).toHaveTextContent('● רשומה');
    expect(buttons[0].textContent).not.toContain('12');
    expect(buttons[0].textContent).not.toContain('1448');
    expect(within(buttons[0]).getByText('ראש השנה').closest('.holiday-badge')).toHaveAttribute('data-tradition', 'jewish');
    expect(table.querySelector('.calendar__alt')).toBeNull();
    expect(table.querySelector('.holiday-badge[data-tradition]:not([data-tradition="jewish"])')).toBeNull();
    // A day the range endpoint did not report is an empty day.
    expect(buttons[1]).toHaveAccessibleName('יום ראשון ב׳ בתשרי תשפ״ז: ראש השנה (יום 2 מתוך 2), אין נתונים');
    expect(within(table).getByText('יום כיפור').closest('button')).toHaveAttribute('data-date', '2026-09-21');
    // Exactly one tab stop, on the day the user stood on.
    const stops = buttons.filter((b) => b.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAttribute('data-date', '2026-09-12');

    // Selects follow the system: 13 Hebrew months (a leap year) with Tishrei = 1, Hebrew year numerals.
    const monthSelect = screen.getByRole('combobox', { name: ET.monthSelect });
    expect(monthSelect).toHaveValue('1');
    const monthOptions = within(monthSelect).getAllByRole('option');
    expect(monthOptions).toHaveLength(13);
    expect(monthOptions.map((o) => o.textContent).slice(5, 8)).toEqual(['אדר א׳', 'אדר ב׳', 'ניסן']);
    const yearSelect = screen.getByRole('combobox', { name: ET.yearSelect });
    expect(yearSelect).toHaveValue('5787');
    expect(within(yearSelect).getByRole('option', { name: 'תשפ״ז (5787)' })).toBeInTheDocument();
    expect(window.localStorage.getItem(CALENDAR_SYSTEM_KEY)).toBe('"hebrew"');

    // Legend: the Jewish tradition only; the Umm al-Qura note belongs to the Hijri calendar.
    const legend = screen.getByRole('region', { name: CX.legendTitle });
    expect(within(legend).getByText(traditionLabel('jewish', 'he'))).toBeInTheDocument();
    expect(within(legend).queryByText(traditionLabel('muslim', 'he'))).toBeNull();
    expect(within(legend).queryByText(traditionLabel('christian', 'he'))).toBeNull();
    expect(within(legend).queryByText(CX.hijriNote)).toBeNull();
    expect(screen.getByText(ET.systemLegend(ET.systemLabels.hebrew))).toBeInTheDocument();

    // "Next month" moves a Hebrew month; switching back to לועזי shows the civil month of the day the user is on.
    await user.click(screen.getByRole('button', { name: ET.nextMonth }));
    await screen.findByText('חשוון תשפ״ז', { selector: 'caption' });
    expect(api.calendar.range).toHaveBeenLastCalledWith('2026-10-12', expect.stringMatching(/^2026-11-(09|10)$/));
    act(() => screen.getByRole('button', { name: /^יום שלישי ט׳ בחשוון תשפ״ז/ }).focus());
    await user.selectOptions(screen.getByRole('combobox', { name: ET.calendarSystem }), 'gregorian');
    await screen.findByText('אוקטובר 2026', { selector: 'caption' });
    expect(api.calendar.month).toHaveBeenCalledWith(2026, 10);
    expect(screen.getByRole('button', { name: /^יום שלישי 20 באוקטובר/ })).toHaveAttribute('tabindex', '0');
    expect(window.localStorage.getItem(CALENDAR_SYSTEM_KEY)).toBe('"gregorian"');
  });

  it('a הג׳רי link renders Ramadan 1447 from 18 February 2026 with Muslim and Druze holidays only', async () => {
    renderPage('/calendar?system=hijri&year=1447&month=9');
    const caption = await screen.findByText('רמדאן 1447', { selector: 'caption' });
    const ramadan = monthViewContaining('hijri', '2026-02-18', 'he');
    expect(caption).toHaveTextContent(/^רמדאן 1447$/);
    expect(spans()).toHaveTextContent('חודש רמדאן 1447: מ-18.02.2026 עד 19.03.2026 · בלוח העברי: מ-א׳ באדר תשפ״ו עד א׳ בניסן תשפ״ו');
    expect(api.calendar.range).toHaveBeenCalledWith('2026-02-18', ramadan.lastDay);

    const table = tableOf(caption);
    const buttons = within(table).getAllByRole('button');
    expect(buttons).toHaveLength(ramadan.length);
    expect(buttons[0]).toHaveAttribute('data-date', '2026-02-18');
    expect(buttons[0].querySelector('.calendar__num')).toHaveTextContent(/^1$/);
    expect(buttons[buttons.length - 1].querySelector('.calendar__num')).toHaveTextContent(String(ramadan.length));
    // 18 February 2026 is also Rosh Chodesh Adar and Ash Wednesday: neither belongs to the Hijri calendar.
    expect(buttons[0]).toHaveAccessibleName('יום רביעי 1 ברמדאן 1447: תחילת רמדאן, אין נתונים');
    expect(buttons[0].textContent).not.toContain('18');
    expect(within(buttons[0]).getByText('תחילת רמדאן').closest('.holiday-badge')).toHaveAttribute('data-tradition', 'muslim');
    expect(within(buttons[0]).queryByText('יום רביעי של האפר')).toBeNull();
    expect(within(table).queryByText('פורים')).toBeNull(); // 3 March 2026, a Jewish holiday
    expect(table.querySelector('.holiday-badge[data-tradition="jewish"], .holiday-badge[data-tradition="christian"]')).toBeNull();
    expect(table.querySelector('.calendar__alt')).toBeNull();

    expect(screen.getByRole('combobox', { name: ET.calendarSystem })).toHaveValue('hijri');
    const monthSelect = screen.getByRole('combobox', { name: ET.monthSelect });
    expect(monthSelect).toHaveValue('9');
    expect(within(monthSelect).getAllByRole('option')).toHaveLength(12);
    expect(within(monthSelect).getAllByRole('option')[8]).toHaveTextContent('רמדאן');
    expect(screen.getByRole('combobox', { name: ET.yearSelect })).toHaveValue('1447');

    const legend = screen.getByRole('region', { name: CX.legendTitle });
    expect(within(legend).getByText(traditionLabel('muslim', 'he'))).toBeInTheDocument();
    expect(within(legend).getByText(traditionLabel('druze', 'he'))).toBeInTheDocument();
    expect(within(legend).queryByText(traditionLabel('jewish', 'he'))).toBeNull();
    expect(within(legend).getByText(CX.hijriNote)).toBeInTheDocument();
    expect(screen.getByText(ET.systemLegend(ET.systemLabels.hijri))).toBeInTheDocument();
  });

  it('arrow keys cross a Hebrew month boundary, Home clamps to the month and PageUp/PageDown keep the day number', async () => {
    const { user } = renderPage('/calendar?system=hebrew&year=5787&month=1');
    await screen.findByText('תשרי תשפ״ז', { selector: 'caption' });
    const first = screen.getByRole('button', { name: /^יום שבת א׳ בתשרי תשפ״ז/ });
    act(() => first.focus());

    await user.keyboard('{ArrowLeft}'); // RTL: the next day
    expect(screen.getByRole('button', { name: /^יום ראשון ב׳ בתשרי תשפ״ז/ })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(first).toHaveFocus();

    // One more day back leaves Tishrei: Elul 5786 (29 days) is loaded and its last day focused.
    await user.keyboard('{ArrowRight}');
    await screen.findByText('אלול תשפ״ו', { selector: 'caption' });
    const elul29 = await screen.findByRole('button', { name: /^יום שישי כ״ט באלול תשפ״ו/ });
    await waitFor(() => expect(elul29).toHaveFocus());
    expect(elul29).toHaveAttribute('tabindex', '0');
    expect(within(tableOf(screen.getByText('אלול תשפ״ו', { selector: 'caption' }))).getAllByRole('button')).toHaveLength(29);
    await waitFor(() => expect(politeRegion()).toHaveTextContent(/^חודש אלול תשפ״ו: מ-14\.08\.2026 עד 11\.09\.2026/));

    // Home: the start of the week (Sunday 6 September = כ״ד באלול) is still inside Elul.
    await user.keyboard('{Home}');
    expect(screen.getByRole('button', { name: /^יום ראשון כ״ד באלול תשפ״ו/ })).toHaveFocus();
    // End would be Saturday 12 September, which is Tishrei: clamped to the last day of Elul.
    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: /^יום שישי כ״ט באלול תשפ״ו/ })).toHaveFocus();

    // PageUp from 29 Elul: same day number in Av 5786.
    await user.keyboard('{PageUp}');
    await screen.findByText('אב תשפ״ו', { selector: 'caption' });
    const av29 = await screen.findByRole('button', { name: /^יום .* כ״ט באב תשפ״ו/ });
    await waitFor(() => expect(av29).toHaveFocus());
    // PageDown twice: back through Elul to 29 Tishrei.
    await user.keyboard('{PageDown}');
    await screen.findByText('אלול תשפ״ו', { selector: 'caption' });
    await waitFor(() => expect(screen.getByRole('button', { name: /^יום שישי כ״ט באלול תשפ״ו/ })).toHaveFocus());
    await user.keyboard('{PageDown}');
    await screen.findByText('תשרי תשפ״ז', { selector: 'caption' });
    const tishrei29 = await screen.findByRole('button', { name: /^יום שבת כ״ט בתשרי תשפ״ז/ });
    await waitFor(() => expect(tishrei29).toHaveFocus());

    await user.keyboard('{Enter}');
    await waitFor(() => expect(currentPath()).toBe('/day/2026-10-10'));
  });

  it('PageDown in the Hijri calendar moves to the same day of the next month', async () => {
    const { user } = renderPage('/calendar?system=hijri&year=1447&month=9');
    await screen.findByText('רמדאן 1447', { selector: 'caption' });
    act(() => screen.getByRole('button', { name: /^יום ראשון 5 ברמדאן 1447/ }).focus());
    await user.keyboard('{PageDown}');
    await screen.findByText('שוואל 1447', { selector: 'caption' });
    const shawwal = monthViewFor('hijri', 1447, 10, 'he');
    const day5 = await screen.findByRole('button', { name: /^יום .* 5 בשוואל 1447/ });
    await waitFor(() => expect(day5).toHaveFocus());
    expect(day5).toHaveAttribute('data-date', shawwal.days[4].iso);
    expect(api.calendar.range).toHaveBeenLastCalledWith(shawwal.firstDay, shawwal.lastDay);
  });

  it('opens in the remembered system on a bare /calendar, while a plain ?year&month link stays Gregorian', async () => {
    window.localStorage.setItem(CALENDAR_SYSTEM_KEY, JSON.stringify('hebrew'));
    const expected = monthViewContaining('hebrew', todayIso(), 'he');
    const first = renderPage('/calendar');
    await screen.findByText(expected.title, { selector: 'caption' });
    expect(api.calendar.range).toHaveBeenCalledWith(expected.firstDay, expected.lastDay);
    expect(screen.getByRole('combobox', { name: ET.calendarSystem })).toHaveValue('hebrew');
    first.unmount();

    vi.clearAllMocks();
    renderPage('/calendar?year=2026&month=9');
    await screen.findByText('ספטמבר 2026', { selector: 'caption' });
    expect(api.calendar.month).toHaveBeenCalledWith(2026, 9);
    expect(api.calendar.range).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: ET.calendarSystem })).toHaveValue('gregorian');
  });

  it('the month and year selects work in the Hebrew calendar', async () => {
    const { user } = renderPage('/calendar?system=hebrew&year=5787&month=1');
    await screen.findByText('תשרי תשפ״ז', { selector: 'caption' });
    await user.selectOptions(screen.getByRole('combobox', { name: ET.monthSelect }), '6');
    await screen.findByText('אדר א׳ תשפ״ז', { selector: 'caption' });
    expect(api.calendar.range).toHaveBeenLastCalledWith('2027-02-08', '2027-03-09');
    // 5786 has no Adar I: the 6th month there is Adar.
    await user.selectOptions(screen.getByRole('combobox', { name: ET.yearSelect }), '5786');
    await screen.findByText('אדר תשפ״ו', { selector: 'caption' });
    expect(within(screen.getByRole('combobox', { name: ET.monthSelect })).getAllByRole('option')).toHaveLength(12);
    expect(api.calendar.range).toHaveBeenLastCalledWith('2026-02-18', '2026-03-18');
  });

  it('renders a Hebrew month in English: ICU month names with digits, English sentences and holiday names', async () => {
    setCurrentLocale('en');
    renderPage('/calendar?system=hebrew&year=5787&month=1');
    const caption = await screen.findByText('Tishri 5787', { selector: 'caption' });
    expect(spans()).toHaveTextContent('Tishri 5787 runs from 12/09/2026 to 11/10/2026 · In the Hijri calendar: from 1 Rabiʻ II 1448 to 30 Rabiʻ II 1448');
    const buttons = within(tableOf(caption)).getAllByRole('button');
    expect(buttons[0].querySelector('.calendar__num')).toHaveTextContent(/^1$/);
    expect(buttons[0]).toHaveAccessibleName('Saturday 1 Tishri 5787: Rosh Hashanah (day 1 of 2), Mood 7, Energy 6, 3 of 5 habits completed, has an entry'.replace(', Energy 6, 3 of 5 habits completed', ''));
    expect(within(buttons[0]).getByText('Rosh Hashanah').closest('.holiday-badge')).toHaveAttribute('title', 'Rosh Hashanah (day 1 of 2) (Jewish)');
    expect(within(screen.getByRole('combobox', { name: 'Month' })).getAllByRole('option')[0]).toHaveTextContent('Tishri');
    expect(within(screen.getByRole('combobox', { name: 'Year' })).getByRole('option', { name: '5787' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Holiday legend' })).getByText('Jewish holidays and observances')).toBeInTheDocument();
  });
});
